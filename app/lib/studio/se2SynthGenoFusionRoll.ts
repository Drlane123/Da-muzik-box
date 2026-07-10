/**
 * Fusion piano roll — note model, lane ranges, snap, session (independent of Synth Geno generator).
 */
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import {
  SE2_SYNTH_GENO_CHORD_DEFAULTS,
  se2SynthGenoApplyStylePreset,
  se2SynthGenoDefaultPartSeeds,
  se2SynthGenoGeneratePluginDraft,
  se2SynthGenoRegeneratePluginPart,
  type Se2SynthGenoPluginDraft,
  type Se2SynthGenoPluginSoundSelection,
} from '@/app/lib/studio/se2SynthGenoChordPlugin';
import { SE2_SYNTH_GENO_DEFAULT_SOUND_SELECTION, se2SynthGenoNormalizePluginSoundSelection } from '@/app/lib/studio/se2SynthGenoSoundBank';
import type { Se2ComposeResolvedKey } from '@/app/lib/studio/se2SynthGenoKeyLock';
import { se2SynthGenoLockNotesToKey } from '@/app/lib/studio/se2SynthGenoKeyLock';
import { genoNormalizePartNotes } from '@/app/lib/studio/se2SynthGenoRanges';
import type { Se2SynthGenoStackPart } from '@/app/lib/studio/se2SynthGenoCompose';
import type { Se2SynthGenoVoiceParams } from '@/app/lib/studio/se2SynthGenoTypes';
import { buildGenoComposePromptProfile } from '@/app/lib/studio/se2SynthGenoCompose';
import { se2SynthGenoSynthRoleForPluginPart } from '@/app/lib/studio/se2SynthGenoPresets';
import { se2SynthGenoSanitizeChordPianoBankId } from '@/app/lib/studio/se2SynthGenoChordPianoLibrary';
import {
  se2SynthGenoSanitizePluginMelodyBankId,
  se2SynthGenoSanitizeSoundBankId,
  se2SynthGenoSoundBankEntry,
} from '@/app/lib/studio/se2SynthGenoSoundBank';
import {
  se2SynthGenoFusionMapToChordState,
  type Se2SynthGenoFusionParams,
} from '@/app/lib/studio/se2SynthGenoFusionEngine';
import type { Se2FusionFlexPoint } from '@/app/lib/studio/se2SynthGenoFusionFlexCurve';
import {
  se2FusionFlexCurveToPlaybackPoints,
  se2FusionFlexNewPointId,
  se2FusionMigrateNoteFlexCurve,
  se2FusionNoteHasFlexCurve,
  se2FusionSanitizeFlexCurve,
} from '@/app/lib/studio/se2SynthGenoFusionFlexCurve';

export const FUSION_ROLL_BAR_COUNT = 8;

export type Se2FusionPianoQuantize = '1/4' | '1/8' | '1/16' | '1/32';

export const SE2_FUSION_PIANO_QUANTIZE_OPTIONS: {
  id: Se2FusionPianoQuantize;
  label: string;
  stepsPerBeat: number;
}[] = [
  { id: '1/4', label: '1/4', stepsPerBeat: 1 },
  { id: '1/8', label: '1/8', stepsPerBeat: 2 },
  { id: '1/16', label: '1/16', stepsPerBeat: 4 },
  { id: '1/32', label: '1/32', stepsPerBeat: 8 },
];

export type Se2FusionPianoNote = {
  id: string;
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
  /** Note Flex — sketchable pitch curve inside the note (time × pitch, any angle). */
  flexCurve?: Se2FusionFlexPoint[];
  /** @deprecated migrated to flexCurve */
  segmentPitches?: number[];
  /** @deprecated migrated to flexCurve */
  pitchEnd?: number;
};

export type Se2FusionPianoNoteSegment = {
  segmentIndex: number;
  barIndex: number;
  startBeat: number;
  durationBeats: number;
};

