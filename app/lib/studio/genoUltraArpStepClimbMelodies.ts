/**
 * Step Climbing — dark / hard techno melody bank.
 * Note-grid only (blank STEP / HITS / VEL / CTRL). Same names & BPMs as the
 * original climbs; melodies lean minor, chromatic, and low–mid register.
 */
import {
  genoArpCenterPresetRow,
  genoArpSanitizeBarLength,
  GENO_ARP_ACTIVE_ROW_SPAN,
  GENO_ARP_STEPS_PER_BAR,
  type GenoArpBarLength,
  type GenoArpStepHits,
} from '@/app/lib/studio/genoUltraArpPattern';
import {
  buildGenoArpGridFromBarSteps,
  type GenoArpBarStepPattern,
  type GenoArpStylePreset,
} from '@/app/lib/studio/genoUltraArpStylePresets';

const S16 = GENO_ARP_STEPS_PER_BAR;

function barSteps(...hits: (readonly number[])[]): GenoArpBarStepPattern {
  const out: number[][] = Array.from({ length: S16 }, () => []);
  hits.forEach(([step, ...rows]) => {
    const idx = Math.max(0, Math.min(S16 - 1, step));
    out[idx] = rows
      .filter((r) => r >= 0 && r < GENO_ARP_ACTIVE_ROW_SPAN)
      .map((r) => genoArpCenterPresetRow(r));
  });
  return out;
}

/** Kept for apply-patch typing; Step Climbing loads blank STEP/CTRL. */
export type StepClimbSeq = {
  stepMask: boolean[];
  stepHits: GenoArpStepHits[];
  velLevels: number[];
  mod1Levels: number[];
  mod2Levels: number[];
  mod3Levels: number[];
  ctrl1On: boolean;
  ctrl2On: boolean;
  ctrl3On: boolean;
  ctrl1Depth: number;
  ctrl2Depth: number;
  ctrl3Depth: number;
  phraseSteps: number;
};

/**
 * Dark / hard climbs — chromatic neighbors, minor lean, low–mid register.
 * Each keeps its rhythmic identity; no bright major ladders.
 * Rows: 0 = root, 1 = minor 2nd / neighbor, 2 = minor 3rd, 3 = 4th, 4 = tritone bite.
 */
const DARK_STUTTER = barSteps(
  [0, 0],
  [1, 1],
  [2, 0],
  [4, 2],
  [5, 1],
  [8, 0],
  [9, 3],
  [10, 2],
  [12, 1],
  [14, 4],
);

const DARK_BOUNCE = barSteps(
  [0, 0],
  [2, 3],
  [3, 0],
  [5, 2],
  [6, 1],
  [8, 0],
  [10, 4],
  [11, 1],
  [13, 2],
  [14, 0],
);

const DARK_MINIMAL = barSteps(
  [0, 0],
  [3, 2],
  [6, 1],
  [8, 0],
  [11, 3],
  [14, 1],
);

const DARK_ACID = barSteps(
  [0, 0],
  [1, 1],
  [3, 0],
  [4, 2],
  [6, 1],
  [8, 0],
  [9, 3],
  [11, 2],
  [12, 4],
  [14, 1],
  [15, 3],
);

const DARK_EURO = barSteps(
  [0, 0],
  [2, 1],
  [4, 0],
  [6, 2],
  [8, 1],
  [10, 3],
  [12, 2],
  [13, 4],
  [15, 1],
);

const DARK_PEAK = barSteps(
  [0, 0],
  [2, 1],
  [4, 0],
  [5, 2],
  [8, 1],
  [9, 3],
  [10, 4],
  [12, 2],
  [14, 0],
);

const DARK_LOCK = barSteps(
  [0, 0],
  [2, 0],
  [4, 1],
  [6, 0],
  [8, 2],
  [10, 1],
  [12, 0],
  [14, 3],
);

const DARK_RISE_DROP = barSteps(
  [0, 0],
  [2, 1],
  [4, 2],
  [6, 3],
  [8, 4],
  [10, 2],
  [12, 1],
  [13, 0],
  [14, 1],
  [15, 0],
);

const DARK_SLAP = barSteps(
  [0, 0],
  [2, 2],
  [3, 0],
  [5, 1],
  [6, 0],
  [8, 3],
  [10, 1],
  [11, 0],
  [13, 4],
  [14, 2],
);

type ClimbDef = {
  id: string;
  name: string;
  description: string;
  soundPresetId: string;
  steps: GenoArpBarStepPattern;
  bpm: number;
  keyPitchClass: number;
  gate?: number;
  swing?: number;
  /** Defaults to 4 (tiles the bar). Scale rises use 1 (one bar, loop). */
  barLength?: GenoArpBarLength;
};

