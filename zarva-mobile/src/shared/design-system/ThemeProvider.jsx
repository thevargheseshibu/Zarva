import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes } from './themes/index.js';

export const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [themeId, setThemeId] = useState('zarva');

  useEffect(() => {
    // Load saved theme preference on app start
    AsyncStorage.getItem('zarva_theme_id').then(saved => {
      if (saved && themes[saved]) {
        setThemeId(saved);
      }
    });
  }, []);

  const setTheme = async (id) => {
    if (themes[id]) {
      setThemeId(id);
      await AsyncStorage.setItem('zarva_theme_id', id);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme: themes[themeId], themeId, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
