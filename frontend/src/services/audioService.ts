import { useMediaStore } from '../stores/mediaStore';
import { useVoiceChangerStore } from '../stores/voiceChangerStore';
import { destroyNoiseSuppressor, isNoiseSuppressorEnabled, setNoiseSuppressorEnabled as setRNEnabled } from './rnnoiseService';
import { isVoiceChangerReady, connectVoiceChanger, disconnectVoiceChanger, getVoiceChangerOutput } from './voiceChangerService';
import * as Tone from 'tone';

let audioContext: AudioContext | null = null;
let localStream: MediaStream | null = null;
let micGainNode: GainNode | null = null;
let agcGainNode: GainNode | null = null;
let gateGainNode: GainNode | null = null;
let localAudioSource: MediaStreamAudioSourceNode | null = null;
let analyserNode: AnalyserNode | null = null;
let noiseGateThreshold = -45;
let autoGainValue = 1;
let lastAutoGainUpdate = 0;
const AUTO_GAIN_TARGET_DB = -24;
const AUTO_GAIN_MIN = 0.85;
const AUTO_GAIN_MAX = 3;
const AUTO_GAIN_STEP = 0.015;
const AUTO_GAIN_UPDATE_INTERVAL = 0.05;
const remoteAudioElements: Map<string, HTMLAudioElement> = new Map();
let processedDestination: MediaStreamAudioDestinationNode | null = null;
let rnnoiseConnected = false;
let rnnoiseInput: AudioNode | null = null;
let rnnoiseOutputTarget: AudioNode | null = null;
let rnnoiseConnectOutput: ((target: AudioNode) => void) | null = null;
let rnnoiseDisconnectOutput: (() => void) | null = null;
let isBypassMode = true;

export function getAudioContext(): AudioContext | null {
  return audioContext;
}

