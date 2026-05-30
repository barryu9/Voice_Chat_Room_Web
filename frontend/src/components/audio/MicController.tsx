import React from 'react';

interface MicControllerProps {
  gain: number;
  muted: boolean;
  threshold: number;
  audioLevel: number;
  noiseSuppressionEnabled: boolean;
  noiseSuppressionStrength: number;
  onToggleMute: () => void;
  onGainChange: (v: number) => void;
  onThresholdChange: (v: number) => void;
  onNoiseSuppressionToggle: () => void;
  onNoiseSuppressionStrengthChange: (v: number) => void;
}

function levelPercent(db: number): number {
  return Math.max(0, Math.min(100, ((db + 45) / 30) * 100));
}

export const MicController: React.FC<MicControllerProps> = ({
  gain, muted, threshold, audioLevel,
  noiseSuppressionEnabled, noiseSuppressionStrength,
  onToggleMute, onGainChange, onThresholdChange,
  onNoiseSuppressionToggle, onNoiseSuppressionStrengthChange,
}) => {
  const pct = levelPercent(audioLevel);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onToggleMute}
        className={`relative p-2.5 rounded-xl transition-all active:scale-95 overflow-hidden ${
          muted
            ? 'bg-red-600/30 text-red-400 border border-red-500/30'
            : 'bg-gray-800/60 text-gray-300 border border-gray-600/50 hover:border-primary-500/40'
        }`}
        title={muted ? '取消静音' : '静音'}
      >
        <div
          className="absolute bottom-0 left-0 right-0 bg-green-500/40 transition-all duration-100"
          style={{ height: muted ? '0%' : `${pct}%` }}
        />
        {muted ? (
          <svg className="w-5 h-5 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" />
          </svg>
        ) : (
          <svg className="w-5 h-5 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-8">增益</span>
          <input
            type="range"
            min="0"
            max="4"
            step="0.1"
            value={gain}
            onChange={(e) => onGainChange(parseFloat(e.target.value))}
            className="w-20 h-1.5 accent-primary-500 cursor-pointer"
          />
          <span className="text-xs text-gray-400 w-8">{gain.toFixed(1)}x</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-8">阈值</span>
          <input
            type="range"
            min="-60"
            max="-30"
            step="1"
            value={threshold}
            onChange={(e) => onThresholdChange(parseInt(e.target.value))}
            className="w-20 h-1.5 accent-primary-500 cursor-pointer"
          />
          <span className="text-xs text-gray-400 w-8">{threshold}dB</span>
        </div>
      </div>

      <div className="flex flex-col gap-1 ml-2 pl-2 border-l border-gray-700/50">
        <div className="flex items-center gap-2">
          <button
            onClick={onNoiseSuppressionToggle}
            className={`text-xs px-2 py-0.5 rounded transition-all ${
              noiseSuppressionEnabled
                ? 'bg-primary-600/30 text-primary-300 border border-primary-500/30'
                : 'bg-gray-800/60 text-gray-400 border border-gray-600/50'
            }`}
            title="降噪开关"
          >
            降噪
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={noiseSuppressionStrength}
            onChange={(e) => onNoiseSuppressionStrengthChange(parseFloat(e.target.value))}
            className="w-16 h-1.5 accent-primary-500 cursor-pointer"
            title={`降噪强度 ${Math.round(noiseSuppressionStrength * 100)}%`}
          />
          <span className="text-xs text-gray-400 w-8">{Math.round(noiseSuppressionStrength * 100)}%</span>
        </div>
      </div>
    </div>
  );
};
