import { getLocalModels } from '@/services/storage';
import { initLlama, LlamaContext } from 'llama.rn';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

interface loadedContext {
    context: LlamaContext | null,
    modelId: string
}

let loadedContext: loadedContext = {
    context: null,
    modelId: ''
};

// Initialize Llama context for specific model
export const ensureLocalModelContext = async (modelId: string): Promise<LlamaContext | null> => {

  // If we already have a context, return it
  if (loadedContext && loadedContext.modelId === modelId) {
    return loadedContext.context
  }

  if (modelId?.startsWith('local-')) {
    const localModelId = modelId.replace('local-', '');
    const localModels = await getLocalModels();
    const model = localModels.find(m => m.id === localModelId);
    
    if (model && (await FileSystem.getInfoAsync(model.filePath)).exists) {
      console.log(`Initializing local model: ${model.name}`);
      loadedContext.modelId = modelId;
      loadedContext.context = await initLlama({
        model: model.filePath,
        use_mlock: true,
        n_ctx: 2048,
        n_gpu_layers: Platform.OS === 'ios' ? 99 : 0
      });
      console.log(`Local model initialized: ${model.name}`);
      return loadedContext.context;
    }
    
    throw new Error(`Local model not found: ${modelId}`);
  }

  return loadedContext.context
}