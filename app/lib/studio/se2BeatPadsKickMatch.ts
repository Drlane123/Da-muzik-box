/**
 * Beat Pads — kick / 808 key lock + per-pad regenerate (Match chords).
 * Regenerate paints a Lane Placement groove for the selected pad's instrument role
 * (kick / snare / clap / hat / …), not always a kick.
 */
import {
  type BeatPadsDrumPattern,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import { BEAT_PADS_LANE_GM_PITCH } from '@/app/lib/creationStation/beatPadsStudioExport';
import {
  applyBeatPadsLanePlacementTemplate,
  beatPadsDrumRoleFromLabel,
  beatPadsDrumRoleLabel,
  getBeatPadsLaneTemplates,
  type BeatPadsDrumRole,
  type BeatPadsPlacementGenre,
} from '@/app/lib/creationStation/beatPadsLanePlacementTemplates';
import { mulberry32 } from '@/app/lib/magentaPatternGenerator';
import type { Se2BeatPadsHarmonySourceTrack } from '@/app/lib/studio/se2BeatPadsHarmony';
import { se2NormalizeDrumGenStyle } from '@/app/lib/studio/se2DrumGeneratorTrack';

/** Beat Pads kick lane (pad 0). */
export const SE2_BEAT_PADS_KICK_LANE = 0;

/** C-root 808 / sub sample reference (same as 808 Lab). */
export const SE2_BEAT_PADS_KICK_REFERENCE_PC = 0;

/** @deprecated Legacy stored values — UI only exposes `bar` and `card`. */
export type Se2BeatPadsKickFollowMode = 'preset' | 'bar' | 'card' | 'double';

export type Se2BeatPadsKickPlaceMode = 'bar' | 'card';

export const SE2_BEAT_PADS_KICK_PLACE_OPTIONS: readonly {
  id: Se2BeatPadsKickPlaceMode;
  label: string;
  hint: string;
}[] = [
  {
    id: 'bar',
    label: 'Bar + C block',
    hint: 'One hit per bar (random step inside the bar, matched to chords)',
  },
  {
    id: 'card',
    label: 'Each C block',
    hint: 'One hit per chord C block (random step inside each block)',
  },
];

export function se2NormalizeBeatPadsKickPlaceMode(raw: string | undefined): Se2BeatPadsKickPlaceMode {
  if (raw === 'bar') return 'bar';
  return 'card';
}

/** @deprecated Use {@link se2NormalizeBeatPadsKickPlaceMode}. */
export function se2NormalizeBeatPadsKickFollowMode(raw: string | undefined): Se2BeatPadsKickFollowMode {
  if (raw === 'bar') return 'bar';
  if (raw === 'preset' || raw === 'double') return 'card';
  return 'card';
}

/** Pad index (0–15) for regenerate + 808-in-key — defaults to kick lane. */
export function se2BeatPadsKickTargetPadIndex(track: { beatPadsKickTargetPad?: number }): number {
  const raw = track.beatPadsKickTargetPad;
  if (raw == null || !Number.isFinite(raw)) return SE2_BEAT_PADS_KICK_LANE;
  return Math.max(0, Math.min(15, Math.round(raw)));
}

export function se2BeatPadsPadGetsKickKeyLock(
  padIndex: number,
  track: { beatPadsKickKeyLock?: boolean; beatPadsKickTargetPad?: number },
): boolean {
  if (!(track.beatPadsKickKeyLock ?? false)) return false;
  return padIndex === se2BeatPadsKickTargetPadIndex(track);
}

/** Low-end lanes that get 808 key-lock pitch (kick + sub GM pitches). */
export function se2BeatPadsIsLowKickPad(padIndex: number): boolean {
  if (padIndex === SE2_BEAT_PADS_KICK_LANE) return true;
  const pitch = BEAT_PADS_LANE_GM_PITCH[padIndex];
  if (pitch == null) return false;
  return pitch >= 35 && pitch <= 36;
}

/** Semitones to add so a C-root 808 sits on the song/chord key root. */
export function se2BeatPadsKickKeySemitones(keyRoot: number, referencePc = SE2_BEAT_PADS_KICK_REFERENCE_PC): number {
  const root = ((Math.round(keyRoot) % 12) + 12) % 12;
  const ref = ((Math.round(referencePc) % 12) + 12) % 12;
  let semi = root - ref;
  if (semi > 6) semi -= 12;
  if (semi < -6) semi += 12;
  return semi;
}

/** Map Match-chords style chip → Lane Placement genre. */
export function se2BeatPadsPlacementGenreFromStyle(style: string | undefined): BeatPadsPlacementGenre {
  switch (se2NormalizeDrumGenStyle(style)) {
    case 'trap':
    case 'dark':
      return 'trap';
    case 'rnb':
      return 'rnb';
    case 'pop':
      return 'pop';
    case 'kpop':
      return 'kpop';
    case 'gospel':
      return 'soulBlues';
    case 'dance':
      return 'dance';
    case 'disco':
      return 'house';
    default:
      return 'trap';
  }
}

const REGEN_GENRE_FALLBACKS: readonly BeatPadsPlacementGenre[] = [
  'trap',
  'rnb',
  'pop',
  'house',
  'dance',
  'kpop',
  'soulBlues',
  'afro',
  'reggae',
  'lofi',
];

function templatesForRole(
  role: BeatPadsDrumRole,
  preferred: BeatPadsPlacementGenre,
): ReturnType<typeof getBeatPadsLaneTemplates> {
  const primary = getBeatPadsLaneTemplates(role, preferred);
  if (primary.length > 0) return primary;
  for (const g of REGEN_GENRE_FALLBACKS) {
    if (g === preferred) continue;
    const list = getBeatPadsLaneTemplates(role, g);
    if (list.length > 0) return list;
  }
  return [];
}

export type Se2BeatPadsRegeneratePadOpts = {
  /** Sample / kit label for the selected pad (snare, clap, hat, …). */
  padLabel?: string;
  /** Match-chords style chip (`trap`, `rnb`, …). */
  style?: string;
};

export type Se2BeatPadsRegeneratePadResult = {
  pattern: BeatPadsDrumPattern;
  applied: boolean;
  status: string;
};

/**
 * Replace one pad lane with a role-matched Lane Placement groove
 * (snare plays like a snare, hats like hats, kick like kick). Other pads untouched.
 */
export function se2BeatPadsRegeneratePadLane(
  pattern: BeatPadsDrumPattern,
  _harmony: Se2BeatPadsHarmonySourceTrack | undefined,
  stepsPerBar: BeatPadsGridStepsPerBar,
  _beatsPerBar: number,
  loopBars: number,
  targetPadIndex: number,
  _mode?: Se2BeatPadsKickPlaceMode,
  seed?: number,
  opts?: Se2BeatPadsRegeneratePadOpts,
): Se2BeatPadsRegeneratePadResult {
  const lane = Math.max(0, Math.min(15, Math.round(targetPadIndex)));
  const role = beatPadsDrumRoleFromLabel(opts?.padLabel ?? '', lane);
  const genre = se2BeatPadsPlacementGenreFromStyle(opts?.style);
  const pool = templatesForRole(role, genre);
  if (pool.length === 0) {
    return {
      pattern,
      applied: false,
      status: `No ${beatPadsDrumRoleLabel(role)} placements for this style — try another genre chip.`,
    };
  }

  const rng = mulberry32((seed ?? Date.now() % 1_000_000_000) >>> 0);
  const tpl = pool[Math.floor(rng() * pool.length)]!;

  const lanes: BeatPadsDrumPattern = pattern.map((row) => [...row]);
  while (lanes.length < 16) lanes.push([]);

  const next = applyBeatPadsLanePlacementTemplate(
    lanes,
    lane,
    loopBars,
    tpl.steps,
    stepsPerBar,
  );
  const bars = Math.max(1, Math.round(loopBars));
  const roleName = beatPadsDrumRoleLabel(role);
  return {
    pattern: next,
    applied: true,
    status: `Regenerated Pad ${lane + 1} — ${roleName} · ${tpl.name} (${bars}-bar ${tpl.genre}).`,
  };
}

/** @deprecated Load groove no longer auto-rewrites kicks — use {@link se2BeatPadsRegeneratePadLane}. */
export function se2BeatPadsApplyKickFollowToPattern(
  pattern: BeatPadsDrumPattern,
  mode: Se2BeatPadsKickFollowMode,
  harmony: Se2BeatPadsHarmonySourceTrack | undefined,
  stepsPerBar: BeatPadsGridStepsPerBar,
  beatsPerBar: number,
  loopBars: number,
  targetPadIndex = SE2_BEAT_PADS_KICK_LANE,
  seed = Date.now(),
  opts?: Se2BeatPadsRegeneratePadOpts,
): Se2BeatPadsRegeneratePadResult {
  const placeMode = se2NormalizeBeatPadsKickPlaceMode(mode === 'bar' ? 'bar' : 'card');
  return se2BeatPadsRegeneratePadLane(
    pattern,
    harmony,
    stepsPerBar,
    beatsPerBar,
    loopBars,
    targetPadIndex,
    placeMode,
    seed,
    opts,
  );
}

export type Se2BeatPadsKickFollowApplyResult = Se2BeatPadsRegeneratePadResult;
