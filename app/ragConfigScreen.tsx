import { useState, useEffect } from 'react';
import { ScrollView, YStack, ToggleGroup } from 'tamagui';
import { Settings, Brain, Database, Activity } from '@tamagui/lucide-icons';

import OnboardingScreenLayout from '@/components/ui/onboarding/OnboardingScreenLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { RegularText } from '@/components/ui/RegularText';
import { RAGConfigPanel } from '@/components/ui/rag/RAGConfigPanel';
import { RAGSourceSelector } from '@/components/ui/rag/RAGSourceSelector';
import { SimpleRAGPerformanceDashboard } from '@/components/ui/rag/SimpleRAGPerformanceDashboard';

import { RAGConfig, RAGMetrics, ProcessedDocument } from '@/services/rag/types';

// Mock RAG service integration - replace with actual service
const mockRAGConfig: RAGConfig = {
  embedding: {
    dimensions: 384,
    model: 'all-MiniLM-L6-v2',
    batchSize: 32,
    maxTokensPerChunk: 512
  },
  processing: {
    chunkSize: 1000,
    chunkOverlap: 200,
    minChunkSize: 100,
    separators: ['\n\n', '\n', '.', '?', '!'],
    preserveStructure: true
  },
  retrieval: {
    topK: 5,
    similarityThreshold: 0.7,
    maxContextLength: 2000,
    rerankResults: true
  },
  tools: {
    enabled: true,
    priorities: ['microsoft_docs_search', 'brave_web_search'],
    timeoutMs: 15000,
    fallbackToVectorSearch: true,
  },
  cache: {
    enabled: true,
    maxSize: 100 * 1024 * 1024, // 100MB
    ttlSeconds: 3600,
    persistToDisk: true
  },
  performance: {
    enableParallelProcessing: true,
    maxConcurrentRequests: 3,
    requestTimeoutMs: 30000,
    enableCompression: true
  }
};

const mockMetrics: RAGMetrics = {
  retrieval: {
    latency: 245,
    resultsReturned: 5,
    averageRelevance: 0.85,
    cacheHitRate: 0.73
  },
  processing: {
    documentsProcessed: 128,
    chunksGenerated: 2847,
    embeddingTime: 1200,
    indexUpdateTime: 850
  },
  context: {
    contextLength: 1847,
    compressionRatio: 0.8,
    relevantChunks: 4,
    duplicatesFiltered: 2
  }
};

const mockDocuments: ProcessedDocument[] = [
  {
    uri: 'doc://server1/react-documentation.md',
    serverId: 'server-1',
    title: 'React Documentation',
    content: 'React is a JavaScript library for building user interfaces. It lets you compose complex UIs from small and isolated pieces of code called "components"...',
    chunks: [],
    metadata: {
      processedAt: Date.now() - 3600000,
      tokenCount: 15420,
      chunkCount: 28,
      contentType: 'text/markdown'
    }
  },
  {
    uri: 'doc://server1/typescript-handbook.md',
    serverId: 'server-1',
    title: 'TypeScript Handbook',
    content: 'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript. Any browser. Any host. Any OS. Open source...',
    chunks: [],
    metadata: {
      processedAt: Date.now() - 7200000,
      tokenCount: 23890,
      chunkCount: 45,
      contentType: 'text/markdown'
    }
  },
  {
    uri: 'doc://server2/api-reference.json',
    serverId: 'server-2',
    title: 'API Reference',
    content: 'Complete API documentation including endpoints, parameters, responses, and examples...',
    chunks: [],
    metadata: {
      processedAt: Date.now() - 1800000,
      tokenCount: 8934,
      chunkCount: 18,
      contentType: 'application/json'
    }
  }
];

type TabType = 'config' | 'sources' | 'performance';

