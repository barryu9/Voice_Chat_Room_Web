import { useSoundStore, SoundKey, SOUND_FILES } from '../stores/soundStore';

let audioUnlocked = false;

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
  const cleanup = () => audio.remove();
  audio.addEventListener('ended', cleanup, { once: true });
  audio.addEventListener('error', cleanup, { once: true });

  audio.play().catch(() => {
    cleanup();
    if (!audioUnlocked) unlockAudio();
  });
}

function createMediaAudioElement(src = ''): HTMLAudioElement {
  const audio = new Audio(src);
  audio.autoplay = false;
  audio.controls = false;
  audio.setAttribute('playsinline', 'true');
  return audio;
}
