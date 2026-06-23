import { useMediaStore } from '../stores/mediaStore';
import { useRoomStore } from '../stores/roomStore';
import { useUserStore } from '../stores/userStore';
import { destroyAudioGraph } from './audioService';
import { playSound } from './soundService';
import { clearChannelUrlParam } from '../utils/helpers';

type VoiceLossReason = 'socket' | 'transport';

let handlingLoss = false;

export function handleLocalVoiceSessionLost(reason: VoiceLossReason) {
  const media = useMediaStore.getState();
  const user = useUserStore.getState();
  const wasInRoom = !!user.currentRoom;
  const wasVoiceConnected = media.isVoiceConnected || !!media.producer || media.consumers.size > 0;

  if (!wasInRoom && !wasVoiceConnected) return;
  if (handlingLoss) return;
  handlingLoss = true;

  try {
    try { media.producerTransport?.close(); } catch {}
    try { media.producer?.close(); } catch {}
    try { media.consumerTransport?.close(); } catch {}
    for (const [, consumer] of media.consumers) {
      try { consumer.close(); } catch {}
    }
    destroyAudioGraph();

    if (wasVoiceConnected && user.currentRoom) {
      useMediaStore.getState().requestVoiceReconnect(user.currentRoom);
    }

    if (reason === 'socket' && wasVoiceConnected && user.currentRoom) {
      useMediaStore.getState().resetVoice();
      useMediaStore.getState().clearRemoteProducers();
      useRoomStore.getState().setNotification('连接已断开，正在自动重连语音...');
    } else if (reason === 'socket') {
      useMediaStore.getState().reset();
      useUserStore.getState().setCurrentRoom(null);
      clearChannelUrlParam();
      useRoomStore.getState().setNotification('连接已断开，你已离开当前频道，请重新进入频道');
    } else {
      useMediaStore.getState().resetVoice();
      if (wasVoiceConnected && user.currentRoom) {
        useMediaStore.getState().setVoiceReconnectRoomReady(true);
        useRoomStore.getState().setNotification('语音连接已断开，正在自动重连...');
      } else {
        useRoomStore.getState().setNotification('语音连接已断开，请重新加入语音');
      }
    }

    playSound('disconnected');
  } finally {
    window.setTimeout(() => {
      handlingLoss = false;
    }, 500);
  }
}
