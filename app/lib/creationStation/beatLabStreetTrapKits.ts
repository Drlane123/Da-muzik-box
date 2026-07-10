/**
 * Beat Lab Street Trap Series — ten curated kits built only from bundled
 * sound-family one-shots (`public/samples/sound-families/trap-kit/`).
 * Paired 1:1 with {@link BEAT_LAB_STREET_TRAP_PATTERNS}.
 */

import type { BeatLabProducerKitMeta, BeatLabProducerPadDef } from '@/app/lib/creationStation/beatLabProducerKits';

const HEAVY_KICK = { triggerSnap: 0.44, fineSemi: -2, lpHz: 4500 } as const;
const LONG_808_BODY = { triggerSnap: 0.1, fineSemi: -3, trim0: 0, trim1: 1, lpHz: 3200 } as const;
const LONG_808_SUB = { triggerSnap: 0.08, fineSemi: -7, trim0: 0, trim1: 1, lpHz: 2400 } as const;
const LONG_808_KICK = { triggerSnap: 0.12, fineSemi: -1, trim0: 0, trim1: 1, lpHz: 3800 } as const;
const CLICK_808 = { triggerSnap: 0.4, fineSemi: 0 } as const;
/** Tight trap snap — hard attack, no floppy tail. */
const TRAP_TIGHT_SNARE = {
  triggerSnap: 0.56,
  fineSemi: 0,
  hpHz: 280,
  lpHz: 10800,
  trim0: 0,
  trim1: 0.82,
  maxPlaySec: 0.18,
} as const;
const CLAP_HIT = { triggerSnap: 0.4, maxPlaySec: 0.2 } as const;
const CLAP_STACK = { triggerSnap: 0.36, maxPlaySec: 0.18 } as const;

export type BeatLabStreetTrapKitId =
  | 'trapStreetCyborgWoofer'
  | 'trapStreetBedrockSlab'
  | 'trapStreetZayTunnel'
  | 'trapStreetPinkVault'
  | 'trapStreetReddBlock'
  | 'trapStreetTm88Night'
  | 'trapStreetTrunkSk'
  | 'trapStreetJcStack'
  | 'trapStreetGuudSine'
  | 'trapStreetNegativeFloor';

const KIT_CYBORG_WOOFER: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/trunk-sk-14.wav', label: 'Trunk kick', sampler: HEAVY_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Trunk sn', sampler: TRAP_TIGHT_SNARE },
  { pad: 2, localFile: 'trap-kit/clap/tm88-softclap.wav', label: 'Soft clap', sampler: CLAP_HIT },
  { pad: 3, localFile: 'trap-kit/hihat/deedotluger-hat-3.wav', label: 'CH dark' },
  { pad: 4, localFile: 'trap-kit/open-hat/deedotluger-open-hat-3.wav', label: 'OH lift' },
  { pad: 5, localFile: 'trap-kit/808-sub/808-cyborg-2.wav', label: '808 body', sampler: LONG_808_BODY },
  { pad: 6, localFile: 'trap-kit/kick/deedotluger-kick-3.wav', label: 'Click layer', sampler: CLICK_808 },
  { pad: 7, localFile: 'trap-kit/snare/snare-54.wav', label: 'Rim snap', sampler: { triggerSnap: 0.32 } },
  { pad: 8, localFile: 'trap-kit/fx/cyborg-riser.wav', label: 'FX rise' },
  { pad: 9, localFile: 'trap-kit/clap/deedotluger-clap-8.wav', label: 'Clap stack', sampler: CLAP_STACK },
  { pad: 10, localFile: 'trap-kit/cymbal/zay-cym-9.wav', label: 'Crash' },
  { pad: 11, localFile: 'trap-kit/cymbal/zay-cym-14.wav', label: 'Cym wash' },
  { pad: 12, localFile: 'trap-kit/hihat/trapaholic-hihat-7.wav', label: 'Hat shake' },
  { pad: 13, localFile: 'trap-kit/perc2/perc---pink.wav', label: 'Perc accent' },
  { pad: 14, localFile: 'trap-kit/snare/solidasssnare.wav', label: 'Snap sn', sampler: { triggerSnap: 0.26 } },
  { pad: 15, localFile: 'trap-kit/808-sub/808_cassius-jay-woofer-808.wav', label: '808 SUB', sampler: LONG_808_SUB },
];

