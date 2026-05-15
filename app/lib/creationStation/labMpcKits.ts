/**
 * 808 Lab MPC — one-shots from smpldsnds/drum-machines (public domain).
 * https://github.com/smpldsnds/drum-machines
 *
 * Each kit exposes 16 pads × one-shot URLs. Lazy-loaded per kit into decoded buffers.
 * Trap / house / dance / R&B “kits” are curated lane maps + Pad FX defaults over TR-808 / 808-mini / LM-2 / CR-8000.
 */

export type LabMpcKitId =
  | 'trapDark'
  | 'trapLight'
  | 'trapDrill'
  | 'trapHihat'
  | 'trapLowEnd'
  | 'trap808Mini'
  | 'trapCr8000'
  | 'trapPhonk'
  | 'trapClubBounce'
  | 'houseFourFour'
  | 'houseDeep'
  | 'houseGarage'
  | 'houseDisco'
  | 'dance90Club'
  | 'danceEuro90'
  | 'danceFreestyle90'
  | 'rnbSlowJam'
  | 'rnbNeoSoul'
  | 'rnb901Swing'
  | 'rnb808Groove'
  | 'rnbNewJack90'
  | 'rnbBallad90'
  | 'tr808'
  | 'mini808'
  | 'lm2'
  | 'cr8000';

/** Optional per-pad shaping when scheduling a hit (808 Lab / drum machine). */
export interface LabMpcPadPlayOpts {
  /** Pitch offset in semitones (−36…+36), via `AudioBufferSourceNode.detune` (cents). */
  tuneSemi?: number;
  /** Low-pass cutoff in Hz; high values (≥ ~18 kHz) skip the filter. */
  lpCutoffHz?: number;
  /** Saturation amount 0–1 (WaveShaper); 0 bypasses. */
  drive?: number;
  /** Extra gain 0–1.5 on top of velocity scaling. */
  level?: number;
}

export interface LabMpcPadDef {
  label: string;
  /** Relative to {@link SMPLDSNDS_BASE} (include extension). */
  relUrl: string;
}

export interface LabMpcKitMeta {
  id: LabMpcKitId;
  title: string;
  era: string;
  pads: readonly LabMpcPadDef[];
  /**
   * When the user picks this kit, the Pad FX strip resets to these defaults (per pad).
   * Omitted for neutral defaults on vintage machines.
   */
  padFxDefaults?: ReadonlyArray<Partial<LabMpcPadPlayOpts>>;
}

const SMPLDSNDS_BASE = 'https://smpldsnds.github.io/drum-machines';

function u(rel: string): string {
  return `${SMPLDSNDS_BASE}/${rel}`;
}

/** Roland TR-808 — classic analog hits. */
const KIT_TR808: readonly LabMpcPadDef[] = [
  { label: 'BD', relUrl: 'TR-808/kick/bd0000.m4a' },
  { label: 'SD', relUrl: 'TR-808/snare/sd0000.m4a' },
  { label: 'CP', relUrl: 'TR-808/clap/cp.m4a' },
  { label: 'RS', relUrl: 'TR-808/rimshot/rs.m4a' },
  { label: 'CH', relUrl: 'TR-808/hihat-close/ch.m4a' },
  { label: 'OH', relUrl: 'TR-808/hihat-open/oh00.m4a' },
  { label: 'HT', relUrl: 'TR-808/tom-hi/ht00.m4a' },
  { label: 'LT', relUrl: 'TR-808/tom-low/lt00.m4a' },
  { label: 'MT', relUrl: 'TR-808/mid-tom/mt00.m4a' },
  { label: 'HC', relUrl: 'TR-808/conga-hi/hc00.m4a' },
  { label: 'MC', relUrl: 'TR-808/conga-mid/mc00.m4a' },
  { label: 'LC', relUrl: 'TR-808/conga-low/lc00.m4a' },
  { label: 'CY', relUrl: 'TR-808/cymbal/cy0050.m4a' },
  { label: 'CB', relUrl: 'TR-808/cowbell/cb.m4a' },
  { label: 'CL', relUrl: 'TR-808/clave/cl.m4a' },
  { label: 'MA', relUrl: 'TR-808/maraca/ma.m4a' },
];

/** Linn LM-2 — early 80s digital groove (file names from repo `files.json`). */
const KIT_LM2: readonly LabMpcPadDef[] = [
  { label: 'Kick', relUrl: 'LM-2/kick.m4a' },
  { label: 'Snare', relUrl: 'LM-2/snare-m.m4a' },
  { label: 'Sn H', relUrl: 'LM-2/snare-h.m4a' },
  { label: 'Sn L', relUrl: 'LM-2/snare-l.m4a' },
  { label: 'CH', relUrl: 'LM-2/hhclosed.m4a' },
  { label: 'CHs', relUrl: 'LM-2/hhclosed-short.m4a' },
  { label: 'OH', relUrl: 'LM-2/hhopen.m4a' },
  { label: 'Clap', relUrl: 'LM-2/clap.m4a' },
  { label: 'Tom H', relUrl: 'LM-2/tom-h.m4a' },
  { label: 'Tom M', relUrl: 'LM-2/tom-m.m4a' },
  { label: 'Tom L', relUrl: 'LM-2/tom-l.m4a' },
  { label: 'Cow', relUrl: 'LM-2/cowbell.m4a' },
  { label: 'Ride', relUrl: 'LM-2/ride.m4a' },
  { label: 'Crash', relUrl: 'LM-2/crash.m4a' },
  { label: 'Cab', relUrl: 'LM-2/cabasa.m4a' },
  { label: 'Tamb', relUrl: 'LM-2/tambourine.m4a' },
];

/** Roland CR-8000 — 80s compu-rhythm. */
const KIT_CR8000: readonly LabMpcPadDef[] = [
  { label: 'Kick', relUrl: 'Roland-CR-8000/kick.m4a' },
  { label: 'Snare', relUrl: 'Roland-CR-8000/snare.m4a' },
  { label: 'CH', relUrl: 'Roland-CR-8000/hihat-closed.m4a' },
  { label: 'OH', relUrl: 'Roland-CR-8000/hihat-open.m4a' },
  { label: 'Clap', relUrl: 'Roland-CR-8000/clap.m4a' },
  { label: 'Rim', relUrl: 'Roland-CR-8000/rimshot.m4a' },
  { label: 'Tom H', relUrl: 'Roland-CR-8000/tom-high.m4a' },
  { label: 'Tom L', relUrl: 'Roland-CR-8000/tom-low.m4a' },
  { label: 'Conga H', relUrl: 'Roland-CR-8000/conga-high.m4a' },
  { label: 'Conga L', relUrl: 'Roland-CR-8000/conga-low.m4a' },
  { label: 'Cow', relUrl: 'Roland-CR-8000/cowbell.m4a' },
  { label: 'Cym', relUrl: 'Roland-CR-8000/cymball.m4a' },
  { label: 'Clave', relUrl: 'Roland-CR-8000/clave.m4a' },
  { label: 'Kick+', relUrl: 'Roland-CR-8000/kick.m4a' },
  { label: 'Sn+', relUrl: 'Roland-CR-8000/snare.m4a' },
  { label: 'CH+', relUrl: 'Roland-CR-8000/hihat-closed.m4a' },
];

/** 808 mini — compact modern 808-style set. */
const KIT_MINI808: readonly LabMpcPadDef[] = [
  { label: 'Kick', relUrl: '808-mini/kick.m4a' },
  { label: 'Sn1', relUrl: '808-mini/snare-1.m4a' },
  { label: 'Sn2', relUrl: '808-mini/snare-2.m4a' },
  { label: 'Sn3', relUrl: '808-mini/snare-3.m4a' },
  { label: 'CH1', relUrl: '808-mini/hhclosed-1.m4a' },
  { label: 'CH2', relUrl: '808-mini/hhclosed-2.m4a' },
  { label: 'OH1', relUrl: '808-mini/hhopen-1.m4a' },
  { label: 'OH2', relUrl: '808-mini/hhopen-2.m4a' },
  { label: 'Tom H', relUrl: '808-mini/tom-high.m4a' },
  { label: 'Tom M', relUrl: '808-mini/tom-mid.m4a' },
  { label: 'Tom L', relUrl: '808-mini/tom-low.m4a' },
  { label: 'Crash', relUrl: '808-mini/crash.m4a' },
  { label: 'Ride', relUrl: '808-mini/ride.m4a' },
  { label: 'Kick+', relUrl: '808-mini/kick.m4a' },
  { label: 'Sn1+', relUrl: '808-mini/snare-1.m4a' },
  { label: 'CH1+', relUrl: '808-mini/hhclosed-1.m4a' },
];

/** Curated: 808 + mini layered kicks/snares, moody defaults — “dark trap”. */
const KIT_TRAP_DARK_PADS: readonly LabMpcPadDef[] = [
  { label: 'Sub kick', relUrl: 'TR-808/kick/bd0000.m4a' },
  { label: 'Click kick', relUrl: '808-mini/kick.m4a' },
  { label: 'Trap snare', relUrl: 'TR-808/snare/sd0000.m4a' },
  { label: 'Snap snare', relUrl: '808-mini/snare-2.m4a' },
  { label: 'CH', relUrl: 'TR-808/hihat-close/ch.m4a' },
  { label: 'CH tight', relUrl: '808-mini/hhclosed-2.m4a' },
  { label: 'OH', relUrl: 'TR-808/hihat-open/oh00.m4a' },
  { label: 'OH lift', relUrl: '808-mini/hhopen-1.m4a' },
  { label: 'Rim', relUrl: 'TR-808/rimshot/rs.m4a' },
  { label: 'Clap', relUrl: 'TR-808/clap/cp.m4a' },
  { label: 'Punch SD', relUrl: 'LM-2/snare-m.m4a' },
  { label: 'Punch BD', relUrl: 'LM-2/kick.m4a' },
  { label: 'Tom L', relUrl: 'TR-808/tom-low/lt00.m4a' },
  { label: 'Tom H', relUrl: 'TR-808/tom-hi/ht00.m4a' },
  { label: 'Cow', relUrl: 'TR-808/cowbell/cb.m4a' },
  { label: 'Perc', relUrl: 'TR-808/maraca/ma.m4a' },
];

