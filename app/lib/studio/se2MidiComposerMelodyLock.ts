/**
 * SE2 MIDI Composer — lock melodies/bass to Chord Generator harmony + note grid.
 */
import { parseChordSymbolToken } from '@/app/lib/creationStation/chordProgressionParse';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import type { GenoHarmony } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { GenoMelodyGenre } from '@/app/lib/studio/se2SynthGenoMelodyEngine';
import {
  genoFinalizeMelodyTimingOnGrid,
  genoTrimMelodyMonophonic,
} from '@/app/lib/studio/se2SynthGenoRanges';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';

/** UI note-grid values → quarter-note beat step. */
export function se2MidiComposerNoteGridStepBeats(noteGrid: string): number | null {
  switch (noteGrid) {
    case '2':
      return 2;
    case '4':
      return 1;
    case '8':
      return 0.5;
    case '16':
      return 0.25;
    case '32':
      return 0.125;
    default:
      return null;
  }
}

/** Genre-default grid when the user leaves Note grid on Any. */
export function se2MidiComposerDefaultNoteGrid(genre: string): string {
  switch (genre) {
    case 'true_rnb':
    case 'neo_soul':
    case 'afro':
      return '16';
    case 'trap':
    case 'gospel':
    case 'pop':
    case 'lofi':
      return '8';
    case 'cinematic':
      return '4';
    default:
      return '8';
  }
}

export function se2MidiComposerResolveGridStep(noteGrid: string, genre: string): number {
  return (
    se2MidiComposerNoteGridStepBeats(noteGrid) ??
    se2MidiComposerNoteGridStepBeats(se2MidiComposerDefaultNoteGrid(genre)) ??
    0.25
  );
}

/** Map MIDI Composer genre chip → Synth Geno melody phrase bank. */
export function se2MidiComposerMelodyGenre(
  genre: string,
  prompt = '',
): GenoMelodyGenre {
  const lower = prompt.toLowerCase();
  if (/\b(90s\s*r&b|rnb\s*funk|funk\s*r&b|funky)\b/.test(lower)) return 'rnbFunk';
  if (/\b(arp|arpeggio|pluck)\b/.test(lower)) return 'arp';
  if (/\b(riff|bounce|stab)\b/.test(lower) && genre === 'trap') return 'trap';

  switch (genre) {
    case 'true_rnb':
    case 'neo_soul':
      return 'rnb';
    case 'trap':
      return 'trap';
    case 'gospel':
      return 'gospel';
    case 'pop':
      return 'pop';
    case 'afro':
      return 'rnbFunk';
    case 'lofi':
    case 'cinematic':
      return 'dark';
    default:
      return 'pop';
  }
}

function liftTonesForMelody(notes: readonly number[]): number[] {
  return [...new Set(notes)]
    .map((n) => {
      let m = n;
      while (m < 55) m += 12;
      while (m > 79) m -= 12;
      return m;
    })
    .sort((a, b) => a - b)
    .slice(0, 6);
}

/**
 * Build one harmony column per bar from Chord Generator steps so melody/bass
 * share the same chord changes the user just generated.
 */
export function se2MidiComposerHarmonyFromSteps(
  steps: readonly GrooveProgressionStep[],
  barCount: number,
  beatsPerBar: number,
  keyRoot: number,
): GenoHarmony {
  const bpb = Math.max(1, beatsPerBar);
  const bars = Math.max(1, barCount);
  const pc = ((Math.round(keyRoot) % 12) + 12) % 12;

  type Span = { start: number; end: number; label: string };
  const spans: Span[] = [];
  let cursor = 0;
  for (const step of steps) {
    const beats = Math.max(0, step.beats);
    if (!step.rest && step.label.trim()) {
      spans.push({ start: cursor, end: cursor + beats, label: step.label.trim() });
    }
    cursor += beats;
  }

  const columns: GenoHarmony['columns'] = [];
  for (let bar = 0; bar < bars; bar += 1) {
    const barStart = bar * bpb;
    const barMid = barStart + bpb * 0.01;
    const hit =
      spans.find((s) => barMid >= s.start && barMid < s.end) ??
      spans.find((s) => s.start < barStart + bpb && s.end > barStart) ??
      null;

    if (!hit) {
      const rootMidi = 48 + pc;
      columns.push({
        bar,
        degree: 0,
        rootMidi,
        tones: [rootMidi + 12, rootMidi + 16, rootMidi + 19],
      });
      continue;
    }

    const parsed = parseChordSymbolToken(hit.label);
    if (!parsed) {
      const rootMidi = 48 + pc;
      columns.push({
        bar,
        degree: 0,
        rootMidi,
        tones: [rootMidi + 12, rootMidi + 16, rootMidi + 19],
      });
      continue;
    }

    const rootMidi = 48 + parsed.rootPc;
    const tones = liftTonesForMelody(parsed.notes);
    columns.push({
      bar,
      degree: 0,
      rootMidi,
      tones: tones.length >= 2 ? tones : [rootMidi + 12, rootMidi + 16, rootMidi + 19],
    });
  }

  return { columns };
}

/** Snap melody/bass attacks + durations onto the chosen 1/8–1/32 grid. */
export function se2MidiComposerQuantizeNotes(
  notes: readonly StudioEditor2GenNote[],
  opts: {
    noteGrid: string;
    genre: string;
    beatsPerBar: number;
    barCount: number;
    monophonic?: boolean;
  },
): StudioEditor2GenNote[] {
  if (!notes.length) return [];
  const step = se2MidiComposerResolveGridStep(opts.noteGrid, opts.genre);
  const snapped = genoFinalizeMelodyTimingOnGrid(
    notes,
    opts.beatsPerBar,
    step,
    opts.barCount,
  );
  if (opts.monophonic === false) return snapped;
  return genoTrimMelodyMonophonic(snapped, opts.beatsPerBar, step);
}
