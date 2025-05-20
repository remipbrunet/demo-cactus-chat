import { useState } from 'react';
import { router } from 'expo-router';
import { Text, YStack, Button } from 'tamagui';
import { MessagesSquare, Mic, Image } from '@tamagui/lucide-icons'
import type { IconProps } from "@tamagui/helpers-icon";
import { CactusFunctionalityOption } from '@/components/ui/onboarding/CactusFunctionalityOption';
import OnboardingScreenLayout from '@/components/ui/onboarding/OnboardingScreenLayout';

export interface CactusFunctionalitySelection {
    id: string;
    urls: string[];
    title: string;
    description: string;
    required: boolean;
    selected: boolean;
    icon: (props: IconProps) => JSX.Element
    downloadSize: number;
}

const defaultFunctionalitySelections: CactusFunctionalitySelection[] = [
    {
        id: "chat",
        urls: [
            "https://huggingface.co/mradermacher/tinyllama-15M-GGUF/resolve/main/tinyllama-15M.IQ4_XS.gguf", 
            "https://huggingface.co/mradermacher/tinyllama-15M-GGUF/resolve/main/tinyllama-15M.Q2_K.gguf"
        ],
        title: "Cactus Chat",
        description: "Chat with Cactus using text",
        required: true,
        selected: true,
        icon: MessagesSquare,
        downloadSize: 1.2,
    },
    {
        id: "voice",
        urls: ["https://cactus.com/cactus-voice"],
        title: "Cactus Voice",
        description: "Speak to Cactus",
        required: false,
        selected: true,
        icon: Mic,
        downloadSize: 1.2,
    },
    {
        id: "media",
        urls: ["https://cactus.com/cactus-media"],
        title: "Cactus Media",
        description: "Analyse images or live video",
        required: false,
        selected: true,
        icon: Image,
        downloadSize: 1.2,
    }
]

export default function FunctionalitySelectionScreen() {
    const [functionalitySelections, setFunctionalitySelections] = useState<CactusFunctionalitySelection[]>(defaultFunctionalitySelections);

    const onContinue = () => {
        console.log(`Downloading ${functionalitySelections.filter(s => s.selected).map(s => s.id).join(', ')}...`);
        router.push({
            pathname: '/functionalityDownloadScreen',
            params: {
                functionalitySelectionsString: JSON.stringify(functionalitySelections.filter(s => s.selected))
            }
        });
    }

    return (
        <OnboardingScreenLayout>
            <YStack alignItems='center' gap="$2">
                <Text fontSize="$5" fontWeight="600">Select functionality</Text>
                <Text fontSize="$3" fontWeight="300" textAlign='center'>Choose how you want to interact with Cactus.</Text>
            </YStack>
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
            </YStack>
            <Button width="100%" backgroundColor="#000" onPress={onContinue}>
                <Text color="#FFF" fontSize="$4" fontWeight="400">Continue</Text>
            </Button>
            <Text fontSize="$3" fontWeight="300">Download size: {functionalitySelections.filter(s => s.selected).reduce((acc, s) => acc + s.downloadSize, 0).toFixed(1)}GB</Text>
        </OnboardingScreenLayout>
    );
}