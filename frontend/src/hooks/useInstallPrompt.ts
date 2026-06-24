import { useState, useEffect, useCallback } from 'react';
import { showToast } from '../components/common/Toast';

/**
 * 检测当前浏览器是否为 Chrome 或 Edge（基于 user-agent）
 */
function isChromeOrEdge(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  const isChrome = /chrome/.test(ua) && !/edg/.test(ua) && !/opr/.test(ua);
  const isEdge = /edg/.test(ua);
  return isChrome || isEdge;
}

/**
 * useInstallPrompt — 管理 PWA 桌面安装流程
 *
 * - 优先监听 beforeinstallprompt 事件（仅 Chrome/Edge 支持）
 * - 同时通过 user-agent 检测 Chrome/Edge 作为后备
 * - 检测 display-mode: standalone 判断是否已安装
 * - 返回 installApp() 触发浏览器原生安装弹窗
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  // 只要检测到 Chrome/Edge（或 beforeinstallprompt 已触发）就算支持
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

    // 优先检测浏览器是否为 Chrome/Edge（即使 beforeinstallprompt 尚未触发）
    if (isChromeOrEdge()) {
      setIsSupported(true);
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
    if (!deferredPrompt) {
      showToast('请在浏览器地址栏右侧点击安装图标 ✚', 'info');
      return 'unsupported';
    }
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return result.outcome as 'accepted' | 'dismissed';
  }, [deferredPrompt]);

  return { isSupported, isInstalled, installApp };
}
