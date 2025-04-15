import { YStack, Button, Text, XStack, Input, Progress } from 'tamagui'
import { Modal, View, TouchableWithoutFeedback, Animated, ScrollView } from 'react-native'
import { useEffect, useRef, useState } from 'react'
import { Check, Trash, Download } from '@tamagui/lucide-icons'
import { LocalModel, getLocalModels, removeLocalModel } from '@/services/storage'
import { downloadModel, validateModelUrl, truncateModelName } from '@/utils/modelUtils'

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnectOpenAI: () => void
  onConnectAnthropic: () => void
  onDeleteOpenAI?: () => void
  onDeleteAnthropic?: () => void
  hasOpenAIKey: boolean
  hasAnthropicKey: boolean
  hasGeminiKey: boolean
  onConnectGemini: () => void
  onDeleteGemini: () => void
  onModelDownloaded?: (name: string) => void
}

export function SettingsSheet({ 
  open, 
  onOpenChange,
  onConnectOpenAI,
  onConnectAnthropic,
  onDeleteOpenAI,
  onDeleteAnthropic,
  hasOpenAIKey,
  hasAnthropicKey,
  hasGeminiKey,
  onConnectGemini,
  onDeleteGemini,
  onModelDownloaded
}: SettingsSheetProps) {
  // Model URL input state
  const [modelUrl, setModelUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  
  // Fade-in animation for overlay
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // Slide-up animation for the sheet
  const slideAnim = useRef(new Animated.Value(300)).current;
  
  // Load local models on open
  useEffect(() => {
    if (open) {
      loadLocalModels();
    }
  }, [open]);
  
  // Load local models
  const loadLocalModels = async () => {
    const models = await getLocalModels();
    setLocalModels(models);
  };
  
  // Handle model download
  const handleModelDownload = async () => {
    setErrorMessage('');
    
    // Validate URL
    const validation = validateModelUrl(modelUrl);
    if (!validation.valid) {
      setErrorMessage(validation.reason || 'Invalid URL');
      return;
    }
    
    try {
      setIsDownloading(true);
      const model = await downloadModel(modelUrl, setDownloadProgress);
      setModelUrl('');
      await loadLocalModels();
      // Notify parent about successful download
      onModelDownloaded?.(model.name);
    } catch (error: any) {
      setErrorMessage(error.message || 'Download failed');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };
  
  // Handle model deletion
  const handleDeleteModel = async (id: string) => {
    await removeLocalModel(id);
    setLocalModels(localModels.filter(model => model.id !== id));
  };
  
  useEffect(() => {
    if (open) {
      // Animate the fade and slide when opening
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      // Reset animations when closed
      fadeAnim.setValue(0);
      slideAnim.setValue(300);
    }
  }, [open, fadeAnim, slideAnim]);
  
  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={open}
      onRequestClose={() => onOpenChange(false)}
    >
      <Animated.View 
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.4)',
          opacity: fadeAnim,
        }}
      >
        <TouchableWithoutFeedback onPress={() => onOpenChange(false)}>
          <View style={{ flex: 1 }} />
        </TouchableWithoutFeedback>
        
        <Animated.View
          style={{
            height: '82%',
            transform: [{ translateY: slideAnim }],
          }}
        >
          <YStack
            backgroundColor="$background"
            borderTopLeftRadius={15}
            borderTopRightRadius={15}
            padding={16}
            height="100%"
          >
            {/* Handle indicator */}
            <XStack justifyContent="center" marginBottom={20}>
              <View style={{
                width: 40,
                height: 5,
                backgroundColor: '#ccc',
                borderRadius: 3,
              }} />
            </XStack>
            
            <Text fontSize={18} fontWeight="600" textAlign="center" marginBottom={16}>
              Developer Settings
            </Text>

            <Text fontSize={14} fontWeight="300" textAlign="center" marginBottom={16}>
              In addition to using local models privately, you can add API keys for other model providers.{'\n\n'}This is helpful for throughput and latency benchmarking.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>

              {/* Local Models Section */}
              <Text fontSize={16} fontWeight="500" marginTop={16} marginBottom={8}>
                Local Models
              </Text>
              
              {/* Model URL input or download progress */}
              {isDownloading ? (
                <YStack marginBottom={12}>
                  <Progress value={downloadProgress} max={100} width="100%" height={8}>
                    <Progress.Indicator animation="bouncy" backgroundColor="$green10" />
                  </Progress>
                  <Text fontSize={12} marginTop={4} textAlign="center">
                    Downloading model... {Math.round(downloadProgress)}%
                  </Text>
                </YStack>
              ) : (
                <XStack alignItems="center" marginBottom={8}>
                  <Input 
                    flex={1}
                    size="$4"
                    placeholder="Paste HuggingFace GGUF URL" 
                    value={modelUrl}
                    onChangeText={text => {
                      setModelUrl(text);
                      setErrorMessage('');
                    }}
                  />
                  <Button
                    marginLeft={8}
                    size="$4"
                    icon={Download}
                    onPress={handleModelDownload}
                    disabled={!modelUrl.trim()}
                  >
                    Add
                  </Button>
                </XStack>
              )}
              
              {/* Error message */}
              {errorMessage ? (
                <Text color="$red10" fontSize={12} marginBottom={8}>
                  {errorMessage}
                </Text>
              ) : null}
              
              {/* List of local models */}
              {localModels.map(model => (
                <XStack key={model?.id} alignItems="center" marginBottom={8}>
                  <Button
                    flex={1}
                    size="$4"
                    icon={Check}
                    disabled
                    opacity={0.6}
                  >
                    {truncateModelName(model?.name || '')}
                  </Button>
                  <Button
                    marginLeft={8}
                    size="$4"
                    theme="red"
                    icon={Trash}
                    onPress={() => handleDeleteModel(model.id)}
                  />
                </XStack>
              ))}
              

              <Text fontSize={16} fontWeight="500" marginTop={16} marginBottom={8}>
                API Providers
              </Text>
              
              <XStack alignItems="center" marginBottom={8}>
                <Button 
                  flex={1}
                  size="$4" 
                  marginTop={8}
                  marginBottom={0}
                  disabled={hasOpenAIKey}
                  opacity={hasOpenAIKey ? 0.6 : 1}
                  onPress={() => {
                    onConnectOpenAI();
                  }}
                  icon={hasOpenAIKey ? Check : undefined}
                >
                  {hasOpenAIKey ? 'Connected to OpenAI' : 'Connect OpenAI'}
                </Button>
                
                {hasOpenAIKey && onDeleteOpenAI && (
                  <Button
                    marginLeft={8}
                    marginTop={8}
                    marginBottom={0}
                    size="$4"
                    theme="red"
                    icon={Trash}
                    onPress={onDeleteOpenAI}
                  />
                )}
              </XStack>
              
              <XStack alignItems="center" marginBottom={8}>
                <Button 
                  flex={1}
                  size="$4" 
                  marginTop={8}
                  disabled={hasAnthropicKey}
                  opacity={hasAnthropicKey ? 0.6 : 1}
                  onPress={() => {
                    onConnectAnthropic();
                  }}
                  icon={hasAnthropicKey ? Check : undefined}
                >
                  {hasAnthropicKey ? 'Connected to Anthropic' : 'Connect Anthropic'}
                </Button>
                
                {hasAnthropicKey && onDeleteAnthropic && (
                  <Button
                    marginLeft={8}
                    marginTop={8}
                    size="$4"
                    theme="red"
                    icon={Trash}
                    onPress={onDeleteAnthropic}
                  />
                )}
              </XStack>

              <XStack alignItems="center" marginBottom={8}>
                <Button 
                  flex={1}
                  size="$4" 
                  marginTop={8}
                  disabled={hasGeminiKey}
                  opacity={hasGeminiKey ? 0.6 : 1}
                  onPress={() => {
                    onConnectGemini();
                  }}
                  icon={hasGeminiKey ? Check : undefined}
                >
                  {hasGeminiKey ? 'Connected to Gemini' : 'Connect Gemini'}
                </Button>
                
                {hasGeminiKey && onDeleteGemini && (
                  <Button
                    marginLeft={8}
                    marginTop={8}
                    size="$4"
                    theme="red"
                    icon={Trash}
                    onPress={onDeleteGemini}
                  />
                )}
              </XStack>
              
            </ScrollView>
          </YStack>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
} 