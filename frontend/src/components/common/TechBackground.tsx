import React from 'react';
import { useTheme } from '../../hooks/useTheme';

export const TechBackground: React.FC = () => {
  const { appearance } = useTheme();
  const flat = appearance === 'pure' || appearance === 'midnight';

  return (
    <div className="absolute inset-0 -z-10 pointer-events-none bg-[var(--bg-body)]">
      {!flat && (
        <>
          <div className="absolute inset-0 opacity-35 bg-[radial-gradient(ellipse_at_top_right,_rgb(var(--color-primary-300)_/_0.32),transparent_58%)]" />
          <div className="absolute inset-0 opacity-25 bg-[radial-gradient(ellipse_at_bottom_left,_rgb(var(--color-primary-200)_/_0.26),transparent_55%)]" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary-300/15 blur-[120px]" />
          <div className="absolute bottom-1/3 right-1/3 w-[400px] h-[400px] rounded-full bg-primary-300/15 blur-[100px]" />
          <div className="absolute top-16 left-8 sm:left-20 w-48 h-48 rounded-full bg-primary-300/15 blur-[80px] opacity-70" />
        </>
      )}
    </div>
  );
};
