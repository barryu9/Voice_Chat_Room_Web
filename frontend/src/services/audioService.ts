import { useMediaStore } from '../stores/mediaStore';
import { useVoiceChangerStore } from '../stores/voiceChangerStore';
import { destroyNoiseSuppressor, isNoiseSuppressorEnabled, setNoiseSuppressorEnabled as setRNEnabled } from './rnnoiseService';
import { isVoiceChangerReady, connectVoiceChanger, disconnectVoiceChanger } from './voiceChangerService';
import {
  connectVocalEnhancer,
  connectVocalEnhancerOutput,
  destroyVocalEnhancer,
  disconnectVocalEnhancer,
  getVocalEnhancerInput,
  initVocalEnhancer,
  isVocalEnhancerReady,
} from './vocalEnhancerService';
import * as Tone from 'tone';

let audioContext: AudioContext | null = null;
let localStream: MediaStream | null = null;
let preProcessGainNode: GainNode | null = null;
let micGainNode: GainNode | null = null;
let agcGainNode: GainNode | null = null;
let agcAnalyserNode: AnalyserNode | null = null;
let gateGainNode: GainNode | null = null;
let localAudioSource: MediaStreamAudioSourceNode | null = null;
let analyserNode: AnalyserNode | null = null;
let noiseGateThreshold = -45;
let manualGainValue = 1;
let micMuted = false;
let autoGainValue = 1;
let lastAutoGainUpdate = 0;
let gateOpen = false;
let gateCloseAt = 0;
let noiseGateBackgroundBypass = false;
const AUTO_GAIN_TARGET_DB = -30;
const AUTO_GAIN_MIN = 0.6;
const AUTO_GAIN_MAX = 3;
const AUTO_GAIN_STEP = 0.005;
const AUTO_GAIN_UPDATE_INTERVAL = 0.05;
const NOISE_GATE_HYSTERESIS_DB = 6;
const NOISE_GATE_HOLD_SECONDS = 0.35;
const NOISE_GATE_CLOSED_GAIN = 0.03;
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

export async function resumeAudioContext(): Promise<void> {
  if (audioContext?.state === 'suspended') {
    await audioContext.resume();
  }
}

export async function setupLocalAudioGraph(stream: MediaStream): Promise<void> {
  const ctx = await initAudioContext();
  localStream = stream;
  autoGainValue = 1;
  lastAutoGainUpdate = 0;

  localAudioSource = ctx.createMediaStreamSource(stream);

  preProcessGainNode = ctx.createGain();
  micGainNode = ctx.createGain();
  agcGainNode = ctx.createGain();
  agcAnalyserNode = ctx.createAnalyser();
  gateGainNode = ctx.createGain();
  analyserNode = ctx.createAnalyser();
  processedDestination = ctx.createMediaStreamDestination();

  analyserNode.fftSize = 256;
  analyserNode.smoothingTimeConstant = 0.8;
  agcAnalyserNode.fftSize = 256;
  agcAnalyserNode.smoothingTimeConstant = 0.8;

  agcGainNode.gain.value = useMediaStore.getState().autoGainControlEnabled ? autoGainValue : 1;
  await tryConnectRNNoise(ctx);

  setMicGain(1.0);
  gateOpen = false;
  gateCloseAt = 0;
  gateGainNode.gain.value = NOISE_GATE_CLOSED_GAIN;

  const savedGain = localStorage.getItem('vc_gain');
  if (savedGain) setMicGain(parseFloat(savedGain));
  const savedMuted = localStorage.getItem('vc_muted');
  setMicMute(savedMuted === 'true');
  const savedThreshold = localStorage.getItem('vc_threshold');
  if (savedThreshold) setNoiseGateThreshold(parseInt(savedThreshold));

  reconnectAudioGraph();
}

