import * as Tone from 'tone';
import { getAudioContext } from './audioService';

let inputGain: Tone.Gain | null = null;
let outputGain: Tone.Gain | null = null;
let chainNodes: Tone.ToneAudioNode[] = [];
let chainReady = false;
let externalSource: AudioNode | null = null;
let externalDest: AudioNode | null = null;

export function isVocalEnhancerReady(): boolean {
  return chainReady;
}

export function getVocalEnhancerInput(): AudioNode | null {
  return (inputGain as any)?.input as AudioNode | null;
}

export function initVocalEnhancer(): void {
  if (chainReady) return;

  const ac = getAudioContext();
  if (!ac) return;

  try {
    destroyVocalEnhancer();

    inputGain = new Tone.Gain(1);
    outputGain = new Tone.Gain(1);

    const highpass = new Tone.Filter({ type: 'highpass', frequency: 95, rolloff: -12 });
    const lowMidCut = new Tone.Filter({ type: 'peaking', frequency: 240, Q: 0.85, gain: -2.2 });
    const boxinessCut = new Tone.Filter({ type: 'peaking', frequency: 520, Q: 1.0, gain: -0.8 });
    const clarityLift = new Tone.Filter({ type: 'peaking', frequency: 2100, Q: 0.75, gain: 0.9 });
    const presenceLift = new Tone.Filter({ type: 'peaking', frequency: 3000, Q: 0.8, gain: 0.8 });
    const feedbackGuardLow = new Tone.Filter({ type: 'peaking', frequency: 3900, Q: 4.0, gain: -2.4 });
    const feedbackGuardHigh = new Tone.Filter({ type: 'peaking', frequency: 5800, Q: 4.2, gain: -2.8 });
    const sibilanceSoftener = new Tone.Filter({ type: 'peaking', frequency: 7600, Q: 2.0, gain: -2.6 });
    const airShelf = new Tone.Filter({ type: 'highshelf', frequency: 11500, Q: 0.7, gain: 0.7 });

    chainNodes = [
      highpass,
      lowMidCut,
      boxinessCut,
      clarityLift,
      presenceLift,
      feedbackGuardLow,
      feedbackGuardHigh,
      sibilanceSoftener,
      airShelf,
    ];

    let prev: Tone.ToneAudioNode = inputGain;
    for (const node of chainNodes) {
      prev.connect(node);
      prev = node;
    }
    prev.connect(outputGain);

    chainReady = true;
  } catch (e) {
    console.warn('[VocalEnhancer] Init failed:', e);
    destroyVocalEnhancer();
  }
}

export function connectVocalEnhancer(sourceNode: AudioNode, destNode: AudioNode): boolean {
  if (!chainReady || !inputGain || !outputGain) return false;

  externalSource = sourceNode;
  externalDest = destNode;
  sourceNode.connect((inputGain as any).input);
  (outputGain as any).output.connect(destNode);
  return true;
}

export function connectVocalEnhancerOutput(destNode: AudioNode): boolean {
  if (!chainReady || !outputGain) return false;

  externalDest = destNode;
  (outputGain as any).output.connect(destNode);
  return true;
}

export function disconnectVocalEnhancer(): void {
  if (externalSource && inputGain) {
    try { externalSource.disconnect((inputGain as any).input); } catch {}
  }
  if (outputGain) {
    try { (outputGain as any).output.disconnect(); } catch {}
  }
  externalSource = null;
  externalDest = null;
}

export function destroyVocalEnhancer(): void {
  disconnectVocalEnhancer();
  for (const node of chainNodes) {
    try { node.dispose(); } catch {}
  }
  chainNodes = [];
  try { inputGain?.dispose(); } catch {}
  try { outputGain?.dispose(); } catch {}
  inputGain = null;
  outputGain = null;
  chainReady = false;
}
