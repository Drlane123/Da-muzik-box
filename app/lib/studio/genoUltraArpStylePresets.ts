/**
 * Geno Ultra ARP — genre style presets.
 * Patterns inspired by common trap / hip-hop / techno / house / dance arpeggio conventions
 * (Stepista, LibreArp, and classic 16-step sequencer literature — original step data).
 */
import {
  emptyGenoArpBarOctShifts,
  emptyGenoArpLaneLevels,
  genoArpCenterPresetRow,
  genoArpGridCols,
  genoArpSanitizeBarLength,
  GENO_ARP_ACTIVE_ROW_SPAN,
  GENO_ARP_MAX_BARS,
  GENO_ARP_MAX_COLS,
  GENO_ARP_ROWS,
  GENO_ARP_STEPS_PER_BAR,
  type GenoArpBarLength,
  type GenoArpBarOctShift,
  type GenoArpGlobalOctShift,
  type GenoArpOrder,
} from '@/app/lib/studio/genoUltraArpPattern';

export type GenoArpStyleCategory = 'trap' | 'hiphop' | 'techno' | 'electro' | 'horror' | 'house' | 'dance' | 'logic';

/** One bar of 16th-note steps — each step lists active note rows (relative 0–5, centered on apply). */
export type GenoArpBarStepPattern = readonly (readonly number[])[];

export type GenoArpStylePreset = {
  id: string;
  name: string;
  category: GenoArpStyleCategory;
  description: string;
  /** Synth patch id — when omitted, resolved from GENO_ARP_STYLE_SOUND_BY_ID. */
  soundPresetId?: string;
  rateIdx: number;
  gate: number;
  swing: number;
  order?: GenoArpOrder;
  /** 16 steps per bar (repeats across pattern length). */
  steps: GenoArpBarStepPattern;
  mod1?: readonly number[];
  mod2?: readonly number[];
  vel?: readonly number[];
  /** Recommended pattern length (4 or 8 bars). */
  barLength?: GenoArpBarLength;
  /** Per-bar octave lane — tiles across barLength (e.g. [0,0,-1,-1] = drop every 2 bars). */
  barOctShifts?: readonly GenoArpBarOctShift[];
  /** Global octave shift applied to whole pattern (−1 keeps slasher arps out of the high register). */
  octShift?: GenoArpGlobalOctShift;
};

const S16 = GENO_ARP_STEPS_PER_BAR;

/** Two bars center, two bars down — tiles to 8 bars: 0,0,-1,-1,0,0,-1,-1. */
const OCT_2BAR_DROP: readonly GenoArpBarOctShift[] = [0, 0, -1, -1];

/** Computer Age family — shared 8-bar octave + tempo (TB-303 syncopation, machine-tight). */
const AGE_OCT_8: Pick<GenoArpStylePreset, 'barLength' | 'barOctShifts' | 'rateIdx' | 'gate' | 'swing' | 'order'> = {
  barLength: 8,
  barOctShifts: OCT_2BAR_DROP,
  rateIdx: 1,
  gate: 0.44,
  swing: 0,
  order: 'UP',
};

/** Keys / pluck — shared pocket (ballad-friendly gate + light swing). */
const KEYS_PLUCK_4: Pick<GenoArpStylePreset, 'barLength' | 'rateIdx' | 'gate' | 'swing' | 'order'> = {
  barLength: 4,
  rateIdx: 1,
  gate: 0.58,
  swing: 0.08,
  order: 'UP',
};

/** Slasher horror — legato-friendly gate, in-key minor voicing at center register. */
const HORROR_SLASH_8: Pick<
  GenoArpStylePreset,
  'barLength' | 'barOctShifts' | 'rateIdx' | 'gate' | 'swing' | 'order' | 'octShift'
> = {
  barLength: 8,
  barOctShifts: OCT_2BAR_DROP,
  rateIdx: 1,
  gate: 0.54,
  swing: 0,
  order: 'UP',
  octShift: 0,
};

/** Same yo-yo cycle at center register (Jason Creep and family). */
const HORROR_SLASH_8_CENTER: Pick<
  GenoArpStylePreset,
  'barLength' | 'barOctShifts' | 'rateIdx' | 'gate' | 'swing' | 'order' | 'octShift'
> = {
  ...HORROR_SLASH_8,
  octShift: 0,
};

/** Same yo-yo cycle lifted one octave (Halloween / Michael Myers). */
const HORROR_SLASH_8_LIFT: Pick<
  GenoArpStylePreset,
  'barLength' | 'barOctShifts' | 'rateIdx' | 'gate' | 'swing' | 'order' | 'octShift'
> = {
  ...HORROR_SLASH_8_CENTER,
  octShift: 0,
};

/** Double-time 1/32 slasher arp — same pattern grid, faster playback. */
const HORROR_SLASH_FAST: Pick<
  GenoArpStylePreset,
  'barLength' | 'barOctShifts' | 'rateIdx' | 'gate' | 'swing' | 'order' | 'octShift'
> = {
  ...HORROR_SLASH_8_CENTER,
  rateIdx: 0,
  gate: 0.46,
};

/** Two bars center, two bars up. */
const OCT_2BAR_LIFT: readonly GenoArpBarOctShift[] = [0, 0, 1, 1];

/** Two bars center, lift, then drop — call-and-response octave motion. */
const OCT_2BAR_PING: readonly GenoArpBarOctShift[] = [0, 0, 1, -1];

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

function everyNth(n: number, row = 0): GenoArpBarStepPattern {
  const centered = genoArpCenterPresetRow(row);
  return Array.from({ length: S16 }, (_, i) => (i % n === 0 ? [centered] : []));
}

function offbeat(row = 0): GenoArpBarStepPattern {
  const centered = genoArpCenterPresetRow(row);
  return Array.from({ length: S16 }, (_, i) => (i % 4 === 2 ? [centered] : []));
}

function velAccent(strong: number[], weak = 0.45): number[] {
  return Array.from({ length: S16 }, (_, i) => (strong.includes(i) ? 1 : weak));
}

function modSweep(): number[] {
  return Array.from({ length: S16 }, (_, i) => i / (S16 - 1));
}

/** Dark filter sweep — stays in low/murky range for horror arp. */
function modAgeHorror(): number[] {
  return Array.from({ length: S16 }, (_, i) => 0.1 + (i / (S16 - 1)) * 0.38);
}

function modAgeHorrorPulse(): number[] {
  return Array.from({ length: S16 }, (_, i) => (i % 4 === 0 ? 0.45 : 0.08));
}

function velAgeHorror(): number[] {
  return velAccent([0, 4, 8, 12], 0.46);
}

