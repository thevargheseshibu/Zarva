/**
 * src/shared/i18n/languages.js
 * 
 * Language configuration and constants.
 */

export const DEFAULT_LANGUAGE = 'en';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिंदी' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
];

export const getLanguageLabel = (code) => {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return lang ? lang.nativeLabel : code;
};
