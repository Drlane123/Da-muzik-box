/**
 * Raw MIDI byte stream for Groove Lead — legato overlap, pocket jitter, breath gaps.
 * SMF export + hardware reference (mirrors Wave Leads PRO legato feel).
 */
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import { grooveLeadGaussian } from '@/app/lib/studio/se2GrooveLeadPocket';

const MIDI_PPQ = 480;
const LEGATO_ON_RATIO = 0.9;
const OVERLAP_TICKS_MIN = 10;
const OVERLAP_TICKS_MAX = 20;
const BREATH_AFTER_NOTE_ONS = 5;
const ANCHOR_VEL_MIN = 0x5a;
const ANCHOR_VEL_MAX = 0x69;
const PASSING_VEL_MIN = 0x3c;
const PASSING_VEL_MAX = 0x4b;
const POCKET_TICKS_MIN = 10;
const POCKET_TICKS_MAX = 30;

export type GrooveLeadMidiPacket = {
  deltaTicks: number;
  status: number;
  data1: number;
  data2: number;
};

export type GrooveLeadMidiStreamOpts = {
  notes: readonly StudioEditor2GenNote[];
  ticksPerQuarter?: number;
  channel?: number;
  bpm?: number;
  beatsPerBar?: number;
  chordChangeBeats?: readonly number[];
  seed?: number;
};

type AbsEv = { tick: number; order: number; bytes: [number, number, number] };

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clampByte(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function scaleVelocity(note: StudioEditor2GenNote, rnd: () => number): number {
  const isPassing = note.velocity < 78;
  if (isPassing) {
    return clampByte(
      PASSING_VEL_MIN + Math.floor(rnd() * (PASSING_VEL_MAX - PASSING_VEL_MIN + 1)),
      PASSING_VEL_MIN,
      PASSING_VEL_MAX,
    );
  }
  return clampByte(
    ANCHOR_VEL_MIN + Math.floor(rnd() * (ANCHOR_VEL_MAX - ANCHOR_VEL_MIN + 1)),
    ANCHOR_VEL_MIN,
    ANCHOR_VEL_MAX,
  );
}

function pocketTicks(rnd: () => number): number {
  const g = grooveLeadGaussian(rnd);
  const t = 20 + g * 5;
  return Math.max(POCKET_TICKS_MIN, Math.min(POCKET_TICKS_MAX, Math.round(t)));
}

function overlapTicks(rnd: () => number): number {
  return OVERLAP_TICKS_MIN + Math.floor(rnd() * (OVERLAP_TICKS_MAX - OVERLAP_TICKS_MIN + 1));
}

function beatToTick(beat: number, tpq: number): number {
  return Math.max(0, Math.round(beat * tpq));
}

function pushEv(out: AbsEv[], tick: number, order: number, bytes: [number, number, number]): void {
  out.push({ tick, order, bytes });
}

/**
 * Build absolute-tick events with legato overlap interleaving:
 * Note1 On → Note2 On (90%) → Note1 Off (after 10–20 tick overlap).
 */
export function grooveLeadBuildMidiAbsoluteEvents(opts: GrooveLeadMidiStreamOpts): AbsEv[] {
  const tpq = opts.ticksPerQuarter ?? MIDI_PPQ;
  const ch = (opts.channel ?? 0) & 0x0f;
  const rnd = mulberry32(opts.seed ?? 0x57415645);
  const bpb = Math.max(1, opts.beatsPerBar ?? 4);
  const breathGap = Math.round(tpq * bpb * 0.75);
  const chordChanges = new Set((opts.chordChangeBeats ?? []).map((b) => Math.round(b * 1000)));

  const sorted = [...opts.notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  const events: AbsEv[] = [];
  let noteOnStreak = 0;
  let timeShift = 0;
  let order = 0;

  for (let i = 0; i < sorted.length; i += 1) {
    const cur = sorted[i]!;
    const next = sorted[i + 1];
    const pitch = clampByte(cur.pitch, 0, 127);
    const vel = scaleVelocity(cur, rnd);

    if (noteOnStreak >= BREATH_AFTER_NOTE_ONS) {
      timeShift += breathGap;
      noteOnStreak = 0;
    }

    let startTick = beatToTick(cur.startBeat, tpq) + timeShift;
    const beatKey = Math.round(cur.startBeat * 1000);
    if (chordChanges.has(beatKey) || (i === 0 && chordChanges.size === 0 && cur.startBeat < 0.05)) {
      startTick += pocketTicks(rnd);
    }

    if (next) {
      const durTicks = Math.max(1, beatToTick(cur.durationBeats, tpq));
      const note2OnTick = startTick + Math.floor(durTicks * LEGATO_ON_RATIO);
      const note1OffTick = note2OnTick + overlapTicks(rnd);
      const n2pitch = clampByte(next.pitch, 0, 127);
      const n2vel = scaleVelocity(next, rnd);

      pushEv(events, startTick, order++, [0x90 | ch, pitch, vel]);
      noteOnStreak += 1;
      pushEv(events, note2OnTick, order++, [0x90 | ch, n2pitch, n2vel]);
      noteOnStreak += 1;
      pushEv(events, note1OffTick, -order, [0x80 | ch, pitch, 0]);

      const lastDur = Math.max(1, beatToTick(next.durationBeats, tpq));
      pushEv(events, note2OnTick + lastDur, -order - 1, [0x80 | ch, n2pitch, 0]);
      i += 1;
    } else {
      const durTicks = Math.max(1, beatToTick(cur.durationBeats, tpq));
      pushEv(events, startTick, order++, [0x90 | ch, pitch, vel]);
      noteOnStreak += 1;
      pushEv(events, startTick + durTicks, -order, [0x80 | ch, pitch, 0]);
    }
  }

  events.sort((a, b) => (a.tick !== b.tick ? a.tick - b.tick : a.order - b.order));
  return events;
}

export function grooveLeadAbsoluteEventsToDeltaPackets(events: readonly AbsEv[]): GrooveLeadMidiPacket[] {
  const out: GrooveLeadMidiPacket[] = [];
  let last = 0;
  for (const ev of events) {
    const delta = Math.max(0, ev.tick - last);
    out.push({ deltaTicks: delta, status: ev.bytes[0], data1: ev.bytes[1], data2: ev.bytes[2] });
    last = ev.tick;
  }
  return out;
}

export function grooveLeadNotesToMidiPackets(opts: GrooveLeadMidiStreamOpts): GrooveLeadMidiPacket[] {
  return grooveLeadAbsoluteEventsToDeltaPackets(grooveLeadBuildMidiAbsoluteEvents(opts));
}
