import React, { useEffect, useRef } from 'react';
import { useUserStore } from './stores/userStore';
import { useRoomStore } from './stores/roomStore';
import { useSocket } from './hooks/useSocket';
import { useDeviceId } from './hooks/useDeviceId';
import { useLatency } from './hooks/useLatency';
import { getSocket } from './services/socketService';
import { EVENTS } from './utils/constants';
import { getCookie } from './utils/cookies';
import { useMediaStore } from './stores/mediaStore';
import { preloadAllSounds, playSound, unlockAudio } from './services/soundService';
import { Lobby } from './components/lobby/Lobby';
import { RoomPanel } from './components/room/RoomPanel';
import { AdminPanel } from './components/admin/AdminPanel';
import { ToastContainer } from './components/common/Toast';
import { useTheme } from './hooks/useTheme';

const App: React.FC = () => {
  const currentRoom = useUserStore((s) => s.currentRoom);
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const channels = useRoomStore((s) => s.channels);
  const siteName = useRoomStore((s) => s.siteName);
  const appLoading = useUserStore((s) => s.appLoading);
  const setAppLoading = useUserStore((s) => s.setAppLoading);
  const connectionState = useUserStore((s) => s.connectionState);
  const logout = useUserStore((s) => s.logout);
  const deviceId = useDeviceId();
  const autoLoginTried = useRef(false);
  const failHandled = useRef(false);
  const wasConnected = useRef(false);

  useSocket();
  useLatency();
  useTheme();

  useEffect(() => {
    preloadAllSounds();

    const unlock = () => {
      unlockAudio();
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      document.title = `登录 - ${siteName}`;
    } else if (!currentRoom) {
      document.title = `频道列表 - ${siteName}`;
    } else {
      const ch = channels.find((c) => c.roomId === currentRoom);
      document.title = `${ch?.name || currentRoom} - ${siteName}`;
    }
  }, [isLoggedIn, currentRoom, siteName, channels]);

  useEffect(() => {
    if (connectionState === 'failed' && isLoggedIn && !failHandled.current) {
      failHandled.current = true;
      autoLoginTried.current = false;
      if (currentRoom) {
        getSocket()?.emit(EVENTS.CLIENT.ROOM_LEAVE);
      }
      useMediaStore.getState().reset();
      playSound('connectionLost');
      logout();
    }
    if (connectionState === 'connected') {
      if (failHandled.current) {
        playSound('connected');
      }
      failHandled.current = false;
      wasConnected.current = true;
    }
  }, [connectionState, isLoggedIn, currentRoom]);

  useEffect(() => {
    if (isLoggedIn || !deviceId) return;

    const saved = getCookie('vc_nickname');
    if (!saved) {
      setAppLoading(false);
      autoLoginTried.current = true;
      return;
    }

    if (autoLoginTried.current) return;
    if (!getSocket()?.connected) return;

    autoLoginTried.current = true;

    const doLogin = () => {
      getSocket()?.emit(EVENTS.CLIENT.USER_LOGIN, { nickname: saved, deviceId });
    };

    if (getSocket()?.connected) {
      doLogin();
    } else {
      getSocket()?.once('connect', doLogin);
    }
  }, [deviceId, isLoggedIn, connectionState]);

  useEffect(() => {
    if (isLoggedIn) {
      setAppLoading(false);
    } else if (autoLoginTried.current && connectionState === 'connected') {
      setAppLoading(false);
    }
  }, [isLoggedIn, connectionState]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (getSocket()?.connected) {
        getSocket()?.emit(EVENTS.CLIENT.ROOM_LIST);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (useUserStore.getState().appLoading) {
        useUserStore.getState().setAppLoading(false);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  if (appLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-violet-400 bg-clip-text text-transparent mb-4">
            {siteName}
          </h1>
          <div className="flex items-center justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {currentRoom ? <RoomPanel /> : <Lobby />}
      <AdminPanel />
      <ToastContainer />
    </>
  );
};

export default App;
