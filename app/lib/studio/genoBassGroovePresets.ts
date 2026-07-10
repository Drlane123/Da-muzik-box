/**
 * Geno Bass 52 — MIDI bassline presets (16th grid, scale degrees, discrete lenCols).
 * Core library synced from Groove Lab `grooveLabBassGrooves` + iconic synth basslines.
 */
import { mulberry32 } from '@/app/lib/groovePatternEngine';
import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';
import {
  genoBassDegreeToMidiInKey,
  genoBassMutateGrooveSteps,
  genoBassPhraseDegreeShift,
  type GenoBassKeyMode,
} from '@/app/lib/studio/genoBassGrooveEngine';
import {
  GROOVE_BAR_PHRASE,
  GROOVE_LAB_BASS_GROOVES,
  type GrooveLabBassGrooveDef,
} from '@/app/lib/creationStation/grooveLabBassGrooves';
import type { GenoUltraArpSe2RollNote } from '@/app/lib/studio/genoUltraArpExport';
import { genoWrapMidiToRange } from '@/app/lib/studio/se2SynthGenoRanges';

export const GENO_BASS_SIXTEENTHS_PER_BAR = 16;
const BEATS_PER_BAR = 4;
const MIN_DUR_BEATS = 1 / 16;
/** Physical silence between hits — staccato pocket (≈32nd @ 4/4). */
const STEP_GAP_BEATS = 1 / 32;
const SIXTEENTH_BEATS = 1 / 4;
/** Default gate slider — short, bouncy note length. */
export const GENO_BASS_DEFAULT_GATE = 0.54;
/** Groove grid quantize — slow (1/8) · native (1/16) · fast (1/32). */
export const GENO_BASS_GROOVE_QUANTIZE_OPTIONS = [
  { id: '8' as const, label: '1/8', hint: 'Slower — 8th-note grid' },
  { id: '16' as const, label: '1/16', hint: 'Standard — 16th grid' },
  { id: '32' as const, label: '1/32', hint: 'Faster — 32nd grid' },
] as const;
export type GenoBassGrooveQuantize = (typeof GENO_BASS_GROOVE_QUANTIZE_OPTIONS)[number]['id'];
export const GENO_BASS_DEFAULT_QUANTIZE: GenoBassGrooveQuantize = '16';
/** Swing push on off-grid 16ths (fraction of one 16th column). */
const GENO_BASS_SWING_PUSH = 0.12;

/** Bassline writing register — C2 (default groove / piano-roll root). */
export const GENO_BASS_LOOP_BASE_ROOT = 36;
/** Default root — same as base (C2). */
export const GENO_BASS_LOOP_DEFAULT_ROOT = GENO_BASS_LOOP_BASE_ROOT;
/** Editor + keyboard — C0–C4 (octave shift ±2 from C2). */
export const GENO_BASS_LOOP_EDITOR_MIN = 12;
export const GENO_BASS_LOOP_EDITOR_MAX = 60;

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;

export type GenoBassGrooveStepTemplate = {
  colInBar: number;
  /** Diatonic scale degree (0 = root, 4 = fifth, 7 = octave, etc.). */
  degree: number;
  lenCols: number;
  vel?: number;
};

export type GenoBassGroovePreset = {
  id: string;
  label: string;
  genre: string;
  group: '808' | 'synth' | 'funk' | 'pop' | 'hits' | 'rnb' | 'electro' | 'my';
  /** Canonical feel tempo — preview + SE2 apply when this preset is loaded. */
  bpm: number;
  steps: readonly GenoBassGrooveStepTemplate[];
  /** Geno Bass synth bank preset — loaded when this groove is picked. */
  soundPresetId?: string;
  /** Note-length slider default (0.35–1) for this groove. */
  defaultGate?: number;
};

/**
 * Per-preset BPM (producer grid for trap, song tempo for iconic references).
 * Matches genre tempo profiles + named track references in Geno Ultra / Beat Lab.
 */
export const GENO_BASS_GROOVE_BPM_BY_ID: Record<string, number> = {
  /* Groove Lab — 808 / trap */
  'trap-808': 140,
  'trap-808-slide': 145,
  'drill-808': 150,
  'hiphop-808-bounce': 86,
  'rnb-808-silk': 76,
  'pop-808-sub': 108,
  'metro-808-two': 145,
  'atl-808-hold': 140,
  'pocket': 82,
  /* Groove Lab — guitar */
  'gtr-pop-8ths': 110,
  'gtr-funk-chick': 108,
  'gtr-rnb-pocket': 78,
  'gtr-rock-root5': 128,
  'gtr-walk': 120,
  'gtr-trap-pluck': 140,
  'gtr-disco-oct': 118,
  'gtr-reggae-off': 98,
  /* Groove Lab — general */
  'pop-drive': 112,
  'syncopated': 104,
  'push': 105,
  'clave-332': 96,
  'moog-pulse': 124,
  /* Iconic synth bass */
  'billie-groove': 135,
  'another-one': 110,
  'silk-funk': 104,
  'silk-funk-alt': 106,
  'kpop-pocket': 118,
  'daft-lucky': 121,
  'dembow-pr': 94,
  'house-shuffle': 124,
  'neo-soul-walk': 88,
  'tay-bounce': 145,
  'heartbreak-808': 140,
  /* Twilight 22 — Electric Kingdom (~127) / Siberian (~130) */
  'ek-kingdom-groove': 127,
  'ek-kingdom-oct': 127,
  'ek-kingdom-pulse': 127,
  'ek-kingdom-hook': 127,
  'ek-siberian-funk': 130,
  'ek-siberian-thump': 130,
  /* Planet Patrol — Rock At Your Own Risk (~129) */
  'pp-risk-groove': 129,
  'pp-risk-drive': 129,
  'pp-risk-pocket': 129,
  'pp-risk-hook': 129,
  /* Newcleus — Computer Age (~129) */
  'nc-push-kick': 129,
  'nc-root5-8th': 129,
  'nc-age-sync': 129,
  'nc-push-button': 129,
  'nc-computer-hook': 129,
  /* Producer demo basslines — staccato bounce, syncopation, octave drive */
  'prod-drive-bounce': 118,
  'prod-wc-cruise': 102,
  'prod-g-funk-bounce': 104,
  'prod-funk-bootsy': 110,
  'prod-funk-chic': 112,
  'prod-metro-hold': 148,
  'prod-drill-punch': 152,
  'prod-house-pump': 128,
  'prod-rock-drive': 132,
  'prod-rnb-silk': 92,
  'prod-daft-pocket': 124,
  'prod-trap-heart': 142,
  'prod-club-anchor': 116,
  'prod-oct-roll': 120,
  /* Bass Dragon–style curated pockets */
  'bd-trap-glide': 142,
  'bd-rnb-pocket': 88,
  'bd-gospel-walk': 92,
  'bd-funk-slaps': 108,
  'bd-pop-anchor': 112,
  'bd-drill-stab': 150,
  'bd-house-groove': 126,
  'bd-neo-chrome': 86,
  /* R&B / Soul — 70s & 90s held grooves */
  'rnb70-motown-hold': 84,
  'rnb70-philly-root': 86,
  'rnb70-jamerson-walk': 92,
  'rnb70-stax-pocket': 88,
  'rnb70-chicago-soul': 90,
  'rnb70-disco-soul': 108,
  'rnb70-ohio-pocket': 96,
  'rnb70-marvin-groove': 82,
  'rnb70-heatwave': 104,
  'rnb70-curtis-groove': 80,
  'rnb90-newjack': 98,
  'rnb90-slowjam': 72,
  'rnb90-boyz-pocket': 88,
  'rnb90-guy-groove': 94,
  'rnb90-jodeci-hold': 76,
  'rnb90-sub-hold': 90,
  'rnb90-rkelly': 86,
  'rnb90-tony-toni': 96,
  'rnb90-babyface': 78,
  'rnb90-midnight': 84,
  /* 80s electro / Miami floor bounce — Electric Kingdom & Siberian Nights pocket */
  'elec-kingdom-floor': 127,
  'elec-oct-floor': 127,
  'elec-84-drive': 130,
  'elec-miami-thump': 128,
  'elec-808-pocket': 125,
  'elec-kick-lock': 129,
  'elec-16th-rush': 127,
  'elec-booty-bounce': 122,
  'elec-jam-floor': 127,
  'elec-break-bounce': 127,
};

function genoBassGenreDefaultBpm(genre: string): number {
  const g = genre.toLowerCase();
  if (g.includes('trap')) return 142;
  if (g.includes('drill')) return 128;
  if (g.includes('hip-hop') || g.includes('hiphop')) return 86;
  if (g.includes('r&b') || g.includes('rnb')) return 78;
  if (g.includes('pop')) return 110;
  if (g.includes('funk')) return 104;
  if (g.includes('rock')) return 120;
  if (g.includes('jazz')) return 120;
  if (g.includes('disco')) return 118;
  if (g.includes('house')) return 124;
  if (g.includes('reggae')) return 98;
  if (g.includes('miami')) return 128;
  if (g.includes('electro')) return 127;
  if (g.includes('newcleus')) return 129;
  if (g.includes('k-pop')) return 118;
  if (g.includes('reggaeton')) return 94;
  if (g.includes('neo-soul')) return 88;
  if (g.includes('70s')) return 88;
  if (g.includes('90s')) return 90;
  return 120;
}

export function genoBassPresetBpm(presetId: string, genre = ''): number {
  const hit = GENO_BASS_GROOVE_BPM_BY_ID[presetId];
  if (hit != null) return clampGrooveLabBpm(hit);
  return clampGrooveLabBpm(genoBassGenreDefaultBpm(genre));
}

