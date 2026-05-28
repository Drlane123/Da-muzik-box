/**
 * When a Pattern Bank preset loads, pick a matching producer kit (crew kit) so
 * kick/snare/hat/808 mapping sounds like the genre — see `beatLabProducerKits.ts`.
 * Pool index is stable from `preset.id` so the same pattern always pairs with the same kit variant.
 */

import type { PatternPreset } from '@/app/lib/patternPresets';
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';

const DEFAULT_POOL: BeatLabProducerKitId[] = ['brassTrap', 'clubPocket'];

/** Genre → rotating kit IDs. Trap = 808-heavy; R&B = pocket / no vault-trap rotation. */
const PRESET_GENRE_KIT_POOLS: Partial<Record<string, BeatLabProducerKitId[]>> = {
  Trap: [
    'brassTrap',
    'long808Hits',
    'trapClapStack',
    'trapAnalogRoom',
    'vault808',
    'trunkRattle',
    'slab808',
    'nightSub',
  ],
  'R&B': ['smoothRnb', 'rnbVelvetBloom', 'rnbNeoStack', 'clubPocket'],
  House: ['houseDrive', 'clubPocket', 'mudFloor', 'bell808'],
  Dance: ['houseDrive', 'clubPocket', 'bell808', 'mudFloor', 'vault808'],
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
  const pool = PRESET_GENRE_KIT_POOLS[preset.genre] ?? DEFAULT_POOL;
  if (!pool.length) return 'brassTrap';
  const idx = fnv1aPresetHash(preset.id) % pool.length;
  return pool[idx]!;
}
