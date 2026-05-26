import React, { useState, useRef, useEffect } from 'react';

interface Props {
  channelName: string;
  onSubmit: (password: string) => void;
  onClose: () => void;
  error?: string;
}

export const ChannelPasswordModal: React.FC<Props> = ({ channelName, onSubmit, onClose, error }) => {
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (error) setLocalError(error);
  }, [error]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleEnter = () => {
    const p = password.trim();
    if (p.length < 4 || p.length > 16) {
      setLocalError('密码需为 4-16 位');
      return;
    }
    onSubmit(p);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleEnter();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel p-6 w-full max-w-sm mx-4 animate-in zoom-in-95 fade-in duration-200">
        <h3 className="text-lg font-semibold text-white mb-1">加密频道</h3>
        <p className="text-sm text-gray-400 mb-4">{channelName} 需要密码才能进入</p>

        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入频道密码 (4-16位)"
          maxLength={16}
          autoComplete="off"
          className="w-full bg-gray-800/60 border border-gray-600/50 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 mb-2"
        />
        {localError && <p className="text-red-400 text-xs mb-3">{localError}</p>}

        <div className="flex gap-2 mt-2">
          <button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2.5 rounded-xl transition-all">取消</button>
          <button onClick={handleEnter} disabled={password.length < 4} className="flex-1 bg-primary-600 hover:bg-primary-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm py-2.5 rounded-xl transition-all">进入</button>
        </div>
      </div>
    </div>
  );
};
