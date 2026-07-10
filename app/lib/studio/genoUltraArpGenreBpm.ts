/**
 * Genre-typical ARP tempos — averages used when loading melody / style presets.
 * Local per-track BPM still wins after the user edits the knob.
 */
import type { GenoUltraArpMelodyTag } from '@/app/lib/studio/genoUltraArpMelodyPresets';
import type { GenoArpStyleCategory } from '@/app/lib/studio/genoUltraArpStylePresets';
import { clampGenoUltraArpBpm } from '@/app/lib/studio/genoUltraArpState';

/** Melody category → typical song tempo (industry center). */
export const GENO_ULTRA_ARP_TAG_BPM: Record<GenoUltraArpMelodyTag, number> = {
  /** Funk / disco / 70s pocket */
  '70s': 112,
  /** Dark / night / cinematic */
  night: 90,
  /** Modern trap (half-time feel at 70, session often 140) */
  trap: 140,
  /** Classic hip hop / boom-bap center (drill overrides per preset) */
  hiphop: 90,
  /** House / deep house */
  house: 124,
  /** Festival / EDM / euro dance */
  dance: 128,
  /** Berlin / warehouse techno */
  techno: 130,
  /** 80s electro / freestyle */
  electro: 125,
  /** Horror / slasher underscore */
  horror: 80,
  /** R&B / neo-soul / ballad keys */
  keys: 84,
  /** Electro bass anthems (Electric Kingdom pocket) */
  bass: 127,
  /** Siberian Nights / punchy 80s electro */
  siberian: 130,
  /** Techno/dance syncopated step climbs */
  'step-climb': 128,
};

/** Style-browser category → typical tempo. */
export const GENO_ARP_STYLE_CATEGORY_BPM: Record<GenoArpStyleCategory, number> = {
  trap: 140,
  hiphop: 90,
  techno: 130,
  electro: 125,
  horror: 80,
  house: 124,
  dance: 128,
  logic: 120,
};

export function genoUltraArpBpmForMelodyTag(tag: GenoUltraArpMelodyTag): number {
  return clampGenoUltraArpBpm(GENO_ULTRA_ARP_TAG_BPM[tag]);
}

export function genoUltraArpBpmForStyleCategory(category: GenoArpStyleCategory): number {
  return clampGenoUltraArpBpm(GENO_ARP_STYLE_CATEGORY_BPM[category]);
}

/** Style preset — known song pockets first, else category average. */
export function genoUltraArpBpmForStylePreset(preset: {
  id: string;
  category: GenoArpStyleCategory;
  bpm?: number;
}): number {
  if (preset.bpm != null) return clampGenoUltraArpBpm(preset.bpm);
  const id = preset.id;
  if (id === 'hiphop-drill') return 140;
  if (id === 'hiphop-boom-bap') return 90;
  if (id === 'hiphop-gfunk') return 98;
  if (id === 'house-disco') return 118;
  if (id === 'house-deep') return 122;
  if (id.startsWith('electro-clear-')) return 125;
  if (id.startsWith('electro-kingdom-')) return 127;
  if (id.startsWith('electro-siberian-')) return 130;
  if (id.startsWith('dance-trance') || id === 'dance-anthem-run') return 138;
  if (id.startsWith('horror-')) return 80;
  return genoUltraArpBpmForStyleCategory(preset.category);
}
