/**
 * Studio Editor 2 — dedicated Hum Capture lane (Vocal Lab melody-from-voice).
 */
import type { StudioEditor2MidiTrack } from '@/app/lib/studio/studioEditor2Midi';
import {
  se2HarmonySourceSteps,
  se2ResolveGlideBassHarmonyTrack,
  type Se2HarmonySourceTrack,
} from '@/app/lib/studio/se2GlideBassHarmony';
import type { NeuralHumInstrumentId } from '@/app/lib/vocalLab/neuralHumToInstrument';
import type { NeuralHumKeyLockMode, NeuralHumScaleId } from '@/app/lib/vocalLab/neuralHumKeyLock';
import type { NeuralHumRollBarCount, NeuralHumRollQuantize } from '@/app/lib/vocalLab/neuralHumMelodyRoll';
import { NEURAL_HUM_QUANTIZE_DEFAULT } from '@/app/lib/vocalLab/neuralHumMelodyRoll';

export type Se2HumCaptureTrackFields = {
  kind: 'humCapture';
  humCaptureInstrumentId?: NeuralHumInstrumentId;
  /** Progression+ / rhythm / Geno lane for key lock context. */
  humCaptureHarmonyTrackId?: string;
  humCaptureRollBars?: NeuralHumRollBarCount;
  humCaptureKeyLockMode?: NeuralHumKeyLockMode;
  humCaptureKeyRoot?: number;
  humCaptureScaleId?: NeuralHumScaleId;
  humCaptureQuantize?: NeuralHumRollQuantize;
  humCaptureTranspose?: number;
};

export type Se2HumCaptureTrack = StudioEditor2MidiTrack & Se2HumCaptureTrackFields;

export function studioTrackIsHumCaptureChannel(
  tr: { kind?: string } | undefined,
): tr is Se2HumCaptureTrack {
  return tr?.kind === 'humCapture';
}

export function nextHumCaptureTrackName(tracks: readonly { kind?: string; name?: string }[]): string {
  const n = tracks.filter((t) => t.kind === 'humCapture').length + 1;
  return n === 1 ? 'Hum / Melody Capture' : `Hum / Melody Capture ${n}`;
}

export function se2DefaultHumCaptureTrackFields(): Se2HumCaptureTrackFields {
  return {
    kind: 'humCapture',
    humCaptureInstrumentId: 'piano',
    humCaptureHarmonyTrackId: '',
    humCaptureRollBars: 8,
    humCaptureKeyLockMode: 'auto',
    humCaptureKeyRoot: 0,
    humCaptureScaleId: 'major',
    humCaptureQuantize: NEURAL_HUM_QUANTIZE_DEFAULT,
    humCaptureTranspose: 0,
  };
}

export function se2ResolveHumCaptureHarmonyTrack<
  T extends Se2HarmonySourceTrack & { id: string; kind: string; humCaptureHarmonyTrackId?: string },
>(tracks: readonly T[], humCapture: { humCaptureHarmonyTrackId?: string }, humCaptureId: string): T | undefined {
  const want = humCapture.humCaptureHarmonyTrackId?.trim();
  if (want) {
    const picked = tracks.find((t) => t.id === want);
    if (
      picked &&
      picked.id !== humCaptureId &&
      picked.kind !== 'humCapture' &&
      picked.kind !== 'audio'
    ) {
      return picked;
    }
  }
  return tracks.find(
    (t) =>
      t.id !== humCaptureId &&
      t.kind !== 'humCapture' &&
      t.kind !== 'audio' &&
      se2HarmonySourceSteps(t).length > 0,
  );
}

export { se2ResolveGlideBassHarmonyTrack as se2HumCaptureHarmonyCandidates };
