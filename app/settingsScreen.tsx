import { ScrollView, Slider, Text, XStack, YStack, ToggleGroup, Switch, Button, Input } from 'tamagui';
import { Zap, Cpu, Brain, HardDrive, Download } from '@tamagui/lucide-icons';

import OnboardingScreenLayout from '@/components/ui/onboarding/OnboardingScreenLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { useModelContext } from '@/contexts/modelContext'
import { RegularText } from '@/components/ui/RegularText';
import { extractModelNameFromUrl } from '@/utils/modelUtils'
import { ModelListItem } from '@/components/ui/settings/ModelListItem'

interface TextWithIconProps {
    Icon: React.ElementType,
    text: string
}

function TextWithIcon({
    Icon,
    text,
}: TextWithIconProps) {
    return (
        <XStack width="100%" alignItems='center' gap="$2">
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
    } = useModelContext();

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
                        <RegularText>Reasoning yields slower, more thoughtful responses.</RegularText>
                    </YStack>
                    <YStack gap="$2">
                        <TextWithIcon Icon={HardDrive} text="Local models"/>
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
                                    onDeleteClick={() => {}}
                                    isSelected={selectedModel?.value === model.value}
                                />
                            ))}
                            {modelsAvailableToDownload.filter(model => !availableModels.some(localModel => localModel.value === extractModelNameFromUrl(model.downloadUrl))).map((model) => (
                                <ModelListItem
                                    key={model.downloadUrl}
                                    modelName={`${model.name}`}
                                    modelComment={model.comment}
                                    downloaded={false}
                                    downloadInProgress={false}
                                    onDownloadClick={() => {}}
                                    onDeleteClick={() => {}}
                                />
                            ))} 
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
                                    backgroundColor={"transparent"}
                                    borderWidth={0}
                                    
                                    // value={modelUrl}
                                    // opacity={downloadInProgress ? 0.6 : 1}
                                    // disabled={downloadInProgress}
                                    // onChangeText={text => {
                                    //     setModelUrl(text);
                                    //     setErrorMessage('');
                                    // }}
                                />
                                <Button
                                    size="$2"
                                    circular
                                    chromeless
                                    icon={<Download size="$1"/>}
                                    marginHorizontal="$2.5"
                                    // onPress={() => handleModelDownload()}
                                    // disabled={!modelUrl.trim() || downloadInProgress}
                                    // opacity={downloadInProgress ? 0.6 : 1}
                                />
                        </XStack>
                        </YStack>
                    </YStack>
                </YStack>
            </ScrollView>
        </OnboardingScreenLayout>
    );
}