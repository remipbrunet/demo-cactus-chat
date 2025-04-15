import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiKey, getLocalModels, LocalModel } from './storage';
import * as FileSystem from 'expo-file-system';

export interface Model {
  value: string;
  label: string;
  provider: 'openai' | 'cactus' | 'anthropic' | 'google';
  disabled: boolean;
  meta?: Record<string, any>;
}

// Check provider availability functions
export async function isOpenAIAvailable(): Promise<boolean> {
  const key = await getApiKey('openai');
  return !!key;
}

export async function isAnthropicAvailable(): Promise<boolean> {
  const key = await getApiKey('anthropic');
  return !!key;
}

export async function isGeminiAvailable(): Promise<boolean> {
  const key = await getApiKey('gemini');
  return !!key;
}

export const models: Model[] = [
  // we use value as the unique identifier for all models
  // {
  //   value: 'cactus-7b',
  //   label: 'Cactus Private 7B',
  //   provider: 'cactus',
  //   disabled: false
  // },
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
  
  // Add local models
  const localModels = await getLocalModels();
  // const localModelEntries = await Promise.all(
  //   localModels.map(async model => {
  //     // Check if file exists
  //     const fileInfo = await FileSystem.getInfoAsync(model.filePath);
  //     console.log('fileInfo', new Date().toISOString(), fileInfo);
  //     return {
  //       value: `local-${model.id}`,
  //       label: model.name,
  //       provider: 'cactus' as const,
  //       disabled: !fileInfo.exists,
  //       meta: { filePath: model.filePath, local: true }
  //     };
  //   })
  // );
  const localModelEntries = localModels.map(model => ({
    value: `local-${model.id}`,
    label: model.name,
    provider: 'cactus' as const,
    disabled: !model.filePath,
    meta: { filePath: model.filePath, local: true }
  }));
  
  return [...updatedModels, ...localModelEntries];
} 