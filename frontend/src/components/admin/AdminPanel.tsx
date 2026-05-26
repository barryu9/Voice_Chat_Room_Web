import React, { useState, useEffect } from 'react';
import { getSocket } from '../../services/socketService';
import { useRoomStore } from '../../stores/roomStore';
import { useAdminStore } from '../../stores/adminStore';
import { EVENTS, AUDIO_QUALITY_TIERS, getAudioQualityLabel } from '../../utils/constants';
import { showToast } from '../common/Toast';
import { BanList } from './BanList';

const KickedSection: React.FC = () => {
  const kickedList = useAdminStore((s) => s.kickedList);
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_KICKLIST);
    const handler = (data: any) => {
      useAdminStore.getState().setKickedList(data.kicked || []);
    };
    getSocket()?.on(EVENTS.SERVER.KICKED_LIST, handler);
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      getSocket()?.off(EVENTS.SERVER.KICKED_LIST, handler);
      clearInterval(timer);
    };
  }, []);

  const fmt = (ms: number) => {
    if (ms <= 0) return '已过期';
    const s = Math.ceil(ms / 1000);
    if (s < 60) return `${s}秒`;
    const m = Math.floor(s / 60);
    return `${m}分${s % 60}秒`;
  };

  if (kickedList.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-300 mb-2">踢出列表</h4>
      <div className="space-y-2">
        {kickedList.map((k) => (
          <div key={k.deviceId} className="glass-card p-3 flex items-center justify-between">
            <div>
              <p className="text-sm text-white">{k.nickname || k.deviceId}</p>
              <p className="text-xs text-gray-500">{k.deviceId}</p>
              <p className="text-[10px] text-yellow-400">剩余: {fmt(k.expiresAt - Date.now())}</p>
            </div>
            <button
              onClick={() => {
                getSocket()?.emit(EVENTS.CLIENT.ADMIN_UNKICK, { deviceId: k.deviceId });
                getSocket()?.emit(EVENTS.CLIENT.ADMIN_KICKLIST);
              }}
              className="text-sm text-green-400 hover:text-green-300"
            >
              解除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const SettingsPanel: React.FC = () => {
  const config = useAdminStore((s) => s.config);

  React.useEffect(() => {
    getSocket()?.emit('admin:config-getall');
    const handler = (data: any) => {
      if (data.config) {
        useAdminStore.getState().setConfig({
          multiLogin: !!data.config['config:multi_login'],
          banDuration: data.config['config:ban_duration'] ?? 1440,
          muteDuration: data.config['config:mute_duration'] ?? 60,
          kickDuration: data.config['config:kick_duration'] ?? 60,
        });
      }
    };
    getSocket()?.on('admin:config-list', handler);
    return () => { getSocket()?.off('admin:config-list', handler); };
  }, []);

  const save = (key: string, value: any) => {
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_SETTINGS_UPDATE, { key, value });
    getSocket()?.emit('admin:config-getall');
  };

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-white">允许多设备登录</p>
          <p className="text-xs text-gray-500">同一设备可同时登录多个账号</p>
        </div>
        <button
          onClick={() => save('config:multi_login', !config.multiLogin)}
          className={`relative w-9 h-5 rounded-full transition-colors ${config.multiLogin ? 'bg-primary-500' : 'bg-gray-600'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.multiLogin ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div className="glass-card p-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-300">封禁时长（分钟）</h4>
        <div className="flex items-center gap-2">
          <input type="number" min="1" value={config.banDuration}
            onChange={(e) => useAdminStore.getState().setConfig({ ...config, banDuration: parseInt(e.target.value) || 1 })}
            className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500/50" />
          <button onClick={() => save('config:ban_duration', config.banDuration)}
            className="text-sm bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg">保存</button>
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-300">禁言时长（分钟）</h4>
        <div className="flex items-center gap-2">
          <input type="number" min="1" value={config.muteDuration}
            onChange={(e) => useAdminStore.getState().setConfig({ ...config, muteDuration: parseInt(e.target.value) || 1 })}
            className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500/50" />
          <button onClick={() => save('config:mute_duration', config.muteDuration)}
            className="text-sm bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg">保存</button>
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-300">踢出冷却时长（分钟）</h4>
        <div className="flex items-center gap-2">
          <input type="number" min="1" value={config.kickDuration}
            onChange={(e) => useAdminStore.getState().setConfig({ ...config, kickDuration: parseInt(e.target.value) || 1 })}
            className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500/50" />
          <button onClick={() => save('config:kick_duration', config.kickDuration)}
            className="text-sm bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg">保存</button>
        </div>
      </div>
    </div>
  );
};

export const AdminPanel: React.FC = () => {
  const showPanel = useAdminStore((s) => s.showPanel);
  const setShowPanel = useAdminStore((s) => s.setShowPanel);
  const channels = useRoomStore((s) => s.channels);
  const setChannels = useRoomStore((s) => s.setChannels);
  const siteName = useRoomStore((s) => s.siteName);

  const [tab, setTab] = useState<'channels' | 'announcement' | 'bans' | 'settings'>('channels');
  const [newName, setNewName] = useState('');
  const [newRoomId, setNewRoomId] = useState('');
  const [newMax, setNewMax] = useState(20);
  const [newAudioBitrate, setNewAudioBitrate] = useState(48);
  const [editRoomId, setEditRoomId] = useState('');
  const [editNewRoomId, setEditNewRoomId] = useState('');
  const [editName, setEditName] = useState('');
  const [editMax, setEditMax] = useState(20);
  const [editAudioBitrate, setEditAudioBitrate] = useState(32);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [announcementText, setAnnouncementText] = useState('');
  const [siteNameText, setSiteNameText] = useState(siteName);
  const [versionText, setVersionText] = useState(useRoomStore((s) => s.version));
  const [footerText, setFooterText] = useState(useRoomStore((s) => s.loginFooter));
  const [adminAnnouncements, setAdminAnnouncements] = useState<Array<{ id: string; message: string; createdAt: string; active: boolean }>>([]);

  useEffect(() => {
    if (showPanel && tab === 'announcement') {
      const socket = getSocket();
      const handler = (data: { announcements: Array<{ id: string; message: string; createdAt: string; active: boolean }> }) => {
        setAdminAnnouncements(data.announcements || []);
      };
      socket?.on('admin:announcements:list', handler);
      socket?.emit('admin:announcements:list');
      return () => {
        socket?.off('admin:announcements:list', handler);
      };
    }
  }, [showPanel, tab]);

  if (!showPanel) return null;

  const handleCreate = () => {
    if (!newName.trim()) return;
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_CHANNEL_CREATE, {
      name: newName.trim(),
      maxUsers: newMax,
      roomId: newRoomId.trim() || undefined,
      audioBitrate: newAudioBitrate,
    });
    setNewName('');
    setNewRoomId('');
    showToast(`频道 "${newName.trim()}" 已创建`, 'success');
  };

  const handleUpdate = () => {
    if (!editRoomId || !editName.trim()) return;
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_CHANNEL_UPDATE, {
      roomId: editRoomId,
      newRoomId: editNewRoomId.trim() || undefined,
      name: editName.trim(),
      maxUsers: editMax,
      audioBitrate: editAudioBitrate,
    });
    setEditRoomId('');
    showToast(`频道 "${editName.trim()}" 已更新`, 'success');
  };

  const handleDelete = (roomId: string) => {
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_CHANNEL_DELETE, { roomId });
    showToast('频道已删除', 'success');
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = () => {
    if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...channels];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dragOverIndex, 0, moved);

    const updated = reordered.map((ch, i) => ({ ...ch, sortOrder: i }));
    setChannels(updated);

    getSocket()?.emit(EVENTS.CLIENT.ADMIN_CHANNELS_REORDER, {
      channels: updated.map((ch) => ({ roomId: ch.roomId, sortOrder: ch.sortOrder })),
    });

    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleAnnouncement = () => {
    if (!announcementText.trim()) return;
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_ANNOUNCEMENT_CREATE, { message: announcementText.trim() });
    setAnnouncementText('');
    showToast('公告已发布', 'success');
    setTimeout(() => refreshAnnouncements(), 500);
  };

  const handleDeleteAnnouncement = (id: string) => {
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_ANNOUNCEMENT_DELETE, { id });
    setAdminAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, active: false } : a))
    );
    showToast('公告已删除', 'success');
  };

  const handleSiteName = () => {
    if (!siteNameText.trim()) return;
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_SETTINGS_UPDATE, { key: 'siteName', value: siteNameText.trim() });
    showToast('站点名称已更新', 'success');
  };

  const handleVersion = () => {
    if (!versionText.trim()) return;
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_SETTINGS_UPDATE, { key: 'version', value: versionText.trim() });
    showToast('版本号已更新', 'success');
  };

  const handleFooterText = () => {
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_SETTINGS_UPDATE, { key: 'loginFooter', value: footerText });
    showToast('登录页公告已更新', 'success');
  };

  const refreshAnnouncements = () => {
    getSocket()?.emit('admin:announcements:list');
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
          {(['channels', 'announcement', 'bans', 'settings'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm transition-all ${
                tab === t
                  ? 'text-primary-400 border-b-2 border-primary-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'channels' ? '频道管理' : t === 'announcement' ? '公告设置' : t === 'bans' ? '封禁列表' : '系统设置'}
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
                <div className="flex flex-wrap gap-2">
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="频道名称" className="flex-1 min-w-[100px] bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" />
                  <input value={newRoomId} onChange={(e) => setNewRoomId(e.target.value)} placeholder="简称（可选）" className="w-24 sm:w-28 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" />
                  <div className="flex items-center rounded-lg border border-gray-600/50 bg-gray-800/60 overflow-hidden shrink-0">
                    <button
                      onClick={() => setNewMax(Math.max(2, newMax - 1))}
                      className="w-7 h-9 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700/80 transition-colors text-sm shrink-0"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={newMax}
                      onChange={(e) => { const v = parseInt(e.target.value); if (v >= 2 && v <= 100) setNewMax(v); }}
                      className="w-10 text-center bg-transparent text-sm text-white border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => setNewMax(Math.min(100, newMax + 1))}
                      className="w-7 h-9 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700/80 transition-colors text-sm shrink-0"
                    >
                      +
                    </button>
                  </div>
                  <select
                    value={newAudioBitrate}
                    onChange={(e) => setNewAudioBitrate(parseInt(e.target.value))}
                    className="bg-gray-800/60 border border-gray-600/50 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-primary-500/50"
                  >
                    {AUDIO_QUALITY_TIERS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label} {t.desc}</option>
                    ))}
                  </select>
                  <button onClick={handleCreate} className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-2 rounded-lg transition-all shrink-0">创建</button>
                </div>
              </div>

              {/* List */}
              {channels.map((ch, index) => (
                <div
                  key={ch.roomId}
                  draggable={editRoomId !== ch.roomId}
                  onDragStart={() => { if (editRoomId !== ch.roomId) handleDragStart(index); }}
                  onDragOver={(e) => { if (editRoomId !== ch.roomId) handleDragOver(e, index); }}
                  onDrop={() => { if (editRoomId !== ch.roomId) handleDrop(); }}
                  onDragEnd={handleDragEnd}
                  className={`glass-card p-4 transition-all ${
                    dragIndex === index ? 'opacity-50 scale-95' : ''
                  } ${
                    dragOverIndex === index && dragIndex !== index ? 'border-t-2 border-primary-400' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {editRoomId !== ch.roomId && (
                        <button
                          className="flex items-center justify-center w-5 h-6 rounded text-gray-500 hover:text-gray-300 hover:bg-white/5 cursor-grab active:cursor-grabbing transition-colors"
                          title="拖动以调整排序"
                        >
                          <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
                            <circle cx="2" cy="2" r="1.2"/>
                            <circle cx="6" cy="2" r="1.2"/>
                            <circle cx="2" cy="6" r="1.2"/>
                            <circle cx="6" cy="6" r="1.2"/>
                            <circle cx="2" cy="10" r="1.2"/>
                            <circle cx="6" cy="10" r="1.2"/>
                          </svg>
                        </button>
                      )}
                      <span className="text-white font-medium">{ch.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{ch.roomId}</span>
                  </div>
                  {editRoomId === ch.roomId ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 items-end">
                        <div className="flex-1 min-w-[100px]">
                          <label className="block text-xs text-gray-500 mb-1">频道名称</label>
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="如：大厅" className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50" />
                        </div>
                        <div className="w-24">
                          <label className="block text-xs text-gray-500 mb-1">简称</label>
                          <input value={editNewRoomId} onChange={(e) => setEditNewRoomId(e.target.value)} placeholder="如：lobby" className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50" />
                        </div>
                        <div className="w-28">
                          <label className="block text-xs text-gray-500 mb-1">人数上限</label>
                          <div className="flex items-center rounded-lg border border-gray-600/50 bg-gray-800/60 overflow-hidden">
                            <button
                              onClick={() => setEditMax(Math.max(2, editMax - 1))}
                              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700/80 transition-colors text-sm leading-none shrink-0"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              value={editMax}
                              onChange={(e) => { const v = parseInt(e.target.value); if (v >= 2 && v <= 100) setEditMax(v); }}
                              className="w-10 text-center bg-transparent text-sm text-white border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              onClick={() => setEditMax(Math.min(100, editMax + 1))}
                              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700/80 transition-colors text-sm leading-none shrink-0"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">音质</label>
                          <select
                            value={editAudioBitrate}
                            onChange={(e) => setEditAudioBitrate(parseInt(e.target.value))}
                            className="bg-gray-800/60 border border-gray-600/50 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500/50 h-7"
                          >
                            {AUDIO_QUALITY_TIERS.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                        <button onClick={handleUpdate} className="bg-primary-600 hover:bg-primary-500 text-white text-xs px-3 py-1.5 rounded-lg h-8">保存</button>
                        <button onClick={() => setEditRoomId('')} className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-3 py-1.5 rounded-lg h-8">取消</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">上限: {ch.maxUsers}</span>
                      <span className="text-xs text-gray-500">{getAudioQualityLabel(ch.audioBitrate ?? 32)}</span>
                      <div className="flex-1" />
                      <button onClick={() => { setEditRoomId(ch.roomId); setEditNewRoomId(ch.roomId); setEditName(ch.name); setEditMax(ch.maxUsers); setEditAudioBitrate(ch.audioBitrate ?? 32); }} className="text-sm text-primary-400 hover:text-primary-300">编辑</button>
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
                <h4 className="text-sm font-medium text-gray-300">版本号</h4>
                <div className="flex gap-2">
                  <input value={versionText} onChange={(e) => setVersionText(e.target.value)} placeholder="例: 2026.05.24.v1" className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" />
                  <button onClick={handleVersion} className="bg-primary-600 hover:bg-primary-500 text-white text-sm px-4 py-2 rounded-lg transition-all">更新</button>
                </div>
              </div>

              <div className="glass-card p-4 space-y-3">
                <h4 className="text-sm font-medium text-gray-300">登录页底部公告</h4>
                <div className="flex gap-2">
                  <input value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="输入登录页底部公告文字" className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" />
                  <button onClick={handleFooterText} className="bg-primary-600 hover:bg-primary-500 text-white text-sm px-4 py-2 rounded-lg transition-all">更新</button>
                </div>
              </div>

              <div className="glass-card p-4 space-y-3">
                <h4 className="text-sm font-medium text-gray-300">发布新公告</h4>
                <div className="flex gap-2">
                  <input
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="输入公告内容..."
                    className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
                  />
                  <button onClick={handleAnnouncement} className="bg-primary-600 hover:bg-primary-500 text-white text-sm px-4 py-2 rounded-lg transition-all">发布</button>
                </div>
              </div>

              <div className="glass-card p-4 space-y-3">
                <h4 className="text-sm font-medium text-gray-300">公告列表</h4>
                {adminAnnouncements.length === 0 && (
                  <p className="text-sm text-gray-500">暂无公告</p>
                )}
                {adminAnnouncements.filter((a) => a.active).map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-700/30 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{a.message}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(a.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteAnnouncement(a.id)}
                      className="text-xs text-red-400 hover:text-red-300 ml-2 shrink-0"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bans Tab */}
          {tab === 'bans' && (
            <>
              <KickedSection />
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">封禁列表</h4>
                <BanList />
              </div>
            </>
          )}

          {tab === 'settings' && <SettingsPanel />}

        </div>
      </div>
    </div>
  );
};
