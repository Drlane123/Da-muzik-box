import { grooveLabSecPerSlot } from '@/app/lib/creationStation/grooveLabTransport';

/** Display slot from audio clock (mirrors {@link beatAtSessionTime} for Groove grid slots). */
export function slotAtSessionTime(
  t: number,
  sessionStartAudio: number,
  originSlot: number,
  bpm: number,
): number {
  const secPerSlot = grooveLabSecPerSlot(bpm);
  return originSlot + Math.max(0, t - sessionStartAudio) / secPerSlot;
}

export function loopSlotIndex(slot: number, loopSlots: number): number {
  const n = Math.max(1, loopSlots);
  const s = slot % n;
  return s < 0 ? s + n : s;
}

/** Fractional global column for WAAPI / ruler highlight. */
export function grooveLabSlotToColF(slot: number, snapStep: number): number {
  return Math.max(0, slot) / Math.max(1, snapStep);
}

export function grooveLabColFToPx(colF: number, pxPerCol: number): number {
  return colF * pxPerCol;
}
