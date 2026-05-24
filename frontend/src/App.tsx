import React, { useEffect, useRef } from 'react';
import { useUserStore } from './stores/userStore';
import { useSocket } from './hooks/useSocket';
import { useDeviceId } from './hooks/useDeviceId';
import { useLatency } from './hooks/useLatency';
import { getSocket } from './services/socketService';
import { EVENTS } from './utils/constants';
import { getCookie } from './utils/cookies';
import { Lobby } from './components/lobby/Lobby';
import { RoomPanel } from './components/room/RoomPanel';
import { AdminPanel } from './components/admin/AdminPanel';
import { ToastContainer } from './components/common/Toast';

const App: React.FC = () => {
  const currentRoom = useUserStore((s) => s.currentRoom);
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const deviceId = useDeviceId();
  const autoLoginTried = useRef(false);

  useSocket();
  useLatency();

  useEffect(() => {
    if (isLoggedIn || !deviceId || autoLoginTried.current) return;

    const saved = getCookie('vc_nickname');
    if (!saved) return;

    autoLoginTried.current = true;

    const doLogin = () => {
      getSocket()?.emit(EVENTS.CLIENT.USER_LOGIN, { nickname: saved, deviceId });
    };

    if (getSocket()?.connected) {
      doLogin();
    } else {
      getSocket()?.once('connect', doLogin);
    }
  }, [deviceId, isLoggedIn]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (getSocket()?.connected) {
        getSocket()?.emit(EVENTS.CLIENT.ROOM_LIST);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {currentRoom ? <RoomPanel /> : <Lobby />}
      <AdminPanel />
      <ToastContainer />
    </>
  );
};

export default App;
