import { XStack, YStack, Text, View, Button } from 'tamagui';
import { ModelMetrics } from '@/utils/modelMetrics';
import { Model } from '@/services/models';
import Markdown from 'react-native-markdown-display';
import { generateUniqueId } from '@/services/chat/llama-local';
import { 
  Copy, 
  ChevronDown, 
  Brain, 
  Eye, 
  EyeOff,
  FileText,
  Zap
} from '@tamagui/lucide-icons';
import { TouchableOpacity } from 'react-native';
import { Clipboard } from 'react-native';
import { Spinner } from 'tamagui';
import { Accordion } from 'tamagui';
import { useState, useEffect } from 'react';
import { RAGContext } from '@/services/rag/types';
import { RAGContextVisualizer } from '../rag/RAGContextVisualizer';

export interface EnhancedMessage {
  id: string;
  isUser: boolean;
  text: string;
  model: Model;
  metrics?: ModelMetrics;
  ragContext?: RAGContext;
  mcpToolCalls?: Array<{
    toolName: string;
    parameters: any;
    result: any;
    executionTimeMs: number;
  }>;
}

interface EnhancedChatMessageProps {
  message: EnhancedMessage;
  showRAGContext?: boolean;
  onToggleRAGContext?: () => void;
}

export const createUserMessage = (messageText: string, model: Model): EnhancedMessage => {
  return { id: generateUniqueId(), isUser: true, text: messageText, model: model };
}

export const createAIMessage = (
  messageText: string, 
  model: Model, 
  metrics?: ModelMetrics,
  ragContext?: RAGContext,
  mcpToolCalls?: Array<{
    toolName: string;
    parameters: any;
    result: any;
    executionTimeMs: number;
  }>
): EnhancedMessage => {
  return { 
    id: generateUniqueId(), 
    isUser: false, 
    text: messageText, 
    model: model, 
    metrics: metrics,
    ragContext: ragContext,
    mcpToolCalls: mcpToolCalls
  };
} 

