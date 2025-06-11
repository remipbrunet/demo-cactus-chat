// // import { initLlama, LlamaContext } from 'llama.rn';
// import { initLlama, LlamaContext, releaseAllLlama } from 'cactus-react-native'
// import { Platform } from 'react-native';
// import * as FileSystem from 'expo-file-system';
// import { InferenceHardware, Model } from '@/services/models';
// import { logModelLoadDiagnostics } from '@/services/diagnostics';
// import { getFullModelPath, getInferenceHardware } from '@/services/storage';

// interface LoadedContext {
//     context: LlamaContext | null,
//     modelValue: string,
//     inferenceHardware: InferenceHardware[]
// }

// export let loadedContext: LoadedContext = {
//     context: null,
//     modelValue: '',
//     inferenceHardware: []
// };

// Initialize Llama context for specific model
// export const ensureLocalModelContext = async (
//   model: Model,
//   inferenceHardware: InferenceHardware[]
// ): Promise<LlamaContext | null> => {

//   if (loadedContext && 
//     loadedContext.modelValue === model.value && 
//     loadedContext.inferenceHardware === inferenceHardware
//   ) return loadedContext.context

//   if (model.isLocal) {
//     await releaseAllLlama();
//     const modelPath = getFullModelPath(model.meta?.fileName || '');
//     if (model && (await FileSystem.getInfoAsync(modelPath)).exists) {
//       loadedContext.modelValue = model.value;
//       const inferenceHardwareChoice = await getInferenceHardware()
//       const gpuLayers = Platform.OS === 'ios' && inferenceHardwareChoice.includes('gpu') ? 99 : 0

//       console.log(`Inference hardware: ${inferenceHardwareChoice}, layers: ${gpuLayers}`)

//       const startTime = performance.now();
//       loadedContext.context = await initLlama({
//         model: modelPath,
//         use_mlock: true,
//         n_ctx: 2048,
//         n_gpu_layers: gpuLayers
//       });
//       const endTime = performance.now();
//       logModelLoadDiagnostics({model: model.value, loadTime: endTime - startTime});

//       // console.log(`Local model initialized: ${model.value}`);
//       return loadedContext.context;
//     }
    
//     // throw new Error(`Local model not found: ${model.value}`);
//   }

//   return loadedContext.context
// }