async function tryConnectRNNoise(ctx: AudioContext) {
  try {
    const { createNoiseSuppressor } = await import('./rnnoiseService');
    const suppressor = await createNoiseSuppressor(ctx);
    if (suppressor && preProcessGainNode && gateGainNode) {
      rnnoiseInput = suppressor.inputNode;
      rnnoiseOutputTarget = preProcessGainNode;
      rnnoiseConnectOutput = suppressor.connectOutput;
      rnnoiseDisconnectOutput = suppressor.disconnectOutput;
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
  if (!localAudioSource || !preProcessGainNode || !micGainNode || !agcGainNode || !analyserNode || !agcAnalyserNode || !gateGainNode || !processedDestination) return;

  localAudioSource.disconnect();
  preProcessGainNode.disconnect();
  agcGainNode.disconnect();
  micGainNode.disconnect();
  gateGainNode.disconnect();
  if (rnnoiseConnected) rnnoiseDisconnectOutput?.();
  disconnectVoiceChanger();
  disconnectVocalEnhancer();

  const vcEnabled = useVoiceChangerStore.getState().enabled && isVoiceChangerReady();
  const rnEnabled = rnnoiseConnected && isNoiseSuppressorEnabled();
  const vocalEnabled = useMediaStore.getState().vocalEnhancerEnabled;
  if (vocalEnabled && !isVocalEnhancerReady()) {
    initVocalEnhancer();
  }
  const canUseVocalEnhancer = vocalEnabled && isVocalEnhancerReady();
  const preAgcOutputNode = preProcessGainNode;
  const agcNode = agcGainNode;
  const manualGainNode = micGainNode;
  const agcMeterNode = agcAnalyserNode;
  const levelMeterNode = analyserNode;
  const outputNode = gateGainNode;
  const connectAgcStage = (sourceNode: AudioNode) => {
    sourceNode.connect(agcNode);
    agcNode.connect(agcMeterNode);
    agcNode.connect(manualGainNode);
    manualGainNode.connect(levelMeterNode);
  };

  if (rnEnabled) {
    localAudioSource.connect(rnnoiseInput!);
    const vocalInput = canUseVocalEnhancer ? getVocalEnhancerInput() : null;
    if (vocalInput && connectVocalEnhancerOutput(preAgcOutputNode)) {
      rnnoiseConnectOutput!(vocalInput);
    } else {
      rnnoiseConnectOutput!(preAgcOutputNode);
    }
    isBypassMode = false;
  } else {
    if (canUseVocalEnhancer && connectVocalEnhancer(localAudioSource, preAgcOutputNode)) {
      // connected through vocal enhancer
    } else {
      localAudioSource.connect(preAgcOutputNode);
    }
    isBypassMode = true;
  }

  connectAgcStage(preAgcOutputNode);
  micGainNode.connect(outputNode);

  if (vcEnabled) {
    connectVoiceChanger(gateGainNode, processedDestination);
  } else {
    gateGainNode.connect(processedDestination);
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

export function toggleVocalEnhancer(enabled: boolean) {
  useMediaStore.getState().setVocalEnhancerEnabled(enabled);
  reconnectAudioGraph();
}

export function updateNoiseGate(level: number, threshold: number) {
  if (!gateGainNode) return;
  noiseGateThreshold = threshold;
  updateAutoGain(level, threshold);
  const now = gateGainNode.context.currentTime;

  if (noiseGateBackgroundBypass) {
    gateGainNode.gain.cancelScheduledValues(now);
    gateGainNode.gain.setTargetAtTime(micMuted ? 0 : 1.0, now, 0.02);
    return;
  }

  const openThreshold = threshold;
  const closeThreshold = threshold - NOISE_GATE_HYSTERESIS_DB;

  if (level > openThreshold) {
    gateOpen = true;
    gateCloseAt = now + NOISE_GATE_HOLD_SECONDS;
  } else if (gateOpen && level > closeThreshold) {
    gateCloseAt = now + NOISE_GATE_HOLD_SECONDS;
  } else if (gateOpen && now >= gateCloseAt) {
    gateOpen = false;
  }

  const target = micMuted ? 0 : gateOpen ? 1.0 : NOISE_GATE_CLOSED_GAIN;
  gateGainNode.gain.cancelScheduledValues(now);
  const timeConstant = target > gateGainNode.gain.value ? 0.01 : 0.2;
  gateGainNode.gain.setTargetAtTime(target, now, timeConstant);
}

export function setMicGain(value: number) {
  manualGainValue = Math.max(0, Math.min(value, 4));
  if (micGainNode) {
    micGainNode.gain.value = micMuted ? 0 : manualGainValue;
  }
}

export function setMicMute(muted: boolean) {
  micMuted = muted;
  if (micGainNode) {
    micGainNode.gain.value = muted ? 0 : manualGainValue;
  }
  if (gateGainNode) {
    const now = gateGainNode.context.currentTime;
    gateGainNode.gain.cancelScheduledValues(now);
    gateGainNode.gain.setTargetAtTime(muted ? 0 : (noiseGateBackgroundBypass || gateOpen ? 1.0 : NOISE_GATE_CLOSED_GAIN), now, 0.02);
  }
}

export function setNoiseGateThreshold(db: number) {
  noiseGateThreshold = db;
}

export function setNoiseGateBackgroundBypass(enabled: boolean) {
  noiseGateBackgroundBypass = enabled;
  if (!gateGainNode) return;

  const now = gateGainNode.context.currentTime;
  if (enabled) {
    gateOpen = true;
    gateCloseAt = now + NOISE_GATE_HOLD_SECONDS;
  }

  const target = micMuted ? 0 : enabled || gateOpen ? 1.0 : NOISE_GATE_CLOSED_GAIN;
  gateGainNode.gain.cancelScheduledValues(now);
  gateGainNode.gain.setTargetAtTime(target, now, enabled ? 0.02 : 0.08);
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
  if (micMuted) return;

  const now = agcGainNode.context.currentTime;
  if (now - lastAutoGainUpdate < AUTO_GAIN_UPDATE_INTERVAL) return;
  lastAutoGainUpdate = now;

  const agcLevel = getAutoGainLevel();
  if (!Number.isFinite(agcLevel) || level <= threshold) return;

  const errorDb = AUTO_GAIN_TARGET_DB - agcLevel;
  const multiplier = Math.pow(10, (errorDb * AUTO_GAIN_STEP) / 20);
  const nextGain = Math.max(AUTO_GAIN_MIN, Math.min(AUTO_GAIN_MAX, autoGainValue * multiplier));
  const timeConstant = nextGain > autoGainValue ? 0.7 : 0.25;

  autoGainValue = nextGain;
  agcGainNode.gain.cancelScheduledValues(now);
  agcGainNode.gain.setTargetAtTime(autoGainValue, now, timeConstant);
}

function getAutoGainLevel(): number {
  if (!agcAnalyserNode) return -100;

  const dataArray = new Uint8Array(agcAnalyserNode.frequencyBinCount);
  agcAnalyserNode.getByteTimeDomainData(dataArray);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const v = (dataArray[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / dataArray.length);
  return 20 * Math.log10(Math.max(rms, 1e-6));
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
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      try { track.stop(); } catch {}
    });
  }
  if (localAudioSource) {
    localAudioSource.disconnect();
    localAudioSource = null;
  }
  if (preProcessGainNode) {
    preProcessGainNode.disconnect();
    preProcessGainNode = null;
  }
  if (micGainNode) {
    micGainNode.disconnect();
    micGainNode = null;
  }
  if (agcGainNode) {
    agcGainNode.disconnect();
    agcGainNode = null;
  }
  if (agcAnalyserNode) {
    agcAnalyserNode.disconnect();
    agcAnalyserNode = null;
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
  destroyVocalEnhancer();
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
