/**
 * Groove Lab chord roll → Beat Lab NEW SYNTH (CH 17) — no Chord Builder hop.
 */

import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  melodicLanePitchSemi,
  type BeatLabChordRailSlot,
  type BeatLabImportedChordRail,
} from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import {
  BEAT_LAB_MELODIC_LANE_START,
  normalizeBeatLabMidiNote,
  type BeatLabMidiNote,
} from '@/app/lib/creationStation/beatLabMidiRoll';
import { parseChordSymbolToken } from '@/app/lib/creationStation/chordProgressionParse';
import {
  grooveLabClampBassRootMidi,
  grooveLabLiftChordsAboveBass,
  GROOVE_LAB_CHORD_ROLL_MIDI_MIN,
} from '@/app/lib/creationStation/grooveLabPitch';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import {
  collapseGrooveChordHitsToBarDownbeats,
  GROOVE_LAB_SLOTS_PER_BAR,
  quantizeGrooveHits,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';
import { beatLabStepsPerBar } from '@/app/lib/creationStation/chordBuilderBeatLabImport';

export function grooveRollBarsNeeded(
  hits: readonly GrooveRollHit[],
  slotsPerBar = GROOVE_LAB_SLOTS_PER_BAR,
): number {
  let maxEnd = 0;
  for (const h of hits) {
    maxEnd = Math.max(maxEnd, h.slot + Math.max(1, h.sustainSlots));
  }
  return Math.max(1, Math.ceil(maxEnd / Math.max(1, slotsPerBar)));
}

/** Clip each chord stack so blocks end before the next Groove chord column (no overlap). */
function clipBeatLabGrooveImportNotes(
  notes: readonly BeatLabMidiNote[],
  maxCol: number,
): BeatLabMidiNote[] {
  const heads = [...new Set(notes.map((n) => n.col))].sort((a, b) => a - b);
  const nextHead = new Map<number, number>();
  for (let i = 0; i < heads.length - 1; i++) {
    nextHead.set(heads[i]!, heads[i + 1]!);
  }
  const byKey = new Map<string, BeatLabMidiNote>();
  for (const n of notes) {
    const next = nextHead.get(n.col);
    let len = n.len;
    if (next != null) len = Math.min(len, next - n.col);
    len = Math.max(1, Math.min(len, maxCol - n.col));
    const key = `${n.lane},${n.col},${n.pitchSemi ?? 0}`;
    const candidate = normalizeBeatLabMidiNote({ ...n, len });
    if (!candidate) continue;
    const prev = byKey.get(key);
    if (!prev || candidate.len > prev.len) byKey.set(key, candidate);
  }
  return [...byKey.values()].sort(
    (a, b) => a.col - b.col || a.lane - b.lane || (a.pitchSemi ?? 0) - (b.pitchSemi ?? 0),
  );
}

/** Green chord hits on the Groove roll → Beat Lab step-grid notes on the harmony lane. */
export function grooveRollHitsToBeatLabRoll(
  hits: readonly GrooveRollHit[],
  opts: {
    stepSubdiv: number;
    patternCols: number;
    beatsPerBar?: number;
    targetLane?: number;
    quantize?: GrooveLabQuantize;
    barCount?: number;
  },
): BeatLabMidiNote[] {
  return grooveProgressionStepsToBeatLabRollFromHits(hits, opts);
}

function grooveProgressionStepsToBeatLabRollFromHits(
  hits: readonly GrooveRollHit[],
  opts: {
    stepSubdiv: number;
    patternCols: number;
    beatsPerBar?: number;
    targetLane?: number;
    quantize?: GrooveLabQuantize;
    barCount?: number;
  },
): BeatLabMidiNote[] {
  const subdiv = Math.max(1, Math.round(opts.stepSubdiv));
  const beatsPerBar = Math.max(1, Math.round(opts.beatsPerBar ?? 4));
  const stepsPerBar = beatLabStepsPerBar(subdiv, beatsPerBar, 4);
  const maxCol = Math.max(1, Math.round(opts.patternCols));
  const lane = Math.max(
    BEAT_LAB_MELODIC_LANE_START,
    Math.min(31, Math.round(opts.targetLane ?? BEAT_LAB_MELODIC_LANE_START)),
  );

  let chordHits = hits.filter((h) => Math.round(h.midi) >= GROOVE_LAB_CHORD_ROLL_MIDI_MIN);
  if (chordHits.length === 0) return [];

  if (opts.quantize != null && opts.barCount != null) {
    chordHits = quantizeGrooveHits(chordHits, opts.quantize, opts.barCount);
  }

  /** One stacked chord per bar on beat 1 — matches Groove roll + Beat Lab quarter grid. */
  const collapsed = collapseGrooveChordHitsToBarDownbeats(chordHits);

  const notes: BeatLabMidiNote[] = [];
  for (const h of collapsed) {
    const bar = Math.floor(h.slot / GROOVE_LAB_SLOTS_PER_BAR);
    const headCol = bar * stepsPerBar;
    if (headCol >= maxCol) continue;
    const pitchSemi = melodicLanePitchSemi(lane, Math.round(h.midi));
    if (pitchSemi == null) continue;

    /** One full bar per chord column — blocks end on the bar line like Groove Lab. */
    const len = Math.max(1, Math.min(stepsPerBar, maxCol - headCol));

    const vel = Math.max(1, Math.min(127, Math.round((h.vel ?? 0.88) * 127)));
    const n = normalizeBeatLabMidiNote({ lane, col: headCol, len, vel, pitchSemi });
    if (n) notes.push(n);
  }

  return clipBeatLabGrooveImportNotes(notes, maxCol);
}

/** Progression timeline → Beat Lab (bar downbeats only — matches Groove transport). */
export function grooveProgressionStepsToBeatLabRoll(
  steps: readonly GrooveProgressionStep[],
  opts: {
    stepSubdiv: number;
    patternCols: number;
    beatsPerBar?: number;
    targetLane?: number;
    quantize?: GrooveLabQuantize;
    barCount?: number;
  },
): BeatLabMidiNote[] {
  const beatsPerBar = Math.max(1, Math.round(opts.beatsPerBar ?? 4));
  let beat = 0;
  const collapsed: GrooveRollHit[] = [];

  for (const step of steps) {
    if (step.rest || !step.label.trim()) {
      beat += Math.max(0, step.beats);
      continue;
    }
    const parsed = parseChordSymbolToken(step.label);
    if (!parsed) continue;
    const startBar = Math.floor(beat / beatsPerBar);
    const durBeats = Math.max(0.25, step.beats);
    const endBar = Math.max(startBar, Math.ceil((beat + durBeats) / beatsPerBar) - 1);
    const bassRef = grooveLabClampBassRootMidi(Math.min(...parsed.notes));
    const voicing = grooveLabLiftChordsAboveBass(bassRef, parsed.notes).filter(
      (m) => m >= GROOVE_LAB_CHORD_ROLL_MIDI_MIN,
    );
    for (let bar = startBar; bar <= endBar; bar += 1) {
      const slot = bar * GROOVE_LAB_SLOTS_PER_BAR;
      for (const midi of voicing) {
        collapsed.push({
          slot,
          midi,
          sustainSlots: GROOVE_LAB_SLOTS_PER_BAR,
          vel: 0.9,
        });
      }
    }
    beat += durBeats;
  }

  return grooveProgressionStepsToBeatLabRollFromHits(collapsed, opts);
}

/** Bar headers for NEW SYNTH after Groove roll chords land (symbols optional — key drives bass roots). */
export function grooveRollHitsToChordRail(
  hits: readonly GrooveRollHit[],
  keyRoot: number,
  mode: ChordMode,
): BeatLabImportedChordRail | null {
  const chordHits = hits.filter((h) => Math.round(h.midi) >= GROOVE_LAB_CHORD_ROLL_MIDI_MIN);
  if (chordHits.length === 0) return null;
  const collapsed = collapseGrooveChordHitsToBarDownbeats(chordHits);
  if (collapsed.length === 0) return null;
  let maxBar = 0;
  for (const h of collapsed) {
    maxBar = Math.max(maxBar, Math.floor(h.slot / GROOVE_LAB_SLOTS_PER_BAR));
  }
  const timeline: BeatLabChordRailSlot[] = [];
  for (let bar = 0; bar <= maxBar; bar += 1) timeline.push({ chord: null });
  return { timeline, keyRoot: keyRoot % 12, mode };
}

/** Bar headers for NEW SYNTH after a Groove Lab progression drop (optional). */
export function grooveProgressionStepsToChordRail(
  steps: readonly GrooveProgressionStep[],
  beatsPerBar = 4,
  keyRoot = 0,
  mode: ChordMode = 'major',
): BeatLabImportedChordRail | null {
  if (steps.length === 0) return null;
  const timeline: BeatLabChordRailSlot[] = [];
  let sawChord = false;
  let beat = 0;

  for (const step of steps) {
    if (step.rest || !step.label.trim()) {
      beat += Math.max(0, step.beats);
      continue;
    }
    const parsed = parseChordSymbolToken(step.label);
    const chord = (parsed?.display ?? step.label.trim()) as string;
    const durBeats = Math.max(0.25, step.beats);
    const startBar = Math.floor(beat / beatsPerBar);
    const endBar = Math.max(startBar, Math.ceil((beat + durBeats) / beatsPerBar) - 1);
    for (let bar = startBar; bar <= endBar; bar += 1) {
      while (timeline.length <= bar) timeline.push({ chord: null });
      if (!timeline[bar]!.chord) {
        timeline[bar] = { chord };
        sawChord = true;
      }
    }
    beat += durBeats;
  }

  if (!sawChord) return null;
  return { timeline, keyRoot: keyRoot % 12, mode };
}
