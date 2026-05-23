import React, { useEffect } from 'react';
import { useUserStore } from './stores/userStore';
import { useSocket } from './hooks/useSocket';
import { getSocket } from './services/socketService';
import { EVENTS } from './utils/constants';
import { Lobby } from './components/lobby/Lobby';
import { RoomPanel } from './components/room/RoomPanel';
import { AdminPanel } from './components/admin/AdminPanel';
import { ToastContainer } from './components/common/Toast';

const App: React.FC = () => {
  const currentRoom = useUserStore((s) => s.currentRoom);

  useSocket();

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
