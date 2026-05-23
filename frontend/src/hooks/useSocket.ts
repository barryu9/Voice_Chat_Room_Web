import { useEffect, useRef } from 'react';
import { connectSocket, disconnectSocket } from '../services/socketService';

export function useSocket() {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      connectSocket();
    }
    return () => {
      disconnectSocket();
      initialized.current = false;
    };
  }, []);
}
