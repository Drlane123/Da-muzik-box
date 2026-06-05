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
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
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
import { readLab808GrooveClock } from '@/app/lib/creationStation/lab808GrooveClock';
import { GROOVE_LAB_SLOTS_PER_BAR } from '@/app/lib/creationStation/grooveLabRoll';
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
import { snap808LabLoopBars } from '@/app/lib/creationStation/lab808ChordRoots';
import {
  CB_PIANO_BG,
  CB_PIANO_MINT,
  CB_PIANO_MINT_BORDER,
  CB_PIANO_MINT_BG,
  LAB808_PIANO_LABEL_W,
  LAB808_PIANO_PX_PER_BEAT,
  LAB808_PIANO_PX_PER_BEAT_MIN,
  LAB808_PIANO_RULER_H,
  LAB808_PIANO_ROW_H,
} from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import {
  labMpcCellInRegion,
  labMpcDuplicateRegion,
  labMpcEraseRegion,
  labMpcExtractClip,
  labMpcPasteClip,
  labMpcRegionFromPoints,
  labMpcRegionHasHits,
  type LabMpcGridRegion,
  type LabMpcPatternClip,
} from '@/app/lib/creationStation/labMpcPatternEdit';
import {
  lab808BpmInputStyle,
  lab808BtnGhost,
  lab808BtnPrimary,
  lab808RollActionBtnStyle,
  lab808RollBpmInputStyle,
  lab808RollSelect,
  lab808RollToolbarLabel,
  lab808RollTransportButtonStyle,
  lab808RollTransportCluster,
  lab808Select,
  lab808TransportButtonStyle,
  LAB808_ROLL_TRANSPORT_BTN,
  LAB808_ROLL_TRANSPORT_H,
  LAB808_ROLL_TRANSPORT_ICON,
  LAB808_ROLL_TRANSPORT_PLAY_W,
  LAB808_TRANSPORT_BTN,
  LAB808_TRANSPORT_BTN_PLAY,
  LAB808_TRANSPORT_ICON,
} from '@/app/lib/creationStation/lab808UiTheme';
import { GrooveLabExportStrip } from '@/app/components/creation/GrooveLabExportStrip';
import type { Lab808DrumExportSnapshot } from '@/app/lib/creationStation/lab808Export';
import { lab808PatternHasHits } from '@/app/lib/creationStation/lab808Export';

/** Mirrors Creation Station `LocalTransportState` for the MPC deck (no count-in / record). */
export type Lab808DeckTransportState = 'stopped' | 'playing' | 'paused';

type LabMpcTransportState = Lab808DeckTransportState;

export interface EightZeroEightLabDrumMachineProps {
  /** When false, playback stops and kit prefetch is idle. */
  active: boolean;
  /** When true while `active` is false (808 piano-roll tab), transport + lookahead keep running — mirrors MPC clock on the roll. */
  transportKeepAlive?: boolean;
  /** Show the 16-lane drum step roll (808 Lab drum kits bank). */
  sequencerVisible?: boolean;
  /** Trim chrome — kit picker lives on the pad deck; shared transport on kick/bass roll. */
  embeddedIn808Lab?: boolean;
  /** Master gain for scheduled + preview hits (separate from 808 kick/bass roll level). */
  masterLevel?: number;
  mpcKitId?: LabMpcKitId;
  onMpcKitIdChange?: (id: LabMpcKitId) => void;
  /** Optional piano-roll playhead element — driven by same WAPI timeline as MPC playline (step beats × quarter spacing). */
  rollPlaylineRef?: RefObject<HTMLElement | null>;
  /** Live px-per-quarter-note from the piano roll (updated when zoom changes). */
  rollPxPerBeat?: number;
  /** Full piano-roll timeline in quarter beats (808 kick/bass tab). */
  rollLayoutBeats?: number;
  /** Musical loop length in quarter beats — playhead loops seamlessly here. */
  rollLoopBeats?: number;
  /** When set, expands the MPC loop to at least this many bars (chord progression / roll length). */
  suggestedLoopBars?: number;
  /**
   * Called for each scheduled transport step — `quarterBeat` is piano-roll beats
   * (4/4 quarters); `spb` is MPC steps-per-bar for tolerance math.
   */
  /** Exact audio-time refill for locked chord roots (Groove grid or MPC session). */
  onRefillLockedRoots?: (
    ctx: AudioContext,
    ctSnap: number,
    mpc: {
      sessionStart: number;
      originStepBeat: number;
      stepSpb: number;
      stepsPerBar: number;
    },
  ) => void;
  /** When true, MPC play anchors to `readLab808GrooveClock()` (Session Link / PLAY → Groove). */
  alignTransportToGrooveClock?: boolean;
  /** After Groove-aligned play starts — prime beat-0 roots that mirror play would miss. */
  onAfterGrooveAlignedPlay?: (ctx: AudioContext) => void;
  /** Notify parent when transport changes so the roll toolbar can mirror controls. */
  onTransportChange?: (state: Lab808DeckTransportState) => void;
  /** rAF — piano-roll quarter-beat position while transport runs (root pad / note glow). */
  onRollDisplayQuarterBeatRef?: MutableRefObject<((quarterBeat: number) => void) | undefined>;
  isScreenActive?: boolean;
  getAudioContext: () => AudioContext | null;
  labStripBpm: number;
  /** When set, drum roll uses this BPM (808 LINK — kick/bass + drums same tempo). */
  linkedPlaybackBpm?: number;
  /** Shared with Kick/Bass roll — lit Sync when user synced or typed a custom BPM. */
  labBpmOverrideActive?: boolean;
  onLabBpmSyncReset?: () => void;
  onLabBpmOverride?: (bpm: number) => void;
  drumExportBusy?: boolean;
  drumExportStatus?: string | null;
  onDrumExportMidi?: () => void;
  onDrumExportWav?: () => void | Promise<void>;
  onDrumExportToPad?: () => void;
  drumPadExportEnabled?: boolean;
  drumPadPickerOpen?: boolean;
}

