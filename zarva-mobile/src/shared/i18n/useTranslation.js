import { useCallback } from 'react';
import { useLanguageStore } from '@shared/i18n';

/**
 * useT() hook
 * 
 * Exposes the translation function `t(key, vars)` and causes
 * the component to re-render whenever the language changes globally.
 */
export function useT() {
    const translations = useLanguageStore((state) => state.translations);

    return useCallback(
        (key, vars = {}) => {
            let text = translations[key] || key; // Fallback to raw key if missing

            // Replace any {{var}} in the text
            if (vars && Object.keys(vars).length > 0) {
                for (const [k, v] of Object.entries(vars)) {
                    text = text.replace(new RegExp(`{{${k}}}`, 'g'), v);
                }
            }

            return text;
        },
        [translations]
    );
}
