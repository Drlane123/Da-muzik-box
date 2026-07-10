/**
 * Import Standard MIDI Files into Geno Bass groove piano roll (4–8 bar basslines).
 */
import {
  isGrooveLabMidiImportError,
  parseGrooveLabMidiFile,
} from '@/app/lib/creationStation/grooveLabMidiImport';
import type { GenoUltraArpSe2RollNote } from '@/app/lib/studio/genoUltraArpExport';
import {
  GENO_BASS_LOOP_DEFAULT_ROOT,
  GENO_BASS_LOOP_EDITOR_MAX,
  GENO_BASS_LOOP_EDITOR_MIN,
} from '@/app/lib/studio/genoBassGroovePresets';
import { genoBassSanitizeLoopBarLength, type GenoBassLoopBarLength } from '@/app/lib/studio/genoBassLoopExport';
import { genoWrapMidiToRange } from '@/app/lib/studio/se2SynthGenoRanges';

const BEATS_PER_BAR = 4;
const MAX_IMPORT_BARS = 8;
const MIN_DUR_BEATS = 1 / 16;
/** Prefer notes in bass register; fall back to lowest track if file is melody-only. */
const BASS_CEILING_MIDI = 72;

export type GenoBassBeatNoteInput = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity?: number;
  channel?: number;
};

export type GenoBassMidiImportResult = {
  notes: GenoUltraArpSe2RollNote[];
  bpm: number;
  barLength: GenoBassLoopBarLength;
  fileName: string;
  noteCount: number;
};

export type GenoBassMidiImportError = {
  message: string;
};

export function isGenoBassMidiImportError(
  r: GenoBassMidiImportResult | GenoBassMidiImportError,
): r is GenoBassMidiImportError {
  return !('notes' in r);
}

export function isGenoBassMidiFileName(name: string): boolean {
  return /\.(mid|midi)$/i.test(name);
}

function pickBassNoteCandidates(
  notes: readonly GenoBassBeatNoteInput[],
  preferAll = false,
): GenoBassBeatNoteInput[] {
  if (preferAll) return [...notes];
  const inBass = notes.filter((n) => n.pitch <= BASS_CEILING_MIDI);
  if (inBass.length >= Math.max(1, Math.floor(notes.length * 0.25))) return inBass;
  const byChannel = new Map<number, GenoBassBeatNoteInput[]>();
  for (const n of notes) {
    const ch = n.channel ?? 0;
    const list = byChannel.get(ch) ?? [];
    list.push(n);
    byChannel.set(ch, list);
  }
  let best = [...notes];
  let bestAvg = Infinity;
  for (const list of byChannel.values()) {
    const avg = list.reduce((s, n) => s + n.pitch, 0) / list.length;
    if (avg < bestAvg) {
      bestAvg = avg;
      best = list;
    }
  }
  return best;
}

function octaveShiftToDefaultRoot(notes: GenoUltraArpSe2RollNote[]): GenoUltraArpSe2RollNote[] {
  if (!notes.length) return notes;
  const minPitch = Math.min(...notes.map((n) => n.pitch));
  const targetOct = Math.floor(GENO_BASS_LOOP_DEFAULT_ROOT / 12);
  const minOct = Math.floor(minPitch / 12);
  const shift = (targetOct - minOct) * 12;
  if (!shift) return notes;
  return notes.map((n) => ({
    ...n,
    pitch: genoWrapMidiToRange(n.pitch + shift, GENO_BASS_LOOP_EDITOR_MIN, GENO_BASS_LOOP_EDITOR_MAX),
  }));
}

/** Beat-space notes → Geno Bass roll (4 or 8 bars max). */
export function genoBassBeatNotesToRoll(
  notes: readonly GenoBassBeatNoteInput[],
  opts: {
    bpm: number;
    sourceLabel: string;
    preferAllBassNotes?: boolean;
  },
): GenoBassMidiImportResult | GenoBassMidiImportError {
  const source = pickBassNoteCandidates(notes, opts.preferAllBassNotes);
  if (!source.length) {
    return { message: 'No bass notes found in this source.' };
  }

  const maxBeats = MAX_IMPORT_BARS * BEATS_PER_BAR;

  let roll: GenoUltraArpSe2RollNote[] = source
    .map((n) => ({
      pitch: genoWrapMidiToRange(
        Math.round(n.pitch),
        GENO_BASS_LOOP_EDITOR_MIN,
        GENO_BASS_LOOP_EDITOR_MAX,
      ),
      startBeat: n.startBeat,
      durationBeats: Math.max(MIN_DUR_BEATS, n.durationBeats),
      velocity: Math.max(1, Math.min(127, Math.round(n.velocity ?? 100))),
    }))
    .filter((n) => n.startBeat < maxBeats - MIN_DUR_BEATS)
    .sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);

  if (!roll.length) {
    return { message: 'No notes in the first 8 bars of this source.' };
  }

  roll = octaveShiftToDefaultRoot(roll);

  const endBeat = Math.max(...roll.map((n) => n.startBeat + n.durationBeats));
  const barsNeeded = Math.ceil(endBeat / BEATS_PER_BAR);
  if (barsNeeded > MAX_IMPORT_BARS) {
    return {
      message: `Source is longer than ${MAX_IMPORT_BARS} bars — trim to ${MAX_IMPORT_BARS} bars or less.`,
    };
  }

  const barLength = genoBassSanitizeLoopBarLength(barsNeeded <= 4 ? 4 : 8);
  const trimBeats = barLength * BEATS_PER_BAR;
  roll = roll.filter((n) => n.startBeat < trimBeats - MIN_DUR_BEATS);

  return {
    notes: roll,
    bpm: opts.bpm,
    barLength,
    fileName: opts.sourceLabel,
    noteCount: roll.length,
  };
}

/** Parse .mid / .midi → Geno Bass roll notes (4 or 8 bars max). */
export function parseGenoBassMidiFile(
  data: ArrayBuffer,
  fileName: string,
): GenoBassMidiImportResult | GenoBassMidiImportError {
  const parsed = parseGrooveLabMidiFile(data, fileName, { quantize: '16', barCount: MAX_IMPORT_BARS });
  if (isGrooveLabMidiImportError(parsed)) return parsed;

  const tpq = parsed.ticksPerQuarter;
  const beatNotes: GenoBassBeatNoteInput[] = parsed.notes.map((n) => ({
    pitch: n.midi,
    startBeat: n.startTick / tpq,
    durationBeats: n.durationTicks / tpq,
    velocity: n.velocity,
    channel: n.channel,
  }));

  return genoBassBeatNotesToRoll(beatNotes, {
    bpm: parsed.bpm,
    sourceLabel: fileName,
  });
}
