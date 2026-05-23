import { useMediaStore } from '../stores/mediaStore';

let audioContext: AudioContext | null = null;
let localStream: MediaStream | null = null;
let micGainNode: GainNode | null = null;
let localAudioSource: MediaStreamAudioSourceNode | null = null;
let analyserNode: AnalyserNode | null = null;
let noiseGateThreshold = -60;
let remoteGainNodes: Map<string, GainNode> = new Map();

export function getAudioContext(): AudioContext | null {
  return audioContext;
}

export function initAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

export async function setupLocalAudioGraph(stream: MediaStream): Promise<void> {
  const ctx = initAudioContext();
  localStream = stream;

  localAudioSource = ctx.createMediaStreamSource(stream);
  micGainNode = ctx.createGain();
  analyserNode = ctx.createAnalyser();
  analyserNode.fftSize = 256;
  analyserNode.smoothingTimeConstant = 0.8;

  localAudioSource.connect(micGainNode);
  micGainNode.connect(analyserNode);

  setMicGain(1.0);
}

export function setMicGain(value: number) {
  if (micGainNode) {
    micGainNode.gain.value = Math.max(0, Math.min(value, 2));
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
  const ctx = initAudioContext();
  const { track } = consumer;

  const stream = new MediaStream([track]);
  const source = ctx.createMediaStreamSource(stream);
  const gainNode = ctx.createGain();
  gainNode.gain.value = 1.0;

  source.connect(gainNode);
  gainNode.connect(ctx.destination);

  remoteGainNodes.set(producerId, gainNode);
}

export function setRemoteVolume(producerId: string, volume: number) {
  const node = remoteGainNodes.get(producerId);
  if (node) {
    node.gain.value = Math.max(0, Math.min(volume, 2));
  }
}

export function cleanupRemoteAudio(producerId: string) {
  const node = remoteGainNodes.get(producerId);
  if (node) {
    node.disconnect();
    remoteGainNodes.delete(producerId);
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
  if (analyserNode) {
    analyserNode.disconnect();
    analyserNode = null;
  }
  localStream = null;
}

export function destroyAudioGraph() {
  cleanupLocalAudio();
  for (const [, node] of remoteGainNodes) {
    node.disconnect();
  }
  remoteGainNodes.clear();
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}
