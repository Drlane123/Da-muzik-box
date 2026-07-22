/**
 * VocalBox metro — strict 4-beat click counter (no separate visual clock).
 *
 *   currentBeat = 1
 *   on each metronome click:
 *     light cell(currentBeat), show currentBeat
 *     currentBeat = currentBeat >= 4 ? 1 : currentBeat + 1
 *
 * Clicks stay on BPM math: at = t0 + i × (60/bpm).
 * Visuals only advance when audio currentTime hits that click’s `at`.
 */

import {
  se2BeatInBar,
  se2ClickGridTempo,
  waitSe2AudioTime,
} from '@/app/lib/creationStation/vocalBoxAudioGrid';

const START_FLOOR_SEC = 0.004;

export type VocalBoxClickEvent = {
  at: number;
  /** Strict step counter value for this click: 1, 2, 3, or 4. */
  number: number;
  phase: 'precount' | 'metro';
  absoluteBeat: number;
  accent: boolean;
  /** Horizontal cell on the ruler for this click (0, 1, 2, …). */
  gridBeatIndex: number | null;
};

/** @deprecated Prefer the live currentBeat counter in runVocalBoxClickCount. */
export function vocalBoxClickDisplayNumber(
  absoluteBeat1Based: number,
  countBeats: number,
  beatsPerBar: number,
): { phase: 'precount' | 'metro'; number: number } {
  const beat = Math.max(1, Math.floor(absoluteBeat1Based));
  const count = Math.max(0, Math.floor(countBeats));
  const bpb = Math.max(1, Math.round(beatsPerBar));
  if (count > 0 && beat <= count) {
    return { phase: 'precount', number: se2BeatInBar(beat, bpb) };
  }
  const metroBeat = count > 0 ? beat - count : beat;
  return { phase: 'metro', number: se2BeatInBar(Math.max(1, metroBeat), bpb) };
}

/**
 * Visuals listen ONLY to the metronome click list.
 * One step per click — physically the same order as the audio schedule.
 */
export function startVocalBoxDigitFollow(args: {
  ctx: AudioContext;
  t0: number;
  spb: number;
  beatsPerBar: number;
  events: VocalBoxClickEvent[];
  isCancelled: () => boolean;
  paintDigit?: (n: number, phase: 'precount' | 'metro', absoluteBeat: number) => void;
  onGridBeat?: (gridBeatIndex: number, phase: 'precount' | 'metro') => void;
  onPhaseChange?: (phase: 'precount' | 'metro') => void;
  playheadEl?: HTMLElement | null;
}): () => void {
  const { events, t0, spb, ctx } = args;
  if (events.length === 0 || spb <= 0) return () => {};

  let clickIndex = 0;
  let lastPhase: 'precount' | 'metro' | null = null;
  let stopped = false;
  let raf = 0;
  const lastAt = events[events.length - 1]!.at;
  const gridSpan = Math.max(spb, lastAt - t0);

  const onMetronomeClick = (ev: VocalBoxClickEvent) => {
    // Exact user logic: light this click’s beat (1–4), then grid cell.
    if (ev.gridBeatIndex != null) {
      args.onGridBeat?.(ev.gridBeatIndex, ev.phase);
    }
    args.paintDigit?.(ev.number, ev.phase, ev.absoluteBeat);
    if (ev.phase !== lastPhase) {
      lastPhase = ev.phase;
      args.onPhaseChange?.(ev.phase);
    }
  };

  const paintPlayhead = (now: number) => {
    const el = args.playheadEl;
    if (!el) return;
    if (now < t0) {
      el.style.left = '0%';
      el.style.opacity = '0.35';
      return;
    }
    const p = (now - t0) / gridSpan;
    if (p > 1.001) {
      el.style.opacity = '0';
      return;
    }
    el.style.left = `${Math.min(100, Math.max(0, p * 100))}%`;
    el.style.opacity = '1';
  };

  const draw = () => {
    if (stopped || args.isCancelled()) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    paintPlayhead(now);

    // Only the next metronome click — never drain/skip ahead.
    if (clickIndex < events.length && now >= events[clickIndex]!.at) {
      onMetronomeClick(events[clickIndex]!);
      clickIndex += 1;
    }

    if (!stopped && !args.isCancelled() && now < lastAt + 0.08) {
      raf = requestAnimationFrame(draw);
    }
  };

  const el = args.playheadEl;
  if (el) {
    el.getAnimations().forEach((a) => a.cancel());
    el.style.opacity = '1';
    el.style.left = '0%';
  }

  raf = requestAnimationFrame(draw);

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    if (el) {
      el.style.opacity = '0';
      el.style.left = '0%';
    }
  };
}

