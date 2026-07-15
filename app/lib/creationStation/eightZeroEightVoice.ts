import { resolveGrooveLabAudioDest } from '@/app/lib/creationStation/grooveLabAudio';
import { getSharedAudioOutput } from '@/app/lib/creationStation/sharedAudioOutput';

export type EightZeroEightWave = 'sine' | 'triangle' | 'square';

export interface EightZeroEightPresetDef {
  label: string;
  sweepStartHz: number;
  sweepMs: number;
  bodyDecaySec: number;
  subLevel: number;
  clickLevel: number;
  mainWave?: EightZeroEightWave;
  drive?: number;
  subMul?: number;
  clickHpHz?: number;
  /** Suggested filter starting points when this preset is selected (optional). */
  filterHpHz?: number;
  filterLpHz?: number;
}

/** HP/LP — same semantics as Beat Lab pad sample FX (`padSampleStorage`). */
export interface Lab808FilterFx {
  hpHz?: number;
  lpHz?: number;
}

export const LAB808_FILTER_DEFAULT: Lab808FilterFx = { hpHz: 0, lpHz: 0 };

/** Merge optional preset HP/LP hints into current filter (Creation Station / SE2 preset pickers). */
export function lab808MergePresetFilterHints(
  current: Lab808FilterFx,
  preset: EightZeroEightPresetDef,
): Lab808FilterFx {
  const next: Lab808FilterFx = { ...current };
  if (preset.filterHpHz != null && preset.filterHpHz >= 25) next.hpHz = preset.filterHpHz;
  else if (preset.filterHpHz === 0) next.hpHz = 0;
  if (preset.filterLpHz != null && preset.filterLpHz >= 200) next.lpHz = preset.filterLpHz;
  return next;
}

/** All roll 808s are tuned from C1 (MIDI 36) — matches a C-root piano roll. */
export const EIGHT_ZERO_EIGHT_KICK_ROOT_MIDI = 36;

/**
 * Drum-grid 808 tail: ~½–1 beat, capped ~220–520 ms (not multi-second sub tails).
 * Ref: punch kicks often under 150 ms; melodic 808 on a beat ~300–600 ms perceived sustain.
 */
export const KICK_KEYBOARD_TAIL_MIN_SEC = 0.22;
/** Short punch-kick cap on the grid. */
export const KICK_KEYBOARD_TAIL_MAX_SEC = 0.52;
/** Trap hold kicks — thump + audible tail, still kick register (not sub-bass length). */
export const KICK_TRAP_HOLD_TAIL_MAX_SEC = 0.72;
/** Bass Low lane — longer 808 bass notes + glide. */
export const BASS_LOW_TAIL_MAX_SEC = 1.12;
export const KICK_BASS_GLIDE_SEC = 0.062;
export const KICK_BASS_GLIDE_MAX_GAP_SEC = 0.2;
export const KICK_KEYBOARD_TRUNCATE_SEC = 0.014;

export type Lab808SoundLane = 'kick' | 'bass';

export interface EightZeroEightPlayExt {
  holdBeats: number;
  bpm: number;
  /** Applied to `midi` before pitch→Hz (negative = lower). Clamped to 0…127. */
  transposeSemi?: number;
  /**
   * One kick timbre on every key: body sweep + click only, pitch = MIDI chromatic.
   * (Sub layer off — use when mapping a single 808 kick across the piano roll.)
   */
  kickKeyboardMap?: boolean;
  /** When true (default for keyboard), a new key cuts the previous held note immediately. */
  kickMonophonic?: boolean;
  /** Strike strength 0…1 — harder = louder transient punch, sustain still follows. */
  velocity01?: number;
  /** Bass Low lanes: trap kick (punch) vs 808 bass (hold + glide). */
  soundLane?: Lab808SoundLane;
  /** Bass lane keyboard: sub oscillator only — no body pitch that reads as piano. */
  subOscOnly?: boolean;
  /** High-pass / low-pass (Beat Lab pad FX rules). */
  filterFx?: Lab808FilterFx;
  /** Optional output node (SE2 mixer strip). Default: shared creation/groove bus. */
  destination?: AudioNode;
}

/**
 * Trap 808 kicks: punch + hold in kick register.
 * Not SUB_808 tails — higher sweep, shorter decay than sub presets, still sustains on the grid.
 */
