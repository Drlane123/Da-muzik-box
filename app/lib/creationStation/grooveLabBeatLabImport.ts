/**
 * Groove Lab chord roll → Beat Lab NEW SYNTH (CH 17) — no Chord Builder hop.
 */

import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  beatLabStepsPerBar,
  melodicLanePitchSemi,
  snapBeatLabChordNotesToBarDownbeats,
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
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';

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

/** Green chord hits on the Groove roll → Beat Lab step-grid notes on the harmony lane. */
export function grooveRollHitsToBeatLabRoll(
  hits: readonly GrooveRollHit[],
  opts: {
    stepSubdiv: number;
    patternCols: number;
    beatsPerBar?: number;
    targetLane?: number;
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
  },
): BeatLabMidiNote[] {
  const collapsed = collapseGrooveChordHitsToBarDownbeats(hits);
  if (collapsed.length === 0) return [];

  const subdiv = Math.max(1, Math.round(opts.stepSubdiv));
  const beatsPerBar = Math.max(1, Math.round(opts.beatsPerBar ?? 4));
  const stepsPerBar = beatLabStepsPerBar(subdiv, beatsPerBar, 4);
  const maxCol = Math.max(1, Math.round(opts.patternCols));
  const lane = Math.max(
    BEAT_LAB_MELODIC_LANE_START,
    Math.min(31, Math.round(opts.targetLane ?? BEAT_LAB_MELODIC_LANE_START)),
  );

  const notes: BeatLabMidiNote[] = [];
  for (const h of collapsed) {
    const bar = Math.floor(h.slot / GROOVE_LAB_SLOTS_PER_BAR);
    const headCol = bar * stepsPerBar;
    if (headCol >= maxCol) continue;
    const pitchSemi = melodicLanePitchSemi(lane, h.midi);
    if (pitchSemi == null) continue;
    const barSpan = Math.min(stepsPerBar, maxCol - headCol);
    const len = Math.max(1, barSpan);
    const vel = Math.max(1, Math.min(127, Math.round((h.vel ?? 0.88) * 127)));
    const n = normalizeBeatLabMidiNote({ lane, col: headCol, len, vel, pitchSemi });
    if (n) notes.push(n);
  }

  return snapBeatLabChordNotesToBarDownbeats(notes, { stepsPerBar, patternCols: maxCol });
}

/** Progression timeline → Beat Lab (bar downbeats only — matches Groove transport). */
export function grooveProgressionStepsToBeatLabRoll(
  steps: readonly GrooveProgressionStep[],
  opts: {
    stepSubdiv: number;
    patternCols: number;
    beatsPerBar?: number;
    targetLane?: number;
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
    const slot = startBar * GROOVE_LAB_SLOTS_PER_BAR;
    const bassRef = grooveLabClampBassRootMidi(Math.min(...parsed.notes));
    const voicing = grooveLabLiftChordsAboveBass(bassRef, parsed.notes).filter(
      (m) => m >= GROOVE_LAB_CHORD_ROLL_MIDI_MIN,
    );
    const durSlots = Math.max(
      GROOVE_LAB_SLOTS_PER_BAR,
      Math.round(Math.max(0.25, step.beats) * (GROOVE_LAB_SLOTS_PER_BAR / 4)),
    );
    for (const midi of voicing) {
      collapsed.push({
        slot,
        midi,
        sustainSlots: durSlots,
        vel: 0.9,
      });
    }
    beat += Math.max(0.25, step.beats);
  }

  return grooveProgressionStepsToBeatLabRollFromHits(collapsed, opts);
}

/** Bar headers for NEW SYNTH after a Groove Lab progression drop (optional). */
export function grooveProgressionStepsToChordRail(
  steps: readonly GrooveProgressionStep[],
  beatsPerBar = 4,
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
  const mode: ChordMode = 'major';
  return { timeline, keyRoot: 0, mode };
}
