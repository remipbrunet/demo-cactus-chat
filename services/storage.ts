import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message } from '@/components/ChatMessage';
import { Model } from '@/services/models';
// Conversation structure
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: number;
  model: Model;
}

// Store structure - a simple dictionary of conversations by ID
interface ConversationsStore {
  [id: string]: Conversation;
}

// Keys for AsyncStorage
const STORAGE_KEY = '@cactus_conversations';
const LAST_MODEL_KEY = '@last_used_model';
// const OPENAI_API_KEY = '@cactus_openai_api_key';
// const ANTHROPIC_API_KEY = '@cactus_anthropic_api_key';
// const GEMINI_API_KEY = '@cactus_gemini_api_key';

// Save a single conversation
export async function saveConversation(conversation: Conversation): Promise<void> {
  try {
    // Get existing data
    const existingData = await AsyncStorage.getItem(STORAGE_KEY);
    const conversations: ConversationsStore = existingData ? JSON.parse(existingData) : {};
    
    // Add or update conversation
    conversations[conversation.id] = conversation;
    
    // Save back to storage
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.error('Error saving conversation:', error);
  }
}

// Get all conversations
export async function getConversations(): Promise<Conversation[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    const conversations: ConversationsStore = data ? JSON.parse(data) : {};
    return Object.values(conversations).sort((a, b) => b.lastUpdated - a.lastUpdated);
  } catch (error) {
    console.error('Error loading conversations:', error);
    return [];
  }
}

// Get a single conversation
export async function getConversation(id: string): Promise<Conversation | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    const conversations: ConversationsStore = data ? JSON.parse(data) : {};
    return conversations[id] || null;
  } catch (error) {
    console.error('Error loading conversation:', error);
    return null;
  }
}

// Delete a conversation
export async function deleteConversation(id: string): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    const conversations: ConversationsStore = data ? JSON.parse(data) : {};
    
    if (conversations[id]) {
      delete conversations[id];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    }
  } catch (error) {
    console.error('Error deleting conversation:', error);
  }
}

// Save the last used model ID
export async function saveLastUsedModel(modelId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_MODEL_KEY, modelId);
  } catch (error) {
    console.error('Error saving last model:', error);
  }
}

// Get the last used model ID
export async function getLastUsedModel(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_MODEL_KEY);
  } catch (error) {
    console.error('Error loading last model:', error);
    return null;
  }
}

function fetchProviderKeyStoreName(provider: string): string {
  return `@cactus_${provider.toLowerCase()}_api_key`;
}

export async function saveApiKey(provider: string, key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(fetchProviderKeyStoreName(provider), key);
    console.log(`${provider} key saved`);
  } catch (error) {
    console.error(`Error saving ${provider} key:`, error);
  }
}

export async function getApiKey(provider: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(fetchProviderKeyStoreName(provider));
  } catch (error) {
    console.error(`Error loading ${provider} key:`, error);
    return null;
  }
}

export async function deleteApiKey(provider: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(fetchProviderKeyStoreName(provider));
  } catch (error) {
    console.error(`Error deleting ${provider} key:`, error);
  }
}