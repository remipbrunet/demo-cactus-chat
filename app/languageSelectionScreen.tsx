import { YStack, Button, Text, XStack, Avatar, Image } from 'tamagui';
import { useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import i18next from 'i18next';
import { saveLanguagePreference } from '@/services/storage';

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export function LanguageSelectionScreen() {
  const zIndex = 1000;
  const router = useRouter();

  useEffect(() => {
    console.log(i18next.languages);
  }, []);
  
  const languages: Language[] = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  ];
  
  const changeLanguage = useCallback((languageCode: string) => {
    i18next.changeLanguage(languageCode);
    saveLanguagePreference(languageCode);
    router.back();
  }, [router]);

  return (
    <YStack
      fullscreen
      key="language-selection-overlay"
      backgroundColor="$background"
      alignItems="center"
      justifyContent="flex-start"
      zIndex={zIndex}
      gap="$10"
    >
      
      <YStack width="80%" paddingTop="$10">
        <Text textAlign="center" fontSize={18} fontWeight="bold">Select Your Language</Text>
      </YStack>

      <YStack
        gap="$2"
        alignItems="center"
        width="90%"
        padding="$1"
      >
        {languages.map((language) => (
          <Button
            key={language.code}
            onPress={() => changeLanguage(language.code)}
            width="100%"
            height={50}
            backgroundColor="$backgroundStrong"
            borderRadius="$4"
          >
            <XStack flex={1} justifyContent="space-between" alignItems="center" paddingHorizontal="$3">
              <YStack>
                <Text fontSize='$4'>{language.nativeName}</Text>
                <Text fontSize='$3' color="$gray10">{language.name}</Text>
              </YStack>
              <YStack alignItems="center" justifyContent="center">
                <Text fontSize='$8'>{language.flag}</Text>
              </YStack>
            </XStack>
          </Button>
        ))}
      </YStack>
    </YStack>
  );
};

export default LanguageSelectionScreen;