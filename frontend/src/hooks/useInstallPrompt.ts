import { useState, useEffect, useCallback } from 'react';

/**
 * useInstallPrompt — 管理 PWA 桌面安装流程
 *
 * - 监听 beforeinstallprompt 事件（仅 Chrome/Edge 支持）
 * - 检测 display-mode: standalone 判断是否已安装
 * - 返回 installApp() 触发浏览器原生安装弹窗
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // 如果已经以 standalone 模式运行（已安装的 PWA），不再显示安装按钮
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      (window.navigator as any).standalone === true // iOS Safari
    ) {
      setIsInstalled(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      // 阻止浏览器自动弹窗，交由我们控制时机
      e.preventDefault();
      setDeferredPrompt(e);
      setIsSupported(true);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const installApp = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unsupported'> => {
    if (!deferredPrompt) return 'unsupported';
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return result.outcome as 'accepted' | 'dismissed';
  }, [deferredPrompt]);

  return { isSupported, isInstalled, installApp };
}