export default function RAGConfigScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('config');
  const [ragConfig, setRAGConfig] = useState<RAGConfig>(mockRAGConfig);
  const [isRAGEnabled, setIsRAGEnabled] = useState(true);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set(['doc://server1/react-documentation.md']));
  const [availableDocuments, setAvailableDocuments] = useState<ProcessedDocument[]>(mockDocuments);
  const [metrics, setMetrics] = useState<RAGMetrics>(mockMetrics);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleConfigChange = (newConfig: RAGConfig) => {
    setRAGConfig(newConfig);
  };

  const handleSaveConfig = async () => {
    // Mock save - replace with actual service call
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        console.log('RAG config saved:', ragConfig);
        resolve();
      }, 1000);
    });
  };

  const handleResetConfig = () => {
    setRAGConfig(mockRAGConfig);
  };

  const handleRefreshDocuments = async () => {
    setIsLoading(true);
    try {
      // Mock refresh - replace with actual service call
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Could update availableDocuments here with fresh data
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshMetrics = async () => {
    // Mock refresh - replace with actual service call
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Update metrics with fresh data
    setMetrics(prev => ({
      ...prev,
      retrieval: {
        ...prev.retrieval,
        latency: Math.floor(Math.random() * 500) + 200
      }
    }));
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'config':
        return (
          <RAGConfigPanel
            config={ragConfig}
            onConfigChange={handleConfigChange}
            onSave={handleSaveConfig}
            onReset={handleResetConfig}
            isRAGEnabled={isRAGEnabled}
            onToggleRAG={setIsRAGEnabled}
            performanceMetrics={{
              avgRetrievalTime: metrics.retrieval.latency,
              cacheHitRate: metrics.retrieval.cacheHitRate,
              memoryUsage: 89 * 1024 * 1024 // Mock memory usage
            }}
          />
        );

      case 'sources':
        return (
          <RAGSourceSelector
            availableDocuments={availableDocuments}
            selectedDocuments={selectedDocuments}
            onSelectionChange={setSelectedDocuments}
            onRefresh={handleRefreshDocuments}
            isLoading={isLoading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        );

      case 'performance':
        return (
          <SimpleRAGPerformanceDashboard
            metrics={metrics}
            onRefresh={handleRefreshMetrics}
            isRefreshing={false}
          />
        );

      default:
        return null;
    }
  };

  return (
    <OnboardingScreenLayout>
      <PageHeader 
        title="RAG Configuration"
        subtitle="Retrieval-Augmented Generation settings"
        includeBackButton 
      />
      
      <YStack width="95%" flex={1} gap="$4" paddingHorizontal="$2" paddingVertical="$4">
        {/* Tab Navigation */}
        <ToggleGroup 
          type="single" 
          value={activeTab} 
          onValueChange={(value: string) => setActiveTab(value as TabType)}
          backgroundColor="$gray2"
          borderRadius="$4"
          padding="$1"
        >
          <ToggleGroup.Item 
            value="config" 
            flex={1}
            borderColor={activeTab === 'config' ? "black" : "transparent"}
            backgroundColor={activeTab === 'config' ? "white" : "transparent"}
            borderRadius="$3"
          >
            <Settings size={16} color={activeTab === 'config' ? "black" : "$gray10"} />
            <RegularText 
              fontSize="$3" 
              fontWeight={activeTab === 'config' ? "500" : "400"}
              color={activeTab === 'config' ? "black" : "$gray10"}
            >
              Configuration
            </RegularText>
          </ToggleGroup.Item>
          
          <ToggleGroup.Item 
            value="sources" 
            flex={1}
            borderColor={activeTab === 'sources' ? "black" : "transparent"}
            backgroundColor={activeTab === 'sources' ? "white" : "transparent"}
            borderRadius="$3"
          >
            <Database size={16} color={activeTab === 'sources' ? "black" : "$gray10"} />
            <RegularText 
              fontSize="$3" 
              fontWeight={activeTab === 'sources' ? "500" : "400"}
              color={activeTab === 'sources' ? "black" : "$gray10"}
            >
              Sources ({selectedDocuments.size})
            </RegularText>
          </ToggleGroup.Item>
          
          <ToggleGroup.Item 
            value="performance" 
            flex={1}
            borderColor={activeTab === 'performance' ? "black" : "transparent"}
            backgroundColor={activeTab === 'performance' ? "white" : "transparent"}
            borderRadius="$3"
          >
            <Activity size={16} color={activeTab === 'performance' ? "black" : "$gray10"} />
            <RegularText 
              fontSize="$3" 
              fontWeight={activeTab === 'performance' ? "500" : "400"}
              color={activeTab === 'performance' ? "black" : "$gray10"}
            >
              Performance
            </RegularText>
          </ToggleGroup.Item>
        </ToggleGroup>

        {/* Tab Content */}
        <YStack flex={1}>
          {renderTabContent()}
        </YStack>
      </YStack>
    </OnboardingScreenLayout>
  );
}