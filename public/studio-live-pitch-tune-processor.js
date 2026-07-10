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
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!output) return true;
    const ratio = Math.max(0.5, Math.min(2, parameters.pitchRatio[0] ?? 1));
    const mix = Math.max(0, Math.min(1, parameters.mix[0] ?? 1));
    const SILENCE = 0.00012;
    const SILENCE_FRAMES = 6;

    if (!input || input.length === 0) {
      output.fill(0);
      this.silenceHold = SILENCE_FRAMES;
      return true;
    }

    const rs = this.ringSize;
    let wi = this.writeIdx;
    let ri = this.readIdx;

    if (!this.initialized) {
      ri = (wi - 2048 + rs) % rs;
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

      if (this.silenceHold >= SILENCE_FRAMES || mix < 0.001) {
        output[i] = 0;
        this.ring[wi] = 0;
        wi = (wi + 1) % rs;
        if (this.silenceHold >= SILENCE_FRAMES) {
          ri = (wi - 2048 + rs) % rs;
        }
        continue;
      }

      this.ring[wi] = dry;
      wi = (wi + 1) % rs;

      const sample = this.ring[Math.floor(ri) % rs] ?? 0;
      output[i] = dry * (1 - mix) + sample * mix;

      ri += ratio;
      if (ri >= rs) ri -= rs;
      if (ri < 0) ri += rs;
    }

    this.writeIdx = wi;
    this.readIdx = ri;
    return true;
  }
}

registerProcessor('studio-live-pitch-tune', StudioLivePitchTuneProcessor);
