/**
 * VocalBox-only audio-grid helpers (copied from pre-8pm se2Precount helpers).
 * Kept OUT of se2Precount.ts so Studio Editor 2 record precount stays on git HEAD.
 */

const PRECOUNT_LEAD_SEC = 0.05;

/** One tempo for count-in + metro (must match wait UI + scheduled clicks). */
export function se2ClickGridTempo(bpm: number): { bpm: number; spb: number } {
  const b = Math.max(40, Math.min(240, Math.round(bpm)));
  return { bpm: b, spb: 60 / b };
}

/** UI countdown number: beat 1 â†’ 4, beat 2 â†’ 3, â€¦ beat 4 â†’ 1. */
export function se2PrecountCountdownNumber(beat1Based: number, totalBeats: number): number {
  const total = Math.max(1, Math.floor(totalBeats));
  const beat = Math.max(1, Math.min(total, Math.floor(beat1Based)));
  return total - beat + 1;
}

/** Beat-in-bar for metro UI: absolute beat 1 â†’ 1, 2 â†’ 2, â€¦ 5 â†’ 1 (in 4/4). */
export function se2BeatInBar(beat1BasedAbsolute: number, beatsPerBar: number): number {
  const bpb = Math.max(1, Math.round(beatsPerBar));
  const beat = Math.max(1, Math.floor(beat1BasedAbsolute));
  return ((beat - 1) % bpb) + 1;
}

/** Per-bar free count: 4â†’3â†’2â†’1 (repeats on a 2-bar count-in). */
export function se2PrecountBarCountdownNumber(beat1Based: number, beatsPerBar: number): number {
  const bpb = Math.max(1, Math.round(beatsPerBar));
  const pos = ((Math.max(1, Math.floor(beat1Based)) - 1) % bpb) + 1;
  return bpb - pos + 1;
}

/** Display number for a beat on a continuous count-inâ†’metro click grid. */
export function se2SyncedGridDisplayNumber(args: {
  absoluteBeat1Based: number;
  countBeats: number;
  beatsPerBar: number;
}): { phase: 'precount' | 'metro'; number: number } {
  const beat = Math.max(1, Math.floor(args.absoluteBeat1Based));
  const count = Math.max(0, Math.floor(args.countBeats));
  const bpb = Math.max(1, Math.round(args.beatsPerBar));
  if (count > 0 && beat <= count) {
    return { phase: 'precount', number: se2PrecountBarCountdownNumber(beat, bpb) };
  }
  const metroBeat = count > 0 ? beat - count : beat;
  return { phase: 'metro', number: se2BeatInBar(Math.max(1, metroBeat), bpb) };
}

/**
 * Context time that matches what the user is *hearing* (DAC / device delay).
 * Clicks are scheduled on `currentTime`; speakers hear them ~outputLatency later.
 * Drive the count-box digit from this clock so the number flips with the rimshot,
 * not ahead of it (web.dev / Paul Adenot output-latency pattern).
 */
export function se2HeardAudioNow(ctx: AudioContext): number {
  const raw = ctx.currentTime;
  if (!Number.isFinite(raw)) return 0;
  try {
    const ts = ctx.getOutputTimestamp?.();
    const ct = ts?.contextTime;
    const pt = ts?.performanceTime;
    if (Number.isFinite(ct) && Number.isFinite(pt)) {
      const heard = (ct as number) + (performance.now() - (pt as number)) / 1000;
      if (Number.isFinite(heard)) {
        // Heard time is at or behind the graph clock â€” never let UI run ahead of currentTime.
        return Math.min(raw, Math.max(raw - 0.15, heard));
      }
    }
  } catch {
    /* fall through */
  }
  const ol =
    typeof ctx.outputLatency === 'number' && ctx.outputLatency > 0 ? ctx.outputLatency : 0;
  const bl = typeof ctx.baseLatency === 'number' && ctx.baseLatency > 0 ? ctx.baseLatency : 0;
  const dac = Math.min(0.12, ol + bl);
  return raw - dac;
}

/**
 * Digit UI follows *heard* audio time for the same `at` as each BufferSource.start.
 * Paint only the current click (no setTimeout catch-up bursts). Visuals use rAF.
 */
