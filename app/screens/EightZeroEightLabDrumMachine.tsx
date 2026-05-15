import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ForwardedRef,
  type RefObject,
} from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, SkipBack, Square } from 'lucide-react';
import {
  LAB_MPC_KIT_LIST,
  LAB_MPC_PAD_COUNT,
  ensureLabMpcKitLoaded,
  getLabMpcKitLoadState,
  labMpcKitInitialPadFx,
  labMpcKitMeta,
  labMpcPadLabel,
  playLabMpcPad,
  type LabMpcKitId,
} from '@/app/lib/creationStation/labMpcKits';
import { LAB_MPC_DRUM_PRESETS, labMpcDrumPresetById } from '@/app/lib/creationStation/labMpcDrumPresets';
import { beatAtSessionTime } from '@/app/lib/creationStation/creationTransportSync';
import {
  refillCreationTransportLookahead,
  resetCreationTransportStepClock,
  reanchorNextStepWhileRunning,
  reanchorNextStepWhileStopped,
  SE2_AUDIO_START_FLOOR_SEC,
} from '@/app/lib/creationStation/creationTransportSystem';
import { useCreationTransportPump } from '@/app/hooks/useCreationTransportPump';
import {
  cancelCreationPlaylineWapi,
  CREATION_DRUM_PLAYLINE_CENTER_X,
  CREATION_PIANO_PLAYLINE_CENTER_X,
  launchCreationPlaylineWapi,
  setCreationPlaylineTransformStatic,
} from '@/app/lib/creationStation/creationPlaylineWapi';

/** Mirrors Creation Station `LocalTransportState` for the MPC deck (no count-in / record). */
export type Lab808DeckTransportState = 'stopped' | 'playing' | 'paused';

type LabMpcTransportState = Lab808DeckTransportState;

export interface EightZeroEightLabDrumMachineProps {
  /** When false, playback stops and kit prefetch is idle. */
  active: boolean;
  /** When true while `active` is false (808 piano-roll tab), transport + lookahead keep running — mirrors MPC clock on the roll. */
  transportKeepAlive?: boolean;
  /** Optional piano-roll playhead element — driven by same WAPI timeline as MPC playline (step beats × quarter spacing). */
  rollPlaylineRef?: RefObject<HTMLElement | null>;
  /** Live px-per-quarter-note from the piano roll (updated when zoom changes). */
  rollPxPerBeat?: number;
  /** Notify parent when transport changes so the roll toolbar can mirror controls. */
  onTransportChange?: (state: Lab808DeckTransportState) => void;
  isScreenActive?: boolean;
  getAudioContext: () => AudioContext | null;
  labStripBpm: number;
}

export interface Lab808DrumTransportHandle {
  transportSeekStart: () => void;
  /** Seek MPC transport + mirrored roll playhead to `beat` quarter-note position on the piano roll. */
  transportSeekToRollQuarterBeat: (beat: number) => void;
  transportStop: () => void;
  transportTogglePlayPause: () => void;
}

type MpcQuant = 'beat' | 'eighth' | 'sixteenth' | 'thirtysecond' | 'triplet_eighth' | 'triplet_sixteenth';

const MPC_MIN_CELL_PX = 6;
/** Pad names column — keep narrow so step 16 stays in view. */
const MPC_LANE_RAIL_PX = 112;
/** Bar labels row (1 BAR, 2 BAR, …) — compact so the step ruler + pads sit higher. */
const MPC_BAR_STRIP_MIN_H = 21;
/** Step index row height (1…16) — enough line height for digits without shrinking past readability. */
const MPC_TICK_ROW_H = 13;
/**
 * Studio One–style grid: one **Bar** = one musical bar (purple line). Quantization sets how many
 * grid columns fit **between** bar lines (4 at 1/4, 8 at 1/8, 16 at 1/16, 32 at 1/32, 12 / 24 for triplets). In your
 * DAW you call each of those columns a “measure” between bars — we match that count (1…N per bar).
 * How many Bars long the loop is (each Bar = `spb` steps).
 */
const MPC_BAR_LOOP_OPTIONS = [4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64] as const;

/** Same vertical grid as 808 Lab piano roll (`EightZeroEightTab`). */
const ROLL_GRID_BEAT = '#16161c';
const ROLL_GRID_MEASURE = '#3f3f55';
const DRUM_GRID_CELL_BASE = '#12121a';

const btnPrimary: CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid #ca8a04',
  background: 'linear-gradient(180deg,#422006,#1c1410)',
  color: '#fde68a',
  fontWeight: 900,
  fontSize: 12,
  cursor: 'pointer',
};
const btnGhost: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid #3f3f46',
  background: '#18181b',
  color: '#d4d4d8',
  fontWeight: 800,
  fontSize: 12,
  cursor: 'pointer',
};
const selectStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #3f3f46',
  background: '#18181b',
  color: '#e4e4e7',
  fontSize: 12,
  fontWeight: 700,
  minWidth: 160,
};

function stepsPerBarForQuant(q: MpcQuant): number {
  switch (q) {
    case 'beat':
      return 4;
    case 'eighth':
      return 8;
    case 'sixteenth':
      return 16;
    case 'thirtysecond':
      return 32;
    case 'triplet_eighth':
      return 12;
    case 'triplet_sixteenth':
      return 24;
    default:
      return 16;
  }
}

function emptyGrid(steps: number): boolean[][] {
  return Array.from({ length: LAB_MPC_PAD_COUNT }, () => Array<boolean>(steps).fill(false));
}

function resizeGridRows(old: boolean[][], newSteps: number): boolean[][] {
  return old.map((row) => {
    if (row.length === newSteps) return row;
    if (row.length > newSteps) return row.slice(0, newSteps);
    return [...row, ...Array(newSteps - row.length).fill(false)];
  });
}

function kitIndex(id: LabMpcKitId): number {
  return LAB_MPC_KIT_LIST.findIndex((k) => k.id === id);
}

/** Steps per quarter-note beat (roll is 1 column = 1 beat). */
function stepsPerBeat(spb: number): number {
  return spb / 4;
}

/**
 * Left edge: thick = Bar (Studio One bar line); thin = beat (every spb/4 steps in 4/4).
 */
function drumGridLeftBorder(step: number, spb: number): string {
  if (step <= 0) return `1px solid ${DRUM_GRID_CELL_BASE}`;
  const stpb = stepsPerBeat(spb);
  if (step % spb === 0) return `2px solid ${ROLL_GRID_MEASURE}`;
  if (step % stpb === 0) return `1px solid ${ROLL_GRID_BEAT}`;
  return `1px solid ${DRUM_GRID_CELL_BASE}`;
}

/** Bar strip + step-index row (must match layout + `mpcLaneRowH` math). */
const MPC_GRID_RULER_TOTAL_PX = MPC_BAR_STRIP_MIN_H + MPC_TICK_ROW_H;

/** Same values as Creation Station `CREATION_PLAYLINE_WAPI_LEAD_SEC` + DAC lead (do not change independently). */
const LAB_MPC_PLAYLINE_WAPI_LEAD_SEC = 0.052;

