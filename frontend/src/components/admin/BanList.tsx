import React, { useEffect } from 'react';
import { useAdminStore } from '../../stores/adminStore';
import { getSocket } from '../../services/socketService';
import { EVENTS } from '../../utils/constants';

export const BanList: React.FC = () => {
  const bans = useAdminStore((s) => s.bans);

  useEffect(() => {
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_BANLIST);

    const onBanlist = (data: any) => {
      useAdminStore.getState().setBans(data.bans || []);
    };
    getSocket()?.on(EVENTS.SERVER.ADMIN_BANLIST, onBanlist);
    return () => { getSocket()?.off(EVENTS.SERVER.ADMIN_BANLIST, onBanlist); };
  }, []);

  const handleUnban = (deviceId: string) => {
    getSocket()?.emit(EVENTS.CLIENT.ADMIN_UNBAN, { deviceId });
    setTimeout(() => getSocket()?.emit(EVENTS.CLIENT.ADMIN_BANLIST), 500);
  };

  if (bans.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">暂无封禁记录</p>;
  }

  return (
    <div className="space-y-2">
      {bans.map((ban) => (
        <div key={ban.deviceId} className="glass-card p-3 flex items-center justify-between">
          <div>
            <p className="text-sm text-white">{ban.nickname || '未知用户'}</p>
            <p className="text-xs text-gray-500">{ban.deviceId.slice(0, 12)}... · {ban.reason || '无原因'}</p>
          </div>
          <button
            onClick={() => handleUnban(ban.deviceId)}
            className="text-sm text-green-400 hover:text-green-300 transition-colors"
          >
            解封
          </button>
        </div>
      ))}
    </div>
  );
};