export const TRAP_HOLD_808_PRESETS = {
  zayKnock: { label: 'T knock', sweepStartHz: 205, sweepMs: 24, bodyDecaySec: 0.44, subLevel: 0.72, clickLevel: 0.3 },
  zayHoldThump: { label: 'T hold thump', sweepStartHz: 188, sweepMs: 28, bodyDecaySec: 0.5, subLevel: 0.76, clickLevel: 0.24 },
  migosLean: { label: 'M lean 808', sweepStartHz: 195, sweepMs: 26, bodyDecaySec: 0.42, subLevel: 0.7, clickLevel: 0.28 },
  metroPunchHold: { label: 'M punch hold', sweepStartHz: 228, sweepMs: 19, bodyDecaySec: 0.36, subLevel: 0.66, clickLevel: 0.36 },
  southsideKnock: { label: 'S knock', sweepStartHz: 212, sweepMs: 22, bodyDecaySec: 0.4, subLevel: 0.68, clickLevel: 0.32 },
  atlTrapHold: { label: 'A trap hold', sweepStartHz: 178, sweepMs: 30, bodyDecaySec: 0.48, subLevel: 0.74, clickLevel: 0.22 },
  londonOnDeck: { label: 'L on deck', sweepStartHz: 220, sweepMs: 21, bodyDecaySec: 0.38, subLevel: 0.65, clickLevel: 0.34 },
  flTrapThump: { label: 'F trap thump', sweepStartHz: 192, sweepMs: 27, bodyDecaySec: 0.45, subLevel: 0.71, clickLevel: 0.26 },
  dirtySouthHold: { label: 'D south hold', sweepStartHz: 168, sweepMs: 31, bodyDecaySec: 0.52, subLevel: 0.78, clickLevel: 0.2 },
  scTrunkKnock: { label: 'C trunk knock', sweepStartHz: 185, sweepMs: 25, bodyDecaySec: 0.46, subLevel: 0.73, clickLevel: 0.27 },
  painHold808: { label: 'Pain hold 808', sweepStartHz: 200, sweepMs: 26, bodyDecaySec: 0.43, subLevel: 0.69, clickLevel: 0.29 },
  rackKnockHold: { label: 'Rack knock hold', sweepStartHz: 235, sweepMs: 18, bodyDecaySec: 0.35, subLevel: 0.64, clickLevel: 0.38 },
  nightShiftHold: { label: 'Night shift hold', sweepStartHz: 175, sweepMs: 32, bodyDecaySec: 0.49, subLevel: 0.75, clickLevel: 0.21 },
  trapDoorHold: { label: 'Trap door hold', sweepStartHz: 165, sweepMs: 33, bodyDecaySec: 0.51, subLevel: 0.77, clickLevel: 0.19 },
  zayStabShort: { label: 'Zay stab short', sweepStartHz: 218, sweepMs: 17, bodyDecaySec: 0.34, subLevel: 0.62, clickLevel: 0.4 },
  punchClassic: { label: 'Punch classic', sweepStartHz: 220, sweepMs: 22, bodyDecaySec: 0.38, subLevel: 0.68, clickLevel: 0.34, filterLpHz: 12000 },
  drillSnap: { label: 'Drill snap', sweepStartHz: 240, sweepMs: 18, bodyDecaySec: 0.33, subLevel: 0.64, clickLevel: 0.38, filterLpHz: 10500 },
  glassKnock: { label: 'Glass knock', sweepStartHz: 215, sweepMs: 21, bodyDecaySec: 0.36, subLevel: 0.66, clickLevel: 0.36, filterLpHz: 14000 },
  clubHold: { label: 'Club hold', sweepStartHz: 190, sweepMs: 24, bodyDecaySec: 0.46, subLevel: 0.72, clickLevel: 0.28, filterLpHz: 9000 },
  neonStab: { label: 'Neon stab', sweepStartHz: 225, sweepMs: 19, bodyDecaySec: 0.34, subLevel: 0.62, clickLevel: 0.4, filterLpHz: 13500 },
  stadiumKnock: { label: 'Stadium knock', sweepStartHz: 200, sweepMs: 23, bodyDecaySec: 0.39, subLevel: 0.69, clickLevel: 0.31, filterLpHz: 11000 },
  velvetHold: { label: 'Velvet hold', sweepStartHz: 178, sweepMs: 30, bodyDecaySec: 0.5, subLevel: 0.76, clickLevel: 0.22, filterLpHz: 7500 },
  phantomKnock: { label: 'Phantom knock', sweepStartHz: 248, sweepMs: 16, bodyDecaySec: 0.32, subLevel: 0.6, clickLevel: 0.42, filterLpHz: 15000 },
  timberHard: { label: 'Timber hard', sweepStartHz: 232, sweepMs: 18, bodyDecaySec: 0.35, subLevel: 0.65, clickLevel: 0.37, filterHpHz: 35, filterLpHz: 12500 },
  boomBapThump: { label: 'Boom bap thump', sweepStartHz: 172, sweepMs: 31, bodyDecaySec: 0.47, subLevel: 0.75, clickLevel: 0.24, filterLpHz: 6800 },
  ukTight: { label: 'UK tight', sweepStartHz: 238, sweepMs: 17, bodyDecaySec: 0.33, subLevel: 0.63, clickLevel: 0.39, filterLpHz: 11500 },
  lofiKnock: { label: 'Lo-fi knock', sweepStartHz: 158, sweepMs: 33, bodyDecaySec: 0.49, subLevel: 0.77, clickLevel: 0.2, filterLpHz: 6200 },
} as const satisfies Record<string, EightZeroEightPresetDef>;

export type TrapHold808PresetId = keyof typeof TRAP_HOLD_808_PRESETS;
export const TRAP_HOLD_808_ORDER = Object.keys(TRAP_HOLD_808_PRESETS) as TrapHold808PresetId[];

/** Default trap hold kick for the lab roll (tune this before cloning the kit). */
export const LAB_MASTER_808_KICK: EightZeroEightPresetDef = TRAP_HOLD_808_PRESETS.zayKnock;

/**
 * Bass Low — sine 808 basslines: hold, glide, filter-friendly (trap / hip-hop).
 */
