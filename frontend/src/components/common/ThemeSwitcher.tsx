import React from 'react';
import { useTheme, THEMES } from '../../hooks/useTheme';

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value as typeof theme)}
      className="bg-transparent border border-gray-600/50 rounded-lg px-2 h-7 text-xs text-gray-400 focus:outline-none focus:border-primary-500/50 cursor-pointer"
    >
      {THEMES.map((t) => (
        <option key={t.id} value={t.id}>{t.label}</option>
      ))}
    </select>
  );
};
