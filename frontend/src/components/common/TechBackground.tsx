import React from 'react';
import { useTheme } from '../../hooks/useTheme';

const GLOW_COLORS: Record<string, { blob1: string; blob2: string }> = {
  purple:  { blob1: 'from-primary-500/20',  blob2: 'bg-primary-500/10' },
  green:   { blob1: 'from-primary-500/20',  blob2: 'bg-primary-500/10' },
  yellow:  { blob1: 'from-yellow-400/25',   blob2: 'bg-yellow-400/12' },
  light:   { blob1: 'from-yellow-400/25',   blob2: 'bg-yellow-400/12' },
};

export const TechBackground: React.FC = () => {
  const { theme } = useTheme();
  const g = GLOW_COLORS[theme] || GLOW_COLORS.purple;

  return (
    <div className="absolute inset-0 -z-10 pointer-events-none bg-[var(--bg-body)]">
      <div className={`absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${g.blob1} via-transparent to-transparent`} />
      <div className={`absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-primary-500/10 via-transparent to-transparent`} />
      <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full ${g.blob2} blur-[120px]`} />
      <div className={`absolute bottom-1/3 right-1/3 w-[400px] h-[400px] rounded-full ${g.blob2} blur-[100px]`} />
    </div>
  );
};
