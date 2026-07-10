import { useRef, useCallback } from 'react';
import * as mediasoup from 'mediasoup-client';
import { useUserStore } from '../stores/userStore';
import { useMediaStore } from '../stores/mediaStore';
import { getSocket } from '../services/socketService';
import {
  getRtpCapabilities,
  createProducerTransport,
  createConsumerTransport,
  consumeProducer,
} from '../services/mediasoupService';
import {
  setupLocalAudioGraph,
  setupRemoteAudio,
  destroyAudioGraph,
  cleanupRemoteAudio,
  applyMuteState,
  getProcessedStream,
} from '../services/audioService';
import { EVENTS } from '../utils/constants';
import { getUserAudioStream } from './useDevices';
import { startAudioQualityMonitor, stopAudioQualityMonitor } from '../services/audioQualityService';

export function useMediasoup() {
  const deviceRef = useRef<mediasoup.Device | null>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const initDevice = useCallback(async (): Promise<boolean> => {
    if (deviceRef.current) return true;
    const rtpCaps = await getRtpCapabilities();
    if (!rtpCaps) return false;
    deviceRef.current = new mediasoup.Device();
    await deviceRef.current.load({ routerRtpCapabilities: rtpCaps });
    return true;
  }, []);

  const startProduce = useCallback(async (): Promise<boolean> => {
    const device = deviceRef.current;
    if (!device) return false;

    const currentRoom = useUserStore.getState().currentRoom;
    if (!currentRoom) return false;

    const selectedInput = localStorage.getItem('vc_selected_input') || undefined;
    const stream = await getUserAudioStream(selectedInput);
    const track = stream.getAudioTracks()[0];
    micTrackRef.current = track;

    const { transport } = await createProducerTransport(device);
    await setupLocalAudioGraph(stream);

    const processedStream = getProcessedStream();
    const producerTrack = processedStream ? processedStream.getAudioTracks()[0] : track;
    const producer = await transport.produce({ track: producerTrack });
    useMediaStore.getState().setProducer(producer);
    startAudioQualityMonitor(producer);

    return true;
  }, []);

  const replaceTrack = useCallback(async (newTrack: MediaStreamTrack) => {
    const store = useMediaStore.getState();
    if (store.producer) {
      await store.producer.replaceTrack({ track: newTrack });
      micTrackRef.current = newTrack;
    }
  }, []);

  const startConsume = useCallback(async (): Promise<boolean> => {
    const device = deviceRef.current;
    if (!device) return false;

    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    const { transport } = await createConsumerTransport(device);

    const myDeviceId = useUserStore.getState().deviceId;

    const remoteProducers = useMediaStore.getState().remoteProducers;
    for (const [producerId, info] of remoteProducers) {
      if (info.deviceId === myDeviceId) continue;
      if (useMediaStore.getState().isConsumed(producerId) || useMediaStore.getState().isConsuming(producerId)) continue;
      useMediaStore.getState().markConsuming(producerId);
      try {
        const consumer = await consumeProducer(transport, device, producerId);
        if (consumer) {
          await setupRemoteAudio(consumer, producerId);
          useMediaStore.getState().markConsumed(producerId);
          useMediaStore.getState().addConsumer(producerId, consumer);
          const ms = useMediaStore.getState();
          applyMuteState(producerId, ms.isAllMuted, ms.mutedUsers.has(info.deviceId));
        } else {
          useMediaStore.getState().unmarkConsuming(producerId);
        }
      } catch (e) {
        useMediaStore.getState().unmarkConsuming(producerId);
        console.warn('[useMediasoup] consume failed for', producerId, e);
      }
    }

    const socket = getSocket();

    const onNewProducer = async (data: { producerId: string; userId: string; deviceId: string; kind: string }) => {
      if (useMediaStore.getState().consumerTransport !== transport) return;
      if (data.deviceId === myDeviceId) return;
      if (useMediaStore.getState().isConsumed(data.producerId) || useMediaStore.getState().isConsuming(data.producerId)) return;
      useMediaStore.getState().markConsuming(data.producerId);
      try {
        const consumer = await consumeProducer(transport, device!, data.producerId);
        if (consumer) {
          await setupRemoteAudio(consumer, data.producerId);
          useMediaStore.getState().markConsumed(data.producerId);
          useMediaStore.getState().addConsumer(data.producerId, consumer);
          const ms = useMediaStore.getState();
          applyMuteState(data.producerId, ms.isAllMuted, ms.mutedUsers.has(data.deviceId));
        } else {
          useMediaStore.getState().unmarkConsuming(data.producerId);
        }
      } catch (e) {
        useMediaStore.getState().unmarkConsuming(data.producerId);
        console.warn('[useMediasoup] consume failed for new producer', data.producerId, e);
      }
    };

    const onProducerClosed = (data: { producerId: string }) => {
      cleanupRemoteAudio(data.producerId);
      useMediaStore.getState().removeConsumer(data.producerId);
    };

    socket?.on(EVENTS.SERVER.NEW_PRODUCER, onNewProducer);
    socket?.on(EVENTS.SERVER.PRODUCER_CLOSED, onProducerClosed);

    cleanupRef.current = () => {
      socket?.off(EVENTS.SERVER.NEW_PRODUCER, onNewProducer);
      socket?.off(EVENTS.SERVER.PRODUCER_CLOSED, onProducerClosed);
    };

    return true;
  }, []);

  const stopProduce = useCallback(() => {
    stopAudioQualityMonitor();
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    const store = useMediaStore.getState();

    if (store.producer) {
      const producerId = store.producer.id;
      getSocket()?.emit(EVENTS.CLIENT.PRODUCER_CLOSE, { producerId });
    }

    if (store.producerTransport) {
      try { store.producerTransport.close(); } catch (e) { /* ignore */ }
    }
    if (store.producer) {
      try { store.producer.close(); } catch (e) { /* ignore */ }
    }
    if (store.consumerTransport) {
      try { store.consumerTransport.close(); } catch (e) { /* ignore */ }
    }
    for (const [, consumer] of store.consumers) {
      try { consumer.close(); } catch (e) { /* ignore */ }
    }

    if (micTrackRef.current) {
      micTrackRef.current.stop();
      micTrackRef.current = null;
    }

    destroyAudioGraph();
    useMediaStore.getState().resetVoice();
  }, []);

  return {
    deviceRef,
    initDevice,
    startProduce,
    stopProduce,
    startConsume,
    replaceTrack,
  };
}
