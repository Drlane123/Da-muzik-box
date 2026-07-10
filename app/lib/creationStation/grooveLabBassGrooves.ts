import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  grooveLabColToSlotInBar,
  grooveLabColsPerBar,
} from '@/app/lib/creationStation/grooveLabGrid';
import {
  GROOVE_LAB_SLOTS_PER_BAR,
  grooveLabSlotsPerCell,
  grooveLabBassRootAtSlot,
  snapGrooveSlot,
  snapGrooveSustain,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';
import type { GrooveLabBassSoundId } from '@/app/lib/creationStation/grooveLabBassSounds';
import {
  grooveLabClampBassRootMidi,
  grooveLabCollapseBassRootsPerSlot,
  grooveLabTransposeBassByRoot,
} from '@/app/lib/creationStation/grooveLabPitch';
import { mulberry32, mixSeed, type Mode } from '@/app/lib/groovePatternEngine';

/** One note in a repeating 1-bar bass MIDI template (grid columns at current quantize). */
export type GrooveLabBassGrooveStep = {
  colInBar: number;
  degree: number;
  lenCols: number;
  vel?: number;
};

export type GrooveLabBassPatternFamily = '808' | 'guitar' | 'general';

export type GrooveLabBassGrooveId =
  | 'trap-808'
  | 'trap-808-slide'
  | 'drill-808'
  | 'hiphop-808-bounce'
  | 'rnb-808-silk'
  | 'pop-808-sub'
  | 'metro-808-two'
  | 'atl-808-hold'
  | 'pocket'
  | 'gtr-pop-8ths'
  | 'gtr-funk-chick'
  | 'gtr-rnb-pocket'
  | 'gtr-rock-root5'
  | 'gtr-walk'
  | 'gtr-trap-pluck'
  | 'gtr-disco-oct'
  | 'gtr-reggae-off'
  | 'pop-drive'
  | 'syncopated'
  | 'push'
  | 'clave-332'
  | 'moog-pulse';

export type GrooveLabBassGrooveDef = {
  id: GrooveLabBassGrooveId;
  label: string;
  genre: string;
  family: GrooveLabBassPatternFamily;
  steps: GrooveLabBassGrooveStep[];
};

const MODE_INTERVALS: Record<Mode, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

/** All pattern templates are authored on a 16th-note grid (16 columns per bar). */
export const GROOVE_LAB_PATTERN_COLS_PER_BAR = 16;

/** Per-bar degree shift (scale steps) for longer loops — repeats every 4 bars. */
export const GROOVE_BAR_PHRASE: Partial<Record<GrooveLabBassGrooveId, readonly number[]>> = {
  'trap-808': [0, 0, 2, 0],
  'trap-808-slide': [0, 5, 0, 4],
  'drill-808': [0, 0, 7, 5],
  'hiphop-808-bounce': [0, 4, 0, 2],
  'rnb-808-silk': [0, 0, 4, 2],
  'pop-808-sub': [0, 2, 0, 4],
  'metro-808-two': [0, 0, 5, 7],
  'atl-808-hold': [0, 4, 0, 0],
  'pocket': [0, 2, 0, 5],
  'gtr-pop-8ths': [0, 0, 4, 0],
  'gtr-funk-chick': [0, 0, 2, 5],
  'gtr-rnb-pocket': [0, 2, 0, 4],
  'gtr-rock-root5': [0, 0, 0, 0],
  'gtr-walk': [0, 0, 0, 0],
  'gtr-trap-pluck': [0, 7, 0, 5],
  'gtr-disco-oct': [0, 2, 0, 2],
  'gtr-reggae-off': [0, 0, 5, 0],
  'pop-drive': [0, 0, 2, 0],
  'syncopated': [0, 0, 4, 2],
  'push': [0, 0, 5, 0],
  'clave-332': [0, 2, 0, 5],
  'moog-pulse': [0, 0, 4, 2],
};

export const GROOVE_LAB_BASS_GROOVES: GrooveLabBassGrooveDef[] = [
  /* ── 808 / sub — melodic contour (root → 5th → octave), separate hits ── */
  {
    id: 'trap-808',
    label: 'Trap 808',
    genre: 'Trap',
    family: '808',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 3, vel: 1 },
      { colInBar: 6, degree: 4, lenCols: 2, vel: 0.84 },
      { colInBar: 10, degree: 7, lenCols: 2, vel: 0.78 },
      { colInBar: 13, degree: 4, lenCols: 1, vel: 0.72 },
    ],
  },
  {
    id: 'trap-808-slide',
    label: '808 Slide',
    genre: 'Trap',
    family: '808',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 4, vel: 1 },
      { colInBar: 7, degree: 2, lenCols: 2, vel: 0.8 },
      { colInBar: 10, degree: 4, lenCols: 2, vel: 0.86 },
      { colInBar: 14, degree: 7, lenCols: 1, vel: 0.74 },
    ],
  },
  {
    id: 'drill-808',
    label: 'Drill 808',
    genre: 'Drill',
    family: '808',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 2, vel: 1 },
      { colInBar: 3, degree: 7, lenCols: 1, vel: 0.72 },
      { colInBar: 6, degree: 4, lenCols: 2, vel: 0.88 },
      { colInBar: 9, degree: 0, lenCols: 1, vel: 0.8 },
      { colInBar: 11, degree: 5, lenCols: 1, vel: 0.76 },
      { colInBar: 14, degree: 2, lenCols: 1, vel: 0.82 },
    ],
  },
  {
    id: 'hiphop-808-bounce',
    label: 'Hip-Hop Bounce',
    genre: 'Hip-Hop',
    family: '808',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 2, vel: 1 },
      { colInBar: 4, degree: 4, lenCols: 2, vel: 0.86 },
      { colInBar: 8, degree: 0, lenCols: 2, vel: 0.9 },
      { colInBar: 12, degree: 7, lenCols: 2, vel: 0.82 },
    ],
  },
  {
    id: 'rnb-808-silk',
    label: 'R&B 808 Silk',
    genre: 'R&B',
    family: '808',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 4, vel: 1 },
      { colInBar: 6, degree: 2, lenCols: 2, vel: 0.82 },
      { colInBar: 10, degree: 4, lenCols: 3, vel: 0.88 },
      { colInBar: 14, degree: 2, lenCols: 1, vel: 0.75 },
    ],
  },
  {
    id: 'pop-808-sub',
    label: 'Pop Sub',
    genre: 'Pop',
    family: '808',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 2, vel: 1 },
      { colInBar: 4, degree: 2, lenCols: 1, vel: 0.88 },
      { colInBar: 8, degree: 4, lenCols: 2, vel: 0.9 },
      { colInBar: 12, degree: 2, lenCols: 1, vel: 0.85 },
      { colInBar: 14, degree: 0, lenCols: 1, vel: 0.8 },
    ],
  },
  {
    id: 'metro-808-two',
    label: 'Metro Two-Hit',
    genre: 'Trap',
    family: '808',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 4, vel: 1 },
      { colInBar: 8, degree: 5, lenCols: 3, vel: 0.78 },
      { colInBar: 13, degree: 4, lenCols: 1, vel: 0.7 },
    ],
  },
  {
    id: 'atl-808-hold',
    label: 'ATL Hold',
    genre: 'Trap',
    family: '808',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 6, vel: 1 },
      { colInBar: 8, degree: 4, lenCols: 4, vel: 0.82 },
      { colInBar: 14, degree: 0, lenCols: 1, vel: 0.76 },
    ],
  },
  {
    id: 'pocket',
    label: 'R&B Pocket (808)',
    genre: 'R&B',
    family: '808',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 2, vel: 1 },
      { colInBar: 3, degree: 2, lenCols: 1, vel: 0.82 },
      { colInBar: 6, degree: 4, lenCols: 2, vel: 0.78 },
      { colInBar: 10, degree: 2, lenCols: 1, vel: 0.8 },
      { colInBar: 12, degree: 0, lenCols: 2, vel: 0.86 },
    ],
  },
  /* ── Bass guitar — short plucks, walking degrees ── */
  {
    id: 'gtr-pop-8ths',
    label: 'Gtr Pop 8ths',
    genre: 'Pop',
    family: 'guitar',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 1, vel: 1 },
      { colInBar: 2, degree: 2, lenCols: 1, vel: 0.8 },
      { colInBar: 4, degree: 4, lenCols: 1, vel: 0.92 },
      { colInBar: 6, degree: 2, lenCols: 1, vel: 0.8 },
      { colInBar: 8, degree: 0, lenCols: 1, vel: 0.88 },
      { colInBar: 10, degree: 2, lenCols: 1, vel: 0.8 },
      { colInBar: 12, degree: 4, lenCols: 1, vel: 0.9 },
      { colInBar: 14, degree: 0, lenCols: 1, vel: 0.78 },
    ],
  },
  {
    id: 'gtr-funk-chick',
    label: 'Gtr Funk Chick',
    genre: 'Funk',
    family: 'guitar',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 1, vel: 1 },
      { colInBar: 3, degree: 0, lenCols: 1, vel: 0.75 },
      { colInBar: 6, degree: 4, lenCols: 1, vel: 0.9 },
      { colInBar: 9, degree: 7, lenCols: 1, vel: 0.82 },
      { colInBar: 12, degree: 4, lenCols: 1, vel: 0.88 },
      { colInBar: 14, degree: 2, lenCols: 1, vel: 0.8 },
    ],
  },
  {
    id: 'gtr-rnb-pocket',
    label: 'Gtr R&B Pocket',
    genre: 'R&B',
    family: 'guitar',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 2, vel: 1 },
      { colInBar: 5, degree: 2, lenCols: 1, vel: 0.78 },
      { colInBar: 8, degree: 4, lenCols: 2, vel: 0.85 },
      { colInBar: 12, degree: 2, lenCols: 1, vel: 0.8 },
      { colInBar: 14, degree: 0, lenCols: 1, vel: 0.82 },
    ],
  },
  {
    id: 'gtr-rock-root5',
    label: 'Gtr Rock Root–5',
    genre: 'Rock',
    family: 'guitar',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 2, vel: 1 },
      { colInBar: 4, degree: 4, lenCols: 2, vel: 0.88 },
      { colInBar: 8, degree: 0, lenCols: 2, vel: 0.92 },
      { colInBar: 12, degree: 7, lenCols: 2, vel: 0.86 },
    ],
  },
  {
    id: 'gtr-walk',
    label: 'Gtr Walk',
    genre: 'Jazz',
    family: 'guitar',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 1, vel: 0.95 },
      { colInBar: 2, degree: 2, lenCols: 1, vel: 0.82 },
      { colInBar: 4, degree: 4, lenCols: 1, vel: 0.88 },
      { colInBar: 6, degree: 2, lenCols: 1, vel: 0.8 },
      { colInBar: 8, degree: 0, lenCols: 1, vel: 0.9 },
      { colInBar: 10, degree: 5, lenCols: 1, vel: 0.78 },
      { colInBar: 12, degree: 4, lenCols: 1, vel: 0.85 },
      { colInBar: 14, degree: 2, lenCols: 1, vel: 0.8 },
    ],
  },
  {
    id: 'gtr-trap-pluck',
    label: 'Gtr Trap Pluck',
    genre: 'Trap',
    family: 'guitar',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 1, vel: 1 },
      { colInBar: 4, degree: 7, lenCols: 1, vel: 0.72 },
      { colInBar: 8, degree: 4, lenCols: 1, vel: 0.85 },
      { colInBar: 12, degree: 0, lenCols: 1, vel: 0.78 },
      { colInBar: 14, degree: 2, lenCols: 1, vel: 0.7 },
    ],
  },
  {
    id: 'gtr-disco-oct',
    label: 'Gtr Disco Octave',
    genre: 'Disco',
    family: 'guitar',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 1, vel: 1 },
      { colInBar: 1, degree: 4, lenCols: 1, vel: 0.85 },
      { colInBar: 2, degree: 0, lenCols: 1, vel: 0.92 },
      { colInBar: 3, degree: 4, lenCols: 1, vel: 0.88 },
      { colInBar: 4, degree: 0, lenCols: 1, vel: 0.9 },
      { colInBar: 6, degree: 7, lenCols: 1, vel: 0.86 },
      { colInBar: 8, degree: 0, lenCols: 1, vel: 0.88 },
      { colInBar: 10, degree: 4, lenCols: 1, vel: 0.84 },
      { colInBar: 12, degree: 7, lenCols: 1, vel: 0.9 },
      { colInBar: 14, degree: 4, lenCols: 1, vel: 0.82 },
    ],
  },
  {
    id: 'gtr-reggae-off',
    label: 'Gtr Reggae Offbeat',
    genre: 'Reggae',
    family: 'guitar',
    steps: [
      { colInBar: 2, degree: 0, lenCols: 1, vel: 0.95 },
      { colInBar: 6, degree: 4, lenCols: 1, vel: 0.88 },
      { colInBar: 10, degree: 0, lenCols: 1, vel: 0.9 },
      { colInBar: 14, degree: 5, lenCols: 1, vel: 0.85 },
    ],
  },
  /* ── Universal / Moog-friendly ── */
  {
    id: 'pop-drive',
    label: 'Pop Drive',
    genre: 'Pop',
    family: 'general',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 1, vel: 1 },
      { colInBar: 2, degree: 2, lenCols: 1, vel: 0.8 },
      { colInBar: 4, degree: 4, lenCols: 1, vel: 0.92 },
      { colInBar: 6, degree: 2, lenCols: 1, vel: 0.8 },
      { colInBar: 8, degree: 0, lenCols: 1, vel: 0.88 },
      { colInBar: 10, degree: 5, lenCols: 1, vel: 0.8 },
      { colInBar: 12, degree: 4, lenCols: 1, vel: 0.9 },
      { colInBar: 14, degree: 2, lenCols: 1, vel: 0.78 },
    ],
  },
  {
    id: 'syncopated',
    label: 'Syncopated',
    genre: 'Funk',
    family: 'general',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 2, vel: 1 },
      { colInBar: 5, degree: 2, lenCols: 1, vel: 0.85 },
      { colInBar: 8, degree: 4, lenCols: 2, vel: 0.88 },
      { colInBar: 11, degree: 7, lenCols: 1, vel: 0.8 },
      { colInBar: 14, degree: 4, lenCols: 1, vel: 0.82 },
    ],
  },
  {
    id: 'push',
    label: 'Push',
    genre: 'Pop',
    family: 'general',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 3, vel: 1 },
      { colInBar: 4, degree: 4, lenCols: 2, vel: 0.88 },
      { colInBar: 8, degree: 0, lenCols: 3, vel: 0.92 },
      { colInBar: 12, degree: 7, lenCols: 2, vel: 0.86 },
      { colInBar: 14, degree: 4, lenCols: 1, vel: 0.8 },
    ],
  },
  {
    id: 'clave-332',
    label: '3-3-2',
    genre: 'Latin',
    family: 'general',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 2, vel: 1 },
      { colInBar: 3, degree: 4, lenCols: 2, vel: 0.88 },
      { colInBar: 6, degree: 0, lenCols: 2, vel: 0.9 },
      { colInBar: 10, degree: 7, lenCols: 2, vel: 0.84 },
      { colInBar: 14, degree: 4, lenCols: 1, vel: 0.8 },
    ],
  },
  {
    id: 'moog-pulse',
    label: 'Moog Pulse',
    genre: 'Synth',
    family: 'general',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 2, vel: 1 },
      { colInBar: 4, degree: 4, lenCols: 2, vel: 0.84 },
      { colInBar: 8, degree: 0, lenCols: 2, vel: 0.88 },
      { colInBar: 12, degree: 7, lenCols: 2, vel: 0.82 },
    ],
  },
];

