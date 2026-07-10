/**
 * Beat Lab CH 1–32 meters — audio-clock driven (transport rAF tick).
 * Prefers AnalyserNode taps on live pad voices; falls back to scheduled peak pulses.
 */
const CHANNEL_COUNT = 32;
const ZERO_SNAP = 0.0005;
/** Per-channel release (0–1 per second) — responsive but not jittery between hits. */
const RUNNING_RELEASE_PER_SEC = 3.0;
const STOPPED_RELEASE_PER_SEC = 6.0;
/** Main bus release — slower so the MAIN strip reads steady while channels move. */
const MAIN_BUS_RELEASE_PER_SEC = 1.25;
const MAIN_BUS_ATTACK_PER_SEC = 9.0;

type StereoLevel = { l: number; r: number };

type ActiveVoice = {
  ch: number;
  analyser: AnalyserNode;
  pan: number;
  when: number;
  until: number;
};

type PendingPulse = {
  when: number;
  ch: number;
  peak: number;
  pan: number;
};

const levels: StereoLevel[] = Array.from({ length: CHANNEL_COUNT + 1 }, () => ({ l: 0, r: 0 }));
const voices: ActiveVoice[] = [];
const pending: PendingPulse[] = [];
const floatTimeScratch = new Float32Array(8192);
const instantL = new Float32Array(CHANNEL_COUNT + 1);
const instantR = new Float32Array(CHANNEL_COUNT + 1);
const mainBusLevels: StereoLevel = { l: 0, r: 0 };
let lastTickPerfMs = 0;

let seq = 0;
let listeners = new Set<() => void>();

function notify(): void {
  seq += 1;
  listeners.forEach((l) => l());
}

function panWeights(panSigned: number): { wl: number; wr: number } {
  const p = Math.max(-1, Math.min(1, panSigned));
  const theta = ((p + 1) / 2) * (Math.PI / 2);
  return { wl: Math.cos(theta), wr: Math.sin(theta) };
}

function bumpInstant(ch: number, monoPeak: number, panSigned: number): void {
  if (ch < 1 || ch > CHANNEL_COUNT) return;
  const peak = Math.max(0, Math.min(1, monoPeak));
  if (peak <= ZERO_SNAP) return;
  const { wl, wr } = panWeights(panSigned);
  const pl = peak * wl;
  const pr = peak * wr;
  if (pl > instantL[ch]!) instantL[ch] = pl;
  if (pr > instantR[ch]!) instantR[ch] = pr;
}

function applyVuBallistics(current: number, instant: number, decay: number): number {
  if (instant > current) return instant;
  return Math.max(0, current - decay);
}

function applyMainBusBallistics(current: number, target: number, dt: number): number {
  if (target > current) {
    const rise = MAIN_BUS_ATTACK_PER_SEC * dt;
    return current + (target - current) * Math.min(1, rise);
  }
  return Math.max(0, current - MAIN_BUS_RELEASE_PER_SEC * dt);
}

function analyserPeakLin(analyser: AnalyserNode): number {
  const n = analyser.fftSize;
  if (n > floatTimeScratch.length) return 0;
  analyser.getFloatTimeDomainData(floatTimeScratch.subarray(0, n));
  let peak = 0;
  for (let i = 0; i < n; i += 1) {
    const a = Math.abs(floatTimeScratch[i]!);
    if (a > peak) peak = a;
  }
  return Math.min(1, peak);
}

/** Stereo MAIN bus VU (smoothed in {@link tickBeatLabChannelMeters}) × master trim. */
export function computeBeatLabMainBusStereoVu(masterLinear01: number): StereoLevel {
  const g = Math.max(0, Math.min(1, masterLinear01));
  return {
    l: Math.min(1, mainBusLevels.l * g),
    r: Math.min(1, mainBusLevels.r * g),
  };
}

export function registerBeatLabMeterVoice(
  ch: number,
  analyser: AnalyserNode,
  panSigned: number,
  whenSec: number,
  untilSec: number,
): void {
  if (ch < 1 || ch > CHANNEL_COUNT) return;
  const pan = Math.max(-1, Math.min(1, panSigned));
  const when = Math.max(0, whenSec);
  voices.push({ ch, analyser, pan, when, until: Math.max(when + 0.02, untilSec) });
}