const TRAP_DARK_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 3400, drive: 0.07, level: 1.08 },
  { lpCutoffHz: 8200, tuneSemi: 1 },
  { lpCutoffHz: 5600, drive: 0.18 },
  { lpCutoffHz: 6800, drive: 0.12 },
  { lpCutoffHz: 14000, level: 0.94 },
  { lpCutoffHz: 15500 },
  { lpCutoffHz: 15000 },
  { lpCutoffHz: 16500 },
  { lpCutoffHz: 7800, drive: 0.06 },
  { lpCutoffHz: 6200, drive: 0.08 },
  { lpCutoffHz: 5200, drive: 0.14 },
  { lpCutoffHz: 3600, drive: 0.06 },
  { lpCutoffHz: 4800 },
  { lpCutoffHz: 8200 },
  { lpCutoffHz: 11000 },
  { lpCutoffHz: 15000 },
];

/** Curated: LM-2 + 808 hats — brighter “light trap / melodic trap”. */
const KIT_TRAP_LIGHT_PADS: readonly LabMpcPadDef[] = [
  { label: 'Kick', relUrl: 'LM-2/kick.m4a' },
  { label: '808 sub', relUrl: 'TR-808/kick/bd0000.m4a' },
  { label: 'Snare', relUrl: 'LM-2/snare-m.m4a' },
  { label: 'Sn bright', relUrl: 'LM-2/snare-h.m4a' },
  { label: 'CH', relUrl: 'LM-2/hhclosed.m4a' },
  { label: 'CH short', relUrl: 'LM-2/hhclosed-short.m4a' },
  { label: 'OH', relUrl: 'LM-2/hhopen.m4a' },
  { label: '808 CH', relUrl: 'TR-808/hihat-close/ch.m4a' },
  { label: '808 OH', relUrl: 'TR-808/hihat-open/oh00.m4a' },
  { label: 'Clap', relUrl: 'LM-2/clap.m4a' },
  { label: 'Tom H', relUrl: 'LM-2/tom-h.m4a' },
  { label: 'Tom M', relUrl: 'LM-2/tom-m.m4a' },
  { label: 'Tom L', relUrl: 'LM-2/tom-l.m4a' },
  { label: 'Crash', relUrl: 'LM-2/crash.m4a' },
  { label: 'Ride', relUrl: 'LM-2/ride.m4a' },
  { label: 'Cow', relUrl: 'LM-2/cowbell.m4a' },
];

const TRAP_LIGHT_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 12000, level: 1.05 },
  { lpCutoffHz: 5200, level: 1.02 },
  { lpCutoffHz: 14000, drive: 0.05 },
  { lpCutoffHz: 16000 },
  { lpCutoffHz: 18500, level: 1.1 },
  { lpCutoffHz: 18500, level: 1.08 },
  { lpCutoffHz: 18000, level: 1.06 },
  { lpCutoffHz: 18500, level: 1.12 },
  { lpCutoffHz: 18000, level: 1.08 },
  { lpCutoffHz: 15000 },
  { lpCutoffHz: 12000 },
  { lpCutoffHz: 12000 },
  { lpCutoffHz: 11000 },
  { lpCutoffHz: 16500 },
  { lpCutoffHz: 17000 },
  { lpCutoffHz: 16000 },
];

/** Curated: UK drill direction — tight hats, rim, sliding toms. */
const KIT_TRAP_DRILL_PADS: readonly LabMpcPadDef[] = [
  { label: 'Kick long', relUrl: 'TR-808/kick/bd0000.m4a' },
  { label: 'Kick punch', relUrl: '808-mini/kick.m4a' },
  { label: 'Snare', relUrl: 'TR-808/snare/sd0000.m4a' },
  { label: 'Snare alt', relUrl: '808-mini/snare-1.m4a' },
  { label: 'CH 1', relUrl: '808-mini/hhclosed-1.m4a' },
  { label: 'CH 2', relUrl: '808-mini/hhclosed-2.m4a' },
  { label: '808 CH', relUrl: 'TR-808/hihat-close/ch.m4a' },
  { label: 'OH', relUrl: 'TR-808/hihat-open/oh00.m4a' },
  { label: 'Rim', relUrl: 'TR-808/rimshot/rs.m4a' },
  { label: 'Clap', relUrl: 'TR-808/clap/cp.m4a' },
  { label: 'Tom slide', relUrl: 'TR-808/tom-low/lt00.m4a' },
  { label: 'Tom hi', relUrl: 'TR-808/tom-hi/ht00.m4a' },
  { label: 'Tom mid', relUrl: 'TR-808/mid-tom/mt00.m4a' },
  { label: 'Perc', relUrl: 'TR-808/clave/cl.m4a' },
  { label: 'Cow', relUrl: 'TR-808/cowbell/cb.m4a' },
  { label: 'Noise', relUrl: 'TR-808/maraca/ma.m4a' },
];

const TRAP_DRILL_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 3800, drive: 0.05, level: 1.06 },
  { lpCutoffHz: 6000, drive: 0.04 },
  { lpCutoffHz: 6200, drive: 0.16 },
  { lpCutoffHz: 7200, drive: 0.1 },
  { lpCutoffHz: 16500, level: 1.14 },
  { lpCutoffHz: 16800, level: 1.12 },
  { lpCutoffHz: 17000, level: 1.1 },
  { lpCutoffHz: 16000, level: 1.05 },
  { lpCutoffHz: 9000, tuneSemi: 2 },
  { lpCutoffHz: 7000, drive: 0.08 },
  { lpCutoffHz: 4200, tuneSemi: -3 },
  { lpCutoffHz: 9000 },
  { lpCutoffHz: 7500 },
  { lpCutoffHz: 12000 },
  { lpCutoffHz: 10000 },
  { lpCutoffHz: 14000 },
];

/** Curated: hi-hat trap — many hat lanes + core kick/snare. */
const KIT_TRAP_HIHAT_PADS: readonly LabMpcPadDef[] = [
  { label: 'Kick', relUrl: 'TR-808/kick/bd0000.m4a' },
  { label: 'Kick 2', relUrl: '808-mini/kick.m4a' },
  { label: 'Snare', relUrl: 'TR-808/snare/sd0000.m4a' },
  { label: 'Snare 2', relUrl: '808-mini/snare-1.m4a' },
  { label: 'CH mini 1', relUrl: '808-mini/hhclosed-1.m4a' },
  { label: 'CH mini 2', relUrl: '808-mini/hhclosed-2.m4a' },
  { label: '808 CH', relUrl: 'TR-808/hihat-close/ch.m4a' },
  { label: 'LM CH', relUrl: 'LM-2/hhclosed.m4a' },
  { label: 'LM CHs', relUrl: 'LM-2/hhclosed-short.m4a' },
  { label: '808 OH', relUrl: 'TR-808/hihat-open/oh00.m4a' },
  { label: 'OH mini 1', relUrl: '808-mini/hhopen-1.m4a' },
  { label: 'OH mini 2', relUrl: '808-mini/hhopen-2.m4a' },
  { label: 'LM OH', relUrl: 'LM-2/hhopen.m4a' },
  { label: 'CR CH', relUrl: 'Roland-CR-8000/hihat-closed.m4a' },
  { label: 'CR OH', relUrl: 'Roland-CR-8000/hihat-open.m4a' },
  { label: 'Rim', relUrl: 'TR-808/rimshot/rs.m4a' },
];

const TRAP_HIHAT_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 4500, level: 1.05 },
  { lpCutoffHz: 7000 },
  { lpCutoffHz: 7200, drive: 0.12 },
  { lpCutoffHz: 8000, drive: 0.08 },
  { lpCutoffHz: 18500, level: 1.18 },
  { lpCutoffHz: 18500, level: 1.16 },
  { lpCutoffHz: 18500, level: 1.14 },
  { lpCutoffHz: 18500, level: 1.12 },
  { lpCutoffHz: 18500, level: 1.2 },
  { lpCutoffHz: 18000, level: 1.1 },
  { lpCutoffHz: 18200, level: 1.12 },
  { lpCutoffHz: 18200, level: 1.1 },
  { lpCutoffHz: 17800, level: 1.08 },
  { lpCutoffHz: 18500, level: 1.15 },
  { lpCutoffHz: 17500, level: 1.06 },
  { lpCutoffHz: 17200, level: 1.07 },
  { lpCutoffHz: 11000, level: 1.05 },
];

