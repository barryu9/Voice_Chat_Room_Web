import { useState, useCallback, useRef, useEffect } from 'react';
import { useMediaStore } from '../stores/mediaStore';

interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: string;
}

interface StreamOptions {
  echoCancellation?: boolean;
  autoGainControl?: boolean;
}

export function getAudioInputConstraints(deviceId?: string, options: StreamOptions = {}): MediaTrackConstraints {
  const echoCancellation = options.echoCancellation ?? useMediaStore.getState().echoCancellationEnabled;
  return {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    echoCancellation,
    noiseSuppression: false,
    autoGainControl: false,
  };
}

export async function getUserAudioStream(deviceId?: string, options: StreamOptions = {}): Promise<MediaStream> {
  const requestedEchoCancellation = options.echoCancellation ?? useMediaStore.getState().echoCancellationEnabled;
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: getAudioInputConstraints(deviceId, options),
      video: false,
    });
  } catch (error) {
    const name = (error as { name?: string }).name;
    const constraint = (error as { constraint?: string }).constraint;
    if (requestedEchoCancellation && name === 'OverconstrainedError' && (!constraint || constraint === 'echoCancellation')) {
      console.warn('[Devices] echoCancellation constraint unsupported, retrying without it:', error);
      return navigator.mediaDevices.getUserMedia({
        audio: getAudioInputConstraints(deviceId, { ...options, echoCancellation: false }),
        video: false,
      });
    }
    throw error;
  }
}

export function useDevices() {
  const [audioInputs, setAudioInputs] = useState<DeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<DeviceInfo[]>([]);
  const [selectedInput, setSelectedInputState] = useState<string>(() => {
    return localStorage.getItem('vc_selected_input') || '';
  });
  const [selectedOutput, setSelectedOutputState] = useState<string>(() => {
    return localStorage.getItem('vc_selected_output') || '';
  });
  const currentStreamRef = useRef<MediaStream | null>(null);

  const setSelectedInput = useCallback((deviceId: string) => {
    setSelectedInputState(deviceId);
    localStorage.setItem('vc_selected_input', deviceId);
  }, []);

  const setSelectedOutput = useCallback((deviceId: string) => {
    setSelectedOutputState(deviceId);
    localStorage.setItem('vc_selected_output', deviceId);
  }, []);

  const enumerate = useCallback(async () => {
    try {
      const permStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      permStream.getTracks().forEach((t) => t.stop());
    } catch {
      // 用户拒绝权限，仍然可以列出设备（标签为空）
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs: DeviceInfo[] = [];
    const outputs: DeviceInfo[] = [];

    for (const d of devices) {
      if (d.kind === 'audioinput') {
        inputs.push({ deviceId: d.deviceId, label: d.label || `麦克风 ${inputs.length + 1}`, kind: 'audioinput' });
      } else if (d.kind === 'audiooutput') {
        outputs.push({ deviceId: d.deviceId, label: d.label || `扬声器 ${outputs.length + 1}`, kind: 'audiooutput' });
      }
    }

    setAudioInputs(inputs);
    setAudioOutputs(outputs);

    const savedInput = localStorage.getItem('vc_selected_input');
    const savedOutput = localStorage.getItem('vc_selected_output');
    const inputExists = inputs.some((d) => d.deviceId === savedInput);
    const outputExists = outputs.some((d) => d.deviceId === savedOutput);

    if (inputs.length > 0 && (!savedInput || !inputExists)) {
      setSelectedInput(inputs[0].deviceId);
    }
    if (outputs.length > 0 && (!savedOutput || !outputExists)) {
      setSelectedOutput(outputs[0].deviceId);
    }
  }, [setSelectedInput, setSelectedOutput]);

  const getStream = useCallback(async (deviceId?: string, options?: StreamOptions): Promise<MediaStream> => {
    if (currentStreamRef.current) {
      currentStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    const stream = await getUserAudioStream(deviceId, options);
    currentStreamRef.current = stream;
    return stream;
  }, []);

  const getTrack = useCallback(async (deviceId?: string, options?: StreamOptions): Promise<MediaStreamTrack> => {
    const stream = await getStream(deviceId, options);
    return stream.getAudioTracks()[0];
  }, [getStream]);

  const cleanup = useCallback(() => {
    if (currentStreamRef.current) {
      currentStreamRef.current.getTracks().forEach((t) => t.stop());
      currentStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    enumerate();
    navigator.mediaDevices.addEventListener('devicechange', enumerate);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', enumerate);
      cleanup();
    };
  }, [enumerate, cleanup]);

  return {
    audioInputs,
    audioOutputs,
    selectedInput,
    selectedOutput,
    setSelectedInput,
    setSelectedOutput,
    enumerate,
    getStream,
    getTrack,
    cleanup,
  };
}