export function startSe2SyncedBeatUi(args: {
  ctx: AudioContext;
  t0: number;
  spb: number;
  countBeats: number;
  beatsPerBar: number;
  totalBeats: number;
  isCancelled: () => boolean;
  onNumber: (n: number, phase: 'precount' | 'metro', absoluteBeat: number) => void;
  /** Direct DOM paint â€” preferred (no React commit lag). */
  paintDigit?: (n: number, phase: 'precount' | 'metro') => void;
  onPhaseChange?: (phase: 'precount' | 'metro') => void;
  /**
   * Optional pre-built click events (same `at` as each BufferSource.start).
   * When omitted, events are derived from t0/spb (identical formula to the click grid).
   */
  events?: Array<{
    at: number;
    number: number;
    phase: 'precount' | 'metro';
    absoluteBeat: number;
  }>;
}): () => void {
  let next = 0;
  let lastEmitted = -1;
  let lastPhase: 'precount' | 'metro' | null = null;
  let stopped = false;
  let raf = 0;
  const total = Math.max(0, Math.floor(args.totalBeats));
  if (args.spb <= 0 || total <= 0) return () => {};

  const events =
    args.events && args.events.length > 0
      ? args.events
      : Array.from({ length: total }, (_, i) => {
          const absoluteBeat = i + 1;
          const disp = se2SyncedGridDisplayNumber({
            absoluteBeat1Based: absoluteBeat,
            countBeats: args.countBeats,
            beatsPerBar: args.beatsPerBar,
          });
          return {
            at: args.t0 + i * args.spb,
            number: disp.number,
            phase: disp.phase,
            absoluteBeat,
          };
        });

  const step = () => {
    if (stopped || args.isCancelled()) return;
    if (args.ctx.state === 'suspended') void args.ctx.resume();
    // Match speakers, not the graph clock â€” digit flips when the click is heard.
    const now = se2HeardAudioNow(args.ctx);

    while (next < events.length && now >= events[next]!.at) {
      next += 1;
    }
    const currentIdx = next - 1;

    if (currentIdx >= 0) {
      const ev = events[currentIdx]!;
      args.paintDigit?.(ev.number, ev.phase);

      if (currentIdx !== lastEmitted) {
        lastEmitted = currentIdx;
        if (ev.phase !== lastPhase) {
          lastPhase = ev.phase;
          args.onPhaseChange?.(ev.phase);
        }
        args.onNumber(ev.number, ev.phase, ev.absoluteBeat);
      }
    }

    if (!stopped && !args.isCancelled()) {
      raf = requestAnimationFrame(step);
    }
  };

  raf = requestAnimationFrame(step);

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}

/** Schedule a straight quarter-note click grid on the audio clock (count-in and/or metro). */
export function scheduleSe2ClickGrid(args: {
  t0: number;
  bpm: number;
  beatsPerBar: number;
  /** Inclusive start beat index (0 = first click at t0). */
  fromBeat: number;
  beatCount: number;
  scheduleClick: (idealT: number, downbeat: boolean) => void;
}): { spb: number; endBeatExclusive: number; bpm: number } {
  const { bpm, spb } = se2ClickGridTempo(args.bpm);
  const bpb = Math.max(1, Math.round(args.beatsPerBar));
  const from = Math.max(0, Math.floor(args.fromBeat));
  const count = Math.max(0, Math.floor(args.beatCount));
  for (let i = 0; i < count; i += 1) {
    const beat = from + i;
    args.scheduleClick(args.t0 + beat * spb, beat % bpb === 0);
  }
  return { spb, endBeatExclusive: from + count, bpm };
}

