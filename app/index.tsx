import { XStack, YStack, Input, Button, ScrollView } from 'tamagui';
import { useRef, useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Settings, Send } from '@tamagui/lucide-icons';
import { ChatMessage } from '../components/ChatMessage';
import { ModelPicker } from '../components/ModelPicker';
import { ConversationSidebar } from '../components/ConversationSidebar';
import { SettingsSheet } from '../components/SettingsSheet';
import { ApiKeyDialog } from '../components/ApiKeyDialog';
import { generateUniqueId, streamChatCompletion } from '../services/openai';
import { streamAnthropicCompletion } from '../services/anthropic';
import { Model, models as initialModels, refreshModelAvailability } from '../services/models';
import { 
  Conversation, 
  saveConversation, 
  getConversation, 
  saveLastUsedModel, 
  getLastUsedModel,
  getConversations,
  saveOpenAIKey,
  saveAnthropicKey,
  getOpenAIKey,
  getAnthropicKey,
  deleteOpenAIKey,
  deleteAnthropicKey,
  saveGeminiKey,
  getGeminiKey,
  deleteGeminiKey
} from '../services/storage';
import { ModelMetrics } from '@/utils/modelMetrics';
import { Message } from '@/components/ChatMessage';
import { streamGeminiCompletion } from '../services/gemini';

