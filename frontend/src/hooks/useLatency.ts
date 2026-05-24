import { useEffect, useRef } from 'react';
import { getSocket } from '../services/socketService';
import { useUserStore } from '../stores/userStore';
import { useRoomStore } from '../stores/roomStore';

export function useLatency() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const measure = () => {
      const socket = getSocket();
      if (!socket?.connected) return;

      const start = Date.now();
      socket.timeout(3000).emit('latency:ping', () => {
        const rtt = Date.now() - start;
        useRoomStore.getState().setPeerLatency(
          useUserStore.getState().deviceId || '',
          rtt
        );
        socket.emit('latency:report', {
          deviceId: useUserStore.getState().deviceId,
          latency: rtt,
        });
      });
    };

    measure();
    intervalRef.current = setInterval(measure, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return null;
}
