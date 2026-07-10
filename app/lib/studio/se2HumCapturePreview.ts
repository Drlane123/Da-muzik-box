/**
 * Hum Capture lane — transport + preview via Neural Hum instrument voices.
 */
import { getChordInstrument } from '@/app/lib/creationStation/chordInstruments';
import { neuralHumInstrumentMeta, type NeuralHumInstrumentId } from '@/app/lib/vocalLab/neuralHumToInstrument';

export function scheduleSe2HumCaptureNote(
  ctx: AudioContext,
  destination: AudioNode,
  when: number,
  tEnd: number,
  pitch: number,
  velocity127: number,
  instrumentId: NeuralHumInstrumentId,
  transposeSemis = 0,
): void {
  const meta = neuralHumInstrumentMeta(instrumentId);
  const voice = getChordInstrument(meta.synthFallback);
  const midi = Math.max(0, Math.min(127, Math.round(pitch + transposeSemis)));
  const vel = Math.max(0.05, Math.min(1, velocity127 / 127));
  const sustain = Math.max(0.06, tEnd - when);
  voice.scheduleNote({
    ctx,
    destination,
    midi,
    startTime: when,
    sustainSec: sustain,
    velocity: vel,
  });
}

export function previewSe2HumCaptureNote(
  ctx: AudioContext,
  destination: AudioNode,
  pitch: number,
  instrumentId: NeuralHumInstrumentId,
  velocity127 = 100,
  transposeSemis = 0,
): void {
  const t = ctx.currentTime;
  scheduleSe2HumCaptureNote(
    ctx,
    destination,
    t + 0.008,
    t + 0.45,
    pitch,
    velocity127,
    instrumentId,
    transposeSemis,
  );
}
