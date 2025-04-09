import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '@env';
import { Message } from './openai';

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY || ''
});

export async function streamAnthropicCompletion(
  messages: Message[],
  model: string,
  onProgress: (text: string) => void,
  onComplete: (fullText: string) => void
) {
  try {
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