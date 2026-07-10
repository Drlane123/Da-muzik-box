/**
 * Piano Roll drum playback — loads 16-pad producer kits and triggers one-shots.
 * Standalone from Beat Lab transport; shares AudioContext + master gain only.
 */

import {
  ensureBeatLabProducerKitLoaded,
  beatLabProducerKitMeta,
  type BeatLabProducerKitId,
  type LoadedBeatLabProducerPad,
} from '@/app/lib/creationStation/beatLabProducerKits';
import { beatLabPadPlaybackRateDetune } from '@/app/lib/creationStation/beatLabMidiRoll';
import type { PadSamplerPlaybackOpts } from '@/app/lib/padSampleStorage';

export const PIANO_ROLL_DRUM_PADS = 16;

const GM_DRUM_NOTE_TO_PAD: Readonly<Record<number, number>> = {
  35: 0, 36: 0, 37: 7, 38: 1, 39: 2, 40: 1, 42: 3, 44: 3, 46: 4,
  43: 6, 45: 5, 48: 5, 50: 5, 49: 8, 51: 9, 52: 10, 53: 11, 54: 12, 56: 13, 57: 14,
};

export function pianoRollPadIndexForMidi(midi: number): number {
  if (midi in GM_DRUM_NOTE_TO_PAD) return GM_DRUM_NOTE_TO_PAD[midi]!;
  if (midi >= 35 && midi <= 81) return (midi - 35) % PIANO_ROLL_DRUM_PADS;
  return midi % PIANO_ROLL_DRUM_PADS;
}

export function pianoRollPadLabelsForKit(kitId: BeatLabProducerKitId): string[] {
  const meta = beatLabProducerKitMeta(kitId);
  if (!meta) return Array.from({ length: PIANO_ROLL_DRUM_PADS }, (_, i) => `Pad ${i + 1}`);
  const labels = new Array<string>(PIANO_ROLL_DRUM_PADS).fill('');
  for (const def of meta.pads) {
    if (def.pad >= 0 && def.pad < PIANO_ROLL_DRUM_PADS) labels[def.pad] = def.label;
  }
  for (let i = 0; i < PIANO_ROLL_DRUM_PADS; i++) {
    if (!labels[i]) labels[i] = `Pad ${i + 1}`;
  }
  return labels;
}

function masterDest(ctx: AudioContext): AudioNode {
  const master = (window as unknown as { __daMusicMasterGain?: GainNode | null }).__daMusicMasterGain;
  return master && master.context === ctx ? master : ctx.destination;
}

function playLoadedPad(
  ctx: AudioContext,
  pad: LoadedBeatLabProducerPad,
  velocity: number,
  when: number,
  dest?: AudioNode,
): void {
  const vol = Math.max(0.02, Math.min(1, (velocity / 127) * 0.88));
  const sampler: PadSamplerPlaybackOpts = pad.sampler;
  const { playbackRate, detuneCents } = beatLabPadPlaybackRateDetune(1, sampler.fineSemi, false);

  const src = ctx.createBufferSource();
  src.buffer = pad.buffer;
  src.playbackRate.value = playbackRate;
  src.detune.value = detuneCents;

  const gain = ctx.createGain();
  const snap = Math.max(0, Math.min(1, sampler.triggerSnap ?? 0));
  const peak = vol * (1 + snap * 0.35);
  gain.gain.setValueAtTime(peak, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol * 0.08), when + 0.04);

  let tail: AudioNode = src;
  const sr = pad.buffer.sampleRate;
  const ny = sr * 0.48;

  if (sampler.hpHz >= 25) {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = Math.min(sampler.hpHz, ny);
    hp.Q.value = 0.707;
    src.connect(hp);
    tail = hp;
  }
  if (sampler.lpHz >= 200 && sampler.lpHz < 19900) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(sampler.lpHz, ny);
    lp.Q.value = 0.707;
    tail.connect(lp);
    tail = lp;
  }

  const trim0 = Math.max(0, Math.min(0.98, sampler.trim0 ?? 0));
  const trim1 = Math.max(trim0 + 0.01, Math.min(1, sampler.trim1 ?? 1));
  const startSec = trim0 * pad.buffer.duration;
  const endSec = trim1 * pad.buffer.duration;
  const playDur = Math.min(
    endSec - startSec,
    sampler.maxPlaySec && sampler.maxPlaySec > 0 ? sampler.maxPlaySec : endSec - startSec,
  );

  tail.connect(gain);
  gain.connect(dest ?? masterDest(ctx));
  src.start(when, startSec, Math.max(0.01, playDur));
}

export type PianoRollDrumKitSession = {
  kitId: BeatLabProducerKitId;
  pads: LoadedBeatLabProducerPad[];
};

export async function loadPianoRollDrumKit(
  kitId: BeatLabProducerKitId,
  ctx: AudioContext,
): Promise<PianoRollDrumKitSession> {
  const pads = await ensureBeatLabProducerKitLoaded(kitId, ctx);
  return { kitId, pads };
}

export function triggerPianoRollDrumPad(
  session: PianoRollDrumKitSession | null,
  padIndex: number,
  ctx: AudioContext,
  velocity = 100,
  when?: number,
  dest?: AudioNode,
): boolean {
  const t = when ?? ctx.currentTime;
  const pad = session?.pads.find((p) => p.pad === padIndex);
  if (pad) {
    playLoadedPad(ctx, pad, velocity, t, dest);
    return true;
  }
  return false;
}
