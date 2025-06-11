import { useCallback, useEffect, useState } from 'react';
import { YStack, Button, Text } from 'tamagui';
import { useRouter } from 'expo-router';
import i18next from 'i18next';
import { saveLanguagePreference } from '@/services/storage';
import { CactusFunctionalityOption } from '@/components/ui/onboarding/CactusFunctionalityOption';
import OnboardingScreenLayout from '@/components/ui/onboarding/OnboardingScreenLayout';


interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

const languages: Language[] = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
];

export function LanguageSelectionScreen() {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(languages[0]);

  useEffect(() => {
    console.log(i18next.languages);
  }, []);
  
  const onSelectLanguage = useCallback((language: Language) => {
    i18next.changeLanguage(language.code);
    saveLanguagePreference(language.code);
    setSelectedLanguage(language);
  }, [router]);

  const onContinue = () => {
    router.push('/functionalitySelectionScreen');
  }

  return (
    <OnboardingScreenLayout>
        <YStack alignItems='center' gap="$2">
            <Text fontSize="$5" fontWeight="600">Select your language</Text>
        </YStack>
        <YStack flex={1} alignItems="center" paddingTop="$4" gap="$2">
            {languages.map((language) => (
                <CactusFunctionalityOption
                    key={language.code}
                    icon={language.flag}
                    title={language.name}
                    description={language.nativeName}
                    selected={selectedLanguage.code === language.code}
                    onPress={() => onSelectLanguage(language)}
                    required={false}
                />
            ))}
        </YStack>
        <Button width="100%" backgroundColor="#000" onPress={onContinue}>
            <Text color="#FFF" fontSize="$4" fontWeight="400">Continue</Text>
        </Button>
    </OnboardingScreenLayout>
  );
};

export default LanguageSelectionScreen;