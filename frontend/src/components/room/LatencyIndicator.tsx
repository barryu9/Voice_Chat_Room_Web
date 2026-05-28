import React from 'react';

interface LatencyIndicatorProps {
  latency: number;
}

export const LatencyIndicator: React.FC<LatencyIndicatorProps> = ({ latency }) => {
  let color: string;

  if (latency <= 50) {
    color = '#22c55e';
  } else if (latency <= 150) {
    color = '#eab308';
  } else {
    color = '#ef4444';
  }

  return (
    <span className="inline-flex items-center gap-0.5 shrink-0" title={`延迟: ${latency}ms`}>
      <svg className="w-2 h-2" viewBox="0 0 8 8">
        <circle cx="4" cy="4" r="4" fill={color} />
      </svg>
      <span className="text-[10px]" style={{ color }}>{latency}ms</span>
    </span>
  );
};
