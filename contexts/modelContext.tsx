import { createContext, useEffect, useState, useContext } from 'react';
import { 
  Model, 
  InferenceHardware,
  fetchModelsAvailableToDownload, 
  ModelAvailableToDownload 
} from '@/services/models';
import { 
  getLocalModels,
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
    tokenGenerationLimit: number;
    setTokenGenerationLimit: (limit: number) => void;
    inferenceHardware: InferenceHardware[];
    setInferenceHardware: (hardware: InferenceHardware[]) => void;
    isReasoningEnabled: boolean;
    setIsReasoningEnabled: (enabled: boolean) => void;
    modelsAvailableToDownload: ModelAvailableToDownload[];
}

const ModelContext = createContext<ModelContextType>({
    availableModels: [],
    selectedModel: null,
    setSelectedModel: () => {},
    refreshModels: () => {},
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
  const [tokenGenerationLimit, setTokenGenerationLimit] = useState<number>(1000);
  const [inferenceHardware, setInferenceHardware] = useState<InferenceHardware[]>(['cpu']);
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
    getLocalModels().then((availableModels) => {
      setAvailableModels(availableModels);
      getLastUsedModel().then((lastUsedModel) => {
        setSelectedModel(availableModels.find(m => m.value === lastUsedModel) || null);
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
    getLocalModels().then((models) => {
      setAvailableModels(models);
    });
  }, [modelsVersion])

  return (
  <ModelContext.Provider value={{ 
    availableModels, 
    selectedModel, 
    setSelectedModel, 
    refreshModels, 
    tokenGenerationLimit, 
    setTokenGenerationLimit, 
    inferenceHardware, 
    setInferenceHardware, 
    isReasoningEnabled, 
    setIsReasoningEnabled, 
    modelsAvailableToDownload 
  }}>
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