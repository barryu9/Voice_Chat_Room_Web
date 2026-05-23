import React from 'react';
import type { Channel } from '../../utils/constants';

interface ChannelCardProps {
  channel: Channel;
  onJoin: (roomId: string) => void;
  disabled?: boolean;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({ channel, onJoin, disabled }) => {
  return (
    <div className="glass-card p-5 hover:border-primary-500/40 transition-all duration-300 group cursor-pointer">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white group-hover:text-primary-400 transition-colors">
          {channel.name}
        </h3>
        <span className="text-xs px-2 py-1 rounded-full bg-primary-500/20 text-primary-300 border border-primary-500/30">
          {channel.roomId}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-gray-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>人数上限 {channel.maxUsers}</span>
        </div>

        <button
          onClick={() => onJoin(channel.roomId)}
          disabled={disabled}
          className="bg-primary-600 hover:bg-primary-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all active:scale-95"
        >
          加入
        </button>
      </div>
    </div>
  );
};
