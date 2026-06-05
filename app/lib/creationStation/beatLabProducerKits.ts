/**
 * Beat Lab — Da Music Box crew drum kits (public-domain smpldsnds one-shots).
 * Fictional kit / crew names only — not affiliated with any real artist.
 * https://github.com/smpldsnds/drum-machines
 */

import {
  defaultPadSamplerPlaybackOpts,
  type PadSamplerPlaybackOpts,
} from '@/app/lib/padSampleStorage';

export type BeatLabProducerKitId =
  | 'trapDarkVault'
  | 'trapSlabAtl'
  | 'trapTrunk808'
  | 'brassTrap'
  | 'long808Hits'
  | 'trapClapStack'
  | 'trapAnalogRoom'
  | 'clubPocket'
  | 'smoothRnb'
  | 'rnbVelvetBloom'
  | 'rnbNeoStack'
  | 'houseDrive'
  | 'nightSub'
  | 'vault808'
  | 'trunkRattle'
  | 'slab808'
  | 'ironSlide'
  | 'bell808'
  | 'mudFloor';

const SMPLDSNDS_BASE = 'https://smpldsnds.github.io/drum-machines';
const BUNDLED_SAMPLE_BASE = '/samples/sound-families/';

export const BEAT_LAB_PRODUCER_KIT_ATTRIBUTION =
  'Drum one-shots: smpldsnds/drum-machines (public domain).';

export interface BeatLabProducerPadDef {
  /** Beat Lab pad 0–15 (Kick … SUB BASS). */
  pad: number;
  /** smpldsnds CDN path (when `localFile` is omitted). */
  relUrl?: string;
  /** Bundled WAV under `public/samples/sound-families/` — offline trap kits. */
  localFile?: string;
  /** Shown in sampler + sequencer lane. */
  label: string;
  /** Optional punch / tune shaping when the kit loads. */
  sampler?: Partial<PadSamplerPlaybackOpts>;
}

export interface BeatLabProducerKitMeta {
  id: BeatLabProducerKitId;
  title: string;
  /** Short line in the toolbar — thanks to the fictional crew. */
  tribute: string;
  pads: readonly BeatLabProducerPadDef[];
}

function u(rel: string): string {
  return `${SMPLDSNDS_BASE}/${rel}`;
}

function padDefUrl(def: BeatLabProducerPadDef): string {
  if (def.localFile) {
    return `${BUNDLED_SAMPLE_BASE}${def.localFile.replace(/^\//, '')}`;
  }
  if (!def.relUrl) throw new Error(`Pad ${def.pad} missing relUrl/localFile`);
  return u(def.relUrl);
}

/** Pattern Bank + default banks A–H — flagship kit order (Trap → R&B → Dance). */
export const BEAT_LAB_FLAGSHIP_KIT_ORDER: readonly BeatLabProducerKitId[] = [
  'trapDarkVault',
  'trapSlabAtl',
  'trapTrunk808',
  'smoothRnb',
  'rnbVelvetBloom',
  'rnbNeoStack',
  'houseDrive',
  'clubPocket',
] as const;

const LOUD_KICK: Partial<PadSamplerPlaybackOpts> = { triggerSnap: 0.38, fineSemi: 0 };
const LOUD_SUB: Partial<PadSamplerPlaybackOpts> = {
  triggerSnap: 0.48,
  fineSemi: -3,
  lpHz: 4200,
};
/** Extra trunk — pad 15 and some kick lanes. */
const HEAVY_SUB: Partial<PadSamplerPlaybackOpts> = {
  triggerSnap: 0.55,
  fineSemi: -5,
  lpHz: 3600,
};
const HEAVY_KICK: Partial<PadSamplerPlaybackOpts> = {
  triggerSnap: 0.44,
  fineSemi: -2,
  lpHz: 4500,
};
const PUNCH_SNARE: Partial<PadSamplerPlaybackOpts> = { triggerSnap: 0.28 };

/** TR-808 long-decay kicks (bd0010+ = long haul tails in smpldsnds). */
const LONG_808_KICK: Partial<PadSamplerPlaybackOpts> = {
  triggerSnap: 0.12,
  fineSemi: -1,
  trim0: 0,
  trim1: 1,
  lpHz: 3800,
};
const LONG_808_BODY: Partial<PadSamplerPlaybackOpts> = {
  triggerSnap: 0.1,
  fineSemi: -3,
  trim0: 0,
  trim1: 1,
  lpHz: 3200,
};
const LONG_808_SUB: Partial<PadSamplerPlaybackOpts> = {
  triggerSnap: 0.08,
  fineSemi: -7,
  trim0: 0,
  trim1: 1,
  lpHz: 2400,
};
const CLICK_808: Partial<PadSamplerPlaybackOpts> = { triggerSnap: 0.4, fineSemi: 0 };
const CLAP_HIT: Partial<PadSamplerPlaybackOpts> = { triggerSnap: 0.36 };
const CLAP_STACK: Partial<PadSamplerPlaybackOpts> = { triggerSnap: 0.32 };

/**
 * Flagship trap kits — bundled Lex-style one-shots (public/samples/sound-families/trap-kit/).
 * Pad map: Kick / Snare / Clap / CH / OH / TomHi / TomLo / Rim / Perc×2 / Crash / Ride / Shaker / Cow / Snap / SUB.
 */
const KIT_TRAP_DARK_VAULT: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/heavy-kick-lv1.wav', label: 'Dark kick', sampler: HEAVY_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Trap snare', sampler: PUNCH_SNARE },
  { pad: 2, localFile: 'trap-kit/clap/trapaholic-clap-1-1.wav', label: 'Clap main', sampler: CLAP_HIT },
  { pad: 3, localFile: 'trap-kit/hihat/trapaholic-hihat-3.wav', label: 'CH tight' },
  { pad: 4, localFile: 'trap-kit/open-hat/ddw2-open-hat-6-1.wav', label: 'Open hat' },
  { pad: 5, localFile: 'trap-kit/808-sub/deedotluger-808-1.wav', label: '808 body', sampler: LONG_808_BODY },
  { pad: 6, localFile: 'trap-kit/kick/rack-kick.wav', label: 'Click kick', sampler: CLICK_808 },
  { pad: 7, localFile: 'trap-kit/snare/snare-54.wav', label: 'Rim snap', sampler: { triggerSnap: 0.32 } },
  { pad: 8, localFile: 'trap-kit/perc2/percs-6.wav', label: 'Perc hit' },
  { pad: 9, localFile: 'trap-kit/clap/deedotluger-clap-5.wav', label: 'Clap stack', sampler: CLAP_STACK },
  { pad: 10, localFile: 'trap-kit/cymbal/crash_lex-1.wav', label: 'Crash' },
  { pad: 11, localFile: 'trap-kit/cymbal/ddw2-crash-1.wav', label: 'Cym ride' },
  { pad: 12, localFile: 'trap-kit/perc2/bongo4-1.wav', label: 'Shaker perc' },
  { pad: 13, localFile: 'trap-kit/cymbal/trap-crash-3.wav', label: 'Accent' },
  { pad: 14, localFile: 'trap-kit/snare/solidasssnare.wav', label: 'Snap snare', sampler: { triggerSnap: 0.28 } },
  {
    pad: 15,
    localFile: 'trap-kit/808-sub/system-in-da-trunk-bass-1.wav',
    label: '808 SUB',
    sampler: LONG_808_SUB,
  },
];

