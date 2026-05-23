import React, { useState } from 'react';
import { getSocket } from '../../services/socketService';
import { useRoomStore } from '../../stores/roomStore';
import { useAdminStore } from '../../stores/adminStore';
import { EVENTS } from '../../utils/constants';
import { BanList } from './BanList';

export const AdminPanel: React.FC = () => {
  const showPanel = useAdminStore((s) => s.showPanel);
  const setShowPanel = useAdminStore((s) => s.setShowPanel);
  const channels = useRoomStore((s) => s.channels);
  const siteName = useRoomStore((s) => s.siteName);

  const [tab, setTab] = useState<'channels' | 'announcement' | 'bans'>('channels');
  const [newName, setNewName] = useState('');
  const [newMax, setNewMax] = useState(20);
  const [editRoomId, setEditRoomId] = useState('');
  const [editName, setEditName] = useState('');
  const [editMax, setEditMax] = useState(20);
  const [announcementText, setAnnouncementText] = useState('');
  const [siteNameText, setSiteNameText] = useState(siteName);

  if (!showPanel) return null;

  const handleCreate = () => {
    if (!newName.trim()) return;
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_CHANNEL_CREATE, { name: newName.trim(), maxUsers: newMax });
    setNewName('');
  };

  const handleUpdate = () => {
    if (!editRoomId || !editName.trim()) return;
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_CHANNEL_UPDATE, { roomId: editRoomId, name: editName.trim(), maxUsers: editMax });
  };

  const handleDelete = (roomId: string) => {
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_CHANNEL_DELETE, { roomId });
  };

  const handleAnnouncement = () => {
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_SETTINGS_UPDATE, { key: 'announcement', value: announcementText });
    setAnnouncementText('');
  };

  const handleSiteName = () => {
    if (!siteNameText.trim()) return;
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_SETTINGS_UPDATE, { key: 'siteName', value: siteNameText.trim() });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center pt-16 bg-black/40 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto animate-in slide-in-from-top-4 fade-in">
        <div className="sticky top-0 bg-gray-900/90 backdrop-blur-xl p-5 border-b border-gray-700/50 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">管理面板</h2>
          <button
            onClick={() => setShowPanel(false)}
            className="text-gray-400 hover:text-white text-xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700/50 px-5">
          {(['channels', 'announcement', 'bans'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm transition-all ${
                tab === t
                  ? 'text-primary-400 border-b-2 border-primary-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'channels' ? '频道管理' : t === 'announcement' ? '公告设置' : '封禁列表'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Channels Tab */}
          {tab === 'channels' && (
            <div className="space-y-4">
              {/* Create */}
              <div className="glass-card p-4 space-y-3">
                <h4 className="text-sm font-medium text-gray-300">新建频道</h4>
                <div className="flex gap-2">
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="频道名称" className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" />
                  <input type="number" value={newMax} onChange={(e) => setNewMax(parseInt(e.target.value) || 20)} min={2} max={100} className="w-20 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500/50" />
                  <button onClick={handleCreate} className="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg transition-all">创建</button>
                </div>
              </div>

              {/* List */}
              {channels.map((ch) => (
                <div key={ch.roomId} className="glass-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{ch.name}</span>
                    <span className="text-xs text-gray-500">{ch.roomId}</span>
                  </div>
                  {editRoomId === ch.roomId ? (
                    <div className="flex gap-2">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500/50" />
                      <input type="number" value={editMax} onChange={(e) => setEditMax(parseInt(e.target.value) || 20)} min={2} max={100} className="w-20 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none" />
                      <button onClick={handleUpdate} className="bg-primary-600 hover:bg-primary-500 text-white text-xs px-3 py-1.5 rounded-lg">保存</button>
                      <button onClick={() => setEditRoomId('')} className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-3 py-1.5 rounded-lg">取消</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">上限: {ch.maxUsers}</span>
                      <div className="flex-1" />
                      <button onClick={() => { setEditRoomId(ch.roomId); setEditName(ch.name); setEditMax(ch.maxUsers); }} className="text-sm text-primary-400 hover:text-primary-300">编辑</button>
                      {!ch.isDefault && (
                        <button onClick={() => handleDelete(ch.roomId)} className="text-sm text-red-400 hover:text-red-300">删除</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Announcement Tab */}
          {tab === 'announcement' && (
            <div className="space-y-4">
              <div className="glass-card p-4 space-y-3">
                <h4 className="text-sm font-medium text-gray-300">站点名称</h4>
                <div className="flex gap-2">
                  <input value={siteNameText} onChange={(e) => setSiteNameText(e.target.value)} placeholder="站点名称" className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" />
                  <button onClick={handleSiteName} className="bg-primary-600 hover:bg-primary-500 text-white text-sm px-4 py-2 rounded-lg transition-all">更新</button>
                </div>
              </div>

              <div className="glass-card p-4 space-y-3">
                <h4 className="text-sm font-medium text-gray-300">全站公告</h4>
                <textarea
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="输入公告内容..."
                  rows={3}
                  className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 resize-none"
                />
                <button onClick={handleAnnouncement} className="bg-primary-600 hover:bg-primary-500 text-white text-sm px-4 py-2 rounded-lg transition-all">发布公告</button>
              </div>
            </div>
          )}

          {/* Bans Tab */}
          {tab === 'bans' && <BanList />}
        </div>
      </div>
    </div>
  );
};
