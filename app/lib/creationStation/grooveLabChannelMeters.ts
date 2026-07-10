/**
 * Groove Lab CH 33–48 meters — audio-clock driven (transport rAF tick).
 * Scheduled peaks on bass / chord / melody playback (same pattern as Beat Lab pads).
 */
import {
  CHORD_BASS_SEQ_CHANNEL_BASE,
  CHORD_BASS_SEQ_CHANNEL_COUNT,
} from '@/app/lib/creationStation/chordBassSequencerSession';
import {
  grooveLabChannelAudible,
  isGrooveLabChannelMuted,
} from '@/app/lib/creationStation/grooveLabChannelMuteSolo';
import {
  grooveLabChannelVol127,
  mixerVolToLinearGain,
} from '@/app/lib/studio/se2MixerFaderScale';

const CHANNEL_FIRST = CHORD_BASS_SEQ_CHANNEL_BASE;
const CHANNEL_LAST = CHORD_BASS_SEQ_CHANNEL_BASE + CHORD_BASS_SEQ_CHANNEL_COUNT - 1;

const ZERO_SNAP = 0.0005;
const RUNNING_DECAY = 0.9;
const STOPPED_DECAY = 0.86;

type StereoLevel = { l: number; r: number };

type PendingPulse = {
  when: number;
  ch: number;
  peak: number;
  pan: number;
};

const levels: StereoLevel[] = Array.from({ length: CHANNEL_LAST + 1 }, () => ({ l: 0, r: 0 }));
const pending: PendingPulse[] = [];

let seq = 0;
let listeners = new Set<() => void>();

function notify(): void {
  seq += 1;
  listeners.forEach((l) => l());
}

function isGrooveChannel(ch: number): boolean {
  return ch >= CHANNEL_FIRST && ch <= CHANNEL_LAST;
}

function panWeights(panSigned: number): { wl: number; wr: number } {
  const p = Math.max(-1, Math.min(1, panSigned));
  const theta = ((p + 1) / 2) * (Math.PI / 2);
  return { wl: Math.cos(theta), wr: Math.sin(theta) };
}

function bumpChannel(ch: number, monoPeak: number, panSigned: number): void {
  if (!isGrooveChannel(ch)) return;
  const peak = Math.max(0, Math.min(1, monoPeak));
  if (peak <= ZERO_SNAP) return;
  const { wl, wr } = panWeights(panSigned);
  const row = levels[ch]!;
  row.l = Math.max(row.l, peak * wl);
  row.r = Math.max(row.r, peak * wr);
}

/** Strip fader only — drives live CH 33–48 bus gain (mute/solo gates scheduling separately). */
export function grooveLabChannelFaderGain(
  ch: number,
  channelVolumes: Record<number, number> | undefined,
): number {
  return mixerVolToLinearGain(grooveLabChannelVol127(channelVolumes?.[ch]));
}

export function grooveLabChannelVolumeGain(
  ch: number,
  channelVolumes: Record<number, number> | undefined,
): number {
  if (!grooveLabChannelAudible(ch)) return 0;
  return grooveLabChannelFaderGain(ch, channelVolumes);
}

/** Transport + meters — blocked when muted, solo-law silenced, or fader at floor. */
export function grooveLabChannelTransportOpen(
  ch: number,
  channelVolumes: Record<number, number> | undefined,
): boolean {
  if (isGrooveLabChannelMuted(ch)) return false;
  if (!grooveLabChannelAudible(ch)) return false;
  return grooveLabChannelFaderGain(ch, channelVolumes) > 0.001;
}

export function grooveLabMeterPeakFromVelocity(
  velocity01: number,
  ch: number,
  channelVolumes?: Record<number, number>,
): number {
  return Math.min(1, velocity01 * grooveLabChannelVolumeGain(ch, channelVolumes) * 0.92);
}

export function scheduleGrooveLabMeterPulse(
  whenSec: number,
  ch: number,
  monoPeak: number,
  panSigned = 0,
): void {
  if (!isGrooveChannel(ch)) return;
  const pulse: PendingPulse = {
    when: whenSec,
    ch,
    peak: Math.max(0, Math.min(1, monoPeak)),
    pan: Math.max(-1, Math.min(1, panSigned)),
  };
  let i = pending.findIndex((p) => p.when > whenSec);
  if (i < 0) pending.push(pulse);
  else pending.splice(i, 0, pulse);
}

export function scheduleGrooveLabMeterPulseAt(
  ctx: AudioContext,
  ch: number,
  monoPeak: number,
  panSigned: number,
  whenSec: number,
): void {
  scheduleGrooveLabMeterPulse(Math.max(whenSec, ctx.currentTime + 0.001), ch, monoPeak, panSigned);
}

/** Call from Groove Lab transport rAF while the screen is open. */
export function tickGrooveLabChannelMeters(audioNow: number, transportRunning: boolean): void {
  let changed = false;

  while (pending.length > 0 && pending[0]!.when <= audioNow + 0.002) {
    const p = pending.shift()!;
    bumpChannel(p.ch, p.peak, p.pan);
    changed = true;
  }

  const decay = transportRunning ? RUNNING_DECAY : STOPPED_DECAY;
  for (let ch = CHANNEL_FIRST; ch <= CHANNEL_LAST; ch += 1) {
    const row = levels[ch]!;
    const nl = row.l * decay;
    const nr = row.r * decay;
    const fl = nl < ZERO_SNAP ? 0 : nl;
    const fr = nr < ZERO_SNAP ? 0 : nr;
    if (fl !== row.l || fr !== row.r) {
      row.l = fl;
      row.r = fr;
      changed = true;
    }
  }

  if (changed) notify();
}

export function getGrooveLabChannelMeterLevel(ch: number): StereoLevel {
  if (!isGrooveChannel(ch)) return { l: 0, r: 0 };
  const row = levels[ch]!;
  return { l: row.l, r: row.r };
}

export function subscribeGrooveLabChannelMeters(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getGrooveLabChannelMetersSeq(): number {
  return seq;
}

export function resetGrooveLabChannelMeters(): void {
  pending.length = 0;
  for (let ch = CHANNEL_FIRST; ch <= CHANNEL_LAST; ch += 1) {
    levels[ch]!.l = 0;
    levels[ch]!.r = 0;
  }
  notify();
}
