import React, { useState, useEffect } from 'react';
import { useRoomStore } from '../../stores/roomStore';
import { useAdminStore } from '../../stores/adminStore';
import { getSocket } from '../../services/socketService';
import { StepperInput } from '../common/StepperInput';
import { showToast } from '../common/Toast';
import { BanList } from './BanList';
import { EVENTS, AUDIO_QUALITY_TIERS, getAudioQualityLabel } from '../../utils/constants';

function saveSettingAck(key: string, value: any, successMsg: string) {
  const socket = getSocket();
  if (!socket) { showToast('连接已断开', 'error'); return; }
  const cleanup = () => {
    socket.off(EVENTS.SERVER.SETTINGS_UPDATED, onAck);
    socket.off(EVENTS.SERVER.ERROR, onError);
  };
  const onAck = (data: any) => {
    if (data.key !== key) return;
    cleanup();
    socket.emit('admin:config-getall');
    showToast(successMsg, 'success');
  };
  const onError = (data: any) => {
    if (data.event !== EVENTS.CLIENT.ADMIN_SETTINGS_UPDATE) return;
    cleanup();
    showToast(data.message || '保存失败', 'error');
  };
  socket.on(EVENTS.SERVER.SETTINGS_UPDATED, onAck);
  socket.on(EVENTS.SERVER.ERROR, onError);
  socket.emit(EVENTS.CLIENT.ADMIN_SETTINGS_UPDATE, { key, value });
}

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

