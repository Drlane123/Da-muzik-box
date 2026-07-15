/**
 * Beat Pads — ORCH hits Lab voice (Sound Families orchestra hits on a piano grid).
 */
import type { OrchestraHitId } from '@/app/lib/creationStation/grooveLabOrchestraHitBank';
import {
  se2Lab808DefaultChordLock,
  type Se2Lab808ChordLock,
} from '@/app/lib/studio/se2Lab808ChordLock';

export const BEAT_PADS_ORCH_HITS_LOOP_BARS_OPTIONS = [4, 8] as const;
export type BeatPadsOrchHitsLoopBars = (typeof BEAT_PADS_ORCH_HITS_LOOP_BARS_OPTIONS)[number];
export const BEAT_PADS_ORCH_HITS_DEFAULT_LOOP_BARS: BeatPadsOrchHitsLoopBars = 4;

export const BEAT_PADS_ORCH_HITS_STEPS_PER_BAR = 16;
export const BEAT_PADS_ORCH_HITS_PIANO_LANES = 16;
export const BEAT_PADS_ORCH_HITS_DEFAULT_BASE_MIDI = 48;

/** Sound Families pad index → Groove Lab orchHit_* id (16 pads). */
export const BEAT_PADS_ORCH_HIT_IDS: readonly OrchestraHitId[] = [
  'orchHit_brass',
  'orchHit_proteus',
  'orchHit_jv2080',
  'orchHit_sc88',
  'orchHit_strings',
  'orchHit_trapBrass',
  'orchHit_pizz',
  'orchHit_pizzChord',
  'orchHit_tg500',
  'orchHit_timpHard',
  'orchHit_timpSmack',
  'orchHit_timpHop',
  'orchHit_choir',
  'orchHit_cym',
  'orchHit_cymSym',
  'orchHit_cine',
] as const;

export const BEAT_PADS_ORCH_HIT_LABELS: readonly string[] = [
  'K2000 sym',
  'Proteus brs',
  'JV2080 hit',
  'SC-88 orch',
  'Orch stab',
  'Brass stab',
  'Pizzicato',
  'Pizz chord',
  'TG brass',
  'Hard hit',
  'Smack hit',
  'Hop hit',
  'Choir stab',
  'Orch crash',
  'Sym crash',
  'Cinematic',
] as const;

export type BeatPadsOrchHitsGrid = boolean[][];

export type BeatPadsOrchHitsVoice = {
  hitId: OrchestraHitId;
  loopBars: BeatPadsOrchHitsLoopBars;
  /** 16 pitch lanes × (loopBars × 16) sixteenth columns. */
  gridSteps: BeatPadsOrchHitsGrid;
  chordLock: Se2Lab808ChordLock;
  /** Bottom lane MIDI (lane 0); higher lanes = +1 semitone each. */
  baseMidi: number;
  level: number;
};

export function beatPadsOrchHitsNormalizeLoopBars(raw: unknown): BeatPadsOrchHitsLoopBars {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : 0;
  if (n === 8) return 8;
  return 4;
}

/** Octave-fit a progression root into the visible ORCH piano grid. */
export function beatPadsOrchHitsFitRootMidi(rootMidi: number, baseMidi: number): number {
  const low = Math.max(24, Math.min(84, Math.round(baseMidi)));
  const high = low + BEAT_PADS_ORCH_HITS_PIANO_LANES - 1;
  let m = Math.round(rootMidi);
  while (m < low) m += 12;
  while (m > high) m -= 12;
  return Math.max(low, Math.min(high, m));
}

export function beatPadsOrchHitsStepCount(loopBars: number): number {
  return beatPadsOrchHitsNormalizeLoopBars(loopBars) * BEAT_PADS_ORCH_HITS_STEPS_PER_BAR;
}

export function beatPadsOrchHitsMidiForLane(baseMidi: number, lane: number): number {
  const base = Math.max(24, Math.min(84, Math.round(baseMidi)));
  const li = Math.max(0, Math.min(BEAT_PADS_ORCH_HITS_PIANO_LANES - 1, Math.round(lane)));
  return base + li;
}

export function emptyBeatPadsOrchHitsGrid(
  loopBars: BeatPadsOrchHitsLoopBars = BEAT_PADS_ORCH_HITS_DEFAULT_LOOP_BARS,
): BeatPadsOrchHitsGrid {
  const cols = beatPadsOrchHitsStepCount(loopBars);
  return Array.from({ length: BEAT_PADS_ORCH_HITS_PIANO_LANES }, () =>
    Array<boolean>(cols).fill(false),
  );
}

export function normalizeBeatPadsOrchHitsGrid(
  raw: readonly (readonly boolean[])[] | undefined,
  loopBars: BeatPadsOrchHitsLoopBars,
): BeatPadsOrchHitsGrid {
  const bars = beatPadsOrchHitsNormalizeLoopBars(loopBars);
  const cols = beatPadsOrchHitsStepCount(bars);
  const base = emptyBeatPadsOrchHitsGrid(bars);
  if (!raw?.length) return base;
  for (let lane = 0; lane < BEAT_PADS_ORCH_HITS_PIANO_LANES; lane += 1) {
    const row = raw[lane];
    if (!row?.length) continue;
    const n = Math.min(cols, row.length);
    for (let c = 0; c < n; c += 1) base[lane]![c] = Boolean(row[c]);
  }
  return base;
}

