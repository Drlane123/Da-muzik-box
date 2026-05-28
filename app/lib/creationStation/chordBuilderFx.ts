/**
 * Chord Builder FX bus — delay, low-cut (highpass), high-cut (lowpass).
 */

export interface ChordDelaySettings {
  enabled: boolean;
  /** Echo time in ms. */
  timeMs: number;
  /** 0–0.85 feedback. */
  feedback: number;
  /** 0–1 wet mix. */
  mix: number;
}

export interface ChordFilterSettings {
  enabled: boolean;
  /** High-pass = low cut (removes mud below this Hz). */
  lowCutHz: number;
  /** Low-pass = high cut (removes harshness above this Hz). */
  highCutHz: number;
}

export interface ChordBuilderFxSettings {
  delay: ChordDelaySettings;
  filter: ChordFilterSettings;
}

export const DEFAULT_CHORD_BUILDER_FX: ChordBuilderFxSettings = {
  delay: { enabled: false, timeMs: 380, feedback: 0.35, mix: 0.32 },
  filter: { enabled: true, lowCutHz: 90, highCutHz: 8200 },
};

export type ChordFxBus = {
  ctx: BaseAudioContext;
  input: GainNode;
  update: (settings: ChordBuilderFxSettings) => void;
  dispose: () => void;
};

export function createChordFxBus(
  ctx: BaseAudioContext,
  destination: AudioNode,
): ChordFxBus {
  const input = ctx.createGain();
  input.gain.value = 1;

  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.Q.value = 0.7;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.Q.value = 0.7;

  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const delay = ctx.createDelay(2.5);
  const feedback = ctx.createGain();

  input.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(dry);
  dry.connect(destination);

  lowpass.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(destination);

  const update = (settings: ChordBuilderFxSettings) => {
    const f = settings.filter;
    if (f.enabled) {
      highpass.frequency.value = Math.max(20, Math.min(800, f.lowCutHz));
      lowpass.frequency.value = Math.max(400, Math.min(18000, f.highCutHz));
      highpass.gain.value = 0;
      lowpass.gain.value = 0;
    } else {
      highpass.frequency.value = 20;
      lowpass.frequency.value = 20000;
    }

    const d = settings.delay;
    if (d.enabled) {
      const t = Math.max(0.02, Math.min(1500, d.timeMs)) / 1000;
      delay.delayTime.value = t;
      feedback.gain.value = Math.max(0, Math.min(0.88, d.feedback));
      const mix = Math.max(0, Math.min(1, d.mix));
      wet.gain.value = mix;
      dry.gain.value = 1 - mix * 0.35;
    } else {
      wet.gain.value = 0;
      dry.gain.value = 1;
      feedback.gain.value = 0;
    }
  };

  update(DEFAULT_CHORD_BUILDER_FX);

  return {
    ctx,
    input,
    update,
    dispose: () => {
      try {
        input.disconnect();
        highpass.disconnect();
        lowpass.disconnect();
        dry.disconnect();
        wet.disconnect();
        delay.disconnect();
        feedback.disconnect();
      } catch {
        /* noop */
      }
    },
  };
}

/** Offline / simple render: extra delay taps (no feedback loop in offline graph). */
export function delayTapOffsetsSec(
  settings: ChordDelaySettings,
  maxTaps = 3,
): number[] {
  if (!settings.enabled) return [];
  const t0 = Math.max(0.02, settings.timeMs / 1000);
  const taps: number[] = [];
  let t = t0;
  let gain = settings.feedback;
  for (let i = 0; i < maxTaps && gain > 0.08; i++) {
    taps.push(t);
    t += t0;
    gain *= settings.feedback;
  }
  return taps;
}
