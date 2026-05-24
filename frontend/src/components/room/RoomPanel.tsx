import React, { useCallback, useState } from 'react';
import { useUserStore } from '../../stores/userStore';
import { useRoomStore } from '../../stores/roomStore';
import { useMediaStore } from '../../stores/mediaStore';
import { getSocket } from '../../services/socketService';
import { EVENTS } from '../../utils/constants';
import { UserGrid } from './UserGrid';
import { DeviceSelector } from '../audio/DeviceSelector';
import { MicController } from '../audio/MicController';
import { useMediasoup } from '../../hooks/useMediasoup';
import { useAudioGraph } from '../../hooks/useAudioGraph';
import { useDevices } from '../../hooks/useDevices';
import { showToast } from '../common/Toast';
import { setAllSinkIds, muteAllRemotes, unmuteAllRemotes } from '../../services/audioService';
import { Announcement } from '../common/Announcement';
import { LatencyIndicator } from './LatencyIndicator';

export const RoomPanel: React.FC = () => {
  const currentRoom = useUserStore((s) => s.currentRoom);
  const setCurrentRoom = useUserStore((s) => s.setCurrentRoom);
  const myDeviceId = useUserStore((s) => s.deviceId);
  const channels = useRoomStore((s) => s.channels);
  const notification = useRoomStore((s) => s.notification);
  const announcements = useRoomStore((s) => s.announcements);
  const peerLatencies = useRoomStore((s) => s.peerLatencies);
  const isVoiceConnected = useMediaStore((s) => s.isVoiceConnected);
  const setVoiceConnected = useMediaStore((s) => s.setVoiceConnected);
  const isMicMuted = useMediaStore((s) => s.isMicMuted);
  const isAllMuted = useMediaStore((s) => s.isAllMuted);
  const toggleMuteAll = useMediaStore((s) => s.toggleMuteAll);

  const { initDevice, startProduce, stopProduce, startConsume, replaceTrack } = useMediasoup();
  const { gain, muted, threshold, toggleMute, updateGain, updateThreshold, cleanup, switchStream } = useAudioGraph();
  const { selectedInput, setSelectedInput, audioInputs, audioOutputs, selectedOutput, setSelectedOutput, getTrack, getStream } = useDevices();

  const [connecting, setConnecting] = useState(false);
  const currentChannel = channels.find((c) => c.roomId === currentRoom);
  const selfLatency = myDeviceId ? peerLatencies.get(myDeviceId) : undefined;

  const handleVoiceConnect = useCallback(async () => {
    if (connecting) return;
    setConnecting(true);

    try {
      const ok = await initDevice();
      if (!ok) throw new Error('获取 RTP 能力失败');

      await startProduce();
      await startConsume();
      setVoiceConnected(true);
      showToast('已加入语音', 'success');
    } catch (err: any) {
      console.error('[RoomPanel] Voice connect failed:', err);
      showToast(err.message || '加入语音失败，请检查麦克风权限', 'error');
      setVoiceConnected(false);
    } finally {
      setConnecting(false);
    }
  }, [connecting, initDevice, startProduce, startConsume, setVoiceConnected]);

  const handleVoiceDisconnect = useCallback(() => {
    stopProduce();
    cleanup();
    setVoiceConnected(false);
    showToast('已断开语音', 'info');
  }, [stopProduce, cleanup, setVoiceConnected]);

  const handleLeaveRoom = useCallback(() => {
    if (isVoiceConnected) {
      stopProduce();
      cleanup();
    }
    getSocket()?.emit(EVENTS.CLIENT.ROOM_LEAVE);
    useMediaStore.getState().reset();
    setCurrentRoom(null);
  }, [isVoiceConnected, stopProduce, cleanup, setCurrentRoom]);

  const handleDeviceChange = useCallback(async (deviceId: string) => {
    setSelectedInput(deviceId);
    try {
      const stream = await getStream(deviceId);
      const gatedTrack = await switchStream(stream);
      if (gatedTrack) {
        await replaceTrack(gatedTrack);
      }
    } catch (e) {
      console.warn('[RoomPanel] device switch failed:', e);
    }
  }, [setSelectedInput, getStream, switchStream, replaceTrack]);

  const handleMicToggle = useCallback(() => {
    const newMuted = toggleMute();
    getSocket()?.emit(EVENTS.CLIENT.USER_MUTE_SELF, { muted: newMuted });
  }, [toggleMute]);

  const handleOutputChange = useCallback(async (deviceId: string) => {
    setSelectedOutput(deviceId);
    try {
      await setAllSinkIds(deviceId);
    } catch (e) {
      console.warn('[RoomPanel] setSinkId failed:', e);
    }
  }, [setSelectedOutput]);

  const handleToggleMuteAll = useCallback(() => {
    if (isAllMuted) {
      unmuteAllRemotes();
    } else {
      muteAllRemotes();
    }
    toggleMuteAll();
  }, [isAllMuted, toggleMuteAll]);

  if (!currentRoom) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{currentChannel?.name || currentRoom}</h1>
            <p className="text-gray-500 text-sm">#{currentRoom}</p>
          </div>
          <button
            onClick={handleLeaveRoom}
            className="bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-red-300 text-sm px-4 py-2 rounded-xl transition-all"
          >
            离开频道
          </button>
        </div>

        {announcements.length > 0 && (
          <div className="mb-4">
            <Announcement announcements={announcements} />
          </div>
        )}
        {notification && (
          <div className="mb-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 px-4 py-2 rounded-xl text-sm">
              {notification}
            </div>
          </div>
        )}

        <div className="glass-panel p-4 mb-6 flex flex-wrap items-center gap-4">
          <MicController
            gain={gain}
            muted={muted}
            threshold={threshold}
            onToggleMute={handleMicToggle}
            onGainChange={(v) => {
              updateGain(v);
              useMediaStore.getState().setNoiseGateThreshold(threshold);
            }}
            onThresholdChange={(v) => {
              updateThreshold(v);
              useMediaStore.getState().setNoiseGateThreshold(v);
            }}
          />

          <DeviceSelector
            inputs={audioInputs}
            outputs={audioOutputs}
            selectedInput={selectedInput}
            selectedOutput={selectedOutput}
            onInputChange={handleDeviceChange}
            onOutputChange={handleOutputChange}
          />

          {selfLatency != null && <LatencyIndicator latency={selfLatency} />}

          <button
            onClick={handleToggleMuteAll}
            className={`text-sm px-4 py-2 rounded-xl transition-all ${
              isAllMuted
                ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {isAllMuted ? '取消静音' : '全部静音'}
          </button>

          <div className="flex-1" />

          {isVoiceConnected ? (
            <button
              onClick={handleVoiceDisconnect}
              className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all active:scale-95"
            >
              断开语音
            </button>
          ) : (
            <button
              onClick={handleVoiceConnect}
              disabled={connecting}
              className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all active:scale-95"
            >
              {connecting ? '连接中...' : '加入语音'}
            </button>
          )}
        </div>

        <div className="glass-panel p-5">
          <UserGrid />
        </div>
      </div>
    </div>
  );
};
