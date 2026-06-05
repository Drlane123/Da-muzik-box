/**
 * Groove Lead — real guitar one-shots (guitar-licks manifest) as Wave Leaf presets.
 * Synth params below are fallback only if the sample has not loaded yet.
 */
type WaveLeafOscWave = 'sine' | 'triangle' | 'sawtooth';

export type WaveLeafLiveGuitarPresetId =
  | 'live-wah-pluck'
  | 'live-wah-drive'
  | 'live-wah-cry'
  | 'live-clean-pick'
  | 'live-harmonic'
  | 'live-arena'
  | 'live-palm'
  | 'live-soul-bend';

export type WaveLeafLiveGuitarPreset = {
  id: WaveLeafLiveGuitarPresetId;
  label: string;
  category: string;
  voiceTag: string;
  sampleLickId: string;
  sampleWah?: number;
  sampleWahRateHz?: number;
  sampleDrive?: number;
  samplePluck?: boolean;
  osc1: WaveLeafOscWave;
  osc2: WaveLeafOscWave;
  osc2Level: number;
  detuneCents: number;
  filterHz: number;
  filterQ: number;
  filterAttack: number;
  filterDecay: number;
  filterSustain: number;
  ampAttack: number;
  ampDecay: number;
  ampSustain: number;
  ampRelease: number;
  glideMs: number;
  vibratoHz: number;
  vibratoDepthCents: number;
  chorusMix: number;
  drive: number;
};

/** Short pluck-style synth fallback when CDN sample is not ready. */
const PLUCK_FALLBACK: Omit<
  WaveLeafLiveGuitarPreset,
  'id' | 'label' | 'category' | 'voiceTag' | 'sampleLickId' | 'sampleWah' | 'sampleWahRateHz' | 'sampleDrive' | 'samplePluck'
> = {
  osc1: 'triangle',
  osc2: 'sawtooth',
  osc2Level: 0.22,
  detuneCents: 4,
  filterHz: 5200,
  filterQ: 0.9,
  filterAttack: 0.003,
  filterDecay: 0.1,
  filterSustain: 0.15,
  ampAttack: 0.002,
  ampDecay: 0.11,
  ampSustain: 0.28,
  ampRelease: 0.14,
  glideMs: 18,
  vibratoHz: 0,
  vibratoDepthCents: 0,
  chorusMix: 0.1,
  drive: 0.08,
};

function liveGuitarPreset(
  id: WaveLeafLiveGuitarPresetId,
  label: string,
  sampleLickId: string,
  voiceTag: string,
  opts: {
    sampleWah?: number;
    sampleWahRateHz?: number;
    sampleDrive?: number;
    samplePluck?: boolean;
  },
): WaveLeafLiveGuitarPreset {
  return {
    id,
    label,
    category: 'Guitar / Wah',
    voiceTag,
    sampleLickId,
    sampleWah: opts.sampleWah ?? 0,
    sampleWahRateHz: opts.sampleWahRateHz,
    sampleDrive: opts.sampleDrive ?? 0,
    samplePluck: opts.samplePluck ?? true,
    ...PLUCK_FALLBACK,
  };
}

export const WAVE_LEAF_LIVE_GUITAR_PRESETS: Record<WaveLeafLiveGuitarPresetId, WaveLeafLiveGuitarPreset> = {
  'live-wah-pluck': liveGuitarPreset(
    'live-wah-pluck',
    'Wah Pluck Live',
    'lickSample_wahClean',
    'LIVE · wah pluck',
    { sampleWah: 0.78, sampleWahRateHz: 2.2, samplePluck: true },
  ),
  'live-wah-drive': liveGuitarPreset(
    'live-wah-drive',
    'Wah Drive Live',
    'lickSample_wahDrive',
    'LIVE · wah drive',
    { sampleWah: 0.62, sampleWahRateHz: 2.8, sampleDrive: 0.22, samplePluck: true },
  ),
  'live-wah-cry': liveGuitarPreset(
    'live-wah-cry',
    'Wah Cry Live',
    'lickSample_wahClean',
    'LIVE · wah cry',
    { sampleWah: 0.88, sampleWahRateHz: 3.4, samplePluck: false },
  ),
  'live-clean-pick': liveGuitarPreset(
    'live-clean-pick',
    'Clean Pick Live',
    'lickSample_cleanPick',
    'LIVE · clean pick',
    { samplePluck: true },
  ),
  'live-harmonic': liveGuitarPreset(
    'live-harmonic',
    'Harmonic Pluck',
    'lickSample_chimeHarmonic',
    'LIVE · harmonic',
    { samplePluck: true },
  ),
  'live-arena': liveGuitarPreset(
    'live-arena',
    'Arena Hook Live',
    'lickSample_arenaHook',
    'LIVE · arena hook',
    { sampleDrive: 0.18, samplePluck: false },
  ),
  'live-palm': liveGuitarPreset(
    'live-palm',
    'Palm Mute Live',
    'lickSample_palmMute',
    'LIVE · palm mute',
    { sampleDrive: 0.12, samplePluck: true },
  ),
  'live-soul-bend': liveGuitarPreset(
    'live-soul-bend',
    'Soul Bend Live',
    'lickSample_neoSoulBend',
    'LIVE · soul bend',
    { sampleWah: 0.35, sampleWahRateHz: 1.6, samplePluck: false },
  ),
};

export const WAVE_LEAF_LIVE_GUITAR_PRESET_ORDER: readonly WaveLeafLiveGuitarPresetId[] = [
  'live-wah-pluck',
  'live-wah-drive',
  'live-wah-cry',
  'live-clean-pick',
  'live-harmonic',
  'live-arena',
  'live-palm',
  'live-soul-bend',
];
