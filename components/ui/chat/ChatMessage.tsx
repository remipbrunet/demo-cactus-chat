import { XStack, YStack, Text, View } from 'tamagui';
import { ModelMetrics } from '@/utils/modelMetrics';
import { Model } from '@/services/models';
import Markdown from 'react-native-markdown-display';
import { generateUniqueId } from '@/services/chat/llama-local';
import { Copy } from '@tamagui/lucide-icons';
import { TouchableOpacity } from 'react-native';
import { Clipboard } from 'react-native';

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

export const createUserMessage = (messageText: string, model: Model): Message => {
  return { id: generateUniqueId(), isUser: true, text: messageText, model: model };
}

export const createAIMessage = (messageText: string, model: Model, metrics?: ModelMetrics): Message => {
  return { id: generateUniqueId(), isUser: false, text: messageText, model: model, metrics: metrics };
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
          <YStack marginBottom="$2">
            <Text color="$gray10" fontSize={12} opacity={0.7} fontWeight={300}>
              {model.label}
            </Text>
          </YStack>
        )}
        <Markdown 
          style={{ 
            paragraph: { fontSize: 14, lineHeight: 21, fontWeight: '300', marginTop: 0, marginBottom: 0 },
            bullet_list_content: { fontSize: 14, lineHeight: 21, fontWeight: '300', marginTop: 0, marginBottom: 5 },
            ordered_list_content: { fontSize: 14, lineHeight: 21, fontWeight: '300', marginTop: 0, marginBottom: 5 },
            heading1: { fontSize: 26, lineHeight: 31, fontWeight: '400', marginTop: 10, marginBottom: 10 },
            heading2: { fontSize: 21, lineHeight: 31, fontWeight: '400', marginTop: 10, marginBottom: 10 },
            heading3: { fontSize: 18, lineHeight: 21, fontWeight: '400', marginTop: 10, marginBottom: 10 },
            heading4: { fontSize: 16, lineHeight: 21, fontWeight: '400', marginTop: 10, marginBottom: 10 },
            heading5: { fontSize: 14, lineHeight: 21, fontWeight: '400', marginTop: 10, marginBottom: 10 },
            heading6: { fontSize: 13, lineHeight: 21, fontWeight: '400', marginTop: 10, marginBottom: 10 },
            bullet_list_icon: { marginLeft: 5, marginRight: 5, lineHeight: 21 },
            ordered_list_icon: { marginLeft: 5, marginRight: 5, lineHeight: 21 },
            fence: { marginTop: 10, marginBottom: 10 },
            code_block: { borderWidth: 0, marginTop: 0, marginBottom: 0, paddingBottom: 0 },
          }}
          rules={{
            fence: (node, children, parent, styles) => {
              const codeContent = node.content || '';
              
              return (
                <View key={node.key} style={[styles.fence, { position: 'relative', paddingTop: 0, paddingBottom: 0 }]}>
                  <Text style={styles.code_block}>{codeContent}</Text>
                  
                  <TouchableOpacity
                    style={{
                      position: 'absolute',
                      top: 5,
                      right: 5,
                      padding: 5,
                    }}
                    onPress={() => Clipboard.setString(codeContent)}
                  >
                    <Copy size={12} color="$gray10"/>
                  </TouchableOpacity>
                </View>
              );
            }
          }}
        >
          {text}
        </Markdown>
        
        {!isUser && metrics && (
          <YStack marginTop="$2">
            <Text color="$gray10" fontSize={12} opacity={0.7} fontWeight={300}>
              Tokens: {metrics.completionTokens} • TTFT: {Math.round(metrics.timeToFirstToken)}ms • {Math.round(metrics.tokensPerSecond)} tok/sec
            </Text>
          </YStack>
        )}
      </YStack>
    </XStack>
  );
} 