function mapGrooveFamilyToGroup(def: GrooveLabBassGrooveDef): GenoBassGroovePreset['group'] {
  if (def.family === '808') return '808';
  if (def.family === 'guitar') return 'funk';
  const g = def.genre.toLowerCase();
  if (g.includes('house') || g.includes('techno') || g.includes('synth') || g.includes('electro')) {
    return 'synth';
  }
  if (g.includes('pop') || g.includes('disco')) return 'pop';
  return 'funk';
}

function grooveLabToGenoPreset(def: GrooveLabBassGrooveDef): GenoBassGroovePreset {
  const steps = GROOVE_LAB_GENO_STEP_OVERRIDES[def.id] ?? def.steps;
  return {
    id: def.id,
    label: def.label,
    genre: def.genre,
    group: mapGrooveFamilyToGroup(def),
    bpm: genoBassPresetBpm(def.id, def.genre),
    steps,
    defaultGate: def.family === '808' ? 0.62 : GENO_BASS_DEFAULT_GATE,
  };
}

type GenoBassGroovePresetDraft = Omit<GenoBassGroovePreset, 'bpm'>;

function finalizeGenoBassGroovePresets(
  drafts: readonly GenoBassGroovePresetDraft[],
): GenoBassGroovePreset[] {
  return drafts.map((p) => ({
    ...p,
    bpm: genoBassPresetBpm(p.id, p.genre),
  }));
}

/**
 * Twilight 22 — Electric Kingdom (instrumental) ARP row → diatonic bass degree.
 * Row 0 = root pocket; row 2 = octave pop (same voicing as `genoUltraArpStylePresets` Kingdom patterns).
 * @see https://youtu.be/IIUnpI6LBSo
 */
function ekArpRowToDegree(arpRow: number): number {
  if (arpRow === 2 || arpRow === 5) return 7;
  if (arpRow === 4) return 4;
  if (arpRow === 1 || arpRow === 3) return 2;
  return 0;
}

/** Port Geno Ultra Electric Kingdom / Siberian 16th-bar hits to Geno Bass groove steps. */
function ekStepsFromArpHits(
  hits: readonly (readonly number[])[],
): GenoBassGrooveStepTemplate[] {
  return hits.map(([col, row]) => ({
    colInBar: col,
    degree: ekArpRowToDegree(row ?? 0),
    lenCols: 2,
    vel: col % 4 === 0 ? 1 : col % 2 === 0 ? 0.9 : 0.78,
  }));
}

/**
 * Bassline steps — authored length in 16th columns (use len 1–2 for staccato bounce).
 */
function ncBasslineSteps(
  hits: readonly { col: number; degree: number; len: number; vel?: number }[],
): GenoBassGrooveStepTemplate[] {
  return hits.map((h) => ({
    colInBar: h.col,
    degree: h.degree,
    lenCols: h.len,
    vel: h.vel ?? (h.col % 4 === 0 ? 1 : h.col % 4 === 2 ? 0.78 : 0.68),
  }));
}

/** Tight staccato hits — one 16th column, syncopation-friendly velocities. */
function ncBounceSteps(
  hits: readonly { col: number; degree: number; vel?: number }[],
): GenoBassGrooveStepTemplate[] {
  return hits.map((h) => ({
    colInBar: h.col,
    degree: h.degree,
    lenCols: 1,
    vel: h.vel ?? (h.col % 4 === 0 ? 1 : h.col % 4 === 2 ? 0.76 : 0.66),
  }));
}

/**
 * Geno Bass rewrites for Groove Lab templates that read as 16th arpeggios on synth/808.
 * Beat Lab source steps stay unchanged; only Geno Bass playback uses these pockets.
 */
const GROOVE_LAB_GENO_STEP_OVERRIDES: Partial<
  Record<GrooveLabBassGrooveDef['id'], readonly GenoBassGrooveStepTemplate[]>
> = {
  'pop-drive': ncBounceSteps([
    { col: 0, degree: 0, vel: 1 },
    { col: 3, degree: 4, vel: 0.72 },
    { col: 6, degree: 0, vel: 0.9 },
    { col: 9, degree: 4, vel: 0.74 },
    { col: 12, degree: 0, vel: 0.88 },
    { col: 15, degree: 4, vel: 0.7 },
  ]),
  'gtr-pop-8ths': ncBounceSteps([
    { col: 0, degree: 0, vel: 1 },
    { col: 2, degree: 7, vel: 0.7 },
    { col: 4, degree: 0, vel: 0.88 },
    { col: 6, degree: 4, vel: 0.74 },
    { col: 8, degree: 0, vel: 0.9 },
    { col: 10, degree: 7, vel: 0.68 },
    { col: 12, degree: 0, vel: 0.86 },
    { col: 14, degree: 4, vel: 0.72 },
  ]),
  'gtr-walk': ncBounceSteps([
    { col: 0, degree: 0, vel: 0.98 },
    { col: 3, degree: 2, vel: 0.72 },
    { col: 6, degree: 4, vel: 0.86 },
    { col: 9, degree: 2, vel: 0.7 },
    { col: 12, degree: 0, vel: 0.9 },
    { col: 15, degree: 4, vel: 0.76 },
  ]),
  'gtr-disco-oct': ncBounceSteps([
    { col: 0, degree: 0, vel: 1 },
    { col: 2, degree: 7, vel: 0.72 },
    { col: 4, degree: 0, vel: 0.9 },
    { col: 6, degree: 7, vel: 0.68 },
    { col: 8, degree: 0, vel: 0.92 },
    { col: 10, degree: 7, vel: 0.7 },
    { col: 12, degree: 0, vel: 0.88 },
    { col: 14, degree: 7, vel: 0.74 },
  ]),
  'moog-pulse': ncBounceSteps([
    { col: 0, degree: 0, vel: 1 },
    { col: 3, degree: 4, vel: 0.74 },
    { col: 6, degree: 0, vel: 0.9 },
    { col: 9, degree: 7, vel: 0.68 },
    { col: 12, degree: 0, vel: 0.88 },
    { col: 15, degree: 4, vel: 0.72 },
  ]),
};

/** ARP hit grid → legato bass line (fills gap to next hit — record-style hold). */
function basslineStepsFromArpHits(
  hits: readonly (readonly number[])[],
  rowToDegree: (row: number) => number,
): GenoBassGrooveStepTemplate[] {
  const parsed = hits
    .map(([col, row]) => ({ col, degree: rowToDegree(row ?? 0) }))
    .sort((a, b) => a.col - b.col);
  return parsed.map((hit, i) => {
    const nextCol = i + 1 < parsed.length ? parsed[i + 1]!.col : 16;
    const gap = nextCol - hit.col;
    const octPop = hit.degree === 7;
    const lenCols = octPop
      ? Math.max(1, Math.min(2, gap - 1))
      : Math.max(2, gap > 2 ? gap - 1 : gap);
    const accent = hit.col % 4 === 0;
    const vel = accent ? 1 : octPop ? 0.72 : hit.col % 2 === 0 ? 0.9 : 0.82;
    return { colInBar: hit.col, degree: hit.degree, lenCols, vel };
  });
}

/** Arthur Baker / Tommy Boy electro row map (root + fifth + octave). */
function ppArpRowToDegree(arpRow: number): number {
  if (arpRow === 2) return 7;
  if (arpRow === 4) return 4;
  if (arpRow === 1 || arpRow === 3) return 2;
  return 0;
}

/**
 * Newcleus — Computer Age (Push the Button) basslines @ ~129 BPM.
 * Kick-locked root/5th hooks with 8th–quarter length — not Ultra-style arp cycles.
 * @see https://youtu.be/fbO5NG2LzLc
 */
const NEWCLEUS_BASSLINE_PRESETS_DRAFT: readonly GenoBassGroovePresetDraft[] = [
  {
    id: 'nc-push-kick',
    label: 'NC Push Kick Lock',
    genre: 'Newcleus',
    group: 'synth',
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 3, vel: 1 },
      { col: 6, degree: 4, len: 2, vel: 0.92 },
      { col: 10, degree: 0, len: 2, vel: 0.9 },
      { col: 13, degree: 4, len: 2, vel: 0.86 },
    ]),
  },
  {
    id: 'nc-root5-8th',
    label: 'NC Root–5th 8ths',
    genre: 'Newcleus',
    group: 'synth',
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 2, vel: 1 },
      { col: 4, degree: 4, len: 2, vel: 0.9 },
      { col: 8, degree: 0, len: 2, vel: 0.94 },
      { col: 12, degree: 4, len: 2, vel: 0.88 },
    ]),
  },
  {
    id: 'nc-age-sync',
    label: 'NC Age Sync',
    genre: 'Newcleus',
    group: 'synth',
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 3, vel: 1 },
      { col: 5, degree: 4, len: 2, vel: 0.88 },
      { col: 8, degree: 0, len: 3, vel: 0.92 },
      { col: 13, degree: 4, len: 2, vel: 0.84 },
    ]),
  },
  {
    id: 'nc-push-button',
    label: 'NC Push Button',
    genre: 'Newcleus',
    group: 'synth',
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 7, vel: 1 },
      { col: 8, degree: 0, len: 2, vel: 0.92 },
      { col: 11, degree: 4, len: 1, vel: 0.88 },
      { col: 13, degree: 7, len: 1, vel: 0.86 },
      { col: 14, degree: 4, len: 1, vel: 0.9 },
      { col: 15, degree: 0, len: 1, vel: 0.95 },
    ]),
  },
  {
    id: 'nc-computer-hook',
    label: 'NC Computer Hook',
    genre: 'Newcleus',
    group: 'synth',
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 4, vel: 1 },
      { col: 6, degree: 4, len: 2, vel: 0.9 },
      { col: 9, degree: 0, len: 2, vel: 0.92 },
      { col: 14, degree: 4, len: 1, vel: 0.86 },
    ]),
  },
];