export function EnhancedChatMessage({ 
  message, 
  showRAGContext = false, 
  onToggleRAGContext 
}: EnhancedChatMessageProps) {
  const { isUser, text, metrics, model, ragContext, mcpToolCalls } = message;

  let isReasoning = true;
  let reasoningText: string = "";
  let responseText: string = "";

  if (isUser) {
    if (text.startsWith('/no_think')){
      responseText = text.split('/no_think').at(1) || "";
    }
    else {
      responseText = text;
    }
  } else {
    if (text.includes('<think>')) {
      const reasoningStartSplit = text.split('<think>').at(1);
      if (reasoningStartSplit?.includes('</think>')) {
        const reasoningAndResponseSplits = reasoningStartSplit?.split('</think>');
        isReasoning = false
        reasoningText = (reasoningAndResponseSplits?.at(0) || "").trim();
        responseText = (reasoningAndResponseSplits?.at(1) || "").trim();
      } else {
        reasoningText = (reasoningStartSplit || "").trim();
      }
    }
    else {
      responseText = text;
    }
  }
  
  const [accordionValue, setAccordionValue] = useState(metrics ? '' : 'thinking');
  const [ragContextVisible, setRAGContextVisible] = useState(showRAGContext);

  useEffect(() => {
    setRAGContextVisible(showRAGContext);
  }, [showRAGContext]);

  const toggleRAGContext = () => {
    const newVisibility = !ragContextVisible;
    setRAGContextVisible(newVisibility);
    onToggleRAGContext?.();
  };

  const hasEnhancements = ragContext || (mcpToolCalls && mcpToolCalls.length > 0);

  return (
    <XStack justifyContent={isUser ? 'flex-end' : 'flex-start'} paddingVertical={8}>
      <YStack 
        backgroundColor={isUser ? 'white' : 'white'}
        padding={12}
        borderRadius="$6"
        elevation={0.2}
        maxWidth="85%"
        gap="$3"
      >
        {/* Model Label */}
        {!isUser && model?.label && (
          <YStack>
            <Text color="$gray10" fontSize={12} opacity={0.7} fontWeight={300}>
              {model.label}
            </Text>
          </YStack>
        )}

        {/* Enhancement Indicators */}
        {!isUser && hasEnhancements && (
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            {ragContext && (
              <XStack
                alignItems="center"
                gap="$1"
                backgroundColor="$blue1"
                borderColor="$blue6"
                borderWidth={1}
                borderRadius="$3"
                paddingHorizontal="$2"
                paddingVertical="$1"
              >
                <Brain size={12} color="$blue10" />
                <Text fontSize="$1" color="$blue10" fontWeight="500">
                  RAG Enhanced
                </Text>
              </XStack>
            )}
            
            {mcpToolCalls && mcpToolCalls.length > 0 && (
              <XStack
                alignItems="center"
                gap="$1"
                backgroundColor="$green1"
                borderColor="$green6"
                borderWidth={1}
                borderRadius="$3"
                paddingHorizontal="$2"
                paddingVertical="$1"
              >
                <Zap size={12} color="$green10" />
                <Text fontSize="$1" color="$green10" fontWeight="500">
                  {mcpToolCalls.length} Tool{mcpToolCalls.length > 1 ? 's' : ''} Used
                </Text>
              </XStack>
            )}
          </XStack>
        )}

        {/* MCP Tool Calls */}
        {!isUser && mcpToolCalls && mcpToolCalls.length > 0 && (
          <YStack gap="$2">
            <Text color="$gray10" fontSize={12} opacity={0.7} fontWeight={400}>
              Tool Executions:
            </Text>
            {mcpToolCalls.map((toolCall, index) => (
              <YStack
                key={index}
                backgroundColor="$green1"
                borderColor="$green6"
                borderWidth={1}
                borderRadius="$3"
                padding="$2"
                gap="$1"
              >
                <XStack alignItems="center" justifyContent="space-between">
                  <XStack alignItems="center" gap="$1">
                    <Zap size={12} color="$green10" />
                    <Text fontSize="$2" fontWeight="500" color="$green10">
                      {toolCall.toolName}
                    </Text>
                  </XStack>
                  <Text fontSize="$1" color="$gray10">
                    {toolCall.executionTimeMs}ms
                  </Text>
                </XStack>
                
                {Object.keys(toolCall.parameters).length > 0 && (
                  <Text fontSize="$1" color="$gray10" numberOfLines={2}>
                    Parameters: {JSON.stringify(toolCall.parameters, null, 2).substring(0, 100)}...
                  </Text>
                )}
              </YStack>
            ))}
          </YStack>
        )}

        {/* RAG Context Visualization */}
        {!isUser && ragContext && (
          <RAGContextVisualizer
            context={ragContext}
            isVisible={ragContextVisible}
            onToggleVisibility={toggleRAGContext}
            compact={true}
          />
        )}

        {/* Reasoning Section */}
        {reasoningText.trim().length > 0 && (
          <Accordion type="single" collapsible value={accordionValue} onValueChange={(val) => setAccordionValue(accordionValue === 'thinking' ? '' : 'thinking')} overflow="hidden" borderWidth={0} padding={0} margin={0} backgroundColor="transparent">
            <Accordion.Item value="thinking" borderWidth={0} padding={0} margin={0} backgroundColor="transparent">
              <Accordion.Trigger borderWidth={0} padding={0} margin={0} backgroundColor="transparent">
                <XStack alignItems="center" gap="$1">
                  <Brain size={12} color="$gray10" />
                  <Text color="$gray10" fontSize={12} opacity={0.7} fontWeight={300}>Reasoning</Text>
                  <ChevronDown size={12} color="$gray10" transform={[{ rotate: accordionValue === 'thinking' ? '180deg' : '0deg' }]} />
                </XStack>
              </Accordion.Trigger>
              <Accordion.Content borderWidth={0} padding={0} margin={0} backgroundColor="transparent">
                <YStack
                  backgroundColor="$gray1"
                  borderColor="$gray6"
                  borderWidth={1}
                  borderRadius="$3"
                  padding="$2"
                  marginTop="$2"
                >
                  <Text color="$gray10" fontSize={12} opacity={0.8} fontWeight={300} lineHeight={16}>
                    {reasoningText}
                  </Text>
                </YStack>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion>
        )}

        {/* Main Response */}
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
          {responseText}
        </Markdown>
        
        {/* Enhanced Metrics */}
        {!isUser && metrics && (
          <YStack gap="$1">
            <Text color="$gray10" fontSize={12} opacity={0.7} fontWeight={300}>
              Tokens: {metrics.completionTokens} • TTFT: {Math.round(metrics.timeToFirstToken)}ms • {Math.round(metrics.tokensPerSecond)} tok/sec
            </Text>
            
            {ragContext && (
              <Text color="$blue9" fontSize={12} opacity={0.8} fontWeight={300}>
                Context: {ragContext.chunks.length} sources • {ragContext.metadata.totalTokens} tokens
              </Text>
            )}
            
            {mcpToolCalls && mcpToolCalls.length > 0 && (
              <Text color="$green9" fontSize={12} opacity={0.8} fontWeight={300}>
                Tools: {mcpToolCalls.reduce((sum, call) => sum + call.executionTimeMs, 0)}ms total execution time
              </Text>
            )}
          </YStack>
        )}

        {/* Action Buttons for AI Messages */}
        {!isUser && hasEnhancements && (
          <XStack gap="$2" marginTop="$1">
            {ragContext && (
              <Button
                size="$2"
                backgroundColor="$blue1"
                borderColor="$blue6"
                borderWidth={1}
                borderRadius="$3"
                onPress={toggleRAGContext}
                icon={ragContextVisible ? <EyeOff size={12} color="$blue10" /> : <Eye size={12} color="$blue10" />}
              >
                <Text fontSize="$2" color="$blue10">
                  {ragContextVisible ? 'Hide' : 'Show'} Context
                </Text>
              </Button>
            )}
          </XStack>
        )}
      </YStack>
    </XStack>
  );
}