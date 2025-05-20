import { SafeAreaView } from "react-native";
import { YStack } from "tamagui";

export default function OnboardingScreenLayout ({ children }: { children: React.ReactNode }) {
    return (
        <SafeAreaView style={{ flex: 1 }}>
            <YStack flex={1} padding="$4" gap="$2" alignItems="center">
                {children}
            </YStack>
        </SafeAreaView>
    )
}