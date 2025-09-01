import { useRef, useState, useEffect } from 'react';
import { XStack, YStack, Button, ScrollView } from 'tamagui';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Menu, Settings } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Conversation, saveConversation, getConversation } from '../services/storage';
import { ChatMessage, createUserMessage, Message } from '@/components/ui/chat/ChatMessage';
import { ModelDisplay } from '@/components/ui/chat/ModelDisplay';
import { ModelMetrics } from '@/utils/modelMetrics';
import { useModelContext } from '@/contexts/modelContext';
import { logChatCompletionDiagnostics } from '@/services/diagnostics';
import { MessageInput } from '@/components/ui/chat/MessageInput';
import { Model } from '@/services/models';
// import { VoiceModeOverlay } from '@/components/VoiceModeScreen';
import { streamLlamaCompletion, generateUniqueId } from '@/services/chat/llama-local';
import { streamUnifiedMCPCompletion, modelSupportsTools } from '@/services/chat/unified-mcp';
import { MCPToolInvocation } from '@/services/mcp/types';
import { mcpClient } from '@/services/mcp/client';
import { MCPStatusIndicator } from '@/components/ui/chat/MCPStatusIndicator';


export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentAIMessage, setCurrentAIMessage] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  
  const scrollViewRef = useRef<any>(null);
  const { 
    selectedModel, 
    tokenGenerationLimit, 
    isReasoningEnabled, 
    cactusContext, 
    conversationId,
    systemPrompt
  } = useModelContext();
  
  // Single ref for streaming updates
  const streamingUpdateRef = useRef<{
    text: string;
    frameId: number | null;
  }>({ text: '', frameId: null });

  useEffect(() => {
    const loadConversationState = async () => {
      const conversation = await getConversation(conversationId);
      if (conversation) {
        setMessages(conversation.messages);
      } else {
        setMessages([]);
        saveCurrentConversation([]);
      }
    };
    
    loadConversationState();
  }, [conversationId]);

  // Save conversation when messages change
  const saveCurrentConversation = async (currentMessages: Message[]) => {
    if (currentMessages.length === 0) return;
    if (!selectedModel) return;
    
    // Get title from first user message or use default
    const firstUserMessage = currentMessages.find(m => m.isUser);
    let title = firstUserMessage 
      ? firstUserMessage.text.substring(0, 30) + (firstUserMessage.text.length > 30 ? '...' : '') 
      : 'New Conversation';
    
    if (title.startsWith('/no_think')) {
      title = title.split('/no_think').at(1) || "";
    }

    const conversation: Conversation = {
      id: conversationId,
      title,
      messages: currentMessages,
      lastUpdated: Date.now(),
      model: selectedModel
    };
    
    await saveConversation(conversation);
  };

  function processFinishedMessage(message: string, model: Model, modelMetrics?: ModelMetrics) {
    // cleanup function when the streaming ends
    // called either when the streaming is complete or when there is an error
    setIsStreaming(false);
    setCurrentAIMessage("");
    setMessages(prev => {
      const updated = [...prev];
      if (updated.length > 0) {
        const AImessage: Message = {
          id: generateUniqueId(),
          isUser: false,
          text: message,
          model: model,
          metrics: modelMetrics
        }
        updated.push(AImessage);
      }
      saveCurrentConversation(updated); // save to storage
      streamingUpdateRef.current.text = ''; // clear the streaming text
      return updated;
    });
  }

  function chatCallbackPartialMessage(streamText: string) {
    streamingUpdateRef.current.text = streamText;
    // Only schedule a frame if one isn't already pending
    if (streamingUpdateRef.current.frameId === null) {
      streamingUpdateRef.current.frameId = requestAnimationFrame(() => {
        setCurrentAIMessage(streamingUpdateRef.current.text);
        streamingUpdateRef.current.frameId = null;
      });
    }
  }

  function chatCallbackCompleteMessage(modelMetrics: ModelMetrics, model: Model) {
    setIsStreaming(false);
    
    if (streamingUpdateRef.current.frameId !== null) {
      cancelAnimationFrame(streamingUpdateRef.current.frameId);
      streamingUpdateRef.current.frameId = null;
    }
    logChatCompletionDiagnostics({
      llm_model: model.value,
      tokens_per_second: modelMetrics.tokensPerSecond,
      time_to_first_token: modelMetrics.timeToFirstToken,
      generated_tokens: modelMetrics.completionTokens,
      streaming: true,
    });
    processFinishedMessage(streamingUpdateRef.current.text.trimEnd(), model, modelMetrics);
  }

  const sendMessage = async (inputText: string) => {
    if (!inputText.trim() || isStreaming) return;
    if (!selectedModel) return;

    const userMessage: Message = createUserMessage(`${isReasoningEnabled ? '' : '/no_think'}${inputText}`, selectedModel);

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    saveCurrentConversation(updatedMessages); 
    
    setIsStreaming(true);
    try {
      // Use MCP-enhanced completion if model supports it
      const supportsTools = modelSupportsTools(selectedModel);
      const hasConnectedServers = mcpClient.getConnectedServers().length > 0;
      
      if (supportsTools && hasConnectedServers) {
        console.log('[Chat] Using MCP-enhanced completion');
        await streamUnifiedMCPCompletion(
          cactusContext.lm,
          updatedMessages,
          selectedModel,
          chatCallbackPartialMessage,
          chatCallbackCompleteMessage,
          true, // streaming
          tokenGenerationLimit,
          isReasoningEnabled,
          false, // voiceMode
          systemPrompt,
          (invocation: MCPToolInvocation) => {
            console.log('[Chat] Tool invoked:', invocation);
          }
        );
      } else {
        // Fallback to regular completion
        console.log('[Chat] Using standard completion (no MCP)');
        await streamLlamaCompletion(
          cactusContext.lm,
          updatedMessages,
          selectedModel,
          chatCallbackPartialMessage,
          chatCallbackCompleteMessage,
          true, // streaming
          tokenGenerationLimit,
          isReasoningEnabled,
          false, // voiceMode
          systemPrompt
        );
      }
    } catch (error) {
      console.error('Error in chat:', error);
      processFinishedMessage('Sorry, there was an error processing your request.', selectedModel, undefined);
    }

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <YStack flex={1} paddingHorizontal="$4">
            <XStack 
              alignItems="center" 
              paddingVertical="$2"
              justifyContent="space-between"
            >
              <Button 
                icon={<Menu size="$1"/>} 
                size="$2" 
                chromeless 
                onPress={() => router.push('/conversationsScreen')}
              />
              <XStack alignItems="center" gap="$2">
                <ModelDisplay/>
                <MCPStatusIndicator/>
              </XStack>
              <Button 
                icon={<Settings size="$1"/>} 
                size="$2" 
                chromeless 
                onPress={() => router.push('/settingsScreen')}
              />
            </XStack>
            <ScrollView 
              ref={scrollViewRef}
              flex={1} 
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {([...messages, ...(currentAIMessage ? [{
                id: generateUniqueId(),
                isUser: false,
                text: currentAIMessage,
                model: selectedModel
              } as Message] : [])]).map(message => (
                <ChatMessage key={message.id} message={message} />
              ))}
            </ScrollView>
            <MessageInput 
              sendMessage={sendMessage}
              isStreaming={isStreaming}
              selectedModel={selectedModel}
              setVoiceMode={setVoiceMode}
            />
          </YStack>
        </KeyboardAvoidingView>
        {/* <VoiceModeOverlay
          visible={voiceMode}
          onClose={() => setVoiceMode(false)}
          messages={messages}
          setMessages={setMessages}
        /> */}
    </SafeAreaView>
  );
}