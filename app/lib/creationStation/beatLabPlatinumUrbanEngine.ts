/**
 * Platinum-tier urban drum grid engine — modern Trap, Hip-Hop, R&B / Trapsoul, Pop.
 *
 * Row layout: 0=Kick  1=Snare  2=Clap  3=Hi-Hat  4=Open Hat  5=TomHi  6=808  7=Rim/Perc
 * Steps 0,4,8,12 = beats 1–4 · steps 2,6,10,14 = off-beats (&).
 *
 * Velocity tiers (for MIDI export / future per-step maps):
 *   Downbeat kick/snare 111–127 · Regular hats 70–90 · Stutter rolls 50–70
 */

export const PLATINUM_VEL_DOWNBEAT = { min: 0x6f, max: 0x7f } as const;
export const PLATINUM_VEL_HAT = { min: 0x46, max: 0x5a } as const;
export const PLATINUM_VEL_STUTTER = { min: 0x32, max: 0x46 } as const;

const S = 16;
const OFFBEATS = [2, 6, 10, 14] as const;

/** Seeded LCG — deterministic stutter picks per preset id. */
export function platinumSeededRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function kicks(...steps: number[]): ReadonlyArray<[number, number]> {
  return steps.map((s) => [0, s] as [number, number]);
}

function body808(...steps: number[]): ReadonlyArray<[number, number]> {
  return steps.map((s) => [6, s] as [number, number]);
}

function hats(...steps: number[]): ReadonlyArray<[number, number]> {
  return steps.map((s) => [3, s] as [number, number]);
}

// ── 1. Modern Trap & Hip-Hop (130–150 BPM producer grid, halftime feel) ───────

/** Halftime snare/clap — ONLY beat 3. Beats 2 & 4 are banned. */
export function platinumHalftimeSnareStack(): ReadonlyArray<[number, number]> {
  return [
    [1, 8],
    [2, 8],
  ];
}

/** Syncopated trap kick — never mirrors 808 off-beat grid. */
export function platinumTrapKickPocket(variant: 'metro' | 'south' | 'slide' = 'metro'): ReadonlyArray<[number, number]> {
  switch (variant) {
    case 'south':
      return kicks(0, 3, 7, 11, 15);
    case 'slide':
      return kicks(0, 5, 9, 13, 15);
    default:
      return kicks(0, 5, 9, 14);
  }
}

/**
 * 808 syncopation — hard on beat 1, then exclusively on off-beats.
 * Never copies kick steps after the downbeat anchor.
 */
export function platinum808OffbeatSync(
  kickSteps: ReadonlyArray<number>,
  extraOffbeats: ReadonlyArray<number> = OFFBEATS,
): ReadonlyArray<[number, number]> {
  const kickSet = new Set(kickSteps);
  const out: [number, number][] = [[6, 0]];
  for (const s of extraOffbeats) {
    if (s === 0) continue;
    if (kickSet.has(s)) continue;
    out.push([6, s]);
  }
  return out;
}

export type PlatinumStutterMode = '32nd' | 'triplet';

export interface PlatinumHatStutterOpts {
  /** Preset id or numeric seed for reproducible rolls. */
  seed: string | number;
  /** Active 16th hat steps before stutter injection. */
  baseSteps?: ReadonlyArray<number>;
  /** Fraction of active steps to subdivide (default 0.2). */
  stutterRatio?: number;
  /** Skip steps adjacent to halftime snare on beat 3 for pocket. */
  snareStep?: number;
}

/**
 * Dynamic hi-hat stutter engine — 16th base grid, ~20% steps get 32nd or triplet bursts.
 * Simulated on 16-step grid via consecutive 16ths (roll decay noted in velocity tier).
 */
export function platinumHatStutterEngine(opts: PlatinumHatStutterOpts): ReadonlyArray<[number, number]> {
  const base =
    opts.baseSteps ??
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const ratio = opts.stutterRatio ?? 0.2;
  const snareStep = opts.snareStep ?? 8;
  const seed = typeof opts.seed === 'string' ? hashSeed(opts.seed) : opts.seed;
  const rng = platinumSeededRng(seed);

  const active = base.filter((s) => s >= 0 && s < S);
  const pickCount = Math.max(1, Math.round(active.length * ratio));
  const shuffled = [...active].sort(() => rng() - 0.5);
  const stutterRoots = new Set(shuffled.slice(0, pickCount));

  const hitSet = new Set<number>(active);
  for (const root of stutterRoots) {
    if (root === snareStep || root === snareStep - 1) continue;
    const mode: PlatinumStutterMode = rng() < 0.55 ? '32nd' : 'triplet';
    if (mode === '32nd') {
      if (root + 1 < S && root + 1 !== snareStep) hitSet.add(root + 1);
    } else {
      // Triplet burst approximation inside one 16th beat (gallop).
      if (root + 1 < S) hitSet.add(root + 1);
      if (root + 2 < S && root + 2 !== snareStep) hitSet.add(root + 2);
    }
  }

  return hats(...[...hitSet].sort((a, b) => a - b));
}

