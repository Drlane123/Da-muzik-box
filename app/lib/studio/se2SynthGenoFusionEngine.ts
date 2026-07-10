/**
 * Fusion — SpaceWalk-style ambient harmony macros × Note Flex sketch controls.
 * Maps macro sliders to Synth Geno chord / compose engines (local rule-based, no cloud).
 */
import type { Se2SynthGenoChordPluginState } from '@/app/lib/studio/se2SynthGenoChordPlugin';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import type { GenoVoicingDepth } from '@/app/lib/studio/se2SynthGenoVoicingDepth';

/** Product label — Fusion harmonic workspace + Note Flex sketch roll. */
export const SE2_SYNTH_GENO_FUSION_NOTE_FLEX_LABEL = 'Fusion / Note Flex';

/** Product label — one-key pad + loop preview (was Live Chord). */
export const SE2_SYNTH_GENO_BUILD_1_LABEL = 'Geno Build 1';

/** Umbrella tab — contains Geno Build 1 + Geno Build 2 panels. */
export const SE2_SYNTH_GENO_BUILD_TAB_LABEL = 'Geno Build';

/** Product label — progression loop editor + apply (was Chord Generator). */
export const SE2_SYNTH_GENO_BUILD_2_LABEL = 'Geno Build 2';

export type Se2SynthGenoFusionCharacterId =
  | 'gentle'
  | 'luminous'
  | 'drift'
  | 'cinematic'
  | 'shimmer'
  | 'void'
  | 'custom';

export type Se2SynthGenoFusionParams = {
  richness: number;
  flow: number;
  smoothness: number;
  suspension: number;
  sparseness: number;
  deviation: number;
  keyLock: boolean;
  pitchGlide: boolean;
  chordStamp: boolean;
  characterId: Se2SynthGenoFusionCharacterId;
};

export const SE2_SYNTH_GENO_FUSION_DEFAULTS: Se2SynthGenoFusionParams = {
  richness: 58,
  flow: 42,
  smoothness: 28,
  suspension: 35,
  sparseness: 48,
  deviation: 22,
  keyLock: true,
  pitchGlide: true,
  chordStamp: false,
  characterId: 'luminous',
};

export type Se2SynthGenoFusionCharacterPreset = {
  id: Exclude<Se2SynthGenoFusionCharacterId, 'custom'>;
  label: string;
  hint: string;
  params: Omit<Se2SynthGenoFusionParams, 'characterId' | 'keyLock' | 'pitchGlide' | 'chordStamp'>;
  stylePreset: GenoChordStyle;
};

export const SE2_SYNTH_GENO_FUSION_CHARACTERS: readonly Se2SynthGenoFusionCharacterPreset[] = [
  {
    id: 'gentle',
    label: 'Gentle',
    hint: 'Soft pads · slow harmonic drift',
    stylePreset: 'default',
    params: { richness: 52, flow: 28, smoothness: 42, suspension: 48, sparseness: 62, deviation: 14 },
  },
  {
    id: 'luminous',
    label: 'Luminous',
    hint: 'Open voicings · luminous extensions',
    stylePreset: 'bright',
    params: { richness: 68, flow: 38, smoothness: 32, suspension: 40, sparseness: 44, deviation: 18 },
  },
  {
    id: 'drift',
    label: 'Drift',
    hint: 'Wide leaps · evolving modal color',
    stylePreset: 'minor',
    params: { richness: 55, flow: 72, smoothness: 18, suspension: 28, sparseness: 50, deviation: 32 },
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    hint: 'Dense beds · dramatic movement',
    stylePreset: 'dark',
    params: { richness: 78, flow: 55, smoothness: 24, suspension: 52, sparseness: 36, deviation: 26 },
  },
  {
    id: 'shimmer',
    label: 'Shimmer',
    hint: 'Sus chords · airy top line',
    stylePreset: 'pop',
    params: { richness: 62, flow: 34, smoothness: 38, suspension: 72, sparseness: 58, deviation: 20 },
  },
  {
    id: 'void',
    label: 'Void',
    hint: 'Sparse drones · minimal motion',
    stylePreset: 'trap',
    params: { richness: 38, flow: 18, smoothness: 48, suspension: 22, sparseness: 82, deviation: 10 },
  },
] as const;

const fusionSessions = new Map<number, Se2SynthGenoFusionParams>();

export function readSe2SynthGenoFusionSession(trackIndex: number): Se2SynthGenoFusionParams {
  return fusionSessions.get(trackIndex) ?? { ...SE2_SYNTH_GENO_FUSION_DEFAULTS };
}

