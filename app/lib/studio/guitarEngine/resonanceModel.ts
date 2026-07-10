/**
 * Physical modeling layer — body resonance + sympathetic string coupling.
 * Runs under the sample engine (not generic sine waves).
 */
function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function scheduleNoiseBurst(
  ctx: AudioContext,
  destination: AudioNode,
  when: number,
  durationSec: number,
  gain: number,
  filterHz: number,
): void {
  if (gain <= 0.0001) return;
  const len = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) {
    ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 1.8;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bpf = ctx.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = filterHz;
  bpf.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(gain, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when + durationSec);
  src.connect(bpf).connect(g).connect(destination);
  src.start(when);
  src.stop(when + durationSec + 0.02);
}

/** Karplus-Strong body mode — wooden top resonance. */
export function scheduleGuitarBodyResonance(
  ctx: AudioContext,
  destination: AudioNode,
  when: number,
  midi: number,
  velocity127: number,
  durationSec: number,
  gainScale = 1,
): void {
  const fund = midiToHz(midi);
  const vel = velocity127 / 127;
  const peak = 0.048 * vel * gainScale;
  const len = Math.min(Math.floor(ctx.sampleRate * 0.2), 8192);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  const delay = Math.max(2, Math.round(ctx.sampleRate / fund));
  for (let i = 0; i < len; i += 1) {
    const n = (Math.random() * 2 - 1) * (i < 8 ? 1 : 0.35);
    ch[i] = i < delay ? n : ch[i - delay]! * 0.996 + n * 0.04;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = Math.min(4400, fund * 6.5);
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + Math.min(durationSec, 0.6));
  src.connect(lpf).connect(g).connect(destination);
  src.start(when);
  src.stop(when + Math.min(durationSec, 0.6) + 0.05);
}

/** Sympathetic buzz on adjacent strings when a note rings. */
export function scheduleGuitarSympatheticStrings(
  ctx: AudioContext,
  destination: AudioNode,
  when: number,
  midi: number,
  velocity127: number,
  durationSec: number,
): void {
  const vel = velocity127 / 127;
  for (const off of [-5, -7, 5, 7]) {
    const symMidi = midi + off;
    if (symMidi < 36 || symMidi > 96) continue;
    scheduleGuitarBodyResonance(
      ctx,
      destination,
      when + 0.004,
      symMidi,
      Math.round(velocity127 * 0.22),
      durationSec * 0.65,
      0.18 * vel,
    );
  }
}

export type GuitarPerformanceNoiseOpts = {
  stroke?: boolean;
  release?: boolean;
  palmMute?: boolean;
  legatoSkipStroke?: boolean;
};

export function scheduleGuitarPerformanceNoise(
  ctx: AudioContext,
  destination: AudioNode,
  when: number,
  tEnd: number,
  midi: number,
  velocity127: number,
  opts: GuitarPerformanceNoiseOpts,
): void {
  const vel = velocity127 / 127;
  const hz = midiToHz(midi);

  if (opts.stroke !== false && !opts.legatoSkipStroke) {
    const g = opts.palmMute ? 0.1 : 0.058;
    scheduleNoiseBurst(ctx, destination, when, 0.03, g * vel, hz * 1.9);
  }

  if (opts.release !== false && tEnd - when > 0.1) {
    scheduleNoiseBurst(ctx, destination, tEnd - 0.018, 0.05, 0.028 * vel, 1600 + (midi % 7) * 90);
  }
}
