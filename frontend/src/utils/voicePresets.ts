export interface VoiceParams {
  pitch: number;
  distortion: number;
  filterFreq: number;
  filterQ: number;
  reverbWet: number;
}

export const VOICE_PRESETS: Record<string, { label: string; params: VoiceParams }> = {
  'male-to-female': {
    label: '男变女声',
    params: { pitch: 7, distortion: 0, filterFreq: 3000, filterQ: 1.0, reverbWet: 0.10 },
  },
  'female-to-male': {
    label: '女变男声',
    params: { pitch: -7, distortion: 0, filterFreq: 500, filterQ: 1.0, reverbWet: 0.10 },
  },
  child: {
    label: '萝莉',
    params: { pitch: 12, distortion: 0, filterFreq: 4000, filterQ: 0.5, reverbWet: 0 },
  },
  uncle: {
    label: '大叔',
    params: { pitch: -5, distortion: 0.15, filterFreq: 400, filterQ: 1.0, reverbWet: 0.15 },
  },
  robot: {
    label: '机器人',
    params: { pitch: 0, distortion: 0.8, filterFreq: 1000, filterQ: 10.0, reverbWet: 0 },
  },
  monster: {
    label: '怪兽',
    params: { pitch: -4, distortion: 0.6, filterFreq: 200, filterQ: 2.0, reverbWet: 0.20 },
  },
  alien: {
    label: '外星人',
    params: { pitch: 3, distortion: 0.3, filterFreq: 2500, filterQ: 5.0, reverbWet: 0.30 },
  },
};

export function paramsMatch(a: VoiceParams, b: VoiceParams): boolean {
  return (
    a.pitch === b.pitch &&
    a.distortion === b.distortion &&
    a.filterFreq === b.filterFreq &&
    a.filterQ === b.filterQ &&
    a.reverbWet === b.reverbWet
  );
}

export function resolvePresetId(params: VoiceParams): string {
  for (const [id, preset] of Object.entries(VOICE_PRESETS)) {
    if (paramsMatch(params, preset.params)) return id;
  }
  return 'custom';
}
