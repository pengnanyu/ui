/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './zh.json';
import en from './en.json';

function detectInitialLang(): string {
  try {
    const stored = localStorage.getItem('bms-locale');
    if (stored === 'zh' || stored === 'en') return stored;
  } catch (_e) { /* ignore */ }
  if (typeof navigator !== 'undefined') {
    const lang = (navigator.language || navigator.languages?.[0] || 'zh').toLowerCase();
    if (lang.startsWith('zh')) return 'zh';
    return 'en';
  }
  return 'zh';
}

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: detectInitialLang(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;