/** Matched synth timbre per genre arp style (from GENO_ULTRA_SYNTH_PRESETS). */
export const GENO_ARP_STYLE_SOUND_BY_ID: Record<string, string> = {
  'trap-atl-roll': 'ultra-phase-bass',
  'trap-dark-pluck': 'ultra-crystal-pluck',
  'trap-hat-ladder': 'ultra-digi-pluck',
  'trap-southside-slide': 'ultra-dub-sub',
  'trap-future-flip': 'ultra-supersaw-hook',
  'trap-night-ride': 'ultra-trap-sub',
  'trap-ogx-bounce': 'ultra-growl-808',
  'trap-memphis-drip': 'ultra-wobble-bass',
  'trap-atl-glide': 'ultra-trap-sub',
  'hiphop-boom-bap': 'ultra-moog-bass',
  'hiphop-gfunk': 'ultra-chorus-lead',
  'hiphop-drill': 'ultra-deep-roller',
  'techno-berlin-16': 'ultra-laser-lead',
  'techno-rumble': 'ultra-warehouse',
  'techno-acid': 'ultra-acid-line',
  'house-offbeat': 'ultra-slap-house',
  'house-disco': 'ultra-boogie-bass',
  'house-deep': 'ultra-warehouse',
  'dance-euro-run': 'ultra-bright-hook',
  'dance-edm-build': 'ultra-sync-lead',
  'dance-trance-lift': 'ultra-dream-lead',
  'dance-festival-rise': 'ultra-grand-rise',
  'dance-hyper-glide': 'ultra-neon-lead',
  'dance-mainstage': 'ultra-shimmer-pad',
  'dance-anthem-run': 'ultra-bright-hook',
  'logic-upbeat-pump': 'ultra-stage-keys',
  'logic-echoed-cycle': 'ultra-ghost-fx',
  'electro-computer-age': 'ultra-horror-keys',
  'electro-push-button': 'ultra-acid-line',
  'electro-age-sync': 'ultra-dread-lead',
  'electro-age-offbeat': 'ultra-haunt-keys',
  'electro-age-stutter': 'ultra-evil-arp',
  'electro-age-pulse': 'ultra-shock-keys',
  'electro-age-machine': 'ultra-phantom-stab',
  'electro-303-bounce': 'ultra-porta-lead',
  'electro-jam-sync': 'ultra-wire-lead',
  'electro-bounce-drop': 'ultra-crystal-pluck',
  'electro-clear-rise': 'ultra-wire-lead',
  'electro-clear-pre': 'ultra-porta-lead',
  'electro-clear-run': 'ultra-digi-pluck',
  'electro-kingdom-groove': 'ultra-kingdom-bass',
  'electro-kingdom-oct': 'ultra-boogie-bass',
  'electro-kingdom-pulse': 'ultra-dub-sub',
  'electro-siberian-funk': 'ultra-siberian-moog',
  'electro-siberian-motor': 'ultra-siberian-moog',
  'electro-siberian-8th': 'ultra-siberian-moog',
  'electro-siberian-lock': 'ultra-siberian-moog',
  'electro-siberian-lead': 'ultra-laser-lead',
  'electro-siberian-ice': 'ultra-wire-lead',
  'electro-siberian-hook': 'ultra-bright-hook',
  'electro-bounce-lift': 'ultra-digi-pluck',
  'electro-bounce-pump': 'ultra-guitar-pluck',
  'horror-michael': 'ultra-michael-pluck',
  'horror-camp': 'ultra-camp-pluck',
  'horror-creep': 'ultra-creep-pluck',
  'horror-stab': 'ultra-stab-pluck',
  'horror-rush': 'ultra-creep-pluck',
  'keys-rhodes-groove': 'ultra-rhodes-keys',
  'keys-marimba-glow': 'ultra-marimba-pluck',
  'keys-harp-sparkle': 'ultra-harp-spark',
  'keys-lounge-organ': 'ultra-lounge-organ',
  'keys-ballad-arp': 'ultra-ballad-keys',
};

export function genoArpStyleSoundPresetId(styleId: string): string {
  return GENO_ARP_STYLE_SOUND_BY_ID[styleId] ?? 'ultra-warm-lead';
}

/** Trap — triplet-roll feel on 1/16 grid (Metro / 808 Mafia style). */
const TRAP_ATL_ROLL: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [3, 0],
  [6, 0, 2],
  [8, 2],
  [10, 0],
  [12, 0, 2],
  [14, 2],
);

/** Trap — dark pluck, sparse root + fifth. */
const TRAP_DARK_PLUCK: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [4, 2],
  [8, 0],
  [12, 2],
);

/** Trap — hi-hat roll ladder (Zaytoven / Tay Keith rolls). */
const TRAP_HAT_LADDER: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 1],
  [4, 0],
  [5, 1],
  [6, 2],
  [7, 1],
  [8, 0],
  [9, 1],
  [10, 2],
  [11, 1],
  [12, 0],
  [13, 1],
  [14, 2],
  [15, 1],
);

/** Trap — Southside slide (ATL roll cousin, more glide notes). */
const TRAP_SOUTHSIDE_SLIDE: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [2, 0, 1],
  [5, 2],
  [7, 0],
  [9, 0, 2],
  [11, 2],
  [13, 0],
  [15, 0, 2, 3],
);

/** Trap — future flip (Metro melodic bounce, sparse fifths). */
const TRAP_FUTURE_FLIP: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [3, 2],
  [6, 0],
  [8, 0, 2],
  [10, 2],
  [12, 0],
  [14, 0, 2],
);

/** Trap — night ride (dark syncopated 808, tight triplets). */
const TRAP_NIGHT_RIDE: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [1, 0],
  [4, 2],
  [6, 0],
  [8, 0, 2],
  [11, 2],
  [13, 0],
  [15, 0, 2],
);

/** Trap — OGX bounce (modern offset pocket, offbeat fifths). */
const TRAP_OGX_BOUNCE: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [3, 0, 2],
  [6, 0],
  [8, 2],
  [10, 0],
  [12, 0, 2],
  [14, 1],
);

/** Trap — Memphis drip (phonk-style drip roll into bar end). */
const TRAP_MEMPHIS_DRIP: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [2, 0],
  [5, 0, 2],
  [8, 0],
  [10, 2],
  [12, 0, 2],
  [13, 0],
  [14, 0, 2],
  [15, 0],
);

/** Trap — ATL glide (ATL roll with upper-neighbor slides). */
const TRAP_ATL_GLIDE: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [3, 0],
  [5, 0, 2],
  [7, 2],
  [9, 0],
  [11, 0, 2],
  [13, 2],
  [15, 0, 3],
);

/** Hip hop — boom bap pocket (1 & 3 with ghost on 2). */
const HIPHOP_BOOM_BAP: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [6, 1],
  [8, 0],
  [14, 1],
);

/** Hip hop — G-funk syncopation. */
const HIPHOP_GFUNK: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [3, 2],
  [7, 0],
  [10, 2],
  [12, 0],
);

/** Hip hop — drill half-time bounce. */
const HIPHOP_DRILL: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [4, 0, 2],
  [8, 0],
  [12, 0, 2],
);

/** Techno — Berlin 16th run (Detroit / Berghain bass pulse). */
const TECHNO_BERLIN_16: GenoArpBarStepPattern = Array.from({ length: S16 }, (_, i) => [
  genoArpCenterPresetRow(i % 3),
]);

/** Techno — rumble 1/8 root with fifth every 2 beats. */
const TECHNO_RUMBLE: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [2, 0],
  [4, 0, 2],
  [6, 0],
  [8, 0],
  [10, 0],
  [12, 0, 2],
  [14, 0],
);

/** Techno — acid squelch (16ths with row alternation). */
const TECHNO_ACID: GenoArpBarStepPattern = Array.from({ length: S16 }, (_, i) =>
  i % 2 === 0 ? [genoArpCenterPresetRow(0)] : [genoArpCenterPresetRow(1)],
);

/** Electro — Newcleus "Computer Age" TB-303 UP cycle (16ths, machine-tight). */
const ELECTRO_COMPUTER_AGE: GenoArpBarStepPattern = Array.from({ length: S16 }, (_, i) => [
  genoArpCenterPresetRow(i % 3),
]);

/** Computer Age — syncopated rests on beats 2 & 4 (303 pocket). */
const ELECTRO_AGE_SYNCOP: GenoArpBarStepPattern = Array.from({ length: S16 }, (_, i) =>
  i === 4 || i === 12 ? [] : [genoArpCenterPresetRow(i % 3)],
);

/** Computer Age — offbeat-led UP cycle (downbeat gaps). */
const ELECTRO_AGE_OFFBEAT: GenoArpBarStepPattern = barSteps(
  [1, 0],
  [2, 1],
  [3, 2],
  [5, 0],
  [6, 1],
  [7, 2],
  [9, 0],
  [10, 1],
  [11, 2],
  [13, 0],
  [14, 1],
  [15, 2],
);

/** Computer Age — stuttered 16th pairs (syncopated doubles). */
const ELECTRO_AGE_STUTTER: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [1, 1],
  [3, 2],
  [4, 0],
  [6, 1],
  [7, 2],
  [8, 0],
  [9, 1],
  [11, 2],
  [12, 0],
  [14, 1],
  [15, 2],
);

/** Computer Age — triplet-grid syncopation with end-of-beat rests. */
const ELECTRO_AGE_PULSE: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [1, 1],
  [2, 2],
  [4, 0],
  [5, 1],
  [6, 2],
  [8, 0],
  [9, 1],
  [10, 2],
  [12, 0],
  [13, 1],
  [14, 2],
);

/** Computer Age — root/fifth alternation with bar-end push. */
const ELECTRO_AGE_MACHINE: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [1, 2],
  [2, 0],
  [3, 2],
  [4, 0],
  [5, 2],
  [6, 0],
  [7, 2],
  [8, 0],
  [9, 2],
  [10, 0],
  [11, 2],
  [12, 0],
  [13, 2],
  [14, 0],
  [15, 0, 2],
);

