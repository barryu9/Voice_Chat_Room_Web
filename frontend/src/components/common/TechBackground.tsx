import React from 'react';
import { useTheme, type ThemeId } from '../../hooks/useTheme';

const GLOW_COLORS: Record<ThemeId, { top: string; bottom: string; orb: string }> = {
  purple: {
    top: 'from-primary-500/25',
    bottom: 'from-primary-500/15',
    orb: 'bg-primary-500/20',
  },
  yellow: {
    top: 'from-primary-400/30',
    bottom: 'from-primary-500/20',
    orb: 'bg-primary-400/20',
  },
  green: {
    top: 'from-primary-500/25',
    bottom: 'from-primary-500/15',
    orb: 'bg-primary-500/20',
  },
  light: {
    top: 'from-yellow-200/30',
    bottom: 'from-amber-100/25',
    orb: 'bg-yellow-200/15',
  },
  'light-green': {
    top: 'from-emerald-200/30',
    bottom: 'from-green-100/25',
    orb: 'bg-emerald-200/15',
  },
  'light-blue': {
    top: 'from-sky-200/30',
    bottom: 'from-blue-100/25',
    orb: 'bg-sky-200/15',
  },
};

export const TechBackground: React.FC = () => {
  const { theme } = useTheme();
  const glow = GLOW_COLORS[theme];

  return (
    <div className="absolute inset-0 -z-10 pointer-events-none bg-[var(--bg-body)]">
      <div className={`absolute inset-0 opacity-35 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${glow.top} via-transparent to-transparent`} />
      <div className={`absolute inset-0 opacity-25 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] ${glow.bottom} via-transparent to-transparent`} />
      <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full ${glow.orb} blur-[120px]`} />
      <div className={`absolute bottom-1/3 right-1/3 w-[400px] h-[400px] rounded-full ${glow.orb} blur-[100px]`} />
      <div className={`absolute top-16 left-8 sm:left-20 w-48 h-48 rounded-full ${glow.orb} blur-[80px] opacity-70`} />
    </div>
  );
};
