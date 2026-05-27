import * as Tone from 'tone';
import { getAudioContext } from './audioService';
import { useVoiceChangerStore } from '../stores/voiceChangerStore';
import { VOICE_PRESETS } from '../utils/voicePresets';

let inputGain: Tone.Gain | null = null;
let outputGain: Tone.Gain | null = null;
let chainNodes: Tone.ToneAudioNode[] = [];
let chainReady = false;
// Track external connections so we only break those, not the internal Tone chain
let externalSource: AudioNode | null = null;
let externalDest: AudioNode | null = null;

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
  disconnectVoiceChanger();
  disposeChain();
  chainReady = false;
  useVoiceChangerStore.getState().setChainReady(false);
  initVoiceChanger();
  useVoiceChangerStore.getState().applyPreset(presetId);
}

export function connectVoiceChanger(sourceNode: AudioNode, destNode: AudioNode): void {
  if (!chainReady || !inputGain || !outputGain) return;
  externalSource = sourceNode;
  externalDest = destNode;
  sourceNode.connect((inputGain as any).input);
  (outputGain as any).output.connect(destNode);
}

export function disconnectVoiceChanger(): void {
  // Only disconnect the external native → Tone bridges, NOT the internal Tone chain
  if (externalSource && inputGain) {
    try { externalSource.disconnect((inputGain as any).input); } catch {}
  }
  // Disconnect ALL outgoing connections from VC output (includes untracked connections
  // to rnnoiseNode/gateGainNode that were made directly in reconnectAudioGraph)
  if (outputGain) {
    try { (outputGain as any).output.disconnect(); } catch {}
  }
  externalSource = null;
  externalDest = null;
}

export function destroyVoiceChanger(): void {
  disconnectVoiceChanger();
  disposeChain();
  chainReady = false;
  useVoiceChangerStore.getState().setChainReady(false);
}
