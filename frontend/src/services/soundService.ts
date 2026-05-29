import { useSoundStore, SoundKey, SOUND_FILES } from '../stores/soundStore';

let audioUnlocked = false;

export function preloadAllSounds() {
  // Pre-warm by creating and immediately discarding Audio elements
  const keys = Object.keys(SOUND_FILES) as SoundKey[];
  keys.forEach((k) => { new Audio(SOUND_FILES[k]); });
}

export function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  const a = new Audio();
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

  const audio = new Audio(src);
  audio.volume = 0.7;
  const promise = audio.play();
  if (promise) {
    promise.catch(() => {
      if (!audioUnlocked) unlockAudio();
    });
  }
}
