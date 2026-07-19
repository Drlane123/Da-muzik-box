/**
 * SE2 Chord Generator — Harmony tools (inspired by pro chord-edit workflows, not a clone).
 * Alternatives · Enrich / Reduce · Invert · Voice Lead · Bass from chords · Chords from melody.
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { chordSymbolToName } from '@/app/lib/creationStation/chordBuilder';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { parseChordSymbolToken } from '@/app/lib/creationStation/chordProgressionParse';
import { suggestNextChordLabels } from '@/app/lib/creationStation/grooveLabProgressionLibrary';
import {
  analyzeMelodyToProgressions,
  expandProgressionToBars,
  type MelodyProgressionCandidate,
} from '@/app/lib/creationStation/melodyToChordProgression';
import type { PitchEvent } from '@/app/lib/pitchDetection';
import { se2MidiComposerHarmonyFromSteps } from '@/app/lib/studio/se2MidiComposerMelodyLock';
import { genoGenerateBassFromHarmony } from '@/app/lib/studio/se2SynthGenoBassEngine';
import { genoStylePreset } from '@/app/lib/studio/se2SynthGenoStylePresets';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';

const NOTE_LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

let stepIdSeq = 0;
function nextStepId(): string {
  stepIdSeq += 1;
  return `se2-harm-${Date.now().toString(36)}-${stepIdSeq}`;
}

function cloneSteps(steps: readonly GrooveProgressionStep[]): GrooveProgressionStep[] {
  return steps.map((s) => ({
    ...s,
    id: s.id || nextStepId(),
    barBeats: s.barBeats ? [...s.barBeats] : undefined,
  }));
}

function splitSlash(label: string): { main: string; bass: string | null } {
  const i = label.indexOf('/');
  if (i < 0) return { main: label.trim(), bass: null };
  return { main: label.slice(0, i).trim(), bass: label.slice(i + 1).trim() || null };
}

function joinSlash(main: string, bass: string | null): string {
  return bass ? `${main}/${bass}` : main;
}

/** Quality ladder for enrich / reduce (major-ish and minor-ish families). */
const MAJOR_LADDER = ['', 'maj7', 'maj9', 'maj11', 'maj13'] as const;
const MINOR_LADDER = ['m', 'm7', 'm9', 'm11', 'm13'] as const;
const DOM_LADDER = ['7', '9', '11', '13'] as const;
const TRIAD_LADDER = ['', 'add9', '6', 'maj7'] as const;

