import { streamOpenAICompletion } from './openai';
import { streamAnthropicCompletion } from './anthropic';
import { streamGeminiCompletion } from './gemini';
import { streamLlamaCompletion } from './llama-local';
import { Message } from '@/components/ChatMessage';
import { Model } from './models';
import { ModelMetrics } from '@/utils/modelMetrics';
// Define unified interfaces
export interface ChatProgressCallback {
  (text: string): void;
}

export interface ChatCompleteCallback {
  (metrics: ModelMetrics): void;
}

export interface ChatOptions {
  streaming?: boolean;
}

/**
 * Unified chat service that handles all providers
 */
export async function sendChatMessage(
  messages: Message[],
  model: Model,
  onProgress: ChatProgressCallback,
  onComplete: ChatCompleteCallback,
  options: ChatOptions = { streaming: true }
): Promise<void> {
  try {
    switch (model.provider) {
      case 'openai':
        return await streamOpenAICompletion(
          messages, 
          model.value, 
          onProgress, 
          onComplete, 
          options.streaming
        );
        
      case 'anthropic':
        return await streamAnthropicCompletion(
          messages, 
          model.value, 
          onProgress, 
          onComplete, 
          options.streaming
        );
        
      case 'google':
        return await streamGeminiCompletion(
          messages, 
          model.value, 
          onProgress, 
          onComplete, 
          options.streaming
        );
        
      case 'cactus':
        return await streamLlamaCompletion(
          messages, 
          model.value, 
          onProgress, 
          onComplete, 
          options.streaming
        );
        
      default:
        throw new Error(`Unknown provider: ${model.provider}`);
    }
  } catch (error) {
    console.error(`Chat service error with ${model.provider}:`, error);
    throw error;
  }
}

/**
 * Generates message metadata for tracking and storage
 */
export function createMessageMetadata(isUser: boolean, model: Model): Pick<Message, 'id' | 'isUser' | 'model'> {
  return {
    id: generateUniqueId(),
    isUser,
    model
  };
}

/**
 * Generate a unique ID for messages and conversations
 */
export function generateUniqueId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}