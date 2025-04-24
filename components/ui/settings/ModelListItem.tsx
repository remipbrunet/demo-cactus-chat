import React from 'react';
import { Button, XStack } from 'tamagui'; // Assuming Text is needed if Button content isn't enough
import { Check, Download, Trash } from '@tamagui/lucide-icons'; // Assuming icon imports

// Define the props for the component
interface ModelListItemProps {
  modelName: string;
  downloaded: boolean;
  downloadInProgress: boolean;
  onDownloadClick: () => void;
  onDeleteClick: () => void;
}

/**
 * A component representing a single model in a list,
 * showing download or delete actions based on its status.
 */
export const ModelListItem: React.FC<ModelListItemProps> = ({
  modelName,
  downloaded,
  downloadInProgress,
  onDownloadClick,
  onDeleteClick,
}) => {

  return (
    <XStack key={modelName} alignItems="center" marginBottom={8}>
      {/* Model Name Display Button */}
      <Button
        flex={1}
        size="$4"
        icon={downloaded ? Check : undefined} // Show checkmark if downloaded
        disabled // Keep it always disabled for display purposes as per original code
        opacity={0.5} // Consistent opacity
      >
        {modelName}
      </Button>

      {/* Action Button: Download or Delete */}
      {downloaded ? (
        // Delete Button
        <Button
          marginLeft={8}
          size="$4"
          theme="red"
          icon={Trash}
          onPress={() => onDeleteClick()}
          aria-label={`Delete model ${modelName}`} // Accessibility
        />
      ) : (
        // Download Button
        <Button
          marginLeft={8}
          size="$4"
          icon={Download}
          onPress={() => onDownloadClick()}
          disabled={downloadInProgress}
          opacity={downloadInProgress ? 0.5 : 1}
          aria-label={`Download model ${modelName}`} // Accessibility
        />
      )}
    </XStack>
  );
};