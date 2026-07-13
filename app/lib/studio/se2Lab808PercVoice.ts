/**
 * SE2 808 Lab — tight snappy TR-808-style snare + louder clap (preview/timing only — not exported).
 */
function softClip(x: number): number {
  return Math.tanh(x);
}

type PercVoiceHandle = { stop: (cutT: number) => void };
let activeSnareVoice: PercVoiceHandle | null = null;
let activeClapVoice: PercVoiceHandle | null = null;

function truncatePercVoice(handle: PercVoiceHandle | null, cutT: number): void {
  if (!handle) return;
  try {
    handle.stop(cutT);
  } catch {
    /* already stopped */
  }
}

/** Tight 808 snare — short noise crack + brief body, loud snap (not a long loft snare). */
export function playSe2Lab808Snare(
  ctx: AudioContext,
  dest: AudioNode,
  whenSec: number,
  velocity01 = 1,
): void {
  const t = Math.max(whenSec, ctx.currentTime + 0.001);
  const vel = Math.max(0.12, Math.min(1.35, velocity01 * 1.2));
  const ny = ctx.sampleRate * 0.45;

  truncatePercVoice(activeSnareVoice, t);
  const stoppable: AudioScheduledSourceNode[] = [];

  // Noise crack — short, bright, loud
  const noiseLen = Math.floor(ctx.sampleRate * 0.085);
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseLen; i++) {
    const env = Math.pow(1 - i / noiseLen, 3.2);
    nd[i] = softClip((Math.random() * 2 - 1) * env * 1.8);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(Math.min(1400, ny), t);
  hp.Q.setValueAtTime(0.65, t);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(Math.min(3200, ny), t);
  bp.Q.setValueAtTime(1.15, t);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(0.95 * vel, t + 0.0012);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);
  noise.connect(hp);
  hp.connect(bp);
  bp.connect(ng);
  ng.connect(dest);
  noise.start(t);
  noise.stop(t + 0.09);
  stoppable.push(noise);

  // Body thump — very short so it snaps, not rings
  const tone = ctx.createOscillator();
  tone.type = 'triangle';
  tone.frequency.setValueAtTime(235, t);
  tone.frequency.exponentialRampToValueAtTime(155, t + 0.028);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, t);
  tg.gain.exponentialRampToValueAtTime(0.55 * vel, t + 0.001);
  tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  tone.connect(tg);
  tg.connect(dest);
  tone.start(t);
  tone.stop(t + 0.055);
  stoppable.push(tone);

  // Extra click transient for 808 snap
  const clickLen = Math.floor(ctx.sampleRate * 0.012);
  const clickBuf = ctx.createBuffer(1, clickLen, ctx.sampleRate);
  const cd = clickBuf.getChannelData(0);
  for (let i = 0; i < clickLen; i++) {
    cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / clickLen, 4);
  }
  const click = ctx.createBufferSource();
  click.buffer = clickBuf;
  const chp = ctx.createBiquadFilter();
  chp.type = 'highpass';
  chp.frequency.setValueAtTime(Math.min(4500, ny), t);
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.0001, t);
  cg.gain.exponentialRampToValueAtTime(0.42 * vel, t + 0.0006);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
  click.connect(chp);
  chp.connect(cg);
  cg.connect(dest);
  click.start(t);
  click.stop(t + 0.025);
  stoppable.push(click);

  activeSnareVoice = {
    stop(cutT) {
      const end = cutT + 0.012;
      for (const src of stoppable) {
        try {
          src.stop(end);
        } catch {
          /* already stopped */
        }
      }
    },
  };
}

/** Louder multi-burst hand clap — still short so loops stay clean. */
export function playSe2Lab808Clap(
  ctx: AudioContext,
  dest: AudioNode,
  whenSec: number,
  velocity01 = 1,
): void {
  const t0 = Math.max(whenSec, ctx.currentTime + 0.001);
  const vel = Math.max(0.12, Math.min(1.35, velocity01 * 1.25));
  const ny = ctx.sampleRate * 0.45;

  truncatePercVoice(activeClapVoice, t0);
  const stoppable: AudioScheduledSourceNode[] = [];

  for (let burst = 0; burst < 3; burst++) {
    const t = t0 + burst * 0.01;
    const len = Math.floor(ctx.sampleRate * 0.038);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = softClip((Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.85) * 1.5);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(Math.min(1250 + burst * 120, ny), t);
    bp.Q.setValueAtTime(1.25, t);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(Math.min(600, ny), t);
    const g = ctx.createGain();
    const peak = (0.48 - burst * 0.07) * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.08, peak), t + 0.0012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.048);
    src.connect(hp);
    hp.connect(bp);
    bp.connect(g);
    g.connect(dest);
    src.start(t);
    src.stop(t + 0.055);
    stoppable.push(src);
  }

  activeClapVoice = {
    stop(cutT) {
      const end = cutT + 0.01;
      for (const src of stoppable) {
        try {
          src.stop(end);
        } catch {
          /* already stopped */
        }
      }
    },
  };
}

export function previewSe2Lab808Perc(
  ctx: AudioContext,
  dest: AudioNode,
  lane: 'snare' | 'clap',
  velocity01 = 1,
): void {
  const when = ctx.currentTime + 0.008;
  if (lane === 'snare') playSe2Lab808Snare(ctx, dest, when, velocity01);
  else playSe2Lab808Clap(ctx, dest, when, velocity01);
}
