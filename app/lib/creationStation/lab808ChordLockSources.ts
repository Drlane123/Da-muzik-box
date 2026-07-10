/**
 * 808 Lab chord-lock sources — Chord Builder, Groove Lab roll, or NEW SYNTH chord rail.
 */
import type { ChordMode, ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import {
  chordSymbolToRootMidi,
  coerceChordSymbolForMode,
} from '@/app/lib/creationStation/chordBuilder';
import { cbPianoMidiToNoteName } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import type { BeatLabImportedChordRail } from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import type { ChordSyncBlock } from '@/app/lib/chordBuilderSync';
import {
  build808RootNotesFromBlocks,
  fitProgressionRootsTo808Roll,
  lab808HarmonicBassMidi,
  LAB808_BEATS_PER_BAR,
  LAB808_DEFAULT_ROOT_OCTAVE_SHIFT,
  type Lab808ProgressionRoot,
} from '@/app/lib/creationStation/lab808ChordRoots';
import { readChordSync } from '@/app/lib/chordBuilderSync';
import {
  grooveLabChordHitsForBarLeadLock,
  grooveLabChordHitsForTransport,
  GROOVE_LAB_SLOTS_PER_BAR,
  grooveLabChannelIds,
  loadGrooveLabSession,
  sanitizeGrooveLabChordChannelHits,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';
import { grooveLabIsBassSubMidi } from '@/app/lib/creationStation/grooveComposerEngine';
import {
  GROOVE_LAB_BASS_REFERENCE_MIDI,
  GROOVE_LAB_CHORD_ROLL_MIDI_MIN,
  grooveLabInferBassRootFromChordMidis,
} from '@/app/lib/creationStation/grooveLabPitch';

export type Lab808ChordLockSource = 'chord-builder' | 'groove-lab' | 'new-synth';

export const LAB808_CHORD_LOCK_SOURCE_STORAGE = 'da_808_chord_lock_source_v1';

export const DA_BEAT_LAB_SYNTH_CHORD_RAIL_SYNC_KEY = 'da_beat_lab_synth_chord_rail_sync_v1';

export const LAB808_CHORD_SOURCES_CHANGED_EVENT = 'da-808-chord-sources-changed';

const GROOVE_CHORD_CH_KEY = 'groove-lab-chord-ch';

export const LAB808_CHORD_LOCK_SOURCE_LABELS: Record<Lab808ChordLockSource, string> = {
  'chord-builder': 'Chord Builder',
  'groove-lab': 'Groove Lab',
  'new-synth': 'New Synth',
};

export function readLab808ChordLockSource(): Lab808ChordLockSource {
  if (typeof window === 'undefined') return 'chord-builder';
  try {
    const raw = window.localStorage.getItem(LAB808_CHORD_LOCK_SOURCE_STORAGE);
    if (raw === 'groove-lab' || raw === 'new-synth' || raw === 'chord-builder') return raw;
  } catch {
    /* ignore */
  }
  return 'chord-builder';
}

export function storeLab808ChordLockSource(source: Lab808ChordLockSource): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAB808_CHORD_LOCK_SOURCE_STORAGE, source);
  } catch {
    /* quota */
  }
}

export function notifyLab808ChordSourcesChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LAB808_CHORD_SOURCES_CHANGED_EVENT));
}

export function writeBeatLabSynthChordRailSync(rail: BeatLabImportedChordRail | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (rail?.timeline?.length) {
      window.localStorage.setItem(DA_BEAT_LAB_SYNTH_CHORD_RAIL_SYNC_KEY, JSON.stringify(rail));
    } else {
      window.localStorage.removeItem(DA_BEAT_LAB_SYNTH_CHORD_RAIL_SYNC_KEY);
    }
  } catch {
    /* quota */
  }
  notifyLab808ChordSourcesChanged();
}

export function readBeatLabSynthChordRailSync(): BeatLabImportedChordRail | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DA_BEAT_LAB_SYNTH_CHORD_RAIL_SYNC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BeatLabImportedChordRail>;
    if (!Array.isArray(parsed.timeline) || parsed.timeline.length === 0) return null;
    return {
      timeline: parsed.timeline,
      keyRoot: typeof parsed.keyRoot === 'number' ? parsed.keyRoot : 0,
      mode: parsed.mode === 'minor' ? 'minor' : 'major',
    };
  } catch {
    return null;
  }
}

