import { getApiKey, getLocalModels, getModelsAvailableToDownload, saveModelsAvailableToDownload } from './storage';
import { supabase } from './supabase';

export type Provider = 'OpenAI' | 'Cactus' | 'Anthropic' | 'Google';

export interface Model {
  value: string;
  label: string;
  provider: Provider;
  disabled: boolean;
  isLocal: boolean;
  meta?: Record<string, any>;
}

export interface ModelAvailableToDownload {
  name: string;
  comment: string;
  downloadUrl: string;
  default: boolean;
}

// Check provider availability functions
export async function isOpenAIAvailable(): Promise<boolean> {
  const key = await getApiKey('OpenAI');
  return !!key;
}

export async function isAnthropicAvailable(): Promise<boolean> {
  const key = await getApiKey('Anthropic');
  return !!key;
}

export async function isGeminiAvailable(): Promise<boolean> {
  const key = await getApiKey('Google');
  return !!key;
}

export const models: Model[] = [ // we use value as the unique identifier for all models!!!
  {
    value: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    provider: 'OpenAI',
    disabled: false,
    isLocal: false
  },
  {
    value: 'claude-3-haiku-20240307',
    label: 'Claude 3 Haiku',
    provider: 'Anthropic',
    disabled: false,
    isLocal: false
  },
  {
    value: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    provider: 'Google',
    disabled: false,
    isLocal: false
  }
];

export async function refreshModelAvailability(): Promise<Model[]> {
  const openAIAvailable = await isOpenAIAvailable();
  const anthropicAvailable = await isAnthropicAvailable();
  const geminiAvailable = await isGeminiAvailable();
  
  const updatedModels = models.map(model => ({
    ...model,
    disabled: model.provider === 'OpenAI' ? !openAIAvailable : 
              model.provider === 'Anthropic' ? !anthropicAvailable :
              model.provider === 'Google' ? !geminiAvailable :
              model.disabled
  })).filter(model => !model.disabled);

  const localModels = await getLocalModels();

  return [...updatedModels, ...localModels];
} 

// fetch models available to download. The order of priority is:
// 1. models from supabase (if available, we update the local storage)
// 2. models from local storage
// 3. fallback models
export async function fetchModelsAvailableToDownload(): Promise<ModelAvailableToDownload[]> {
  const fallbackModels: ModelAvailableToDownload[] = [
    {
      name: "SmolLM 135M",
      comment: "(fast but stupid)",
      downloadUrl: "https://huggingface.co/unsloth/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q8_0.gguf",
      default: false,
    },
    {
      name: "Qwen 1.5B",
      comment: "(best quality)",
      downloadUrl: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q8_0.gguf",
      default: true,
    },
    {
      name: "Gemma 3 1B",
      comment: "(faster, less intelligent)",
      downloadUrl: "https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q8_0.gguf",
      default: false,
    }
  ]
  const {data, error} = await supabase.from('available_models').select('*')
  if (error || !data) {
    getModelsAvailableToDownload().then((models) => {
      return models || fallbackModels;
      });
    } else {
      const modelsAvailableToDownload = data.map((model: any) => ({
        name: model.name,
        comment: model.comment,
        downloadUrl: model.download_url,
        default: model.is_default,
      }));
      saveModelsAvailableToDownload(modelsAvailableToDownload);
      return modelsAvailableToDownload;
    }
  return fallbackModels
};