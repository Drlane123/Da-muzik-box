/**
 * Studio Editor 2 — 808 Lab per-lane voice settings (standalone mirror of Creation Station 808 engine).
 */
import {
  BASS_LOW_BASS_ORDER,
  BASS_LOW_BASS_PRESETS,
  LAB808_FILTER_DEFAULT,
  LAB_MASTER_808_BASS,
  LAB_MASTER_808_KICK,
  TRAP_HOLD_808_ORDER,
  TRAP_HOLD_808_PRESETS,
  type BassLowBassPresetId,
  type Lab808FilterFx,
  type Lab808SoundLane,
  type TrapHold808PresetId,
} from '@/app/lib/creationStation/eightZeroEightVoice';
import { lab808DefaultTonePadBaseMidi } from '@/app/lib/creationStation/lab808TonePads';
import type { Se2Lab808ChordLock } from '@/app/lib/studio/se2Lab808ChordLock';
import { se2Lab808DefaultChordLock, se2Lab808ChordLockFromTrackFields } from '@/app/lib/studio/se2Lab808ChordLock';
import {
  emptySe2Lab808ToneGridPattern,
  normalizeSe2Lab808ToneGridPattern,
  se2Lab808NormalizeToneGridLoopBars,
  type Se2Lab808ToneGridLoopBars,
  type Se2Lab808ToneGridPattern,
} from '@/app/lib/studio/se2Lab808DrumPattern';
import {
  emptySe2Lab808PercBar,
  normalizeSe2Lab808PercBar,
} from '@/app/lib/studio/se2Lab808PercPattern';
import { se2Lab808NormalizeToneGridZoom } from '@/app/lib/studio/se2Lab808ToneGridLayout';

export type { Se2Lab808ChordLock, Se2Lab808ChordLockSourceKind } from '@/app/lib/studio/se2Lab808ChordLock';

export type Se2Lab808VoiceParams = {
  soundLane: Lab808SoundLane;
  kickPresetId: TrapHold808PresetId;
  bassPresetId: BassLowBassPresetId;
  filterFx: Lab808FilterFx;
  output: number;
  tonePadBaseMidi: number;
  chordLock: Se2Lab808ChordLock;
  /** 16 lanes × (loopBars × 16) steps — one row per tone pad pitch. */
  toneGridSteps: Se2Lab808ToneGridPattern;
  /** Pattern loop length in bars (4, 8, or 16). */
  toneGridLoopBars: Se2Lab808ToneGridLoopBars;
  /** Grid hit level (multiplied with output). */
  toneGridLevel: number;
  /** Tone step grid UI zoom (column / row scale). */
  toneGridZoom: number;
  /** Seed for regenerate root grid variations. */
  rootGenSeed?: number;
  /** 1-bar snare steps (16ths) — repeats every bar for any tone-grid length. */
  percSnareSteps: boolean[];
  /** 1-bar clap steps (16ths) — repeats every bar. */
  percClapSteps: boolean[];
  /** Snare/clap level (× output). */
  percLevel: number;
};

export function se2Lab808DefaultVoice(): Se2Lab808VoiceParams {
  return {
    soundLane: 'kick',
    kickPresetId: 'zayKnock',
    bassPresetId: 'trapLowBass',
    filterFx: { ...LAB808_FILTER_DEFAULT },
    output: 0.88,
    tonePadBaseMidi: lab808DefaultTonePadBaseMidi(),
    chordLock: se2Lab808DefaultChordLock(),
    toneGridSteps: emptySe2Lab808ToneGridPattern(),
    toneGridLoopBars: 8,
    toneGridLevel: 0.9,
    toneGridZoom: 1,
    rootGenSeed: 1,
    percSnareSteps: emptySe2Lab808PercBar(),
    percClapSteps: emptySe2Lab808PercBar(),
    percLevel: 0.88,
  };
}