export const GROOVE_LAB_MIDI_PATTERN_GROUPS: ReadonlyArray<{
  label: string;
  family: GrooveLabBassPatternFamily;
}> = [
  { label: '808 / Trap / Sub', family: '808' },
  { label: 'Bass Guitar', family: 'guitar' },
  { label: 'Universal / Moog', family: 'general' },
];

export const GROOVE_LAB_BASS_GROOVE_DEFAULT: GrooveLabBassGrooveId = 'trap-808';

export function grooveLabBassGrooveDef(id: GrooveLabBassGrooveId): GrooveLabBassGrooveDef {
  return GROOVE_LAB_BASS_GROOVES.find((g) => g.id === id) ?? GROOVE_LAB_BASS_GROOVES[0]!;
}

export function grooveLabBassGroovesForFamily(family: GrooveLabBassPatternFamily): GrooveLabBassGrooveDef[] {
  return GROOVE_LAB_BASS_GROOVES.filter((g) => g.family === family);
}

/** MIDI pattern family to match the selected playback sound. */
export function grooveLabPatternFamilyForBassSound(soundId: GrooveLabBassSoundId): GrooveLabBassPatternFamily {
  if (soundId.startsWith('gtr')) return 'guitar';
  if (soundId.startsWith('moog')) return 'general';
  return '808';
}

