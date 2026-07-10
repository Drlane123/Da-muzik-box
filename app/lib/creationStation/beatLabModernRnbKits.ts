/**
 * Beat Lab Modern R&B Series — dry kick / snappy snare / clap stacks.
 * Paired with {@link BEAT_LAB_MODERN_RNB_PATTERNS}. No long 808 subs.
 * Fictional crew names only — no artist affiliation.
 */

import type { BeatLabProducerKitMeta, BeatLabProducerPadDef } from '@/app/lib/creationStation/beatLabProducerKits';

const SOFT_KICK = { triggerSnap: 0.32, fineSemi: -1, lpHz: 5200 } as const;
const GHOST_SNARE = { triggerSnap: 0.22, hpHz: 200, maxPlaySec: 0.18 } as const;
/** Poppin trap snap snare — trapaholic-snare, hard attack, no loose tail. */
const RNB_TIGHT_SNARE = {
  triggerSnap: 0.54,
  fineSemi: 0,
  hpHz: 280,
  lpHz: 14200,
  trim0: 0,
  trim1: 0.9,
  maxPlaySec: 0.22,
} as const;
/** Backbeat layer — same snap, shorter tail. */
const RNB_SNAP_LAYER = {
  triggerSnap: 0.5,
  fineSemi: 0,
  hpHz: 300,
  lpHz: 13800,
  trim0: 0,
  trim1: 0.72,
  maxPlaySec: 0.18,
} as const;
const RNB_SNARE_LAYER = { triggerSnap: 0.4, maxPlaySec: 0.24, hpHz: 200 } as const;
/** R&B dry pocket — heavy solid low kick, short tail (no sub bloom). */
const RNB_DRY_KICK = {
  triggerSnap: 0.44,
  fineSemi: 0,
  hpHz: 72,
  lpHz: 6800,
  trim0: 0,
  trim1: 0.92,
  maxPlaySec: 0.42,
} as const;
const RNB_RACK_KICK = {
  triggerSnap: 0.46,
  fineSemi: 0,
  hpHz: 90,
  lpHz: 7200,
  trim0: 0,
  trim1: 0.88,
  maxPlaySec: 0.38,
} as const;
export type BeatLabModernRnbKitId =
  | 'rnbModern808NightGrind'
  | 'rnbModern808NightGrindV2'
  | 'rnbModern808AfterDark'
  | 'rnbModern808VelvetSub'
  | 'rnbModern808HeavyPulse'
  | 'rnbClassicSilkRoom'
  | 'rnbClassicVelvetPocket'
  | 'rnbHybrid808Bloom'
  | 'rnbHybridSlowBurn';

/** Night Grind — dry fat kick, punch snare, stacked clap. No sub. */
const KIT_MODERN_808_NIGHT_GRIND: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/heavy-kick-lv1.wav', label: 'Fat kick', sampler: RNB_DRY_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Punch snare', sampler: RNB_TIGHT_SNARE },
  { pad: 2, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Snap snare', sampler: RNB_SNAP_LAYER },
  { pad: 3, localFile: 'trap-kit/hihat/trapaholic-hihat-3.wav', label: 'CH sparse' },
  { pad: 4, localFile: 'trap-kit/open-hat/ddw2-open-hat-6-1.wav', label: 'OH breathe' },
  { pad: 5, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: { triggerSnap: 0.24 } },
  { pad: 6, localFile: 'trap-kit/kick/rack-kick.wav', label: 'Kick punch', sampler: { triggerSnap: 0.38, fineSemi: 0, maxPlaySec: 0.28 } },
  { pad: 7, localFile: 'trap-kit/snare/snare-6.wav', label: 'Rim ghost', sampler: GHOST_SNARE },
  { pad: 8, localFile: 'trap-kit/fx/pink-noise.wav', label: 'Air bed' },
  { pad: 9, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNAP_LAYER },
  { pad: 10, localFile: 'trap-kit/cymbal/ddw2-crash-1.wav', label: 'Crash soft' },
  { pad: 11, localFile: 'trap-kit/hihat/ddw2-hat-1.wav', label: 'Hat swing' },
  { pad: 12, localFile: 'trap-kit/perc2/bongo4-1.wav', label: 'Shaker' },
  { pad: 13, localFile: 'trap-kit/perc2/triangle-2-1.wav', label: 'Bell tint' },
  { pad: 14, localFile: 'trap-kit/snare/trapaholic-snare-13-1.wav', label: 'Snap ghost', sampler: { triggerSnap: 0.2 } },
  { pad: 15, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNAP_LAYER },
];

