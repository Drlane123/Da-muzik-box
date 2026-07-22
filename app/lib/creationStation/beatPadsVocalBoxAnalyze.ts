/**
 * Beat Pads VocalBox — beatbox / mouth percussion → kick, snare, hat, clap hits.
 */
import {
  beatPadsNewNoteId,
  beatPadsPatternCols,
  type BeatPadsDrumPattern,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import type { BeatPadsVocalBoxPadMap, VocalBoxDrumRole } from '@/app/lib/creationStation/beatPadsVocalBoxPads';
import { VOCALBOX_DRUM_ROLES } from '@/app/lib/creationStation/beatPadsVocalBoxPads';
import {
  grooveLabQuantizeDivisionsPerBar,
  type GrooveLabQuantize,
} from '@/app/lib/creationStation/grooveLabRoll';

export type { VocalBoxDrumRole } from '@/app/lib/creationStation/beatPadsVocalBoxPads';
export type VocalBoxQuantize = GrooveLabQuantize;

export const VOCALBOX_QUANTIZE_OPTIONS: readonly VocalBoxQuantize[] = ['1/4', '1/8', '1/16', '1/32'] as const;

/** VocalBox capture window — 4 or 8 bars locked to session BPM. */
export type VocalBoxCaptureBars = 4 | 8;
export const VOCALBOX_CAPTURE_BAR_OPTIONS: readonly VocalBoxCaptureBars[] = [4, 8] as const;
export const VOCALBOX_DEFAULT_CAPTURE_BARS: VocalBoxCaptureBars = 4;

/** Legacy — prefer {@link VocalBoxAlignOpts.recordStartLagSec} from count-in downbeat. */
export const VOCALBOX_RECORD_LATENCY_SEC = 0;

export function vocalBoxClampCaptureBars(bars: number): VocalBoxCaptureBars {
  return Math.round(bars) >= 8 ? 8 : 4;
}

export function vocalBoxCaptureDurationSec(
  bpm: number,
  captureBars: VocalBoxCaptureBars,
  beatsPerBar: number,
): number {
  const b = Math.max(30, Math.min(300, bpm));
  return captureBars * Math.max(1, beatsPerBar) * (60 / b);
}

/** One bar in seconds at session BPM (count-in bar → downbeat offset in file). */
export function vocalBoxBarSec(bpm: number, beatsPerBar: number): number {
  const b = Math.max(30, Math.min(300, bpm));
  return Math.max(1, beatsPerBar) * (60 / b);
}

/** Drop leading audio — count-in bar before downbeat when recording starts with Cnt. */
export function trimAudioBufferFromSec(
  buffer: AudioBuffer,
  startSec: number,
  maxDurSec?: number,
): AudioBuffer {
  if (startSec <= 0.002) {
    if (maxDurSec == null || buffer.duration <= maxDurSec + 0.02) return buffer;
    return sliceBufferLength(buffer, maxDurSec);
  }
  return sliceBufferFrom(buffer, startSec, maxDurSec);
}

function sliceBufferLength(buffer: AudioBuffer, maxDurSec: number): AudioBuffer {
  const sr = buffer.sampleRate;
  const n = Math.min(buffer.length, Math.max(1, Math.floor(maxDurSec * sr)));
  if (n >= buffer.length) return buffer;
  const out = new AudioBuffer({ length: n, numberOfChannels: buffer.numberOfChannels, sampleRate: sr });
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const src = buffer.getChannelData(ch);
    const dst = out.getChannelData(ch);
    for (let i = 0; i < n; i += 1) dst[i] = src[i] ?? 0;
  }
  return out;
}

function sliceBufferFrom(buffer: AudioBuffer, startSec: number, maxDurSec?: number): AudioBuffer {
  const sr = buffer.sampleRate;
  const startSample = Math.min(buffer.length - 1, Math.max(0, Math.floor(startSec * sr)));
  const remain = buffer.length - startSample;
  const maxN = maxDurSec != null ? Math.floor(maxDurSec * sr) : remain;
  const n = Math.max(1, Math.min(remain, maxN));
  const out = new AudioBuffer({
    length: n,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: sr,
  });
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const src = buffer.getChannelData(ch);
    const dst = out.getChannelData(ch);
    for (let i = 0; i < n; i += 1) dst[i] = src[startSample + i] ?? 0;
  }
  return out;
}

