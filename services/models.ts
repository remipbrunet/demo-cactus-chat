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

export async function fetchModelsAvailableToDownload(): Promise<ModelAvailableToDownload[]> {
  const availableMemory = await getTotalMemory() / (2**30)
  const {data, error} = await supabase.from('available_models').select('*')
  if (error || !data) {
    getModelsAvailableToDownload().then((models) => {
      return models || [];
      });
    } else {
      const modelsAvailableToDownload: ModelAvailableToDownload[] = data.filter((model: any) => model.recommended_ram_gb || 0 <= availableMemory).map((model: any) => ({
        name: model.name,
        comment: model.comment,
        downloadUrl: model.download_url,
        default: model.is_default,
      }));
      saveModelsAvailableToDownload(modelsAvailableToDownload);
      return modelsAvailableToDownload;
    }
  return []
};