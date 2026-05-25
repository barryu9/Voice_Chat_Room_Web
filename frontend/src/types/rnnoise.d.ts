declare module 'simple-rnnoise-wasm' {
  export class RNNoiseNode extends AudioWorkletNode {
    constructor(context: AudioContext);
    static register(
      ctx: AudioContext,
      options?: {
        scriptSrc?: string;
        moduleSrc?: string | WebAssembly.Module;
      }
    ): Promise<void>;
    update(enabled: boolean): void;
    onstatus: ((e: Event & { vadProb?: number }) => void) | null;
  }
}

declare module 'simple-rnnoise-wasm/rnnoise.worklet.js?url' {
  const url: string;
  export default url;
}

declare module 'simple-rnnoise-wasm/rnnoise.wasm?url' {
  const url: string;
  export default url;
}
