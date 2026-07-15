/**
 * SE2 808 Lab — tone step grid → MIDI / WAV / piano-roll notes.
 * Snare/clap timing strip is intentionally excluded — export is kick/bass tone grid only.
 * Consecutive ON steps merge into one sustained note (held hum length preserved).
 */
import type { Lab808ToneExportNote, Lab808ToneRenderOpts } from '@/app/lib/creationStation/lab808Export';
import {
  SE2_LAB808_TONE_GRID_LANES,
  normalizeSe2Lab808ToneGridPattern,
  se2Lab808NormalizeToneGridLoopBars,
  se2Lab808ToneGridStepCount,
  se2Lab808ToneMidiForLane,
} from '@/app/lib/studio/se2Lab808DrumPattern';
import {
  se2Lab808ToneGridIsRunStart,
  se2Lab808ToneGridRunLengthFrom,
} from '@/app/lib/studio/se2Lab808ToneGridRuns';
import { se2Lab808PresetDef, type Se2Lab808VoiceParams } from '@/app/lib/studio/se2Lab808Types';

export type Se2Lab808ToneGridRollNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

export function se2Lab808ToneGridToExportNotes(voice: Se2Lab808VoiceParams): Lab808ToneExportNote[] {
  const loopBars = se2Lab808NormalizeToneGridLoopBars(voice.toneGridLoopBars);
  const pattern = normalizeSe2Lab808ToneGridPattern(voice.toneGridSteps, loopBars);
  const stepCount = se2Lab808ToneGridStepCount(loopBars);
  const loopBeats = loopBars * 4;
  const stepBeats = loopBeats / Math.max(1, stepCount);
  const isKick = voice.soundLane === 'kick';
  const velocity01 = Math.max(0.01, Math.min(1, voice.toneGridLevel * voice.output));

  const out: Lab808ToneExportNote[] = [];
  for (let lane = 0; lane < SE2_LAB808_TONE_GRID_LANES; lane += 1) {
    for (let col = 0; col < stepCount; col += 1) {
      if (!se2Lab808ToneGridIsRunStart(pattern, lane, col)) continue;
      const runLen = se2Lab808ToneGridRunLengthFrom(pattern, lane, col, stepCount);
      if (runLen < 1) continue;
      const holdSteps = !isKick || runLen >= 2 ? runLen : 1;
      const durBeats = Math.max(0.2, holdSteps * stepBeats * (isKick && runLen < 2 ? 0.85 : 1));
      out.push({
        startBeat: col * stepBeats,
        midi: se2Lab808ToneMidiForLane(voice.tonePadBaseMidi, lane),
        durBeats,
        velocity01,
      });
    }
  }
  out.sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);
  return out;
}

export function se2Lab808ToneGridToRollNotes(voice: Se2Lab808VoiceParams): Se2Lab808ToneGridRollNote[] {
  return se2Lab808ToneGridToExportNotes(voice).map((n) => ({
    pitch: Math.round(n.midi),
    startBeat: n.startBeat,
    durationBeats: n.durBeats,
    velocity: Math.max(1, Math.min(127, Math.round((n.velocity01 ?? 0.88) * 127))),
  }));
}

export function se2Lab808ToneGridExportRenderOpts(
  voice: Se2Lab808VoiceParams,
  bpm: number,
  trackName?: string,
): Lab808ToneRenderOpts {
  return {
    bpm,
    preset: se2Lab808PresetDef(voice),
    soundLane: voice.soundLane,
    gain: voice.output,
    filterFx: voice.filterFx,
    trackName: trackName ?? `808 Lab ${voice.soundLane}`,
  };
}

export async function se2Lab808WavBytesToAudioBuffer(
  ctx: AudioContext,
  wavBytes: Uint8Array,
): Promise<AudioBuffer> {
  const slice = wavBytes.buffer.slice(wavBytes.byteOffset, wavBytes.byteOffset + wavBytes.byteLength);
  return ctx.decodeAudioData(slice);
}
