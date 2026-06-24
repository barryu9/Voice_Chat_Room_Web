import { useState, useEffect, useCallback } from 'react';

/**
 * 模块级拦截：在 React 挂载前就注册 beforeinstallprompt 监听，
 * 避免事件在 useEffect 运行前就已触发而丢失。
 */
let _deferredPrompt: any = null;
let _promptFired = false;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    _deferredPrompt = e;
    _promptFired = true;
  }, { once: true });
}

/**
 * useInstallPrompt — 管理 PWA 桌面安装流程
 *
 * - 模块级捕获 beforeinstallprompt，不依赖 useEffect 时机
 * - 检测 display-mode: standalone 判断是否已安装
 * - 返回 installApp() 触发浏览器原生安装弹窗
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(_deferredPrompt);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isSupported, setIsSupported] = useState(_promptFired);

  useEffect(() => {
    // 如果已经以 standalone 模式运行，不再显示安装按钮
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstalled(true);
      return;
    }

    // 如果模块级已经捕获到事件，同步状态
    if (_deferredPrompt) {
      setDeferredPrompt(_deferredPrompt);
      setIsSupported(true);
    }

    // 后备监听（防止模块级监听被覆盖或 cleanup 后需要重新监听）
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      _deferredPrompt = e;
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
    const prompt = deferredPrompt || _deferredPrompt;
    if (!prompt) return 'unsupported';
    prompt.prompt();
    const result = await prompt.userChoice;
    setDeferredPrompt(null);
    _deferredPrompt = null;
    return result.outcome as 'accepted' | 'dismissed';
  }, [deferredPrompt]);

  return { isSupported, isInstalled, installApp };
}
