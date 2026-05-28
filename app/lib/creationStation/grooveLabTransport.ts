import {
  grooveLabIsBassSubMidi,
  grooveLabIsMelodyMidi,
} from '@/app/lib/creationStation/grooveComposerEngine';
import { GROOVE_LAB_CHORD_ROLL_MIDI_MIN } from '@/app/lib/creationStation/grooveLabPitch';
import { grooveLabBassAnchorsFromHits } from '@/app/lib/creationStation/grooveLabRoll';
import { playGrooveLabBassSound, type GrooveLabBassSoundId } from '@/app/lib/creationStation/grooveLabBassSounds';
import {
  collapseGrooveChordHitsToBarDownbeats,
  GROOVE_LAB_SLOTS_PER_BAR,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';
import { scheduleOrchidChord, type OrchidPerformanceMode } from '@/app/lib/creationStation/orchidChordEngine';
import type { ChordVoiceId } from '@/app/lib/creationStation/chordSequencerVoices';
import {
  CREATION_LOOP_CHAIN_FLOOR_SEC,
  CREATION_METRO_NODE_EPS_SEC,
  CREATION_SCHEDULE_AHEAD_SEC,
  SE2_AUDIO_START_FLOOR_SEC,
} from '@/app/lib/creationStation/creationTransportSystem';

/** @deprecated Use {@link CREATION_SCHEDULE_AHEAD_SEC} — kept for imports. */
export const GROOVE_LAB_TRANSPORT_LOOKAHEAD_SEC = CREATION_SCHEDULE_AHEAD_SEC;
export const GROOVE_LAB_TRANSPORT_SCHED_MS = 25;
export const GROOVE_LAB_TRANSPORT_AUDIO_FLOOR_SEC = SE2_AUDIO_START_FLOOR_SEC;

export function grooveLabTransportSessionStart(
  ctxCurrentTime: number,
  floorSec = GROOVE_LAB_TRANSPORT_AUDIO_FLOOR_SEC,
): number {
  return ctxCurrentTime + floorSec;
}

const GROOVE_LAB_MAX_SCHEDULE_PER_REFILL = 256;

function chordRollHitsFromLayer(
  hits: readonly GrooveRollHit[],
): GrooveRollHit[] {
  return collapseGrooveChordHitsToBarDownbeats(
    hits.filter((h) => h.midi >= GROOVE_LAB_CHORD_ROLL_MIDI_MIN),
  );
}

export function grooveLabTransportEventKey(cycle: number, ev: GrooveLabTransportEvent): string {
  if (ev.kind === 'bass') return `${cycle}|b|${ev.slot}|${ev.midi}`;
  if (ev.kind === 'melody') return `${cycle}|m|${ev.slot}|${ev.midi}`;
  return `${cycle}|c|${ev.slot}|${ev.midis.join('.')}`;
}

export function grooveLabSecPerSlot(bpm: number): number {
  return ((60 / Math.max(40, bpm)) * 4) / GROOVE_LAB_SLOTS_PER_BAR;
}

export function grooveLabSlotsPerBeat(): number {
  return GROOVE_LAB_SLOTS_PER_BAR / 4;
}

export function grooveLabOriginBeatFromSlot(slot: number): number {
  return Math.max(0, slot) / Math.max(1, grooveLabSlotsPerBeat());
}

export type GrooveLabTransportEvent =
  | { kind: 'bass'; slot: number; midi: number; sustainSlots: number; vel: number }
  | { kind: 'melody'; slot: number; midi: number; sustainSlots: number; vel: number }
  | { kind: 'chord'; slot: number; midis: number[]; sustainSlots: number; vel: number };

/** Build loop events from SUB + CHORD + MELODY work channels. */
export function buildGrooveLabTransportEvents(
  subHits: GrooveRollHit[],
  chordHits: GrooveRollHit[],
  melodyHits: GrooveRollHit[] = [],
): GrooveLabTransportEvent[] {
  const subs = subHits.filter((h) => grooveLabIsBassSubMidi(h.midi));
  const leads = melodyHits.filter((h) => grooveLabIsMelodyMidi(h.midi));
  const anchors = grooveLabBassAnchorsFromHits(subs);
  const anchorKeys = new Set(anchors.map((a) => `${a.slot}:${a.midi}`));

  const events: GrooveLabTransportEvent[] = [];

  for (const h of subs) {
    if (!anchorKeys.has(`${h.slot}:${h.midi}`)) continue;
    events.push({
      kind: 'bass',
      slot: h.slot,
      midi: h.midi,
      sustainSlots: h.sustainSlots,
      vel: h.vel,
    });
  }

  for (const h of leads) {
    events.push({
      kind: 'melody',
      slot: h.slot,
      midi: h.midi,
      sustainSlots: h.sustainSlots,
      vel: h.vel,
    });
  }

  const chordSource = chordRollHitsFromLayer(chordHits);
  const bySlot = new Map<number, GrooveRollHit[]>();
  for (const h of chordSource) {
    const list = bySlot.get(h.slot) ?? [];
    list.push(h);
    bySlot.set(h.slot, list);
  }
  for (const [slot, list] of bySlot) {
    const midis = [...new Set(list.map((h) => Math.round(h.midi)))].sort((a, b) => a - b);
    if (midis.length === 0) continue;
    events.push({
      kind: 'chord',
      slot,
      midis,
      sustainSlots: Math.max(...list.map((h) => h.sustainSlots)),
      vel: Math.max(...list.map((h) => h.vel)),
    });
  }

  events.sort(
    (a, b) =>
      a.slot - b.slot ||
      (a.kind === 'chord' ? 1 : 0) - (b.kind === 'chord' ? 1 : 0) ||
      (a.kind === 'melody' ? 1 : 0) - (b.kind === 'melody' ? 1 : 0),
  );
  if (events.length > 0) return events;

  for (const h of subs) {
    events.push({
      kind: 'bass',
      slot: h.slot,
      midi: h.midi,
      sustainSlots: h.sustainSlots,
      vel: h.vel,
    });
  }
  if (chordHits.length > 0) {
    const bySlotFb = new Map<number, GrooveRollHit[]>();
    for (const h of collapseGrooveChordHitsToBarDownbeats(chordHits)) {
      const list = bySlotFb.get(h.slot) ?? [];
      list.push(h);
      bySlotFb.set(h.slot, list);
    }
    for (const [slot, list] of bySlotFb) {
      const midis = [...new Set(list.map((h) => Math.round(h.midi)))].sort((a, b) => a - b);
      events.push({
        kind: 'chord',
        slot,
        midis,
        sustainSlots: Math.max(...list.map((h) => h.sustainSlots)),
        vel: Math.max(...list.map((h) => h.vel)),
      });
    }
  }
  for (const h of leads) {
    events.push({
      kind: 'melody',
      slot: h.slot,
      midi: h.midi,
      sustainSlots: h.sustainSlots,
      vel: h.vel,
    });
  }

  return events;
}

export function scheduleGrooveLabTransportEvent(
  ctx: AudioContext,
  when: number,
  ev: GrooveLabTransportEvent,
  opts: {
    bpm: number;
    secPerSlot: number;
    bassSoundId: GrooveLabBassSoundId;
    melodySoundId: GrooveLabBassSoundId;
    chordVoice: ChordVoiceId;
    chordVolume: number;
    chordsMuted: boolean;
    bassMuted?: boolean;
    perfMode: OrchidPerformanceMode;
  },
): void {
  const holdBeats = Math.max(0.35, (ev.sustainSlots * opts.secPerSlot * opts.bpm) / 60);
  const sustainSec = (ev.sustainSlots * opts.secPerSlot) * 0.92;

  if (ev.kind === 'bass') {
    if (opts.bassMuted) return;
    playGrooveLabBassSound(ctx, ev.midi, opts.bassSoundId, when, ev.vel * 0.92, opts.bpm, holdBeats, {
      monophonic: false,
    });
    return;
  }
  if (ev.kind === 'melody') {
    if (opts.bassMuted) return;
    playGrooveLabBassSound(ctx, ev.midi, opts.melodySoundId, when, ev.vel * 0.88, opts.bpm, holdBeats, {
      monophonic: false,
    });
    return;
  }
  if (opts.chordsMuted || opts.chordVolume <= 0.02) return;
  /** Transport = block chord on the grid line (no strum/arp smear — that stays in preview/export only). */
  scheduleOrchidChord(ctx, ev.midis, when, sustainSec, opts.chordVoice, opts.chordVolume * ev.vel, {
    mode: 'block',
    bpm: opts.bpm,
  });
}

export type RefillGrooveLabTransportOpts = {
  loopSlots: number;
  secPerSlot: number;
  sessionStart: number;
  seekSlot: number;
  bpm: number;
  bassSoundId: GrooveLabBassSoundId;
  melodySoundId: GrooveLabBassSoundId;
  chordVoice: ChordVoiceId;
  chordVolume: number;
  chordsMuted: boolean;
  bassMuted: boolean;
  perfMode: OrchidPerformanceMode;
};

export type RefillGrooveLabMetronomeOpts = {
  sessionStart: number;
  originSlot: number;
  bpm: number;
  loopSlots: number;
  beatsPerBar?: number;
  metronomeEnabled: boolean;
};

/**
 * Schedule every bass/chord hit in the visible loop window (current cycle + ahead).
 * Uses cycle keys so each grid note fires once per loop — no index backlog skips.
 */
export function refillGrooveLabTransport(
  ctx: AudioContext,
  ctSnap: number,
  evs: ReadonlyArray<GrooveLabTransportEvent>,
  firedKeys: Set<string>,
  opts: RefillGrooveLabTransportOpts,
): void {
  if (evs.length === 0) return;

  const now = ctSnap;
  const loopSec = Math.max(opts.secPerSlot, opts.loopSlots * opts.secPerSlot);
  const horizon = now + Math.max(CREATION_SCHEDULE_AHEAD_SEC, loopSec * 0.4);
  const chainFloor = SE2_AUDIO_START_FLOOR_SEC;
  let chain = now + chainFloor;
  const sessionStart = opts.sessionStart;
  const cycleNow = Math.max(0, Math.floor((now - sessionStart + 1e-6) / loopSec));

  for (const key of firedKeys) {
    const c = Number(key.split('|')[0]);
    if (!Number.isFinite(c) || c < cycleNow - 1) firedKeys.delete(key);
  }

  let scheduled = 0;

  const schedOpts = {
    bpm: opts.bpm,
    secPerSlot: opts.secPerSlot,
    bassSoundId: opts.bassSoundId,
    melodySoundId: opts.melodySoundId,
    chordVoice: opts.chordVoice,
    chordVolume: opts.chordVolume,
    chordsMuted: opts.chordsMuted,
    bassMuted: opts.bassMuted,
    perfMode: opts.perfMode,
  };

  for (let cycle = cycleNow; cycle <= cycleNow + 2 && scheduled < GROOVE_LAB_MAX_SCHEDULE_PER_REFILL; cycle++) {
    for (const ev of evs) {
      const key = grooveLabTransportEventKey(cycle, ev);
      if (firedKeys.has(key)) continue;

      const delta = (ev.slot - opts.seekSlot + opts.loopSlots) % opts.loopSlots;
      let t = sessionStart + cycle * loopSec + delta * opts.secPerSlot;

      if (t >= horizon) continue;

      const when = Math.max(t, chain);
      if (when < now - 0.08) continue;
      try {
        scheduleGrooveLabTransportEvent(ctx, when, ev, schedOpts);
      } catch {
        continue;
      }
      firedKeys.add(key);
      chain = when + CREATION_METRO_NODE_EPS_SEC;
      scheduled += 1;
      if (scheduled >= GROOVE_LAB_MAX_SCHEDULE_PER_REFILL) return;
    }
  }
}

export type RefillGrooveLabMetronomePumpOpts = {
  loopContinuation?: boolean;
};

/** Groove Lab metronome — SE2 `refillMetronome` / Beat Lab `refillCreationMetronome` contract. */
export function refillGrooveLabMetronome(
  ctx: AudioContext,
  ctSnap: number,
  nextMetroKRef: { current: number },
  playClick: (ctx: AudioContext, idealGridT: number, downbeat: boolean) => void,
  opts: RefillGrooveLabMetronomeOpts,
  pumpOpts?: RefillGrooveLabMetronomePumpOpts,
): void {
  if (!opts.metronomeEnabled || opts.sessionStart <= 0) return;
  const spb = 60 / Math.max(1, opts.bpm);
  const originBeat = grooveLabOriginBeatFromSlot(opts.originSlot);
  const originQuarter = Math.floor(originBeat + 1e-8);
  const beatsPerBar = Math.max(1, Math.round(opts.beatsPerBar ?? 4));
  const horizon = ctSnap + CREATION_SCHEDULE_AHEAD_SEC;
  const chainFloor = pumpOpts?.loopContinuation
    ? CREATION_LOOP_CHAIN_FLOOR_SEC
    : SE2_AUDIO_START_FLOOR_SEC;
  let chain = ctSnap + chainFloor;
  let n = 0;

  while (true) {
    const tNextQuarter = opts.sessionStart + (nextMetroKRef.current + 1 - originBeat) * spb;
    if (tNextQuarter > ctSnap) break;
    nextMetroKRef.current += 1;
  }

  while (n < 256) {
    const k = nextMetroKRef.current;
    const tGrid = opts.sessionStart + (k - originBeat) * spb;
    if (tGrid >= horizon) break;
    const t0 = Math.max(tGrid, chain);
    try {
      const downbeat =
        (((k - originQuarter) % beatsPerBar) + beatsPerBar) % beatsPerBar === 0;
      playClick(ctx, t0, downbeat);
    } catch {
      break;
    }
    chain = t0 + CREATION_METRO_NODE_EPS_SEC;
    nextMetroKRef.current = k + 1;
    n += 1;
  }
}

/** One-shot roll preview — same routing as transport (bass sound vs Orchid chord). */
export function previewGrooveLabRoll(
  ctx: AudioContext,
  subHits: GrooveRollHit[],
  chordHits: GrooveRollHit[],
  melodyHits: GrooveRollHit[],
  opts: {
    bpm: number;
    bassSoundId: GrooveLabBassSoundId;
    melodySoundId?: GrooveLabBassSoundId;
    chordVoice: ChordVoiceId;
    chordVolume: number;
    chordsMuted: boolean;
    bassMuted?: boolean;
    perfMode: OrchidPerformanceMode;
    startDelaySec?: number;
  },
): void {
  const events = buildGrooveLabTransportEvents(subHits, chordHits, melodyHits);
  if (events.length === 0) return;
  const secPerSlot = grooveLabSecPerSlot(opts.bpm);
  const t0 = ctx.currentTime + (opts.startDelaySec ?? GROOVE_LAB_TRANSPORT_AUDIO_FLOOR_SEC);
  const schedOpts = {
    bpm: opts.bpm,
    secPerSlot,
    bassSoundId: opts.bassSoundId,
    melodySoundId: opts.melodySoundId ?? opts.bassSoundId,
    chordVoice: opts.chordVoice,
    chordVolume: opts.chordVolume,
    chordsMuted: opts.chordsMuted,
    bassMuted: opts.bassMuted,
    perfMode: opts.perfMode,
  };
  for (const ev of events) {
    const when = t0 + ev.slot * secPerSlot;
    scheduleGrooveLabTransportEvent(ctx, when, ev, schedOpts);
  }
}
