import { zarvaTheme } from './zarva.theme.js';
import palette from '../tokens/colors.js';

export const darkTheme = {
  ...zarvaTheme,
  id: 'zarva-dark',
  name: 'ZARVA Dark',

  background: {
    ...zarvaTheme.background,
    app: palette.gray950,
    surface: palette.gray900,
    surfaceRaised: palette.gray800,
    overlay: 'rgba(0,0,0,0.8)',
    skeleton: palette.gray800,
  },
  
  card: {
    ...zarvaTheme.card,
    background: palette.gray900,
    border: palette.gray800,
  },

  navigation: {
    tabBar: {
      ...zarvaTheme.navigation.tabBar,
      background: palette.gray950,
      border: palette.gray900,
    },
    header: {
      ...zarvaTheme.navigation.header,
      background: palette.gray950,
      border: palette.gray900,
    }
  }
};
