/**
 * Document Retrieval Engine
 * High-level retrieval system with ranking and context optimization
 */

import {
  RetrievalQuery,
  RetrievalResult,
  DocumentChunk,
  RAGConfig,
  RetrievalError,
  RAGMetrics,
  QueryAnalysisResult,
  QueryPattern,
  QueryCategory,
  QueryPatternConfig,
  PromptHints,
  PromptParsingConfig,
  ParsedQuery,
} from './types';
import { MCPService, MCPResource } from '../mcp';
import { loadBalancer, LoadBalancingStrategy } from '../mcp/load-balancer';
import { EmbeddingService } from './embeddings';
import { MobileVectorStore } from './vector-store';
import { DocumentProcessingPipeline } from './processing';
import { MMKV } from 'react-native-mmkv';

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

interface CachedQuery {
  query: string;
  timestamp: number;
  result: RetrievalResult;
}

/**
 * Advanced document retrieval with caching and optimization
 */
export class DocumentRetrievalEngine extends SimpleEventEmitter {
  private mcpService: MCPService;
  private embeddingService: EmbeddingService;
  private vectorStore: MobileVectorStore;
  private processor: DocumentProcessingPipeline;
  private config: RAGConfig;
  private queryCache: MMKV;
  private metrics: RAGMetrics;
  private queryPatterns: QueryPattern[];
  private promptParsingConfig: PromptParsingConfig;

  constructor(
    mcpService: MCPService,
    embeddingService: EmbeddingService,
    vectorStore: MobileVectorStore,
    processor: DocumentProcessingPipeline,
    config: RAGConfig
  ) {
    super();
    this.mcpService = mcpService;
    this.embeddingService = embeddingService;
    this.vectorStore = vectorStore;
    this.processor = processor;
    this.config = config;
    this.queryCache = new MMKV({ id: 'retrieval-cache' });
    
    this.metrics = {
      retrieval: {
        latency: 0,
        resultsReturned: 0,
        averageRelevance: 0,
        cacheHitRate: 0,
      },
      processing: {
        documentsProcessed: 0,
        chunksGenerated: 0,
        embeddingTime: 0,
        indexUpdateTime: 0,
      },
      context: {
        contextLength: 0,
        compressionRatio: 0,
        relevantChunks: 0,
        duplicatesFiltered: 0,
      },
    };

    // Initialize query analysis patterns and prompt parsing
    this.queryPatterns = this.initializeQueryPatterns();
    this.promptParsingConfig = this.initializePromptParsing();
  }

