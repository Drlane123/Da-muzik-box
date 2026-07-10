/**
 * Groove Lead — pocket (Gaussian micro-timing), back-to-back durations, soft attack metadata.
 */
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import {
  grooveLeadCollapseDuplicatePitches,
  GROOVE_LEAD_POP_MAX_BEATS,
} from '@/app/lib/studio/se2GrooveLeadMelodicFlow';

const MIDI_PPQ = 480;
const POCKET_MS_MIN = 8;
const POCKET_MS_MAX = 22;
const POCKET_MS_MEAN = 15;
const POCKET_MS_STDDEV = 3.8;
const ATTACK_MS_MIN = 30;
const ATTACK_MS_MAX = 70;

export const GROOVE_LEAD_MAIN_VEL = 95;
export const GROOVE_LEAD_GHOST_VEL_MIN = 60;
export const GROOVE_LEAD_GHOST_VEL_MAX = 75;
export const GROOVE_LEAD_GRACE_VEL_MIN = 58;

/** Box–Muller — human micro-timing, not linear. */
export function grooveLeadGaussian(rnd: () => number): number {
  let u = 0;
  let v = 0;
  while (u <= 1e-10) u = rnd();
  while (v <= 1e-10) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Late pocket offset in beats (8–22 ms Gaussian at any BPM). */
export function grooveLeadPocketOffsetBeats(bpm: number, rnd: () => number): number {
  const ms = Math.max(
    POCKET_MS_MIN,
    Math.min(POCKET_MS_MAX, POCKET_MS_MEAN + grooveLeadGaussian(rnd) * POCKET_MS_STDDEV),
  );
  const beats = (ms / 1000) * (bpm / 60);
  const ticks = Math.round(beats * MIDI_PPQ);
  const tickBeats = ticks / MIDI_PPQ;
  return Math.max(POCKET_MS_MIN / 1000 / (60 / bpm), tickBeats);
}

export function grooveLeadMainVelocity(rnd: () => number): number {
  return Math.min(100, GROOVE_LEAD_MAIN_VEL - Math.floor(rnd() * 6));
}

export function grooveLeadGhostVelocity(rnd: () => number): number {
  const span = GROOVE_LEAD_GHOST_VEL_MAX - GROOVE_LEAD_GHOST_VEL_MIN;
  return GROOVE_LEAD_GHOST_VEL_MIN + Math.floor(rnd() * (span + 1));
}

export function grooveLeadSoftAttackSec(rnd: () => number): number {
  const ms = ATTACK_MS_MIN + rnd() * (ATTACK_MS_MAX - ATTACK_MS_MIN);
  return ms / 1000;
}

/** Gaussian late-offset on every note-on (the pocket). */
export function grooveLeadApplyPocket(
  notes: StudioEditor2GenNote[],
  bpm: number,
  rnd: () => number,
): StudioEditor2GenNote[] {
  return notes.map((n) => ({
    ...n,
    startBeat: n.startBeat + grooveLeadPocketOffsetBeats(bpm, rnd),
  }));
}

/** Tiny breath between consecutive notes — no temporal overlap (poly-friendly). */
export const GROOVE_LEAD_BACK_TO_BACK_GAP_BEATS = 0.03;

/** Legato bleed past the next note-on — guitar finger-off fade (poly-friendly). */
const LEGATO_BLEED_MIN = 0.07;
const LEGATO_BLEED_MAX = 0.16;

function isGrooveLeadOrnamentalPop(note: StudioEditor2GenNote): boolean {
  return note.durationBeats <= GROOVE_LEAD_POP_MAX_BEATS && note.velocity >= GROOVE_LEAD_GHOST_VEL_MAX;
}

/**
 * Solo-guitar legato — most notes ring through to the next pitch; rare pops stay short.
 */
export function grooveLeadApplyGuitarLegato(
  notes: StudioEditor2GenNote[],
  totalBeats: number,
  rnd: () => number,
): StudioEditor2GenNote[] {
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  const out = sorted.map((n) => ({ ...n }));
  const phraseEnd = totalBeats - 0.02;

  for (let i = 0; i < out.length; i += 1) {
    const cur = out[i]!;
    const next = out[i + 1];
    const prev = i > 0 ? out[i - 1]! : null;

    if (cur.velocity < GROOVE_LEAD_GHOST_VEL_MAX) {
      continue;
    }

    if (isGrooveLeadOrnamentalPop(cur)) {
      if (next) {
        const span = next.startBeat - cur.startBeat;
        cur.durationBeats = Math.min(cur.durationBeats, Math.max(0.1, span * 0.7));
      }
      continue;
    }

    const bleed = LEGATO_BLEED_MIN + rnd() * (LEGATO_BLEED_MAX - LEGATO_BLEED_MIN);
    const newPhrase = prev != null && cur.startBeat - prev.startBeat > 1.05;

    if (next && next.startBeat - cur.startBeat < 1.2) {
      const span = next.startBeat - cur.startBeat;
      cur.durationBeats = Math.max(0.8, span + bleed);
    } else if (next) {
      const span = next.startBeat - cur.startBeat;
      cur.durationBeats = Math.max(newPhrase ? 1.1 : 0.95, span * 0.94 + bleed);
    } else {
      cur.durationBeats = Math.max(
        1.35,
        Math.min(2.6 + rnd() * 0.5, phraseEnd - cur.startBeat),
      );
    }
  }

  return out;
}

/** Soft breathy attack — per-note amp ramp + optional expression curve for export. */
export function grooveLeadApplySoftAttack(
  notes: StudioEditor2GenNote[],
  rnd: () => number,
): StudioEditor2GenNote[] {
  return notes.map((n) => {
    const attackSec = grooveLeadSoftAttackSec(rnd);
    const attackBeats = Math.min(n.durationBeats * 0.35, attackSec * 2);
    return {
      ...n,
      attackSec,
      expressionCurve: [
        { beatOffset: 0, value: 0.12 },
        { beatOffset: attackBeats, value: 1 },
      ],
    };
  });
}

export type GrooveLeadNoteRole = 'main' | 'ghost' | 'grace';

export function grooveLeadFinalizeNotes(
  notes: StudioEditor2GenNote[],
  opts: {
    bpm: number;
    totalBeats: number;
    rnd: () => number;
    maxPerBar?: number;
    beatsPerBar?: number;
    /** No pocket delay — first note lands on chord/bar downbeat. */
    lockToChordDownbeat?: boolean;
  },
): StudioEditor2GenNote[] {
  let out = [...notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);

  if (opts.maxPerBar != null && opts.beatsPerBar != null) {
    const bpb = opts.beatsPerBar;
    const byBar = new Map<number, StudioEditor2GenNote[]>();
    for (const n of out) {
      const bar = Math.floor(n.startBeat / bpb);
      const list = byBar.get(bar) ?? [];
      list.push(n);
      byBar.set(bar, list);
    }
    out = [];
    for (const [, barNotes] of byBar) {
      const sorted = [...barNotes].sort((a, b) => a.startBeat - b.startBeat);
      const kept =
        sorted.length <= opts.maxPerBar!
          ? sorted
          : sorted.filter((_, i) => i === 0 || i >= sorted.length - (opts.maxPerBar! - 1));
      out.push(...kept);
    }
    out.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  }

  out = opts.lockToChordDownbeat ? out : grooveLeadApplyPocket(out, opts.bpm, opts.rnd);
  out = grooveLeadApplyGuitarLegato(out, opts.totalBeats, opts.rnd);
  out = grooveLeadApplySoftAttack(out, opts.rnd);
  return grooveLeadCollapseDuplicatePitches(out);
}