export function grooveLabDefaultGrooveForSound(soundId: GrooveLabBassSoundId): GrooveLabBassGrooveId {
  const family = grooveLabPatternFamilyForBassSound(soundId);
  return grooveLabBassGroovesForFamily(family)[0]?.id ?? GROOVE_LAB_BASS_GROOVE_DEFAULT;
}

function degreeToMidi(rootMidi: number, degree: number, mode: Mode): number {
  const intervals = MODE_INTERVALS[mode];
  const iv = intervals[((degree % intervals.length) + intervals.length) % intervals.length]!;
  const oct = Math.floor(degree / intervals.length) * 12;
  return rootMidi + iv + oct;
}

/** Map template column (0–15 sixteenths) to the active quantize grid. */
function patternColToSlotInBar(colInBar: number, q: GrooveLabQuantize): number {
  const colsPerBar = grooveLabColsPerBar(q);
  const scaled = Math.min(
    colsPerBar - 1,
    Math.max(0, Math.round((colInBar / GROOVE_LAB_PATTERN_COLS_PER_BAR) * colsPerBar)),
  );
  return grooveLabColToSlotInBar(scaled, q);
}

function patternLenToSustainSlots(lenCols: number, q: GrooveLabQuantize): number {
  const snapStep = grooveLabSlotsPerCell(q);
  const scaledLen = Math.max(
    1,
    Math.round((lenCols / GROOVE_LAB_PATTERN_COLS_PER_BAR) * grooveLabColsPerBar(q)),
  );
  return Math.max(snapStep, scaledLen * snapStep);
}

