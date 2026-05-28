/**
 * 808 Lab kick & bass display names — shown as `808 Lab {createdName}` (no legacy flavor labels).
 */

/** Trap-hold synth kicks ({@link TRAP_HOLD_808_PRESETS} ids). */
export const LAB808_TRAP_KICK_CREATED_NAMES: Record<string, string> = {
  zayKnock: 'Brick Knock',
  zayHoldThump: 'Hold Thump',
  migosLean: 'Lean Thump',
  metroPunchHold: 'Punch Hold',
  southsideKnock: 'South Knock',
  atlTrapHold: 'ATL Hold',
  londonOnDeck: 'Deck Knock',
  flTrapThump: 'FL Thump',
  dirtySouthHold: 'Dirt Hold',
  scTrunkKnock: 'Trunk Hit',
  painHold808: 'Pain Hold',
  rackKnockHold: 'Rack Hold',
  nightShiftHold: 'Night Hold',
  trapDoorHold: 'Door Hold',
  zayStabShort: 'Stab Short',
  punchClassic: 'Punch Classic',
  drillSnap: 'Drill Snap',
  glassKnock: 'Glass Hit',
  clubHold: 'Club Hold',
  neonStab: 'Neon Stab',
  stadiumKnock: 'Stadium',
  velvetHold: 'Velvet',
  phantomKnock: 'Phantom',
  timberHard: 'Timber',
  boomBapThump: 'Boom Thump',
  ukTight: 'UK Tight',
  lofiKnock: 'Lo-Fi Knock',
};

/** MPC one-shot kicks (smpldsnds `relUrl` without base URL). */
export const LAB808_MPC_KICK_CREATED_NAMES: Record<string, string> = {
  'TR-808/kick/bd0000.m4a': 'Sub Core',
  '808-mini/kick.m4a': 'Mini Snap',
  'LM-2/kick.m4a': 'LM Pocket',
  'Roland-CR-8000/kick.m4a': 'CR Box',
};

export function lab808TrapKickCreatedName(presetId: string): string {
  return LAB808_TRAP_KICK_CREATED_NAMES[presetId] ?? 'Kick';
}

export function lab808MpcKickCreatedName(relUrl: string): string {
  return LAB808_MPC_KICK_CREATED_NAMES[relUrl] ?? 'Kick';
}

/** Bass Low synth presets ({@link BASS_LOW_BASS_PRESETS} ids). */
export const LAB808_BASS_CREATED_NAMES: Record<string, string> = {
  trapLowBass: 'Low Trap',
  pureSineLow: 'Pure Sine',
  sineGlide808: 'Glide Line',
  hipHopRider: 'Low Rider',
  migos808Line: 'Lean Line',
  metroSlideBass: 'Metro Slide',
  zayGlideBass: 'Glide Hold',
  southBassHold: 'South Hold',
  atlNightBass: 'Night Low',
  drillSubBass: 'Drill Sub',
  rnbSilkBass: 'Silk Bass',
  warmTriangle: 'Warm Tri',
  softSquareLow: 'Soft Square',
  filterSweepSine: 'Filter Sweep',
  gtrFinger: 'GTR Finger',
  gtrPick: 'GTR Pick',
  gtrFunk: 'GTR Funk',
  gtrUpright: 'GTR Upright',
  gtrMuted: 'GTR Muted',
  gtrReggae: 'GTR Reggae',
  gtrAcoustic: 'GTR Acoustic',
  gtrChorus: 'GTR Chorus',
  moogMini: 'MOOG Mini',
  moogTaurus: 'MOOG Taurus',
  moogClassic: 'MOOG Classic',
  moogFilter: 'MOOG Filter',
  moogDisco: 'MOOG Disco',
  moogBrass: 'MOOG Brass',
  moogRubber: 'MOOG Rubber',
  moogFatSub: 'MOOG Fat Sub',
};

export function lab808BassCreatedName(presetId: string): string {
  return LAB808_BASS_CREATED_NAMES[presetId] ?? 'Bass';
}