/** MediaRecorder often pads ~50–120 ms silence before first sample — shift downbeat trim. */
export function vocalBoxLeadingSilenceSec(buffer: AudioBuffer, maxSearchSec = 0.22): number {
  const ch = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const hop = Math.max(1, Math.floor(sr * 0.004));
  const limit = Math.min(ch.length, Math.floor(maxSearchSec * sr));
  for (let i = 0; i < limit; i += hop) {
    let sum = 0;
    for (let j = 0; j < hop && i + j < limit; j += 1) {
      const s = ch[i + j] ?? 0;
      sum += s * s;
    }
    if (Math.sqrt(sum / hop) > 0.0055) return i / sr;
  }
  return 0;
}

/** Keep only the first 1–2 bars of a mic take before onset detect. */
export function trimAudioBufferToCaptureBars(
  buffer: AudioBuffer,
  bpm: number,
  captureBars: VocalBoxCaptureBars,
  beatsPerBar: number,
): AudioBuffer {
  const maxSec = vocalBoxCaptureDurationSec(bpm, captureBars, beatsPerBar);
  if (buffer.duration <= maxSec + 0.02) return buffer;
  const n = Math.min(buffer.length, Math.max(1, Math.floor(maxSec * buffer.sampleRate)));
  const out = new AudioBuffer({
    length: n,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const src = buffer.getChannelData(ch);
    const dst = out.getChannelData(ch);
    for (let i = 0; i < n; i += 1) dst[i] = src[i] ?? 0;
  }
  return out;
}

export function vocalBoxDefaultQuantize(stepsPerBar: BeatPadsGridStepsPerBar): VocalBoxQuantize {
  return stepsPerBar === 32 ? '1/32' : '1/16';
}

export function vocalBoxQuantLabel(q: VocalBoxQuantize): string {
  return q;
}

/** How early/late raw hits landed vs the quantized grid (positive = late). */
export function vocalBoxTimingFeedback(
  raw: readonly VocalBoxHit[],
  aligned: readonly VocalBoxHit[],
): string {
  if (aligned.length === 0 || raw.length === 0) return '';
  const deltas: number[] = [];
  for (const a of aligned) {
    const sameRole = raw.filter((r) => r.role === a.role);
    if (sameRole.length === 0) continue;
    let nearest = sameRole[0]!;
    for (const r of sameRole) {
      if (Math.abs(r.startSec - a.startSec) < Math.abs(nearest.startSec - a.startSec)) nearest = r;
    }
    deltas.push(Math.round((nearest.startSec - a.startSec) * 1000));
  }
  if (deltas.length === 0) return '';
  const avg = Math.round(deltas.reduce((s, d) => s + d, 0) / deltas.length);
  if (Math.abs(avg) < 22) return '· on beat';
  return avg > 0 ? `· ${avg}ms late` : `· ${-avg}ms early`;
}

export type VocalBoxHit = {
  role: VocalBoxDrumRole;
  startSec: number;
  velocity: number;
};

const ANALYSIS_SR = 22050;
const FRAME = 2048;
const HOP = 128;
const MAX_ANALYSIS_SEC = 32;

/** Merge same-role bursts within this window after peak-pick. */
const VOCALBOX_ONSET_MERGE_SEC = 0.115;

/**
 * Hard refractory between any two onsets — a mouth can't fire hits faster than
 * this, so anything closer is the same hit re-triggering (~45 ms).
 */
const VOCALBOX_ONSET_REFRACTORY_SEC = 0.045;
/**
 * Onset threshold decay time constant. After a hit the threshold is armed above
 * the peak and decays with this constant; a boom's ringing tail stays under it
 * and never re-triggers, while a genuinely fresh hit rises back above it.
 */
const VOCALBOX_ONSET_DECAY_SEC = 0.13;
/** Frames to search forward from a rising edge for the true energy peak. */
const VOCALBOX_PEAK_SEARCH_FRAMES = 6;

/** Boom/ka land slightly before RMS peak — kick boom is slower than ka. */
const VOCALBOX_ONSET_BIAS_SEC: Record<VocalBoxDrumRole, number> = {
  kick: 0.04,
  snare: 0.014,
  hat: 0.012,
  clap: 0.012,
};

function monoDecimate(buffer: AudioBuffer): { data: Float32Array; sr: number } {
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  const srIn = buffer.sampleRate;
  const ratio = srIn / ANALYSIS_SR;
  const nIn = buffer.length;
  const nOut = Math.max(1, Math.floor(nIn / ratio));
  const out = new Float32Array(nOut);
  for (let i = 0; i < nOut; i++) {
    const src = Math.min(nIn - 1, Math.floor(i * ratio));
    const a = ch0[src] ?? 0;
    const b = ch1 ? (ch1[src] ?? 0) : a;
    out[i] = (a + b) * 0.5;
  }
  return { data: out, sr: ANALYSIS_SR };
}

function frameRms(frame: Float32Array): number {
  let s = 0;
  for (let i = 0; i < frame.length; i++) s += frame[i]! * frame[i]!;
  return Math.sqrt(s / frame.length);
}

function adaptiveRmsGate(rmses: number[]): number {
  if (rmses.length === 0) return 0.005;
  const sorted = [...rmses].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? med;
  // Gate quiet enough for a real "ka", but not so open that breath/noise becomes snare.
  return Math.max(0.0018, med * 1.08 + (p90 - med) * 0.1);
}

function frameBrightness(samples: Float32Array, start: number): number {
  let low = 0;
  let high = 0;
  for (let i = 0; i < FRAME - 1; i++) {
    const s = samples[start + i] ?? 0;
    const d = (samples[start + i + 1] ?? 0) - s;
    low += s * s;
    high += d * d;
  }
  return high / (low + high + 1e-12);
}

/** Low / mid / high band energy + attack transient — beatbox kick = boom, snare = snap/slap. */
function frameBandSpectrum(samples: Float32Array, start: number): {
  low: number;
  mid: number;
  high: number;
  attack: number;
} {
  const sr = ANALYSIS_SR;
  const n = FRAME;
  const lowA = Math.exp((-2 * Math.PI * 150) / sr);
  const midA = Math.exp((-2 * Math.PI * 2400) / sr);
  let lp = 0;
  let mp = 0;
  let lowE = 0;
  let midE = 0;
  let highE = 0;
  let attackE = 0;
  const attackN = Math.max(4, Math.floor(sr * 0.011));

  for (let i = 0; i < n; i++) {
    const s = samples[start + i] ?? 0;
    lp = lowA * lp + (1 - lowA) * s;
    mp = midA * mp + (1 - midA) * s;
    const lo = lp;
    const md = mp - lp;
    const hi = s - mp;
    lowE += lo * lo;
    midE += md * md;
    highE += hi * hi;
    if (i < attackN) {
      const prev = i > 0 ? (samples[start + i - 1] ?? 0) : 0;
      const d = s - prev;
      attackE += d * d;
    }
  }

  const total = lowE + midE + highE + 1e-12;
  return {
    low: lowE / total,
    mid: midE / total,
    high: highE / total,
    attack: attackE / attackN,
  };
}

function frameSpectralCentroid(samples: Float32Array, start: number): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < FRAME; i++) {
    const mag = Math.abs(samples[start + i] ?? 0);
    num += i * mag;
    den += mag;
  }
  return den > 1e-9 ? num / den / FRAME : 0;
}