export async function initAudioContext(): Promise<AudioContext> {
  if (!audioContext) {
    audioContext = new AudioContext();
    // Share native AudioContext with tone.js so all Tone nodes use the same context
    // Tone.setContext expects BaseContext in v15, but raw AudioContext works at runtime
    Tone.setContext(audioContext as any);
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  return audioContext;
}

export async function setupLocalAudioGraph(stream: MediaStream): Promise<void> {
  const ctx = await initAudioContext();
  localStream = stream;

  localAudioSource = ctx.createMediaStreamSource(stream);

  micGainNode = ctx.createGain();
  agcGainNode = ctx.createGain();
  gateGainNode = ctx.createGain();
  analyserNode = ctx.createAnalyser();
  processedDestination = ctx.createMediaStreamDestination();

  analyserNode.fftSize = 256;
  analyserNode.smoothingTimeConstant = 0.8;

  localAudioSource.connect(micGainNode);
  micGainNode.connect(agcGainNode);
  agcGainNode.gain.value = useMediaStore.getState().autoGainControlEnabled ? autoGainValue : 1;

  await tryConnectRNNoise(ctx);

  gateGainNode.connect(processedDestination);

  setMicGain(1.0);
  gateGainNode.gain.value = 0;

  const savedGain = localStorage.getItem('vc_gain');
  if (savedGain) setMicGain(parseFloat(savedGain));
  const savedMuted = localStorage.getItem('vc_muted');
  if (savedMuted === 'true') micGainNode.gain.value = 0;
  const savedThreshold = localStorage.getItem('vc_threshold');
  if (savedThreshold) setNoiseGateThreshold(parseInt(savedThreshold));

  reconnectAudioGraph();
}

async function tryConnectRNNoise(ctx: AudioContext) {
  try {
    const { createNoiseSuppressor } = await import('./rnnoiseService');
    const suppressor = await createNoiseSuppressor(ctx);
    if (suppressor && micGainNode && gateGainNode) {
      rnnoiseInput = suppressor.inputNode;
      rnnoiseOutputTarget = gateGainNode;
      rnnoiseConnectOutput = suppressor.connectOutput;
      rnnoiseDisconnectOutput = suppressor.disconnectOutput;
      if (isNoiseSuppressorEnabled()) {
        suppressor.connectOutput(gateGainNode);
        micGainNode.connect(suppressor.inputNode);
        isBypassMode = false;
      }
      rnnoiseConnected = true;
    }
  } catch {
    rnnoiseConnected = false;
  }
}

export function getProcessedStream(): MediaStream | null {
  return processedDestination?.stream || null;
}

export function reconnectAudioGraph() {
  if (!agcGainNode || !analyserNode || !gateGainNode) return;

  agcGainNode.disconnect();
  if (rnnoiseConnected) rnnoiseDisconnectOutput?.();
  disconnectVoiceChanger();

  const vcEnabled = useVoiceChangerStore.getState().enabled && isVoiceChangerReady();
  const rnEnabled = rnnoiseConnected && isNoiseSuppressorEnabled();
  const graphInputNode = agcGainNode;

  if (vcEnabled) {
    connectVoiceChanger(graphInputNode, analyserNode);
    const vcOut = getVoiceChangerOutput();
    if (!vcOut) return;
    if (rnEnabled) {
      vcOut.connect(rnnoiseInput!);
      rnnoiseConnectOutput!(gateGainNode);
      isBypassMode = false;
    } else {
      vcOut.connect(gateGainNode);
      isBypassMode = true;
    }
  } else {
    graphInputNode.connect(analyserNode);
    if (rnEnabled) {
      graphInputNode.connect(rnnoiseInput!);
      rnnoiseConnectOutput!(gateGainNode);
      isBypassMode = false;
    } else {
      graphInputNode.connect(gateGainNode);
      isBypassMode = true;
    }
  }
}

export function toggleVoiceChanger(enabled: boolean) {
  useVoiceChangerStore.getState().setEnabled(enabled);
  reconnectAudioGraph();
}

export function toggleNoiseSuppressor(enabled: boolean) {
  setRNEnabled(enabled);
  if (rnnoiseConnected && micGainNode) {
    reconnectAudioGraph();
  }
}

export function updateNoiseGate(level: number, threshold: number) {
  if (!gateGainNode) return;
  noiseGateThreshold = threshold;
  updateAutoGain(level, threshold);
  const target = level > threshold ? 1.0 : 0;
  const now = gateGainNode.context.currentTime;
  gateGainNode.gain.cancelScheduledValues(now);
  const timeConstant = target > gateGainNode.gain.value ? 0.01 : 0.2;
  gateGainNode.gain.setTargetAtTime(target, now, timeConstant);
}

export function setMicGain(value: number) {
  if (micGainNode) {
    micGainNode.gain.value = Math.max(0, Math.min(value, 3));
  }
}

export function setMicMute(muted: boolean) {
  if (micGainNode) {
    micGainNode.gain.value = muted ? 0 : 1;
  }
}

export function setNoiseGateThreshold(db: number) {
  noiseGateThreshold = db;
}

export function setLocalAutoGainEnabled(enabled: boolean) {
  if (!agcGainNode) return;
  if (!enabled) {
    autoGainValue = 1;
    const now = agcGainNode.context.currentTime;
    agcGainNode.gain.cancelScheduledValues(now);
    agcGainNode.gain.setTargetAtTime(1, now, 0.12);
    return;
  }
  agcGainNode.gain.setTargetAtTime(autoGainValue, agcGainNode.context.currentTime, 0.2);
}

function updateAutoGain(level: number, threshold: number) {
  if (!agcGainNode || !useMediaStore.getState().autoGainControlEnabled) return;

  const now = agcGainNode.context.currentTime;
  if (now - lastAutoGainUpdate < AUTO_GAIN_UPDATE_INTERVAL) return;
  lastAutoGainUpdate = now;

  if (!Number.isFinite(level) || level <= threshold) return;

  const errorDb = AUTO_GAIN_TARGET_DB - level;
  const multiplier = Math.pow(10, (errorDb * AUTO_GAIN_STEP) / 20);
  const nextGain = Math.max(AUTO_GAIN_MIN, Math.min(AUTO_GAIN_MAX, autoGainValue * multiplier));
  const timeConstant = nextGain > autoGainValue ? 0.7 : 0.25;

  autoGainValue = nextGain;
  agcGainNode.gain.cancelScheduledValues(now);
  agcGainNode.gain.setTargetAtTime(autoGainValue, now, timeConstant);
}

export function getAudioLevel(): number {
  if (!analyserNode) return -100;

  const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
  analyserNode.getByteTimeDomainData(dataArray);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const v = (dataArray[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / dataArray.length);
  const db = 20 * Math.log10(Math.max(rms, 1e-6));
  return db;
}

export async function setupRemoteAudio(consumer: any, producerId: string): Promise<void> {
  cleanupRemoteAudio(producerId);

  const { track } = consumer;
  const stream = new MediaStream([track]);
  const audio = document.createElement('audio');
  audio.srcObject = stream;
  audio.autoplay = true;
  audio.setAttribute('playsinline', 'true');
  audio.volume = 1.0;
  audio.style.display = 'none';
  document.body.appendChild(audio);

  audio.play().catch((e) => {
    console.warn('[Audio] autoplay blocked for', producerId);
    const resume = () => {
      audio.play().catch(() => {});
      document.removeEventListener('click', resume);
      document.removeEventListener('touchend', resume);
    };
    document.addEventListener('click', resume, { once: true });
    document.addEventListener('touchend', resume, { once: true });
  });

  remoteAudioElements.set(producerId, audio);
}

export function setRemoteVolume(producerId: string, volume: number) {
  const audio = remoteAudioElements.get(producerId);
  if (audio) {
    const masterVol = useMediaStore.getState().masterVolume;
    audio.volume = Math.max(0, Math.min(volume * masterVol, 1));
  }
}

export function applyMasterVolume() {
  const masterVol = useMediaStore.getState().masterVolume;
  for (const [producerId, audio] of remoteAudioElements) {
    const gain = useMediaStore.getState().remoteAudioGains.get(producerId) ?? 1.0;
    audio.volume = Math.max(0, Math.min(gain * masterVol, 3));
  }
}

export function cleanupRemoteAudio(producerId: string) {
  const audio = remoteAudioElements.get(producerId);
  if (audio) {
    audio.srcObject = null;
    audio.remove();
    remoteAudioElements.delete(producerId);
  }
}

export async function setAllSinkIds(deviceId: string): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const [, audio] of remoteAudioElements) {
    if ('setSinkId' in (audio as any)) {
      promises.push((audio as any).setSinkId(deviceId));
    }
  }
  try {
    await Promise.all(promises);
  } catch (e) {
    console.warn('[Audio] setSinkId failed for some elements:', e);
  }
}

