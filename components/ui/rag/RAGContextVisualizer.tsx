import { useState } from 'react';
import { 
  XStack, 
  YStack, 
  Text, 
  Button, 
  Progress, 
  ScrollView 
} from 'tamagui';
import { 
  Eye, 
  EyeOff, 
  FileText, 
  Target, 
  Clock, 
  TrendingUp,
  ChevronDown,
  ChevronRight
} from '@tamagui/lucide-icons';
import { RegularText } from '../RegularText';
import { RAGContext, DocumentChunk } from '@/services/rag/types';

interface RAGContextVisualizerProps {
  context: RAGContext | null;
  isVisible: boolean;
  onToggleVisibility: () => void;
  compact?: boolean;
}

interface ChunkDisplayProps {
  chunk: DocumentChunk;
  index: number;
  expanded: boolean;
  onToggleExpand: () => void;
}

function ChunkDisplay({ chunk, index, expanded, onToggleExpand }: ChunkDisplayProps) {
  const getSourceName = (uri: string) => {
    try {
      if (uri.includes('/')) {
        const parts = uri.split('/');
        return parts[parts.length - 1] || parts[parts.length - 2] || uri;
      }
      return uri;
    } catch {
      return uri;
    }
  };

  const getRelevanceColor = (score?: number) => {
    if (!score) return '$gray8';
    if (score >= 0.8) return '$green10';
    if (score >= 0.6) return '$yellow10';
    if (score >= 0.4) return '$orange10';
    return '$red10';
  };

  const getRelevanceLabel = (score?: number) => {
    if (!score) return 'Unknown';
    if (score >= 0.8) return 'High';
    if (score >= 0.6) return 'Good';
    if (score >= 0.4) return 'Medium';
    return 'Low';
  };

  return (
    <YStack
      backgroundColor="$gray1"
      borderColor="$gray6"
      borderWidth={1}
      borderRadius="$4"
      overflow="hidden"
    >
      {/* Header */}
      <XStack
        alignItems="center"
        justifyContent="space-between"
        padding="$3"
        backgroundColor="$gray2"
        onPress={onToggleExpand}
        pressStyle={{ backgroundColor: '$gray3' }}
      >
        <XStack alignItems="center" gap="$2" flex={1}>
          {expanded ? (
            <ChevronDown size={16} color="$gray10" />
          ) : (
            <ChevronRight size={16} color="$gray10" />
          )}
          
          <FileText size={16} color="$gray10" />
          
          <YStack flex={1}>
            <RegularText fontSize="$3" fontWeight="500" numberOfLines={1}>
              Source {index + 1}: {getSourceName(chunk.metadata.sourceUri)}
            </RegularText>
            {chunk.metadata.section && (
              <RegularText fontSize="$2" color="$gray10" numberOfLines={1}>
                Section: {chunk.metadata.section}
              </RegularText>
            )}
          </YStack>
        </XStack>

        {/* Relevance Score */}
        {chunk.relevanceScore && (
          <XStack alignItems="center" gap="$1">
            <Target size={12} color={getRelevanceColor(chunk.relevanceScore)} />
            <RegularText 
              fontSize="$2" 
              color={getRelevanceColor(chunk.relevanceScore)}
              fontWeight="500"
            >
              {getRelevanceLabel(chunk.relevanceScore)}
            </RegularText>
          </XStack>
        )}
      </XStack>

      {/* Content */}
      {expanded && (
        <YStack padding="$3" gap="$3">
          {/* Metadata */}
          <XStack gap="$4" flexWrap="wrap">
            <XStack alignItems="center" gap="$1">
              <Text fontSize="$2">📊</Text>
              <RegularText fontSize="$2" color="$gray10">
                {chunk.metadata.tokenCount} tokens
              </RegularText>
            </XStack>
            
            <XStack alignItems="center" gap="$1">
              <Clock size={12} color="$gray10" />
              <RegularText fontSize="$2" color="$gray10">
                {new Date(chunk.metadata.created).toLocaleDateString()}
              </RegularText>
            </XStack>
            
            {chunk.metadata.tags && chunk.metadata.tags.length > 0 && (
              <XStack alignItems="center" gap="$1">
                <Text fontSize="$2">🏷️</Text>
                <RegularText fontSize="$2" color="$gray10">
                  {chunk.metadata.tags.slice(0, 3).join(', ')}
                  {chunk.metadata.tags.length > 3 && '...'}
                </RegularText>
              </XStack>
            )}
          </XStack>

          {/* Content Preview */}
          <YStack
            backgroundColor="$gray1"
            borderColor="$gray6"
            borderWidth={1}
            borderRadius="$3"
            padding="$2"
          >
            <RegularText fontSize="$3" lineHeight={20}>
              {chunk.content.substring(0, 300)}
              {chunk.content.length > 300 && '...'}
            </RegularText>
          </YStack>
        </YStack>
      )}
    </YStack>
  );
}