const UserChannelSettingsPanel: React.FC = () => {
  const config = useAdminStore((s) => s.config);

  React.useEffect(() => {
    getSocket()?.emit('admin:config-getall');
    const handler = (data: any) => {
      if (data.config) {
        useAdminStore.getState().setConfig({
          ...useAdminStore.getState().config,
          userChannelMaxPerDevice: data.config['config:user_channel_max_per_device'] ?? 1,
          userChannelMaxUsers: data.config['config:user_channel_max_users'] ?? 10,
          userChannelAllowedBitrates: data.config['config:user_channel_allowed_bitrates'] ?? '48',
          userChannelAutoDelete: data.config['config:user_channel_auto_delete'] ?? 10,
          userChannelMaxNameLen: data.config['config:user_channel_max_name_len'] ?? 6,
          userChannelEnabled: !!data.config['config:user_channel_enabled'],
        });
      }
    };
    getSocket()?.on('admin:config-list', handler);
    return () => { getSocket()?.off('admin:config-list', handler); };
  }, []);

  const save = (key: string, value: any, msg: string) => {
    saveSettingAck(key, value, msg);
  };

  return (
        <div className="space-y-4">
      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-white">临时频道功能</p>
          <p className="text-xs text-gray-500">允许用户自行创建临时语音频道</p>
        </div>
        <button
          onClick={() => save('config:user_channel_enabled', !config.userChannelEnabled, '临时频道功能已更新')}
          className={`relative w-9 h-5 rounded-full transition-colors ${config.userChannelEnabled ? 'bg-primary-500' : 'bg-gray-600'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.userChannelEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div className="glass-card p-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-300">同设备最大创建数</h4>
        <div className="flex items-center gap-2">
          <input type="number" min="0" max="20" value={config.userChannelMaxPerDevice}
            onChange={(e) => useAdminStore.getState().setConfig({ ...config, userChannelMaxPerDevice: parseInt(e.target.value) || 0 })}
            className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500/50" />
          <button onClick={() => save('config:user_channel_max_per_device', config.userChannelMaxPerDevice, '最大创建数已更新')} className="text-sm bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg">保存</button>
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-300">最大人数上限</h4>
        <div className="flex items-center gap-2">
          <input type="number" min="2" max="100" value={config.userChannelMaxUsers}
            onChange={(e) => useAdminStore.getState().setConfig({ ...config, userChannelMaxUsers: parseInt(e.target.value) || 2 })}
            className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500/50" />
          <button onClick={() => save('config:user_channel_max_users', config.userChannelMaxUsers, '人数上限已更新')} className="text-sm bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg">保存</button>
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-300">可选音质</h4>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {AUDIO_QUALITY_TIERS.map((t) => {
            const selected = config.userChannelAllowedBitrates.split(',').includes(String(t.value));
            return (
              <label key={t.value} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    const arr = config.userChannelAllowedBitrates.split(',').filter(Boolean);
                    const idx = arr.indexOf(String(t.value));
                    if (idx >= 0) arr.splice(idx, 1);
                    else arr.push(String(t.value));
                    const newVal = arr.join(',');
                    useAdminStore.getState().setConfig({ ...config, userChannelAllowedBitrates: newVal });
                    save('config:user_channel_allowed_bitrates', newVal, '可选音质已更新');
                  }}
                  className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-300">{t.label} ({t.desc})</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-300">频道名最大字数</h4>
        <div className="flex items-center gap-2">
          <input type="number" min="1" max="20" value={config.userChannelMaxNameLen}
            onChange={(e) => useAdminStore.getState().setConfig({ ...config, userChannelMaxNameLen: parseInt(e.target.value) || 1 })}
            className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500/50" />
          <button onClick={() => save('config:user_channel_max_name_len', config.userChannelMaxNameLen, '频道名最大字数已更新')} className="text-sm bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg">保存</button>
        </div>
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
          ...useAdminStore.getState().config,
          multiLogin: !!data.config['config:multi_login'],
          banDuration: data.config['config:ban_duration'] ?? 1440,
          muteDuration: data.config['config:mute_duration'] ?? 60,
          kickDuration: data.config['config:kick_duration'] ?? 60,
          pwdCooldown: data.config['config:pwd_retry_cooldown'] ?? 5,
          randomDeviceId: !!data.config['config:random_device_id'],
          voiceChangerEnabled: !!data.config['config:voice_changer_enabled'],
        });
      }
    };
    getSocket()?.on('admin:config-list', handler);
    return () => { getSocket()?.off('admin:config-list', handler); };
  }, []);

  const save = (key: string, value: any, msg: string) => {
    saveSettingAck(key, value, msg);
  };

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-white">允许多设备登录</p>
          <p className="text-xs text-gray-500">同一设备可同时登录多个账号</p>
        </div>
        <button
          onClick={() => save('config:multi_login', !config.multiLogin, '多设备登录已更新')}
          className={`relative w-9 h-5 rounded-full transition-colors ${config.multiLogin ? 'bg-primary-500' : 'bg-gray-600'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.multiLogin ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-white">随机设备ID <span className="text-[10px] text-yellow-400">(DEV)</span></p>
          <p className="text-xs text-gray-500">每次打开页面使用随机设备ID，便于多开测试</p>
        </div>
        <button
          onClick={() => {
            const next = !config.randomDeviceId;
            localStorage.setItem('vc_random_device_id', String(next));
            save('config:random_device_id', next, '随机设备ID已更新');
          }}
          className={`relative w-9 h-5 rounded-full transition-colors ${config.randomDeviceId ? 'bg-primary-500' : 'bg-gray-600'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.randomDeviceId ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-white">全局变声器</p>
          <p className="text-xs text-gray-500">关闭后所有频道隐藏变声器功能</p>
        </div>
        <button
          onClick={() => save('config:voice_changer_enabled', !config.voiceChangerEnabled, '变声器全局开关已更新')}
          className={`relative w-9 h-5 rounded-full transition-colors ${config.voiceChangerEnabled ? 'bg-primary-500' : 'bg-gray-600'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.voiceChangerEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div className="glass-card p-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-300">封禁时长（分钟）</h4>
        <div className="flex items-center gap-2">
          <input type="number" min="1" value={config.banDuration}
            onChange={(e) => useAdminStore.getState().setConfig({ ...config, banDuration: parseInt(e.target.value) || 1 })}
            className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500/50" />
          <button onClick={() => save('config:ban_duration', config.banDuration, '封禁时长已更新')}
            className="text-sm bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg">保存</button>
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-300">禁言时长（分钟）</h4>
        <div className="flex items-center gap-2">
          <input type="number" min="1" value={config.muteDuration}
            onChange={(e) => useAdminStore.getState().setConfig({ ...config, muteDuration: parseInt(e.target.value) || 1 })}
            className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500/50" />
          <button onClick={() => save('config:mute_duration', config.muteDuration, '禁言时长已更新')}
            className="text-sm bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg">保存</button>
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-300">踢出冷却时长（分钟）</h4>
        <div className="flex items-center gap-2">
          <input type="number" min="1" value={config.kickDuration}
            onChange={(e) => useAdminStore.getState().setConfig({ ...config, kickDuration: parseInt(e.target.value) || 1 })}
            className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500/50" />
          <button onClick={() => save('config:kick_duration', config.kickDuration, '踢出冷却时长已更新')}
            className="text-sm bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg">保存</button>
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-300">密码错误冷却（分钟）</h4>
        <div className="flex items-center gap-2">
          <input type="number" min="1" value={config.pwdCooldown}
            onChange={(e) => useAdminStore.getState().setConfig({ ...config, pwdCooldown: parseInt(e.target.value) || 1 })}
            className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500/50" />
          <button onClick={() => save('config:pwd_retry_cooldown', config.pwdCooldown, '密码错误冷却已更新')}
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

  const [tab, setTab] = useState<'channels' | 'announcement' | 'bans' | 'settings' | 'userchannels'>('channels');
  const [newName, setNewName] = useState('');
  const [newRoomId, setNewRoomId] = useState('');
  const [newMax, setNewMax] = useState(20);
  const [newAudioBitrate, setNewAudioBitrate] = useState(48);
  const [newPassword, setNewPassword] = useState('');
  const [newVoiceChangerEnabled, setNewVoiceChangerEnabled] = useState(true);
  const [editRoomId, setEditRoomId] = useState('');
  const [editNewRoomId, setEditNewRoomId] = useState('');
  const [editName, setEditName] = useState('');
  const [editMax, setEditMax] = useState(20);
  const [editAudioBitrate, setEditAudioBitrate] = useState(32);
  const [editPassword, setEditPassword] = useState('');
  const [editVoiceChangerEnabled, setEditVoiceChangerEnabled] = useState(true);
  const [editError, setEditError] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [siteNameText, setSiteNameText] = useState(siteName);
  const [versionText, setVersionText] = useState(useRoomStore((s) => s.version));
  const [footerText, setFooterText] = useState(useRoomStore((s) => s.loginFooter));
  const [adminAnnouncements, setAdminAnnouncements] = useState<Array<{ id: string; message: string; createdAt: string; active: boolean }>>([]);

  useEffect(() => {
    if (showPanel) {
      setSiteNameText(siteName);
      setVersionText(useRoomStore.getState().version);
      setFooterText(useRoomStore.getState().loginFooter);
    }
  }, [showPanel, siteName]);

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
    const pwd = newPassword.trim();
    const trimmed = newName.trim();
    const socket = getSocket();
    if (!socket) return;
    setCreating(true);
    setCreateError('');

    const onSuccess = () => {
      socket.off(EVENTS.SERVER.ERROR, onError);
      setCreating(false);
      setShowCreate(false);
      setNewName('');
      setNewRoomId('');
      setNewPassword('');
      showToast(`频道 "${trimmed}" 已创建`, 'success');
    };
    const onError = (data: any) => {
      socket.off('admin:channel-created', onSuccess);
      if (data.event !== EVENTS.CLIENT.ADMIN_CHANNEL_CREATE) return;
      setCreating(false);
      setCreateError(data.message || '创建失败');
    };
    socket.once('admin:channel-created', onSuccess);
    socket.once(EVENTS.SERVER.ERROR, onError);
    socket.emit(EVENTS.CLIENT.ADMIN_CHANNEL_CREATE, {
      name: trimmed,
      maxUsers: newMax,
      roomId: newRoomId.trim() || undefined,
      audioBitrate: newAudioBitrate,
      password: pwd,
      voiceChangerEnabled: newVoiceChangerEnabled,
    });
  };

  const handleUpdate = () => {
    if (!editRoomId || !editName.trim()) return;
    const pwd = editPassword.trim();
    const trimmed = editName.trim();
    setEditError('');
    const updates: any = {
      roomId: editRoomId,
      newRoomId: editNewRoomId.trim() || undefined,
      name: trimmed,
      maxUsers: editMax,
      audioBitrate: editAudioBitrate,
      voiceChangerEnabled: editVoiceChangerEnabled,
    };
    if (pwd !== '') {
      updates.password = pwd;
    }
    const socket = getSocket();
    if (!socket) return;
    const onSuccess = () => {
      socket.off(EVENTS.SERVER.ERROR, onError);
      setEditRoomId('');
      setEditError('');
      showToast(`频道 "${trimmed}" 已更新`, 'success');
    };
    const onError = (data: any) => {
      if (data.event !== EVENTS.CLIENT.ADMIN_CHANNEL_UPDATE) return;
      socket.off('admin:channel-updated', onSuccess);
      setEditError(data.message || '更新失败');
    };
    socket.once('admin:channel-updated', onSuccess);
    socket.once(EVENTS.SERVER.ERROR, onError);
    socket.emit(EVENTS.CLIENT.ADMIN_CHANNEL_UPDATE, updates);
  };

  const handleDelete = (roomId: string) => {
    if (window.confirm('确定要删除该频道吗？频道内的所有用户将被踢出。')) {
      const socket = getSocket();
      if (!socket) return;
      const onSuccess = () => {
        socket.off(EVENTS.SERVER.ERROR, onError);
        showToast('频道已删除', 'success');
      };
      const onError = () => {
        socket.off('admin:channel-deleted', onSuccess);
      };
      socket.once('admin:channel-deleted', onSuccess);
      socket.once(EVENTS.SERVER.ERROR, onError);
      socket.emit(EVENTS.CLIENT.ADMIN_CHANNEL_DELETE, { roomId });
    }
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
    const socket = getSocket();
    if (!socket) return;
    const onSuccess = () => {
      socket.off(EVENTS.SERVER.ERROR, onError);
      showToast('公告已发布', 'success');
      refreshAnnouncements();
    };
    const onError = () => {
      socket.off('admin:announcement-created', onSuccess);
    };
    socket.once('admin:announcement-created', onSuccess);
    socket.once(EVENTS.SERVER.ERROR, onError);
    socket.emit(EVENTS.CLIENT.ADMIN_ANNOUNCEMENT_CREATE, { message: announcementText.trim() });
    setAnnouncementText('');
  };

  const handleDeleteAnnouncement = (id: string) => {
    const socket = getSocket();
    if (!socket) return;
    const onSuccess = () => {
      socket.off(EVENTS.SERVER.ERROR, onError);
      setAdminAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, active: false } : a))
      );
      showToast('公告已删除', 'success');
    };
    const onError = () => {
      socket.off('admin:announcement-deleted', onSuccess);
    };
    socket.once('admin:announcement-deleted', onSuccess);
    socket.once(EVENTS.SERVER.ERROR, onError);
    socket.emit(EVENTS.CLIENT.ADMIN_ANNOUNCEMENT_DELETE, { id });
  };

  const handleSiteName = () => {
    if (!siteNameText.trim()) return;
    saveSettingAck('siteName', siteNameText.trim(), '站点名称已更新');
  };

  const handleVersion = () => {
    if (!versionText.trim()) return;
    saveSettingAck('version', versionText.trim(), '版本号已更新');
  };

  const handleFooterText = () => {
    saveSettingAck('loginFooter', footerText, '登录页公告已更新');
  };

  const refreshAnnouncements = () => {
    getSocket()?.emit('admin:announcements:list');
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center pt-16 bg-black/40 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col animate-in slide-in-from-top-4 fade-in isolate">
        <div className="shrink-0 bg-gray-900/90 backdrop-blur-xl p-5 border-b border-gray-700/50 flex items-center justify-between rounded-t-2xl overflow-hidden">
          <h2 className="text-xl font-bold text-white">管理面板</h2>
          <button
            onClick={() => setShowPanel(false)}
            className="text-gray-400 hover:text-white text-xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700/50 px-5 shrink-0">
          {(['channels', 'announcement', 'bans', 'settings', 'userchannels'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm transition-all ${
                tab === t
                  ? 'text-primary-400 border-b-2 border-primary-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'channels' ? '频道管理' : t === 'announcement' ? '公告设置' : t === 'bans' ? '封禁列表' : t === 'settings' ? '系统设置' : '临时频道'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-5">
          {/* Channels Tab */}
          {tab === 'channels' && (
            <div className="space-y-4">
              {/* Create button */}
              <button
                onClick={() => { setShowCreate(true); setCreateError(''); }}
                className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-2 rounded-lg transition-all"
              >
                + 新建频道
              </button>

              {/* List */}
              {channels.filter(c => c.type !== 'user').map((ch, index) => (
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
                      <span className="text-white font-medium flex items-center gap-1">
                        {ch.password && (
                          <svg className="w-3 h-3 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        )}
                        {ch.name}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">{ch.roomId}</span>
                  </div>
                  {editRoomId === ch.roomId ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 items-end">
                        <div className="flex-1 min-w-[100px]">
                          <label className="block text-xs text-gray-400 mb-1">频道名称</label>
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="如：大厅" className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50 h-8" />
                        </div>
                        <div className="w-24">
                          <label className="block text-xs text-gray-400 mb-1">简称</label>
                          <input value={editNewRoomId} onChange={(e) => setEditNewRoomId(e.target.value)} placeholder="如：lobby" className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50 h-8" />
                        </div>
                        <div className="w-28">
                          <label className="block text-xs text-gray-400 mb-1">人数上限</label>
                          <StepperInput value={editMax} onChange={setEditMax} min={2} max={100} />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">音质</label>
                          <select
                            value={editAudioBitrate}
                            onChange={(e) => setEditAudioBitrate(parseInt(e.target.value))}
                            className="bg-gray-800/60 border border-gray-600/50 rounded-lg px-2 text-xs text-white focus:outline-none focus:border-primary-500/50 h-7"
                          >
                            {AUDIO_QUALITY_TIERS.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">密码</label>
                          <input value={editPassword} onChange={(e) => setEditPassword(e.target.value)} type="text" placeholder={ch.password || '4-16位（可选）'} maxLength={16} className="w-32 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50 h-8" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-1">
                         <span className="text-xs text-gray-400">允许变声器</span>
                        <button
                          onClick={() => setEditVoiceChangerEnabled(!editVoiceChangerEnabled)}
                          className={`relative w-9 h-5 rounded-full transition-colors ${editVoiceChangerEnabled ? 'bg-primary-500' : 'bg-gray-600'}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editVoiceChangerEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                      {editError && <p className="text-red-400 text-xs">{editError}</p>}
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setEditRoomId(''); setEditError(''); }} className="bg-gray-600 hover:bg-gray-500 text-white text-sm px-3 py-1.5 rounded-lg">取消</button>
                        <button onClick={handleUpdate} className="bg-primary-600 hover:bg-primary-500 text-white text-sm px-3 py-1.5 rounded-lg">保存</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">上限: {ch.maxUsers}</span>
                      <span className="text-xs text-gray-500">{getAudioQualityLabel(ch.audioBitrate ?? 32)}</span>
                      <div className="flex-1" />
                      <button onClick={() => { setEditRoomId(ch.roomId); setEditNewRoomId(ch.roomId); setEditName(ch.name); setEditMax(ch.maxUsers); setEditAudioBitrate(ch.audioBitrate ?? 32); setEditPassword(''); setEditVoiceChangerEnabled(ch.voiceChangerEnabled ?? true); setEditError(''); }} className="text-sm text-primary-400 hover:text-primary-300">编辑</button>
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

          {tab === 'userchannels' && <UserChannelSettingsPanel />}

        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel p-5 w-full max-w-lg mx-4 animate-in zoom-in-95 fade-in duration-200">
            <h3 className="text-lg font-semibold text-white mb-4">新建频道</h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-gray-400">频道名称</span>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="如：大厅" maxLength={20} className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 mt-1 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50 h-8" />
              </label>
              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="text-xs text-gray-400">简称（可选）</span>
                  <input value={newRoomId} onChange={(e) => setNewRoomId(e.target.value)} placeholder="如：lobby" maxLength={16} className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 mt-1 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50 h-8" />
                </label>
                <label className="w-32">
                  <span className="text-xs text-gray-400">人数上限</span>
                  <div className="mt-1">
                    <StepperInput value={newMax} onChange={setNewMax} min={2} max={100} />
                  </div>
                </label>
              </div>
              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="text-xs text-gray-400">音质</span>
                  <select value={newAudioBitrate} onChange={(e) => setNewAudioBitrate(parseInt(e.target.value))} className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-2 h-7 mt-1 text-xs text-white focus:outline-none focus:border-primary-500/50">
                    {AUDIO_QUALITY_TIERS.map((t) => (<option key={t.value} value={t.value}>{t.label} {t.desc}</option>))}
                  </select>
                </label>
                <label className="flex-1">
                  <span className="text-xs text-gray-400">密码（可选）</span>
                  <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="4-16位" maxLength={16} className="w-full bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 mt-1 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50 h-8" />
                </label>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">允许变声器</span>
                <button
                  onClick={() => setNewVoiceChangerEnabled(!newVoiceChangerEnabled)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${newVoiceChangerEnabled ? 'bg-primary-500' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${newVoiceChangerEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {createError && <p className="text-red-400 text-xs">{createError}</p>}
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setShowCreate(false); setCreateError(''); }} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2.5 rounded-xl" disabled={creating}>取消</button>
                <button onClick={handleCreate} disabled={!newName.trim() || creating} className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm py-2.5 rounded-xl">{creating ? '创建中...' : '创建'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
