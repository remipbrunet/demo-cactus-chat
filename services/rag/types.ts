/**
 * RAG Service Types and Interfaces
 * Comprehensive type definitions for RAG pipeline
 */

export interface RAGConfig {
  // Vector embedding configuration
  embedding: {
    dimensions: number;
    model?: string;
    batchSize: number;
    maxTokensPerChunk: number;
  };

  // Document processing
  processing: {
    chunkSize: number;
    chunkOverlap: number;
    minChunkSize: number;
    separators: string[];
    preserveStructure: boolean;
  };

  // Retrieval settings
  retrieval: {
    topK: number;
    similarityThreshold: number;
    maxContextLength: number;
    rerankResults: boolean;
  };

  // MCP tool configuration for retrieval
  tools: {
    enabled: boolean;
    priorities: string[]; // Tool names in priority order
    timeoutMs: number;
    fallbackToVectorSearch: boolean;
  };

  // Query analysis configuration
  queryAnalysis: {
    enabled: boolean;
    dynamicPrioritization: boolean;
    confidenceThreshold: number;
    patterns: QueryPatternConfig[];
  };

  // Cache configuration
  cache: {
    enabled: boolean;
    maxSize: number;
    ttlSeconds: number;
    persistToDisk: boolean;
  };

  // Performance optimizations
  performance: {
    enableParallelProcessing: boolean;
    maxConcurrentRequests: number;
    requestTimeoutMs: number;
    enableCompression: boolean;
  };
}

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    sourceUri: string;
    serverId: string;
    chunkIndex: number;
    totalChunks: number;
    tokenCount: number;
    created: number;
    title?: string;
    section?: string;
    tags?: string[];
    sourceType?: string;
    lastModified?: number;
    author?: string;
    wordCount?: number;
    language?: string;
  };
  embedding?: number[];
  relevanceScore?: number;
}

export interface ProcessedDocument {
  uri: string;
  serverId: string;
  title: string;
  content: string;
  chunks: DocumentChunk[];
  metadata: {
    processedAt: number;
    tokenCount: number;
    chunkCount: number;
    language?: string;
    contentType?: string;
    lastModified?: number;
  };
  embedding?: number[];
}

export interface VectorIndex {
  id: string;
  serverId: string;
  documents: Map<string, ProcessedDocument>;
  embeddings: Map<string, number[]>; // chunkId -> embedding
  metadata: {
    created: number;
    lastUpdated: number;
    documentCount: number;
    chunkCount: number;
    dimensions: number;
  };
}

export interface RetrievalQuery {
  text: string;
  filters?: {
    serverIds?: string[];
    uris?: string[];
    tags?: string[];
    contentTypes?: string[];
    dateRange?: {
      start: number;
      end: number;
    };
  };
  options?: {
    topK?: number;
    threshold?: number;
    includeMetadata?: boolean;
    rerank?: boolean;
  };
}

export interface RetrievalResult {
  chunks: DocumentChunk[];
  query: string;
  metadata: {
    totalResults: number;
    retrievalTime: number;
    averageScore: number;
    sources: Array<{
      uri: string;
      serverId: string;
      chunkCount: number;
    }>;
  };
}

export interface RAGContext {
  chunks: DocumentChunk[];
  query: string;
  prompt: string;
  metadata: {
    totalTokens: number;
    sourceCount: number;
    relevanceRange: [number, number];
    generatedAt: number;
  };
}

export interface RAGMetrics {
  retrieval: {
    latency: number;
    resultsReturned: number;
    averageRelevance: number;
    cacheHitRate: number;
  };
  processing: {
    documentsProcessed: number;
    chunksGenerated: number;
    embeddingTime: number;
    indexUpdateTime: number;
  };
  context: {
    contextLength: number;
    compressionRatio: number;
    relevantChunks: number;
    duplicatesFiltered: number;
  };
}

export interface RAGState {
  isIndexing: boolean;
  isRetrieving: boolean;
  indexProgress?: {
    current: number;
    total: number;
    currentDocument?: string;
  };
  lastUpdate?: number;
  error?: string;
}

export interface EmbeddingProvider {
  name: string;
  dimensions: number;
  maxTokens: number;
  embed(texts: string[]): Promise<number[][]>;
  embedSingle(text: string): Promise<number[]>;
}

export interface DocumentProcessor {
  process(content: string, metadata: any): Promise<DocumentChunk[]>;
  supportedTypes: string[];
  chunkText(text: string, options?: any): string[];
}

