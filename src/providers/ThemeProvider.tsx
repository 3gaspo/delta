import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useData } from './DataProvider';

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
  error: string | null;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings, updateSettings } = useData();
  const [isDark, setIsDark] = useState(settings.darkMode);
  const [error, setError] = useState<string | null>(null);
  const currentTheme = useRef(settings.darkMode);
  const savedTheme = useRef(settings.darkMode);
  const pendingVersion = useRef(0);
  const version = useRef(0);
  const writes = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (pendingVersion.current) return;
    currentTheme.current = settings.darkMode;
    savedTheme.current = settings.darkMode;
    setIsDark(settings.darkMode);
  }, [settings.darkMode]);

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
