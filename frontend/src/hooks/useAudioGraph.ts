import { useRef, useCallback, useState, useEffect } from 'react';
import {
  initAudioContext, setupLocalAudioGraph, setMicGain,
  setMicMute, setNoiseGateThreshold, getAudioLevel, cleanupLocalAudio,
  updateNoiseGate, getProcessedStream,
} from '../services/audioService';

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
    return saved ? parseInt(saved) : -50;
  });
  const [audioLevel, setAudioLevel] = useState(-100);
  const animRef = useRef<number>(0);

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
    const loop = () => {
      const level = getAudioLevel();
      setAudioLevel(level);
      updateNoiseGate(level, threshold);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [threshold]);

  const cleanup = useCallback(() => {
    cleanupLocalAudio();
    cancelAnimationFrame(animRef.current);
  }, []);

  const switchStream = useCallback(async (stream: MediaStream) => {
    cleanupLocalAudio();
    await setupLocalAudioGraph(stream);
    return getProcessedStream()?.getAudioTracks()[0] || null;
  }, []);

  return {
    gain, muted, threshold, audioLevel,
    setupLocal, updateGain, toggleMute, forceMute, updateThreshold, cleanup, switchStream,
    initAudioContext,
  };
}
