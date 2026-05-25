import type { MutableRefObject } from 'react';

/** Recreate shared graph when Beat Lab's context was closed (Creation transport pump). */
export function resolveBeatLabAudioContext(
  ctxRef: MutableRefObject<AudioContext | null>,
  getOrCreateAudioContext: () => AudioContext,
): AudioContext {
  const prev = ctxRef.current;
  if (prev && prev.state !== 'closed') return prev;
  const ctx = getOrCreateAudioContext();
  ctxRef.current = ctx;
  return ctx;
}