/** Curated: sub-heavy kicks + weight — “808 in the trunk”. */
const KIT_TRAP_LOW_END_PADS: readonly LabMpcPadDef[] = [
  { label: '808 sub', relUrl: 'TR-808/kick/bd0000.m4a' },
  { label: 'Mini kick', relUrl: '808-mini/kick.m4a' },
  { label: 'LM knock', relUrl: 'LM-2/kick.m4a' },
  { label: 'CR box kick', relUrl: 'Roland-CR-8000/kick.m4a' },
  { label: '808 snare', relUrl: 'TR-808/snare/sd0000.m4a' },
  { label: 'Mini sn 3', relUrl: '808-mini/snare-3.m4a' },
  { label: 'Mini sn 2', relUrl: '808-mini/snare-2.m4a' },
  { label: 'LM snare', relUrl: 'LM-2/snare-m.m4a' },
  { label: '808 CH', relUrl: 'TR-808/hihat-close/ch.m4a' },
  { label: 'Mini CH 1', relUrl: '808-mini/hhclosed-1.m4a' },
  { label: 'Mini CH 2', relUrl: '808-mini/hhclosed-2.m4a' },
  { label: '808 OH', relUrl: 'TR-808/hihat-open/oh00.m4a' },
  { label: '808 tom low', relUrl: 'TR-808/tom-low/lt00.m4a' },
  { label: '808 conga L', relUrl: 'TR-808/conga-low/lc00.m4a' },
  { label: '808 clap', relUrl: 'TR-808/clap/cp.m4a' },
  { label: '808 rim', relUrl: 'TR-808/rimshot/rs.m4a' },
];

const TRAP_LOW_END_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 2800, drive: 0.06, level: 1.12, tuneSemi: -1 },
  { lpCutoffHz: 4200, drive: 0.05, level: 1.1 },
  { lpCutoffHz: 3600, level: 1.08 },
  { lpCutoffHz: 3200, level: 1.06 },
  { lpCutoffHz: 5200, drive: 0.14 },
  { lpCutoffHz: 5800, drive: 0.16 },
  { lpCutoffHz: 6000, drive: 0.12 },
  { lpCutoffHz: 4800, drive: 0.1 },
  { lpCutoffHz: 15500, level: 1.06 },
  { lpCutoffHz: 16500, level: 1.08 },
  { lpCutoffHz: 16800, level: 1.06 },
  { lpCutoffHz: 15000 },
  { lpCutoffHz: 4500, tuneSemi: -2 },
  { lpCutoffHz: 3800 },
  { lpCutoffHz: 6500, drive: 0.08 },
  { lpCutoffHz: 9000, drive: 0.06 },
];

/** Curated: modern 808-mini forward + OG kick layer. */
const KIT_TRAP_808_MINI_PADS: readonly LabMpcPadDef[] = [
  { label: 'Mini kick', relUrl: '808-mini/kick.m4a' },
  { label: '808 sub', relUrl: 'TR-808/kick/bd0000.m4a' },
  { label: 'Snare 1', relUrl: '808-mini/snare-1.m4a' },
  { label: 'Snare 2', relUrl: '808-mini/snare-2.m4a' },
  { label: 'Snare 3', relUrl: '808-mini/snare-3.m4a' },
  { label: 'CH 1', relUrl: '808-mini/hhclosed-1.m4a' },
  { label: 'CH 2', relUrl: '808-mini/hhclosed-2.m4a' },
  { label: 'OH 1', relUrl: '808-mini/hhopen-1.m4a' },
  { label: 'OH 2', relUrl: '808-mini/hhopen-2.m4a' },
  { label: 'Tom H', relUrl: '808-mini/tom-high.m4a' },
  { label: 'Tom M', relUrl: '808-mini/tom-mid.m4a' },
  { label: 'Tom L', relUrl: '808-mini/tom-low.m4a' },
  { label: 'Crash', relUrl: '808-mini/crash.m4a' },
  { label: 'Ride', relUrl: '808-mini/ride.m4a' },
  { label: 'Kick double', relUrl: '808-mini/kick.m4a' },
  { label: '808 rim', relUrl: 'TR-808/rimshot/rs.m4a' },
];

const TRAP_808_MINI_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 4800, drive: 0.06, level: 1.08 },
  { lpCutoffHz: 3400, level: 1.06 },
  { lpCutoffHz: 7200, drive: 0.12 },
  { lpCutoffHz: 6800, drive: 0.1 },
  { lpCutoffHz: 6200, drive: 0.14 },
  { lpCutoffHz: 17500, level: 1.12 },
  { lpCutoffHz: 17800, level: 1.1 },
  { lpCutoffHz: 17000, level: 1.08 },
  { lpCutoffHz: 16800, level: 1.06 },
  { lpCutoffHz: 9000 },
  { lpCutoffHz: 8200 },
  { lpCutoffHz: 7000 },
  { lpCutoffHz: 14000 },
  { lpCutoffHz: 15000 },
  { lpCutoffHz: 5200, level: 1.04 },
  { lpCutoffHz: 10000, drive: 0.05 },
];

/** Curated: CR-8000 character + 808 hat glue for dusty trap. */
const KIT_TRAP_CR8000_PADS: readonly LabMpcPadDef[] = [
  { label: 'CR kick', relUrl: 'Roland-CR-8000/kick.m4a' },
  { label: 'CR snare', relUrl: 'Roland-CR-8000/snare.m4a' },
  { label: 'CR CH', relUrl: 'Roland-CR-8000/hihat-closed.m4a' },
  { label: 'CR OH', relUrl: 'Roland-CR-8000/hihat-open.m4a' },
  { label: 'CR clap', relUrl: 'Roland-CR-8000/clap.m4a' },
  { label: 'CR rim', relUrl: 'Roland-CR-8000/rimshot.m4a' },
  { label: 'CR tom H', relUrl: 'Roland-CR-8000/tom-high.m4a' },
  { label: 'CR tom L', relUrl: 'Roland-CR-8000/tom-low.m4a' },
  { label: 'Conga H', relUrl: 'Roland-CR-8000/conga-high.m4a' },
  { label: 'Conga L', relUrl: 'Roland-CR-8000/conga-low.m4a' },
  { label: 'Cow', relUrl: 'Roland-CR-8000/cowbell.m4a' },
  { label: 'Cym', relUrl: 'Roland-CR-8000/cymball.m4a' },
  { label: 'Clave', relUrl: 'Roland-CR-8000/clave.m4a' },
  { label: '808 sub', relUrl: 'TR-808/kick/bd0000.m4a' },
  { label: '808 CH', relUrl: 'TR-808/hihat-close/ch.m4a' },
  { label: '808 OH', relUrl: 'TR-808/hihat-open/oh00.m4a' },
];

const TRAP_CR8000_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 3800, drive: 0.05, level: 1.06 },
  { lpCutoffHz: 5500, drive: 0.1 },
  { lpCutoffHz: 12000, level: 0.98 },
  { lpCutoffHz: 11000 },
  { lpCutoffHz: 8000, drive: 0.06 },
  { lpCutoffHz: 9000 },
  { lpCutoffHz: 7500 },
  { lpCutoffHz: 6500 },
  { lpCutoffHz: 7000 },
  { lpCutoffHz: 6000 },
  { lpCutoffHz: 9500, drive: 0.08 },
  { lpCutoffHz: 13000 },
  { lpCutoffHz: 10000 },
  { lpCutoffHz: 3000, level: 1.08 },
  { lpCutoffHz: 16000, level: 1.05 },
  { lpCutoffHz: 14500 },
];

/** Curated: cowbell / rim / dark hats — phonk-adjacent plates. */
const KIT_TRAP_PHONK_PADS: readonly LabMpcPadDef[] = [
  { label: '808 sub', relUrl: 'TR-808/kick/bd0000.m4a' },
  { label: 'CR kick', relUrl: 'Roland-CR-8000/kick.m4a' },
  { label: '808 snare', relUrl: 'TR-808/snare/sd0000.m4a' },
  { label: 'Mini sn 3', relUrl: '808-mini/snare-3.m4a' },
  { label: 'CR cow', relUrl: 'Roland-CR-8000/cowbell.m4a' },
  { label: '808 cow', relUrl: 'TR-808/cowbell/cb.m4a' },
  { label: 'CR clave', relUrl: 'Roland-CR-8000/clave.m4a' },
  { label: '808 clave', relUrl: 'TR-808/clave/cl.m4a' },
  { label: 'CR OH', relUrl: 'Roland-CR-8000/hihat-open.m4a' },
  { label: 'CR CH', relUrl: 'Roland-CR-8000/hihat-closed.m4a' },
  { label: '808 OH', relUrl: 'TR-808/hihat-open/oh00.m4a' },
  { label: 'LM crash', relUrl: 'LM-2/crash.m4a' },
  { label: '808 tom L', relUrl: 'TR-808/tom-low/lt00.m4a' },
  { label: '808 noise', relUrl: 'TR-808/maraca/ma.m4a' },
  { label: '808 rim', relUrl: 'TR-808/rimshot/rs.m4a' },
  { label: 'CR snare', relUrl: 'Roland-CR-8000/snare.m4a' },
];

const TRAP_PHONK_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 3200, drive: 0.08, level: 1.1 },
  { lpCutoffHz: 4000, drive: 0.06 },
  { lpCutoffHz: 5000, drive: 0.18 },
  { lpCutoffHz: 5200, drive: 0.16 },
  { lpCutoffHz: 6800, drive: 0.12, tuneSemi: -2 },
  { lpCutoffHz: 7200, drive: 0.1 },
  { lpCutoffHz: 8000, drive: 0.09 },
  { lpCutoffHz: 8500, drive: 0.08 },
  { lpCutoffHz: 9000, drive: 0.07 },
  { lpCutoffHz: 9500, drive: 0.06 },
  { lpCutoffHz: 8800 },
  { lpCutoffHz: 11000, drive: 0.1 },
  { lpCutoffHz: 4200, tuneSemi: -4 },
  { lpCutoffHz: 12000, drive: 0.05 },
  { lpCutoffHz: 7800, drive: 0.08 },
  { lpCutoffHz: 4800, drive: 0.12 },
];

