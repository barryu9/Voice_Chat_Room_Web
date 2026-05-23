import { create } from 'zustand';

interface AdminState {
  isAdmin: boolean;
  showPanel: boolean;
  bans: { deviceId: string; nickname: string; reason: string; createdAt: string }[];
  setAdmin: (v: boolean) => void;
  setShowPanel: (v: boolean) => void;
  setBans: (b: any[]) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  isAdmin: false,
  showPanel: false,
  bans: [],
  setAdmin: (v) => set({ isAdmin: v }),
  setShowPanel: (v) => set({ showPanel: v }),
  setBans: (b) => set({ bans: b }),
}));
