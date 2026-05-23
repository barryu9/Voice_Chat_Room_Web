import React from 'react';

interface MicControllerProps {
  gain: number;
  muted: boolean;
  threshold: number;
  onToggleMute: () => void;
  onGainChange: (v: number) => void;
  onThresholdChange: (v: number) => void;
}

export const MicController: React.FC<MicControllerProps> = ({
  gain, muted, threshold, onToggleMute, onGainChange, onThresholdChange,
}) => {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onToggleMute}
        className={`p-2.5 rounded-xl transition-all active:scale-95 ${
          muted
            ? 'bg-red-600/30 text-red-400 border border-red-500/30'
            : 'bg-gray-800/60 text-gray-300 border border-gray-600/50 hover:border-primary-500/40'
        }`}
        title={muted ? '取消静音' : '静音'}
      >
        {muted ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-8">增益</span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={gain}
            onChange={(e) => onGainChange(parseFloat(e.target.value))}
            className="w-20 h-1.5 accent-primary-500 cursor-pointer"
          />
          <span className="text-xs text-gray-400 w-8">{gain.toFixed(1)}x</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-8">阈值</span>
          <input
            type="range"
            min="-100"
            max="-20"
            step="1"
            value={threshold}
            onChange={(e) => onThresholdChange(parseInt(e.target.value))}
            className="w-20 h-1.5 accent-primary-500 cursor-pointer"
          />
          <span className="text-xs text-gray-400 w-8">{threshold}dB</span>
        </div>
      </div>
    </div>
  );
};
