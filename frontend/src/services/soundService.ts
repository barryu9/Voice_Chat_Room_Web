import { useSoundStore, SoundKey, SOUND_FILES } from '../stores/soundStore';

let audioUnlocked = false;
let mediaSinkId = localStorage.getItem('vc_selected_output') || '';
const activeMediaSounds = new Set<HTMLAudioElement>();

export function preloadAllSounds() {
  const keys = Object.keys(SOUND_FILES) as SoundKey[];
  keys.forEach((k) => {
    const audio = createMediaAudioElement(SOUND_FILES[k]);
    audio.preload = 'auto';
    audio.load();
  });
}

export function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  const a = createMediaAudioElement();
  a.play().then(() => a.pause()).catch(() => {});
}

export async function setSoundSinkId(deviceId: string): Promise<void> {
  mediaSinkId = deviceId;
  const promises: Promise<void>[] = [];
  for (const audio of activeMediaSounds) {
    promises.push(applyMediaSinkId(audio));
  }
  await Promise.all(promises);
}

export function playSound(key: SoundKey) {
  if (!useSoundStore.getState().isEnabled(key)) return;
  playSoundFile(key);
}

export function previewSound(key: SoundKey) {
  playSoundFile(key);
}

function playSoundFile(key: SoundKey) {
  const src = SOUND_FILES[key];
  if (!src) return;

  const audio = createMediaAudioElement(src);
  audio.volume = 0.7;
  activeMediaSounds.add(audio);
  const cleanup = () => {
    activeMediaSounds.delete(audio);
    audio.remove();
  };
  audio.addEventListener('ended', cleanup, { once: true });
  audio.addEventListener('error', cleanup, { once: true });

  const promise = applyMediaSinkId(audio).then(() => audio.play());
  if (promise) {
    promise.catch(() => {
      cleanup();
      if (!audioUnlocked) unlockAudio();
    });
  }
}

function createMediaAudioElement(src = ''): HTMLAudioElement {
  const audio = new Audio(src);
  audio.autoplay = false;
  audio.controls = false;
  audio.setAttribute('playsinline', 'true');
  audio.dataset.audioRole = 'media-sound-effect';
  return audio;
}

async function applyMediaSinkId(audio: HTMLAudioElement): Promise<void> {
  if (!mediaSinkId || !('setSinkId' in audio)) return;
  try {
    await (audio as any).setSinkId(mediaSinkId);
  } catch (e) {
    console.warn('[Sound] setSinkId failed:', e);
  }
}