/** Bar-sized slices of a note for Note Flex (each measure can bend independently). */
export function se2FusionPianoNoteSegments(
  note: Se2FusionPianoNote,
  beatsPerBar: number,
): Se2FusionPianoNoteSegment[] {
  const bpb = Math.max(1, beatsPerBar);
  const segs: Se2FusionPianoNoteSegment[] = [];
  let pos = note.startBeat;
  const end = note.startBeat + note.durationBeats;
  let segmentIndex = 0;
  while (pos < end - 1e-6) {
    const barIndex = Math.floor(pos / bpb);
    const barEnd = (barIndex + 1) * bpb;
    const segEnd = Math.min(end, barEnd);
    const durationBeats = segEnd - pos;
    if (durationBeats > 1e-6) {
      segs.push({ segmentIndex, barIndex, startBeat: pos, durationBeats });
      segmentIndex += 1;
    }
    pos = segEnd;
  }
  return segs;
}

export function se2FusionPianoSegmentPitch(
  note: Se2FusionPianoNote,
  segmentIndex: number,
  beatsPerBar: number,
): number {
  const segs = se2FusionPianoNoteSegments(note, beatsPerBar);
  if (segmentIndex < 0 || segmentIndex >= segs.length) return note.pitch;
  return note.segmentPitches?.[segmentIndex] ?? note.pitch;
}

export function se2FusionPianoNoteHasBend(note: Se2FusionPianoNote, beatsPerBar: number): boolean {
  const segs = se2FusionPianoNoteSegments(note, beatsPerBar);
  return segs.some((_, i) => se2FusionPianoSegmentPitch(note, i, beatsPerBar) !== note.pitch);
}

export function se2FusionPianoSetSegmentPitch(
  note: Se2FusionPianoNote,
  segmentIndex: number,
  pitch: number,
  beatsPerBar: number,
  lane: Se2SynthGenoFusionLaneId,
): Se2FusionPianoNote {
  const segs = se2FusionPianoNoteSegments(note, beatsPerBar);
  if (segmentIndex < 0 || segmentIndex >= segs.length) return note;
  const meta = SE2_SYNTH_GENO_FUSION_LANE_META[lane];
  const p = Math.max(meta.pitchLo, Math.min(meta.pitchHi, Math.round(pitch)));
  const segmentPitches = segs.map((_, i) =>
    i === segmentIndex ? p : se2FusionPianoSegmentPitch(note, i, beatsPerBar),
  );
  const allBase = segmentPitches.every((sp) => sp === note.pitch);
  return { ...note, segmentPitches: allBase ? undefined : segmentPitches, pitchEnd: undefined };
}

function se2FusionPianoMigrateLegacyBend(
  note: Se2FusionPianoNote,
  beatsPerBar: number,
): Se2FusionPianoNote {
  if (note.pitchEnd == null || note.pitchEnd === note.pitch || note.segmentPitches?.length) {
    const { pitchEnd: _drop, ...rest } = note;
    return rest;
  }
  const segs = se2FusionPianoNoteSegments(note, beatsPerBar);
  if (segs.length === 0) return { ...note, pitchEnd: undefined };
  const segmentPitches = segs.map(() => note.pitch);
  segmentPitches[segmentPitches.length - 1] = note.pitchEnd;
  return { ...note, segmentPitches, pitchEnd: undefined };
}

/** Extra beat room past bar 8 while drawing (pointer may extend past the grid edge). */
export function se2FusionPianoDrawMaxBeat(beatsPerBar: number): number {
  return se2FusionPianoTotalBeats(beatsPerBar) + beatsPerBar * 0.5;
}

export type Se2SynthGenoFusionLaneId = 'bass' | 'melody' | 'chords';

/** Select value when a lane uses a generated/custom voice instead of a bank preset. */
export const SE2_FUSION_CUSTOM_SOUND_ID = '__fusion_generated_voice__';

