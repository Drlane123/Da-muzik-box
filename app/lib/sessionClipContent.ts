/**
 * Bridges module pattern/block data into Studio timeline clips with AudioBuffers (playback requires buffer).
 * Clips are tagged [CS] / [AI] / [Arr] so they can be replaced on re-sync.
 */

import {
  AI_PATTERN_SESSION_BASE,
  AI_PATTERN_TRACK_COUNT,
  getCreationChannelDisplayName,
  getMasterArrangerSessionBase,
} from '@/app/lib/sessionChannelTracks';
import {
  loadPadSampleStore,
  padSampleKey,
  storedToArrayBuffer,
} from '@/app/lib/padSampleStorage';

export const AI_PATTERN_CLIP_DATA_KEY = 'da-music-box-ai-pattern-clip-data-v1';
export const MASTER_ARRANGER_CLIP_DATA_KEY = 'da-music-box-master-arranger-clip-data-v1';
export const CREATION_STATION_CLIP_DATA_KEY = 'da-music-box-creation-station-clip-data-v1';

export interface AiPatternClipPayload {
  bpm: number;
  loopLength: number;
  /** totalSteps = loopLength * 4 (matches AiPatternScreen transport) */
  totalSteps: number;
  tracks: { idx: number; pattern: boolean[][] | null }[];
}

export interface MasterArrangerClipPayload {
  bpm: number;
  blocks: { id: number; trackId: number; bar: number; len: number; label: string }[];
}

/** Active bank drum grid: columns sliced to visible loop (drumLoopBars × measuresPerBar). */
export interface CreationStationClipPayload {
  bpm: number;
  drumLoopBars: number;
  measuresPerBar: number;
  padChannels: number[];
  activeBank: number;
  /** SUB BASS line on CH17 (matches Creation Station scheduler). */
  subOn?: boolean;
  /** drums[pad][col] for 16 pads, cols 0..maxCols */
  drums: boolean[][];
}

