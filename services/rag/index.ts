/**
 * RAG Service Integration Layer
 * Main entry point for RAG functionality
 */

// Simple EventEmitter implementation for React Native compatibility
class SimpleEventEmitter {
  private events: Record<string, Function[]> = {};

  on(event: string, callback: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  emit(event: string, ...args: any[]) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(...args));
    }
  }

  removeListener(event: string, callback: Function) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }
}
import {
  RAGConfig,
  RAGContext,
  RAGState,
  RAGMetrics,
  RetrievalQuery,
  RetrievalResult,
  DocumentChunk,
  RAGError,
} from './types';
import { RAGPipeline, RAGPipelineOptions } from './pipeline';
import { MCPService } from '../mcp';
import { Message } from '@/components/ui/chat/ChatMessage';
import { MMKV } from 'react-native-mmkv';

/**
 * Default RAG configuration optimized for mobile
 */
export const DEFAULT_RAG_CONFIG: RAGConfig = {
  embedding: {
    dimensions: 384,
    batchSize: 10,
    maxTokensPerChunk: 512,
  },
  processing: {
    chunkSize: 1000,
    chunkOverlap: 200,
    minChunkSize: 100,
    separators: ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' '],
    preserveStructure: true,
  },
  retrieval: {
    topK: 5,
    similarityThreshold: 0.1,
    maxContextLength: 3000,
    rerankResults: true,
  },
  tools: {
    enabled: true,
    priorities: ['microsoft_docs_search'], // Default to backward compatible behavior
    timeoutMs: 10000,
    fallbackToVectorSearch: true,
  },
  cache: {
    enabled: true,
    maxSize: 1000,
    ttlSeconds: 3600,
    persistToDisk: true,
  },
  performance: {
    enableParallelProcessing: true,
    maxConcurrentRequests: 3,
    requestTimeoutMs: 30000,
    enableCompression: true,
  },
};

export interface RAGServiceOptions extends RAGPipelineOptions {
  config?: Partial<RAGConfig>;
  autoInitialize?: boolean;
}

/**
 * Main RAG Service - High-level interface for RAG functionality
 */
export class RAGService extends SimpleEventEmitter {
  private pipeline: RAGPipeline;
  private mcpService: MCPService;
  private config: RAGConfig;
  private storage: MMKV;
  private isInitialized = false;

  constructor(mcpService: MCPService, options: RAGServiceOptions = {}) {
    super();
    
    this.mcpService = mcpService;
    this.config = { ...DEFAULT_RAG_CONFIG, ...options.config };
    this.storage = new MMKV({ id: 'rag-service' });
    
    // Initialize pipeline
    this.pipeline = new RAGPipeline(this.mcpService, this.config, options);
    this.setupEventListeners();
    
    // Changed: Don't auto-initialize during app startup - initialize lazily when first needed
    // This prevents blocking app startup with expensive RAG initialization
    // if (options.autoInitialize !== false) {
    //   this.initialize();
    // }
  }