export type VocalBoxRoleMask = Record<VocalBoxDrumRole, boolean>;

/** Kick + snare on by default — hat/clap are opt-in lanes. */
export const VOCALBOX_DEFAULT_ROLE_MASK: VocalBoxRoleMask = {
  kick: true,
  snare: true,
  hat: false,
  clap: false,
};

export function vocalBoxRoleMaskHasAny(mask: VocalBoxRoleMask): boolean {
  return VOCALBOX_DRUM_ROLES.some((role) => mask[role]);
}

export function filterVocalBoxHitsByRoleMask(
  hits: readonly VocalBoxHit[],
  mask: VocalBoxRoleMask,
): VocalBoxHit[] {
  return hits.filter((h) => mask[h.role]);
}

function kickSnareOnlyMask(mask: VocalBoxRoleMask): boolean {
  return mask.kick && mask.snare && !mask.hat && !mask.clap;
}

function remapDisabledRole(role: VocalBoxDrumRole, mask: VocalBoxRoleMask): VocalBoxDrumRole | null {
  if (mask[role]) return role;
  if ((role === 'hat' || role === 'clap') && mask.snare) return 'snare';
  if (role === 'snare' && !mask.snare && mask.kick) return 'kick';
  if (role === 'kick' && !mask.kick && mask.snare) return 'snare';
  if (role === 'clap' && mask.clap) return 'clap';
  if (role === 'hat' && mask.hat) return 'hat';
  for (const r of VOCALBOX_DRUM_ROLES) {
    if (mask[r]) return r;
  }
  return null;
}

