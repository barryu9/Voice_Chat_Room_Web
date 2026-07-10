import { useMediaStore } from '../stores/mediaStore';

let timer: ReturnType<typeof window.setInterval> | null = null;
let appliedBitrate = 64000;

export function stopAudioQualityMonitor() {
  if (timer) window.clearInterval(timer);
  timer = null;
}

export function startAudioQualityMonitor(producer: any) {
  stopAudioQualityMonitor();
  const update = async () => {
    try {
      const stats: RTCStatsReport = await producer.getStats();
      let outbound: any;
      let remoteInbound: any;
      stats.forEach((item: any) => {
        if (item.type === 'outbound-rtp' && item.kind === 'audio') outbound = item;
        if (item.type === 'remote-inbound-rtp' && item.kind === 'audio') remoteInbound = item;
      });
      if (!outbound) return;
      const packets = remoteInbound?.packetsReceived || outbound.packetsSent || 0;
      const lost = remoteInbound?.packetsLost || 0;
      const loss = packets ? (lost / (packets + lost)) * 100 : 0;
      const rtt = (remoteInbound?.roundTripTime || outbound.roundTripTime || 0) * 1000;
      const target = loss > 8 || rtt > 450 ? 24000 : loss > 3 || rtt > 250 ? 40000 : 64000;
      useMediaStore.getState().setAudioQuality({ loss, rtt, bitrate: target, quality: target === 64000 ? '良好' : target === 40000 ? '一般' : '较差' });
      if (target === appliedBitrate) return;
      const sender = producer.rtpSender as RTCRtpSender | undefined;
      if (!sender) return;
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = target;
      await sender.setParameters(params);
      appliedBitrate = target;
    } catch { /* stats and sender parameters are browser-dependent */ }
  };
  update();
  timer = window.setInterval(update, 3000);
}
