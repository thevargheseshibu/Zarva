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
                    const merger = await import('./merger');
                    switch (code) {
                        case 'ml': module = { default: merger.ml }; break;
                        case 'hi': module = { default: merger.hi }; break;
                        case 'ta': module = { default: merger.ta }; break;
                        case 'te': module = { default: merger.en }; break; // fallback
                        case 'kn': module = { default: merger.en }; break; // fallback
                        case 'bn': module = { default: merger.en }; break; // fallback
                        case 'mr': module = { default: merger.en }; break; // fallback
                        case 'gu': module = { default: merger.en }; break; // fallback
                        case 'pa': module = { default: merger.en }; break; // fallback
                        case 'or': module = { default: merger.en }; break; // fallback
                        case 'as': module = { default: merger.en }; break; // fallback
                        case 'en':
                        default:
                            module = { default: merger.en };
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
