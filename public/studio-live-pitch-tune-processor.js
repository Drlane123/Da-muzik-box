/**
 * Live Pitch Tune — AudioWorklet ring-buffer pitch shifter.
 * Loaded from /studio-live-pitch-tune-processor.js
 */
class StudioLivePitchTuneProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'pitchRatio',
        defaultValue: 1,
        minValue: 0.5,
        maxValue: 2,
        automationRate: 'k-rate',
      },
      {
        name: 'mix',
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
    ];
  }

  constructor() {
    super();
    this.ringSize = 16384;
    this.ring = new Float32Array(this.ringSize);
    this.writeIdx = 0;
    this.readIdx = 0;
    this.initialized = false;
    this.silenceHold = 0;
    this.delaySamples = 2048;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!output) return true;
    const ratio = Math.max(0.5, Math.min(2, parameters.pitchRatio[0] ?? 1));
    const mix = Math.max(0, Math.min(1, parameters.mix[0] ?? 1));
    const SILENCE = 0.00012;
    const SILENCE_FRAMES = 6;
    const rs = this.ringSize;
    const delay = this.delaySamples;

    if (!input || input.length === 0) {
      output.fill(0);
      this.silenceHold = SILENCE_FRAMES;
      return true;
    }

    let wi = this.writeIdx;
    let ri = this.readIdx;

    if (!this.initialized) {
      ri = (wi - delay + rs) % rs;
      this.initialized = true;
    }

    for (let i = 0; i < output.length; i++) {
      const dry = input[i] ?? 0;
      const absDry = Math.abs(dry);

      if (absDry < SILENCE) {
        this.silenceHold = Math.min(SILENCE_FRAMES, this.silenceHold + 1);
      } else {
        this.silenceHold = 0;
      }

      this.ring[wi] = dry;
      wi = (wi + 1) % rs;

      /* mix≈0 or silence → dry pass-through (never mute the lane) */
      if (mix < 0.001 || this.silenceHold >= SILENCE_FRAMES) {
        output[i] = dry;
        if (this.silenceHold >= SILENCE_FRAMES) {
          ri = (wi - delay + rs) % rs;
        }
        continue;
      }

      /* Linear interpolate for fractional read (smoother than nearest). */
      const riFloor = Math.floor(ri);
      const frac = ri - riFloor;
      const i0 = ((riFloor % rs) + rs) % rs;
      const i1 = (i0 + 1) % rs;
      const sample = (this.ring[i0] ?? 0) * (1 - frac) + (this.ring[i1] ?? 0) * frac;
      output[i] = dry * (1 - mix) + sample * mix;

      ri += ratio;
      if (ri >= rs) ri -= rs;
      if (ri < 0) ri += rs;

      /* Keep read a fixed delay behind write — prevents pointer collapse / runaway. */
      let behind = wi - ri;
      if (behind < 0) behind += rs;
      if (behind < delay * 0.35 || behind > delay * 2.5) {
        ri = (wi - delay + rs) % rs;
      }
    }

    this.writeIdx = wi;
    this.readIdx = ri;
    return true;
  }
}

registerProcessor('studio-live-pitch-tune', StudioLivePitchTuneProcessor);
