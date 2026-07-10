/**
 * Groove Lead — melody from a user-selected harmony lane (progression steps or chord MIDI).
 * Chord MIDI / steps → chord-follower lead locked to root on each chord change.
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { GrooveRollHit } from '@/app/lib/creationStation/grooveLabRoll';
import { GROOVE_LAB_SLOTS_PER_BAR } from '@/app/lib/creationStation/grooveLabRoll';
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
} from '@/app/lib/studio/studioInstrumentHarmony';

export type Se2GrooveLeadHarmonyMelodyInput = GenoUltraArpSe2TrackChordInput;

export function se2GrooveLeadCanFollowHarmonySource(tr: Se2GrooveLeadHarmonyMelodyInput): boolean {
  return studioGenoUltraCanFollowChordsFromTrack(tr);
}

/** Root-anchored chord hits for WaveLeaf melody generator preview. */
export function se2GrooveLeadChordHitsFromHarmonySource(
  tr: Se2GrooveLeadHarmonyMelodyInput,
  beatsPerBar: number,
  barCount: number,
): GrooveRollHit[] {
  const built = se2HarmonyChordNotesFromTrack(tr, beatsPerBar);
  if ('message' in built) return [];
  const bpb = Math.max(1, beatsPerBar);
  const bars = Math.max(1, barCount, built.sourceBarCount);
  const totalBeats = bars * bpb;
  const regions = chordFollowerBuildBarRegions(built.notes, totalBeats, bpb);
  const slotsPerBeat = GROOVE_LAB_SLOTS_PER_BAR / bpb;
  return regions.map((r) => ({
    slot: Math.max(0, Math.round(r.attackBeat * slotsPerBeat)),
    sustainSlots: Math.max(
      1,
      Math.round((r.endBeat - r.attackBeat) * slotsPerBeat * 0.88),
    ),
    midi: r.rootPitch,
    vel: 100,
  }));
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
  const chordBuilt = se2HarmonyChordNotesFromTrack(opts.harmonyTr, bpb);
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
          : 'No chord data on the selected lane — add Progression+ steps or chord MIDI.',
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
