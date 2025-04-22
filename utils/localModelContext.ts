// import { initLlama, LlamaContext } from 'llama.rn';
// import { initLlama, LlamaContext } from 'cactus-rn';
import { initLlama, LlamaContext } from 'cactus-rn-2';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Model } from '@/services/models';
import { logModelLoadDiagnostics } from '@/services/diagnostics';
import { getFullModelPath } from '@/services/storage';

interface LoadedContext {
    context: LlamaContext | null,
    modelValue: string
}

let loadedContext: LoadedContext = {
    context: null,
    modelValue: ''
};

// Initialize Llama context for specific model
export const ensureLocalModelContext = async (model: Model): Promise<LlamaContext | null> => {

  // If we already have a context, return it
  // console.log('ensuring local model context', model.value);
  if (loadedContext && loadedContext.modelValue === model.value) {
    return loadedContext.context
  }
  // console.log('loading new...', model);

  if (model.isLocal) {
    const modelPath = getFullModelPath(model.meta?.fileName || '');
    if (model && (await FileSystem.getInfoAsync(modelPath)).exists) {
      // console.log(`Initializing local model: ${model.value} from ${modelPath}`);
      loadedContext.modelValue = model.value;

      const startTime = performance.now();
      loadedContext.context = await initLlama({
        model: modelPath,
        use_mlock: true,
        n_ctx: 2048,
        n_gpu_layers: Platform.OS === 'ios' ? 99 : 0
      });
      const endTime = performance.now();
      logModelLoadDiagnostics({model: model.value, loadTime: endTime - startTime});

      // console.log(`Local model initialized: ${model.value}`);
      return loadedContext.context;
    }
    
    // throw new Error(`Local model not found: ${model.value}`);
  }

  return loadedContext.context
}