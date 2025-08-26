import { useState, useEffect } from 'react';
import { 
  XStack, 
  YStack, 
  Slider, 
  Switch, 
  Button, 
  ToggleGroup,
  Text,
  Progress,
  ScrollView
} from 'tamagui';
import { 
  Settings, 
  Brain, 
  Target, 
  Zap, 
  Database,
  Gauge,
  RefreshCw,
  Save,
  RotateCcw
} from '@tamagui/lucide-icons';
import { Alert } from 'react-native';
import { RegularText } from '../RegularText';
import { RAGConfig } from '@/services/rag/types';

interface RAGConfigPanelProps {
  config: RAGConfig;
  onConfigChange: (config: RAGConfig) => void;
  onSave: () => Promise<void>;
  onReset: () => void;
  isRAGEnabled: boolean;
  onToggleRAG: (enabled: boolean) => void;
  performanceMetrics?: {
    avgRetrievalTime: number;
    cacheHitRate: number;
    memoryUsage: number;
  };
}

interface SectionHeaderProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}

function SectionHeader({ icon: Icon, title, children }: SectionHeaderProps) {
  return (
    <YStack gap="$3">
      <XStack alignItems="center" gap="$2">
        <Icon size={18} color="$gray10" />
        <RegularText fontSize="$4" fontWeight="500">
          {title}
        </RegularText>
      </XStack>
      {children}
    </YStack>
  );
}