/** Full modern trap halftime bar composer. */
export function platinumTrapHalftimeBar(
  seed: string,
  kickVariant: 'metro' | 'south' | 'slide' = 'metro',
): ReadonlyArray<[number, number]> {
  const kickHits = platinumTrapKickPocket(kickVariant);
  const kickSteps = kickHits.map(([, s]) => s);
  return [
    ...kickHits,
    ...platinumHalftimeSnareStack(),
    ...platinumHatStutterEngine({ seed, snareStep: 8 }),
    ...platinum808OffbeatSync(kickSteps),
  ];
}

// ── 2. Modern R&B / Trapsoul (80–100 BPM) ───────────────────────────────────

/** Main snare beat 3 + mandatory ghost rim on & after beat 4. */
export function platinumRnbSnareGhost(): ReadonlyArray<[number, number]> {
  return [
    [1, 8],
    [7, 13],
  ];
}

/** Soft clap stack on beat 3 only — no 2 & 4 claps. */
export function platinumRnbClapBeat3(): ReadonlyArray<[number, number]> {
  return [[2, 8]];
}

/** Open hat on & of beat 1 and & of beat 3 — breathing pocket. */
export function platinumRnbOpenHatBreath(): ReadonlyArray<[number, number]> {
  return [
    [4, 2],
    [4, 10],
  ];
}

/** Closed hats — skip open-hat chokes on steps 2 and 10. */
export function platinumRnbClosedHats(): ReadonlyArray<[number, number]> {
  const steps = [0, 1, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15];
  return hats(...steps);
}

/** Sparse kick — room on beats 1–2 (space filter for chord-change bars). */
export function platinumRnbSpaceKick(): ReadonlyArray<[number, number]> {
  return kicks(10, 14);
}

/** Laid-back R&B kick pocket. */
export function platinumRnbKickPocket(): ReadonlyArray<[number, number]> {
  return kicks(0, 7, 11, 14);
}

export function platinumRnbTrapsoulBar(sparse = false): ReadonlyArray<[number, number]> {
  return [
    ...(sparse ? platinumRnbSpaceKick() : platinumRnbKickPocket()),
    ...platinumRnbSnareGhost(),
    ...platinumRnbClapBeat3(),
    ...platinumRnbClosedHats(),
    ...platinumRnbOpenHatBreath(),
    ...body808(0, 10),
  ];
}

// ── 3. Modern Pop / Radio (100–120 BPM) ─────────────────────────────────────

/** Bar 1 — beat 1 + & of beat 2. */
export function platinumPopKickBarA(): ReadonlyArray<[number, number]> {
  return kicks(0, 6);
}

/** Bar 2 — beat 1, beat 3, & of beat 4. */
export function platinumPopKickBarB(): ReadonlyArray<[number, number]> {
  return kicks(0, 8, 14);
}

/**
 * Shaker / percussion — steps one 16th early vs straight grid to mimic +5–12 tick push.
 * Maps to steps 0,3,6,9,12,15 instead of 1,4,7,10,13 for aggressive drive.
 */
export function platinumPopPercPush(): ReadonlyArray<[number, number]> {
  return [0, 3, 6, 9, 12, 15].map((s) => [7, s] as [number, number]);
}

export function platinumPopHatStack(): ReadonlyArray<[number, number]> {
  return hats(0, 2, 4, 6, 8, 10, 12, 14);
}

export function platinumPopBar(kind: 'A' | 'B'): ReadonlyArray<[number, number]> {
  const kick = kind === 'A' ? platinumPopKickBarA() : platinumPopKickBarB();
  return [
    ...kick,
    [1, 4],
    [1, 12],
    [2, 4],
    [2, 12],
    ...platinumPopHatStack(),
    ...platinumPopPercPush(),
  ];
}

/** Export velocity byte for a hit tier (MIDI note-on). */
export function platinumVelocityForTier(
  tier: 'downbeat' | 'hat' | 'stutter',
  positionInRoll = 0,
  rollLength = 1,
): number {
  const spec =
    tier === 'downbeat'
      ? PLATINUM_VEL_DOWNBEAT
      : tier === 'stutter'
        ? PLATINUM_VEL_STUTTER
        : PLATINUM_VEL_HAT;
  if (tier === 'stutter' && rollLength > 1) {
    const t = positionInRoll / Math.max(1, rollLength - 1);
    return Math.round(spec.max - t * (spec.max - spec.min));
  }
  const mid = Math.round((spec.min + spec.max) / 2);
  return mid;
}