function labMpcPlaylineOutputDacLeadSec(ctx: AudioContext | null): number {
  if (!ctx || ctx.state === 'closed') return 0;
  const ol = typeof ctx.outputLatency === 'number' && ctx.outputLatency > 0 ? ctx.outputLatency : 0;
  const bl = typeof ctx.baseLatency === 'number' && ctx.baseLatency > 0 ? ctx.baseLatency : 0;
  return Math.min(0.12, ol + bl);
}

function rollPlaylineColW(pxPerQuarter: number, spb: number): number {
  return Math.max(1, (4 / Math.max(1, spb)) * Math.max(1, pxPerQuarter));
}

const EightZeroEightLabDrumMachine = forwardRef(function EightZeroEightLabDrumMachine(
  {
    active,
    transportKeepAlive = false,
    rollPlaylineRef,
    rollPxPerBeat = 52,
    onTransportChange,
    isScreenActive,
    getAudioContext,
    labStripBpm,
  }: EightZeroEightLabDrumMachineProps,
  ref: ForwardedRef<Lab808DrumTransportHandle>,
) {
  const deckPumpActive = active || transportKeepAlive;

  const [mpcKitId, setMpcKitId] = useState<LabMpcKitId>('trapDark');
  const [mpcKitSearch, setMpcKitSearch] = useState('');
  const [mpcBars, setMpcBars] = useState<(typeof MPC_BAR_LOOP_OPTIONS)[number]>(4);
  const [mpcQuant, setMpcQuant] = useState<MpcQuant>('sixteenth');
  const [mpcBankSlot, setMpcBankSlot] = useState<'A' | 'B'>('A');
  const [mpcPatternA, setMpcPatternA] = useState<boolean[][]>(() => emptyGrid(4 * 16));
  const [mpcPatternB, setMpcPatternB] = useState<boolean[][]>(() => emptyGrid(4 * 16));
  const [mpcKitUiTick, setMpcKitUiTick] = useState(0);
  const [labMpcTransport, setLabMpcTransport] = useState<LabMpcTransportState>('stopped');
  const [drumPlayhead, setDrumPlayhead] = useState(0);
  const [drumPlayReverse, setDrumPlayReverse] = useState(false);
  const [mpcDrumBpmOverride, setMpcDrumBpmOverride] = useState<number | null>(null);
  const [presetLoadKitAndBpm, setPresetLoadKitAndBpm] = useState(true);
  const [presetMenuKey, setPresetMenuKey] = useState(0);
  const [mpcEditPad, setMpcEditPad] = useState(0);
  const [mpcPadTuneSemi, setMpcPadTuneSemi] = useState<number[]>(() => Array(LAB_MPC_PAD_COUNT).fill(0));
  const [mpcPadLpHz, setMpcPadLpHz] = useState<number[]>(() => Array(LAB_MPC_PAD_COUNT).fill(20000));
  const [mpcPadDrive, setMpcPadDrive] = useState<number[]>(() => Array(LAB_MPC_PAD_COUNT).fill(0));
  const [mpcPadLevel, setMpcPadLevel] = useState<number[]>(() => Array(LAB_MPC_PAD_COUNT).fill(1));
  const [seqViewportW, setSeqViewportW] = useState(0);
  const [seqViewportH, setSeqViewportH] = useState(0);

  useEffect(() => {
    onTransportChange?.(labMpcTransport);
  }, [labMpcTransport, onTransportChange]);

  const mpcSeqViewportRef = useRef<HTMLDivElement | null>(null);
  const mpcStepPaintRef = useRef<{ target: boolean } | null>(null);
  const drumPlayReverseRef = useRef(drumPlayReverse);
  const labMpcTransportRef = useRef<LabMpcTransportState>('stopped');
  /** When true, `playing` → `paused` cleanup mirrors Beat Lab `pauseTransport` (keep session). */
  const labMpcPauseRequestedRef = useRef(false);
  /**
   * `syncLabMpcFullStop` / pause cleanup already position the playline (fractional beat + WAPI lead).
   * The stopped-state scrub `useEffect` would immediately overwrite with integer `drumPlayhead` → jump.
   */
  const labMpcSkipNextStoppedPlaylineSyncRef = useRef(false);
  const drumBpmRef = useRef(120);
  const drumSpbRef = useRef(16);
  const drumPlayheadRef = useRef(0);
  const mpcPatternRef = useRef<boolean[][]>(mpcPatternA);
  const mpcKitIdRef = useRef(mpcKitId);
  const mpcPadFxRef = useRef({
    tune: mpcPadTuneSemi,
    lp: mpcPadLpHz,
    drive: mpcPadDrive,
    level: mpcPadLevel,
  });

  /**
   * One transport “beat” = one MPC column: `beatAtSessionTime` / lookahead / playline all use
   * `bpm = drumBpm * stepsPerBar / 4` so they cannot disagree (quarter-note + subdiv in one clock caused skips).
   */
  const mpcTransportBpmRef = useRef(120);
  const ctxRef = useRef<AudioContext | null>(null);
  const runningRef = useRef(false);
  const sessionStartRef = useRef(0);
  const originBeatRef = useRef(0);
  const displayBeatRef = useRef(0);
  const lastScheduledQuarterRef = useRef(Number.NEGATIVE_INFINITY);
  const nextStepBeatRef = useRef(0);
  const nextStepTimeRef = useRef(0);
  const kStartRef = useRef(0);
  const refillLabMpcScheduleRef = useRef((_ctx: AudioContext, _ctSnap: number) => {});
  const onFrameRef = useRef<(bDisplay: number) => void>(() => {});
  const labMpcDrumPlaylineRef = useRef<HTMLDivElement | null>(null);
  const labMpcDrumPlaylineAnimRef = useRef<Animation | null>(null);
  const labMpcPianoPlaylineAnimRef = useRef<Animation | null>(null);
  const labMpcQuantGlowAnimRef = useRef<Animation | null>(null);
  const cellSizeRef = useRef(MPC_MIN_CELL_PX);

  const spb = stepsPerBarForQuant(mpcQuant);
  const barLoopCount = mpcBars;
  const mpcSteps = barLoopCount * spb;

  const pattern = mpcBankSlot === 'A' ? mpcPatternA : mpcPatternB;
  const setPattern = mpcBankSlot === 'A' ? setMpcPatternA : setMpcPatternB;

  drumPlayReverseRef.current = drumPlayReverse;
  mpcPatternRef.current = pattern;
  mpcKitIdRef.current = mpcKitId;
  mpcPadFxRef.current = { tune: mpcPadTuneSemi, lp: mpcPadLpHz, drive: mpcPadDrive, level: mpcPadLevel };

  const drumPlaybackBpm = Math.max(40, Math.min(220, mpcDrumBpmOverride ?? Math.round(labStripBpm)));
  drumBpmRef.current = drumPlaybackBpm;
  drumSpbRef.current = spb;
  drumPlayheadRef.current = drumPlayhead;
  mpcTransportBpmRef.current = (drumPlaybackBpm * Math.max(1, spb)) / 4;
  labMpcTransportRef.current = labMpcTransport;

  const filteredKits = useMemo(() => {
    const q = mpcKitSearch.trim().toLowerCase();
    if (!q) return LAB_MPC_KIT_LIST;
    return LAB_MPC_KIT_LIST.filter((k) => `${k.title} ${k.id} ${k.era}`.toLowerCase().includes(q));
  }, [mpcKitSearch]);

  /** Size step columns so the full loop fits the viewport; shrink if needed so the last bar is never clipped. */
  const cellSize = useMemo(() => {
    const gutter = 8;
    const availForSteps = Math.max(0, seqViewportW - MPC_LANE_RAIL_PX - gutter);
    if (mpcSteps <= 0) return MPC_MIN_CELL_PX;
    let raw = Math.floor(availForSteps / mpcSteps);
    raw = Math.min(52, Math.max(MPC_MIN_CELL_PX, raw));
    while (raw > MPC_MIN_CELL_PX && mpcSteps * raw > availForSteps) {
      raw -= 1;
    }
    return raw;
  }, [seqViewportW, mpcSteps]);

  cellSizeRef.current = cellSize;

  /** Step numbers 1…N — readable; cell width still drives size. */
  const tickStepFontPx = useMemo(() => {
    return Math.max(4, Math.min(7, Math.round(cellSize * 0.32)));
  }, [cellSize]);

  /** Pad lane height: divide remaining viewport among 16 rows (min 8px so the grid always fits vertically). */
  const mpcLaneRowH = useMemo(() => {
    const inner = seqViewportH > 0 ? seqViewportH - MPC_GRID_RULER_TOTAL_PX : 0;
    if (inner < 32) return 22;
    const raw = Math.floor(inner / LAB_MPC_PAD_COUNT);
    return Math.max(8, Math.min(30, raw));
  }, [seqViewportH]);

  const fireLabMpcStep = useCallback((k: number, idealGridT: number, ctx: AudioContext) => {
    const pat = mpcPatternRef.current;
    const steps = Math.max(1, pat[0]?.length ?? 1);
    const kit = mpcKitIdRef.current;
    const fx = mpcPadFxRef.current;
    const rev = drumPlayReverseRef.current;
    const k0 = kStartRef.current;
    const d = k - k0;
    const col = rev ? ((k0 - d) % steps + steps) % steps : ((k0 + d) % steps) % steps;
    const ctSnap = ctx.currentTime;
    const whenSnap = Math.max(idealGridT, ctSnap + 0.001);
    for (let row = 0; row < LAB_MPC_PAD_COUNT; row += 1) {
      if (pat[row]?.[col]) {
        playLabMpcPad(ctx, kit, row, whenSnap, 0.95, {
          tuneSemi: fx.tune[row] ?? 0,
          lpCutoffHz: fx.lp[row] ?? 20000,
          drive: fx.drive[row] ?? 0,
          level: fx.level[row] ?? 1,
        });
      }
    }
    return true;
  }, []);

  const refillLabMpcSchedule = useCallback((ctx: AudioContext, ctSnap: number) => {
    const stepSpb = 60 / Math.max(1, mpcTransportBpmRef.current);
    refillCreationTransportLookahead(
      ctx,
      ctSnap,
      stepSpb,
      {
        nextStepBeatRef,
        nextStepTimeRef,
        sessionStartRef,
        originBeatRef,
        lastScheduledQuarterRef,
      },
      fireLabMpcStep,
      () => runningRef.current,
    );
  }, [fireLabMpcStep]);

  refillLabMpcScheduleRef.current = refillLabMpcSchedule;

  const rollPxBeatSyncRef = useRef(rollPxPerBeat);
  rollPxBeatSyncRef.current = rollPxPerBeat;

  const launchLabMpcPlaylineWapiNow = useCallback(
    (beatNow: number, play: boolean) => {
      const el = labMpcDrumPlaylineRef.current;
      const pianoEl = rollPlaylineRef?.current ?? null;
      if (!el && !pianoEl) return;
      const cw = Math.max(1, cellSizeRef.current);
      const pcw = rollPlaylineColW(rollPxPerBeat, drumSpbRef.current);
      const pc = Math.max(1, mpcPatternRef.current[0]?.length ?? 1);
      const bpmR = Math.max(1, mpcTransportBpmRef.current);
      const ctx = ctxRef.current;
      const leadSec = LAB_MPC_PLAYLINE_WAPI_LEAD_SEC + labMpcPlaylineOutputDacLeadSec(ctx);
      const beatForWapi = play ? beatNow + leadSec * (bpmR / 60) : beatNow;
      launchCreationPlaylineWapi(
        {
          drumAnimRef: labMpcDrumPlaylineAnimRef,
          pianoAnimRef: labMpcPianoPlaylineAnimRef,
          drumQuantGlowAnimRef: labMpcQuantGlowAnimRef,
        },
        {
          drumEl: el,
          pianoEl,
          drumQuantGlowEl: null,
          beatNow: beatForWapi,
          play,
          bpm: bpmR,
          subdiv: 1,
          pcols: pc,
          drumColW: cw,
          pianoColW: pcw,
          loopOn: false,
          loopStartBeat: 0,
          loopEndBeat: 0,
          playMode: 'chainAB',
        },
      );
    },
    [rollPlaylineRef, rollPxPerBeat],
  );

  /** Seek transport + playheads to fractional step-beat `nb` (same units as `displayBeatRef`). */
  const labMpcSeekToStepBeat = useCallback(
    (nbInput: number) => {
      const pat = mpcPatternRef.current;
      const steps = Math.max(1, pat[0]?.length ?? 1);
      const rev = drumPlayReverseRef.current;
      const nb = Math.max(0, nbInput);
      const stepSpb = 60 / Math.max(1, mpcTransportBpmRef.current);
      const ctx = ctxRef.current;
      const running = runningRef.current;

      displayBeatRef.current = nb;
      originBeatRef.current = nb;

      const k0 = Math.ceil(nb - 1e-8);
      kStartRef.current = k0;

      const colFRev = (((k0 - nb) % steps) + steps) % steps;
      const col = rev ? Math.floor(colFRev + 1e-8) : ((Math.floor(nb + 1e-8) % steps) + steps) % steps;
      drumPlayheadRef.current = col;
      setDrumPlayhead(col);

      if (running && ctx && ctx.state !== 'closed') {
        const tCapture = Math.max(0, ctx.currentTime);
        sessionStartRef.current = tCapture + SE2_AUDIO_START_FLOOR_SEC;
        originBeatRef.current = nb;
        displayBeatRef.current = nb;
        reanchorNextStepWhileRunning(
          {
            nextStepBeatRef,
            nextStepTimeRef,
            sessionStartRef,
            originBeatRef,
            lastScheduledQuarterRef,
          },
          sessionStartRef.current,
          nb,
          stepSpb,
        );
        lastScheduledQuarterRef.current = k0 - 1;
        refillLabMpcScheduleRef.current(ctx, tCapture);
        launchLabMpcPlaylineWapiNow(nb, true);
      } else {
        sessionStartRef.current = 0;
        reanchorNextStepWhileStopped({ nextStepBeatRef, nextStepTimeRef }, nb);
        const el = labMpcDrumPlaylineRef.current;
        const pel = rollPlaylineRef?.current ?? null;
        if (el || pel) {
          cancelCreationPlaylineWapi(
            {
              drumAnimRef: labMpcDrumPlaylineAnimRef,
              pianoAnimRef: labMpcPianoPlaylineAnimRef,
              drumQuantGlowAnimRef: labMpcQuantGlowAnimRef,
            },
            el,
            pel,
            null,
          );
          launchLabMpcPlaylineWapiNow(nb, false);
        }
      }
    },
    [launchLabMpcPlaylineWapiNow, rollPlaylineRef],
  );

  const labMpcSeekColumn0 = useCallback(() => {
    labMpcSeekToStepBeat(0);
  }, [labMpcSeekToStepBeat]);

  /** Full stop: clear session + snap static playline (Beat Lab `stopTransport` / MPC effect cleanup). */
  const syncLabMpcFullStop = useCallback(() => {
    runningRef.current = false;
    const sess = sessionStartRef.current;
    const c = ctxRef.current;
    let b = displayBeatRef.current;
    if (c && c.state !== 'closed' && sess > 0) {
      b = beatAtSessionTime(Math.max(0, c.currentTime), sess, originBeatRef.current, mpcTransportBpmRef.current);
    }
    displayBeatRef.current = b;
    originBeatRef.current = b;
    sessionStartRef.current = 0;
    lastScheduledQuarterRef.current = Number.NEGATIVE_INFINITY;
    resetCreationTransportStepClock({ nextStepBeatRef, nextStepTimeRef });
    reanchorNextStepWhileStopped({ nextStepBeatRef, nextStepTimeRef }, b);
    const pat = mpcPatternRef.current;
    const steps = Math.max(1, pat[0]?.length ?? 1);
    const rev = drumPlayReverseRef.current;
    const kS = kStartRef.current;
    const bpmLead = Math.max(1, mpcTransportBpmRef.current);
    const leadSec = LAB_MPC_PLAYLINE_WAPI_LEAD_SEC + labMpcPlaylineOutputDacLeadSec(c);
    const bStopLine = rev ? b : b + leadSec * (bpmLead / 60);
    const colFRev = (((kS - b) % steps) + steps) % steps;
    const col = rev ? Math.floor(colFRev + 1e-8) : ((Math.floor(b + 1e-8) % steps) + steps) % steps;
    drumPlayheadRef.current = col;
    setDrumPlayhead(col);
    const elStop = labMpcDrumPlaylineRef.current;
    const pelStop = rollPlaylineRef?.current ?? null;
    const pcwStop = rollPlaylineColW(rollPxBeatSyncRef.current, drumSpbRef.current);
    if (elStop || pelStop) {
      cancelCreationPlaylineWapi(
        {
          drumAnimRef: labMpcDrumPlaylineAnimRef,
          pianoAnimRef: labMpcPianoPlaylineAnimRef,
          drumQuantGlowAnimRef: labMpcQuantGlowAnimRef,
        },
        elStop,
        pelStop,
        null,
      );
      setCreationPlaylineTransformStatic({
        drumEl: elStop,
        pianoEl: pelStop,
        drumQuantGlowEl: null,
        beatNow: bStopLine,
        subdiv: 1,
        pcols: steps,
        drumColW: Math.max(1, cellSizeRef.current),
        pianoColW: pcwStop,
        loopOn: false,
        loopStartBeat: 0,
        loopEndBeat: 0,
        playMode: 'chainAB',
      });
    }
    labMpcSkipNextStoppedPlaylineSyncRef.current = true;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      transportSeekStart: () => {
        labMpcSeekColumn0();
      },
      transportSeekToRollQuarterBeat: (bRoll: number) => {
        const spb = drumSpbRef.current;
        const nb = Math.max(0, bRoll * (Math.max(1, spb) / 4));
        labMpcSeekToStepBeat(nb);
      },
      transportStop: () => {
        labMpcPauseRequestedRef.current = false;
        if (labMpcTransportRef.current === 'paused') {
          syncLabMpcFullStop();
        }
        setLabMpcTransport('stopped');
      },
      transportTogglePlayPause: () => {
        if (labMpcTransportRef.current === 'playing') {
          labMpcPauseRequestedRef.current = true;
          setLabMpcTransport('paused');
          return;
        }
        labMpcPauseRequestedRef.current = false;
        setLabMpcTransport('playing');
      },
    }),
    [labMpcSeekColumn0, labMpcSeekToStepBeat, syncLabMpcFullStop],
  );

  const getOrCreateLabMpcCtx = useCallback(() => {
    const c = getAudioContext();
    if (!c) throw new Error('808 Lab MPC: AudioContext unavailable');
    ctxRef.current = c;
    return c;
  }, [getAudioContext]);

  onFrameRef.current = (bDisplay: number) => {
    if (!runningRef.current) return;
    if (!drumPlayReverseRef.current) return;
    const el = labMpcDrumPlaylineRef.current;
    const pel = rollPlaylineRef?.current ?? null;
    if (!el && !pel) return;
    const cw = Math.max(1, cellSizeRef.current);
    const pcw = rollPlaylineColW(rollPxBeatSyncRef.current, drumSpbRef.current);
    const steps = Math.max(1, mpcPatternRef.current[0]?.length ?? 1);
    const kS = kStartRef.current;
    const colF = ((kS - bDisplay) % steps + steps) % steps;
    if (el) {
      const x = colF * cw - CREATION_DRUM_PLAYLINE_CENTER_X;
      el.style.willChange = 'transform';
      el.style.transform = `translate3d(${x}px, 0, 0)`;
    }
    if (pel) {
      const x = colF * pcw - CREATION_PIANO_PLAYLINE_CENTER_X;
      pel.style.willChange = 'transform';
      pel.style.transform = `translate3d(${x}px, 0, 0)`;
    }
  };

  useLayoutEffect(() => {
    const el = mpcSeqViewportRef.current;
    if (!el) return;
    const apply = () => {
      setSeqViewportW(el.clientWidth);
      setSeqViewportH(el.clientHeight);
    };
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    apply();
    return () => ro.disconnect();
  }, [active]);

  useEffect(() => {
    const onUp = () => {
      mpcStepPaintRef.current = null;
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  useEffect(() => {
    setMpcPatternA((p) => resizeGridRows(p, mpcSteps));
    setMpcPatternB((p) => resizeGridRows(p, mpcSteps));
    setDrumPlayhead((h) => Math.min(h, Math.max(0, mpcSteps - 1)));
  }, [mpcSteps]);

  useEffect(() => {
    const fx = labMpcKitInitialPadFx(mpcKitId);
    setMpcPadTuneSemi(fx.tuneSemi);
    setMpcPadLpHz(fx.lpCutoffHz);
    setMpcPadDrive(fx.drive);
    setMpcPadLevel(fx.level);
  }, [mpcKitId]);

  useEffect(() => {
    if (!active) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const slot = ensureLabMpcKitLoaded(mpcKitId, ctx);
    void slot.readyPromise.then(() => setMpcKitUiTick((n) => n + 1));
  }, [active, mpcKitId, getAudioContext]);

  useEffect(() => {
    if (isScreenActive === false && labMpcTransport === 'playing') {
      labMpcPauseRequestedRef.current = true;
      setLabMpcTransport('paused');
    }
  }, [isScreenActive, labMpcTransport]);

  useEffect(() => {
    if (active || transportKeepAlive) return;
    if (labMpcTransport !== 'stopped') {
      labMpcPauseRequestedRef.current = false;
      syncLabMpcFullStop();
      setLabMpcTransport('stopped');
    }
  }, [active, transportKeepAlive, labMpcTransport, syncLabMpcFullStop]);

  useEffect(() => {
    if (!active && !transportKeepAlive) return;
    const c = getAudioContext();
    if (c) ctxRef.current = c;
  }, [active, transportKeepAlive, getAudioContext]);

  useLayoutEffect(() => {
    if (!deckPumpActive || labMpcTransport !== 'playing') return undefined;
    const ctx = getAudioContext();
    if (!ctx) {
      labMpcPauseRequestedRef.current = false;
      syncLabMpcFullStop();
      setLabMpcTransport('stopped');
      return undefined;
    }
    ctxRef.current = ctx;
    const tCapture = Math.max(0, ctx.currentTime);
    const origin = Math.max(0, displayBeatRef.current);
    originBeatRef.current = origin;
    displayBeatRef.current = origin;
    sessionStartRef.current = tCapture + SE2_AUDIO_START_FLOOR_SEC;
    const stepSpb = 60 / Math.max(1, mpcTransportBpmRef.current);
    const k0 = Math.ceil(origin - 1e-8);
    nextStepBeatRef.current = k0;
    nextStepTimeRef.current = sessionStartRef.current + (k0 - origin) * stepSpb;
    lastScheduledQuarterRef.current = k0 - 1;
    kStartRef.current = k0;
    runningRef.current = true;
    void ctx.resume().catch(() => {});
    refillLabMpcScheduleRef.current(ctx, tCapture);
    const tPost = Math.max(0, ctx.currentTime);
    const beatLaunch = beatAtSessionTime(tPost, sessionStartRef.current, originBeatRef.current, mpcTransportBpmRef.current);
    displayBeatRef.current = beatLaunch;
    return () => {
      if (labMpcPauseRequestedRef.current) {
        labMpcPauseRequestedRef.current = false;
        runningRef.current = false;
        const sess = sessionStartRef.current;
        const c = ctxRef.current;
        let b = displayBeatRef.current;
        if (c && c.state !== 'closed' && sess > 0) {
          b = beatAtSessionTime(Math.max(0, c.currentTime), sess, originBeatRef.current, mpcTransportBpmRef.current);
        }
        displayBeatRef.current = b;
        originBeatRef.current = b;
        const pat = mpcPatternRef.current;
        const steps = Math.max(1, pat[0]?.length ?? 1);
        const rev = drumPlayReverseRef.current;
        const kS = kStartRef.current;
        const colFRev = (((kS - b) % steps) + steps) % steps;
        const col = rev ? Math.floor(colFRev + 1e-8) : ((Math.floor(b + 1e-8) % steps) + steps) % steps;
        drumPlayheadRef.current = col;
        setDrumPlayhead(col);
        const elPause = labMpcDrumPlaylineRef.current;
        const pelPause = rollPlaylineRef?.current ?? null;
        if (elPause || pelPause) {
          cancelCreationPlaylineWapi(
            {
              drumAnimRef: labMpcDrumPlaylineAnimRef,
              pianoAnimRef: labMpcPianoPlaylineAnimRef,
              drumQuantGlowAnimRef: labMpcQuantGlowAnimRef,
            },
            elPause,
            pelPause,
            null,
          );
          launchLabMpcPlaylineWapiNow(b, false);
        }
        labMpcSkipNextStoppedPlaylineSyncRef.current = true;
        return;
      }
      syncLabMpcFullStop();
      if (labMpcTransportRef.current === 'playing') {
        setLabMpcTransport('stopped');
      }
    };
  }, [deckPumpActive, labMpcTransport, getAudioContext, syncLabMpcFullStop, launchLabMpcPlaylineWapiNow]);

  useCreationTransportPump(
    {
      ctxRef,
      runningRef,
      sessionStartRef,
      originBeatRef,
      displayBeatRef,
      bpmRef: mpcTransportBpmRef,
      lastScheduledQuarterRef,
    },
    {
      isScreenActive: deckPumpActive && isScreenActive !== false,
      isPlaying: labMpcTransport === 'playing',
      getOrCreateAudioContext: getOrCreateLabMpcCtx,
      refillRef: refillLabMpcScheduleRef,
      onFrameRef,
    },
  );

  useLayoutEffect(() => {
    if (labMpcTransport !== 'playing' || !deckPumpActive) return;
    if (!runningRef.current) return;
    if (drumPlayReverseRef.current) {
      const el = labMpcDrumPlaylineRef.current;
      const pel = rollPlaylineRef?.current ?? null;
      if (el || pel) {
        cancelCreationPlaylineWapi(
          {
            drumAnimRef: labMpcDrumPlaylineAnimRef,
            pianoAnimRef: labMpcPianoPlaylineAnimRef,
            drumQuantGlowAnimRef: labMpcQuantGlowAnimRef,
          },
          el,
          pel,
          null,
        );
      }
      return;
    }
    const c = ctxRef.current;
    if (!c || c.state === 'closed') return;
    const t = Math.max(0, c.currentTime);
    const b = beatAtSessionTime(t, sessionStartRef.current, originBeatRef.current, mpcTransportBpmRef.current);
    displayBeatRef.current = b;
    launchLabMpcPlaylineWapiNow(b, true);
  }, [labMpcTransport, deckPumpActive, drumPlayReverse, cellSize, mpcSteps, drumPlaybackBpm, spb, rollPxPerBeat, launchLabMpcPlaylineWapiNow]);

  useEffect(() => {
    if (labMpcTransport !== 'stopped') return;
    if (runningRef.current) return;
    if (labMpcSkipNextStoppedPlaylineSyncRef.current) {
      labMpcSkipNextStoppedPlaylineSyncRef.current = false;
      return;
    }
    const el = labMpcDrumPlaylineRef.current;
    const pel = rollPlaylineRef?.current ?? null;
    if (!el && !pel) return;
    const pcw = rollPlaylineColW(rollPxBeatSyncRef.current, drumSpbRef.current);
    cancelCreationPlaylineWapi(
      {
        drumAnimRef: labMpcDrumPlaylineAnimRef,
        pianoAnimRef: labMpcPianoPlaylineAnimRef,
        drumQuantGlowAnimRef: labMpcQuantGlowAnimRef,
      },
      el,
      pel,
      null,
    );
    displayBeatRef.current = drumPlayhead;
    originBeatRef.current = drumPlayhead;
    setCreationPlaylineTransformStatic({
      drumEl: el,
      pianoEl: pel,
      drumQuantGlowEl: null,
      beatNow: drumPlayhead,
      subdiv: 1,
      pcols: mpcSteps,
      drumColW: Math.max(1, cellSize),
      pianoColW: pcw,
      loopOn: false,
      loopStartBeat: 0,
      loopEndBeat: 0,
      playMode: 'chainAB',
    });
  }, [drumPlayhead, mpcSteps, cellSize, labMpcTransport]);

  const goMpcKitDelta = useCallback((d: number) => {
    const i = kitIndex(mpcKitId);
    const list = LAB_MPC_KIT_LIST;
    if (i < 0) return;
    const ni = (i + d + list.length) % list.length;
    setMpcKitId(list[ni]!.id);
  }, [mpcKitId]);

  const applyMpcStepCell = useCallback(
    (row: number, col: number, on: boolean) => {
      setPattern((prev) => prev.map((r, ri) => (ri === row ? r.map((v, j) => (j === col ? on : v)) : r)));
    },
    [setPattern],
  );

  const auditionPad = useCallback(
    (row: number) => {
      const ctx = getAudioContext();
      if (!ctx) return;
      const slot = ensureLabMpcKitLoaded(mpcKitId, ctx);
      void slot.readyPromise.then(() => {
        const t = ctx.currentTime + 0.02;
        playLabMpcPad(ctx, mpcKitId, row, t, 0.9, {
          tuneSemi: mpcPadTuneSemi[row],
          lpCutoffHz: mpcPadLpHz[row],
          drive: mpcPadDrive[row],
          level: mpcPadLevel[row],
        });
      });
    },
    [getAudioContext, mpcKitId, mpcPadTuneSemi, mpcPadLpHz, mpcPadDrive, mpcPadLevel],
  );

  const onMpcStepPointerDown = useCallback(
    (row: number, col: number, cur: boolean) => {
      const next = !cur;
      applyMpcStepCell(row, col, next);
      mpcStepPaintRef.current = { target: next };
      if (next) auditionPad(row);
    },
    [applyMpcStepCell, auditionPad],
  );

  const applyDrumPreset = useCallback(
    (presetId: string) => {
      const p = labMpcDrumPresetById(presetId);
      if (!p) return;
      setMpcBars(4);
      setMpcQuant('sixteenth');
      if (presetLoadKitAndBpm) {
        setMpcKitId('trapDark');
        setMpcDrumBpmOverride(Math.max(40, Math.min(220, Math.round(p.suggestedBpm))));
      }
      setPattern(() => p.grid.map((row) => [...row]));
      setDrumPlayhead(0);
      setPresetMenuKey((k) => k + 1);
    },
    [setPattern, presetLoadKitAndBpm],
  );

  const onMpcStepPointerEnter = useCallback(
    (row: number, col: number) => {
      const p = mpcStepPaintRef.current;
      if (!p) return;
      applyMpcStepCell(row, col, p.target);
    },
    [applyMpcStepCell],
  );

  const loadState = getLabMpcKitLoadState(mpcKitId);

  return (
    <div
      style={{
        padding: '6px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ fontSize: 9, lineHeight: 1.2, color: '#94a3b8', flexShrink: 0 }}>
        Purple = bar · ruler 1…N per bar.
        {loadState === 'loading' && (
          <span style={{ marginLeft: 8, color: '#fcd34d' }} key={mpcKitUiTick}>
            Loading kit…
          </span>
        )}
        {loadState === 'failed' && <span style={{ marginLeft: 8, color: '#f87171' }}>Kit load failed — retry from kit list</span>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" aria-label="Previous kit" onClick={() => goMpcKitDelta(-1)} style={{ ...btnGhost, padding: '8px 10px' }}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label="Next kit" onClick={() => goMpcKitDelta(1)} style={{ ...btnGhost, padding: '8px 10px' }}>
            <ChevronRight size={18} />
          </button>
          <select value={mpcKitId} onChange={(e) => setMpcKitId(e.target.value as LabMpcKitId)} style={{ ...selectStyle, minWidth: 220 }}>
            {LAB_MPC_KIT_LIST.map((k) => (
              <option key={k.id} value={k.id}>
                {k.title}
              </option>
            ))}
          </select>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#71717a' }}>SEARCH KITS</span>
          <input
            value={mpcKitSearch}
            onChange={(e) => setMpcKitSearch(e.target.value)}
            placeholder="Filter…"
            style={{ ...selectStyle, minWidth: 140 }}
          />
        </label>
        {mpcKitSearch.trim() && filteredKits.length > 0 && (
          <select
            value={filteredKits.some((k) => k.id === mpcKitId) ? mpcKitId : filteredKits[0]!.id}
            onChange={(e) => setMpcKitId(e.target.value as LabMpcKitId)}
            style={{ ...selectStyle, minWidth: 200 }}
          >
            {filteredKits.map((k) => (
              <option key={k.id} value={k.id}>
                {k.title}
              </option>
            ))}
          </select>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#71717a' }}>LOOP (BARS)</span>
          <select
            value={mpcBars}
            onChange={(e) => setMpcBars(+e.target.value as (typeof MPC_BAR_LOOP_OPTIONS)[number])}
            style={selectStyle}
            title={`How many musical Bars in the loop. Each Bar has as many grid columns as the quantization (4…32 straight, 12 / 24 triplet).`}
          >
            {MPC_BAR_LOOP_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} Bars
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#71717a' }}>QUANT (DAW)</span>
          <select value={mpcQuant} onChange={(e) => setMpcQuant(e.target.value as MpcQuant)} style={selectStyle}>
            <option value="beat">1/4 — 4 columns between each Bar line</option>
            <option value="eighth">1/8 — 8 columns between each Bar line</option>
            <option value="sixteenth">1/16 — 16 columns between each Bar line</option>
            <option value="thirtysecond">1/32 — 32 columns between each Bar line</option>
            <option value="triplet_eighth">1/8 triplet — 12 columns between each Bar line</option>
            <option value="triplet_sixteenth">1/16 triplet — 24 columns between each Bar line</option>
          </select>
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => setMpcBankSlot('A')} style={{ ...(mpcBankSlot === 'A' ? btnPrimary : btnGhost) }}>
            Bank A
          </button>
          <button type="button" onClick={() => setMpcBankSlot('B')} style={{ ...(mpcBankSlot === 'B' ? btnPrimary : btnGhost) }}>
            Bank B
          </button>
        </div>
        <span style={{ fontSize: 11, color: '#71717a' }}>
          {mpcSteps} steps · {barLoopCount} Bars · {spb} steps/Bar
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#71717a' }}>BPM</span>
          <input
            type="number"
            min={40}
            max={220}
            value={mpcDrumBpmOverride ?? Math.round(labStripBpm)}
            disabled={mpcDrumBpmOverride == null}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!Number.isFinite(v)) return;
              setMpcDrumBpmOverride(Math.max(40, Math.min(220, v)));
            }}
            style={{ width: 72, padding: '8px 10px', borderRadius: 8, border: '1px solid #3f3f46', background: '#18181b', color: '#fde68a', fontWeight: 800 }}
          />
        </label>
        <button type="button" onClick={() => setMpcDrumBpmOverride(null)} style={btnGhost}>
          Sync lab BPM
        </button>
        <button type="button" onClick={() => setMpcDrumBpmOverride(Math.max(40, Math.min(220, Math.round(labStripBpm))))} style={btnGhost}>
          Edit local BPM
        </button>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'nowrap',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 4,
            background: '#0a0a0e',
            border: '1px solid #2a2a32',
          }}
          title="808 Lab MPC transport (mirrors Beat Lab)"
        >
          <button
            type="button"
            onClick={() => {
              labMpcSeekColumn0();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              flexShrink: 0,
              border: 'none',
              borderRadius: 6,
              background: '#101014',
              color: '#8aa0b5',
              cursor: 'pointer',
            }}
            title="Return to start"
          >
            <SkipBack size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              labMpcPauseRequestedRef.current = false;
              if (labMpcTransport === 'paused') {
                syncLabMpcFullStop();
              }
              setLabMpcTransport('stopped');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              flexShrink: 0,
              border: 'none',
              borderRadius: 6,
              background: '#101014',
              color: '#8aa0b5',
              cursor: 'pointer',
            }}
            title="Stop"
          >
            <Square size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (labMpcTransport === 'playing') {
                labMpcPauseRequestedRef.current = true;
                setLabMpcTransport('paused');
                return;
              }
              labMpcPauseRequestedRef.current = false;
              setLabMpcTransport('playing');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 36,
              flexShrink: 0,
              border: 'none',
              borderRadius: 6,
              background:
                labMpcTransport === 'playing'
                  ? 'rgba(0, 229, 255, 0.18)'
                  : 'linear-gradient(145deg, #1e3a5f, #122032)',
              color: labMpcTransport === 'playing' ? '#5eead4' : '#cffafe',
              boxShadow:
                labMpcTransport === 'playing' ? 'inset 0 0 0 1px rgba(94,234,212,0.35)' : '0 0 18px rgba(0,229,255,0.12)',
              cursor: 'pointer',
            }}
            title={
              labMpcTransport === 'playing'
                ? 'Pause playback'
                : labMpcTransport === 'paused'
                  ? 'Resume'
                  : 'Play'
            }
          >
            {labMpcTransport === 'playing' ? <Pause size={20} /> : <Play size={20} />}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDrumPlayReverse((r) => !r)}
          style={{ ...btnGhost, borderColor: drumPlayReverse ? '#22c55e' : '#3f3f46' }}
        >
          {drumPlayReverse ? '◀ Rev on' : '▶ Fwd'}
        </button>
        <button
          type="button"
          onClick={() => {
            setPattern(() => emptyGrid(mpcSteps));
            setDrumPlayhead(0);
          }}
          style={btnGhost}
        >
          Clear bank
        </button>
      </div>

      <div
        ref={mpcSeqViewportRef}
        style={{
          flex: '1 1 auto',
          minHeight: 220,
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          scrollbarGutter: 'stable',
          borderRadius: 10,
          border: '1px solid #2a2a32',
          background: '#08080c',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            minWidth: '100%',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${mpcSteps}, ${cellSize}px)`,
              columnGap: 0,
              rowGap: 0,
              width: 'max-content',
              paddingLeft: MPC_LANE_RAIL_PX,
              boxSizing: 'content-box',
              minHeight: MPC_BAR_STRIP_MIN_H,
              height: MPC_BAR_STRIP_MIN_H,
              paddingBottom: 0,
              alignItems: 'stretch',
            }}
          >
            {Array.from({ length: barLoopCount }, (_, bi) => {
              const barNum = bi + 1;
              const barBigFs = Math.min(11, Math.max(8, Math.round(cellSize * 0.38)));
              const colStart = bi * spb + 1;
              return (
                <button
                  key={`bar-${bi}`}
                  type="button"
                  onClick={() => setDrumPlayhead(bi * spb)}
                  style={{
                    gridColumn: `${colStart} / span ${spb}`,
                    gridRow: 1,
                    height: MPC_BAR_STRIP_MIN_H,
                    minHeight: MPC_BAR_STRIP_MIN_H,
                    minWidth: 0,
                    fontWeight: 800,
                    color: '#a1a1aa',
                    background: 'transparent',
                    border: 'none',
                    borderLeft: bi === 0 ? `1px solid ${DRUM_GRID_CELL_BASE}` : `2px solid ${ROLL_GRID_MEASURE}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: '0 2px',
                    display: 'flex',
                    alignItems: 'center',
                    boxSizing: 'border-box',
                  }}
                  title={`Bar ${barNum} of ${barLoopCount} — ${spb} columns per bar (${barNum}/${barLoopCount}). Click to cue playhead.`}
                >
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 2, lineHeight: 1 }}>
                    <span
                      style={{
                        fontSize: barBigFs,
                        fontWeight: 900,
                        color: '#fde68a',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {barNum}
                    </span>
                    <span style={{ fontSize: 6, fontWeight: 800, color: '#71717a', letterSpacing: '0.04em' }}>bar</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${mpcSteps}, ${cellSize}px)`,
              columnGap: 0,
              rowGap: 0,
              width: 'max-content',
              paddingLeft: MPC_LANE_RAIL_PX,
              boxSizing: 'content-box',
              height: MPC_TICK_ROW_H,
              minHeight: MPC_TICK_ROW_H,
              alignItems: 'stretch',
            }}
          >
            {Array.from({ length: mpcSteps }, (_, s) => {
              const stpb = stepsPerBeat(spb);
              const atBeat = s % stpb === 0;
              /** Studio One–style: 1…spb within each musical bar. */
              const idxInBar = (s % spb) + 1;
              return (
                <div
                  key={`tick-${s}`}
                  style={{
                    gridColumn: s + 1,
                    gridRow: 1,
                    width: '100%',
                    minWidth: 0,
                    height: MPC_TICK_ROW_H,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: tickStepFontPx,
                    fontWeight: 800,
                    lineHeight: 1,
                    boxSizing: 'border-box',
                    fontVariantNumeric: 'tabular-nums',
                    overflow: 'hidden',
                    color: atBeat ? '#fde68a' : '#52525b',
                    borderTop: `1px solid ${DRUM_GRID_CELL_BASE}`,
                    borderRight: `1px solid ${DRUM_GRID_CELL_BASE}`,
                    borderBottom: `1px solid ${DRUM_GRID_CELL_BASE}`,
                    borderLeft: drumGridLeftBorder(s, spb),
                  }}
                >
                  {idxInBar}
                </div>
              );
            })}
          </div>
          {Array.from({ length: LAB_MPC_PAD_COUNT }, (__, row) => (
            <div
              key={`lane-${row}`}
              style={{
                display: 'grid',
                gridTemplateColumns: `${MPC_LANE_RAIL_PX}px repeat(${mpcSteps}, ${cellSize}px)`,
                columnGap: 0,
                rowGap: 0,
                width: 'max-content',
                alignItems: 'stretch',
                borderTop: '1px solid #1c1c24',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMpcEditPad(row);
                  auditionPad(row);
                }}
                style={{
                  gridColumn: 1,
                  gridRow: 1,
                  width: '100%',
                  minWidth: 0,
                  minHeight: mpcLaneRowH,
                  height: mpcLaneRowH,
                  padding: '2px 6px',
                  fontSize: 9,
                  fontWeight: mpcEditPad === row ? 900 : 700,
                  textAlign: 'left',
                  border: 'none',
                  borderRight: '1px solid #27272f',
                  background: mpcEditPad === row ? '#1e293b' : '#12121a',
                  color: mpcEditPad === row ? '#fde68a' : '#a1a1aa',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={labMpcPadLabel(mpcKitId, row)}
              >
                {row + 1}. {labMpcPadLabel(mpcKitId, row)}
              </button>
              {Array.from({ length: mpcSteps }, (_, col) => {
                const on = !!pattern[row]?.[col];
                return (
                  <button
                    key={`c-${row}-${col}`}
                    type="button"
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      onMpcStepPointerDown(row, col, on);
                    }}
                    onPointerEnter={() => onMpcStepPointerEnter(row, col)}
                    style={{
                      gridColumn: col + 2,
                      gridRow: 1,
                      width: '100%',
                      minWidth: 0,
                      height: mpcLaneRowH,
                      padding: 0,
                      margin: 0,
                      borderRadius: 0,
                      boxSizing: 'border-box',
                      borderTop: `1px solid ${DRUM_GRID_CELL_BASE}`,
                      borderRight: `1px solid ${DRUM_GRID_CELL_BASE}`,
                      borderBottom: `1px solid ${DRUM_GRID_CELL_BASE}`,
                      borderLeft: drumGridLeftBorder(col, spb),
                      background: on ? 'linear-gradient(180deg,#22c55e,#14532d)' : '#0f0f14',
                      cursor: 'crosshair',
                    }}
                  />
                );
              })}
            </div>
          ))}
          {(() => {
            const ph = Math.max(0, Math.min(mpcSteps - 1, drumPlayhead));
            const atBarStart = labMpcTransport === 'stopped' && ph % spb === 0;
            const w = labMpcTransport === 'playing' ? 2 : atBarStart ? 3 : 2;
            const boxShadow = labMpcTransport === 'playing'
              ? '0 0 8px rgba(74,222,128,0.75)'
              : atBarStart
                ? '0 0 12px rgba(74,222,128,0.95), 0 0 2px rgba(255,255,255,0.35)'
                : '0 0 8px rgba(74,222,128,0.7)';
            return (
              <div
                ref={labMpcDrumPlaylineRef}
                aria-hidden
                style={{
                  position: 'absolute',
                  pointerEvents: 'none',
                  top: 0,
                  left: MPC_LANE_RAIL_PX,
                  width: w,
                  bottom: 0,
                  background: 'linear-gradient(180deg, #d9f99d 0%, #4ade80 35%, #22c55e 100%)',
                  boxShadow,
                  zIndex: 5,
                  transition: labMpcTransport === 'playing' ? 'none' : 'transform 70ms ease-out, width 70ms ease-out, box-shadow 70ms ease-out',
                }}
              />
            );
          })()}
        </div>
      </div>

      <div
        title="Presets are 4 bars @ 1/16. Uncheck = pattern only; Sync / Edit local BPM for tempo."
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          borderRadius: 8,
          border: '1px solid #27272f',
          background: '#0c0c12',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 900, color: '#71717a', whiteSpace: 'nowrap' }}>STARTER</span>
        <select
          key={presetMenuKey}
          defaultValue=""
          onChange={(e) => {
            const id = e.target.value;
            if (id) applyDrumPreset(id);
          }}
          style={{
            ...selectStyle,
            minWidth: 200,
            maxWidth: 'min(360px, 100%)',
            padding: '4px 8px',
            fontSize: 11,
            minHeight: 28,
          }}
        >
          <option value="">Load groove…</option>
          {LAB_MPC_DRUM_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} (~{p.suggestedBpm} BPM)
            </option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#a1a1aa', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={presetLoadKitAndBpm} onChange={(e) => setPresetLoadKitAndBpm(e.target.checked)} />
          Trap kit + BPM
        </label>
      </div>

      <div
        style={{
          borderRadius: 10,
          border: '1px solid #27272f',
          padding: '6px 8px',
          background: '#0f0f14',
          flexShrink: 1,
          minHeight: 0,
          maxHeight: 'min(26vh, 200px)',
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 900, color: '#71717a', marginBottom: 4 }}>
          PAD FX — {labMpcPadLabel(mpcKitId, mpcEditPad)} (pad {mpcEditPad + 1})
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#71717a' }}>TUNE (semi)</span>
            <input
              type="range"
              min={-24}
              max={24}
              step={1}
              value={mpcPadTuneSemi[mpcEditPad] ?? 0}
              onChange={(e) => {
                const v = +e.target.value;
                setMpcPadTuneSemi((prev) => {
                  const next = [...prev];
                  next[mpcEditPad] = v;
                  return next;
                });
              }}
              style={{ width: 160 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#71717a' }}>LP (Hz)</span>
            <input
              type="range"
              min={400}
              max={20000}
              step={50}
              value={mpcPadLpHz[mpcEditPad] ?? 20000}
              onChange={(e) => {
                const v = +e.target.value;
                setMpcPadLpHz((prev) => {
                  const next = [...prev];
                  next[mpcEditPad] = v;
                  return next;
                });
              }}
              style={{ width: 160 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#71717a' }}>DRIVE</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={mpcPadDrive[mpcEditPad] ?? 0}
              onChange={(e) => {
                const v = +e.target.value;
                setMpcPadDrive((prev) => {
                  const next = [...prev];
                  next[mpcEditPad] = v;
                  return next;
                });
              }}
              style={{ width: 120 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#71717a' }}>LEVEL</span>
            <input
              type="range"
              min={0.2}
              max={1.5}
              step={0.02}
              value={mpcPadLevel[mpcEditPad] ?? 1}
              onChange={(e) => {
                const v = +e.target.value;
                setMpcPadLevel((prev) => {
                  const next = [...prev];
                  next[mpcEditPad] = v;
                  return next;
                });
              }}
              style={{ width: 120 }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const fx = labMpcKitInitialPadFx(mpcKitId);
              setMpcPadTuneSemi((p) => {
                const n = [...p];
                n[mpcEditPad] = fx.tuneSemi[mpcEditPad] ?? 0;
                return n;
              });
              setMpcPadLpHz((p) => {
                const n = [...p];
                n[mpcEditPad] = fx.lpCutoffHz[mpcEditPad] ?? 20000;
                return n;
              });
              setMpcPadDrive((p) => {
                const n = [...p];
                n[mpcEditPad] = fx.drive[mpcEditPad] ?? 0;
                return n;
              });
              setMpcPadLevel((p) => {
                const n = [...p];
                n[mpcEditPad] = fx.level[mpcEditPad] ?? 1;
                return n;
              });
            }}
            style={btnGhost}
          >
            Reset pad to kit default
          </button>
        </div>
      </div>

      {labMpcKitMeta(mpcKitId) && (
        <div style={{ fontSize: 11, color: '#52525b' }}>
          {labMpcKitMeta(mpcKitId)!.era} · {filteredKits.length} kits match filter
        </div>
      )}
    </div>
  );
});

export default EightZeroEightLabDrumMachine;