function parseRootAndQuality(main: string): { root: string; quality: string } | null {
  const m = main.trim().match(/^([A-G](?:#|b)?)(.*)$/i);
  if (!m) return null;
  const root = `${m[1]![0]!.toUpperCase()}${m[1]!.slice(1)}`;
  return { root, quality: m[2] ?? '' };
}

function ladderForQuality(quality: string): readonly string[] {
  const q = quality.trim();
  if (/^m(aj)?/i.test(q) && !/^maj/i.test(q)) return MINOR_LADDER;
  if (/^(7|9|11|13)/.test(q) && !/^maj/i.test(q)) return DOM_LADDER;
  if (/^maj/i.test(q) || q === '') return q === '' ? TRIAD_LADDER : MAJOR_LADDER;
  if (/^m\d/.test(q) || q === 'm') return MINOR_LADDER;
  return MAJOR_LADDER;
}

function normalizeLadderToken(quality: string, ladder: readonly string[]): string {
  const q = quality.trim();
  if (ladder.includes(q)) return q;
  if (q === 'M7') return 'maj7';
  if (q === 'min') return 'm';
  if (q === 'min7') return 'm7';
  // fuzzy: maj9 vs 9
  for (const step of ladder) {
    if (step && q.toLowerCase() === step.toLowerCase()) return step;
  }
  return q;
}

function stepLadder(quality: string, direction: 1 | -1): string {
  const ladder = ladderForQuality(quality);
  const norm = normalizeLadderToken(quality, ladder);
  let idx = ladder.indexOf(norm);
  if (idx < 0) {
    // Jump onto ladder
    if (direction > 0) return ladder[Math.min(1, ladder.length - 1)]!;
    return ladder[0]!;
  }
  idx = Math.max(0, Math.min(ladder.length - 1, idx + direction));
  return ladder[idx]!;
}

export function se2EnrichChordLabel(label: string): string {
  const { main, bass } = splitSlash(label);
  const parsed = parseRootAndQuality(main);
  if (!parsed) return label;
  const nextQ = stepLadder(parsed.quality, 1);
  const nextMain = `${parsed.root}${nextQ}`;
  return joinSlash(nextMain, bass);
}

export function se2ReduceChordLabel(label: string): string {
  const { main, bass } = splitSlash(label);
  const parsed = parseRootAndQuality(main);
  if (!parsed) return label;
  const nextQ = stepLadder(parsed.quality, -1);
  const nextMain = `${parsed.root}${nextQ}`;
  return joinSlash(nextMain, bass);
}

/** First inversion: put chord 3rd in the bass (C → C/E). */
export function se2InvertChordLabel(label: string): string {
  const { main } = splitSlash(label);
  const parsed = parseChordSymbolToken(main);
  if (!parsed || parsed.notes.length < 2) return label;
  const third = parsed.notes[1]!;
  const bassLetter = NOTE_LETTERS[((third % 12) + 12) % 12]!;
  // Cycle: no slash → /3rd → /5th → clear slash
  const { bass } = splitSlash(label);
  if (!bass) return `${main}/${bassLetter}`;
  if (parsed.notes.length >= 3) {
    const fifth = parsed.notes[2]!;
    const fifthLetter = NOTE_LETTERS[((fifth % 12) + 12) % 12]!;
    if (bass.toUpperCase() === bassLetter) return `${main}/${fifthLetter}`;
  }
  return main;
}

export type Se2HarmonyToolResult = {
  steps: GrooveProgressionStep[];
  message: string;
};

export function se2HarmonyEnrichAt(
  steps: readonly GrooveProgressionStep[],
  index: number,
): Se2HarmonyToolResult {
  const next = cloneSteps(steps);
  const step = next[index];
  if (!step || step.rest || !step.label.trim()) {
    return { steps: next, message: 'Select a chord first.' };
  }
  const before = step.label;
  step.label = se2EnrichChordLabel(step.label);
  return {
    steps: next,
    message:
      before === step.label
        ? `${before} is already rich — try Alt for a different color.`
        : `Enriched ${before} → ${step.label}`,
  };
}

export function se2HarmonyReduceAt(
  steps: readonly GrooveProgressionStep[],
  index: number,
): Se2HarmonyToolResult {
  const next = cloneSteps(steps);
  const step = next[index];
  if (!step || step.rest || !step.label.trim()) {
    return { steps: next, message: 'Select a chord first.' };
  }
  const before = step.label;
  step.label = se2ReduceChordLabel(step.label);
  return {
    steps: next,
    message:
      before === step.label
        ? `${before} is already simple.`
        : `Reduced ${before} → ${step.label}`,
  };
}

export function se2HarmonyInvertAt(
  steps: readonly GrooveProgressionStep[],
  index: number,
): Se2HarmonyToolResult {
  const next = cloneSteps(steps);
  const step = next[index];
  if (!step || step.rest || !step.label.trim()) {
    return { steps: next, message: 'Select a chord first.' };
  }
  const before = step.label;
  step.label = se2InvertChordLabel(step.label);
  return { steps: next, message: `Invert ${before} → ${step.label}` };
}

export function se2HarmonySuggestAlternatives(
  steps: readonly GrooveProgressionStep[],
  index: number,
  opts: { keyRoot: number; mode: ChordMode; genreId: string; seed?: number },
): string[] {
  const prefix = steps.slice(0, Math.max(0, index));
  const current = steps[index]?.label?.trim() ?? '';
  const suggestions = suggestNextChordLabels(prefix.length ? prefix : steps.slice(0, 1), {
    keyRoot: opts.keyRoot,
    mode: opts.mode,
    genreId: opts.genreId,
    topK: 8,
  });
  const labels = suggestions.map((s) => s.label).filter((l) => l && l !== current);
  // Quality variants of current chord
  if (current) {
    const enriched = se2EnrichChordLabel(current);
    const reduced = se2ReduceChordLabel(current);
    if (enriched !== current) labels.unshift(enriched);
    if (reduced !== current && reduced !== enriched) labels.push(reduced);
  }
  const uniq: string[] = [];
  for (const l of labels) {
    if (!uniq.includes(l)) uniq.push(l);
  }
  // Deterministic shuffle by seed
  const seed = opts.seed ?? 1;
  for (let i = uniq.length - 1; i > 0; i--) {
    const j = (seed * 17 + i * 31) % (i + 1);
    const tmp = uniq[i]!;
    uniq[i] = uniq[j]!;
    uniq[j] = tmp;
  }
  return uniq.slice(0, 6);
}

export function se2HarmonyAltAt(
  steps: readonly GrooveProgressionStep[],
  index: number,
  opts: { keyRoot: number; mode: ChordMode; genreId: string; seed?: number },
): Se2HarmonyToolResult {
  const next = cloneSteps(steps);
  const step = next[index];
  if (!step || step.rest || !step.label.trim()) {
    return { steps: next, message: 'Select a chord first.' };
  }
  const alts = se2HarmonySuggestAlternatives(steps, index, opts);
  if (!alts.length) {
    return { steps: next, message: 'No alternatives found — try another bar or genre.' };
  }
  const pick = alts[(opts.seed ?? 0) % alts.length]!;
  const before = step.label;
  step.label = pick;
  return { steps: next, message: `Alt ${before} → ${pick}` };
}

export function se2HarmonyAltAll(
  steps: readonly GrooveProgressionStep[],
  opts: { keyRoot: number; mode: ChordMode; genreId: string; seed?: number },
): Se2HarmonyToolResult {
  let next = cloneSteps(steps);
  let changes = 0;
  for (let i = 0; i < next.length; i++) {
    if (next[i]!.rest || !next[i]!.label.trim()) continue;
    const r = se2HarmonyAltAt(next, i, { ...opts, seed: (opts.seed ?? 1) + i * 3 });
    next = r.steps;
    if (!r.message.startsWith('No alternatives') && !r.message.startsWith('Select')) changes += 1;
  }
  return {
    steps: next,
    message: changes ? `Swapped alternatives on ${changes} chords.` : 'No alternative swaps applied.',
  };
}

/**
 * Voice-lead consecutive chords via slash inversions (minimize bass jumps).
 */
export function se2HarmonyVoiceLead(
  steps: readonly GrooveProgressionStep[],
): Se2HarmonyToolResult {
  const next = cloneSteps(steps);
  let prevBassPc: number | null = null;
  let touched = 0;
  for (const step of next) {
    if (step.rest || !step.label.trim()) continue;
    const { main } = splitSlash(step.label);
    const parsed = parseChordSymbolToken(main);
    if (!parsed || parsed.notes.length < 2) continue;
    const candidates: { label: string; bassPc: number }[] = [
      { label: main, bassPc: parsed.rootPc },
    ];
    for (let vi = 1; vi < Math.min(3, parsed.notes.length); vi++) {
      const pc = ((parsed.notes[vi]! % 12) + 12) % 12;
      const letter = NOTE_LETTERS[pc]!;
      candidates.push({ label: `${main}/${letter}`, bassPc: pc });
    }
    if (prevBassPc == null) {
      step.label = candidates[0]!.label;
      prevBassPc = candidates[0]!.bassPc;
      continue;
    }
    let best = candidates[0]!;
    let bestDist = 99;
    for (const c of candidates) {
      const d = Math.min((c.bassPc - prevBassPc + 12) % 12, (prevBassPc - c.bassPc + 12) % 12);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    if (step.label !== best.label) touched += 1;
    step.label = best.label;
    prevBassPc = best.bassPc;
  }
  return {
    steps: next,
    message: touched
      ? `Voice-led ${touched} chords (smoother bass motion).`
      : 'Voice leading applied — progression already smooth.',
  };
}

/** Bass MIDI locked to current chords (export to track / roll). */
export function se2HarmonyBassFromCards(
  steps: readonly GrooveProgressionStep[],
  opts: {
    keyRoot: number;
    mode: ChordMode;
    beatsPerBar: number;
    loopBars: number;
    seed?: number;
  },
): { notes: StudioEditor2GenNote[]; message: string } | { error: string } {
  const played = steps.filter((s) => !s.rest && s.label.trim());
  if (!played.length) return { error: 'Add chords first, then generate bass.' };
  const barCount = Math.max(4, opts.loopBars);
  const harmony = se2MidiComposerHarmonyFromSteps(
    steps,
    barCount,
    opts.beatsPerBar,
    opts.keyRoot,
  );
  if (!harmony.columns.length) return { error: 'Could not read harmony from chords.' };
  const pattern = genoStylePreset('default').bassPattern;
  const notes = genoGenerateBassFromHarmony({
    harmony,
    barCount,
    beatsPerBar: opts.beatsPerBar,
    pattern,
    seed: opts.seed ?? Date.now(),
    keyRoot: opts.keyRoot,
    keyMode: opts.mode === 'minor' ? 'minor' : 'major',
  });
  if (!notes.length) return { error: 'Bass engine returned no notes.' };
  return {
    notes,
    message: `Bass from chords — ${notes.length} notes locked to your progression.`,
  };
}

export function se2HarmonyChordsFromMelody(
  events: readonly PitchEvent[],
  opts: {
    bpm: number;
    keyRoot: number;
    mode: ChordMode;
    loopBars: number;
    beatsPerBar: number;
    candidateIndex?: number;
  },
): Se2HarmonyToolResult | { error: string } {
  if (events.length < 8) {
    return {
      error:
        'Need a melody first — generate Melody in SE2 MIDI Composer, then tap From melody.',
    };
  }
  const analysis = analyzeMelodyToProgressions([...events], opts.bpm, {
    keyRootHint: opts.keyRoot,
    modeHint: opts.mode === 'minor' ? 'minor' : 'major',
    maxBars: opts.loopBars,
    topK: 4,
  });
  if (!analysis?.candidates?.length) {
    return { error: 'Could not hear clear harmony in that melody — try a longer line.' };
  }
  const pick: MelodyProgressionCandidate =
    analysis.candidates[Math.min(opts.candidateIndex ?? 0, analysis.candidates.length - 1)]!;
  const tiled = expandProgressionToBars(pick.chords, opts.loopBars);
  const steps: GrooveProgressionStep[] = tiled.map((roman) => ({
    id: nextStepId(),
    label: chordSymbolToName(roman, analysis.keyRoot, analysis.mode),
    beats: opts.beatsPerBar,
  }));
  return {
    steps,
    message: `Chords from melody — ${pick.label} (${steps.length} chords).`,
  };
}

/** Build pitch events from MIDI composer notes for From-melody. */
export function se2PitchEventsFromMidiNotes(
  notes: readonly { pitch: number; startBeat: number; durationBeats: number; velocity?: number }[],
  bpm: number,
): PitchEvent[] {
  const msPerBeat = 60000 / Math.max(20, bpm);
  return notes.map((n) => ({
    time: Math.max(0, n.startBeat) * msPerBeat,
    frequency: 440 * Math.pow(2, (n.pitch - 69) / 12),
    confidence: 0.85,
    velocity: n.velocity ?? 100,
  }));
}
