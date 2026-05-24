import React, { useState } from 'react';
import type { Announcement as AnnouncementType } from '../../utils/constants';

interface AnnouncementListProps {
  announcements: AnnouncementType[];
}

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem('vc_dismissed_announcements');
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function persistDismissed(ids: Set<string>) {
  localStorage.setItem('vc_dismissed_announcements', JSON.stringify([...ids]));
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const Announcement: React.FC<AnnouncementListProps> = ({ announcements }) => {
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissed);

  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const handleDismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    persistDismissed(next);
  };

  return (
    <div className="space-y-2">
      {visible.map((a) => (
        <div
          key={a.id}
          className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 px-4 py-3 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2"
        >
          <span className="text-sm">
            <span className="text-cyan-400/70 mr-2">{formatTime(a.createdAt)}</span>
            {a.message}
          </span>
          <button
            onClick={() => handleDismiss(a.id)}
            className="ml-3 opacity-60 hover:opacity-100 transition-opacity text-lg leading-none shrink-0"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
};