const KIT_BEDROCK_SLAB: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/808-sub/808-bam-bam-from-bedrock.wav', label: 'Bedrock 808', sampler: LONG_808_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Snap snare', sampler: { ...TRAP_TIGHT_SNARE, triggerSnap: 0.58, maxPlaySec: 0.16 } },
  { pad: 2, localFile: 'trap-kit/clap/jc---clap-4.wav', label: 'Clap hard', sampler: CLAP_HIT },
  { pad: 3, localFile: 'trap-kit/hihat/bedrock-hihat.wav', label: 'CH bedrock' },
  { pad: 4, localFile: 'trap-kit/open-hat/bz-redd-op-hat.wav', label: 'OH' },
  { pad: 5, localFile: 'trap-kit/808-sub/808-bam-bam-from-bedrock.wav', label: '808 body', sampler: LONG_808_BODY },
  { pad: 6, localFile: 'trap-kit/kick/redd-kick-14.wav', label: 'Kick layer', sampler: CLICK_808 },
  { pad: 7, localFile: 'trap-kit/perc2/perc---bedrock.wav', label: 'Bed perc', sampler: { triggerSnap: 0.24 } },
  { pad: 8, localFile: 'trap-kit/perc/stab2-19-1.wav', label: 'Stab hit' },
  { pad: 9, localFile: 'trap-kit/clap/jc---clap-3.wav', label: 'Clap 2', sampler: CLAP_STACK },
  { pad: 10, localFile: 'trap-kit/cymbal/deedotluger-crash-3-1.wav', label: 'Crash' },
  { pad: 11, localFile: 'trap-kit/cymbal/ddw2-crash-1.wav', label: 'Cym ride' },
  { pad: 12, localFile: 'trap-kit/hihat/ddw2-hat-1.wav', label: 'Hat roll' },
  { pad: 13, localFile: 'trap-kit/perc2/triangle-2-1.wav', label: 'Bell perc' },
  { pad: 14, localFile: 'trap-kit/snare/trapaholic-snare-13-1.wav', label: 'Snap', sampler: { triggerSnap: 0.28 } },
  { pad: 15, localFile: 'trap-kit/808-sub/808-bam-bam-from-bedrock-1.wav', label: '808 SUB', sampler: LONG_808_SUB },
];

const KIT_ZAY_TUNNEL: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/zaytoven-rare-kick.wav', label: 'Zay kick', sampler: LONG_808_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Zay snare', sampler: TRAP_TIGHT_SNARE },
  { pad: 2, localFile: 'trap-kit/clap/zaytoven-snareclap.wav', label: 'Sn/clap', sampler: CLAP_HIT },
  { pad: 3, localFile: 'trap-kit/hihat/trapaholic-hihat-20.wav', label: 'CH tight' },
  { pad: 4, localFile: 'trap-kit/open-hat/ddw2-open-hat-1-1.wav', label: 'OH' },
  { pad: 5, localFile: 'trap-kit/808-sub/808_zay-x-808.wav', label: '808 Zay', sampler: LONG_808_BODY },
  { pad: 6, localFile: 'trap-kit/kick/cts_kick2.wav', label: 'Click kick', sampler: CLICK_808 },
  { pad: 7, localFile: 'trap-kit/snare/new-snare.wav', label: 'Rim hit' },
  { pad: 8, localFile: 'trap-kit/fx/zaytoven-bell.wav', label: 'Bell FX' },
  { pad: 9, localFile: 'trap-kit/clap/trapaholic-clap-21-1.wav', label: 'Clap stack', sampler: CLAP_STACK },
  { pad: 10, localFile: 'trap-kit/cymbal/zay-cym-13.wav', label: 'Zay crash' },
  { pad: 11, localFile: 'trap-kit/cymbal/zay-cym-2.wav', label: 'Cym ride' },
  { pad: 12, localFile: 'trap-kit/hihat/shawty-redd-hat-1.wav', label: 'Shaker hat' },
  { pad: 13, localFile: 'trap-kit/perc/hit_ctim_c4-1.wav', label: 'Cow hit' },
  { pad: 14, localFile: 'trap-kit/snare/drumma-boy-snare.wav', label: 'Snap sn', sampler: { triggerSnap: 0.28 } },
  { pad: 15, localFile: 'trap-kit/808-sub/808_zay-x-808-1.wav', label: '808 SUB', sampler: LONG_808_SUB },
];

