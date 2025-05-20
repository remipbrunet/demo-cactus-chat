import { Stack } from 'expo-router';
import { TamaguiProvider } from 'tamagui';
import config from '../tamagui.config';
import { ModelProvider } from '@/contexts/modelContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '@/language/i18nextConfig'; // needed for language translation context
import i18n from '@/language/i18nextConfig';
import { useEffect } from 'react';
import { getLanguagePreference } from '@/services/storage';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {

  useEffect(() => {
    async function prepareAndRedirect() {
      try {
        i18n.changeLanguage('ru');
        const languagePreference = await getLanguagePreference();
        if (languagePreference) {
          router.push('/languageSelectionScreen');
        } else {
          router.push('/languageSelectionScreen');
        }
      } catch (e) {
        console.warn('Error during initial setup:', e);
        router.push('/languageSelectionScreen');
      } finally {
        SplashScreen.hideAsync();
      }
    }

    prepareAndRedirect();
  }, [router]);

  return (
    <TamaguiProvider config={config}>
      <ModelProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="languageSelectionScreen"/>
            <Stack.Screen name="functionalitySelectionScreen"/>
          </Stack>
        </GestureHandlerRootView>
      </ModelProvider>
    </TamaguiProvider>
  );
}
