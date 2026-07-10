/**
 * Synth Geno plugin — chord labels + loop view layout helpers.
 */
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import type { GenoHarmony, GenoHarmonyColumn, GenoBarChopQuant } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { GenoLoopBarCount } from '@/app/lib/studio/se2SynthGenoLoopBarCount';
import {
  GENO_BASS_MIDI_MAX,
  GENO_BASS_MIDI_MIN,
  GENO_LIVE_CHORD_MIDI_MAX,
  GENO_LIVE_CHORD_MIDI_MIN,
  GENO_PLUGIN_MELODY_MIDI_MAX,
  GENO_PLUGIN_MELODY_MIDI_MIN,
  GENO_PLUGIN_FILLER_MIDI_MAX,
  GENO_PLUGIN_FILLER_MIDI_MIN,
} from '@/app/lib/studio/se2SynthGenoRanges';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const MAJOR_ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] as const;
const MINOR_ROMAN = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'] as const;

export function genoMidiNoteName(midi: number): string {
  const pc = ((Math.round(midi) % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc] ?? 'C'}${oct}`;
}

export function genoDegreeRomanNumeral(degree: number, mode: StudioDetectedKeyMode): string {
  const d = ((degree % 7) + 7) % 7;
  const pool = mode === 'minor' ? MINOR_ROMAN : MAJOR_ROMAN;
  return pool[d] ?? 'I';
}

export function genoChordSymbolForColumn(
  col: GenoHarmonyColumn,
  _keyRoot: number,
  _mode: StudioDetectedKeyMode,
): string {
  void _keyRoot;
  void _mode;
  const rootPc = ((Math.round(col.rootMidi) % 12) + 12) % 12;
  const rootName = NOTE_NAMES[rootPc] ?? 'C';
  const rel = [
    ...new Set(
      col.tones.map((t) => ((Math.round(t - col.rootMidi) % 12) + 12) % 12),
    ),
  ].sort((a, b) => a - b);
  if (rel.length === 0) return rootName;
  const hasSus4 = rel.includes(5) && !rel.includes(3) && !rel.includes(4);
  const hasMin3 = rel.includes(3);
  const hasMaj3 = rel.includes(4);
  const hasDim5 = rel.includes(6);
  const hasM7 = rel.includes(11);
  const hasDom7 = rel.includes(10);
  if (hasSus4) return `${rootName}sus4`;
  if (hasMin3 && hasDim5) return `${rootName}dim`;
  if (hasMin3) return hasDom7 || hasM7 ? `${rootName}m7` : `${rootName}m`;
  if (hasDom7) return `${rootName}7`;
  if (hasM7) return `${rootName}maj7`;
  return rootName;
}

export type GenoPluginLoopNoteBlock = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
  label: string;
};

export type GenoPluginLoopBarView = {
  bar: number;
  roman: string;
  chordSymbol: string;
  degree: number;
  chopQuant: GenoBarChopQuant;
  chordNotes: GenoPluginLoopNoteBlock[];
  melodyNotes: GenoPluginLoopNoteBlock[];
  bassNotes: GenoPluginLoopNoteBlock[];
};

function notesInBar(
  notes: readonly StudioEditor2GenNote[],
  bar: number,
  beatsPerBar: number,
): GenoPluginLoopNoteBlock[] {
  const start = bar * beatsPerBar;
  const end = start + beatsPerBar;
  return notes
    .filter((n) => n.startBeat >= start - 0.001 && n.startBeat < end - 0.001)
    .map((n) => {
      const relStart = n.startBeat - start;
      const maxDur = Math.max(0.08, end - n.startBeat);
      return {
        pitch: n.pitch,
        startBeat: relStart,
        durationBeats: Math.min(n.durationBeats, maxDur),
        velocity: n.velocity,
        label: genoMidiNoteName(n.pitch),
      };
    });
}

/**
 * Loop editor / preview timeline — 4, 8, or 12 bars only.
 * Never chord-card count, voicing depth (4–7 notes), or stale harmony column length.
 */
export function genoPluginLoopTimelineBarCount(opts: {
  loopBarCount?: number | null;
  timelineBarCount?: number | null;
  draftBars?: number | null;
}): GenoLoopBarCount {
  const controlled = opts.loopBarCount ?? opts.timelineBarCount;
  if (controlled === 4 || controlled === 8 || controlled === 12) return controlled;
  if (opts.draftBars === 4 || opts.draftBars === 8 || opts.draftBars === 12) return opts.draftBars;
  return 8;
}

export function genoBuildPluginLoopBarViews(opts: {
  harmony: GenoHarmony;
  chordNotes: readonly StudioEditor2GenNote[];
  melodyNotes: readonly StudioEditor2GenNote[];
  bassNotes: readonly StudioEditor2GenNote[];
  barCount: number;
  beatsPerBar: number;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  barChordSpecs?: readonly { degree?: number; chopQuant?: GenoBarChopQuant }[];
}): GenoPluginLoopBarView[] {
  return Array.from({ length: opts.barCount }, (_, bar) => {
    const col = opts.harmony.columns[bar];
    const specLen = opts.barChordSpecs?.length ?? 0;
    const spec = specLen > bar ? opts.barChordSpecs![bar] : undefined;
    const degree = spec?.degree ?? col?.degree ?? 0;
    const chopQuant =
      spec?.chopQuant
      ?? (specLen > 0
        ? (opts.barChordSpecs![bar % specLen]?.chopQuant ?? 'whole')
        : 'whole');
    return {
      bar,
      degree,
      chopQuant,
      roman: genoDegreeRomanNumeral(degree, opts.keyMode),
      chordSymbol: col ? genoChordSymbolForColumn(col, opts.keyRoot, opts.keyMode) : '—',
      chordNotes: notesInBar(opts.chordNotes, bar, opts.beatsPerBar),
      melodyNotes: notesInBar(opts.melodyNotes, bar, opts.beatsPerBar),
      bassNotes: notesInBar(opts.bassNotes, bar, opts.beatsPerBar),
    };
  });
}

export function genoPitchToLaneTop(
  pitch: number,
  minMidi: number,
  maxMidi: number,
  laneHeight: number,
  blockHeight: number,
): number {
  const span = Math.max(1, maxMidi - minMidi);
  const t = 1 - (pitch - minMidi) / span;
  return Math.max(2, Math.min(laneHeight - blockHeight - 2, t * (laneHeight - blockHeight)));
}

/** Map pitches using this bar's note span so stacked chord tones fill the lane. */
export function genoPitchToLaneTopForNotes(
  pitch: number,
  notes: readonly { pitch: number }[],
  fallbackMin: number,
  fallbackMax: number,
  laneHeight: number,
  blockHeight: number,
): number {
  if (notes.length === 0) {
    return genoPitchToLaneTop(pitch, fallbackMin, fallbackMax, laneHeight, blockHeight);
  }
  let min = notes[0]!.pitch;
  let max = notes[0]!.pitch;
  for (const n of notes) {
    if (n.pitch < min) min = n.pitch;
    if (n.pitch > max) max = n.pitch;
  }
  if (min === max) {
    return Math.max(2, (laneHeight - blockHeight) / 2);
  }
  const pad = Math.max(1, Math.round((max - min) * 0.08));
  return genoPitchToLaneTop(pitch, min - pad, max + pad, laneHeight, blockHeight);
}

export const GENO_PLUGIN_BAR_MIN_PX = 52;
export const GENO_PLUGIN_LANE_H_PX = 96;
/** Taller melody lane — C4–C6 span needs headroom so blocks are not clipped. */
export const GENO_PLUGIN_MELODY_LANE_H_PX = 128;
export const GENO_PLUGIN_CHORD_LANE_MIN_H_PX = 220;
export const GENO_PLUGIN_CHORD_LANE_MAX_H_PX = 400;
export const GENO_PLUGIN_CHORD_HEADER_H_PX = 34;
export const GENO_PLUGIN_LANE_LABEL_W_PX = 72;
export const GENO_PLUGIN_NOTE_BLOCK_H_PX = 18;
/** Melody blocks — slightly thinner so stacked dyads stay inside the lane. */
export const GENO_PLUGIN_MELODY_NOTE_BLOCK_H_PX = 12;
/** Chord voicings stack 3–7+ tones — thin blocks so each pitch stays visible. */
export const GENO_PLUGIN_CHORD_NOTE_BLOCK_H_PX = 11;

/** Taller melody lane when a bar stacks dyads / pickups on the same pitch. */
export function genoMelodyLaneHeightForBarViews(
  barViews: readonly { melodyNotes: readonly unknown[] }[],
  blockHeight = GENO_PLUGIN_MELODY_NOTE_BLOCK_H_PX,
): number {
  const maxNotes = Math.max(1, ...barViews.map((bv) => bv.melodyNotes.length));
  const perNote = blockHeight + 4;
  return Math.min(168, Math.max(GENO_PLUGIN_MELODY_LANE_H_PX, maxNotes * perNote + 28));
}

/** Taller chord lane when a bar stacks more chord tones. */
export function genoChordLaneHeightForBarViews(
  barViews: readonly { chordNotes: readonly unknown[] }[],
  blockHeight = GENO_PLUGIN_CHORD_NOTE_BLOCK_H_PX,
): number {
  const maxNotes = Math.max(1, ...barViews.map((bv) => bv.chordNotes.length));
  const perNote = blockHeight + 10;
  return Math.min(
    GENO_PLUGIN_CHORD_LANE_MAX_H_PX,
    Math.max(GENO_PLUGIN_CHORD_LANE_MIN_H_PX, maxNotes * perNote + 36),
  );
}
export const GENO_PLUGIN_BAR_GAP_PX = 4;

export const GENO_PLUGIN_LANE_RANGES = {
  chords: { min: GENO_LIVE_CHORD_MIDI_MIN, max: GENO_LIVE_CHORD_MIDI_MAX },
  melody: { min: GENO_PLUGIN_MELODY_MIDI_MIN, max: GENO_PLUGIN_MELODY_MIDI_MAX },
  bass: { min: GENO_BASS_MIDI_MIN, max: GENO_BASS_MIDI_MAX },
  filler: { min: GENO_PLUGIN_FILLER_MIDI_MIN, max: GENO_PLUGIN_FILLER_MIDI_MAX },
} as const;

export type GenoPluginBassGlideLine = {
  x1Pct: number;
  y1: number;
  x2Pct: number;
  y2: number;
};

/** Diagonal slide connectors between consecutive bass pitches (loop editor overlay). */
export function genoBuildBassGlideLines(opts: {
  notes: readonly StudioEditor2GenNote[];
  totalBeats: number;
  minMidi: number;
  maxMidi: number;
  laneHeight: number;
  blockHeight: number;
}): GenoPluginBassGlideLine[] {
  if (opts.totalBeats <= 0 || opts.notes.length < 2) return [];
  const sorted = [...opts.notes].sort((a, b) => a.startBeat - b.startBeat);
  const lines: GenoPluginBassGlideLine[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const from = sorted[i]!;
    const to = sorted[i + 1]!;
    if (from.pitch === to.pitch) continue;
    const fromEndBeat = from.startBeat + from.durationBeats * 0.88;
    const x1Pct = (fromEndBeat / opts.totalBeats) * 100;
    const x2Pct = (to.startBeat / opts.totalBeats) * 100;
    if (x2Pct <= x1Pct + 0.15) continue;
    const y1 = genoPitchToLaneTop(from.pitch, opts.minMidi, opts.maxMidi, opts.laneHeight, opts.blockHeight) + opts.blockHeight / 2;
    const y2 = genoPitchToLaneTop(to.pitch, opts.minMidi, opts.maxMidi, opts.laneHeight, opts.blockHeight) + opts.blockHeight / 2;
    lines.push({ x1Pct, y1, x2Pct, y2 });
  }
  return lines;
}
