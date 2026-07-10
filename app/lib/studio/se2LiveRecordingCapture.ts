/**
 * Live PCM tap during SE2 record — cheap per-chunk peaks for timeline waveform preview.
 * Taps the existing input-monitor fanout (no second MediaStreamSource).
 */

type ChannelChunks = Float32Array[];

export class Se2LiveRecordingCapture {
  private readonly ctx: AudioContext;
  private readonly chunks: ChannelChunks;
  private readonly chunkPeaks: number[] = [];
  private readonly numChannels = 2;
  private processor: ScriptProcessorNode | null = null;
  private silent: GainNode | null = null;
  private totalSamples = 0;
  private stopped = false;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.chunks = Array.from({ length: this.numChannels }, () => []);
  }

  /** Tap an existing monitor node — returns false if preview unavailable (record still works). */
  startFromTap(sourceNode: AudioNode): boolean {
    if (this.stopped || this.processor) return true;
    try {
      this.processor = this.ctx.createScriptProcessor(4096, 2, 2);
      this.silent = this.ctx.createGain();
      this.silent.gain.value = 0;

      this.processor.onaudioprocess = (e) => {
        if (this.stopped) return;
        const inBuf = e.inputBuffer;
        const n = inBuf.length;
        if (n <= 0) return;

        const ch0 = inBuf.getChannelData(0);
        const ch1 = inBuf.numberOfChannels > 1 ? inBuf.getChannelData(1) : ch0;
        let peak = 0;
        for (let i = 0; i < n; i += 1) {
          peak = Math.max(peak, Math.abs(ch0[i]!), Math.abs(ch1[i]!));
        }
        this.chunkPeaks.push(peak);
        this.chunks[0]!.push(Float32Array.from(ch0));
        this.chunks[1]!.push(Float32Array.from(ch1));
        this.totalSamples += n;
      };

      sourceNode.connect(this.processor);
      this.processor.connect(this.silent);
      this.silent.connect(this.ctx.destination);
      return true;
    } catch (e) {
      console.warn('[SE2 Record] Live waveform tap failed', e);
      this.stop();
      return false;
    }
  }

  get sampleCount(): number {
    return this.totalSamples;
  }

  /** Normalized 0–1 peaks — one bucket per audio processing block (cheap for live paint). */
  getLivePeaks(): number[] {
    if (this.chunkPeaks.length === 0) return [];
    const mx = Math.max(0.001, ...this.chunkPeaks);
    return this.chunkPeaks.map((p) => Math.min(1, p / mx));
  }

  buildBuffer(): AudioBuffer | null {
    if (this.totalSamples <= 0) return null;
    const len = this.totalSamples;
    const buf = this.ctx.createBuffer(this.numChannels, len, this.ctx.sampleRate);
    for (let c = 0; c < this.numChannels; c += 1) {
      buf.copyToChannel(this.mergeChannel(c), c);
    }
    return buf;
  }

  stop(): void {
    this.stopped = true;
    try {
      this.processor?.disconnect();
    } catch {
      /* */
    }
    try {
      this.silent?.disconnect();
    } catch {
      /* */
    }
    this.processor = null;
    this.silent = null;
  }

  private mergeChannel(ch: number): Float32Array {
    const parts = this.chunks[ch]!;
    if (parts.length === 0) return new Float32Array(0);
    if (parts.length === 1) return parts[0]!;
    const out = new Float32Array(this.totalSamples);
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.length;
    }
    return out;
  }
}

export type Se2LiveRecordUiSession = {
  sourceId: string;
  clipId: string;
  trackIndex: number;
  startBeat: number;
  capture: Se2LiveRecordingCapture;
  lastUiTickMs: number;
  previewEnabled: boolean;
};
