import { XStack, YStack, Button, ScrollView } from 'tamagui';
import { useRef, useState, useEffect, useCallback } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Settings, Send } from '@tamagui/lucide-icons';
import { ChatMessage, createUserMessage } from '../components/ui/ChatMessage';
import { ModelPicker } from '../components/ModelPicker';
import { ConversationSidebar } from '../components/ConversationSidebar';
import { SettingsSheet } from '../components/SettingsSheet';
import { sendChatMessage, generateUniqueId } from '@/services/chat/chat';
import { 
  Conversation, 
  saveConversation, 
  getConversation, 
  getConversations,
} from '../services/storage';
import { ModelMetrics } from '@/utils/modelMetrics';
import { Message } from '@/components/ui/ChatMessage';
import { useModelContext } from '@/contexts/modelContext';
import { logChatCompletionDiagnostics } from '@/services/diagnostics';
import { MessageInput } from '@/components/ui/MessageInput';
import { Model } from '@/services/models';
import { VoiceModeOverlay } from '@/components/VoiceModeScreen';

export default function ChatScreen() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentAIMessage, setCurrentAIMessage] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [modelIsLoading, setModelIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>(generateUniqueId());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [voiceMode, setVoiceMode] = useState(false);
  
  const scrollViewRef = useRef<any>(null);
  const { selectedModel, tokenGenerationLimit } = useModelContext();
  
  // Single ref for streaming updates
  const streamingUpdateRef = useRef<{
    text: string;
    frameId: number | null;
  }>({ text: '', frameId: null });

  // Load conversations list
  useEffect(() => {
    const loadConversations = async () => {
      const conversations = await getConversations();
      setAllConversations(conversations);
    };
    
    loadConversations();
  }, []); // Reload once

  // Load initial state
  useEffect(() => {
    const loadInitialState = async () => {
      
      // Load conversation
      const conversation = await getConversation(conversationId);
      if (conversation) {
        setMessages(conversation.messages);
        // Set model from conversation if available
        // const model = initialModels.find(m => m.value === conversation.model.value);
        // if (model && !model.disabled) {
          // setValue(model.value);
        // }
      } else {
        setMessages([]);
        saveCurrentConversation([]);
      }
    };
    
    loadInitialState();
  }, [conversationId]);

  // Save conversation when messages change
  const saveCurrentConversation = async (currentMessages: Message[]) => {
    if (currentMessages.length === 0) return;
    if (!selectedModel) return;
    
    // Get title from first user message or use default
    const firstUserMessage = currentMessages.find(m => m.isUser);
    const title = firstUserMessage 
      ? firstUserMessage.text.substring(0, 30) + (firstUserMessage.text.length > 30 ? '...' : '') 
      : 'New Conversation';
    
    const conversation: Conversation = {
      id: conversationId,
      title,
      messages: currentMessages,
      lastUpdated: Date.now(),
      model: selectedModel
    };
    
    await saveConversation(conversation);
  };
  
  const createNewConversation = () => {
    // Generate a new conversation ID
    const newId = generateUniqueId();
    // Reset the conversation
    setConversationId(newId);
    setMessages([]);
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
      getConversations().then(setAllConversations); // update the conversations list
      // scrollViewRef.current?.scrollToEnd({ animated: true }); // scroll to the bottom
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

    const userMessage: Message = createUserMessage(inputText, selectedModel);

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    saveCurrentConversation(updatedMessages); 
    
    setIsStreaming(true);
    try {
      await sendChatMessage(
        updatedMessages,
        selectedModel,
        chatCallbackPartialMessage,
        chatCallbackCompleteMessage,
        { streaming: true },
        tokenGenerationLimit
      );      
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
      <ConversationSidebar
        isOpen={sidebarOpen}
        conversations={allConversations}
        onClose={() => setSidebarOpen(false)}
        onSelectConversation={setConversationId}
        onNewConversation={createNewConversation}
        zIndex={1000}
      />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <YStack flex={1} paddingHorizontal={16}>
          <XStack 
            alignItems="center" 
            marginBottom={16} 
            marginTop={4}
            justifyContent="space-between"
          >
            <Button 
              icon={Menu} 
              size="$2" 
              chromeless 
              onPress={() => {
                if (open) setOpen(false);
                setSidebarOpen(true);
              }}
            />
            <ModelPicker
              open={open}
              modelIsLoading={modelIsLoading}
              setModelIsLoading={setModelIsLoading}
              setOpen={setOpen}
              zIndex={50}
            />
            <Button 
              icon={Settings} 
              size="$2" 
              chromeless 
              onPress={() => setSettingsOpen(true)}
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
            modelIsLoading={modelIsLoading}
            selectedModel={selectedModel}
            setVoiceMode={setVoiceMode}
          />
        </YStack>
      </KeyboardAvoidingView>
      
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
      <VoiceModeOverlay
        visible={voiceMode}
        onClose={() => setVoiceMode(false)}
        messages={messages}
        setMessages={setMessages}
      />
    </SafeAreaView>
  );
}