  /**
   * Retrieve relevant documents for a query
   */
  async retrieve(query: RetrievalQuery): Promise<RetrievalResult> {
    const startTime = performance.now();
    
    try {
      // Check cache first
      if (this.config.cache.enabled) {
        const cached = this.getCachedResult(query.text);
        if (cached) {
          this.updateMetrics({ cacheHit: true, latency: performance.now() - startTime });
          return cached;
        }
      }

      // Parse prompt for explicit server/tool requests
      const parsedQuery = this.extractAndCleanQuery(query.text);
      const actualQuery = parsedQuery.cleanQuery;
      
      console.log(`Prompt parsing: found ${parsedQuery.hints.forcedTools.length} forced tools, ${parsedQuery.hints.excludedTools.length} exclusions`);
      
      // Analyze query and adjust tool priorities if enabled
      let toolPriorities = this.config.tools.priorities;
      
      if (this.config.queryAnalysis?.enabled && this.config.queryAnalysis.dynamicPrioritization) {
        const analysis = await this.analyzeQuery(actualQuery);
        toolPriorities = this.adjustToolPriorities(analysis, this.config.tools.priorities);
        console.log(`Query analysis: category=${analysis.primaryCategory}, confidence=${analysis.confidence.toFixed(2)}, base priorities: ${toolPriorities.join(', ')}`);
      }
      
      // Apply prompt hints to override/modify tool priorities
      if (parsedQuery.hints.confidence > 0) {
        toolPriorities = this.applyPromptHints(parsedQuery.hints, toolPriorities);
        console.log(`Prompt hints applied, final priorities: ${toolPriorities.join(', ')}`);
      }

      // Try MCP tools first if available
      let chunks: DocumentChunk[] = [];
      
      if (this.config.tools.enabled && this.mcpService.isReady()) {
        chunks = await this.tryMCPToolsWithPriorities(actualQuery, toolPriorities);
      }
      
      // Fallback to vector search if no MCP results and fallback is enabled, OR if tools are disabled
      if ((chunks.length === 0 && this.config.tools.fallbackToVectorSearch) || 
          (!this.config.tools.enabled)) {
        const reason = !this.config.tools.enabled ? 'MCP tools disabled' : 'MCP tools returned no results';
        console.log(`Using vector search (${reason})`);
        // Generate query embedding
        const queryEmbedding = await this.embeddingService.embedText(actualQuery);
        
        // Search vector store
        const searchOptions = {
          topK: query.options?.topK || this.config.retrieval.topK,
          threshold: query.options?.threshold || this.config.retrieval.similarityThreshold,
          filters: query.filters,
        };
        
        chunks = await this.vectorStore.search(queryEmbedding, searchOptions);
      } else if (chunks.length === 0 && !this.config.tools.fallbackToVectorSearch) {
        console.log('No MCP results found and vector search fallback is disabled');
      }
      
      // Re-rank results if enabled
      if (query.options?.rerank !== false && this.config.retrieval.rerankResults) {
        chunks = await this.rerankResults(actualQuery, chunks);
      }

      // Filter duplicates and apply final ranking
      chunks = this.deduplicateChunks(chunks);
      
      // Build result
      const result: RetrievalResult = {
        chunks,
        query: actualQuery,
        metadata: {
          totalResults: chunks.length,
          retrievalTime: performance.now() - startTime,
          averageScore: chunks.length > 0 
            ? chunks.reduce((sum, chunk) => sum + (chunk.relevanceScore || 0), 0) / chunks.length 
            : 0,
          sources: this.extractSources(chunks),
        },
      };

      // Cache the result (use original query for cache key)
      if (this.config.cache.enabled) {
        this.cacheResult(query.text, result);
      }

      this.updateMetrics({
        cacheHit: false,
        latency: result.metadata.retrievalTime,
        resultsReturned: result.chunks.length,
        averageRelevance: result.metadata.averageScore,
      });

      this.emit('retrieval-complete', result);
      return result;
      
    } catch (error) {
      const errorResult = new RetrievalError(
        `Retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { query: query.text }
      );
      
      this.emit('error', errorResult);
      throw errorResult;
    }
  }

  /**
   * Retrieve and index new documents from MCP servers
   */
  async indexDocuments(options: {
    serverIds?: string[];
    forceRefresh?: boolean;
    maxDocuments?: number;
  } = {}): Promise<{
    documentsIndexed: number;
    chunksGenerated: number;
    indexingTime: number;
    errors: Array<{ uri: string; error: string }>;
  }> {
    const startTime = performance.now();
    let documentsIndexed = 0;
    let chunksGenerated = 0;
    const errors: Array<{ uri: string; error: string }> = [];
    
    try {
      this.emit('index-update', { status: 'starting' });
      
      // Get available resources from MCP servers
      const resources = await this.mcpService.getAvailableResources();
      const filteredResources = options.serverIds 
        ? resources.filter(r => options.serverIds!.includes(r.serverId))
        : resources;
      
      const maxDocs = options.maxDocuments || filteredResources.length;
      const resourcesToProcess = filteredResources.slice(0, maxDocs);
      
      console.log(`Indexing ${resourcesToProcess.length} documents from ${new Set(resourcesToProcess.map(r => r.serverId)).size} servers`);

      // Process documents in batches to avoid memory issues
      const batchSize = this.config.performance.enableParallelProcessing ? 5 : 1;
      
      for (let i = 0; i < resourcesToProcess.length; i += batchSize) {
        const batch = resourcesToProcess.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (resource) => {
          try {
            // Check if we need to refresh this document
            if (!options.forceRefresh && await this.isDocumentUpToDate(resource)) {
              return null;
            }

            // Fetch document content
            const content = await this.mcpService.readResource(resource.serverId, resource.uri);
            
            if (!content.text || content.text.trim().length === 0) {
              console.warn(`Skipping empty document: ${resource.uri}`);
              return null;
            }

            // Process document into chunks
            const chunks = await this.processor.process(content.text, {
              sourceUri: resource.uri,
              serverId: resource.serverId,
              contentType: content.mimeType,
              lastModified: Date.now(),
            });

            // Add chunks to vector store
            await this.vectorStore.add(chunks);
            
            documentsIndexed++;
            chunksGenerated += chunks.length;
            
            this.emit('document-processed', {
              uri: resource.uri,
              serverId: resource.serverId,
              chunkCount: chunks.length,
            });

            return chunks.length;
            
          } catch (error) {
            console.error(`Failed to index document ${resource.uri}:`, error);
            errors.push({
              uri: resource.uri,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null;
          }
        });

        // Wait for batch to complete
        await Promise.all(batchPromises);
        
        // Emit progress
        this.emit('index-update', {
          status: 'processing',
          current: Math.min(i + batchSize, resourcesToProcess.length),
          total: resourcesToProcess.length,
        });
      }

      const indexingTime = performance.now() - startTime;
      
      this.updateMetrics({
        documentsProcessed: documentsIndexed,
        chunksGenerated,
        indexUpdateTime: indexingTime,
      });

      this.emit('index-update', { status: 'complete' });

      console.log(`Indexing complete: ${documentsIndexed} documents, ${chunksGenerated} chunks in ${indexingTime}ms`);
      
      return {
        documentsIndexed,
        chunksGenerated,
        indexingTime,
        errors,
      };
      
    } catch (error) {
      this.emit('error', error);
      throw new RetrievalError(
        `Document indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { documentsProcessed: documentsIndexed, chunksGenerated }
      );
    }
  }

  /**
   * Check if a document is up to date in the index
   */
  private async isDocumentUpToDate(resource: MCPResource): Promise<boolean> {
    try {
      const existingChunks = this.vectorStore.getChunksByDocument(resource.uri);
      
      if (existingChunks.length === 0) {
        return false;
      }

      // Simple check - in a real implementation, you'd compare timestamps
      // For now, consider documents older than 1 hour as outdated
      const oldestChunk = Math.min(...existingChunks.map(c => c.metadata.created));
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      return oldestChunk > oneHourAgo;
      
    } catch (error) {
      // If we can't check, assume it needs updating
      return false;
    }
  }

  /**
   * Re-rank results using advanced scoring
   */
  private async rerankResults(query: string, chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    if (chunks.length <= 1) {
      return chunks;
    }

    try {
      const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
      
      return chunks.map(chunk => {
        let score = chunk.relevanceScore || 0;
        
        // Boost score for exact term matches
        const content = chunk.content.toLowerCase();
        const exactMatches = queryTerms.filter(term => content.includes(term)).length;
        score += (exactMatches / queryTerms.length) * 0.2;
        
        // Boost score for recent documents
        const age = Date.now() - chunk.metadata.created;
        const ageBoost = Math.max(0, 0.1 - (age / (7 * 24 * 60 * 60 * 1000))); // Decay over 7 days
        score += ageBoost;
        
        // Boost score for longer, more substantial chunks
        const lengthBoost = Math.min(0.1, chunk.content.length / 10000);
        score += lengthBoost;
        
        return { ...chunk, relevanceScore: score };
      }).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      
    } catch (error) {
      console.warn('Re-ranking failed, returning original order:', error);
      return chunks;
    }
  }

  /**
   * Remove duplicate or near-duplicate chunks
   */
  private deduplicateChunks(chunks: DocumentChunk[]): DocumentChunk[] {
    if (chunks.length <= 1) {
      return chunks;
    }

    const uniqueChunks: DocumentChunk[] = [];
    const seenHashes = new Set<string>();
    
    for (const chunk of chunks) {
      // Create a simple hash of the content
      const contentHash = this.hashContent(chunk.content);
      
      if (!seenHashes.has(contentHash)) {
        seenHashes.add(contentHash);
        uniqueChunks.push(chunk);
      }
    }

    this.metrics.context.duplicatesFiltered = chunks.length - uniqueChunks.length;
    return uniqueChunks;
  }

