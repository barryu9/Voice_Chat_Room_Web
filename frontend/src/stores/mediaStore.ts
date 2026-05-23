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

  setProducerTransport: (t: any) => void;
  setConsumerTransport: (t: any) => void;
  setProducer: (p: any) => void;
  addConsumer: (id: string, c: any) => void;
  removeConsumer: (id: string) => void;
  addRemoteProducer: (p: RemoteProducer) => void;
  removeRemoteProducer: (producerId: string) => void;
  markConsumed: (producerId: string) => void;
  isConsumed: (producerId: string) => boolean;
  setRemoteAudioGain: (producerId: string, gain: number) => void;
  setMicMuted: (m: boolean) => void;
  setVoiceConnected: (v: boolean) => void;
  setNoiseGateThreshold: (v: number) => void;
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
    }),
}));