/** Curated: LM-2 bounce + 808 sub — club / melodic trap pocket. */
const KIT_TRAP_CLUB_BOUNCE_PADS: readonly LabMpcPadDef[] = [
  { label: 'LM kick', relUrl: 'LM-2/kick.m4a' },
  { label: '808 sub', relUrl: 'TR-808/kick/bd0000.m4a' },
  { label: 'LM snare', relUrl: 'LM-2/snare-m.m4a' },
  { label: 'LM sn bright', relUrl: 'LM-2/snare-h.m4a' },
  { label: 'LM clap', relUrl: 'LM-2/clap.m4a' },
  { label: 'LM CH', relUrl: 'LM-2/hhclosed.m4a' },
  { label: 'LM CHs', relUrl: 'LM-2/hhclosed-short.m4a' },
  { label: 'LM OH', relUrl: 'LM-2/hhopen.m4a' },
  { label: '808 CH', relUrl: 'TR-808/hihat-close/ch.m4a' },
  { label: '808 OH', relUrl: 'TR-808/hihat-open/oh00.m4a' },
  { label: 'Tom H', relUrl: 'LM-2/tom-h.m4a' },
  { label: 'Tom M', relUrl: 'LM-2/tom-m.m4a' },
  { label: 'Crash', relUrl: 'LM-2/crash.m4a' },
  { label: 'Ride', relUrl: 'LM-2/ride.m4a' },
  { label: 'Cabasa', relUrl: 'LM-2/cabasa.m4a' },
  { label: 'Tamb', relUrl: 'LM-2/tambourine.m4a' },
];

const TRAP_CLUB_BOUNCE_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 9000, level: 1.06, drive: 0.04 },
  { lpCutoffHz: 4200, level: 1.05 },
  { lpCutoffHz: 13000, drive: 0.05 },
  { lpCutoffHz: 15000 },
  { lpCutoffHz: 12000, drive: 0.05 },
  { lpCutoffHz: 18500, level: 1.1 },
  { lpCutoffHz: 18500, level: 1.12 },
  { lpCutoffHz: 18000, level: 1.08 },
  { lpCutoffHz: 18500, level: 1.06 },
  { lpCutoffHz: 17500, level: 1.05 },
  { lpCutoffHz: 11000 },
  { lpCutoffHz: 10500 },
  { lpCutoffHz: 16500, level: 1.06 },
  { lpCutoffHz: 17000, level: 1.07 },
  { lpCutoffHz: 12500 },
  { lpCutoffHz: 14000 },
];

/** Curated: four-on-the-floor — LM punch + 808 sub + rides. */
const KIT_HOUSE_FOUR_FOUR_PADS: readonly LabMpcPadDef[] = [
  { label: 'Kick LM', relUrl: 'LM-2/kick.m4a' },
  { label: '808 sub', relUrl: 'TR-808/kick/bd0000.m4a' },
  { label: 'Mini kick', relUrl: '808-mini/kick.m4a' },
  { label: 'Snare', relUrl: 'LM-2/snare-m.m4a' },
  { label: 'Clap', relUrl: 'LM-2/clap.m4a' },
  { label: 'CH', relUrl: 'LM-2/hhclosed.m4a' },
  { label: 'CH short', relUrl: 'LM-2/hhclosed-short.m4a' },
  { label: 'OH', relUrl: 'LM-2/hhopen.m4a' },
  { label: 'CH mini', relUrl: '808-mini/hhclosed-1.m4a' },
  { label: 'OH mini', relUrl: '808-mini/hhopen-1.m4a' },
  { label: 'Ride', relUrl: 'LM-2/ride.m4a' },
  { label: 'Crash', relUrl: 'LM-2/crash.m4a' },
  { label: 'Tom H', relUrl: 'LM-2/tom-h.m4a' },
  { label: 'Tom M', relUrl: 'LM-2/tom-m.m4a' },
  { label: 'Tom L', relUrl: 'LM-2/tom-l.m4a' },
  { label: 'Cow', relUrl: 'LM-2/cowbell.m4a' },
];

const HOUSE_FOUR_FOUR_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 7200, drive: 0.04, level: 1.06 },
  { lpCutoffHz: 4200, level: 1.05 },
  { lpCutoffHz: 8500, level: 1.03 },
  { lpCutoffHz: 11000, drive: 0.05 },
  { lpCutoffHz: 13000, drive: 0.04 },
  { lpCutoffHz: 18500, level: 1.06 },
  { lpCutoffHz: 18500, level: 1.05 },
  { lpCutoffHz: 18000, level: 1.08 },
  { lpCutoffHz: 18500, level: 1.04 },
  { lpCutoffHz: 17500, level: 1.05 },
  { lpCutoffHz: 16500, level: 1.06 },
  { lpCutoffHz: 16000, level: 1.05 },
  { lpCutoffHz: 10500 },
  { lpCutoffHz: 9800 },
  { lpCutoffHz: 9000 },
  { lpCutoffHz: 12000 },
];

/** Curated: deep house — 808 body + toms + congas. */
const KIT_HOUSE_DEEP_PADS: readonly LabMpcPadDef[] = [
  { label: '808 sub', relUrl: 'TR-808/kick/bd0000.m4a' },
  { label: 'Mini kick', relUrl: '808-mini/kick.m4a' },
  { label: 'LM kick', relUrl: 'LM-2/kick.m4a' },
  { label: '808 snare', relUrl: 'TR-808/snare/sd0000.m4a' },
  { label: 'LM snare', relUrl: 'LM-2/snare-m.m4a' },
  { label: '808 OH', relUrl: 'TR-808/hihat-open/oh00.m4a' },
  { label: 'LM OH', relUrl: 'LM-2/hhopen.m4a' },
  { label: '808 CH', relUrl: 'TR-808/hihat-close/ch.m4a' },
  { label: 'Mini CH', relUrl: '808-mini/hhclosed-2.m4a' },
  { label: 'Tom hi', relUrl: 'TR-808/tom-hi/ht00.m4a' },
  { label: 'Tom mid', relUrl: 'TR-808/mid-tom/mt00.m4a' },
  { label: 'Tom low', relUrl: 'TR-808/tom-low/lt00.m4a' },
  { label: 'Conga H', relUrl: 'TR-808/conga-hi/hc00.m4a' },
  { label: 'Conga M', relUrl: 'TR-808/conga-mid/mc00.m4a' },
  { label: 'Conga L', relUrl: 'TR-808/conga-low/lc00.m4a' },
  { label: 'Ride', relUrl: 'LM-2/ride.m4a' },
];

const HOUSE_DEEP_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 3800, drive: 0.05, level: 1.05 },
  { lpCutoffHz: 6500, level: 1.04 },
  { lpCutoffHz: 6000, level: 1.03 },
  { lpCutoffHz: 7500, drive: 0.08 },
  { lpCutoffHz: 9000, drive: 0.06 },
  { lpCutoffHz: 15000, level: 1.05 },
  { lpCutoffHz: 14500 },
  { lpCutoffHz: 15500, level: 1.04 },
  { lpCutoffHz: 17000 },
  { lpCutoffHz: 8500, tuneSemi: -1 },
  { lpCutoffHz: 7800 },
  { lpCutoffHz: 7000 },
  { lpCutoffHz: 8000, drive: 0.04 },
  { lpCutoffHz: 7500, drive: 0.04 },
  { lpCutoffHz: 6800, drive: 0.04 },
  { lpCutoffHz: 15500, level: 1.04 },
];

/** Curated: garage / shuffle hats — CR + 808 + LM. */
const KIT_HOUSE_GARAGE_PADS: readonly LabMpcPadDef[] = [
  { label: 'CR kick', relUrl: 'Roland-CR-8000/kick.m4a' },
  { label: 'LM kick', relUrl: 'LM-2/kick.m4a' },
  { label: 'CR snare', relUrl: 'Roland-CR-8000/snare.m4a' },
  { label: 'Mini snare', relUrl: '808-mini/snare-2.m4a' },
  { label: '808 rim', relUrl: 'TR-808/rimshot/rs.m4a' },
  { label: 'CR rim', relUrl: 'Roland-CR-8000/rimshot.m4a' },
  { label: 'CR CH', relUrl: 'Roland-CR-8000/hihat-closed.m4a' },
  { label: 'CR OH', relUrl: 'Roland-CR-8000/hihat-open.m4a' },
  { label: '808 CH', relUrl: 'TR-808/hihat-close/ch.m4a' },
  { label: 'Mini CH', relUrl: '808-mini/hhclosed-1.m4a' },
  { label: 'Mini OH', relUrl: '808-mini/hhopen-2.m4a' },
  { label: 'LM clap', relUrl: 'LM-2/clap.m4a' },
  { label: 'CR clap', relUrl: 'Roland-CR-8000/clap.m4a' },
  { label: '808 clap', relUrl: 'TR-808/clap/cp.m4a' },
  { label: 'LM CHs', relUrl: 'LM-2/hhclosed-short.m4a' },
  { label: '808 shaker', relUrl: 'TR-808/maraca/ma.m4a' },
];