export function readAiPatternClipPayloadFromStorage(): AiPatternClipPayload | null {
  try {
    const raw = localStorage.getItem(AI_PATTERN_CLIP_DATA_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AiPatternClipPayload;
  } catch {
    return null;
  }
}

export function readMasterArrangerClipPayloadFromStorage(): MasterArrangerClipPayload | null {
  try {
    const raw = localStorage.getItem(MASTER_ARRANGER_CLIP_DATA_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MasterArrangerClipPayload;
  } catch {
    return null;
  }
}

export function readCreationStationClipPayloadFromStorage(): CreationStationClipPayload | null {
  try {
    const raw = localStorage.getItem(CREATION_STATION_CLIP_DATA_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CreationStationClipPayload;
  } catch {
    return null;
  }
}

/** Matches CreationStationScreen MEASURES_PER_BAR for SUB BASS step mask. */
const CS_MEASURES_PER_BAR = 4;

/** Default pad velocities (CreationStationScreen PAD_VEL) — used when rendering [CS] clips. */
const CS_PAD_VEL = [
  115, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 127,
];

export type CreationChannelPattern = {
  /** One row per sequencer lane on this mixer channel. */
  rows: boolean[][];
  /** Parallel to rows: pad index 0–15, or -1 = SUB BASS lane (CH17 only). */
  pads: number[];
};

/** Same mask as Creation Station scheduler: colIndex % (MEASURES_PER_BAR*2) === MEASURES_PER_BAR*2 - 1 */
function buildSubBassStepPattern(maxCols: number): boolean[] {
  const period = CS_MEASURES_PER_BAR * 2;
  return Array.from({ length: maxCols }, (_, i) => i % period === period - 1);
}

/**
 * For each mixer channel id, build rows + pad indices (sequencer lanes → same session track).
 * CH17 can include an extra SUB BASS row when subOn is true.
 */
export function buildCreationChannelRowPatterns(
  payload: CreationStationClipPayload,
): Map<number, CreationChannelPattern> {
  const maxCols = Math.max(1, payload.drumLoopBars * payload.measuresPerBar);
  const out = new Map<number, CreationChannelPattern>();
  const { padChannels, drums } = payload;
  const subOn = !!payload.subOn;
  if (!drums?.length || !padChannels?.length) return out;

  for (let ch = 1; ch <= 24; ch++) {
    const rows: boolean[][] = [];
    const pads: number[] = [];
    for (let pad = 0; pad < 16; pad++) {
      if (padChannels[pad] !== ch) continue;
      const row = drums[pad];
      if (!row?.length) continue;
      const slice = row.slice(0, maxCols);
      if (!slice.some(Boolean)) continue;
      rows.push(slice);
      pads.push(pad);
    }
    if (ch === 17 && subOn) {
      rows.push(buildSubBassStepPattern(maxCols));
      pads.push(-1);
    }
    if (rows.length > 0) out.set(ch, { rows, pads });
  }
  return out;
}

function creationChannelLabel(channelId: number, padChannels: number[]): string {
  return `[CS] ${getCreationChannelDisplayName(channelId, padChannels)}`;
}

async function decodeAllPadSamples(ctx: AudioContext): Promise<Map<string, AudioBuffer>> {
  const m = new Map<string, AudioBuffer>();
  try {
    const store = loadPadSampleStore();
    for (const [k, st] of Object.entries(store)) {
      try {
        const ab = storedToArrayBuffer(st);
        const buf = await ctx.decodeAudioData(ab.slice(0));
        m.set(k, buf);
      } catch {
        /* skip corrupt */
      }
    }
  } catch {
    /* no store */
  }
  return m;
}

/**
 * Renders one mixer channel's lanes: sample hits mixed per step, else synth click (matches Creation Station fallback).
 */
export function renderCreationChannelToAudioBuffer(
  ctx: BaseAudioContext,
  payload: CreationStationClipPayload,
  spec: CreationChannelPattern,
  padSamples: Map<string, AudioBuffer>,
  bpm: number,
  totalSteps: number,
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const stepSec = 60 / Math.max(40, bpm) / 4;
  const durationSec = Math.max(0.08, totalSteps * stepSec);
  const nFrames = Math.ceil(durationSec * sampleRate);
  const buf = ctx.createBuffer(1, nFrames, sampleRate);
  const data = buf.getChannelData(0);
  const bank = Number.isFinite(payload.activeBank) ? payload.activeBank : 0;

  const { rows, pads } = spec;
  for (let step = 0; step < totalSteps; step++) {
    const s0 = Math.floor(step * stepSec * sampleRate);
    for (let ri = 0; ri < rows.length; ri++) {
      if (!rows[ri]?.[step]) continue;
      const padIdx = pads[ri];
      if (padIdx === -1) {
        mixSubBassHit(data, sampleRate, s0, 127);
        continue;
      }
      const vel = CS_PAD_VEL[padIdx] ?? 90;
      const key = padSampleKey(bank, padIdx);
      const sample = padSamples.get(key);
      if (sample) {
        mixSampleHit(data, sample, s0, vel);
      } else {
        const freq = 160 + ri * 70;
        mixSynthClick(data, sampleRate, s0, freq, vel);
      }
    }
  }

  normalizePeak(data);
  return buf;
}

function mixSynthClick(
  ch: Float32Array,
  sampleRate: number,
  s0: number,
  freq: number,
  vel: number,
): void {
  const base = 0.28 * (vel / 127);
  const clickLen = Math.min(Math.floor(sampleRate * 0.045), ch.length - s0);
  for (let k = 0; k < clickLen; k++) {
    const s = s0 + k;
    if (s >= 0 && s < ch.length) {
      ch[s] += base * Math.sin((2 * Math.PI * freq * k) / sampleRate) * Math.exp(-k * 0.085);
    }
  }
}

/** Approximates MasterClock CH17 (sub) — short pitched decay. */
function mixSubBassHit(ch: Float32Array, sampleRate: number, s0: number, vel: number): void {
  const base = 0.32 * (vel / 127);
  const dur = Math.min(Math.floor(sampleRate * 0.45), ch.length - s0);
  for (let k = 0; k < dur; k++) {
    const s = s0 + k;
    if (s < 0 || s >= ch.length) continue;
    const t = k / sampleRate;
    const f = 80 * Math.pow(30 / 80, k / Math.max(1, dur - 1));
    ch[s] += base * Math.sin(2 * Math.PI * f * t) * Math.exp(-k * 0.004);
  }
}

function mixSampleHit(
  ch: Float32Array,
  sample: AudioBuffer,
  s0: number,
  vel: number,
): void {
  const nCh = sample.numberOfChannels;
  const len = sample.length;
  const gain = 0.42 * (vel / 127);
  for (let i = 0; i < len && s0 + i < ch.length; i++) {
    let sum = 0;
    for (let c = 0; c < nCh; c++) sum += sample.getChannelData(c)[i] ?? 0;
    ch[s0 + i] += (sum / nCh) * gain;
  }
}

function normalizePeak(ch: Float32Array): void {
  let peak = 0;
  for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  if (peak <= 0 || peak <= 0.95) return;
  const s = 0.92 / peak;
  for (let i = 0; i < ch.length; i++) ch[i] *= s;
}

/** Remove clips produced by session sync so they can be refreshed. */
export function stripModuleSessionClips<T extends { clips: { label: string }[] }>(tracks: T[]): T[] {
  return tracks.map((t) => ({
    ...t,
    clips: t.clips.filter(
      (c) =>
        !c.label.startsWith('[AI]') &&
        !c.label.startsWith('[Arr]') &&
        !c.label.startsWith('[CS]'),
    ),
  }));
}

function patternHasContent(pattern: boolean[][] | null | undefined): boolean {
  if (!pattern?.length) return false;
  return pattern.some((row) => row?.some(Boolean));
}

/** Renders step-grid pattern as audible clicks (same step clock as AiPatternScreen: 60/bpm/4 sec per step). */
export function renderAiPatternToAudioBuffer(
  ctx: BaseAudioContext,
  pattern: boolean[][],
  bpm: number,
  totalSteps: number,
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const stepSec = 60 / Math.max(40, bpm) / 4;
  const durationSec = Math.max(0.08, totalSteps * stepSec);
  const nFrames = Math.ceil(durationSec * sampleRate);
  const buf = ctx.createBuffer(1, nFrames, sampleRate);
  const ch = buf.getChannelData(0);
  const rows = pattern.length;
  const cols = Math.max(1, ...pattern.map((r) => (r?.length ? r.length : 0)));
  for (let step = 0; step < totalSteps; step++) {
    const s0 = Math.floor(step * stepSec * sampleRate);
    for (let ri = 0; ri < rows; ri++) {
      if (pattern[ri]?.[step % cols]) {
        const freq = 160 + ri * 70;
        const clickLen = Math.min(Math.floor(sampleRate * 0.045), nFrames - s0);
        for (let k = 0; k < clickLen; k++) {
          const s = s0 + k;
          if (s >= 0 && s < nFrames) {
            ch[s] += 0.28 * Math.sin((2 * Math.PI * freq * k) / sampleRate) * Math.exp(-k * 0.085);
          }
        }
      }
    }
  }
  return buf;
}

/** Simple tonal placeholder for arranger blocks — audible, length matches bar span. */
export function renderArrangerBlockToAudioBuffer(
  ctx: BaseAudioContext,
  durationSec: number,
  seed: number,
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const nFrames = Math.max(256, Math.ceil(Math.max(0.05, durationSec) * sampleRate));
  const buf = ctx.createBuffer(1, nFrames, sampleRate);
  const ch = buf.getChannelData(0);
  const f0 = 110 + (Math.abs(seed) % 500);
  for (let i = 0; i < nFrames; i++) {
    const t = i / sampleRate;
    ch[i] = 0.12 * Math.sin(2 * Math.PI * f0 * t) * (1 - t / Math.max(durationSec, 0.05)) * 0.85;
  }
  return buf;
}

export interface StudioClipLike {
  id: number;
  bar: number;
  len: number;
  label: string;
  audioBuffer?: AudioBuffer;
}

export interface StudioTrackLike {
  id: number;
  name: string;
  type: string;
  color: string;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  volume: number;
  clips: StudioClipLike[];
  audioTrack?: number;
}

/**
 * After mergeSessionTracksIntoStudioTracks + stripModuleSessionClips, add [CS]/[AI]/[Arr] clips with buffers.
 * Creation Station clips decode pad samples from the shared pad-sample store and render one AudioBuffer per used channel (not one mixed master clip).
 */
export async function applySessionModuleClips(
  tracks: StudioTrackLike[],
  ctx: AudioContext,
  bpmFallback: number,
  nextClipId: () => number,
): Promise<StudioTrackLike[]> {
  const cs = readCreationStationClipPayloadFromStorage();
  const ai = readAiPatternClipPayloadFromStorage();
  const arr = readMasterArrangerClipPayloadFromStorage();
  const out = tracks.map((t) => ({ ...t, clips: [...t.clips] }));

  /**
   * Master Clock (`bpmFallback` from Studio) is authoritative for buffer render duration.
   * Module payloads may still carry `bpm` for metadata; using it for render would desync clips from transport.
   */
  const tempoRender = Math.max(
    40,
    Number.isFinite(bpmFallback) && bpmFallback > 0 ? bpmFallback : 120,
  );
  const bpmCs = tempoRender;
  const bpmAi = tempoRender;
  const bpmArr = tempoRender;

  const padSamplesDecoded = await decodeAllPadSamples(ctx);

  if (cs?.drums?.length && cs.padChannels?.length) {
    const loopBars =
      cs.drumLoopBars && Number.isFinite(cs.drumLoopBars) && cs.drumLoopBars > 0
        ? cs.drumLoopBars
        : 16;
    const measuresPerBar =
      cs.measuresPerBar && Number.isFinite(cs.measuresPerBar) && cs.measuresPerBar > 0
        ? cs.measuresPerBar
        : 4;
    const totalSteps = loopBars * measuresPerBar;
    const byChannel = buildCreationChannelRowPatterns(cs);

    for (const [channelId, spec] of byChannel) {
      if (!patternHasContent(spec.rows)) continue;
      const tr = out.find((t) => t.audioTrack === channelId);
      if (!tr) continue;

      const buf = renderCreationChannelToAudioBuffer(
        ctx,
        cs,
        spec,
        padSamplesDecoded,
        bpmCs,
        totalSteps,
      );
      const label = creationChannelLabel(channelId, cs.padChannels);
      tr.clips.push({
        id: nextClipId(),
        bar: 1,
        len: Math.max(1 / 16, loopBars),
        label,
        audioBuffer: buf,
      });
    }
  }

  if (ai?.tracks?.length) {
    const loopBars =
      ai.loopLength && Number.isFinite(ai.loopLength) && ai.loopLength > 0 ? ai.loopLength : 8;
    const maxIdx = ai.tracks.reduce((m, x) => Math.max(m, x.idx), 0);
    const nAiLanes = Math.max(AI_PATTERN_TRACK_COUNT, ai.tracks.length, maxIdx + 1);
    for (let i = 0; i < nAiLanes; i++) {
      const slot = AI_PATTERN_SESSION_BASE + i;
      const row = ai.tracks.find((x) => x.idx === i);
      const pattern = row?.pattern;
      if (!patternHasContent(pattern || null)) continue;

      const tr = out.find((t) => t.audioTrack === slot);
      if (!tr) continue;

      const totalSteps =
        ai.totalSteps && ai.totalSteps > 0 ? ai.totalSteps : Math.max(1, loopBars) * 4;
      const buf = renderAiPatternToAudioBuffer(ctx, pattern as boolean[][], bpmAi, totalSteps);
      const label = `[AI] ${tr.name.replace(/^AI:\s*/i, '').trim() || `Pattern ${i + 1}`}`;
      tr.clips.push({
        id: nextClipId(),
        bar: 1,
        len: Math.max(1 / 16, loopBars),
        label,
        audioBuffer: buf,
      });
    }
  }

  if (arr?.blocks?.length) {
    const arrBase = getMasterArrangerSessionBase();
    for (const b of arr.blocks) {
      const slot = arrBase + Math.max(0, b.trackId - 1);
      const tr = out.find((t) => t.audioTrack === slot);
      if (!tr) continue;

      const durSec = Math.max(0.05, b.len * 4 * (60 / bpmArr));
      const buf = renderArrangerBlockToAudioBuffer(ctx, durSec, b.id * 997 + b.bar * 13);
      const label = `[Arr] ${b.label}`;
      tr.clips.push({
        id: nextClipId(),
        bar: Math.max(1, b.bar),
        len: Math.max(1 / 16, b.len),
        label,
        audioBuffer: buf,
      });
    }
  }

  return out;
}