/** Dark / evil techno climbs — same names & BPMs, new melodies + darker sounds. */
const CLIMB_DEFS: readonly ClimbDef[] = [
  {
    id: 'step-climb-stutter',
    name: 'Stutter Climb',
    description: 'Stuttered chromatic rise, hard edge',
    soundPresetId: 'ultra-acid-line',
    steps: DARK_STUTTER,
    bpm: 132,
    keyPitchClass: 9,
  },
  {
    id: 'step-climb-bounce',
    name: 'Bounce Climb',
    description: 'Dark bounce — up, drop, climb again',
    soundPresetId: 'ultra-porta-lead',
    steps: DARK_BOUNCE,
    bpm: 128,
    keyPitchClass: 4,
    swing: 0.08,
  },
  {
    id: 'step-climb-minimal',
    name: 'Minimal Rise',
    description: 'Sparse evil — space and tension',
    soundPresetId: 'ultra-shock-keys',
    steps: DARK_MINIMAL,
    bpm: 126,
    keyPitchClass: 2,
    gate: 0.5,
  },
  {
    id: 'step-climb-acid',
    name: 'Acid Climb',
    description: 'Evil 303 climb, chromatic and mean',
    soundPresetId: 'ultra-acid-line',
    steps: DARK_ACID,
    bpm: 130,
    keyPitchClass: 5,
  },
  {
    id: 'step-climb-euro',
    name: 'Euro Climb',
    description: 'Dark euro rise — hard and present',
    soundPresetId: 'ultra-evil-arp',
    steps: DARK_EURO,
    bpm: 132,
    keyPitchClass: 0,
  },
  {
    id: 'step-climb-peak',
    name: 'Peak Climb',
    description: 'Builds to a dark peak, no bright payoff',
    soundPresetId: 'ultra-dread-lead',
    steps: DARK_PEAK,
    bpm: 128,
    keyPitchClass: 2,
  },
  {
    id: 'step-climb-lock',
    name: 'Lock Climb',
    description: 'Locked evil machine climb',
    soundPresetId: 'ultra-porta-lead',
    steps: DARK_LOCK,
    bpm: 128,
    keyPitchClass: 7,
  },
  {
    id: 'step-climb-rise-drop',
    name: 'Rise & Drop',
    description: 'Dark rise then fall into the pit',
    soundPresetId: 'ultra-horror-keys',
    steps: DARK_RISE_DROP,
    bpm: 130,
    keyPitchClass: 4,
  },
  {
    id: 'step-climb-slap',
    name: 'Slap Climb',
    description: 'Hard syncopated dark bass climb',
    soundPresetId: 'ultra-shock-keys',
    steps: DARK_SLAP,
    bpm: 124,
    keyPitchClass: 9,
    swing: 0.08,
  },
];

/**
 * One-bar minor-scale rises (rows 0→5), loop forever.
 * Ten rhythm placements of the same diagonal climb — pick the winner, then we match the rest.
 */
const SCALE_RISE_EVEN = barSteps(
  [0, 0],
  [2, 1],
  [4, 2],
  [6, 3],
  [8, 4],
  [10, 5],
);

const SCALE_RISE_OFFBEAT = barSteps(
  [1, 0],
  [3, 1],
  [5, 2],
  [7, 3],
  [9, 4],
  [11, 5],
);

const SCALE_RISE_POCKET = barSteps(
  [0, 0],
  [3, 1],
  [6, 2],
  [9, 3],
  [12, 4],
  [15, 5],
);

const SCALE_RISE_SYNC = barSteps(
  [0, 0],
  [2, 1],
  [5, 2],
  [7, 3],
  [10, 4],
  [12, 5],
);

const SCALE_RISE_PUSH = barSteps(
  [0, 0],
  [1, 1],
  [3, 2],
  [5, 3],
  [8, 4],
  [11, 5],
);

const SCALE_RISE_GALLOP = barSteps(
  [0, 0],
  [2, 1],
  [3, 2],
  [5, 3],
  [6, 4],
  [8, 5],
);

const SCALE_RISE_LATE = barSteps(
  [2, 0],
  [4, 1],
  [6, 2],
  [8, 3],
  [10, 4],
  [12, 5],
);

const SCALE_RISE_SPARSE = barSteps(
  [0, 0],
  [4, 1],
  [7, 2],
  [10, 3],
  [13, 4],
  [15, 5],
);

const SCALE_RISE_TIGHT = barSteps(
  [0, 0],
  [1, 1],
  [2, 2],
  [4, 3],
  [6, 4],
  [8, 5],
);

const SCALE_RISE_ELECTRO = barSteps(
  [0, 0],
  [3, 1],
  [4, 2],
  [7, 3],
  [8, 4],
  [11, 5],
);