function classifyKickSnareFromBands(
  bands: ReturnType<typeof frameBandSpectrum>,
  rms: number,
): VocalBoxDrumRole | null {
  if (rms < 0.01) return null;

  const { low, mid, high, attack } = bands;
  const boom = low;
  const snap = high + mid * 0.5;
  const attackScore = attack / (rms * rms + 1e-8);

  // Sharp slap/clop — clear "ka" only (raised so boom edges don't steal snare)
  if (attackScore >= 52 && !(boom >= 0.5 && high < 0.14)) return 'snare';

  // Kick = low-frequency boom, soft attack, not much snap
  const kickLike =
    boom >= 0.4 &&
    boom > snap * 1.1 &&
    high <= 0.26 &&
    attackScore < 90;

  // Snare = real "ka" slap — needs clearer snap than before (was over-firing)
  const snareLike =
    snap >= 0.26 &&
    (attackScore >= 32 || high >= 0.18 || (snap >= boom * 1.05 && attackScore >= 22));

  if (kickLike && !snareLike) return 'kick';
  if (snareLike && !kickLike) return 'snare';
  if (kickLike) return 'kick';
  if (snareLike) return 'snare';

  if (attackScore >= 48 || high >= 0.22) return 'snare';
  if (boom >= 0.45 && high < 0.2) return 'kick';
  // Tie → kick (snares were too eager on ambiguous hits)
  return snap >= boom * 1.12 ? 'snare' : 'kick';
}

/**
 * Brightness score — higher for "ka" (snare), lower for "boom" (kick). Normalized
 * (tone balance, not loudness) so a louder hit does not read as more kick.
 */
function vocalBoxSnareBrightness(
  bands: ReturnType<typeof frameBandSpectrum>,
  bright: number,
  centroid: number,
): number {
  const snap = bands.high + bands.mid * 0.5;
  const boom = bands.low;
  const ratio = snap / (snap + boom + 1e-6);
  return 0.55 * ratio + 0.3 * bright + 0.15 * Math.min(1, centroid * 2.2);
}

export type VocalBoxHitFeatures = {
  bands: ReturnType<typeof frameBandSpectrum>;
  bright: number;
  centroid: number;
  rms: number;
};

/**
 * Split kick vs snare relative to this take. A performer's "boom" and "ka" always
 * sit at different brightness levels, so a per-recording threshold beats fixed
 * thresholds tuned to one reference voice. Falls back to the absolute classifier
 * when the hits don't clearly separate (e.g. a run of the same drum).
 */
function classifyKickSnareAdaptive(
  feats: readonly VocalBoxHitFeatures[],
): (VocalBoxDrumRole | null)[] {
  const absolute = () => feats.map((f) => classifyKickSnareFromBands(f.bands, f.rms));
  // Two hits is enough to split boom vs ka on a take.
  if (feats.length < 2) return absolute();

  const discs = feats.map((f) => vocalBoxSnareBrightness(f.bands, f.bright, f.centroid));
  let cLo = Math.min(...discs);
  let cHi = Math.max(...discs);
  if (cHi - cLo < 0.08) return absolute();

  for (let iter = 0; iter < 16; iter += 1) {
    let sumLo = 0;
    let nLo = 0;
    let sumHi = 0;
    let nHi = 0;
    for (const d of discs) {
      if (Math.abs(d - cLo) <= Math.abs(d - cHi)) {
        sumLo += d;
        nLo += 1;
      } else {
        sumHi += d;
        nHi += 1;
      }
    }
    const newLo = nLo > 0 ? sumLo / nLo : cLo;
    const newHi = nHi > 0 ? sumHi / nHi : cHi;
    const settled = Math.abs(newLo - cLo) < 1e-4 && Math.abs(newHi - cHi) < 1e-4;
    cLo = newLo;
    cHi = newHi;
    if (settled) break;
  }

  // Clusters too close → almost certainly one drum type; trust absolute classifier.
  if (cHi - cLo < 0.09) return absolute();

  // Bias threshold toward snare cluster so only clearer "ka" brightness becomes snare.
  const thr = cLo + (cHi - cLo) * 0.58;
  return discs.map((d) => (d >= thr ? 'snare' : 'kick'));
}