export function RAGConfigPanel({
  config,
  onConfigChange,
  onSave,
  onReset,
  isRAGEnabled,
  onToggleRAG,
  performanceMetrics
}: RAGConfigPanelProps) {
  const [tempConfig, setTempConfig] = useState<RAGConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Update temp config when prop changes
  useEffect(() => {
    setTempConfig(config);
    setHasChanges(false);
  }, [config]);

  // Check for changes
  useEffect(() => {
    setHasChanges(JSON.stringify(tempConfig) !== JSON.stringify(config));
  }, [tempConfig, config]);

  const updateTempConfig = (path: string, value: any) => {
    setTempConfig(prevConfig => {
      const newConfig = { ...prevConfig };
      const keys = path.split('.');
      let current: any = newConfig;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]] = { ...current[keys[i]] };
      }
      
      current[keys[keys.length - 1]] = value;
      return newConfig;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      onConfigChange(tempConfig);
      await onSave();
    } catch (error) {
      Alert.alert(
        'Save Failed',
        error instanceof Error ? error.message : 'Failed to save configuration'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Configuration',
      'Are you sure you want to reset all RAG settings to defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: () => {
            onReset();
            setTempConfig(config);
          }
        }
      ]
    );
  };

  return (
    <ScrollView flex={1} showsVerticalScrollIndicator={false}>
      <YStack padding="$4" gap="$6">
        {/* RAG Toggle */}
        <XStack
          alignItems="center"
          justifyContent="space-between"
          backgroundColor="$blue1"
          borderColor="$blue6"
          borderWidth={1}
          borderRadius="$6"
          padding="$4"
        >
          <XStack alignItems="center" gap="$3">
            <Brain size={24} color="$blue10" />
            <YStack>
              <RegularText fontSize="$5" fontWeight="600" color="$blue10">
                RAG Enhancement
              </RegularText>
              <RegularText fontSize="$3" color="$blue9">
                Retrieval-Augmented Generation with context
              </RegularText>
            </YStack>
          </XStack>
          
          <Switch
            size="$4"
            checked={isRAGEnabled}
            backgroundColor={isRAGEnabled ? "$blue10" : "$gray6"}
            onCheckedChange={onToggleRAG}
            borderColor="transparent"
          >
            <Switch.Thumb 
              size="$4" 
              backgroundColor="white" 
              borderColor="$blue10" 
              borderWidth="$1"
            />
          </Switch>
        </XStack>

        {/* Performance Metrics */}
        {performanceMetrics && isRAGEnabled && (
          <YStack
            backgroundColor="$gray1"
            borderColor="$gray6"
            borderWidth={1}
            borderRadius="$4"
            padding="$3"
            gap="$3"
          >
            <XStack alignItems="center" gap="$2">
              <Gauge size={16} color="$gray10" />
              <RegularText fontSize="$4" fontWeight="500">
                Performance Metrics
              </RegularText>
            </XStack>
            
            <XStack gap="$4" flexWrap="wrap">
              <YStack alignItems="center" gap="$1">
                <RegularText fontSize="$2" color="$gray10">
                  Retrieval Time
                </RegularText>
                <RegularText fontSize="$3" fontWeight="500">
                  {performanceMetrics.avgRetrievalTime.toFixed(0)}ms
                </RegularText>
              </YStack>
              
              <YStack alignItems="center" gap="$1">
                <RegularText fontSize="$2" color="$gray10">
                  Cache Hit Rate
                </RegularText>
                <RegularText fontSize="$3" fontWeight="500">
                  {(performanceMetrics.cacheHitRate * 100).toFixed(1)}%
                </RegularText>
              </YStack>
              
              <YStack alignItems="center" gap="$1">
                <RegularText fontSize="$2" color="$gray10">
                  Memory Usage
                </RegularText>
                <RegularText fontSize="$3" fontWeight="500">
                  {(performanceMetrics.memoryUsage / 1024 / 1024).toFixed(1)}MB
                </RegularText>
              </YStack>
            </XStack>
          </YStack>
        )}

        {isRAGEnabled && (
          <>
            {/* Retrieval Settings */}
            <SectionHeader icon={Target} title="Retrieval Configuration">
              <YStack gap="$4">
                {/* Top K */}
                <YStack gap="$2">
                  <XStack alignItems="center" justifyContent="space-between">
                    <RegularText fontSize="$3">
                      Maximum Retrieved Documents
                    </RegularText>
                    <RegularText fontSize="$3" color="$blue10" fontWeight="500">
                      {tempConfig.retrieval.topK}
                    </RegularText>
                  </XStack>
                  <Slider 
                    value={[tempConfig.retrieval.topK]} 
                    max={20} 
                    min={1} 
                    step={1}
                    onValueChange={(value) => updateTempConfig('retrieval.topK', value[0])}
                  >
                    <Slider.Track backgroundColor="$gray6">
                      <Slider.TrackActive backgroundColor="$blue10"/>
                    </Slider.Track>
                    <Slider.Thumb circular index={0} size="$2" backgroundColor="white" borderColor="$blue10"/>
                  </Slider>
                  <RegularText fontSize="$2" color="$gray10">
                    Higher values provide more context but increase token usage
                  </RegularText>
                </YStack>

                {/* Similarity Threshold */}
                <YStack gap="$2">
                  <XStack alignItems="center" justifyContent="space-between">
                    <RegularText fontSize="$3">
                      Similarity Threshold
                    </RegularText>
                    <RegularText fontSize="$3" color="$blue10" fontWeight="500">
                      {tempConfig.retrieval.similarityThreshold.toFixed(2)}
                    </RegularText>
                  </XStack>
                  <Slider 
                    value={[Math.round(tempConfig.retrieval.similarityThreshold * 100)]} 
                    max={100} 
                    min={0} 
                    step={5}
                    onValueChange={(value) => updateTempConfig('retrieval.similarityThreshold', value[0] / 100)}
                  >
                    <Slider.Track backgroundColor="$gray6">
                      <Slider.TrackActive backgroundColor="$blue10"/>
                    </Slider.Track>
                    <Slider.Thumb circular index={0} size="$2" backgroundColor="white" borderColor="$blue10"/>
                  </Slider>
                  <RegularText fontSize="$2" color="$gray10">
                    Higher values require more similar content
                  </RegularText>
                </YStack>

                {/* Context Length */}
                <YStack gap="$2">
                  <XStack alignItems="center" justifyContent="space-between">
                    <RegularText fontSize="$3">
                      Maximum Context Length
                    </RegularText>
                    <RegularText fontSize="$3" color="$blue10" fontWeight="500">
                      {tempConfig.retrieval.maxContextLength} tokens
                    </RegularText>
                  </XStack>
                  <Slider 
                    value={[tempConfig.retrieval.maxContextLength]} 
                    max={8000} 
                    min={500} 
                    step={100}
                    onValueChange={(value) => updateTempConfig('retrieval.maxContextLength', value[0])}
                  >
                    <Slider.Track backgroundColor="$gray6">
                      <Slider.TrackActive backgroundColor="$blue10"/>
                    </Slider.Track>
                    <Slider.Thumb circular index={0} size="$2" backgroundColor="white" borderColor="$blue10"/>
                  </Slider>
                  <RegularText fontSize="$2" color="$gray10">
                    Balance between context richness and processing speed
                  </RegularText>
                </YStack>

                {/* Rerank Results */}
                <XStack alignItems="center" justifyContent="space-between">
                  <YStack flex={1}>
                    <RegularText fontSize="$3">
                      Rerank Results
                    </RegularText>
                    <RegularText fontSize="$2" color="$gray10">
                      Improve relevance with additional ranking
                    </RegularText>
                  </YStack>
                  <Switch
                    size="$3"
                    checked={tempConfig.retrieval.rerankResults}
                    backgroundColor={tempConfig.retrieval.rerankResults ? "$blue10" : "$gray6"}
                    onCheckedChange={(checked) => updateTempConfig('retrieval.rerankResults', checked)}
                    borderColor="transparent"
                  >
                    <Switch.Thumb 
                      size="$3" 
                      backgroundColor="white" 
                      borderColor="$blue10" 
                      borderWidth="$0.5"
                    />
                  </Switch>
                </XStack>
              </YStack>
            </SectionHeader>

            {/* Document Processing */}
            <SectionHeader icon={Database} title="Document Processing">
              <YStack gap="$4">
                {/* Chunk Size */}
                <YStack gap="$2">
                  <XStack alignItems="center" justifyContent="space-between">
                    <RegularText fontSize="$3">
                      Chunk Size
                    </RegularText>
                    <RegularText fontSize="$3" color="$blue10" fontWeight="500">
                      {tempConfig.processing.chunkSize} chars
                    </RegularText>
                  </XStack>
                  <Slider 
                    value={[tempConfig.processing.chunkSize]} 
                    max={2000} 
                    min={200} 
                    step={100}
                    onValueChange={(value) => updateTempConfig('processing.chunkSize', value[0])}
                  >
                    <Slider.Track backgroundColor="$gray6">
                      <Slider.TrackActive backgroundColor="$blue10"/>
                    </Slider.Track>
                    <Slider.Thumb circular index={0} size="$2" backgroundColor="white" borderColor="$blue10"/>
                  </Slider>
                  <RegularText fontSize="$2" color="$gray10">
                    Smaller chunks provide more precise retrieval
                  </RegularText>
                </YStack>

                {/* Chunk Overlap */}
                <YStack gap="$2">
                  <XStack alignItems="center" justifyContent="space-between">
                    <RegularText fontSize="$3">
                      Chunk Overlap
                    </RegularText>
                    <RegularText fontSize="$3" color="$blue10" fontWeight="500">
                      {tempConfig.processing.chunkOverlap} chars
                    </RegularText>
                  </XStack>
                  <Slider 
                    value={[tempConfig.processing.chunkOverlap]} 
                    max={500} 
                    min={0} 
                    step={25}
                    onValueChange={(value) => updateTempConfig('processing.chunkOverlap', value[0])}
                  >
                    <Slider.Track backgroundColor="$gray6">
                      <Slider.TrackActive backgroundColor="$blue10"/>
                    </Slider.Track>
                    <Slider.Thumb circular index={0} size="$2" backgroundColor="white" borderColor="$blue10"/>
                  </Slider>
                  <RegularText fontSize="$2" color="$gray10">
                    Overlap helps maintain context between chunks
                  </RegularText>
                </YStack>

                {/* Preserve Structure */}
                <XStack alignItems="center" justifyContent="space-between">
                  <YStack flex={1}>
                    <RegularText fontSize="$3">
                      Preserve Document Structure
                    </RegularText>
                    <RegularText fontSize="$2" color="$gray10">
                      Maintain headings and formatting when possible
                    </RegularText>
                  </YStack>
                  <Switch
                    size="$3"
                    checked={tempConfig.processing.preserveStructure}
                    backgroundColor={tempConfig.processing.preserveStructure ? "$blue10" : "$gray6"}
                    onCheckedChange={(checked) => updateTempConfig('processing.preserveStructure', checked)}
                    borderColor="transparent"
                  >
                    <Switch.Thumb 
                      size="$3" 
                      backgroundColor="white" 
                      borderColor="$blue10" 
                      borderWidth="$0.5"
                    />
                  </Switch>
                </XStack>
              </YStack>
            </SectionHeader>

            {/* Performance Settings */}
            <SectionHeader icon={Zap} title="Performance Optimization">
              <YStack gap="$4">
                {/* Cache Settings */}
                <XStack alignItems="center" justifyContent="space-between">
                  <YStack flex={1}>
                    <RegularText fontSize="$3">
                      Enable Caching
                    </RegularText>
                    <RegularText fontSize="$2" color="$gray10">
                      Cache embeddings and retrieval results
                    </RegularText>
                  </YStack>
                  <Switch
                    size="$3"
                    checked={tempConfig.cache.enabled}
                    backgroundColor={tempConfig.cache.enabled ? "$blue10" : "$gray6"}
                    onCheckedChange={(checked) => updateTempConfig('cache.enabled', checked)}
                    borderColor="transparent"
                  >
                    <Switch.Thumb 
                      size="$3" 
                      backgroundColor="white" 
                      borderColor="$blue10" 
                      borderWidth="$0.5"
                    />
                  </Switch>
                </XStack>

                {/* Parallel Processing */}
                <XStack alignItems="center" justifyContent="space-between">
                  <YStack flex={1}>
                    <RegularText fontSize="$3">
                      Parallel Processing
                    </RegularText>
                    <RegularText fontSize="$2" color="$gray10">
                      Process multiple documents simultaneously
                    </RegularText>
                  </YStack>
                  <Switch
                    size="$3"
                    checked={tempConfig.performance.enableParallelProcessing}
                    backgroundColor={tempConfig.performance.enableParallelProcessing ? "$blue10" : "$gray6"}
                    onCheckedChange={(checked) => updateTempConfig('performance.enableParallelProcessing', checked)}
                    borderColor="transparent"
                  >
                    <Switch.Thumb 
                      size="$3" 
                      backgroundColor="white" 
                      borderColor="$blue10" 
                      borderWidth="$0.5"
                    />
                  </Switch>
                </XStack>

                {/* Request Timeout */}
                <YStack gap="$2">
                  <XStack alignItems="center" justifyContent="space-between">
                    <RegularText fontSize="$3">
                      Request Timeout
                    </RegularText>
                    <RegularText fontSize="$3" color="$blue10" fontWeight="500">
                      {tempConfig.performance.requestTimeoutMs}ms
                    </RegularText>
                  </XStack>
                  <Slider 
                    value={[tempConfig.performance.requestTimeoutMs]} 
                    max={60000} 
                    min={5000} 
                    step={5000}
                    onValueChange={(value) => updateTempConfig('performance.requestTimeoutMs', value[0])}
                  >
                    <Slider.Track backgroundColor="$gray6">
                      <Slider.TrackActive backgroundColor="$blue10"/>
                    </Slider.Track>
                    <Slider.Thumb circular index={0} size="$2" backgroundColor="white" borderColor="$blue10"/>
                  </Slider>
                  <RegularText fontSize="$2" color="$gray10">
                    Maximum time to wait for document retrieval
                  </RegularText>
                </YStack>
              </YStack>
            </SectionHeader>
          </>
        )}

        {/* Action Buttons */}
        <XStack gap="$3" marginTop="$4">
          <Button
            flex={1}
            backgroundColor="$gray2"
            borderColor="$gray6"
            borderWidth={1}
            borderRadius="$4"
            onPress={handleReset}
            icon={<RotateCcw size={16} />}
          >
            <RegularText>Reset to Defaults</RegularText>
          </Button>

          <Button
            flex={1}
            backgroundColor="black"
            borderRadius="$4"
            onPress={handleSave}
            disabled={!hasChanges || isSaving}
            opacity={!hasChanges || isSaving ? 0.6 : 1}
            icon={<Save size={16} color="white" />}
          >
            <RegularText color="white">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </RegularText>
          </Button>
        </XStack>

        {hasChanges && (
          <RegularText fontSize="$3" color="$orange10" textAlign="center">
            You have unsaved changes
          </RegularText>
        )}
      </YStack>
    </ScrollView>
  );
}