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
    outputGain = new Tone.Gain(0.96);

    const highpass = new Tone.Filter({ type: 'highpass', frequency: 120, rolloff: -12 });
    const plosiveTamer = new Tone.MultibandCompressor({
      lowFrequency: 140,
      highFrequency: 5200,
      low: {
        threshold: -30,
        ratio: 6,
        attack: 0.003,
        release: 0.12,
        knee: 4,
      },
      mid: {
        threshold: -6,
        ratio: 1.2,
        attack: 0.01,
        release: 0.18,
        knee: 8,
      },
      high: {
        threshold: -6,
        ratio: 1.2,
        attack: 0.01,
        release: 0.16,
        knee: 8,
      },
    });
    const lowMudCut = new Tone.Filter({ type: 'peaking', frequency: 260, Q: 0.9, gain: -3 });
    const presenceBoost = new Tone.Filter({ type: 'peaking', frequency: 2800, Q: 0.8, gain: 3.5 });
    const harshnessCut = new Tone.Filter({ type: 'peaking', frequency: 6200, Q: 1.8, gain: -1 });
    const airLift = new Tone.Filter({ type: 'highshelf', frequency: 7200, gain: 1 });
    const airLimit = new Tone.Filter({ type: 'lowpass', frequency: 11000, rolloff: -12 });
    const smoother = new Tone.Compressor({
      threshold: -22,
      ratio: 2.4,
      attack: 0.006,
      release: 0.16,
      knee: 8,
    });

    chainNodes = [highpass, plosiveTamer, lowMudCut, presenceBoost, harshnessCut, airLift, airLimit, smoother];

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
