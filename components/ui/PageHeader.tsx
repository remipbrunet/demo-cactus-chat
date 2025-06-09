import { Button, Text, YStack } from 'tamagui';
import { ArrowLeft } from '@tamagui/lucide-icons';
import { router } from 'expo-router';

import { RegularText } from '@/components/ui/RegularText';

type Props = {
    title: string,
    subtitle?: string,
    includeBackButton?: boolean;
}

export const PageHeader = (props: Props) => {
    return (
        <YStack alignItems='center' gap="$2" width='100%'>
            {props.includeBackButton && 
                <Button 
                    icon={<ArrowLeft size="$1"/>}
                    onPress={() => router.back()}
                    size="$2"
                    chromeless
                    position='absolute'
                    start={8}
                />
            }
            <Text fontSize="$5" fontWeight="600">{props.title}</Text>
            {props.subtitle && <RegularText>{props.subtitle}</RegularText>}
        </YStack>
    )
}