const HOUSE_GARAGE_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 6800, level: 1.05 },
  { lpCutoffHz: 8000, level: 1.04 },
  { lpCutoffHz: 9500, drive: 0.08 },
  { lpCutoffHz: 11000, drive: 0.06 },
  { lpCutoffHz: 12000, drive: 0.05 },
  { lpCutoffHz: 11500 },
  { lpCutoffHz: 17500, level: 1.1 },
  { lpCutoffHz: 17000, level: 1.08 },
  { lpCutoffHz: 18000, level: 1.06 },
  { lpCutoffHz: 18500, level: 1.08 },
  { lpCutoffHz: 17500, level: 1.06 },
  { lpCutoffHz: 12500, drive: 0.05 },
  { lpCutoffHz: 11000, drive: 0.04 },
  { lpCutoffHz: 11500, drive: 0.04 },
  { lpCutoffHz: 18500, level: 1.12 },
  { lpCutoffHz: 14000, level: 1.04 },
];

/** Curated: disco / French touch pocket — LM forward + 808 accents. */
const KIT_HOUSE_DISCO_PADS: readonly LabMpcPadDef[] = [
  { label: 'Kick', relUrl: 'LM-2/kick.m4a' },
  { label: 'Sn bright', relUrl: 'LM-2/snare-h.m4a' },
  { label: 'Snare', relUrl: 'LM-2/snare-m.m4a' },
  { label: 'Clap', relUrl: 'LM-2/clap.m4a' },
  { label: 'CH', relUrl: 'LM-2/hhclosed.m4a' },
  { label: 'CH short', relUrl: 'LM-2/hhclosed-short.m4a' },
  { label: 'OH', relUrl: 'LM-2/hhopen.m4a' },
  { label: 'Cow', relUrl: 'LM-2/cowbell.m4a' },
  { label: 'Ride', relUrl: 'LM-2/ride.m4a' },
  { label: 'Crash', relUrl: 'LM-2/crash.m4a' },
  { label: 'Tom H', relUrl: 'LM-2/tom-h.m4a' },
  { label: 'Tom M', relUrl: 'LM-2/tom-m.m4a' },
  { label: 'Tom L', relUrl: 'LM-2/tom-l.m4a' },
  { label: 'Cab', relUrl: 'LM-2/cabasa.m4a' },
  { label: '808 OH', relUrl: 'TR-808/hihat-open/oh00.m4a' },
  { label: '808 CH', relUrl: 'TR-808/hihat-close/ch.m4a' },
];

const HOUSE_DISCO_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 8500, level: 1.05, drive: 0.03 },
  { lpCutoffHz: 12500, drive: 0.05 },
  { lpCutoffHz: 11000, drive: 0.04 },
  { lpCutoffHz: 12000, drive: 0.05 },
  { lpCutoffHz: 18500, level: 1.08 },
  { lpCutoffHz: 18500, level: 1.1 },
  { lpCutoffHz: 18000, level: 1.09 },
  { lpCutoffHz: 13000 },
  { lpCutoffHz: 17000, level: 1.06 },
  { lpCutoffHz: 16500, level: 1.07 },
  { lpCutoffHz: 11000 },
  { lpCutoffHz: 10500 },
  { lpCutoffHz: 9800 },
  { lpCutoffHz: 11500 },
  { lpCutoffHz: 17500, level: 1.05 },
  { lpCutoffHz: 18500, level: 1.04 },
];

/** Curated: slow jam — soft snares, congas, air. */
const KIT_RNB_SLOW_JAM_PADS: readonly LabMpcPadDef[] = [
  { label: '808 sub', relUrl: 'TR-808/kick/bd0000.m4a' },
  { label: 'LM kick', relUrl: 'LM-2/kick.m4a' },
  { label: 'Sn soft', relUrl: 'LM-2/snare-l.m4a' },
  { label: 'Sn mid', relUrl: 'LM-2/snare-m.m4a' },
  { label: '808 rim', relUrl: 'TR-808/rimshot/rs.m4a' },
  { label: '808 clap', relUrl: 'TR-808/clap/cp.m4a' },
  { label: 'Conga H', relUrl: 'TR-808/conga-hi/hc00.m4a' },
  { label: 'Conga M', relUrl: 'TR-808/conga-mid/mc00.m4a' },
  { label: 'Conga L', relUrl: 'TR-808/conga-low/lc00.m4a' },
  { label: 'Shaker', relUrl: 'TR-808/maraca/ma.m4a' },
  { label: 'LM OH', relUrl: 'LM-2/hhopen.m4a' },
  { label: 'LM CH', relUrl: 'LM-2/hhclosed.m4a' },
  { label: 'CR OH', relUrl: 'Roland-CR-8000/hihat-open.m4a' },
  { label: 'Cab', relUrl: 'LM-2/cabasa.m4a' },
  { label: 'Tamb', relUrl: 'LM-2/tambourine.m4a' },
  { label: '808 clave', relUrl: 'TR-808/clave/cl.m4a' },
];

const RNB_SLOW_JAM_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 4500, level: 1.04, drive: 0.03 },
  { lpCutoffHz: 8000, level: 1.03 },
  { lpCutoffHz: 12000, drive: 0.03 },
  { lpCutoffHz: 11000, drive: 0.03 },
  { lpCutoffHz: 10000 },
  { lpCutoffHz: 10500, drive: 0.04 },
  { lpCutoffHz: 9000, drive: 0.03 },
  { lpCutoffHz: 8500, drive: 0.03 },
  { lpCutoffHz: 8000, drive: 0.03 },
  { lpCutoffHz: 12500, drive: 0.02 },
  { lpCutoffHz: 17000, level: 1.05 },
  { lpCutoffHz: 17500, level: 1.04 },
  { lpCutoffHz: 15500, level: 1.03 },
  { lpCutoffHz: 13000 },
  { lpCutoffHz: 13500 },
  { lpCutoffHz: 11000, drive: 0.02 },
];

/** Curated: neo-soul pocket — percussion + soft digital. */
const KIT_RNB_NEO_SOUL_PADS: readonly LabMpcPadDef[] = [
  { label: 'Sn soft', relUrl: 'LM-2/snare-l.m4a' },
  { label: 'Snare', relUrl: 'LM-2/snare-m.m4a' },
  { label: 'Cab', relUrl: 'LM-2/cabasa.m4a' },
  { label: 'Tamb', relUrl: 'LM-2/tambourine.m4a' },
  { label: 'CH', relUrl: 'LM-2/hhclosed.m4a' },
  { label: 'CHs', relUrl: 'LM-2/hhclosed-short.m4a' },
  { label: 'OH', relUrl: 'LM-2/hhopen.m4a' },
  { label: 'CR conga H', relUrl: 'Roland-CR-8000/conga-high.m4a' },
  { label: 'CR conga L', relUrl: 'Roland-CR-8000/conga-low.m4a' },
  { label: 'Tom H', relUrl: 'TR-808/tom-hi/ht00.m4a' },
  { label: 'Tom L', relUrl: 'TR-808/tom-low/lt00.m4a' },
  { label: '808 clap', relUrl: 'TR-808/clap/cp.m4a' },
  { label: '808 rim', relUrl: 'TR-808/rimshot/rs.m4a' },
  { label: 'Ride', relUrl: 'LM-2/ride.m4a' },
  { label: 'Mini kick', relUrl: '808-mini/kick.m4a' },
  { label: '808 sub', relUrl: 'TR-808/kick/bd0000.m4a' },
];

const RNB_NEO_SOUL_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 11500, drive: 0.02 },
  { lpCutoffHz: 10500, drive: 0.03 },
  { lpCutoffHz: 11000 },
  { lpCutoffHz: 12000 },
  { lpCutoffHz: 18000, level: 1.04 },
  { lpCutoffHz: 18500, level: 1.05 },
  { lpCutoffHz: 17500, level: 1.04 },
  { lpCutoffHz: 8800, drive: 0.03 },
  { lpCutoffHz: 8200, drive: 0.03 },
  { lpCutoffHz: 9500 },
  { lpCutoffHz: 8800 },
  { lpCutoffHz: 10000, drive: 0.03 },
  { lpCutoffHz: 10500 },
  { lpCutoffHz: 16000, level: 1.05 },
  { lpCutoffHz: 7500, level: 1.03 },
  { lpCutoffHz: 4200, level: 1.04 },
];

/** Curated: 90s R&B swing pocket — LM-2 full palette. */
const KIT_RNB_901_SWING_PADS: readonly LabMpcPadDef[] = [
  { label: 'Kick', relUrl: 'LM-2/kick.m4a' },
  { label: 'Snare', relUrl: 'LM-2/snare-m.m4a' },
  { label: 'Sn H', relUrl: 'LM-2/snare-h.m4a' },
  { label: 'Sn L', relUrl: 'LM-2/snare-l.m4a' },
  { label: 'Clap', relUrl: 'LM-2/clap.m4a' },
  { label: 'CH', relUrl: 'LM-2/hhclosed.m4a' },
  { label: 'CHs', relUrl: 'LM-2/hhclosed-short.m4a' },
  { label: 'OH', relUrl: 'LM-2/hhopen.m4a' },
  { label: 'Tom H', relUrl: 'LM-2/tom-h.m4a' },
  { label: 'Tom M', relUrl: 'LM-2/tom-m.m4a' },
  { label: 'Tom L', relUrl: 'LM-2/tom-l.m4a' },
  { label: 'Cow', relUrl: 'LM-2/cowbell.m4a' },
  { label: 'Ride', relUrl: 'LM-2/ride.m4a' },
  { label: 'Crash', relUrl: 'LM-2/crash.m4a' },
  { label: 'Cab', relUrl: 'LM-2/cabasa.m4a' },
  { label: 'Tamb', relUrl: 'LM-2/tambourine.m4a' },
];

