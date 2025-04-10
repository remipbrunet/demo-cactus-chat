import { getOpenAIKey, getAnthropicKey, getGeminiKey } from './storage';

export interface Model {
  value: string;
  label: string;
  provider: 'openai' | 'cactus' | 'anthropic' | 'google';
  disabled: boolean;
}

// Check provider availability functions
export async function isOpenAIAvailable(): Promise<boolean> {
  const key = await getOpenAIKey();
  return !!key;
}

export async function isAnthropicAvailable(): Promise<boolean> {
  const key = await getAnthropicKey();
  return !!key;
}

export async function isGeminiAvailable(): Promise<boolean> {
  const key = await getGeminiKey();
  return !!key;
}

export const models: Model[] = [
  // we use value as the unique identifier for all models
  {
    value: 'cactus-7b',
    label: 'Cactus Private 7B',
    provider: 'cactus',
    disabled: true
  },
  {
    value: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    provider: 'openai',
    disabled: false
  },
  {
    value: 'claude-3-haiku-20240307',
    label: 'Claude 3 Haiku',
    provider: 'anthropic',
    disabled: false
  },
  {
    value: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    provider: 'google',
    disabled: false
  }
];

// Function to refresh model availability
export async function refreshModelAvailability(): Promise<Model[]> {
  const openAIAvailable = await isOpenAIAvailable();
  const anthropicAvailable = await isAnthropicAvailable();
  const geminiAvailable = await isGeminiAvailable();
  
  const updatedModels = models.map(model => ({
    ...model,
    disabled: model.provider === 'openai' ? !openAIAvailable : 
              model.provider === 'anthropic' ? !anthropicAvailable :
              model.provider === 'google' ? !geminiAvailable :
              model.disabled
  }));
  
  return updatedModels;
} 