const KIT_PINK_VAULT: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/heavy-kick-lv1.wav', label: 'Vault kick', sampler: HEAVY_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Pink sn', sampler: TRAP_TIGHT_SNARE },
  { pad: 2, localFile: 'trap-kit/clap/trapaholic-clap-14-1.wav', label: 'Clap', sampler: CLAP_HIT },
  { pad: 3, localFile: 'trap-kit/hihat/trapaholic-hihat-23.wav', label: 'CH' },
  { pad: 4, localFile: 'trap-kit/open-hat/deedotluger-open-hat-6.wav', label: 'OH dark' },
  { pad: 5, localFile: 'trap-kit/808-sub/pink---bouldercrest-808.wav', label: '808 body', sampler: LONG_808_BODY },
  { pad: 6, localFile: 'trap-kit/kick/rack-kick.wav', label: 'Click kick', sampler: CLICK_808 },
  { pad: 7, localFile: 'trap-kit/perc2/bwb-vault-perc-dope-block.wav', label: 'Block perc' },
  { pad: 8, localFile: 'trap-kit/perc2/perc---pink.wav', label: 'Pink perc' },
  { pad: 9, localFile: 'trap-kit/clap/deedotluger-clap-5.wav', label: 'Clap stack', sampler: CLAP_STACK },
  { pad: 10, localFile: 'trap-kit/cymbal/trap-crash-3.wav', label: 'Crash' },
  { pad: 11, localFile: 'trap-kit/cymbal/orch-crash-1.wav', label: 'Orch cym' },
  { pad: 12, localFile: 'trap-kit/fx/pink-noise.wav', label: 'Noise wash' },
  { pad: 13, localFile: 'trap-kit/perc2/perc-pink-2.wav', label: 'Accent' },
  { pad: 14, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Snap layer', sampler: { triggerSnap: 0.26 } },
  { pad: 15, localFile: 'trap-kit/808-sub/pink---bouldercrest-808-1.wav', label: '808 SUB', sampler: LONG_808_SUB },
];

const KIT_REDD_BLOCK: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/redd-kick-14.wav', label: 'Redd kick', sampler: HEAVY_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Redd sn', sampler: TRAP_TIGHT_SNARE },
  { pad: 2, localFile: 'trap-kit/clap/jc---clap-2-1.wav', label: 'Clap', sampler: CLAP_HIT },
  { pad: 3, localFile: 'trap-kit/hihat/bz-redd-hihat.wav', label: 'CH redd' },
  { pad: 4, localFile: 'trap-kit/open-hat/bz-redd-op-hat.wav', label: 'OH' },
  { pad: 5, localFile: 'trap-kit/808-sub/redd-808-1.wav', label: '808 body', sampler: LONG_808_BODY },
  { pad: 6, localFile: 'trap-kit/kick/shawty-redd-sound-34.wav', label: 'Kick layer', sampler: CLICK_808 },
  { pad: 7, localFile: 'trap-kit/snare/snare-6.wav', label: 'Rim' },
  { pad: 8, localFile: 'trap-kit/perc2/shawty-redd-sound.wav', label: 'Block perc' },
  { pad: 9, localFile: 'trap-kit/clap/deedotluger-clap-3-1.wav', label: 'Clap 2', sampler: CLAP_STACK },
  { pad: 10, localFile: 'trap-kit/cymbal/deedotluger-crash-3-1.wav', label: 'Crash' },
  { pad: 11, localFile: 'trap-kit/cymbal/zay-cym-13.wav', label: 'Ride' },
  { pad: 12, localFile: 'trap-kit/hihat/shawty-redd-hat.wav', label: 'Hat shake' },
  { pad: 13, localFile: 'trap-kit/vox/shawty-redd-chant.wav', label: 'Chant hit' },
  { pad: 14, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Snap', sampler: { triggerSnap: 0.28 } },
  { pad: 15, localFile: 'trap-kit/808-sub/redd-808-1-1.wav', label: '808 SUB', sampler: LONG_808_SUB },
];