const RNB_901_SWING_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 8000, level: 1.05, drive: 0.03 },
  { lpCutoffHz: 11500, drive: 0.04 },
  { lpCutoffHz: 12500, drive: 0.04 },
  { lpCutoffHz: 12000, drive: 0.03 },
  { lpCutoffHz: 12500, drive: 0.05 },
  { lpCutoffHz: 18500, level: 1.06 },
  { lpCutoffHz: 18500, level: 1.08 },
  { lpCutoffHz: 17800, level: 1.05 },
  { lpCutoffHz: 10500 },
  { lpCutoffHz: 10000 },
  { lpCutoffHz: 9500 },
  { lpCutoffHz: 11500 },
  { lpCutoffHz: 16500, level: 1.05 },
  { lpCutoffHz: 16000, level: 1.06 },
  { lpCutoffHz: 12500 },
  { lpCutoffHz: 13000 },
];

/** Curated: 808 soul ballad — OG + LM tops. */
const KIT_RNB_808_GROOVE_PADS: readonly LabMpcPadDef[] = [
  { label: '808 kick', relUrl: 'TR-808/kick/bd0000.m4a' },
  { label: 'LM kick', relUrl: 'LM-2/kick.m4a' },
  { label: '808 snare', relUrl: 'TR-808/snare/sd0000.m4a' },
  { label: 'LM snare', relUrl: 'LM-2/snare-m.m4a' },
  { label: '808 clap', relUrl: 'TR-808/clap/cp.m4a' },
  { label: '808 rim', relUrl: 'TR-808/rimshot/rs.m4a' },
  { label: '808 CH', relUrl: 'TR-808/hihat-close/ch.m4a' },
  { label: '808 OH', relUrl: 'TR-808/hihat-open/oh00.m4a' },
  { label: 'Mini CH', relUrl: '808-mini/hhclosed-1.m4a' },
  { label: 'Tom hi', relUrl: 'TR-808/tom-hi/ht00.m4a' },
  { label: 'Tom mid', relUrl: 'TR-808/mid-tom/mt00.m4a' },
  { label: 'Tom low', relUrl: 'TR-808/tom-low/lt00.m4a' },
  { label: '808 cow', relUrl: 'TR-808/cowbell/cb.m4a' },
  { label: '808 clave', relUrl: 'TR-808/clave/cl.m4a' },
  { label: 'Ride', relUrl: 'LM-2/ride.m4a' },
  { label: 'LM OH', relUrl: 'LM-2/hhopen.m4a' },
];

const RNB_808_GROOVE_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 4800, level: 1.05, drive: 0.03 },
  { lpCutoffHz: 7500, level: 1.03 },
  { lpCutoffHz: 6500, drive: 0.1 },
  { lpCutoffHz: 10000, drive: 0.05 },
  { lpCutoffHz: 11000, drive: 0.05 },
  { lpCutoffHz: 10500, drive: 0.04 },
  { lpCutoffHz: 17000, level: 1.05 },
  { lpCutoffHz: 16500, level: 1.04 },
  { lpCutoffHz: 18000, level: 1.03 },
  { lpCutoffHz: 9000 },
  { lpCutoffHz: 8200 },
  { lpCutoffHz: 7500 },
  { lpCutoffHz: 11000, drive: 0.04 },
  { lpCutoffHz: 10500, drive: 0.03 },
  { lpCutoffHz: 15800, level: 1.05 },
  { lpCutoffHz: 17200, level: 1.04 },
];

/** Curated: 90s club / dance radio — LM pocket + bright hats. */
const KIT_DANCE_90_CLUB_PADS: readonly LabMpcPadDef[] = [
  { label: 'Kick LM', relUrl: 'LM-2/kick.m4a' },
  { label: '808 sub', relUrl: 'TR-808/kick/bd0000.m4a' },
  { label: 'Snare', relUrl: 'LM-2/snare-m.m4a' },
  { label: 'Clap', relUrl: 'LM-2/clap.m4a' },
  { label: 'CH', relUrl: 'LM-2/hhclosed.m4a' },
  { label: 'CH short', relUrl: 'LM-2/hhclosed-short.m4a' },
  { label: 'OH', relUrl: 'LM-2/hhopen.m4a' },
  { label: 'OH mini', relUrl: '808-mini/hhopen-1.m4a' },
  { label: 'Ride', relUrl: 'LM-2/ride.m4a' },
  { label: 'Crash', relUrl: 'LM-2/crash.m4a' },
  { label: 'Tom H', relUrl: 'LM-2/tom-h.m4a' },
  { label: 'Tom M', relUrl: 'LM-2/tom-m.m4a' },
  { label: 'Tom L', relUrl: 'LM-2/tom-l.m4a' },
  { label: 'Cow', relUrl: 'LM-2/cowbell.m4a' },
  { label: '808 CH', relUrl: 'TR-808/hihat-close/ch.m4a' },
  { label: 'Mini CH', relUrl: '808-mini/hhclosed-1.m4a' },
];

const DANCE_90_CLUB_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 7800, level: 1.06, drive: 0.04 },
  { lpCutoffHz: 4500, level: 1.04 },
  { lpCutoffHz: 10500, drive: 0.06 },
  { lpCutoffHz: 12500, drive: 0.05 },
  { lpCutoffHz: 18500, level: 1.1 },
  { lpCutoffHz: 18500, level: 1.12 },
  { lpCutoffHz: 18000, level: 1.08 },
  { lpCutoffHz: 17500, level: 1.09 },
  { lpCutoffHz: 16800, level: 1.07 },
  { lpCutoffHz: 16200, level: 1.08 },
  { lpCutoffHz: 11000 },
  { lpCutoffHz: 10200 },
  { lpCutoffHz: 9500 },
  { lpCutoffHz: 12000 },
  { lpCutoffHz: 18500, level: 1.05 },
  { lpCutoffHz: 18500, level: 1.06 },
];

/** Curated: 90s euro / uptempo dance — bright snares + stacked hats. */
const KIT_DANCE_EURO_90_PADS: readonly LabMpcPadDef[] = [
  { label: '808 kick', relUrl: 'TR-808/kick/bd0000.m4a' },
  { label: 'Mini kick', relUrl: '808-mini/kick.m4a' },
  { label: 'Sn bright', relUrl: 'LM-2/snare-h.m4a' },
  { label: 'Mini sn 1', relUrl: '808-mini/snare-1.m4a' },
  { label: 'Snare', relUrl: 'LM-2/snare-m.m4a' },
  { label: '808 OH', relUrl: 'TR-808/hihat-open/oh00.m4a' },
  { label: 'Mini OH', relUrl: '808-mini/hhopen-1.m4a' },
  { label: 'LM OH', relUrl: 'LM-2/hhopen.m4a' },
  { label: '808 CH', relUrl: 'TR-808/hihat-close/ch.m4a' },
  { label: 'Mini CH 1', relUrl: '808-mini/hhclosed-1.m4a' },
  { label: 'Mini CH 2', relUrl: '808-mini/hhclosed-2.m4a' },
  { label: 'Ride', relUrl: 'LM-2/ride.m4a' },
  { label: 'Crash', relUrl: 'LM-2/crash.m4a' },
  { label: '808 clap', relUrl: 'TR-808/clap/cp.m4a' },
  { label: 'LM clap', relUrl: 'LM-2/clap.m4a' },
  { label: 'Tom low', relUrl: 'TR-808/tom-low/lt00.m4a' },
];

const DANCE_EURO_90_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 6200, level: 1.05, drive: 0.04 },
  { lpCutoffHz: 9000, level: 1.04 },
  { lpCutoffHz: 13000, drive: 0.08 },
  { lpCutoffHz: 12000, drive: 0.07 },
  { lpCutoffHz: 11000, drive: 0.06 },
  { lpCutoffHz: 17000, level: 1.08 },
  { lpCutoffHz: 17500, level: 1.1 },
  { lpCutoffHz: 17800, level: 1.06 },
  { lpCutoffHz: 18500, level: 1.12 },
  { lpCutoffHz: 18500, level: 1.14 },
  { lpCutoffHz: 18500, level: 1.1 },
  { lpCutoffHz: 16500, level: 1.08 },
  { lpCutoffHz: 16000, level: 1.09 },
  { lpCutoffHz: 11500, drive: 0.06 },
  { lpCutoffHz: 12000, drive: 0.05 },
  { lpCutoffHz: 8800, tuneSemi: -1 },
];

/** Curated: 90s freestyle / dance-pop — CR + LM Latin pocket. */
const KIT_DANCE_FREESTYLE_90_PADS: readonly LabMpcPadDef[] = [
  { label: 'CR kick', relUrl: 'Roland-CR-8000/kick.m4a' },
  { label: 'LM kick', relUrl: 'LM-2/kick.m4a' },
  { label: 'CR snare', relUrl: 'Roland-CR-8000/snare.m4a' },
  { label: 'LM snare', relUrl: 'LM-2/snare-m.m4a' },
  { label: 'CR OH', relUrl: 'Roland-CR-8000/hihat-open.m4a' },
  { label: 'LM OH', relUrl: 'LM-2/hhopen.m4a' },
  { label: 'CR CH', relUrl: 'Roland-CR-8000/hihat-closed.m4a' },
  { label: 'LM CHs', relUrl: 'LM-2/hhclosed-short.m4a' },
  { label: 'LM CH', relUrl: 'LM-2/hhclosed.m4a' },
  { label: 'CR clap', relUrl: 'Roland-CR-8000/clap.m4a' },
  { label: 'LM clap', relUrl: 'LM-2/clap.m4a' },
  { label: 'Conga H', relUrl: 'Roland-CR-8000/conga-high.m4a' },
  { label: 'Conga L', relUrl: 'Roland-CR-8000/conga-low.m4a' },
  { label: 'Tamb', relUrl: 'LM-2/tambourine.m4a' },
  { label: 'Cab', relUrl: 'LM-2/cabasa.m4a' },
  { label: 'Cow', relUrl: 'Roland-CR-8000/cowbell.m4a' },
];

