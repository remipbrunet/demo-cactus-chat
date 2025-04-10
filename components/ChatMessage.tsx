import { XStack, YStack, Text } from 'tamagui';
import { ModelMetrics } from '@/utils/modelMetrics';
import { Model } from '@/services/models';

export interface Message {
  id: string;
  isUser: boolean;
  text: string;
  model: Model;
  metrics?: ModelMetrics;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { isUser, text, metrics, model } = message;
  
  return (
    <XStack justifyContent={isUser ? 'flex-end' : 'flex-start'} paddingVertical={8}>
      <YStack 
        backgroundColor={isUser ? 'white' : 'white'}
        padding={12}
        borderRadius="$6"
        elevation={0.2}
        maxWidth="85%"
      >
        {!isUser && model?.label && (
          <YStack marginBottom={8}>
            <Text color="$gray10" fontSize={12} opacity={0.7}>
              {model.label}
            </Text>
          </YStack>
        )}
        <Text 
          color="$color"
          fontSize={15} 
          lineHeight={20}
          fontWeight="400"
        >
          {text}
        </Text>
        
        {!isUser && metrics && (
          <YStack marginTop={8}>
            <Text color="$gray10" fontSize={12} opacity={0.7}>
              Tokens: {metrics.completionTokens} • TTFT: {Math.round(metrics.timeToFirstToken)}ms • {Math.round(metrics.tokensPerSecond)} tok/sec
            </Text>
          </YStack>
        )}
      </YStack>
    </XStack>
  );
} 