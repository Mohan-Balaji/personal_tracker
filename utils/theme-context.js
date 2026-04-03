import { createContext, useContext } from 'react';

const ThemeContext = createContext({
  themeMode: 'dark',
  setAppThemeMode: async () => {},
});

export function ThemeProvider({ value, children }) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
