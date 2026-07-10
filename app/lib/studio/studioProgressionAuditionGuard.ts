/**
 * SE2 transport ↔ Progression+ preview — stop stacked chord layers without clearing loop UI.
 */
import { haltProgressionAuditionVoices } from '@/app/lib/creationStation/chordSequencerVoices';

let interruptFn: (() => void) | null = null;

export function registerStudioProgressionAuditionInterrupt(fn: () => void): () => void {
  interruptFn = fn;
  return () => {
    if (interruptFn === fn) interruptFn = null;
  };
}

/** Silence Progression+ preview timers + tear down audition bus (loop toggle may stay on). */
export function interruptStudioProgressionAuditionForTransport(): void {
  interruptFn?.();
  haltProgressionAuditionVoices();
}
