import { useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'csv-align-theme';

function getThemeStorage() {
  if (
    typeof window === 'undefined' ||
    typeof window.localStorage?.getItem !== 'function' ||
    typeof window.localStorage?.setItem !== 'function'
  ) {
    return null;
  }

  return window.localStorage;
}

export function useThemePreference() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const savedTheme = getThemeStorage()?.getItem(THEME_STORAGE_KEY);
    return savedTheme === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    getThemeStorage()?.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return {
    theme,
    toggleTheme: () => setTheme((previousTheme) => (previousTheme === 'dark' ? 'light' : 'dark')),
  };
}