/** Wait until AudioContext reaches `whenSec` (or cancel / timeout). */
export async function waitSe2AudioTime(args: {
  ctx: AudioContext;
  whenSec: number;
  isCancelled: () => boolean;
  onBeat?: (beat1Based: number, totalBeats: number) => void;
  /** Optional per-frame hook (e.g. arm recorder before downbeat). */
  onTick?: (nowSec: number) => void | Promise<void>;
  /** If set with t0 + spb, drives 1..N beat UI while waiting â€” same clock as scheduled clicks. */
  t0?: number;
  spb?: number;
  totalBeats?: number;
  /** When true, fire beat 1 immediately (legacy ascending UI). Default: wait for click. */
  fireFirstBeatImmediately?: boolean;
}): Promise<boolean> {
  const { ctx, whenSec, isCancelled } = args;
  const wallGiveUpMs = performance.now() + Math.max(0, (whenSec - ctx.currentTime) * 1000) + 800;
  let lastBeatUi = 0;
  let tickBusy = false;

  const emitBeat = (beatIdx: number) => {
    if (
      typeof args.totalBeats !== 'number' ||
      args.totalBeats <= 0 ||
      beatIdx <= lastBeatUi
    ) {
      return;
    }
    lastBeatUi = beatIdx;
    args.onBeat?.(beatIdx, args.totalBeats);
  };

  // Fire beat 1 only when opted in (legacy ascending UI). Countdown must wait for the click.
  if (
    args.fireFirstBeatImmediately &&
    typeof args.t0 === 'number' &&
    typeof args.spb === 'number' &&
    typeof args.totalBeats === 'number' &&
    args.totalBeats > 0
  ) {
    emitBeat(1);
  }

  await new Promise<void>((resolve) => {
    const step = () => {
      if (isCancelled()) {
        resolve();
        return;
      }
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const now = ctx.currentTime;
      if (args.onTick && !tickBusy) {
        tickBusy = true;
        Promise.resolve(args.onTick(now)).finally(() => {
          tickBusy = false;
        });
      }
      if (
        typeof args.t0 === 'number' &&
        typeof args.spb === 'number' &&
        typeof args.totalBeats === 'number' &&
        args.spb > 0 &&
        args.totalBeats > 0
      ) {
        // Same as click schedule: beat b at t0 + (b-1)*spb.
        while (lastBeatUi < args.totalBeats) {
          const next = lastBeatUi + 1;
          if (now < args.t0 + (next - 1) * args.spb) break;
          emitBeat(next);
        }
      }
      if (now >= whenSec - 0.002 || performance.now() >= wallGiveUpMs) {
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  return !isCancelled();
}

/**
 * DAW-style pre-count + metronome on one BPM grid.
 * Returns t0/spb so callers can drive Rec numbers with {@link startSe2SyncedBeatUi}.
 */
export async function runSe2PrecountThenMetro(args: {
  ctx: AudioContext;
  bpm: number;
  beatsPerBar: number;
  /** Usually 1 bar â†’ four clicks: 4, 3, 2, 1. */
  precountEnabled: boolean;
  precountBars?: 1 | 2;
  metroEnabled: boolean;
  /** How many quarter-note metro clicks after the downbeat. */
  metroBeatCount: number;
  schedulePrecountClick: (idealT: number, accent: boolean) => void;
  scheduleMetroClick: (idealT: number, downbeat: boolean) => void;
  /** @deprecated Prefer {@link startSe2SyncedBeatUi} with returned t0/spb. */
  onCountdown?: (n: number) => void;
  isCancelled: () => boolean;
  onArmRecord?: () => Promise<void>;
  recordArmLeadSec?: number;
  /** Fires once clicks are scheduled — set musical anchors before the downbeat wait. */
  onGridReady?: (grid: {
    t0: number;
    spb: number;
    downbeatAudioTime: number;
    countBeats: number;
    bpm: number;
  }) => void;
  /** Synced Rec numbers — same t0/spb as clicks (4…1 then 1…4). */
  onDisplayNumber?: (n: number, phase: 'precount' | 'metro', absoluteBeat?: number) => void;
  /** Imperative Rec digit paint (DOM) â€” fires at clickAt before React. */
  paintDigit?: (n: number, phase: 'precount' | 'metro') => void;
  onPhaseChange?: (phase: 'precount' | 'metro') => void;
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
  const armLead = Math.max(0, Math.min(0.28, args.recordArmLeadSec ?? 0.1));

  const t0 = args.ctx.currentTime + PRECOUNT_LEAD_SEC;
  const downbeatAudioTime = t0 + countBeats * spb;
  const totalBeats = countBeats + metroBeats;

  args.onGridReady?.({ t0, spb, downbeatAudioTime, countBeats, bpm });

  // One continuous BPM grid: each click schedules audio AND a matching digit event.
  const clickEvents: Array<{
    at: number;
    number: number;
    phase: 'precount' | 'metro';
    absoluteBeat: number;
  }> = [];

  for (let i = 0; i < totalBeats; i += 1) {
    const at = t0 + i * spb;
    const absoluteBeat = i + 1;
    const disp = se2SyncedGridDisplayNumber({
      absoluteBeat1Based: absoluteBeat,
      countBeats,
      beatsPerBar: bpb,
    });
    const { phase, number } = disp;
    if (phase === 'precount') {
      args.schedulePrecountClick(at, (absoluteBeat - 1) % bpb === 0);
    } else {
      const metroIndex = countBeats > 0 ? i - countBeats : i;
      args.scheduleMetroClick(at, metroIndex % bpb === 0);
    }
    // Same `at` as BufferSource.start — digit UI delays to heard time via se2HeardAudioNow.
    clickEvents.push({ at, number, phase, absoluteBeat });
  }

  const stopUi =
    clickEvents.length > 0 && (args.onDisplayNumber || args.paintDigit)
      ? startSe2SyncedBeatUi({
          ctx: args.ctx,
          t0,
          spb,
          countBeats,
          beatsPerBar: bpb,
          totalBeats,
          events: clickEvents,
          isCancelled: args.isCancelled,
          paintDigit: args.paintDigit,
          onNumber: (n, phase, absoluteBeat) => args.onDisplayNumber?.(n, phase, absoluteBeat),
          onPhaseChange: args.onPhaseChange,
        })
      : () => {};

  let recordArmedAtSec: number | null = null;
  let armed = false;
  let armPromise: Promise<void> | null = null;

  const armNow = async (_idealSec?: number) => {
    if (!args.onArmRecord || armed) return;
    if (!armPromise) {
      armPromise = (async () => {
        await args.onArmRecord!();
        armed = true;
        // Stamp the real audio clock when MediaRecorder starts — not the ideal
        // schedule time — so file trim lines up with green 1 / musical downbeat.
        recordArmedAtSec = args.ctx.currentTime;
      })();
    }
    await armPromise;
  };

  if (countBeats > 0) {
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


