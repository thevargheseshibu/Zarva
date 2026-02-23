/**
 * src/i18n/languages.js
 * 
 * Master list of supported languages for the ZARVA application.
 * Mapped to the actual translated file modules.
 */

export const DEFAULT_LANGUAGE = 'ml';

export const SUPPORTED_LANGUAGES = [
    { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇮🇳', region: 'Global' },
    { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം', flag: '🇮🇳', region: 'Kerala' },
    { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳', region: 'North India' },
    { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', flag: '🇮🇳', region: 'Tamil Nadu' },
    { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', flag: '🇮🇳', region: 'Andhra Pradesh, Telangana' },
    { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', flag: '🇮🇳', region: 'Karnataka' },
    { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', flag: '🇮🇳', region: 'West Bengal' },
    { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', flag: '🇮🇳', region: 'Maharashtra' },
    { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી', flag: '🇮🇳', region: 'Gujarat' },
    { code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', flag: '🇮🇳', region: 'Punjab' },
    { code: 'or', label: 'Odia', nativeLabel: 'ଓଡ଼ିଆ', flag: '🇮🇳', region: 'Odisha' },
    { code: 'as', label: 'Assamese', nativeLabel: 'অসমীয়া', flag: '🇮🇳', region: 'Assam' },
];
