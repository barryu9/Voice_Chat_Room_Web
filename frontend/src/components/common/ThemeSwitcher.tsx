import React from 'react';
import { APPEARANCES, THEME_COLORS, useTheme, type AppearanceId, type ThemeColorId } from '../../hooks/useTheme';

interface ThemeSwitcherProps {
  variant?: 'compact' | 'login';
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ variant = 'compact' }) => {
  const {
    appearance,
    color,
    mode,
    customDark,
    customLight,
    setAppearance,
    setColor,
    setCustomDark,
    setCustomLight,
  } = useTheme();
  const customValue = mode === 'dark' ? customDark : customLight;

  if (variant === 'login') {
    return (
      <div className="theme-switcher-login glass-card w-full rounded-2xl p-3 shadow-lg">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-gray-400">选择外观</p>
          </div>
          <span className="current-theme-pill rounded-full border border-primary-500/30 bg-primary-500/10 px-2 py-1 text-[10px] text-primary-300">
            {APPEARANCES.find((item) => item.id === appearance)?.label} / {THEME_COLORS.find((item) => item.id === color)?.label}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {APPEARANCES.map((item) => {
            const active = item.id === appearance;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setAppearance(item.id)}
                className={`h-8 rounded-lg border text-xs transition-all ${
                  active
                    ? 'border-primary-400 bg-primary-500/20 text-primary-200 shadow-[0_0_18px_rgb(var(--color-primary-500)_/_0.18)]'
                    : 'border-gray-700/50 bg-gray-800/35 text-gray-400 hover:border-primary-500/35 hover:text-gray-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="w-8 shrink-0 text-[10px] text-gray-500">主色</span>
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {THEME_COLORS.map((item) => {
              const active = item.id === color;
              const custom = item.id === 'custom';
              const swatch = item.id === 'custom' ? customValue : (mode === 'dark' ? item.dark : item.light);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.label}
                  aria-pressed={active}
                  title={item.label}
                  onClick={() => setColor(item.id)}
                  className={`theme-color-swatch ${custom ? 'theme-color-swatch-custom' : ''} relative h-6 w-6 rounded-full border transition-all ${
                    active
                      ? 'border-white shadow-[0_0_0_2px_rgb(var(--color-primary-500)_/_0.45)] scale-105'
                      : 'border-gray-600/50 hover:border-gray-300/70'
                  }`}
                  style={{ '--swatch': swatch } as React.CSSProperties}
                />
              );
            })}
          </div>
        </div>

        {color === 'custom' && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="color"
              value={customValue}
              onChange={(e) => {
                if (mode === 'dark') setCustomDark(e.target.value);
                else setCustomLight(e.target.value);
              }}
              className="h-7 w-9 cursor-pointer rounded-lg border border-gray-600/50 bg-gray-800/60 p-0.5"
              title={mode === 'dark' ? '暗主题主色' : '亮主题主色'}
            />
            <span className="text-[10px] text-gray-500">
              {mode === 'dark' ? '暗主题主色' : '亮主题主色'}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full">
      <select
        value={appearance}
        onChange={(e) => setAppearance(e.target.value as AppearanceId)}
        className="w-full bg-primary-600/20 border border-primary-500/30 rounded-lg px-2 h-7 text-xs text-primary-300 focus:outline-none focus:border-primary-500/50 cursor-pointer"
      >
        {APPEARANCES.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>

      <select
        value={color}
        onChange={(e) => setColor(e.target.value as ThemeColorId)}
        className="w-full bg-primary-600/20 border border-primary-500/30 rounded-lg px-2 h-7 text-xs text-primary-300 focus:outline-none focus:border-primary-500/50 cursor-pointer"
      >
        {THEME_COLORS.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>

      {color === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={customValue}
            onChange={(e) => {
              if (mode === 'dark') setCustomDark(e.target.value);
              else setCustomLight(e.target.value);
            }}
            className="w-8 h-7 p-0.5 rounded-lg border border-gray-600/50 bg-gray-800/60 cursor-pointer"
            title={mode === 'dark' ? '暗主题主色' : '亮主题主色'}
          />
          <span className="text-[10px] text-gray-500">
            {mode === 'dark' ? '暗主题主色' : '亮主题主色'}
          </span>
        </div>
      )}
    </div>
  );
};
