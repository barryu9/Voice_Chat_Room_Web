import { useState, useEffect, useCallback } from 'react';

export type ThemeId = 'purple' | 'light' | 'green' | 'yellow';

const STORAGE_KEY = 'vc_theme';
const DEFAULT: ThemeId = 'purple';

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'purple', label: '渐变紫' },
  { id: 'green',  label: '渐变绿' },
  { id: 'yellow', label: '渐变黄' },
  { id: 'light',  label: '日间版' },
];

function loadTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEMES.some((t) => t.id === saved)) return saved as ThemeId;
  } catch {}
  return DEFAULT;
}

function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(loadTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  }, []);

  return { theme, setTheme };
}
