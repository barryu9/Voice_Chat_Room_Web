import { useCallback, useState } from 'react';
import { getRtpCapabilities } from '../services/mediasoupService';
import { getSocket } from '../services/socketService';
import { getUserAudioStream } from './useDevices';

export type PreflightStatus = 'idle' | 'checking' | 'passed' | 'failed';

export interface PreflightCheck {
  id: 'secure' | 'socket' | 'microphone' | 'media';
  label: string;
  status: PreflightStatus;
  detail: string;
}

const initialChecks: PreflightCheck[] = [
  { id: 'secure', label: '安全上下文', status: 'idle', detail: '正在检查 HTTPS 环境' },
  { id: 'socket', label: '服务器连接', status: 'idle', detail: '正在检查 Socket 连接' },
  { id: 'microphone', label: '麦克风', status: 'idle', detail: '正在申请所选麦克风' },
  { id: 'media', label: '媒体服务', status: 'idle', detail: '正在检查 RTP 能力' },
];

export function useVoicePreflight(selectedInput: string) {
  const [checks, setChecks] = useState<PreflightCheck[]>(initialChecks);
  const [running, setRunning] = useState(false);

  const updateCheck = useCallback((id: PreflightCheck['id'], status: PreflightStatus, detail: string) => {
    setChecks((current) => current.map((check) => check.id === id ? { ...check, status, detail } : check));
  }, []);

  const runChecks = useCallback(async () => {
    setRunning(true);
    setChecks(initialChecks.map((check) => ({ ...check, status: 'checking' })));

    const secure = window.isSecureContext;
    updateCheck('secure', secure ? 'passed' : 'failed', secure ? '当前页面可安全访问麦克风' : '请使用 HTTPS 或 localhost 打开页面');

    const socket = getSocket();
    const socketReady = !!socket?.connected;
    updateCheck('socket', socketReady ? 'passed' : 'failed', socketReady ? '已连接到语音服务器' : '服务器连接未建立，请等待重连后重试');

    let microphoneReady = false;
    try {
      const stream = await getUserAudioStream(selectedInput || undefined);
      const track = stream.getAudioTracks()[0];
      const label = track?.label || '所选麦克风';
      stream.getTracks().forEach((item) => item.stop());
      updateCheck('microphone', 'passed', `${label} 可用`);
      microphoneReady = true;
    } catch (error) {
      const name = (error as { name?: string }).name;
      const detail = name === 'NotAllowedError'
        ? '麦克风权限被拒绝，请在浏览器地址栏中允许访问'
        : '无法打开所选麦克风，请检查设备是否被其他程序占用';
      updateCheck('microphone', 'failed', detail);
    }

    let mediaReady = false;
    if (socketReady) {
      try {
        const capabilities = await getRtpCapabilities();
        updateCheck('media', capabilities ? 'passed' : 'failed', capabilities ? '语音媒体服务响应正常' : '媒体服务未返回能力信息');
        mediaReady = !!capabilities;
      } catch (error) {
        updateCheck('media', 'failed', (error as Error).message || '媒体服务不可用');
      }
    } else {
      updateCheck('media', 'failed', '服务器未连接，无法检查媒体服务');
    }

    setRunning(false);
    return secure && socketReady && microphoneReady && mediaReady;
  }, [selectedInput, updateCheck]);

  const canContinue = checks.every((check) => check.status === 'passed');
  return { checks, running, canContinue, runChecks };
}
