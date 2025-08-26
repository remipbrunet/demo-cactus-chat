import { useState, useEffect } from 'react';
import { XStack, YStack, Progress, ScrollView, Button } from 'tamagui';
import { 
  Activity, 
  Clock, 
  Database, 
  Zap, 
  TrendingUp, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle
} from '@tamagui/lucide-icons';
import { RegularText } from '../RegularText';
import { RAGMetrics } from '@/services/rag/types';

interface SimpleRAGPerformanceDashboardProps {
  metrics: RAGMetrics;
  onRefresh: () => Promise<void>;
  isRefreshing?: boolean;
}

interface MetricCardProps {
  icon: React.ElementType;
  title: string;
  value: string | number;
  unit?: string;
  status?: 'good' | 'warning' | 'error';
  subtitle?: string;
}

function MetricCard({ 
  icon: Icon, 
  title, 
  value, 
  unit = '', 
  status = 'good',
  subtitle 
}: MetricCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'good': return '$green10';
      case 'warning': return '$orange10';
      case 'error': return '$red10';
      default: return '$gray10';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'good': return <CheckCircle size={12} color="$green10" />;
      case 'warning': return <AlertTriangle size={12} color="$orange10" />;
      case 'error': return <AlertTriangle size={12} color="$red10" />;
      default: return null;
    }
  };

  return (
    <YStack
      backgroundColor="$gray1"
      borderColor="$gray6"
      borderWidth={1}
      borderRadius="$4"
      padding="$3"
      gap="$2"
      flex={1}
      minWidth={120}
    >
      <XStack alignItems="center" justifyContent="space-between">
        <Icon size={16} color="$gray10" />
        {getStatusIcon()}
      </XStack>
      
      <YStack gap="$1">
        <XStack alignItems="baseline" gap="$1">
          <RegularText fontSize="$5" fontWeight="600" color={getStatusColor()}>
            {typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 2) : value}
          </RegularText>
          {unit && (
            <RegularText fontSize="$3" color="$gray10">
              {unit}
            </RegularText>
          )}
        </XStack>
        
        <RegularText fontSize="$2" color="$gray10" numberOfLines={2}>
          {title}
        </RegularText>
        
        {subtitle && (
          <RegularText fontSize="$1" color="$gray8" numberOfLines={1}>
            {subtitle}
          </RegularText>
        )}
      </YStack>
    </YStack>
  );
}

