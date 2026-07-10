/**
 * VocalBox vocoder carrier — FL Vocodex-style band-limited synth (full-spectrum carrier).
 * Modulator envelope comes from phoneme band profiles in {@link grooveLabVocalBoxSpeech}.
 */

/** Band centers (Hz) — classic 16-band vocoder layout. */
export const VOCALBOX_VOCODER_BANDS_HZ = [
  160, 240, 360, 540, 800, 1200, 1700, 2400, 3200, 4200, 5200, 6400,
] as const;

export type VocalBoxBandProfile = readonly number[];

/** Phoneme-code → per-band openness (0–1) for vocoder gating. */
export function vocalBoxPhonemeBandProfile(code: string): VocalBoxBandProfile {
  const c = code.toUpperCase();
  const vowelLow = ['AA', 'AE', 'AH', 'EH', 'ER', 'AR', 'AW'].includes(c);
  const vowelMid = ['IH', 'IY', 'EY', 'OW', 'OY', 'UH', 'UW'].includes(c);
  const highFric = ['S', 'Z', 'SH', 'CH', 'TH', 'F', 'V', 'HH'].includes(c);
  const stop = ['B', 'P', 'D', 'T', 'G', 'K', 'JH'].includes(c);
  const nasal = ['M', 'N', 'NG'].includes(c);
  const liquid = ['L', 'R', 'W', 'Y'].includes(c);

  return VOCALBOX_VOCODER_BANDS_HZ.map((hz, i) => {
    const t = i / (VOCALBOX_VOCODER_BANDS_HZ.length - 1);
    if (highFric) return t > 0.45 ? 0.55 + t * 0.45 : 0.12;
    if (stop) return t < 0.35 ? 0.35 : t > 0.5 ? 0.4 : 0.55;
    if (nasal || liquid) return t < 0.55 ? 0.5 + (0.5 - t) * 0.35 : 0.25;
    if (vowelLow) return t < 0.42 ? 0.85 - t * 0.5 : t < 0.7 ? 0.55 : 0.2;
    if (vowelMid) return t < 0.25 ? 0.45 : t < 0.65 ? 0.75 : 0.35;
    return 0.35 + (1 - Math.abs(t - 0.4)) * 0.4;
  });
}

export function vocalBoxBlendBandProfiles(profiles: VocalBoxBandProfile[]): VocalBoxBandProfile {
  if (profiles.length === 0) {
    return VOCALBOX_VOCODER_BANDS_HZ.map(() => 0.4);
  }
  const out = new Array<number>(VOCALBOX_VOCODER_BANDS_HZ.length).fill(0);
  for (const p of profiles) {
    for (let i = 0; i < out.length; i++) {
      out[i] += (p[i] ?? 0.3) / profiles.length;
    }
  }
  return out;
}

/** Rich harmonic carrier (saw + square + breath noise) — FL recommends full-range carrier. */
export function scheduleVocalBoxVocoderCarrier(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  dur: number,
  f0: number,
  vel: number,
  bandProfile: VocalBoxBandProfile,
  vocoderMix: number,
): () => void {
  const t0 = when;
  const t1 = when + dur;
  const mix = Math.max(0, Math.min(1, vocoderMix));
  if (mix < 0.04) return () => {};

  const stoppers: Array<() => void> = [];

  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.setValueAtTime(Math.max(50, f0), t0);

  const square = ctx.createOscillator();
  square.type = 'square';
  square.frequency.setValueAtTime(Math.max(50, f0), t0);
  square.detune.setValueAtTime(7, t0);

  const noise = ctx.createBufferSource();
  const nLen = Math.max(1, Math.floor(ctx.sampleRate * (dur + 0.05)));
  const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
  const nCh = nBuf.getChannelData(0);
  for (let i = 0; i < nLen; i++) nCh[i] = Math.random() * 2 - 1;
  noise.buffer = nBuf;

  const carrierBus = ctx.createGain();
  carrierBus.gain.value = 0.22 * vel * mix;

  const sawG = ctx.createGain();
  sawG.gain.value = 0.55;
  const sqG = ctx.createGain();
  sqG.gain.value = 0.28;
  const nG = ctx.createGain();
  nG.gain.value = 0.12;

  saw.connect(sawG);
  square.connect(sqG);
  noise.connect(nG);
  sawG.connect(carrierBus);
  sqG.connect(carrierBus);
  nG.connect(carrierBus);

  const outEnv = ctx.createGain();
  outEnv.gain.setValueAtTime(0.0001, t0);
  outEnv.gain.exponentialRampToValueAtTime(1, t0 + 0.012);
  outEnv.gain.setValueAtTime(1, Math.max(t0 + 0.012, t1 - 0.04));
  outEnv.gain.exponentialRampToValueAtTime(0.0001, t1);

  for (let bi = 0; bi < VOCALBOX_VOCODER_BANDS_HZ.length; bi++) {
    const hz = VOCALBOX_VOCODER_BANDS_HZ[bi]!;
    const open = Math.max(0.05, Math.min(1, bandProfile[bi] ?? 0.35));

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hz;
    bp.Q.value = 5.5;

    const bandGain = ctx.createGain();
    bandGain.gain.value = open;

    carrierBus.connect(bp);
    bp.connect(bandGain);
    bandGain.connect(outEnv);
  }

  outEnv.connect(dest);

  saw.start(t0);
  square.start(t0);
  noise.start(t0);
  saw.stop(t1 + 0.02);
  square.stop(t1 + 0.02);
  noise.stop(t1 + 0.02);

  stoppers.push(() => {
    for (const o of [saw, square, noise]) {
      try {
        o.stop();
      } catch {
        /* */
      }
    }
  });

  return () => {
    for (const fn of stoppers) fn();
  };
}

