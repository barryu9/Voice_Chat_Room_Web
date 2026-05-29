import React, { useState } from 'react';
import { useSoundStore, SoundKey, SOUND_LABELS } from '../../stores/soundStore';
import { previewSound } from '../../services/soundService';
import { ThemeSwitcher } from './ThemeSwitcher';

const SOUND_KEYS = Object.keys(SOUND_LABELS) as SoundKey[];

interface PreferencesModalProps {
  onClose: () => void;
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({ onClose }) => {
  const enabled = useSoundStore((s) => s.enabled);
  const toggle = useSoundStore((s) => s.toggle);

  const allOn = SOUND_KEYS.every((k) => enabled[k]);

  const toggleAll = () => {
    SOUND_KEYS.forEach((k) => {
      if (enabled[k] !== !allOn) toggle(k);
    });
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-sm p-4 shadow-xl animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">偏好设置</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/5 p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            title="关闭"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="glass-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-medium text-gray-400">提示音设置</h4>
            <button
              type="button"
              onClick={toggleAll}
              className="text-[10px] text-primary-400 transition-colors hover:text-primary-300"
            >
              {allOn ? '全部关闭' : '全部开启'}
            </button>
          </div>

          <div className="max-h-40 space-y-1 overflow-y-auto">
            {SOUND_KEYS.map((key) => (
              <div
                key={key}
                className="flex items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-white/5"
              >
                <button
                  type="button"
                  onClick={() => previewSound(key)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gray-600/50 bg-gray-800/60 text-primary-400 transition-colors hover:border-primary-500/50 hover:text-primary-300"
                  title={`预览${SOUND_LABELS[key]}`}
                >
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M6.3 4.2A1 1 0 005 5v10a1 1 0 001.55.83l7.5-5a1 1 0 000-1.66l-7.5-5a1 1 0 00-.25-.12z" />
                  </svg>
                </button>
                <label className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2">
                  <span className="truncate text-xs text-gray-300">{SOUND_LABELS[key]}</span>
                  <input
                    type="checkbox"
                    checked={enabled[key]}
                    onChange={() => toggle(key)}
                    className="h-4 w-4 shrink-0 rounded border-gray-600 bg-gray-800 text-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <ThemeSwitcher variant="login" />
        </div>
      </div>
    </div>
  );
};

export const SettingsPanel: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(true)}
        className={`p-3 sm:p-2 rounded-lg transition-all ${
          open
            ? 'bg-primary-600/30 text-primary-300'
            : 'bg-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/10'
        }`}
        title="提示音与外观设置"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>

      {open && <PreferencesModal onClose={() => setOpen(false)} />}
    </div>
  );
};
