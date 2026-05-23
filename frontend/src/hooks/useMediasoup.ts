import { useRef, useCallback } from 'react';
import * as mediasoup from 'mediasoup-client';
import { useUserStore } from '../stores/userStore';
import { useMediaStore } from '../stores/mediaStore';
import { useRoomStore } from '../stores/roomStore';
import { getSocket } from '../services/socketService';
import {
  getRtpCapabilities,
  createProducerTransport,
  createConsumerTransport,
  consumeProducer,
} from '../services/mediasoupService';
import { setupLocalAudioGraph, setupRemoteAudio, destroyAudioGraph } from '../services/audioService';
import { EVENTS } from '../utils/constants';

export function useMediasoup() {
  const deviceRef = useRef<mediasoup.Device | null>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);

  const initDevice = useCallback(async () => {
    const rtpCaps = await getRtpCapabilities();
    if (!rtpCaps) return false;

    deviceRef.current = new mediasoup.Device();
    await deviceRef.current.load({ routerRtpCapabilities: rtpCaps });
    return true;
  }, []);

  const startProduce = useCallback(async () => {
    const device = deviceRef.current;
    if (!device) return;

    const currentRoom = useUserStore.getState().currentRoom;
    if (!currentRoom) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const track = stream.getAudioTracks()[0];
    micTrackRef.current = track;

    const { transport } = await createProducerTransport(device);

    await setupLocalAudioGraph(stream);

    const producer = await transport.produce({ track });
    useMediaStore.getState().setProducer(producer);
  }, []);

  const replaceTrack = useCallback(async (newTrack: MediaStreamTrack) => {
    const producer = useMediaStore.getState().producer;
    if (producer) {
      await producer.replaceTrack({ track: newTrack });
      micTrackRef.current = newTrack;
    }
  }, []);

  const startConsume = useCallback(async () => {
    const device = deviceRef.current;
    if (!device) return;

    const { transport } = await createConsumerTransport(device);

    const socket = getSocket();
    const onNewProducer = async (data: { producerId: string }) => {
      const consumer = await consumeProducer(transport, device, data.producerId);
      if (consumer) {
        await setupRemoteAudio(consumer, data.producerId);
      }
    };
    socket?.on(EVENTS.SERVER.NEW_PRODUCER, onNewProducer);

    const onProducerClosed = (data: { producerId: string }) => {
      useMediaStore.getState().removeConsumer(data.producerId);
    };
    socket?.on(EVENTS.SERVER.PRODUCER_CLOSED, onProducerClosed);

    return () => {
      socket?.off(EVENTS.SERVER.NEW_PRODUCER, onNewProducer);
      socket?.off(EVENTS.SERVER.PRODUCER_CLOSED, onProducerClosed);
    };
  }, []);

  const stopProduce = useCallback(() => {
    const store = useMediaStore.getState();
    if (store.producer) {
      try { store.producer.close(); } catch (e) { /* ignore */ }
      store.setProducer(null);
    }
    if (store.producerTransport) {
      try { store.producerTransport.close(); } catch (e) { /* ignore */ }
      store.setProducerTransport(null);
    }
    if (micTrackRef.current) {
      micTrackRef.current.stop();
      micTrackRef.current = null;
    }
    destroyAudioGraph();
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