export interface Lab808DrumTransportHandle {
  transportSeekStart: () => void;
  /** Seek MPC transport + mirrored roll playhead to `beat` quarter-note position on the piano roll. */
  transportSeekToRollQuarterBeat: (beat: number) => void;
  transportStop: () => void;
  transportTogglePlayPause: () => void;
  getDrumExportSnapshot: () => Lab808DrumExportSnapshot;
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

const btnPrimary = lab808BtnPrimary;
const btnGhost = lab808BtnGhost;
const selectStyle: CSSProperties = { ...lab808Select, minWidth: 180 };

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

/** MPC transport step (one grid column) → 808 kick/bass quarter beat. */
function mpcStepBeatToQuarterBeat(stepBeat: number, spb: number): number {
  return (stepBeat * 4) / Math.max(1, spb);
}

function quarterBeatInLoop(quarterBeat: number, loopLen: number): number {
  const len = Math.max(1e-6, loopLen);
  return ((quarterBeat % len) + len) % len;
}

const EightZeroEightLabDrumMachine = forwardRef(function EightZeroEightLabDrumMachine(
  {
    active,
    transportKeepAlive = false,
    sequencerVisible = true,
    embeddedIn808Lab = false,
    masterLevel = 1,
    mpcKitId: mpcKitIdProp,
    onMpcKitIdChange,
    rollPlaylineRef,
    rollPxPerBeat = 52,
    rollLayoutBeats = 16,
    rollLoopBeats = 16,
    suggestedLoopBars,
    onRefillLockedRoots,
    alignTransportToGrooveClock = false,
    onAfterGrooveAlignedPlay,
    onTransportChange,
    onRollDisplayQuarterBeatRef,
    isScreenActive,
    getAudioContext,
    labStripBpm,
    linkedPlaybackBpm,
    labBpmOverrideActive = false,
    onLabBpmSyncReset,
    onLabBpmOverride,
    drumExportBusy = false,
    drumExportStatus = null,
    onDrumExportMidi,
    onDrumExportWav,
    onDrumExportToPad,
    drumPadExportEnabled = false,
    drumPadPickerOpen = false,
  }: EightZeroEightLabDrumMachineProps,
  ref: ForwardedRef<Lab808DrumTransportHandle>,
) {
  const deckPumpActive = active || transportKeepAlive;
  const embedCompact = embeddedIn808Lab && sequencerVisible;
  /** Match 808 Kick / Bass roll metrics — larger ruler, lanes, and step cells (scroll when needed). */
  const barStripH = embedCompact ? LAB808_PIANO_RULER_H : MPC_BAR_STRIP_MIN_H;
  const tickRowH = embedCompact ? 20 : MPC_TICK_ROW_H;
  const gridRulerTotalPx = barStripH + tickRowH;
  const laneRailPx = embedCompact ? LAB808_PIANO_LABEL_W : MPC_LANE_RAIL_PX;

  /** Embed toolbar matches Groove Lab / Beat Lab piano-roll chip sizes. */
  const embedToolBtn: CSSProperties = embedCompact
    ? lab808RollActionBtnStyle('#27272f', '#fde68a', '#52525b')
    : btnGhost;
  const embedSelect: CSSProperties = embedCompact ? lab808RollSelect : selectStyle;
  const embedToolbarLabel: CSSProperties = embedCompact ? lab808RollToolbarLabel : { fontSize: 13, fontWeight: 800, color: '#71717a' };
  const embedTransportBtn = embedCompact ? LAB808_ROLL_TRANSPORT_BTN : LAB808_TRANSPORT_BTN;
  const embedTransportPlay = embedCompact ? LAB808_ROLL_TRANSPORT_PLAY_W : LAB808_TRANSPORT_BTN_PLAY;
  const embedTransportH = embedCompact ? LAB808_ROLL_TRANSPORT_H : LAB808_TRANSPORT_BTN;
  const embedTransportIcon = embedCompact ? LAB808_ROLL_TRANSPORT_ICON : LAB808_TRANSPORT_ICON;
  const embedTransportBtnStyle = embedCompact ? lab808RollTransportButtonStyle : lab808TransportButtonStyle;
  const embedBpmInputStyle = embedCompact ? lab808RollBpmInputStyle : lab808BpmInputStyle;

  const [mpcKitIdInner, setMpcKitIdInner] = useState<LabMpcKitId>('trapDark');
  const mpcKitId = mpcKitIdProp ?? mpcKitIdInner;
  const setMpcKitId = onMpcKitIdChange ?? setMpcKitIdInner;
  const masterLevelRef = useRef(masterLevel);
  masterLevelRef.current = masterLevel;
  const [mpcKitSearch, setMpcKitSearch] = useState('');
  const [mpcBars, setMpcBars] = useState<(typeof MPC_BAR_LOOP_OPTIONS)[number]>(4);

  useEffect(() => {
    if (suggestedLoopBars == null || suggestedLoopBars <= 0) return;
    const snapped = snap808LabLoopBars(suggestedLoopBars) as (typeof MPC_BAR_LOOP_OPTIONS)[number];
    setMpcBars((prev) => (snapped > prev ? snapped : prev));
  }, [suggestedLoopBars]);
  const [mpcQuant, setMpcQuant] = useState<MpcQuant>('sixteenth');
  const [mpcBankSlot, setMpcBankSlot] = useState<'A' | 'B'>('A');
  const [mpcPatternA, setMpcPatternA] = useState<boolean[][]>(() => emptyGrid(4 * 16));
  const [mpcPatternB, setMpcPatternB] = useState<boolean[][]>(() => emptyGrid(4 * 16));
  const [mpcKitUiTick, setMpcKitUiTick] = useState(0);
  const [labMpcTransport, setLabMpcTransport] = useState<LabMpcTransportState>('stopped');
  const [drumPlayhead, setDrumPlayhead] = useState(0);
  const [drumPlayReverse, setDrumPlayReverse] = useState(false);
  const [mpcDrumBpmOverride, setMpcDrumBpmOverride] = useState<number | null>(null);

  /** Match 808 Kick/Bass transport Sync — gray until synced or manual BPM; lit when override active. */
  const drumSyncActive = embeddedIn808Lab ? labBpmOverrideActive : mpcDrumBpmOverride != null;
  const resetDrumBpmSync = useCallback(() => {
    if (embeddedIn808Lab) {
      onLabBpmSyncReset?.();
    } else {
      setMpcDrumBpmOverride(null);
    }
  }, [embeddedIn808Lab, onLabBpmSyncReset]);

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
  const mpcClipboardRef = useRef<LabMpcPatternClip | null>(null);
  const mpcContextMenuRef = useRef<HTMLDivElement | null>(null);
  const mpcSelectDragRef = useRef<{
    active: boolean;
    anchorRow: number;
    anchorCol: number;
  } | null>(null);
  const mpcPastePendingRef = useRef(false);
  const [mpcSelection, setMpcSelection] = useState<LabMpcGridRegion | null>(null);
  const [mpcContextMenu, setMpcContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [mpcPastePending, setMpcPastePending] = useState(false);
  const [mpcGridTool, setMpcGridTool] = useState<'draw' | 'erase'>('draw');
  const [mpcClipboardReady, setMpcClipboardReady] = useState(false);
  mpcPastePendingRef.current = mpcPastePending;
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
  const barLoopCountRef = useRef(4);
  const mpcBankSlotRef = useRef<'A' | 'B'>('A');
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
  const drumExportHasHits = useMemo(() => lab808PatternHasHits(pattern), [pattern]);

  drumPlayReverseRef.current = drumPlayReverse;
  mpcPatternRef.current = pattern;
  mpcKitIdRef.current = mpcKitId;
  mpcPadFxRef.current = { tune: mpcPadTuneSemi, lp: mpcPadLpHz, drive: mpcPadDrive, level: mpcPadLevel };

  const drumPlaybackBpm = Math.max(
    40,
    Math.min(
      220,
      linkedPlaybackBpm != null
        ? Math.round(linkedPlaybackBpm)
        : mpcDrumBpmOverride ?? Math.round(labStripBpm),
    ),
  );
  drumBpmRef.current = drumPlaybackBpm;
  drumSpbRef.current = spb;
  barLoopCountRef.current = barLoopCount;
  mpcBankSlotRef.current = mpcBankSlot;
  drumPlayheadRef.current = drumPlayhead;
  mpcTransportBpmRef.current = (drumPlaybackBpm * Math.max(1, spb)) / 4;
  labMpcTransportRef.current = labMpcTransport;

  const filteredKits = useMemo(() => {
    const q = mpcKitSearch.trim().toLowerCase();
    if (!q) return LAB_MPC_KIT_LIST;
    return LAB_MPC_KIT_LIST.filter((k) => `${k.title} ${k.id} ${k.era}`.toLowerCase().includes(q));
  }, [mpcKitSearch]);

  /** Step width when grid stretches to fill the viewport (808 Lab embed). */
  const mpcStretchGrid = embedCompact && seqViewportW > 0;

  const cellSize = useMemo(() => {
    const gutter = embedCompact ? 12 : 8;
    const availForSteps = Math.max(0, seqViewportW - laneRailPx - gutter);
    if (mpcSteps <= 0) return MPC_MIN_CELL_PX;
    let raw = Math.floor(availForSteps / mpcSteps);
    raw = Math.min(embedCompact ? 64 : 52, Math.max(MPC_MIN_CELL_PX, raw));
    while (raw > MPC_MIN_CELL_PX && mpcSteps * raw > availForSteps) {
      raw -= 1;
    }
    return raw;
  }, [embedCompact, seqViewportW, mpcSteps, laneRailPx]);

  const mpcEffectiveColW = useMemo(() => {
    if (!mpcStretchGrid) return cellSize;
    const gutter = 12;
    const avail = Math.max(0, seqViewportW - laneRailPx - gutter);
    return Math.max(MPC_MIN_CELL_PX, avail / Math.max(1, mpcSteps));
  }, [mpcStretchGrid, seqViewportW, laneRailPx, mpcSteps, cellSize]);

  cellSizeRef.current = mpcEffectiveColW;

  const mpcLaneColTemplate = mpcStretchGrid
    ? `${laneRailPx}px repeat(${mpcSteps}, minmax(8px, 1fr))`
    : `${laneRailPx}px repeat(${mpcSteps}, ${cellSize}px)`;
  const mpcGridRowWidth = mpcStretchGrid ? '100%' : 'max-content';
  /** Step index `s` (0-based) → grid column (lane rail = col 1). */
  const mpcStepGridCol = (step: number) => step + 2;
  /** Bar index `bi` (0-based) → grid column start (lane rail = col 1). */
  const mpcBarGridColStart = (bi: number) => bi * spb + 2;

  const tickStepFontPx = useMemo(() => {
    const w = mpcStretchGrid ? mpcEffectiveColW : cellSize;
    if (embedCompact) return Math.max(9, Math.min(12, Math.round(w * 0.4)));
    return Math.max(4, Math.min(7, Math.round(w * 0.32)));
  }, [cellSize, embedCompact, mpcEffectiveColW, mpcStretchGrid]);

  const mpcLaneRowH = useMemo(() => {
    const measuredH = seqViewportH > 48 ? seqViewportH : embedCompact ? 380 : 320;
    const inner = Math.max(0, measuredH - gridRulerTotalPx);
    const raw = Math.floor(inner / LAB_MPC_PAD_COUNT);
    if (embedCompact) {
      return Math.max(18, Math.min(40, raw));
    }
    return Math.max(8, Math.min(30, raw));
  }, [seqViewportH, gridRulerTotalPx, embedCompact]);

  const mpcStepOnBg = embedCompact
    ? `linear-gradient(180deg, rgba(124, 244, 198, 0.72), rgba(124, 244, 198, 0.32))`
    : 'linear-gradient(180deg,#22c55e,#14532d)';
  const mpcStepOffBg = embedCompact ? '#0a0a10' : '#0f0f14';
  const mpcKitTitle = useMemo(() => labMpcKitMeta(mpcKitId)?.title ?? mpcKitId, [mpcKitId]);

  const onRefillLockedRootsRef = useRef(onRefillLockedRoots);
  onRefillLockedRootsRef.current = onRefillLockedRoots;
  const alignToGrooveClockRef = useRef(alignTransportToGrooveClock);
  alignToGrooveClockRef.current = alignTransportToGrooveClock;
  const onAfterGrooveAlignedPlayRef = useRef(onAfterGrooveAlignedPlay);
  onAfterGrooveAlignedPlayRef.current = onAfterGrooveAlignedPlay;

  const fireLabMpcStep = useCallback((k: number, idealGridT: number, ctx: AudioContext) => {
    const pat = mpcPatternRef.current;
    const steps = Math.max(1, pat[0]?.length ?? 1);
    const kit = mpcKitIdRef.current;
    const fx = mpcPadFxRef.current;
    const rev = drumPlayReverseRef.current;
    const k0 = kStartRef.current;
    const d = k - k0;
    const col = rev ? ((k0 - d) % steps + steps) % steps : ((k0 + d) % steps) % steps;
    const whenSnap = Math.max(idealGridT, ctx.currentTime + 0.001);
    for (let row = 0; row < LAB_MPC_PAD_COUNT; row += 1) {
      if (pat[row]?.[col]) {
        playLabMpcPad(ctx, kit, row, whenSnap, 0.95, {
          tuneSemi: fx.tune[row] ?? 0,
          lpCutoffHz: fx.lp[row] ?? 20000,
          drive: fx.drive[row] ?? 0,
          level: (fx.level[row] ?? 1) * masterLevelRef.current,
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
    const sess = sessionStartRef.current;
    if (sess > 0) {
      onRefillLockedRootsRef.current?.(ctx, ctSnap, {
        sessionStart: sess,
        originStepBeat: originBeatRef.current,
        stepSpb,
        stepsPerBar: drumSpbRef.current,
      });
    }
  }, [fireLabMpcStep]);

  refillLabMpcScheduleRef.current = refillLabMpcSchedule;

  const rollPxBeatSyncRef = useRef(rollPxPerBeat);
  rollPxBeatSyncRef.current = rollPxPerBeat;
  const rollLayoutBeatsRef = useRef(rollLayoutBeats);
  rollLayoutBeatsRef.current = rollLayoutBeats;
  const rollLoopBeatsRef = useRef(rollLoopBeats);
  rollLoopBeatsRef.current = rollLoopBeats;
  /** 808 kick/bass piano roll — quarter-beat playhead (not MPC step columns). */
  const mirror808KickBassRoll = rollPlaylineRef != null;

  const launchLabMpcPlaylineWapiNow = useCallback(
    (beatNow: number, play: boolean) => {
      const el = labMpcDrumPlaylineRef.current;
      const pianoEl = rollPlaylineRef?.current ?? null;
      if (!el && !pianoEl) return;
      const ctx = ctxRef.current;
      const leadSec = LAB_MPC_PLAYLINE_WAPI_LEAD_SEC + labMpcPlaylineOutputDacLeadSec(ctx);
      const wapiRefs = {
          drumAnimRef: labMpcDrumPlaylineAnimRef,
          pianoAnimRef: labMpcPianoPlaylineAnimRef,
          drumQuantGlowAnimRef: labMpcQuantGlowAnimRef,
      };

      if (mirror808KickBassRoll && pianoEl && !el) {
        const spb = drumSpbRef.current;
        const quarterBeat = mpcStepBeatToQuarterBeat(beatNow, spb);
        const loopLen = Math.max(1e-6, rollLoopBeatsRef.current);
        const layoutLen = Math.max(loopLen, rollLayoutBeatsRef.current);
        const rollBpm = Math.max(1, drumBpmRef.current);
        const qbLoop = quarterBeatInLoop(quarterBeat, loopLen);
        const beatForWapi = play ? qbLoop + leadSec * (rollBpm / 60) : qbLoop;
        launchCreationPlaylineWapi(wapiRefs, {
          drumEl: null,
          pianoEl,
          drumQuantGlowEl: null,
          beatNow: beatForWapi,
          play,
          bpm: rollBpm,
          subdiv: 1,
          pcols: Math.max(1, Math.ceil(layoutLen)),
          drumColW: 1,
          pianoColW: Math.max(1, rollPxBeatSyncRef.current),
          loopOn: true,
          loopStartBeat: 0,
          loopEndBeat: loopLen,
          playMode: 'chainAB',
          immediateCompositorStart: play,
        });
        return;
      }

      const cw = Math.max(1, cellSizeRef.current);
      const pcw = rollPlaylineColW(rollPxPerBeat, drumSpbRef.current);
      const pc = Math.max(1, mpcPatternRef.current[0]?.length ?? 1);
      const bpmR = Math.max(1, mpcTransportBpmRef.current);
      const beatForWapi = play ? beatNow + leadSec * (bpmR / 60) : beatNow;
      launchCreationPlaylineWapi(wapiRefs, {
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
      });
        },
    [mirror808KickBassRoll, rollPlaylineRef, rollPxPerBeat],
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
      if (mirror808KickBassRoll && pelStop && !elStop) {
        const spbStop = drumSpbRef.current;
        const qb = mpcStepBeatToQuarterBeat(b, spbStop);
        const loopLen = Math.max(1e-6, rollLoopBeatsRef.current);
        const layoutLen = Math.max(loopLen, rollLayoutBeatsRef.current);
        const rollBpm = Math.max(1, drumBpmRef.current);
        const qbLine = rev ? qb : qb + leadSec * (rollBpm / 60);
        setCreationPlaylineTransformStatic({
          drumEl: null,
          pianoEl: pelStop,
          drumQuantGlowEl: null,
          beatNow: qbLine,
          subdiv: 1,
          pcols: Math.max(1, Math.ceil(layoutLen)),
          drumColW: 1,
          pianoColW: Math.max(1, rollPxBeatSyncRef.current),
          loopOn: true,
          loopStartBeat: 0,
          loopEndBeat: loopLen,
          playMode: 'chainAB',
        });
      } else {
        const pcwStop = rollPlaylineColW(rollPxBeatSyncRef.current, drumSpbRef.current);
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
    }
    labMpcSkipNextStoppedPlaylineSyncRef.current = true;
  }, [mirror808KickBassRoll, rollPlaylineRef]);

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
      getDrumExportSnapshot: (): Lab808DrumExportSnapshot => {
        const pat = mpcPatternRef.current.map((row) => row.slice());
        const fx = mpcPadFxRef.current;
        return {
          pattern: pat,
          kitId: mpcKitIdRef.current,
          bpm: drumBpmRef.current,
          stepsPerBar: drumSpbRef.current,
          barCount: barLoopCountRef.current,
          masterLevel: masterLevelRef.current,
          padFx: {
            tuneSemi: fx.tune.slice(),
            lpCutoffHz: fx.lp.slice(),
            drive: fx.drive.slice(),
            level: fx.level.slice(),
          },
          bankSlot: mpcBankSlotRef.current,
        };
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
    const spbFrame = drumSpbRef.current;
    const quarterBeat = bDisplay * (Math.max(1, spbFrame) / 4);
    onRollDisplayQuarterBeatRef?.current?.(quarterBeat);
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
      const spbFrame = drumSpbRef.current;
      const pcw = mirror808KickBassRoll
        ? Math.max(1, rollPxBeatSyncRef.current)
        : rollPlaylineColW(rollPxBeatSyncRef.current, spbFrame);
      const qb = mpcStepBeatToQuarterBeat(bDisplay, spbFrame);
      const x = (mirror808KickBassRoll ? qb : colF) * pcw - CREATION_PIANO_PLAYLINE_CENTER_X;
      pel.style.willChange = 'transform';
      pel.style.transform = `translate3d(${x}px, 0, 0)`;
    }
  };

  useLayoutEffect(() => {
    const el = mpcSeqViewportRef.current;
    if (!el || !sequencerVisible) return;
    const apply = () => {
      setSeqViewportW(el.clientWidth);
      setSeqViewportH(el.clientHeight);
    };
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    apply();
    return () => ro.disconnect();
  }, [active, sequencerVisible]);

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
    if (isScreenActive === false && !transportKeepAlive && labMpcTransport === 'playing') {
      labMpcPauseRequestedRef.current = true;
      setLabMpcTransport('paused');
    }
  }, [isScreenActive, transportKeepAlive, labMpcTransport]);

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
    let origin = Math.max(0, displayBeatRef.current);
    let sessionStart = tCapture + SE2_AUDIO_START_FLOOR_SEC;
    if (alignToGrooveClockRef.current) {
      const gc = readLab808GrooveClock();
      if (gc && gc.sessionStart > 0) {
        sessionStart = gc.sessionStart;
        const slotsPerBeat = GROOVE_LAB_SLOTS_PER_BAR / 4;
        const originQuarter = gc.originSlot / Math.max(1, slotsPerBeat);
        const gridSpb = drumSpbRef.current;
        origin = (originQuarter * gridSpb) / 4;
      }
    }
    originBeatRef.current = origin;
    displayBeatRef.current = origin;
    sessionStartRef.current = sessionStart;
    const stepSpb = 60 / Math.max(1, mpcTransportBpmRef.current);
    const k0 = Math.ceil(origin - 1e-8);
    nextStepBeatRef.current = k0;
    nextStepTimeRef.current = sessionStartRef.current + (k0 - origin) * stepSpb;
    lastScheduledQuarterRef.current = k0 - 1;
    kStartRef.current = k0;
    runningRef.current = true;
    void ctx.resume().catch(() => {});
    refillLabMpcScheduleRef.current(ctx, tCapture);
    if (alignToGrooveClockRef.current) {
      queueMicrotask(() => {
        if (!runningRef.current) return;
        const c = ctxRef.current;
        if (!c || c.state === 'closed') return;
        const ct = Math.max(0, c.currentTime);
        onAfterGrooveAlignedPlayRef.current?.(c);
        refillLabMpcScheduleRef.current(c, ct);
      });
    }
    const tPost = Math.max(0, ctx.currentTime);
    const beatLaunch = beatAtSessionTime(tPost, sessionStartRef.current, originBeatRef.current, mpcTransportBpmRef.current);
    displayBeatRef.current = beatLaunch;
    launchLabMpcPlaylineWapiNow(beatLaunch, true);
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
      isScreenActive: deckPumpActive,
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
  }, [labMpcTransport, deckPumpActive, drumPlayReverse, cellSize, mpcSteps, drumPlaybackBpm, spb, rollPxPerBeat, rollLayoutBeats, rollLoopBeats, launchLabMpcPlaylineWapiNow]);

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
    if (mirror808KickBassRoll && pel && !el) {
      const b = displayBeatRef.current;
      const spbStop = drumSpbRef.current;
      const qb = mpcStepBeatToQuarterBeat(b, spbStop);
      const loopLen = Math.max(1e-6, rollLoopBeatsRef.current);
      const layoutLen = Math.max(loopLen, rollLayoutBeatsRef.current);
      setCreationPlaylineTransformStatic({
        drumEl: null,
        pianoEl: pel,
        drumQuantGlowEl: null,
        beatNow: qb,
        subdiv: 1,
        pcols: Math.max(1, Math.ceil(layoutLen)),
        drumColW: 1,
        pianoColW: Math.max(1, rollPxBeatSyncRef.current),
        loopOn: true,
        loopStartBeat: 0,
        loopEndBeat: loopLen,
        playMode: 'chainAB',
      });
      return;
    }
    displayBeatRef.current = drumPlayhead;
    originBeatRef.current = drumPlayhead;
    const pcw = rollPlaylineColW(rollPxBeatSyncRef.current, drumSpbRef.current);
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
  }, [drumPlayhead, mpcSteps, cellSize, labMpcTransport, mirror808KickBassRoll, rollPlaylineRef]);

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

  const closeMpcContextMenu = useCallback(() => setMpcContextMenu(null), []);

  const resolveMpcActionRegion = useCallback((): LabMpcGridRegion | null => {
    if (mpcSelection && labMpcRegionHasHits(pattern, mpcSelection)) return mpcSelection;
    if (mpcSelection) return mpcSelection;
    const col = Math.max(0, Math.min(mpcSteps - 1, drumPlayhead));
    return labMpcRegionFromPoints(0, col, LAB_MPC_PAD_COUNT - 1, col, LAB_MPC_PAD_COUNT, mpcSteps);
  }, [mpcSelection, pattern, mpcSteps, drumPlayhead]);

  const copyMpcSelection = useCallback(() => {
    const region = resolveMpcActionRegion();
    if (!region || !labMpcRegionHasHits(pattern, region)) return false;
    mpcClipboardRef.current = labMpcExtractClip(pattern, region);
    setMpcClipboardReady(true);
    return true;
  }, [pattern, resolveMpcActionRegion]);

  const pasteMpcClipboardAt = useCallback(
    (destRow0: number, destCol0: number) => {
      const clip = mpcClipboardRef.current;
      if (!clip) return false;
      const col = Math.max(0, Math.min(mpcSteps - clip.w, destCol0));
      const row = Math.max(0, Math.min(LAB_MPC_PAD_COUNT - clip.h, destRow0));
      setPattern((prev) => labMpcPasteClip(prev, clip, row, col));
      setMpcSelection({
        row0: row,
        row1: row + clip.h - 1,
        col0: col,
        col1: col + clip.w - 1,
      });
      setMpcPastePending(false);
      return true;
    },
    [mpcSteps, setPattern],
  );

  const pasteMpcClipboard = useCallback(() => {
    if (!mpcClipboardRef.current) return false;
    const region = mpcSelection;
    const destCol = region?.col0 ?? Math.max(0, Math.min(mpcSteps - 1, drumPlayhead));
    const destRow = region?.row0 ?? 0;
    return pasteMpcClipboardAt(destRow, destCol);
  }, [drumPlayhead, mpcSelection, mpcSteps, pasteMpcClipboardAt]);

  const duplicateMpcSelection = useCallback(() => {
    const region = resolveMpcActionRegion();
    if (!region || !labMpcRegionHasHits(pattern, region)) return false;
    const result = labMpcDuplicateRegion(pattern, region, mpcSteps);
    if (!result) return false;
    setPattern(() => result.pattern);
    setMpcSelection(result.region);
    return true;
  }, [pattern, mpcSteps, resolveMpcActionRegion, setPattern]);

  const eraseMpcSelection = useCallback(() => {
    const region = mpcSelection;
    if (!region) return false;
    setPattern((prev) => labMpcEraseRegion(prev, region));
    return true;
  }, [mpcSelection, setPattern]);

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
          level: mpcPadLevel[row] * masterLevelRef.current,
        });
      });
    },
    [getAudioContext, mpcKitId, mpcPadTuneSemi, mpcPadLpHz, mpcPadDrive, mpcPadLevel],
  );

  const onMpcStepPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>, row: number, col: number, cur: boolean) => {
      if (e.button === 2) {
        e.preventDefault();
        if (!labMpcCellInRegion(mpcSelection, row, col)) {
          setMpcSelection(
            labMpcRegionFromPoints(row, col, row, col, LAB_MPC_PAD_COUNT, mpcSteps),
          );
        }
        setMpcContextMenu({ x: e.clientX, y: e.clientY });
        return;
      }
      closeMpcContextMenu();
      if (mpcPastePendingRef.current && e.button === 0) {
        e.preventDefault();
        pasteMpcClipboardAt(row, col);
        return;
      }
      if (e.shiftKey && e.button === 0) {
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
        mpcSelectDragRef.current = { active: true, anchorRow: row, anchorCol: col };
        setMpcSelection(
          labMpcRegionFromPoints(row, col, row, col, LAB_MPC_PAD_COUNT, mpcSteps),
        );
        mpcStepPaintRef.current = null;
        return;
      }
      if (mpcGridTool === 'erase' && e.button === 0) {
        applyMpcStepCell(row, col, false);
        mpcStepPaintRef.current = { target: false };
        return;
      }
      const next = !cur;
      applyMpcStepCell(row, col, next);
      mpcStepPaintRef.current = { target: next };
      if (next) auditionPad(row);
    },
    [
      applyMpcStepCell,
      auditionPad,
      closeMpcContextMenu,
      mpcGridTool,
      mpcSelection,
      mpcSteps,
      pasteMpcClipboardAt,
    ],
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
      const sel = mpcSelectDragRef.current;
      if (sel?.active) {
        setMpcSelection(
          labMpcRegionFromPoints(
            sel.anchorRow,
            sel.anchorCol,
            row,
            col,
            LAB_MPC_PAD_COUNT,
            mpcSteps,
          ),
        );
        return;
      }
      const p = mpcStepPaintRef.current;
      if (!p) return;
      applyMpcStepCell(row, col, p.target);
    },
    [applyMpcStepCell, mpcSteps],
  );

  useEffect(() => {
    const endSelectDrag = () => {
      mpcSelectDragRef.current = null;
      mpcStepPaintRef.current = null;
    };
    window.addEventListener('pointerup', endSelectDrag);
    window.addEventListener('pointercancel', endSelectDrag);
    return () => {
      window.removeEventListener('pointerup', endSelectDrag);
      window.removeEventListener('pointercancel', endSelectDrag);
    };
  }, []);

  useEffect(() => {
    if (!sequencerVisible) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'c') {
        if (copyMpcSelection()) e.preventDefault();
        return;
      }
      if (mod && e.key.toLowerCase() === 'v') {
        if (mpcClipboardRef.current) {
          e.preventDefault();
          if (!pasteMpcClipboard()) setMpcPastePending(true);
        }
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        if (duplicateMpcSelection()) e.preventDefault();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (eraseMpcSelection()) e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    copyMpcSelection,
    duplicateMpcSelection,
    eraseMpcSelection,
    pasteMpcClipboard,
    sequencerVisible,
  ]);

  useEffect(() => {
    if (!mpcContextMenu) return;
    const close = (e: PointerEvent) => {
      const menu = mpcContextMenuRef.current;
      if (menu?.contains(e.target as Node)) return;
      closeMpcContextMenu();
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('blur', close);
    };
  }, [closeMpcContextMenu, mpcContextMenu]);

  const mpcActionBtn = embedCompact ? embedToolBtn : btnGhost;
  const mpcEditBtn = (active?: boolean): CSSProperties => ({
    ...mpcActionBtn,
    borderColor: active ? '#ca8a04' : '#3f3f46',
    background: active ? 'color-mix(in srgb, #ca8a04 18%, #12121a)' : undefined,
  });

  const mpcEditToolbar = (
    <>
      <button
        type="button"
        onClick={() => {
          if (mpcSelection && labMpcRegionHasHits(pattern, mpcSelection)) {
            eraseMpcSelection();
          } else {
            setMpcGridTool((t) => (t === 'erase' ? 'draw' : 'erase'));
          }
        }}
        style={mpcEditBtn(mpcGridTool === 'erase')}
        title="Erase selection (Delete) or erase-brush — click steps to remove hits"
      >
        Erase
      </button>
      <button
        type="button"
        onClick={() => copyMpcSelection()}
        style={mpcActionBtn}
        title="Copy selection (Ctrl+C) — Shift+drag to highlight"
      >
        Copy
      </button>
      <button
        type="button"
        onClick={() => {
          if (!pasteMpcClipboard()) setMpcPastePending(true);
        }}
        style={mpcEditBtn(mpcPastePending)}
        disabled={!mpcClipboardReady}
        title={
          mpcClipboardReady
            ? 'Paste (Ctrl+V) — then click top-left cell, or pastes at playhead'
            : 'Copy a region first'
        }
      >
        Paste
      </button>
      <button
        type="button"
        onClick={() => duplicateMpcSelection()}
        style={mpcActionBtn}
        title="Duplicate to next empty block (Ctrl+D)"
      >
        Duplicate
      </button>
    </>
  );

  const loadState = getLabMpcKitLoadState(mpcKitId);

  return (
    <div
      style={
        sequencerVisible
          ? {
              padding: embeddedIn808Lab ? 0 : '10px 12px',
        display: 'flex',
        flexDirection: 'column',
              gap: embeddedIn808Lab ? 0 : 10,
              flex: '1 1 0',
        minHeight: 0,
              height: embeddedIn808Lab ? '100%' : undefined,
        minWidth: 0,
        overflow: 'hidden',
              border: embeddedIn808Lab ? `1px solid ${CB_PIANO_MINT_BORDER}` : undefined,
              background: embeddedIn808Lab ? CB_PIANO_BG : undefined,
              color: embeddedIn808Lab ? '#d0d0d0' : undefined,
              fontFamily: embeddedIn808Lab ? "'Inter', system-ui, sans-serif" : undefined,
            }
          : {
              position: 'absolute',
              width: 0,
              height: 0,
              overflow: 'hidden',
              pointerEvents: 'none',
            }
      }
      aria-hidden={!sequencerVisible}
    >
      {sequencerVisible ? (
        <>
      {!embeddedIn808Lab ? (
      <div style={{ fontSize: 12, lineHeight: 1.35, color: '#94a3b8', flexShrink: 0 }}>
        Purple = bar · ruler 1…N per bar.
        {loadState === 'loading' && (
          <span style={{ marginLeft: 8, color: '#fcd34d' }} key={mpcKitUiTick}>
            Loading kit…
          </span>
        )}
        {loadState === 'failed' && <span style={{ marginLeft: 8, color: '#f87171' }}>Kit load failed — retry from kit list</span>}
      </div>
      ) : null}

      {!embeddedIn808Lab ? (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" aria-label="Previous kit" onClick={() => goMpcKitDelta(-1)} style={btnGhost}>
            <ChevronLeft size={22} />
          </button>
          <button type="button" aria-label="Next kit" onClick={() => goMpcKitDelta(1)} style={btnGhost}>
            <ChevronRight size={22} />
          </button>
          <select value={mpcKitId} onChange={(e) => setMpcKitId(e.target.value as LabMpcKitId)} style={{ ...selectStyle, minWidth: 240 }}>
            {LAB_MPC_KIT_LIST.map((k) => (
              <option key={k.id} value={k.id}>
                {k.title}
              </option>
            ))}
          </select>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#71717a' }}>SEARCH KITS</span>
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
      ) : null}

      {embedCompact ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            flexShrink: 0,
            padding: '6px 10px',
            margin: 0,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(0,0,0,0.30)',
            letterSpacing: '0.04em',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', width: '100%' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#8a8a98',
              flex: '1 1 140px',
              minWidth: 120,
              lineHeight: 1.35,
            }}
          >
            <span style={{ color: CB_PIANO_MINT }}>Drum step roll</span>
            {loadState === 'loading' ? (
              <span style={{ color: '#fcd34d' }} key={mpcKitUiTick}>
                {' '}
                · Loading…
              </span>
            ) : null}
          </span>
          <div
            style={
              embedCompact
                ? { ...lab808RollTransportCluster, background: '#0a0a0e', border: '1px solid #2a2a32', boxShadow: 'none' }
                : {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: '#0a0a0e',
                    border: '1px solid #2a2a32',
                    flexShrink: 0,
                  }
            }
            title="808 Lab MPC transport (same clock as Kick/Bass roll)"
          >
            <button
              type="button"
              onClick={() => labMpcSeekColumn0()}
              style={{ ...embedTransportBtnStyle(), width: embedTransportBtn, height: embedTransportH }}
              title="Start"
            >
              <SkipBack size={embedTransportIcon} />
            </button>
            <button
              type="button"
              onClick={() => {
                labMpcPauseRequestedRef.current = false;
                if (labMpcTransport === 'paused') syncLabMpcFullStop();
                setLabMpcTransport('stopped');
              }}
              style={{ ...embedTransportBtnStyle(), width: embedTransportBtn, height: embedTransportH }}
              title="Stop"
            >
              <Square size={embedTransportIcon} fill={embedCompact ? 'currentColor' : undefined} />
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
                ...embedTransportBtnStyle(labMpcTransport === 'playing'),
                width: embedTransportPlay,
                height: embedTransportH,
                ...(embedCompact
                  ? {}
                  : {
                      background:
                        labMpcTransport === 'playing'
                          ? 'rgba(0, 229, 255, 0.18)'
                          : 'linear-gradient(145deg, #1e3a5f, #122032)',
                      color: labMpcTransport === 'playing' ? '#5eead4' : '#cffafe',
                    }),
              }}
              title={labMpcTransport === 'playing' ? 'Pause' : 'Play'}
            >
              {labMpcTransport === 'playing' ? (
                <Pause size={embedTransportIcon} fill={embedCompact ? 'currentColor' : undefined} />
              ) : (
                <Play size={embedTransportIcon} fill={embedCompact ? 'currentColor' : undefined} />
              )}
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <label style={embedToolbarLabel}>
            Bars
            <select
              value={mpcBars}
              onChange={(e) => setMpcBars(+e.target.value as (typeof MPC_BAR_LOOP_OPTIONS)[number])}
              style={embedSelect}
            >
              {MPC_BAR_LOOP_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label style={embedToolbarLabel}>
            Quant
            <select value={mpcQuant} onChange={(e) => setMpcQuant(e.target.value as MpcQuant)} style={embedSelect}>
              <option value="beat">1/4</option>
              <option value="eighth">1/8</option>
              <option value="sixteenth">1/16</option>
              <option value="thirtysecond">1/32</option>
              <option value="triplet_eighth">1/8t</option>
              <option value="triplet_sixteenth">1/16t</option>
            </select>
          </label>
          <button type="button" onClick={() => setMpcBankSlot('A')} style={mpcBankSlot === 'A' ? btnPrimary : embedToolBtn}>
            A
          </button>
          <button type="button" onClick={() => setMpcBankSlot('B')} style={mpcBankSlot === 'B' ? btnPrimary : embedToolBtn}>
            B
          </button>
          <label style={embedToolbarLabel}>
            BPM
            <input
              type="number"
              min={40}
              max={220}
              value={Math.round(labStripBpm)}
              readOnly={embeddedIn808Lab ? false : mpcDrumBpmOverride == null}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isFinite(v)) return;
                const clamped = Math.max(40, Math.min(220, v));
                if (embeddedIn808Lab && onLabBpmOverride) {
                  onLabBpmOverride(clamped);
                } else {
                  setMpcDrumBpmOverride(clamped);
                }
              }}
              onClick={() => {
                if (!embeddedIn808Lab && mpcDrumBpmOverride == null) {
                  setMpcDrumBpmOverride(Math.max(40, Math.min(220, Math.round(labStripBpm))));
                }
              }}
              style={embedBpmInputStyle({
                readOnly: embeddedIn808Lab ? false : mpcDrumBpmOverride == null,
              })}
              title={
                embeddedIn808Lab
                  ? '808 Lab tempo (shared with Kick/Bass when 808 LINK is on)'
                  : 'Tap to edit local drum BPM; Sync resets to lab BPM'
              }
            />
          </label>
          <button
            type="button"
            onClick={resetDrumBpmSync}
            disabled={!drumSyncActive}
            style={{
              ...embedToolBtn,
              opacity: drumSyncActive ? 1 : 0.35,
              cursor: drumSyncActive ? 'pointer' : 'default',
            }}
            title={
              drumSyncActive
                ? 'Reset to auto tempo (808 LINK shares with Kick/Bass)'
                : 'Following auto tempo — pick BPM → target and SYNC in pad header, or type a custom BPM'
            }
          >
            Sync
          </button>
          </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: embedCompact ? 6 : 10, alignItems: 'center', width: '100%' }}>
          <button
            type="button"
            onClick={() => setDrumPlayReverse((r) => !r)}
            style={{ ...embedToolBtn, borderColor: drumPlayReverse ? '#22c55e' : '#3f3f46' }}
            title="Reverse play direction"
          >
            {drumPlayReverse ? 'Rev' : 'Fwd'}
          </button>
          {mpcEditToolbar}
          <button
            type="button"
            onClick={() => {
              setPattern(() => emptyGrid(mpcSteps));
              setDrumPlayhead(0);
              setMpcSelection(null);
            }}
            style={embedToolBtn}
            title="Clear entire bank pattern"
          >
            Clear
          </button>
          {onDrumExportMidi || onDrumExportWav || onDrumExportToPad ? (
            <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <GrooveLabExportStrip
                toolbarInline
                showExportLabel
                widerButtons
                busy={drumExportBusy}
                status={drumExportStatus}
                hasChords={drumExportHasHits}
                hasRollNotes={drumExportHasHits}
                onExportMidi={onDrumExportMidi}
                onExportWav={onDrumExportWav}
                onExportToPad={onDrumExportToPad}
                padExportEnabled={drumPadExportEnabled}
                padPickerOpen={drumPadPickerOpen}
              />
            </div>
          ) : null}
          </div>
        </div>
      ) : (
        <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={embedToolbarLabel}>LOOP (BARS)</span>
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
          <span style={embedToolbarLabel}>QUANT (DAW)</span>
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
        <span style={{ fontSize: 13, color: '#71717a', fontWeight: 700 }}>
          {mpcSteps} steps · {barLoopCount} Bars · {spb} steps/Bar
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={embedToolbarLabel}>BPM</span>
          <input
            type="number"
            min={40}
            max={220}
            value={mpcDrumBpmOverride ?? Math.round(labStripBpm)}
            readOnly={mpcDrumBpmOverride == null}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!Number.isFinite(v)) return;
              setMpcDrumBpmOverride(Math.max(40, Math.min(220, v)));
            }}
            style={lab808BpmInputStyle({ readOnly: mpcDrumBpmOverride == null })}
            title={mpcDrumBpmOverride == null ? 'Following lab BPM — click Edit local BPM to change' : 'Local drum BPM'}
          />
        </label>
        <button
          type="button"
          onClick={resetDrumBpmSync}
          disabled={!drumSyncActive}
          style={{
            ...btnGhost,
            opacity: drumSyncActive ? 1 : 0.35,
            cursor: drumSyncActive ? 'pointer' : 'default',
          }}
        >
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
            gap: 6,
            padding: '8px 12px',
            borderRadius: 8,
            background: '#0a0a0e',
            border: '1px solid #2a2a32',
          }}
          title="808 Lab drum roll transport"
        >
          <button
            type="button"
            onClick={() => labMpcSeekColumn0()}
            style={{ ...lab808TransportButtonStyle(), width: embedTransportBtn, height: embedTransportBtn }}
            title="Return to start"
          >
            <SkipBack size={embedTransportIcon} />
          </button>
          <button
            type="button"
            onClick={() => {
              labMpcPauseRequestedRef.current = false;
              if (labMpcTransport === 'paused') syncLabMpcFullStop();
              setLabMpcTransport('stopped');
            }}
            style={{ ...lab808TransportButtonStyle(), width: embedTransportBtn, height: embedTransportBtn }}
            title="Stop"
          >
            <Square size={embedTransportIcon} />
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
              ...lab808TransportButtonStyle(labMpcTransport === 'playing'),
              width: embedTransportPlay,
              height: embedTransportBtn,
              background:
                labMpcTransport === 'playing'
                  ? 'rgba(0, 229, 255, 0.18)'
                  : 'linear-gradient(145deg, #1e3a5f, #122032)',
              color: labMpcTransport === 'playing' ? '#5eead4' : '#cffafe',
              boxShadow:
                labMpcTransport === 'playing' ? 'inset 0 0 0 1px rgba(94,234,212,0.35)' : '0 0 18px rgba(0,229,255,0.12)',
            }}
            title={labMpcTransport === 'playing' ? 'Pause' : 'Play'}
          >
            {labMpcTransport === 'playing' ? <Pause size={embedTransportIcon} /> : <Play size={embedTransportIcon} />}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDrumPlayReverse((r) => !r)}
          style={{ ...btnGhost, borderColor: drumPlayReverse ? '#22c55e' : '#3f3f46' }}
        >
          {drumPlayReverse ? '◀ Rev on' : '▶ Fwd'}
        </button>
        {mpcEditToolbar}
        <button
          type="button"
          onClick={() => {
            setPattern(() => emptyGrid(mpcSteps));
            setDrumPlayhead(0);
            setMpcSelection(null);
          }}
          style={btnGhost}
          title="Clear entire bank pattern"
        >
          Clear bank
        </button>
      </div>
        </>
      )}

      <div
        ref={mpcSeqViewportRef}
        style={{
          flex: '1 1 0',
          minHeight: embedCompact ? 340 : 220,
          height: embedCompact ? '100%' : undefined,
          minWidth: 0,
          overflowX: embedCompact ? 'hidden' : 'auto',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          scrollbarGutter: 'stable',
          borderRadius: embedCompact ? 0 : 10,
          border: embedCompact ? 'none' : '1px solid #2a2a32',
          background: embedCompact ? CB_PIANO_BG : '#08080c',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            width: mpcGridRowWidth,
            minWidth: mpcStretchGrid ? '100%' : '100%',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: mpcLaneColTemplate,
              columnGap: 0,
              rowGap: 0,
              width: mpcGridRowWidth,
              boxSizing: 'border-box',
              minHeight: barStripH,
              height: barStripH,
              alignItems: 'stretch',
            }}
          >
            <div
              aria-hidden
              style={{
                gridColumn: 1,
                gridRow: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: embedCompact ? 9 : 8,
                fontWeight: 900,
                letterSpacing: '0.08em',
                color: '#52525b',
                borderRight: embedCompact ? `1px solid ${CB_PIANO_MINT_BORDER}` : '1px solid #27272f',
                background: '#12121a',
              }}
            >
              BAR
            </div>
            {Array.from({ length: barLoopCount }, (_, bi) => {
              const barNum = bi + 1;
              const barW = mpcStretchGrid ? mpcEffectiveColW : cellSize;
              const barBigFs = embedCompact
                ? Math.min(13, Math.max(10, Math.round(barW * 0.42)))
                : Math.min(11, Math.max(8, Math.round(barW * 0.38)));
              const colStart = mpcBarGridColStart(bi);
              return (
                <button
                  key={`bar-${bi}`}
                  type="button"
                  onClick={() => setDrumPlayhead(bi * spb)}
                  style={{
                    gridColumn: `${colStart} / span ${spb}`,
                    gridRow: 1,
                    height: barStripH,
                    minHeight: barStripH,
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
                        color: embedCompact ? CB_PIANO_MINT : '#fde68a',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {barNum}
                    </span>
                    <span
                      style={{
                        fontSize: embedCompact ? 8 : 6,
                        fontWeight: 800,
                        color: '#71717a',
                        letterSpacing: '0.04em',
                      }}
                    >
                      bar
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: mpcLaneColTemplate,
              columnGap: 0,
              rowGap: 0,
              width: mpcGridRowWidth,
              boxSizing: 'border-box',
              height: tickRowH,
              minHeight: tickRowH,
              alignItems: 'stretch',
            }}
          >
            <div
              aria-hidden
              style={{
                gridColumn: 1,
                gridRow: 1,
                borderRight: embedCompact ? `1px solid ${CB_PIANO_MINT_BORDER}` : '1px solid #27272f',
                background: '#12121a',
              }}
            />
            {Array.from({ length: mpcSteps }, (_, s) => {
              const stpb = stepsPerBeat(spb);
              const atBeat = s % stpb === 0;
              /** Studio One–style: 1…spb within each musical bar. */
              const idxInBar = (s % spb) + 1;
              return (
                <div
                  key={`tick-${s}`}
                  style={{
                    gridColumn: mpcStepGridCol(s),
                    gridRow: 1,
                    width: '100%',
                    minWidth: 0,
                    height: tickRowH,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: tickStepFontPx,
                    fontWeight: 800,
                    lineHeight: 1,
                    boxSizing: 'border-box',
                    fontVariantNumeric: 'tabular-nums',
                    overflow: 'hidden',
                    color: atBeat ? (embedCompact ? CB_PIANO_MINT : '#fde68a') : '#52525b',
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
                gridTemplateColumns: mpcLaneColTemplate,
                columnGap: 0,
                rowGap: 0,
                width: mpcGridRowWidth,
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
                  padding: embedCompact ? '4px 8px' : '2px 6px',
                  fontSize: embedCompact ? 10 : 9,
                  fontWeight: mpcEditPad === row ? 900 : 700,
                  textAlign: 'left',
                  border: 'none',
                  borderRight: embedCompact ? `1px solid ${CB_PIANO_MINT_BORDER}` : '1px solid #27272f',
                  background: mpcEditPad === row ? 'rgba(124,244,198,0.12)' : '#12121a',
                  color: mpcEditPad === row ? CB_PIANO_MINT : '#a1a1aa',
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
                const inSel = labMpcCellInRegion(mpcSelection, row, col);
                return (
                  <button
                    key={`c-${row}-${col}`}
                    type="button"
                    onContextMenu={(e) => e.preventDefault()}
                    onPointerDown={(e) => {
                      if (e.button !== 2) {
                        try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                        } catch {
                          /* */
                        }
                      }
                      onMpcStepPointerDown(e, row, col, on);
                    }}
                    onPointerEnter={() => onMpcStepPointerEnter(row, col)}
                    style={{
                      gridColumn: mpcStepGridCol(col),
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
                      background: on ? mpcStepOnBg : mpcStepOffBg,
                      boxShadow: inSel
                        ? `inset 0 0 0 2px ${embedCompact ? CB_PIANO_MINT : '#38bdf8'}`
                        : undefined,
                      cursor: mpcPastePending ? 'copy' : mpcGridTool === 'erase' ? 'cell' : 'crosshair',
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
            const boxShadow = embedCompact
              ? labMpcTransport === 'playing'
                ? `0 0 10px rgba(124, 244, 198, 0.85)`
                : '0 0 8px rgba(124, 244, 198, 0.55)'
              : labMpcTransport === 'playing'
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
                  left: laneRailPx,
                  width: w,
                  bottom: 0,
                  background: embedCompact
                    ? `linear-gradient(180deg, ${CB_PIANO_MINT} 0%, rgba(124, 244, 198, 0.55) 100%)`
                    : 'linear-gradient(180deg, #d9f99d 0%, #4ade80 35%, #22c55e 100%)',
                  boxShadow,
                  zIndex: 5,
                  transition: labMpcTransport === 'playing' ? 'none' : 'transform 70ms ease-out, width 70ms ease-out, box-shadow 70ms ease-out',
                }}
              />
            );
          })()}
        </div>
      </div>

      {mpcContextMenu ? (
        <div
          ref={mpcContextMenuRef}
          role="menu"
          style={{
            position: 'fixed',
            left: mpcContextMenu.x,
            top: mpcContextMenu.y,
            zIndex: 10000,
            minWidth: 148,
            padding: 4,
            borderRadius: 8,
            border: '1px solid #3f3f46',
            background: '#18181b',
            boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {(
            [
              ['Copy', () => copyMpcSelection()],
              ['Paste', () => pasteMpcClipboard() || setMpcPastePending(true)],
              ['Duplicate', () => duplicateMpcSelection()],
              ['Erase', () => eraseMpcSelection()],
            ] as const
          ).map(([label, run]) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              disabled={label === 'Paste' && !mpcClipboardReady}
              onClick={() => {
                run();
                closeMpcContextMenu();
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                border: 'none',
                borderRadius: 6,
                background: 'transparent',
                color: '#e4e4e7',
                fontSize: 13,
                fontWeight: 700,
                cursor: label === 'Paste' && !mpcClipboardReady ? 'not-allowed' : 'pointer',
                opacity: label === 'Paste' && !mpcClipboardReady ? 0.45 : 1,
              }}
            >
              {label}
            </button>
          ))}
          <div style={{ fontSize: 10, color: '#71717a', padding: '4px 10px 2px', lineHeight: 1.35 }}>
            Shift+drag to select · Paste click places
          </div>
        </div>
      ) : null}

      {!embedCompact ? (
        <>
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
        </>
      ) : null}

      {labMpcKitMeta(mpcKitId) && !embeddedIn808Lab && (
        <div style={{ fontSize: 11, color: '#52525b' }}>
          {labMpcKitMeta(mpcKitId)!.era} · {filteredKits.length} kits match filter
        </div>
      )}
        </>
      ) : null}
    </div>
  );
});

export default EightZeroEightLabDrumMachine;