const KIT_TM88_NIGHT: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/deedotluger-kick-7.wav', label: '808 kick', sampler: LONG_808_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Trap sn', sampler: TRAP_TIGHT_SNARE },
  { pad: 2, localFile: 'trap-kit/clap/tm88-softclap.wav', label: 'TM clap', sampler: CLAP_HIT },
  { pad: 3, localFile: 'trap-kit/hihat/trapaholic-hihat-3.wav', label: 'CH' },
  { pad: 4, localFile: 'trap-kit/open-hat/ddw2-open-hat-6-1.wav', label: 'OH' },
  { pad: 5, localFile: 'trap-kit/808-sub/808-12-tm88.wav', label: '808 TM88', sampler: LONG_808_BODY },
  { pad: 6, localFile: 'trap-kit/kick/drumma-boy-kick.wav', label: 'Click layer', sampler: CLICK_808 },
  { pad: 7, localFile: 'trap-kit/perc2/tm88-zayxtm88snare.wav', label: 'TM perc', sampler: { triggerSnap: 0.3 } },
  { pad: 8, localFile: 'trap-kit/fx/cyborg-riser-1.wav', label: 'Riser' },
  { pad: 9, localFile: 'trap-kit/clap/trapaholic-clap-1-1.wav', label: 'Clap stack', sampler: CLAP_STACK },
  { pad: 10, localFile: 'trap-kit/cymbal/b.k-bangerz--orchestra-crash.wav', label: 'Orch crash' },
  { pad: 11, localFile: 'trap-kit/cymbal/ddw2-crash-1.wav', label: 'Cym' },
  { pad: 12, localFile: 'trap-kit/hihat/trapaholic-hihat-7.wav', label: 'Hat tight' },
  { pad: 13, localFile: 'trap-kit/vox/tm88-zaysvox.wav', label: 'Vox tag' },
  { pad: 14, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Snap sn', sampler: { triggerSnap: 0.26 } },
  { pad: 15, localFile: 'trap-kit/808-sub/808-12-tm88-1.wav', label: '808 SUB', sampler: LONG_808_SUB },
];

const KIT_TRUNK_SK: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/trunk-sk-14.wav', label: 'Trunk kick', sampler: LONG_808_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Trunk sn', sampler: TRAP_TIGHT_SNARE },
  { pad: 2, localFile: 'trap-kit/clap/trapaholic-clap-21-1.wav', label: 'Clap', sampler: CLAP_HIT },
  { pad: 3, localFile: 'trap-kit/hihat/ddw2-hat-1.wav', label: 'CH' },
  { pad: 4, localFile: 'trap-kit/open-hat/ddw2-open-hat-1-1.wav', label: 'OH' },
  { pad: 5, localFile: 'trap-kit/808-sub/trunk-808-1.wav', label: '808 trunk', sampler: LONG_808_BODY },
  { pad: 6, localFile: 'trap-kit/kick/cts_kick2.wav', label: 'Click 808', sampler: CLICK_808 },
  { pad: 7, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Rim trunk', sampler: { triggerSnap: 0.3 } },
  { pad: 8, localFile: 'trap-kit/808-sub/system-in-da-trunk-bass.wav', label: 'Trunk body' },
  { pad: 9, localFile: 'trap-kit/clap/deedotluger-clap-5.wav', label: 'Clap 2', sampler: CLAP_STACK },
  { pad: 10, localFile: 'trap-kit/cymbal/crash_lex-1.wav', label: 'Crash' },
  { pad: 11, localFile: 'trap-kit/cymbal/zay-cym-9.wav', label: 'Ride' },
  { pad: 12, localFile: 'trap-kit/perc2/bongo4-1.wav', label: 'Shaker' },
  { pad: 13, localFile: 'trap-kit/perc2/triangle-2-1.wav', label: 'Bell' },
  { pad: 14, localFile: 'trap-kit/snare/new-snare.wav', label: 'Snap', sampler: { triggerSnap: 0.28 } },
  { pad: 15, localFile: 'trap-kit/808-sub/system-in-da-trunk-bass-1.wav', label: '808 SUB', sampler: LONG_808_SUB },
];

