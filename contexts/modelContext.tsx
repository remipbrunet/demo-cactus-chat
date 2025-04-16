import { createContext, useEffect, useState, useContext } from 'react';
import { Model, refreshModelAvailability, isOpenAIAvailable, isAnthropicAvailable, isGeminiAvailable } from '@/services/models';

interface ModelContextType {
    availableModels: Model[];
    refreshModels: () => void;
    hasOpenAIKey: boolean;
    hasAnthropicKey: boolean;
    hasGeminiKey: boolean;
}

const ModelContext = createContext<ModelContextType>({
    availableModels: [],
    refreshModels: () => {},
    hasOpenAIKey: false,
    hasAnthropicKey: false,
    hasGeminiKey: false,
});

export const ModelProvider = ({ children }: { children: React.ReactNode }) => {
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [modelsVersion, setModelsVersion] = useState<number>(0);
  const [hasOpenAIKey, setHasOpenAIKey] = useState<boolean>(false);
  const [hasAnthropicKey, setHasAnthropicKey] = useState<boolean>(false);
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean>(false);

  function refreshModels() {
    setModelsVersion(modelsVersion + 1);
  }

  useEffect(() => {
    console.log('refreshing model availability');
    refreshModelAvailability().then((models) => {
      setAvailableModels(models);
      console.log('models refreshed', models.filter((model) => !model.disabled));
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
  <ModelContext.Provider value={{ availableModels, refreshModels, hasOpenAIKey, hasAnthropicKey, hasGeminiKey }}>
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