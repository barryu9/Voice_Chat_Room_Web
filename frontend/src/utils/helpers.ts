export function getAvatarColor(userId: string): string {
  return getColorByUserId(userId, [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#f97316', '#eab308',
    '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  ]);
}

export function getLightAvatarColor(userId: string): string {
  return getColorByUserId(userId, [
    '#a5b4fc', '#c4b5fd', '#d8b4fe', '#f0abfc',
    '#f9a8d4', '#fda4af', '#fdba74', '#fde047',
    '#86efac', '#5eead4', '#67e8f9', '#93c5fd',
  ]);
}

function getColorByUserId(userId: string, colors: string[]): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function getInitial(nickname: string): string {
  return (nickname || '?').charAt(0).toUpperCase();
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function clearChannelUrlParam() {
  const u = new URL(window.location.href);
  u.searchParams.delete('channel');
  window.history.replaceState(null, '', u);
}