/** Electro — "Push the Button" half-time → double-time fill at bar end. */
const ELECTRO_PUSH_BUTTON: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [4, 0],
  [6, 2],
  [8, 0],
  [9, 1],
  [10, 0, 2],
  [11, 1, 3],
  [12, 0, 2, 4],
  [13, 0, 1, 2],
  [14, 0, 2, 3],
  [15, 0, 1, 2, 3, 4],
);

/** Electro — root ↔ fifth 16th alternation (808 + 303 electro pocket). */
const ELECTRO_303_BOUNCE: GenoArpBarStepPattern = Array.from({ length: S16 }, (_, i) => [
  genoArpCenterPresetRow(i % 2 === 0 ? 0 : 2),
]);

/** Electro — Jam On It sync-lead ping-pong with robotic gaps. */
const ELECTRO_JAM_SYNC: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 1],
  [4, 0],
  [5, 2],
  [8, 0],
  [9, 1],
  [10, 2],
  [11, 3],
  [12, 0],
  [13, 2],
  [14, 1],
  [15, 0, 2],
);

/** Electro — bouncy offbeat pluck (syncopated pocket). */
const ELECTRO_BOUNCE_DROP: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [3, 2],
  [6, 0],
  [8, 2],
  [10, 0],
  [12, 2],
  [14, 0],
  [15, 0, 2],
);

/** Electro — UP/DN ping-pong pluck with offbeat fifths. */
const ELECTRO_BOUNCE_LIFT: GenoArpBarStepPattern = barSteps(
  [1, 0],
  [3, 1],
  [5, 2],
  [7, 1],
  [9, 0],
  [11, 2],
  [13, 1],
  [15, 0, 2],
);

/** Electro — tight 16th pluck pump (maximum bounce). */
const ELECTRO_BOUNCE_PUMP: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [2, 2],
  [4, 0],
  [5, 2],
  [8, 0],
  [10, 2],
  [12, 0],
  [13, 2],
  [14, 0],
  [15, 2],
);

/** Cybotron Clear (1983) — shared uptempo electro pocket (~125 BPM @ 1/16). */
const CLEAR_ELECTRO_125: Pick<
  GenoArpStylePreset,
  'barLength' | 'rateIdx' | 'gate' | 'swing' | 'order' | 'octShift'
> = {
  barLength: 4,
  rateIdx: 1,
  gate: 0.38,
  swing: 0,
  order: 'UP',
  octShift: 0,
};

function modClearRise(): number[] {
  return Array.from({ length: S16 }, (_, i) => 0.1 + (i / (S16 - 1)) * 0.75);
}

/** Clear — chromatic 16th climb (intro / rising MS-10 arp). */
const ELECTRO_CLEAR_RISE: GenoArpBarStepPattern = Array.from({ length: S16 }, (_, i) => [
  genoArpCenterPresetRow(i % GENO_ARP_ACTIVE_ROW_SPAN),
]);

/** Clear — pre-chorus phrase with robotic 16th rest (find-your-mind pocket). */
const ELECTRO_CLEAR_PRE: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 3],
  [4, 4],
  [5, 5],
  [9, 0],
  [10, 1],
  [11, 2],
  [12, 3],
  [13, 4],
  [14, 5],
  [15, 0, 3],
);

/** Clear — uptempo up/down chromatic run (full pre-chorus energy). */
const ELECTRO_CLEAR_RUN: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 3],
  [4, 4],
  [5, 5],
  [6, 4],
  [7, 3],
  [8, 0],
  [9, 1],
  [10, 2],
  [11, 3],
  [12, 4],
  [13, 5],
  [14, 4],
  [15, 3],
);

/** Electric Kingdom (Twilight 22) — shared freestyle electro bass pocket (~127 BPM @ 1/16). */
const KINGDOM_ELECTRO_127: Pick<
  GenoArpStylePreset,
  'barLength' | 'rateIdx' | 'gate' | 'swing' | 'order' | 'octShift'
> = {
  barLength: 4,
  rateIdx: 1,
  gate: 0.55,
  swing: 0.06,
  order: 'UP',
  octShift: 0,
};

/** Kingdom — syncopated Odyssey groove (main electro-funk bass riff). */
const ELECTRO_KINGDOM_GROOVE: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [2, 0],
  [3, 2],
  [5, 0],
  [6, 2],
  [8, 0],
  [10, 0, 2],
  [12, 2],
  [14, 0],
  [15, 0, 2],
);

/** Kingdom — root ↔ octave bounce (live ARP Odyssey expression). */
const ELECTRO_KINGDOM_OCT: GenoArpBarStepPattern = barSteps(
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
  [15, 0, 2],
);

/** Kingdom — 808 sub pulse aligned with kick pocket (steps 1 & 7). */
const ELECTRO_KINGDOM_PULSE: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [2, 0],
  [4, 2],
  [6, 0, 2],
  [9, 0],
  [11, 2],
  [12, 0],
  [14, 0],
);

/** Siberian Nights (Twilight 22) — punchy 80s electro @ ~130 BPM. */
const SIBERIAN_ELECTRO_130: Pick<
  GenoArpStylePreset,
  'barLength' | 'rateIdx' | 'gate' | 'swing' | 'order' | 'octShift'
> = {
  barLength: 4,
  rateIdx: 1,
  gate: 0.48,
  swing: 0.04,
  order: 'UP',
  octShift: 0,
};

const SIBERIAN_LEAD_130: Pick<
  GenoArpStylePreset,
  'barLength' | 'rateIdx' | 'gate' | 'swing' | 'order' | 'octShift'
> = {
  barLength: 4,
  rateIdx: 1,
  gate: 0.42,
  swing: 0.03,
  order: 'UP',
  octShift: 1,
};

/** Pure repeating Moog bass — one root, machine drive (no melody rows). */
const SIBERIAN_BASS_MACHINE: Pick<
  GenoArpStylePreset,
  'barLength' | 'rateIdx' | 'gate' | 'swing' | 'order' | 'octShift'
> = {
  barLength: 4,
  rateIdx: 1,
  gate: 0.56,
  swing: 0,
  order: 'UP',
  octShift: 0,
};

/** Siberian — straight 16th root machine (ba-ba-ba-ba…). */
const ELECTRO_SIBERIAN_MOTOR: GenoArpBarStepPattern = everyNth(1, 0);

/** Siberian — 8th-note root drive (same note, half the hits). */
const ELECTRO_SIBERIAN_8TH: GenoArpBarStepPattern = everyNth(2, 0);

/** Siberian — locked 16th root with one-beat breath (repeating loop). */
const ELECTRO_SIBERIAN_LOCK: GenoArpBarStepPattern = Array.from({ length: S16 }, (_, i) =>
  i === 8 ? [] : [genoArpCenterPresetRow(0)],
);

/** Siberian — syncopated electro-funk bass pocket. */
const ELECTRO_SIBERIAN_FUNK: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [3, 0],
  [5, 2],
  [7, 0],
  [10, 2],
  [12, 0],
  [15, 0, 2],
);

/** Siberian — stomp pulse with octave pop on the hook. */
const ELECTRO_SIBERIAN_STOMP: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [4, 0],
  [8, 0, 2],
  [12, 0],
  [14, 2],
);

/** Siberian — Prophet-style lead arp phrase. */
const ELECTRO_SIBERIAN_LEAD: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [1, 1],
  [2, 2],
  [4, 1],
  [5, 3],
  [8, 0],
  [9, 2],
  [11, 3],
  [12, 4],
  [15, 3],
);

/** Siberian — icy chromatic 16th climb. */
const ELECTRO_SIBERIAN_ICE: GenoArpBarStepPattern = Array.from({ length: S16 }, (_, i) => [
  genoArpCenterPresetRow(i % GENO_ARP_ACTIVE_ROW_SPAN),
]);

/** Siberian — catchy hook arp (verse melody bounce). */
const ELECTRO_SIBERIAN_HOOK: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [2, 2],
  [4, 0],
  [6, 2],
  [8, 0],
  [10, 1],
  [12, 2],
  [14, 3],
);

/** Horror — Halloween minor triad crawl (in-key dyads, no chromatic neighbors). */
const HORROR_MICHAEL: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [3, 2],
  [6, 0, 4],
  [8, 2],
  [10, 0],
  [12, 0, 2, 4],
  [14, 2],
);

/** Horror — Friday 13th root–fifth pulse (minor triad tones only). */
const HORROR_CAMP: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [3, 4],
  [6, 0],
  [8, 0, 4],
  [11, 0],
  [13, 4],
  [15, 0, 4],
);

