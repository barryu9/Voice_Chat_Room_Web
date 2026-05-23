import React, { useCallback } from 'react';
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

export const RoomPanel: React.FC = () => {
  const currentRoom = useUserStore((s) => s.currentRoom);
  const setCurrentRoom = useUserStore((s) => s.setCurrentRoom);
  const channels = useRoomStore((s) => s.channels);
  const announcement = useRoomStore((s) => s.roomAnnouncement);
  const isMicMuted = useMediaStore((s) => s.isMicMuted);

  const { initDevice, startProduce, stopProduce, startConsume, replaceTrack } = useMediasoup();
  const { gain, muted, threshold, toggleMute, updateGain, updateThreshold, setupLocal, cleanup } = useAudioGraph();
  const { selectedInput, setSelectedInput, audioInputs, getTrack } = useDevices();

  const currentChannel = channels.find((c) => c.roomId === currentRoom);

  const handleStartMic = useCallback(async () => {
    const ok = await initDevice();
    if (!ok) return;
    await startProduce();
  }, [initDevice, startProduce]);

  const handleJoinRoom = useCallback(async () => {
    await handleStartMic();
    await startConsume();
  }, [handleStartMic, startConsume]);

  const handleLeaveRoom = useCallback(() => {
    stopProduce();
    cleanup();
    getSocket()?.emit(EVENTS.CLIENT.ROOM_LEAVE);
    setCurrentRoom(null);
  }, [stopProduce, cleanup, setCurrentRoom]);

  const handleDeviceChange = useCallback(async (deviceId: string) => {
    setSelectedInput(deviceId);
    const track = await getTrack(deviceId);
    if (track) {
      await replaceTrack(track);
    }
  }, [setSelectedInput, getTrack, replaceTrack]);

  const handleMicToggle = useCallback(async () => {
    if (isMicMuted) {
      await handleStartMic();
      await startConsume();
    }
    const newMuted = toggleMute();
    getSocket()?.emit(EVENTS.CLIENT.USER_MUTE_SELF, { muted: newMuted });
  }, [isMicMuted, toggleMute, handleStartMic, startConsume]);

  if (!currentRoom) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
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

        {/* Announcement */}
        {announcement && (
          <div className="mb-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 px-4 py-2 rounded-xl text-sm">
              {announcement}
            </div>
          </div>
        )}

        {/* Controls Bar */}
        <div className="glass-panel p-4 mb-6 flex flex-wrap items-center gap-4">
          <MicController
            gain={gain}
            muted={muted}
            threshold={threshold}
            onToggleMute={handleMicToggle}
            onGainChange={updateGain}
            onThresholdChange={updateThreshold}
          />

          <DeviceSelector
            inputs={audioInputs}
            selectedInput={selectedInput}
            onInputChange={handleDeviceChange}
          />

          <div className="flex-1" />

          <button
            onClick={handleJoinRoom}
            className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all active:scale-95"
          >
            加入语音
          </button>
        </div>

        {/* User Grid */}
        <div className="glass-panel p-5">
          <UserGrid />
        </div>
      </div>
    </div>
  );
};
