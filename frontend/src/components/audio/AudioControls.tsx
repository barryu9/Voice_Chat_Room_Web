import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { VoiceChangerControls } from './VoiceChangerControls';

interface AudioControlsProps {
  gain: number; muted: boolean; threshold: number; audioLevel: number;
  noiseSuppressionEnabled: boolean;
  onToggleMute: () => void;
  onGainChange: (v: number) => void;
  onThresholdChange: (v: number) => void;
  onNoiseSuppressionToggle: () => void;
  noiseTransiting: boolean;
  inputs: { deviceId: string; label: string }[];
  outputs: { deviceId: string; label: string }[];
  selectedInput: string; selectedOutput: string;
  onInputChange: (deviceId: string) => void;
  onOutputChange: (deviceId: string) => void;
  isAllMuted: boolean; masterVolume: number;
  amIServerMuted: boolean;
  onToggleMuteAll: () => void;
  onMasterVolumeChange: (v: number) => void;
  voiceChangerEnabled: boolean;
  onVoiceChangerToggle: (enabled: boolean) => void;
  onVoiceChangerPresetChange: (presetId: string) => void;
  vcTransiting: boolean;
}

function levelPercent(db: number): number {
  return Math.max(0, Math.min(100, ((db + 45) / 30) * 100));
}

const Popover: React.FC<{
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onEnter: () => void;
  onLeave: () => void;
  className?: string;
  children: React.ReactNode;
}> = ({ anchorRef, open, onEnter, onLeave, className, children }) => {
  if (!open || !anchorRef.current) return null;
  const rect = anchorRef.current.getBoundingClientRect();
  const isMobile = window.innerWidth < 640;
  return createPortal(
    <div
      className={`fixed glass-panel p-3 shadow-xl z-[9999] audio-popover animate-in fade-in duration-150 ${
        isMobile ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1'
      } ${className || ''}`}
      style={isMobile
        ? { bottom: window.innerHeight - rect.top + 4, left: rect.left }
        : { top: rect.bottom + 4, left: rect.left }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children}
    </div>,
    document.body,
  );
};

