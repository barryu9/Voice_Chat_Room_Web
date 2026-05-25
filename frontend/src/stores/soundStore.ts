import { create } from 'zustand';

export type SoundKey =
  | 'connected'
  | 'connectionLost'
  | 'disconnected'
  | 'micActivated'
  | 'micMuted'
  | 'otherJoined'
  | 'otherLeft'
  | 'otherDisconnected'
  | 'soundMuted'
  | 'soundResumed';

export const SOUND_LABELS: Record<SoundKey, string> = {
  connected:           '自己进入频道',
  connectionLost:      '连接断开',
  disconnected:        '离开频道',
  micActivated:        '打开麦克风',
  micMuted:            '关闭麦克风',
  otherJoined:         '他人进入频道',
  otherLeft:           '他人离开频道',
  otherDisconnected:   '他人掉线',
  soundMuted:          '静音扬声器',
  soundResumed:        '恢复扬声器',
};

export const SOUND_FILES: Record<SoundKey, string> = {
  connected:           '/sounds/connected.wav',
  connectionLost:      '/sounds/connection_lost.wav',
  disconnected:        '/sounds/disconnected.wav',
  micActivated:        '/sounds/mic_activated.wav',
  micMuted:            '/sounds/mic_muted.wav',
  otherJoined:         '/sounds/neutral_connection_connected_currentchannel.wav',
  otherLeft:           '/sounds/neutral_connection_disconnected_currentchannel.wav',
  otherDisconnected:   '/sounds/neutral_connection_connectionlost_currentchannel.wav',
  soundMuted:          '/sounds/sound_muted.wav',
  soundResumed:        '/sounds/sound_resumed.wav',
};

const STORAGE_KEY = 'vc_sound_settings';

function loadSettings(): Record<SoundKey, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    connected: true,
    connectionLost: true,
    disconnected: true,
    micActivated: true,
    micMuted: true,
    otherJoined: true,
    otherLeft: true,
    otherDisconnected: true,
    soundMuted: true,
    soundResumed: true,
  } as Record<SoundKey, boolean>;
}

function saveSettings(settings: Record<SoundKey, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

interface SoundState {
  enabled: Record<SoundKey, boolean>;
  toggle: (key: SoundKey) => void;
  isEnabled: (key: SoundKey) => boolean;
}

export const useSoundStore = create<SoundState>((set, get) => ({
  enabled: loadSettings(),

  toggle: (key) =>
    set((s) => {
      const next = { ...s.enabled, [key]: !s.enabled[key] };
      saveSettings(next);
      return { enabled: next };
    }),

  isEnabled: (key) => get().enabled[key],
}));
