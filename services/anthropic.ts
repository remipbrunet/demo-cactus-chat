import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicKey } from './storage';
import { Message } from '@/components/ChatMessage';
import { ModelMetrics } from '@/utils/modelMetrics';
import EventSource from 'react-native-sse';
// import { measureModelPerformance, estimateTokenCount } from '../utils/modelMetrics';

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
  onComplete: () => void,
  streaming: boolean = true
) {
  try {
    // const apiKey = await getAnthropicKey();
    // if (!apiKey) {
    //   throw new Error('Anthropic API key not found. Please add your API key in settings.');
    // }

    // const formattedMessages = [
    //   ...messages.map(msg => ({
    //     role: msg.isUser ? 'user' as const : 'assistant' as const,
    //     content: msg.text
    //   }))
    // ]

    // const startTime = performance.now();
    // let firstTokenTime: number | null = null;

    // let modelMetrics: ModelMetrics = {
    //   timeToFirstToken: 0,
    //   completionTokens: 0,
    //   tokensPerSecond: 0
    // }

    // if (streaming) {

    //   const payload = {
    //     model,
    //     max_tokens: 1024,
    //     system: 'You are a helpful AI assistant called Claude.',
    //     messages: formattedMessages,
    //     stream: true,
    //   }

    //   const es = new EventSource('https://api.anthropic.com/v1/messages', {
    //     headers: {
    //       'x-api-key': apiKey,
    //       'anthropic-version': '2023-06-01',
    //       'Content-Type': 'application/json'
    //     },
    //     method: 'POST',
    //     body: JSON.stringify(payload),
    //     pollingInterval: 0
    //   })

    //   let responseText = '';

    //   const listener = (event: any) => {
    //     if (event.type === 'open') {
    //       console.log('Open SSE connection.')
    //     } else{
    //       console.log('Message', event.type, event)
    //     }
    //   }

    //   es.addEventListener('open', listener)
    //   es.addEventListener('message', listener)
    //   es.addEventListener('error', listener)
    //   es.addEventListener('close', listener)
    //   return () => {
    //     es.removeAllEventListeners()
    //     es.close()
    //   }
    // }

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
    
    // Pass the response with metrics to callbacks
    onProgress(responseText);
    onComplete();
    
    return { 
      text: responseText, 
      // metrics 
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}