export function muteRemote(producerId: string) {
  const audio = remoteAudioElements.get(producerId);
  if (audio) audio.volume = 0;
}

export function unmuteRemote(producerId: string) {
  const audio = remoteAudioElements.get(producerId);
  if (audio) audio.volume = 1.0;
}

export function muteAllRemotes() {
  for (const [, audio] of remoteAudioElements) {
    audio.volume = 0;
  }
}

export function unmuteAllRemotes() {
  for (const [, audio] of remoteAudioElements) {
    audio.volume = 1.0;
  }
}

export function applyMuteState(producerId: string, isGloballyMuted: boolean, isPerUserMuted: boolean) {
  const audio = remoteAudioElements.get(producerId);
  if (audio) {
    audio.volume = (isGloballyMuted || isPerUserMuted) ? 0 : 1.0;
  }
}

export function cleanupLocalAudio() {
  if (localAudioSource) {
    localAudioSource.disconnect();
    localAudioSource = null;
  }
  if (micGainNode) {
    micGainNode.disconnect();
    micGainNode = null;
  }
  if (agcGainNode) {
    agcGainNode.disconnect();
    agcGainNode = null;
  }
  if (gateGainNode) {
    gateGainNode.disconnect();
    gateGainNode = null;
  }
  if (analyserNode) {
    analyserNode.disconnect();
    analyserNode = null;
  }
  if (processedDestination) {
    processedDestination = null;
  }
  if (rnnoiseConnected) {
    destroyNoiseSuppressor();
    rnnoiseConnected = false;
    rnnoiseInput = null;
    rnnoiseOutputTarget = null;
    rnnoiseConnectOutput = null;
    rnnoiseDisconnectOutput = null;
    isBypassMode = true;
  }
  disconnectVoiceChanger();
  localStream = null;
}

export function destroyAudioGraph() {
  cleanupLocalAudio();
  for (const [, audio] of remoteAudioElements) {
    audio.srcObject = null;
    audio.remove();
  }
  remoteAudioElements.clear();
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}
