import { Message } from '@/components/ChatMessage';
import { ModelMetrics } from '@/utils/modelMetrics';
import { ensureLocalModelContext } from '@/utils/localModelContext';
import { Model } from './models';

export async function streamLlamaCompletion(
  messages: Message[],
  model: Model,
  onProgress: (text: string) => void,
  onComplete: (modelMetrics: ModelMetrics) => void,
  streaming: boolean = true
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
        content: 'You are a helpful AI assistant.'
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
          n_predict: 256,
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
      onComplete(modelMetrics);
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
      onComplete(modelMetrics);
    }
  } catch (error) {
    console.error('Error during Llama completion:', error);
    throw error;
  }
}