const DANCE_FREESTYLE_90_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 7000, level: 1.05 },
  { lpCutoffHz: 8200, level: 1.04 },
  { lpCutoffHz: 10000, drive: 0.07 },
  { lpCutoffHz: 10500, drive: 0.06 },
  { lpCutoffHz: 15500, level: 1.06 },
  { lpCutoffHz: 17000, level: 1.05 },
  { lpCutoffHz: 17500, level: 1.08 },
  { lpCutoffHz: 18500, level: 1.1 },
  { lpCutoffHz: 18500, level: 1.08 },
  { lpCutoffHz: 11000, drive: 0.05 },
  { lpCutoffHz: 11800, drive: 0.05 },
  { lpCutoffHz: 9000, drive: 0.04 },
  { lpCutoffHz: 8200, drive: 0.04 },
  { lpCutoffHz: 12500 },
  { lpCutoffHz: 10500, drive: 0.06 },
  { lpCutoffHz: 10200, drive: 0.05 },
];

/** Curated: 90s new jack swing — rim + stacked claps + snappy hats. */
const KIT_RNB_NEW_JACK_90_PADS: readonly LabMpcPadDef[] = [
  { label: '808 kick', relUrl: 'TR-808/kick/bd0000.m4a' },
  { label: 'LM kick', relUrl: 'LM-2/kick.m4a' },
  { label: 'LM snare', relUrl: 'LM-2/snare-m.m4a' },
  { label: '808 snare', relUrl: 'TR-808/snare/sd0000.m4a' },
  { label: '808 rim', relUrl: 'TR-808/rimshot/rs.m4a' },
  { label: 'LM clap', relUrl: 'LM-2/clap.m4a' },
  { label: '808 clap', relUrl: 'TR-808/clap/cp.m4a' },
  { label: 'LM CH', relUrl: 'LM-2/hhclosed.m4a' },
  { label: 'LM CHs', relUrl: 'LM-2/hhclosed-short.m4a' },
  { label: 'LM OH', relUrl: 'LM-2/hhopen.m4a' },
  { label: '808 CH', relUrl: 'TR-808/hihat-close/ch.m4a' },
  { label: '808 OH', relUrl: 'TR-808/hihat-open/oh00.m4a' },
  { label: 'Mini sn', relUrl: '808-mini/snare-2.m4a' },
  { label: 'Mini CH', relUrl: '808-mini/hhclosed-2.m4a' },
  { label: 'Cow', relUrl: 'LM-2/cowbell.m4a' },
  { label: 'Crash', relUrl: 'LM-2/crash.m4a' },
];

const RNB_NEW_JACK_90_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 5200, level: 1.06, drive: 0.04 },
  { lpCutoffHz: 7800, level: 1.04 },
  { lpCutoffHz: 11000, drive: 0.08 },
  { lpCutoffHz: 7200, drive: 0.12 },
  { lpCutoffHz: 10500, drive: 0.06 },
  { lpCutoffHz: 12500, drive: 0.07 },
  { lpCutoffHz: 11800, drive: 0.06 },
  { lpCutoffHz: 18500, level: 1.1 },
  { lpCutoffHz: 18500, level: 1.12 },
  { lpCutoffHz: 17500, level: 1.08 },
  { lpCutoffHz: 18000, level: 1.06 },
  { lpCutoffHz: 16800, level: 1.05 },
  { lpCutoffHz: 11500, drive: 0.08 },
  { lpCutoffHz: 18500, level: 1.1 },
  { lpCutoffHz: 15800, level: 1.05 },
  { lpCutoffHz: 15000, level: 1.06 },
];

/** Curated: 90s R&B ballad — rides + congas + soft snares. */
const KIT_RNB_BALLAD_90_PADS: readonly LabMpcPadDef[] = [
  { label: 'LM kick', relUrl: 'LM-2/kick.m4a' },
  { label: '808 sub', relUrl: 'TR-808/kick/bd0000.m4a' },
  { label: 'Sn soft', relUrl: 'LM-2/snare-l.m4a' },
  { label: 'Sn mid', relUrl: 'LM-2/snare-m.m4a' },
  { label: '808 rim', relUrl: 'TR-808/rimshot/rs.m4a' },
  { label: 'Ride', relUrl: 'LM-2/ride.m4a' },
  { label: 'Crash', relUrl: 'LM-2/crash.m4a' },
  { label: 'LM OH', relUrl: 'LM-2/hhopen.m4a' },
  { label: 'LM CH', relUrl: 'LM-2/hhclosed.m4a' },
  { label: 'Conga H', relUrl: 'TR-808/conga-hi/hc00.m4a' },
  { label: 'Conga M', relUrl: 'TR-808/conga-mid/mc00.m4a' },
  { label: 'Conga L', relUrl: 'TR-808/conga-low/lc00.m4a' },
  { label: 'Shaker', relUrl: 'TR-808/maraca/ma.m4a' },
  { label: 'Cab', relUrl: 'LM-2/cabasa.m4a' },
  { label: 'Tamb', relUrl: 'LM-2/tambourine.m4a' },
  { label: 'Clave', relUrl: 'TR-808/clave/cl.m4a' },
];

const RNB_BALLAD_90_FX: ReadonlyArray<Partial<LabMpcPadPlayOpts>> = [
  { lpCutoffHz: 8800, level: 1.04 },
  { lpCutoffHz: 4200, level: 1.03 },
  { lpCutoffHz: 12500, drive: 0.02 },
  { lpCutoffHz: 11500, drive: 0.03 },
  { lpCutoffHz: 10000 },
  { lpCutoffHz: 15500, level: 1.06 },
  { lpCutoffHz: 15000, level: 1.05 },
  { lpCutoffHz: 17200, level: 1.05 },
  { lpCutoffHz: 17800, level: 1.04 },
  { lpCutoffHz: 9200, drive: 0.02 },
  { lpCutoffHz: 8800, drive: 0.02 },
  { lpCutoffHz: 8200, drive: 0.02 },
  { lpCutoffHz: 13000, drive: 0.02 },
  { lpCutoffHz: 12000 },
  { lpCutoffHz: 10500, drive: 0.02 },
  { lpCutoffHz: 10000, drive: 0.02 },
];