  /**
   * Simple content hashing for deduplication
   */
  private hashContent(content: string): string {
    // Simple hash of first and last 100 characters + length
    const start = content.substring(0, 100);
    const end = content.substring(Math.max(0, content.length - 100));
    return `${start.length}_${end.length}_${content.length}`;
  }

  /**
   * Extract source information from chunks
   */
  private extractSources(chunks: DocumentChunk[]): Array<{
    uri: string;
    serverId: string;
    chunkCount: number;
  }> {
    const sourceMap = new Map<string, { serverId: string; count: number }>();
    
    for (const chunk of chunks) {
      const key = chunk.metadata.sourceUri;
      if (sourceMap.has(key)) {
        sourceMap.get(key)!.count++;
      } else {
        sourceMap.set(key, { serverId: chunk.metadata.serverId, count: 1 });
      }
    }
    
    return Array.from(sourceMap.entries()).map(([uri, info]) => ({
      uri,
      serverId: info.serverId,
      chunkCount: info.count,
    }));
  }

  /**
   * Cache query result
   */
  private cacheResult(query: string, result: RetrievalResult): void {
    if (!this.config.cache.enabled) {
      return;
    }

    try {
      const cacheKey = `query_${this.hashQuery(query)}`;
      const cachedQuery: CachedQuery = {
        query,
        timestamp: Date.now(),
        result,
      };
      
      this.queryCache.set(cacheKey, JSON.stringify(cachedQuery));
    } catch (error) {
      console.warn('Failed to cache query result:', error);
    }
  }

  /**
   * Get cached result for a query
   */
  private getCachedResult(query: string): RetrievalResult | null {
    if (!this.config.cache.enabled) {
      return null;
    }

    try {
      const cacheKey = `query_${this.hashQuery(query)}`;
      const cachedData = this.queryCache.getString(cacheKey);
      
      if (!cachedData) {
        return null;
      }

      const cached: CachedQuery = JSON.parse(cachedData);
      
      // Check if cache is expired
      const age = Date.now() - cached.timestamp;
      if (age > this.config.cache.ttlSeconds * 1000) {
        this.queryCache.delete(cacheKey);
        return null;
      }

      return cached.result;
      
    } catch (error) {
      console.warn('Failed to get cached result:', error);
      return null;
    }
  }

