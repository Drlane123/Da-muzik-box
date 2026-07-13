/**
 * SE2 808 Lab — lightweight Web Audio snare / clap (classic snappy TR-808 character).
 */
function softClip(x: number): number {
  return Math.tanh(x);
}

export function playSe2Lab808Snare(
  ctx: AudioContext,
  dest: AudioNode,
  whenSec: number,
  velocity01 = 0.9,
): void {
  const t = Math.max(whenSec, ctx.currentTime + 0.001);
  const vel = Math.max(0.08, Math.min(1.2, velocity01));
  const ny = ctx.sampleRate * 0.45;

  const len = Math.floor(ctx.sampleRate * 0.16);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = Math.pow(1 - i / len, 2.1);
    data[i] = softClip((Math.random() * 2 - 1) * env * 1.35);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(Math.min(920, ny), t);
  hp.Q.setValueAtTime(0.7, t);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(Math.min(1800, ny), t);
  bp.Q.setValueAtTime(0.85, t);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(0.62 * vel, t + 0.002);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

  const tone = ctx.createOscillator();
  tone.type = 'triangle';
  tone.frequency.setValueAtTime(210, t);
  tone.frequency.exponentialRampToValueAtTime(140, t + 0.05);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, t);
  tg.gain.exponentialRampToValueAtTime(0.28 * vel, t + 0.002);
  tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);

  noise.connect(hp);
  hp.connect(bp);
  bp.connect(ng);
  ng.connect(dest);
  tone.connect(tg);
  tg.connect(dest);
  noise.start(t);
  tone.start(t);
  noise.stop(t + 0.18);
  tone.stop(t + 0.09);
}

export function playSe2Lab808Clap(
  ctx: AudioContext,
  dest: AudioNode,
  whenSec: number,
  velocity01 = 0.9,
): void {
  const t0 = Math.max(whenSec, ctx.currentTime + 0.001);
  const vel = Math.max(0.08, Math.min(1.2, velocity01));
  const ny = ctx.sampleRate * 0.45;

  for (let burst = 0; burst < 4; burst++) {
    const t = t0 + burst * 0.011;
    const len = Math.floor(ctx.sampleRate * 0.045);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.4);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(Math.min(1100 + burst * 80, ny), t);
    bp.Q.setValueAtTime(1.1, t);
    const g = ctx.createGain();
    const peak = (0.26 - burst * 0.035) * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.04, peak), t + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    src.connect(bp);
    bp.connect(g);
    g.connect(dest);
    src.start(t);
    src.stop(t + 0.07);
  }
}

export function previewSe2Lab808Perc(
  ctx: AudioContext,
  dest: AudioNode,
  lane: 'snare' | 'clap',
  velocity01 = 0.95,
): void {
  const when = ctx.currentTime + 0.008;
  if (lane === 'snare') playSe2Lab808Snare(ctx, dest, when, velocity01);
  else playSe2Lab808Clap(ctx, dest, when, velocity01);
}