export const BASS_LOW_BASS_PRESETS = {
  trapLowBass: { label: 'Trap low bass', sweepStartHz: 118, sweepMs: 40, bodyDecaySec: 0.88, subLevel: 0.96, clickLevel: 0.07, mainWave: 'sine', filterLpHz: 4200 },
  pureSineLow: { label: 'Pure sine low', sweepStartHz: 105, sweepMs: 44, bodyDecaySec: 0.92, subLevel: 0.98, clickLevel: 0.04, mainWave: 'sine', filterLpHz: 3800 },
  sineGlide808: { label: 'Sine glide 808', sweepStartHz: 122, sweepMs: 38, bodyDecaySec: 0.82, subLevel: 0.94, clickLevel: 0.08, mainWave: 'sine', filterLpHz: 4500 },
  hipHopRider: { label: 'Hip-hop low rider', sweepStartHz: 102, sweepMs: 44, bodyDecaySec: 0.95, subLevel: 0.98, clickLevel: 0.05, mainWave: 'sine', filterLpHz: 3600 },
  migos808Line: { label: 'Migos 808 line', sweepStartHz: 125, sweepMs: 38, bodyDecaySec: 0.8, subLevel: 0.93, clickLevel: 0.09, mainWave: 'sine', filterLpHz: 4800 },
  metroSlideBass: { label: 'Metro slide bass', sweepStartHz: 132, sweepMs: 34, bodyDecaySec: 0.72, subLevel: 0.9, clickLevel: 0.11, mainWave: 'sine', filterLpHz: 5200 },
  zayGlideBass: { label: 'Zay glide bass', sweepStartHz: 112, sweepMs: 42, bodyDecaySec: 0.92, subLevel: 0.97, clickLevel: 0.06, mainWave: 'sine', filterLpHz: 4000 },
  southBassHold: { label: 'Southside bass hold', sweepStartHz: 108, sweepMs: 46, bodyDecaySec: 0.98, subLevel: 0.99, clickLevel: 0.05, mainWave: 'sine', filterLpHz: 3400 },
  atlNightBass: { label: 'ATL night bass', sweepStartHz: 98, sweepMs: 48, bodyDecaySec: 1.02, subLevel: 1, clickLevel: 0.04, mainWave: 'sine', filterLpHz: 3200 },
  drillSubBass: { label: 'Drill sub-bass', sweepStartHz: 95, sweepMs: 36, bodyDecaySec: 0.68, subLevel: 0.88, clickLevel: 0.12, mainWave: 'sine', filterLpHz: 2800 },
  rnbSilkBass: { label: 'R&B silk bass', sweepStartHz: 115, sweepMs: 41, bodyDecaySec: 0.9, subLevel: 0.95, clickLevel: 0.07, mainWave: 'sine', filterLpHz: 4400 },
  warmTriangle: { label: 'Warm triangle', sweepStartHz: 110, sweepMs: 42, bodyDecaySec: 0.86, subLevel: 0.92, clickLevel: 0.08, mainWave: 'triangle', filterLpHz: 4100 },
  softSquareLow: { label: 'Soft square low', sweepStartHz: 120, sweepMs: 39, bodyDecaySec: 0.78, subLevel: 0.9, clickLevel: 0.1, mainWave: 'square', filterLpHz: 3600, drive: 0.12 },
  filterSweepSine: { label: 'Filter sweep sine', sweepStartHz: 128, sweepMs: 36, bodyDecaySec: 0.84, subLevel: 0.94, clickLevel: 0.06, mainWave: 'sine', filterLpHz: 2400 },
  /** Fingerstyle / electric bass guitar — pluck attack, mid decay, guitar-range filter. */
  gtrFinger: {
    label: 'Fingerstyle electric',
    sweepStartHz: 145,
    sweepMs: 28,
    bodyDecaySec: 0.68,
    subLevel: 0.9,
    clickLevel: 0.28,
    mainWave: 'triangle',
    filterLpHz: 4500,
    filterHpHz: 32,
  },
  gtrPick: {
    label: 'Pick rock bass',
    sweepStartHz: 155,
    sweepMs: 24,
    bodyDecaySec: 0.62,
    subLevel: 0.88,
    clickLevel: 0.34,
    mainWave: 'triangle',
    filterLpHz: 4000,
    drive: 0.1,
  },
  gtrFunk: {
    label: 'Funk slap',
    sweepStartHz: 168,
    sweepMs: 20,
    bodyDecaySec: 0.52,
    subLevel: 0.86,
    clickLevel: 0.38,
    mainWave: 'triangle',
    filterLpHz: 5200,
  },
  gtrUpright: {
    label: 'Upright jazz',
    sweepStartHz: 128,
    sweepMs: 34,
    bodyDecaySec: 0.72,
    subLevel: 0.92,
    clickLevel: 0.22,
    mainWave: 'sine',
    filterLpHz: 3200,
    filterHpHz: 30,
  },
  gtrMuted: {
    label: 'Muted palm',
    sweepStartHz: 138,
    sweepMs: 26,
    bodyDecaySec: 0.56,
    subLevel: 0.88,
    clickLevel: 0.3,
    mainWave: 'triangle',
    filterLpHz: 2400,
    filterHpHz: 28,
  },
  gtrReggae: {
    label: 'Reggae upstroke',
    sweepStartHz: 132,
    sweepMs: 30,
    bodyDecaySec: 0.64,
    subLevel: 0.9,
    clickLevel: 0.24,
    mainWave: 'sine',
    filterLpHz: 3800,
  },
  gtrAcoustic: {
    label: 'Acoustic bass',
    sweepStartHz: 122,
    sweepMs: 32,
    bodyDecaySec: 0.66,
    subLevel: 0.92,
    clickLevel: 0.26,
    mainWave: 'triangle',
    filterLpHz: 3400,
  },
  gtrChorus: {
    label: 'Chorus bass',
    sweepStartHz: 118,
    sweepMs: 30,
    bodyDecaySec: 0.74,
    subLevel: 0.9,
    clickLevel: 0.23,
    mainWave: 'triangle',
    filterLpHz: 4800,
    drive: 0.06,
  },
  /** Moog-style monosynth bass — square + drive + low-pass sweep. */
  moogMini: {
    label: 'Minimoog bass',
    sweepStartHz: 92,
    sweepMs: 52,
    bodyDecaySec: 0.78,
    subLevel: 0.9,
    clickLevel: 0.14,
    mainWave: 'square',
    filterLpHz: 1650,
    drive: 0.32,
  },
  moogTaurus: {
    label: 'Taurus pedal',
    sweepStartHz: 85,
    sweepMs: 58,
    bodyDecaySec: 0.9,
    subLevel: 0.92,
    clickLevel: 0.1,
    mainWave: 'square',
    filterLpHz: 1350,
    drive: 0.38,
  },
  moogClassic: {
    label: 'Classic Moog',
    sweepStartHz: 98,
    sweepMs: 48,
    bodyDecaySec: 0.72,
    subLevel: 0.88,
    clickLevel: 0.12,
    mainWave: 'square',
    filterLpHz: 1900,
    drive: 0.28,
  },
  moogFilter: {
    label: 'Filter sweep Moog',
    sweepStartHz: 115,
    sweepMs: 62,
    bodyDecaySec: 0.85,
    subLevel: 0.91,
    clickLevel: 0.08,
    mainWave: 'square',
    filterLpHz: 1100,
    drive: 0.25,
  },
  moogDisco: {
    label: 'Disco Moog',
    sweepStartHz: 108,
    sweepMs: 44,
    bodyDecaySec: 0.58,
    subLevel: 0.86,
    clickLevel: 0.18,
    mainWave: 'square',
    filterLpHz: 2100,
    drive: 0.3,
  },
  moogBrass: {
    label: 'Brass Moog',
    sweepStartHz: 112,
    sweepMs: 40,
    bodyDecaySec: 0.64,
    subLevel: 0.87,
    clickLevel: 0.15,
    mainWave: 'square',
    filterLpHz: 2400,
    drive: 0.22,
  },
  moogRubber: {
    label: 'Rubber Moog',
    sweepStartHz: 78,
    sweepMs: 68,
    bodyDecaySec: 0.96,
    subLevel: 0.94,
    clickLevel: 0.09,
    mainWave: 'square',
    filterLpHz: 1050,
    drive: 0.42,
  },
  moogFatSub: {
    label: 'Fat Moog sub',
    sweepStartHz: 72,
    sweepMs: 72,
    bodyDecaySec: 1.02,
    subLevel: 0.96,
    clickLevel: 0.07,
    mainWave: 'square',
    filterLpHz: 880,
    drive: 0.4,
  },
} as const satisfies Record<string, EightZeroEightPresetDef>;

