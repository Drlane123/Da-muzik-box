/**
 * Studio Editor 2 — Groove Lead (WaveLeaf) per-lane voice settings.
 */
import {
  GROOVE_LAB_QUANTIZE_DEFAULT,
  type GrooveLabQuantize,
} from '@/app/lib/creationStation/grooveLabRoll';
import {
  waveLeafPreset,
  waveLeafPresetBankIndex,
  WAVE_LEAF_DEFAULT_PRESET,
  type WaveLeafPresetId,
} from '@/app/lib/creationStation/waveLeafPresets';
import { readWaveLeafLeadChopEnabledFromStorage } from '@/app/lib/creationStation/waveLeafLeadChop';
import {
  readWaveLeafPreviewQuantize,
  readWaveLeafSynthSettingsFromStorage,
} from '@/app/lib/creationStation/waveLeafSettings';

export type Se2GrooveLeadVoiceParams = {
  presetId: WaveLeafPresetId;
  categoryIdx: number;
  glideMs: number;
  brightness: number;
  warmth: number;
  drive: number;
  output: number;
  vibratoDepthCents: number;
  phraseQuantize: GrooveLabQuantize;
  leadChopOn: boolean;
};

export function se2GrooveLeadDefaultVoice(): Se2GrooveLeadVoiceParams {
  const stored = readWaveLeafSynthSettingsFromStorage();
  const presetId = stored.preset.id;
  return {
    presetId,
    categoryIdx: waveLeafPresetBankIndex(presetId),
    glideMs: stored.glideMs,
    brightness: stored.brightness,
    warmth: stored.warmth,
    drive: stored.drive,
    output: 0.82,
    vibratoDepthCents: stored.vibratoDepthCents,
    phraseQuantize: readWaveLeafPreviewQuantize(GROOVE_LAB_QUANTIZE_DEFAULT),
    leadChopOn: readWaveLeafLeadChopEnabledFromStorage(),
  };
}

export function se2GrooveLeadVoiceFromPresetId(presetId: WaveLeafPresetId): Se2GrooveLeadVoiceParams {
  const base = se2GrooveLeadDefaultVoice();
  const id = presetId || WAVE_LEAF_DEFAULT_PRESET;
  const preset = waveLeafPreset(id);
  return {
    ...base,
    presetId: id,
    categoryIdx: waveLeafPresetBankIndex(id),
    glideMs: preset.glideMs,
    drive: preset.drive,
  };
}

export function se2GrooveLeadPatchLabel(voice: Se2GrooveLeadVoiceParams): string {
  return waveLeafPreset(voice.presetId).label;
}

/** Geno Build 1 — velvet soul lead: polyphonic roll, soft glide between steps. */
export function se2GrooveLeadB01Voice(): Se2GrooveLeadVoiceParams {
  const base = se2GrooveLeadVoiceFromPresetId('velvet-lead');
  return {
    ...base,
    leadChopOn: false,
    glideMs: 132,
    vibratoDepthCents: 11,
    warmth: 1.1,
    brightness: 0.92,
    output: 0.84,
    drive: 0.05,
  };
}
