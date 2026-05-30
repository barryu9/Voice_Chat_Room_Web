import * as Tone from 'tone';
import { getAudioContext } from './audioService';

let inputGain: Tone.Gain | null = null;
let outputGain: Tone.Gain | null = null;
let chainNodes: Tone.ToneAudioNode[] = [];
let chainReady = false;
let externalSource: AudioNode | null = null;
let externalDest: AudioNode | null = null;

const OUTPUT_TRIM_GAIN = Math.pow(10, -1 / 20);

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
    outputGain = new Tone.Gain(OUTPUT_TRIM_GAIN);

    const highpass = new Tone.Filter({ type: 'highpass', frequency: 95, rolloff: -12 });
    const lowMidCut = new Tone.Filter({ type: 'peaking', frequency: 220, Q: 1.1, gain: -2.5 });
    const presenceLift = new Tone.Filter({ type: 'peaking', frequency: 2800, Q: 0.75, gain: 1.5 });
    const feedbackGuardLow = new Tone.Filter({ type: 'peaking', frequency: 3800, Q: 3.2, gain: -2.2 });
    const feedbackGuardHigh = new Tone.Filter({ type: 'peaking', frequency: 5800, Q: 3.8, gain: -2.6 });
    const sibilanceSoftener = new Tone.Filter({ type: 'peaking', frequency: 7600, Q: 2.2, gain: -2.4 });
    const airShelf = new Tone.Filter({ type: 'highshelf', frequency: 11000, Q: 0.7, gain: 0.8 });
    const softCompressor = new Tone.Compressor({
      threshold: -16,
      knee: 12,
      ratio: 1.7,
      attack: 0.006,
      release: 0.16,
    });

    chainNodes = [
      highpass,
      lowMidCut,
      presenceLift,
      feedbackGuardLow,
      feedbackGuardHigh,
      sibilanceSoftener,
      airShelf,
      softCompressor,
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
