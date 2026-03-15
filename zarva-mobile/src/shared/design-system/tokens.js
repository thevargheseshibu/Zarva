/**
 * src/design-system/tokens.js
 * ZARVA Design Tokens — Premium Gradient Purple Theme
 */

export const colors = {
    // 🌑 Background System (Zarva Premium Web Theme)
    background: '#0A0118',   // Deep space purple/black
    surface: '#140828',      // Card background
    elevated: '#1A0B3B',     // Highest elevation
    overlay: 'rgba(10, 1, 24, 0.85)', // Deep shadow overlay

    // 🌈 Accent System (Neon pops against the dark)
    accent: {
        primary: '#7C3AED',        // Vivid Purple
        secondary: '#EC4899',      // Hot Pink
        tertiary: '#06B6D4',       // Electric Cyan
        glow: 'rgba(124, 58, 237, 0.35)', // Purple glow
        border: 'rgba(124, 58, 237, 0.2)', // Subtle border
        gradient: ['#7C3AED', '#EC4899', '#06B6D4'],
    },

    // Status
    success: '#10B981', // Crisp green
    warning: '#F59E0B',
    danger: '#EF4444',
    status: {
        error: '#EF4444',
        success: '#10B981',
        warning: '#F59E0B',
    },
    border: 'rgba(124, 58, 237, 0.2)', // Global border alias

    // ✍️ Text System (High Contrast Readability)
    text: {
        primary: '#F8FAFC',
        secondary: '#CBD5E1',
        muted: '#94A3B8',
    },

    // Legacy Compatibility mapping
    bg: {
        primary: '#0A0118',
        surface: '#140828',
        elevated: '#1A0B3B',
    },

    // Brand specifics
    brand: {
        primary: '#7C3AED',
        glow: 'rgba(124, 58, 237, 0.35)',
    }
};


export const spacing = {
    4: 4, 8: 8, 12: 12, 16: 16, 20: 20, 24: 24, 32: 32, 40: 40, 48: 48, 64: 64,

    // Premium breathing feel
    xxs: 6, xs: 10, sm: 14, md: 20, lg: 30, xl: 38, xxl: 48,
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
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.55,
        shadowRadius: 40,
        elevation: 14,
    },
    accentGlow: {
        shadowColor: '#A855F7',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.85,
        shadowRadius: 24,
        elevation: 12,
    }
};