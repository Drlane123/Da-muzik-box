/**
 * Melodic flow — no consecutive duplicate pitches, merge same-key re-triggers.
 */
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';

/** Drop or merge back-to-back same MIDI pitch (fixes dot-dot-dot on one key). */
export function grooveLeadCollapseDuplicatePitches(
  notes: readonly StudioEditor2GenNote[],
): StudioEditor2GenNote[] {
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  const out: StudioEditor2GenNote[] = [];

  for (const n of sorted) {
    const prev = out[out.length - 1];
    if (prev && prev.pitch === n.pitch) {
      const spanEnd = Math.max(prev.startBeat + prev.durationBeats, n.startBeat + n.durationBeats);
      prev.durationBeats = Math.max(prev.durationBeats, spanEnd - prev.startBeat);
      prev.velocity = Math.max(prev.velocity, n.velocity);
      if (n.flexCurve?.length && !prev.flexCurve?.length) prev.flexCurve = n.flexCurve;
      if (n.attackSec != null && prev.attackSec == null) prev.attackSec = n.attackSec;
      continue;
    }
    out.push({ ...n });
  }

  return out;
}

/** Minimum semitone distance from `from` among chord tones, excluding same pitch. */
export function grooveLeadPickDistinctTone(
  from: number | null,
  tones: readonly number[],
  rnd: () => number,
  preferHigher?: boolean,
): number {
  if (tones.length === 0) return from ?? 76;
  if (from == null) {
    const idx = tones.length > 1 ? 1 + Math.floor(rnd() * (tones.length - 1)) : 0;
    return tones[Math.min(idx, tones.length - 1)]!;
  }

  const others = tones.filter((t) => t !== from);
  if (others.length === 0) {
    const octave = from + (preferHigher !== false ? 12 : -12);
    return Math.max(48, Math.min(96, octave));
  }

  let pool = others;
  if (preferHigher !== undefined) {
    const hi = others.filter((t) => t > from);
    const lo = others.filter((t) => t < from);
    pool = preferHigher ? (hi.length ? hi : lo) : lo.length ? lo : hi;
    if (pool.length === 0) pool = others;
  }

  let best = pool[0]!;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const t of pool) {
    const leap = Math.abs(t - from);
    let score = leap;
    if (leap <= 2) score -= 4;
    if (leap === 0) score += 100;
    score += rnd() * 1.2;
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

/**
 * Walk 2–3 chord tones — stepwise guitar solo line, not a run of stabs.
 */
export function grooveLeadBuildMelodicPath(
  tones: readonly number[],
  lastPitch: number | null,
  regionIndex: number,
  rnd: () => number,
): number[] {
  if (tones.length === 0) return lastPitch != null ? [lastPitch] : [76];

  let noteCount = 2 + ((regionIndex + Math.floor(rnd() * 2)) % 2);
  if (rnd() > 0.82) noteCount = 3;
  if (rnd() > 0.94) noteCount = 4;

  const path: number[] = [];
  let cur: number | null = lastPitch;
  const riseFirst = regionIndex % 3 !== 1;

  for (let i = 0; i < noteCount; i += 1) {
    const preferHigher = riseFirst ? i < Math.ceil(noteCount / 2) : i >= Math.floor(noteCount / 2);
    const next = grooveLeadPickDistinctTone(cur, tones, rnd, preferHigher);
    if (path.length > 0 && next === path[path.length - 1]) {
      const alt = grooveLeadPickDistinctTone(next, tones, rnd, !preferHigher);
      path.push(alt);
      cur = alt;
    } else {
      path.push(next);
      cur = next;
    }
  }

  return path;
}

/** Notes shorter than this are rare hammer-on pops; everything else is a held legato tone. */
export const GROOVE_LEAD_POP_MAX_BEATS = 0.34;

export const GROOVE_LEAD_SUSTAIN_MIN_BEATS = 0.65;

export function grooveLeadIsSustainDuration(durationBeats: number): boolean {
  return durationBeats > GROOVE_LEAD_POP_MAX_BEATS;
}

/** Rare ornamental pop — at most one per phrase, never the opening or closing tone. */
export function grooveLeadDurationForPhraseNote(
  pi: number,
  pathLen: number,
  _regionSpanBeats: number,
  rnd: () => number,
): number {
  const popSlot =
    pathLen >= 4 ? 1 + Math.floor(rnd() * Math.max(1, pathLen - 2)) : pathLen >= 3 ? 1 : -1;
  if (popSlot > 0 && pi === popSlot && pi < pathLen - 1 && rnd() > 0.58) {
    return 0.1 + rnd() * 0.14;
  }
  return 1.35 + rnd() * 0.45;
}

/** Guitar solo spacing — quarter / dotted-quarter flow, not clustered stabs. */
export function grooveLeadPhraseOffsets(
  regionIndex: number,
  noteCount: number,
  beatsPerBar: number,
  rnd: () => number,
): number[] {
  const bpb = Math.max(1, beatsPerBar);
  const templates: number[][] = [
    [0, 1.0, 2.0, 3.0],
    [0, 0.75, 1.75, 2.75, 3.75],
    [0, 1.25, 2.5, 3.75],
    [0, 1.0, 2.25, 3.5],
    [0, 1.5, 3.0],
    [0, 0.5, 1.5, 2.5, 3.5],
  ];
  const base = templates[(regionIndex + Math.floor(rnd() * templates.length)) % templates.length]!;
  const scale = bpb / 4;
  const jitter = () => (rnd() - 0.5) * 0.04;
  return base.slice(0, noteCount).map((b) => b * scale + jitter());
}