export type Se2SynthGenoFusionRollState = {
  activeLane: Se2SynthGenoFusionLaneId;
  lanes: Record<Se2SynthGenoFusionLaneId, Se2FusionPianoNote[]>;
  sounds: Se2SynthGenoPluginSoundSelection;
  quantize: Se2FusionPianoQuantize;
  /** Last chord-plugin draft from Create MIDI — keeps harmony for preview/playback. */
  lastPluginDraft?: Se2SynthGenoPluginDraft;
  /** Generated or custom synth patch per lane (overrides bank preset on preview/export). */
  laneCustomVoices?: Partial<Record<Se2SynthGenoFusionLaneId, Se2SynthGenoVoiceParams>>;
};

export const SE2_SYNTH_GENO_FUSION_LANE_META: Record<
  Se2SynthGenoFusionLaneId,
  {
    label: string;
    shortLabel: string;
    color: string;
    bankCategory: 'accord' | 'melody' | 'bass';
    pitchLo: number;
    pitchHi: number;
    defaultPitch: number;
  }
> = {
  chords: {
    label: 'Chords',
    shortLabel: 'Chords',
    color: '#00E5CC',
    bankCategory: 'accord',
    pitchLo: 48,
    pitchHi: 72,
    defaultPitch: 60,
  },
  melody: {
    label: 'Melody / Arp',
    shortLabel: 'Melody',
    color: '#a78bfa',
    bankCategory: 'melody',
    pitchLo: 60,
    pitchHi: 84,
    defaultPitch: 72,
  },
  bass: {
    label: 'Bass',
    shortLabel: 'Bass',
    color: '#fbbf24',
    bankCategory: 'bass',
    pitchLo: 28,
    pitchHi: 55,
    defaultPitch: 36,
  },
};

const rollSessions = new Map<number, Se2SynthGenoFusionRollState>();

let noteIdSeq = 1;

export function se2FusionPianoNewNoteId(): string {
  noteIdSeq += 1;
  return `fusion-n-${Date.now()}-${noteIdSeq}`;
}

export function se2FusionPianoTotalBeats(beatsPerBar: number): number {
  return FUSION_ROLL_BAR_COUNT * beatsPerBar;
}

export function se2FusionPianoPitchRows(lo: number, hi: number): number[] {
  const rows: number[] = [];
  for (let p = hi; p >= lo; p -= 1) rows.push(p);
  return rows;
}

export function se2FusionPianoSnapBeat(
  beat: number,
  quantize: Se2FusionPianoQuantize,
  beatsPerBar: number,
): number {
  const stepsPerBeat = SE2_FUSION_PIANO_QUANTIZE_OPTIONS.find((q) => q.id === quantize)?.stepsPerBeat ?? 4;
  const step = 1 / stepsPerBeat;
  const total = se2FusionPianoTotalBeats(beatsPerBar);
  const snapped = Math.round(beat / step) * step;
  return Math.max(0, Math.min(Math.max(step, total - step), snapped));
}

export function se2FusionPianoSnapDuration(
  durationBeats: number,
  quantize: Se2FusionPianoQuantize,
  min = 1 / 32,
): number {
  const stepsPerBeat = SE2_FUSION_PIANO_QUANTIZE_OPTIONS.find((q) => q.id === quantize)?.stepsPerBeat ?? 4;
  const step = 1 / stepsPerBeat;
  return Math.max(min, Math.round(durationBeats / step) * step);
}