export type BassLowBassPresetId = keyof typeof BASS_LOW_BASS_PRESETS;
export const BASS_LOW_BASS_ORDER = Object.keys(BASS_LOW_BASS_PRESETS) as BassLowBassPresetId[];

export const LAB_MASTER_808_BASS: EightZeroEightPresetDef = BASS_LOW_BASS_PRESETS.trapLowBass;

/** @deprecated Use `BASS_LOW_BASS_PRESETS` */
export const BASS_DRAGON_BASS_PRESETS = BASS_LOW_BASS_PRESETS;
/** @deprecated Use `BassLowBassPresetId` */
export type BassDragonBassPresetId = BassLowBassPresetId;
/** @deprecated Use `BASS_LOW_BASS_ORDER` */
export const BASS_DRAGON_BASS_ORDER = BASS_LOW_BASS_ORDER;

/** Map pointer pressure / force to 0…1 strike (touch-sensitive keys). */
export function pointerStrikeVelocity(e: { pressure: number; pointerType: string; force?: number }): number {
  const p = e.pressure;
  if (p > 0 && Math.abs(p - 0.5) > 0.02) {
    return clamp(0.3 + p * 0.7, 0.3, 1);
  }
  const f = e.force;
  if (typeof f === 'number' && f > 0) {
    return clamp(0.3 + Math.min(1, f) * 0.7, 0.3, 1);
  }
  return e.pointerType === 'mouse' ? 0.88 : 0.78;
}

type KickVoiceHandle = { stop: (whenSec: number) => void };
let activeKickVoice: KickVoiceHandle | null = null;
let lastKeyboardMidi: number | null = null;
let lastKeyboardTime = 0;

/** All live / lookahead-scheduled 808 voices — cut on Stop (mirrors orchestra halt). */
const active808Sources = new Set<AudioScheduledSourceNode>();
const active808Gains = new Set<GainNode>();

function trackEightZeroEightVoice(
  sources: readonly AudioScheduledSourceNode[],
  muteGain: GainNode,
): void {
  active808Gains.add(muteGain);
  let remaining = sources.length;
  if (remaining === 0) return;
  for (const src of sources) {
    active808Sources.add(src);
    const prev = src.onended;
    src.onended = (ev) => {
      active808Sources.delete(src);
      remaining -= 1;
      if (remaining <= 0) active808Gains.delete(muteGain);
      if (typeof prev === 'function') prev.call(src, ev);
    };
  }
}

/** Cut the currently playing keyboard 808 (fast choke ~14 ms). */
export function truncateKickKeyboardVoice(ctx: AudioContext, whenSec = ctx.currentTime): void {
  if (!activeKickVoice) return;
  activeKickVoice.stop(whenSec);
  activeKickVoice = null;
}

/** Cut ringing + lookahead-scheduled 808 Lab / keyboard voices (Stop). */
export function haltEightZeroEightPlayback(ctx?: AudioContext | null): void {
  activeKickVoice = null;
  lastKeyboardMidi = null;
  lastKeyboardTime = 0;
  const now = ctx && ctx.state !== 'closed' ? ctx.currentTime : 0;
  for (const gain of [...active808Gains]) {
    try {
      if (ctx && ctx.state !== 'closed' && gain.context === ctx) {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0, now);
      }
    } catch {
      /* */
    }
    try {
      gain.disconnect();
    } catch {
      /* */
    }
  }
  active808Gains.clear();
  for (const src of [...active808Sources]) {
    try {
      src.stop(now);
    } catch {
      try {
        src.stop();
      } catch {
        /* */
      }
    }
    try {
      src.disconnect();
    } catch {
      /* */
    }
  }
  active808Sources.clear();
}

/** Snap keyboard window so the lowest visible row is always a C (pitch class 0). */
export function snap808RollBaseToC(baseMidi: number, keySpan: number): number {
  const pc = ((baseMidi % 12) + 12) % 12;
  const snapped = baseMidi - pc;
  return Math.max(0, Math.min(snapped, 127 - keySpan));
}

function kickDrumTailSec(holdSec: number, bpm: number): number {
  const beatSec = bpm > 0 ? 60 / bpm : 0.5;
  const target = holdSec > 0 ? holdSec : beatSec;
  return clamp(target, KICK_KEYBOARD_TAIL_MIN_SEC, KICK_KEYBOARD_TAIL_MAX_SEC);
}

/** Trap hold: preset decay drives tail length (thump stays in kick range, not sub mud). */
function kickTrapHoldTailSec(holdSec: number, bpm: number, preset: EightZeroEightPresetDef): number {
  const beatTail = kickDrumTailSec(holdSec, bpm);
  const presetTail = clamp(preset.bodyDecaySec, KICK_KEYBOARD_TAIL_MIN_SEC, KICK_TRAP_HOLD_TAIL_MAX_SEC);
  return clamp(Math.max(beatTail, presetTail * 0.94), KICK_KEYBOARD_TAIL_MIN_SEC, KICK_TRAP_HOLD_TAIL_MAX_SEC);
}