function maxSustainCap(
  family: GrooveLabBassPatternFamily,
  grooveId: GrooveLabBassGrooveId,
  snapStep: number,
): number {
  if (family === 'guitar') return snapStep * 2;
  if (grooveId === 'atl-808-hold' || grooveId === 'rnb-808-silk') return snapStep * 6;
  if (family === '808') return snapStep * 4;
  return snapStep * 3;
}

/** Nudge colliding onsets so sanitize does not drop duplicate slot keys. */
function resolveBassHitSlotCollisions(hits: GrooveRollHit[], snapStep: number): GrooveRollHit[] {
  const sorted = [...hits].sort((a, b) => a.slot - b.slot || a.midi - b.midi);
  const occupied = new Set<number>();
  return sorted.map((h) => {
    let slot = h.slot;
    while (occupied.has(slot)) slot += snapStep;
    occupied.add(slot);
    return slot === h.slot ? h : { ...h, slot };
  });
}

function finalizeGrooveLabBassHits(
  hits: GrooveRollHit[],
  snapStep: number,
  referenceMidi: number,
  rootsOnly: boolean,
): GrooveRollHit[] {
  const trimmed = trimBassHitSustains(resolveBassHitSlotCollisions(hits, snapStep), snapStep);
  if (!rootsOnly) {
    return trimmed.map((h) => ({
      ...h,
      midi: grooveLabClampBassRootMidi(h.midi, referenceMidi),
    }));
  }
  const roots = grooveLabCollapseBassRootsPerSlot(trimmed);
  const bySlot = new Map(roots.map((r) => [r.slot, r.midi]));
  return trimmed
    .filter((h) => bySlot.get(h.slot) === h.midi)
    .map((h) => ({ ...h, midi: grooveLabClampBassRootMidi(h.midi, referenceMidi) }));
}

