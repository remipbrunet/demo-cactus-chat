import { XStack, YStack, Input, Button, ScrollView } from 'tamagui';
import { useRef, useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Settings, Send } from '@tamagui/lucide-icons';
import { ChatMessage } from '../components/ChatMessage';
import { ModelPicker } from '../components/ModelPicker';
import { Message, generateUniqueId, streamChatCompletion } from '../services/openai';
import { streamAnthropicCompletion } from '../services/anthropic';
import { Model, models } from '../services/models';
import { Conversation, saveConversation, getConversation, saveLastUsedModel, getLastUsedModel } from '../services/storage';

export default function ChatScreen() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<Model>(models[0]);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string>(generateUniqueId());
  const scrollViewRef = useRef<any>(null);

  // Load initial state
  useEffect(() => {
    const loadInitialState = async () => {
      // Load last used model
      const lastModelId = await getLastUsedModel();
      if (lastModelId) {
        const lastModel = models.find(m => m.id === lastModelId);
        if (lastModel && !lastModel.disabled) {
          setSelectedModel(lastModel);
          setValue(lastModelId);
        }
      }
      
      // Load conversation
      const conversation = await getConversation(conversationId);
      if (conversation) {
        setMessages(conversation.messages);
        // Set model from conversation if available
        const model = models.find(m => m.id === conversation.modelId);
        if (model && !model.disabled) {
          setSelectedModel(model);
          setValue(model.id);
        }
      } else {
        // Create a new conversation with welcome message
        const welcomeMessage: Message = {
          id: generateUniqueId(),
          isUser: false,
          text: 'Hello! How can I help you today?'
        };
        setMessages([welcomeMessage]);
        saveCurrentConversation([welcomeMessage]);
      }
    };
    
    loadInitialState();
  }, [conversationId]);

  // Save conversation when messages change
  const saveCurrentConversation = async (currentMessages: Message[]) => {
    if (currentMessages.length === 0) return;
    
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
      modelId: selectedModel.id
    };
    
    await saveConversation(conversation);
  };

  const handleModelSelect = (model: Model) => {
    setSelectedModel(model);
    saveLastUsedModel(model.id);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isStreaming) return;
    
    // Add user message
    const userMessage: Message = {
      id: generateUniqueId(),
      isUser: true,
      text: inputText
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
      text: '...'
    };
    
    const messagesWithAssistant = [...updatedMessages, assistantMessage];
    setMessages(messagesWithAssistant);
    setIsStreaming(true);

    try {
      if (selectedModel.provider === 'openai') {
        await streamChatCompletion(
          updatedMessages,
          selectedModel.value,
          (streamText: string) => {
            // Update the assistant message with streamed content
            setMessages(prev => {
              const updated = [...prev];
              const lastMessage = updated[updated.length - 1];
              if (!lastMessage.isUser) {
                lastMessage.text = streamText;
              }
              return updated;
            });
          },
          (finalText) => {
            // Final update when streaming completes
            setIsStreaming(false);
            // Save the updated conversation
            setMessages(prev => {
              saveCurrentConversation(prev);
              return prev;
            });
          }
        );
      } else if (selectedModel.provider === 'anthropic') {
        await streamAnthropicCompletion(
          updatedMessages,
          selectedModel.value,
          (streamText: string) => {
            setMessages(prev => {
              const updated = [...prev];
              const lastMessage = updated[updated.length - 1];
              if (!lastMessage.isUser) {
                lastMessage.text = streamText;
              }
              return updated;
            });
          },
          () => {
            setIsStreaming(false);
            // Save the updated conversation
            setMessages(prev => {
              saveCurrentConversation(prev);
              return prev;
            });
          }
        );
      } else if (selectedModel.provider === 'cactus') {
        // Future implementation for Cactus provider
        setTimeout(() => {
          setMessages(prev => {
            const updated = [...prev];
            const lastMessage = updated[updated.length - 1];
            if (!lastMessage.isUser) {
              lastMessage.text = 'Cactus provider not yet implemented.';
            }
            
            // Save the updated conversation
            saveCurrentConversation(updated);
            return updated;
          });
          setIsStreaming(false);
        }, 1000);
      }
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
            <Button icon={Menu} circular size="$2" chromeless />
            <ModelPicker
              open={open}
              value={value}
              setOpen={setOpen}
              setValue={setValue}
              onSelectModel={handleModelSelect}
            />
            <Button icon={Settings} circular size="$2" chromeless />
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
            <Button 
              icon={Send}
              onPress={sendMessage}
              disabled={isStreaming || !inputText.trim()}
              opacity={isStreaming || !inputText.trim() ? 0.5 : 1}
            />
          </XStack>
        </YStack>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}