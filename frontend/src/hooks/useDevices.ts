import { useState, useCallback, useRef, useEffect } from 'react';

interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: string;
}

export function useDevices() {
  const [audioInputs, setAudioInputs] = useState<DeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<DeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [selectedOutput, setSelectedOutput] = useState<string>('');
  const currentStreamRef = useRef<MediaStream | null>(null);

  const enumerate = useCallback(async () => {
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

    if (inputs.length > 0 && !selectedInput) setSelectedInput(inputs[0].deviceId);
    if (outputs.length > 0 && !selectedOutput) setSelectedOutput(outputs[0].deviceId);
  }, [selectedInput, selectedOutput]);

  const getStream = useCallback(async (deviceId?: string): Promise<MediaStream> => {
    if (currentStreamRef.current) {
      currentStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: deviceId ? { exact: deviceId } : undefined },
      video: false,
    });
    currentStreamRef.current = stream;
    return stream;
  }, []);

  const getTrack = useCallback(async (deviceId?: string): Promise<MediaStreamTrack> => {
    const stream = await getStream(deviceId);
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
