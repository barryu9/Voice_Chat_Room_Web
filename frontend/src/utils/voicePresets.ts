import * as Tone from 'tone';

type PresetFactory = () => Tone.ToneAudioNode[];

export interface PresetEntry {
  label: string;
  factory: PresetFactory;
}

// Run .start() on nodes that need it (Chorus, Vibrato, Tremolo, etc.)
function startNode(node: Tone.ToneAudioNode): Tone.ToneAudioNode {
  if (typeof (node as any).start === 'function') {
    try { (node as any).start(); } catch {}
  }
  return node;
}

export const VOICE_PRESETS: Record<string, PresetEntry> = {
  // === 人物变声 ===
  'male-to-female': {
    label: '男变女声',
    factory: () => [
      new Tone.PitchShift({ pitch: 5, windowSize: 0.045, wet: 0.9 }),
      new Tone.Filter({ type: 'highpass', frequency: 180 }),
      new Tone.EQ3({ low: -6, mid: 2, high: 5 }),
      startNode(new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.25, wet: 0.18 })),
      new Tone.Compressor({ threshold: -20, ratio: 3 }),
    ],
  },
  'female-to-male': {
    label: '女变男声',
    factory: () => [
      new Tone.PitchShift({ pitch: -5, windowSize: 0.075, wet: 0.9 }),
      new Tone.Filter({ type: 'lowpass', frequency: 4200 }),
      new Tone.EQ3({ low: 5, mid: 1, high: -4 }),
      new Tone.Distortion({ distortion: 0.08, wet: 0.12 }),
      new Tone.Compressor({ threshold: -18, ratio: 4 }),
    ],
  },
  loli: {
    label: '萝莉',
    factory: () => [
      new Tone.PitchShift({ pitch: 8, windowSize: 0.035, wet: 0.95 }),
      new Tone.Filter({ type: 'highpass', frequency: 260 }),
      new Tone.EQ3({ low: -8, mid: 2, high: 7 }),
      startNode(new Tone.Vibrato({ frequency: 5.5, depth: 0.08, wet: 0.22 })),
      new Tone.Compressor({ threshold: -24, ratio: 3 }),
    ],
  },
  shota: {
    label: '正太',
    factory: () => [
      new Tone.PitchShift({ pitch: 5, windowSize: 0.04, wet: 0.9 }),
      new Tone.Filter({ type: 'highpass', frequency: 210 }),
      new Tone.EQ3({ low: -5, mid: 3, high: 4 }),
      startNode(new Tone.Chorus({ frequency: 1.2, delayTime: 2.5, depth: 0.18, wet: 0.12 })),
    ],
  },
  'mature-lady': {
    label: '御姐',
    factory: () => [
      new Tone.PitchShift({ pitch: 2, windowSize: 0.055, wet: 0.75 }),
      new Tone.EQ3({ low: 0, mid: 3, high: 4 }),
      new Tone.Filter({ type: 'highpass', frequency: 120 }),
      new Tone.Compressor({ threshold: -22, ratio: 3 }),
      new Tone.Reverb({ decay: 1.2, wet: 0.08 }),
    ],
  },
  uncle: {
    label: '大叔',
    factory: () => [
      new Tone.PitchShift({ pitch: -6, windowSize: 0.085, wet: 0.9 }),
      new Tone.EQ3({ low: 6, mid: 2, high: -5 }),
      new Tone.Filter({ type: 'lowpass', frequency: 3000 }),
      new Tone.Distortion({ distortion: 0.14, wet: 0.18 }),
      new Tone.Compressor({ threshold: -19, ratio: 5 }),
    ],
  },
  'deep-male': {
    label: '磁性男声',
    factory: () => [
      new Tone.PitchShift({ pitch: -3, windowSize: 0.07, wet: 0.75 }),
      new Tone.EQ3({ low: 4, mid: 1, high: -1 }),
      new Tone.Compressor({ threshold: -21, ratio: 4 }),
      new Tone.Reverb({ decay: 1.6, wet: 0.06 }),
    ],
  },
  'radio-girl': {
    label: '少女电台',
    factory: () => [
      new Tone.PitchShift({ pitch: 4, windowSize: 0.045, wet: 0.85 }),
      new Tone.Filter({ type: 'bandpass', frequency: 1700, Q: 1.2 }),
      new Tone.EQ3({ low: -5, mid: 3, high: 5 }),
      new Tone.Compressor({ threshold: -25, ratio: 5 }),
      new Tone.Reverb({ decay: 0.9, wet: 0.05 }),
    ],
  },
  'dark-loli': {
    label: '黑化萝莉',
    factory: () => [
      new Tone.PitchShift({ pitch: 7, windowSize: 0.04, wet: 0.95 }),
      new Tone.FrequencyShifter({ frequency: -8, wet: 0.18 }),
      new Tone.Distortion({ distortion: 0.18, wet: 0.22 }),
      new Tone.Filter({ type: 'highpass', frequency: 240 }),
      new Tone.Reverb({ decay: 2.8, wet: 0.22 }),
    ],
  },
  'old-man': {
    label: '老爷爷',
    factory: () => [
      new Tone.PitchShift({ pitch: -7, windowSize: 0.09, wet: 0.88 }),
      startNode(new Tone.Vibrato({ frequency: 4.2, depth: 0.16, wet: 0.35 })),
      new Tone.Filter({ type: 'lowpass', frequency: 2400 }),
      new Tone.EQ3({ low: 5, mid: 1, high: -6 }),
      new Tone.Distortion({ distortion: 0.09, wet: 0.12 }),
    ],
  },

  // === 特效变声 ===
  chipmunk: {
    label: '花栗鼠',
    factory: () => [
      new Tone.PitchShift({ pitch: 12, windowSize: 0.03, wet: 0.95 }),
      new Tone.Filter({ type: 'highpass', frequency: 250 }),
      new Tone.Compressor({ threshold: -18, ratio: 3 }),
    ],
  },
  demon: {
    label: '恶魔低语',
    factory: () => [
      new Tone.PitchShift({ pitch: -10, windowSize: 0.08, wet: 0.9 }),
      new Tone.Distortion({ distortion: 0.28, wet: 0.45 }),
      new Tone.Filter({ type: 'lowpass', frequency: 1800 }),
      new Tone.Reverb({ decay: 2.8, wet: 0.25 }),
    ],
  },
  robot: {
    label: '机器人',
    factory: () => {
      const bc = new Tone.BitCrusher(4);
      (bc as any).wet.value = 0.35;
      const cb = new Tone.Chebyshev(32);
      (cb as any).wet.value = 0.25;
      return [
        new Tone.FrequencyShifter({ frequency: 35, wet: 0.65 }),
        bc,
        cb,
        new Tone.Filter({ type: 'bandpass', frequency: 1200, Q: 1.5 }),
      ];
    },
  },
  alien: {
    label: '外星人',
    factory: () => [
      new Tone.PitchShift({ pitch: 7, windowSize: 0.05, wet: 0.9 }),
      new Tone.FrequencyShifter({ frequency: 18, wet: 0.35 }),
      startNode(new Tone.Vibrato({ frequency: 6, depth: 0.18, wet: 0.5 })),
      new Tone.FeedbackDelay({ delayTime: 0.08, feedback: 0.18, wet: 0.25 }),
    ],
  },
  walkieTalkie: {
    label: '对讲机',
    factory: () => {
      const bc = new Tone.BitCrusher(7);
      (bc as any).wet.value = 0.2;
      return [
        new Tone.Filter({ type: 'bandpass', frequency: 1300, Q: 2.8 }),
        new Tone.Distortion({ distortion: 0.18, wet: 0.35 }),
        bc,
        new Tone.Compressor({ threshold: -24, ratio: 8 }),
      ];
    },
  },
  ghost: {
    label: '幽灵回声',
    factory: () => [
      new Tone.PitchShift({ pitch: -5, windowSize: 0.09, wet: 0.75 }),
      startNode(new Tone.Chorus({ frequency: 1.2, delayTime: 6, depth: 0.5, wet: 0.35 })),
      new Tone.FeedbackDelay({ delayTime: 0.22, feedback: 0.45, wet: 0.35 }),
      new Tone.Reverb({ decay: 4.5, wet: 0.4 }),
    ],
  },
  'glitch-ai': {
    label: '故障AI',
    factory: () => {
      const bc = new Tone.BitCrusher(3);
      (bc as any).wet.value = 0.45;
      return [
        new Tone.PitchShift({ pitch: 3, windowSize: 0.04, wet: 0.65 }),
        bc,
        new Tone.FrequencyShifter({ frequency: -22, wet: 0.3 }),
        startNode(new Tone.Tremolo({ frequency: 12, depth: 0.35, wet: 0.4 })),
      ];
    },
  },
  underwater: {
    label: '水下声',
    factory: () => [
      new Tone.Filter({ type: 'lowpass', frequency: 700, Q: 1.2 }),
      startNode(new Tone.Chorus({ frequency: 0.8, delayTime: 12, depth: 0.6, wet: 0.45 })),
      new Tone.FeedbackDelay({ delayTime: 0.12, feedback: 0.25, wet: 0.25 }),
      new Tone.Reverb({ decay: 2.2, wet: 0.3 }),
    ],
  },
};
