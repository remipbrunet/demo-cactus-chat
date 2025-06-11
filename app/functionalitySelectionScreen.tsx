import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Text, YStack, Button, View } from 'tamagui';
import { MessagesSquare, Mic, Image } from '@tamagui/lucide-icons'
import type { IconProps } from "@tamagui/helpers-icon";
import { CactusFunctionalityOption } from '@/components/ui/onboarding/CactusFunctionalityOption';
import OnboardingScreenLayout from '@/components/ui/onboarding/OnboardingScreenLayout';
import { ActivityIndicator } from 'react-native';
import { supabase } from '@/services/supabase';
import { RegularText } from '@/components/ui/RegularText';
import { PageHeader } from '@/components/ui/PageHeader';

export interface CactusFunctionalitySelection {
    id: string;
    folderName: string, // legacy support for naming the model folder 'local-models'
    urls: string[];
    modelName: string;
    title: string;
    description: string;
    required: boolean;
    selected: boolean;
    icon: (props: IconProps) => JSX.Element;
    downloadSize: number;
}

const defaultFunctionalitySelections: CactusFunctionalitySelection[] = [
    {
        id: "chat",
        folderName: 'local-models',
        urls: [
            "https://huggingface.co/mradermacher/tinyllama-15M-GGUF/resolve/main/tinyllama-15M.IQ4_XS.gguf", 
            "https://huggingface.co/mradermacher/tinyllama-15M-GGUF/resolve/main/tinyllama-15M.Q2_K.gguf"
        ],
        modelName: "tinyllama-15M",
        title: "Cactus Chat",
        description: "Chat with Cactus using text",
        required: true,
        selected: true,
        icon: MessagesSquare,
        downloadSize: 1.2,
    },
    // {
    //     id: "voice",
    //     folderName: "voice",
    //     urls: ["https://cactus.com/cactus-voice"],
    //     title: "Cactus Voice",
    //     description: "Speak to Cactus",
    //     required: false,
    //     selected: true,
    //     icon: Mic,
    //     downloadSize: 1.2,
    // },
    // {
    //     id: "media",
    //     folderName: "media",
    //     urls: ["https://cactus.com/cactus-media"],
    //     title: "Cactus Media",
    //     description: "Analyse images or live video",
    //     required: false,
    //     selected: true,
    //     icon: Image,
    //     downloadSize: 1.2,
    // }
]

export default function FunctionalitySelectionScreen() {
    const [functionalitySelections, setFunctionalitySelections] = useState<CactusFunctionalitySelection[]>(defaultFunctionalitySelections);
    const [remoteChoicesFetched, setRemoteChoicesFetched] = useState<boolean>(false)

    const onContinue = () => {
        console.log(`Downloading ${functionalitySelections.filter(s => s.selected).map(s => s.id).join(', ')}...`);
        router.push({
            pathname: '/functionalityDownloadScreen',
            params: {
                functionalitySelectionsString: JSON.stringify(functionalitySelections.filter(s => s.selected))
            }
        });
    }

    useEffect(() => {
        const fetchRemoteModelChoices = async () => {
            const {data, error} = await supabase.from('functionality_downloads').select('*')
            if (!error && data) {
                const modelChoices = data
                    .filter(record => record.is_default)
                    .map(record => ({
                        type: record.type, 
                        urls: record.download_urls,
                        name: record.name
                    }));

                const promisesToUpdateSelections = functionalitySelections.map(async (existingFunctionalitySelection) => {
                    const matchingChoice = modelChoices.find(choice => choice.type === existingFunctionalitySelection.id);
                    if (matchingChoice) {
                        const fileSizePromises = matchingChoice.urls.map(async (url: string) => {
                            try {
                                const response = await fetch(url, { method: 'HEAD' });
                                if (response.ok) { 
                                    const contentLength = response.headers.get('content-length');
                                    return parseInt(contentLength || '0', 10);
                                } else {
                                    console.error(`Unable to fetch file size for ${url}. Status: ${response.status}`);
                                    return 0; 
                                }
                            } catch (error) {
                                console.error(`Error fetching file size for ${url}:`, error);
                                return 0; 
                            }
                        });
                        const fileSizes = await Promise.all(fileSizePromises);
                        const totalDownloadSize = fileSizes.reduce((sum, size) => sum + size, 0);
                        return {
                            ...existingFunctionalitySelection,
                            modelName: matchingChoice.name,
                            urls: matchingChoice.urls,
                            downloadSize: totalDownloadSize / 1024 / 1024 / 1024,
                        };
                    } else {
                        return existingFunctionalitySelection;
                    }
                })

                const finalUpdatedSelections = await Promise.all(promisesToUpdateSelections);

                setFunctionalitySelections(finalUpdatedSelections)
                setRemoteChoicesFetched(true)
            }
        }
        fetchRemoteModelChoices()
    }, [])

    return (
        <OnboardingScreenLayout>
            <PageHeader
                title="Select functionality"
                subtitle="Choose how you want to interact with Cactus."
            />
            <YStack flex={1} alignItems='center' paddingTop="$4" gap="$2">
                {functionalitySelections.map((selection) => (
                    <CactusFunctionalityOption
                        key={selection.id}
                        icon={selection.icon} 
                        title={selection.title} 
                        description={selection.description} 
                        selected={selection.selected} 
                        onPress={() => {setFunctionalitySelections(functionalitySelections.map(s => s.id === selection.id ? {...s, selected: !s.selected} : s))}} 
                        required={selection.required} 
                    />
                ))}
                <View marginTop="$4">
                    <RegularText>The Cactus framework also suports image, video, and audio! {'\n\n'} This functionality will be added to the app soon.</RegularText>
                </View>
            </YStack>
            <Button width="100%" backgroundColor="#000" onPress={onContinue} disabled={!remoteChoicesFetched}>
                { remoteChoicesFetched 
                 ? <Text color="#FFF" fontSize="$4" fontWeight="400">Continue</Text>
                 : <ActivityIndicator/>
                }
            </Button>
            {remoteChoicesFetched && <RegularText>Download size: {functionalitySelections.filter(s => s.selected).reduce((acc, s) => acc + s.downloadSize, 0).toFixed(2)}GB</RegularText>}
        </OnboardingScreenLayout>
    );
}