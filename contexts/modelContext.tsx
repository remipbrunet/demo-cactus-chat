import { createContext, useEffect, useState, useContext } from 'react';
import { 
  Model, 
  refreshModelAvailability, 
  isOpenAIAvailable, 
  isAnthropicAvailable, 
  isGeminiAvailable, 
  fetchModelsAvailableToDownload, 
  ModelAvailableToDownload 
} from '@/services/models';
import { 
  saveTokenGenerationLimit, 
  getTokenGenerationLimit, 
  getLastUsedModel, 
  getInferenceHardware, 
  saveInferenceHardware, 
  getIsReasoningEnabled, 
  saveIsReasoningEnabled 
} from '@/services/storage';

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
    inferenceHardware: string[];
    setInferenceHardware: (hardware: string[]) => void;
    isReasoningEnabled: boolean;
    setIsReasoningEnabled: (enabled: boolean) => void;
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
    tokenGenerationLimit: 1000,
    setTokenGenerationLimit: () => {},
    inferenceHardware: ['cpu'],
    setInferenceHardware: () => {},
    isReasoningEnabled: true,
    setIsReasoningEnabled: () => {},
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
  const [inferenceHardware, setInferenceHardware] = useState<string[]>(['cpu']);
  const [isReasoningEnabled, setIsReasoningEnabled] = useState<boolean>(true);
  const [modelsAvailableToDownload, setModelsAvailableToDownload] = useState<ModelAvailableToDownload[]>([]);

  function refreshModels() {
    setModelsVersion(modelsVersion + 1);
  }

  useEffect(() => { // on initial load
    getTokenGenerationLimit().then((limit) => {
      setTokenGenerationLimit(limit);
    });
    getInferenceHardware().then((hardware) => {
      setInferenceHardware(hardware)
    });
    getIsReasoningEnabled().then((enabled) => {
      setIsReasoningEnabled(enabled)
    })
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
    saveInferenceHardware(inferenceHardware)
  }, [inferenceHardware])

  useEffect(() => {
    saveIsReasoningEnabled(isReasoningEnabled)
  }, [isReasoningEnabled])

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
  <ModelContext.Provider value={{ availableModels, selectedModel, setSelectedModel, refreshModels, hasOpenAIKey, hasAnthropicKey, hasGeminiKey, tokenGenerationLimit, setTokenGenerationLimit, inferenceHardware, setInferenceHardware, isReasoningEnabled, setIsReasoningEnabled, modelsAvailableToDownload }}>
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