/**
 * Twilight 22 — Electric Kingdom bass LINES (127 BPM, F#m pocket).
 * Root/octave Odyssey groove with longer holds — not 16th arp stabs.
 * @see https://youtu.be/5VmORkY7390
 */
const ELECTRIC_KINGDOM_BASSLINE_PRESETS_DRAFT: readonly GenoBassGroovePresetDraft[] = [
  {
    id: 'ek-kingdom-groove',
    label: 'Electric Kingdom Groove',
    genre: 'Twilight 22',
    group: 'synth',
    soundPresetId: 'bass-kingdom',
    defaultGate: 0.82,
    steps: basslineStepsFromArpHits(
      [
        [0, 0],
        [2, 0],
        [3, 2],
        [5, 0],
        [6, 2],
        [8, 0],
        [10, 0],
        [11, 2],
        [12, 2],
        [14, 0],
        [15, 0],
        [15, 2],
      ],
      ekArpRowToDegree,
    ),
  },
  {
    id: 'ek-kingdom-oct',
    label: 'Electric Kingdom Oct Bounce',
    genre: 'Twilight 22',
    group: 'synth',
    soundPresetId: 'bass-boogie',
    defaultGate: 0.78,
    steps: basslineStepsFromArpHits(
      [
        [0, 0],
        [1, 2],
        [3, 0],
        [4, 2],
        [6, 0],
        [7, 2],
        [9, 0],
        [10, 2],
        [12, 0],
        [13, 2],
        [15, 0],
      ],
      ekArpRowToDegree,
    ),
  },
  {
    id: 'ek-kingdom-pulse',
    label: 'Electric Kingdom Kick Pocket',
    genre: 'Twilight 22',
    group: 'synth',
    soundPresetId: 'bass-dub-sub',
    defaultGate: 0.9,
    steps: basslineStepsFromArpHits(
      [
        [0, 0],
        [2, 0],
        [4, 2],
        [6, 0],
        [9, 0],
        [11, 2],
        [12, 0],
        [14, 0],
      ],
      ekArpRowToDegree,
    ),
  },
  {
    id: 'ek-kingdom-hook',
    label: 'Electric Kingdom Hook',
    genre: 'Twilight 22',
    group: 'synth',
    soundPresetId: 'bass-kingdom',
    defaultGate: 0.8,
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 5, vel: 1 },
      { col: 6, degree: 7, len: 1, vel: 0.74 },
      { col: 8, degree: 0, len: 4, vel: 0.96 },
      { col: 13, degree: 7, len: 2, vel: 0.78 },
    ]),
  },
];

/**
 * Planet Patrol — Rock At Your Own Risk (instrumental) @ 129 BPM, Bm electro pocket.
 * Tommy Boy / Arthur Baker synth bass — driving 16ths with kick-locked roots.
 * @see https://youtu.be/ez3QEpI2iA8
 */
const PLANET_PATROL_RISK_BASSLINE_PRESETS_DRAFT: readonly GenoBassGroovePresetDraft[] = [
  {
    id: 'pp-risk-groove',
    label: 'Rock At Your Own Risk Groove',
    genre: 'Planet Patrol',
    group: 'synth',
    soundPresetId: 'bass-planet-risk',
    defaultGate: 0.9,
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 6, vel: 1 },
      { col: 8, degree: 4, len: 4, vel: 0.88 },
      { col: 14, degree: 7, len: 2, vel: 0.8 },
    ]),
  },
  {
    id: 'pp-risk-drive',
    label: 'Rock At Your Own Risk Drive',
    genre: 'Planet Patrol',
    group: 'synth',
    soundPresetId: 'bass-planet-risk',
    defaultGate: 0.8,
    steps: basslineStepsFromArpHits(
      [
        [0, 0],
        [2, 0],
        [4, 4],
        [6, 0],
        [8, 0],
        [10, 4],
        [12, 0],
        [14, 4],
      ],
      ppArpRowToDegree,
    ),
  },
  {
    id: 'pp-risk-pocket',
    label: 'Rock At Your Own Risk Pocket',
    genre: 'Planet Patrol',
    group: 'synth',
    soundPresetId: 'bass-planet-risk',
    defaultGate: 0.92,
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 7, vel: 1 },
      { col: 8, degree: 0, len: 6, vel: 0.96 },
      { col: 14, degree: 4, len: 2, vel: 0.84 },
    ]),
  },
  {
    id: 'pp-risk-hook',
    label: 'Rock At Your Own Risk Hook',
    genre: 'Planet Patrol',
    group: 'synth',
    soundPresetId: 'bass-planet-risk',
    defaultGate: 0.78,
    steps: basslineStepsFromArpHits(
      [
        [0, 0],
        [2, 2],
        [4, 4],
        [8, 0],
        [10, 2],
        [12, 4],
      ],
      ppArpRowToDegree,
    ),
  },
];

/**
 * Twilight 22 — Siberian Nights electro bass (80s techno pocket).
 * Patterns ported from `genoUltraArpStylePresets` ELECTRO_SIBERIAN_*.
 */
const TWILIGHT22_ELECTRO_PRESETS_DRAFT: readonly GenoBassGroovePresetDraft[] = [
  ...ELECTRIC_KINGDOM_BASSLINE_PRESETS_DRAFT,
  {
    id: 'ek-siberian-funk',
    label: 'EK Siberian Funk',
    genre: "Electro '84",
    group: 'synth',
    steps: ekStepsFromArpHits([
      [0, 0],
      [3, 0],
      [5, 2],
      [7, 0],
      [10, 2],
      [12, 0],
      [15, 2],
    ]),
  },
  {
    id: 'ek-siberian-thump',
    label: 'EK Siberian Thump',
    genre: "Electro '84",
    group: 'synth',
    steps: ekStepsFromArpHits([
      [0, 0],
      [4, 0],
      [6, 0],
      [8, 0],
      [12, 0],
      [14, 2],
    ]),
  },
];

/** Staccato 16th electro floor hits — kick-locked root + octave bounce (80s electro / Miami). */
function electroFloorSteps(
  hits: readonly { col: number; degree: number; len?: number; vel?: number }[],
): GenoBassGrooveStepTemplate[] {
  return hits.map((h) => ({
    colInBar: h.col,
    degree: h.degree,
    lenCols: h.len ?? (h.col % 4 === 0 ? 2 : 1),
    vel: h.vel ?? (h.col % 4 === 0 ? 1 : h.degree === 7 ? 0.72 : 0.82),
  }));
}

/**
 * 80s electro / Miami bass floor grooves — Electric Kingdom & Siberian Nights pocket.
 * @see https://youtu.be/IIUnpI6LBSo
 * @see https://youtu.be/jiW7NbkhbJ0
 * @see https://youtu.be/Q1Qdcl4ja1Y
 */
