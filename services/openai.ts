import OpenAI from 'openai';
import { getOpenAIKey } from './storage';

// Dynamic client creation based on stored key
async function getOpenAIClient(): Promise<OpenAI | null> {
  const apiKey = await getOpenAIKey();
  if (!apiKey) return null;
  
  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true, // For client-side usage
  });
}

export interface Message {
  id: string;
  isUser: boolean;
  text: string;
}

export async function streamChatCompletion(
  messages: Message[],
  model: string = 'gpt-3.5-turbo',
  onProgress: (text: string) => void,
  onComplete: (fullText: string) => void
) {
  try {
    console.log('Starting OpenAI request with model:', model);
    
    // Get OpenAI client with stored API key
    const openai = await getOpenAIClient();
    if (!openai) {
      throw new Error('OpenAI API key not found. Please add your API key in settings.');
    }
    
    // Format messages for the OpenAI API
    const formattedMessages = [
      { role: 'system' as const, content: 'You are a helpful AI assistant called ChatGPT.' },
      ...messages.map(msg => ({
        role: msg.isUser ? 'user' as const : 'assistant' as const,
        content: msg.text
      }))
    ];

    // Create the chat completion without streaming
    const response = await openai.chat.completions.create({
      model,
      messages: formattedMessages,
      stream: false,
    });

    console.log('Response received:', response.id);
    
    // Get the response text
    const responseText = response.choices[0]?.message?.content || '';
    
    // Simulate progressive updates with the full response
    onProgress(responseText);
    
    // Complete the response
    onComplete(responseText);
    return responseText;
  } catch (error) {
    console.error('Error during chat completion:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

export function generateUniqueId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
} 