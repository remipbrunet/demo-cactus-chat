import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message } from './openai';

// Conversation structure
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: number;
  modelId: string;
}

// Store structure - a simple dictionary of conversations by ID
interface ConversationsStore {
  [id: string]: Conversation;
}

// Keys for AsyncStorage
const STORAGE_KEY = '@cactus_conversations';
const LAST_MODEL_KEY = '@last_used_model';

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