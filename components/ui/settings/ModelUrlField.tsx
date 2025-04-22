import React from "react";
import { YStack, Progress, Text, XStack, Input, Button } from "tamagui";
import { Download } from "@tamagui/lucide-icons";

interface ModelUrlFieldProps {
    downloadInProgress: boolean;
    downloadProgress: number;
    modelUrl: string;
    setModelUrl: (url: string) => void;
    errorMessage: string;
    setErrorMessage: (message: string) => void;
    handleModelDownload: () => void;
}
  
export const ModelUrlField: React.FC<ModelUrlFieldProps> = ({
    downloadInProgress,
    downloadProgress,
    modelUrl,
    setModelUrl,
    errorMessage,
    setErrorMessage,
    handleModelDownload,
}) => {

return (
    <>
    {downloadInProgress ? (
    <YStack gap="$2">
        <Text fontSize={12} textAlign="center">
            Downloading model... {Math.round(downloadProgress)}%
        </Text>
        <Progress value={downloadProgress} max={100} width="100%" height={8}>
            <Progress.Indicator animation="bouncy" backgroundColor="$green10" />
        </Progress>
    </YStack>
    ) : (
    <XStack alignItems="center">
        <Input 
        flex={1}
        size="$4"
        placeholder="Custom HuggingFace GGUF URL" 
        value={modelUrl}
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
        disabled={!modelUrl.trim()}
        />
    </XStack>
    )}
    
    {/* Error message */}
    {errorMessage ? (
    <Text color="$red10" fontSize={12} marginBottom={8}>
        {errorMessage}
    </Text>
    ) : null}
    </>
)

}