import { useLanguageStore } from '../i18n';

/**
 * useT() hook
 * 
 * Exposes the translation function `t(key, vars)` and causes
 * the component to re-render whenever the language changes globally.
 */
export function useT() {
    return useLanguageStore((state) => state.t);
}
