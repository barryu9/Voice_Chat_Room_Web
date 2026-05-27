import * as Tone from 'tone';
import { getAudioContext } from './audioService';
import { useVoiceChangerStore } from '../stores/voiceChangerStore';
import type { VoiceParams } from '../utils/voicePresets';

let inputGain: Tone.Gain | null = null;
let pitchShift: Tone.PitchShift | null = null;
let distortion: Tone.Distortion | null = null;
let filterNode: Tone.Filter | null = null;
let reverb: Tone.Reverb | null = null;
let outputGain: Tone.Gain | null = null;
let chainReady = false;

export function isVoiceChangerReady(): boolean {
  return chainReady;
}

export function getVoiceChangerOutput(): AudioNode | null {
  return (outputGain as any)?.output as AudioNode | null;
}

export async function initVoiceChanger(): Promise<void> {
  if (chainReady) return;

  const ac = getAudioContext();
  if (!ac) return;

  try {
    const params = useVoiceChangerStore.getState().getParams();

    inputGain = new Tone.Gain(1);
    pitchShift = new Tone.PitchShift(params.pitch);
    distortion = new Tone.Distortion(params.distortion);
    filterNode = new Tone.Filter(params.filterFreq, 'lowpass');
    filterNode.Q.value = params.filterQ;
    reverb = new Tone.Reverb(params.reverbWet);
    outputGain = new Tone.Gain(1);

    inputGain.chain(pitchShift, distortion, filterNode, reverb, outputGain);

    chainReady = true;
    useVoiceChangerStore.getState().setChainReady(true);
  } catch (e) {
    console.warn('[VoiceChanger] Init failed:', e);
    chainReady = false;
    useVoiceChangerStore.getState().setChainReady(false);
  }
}

export function connectVoiceChanger(sourceNode: AudioNode, destNode: AudioNode): void {
  if (!chainReady || !inputGain || !outputGain) return;
  sourceNode.connect((inputGain as any).input);
  (outputGain as any).output.connect(destNode);
}

export function disconnectVoiceChanger(): void {
  if (!inputGain || !outputGain) return;
  try { (inputGain as any).input.disconnect(); } catch {}
  try { (outputGain as any).output.disconnect(); } catch {}
}

export function updateVoiceChangerParams(params: VoiceParams): void {
  if (!chainReady) return;
  if (pitchShift) pitchShift.pitch = params.pitch;
  if (distortion) distortion.distortion = params.distortion;
  if (filterNode) {
    filterNode.frequency.value = params.filterFreq;
    filterNode.Q.value = params.filterQ;
  }
  if (reverb) reverb.wet.value = params.reverbWet;
}

export function destroyVoiceChanger(): void {
  disconnectVoiceChanger();
  try {
    inputGain?.dispose();
    pitchShift?.dispose();
    distortion?.dispose();
    filterNode?.dispose();
    reverb?.dispose();
    outputGain?.dispose();
  } catch {}
  inputGain = null;
  pitchShift = null;
  distortion = null;
  filterNode = null;
  reverb = null;
  outputGain = null;
  chainReady = false;
  useVoiceChangerStore.getState().setChainReady(false);
}
