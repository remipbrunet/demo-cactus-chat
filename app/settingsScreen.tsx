import { ScrollView, Slider, Text, XStack, YStack, ToggleGroup, Switch, Button, Input, Progress, View, Anchor } from 'tamagui';
import { Zap, Cpu, Brain, HardDrive, Download, AlertTriangle, FileText, Edit3, Check, X } from '@tamagui/lucide-icons';
import { useState } from 'react';
import { Alert } from 'react-native';

import OnboardingScreenLayout from '@/components/ui/onboarding/OnboardingScreenLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { useModelContext } from '@/contexts/modelContext'
import { RegularText } from '@/components/ui/RegularText';
import { downloadModel, extractModelNameFromUrl, validateModelUrl } from '@/utils/modelUtils'
import { ModelListItem } from '@/components/ui/settings/ModelListItem'
import { removeLocalModel } from '@/services/storage';
import { MCPServerSettings } from '@/components/ui/settings/MCPServerSettings';

interface TextWithIconProps {
    Icon: React.ElementType,
    text: string
}

function TextWithIcon({
    Icon,
    text,
}: TextWithIconProps) {
    return (
        <XStack flex={1} alignItems='center' gap="$2">
            <Icon size={16}/>
            <Text fontSize="$4" fontWeight="400" textAlign='left'>{text}</Text>
        </XStack>
    )
}