const KIT_JC_STACK: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/deedotluger-kick-3.wav', label: 'DL kick', sampler: HEAVY_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'DL snare', sampler: TRAP_TIGHT_SNARE },
  { pad: 2, localFile: 'trap-kit/clap/clap-jc.wav', label: 'JC clap', sampler: CLAP_HIT },
  { pad: 3, localFile: 'trap-kit/hihat/deedotluger-hat-3.wav', label: 'CH' },
  { pad: 4, localFile: 'trap-kit/open-hat/deedotluger-open-hat-3.wav', label: 'OH' },
  { pad: 5, localFile: 'trap-kit/808-sub/deedotluger-808-10.wav', label: '808 body', sampler: LONG_808_BODY },
  { pad: 6, localFile: 'trap-kit/kick/deedotluger-kick-1.wav', label: 'Kick click', sampler: CLICK_808 },
  { pad: 7, localFile: 'trap-kit/snare/snare-54.wav', label: 'Rim' },
  { pad: 8, localFile: 'trap-kit/clap/jc---clap-1.wav', label: 'JC layer', sampler: CLAP_STACK },
  { pad: 9, localFile: 'trap-kit/clap/jc---clap-3.wav', label: 'Clap stack', sampler: CLAP_STACK },
  { pad: 10, localFile: 'trap-kit/cymbal/deedotluger-crash-3-1.wav', label: 'Crash' },
  { pad: 11, localFile: 'trap-kit/cymbal/deedotluger-crash-1-1.wav', label: 'Cym' },
  { pad: 12, localFile: 'trap-kit/hihat/deedotluger-hat-1-1.wav', label: 'Hat alt' },
  { pad: 13, localFile: 'trap-kit/fx/deedotluger-sfx-1.wav', label: 'SFX hit' },
  { pad: 14, localFile: 'trap-kit/clap/jc---clap-2.wav', label: 'Snap clap', sampler: { triggerSnap: 0.3 } },
  { pad: 15, localFile: 'trap-kit/808-sub/deedotluger-808-13.wav', label: '808 SUB', sampler: LONG_808_SUB },
];

const KIT_GUUD_SINE: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/rack-kick.wav', label: 'Clean kick', sampler: { triggerSnap: 0.35, fineSemi: 0 } },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Trap snare', sampler: { ...TRAP_TIGHT_SNARE, triggerSnap: 0.58, maxPlaySec: 0.16 } },
  { pad: 2, localFile: 'trap-kit/clap/trapaholic-clap-1-1.wav', label: 'Clap', sampler: CLAP_HIT },
  { pad: 3, localFile: 'trap-kit/hihat/trapaholic-hihat-3.wav', label: 'CH silk' },
  { pad: 4, localFile: 'trap-kit/open-hat/ddw2-open-hat-6-1.wav', label: 'OH air' },
  { pad: 5, localFile: 'trap-kit/808-sub/guud-sine-808.wav', label: 'Sine body', sampler: LONG_808_BODY },
  { pad: 6, localFile: 'trap-kit/kick/heavy-kick-lv1.wav', label: 'Kick punch', sampler: CLICK_808 },
  { pad: 7, localFile: 'trap-kit/snare/snare-6.wav', label: 'Rim ghost' },
  { pad: 8, localFile: 'trap-kit/808-sub/pure-sine-808.wav', label: 'Pure sine' },
  { pad: 9, localFile: 'trap-kit/clap/deedotluger-clap-8.wav', label: 'Clap soft', sampler: CLAP_STACK },
  { pad: 10, localFile: 'trap-kit/cymbal/ddw2-crash-1.wav', label: 'Crash' },
  { pad: 11, localFile: 'trap-kit/cymbal/zay-cym-2.wav', label: 'Ride' },
  { pad: 12, localFile: 'trap-kit/hihat/trapaholic-hihat-7.wav', label: 'Hat sparse' },
  { pad: 13, localFile: 'trap-kit/perc2/percs-6.wav', label: 'Perc' },
  { pad: 14, localFile: 'trap-kit/snare/solidasssnare.wav', label: 'Snap', sampler: { triggerSnap: 0.22 } },
  { pad: 15, localFile: 'trap-kit/808-sub/808-sine-king-1.wav', label: '808 SUB', sampler: LONG_808_SUB },
];