export function SimpleRAGPerformanceDashboard({
  metrics,
  onRefresh,
  isRefreshing = false
}: SimpleRAGPerformanceDashboardProps) {
  const [refreshTime, setRefreshTime] = useState<Date>(new Date());

  useEffect(() => {
    setRefreshTime(new Date());
  }, [metrics]);

  const handleRefresh = async () => {
    await onRefresh();
    setRefreshTime(new Date());
  };

  // Calculate derived metrics and status
  const getRetrievalStatus = () => {
    if (metrics.retrieval.latency > 2000) return 'error';
    if (metrics.retrieval.latency > 1000) return 'warning';
    return 'good';
  };

  const getProcessingStatus = () => {
    if (metrics.processing.embeddingTime > 5000) return 'error';
    if (metrics.processing.embeddingTime > 2000) return 'warning';
    return 'good';
  };

  const getCacheEfficiency = () => {
    const hitRate = metrics.retrieval.cacheHitRate;
    if (hitRate < 0.3) return 'error';
    if (hitRate < 0.6) return 'warning';
    return 'good';
  };

  return (
    <YStack gap="$4" flex={1}>
      {/* Header */}
      <XStack alignItems="center" justifyContent="space-between">
        <XStack alignItems="center" gap="$2">
          <Activity size={20} color="$blue10" />
          <RegularText fontSize="$5" fontWeight="600" color="$blue10">
            RAG Performance
          </RegularText>
        </XStack>
        
        <XStack alignItems="center" gap="$2">
          <RegularText fontSize="$2" color="$gray10">
            Updated: {refreshTime.toLocaleTimeString()}
          </RegularText>
          <Button
            size="$2"
            backgroundColor="$gray2"
            borderColor="$gray6"
            borderWidth={1}
            borderRadius="$3"
            onPress={handleRefresh}
            disabled={isRefreshing}
            opacity={isRefreshing ? 0.6 : 1}
            icon={<RefreshCw size={14} />}
          >
            <RegularText fontSize="$2">
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </RegularText>
          </Button>
        </XStack>
      </XStack>

      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack gap="$6">
          {/* Retrieval Metrics */}
          <YStack gap="$3">
            <RegularText fontSize="$4" fontWeight="500" color="$gray12">
              Document Retrieval
            </RegularText>
            
            <XStack gap="$3" flexWrap="wrap">
              <MetricCard
                icon={Clock}
                title="Latency"
                value={metrics.retrieval.latency}
                unit="ms"
                status={getRetrievalStatus()}
                subtitle="Per retrieval request"
              />
              
              <MetricCard
                icon={Database}
                title="Results"
                value={metrics.retrieval.resultsReturned}
                subtitle="Average returned"
              />
              
              <MetricCard
                icon={TrendingUp}
                title="Relevance"
                value={(metrics.retrieval.averageRelevance * 100)}
                unit="%"
                status={metrics.retrieval.averageRelevance > 0.8 ? 'good' : 'warning'}
                subtitle="Average relevance"
              />
            </XStack>
          </YStack>

          {/* Processing Metrics */}
          <YStack gap="$3">
            <RegularText fontSize="$4" fontWeight="500" color="$gray12">
              Document Processing
            </RegularText>
            
            <XStack gap="$3" flexWrap="wrap">
              <MetricCard
                icon={Zap}
                title="Embedding Time"
                value={metrics.processing.embeddingTime}
                unit="ms"
                status={getProcessingStatus()}
                subtitle="Per embedding"
              />
              
              <MetricCard
                icon={Activity}
                title="Documents"
                value={metrics.processing.documentsProcessed}
                subtitle="Processed"
              />
              
              <MetricCard
                icon={Database}
                title="Chunks"
                value={metrics.processing.chunksGenerated}
                subtitle="Generated"
              />
            </XStack>
          </YStack>

          {/* Context Metrics */}
          <YStack gap="$3">
            <RegularText fontSize="$4" fontWeight="500" color="$gray12">
              Context Generation
            </RegularText>
            
            <XStack gap="$3" flexWrap="wrap">
              <MetricCard
                icon={Activity}
                title="Context Length"
                value={metrics.context.contextLength}
                unit="tokens"
                subtitle="Current context"
              />
              
              <MetricCard
                icon={TrendingUp}
                title="Compression"
                value={(metrics.context.compressionRatio * 100)}
                unit="%"
                subtitle="Context compressed"
              />
              
              <MetricCard
                icon={CheckCircle}
                title="Relevant Chunks"
                value={metrics.context.relevantChunks}
                subtitle="Used in context"
              />
            </XStack>
          </YStack>

          {/* Cache Performance */}
          <YStack gap="$3">
            <RegularText fontSize="$4" fontWeight="500" color="$gray12">
              Cache Performance
            </RegularText>
            
            <XStack gap="$3" flexWrap="wrap">
              <MetricCard
                icon={Zap}
                title="Hit Rate"
                value={(metrics.retrieval.cacheHitRate * 100)}
                unit="%"
                status={getCacheEfficiency()}
                subtitle="Cache efficiency"
              />
            </XStack>
          </YStack>

          {/* Cache Hit Rate Progress */}
          <YStack gap="$2">
            <XStack alignItems="center" justifyContent="space-between">
              <RegularText fontSize="$3" color="$gray10">
                Cache Efficiency
              </RegularText>
              <RegularText fontSize="$3" color="$gray10">
                {(metrics.retrieval.cacheHitRate * 100).toFixed(1)}%
              </RegularText>
            </XStack>
            <Progress 
              value={metrics.retrieval.cacheHitRate * 100} 
              max={100} 
              height={8}
            >
              <Progress.Indicator 
                backgroundColor={
                  metrics.retrieval.cacheHitRate < 0.3 ? '$red10' :
                  metrics.retrieval.cacheHitRate < 0.6 ? '$orange10' : '$green10'
                } 
              />
            </Progress>
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
}