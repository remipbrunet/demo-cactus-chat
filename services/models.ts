import {  getLocalModels, getModelsAvailableToDownload, saveModelsAvailableToDownload } from './storage';
import { supabase } from './supabase';
import { getTotalMemory } from 'react-native-device-info';

// export type Provider = 'OpenAI' | 'Cactus' | 'Anthropic' | 'Google';
export type Provider = 'Cactus'
export type InferenceHardware = 'cpu' | 'gpu'

export interface Model {
  value: string; // used as unique ID and display name
  label: string; 
  provider: Provider; // deprecated
  disabled: boolean; // deprecated | unused?
  isLocal: boolean; // deprecated
  meta?: Record<string, any>; 
}

export interface ModelAvailableToDownload {
  name: string; // basically, Model.value
  comment: string; // doesn't exist on Model, but we can add as optional
  downloadUrl: string; // convert to downloadUrls in DownloadMeta
  default: boolean; // convert to downloadUrls in DownloadMeta
}

// Default recommended models with tool calling support
const DEFAULT_TOOL_CALLING_MODELS: ModelAvailableToDownload[] = [
  {
    name: 'Hammer2.1-1.5B',
    comment: '🔨 Advanced tool calling model (1.5B, Q4_K_M) - Excellent for MCP',
    downloadUrl: 'https://huggingface.co/Melvin56/Hammer2.1-1.5b-GGUF/resolve/main/hammer2.1-1.5b-Q4_K_M.gguf',
    default: false,
  },
  {
    name: 'Llama-3.2-1B-Tool-Calling-V2',
    comment: '🔧 Tool calling model (1B, Q5_K_M) - Optimized for MCP',
    downloadUrl: 'https://huggingface.co/mav23/Llama_3.2_1B_Intruct_Tool_Calling_V2-GGUF/resolve/main/llama_3.2_1b_intruct_tool_calling_v2.Q5_K_M.gguf',
    default: false,
  },
  // Keep existing Qwen models for general chat
  {
    name: 'Qwen2.5-0.5B-Instruct',
    comment: 'Smallest general chat model (0.5B, Q6_K)',
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q6_k.gguf',
    default: true,
  },
  {
    name: 'Qwen2.5-1.5B-Instruct',
    comment: 'Balanced general chat model (1.5B, Q6_K)',
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q6_k.gguf',
    default: false,
  },
];

export async function fetchModelsAvailableToDownload(): Promise<ModelAvailableToDownload[]> {
  const availableMemory = await getTotalMemory() / (2**30)
  const {data, error} = await supabase.from('available_models').select('*')
  
  if (error || !data) {
    // If Supabase fails, return our default tool-calling models
    const cachedModels = await getModelsAvailableToDownload();
    if (cachedModels && cachedModels.length > 0) {
      return cachedModels;
    }
    // Return default tool-calling models if no cached models
    saveModelsAvailableToDownload(DEFAULT_TOOL_CALLING_MODELS);
    return DEFAULT_TOOL_CALLING_MODELS;
  } else {
    const modelsAvailableToDownload: ModelAvailableToDownload[] = data.filter((model: any) => model.recommended_ram_gb || 0 <= availableMemory).map((model: any) => ({
      name: model.name,
      comment: model.comment,
      downloadUrl: model.download_url,
      default: model.is_default,
    }));
    
    // If we got models from Supabase but they don't include tool-calling models, add them
    const hasToolCallingModels = modelsAvailableToDownload.some(m => 
      m.name.toLowerCase().includes('tool') || 
      m.name.toLowerCase().includes('function') ||
      m.name.toLowerCase().includes('xlam') ||
      m.name.toLowerCase().includes('arch-function')
    );
    
    if (!hasToolCallingModels) {
      // Prepend tool-calling models to the list
      const combinedModels = [...DEFAULT_TOOL_CALLING_MODELS.slice(0, 3), ...modelsAvailableToDownload];
      saveModelsAvailableToDownload(combinedModels);
      return combinedModels;
    }
    
    saveModelsAvailableToDownload(modelsAvailableToDownload);
    return modelsAvailableToDownload;
  }
};