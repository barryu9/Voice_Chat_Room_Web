import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useUserStore } from '../../stores/userStore';
import { useRoomStore } from '../../stores/roomStore';
import { useMediaStore } from '../../stores/mediaStore';
import { useAdminStore } from '../../stores/adminStore';
import { useVoiceChangerStore } from '../../stores/voiceChangerStore';
import { getSocket } from '../../services/socketService';
import { playSound } from '../../services/soundService';
import { toggleNoiseSuppressor, setAllSinkIds, muteAllRemotes, unmuteAllRemotes, applyMasterVolume, reconnectAudioGraph } from '../../services/audioService';
import { initVoiceChanger, switchPreset } from '../../services/voiceChangerService';
import { startRecording, stopRecording, getRecordedBuffer, playTest, destroyPreview } from '../../services/previewService';
import { VOICE_PRESETS } from '../../utils/voicePresets';
import { useMediasoup } from '../../hooks/useMediasoup';
import { useAudioGraph } from '../../hooks/useAudioGraph';
import { useDevices } from '../../hooks/useDevices';
import { UserGrid } from './UserGrid';
import { AudioControls } from '../audio/AudioControls';
import { showToast } from '../common/Toast';
import { Announcement } from '../common/Announcement';
import { TechBackground } from '../common/TechBackground';
import { SettingsPanel } from '../common/SettingsPanel';
import { EditUserChannelModal } from '../lobby/EditUserChannelModal';
import { VoicePreviewModal } from '../audio/VoicePreviewModal';
import { LatencyIndicator } from './LatencyIndicator';
import { EVENTS, getAudioQualityLabel } from '../../utils/constants';
import { clearChannelUrlParam } from '../../utils/helpers';

