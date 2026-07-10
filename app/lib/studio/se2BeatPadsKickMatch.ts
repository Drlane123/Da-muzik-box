/**
 * Beat Pads — kick / 808 key lock + per-pad kick regenerate (Match chords).
 */
import {
  beatPadsNewNoteId,
  type BeatPadsDrumPattern,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import {
  trapKickLean,
  trapKickMetro,
  trapKickMinimal,
  trapKickSlide,
  trapKickSouth,
  trapKickSparse,
  trapKickSyncopated,
} from '@/app/lib/creationStation/beatLabTrapPatternGrid';
import { BEAT_PADS_LANE_GM_PITCH } from '@/app/lib/creationStation/beatPadsStudioExport';
import { mulberry32 } from '@/app/lib/magentaPatternGenerator';
import type { Se2BeatPadsHarmonySourceTrack } from '@/app/lib/studio/se2BeatPadsHarmony';

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

type KickBarTemplate = { id: string; label: string; steps: readonly number[] };

/** One-bar kick shapes from trap producer grid — step 0 = beat 1 downbeat (16th grid). */
const KICK_REGENERATE_TEMPLATES: readonly KickBarTemplate[] = [
  { id: 'minimal', label: 'trunk 1 & 3', steps: stepsFromTrapKick(trapKickMinimal) },
  { id: 'sparse', label: 'sparse trap', steps: stepsFromTrapKick(trapKickSparse) },
  { id: 'metro', label: 'metro bounce', steps: stepsFromTrapKick(trapKickMetro) },
  { id: 'syncopated', label: 'sync pocket', steps: stepsFromTrapKick(trapKickSyncopated) },
  { id: 'south', label: 'south bounce', steps: stepsFromTrapKick(trapKickSouth) },
  { id: 'lean', label: 'lean pocket', steps: stepsFromTrapKick(trapKickLean) },
  { id: 'slide', label: 'slide phrase', steps: stepsFromTrapKick(trapKickSlide) },
];

function stepsFromTrapKick(fn: () => ReadonlyArray<[number, number]>): number[] {
  const out: number[] = [];
  for (const [row, step] of fn()) {
    if (row === 0) out.push(step);
  }
  return out.length > 0 ? out : [0];
}

function scaleKickStepInBar(step16: number, stepsPerBar: BeatPadsGridStepsPerBar): number {
  if (stepsPerBar === 16) return Math.max(0, Math.min(15, step16));
  return Math.max(0, Math.min(stepsPerBar - 1, Math.round((step16 / 16) * stepsPerBar)));
}

function pickKickPatternColumns(
  loopBars: number,
  stepsPerBar: BeatPadsGridStepsPerBar,
  seed: number,
): { cols: number[]; label: string } {
  const rng = mulberry32(seed >>> 0);
  const tpl = KICK_REGENERATE_TEMPLATES[Math.floor(rng() * KICK_REGENERATE_TEMPLATES.length)]!;
  const barSteps = [
    ...new Set(tpl.steps.map((s) => scaleKickStepInBar(s, stepsPerBar))),
  ].sort((a, b) => a - b);
  if (barSteps[0] !== 0) barSteps.unshift(0);

  const hits = new Set<number>();
  const bars = Math.max(1, Math.round(loopBars));
  for (let bar = 0; bar < bars; bar += 1) {
    const barStart = bar * stepsPerBar;
    hits.add(barStart);
    for (const offset of barSteps) {
      if (offset === 0) continue;
      if (rng() < 0.1) continue;
      hits.add(barStart + offset);
    }
  }

  return { cols: [...hits].sort((a, b) => a - b), label: tpl.label };
}

function kickNotesAtColumns(cols: readonly number[]): BeatPadsDrumPattern[number] {
  const uniq = [...new Set(cols)].sort((a, b) => a - b);
  return uniq.map((start) => ({ id: beatPadsNewNoteId(), start, len: 1 }));
}

export type Se2BeatPadsRegeneratePadResult = {
  pattern: BeatPadsDrumPattern;
  applied: boolean;
  status: string;
};

/** Replace one pad lane with a producer kick grid — downbeat every bar + trap pocket (other pads untouched). */
export function se2BeatPadsRegeneratePadLane(
  pattern: BeatPadsDrumPattern,
  _harmony: Se2BeatPadsHarmonySourceTrack | undefined,
  stepsPerBar: BeatPadsGridStepsPerBar,
  _beatsPerBar: number,
  loopBars: number,
  targetPadIndex: number,
  _mode?: Se2BeatPadsKickPlaceMode,
  seed?: number,
): Se2BeatPadsRegeneratePadResult {
  const lane = Math.max(0, Math.min(15, Math.round(targetPadIndex)));
  const { cols, label } = pickKickPatternColumns(
    loopBars,
    stepsPerBar,
    seed ?? Date.now() % 1_000_000_000,
  );
  if (cols.length === 0) {
    return { pattern, applied: false, status: 'Could not build kick pattern — check loop length.' };
  }

  const lanes = pattern.map((row) => [...row]);
  while (lanes.length < 16) lanes.push([]);
  lanes[lane] = kickNotesAtColumns(cols);

  const bars = Math.max(1, Math.round(loopBars));
  return {
    pattern: lanes,
    applied: true,
    status: `Regenerated Pad ${lane + 1} — ${bars}-bar kick (${label}, downbeat every bar).`,
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
  );
}

export type Se2BeatPadsKickFollowApplyResult = Se2BeatPadsRegeneratePadResult;