const MIAMI_ELECTRO_BASSLINE_PRESETS_DRAFT: readonly GenoBassGroovePresetDraft[] = [
  {
    id: 'elec-kingdom-floor',
    label: 'Electric Floor',
    genre: "Electro '83",
    group: 'electro',
    soundPresetId: 'bass-kingdom',
    defaultGate: 0.66,
    steps: basslineStepsFromArpHits(
      [
        [0, 0],
        [2, 0],
        [3, 2],
        [5, 0],
        [6, 2],
        [8, 0],
        [10, 0],
        [11, 2],
        [12, 2],
        [14, 0],
        [15, 0],
      ],
      ekArpRowToDegree,
    ),
  },
  {
    id: 'elec-oct-floor',
    label: 'Octave Floor Bounce',
    genre: "Electro '83",
    group: 'electro',
    soundPresetId: 'bass-boogie',
    defaultGate: 0.62,
    steps: basslineStepsFromArpHits(
      [
        [0, 0],
        [1, 2],
        [3, 0],
        [4, 2],
        [6, 0],
        [7, 2],
        [9, 0],
        [10, 2],
        [12, 0],
        [13, 2],
        [15, 0],
      ],
      ekArpRowToDegree,
    ),
  },
  {
    id: 'elec-84-drive',
    label: 'Electro 84 Drive',
    genre: "Electro '84",
    group: 'electro',
    soundPresetId: 'bass-siberian',
    defaultGate: 0.7,
    steps: ekStepsFromArpHits([
      [0, 0],
      [3, 0],
      [5, 2],
      [7, 0],
      [10, 2],
      [12, 0],
      [15, 2],
    ]),
  },
  {
    id: 'elec-miami-thump',
    label: 'Miami Bass Thump',
    genre: 'Miami Bass',
    group: 'electro',
    soundPresetId: 'bass-tr808',
    defaultGate: 0.64,
    steps: electroFloorSteps([
      { col: 0, degree: 0, len: 4, vel: 1 },
      { col: 4, degree: 7, len: 1, vel: 0.72 },
      { col: 6, degree: 0, len: 2, vel: 0.92 },
      { col: 9, degree: 7, len: 1, vel: 0.68 },
      { col: 11, degree: 0, len: 2, vel: 0.88 },
      { col: 14, degree: 4, len: 1, vel: 0.76 },
    ]),
  },
  {
    id: 'elec-808-pocket',
    label: '808 Electro Pocket',
    genre: 'Electro',
    group: 'electro',
    soundPresetId: 'bass-tr808',
    defaultGate: 0.72,
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 3, vel: 1 },
      { col: 6, degree: 4, len: 2, vel: 0.88 },
      { col: 10, degree: 0, len: 2, vel: 0.92 },
      { col: 13, degree: 4, len: 2, vel: 0.84 },
    ]),
  },
  {
    id: 'elec-kick-lock',
    label: 'Kick Lock Electro',
    genre: 'Electro',
    group: 'electro',
    soundPresetId: 'bass-planet-risk',
    defaultGate: 0.78,
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 7, vel: 1 },
      { col: 8, degree: 0, len: 5, vel: 0.94 },
      { col: 14, degree: 4, len: 2, vel: 0.82 },
    ]),
  },
  {
    id: 'elec-16th-rush',
    label: '16th Floor Rush',
    genre: "Electro '84",
    group: 'electro',
    soundPresetId: 'bass-mc202',
    defaultGate: 0.58,
    steps: electroFloorSteps([
      { col: 0, degree: 0, vel: 1 },
      { col: 2, degree: 0, vel: 0.86 },
      { col: 4, degree: 7, vel: 0.74 },
      { col: 6, degree: 0, vel: 0.9 },
      { col: 8, degree: 0, vel: 0.96 },
      { col: 10, degree: 7, vel: 0.7 },
      { col: 12, degree: 4, vel: 0.82 },
      { col: 14, degree: 0, vel: 0.88 },
    ]),
  },
  {
    id: 'elec-booty-bounce',
    label: 'Booty Bass Bounce',
    genre: 'Miami Bass',
    group: 'electro',
    soundPresetId: 'bass-dub-sub',
    defaultGate: 0.68,
    steps: electroFloorSteps([
      { col: 0, degree: 0, len: 3, vel: 1 },
      { col: 3, degree: 0, len: 1, vel: 0.8 },
      { col: 5, degree: 7, len: 1, vel: 0.7 },
      { col: 7, degree: 0, len: 2, vel: 0.9 },
      { col: 10, degree: 4, len: 1, vel: 0.78 },
      { col: 12, degree: 0, len: 2, vel: 0.92 },
      { col: 15, degree: 7, len: 1, vel: 0.68 },
    ]),
  },
  {
    id: 'elec-jam-floor',
    label: 'Electro Jam Floor',
    genre: "Electro '84",
    group: 'electro',
    soundPresetId: 'bass-mc202',
    defaultGate: 0.6,
    steps: electroFloorSteps([
      { col: 0, degree: 0, len: 2, vel: 1 },
      { col: 2, degree: 0, len: 1, vel: 0.9 },
      { col: 4, degree: 0, len: 2, vel: 0.94 },
      { col: 6, degree: 4, len: 1, vel: 0.78 },
      { col: 8, degree: 0, len: 2, vel: 0.96 },
      { col: 10, degree: 0, len: 1, vel: 0.86 },
      { col: 12, degree: 0, len: 2, vel: 0.92 },
      { col: 14, degree: 7, len: 1, vel: 0.74 },
    ]),
  },
  {
    id: 'elec-break-bounce',
    label: '84 Break Bounce',
    genre: "Electro '84",
    group: 'electro',
    soundPresetId: 'bass-tr808',
    defaultGate: 0.62,
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 3, vel: 1 },
      { col: 4, degree: 0, len: 1, vel: 0.88 },
      { col: 6, degree: 4, len: 2, vel: 0.82 },
      { col: 9, degree: 0, len: 2, vel: 0.92 },
      { col: 12, degree: 0, len: 2, vel: 0.9 },
      { col: 14, degree: 4, len: 1, vel: 0.76 },
    ]),
  },
];

/** R&B held-note helper — long lenCols, downbeat weight (Motown / slow-jam pocket). */
function rnbHoldSteps(
  hits: readonly { col: number; degree: number; len: number; vel?: number }[],
): GenoBassGrooveStepTemplate[] {
  return hits.map((h) => ({
    colInBar: h.col,
    degree: h.degree,
    lenCols: h.len,
    vel: h.vel ?? (h.col % 4 === 0 ? 1 : h.col % 4 === 2 ? 0.84 : 0.78),
  }));
}

/**
 * R&B / Soul basslines — 70s & 90s pockets with long root holds and tasteful 5ths.
 * Authored for legato gate (0.72–0.88) — bass sits in the pocket, not staccato bounce.
 */
const RNB_BASSLINE_PRESETS_DRAFT: readonly GenoBassGroovePresetDraft[] = [
  /* ── 70s ── */
  {
    id: 'rnb70-motown-hold',
    label: '70s Motown Hold',
    genre: '70s R&B',
    group: 'rnb',
    soundPresetId: 'bass-mini-moog',
    defaultGate: 0.82,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 6, vel: 1 },
      { col: 8, degree: 0, len: 4, vel: 0.9 },
      { col: 12, degree: 4, len: 3, vel: 0.82 },
    ]),
  },
  {
    id: 'rnb70-philly-root',
    label: 'Philly Soul Root',
    genre: '70s R&B',
    group: 'rnb',
    soundPresetId: 'bass-prophet',
    defaultGate: 0.8,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 5, vel: 1 },
      { col: 6, degree: 4, len: 3, vel: 0.86 },
      { col: 10, degree: 0, len: 6, vel: 0.92 },
    ]),
  },
  {
    id: 'rnb70-jamerson-walk',
    label: '70s Bass Walk',
    genre: '70s R&B',
    group: 'rnb',
    soundPresetId: 'bass-phase',
    defaultGate: 0.76,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 3, vel: 0.98 },
      { col: 4, degree: 2, len: 3, vel: 0.82 },
      { col: 8, degree: 4, len: 3, vel: 0.88 },
      { col: 12, degree: 2, len: 3, vel: 0.8 },
    ]),
  },
  {
    id: 'rnb70-stax-pocket',
    label: 'Stax Memphis Pocket',
    genre: '70s R&B',
    group: 'rnb',
    soundPresetId: 'bass-taurus',
    defaultGate: 0.84,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 7, vel: 1 },
      { col: 10, degree: 4, len: 2, vel: 0.84 },
      { col: 14, degree: 0, len: 2, vel: 0.88 },
    ]),
  },
  {
    id: 'rnb70-chicago-soul',
    label: 'Chicago Soul',
    genre: '70s R&B',
    group: 'rnb',
    soundPresetId: 'bass-model-d',
    defaultGate: 0.78,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 4, vel: 1 },
      { col: 5, degree: 4, len: 3, vel: 0.82 },
      { col: 9, degree: 0, len: 7, vel: 0.9 },
    ]),
  },
  {
    id: 'rnb70-disco-soul',
    label: 'Disco Soul Groove',
    genre: '70s R&B',
    group: 'rnb',
    soundPresetId: 'bass-juno106',
    defaultGate: 0.74,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 3, vel: 1 },
      { col: 4, degree: 4, len: 2, vel: 0.8 },
      { col: 8, degree: 0, len: 4, vel: 0.92 },
      { col: 13, degree: 4, len: 2, vel: 0.78 },
    ]),
  },
  {
    id: 'rnb70-ohio-pocket',
    label: '70s Funk Pocket',
    genre: '70s R&B',
    group: 'rnb',
    soundPresetId: 'bass-kingdom',
    defaultGate: 0.86,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 8, vel: 1 },
      { col: 9, degree: 4, len: 3, vel: 0.84 },
      { col: 14, degree: 0, len: 2, vel: 0.9 },
    ]),
  },
  {
    id: 'rnb70-marvin-groove',
    label: 'Marvin Slow Groove',
    genre: '70s R&B',
    group: 'rnb',
    soundPresetId: 'bass-phase',
    defaultGate: 0.88,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 5, vel: 1 },
      { col: 6, degree: 4, len: 2, vel: 0.8 },
      { col: 9, degree: 0, len: 7, vel: 0.92 },
    ]),
  },
  {
    id: 'rnb70-heatwave',
    label: 'Heatwave Boogie',
    genre: '70s R&B',
    group: 'rnb',
    soundPresetId: 'bass-odyssey',
    defaultGate: 0.72,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 2, vel: 1 },
      { col: 3, degree: 7, len: 2, vel: 0.74 },
      { col: 6, degree: 0, len: 4, vel: 0.9 },
      { col: 11, degree: 4, len: 2, vel: 0.82 },
      { col: 14, degree: 0, len: 2, vel: 0.86 },
    ]),
  },
  {
    id: 'rnb70-curtis-groove',
    label: '70s Soul Glide',
    genre: '70s R&B',
    group: 'rnb',
    soundPresetId: 'bass-prophet',
    defaultGate: 0.86,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 6, vel: 1 },
      { col: 7, degree: 2, len: 2, vel: 0.78 },
      { col: 10, degree: 0, len: 6, vel: 0.9 },
    ]),
  },
  /* ── 90s ── */
  {
    id: 'rnb90-newjack',
    label: '90s New Jack Swing',
    genre: '90s R&B',
    group: 'rnb',
    soundPresetId: 'bass-sh101',
    defaultGate: 0.7,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 4, vel: 1 },
      { col: 5, degree: 4, len: 2, vel: 0.82 },
      { col: 8, degree: 0, len: 4, vel: 0.92 },
      { col: 13, degree: 4, len: 2, vel: 0.78 },
    ]),
  },
  {
    id: 'rnb90-slowjam',
    label: '90s Slow Jam',
    genre: '90s R&B',
    group: 'rnb',
    soundPresetId: 'bass-sub-long',
    defaultGate: 0.9,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 10, vel: 1 },
      { col: 11, degree: 4, len: 2, vel: 0.8 },
      { col: 14, degree: 0, len: 2, vel: 0.86 },
    ]),
  },
  {
    id: 'rnb90-boyz-pocket',
    label: '90s Harmony Pocket',
    genre: '90s R&B',
    group: 'rnb',
    soundPresetId: 'bass-phase',
    defaultGate: 0.82,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 5, vel: 1 },
      { col: 6, degree: 4, len: 2, vel: 0.8 },
      { col: 9, degree: 0, len: 4, vel: 0.9 },
      { col: 14, degree: 4, len: 2, vel: 0.76 },
    ]),
  },
  {
    id: 'rnb90-guy-groove',
    label: '90s Rubber Groove',
    genre: '90s R&B',
    group: 'rnb',
    soundPresetId: 'bass-dxrubber',
    defaultGate: 0.76,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 4, vel: 1 },
      { col: 4, degree: 0, len: 2, vel: 0.88 },
      { col: 7, degree: 4, len: 3, vel: 0.82 },
      { col: 12, degree: 0, len: 4, vel: 0.9 },
    ]),
  },
  {
    id: 'rnb90-jodeci-hold',
    label: '90s Deep Hold',
    genre: '90s R&B',
    group: 'rnb',
    soundPresetId: 'bass-sub-long',
    defaultGate: 0.88,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 12, vel: 1 },
      { col: 13, degree: 4, len: 3, vel: 0.78 },
    ]),
  },
  {
    id: 'rnb90-sub-hold',
    label: '90s Sub Hold',
    genre: '90s R&B',
    group: 'rnb',
    soundPresetId: 'bass-club-sub',
    defaultGate: 0.84,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 6, vel: 1 },
      { col: 7, degree: 4, len: 2, vel: 0.76 },
      { col: 10, degree: 0, len: 6, vel: 0.88 },
    ]),
  },
  {
    id: 'rnb90-rkelly',
    label: '90s Pocket',
    genre: '90s R&B',
    group: 'rnb',
    soundPresetId: 'bass-phase',
    defaultGate: 0.8,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 4, vel: 1 },
      { col: 5, degree: 4, len: 3, vel: 0.82 },
      { col: 10, degree: 0, len: 3, vel: 0.9 },
      { col: 14, degree: 4, len: 2, vel: 0.74 },
    ]),
  },
  {
    id: 'rnb90-tony-toni',
    label: '90s Bounce Line',
    genre: '90s R&B',
    group: 'rnb',
    soundPresetId: 'bass-funk-rubber',
    defaultGate: 0.74,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 3, vel: 1 },
      { col: 4, degree: 4, len: 2, vel: 0.8 },
      { col: 7, degree: 0, len: 2, vel: 0.88 },
      { col: 10, degree: 4, len: 3, vel: 0.76 },
      { col: 14, degree: 0, len: 2, vel: 0.84 },
    ]),
  },
  {
    id: 'rnb90-babyface',
    label: '90s Ballad Hold',
    genre: '90s R&B',
    group: 'rnb',
    soundPresetId: 'bass-mini-moog',
    defaultGate: 0.86,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 8, vel: 1 },
      { col: 9, degree: 4, len: 2, vel: 0.78 },
      { col: 12, degree: 0, len: 4, vel: 0.9 },
    ]),
  },
  {
    id: 'rnb90-midnight',
    label: 'Midnight 90s',
    genre: '90s R&B',
    group: 'rnb',
    soundPresetId: 'bass-prophet',
    defaultGate: 0.82,
    steps: rnbHoldSteps([
      { col: 0, degree: 0, len: 6, vel: 1 },
      { col: 7, degree: 4, len: 2, vel: 0.8 },
      { col: 10, degree: 0, len: 4, vel: 0.88 },
      { col: 14, degree: 7, len: 2, vel: 0.72 },
    ]),
  },
];

