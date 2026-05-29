import { useState, useEffect, useCallback } from 'react';

export type AppearanceId = 'night' | 'sunlight' | 'pure' | 'midnight';
export type ThemeMode = 'dark' | 'light';
export type ThemeColorId = 'red' | 'yellow' | 'blue' | 'green' | 'cyan' | 'purple' | 'pink' | 'orange' | 'custom';

export interface ThemeState {
  appearance: AppearanceId;
  color: ThemeColorId;
  customDark: string;
  customLight: string;
}

const APPEARANCE_KEY = 'vc_theme_appearance';
const COLOR_KEY = 'vc_theme_color';
const CUSTOM_DARK_KEY = 'vc_theme_custom_dark';
const CUSTOM_LIGHT_KEY = 'vc_theme_custom_light';
const THEME_EVENT = 'vc_theme_change';

const DEFAULT_APPEARANCE: AppearanceId = 'night';
const DEFAULT_COLOR: ThemeColorId = 'purple';
const DEFAULT_CUSTOM_DARK = '#8b5cf6';
const DEFAULT_CUSTOM_LIGHT = '#facc15';

export const APPEARANCES: { id: AppearanceId; label: string; mode: ThemeMode }[] = [
  { id: 'night', label: '暗夜', mode: 'dark' },
  { id: 'sunlight', label: '日光', mode: 'light' },
  { id: 'pure', label: '纯粹', mode: 'light' },
  { id: 'midnight', label: '深夜', mode: 'dark' },
];

export const THEME_COLORS: { id: ThemeColorId; label: string; dark: string; light: string }[] = [
  { id: 'red', label: '红', dark: '#ef4444', light: '#f87171' },
  { id: 'yellow', label: '黄', dark: '#eab308', light: '#facc15' },
  { id: 'blue', label: '蓝', dark: '#3b82f6', light: '#38bdf8' },
  { id: 'green', label: '绿', dark: '#10b981', light: '#4ade80' },
  { id: 'cyan', label: '青', dark: '#06b6d4', light: '#22d3ee' },
  { id: 'purple', label: '紫', dark: '#8b5cf6', light: '#c084fc' },
  { id: 'pink', label: '粉', dark: '#ec4899', light: '#f9a8d4' },
  { id: 'orange', label: '橙', dark: '#f97316', light: '#fb923c' },
  { id: 'custom', label: '自定义', dark: DEFAULT_CUSTOM_DARK, light: DEFAULT_CUSTOM_LIGHT },
];

function isAppearanceId(value: string): value is AppearanceId {
  return APPEARANCES.some((t) => t.id === value);
}

function isColorId(value: string): value is ThemeColorId {
  return THEME_COLORS.some((t) => t.id === value);
}

function getMode(appearance: AppearanceId): ThemeMode {
  return APPEARANCES.find((t) => t.id === appearance)?.mode ?? 'dark';
}

function safeHex(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function loadTheme(): ThemeState {
  let appearance = DEFAULT_APPEARANCE;
  let color = DEFAULT_COLOR;
  let customDark = DEFAULT_CUSTOM_DARK;
  let customLight = DEFAULT_CUSTOM_LIGHT;

  try {
    const savedAppearance = localStorage.getItem(APPEARANCE_KEY);
    const savedColor = localStorage.getItem(COLOR_KEY);
    const savedCustomDark = localStorage.getItem(CUSTOM_DARK_KEY);
    const savedCustomLight = localStorage.getItem(CUSTOM_LIGHT_KEY);

    if (savedAppearance && isAppearanceId(savedAppearance)) appearance = savedAppearance;
    if (savedColor && isColorId(savedColor)) color = savedColor;
    if (savedCustomDark) customDark = safeHex(savedCustomDark, DEFAULT_CUSTOM_DARK);
    if (savedCustomLight) customLight = safeHex(savedCustomLight, DEFAULT_CUSTOM_LIGHT);
  } catch {}

  return { appearance, color, customDark, customLight };
}

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace('#', '');
  return [
    parseInt(raw.slice(0, 2), 16),
    parseInt(raw.slice(2, 4), 16),
    parseInt(raw.slice(4, 6), 16),
  ];
}

function mix(a: [number, number, number], b: [number, number, number], weight: number): [number, number, number] {
  return [
    Math.round(a[0] * (1 - weight) + b[0] * weight),
    Math.round(a[1] * (1 - weight) + b[1] * weight),
    Math.round(a[2] * (1 - weight) + b[2] * weight),
  ];
}

function rgbValue(rgb: [number, number, number]): string {
  return `${rgb[0]} ${rgb[1]} ${rgb[2]}`;
}