function bassLowTailSec(holdSec: number, bpm: number, preset: EightZeroEightPresetDef): number {
  const beatSec = bpm > 0 ? 60 / bpm : 0.5;
  const beatTail = holdSec > 0 ? holdSec : beatSec * 1.25;
  const presetTail = clamp(preset.bodyDecaySec, 0.42, BASS_LOW_TAIL_MAX_SEC);
  return clamp(Math.max(beatTail, presetTail * 0.9), 0.42, BASS_LOW_TAIL_MAX_SEC);
}

function connectLab808OutputChain(
  ctx: AudioContext,
  source: AudioNode,
  dest: AudioNode,
  t0: number,
  filterFx?: Lab808FilterFx,
): AudioNode {
  const ny = ctx.sampleRate * 0.45;
  let node: AudioNode = source;
  const hpHz = filterFx?.hpHz ?? 0;
  if (hpHz >= 25) {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(Math.min(hpHz, ny), t0);
    hp.Q.setValueAtTime(0.7, t0);
    node.connect(hp);
    node = hp;
  }
  const lpHz = filterFx?.lpHz ?? 0;
  if (lpHz >= 200 && lpHz < 19900) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(lpHz, ny), t0);
    lp.Q.setValueAtTime(0.85, t0);
    node.connect(lp);
    node = lp;
  }
  node.connect(dest);
  return node;
}

export function merge808BodyAndSub(body: EightZeroEightPresetDef, sub: EightZeroEightPresetDef): EightZeroEightPresetDef {
  return {
    label: `${body.label} + ${sub.label}`,
    sweepStartHz: body.sweepStartHz,
    sweepMs: body.sweepMs,
    bodyDecaySec: Math.max(body.bodyDecaySec, sub.bodyDecaySec * 1.08),
    subLevel: Math.min(1, body.subLevel + sub.subLevel * 0.42),
    clickLevel: body.clickLevel,
    mainWave: body.mainWave ?? sub.mainWave,
    drive: Math.max(body.drive ?? 0, (sub.drive ?? 0) * 0.65),
    subMul: sub.subMul ?? body.subMul ?? 0.5,
    clickHpHz: body.clickHpHz ?? sub.clickHpHz,
  };
}

export const EIGHT_ZERO_EIGHT_PRESETS = {
  classic: { label: 'Classic 808', sweepStartHz: 180, sweepMs: 28, bodyDecaySec: 0.42, subLevel: 0.78, clickLevel: 0.22 },
  punch: { label: 'Punch 808', sweepStartHz: 220, sweepMs: 22, bodyDecaySec: 0.32, subLevel: 0.7, clickLevel: 0.32 },
  trapDoor: { label: 'Trap door', sweepStartHz: 160, sweepMs: 32, bodyDecaySec: 0.38, subLevel: 0.82, clickLevel: 0.18 },
  drillPunch: { label: 'Drill punch', sweepStartHz: 240, sweepMs: 18, bodyDecaySec: 0.28, subLevel: 0.62, clickLevel: 0.38 },
  brick: { label: 'Brick', sweepStartHz: 140, sweepMs: 36, bodyDecaySec: 0.45, subLevel: 0.86, clickLevel: 0.14 },
  westKnock: { label: 'West knock', sweepStartHz: 200, sweepMs: 26, bodyDecaySec: 0.36, subLevel: 0.74, clickLevel: 0.26 },
  clickKick: { label: 'Click kick', sweepStartHz: 260, sweepMs: 16, bodyDecaySec: 0.24, subLevel: 0.55, clickLevel: 0.45 },
  tightCone: { label: 'Tight cone', sweepStartHz: 210, sweepMs: 20, bodyDecaySec: 0.3, subLevel: 0.68, clickLevel: 0.32 },
  lofiThud: { label: 'Lo-fi thud', sweepStartHz: 150, sweepMs: 34, bodyDecaySec: 0.48, subLevel: 0.8, clickLevel: 0.2 },
  clubThump: { label: 'Club thump', sweepStartHz: 190, sweepMs: 24, bodyDecaySec: 0.34, subLevel: 0.72, clickLevel: 0.28 },
  twoStepBump: { label: '2-step bump', sweepStartHz: 175, sweepMs: 30, bodyDecaySec: 0.4, subLevel: 0.76, clickLevel: 0.24 },
  zayBump: { label: 'Zay bump', sweepStartHz: 165, sweepMs: 30, bodyDecaySec: 0.44, subLevel: 0.8, clickLevel: 0.2 },
  miamiSub: { label: 'Up tempo sub', sweepStartHz: 155, sweepMs: 32, bodyDecaySec: 0.46, subLevel: 0.84, clickLevel: 0.16 },
  hump: { label: 'Hump', sweepStartHz: 185, sweepMs: 26, bodyDecaySec: 0.37, subLevel: 0.73, clickLevel: 0.27 },
  slapBack: { label: 'Slap back', sweepStartHz: 230, sweepMs: 20, bodyDecaySec: 0.3, subLevel: 0.66, clickLevel: 0.34 },
  rubberBand: { label: 'Rubber band', sweepStartHz: 170, sweepMs: 30, bodyDecaySec: 0.42, subLevel: 0.78, clickLevel: 0.22 },
  ghost808: { label: 'Ghost 808', sweepStartHz: 195, sweepMs: 24, bodyDecaySec: 0.35, subLevel: 0.7, clickLevel: 0.3 },
  tapeWarp: { label: 'Tape warp', sweepStartHz: 205, sweepMs: 26, bodyDecaySec: 0.38, subLevel: 0.74, clickLevel: 0.26 },
  tube808: { label: 'Tube 808', sweepStartHz: 188, sweepMs: 25, bodyDecaySec: 0.36, subLevel: 0.72, clickLevel: 0.28 },
  glass808: { label: 'Glass 808', sweepStartHz: 215, sweepMs: 21, bodyDecaySec: 0.31, subLevel: 0.64, clickLevel: 0.36 },
  neonCone: { label: 'Neon cone', sweepStartHz: 225, sweepMs: 19, bodyDecaySec: 0.29, subLevel: 0.6, clickLevel: 0.4 },
  velvet808: { label: 'Velvet 808', sweepStartHz: 178, sweepMs: 28, bodyDecaySec: 0.41, subLevel: 0.77, clickLevel: 0.23 },
  stadium808: { label: 'Stadium 808', sweepStartHz: 200, sweepMs: 23, bodyDecaySec: 0.33, subLevel: 0.69, clickLevel: 0.31 },
  sidechain808: { label: 'Sidechain 808', sweepStartHz: 192, sweepMs: 25, bodyDecaySec: 0.35, subLevel: 0.71, clickLevel: 0.29 },
  distorted808: { label: 'Distorted 808', sweepStartHz: 210, sweepMs: 22, bodyDecaySec: 0.32, subLevel: 0.68, clickLevel: 0.32, drive: 0.35 },
  square808: { label: 'Square 808', sweepStartHz: 205, sweepMs: 23, bodyDecaySec: 0.33, subLevel: 0.7, clickLevel: 0.3, mainWave: 'square' },
  triangle808: { label: 'Triangle 808', sweepStartHz: 198, sweepMs: 24, bodyDecaySec: 0.34, subLevel: 0.72, clickLevel: 0.28, mainWave: 'triangle' },
  sine808: { label: 'Sine 808', sweepStartHz: 190, sweepMs: 26, bodyDecaySec: 0.36, subLevel: 0.75, clickLevel: 0.25, mainWave: 'sine' },
  clicky808: { label: 'Clicky 808', sweepStartHz: 250, sweepMs: 17, bodyDecaySec: 0.26, subLevel: 0.58, clickLevel: 0.42, clickHpHz: 900 },
  subMul808: { label: 'Sub mul 808', sweepStartHz: 175, sweepMs: 28, bodyDecaySec: 0.4, subLevel: 0.8, clickLevel: 0.2, subMul: 0.35 },
} as const satisfies Record<string, EightZeroEightPresetDef>;

