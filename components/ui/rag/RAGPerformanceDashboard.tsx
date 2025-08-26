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

interface RAGPerformanceDashboardProps {
  metrics: RAGMetrics;
  onRefresh: () => Promise<void>;
  isRefreshing?: boolean;
}

interface MetricCardProps {
  icon: React.ElementType;
  title: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  status?: 'good' | 'warning' | 'error';
  subtitle?: string;
}

function MetricCard({ 
  icon: Icon, 
  title, 
  value, 
  unit = '', 
  trend, 
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

  const getTrendIcon = () => {
    if (!trend || trend === 'stable') return null;
    return (
      <TrendingUp 
        size={12} 
        color={trend === 'up' ? '$green10' : '$red10'}
        style={{ transform: trend === 'down' ? 'scaleY(-1)' : 'none' }}
      />
    );
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
          {getTrendIcon()}
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

export function RAGPerformanceDashboard({
  metrics,
  onRefresh,
  isRefreshing = false
}: RAGPerformanceDashboardProps) {
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
    if (metrics.retrieval.avgLatencyMs > 2000) return 'error';
    if (metrics.retrieval.avgLatencyMs > 1000) return 'warning';
    return 'good';
  };

  const getEmbeddingStatus = () => {
    if (metrics.embedding.avgProcessingTimeMs > 5000) return 'error';
    if (metrics.embedding.avgProcessingTimeMs > 2000) return 'warning';
    return 'good';
  };

  const getCacheEfficiency = () => {
    const hitRate = metrics.cache.hitRate;
    if (hitRate < 0.3) return 'error';
    if (hitRate < 0.6) return 'warning';
    return 'good';
  };

  const getMemoryStatus = () => {
    const usageGB = metrics.performance.memoryUsageBytes / (1024 * 1024 * 1024);
    if (usageGB > 2) return 'error';
    if (usageGB > 1) return 'warning';
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
                title="Avg Latency"
                value={metrics.retrieval.avgLatencyMs}
                unit="ms"
                status={getRetrievalStatus()}
                subtitle="Per retrieval request"
              />
              
              <MetricCard
                icon={Database}
                title="Documents"
                value={metrics.retrieval.totalDocuments}
                subtitle="In index"
              />
              
              <MetricCard
                icon={TrendingUp}
                title="Success Rate"
                value={(metrics.retrieval.successRate * 100)}
                unit="%"
                status={metrics.retrieval.successRate > 0.95 ? 'good' : 'warning'}
                subtitle="Successful retrievals"
              />
            </XStack>
          </YStack>

          {/* Embedding Metrics */}
          <YStack gap="$3">
            <RegularText fontSize="$4" fontWeight="500" color="$gray12">
              Embedding Processing
            </RegularText>
            
            <XStack gap="$3" flexWrap="wrap">
              <MetricCard
                icon={Zap}
                title="Processing Time"
                value={metrics.embedding.avgProcessingTimeMs}
                unit="ms"
                status={getEmbeddingStatus()}
                subtitle="Per embedding"
              />
              
              <MetricCard
                icon={Activity}
                title="Embeddings"
                value={metrics.embedding.totalEmbeddings}
                subtitle="Generated"
              />
              
              <MetricCard
                icon={Database}
                title="Vector Dim"
                value={metrics.embedding.dimensions}
                subtitle="Embedding size"
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
                value={(metrics.cache.hitRate * 100)}
                unit="%"
                status={getCacheEfficiency()}
                subtitle="Cache hits"
              />
              
              <MetricCard
                icon={Database}
                title="Cache Size"
                value={(metrics.cache.sizeBytes / (1024 * 1024)).toFixed(1)}
                unit="MB"
                subtitle="Memory used"
              />
              
              <MetricCard
                icon={Activity}
                title="Evictions"
                value={metrics.cache.evictions}
                subtitle="Items removed"
              />
            </XStack>
          </YStack>

          {/* System Performance */}
          <YStack gap="$3">
            <RegularText fontSize="$4" fontWeight="500" color="$gray12">
              System Resources
            </RegularText>
            
            <XStack gap="$3" flexWrap="wrap">
              <MetricCard
                icon={Activity}
                title="Memory Usage"
                value={(metrics.performance.memoryUsageBytes / (1024 * 1024)).toFixed(1)}
                unit="MB"
                status={getMemoryStatus()}
                subtitle="RAM used"
              />
              
              <MetricCard
                icon={Clock}
                title="CPU Usage"
                value={(metrics.performance.cpuUsagePercent * 100)}
                unit="%"
                status={metrics.performance.cpuUsagePercent > 0.8 ? 'warning' : 'good'}
                subtitle="Processor load"
              />
              
              <MetricCard
                icon={TrendingUp}
                title="Requests/min"
                value={metrics.performance.requestsPerMinute}
                subtitle="Current rate"
              />
            </XStack>
          </YStack>

          {/* Memory Usage Progress */}
          <YStack gap="$2">
            <XStack alignItems="center" justifyContent="space-between">
              <RegularText fontSize="$3" color="$gray10">
                Memory Usage
              </RegularText>
              <RegularText fontSize="$3" color="$gray10">
                {(metrics.performance.memoryUsageBytes / (1024 * 1024)).toFixed(1)} MB / 512 MB
              </RegularText>
            </XStack>
            <Progress 
              value={Math.min((metrics.performance.memoryUsageBytes / (512 * 1024 * 1024)) * 100, 100)} 
              max={100} 
              height={8}
            >
              <Progress.Indicator 
                backgroundColor={
                  metrics.performance.memoryUsageBytes > 400 * 1024 * 1024 ? '$red10' :
                  metrics.performance.memoryUsageBytes > 200 * 1024 * 1024 ? '$orange10' : '$green10'
                } 
              />
            </Progress>
          </YStack>

          {/* Cache Hit Rate Progress */}
          <YStack gap="$2">
            <XStack alignItems="center" justifyContent="space-between">
              <RegularText fontSize="$3" color="$gray10">
                Cache Efficiency
              </RegularText>
              <RegularText fontSize="$3" color="$gray10">
                {(metrics.cache.hitRate * 100).toFixed(1)}%
              </RegularText>
            </XStack>
            <Progress 
              value={metrics.cache.hitRate * 100} 
              max={100} 
              height={8}
            >
              <Progress.Indicator 
                backgroundColor={
                  metrics.cache.hitRate < 0.3 ? '$red10' :
                  metrics.cache.hitRate < 0.6 ? '$orange10' : '$green10'
                } 
              />
            </Progress>
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
}