/** Night Grind II — clean dry pocket: rack kick, fat snare, clap stack. No sub. */
const KIT_MODERN_808_NIGHT_GRIND_V2: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/rack-kick.wav', label: 'Punch kick', sampler: RNB_RACK_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Fat snare', sampler: RNB_TIGHT_SNARE },
  { pad: 2, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Snap snare', sampler: RNB_SNAP_LAYER },
  { pad: 3, localFile: 'trap-kit/hihat/bz-redd-hihat.wav', label: 'CH silk' },
  { pad: 4, localFile: 'trap-kit/open-hat/bz-redd-op-hat.wav', label: 'OH breathe' },
  { pad: 5, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNARE_LAYER },
  { pad: 6, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim tick', sampler: { triggerSnap: 0.22 } },
  { pad: 7, localFile: 'trap-kit/snare/snare-54.wav', label: 'Rim ghost', sampler: { triggerSnap: 0.18 } },
  { pad: 8, localFile: 'trap-kit/fx/pink-noise.wav', label: 'Air bed' },
  { pad: 9, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNAP_LAYER },
  { pad: 10, localFile: 'trap-kit/cymbal/zay-cym-9.wav', label: 'Crash soft' },
  { pad: 11, localFile: 'trap-kit/hihat/trapaholic-hihat-7.wav', label: 'Hat swing' },
  { pad: 12, localFile: 'trap-kit/perc2/bongo4-1.wav', label: 'Shaker' },
  { pad: 13, localFile: 'trap-kit/perc2/triangle-2-1.wav', label: 'Bell tint' },
  { pad: 14, localFile: 'trap-kit/snare/trapaholic-snare-13-1.wav', label: 'Snap ghost', sampler: { triggerSnap: 0.19 } },
  { pad: 15, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNAP_LAYER },
];

/** After Dark — moody dry pocket, fat kick, snappy snare/clap. No sub. */
const KIT_MODERN_808_AFTER_DARK: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/heavy-kick-lv1.wav', label: 'Fat kick', sampler: RNB_DRY_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Snap snare', sampler: RNB_TIGHT_SNARE },
  { pad: 2, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Snap snare', sampler: RNB_SNAP_LAYER },
  { pad: 3, localFile: 'trap-kit/hihat/deedotluger-hat-3.wav', label: 'CH low' },
  { pad: 4, localFile: 'trap-kit/open-hat/deedotluger-open-hat-3.wav', label: 'OH dark' },
  { pad: 5, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNARE_LAYER },
  { pad: 6, localFile: 'trap-kit/kick/rack-kick.wav', label: 'Kick punch', sampler: { triggerSnap: 0.38, fineSemi: 0, maxPlaySec: 0.28 } },
  { pad: 7, localFile: 'trap-kit/snare/new-snare.wav', label: 'Rim', sampler: GHOST_SNARE },
  { pad: 8, localFile: 'trap-kit/fx/pink-noise.wav', label: 'Air bed' },
  { pad: 9, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNAP_LAYER },
  { pad: 10, localFile: 'trap-kit/cymbal/orch-crash-1.wav', label: 'Crash' },
  { pad: 11, localFile: 'trap-kit/cymbal/zay-cym-2.wav', label: 'Cym ride' },
  { pad: 12, localFile: 'trap-kit/hihat/shawty-redd-hat-1.wav', label: 'Hat shake' },
  { pad: 13, localFile: 'trap-kit/perc2/perc---pink.wav', label: 'Perc' },
  { pad: 14, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNARE_LAYER },
  { pad: 15, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNAP_LAYER },
];

