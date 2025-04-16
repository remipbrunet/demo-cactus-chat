import { getApiKey, getLocalModels } from './storage';

export type Provider = 'OpenAI' | 'Cactus' | 'Anthropic' | 'Google';

export interface Model {
  value: string;
  label: string;
  provider: Provider;
  disabled: boolean;
  isLocal: boolean;
  meta?: Record<string, any>;
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
  }));

  const localModels = await getLocalModels();

  return [...updatedModels, ...localModels];
} 