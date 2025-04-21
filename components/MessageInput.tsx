import { Spinner, YStack, Button, Input, XStack } from "tamagui"
import { Send, PauseCircle, Mic } from "@tamagui/lucide-icons";
import { Model } from "@/services/models";
import { useState, memo, useCallback } from "react";

// --- Define Props for the Extracted Button Component ---
interface MessageInputButtonProps {
    inputText: string;
    isStreaming: boolean;
    modelIsLoading: boolean;
    isDisabled: boolean; 
    onSendPress: () => void; 
    onPausePress: () => void; 
    setVoiceMode: (voiceMode: boolean) => void;
}

const MessageInputButton = memo(({
    inputText,
    isStreaming,
    modelIsLoading,
    isDisabled,
    onSendPress,
    onPausePress,
    setVoiceMode
}: MessageInputButtonProps) => {
    // Log only when props actually change causing a re-render
    console.log('Rendering MessageInputButton', isStreaming, modelIsLoading, isDisabled, onSendPress, onPausePress);

    // Conditional rendering based on props
    if (isStreaming) {
        return <Button icon={<PauseCircle size="$1.5"/>} onPress={onPausePress} aria-label="Pause Streaming"/>;
    }

    if (modelIsLoading) {
        // Wrap Spinner in YStack for consistent layout within the parent's YStack
        return <Spinner size="small" />
    }

    if (inputText.trim() === '') {
        return (
            <Button 
            icon={<Mic size="$1.5"/>} 
            onPress={() => setVoiceMode(true)}
        />
        );
    }

    // Default Send button
    return (
        <XStack alignItems="center" justifyContent="center" gap="$0">
            <Button
                icon={<Send size="$1.5"/>}
                onPress={onSendPress}
                disabled={isDisabled}
                opacity={isDisabled ? 0.25 : 1} // Use the passed disabled prop
                aria-label="Send Message"
            />
        </XStack>
    );
});

interface MessageInputProps {
    sendMessage: (input: string) => void;
    isStreaming: boolean;
    modelIsLoading: boolean;
    selectedModel: Model | null;
    setVoiceMode: (voiceMode: boolean) => void;
}

function MessageInputComponent({ sendMessage, isStreaming, modelIsLoading, selectedModel, setVoiceMode }: MessageInputProps) {
    const [ inputText, setInputText ] = useState<string>('')

    const onSubmit = useCallback(() => {
        sendMessage(inputText)
        setInputText('')
    }, [sendMessage, inputText])

    const handlePause = useCallback(() => {
        console.log('pause!')
    }, [])

    return (
        <XStack paddingVertical={16}>
            <Input 
                flex={1} 
                marginRight={8}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Message..."
                onSubmitEditing={onSubmit}
            />
            <YStack alignItems="center" justifyContent="center" minWidth="$6">
                <MessageInputButton 
                    inputText={inputText}
                    isStreaming={isStreaming}
                    modelIsLoading={modelIsLoading}
                    isDisabled={!selectedModel || inputText.trim() === ''}
                    onSendPress={onSubmit}
                    onPausePress={handlePause}
                    setVoiceMode={setVoiceMode}
                />
            </YStack>
        </XStack>
    )
}

export const MessageInput = MessageInputComponent