/** Velvet dry — soft pocket kick, ghost snares, silk hats. No sub. */
const KIT_MODERN_808_VELVET_SUB: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/kick-atl.wav', label: 'Dry kick', sampler: { ...RNB_DRY_KICK, triggerSnap: 0.4, fineSemi: -1 } },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Fat snare', sampler: RNB_TIGHT_SNARE },
  { pad: 2, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Snap snare', sampler: RNB_SNAP_LAYER },
  { pad: 3, localFile: 'trap-kit/hihat/bz-redd-hihat.wav', label: 'CH silk' },
  { pad: 4, localFile: 'trap-kit/open-hat/bz-redd-op-hat.wav', label: 'OH air' },
  { pad: 5, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: { triggerSnap: 0.34, maxPlaySec: 0.28 } },
  { pad: 6, localFile: 'trap-kit/kick/rack-kick.wav', label: 'Kick layer', sampler: { triggerSnap: 0.36, fineSemi: 0, maxPlaySec: 0.3 } },
  { pad: 7, localFile: 'trap-kit/snare/snare-54.wav', label: 'Rim tick', sampler: { triggerSnap: 0.18 } },
  { pad: 8, localFile: 'trap-kit/perc2/percs-6.wav', label: 'Shaker' },
  { pad: 9, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNAP_LAYER },
  { pad: 10, localFile: 'trap-kit/cymbal/zay-cym-9.wav', label: 'Crash' },
  { pad: 11, localFile: 'trap-kit/hihat/trapaholic-hihat-7.wav', label: 'Hat alt' },
  { pad: 12, localFile: 'trap-kit/perc2/bongo4-1.wav', label: 'Perc' },
  { pad: 13, localFile: 'trap-kit/fx/zaytoven-bell.wav', label: 'Bell FX' },
  { pad: 14, localFile: 'trap-kit/snare/trapaholic-snare-13-1.wav', label: 'Snap ghost', sampler: { triggerSnap: 0.19 } },
  { pad: 15, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNAP_LAYER },
];