export default function ChatScreen() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<Model>(initialModels[0]);
  const [availableModels, setAvailableModels] = useState<Model[]>(initialModels);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string>(generateUniqueId());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [openAIDialogOpen, setOpenAIDialogOpen] = useState(false);
  const [anthropicDialogOpen, setAnthropicDialogOpen] = useState(false);
  const [geminiDialogOpen, setGeminiDialogOpen] = useState(false);
  const [hasOpenAIKey, setHasOpenAIKey] = useState(false);
  const [hasAnthropicKey, setHasAnthropicKey] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const scrollViewRef = useRef<any>(null);

  // Load API keys and update model availability
  useEffect(() => {
    const loadApiKeys = async () => {
      const openAIKey = await getOpenAIKey();
      const anthropicKey = await getAnthropicKey();
      const geminiKey = await getGeminiKey();
      setHasOpenAIKey(!!openAIKey);
      setHasAnthropicKey(!!anthropicKey);
      setHasGeminiKey(!!geminiKey);
      // Update available models based on API keys
      const updatedModels = await refreshModelAvailability();
      setAvailableModels(updatedModels);
      
      // If the currently selected model is now disabled, select the first available model
      if (updatedModels.find(m => m.value === selectedModel.value)?.disabled) {
        const firstAvailableModel = updatedModels.find(m => !m.disabled);
        if (firstAvailableModel) {
          setSelectedModel(firstAvailableModel);
          setValue(firstAvailableModel.value);
          await saveLastUsedModel(firstAvailableModel.value);
        }
      }
    };
    
    loadApiKeys();
  }, [hasOpenAIKey, hasAnthropicKey, hasGeminiKey]);

  // Load conversations list
  useEffect(() => {
    const loadConversations = async () => {
      const conversations = await getConversations();
      setAllConversations(conversations);
    };
    
    loadConversations();
  }, [messages]); // Reload when messages change to keep list updated

  // Load initial state
  useEffect(() => {
    const loadInitialState = async () => {
      // Load last used model
      const lastModelId = await getLastUsedModel();
      if (lastModelId) {
        const lastModel = initialModels.find(m => m.value === lastModelId);
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
        const model = initialModels.find(m => m.value === conversation.model.value);
        if (model && !model.disabled) {
          setSelectedModel(model);
          setValue(model.value);
        }
      } else {
        // Create a new conversation with welcome message
        // const welcomeMessage: Message = {
        //   id: generateUniqueId(),
        //   isUser: false,
        //   text: 'Hello! How can I help you today?'
        // };
        setMessages([]);
        saveCurrentConversation([]);
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
      model: selectedModel
    };
    
    await saveConversation(conversation);
  };

  const handleModelSelect = (model: Model) => {
    setSelectedModel(model);
    saveLastUsedModel(model.value);
  };

  const handleSelectConversation = async (id: string) => {
    setConversationId(id);
  };
  
  const createNewConversation = () => {
    // Generate a new conversation ID
    const newId = generateUniqueId();
    // Reset the conversation
    setConversationId(newId);
    setMessages([]);
  };

  const handleConnectOpenAI = () => {
    setSettingsOpen(false);
    setOpenAIDialogOpen(true);
  };
  
  const handleConnectAnthropic = () => {
    setSettingsOpen(false);
    setAnthropicDialogOpen(true);
  };
  
  const handleSaveOpenAIKey = async (key: string) => {
    await saveOpenAIKey(key);
    setHasOpenAIKey(true);
    setOpenAIDialogOpen(false);
  };
  
  const handleSaveAnthropicKey = async (key: string) => {
    await saveAnthropicKey(key);
    setHasAnthropicKey(true);
    setAnthropicDialogOpen(false);
  };

  const handleConnectGemini = () => {
    setSettingsOpen(false);
    setGeminiDialogOpen(true);
  };
  
  const handleSaveGeminiKey = async (key: string) => {
    await saveGeminiKey(key);
    setHasGeminiKey(true);
    setGeminiDialogOpen(false);
  };

  const handleDeleteOpenAIKey = () => {
    Alert.alert(
      "Delete OpenAI Key", 
      "Are you sure you want to remove your OpenAI API key?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteOpenAIKey();
            setHasOpenAIKey(false);
          }
        }
      ]
    );
  };
  
  const handleDeleteAnthropicKey = () => {
    Alert.alert(
      "Delete Anthropic Key", 
      "Are you sure you want to remove your Anthropic API key?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteAnthropicKey();
            setHasAnthropicKey(false);
          }
        }
      ]
    );
  };

  const handleDeleteGeminiKey = () => {
    Alert.alert(
      "Delete Gemini Key", 
      "Are you sure you want to remove your Gemini API key?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteGeminiKey();
            setHasGeminiKey(false);
          }
        }
      ]
    );
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isStreaming) return;
    
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
      if (selectedModel.provider === 'openai') {
        const result = await streamChatCompletion(
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
          (modelMetrics: ModelMetrics) => {
            // Final update when streaming completes
            setIsStreaming(false);
            // Save the updated conversation
            setMessages(prev => {
              const updated = [...prev];
              const lastMessage = updated[updated.length - 1];
              lastMessage.text = lastMessage.text.trimEnd();
              lastMessage.metrics = modelMetrics;
              saveCurrentConversation(updated);
              return updated;
            });
          }
        );
        
      } else if (selectedModel.provider === 'anthropic') {
        const result = await streamAnthropicCompletion(
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
          (modelMetrics: ModelMetrics) => {
            // Final update when streaming completes
            setIsStreaming(false);
            // Save the updated conversation
            setMessages(prev => {
              const updated = [...prev];
              const lastMessage = updated[updated.length - 1];
              lastMessage.text = lastMessage.text.trimEnd();
              lastMessage.metrics = modelMetrics;
              saveCurrentConversation(updated);
              return updated;
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
      } else if (selectedModel.provider === 'google') {
        const result = await streamGeminiCompletion(
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
          (modelMetrics: ModelMetrics) => {
            // Final update when streaming completes
            setIsStreaming(false);  
            // Save the updated conversation
            setMessages(prev => {
              const updated = [...prev];
              const lastMessage = updated[updated.length - 1];
              lastMessage.text = lastMessage.text.trimEnd();
              lastMessage.metrics = modelMetrics;
              saveCurrentConversation(updated);
              return updated;
            });
          }
        );
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
      <ConversationSidebar
        isOpen={sidebarOpen}
        conversations={allConversations}
        onClose={() => setSidebarOpen(false)}
        onSelectConversation={handleSelectConversation}
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
              circular 
              size="$2" 
              chromeless 
              onPress={() => {
                if (open) setOpen(false);
                setSidebarOpen(true);
              }}
            />
            <ModelPicker
              open={open}
              value={value}
              setOpen={setOpen}
              setValue={setValue}
              onSelectModel={handleModelSelect}
              zIndex={50}
              models={availableModels}
            />
            <Button 
              icon={Settings} 
              circular 
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
            <Button 
              icon={Send}
              onPress={sendMessage}
              disabled={isStreaming || !inputText.trim()}
              opacity={isStreaming || !inputText.trim() ? 0.5 : 1}
            />
          </XStack>
        </YStack>
      </KeyboardAvoidingView>
      
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onConnectOpenAI={handleConnectOpenAI}
        onConnectAnthropic={handleConnectAnthropic}
        onConnectGemini={handleConnectGemini}
        onDeleteOpenAI={handleDeleteOpenAIKey}
        onDeleteAnthropic={handleDeleteAnthropicKey}
        onDeleteGemini={handleDeleteGeminiKey}
        hasOpenAIKey={hasOpenAIKey}
        hasAnthropicKey={hasAnthropicKey}
        hasGeminiKey={hasGeminiKey}
      />
      
      <ApiKeyDialog
        open={openAIDialogOpen}
        provider="OpenAI"
        onClose={() => setOpenAIDialogOpen(false)}
        onSave={handleSaveOpenAIKey}
      />
      
      <ApiKeyDialog
        open={anthropicDialogOpen}
        provider="Anthropic"
        onClose={() => setAnthropicDialogOpen(false)}
        onSave={handleSaveAnthropicKey}
      />

      <ApiKeyDialog
        open={geminiDialogOpen}
        provider="Google"
        onClose={() => setGeminiDialogOpen(false)}
        onSave={handleSaveGeminiKey}
      />
    </SafeAreaView>
  );
}