export function se2FusionPianoClampNote(
  note: Se2FusionPianoNote,
  lane: Se2SynthGenoFusionLaneId,
  beatsPerBar: number,
): Se2FusionPianoNote {
  const meta = SE2_SYNTH_GENO_FUSION_LANE_META[lane];
  const total = se2FusionPianoTotalBeats(beatsPerBar);
  const start = Math.max(0, Math.min(total - 1 / 32, note.startBeat));
  const maxDur = total - start;
  const dur = Math.max(1 / 32, Math.min(maxDur, note.durationBeats));
  const pitch = Math.max(meta.pitchLo, Math.min(meta.pitchHi, Math.round(note.pitch)));
  const migrated = se2FusionMigrateNoteFlexCurve(
    { ...note, startBeat: start, durationBeats: dur, pitch },
    beatsPerBar,
  );
  let flexCurve = migrated.flexCurve?.map((p) => ({
    ...p,
    beatOffset: Math.max(0, Math.min(dur, p.beatOffset)),
    pitch: Math.max(meta.pitchLo, Math.min(meta.pitchHi, Math.round(p.pitch))),
  }));
  const sanitized = se2FusionSanitizeFlexCurve(
    { ...migrated, startBeat: start, durationBeats: dur, pitch, flexCurve },
    lane,
  );
  return {
    ...sanitized,
    startBeat: start,
    durationBeats: dur,
    pitch,
    segmentPitches: undefined,
    pitchEnd: undefined,
  };
}

export function se2FusionPianoRollToGenNotes(
  notes: readonly Se2FusionPianoNote[],
  beatsPerBar: number,
): StudioEditor2GenNote[] {
  const out: StudioEditor2GenNote[] = [];
  for (const raw of notes) {
    const n = se2FusionMigrateNoteFlexCurve(raw, beatsPerBar);
    if (se2FusionNoteHasFlexCurve(n, beatsPerBar)) {
      out.push({
        pitch: n.pitch,
        startBeat: n.startBeat,
        durationBeats: n.durationBeats,
        velocity: n.velocity,
        flexCurve: se2FusionFlexCurveToPlaybackPoints(n, beatsPerBar),
      });
      continue;
    }
    out.push({
      pitch: n.pitch,
      startBeat: n.startBeat,
      durationBeats: n.durationBeats,
      velocity: n.velocity,
    });
  }
  return out;
}

export function se2SynthGenoFusionEmptyRoll(): Se2SynthGenoFusionRollState {
  return {
    activeLane: 'chords',
    lanes: { bass: [], melody: [], chords: [] },
    sounds: { ...SE2_SYNTH_GENO_DEFAULT_SOUND_SELECTION },
    quantize: '1/16',
  };
}

export function readSe2SynthGenoFusionRollSession(trackIndex: number): Se2SynthGenoFusionRollState {
  const stored = rollSessions.get(trackIndex);
  if (!stored) return se2SynthGenoFusionEmptyRoll();
  return {
    ...stored,
    lanes: {
      bass: stored.lanes.bass.map((n) => ({ ...n })),
      melody: stored.lanes.melody.map((n) => ({ ...n })),
      chords: stored.lanes.chords.map((n) => ({ ...n })),
    },
    sounds: { ...stored.sounds },
    lastPluginDraft: stored.lastPluginDraft
      ? {
          ...stored.lastPluginDraft,
          chordNotes: [...stored.lastPluginDraft.chordNotes],
          melodyNotes: [...stored.lastPluginDraft.melodyNotes],
          bassNotes: [...stored.lastPluginDraft.bassNotes],
          fillerNotes: [...(stored.lastPluginDraft.fillerNotes ?? [])],
          harmony: stored.lastPluginDraft.harmony,
        }
      : undefined,
    laneCustomVoices: stored.laneCustomVoices
      ? {
          chords: stored.laneCustomVoices.chords ? { ...stored.laneCustomVoices.chords } : undefined,
          melody: stored.laneCustomVoices.melody ? { ...stored.laneCustomVoices.melody } : undefined,
          bass: stored.laneCustomVoices.bass ? { ...stored.laneCustomVoices.bass } : undefined,
        }
      : undefined,
  };
}

export function writeSe2SynthGenoFusionRollSession(
  trackIndex: number,
  roll: Se2SynthGenoFusionRollState,
): void {
  rollSessions.set(trackIndex, roll);
}

export function se2SynthGenoFusionSetLaneNotes(
  roll: Se2SynthGenoFusionRollState,
  lane: Se2SynthGenoFusionLaneId,
  notes: Se2FusionPianoNote[],
): Se2SynthGenoFusionRollState {
  return { ...roll, lanes: { ...roll.lanes, [lane]: notes } };
}

