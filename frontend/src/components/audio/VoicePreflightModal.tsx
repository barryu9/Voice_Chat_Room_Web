import React, { useEffect } from 'react';
import { useVoicePreflight } from '../../hooks/useVoicePreflight';
import { useModalDialog } from '../../hooks/useModalDialog';

interface VoicePreflightModalProps {
  selectedInput: string;
  onClose: () => void;
  onContinue: () => void;
}

export const VoicePreflightModal: React.FC<VoicePreflightModalProps> = ({ selectedInput, onClose, onContinue }) => {
  const { checks, running, canContinue, runChecks } = useVoicePreflight(selectedInput);
  const dialogRef = useModalDialog(onClose);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="voice-preflight-title" tabIndex={-1} className="glass-panel p-5 w-full max-w-sm mx-4 animate-in zoom-in-95 fade-in duration-200">
        <h3 id="voice-preflight-title" className="text-lg font-semibold text-white">加入语音前检查</h3>
        <p className="text-xs text-gray-400 mt-1 mb-4">确认设备与语音服务可用，避免加入后无声或连接失败。</p>
        <div className="space-y-2">
          {checks.map((check) => {
            const icon = check.status === 'passed' ? '✓' : check.status === 'failed' ? '×' : '·';
            const color = check.status === 'passed' ? 'text-green-400' : check.status === 'failed' ? 'text-red-400' : 'text-yellow-400';
            return (
              <div key={check.id} className="glass-card px-3 py-2.5 flex items-start gap-2">
                <span className={`${color} font-bold leading-5 w-4 text-center`}>{icon}</span>
                <div className="min-w-0">
                  <p className="text-sm text-white">{check.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{check.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 pt-4">
          <button onClick={onClose} disabled={running} className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm py-2.5 rounded-xl">取消</button>
          <button onClick={runChecks} disabled={running} className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm py-2.5 rounded-xl">{running ? '检查中...' : '重新检查'}</button>
          <button onClick={onContinue} disabled={!canContinue || running} className="flex-1 semantic-green-button disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-sm py-2.5 rounded-xl">加入语音</button>
        </div>
      </div>
    </div>
  );
};