/**
 * Producer-grade demo basslines — staccato syncopation, octave bounce, off-beat drive.
 * Leading entries tuned for Bass Dragon–style pocket (root / 5th / octave / walk).
 */
const PRODUCER_BASSLINE_PRESETS_DRAFT: readonly GenoBassGroovePresetDraft[] = [
  {
    id: 'bd-rnb-pocket',
    label: 'R&B Silk Pocket',
    genre: 'R&B',
    group: 'hits',
    soundPresetId: 'bass-phase',
    defaultGate: 0.58,
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 3, vel: 1 },
      { col: 5, degree: 4, len: 1, vel: 0.76 },
      { col: 7, degree: 0, len: 2, vel: 0.88 },
      { col: 11, degree: 4, len: 1, vel: 0.72 },
      { col: 14, degree: 0, len: 1, vel: 0.82 },
    ]),
  },
  {
    id: 'bd-trap-glide',
    label: 'Trap 808 Glide',
    genre: 'Trap',
    group: 'hits',
    soundPresetId: 'bass-tr808',
    defaultGate: 0.72,
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 5, vel: 1 },
      { col: 7, degree: 4, len: 1, vel: 0.7 },
      { col: 9, degree: 0, len: 1, vel: 0.8 },
      { col: 12, degree: 7, len: 2, vel: 0.74 },
      { col: 15, degree: 4, len: 1, vel: 0.68 },
    ]),
  },
  {
    id: 'bd-gospel-walk',
    label: 'Gospel Walk',
    genre: 'Gospel',
    group: 'hits',
    soundPresetId: 'bass-mini-moog',
    defaultGate: 0.62,
    steps: ncBounceSteps([
      { col: 0, degree: 0, vel: 0.98 },
      { col: 4, degree: 2, vel: 0.78 },
      { col: 8, degree: 4, vel: 0.86 },
      { col: 12, degree: 2, vel: 0.74 },
    ]),
  },
  {
    id: 'bd-funk-slaps',
    label: 'Funk Slap Pocket',
    genre: 'Funk',
    group: 'hits',
    soundPresetId: 'bass-funk-rubber',
    defaultGate: GENO_BASS_DEFAULT_GATE,
    steps: ncBounceSteps([
      { col: 0, degree: 0, vel: 1 },
      { col: 2, degree: 0, vel: 0.58 },
      { col: 5, degree: 4, vel: 0.82 },
      { col: 7, degree: 0, vel: 0.7 },
      { col: 10, degree: 7, vel: 0.76 },
      { col: 13, degree: 4, vel: 0.8 },
      { col: 15, degree: 0, vel: 0.64 },
    ]),
  },
  {
    id: 'bd-pop-anchor',
    label: 'Pop Sub Anchor',
    genre: 'Pop',
    group: 'hits',
    soundPresetId: 'bass-club-sub',
    defaultGate: 0.6,
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 4, vel: 1 },
      { col: 6, degree: 4, len: 2, vel: 0.8 },
      { col: 10, degree: 0, len: 2, vel: 0.9 },
      { col: 14, degree: 4, len: 1, vel: 0.74 },
    ]),
  },
  {
    id: 'bd-drill-stab',
    label: 'Drill Stab',
    genre: 'Drill',
    group: 'hits',
    soundPresetId: 'bass-deep-roller',
    defaultGate: 0.5,
    steps: ncBounceSteps([
      { col: 0, degree: 0, vel: 1 },
      { col: 3, degree: 0, vel: 0.84 },
      { col: 6, degree: 7, vel: 0.68 },
      { col: 9, degree: 0, vel: 0.92 },
      { col: 12, degree: 4, vel: 0.72 },
      { col: 15, degree: 0, vel: 0.86 },
    ]),
  },
  {
    id: 'bd-house-groove',
    label: 'House Offbeat',
    genre: 'House',
    group: 'hits',
    soundPresetId: 'bass-sh101',
    defaultGate: GENO_BASS_DEFAULT_GATE,
    steps: ncBounceSteps([
      { col: 0, degree: 0, vel: 1 },
      { col: 3, degree: 4, vel: 0.74 },
      { col: 6, degree: 0, vel: 0.88 },
      { col: 9, degree: 4, vel: 0.72 },
      { col: 12, degree: 0, vel: 0.9 },
      { col: 14, degree: 7, vel: 0.68 },
    ]),
  },
  {
    id: 'bd-neo-chrome',
    label: 'Neo-Soul Chrome',
    genre: 'Neo-Soul',
    group: 'hits',
    soundPresetId: 'bass-phase',
    defaultGate: 0.56,
    steps: ncBounceSteps([
      { col: 0, degree: 0, vel: 0.96 },
      { col: 3, degree: 2, vel: 0.74 },
      { col: 6, degree: 4, vel: 0.84 },
      { col: 9, degree: 2, vel: 0.72 },
      { col: 12, degree: 0, vel: 0.9 },
      { col: 15, degree: 4, vel: 0.76 },
    ]),
  },
  {
    id: 'prod-drive-bounce',
    label: 'Drive Bounce',
    genre: 'Club',
    group: 'hits',
    soundPresetId: 'bass-sh101',
    defaultGate: GENO_BASS_DEFAULT_GATE,
    steps: ncBounceSteps([
      { col: 0, degree: 0, vel: 1 },
      { col: 2, degree: 7, vel: 0.7 },
      { col: 4, degree: 0, vel: 0.88 },
      { col: 7, degree: 4, vel: 0.72 },
      { col: 10, degree: 0, vel: 0.86 },
      { col: 13, degree: 7, vel: 0.66 },
      { col: 15, degree: 4, vel: 0.78 },
    ]),
  },
  {
    id: 'prod-oct-roll',
    label: 'Octave Roll',
    genre: 'Electro',
    group: 'hits',
    soundPresetId: 'bass-mc202',
    defaultGate: GENO_BASS_DEFAULT_GATE,
    steps: ncBounceSteps([
      { col: 0, degree: 0, vel: 1 },
      { col: 2, degree: 7, vel: 0.74 },
      { col: 4, degree: 0, vel: 0.9 },
      { col: 6, degree: 7, vel: 0.7 },
      { col: 8, degree: 0, vel: 0.92 },
      { col: 10, degree: 7, vel: 0.68 },
      { col: 12, degree: 4, vel: 0.82 },
      { col: 14, degree: 7, vel: 0.72 },
    ]),
  },
  {
    id: 'prod-wc-cruise',
    label: 'West Coast Cruise',
    genre: 'G-Funk',
    group: 'hits',
    soundPresetId: 'bass-phase',
    defaultGate: GENO_BASS_DEFAULT_GATE,
    steps: ncBounceSteps([
      { col: 0, degree: 0, vel: 1 },
      { col: 3, degree: 7, vel: 0.7 },
      { col: 6, degree: 0, vel: 0.9 },
      { col: 9, degree: 4, vel: 0.74 },
      { col: 12, degree: 0, vel: 0.88 },
      { col: 15, degree: 7, vel: 0.66 },
    ]),
  },
  {
    id: 'prod-g-funk-bounce',
    label: 'G-Funk Bounce',
    genre: 'G-Funk',
    group: 'hits',
    soundPresetId: 'bass-boogie',
    defaultGate: GENO_BASS_DEFAULT_GATE,
    steps: ncBounceSteps([
      { col: 0, degree: 0, vel: 1 },
      { col: 3, degree: 4, vel: 0.72 },
      { col: 5, degree: 0, vel: 0.84 },
      { col: 7, degree: 7, vel: 0.68 },
      { col: 10, degree: 0, vel: 0.9 },
      { col: 13, degree: 4, vel: 0.7 },
    ]),
  },
  {
    id: 'prod-funk-bootsy',
    label: 'Funk Bootsy Pocket',
    genre: 'Funk',
    group: 'hits',
    soundPresetId: 'bass-funk-rubber',
    defaultGate: GENO_BASS_DEFAULT_GATE,
    steps: ncBounceSteps([
      { col: 0, degree: 0, vel: 1 },
      { col: 2, degree: 0, vel: 0.62 },
      { col: 5, degree: 4, vel: 0.8 },
      { col: 7, degree: 0, vel: 0.72 },
      { col: 10, degree: 7, vel: 0.74 },
      { col: 13, degree: 4, vel: 0.78 },
      { col: 15, degree: 0, vel: 0.66 },
    ]),
  },
  {
    id: 'prod-funk-chic',
    label: 'Disco Chic Line',
    genre: 'Disco',
    group: 'hits',
    soundPresetId: 'bass-slap',
    defaultGate: GENO_BASS_DEFAULT_GATE,
    steps: ncBounceSteps([
      { col: 0, degree: 0, vel: 1 },
      { col: 3, degree: 4, vel: 0.74 },
      { col: 6, degree: 0, vel: 0.9 },
      { col: 9, degree: 4, vel: 0.72 },
      { col: 12, degree: 0, vel: 0.88 },
      { col: 15, degree: 4, vel: 0.7 },
    ]),
  },
  {
    id: 'prod-metro-hold',
    label: 'Metro 808 Punch',
    genre: 'Trap',
    group: 'hits',
    soundPresetId: 'bass-tr808',
    defaultGate: 0.68,
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 2, vel: 1 },
      { col: 6, degree: 0, len: 1, vel: 0.78 },
      { col: 8, degree: 4, len: 1, vel: 0.72 },
      { col: 11, degree: 0, len: 1, vel: 0.86 },
      { col: 14, degree: 7, len: 1, vel: 0.68 },
    ]),
  },
  {
    id: 'prod-drill-punch',
    label: 'Drill Punch',
    genre: 'Drill',
    group: 'hits',
    soundPresetId: 'bass-deep-roller',
    defaultGate: GENO_BASS_DEFAULT_GATE,
    steps: ncBounceSteps([
      { col: 0, degree: 0, vel: 1 },
      { col: 2, degree: 0, vel: 0.82 },
      { col: 5, degree: 7, vel: 0.7 },
      { col: 8, degree: 0, vel: 0.94 },
      { col: 11, degree: 4, vel: 0.74 },
      { col: 14, degree: 0, vel: 0.86 },
    ]),
  },
  {
    id: 'prod-house-pump',
    label: 'House Pump',
    genre: 'House',
    group: 'hits',
    soundPresetId: 'bass-sh101',
    defaultGate: GENO_BASS_DEFAULT_GATE,
    steps: ncBounceSteps([
      { col: 0, degree: 0, vel: 1 },
      { col: 2, degree: 4, vel: 0.72 },
      { col: 4, degree: 0, vel: 0.88 },
      { col: 6, degree: 4, vel: 0.7 },
      { col: 8, degree: 0, vel: 0.92 },
      { col: 10, degree: 7, vel: 0.68 },
      { col: 12, degree: 0, vel: 0.86 },
      { col: 14, degree: 4, vel: 0.74 },
    ]),
  },
  {
    id: 'prod-rock-drive',
    label: 'Rock Root–5th Drive',
    genre: 'Rock',
    group: 'hits',
    soundPresetId: 'bass-mini-moog',
    defaultGate: GENO_BASS_DEFAULT_GATE,
    steps: ncBounceSteps([
      { col: 0, degree: 0, vel: 1 },
      { col: 3, degree: 4, vel: 0.74 },
      { col: 6, degree: 0, vel: 0.9 },
      { col: 9, degree: 4, vel: 0.72 },
      { col: 12, degree: 0, vel: 0.88 },
      { col: 15, degree: 4, vel: 0.7 },
    ]),
  },
  {
    id: 'prod-rnb-silk',
    label: 'R&B Silk Sub',
    genre: 'R&B',
    group: 'hits',
    soundPresetId: 'bass-dub-sub',
    defaultGate: 0.62,
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 2, vel: 1 },
      { col: 6, degree: 0, len: 1, vel: 0.8 },
      { col: 9, degree: 4, len: 1, vel: 0.72 },
      { col: 12, degree: 0, len: 1, vel: 0.86 },
      { col: 15, degree: 4, len: 1, vel: 0.68 },
    ]),
  },
  {
    id: 'prod-daft-pocket',
    label: 'French House Pocket',
    genre: 'House',
    group: 'hits',
    soundPresetId: 'bass-prophet',
    defaultGate: GENO_BASS_DEFAULT_GATE,
    steps: ncBounceSteps([
      { col: 0, degree: 0, vel: 1 },
      { col: 2, degree: 4, vel: 0.74 },
      { col: 5, degree: 0, vel: 0.86 },
      { col: 7, degree: 4, vel: 0.7 },
      { col: 10, degree: 0, vel: 0.9 },
      { col: 13, degree: 7, vel: 0.68 },
    ]),
  },
  {
    id: 'prod-trap-heart',
    label: 'Trap Heartbreak',
    genre: 'Trap',
    group: 'hits',
    soundPresetId: 'bass-trap-sub',
    defaultGate: 0.66,
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 3, vel: 1 },
      { col: 7, degree: 4, len: 1, vel: 0.74 },
      { col: 10, degree: 0, len: 1, vel: 0.82 },
      { col: 13, degree: 4, len: 1, vel: 0.7 },
    ]),
  },
  {
    id: 'prod-club-anchor',
    label: 'Club Anchor',
    genre: 'Pop',
    group: 'hits',
    soundPresetId: 'bass-club-sub',
    defaultGate: GENO_BASS_DEFAULT_GATE,
    steps: ncBounceSteps([
      { col: 0, degree: 0, vel: 1 },
      { col: 4, degree: 4, vel: 0.76 },
      { col: 6, degree: 0, vel: 0.84 },
      { col: 9, degree: 4, vel: 0.72 },
      { col: 12, degree: 0, vel: 0.9 },
      { col: 15, degree: 4, vel: 0.68 },
    ]),
  },
];

