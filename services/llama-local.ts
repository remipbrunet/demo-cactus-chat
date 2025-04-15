import { initLlama } from 'llama.rn';
import { Message } from '@/components/ChatMessage';
import { ModelMetrics } from '@/utils/modelMetrics';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { getLocalModels } from './storage';
import { ensureLocalModelContext } from '@/utils/localModelContext';
// Global context to avoid reinitializing
let llamaContext: any = null;

// // Default small model to download
// const DEFAULT_MODEL = {
//   name: 'TinyLlama-1.1B-Chat-v1.0',
//   url: 'https://huggingface.co/unsloth/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q4_K_M.gguf',
//   fileName: 'gemma-3-4b-it-Q4_K_M.gguf'
// };

// Initialize Llama context for specific model
// async function ensureLlamaContext(modelId?: string) {
//   if (llamaContext) return llamaContext;
//   // If we have a specific model ID that starts with "local-", use that local model
//   if (modelId?.startsWith('local-')) {
//     const localModelId = modelId.replace('local-', '');
//     const localModels = await getLocalModels();
//     const model = localModels.find(m => m.id === localModelId);
    
//     if (model && (await FileSystem.getInfoAsync(model.filePath)).exists) {
//       console.log(`Initializing local model: ${model.name}`);
//       llamaContext = await initLlama({
//         model: model.filePath,
//         use_mlock: true,
//         n_ctx: 2048,
//         n_gpu_layers: Platform.OS === 'ios' ? 99 : 0
//       });
//       return llamaContext;
//     }
    
//     throw new Error(`Local model not found: ${modelId}`);
//   }
  
//   try {
//     // Get model path
//     const modelDir = Platform.OS === 'ios' ? FileSystem.documentDirectory + 'local-models/' : FileSystem.cacheDirectory + 'local-models/';
//     await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true }).catch(() => {});
//     const modelPath = modelDir + DEFAULT_MODEL.fileName;
    
//     // Download if needed
//     if (!(await FileSystem.getInfoAsync(modelPath)).exists) {
//       console.log(`Downloading ${DEFAULT_MODEL.name}...`);
//       await FileSystem.createDownloadResumable(DEFAULT_MODEL.url, modelPath, {}, 
//         p => process.stdout.write(`\rDownload: ${Math.round(p.totalBytesWritten / p.totalBytesExpectedToWrite * 100)}%`)
//       ).downloadAsync();
//       process.stdout.write('\n'); // Add newline after download completes
//     }
    
//     // Initialize Llama
//     console.log('Initializing Llama...');
//     llamaContext = await initLlama({
//       model: modelPath,
//       use_mlock: true,
//       n_ctx: 2048,
//       n_gpu_layers: Platform.OS === 'ios' ? 99 : 0
//     });
//     return llamaContext;
//   } catch (error) {
//     console.error('Error:', error);
//     throw error;
//   }
// }

export async function streamLlamaCompletion(
  messages: Message[],
  modelValue: string,
  onProgress: (text: string) => void,
  onComplete: (modelMetrics: ModelMetrics) => void,
  streaming: boolean = true
) {
  try {
    console.log('Ensuring Llama context...', new Date().toISOString());
    const context = await ensureLocalModelContext(modelValue);
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