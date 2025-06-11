import { KeyboardAvoidingView, Platform, SafeAreaView } from "react-native";
import { YStack } from "tamagui";

export default function OnboardingScreenLayout ({ children }: { children: React.ReactNode }) {
    return (
        <SafeAreaView style={{ flex: 1 }}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
            <YStack flex={1} padding="$2" gap="$2" alignItems="center">
                {children}
            </YStack>
            </KeyboardAvoidingView>
        </SafeAreaView>
    )
}