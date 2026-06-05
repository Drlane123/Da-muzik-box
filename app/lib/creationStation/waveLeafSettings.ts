import {
  GROOVE_LAB_QUANTIZE_DEFAULT,
  isGrooveLabQuantize,
  type GrooveLabQuantize,
} from '@/app/lib/creationStation/grooveLabRoll';
import {
  WAVE_LEAF_DEFAULT_PRESET,
  waveLeafNormalizePresetId,
  waveLeafPreset,
  type WaveLeafPreset,
  type WaveLeafPresetId,
} from '@/app/lib/creationStation/waveLeafPresets';

const WAVE_LEAF_PRESET_KEY = 'wave-leaf-preset-id';
const WAVE_LEAF_GLIDE_KEY = 'wave-leaf-glide-ms';
const WAVE_LEAF_BRIGHT_KEY = 'wave-leaf-brightness';
const WAVE_LEAF_WARM_KEY = 'wave-leaf-warmth';
const WAVE_LEAF_DRIVE_KEY = 'wave-leaf-drive';
const WAVE_LEAF_VIBRATO_KEY = 'wave-leaf-vibrato-cents';
const WAVE_LEAF_PREVIEW_QUANTIZE_KEY = 'wave-leaf-preview-quantize';

function readStoredFloat(key: string, fallback: number, min: number, max: number): number {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = Number.parseFloat(window.localStorage.getItem(key) ?? '');
    if (Number.isFinite(v)) return Math.max(min, Math.min(max, v));
  } catch {
    /* */
  }
  return fallback;
}

export function readWaveLeafPreviewQuantize(fallback: GrooveLabQuantize = GROOVE_LAB_QUANTIZE_DEFAULT): GrooveLabQuantize {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(WAVE_LEAF_PREVIEW_QUANTIZE_KEY);
    if (v && isGrooveLabQuantize(v)) return v;
  } catch {
    /* */
  }
  return fallback;
}

export function readWaveLeafPresetId(): WaveLeafPresetId {
  if (typeof window === 'undefined') return WAVE_LEAF_DEFAULT_PRESET;
  try {
    return waveLeafNormalizePresetId(window.localStorage.getItem(WAVE_LEAF_PRESET_KEY));
  } catch {
    return WAVE_LEAF_DEFAULT_PRESET;
  }
}

export type WaveLeafSynthSettings = {
  preset: WaveLeafPreset;
  glideMs: number;
  brightness: number;
  warmth: number;
  drive: number;
  /** Pitch LFO depth in cents — 0 = off (presets no longer force vibrato on load). */
  vibratoDepthCents: number;
};

export function readWaveLeafSynthSettingsFromStorage(): WaveLeafSynthSettings {
  const presetId = readWaveLeafPresetId();
  const preset = waveLeafPreset(presetId);
  return {
    preset,
    glideMs: readStoredFloat(WAVE_LEAF_GLIDE_KEY, preset.glideMs, 0, 480),
    brightness: readStoredFloat(WAVE_LEAF_BRIGHT_KEY, 1, 0.35, 1.6),
    warmth: readStoredFloat(WAVE_LEAF_WARM_KEY, 1, 0.5, 1.4),
    drive: readStoredFloat(WAVE_LEAF_DRIVE_KEY, preset.drive, 0, 1),
    vibratoDepthCents: readStoredFloat(WAVE_LEAF_VIBRATO_KEY, 0, 0, 80),
  };
}

/** @deprecated Use {@link readWaveLeafSynthSettings} from waveLeafRuntimeSettings for playback. */
export function readWaveLeafSynthSettings(): WaveLeafSynthSettings {
  return readWaveLeafSynthSettingsFromStorage();
}

export const WAVE_LEAF_SETTINGS_KEYS = {
  preset: WAVE_LEAF_PRESET_KEY,
  glide: WAVE_LEAF_GLIDE_KEY,
  bright: WAVE_LEAF_BRIGHT_KEY,
  warm: WAVE_LEAF_WARM_KEY,
  drive: WAVE_LEAF_DRIVE_KEY,
  vibrato: WAVE_LEAF_VIBRATO_KEY,
  previewQuantize: WAVE_LEAF_PREVIEW_QUANTIZE_KEY,
} as const;