export interface VectorStore {
  add(chunks: DocumentChunk[]): Promise<void>;
  search(query: number[], options?: any): Promise<DocumentChunk[]>;
  update(chunkId: string, chunk: DocumentChunk): Promise<void>;
  delete(chunkId: string): Promise<void>;
  clear(): Promise<void>;
  getStats(): Promise<{
    documentCount: number;
    chunkCount: number;
    indexSize: number;
    lastUpdated: number;
  }>;
}

export interface ContextBuilder {
  build(query: string, chunks: DocumentChunk[], options?: any): Promise<RAGContext>;
  compress(context: RAGContext, maxTokens: number): Promise<RAGContext>;
  rank(chunks: DocumentChunk[], query: string): Promise<DocumentChunk[]>;
}

// Error types
export class RAGError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'RAGError';
  }
}

export class EmbeddingError extends RAGError {
  constructor(message: string, details?: any) {
    super(message, 'EMBEDDING_ERROR', details);
  }
}

export class RetrievalError extends RAGError {
  constructor(message: string, details?: any) {
    super(message, 'RETRIEVAL_ERROR', details);
  }
}

export class ProcessingError extends RAGError {
  constructor(message: string, details?: any) {
    super(message, 'PROCESSING_ERROR', details);
  }
}

// Event types for RAG service
export type RAGEventType = 
  | 'index-update'
  | 'document-processed'
  | 'retrieval-complete'
  | 'error'
  | 'metrics-update'
  | 'cache-update';

export interface RAGEvent {
  type: RAGEventType;
  timestamp: number;
  data: any;
}

// Query Analysis Types
export interface QueryAnalysisResult {
  query: string;
  detectedPatterns: QueryPattern[];
  primaryCategory: QueryCategory;
  confidence: number;
  recommendedTools: string[];
  analysisTime: number;
}

export interface QueryPattern {
  category: QueryCategory;
  keywords: string[];
  regexPatterns?: RegExp[];
  confidence: number;
  toolPriorities: string[];
}

export interface QueryPatternConfig {
  category: QueryCategory;
  keywords: string[];
  regexPatterns?: string[];
  toolPriorities: string[];
  boost: number;
}

export enum QueryCategory {
  MICROSOFT_AZURE = 'microsoft_azure',
  GENERAL_WEB = 'general_web',
  PROGRAMMING_CODE = 'programming_code',
  LOCAL_APP_SPECIFIC = 'local_app_specific',
  DOCUMENTATION = 'documentation',
  TROUBLESHOOTING = 'troubleshooting',
  API_REFERENCE = 'api_reference',
  TUTORIAL_GUIDE = 'tutorial_guide'
}

export interface QueryAnalysisConfig {
  enabled: boolean;
  dynamicPrioritization: boolean;
  confidenceThreshold: number;
  patterns: QueryPatternConfig[];
  fallbackCategory: QueryCategory;
  analysisTimeoutMs: number;
}

// Prompt Parsing Types
export interface PromptHints {
  forcedTools: string[];
  excludedTools: string[];
  preferredTools: string[];
  serverMentions: string[];
  toolMentions: string[];
  naturalLanguageHints: string[];
  confidence: number;
}

export interface PromptParsingConfig {
  enabled: boolean;
  patterns: {
    serverMentions: RegExp[];
    toolDirectives: RegExp[];
    naturalLanguage: RegExp[];
    exclusions: RegExp[];
  };
  serverAliases: Record<string, string[]>;
  toolAliases: Record<string, string[]>;
}

export interface ParsedQuery {
  cleanQuery: string;
  originalQuery: string;
  hints: PromptHints;
  removedPhrases: string[];
  confidence: number;
}

// Load Balancing Types (re-export from load-balancer)
export { LoadBalancingStrategy } from '../mcp/load-balancer';

export interface ServerHealthMetrics {
  serverId: string;
  responseTimeAverage: number;
  successRate: number;
  currentLoad: number;
  isHealthy: boolean;
  lastFailureTime?: number;
  totalRequests: number;
  totalFailures: number;
  lastResponseTime?: number;
}

export interface LoadBalancingConfig {
  strategy: import('../mcp/load-balancer').LoadBalancingStrategy;
  maxFailuresBeforeUnhealthy: number;
  unhealthyCooldownMs: number;
  responseTimeWindowSize: number;
  successRateWindowSize: number;
  circuitBreakerThreshold: number;
}

export interface ServerSelectionResult {
  serverId: string;
  strategy: import('../mcp/load-balancer').LoadBalancingStrategy;
  selectionReason: string;
  healthMetrics: ServerHealthMetrics;
  alternativeServers: string[];
}