/** Stop each note before the next onset so the roll shows separate melodic hits. */
function trimBassHitSustains(hits: GrooveRollHit[], snapStep: number): GrooveRollHit[] {
  const sorted = [...hits].sort((a, b) => a.slot - b.slot || a.midi - b.midi);
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const next = sorted[i + 1];
    if (next) {
      const gap = next.slot - cur.slot;
      cur.sustainSlots = Math.min(cur.sustainSlots, Math.max(snapStep, gap));
    }
  }
  return sorted;
}

/** Bass-only MIDI hits for the full loop (no chords). */
export function generateGrooveLabBassline(opts: {
  grooveId: GrooveLabBassGrooveId;
  rootMidi: number;
  mode: Mode;
  barCount: number;
  quantize: GrooveLabQuantize;
  seed?: number;
  /** When false (default), keep full pattern notes — not only the lowest root per column. */
  rootsOnly?: boolean;
  /** When true, do not apply per-bar phrase shift (used when re-harmonizing to chord columns). */
  followChordHarmony?: boolean;
}): GrooveRollHit[] {
  const groove = grooveLabBassGrooveDef(opts.grooveId);
  const snapStep = grooveLabSlotsPerCell(opts.quantize);
  const phrase = GROOVE_BAR_PHRASE[opts.grooveId] ?? [0, 0, 0, 0];
  const susCap = maxSustainCap(groove.family, opts.grooveId, snapStep);
  const rand = mulberry32(opts.seed ?? mixSeed([opts.grooveId, opts.rootMidi, opts.barCount, opts.quantize]));
  const hits: GrooveRollHit[] = [];

  for (let bar = 0; bar < opts.barCount; bar++) {
    const barShift = opts.followChordHarmony ? 0 : (phrase[bar % phrase.length] ?? 0);
    for (const step of groove.steps) {
      const slotInBar = patternColToSlotInBar(step.colInBar, opts.quantize);
      const rawSlot = bar * GROOVE_LAB_SLOTS_PER_BAR + slotInBar;
      const slot = snapGrooveSlot(rawSlot, opts.quantize, opts.barCount);
      let sus = patternLenToSustainSlots(step.lenCols, opts.quantize);
      sus = Math.min(sus, susCap);
      sus = snapGrooveSustain(slot, sus, opts.quantize, opts.barCount);
      const jitter = (rand() - 0.5) * 0.08;
      const vel = Math.max(0.55, Math.min(1, (step.vel ?? 0.88) + jitter));
      const degree = step.degree + barShift;
      let midi = degreeToMidi(opts.rootMidi, degree, opts.mode);
      midi = grooveLabClampBassRootMidi(midi, opts.rootMidi);
      hits.push({ slot, midi, sustainSlots: sus, vel });
    }
  }

  return finalizeGrooveLabBassHits(hits, snapStep, opts.rootMidi, opts.rootsOnly === true);
}