/** Iconic synth basslines — curated for Geno Bass (not in Groove Lab). */
const GENO_BASS_ICONIC_PRESETS_DRAFT: readonly GenoBassGroovePresetDraft[] = [
  {
    id: 'billie-groove',
    label: 'Billie Groove',
    genre: 'Pop',
    group: 'pop',
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 3, vel: 1 },
      { col: 6, degree: 0, len: 2, vel: 0.9 },
      { col: 10, degree: 7, len: 2, vel: 0.78 },
      { col: 14, degree: 0, len: 1, vel: 0.84 },
    ]),
  },
  {
    id: 'another-one',
    label: 'Another One',
    genre: 'Rock',
    group: 'funk',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 3, vel: 1 },
      { colInBar: 6, degree: 4, lenCols: 2, vel: 0.9 },
      { colInBar: 10, degree: 0, lenCols: 2, vel: 0.94 },
      { colInBar: 14, degree: 4, lenCols: 1, vel: 0.82 },
    ],
  },
  {
    id: 'silk-funk',
    label: 'Silk Funk',
    genre: 'Funk',
    group: 'funk',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 5, vel: 0.98 },
      { colInBar: 6, degree: 0, lenCols: 2, vel: 0.76 },
      { colInBar: 10, degree: 4, lenCols: 3, vel: 0.86 },
      { colInBar: 14, degree: 4, lenCols: 2, vel: 0.9 },
    ],
  },
  {
    id: 'silk-funk-alt',
    label: 'Silk Funk II',
    genre: 'Funk',
    group: 'funk',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 4, vel: 0.96 },
      { colInBar: 4, degree: 0, lenCols: 2, vel: 0.82 },
      { colInBar: 8, degree: 4, lenCols: 3, vel: 0.92 },
      { colInBar: 13, degree: 4, lenCols: 3, vel: 0.78 },
    ],
  },
  {
    id: 'kpop-pocket',
    label: 'K-Pop Pocket',
    genre: 'K-Pop',
    group: 'pop',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 3, vel: 0.94 },
      { colInBar: 4, degree: 0, lenCols: 2, vel: 0.82 },
      { colInBar: 7, degree: 4, lenCols: 2, vel: 0.88 },
      { colInBar: 10, degree: 0, lenCols: 2, vel: 0.9 },
      { colInBar: 14, degree: 4, lenCols: 2, vel: 0.84 },
    ],
  },
  {
    id: 'daft-lucky',
    label: 'Daft Lucky',
    genre: 'House',
    group: 'synth',
    steps: ncBasslineSteps([
      { col: 0, degree: 0, len: 4, vel: 1 },
      { col: 8, degree: 0, len: 3, vel: 0.92 },
      { col: 13, degree: 4, len: 2, vel: 0.84 },
    ]),
  },
  {
    id: 'dembow-pr',
    label: 'Dembow PR',
    genre: 'Reggaeton',
    group: 'funk',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 2, vel: 1 },
      { colInBar: 3, degree: 0, lenCols: 1, vel: 0.88 },
      { colInBar: 6, degree: 0, lenCols: 2, vel: 0.92 },
      { colInBar: 9, degree: 4, lenCols: 2, vel: 0.86 },
      { colInBar: 12, degree: 0, lenCols: 2, vel: 0.9 },
      { colInBar: 14, degree: 7, lenCols: 1, vel: 0.78 },
    ],
  },
  {
    id: 'house-shuffle',
    label: 'House Shuffle',
    genre: 'House',
    group: 'synth',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 2, vel: 1 },
      { colInBar: 5, degree: 4, lenCols: 1, vel: 0.84 },
      { colInBar: 8, degree: 0, lenCols: 2, vel: 0.92 },
      { colInBar: 11, degree: 2, lenCols: 1, vel: 0.8 },
      { colInBar: 14, degree: 4, lenCols: 1, vel: 0.86 },
    ],
  },
  {
    id: 'neo-soul-walk',
    label: 'Neo-Soul Walk',
    genre: 'Neo-Soul',
    group: 'funk',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 2, vel: 0.95 },
      { colInBar: 3, degree: 2, lenCols: 1, vel: 0.82 },
      { colInBar: 6, degree: 4, lenCols: 2, vel: 0.88 },
      { colInBar: 10, degree: 5, lenCols: 1, vel: 0.8 },
      { colInBar: 12, degree: 4, lenCols: 2, vel: 0.86 },
      { colInBar: 15, degree: 2, lenCols: 1, vel: 0.78 },
    ],
  },
  {
    id: 'tay-bounce',
    label: 'Tay Bounce',
    genre: 'Trap',
    group: '808',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 5, vel: 1 },
      { colInBar: 6, degree: 0, lenCols: 1, vel: 0.8 },
      { colInBar: 8, degree: 7, lenCols: 2, vel: 0.86 },
      { colInBar: 11, degree: 4, lenCols: 2, vel: 0.82 },
      { colInBar: 14, degree: 2, lenCols: 1, vel: 0.76 },
    ],
  },
  {
    id: 'heartbreak-808',
    label: 'Heartbreak 808',
    genre: 'Trap',
    group: '808',
    steps: [
      { colInBar: 0, degree: 0, lenCols: 8, vel: 1 },
      { colInBar: 10, degree: 4, lenCols: 3, vel: 0.84 },
      { colInBar: 14, degree: 0, lenCols: 1, vel: 0.72 },
    ],
  },
];

