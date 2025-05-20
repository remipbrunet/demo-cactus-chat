import { SafeAreaView } from 'react-native';
import { Text, YStack, Button } from 'tamagui';
import { MessagesSquare, Mic, Image } from '@tamagui/lucide-icons'
import type { IconProps } from "@tamagui/helpers-icon";
import { useState } from 'react';
import { CactusFunctionalityOption } from '../components/ui/CactusFunctionalityOption';

interface CactusFunctionalitySelection {
    id: string;
    url: string;
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
        url: "https://cactus.com/cactus-chat",
        title: "Cactus Chat",
        description: "Chat with Cactus using text",
        required: true,
        selected: true,
        icon: MessagesSquare,
        downloadSize: 1.2,
    },
    {
        id: "voice",
        url: "https://cactus.com/cactus-voice",
        title: "Cactus Voice",
        description: "Speak to Cactus in voice mode",
        required: false,
        selected: true,
        icon: Mic,
        downloadSize: 1.2,
    },
    {
        id: "media",
        url: "https://cactus.com/cactus-media",
        title: "Cactus Media",
        description: "Upload images or analyse live video",
        required: false,
        selected: true,
        icon: Image,
        downloadSize: 1.2,
    }
]

export default function FunctionalitySelectionScreen() {
    const [functionalitySelections, setFunctionalitySelections] = useState<CactusFunctionalitySelection[]>(defaultFunctionalitySelections);

    const onContinue = () => {
        //
    }

    return (
    <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} padding="$4" gap="$2" alignItems="center">
            <YStack alignItems='center' gap="$2">
                <Text fontSize="$5" fontWeight="600">Choose functionality</Text>
                <Text fontSize="$3" fontWeight="300">Select how you want to interact with Cactus</Text>
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
        </YStack>
    </SafeAreaView>
    );
}