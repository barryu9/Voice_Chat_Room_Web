import { useState, useEffect, useCallback } from 'react';

export type ThemeId = 'purple' | 'light' | 'green' | 'yellow';
export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'vc_theme';
const THEME_EVENT = 'vc_theme_change';
const DEFAULT: ThemeId = 'purple';

export const THEMES: { id: ThemeId; label: string; mode: ThemeMode }[] = [
  { id: 'purple', label: '渐变紫', mode: 'dark' },
  { id: 'yellow', label: '渐变黄', mode: 'dark' },
  { id: 'green', label: '渐变绿', mode: 'dark' },
  { id: 'light', label: '日间版', mode: 'light' },
];

function loadTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEMES.some((t) => t.id === saved)) return saved as ThemeId;
  } catch {}
  return DEFAULT;
}

function applyTheme(id: ThemeId) {
  const selected = THEMES.find((t) => t.id === id);
  document.documentElement.dataset.theme = id;
  document.documentElement.dataset.themeMode = selected?.mode ?? 'dark';
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(loadTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onThemeChange = (event: Event) => {
      const next = (event as CustomEvent<ThemeId>).detail;
      if (THEMES.some((t) => t.id === next)) {
        setThemeState(next);
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue && THEMES.some((t) => t.id === event.newValue)) {
        setThemeState(event.newValue as ThemeId);
      }
    };

    window.addEventListener(THEME_EVENT, onThemeChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(THEME_EVENT, onThemeChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: id }));
  }, []);

  return { theme, setTheme };
}
