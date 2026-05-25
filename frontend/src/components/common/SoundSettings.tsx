import React, { useState } from 'react';
import { useSoundStore, SoundKey, SOUND_LABELS } from '../../stores/soundStore';

const SOUND_KEYS = Object.keys(SOUND_LABELS) as SoundKey[];

export const SoundSettings: React.FC = () => {
  const [open, setOpen] = useState(false);
  const enabled = useSoundStore((s) => s.enabled);
  const toggle = useSoundStore((s) => s.toggle);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`p-2 rounded-lg transition-all ${
          open
            ? 'bg-primary-600/30 text-primary-300'
            : 'bg-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/10'
        }`}
        title="音效设置"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 glass-panel p-3 z-50 shadow-xl animate-in slide-in-from-top-2 fade-in duration-150">
          <h4 className="text-xs font-medium text-gray-400 mb-2">音效设置</h4>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {SOUND_KEYS.map((key) => (
              <label
                key={key}
                className="flex items-center justify-between px-2 py-1 rounded hover:bg-white/5 cursor-pointer transition-colors"
              >
                <span className="text-xs text-gray-300">{SOUND_LABELS[key]}</span>
                <input
                  type="checkbox"
                  checked={enabled[key]}
                  onChange={() => toggle(key)}
                  className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-primary-500 focus:ring-primary-500 focus:ring-1"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
