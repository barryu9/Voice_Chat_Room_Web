import * as Tone from 'tone';
import { getAudioContext, initAudioContext } from './audioService';
import { VOICE_PRESETS } from '../utils/voicePresets';

let recordingStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let recordedBuffer: AudioBuffer | null = null;
let isRecording = false;
let isPlaying = false;

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
    const ctx = getAudioContext() || await initAudioContext();
    const blob = new Blob(recordedChunks, { type: 'audio/webm' });
    const arrayBuffer = await blob.arrayBuffer();
    recordedBuffer = await ctx.decodeAudioData(arrayBuffer);
  };

  mediaRecorder.start();
  isRecording = true;
}

export function stopRecording(): void {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach((t) => t.stop());
  }
  recordingStream = null;
  isRecording = false;
}

export function getRecordedBuffer(): AudioBuffer | null {
  return recordedBuffer;
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

export function destroyPreview(): void {
  stopRecording();
  stopPreview();
  recordedBuffer = null;
}
