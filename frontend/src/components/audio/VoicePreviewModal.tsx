import React, { useState, useRef, useEffect } from 'react';
import { VOICE_PRESETS } from '../../utils/voicePresets';
import { startRecording, stopRecording, getRecordedBuffer, playPreview, stopPreview, getIsRecording, getIsPlaying, destroyPreview } from '../../services/previewService';
import { useModalDialog } from '../../hooks/useModalDialog';

interface Props {
  onClose: () => void;
}

const presetEntries = Object.entries(VOICE_PRESETS);

export const VoicePreviewModal: React.FC<Props> = ({ onClose }) => {
  const dialogRef = useModalDialog(onClose);
  const [presetId, setPresetId] = useState(presetEntries[0]?.[0] || '');
  const [countdown, setCountdown] = useState(0);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      destroyPreview();
    };
  }, []);

  const handleRecord = async () => {
    setError('');
    try {
      await startRecording();
      setRecording(true);
      let sec = 5;
      setCountdown(sec);
      timerRef.current = setInterval(() => {
        sec--;
        setCountdown(sec);
        if (sec <= 0) {
          clearInterval(timerRef.current);
          stopRecording();
          setRecording(false);
          setHasRecorded(true);
          setCountdown(0);
        }
      }, 1000);
    } catch (e: any) {
      setError('无法访问麦克风，请检查权限');
    }
  };

  const handlePlay = () => {
    if (!presetId) return;
    setError('');
    try {
      playPreview(presetId);
      setPlaying(true);
      const buf = getRecordedBuffer();
      if (buf) {
        const duration = buf.duration * 1000;
        setTimeout(() => setPlaying(false), duration + 200);
      }
    } catch {
      setError('播放失败');
      setPlaying(false);
    }
  };

  const handleStop = () => {
    stopPreview();
    setPlaying(false);
  };

  const handleReRecord = () => {
    setHasRecorded(false);
    destroyPreview();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="voice-preview-title" tabIndex={-1} className="glass-panel p-5 w-full max-w-xs mx-4 animate-in zoom-in-95 fade-in duration-200 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors text-sm leading-none"
        >
          ✕
        </button>
        <h3 id="voice-preview-title" className="text-lg font-semibold text-white mb-4">变声预览</h3>

        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs text-gray-400">选择预设</span>
            <select
              value={presetId}
              onChange={(e) => { setPresetId(e.target.value); setHasRecorded(false); }}
              className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-2 h-8 text-xs text-white focus:outline-none focus:border-primary-500/50"
            >
              {presetEntries.map(([id, p]) => (
                <option key={id} value={id}>{p.label}</option>
              ))}
            </select>
          </label>

          <div className="flex items-center justify-center gap-2 pt-1">
            {!hasRecorded ? (
              <button
                onClick={handleRecord}
                disabled={recording}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-xl"
              >
                {recording ? `录音中... ${countdown}s` : '开始录音 (5秒)'}
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleReRecord}
                  className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-2 rounded-xl"
                >
                  重新录音
                </button>
                {playing ? (
                  <button
                    onClick={handleStop}
                    className="bg-yellow-500 hover:bg-yellow-400 text-white text-sm px-3 py-2 rounded-xl"
                  >
                    停止
                  </button>
                ) : (
                  <button
                    onClick={handlePlay}
                    className="bg-primary-600 hover:bg-primary-500 text-white text-sm px-3 py-2 rounded-xl"
                  >
                    播放预览
                  </button>
                )}
              </div>
            )}
          </div>

          {playing && (
            <p className="text-xs text-green-400 text-center -mt-1">正在播放变声效果...</p>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
      </div>
    </div>
  );
};
