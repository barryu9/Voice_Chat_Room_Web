import { create } from 'zustand';
import type { Channel, UserInfo, Announcement } from '../utils/constants';

interface RoomState {
  channels: Channel[];
  roomUsers: Map<string, UserInfo>;
  userCount: number;
  activeSpeakers: Map<string, { level: number; isSpeaking: boolean }>;
  peerLatencies: Map<string, number>;
  announcements: Announcement[];
  notification: string;
  siteName: string;
  setChannels: (ch: Channel[]) => void;
  addChannel: (ch: Channel) => void;
  removeChannel: (roomId: string) => void;
  updateChannel: (roomId: string, updates: Partial<Channel>) => void;
  setRoomUsers: (users: UserInfo[]) => void;
  addUser: (user: UserInfo) => void;
  removeUser: (userId: string) => void;
  updateUserNickname: (userId: string, nickname: string) => void;
  setActiveSpeaker: (deviceId: string, level: number, isSpeaking: boolean) => void;
  setPeerLatency: (deviceId: string, latency: number) => void;
  setAnnouncements: (list: Announcement[]) => void;
  setNotification: (msg: string) => void;
  setSiteName: (name: string) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  channels: [],
  roomUsers: new Map(),
  userCount: 0,
  activeSpeakers: new Map(),
  peerLatencies: new Map(),
  announcements: [],
  notification: '',
  siteName: '语音聊天室',

  setChannels: (ch) => set({ channels: ch }),
  addChannel: (ch) => set((s) => ({ channels: [...s.channels, ch] })),
  removeChannel: (roomId) =>
    set((s) => ({ channels: s.channels.filter((c) => c.roomId !== roomId) })),
  updateChannel: (roomId, updates) =>
    set((s) => ({
      channels: s.channels.map((c) =>
        c.roomId === roomId ? { ...c, ...updates } : c
      ),
    })),

  setRoomUsers: (users) =>
    set({ roomUsers: new Map(users.map((u) => [u.userId, u])), userCount: users.length }),
  addUser: (user) =>
    set((s) => {
      const m = new Map(s.roomUsers);
      m.set(user.userId, user);
      return { roomUsers: m, userCount: m.size };
    }),
  removeUser: (userId) =>
    set((s) => {
      const m = new Map(s.roomUsers);
      m.delete(userId);
      return { roomUsers: m, userCount: m.size };
    }),
  updateUserNickname: (userId, nickname) =>
    set((s) => {
      const m = new Map(s.roomUsers);
      const u = m.get(userId);
      if (u) {
        m.set(userId, { ...u, nickname });
        return { roomUsers: m };
      }
      return {};
    }),

  setActiveSpeaker: (deviceId, level, isSpeaking) =>
    set((s) => {
      const m = new Map(s.activeSpeakers);
      m.set(deviceId, { level, isSpeaking });
      return { activeSpeakers: m };
    }),

  setPeerLatency: (deviceId, latency) =>
    set((s) => {
      const m = new Map(s.peerLatencies);
      m.set(deviceId, latency);
      return { peerLatencies: m };
    }),

  setAnnouncements: (list) => set({ announcements: list }),
  setNotification: (msg) => set({ notification: msg }),
  setSiteName: (name) => set({ siteName: name }),
}));
