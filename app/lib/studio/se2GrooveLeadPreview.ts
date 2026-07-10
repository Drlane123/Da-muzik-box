/**
 * Groove Lead — SE2 preview + transport scheduling (WaveLeaf engine).
 */
import { playWaveLeafNote } from '@/app/lib/creationStation/waveLeafEngine';
import { waveLeafPreset } from '@/app/lib/creationStation/waveLeafPresets';
import type { Se2GrooveLeadVoiceParams } from '@/app/lib/studio/se2GrooveLeadTypes';

export function se2GrooveLeadMonoGroup(trackIndex: number): string {
  return `se2-groove-lead-${trackIndex}`;
}

function voiceToPlayOpts(
  voice: Se2GrooveLeadVoiceParams,
  velocity: number,
  bpm: number,
  holdBeats: number,
  stripIn: AudioNode,
  trackIndex: number,
  transportSnap: boolean,
  ampAttackSec?: number,
  polyphonic = false,
) {
  return {
    preset: waveLeafPreset(voice.presetId),
    glideMs: voice.glideMs,
    brightness: voice.brightness,
    warmth: voice.warmth,
    drive: voice.drive,
    vibratoDepthCents: voice.vibratoDepthCents,
    outputGain: voice.output,
    velocity: velocity / 127,
    bpm,
    holdBeats,
    destination: stripIn,
    monophonic: !polyphonic,
    monoGroup: se2GrooveLeadMonoGroup(trackIndex),
    transportChordSnap: transportSnap,
    ampAttackSec,
  } as const;
}

export function previewSe2GrooveLeadNote(
  ctx: AudioContext,
  stripIn: AudioNode,
  pitch: number,
  velocity: number,
  voice: Se2GrooveLeadVoiceParams,
  trackIndex: number,
  bpm: number,
  holdBeats = 0.5,
): void {
  const when = Math.max(ctx.currentTime + 0.008, ctx.currentTime);
  playWaveLeafNote(ctx, pitch, when, voiceToPlayOpts(voice, velocity, bpm, holdBeats, stripIn, trackIndex, false));
}

export function scheduleSe2GrooveLeadNote(
  ctx: AudioContext,
  stripIn: AudioNode,
  when: number,
  tEnd: number,
  pitch: number,
  velocity: number,
  voice: Se2GrooveLeadVoiceParams,
  trackIndex: number,
  bpm: number,
  ampAttackSec?: number,
  polyphonic = false,
): void {
  const spb = 60 / Math.max(40, bpm);
  const durBeats = Math.max(0.25, (tEnd - when) / spb);
  playWaveLeafNote(
    ctx,
    pitch,
    when,
    voiceToPlayOpts(voice, velocity, bpm, durBeats, stripIn, trackIndex, true, ampAttackSec, polyphonic),
  );
}
