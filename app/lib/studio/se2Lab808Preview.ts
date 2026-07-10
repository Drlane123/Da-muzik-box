/**
 * 808 Lab — SE2 preview + transport scheduling (Creation Station voice engine, standalone routing).
 */
import {
  playEightZeroEight,
  type EightZeroEightPlayExt,
} from '@/app/lib/creationStation/eightZeroEightVoice';
import { se2Lab808PresetDef, type Se2Lab808VoiceParams } from '@/app/lib/studio/se2Lab808Types';

function voiceToPlayExt(
  voice: Se2Lab808VoiceParams,
  velocity: number,
  bpm: number,
  holdBeats: number,
  stripIn: AudioNode,
): EightZeroEightPlayExt {
  return {
    holdBeats,
    bpm,
    kickKeyboardMap: true,
    kickMonophonic: true,
    velocity01: velocity / 127,
    soundLane: voice.soundLane,
    subOscOnly: voice.soundLane === 'bass',
    filterFx: voice.filterFx,
    destination: stripIn,
  };
}

export function previewSe2Lab808Note(
  ctx: AudioContext,
  stripIn: AudioNode,
  pitch: number,
  velocity: number,
  voice: Se2Lab808VoiceParams,
  bpm: number,
  holdBeats = 0.5,
): void {
  const when = Math.max(ctx.currentTime + 0.008, ctx.currentTime);
  const preset = se2Lab808PresetDef(voice);
  playEightZeroEight(
    ctx,
    when,
    pitch,
    preset,
    voice.output,
    voiceToPlayExt(voice, velocity, bpm, holdBeats, stripIn),
  );
}

export function scheduleSe2Lab808Note(
  ctx: AudioContext,
  stripIn: AudioNode,
  when: number,
  tEnd: number,
  pitch: number,
  velocity: number,
  voice: Se2Lab808VoiceParams,
  bpm: number,
): void {
  const spb = 60 / Math.max(40, bpm);
  const durBeats = Math.max(0.25, (tEnd - when) / spb);
  const preset = se2Lab808PresetDef(voice);
  playEightZeroEight(
    ctx,
    when,
    pitch,
    preset,
    voice.output,
    voiceToPlayExt(voice, velocity, bpm, durBeats, stripIn),
  );
}