function classifyVocalBoxHit(
  bands: ReturnType<typeof frameBandSpectrum>,
  brightness: number,
  rms: number,
  centroid: number,
  mask: VocalBoxRoleMask,
): VocalBoxDrumRole | null {
  if (kickSnareOnlyMask(mask)) {
    return classifyKickSnareFromBands(bands, rms);
  }

  const { low, mid, high, attack } = bands;
  const snap = high + mid * 0.45;
  const attackScore = attack / (rms * rms + 1e-8);

  let role: VocalBoxDrumRole;
  if (low >= 0.42 && low > snap * 1.1 && high < 0.3 && attackScore < 100) role = 'kick';
  else if (snap >= 0.28 && (attackScore >= 38 || high >= 0.2)) role = 'snare';
  else if (centroid < 0.14 && brightness < 0.28) role = 'kick';
  else if (brightness < 0.14 && rms >= 0.03) role = 'kick';
  else if (centroid >= 0.12 && centroid < 0.42 && brightness >= 0.22 && brightness < 0.54 && rms >= 0.035) {
    role = 'snare';
  } else if (brightness >= 0.28 && brightness < 0.46 && rms >= 0.04 && rms < 0.16) role = 'snare';
  else if (brightness >= 0.24 && brightness < 0.4 && rms >= 0.1) role = 'snare';
  else if (brightness < 0.22 && rms < 0.12) role = 'kick';
  else if (brightness >= 0.38 && brightness < 0.62 && centroid >= 0.22) role = 'clap';
  else if (brightness >= 0.52 || centroid >= 0.38) role = 'hat';
  else if (brightness >= 0.42) role = 'clap';
  else role = snap >= low * 1.15 ? 'snare' : 'kick';

  if (!mask.hat && !mask.clap && (role === 'hat' || role === 'clap')) role = 'snare';
  if (!mask.hat && role === 'hat') role = mask.snare ? 'snare' : 'kick';
  if (!mask.clap && role === 'clap') role = mask.snare ? 'snare' : 'kick';

  return remapDisabledRole(role, mask);
}

/**
 * Onset frames via a decaying-threshold detector (aubio-style envelope gate).
 *
 * A hit fires when RMS rises across a threshold that was armed above the previous
 * hit and then decays. This ignores the ripple on a long boom's decaying tail
 * (one boom → one kick) yet still fires on a fresh, closely-spaced hit that rises
 * back above the decaying threshold (fast hits are not dropped).
 */
function detectOnsetFrames(rmses: number[], gate: number, hopSec: number): number[] {
  const refractoryFrames = Math.max(1, Math.round(VOCALBOX_ONSET_REFRACTORY_SEC / hopSec));
  const decay = Math.exp(-hopSec / VOCALBOX_ONSET_DECAY_SEC);
  const onsets: number[] = [];
  let thr = gate;
  let lastOnset = -refractoryFrames * 4;

  for (let i = 1; i < rmses.length; i += 1) {
    thr = Math.max(gate, thr * decay);
    const cur = rmses[i] ?? 0;
    const prev = rmses[i - 1] ?? 0;
    const rising = cur >= prev * 1.04;
    if (cur > gate * 1.08 && cur > thr && rising && i - lastOnset >= refractoryFrames) {
      onsets.push(i);
      lastOnset = i;
      thr = cur * 1.12;
    }
  }
  return onsets;
}

/** Walk forward from a rising edge to the local energy peak (for classification). */
function localPeakFrame(rmses: number[], from: number, span: number): number {
  let best = from;
  let bestV = rmses[from] ?? 0;
  const limit = Math.min(rmses.length - 1, from + span);
  for (let k = from; k <= limit; k += 1) {
    const v = rmses[k] ?? 0;
    if (v > bestV) {
      bestV = v;
      best = k;
    } else if (v < bestV * 0.6) {
      break;
    }
  }
  return best;
}