/** Scheduled peak when no analyser (fallback drums / melodic). */
export function scheduleBeatLabMeterPulse(
  whenSec: number,
  ch: number,
  monoPeak: number,
  panSigned: number,
): void {
  if (ch < 1 || ch > CHANNEL_COUNT) return;
  const pulse: PendingPulse = {
    when: whenSec,
    ch,
    peak: Math.max(0, Math.min(1, monoPeak)),
    pan: Math.max(-1, Math.min(1, panSigned)),
  };
  let i = pending.findIndex((p) => p.when > whenSec);
  if (i < 0) pending.push(pulse);
  else pending.splice(i, 0, pulse);
}

export function scheduleBeatLabMeterPulseAt(
  ctx: AudioContext,
  ch: number,
  monoPeak: number,
  panSigned: number,
  whenSec: number,
): void {
  scheduleBeatLabMeterPulse(Math.max(whenSec, ctx.currentTime + 0.001), ch, monoPeak, panSigned);
}

/** Call from transport rAF / mixer paint while Beat Lab audio is active. */
export function tickBeatLabChannelMeters(audioNow: number, transportRunning: boolean): void {
  const perfNow = performance.now();
  if (perfNow - lastTickPerfMs < 14) return;
  const dt =
    lastTickPerfMs > 0
      ? Math.max(1 / 240, Math.min(0.1, (perfNow - lastTickPerfMs) / 1000))
      : 1 / 60;
  lastTickPerfMs = perfNow;

  let changed = false;
  const decay = (transportRunning ? RUNNING_RELEASE_PER_SEC : STOPPED_RELEASE_PER_SEC) * dt;

  instantL.fill(0);
  instantR.fill(0);

  while (pending.length > 0 && pending[0]!.when <= audioNow + 0.002) {
    const p = pending.shift()!;
    bumpInstant(p.ch, p.peak, p.pan);
    changed = true;
  }

  for (let i = voices.length - 1; i >= 0; i -= 1) {
    const v = voices[i]!;
    if (audioNow > v.until + 0.08) {
      voices.splice(i, 1);
      continue;
    }
    /* Small lead so the first quantum after `when` isn’t skipped. */
    if (audioNow + 0.008 < v.when) continue;
    const peak = analyserPeakLin(v.analyser);
    if (peak > ZERO_SNAP) {
      const { wl, wr } = panWeights(v.pan);
      const ch = v.ch;
      const nl = Math.min(1, peak * wl);
      const nr = Math.min(1, peak * wr);
      if (nl > instantL[ch]!) instantL[ch] = nl;
      if (nr > instantR[ch]!) instantR[ch] = nr;
      changed = true;
    }
  }

  for (let ch = 1; ch <= CHANNEL_COUNT; ch += 1) {
    const row = levels[ch]!;
    const nl = applyVuBallistics(row.l, instantL[ch]!, decay);
    const nr = applyVuBallistics(row.r, instantR[ch]!, decay);
    const fl = nl < ZERO_SNAP ? 0 : nl;
    const fr = nr < ZERO_SNAP ? 0 : nr;
    if (fl !== row.l || fr !== row.r) {
      row.l = fl;
      row.r = fr;
      changed = true;
    }
  }

  let busTargetL = 0;
  let busTargetR = 0;
  for (let ch = 1; ch <= CHANNEL_COUNT; ch += 1) {
    const row = levels[ch]!;
    if (row.l > busTargetL) busTargetL = row.l;
    if (row.r > busTargetR) busTargetR = row.r;
  }
  const nextMainL = applyMainBusBallistics(mainBusLevels.l, busTargetL, dt);
  const nextMainR = applyMainBusBallistics(mainBusLevels.r, busTargetR, dt);
  if (nextMainL !== mainBusLevels.l || nextMainR !== mainBusLevels.r) {
    mainBusLevels.l = nextMainL;
    mainBusLevels.r = nextMainR;
    changed = true;
  }

  if (changed) notify();
}

export function getBeatLabChannelMeterLevels(): ReadonlyArray<Readonly<StereoLevel>> {
  return levels;
}

export function getBeatLabChannelMeterLevel(ch: number): StereoLevel {
  if (ch < 1 || ch > CHANNEL_COUNT) return { l: 0, r: 0 };
  const row = levels[ch]!;
  return { l: row.l, r: row.r };
}

export function subscribeBeatLabChannelMeters(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getBeatLabChannelMetersSeq(): number {
  return seq;
}

export function resetBeatLabChannelMeters(): void {
  pending.length = 0;
  voices.length = 0;
  lastTickPerfMs = 0;
  mainBusLevels.l = 0;
  mainBusLevels.r = 0;
  for (let ch = 1; ch <= CHANNEL_COUNT; ch += 1) {
    levels[ch]!.l = 0;
    levels[ch]!.r = 0;
  }
  notify();
}
