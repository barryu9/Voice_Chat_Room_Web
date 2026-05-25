import { create } from 'zustand';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'failed';

interface UserState {
  userId: string | null;
  nickname: string;
  deviceId: string | null;
  currentRoom: string | null;
  isLoggedIn: boolean;
  appLoading: boolean;
  connectionState: ConnectionState;
  reconnectAttempt: number;
  setLogin: (userId: string, nickname: string, deviceId: string) => void;
  setCurrentRoom: (roomId: string | null) => void;
  setNickname: (n: string) => void;
  setDeviceId: (id: string) => void;
  setAppLoading: (v: boolean) => void;
  setConnectionState: (state: ConnectionState, attempt?: number) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  userId: null,
  nickname: '',
  deviceId: null,
  currentRoom: null,
  isLoggedIn: false,
  appLoading: true,
  connectionState: 'connecting',
  reconnectAttempt: 0,
  setLogin: (userId, nickname, deviceId) =>
    set({ userId, nickname, deviceId, isLoggedIn: true, connectionState: 'connected' }),
  setCurrentRoom: (roomId) => set({ currentRoom: roomId }),
  setNickname: (n) => set({ nickname: n }),
  setDeviceId: (id) => set({ deviceId: id }),
  setAppLoading: (v) => set({ appLoading: v }),
  setConnectionState: (state, attempt) =>
    set({ connectionState: state, ...(attempt !== undefined ? { reconnectAttempt: attempt } : {}) }),
  logout: () => set({ userId: null, nickname: '', currentRoom: null, isLoggedIn: false }),
}));
