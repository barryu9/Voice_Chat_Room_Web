let audioContext: AudioContext | null = null;
let localStream: MediaStream | null = null;
let micGainNode: GainNode | null = null;
let localAudioSource: MediaStreamAudioSourceNode | null = null;
let analyserNode: AnalyserNode | null = null;
let noiseGateThreshold = -60;
const remoteAudioElements: Map<string, HTMLAudioElement> = new Map();

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
    audio.volume = Math.max(0, Math.min(volume, 2));
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
  if (analyserNode) {
    analyserNode.disconnect();
    analyserNode = null;
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