export function se2SynthGenoFusionSetSound(
  roll: Se2SynthGenoFusionRollState,
  lane: Se2SynthGenoFusionLaneId,
  bankId: string,
): Se2SynthGenoFusionRollState {
  const sounds = { ...roll.sounds };
  if (lane === 'chords') sounds.accordBankId = bankId;
  else if (lane === 'melody') sounds.melodyBankId = bankId;
  else sounds.bassBankId = bankId;
  const laneCustomVoices = roll.laneCustomVoices ? { ...roll.laneCustomVoices } : undefined;
  if (laneCustomVoices) delete laneCustomVoices[lane];
  return {
    ...roll,
    sounds,
    laneCustomVoices: laneCustomVoices && Object.keys(laneCustomVoices).length > 0 ? laneCustomVoices : undefined,
  };
}

export function se2SynthGenoFusionSetLaneCustomVoice(
  roll: Se2SynthGenoFusionRollState,
  lane: Se2SynthGenoFusionLaneId,
  voice: Se2SynthGenoVoiceParams,
): Se2SynthGenoFusionRollState {
  return {
    ...roll,
    activeLane: lane,
    laneCustomVoices: { ...roll.laneCustomVoices, [lane]: { ...voice } },
  };
}

export function se2SynthGenoFusionLaneUsesCustomVoice(
  roll: Se2SynthGenoFusionRollState,
  lane: Se2SynthGenoFusionLaneId,
): boolean {
  return roll.laneCustomVoices?.[lane] != null;
}

export function se2SynthGenoFusionLaneCustomVoiceLabel(
  roll: Se2SynthGenoFusionRollState,
  lane: Se2SynthGenoFusionLaneId,
): string | undefined {
  return roll.laneCustomVoices?.[lane]?.label;
}

export function se2SynthGenoFusionRollSummary(roll: Se2SynthGenoFusionRollState): string {
  const c = roll.lanes.chords.length;
  const m = roll.lanes.melody.length;
  const b = roll.lanes.bass.length;
  return `${FUSION_ROLL_BAR_COUNT} bars · ${c} chord · ${m} melody · ${b} bass notes`;
}

export function se2SynthGenoFusionRollHasNotes(roll: Se2SynthGenoFusionRollState): boolean {
  return roll.lanes.chords.length > 0 || roll.lanes.melody.length > 0 || roll.lanes.bass.length > 0;
}

export function se2SynthGenoFusionRollToApplyStack(opts: {
  roll: Se2SynthGenoFusionRollState;
  resolvedKey: Se2ComposeResolvedKey;
  beatsPerBar: number;
}): Se2SynthGenoStackPart[] {
  const { roll, resolvedKey, beatsPerBar } = opts;
  const stack: Se2SynthGenoStackPart[] = [];
  const chordNotes = se2FusionPianoRollToGenNotes(roll.lanes.chords, beatsPerBar);
  const melodyNotes = se2FusionPianoRollToGenNotes(roll.lanes.melody, beatsPerBar);
  const bassRaw = se2FusionPianoRollToGenNotes(roll.lanes.bass, beatsPerBar);

  if (chordNotes.length > 0) {
    stack.push({
      role: 'chords',
      label: 'Chords',
      notes: chordNotes,
      trackKind: 'synthGeno',
      synthGenoRole: se2SynthGenoSynthRoleForPluginPart('chords'),
      synthGenoBankId: roll.sounds.accordBankId,
    });
  }
  if (melodyNotes.length > 0) {
    const melodyPatch = se2SynthGenoSoundBankEntry('melody', roll.sounds.melodyBankId);
    stack.push({
      role: 'melody',
      label: melodyPatch?.label ?? 'Melody',
      notes: genoNormalizePartNotes(melodyNotes, 'melody'),
      trackKind: 'synthGeno',
      synthGenoRole: se2SynthGenoSynthRoleForPluginPart('melody'),
      synthGenoBankId: roll.sounds.melodyBankId,
    });
  }
  if (bassRaw.length > 0) {
    const bassPatch = se2SynthGenoSoundBankEntry('bass', roll.sounds.bassBankId);
    stack.push({
      role: 'bass',
      label: bassPatch?.label ?? 'Bass',
      notes: genoNormalizePartNotes(
        se2SynthGenoLockNotesToKey(bassRaw, resolvedKey, 'bass'),
        'bass',
      ),
      trackKind: 'synthGeno',
      synthGenoRole: se2SynthGenoSynthRoleForPluginPart('bass'),
      synthGenoBankId: roll.sounds.bassBankId,
    });
  }
  return stack;
}

