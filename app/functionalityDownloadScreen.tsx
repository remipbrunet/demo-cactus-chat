import OnboardingScreenLayout from '@/components/ui/onboarding/OnboardingScreenLayout';
import { Text, YStack, Progress, Button } from 'tamagui';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { CactusFunctionalitySelection } from './functionalitySelectionScreen';
import * as FileSystem from 'expo-file-system';
import { Check } from '@tamagui/lucide-icons';
import { PageHeader } from '@/components/ui/PageHeader';

export default function FunctionalityDownloadScreen() {
    const { functionalitySelectionsString } = useLocalSearchParams()
    const functionalitySelections = JSON.parse(functionalitySelectionsString as string) as CactusFunctionalitySelection[]

    const [downloads, setDownloads] = useState<{[key: string]: number}>({});
    const downloadCountRef = useRef(0);
    const [overallProgress, setOverallProgress] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    
    const allDownloads = functionalitySelections.flatMap(selection => selection.urls.map(url => ({
        url,
        folderName: selection.folderName, // this is basically type: chat | media | voice
        filename: url.split('/').pop() || 'file'
        }))
    );
    
    const totalDownloads = allDownloads.length;

    useEffect(() => {
        console.log(FileSystem.documentDirectory)
        const downloadTasks: FileSystem.DownloadResumable[] = [];
        
        allDownloads.forEach(async ({ url, filename, folderName }) => {
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
            task.downloadAsync().then(() => {
                downloadCountRef.current += 1;
                console.log(`Downloaded ${url} | ${downloadCountRef.current} / ${totalDownloads}`);
                if (downloadCountRef.current === totalDownloads) {
                    setIsComplete(true);
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
            <PageHeader
                title={isComplete ? 'Download complete' : 'Downloading models...'}
                subtitle={`Cactus stores and runs all your AI models locally.\n\nThis means your data never leaves your device, ensuring complete privacy.`}
            />
            <YStack flex={1} alignItems='center' justifyContent='center' marginBottom="$8" gap="$2">
                {isComplete && <Check size="$12" color="black" />}
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