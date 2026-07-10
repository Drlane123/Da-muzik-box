/**
 * Touch-sensitive velocity + polyphonic strum spread for guitar preview / transport.
 * Prevents chord clusters from hitting at once at full velocity (clatter / clipping).
 */

export type Se2GuitarPlaybackNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

const CHORD_CLUSTER_EPS = 0.006;
const DEFAULT_STRUM_SPREAD_BEATS = 0.032;

/** Gentle peak compression — keeps dynamics but leaves headroom on dense parts. */
export function se2GuitarShapePlaybackVelocity(velocity127: number): number {
  const v = Math.max(1, Math.min(127, Math.round(velocity127)));
  if (v <= 48) return v;
  return Math.max(36, Math.min(108, Math.round(44 + (v - 44) * 0.68)));
}

/** Per-string touch curve inside a strum — bass slightly stronger, treble lighter. */
export function se2GuitarTouchVelocity(
  baseVelocity: number,
  stringIndex: number,
  stringCount: number,
  cap = 104,
): number {
  const shaped = se2GuitarShapePlaybackVelocity(baseVelocity);
  if (stringCount <= 1) {
    const human = (Math.random() * 5 - 2.5);
    return Math.max(34, Math.min(cap, Math.round(shaped + human)));
  }
  const center = (stringCount - 1) / 2;
  const roleBias = (center - stringIndex) * 3.5;
  const human = Math.random() * 4 - 2;
  return Math.max(34, Math.min(cap, Math.round(shaped + roleBias + human)));
}

/**
 * Spread simultaneous notes into a low→high strum and shape velocities.
 * Keeps smplr polyphonic voices distinct instead of one loud cluster.
 */
export function se2GuitarHumanizePolyNotes(
  notes: readonly Se2GuitarPlaybackNote[],
  opts?: { strumSpreadBeats?: number; velocityCap?: number },
): Se2GuitarPlaybackNote[] {
  if (notes.length === 0) return [];
  const spread = opts?.strumSpreadBeats ?? DEFAULT_STRUM_SPREAD_BEATS;
  const cap = opts?.velocityCap ?? 104;
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  const out: Se2GuitarPlaybackNote[] = [];

  let i = 0;
  while (i < sorted.length) {
    const anchor = sorted[i]!;
    const cluster: Se2GuitarPlaybackNote[] = [anchor];
    let j = i + 1;
    while (j < sorted.length && sorted[j]!.startBeat - anchor.startBeat < CHORD_CLUSTER_EPS) {
      cluster.push(sorted[j]!);
      j += 1;
    }

    if (cluster.length > 1) {
      const byPitch = [...cluster].sort((a, b) => a.pitch - b.pitch);
      byPitch.forEach((n, idx) => {
        out.push({
          ...n,
          startBeat: anchor.startBeat + idx * spread,
          velocity: se2GuitarTouchVelocity(n.velocity, idx, byPitch.length, cap),
        });
      });
    } else {
      out.push({
        ...anchor,
        velocity: se2GuitarTouchVelocity(anchor.velocity, 0, 1, cap),
      });
    }
    i = j;
  }

  return out;
}
