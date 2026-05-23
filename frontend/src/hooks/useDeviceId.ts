import { useEffect, useRef, useState } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { useUserStore } from '../stores/userStore';

function fallbackId(): string {
  const stored = localStorage.getItem('vc_device_id');
  if (stored) return stored;
  const id = 'device-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  localStorage.setItem('vc_device_id', id);
  return id;
}

export function useDeviceId() {
  const [deviceId, setDeviceId] = useState<string>('');
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        const id = result.visitorId;
        setDeviceId(id);
        useUserStore.getState().setDeviceId(id);
      } catch (err) {
        const id = fallbackId();
        setDeviceId(id);
        useUserStore.getState().setDeviceId(id);
      }
    })();
  }, []);

  return deviceId;
}
