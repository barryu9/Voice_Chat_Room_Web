import { useRef, useCallback, useState, useEffect } from 'react';
import { useMediaStore } from '../stores/mediaStore';
import { useVoiceChangerStore } from '../stores/voiceChangerStore';
import {
  initAudioContext, resumeAudioContext, setupLocalAudioGraph, setMicGain,
  setMicMute, setNoiseGateThreshold, getAudioLevel, cleanupLocalAudio,
  updateNoiseGate, getProcessedStream, toggleVoiceChanger,
} from '../services/audioService';
import { initVoiceChanger, destroyVoiceChanger } from '../services/voiceChangerService';

export function useAudioGraph() {
  const [gain, setGain] = useState(() => {
    const saved = localStorage.getItem('vc_gain');
    return saved ? parseFloat(saved) : 1.0;
  });
  const [muted, setMuted] = useState(() => {
    const saved = localStorage.getItem('vc_muted');
    return saved === 'true';
  });
  const [threshold, setThreshold] = useState(() => {
    const saved = localStorage.getItem('vc_threshold');
    return saved ? parseInt(saved) : -45;
  });
  const [audioLevel, setAudioLevel] = useState(-100);
  const meterTimerRef = useRef<ReturnType<typeof window.setInterval> | null>(null);

  const setupLocal = useCallback(async (stream: MediaStream) => {
    await setupLocalAudioGraph(stream);
    setMicGain(gain);
    setNoiseGateThreshold(threshold);
  }, [gain, threshold]);

  const updateGain = useCallback((value: number) => {
    setGain(value);
    setMicGain(value);
    localStorage.setItem('vc_gain', String(value));
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = !muted;
    setMuted(newMuted);
    setMicMute(newMuted);
    localStorage.setItem('vc_muted', String(newMuted));
    return newMuted;
  }, [muted]);

  const forceMute = useCallback(() => {
    setMuted(true);
    setMicMute(true);
    localStorage.setItem('vc_muted', 'true');
  }, []);

  const updateThreshold = useCallback((value: number) => {
    setThreshold(value);
    setNoiseGateThreshold(value);
    localStorage.setItem('vc_threshold', String(value));
  }, []);

  useEffect(() => {
    const updateMeter = () => {
      const level = getAudioLevel();
      setAudioLevel(level);
      useMediaStore.getState().setMyAudioLevel(level);
      updateNoiseGate(level, threshold);
    };

    updateMeter();
    meterTimerRef.current = window.setInterval(updateMeter, 50);
    return () => {
      if (meterTimerRef.current) {
        window.clearInterval(meterTimerRef.current);
        meterTimerRef.current = null;
      }
    };
  }, [threshold]);

  useEffect(() => {
    const recoverAudio = async () => {
      try {
        await resumeAudioContext();
      } catch (e) {
        console.warn('[AudioGraph] audio context recovery failed:', e);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        recoverAudio();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', recoverAudio);
    window.addEventListener('pageshow', recoverAudio);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', recoverAudio);
      window.removeEventListener('pageshow', recoverAudio);
    };
  }, []);

  const cleanup = useCallback(() => {
    cleanupLocalAudio();
    destroyVoiceChanger();
    useVoiceChangerStore.getState().reset();
  }, []);

  const switchStream = useCallback(async (stream: MediaStream) => {
    cleanupLocalAudio();
    await setupLocalAudioGraph(stream);
    return getProcessedStream()?.getAudioTracks()[0] || null;
  }, []);

  const startVoiceChanger = useCallback(() => {
    initVoiceChanger();
    toggleVoiceChanger(true);
  }, []);

  const stopVoiceChanger = useCallback(() => {
    toggleVoiceChanger(false);
  }, []);

  return {
    gain, muted, threshold, audioLevel,
    setupLocal, updateGain, toggleMute, forceMute, updateThreshold, cleanup, switchStream,
    initAudioContext, startVoiceChanger, stopVoiceChanger,
  };
}