function cssRgb(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function getBaseColor(state: ThemeState): string {
  const mode = getMode(state.appearance);
  if (state.color === 'custom') {
    return mode === 'dark' ? safeHex(state.customDark, DEFAULT_CUSTOM_DARK) : safeHex(state.customLight, DEFAULT_CUSTOM_LIGHT);
  }
  const option = THEME_COLORS.find((item) => item.id === state.color);
  return mode === 'dark' ? (option?.dark ?? DEFAULT_CUSTOM_DARK) : (option?.light ?? DEFAULT_CUSTOM_LIGHT);
}

function applyPrimaryScale(root: HTMLElement, baseHex: string, mode: ThemeMode) {
  const base = hexToRgb(baseHex);
  const white: [number, number, number] = [255, 255, 255];
  const black: [number, number, number] = [0, 0, 0];
  const scale: Record<string, [number, number, number]> = {
    50: mix(base, white, 0.92),
    100: mix(base, white, 0.84),
    200: mix(base, white, 0.68),
    300: mix(base, white, 0.48),
    400: mix(base, white, 0.24),
    500: base,
    600: mix(base, black, 0.14),
    700: mix(base, black, 0.28),
    800: mix(base, black, 0.42),
    900: mix(base, black, 0.56),
    950: mix(base, black, 0.72),
  };

  Object.entries(scale).forEach(([key, rgb]) => {
    root.style.setProperty(`--color-primary-${key}`, rgbValue(rgb));
  });

  if (mode === 'light') {
    root.style.setProperty('--button-gradient-from', cssRgb(scale[100]));
    root.style.setProperty('--button-gradient-to', cssRgb(scale[300]));
    root.style.setProperty('--button-gradient-hover-from', cssRgb(scale[50]));
    root.style.setProperty('--button-gradient-hover-to', cssRgb(scale[200]));
  } else {
    root.style.setProperty('--button-gradient-from', cssRgb(scale[400]));
    root.style.setProperty('--button-gradient-to', cssRgb(scale[600]));
    root.style.setProperty('--button-gradient-hover-from', cssRgb(scale[300]));
    root.style.setProperty('--button-gradient-hover-to', cssRgb(scale[500]));
  }
  root.style.setProperty('--accent-text', cssRgb(scale[700]));
  root.style.setProperty('--button-border', `rgba(${scale[700][0]}, ${scale[700][1]}, ${scale[700][2]}, 0.24)`);
  root.style.setProperty('--button-shadow', `rgba(${scale[500][0]}, ${scale[500][1]}, ${scale[500][2]}, 0.24)`);
  root.style.setProperty('--admin-header-from', mode === 'light' ? `rgba(${scale[50][0]}, ${scale[50][1]}, ${scale[50][2]}, 0.96)` : `rgba(${scale[300][0]}, ${scale[300][1]}, ${scale[300][2]}, 0.9)`);
  root.style.setProperty('--admin-header-to', mode === 'light' ? `rgba(${scale[200][0]}, ${scale[200][1]}, ${scale[200][2]}, 0.9)` : `rgba(${scale[500][0]}, ${scale[500][1]}, ${scale[500][2]}, 0.82)`);
  root.style.setProperty('--admin-title', cssRgb(scale[950]));
}

function applyTheme(state: ThemeState) {
  const root = document.documentElement;
  const mode = getMode(state.appearance);

  root.dataset.theme = state.appearance;
  root.dataset.appearance = state.appearance;
  root.dataset.themeMode = mode;
  root.dataset.themeColor = state.color;
  applyPrimaryScale(root, getBaseColor(state), mode);
}

function persistTheme(state: ThemeState) {
  try {
    localStorage.setItem(APPEARANCE_KEY, state.appearance);
    localStorage.setItem(COLOR_KEY, state.color);
    localStorage.setItem(CUSTOM_DARK_KEY, state.customDark);
    localStorage.setItem(CUSTOM_LIGHT_KEY, state.customLight);
  } catch {}
}

export function useTheme() {
  const [state, setThemeState] = useState<ThemeState>(loadTheme);

  useEffect(() => {
    applyTheme(state);
  }, [state]);

  useEffect(() => {
    const onThemeChange = (event: Event) => {
      setThemeState((event as CustomEvent<ThemeState>).detail);
    };
    const onStorage = (event: StorageEvent) => {
      if ([APPEARANCE_KEY, COLOR_KEY, CUSTOM_DARK_KEY, CUSTOM_LIGHT_KEY].includes(event.key || '')) {
        setThemeState(loadTheme());
      }
    };

    window.addEventListener(THEME_EVENT, onThemeChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(THEME_EVENT, onThemeChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const updateTheme = useCallback((patch: Partial<ThemeState>) => {
    setThemeState((prev) => {
      const next = {
        ...prev,
        ...patch,
        customDark: safeHex(patch.customDark ?? prev.customDark, DEFAULT_CUSTOM_DARK),
        customLight: safeHex(patch.customLight ?? prev.customLight, DEFAULT_CUSTOM_LIGHT),
      };
      persistTheme(next);
      window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
      return next;
    });
  }, []);

  return {
    ...state,
    mode: getMode(state.appearance),
    setAppearance: (appearance: AppearanceId) => updateTheme({ appearance }),
    setColor: (color: ThemeColorId) => updateTheme({ color }),
    setCustomDark: (customDark: string) => updateTheme({ customDark }),
    setCustomLight: (customLight: string) => updateTheme({ customLight }),
  };
}
