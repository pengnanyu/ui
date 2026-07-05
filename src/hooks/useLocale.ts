import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

type Locale = 'zh' | 'en';

interface UseLocaleReturn {
  locale: Locale;
  changeLanguage: (locale: Locale) => void;
}

export function useLocale(): UseLocaleReturn {
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'zh' ? 'zh' : 'en') as Locale;

  const changeLanguage = useCallback((newLocale: Locale) => {
    i18n.changeLanguage(newLocale);
    try {
      localStorage.setItem('bms-locale', newLocale);
    } catch (_e) { }
  }, [i18n]);

  return { locale, changeLanguage };
}