import { XStack, YStack, Input, Button, ScrollView, Spinner, Text } from 'tamagui';
import { useRef, useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Settings, Send } from '@tamagui/lucide-icons';
import { ChatMessage } from '../components/ChatMessage';
import { ModelPicker } from '../components/ModelPicker';
import { ConversationSidebar } from '../components/ConversationSidebar';
import { SettingsSheet } from '../components/SettingsSheet';
import { sendChatMessage, generateUniqueId } from '@/services/chat';
import { 
  Conversation, 
  saveConversation, 
  getConversation, 
  getConversations,
} from '../services/storage';
import { ModelMetrics } from '@/utils/modelMetrics';
import { Message } from '@/components/ChatMessage';
import { useModelContext } from '@/contexts/modelContext';
export default function ChatScreen() {
  const [open, setOpen] = useState(false);
  // const [value, setValue] = useState<string | null>(null);
  // const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [modelIsLoading, setModelIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>(generateUniqueId());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const scrollViewRef = useRef<any>(null);

  const { selectedModel } = useModelContext();
  
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

  const sendMessage = async () => {
    if (!inputText.trim() || isStreaming) return;
    if (!selectedModel) return;
    // Add user message
    const userMessage: Message = {
      id: generateUniqueId(),
      isUser: true,
      text: inputText,
      model: selectedModel
    };
    
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText('');
    
    // Save conversation with the user message
    await saveCurrentConversation(updatedMessages);

    // Add placeholder for assistant response
    const assistantMessage: Message = {
      id: generateUniqueId(),
      isUser: false,
      text: '...',
      model: selectedModel
    };
    
    const messagesWithAssistant = [...updatedMessages, assistantMessage];
    setMessages(messagesWithAssistant);
    setIsStreaming(true);
    try {
      await sendChatMessage(
        updatedMessages,
        selectedModel,
        (streamText: string) => {
          // Store the latest text
          streamingUpdateRef.current.text = streamText;
          
          // Only schedule a frame if one isn't already pending
          if (streamingUpdateRef.current.frameId === null) {
            streamingUpdateRef.current.frameId = requestAnimationFrame(() => {
              setMessages(prev => {
                const updated = [...prev];
                const lastMessage = updated[updated.length - 1];
                if (!lastMessage.isUser) {
                  lastMessage.text = streamingUpdateRef.current.text;
                }
                return updated;
              });
              streamingUpdateRef.current.frameId = null;
            });
          }
        },
        (modelMetrics: ModelMetrics) => {
          // Final update when streaming completes
          setIsStreaming(false);
          
          // Cancel any pending frame
          if (streamingUpdateRef.current.frameId !== null) {
            cancelAnimationFrame(streamingUpdateRef.current.frameId);
            streamingUpdateRef.current.frameId = null;
          }
          
          // Save the updated conversation
          setMessages(prev => {
            const updated = [...prev];
            const lastMessage = updated[updated.length - 1];
            lastMessage.text = streamingUpdateRef.current.text.trimEnd();
            lastMessage.metrics = modelMetrics;
            saveCurrentConversation(updated);
            getConversations().then((conversations) => {
              setAllConversations(conversations);
            });
            scrollViewRef.current?.scrollToEnd({ animated: true });
            return updated;
          });
        }
      );      
    } catch (error) {
      console.error('Error in chat:', error);
      setIsStreaming(false);
      
      // Update the message to show error
      setMessages(prev => {
        const updated = [...prev];
        const lastMessage = updated[updated.length - 1];
        if (!lastMessage.isUser) {
          lastMessage.text = 'Sorry, there was an error processing your request.';
        }
        
        // Save the conversation even with the error
        saveCurrentConversation(updated);
        return updated;
      });
    }

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

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
          >
            {messages.map(message => (
              <ChatMessage key={message.id} message={message} />
            ))}
          </ScrollView>
          <XStack paddingVertical={16}>
            <Input 
              flex={1} 
              marginRight={8}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message..."
              onSubmitEditing={sendMessage}
            />
            {(!isStreaming && !modelIsLoading) ?
              <Button 
                icon={Send}
                onPress={sendMessage}
                disabled={!selectedModel || inputText.trim() === ''}
                opacity={!selectedModel || inputText.trim() === '' ? 0.25 : 1}
              /> :
              <YStack padding="$3" alignItems="center" justifyContent="center">
                <Spinner size="small" />
              </YStack>
            }
          </XStack>
        </YStack>
      </KeyboardAvoidingView>
      
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </SafeAreaView>
  );
}