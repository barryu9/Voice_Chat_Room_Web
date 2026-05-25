import React, { useState, useEffect } from 'react';
import { useMediaStore } from '../../stores/mediaStore';
import { setRemoteVolume } from '../../services/audioService';

const STORAGE_KEY = 'vc_remote_volumes';

function loadVolumes(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveVolumes(vols: Record<string, number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vols));
  } catch {}
}

interface RemoteVolumeProps {
  producerDeviceId: string;
}

export const RemoteVolume: React.FC<RemoteVolumeProps> = ({ producerDeviceId }) => {
  const remoteAudioGains = useMediaStore((s) => s.remoteAudioGains);
  const setRemoteAudioGain = useMediaStore((s) => s.setRemoteAudioGain);
  const isVoiceConnected = useMediaStore((s) => s.isVoiceConnected);

  const [value, setValue] = useState(() => {
    const saved = loadVolumes()[producerDeviceId];
    if (saved !== undefined) return saved;
    return remoteAudioGains.get(producerDeviceId) ?? 1.0;
  });

  useEffect(() => {
    const saved = loadVolumes()[producerDeviceId];
    if (saved !== undefined) {
      setValue(saved);
      setRemoteAudioGain(producerDeviceId, saved);
      const pid = useMediaStore.getState().getProducerIdByDeviceId(producerDeviceId);
      if (pid) {
        setRemoteVolume(pid, saved);
      }
    }
  }, [producerDeviceId]);

  const handleChange = (v: number) => {
    setValue(v);
    setRemoteAudioGain(producerDeviceId, v);

    const vols = loadVolumes();
    vols[producerDeviceId] = v;
    saveVolumes(vols);

    const pid = useMediaStore.getState().getProducerIdByDeviceId(producerDeviceId);
    if (pid) {
      setRemoteVolume(pid, v);
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      <input
        type="range"
        min="0"
        max="2"
        step="0.1"
        value={value}
        onChange={(e) => handleChange(parseFloat(e.target.value))}
        className={`w-16 h-1 cursor-pointer ${isVoiceConnected ? 'accent-primary-500' : 'accent-gray-600 opacity-50'}`}
        disabled={!isVoiceConnected}
        onClick={(e) => e.stopPropagation()}
      />
      <span className="text-[10px] text-gray-400 w-6 text-right">{value.toFixed(1)}</span>
    </div>
  );
};
