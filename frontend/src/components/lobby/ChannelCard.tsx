import React from 'react';
import type { Channel } from '../../utils/constants';
import { AUDIO_QUALITY_TIERS } from '../../utils/constants';

function getQualityName(bitrate?: number): string {
  const tier = AUDIO_QUALITY_TIERS.find((t) => t.value === (bitrate ?? 48));
  return tier?.label ?? '标准';
}

function fmtStatus(channel: Channel): string | null {
  const isUserChannel = channel.type === 'user';
  if (channel.voiceCount != null && channel.voiceCount > 0) {
    return `${channel.voiceCount} 人正在语音中`;
  }
  if (isUserChannel) {
    return null;
  }
  if (!channel.lastActivityAt && (channel.onlineCount ?? 0) === 0) return null;
  const elapsed = (Date.now() - new Date(channel.lastActivityAt || Date.now()).getTime()) / 1000;
  if (elapsed < 60) return '刚刚活跃';
  const mins = Math.min(Math.ceil(elapsed / 60), 60);
  return `${mins} 分钟前活跃`;
}

interface ChannelCardProps {
  channel: Channel;
  onJoin: (roomId: string) => void;
  onJoinWithPwd: (roomId: string) => void;
  onEdit?: (roomId: string) => void;
  onDelete?: (roomId: string) => void;
  isAdmin?: boolean;
  disabled?: boolean;
  currentUserId?: string | null;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  channel, onJoin, onJoinWithPwd, onEdit, onDelete, isAdmin, disabled, currentUserId,
}) => {
  const qualityName = getQualityName(channel.audioBitrate);
  const hasPassword = !!channel.password;
  const isUserChannel = channel.type === 'user';
  const status = fmtStatus(channel);
  const isCreator = isUserChannel && currentUserId === channel.creatorUserId;
  const canManage = isAdmin;

  const displayOnline = channel.onlineCount != null ? channel.onlineCount : 0;
  const displayMax = channel.maxUsers || 10;

  const handleClick = () => {
    if (disabled) return;
    if (hasPassword && !isCreator) onJoinWithPwd(channel.roomId);
    else onJoin(channel.roomId);
  };

  return (
    <div
      className={`glass-card p-5 transition-all duration-300 group cursor-pointer relative ${isCreator ? '!border-green-500/50 hover:!border-green-400/60' : 'hover:border-primary-500/40'}`}
      onClick={handleClick}
    >

      <div className="mb-3 pr-12">
        <h3 className="text-lg font-semibold text-white group-hover:text-primary-400 transition-colors flex items-center gap-1.5 flex-wrap">
          {hasPassword && (
            <svg className="w-4 h-4 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          )}
          {isUserChannel ? (
            <span className={`text-[10px] px-1 py-px rounded border shrink-0 ${hasPassword ? 'text-yellow-400 border-yellow-500/30' : 'text-primary-300 border-primary-500/30'} leading-none`}>
              临时
            </span>
          ) : null}
          <span className="truncate">{channel.name}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500 border border-white/5 font-normal leading-none">
            {qualityName}
          </span>
          {isUserChannel && canManage && (
            <span className="inline-flex gap-1.5 ml-2" onClick={(e) => e.stopPropagation()}>
              {onEdit && (
                <button onClick={() => onEdit!(channel.roomId)} className="text-gray-500 hover:text-gray-300 transition-colors" title="编辑">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button onClick={() => onDelete!(channel.roomId)} className="text-gray-500 hover:text-red-400 transition-colors" title="删除">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </span>
          )}
        </h3>
        {!isUserChannel && (
          <p className="text-xs text-gray-500 mt-0.5">#{channel.roomId}</p>
        )}
        {isUserChannel && (
          <p className="text-xs text-gray-500 mt-0.5">
            创建者：{channel.creatorNickname || channel.creatorUserId?.slice(0, 8)}
          </p>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); handleClick(); }}
        disabled={disabled}
        className="absolute bottom-3 right-3 w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-500 hover:to-violet-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white transition-all active:scale-95"
        title="加入"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>{displayOnline}/{displayMax}</span>
          </div>
          {status && (
            <span className={`${channel.voiceCount && channel.voiceCount > 0 ? 'text-green-400' : isUserChannel ? 'text-orange-400' : 'text-gray-500'}`}>
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
