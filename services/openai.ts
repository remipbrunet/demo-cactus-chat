import OpenAI from 'openai';
import { OPENAI_API_KEY } from '@env';

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true, // For client-side usage (replace with server-side in production)
});

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
    
    // Format messages for the OpenAI API
    const formattedMessages = [
      { role: 'system' as const, content: 'You are a helpful AI assistant called ChatGPT.' },
      ...messages.map(msg => ({
        role: msg.isUser ? 'user' as const : 'assistant' as const,
        content: msg.text
      }))
    ];

    console.log('API Key available:', !!OPENAI_API_KEY);
    
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