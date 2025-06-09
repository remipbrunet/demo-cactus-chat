import { YStack, Button, Text, XStack, Slider, Tabs, Input, Progress, Switch } from 'tamagui'
import { Modal, View, TouchableWithoutFeedback, Animated, ScrollView, Alert } from 'react-native'
import { useEffect, useRef, useState } from 'react'
import { Check, Download, Trash } from '@tamagui/lucide-icons'
import { deleteApiKey, removeLocalModel } from '@/services/storage'
import { downloadModel, validateModelUrl } from '@/utils/modelUtils'
import { useModelContext } from '@/contexts/modelContext'
import { ApiKeyDialog } from './ui/settings/ApiKeyDialog'
import { Provider } from '@/services/models'
import { extractModelNameFromUrl } from '@/utils/modelUtils'
import { ModelListItem } from './ui/settings/ModelListItem'
import { RegularText } from './ui/RegularText'
import { PreferenceTile } from './ui/settings/PreferenceTile'

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
  const { availableModels, refreshModels, hasOpenAIKey, hasAnthropicKey, hasGeminiKey, tokenGenerationLimit, setTokenGenerationLimit, selectedModel, setSelectedModel, modelsAvailableToDownload } = useModelContext();
  const [modelUrl, setModelUrl] = useState('');
  const [downloadInProgress, setDownloadInProgress] = useState(false);
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
    const { valid, reason, contentLength } = await validateModelUrl(urlToDownload);
    if (!valid) {
      setErrorMessage(reason || 'Invalid URL');
      return;
    }

    Alert.alert(
      `Download ${extractModelNameFromUrl(urlToDownload)}`, 
      `This will download ${contentLength ? (contentLength / 10e8).toFixed(2) + 'GB' : 'unknown size'} of data. We recommend doing this over WiFi.`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Download",
          style: "default",
          onPress: async () => {
            try {
              setDownloadInProgress(true);
              await downloadModel(urlToDownload, setDownloadProgress);
              setModelUrl('');
              refreshModels();
            } catch (error: any) {
              setErrorMessage(error.message || 'Download failed');
            } finally {
              setDownloadInProgress(false);
              setDownloadProgress(0);
            }
          }
        }
      ]
    );
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

  const handleDeleteModel = (modelValue: string) => {
    Alert.alert(
      `Delete ${modelValue}`, 
      `Are you sure you want to delete this model? This cannot be undone. You will need to download the model again to use it.`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (modelValue === selectedModel?.value) {setSelectedModel(null);}
            await removeLocalModel(modelValue).then(() => refreshModels());
          }
        }
      ]
    );
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
              Settings
            </Text>

            <Tabs 
              orientation="horizontal" 
              flexDirection="column" 
              defaultValue="general"
            >
              <Tabs.List
                disablePassBorderRadius="bottom"
                aria-label="Manage your account"
              >
                <Tabs.Tab value="general" flex={1}>
                  <Text fontSize={16} fontWeight="500" marginTop={8} marginBottom={8}>
                    General
                  </Text>
                </Tabs.Tab>
                <Tabs.Tab value="local" flex={1}>
                  <Text fontSize={16} fontWeight="500" marginTop={8} marginBottom={8}>
                    Models
                  </Text>
                </Tabs.Tab>
                <Tabs.Tab value="api" flex={1}>
                  <Text fontSize={16} fontWeight="500" marginTop={8} marginBottom={8}>
                    API Keys
                  </Text>
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Content value="general" paddingTop={16}>

                <PreferenceTile>
                  <RegularText textAlign='left'>Token generation limit: {tokenGenerationLimit}</RegularText>
                  <Slider size="$1" flex={1} defaultValue={[tokenGenerationLimit]} max={2500} min={100} step={25} onValueChange={(value: number[]) => setTokenGenerationLimit(value[0])}>
                    <Slider.Track>
                    <Slider.TrackActive />
                    </Slider.Track>
                    <Slider.Thumb circular index={0}/>
                  </Slider>
                </PreferenceTile>

                <PreferenceTile>
                  <XStack flex={1}>
                    <RegularText textAlign='left'>Inference hardware: </RegularText>
                  </XStack>
                  <Switch size="$4" defaultChecked={false}>
                    <Switch.Thumb/>
                  </Switch>
                </PreferenceTile>

              </Tabs.Content>
            
              <Tabs.Content value="local" paddingTop={16}>
                <ScrollView showsVerticalScrollIndicator={false}>

                  <XStack alignItems="center" marginBottom="$3">
                    <Input 
                      flex={1}
                      size="$4"
                      placeholder="Custom HuggingFace GGUF URL" 
                      value={modelUrl}
                      opacity={downloadInProgress ? 0.6 : 1}
                      disabled={downloadInProgress}
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
                      disabled={!modelUrl.trim() || downloadInProgress}
                      opacity={downloadInProgress ? 0.6 : 1}
                    />
                  </XStack>

                  {/* recommended models section */}
                  {modelsAvailableToDownload.filter(model => !availableModels.some(localModel => localModel.value === extractModelNameFromUrl(model.downloadUrl))).map((model) => (
                    <ModelListItem
                      key={model.downloadUrl}
                      modelName={`${model.name}`}
                      modelComment={model.comment}
                      downloaded={false}
                      downloadInProgress={downloadInProgress}
                      onDownloadClick={() => handleModelDownload(model.downloadUrl)}
                      onDeleteClick={() => handleDeleteModel(extractModelNameFromUrl(model.downloadUrl) || '')}
                    />
                  ))} 
                  
                  {/* List of local models */}
                  {availableModels.filter(model => model.isLocal).map(model => (
                    <ModelListItem
                      key={model.value}
                      modelName={model.value}
                      modelComment={modelsAvailableToDownload.find(m => extractModelNameFromUrl(m.downloadUrl) === model.value)?.comment}
                      downloaded={true}
                      downloadInProgress={downloadInProgress}
                      onDownloadClick={() => handleModelDownload()}
                      onDeleteClick={() => handleDeleteModel(model.value)}
                    />
                  ))}

                </ScrollView>

              </Tabs.Content>
              <Tabs.Content value="api" paddingTop={16}>

              <Text fontSize={14} fontWeight="300" textAlign="center" marginBottom={16}>
                Add keys for API providers to benchmark throughput and latency.
              </Text>

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

            <View style={{ flex: 1 }} />

            {downloadInProgress && (
              <YStack gap="$2" paddingBottom='$8'>
                  <Text fontSize={12} textAlign="center">
                      Downloading model... {Math.round(downloadProgress)}%
                  </Text>
                  <Progress value={downloadProgress} max={100} width="100%" height={8}>
                      <Progress.Indicator animation="bouncy" backgroundColor="$green10" />
                  </Progress>
              </YStack>
            )}

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