function readGrooveLabChordChannelPref(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = Number(window.localStorage.getItem(GROOVE_CHORD_CH_KEY));
    if (Number.isFinite(v)) return v;
  } catch {
    /* ignore */
  }
  return null;
}

function pickGrooveLabChordChannel(
  notesByChannel: Record<number, GrooveRollHit[]>,
  preferred?: number | null,
): number | null {
  const ids = grooveLabChannelIds();
  if (preferred != null && ids.includes(preferred)) {
    const hits = (notesByChannel[preferred] ?? []).filter((h) => h.midi >= GROOVE_LAB_CHORD_ROLL_MIDI_MIN);
    if (hits.length > 0) return preferred;
  }
  let bestCh: number | null = null;
  let bestCount = 0;
  for (const ch of ids) {
    const count = (notesByChannel[ch] ?? []).filter((h) => h.midi >= GROOVE_LAB_CHORD_ROLL_MIDI_MIN).length;
    if (count > bestCount) {
      bestCount = count;
      bestCh = ch;
    }
  }
  return bestCh;
}

type RootSegment = { startBeat: number; durBeats: number; midi: number; chord: string };

function infer808RootMidiForColumn(
  chordHits: readonly GrooveRollHit[],
  subHitsInBar: readonly GrooveRollHit[],
  keyRoot: number,
  mode: ChordMode,
): number {
  const subs = subHitsInBar.filter((h) => grooveLabIsBassSubMidi(h.midi));
  if (subs.length > 0) {
    return subs.reduce((a, b) => (a.midi < b.midi ? a : b)).midi;
  }
  const midis = chordHits.map((h) => h.midi);
  return grooveLabInferBassRootFromChordMidis(
    midis,
    keyRoot,
    mode,
    GROOVE_LAB_BASS_REFERENCE_MIDI,
  );
}

function extendRootSegmentDurations(segments: RootSegment[]): RootSegment[] {
  const sorted = [...segments].sort((a, b) => a.startBeat - b.startBeat);
  return sorted.map((seg, i) => {
    const next = sorted[i + 1];
    const endBeat = next ? next.startBeat : seg.startBeat + seg.durBeats;
    return { ...seg, durBeats: Math.max(0.25, endBeat - seg.startBeat) };
  });
}

function segmentsToProgressionRoots(segments: RootSegment[], octaveShift: number): Lab808ProgressionRoot[] {
  if (segments.length === 0) return [];
  const bassMidis = segments.map((s) =>
    lab808HarmonicBassMidi(s.midi + octaveShift * 12),
  );
  const rollMidis = fitProgressionRootsTo808Roll(bassMidis);
  return segments.map((s, i) => ({
    startBeat: s.startBeat,
    durBeats: s.durBeats,
    midi: bassMidis[i]!,
    rollMidi: rollMidis[i]!,
    chord: s.chord,
  }));
}

const GROOVE_SLOTS_PER_BEAT = GROOVE_LAB_SLOTS_PER_BAR / LAB808_BEATS_PER_BAR;

/**
 * One 808 root per bar on the downbeat — Groove CHORD rhythm edits (1+3, 2+4, chops)
 * stay on the chord roll but do not add extra 808 hits.
 */