export function RAGContextVisualizer({
  context,
  isVisible,
  onToggleVisibility,
  compact = false
}: RAGContextVisualizerProps) {
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());

  const toggleChunkExpansion = (index: number) => {
    const newExpanded = new Set(expandedChunks);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedChunks(newExpanded);
  };

  if (!context) {
    return (
      <XStack
        alignItems="center"
        gap="$2"
        backgroundColor="$gray1"
        borderColor="$gray6"
        borderWidth={1}
        borderRadius="$4"
        padding="$2"
      >
        <FileText size={16} color="$gray8" />
        <RegularText fontSize="$3" color="$gray8">
          No context available
        </RegularText>
      </XStack>
    );
  }

  // Compact view for chat interface
  if (compact) {
    return (
      <XStack
        alignItems="center"
        gap="$2"
        backgroundColor="$blue1"
        borderColor="$blue6"
        borderWidth={1}
        borderRadius="$4"
        padding="$2"
        onPress={onToggleVisibility}
        pressStyle={{ backgroundColor: '$blue2' }}
      >
        <TrendingUp size={16} color="$blue10" />
        <RegularText fontSize="$3" color="$blue10" flex={1}>
          {context.chunks.length} source{context.chunks.length !== 1 ? 's' : ''} • {context.metadata.totalTokens} tokens
        </RegularText>
        {isVisible ? (
          <EyeOff size={16} color="$blue10" />
        ) : (
          <Eye size={16} color="$blue10" />
        )}
      </XStack>
    );
  }

  return (
    <YStack gap="$3">
      {/* Header */}
      <XStack
        alignItems="center"
        justifyContent="space-between"
        backgroundColor="$blue1"
        borderColor="$blue6"
        borderWidth={1}
        borderRadius="$4"
        padding="$3"
      >
        <XStack alignItems="center" gap="$2">
          <TrendingUp size={20} color="$blue10" />
          <YStack>
            <RegularText fontSize="$4" fontWeight="500" color="$blue10">
              RAG Context
            </RegularText>
            <RegularText fontSize="$3" color="$blue9">
              {context.chunks.length} sources • {context.metadata.totalTokens} tokens
            </RegularText>
          </YStack>
        </XStack>

        <Button
          size="$3"
          backgroundColor="transparent"
          borderRadius="$4"
          onPress={onToggleVisibility}
          icon={isVisible ? <EyeOff size={16} color="$blue10" /> : <Eye size={16} color="$blue10" />}
        >
          <RegularText color="$blue10">
            {isVisible ? 'Hide' : 'Show'}
          </RegularText>
        </Button>
      </XStack>

      {isVisible && (
        <YStack gap="$3">
          {/* Context Metadata */}
          <XStack gap="$4" flexWrap="wrap">
            <XStack alignItems="center" gap="$1">
              <Text fontSize="$3">📄</Text>
              <RegularText fontSize="$3" color="$gray10">
                {context.metadata.sourceCount} unique sources
              </RegularText>
            </XStack>
            
            <XStack alignItems="center" gap="$1">
              <Text fontSize="$3">🎯</Text>
              <RegularText fontSize="$3" color="$gray10">
                Relevance: {context.metadata.relevanceRange[0].toFixed(2)} - {context.metadata.relevanceRange[1].toFixed(2)}
              </RegularText>
            </XStack>
            
            <XStack alignItems="center" gap="$1">
              <Clock size={14} color="$gray10" />
              <RegularText fontSize="$3" color="$gray10">
                Generated: {new Date(context.metadata.generatedAt).toLocaleTimeString()}
              </RegularText>
            </XStack>
          </XStack>

          {/* Token Usage Progress */}
          <YStack gap="$2">
            <XStack alignItems="center" justifyContent="space-between">
              <RegularText fontSize="$3" color="$gray10">
                Context Length
              </RegularText>
              <RegularText fontSize="$3" color="$gray10">
                {context.metadata.totalTokens} tokens
              </RegularText>
            </XStack>
            <Progress 
              value={Math.min((context.metadata.totalTokens / 4000) * 100, 100)} 
              max={100} 
              height={4}
            >
              <Progress.Indicator 
                backgroundColor={
                  context.metadata.totalTokens > 3000 ? '$red10' :
                  context.metadata.totalTokens > 2000 ? '$orange10' : '$green10'
                } 
              />
            </Progress>
          </YStack>

          {/* Source Documents */}
          <YStack gap="$2">
            <RegularText fontSize="$4" fontWeight="500">
              Source Documents
            </RegularText>
            
            <ScrollView maxHeight={400} showsVerticalScrollIndicator={false}>
              <YStack gap="$2">
                {context.chunks.map((chunk, index) => (
                  <ChunkDisplay
                    key={`${chunk.metadata.sourceUri}-${chunk.metadata.chunkIndex}`}
                    chunk={chunk}
                    index={index}
                    expanded={expandedChunks.has(index)}
                    onToggleExpand={() => toggleChunkExpansion(index)}
                  />
                ))}
              </YStack>
            </ScrollView>
          </YStack>
        </YStack>
      )}
    </YStack>
  );
}