import { Text, TextProps } from 'tamagui';

export const RegularText = (props: TextProps) => {
    return (
        <Text fontSize="$3" fontWeight="300" textAlign='center' {...props} />
    );
}; 