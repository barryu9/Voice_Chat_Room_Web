import * as mediasoup from 'mediasoup-client';
import { getSocket } from './socketService';
import { EVENTS } from '../utils/constants';
import { useMediaStore } from '../stores/mediaStore';
import { useUserStore } from '../stores/userStore';
import { handleLocalVoiceSessionLost } from './voiceSessionService';

export async function getRtpCapabilities(): Promise<any> {
  const socket = getSocket();
  if (!socket) throw new Error('Socket not connected');

  return new Promise((resolve) => {
    socket.emit(EVENTS.CLIENT.RTP_GET_CAPABILITIES, {}, (rtpCapabilities: any) => {
      resolve(rtpCapabilities);
    });
  });
}

async function createTransport(direction: 'producer' | 'consumer'): Promise<any> {
  const socket = getSocket();
  const roomId = useUserStore.getState().currentRoom;
  if (!socket || !roomId) throw new Error('Not in room');

  return new Promise((resolve) => {
    socket.emit(EVENTS.CLIENT.TRANSPORT_CREATE, { roomId, direction });

    const onCreated = (data: any) => {
      if (data.direction === direction) {
        socket.off(EVENTS.SERVER.TRANSPORT_CREATED, onCreated);
        resolve(data);
      }
    };
    socket.on(EVENTS.SERVER.TRANSPORT_CREATED, onCreated);
  });
}

function watchTransportConnection(transport: any, label: 'producer' | 'consumer') {
  let disconnectTimer: ReturnType<typeof window.setTimeout> | null = null;
  const isCurrentTransport = () => {
    const state = useMediaStore.getState();
    return label === 'producer' ? state.producerTransport === transport : state.consumerTransport === transport;
  };

  transport.on('connectionstatechange', (state: string) => {
    if (disconnectTimer && state !== 'disconnected') {
      window.clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }

    if (state === 'failed') {
      if (!isCurrentTransport()) return;
      console.warn(`[Mediasoup] ${label} transport failed`);
      handleLocalVoiceSessionLost('transport');
      return;
    }

    if (state === 'disconnected') {
      console.warn(`[Mediasoup] ${label} transport disconnected`);
      disconnectTimer = window.setTimeout(() => {
        disconnectTimer = null;
        if (!isCurrentTransport()) return;
        handleLocalVoiceSessionLost('transport');
      }, 5000);
    }
  });
}

export async function createProducerTransport(device: mediasoup.Device): Promise<{ transport: any; params: any }> {
  const params = await createTransport('producer');
  const transport = device.createSendTransport({
    id: params.transportId,
    iceParameters: params.iceParameters,
    iceCandidates: params.iceCandidates,
    dtlsParameters: params.dtlsParameters,
  });

  transport.on('connect', async ({ dtlsParameters }: any, cb: any) => {
    getSocket()?.emit(EVENTS.CLIENT.TRANSPORT_CONNECT, {
      transportId: params.transportId,
      dtlsParameters,
    });
    cb();
  });

  transport.on('produce', async ({ kind, rtpParameters }: any, cb: any) => {
    getSocket()?.emit(EVENTS.CLIENT.PRODUCER_CREATE, {
      transportId: params.transportId,
      kind,
      rtpParameters,
    });

    const onCreated = (data: any) => {
      getSocket()?.off(EVENTS.SERVER.PRODUCER_CREATED, onCreated);
      cb({ id: data.producerId });
    };
    getSocket()?.on(EVENTS.SERVER.PRODUCER_CREATED, onCreated);
  });

  watchTransportConnection(transport, 'producer');
  useMediaStore.getState().setProducerTransport(transport);
  return { transport, params };
}

export async function createConsumerTransport(device: mediasoup.Device): Promise<any> {
  const params = await createTransport('consumer');
  const transport = device.createRecvTransport({
    id: params.transportId,
    iceParameters: params.iceParameters,
    iceCandidates: params.iceCandidates,
    dtlsParameters: params.dtlsParameters,
  });

  transport.on('connect', async ({ dtlsParameters }: any, cb: any) => {
    getSocket()?.emit(EVENTS.CLIENT.TRANSPORT_CONNECT, {
      transportId: params.transportId,
      dtlsParameters,
    });
    cb();
  });

  watchTransportConnection(transport, 'consumer');
  useMediaStore.getState().setConsumerTransport(transport);
  return { transport, params };
}

export async function consumeProducer(
  transport: any,
  device: mediasoup.Device,
  producerId: string
): Promise<mediasoup.types.Consumer | null> {
  const socket = getSocket();
  const roomId = useUserStore.getState().currentRoom;
  if (!socket || !roomId) return null;

  return new Promise((resolve) => {
    socket.emit(EVENTS.CLIENT.CONSUMER_CREATE, {
      transportId: transport.id,
      producerId,
      rtpCapabilities: device.rtpCapabilities,
    });

    const onCreated = async (data: any) => {
      if (data.producerId !== producerId) return;
      socket.off(EVENTS.SERVER.CONSUMER_CREATED, onCreated);
      const consumer = await transport.consume({
        id: data.consumerId,
        producerId: data.producerId,
        kind: data.kind,
        rtpParameters: data.rtpParameters,
      });
      resolve(consumer);
    };
    socket.on(EVENTS.SERVER.CONSUMER_CREATED, onCreated);
  });
}

export function pauseConsumer(consumerId: string) {
  getSocket()?.emit(EVENTS.CLIENT.CONSUMER_PAUSE, { consumerId });
}

export function resumeConsumer(consumerId: string) {
  getSocket()?.emit(EVENTS.CLIENT.CONSUMER_RESUME, { consumerId });
}

export function sendMuteSelf(muted: boolean) {
  getSocket()?.emit(EVENTS.CLIENT.USER_MUTE_SELF, { muted });
  useMediaStore.getState().setMicMuted(muted);
}
