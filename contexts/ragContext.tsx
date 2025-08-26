/**
 * RAG Context Provider
 * React context for RAG state management and integration
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { RAGService, RAGConfig, RAGState, RAGMetrics, DEFAULT_RAG_CONFIG } from '../services/rag';
import { MCPService } from '../services/mcp';
import { Message } from '@/components/ui/chat/ChatMessage';

interface RAGContextType {
  // Service instance
  ragService: RAGService | null;
  
  // State
  isInitialized: boolean;
  isIndexing: boolean;
  isRetrieving: boolean;
  indexProgress?: {
    current: number;
    total: number;
    currentDocument?: string;
  };
  error?: string;
  
  // Metrics
  metrics: RAGMetrics;
  
  // Statistics
  statistics: {
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
  };
  
  // Configuration
  config: RAGConfig;
  
  // Methods
  enhancedQuery: (
    query: string,
    conversationId: string,
    messages: Message[],
    options?: {
      enableRAG?: boolean;
      serverFilters?: string[];
      maxResults?: number;
      includeHistory?: boolean;
      maxTokens?: number;
      enableReranking?: boolean;
    }
  ) => Promise<{
    context?: any;
    systemPrompt: string;
    metadata: {
      ragEnabled: boolean;
      chunksUsed: number;
      tokensUsed: number;
      sources: string[];
      processingTime: number;
    };
  }>;
  
  indexDocuments: (options?: {
    serverIds?: string[];
    forceRefresh?: boolean;
    maxDocuments?: number;
  }) => Promise<{
    success: boolean;
    documentsIndexed: number;
    chunksGenerated: number;
    indexingTime: number;
    errors: Array<{ uri: string; error: string }>;
  }>;
  
  searchDocuments: (
    query: string,
    options?: {
      serverFilters?: string[];
      maxResults?: number;
      threshold?: number;
      includeMetadata?: boolean;
    }
  ) => Promise<{
    chunks: any[];
    totalResults: number;
    searchTime: number;
  }>;
  
  updateConfig: (newConfig: Partial<RAGConfig>) => void;
  reset: () => Promise<void>;
  refreshStatistics: () => Promise<void>;
}

const RAGContext = createContext<RAGContextType | null>(null);

export const useRAG = () => {
  const context = useContext(RAGContext);
  if (!context) {
    throw new Error('useRAG must be used within a RAGProvider');
  }
  return context;
};

interface RAGProviderProps {
  children: React.ReactNode;
  mcpService: MCPService;
  config?: Partial<RAGConfig>;
}

export const RAGProvider: React.FC<RAGProviderProps> = ({ 
  children, 
  mcpService,
  config: initialConfig 
}) => {
  // Service reference
  const ragServiceRef = useRef<RAGService | null>(null);
  
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [indexProgress, setIndexProgress] = useState<{
    current: number;
    total: number;
    currentDocument?: string;
  } | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [config, setConfig] = useState<RAGConfig>({ ...DEFAULT_RAG_CONFIG, ...initialConfig });
  
  // Metrics
  const [metrics, setMetrics] = useState<RAGMetrics>({
    retrieval: { latency: 0, resultsReturned: 0, averageRelevance: 0, cacheHitRate: 0 },
    processing: { documentsProcessed: 0, chunksGenerated: 0, embeddingTime: 0, indexUpdateTime: 0 },
    context: { contextLength: 0, compressionRatio: 0, relevantChunks: 0, duplicatesFiltered: 0 },
  });
  
  // Statistics
  const [statistics, setStatistics] = useState<RAGContextType['statistics']>({
    isInitialized: false,
    vectorStore: { documentCount: 0, chunkCount: 0, indexSize: 0, lastUpdated: 0 },
    cache: { queryCache: { size: 0, hitRate: 0 }, embeddingCache: { size: 0 } },
    conversations: { activeConversations: 0, totalQueries: 0, averageContextLength: 0 },
  });

  // Initialize RAG service
  useEffect(() => {
    const initializeRAG = async () => {
      try {
        console.log('Initializing RAG service...');
        
        if (ragServiceRef.current) {
          await ragServiceRef.current.shutdown();
        }
        
        ragServiceRef.current = new RAGService(mcpService, {
          config,
          enableAutoIndexing: true,
          indexingInterval: 30 * 60 * 1000, // 30 minutes
          maxConcurrentRequests: 3,
          enableMetricsCollection: true,
          autoInitialize: true,
        });
        
        // Set up event listeners
        setupEventListeners();
        
        // Wait for initialization
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('RAG service initialization timeout'));
          }, 30000);
          
          const onInitialized = () => {
            clearTimeout(timeout);
            ragServiceRef.current?.off('initialized', onInitialized);
            ragServiceRef.current?.off('error', onError);
            resolve();
          };
          
          const onError = (error: Error) => {
            clearTimeout(timeout);
            ragServiceRef.current?.off('initialized', onInitialized);
            ragServiceRef.current?.off('error', onError);
            reject(error);
          };
          
          ragServiceRef.current?.on('initialized', onInitialized);
          ragServiceRef.current?.on('error', onError);
        });
        
        setIsInitialized(true);
        setError(undefined);
        
        // Load initial statistics
        await refreshStatistics();
        
        console.log('RAG service initialized successfully');
        
      } catch (error) {
        console.error('Failed to initialize RAG service:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        setIsInitialized(false);
      }
    };

    if (mcpService.isReady()) {
      initializeRAG();
    } else {
      // Wait for MCP service to be ready
      const onMCPReady = () => {
        initializeRAG();
        mcpService.off('ready', onMCPReady);
      };
      mcpService.on('ready', onMCPReady);
      
      return () => {
        mcpService.off('ready', onMCPReady);
      };
    }
  }, [mcpService, config]);

  // Set up event listeners
  const setupEventListeners = useCallback(() => {
    if (!ragServiceRef.current) return;

    const service = ragServiceRef.current;
    
    // State updates
    service.on('index-update', (data) => {
      if (data.status === 'starting') {
        setIsIndexing(true);
        setIndexProgress(undefined);
      } else if (data.status === 'complete') {
        setIsIndexing(false);
        setIndexProgress(undefined);
        refreshStatistics();
      } else if (data.status === 'processing' && data.current && data.total) {
        setIndexProgress({
          current: data.current,
          total: data.total,
          currentDocument: data.currentDocument,
        });
      }
    });
    
    service.on('query-complete', () => {
      setIsRetrieving(false);
      refreshStatistics();
    });
    
    service.on('metrics-update', (newMetrics: RAGMetrics) => {
      setMetrics(newMetrics);
    });
    
    service.on('error', (error: Error) => {
      setError(error.message);
      console.error('RAG service error:', error);
    });
    
    service.on('reset', () => {
      setMetrics({
        retrieval: { latency: 0, resultsReturned: 0, averageRelevance: 0, cacheHitRate: 0 },
        processing: { documentsProcessed: 0, chunksGenerated: 0, embeddingTime: 0, indexUpdateTime: 0 },
        context: { contextLength: 0, compressionRatio: 0, relevantChunks: 0, duplicatesFiltered: 0 },
      });
      refreshStatistics();
    });
    
  }, []);

  // Enhanced query method
  const enhancedQuery = useCallback(async (
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
  ) => {
    if (!ragServiceRef.current || !isInitialized) {
      return {
        systemPrompt: 'You are Cactus, a very capable AI assistant running offline on a smartphone.',
        metadata: {
          ragEnabled: false,
          chunksUsed: 0,
          tokensUsed: 0,
          sources: [],
          processingTime: 0,
        },
      };
    }

    try {
      setIsRetrieving(true);
      setError(undefined);
      
      const result = await ragServiceRef.current.enhancedQuery(
        query,
        conversationId,
        messages,
        options
      );
      
      return result;
      
    } catch (error) {
      console.error('RAG enhanced query failed:', error);
      setError(error instanceof Error ? error.message : 'Query failed');
      
      return {
        systemPrompt: 'You are Cactus, a very capable AI assistant running offline on a smartphone.',
        metadata: {
          ragEnabled: false,
          chunksUsed: 0,
          tokensUsed: 0,
          sources: [],
          processingTime: 0,
        },
      };
    } finally {
      setIsRetrieving(false);
    }
  }, [isInitialized]);

  // Index documents method
  const indexDocuments = useCallback(async (options: {
    serverIds?: string[];
    forceRefresh?: boolean;
    maxDocuments?: number;
  } = {}) => {
    if (!ragServiceRef.current || !isInitialized) {
      return {
        success: false,
        documentsIndexed: 0,
        chunksGenerated: 0,
        indexingTime: 0,
        errors: [{ uri: 'service', error: 'RAG service not ready' }],
      };
    }

    try {
      setError(undefined);
      const result = await ragServiceRef.current.indexDocuments(options);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Indexing failed';
      setError(errorMessage);
      return {
        success: false,
        documentsIndexed: 0,
        chunksGenerated: 0,
        indexingTime: 0,
        errors: [{ uri: 'indexing', error: errorMessage }],
      };
    }
  }, [isInitialized]);

  // Search documents method
  const searchDocuments = useCallback(async (
    query: string,
    options: {
      serverFilters?: string[];
      maxResults?: number;
      threshold?: number;
      includeMetadata?: boolean;
    } = {}
  ) => {
    if (!ragServiceRef.current || !isInitialized) {
      return {
        chunks: [],
        totalResults: 0,
        searchTime: 0,
      };
    }

    try {
      setError(undefined);
      const result = await ragServiceRef.current.searchDocuments(query, options);
      return result;
    } catch (error) {
      console.error('Document search failed:', error);
      setError(error instanceof Error ? error.message : 'Search failed');
      return {
        chunks: [],
        totalResults: 0,
        searchTime: 0,
      };
    }
  }, [isInitialized]);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<RAGConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    
    if (ragServiceRef.current) {
      ragServiceRef.current.updateConfig(newConfig);
    }
  }, [config]);

  // Reset RAG service
  const reset = useCallback(async () => {
    if (!ragServiceRef.current) return;
    
    try {
      setError(undefined);
      await ragServiceRef.current.reset();
      await refreshStatistics();
    } catch (error) {
      console.error('RAG reset failed:', error);
      setError(error instanceof Error ? error.message : 'Reset failed');
    }
  }, []);

  // Refresh statistics
  const refreshStatistics = useCallback(async () => {
    if (!ragServiceRef.current) return;
    
    try {
      const stats = await ragServiceRef.current.getStatistics();
      setStatistics(stats);
    } catch (error) {
      console.warn('Failed to refresh RAG statistics:', error);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ragServiceRef.current) {
        ragServiceRef.current.shutdown().catch(console.error);
      }
    };
  }, []);

  // Context value
  const value: RAGContextType = {
    ragService: ragServiceRef.current,
    isInitialized,
    isIndexing,
    isRetrieving,
    indexProgress,
    error,
    metrics,
    statistics,
    config,
    enhancedQuery,
    indexDocuments,
    searchDocuments,
    updateConfig,
    reset,
    refreshStatistics,
  };

  return (
    <RAGContext.Provider value={value}>
      {children}
    </RAGContext.Provider>
  );
};

export default RAGProvider;