export const RoomPanel: React.FC = () => {
  const currentRoom = useUserStore((s) => s.currentRoom);
  const setCurrentRoom = useUserStore((s) => s.setCurrentRoom);
  const myUserId = useUserStore((s) => s.userId);
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
  const amIServerMuted = useMediaStore((s) => s.amIServerMuted);
  const amIServerMutedByAdmin = useMediaStore((s) => s.amIServerMutedByAdmin);
  const noiseSuppressionEnabled = useMediaStore((s) => s.noiseSuppressionEnabled);
  const setNoiseSuppressionEnabled = useMediaStore((s) => s.setNoiseSuppressionEnabled);
  const echoCancellationEnabled = useMediaStore((s) => s.echoCancellationEnabled);
  const setEchoCancellationEnabled = useMediaStore((s) => s.setEchoCancellationEnabled);
  const masterVolume = useMediaStore((s) => s.masterVolume);
  const setMasterVolume = useMediaStore((s) => s.setMasterVolume);

  const { initDevice, startProduce, stopProduce, startConsume, replaceTrack } = useMediasoup();
  const { gain, muted, threshold, audioLevel, toggleMute, forceMute, updateGain, updateThreshold, cleanup, switchStream } = useAudioGraph();
  const { selectedInput, setSelectedInput, audioInputs, audioOutputs, selectedOutput, setSelectedOutput, getTrack, getStream } = useDevices();

  const [connecting, setConnecting] = useState(false);
  const [duration, setDuration] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVoicePreview, setShowVoicePreview] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [testCountdown, setTestCountdown] = useState(0);
  const [testPlaying, setTestPlaying] = useState(false);
  const testTimerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    return () => clearInterval(testTimerRef.current);
  }, []);
  const durationRef = useRef<number>(0);
  const currentChannel = channels.find((c) => c.roomId === currentRoom);
  const isCreator = currentChannel?.type === 'user' && currentChannel?.creatorUserId === myUserId;
  const selfLatency = myDeviceId ? peerLatencies.get(myDeviceId) : undefined;

  const isAdmin = useAdminStore((s) => s.isAdmin);
  const kickedList = useAdminStore((s) => s.kickedList);
  const [, kickTick] = useState(0);

  useEffect(() => {
    if (!isAdmin && !isCreator) return;
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_KICKLIST);
    const handler = (data: any) => {
      useAdminStore.getState().setKickedList(data.kicked || []);
    };
    getSocket()?.on(EVENTS.SERVER.KICKED_LIST, handler);
    const timer = setInterval(() => kickTick((t) => t + 1), 1000);
    return () => {
      getSocket()?.off(EVENTS.SERVER.KICKED_LIST, handler);
      clearInterval(timer);
    };
  }, [isAdmin, isCreator]);

  const voiceRef = useRef(isVoiceConnected);
  voiceRef.current = isVoiceConnected;
  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;
  const stopProduceRef = useRef(stopProduce);
  stopProduceRef.current = stopProduce;

  useEffect(() => {
    return () => {
      if (voiceRef.current) {
        stopProduceRef.current();
        cleanupRef.current();
      }
    };
  }, []);

  const fmtKick = (ms: number) => {
    if (ms <= 0) return '已过期';
    const s = Math.ceil(ms / 1000);
    if (s < 60) return `${s}秒`;
    const m = Math.floor(s / 60);
    return `${m}分${s % 60}秒`;
  };

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
      stopProduce();
      cleanup();
      showToast(err.message || '加入语音失败，请检查麦克风权限', 'error');
      setVoiceConnected(false);
    } finally {
      setConnecting(false);
    }
  }, [connecting, initDevice, startProduce, startConsume, stopProduce, cleanup, setVoiceConnected]);

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
    clearChannelUrlParam();
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
    if (amIServerMuted) {
      const actor = amIServerMutedByAdmin ? '管理员' : '频道创建者';
      showToast(`${actor}已禁言你`, 'warning');
      return;
    }
    const newMuted = toggleMute();
    playSound(newMuted ? 'micMuted' : 'micActivated');
    getSocket()?.emit(EVENTS.CLIENT.USER_MUTE_SELF, { muted: newMuted });
  }, [toggleMute, amIServerMuted]);

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

  const [noiseTransiting, setNoiseTransiting] = useState(false);
  const [echoTransiting, setEchoTransiting] = useState(false);
  const handleNoiseSuppressionToggle = useCallback(() => {
    if (noiseTransiting) return;
    const next = !noiseSuppressionEnabled;
    setNoiseTransiting(true);
    setNoiseSuppressionEnabled(next);
    toggleNoiseSuppressor(next);
    setTimeout(() => setNoiseTransiting(false), 300);
  }, [noiseTransiting, noiseSuppressionEnabled, setNoiseSuppressionEnabled]);

  const handleEchoCancellationToggle = useCallback(async () => {
    if (echoTransiting) return;
    const next = !echoCancellationEnabled;
    setEchoTransiting(true);
    setEchoCancellationEnabled(next);

    try {
      if (isVoiceConnected) {
        const stream = await getStream(selectedInput || undefined, { echoCancellation: next });
        const processedTrack = await switchStream(stream);
        if (processedTrack) {
          await replaceTrack(processedTrack);
        }
      }
    } catch (e) {
      console.warn('[RoomPanel] echo cancellation toggle failed:', e);
      setEchoCancellationEnabled(echoCancellationEnabled);
      showToast('回声消除切换失败', 'error');
    } finally {
      setEchoTransiting(false);
    }
  }, [
    echoTransiting,
    echoCancellationEnabled,
    setEchoCancellationEnabled,
    isVoiceConnected,
    getStream,
    selectedInput,
    switchStream,
    replaceTrack,
  ]);

  const voiceChangerGlobalEnabled = useAdminStore((s) => s.config.voiceChangerEnabled);
  const voiceChangerChannelEnabled = currentChannel?.voiceChangerEnabled !== false;
  const voiceChangerAllowed = voiceChangerGlobalEnabled && voiceChangerChannelEnabled;
  const voiceChangerEnabled = useVoiceChangerStore((s) => s.enabled);
  const [vcTransiting, setVcTransiting] = useState(false);

  const emitVcStatus = useCallback((enabled: boolean, presetId?: string) => {
    const presetLabel = presetId ? (VOICE_PRESETS[presetId]?.label || '') : '';
    getSocket()?.emit(EVENTS.CLIENT.VC_STATUS, { enabled, presetLabel });
  }, []);

  const handleVoiceChangerToggle = useCallback((enabled: boolean) => {
    if (vcTransiting) return;
    setVcTransiting(true);
    if (enabled) {
      useVoiceChangerStore.getState().setEnabled(true);
      initVoiceChanger();
      if (useVoiceChangerStore.getState().enabled) {
        reconnectAudioGraph();
      }
      const pid = useVoiceChangerStore.getState().presetId;
      emitVcStatus(true, pid);
      setVcTransiting(false);
    } else {
      useVoiceChangerStore.getState().setEnabled(false);
      reconnectAudioGraph();
      emitVcStatus(false);
      setVcTransiting(false);
    }
  }, [vcTransiting, emitVcStatus]);

  const handleVoiceChangerPresetChange = useCallback((presetId: string) => {
    const rnOn = useMediaStore.getState().noiseSuppressionEnabled;
    const doSwitch = () => {
      switchPreset(presetId);
      emitVcStatus(true, presetId);
    };
    if (rnOn) {
      setVcTransiting(true);
      setNoiseTransiting(true);
      setNoiseSuppressionEnabled(false);
      toggleNoiseSuppressor(false);
      doSwitch();
      setNoiseSuppressionEnabled(true);
      toggleNoiseSuppressor(true);
      setTimeout(() => {
        setVcTransiting(false);
        setNoiseTransiting(false);
      }, 300);
    } else {
      doSwitch();
    }
  }, [emitVcStatus, setNoiseSuppressionEnabled]);

  const handleMicTest = useCallback(async () => {
    if (testCountdown > 0 || testPlaying) return;
    try {
      await startRecording();
      let sec = 5;
      setTestCountdown(sec);
      testTimerRef.current = setInterval(() => {
        sec--;
        setTestCountdown(sec);
        if (sec <= 0) {
          clearInterval(testTimerRef.current);
          setTestCountdown(0);
          setTestPlaying(true);
          stopRecording(() => {
            const buf = getRecordedBuffer();
            if (buf) {
              const vcEnabled = useVoiceChangerStore.getState().enabled;
              const presetId = useVoiceChangerStore.getState().presetId;
              const micGain = parseFloat(localStorage.getItem('vc_gain') || '1');
              playTest(buf, micGain, vcEnabled, presetId);
              setTimeout(() => {
                setTestPlaying(false);
                destroyPreview();
              }, buf.duration * 1000 + 300);
            } else {
              setTestPlaying(false);
              destroyPreview();
            }
          });
        }
      }, 1000);
    } catch {
      showToast('无法访问麦克风，请检查权限', 'error');
    }
  }, [testCountdown, testPlaying]);

  useEffect(() => {
    if (!voiceChangerAllowed && voiceChangerEnabled) {
      handleVoiceChangerToggle(false);
    }
  }, [voiceChangerAllowed, voiceChangerEnabled, handleVoiceChangerToggle]);

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

  const prevServerMuted = useRef(amIServerMuted);
  useEffect(() => {
    if (prevServerMuted.current && !amIServerMuted) forceMute();
    prevServerMuted.current = amIServerMuted;
  }, [amIServerMuted, forceMute]);

  useEffect(() => {
      const handler = (data: any) => {
        if (data.userId !== useUserStore.getState().userId) return;
        forceMute();
        const actor = data.byAdmin ? '管理员' : '频道创建者';
        useRoomStore.getState().setNotification(`${actor}已关闭你的麦克风`);
        playSound('micMuted');
      };
    getSocket()?.on('temp-muted', handler);
    return () => { getSocket()?.off('temp-muted', handler); };
  }, [forceMute]);

  if (!currentRoom) return null;

  const activeKicked = kickedList.filter(k => k.expiresAt > Date.now());

  return (
    <div className="min-h-[100dvh] relative">
      <TechBackground />
      <div className="max-w-6xl mx-auto px-4 py-6 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-1.5 flex-wrap mb-1">
              {currentChannel?.hasPassword && (
                <svg className="w-5 h-5 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
              {currentChannel?.type === 'user' && (
                <span className={`text-[10px] px-1 py-px rounded border shrink-0 ${currentChannel?.hasPassword ? 'text-yellow-400 border-yellow-500/30' : 'text-primary-300 border-primary-500/30'} leading-none`}>
                   临时
                </span>
              )}
              <span>{currentChannel?.name || currentRoom}</span>
              {selfLatency != null && (
                <span className="hidden sm:inline-flex sm:ml-2 items-center align-middle"><LatencyIndicator latency={selfLatency} /></span>
              )}
            </h1>
            <p className="text-gray-500 text-sm">
              {currentChannel?.type === 'user' && currentChannel?.creatorNickname
                ? `创建者：${currentChannel.creatorNickname}`
                : `#${currentRoom}`}
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-white/5 text-gray-500 border border-white/5">
                {getAudioQualityLabel(currentChannel?.audioBitrate ?? 32)}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isCreator && (
              <button onClick={() => setShowEditModal(true)} className="text-gray-500 hover:text-gray-300 transition-colors p-1" title="编辑频道">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
            <SettingsPanel />
            <button
              onClick={handleLeaveRoom}
              title="离开频道"
              className="semantic-red-button p-3 sm:p-2 rounded-lg transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
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
            <div className="theme-notice px-4 py-2 rounded-xl text-sm">
              {notification}
            </div>
          </div>
        )}

        <div className="glass-panel p-3 sm:p-4 sm:mb-6 flex flex-wrap items-center gap-3 sm:gap-4 overflow-visible sm:static fixed bottom-0 left-0 right-0 z-40 rounded-none sm:rounded-2xl">
          <AudioControls
            gain={gain}
            muted={muted}
            threshold={threshold}
            audioLevel={audioLevel}
            noiseSuppressionEnabled={noiseSuppressionEnabled}
            echoCancellationEnabled={echoCancellationEnabled}
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
            onEchoCancellationToggle={handleEchoCancellationToggle}
            noiseTransiting={noiseTransiting}
            echoTransiting={echoTransiting}
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
            amIServerMuted={amIServerMuted}
            voiceChangerEnabled={voiceChangerAllowed}
            onVoiceChangerToggle={handleVoiceChangerToggle}
            onVoiceChangerPresetChange={handleVoiceChangerPresetChange}
            onVoiceChangerPreview={() => setShowVoicePreview(true)}
            onMicTest={handleMicTest}
            testCountdown={testCountdown}
            testPlaying={testPlaying}
            vcTransiting={vcTransiting}
          />

          <div className="flex-1" />

          {isVoiceConnected ? (
            <>
              <span className="text-sm text-gray-400 font-mono tabular-nums">{fmt(duration)}</span>
              <button
                onClick={handleVoiceDisconnect}
                className="semantic-red-button text-sm font-medium px-5 py-2.5 rounded-xl transition-all active:scale-95"
              >
                断开语音
              </button>
            </>
          ) : (
            <button
              onClick={handleVoiceConnect}
              disabled={connecting}
              className="semantic-green-button disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-sm font-medium px-5 py-2.5 rounded-xl transition-all active:scale-95"
            >
              {connecting ? '连接中...' : '加入语音'}
            </button>
          )}
        </div>

        {(isAdmin || isCreator) && activeKicked.length > 0 && (
          <div className="glass-panel p-3 mb-4">
            <h4 className="text-xs font-medium text-gray-400 mb-2">被踢出用户（冷却中）</h4>
            <div className="flex flex-wrap gap-2">
              {activeKicked.map((k) => (
                <div key={k.deviceId} className="flex items-center gap-2 text-xs bg-gray-800/60 rounded-lg px-3 py-1.5">
                  <span className="text-gray-300">{k.nickname || k.deviceId.slice(0, 8)}</span>
                  <span className="text-gray-500">{k.deviceId.slice(0, 8)}</span>
                  <span className="text-yellow-400">{fmtKick(k.expiresAt - Date.now())}</span>
                  <button onClick={() => {
                    getSocket()?.emit(EVENTS.CLIENT.ADMIN_UNKICK, { deviceId: k.deviceId });
                    getSocket()?.emit(EVENTS.CLIENT.ADMIN_KICKLIST);
                  }} className="text-green-400 hover:text-green-300 ml-1">解除</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="glass-panel p-5">
          <UserGrid />
        </div>

        <div className="flex justify-center mt-4">
          <button
            onClick={() => {
              const url = `${window.location.origin}/?channel=${currentRoom}`;
              navigator.clipboard.writeText(url).then(() => {
                showToast('复制频道分享链接成功', 'success');
              }).catch(() => {
                setShowShareModal(true);
              });
            }}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors inline-flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            复制频道分享链接
          </button>
        </div>
      </div>

      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel p-4 w-full max-w-xs mx-4 animate-in zoom-in-95 fade-in duration-200 relative">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors text-sm leading-none"
            >
              ✕
            </button>
            <h3 className="text-base font-semibold text-white mb-3">分享频道链接</h3>
            <input
              type="text"
              readOnly
              value={`${window.location.origin}/?channel=${currentRoom}`}
              className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              autoFocus
              onFocus={(e) => e.target.select()}
            />
          </div>
        </div>
      )}

      {showVoicePreview && (
        <VoicePreviewModal onClose={() => setShowVoicePreview(false)} />
      )}

      {showEditModal && currentChannel && (
        <EditUserChannelModal
          channel={currentChannel}
          maxNameLen={6}
          maxUsers={20}
          allowedBitrates={[48, 64]}
          onClose={() => setShowEditModal(false)}
          voiceChangerGlobalEnabled={voiceChangerGlobalEnabled}
        />
      )}
    </div>
  );
};
