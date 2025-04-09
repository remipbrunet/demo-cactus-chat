export interface Model {
  id: string;
  label: string;
  value: string;
  provider: 'openai' | 'cactus' | 'anthropic';
  disabled: boolean;
}

export const models: Model[] = [
  {
    id: 'gpt4o-mini',
    label: 'GPT-4o Mini',
    value: 'gpt-4o-mini',
    provider: 'openai',
    disabled: false
  },
  {
    id: 'gpt4o',
    label: 'GPT-4o',
    value: 'gpt-4o',
    provider: 'openai',
    disabled: false
  },
  {
    id: 'claude-haiku',
    label: 'Claude 3 Haiku',
    value: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    disabled: false
  },
  {
    id: 'cactus7b',
    label: 'Cactus Private 7B',
    value: 'cactus-7b',
    provider: 'cactus',
    disabled: true
  }
]; 