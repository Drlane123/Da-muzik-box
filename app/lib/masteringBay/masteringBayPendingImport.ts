import type { MasteringBaySourcePayload } from '@/app/lib/masteringBay/masteringBaySourceTrack';

/** In-memory handoff — SE2 stereo bounce → Mastering Bay (same session). */
let pending: MasteringBaySourcePayload | null = null;

export function setPendingMasteringBayImport(payload: MasteringBaySourcePayload): void {
  pending = payload;
}

export function consumePendingMasteringBayImport(): MasteringBaySourcePayload | null {
  const next = pending;
  pending = null;
  return next;
}

export function peekPendingMasteringBayImport(): MasteringBaySourcePayload | null {
  return pending;
}
