import { Stack } from 'expo-router';
import { TamaguiProvider } from 'tamagui';
import config from '../tamagui.config';
import { ModelProvider } from '@/contexts/modelContext';

export default function RootLayout() {
  return (
    <TamaguiProvider config={config}>
      <ModelProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
        </Stack>
      </ModelProvider>
    </TamaguiProvider>
  );
}
