import * as mediasoup from 'mediasoup-client';
import { getSocket } from './socketService';
import { EVENTS } from '../utils/constants';
import { useMediaStore } from '../stores/mediaStore';
import { useUserStore } from '../stores/userStore';
import { handleLocalVoiceSessionLost } from './voiceSessionService';

const JOIN_TIMEOUT_MS = 15000;

function timeoutPromise<T>(ms: number, label: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label} 超时，请检查网络连接或浏览器权限`)), ms);
  });
}

export async function getRtpCapabilities(): Promise<any> {
  const socket = getSocket();
  if (!socket) throw new Error('Socket not connected');

  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (result: any) => {
      if (settled) return;
      settled = true;
      if (result?.error) {
        reject(new Error(`获取 RTP 能力失败: ${result.error}`));
      } else {
        resolve(result);
      }
    };

    socket.emit(EVENTS.CLIENT.RTP_GET_CAPABILITIES, {}, (rtpCapabilities: any) => {
      done(rtpCapabilities);
    });

    setTimeout(() => done({ error: 'RTP 能力获取超时' }), JOIN_TIMEOUT_MS);
  });
}

async function createTransport(direction: 'producer' | 'consumer'): Promise<any> {
  const socket = getSocket();
  const roomId = useUserStore.getState().currentRoom;
  if (!socket || !roomId) throw new Error('Not in room');

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      clearTimeout(timeoutId);
      socket.off(EVENTS.SERVER.TRANSPORT_CREATED, onCreated);
      socket.off(EVENTS.SERVER.ERROR, onError);
    };

    const onCreated = (data: any) => {
      if (data.direction !== direction) return;
      if (settled) return;
      settled = true;
      cleanup();
      resolve(data);
    };

    const onError = (data: any) => {
      if (data.event !== EVENTS.CLIENT.TRANSPORT_CREATE) return;
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(data.message || 'Transport 创建失败'));
    };

    socket.on(EVENTS.SERVER.TRANSPORT_CREATED, onCreated);
    socket.on(EVENTS.SERVER.ERROR, onError);

    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`${direction === 'producer' ? '发送' : '接收'}通道创建超时，请检查网络连接`));
    }, JOIN_TIMEOUT_MS);

    socket.emit(EVENTS.CLIENT.TRANSPORT_CREATE, { roomId, direction });
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

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      clearTimeout(timeoutId);
      socket.off(EVENTS.SERVER.CONSUMER_CREATED, onCreated);
      socket.off(EVENTS.SERVER.ERROR, onError);
    };

    const onCreated = async (data: any) => {
      if (data.producerId !== producerId) return;
      if (settled) return;
      settled = true;
      cleanup();
      try {
        const consumer = await transport.consume({
          id: data.consumerId,
          producerId: data.producerId,
          kind: data.kind,
          rtpParameters: data.rtpParameters,
        });
        resolve(consumer);
      } catch (e) {
        resolve(null);
      }
    };

    const onError = (data: any) => {
      if (data.event !== EVENTS.CLIENT.CONSUMER_CREATE) return;
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    };

    socket.on(EVENTS.SERVER.CONSUMER_CREATED, onCreated);
    socket.on(EVENTS.SERVER.ERROR, onError);

    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    }, JOIN_TIMEOUT_MS);

    socket.emit(EVENTS.CLIENT.CONSUMER_CREATE, {
      transportId: transport.id,
      producerId,
      rtpCapabilities: device.rtpCapabilities,
    });
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
