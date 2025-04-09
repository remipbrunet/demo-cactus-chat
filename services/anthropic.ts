import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicKey } from './storage';
import { Message } from './openai';

// Dynamic client creation based on stored key
async function getAnthropicClient(): Promise<Anthropic | null> {
  const apiKey = await getAnthropicKey();
  if (!apiKey) return null;
  
  return new Anthropic({
    apiKey,
  });
}

export async function streamAnthropicCompletion(
  messages: Message[],
  model: string,
  onProgress: (text: string) => void,
  onComplete: (fullText: string) => void
) {
  try {
    // Get Anthropic client with stored API key
    const anthropic = await getAnthropicClient();
    if (!anthropic) {
      throw new Error('Anthropic API key not found. Please add your API key in settings.');
    }
    
    const response = await anthropic.messages.create({
      model,
      system: 'You are a helpful AI assistant called Claude.',
      messages: messages.map(msg => ({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.text
      })),
      max_tokens: 1024
    });

    // Handle text blocks only
    const textBlock = response.content.find(block => block.type === 'text');
    const responseText = textBlock?.text || '';
    
    onProgress(responseText);
    onComplete(responseText);
    return responseText;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}