export async function runVocalBoxClickCount(args: {
  ctx: AudioContext;
  bpm: number;
  beatsPerBar: number;
  precountEnabled: boolean;
  precountBars?: 1 | 2;
  metroEnabled: boolean;
  metroBeatCount: number;
  scheduleClick: (idealT: number, accent: boolean) => void;
  isCancelled: () => boolean;
  paintDigit?: (n: number, phase: 'precount' | 'metro', absoluteBeat: number) => void;
  onGridBeat?: (gridBeatIndex: number, phase: 'precount' | 'metro') => void;
  onPhaseChange?: (phase: 'precount' | 'metro') => void;
  onArmRecord?: () => Promise<void>;
  recordArmLeadSec?: number;
  playheadEl?: HTMLElement | null;
}): Promise<{
  cancelled: boolean;
  downbeatAudioTime: number;
  recordArmedAtSec: number | null;
  t0: number;
  spb: number;
  countBeats: number;
  bpm: number;
  stopUi: () => void;
}> {
  const { bpm, spb } = se2ClickGridTempo(args.bpm);
  const bpb = Math.max(1, Math.round(args.beatsPerBar));
  const bars = args.precountBars === 2 ? 2 : 1;
  const countBeats = args.precountEnabled ? bars * bpb : 0;
  const metroBeats = args.metroEnabled ? Math.max(0, Math.floor(args.metroBeatCount)) : 0;
  const totalBeats = countBeats + metroBeats;
  // 0 = arm exactly on the downbeat (first green 1). Do not clamp above 0.
  const armLead = Math.max(0, Math.min(0.25, args.recordArmLeadSec ?? 0));

  const t0 = args.ctx.currentTime + START_FLOOR_SEC;
  const downbeatAudioTime = t0 + countBeats * spb;

  // ——— Strict step-counter tied to each metronome click ———
  let currentBeat = 1;
  const events: VocalBoxClickEvent[] = [];

  for (let i = 0; i < totalBeats; i += 1) {
    const at = t0 + i * spb;
    const absoluteBeat = i + 1;
    const phase: 'precount' | 'metro' =
      countBeats > 0 && absoluteBeat <= countBeats ? 'precount' : 'metro';
    const accent = currentBeat === 1;

    // This click’s number from the counter (1→2→3→4→1…).
    const beatNumber = currentBeat;

    const gridBeatIndex =
      phase === 'metro' ? absoluteBeat - countBeats - 1 : (absoluteBeat - 1) % bpb;

    events.push({
      at,
      number: beatNumber,
      phase,
      absoluteBeat,
      accent,
      gridBeatIndex,
    });

    // Audio click on the BPM grid — same `at` the visual will wait for.
    args.scheduleClick(at, accent);

    // Increment; past 4 → reset to 1.
    currentBeat = currentBeat >= 4 ? 1 : currentBeat + 1;
  }

  let recordArmedAtSec: number | null = null;
  let armed = false;
  let armPromise: Promise<void> | null = null;

  const armNow = async (stampSec?: number) => {
    if (!args.onArmRecord || armed) return;
    if (!armPromise) {
      armPromise = (async () => {
        await args.onArmRecord!();
        armed = true;
        // Prefer scheduled arm time for grid origin (stable vs await jitter).
        recordArmedAtSec = stampSec ?? args.ctx.currentTime;
      })();
    }
    await armPromise;
  };

  const stopUi =
    events.length > 0 && (args.paintDigit || args.onGridBeat)
      ? startVocalBoxDigitFollow({
          ctx: args.ctx,
          t0,
          spb,
          beatsPerBar: bpb,
          events,
          isCancelled: args.isCancelled,
          paintDigit: args.paintDigit,
          onGridBeat: args.onGridBeat,
          onPhaseChange: args.onPhaseChange,
          playheadEl: args.playheadEl ?? null,
        })
      : () => {};

  if (countBeats > 0) {
    // Arm MediaRecorder BEFORE green 1 so the kick on 1 is in the file.
    const armAt = downbeatAudioTime - armLead;
    const armTask =
      args.onArmRecord != null
        ? (async () => {
            const okArm = await waitSe2AudioTime({
              ctx: args.ctx,
              whenSec: armAt,
              isCancelled: args.isCancelled,
            });
            if (!okArm || args.isCancelled()) return;
            await armNow(armAt);
          })()
        : Promise.resolve();

    const ok = await waitSe2AudioTime({
      ctx: args.ctx,
      whenSec: downbeatAudioTime,
      isCancelled: args.isCancelled,
    });
    await armTask;

    if (!ok || args.isCancelled()) {
      stopUi();
      return {
        cancelled: true,
        downbeatAudioTime,
        recordArmedAtSec,
        t0,
        spb,
        countBeats,
        bpm,
        stopUi: () => {},
      };
    }
  }

  await armNow(countBeats > 0 ? downbeatAudioTime : args.ctx.currentTime);

  return {
    cancelled: args.isCancelled(),
    downbeatAudioTime,
    recordArmedAtSec,
    t0,
    spb,
    countBeats,
    bpm,
    stopUi,
  };
}
