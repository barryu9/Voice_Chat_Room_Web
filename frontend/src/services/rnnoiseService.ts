import { RNNoiseNode, rnnoise_loadAssets } from 'simple-rnnoise-wasm';
import workletUrl from 'simple-rnnoise-wasm/rnnoise.worklet.js?url';
import wasmUrl from 'simple-rnnoise-wasm/rnnoise.wasm?url';

let rnnoiseNode: RNNoiseNode | null = null;
let bypassGain: GainNode | null = null;
let wetGain: GainNode | null = null;
let noiseStrength: number = 0.5;
let noiseEnabled: boolean = true;
let initialized: boolean = false;

export function isNoiseSuppressorEnabled(): boolean {
  return noiseEnabled;
}

export function getNoiseSuppressorStrength(): number {
  return noiseStrength;
}

export async function createNoiseSuppressor(ctx: AudioContext): Promise<{
  inputNode: AudioNode;
  connectOutput: (target: AudioNode) => void;
} | null> {
  if (initialized) return buildGraph(ctx);

  try {
    const assets = rnnoise_loadAssets({
      scriptSrc: workletUrl,
      moduleSrc: wasmUrl,
    });
    await RNNoiseNode.register(ctx, assets);

    rnnoiseNode = new RNNoiseNode(ctx);
    initialized = true;
    return buildGraph(ctx);
  } catch (e) {
    console.warn('[RNNoise] Failed to initialize:', e);
    return null;
  }
}

function buildGraph(ctx: AudioContext): {
  inputNode: AudioNode;
  connectOutput: (target: AudioNode) => void;
} | null {
  if (!rnnoiseNode) return null;

  bypassGain = ctx.createGain();
  bypassGain.gain.value = noiseEnabled ? 1 - noiseStrength : 1;

  wetGain = ctx.createGain();
  wetGain.gain.value = noiseEnabled ? noiseStrength : 0;

  // micGain -> [bypassGain, rnnoiseNode -> wetGain] -> merge into destination
  // We use a dummy gain node as the split point and inputNode
  const splitGain = ctx.createGain();
  splitGain.gain.value = 1;

  splitGain.connect(bypassGain);
  splitGain.connect(rnnoiseNode);
  rnnoiseNode.connect(wetGain);

  if (!noiseEnabled) {
    rnnoiseNode.update(false);
  }

  return {
    inputNode: splitGain,
    connectOutput: (target: AudioNode) => {
      bypassGain!.connect(target);
      wetGain!.connect(target);
    },
  };
}

export function setNoiseSuppressorEnabled(enabled: boolean) {
  noiseEnabled = enabled;
  if (bypassGain && wetGain) {
    bypassGain.gain.value = enabled ? 1 - noiseStrength : 1;
    wetGain.gain.value = enabled ? noiseStrength : 0;
  }
  if (rnnoiseNode) {
    rnnoiseNode.update(enabled);
  }
  localStorage.setItem('vc_denoise_enabled', String(enabled));
}

export function setNoiseSuppressorStrength(value: number) {
  noiseStrength = Math.max(0, Math.min(1, value));
  if (bypassGain && wetGain) {
    bypassGain.gain.value = noiseEnabled ? 1 - noiseStrength : 1;
    wetGain.gain.value = noiseEnabled ? noiseStrength : 0;
  }
  localStorage.setItem('vc_denoise_strength', String(noiseStrength));
}

export function destroyNoiseSuppressor() {
  try {
    bypassGain?.disconnect();
    wetGain?.disconnect();
    rnnoiseNode?.disconnect();
    rnnoiseNode?.update(false);
  } catch {}
  bypassGain = null;
  wetGain = null;
  rnnoiseNode = null;
  initialized = false;
}
