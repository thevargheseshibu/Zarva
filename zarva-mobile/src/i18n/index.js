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
                // Prevent redundant loads if already on this language and loaded
                if (get().language === code && get().isLoaded && Object.keys(get().translations).length > 0) {
                    return;
                }

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

                    const data = module.default || module;
                    if (!data || Object.keys(data).length === 0) {
                        throw new Error('Empty translation module');
                    }

                    set({
                        language: code,
                        translations: data,
                        isLoaded: true
                    });
                } catch (err) {
                    console.error('[i18n] Failed to load language:', code, err);
                    // Fallback to English if file is missing completely or empty
                    if (code !== 'en') {
                        await get().loadLanguage('en');
                    } else {
                        // Critical failure - even English failed?
                        set({ isLoaded: true });
                    }
                }
            }
        }),
        {
            name: 'zarva-language-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ language: state.language }), // ONLY persist the string code, not the massive obj
        }
    )
);
