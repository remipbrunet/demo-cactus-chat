import React from 'react';
import { Button, XStack, YStack, Text, Paragraph } from 'tamagui'; // Assuming Text is needed if Button content isn't enough
import { Check, Download, Trash } from '@tamagui/lucide-icons'; // Assuming icon imports

// Define the props for the component
interface ModelListItemProps {
  modelName: string;
  modelComment?: string;
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
  modelComment,
  downloaded,
  downloadInProgress,
  onDownloadClick,
  onDeleteClick,
}) => {

  return (
    <XStack key={modelName} alignItems="center" marginBottom="$3" marginLeft="$1">
      <YStack flex={1} marginRight="$2">
        <XStack alignItems="center">
          <Text fontSize="$3" fontWeight="400" color="$color">
            {modelName}
          </Text>
        </XStack>
        {modelComment && (
          <Text fontSize="$3" fontWeight="300" color="$gray10" marginTop="$0.5">
            {modelComment}
          </Text>
        )}
      </YStack>

      {/* Action Button: Download or Delete */}
      {downloaded ? (
        // Delete Button
        <Button
          size="$4"
          theme="red"
          icon={Trash}
          onPress={() => onDeleteClick()}
          aria-label={`Delete model ${modelName}`} // Accessibility
        />
      ) : (
        // Download Button
        <Button
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