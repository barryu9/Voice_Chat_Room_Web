import { create } from 'zustand';

interface VoiceChangerState {
  enabled: boolean;
  chainReady: boolean;
  presetId: string;

  setEnabled: (v: boolean) => void;
  setChainReady: (v: boolean) => void;
  applyPreset: (presetId: string) => void;
  reset: () => void;
}

export const useVoiceChangerStore = create<VoiceChangerState>((set) => ({
  enabled: false,
  chainReady: false,
  presetId: 'male-to-female',

  setEnabled: (v) => set({ enabled: v }),
  setChainReady: (v) => set({ chainReady: v }),
  applyPreset: (id) => set({ presetId: id }),
  reset: () => set({ enabled: false, chainReady: false, presetId: 'male-to-female' }),
}));
