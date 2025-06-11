import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import en from './json/en.json';
import ru from './json/ru.json';
import { getLanguagePreference } from '@/services/storage';

enum LangCode {
  en = 'en',
  ru = 'ru',
}

const resources = {
  en: {
    translation: en,
  },
  ru: {
    translation: ru,
  },
};

const initalizeI18Next = async () => {
  const languagePreference = await getLanguagePreference() || LangCode.en;
  i18n.use(initReactI18next).init({
    debug: false,
    resources,
    lng: languagePreference,
    fallbackLng: LangCode.en,
    compatibilityJSON: 'v4',
    interpolation: {
      escapeValue: false,
    },
  });
};

initalizeI18Next();

export default i18n;