export function se2SynthGenoFusionRollSanitizedSounds(
  roll: Se2SynthGenoFusionRollState,
): Se2SynthGenoPluginSoundSelection {
  return se2SynthGenoNormalizePluginSoundSelection(roll.sounds);
}

export function se2SynthGenoFusionRollToPreviewDraft(
  roll: Se2SynthGenoFusionRollState,
  beatsPerBar: number,
): Se2SynthGenoPluginDraft | null {
  if (!se2SynthGenoFusionRollHasNotes(roll)) return null;
  const cached = roll.lastPluginDraft;
  return {
    progressionId: cached?.progressionId ?? 'I-V-vi-IV',
    bars: FUSION_ROLL_BAR_COUNT,
    harmony: cached?.harmony ?? { columns: [] },
    chordNotes: se2FusionPianoRollToGenNotes(roll.lanes.chords, beatsPerBar),
    melodyNotes: se2FusionPianoRollToGenNotes(roll.lanes.melody, beatsPerBar),
    bassNotes: se2FusionPianoRollToGenNotes(roll.lanes.bass, beatsPerBar),
    fillerNotes: cached?.fillerNotes ?? [],
  };
}

export type Se2SynthGenoFusionGenerateMode = 'create' | 'chords';

function se2FusionImportGenNotes(
  notes: readonly StudioEditor2GenNote[],
  lane: Se2SynthGenoFusionLaneId,
  beatsPerBar: number,
): Se2FusionPianoNote[] {
  const total = se2FusionPianoTotalBeats(beatsPerBar);
  const meta = SE2_SYNTH_GENO_FUSION_LANE_META[lane];
  const out: Se2FusionPianoNote[] = [];
  for (const raw of notes) {
    if (raw.startBeat >= total - 1e-6) continue;
    const startBeat = Math.max(0, raw.startBeat);
    const maxDur = total - startBeat;
    const durationBeats = Math.max(1 / 32, Math.min(maxDur, raw.durationBeats));
    const pitch = Math.max(meta.pitchLo, Math.min(meta.pitchHi, Math.round(raw.pitch)));
    const imported: Se2FusionPianoNote = {
      id: se2FusionPianoNewNoteId(),
      pitch,
      startBeat,
      durationBeats,
      velocity: raw.velocity,
    };
    if (raw.flexCurve?.length) {
      imported.flexCurve = raw.flexCurve.map(
        (p): Se2FusionFlexPoint => ({
          id: se2FusionFlexNewPointId(),
          beatOffset: Math.max(0, Math.min(durationBeats, p.beatOffset)),
          pitch: Math.max(meta.pitchLo, Math.min(meta.pitchHi, Math.round(p.pitch))),
        }),
      );
    }
    out.push(se2FusionPianoClampNote(imported, lane, beatsPerBar));
  }
  return out;
}

