import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { LocalModel, storeLocalModel } from '../services/storage';

// Truncate model name with ellipsis if too long
export const truncateModelName = (name: string, maxLength = 17) => 
  name.length > maxLength ? name.substring(0, maxLength - 1) + '…' : name;

// Extract filename from HuggingFace URL
export function extractFilenameFromUrl(url: string): string | null {
  // Match HF URL pattern and extract filename
  const regex = /huggingface\.co\/[^\/]+\/[^\/]+\/resolve\/[^\/]+\/([^?]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Validate URL is a proper HuggingFace GGUF download link
export function validateModelUrl(url: string): { valid: boolean; reason?: string } {
  if (!url.includes('huggingface.co')) {
    return { valid: false, reason: 'Not a Hugging Face URL' };
  }
  
  if (!url.toLowerCase().endsWith('.gguf') && !url.includes('.gguf?')) {
    return { valid: false, reason: 'Not a GGUF file' };
  }
  
  if (!url.includes('/resolve/')) {
    return { valid: false, reason: 'Not a download link. URL must contain /resolve/' };
  }
  
  return { valid: true };
}

// Download a model and return its path
export async function downloadModel(url: string, onProgress: (progress: number) => void): Promise<LocalModel> {
  // Validate URL
  const validation = validateModelUrl(url);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }
  
  // Extract filename from URL
  const fileName = extractFilenameFromUrl(url);
  if (!fileName) {
    throw new Error('Could not extract filename from URL');
  }
  
  // Generate model name from filename (remove extension and replace dashes with spaces)
  const modelName = fileName.replace(/\.gguf$/, '').replace(/-/g, ' ');
  
  // Create local models directory 
  const modelDir = Platform.OS === 'ios' 
    ? `${FileSystem.documentDirectory}local-models/`
    : `${FileSystem.cacheDirectory}local-models/`;
  await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true }).catch(() => {});
  
  // Full path to downloaded file
  const modelPath = `${modelDir}${fileName}`;
  
  // Download the file
  await FileSystem.createDownloadResumable(
    url,
    modelPath,
    {},
    progress => onProgress(Math.floor((progress.totalBytesWritten * 100) / progress.totalBytesExpectedToWrite))
  ).downloadAsync();
  
  // Create and save local model record
  const model: LocalModel = {
    id: Date.now().toString(),
    name: modelName,
    filePath: modelPath
  };
  
  await storeLocalModel(model);
  return model;
} 