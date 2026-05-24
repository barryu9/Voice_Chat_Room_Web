import React from 'react';

interface LatencyIndicatorProps {
  latency: number;
}

export const LatencyIndicator: React.FC<LatencyIndicatorProps> = ({ latency }) => {
  let bars: number;
  let color: string;

  if (latency <= 50) {
    bars = 4;
    color = '#22c55e';
  } else if (latency <= 150) {
    bars = 2;
    color = '#eab308';
  } else {
    bars = 1;
    color = '#ef4444';
  }

  return (
    <div className="flex items-center gap-0.5 shrink-0" title={`延迟: ${latency}ms`}>
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className="w-1 rounded-sm transition-colors"
          style={{
            height: n * 3 + 3,
            backgroundColor: n <= bars ? color : '#374151',
            opacity: n <= bars ? 1 : 0.4,
          }}
        />
      ))}
      <span className="text-xs ml-1" style={{ color }}>{latency}ms</span>
    </div>
  );
};