/** Heavy pulse — club R&B punch kick + stacked snare/clap. No sub. */
const KIT_MODERN_808_HEAVY_PULSE: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/heavy-kick-lv1.wav', label: 'Heavy kick', sampler: RNB_DRY_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Hard snare', sampler: RNB_TIGHT_SNARE },
  { pad: 2, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Snap snare', sampler: RNB_SNAP_LAYER },
  { pad: 3, localFile: 'trap-kit/hihat/trapaholic-hihat-23.wav', label: 'CH tight' },
  { pad: 4, localFile: 'trap-kit/open-hat/ddw2-open-hat-1-1.wav', label: 'OH lift' },
  { pad: 5, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNARE_LAYER },
  { pad: 6, localFile: 'trap-kit/kick/rack-kick.wav', label: 'Kick punch', sampler: { triggerSnap: 0.42, fineSemi: 0, maxPlaySec: 0.3 } },
  { pad: 7, localFile: 'trap-kit/snare/half-treesound-trunk-snare.wav', label: 'Rim', sampler: { triggerSnap: 0.24 } },
  { pad: 8, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNAP_LAYER },
  { pad: 9, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn tight', sampler: { triggerSnap: 0.24 } },
  { pad: 10, localFile: 'trap-kit/cymbal/deedotluger-crash-3-1.wav', label: 'Crash' },
  { pad: 11, localFile: 'trap-kit/cymbal/crash_lex-1.wav', label: 'Cym' },
  { pad: 12, localFile: 'trap-kit/hihat/trapaholic-hihat-20.wav', label: 'Hat roll' },
  { pad: 13, localFile: 'trap-kit/perc/hit_ctim_c4-1.wav', label: 'Accent' },
  { pad: 14, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Snap', sampler: { triggerSnap: 0.22 } },
  { pad: 15, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNAP_LAYER },
];

/** Classic silk — LM hats + trap dry kick/snare/clap stack. No sub. */
const KIT_CLASSIC_SILK_ROOM: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/heavy-kick-lv1.wav', label: 'Fat kick', sampler: RNB_DRY_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Snap snare', sampler: RNB_TIGHT_SNARE },
  { pad: 2, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Snap snare', sampler: RNB_SNAP_LAYER },
  { pad: 3, relUrl: 'LM-2/hhclosed.m4a', label: 'CH swing' },
  { pad: 4, relUrl: 'LM-2/hhopen.m4a', label: 'OH breathe' },
  { pad: 5, relUrl: 'LM-2/tom-h.m4a', label: 'Tom H' },
  { pad: 6, relUrl: 'LM-2/tom-m.m4a', label: 'Tom M' },
  { pad: 7, relUrl: 'LM-2/tambourine.m4a', label: 'Shaker', sampler: { triggerSnap: 0.16 } },
  { pad: 8, relUrl: 'LM-2/cabasa.m4a', label: 'Cabasa' },
  { pad: 9, relUrl: 'LM-2/cowbell.m4a', label: 'Cow' },
  { pad: 10, relUrl: 'LM-2/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: 'LM-2/ride.m4a', label: 'Ride' },
  { pad: 12, relUrl: 'LM-2/tambourine.m4a', label: 'Tamb lite' },
  { pad: 13, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim' },
  { pad: 14, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: { triggerSnap: 0.34, maxPlaySec: 0.28 } },
  { pad: 15, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNAP_LAYER },
];

/** Velvet pocket — airy hats, backbeat snare, dry clap stack. No sub. */
const KIT_CLASSIC_VELVET_POCKET: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/rack-kick.wav', label: 'Dry kick', sampler: RNB_RACK_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Fat snare', sampler: RNB_TIGHT_SNARE },
  { pad: 2, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Snap snare', sampler: RNB_SNAP_LAYER },
  { pad: 3, relUrl: '808-mini/hhclosed-1.m4a', label: 'CH silk' },
  { pad: 4, relUrl: '808-mini/hhopen-1.m4a', label: 'OH air' },
  { pad: 5, relUrl: 'LM-2/tom-h.m4a', label: 'Tom H' },
  { pad: 6, relUrl: 'LM-2/tom-l.m4a', label: 'Tom L' },
  { pad: 7, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim', sampler: { triggerSnap: 0.32 } },
  { pad: 8, relUrl: 'LM-2/cabasa.m4a', label: 'Cabasa' },
  { pad: 9, relUrl: 'LM-2/tambourine.m4a', label: 'Tamb shake', sampler: { triggerSnap: 0.15 } },
  { pad: 10, relUrl: 'LM-2/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: 'LM-2/ride.m4a', label: 'Ride wash' },
  { pad: 12, relUrl: 'TR-808/conga-mid/mc00.m4a', label: 'Conga' },
  { pad: 13, relUrl: 'LM-2/cowbell.m4a', label: 'Cow' },
  { pad: 14, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: { triggerSnap: 0.32, maxPlaySec: 0.26 } },
  { pad: 15, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNAP_LAYER },
];

/** Hybrid bloom — dry trap kick under LM silk hats. No sub. */
const KIT_HYBRID_808_BLOOM: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/heavy-kick-lv1.wav', label: 'Fat kick', sampler: RNB_DRY_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Snap snare', sampler: RNB_TIGHT_SNARE },
  { pad: 2, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Snap snare', sampler: RNB_SNAP_LAYER },
  { pad: 3, relUrl: 'LM-2/hhclosed.m4a', label: 'CH pocket' },
  { pad: 4, relUrl: 'LM-2/hhopen.m4a', label: 'OH lift' },
  { pad: 5, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: { triggerSnap: 0.24 } },
  { pad: 6, localFile: 'trap-kit/kick/rack-kick.wav', label: 'Kick punch', sampler: { triggerSnap: 0.38, fineSemi: 0, maxPlaySec: 0.28 } },
  { pad: 7, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim' },
  { pad: 8, relUrl: 'LM-2/cabasa.m4a', label: 'Cabasa' },
  { pad: 9, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNAP_LAYER },
  { pad: 10, relUrl: 'LM-2/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: 'LM-2/ride.m4a', label: 'Ride' },
  { pad: 12, localFile: 'trap-kit/hihat/bz-redd-hihat.wav', label: 'Hat layer' },
  { pad: 13, relUrl: 'LM-2/cowbell.m4a', label: 'Cow' },
  { pad: 14, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: { triggerSnap: 0.32, maxPlaySec: 0.26 } },
  { pad: 15, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNAP_LAYER },
];

/** Slow burn hybrid — CR silk + dry trap kick/snare/clap. No sub. */
const KIT_HYBRID_SLOW_BURN: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/heavy-kick-lv1.wav', label: 'Fat kick', sampler: RNB_DRY_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Snap snare', sampler: RNB_TIGHT_SNARE },
  { pad: 2, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Snap snare', sampler: RNB_SNAP_LAYER },
  { pad: 3, relUrl: 'Roland-CR-8000/hihat-closed.m4a', label: 'CH tick' },
  { pad: 4, relUrl: 'LM-2/hhopen.m4a', label: 'OH lift' },
  { pad: 5, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNARE_LAYER },
  { pad: 6, relUrl: 'Roland-CR-8000/kick.m4a', label: 'Box layer', sampler: SOFT_KICK },
  { pad: 7, relUrl: 'LM-2/tambourine.m4a', label: 'Shaker ring', sampler: { triggerSnap: 0.16 } },
  { pad: 8, relUrl: 'LM-2/cabasa.m4a', label: 'Cabasa' },
  { pad: 9, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNAP_LAYER },
  { pad: 10, relUrl: 'LM-2/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: 'LM-2/ride.m4a', label: 'Ride' },
  { pad: 12, relUrl: 'TR-808/conga-low/lc00.m4a', label: 'Conga low' },
  { pad: 13, relUrl: 'LM-2/cowbell.m4a', label: 'Cow' },
  { pad: 14, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: { triggerSnap: 0.32, maxPlaySec: 0.26 } },
  { pad: 15, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: RNB_SNAP_LAYER },
];

export const BEAT_LAB_MODERN_RNB_KIT_METAS: readonly BeatLabProducerKitMeta[] = [
  {
    id: 'rnbModern808NightGrind',
    title: 'R&B · Night Grind 808',
    tribute: 'Slow dry R&B pocket — fat kick, tight trap snare, electronic clap. No sub.',
    pads: KIT_MODERN_808_NIGHT_GRIND,
  },
  {
    id: 'rnbModern808NightGrindV2',
    title: 'R&B · Night Grind II',
    tribute: 'Tight dry pocket — rack kick, snapping trap snare, trap clap. No sub.',
    pads: KIT_MODERN_808_NIGHT_GRIND_V2,
  },
  {
    id: 'rnbModern808AfterDark',
    title: 'R&B · After Dark 808',
    tribute: 'Moody dry pocket — fat kick, snappy snare/clap, sparse hats. No sub.',
    pads: KIT_MODERN_808_AFTER_DARK,
  },
  {
    id: 'rnbModern808VelvetSub',
    title: 'R&B · Velvet Sub',
    tribute: 'Velvet dry jam — soft pocket kick, fat snare, silk hats. No sub.',
    pads: KIT_MODERN_808_VELVET_SUB,
  },
  {
    id: 'rnbModern808HeavyPulse',
    title: 'R&B · Heavy Pulse 808',
    tribute: 'Club R&B punch — heavy dry kick, stacked snare/clap. No sub.',
    pads: KIT_MODERN_808_HEAVY_PULSE,
  },
  {
    id: 'rnbClassicSilkRoom',
    title: 'R&B · Silk Room',
    tribute: 'Classic 90s silk — dry fat kick, snap snare, LM hats. No sub.',
    pads: KIT_CLASSIC_SILK_ROOM,
  },
  {
    id: 'rnbClassicVelvetPocket',
    title: 'R&B · Velvet Pocket',
    tribute: 'Airy backbeat — rack kick, fat snare, clap stack. No sub.',
    pads: KIT_CLASSIC_VELVET_POCKET,
  },
  {
    id: 'rnbHybrid808Bloom',
    title: 'R&B · 808 Bloom',
    tribute: 'Hybrid pocket — dry trap kick, snap snare, LM silk hats. No sub.',
    pads: KIT_HYBRID_808_BLOOM,
  },
  {
    id: 'rnbHybridSlowBurn',
    title: 'R&B · Slow Burn',
    tribute: 'CR silk + dry trap drums — fat kick, snappy snare/clap. No sub.',
    pads: KIT_HYBRID_SLOW_BURN,
  },
];
