/**
 * Studio Editor 2 — DSP-thread meter (AudioWorklet render quantum).
 * Holds absolute peak + RMS and posts ~20 Hz. Idle/unused strips post silence once
 * then stay quiet — 64×60 Hz posts were flooding the main thread (play dropouts).
 */
class StudioChannelMeterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._peakL = 0;
    this._peakR = 0;
    this._rmsAccL = 0;
    this._rmsAccR = 0;
    this._rmsBlocks = 0;
    this._blocksSincePost = 0;
    this._postedSilence = false;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    const outL = output?.[0];
    if (!outL) return true;

    const inL = input?.[0];
    const inR = input?.[1] ?? inL;
    const outR = output[1] ?? outL;
    const n = outL.length;

    let peakL = 0;
    let peakR = 0;
    let sumSqL = 0;
    let sumSqR = 0;

    for (let i = 0; i < n; i++) {
      const l = inL?.[i] ?? 0;
      const r = inR?.[i] ?? l;
      const al = Math.abs(l);
      const ar = Math.abs(r);
      if (al > peakL) peakL = al;
      if (ar > peakR) peakR = ar;
      sumSqL += l * l;
      sumSqR += r * r;
      outL[i] = l;
      outR[i] = r;
    }

    if (peakL > this._peakL) this._peakL = peakL;
    if (peakR > this._peakR) this._peakR = peakR;
    this._rmsAccL += sumSqL / Math.max(1, n);
    this._rmsAccR += sumSqR / Math.max(1, n);
    this._rmsBlocks += 1;
    this._blocksSincePost += 1;

    // ~20 Hz — was 60 Hz × 64 strips and flooded the main thread (SE2 play dropouts).
    if (this._blocksSincePost >= 24) {
      const blocks = Math.max(1, this._rmsBlocks);
      const outPeakL = this._peakL;
      const outPeakR = this._peakR;
      const silent = outPeakL < 0.00025 && outPeakR < 0.00025;
      // Idle/unused strips: one silence post, then stay quiet until signal returns.
      if (silent && this._postedSilence) {
        this._peakL = 0;
        this._peakR = 0;
        this._rmsAccL = 0;
        this._rmsAccR = 0;
        this._rmsBlocks = 0;
        this._blocksSincePost = 0;
        return true;
      }
      this.port.postMessage({
        peakL: outPeakL,
        peakR: outPeakR,
        rmsL: Math.sqrt(this._rmsAccL / blocks),
        rmsR: Math.sqrt(this._rmsAccR / blocks),
      });
      this._postedSilence = silent;
      this._peakL = 0;
      this._peakR = 0;
      this._rmsAccL = 0;
      this._rmsAccR = 0;
      this._rmsBlocks = 0;
      this._blocksSincePost = 0;
    }

    return true;
  }
}

registerProcessor('studio-channel-meter', StudioChannelMeterProcessor);