  private hashQuery(query: string): string {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Update metrics
   */
  private updateMetrics(update: {
    cacheHit?: boolean;
    latency?: number;
    resultsReturned?: number;
    averageRelevance?: number;
    documentsProcessed?: number;
    chunksGenerated?: number;
    indexUpdateTime?: number;
  }): void {
    if (update.latency !== undefined) {
      this.metrics.retrieval.latency = update.latency;
    }
    if (update.resultsReturned !== undefined) {
      this.metrics.retrieval.resultsReturned = update.resultsReturned;
    }
    if (update.averageRelevance !== undefined) {
      this.metrics.retrieval.averageRelevance = update.averageRelevance;
    }
    if (update.documentsProcessed !== undefined) {
      this.metrics.processing.documentsProcessed += update.documentsProcessed;
    }
    if (update.chunksGenerated !== undefined) {
      this.metrics.processing.chunksGenerated += update.chunksGenerated;
    }
    if (update.indexUpdateTime !== undefined) {
      this.metrics.processing.indexUpdateTime = update.indexUpdateTime;
    }
    
    // Update cache hit rate
    if (update.cacheHit !== undefined) {
      // Simple moving average for cache hit rate
      const weight = 0.1;
      const hitValue = update.cacheHit ? 1 : 0;
      this.metrics.retrieval.cacheHitRate = 
        (1 - weight) * this.metrics.retrieval.cacheHitRate + weight * hitValue;
    }

    this.emit('metrics-update', this.metrics);
  }

  /**
   * Get current metrics
   */
  getMetrics(): RAGMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear query cache
   */
  clearCache(): void {
    this.queryCache.clearAll();
    console.log('Cleared retrieval cache');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    const allKeys = this.queryCache.getAllKeys();
    return {
      size: allKeys.length,
      hitRate: this.metrics.retrieval.cacheHitRate,
    };
  }

  /**
   * Search for documents by metadata
   */
  async searchByMetadata(filters: {
    serverIds?: string[];
    uris?: string[];
    tags?: string[];
    dateRange?: { start: number; end: number };
  }): Promise<DocumentChunk[]> {
    try {
      const allChunks: DocumentChunk[] = [];
      
      // Get chunks from all servers if no specific servers requested
      const serverIds = filters.serverIds || [...new Set(
        (await this.mcpService.getAvailableResources()).map(r => r.serverId)
      )];
      
      for (const serverId of serverIds) {
        const serverChunks = this.vectorStore.getChunksByServer(serverId);
        allChunks.push(...serverChunks);
      }

      // Apply filters
      let filteredChunks = allChunks;
      
      if (filters.uris && filters.uris.length > 0) {
        filteredChunks = filteredChunks.filter(chunk =>
          filters.uris!.some(uri => chunk.metadata.sourceUri.includes(uri))
        );
      }
      
      if (filters.tags && filters.tags.length > 0) {
        filteredChunks = filteredChunks.filter(chunk =>
          filters.tags!.some(tag => (chunk.metadata.tags || []).includes(tag))
        );
      }
      
      if (filters.dateRange) {
        filteredChunks = filteredChunks.filter(chunk =>
          chunk.metadata.created >= filters.dateRange!.start &&
          chunk.metadata.created <= filters.dateRange!.end
        );
      }

      return filteredChunks.sort((a, b) => b.metadata.created - a.metadata.created);
      
    } catch (error) {
      throw new RetrievalError(
        `Metadata search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { filters }
      );
    }
  }

  /**
   * Initialize default query analysis patterns
   */
  private initializeQueryPatterns(): QueryPattern[] {
    const defaultPatterns: QueryPatternConfig[] = [
      {
        category: QueryCategory.MICROSOFT_AZURE,
        keywords: [
          'azure', 'microsoft', 'office 365', 'sharepoint', 'teams', 'outlook',
          'powershell', 'active directory', 'graph api', 'windows', 'dotnet',
          '.net', 'visual studio', 'sql server', 'cosmos db', 'app service',
          'functions', 'logic apps', 'power platform', 'dynamics', 'exchange'
        ],
        regexPatterns: [
          'microsoft\\s+\\w+', 'azure\\s+\\w+', '\\.net\\s+(core|framework)',
          'office\\s+365', 'power\\s+\\w+', 'dynamics\\s+\\w+'
        ],
        toolPriorities: ['microsoft_docs_search', 'microsoft_docs_fetch', 'brave_web_search'],
        boost: 1.5
      },
      {
        category: QueryCategory.PROGRAMMING_CODE,
        keywords: [
          'javascript', 'typescript', 'react', 'node', 'python', 'java', 'c#',
          'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'function', 'method',
          'class', 'interface', 'api', 'library', 'framework', 'package',
          'npm', 'pip', 'maven', 'gradle', 'github', 'git', 'repository'
        ],
        regexPatterns: [
          '\\b(function|method|class|interface)\\s+\\w+', 'import\\s+\\w+',
          'require\\(', 'from\\s+["\']\\w+["\']', '\\w+\\.\\w+\\(\\)',
          'git\\s+(clone|commit|push|pull)', 'npm\\s+(install|run)'
        ],
        toolPriorities: ['github_search_code', 'context7_get_library_docs', 'brave_web_search'],
        boost: 1.3
      },
      {
        category: QueryCategory.DOCUMENTATION,
        keywords: [
          'documentation', 'docs', 'guide', 'tutorial', 'how to', 'example',
          'reference', 'manual', 'readme', 'getting started', 'quick start',
          'overview', 'introduction', 'api docs', 'specification', 'guide'
        ],
        regexPatterns: [
          'how\\s+to\\s+\\w+', 'what\\s+is\\s+\\w+', 'getting\\s+started',
          'quick\\s+start', 'step\\s+by\\s+step', '\\w+\\s+tutorial',
          '\\w+\\s+guide', 'api\\s+reference'
        ],
        toolPriorities: ['microsoft_docs_search', 'context7_get_library_docs', 'brave_web_search'],
        boost: 1.2
      },
      {
        category: QueryCategory.TROUBLESHOOTING,
        keywords: [
          'error', 'issue', 'problem', 'fix', 'solve', 'troubleshoot', 'debug',
          'not working', 'broken', 'failed', 'exception', 'bug', 'crash',
          'unable to', "can't", "won't", "doesn't work", 'help'
        ],
        regexPatterns: [
          '\\w+\\s+error', 'error\\s+\\w+', '\\w+\\s+not\\s+working',
          'how\\s+to\\s+fix', 'unable\\s+to\\s+\\w+', "can't\\s+\\w+",
          'failed\\s+to\\s+\\w+', '\\w+\\s+exception'
        ],
        toolPriorities: ['brave_web_search', 'github_search_issues', 'microsoft_docs_search'],
        boost: 1.4
      },
      {
        category: QueryCategory.API_REFERENCE,
        keywords: [
          'api', 'endpoint', 'rest', 'graphql', 'webhook', 'oauth', 'authentication',
          'authorization', 'token', 'request', 'response', 'json', 'xml',
          'http', 'https', 'get', 'post', 'put', 'delete', 'patch'
        ],
        regexPatterns: [
          'api\\s+\\w+', '\\w+\\s+api', 'rest\\s+api', 'graphql\\s+\\w+',
          'http\\s+(get|post|put|delete)', '\\w+\\s+endpoint',
          'oauth\\s+\\w+', '\\w+\\s+authentication'
        ],
        toolPriorities: ['microsoft_docs_search', 'context7_get_library_docs', 'github_search_code'],
        boost: 1.3
      },
      {
        category: QueryCategory.GENERAL_WEB,
        keywords: [
          'news', 'latest', 'current', 'today', 'recent', 'update', 'release',
          'announcement', 'blog', 'article', 'review', 'comparison', 'vs',
          'best practices', 'tips', 'tricks', 'performance', 'security'
        ],
        regexPatterns: [
          'latest\\s+\\w+', 'recent\\s+\\w+', '\\w+\\s+vs\\s+\\w+',
          'best\\s+practices', '\\w+\\s+tips', '\\w+\\s+tricks',
          'what\\s+is\\s+the\\s+best', 'compare\\s+\\w+'
        ],
        toolPriorities: ['brave_web_search', 'brave_local_search'],
        boost: 1.0
      }
    ];

    // Convert pattern configs to patterns with compiled regex
    return defaultPatterns.map(config => ({
      category: config.category,
      keywords: config.keywords,
      regexPatterns: config.regexPatterns?.map(pattern => new RegExp(pattern, 'i')),
      confidence: 0,
      toolPriorities: config.toolPriorities
    }));
  }

  /**
   * Analyze query to determine category and recommended tools
   */
  async analyzeQuery(query: string): Promise<QueryAnalysisResult> {
    const startTime = performance.now();
    const queryLower = query.toLowerCase();
    
    try {
      const patternMatches: Array<{ pattern: QueryPattern; score: number }> = [];

      // Score each pattern based on keyword and regex matches
      for (const pattern of this.queryPatterns) {
        let score = 0;
        
        // Score keyword matches
        const keywordMatches = pattern.keywords.filter(keyword => 
          queryLower.includes(keyword.toLowerCase())
        );
        score += keywordMatches.length * 2; // Base score for keyword matches
        
        // Score regex pattern matches
        if (pattern.regexPatterns) {
          const regexMatches = pattern.regexPatterns.filter(regex => 
            regex.test(query)
          );
          score += regexMatches.length * 3; // Higher score for regex matches
        }
        
        // Apply category-specific boosts from config
        const configPattern = this.config.queryAnalysis?.patterns?.find(
          p => p.category === pattern.category
        );
        if (configPattern) {
          score *= configPattern.boost;
        }
        
        if (score > 0) {
          patternMatches.push({ pattern: { ...pattern, confidence: score }, score });
        }
      }

      // Sort patterns by score and determine primary category
      patternMatches.sort((a, b) => b.score - a.score);
      
      let primaryCategory = QueryCategory.GENERAL_WEB; // Default fallback
      let confidence = 0;
      let recommendedTools: string[] = [];
      
      if (patternMatches.length > 0) {
        const topMatch = patternMatches[0];
        primaryCategory = topMatch.pattern.category;
        confidence = Math.min(topMatch.score / 10, 1); // Normalize to 0-1
        recommendedTools = topMatch.pattern.toolPriorities;
      }

      const result: QueryAnalysisResult = {
        query,
        detectedPatterns: patternMatches.map(m => m.pattern),
        primaryCategory,
        confidence,
        recommendedTools,
        analysisTime: performance.now() - startTime
      };

      console.log(`Query analysis completed: ${result.primaryCategory} (${(result.confidence * 100).toFixed(1)}%) in ${result.analysisTime.toFixed(1)}ms`);
      return result;
      
    } catch (error) {
      console.warn('Query analysis failed, using defaults:', error);
      return {
        query,
        detectedPatterns: [],
        primaryCategory: QueryCategory.GENERAL_WEB,
        confidence: 0.5,
        recommendedTools: ['brave_web_search'],
        analysisTime: performance.now() - startTime
      };
    }
  }

  /**
   * Adjust tool priorities based on query analysis
   */
  adjustToolPriorities(analysis: QueryAnalysisResult, defaultPriorities: string[]): string[] {
    // If confidence is below threshold, use default priorities
    if (analysis.confidence < (this.config.queryAnalysis?.confidenceThreshold || 0.3)) {
      console.log(`Low confidence (${analysis.confidence.toFixed(2)}), using default priorities`);
      return defaultPriorities;
    }

    // Merge recommended tools with defaults, giving priority to recommendations
    const adjustedPriorities: string[] = [];
    const usedTools = new Set<string>();

    // Add recommended tools first
    for (const tool of analysis.recommendedTools) {
      if (!usedTools.has(tool)) {
        adjustedPriorities.push(tool);
        usedTools.add(tool);
      }
    }

    // Add remaining default tools
    for (const tool of defaultPriorities) {
      if (!usedTools.has(tool)) {
        adjustedPriorities.push(tool);
        usedTools.add(tool);
      }
    }

    return adjustedPriorities;
  }

  /**
   * Try MCP tools with custom priority order until one succeeds
   */
  private async tryMCPToolsWithPriorities(queryText: string, toolPriorities: string[]): Promise<DocumentChunk[]> {
    // Use provided priorities, fallback to config if empty
    const priorities = toolPriorities.length > 0 
      ? toolPriorities 
      : (this.config.tools.priorities.length > 0 
          ? this.config.tools.priorities 
          : ['microsoft_docs_search']); // Backward compatibility default
    
    console.log(`Trying MCP tools in priority order: ${priorities.join(', ')}`);
    
    // Group tools by server and get available servers for each tool
    const toolServerMap = new Map<string, string[]>();
    for (const toolName of priorities) {
      const servers = await this.mcpService.getServersForTool(toolName);
      if (servers.length > 0) {
        toolServerMap.set(toolName, servers);
      }
    }
    
    for (const toolName of priorities) {
      const availableServers = toolServerMap.get(toolName);
      
      if (!availableServers || availableServers.length === 0) {
        console.log(`No servers available for tool: ${toolName}`);
        continue;
      }
      
      try {
        console.log(`Attempting tool: ${toolName} for query: "${queryText}" with ${availableServers.length} servers`);
        
        // Use load balancer to select best server
        const selectedServer = loadBalancer.selectServer(availableServers, LoadBalancingStrategy.WEIGHTED);
        
        if (!selectedServer) {
          console.warn(`Load balancer could not select a server for tool: ${toolName}`);
          continue;
        }
        
        console.log(`Load balancer selected server: ${selectedServer} for tool: ${toolName}`);
        
        const chunks = await this.tryMCPToolOnServer(toolName, queryText, selectedServer);
        
        if (chunks.length > 0) {
          console.log(`Success! Tool ${toolName} on server ${selectedServer} returned ${chunks.length} chunks`);
          return chunks;
        } else {
          console.log(`Tool ${toolName} on server ${selectedServer} returned no results`);
        }
      } catch (error) {
        console.warn(`Tool ${toolName} failed:`, error);
        // Continue to next tool in priority list
      }
    }
    
    console.log('All MCP tools failed or returned no results, will fall back to vector search');
    return [];
  }

  /**
   * Try MCP tools in priority order until one succeeds (backward compatibility)
   */
  private async tryMCPTools(queryText: string): Promise<DocumentChunk[]> {
    return this.tryMCPToolsWithPriorities(queryText, this.config.tools.priorities);
  }

  /**
   * Attempt to call a single MCP tool on a specific server with load balancing
   */
  private async tryMCPToolOnServer(toolName: string, queryText: string, serverId: string): Promise<DocumentChunk[]> {
    const timeoutMs = this.config.tools.timeoutMs || 10000; // Default 10 second timeout
    const startTime = performance.now();
    
    // Track request start
    loadBalancer.trackRequest(serverId, toolName);
    
    return new Promise(async (resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        const responseTime = performance.now() - startTime;
        loadBalancer.trackResponse(serverId, false, responseTime);
        reject(new Error(`Tool ${toolName} on server ${serverId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const mcpResult = await this.mcpService.findAndCallTool(toolName, {
          query: queryText
        });
        
        clearTimeout(timeout);
        const responseTime = performance.now() - startTime;
        
        if (mcpResult.content) {
          // Track successful response
          loadBalancer.trackResponse(serverId, true, responseTime);
          
          const mcpChunks = this.convertMCPResultToChunks(mcpResult.content, queryText);
          
          console.log(`[LoadBalancer] Tool ${toolName} on server ${serverId} succeeded in ${responseTime.toFixed(1)}ms with ${mcpChunks.length} chunks`);
          resolve(mcpChunks);
        } else {
          // Track response with no content (still successful API call)
          loadBalancer.trackResponse(serverId, true, responseTime);
          
          console.log(`[LoadBalancer] Tool ${toolName} on server ${serverId} returned no content in ${responseTime.toFixed(1)}ms`);
          resolve([]);
        }
      } catch (error) {
        clearTimeout(timeout);
        const responseTime = performance.now() - startTime;
        
        // Track failed response
        loadBalancer.trackResponse(serverId, false, responseTime);
        
        console.error(`[LoadBalancer] Tool ${toolName} on server ${serverId} failed in ${responseTime.toFixed(1)}ms:`, error);
        reject(error);
      }
    });
  }

  /**
   * Attempt to call a single MCP tool (backward compatibility)
   */
  private async tryMCPTool(toolName: string, queryText: string): Promise<DocumentChunk[]> {
    // Get available servers for this tool
    const availableServers = await this.mcpService.getServersForTool(toolName);
    
    if (availableServers.length === 0) {
      throw new Error(`No servers available for tool: ${toolName}`);
    }
    
    // Use load balancer to select best server
    const selectedServer = loadBalancer.selectServer(availableServers, LoadBalancingStrategy.WEIGHTED);
    
    if (!selectedServer) {
      throw new Error(`Load balancer could not select a server for tool: ${toolName}`);
    }
    
    return this.tryMCPToolOnServer(toolName, queryText, selectedServer);
  }

  /**
   * Convert MCP search results to DocumentChunk format
   */
  private convertMCPResultToChunks(mcpContent: any, query: string): DocumentChunk[] {
    try {
      // Handle different MCP response formats
      let searchResults: any[] = [];
      
      if (Array.isArray(mcpContent)) {
        searchResults = mcpContent;
      } else if (mcpContent.results && Array.isArray(mcpContent.results)) {
        searchResults = mcpContent.results;
      } else if (typeof mcpContent === 'string') {
        // If it's a string, treat it as a single result
        searchResults = [{ content: mcpContent, title: 'Microsoft Docs Result', url: '' }];
      }
      
      console.log(`Converting ${searchResults.length} MCP results to chunks`);
      
      return searchResults.map((result, index) => {
        const chunk: DocumentChunk = {
          id: `mcp-${Date.now()}-${index}`,
          content: result.content || result.text || result.excerpt || String(result),
          relevanceScore: result.score || 0.9, // High relevance for MCP results
          metadata: {
            sourceUri: result.url || result.source || `https://learn.microsoft.com`,
            serverId: 'mcp-server', // Default MCP server ID
            sourceType: 'mcp-microsoft-docs',
            title: result.title || result.name || 'Microsoft Documentation',
            created: Date.now(),
            lastModified: Date.now(),
            author: 'Microsoft',
            tags: ['microsoft', 'documentation', 'official'],
            wordCount: (result.content || result.text || '').split(/\s+/).length,
            language: 'en',
            chunkIndex: index,
            totalChunks: searchResults.length,
            tokenCount: (result.content || result.text || '').split(/\s+/).length, // Approximation
          }
        };
        
        return chunk;
      });
      
    } catch (error) {
      console.error('Failed to convert MCP results to chunks:', error);
      return [];
    }
  }

  /**
   * Update MCP service reference
   */
  updateMCPService(newMCPService: MCPService): void {
    this.mcpService = newMCPService;
  }

  /**
   * Get query analysis for debugging/monitoring
   */
  async getQueryAnalysis(query: string): Promise<QueryAnalysisResult> {
    return this.analyzeQuery(query);
  }

  /**
   * Update query analysis patterns
   */
  updateQueryPatterns(patterns: QueryPatternConfig[]): void {
    this.queryPatterns = patterns.map(config => ({
      category: config.category,
      keywords: config.keywords,
      regexPatterns: config.regexPatterns?.map(pattern => new RegExp(pattern, 'i')),
      confidence: 0,
      toolPriorities: config.toolPriorities
    }));
    
    console.log(`Updated query patterns: ${patterns.length} patterns loaded`);
  }

  /**
   * Initialize prompt parsing configuration
   */
  private initializePromptParsing(): PromptParsingConfig {
    return {
      enabled: true,
      patterns: {
        serverMentions: [
          /@([a-z_]+)/gi,                           // @server_name
          /\bmcp:([a-z_]+)/gi,                      // mcp:tool_name
          /\bserver:([a-z_]+)/gi,                   // server:name
        ],
        toolDirectives: [
          /\buse\s+([a-z_\s]+?)(?:\s+server|\s+tool|\s+to|\s+for|$)/gi,  // "use microsoft docs"
          /\bwith\s+([a-z_\s]+?)(?:\s+server|\s+tool|\s+to|\s+for|$)/gi, // "with github"
          /\bvia\s+([a-z_\s]+?)(?:\s+server|\s+tool|\s+to|\s+for|$)/gi,  // "via web search"
          /\bthrough\s+([a-z_\s]+?)(?:\s+server|\s+tool|\s+to|\s+for|$)/gi, // "through microsoft"
        ],
        naturalLanguage: [
          /\b(search|check|look\s+in|use|query)\s+([a-z_\s]+?)(?:\s+for|\s+to|\s+about|$)/gi,
          /\b(microsoft|github|web|brave|docs?|documentation)\s+(search|docs?|api)/gi,
          /\b(find|get|retrieve)\s+(?:from|in|using)\s+([a-z_\s]+)/gi,
        ],
        exclusions: [
          /\b(?:don't|do\s+not|avoid|skip|exclude)\s+(?:use|using|via|with|from)\s+([a-z_\s]+)/gi,
          /\bno\s+([a-z_\s]+?)(?:\s+search|\s+tools?|$)/gi,
          /-([a-z_]+)/gi,                          // -tool_name
        ],
      },
      serverAliases: {
        'microsoft_docs_search': ['microsoft', 'ms', 'azure', 'docs', 'documentation', 'microsoft docs'],
        'microsoft_docs_fetch': ['microsoft fetch', 'ms fetch', 'fetch docs'],
        'brave_web_search': ['web', 'search', 'internet', 'google', 'brave', 'online'],
        'brave_local_search': ['local', 'nearby', 'local search'],
        'github_search_code': ['github', 'code', 'repository', 'repo', 'git'],
        'github_search_issues': ['github issues', 'issues', 'bugs'],
        'context7_get_library_docs': ['context7', 'library', 'lib docs', 'api docs'],
      },
      toolAliases: {
        'microsoft_docs_search': ['microsoft_docs', 'ms_docs', 'azure_docs'],
        'brave_web_search': ['web_search', 'google_search', 'internet_search'],
        'github_search_code': ['github_code', 'code_search'],
        'github_search_issues': ['github_issues', 'issue_search'],
        'context7_get_library_docs': ['context7_docs', 'library_docs'],
      }
    };
  }

  /**
   * Parse prompt for explicit server/tool hints
   */
  parsePromptHints(query: string): PromptHints {
    const hints: PromptHints = {
      forcedTools: [],
      excludedTools: [],
      preferredTools: [],
      serverMentions: [],
      toolMentions: [],
      naturalLanguageHints: [],
      confidence: 0
    };

    if (!this.promptParsingConfig.enabled) {
      return hints;
    }

    const queryLower = query.toLowerCase();
    let totalMatches = 0;

    // Parse server mentions (@server, mcp:tool, server:name)
    for (const pattern of this.promptParsingConfig.patterns.serverMentions) {
      let match;
      pattern.lastIndex = 0; // Reset regex
      while ((match = pattern.exec(query)) !== null) {
        if (match[1]) {
          const mention = match[1].toLowerCase();
          hints.serverMentions.push(mention);
          
          // Map to actual tool names
          const mappedTools = this.mapHintToTools(mention);
          hints.forcedTools.push(...mappedTools);
          totalMatches++;
        }
        // Prevent infinite loop
        if (!pattern.global) break;
      }
    }

    // Parse tool directives (use X, with Y, via Z)
    for (const pattern of this.promptParsingConfig.patterns.toolDirectives) {
      let match;
      pattern.lastIndex = 0; // Reset regex
      while ((match = pattern.exec(query)) !== null) {
        if (match[1]) {
          const directive = match[1].trim().toLowerCase();
          hints.naturalLanguageHints.push(`directive: ${directive}`);
          
          // Map to actual tool names
          const mappedTools = this.mapHintToTools(directive);
          hints.forcedTools.push(...mappedTools);
          totalMatches++;
        }
        // Prevent infinite loop
        if (!pattern.global) break;
      }
    }

    // Parse natural language hints
    for (const pattern of this.promptParsingConfig.patterns.naturalLanguage) {
      let match;
      pattern.lastIndex = 0; // Reset regex
      while ((match = pattern.exec(query)) !== null) {
        const fullMatch = match[0].toLowerCase();
        hints.naturalLanguageHints.push(fullMatch);
        
        // Extract tool hints from natural language
        const toolHints = this.extractToolsFromNaturalLanguage(fullMatch);
        hints.preferredTools.push(...toolHints);
        totalMatches += 0.5; // Lower weight for natural language
        
        // Prevent infinite loop
        if (!pattern.global) break;
      }
    }

    // Parse exclusions (don't use X, avoid Y, -Z)
    for (const pattern of this.promptParsingConfig.patterns.exclusions) {
      let match;
      pattern.lastIndex = 0; // Reset regex
      while ((match = pattern.exec(query)) !== null) {
        if (match[1]) {
          const exclusion = match[1].trim().toLowerCase();
          
          // Map to actual tool names
          const mappedTools = this.mapHintToTools(exclusion);
          hints.excludedTools.push(...mappedTools);
          totalMatches++;
        }
        // Prevent infinite loop
        if (!pattern.global) break;
      }
    }

    // Remove duplicates and calculate confidence
    hints.forcedTools = Array.from(new Set(hints.forcedTools));
    hints.excludedTools = Array.from(new Set(hints.excludedTools));
    hints.preferredTools = Array.from(new Set(hints.preferredTools));
    hints.serverMentions = Array.from(new Set(hints.serverMentions));
    hints.confidence = Math.min(totalMatches * 0.3, 1.0);

    console.log(`Prompt hints parsed: ${hints.forcedTools.length} forced, ${hints.excludedTools.length} excluded, confidence: ${hints.confidence.toFixed(2)}`);
    
    return hints;
  }

  /**
   * Extract and clean query, removing hint phrases
   */
  extractAndCleanQuery(query: string): ParsedQuery {
    const hints = this.parsePromptHints(query);
    let cleanQuery = query;
    const removedPhrases: string[] = [];

    if (!this.promptParsingConfig.enabled) {
      return {
        cleanQuery: query,
        originalQuery: query,
        hints,
        removedPhrases: [],
        confidence: 0
      };
    }

    // Remove server mentions
    for (const pattern of this.promptParsingConfig.patterns.serverMentions) {
      cleanQuery = cleanQuery.replace(pattern, (match, capture) => {
        removedPhrases.push(match);
        return '';
      });
    }

    // Remove explicit directives
    const directivePatterns = [
      /\buse\s+([a-z_\s]+?)(?:\s+server|\s+tool|\s+to|\s+for)/gi,
      /\bwith\s+([a-z_\s]+?)(?:\s+server|\s+tool|\s+to|\s+for)/gi,
      /\bvia\s+([a-z_\s]+?)(?:\s+server|\s+tool|\s+to|\s+for)/gi,
      /\bthrough\s+([a-z_\s]+?)(?:\s+server|\s+tool|\s+to|\s+for)/gi,
    ];

    for (const pattern of directivePatterns) {
      cleanQuery = cleanQuery.replace(pattern, (match) => {
        removedPhrases.push(match);
        return '';
      });
    }

    // Remove exclusions
    for (const pattern of this.promptParsingConfig.patterns.exclusions) {
      cleanQuery = cleanQuery.replace(pattern, (match) => {
        removedPhrases.push(match);
        return '';
      });
    }

    // Clean up extra whitespace
    cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim();

    // If query becomes too short, use original
    if (cleanQuery.length < 3) {
      cleanQuery = query;
    }

    const confidence = removedPhrases.length > 0 ? Math.min(removedPhrases.length * 0.4, 1.0) : 0;

    console.log(`Query cleaned: "${query}" → "${cleanQuery}" (removed ${removedPhrases.length} phrases)`);

    return {
      cleanQuery,
      originalQuery: query,
      hints,
      removedPhrases,
      confidence
    };
  }

  /**
   * Apply prompt hints to modify tool priorities
   */
  applyPromptHints(hints: PromptHints, currentPriorities: string[]): string[] {
    if (hints.confidence === 0) {
      return currentPriorities;
    }

    const finalPriorities: string[] = [];
    const usedTools = new Set<string>();

    // 1. Add forced tools first (highest priority)
    for (const forcedTool of hints.forcedTools) {
      if (!usedTools.has(forcedTool)) {
        finalPriorities.push(forcedTool);
        usedTools.add(forcedTool);
      }
    }

    // 2. Add preferred tools (medium-high priority)
    for (const preferredTool of hints.preferredTools) {
      if (!usedTools.has(preferredTool) && !hints.excludedTools.includes(preferredTool)) {
        finalPriorities.push(preferredTool);
        usedTools.add(preferredTool);
      }
    }

    // 3. Add remaining tools from current priorities, excluding blacklisted ones
    for (const tool of currentPriorities) {
      if (!usedTools.has(tool) && !hints.excludedTools.includes(tool)) {
        finalPriorities.push(tool);
        usedTools.add(tool);
      }
    }

    console.log(`Applied prompt hints: ${finalPriorities.length} tools prioritized, ${hints.excludedTools.length} excluded`);
    
    return finalPriorities;
  }

  /**
   * Map a hint string to actual tool names
   */
  private mapHintToTools(hint: string): string[] {
    const normalizedHint = hint.toLowerCase().trim();
    const mappedTools: string[] = [];

    // Check server aliases
    for (const [toolName, aliases] of Object.entries(this.promptParsingConfig.serverAliases)) {
      if (aliases.some(alias => normalizedHint.includes(alias.toLowerCase()) || alias.toLowerCase().includes(normalizedHint))) {
        mappedTools.push(toolName);
      }
    }

    // Check tool aliases
    for (const [toolName, aliases] of Object.entries(this.promptParsingConfig.toolAliases)) {
      if (aliases.some(alias => normalizedHint.includes(alias.toLowerCase()) || alias.toLowerCase().includes(normalizedHint))) {
        mappedTools.push(toolName);
      }
    }

    // Direct tool name match
    if (normalizedHint.includes('_') || normalizedHint.length > 5) {
      // Try to find tool names that contain the hint
      const availableTools = [
        'microsoft_docs_search', 'microsoft_docs_fetch', 'brave_web_search', 
        'brave_local_search', 'github_search_code', 'github_search_issues',
        'context7_get_library_docs'
      ];
      
      for (const tool of availableTools) {
        if (tool.includes(normalizedHint) || normalizedHint.includes(tool)) {
          mappedTools.push(tool);
        }
      }
    }

    return Array.from(new Set(mappedTools)); // Remove duplicates
  }

  /**
   * Extract tool preferences from natural language patterns
   */
  private extractToolsFromNaturalLanguage(naturalLanguage: string): string[] {
    const tools: string[] = [];
    
    // Microsoft/Azure patterns
    if (/microsoft|azure|ms|docs|documentation/i.test(naturalLanguage)) {
      tools.push('microsoft_docs_search');
    }
    
    // Web search patterns
    if (/search|web|internet|online|google|brave/i.test(naturalLanguage)) {
      tools.push('brave_web_search');
    }
    
    // GitHub patterns  
    if (/github|git|repository|repo|code/i.test(naturalLanguage)) {
      tools.push('github_search_code');
    }
    
    // Context7/Library patterns
    if (/library|api\s+docs|context7|lib/i.test(naturalLanguage)) {
      tools.push('context7_get_library_docs');
    }
    
    // Local search patterns
    if (/local|nearby|location/i.test(naturalLanguage)) {
      tools.push('brave_local_search');
    }

    return tools;
  }

  /**
   * Update prompt parsing configuration
   */
  updatePromptParsingConfig(config: Partial<PromptParsingConfig>): void {
    this.promptParsingConfig = { ...this.promptParsingConfig, ...config };
    console.log('Updated prompt parsing configuration');
  }

  /**
   * Get current prompt parsing configuration for debugging
   */
  getPromptParsingConfig(): PromptParsingConfig {
    return { ...this.promptParsingConfig };
  }

  /**
   * Get load balancer health metrics for all servers
   */
  getLoadBalancerHealth(): Array<{
    serverId: string;
    responseTimeAverage: number;
    successRate: number;
    currentLoad: number;
    isHealthy: boolean;
    totalRequests: number;
    totalFailures: number;
  }> {
    return loadBalancer.getAllServerHealth();
  }

  /**
   * Reset load balancer metrics for a specific server
   */
  resetServerMetrics(serverId: string): void {
    loadBalancer.resetMetrics(serverId);
    console.log(`Reset load balancer metrics for server: ${serverId}`);
  }

  /**
   * Update load balancing strategy
   */
  updateLoadBalancingStrategy(strategy: LoadBalancingStrategy): void {
    loadBalancer.updateConfig({ strategy });
    console.log(`Updated load balancing strategy to: ${strategy}`);
  }

  /**
   * Get current load balancing configuration
   */
  getLoadBalancingConfig(): {
    strategy: LoadBalancingStrategy;
    maxFailuresBeforeUnhealthy: number;
    unhealthyCooldownMs: number;
    responseTimeWindowSize: number;
    successRateWindowSize: number;
    circuitBreakerThreshold: number;
  } {
    // Access the private config through the metrics (this is a workaround)
    // In a real implementation, you'd expose this through the loadBalancer class
    const healthData = loadBalancer.getAllServerHealth();
    console.log('Load balancer health data requested:', healthData.length, 'servers tracked');
    
    // Return default config structure (in real implementation, expose from loadBalancer)
    return {
      strategy: LoadBalancingStrategy.WEIGHTED,
      maxFailuresBeforeUnhealthy: 3,
      unhealthyCooldownMs: 30000,
      responseTimeWindowSize: 20,
      successRateWindowSize: 100,
      circuitBreakerThreshold: 0.5
    };
  }
}