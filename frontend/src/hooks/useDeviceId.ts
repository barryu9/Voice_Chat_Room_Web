import { useEffect, useRef, useState } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { useUserStore } from '../stores/userStore';

export function useDeviceId() {
  const [deviceId, setDeviceId] = useState<string>('');
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      const id = result.visitorId;
      setDeviceId(id);
      useUserStore.getState().setDeviceId(id);
    })();
  }, []);

  return deviceId;
}
