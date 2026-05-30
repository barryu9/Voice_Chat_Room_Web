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
  consumingProducerIds: Set<string>;
  remoteAudioGains: Map<string, number>;
  isMicMuted: boolean;
  isVoiceConnected: boolean;
  noiseGateThreshold: number;
  myAudioLevel: number;
  mutedUsers: Set<string>;
  isAllMuted: boolean;
  noiseSuppressionEnabled: boolean;
  echoCancellationEnabled: boolean;
  autoGainControlEnabled: boolean;
  vocalEnhancerEnabled: boolean;
  masterVolume: number;
  serverMutedUsers: Map<string, number>;
  amIServerMuted: boolean;
  amIServerMutedByAdmin: boolean;

  setProducerTransport: (t: any) => void;
  setConsumerTransport: (t: any) => void;
  setProducer: (p: any) => void;
  addConsumer: (id: string, c: any) => void;
  removeConsumer: (id: string) => void;
  addRemoteProducer: (p: RemoteProducer) => void;
  removeRemoteProducer: (producerId: string) => void;
  getProducerIdByDeviceId: (deviceId: string) => string | undefined;
  markConsumed: (producerId: string) => void;
  markConsuming: (producerId: string) => void;
  unmarkConsuming: (producerId: string) => void;
  isConsuming: (producerId: string) => boolean;
  isConsumed: (producerId: string) => boolean;
  setRemoteAudioGain: (producerId: string, gain: number) => void;
  setMicMuted: (m: boolean) => void;
  setVoiceConnected: (v: boolean) => void;
  setNoiseGateThreshold: (v: number) => void;
  setMyAudioLevel: (v: number) => void;
  toggleMuteUser: (deviceId: string) => void;
  toggleMuteAll: () => void;
  setNoiseSuppressionEnabled: (v: boolean) => void;
  setEchoCancellationEnabled: (v: boolean) => void;
  setAutoGainControlEnabled: (v: boolean) => void;
  setVocalEnhancerEnabled: (v: boolean) => void;
  setMasterVolume: (v: number) => void;
  setServerMutedUser: (userId: string, expiresAt: number) => void;
  removeServerMutedUser: (userId: string) => void;
  clearServerMutedUsers: () => void;
  setAmIServerMuted: (v: boolean, byAdmin?: boolean) => void;
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
  consumingProducerIds: new Set(),
  remoteAudioGains: new Map(),
  isMicMuted: false,
  isVoiceConnected: false,
  noiseGateThreshold: (() => {
    const saved = localStorage.getItem('vc_threshold');
    return saved !== null ? parseInt(saved) : -45;
  })(),
  myAudioLevel: -100,
  mutedUsers: new Set(),
  isAllMuted: false,
  noiseSuppressionEnabled: (() => {
    const saved = localStorage.getItem('vc_denoise_enabled');
    return saved !== null ? saved === 'true' : true;
  })(),
  echoCancellationEnabled: (() => {
    const saved = localStorage.getItem('vc_echo_cancellation_enabled');
    return saved !== null ? saved === 'true' : true;
  })(),
  autoGainControlEnabled: (() => {
    const saved = localStorage.getItem('vc_auto_gain_control_enabled');
    return saved !== null ? saved === 'true' : true;
  })(),
  vocalEnhancerEnabled: (() => {
    const saved = localStorage.getItem('vc_vocal_enhancer_enabled');
    return saved !== null ? saved === 'true' : false;
  })(),
  masterVolume: (() => {
    const saved = localStorage.getItem('vc_master_volume');
    return saved !== null ? parseFloat(saved) : 1.0;
  })(),
  serverMutedUsers: new Map(),
  amIServerMuted: false,
  amIServerMutedByAdmin: true,

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
      const consumed = new Set(s.consumedProducerIds);
      const pending = new Set(s.consumingProducerIds);
      m.delete(id);
      consumed.delete(id);
      pending.delete(id);
      return { consumers: m, consumedProducerIds: consumed, consumingProducerIds: pending };
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
      const pending = new Set(s.consumingProducerIds);
      ids.add(producerId);
      pending.delete(producerId);
      return { consumedProducerIds: ids, consumingProducerIds: pending };
    }),
  markConsuming: (producerId) =>
    set((s) => {
      const ids = new Set(s.consumingProducerIds);
      ids.add(producerId);
      return { consumingProducerIds: ids };
    }),
  unmarkConsuming: (producerId) =>
    set((s) => {
      const ids = new Set(s.consumingProducerIds);
      ids.delete(producerId);
      return { consumingProducerIds: ids };
    }),
  isConsuming: (producerId) => get().consumingProducerIds.has(producerId),
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
  setMyAudioLevel: (v) => set({ myAudioLevel: v }),

  setNoiseSuppressionEnabled: (v) => set({ noiseSuppressionEnabled: v }),
  setEchoCancellationEnabled: (v) => {
    localStorage.setItem('vc_echo_cancellation_enabled', String(v));
    set({ echoCancellationEnabled: v });
  },
  setAutoGainControlEnabled: (v) => {
    localStorage.setItem('vc_auto_gain_control_enabled', String(v));
    set({ autoGainControlEnabled: v });
  },
  setVocalEnhancerEnabled: (v) => {
    localStorage.setItem('vc_vocal_enhancer_enabled', String(v));
    set({ vocalEnhancerEnabled: v });
  },

  setMasterVolume: (v) => {
    localStorage.setItem('vc_master_volume', String(v));
    set({ masterVolume: v });
  },

  setServerMutedUser: (userId, expiresAt) =>
    set((s) => {
      const m = new Map(s.serverMutedUsers);
      m.set(userId, expiresAt);
      return { serverMutedUsers: m };
    }),

  removeServerMutedUser: (userId) =>
    set((s) => {
      const m = new Map(s.serverMutedUsers);
      m.delete(userId);
      return { serverMutedUsers: m };
    }),

  clearServerMutedUsers: () => set({ serverMutedUsers: new Map(), amIServerMuted: false, amIServerMutedByAdmin: true }),

  setAmIServerMuted: (v, byAdmin) => set({ amIServerMuted: v, amIServerMutedByAdmin: byAdmin ?? true }),

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
      consumingProducerIds: new Set(),
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
      consumingProducerIds: new Set(),
      remoteAudioGains: new Map(),
      isMicMuted: false,
      isVoiceConnected: false,
      noiseGateThreshold: (() => {
        const saved = localStorage.getItem('vc_threshold');
        return saved !== null ? parseInt(saved) : -45;
      })(),
      myAudioLevel: -100,
      mutedUsers: new Set(),
      isAllMuted: false,
      echoCancellationEnabled: (() => {
        const saved = localStorage.getItem('vc_echo_cancellation_enabled');
        return saved !== null ? saved === 'true' : true;
      })(),
      autoGainControlEnabled: (() => {
        const saved = localStorage.getItem('vc_auto_gain_control_enabled');
        return saved !== null ? saved === 'true' : true;
      })(),
      vocalEnhancerEnabled: (() => {
        const saved = localStorage.getItem('vc_vocal_enhancer_enabled');
        return saved !== null ? saved === 'true' : false;
      })(),
    }),
}));
