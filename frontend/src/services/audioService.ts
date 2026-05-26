import { useMediaStore } from '../stores/mediaStore';
import { destroyNoiseSuppressor } from './rnnoiseService';

let audioContext: AudioContext | null = null;
let localStream: MediaStream | null = null;
let micGainNode: GainNode | null = null;
let gateGainNode: GainNode | null = null;
let localAudioSource: MediaStreamAudioSourceNode | null = null;
let analyserNode: AnalyserNode | null = null;
let noiseGateThreshold = -50;
const remoteAudioElements: Map<string, HTMLAudioElement> = new Map();
let processedDestination: MediaStreamAudioDestinationNode | null = null;
let rnnoiseConnected = false;

export function getAudioContext(): AudioContext | null {
  return audioContext;
}

export async function initAudioContext(): Promise<AudioContext> {
  if (!audioContext) {
    audioContext = new AudioContext();
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
  gateGainNode = ctx.createGain();
  analyserNode = ctx.createAnalyser();
  processedDestination = ctx.createMediaStreamDestination();

  analyserNode.fftSize = 256;
  analyserNode.smoothingTimeConstant = 0.8;

  localAudioSource.connect(micGainNode);
  micGainNode.connect(analyserNode);

  await tryConnectRNNoise(ctx);

  if (!rnnoiseConnected) {
    micGainNode.connect(gateGainNode);
  }
  gateGainNode.connect(processedDestination);

  setMicGain(1.0);
  gateGainNode.gain.value = 0;

  const savedGain = localStorage.getItem('vc_gain');
  if (savedGain) setMicGain(parseFloat(savedGain));
  const savedThreshold = localStorage.getItem('vc_threshold');
  if (savedThreshold) setNoiseGateThreshold(parseInt(savedThreshold));
}

async function tryConnectRNNoise(ctx: AudioContext) {
  try {
    const { createNoiseSuppressor } = await import('./rnnoiseService');
    const suppressor = await createNoiseSuppressor(ctx);
    if (suppressor && micGainNode && gateGainNode) {
      micGainNode.connect(suppressor.inputNode);
      suppressor.connectOutput(gateGainNode);
      rnnoiseConnected = true;
    }
  } catch {
    rnnoiseConnected = false;
  }
}

export function getProcessedStream(): MediaStream | null {
  return processedDestination?.stream || null;
}

export function updateNoiseGate(level: number, threshold: number) {
  if (!gateGainNode) return;
  noiseGateThreshold = threshold;
  const target = level > threshold ? 1.0 : 0;
  const current = gateGainNode.gain.value;
  gateGainNode.gain.value = current + (target - current) * 0.3;
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
    audio.volume = Math.max(0, Math.min(volume * masterVol, 3));
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
  }
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
