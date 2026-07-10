/**
 * Synth Geno Build 1 / 2 → Groove Lead — progression bridge (no Progression+ duplicate).
 */
import { chordSymbolToName, type ChordMode, type ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import {
  newProgressionStepId,
  type GrooveProgressionStep,
} from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { GenoBarChordSpec } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { Se2SynthGenoChordPluginState } from '@/app/lib/studio/se2SynthGenoChordPlugin';
import type { Se2SynthGenoPluginDraft } from '@/app/lib/studio/se2SynthGenoChordPlugin';
import { genoBuildPluginLoopBarViews } from '@/app/lib/studio/se2SynthGenoPluginDisplay';
import { se2SynthGenoTileBarSpecs } from '@/app/lib/studio/se2SynthGenoEraProgressionLibrary';
import type { GenoLoopBarCount } from '@/app/lib/studio/se2SynthGenoLoopBarCount';
import type { Se2SynthGenoLivePreset } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import {
  se2SynthGenoPluginBaseLoop,
  se2SynthGenoPluginOrderedLoopSpecs,
  se2SynthGenoPluginPlayOrder,
  se2SynthGenoPluginRomansForLoop,
  se2SynthGenoPluginSlotEnabled,
} from '@/app/lib/studio/se2SynthGenoPluginProgressionTriggers';
import { se2SynthGenoEffectiveScaleMode } from '@/app/lib/studio/se2SynthGenoHarmonyIntel';
import {
  progressionStepsToGrooveLeadMelody,
  studioDefaultHarmonyMelodyStyleId,
  type StudioHarmonyMidiNote,
} from '@/app/lib/studio/studioInstrumentHarmony';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import {
  se2SynthGenoGrooveLeadTimelineBarCount,
  se2SynthGenoRegenerateGrooveLeadNotes,
} from '@/app/lib/studio/se2SynthGenoGrooveLeadDock';
import type { Se2GrooveLeadTrack } from '@/app/lib/studio/se2GrooveLeadTrack';
import type { Se2SynthGenoTrack } from '@/app/lib/studio/se2SynthGenoTrack';

export type Se2SynthGenoGrooveLeadLockCommon = {
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  harmonyScaleMode?: ChordMode;
  beatsPerBar: number;
  bpm: number;
  melodySeed?: number;
  /** Inline lead from Geno loop editor — used when locking to timeline lane. */
  grooveLeadNotes?: readonly StudioEditor2GenNote[];
};

export type Se2SynthGenoGrooveLeadLockB02Input = Se2SynthGenoGrooveLeadLockCommon & {
  build: 'b02';
  state: Se2SynthGenoChordPluginState;
  draft?: Se2SynthGenoPluginDraft | null;
};

export type Se2SynthGenoGrooveLeadLockB01Input = Se2SynthGenoGrooveLeadLockCommon & {
  build: 'b01';
  activePreset: Se2SynthGenoLivePreset;
  editRomans: readonly ChordSymbol[];
  orderedSlotIndices: readonly number[];
  slotEnabled: readonly boolean[];
  barCount: GenoLoopBarCount;
  liveDraft?: Se2SynthGenoPluginDraft | null;
  barChordSpecs?: readonly GenoBarChordSpec[];
};

export type Se2SynthGenoGrooveLeadLockInput =
  | Se2SynthGenoGrooveLeadLockB01Input
  | Se2SynthGenoGrooveLeadLockB02Input;

export function se2SynthGenoGrooveLeadTrackName(genoTrackName: string): string {
  const base = genoTrackName.trim() || 'Synth Geno';
  return `Groove Lead ← ${base}`;
}

export function se2FindGrooveLeadForSynthGeno(
  tracks: readonly { id: string; kind?: string; grooveLeadHarmonyTrackId?: string }[],
  synthGenoTrackId: string,
  linkedGrooveLeadId?: string,
): number {
  if (linkedGrooveLeadId) {
    const idx = tracks.findIndex((t) => t.id === linkedGrooveLeadId && t.kind === 'grooveLead');
    if (idx >= 0) return idx;
  }
  return tracks.findIndex(
    (t) => t.kind === 'grooveLead' && t.grooveLeadHarmonyTrackId === synthGenoTrackId,
  );
}

/** Geno B2 loop → Progression+ step shape for Groove Lead chord-aware melody. */
export function se2SynthGenoPluginBuildHarmonySteps(
  input: Se2SynthGenoGrooveLeadLockB02Input,
): GrooveProgressionStep[] | { message: string } {
  const { state, keyRoot, keyMode, beatsPerBar, draft } = input;
  const scaleMode = se2SynthGenoEffectiveScaleMode(keyMode, input.harmonyScaleMode);
  const bpb = Math.max(1, beatsPerBar);
  const barCount = Math.max(1, state.barCount);
  const playOrder = se2SynthGenoPluginPlayOrder(state, barCount);
  const slotEnabled = se2SynthGenoPluginSlotEnabled(state, barCount);
  const loop = se2SynthGenoPluginBaseLoop(state);
  const orderedSpecs = se2SynthGenoPluginOrderedLoopSpecs(loop, playOrder, slotEnabled);
  const romans = se2SynthGenoPluginRomansForLoop(state, orderedSpecs, keyMode);

  const draftSymbols =
    draft != null
      ? genoBuildPluginLoopBarViews({
          harmony: draft.harmony,
          chordNotes: draft.chordNotes,
          melodyNotes: draft.melodyNotes,
          bassNotes: draft.bassNotes,
          barCount,
          beatsPerBar: bpb,
          keyRoot,
          keyMode,
          barChordSpecs: state.barChordSpecs ?? orderedSpecs,
        }).map((v) => v.chordSymbol)
      : null;

  const steps: GrooveProgressionStep[] = [];
  let chordCount = 0;
  for (let bar = 0; bar < barCount; bar += 1) {
    if (slotEnabled[bar] === false) continue;
    const fromDraft = draftSymbols?.[bar]?.trim();
    const fromRoman = romans[bar]
      ? chordSymbolToName(romans[bar]!, keyRoot, scaleMode)
      : '';
    const label = (fromDraft && fromDraft !== '—' ? fromDraft : fromRoman).trim();
    if (!label) continue;
    steps.push({
      id: newProgressionStepId(),
      label,
      beats: bpb,
    });
    chordCount += 1;
  }

  if (chordCount === 0) {
    return { message: 'Pick a progression in Geno Build 2 first (preset library or Generate All).' };
  }
  return steps;
}

/** Geno B1 live preset → Progression+ step shape for Groove Lead chord-aware melody. */
export function se2SynthGenoLiveBuildHarmonySteps(
  input: Se2SynthGenoGrooveLeadLockB01Input,
): GrooveProgressionStep[] | { message: string } {
  const {
    activePreset,
    editRomans,
    orderedSlotIndices,
    slotEnabled,
    barCount,
    keyRoot,
    keyMode,
    beatsPerBar,
    liveDraft,
    barChordSpecs,
  } = input;
  const scaleMode = se2SynthGenoEffectiveScaleMode(keyMode, input.harmonyScaleMode);
  const bpb = Math.max(1, beatsPerBar);
  const chordCount = orderedSlotIndices.length;
  if (chordCount === 0) {
    return { message: 'Pick a vibe preset in Geno Build 1 first.' };
  }

  const orderedRomans = orderedSlotIndices.map(
    (slotIdx) => editRomans[slotIdx] ?? activePreset.romans[slotIdx] ?? ('I' as ChordSymbol),
  );

  const draftSymbols =
    liveDraft != null
      ? genoBuildPluginLoopBarViews({
          harmony: liveDraft.harmony,
          chordNotes: liveDraft.chordNotes,
          melodyNotes: liveDraft.melodyNotes,
          bassNotes: liveDraft.bassNotes,
          barCount,
          beatsPerBar: bpb,
          keyRoot,
          keyMode,
          barChordSpecs: barChordSpecs ?? se2SynthGenoTileBarSpecs(
            orderedSlotIndices.map((slotIdx) => {
              const roman = editRomans[slotIdx] ?? activePreset.romans[slotIdx];
              return roman
                ? { degree: 0, smartMatch: true }
                : { degree: 0 };
            }),
            barCount,
          ),
        }).map((v) => v.chordSymbol)
      : null;

  const steps: GrooveProgressionStep[] = [];
  let hitCount = 0;
  for (let bar = 0; bar < barCount; bar += 1) {
    const cycleIdx = bar % orderedRomans.length;
    const slotIdx = orderedSlotIndices[cycleIdx]!;
    if (slotEnabled[slotIdx] === false) continue;
    const fromDraft = draftSymbols?.[bar]?.trim();
    const fromRoman = chordSymbolToName(orderedRomans[cycleIdx]!, keyRoot, scaleMode);
    const label = (fromDraft && fromDraft !== '—' ? fromDraft : fromRoman).trim();
    if (!label) continue;
    steps.push({
      id: newProgressionStepId(),
      label,
      beats: bpb,
    });
    hitCount += 1;
  }

  if (hitCount === 0) {
    return { message: 'Pick a vibe preset in Geno Build 1 first.' };
  }
  return steps;
}

export function se2SynthGenoBuildHarmonySteps(
  input: Se2SynthGenoGrooveLeadLockInput,
): GrooveProgressionStep[] | { message: string } {
  return input.build === 'b01'
    ? se2SynthGenoLiveBuildHarmonySteps(input)
    : se2SynthGenoPluginBuildHarmonySteps(input);
}

export function se2SynthGenoGrooveLeadMelodyNotes(
  input: Se2SynthGenoGrooveLeadLockInput,
): StudioHarmonyMidiNote[] | { message: string } {
  const inline: readonly StudioEditor2GenNote[] | undefined =
    input.grooveLeadNotes?.length
      ? input.grooveLeadNotes
      : input.build === 'b01'
        ? input.liveDraft?.grooveLeadNotes
        : input.draft?.grooveLeadNotes;

  if (inline?.length) {
    return inline.map((n) => ({
      pitch: Math.round(n.pitch),
      startBeat: n.startBeat,
      durationBeats: n.durationBeats,
      velocity: Math.max(1, Math.min(127, Math.round(n.velocity))),
    }));
  }

  const draft = input.build === 'b01' ? input.liveDraft : input.draft;
  if (draft?.chordNotes.length) {
    const barCount =
      input.build === 'b01'
        ? input.barCount
        : se2SynthGenoGrooveLeadTimelineBarCount(draft, input.state.barCount);
    const fromLoop = se2SynthGenoRegenerateGrooveLeadNotes({
      draft,
      beatsPerBar: Math.max(1, input.beatsPerBar),
      timelineBarCount: barCount,
      keyRoot: input.keyRoot,
      keyMode: input.keyMode,
      harmonyScaleMode: input.harmonyScaleMode,
      barChordSpecs:
        input.build === 'b02'
          ? input.state.barChordSpecs
          : input.barChordSpecs,
      bpm: input.bpm,
      seed: Math.max(1, input.melodySeed ?? 1),
      build: input.build,
    });
    if (fromLoop.length > 0) {
      return fromLoop.map((n) => ({
        pitch: Math.round(n.pitch),
        startBeat: n.startBeat,
        durationBeats: n.durationBeats,
        velocity: Math.max(1, Math.min(127, Math.round(n.velocity))),
      }));
    }
  }

  const steps = se2SynthGenoBuildHarmonySteps(input);
  if ('message' in steps) return steps;
  const scaleMode = se2SynthGenoEffectiveScaleMode(input.keyMode, input.harmonyScaleMode);
  const barCount = input.build === 'b01' ? input.barCount : input.state.barCount;
  return progressionStepsToGrooveLeadMelody(steps, {
    beatsPerBar: Math.max(1, input.beatsPerBar),
    barCount,
    keyRoot: input.keyRoot,
    keyMode: scaleMode,
    seed: Math.max(1, input.melodySeed ?? 1),
    styleId: studioDefaultHarmonyMelodyStyleId(),
    bpm: input.bpm,
  });
}

export type Se2SynthGenoGrooveLeadLockTrack = Se2SynthGenoTrack & {
  id: string;
  name: string;
  synthGenoGrooveLeadTrackId?: string;
};

export type Se2SynthGenoGrooveLeadLockGrooveTrack = Se2GrooveLeadTrack & {
  id: string;
  name: string;
};
