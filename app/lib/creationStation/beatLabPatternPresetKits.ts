/**
 * When a Pattern Bank preset loads, pick a matching producer kit (crew kit) so
 * kick/snare/hat/808 mapping sounds like the genre — see `beatLabProducerKits.ts`.
 * Pool index is stable from `preset.id` so the same pattern always pairs with the same kit variant.
 */

import type { PatternPreset } from '@/app/lib/patternPresets';
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';
import { BEAT_LAB_FLAGSHIP_KIT_ORDER } from '@/app/lib/creationStation/beatLabProducerKits';
import { BEAT_LAB_FLAGSHIP_PATTERN_KIT_MAP } from '@/app/lib/creationStation/beatLabFlagshipPatternPresets';
import { BEAT_LAB_SIGNATURE_TRAP_KIT_MAP } from '@/app/lib/creationStation/beatLabSignatureTrapPatterns';
import { BEAT_LAB_STREET_TRAP_KIT_MAP } from '@/app/lib/creationStation/beatLabStreetTrapPatterns';
import { BEAT_LAB_MODERN_RNB_KIT_MAP } from '@/app/lib/creationStation/beatLabModernRnbPatterns';
import { BEAT_LAB_MIAMI_PATTERN_KIT_MAP } from '@/app/lib/creationStation/beatLabAfroReggaeMiamiPatterns';
import { BEAT_LAB_DISCO_HOUSE_DRIVE_IDS } from '@/app/lib/creationStation/beatLabDiscoExpandedPatterns';

/** Core trap presets — explicit 808-kick kits (base drums; user adds sub in sound family). */
const BEAT_LAB_CORE_TRAP_PATTERN_KIT_MAP: Readonly<
  Partial<Record<string, BeatLabProducerKitId>>
> = {
  'trap-17': 'trapTrunk808',
};

/** Pure disco presets — LM-2 kick/snare + crisp hats (Donna Summer / SNF era). */
const BEAT_LAB_DISCO_PATTERN_KIT_MAP: Readonly<
  Partial<Record<string, BeatLabProducerKitId>>
> = Object.fromEntries(
  BEAT_LAB_DISCO_HOUSE_DRIVE_IDS.map((id) => [id, 'houseDrive' as BeatLabProducerKitId]),
);

const DEFAULT_POOL: BeatLabProducerKitId[] = ['trapDarkVault', 'clubPocket'];

/** Preset has an explicit crew-kit pairing (signature or flagship). */
export function beatLabPatternHasPairedKit(presetId: string): boolean {
  return !!(
    BEAT_LAB_MIAMI_PATTERN_KIT_MAP[presetId] ??
    BEAT_LAB_MODERN_RNB_KIT_MAP[presetId] ??
    BEAT_LAB_STREET_TRAP_KIT_MAP[presetId] ??
    BEAT_LAB_SIGNATURE_TRAP_KIT_MAP[presetId] ??
    BEAT_LAB_FLAGSHIP_PATTERN_KIT_MAP[presetId]
  );
}

/** Genre → rotating kit IDs. Flagship kits first (banks A–H lineup). */
const PRESET_GENRE_KIT_POOLS: Partial<Record<string, BeatLabProducerKitId[]>> = {
  Trap: [
    'trapStreetCyborgWoofer',
    'trapStreetBedrockSlab',
    'trapStreetZayTunnel',
    'trapStreetPinkVault',
    'trapStreetReddBlock',
    'trapStreetTm88Night',
    'trapStreetTrunkSk',
    'trapStreetJcStack',
    'trapStreetGuudSine',
    'trapStreetNegativeFloor',
    'trapDarkVault',
    'trapSlabAtl',
    'trapTrunk808',
    'vault808',
    'trunkRattle',
    'slab808',
    'brassTrap',
    'long808Hits',
    'trapClapStack',
    'trapAnalogRoom',
  ],
  'R&B': [
    'rnbModern808NightGrind',
    'rnbModern808NightGrindV2',
    'rnbModern808AfterDark',
    'rnbModern808VelvetSub',
    'rnbModern808HeavyPulse',
    'rnbClassicSilkRoom',
    'rnbClassicVelvetPocket',
    'rnbHybrid808Bloom',
    'rnbHybridSlowBurn',
    'smoothRnb',
    'rnbVelvetBloom',
    'rnbNeoStack',
  ],
  House: ['houseDrive', 'clubPocket', 'bell808', 'mudFloor'],
  Dance: ['houseDrive', 'clubPocket', 'bell808', 'mudFloor', 'nightSub'],
  Disco: ['bell808', 'clubPocket', 'houseDrive', 'mudFloor'],
  Techno: ['ironSlide', 'mudFloor', 'bell808', 'vault808'],
  Afro: ['clubPocket', 'smoothRnb', 'mudFloor', 'bell808', 'houseDrive'],
  Reggae: ['smoothRnb', 'clubPocket', 'mudFloor', 'rnbVelvetBloom'],
  'Up Tempo': ['miamiBass808', 'trunkRattle', 'vault808', 'trapTrunk808', 'nightSub', 'long808Hits', 'slab808'],
};

function fnv1aPresetHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function beatLabProducerKitIdForPatternPreset(preset: PatternPreset): BeatLabProducerKitId {
  const explicit =
    BEAT_LAB_CORE_TRAP_PATTERN_KIT_MAP[preset.id] ??
    BEAT_LAB_DISCO_PATTERN_KIT_MAP[preset.id] ??
    BEAT_LAB_MIAMI_PATTERN_KIT_MAP[preset.id] ??
    BEAT_LAB_MODERN_RNB_KIT_MAP[preset.id] ??
    BEAT_LAB_STREET_TRAP_KIT_MAP[preset.id] ??
    BEAT_LAB_SIGNATURE_TRAP_KIT_MAP[preset.id] ??
    BEAT_LAB_FLAGSHIP_PATTERN_KIT_MAP[preset.id];
  if (explicit) return explicit;
  const pool = PRESET_GENRE_KIT_POOLS[preset.genre] ?? DEFAULT_POOL;
  if (!pool.length) return BEAT_LAB_FLAGSHIP_KIT_ORDER[0] ?? 'trapDarkVault';
  const idx = fnv1aPresetHash(preset.id) % pool.length;
  return pool[idx]!;
}

/** Default kit when switching to a pattern bank genre tab (no preset picked yet). */
export function beatLabDefaultKitForPatternBank(bankId: string): BeatLabProducerKitId {
  switch (bankId) {
    case 'trap':
      return 'trapStreetCyborgWoofer';
    case 'rnb':
      return 'smoothRnb';
    case 'house':
    case 'dance':
      return 'houseDrive';
    case 'disco':
      return 'houseDrive';
    case 'techno':
      return 'ironSlide';
    case 'afro':
      return 'clubPocket';
    case 'reggae':
      return 'smoothRnb';
    case 'miami':
      return 'miamiBass808';
    default:
      return BEAT_LAB_FLAGSHIP_KIT_ORDER[0] ?? 'trapDarkVault';
  }
}
