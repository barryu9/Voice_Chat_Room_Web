import React, { useState, useRef, useEffect } from 'react';
import { getSocket } from '../../services/socketService';
import { AUDIO_QUALITY_TIERS } from '../../utils/constants';
import { StepperInput } from '../common/StepperInput';
import { showToast } from '../common/Toast';

interface Props {
  channel: { roomId: string; name: string; maxUsers: number; audioBitrate?: number; password?: string; hasPassword?: boolean; voiceChangerEnabled?: boolean };
  maxNameLen: number;
  maxUsers: number;
  allowedBitrates: number[];
  onClose: () => void;
  voiceChangerGlobalEnabled: boolean;
}

export const EditUserChannelModal: React.FC<Props> = ({ channel, maxNameLen, maxUsers, allowedBitrates, onClose, voiceChangerGlobalEnabled }) => {
  const [name, setName] = useState(channel.name);
  const [max, setMax] = useState(channel.maxUsers);
  const [bitrate, setBitrate] = useState(channel.audioBitrate || allowedBitrates[0] || 48);
  const hasPwd = !!channel.hasPassword;
  const [pwd, setPwd] = useState(hasPwd ? '••••••' : '');
  const [vcEnabled, setVcEnabled] = useState(channel.voiceChangerEnabled !== false && voiceChangerGlobalEnabled);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pwdTouched = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > maxNameLen) {
      setError(`频道名需为 1-${maxNameLen} 个字符`);
      return;
    }
    setSaving(true);
    setError('');
    const socket = getSocket();
    if (!socket) {
      setSaving(false);
      setError('连接已断开');
      return;
    }
    const cleanup = () => {
      socket.off('user:channel-error', handleError);
      socket.off('user:channel-updated', handleSuccess);
    };
    const handleError = (data: any) => {
      cleanup();
      setError(data.message || '操作失败');
      setSaving(false);
    };
    const handleSuccess = () => {
      cleanup();
      setSaving(false);
      showToast('频道已更新', 'success');
      onClose();
    };
    const updates: any = { roomId: channel.roomId, name: trimmed, maxUsers: Math.min(max, maxUsers), audioBitrate: bitrate, voiceChangerEnabled: vcEnabled };
    if (pwdTouched.current) {
      updates.password = pwd;
    }
    socket.once('user:channel-error', handleError);
    socket.once('user:channel-updated', handleSuccess);
    socket.emit('user:channel-update', updates);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel p-5 w-full max-w-sm mx-4 animate-in zoom-in-95 fade-in duration-200">
        <h3 className="text-lg font-semibold text-white mb-5">编辑频道</h3>
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs text-gray-400">频道名 (≤{maxNameLen}字)</span>
            <input ref={inputRef} value={name} onChange={(e) => { setName(e.target.value); setError(''); }} maxLength={maxNameLen} className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50 h-8" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs text-gray-400">人数上限</span>
              <StepperInput value={max} onChange={setMax} min={2} max={maxUsers} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-gray-400">音质</span>
              <select value={bitrate} onChange={(e) => setBitrate(parseInt(e.target.value))} className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-2 h-8 text-sm text-white focus:outline-none focus:border-primary-500/50">
                {AUDIO_QUALITY_TIERS.filter(t => allowedBitrates.includes(t.value)).map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs text-gray-400">密码（留空清除密码）</span>
            <input type="text" value={pwd}
              onFocus={() => { if (hasPwd && !pwdTouched.current) { setPwd(''); } }}
              onBlur={() => { if (hasPwd && pwd === '' && !pwdTouched.current) { setPwd('••••••'); } }}
              onKeyDown={() => { pwdTouched.current = true; }}
              onChange={(e) => { setPwd(e.target.value); }}
              placeholder={hasPwd ? '' : '4-16位（可选）'}
              maxLength={16}
              className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50 h-8" />
          </label>
          <div className="flex items-center justify-between">
            <span className={`text-xs ${voiceChangerGlobalEnabled ? 'text-gray-400' : 'text-gray-600'}`}>允许变声器</span>
            <button
              onClick={voiceChangerGlobalEnabled ? () => setVcEnabled(!vcEnabled) : undefined}
              className={`relative w-9 h-5 rounded-full transition-colors ${vcEnabled ? 'bg-primary-500' : 'bg-gray-600'} ${!voiceChangerGlobalEnabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${vcEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} disabled={saving} className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white text-sm py-2.5 rounded-xl">取消</button>
            <button onClick={handleSave} disabled={!name.trim() || saving} className="flex-1 bg-primary-600 hover:bg-primary-500 disabled:bg-gray-700 disabled:text-gray-400 text-white text-sm py-2.5 rounded-xl">{saving ? '保存中...' : '保存'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};
