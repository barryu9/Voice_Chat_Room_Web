import * as Tone from 'tone';
import { getAudioContext } from './audioService';
import { useVoiceChangerStore } from '../stores/voiceChangerStore';
import { VOICE_PRESETS } from '../utils/voicePresets';

let inputGain: Tone.Gain | null = null;
let outputGain: Tone.Gain | null = null;
let chainNodes: Tone.ToneAudioNode[] = [];
let chainReady = false;

export function isVoiceChangerReady(): boolean {
  return chainReady;
}

export function getVoiceChangerOutput(): AudioNode | null {
  return (outputGain as any)?.output as AudioNode | null;
}

function disposeChain() {
  for (const node of chainNodes) {
    try { node.dispose(); } catch {}
  }
  chainNodes = [];
  try { inputGain?.dispose(); } catch {}
  try { outputGain?.dispose(); } catch {}
  inputGain = null;
  outputGain = null;
}

export function initVoiceChanger(): void {
  if (chainReady) return;

  const ac = getAudioContext();
  if (!ac) return;

  const presetId = useVoiceChangerStore.getState().presetId;
  const preset = VOICE_PRESETS[presetId];
  if (!preset) return;

  try {
    disposeChain();

    const nodes = preset.factory();
    inputGain = new Tone.Gain(1);
    outputGain = new Tone.Gain(1);

    let prev: Tone.ToneAudioNode = inputGain;
    for (const node of nodes) {
      prev.connect(node);
      chainNodes.push(node);
      prev = node;
    }
    prev.connect(outputGain);

    chainReady = true;
    useVoiceChangerStore.getState().setChainReady(true);
  } catch (e) {
    console.warn('[VoiceChanger] Init failed:', e);
    chainReady = false;
    useVoiceChangerStore.getState().setChainReady(false);
  }
}

export function switchPreset(presetId: string): void {
  if (!chainReady) return;
  disposeChain();
  chainReady = false;
  useVoiceChangerStore.getState().setChainReady(false);
  initVoiceChanger();
  useVoiceChangerStore.getState().applyPreset(presetId);
}

export function connectVoiceChanger(sourceNode: AudioNode, destNode: AudioNode): void {
  if (!chainReady || !inputGain || !outputGain) return;
  sourceNode.connect((inputGain as any).input);
  (outputGain as any).output.connect(destNode);
}

export function disconnectVoiceChanger(): void {
  try { (inputGain as any)?.input?.disconnect(); } catch {}
  try { (outputGain as any)?.output?.disconnect(); } catch {}
}

export function destroyVoiceChanger(): void {
  disconnectVoiceChanger();
  disposeChain();
  chainReady = false;
  useVoiceChangerStore.getState().setChainReady(false);
}
