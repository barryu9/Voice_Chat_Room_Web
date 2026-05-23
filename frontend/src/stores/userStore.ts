import { create } from 'zustand';
import type { Channel } from '../utils/constants';

interface UserState {
  userId: string | null;
  nickname: string;
  deviceId: string | null;
  currentRoom: string | null;
  isLoggedIn: boolean;
  setLogin: (userId: string, nickname: string, deviceId: string) => void;
  setCurrentRoom: (roomId: string | null) => void;
  setNickname: (n: string) => void;
  setDeviceId: (id: string) => void;
}

export const useUserStore = create<UserState>((set) => ({
  userId: null,
  nickname: '',
  deviceId: null,
  currentRoom: null,
  isLoggedIn: false,
  setLogin: (userId, nickname, deviceId) =>
    set({ userId, nickname, deviceId, isLoggedIn: true }),
  setCurrentRoom: (roomId) => set({ currentRoom: roomId }),
  setNickname: (n) => set({ nickname: n }),
  setDeviceId: (id) => set({ deviceId: id }),
}));
