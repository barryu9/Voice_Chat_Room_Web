import React from 'react';

export const TechBackground: React.FC = () => (
  <div className="absolute inset-0 -z-10 pointer-events-none bg-[var(--bg-body)]">
    <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-500/20 via-transparent to-transparent" />
    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-primary-500/10 via-transparent to-transparent" />
    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary-500/10 blur-[120px]" />
    <div className="absolute bottom-1/3 right-1/3 w-[400px] h-[400px] rounded-full bg-primary-400/8 blur-[100px]" />
  </div>
);
