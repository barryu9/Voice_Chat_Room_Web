import React from 'react';
import { APPEARANCES, THEME_COLORS, useTheme, type AppearanceId, type ThemeColorId } from '../../hooks/useTheme';

export const ThemeSwitcher: React.FC = () => {
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
