import { YStack, Button, Text, XStack, Input, Progress, Slider, Tabs } from 'tamagui'
import { Modal, View, TouchableWithoutFeedback, Animated, ScrollView, Alert } from 'react-native'
import { useEffect, useRef, useState } from 'react'
import { Check, Trash, Download } from '@tamagui/lucide-icons'
import { deleteApiKey, removeLocalModel } from '@/services/storage'
import { downloadModel, validateModelUrl } from '@/utils/modelUtils'
import { useModelContext } from '@/contexts/modelContext'
import { ApiKeyDialog } from './ApiKeyDialog'
import { Provider } from '@/services/models'
import { extractModelNameFromUrl } from '@/utils/modelUtils'

// Recommended model for first-time users
const RECOMMENDED_MODELS = [
  {
    url: "https://huggingface.co/unsloth/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q8_0.gguf"
  },
  {
    url: "https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q8_0.gguf"
  }
];

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ExtendedProviderType {
  name: Provider
  hasKey: boolean
}

export function SettingsSheet({ 
  open, 
  onOpenChange,
}: SettingsSheetProps) {
  // Model URL input state
  const { availableModels, refreshModels, hasOpenAIKey, hasAnthropicKey, hasGeminiKey, tokenGenerationLimit, setTokenGenerationLimit } = useModelContext();
  const [modelUrl, setModelUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [apiKeyDialogProvider, setApiKeyDialogProvider] = useState<Provider | null>(null);
  // Fade-in animation for overlay
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // Slide-up animation for the sheet
  const slideAnim = useRef(new Animated.Value(300)).current;

  const providers: ExtendedProviderType[] = [
    {
      name: 'OpenAI',
      hasKey: hasOpenAIKey
    },
    {
      name: 'Anthropic',
      hasKey: hasAnthropicKey
    },
    {
      name: 'Google',
      hasKey: hasGeminiKey
    }
  ]
  const handleModelDownload = async (urlOverride?: string) => {
    setErrorMessage('');

    const urlToDownload = urlOverride || modelUrl;
    
    // Validate URL
    const validation = validateModelUrl(urlToDownload);
    if (!validation.valid) {
      setErrorMessage(validation.reason || 'Invalid URL');
      return;
    }
    
    try {
      setIsDownloading(true);
      await downloadModel(urlToDownload, setDownloadProgress);
      setModelUrl('');
      refreshModels();
      // Notify parent about successful download
      // Alert.alert('Success', `Model ${model.label} downloaded successfully`);
    } catch (error: any) {
      setErrorMessage(error.message || 'Download failed');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleDeleteApiKey = (provider: Provider) => {
    Alert.alert(
      `Delete ${provider} Key`, 
      `Are you sure you want to remove your ${provider} API key?`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteApiKey(provider).then(() => refreshModels());
          }
        }
      ]
    );
  };
  
  // Handle model deletion
  const handleDeleteModel = async (id: string) => {
    removeLocalModel(id).then(() => refreshModels());
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
      animationType="fade"
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
              Download and use local models privately or add keys for API providers.{'\n\n'}This is helpful for throughput and latency benchmarking.
            </Text>

            <Tabs 
              orientation="horizontal" 
              flexDirection="column" 
              defaultValue="local"
            >
              <Tabs.List
                disablePassBorderRadius="bottom"
                aria-label="Manage your account"
              >
                <Tabs.Tab value="local" flex={1}>
                  <Text fontSize={16} fontWeight="500" marginTop={8} marginBottom={8}>
                    Local Models
                  </Text>
                </Tabs.Tab>
                <Tabs.Tab value="api" flex={1}>
                  <Text fontSize={16} fontWeight="500" marginTop={8} marginBottom={8}>
                    API Providers
                  </Text>
                </Tabs.Tab>
              </Tabs.List>
              <Tabs.Content value="local" paddingTop={16}>
                <ScrollView showsVerticalScrollIndicator={false}>

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
                        placeholder="Custom HuggingFace GGUF URL" 
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
                        onPress={() => handleModelDownload()}
                        disabled={!modelUrl.trim()}
                      />
                    </XStack>
                  )}
                  
                  {/* Error message */}
                  {errorMessage ? (
                    <Text color="$red10" fontSize={12} marginBottom={8}>
                      {errorMessage}
                    </Text>
                  ) : null}

                  {/* recommended models section */}
                  {RECOMMENDED_MODELS.filter(model => !availableModels.some(localModel => localModel.value === extractModelNameFromUrl(model.url))).map((model) => (
                    <XStack key={model.url} alignItems="center" marginBottom={8}>
                      <Button
                        flex={1}
                        size="$4"
                        // icon={Check}
                        disabled
                        opacity={0.5}
                      >
                        {extractModelNameFromUrl(model.url)}
                      </Button>
                      <Button
                        marginLeft={8}
                        size="$4"
                        icon={Download}
                        disabled={isDownloading}
                        opacity={isDownloading ? 0.5 : 1}
                        onPress={() => {
                        handleModelDownload(model.url)
                      }}
                      />
                    </XStack>
                  ))} 
                  
                  {/* List of local models */}
                  {availableModels.filter(model => model.isLocal).map(model => (
                    <XStack key={model?.value} alignItems="center" marginBottom={8}>
                      <Button
                        flex={1}
                        size="$4"
                        icon={Check}
                        disabled
                        opacity={0.6}
                      >
                        {/* {truncateModelName(model?.name || '')} */}
                        {model.value}
                      </Button>
                      <Button
                        marginLeft={8}
                        size="$4"
                        theme="red"
                        icon={Trash}
                        onPress={() => handleDeleteModel(model.value)}
                      />
                    </XStack>
                  ))}
                </ScrollView>

              </Tabs.Content>
              <Tabs.Content value="api" paddingTop={16}>

              <ScrollView>

              {(providers).map(provider => (
                <XStack key={provider.name} alignItems="center" marginBottom={8}>
                  <Button 
                  flex={1}
                  size="$4" 
                  marginTop={8}
                  marginBottom={0}
                  disabled={provider.hasKey}
                  opacity={provider.hasKey ? 0.6 : 1}
                  onPress={() => {
                    setApiKeyDialogProvider(provider.name);
                  }}
                  icon={provider.hasKey ? Check : undefined}
                >
                  {provider.hasKey ? `Connected to ${provider.name}` : `Connect ${provider.name}`}
                </Button>
                
                {provider.hasKey && (
                  <Button
                    marginLeft={8}
                    marginTop={8}
                    marginBottom={0}
                    size="$4"
                    theme="red"
                    icon={Trash}
                    onPress={() =>handleDeleteApiKey(provider.name)}
                  />
                )}
              </XStack>
              ))}
              </ScrollView>
              </Tabs.Content>
            </Tabs>

            <YStack marginTop={16} gap="$4">
              <Text fontSize={16} fontWeight="500" marginBottom={8}>
                Token generation limit: {tokenGenerationLimit}
              </Text>
              <Slider size="$1" width='100%' defaultValue={[tokenGenerationLimit]} max={2500} min={100} step={25} onValueChange={(value: number[]) => setTokenGenerationLimit(value[0])}>
                <Slider.Track>
                  <Slider.TrackActive />
                </Slider.Track>
                <Slider.Thumb circular index={0} />
              </Slider>
            </YStack>
            
          </YStack>
        </Animated.View>
      </Animated.View>
      <ApiKeyDialog
        open={apiKeyDialogProvider !== null}
        provider={apiKeyDialogProvider || 'Cactus'} // Cactus is just a placeholder so we don't get type errors in ApiKeyDialog
        onClose={() => setApiKeyDialogProvider(null)}
      />
    </Modal>
  )
} 