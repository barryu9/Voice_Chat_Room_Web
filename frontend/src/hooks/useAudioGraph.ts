import { useRef, useCallback, useState, useEffect } from 'react';
import {
  initAudioContext, setupLocalAudioGraph, setMicGain,
  setMicMute, setNoiseGateThreshold, getAudioLevel, cleanupLocalAudio,
  updateNoiseGate, getProcessedStream,
} from '../services/audioService';

export function useAudioGraph() {
  const [gain, setGain] = useState(1.0);
  const [muted, setMuted] = useState(false);
  const [threshold, setThreshold] = useState(-60);
  const [audioLevel, setAudioLevel] = useState(-100);
  const animRef = useRef<number>(0);

  const setupLocal = useCallback(async (stream: MediaStream) => {
    await setupLocalAudioGraph(stream);
  }, []);

  const updateGain = useCallback((value: number) => {
    setGain(value);
    setMicGain(value);
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = !muted;
    setMuted(newMuted);
    setMicMute(newMuted);
    return newMuted;
  }, [muted]);

  const updateThreshold = useCallback((value: number) => {
    setThreshold(value);
    setNoiseGateThreshold(value);
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
    setupLocal, updateGain, toggleMute, updateThreshold, cleanup, switchStream,
    initAudioContext,
  };
}