const BAR_PHRASE_BY_ID: Record<string, readonly number[]> = {
  ...GROOVE_BAR_PHRASE,
  'billie-groove': [0, 0, 4, 0],
  'another-one': [0, 0, 0, 4],
  'silk-funk': [0, 0, 2, 5],
  'silk-funk-alt': [0, 2, 0, 5],
  'kpop-pocket': [0, 0, 4, 2],
  'daft-lucky': [0, 0, 7, 4],
  'ek-kingdom-groove': [0, 0, 4, 7],
  'ek-kingdom-oct': [0, 0, 0, 7],
  'ek-kingdom-pulse': [0, 0, 4, 0],
  'ek-kingdom-hook': [0, 0, 7, 4],
  'pp-risk-groove': [0, 0, 4, 0],
  'pp-risk-drive': [0, 0, 0, 4],
  'pp-risk-pocket': [0, 0, 4, 0],
  'pp-risk-hook': [0, 2, 0, 4],
  'ek-siberian-funk': [0, 0, 2, 4],
  'ek-siberian-thump': [0, 0, 0, 4],
  'nc-push-kick': [0, 0, 4, 0],
  'nc-root5-8th': [0, 0, 0, 4],
  'nc-age-sync': [0, 0, 2, 0],
  'nc-push-button': [0, 0, 0, 7],
  'nc-computer-hook': [0, 4, 0, 4],
  'dembow-pr': [0, 0, 5, 0],
  'house-shuffle': [0, 4, 0, 2],
  'neo-soul-walk': [0, 0, 2, 4],
  'tay-bounce': [0, 0, 7, 5],
  'heartbreak-808': [0, 4, 0, 0],
  'prod-wc-cruise': [0, 0, 4, 7],
  'prod-drive-bounce': [0, 7, 0, 4],
  'prod-oct-roll': [0, 7, 4, 7],
  'prod-g-funk-bounce': [0, 0, 4, 0],
  'prod-funk-bootsy': [0, 0, 4, 7],
  'prod-funk-chic': [0, 4, 0, 4],
  'prod-metro-hold': [0, 4, 0, 0],
  'prod-drill-punch': [0, 0, 4, 0],
  'prod-house-pump': [0, 0, 7, 0],
  'prod-rock-drive': [0, 0, 4, 0],
  'prod-rnb-silk': [0, 0, 0, 4],
  'prod-daft-pocket': [0, 4, 0, 4],
  'prod-trap-heart': [0, 4, 0, 0],
  'prod-club-anchor': [0, 0, 4, 0],
  'bd-rnb-pocket': [0, 0, 4, 2],
  'bd-trap-glide': [0, 4, 0, 7],
  'bd-gospel-walk': [0, 0, 2, 4],
  'bd-funk-slaps': [0, 0, 4, 7],
  'bd-pop-anchor': [0, 0, 4, 0],
  'bd-drill-stab': [0, 0, 7, 4],
  'bd-house-groove': [0, 4, 0, 7],
  'bd-neo-chrome': [0, 0, 2, 5],
  'rnb70-motown-hold': [0, 0, 4, 0],
  'rnb70-philly-root': [0, 0, 0, 4],
  'rnb70-jamerson-walk': [0, 0, 2, 4],
  'rnb70-stax-pocket': [0, 0, 4, 0],
  'rnb70-chicago-soul': [0, 0, 4, 2],
  'rnb70-disco-soul': [0, 4, 0, 4],
  'rnb70-ohio-pocket': [0, 0, 0, 4],
  'rnb70-marvin-groove': [0, 0, 2, 0],
  'rnb70-heatwave': [0, 0, 7, 4],
  'rnb70-curtis-groove': [0, 0, 2, 4],
  'rnb90-newjack': [0, 0, 4, 0],
  'rnb90-slowjam': [0, 0, 0, 0],
  'rnb90-boyz-pocket': [0, 0, 4, 2],
  'rnb90-guy-groove': [0, 0, 0, 4],
  'rnb90-jodeci-hold': [0, 0, 0, 4],
  'rnb90-sub-hold': [0, 4, 0, 0],
  'rnb90-rkelly': [0, 0, 4, 0],
  'rnb90-tony-toni': [0, 4, 0, 2],
  'rnb90-babyface': [0, 0, 2, 0],
  'rnb90-midnight': [0, 0, 4, 7],
  'elec-kingdom-floor': [0, 0, 4, 7],
  'elec-oct-floor': [0, 0, 0, 7],
  'elec-84-drive': [0, 0, 2, 4],
  'elec-miami-thump': [0, 7, 0, 4],
  'elec-808-pocket': [0, 0, 4, 0],
  'elec-kick-lock': [0, 0, 0, 4],
  'elec-16th-rush': [0, 7, 4, 7],
  'elec-booty-bounce': [0, 0, 7, 4],
  'elec-jam-floor': [0, 0, 0, 7],
  'elec-break-bounce': [0, 0, 4, 0],
};

const DEFAULT_BAR_PHRASE = [0, 0, 4, 0] as const;

export const GENO_BASS_GROOVE_PRESETS: readonly GenoBassGroovePreset[] = [
  ...finalizeGenoBassGroovePresets(RNB_BASSLINE_PRESETS_DRAFT),
  ...finalizeGenoBassGroovePresets(MIAMI_ELECTRO_BASSLINE_PRESETS_DRAFT),
  ...finalizeGenoBassGroovePresets(PRODUCER_BASSLINE_PRESETS_DRAFT),
  ...GROOVE_LAB_BASS_GROOVES.map(grooveLabToGenoPreset),
  ...finalizeGenoBassGroovePresets(GENO_BASS_ICONIC_PRESETS_DRAFT),
  ...finalizeGenoBassGroovePresets(TWILIGHT22_ELECTRO_PRESETS_DRAFT),
  ...finalizeGenoBassGroovePresets(PLANET_PATROL_RISK_BASSLINE_PRESETS_DRAFT),
  ...finalizeGenoBassGroovePresets(NEWCLEUS_BASSLINE_PRESETS_DRAFT),
];

/** First preset users hear — classic Motown hold. */
export const GENO_BASS_GROOVE_DEFAULT_ID = 'rnb70-motown-hold';

export const GENO_BASS_GROOVE_GROUPS = [
  { id: 'my' as const, label: 'My Grooves' },
  { id: 'rnb' as const, label: 'R&B / Soul' },
  { id: 'electro' as const, label: '80s Electro' },
  { id: 'hits' as const, label: 'Producer Hits' },
  { id: '808' as const, label: '808 / Trap' },
  { id: 'synth' as const, label: 'Synth / Electro' },
  { id: 'funk' as const, label: 'Funk / Walk' },
  { id: 'pop' as const, label: 'Pop / Disco' },
] as const;