export const LAB_MPC_KIT_LIST: readonly LabMpcKitMeta[] = [
  {
    id: 'trapDark',
    title: 'Trap · dark plates',
    era: 'Curated · 808 + mini + LM punch',
    pads: KIT_TRAP_DARK_PADS,
    padFxDefaults: TRAP_DARK_FX,
  },
  {
    id: 'trapLight',
    title: 'Trap · light / melodic',
    era: 'Curated · LM-2 + 808 hats',
    pads: KIT_TRAP_LIGHT_PADS,
    padFxDefaults: TRAP_LIGHT_FX,
  },
  {
    id: 'trapDrill',
    title: 'Trap · drill pocket',
    era: 'Curated · 808 + mini + toms',
    pads: KIT_TRAP_DRILL_PADS,
    padFxDefaults: TRAP_DRILL_FX,
  },
  {
    id: 'trapHihat',
    title: 'Trap · hi-hat rolls',
    era: 'Curated · many hats + CR layer',
    pads: KIT_TRAP_HIHAT_PADS,
    padFxDefaults: TRAP_HIHAT_FX,
  },
  {
    id: 'trapLowEnd',
    title: 'Trap · low-end 808',
    era: 'Curated · subs + knock kicks',
    pads: KIT_TRAP_LOW_END_PADS,
    padFxDefaults: TRAP_LOW_END_FX,
  },
  {
    id: 'trap808Mini',
    title: 'Trap · modern mini 808',
    era: 'Curated · 808-mini forward',
    pads: KIT_TRAP_808_MINI_PADS,
    padFxDefaults: TRAP_808_MINI_FX,
  },
  {
    id: 'trapCr8000',
    title: 'Trap · dusty CR plates',
    era: 'Curated · CR-8000 + 808 glue',
    pads: KIT_TRAP_CR8000_PADS,
    padFxDefaults: TRAP_CR8000_FX,
  },
  {
    id: 'trapPhonk',
    title: 'Trap · phonk / dark bounce',
    era: 'Curated · cowbell + rim + drive',
    pads: KIT_TRAP_PHONK_PADS,
    padFxDefaults: TRAP_PHONK_FX,
  },
  {
    id: 'trapClubBounce',
    title: 'Trap · club bounce',
    era: 'Curated · LM-2 pocket + 808 sub',
    pads: KIT_TRAP_CLUB_BOUNCE_PADS,
    padFxDefaults: TRAP_CLUB_BOUNCE_FX,
  },
  {
    id: 'houseFourFour',
    title: 'House · four-on-the-floor',
    era: 'Curated · LM-2 + 808 sub + rides',
    pads: KIT_HOUSE_FOUR_FOUR_PADS,
    padFxDefaults: HOUSE_FOUR_FOUR_FX,
  },
  {
    id: 'houseDeep',
    title: 'House · deep plates',
    era: 'Curated · 808 body + toms + congas',
    pads: KIT_HOUSE_DEEP_PADS,
    padFxDefaults: HOUSE_DEEP_FX,
  },
  {
    id: 'houseGarage',
    title: 'House · garage shuffle',
    era: 'Curated · CR + 808 hats + clap stack',
    pads: KIT_HOUSE_GARAGE_PADS,
    padFxDefaults: HOUSE_GARAGE_FX,
  },
  {
    id: 'houseDisco',
    title: 'House · disco pocket',
    era: 'Curated · LM-2 forward + 808 hat lift',
    pads: KIT_HOUSE_DISCO_PADS,
    padFxDefaults: HOUSE_DISCO_FX,
  },
  {
    id: 'dance90Club',
    title: 'Dance · 90s club radio',
    era: 'Curated · LM-2 + 808 sub + rides',
    pads: KIT_DANCE_90_CLUB_PADS,
    padFxDefaults: DANCE_90_CLUB_FX,
  },
  {
    id: 'danceEuro90',
    title: 'Dance · 90s euro uptempo',
    era: 'Curated · bright snares + stacked hats',
    pads: KIT_DANCE_EURO_90_PADS,
    padFxDefaults: DANCE_EURO_90_FX,
  },
  {
    id: 'danceFreestyle90',
    title: 'Dance · 90s freestyle / Latin pop',
    era: 'Curated · CR-8000 + LM percussion',
    pads: KIT_DANCE_FREESTYLE_90_PADS,
    padFxDefaults: DANCE_FREESTYLE_90_FX,
  },
  {
    id: 'rnbSlowJam',
    title: 'R&B · slow jam',
    era: 'Curated · 90s slow jam · congas + soft hats',
    pads: KIT_RNB_SLOW_JAM_PADS,
    padFxDefaults: RNB_SLOW_JAM_FX,
  },
  {
    id: 'rnbNeoSoul',
    title: 'R&B · neo-soul pocket',
    era: 'Curated · 90s-00s · percussion + airy tops',
    pads: KIT_RNB_NEO_SOUL_PADS,
    padFxDefaults: RNB_NEO_SOUL_FX,
  },
  {
    id: 'rnb901Swing',
    title: 'R&B · 90s swing kit',
    era: 'Curated · LM-2 full palette',
    pads: KIT_RNB_901_SWING_PADS,
    padFxDefaults: RNB_901_SWING_FX,
  },
  {
    id: 'rnb808Groove',
    title: 'R&B · 808 soul groove',
    era: 'Curated · 808 + LM ride / OH',
    pads: KIT_RNB_808_GROOVE_PADS,
    padFxDefaults: RNB_808_GROOVE_FX,
  },
  {
    id: 'rnbNewJack90',
    title: 'R&B · 90s new jack swing',
    era: 'Curated · rim + double clap + tight hats',
    pads: KIT_RNB_NEW_JACK_90_PADS,
    padFxDefaults: RNB_NEW_JACK_90_FX,
  },
  {
    id: 'rnbBallad90',
    title: 'R&B · 90s ballad kit',
    era: 'Curated · ride/crash + congas + soft snares',
    pads: KIT_RNB_BALLAD_90_PADS,
    padFxDefaults: RNB_BALLAD_90_FX,
  },
  { id: 'tr808', title: 'Roland TR-808', era: '1980 · analog', pads: KIT_TR808 },
  { id: 'mini808', title: '808 mini kit', era: 'Modern · 808-style', pads: KIT_MINI808 },
  { id: 'lm2', title: 'Linn LM-2', era: '1982 · digital', pads: KIT_LM2 },
  { id: 'cr8000', title: 'Roland CR-8000', era: '1980s · rhythm', pads: KIT_CR8000 },
] as const;

export const LAB_MPC_PAD_COUNT = 16;

export function labMpcKitMeta(id: LabMpcKitId): LabMpcKitMeta | undefined {
  return LAB_MPC_KIT_LIST.find((k) => k.id === id);
}

/** Pad FX arrays when selecting a kit (neutral if the kit has no defaults). */
export function labMpcKitInitialPadFx(id: LabMpcKitId): {
  tuneSemi: number[];
  lpCutoffHz: number[];
  drive: number[];
  level: number[];
} {
  const meta = labMpcKitMeta(id);
  const tuneSemi = Array.from({ length: LAB_MPC_PAD_COUNT }, () => 0);
  const lpCutoffHz = Array.from({ length: LAB_MPC_PAD_COUNT }, () => 20000);
  const drive = Array.from({ length: LAB_MPC_PAD_COUNT }, () => 0);
  const level = Array.from({ length: LAB_MPC_PAD_COUNT }, () => 1);
  const def = meta?.padFxDefaults;
  if (!def || def.length !== LAB_MPC_PAD_COUNT) {
    return { tuneSemi, lpCutoffHz, drive, level };
  }
  for (let i = 0; i < LAB_MPC_PAD_COUNT; i += 1) {
    const row = def[i];
    if (!row) continue;
    if (row.tuneSemi !== undefined) tuneSemi[i] = row.tuneSemi;
    if (row.lpCutoffHz !== undefined) lpCutoffHz[i] = row.lpCutoffHz;
    if (row.drive !== undefined) drive[i] = row.drive;
    if (row.level !== undefined) level[i] = row.level;
  }
  return { tuneSemi, lpCutoffHz, drive, level };
}

type KitLoadState = 'idle' | 'loading' | 'ready' | 'failed';

interface LoadedKit {
  state: KitLoadState;
  /** One buffer per pad index; null if that pad's fetch failed. */
  buffers: (AudioBuffer | null)[];
  readyPromise: Promise<void>;
}

const loadedKits = new Map<LabMpcKitId, LoadedKit>();

async function fetchAndDecode(url: string, ctx: BaseAudioContext): Promise<AudioBuffer> {
  const resp = await fetch(url, { cache: 'force-cache' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const bytes = await resp.arrayBuffer();
  return await ctx.decodeAudioData(bytes.slice(0));
}

function startLoadKit(id: LabMpcKitId, ctx: BaseAudioContext): LoadedKit {
  const meta = labMpcKitMeta(id);
  const empty: LoadedKit = {
    state: 'loading',
    buffers: Array(LAB_MPC_PAD_COUNT).fill(null),
    readyPromise: Promise.resolve(),
  };
  if (!meta || meta.pads.length !== LAB_MPC_PAD_COUNT) {
    empty.state = 'failed';
    return empty;
  }

  loadedKits.set(id, empty);

  empty.readyPromise = (async () => {
    const buffers: (AudioBuffer | null)[] = Array(LAB_MPC_PAD_COUNT).fill(null);
    await Promise.all(
      meta.pads.map(async (pad, i) => {
        try {
          const buf = await fetchAndDecode(u(pad.relUrl), ctx);
          buffers[i] = buf;
        } catch {
          buffers[i] = null;
        }
      }),
    );
    empty.buffers = buffers;
    empty.state = buffers.some(Boolean) ? 'ready' : 'failed';
  })();

  return empty;
}

/** Begin or join kit decode. Safe to call repeatedly. */
export function ensureLabMpcKitLoaded(id: LabMpcKitId, ctx: BaseAudioContext): LoadedKit {
  const existing = loadedKits.get(id);
  if (existing) return existing;
  return startLoadKit(id, ctx);
}

export function getLabMpcKitLoadState(id: LabMpcKitId): KitLoadState {
  return loadedKits.get(id)?.state ?? 'idle';
}

function makeSoftClipCurve(amount: number): Float32Array {
  const n = 1024;
  const curve = new Float32Array(n);
  const k = Math.max(0, Math.min(1, amount)) * 10;
  for (let i = 0; i < n; i += 1) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

/** Schedule pad if buffer exists. Returns true if sample played. */
export function playLabMpcPad(
  ctx: AudioContext,
  kitId: LabMpcKitId,
  padIndex: number,
  whenSec: number,
  velocity01: number,
  opts?: LabMpcPadPlayOpts,
): boolean {
  const slot = loadedKits.get(kitId);
  const buf = slot?.buffers[padIndex];
  if (!buf) return false;
  const t = Math.max(whenSec, ctx.currentTime + 0.001);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const tune = Math.max(-36, Math.min(36, opts?.tuneSemi ?? 0));
  try {
    src.detune.setValueAtTime(tune * 100, t);
  } catch {
    /* detune unsupported — ignore */
  }

  const lpHzRaw = opts?.lpCutoffHz ?? 20000;
  const useLp = lpHzRaw < 18500;
  const lpHz = Math.max(40, Math.min(20000, lpHzRaw));

  const driveAmt = Math.max(0, Math.min(1, opts?.drive ?? 0));
  const useDrive = driveAmt > 0.004;

  const levelMul = Math.max(0, Math.min(1.5, opts?.level ?? 1));
  const peak = Math.max(0.08, Math.min(1.2, velocity01 * 0.95)) * levelMul;

  let node: AudioNode = src;
  if (useLp) {
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(lpHz, t);
    filt.Q.setValueAtTime(0.85, t);
    node.connect(filt);
    node = filt;
  }
  if (useDrive) {
    const sh = ctx.createWaveShaper();
    sh.curve = makeSoftClipCurve(driveAmt);
    sh.oversample = '2x';
    node.connect(sh);
    node = sh;
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  node.connect(g).connect(ctx.destination);
  src.start(t);
  src.stop(t + Math.min(2.5, buf.duration + 0.15));
  return true;
}

export function labMpcPadLabel(kitId: LabMpcKitId, padIndex: number): string {
  const m = labMpcKitMeta(kitId);
  const p = m?.pads[padIndex];
  return p?.label ?? `Pad ${padIndex + 1}`;
}
