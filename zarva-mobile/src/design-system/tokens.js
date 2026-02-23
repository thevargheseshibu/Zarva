/**
 * src/design-system/tokens.js
 * ZARVA Design Tokens — CRED-inspired dark luxury palette
 */

export const colors = {
    background: '#0B0B0F',   // soft black
    surface: '#14141B',
    elevated: '#1C1C25',
    overlay: 'rgba(20, 20, 27, 0.92)',

    accent: {
        primary: '#7B5CFF',  // Electric Violet
        glow: 'rgba(123, 92, 255, 0.18)',
        border: 'rgba(123, 92, 255, 0.35)',
    },

    success: '#30D158',
    warning: '#FF9F0A',
    danger: '#FF453A',

    text: {
        primary: '#F2F2F7',
        secondary: '#8E8E9A',
        muted: '#3A3A4A',
    },

    // Compatibility mapping
    bg: {
        primary: '#0B0B0F',
        surface: '#14141B',
        elevated: '#1C1C25',
    },
    gold: {
        primary: '#7B5CFF',
        glow: 'rgba(123, 92, 255, 0.18)',
    }
};

export const spacing = {
    4: 4,
    8: 8,
    12: 12,
    16: 16,
    24: 24,
    32: 32,
    40: 40,
    48: 48,
    64: 64,
    // Alias for existing usage
    xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 40,
};

export const radius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
};

export const shadows = {
    premium: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 32,
        elevation: 12,
    },
    accentGlow: {
        shadowColor: '#7B5CFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 8,
    }
};
