import { ChevronDown, ChevronRight, ChevronUp } from '@tamagui/lucide-icons';
import DropDownPicker from 'react-native-dropdown-picker';
import { Dispatch, SetStateAction, useState } from 'react';
import { ViewStyle } from 'react-native';
import { truncateModelName } from '@/utils/modelUtils';
import { useModelContext } from '@/contexts/modelContext';
import { saveLastUsedModel } from '@/services/storage';
import { ensureLocalModelContext } from '@/utils/localModelContext';
import { Spinner, Text, XStack } from 'tamagui';

const dropdownStyles = {
  container: {
    width: 'auto'
  } as ViewStyle,
  picker: {
    borderWidth: 0,
    backgroundColor: "#f2f2f2",
    minHeight: 32,
    width: 180
  },
  itemContainer: {
    borderWidth: 0,
    backgroundColor: "#f2f2f2",
    width: 180
  },
  text: {
    fontSize: 14,
    color: "#000",
  }
};

interface ModelPickerProps {
  open: boolean;
  modelIsLoading: boolean;
  setModelIsLoading: Dispatch<SetStateAction<boolean>>;
  setOpen: Dispatch<SetStateAction<boolean>>;
  zIndex?: number;
}

export function ModelPicker({ 
  open, 
  modelIsLoading,
  setModelIsLoading,
  setOpen, 
  zIndex = 50,
}: ModelPickerProps) {
  const { availableModels, selectedModel, setSelectedModel } = useModelContext();
  const [dropdownValue, setDropdownValue] = useState<string | null>(selectedModel?.value || null);
  const items = availableModels.map(model => ({
    label: truncateModelName(model?.label),
    value: model.value,
    disabled: model.disabled
  }));

  const handleChange = async (itemValue: string | undefined) => {
    if (itemValue) {
      const newlySelectedModel = availableModels.find(model => model.value === itemValue);
      if (newlySelectedModel) {
        const newModelSelected = newlySelectedModel !== selectedModel
        setSelectedModel(newlySelectedModel);
        saveLastUsedModel(newlySelectedModel.value);
        if (newModelSelected) {
          setModelIsLoading(true);
          await ensureLocalModelContext(newlySelectedModel);
          setModelIsLoading(false);
        }
      }
    }
  };

  if (!availableModels.filter(model => !model.disabled).length) {
    return <ModelPickerPlaceholder />
  }

  return (
    <DropDownPicker
      placeholder="Select Model"
      placeholderStyle={dropdownStyles.text}
      style={dropdownStyles.picker}
      dropDownContainerStyle={dropdownStyles.itemContainer}
      textStyle={dropdownStyles.text}
      containerStyle={{
        ...dropdownStyles.container,
        zIndex
      }}
      zIndex={zIndex}
      ArrowDownIconComponent={({ style }) => {
        if (modelIsLoading) {
          return <Spinner />
        }
        return <ChevronDown size={16} color="#000" />
      }}
      ArrowUpIconComponent={({ style }) => <ChevronUp size={16} color="#000" />}
      listItemContainerStyle={{ height: 32 }}
      disabledItemContainerStyle={{ opacity: 0.5 }}
      disabledItemLabelStyle={{ opacity: 0.5 }}
      open={open}
      value={dropdownValue}
      items={items}
      setOpen={setOpen}
      setValue={setDropdownValue}
      onSelectItem={(item) => handleChange(item.value)}
    />
  );
} 

function ModelPickerPlaceholder() {
  // Placeholder we display when no models are available
  return (
    <XStack padding="$3" alignItems="center" justifyContent="center" flex={1}>
      <Text color="$gray10" fontSize={12}>Add models to get started</Text>
      <ChevronRight size={14} color="$gray10" />
    </XStack>
  )
}