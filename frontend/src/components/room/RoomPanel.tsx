import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useUserStore } from '../../stores/userStore';
import { useRoomStore } from '../../stores/roomStore';
import { useMediaStore } from '../../stores/mediaStore';
import { getSocket } from '../../services/socketService';
import { EVENTS, getAudioQualityLabel } from '../../utils/constants';
import { playSound } from '../../services/soundService';
import { setNoiseSuppressorEnabled, setNoiseSuppressorStrength } from '../../services/rnnoiseService';
import { UserGrid } from './UserGrid';
import { AudioControls } from '../audio/AudioControls';
import { useMediasoup } from '../../hooks/useMediasoup';
import { useAudioGraph } from '../../hooks/useAudioGraph';
import { useDevices } from '../../hooks/useDevices';
import { showToast } from '../common/Toast';
import { setAllSinkIds, muteAllRemotes, unmuteAllRemotes, applyMasterVolume } from '../../services/audioService';
import { Announcement } from '../common/Announcement';
import { TechBackground } from '../common/TechBackground';
import { SoundSettings } from '../common/SoundSettings';
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
  const noiseSuppressionEnabled = useMediaStore((s) => s.noiseSuppressionEnabled);
  const noiseSuppressionStrength = useMediaStore((s) => s.noiseSuppressionStrength);
  const setNoiseSuppressionEnabled = useMediaStore((s) => s.setNoiseSuppressionEnabled);
  const setNoiseSuppressionStrength = useMediaStore((s) => s.setNoiseSuppressionStrength);
  const masterVolume = useMediaStore((s) => s.masterVolume);
  const setMasterVolume = useMediaStore((s) => s.setMasterVolume);

  const { initDevice, startProduce, stopProduce, startConsume, replaceTrack } = useMediasoup();
  const { gain, muted, threshold, audioLevel, toggleMute, updateGain, updateThreshold, cleanup, switchStream } = useAudioGraph();
  const { selectedInput, setSelectedInput, audioInputs, audioOutputs, selectedOutput, setSelectedOutput, getTrack, getStream } = useDevices();

  const [connecting, setConnecting] = useState(false);
  const [duration, setDuration] = useState(0);
  const durationRef = useRef<number>(0);
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
      playSound('connected');
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
    playSound('disconnected');
    showToast('已断开语音', 'info');
  }, [stopProduce, cleanup, setVoiceConnected]);

  const handleLeaveRoom = useCallback(() => {
    if (isVoiceConnected) {
      stopProduce();
      cleanup();
      playSound('disconnected');
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
    playSound(newMuted ? 'micMuted' : 'micActivated');
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
    playSound(isAllMuted ? 'soundResumed' : 'soundMuted');
  }, [isAllMuted, toggleMuteAll]);

  const handleNoiseSuppressionToggle = useCallback(() => {
    const next = !noiseSuppressionEnabled;
    setNoiseSuppressionEnabled(next);
    setNoiseSuppressorEnabled(next);
  }, [noiseSuppressionEnabled, setNoiseSuppressionEnabled]);

  const handleNoiseSuppressionStrengthChange = useCallback((v: number) => {
    setNoiseSuppressionStrength(v);
    setNoiseSuppressorStrength(v);
  }, [setNoiseSuppressionStrength]);

  const handleMasterVolumeChange = useCallback((v: number) => {
    setMasterVolume(v);
    applyMasterVolume();
  }, [setMasterVolume]);

  useEffect(() => {
    if (isVoiceConnected) {
      durationRef.current = window.setInterval(() => setDuration((d) => d + 1), 1000);
    } else {
      clearInterval(durationRef.current);
      setDuration(0);
    }
    return () => clearInterval(durationRef.current);
  }, [isVoiceConnected]);

  const fmt = (d: number) => {
    const m = Math.floor(d / 60).toString().padStart(2, '0');
    const s = (d % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!currentRoom) return null;

  return (
    <div className="min-h-screen relative">
      <TechBackground />
      <div className="max-w-6xl mx-auto px-4 py-6 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{currentChannel?.name || currentRoom}</h1>
            <p className="text-gray-500 text-sm">
              #{currentRoom}
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-white/5 text-gray-500 border border-white/5">
                {getAudioQualityLabel(currentChannel?.audioBitrate ?? 32)}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SoundSettings />
            <button
              onClick={handleLeaveRoom}
              className="bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-red-300 text-sm px-4 py-2 rounded-xl transition-all"
            >
              离开频道
            </button>
          </div>
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

        <div className="glass-panel p-3 sm:p-4 mb-6 flex flex-wrap items-center gap-3 sm:gap-4 overflow-visible sm:static fixed bottom-0 left-0 right-0 z-40 rounded-none sm:rounded-2xl">
          <AudioControls
            gain={gain}
            muted={muted}
            threshold={threshold}
            audioLevel={audioLevel}
            noiseSuppressionEnabled={noiseSuppressionEnabled}
            noiseSuppressionStrength={noiseSuppressionStrength}
            onToggleMute={handleMicToggle}
            onGainChange={(v) => {
              updateGain(v);
              useMediaStore.getState().setNoiseGateThreshold(threshold);
            }}
            onThresholdChange={(v) => {
              updateThreshold(v);
              useMediaStore.getState().setNoiseGateThreshold(v);
            }}
            onNoiseSuppressionToggle={handleNoiseSuppressionToggle}
            onNoiseSuppressionStrengthChange={handleNoiseSuppressionStrengthChange}
            inputs={audioInputs}
            outputs={audioOutputs}
            selectedInput={selectedInput}
            selectedOutput={selectedOutput}
            onInputChange={handleDeviceChange}
            onOutputChange={handleOutputChange}
            isAllMuted={isAllMuted}
            masterVolume={masterVolume}
            onToggleMuteAll={handleToggleMuteAll}
            onMasterVolumeChange={handleMasterVolumeChange}
          />

          {selfLatency != null && <LatencyIndicator latency={selfLatency} />}

          <div className="flex-1" />

          {isVoiceConnected ? (
            <>
              <span className="text-sm text-gray-400 font-mono tabular-nums">{fmt(duration)}</span>
              <button
                onClick={handleVoiceDisconnect}
                className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all active:scale-95"
              >
                断开语音
              </button>
            </>
          ) : (
            <button
              onClick={handleVoiceConnect}
              disabled={connecting}
              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all active:scale-95"
            >
              {connecting ? '连接中...' : '加入语音'}
            </button>
          )}
        </div>

        <div className="glass-panel p-5 pb-24 sm:pb-5">
          <UserGrid />
        </div>
      </div>
    </div>
  );
};
