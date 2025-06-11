import OnboardingScreenLayout from '@/components/ui/onboarding/OnboardingScreenLayout';
import { Text, YStack, Progress, Button, View, Anchor } from 'tamagui';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { CactusFunctionalitySelection } from './functionalitySelectionScreen';
import * as FileSystem from 'expo-file-system';
import { Check, ShieldQuestion } from '@tamagui/lucide-icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { Model } from '@/services/models';
import { storeLocalModel } from '@/services/storage';
import { useModelContext } from '@/contexts/modelContext';
import { RegularText } from '@/components/ui/RegularText';

export default function FunctionalityDownloadScreen() {
    const { functionalitySelectionsString } = useLocalSearchParams()
    const functionalitySelections = JSON.parse(functionalitySelectionsString as string) as CactusFunctionalitySelection[]

    const [downloads, setDownloads] = useState<{[key: string]: number}>({});
    const downloadCountRef = useRef(0);
    const [overallProgress, setOverallProgress] = useState(0);
    const [isComplete, setIsComplete] = useState(false);

    const { refreshModels, setSelectedModel } = useModelContext();
    
    const allDownloads = functionalitySelections.flatMap(selection => selection.urls.map(url => ({
        url,
        folderName: selection.folderName, // this is basically type: chat | media | voice
        filename: url.split('/').pop() || 'file',
        modelName: selection.modelName
        }))
    );
    
    const totalDownloads = allDownloads.length;

    useEffect(() => {
        console.log(FileSystem.documentDirectory)
        const downloadTasks: FileSystem.DownloadResumable[] = [];
        
        allDownloads.forEach(async ({ url, filename, folderName, modelName }) => {
            const dirPath = `${FileSystem.documentDirectory}${folderName}`;
            await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true })
            const downloadPath = `${dirPath}/${filename}`;
          
            const task = FileSystem.createDownloadResumable(
                url,
                downloadPath,
                {},
                (progress) => {
                  const progressValue = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
                  setDownloads(prev => {
                    const newDownloads = { ...prev, [url]: progressValue };
                    const total = Object.values(newDownloads).reduce((sum, p) => sum + p, 0) / totalDownloads;
                    setOverallProgress(total * 100);
                    return newDownloads;
                  });
                }
            );

            downloadTasks.push(task);
            task.downloadAsync().then((result) => {
                if (result) {
                    downloadCountRef.current += 1;
                    console.log(`Downloaded ${url} | ${downloadCountRef.current} / ${totalDownloads}`);
                    const model: Model = {
                        value: modelName,
                        label: modelName,
                        provider: 'Cactus',
                        disabled: false,
                        isLocal: true,
                        meta: { fileName: filename }
                    };
                    storeLocalModel(model);
                    if (downloadCountRef.current === totalDownloads) {
                        setIsComplete(true);
                        refreshModels();
                        setSelectedModel(model);
                    }
                }
            }).catch(error => {
                console.error(`Error downloading ${url}:`, error);
            });
        });
        
        return () => { // Cancel downloads if component unmounts
          downloadTasks.forEach(task => {
            task.cancelAsync();
          });
        };
    }, []);

    return (
        <OnboardingScreenLayout>
            <View width="90%">
            <PageHeader
                title={isComplete ? 'Download complete  ✓' : 'Downloading models...'}
                subtitle={`Cactus stores and runs all your AI models locally. This means your data never leaves your device, ensuring complete privacy.`}
            />
            </View>
            <YStack flex={1} alignItems='center' justifyContent='center' marginBottom="$8" gap="$2">
                <View width="90%" alignItems='center' gap="$2">
                    <Text fontSize="$4" fontWeight="600">Did you know?</Text>
                    <RegularText>You can integrate text, image, video, and voice AI features powered by Cactus into your own app.</RegularText>
                    <RegularText>Everything in this demo is fully open source.</RegularText>
                    <Anchor fontSize="$3" fontWeight="300" href="https://github.com/cactus-compute/cactus" target="_blank">Check out the repo</Anchor>
                </View>
            </YStack>
            {isComplete ? (
                <Button onPress={() => router.push('/')} width="100%" backgroundColor="#000">
                    <Text fontSize="$4" fontWeight="400" color="#FFF">Get Started</Text>
                </Button>
            ) : (
                <YStack width="100%">
                    <Progress value={overallProgress} max={100} width="100%">
                        <Progress.Indicator animation="bouncy" backgroundColor="$green10" />
                    </Progress>
                    <Button onPress={() => router.back()}>
                        <Text fontSize="$3" fontWeight="300">Cancel download</Text>
                    </Button>
                </YStack>
            )}
        </OnboardingScreenLayout>
    )
}