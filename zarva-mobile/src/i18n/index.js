import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LANGUAGE } from './languages';

export const useLanguageStore = create(
    persist(
        (set, get) => ({
            language: DEFAULT_LANGUAGE,
            translations: {},
            isLoaded: false,

            // dynamically import the file based on code
            loadLanguage: async (code) => {
                set({ isLoaded: false });
                try {
                    let module;
                    switch (code) {
                        case 'ml': module = await import('./translations/ml'); break;
                        case 'hi': module = await import('./translations/hi'); break;
                        case 'ta': module = await import('./translations/ta'); break;
                        case 'te': module = await import('./translations/te'); break;
                        case 'kn': module = await import('./translations/kn'); break;
                        case 'bn': module = await import('./translations/bn'); break;
                        case 'mr': module = await import('./translations/mr'); break;
                        case 'gu': module = await import('./translations/gu'); break;
                        case 'pa': module = await import('./translations/pa'); break;
                        case 'or': module = await import('./translations/or'); break;
                        case 'as': module = await import('./translations/as'); break;
                        case 'en':
                        default:
                            module = await import('./translations/en');
                            code = 'en'; // Force en if fallback
                            break;
                    }

                    set({
                        language: code,
                        translations: module.default || module,
                        isLoaded: true
                    });
                } catch (err) {
                    console.error('[i18n] Failed to load language:', code, err);
                    // Fallback to English if file is missing completely
                    if (code !== 'en') {
                        get().loadLanguage('en');
                    }
                }
            },

            // Basic translation lookup and variable interpolation
            t: (key, vars = {}) => {
                const { translations } = get();
                let text = translations[key] || key; // Fallback to raw key if missing

                // Replace any {{var}} in the text
                for (const [k, v] of Object.entries(vars)) {
                    text = text.replace(new RegExp(`{{${k}}}`, 'g'), v);
                }

                return text;
            }
        }),
        {
            name: 'zarva-language-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ language: state.language }), // ONLY persist the string code, not the massive obj
        }
    )
);