export type EightZeroEightPresetId = keyof typeof EIGHT_ZERO_EIGHT_PRESETS;
export const EIGHT_ZERO_EIGHT_PRESET_ORDER = Object.keys(EIGHT_ZERO_EIGHT_PRESETS) as EightZeroEightPresetId[];

export const SUB_808_PRESETS = {
  subVelvet: { label: 'Velvet hold', sweepStartHz: 100, sweepMs: 40, bodyDecaySec: 1.55, subLevel: 0.98, clickLevel: 0.03 },
  subCathedral: { label: 'Cathedral sub', sweepStartHz: 78, sweepMs: 55, bodyDecaySec: 1.72, subLevel: 1, clickLevel: 0.02 },
  subMelt: { label: 'Slow melt', sweepStartHz: 92, sweepMs: 62, bodyDecaySec: 1.45, subLevel: 0.92, clickLevel: 0.04 },
  subTectonic: { label: 'Tectonic roll', sweepStartHz: 68, sweepMs: 72, bodyDecaySec: 1.68, subLevel: 1, clickLevel: 0.02 },
  subHaze: { label: 'Haze tail', sweepStartHz: 125, sweepMs: 44, bodyDecaySec: 1.38, subLevel: 0.88, clickLevel: 0.05 },
  subPool: { label: 'Deep pool', sweepStartHz: 58, sweepMs: 78, bodyDecaySec: 1.82, subLevel: 1, clickLevel: 0.02 },
  subRibbon: { label: 'Ribbon sustain', sweepStartHz: 110, sweepMs: 48, bodyDecaySec: 1.5, subLevel: 0.9, clickLevel: 0.04 },
  subMammoth: { label: 'Mammoth low', sweepStartHz: 52, sweepMs: 80, bodyDecaySec: 1.9, subLevel: 1, clickLevel: 0.02 },
  subGlow: { label: 'Glow sustain', sweepStartHz: 135, sweepMs: 42, bodyDecaySec: 1.28, subLevel: 0.86, clickLevel: 0.05 },
  subDrift: { label: 'Drift tail', sweepStartHz: 88, sweepMs: 58, bodyDecaySec: 1.58, subLevel: 0.95, clickLevel: 0.03 },
  subAbyss: { label: 'Abyss', sweepStartHz: 48, sweepMs: 88, bodyDecaySec: 1.95, subLevel: 1, clickLevel: 0.015 },
  subLoom: { label: 'Loom', sweepStartHz: 102, sweepMs: 50, bodyDecaySec: 1.42, subLevel: 0.93, clickLevel: 0.04 },
  subPlush: { label: 'Plush pillow', sweepStartHz: 115, sweepMs: 46, bodyDecaySec: 1.35, subLevel: 0.9, clickLevel: 0.05 },
  subWool: { label: 'Wool blanket', sweepStartHz: 95, sweepMs: 52, bodyDecaySec: 1.48, subLevel: 0.94, clickLevel: 0.035 },
  subTide: { label: 'Low tide', sweepStartHz: 72, sweepMs: 68, bodyDecaySec: 1.62, subLevel: 0.98, clickLevel: 0.025 },
  subMonolith: { label: 'Monolith', sweepStartHz: 60, sweepMs: 76, bodyDecaySec: 1.78, subLevel: 1, clickLevel: 0.02 },
  subSilk: { label: 'Silk runout', sweepStartHz: 128, sweepMs: 38, bodyDecaySec: 1.22, subLevel: 0.84, clickLevel: 0.055 },
  subGravity: { label: 'Gravity well', sweepStartHz: 82, sweepMs: 60, bodyDecaySec: 1.52, subLevel: 0.96, clickLevel: 0.03 },
  subAfterglow: { label: 'Afterglow', sweepStartHz: 118, sweepMs: 46, bodyDecaySec: 1.4, subLevel: 0.91, clickLevel: 0.04 },
} as const satisfies Record<string, EightZeroEightPresetDef>;

