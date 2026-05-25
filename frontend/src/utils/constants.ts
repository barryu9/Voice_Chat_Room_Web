export const EVENTS = {
  CLIENT: {
    USER_LOGIN:            'user:login',
    ROOM_LIST:             'room:list',
    ROOM_JOIN:             'room:join',
    ROOM_LEAVE:            'room:leave',
    ROOM_USERS:            'room:users',
    RTP_GET_CAPABILITIES:  'rtp:getCapabilities',
    TRANSPORT_CREATE:      'transport:create',
    TRANSPORT_CONNECT:     'transport:connect',
    PRODUCER_CREATE:       'producer:create',
    PRODUCER_CLOSE:        'producer:close',
    CONSUMER_CREATE:       'consumer:create',
    CONSUMER_PAUSE:        'consumer:pause',
    CONSUMER_RESUME:       'consumer:resume',
    USER_MUTE_SELF:        'user:mute-self',
    ADMIN_AUTH:            'admin:auth',
    ADMIN_CHANNEL_CREATE:  'admin:channel-create',
    ADMIN_CHANNEL_UPDATE:  'admin:channel-update',
    ADMIN_CHANNEL_DELETE:  'admin:channel-delete',
    ADMIN_SETTINGS_UPDATE: 'admin:settings-update',
    ADMIN_KICK:            'admin:kick',
    ADMIN_BAN:             'admin:ban',
    ADMIN_UNBAN:           'admin:unban',
    ADMIN_BANLIST:         'admin:banlist',
    ADMIN_MUTE_TARGET:     'admin:mute-target',
    ADMIN_UNMUTE_TARGET:   'admin:unmute-target',
    ADMIN_ANNOUNCEMENT_CREATE:  'admin:announcement-create',
    ADMIN_ANNOUNCEMENT_DELETE:  'admin:announcement-delete',
    ADMIN_CHANNELS_REORDER:     'admin:channels-reorder',
  },
  SERVER: {
    LOGIN_SUCCESS:       'user:login-success',
    LOGIN_ERROR:         'user:login-error',
    KICKED:              'user:kicked',
    BANNED:              'user:banned',
    ROOM_LIST:           'room:list',
    ROOM_USERS:          'room:users',
    USER_JOINED:         'room:user-joined',
    USER_LEFT:           'room:user-left',
    ROOM_INFO_UPDATED:   'room:info-updated',
    ROOM_ONLINE_UPDATED: 'room:online-updated',
    ANNOUNCEMENT:        'announcement',
    RTP_CAPABILITIES:    'rtp:capabilities',
    TRANSPORT_CREATED:   'transport:created',
    PRODUCER_CREATED:    'producer:created',
    PRODUCER_CLOSED:     'producer:closed',
    NEW_PRODUCER:        'new-producer',
    CONSUMER_CREATED:    'consumer:created',
    CONSUMER_CLOSED:     'consumer:closed',
    CONSUMER_PAUSED:     'consumer:paused',
    ACTIVE_SPEAKER:      'active-speaker',
    SELF_MUTED:          'self:muted',
    TARGET_MUTED:        'target:muted',
    TARGET_UNMUTED:      'target:unmuted',
    ERROR:               'error',
    ADMIN_AUTH_RESULT:   'admin:auth-result',
    ADMIN_BANLIST:       'admin:banlist',
    SETTINGS_UPDATED:    'admin:settings-updated',
    ANNOUNCEMENTS_UPDATED: 'announcements:updated',
  },
} as const;

export type Channel = {
  roomId: string;
  name: string;
  maxUsers: number;
  isDefault?: boolean;
  onlineCount?: number;
  voiceCount?: number;
  sortOrder?: number;
  audioBitrate?: number;
};

export const AUDIO_QUALITY_TIERS: { label: string; value: number; desc: string }[] = [
  { label: '流畅', value: 20, desc: '20kbps' },
  { label: '标准', value: 32, desc: '32kbps' },
  { label: '质量', value: 48, desc: '48kbps' },
  { label: '音乐', value: 64, desc: '64kbps' },
];

export function getAudioQualityLabel(bitrate: number): string {
  const tier = AUDIO_QUALITY_TIERS.find((t) => t.value === bitrate);
  return tier ? `${tier.label} (${tier.desc})` : `${bitrate}kbps`;
}

export type Announcement = {
  id: string;
  message: string;
  createdAt: string;
  active?: boolean;
};

export type UserInfo = {
  socketId: string;
  userId: string;
  nickname: string;
  deviceId: string;
};
