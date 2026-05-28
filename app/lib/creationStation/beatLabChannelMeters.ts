/**
 * Beat Lab CH 1–32 meters — audio-clock driven (transport rAF tick).
 * Prefers AnalyserNode taps on live pad voices; falls back to scheduled peak pulses.
 */
const CHANNEL_COUNT = 32;
const ZERO_SNAP = 0.0005;
/** Per-frame decay @ ~60 Hz — slower falloff so hits read like hardware VU. */
const RUNNING_DECAY = 0.9;
const STOPPED_DECAY = 0.86;

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

function bumpChannel(ch: number, monoPeak: number, panSigned: number): void {
  if (ch < 1 || ch > CHANNEL_COUNT) return;
  const peak = Math.max(0, Math.min(1, monoPeak));
  if (peak <= ZERO_SNAP) return;
  const { wl, wr } = panWeights(panSigned);
  const row = levels[ch]!;
  row.l = Math.max(row.l, peak * wl);
  row.r = Math.max(row.r, peak * wr);
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
  /** In-app peaks are usually <1; small makeup so on-screen matches perceived loudness. */
  return Math.min(1, peak * 1.12);
}

/** Stereo “main mix” approximation: max peak per side across channels × master trim (shown on MAIN strip). */
export function computeBeatLabMainBusStereoVu(masterLinear01: number): StereoLevel {
  let ml = 0;
  let mr = 0;
  for (let ch = 1; ch <= CHANNEL_COUNT; ch += 1) {
    const row = levels[ch]!;
    if (row.l > ml) ml = row.l;
    if (row.r > mr) mr = row.r;
  }
  const g = Math.max(0, Math.min(1, masterLinear01));
  return { l: Math.min(1, ml * g), r: Math.min(1, mr * g) };
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

/** Call from Creation transport rAF while Beat Lab is playing. */
export function tickBeatLabChannelMeters(audioNow: number, transportRunning: boolean): void {
  let changed = false;

  while (pending.length > 0 && pending[0]!.when <= audioNow + 0.002) {
    const p = pending.shift()!;
    bumpChannel(p.ch, p.peak, p.pan);
    changed = true;
  }

  for (let i = voices.length - 1; i >= 0; i -= 1) {
    const v = voices[i]!;
    if (audioNow > v.until + 0.12) {
      voices.splice(i, 1);
      continue;
    }
    /* Small lead so the first quantum after `when` isn’t skipped. */
    if (audioNow + 0.008 < v.when) continue;
    const peak = analyserPeakLin(v.analyser);
    if (peak > ZERO_SNAP) {
      const { wl, wr } = panWeights(v.pan);
      const row = levels[v.ch]!;
      const nl = Math.min(1, peak * wl);
      const nr = Math.min(1, peak * wr);
      if (nl > row.l) row.l = nl;
      if (nr > row.r) row.r = nr;
      changed = true;
    }
  }

  const anyLiveAnalyserVoice = voices.length > 0;
  const decay = transportRunning || anyLiveAnalyserVoice ? RUNNING_DECAY : STOPPED_DECAY;
  for (let ch = 1; ch <= CHANNEL_COUNT; ch += 1) {
    const row = levels[ch]!;
    const nl = row.l * decay;
    const nr = row.r * decay;
    const fl = nl < ZERO_SNAP ? 0 : nl;
    const fr = nr < ZERO_SNAP ? 0 : nr;
    if (fl !== row.l || fr !== row.r) {
      row.l = fl;
      row.r = fr;
      changed = true;
    }
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
  for (let ch = 1; ch <= CHANNEL_COUNT; ch += 1) {
    levels[ch]!.l = 0;
    levels[ch]!.r = 0;
  }
  notify();
}
