import { ArrowRight } from '@tamagui/lucide-icons';
import { useModelContext } from '@/contexts/modelContext';
import { XStack } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { RegularText } from '../RegularText';

export function ModelPicker() {
  const { availableModels, selectedModel } = useModelContext();
  const { t } = useTranslation();

  function ModelPickerPlaceholder() {
    // Placeholder we display when no models are available
    return (
      <XStack gap="$2" alignItems="center" justifyContent="center" flex={1} hitSlop={5} onPress={() => router.push('/settingsScreen')}>
        <RegularText>{t('emptyModelPicker')}</RegularText>
        <ArrowRight size="$1" color="$gray10"/>
      </XStack>
    )
  }

  if (!availableModels.filter(model => !model.disabled).length) {
    return <ModelPickerPlaceholder />
  }

  return (
    <RegularText>{selectedModel?.value}</RegularText>
  );
} 