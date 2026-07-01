import { useEffect, useRef } from 'react';

/**
 * Screen Wake Lock hook — keeps the screen on while voice chat is active.
 * Uses the Screen Wake Lock API (navigator.wakeLock), Baseline since 2025-03.
 *
 * Behavior:
 * - Requests wake lock when voice is connected and page is visible
 * - Releases wake lock when voice disconnects or page is hidden
 * - Re-acquires on visibility change (user returns to the tab)
 * - Refreshes the lock every 30s to guard against silent releases
 */

export function useWakeLock(isActive: boolean) {
  const sentinelRef = useRef<any>(null);
  const activeRef = useRef(isActive);
  activeRef.current = isActive;

  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    const request = async () => {
      if (sentinelRef.current || !activeRef.current) return;
      if (document.visibilityState !== 'visible') return;

      try {
        const sentinel = await navigator.wakeLock.request('screen');
        sentinelRef.current = sentinel;
        sentinel.addEventListener('release', () => {
          sentinelRef.current = null;
        });
      } catch {
        // Wake Lock denied (low battery, power save, etc.) — silent fail
      }
    };

    const release = async () => {
      if (!sentinelRef.current) return;
      try {
        await sentinelRef.current.release();
      } catch {
        // already released
      }
      sentinelRef.current = null;
    };

    // Request on activation
    if (isActive) {
      request();
    } else {
      release();
    }

    // Re-acquire when tab becomes visible
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activeRef.current) {
        request();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Periodic refresh — some browsers/OS may silently release the lock
    const refreshTimer = setInterval(() => {
      if (activeRef.current && document.visibilityState === 'visible') {
        request();
      }
    }, 30000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(refreshTimer);
      release();
    };
  }, [isActive]);
}
