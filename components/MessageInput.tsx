import { Spinner, YStack, Button, Input, XStack, TextArea } from "tamagui"
import { Send, Pause, Mic } from "@tamagui/lucide-icons";
import { Model } from "@/services/models";
import { useState, memo, useCallback } from "react";

// --- Define Props for the Extracted Button Component ---
interface MessageInputButtonProps {
    inputText: string;
    isStreaming: boolean;
    modelIsLoading: boolean;
    isSendDisabled: boolean;
    isVoiceDisabled: boolean;
    onSendPress: () => void; 
    onPausePress: () => void; 
    setVoiceMode: (voiceMode: boolean) => void;
}

const MessageInputButton = memo(({
    inputText,
    isStreaming,
    modelIsLoading,
    isSendDisabled,
    isVoiceDisabled,
    onSendPress,
    onPausePress,
    setVoiceMode
}: MessageInputButtonProps) => {
    // Log only when props actually change causing a re-render
    console.log('Rendering MessageInputButton', isStreaming, modelIsLoading, isSendDisabled, isVoiceDisabled, onSendPress, onPausePress);

    // Conditional rendering based on props
    if (isStreaming) {
        return <Button icon={<Pause size="$1.5"/>} onPress={onPausePress} aria-label="Pause Streaming" chromeless/>;
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
                disabled={isVoiceDisabled}
                opacity={isVoiceDisabled ? 0.25 : 1} // Use the passed disabled prop
                chromeless
            />
        );
    }

    // Default Send button
    return (
        <XStack alignItems="center" justifyContent="center" gap="$0">
            <Button
                icon={<Send size="$1.5"/>}
                onPress={onSendPress}
                disabled={isSendDisabled}
                opacity={isSendDisabled ? 0.25 : 1} // Use the passed disabled prop
                aria-label="Send Message"
                chromeless
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
        <XStack 
            paddingVertical={16}
            borderWidth={1}
            borderColor="$gray5"
            borderRadius='$6'
            padding="$2"
            backgroundColor="#FFF"
        >
            <Input 
            // <TextArea
                flex={1} 
                marginRight={8}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Message..."
                onSubmitEditing={onSubmit}
                borderWidth={0}
                backgroundColor="transparent"
            />
            <YStack alignItems="center" justifyContent="center" minWidth="$6">
                <MessageInputButton 
                    inputText={inputText}
                    isStreaming={isStreaming}
                    modelIsLoading={modelIsLoading}
                    isSendDisabled={!selectedModel || inputText.trim() === ''}
                    isVoiceDisabled={!selectedModel || inputText.trim() !== ''}
                    onSendPress={onSubmit}
                    onPausePress={handlePause}
                    setVoiceMode={setVoiceMode}
                />
            </YStack>
        </XStack>
    )
}

export const MessageInput = MessageInputComponent