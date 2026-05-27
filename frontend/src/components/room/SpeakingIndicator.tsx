import React from 'react';

interface SpeakingIndicatorProps {
  isSpeaking: boolean;
  level: number;
  size?: 'sm' | 'md' | 'lg';
}

export const SpeakingIndicator: React.FC<SpeakingIndicatorProps> = ({ isSpeaking, level, size = 'md' }) => {
  const sizeMap = { sm: 40, md: 56, lg: 72 };

  if (!isSpeaking) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="rounded-full border-[3px] border-green-400/70 animate-pulse-ring"
        style={{
          width: sizeMap[size],
          height: sizeMap[size],
        }}
      />
      <div
        className="rounded-full border-2 border-green-400/50 animate-pulse-ring"
        style={{
          width: sizeMap[size] * 0.7,
          height: sizeMap[size] * 0.7,
          animationDelay: '0.3s',
        }}
      />
    </div>
  );
};
