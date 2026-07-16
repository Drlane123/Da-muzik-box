/**
 * Groove Lead — melody from a user-selected harmony lane (progression steps or chord MIDI).
 * Chord MIDI / steps → WaveLeaf green stacks (C3–A4) + chord-follower lead.
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  GROOVE_LAB_QUANTIZE_DEFAULT,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';
import { GROOVE_LAB_SLOTS_PER_BAR } from '@/app/lib/creationStation/grooveLabRoll';
import { progressionStepsToGrooveHits } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { grooveLabClampChordRollMidi } from '@/app/lib/creationStation/grooveLabPitch';
import {
  chordFollowerBuildBarRegions,
  chordFollowerGenerateLead,
} from '@/app/lib/studio/se2ChordFollowerLeadEngine';
import { se2HarmonySourceSteps } from '@/app/lib/studio/se2GlideBassHarmony';
import {
  se2HarmonyChordNotesFromTrack,
  studioGenoUltraCanFollowChordsFromTrack,
  type GenoUltraArpSe2TrackChordInput,
} from '@/app/lib/studio/genoUltraArpSe2TrackImport';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import {
  progressionStepsToGrooveLeadMelody,
  studioDefaultHarmonyMelodyStyleId,
  studioHarmonyBarCountFromSteps,
  studioNormalizeHarmonyLoopBars,
} from '@/app/lib/studio/studioInstrumentHarmony';

export type Se2GrooveLeadHarmonyMelodyInput = GenoUltraArpSe2TrackChordInput;

/** Any SE2 lane with Progression+/Rhythm steps, chord MIDI, or root notes. */
export function se2GrooveLeadCanFollowHarmonySource(tr: Se2GrooveLeadHarmonyMelodyInput): boolean {
  if (studioGenoUltraCanFollowChordsFromTrack(tr)) return true;
  if (se2HarmonySourceSteps(tr).length > 0) return true;
  return (tr.notes?.length ?? 0) >= 1;
}

/** Chord notes including bass-register roots (WaveLeaf / follower need a timeline). */
export function se2GrooveLeadChordNotesFromTrack(
  tr: Se2GrooveLeadHarmonyMelodyInput,
  beatsPerBar: number,
): { notes: StudioEditor2GenNote[]; sourceBarCount: number } | { message: string } {
  const primary = se2HarmonyChordNotesFromTrack(tr, beatsPerBar);
  if (!('message' in primary)) return primary;

  const bpb = Math.max(1, beatsPerBar);
  const raw = tr.notes ?? [];
  if (raw.length === 0) return primary;

  const notes: StudioEditor2GenNote[] = raw.map((n) => ({
    pitch: n.pitch,
    startBeat: n.startBeat,
    durationBeats: Math.max(0.125, n.durationBeats),
    velocity: n.velocity ?? 100,
  }));
  const maxEnd = notes.reduce((m, n) => Math.max(m, n.startBeat + n.durationBeats), 0);
  const sourceBarCount = studioNormalizeHarmonyLoopBars(Math.max(1, Math.ceil(maxEnd / bpb)));
  return { notes, sourceBarCount };
}

/**
 * Green chord stacks for WaveLeaf GEN — C3–A4 only.
 * Prefers Progression+/Rhythm steps (proper voicings); falls back to MIDI/roots
 * clamped into the chord register (lead-register roots alone used to fail sanitize).
 */
export function se2GrooveLeadChordHitsFromHarmonySource(
  tr: Se2GrooveLeadHarmonyMelodyInput,
  beatsPerBar: number,
  barCount: number,
): GrooveRollHit[] {
  const bpb = Math.max(1, beatsPerBar);
  const bars = Math.max(1, barCount);

  const steps = se2HarmonySourceSteps(tr);
  if (steps.length > 0) {
    const staged = progressionStepsToGrooveHits(steps, {
      quantize: GROOVE_LAB_QUANTIZE_DEFAULT,
      barCount: bars,
      sustainSlots: 16,
      beatsPerBar: bpb,
    });
    if (!('message' in staged) && staged.chordHits.length > 0) {
      return staged.chordHits;
    }
  }

  const built = se2GrooveLeadChordNotesFromTrack(tr, bpb);
  if ('message' in built) return [];

  const totalBeats = Math.max(bars, built.sourceBarCount) * bpb;
  const regions = chordFollowerBuildBarRegions(built.notes, totalBeats, bpb);
  if (regions.length === 0) return [];

  const slotsPerBeat = GROOVE_LAB_SLOTS_PER_BAR / bpb;
  const hits: GrooveRollHit[] = [];

  for (const r of regions) {
    const slot = Math.max(0, Math.round(r.attackBeat * slotsPerBeat));
    const sustainSlots = Math.max(
      1,
      Math.round((r.endBeat - r.attackBeat) * slotsPerBeat * 0.88),
    );
    const stackMidis = [
      ...new Set(
        [r.rootPitch, ...r.tones].map((m) => grooveLabClampChordRollMidi(m)),
      ),
    ].sort((a, b) => a - b);

    for (let i = 0; i < stackMidis.length; i += 1) {
      hits.push({
        slot,
        sustainSlots,
        midi: stackMidis[i]!,
        vel: Math.max(0.55, 0.92 - i * 0.05),
      });
    }
  }

  return hits;
}

export function se2GrooveLeadMelodyFromHarmonySource(opts: {
  harmonyTr: Se2GrooveLeadHarmonyMelodyInput;
  beatsPerBar: number;
  loopBars: number;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode | ChordMode;
  seed: number;
  bpm: number;
  styleId?: string;
}): StudioEditor2GenNote[] | { message: string } {
  const bpb = Math.max(1, opts.beatsPerBar);
  const chordBuilt = se2GrooveLeadChordNotesFromTrack(opts.harmonyTr, bpb);
  if (!('message' in chordBuilt)) {
    const barCount = Math.max(
      1,
      opts.loopBars,
      chordBuilt.sourceBarCount,
      Math.ceil(
        chordBuilt.notes.reduce((m, n) => Math.max(m, n.startBeat + n.durationBeats), 0) / bpb,
      ),
    );
    const notes = chordFollowerGenerateLead({
      chordNotes: chordBuilt.notes,
      barCount,
      beatsPerBar: bpb,
      seed: opts.seed,
      keyRoot: opts.keyRoot,
      keyMode: opts.keyMode as StudioDetectedKeyMode,
      bpm: opts.bpm,
    });
    if (notes.length > 0) return notes;
  }

  const steps = se2HarmonySourceSteps(opts.harmonyTr);
  if (steps.length === 0) {
    return {
      message:
        'message' in chordBuilt
          ? chordBuilt.message
          : 'No chord data on the selected lane — add Progression+ steps, chord MIDI, or root notes.',
    };
  }

  const barCount = studioHarmonyBarCountFromSteps(steps, bpb);
  const phrase = progressionStepsToGrooveLeadMelody(steps, {
    beatsPerBar: bpb,
    barCount,
    keyRoot: opts.keyRoot,
    keyMode: opts.keyMode as StudioDetectedKeyMode,
    seed: opts.seed,
    styleId: opts.styleId ?? studioDefaultHarmonyMelodyStyleId(),
    bpm: opts.bpm,
  });
  if ('message' in phrase) return phrase;
  return phrase;
}