/** Horror — Jason scale crawl through minor chord tones (0→2→4→5). */
const HORROR_CREEP: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [2, 2],
  [4, 4],
  [6, 5],
  [8, 4],
  [10, 2],
  [12, 0],
  [14, 0, 2],
);

/** Horror — syncopated minor triad stabs. */
const HORROR_STAB: GenoArpBarStepPattern = barSteps(
  [1, 0, 2, 4],
  [5, 0],
  [9, 0, 2, 4],
  [13, 0, 2],
);

/** Keys / pluck — syncopated offbeat chord-tone pluck. */
const KEYS_RHODES_GROOVE: GenoArpBarStepPattern = barSteps(
  [2, 0],
  [6, 2],
  [10, 0],
  [14, 4],
);

/** Keys / pluck — bouncy root–third–fifth bounce. */
const KEYS_MARIMBA_GLOW: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [2, 2],
  [4, 4],
  [6, 2],
  [8, 0],
  [10, 4],
  [12, 2],
  [14, 0],
);

/** Keys / pluck — rolling harp arpeggio (ascend + resolve). */
const KEYS_HARP_SPARKLE: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [2, 2],
  [4, 4],
  [6, 5],
  [8, 4],
  [10, 2],
  [12, 0],
  [14, 0, 2, 4],
);

/** Keys / pluck — slow lounge organ cycle. */
const KEYS_LOUNGE_ORGAN: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [4, 2],
  [8, 4],
  [12, 2],
);

/** Keys / pluck — ballad root–third–fifth spread. */
const KEYS_BALLAD_ARP: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [3, 2],
  [6, 4],
  [9, 2],
  [12, 0],
  [15, 4],
);

/** House — classic offbeat stab. */
const HOUSE_OFFBEAT: GenoArpBarStepPattern = offbeat(0);

/** House — disco four-on-floor root. */
const HOUSE_DISCO: GenoArpBarStepPattern = everyNth(4, 0);

/** House — deep chord stab (1 & 3 + extension). */
const HOUSE_DEEP: GenoArpBarStepPattern = barSteps(
  [0, 0, 2],
  [8, 0, 2, 4],
);

/** Dance — euro trance up-run. */
const DANCE_EURO_RUN: GenoArpBarStepPattern = Array.from({ length: S16 }, (_, i) => [
  genoArpCenterPresetRow(i % GENO_ARP_ACTIVE_ROW_SPAN),
]);

/** Dance — EDM build 16th fill. */
const DANCE_EDM_BUILD: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [2, 1],
  [4, 2],
  [6, 3],
  [8, 0, 2],
  [10, 1, 3],
  [12, 0, 2, 4],
  [14, 1, 3, 5],
);

/** Dance — trance lift (staggered ascent with rests, chord widen). */
const DANCE_TRANCE_LIFT: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [2, 1],
  [5, 2],
  [7, 3],
  [9, 0, 2],
  [12, 1, 3],
  [14, 0, 2, 4],
  [15, 1, 3, 5],
);

/** Dance — festival rise (accelerating stack into full chord). */
const DANCE_FESTIVAL_RISE: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [1, 1],
  [3, 2],
  [5, 0, 2],
  [7, 1, 3],
  [9, 0, 2, 4],
  [11, 1, 3, 5],
  [13, 0, 2, 4, 5],
  [15, 0, 1, 2, 3, 4, 5],
);

/** Dance — hyper glide (stuttered 16ths with triplet tail). */
const DANCE_HYPER_GLIDE: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [2, 1],
  [4, 2],
  [5, 1],
  [7, 0],
  [9, 2],
  [11, 1],
  [13, 0],
  [14, 2],
  [15, 0, 2],
);

/** Dance — mainstage drop (anticipation fill before downbeat). */
const DANCE_MAINSTAGE: GenoArpBarStepPattern = barSteps(
  [0, 0],
  [4, 2],
  [8, 0, 2],
  [10, 1],
  [12, 0, 2, 4],
  [14, 0, 1, 2, 3],
);

/** Dance — anthem run (ascend first half, mirror descent second). */
const DANCE_ANTHEM_RUN: GenoArpBarStepPattern = Array.from({ length: S16 }, (_, i) => {
  const span = GENO_ARP_ACTIVE_ROW_SPAN;
  if (i < 8) return [genoArpCenterPresetRow(i % span)];
  return [genoArpCenterPresetRow(span - 1 - (i % span))];
});

