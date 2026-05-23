import { create } from 'zustand';

interface MediaState {
  producerTransport: any | null;
  consumerTransport: any | null;
  producer: any | null;
  consumers: Map<string, any>;
  remoteAudioGains: Map<string, number>;
  isMicMuted: boolean;
  isAudioEnabled: boolean;

  setProducerTransport: (t: any) => void;
  setConsumerTransport: (t: any) => void;
  setProducer: (p: any) => void;
  addConsumer: (id: string, c: any) => void;
  removeConsumer: (id: string) => void;
  setRemoteAudioGain: (producerId: string, gain: number) => void;
  setMicMuted: (m: boolean) => void;
  setAudioEnabled: (e: boolean) => void;
  reset: () => void;
}

export const useMediaStore = create<MediaState>((set) => ({
  producerTransport: null,
  consumerTransport: null,
  producer: null,
  consumers: new Map(),
  remoteAudioGains: new Map(),
  isMicMuted: false,
  isAudioEnabled: true,

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
  setRemoteAudioGain: (producerId, gain) =>
    set((s) => {
      const m = new Map(s.remoteAudioGains);
      m.set(producerId, gain);
      return { remoteAudioGains: m };
    }),
  setMicMuted: (m) => set({ isMicMuted: m }),
  setAudioEnabled: (e) => set({ isAudioEnabled: e }),
  reset: () =>
    set({
      producerTransport: null,
      consumerTransport: null,
      producer: null,
      consumers: new Map(),
      remoteAudioGains: new Map(),
      isMicMuted: false,
      isAudioEnabled: true,
    }),
}));