export function se2Lab808PresetDef(voice: Se2Lab808VoiceParams) {
  return voice.soundLane === 'bass'
    ? BASS_LOW_BASS_PRESETS[voice.bassPresetId] ?? LAB_MASTER_808_BASS
    : TRAP_HOLD_808_PRESETS[voice.kickPresetId] ?? LAB_MASTER_808_KICK;
}

export function se2Lab808PatchLabel(voice: Se2Lab808VoiceParams): string {
  const preset = se2Lab808PresetDef(voice);
  const lane = voice.soundLane === 'bass' ? 'Bass' : 'Kick';
  return `${lane} · ${preset.label}`;
}

export function se2NormalizeLab808KickPresetId(raw: string | undefined): TrapHold808PresetId {
  const id = (raw ?? '').trim() as TrapHold808PresetId;
  return TRAP_HOLD_808_ORDER.includes(id) ? id : 'zayKnock';
}

export function se2NormalizeLab808BassPresetId(raw: string | undefined): BassLowBassPresetId {
  const id = (raw ?? '').trim() as BassLowBassPresetId;
  return BASS_LOW_BASS_ORDER.includes(id) ? id : 'trapLowBass';
}

export function se2Lab808VoiceFromTrackFields(tr: {
  lab808SoundLane?: Lab808SoundLane;
  lab808KickPresetId?: string;
  lab808BassPresetId?: string;
  lab808TonePadBaseMidi?: number;
  lab808ToneGridLoopBars?: number;
  lab808ToneGridSteps?: readonly (readonly boolean[])[];
  lab808ChordLockEnabled?: boolean;
  lab808ChordLockSourceKind?: string;
  lab808ChordLockHarmonyTrackId?: string;
  lab808ChordLockKeyRoot?: number;
  lab808ChordLockKeyMode?: string;
  lab808RootGenSeed?: number;
  lab808ToneGridZoom?: number;
  lab808PercSnareSteps?: readonly boolean[];
  lab808PercClapSteps?: readonly boolean[];
  lab808PercLevel?: number;
  /** @deprecated Old MPC grid — migrated to tone grid shape. */
  lab808DrumSteps?: readonly (readonly boolean[])[];
}): Se2Lab808VoiceParams {
  const base = se2Lab808DefaultVoice();
  const gridRaw = tr.lab808ToneGridSteps ?? tr.lab808DrumSteps;
  const loopBars = se2Lab808NormalizeToneGridLoopBars(tr.lab808ToneGridLoopBars);
  return {
    ...base,
    soundLane: tr.lab808SoundLane === 'bass' ? 'bass' : 'kick',
    kickPresetId: se2NormalizeLab808KickPresetId(tr.lab808KickPresetId),
    bassPresetId: se2NormalizeLab808BassPresetId(tr.lab808BassPresetId),
    tonePadBaseMidi:
      typeof tr.lab808TonePadBaseMidi === 'number' && Number.isFinite(tr.lab808TonePadBaseMidi)
        ? Math.max(0, Math.min(111, Math.round(tr.lab808TonePadBaseMidi)))
        : base.tonePadBaseMidi,
    toneGridLoopBars: loopBars,
    toneGridSteps: normalizeSe2Lab808ToneGridPattern(gridRaw, loopBars),
    chordLock: se2Lab808ChordLockFromTrackFields(tr),
    rootGenSeed:
      typeof tr.lab808RootGenSeed === 'number' && Number.isFinite(tr.lab808RootGenSeed)
        ? Math.max(1, Math.round(tr.lab808RootGenSeed))
        : base.rootGenSeed,
    toneGridZoom: se2Lab808NormalizeToneGridZoom(tr.lab808ToneGridZoom ?? base.toneGridZoom),
    percSnareSteps: normalizeSe2Lab808PercBar(tr.lab808PercSnareSteps),
    percClapSteps: normalizeSe2Lab808PercBar(tr.lab808PercClapSteps),
    percLevel:
      typeof tr.lab808PercLevel === 'number' && Number.isFinite(tr.lab808PercLevel)
        ? Math.max(0.2, Math.min(1, tr.lab808PercLevel))
        : base.percLevel,
  };
}