const KIT_TRAP_SLAB_ATL: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/kick-atl.wav', label: 'ATL kick', sampler: HEAVY_KICK },
  { pad: 1, localFile: 'trap-kit/snare/deedotluger-snare-6-1.wav', label: 'Slab snare', sampler: PUNCH_SNARE },
  { pad: 2, localFile: 'trap-kit/clap/jc---clap-2-1.wav', label: 'Clap', sampler: CLAP_HIT },
  { pad: 3, localFile: 'trap-kit/hihat/ddw2-hat-1.wav', label: 'CH' },
  { pad: 4, localFile: 'trap-kit/open-hat/ddw2-open-hat-1-1.wav', label: 'OH' },
  { pad: 5, localFile: 'trap-kit/808-sub/808-atl.wav', label: '808 ATL', sampler: LONG_808_BODY },
  { pad: 6, localFile: 'trap-kit/kick/drumma-boy-kick.wav', label: 'Kick layer', sampler: CLICK_808 },
  { pad: 7, localFile: 'trap-kit/snare/snare-6.wav', label: 'Rim' },
  { pad: 8, localFile: 'trap-kit/perc/stab2-19-1.wav', label: 'Perc stab' },
  { pad: 9, localFile: 'trap-kit/clap/deedotluger-clap-3-1.wav', label: 'Clap 2', sampler: CLAP_STACK },
  { pad: 10, localFile: 'trap-kit/cymbal/deedotluger-crash-3-1.wav', label: 'Crash' },
  { pad: 11, localFile: 'trap-kit/cymbal/zay-cym-13.wav', label: 'Ride' },
  { pad: 12, localFile: 'trap-kit/hihat/trapaholic-hihat-20.wav', label: 'Hat shake' },
  { pad: 13, localFile: 'trap-kit/perc/hit_ctim_c4-1.wav', label: 'Cow hit' },
  { pad: 14, localFile: 'trap-kit/snare/trapaholic-snare-13-1.wav', label: 'Snap', sampler: { triggerSnap: 0.26 } },
  { pad: 15, localFile: 'trap-kit/808-sub/ll_808_g_cyborg.wav', label: '808 SUB', sampler: LONG_808_SUB },
];

const KIT_TRAP_TRUNK_808: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/deedotluger-kick-7.wav', label: '808 kick', sampler: LONG_808_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare-2-1.wav', label: 'Trap snare', sampler: PUNCH_SNARE },
  { pad: 2, localFile: 'trap-kit/clap/trapaholic-clap-14-1.wav', label: 'Clap', sampler: CLAP_HIT },
  { pad: 3, localFile: 'trap-kit/hihat/trapaholic-hihat-23.wav', label: 'CH' },
  { pad: 4, localFile: 'trap-kit/open-hat/deedotluger-open-hat-6.wav', label: 'OH' },
  { pad: 5, localFile: 'trap-kit/808-sub/deedotluger-808-13.wav', label: '808 long', sampler: LONG_808_BODY },
  { pad: 6, localFile: 'trap-kit/kick/cts_kick2.wav', label: 'Kick click', sampler: CLICK_808 },
  { pad: 7, localFile: 'trap-kit/snare/new-snare.wav', label: 'Rim hit' },
  { pad: 8, localFile: 'trap-kit/fx/cyborg-riser.wav', label: 'FX rise' },
  { pad: 9, localFile: 'trap-kit/clap/trapaholic-clap-21-1.wav', label: 'Clap stack', sampler: CLAP_STACK },
  { pad: 10, localFile: 'trap-kit/cymbal/orch-crash-1.wav', label: 'Crash' },
  { pad: 11, localFile: 'trap-kit/cymbal/b.k-bangerz--orchestra-crash.wav', label: 'Orch cym' },
  { pad: 12, localFile: 'trap-kit/hihat/shawty-redd-hat-1.wav', label: 'Shaker hat' },
  { pad: 13, localFile: 'trap-kit/perc2/triangle-2-1.wav', label: 'Bell perc' },
  { pad: 14, localFile: 'trap-kit/snare/drumma-boy-snare.wav', label: 'Snap sn', sampler: { triggerSnap: 0.28 } },
  { pad: 15, localFile: 'trap-kit/808-sub/trunk-808-1.wav', label: '808 SUB', sampler: LONG_808_SUB },
];

/**
 * Brass Trap — trap drum-folder layout: long 808 on kick + sub, claps, snare, hats, hits.
 * Pad 0 = main long 808 · pad 15 = deepest sub · pad 6 = short 808 click layer.
 */
