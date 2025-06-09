import { XStack } from "tamagui";

type Props = {
    children?: React.ReactNode,
  }

export const PreferenceTile = ({children}: Props) => {
    return (
        <XStack 
            alignItems='center' 
            gap="$4" 
            padding="$4"
            borderRadius="$6"
        >
            {children}
        </XStack>
    );
}; 