export function resizeBeatPadsOrchHitsGrid(
  pattern: BeatPadsOrchHitsGrid,
  fromBars: BeatPadsOrchHitsLoopBars,
  toBars: BeatPadsOrchHitsLoopBars,
): BeatPadsOrchHitsGrid {
  if (fromBars === toBars) return normalizeBeatPadsOrchHitsGrid(pattern, toBars);
  return normalizeBeatPadsOrchHitsGrid(pattern, toBars);
}

/**
 * Duplicate first 4 bars into the next 4.
 * On a 4-bar loop → expands to 8 and copies; on 8 → overwrites bars 5–8 from 1–4.
 */
export function beatPadsOrchHitsDuplicateFourBars(voice: BeatPadsOrchHitsVoice): BeatPadsOrchHitsVoice {
  const from = beatPadsOrchHitsNormalizeLoopBars(voice.loopBars);
  const cols4 = beatPadsOrchHitsStepCount(4);
  const src = normalizeBeatPadsOrchHitsGrid(voice.gridSteps, from);
  const dest = emptyBeatPadsOrchHitsGrid(8);
  for (let lane = 0; lane < BEAT_PADS_ORCH_HITS_PIANO_LANES; lane += 1) {
    for (let c = 0; c < cols4; c += 1) {
      const on = Boolean(src[lane]?.[c]);
      dest[lane]![c] = on;
      dest[lane]![c + cols4] = on;
    }
  }
  return { ...voice, loopBars: 8, gridSteps: dest };
}

export function beatPadsOrchHitsHasHits(grid: BeatPadsOrchHitsGrid | undefined): boolean {
  if (!grid?.length) return false;
  for (const row of grid) {
    if (row?.some(Boolean)) return true;
  }
  return false;
}

export function resolveBeatPadsOrchHitId(raw: unknown): OrchestraHitId {
  const s = typeof raw === 'string' ? raw : '';
  if ((BEAT_PADS_ORCH_HIT_IDS as readonly string[]).includes(s)) return s as OrchestraHitId;
  return BEAT_PADS_ORCH_HIT_IDS[0]!;
}

export function beatPadsOrchHitsDefaultVoice(): BeatPadsOrchHitsVoice {
  return {
    hitId: BEAT_PADS_ORCH_HIT_IDS[0]!,
    loopBars: BEAT_PADS_ORCH_HITS_DEFAULT_LOOP_BARS,
    gridSteps: emptyBeatPadsOrchHitsGrid(BEAT_PADS_ORCH_HITS_DEFAULT_LOOP_BARS),
    chordLock: se2Lab808DefaultChordLock(),
    baseMidi: BEAT_PADS_ORCH_HITS_DEFAULT_BASE_MIDI,
    level: 1,
  };
}

export function cloneBeatPadsOrchHitsVoice(voice: BeatPadsOrchHitsVoice): BeatPadsOrchHitsVoice {
  return {
    hitId: resolveBeatPadsOrchHitId(voice.hitId),
    loopBars: beatPadsOrchHitsNormalizeLoopBars(voice.loopBars),
    gridSteps: normalizeBeatPadsOrchHitsGrid(voice.gridSteps, voice.loopBars),
    chordLock: { ...voice.chordLock },
    baseMidi:
      typeof voice.baseMidi === 'number' && Number.isFinite(voice.baseMidi)
        ? Math.max(24, Math.min(84, Math.round(voice.baseMidi)))
        : BEAT_PADS_ORCH_HITS_DEFAULT_BASE_MIDI,
    level:
      typeof voice.level === 'number' && Number.isFinite(voice.level)
        ? Math.max(0.05, Math.min(1.5, voice.level))
        : 1,
  };
}

/** Place selected hit on downbeat of each bar at fitted root pitch. */
export function beatPadsOrchHitsPlaceRootsOnBars(
  voice: BeatPadsOrchHitsVoice,
  rootMidiPerBar: readonly number[],
): BeatPadsOrchHitsVoice {
  const bars = beatPadsOrchHitsNormalizeLoopBars(voice.loopBars);
  const grid = emptyBeatPadsOrchHitsGrid(bars);
  const base = voice.baseMidi;
  for (let bar = 0; bar < bars; bar += 1) {
    const raw = rootMidiPerBar[bar] ?? rootMidiPerBar[0] ?? base;
    const root = beatPadsOrchHitsFitRootMidi(raw, base);
    const lane = Math.max(0, Math.min(BEAT_PADS_ORCH_HITS_PIANO_LANES - 1, Math.round(root) - base));
    const col = bar * BEAT_PADS_ORCH_HITS_STEPS_PER_BAR;
    if (grid[lane]) grid[lane]![col] = true;
  }
  return { ...voice, gridSteps: grid };
}
