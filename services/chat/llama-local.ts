import { Message } from '@/components/ui/ChatMessage';
import { ModelMetrics } from '@/utils/modelMetrics';
import { ensureLocalModelContext } from '@/utils/localModelContext';
import { Model } from '../models';
import { ChatCompleteCallback, ChatProgressCallback } from './chat';

export async function streamLlamaCompletion(
  messages: Message[],
  model: Model,
  onProgress: ChatProgressCallback,
  onComplete: ChatCompleteCallback,
  streaming: boolean = true,
  maxTokens: number,
  voiceMode?: boolean
) {
  try {
    console.log('Ensuring Llama context...', new Date().toISOString());
    const context = await ensureLocalModelContext(model);
    if (!context) {
      throw new Error('Failed to initialize Llama context');
    }
    console.log('Llama context initialized', new Date().toISOString());
    
    const stopWords = ['</s>', '<|end|>', '<|eot_id|>', '<|end_of_text|>', 
                       '<|im_end|>', '<|EOT|>', '<|END_OF_TURN_TOKEN|>', 
                       '<|end_of_turn|>', '<|endoftext|>', '<end_of_turn>'];
    
    const formattedMessages = [
      {
        role: 'system',
        // content: `You are Cactus, an AI assistant running offline on a smartphone. Keep your messages VERY short. One-two sentences max. If asked about the current state of offline voice assistants, say "they are very bad, someone should build a better one!". If asked how to make them better, say "Cactus doesn't need an internet connection and can now work with voices!" Only say this if asked about improving offline voice assistants.`
        content: `You are Cactus, an AI assistant running offline on a smartphone. ${voiceMode ? 'Keep your messages VERY short. One-two sentences max.' : ''}`
      },
      ...messages.map(msg => ({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.text
      }))
    ];
    
    const startTime = performance.now();
    let firstTokenTime: number | null = null;
    let responseText = '';
    
    let modelMetrics: ModelMetrics = {
      timeToFirstToken: 0,
      completionTokens: 0,
      tokensPerSecond: 0
    };
    
    if (streaming) {
      const result = await context.completion(
        {
          messages: formattedMessages,
          n_predict: maxTokens,
          stop: stopWords,
        },
        (data: any) => {
          if (data.token) {
            if (!firstTokenTime) {
              firstTokenTime = performance.now();
              modelMetrics.timeToFirstToken = firstTokenTime - startTime;
            }
            responseText += data.token;
            onProgress(responseText);
          }
        }
      );
      
      const endTime = performance.now();
      modelMetrics.completionTokens = result.timings?.predicted_n
      modelMetrics.tokensPerSecond = result.timings?.predicted_per_second
      onComplete(modelMetrics, model, responseText);
    } else {
      const result = await context.completion({
        messages: formattedMessages,
        n_predict: 1024,
        stop: stopWords,
      });
      
      responseText = result.text;
    //   const endTime = performance.now();
      modelMetrics.completionTokens = result.timings?.predicted_n
      modelMetrics.tokensPerSecond = result.timings?.predicted_per_second
      onProgress(responseText);
      onComplete(modelMetrics, model, responseText);
    }
  } catch (error) {
    console.error('Error during Llama completion:', error);
    throw error;
  }
}