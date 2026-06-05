/**
 * Beat Lab — flagship kits pre-loaded on pattern banks A–H (Trap / R&B / Dance).
 */

import { loadPadSampleStore, padSampleKey } from '@/app/lib/padSampleStorage';
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';

export const BEAT_LAB_FLAGSHIP_BANKS_SEED_KEY = 'beatLab_flagshipBanksSeeded_v2';

/** Banks A–H → main kit (16 pads each). Order is the Pattern Bank default lineup. */
export const BEAT_LAB_DEFAULT_BANK_KIT_IDS: readonly BeatLabProducerKitId[] = [
  'trapDarkVault',
  'trapSlabAtl',
  'trapTrunk808',
  'smoothRnb',
  'rnbVelvetBloom',
  'rnbNeoStack',
  'houseDrive',
  'clubPocket',
] as const;

export function beatLabDefaultKitForBank(bankIndex: number): BeatLabProducerKitId | undefined {
  return BEAT_LAB_DEFAULT_BANK_KIT_IDS[bankIndex];
}

export function isBeatLabBankEmpty(bankIndex: number): boolean {
  const store = loadPadSampleStore();
  for (let pad = 0; pad < 16; pad += 1) {
    if (store[padSampleKey(bankIndex, pad)]) return false;
  }
  return true;
}

/** Seed empty flagship banks once per app version (local bundled + crew kits). */
export async function seedBeatLabFlagshipBanksIfNeeded(
  loadKitToBank: (kitId: BeatLabProducerKitId, bankIndex: number) => Promise<void>,
): Promise<{ seeded: number; skipped: boolean }> {
  if (typeof localStorage === 'undefined') return { seeded: 0, skipped: true };
  if (localStorage.getItem(BEAT_LAB_FLAGSHIP_BANKS_SEED_KEY) === 'done') {
    return { seeded: 0, skipped: true };
  }

  let seeded = 0;
  for (let bank = 0; bank < BEAT_LAB_DEFAULT_BANK_KIT_IDS.length; bank += 1) {
    const kitId = BEAT_LAB_DEFAULT_BANK_KIT_IDS[bank];
    if (!kitId || !isBeatLabBankEmpty(bank)) continue;
    await loadKitToBank(kitId, bank);
    seeded += 1;
  }

  localStorage.setItem(BEAT_LAB_FLAGSHIP_BANKS_SEED_KEY, 'done');
  return { seeded, skipped: false };
}
