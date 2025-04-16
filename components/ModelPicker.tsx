import { ChevronDown, ChevronUp } from '@tamagui/lucide-icons';
import DropDownPicker from 'react-native-dropdown-picker';
import { Dispatch, SetStateAction, useState } from 'react';
import { ViewStyle } from 'react-native';
import { truncateModelName } from '@/utils/modelUtils';
import { useModelContext } from '@/contexts/modelContext';
import { saveLastUsedModel } from '@/services/storage';
import { ensureLocalModelContext } from '@/utils/localModelContext';

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
  setModelIsLoading: Dispatch<SetStateAction<boolean>>;
  setOpen: Dispatch<SetStateAction<boolean>>;
  zIndex?: number;
}

export function ModelPicker({ 
  open, 
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
      console.log('itemValue', itemValue);
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
      ArrowDownIconComponent={({ style }) => <ChevronDown size={16} color="#000" />}
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