const SCALE_RISE_DEFS: readonly ClimbDef[] = [
  {
    id: 'step-climb-scale-1',
    name: 'Scale Rise 1',
    description: 'Even 8ths — minor scale 1–6, one bar loop',
    soundPresetId: 'ultra-horror-keys',
    steps: SCALE_RISE_EVEN,
    bpm: 128,
    keyPitchClass: 9,
    barLength: 1,
  },
  {
    id: 'step-climb-scale-2',
    name: 'Scale Rise 2',
    description: 'Offbeat 8ths — minor scale 1–6, one bar loop',
    soundPresetId: 'ultra-dread-lead',
    steps: SCALE_RISE_OFFBEAT,
    bpm: 128,
    keyPitchClass: 9,
    barLength: 1,
  },
  {
    id: 'step-climb-scale-3',
    name: 'Scale Rise 3',
    description: 'Every third step — minor scale 1–6, one bar loop',
    soundPresetId: 'ultra-haunt-keys',
    steps: SCALE_RISE_POCKET,
    bpm: 128,
    keyPitchClass: 9,
    barLength: 1,
  },
  {
    id: 'step-climb-scale-4',
    name: 'Scale Rise 4',
    description: 'Syncopated pocket — minor scale 1–6, one bar loop',
    soundPresetId: 'ultra-evil-arp',
    steps: SCALE_RISE_SYNC,
    bpm: 128,
    keyPitchClass: 9,
    barLength: 1,
  },
  {
    id: 'step-climb-scale-5',
    name: 'Scale Rise 5',
    description: 'Front push — minor scale 1–6, one bar loop',
    soundPresetId: 'ultra-phantom-stab',
    steps: SCALE_RISE_PUSH,
    bpm: 128,
    keyPitchClass: 9,
    barLength: 1,
  },
  {
    id: 'step-climb-scale-6',
    name: 'Scale Rise 6',
    description: 'Gallop climb — minor scale 1–6, one bar loop',
    soundPresetId: 'ultra-acid-line',
    steps: SCALE_RISE_GALLOP,
    bpm: 128,
    keyPitchClass: 9,
    barLength: 1,
  },
  {
    id: 'step-climb-scale-7',
    name: 'Scale Rise 7',
    description: 'Late ride — minor scale 1–6, one bar loop',
    soundPresetId: 'ultra-porta-lead',
    steps: SCALE_RISE_LATE,
    bpm: 128,
    keyPitchClass: 9,
    barLength: 1,
  },
  {
    id: 'step-climb-scale-8',
    name: 'Scale Rise 8',
    description: 'Sparse rise — minor scale 1–6, one bar loop',
    soundPresetId: 'ultra-shock-keys',
    steps: SCALE_RISE_SPARSE,
    bpm: 128,
    keyPitchClass: 9,
    barLength: 1,
  },
  {
    id: 'step-climb-scale-9',
    name: 'Scale Rise 9',
    description: 'Tight open — minor scale 1–6, one bar loop',
    soundPresetId: 'ultra-horror-keys',
    steps: SCALE_RISE_TIGHT,
    bpm: 128,
    keyPitchClass: 9,
    barLength: 1,
  },
  {
    id: 'step-climb-scale-10',
    name: 'Scale Rise 10',
    description: 'Electro pocket — minor scale 1–6, one bar loop',
    soundPresetId: 'ultra-dread-lead',
    steps: SCALE_RISE_ELECTRO,
    bpm: 128,
    keyPitchClass: 9,
    barLength: 1,
  },
];

const ALL_CLIMB_DEFS: readonly ClimbDef[] = [...CLIMB_DEFS, ...SCALE_RISE_DEFS];

export const GENO_ARP_STEP_CLIMB_STYLE_PRESETS: readonly GenoArpStylePreset[] = ALL_CLIMB_DEFS.map(
  (d) => ({
    id: d.id,
    name: `Step Climb — ${d.name}`,
    category: 'techno' as const,
    description: d.description,
    soundPresetId: d.soundPresetId,
    rateIdx: 1,
    gate: d.gate ?? 0.48,
    swing: d.swing ?? 0,
    order: 'UP' as const,
    steps: d.steps,
    barLength: (d.barLength ?? 4) as GenoArpBarLength,
  }),
);

export const GENO_ULTRA_STEP_CLIMB_MELODIES = ALL_CLIMB_DEFS.map((d) => ({
  id: `melody-${d.id}`,
  label: d.name,
  tag: 'step-climb' as const,
  soundPresetId: d.soundPresetId,
  stylePresetId: d.id,
  barLength: (d.barLength ?? 4) as GenoArpBarLength,
  keyPitchClass: d.keyPitchClass,
  bpm: d.bpm,
  description: d.description,
}));

/** Step Climbing uses note grid only — no STEP/CTRL programming. */
export function genoUltraStepClimbSeqForMelodyId(_melodyId: string): StepClimbSeq | undefined {
  return undefined;
}

export function buildStepClimbGrid(styleId: string, barLength: GenoArpBarLength | number): boolean[][] | null {
  const style = GENO_ARP_STEP_CLIMB_STYLE_PRESETS.find((s) => s.id === styleId);
  if (!style) return null;
  const bars = genoArpSanitizeBarLength(barLength);
  return buildGenoArpGridFromBarSteps(style.steps, bars);
}
