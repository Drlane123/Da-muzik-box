/**
 * SE2 Beat Pads dock VU — hit-synced pulses + per-voice analyser follow-through.
 *
 * AnalyserNode alone lags (~fft buffer + smoothing). Pulses fire at the same
 * AudioContext time as the sample start so the needle matches the kick.
 */

type VuTap = {
  analyser: AnalyserNode;
  pan: number;
  when: number;
  until: number;
};

type VuPulse = {
  ctx: BaseAudioContext;
  when: number;
  until: number;
  peak: number;
  pan: number;
};

const taps: VuTap[] = [];
const pulses: VuPulse[] = [];
const timeScratch = new Float32Array(512);

function panWeights(panSigned: number): { wl: number; wr: number } {
  const p = Math.max(-1, Math.min(1, panSigned));
  const theta = ((p + 1) / 2) * (Math.PI / 2);
  return { wl: Math.cos(theta), wr: Math.sin(theta) };
}

function analyserPeakLin(analyser: AnalyserNode): number {
  const n = analyser.fftSize;
  if (n > timeScratch.length) return 0;
  const buf = timeScratch.subarray(0, n);
  analyser.getFloatTimeDomainData(buf);
  let peak = 0;
  for (let i = 0; i < n; i += 1) {
    const a = Math.abs(buf[i]!);
    if (a > peak) peak = a;
  }
  return Math.min(1, peak);
}

/** Register a live pad voice for analyser follow-through after the attack pulse. */
export function registerSe2BeatPadsVuTap(
  analyser: AnalyserNode,
  panSigned: number,
  whenSec: number,
  untilSec: number,
): void {
  const when = Math.max(0, whenSec);
  taps.push({
    analyser,
    pan: Math.max(-1, Math.min(1, panSigned)),
    when,
    until: Math.max(when + 0.02, untilSec),
  });
  if (taps.length > 48) taps.splice(0, taps.length - 48);
}

/**
 * Attack pulse at the exact sample start time (same clock as `src.start`).
 * Peak is the voice gain so soft/hard hits stay accurate without analyser lag.
 */
export function scheduleSe2BeatPadsVuPulse(
  ctx: BaseAudioContext,
  whenSec: number,
  peakLin: number,
  panSigned: number,
): void {
  const when = Math.max(0, whenSec);
  const peak = Math.max(0, Math.min(1, peakLin));
  if (peak < 0.0004) return;
  pulses.push({
    ctx,
    when,
    until: when + 0.09,
    peak,
    pan: Math.max(-1, Math.min(1, panSigned)),
  });
  if (pulses.length > 64) pulses.splice(0, pulses.length - 64);
}

/**
 * Instant L/R peaks — pulses for onset, analysers for the rest of the hit.
 */
export function readSe2BeatPadsVuPeaks(): { l: number; r: number } {
  let l = 0;
  let r = 0;

  for (let i = pulses.length - 1; i >= 0; i -= 1) {
    const pulse = pulses[i]!;
    let audioNow = 0;
    try {
      if (pulse.ctx.state === 'closed') {
        pulses.splice(i, 1);
        continue;
      }
      audioNow = pulse.ctx.currentTime;
    } catch {
      pulses.splice(i, 1);
      continue;
    }
    if (audioNow > pulse.until) {
      pulses.splice(i, 1);
      continue;
    }
    // Arm a few ms early so the paint frame lands with the audible attack.
    if (audioNow + 0.012 < pulse.when) continue;
    const age = Math.max(0, audioNow - pulse.when);
    // Brief hold then quick fade so the analyser can take over.
    const env = age <= 0.02 ? 1 : Math.max(0, 1 - (age - 0.02) / 0.07);
    const peak = pulse.peak * env;
    if (peak < 0.0004) continue;
    const { wl, wr } = panWeights(pulse.pan);
    l = Math.max(l, peak * wl);
    r = Math.max(r, peak * wr);
  }

  for (let i = taps.length - 1; i >= 0; i -= 1) {
    const tap = taps[i]!;
    let audioNow = 0;
    try {
      if (tap.analyser.context.state === 'closed') {
        taps.splice(i, 1);
        continue;
      }
      audioNow = tap.analyser.context.currentTime;
    } catch {
      taps.splice(i, 1);
      continue;
    }
    if (audioNow > tap.until + 0.08) {
      taps.splice(i, 1);
      continue;
    }
    if (audioNow + 0.002 < tap.when) continue;
    const peak = analyserPeakLin(tap.analyser);
    if (peak < 0.0004) continue;
    const { wl, wr } = panWeights(tap.pan);
    l = Math.max(l, peak * wl);
    r = Math.max(r, peak * wr);
  }

  return { l: Math.min(1, l), r: Math.min(1, r) };
}

export function clearSe2BeatPadsVuTaps(): void {
  taps.length = 0;
  pulses.length = 0;
}
