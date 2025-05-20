import type { IconProps } from "@tamagui/helpers-icon";
import { Text, XStack, YStack, Circle } from 'tamagui';
import { Check} from '@tamagui/lucide-icons'

export function CactusFunctionalityOption(props: {
    icon: ((props: IconProps) => JSX.Element) | string; // string is the flag emoji
    title: string;
    description: string;
    selected: boolean;
    onPress: () => void;
    required: boolean;
}) {
    const tileBorderColor = props.selected ? "#000" : "$gray8";
    const tileBackgroundColor = props.selected ? "$gray5" : "transparent";
    const iconBackgroundColor = props.selected ? "#000" : "$gray5";
    const iconContentColor = props.selected ? "#FFF" : "$gray10";
    const checkBackgroundColor = props.selected ? "#000" : "transparent";
    const checkBorderColor = props.selected ? "#000" : "$gray10";

    const renderIcon = () => {
        if (typeof props.icon === 'string') {
          return <Text fontSize="$6" textAlign="center">{props.icon}</Text>;
        } else {
          const Icon = props.icon;
          return <Icon size="$1.5" color={iconContentColor} />;
        }
      };

    return (
        <XStack 
            alignItems='center' 
            gap="$4" 
            padding="$4" 
            borderWidth="$0.5" 
            borderColor={tileBorderColor} 
            borderRadius="$6"
            backgroundColor={tileBackgroundColor}
            onPress={props.required? () => {} : props.onPress}
        >
            <Circle size="$4" backgroundColor={typeof props.icon === 'string' ? "transparent" : iconBackgroundColor}>
                {renderIcon()}
            </Circle>
            <YStack flex={1} gap="$1">
                <XStack alignItems='center' gap="$1">
                    <Text fontSize="$4" fontWeight="500">{props.title}</Text>
                    {props.required && <Text fontSize="$3" fontWeight="300">(default)</Text>}
                </XStack>
                <Text fontSize="$3" fontWeight="300">{props.description}</Text>
            </YStack>
            <Circle size="$2" borderWidth="$0.5" borderColor={checkBorderColor} backgroundColor={checkBackgroundColor}>
                {props.selected && <Check size="$1" color="#FFF"/>}
            </Circle>
        </XStack>
    )
}