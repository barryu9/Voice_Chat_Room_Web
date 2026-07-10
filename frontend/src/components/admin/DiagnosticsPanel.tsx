import React, { useCallback, useEffect, useState } from 'react';
import { getSocket } from '../../services/socketService';
import { EVENTS } from '../../utils/constants';

interface DiagnosticsData {
  generatedAt: string;
  uptimeSeconds: number;
  memory: { rss: number; heapUsed: number; heapTotal: number };
  socketCount: number;
  workerPid: number | null;
  databaseState: number;
  totals: { rooms: number; roomUsers: number; voiceUsers: number; transports: number; producers: number; consumers: number };
  rooms: Array<{ roomId: string; name: string; users: number; voiceUsers: number; transports: number; producers: number; consumers: number }>;
}

function formatBytes(value: number) {
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}小时${minutes}分`;
}

export const DiagnosticsPanel: React.FC = () => {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    const socket = getSocket();
    if (!socket) { setError('连接已断开'); return; }
    socket.emit(EVENTS.CLIENT.ADMIN_DIAGNOSTICS_GET);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const onData = (next: DiagnosticsData) => { setData(next); setError(''); };
    const onError = (event: { event?: string; message?: string }) => {
      if (event.event === EVENTS.CLIENT.ADMIN_DIAGNOSTICS_GET) setError(event.message || '无法获取诊断信息');
    };
    socket?.on(EVENTS.SERVER.ADMIN_DIAGNOSTICS, onData);
    socket?.on(EVENTS.SERVER.ERROR, onError);
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => {
      socket?.off(EVENTS.SERVER.ADMIN_DIAGNOSTICS, onData);
      socket?.off(EVENTS.SERVER.ERROR, onError);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">每 5 秒自动刷新{data ? ` · ${new Date(data.generatedAt).toLocaleTimeString('zh-CN')}` : ''}</p>
        <button onClick={refresh} className="text-sm text-primary-400 hover:text-primary-300">刷新</button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {!data ? <p className="text-sm text-gray-500 text-center py-8">正在读取诊断信息...</p> : <>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            ['在线连接', data.socketCount], ['房间用户', data.totals.roomUsers], ['语音用户', data.totals.voiceUsers],
            ['传输通道', data.totals.transports], ['生产者', data.totals.producers], ['消费者', data.totals.consumers],
          ].map(([label, value]) => <div key={String(label)} className="glass-card p-3"><p className="text-xs text-gray-500">{label}</p><p className="text-lg text-white font-semibold mt-1">{value}</p></div>)}
        </div>
        <div className="glass-card p-4 grid grid-cols-2 gap-3 text-sm">
          <p className="text-gray-400">运行时长 <span className="text-white ml-1">{formatDuration(data.uptimeSeconds)}</span></p>
          <p className="text-gray-400">Mediasoup Worker <span className="text-white ml-1">{data.workerPid ?? '未就绪'}</span></p>
          <p className="text-gray-400">进程内存 <span className="text-white ml-1">{formatBytes(data.memory.rss)}</span></p>
          <p className="text-gray-400">JS 堆 <span className="text-white ml-1">{formatBytes(data.memory.heapUsed)} / {formatBytes(data.memory.heapTotal)}</span></p>
        </div>
        <div className="glass-card p-4 space-y-2">
          <h4 className="text-sm font-medium text-white">房间详情</h4>
          {data.rooms.map((room) => <div key={room.roomId} className="flex items-center justify-between text-xs border-t border-gray-700/40 pt-2"><span className="text-gray-300 truncate mr-2">{room.name} <span className="text-gray-500">#{room.roomId}</span></span><span className="text-gray-400 shrink-0">{room.voiceUsers}/{room.users} 语音 · {room.producers}P · {room.consumers}C</span></div>)}
        </div>
      </>}
    </div>
  );
};
