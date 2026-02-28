import palette from '../tokens/colors.js';
import { typography } from '../tokens/typography.js';
import { spacing } from '../tokens/spacing.js';
import { radius } from '../tokens/radius.js';
import { shadows } from '../tokens/shadows.js';
import { animation } from '../tokens/animation.js';

export const zarvaTheme = {

  // ── IDENTITY ─────────────────────────────────────
  id: 'zarva',
  name: 'ZARVA Premium Purple',

  // ── BRAND COLORS ─────────────────────────────────
  brand: {
    primary:      palette.purple500,   // main CTA, buttons, active states
    primaryLight: palette.purple400,
    primaryDark:  palette.purple700,
    secondary:    palette.pink500,     // secondary actions
    secondaryLight: palette.pink400,
    secondaryDark:  palette.pink100,
    accent:       palette.cyan500,     // highlights, badges
    glow:         palette.purpleGlow,
  },

  // ── BACKGROUND ───────────────────────────────────
  background: {
    app:          palette.purple900,      // main app background (#0A0118)
    surface:      palette.purple800,       // cards, sheets, modals (#140828)
    surfaceRaised:palette.purple700,       // elevated cards (#1A0B3B)
    overlay:      palette.overlayDark,   // modal backdrop
    skeleton:     palette.purple700,     // loading skeleton
  },

  // ── TEXT ─────────────────────────────────────────
  text: {
    primary:      palette.gray50,     // #F8FAFC
    secondary:    palette.gray300,     // #CBD5E1 
    tertiary:     palette.gray400,     // #94A3B8 hints, placeholders
    muted:        palette.gray400,
    inverse:      palette.gray900,       // text on light backgrounds
    link:         palette.cyan500,     // tappable links
    disabled:     palette.gray500,
    onPrimary:    palette.white,       // text on primary brand color
    onSecondary:  palette.white,
  },

  // ── BORDER ───────────────────────────────────────
  border: {
    light:    palette.purple700,
    default:  palette.purpleBorder,
    strong:   palette.purpleGlow,
    focus:    palette.purple500,       // input focus ring
    error:    palette.red500,
  },

  // ── STATUS COLORS ─────────────────────────────────
  status: {
    success: {
      base:  palette.green500,
      light: palette.green50,
      dark:  palette.green800,
      text:  palette.green800,
    },
    error: {
      base:  palette.red500,
      light: palette.red50,
      dark:  palette.red800,
      text:  palette.red800,
    },
    warning: {
      base:  palette.yellow500,
      light: palette.yellow50,
      dark:  palette.yellow700,
      text:  palette.yellow700,
    },
    info: {
      base:  palette.cyan500,
      light: palette.cyan50,
      dark:  palette.cyan800,
      text:  palette.cyan800,
    },
  },

  // ── JOB STATUS COLORS ────────────────────────────
  jobStatus: {
    open:       { bg: palette.purple700, text: palette.gray300, dot: palette.gray400 },
    searching:  { bg: palette.cyan100,   text: palette.cyan700, dot: palette.cyan500 },
    assigned:   { bg: palette.purple100, text: palette.purple700, dot: palette.purple500 },
    pending:    { bg: palette.yellow50,  text: palette.yellow700, dot: palette.yellow500 },
    active:     { bg: palette.blue50,    text: palette.blue700,   dot: palette.blue500   },
    in_progress:{ bg: palette.pink50,    text: palette.pink700, dot: palette.pink500 },
    completed:  { bg: palette.green50,   text: palette.green700,  dot: palette.green500  },
    disputed:   { bg: palette.red50,     text: palette.red700,    dot: palette.red500    },
    cancelled:  { bg: palette.gray100,   text: palette.gray500,   dot: palette.gray400   },
    no_worker_found: { bg: palette.gray100, text: palette.gray500, dot: palette.gray400 },
  },

  // ── INPUT ────────────────────────────────────────
  input: {
    background:       palette.purple800,
    backgroundFilled: palette.purple700,
    border:           palette.purpleBorder,
    borderFocus:      palette.purple500,
    borderError:      palette.red500,
    placeholder:      palette.gray400,
    text:             palette.gray50,
    label:            palette.gray300,
    helperText:       palette.gray400,
    errorText:        palette.red500,
  },

  // ── BUTTON ───────────────────────────────────────
  button: {
    primary: {
      background:         palette.purple500,
      backgroundPressed:  palette.purple400,
      backgroundDisabled: palette.purple700,
      text:               palette.white,
      textDisabled:       palette.gray400,
    },
    secondary: {
      background:         palette.purple800,
      backgroundPressed:  palette.purple700,
      backgroundDisabled: palette.purple900,
      border:             palette.purple500,
      text:               palette.purple500,
      textDisabled:       palette.gray500,
    },
    ghost: {
      background:         palette.transparent,
      backgroundPressed:  palette.purple700,
      text:               palette.gray300,
    },
    danger: {
      background:         palette.red500,
      backgroundPressed:  palette.red600,
      backgroundDisabled: palette.purple700,
      text:               palette.white,
    },
  },

  // ── NAVIGATION ───────────────────────────────────
  navigation: {
    tabBar: {
      background:    palette.purple800,
      border:        palette.purple700,
      activeIcon:    palette.purple500,
      inactiveIcon:  palette.gray500,
      activeLabel:   palette.purple500,
      inactiveLabel: palette.gray500,
      indicator:     palette.purple500,
    },
    header: {
      background: palette.purple900,
      text:       palette.gray50,
      icon:       palette.gray50,
      border:     palette.purple800,
    },
  },

  // ── CARD ─────────────────────────────────────────
  card: {
    background: palette.purple800,
    border:     palette.purpleBorder,
    shadow:     shadows.md,
  },

  // ── BADGE ────────────────────────────────────────
  badge: {
    primary:  { background: palette.purple500, text: palette.white },
    success:  { background: palette.green500,  text: palette.white },
    warning:  { background: palette.yellow500, text: palette.white },
    error:    { background: palette.red500,    text: palette.white },
    neutral:  { background: palette.gray600,   text: palette.white },
  },

  // ── MAP ──────────────────────────────────────────
  map: {
    workerMarker:   palette.purple500,
    customerMarker: palette.cyan500,
    serviceCircle:  'rgba(124, 58, 237, 0.15)',
    serviceCircleBorder: palette.purple400,
    routeLine:      palette.purple500,
  },

  // ── TOKENS (pass-through for direct use) ─────────
  spacing,
  typography,
  radius,
  shadows,
  animation,
};