export const AudioControls: React.FC<AudioControlsProps> = ({
  gain, muted, threshold, audioLevel,
  noiseSuppressionEnabled,
  onToggleMute, onGainChange, onThresholdChange,
  onNoiseSuppressionToggle, noiseTransiting,
  inputs, outputs, selectedInput, selectedOutput,
  onInputChange, onOutputChange,
  isAllMuted, masterVolume, amIServerMuted,
  onToggleMuteAll, onMasterVolumeChange,
  voiceChangerEnabled, onVoiceChangerToggle, onVoiceChangerPresetChange, vcTransiting,
}) => {
  const [micOpen, setMicOpen] = useState(false);
  const [speakerOpen, setSpeakerOpen] = useState(false);
  const micTimer = useRef<number>(0);
  const speakerTimer = useRef<number>(0);
  const micBtnRef = useRef<HTMLButtonElement | null>(null);
  const speakerBtnRef = useRef<HTMLButtonElement | null>(null);
  const micArrowRef = useRef<HTMLButtonElement | null>(null);
  const speakerArrowRef = useRef<HTMLButtonElement | null>(null);
  const pct = levelPercent(audioLevel);

  // Click outside closes
  useEffect(() => {
    if (!micOpen && !speakerOpen) return;
    const handle = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (micBtnRef.current?.contains(t)) return;
      if (speakerBtnRef.current?.contains(t)) return;
      if (micArrowRef.current?.contains(t)) return;
      if (speakerArrowRef.current?.contains(t)) return;
      if (t.closest('.audio-popover')) return;
      setMicOpen(false);
      setSpeakerOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [micOpen, speakerOpen]);

  const enterMic = useCallback(() => {
    if (window.innerWidth < 640) return;
    clearTimeout(micTimer.current);
    setMicOpen(true);
  }, []);
  const leaveMic = useCallback(() => {
    if (window.innerWidth < 640) return;
    micTimer.current = window.setTimeout(() => setMicOpen(false), 250);
  }, []);

  const enterSpeaker = useCallback(() => {
    if (window.innerWidth < 640) return;
    clearTimeout(speakerTimer.current);
    setSpeakerOpen(true);
  }, []);
  const leaveSpeaker = useCallback(() => {
    if (window.innerWidth < 640) return;
    speakerTimer.current = window.setTimeout(() => setSpeakerOpen(false), 250);
  }, []);

  const toggleSpeaker = useCallback(() => setSpeakerOpen((p) => !p), []);
  const toggleMic = useCallback(() => setMicOpen((p) => !p), []);

  return (
    <div className="flex items-center gap-3">
      {/* ====== Speaker ====== */}
      <div className="flex items-center gap-0.5 sm:gap-0" onMouseEnter={enterSpeaker} onMouseLeave={leaveSpeaker}>
        <button
          ref={speakerBtnRef}
          onClick={onToggleMuteAll}
          className={`p-3 sm:p-2.5 rounded-xl transition-all active:scale-95 ${
            isAllMuted
              ? 'bg-yellow-600/30 text-yellow-400 border border-yellow-500/30'
              : 'bg-gray-800/60 text-gray-300 border border-gray-600/50 hover:border-primary-500/40'
          }`}
          title={isAllMuted ? '取消全部静音' : '全部静音'}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isAllMuted ? (
              <>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" />
              </>
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            )}
          </svg>
        </button>
        <button
          ref={speakerArrowRef}
          onClick={toggleSpeaker}
          className="sm:hidden flex items-center justify-center w-7 h-10 text-gray-400 hover:text-gray-200 active:scale-95 transition-all"
          title="扬声器设置"
        >
          <svg className={`w-3 h-3 transition-transform duration-200 ${speakerOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5l3 3 3-3" />
          </svg>
        </button>
      </div>

      <Popover anchorRef={speakerBtnRef} open={speakerOpen} onEnter={enterSpeaker} onLeave={leaveSpeaker} className="min-w-[200px]">
        <p className="text-xs text-gray-400 mb-2">扬声器</p>
        <select
          value={selectedOutput}
          onChange={(e) => onOutputChange(e.target.value)}
          className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-2 h-7 text-xs text-white focus:outline-none focus:border-primary-500/50 mb-2"
        >
          {outputs.length === 0 && <option value="">默认</option>}
          {outputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-10 shrink-0">音量</span>
          <input type="range" min="0" max="1" step="0.05" value={masterVolume}
            onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
            className="flex-1 h-1.5 accent-primary-500 cursor-pointer" />
          <span className="text-xs text-gray-400 w-8 text-right">{Math.round(masterVolume * 100)}%</span>
        </div>
      </Popover>

      {/* ====== Mic ====== */}
      <div className="flex items-center gap-0.5 sm:gap-0" onMouseEnter={enterMic} onMouseLeave={leaveMic}>
        <button
          ref={micBtnRef}
          onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
          className={`relative p-3 sm:p-2.5 rounded-xl transition-all active:scale-95 overflow-hidden ${
            muted || amIServerMuted
              ? 'bg-red-600/30 text-red-400 border border-red-500/30'
              : 'bg-gray-800/60 text-gray-300 border border-gray-600/50 hover:border-primary-500/40'
          }`}
          title={amIServerMuted ? '已被管理员禁言' : muted ? '取消静音' : '静音'}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-green-500/40 transition-all duration-100"
            style={{ height: muted || amIServerMuted ? '0%' : `${pct}%` }}
          />
          {(muted || amIServerMuted) ? (
            <svg className="w-5 h-5 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" />
            </svg>
          ) : (
            <svg className="w-5 h-5 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>
        <button
          ref={micArrowRef}
          onClick={toggleMic}
          className="sm:hidden flex items-center justify-center w-7 h-10 text-gray-400 hover:text-gray-200 active:scale-95 transition-all"
          title="麦克风设置"
        >
          <svg className={`w-3 h-3 transition-transform duration-200 ${micOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5l3 3 3-3" />
          </svg>
        </button>
      </div>

      <Popover anchorRef={micBtnRef} open={micOpen} onEnter={enterMic} onLeave={leaveMic} className="min-w-[240px]">
        <p className="text-xs text-gray-400 mb-2">麦克风</p>
        <select
          value={selectedInput}
          onChange={(e) => onInputChange(e.target.value)}
          className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-2 h-7 text-xs text-white focus:outline-none focus:border-primary-500/50 mb-2"
        >
          {inputs.length === 0 && <option value="">无麦克风</option>}
          {inputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs text-gray-400 w-10 shrink-0">增益</span>
              <input type="range" min="0" max="3" step="0.1" value={gain}
            onChange={(e) => onGainChange(parseFloat(e.target.value))}
            className="flex-1 h-1.5 accent-primary-500 cursor-pointer" />
          <span className="text-xs text-gray-400 w-8 text-right">{gain.toFixed(1)}x</span>
        </div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs text-gray-400 w-10 shrink-0">阈值</span>
              <input type="range" min="-60" max="-30" step="1" value={threshold}
            onChange={(e) => onThresholdChange(parseInt(e.target.value))}
            className="flex-1 h-1.5 accent-primary-500 cursor-pointer" />
          <span className="text-xs text-gray-400 w-8 text-right">{threshold}dB</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">降噪</span>
          <button
            onClick={noiseTransiting ? undefined : onNoiseSuppressionToggle}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              noiseSuppressionEnabled ? 'bg-primary-500' : 'bg-gray-600'
            } ${noiseTransiting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              noiseSuppressionEnabled ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
          </button>
        </div>
        {voiceChangerEnabled && (
          <VoiceChangerControls
            onToggle={onVoiceChangerToggle}
            onPresetChange={onVoiceChangerPresetChange}
            transiting={vcTransiting}
          />
        )}
      </Popover>
    </div>
  );
};
