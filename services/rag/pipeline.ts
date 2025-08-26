/**
 * RAG Processing Pipeline
 * End-to-end RAG orchestration with performance monitoring
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
  RAGMetrics,
  RAGState,
  RetrievalQuery,
  RetrievalResult,
  DocumentChunk,
  RAGError,
  RAGEvent,
} from './types';
import { MCPService } from '../mcp';
import { EmbeddingService } from './embeddings';
import { MobileVectorStore } from './vector-store';
import { DocumentProcessingPipeline } from './processing';
import { DocumentRetrievalEngine } from './retrieval';
import { RAGContextManager } from './context';
import { Message } from '@/components/ui/chat/ChatMessage';
import { MMKV } from 'react-native-mmkv';

export interface RAGPipelineOptions {
  enableAutoIndexing?: boolean;
  indexingInterval?: number;
  maxConcurrentRequests?: number;
  enableMetricsCollection?: boolean;
}

/**
 * Complete RAG pipeline orchestration
 */
export class RAGPipeline extends SimpleEventEmitter {
  private config: RAGConfig;
  private options: RAGPipelineOptions;
  
  // Core components
  private mcpService: MCPService;
  private embeddingService: EmbeddingService;
  private vectorStore: MobileVectorStore;
  private processor: DocumentProcessingPipeline;
  private retrievalEngine: DocumentRetrievalEngine;
  private contextManager: RAGContextManager;
  
  // State management
  private state: RAGState;
  private metrics: RAGMetrics;
  private storage: MMKV;
  
  // Background processing
  private autoIndexingTimer?: NodeJS.Timeout;
  private requestQueue: Array<() => Promise<any>> = [];
  private processingRequests = 0;

  constructor(
    mcpService: MCPService,
    config: RAGConfig,
    options: RAGPipelineOptions = {}
  ) {
    super();
    
    this.mcpService = mcpService;
    this.config = config;
    this.options = {
      enableAutoIndexing: true,
      indexingInterval: 30 * 60 * 1000, // 30 minutes
      maxConcurrentRequests: 3,
      enableMetricsCollection: true,
      ...options,
    };
    
    this.storage = new MMKV({ id: 'rag-pipeline' });
    
    // Initialize state
    this.state = {
      isIndexing: false,
      isRetrieving: false,
    };
    
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
    
    this.initializeComponents();
  }

