import { create } from 'zustand';

interface KickedUser {
  deviceId: string;
  nickname?: string;
  expiresAt: number;
}

interface AdminConfig {
  multiLogin: boolean;
  banDuration: number;
  muteDuration: number;
  kickDuration: number;
}

interface AdminState {
  isAdmin: boolean;
  showPanel: boolean;
  bans: { deviceId: string; nickname: string; reason: string; createdAt: string; remaining?: number }[];
  kickedList: KickedUser[];
  config: AdminConfig;
  setAdmin: (v: boolean) => void;
  setShowPanel: (v: boolean) => void;
  setBans: (b: any[]) => void;
  setKickedList: (list: KickedUser[]) => void;
  setConfig: (c: AdminConfig) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  isAdmin: false,
  showPanel: false,
  bans: [],
  kickedList: [],
  config: { multiLogin: false, banDuration: 1440, muteDuration: 60, kickDuration: 60 },
  setAdmin: (v) => set({ isAdmin: v }),
  setShowPanel: (v) => set({ showPanel: v }),
  setBans: (b) => set({ bans: b }),
  setKickedList: (list) => set({ kickedList: list }),
  setConfig: (c) => set({ config: c }),
}));