function se2FusionDraftToRollLanes(
  roll: Se2SynthGenoFusionRollState,
  draft: Se2SynthGenoPluginDraft,
  beatsPerBar: number,
  mode: Se2SynthGenoFusionGenerateMode,
): Se2SynthGenoFusionRollState {
  let next = se2SynthGenoFusionSetLaneNotes(
    roll,
    'chords',
    se2FusionImportGenNotes(draft.chordNotes, 'chords', beatsPerBar),
  );
  if (mode === 'create') {
    next = se2SynthGenoFusionSetLaneNotes(
      next,
      'melody',
      se2FusionImportGenNotes(draft.melodyNotes, 'melody', beatsPerBar),
    );
    next = se2SynthGenoFusionSetLaneNotes(
      next,
      'bass',
      se2FusionImportGenNotes(draft.bassNotes, 'bass', beatsPerBar),
    );
    return next;
  }
  if (draft.melodyNotes.length > 0) {
    next = se2SynthGenoFusionSetLaneNotes(
      next,
      'melody',
      se2FusionImportGenNotes(draft.melodyNotes, 'melody', beatsPerBar),
    );
  }
  if (draft.bassNotes.length > 0) {
    next = se2SynthGenoFusionSetLaneNotes(
      next,
      'bass',
      se2FusionImportGenNotes(draft.bassNotes, 'bass', beatsPerBar),
    );
  }
  return next;
}

/** Generate 8-bar MIDI into Fusion lanes (not the Synth Geno track). */
export function se2SynthGenoFusionGenerateRoll(opts: {
  roll: Se2SynthGenoFusionRollState;
  fusion: Se2SynthGenoFusionParams;
  mergedPrompt: string;
  resolvedKey: Se2ComposeResolvedKey;
  beatsPerBar: number;
  bpm: number;
  seed: number;
  mode: Se2SynthGenoFusionGenerateMode;
}): { roll: Se2SynthGenoFusionRollState; summary: string; tags: string[] } {
  const profile = buildGenoComposePromptProfile(opts.mergedPrompt);
  const fusionPatch = se2SynthGenoFusionMapToChordState(opts.fusion);
  const styled = se2SynthGenoApplyStylePreset(
    { ...SE2_SYNTH_GENO_CHORD_DEFAULTS, ...fusionPatch.state },
    profile.chordStyle,
    opts.resolvedKey.keyMode,
  );
  const state = {
    ...styled,
    barCount: 8 as const,
    accordBankId: opts.roll.sounds.accordBankId,
    melodyBankId: opts.roll.sounds.melodyBankId,
    bassBankId: opts.roll.sounds.bassBankId,
  };
  const priorDraft =
    opts.mode === 'create' ? null : se2SynthGenoFusionRollToPreviewDraft(opts.roll, opts.beatsPerBar);
  const draft =
    opts.mode === 'create'
      ? se2SynthGenoGeneratePluginDraft({
          state,
          keyRoot: opts.resolvedKey.keyRoot,
          keyMode: opts.resolvedKey.keyMode,
          beatsPerBar: opts.beatsPerBar,
          bpm: opts.bpm,
          seed: opts.seed,
          draft: null,
        })
      : se2SynthGenoRegeneratePluginPart({
          draft: priorDraft,
          state,
          part: 'chords',
          seeds: se2SynthGenoDefaultPartSeeds(opts.seed),
          keyRoot: opts.resolvedKey.keyRoot,
          keyMode: opts.resolvedKey.keyMode,
          beatsPerBar: opts.beatsPerBar,
          bpm: opts.bpm,
          stableVoicing: true,
          freshDraft: false,
        });
  const nextRoll = {
    ...se2FusionDraftToRollLanes(opts.roll, draft, opts.beatsPerBar, opts.mode),
    lastPluginDraft: draft,
  };
  const summary = `Fusion roll · ${draft.bars} bars · ${draft.chordNotes.length} chord · ${draft.melodyNotes.length} melody · ${draft.bassNotes.length} bass @ ${opts.bpm} BPM · ${opts.resolvedKey.label}`;
  const tags = [...profile.tags, draft.progressionId, opts.resolvedKey.label];
  return { roll: nextRoll, summary, tags };
}

export function se2FusionPianoRollKeyLabel(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${names[pc] ?? 'C'}${oct}`;
}

export function se2FusionPianoIsBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(midi % 12);
}
