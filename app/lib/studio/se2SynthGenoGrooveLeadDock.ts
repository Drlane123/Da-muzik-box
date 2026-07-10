/**
 * Groove Lead inside Geno B01/B02 — chord-follower engine (B01 reference, mirrored on B02).
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { GrooveComposerHarmony } from '@/app/lib/creationStation/grooveLabComposerTypes';
import { GROOVE_LAB_CHORD_HARMONY_MIDI_MIN } from '@/app/lib/creationStation/grooveLabPitch';
import {
  GROOVE_LAB_SLOTS_PER_BAR,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';
import { waveLeafClampMidi } from '@/app/lib/creationStation/waveLeafPitch';
import {
  waveLeafMelodyStyleById,
  type WaveLeafMelodyStyleId,
} from '@/app/lib/creationStation/waveLeafMelodyStyles';
import type { GenoBarChordSpec, GenoHarmony } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { Se2SynthGenoPluginDraft } from '@/app/lib/studio/se2SynthGenoChordPlugin';
import { genoPluginLoopTimelineBarCount } from '@/app/lib/studio/se2SynthGenoPluginDisplay';
import { genoGenerateLiveGrooveLeadFromHarmony, GENO_B01_GROOVE_LEAD_STYLE_ID } from '@/app/lib/studio/se2SynthGenoLiveGrooveLeadEngine';
import { se2GrooveRollHitsToMockNotes } from '@/app/lib/studio/se2GrooveLeadNotes';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';

/** @deprecated Legacy WaveLeaf slot map — kept for external callers only. */
export function genoHarmonyToGrooveComposerHarmony(harmony: GenoHarmony): GrooveComposerHarmony {
  return {
    columns: harmony.columns.map((col) => ({
      slot: col.bar * GROOVE_LAB_SLOTS_PER_BAR,
      rootMidi: waveLeafClampMidi(col.rootMidi),
      tones: [...new Set(col.tones.map((t) => waveLeafClampMidi(t)))].sort((a, b) => a - b),
    })),
  };
}

/** Green-stack chord hits from Geno loop chord MIDI — same voicing the loop editor plays. */
export function se2SynthGenoDraftChordHitsForGrooveLead(
  draft: Se2SynthGenoPluginDraft,
  beatsPerBar: number,
  timelineBarCount: number,
): GrooveRollHit[] {
  const bpb = Math.max(1, beatsPerBar);
  const slotsPerBeat = GROOVE_LAB_SLOTS_PER_BAR / bpb;
  const loopEndBeat = timelineBarCount * bpb;
  const out: GrooveRollHit[] = [];
  for (const n of draft.chordNotes) {
    if (n.startBeat >= loopEndBeat) continue;
    const midi = Math.round(n.pitch);
    if (!Number.isFinite(midi) || midi < GROOVE_LAB_CHORD_HARMONY_MIDI_MIN) continue;
    out.push({
      slot: Math.max(0, Math.round(n.startBeat * slotsPerBeat)),
      midi,
      sustainSlots: Math.max(1, Math.round(n.durationBeats * slotsPerBeat)),
      vel: Math.max(0.05, Math.min(1, n.velocity / 127)),
    });
  }
  return out.sort((a, b) => a.slot - b.slot || a.midi - b.midi);
}

export function se2SynthGenoGrooveLeadTimelineBarCount(
  draft: Se2SynthGenoPluginDraft,
  timelineBarCount?: number,
): number {
  return genoPluginLoopTimelineBarCount({
    timelineBarCount,
    draftBars: draft.bars,
  });
}

export function se2SynthGenoRegenerateGrooveLeadNotes(opts: {
  draft: Se2SynthGenoPluginDraft;
  beatsPerBar: number;
  timelineBarCount?: number;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  harmonyScaleMode?: ChordMode;
  bpm: number;
  seed: number;
  styleId?: WaveLeafMelodyStyleId;
  movement?: number;
  chordFit?: number;
  barChordSpecs?: readonly GenoBarChordSpec[];
  /** B01 + B02 share the chord-follower lead engine. */
  build?: 'b01' | 'b02';
}): StudioEditor2GenNote[] {
  void opts.harmonyScaleMode;
  void opts.barChordSpecs;
  void opts.chordFit;
  void opts.build;
  const barCount = se2SynthGenoGrooveLeadTimelineBarCount(opts.draft, opts.timelineBarCount);
  const chordHits = se2SynthGenoDraftChordHitsForGrooveLead(opts.draft, opts.beatsPerBar, barCount);
  if (chordHits.length === 0 || opts.draft.harmony.columns.length === 0) return [];

  const style = waveLeafMelodyStyleById(opts.styleId ?? GENO_B01_GROOVE_LEAD_STYLE_ID);
  return genoGenerateLiveGrooveLeadFromHarmony({
    harmony: opts.draft.harmony,
    chordNotes: opts.draft.chordNotes,
    barCount,
    beatsPerBar: opts.beatsPerBar,
    seed: Math.max(1, opts.seed),
    keyRoot: opts.keyRoot,
    keyMode: opts.keyMode,
    movement: opts.movement ?? style.movement,
    bpm: opts.bpm,
  });
}

export function se2SynthGenoGrooveLeadNotesFromDraft(
  notes: readonly StudioEditor2GenNote[] | undefined,
): StudioEditor2GenNote[] {
  if (!notes?.length) return [];
  return notes.map((n) => ({ ...n }));
}

/** Preview roll — mock notes for WaveLeaf one-shot audition. */
export function se2SynthGenoGrooveLeadPreviewMocks(notes: readonly StudioEditor2GenNote[]) {
  const hits = notes.map((n) => ({
    slot: Math.round(n.startBeat * (GROOVE_LAB_SLOTS_PER_BAR / 4)),
    midi: Math.round(n.pitch),
    sustainSlots: Math.max(1, Math.round(n.durationBeats * (GROOVE_LAB_SLOTS_PER_BAR / 4))),
    vel: Math.max(0.05, Math.min(1, n.velocity / 127)),
  }));
  return se2GrooveRollHitsToMockNotes(hits);
}
