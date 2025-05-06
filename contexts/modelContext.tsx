import { createContext, useEffect, useState, useContext } from 'react';
import { Model, refreshModelAvailability, isOpenAIAvailable, isAnthropicAvailable, isGeminiAvailable, fetchModelsAvailableToDownload, ModelAvailableToDownload } from '@/services/models';
import { saveTokenGenerationLimit, getTokenGenerationLimit, getLastUsedModel } from '@/services/storage';

interface ModelContextType {
    availableModels: Model[];
    selectedModel: Model | null;
    setSelectedModel: (model: Model | null) => void;
    refreshModels: () => void;
    hasOpenAIKey: boolean;
    hasAnthropicKey: boolean;
    hasGeminiKey: boolean;
    tokenGenerationLimit: number;
    setTokenGenerationLimit: (limit: number) => void;
    modelsAvailableToDownload: ModelAvailableToDownload[];
}

const ModelContext = createContext<ModelContextType>({
    availableModels: [],
    selectedModel: null,
    setSelectedModel: () => {},
    refreshModels: () => {},
    hasOpenAIKey: false,
    hasAnthropicKey: false,
    hasGeminiKey: false,
    tokenGenerationLimit: 50,
    setTokenGenerationLimit: () => {},
    modelsAvailableToDownload: [],
});

export const ModelProvider = ({ children }: { children: React.ReactNode }) => {
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [modelsVersion, setModelsVersion] = useState<number>(0);
  const [hasOpenAIKey, setHasOpenAIKey] = useState<boolean>(false);
  const [hasAnthropicKey, setHasAnthropicKey] = useState<boolean>(false);
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean>(false);
  const [tokenGenerationLimit, setTokenGenerationLimit] = useState<number>(1000);
  const [modelsAvailableToDownload, setModelsAvailableToDownload] = useState<ModelAvailableToDownload[]>([]);

  function refreshModels() {
    setModelsVersion(modelsVersion + 1);
  }

  useEffect(() => { // on initial load
    getTokenGenerationLimit().then((limit) => {
      setTokenGenerationLimit(limit);
    });
    refreshModelAvailability().then((models) => {
      setAvailableModels(models);
      getLastUsedModel().then((model) => {
        setSelectedModel(availableModels.find(m => m.value === model) || null);
      });
    });
    fetchModelsAvailableToDownload().then((models) => {
      setModelsAvailableToDownload(models);
    });
  }, []);

  useEffect(() => {
    saveTokenGenerationLimit(tokenGenerationLimit);
  }, [tokenGenerationLimit]);

  useEffect(() => {
    refreshModelAvailability().then((models) => {
      setAvailableModels(models);
    });
    isOpenAIAvailable().then((hasKey) => {
      setHasOpenAIKey(hasKey);
    });
    isAnthropicAvailable().then((hasKey) => {
      setHasAnthropicKey(hasKey);
    });
    isGeminiAvailable().then((hasKey) => {
      setHasGeminiKey(hasKey);
    });
  }, [modelsVersion])

  return (
  <ModelContext.Provider value={{ availableModels, selectedModel, setSelectedModel, refreshModels, hasOpenAIKey, hasAnthropicKey, hasGeminiKey, tokenGenerationLimit, setTokenGenerationLimit, modelsAvailableToDownload }}>
    {children}
  </ModelContext.Provider>
  )
};

export const useModelContext = () => {
    const context = useContext(ModelContext);
    if (context === undefined || context === null) {
      throw new Error('useModelContext must be used within an ModelProvider');
    }
    return context;
};