export type EightZeroEightSubPresetId = keyof typeof SUB_808_PRESETS;
export const SUB_808_PRESET_ORDER = Object.keys(SUB_808_PRESETS) as EightZeroEightSubPresetId[];

/** Long-tail 808s for piano-roll keys (lingering sub, not punch kicks). Longest hold first. */
export const EIGHT_ZERO_EIGHT_HOLD_KICK_ORDER = (
  [...SUB_808_PRESET_ORDER] as EightZeroEightSubPresetId[]
).sort((a, b) => SUB_808_PRESETS[b].bodyDecaySec - SUB_808_PRESETS[a].bodyDecaySec);

export type EightZeroEightHoldKickPresetId = (typeof EIGHT_ZERO_EIGHT_HOLD_KICK_ORDER)[number];

export const EIGHT_ZERO_EIGHT_BODY_PRESET_ORDER = [
  'classic',
  'punch',
  'trapDoor',
  'drillPunch',
  'brick',
  'westKnock',
  'clickKick',
  'tightCone',
  'lofiThud',
  'clubThump',
  'twoStepBump',
  'zayBump',
  'miamiSub',
  'hump',
  'slapBack',
] as const satisfies readonly EightZeroEightPresetId[];

export type EightZeroEightBodyPresetId = (typeof EIGHT_ZERO_EIGHT_BODY_PRESET_ORDER)[number];

