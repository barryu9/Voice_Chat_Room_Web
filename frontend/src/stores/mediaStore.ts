import { create } from 'zustand';

interface RemoteProducer {
  producerId: string;
  userId: string;
  deviceId: string;
  kind: string;
}

interface MediaState {
  producerTransport: any | null;
  consumerTransport: any | null;
  producer: any | null;
  consumers: Map<string, any>;
  remoteProducers: Map<string, RemoteProducer>;
  consumedProducerIds: Set<string>;
  remoteAudioGains: Map<string, number>;
  isMicMuted: boolean;
  isVoiceConnected: boolean;
  noiseGateThreshold: number;
  mutedUsers: Set<string>;
  isAllMuted: boolean;
  noiseSuppressionEnabled: boolean;
  noiseSuppressionStrength: number;

  setProducerTransport: (t: any) => void;
  setConsumerTransport: (t: any) => void;
  setProducer: (p: any) => void;
  addConsumer: (id: string, c: any) => void;
  removeConsumer: (id: string) => void;
  addRemoteProducer: (p: RemoteProducer) => void;
  removeRemoteProducer: (producerId: string) => void;
  getProducerIdByDeviceId: (deviceId: string) => string | undefined;
  markConsumed: (producerId: string) => void;
  isConsumed: (producerId: string) => boolean;
  setRemoteAudioGain: (producerId: string, gain: number) => void;
  setMicMuted: (m: boolean) => void;
  setVoiceConnected: (v: boolean) => void;
  setNoiseGateThreshold: (v: number) => void;
  toggleMuteUser: (deviceId: string) => void;
  toggleMuteAll: () => void;
  setNoiseSuppressionEnabled: (v: boolean) => void;
  setNoiseSuppressionStrength: (v: number) => void;
  resetVoice: () => void;
  reset: () => void;
}

export const useMediaStore = create<MediaState>((set, get) => ({
  producerTransport: null,
  consumerTransport: null,
  producer: null,
  consumers: new Map(),
  remoteProducers: new Map(),
  consumedProducerIds: new Set(),
  remoteAudioGains: new Map(),
  isMicMuted: false,
  isVoiceConnected: false,
  noiseGateThreshold: -60,
  mutedUsers: new Set(),
  isAllMuted: false,
  noiseSuppressionEnabled: (() => {
    const saved = localStorage.getItem('vc_denoise_enabled');
    return saved !== null ? saved === 'true' : true;
  })(),
  noiseSuppressionStrength: (() => {
    const saved = localStorage.getItem('vc_denoise_strength');
    return saved !== null ? parseFloat(saved) : 0.5;
  })(),

  setProducerTransport: (t) => set({ producerTransport: t }),
  setConsumerTransport: (t) => set({ consumerTransport: t }),
  setProducer: (p) => set({ producer: p }),
  addConsumer: (id, c) =>
    set((s) => {
      const m = new Map(s.consumers);
      m.set(id, c);
      return { consumers: m };
    }),
  removeConsumer: (id) =>
    set((s) => {
      const m = new Map(s.consumers);
      m.delete(id);
      return { consumers: m };
    }),

  addRemoteProducer: (p) =>
    set((s) => {
      const m = new Map(s.remoteProducers);
      m.set(p.producerId, p);
      return { remoteProducers: m };
    }),
  removeRemoteProducer: (producerId) =>
    set((s) => {
      const m = new Map(s.remoteProducers);
      m.delete(producerId);
      return { remoteProducers: m };
    }),
  getProducerIdByDeviceId: (deviceId) => {
    for (const [pid, info] of get().remoteProducers) {
      if (info.deviceId === deviceId) return pid;
    }
    return undefined;
  },
  markConsumed: (producerId) =>
    set((s) => {
      const ids = new Set(s.consumedProducerIds);
      ids.add(producerId);
      return { consumedProducerIds: ids };
    }),
  isConsumed: (producerId) => get().consumedProducerIds.has(producerId),

  setRemoteAudioGain: (producerId, gain) =>
    set((s) => {
      const m = new Map(s.remoteAudioGains);
      m.set(producerId, gain);
      return { remoteAudioGains: m };
    }),
  setMicMuted: (m) => set({ isMicMuted: m }),
  setVoiceConnected: (v) => set({ isVoiceConnected: v }),
  setNoiseGateThreshold: (v) => set({ noiseGateThreshold: v }),

  setNoiseSuppressionEnabled: (v) => set({ noiseSuppressionEnabled: v }),
  setNoiseSuppressionStrength: (v) => set({ noiseSuppressionStrength: v }),

  toggleMuteUser: (deviceId) =>
    set((s) => {
      const m = new Set(s.mutedUsers);
      if (m.has(deviceId)) m.delete(deviceId);
      else m.add(deviceId);
      return { mutedUsers: m };
    }),

  toggleMuteAll: () =>
    set((s) => ({ isAllMuted: !s.isAllMuted })),

  resetVoice: () =>
    set({
      producerTransport: null,
      consumerTransport: null,
      producer: null,
      consumers: new Map(),
      consumedProducerIds: new Set(),
      isMicMuted: false,
      isVoiceConnected: false,
    }),

  reset: () =>
    set({
      producerTransport: null,
      consumerTransport: null,
      producer: null,
      consumers: new Map(),
      remoteProducers: new Map(),
      consumedProducerIds: new Set(),
      remoteAudioGains: new Map(),
      isMicMuted: false,
      isVoiceConnected: false,
      noiseGateThreshold: -60,
      mutedUsers: new Set(),
      isAllMuted: false,
    }),
}));
