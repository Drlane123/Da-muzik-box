/**
 * Geno Ultra Synth — SE2 preview + transport scheduling.
 */
import {
  previewGenoUltraSynthNote,
  previewGenoUltraSynthArpNote,
  scheduleGenoUltraSynthNote,
  stopGenoUltraArpPreviewVoices,
  stopGenoUltraKeyboardPreviewVoices,
} from '@/app/lib/studio/genoUltraSynthEngine';
import type { GenoUltraSynthVoiceParams } from '@/app/lib/studio/genoUltraSynthTypes';

export { previewGenoUltraSynthNote, previewGenoUltraSynthArpNote, stopGenoUltraArpPreviewVoices, stopGenoUltraKeyboardPreviewVoices };
export {
  startGenoUltraArpPreviewLoop,
  stopGenoUltraArpPreviewLoop,
  type GenoUltraArpPreviewHandle,
} from '@/app/lib/studio/genoUltraArpPreviewScheduler';

export function previewSe2GenoUltraSynthNote(
  ctx: AudioContext,
  stripIn: AudioNode,
  pitch: number,
  velocity: number,
  voice: GenoUltraSynthVoiceParams,
  bpm: number,
  holdSec = 0.45,
): void {
  previewGenoUltraSynthNote(ctx, stripIn, pitch, velocity, voice, bpm, holdSec);
}

export function scheduleSe2GenoUltraSynthNote(
  ctx: AudioContext,
  stripIn: AudioNode,
  when: number,
  tEnd: number,
  pitch: number,
  velocity: number,
  voice: GenoUltraSynthVoiceParams,
  bpm: number,
): void {
  const spb = 60 / Math.max(40, bpm);
  const durSec = Math.max(0.04, tEnd - when);
  const durBeats = durSec / spb;
  scheduleGenoUltraSynthNote(ctx, {
    when,
    durationSec: Math.max(0.04, durBeats * spb),
    midi: pitch,
    velocity,
    voice,
    stripOutput: stripIn,
    bpm,
    transportLite: false,
  });
}