const rectifierCurveCache = new WeakMap<AudioContext, Float32Array>();

function absRectifierCurve(ctx: AudioContext): Float32Array {
  let c = rectifierCurveCache.get(ctx);
  if (c) return c;
  c = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * 2 - 1;
    c[i] = Math.abs(x);
  }
  rectifierCurveCache.set(ctx, c);
  return c;
}

export type VocalBoxLiveVocoderOpts = {
  dryMix: number;
  vocoderMix: number;
};

/**
 * True multiband vocoder — modulator = spoken audio, carrier = synth @ target pitch.
 * This is the FL Speech Synth / VocalBox robot chain the user asked for.
 */
export function scheduleVocalBoxLiveVocoder(
  ctx: AudioContext,
  dest: AudioNode,
  modulator: AudioBufferSourceNode,
  when: number,
  dur: number,
  carrierHz: number,
  vel: number,
  robotMix: number,
  opts: VocalBoxLiveVocoderOpts,
): () => void {
  const t0 = when;
  const t1 = when + dur;
  const mix = Math.max(0, Math.min(1, opts.vocoderMix));
  const dry = Math.max(0, Math.min(1, opts.dryMix));
  if (mix < 0.03 && dry < 0.03) return () => {};

  const stoppers: Array<() => void> = [];

  if (dry > 0.02) {
    const dryG = ctx.createGain();
    dryG.gain.value = vel * dry * 0.55;
    modulator.connect(dryG);
    dryG.connect(dest);
  }

  if (mix >= 0.03) {
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(Math.max(50, carrierHz), t0);

    const square = ctx.createOscillator();
    square.type = 'square';
    square.frequency.setValueAtTime(Math.max(50, carrierHz), t0);
    square.detune.setValueAtTime(6 + robotMix * 14, t0);

    const carrierBus = ctx.createGain();
    carrierBus.gain.value = 0.38 * vel * mix;

    const sawG = ctx.createGain();
    sawG.gain.value = 0.62;
    const sqG = ctx.createGain();
    sqG.gain.value = 0.22 + robotMix * 0.18;
    saw.connect(sawG);
    square.connect(sqG);
    sawG.connect(carrierBus);
    sqG.connect(carrierBus);

    const outEnv = ctx.createGain();
    outEnv.gain.setValueAtTime(0.0001, t0);
    outEnv.gain.exponentialRampToValueAtTime(1, t0 + 0.014);
    outEnv.gain.setValueAtTime(1, Math.max(t0 + 0.014, t1 - 0.05));
    outEnv.gain.exponentialRampToValueAtTime(0.0001, t1);

    for (let bi = 0; bi < VOCALBOX_VOCODER_BANDS_HZ.length; bi++) {
      const hz = VOCALBOX_VOCODER_BANDS_HZ[bi]!;

      const modBp = ctx.createBiquadFilter();
      modBp.type = 'bandpass';
      modBp.frequency.value = hz;
      modBp.Q.value = 4.5;

      const rectifier = ctx.createWaveShaper();
      rectifier.curve = absRectifierCurve(ctx);

      const envLp = ctx.createBiquadFilter();
      envLp.type = 'lowpass';
      envLp.frequency.value = 28 + robotMix * 22;
      envLp.Q.value = 0.7;

      const carBp = ctx.createBiquadFilter();
      carBp.type = 'bandpass';
      carBp.frequency.value = hz;
      carBp.Q.value = 5;

      const bandGain = ctx.createGain();
      bandGain.gain.value = 0.0001;

      modulator.connect(modBp);
      modBp.connect(rectifier);
      rectifier.connect(envLp);
      envLp.connect(bandGain.gain);

      carrierBus.connect(carBp);
      carBp.connect(bandGain);
      bandGain.connect(outEnv);
    }

    outEnv.connect(dest);

    saw.start(t0);
    square.start(t0);
    saw.stop(t1 + 0.02);
    square.stop(t1 + 0.02);
    stoppers.push(() => {
      for (const o of [saw, square]) {
        try {
          o.stop();
        } catch {
          /* */
        }
      }
    });
  }

  return () => {
    for (const fn of stoppers) fn();
  };
}
