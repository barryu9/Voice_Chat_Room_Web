import React from 'react';
import { useVoiceChangerStore } from '../../stores/voiceChangerStore';
import { updateVoiceChangerParams } from '../../services/voiceChangerService';
import { VOICE_PRESETS } from '../../utils/voicePresets';

interface Props {
  onToggle: (enabled: boolean) => void;
  onParamsChange: () => void;
}

export const VoiceChangerControls: React.FC<Props> = ({ onToggle, onParamsChange }) => {
  const enabled = useVoiceChangerStore((s) => s.enabled);
  const presetId = useVoiceChangerStore((s) => s.presetId);
  const pitch = useVoiceChangerStore((s) => s.pitch);
  const distortion = useVoiceChangerStore((s) => s.distortion);
  const filterFreq = useVoiceChangerStore((s) => s.filterFreq);
  const filterQ = useVoiceChangerStore((s) => s.filterQ);
  const reverbWet = useVoiceChangerStore((s) => s.reverbWet);

  const applyPreset = useVoiceChangerStore((s) => s.applyPreset);
  const setParam = useVoiceChangerStore((s) => s.setParam);

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    applyPreset(id);
    onParamsChange();
  };

  const handleParam = (key: 'pitch' | 'distortion' | 'filterFreq' | 'filterQ' | 'reverbWet', value: number) => {
    setParam(key, value);
    onParamsChange();
  };

  return (
    <div className="space-y-2 pt-3 border-t border-gray-700/50">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">变声器</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(!enabled); }}
          className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-primary-500' : 'bg-gray-600'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {enabled && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-8">预设</span>
            <select
              value={presetId}
              onChange={handlePresetChange}
              className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-2 h-7 text-xs text-white focus:outline-none focus:border-primary-500/50"
            >
              {Object.entries(VOICE_PRESETS).map(([id, p]) => (
                <option key={id} value={id}>{p.label}</option>
              ))}
              <option value="custom">自定义</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <SliderRow label="音调" value={pitch} min={-12} max={12} step={1} unit="st"
              onChange={(v) => handleParam('pitch', v)} />
            <SliderRow label="失真度" value={distortion} min={0} max={1} step={0.01}
              onChange={(v) => handleParam('distortion', v)} />
            <SliderRow label="滤波器" value={filterFreq} min={50} max={8000} step={10} unit="Hz"
              onChange={(v) => handleParam('filterFreq', v)} />
            <SliderRow label="Q值" value={filterQ} min={0.1} max={20} step={0.1}
              onChange={(v) => handleParam('filterQ', v)} />
            <SliderRow label="混响" value={reverbWet} min={0} max={1} step={0.01}
              onChange={(v) => handleParam('reverbWet', v)} />
          </div>
        </>
      )}
    </div>
  );
};

const SliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step, unit = '', onChange }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-gray-400 w-10">{label}</span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="flex-1 h-1.5 accent-primary-500 cursor-pointer"
    />
    <span className="text-xs text-gray-400 w-10 text-right">
      {step < 1 ? value.toFixed(2) : value}{unit}
    </span>
  </div>
);