export default function SettingsScreen() {
    const { 
        tokenGenerationLimit, 
        setTokenGenerationLimit, 
        inferenceHardware, 
        setInferenceHardware, 
        isReasoningEnabled, 
        setIsReasoningEnabled,
        modelsAvailableToDownload,
        availableModels,
        selectedModel,
        refreshModels,
        systemPrompt,
        setSystemPrompt
    } = useModelContext();
    const [ downloadInProgress, setDownloadInProgress ] = useState(false);
    const [ downloadProgress, setDownloadProgress ] = useState(0);
    const [ errorMessage, setErrorMessage ] = useState('');
    const [ modelUrl, setModelUrl ] = useState('');
    const [ tempSystemPrompt, setTempSystemPrompt ] = useState('');
    const [ isEditingPrompt, setIsEditingPrompt ] = useState(false);

    const handleModelDownload = async (urlOverride?: string) => {
        setErrorMessage('');

        const urlToDownload = urlOverride || modelUrl;
        
        console.log('[Download] Attempting to download:', urlToDownload);
        
        // Validate URL
        const { valid, reason, contentLength } = await validateModelUrl(urlToDownload);
        console.log('[Download] Validation result:', { valid, reason, contentLength });
        
        if (!valid) {
            setErrorMessage(reason || 'Invalid URL');
            console.log('[Download] Validation failed:', reason);
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
                // if (modelValue === selectedModel?.value) {setSelectedModel(null);}
                await removeLocalModel(modelValue).then(() => refreshModels());
              }
            }
          ]
        );
      };

    const handleEditPrompt = () => {
        setTempSystemPrompt(systemPrompt);
        setIsEditingPrompt(true);
    };

    const handleSavePrompt = () => {
        setSystemPrompt(tempSystemPrompt);
        setIsEditingPrompt(false);
    };

    const handleCancelPrompt = () => {
        setTempSystemPrompt('');
        setIsEditingPrompt(false);
    };

    return (
        <OnboardingScreenLayout>
            <PageHeader 
                title="Preferences"
                includeBackButton 
            />
            <ScrollView width="95%" showsVerticalScrollIndicator={false}>
                <YStack paddingVertical="$4" paddingHorizontal="$2" gap="$6">
                    <YStack gap="$4">
                        <TextWithIcon Icon={Zap} text="Token generation limit"/>
                        <Slider size="$6" defaultValue={[tokenGenerationLimit]} max={2500} min={100} step={25} onValueChange={(value: number[]) => setTokenGenerationLimit(value[0])}>
                            <Slider.Track backgroundColor="$gray6">
                                <Slider.TrackActive backgroundColor='black'/>
                            </Slider.Track>
                            <Slider.Thumb circular index={0} size="$2" backgroundColor='white' borderColor="black"/>
                        </Slider>
                        <XStack>
                            <RegularText>100</RegularText>
                            <RegularText flex={1}>{tokenGenerationLimit} tokens</RegularText>
                            <RegularText>2500</RegularText>
                        </XStack>
                    </YStack>
                    <YStack gap="$2">
                        <TextWithIcon Icon={Cpu} text="Inference hardware"/>
                        <ToggleGroup marginTop="$1" type="multiple" defaultValue={inferenceHardware} onValueChange={setInferenceHardware}>
                            <ToggleGroup.Item value='cpu' flex={1} disabled={true} borderColor={inferenceHardware.includes('cpu') ? "black" : "transparent"}>
                                <RegularText>CPU</RegularText>
                            </ToggleGroup.Item>
                            <ToggleGroup.Item value='gpu' flex={1} borderColor={inferenceHardware.includes('gpu') ? "black" : "$gray6"}>
                                <RegularText>GPU</RegularText>
                            </ToggleGroup.Item>
                        </ToggleGroup>
                        <RegularText>Select CPU-only for battery-efficient inference.</RegularText>
                    </YStack>
                    <YStack gap="$2">
                        <XStack>
                            <XStack flex={1}>
                                <TextWithIcon Icon={Brain} text="Reasoning mode"/>
                            </XStack>
                            <Switch size="$4" defaultChecked={isReasoningEnabled} backgroundColor={isReasoningEnabled ? "black" :"$gray6"} onCheckedChange={setIsReasoningEnabled} borderColor="transparent">
                                <Switch.Thumb size="$4" backgroundColor='white' borderColor="black" borderWidth="$1"/>
                            </Switch>
                        </XStack>
                        <RegularText>Slower, more thoughtful responses from reasoning-enabled models.</RegularText>
                    </YStack>
                    <YStack gap="$2">
                        <XStack alignItems="center" justifyContent="space-between">
                            <TextWithIcon Icon={FileText} text="System prompt"/>
                            {!isEditingPrompt && (
                                <Button
                                    size="$2"
                                    chromeless
                                    icon={<Edit3 size={16}/>}
                                    onPress={handleEditPrompt}
                                >
                                    <RegularText fontSize="$3">Edit</RegularText>
                                </Button>
                            )}
                        </XStack>
                        <Input
                            placeholder="Enter custom system prompt..."
                            fontSize="$3"
                            padding="$2.5"
                            fontWeight={300}
                            backgroundColor={isEditingPrompt ? "$gray1" : "$gray2"}
                            borderColor={isEditingPrompt ? "black" : "$gray6"}
                            borderWidth={1}
                            borderRadius="$4"
                            multiline
                            lineHeight={16}
                            value={isEditingPrompt ? tempSystemPrompt : systemPrompt}
                            onChangeText={isEditingPrompt ? setTempSystemPrompt : undefined}
                            disabled={!isEditingPrompt}
                            opacity={isEditingPrompt ? 1 : 0.8}
                        />
                        {isEditingPrompt && (
                            <XStack gap="$2">
                                <Button
                                    flex={1}
                                    size="$3"
                                    backgroundColor="black"
                                    borderRadius="$4"
                                    onPress={handleSavePrompt}
                                    icon={<Check size={16} color="white"/>}
                                >
                                    <RegularText color="white">Save Changes</RegularText>
                                </Button>
                                <Button
                                    flex={1}
                                    size="$3"
                                    backgroundColor="$gray1"
                                    borderColor="$gray6"
                                    borderWidth={1}
                                    borderRadius="$4"
                                    onPress={handleCancelPrompt}
                                    icon={<X size={16}/>}
                                >
                                    <RegularText>Cancel</RegularText>
                                </Button>
                            </XStack>
                        )}
                        <RegularText>Define how the AI should behave and respond to your requests.</RegularText>
                    </YStack>
                    
                    {/* MCP Server Settings */}
                    <MCPServerSettings />
                    
                    <YStack gap="$2">
                        <TextWithIcon Icon={HardDrive} text="Local models"/>
                        {downloadInProgress && (
                            <YStack gap="$2" padding="$2">
                                <Text fontSize={12} textAlign="center">
                                    Downloading model... {Math.round(downloadProgress)}%
                                </Text>
                                <Progress value={downloadProgress} max={100} width="100%" height={8}>
                                    <Progress.Indicator animation="bouncy" backgroundColor="$green10" />
                                </Progress>
                            </YStack>
                        )}
                        <YStack gap="$2">
                            {/* List of local models */}
                            {availableModels.filter(model => model.isLocal).map(model => (
                                <ModelListItem
                                    key={model.value}
                                    modelName={model.value}
                                    modelComment={modelsAvailableToDownload.find(m => extractModelNameFromUrl(m.downloadUrl) === model.value)?.comment}
                                    downloaded={true}
                                    downloadInProgress={false}
                                    onDownloadClick={() => {}}
                                    onDeleteClick={() => handleDeleteModel(model.value)}
                                    isSelected={selectedModel?.value === model.value}
                                />
                            ))}
                            {modelsAvailableToDownload.filter(model => !availableModels.some(localModel => localModel.value === extractModelNameFromUrl(model.downloadUrl))).map((model, index) => (
                                <ModelListItem
                                    key={`available-${model.name}-${index}`}
                                    modelName={`${model.name}`}
                                    modelComment={model.comment}
                                    downloaded={false}
                                    downloadInProgress={false}
                                    onDownloadClick={() => handleModelDownload(model.downloadUrl)}
                                    onDeleteClick={() => {}}
                                />
                            ))} 
                            
                            <YStack
                                alignItems="center"
                                gap="$2"
                                borderWidth={1}
                                borderColor="$gray6"
                                borderRadius='$4'
                                paddingVertical="$2.5"
                                paddingHorizontal="$3"
                            >
                                <RegularText fontWeight="bold">Compatibility Note: </RegularText>
                                <RegularText>You can experiment by downloading custom models below. For optimal performance, please use one of the recommended models above. </RegularText>
                                <Anchor fontSize="$3" fontWeight="300" textAlign="center" lineHeight={15} href="https://github.com/cactus-compute/cactus" target="_blank">Want to build your own app powered by local AI? Check out the Cactus repo!</Anchor>
                            </YStack>
                            {errorMessage && <RegularText color="$red10">{errorMessage}</RegularText>}
                            <XStack 
                                alignItems="center"
                                borderColor="$gray6"
                                borderWidth={1}
                                backgroundColor="$gray1"
                                borderRadius="$4"
                            >
                                <Input 
                                    flex={1}
                                    size="$5"
                                    placeholder="Custom HuggingFace GGUF URL" 
                                    fontSize="$3"
                                    padding="$2.5"
                                    fontWeight={300}
                                    lineHeight={16}
                                    backgroundColor={"transparent"}
                                    borderWidth={0}
                                    value={modelUrl}
                                    opacity={downloadInProgress ? 0.6 : 1}
                                    disabled={downloadInProgress}
                                    onChangeText={text => {
                                        setModelUrl(text);
                                        setErrorMessage('');
                                    }}
                                />
                                <Button
                                    size="$2"
                                    circular
                                    chromeless
                                    icon={<Download size="$1"/>}
                                    marginHorizontal="$3"
                                    onPress={() => handleModelDownload()}
                                    disabled={!modelUrl.trim() || downloadInProgress}
                                    opacity={downloadInProgress ? 0.6 : 1}
                                />
                            </XStack>
                            {errorMessage && <RegularText color="$red10" marginTop="$2">{errorMessage}</RegularText>}
                        </YStack>
                    </YStack>
                </YStack>
            </ScrollView>
        </OnboardingScreenLayout>
    );
}