const KIT_NEGATIVE_FLOOR: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'trap-kit/kick/heavy-kick-lv1.wav', label: 'Floor kick', sampler: HEAVY_KICK },
  { pad: 1, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Dark sn', sampler: TRAP_TIGHT_SNARE },
  { pad: 2, localFile: 'trap-kit/clap/trapaholic-clap-14-1.wav', label: 'Clap', sampler: CLAP_HIT },
  { pad: 3, localFile: 'trap-kit/hihat/bedrock-hihat.wav', label: 'CH grim' },
  { pad: 4, localFile: 'trap-kit/open-hat/deedotluger-open-hat-6.wav', label: 'OH' },
  { pad: 5, localFile: 'trap-kit/808-sub/negative---808---sine---e.wav', label: '808 mud', sampler: LONG_808_BODY },
  { pad: 6, localFile: 'trap-kit/kick/trunk-sk-14.wav', label: 'Sub kick', sampler: { triggerSnap: 0.5, fineSemi: -4, lpHz: 3600 } },
  { pad: 7, localFile: 'trap-kit/perc2/perc---bedrock.wav', label: 'Floor perc' },
  { pad: 8, localFile: 'trap-kit/fx/pink-noise.wav', label: 'Noise bed' },
  { pad: 9, localFile: 'trap-kit/clap/deedotluger-clap-5.wav', label: 'Clap stack', sampler: CLAP_STACK },
  { pad: 10, localFile: 'trap-kit/cymbal/trap-crash-3.wav', label: 'Crash' },
  { pad: 11, localFile: 'trap-kit/cymbal/orch-crash-1.wav', label: 'Dark cym' },
  { pad: 12, localFile: 'trap-kit/hihat/bz-redd-hihat.wav', label: 'Hat low' },
  { pad: 13, localFile: 'trap-kit/perc2/perc---pink-hair.wav', label: 'Accent' },
  { pad: 14, localFile: 'trap-kit/snare/trapaholic-snare.wav', label: 'Sn layer', sampler: { triggerSnap: 0.24 } },
  { pad: 15, localFile: 'trap-kit/808-sub/808-1-c.wav', label: '808 SUB', sampler: LONG_808_SUB },
];

export const BEAT_LAB_STREET_TRAP_KIT_METAS: readonly BeatLabProducerKitMeta[] = [
  {
    id: 'trapStreetCyborgWoofer',
    title: 'Street · Cyborg Woofer',
    tribute: 'Hidden woofer sub — trunk kick, soft clap, cyborg 808 tail.',
    pads: KIT_CYBORG_WOOFER,
  },
  {
    id: 'trapStreetBedrockSlab',
    title: 'Street · Bedrock Slab',
    tribute: 'Bedrock hats + bam-bam 808 — slab stomp for the block.',
    pads: KIT_BEDROCK_SLAB,
  },
  {
    id: 'trapStreetZayTunnel',
    title: 'Street · Zay Tunnel',
    tribute: 'Rare kick + Zay 808 — tunnel bounce, bell accents.',
    pads: KIT_ZAY_TUNNEL,
  },
  {
    id: 'trapStreetPinkVault',
    title: 'Street · Pink Vault',
    tribute: 'Vault snare + bouldercrest 808 — dark pink street pocket.',
    pads: KIT_PINK_VAULT,
  },
  {
    id: 'trapStreetReddBlock',
    title: 'Street · Redd Block',
    tribute: 'Redd kick/snare stack — block bounce, chant perc.',
    pads: KIT_REDD_BLOCK,
  },
  {
    id: 'trapStreetTm88Night',
    title: 'Street · TM88 Night',
    tribute: 'TM88 808 + soft clap — late-night trunk feel.',
    pads: KIT_TM88_NIGHT,
  },
  {
    id: 'trapStreetTrunkSk',
    title: 'Street · Trunk SK',
    tribute: 'System-in-da-trunk sub — SK kick, dy-trunk snare.',
    pads: KIT_TRUNK_SK,
  },
  {
    id: 'trapStreetJcStack',
    title: 'Street · JC Stack',
    tribute: 'JC clap layers + deedot 808 — stacked backbeat pressure.',
    pads: KIT_JC_STACK,
  },
  {
    id: 'trapStreetGuudSine',
    title: 'Street · Guud Sine',
    tribute: 'Pure sine 808 hidden under clean kick — minimal street trap.',
    pads: KIT_GUUD_SINE,
  },
  {
    id: 'trapStreetNegativeFloor',
    title: 'Street · Negative Floor',
    tribute: 'Muddy negative sine sub — kryptic snare, floor stomp.',
    pads: KIT_NEGATIVE_FLOOR,
  },
];