  /**
   * Initialize RAG service
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      console.log('Initializing RAG Service...');
      
      // Don't wait for MCP service during initialization - it can be configured later
      // The RAG service will check for MCP readiness when actually performing queries
      
      // Initialize pipeline
      await this.waitForPipelineReady();
      
      // Restore settings
      await this.restoreSettings();
      
      this.isInitialized = true;
      console.log('RAG Service initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      const ragError = new RAGError(
        `RAG Service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SERVICE_INITIALIZATION_ERROR'
      );
      
      this.emit('error', ragError);
      throw ragError;
    }
  }

  /**
   * Enhanced chat query with RAG
   */
  async enhancedQuery(
    query: string,
    conversationId: string,
    messages: Message[],
    options: {
      enableRAG?: boolean;
      serverFilters?: string[];
      maxResults?: number;
      includeHistory?: boolean;
      maxTokens?: number;
      enableReranking?: boolean;
    } = {}
  ): Promise<{
    context?: RAGContext;
    systemPrompt: string;
    metadata: {
      ragEnabled: boolean;
      chunksUsed: number;
      tokensUsed: number;
      sources: string[];
      processingTime: number;
    };
  }> {
    const startTime = performance.now();
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Check if RAG is enabled and query benefits from context
      const enableRAG = options.enableRAG !== false && this.shouldUseRAG(query, messages);
      
      // Also check if MCP service is ready and has connected servers
      const mcpReady = this.mcpService.isReady();
      
      if (!enableRAG || !mcpReady) {
        if (!mcpReady) {
          console.log('No MCP servers connected, using base prompt');
        }
        return {
          systemPrompt: this.getBaseSystemPrompt(),
          metadata: {
            ragEnabled: false,
            chunksUsed: 0,
            tokensUsed: 0,
            sources: [],
            processingTime: performance.now() - startTime,
          },
        };
      }

      // Perform RAG query
      const ragContext = await this.pipeline.query(
        query,
        conversationId,
        messages,
        {
          serverFilters: options.serverFilters,
          maxResults: options.maxResults,
          includeHistory: options.includeHistory,
          maxTokens: options.maxTokens,
          enableReranking: options.enableReranking,
        }
      );

      const processingTime = performance.now() - startTime;
      
      // Build enhanced system prompt
      const systemPrompt = this.buildEnhancedSystemPrompt(ragContext);
      
      return {
        context: ragContext,
        systemPrompt,
        metadata: {
          ragEnabled: true,
          chunksUsed: ragContext.chunks.length,
          tokensUsed: ragContext.metadata.totalTokens,
          sources: ragContext.chunks.map(chunk => chunk.metadata.sourceUri),
          processingTime,
        },
      };
      
    } catch (error) {
      // Fallback gracefully
      console.error('RAG query failed, falling back to base prompt:', error);
      
      return {
        systemPrompt: this.getBaseSystemPrompt(),
        metadata: {
          ragEnabled: false,
          chunksUsed: 0,
          tokensUsed: 0,
          sources: [],
          processingTime: performance.now() - startTime,
        },
      };
    }
  }

  /**
   * Index documents from MCP servers
   */
  async indexDocuments(options: {
    serverIds?: string[];
    forceRefresh?: boolean;
    maxDocuments?: number;
  } = {}): Promise<{
    success: boolean;
    documentsIndexed: number;
    chunksGenerated: number;
    indexingTime: number;
    errors: Array<{ uri: string; error: string }>;
  }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const result = await this.pipeline.indexDocuments(options);
      
      return {
        success: true,
        ...result,
      };
      
    } catch (error) {
      return {
        success: false,
        documentsIndexed: 0,
        chunksGenerated: 0,
        indexingTime: 0,
        errors: [{ 
          uri: 'indexing', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }],
      };
    }
  }

  /**
   * Search documents by query
   */
  async searchDocuments(
    query: string,
    options: {
      serverFilters?: string[];
      maxResults?: number;
      threshold?: number;
      includeMetadata?: boolean;
    } = {}
  ): Promise<{
    chunks: DocumentChunk[];
    totalResults: number;
    searchTime: number;
  }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const retrievalQuery: RetrievalQuery = {
        text: query,
        filters: {
          serverIds: options.serverFilters,
        },
        options: {
          topK: options.maxResults || this.config.retrieval.topK,
          threshold: options.threshold || this.config.retrieval.similarityThreshold,
          includeMetadata: options.includeMetadata !== false,
        },
      };

      const result = await this.pipeline['retrievalEngine'].retrieve(retrievalQuery);
      
      return {
        chunks: result.chunks,
        totalResults: result.metadata.totalResults,
        searchTime: result.metadata.retrievalTime,
      };
      
    } catch (error) {
      console.error('Document search failed:', error);
      return {
        chunks: [],
        totalResults: 0,
        searchTime: 0,
      };
    }
  }

  /**
   * Get RAG service state and metrics
   */
  getState(): RAGState & { metrics: RAGMetrics } {
    if (!this.isInitialized) {
      return {
        isIndexing: false,
        isRetrieving: false,
        metrics: {
          retrieval: { latency: 0, resultsReturned: 0, averageRelevance: 0, cacheHitRate: 0 },
          processing: { documentsProcessed: 0, chunksGenerated: 0, embeddingTime: 0, indexUpdateTime: 0 },
          context: { contextLength: 0, compressionRatio: 0, relevantChunks: 0, duplicatesFiltered: 0 },
        },
      };
    }
    
    return this.pipeline.getState();
  }

  /**
   * Get RAG statistics
   */
  async getStatistics(): Promise<{
    isInitialized: boolean;
    vectorStore: {
      documentCount: number;
      chunkCount: number;
      indexSize: number;
      lastUpdated: number;
    };
    cache: {
      queryCache: { size: number; hitRate: number };
      embeddingCache: { size: number };
    };
    conversations: {
      activeConversations: number;
      totalQueries: number;
      averageContextLength: number;
    };
    lastIndexing?: number;
  }> {
    if (!this.isInitialized) {
      return {
        isInitialized: false,
        vectorStore: { documentCount: 0, chunkCount: 0, indexSize: 0, lastUpdated: 0 },
        cache: { queryCache: { size: 0, hitRate: 0 }, embeddingCache: { size: 0 } },
        conversations: { activeConversations: 0, totalQueries: 0, averageContextLength: 0 },
      };
    }

    const stats = await this.pipeline.getStatistics();
    return {
      isInitialized: true,
      ...stats,
    };
  }

  /**
   * Update RAG configuration
   */
  updateConfig(newConfig: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveSettings();
    
    // Emit config change event
    this.emit('config-update', this.config);
  }

  /**
   * Reset RAG service
   */
  async reset(): Promise<void> {
    try {
      if (this.isInitialized) {
        await this.pipeline.reset();
      }
      
      // Clear local storage
      this.storage.clearAll();
      
      console.log('RAG Service reset complete');
      this.emit('reset');
      
    } catch (error) {
      throw new RAGError(
        `RAG Service reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SERVICE_RESET_ERROR'
      );
    }
  }

  /**
   * Check if query should use RAG
   */
  private shouldUseRAG(query: string, messages: Message[]): boolean {
    // Simple heuristics - could be more sophisticated
    const queryLength = query.trim().length;
    
    // Very short queries probably don't need RAG
    if (queryLength < 10) {
      return false;
    }
    
    // Questions and complex queries benefit from RAG
    const hasQuestionWords = /\b(what|how|why|when|where|who|which|explain|describe|tell|show)\b/i.test(query);
    const isComplex = queryLength > 50 || query.includes(' and ') || query.includes(' or ');
    
    return hasQuestionWords || isComplex;
  }

  /**
   * Build enhanced system prompt with RAG context
   */
  private buildEnhancedSystemPrompt(ragContext: RAGContext): string {
    const basePrompt = this.getBaseSystemPrompt();
    
    if (ragContext.chunks.length === 0) {
      return basePrompt;
    }
    
    return `${basePrompt}\n\n${ragContext.prompt}`;
  }

  /**
   * Get base system prompt
   */
  private getBaseSystemPrompt(): string {
    return this.storage.getString('system_prompt') || 
           'You are Cactus, a very capable AI assistant running offline on a smartphone. You provide helpful, accurate, and concise responses.';
  }

  /**
   * Set up event listeners for pipeline
   */
  private setupEventListeners(): void {
    this.pipeline.on('initialized', () => {
      this.emit('pipeline-ready');
    });
    
    this.pipeline.on('query-complete', (data) => {
      this.emit('query-complete', data);
    });
    
    this.pipeline.on('index-update', (data) => {
      this.emit('index-update', data);
    });
    
    this.pipeline.on('document-processed', (data) => {
      this.emit('document-processed', data);
    });
    
    this.pipeline.on('retrieval-complete', (result) => {
      this.emit('retrieval-complete', result);
    });
    
    this.pipeline.on('context-update', (data) => {
      this.emit('context-update', data);
    });
    
    this.pipeline.on('metrics-update', (metrics) => {
      this.emit('metrics-update', metrics);
    });
    
    this.pipeline.on('error', (error) => {
      this.emit('error', error);
    });
    
    this.pipeline.on('reset', () => {
      this.emit('pipeline-reset');
    });
  }

  /**
   * Wait for MCP service to be ready
   */
  private async waitForMCPReady(timeout: number = 30000): Promise<void> {
    const start = Date.now();
    
    while (!this.mcpService.isReady() && (Date.now() - start) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (!this.mcpService.isReady()) {
      throw new RAGError('MCP Service did not become ready within timeout', 'MCP_TIMEOUT');
    }
  }

  /**
   * Wait for pipeline to be ready
   */
  private async waitForPipelineReady(timeout: number = 30000): Promise<void> {
    const start = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkReady = () => {
        if (Date.now() - start > timeout) {
          reject(new RAGError('Pipeline did not become ready within timeout', 'PIPELINE_TIMEOUT'));
          return;
        }
        
        // Check if pipeline has initialized (basic check)
        if (this.pipeline['embeddingService']) {
          resolve();
        } else {
          setTimeout(checkReady, 1000);
        }
      };
      
      checkReady();
    });
  }

  /**
   * Save settings to storage
   */
  private saveSettings(): void {
    try {
      this.storage.set('config', JSON.stringify(this.config));
    } catch (error) {
      console.warn('Failed to save RAG settings:', error);
    }
  }

  /**
   * Restore settings from storage
   */
  private async restoreSettings(): Promise<void> {
    try {
      const configStr = this.storage.getString('config');
      if (configStr) {
        const savedConfig = JSON.parse(configStr);
        this.config = { ...DEFAULT_RAG_CONFIG, ...savedConfig };
      }
    } catch (error) {
      console.warn('Failed to restore RAG settings:', error);
    }
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.mcpService.isReady();
  }

  /**
   * Update MCP service reference throughout the RAG chain
   */
  updateMCPService(newMCPService: MCPService): void {
    this.mcpService = newMCPService;
    if (this.pipeline) {
      this.pipeline.updateMCPService(newMCPService);
    }
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    try {
      if (this.isInitialized) {
        await this.pipeline.shutdown();
      }
      
      this.removeAllListeners();
      this.isInitialized = false;
      
      console.log('RAG Service shutdown complete');
      
    } catch (error) {
      console.error('Error during RAG service shutdown:', error);
    }
  }
}

// Re-export types and utilities
export * from './types';
export { DEFAULT_RAG_CONFIG };
export type { RAGPipelineOptions, RAGServiceOptions };