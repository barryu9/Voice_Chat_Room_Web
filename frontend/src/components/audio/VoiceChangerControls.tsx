import React from 'react';
import { useVoiceChangerStore } from '../../stores/voiceChangerStore';
import { VOICE_PRESETS } from '../../utils/voicePresets';

interface Props {
  onToggle: (enabled: boolean) => void;
  onPresetChange: (presetId: string) => void;
  onPreview: () => void;
  transiting: boolean;
}

export const VoiceChangerControls: React.FC<Props> = ({ onToggle, onPresetChange, onPreview, transiting }) => {
  const enabled = useVoiceChangerStore((s) => s.enabled);
  const presetId = useVoiceChangerStore((s) => s.presetId);

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    useVoiceChangerStore.getState().applyPreset(id);
    onPresetChange(id);
  };

  return (
    <div className="space-y-2 pt-3 border-t border-gray-700/50">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          变声器
          <button
            onClick={(e) => { e.stopPropagation(); if (!transiting) onPreview(); }}
            className="text-gray-500 hover:text-primary-400 transition-colors ml-0.5"
          >
            （预览变声效果）
          </button>
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (!transiting) onToggle(!enabled); }}
          className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-primary-500' : 'bg-gray-600'} ${transiting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {enabled && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-8">预设</span>
          <select
            value={presetId}
            onChange={handlePresetChange}
            disabled={transiting}
            className={`flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-2 h-7 text-xs text-white focus:outline-none focus:border-primary-500/50 ${transiting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {Object.entries(VOICE_PRESETS).map(([id, p]) => (
              <option key={id} value={id}>{p.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
