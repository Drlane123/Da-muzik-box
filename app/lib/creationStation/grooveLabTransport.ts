import {
  grooveLabIsBassSubMidi,
  grooveLabIsMelodyMidi,
} from '@/app/lib/creationStation/grooveComposerEngine';
import { scheduleGrooveLabGuitarTransportHit } from '@/app/lib/creationStation/grooveLabGuitarAudition';
import { scheduleGrooveLabOrchestraTransportHit } from '@/app/lib/creationStation/grooveLabOrchestraHitAudition';
import type { OrchestraHitId } from '@/app/lib/creationStation/grooveLabOrchestraHitBank';
import { ensureOrchestraHitBuffer, getOrchestraHitDef } from '@/app/lib/creationStation/grooveLabOrchestraHitBank';
import { resolveGrooveLabOrchestraHitId } from '@/app/lib/creationStation/grooveLabOrchestraHitSoundBank';
import type { GrooveLabGuitarFxSettings } from '@/app/lib/creationStation/grooveLabGuitarFx';
import { grooveLabIsGuitarMidi } from '@/app/lib/creationStation/grooveLabPitch';
import { ensureGuitarLickBuffer, getGuitarLickDef, isGuitarLickSampleId } from '@/app/lib/creationStation/grooveLabGuitarLickBank';
import { resolveGrooveLabGuitarSoundId } from '@/app/lib/creationStation/grooveLabGuitarSoundBank';
import type { GrooveLabAnyLeadSoundId } from '@/app/lib/creationStation/grooveLabLeadSounds';
import {
  grooveLabBassAnchorsFromHits,
  grooveLabChordAttackStacks,
  GROOVE_LAB_QUANTIZE_DEFAULT,
  GROOVE_LAB_SLOTS_PER_BAR,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';
import { playGrooveLabBassSound, type GrooveLabBassSoundId } from '@/app/lib/creationStation/grooveLabBassSounds';
import { scheduleOrchidChord, type OrchidPerformanceMode } from '@/app/lib/creationStation/orchidChordEngine';
import {
  restoreChordSequencerTransportVoices,
  withGrooveLabTransportChordRouting,
  type ChordVoiceId,
} from '@/app/lib/creationStation/chordSequencerVoices';
import { resolveGrooveLabChannelDest } from '@/app/lib/creationStation/grooveLabAudio';
import {
  grooveLabChannelTransportOpen,
  grooveLabMeterPeakFromVelocity,
  scheduleGrooveLabMeterPulseAt,
} from '@/app/lib/creationStation/grooveLabChannelMeters';
import {
  playWaveLeafNote,
  WAVE_LEAF_TRANSPORT_ONSET_LEAD_MS,
} from '@/app/lib/creationStation/waveLeafEngine';
import { waveLeafIsLeadMidi } from '@/app/lib/creationStation/waveLeafPitch';
import { grooveLabWaveLeafBankOutputGain } from '@/app/lib/creationStation/grooveLabLayers';
import { readWaveLeafOutputGain, readWaveLeafSynthSettings } from '@/app/lib/creationStation/waveLeafRuntimeSettings';
import {
  CREATION_LOOP_CHAIN_FLOOR_SEC,
  CREATION_METRO_NODE_EPS_SEC,
  CREATION_SCHEDULE_AHEAD_SEC,
  SE2_AUDIO_START_FLOOR_SEC,
} from '@/app/lib/creationStation/creationTransportSystem';
import { isGrooveLabTransportRunning } from '@/app/lib/creationStation/creationTransportSync';

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

export function grooveLabTransportEventKey(cycle: number, ev: GrooveLabTransportEvent): string {
  if (ev.kind === 'bass') return `${cycle}|b|${ev.slot}|${ev.midi}`;
  if (ev.kind === 'melody') return `${cycle}|m|${ev.slot}|${ev.midi}`;
  if (ev.kind === 'guitar') return `${cycle}|g|${ev.slot}|${ev.midi}`;
  if (ev.kind === 'sample') return `${cycle}|s|${ev.slot}|${ev.midis.join('.')}`;
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
  | { kind: 'chord'; slot: number; midis: number[]; sustainSlots: number; vel: number }
  | { kind: 'sample'; slot: number; midis: number[]; sustainSlots: number; vel: number }
  | { kind: 'guitar'; slot: number; midi: number; sustainSlots: number; vel: number };

const GROOVE_TRANSPORT_KIND_ORDER: Record<GrooveLabTransportEvent['kind'], number> = {
  bass: 0,
  chord: 1,
  sample: 2,
  guitar: 3,
  melody: 4,
};

/** Build loop events from SUB + CHORD + SAMPLE + MELODY + GUITAR work channels. */
export function buildGrooveLabTransportEvents(
  subHits: GrooveRollHit[],
  chordHits: GrooveRollHit[],
  melodyHits: GrooveRollHit[] = [],
  quantize?: GrooveLabQuantize,
  guitarHits: GrooveRollHit[] = [],
  sampleHits: GrooveRollHit[] = [],
): GrooveLabTransportEvent[] {
  const q = quantize ?? GROOVE_LAB_QUANTIZE_DEFAULT;

  const subs = subHits.filter((h) => grooveLabIsBassSubMidi(h.midi));
  const leads = melodyHits.filter((h) => waveLeafIsLeadMidi(h.midi) || grooveLabIsMelodyMidi(h.midi));
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

  const chordStacks = grooveLabChordAttackStacks(chordHits, { quantize: q });
  for (const stack of chordStacks) {
    if (stack.midis.length === 0) continue;
    events.push({
      kind: 'chord',
      slot: stack.slot,
      midis: stack.midis,
      sustainSlots: stack.sustainSlots,
      vel: stack.vel,
    });
  }

  const sampleStacks = grooveLabChordAttackStacks(sampleHits, { quantize: q });
  for (const stack of sampleStacks) {
    if (stack.midis.length === 0) continue;
    events.push({
      kind: 'sample',
      slot: stack.slot,
      midis: stack.midis,
      sustainSlots: stack.sustainSlots,
      vel: stack.vel,
    });
  }

  for (const h of guitarHits.filter((hit) => grooveLabIsGuitarMidi(hit.midi))) {
    events.push({
      kind: 'guitar',
      slot: h.slot,
      midi: h.midi,
      sustainSlots: h.sustainSlots,
      vel: h.vel,
    });
  }

  events.sort(
    (a, b) =>
      a.slot - b.slot ||
      GROOVE_TRANSPORT_KIND_ORDER[a.kind] - GROOVE_TRANSPORT_KIND_ORDER[b.kind],
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
  for (const stack of chordStacks) {
    if (stack.midis.length === 0) continue;
    events.push({
      kind: 'chord',
      slot: stack.slot,
      midis: stack.midis,
      sustainSlots: stack.sustainSlots,
      vel: stack.vel,
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
  for (const h of guitarHits.filter((hit) => grooveLabIsGuitarMidi(hit.midi))) {
    events.push({
      kind: 'guitar',
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
    guitarSoundId?: GrooveLabAnyLeadSoundId | string | null;
    guitarFx?: GrooveLabGuitarFxSettings;
    guitarChannel?: number;
    chordChannel?: number;
    melodyChannel?: number;
    sampleChannel?: number;
    orchestraHitId?: OrchestraHitId | string;
    leadMuted?: boolean;
    channelVolumes?: Record<number, number>;
  },
): void {
  const holdBeats = Math.max(0.35, (ev.sustainSlots * opts.secPerSlot * opts.bpm) / 60);
  const sustainSec = (ev.sustainSlots * opts.secPerSlot) * 0.92;

  if (ev.kind === 'guitar') {
    if (opts.guitarChannel == null || !Number.isFinite(opts.guitarChannel)) return;
    if (!grooveLabChannelTransportOpen(opts.guitarChannel, opts.channelVolumes)) return;
    const soundId = resolveGrooveLabGuitarSoundId(opts.guitarSoundId);
    if (isGuitarLickSampleId(soundId)) {
      const def = getGuitarLickDef(soundId);
      if (def) void ensureGuitarLickBuffer(ctx, def);
    }
    const lickBar = isGuitarLickSampleId(soundId);
    const guitarSus = lickBar
      ? Math.min(8, Math.max(0.45, ev.sustainSlots * opts.secPerSlot * 0.98))
      : Math.min(2.8, Math.max(0.28, ev.sustainSlots * opts.secPerSlot * 0.96));
    scheduleGrooveLabGuitarTransportHit(ctx, {
      midi: ev.midi,
      soundId,
      when,
      velocity01: Math.min(1, Math.max(0.05, ev.vel)) * 0.9,
      bpm: opts.bpm,
      sustainSec: guitarSus,
      guitarFx: opts.guitarFx,
      guitarChannel: opts.guitarChannel,
      channelVolumes: opts.channelVolumes,
    });
    return;
  }

  if (ev.kind === 'bass') {
    if (opts.bassMuted) return;
    playGrooveLabBassSound(ctx, ev.midi, opts.bassSoundId, when, ev.vel * 0.92, opts.bpm, holdBeats, {
      monophonic: false,
    });
    return;
  }
  if (ev.kind === 'melody') {
    if (opts.leadMuted || !(waveLeafIsLeadMidi(ev.midi) || grooveLabIsMelodyMidi(ev.midi))) return;
    const wl = readWaveLeafSynthSettings();
    const melodyCh = opts.melodyChannel;
    if (melodyCh == null || !Number.isFinite(melodyCh)) return;
    if (!grooveLabChannelTransportOpen(melodyCh, opts.channelVolumes)) return;
    const dest = resolveGrooveLabChannelDest(ctx, melodyCh, opts.channelVolumes);
    const whenLead = when - WAVE_LEAF_TRANSPORT_ONSET_LEAD_MS / 1000;
    const vel = Math.min(1, Math.max(0.05, ev.vel));
    playWaveLeafNote(ctx, ev.midi, whenLead, {
      preset: wl.preset,
      glideMs: wl.glideMs,
      brightness: wl.brightness,
      warmth: wl.warmth,
      drive: wl.drive,
      vibratoDepthCents: wl.vibratoDepthCents,
      bpm: opts.bpm,
      holdBeats,
      velocity: vel,
      outputGain: grooveLabWaveLeafBankOutputGain(readWaveLeafOutputGain()),
      destination: dest,
      monophonic: true,
      transportChordSnap: true,
    });
    scheduleGrooveLabMeterPulseAt(
      ctx,
      melodyCh,
      grooveLabMeterPeakFromVelocity(vel, melodyCh, opts.channelVolumes),
      0,
      whenLead,
    );
    return;
  }
  if (ev.kind === 'chord') {
    if (opts.chordsMuted || opts.chordVolume <= 0.02) return;
    const chordCh = opts.chordChannel;
    if (
      chordCh != null &&
      Number.isFinite(chordCh) &&
      !grooveLabChannelTransportOpen(chordCh, opts.channelVolumes)
    ) {
      return;
    }
    restoreChordSequencerTransportVoices();
    const vel = opts.chordVolume * ev.vel;
    const scheduleChord = () =>
      scheduleOrchidChord(ctx, ev.midis, when, sustainSec, opts.chordVoice, vel, {
        mode: 'block',
        bpm: opts.bpm,
      });
    if (chordCh != null && Number.isFinite(chordCh)) {
      const chordDest = resolveGrooveLabChannelDest(ctx, chordCh, opts.channelVolumes);
      withGrooveLabTransportChordRouting(ctx, scheduleChord, chordDest);
      scheduleGrooveLabMeterPulseAt(
        ctx,
        chordCh,
        grooveLabMeterPeakFromVelocity(vel, chordCh, opts.channelVolumes),
        0,
        when,
      );
    } else {
      scheduleChord();
    }
    return;
  }

  if (ev.kind !== 'sample') return;
  const sampleCh = opts.sampleChannel;
  if (sampleCh == null || !Number.isFinite(sampleCh)) return;
  if (!grooveLabChannelTransportOpen(sampleCh, opts.channelVolumes)) return;
  const hitId = resolveGrooveLabOrchestraHitId(opts.orchestraHitId);
  const def = getOrchestraHitDef(hitId);
  if (def) void ensureOrchestraHitBuffer(ctx, def);
  const vel = Math.min(1, Math.max(0.05, ev.vel));
  const targetMidi = ev.midis.length > 0 ? Math.min(...ev.midis) : undefined;
  scheduleGrooveLabOrchestraTransportHit(ctx, {
    hitId,
    when,
    velocity01: vel,
    orchestraChannel: sampleCh,
    channelVolumes: opts.channelVolumes,
    targetMidi,
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
  guitarSoundId?: GrooveLabAnyLeadSoundId | string | null;
  guitarFx?: GrooveLabGuitarFxSettings;
  guitarChannel?: number;
  chordChannel?: number;
  melodyChannel?: number;
  sampleChannel?: number;
  orchestraHitId?: OrchestraHitId | string;
  leadMuted?: boolean;
  channelVolumes?: Record<number, number>;
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
  if (!isGrooveLabTransportRunning()) return;

  if (evs.some((ev) => ev.kind === 'chord')) {
    restoreChordSequencerTransportVoices();
  }

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
    guitarSoundId: opts.guitarSoundId,
    guitarFx: opts.guitarFx,
    guitarChannel: opts.guitarChannel,
    chordChannel: opts.chordChannel,
    melodyChannel: opts.melodyChannel,
    sampleChannel: opts.sampleChannel,
    orchestraHitId: opts.orchestraHitId,
    leadMuted: opts.leadMuted,
    channelVolumes: opts.channelVolumes,
  };

  for (let cycle = cycleNow; cycle <= cycleNow + 2 && scheduled < GROOVE_LAB_MAX_SCHEDULE_PER_REFILL; cycle++) {
    const slotWhen = new Map<number, number>();
    for (const ev of evs) {
      const key = grooveLabTransportEventKey(cycle, ev);
      if (firedKeys.has(key)) continue;

      const delta = (ev.slot - opts.seekSlot + opts.loopSlots) % opts.loopSlots;
      const t = sessionStart + cycle * loopSec + delta * opts.secPerSlot;

      if (t >= horizon) continue;

      let when = slotWhen.get(ev.slot);
      if (when === undefined) {
        when = Math.max(t, chain);
        slotWhen.set(ev.slot, when);
      }
      if (when < now - 0.08) continue;
      try {
        scheduleGrooveLabTransportEvent(ctx, when, ev, schedOpts);
      } catch {
        continue;
      }
      firedKeys.add(key);
      chain = Math.max(chain, when + CREATION_METRO_NODE_EPS_SEC);
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
  guitarHits: GrooveRollHit[] = [],
  opts: {
    bpm: number;
    bassSoundId: GrooveLabBassSoundId;
    melodySoundId?: GrooveLabBassSoundId;
    chordVoice: ChordVoiceId;
    chordVolume: number;
    chordsMuted: boolean;
    bassMuted?: boolean;
    leadMuted?: boolean;
    perfMode: OrchidPerformanceMode;
    startDelaySec?: number;
    chordChannel?: number;
    melodyChannel?: number;
    guitarChannel?: number;
    guitarSoundId?: GrooveLabAnyLeadSoundId | string | null;
    guitarFx?: GrooveLabGuitarFxSettings;
    channelVolumes?: Record<number, number>;
  },
): void {
  const events = buildGrooveLabTransportEvents(
    subHits,
    chordHits,
    melodyHits,
    undefined,
    guitarHits,
  );
  if (events.length === 0) return;
  const secPerSlot = grooveLabSecPerSlot(opts.bpm);
  const t0 = ctx.currentTime + (opts.startDelaySec ?? GROOVE_LAB_TRANSPORT_AUDIO_FLOOR_SEC);
  let chain = t0 + SE2_AUDIO_START_FLOOR_SEC;
  const slotWhen = new Map<number, number>();
  const schedOpts = {
    bpm: opts.bpm,
    secPerSlot,
    bassSoundId: opts.bassSoundId,
    melodySoundId: opts.melodySoundId ?? opts.bassSoundId,
    chordVoice: opts.chordVoice,
    chordVolume: opts.chordVolume,
    chordsMuted: opts.chordsMuted,
    bassMuted: opts.bassMuted,
    leadMuted: opts.leadMuted,
    perfMode: opts.perfMode,
    chordChannel: opts.chordChannel,
    melodyChannel: opts.melodyChannel,
    guitarSoundId: opts.guitarSoundId,
    guitarFx: opts.guitarFx,
    guitarChannel: opts.guitarChannel,
    channelVolumes: opts.channelVolumes,
  };
  for (const ev of events) {
    const t = t0 + ev.slot * secPerSlot;
    let when = slotWhen.get(ev.slot);
    if (when === undefined) {
      when = Math.max(t, chain);
      slotWhen.set(ev.slot, when);
      chain = when + CREATION_METRO_NODE_EPS_SEC;
    }
    scheduleGrooveLabTransportEvent(ctx, when, ev, schedOpts);
  }
}
