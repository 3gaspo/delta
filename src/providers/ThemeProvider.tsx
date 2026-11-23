import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { DEFAULT_DARK_MODE } from '@3gaspo/app-ui/themePreference';
import { useData } from './DataProvider';

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
  error: string | null;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings, updateSettings } = useData();
  const preferredDarkMode = settings.darkMode ?? DEFAULT_DARK_MODE;
  const [isDark, setIsDark] = useState(preferredDarkMode);
  const [error, setError] = useState<string | null>(null);
  const currentTheme = useRef(preferredDarkMode);
  const savedTheme = useRef(preferredDarkMode);
  const pendingVersion = useRef(0);
  const version = useRef(0);
  const writes = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (pendingVersion.current) return;
    currentTheme.current = preferredDarkMode;
    savedTheme.current = preferredDarkMode;
    setIsDark(preferredDarkMode);
  }, [preferredDarkMode]);

  useEffect(() => { document.documentElement.classList.toggle('dark', isDark); }, [isDark]);

  const toggleTheme = () => {
    const next = !currentTheme.current;
    const request = ++version.current;
    pendingVersion.current = request;
    currentTheme.current = next;
    setError(null);
    setIsDark(next);
    const write = writes.current.catch(() => {}).then(() => updateSettings({ darkMode: next }));
    writes.current = write;
    write.then(() => {
      savedTheme.current = next;
      if (pendingVersion.current === request) pendingVersion.current = 0;
    }).catch(cause => {
      console.error('Failed to save theme:', cause);
      if (pendingVersion.current === request) {
        pendingVersion.current = 0;
        currentTheme.current = savedTheme.current;
        setIsDark(savedTheme.current);
        setError('Save failed');
      }
    });
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, error }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