function grooveLabChordColumnsToRootSegments(
  lockHits: readonly GrooveRollHit[],
  keyRoot: number,
  mode: ChordMode,
  subHits: readonly GrooveRollHit[] = [],
): RootSegment[] {
  if (lockHits.length === 0) return [];

  const byBar = new Map<number, GrooveRollHit[]>();
  for (const h of lockHits) {
    const bar = Math.floor(h.slot / GROOVE_LAB_SLOTS_PER_BAR);
    const list = byBar.get(bar) ?? [];
    list.push(h);
    byBar.set(bar, list);
  }

  const subsByBar = new Map<number, GrooveRollHit[]>();
  for (const h of subHits) {
    if (!grooveLabIsBassSubMidi(h.midi)) continue;
    const bar = Math.floor(h.slot / GROOVE_LAB_SLOTS_PER_BAR);
    const list = subsByBar.get(bar) ?? [];
    list.push(h);
    subsByBar.set(bar, list);
  }

  const segments: RootSegment[] = [];
  for (const bar of [...byBar.keys()].sort((a, b) => a - b)) {
    const barHits = byBar.get(bar)!;
    const subsInBar = subsByBar.get(bar) ?? [];
    const downbeatSlot = bar * GROOVE_LAB_SLOTS_PER_BAR;
    const downbeatHits = barHits.filter((h) => h.slot === downbeatSlot);
    const hitsForRoot = downbeatHits.length > 0 ? downbeatHits : barHits;
    const rootMidi = infer808RootMidiForColumn(hitsForRoot, subsInBar, keyRoot, mode);

    segments.push({
      startBeat: bar * LAB808_BEATS_PER_BAR,
      durBeats: LAB808_BEATS_PER_BAR,
      midi: rootMidi,
      chord: cbPianoMidiToNoteName(rootMidi),
    });
  }

  return extendRootSegmentDurations(segments);
}

/** Green chord stack at a roll beat (for 808 Lab harmony audition). */
export function grooveLabChordStackAtBeat(startBeat: number): {
  midis: number[];
  sustainSlots: number;
  vel: number;
} | null {
  const session = loadGrooveLabSession();
  const { notesByChannel, barCount } = session;
  const chordCh = pickGrooveLabChordChannel(notesByChannel, readGrooveLabChordChannelPref());
  if (chordCh == null) return null;

  const bars = Math.max(1, barCount ?? 16);
  const chordHits = sanitizeGrooveLabChordChannelHits(
    (notesByChannel[chordCh] ?? []).filter((h) => h.midi >= GROOVE_LAB_CHORD_ROLL_MIDI_MIN),
    bars,
  );
  if (chordHits.length === 0) return null;

  const bar = Math.floor(Math.max(0, startBeat) / LAB808_BEATS_PER_BAR);
  const downbeatSlot = bar * GROOVE_LAB_SLOTS_PER_BAR;
  const lockHits = grooveLabChordHitsForBarLeadLock(chordHits);
  let column = lockHits.filter((h) => h.slot === downbeatSlot);
  if (column.length === 0) {
    const transportHits = grooveLabChordHitsForTransport(chordHits, bars);
    const barHits = transportHits.filter(
      (h) => Math.floor(h.slot / GROOVE_LAB_SLOTS_PER_BAR) === bar,
    );
    if (barHits.length === 0) return null;
    const earliestSlot = Math.min(...barHits.map((h) => h.slot));
    column = barHits.filter((h) => h.slot === earliestSlot);
  }
  if (column.length === 0) return null;
  const midis = [...new Set(column.map((h) => Math.round(h.midi)))].sort((a, b) => a - b);
  if (midis.length === 0) return null;

  return {
    midis,
    sustainSlots: Math.max(...column.map((h) => h.sustainSlots), GROOVE_SLOTS_PER_BEAT),
    vel: Math.max(...column.map((h) => h.vel ?? 0.88)),
  };
}

export function grooveLabSessionToProgressionRoots(
  octaveShift = LAB808_DEFAULT_ROOT_OCTAVE_SHIFT,
): Lab808ProgressionRoot[] {
  const session = loadGrooveLabSession();
  const { notesByChannel, barCount } = session;
  const chordCh = pickGrooveLabChordChannel(notesByChannel, readGrooveLabChordChannelPref());
  if (chordCh == null) return [];

  const bars = Math.max(1, barCount ?? 16);
  const chordHits = sanitizeGrooveLabChordChannelHits(
    (notesByChannel[chordCh] ?? []).filter((h) => h.midi >= GROOVE_LAB_CHORD_ROLL_MIDI_MIN),
    bars,
  );
  if (chordHits.length === 0) return [];

  const subHits: GrooveRollHit[] = [];
  for (const ch of grooveLabChannelIds()) {
    if (ch === chordCh) continue;
    for (const h of notesByChannel[ch] ?? []) {
      if (grooveLabIsBassSubMidi(h.midi)) subHits.push(h);
    }
  }
  const lockHits = grooveLabChordHitsForBarLeadLock(chordHits);
  const sync = readChordSync();
  const keyRoot = sync?.keyRoot ?? 0;
  const mode = (sync?.mode as ChordMode) ?? 'major';

  const segments = grooveLabChordColumnsToRootSegments(lockHits, keyRoot, mode, subHits);
  return segmentsToProgressionRoots(segments, octaveShift);
}

