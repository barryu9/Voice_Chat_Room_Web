import React from 'react';

interface AnnouncementProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  onDismiss?: () => void;
}

export const Announcement: React.FC<AnnouncementProps> = ({ message, type = 'info', onDismiss }) => {
  if (!message) return null;

  const colors = {
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    success: 'bg-green-500/10 border-green-500/30 text-green-300',
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
    error: 'bg-red-500/10 border-red-500/30 text-red-300',
  };

  return (
    <div className={`${colors[type]} border px-4 py-3 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2`}>
      <span className="text-sm">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="ml-3 opacity-60 hover:opacity-100 transition-opacity text-lg leading-none">&times;</button>
      )}
    </div>
  );
};