/** Bass MIDI pattern that follows green chord columns (chords-first workflow). */
export function generateGrooveLabBasslineFromChordAnchors(opts: {
  grooveId: GrooveLabBassGrooveId;
  chordAnchors: readonly { slot: number; midi: number }[];
  fallbackRootMidi: number;
  mode: Mode;
  barCount: number;
  quantize: GrooveLabQuantize;
  seed?: number;
}): GrooveRollHit[] {
  if (opts.chordAnchors.length === 0) {
    return generateGrooveLabBassline({
      grooveId: opts.grooveId,
      rootMidi: opts.fallbackRootMidi,
      mode: opts.mode,
      barCount: opts.barCount,
      quantize: opts.quantize,
      seed: opts.seed,
    });
  }

  const patternRoot = grooveLabClampBassRootMidi(
    opts.chordAnchors[0]!.midi,
    opts.fallbackRootMidi,
  );
  const base = generateGrooveLabBassline({
    grooveId: opts.grooveId,
    rootMidi: patternRoot,
    mode: opts.mode,
    barCount: opts.barCount,
    quantize: opts.quantize,
    seed: opts.seed,
    rootsOnly: false,
    followChordHarmony: true,
  });

  return base.map((h) => {
    const toRoot = grooveLabBassRootAtSlot(h.slot, opts.chordAnchors, opts.fallbackRootMidi);
    return {
      ...h,
      midi: grooveLabTransposeBassByRoot(h.midi, patternRoot, toRoot),
    };
  });
}