export function beatLabSynthChordRailToProgressionRoots(
  rail: BeatLabImportedChordRail,
  octaveShift = LAB808_DEFAULT_ROOT_OCTAVE_SHIFT,
): Lab808ProgressionRoot[] {
  const blocks: Array<{ chord: ChordSymbol; bars: number }> = [];
  let i = 0;
  while (i < rail.timeline.length) {
    const ch = rail.timeline[i]?.chord;
    if (!ch) {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < rail.timeline.length && rail.timeline[j]?.chord === ch) j += 1;
    blocks.push({ chord: ch, bars: j - i });
    i = j;
  }
  if (blocks.length === 0) return [];

  let beat = 0;
  const segments: RootSegment[] = [];
  for (const block of blocks) {
    const sym = coerceChordSymbolForMode(block.chord, rail.mode);
    const root = chordSymbolToRootMidi(sym, rail.keyRoot, rail.mode, 0);
    if (root != null) {
      segments.push({
        startBeat: beat,
        durBeats: block.bars * LAB808_BEATS_PER_BAR,
        chord: sym,
        midi: root,
      });
    }
    beat += block.bars * LAB808_BEATS_PER_BAR;
  }

  return segmentsToProgressionRoots(segments, octaveShift);
}

export function lab808SourceHasProgressionSync(
  source: Lab808ChordLockSource,
  syncBlocks: ChordSyncBlock[] | null | undefined,
): boolean {
  switch (source) {
    case 'chord-builder':
      return (syncBlocks?.length ?? 0) > 0;
    case 'groove-lab':
      return grooveLabSessionToProgressionRoots(0).length > 0;
    case 'new-synth': {
      const rail = readBeatLabSynthChordRailSync();
      return rail != null && beatLabSynthChordRailToProgressionRoots(rail, 0).length > 0;
    }
  }
}

/** Pull chord roots from the locked source for 808 Kick/Bass roll (no manual roll override). */
export function fetchLab808RootsForChordLockSource(
  source: Lab808ChordLockSource,
  args: {
    sync: { keyRoot: number; mode: string; blocks: ChordSyncBlock[] } | null;
    mode: ChordMode;
    octaveShift?: number;
  },
): Lab808ProgressionRoot[] {
  return resolveLab808RootsForSource(source, { ...args, manualNotes: undefined });
}

export function resolveLab808RootsForSource(
  source: Lab808ChordLockSource,
  args: {
    sync: { keyRoot: number; mode: string; blocks: ChordSyncBlock[] } | null;
    mode: ChordMode;
    octaveShift?: number;
    manualNotes?: ReadonlyArray<{ startBeat: number; midi: number; durBeats: number }>;
  },
): Lab808ProgressionRoot[] {
  const octaveShift = args.octaveShift ?? LAB808_DEFAULT_ROOT_OCTAVE_SHIFT;

  if (args.manualNotes?.length) {
    const rollMidis = fitProgressionRootsTo808Roll(args.manualNotes.map((n) => n.midi));
    return args.manualNotes.map((n, i) => ({
      startBeat: n.startBeat,
      durBeats: n.durBeats,
      midi: lab808HarmonicBassMidi(n.midi),
      rollMidi: rollMidis[i]!,
      chord: '·',
    }));
  }

  switch (source) {
    case 'chord-builder':
      if (!args.sync?.blocks?.length) return [];
      return build808RootNotesFromBlocks(args.sync.blocks, args.sync.keyRoot, args.mode, octaveShift);
    case 'groove-lab':
      return grooveLabSessionToProgressionRoots(octaveShift);
    case 'new-synth': {
      const rail = readBeatLabSynthChordRailSync();
      if (!rail) return [];
      return beatLabSynthChordRailToProgressionRoots(rail, octaveShift);
    }
    default:
      return [];
  }
}
