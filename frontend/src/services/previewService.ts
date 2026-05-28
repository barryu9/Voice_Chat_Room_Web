import * as Tone from 'tone';
import { getAudioContext, initAudioContext } from './audioService';
import { VOICE_PRESETS } from '../utils/voicePresets';

let recordingStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let recordedBuffer: AudioBuffer | null = null;
let isRecording = false;
let isPlaying = false;
let onStopReady: (() => void) | null = null;

let previewInput: Tone.Gain | null = null;
let previewOutput: Tone.Gain | null = null;
let previewNodes: Tone.ToneAudioNode[] = [];
let previewSource: AudioBufferSourceNode | null = null;

export function getIsRecording(): boolean {
  return isRecording;
}

export function getIsPlaying(): boolean {
  return isPlaying;
}

export async function startRecording(): Promise<void> {
  recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  recordedChunks = [];

  try {
    mediaRecorder = new MediaRecorder(recordingStream, { mimeType: 'audio/webm' });
  } catch {
    mediaRecorder = new MediaRecorder(recordingStream);
  }

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    if (recordedChunks.length === 0) { onStopReady?.(); return; }
    try {
      const ctx = getAudioContext() || await initAudioContext();
      const blob = new Blob(recordedChunks, { type: 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      recordedBuffer = await ctx.decodeAudioData(arrayBuffer);
    } catch {}
    onStopReady?.();
  };

  mediaRecorder.start();
  isRecording = true;
}

export function stopRecording(onReady?: () => void): void {
  onStopReady = onReady || null;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach((t) => t.stop());
  } else {
    onStopReady?.();
  }
  recordingStream = null;
  isRecording = false;
}

export function getRecordedBuffer(): AudioBuffer | null {
  return recordedBuffer;
}

function buildVcChain(presetId: string): { input: Tone.Gain; output: Tone.Gain } | null {
  const preset = VOICE_PRESETS[presetId];
  if (!preset) return null;

  const input = new Tone.Gain(1);
  const output = new Tone.Gain(1);
  const nodes = preset.factory();

  let prev: Tone.ToneAudioNode = input;
  for (const node of nodes) {
    prev.connect(node);
    prev = node;
  }
  prev.connect(output);

  return { input, output };
}

let testSource: AudioBufferSourceNode | null = null;
let testIsPlaying = false;

export function getTestIsPlaying(): boolean {
  return testIsPlaying;
}

export function playTest(buffer: AudioBuffer, gain: number, vcEnabled: boolean, vcPresetId: string): void {
  const ctx = getAudioContext();
  if (!ctx || !buffer || testIsPlaying) return;

  stopTestPreview();

  testSource = ctx.createBufferSource();
  testSource.buffer = buffer;

  let lastNode: AudioNode = testSource;

  // Apply mic gain
  const gainNode = ctx.createGain();
  gainNode.gain.value = Math.max(0.1, gain);
  lastNode.connect(gainNode);
  lastNode = gainNode;

  // Apply voice changer if enabled
  let vcOut: Tone.Gain | null = null;
  if (vcEnabled) {
    const chain = buildVcChain(vcPresetId);
    if (chain) {
      lastNode.connect((chain.input as any).input);
      (chain.output as any).output.connect(ctx.destination);
      vcOut = chain.output;
    }
  }

  if (!vcOut) {
    lastNode.connect(ctx.destination);
  }

  testIsPlaying = true;
  testSource.start(0);

  const onEnd = () => {
    testSource?.disconnect();
    testSource = null;
    gainNode.disconnect();
    testIsPlaying = false;
  };
  testSource.onended = onEnd;
}

export function stopTestPreview(): void {
  if (testSource) {
    try { testSource.stop(); } catch {}
    try { testSource.disconnect(); } catch {}
    testSource = null;
  }
  testIsPlaying = false;
}

export function destroyPreview(): void {
  stopRecording();
  stopPreview();
  stopTestPreview();
  recordedBuffer = null;
}

export function playPreview(presetId: string): void {
  const ctx = getAudioContext();
  if (!ctx || !recordedBuffer || isPlaying) return;

  cleanupPreview();

  const preset = VOICE_PRESETS[presetId];
  if (!preset) return;

  const nodes = preset.factory();

  previewInput = new Tone.Gain(1);
  previewOutput = new Tone.Gain(1);
  previewNodes = nodes;

  let prev: Tone.ToneAudioNode = previewInput;
  for (const node of nodes) {
    prev.connect(node);
    prev = node;
  }
  prev.connect(previewOutput);

  previewSource = ctx.createBufferSource();
  previewSource.buffer = recordedBuffer;
  previewSource.connect((previewInput as any).input);
  (previewOutput as any).output.connect(ctx.destination);

  isPlaying = true;
  previewSource.start(0);

  previewSource.onended = () => {
    cleanupPreview();
    isPlaying = false;
  };
}

export function stopPreview(): void {
  if (previewSource) {
    try { previewSource.stop(); } catch {}
  }
  cleanupPreview();
  isPlaying = false;
}

function cleanupPreview(): void {
  if (previewSource) {
    try { previewSource.disconnect(); } catch {}
    previewSource = null;
  }
  if (previewOutput) {
    try { (previewOutput as any).output.disconnect(); } catch {}
  }
  for (const node of previewNodes) {
    try { node.dispose(); } catch {}
  }
  previewNodes = [];
  try { previewInput?.dispose(); } catch {}
  try { previewOutput?.dispose(); } catch {}
  previewInput = null;
  previewOutput = null;
}