  /**
   * Initialize all pipeline components
   */
  private async initializeComponents(): Promise<void> {
    try {
      console.log('Initializing RAG pipeline components...');
      
      // Initialize embedding service
      this.embeddingService = new EmbeddingService(this.config.embedding);
      
      // Initialize vector store
      this.vectorStore = new MobileVectorStore(this.config, this.embeddingService);
      
      // Initialize document processor
      this.processor = new DocumentProcessingPipeline(this.config.processing);
      
      // Initialize retrieval engine
      this.retrievalEngine = new DocumentRetrievalEngine(
        this.mcpService,
        this.embeddingService,
        this.vectorStore,
        this.processor,
        this.config
      );
      
      // Initialize context manager
      this.contextManager = new RAGContextManager(this.config);
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Start auto-indexing if enabled
      if (this.options.enableAutoIndexing) {
        this.startAutoIndexing();
      }
      
      console.log('RAG pipeline initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      console.error('Failed to initialize RAG pipeline:', error);
      throw new RAGError(
        `Pipeline initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INITIALIZATION_ERROR'
      );
    }
  }

  /**
   * Set up event listeners for component coordination
   */
  private setupEventListeners(): void {
    // Retrieval engine events
    this.retrievalEngine.on('retrieval-complete', (result: RetrievalResult) => {
      this.updateMetrics({ retrieval: result.metadata });
      this.emit('retrieval-complete', result);
    });

    this.retrievalEngine.on('document-processed', (data) => {
      this.emit('document-processed', data);
    });

    this.retrievalEngine.on('index-update', (data) => {
      if (data.status === 'starting') {
        this.state.isIndexing = true;
      } else if (data.status === 'complete') {
        this.state.isIndexing = false;
      }
      
      if (data.current && data.total) {
        this.state.indexProgress = {
          current: data.current,
          total: data.total,
          currentDocument: data.currentDocument,
        };
      } else {
        this.state.indexProgress = undefined;
      }
      
      this.emit('index-update', data);
    });

    this.retrievalEngine.on('error', (error) => {
      this.state.error = error.message;
      this.emit('error', error);
    });

    this.retrievalEngine.on('metrics-update', (metrics) => {
      this.updateMetrics({ processing: metrics });
    });

    // Context manager events
    this.contextManager.on('context-update', (data) => {
      this.updateMetrics({ context: data.metrics });
      this.emit('context-update', data);
    });

    // MCP service events
    this.mcpService.on('resource-update', (uri) => {
      if (this.options.enableAutoIndexing) {
        this.scheduleDocumentReindex(uri);
      }
    });
  }

  /**
   * Perform end-to-end RAG query
   */
  async query(
    query: string,
    conversationId: string,
    messages: Message[],
    options: {
      serverFilters?: string[];
      maxResults?: number;
      includeHistory?: boolean;
      maxTokens?: number;
      enableReranking?: boolean;
    } = {}
  ): Promise<RAGContext> {
    return this.executeWithQueue(async () => {
      const startTime = performance.now();
      
      try {
        this.state.isRetrieving = true;
        this.state.error = undefined;
        
        console.log(`Starting RAG query: "${query}" for conversation ${conversationId}`);
        
        // Step 1: Retrieve relevant documents
        const retrievalQuery: RetrievalQuery = {
          text: query,
          filters: {
            serverIds: options.serverFilters,
          },
          options: {
            topK: options.maxResults || this.config.retrieval.topK,
            threshold: this.config.retrieval.similarityThreshold,
            rerank: options.enableReranking !== false,
          },
        };
        
        const retrievalResult = await this.retrievalEngine.retrieve(retrievalQuery);
        
        // Step 2: Build conversation-aware context
        const contextOptions = {
          maxTokens: options.maxTokens,
          includeHistory: options.includeHistory,
        };
        
        const ragContext = await this.contextManager.buildConversationContext(
          conversationId,
          query,
          retrievalResult.chunks,
          messages,
          contextOptions
        );
        
        const totalTime = performance.now() - startTime;
        
        // Update metrics
        this.updateMetrics({
          retrieval: {
            latency: totalTime,
            resultsReturned: ragContext.chunks.length,
            averageRelevance: ragContext.metadata.relevanceRange[1] || 0,
          },
        });
        
        console.log(`RAG query completed in ${totalTime}ms: ${ragContext.chunks.length} chunks, ${ragContext.metadata.totalTokens} tokens`);
        
        this.emit('query-complete', {
          query,
          conversationId,
          context: ragContext,
          metrics: {
            totalTime,
            chunks: ragContext.chunks.length,
            tokens: ragContext.metadata.totalTokens,
          },
        });
        
        return ragContext;
        
      } catch (error) {
        const ragError = error instanceof RAGError ? error : new RAGError(
          `RAG query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'QUERY_ERROR',
          { query, conversationId }
        );
        
        this.state.error = ragError.message;
        this.emit('error', ragError);
        throw ragError;
        
      } finally {
        this.state.isRetrieving = false;
      }
    });
  }

  /**
   * Index documents from MCP servers
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
    return this.executeWithQueue(async () => {
      try {
        console.log('Starting document indexing...');
        
        const result = await this.retrievalEngine.indexDocuments(options);
        
        // Update stored metrics
        this.updateMetrics({
          processing: {
            documentsProcessed: result.documentsIndexed,
            chunksGenerated: result.chunksGenerated,
            indexUpdateTime: result.indexingTime,
          },
        });
        
        // Save indexing timestamp
        this.storage.set('last_indexing', Date.now().toString());
        
        console.log(`Document indexing completed: ${result.documentsIndexed} documents, ${result.chunksGenerated} chunks`);
        
        return result;
        
      } catch (error) {
        const ragError = new RAGError(
          `Document indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'INDEXING_ERROR'
        );
        
        this.emit('error', ragError);
        throw ragError;
      }
    });
  }

  /**
   * Get pipeline state and metrics
   */
  getState(): RAGState & { metrics: RAGMetrics } {
    return {
      ...this.state,
      metrics: this.getMetrics(),
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): RAGMetrics {
    // Get live metrics from components
    const retrievalMetrics = this.retrievalEngine?.getMetrics();
    const contextMetrics = this.contextManager?.getContextMetrics();
    
    return {
      retrieval: retrievalMetrics?.retrieval || this.metrics.retrieval,
      processing: retrievalMetrics?.processing || this.metrics.processing,
      context: contextMetrics || this.metrics.context,
    };
  }

  /**
   * Clear all caches and reset pipeline
   */
  async reset(): Promise<void> {
    try {
      console.log('Resetting RAG pipeline...');
      
      // Stop auto-indexing
      if (this.autoIndexingTimer) {
        clearInterval(this.autoIndexingTimer);
        this.autoIndexingTimer = undefined;
      }
      
      // Clear all caches and data
      await this.vectorStore.clear();
      this.retrievalEngine.clearCache();
      this.contextManager.clearAllContexts();
      this.embeddingService.clearCache();
      
      // Reset metrics
      this.metrics = {
        retrieval: { latency: 0, resultsReturned: 0, averageRelevance: 0, cacheHitRate: 0 },
        processing: { documentsProcessed: 0, chunksGenerated: 0, embeddingTime: 0, indexUpdateTime: 0 },
        context: { contextLength: 0, compressionRatio: 0, relevantChunks: 0, duplicatesFiltered: 0 },
      };
      
      // Reset state
      this.state = {
        isIndexing: false,
        isRetrieving: false,
      };
      
      // Clear storage
      this.storage.clearAll();
      
      // Restart auto-indexing if enabled
      if (this.options.enableAutoIndexing) {
        this.startAutoIndexing();
      }
      
      console.log('RAG pipeline reset complete');
      this.emit('reset');
      
    } catch (error) {
      throw new RAGError(
        `Pipeline reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RESET_ERROR'
      );
    }
  }

  /**
   * Get pipeline statistics
   */
  async getStatistics(): Promise<{
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
    const vectorStats = await this.vectorStore.getStats();
    const cacheStats = this.retrievalEngine.getCacheStats();
    const embeddingStats = this.embeddingService.getCacheStats();
    const conversationStats = this.contextManager.getStats();
    const lastIndexing = this.storage.getString('last_indexing');
    
    return {
      vectorStore: vectorStats,
      cache: {
        queryCache: cacheStats,
        embeddingCache: embeddingStats,
      },
      conversations: conversationStats,
      lastIndexing: lastIndexing ? parseInt(lastIndexing) : undefined,
    };
  }

  /**
   * Start automatic document indexing
   */
  private startAutoIndexing(): void {
    if (this.autoIndexingTimer) {
      clearInterval(this.autoIndexingTimer);
    }
    
    this.autoIndexingTimer = setInterval(async () => {
      try {
        console.log('Starting automatic document indexing...');
        await this.indexDocuments({ forceRefresh: false });
      } catch (error) {
        console.error('Automatic indexing failed:', error);
      }
    }, this.options.indexingInterval);
    
    console.log(`Auto-indexing started with ${this.options.indexingInterval}ms interval`);
  }

  /**
   * Schedule a document for re-indexing
   */
  private scheduleDocumentReindex(uri: string): void {
    // Simple implementation - could be more sophisticated with prioritization
    setTimeout(async () => {
      try {
        const resources = await this.mcpService.getAvailableResources();
        const resource = resources.find(r => r.uri === uri);
        
        if (resource) {
          console.log(`Re-indexing updated document: ${uri}`);
          await this.indexDocuments({ 
            serverIds: [resource.serverId],
            forceRefresh: true,
            maxDocuments: 1,
          });
        }
      } catch (error) {
        console.error(`Failed to re-index document ${uri}:`, error);
      }
    }, 5000); // 5 second delay to batch updates
  }

  /**
   * Execute operation with request queue management
   */
  private async executeWithQueue<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const task = async () => {
        try {
          this.processingRequests++;
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.processingRequests--;
          this.processQueue();
        }
      };

      if (this.processingRequests < this.options.maxConcurrentRequests!) {
        task();
      } else {
        this.requestQueue.push(task);
      }
    });
  }

  /**
   * Process queued requests
   */
  private processQueue(): void {
    while (this.requestQueue.length > 0 && this.processingRequests < this.options.maxConcurrentRequests!) {
      const task = this.requestQueue.shift();
      if (task) {
        task();
      }
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(update: {
    retrieval?: Partial<RAGMetrics['retrieval']>;
    processing?: Partial<RAGMetrics['processing']>;
    context?: Partial<RAGMetrics['context']>;
  }): void {
    if (update.retrieval) {
      this.metrics.retrieval = { ...this.metrics.retrieval, ...update.retrieval };
    }
    if (update.processing) {
      this.metrics.processing = { ...this.metrics.processing, ...update.processing };
    }
    if (update.context) {
      this.metrics.context = { ...this.metrics.context, ...update.context };
    }
    
    if (this.options.enableMetricsCollection) {
      this.emit('metrics-update', this.metrics);
    }
  }

  /**
   * Update MCP service reference throughout the pipeline
   */
  updateMCPService(newMCPService: MCPService): void {
    this.mcpService = newMCPService;
    if (this.retrievalEngine) {
      this.retrievalEngine.updateMCPService(newMCPService);
    }
  }

  /**
   * Shutdown pipeline and cleanup resources
   */
  async shutdown(): Promise<void> {
    try {
      console.log('Shutting down RAG pipeline...');
      
      // Stop auto-indexing
      if (this.autoIndexingTimer) {
        clearInterval(this.autoIndexingTimer);
        this.autoIndexingTimer = undefined;
      }
      
      // Wait for pending requests to complete
      while (this.processingRequests > 0 || this.requestQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Clean up resources
      this.removeAllListeners();
      
      console.log('RAG pipeline shutdown complete');
      
    } catch (error) {
      console.error('Error during pipeline shutdown:', error);
    }
  }
}