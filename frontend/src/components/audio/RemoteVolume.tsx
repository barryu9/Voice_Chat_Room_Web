import React, { useState } from 'react';
import { useMediaStore } from '../../stores/mediaStore';
import { setRemoteVolume } from '../../services/audioService';

interface RemoteVolumeProps {
  producerDeviceId: string;
}

export const RemoteVolume: React.FC<RemoteVolumeProps> = ({ producerDeviceId }) => {
  const remoteAudioGains = useMediaStore((s) => s.remoteAudioGains);
  const setRemoteAudioGain = useMediaStore((s) => s.setRemoteAudioGain);
  const currentGain = remoteAudioGains.get(producerDeviceId) ?? 1.0;
  const [value, setValue] = useState(currentGain);

  const handleChange = (v: number) => {
    setValue(v);
    setRemoteAudioGain(producerDeviceId, v);
    const pid = useMediaStore.getState().getProducerIdByDeviceId(producerDeviceId);
    if (pid) {
      setRemoteVolume(pid, v);
    }
  };

  return (
    <div className="glass-card px-2 py-1 flex items-center gap-1.5">
      <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072" />
      </svg>
      <input
        type="range"
        min="0"
        max="2"
        step="0.1"
        value={value}
        onChange={(e) => handleChange(parseFloat(e.target.value))}
        className="w-16 h-1 accent-primary-500 cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      />
      <span className="text-xs text-gray-400 w-7">{value.toFixed(1)}</span>
    </div>
  );
};
