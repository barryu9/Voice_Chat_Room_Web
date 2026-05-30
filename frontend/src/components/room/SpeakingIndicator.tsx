import React from 'react';

interface SpeakingIndicatorProps {
  isSpeaking: boolean;
  level: number;
  size?: 'sm' | 'md' | 'lg';
}

export const SpeakingIndicator: React.FC<SpeakingIndicatorProps> = ({ isSpeaking, level, size = 'md' }) => {
  const sizeMap = { sm: 38, md: 52, lg: 68 };
  const normalizedLevel = Math.max(0, Math.min(1, (level + 65) / 35));
  const primarySize = sizeMap[size] * (0.94 + normalizedLevel * 0.08);
  const secondarySize = primarySize * 0.68;

  if (!isSpeaking) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="theme-speaking-pulse-primary rounded-full border-[3px] animate-pulse-ring"
        style={{
          width: primarySize,
          height: primarySize,
        }}
      />
      <div
        className="theme-speaking-pulse-secondary rounded-full border-2 animate-pulse-ring"
        style={{
          width: secondarySize,
          height: secondarySize,
          animationDelay: '0.32s',
        }}
      />
    </div>
  );
};