function midiToHz(m: number): number {
  return 440 * 2 ** ((m - 69) / 12);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function softClip(x: number): number {
  const t = Math.abs(x);
  return Math.sign(x) * (t / (1 + t * 0.55));
}

/** Schedules one 808 hit on `ctx` using a preset definition (often merged body + sub). */
export function playEightZeroEight(
  ctx: AudioContext,
  whenSec: number,
  midi: number,
  preset: EightZeroEightPresetDef,
  gain = 0.9,
  ext?: EightZeroEightPlayExt,
): void {
  const t0 = whenSec;
  const midiEff = clamp(midi + (ext?.transposeSemi ?? 0), 0, 127);
  const hz0 = midiToHz(midiEff);
  const ny = ctx.sampleRate * 0.45;
  const kickMap = ext?.kickKeyboardMap === true;
  const lane: Lab808SoundLane = ext?.soundLane ?? 'kick';
  const isBassLane = lane === 'bass';
  const strike = clamp(ext?.velocity01 ?? 1, 0.05, 1);
  const outGain = gain * (0.34 + strike * 0.66);
  const hzRef = midiToHz(EIGHT_ZERO_EIGHT_KICK_ROOT_MIDI);

  let hzEnd: number;
  let hz1: number;
  let hzSub: number;
  let includeSub: boolean;
  let clickGainMul: number;

  if (kickMap) {
    /**
     * Chromatic hold at `hz0`. Kick lane: pitch *drop* into the note using
     * `preset.sweepStartHz` (main timbral difference between trap presets).
     * Bass lane: soft rise into the held sub (wave / filter / click carry character).
     */
    hzEnd = clamp(hz0, 18, ny);
    hzSub = hz0;
    includeSub = true;
    const pitchRatio = clamp(hz0 / hzRef, 0.35, 2.4);
    if (isBassLane) {
      hz1 = clamp(preset.sweepStartHz * pitchRatio * 0.42, 12, Math.min(ny * 0.16, hzEnd * 0.88));
      if (!(hz1 < hzEnd)) hz1 = hzEnd * 0.72;
    } else {
      const startHz = clamp(preset.sweepStartHz * pitchRatio, hzEnd * 1.15, ny * 0.42);
      hz1 = startHz;
      if (!(hz1 > hzEnd)) {
        hz1 = clamp(hzEnd * (1.25 + (preset.sweepStartHz / 260) * 0.85), hzEnd * 1.1, ny * 0.4);
      }
    }
    const pitchMul = Math.sqrt(clamp(hz0 / hzRef, 0.45, 1.9));
    clickGainMul = isBassLane
      ? (0.06 + strike * 0.28) * pitchMul
      : (0.2 + strike * 0.95) * pitchMul;
  } else {
    const tint = preset.sweepStartHz * 0.1;
    hzEnd = hz0 * 1.55 + tint;
    hz1 = hz0 * 0.38;
    if (hz1 * 1.14 >= hzEnd) hzEnd = Math.max(hz1 * 1.2, hz0 * 1.12);
    hzEnd = clamp(hzEnd, 22, ny);
    hz1 = clamp(hz1, 12, Math.min(ny * 0.22, hzEnd * 0.58, hz0 * 0.62));
    if (!(hz1 < hzEnd)) hz1 = hzEnd * 0.34;
    const subMul = preset.subMul ?? 0.5;
    hzSub = clamp(hz0 * subMul, 10, Math.min(380, ny * 0.2));
    includeSub = true;
    clickGainMul = 1;
  }

  const bpmPlay = ext?.bpm ?? 120;
  const holdSec =
    ext && ext.holdBeats > 0 && ext.bpm > 0 ? Math.max(0, (ext.holdBeats * 60) / ext.bpm) : 0;

  const sweepDur = kickMap
    ? clamp((preset.sweepMs / 1000) * (1.18 - strike * 0.42), 0.012, 0.1)
    : clamp(preset.sweepMs / 1000, 0.005, 0.12);

  let bodyDur: number;
  let tailPad: number;
  if (kickMap) {
    const tailSec = isBassLane
      ? bassLowTailSec(holdSec, bpmPlay, preset)
      : kickTrapHoldTailSec(holdSec, bpmPlay, preset);
    bodyDur = 0.05 + tailSec * (isBassLane ? 0.32 : 0.38);
    tailPad = tailSec * (isBassLane ? 0.68 : 0.62);
  } else {
    bodyDur = clamp(preset.bodyDecaySec, 0.02, 2.5);
    tailPad = holdSec > 0 ? Math.min(1.35, holdSec * 0.38) : 0;
  }

  const clickHp = preset.clickHpHz ?? 650;
  const sustainEnd = t0 + sweepDur + bodyDur + (kickMap ? tailPad : 0);
  const tEnd = sustainEnd + (kickMap ? 0.06 : 0.02);

  if (kickMap && ext?.kickMonophonic !== false) {
    truncateKickKeyboardVoice(ctx, t0);
  }

  const kickBus = kickMap ? ctx.createGain() : null;
  const sharedDest = ext?.destination ?? resolveGrooveLabAudioDest(ctx);
  if (kickBus) {
    kickBus.gain.value = 1;
    kickBus.connect(sharedDest);
  }

  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(outGain, t0 + 0.004);
  if (kickMap) {
    master.gain.setValueAtTime(outGain, t0 + 0.004);
    master.gain.setValueAtTime(outGain * 0.9, sustainEnd - 0.06);
    master.gain.exponentialRampToValueAtTime(0.0001, tEnd);
  } else {
    master.gain.exponentialRampToValueAtTime(0.0001, tEnd);
  }
  const outDest = kickBus ?? sharedDest;

  const stoppable: AudioScheduledSourceNode[] = [];

  const subOscOnly = kickMap && isBassLane && ext?.subOscOnly !== false;

  if (!subOscOnly) {
    const bodyOsc = ctx.createOscillator();
    bodyOsc.type = kickMap && isBassLane ? (preset.mainWave ?? 'sine') : 'sine';
    bodyOsc.frequency.setValueAtTime(hz1, t0);
    bodyOsc.frequency.exponentialRampToValueAtTime(hzEnd, t0 + sweepDur);

    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, t0);
    const bodyPeak = kickMap ? (isBassLane ? 0.12 + strike * 0.32 : 0.16 + strike * 0.48) : 0.85;
    const bodyFadeT = kickMap ? t0 + sweepDur + 0.07 : t0 + sweepDur + bodyDur;
    bodyGain.gain.exponentialRampToValueAtTime(bodyPeak, t0 + 0.003);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, bodyFadeT);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(master);
    bodyOsc.start(t0);
    bodyOsc.stop(tEnd + 0.02);
    stoppable.push(bodyOsc);
  }

  if (includeSub) {
    const subOsc = ctx.createOscillator();
    subOsc.type = kickMap && isBassLane ? (preset.mainWave ?? 'sine') : kickMap ? 'sine' : (preset.mainWave ?? 'sine');
    let subStartHz = hzSub;
    if (
      isBassLane &&
      lastKeyboardMidi != null &&
      t0 - lastKeyboardTime < KICK_BASS_GLIDE_MAX_GAP_SEC &&
      lastKeyboardMidi !== midiEff
    ) {
      subStartHz = midiToHz(lastKeyboardMidi);
    }
    if (kickMap) {
      lastKeyboardMidi = midiEff;
      lastKeyboardTime = t0;
    }
    subOsc.frequency.setValueAtTime(Math.max(12, subStartHz), t0);
    if (isBassLane && Math.abs(subStartHz - hzSub) > 1.5) {
      subOsc.frequency.exponentialRampToValueAtTime(hzSub, t0 + KICK_BASS_GLIDE_SEC);
    }
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, t0);
    const subLvl = clamp(preset.subLevel, 0, 1) * (kickMap ? (isBassLane ? 0.78 + strike * 0.22 : 0.68 + strike * 0.3) : 1);
    const subOn = t0 + sweepDur + 0.012;
    const subOff = sustainEnd - 0.1;
    subGain.gain.exponentialRampToValueAtTime(subLvl, subOn);
    if (kickMap && subOff > subOn + 0.05) {
      subGain.gain.setValueAtTime(subLvl, subOff);
    }
    subGain.gain.exponentialRampToValueAtTime(0.0001, sustainEnd);
    subOsc.connect(subGain);
    subGain.connect(master);
    subOsc.start(t0);
    subOsc.stop(tEnd + 0.02);
    stoppable.push(subOsc);
  }

  const clickBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.02), ctx.sampleRate);
  const cd = clickBuf.getChannelData(0);
  for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * 0.35;
  const click = ctx.createBufferSource();
  click.buffer = clickBuf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = clickHp;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.0001, t0);
  const clickAmp = clamp(preset.clickLevel, 0, 1) * 0.55 * clickGainMul * (kickMap ? 0.65 + strike * 0.7 : 1);
  cg.gain.exponentialRampToValueAtTime(clickAmp, t0 + 0.001);
  cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
  click.connect(hp);
  hp.connect(cg);
  cg.connect(master);

  click.start(t0);
  click.stop(t0 + 0.04);
  stoppable.push(click);

  if (kickMap && kickBus) {
    activeKickVoice = {
      stop(cutT) {
        const end = cutT + KICK_KEYBOARD_TRUNCATE_SEC;
        try {
          kickBus.gain.cancelScheduledValues(cutT);
          kickBus.gain.setValueAtTime(Math.max(kickBus.gain.value, 0.0001), cutT);
          kickBus.gain.exponentialRampToValueAtTime(0.0001, end);
        } catch {
          /* ctx may be closed */
        }
        for (const src of stoppable) {
          try {
            src.stop(end + 0.002);
          } catch {
            /* already stopped */
          }
        }
      },
    };
  }

  // Track every voice (incl. future lookahead starts) so Stop can silence immediately.
  trackEightZeroEightVoice(stoppable, kickBus ?? master);

  let voiceOut: AudioNode = master;
  const driveAmt = clamp(preset.drive ?? 0, 0, 1);
  if (driveAmt > 0.01) {
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1025);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = softClip(x * (1 + driveAmt * 2.2));
    }
    shaper.curve = curve;
    const mix = ctx.createGain();
    mix.gain.value = 1;
    const dry = ctx.createGain();
    dry.gain.value = 1 - driveAmt * 0.45;
    const wet = ctx.createGain();
    wet.gain.value = driveAmt * 0.45;
    master.connect(dry);
    dry.connect(mix);
    master.connect(shaper);
    shaper.connect(wet);
    wet.connect(mix);
    voiceOut = mix;
  }
  connectLab808OutputChain(ctx, voiceOut, outDest, t0, ext?.filterFx);
}
