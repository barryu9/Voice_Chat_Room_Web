import { create } from 'zustand';
import { VoiceParams, VOICE_PRESETS, resolvePresetId } from '../utils/voicePresets';

interface VoiceChangerState {
  enabled: boolean;
  chainReady: boolean;
  presetId: string;
  pitch: number;
  distortion: number;
  filterFreq: number;
  filterQ: number;
  reverbWet: number;

  setEnabled: (v: boolean) => void;
  setChainReady: (v: boolean) => void;
  applyPreset: (presetId: string) => void;
  setParam: (key: keyof VoiceParams, value: number) => void;
  getParams: () => VoiceParams;
  reset: () => void;
}

const DEFAULTS: VoiceParams = {
  pitch: 0,
  distortion: 0,
  filterFreq: 1000,
  filterQ: 1.0,
  reverbWet: 0,
};

const STORAGE_KEY = 'vc_voice_changer';

function loadParams(): { presetId: string; pitch: number; distortion: number; filterFreq: number; filterQ: number; reverbWet: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return {
        presetId: saved.presetId || 'custom',
        pitch: saved.pitch ?? DEFAULTS.pitch,
        distortion: saved.distortion ?? DEFAULTS.distortion,
        filterFreq: saved.filterFreq ?? DEFAULTS.filterFreq,
        filterQ: saved.filterQ ?? DEFAULTS.filterQ,
        reverbWet: saved.reverbWet ?? DEFAULTS.reverbWet,
      };
    }
  } catch {}
  return { presetId: 'custom', ...DEFAULTS };
}

function saveParams(state: VoiceChangerState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      presetId: state.presetId,
      pitch: state.pitch,
      distortion: state.distortion,
      filterFreq: state.filterFreq,
      filterQ: state.filterQ,
      reverbWet: state.reverbWet,
    }));
  } catch {}
}

export const useVoiceChangerStore = create<VoiceChangerState>((set, get) => ({
  enabled: false,
  chainReady: false,
  ...loadParams(),

  setEnabled: (v) => set({ enabled: v }),
  setChainReady: (v) => set({ chainReady: v }),

  applyPreset: (id) => {
    if (id === 'custom') {
      const state = { presetId: 'custom' as const };
      set(state);
      saveParams({ ...get(), ...state });
      return;
    }
    const preset = VOICE_PRESETS[id];
    if (preset) {
      const state = { presetId: id, ...preset.params };
      set(state);
      saveParams({ ...get(), ...state });
    }
  },

  setParam: (key, value) => {
    const next = { ...get(), [key]: value };
    set(next);
    const currentParams = get().getParams();
    const matchedId = resolvePresetId(currentParams);
    set({ presetId: matchedId });
    saveParams({ ...get(), presetId: matchedId });
  },

  getParams: () => ({
    pitch: get().pitch,
    distortion: get().distortion,
    filterFreq: get().filterFreq,
    filterQ: get().filterQ,
    reverbWet: get().reverbWet,
  }),

  reset: () => set({ enabled: false, chainReady: false, presetId: 'custom', ...DEFAULTS }),
}));
