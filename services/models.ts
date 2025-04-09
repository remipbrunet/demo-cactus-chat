import { getOpenAIKey, getAnthropicKey } from './storage';

export interface Model {
  value: string;
  label: string;
  provider: 'openai' | 'cactus' | 'anthropic';
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

export const models: Model[] = [
  // we use value as the unique identifier for all models
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
    value: 'cactus-7b',
    label: 'Cactus Private 7B',
    provider: 'cactus',
    disabled: true
  }
];

// Function to refresh model availability
export async function refreshModelAvailability(): Promise<Model[]> {
  const openAIAvailable = await isOpenAIAvailable();
  const anthropicAvailable = await isAnthropicAvailable();
  
  const updatedModels = models.map(model => ({
    ...model,
    disabled: model.provider === 'openai' ? !openAIAvailable : 
              model.provider === 'anthropic' ? !anthropicAvailable :
              model.disabled
  }));
  
  return updatedModels;
} 