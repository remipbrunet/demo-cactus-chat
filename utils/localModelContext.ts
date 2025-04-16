import { initLlama, LlamaContext } from 'llama.rn';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Model } from '@/services/models';

interface loadedContext {
    context: LlamaContext | null,
    modelValue: string
}

let loadedContext: loadedContext = {
    context: null,
    modelValue: ''
};

// Initialize Llama context for specific model
export const ensureLocalModelContext = async (model: Model): Promise<LlamaContext | null> => {

  // If we already have a context, return it
  if (loadedContext && loadedContext.modelValue === model.value) {
    return loadedContext.context
  }

  if (model.isLocal) {
    if (model && (await FileSystem.getInfoAsync(model.meta?.filePath)).exists) {
      console.log(`Initializing local model: ${model.value}`);
      loadedContext.modelValue = model.value;
      loadedContext.context = await initLlama({
        model: model.meta?.filePath,
        use_mlock: true,
        n_ctx: 2048,
        n_gpu_layers: Platform.OS === 'ios' ? 99 : 0
      });
      console.log(`Local model initialized: ${model.value}`);
      return loadedContext.context;
    }
    
    throw new Error(`Local model not found: ${model.value}`);
  }

  return loadedContext.context
}