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

const DEFAULT_POOL: BeatLabProducerKitId[] = ['trapDarkVault', 'clubPocket'];

/** Preset has an explicit crew-kit pairing (signature or flagship). */
export function beatLabPatternHasPairedKit(presetId: string): boolean {
  return !!(
    BEAT_LAB_SIGNATURE_TRAP_KIT_MAP[presetId] ??
    BEAT_LAB_FLAGSHIP_PATTERN_KIT_MAP[presetId]
  );
}

/** Genre → rotating kit IDs. Flagship kits first (banks A–H lineup). */
const PRESET_GENRE_KIT_POOLS: Partial<Record<string, BeatLabProducerKitId[]>> = {
  Trap: [
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
    'smoothRnb',
    'rnbVelvetBloom',
    'rnbNeoStack',
    'clubPocket',
  ],
  House: ['houseDrive', 'clubPocket', 'bell808', 'mudFloor'],
  Dance: ['houseDrive', 'clubPocket', 'bell808', 'mudFloor', 'nightSub'],
  Disco: ['bell808', 'clubPocket', 'houseDrive', 'mudFloor'],
  Techno: ['ironSlide', 'mudFloor', 'bell808', 'vault808'],
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
      return 'trapDarkVault';
    case 'rnb':
      return 'smoothRnb';
    case 'house':
    case 'dance':
      return 'houseDrive';
    case 'disco':
      return 'bell808';
    case 'techno':
      return 'ironSlide';
    default:
      return BEAT_LAB_FLAGSHIP_KIT_ORDER[0] ?? 'trapDarkVault';
  }
}