export function genoBassGroovePresetById(id: string): GenoBassGroovePreset {
  return GENO_BASS_GROOVE_PRESETS.find((p) => p.id === id) ?? GENO_BASS_GROOVE_PRESETS[0]!;
}

export function genoBassDegreeToMidi(
  rootMidi: number,
  degree: number,
  mode: GenoBassKeyMode = 'major',
): number {
  return genoBassDegreeToMidiInKey(rootMidi, degree, mode);
}

function grooveStepVelocity(tpl: GenoBassGrooveStepTemplate, rnd: () => number): number {
  const col = tpl.colInBar;
  const base = tpl.vel ?? 0.86;
  let vel = base;
  if (col % 4 === 0) vel = Math.min(1, base + 0.08);
  else if (col % 4 === 2) vel = base * 0.8;
  else if (col % 2 === 1) vel = base * 0.72;
  if (tpl.degree === 7) vel *= 0.92;
  vel += (rnd() - 0.5) * 0.07;
  return Math.max(0.52, Math.min(1, vel));
}

function quantDivisions(quant: GenoBassGrooveQuantize): number {
  return quant === '8' ? 8 : quant === '32' ? 32 : 16;
}

/** Map authored 16th steps onto 1/8 · 1/16 · 1/32 bar grid. */
function stepTimingFromQuant(
  bar: number,
  colInBar: number,
  lenCols: number,
  quant: GenoBassGrooveQuantize,
  swing: boolean,
): { startBeat: number; stepBeats: number } {
  const div = quantDivisions(quant);
  const posInBar = colInBar / GENO_BASS_SIXTEENTHS_PER_BAR;
  const snapped = Math.round(posInBar * div) / div;
  let startBeat = bar * BEATS_PER_BAR + snapped * BEATS_PER_BAR;
  if (swing && quant !== '8') {
    const colOnDiv = Math.round(snapped * div);
    if (colOnDiv % 2 === 1) startBeat += GENO_BASS_SWING_PUSH * (SIXTEENTH_BEATS * (16 / div));
    else if (colOnDiv % 4 === 2) startBeat += GENO_BASS_SWING_PUSH * 0.55 * (SIXTEENTH_BEATS * (16 / div));
  }
  const lenInBar = lenCols / GENO_BASS_SIXTEENTHS_PER_BAR;
  const lenScaled =
    quant === '8'
      ? Math.min(1 - snapped, lenInBar * 1.9)
      : quant === '32'
        ? Math.max(MIN_DUR_BEATS / BEATS_PER_BAR, lenInBar * 0.52)
        : lenInBar;
  return { startBeat, stepBeats: lenScaled * BEATS_PER_BAR };
}

function gateScaleForPreset(preset: GenoBassGroovePreset, gate: number): number {
  if (preset.group === 'rnb') {
    return 0.62 + gate * 0.36;
  }
  if (preset.group === 'electro') {
    return 0.44 + gate * 0.38;
  }
  const is808Hold = preset.group === '808' && preset.steps.some((s) => s.lenCols >= 5);
  if (is808Hold) return 0.48 + gate * 0.38;
  if (preset.group === 'hits') {
    return 0.36 + gate * 0.34;
  }
  if (preset.id.startsWith('nc-')) {
    return 0.4 + gate * 0.28;
  }
  if (preset.id.startsWith('ek-siberian') || preset.id.startsWith('ek-')) {
    return 0.38 + gate * 0.26;
  }
  if (preset.id.startsWith('ek-kingdom') || preset.id.startsWith('pp-risk')) {
    return 0.44 + gate * 0.32;
  }
  if (preset.group === '808') {
    return 0.46 + gate * 0.36;
  }
  if (preset.group === 'funk' || preset.group === 'pop') {
    return 0.38 + gate * 0.3;
  }
  return 0.4 + gate * 0.32;
}

/** Generate roll notes from a preset — fills the editable piano roll (Bassliner-style). */
export function genoBassPresetToRollNotes(opts: {
  presetId: string;
  barLength: number;
  rootMidi: number;
  gate?: number;
  seed?: number;
  quantize?: GenoBassGrooveQuantize;
  keyMode?: GenoBassKeyMode;
  mutate?: boolean;
}): GenoUltraArpSe2RollNote[] {
  const preset = genoBassGroovePresetById(opts.presetId);
  const bars = opts.barLength >= 8 ? 8 : 4;
  const quant = opts.quantize ?? GENO_BASS_DEFAULT_QUANTIZE;
  const gate = Math.max(0.35, Math.min(1, opts.gate ?? preset.defaultGate ?? GENO_BASS_DEFAULT_GATE));
  const gateScale = gateScaleForPreset(preset, gate);
  const phrase = BAR_PHRASE_BY_ID[preset.id] ?? DEFAULT_BAR_PHRASE;
  const seed = opts.seed ?? 42;
  const rnd = mulberry32(seed);
  const keyMode = opts.keyMode ?? 'major';
  const shouldMutate = opts.mutate === true;
  const steps = shouldMutate
    ? (genoBassMutateGrooveSteps(preset.steps, seed) as GenoBassGrooveStepTemplate[])
    : preset.steps;
  const hits: { startBeat: number; pitch: number; durationBeats: number; velocity: number }[] = [];
  const maxBeat = bars * BEATS_PER_BAR;

  for (let bar = 0; bar < bars; bar += 1) {
    const degreeShift = genoBassPhraseDegreeShift(phrase, bar, seed);
    for (const tpl of steps) {
      const degree = tpl.degree + degreeShift;
      const pitch = genoBassDegreeToMidi(opts.rootMidi, degree, keyMode);
      const { startBeat, stepBeats } = stepTimingFromQuant(bar, tpl.colInBar, tpl.lenCols, quant, true);
      if (startBeat >= maxBeat - MIN_DUR_BEATS) continue;
      const authoredDur = stepBeats * gateScale;
      const staccatoCap = stepBeats * (0.42 + gate * 0.22);
      const vel = grooveStepVelocity(tpl, rnd);
      hits.push({
        startBeat,
        pitch,
        durationBeats: Math.max(MIN_DUR_BEATS, Math.min(authoredDur, staccatoCap)),
        velocity: Math.max(88, Math.min(127, Math.round(vel * 122))),
      });
    }
  }

  hits.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);

  const merged: typeof hits = [];
  for (const hit of hits) {
    const prev = merged[merged.length - 1];
    if (prev && Math.abs(prev.startBeat - hit.startBeat) < 0.001 && prev.pitch === hit.pitch) {
      prev.velocity = Math.max(prev.velocity, hit.velocity);
      prev.durationBeats = Math.max(prev.durationBeats, hit.durationBeats);
      continue;
    }
    merged.push({ ...hit });
  }

  const out: GenoUltraArpSe2RollNote[] = [];
  for (let i = 0; i < merged.length; i += 1) {
    const cur = merged[i]!;
    const nextStart = i + 1 < merged.length ? merged[i + 1]!.startBeat : maxBeat;
    const maxDur = Math.max(MIN_DUR_BEATS, nextStart - cur.startBeat - STEP_GAP_BEATS);
    out.push({
      pitch: cur.pitch,
      startBeat: cur.startBeat,
      durationBeats: Math.min(cur.durationBeats, maxDur),
      velocity: cur.velocity,
    });
  }

  return out;
}

/** Bassliner-style “Create Similar” — swing + velocity + micro-timing humanization. */
export function genoBassSimilarRollNotes(
  notes: readonly GenoUltraArpSe2RollNote[],
  seed: number,
  barLength: number,
): GenoUltraArpSe2RollNote[] {
  const rnd = mulberry32(seed ^ 0x51a11a1);
  const maxBeat = (barLength >= 8 ? 8 : 4) * BEATS_PER_BAR;
  const degreePalette = [0, 2, 4, 7] as const;
  return notes.map((n, idx) => {
    const sixteenthIdx = Math.round(n.startBeat * 4) % 4;
    const swing =
      sixteenthIdx % 2 === 1
        ? GENO_BASS_SWING_PUSH * SIXTEENTH_BEATS
        : sixteenthIdx === 2
          ? GENO_BASS_SWING_PUSH * 0.5 * SIXTEENTH_BEATS
          : 0;
    const beatJitter = swing + (rnd() < 0.45 ? (rnd() - 0.5) * SIXTEENTH_BEATS * 0.5 : 0);
    const startBeat = Math.max(0, Math.min(maxBeat - MIN_DUR_BEATS, n.startBeat + beatJitter));
    const onDown = Math.round(n.startBeat * 4) % 4 === 0;
    const velDelta = Math.round((rnd() - 0.5) * 14 + (onDown ? 8 : -5));
    const durScale = 0.82 + rnd() * 0.14;
    let pitch = n.pitch;
    if (!onDown && rnd() < 0.18) {
      const delta = degreePalette[Math.floor(rnd() * degreePalette.length)]!;
      pitch = n.pitch + (delta === 7 ? 12 : delta === 4 ? 7 : delta === 2 ? 4 : 0);
      pitch = genoWrapMidiToRange(pitch, GENO_BASS_LOOP_EDITOR_MIN, GENO_BASS_LOOP_EDITOR_MAX);
    }
    return {
      ...n,
      startBeat,
      pitch,
      durationBeats: Math.max(MIN_DUR_BEATS, n.durationBeats * durScale),
      velocity: Math.max(1, Math.min(127, n.velocity + velDelta + (idx % 3 === 0 ? 2 : 0))),
    };
  });
}
