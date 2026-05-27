import React, { useState, useRef, useEffect } from 'react';
import { getSocket } from '../../services/socketService';
import { AUDIO_QUALITY_TIERS } from '../../utils/constants';
import { StepperInput } from '../common/StepperInput';

interface Props {
  onClose: () => void;
  maxNameLen: number;
  maxUsers: number;
  allowedBitrates: number[];
}

export const CreateUserChannelModal: React.FC<Props> = ({ onClose, maxNameLen, maxUsers, allowedBitrates }) => {
  const [name, setName] = useState('');
  const [max, setMax] = useState(Math.min(10, maxUsers));
  const [bitrate, setBitrate] = useState(allowedBitrates[0] || 48);
  const [pwd, setPwd] = useState('');
  const [voiceChangerEnabled, setVoiceChangerEnabled] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (data: any) => {
      setError(data.message || '创建失败');
      setLoading(false);
    };
    getSocket()?.on('user:channel-error', handler);
    return () => { getSocket()?.off('user:channel-error', handler); };
  }, []);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > maxNameLen) {
      setError(`频道名需为 1-${maxNameLen} 个字符`);
      return;
    }
    setLoading(true);
    setError('');
    const password = pwd.trim();
    getSocket()?.once('user:channel-created', () => {
      setLoading(false);
      onClose();
    });
    getSocket()?.emit('user:channel-create', {
      name: trimmed,
      maxUsers: Math.min(max, maxUsers),
      audioBitrate: bitrate,
      password,
      voiceChangerEnabled,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel p-5 w-full max-w-sm mx-4 animate-in zoom-in-95 fade-in duration-200">
        <h3 className="text-lg font-semibold text-white mb-4">创建频道</h3>
        <div className="space-y-3">
          <label>
            <span className="text-xs text-gray-400">频道名 (≤{maxNameLen}字)</span>
            <input ref={inputRef} value={name} onChange={(e) => { setName(e.target.value); setError(''); }} maxLength={maxNameLen} placeholder="输入频道名" className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 mt-1 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50 h-8" />
          </label>
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="text-xs text-gray-400">人数上限</span>
              <div className="mt-1">
                <StepperInput value={max} onChange={setMax} min={2} max={maxUsers} />
              </div>
            </label>
            <label className="flex-1">
              <span className="text-xs text-gray-400">音质</span>
              <select value={bitrate} onChange={(e) => setBitrate(parseInt(e.target.value))} className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-2 h-7 mt-1 text-xs text-white focus:outline-none focus:border-primary-500/50">
                {AUDIO_QUALITY_TIERS.filter(t => allowedBitrates.includes(t.value)).map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span className="text-xs text-gray-400">密码（可选）</span>
            <input type="text" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="4-16位（可选）" maxLength={16} className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 mt-1 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50 h-8" />
          </label>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">允许变声器</span>
            <button
              onClick={() => setVoiceChangerEnabled(!voiceChangerEnabled)}
              className={`relative w-9 h-5 rounded-full transition-colors ${voiceChangerEnabled ? 'bg-primary-500' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${voiceChangerEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2.5 rounded-xl">取消</button>
            <button onClick={handleSubmit} disabled={loading || !name.trim()} className="flex-1 bg-primary-600 hover:bg-primary-500 disabled:bg-gray-700 disabled:text-gray-400 text-white text-sm py-2.5 rounded-xl">{loading ? '创建中...' : '创建'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};