/** Attack start before RMS peak — peak frame reports late vs when you hit. */
function vocalBoxOnsetSecFromPeak(
  rmses: number[],
  peakFrame: number,
  sr: number,
  gate: number,
  role: VocalBoxDrumRole,
): number {
  const peakRms = rmses[peakFrame] ?? 0;
  const floor = Math.max(gate * 0.38, peakRms * 0.28);
  let onsetFrame = peakFrame;
  for (let k = peakFrame; k >= Math.max(0, peakFrame - 12); k -= 1) {
    if ((rmses[k] ?? 0) <= floor) {
      onsetFrame = Math.min(peakFrame, k + 1);
      break;
    }
    onsetFrame = k;
  }
  const hopSec = HOP / sr;
  const raw = Math.max(0, onsetFrame * hopSec - hopSec * 0.45);
  return Math.max(0, raw - (VOCALBOX_ONSET_BIAS_SEC[role] ?? 0));
}

/** Small nudge (±40% of quant step) so tight performances lock without global drift. */
function vocalBoxFineGridNudge(hits: readonly VocalBoxHit[], quantStepSec: number): number {
  if (hits.length < 2) return 0;
  const maxNudge = quantStepSec * 0.48;
  const step = Math.min(0.003, quantStepSec * 0.05);
  let best = 0;
  let bestScore = Infinity;
  for (let n = -maxNudge; n <= maxNudge + 1e-9; n += step) {
    let score = 0;
    for (const h of hits) {
      const t = h.startSec + n;
      const nearest = Math.round(t / quantStepSec) * quantStepSec;
      score += Math.abs(t - nearest);
    }
    if (score < bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return Math.abs(best) < 0.004 ? 0 : best;
}

/** One mouth hit often fires multiple RMS peaks — keep the strongest in each burst. */
export function mergeVocalBoxOnsetBursts(
  hits: readonly VocalBoxHit[],
  mergeSec = VOCALBOX_ONSET_MERGE_SEC,
): VocalBoxHit[] {
  if (hits.length === 0) return [];
  const sorted = [...hits].sort((a, b) => a.startSec - b.startSec);
  const out: VocalBoxHit[] = [];

  for (const hit of sorted) {
    const last = out[out.length - 1];
    if (last && hit.startSec - last.startSec < mergeSec) {
      if (hit.role === last.role) {
        if (hit.velocity > last.velocity) out[out.length - 1] = hit;
        continue;
      }
      const dt = hit.startSec - last.startSec;
      // Same mouth hit often spikes a false "ka" on the boom attack — keep kick.
      if (
        last.role === 'kick' &&
        hit.role === 'snare' &&
        dt < 0.07 &&
        hit.velocity <= last.velocity + 10
      ) {
        continue;
      }
      if (last.role === 'snare' && hit.role === 'kick' && dt < 0.07) {
        out[out.length - 1] = hit;
        continue;
      }
      // Farther kick+snare pair: keep both (real boom then ka).
    }
    out.push(hit);
  }
  return out;
}

/** Raw onset detect only (no BPM quantize). */
export function detectBeatboxVocalBoxHits(
  buffer: AudioBuffer,
  maxAnalysisSec?: number,
  roleMask: VocalBoxRoleMask = VOCALBOX_DEFAULT_ROLE_MASK,
): VocalBoxHit[] {
  const { data, sr } = monoDecimate(buffer);
  const capSec = maxAnalysisSec ?? MAX_ANALYSIS_SEC;
  const maxSamples = Math.min(data.length, Math.floor(capSec * sr));
  if (maxSamples < FRAME + HOP) return [];

  const rmses: number[] = [];
  for (let start = 0; start + FRAME <= maxSamples; start += HOP) {
    rmses.push(frameRms(data.subarray(start, start + FRAME)));
  }
  const gate = adaptiveRmsGate(rmses);
  const hopSec = HOP / sr;
  const onsetFrames = detectOnsetFrames(rmses, gate, hopSec);

  const measured = onsetFrames.map((onsetFrame) => {
    const peakFrame = localPeakFrame(rmses, onsetFrame, VOCALBOX_PEAK_SEARCH_FRAMES);
    const peakRms = rmses[peakFrame] ?? 0;
    const frameStart = peakFrame * HOP;
    return {
      peakFrame,
      peakRms,
      bands: frameBandSpectrum(data, frameStart),
      bright: frameBrightness(data, frameStart),
      centroid: frameSpectralCentroid(data, frameStart),
    };
  });

  // Kick + snare only → split relative to this take (loudness-independent). Other
  // masks (hat/clap on) keep the absolute multi-role classifier.
  const roles = kickSnareOnlyMask(roleMask)
    ? classifyKickSnareAdaptive(
        measured.map((m) => ({ bands: m.bands, bright: m.bright, centroid: m.centroid, rms: m.peakRms })),
      )
    : measured.map((m) => classifyVocalBoxHit(m.bands, m.bright, m.peakRms, m.centroid, roleMask));

  const candidates: VocalBoxHit[] = [];
  for (let i = 0; i < measured.length; i += 1) {
    const role = roles[i];
    if (!role) continue;
    const m = measured[i]!;
    const vel = Math.round(Math.max(40, Math.min(127, 48 + m.peakRms * 820)));
    // Peak-walkback is loudness-consistent (scale-invariant 28%-of-peak); the per-role
    // bias applies the systematic lead (kick boom peaks later than a snare "ka").
    const startSec = vocalBoxOnsetSecFromPeak(rmses, m.peakFrame, sr, gate, role);
    if (startSec >= capSec) continue;
    candidates.push({ role, startSec, velocity: vel });
  }

  candidates.sort((a, b) => a.startSec - b.startSec);
  return mergeVocalBoxOnsetBursts(candidates);
}

export type VocalBoxAlignOpts = {
  bpm: number;
  /** 1 or 2 bars — VocalBox beat window (not full session loop). */
  captureBars: VocalBoxCaptureBars;
  stepsPerBar: BeatPadsGridStepsPerBar;
  beatsPerBar: number;
  quantize: VocalBoxQuantize;
  roleMask?: VocalBoxRoleMask;
  /**
   * When false, file t=0 is downbeat (after count-in trim). Legacy lag field ignored.
   * @deprecated use grid trimmed at analyze — kept for callers passing 0
   */
  recordStartLagSec?: number;
};

export function vocalBoxQuantStepSec(
  bpm: number,
  quantize: VocalBoxQuantize,
  beatsPerBar: number,
): number {
  const b = Math.max(30, Math.min(300, bpm));
  const quantDiv = grooveLabQuantizeDivisionsPerBar(quantize);
  return 60 / b / (quantDiv / Math.max(1, beatsPerBar));
}

/**
 * Snap performed hits to quantize grid. Input hits must be on downbeat timeline (t=0 = bar 1).
 */
export function alignAndQuantizeVocalBoxHits(
  hits: readonly VocalBoxHit[],
  opts: VocalBoxAlignOpts,
): VocalBoxHit[] {
  const mask = opts.roleMask ?? VOCALBOX_DEFAULT_ROLE_MASK;
  const filtered = filterVocalBoxHitsByRoleMask(hits, mask);
  if (filtered.length === 0) return [];

  const quantDiv = grooveLabQuantizeDivisionsPerBar(opts.quantize);
  const quantStepSec = vocalBoxQuantStepSec(opts.bpm, opts.quantize, opts.beatsPerBar);
  const gridStepSec = vocalBoxStepSec(opts.bpm, opts.stepsPerBar, opts.beatsPerBar);
  const cols = beatPadsPatternCols(opts.captureBars, opts.stepsPerBar);
  const sorted = [...filtered].sort((a, b) => a.startSec - b.startSec);
  const mergedRaw = mergeVocalBoxOnsetBursts(
    sorted,
    Math.max(VOCALBOX_ONSET_MERGE_SEC, quantStepSec * 0.42),
  );
  const nudge = vocalBoxFineGridNudge(mergedRaw, quantStepSec);

  const out: VocalBoxHit[] = [];
  const seen = new Set<string>();

  for (const hit of mergedRaw) {
    if (hit.startSec < 0) continue;
    const musicalSec = Math.max(0, hit.startSec + nudge);
    const quantIdx = Math.round(musicalSec / quantStepSec);
    const gridStep = Math.round((quantIdx * opts.stepsPerBar) / quantDiv);
    if (gridStep < 0 || gridStep >= cols) continue;
    const key = `${hit.role}:${gridStep}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      role: hit.role,
      startSec: gridStep * gridStepSec,
      velocity: hit.velocity,
    });
  }

  out.sort((a, b) => a.startSec - b.startSec);
  return out;
}

/** Detect onsets, then quantize to session BPM with bar-1 anchor. */
export function analyzeBeatboxToVocalBoxHits(
  buffer: AudioBuffer,
  opts: VocalBoxAlignOpts,
): VocalBoxHit[] {
  return alignAndQuantizeVocalBoxHits(detectBeatboxVocalBoxHits(buffer), opts);
}

export function vocalBoxStepSec(
  bpm: number,
  stepsPerBar: BeatPadsGridStepsPerBar,
  beatsPerBar: number,
): number {
  const b = Math.max(30, Math.min(300, bpm));
  return 60 / b / (stepsPerBar / Math.max(1, beatsPerBar));
}

/** Draft hits → grid step indices per role (for VocalBox MIDI preview). */
export function vocalBoxHitsToLaneSteps(
  hits: readonly VocalBoxHit[],
  opts: {
    bpm: number;
    captureBars: VocalBoxCaptureBars;
    stepsPerBar: BeatPadsGridStepsPerBar;
    beatsPerBar: number;
  },
): Record<VocalBoxDrumRole, number[]> {
  const cols = beatPadsPatternCols(opts.captureBars, opts.stepsPerBar);
  const stepSec = vocalBoxStepSec(opts.bpm, opts.stepsPerBar, opts.beatsPerBar);
  const lanes: Record<VocalBoxDrumRole, number[]> = {
    kick: [],
    snare: [],
    hat: [],
    clap: [],
  };
  for (const hit of hits) {
    const step = Math.round(hit.startSec / stepSec);
    if (step < 0 || step >= cols) continue;
    const lane = lanes[hit.role];
    if (!lane.includes(step)) lane.push(step);
  }
  for (const role of Object.keys(lanes) as VocalBoxDrumRole[]) {
    lanes[role].sort((a, b) => a - b);
  }
  return lanes;
}

export function mergeVocalBoxHitsIntoPattern(
  pattern: BeatPadsDrumPattern,
  hits: readonly VocalBoxHit[],
  opts: {
    loopBars: number;
    captureBars?: VocalBoxCaptureBars;
    stepsPerBar: BeatPadsGridStepsPerBar;
    bpm: number;
    beatsPerBar: number;
    pads: BeatPadsVocalBoxPadMap;
    replaceLanes?: boolean;
    roleMask?: VocalBoxRoleMask;
  },
): BeatPadsDrumPattern {
  const mask = opts.roleMask ?? VOCALBOX_DEFAULT_ROLE_MASK;
  const loopCols = beatPadsPatternCols(opts.loopBars, opts.stepsPerBar);
  const captureCols = beatPadsPatternCols(
    opts.captureBars ?? opts.loopBars,
    opts.stepsPerBar,
  );
  const cols = Math.min(loopCols, captureCols);
  const stepSec = vocalBoxStepSec(opts.bpm, opts.stepsPerBar, opts.beatsPerBar);
  const rolePads: Record<VocalBoxDrumRole, number> = {
    kick: opts.pads.kick,
    snare: opts.pads.snare,
    hat: opts.pads.hat,
    clap: opts.pads.clap,
  };

  const next = pattern.map((row) => row.map((n) => ({ ...n })));

  if (opts.replaceLanes !== false) {
    for (const role of VOCALBOX_DRUM_ROLES) {
      if (!mask[role]) continue;
      const pi = rolePads[role];
      if (pi >= 0 && pi < next.length) next[pi] = [];
    }
  }

  for (const hit of hits) {
    if (!mask[hit.role]) continue;
    const pi = rolePads[hit.role];
    if (pi < 0 || pi >= next.length) continue;
    const step = Math.round(hit.startSec / stepSec);
    if (step < 0 || step >= cols) continue;
    const lane = next[pi]!;
    if (lane.some((n) => n.start === step)) continue;
    lane.push({ id: beatPadsNewNoteId(), start: step, len: 1 });
    lane.sort((a, b) => a.start - b.start);
  }

  return next;
}