export const GENO_ARP_STYLE_PRESETS: readonly GenoArpStylePreset[] = [
  {
    id: 'trap-atl-roll',
    name: 'Trap — ATL Roll',
    category: 'trap',
    description: 'Triplet-flavored 808 roll with fifth hits',
    rateIdx: 1,
    gate: 0.62,
    swing: 0.18,
    steps: TRAP_ATL_ROLL,
    vel: velAccent([0, 6, 10, 12], 0.5),
    mod1: [0, 0, 0.2, 0, 0, 0, 0.55, 0, 0, 0.7, 0, 0, 0.85, 0, 0.4, 0],
    mod2: [0, 0, 0, 0, 0, 0, 0.3, 0, 0, 0.5, 0, 0, 0.6, 0, 0, 0],
  },
  {
    id: 'trap-dark-pluck',
    name: 'Trap — Dark Pluck',
    category: 'trap',
    description: 'Sparse root + fifth pluck pattern',
    rateIdx: 2,
    gate: 0.72,
    swing: 0.1,
    steps: TRAP_DARK_PLUCK,
    vel: velAccent([0, 8], 0.55),
    mod1: [0.6, 0, 0, 0, 0.4, 0, 0, 0, 0.75, 0, 0, 0, 0.5, 0, 0, 0],
  },
  {
    id: 'trap-hat-ladder',
    name: 'Trap — Hat Ladder',
    category: 'trap',
    description: 'Full 16th note ladder roll',
    rateIdx: 1,
    gate: 0.38,
    swing: 0.22,
    steps: TRAP_HAT_LADDER,
    vel: velAccent([0, 4, 8, 12], 0.65),
    mod2: Array.from({ length: S16 }, (_, i) => (i % 4 === 0 ? 0.5 : 0.1)),
  },
  {
    id: 'trap-southside-slide',
    name: 'Trap — Southside Slide',
    category: 'trap',
    description: 'ATL-style roll with glide and upper-neighbor slides',
    rateIdx: 1,
    gate: 0.58,
    swing: 0.2,
    steps: TRAP_SOUTHSIDE_SLIDE,
    vel: velAccent([0, 5, 9, 15], 0.48),
    mod1: [0, 0, 0.35, 0, 0, 0.5, 0, 0, 0, 0.65, 0, 0, 0, 0, 0, 0.9],
    mod2: [0, 0, 0.2, 0, 0, 0.35, 0, 0, 0, 0.45, 0, 0, 0, 0, 0, 0.55],
  },
  {
    id: 'trap-future-flip',
    name: 'Trap — Future Flip',
    category: 'trap',
    description: 'Modern melodic trap bounce with fifth accents',
    rateIdx: 1,
    gate: 0.64,
    swing: 0.16,
    steps: TRAP_FUTURE_FLIP,
    vel: velAccent([0, 6, 12], 0.52),
    mod1: [0, 0, 0, 0.25, 0, 0, 0.45, 0, 0.55, 0, 0, 0.7, 0, 0, 0.8, 0],
    mod2: [0, 0, 0, 0, 0, 0, 0.3, 0, 0, 0.4, 0, 0, 0, 0, 0.5, 0],
  },
  {
    id: 'trap-night-ride',
    name: 'Trap — Night Ride',
    category: 'trap',
    description: 'Dark syncopated 808 with tight triplet clusters',
    rateIdx: 1,
    gate: 0.6,
    swing: 0.19,
    steps: TRAP_NIGHT_RIDE,
    vel: velAccent([0, 4, 8, 13], 0.46),
    mod1: [0, 0.15, 0, 0, 0.4, 0, 0.5, 0, 0.6, 0, 0, 0.75, 0, 0.85, 0, 0.5],
    mod2: [0, 0, 0, 0, 0.25, 0, 0.35, 0, 0, 0, 0.5, 0, 0, 0.6, 0, 0],
  },
  {
    id: 'trap-ogx-bounce',
    name: 'Trap — OGX Bounce',
    category: 'trap',
    description: 'Modern pocket bounce with offbeat fifth stabs',
    rateIdx: 1,
    gate: 0.61,
    swing: 0.17,
    steps: TRAP_OGX_BOUNCE,
    vel: velAccent([0, 6, 10, 12], 0.5),
    mod1: [0, 0, 0, 0.3, 0, 0, 0.5, 0, 0.65, 0, 0.75, 0, 0.85, 0, 0.4, 0],
    mod2: [0, 0, 0, 0.2, 0, 0, 0.35, 0, 0.45, 0, 0.55, 0, 0, 0, 0.3, 0],
  },
  {
    id: 'trap-memphis-drip',
    name: 'Trap — Memphis Drip',
    category: 'trap',
    description: 'Phonk-style drip roll tightening into bar end',
    rateIdx: 1,
    gate: 0.54,
    swing: 0.21,
    steps: TRAP_MEMPHIS_DRIP,
    vel: velAccent([0, 8, 12], 0.55),
    mod1: [0, 0, 0.2, 0, 0, 0.45, 0, 0, 0.55, 0, 0.65, 0, 0.75, 0.85, 0.95, 1],
    mod2: [0, 0, 0, 0, 0, 0.3, 0, 0, 0, 0.4, 0, 0, 0.5, 0.6, 0.7, 0.8],
  },
  {
    id: 'trap-atl-glide',
    name: 'Trap — ATL Glide',
    category: 'trap',
    description: 'ATL roll variant with octave glide at bar peak',
    rateIdx: 1,
    gate: 0.6,
    swing: 0.18,
    steps: TRAP_ATL_GLIDE,
    vel: velAccent([0, 5, 9, 15], 0.5),
    mod1: [0, 0, 0, 0.2, 0, 0.5, 0, 0.65, 0, 0, 0.75, 0, 0.85, 0, 0, 1],
    mod2: [0, 0, 0, 0, 0, 0.3, 0, 0.4, 0, 0, 0.5, 0, 0.6, 0, 0, 0.7],
  },
  {
    id: 'hiphop-boom-bap',
    name: 'Hip Hop — Boom Bap',
    category: 'hiphop',
    description: 'Classic 1 & 3 pocket with ghost notes',
    rateIdx: 2,
    gate: 0.78,
    swing: 0.28,
    steps: HIPHOP_BOOM_BAP,
    vel: velAccent([0, 8], 0.42),
  },
  {
    id: 'hiphop-gfunk',
    name: 'Hip Hop — G-Funk',
    category: 'hiphop',
    description: 'Syncopated West Coast bounce',
    rateIdx: 1,
    gate: 0.68,
    swing: 0.24,
    steps: HIPHOP_GFUNK,
    vel: velAccent([0, 7, 12], 0.48),
    mod1: [0.5, 0, 0, 0.35, 0, 0, 0, 0.6, 0, 0, 0, 0, 0.7, 0, 0, 0],
  },
  {
    id: 'hiphop-drill',
    name: 'Hip Hop — Drill',
    category: 'hiphop',
    description: 'Half-time drill slide pattern',
    rateIdx: 2,
    gate: 0.58,
    swing: 0.08,
    steps: HIPHOP_DRILL,
    vel: velAccent([0, 4, 8, 12], 0.72),
    mod2: [0, 0, 0, 0, 0.65, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0],
  },
  {
    id: 'techno-berlin-16',
    name: 'Techno — Berlin 16ths',
    category: 'techno',
    description: 'Driving 16th-note bass sequence',
    rateIdx: 1,
    gate: 0.52,
    swing: 0.02,
    steps: TECHNO_BERLIN_16,
    mod1: modSweep(),
    vel: velAccent([0, 8], 0.7),
  },
  {
    id: 'techno-rumble',
    name: 'Techno — Rumble',
    category: 'techno',
    description: '1/8 pulse with fifth accents',
    rateIdx: 2,
    gate: 0.65,
    swing: 0.04,
    steps: TECHNO_RUMBLE,
    mod1: [0, 0, 0, 0, 0.4, 0, 0, 0, 0.55, 0, 0, 0, 0.7, 0, 0, 0],
    mod2: [0, 0, 0.25, 0, 0, 0, 0.4, 0, 0, 0, 0.55, 0, 0, 0, 0.7, 0],
  },
  {
    id: 'techno-acid',
    name: 'Techno — Acid Line',
    category: 'techno',
    description: 'Alternating 16th acid squelch',
    rateIdx: 1,
    gate: 0.48,
    swing: 0.06,
    steps: TECHNO_ACID,
    mod1: modSweep(),
    mod2: Array.from({ length: S16 }, (_, i) => (i % 2 === 0 ? 0.35 : 0.75)),
    vel: velAccent([0, 4, 8, 12], 0.62),
  },
  {
    id: 'electro-computer-age',
    name: 'Electro — Computer Age',
    category: 'electro',
    description: 'Horror-movie keys — 8 bars: 2 center, 2 down, repeat',
    ...AGE_OCT_8,
    steps: ELECTRO_COMPUTER_AGE,
    mod1: modAgeHorror(),
    mod2: modAgeHorrorPulse(),
    vel: velAgeHorror(),
  },
  {
    id: 'electro-age-sync',
    name: 'Electro — Age Syncop',
    category: 'electro',
    description: 'Dark syncopated pocket — dread lead, octave yo-yo',
    ...AGE_OCT_8,
    steps: ELECTRO_AGE_SYNCOP,
    mod1: modAgeHorror(),
    mod2: Array.from({ length: S16 }, (_, i) => (i % 2 === 1 ? 0.52 : 0.14)),
    vel: velAgeHorror(),
  },
  {
    id: 'electro-age-offbeat',
    name: 'Electro — Age Offbeat',
    category: 'electro',
    description: 'Haunted offbeat cycle — mysterious minor keys',
    ...AGE_OCT_8,
    steps: ELECTRO_AGE_OFFBEAT,
    mod1: modAgeHorrorPulse(),
    mod2: modAgeHorror(),
    vel: velAccent([1, 5, 9, 13], 0.44),
  },
  {
    id: 'electro-age-stutter',
    name: 'Electro — Age Stutter',
    category: 'electro',
    description: 'Evil stutter pairs — dark bandpass, same 8-bar drop',
    ...AGE_OCT_8,
    steps: ELECTRO_AGE_STUTTER,
    mod1: modAgeHorror(),
    mod2: Array.from({ length: S16 }, (_, i) => (i % 3 === 0 ? 0.55 : 0.1)),
    vel: velAccent([0, 3, 7, 11, 15], 0.45),
  },
  {
    id: 'electro-age-pulse',
    name: 'Electro — Age Pulse',
    category: 'electro',
    description: 'Shock-pulse syncopation — cinematic horror keys',
    ...AGE_OCT_8,
    steps: ELECTRO_AGE_PULSE,
    mod1: Array.from({ length: S16 }, (_, i) => (i % 4 === 3 ? 0.06 : 0.22 + (i % 4) * 0.08)),
    mod2: modAgeHorrorPulse(),
    vel: velAccent([0, 4, 8, 12], 0.5),
  },
  {
    id: 'electro-age-machine',
    name: 'Electro — Age Machine',
    category: 'electro',
    description: 'Phantom machine stab — evil root/fifth, octave cycle',
    ...AGE_OCT_8,
    steps: ELECTRO_AGE_MACHINE,
    mod1: modAgeHorror(),
    mod2: Array.from({ length: S16 }, (_, i) => (i % 2 === 0 ? 0.38 : 0.62)),
    vel: velAccent([0, 2, 4, 8, 10, 12, 15], 0.42),
  },
  {
    id: 'horror-michael',
    name: 'Horror — Michael',
    category: 'horror',
    description: 'Halloween — minor triad crawl, pluck slide (in key)',
    ...HORROR_SLASH_8_LIFT,
    steps: HORROR_MICHAEL,
    mod1: modAgeHorror(),
    mod2: modAgeHorrorPulse(),
    vel: velAgeHorror(),
  },
  {
    id: 'horror-camp',
    name: 'Horror — Camp 13th',
    category: 'horror',
    description: 'Friday 13th — root–fifth pulse on minor chord tones',
    ...HORROR_SLASH_8,
    steps: HORROR_CAMP,
    mod1: modAgeHorrorPulse(),
    mod2: modAgeHorror(),
    vel: velAccent([0, 2, 5, 8, 12, 15], 0.44),
  },
  {
    id: 'horror-creep',
    name: 'Horror — Creep',
    category: 'horror',
    description: 'Jason crawl — minor scale steps through chord tones',
    ...HORROR_SLASH_8_CENTER,
    steps: HORROR_CREEP,
    mod1: modAgeHorror(),
    mod2: Array.from({ length: S16 }, (_, i) => (i % 3 === 1 ? 0.5 : 0.12)),
    vel: velAccent([0, 1, 3, 6, 9, 12, 15], 0.42),
  },
  {
    id: 'horror-rush',
    name: 'Horror — Rush',
    category: 'horror',
    description: 'Double-time 1/32 creep — faster slasher chord chase',
    ...HORROR_SLASH_FAST,
    steps: HORROR_CREEP,
    mod1: modAgeHorror(),
    mod2: Array.from({ length: S16 }, (_, i) => (i % 2 === 0 ? 0.48 : 0.1)),
    vel: velAccent([0, 2, 4, 8, 10, 12, 14], 0.44),
  },
  {
    id: 'horror-stab',
    name: 'Horror — Stab',
    category: 'horror',
    description: 'Stacked minor triad stabs — syncopated, in key',
    ...HORROR_SLASH_8,
    order: 'OUT-IN',
    steps: HORROR_STAB,
    mod1: Array.from({ length: S16 }, (_, i) => (i % 4 === 1 ? 0.55 : 0.15)),
    mod2: modAgeHorrorPulse(),
    vel: velAccent([1, 4, 6, 9, 13, 15], 0.48),
  },
  {
    id: 'electro-push-button',
    name: 'Electro — Push the Button',
    category: 'electro',
    description: 'Sparse half-bar then stacked 16th burst at the button',
    rateIdx: 1,
    gate: 0.4,
    swing: 0.02,
    order: 'UP',
    steps: ELECTRO_PUSH_BUTTON,
    mod1: Array.from({ length: S16 }, (_, i) => (i >= 8 ? (i - 8) / 7 : 0.15)),
    mod2: Array.from({ length: S16 }, (_, i) => (i >= 12 ? 0.5 + (i - 12) * 0.15 : 0.1)),
    vel: Array.from({ length: S16 }, (_, i) => (i < 8 ? 0.55 : 0.45 + ((i - 8) / 7) * 0.55)),
  },
  {
    id: 'electro-303-bounce',
    name: 'Electro — 303 Bounce',
    category: 'electro',
    description: 'Root ↔ fifth 16th alternation — classic Brooklyn electro',
    rateIdx: 1,
    gate: 0.5,
    swing: 0.03,
    order: 'UP/DN',
    steps: ELECTRO_303_BOUNCE,
    mod1: Array.from({ length: S16 }, (_, i) => (i % 2 === 0 ? 0.55 : 0.85)),
    mod2: modSweep(),
    vel: velAccent([0, 4, 8, 12], 0.64),
  },
  {
    id: 'electro-jam-sync',
    name: 'Electro — Jam Sync',
    category: 'electro',
    description: 'Ping-pong sync lead with robotic rests — Jam On It feel',
    rateIdx: 1,
    gate: 0.46,
    swing: 0.04,
    order: 'UP/DN',
    steps: ELECTRO_JAM_SYNC,
    mod1: [0.3, 0.45, 0.6, 0.45, 0.55, 0.7, 0, 0, 0.65, 0.75, 0.85, 0.95, 0.7, 0.8, 0.75, 1],
    vel: velAccent([0, 4, 8, 12, 15], 0.58),
  },
  {
    id: 'electro-clear-rise',
    name: 'Electro — Clear Rise',
    category: 'electro',
    description: 'Cybotron Clear — chromatic 16th climb, rising filter (125 BPM feel)',
    ...CLEAR_ELECTRO_125,
    steps: ELECTRO_CLEAR_RISE,
    mod1: modClearRise(),
    mod2: modAgeHorrorPulse(),
    vel: velAccent([0, 4, 8, 12], 0.5),
  },
  {
    id: 'electro-clear-pre',
    name: 'Electro — Clear Pre',
    category: 'electro',
    description: 'Clear pre-chorus — ascending run with robotic 16th breath',
    ...CLEAR_ELECTRO_125,
    gate: 0.4,
    steps: ELECTRO_CLEAR_PRE,
    mod1: modClearRise(),
    mod2: Array.from({ length: S16 }, (_, i) => (i >= 6 && i <= 8 ? 0.05 : 0.22 + (i % 4) * 0.12)),
    vel: velAccent([0, 4, 9, 12, 15], 0.54),
  },
  {
    id: 'electro-clear-run',
    name: 'Electro — Clear Run',
    category: 'electro',
    description: 'Clear pre-chorus run — up/down chromatic 16ths, machine-tight',
    ...CLEAR_ELECTRO_125,
    gate: 0.42,
    order: 'UP/DN',
    steps: ELECTRO_CLEAR_RUN,
    mod1: modClearRise(),
    mod2: modSweep(),
    vel: velAccent([0, 2, 4, 8, 10, 12, 14], 0.56),
  },
  {
    id: 'electro-kingdom-groove',
    name: 'Electro — Kingdom Groove',
    category: 'electro',
    description: 'Electric Kingdom — syncopated Odyssey bass riff (127 BPM feel)',
    ...KINGDOM_ELECTRO_127,
    steps: ELECTRO_KINGDOM_GROOVE,
    mod1: Array.from({ length: S16 }, (_, i) => 0.35 + (i % 4) * 0.08),
    mod2: modAgeHorrorPulse(),
    vel: velAccent([0, 4, 8, 12], 0.62),
  },
  {
    id: 'electro-kingdom-oct',
    name: 'Electro — Kingdom Oct',
    category: 'electro',
    description: 'Electric Kingdom — root/octave bounce, expressive electro funk',
    ...KINGDOM_ELECTRO_127,
    gate: 0.52,
    order: 'UP/DN',
    steps: ELECTRO_KINGDOM_OCT,
    mod1: modSweep(),
    mod2: Array.from({ length: S16 }, (_, i) => (i % 2 === 0 ? 0.48 : 0.72)),
    vel: velAccent([0, 2, 4, 6, 8, 10, 12, 14], 0.58),
  },
  {
    id: 'electro-kingdom-pulse',
    name: 'Electro — Kingdom Pulse',
    category: 'electro',
    description: 'Electric Kingdom — 808 sub pulse under kick (1 & 7 pocket)',
    ...KINGDOM_ELECTRO_127,
    gate: 0.62,
    swing: 0.02,
    steps: ELECTRO_KINGDOM_PULSE,
    mod1: modAgeHorrorPulse(),
    mod2: Array.from({ length: S16 }, (_, i) => (i === 0 || i === 6 ? 0.85 : 0.28)),
    vel: velAccent([0, 6, 8, 12], 0.68),
  },
  {
    id: 'electro-siberian-funk',
    name: 'Electro — Siberian Funk',
    category: 'electro',
    description: 'Siberian Nights — syncopated poppy Moog funk bass',
    ...SIBERIAN_ELECTRO_130,
    gate: 0.5,
    steps: ELECTRO_SIBERIAN_FUNK,
    mod1: Array.from({ length: S16 }, (_, i) => 0.32 + (i % 4) * 0.1),
    mod2: modSweep(),
    vel: velAccent([0, 3, 7, 10, 12, 15], 0.65),
  },
  {
    id: 'electro-siberian-stomp',
    name: 'Electro — Siberian Stomp',
    category: 'electro',
    description: 'Siberian Nights — stomp pulse + octave pop on the hook',
    ...SIBERIAN_ELECTRO_130,
    gate: 0.54,
    steps: ELECTRO_SIBERIAN_STOMP,
    mod1: modAgeHorrorPulse(),
    mod2: Array.from({ length: S16 }, (_, i) => (i === 8 ? 0.78 : 0.3)),
    vel: velAccent([0, 4, 8, 14], 0.7),
  },
  {
    id: 'electro-siberian-motor',
    name: 'Electro — Siberian Motor',
    category: 'electro',
    description: 'Siberian Nights — pure 16th root drive (ba-ba-ba-ba, one note)',
    ...SIBERIAN_BASS_MACHINE,
    steps: ELECTRO_SIBERIAN_MOTOR,
    mod1: modAgeHorrorPulse(),
    mod2: Array.from({ length: S16 }, () => 0.38),
    vel: velAccent([0, 4, 8, 12], 0.7),
  },
  {
    id: 'electro-siberian-8th',
    name: 'Electro — Siberian 8th',
    category: 'electro',
    description: 'Siberian Nights — 8th-note Moog pump (same root, repeating)',
    ...SIBERIAN_BASS_MACHINE,
    gate: 0.58,
    steps: ELECTRO_SIBERIAN_8TH,
    mod1: Array.from({ length: S16 }, (_, i) => (i % 2 === 0 ? 0.55 : 0.28)),
    vel: velAccent([0, 4, 8, 12], 0.72),
  },
  {
    id: 'electro-siberian-lock',
    name: 'Electro — Siberian Lock',
    category: 'electro',
    description: 'Siberian Nights — locked 16th root loop with one-beat gap',
    ...SIBERIAN_BASS_MACHINE,
    gate: 0.54,
    steps: ELECTRO_SIBERIAN_LOCK,
    mod1: modAgeHorrorPulse(),
    mod2: Array.from({ length: S16 }, (_, i) => (i === 8 ? 0.08 : 0.42)),
    vel: velAccent([0, 4, 8, 12], 0.68),
  },
  {
    id: 'electro-siberian-lead',
    name: 'Electro — Siberian Lead',
    category: 'electro',
    description: 'Siberian Nights — Prophet-style lead arp phrase',
    ...SIBERIAN_LEAD_130,
    steps: ELECTRO_SIBERIAN_LEAD,
    mod1: modClearRise(),
    mod2: modSweep(),
    vel: velAccent([0, 4, 8, 12, 15], 0.58),
  },
  {
    id: 'electro-siberian-ice',
    name: 'Electro — Siberian Ice',
    category: 'electro',
    description: 'Siberian Nights — icy chromatic 16th climb',
    ...SIBERIAN_LEAD_130,
    gate: 0.4,
    steps: ELECTRO_SIBERIAN_ICE,
    mod1: modClearRise(),
    mod2: modAgeHorrorPulse(),
    vel: velAccent([0, 4, 8, 12], 0.54),
  },
  {
    id: 'electro-siberian-hook',
    name: 'Electro — Siberian Hook',
    category: 'electro',
    description: 'Siberian Nights — catchy verse hook arp bounce',
    ...SIBERIAN_LEAD_130,
    gate: 0.44,
    order: 'UP/DN',
    steps: ELECTRO_SIBERIAN_HOOK,
    mod1: modSweep(),
    mod2: Array.from({ length: S16 }, (_, i) => (i % 2 === 0 ? 0.42 : 0.68)),
    vel: velAccent([0, 2, 4, 8, 10, 12, 14], 0.6),
  },
  {
    id: 'electro-bounce-drop',
    name: 'Electro — Bounce Drop',
    category: 'electro',
    description: 'Bouncy pluck — 2 bars straight, 2 bars down an octave',
    barLength: 4,
    barOctShifts: OCT_2BAR_DROP,
    rateIdx: 1,
    gate: 0.34,
    swing: 0.16,
    order: 'UP/DN',
    steps: ELECTRO_BOUNCE_DROP,
    mod1: Array.from({ length: S16 }, (_, i) => (i % 2 === 1 ? 0.72 : 0.28)),
    vel: velAccent([0, 3, 6, 8, 12, 15], 0.52),
  },
  {
    id: 'electro-bounce-lift',
    name: 'Electro — Bounce Lift',
    category: 'electro',
    description: 'Ping-pong pluck — 2 bars center, 2 bars up an octave',
    barLength: 4,
    barOctShifts: OCT_2BAR_LIFT,
    rateIdx: 1,
    gate: 0.36,
    swing: 0.14,
    order: 'UP/DN',
    steps: ELECTRO_BOUNCE_LIFT,
    mod1: Array.from({ length: S16 }, (_, i) => (i % 4 === 1 || i % 4 === 3 ? 0.8 : 0.25)),
    mod2: [0, 0, 0, 0.35, 0, 0, 0, 0.5, 0, 0, 0, 0.65, 0, 0, 0, 0.85],
    vel: velAccent([1, 3, 5, 7, 9, 11, 13, 15], 0.48),
  },
  {
    id: 'electro-bounce-pump',
    name: 'Electro — Bounce Pump',
    category: 'electro',
    description: 'Staccato pluck pump — 2 bars straight, lift bar 3, drop bar 4',
    barLength: 4,
    barOctShifts: OCT_2BAR_PING,
    rateIdx: 1,
    gate: 0.3,
    swing: 0.18,
    order: 'UP',
    steps: ELECTRO_BOUNCE_PUMP,
    mod1: Array.from({ length: S16 }, (_, i) => (i % 2 === 0 ? 0.45 : 0.78)),
    vel: velAccent([0, 2, 4, 8, 10, 12, 14], 0.55),
  },
  {
    id: 'house-offbeat',
    name: 'House — Offbeat',
    category: 'house',
    description: 'Classic offbeat chord stab',
    rateIdx: 2,
    gate: 0.82,
    swing: 0.14,
    steps: HOUSE_OFFBEAT,
    vel: velAccent([2, 6, 10, 14], 0.5),
  },
  {
    id: 'house-disco',
    name: 'House — Disco Floor',
    category: 'house',
    description: 'Four-on-the-floor root pulse',
    rateIdx: 2,
    gate: 0.75,
    swing: 0.12,
    steps: HOUSE_DISCO,
    vel: velAccent([0, 4, 8, 12], 0.55),
    mod1: [0.3, 0, 0, 0, 0.45, 0, 0, 0, 0.6, 0, 0, 0, 0.75, 0, 0, 0],
  },
  {
    id: 'house-deep',
    name: 'House — Deep Chord',
    category: 'house',
    description: 'Deep house chord on 1 & 3',
    rateIdx: 2,
    gate: 0.88,
    swing: 0.16,
    steps: HOUSE_DEEP,
    vel: velAccent([0, 8], 0.6),
    mod1: [0.55, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    id: 'dance-euro-run',
    name: 'Dance — Euro Run',
    category: 'dance',
    description: 'Trance-style ascending 16th run',
    rateIdx: 1,
    gate: 0.55,
    swing: 0.05,
    steps: DANCE_EURO_RUN,
    mod1: modSweep(),
    vel: velAccent([0, 8], 0.68),
  },
  {
    id: 'dance-edm-build',
    name: 'Dance — EDM Build',
    category: 'dance',
    description: 'Build-up fill with widening chord',
    rateIdx: 1,
    gate: 0.5,
    swing: 0.08,
    steps: DANCE_EDM_BUILD,
    mod1: modSweep(),
    mod2: modSweep(),
    vel: Array.from({ length: S16 }, (_, i) => 0.4 + (i / S16) * 0.6),
  },
  {
    id: 'dance-trance-lift',
    name: 'Dance — Trance Lift',
    category: 'dance',
    description: 'Staggered ascent with widening chord stack',
    rateIdx: 1,
    gate: 0.52,
    swing: 0.06,
    steps: DANCE_TRANCE_LIFT,
    mod1: modSweep(),
    mod2: Array.from({ length: S16 }, (_, i) => (i % 4 === 3 ? 0.6 : 0.15)),
    vel: velAccent([0, 4, 8, 12], 0.58),
  },
  {
    id: 'dance-festival-rise',
    name: 'Dance — Festival Rise',
    category: 'dance',
    description: 'Accelerating stack into full-chord climax',
    rateIdx: 1,
    gate: 0.48,
    swing: 0.07,
    steps: DANCE_FESTIVAL_RISE,
    mod1: modSweep(),
    mod2: modSweep(),
    vel: Array.from({ length: S16 }, (_, i) => 0.35 + (i / S16) * 0.65),
  },
  {
    id: 'dance-hyper-glide',
    name: 'Dance — Hyper Glide',
    category: 'dance',
    description: 'Stuttered 16ths with triplet tail fill',
    rateIdx: 1,
    gate: 0.44,
    swing: 0.09,
    steps: DANCE_HYPER_GLIDE,
    mod1: Array.from({ length: S16 }, (_, i) => (i >= 12 ? 0.7 + (i - 12) * 0.1 : i / 14)),
    vel: velAccent([0, 4, 7, 13], 0.62),
  },
  {
    id: 'dance-mainstage',
    name: 'Dance — Mainstage',
    category: 'dance',
    description: 'Anticipation fill before drop downbeat',
    rateIdx: 1,
    gate: 0.56,
    swing: 0.05,
    steps: DANCE_MAINSTAGE,
    mod1: [0.3, 0, 0, 0, 0.45, 0, 0, 0, 0.6, 0, 0.75, 0, 0.9, 0, 1, 0],
    mod2: [0, 0, 0, 0, 0.2, 0, 0, 0, 0.35, 0, 0.5, 0, 0.7, 0, 0.85, 0],
    vel: velAccent([0, 8, 12, 14], 0.55),
  },
  {
    id: 'dance-anthem-run',
    name: 'Dance — Anthem Run',
    category: 'dance',
    description: 'Ascend first half, mirror descent second half',
    rateIdx: 1,
    gate: 0.54,
    swing: 0.04,
    steps: DANCE_ANTHEM_RUN,
    mod1: modSweep(),
    vel: velAccent([0, 7, 8, 15], 0.65),
  },
  {
    id: 'logic-upbeat-pump',
    name: 'Logic — Upbeat Pump',
    category: 'logic',
    description: 'Offbeat syncopation (Logic Arpeggiator factory)',
    rateIdx: 1,
    gate: 0.62,
    swing: 0.14,
    order: 'UP/DN',
    steps: barSteps(
      [1, 0, 2],
      [3, 1, 3],
      [5, 0, 2],
      [7, 1, 3],
      [9, 0, 2],
      [11, 1, 3],
      [13, 0, 2],
      [15, 1, 3],
    ),
    vel: velAccent([1, 3, 5, 7, 9, 11, 13, 15], 0.5),
  },
  {
    id: 'logic-echoed-cycle',
    name: 'Logic — Echoed Cycle',
    category: 'logic',
    description: 'Call-and-response pairs across chord tones',
    rateIdx: 1,
    gate: 0.58,
    swing: 0.08,
    order: 'OUT-IN',
    steps: barSteps(
      [0, 0],
      [2, 2],
      [4, 1],
      [6, 3],
      [8, 0],
      [10, 2],
      [12, 1],
      [14, 3],
    ),
    mod1: [0.2, 0, 0.35, 0, 0.5, 0, 0.65, 0, 0.8, 0, 0.9, 0, 1, 0, 1, 0],
    vel: velAccent([0, 2, 4, 6, 8, 10, 12, 14], 0.55),
  },
  {
    id: 'keys-rhodes-groove',
    name: 'Keys — Rhodes Groove',
    category: 'logic',
    description: 'Syncopated offbeat Rhodes — maj7 chord tones in key',
    ...KEYS_PLUCK_4,
    steps: KEYS_RHODES_GROOVE,
    mod1: modSweep(),
    vel: velAccent([2, 6, 10, 14], 0.62),
  },
  {
    id: 'keys-marimba-glow',
    name: 'Keys — Marimba Glow',
    category: 'logic',
    description: 'Bouncy root–third–fifth marimba pluck',
    ...KEYS_PLUCK_4,
    steps: KEYS_MARIMBA_GLOW,
    mod1: Array.from({ length: S16 }, (_, i) => 0.25 + (i % 4) * 0.12),
    vel: velAccent([0, 2, 4, 8, 10, 12, 14], 0.58),
  },
  {
    id: 'keys-harp-sparkle',
    name: 'Keys — Harp Sparkle',
    category: 'logic',
    description: 'Rolling harp arpeggio — ascend and resolve in key',
    ...KEYS_PLUCK_4,
    gate: 0.52,
    steps: KEYS_HARP_SPARKLE,
    mod1: modClearRise(),
    vel: velAccent([0, 2, 4, 6, 8, 10, 12, 14], 0.55),
  },
  {
    id: 'keys-lounge-organ',
    name: 'Keys — Lounge Organ',
    category: 'logic',
    description: 'Slow organ cycle — whole-note chord tones',
    ...KEYS_PLUCK_4,
    gate: 0.72,
    swing: 0.04,
    order: 'OUT-IN',
    steps: KEYS_LOUNGE_ORGAN,
    mod1: [0.2, 0, 0.35, 0, 0.5, 0, 0.65, 0, 0.8, 0, 0.9, 0, 1, 0, 1, 0],
    vel: velAccent([0, 4, 8, 12], 0.6),
  },
  {
    id: 'keys-ballad-arp',
    name: 'Keys — Ballad Arp',
    category: 'logic',
    description: 'Gentle ballad spread — root, third, fifth in key',
    ...KEYS_PLUCK_4,
    gate: 0.65,
    swing: 0.06,
    steps: KEYS_BALLAD_ARP,
    mod1: modSweep(),
    vel: velAccent([0, 3, 6, 9, 12, 15], 0.58),
  },
] as const;

export const GENO_ARP_STYLE_CATEGORIES: readonly { id: GenoArpStyleCategory; label: string }[] = [
  { id: 'trap', label: 'Trap' },
  { id: 'hiphop', label: 'Hip Hop' },
  { id: 'techno', label: 'Techno' },
  { id: 'electro', label: 'Electro / 80s' },
  { id: 'horror', label: 'Horror / Slasher' },
  { id: 'house', label: 'House' },
  { id: 'dance', label: 'Dance' },
  { id: 'logic', label: 'Logic' },
];

function emptyGrid(): boolean[][] {
  return Array.from({ length: GENO_ARP_ROWS }, () => Array(GENO_ARP_MAX_COLS).fill(false));
}

export function buildGenoArpGridFromBarSteps(
  steps: GenoArpBarStepPattern,
  barLength: number,
): boolean[][] {
  const cols = genoArpGridCols(barLength);
  const g = emptyGrid();
  for (let col = 0; col < cols; col += 1) {
    const stepInBar = col % S16;
    const rows = steps[stepInBar] ?? [];
    for (const row of rows) {
      if (row >= 0 && row < GENO_ARP_ROWS) g[row]![col] = true;
    }
  }
  return g;
}

export function tileGenoArpLanePattern(
  pattern: readonly number[] | undefined,
  barLength: number,
  defaultLevel = 0,
): number[] {
  const cols = genoArpGridCols(barLength);
  const next = emptyGenoArpLaneLevels(defaultLevel);
  if (!pattern?.length) return next;
  for (let col = 0; col < cols; col += 1) {
    next[col] = pattern[col % S16] ?? defaultLevel;
  }
  return next;
}

export function tileGenoArpBarOctShifts(
  pattern: readonly GenoArpBarOctShift[] | undefined,
  barLength: number,
): GenoArpBarOctShift[] {
  const bars = genoArpSanitizeBarLength(barLength);
  const next = emptyGenoArpBarOctShifts();
  if (!pattern?.length) return next;
  for (let b = 0; b < Math.min(bars, GENO_ARP_MAX_BARS); b += 1) {
    next[b] = pattern[b % pattern.length] ?? 0;
  }
  return next;
}

export function findGenoArpStylePreset(id: string): GenoArpStylePreset | undefined {
  const hit = GENO_ARP_STYLE_PRESETS.find((p) => p.id === id);
  if (!hit) return undefined;
  return {
    ...hit,
    soundPresetId: hit.soundPresetId || GENO_ARP_STYLE_SOUND_BY_ID[hit.id] || 'ultra-warm-lead',
  };
}

export type GenoArpStyleApplyResult = {
  grid: boolean[][];
  rateIdx: number;
  gate: number;
  swing: number;
  mod1Levels: number[];
  mod2Levels: number[];
  velLevels: number[];
  barLength?: GenoArpBarLength;
  barOctShifts?: GenoArpBarOctShift[];
  octShift?: GenoArpGlobalOctShift;
};

export function applyGenoArpStylePreset(
  preset: GenoArpStylePreset,
  barLength: GenoArpBarLength | number,
): GenoArpStyleApplyResult {
  const bars = genoArpSanitizeBarLength(preset.barLength ?? barLength);
  return {
    grid: buildGenoArpGridFromBarSteps(preset.steps, bars),
    rateIdx: preset.rateIdx,
    gate: preset.gate,
    swing: preset.swing,
    mod1Levels: tileGenoArpLanePattern(preset.mod1, bars, 0),
    mod2Levels: tileGenoArpLanePattern(preset.mod2, bars, 0),
    velLevels: tileGenoArpLanePattern(preset.vel, bars, 0.82),
    barLength: preset.barLength,
    barOctShifts: preset.barOctShifts?.length
      ? tileGenoArpBarOctShifts(preset.barOctShifts, bars)
      : undefined,
    octShift: preset.octShift,
  };
}
