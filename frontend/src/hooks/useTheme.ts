import { useState, useEffect, useCallback } from 'react';

export type ThemeId = 'purple' | 'yellow' | 'green' | 'light' | 'light-green' | 'light-blue';
export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'vc_theme';
const THEME_EVENT = 'vc_theme_change';
const DEFAULT: ThemeId = 'purple';

export const THEMES: { id: ThemeId; label: string; mode: ThemeMode }[] = [
  { id: 'purple', label: '暗夜紫', mode: 'dark' },
  { id: 'yellow', label: '暗夜黄', mode: 'dark' },
  { id: 'green', label: '暗夜绿', mode: 'dark' },
  { id: 'light', label: '日光黄', mode: 'light' },
  { id: 'light-green', label: '日光绿', mode: 'light' },
  { id: 'light-blue', label: '日光蓝', mode: 'light' },
];

function isThemeId(value: string): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

function loadTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isThemeId(saved)) return saved;
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
      if (isThemeId(next)) {
        setThemeState(next);
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue && isThemeId(event.newValue)) {
        setThemeState(event.newValue);
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
