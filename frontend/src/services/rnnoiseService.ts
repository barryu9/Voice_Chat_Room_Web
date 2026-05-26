import { RNNoiseNode, rnnoise_loadAssets } from 'simple-rnnoise-wasm';
import workletUrl from 'simple-rnnoise-wasm/rnnoise.worklet.js?url';
import wasmUrl from 'simple-rnnoise-wasm/rnnoise.wasm?url';

let rnnoiseNode: RNNoiseNode | null = null;
let noiseGain: GainNode | null = null;
let noiseEnabled: boolean = localStorage.getItem('vc_denoise_enabled') !== 'false';
let initialized: boolean = false;
const COMPENSATION_GAIN = 1.0;

export function isNoiseSuppressorEnabled(): boolean {
  return noiseEnabled;
}

export async function createNoiseSuppressor(ctx: AudioContext): Promise<{
  inputNode: AudioNode;
  connectOutput: (target: AudioNode) => void;
  disconnectOutput: () => void;
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
  disconnectOutput: () => void;
} | null {
  if (!rnnoiseNode) return null;

  noiseGain = ctx.createGain();
  noiseGain.gain.value = noiseEnabled ? COMPENSATION_GAIN : 0;

  rnnoiseNode.connect(noiseGain);

  return {
    inputNode: rnnoiseNode,
    connectOutput: (target: AudioNode) => {
      noiseGain!.connect(target);
    },
    disconnectOutput: () => {
      noiseGain!.disconnect();
    },
  };
}

export function setNoiseSuppressorEnabled(enabled: boolean) {
  noiseEnabled = enabled;
  if (noiseGain) {
    noiseGain.gain.value = enabled ? COMPENSATION_GAIN : 0;
  }
  localStorage.setItem('vc_denoise_enabled', String(enabled));
}

export function destroyNoiseSuppressor() {
  try {
    noiseGain?.disconnect();
    rnnoiseNode?.disconnect();
    rnnoiseNode?.update(false);
  } catch {}
  noiseGain = null;
  rnnoiseNode = null;
  initialized = false;
}