const KIT_BRASS_TRAP: readonly BeatLabProducerPadDef[] = [
  { pad: 0, relUrl: 'TR-808/kick/bd0010.m4a', label: '808 LONG', sampler: LONG_808_KICK },
  { pad: 1, relUrl: 'TR-808/snare/sd0000.m4a', label: 'Trap snare', sampler: PUNCH_SNARE },
  { pad: 2, relUrl: 'TR-808/clap/cp.m4a', label: 'Clap', sampler: CLAP_HIT },
  { pad: 3, relUrl: '808-mini/hhclosed-1.m4a', label: 'CH' },
  { pad: 4, relUrl: '808-mini/hhopen-1.m4a', label: 'OH' },
  { pad: 5, relUrl: 'TR-808/kick/bd0025.m4a', label: '808 MED', sampler: LONG_808_BODY },
  { pad: 6, relUrl: 'TR-808/kick/bd0000.m4a', label: '808 click', sampler: CLICK_808 },
  { pad: 7, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim' },
  { pad: 8, relUrl: 'TR-808/maraca/ma.m4a', label: 'Perc hit' },
  { pad: 9, relUrl: 'LM-2/clap.m4a', label: 'Clap 2', sampler: CLAP_STACK },
  { pad: 10, relUrl: '808-mini/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: '808-mini/ride.m4a', label: 'Ride' },
  { pad: 12, relUrl: '808-mini/snare-3.m4a', label: 'Sn hit', sampler: { triggerSnap: 0.26 } },
  { pad: 13, relUrl: 'TR-808/cowbell/cb.m4a', label: 'Cow' },
  { pad: 14, relUrl: '808-mini/snare-2.m4a', label: 'Snap', sampler: { triggerSnap: 0.28 } },
  { pad: 15, relUrl: 'TR-808/kick/bd0075.m4a', label: '808 SUB', sampler: LONG_808_SUB },
];

/** Smooth R&B — LM-2 pocket, softer ghost-friendly snare (Beat Lab Pattern Bank pairing). */
const KIT_SMOOTH_RNB: readonly BeatLabProducerPadDef[] = [
  { pad: 0, relUrl: 'LM-2/kick.m4a', label: 'Kick · soft', sampler: { ...LOUD_KICK, triggerSnap: 0.34 } },
  { pad: 1, relUrl: 'LM-2/snare-h.m4a', label: 'Sn · ghost', sampler: { triggerSnap: 0.2 } },
  { pad: 2, relUrl: 'LM-2/clap.m4a', label: 'Clap', sampler: CLAP_HIT },
  { pad: 3, relUrl: 'LM-2/hhclosed.m4a', label: 'CH swing' },
  { pad: 4, relUrl: 'LM-2/hhopen.m4a', label: 'OH breathe' },
  { pad: 5, relUrl: 'LM-2/tom-h.m4a', label: 'Tom H' },
  { pad: 6, relUrl: 'LM-2/tom-m.m4a', label: 'Tom M' },
  { pad: 7, relUrl: 'LM-2/tambourine.m4a', label: 'Shkr', sampler: { triggerSnap: 0.18 } },
  { pad: 8, relUrl: 'LM-2/cabasa.m4a', label: 'Cabasa' },
  { pad: 9, relUrl: 'LM-2/cowbell.m4a', label: 'Cow' },
  { pad: 10, relUrl: 'LM-2/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: 'LM-2/ride.m4a', label: 'Ride' },
  { pad: 12, relUrl: 'LM-2/tambourine.m4a', label: 'Tamb lite' },
  { pad: 13, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim' },
  { pad: 14, relUrl: 'LM-2/snare-m.m4a', label: 'Sn back', sampler: { triggerSnap: 0.26 } },
  {
    pad: 15,
    relUrl: 'TR-808/kick/bd0050.m4a',
    label: 'Sub warm',
    sampler: { triggerSnap: 0.42, fineSemi: -2, lpHz: 5200 },
  },
];

/** R&B Velvet Bloom — airy hats + backbeat snare; glue sub only (no trap trunk kick). */
const KIT_RNB_VELVET_BLOOM: readonly BeatLabProducerPadDef[] = [
  { pad: 0, relUrl: 'LM-2/kick.m4a', label: 'Kick · bloom', sampler: { triggerSnap: 0.32, fineSemi: 0 } },
  { pad: 1, relUrl: 'LM-2/snare-m.m4a', label: 'Sn · back', sampler: { triggerSnap: 0.24 } },
  { pad: 2, relUrl: 'LM-2/clap.m4a', label: 'Clap soft', sampler: { ...CLAP_HIT, triggerSnap: 0.3 } },
  { pad: 3, relUrl: '808-mini/hhclosed-1.m4a', label: 'CH silk' },
  { pad: 4, relUrl: '808-mini/hhopen-1.m4a', label: 'OH air' },
  { pad: 5, relUrl: 'LM-2/tom-h.m4a', label: 'Tom H' },
  { pad: 6, relUrl: 'LM-2/tom-l.m4a', label: 'Tom L' },
  { pad: 7, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim', sampler: { triggerSnap: 0.35 } },
  { pad: 8, relUrl: 'LM-2/cabasa.m4a', label: 'Cabasa' },
  { pad: 9, relUrl: 'LM-2/tambourine.m4a', label: 'Tamb shake', sampler: { triggerSnap: 0.16 } },
  { pad: 10, relUrl: 'LM-2/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: 'LM-2/ride.m4a', label: 'Ride wash' },
  { pad: 12, relUrl: 'TR-808/conga-mid/mc00.m4a', label: 'Conga' },
  { pad: 13, relUrl: 'LM-2/cowbell.m4a', label: 'Cow' },
  { pad: 14, relUrl: 'LM-2/snare-h.m4a', label: 'Sn · ghost', sampler: { triggerSnap: 0.18 } },
  {
    pad: 15,
    relUrl: 'TR-808/kick/bd0050.m4a',
    label: '808 glue · low',
    sampler: { triggerSnap: 0.38, fineSemi: -3, lpHz: 4800 },
  },
];

/** R&B Neo Stack — CR-8000 body + LM-2 pocket; airy for neo-soul / modern R&B patterns. */
const KIT_RNB_NEO_STACK: readonly BeatLabProducerPadDef[] = [
  {
    pad: 0,
    relUrl: 'Roland-CR-8000/kick.m4a',
    label: 'Box · round',
    sampler: { triggerSnap: 0.34, fineSemi: -1, lpHz: 5800 },
  },
  { pad: 1, relUrl: 'LM-2/snare-h.m4a', label: 'Sn · float', sampler: { triggerSnap: 0.19 } },
  { pad: 2, relUrl: 'LM-2/clap.m4a', label: 'Clap', sampler: CLAP_HIT },
  { pad: 3, relUrl: 'Roland-CR-8000/hihat-closed.m4a', label: 'CH tick' },
  { pad: 4, relUrl: 'LM-2/hhopen.m4a', label: 'OH lift' },
  { pad: 5, relUrl: 'LM-2/tom-m.m4a', label: 'Tom M' },
  { pad: 6, relUrl: 'LM-2/kick.m4a', label: 'LM layer', sampler: { triggerSnap: 0.3, fineSemi: -1 } },
  { pad: 7, relUrl: 'LM-2/tambourine.m4a', label: 'Shaker ring', sampler: { triggerSnap: 0.17 } },
  { pad: 8, relUrl: 'LM-2/cabasa.m4a', label: 'Cabasa' },
  { pad: 9, relUrl: 'Roland-CR-8000/clave.m4a', label: 'Clave' },
  { pad: 10, relUrl: 'LM-2/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: 'LM-2/ride.m4a', label: 'Ride' },
  { pad: 12, relUrl: 'TR-808/conga-low/lc00.m4a', label: 'Conga low' },
  { pad: 13, relUrl: 'LM-2/cowbell.m4a', label: 'Cow' },
  { pad: 14, relUrl: 'LM-2/snare-m.m4a', label: 'Sn rim-ish', sampler: { triggerSnap: 0.25 } },
  {
    pad: 15,
    relUrl: 'TR-808/kick/bd0050.m4a',
    label: 'Sub pillow',
    sampler: { triggerSnap: 0.4, fineSemi: -4, lpHz: 4200 },
  },
];

/** House drive — LM-2 four-on-pocket + crisp 808 hats (club / house patterns). */
const KIT_HOUSE_DRIVE: readonly BeatLabProducerPadDef[] = [
  { pad: 0, relUrl: 'LM-2/kick.m4a', label: 'Kick pulse', sampler: LOUD_KICK },
  { pad: 1, relUrl: 'LM-2/snare-m.m4a', label: 'Sn tight', sampler: PUNCH_SNARE },
  { pad: 2, relUrl: 'LM-2/clap.m4a', label: 'Clap wide' },
  { pad: 3, relUrl: 'TR-808/hihat-close/ch.m4a', label: 'Hat tight' },
  { pad: 4, relUrl: 'TR-808/hihat-open/oh00.m4a', label: 'OH lift' },
  { pad: 5, relUrl: 'LM-2/tom-h.m4a', label: 'Perc tom' },
  { pad: 6, relUrl: '808-mini/kick.m4a', label: 'Click hat', sampler: CLICK_808 },
  { pad: 7, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim' },
  { pad: 8, relUrl: 'LM-2/cabasa.m4a', label: 'Shaker' },
  { pad: 9, relUrl: '808-mini/snare-2.m4a', label: 'Sn layer', sampler: { triggerSnap: 0.28 } },
  { pad: 10, relUrl: 'LM-2/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: 'LM-2/ride.m4a', label: 'Ride' },
  { pad: 12, relUrl: 'TR-808/maraca/ma.m4a', label: 'Perc tick' },
  { pad: 13, relUrl: 'TR-808/cowbell/cb.m4a', label: 'Cow' },
  { pad: 14, relUrl: 'LM-2/snare-h.m4a', label: 'Sn bright', sampler: { triggerSnap: 0.24 } },
  {
    pad: 15,
    relUrl: 'TR-808/kick/bd0025.m4a',
    label: 'Floor sub',
    sampler: LONG_808_BODY,
  },
];

/** Long 808 + Hits — extra long tails on several pads (folder-style 808/clap/snare pack). */
const KIT_LONG_808_HITS: readonly BeatLabProducerPadDef[] = [
  { pad: 0, relUrl: 'TR-808/kick/bd0010.m4a', label: '808 long', sampler: LONG_808_KICK },
  { pad: 1, relUrl: 'TR-808/snare/sd0000.m4a', label: 'Snare', sampler: PUNCH_SNARE },
  { pad: 2, relUrl: 'TR-808/clap/cp.m4a', label: 'Clap', sampler: CLAP_HIT },
  { pad: 3, relUrl: 'TR-808/hihat-close/ch.m4a', label: 'CH' },
  { pad: 4, relUrl: 'TR-808/hihat-open/oh00.m4a', label: 'OH' },
  { pad: 5, relUrl: 'TR-808/kick/bd0050.m4a', label: '808 body', sampler: LONG_808_BODY },
  { pad: 6, relUrl: 'TR-808/kick/bd0000.m4a', label: '808 punch', sampler: CLICK_808 },
  { pad: 7, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim' },
  { pad: 8, relUrl: '808-mini/snare-3.m4a', label: 'Hit', sampler: { triggerSnap: 0.3 } },
  { pad: 9, relUrl: 'TR-808/clap/cp.m4a', label: 'Clap layer', sampler: CLAP_STACK },
  { pad: 10, relUrl: 'LM-2/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: 'LM-2/ride.m4a', label: 'Ride' },
  { pad: 12, relUrl: 'TR-808/conga-mid/mc00.m4a', label: 'Shake' },
  { pad: 13, relUrl: 'TR-808/cowbell/cb.m4a', label: 'Cow' },
  { pad: 14, relUrl: 'LM-2/snare-h.m4a', label: 'Snap clap', sampler: { triggerSnap: 0.3 } },
  { pad: 15, relUrl: 'TR-808/kick/bd0075.m4a', label: '808 sub max', sampler: LONG_808_SUB },
];

/** Trap Clap Stack — claps + snares up front, long 808 under everything. */
const KIT_TRAP_CLAP_STACK: readonly BeatLabProducerPadDef[] = [
  { pad: 0, relUrl: 'TR-808/kick/bd0025.m4a', label: '808 kick', sampler: LONG_808_KICK },
  { pad: 1, relUrl: '808-mini/snare-1.m4a', label: 'Snare', sampler: PUNCH_SNARE },
  { pad: 2, relUrl: 'TR-808/clap/cp.m4a', label: 'Clap main', sampler: CLAP_HIT },
  { pad: 3, relUrl: '808-mini/hhclosed-2.m4a', label: 'CH tight' },
  { pad: 4, relUrl: '808-mini/hhopen-2.m4a', label: 'OH' },
  { pad: 5, relUrl: 'TR-808/kick/bd0050.m4a', label: '808 long 2', sampler: LONG_808_BODY },
  { pad: 6, relUrl: '808-mini/kick.m4a', label: 'Mini click', sampler: CLICK_808 },
  { pad: 7, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim' },
  { pad: 8, relUrl: 'LM-2/clap.m4a', label: 'Clap LM', sampler: CLAP_STACK },
  { pad: 9, relUrl: '808-mini/snare-3.m4a', label: 'Sn layer', sampler: { triggerSnap: 0.3 } },
  { pad: 10, relUrl: '808-mini/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: '808-mini/ride.m4a', label: 'Ride' },
  { pad: 12, relUrl: 'TR-808/maraca/ma.m4a', label: 'Perc' },
  { pad: 13, relUrl: 'TR-808/cowbell/cb.m4a', label: 'Cow' },
  { pad: 14, relUrl: 'TR-808/snare/sd0000.m4a', label: 'Sn hit', sampler: PUNCH_SNARE },
  { pad: 15, relUrl: 'TR-808/kick/bd0075.m4a', label: '808 SUB', sampler: LONG_808_SUB },
];

/** Trap Analog Room — TR-808 kicks + toms/congas up (matches tom/perc-heavy trap patterns). */
const KIT_TRAP_ANALOG_ROOM: readonly BeatLabProducerPadDef[] = [
  { pad: 0, relUrl: 'TR-808/kick/bd0010.m4a', label: '808 long', sampler: LONG_808_KICK },
  { pad: 1, relUrl: 'TR-808/snare/sd0000.m4a', label: 'Trap snare', sampler: PUNCH_SNARE },
  { pad: 2, relUrl: 'TR-808/clap/cp.m4a', label: 'Clap', sampler: CLAP_HIT },
  { pad: 3, relUrl: 'TR-808/hihat-close/ch.m4a', label: 'CH' },
  { pad: 4, relUrl: 'TR-808/hihat-open/oh00.m4a', label: 'OH' },
  { pad: 5, relUrl: 'TR-808/kick/bd0025.m4a', label: '808 med', sampler: LONG_808_BODY },
  { pad: 6, relUrl: 'TR-808/tom-hi/ht00.m4a', label: 'Tom hi' },
  { pad: 7, relUrl: 'TR-808/tom-low/lt00.m4a', label: 'Tom low' },
  { pad: 8, relUrl: 'TR-808/conga-mid/mc00.m4a', label: 'Conga mid' },
  { pad: 9, relUrl: 'TR-808/conga-low/lc00.m4a', label: 'Conga low' },
  { pad: 10, relUrl: 'LM-2/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: '808-mini/ride.m4a', label: 'Ride' },
  { pad: 12, relUrl: 'TR-808/maraca/ma.m4a', label: 'Perc' },
  { pad: 13, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim' },
  { pad: 14, relUrl: 'TR-808/kick/bd0000.m4a', label: '808 click', sampler: CLICK_808 },
  { pad: 15, relUrl: 'TR-808/kick/bd0075.m4a', label: '808 SUB', sampler: LONG_808_SUB },
];

/** Club Pocket — LM-2 bounce + 808 sub. */
const KIT_CLUB_POCKET: readonly BeatLabProducerPadDef[] = [
  { pad: 0, relUrl: 'LM-2/kick.m4a', label: 'Kick · Pocket', sampler: LOUD_KICK },
  { pad: 1, relUrl: 'LM-2/snare-m.m4a', label: 'Snare', sampler: PUNCH_SNARE },
  { pad: 2, relUrl: 'LM-2/clap.m4a', label: 'Clap' },
  { pad: 3, relUrl: 'LM-2/hhclosed.m4a', label: 'CH' },
  { pad: 4, relUrl: 'LM-2/hhopen.m4a', label: 'OH' },
  { pad: 5, relUrl: 'LM-2/tom-h.m4a', label: 'Tom H' },
  { pad: 6, relUrl: 'LM-2/tom-m.m4a', label: 'Tom M' },
  { pad: 7, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim' },
  { pad: 8, relUrl: 'LM-2/cabasa.m4a', label: 'Cabasa' },
  { pad: 9, relUrl: 'LM-2/tambourine.m4a', label: 'Tamb' },
  { pad: 10, relUrl: 'LM-2/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: 'LM-2/ride.m4a', label: 'Ride' },
  { pad: 12, relUrl: 'LM-2/tambourine.m4a', label: 'Shake' },
  { pad: 13, relUrl: 'LM-2/cowbell.m4a', label: 'Cow' },
  { pad: 14, relUrl: 'LM-2/snare-h.m4a', label: 'Snap', sampler: { triggerSnap: 0.2 } },
  { pad: 15, relUrl: 'TR-808/kick/bd0075.m4a', label: '808 SUB', sampler: LONG_808_SUB },
];

/** Night Sub — sub-heavy 808 trunk + dark hats. */
const KIT_NIGHT_SUB: readonly BeatLabProducerPadDef[] = [
  { pad: 0, relUrl: 'TR-808/kick/bd0010.m4a', label: '808 long', sampler: LONG_808_KICK },
  { pad: 1, relUrl: 'TR-808/snare/sd0000.m4a', label: 'Trap snare', sampler: PUNCH_SNARE },
  { pad: 2, relUrl: 'TR-808/clap/cp.m4a', label: 'Clap', sampler: CLAP_HIT },
  { pad: 3, relUrl: 'TR-808/hihat-close/ch.m4a', label: 'CH' },
  { pad: 4, relUrl: 'TR-808/hihat-open/oh00.m4a', label: 'OH' },
  { pad: 5, relUrl: 'TR-808/kick/bd0050.m4a', label: '808 body', sampler: LONG_808_BODY },
  { pad: 6, relUrl: 'TR-808/kick/bd0000.m4a', label: '808 click', sampler: CLICK_808 },
  { pad: 7, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim' },
  { pad: 8, relUrl: 'TR-808/conga-low/lc00.m4a', label: 'Conga' },
  { pad: 9, relUrl: '808-mini/snare-3.m4a', label: 'Sn layer' },
  { pad: 10, relUrl: 'LM-2/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: 'LM-2/ride.m4a', label: 'Ride' },
  { pad: 12, relUrl: 'TR-808/maraca/ma.m4a', label: 'Perc' },
  { pad: 13, relUrl: 'TR-808/cowbell/cb.m4a', label: 'Cow' },
  { pad: 14, relUrl: '808-mini/snare-2.m4a', label: 'Snap', sampler: { triggerSnap: 0.24 } },
  { pad: 15, relUrl: 'TR-808/kick/bd0075.m4a', label: '808 SUB', sampler: LONG_808_SUB },
];

/** Vault 808 — dark trap, all trunk. */
const KIT_VAULT_808: readonly BeatLabProducerPadDef[] = [
  { pad: 0, relUrl: 'TR-808/kick/bd0010.m4a', label: '808 long', sampler: LONG_808_KICK },
  { pad: 1, relUrl: 'TR-808/snare/sd0000.m4a', label: 'Trap snare', sampler: PUNCH_SNARE },
  { pad: 2, relUrl: 'TR-808/clap/cp.m4a', label: 'Clap', sampler: CLAP_HIT },
  { pad: 3, relUrl: 'TR-808/hihat-close/ch.m4a', label: 'CH' },
  { pad: 4, relUrl: 'TR-808/hihat-open/oh00.m4a', label: 'OH' },
  { pad: 5, relUrl: 'TR-808/kick/bd0025.m4a', label: '808 med', sampler: LONG_808_BODY },
  { pad: 6, relUrl: 'TR-808/kick/bd0000.m4a', label: '808 click', sampler: CLICK_808 },
  { pad: 7, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim' },
  { pad: 8, relUrl: 'TR-808/maraca/ma.m4a', label: 'Perc' },
  { pad: 9, relUrl: '808-mini/snare-2.m4a', label: 'Snap sn' },
  { pad: 10, relUrl: 'LM-2/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: 'LM-2/ride.m4a', label: 'Ride' },
  { pad: 12, relUrl: 'TR-808/conga-mid/mc00.m4a', label: 'Shake' },
  { pad: 13, relUrl: 'TR-808/cowbell/cb.m4a', label: 'Cow' },
  { pad: 14, relUrl: 'LM-2/snare-h.m4a', label: 'Punch SD', sampler: { triggerSnap: 0.26 } },
  { pad: 15, relUrl: 'TR-808/kick/bd0075.m4a', label: '808 SUB', sampler: LONG_808_SUB },
];

/** Trunk Rattle — four-kick low-end stack, 808 sub dominates. */
const KIT_TRUNK_RATTLE: readonly BeatLabProducerPadDef[] = [
  { pad: 0, relUrl: 'TR-808/kick/bd0050.m4a', label: '808 kick', sampler: LONG_808_KICK },
  { pad: 1, relUrl: 'TR-808/snare/sd0000.m4a', label: 'Snare', sampler: PUNCH_SNARE },
  { pad: 2, relUrl: 'TR-808/clap/cp.m4a', label: 'Clap', sampler: CLAP_HIT },
  { pad: 3, relUrl: 'TR-808/hihat-close/ch.m4a', label: 'CH' },
  { pad: 4, relUrl: 'TR-808/hihat-open/oh00.m4a', label: 'OH' },
  { pad: 5, relUrl: 'TR-808/kick/bd0010.m4a', label: '808 long 2', sampler: LONG_808_BODY },
  { pad: 6, relUrl: 'TR-808/kick/bd0000.m4a', label: '808 click', sampler: CLICK_808 },
  { pad: 7, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim' },
  { pad: 8, relUrl: 'TR-808/conga-low/lc00.m4a', label: 'Conga' },
  { pad: 9, relUrl: '808-mini/snare-3.m4a', label: 'Sn layer' },
  { pad: 10, relUrl: 'LM-2/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: 'LM-2/ride.m4a', label: 'Ride' },
  { pad: 12, relUrl: 'TR-808/maraca/ma.m4a', label: 'Shake' },
  { pad: 13, relUrl: 'TR-808/cowbell/cb.m4a', label: 'Cow' },
  { pad: 14, relUrl: '808-mini/snare-2.m4a', label: 'Snap', sampler: { triggerSnap: 0.26 } },
  { pad: 15, relUrl: 'TR-808/kick/bd0075.m4a', label: '808 SUB', sampler: LONG_808_SUB },
];

/** Slab 808 — dark trap, dual kick + weight. */
const KIT_SLAB_808: readonly BeatLabProducerPadDef[] = [
  { pad: 0, relUrl: 'TR-808/kick/bd0010.m4a', label: '808 long', sampler: LONG_808_KICK },
  { pad: 1, relUrl: 'TR-808/snare/sd0000.m4a', label: 'Trap snare', sampler: PUNCH_SNARE },
  { pad: 2, relUrl: 'TR-808/clap/cp.m4a', label: 'Clap' },
  { pad: 3, relUrl: 'TR-808/hihat-close/ch.m4a', label: 'CH' },
  { pad: 4, relUrl: 'TR-808/hihat-open/oh00.m4a', label: 'OH' },
  { pad: 5, relUrl: 'TR-808/tom-hi/ht00.m4a', label: 'Tom H' },
  { pad: 6, relUrl: 'TR-808/tom-low/lt00.m4a', label: 'Tom L' },
  { pad: 7, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim' },
  { pad: 8, relUrl: 'TR-808/maraca/ma.m4a', label: 'Perc' },
  { pad: 9, relUrl: '808-mini/snare-2.m4a', label: 'Snap sn' },
  { pad: 10, relUrl: 'TR-808/cymbal/cy0050.m4a', label: 'Cym' },
  { pad: 11, relUrl: '808-mini/hhopen-1.m4a', label: 'OH lift' },
  { pad: 12, relUrl: '808-mini/hhclosed-2.m4a', label: 'CH tight' },
  { pad: 13, relUrl: 'TR-808/cowbell/cb.m4a', label: 'Cow' },
  { pad: 14, relUrl: 'LM-2/snare-m.m4a', label: 'Punch SD', sampler: { triggerSnap: 0.3 } },
  { pad: 15, relUrl: 'TR-808/kick/bd0075.m4a', label: '808 SUB', sampler: LONG_808_SUB },
];

/** Iron Slide — drill pocket, long 808 on kick + sub. */
const KIT_IRON_SLIDE: readonly BeatLabProducerPadDef[] = [
  { pad: 0, relUrl: 'TR-808/kick/bd0010.m4a', label: 'Kick long', sampler: LONG_808_KICK },
  { pad: 1, relUrl: 'TR-808/snare/sd0000.m4a', label: 'Snare', sampler: PUNCH_SNARE },
  { pad: 2, relUrl: 'TR-808/clap/cp.m4a', label: 'Clap' },
  { pad: 3, relUrl: '808-mini/hhclosed-1.m4a', label: 'CH 1' },
  { pad: 4, relUrl: 'TR-808/hihat-open/oh00.m4a', label: 'OH' },
  { pad: 5, relUrl: 'TR-808/tom-hi/ht00.m4a', label: 'Tom hi' },
  { pad: 6, relUrl: 'TR-808/tom-low/lt00.m4a', label: 'Tom slide' },
  { pad: 7, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim' },
  { pad: 8, relUrl: 'TR-808/clave/cl.m4a', label: 'Clave' },
  { pad: 9, relUrl: '808-mini/snare-1.m4a', label: 'Sn alt' },
  { pad: 10, relUrl: 'LM-2/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: '808-mini/hhopen-2.m4a', label: 'OH 2' },
  { pad: 12, relUrl: 'TR-808/maraca/ma.m4a', label: 'Noise' },
  { pad: 13, relUrl: 'TR-808/cowbell/cb.m4a', label: 'Cow' },
  { pad: 14, relUrl: '808-mini/kick.m4a', label: 'Kick punch', sampler: CLICK_808 },
  { pad: 15, relUrl: 'TR-808/kick/bd0075.m4a', label: '808 SUB', sampler: LONG_808_SUB },
];

/** Bell 808 — cowbell + rim phonk weight, sub-heavy. */
const KIT_BELL_808: readonly BeatLabProducerPadDef[] = [
  { pad: 0, relUrl: 'TR-808/kick/bd0025.m4a', label: '808 sub', sampler: LONG_808_KICK },
  { pad: 1, relUrl: 'TR-808/snare/sd0000.m4a', label: 'Snare', sampler: PUNCH_SNARE },
  { pad: 2, relUrl: 'TR-808/clap/cp.m4a', label: 'Clap' },
  { pad: 3, relUrl: 'Roland-CR-8000/hihat-closed.m4a', label: 'CR CH' },
  { pad: 4, relUrl: 'TR-808/hihat-open/oh00.m4a', label: '808 OH' },
  { pad: 5, relUrl: 'TR-808/tom-low/lt00.m4a', label: 'Tom L' },
  { pad: 6, relUrl: 'Roland-CR-8000/kick.m4a', label: 'Box kick', sampler: { triggerSnap: 0.36, fineSemi: -1 } },
  { pad: 7, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim' },
  { pad: 8, relUrl: 'Roland-CR-8000/clave.m4a', label: 'Clave' },
  { pad: 9, relUrl: '808-mini/snare-3.m4a', label: 'Sn layer' },
  { pad: 10, relUrl: 'LM-2/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: 'Roland-CR-8000/hihat-open.m4a', label: 'CR OH' },
  { pad: 12, relUrl: 'TR-808/maraca/ma.m4a', label: 'Dirt' },
  { pad: 13, relUrl: 'TR-808/cowbell/cb.m4a', label: 'Bell', sampler: { triggerSnap: 0.2 } },
  { pad: 14, relUrl: 'Roland-CR-8000/snare.m4a', label: 'CR sn', sampler: { triggerSnap: 0.24 } },
  { pad: 15, relUrl: 'TR-808/kick/bd0075.m4a', label: '808 SUB', sampler: LONG_808_SUB },
];

/** Mud Floor — CR box + LM knock under a sub layer. */
const KIT_MUD_FLOOR: readonly BeatLabProducerPadDef[] = [
  { pad: 0, relUrl: 'Roland-CR-8000/kick.m4a', label: 'Box kick', sampler: HEAVY_KICK },
  { pad: 1, relUrl: 'LM-2/snare-m.m4a', label: 'Snare', sampler: PUNCH_SNARE },
  { pad: 2, relUrl: 'TR-808/clap/cp.m4a', label: 'Clap' },
  { pad: 3, relUrl: '808-mini/hhclosed-2.m4a', label: 'CH dark' },
  { pad: 4, relUrl: '808-mini/hhopen-1.m4a', label: 'OH' },
  { pad: 5, relUrl: 'LM-2/tom-l.m4a', label: 'Tom L' },
  { pad: 6, relUrl: 'LM-2/kick.m4a', label: 'LM knock', sampler: { triggerSnap: 0.4, fineSemi: -1 } },
  { pad: 7, relUrl: 'TR-808/rimshot/rs.m4a', label: 'Rim' },
  { pad: 8, relUrl: 'Roland-CR-8000/cowbell.m4a', label: 'CR bell' },
  { pad: 9, relUrl: '808-mini/snare-3.m4a', label: 'Sn grit' },
  { pad: 10, relUrl: 'LM-2/crash.m4a', label: 'Crash' },
  { pad: 11, relUrl: 'LM-2/ride.m4a', label: 'Ride' },
  { pad: 12, relUrl: 'TR-808/conga-low/lc00.m4a', label: 'Conga' },
  { pad: 13, relUrl: 'TR-808/cowbell/cb.m4a', label: 'Cow' },
  { pad: 14, relUrl: 'LM-2/snare-h.m4a', label: 'Snap', sampler: { triggerSnap: 0.28 } },
  { pad: 15, relUrl: 'TR-808/kick/bd0075.m4a', label: '808 SUB', sampler: LONG_808_SUB },
];

const KITS: readonly BeatLabProducerKitMeta[] = [
  {
    id: 'trapDarkVault',
    title: 'Trap · Dark Vault',
    tribute: 'Built-in dark trap — heavy kick, trunk 808, stacked claps.',
    pads: KIT_TRAP_DARK_VAULT,
  },
  {
    id: 'trapSlabAtl',
    title: 'Trap · ATL Slab',
    tribute: 'ATL-style slab trap — punch kick, cyborg sub, crisp hats.',
    pads: KIT_TRAP_SLAB_ATL,
  },
  {
    id: 'trapTrunk808',
    title: 'Trap · Trunk 808',
    tribute: 'Trunk-rattle 808s — long sub tails for modern trap patterns.',
    pads: KIT_TRAP_TRUNK_808,
  },
  {
    id: 'smoothRnb',
    title: 'R&B · Smooth Pocket',
    tribute: 'Soft knock + ghosts — Pocket Session crew (R&B pattern pair).',
    pads: KIT_SMOOTH_RNB,
  },
  {
    id: 'rnbVelvetBloom',
    title: 'R&B · Velvet Bloom',
    tribute: 'Silk hats + pocket kick — Velvet Bloom crew.',
    pads: KIT_RNB_VELVET_BLOOM,
  },
  {
    id: 'rnbNeoStack',
    title: 'R&B · Neo Stack',
    tribute: 'Neo-soul body + shaker air — Neon Stack Sessions.',
    pads: KIT_RNB_NEO_STACK,
  },
  {
    id: 'houseDrive',
    title: 'Dance · House Drive',
    tribute: 'Four-on-pocket + slick hats — Night Avenue house stack.',
    pads: KIT_HOUSE_DRIVE,
  },
  {
    id: 'clubPocket',
    title: 'Dance · Club Pocket',
    tribute: 'Thanks, Lowline Bounce — for the pocket and the bounce.',
    pads: KIT_CLUB_POCKET,
  },
  {
    id: 'brassTrap',
    title: 'Brass Trap',
    tribute: 'Long 808s + claps + hits — built-in crew pack.',
    pads: KIT_BRASS_TRAP,
  },
  {
    id: 'long808Hits',
    title: 'Long 808 + Hits',
    tribute: 'Full folder layout — long 808 tails, claps, snares, extras.',
    pads: KIT_LONG_808_HITS,
  },
  {
    id: 'trapClapStack',
    title: 'Clap Stack 808',
    tribute: 'Stacked claps and snares over long sub — hit hard.',
    pads: KIT_TRAP_CLAP_STACK,
  },
  {
    id: 'trapAnalogRoom',
    title: 'Trap Analog Room',
    tribute: '808 drums + analog toms/congas — for perc-forward trap grooves.',
    pads: KIT_TRAP_ANALOG_ROOM,
  },
  {
    id: 'nightSub',
    title: 'Night Sub',
    tribute: 'Thanks, Sub Division — for the trunk and the night feel.',
    pads: KIT_NIGHT_SUB,
  },
  {
    id: 'vault808',
    title: 'Vault 808',
    tribute: 'Vault long 808s — claps, hits, full sub tail.',
    pads: KIT_VAULT_808,
  },
  {
    id: 'trunkRattle',
    title: 'Trunk Rattle',
    tribute: 'Thanks, Concrete Low — rattles the trunk every time.',
    pads: KIT_TRUNK_RATTLE,
  },
  {
    id: 'slab808',
    title: 'Slab 808',
    tribute: 'Thanks, Dark Plate crew — slab weight, no mercy.',
    pads: KIT_SLAB_808,
  },
  {
    id: 'ironSlide',
    title: 'Iron Slide',
    tribute: 'Thanks, Slide Unit — drill low-end, 808 long.',
    pads: KIT_IRON_SLIDE,
  },
  {
    id: 'bell808',
    title: 'Bell 808',
    tribute: 'Thanks, Bell Forge — cowbell grit over sub mud.',
    pads: KIT_BELL_808,
  },
  {
    id: 'mudFloor',
    title: 'Mud Floor',
    tribute: 'Thanks, Floor Kings — muddy box kick + 808 floor.',
    pads: KIT_MUD_FLOOR,
  },
];

export const BEAT_LAB_PRODUCER_KITS = KITS;

export function beatLabProducerKitMeta(id: BeatLabProducerKitId): BeatLabProducerKitMeta | undefined {
  return KITS.find((k) => k.id === id);
}

export type LoadedBeatLabProducerPad = {
  pad: number;
  buffer: AudioBuffer;
  label: string;
  sampler: PadSamplerPlaybackOpts;
};

async function fetchAndDecode(url: string, ctx: BaseAudioContext): Promise<AudioBuffer> {
  const resp = await fetch(url, { cache: 'force-cache' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const bytes = await resp.arrayBuffer();
  return await ctx.decodeAudioData(bytes.slice(0));
}

function mergeSamplerOpts(partial?: Partial<PadSamplerPlaybackOpts>): PadSamplerPlaybackOpts {
  const base = defaultPadSamplerPlaybackOpts();
  if (!partial) return base;
  return {
    hpHz: partial.hpHz ?? base.hpHz,
    lpHz: partial.lpHz ?? base.lpHz,
    trim0: partial.trim0 ?? base.trim0,
    trim1: partial.trim1 ?? base.trim1,
    fineSemi: partial.fineSemi ?? base.fineSemi,
    triggerSnap: partial.triggerSnap ?? base.triggerSnap,
  };
}

type ProducerKitCacheEntry = {
  state: 'loading' | 'ready' | 'failed';
  pads: LoadedBeatLabProducerPad[];
  readyPromise: Promise<LoadedBeatLabProducerPad[]>;
};

const producerKitCache = new Map<BeatLabProducerKitId, ProducerKitCacheEntry>();

async function fetchProducerKitPadsUncached(
  id: BeatLabProducerKitId,
  ctx: BaseAudioContext,
): Promise<LoadedBeatLabProducerPad[]> {
  const meta = beatLabProducerKitMeta(id);
  if (!meta) return [];
  const out: LoadedBeatLabProducerPad[] = [];
  await Promise.all(
    meta.pads.map(async (def) => {
      try {
        const buffer = await fetchAndDecode(padDefUrl(def), ctx);
        out.push({
          pad: def.pad,
          buffer,
          label: def.label,
          sampler: mergeSamplerOpts(def.sampler),
        });
      } catch {
        /* skip failed pad */
      }
    }),
  );
  out.sort((a, b) => a.pad - b.pad);
  return out;
}

function startLoadProducerKit(id: BeatLabProducerKitId, ctx: BaseAudioContext): ProducerKitCacheEntry {
  const entry: ProducerKitCacheEntry = {
    state: 'loading',
    pads: [],
    readyPromise: Promise.resolve([]),
  };
  producerKitCache.set(id, entry);
  entry.readyPromise = (async () => {
    const pads = await fetchProducerKitPadsUncached(id, ctx);
    entry.pads = pads;
    entry.state = pads.length > 0 ? 'ready' : 'failed';
    if (entry.state === 'failed') producerKitCache.delete(id);
    return pads;
  })();
  return entry;
}

/** Fetch + decode all pads for a crew kit (cached in memory after first load). */
export function ensureBeatLabProducerKitLoaded(
  id: BeatLabProducerKitId,
  ctx: BaseAudioContext,
): Promise<LoadedBeatLabProducerPad[]> {
  const cached = producerKitCache.get(id);
  if (cached) {
    if (cached.state === 'ready') return Promise.resolve(cached.pads);
    return cached.readyPromise;
  }
  return startLoadProducerKit(id, ctx).readyPromise;
}

/** @deprecated Prefer {@link ensureBeatLabProducerKitLoaded} — same behavior, uses cache. */
export async function loadBeatLabProducerKitPads(
  id: BeatLabProducerKitId,
  ctx: BaseAudioContext,
): Promise<LoadedBeatLabProducerPad[]> {
  return ensureBeatLabProducerKitLoaded(id, ctx);
}