export function writeSe2SynthGenoFusionSession(
  trackIndex: number,
  params: Se2SynthGenoFusionParams,
): void {
  fusionSessions.set(trackIndex, params);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function voicingDepthFromRichness(richness: number): GenoVoicingDepth {
  if (richness >= 78) return 7;
  if (richness >= 62) return 6;
  if (richness >= 44) return 5;
  return 4;
}

function perfModeFromFusion(fusion: Se2SynthGenoFusionParams): Se2SynthGenoChordPluginState['perfMode'] {
  if (fusion.deviation >= 58) return 'slop';
  if (fusion.smoothness >= 35) return 'block';
  if (fusion.flow >= 62) return 'strum';
  return 'block';
}

function extensionsFromFusion(fusion: Se2SynthGenoFusionParams): Se2SynthGenoChordPluginState['extensions'] {
  const ext: Se2SynthGenoChordPluginState['extensions'] = [];
  if (fusion.richness >= 50) ext.push('M7');
  if (fusion.richness >= 68) ext.push('9');
  if (fusion.suspension >= 55) ext.push('11');
  if (fusion.richness >= 82) ext.push('13');
  return ext.length ? ext : ['M7'];
}

function chordTypeFromFusion(fusion: Se2SynthGenoFusionParams): Se2SynthGenoChordPluginState['lockedType'] {
  if (fusion.suspension >= 70) return 'sus';
  return 'maj';
}

export type Se2SynthGenoFusionChordPatch = {
  state: Partial<Se2SynthGenoChordPluginState>;
  voicingDepth: GenoVoicingDepth;
};

/** SpaceWalk macros → chord plugin state patch (Generator / Live Chord). */
export function se2SynthGenoFusionMapToChordState(
  fusion: Se2SynthGenoFusionParams,
): Se2SynthGenoFusionChordPatch {
  const character =
    fusion.characterId !== 'custom'
      ? SE2_SYNTH_GENO_FUSION_CHARACTERS.find((c) => c.id === fusion.characterId)
      : undefined;
  const stylePreset = character?.stylePreset ?? 'default';
  const depth = voicingDepthFromRichness(fusion.richness);
  const sparse = fusion.sparseness >= 58;
  return {
    voicingDepth: depth,
    state: {
      stylePreset,
      lockedType: chordTypeFromFusion(fusion),
      extensions: extensionsFromFusion(fusion),
      perfMode: perfModeFromFusion(fusion),
      staccato: fusion.smoothness < -10,
      bassGlide: fusion.pitchGlide,
      enableMelody: !sparse || fusion.richness >= 45,
      enableBass: fusion.sparseness < 72,
      enableChords: true,
      smartMatch: true,
      barCount: 8,
      progressionLoop: undefined,
      barChordSpecs: undefined,
    },
  };
}

/** Blend sound + compose prompts with Fusion character tags for the 8-bar compose path. */
export function se2SynthGenoFusionMergedComposePrompt(
  soundPrompt: string,
  composePrompt: string,
  fusion: Se2SynthGenoFusionParams,
): string {
  const parts: string[] = [];
  const compose = composePrompt.trim();
  const sound = soundPrompt.trim();
  if (compose) parts.push(compose);
  else parts.push('ambient chord progression 8 bars');
  if (sound && !compose.toLowerCase().includes(sound.toLowerCase().slice(0, 12))) {
    parts.push(sound);
  }
  if (fusion.characterId !== 'custom') {
    parts.push(`${fusion.characterId} ambient cinematic`);
  }
  if (fusion.sparseness >= 60) parts.push('sparse open voicing');
  if (fusion.richness >= 65) parts.push('rich extensions');
  if (fusion.suspension >= 55) parts.push('suspended chords');
  if (fusion.pitchGlide) parts.push('smooth pitch glide');
  if (fusion.keyLock) parts.push('key locked');
  return parts.join(', ');
}

export function se2SynthGenoFusionCharacterParams(
  id: Exclude<Se2SynthGenoFusionCharacterId, 'custom'>,
): Se2SynthGenoFusionParams {
  const preset = SE2_SYNTH_GENO_FUSION_CHARACTERS.find((c) => c.id === id);
  if (!preset) return { ...SE2_SYNTH_GENO_FUSION_DEFAULTS, characterId: id };
  return {
    ...SE2_SYNTH_GENO_FUSION_DEFAULTS,
    ...preset.params,
    characterId: id,
  };
}

export function se2SynthGenoFusionPatchParams(
  prev: Se2SynthGenoFusionParams,
  partial: Partial<Se2SynthGenoFusionParams>,
): Se2SynthGenoFusionParams {
  const next = { ...prev, ...partial };
  return {
    ...next,
    richness: clamp(next.richness, 0, 100),
    flow: clamp(next.flow, 0, 100),
    smoothness: clamp(next.smoothness, -50, 50),
    suspension: clamp(next.suspension, 0, 100),
    sparseness: clamp(next.sparseness, 0, 100),
    deviation: clamp(next.deviation, 0, 100),
    characterId: partial.characterId ?? (partial.richness !== undefined ? 'custom' : next.characterId),
  };
}
