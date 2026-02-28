module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-native/all',
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  plugins: ['react', 'react-native'],
  rules: {
    // General RN cleanup
    'react-native/no-inline-styles': 'warn',
    'react-native/no-color-literals': 'error',

    // ZARVA Custom Design System Constraints
    'no-restricted-syntax': [
      'error',
      {
        // Forbids hardcoded HEX strings
        selector: 'Literal[value=/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/i]',
        message: 'ZARVA DESIGN SYSTEM VIOLATION: No hardcoded hex colors allowed. Use design system tokens (e.g. tTheme.brand.primary) via useTokens().',
      },
      {
        // Forbids hardcoded RGBA strings
        selector: 'Literal[value=/^rgba\\(/i]',
        message: 'ZARVA DESIGN SYSTEM VIOLATION: No hardcoded rgba() colors allowed. Use design system tokens.',
      },
      {
        // Forbids direct importing of the palette
        selector: 'ImportDeclaration[source.value=/.?\\/design-system\\/tokens\\/colors/] > ImportDefaultSpecifier[local.name="palette"]',
        message: 'ZARVA DESIGN SYSTEM VIOLATION: Component files cannot import the raw color palette. Use the useTokens() hook.',
      }
    ],

    // Prevent direct importing from internal token folders unless it's the design system itself
    'no-restricted-imports': [
      'error',
      {
        patterns: [{
          group: ['**/design-system/tokens', '**/design-system/tokens/*'],
          message: 'ZARVA DESIGN SYSTEM VIOLATION: Import from "../../design-system" instead of the subdirectories directly, and use the useTokens hook.'
        }]
      }
    ]
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
