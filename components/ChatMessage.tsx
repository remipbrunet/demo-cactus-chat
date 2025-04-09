import { XStack, YStack, Text } from 'tamagui';
import { Message } from '../services/openai';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { isUser, text } = message;
  
  return (
    <XStack justifyContent={isUser ? 'flex-end' : 'flex-start'} paddingVertical={8}>
      <YStack 
        backgroundColor={isUser ? 'white' : 'white'}
        padding={12}
        borderRadius="$6"
        elevation={0.2}
        maxWidth="85%"
      >
        <Text 
          color="$color"
          fontSize={15} 
          lineHeight={20}
          fontWeight="400"
        >
          {text}
        </Text>
      </YStack>
    </XStack>
  );
} 