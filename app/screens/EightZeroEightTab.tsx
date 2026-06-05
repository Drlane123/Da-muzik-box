import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Pause, Play, SkipBack, Square } from 'lucide-react';
import type { ChordMode, ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import {
  chordSymbolToMidi,
  chordSymbolToName,
  chordSymbolToRootMidi,
  coerceChordSymbolForMode,
  MODE_LABELS,
} from '@/app/lib/creationStation/chordBuilder';
import { readChordSync } from '@/app/lib/chordBuilderSync';
import {
  compute808LabLoopBeats,
  LAB808_ROOTS_IMPORTED_EVENT,
  manualRollNotesFrom808Import,
  midiTo808RollOctave,
  read808LabImportedRoots,
  lab808ActiveRootIndexAtBeat,
  lab808ProgressionRootAtRollMidi,
  progressionRootsToManualRollNotes,
  snap808LabLoopBars,
  type Lab808ProgressionRoot,
} from '@/app/lib/creationStation/lab808ChordRoots';
import {
  fetchLab808RootsForChordLockSource,
  lab808SourceHasProgressionSync,
  LAB808_CHORD_LOCK_SOURCE_LABELS,
  LAB808_CHORD_SOURCES_CHANGED_EVENT,
  readLab808ChordLockSource,
  resolveLab808RootsForSource,
  storeLab808ChordLockSource,
  type Lab808ChordLockSource,
} from '@/app/lib/creationStation/lab808ChordLockSources';
import { lab808BankAudible, lab808EffectiveLevel } from '@/app/lib/creationStation/lab808BankMuteSolo';
import {
  dispatchLab808TransportMirror,
  GROOVE_LAB_TRANSPORT_MIRROR_EVENT,
  readLab808BpmSyncTarget,
  readLab808InternalLink,
  readLab808TransportMirror,
  resolveLab808SyncBpm,
  storeLab808BpmSyncTarget,
  storeLab808InternalLink,
  storeLab808TransportMirror,
  LAB808_SYNC_CHANGED_EVENT,
  type GrooveLabTransportMirrorDetail,
  type Lab808BpmSyncTarget,
  type Lab808TransportMirrorAction,
  type Lab808TransportMirrorTarget,
} from '@/app/lib/creationStation/lab808Sync';
import {
  CREATION_BEATLAB_PLAY_MIRROR_EVENT,
  type CreationBeatlabPlayMirrorDetail,
} from '@/app/lib/creationStation/creationSessionLink';
import { auditionLab808LockedHarmony } from '@/app/lib/creationStation/lab808ChordPlayThrough';
import {
  primeLab808GrooveCycleCatchup,
  refillLab808LockedRoots,
} from '@/app/lib/creationStation/lab808ChordRootSchedule';
import { lab808BassCreatedName, lab808TrapKickCreatedName } from '@/app/lib/creationStation/lab808KickCatalog';
import {
  formatLab808KickDisplayLabel,
  lab808BtnGhost,
  lab808FilterRangeStyle,
  lab808RollActionBtnStyle,
  lab808RollBpmInputStyle,
  lab808RollChordNoteFont,
  lab808RollFxLabel,
  lab808RollSelect,
  lab808RollToolbarLabel,
  lab808RollTransportButtonStyle,
  lab808RollTransportCluster,
  lab808ToolbarBpmRow,
  LAB808_ROLL_TRANSPORT_BTN,
  LAB808_ROLL_TRANSPORT_H,
  LAB808_ROLL_TRANSPORT_ICON,
  LAB808_ROLL_TRANSPORT_PLAY_W,
} from '@/app/lib/creationStation/lab808UiTheme';
import {
  BASS_LOW_BASS_ORDER,
  BASS_LOW_BASS_PRESETS,
  EIGHT_ZERO_EIGHT_KICK_ROOT_MIDI,
  LAB808_FILTER_DEFAULT,
  TRAP_HOLD_808_ORDER,
  TRAP_HOLD_808_PRESETS,
  playEightZeroEight,
  pointerStrikeVelocity,
  type BassLowBassPresetId,
  type EightZeroEightPresetDef,
  type Lab808FilterFx,
  type Lab808SoundLane,
  type TrapHold808PresetId,
} from '@/app/lib/creationStation/eightZeroEightVoice';
import {
  CB_PIANO_BG,
  CB_PIANO_MINT,
  CB_PIANO_MINT_BG,
  CB_PIANO_MINT_BORDER,
  CB_PIANO_MINT_BORDER_STRONG,
  LAB808_PIANO_METRICS,
  LAB808_PIANO_PX_PER_BEAT,
  LAB808_PIANO_PX_PER_BEAT_MIN,
  cbPianoGridRowStyle,
  cbPianoKeyCellStyle,
  cbPianoKeyFaceStyle,
  cbPianoKeyLabel,
  cbPianoKeyRailOuterStyle,
  cbPianoPitchRowStyle,
  cbPianoManualNoteBodyStyle,
  cbPianoManualNoteResizeStyle,
  cbPianoNoteNameToMidi,
  cbPianoRulerBarStyle,
  cbPianoRulerLabelStyle,
  cbPianoRulerStyle,
  buildCbPianoRows,
} from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import {
  LAB808_QUANTIZE_OPTIONS,
  quantizeGridBeats,
  quantizeStepBeats,
  snapBeatToQuantize,
  isQuantizeBarLine,
  isQuantizeBeatLine,
  type Lab808Quantize,
} from '@/app/lib/creationStation/lab808RollQuantize';
import {
  lab808ToneRollDuplicateNotes,
  lab808ToneRollEraseRegion,
  lab808ToneRollExtractClip,
  lab808ToneRollNoteInRegion,
  lab808ToneRollNoteRegion,
  lab808ToneRollPasteClip,
  lab808ToneRollRegionFromPoints,
  lab808ToneRollRegionHasNotes,
  lab808ToneRollSnapNoteDuration,
  lab808ToneRollSnapNoteStart,
  type Lab808ToneRollClip,
  type Lab808ToneRollRegion,
} from '@/app/lib/creationStation/lab808ToneRollEdit';
import { Lab808DualPadDeck, type Lab808PadDeckBank } from '@/app/components/creation/Lab808DualPadDeck';
import { GrooveLabExportStrip } from '@/app/components/creation/GrooveLabExportStrip';
import { GrooveLabBeatLabPadPicker } from '@/app/components/creation/GrooveLabBeatLabPadPicker';
import type { LabMpcKitId } from '@/app/lib/creationStation/labMpcKits';
import {
  downloadLab808DrumMidi,
  downloadLab808DrumWav,
  downloadLab808ToneMidi,
  downloadLab808ToneWav,
  renderLab808DrumsToWav,
  renderLab808ToneToWav,
  type Lab808ToneExportNote,
} from '@/app/lib/creationStation/lab808Export';
import EightZeroEightLabDrumMachine, {
  type Lab808DeckTransportState,
  type Lab808DrumTransportHandle,
} from '@/app/screens/EightZeroEightLabDrumMachine';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

function coerceMode(m: string): ChordMode {
  return m in MODE_LABELS ? (m as ChordMode) : 'major';
}
export type EightZeroEightAnchor = 'root' | 'third' | 'fifth' | 'seventh' | 'lowest';
function resolveAnchorMidi(
  symbol: string,
  keyRoot: number,
  mode: ChordMode,
  anchor: EightZeroEightAnchor,
  octaveShift: number,
): number | null {
  const sym = coerceChordSymbolForMode(symbol as ChordSymbol, mode);
  const root = chordSymbolToRootMidi(sym, keyRoot, mode, 0);
  if (root == null) return null;
  if (anchor === 'root') return Math.max(0, root + octaveShift * 12);
  const m = chordSymbolToMidi(sym, keyRoot, mode, 0);
  if (!m?.length) return Math.max(0, root + octaveShift * 12);
  const sorted = [...m].sort((a, b) => a - b);
  let note: number;
  switch (anchor) {
    case 'third':
      note = m[1] ?? m[0]!;
      break;
    case 'fifth':
      note = m[2] ?? m[0]!;
      break;
    case 'seventh':
      note = m[3] ?? m[m.length - 1]!;
      break;
    default:
      note = sorted[0]!;
  }
  return Math.max(0, note + octaveShift * 12);
}
function midiToLabel(n: number): string {
  return `${NOTE_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
}
function isBlackKeyPitchClass(pc: number): boolean {
  const n = ((pc % 12) + 12) % 12;
  return n === 1 || n === 3 || n === 6 || n === 8 || n === 10;
}

const MODE_SCALE_INTERVALS: Record<ChordMode, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
};

function isInScalePitch(midi: number, keyRoot: number, mode: ChordMode): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return MODE_SCALE_INTERVALS[mode].some((i) => (keyRoot + i) % 12 === pc);
}

export interface EightZeroEightTabProps {
  embedded?: boolean;
  isScreenActive?: boolean;
  onBack?: () => void;
  getAudioContext: () => AudioContext | null;
  fallbackBpm: number;
  /** Creation Station session link — Beat Lab BPM master when true. */
  sessionBpmLinked?: boolean;
  /** Creation Station session link — Beat Lab play/pause/stop drives 808 transport when true. */
  sessionPlayLinked?: boolean;
  /** Groove Lab tab + Session Link Sync on 808 — follow Groove transport/BPM while 808 is in background. */
  followGrooveLabSession?: boolean;
  /** Live Groove Lab BPM (when followGrooveLabSession). */
  masterGrooveBpm?: number;
  onExportToPad?: (args: {
    padIndex: number;
    wavBytes: Uint8Array;
    label: string;
    rootBpm: number;
  }) => void | Promise<void>;
}

const selectStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #3f3f46',
  background: '#18181b',
  color: '#e4e4e7',
  fontSize: 12,
  fontWeight: 700,
  minWidth: 200,
};
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
const btnGhost = lab808BtnGhost;
const rollBtn = (bg: string, color: string, border: string) => lab808RollActionBtnStyle(bg, color, border);

/** Horizontal zoom — 808 Lab uses larger beat cells than Chord Builder. */
const PX_PER_BEAT_BASE = LAB808_PIANO_PX_PER_BEAT;
const PX_PER_BEAT_MIN = LAB808_PIANO_PX_PER_BEAT_MIN;
const ROLL_METRICS = LAB808_PIANO_METRICS;
const BEATS_PER_BAR = 4;
/** Piano-roll timeline length (bars in 4/4). Grid fills the viewport width; grows if notes extend past this. */
const ROLL_TIMELINE_BAR_OPTIONS = [4, 8, 12, 16, 24, 32] as const;
type RollTimelineBarChoice = (typeof ROLL_TIMELINE_BAR_OPTIONS)[number];
const LAB808_OCTAVE_MIN = 0;
const LAB808_OCTAVE_MAX = 8;
const LAB808_OCTAVE_LOW_DEFAULT = 1;
const LAB808_OCTAVE_HIGH_DEFAULT = 6;
const HOVER_MS = 220;
const DRAG_AXIS_LOCK_PX = 10;
const RESIZE_HANDLE_W = 18;
const TIMELINE_TAIL_PAD_BEATS = 24;
const DEFAULT_NOTE_BEATS = 4;
const MAX_NOTE_BEATS = 16;
const ROLL_EMPTY_TAP_MAX_PX = 8;
/** Key preview hold — kick = short thump; bass = longer 808 line. */
const KEY_PREVIEW_HOLD_BEATS_KICK = 1;
const KEY_PREVIEW_HOLD_BEATS_BASS = 2;
/** Roots arrive via "Roots → 808" command as `manualRollNotes` (not live overlay). */
const SHOW_SYNC_CHORD_NOTES_ON_ROLL = false;

type ManualRollNote = { id: string; startBeat: number; midi: number; durBeats: number; chord?: string };

export default function EightZeroEightTab({
  embedded,
  isScreenActive,
  onBack,
  getAudioContext,
  fallbackBpm,
  sessionBpmLinked,
  sessionPlayLinked = false,
  followGrooveLabSession = false,
  masterGrooveBpm,
  onExportToPad,
}: EightZeroEightTabProps) {
  const [syncTick, setSyncTick] = useState(0);
  const [soundLane, setSoundLane] = useState<Lab808SoundLane>('kick');
  const [trapKickPresetId, setTrapKickPresetId] = useState<TrapHold808PresetId>('zayKnock');
  const [bassPresetId, setBassPresetId] = useState<BassLowBassPresetId>('trapLowBass');
  const [lab808HpHz, setLab808HpHz] = useState(LAB808_FILTER_DEFAULT.hpHz ?? 0);
  const [lab808LpHz, setLab808LpHz] = useState(LAB808_FILTER_DEFAULT.lpHz ?? 0);
  const [anchor, setAnchor] = useState<EightZeroEightAnchor>('root');
  const [octaveShift, setOctaveShift] = useState(-2);
  const [velocity, setVelocity] = useState(0.92);
  const [rollPitchOverride, setRollPitchOverride] = useState<Record<number, number>>({});
  const [noteDurBeats, setNoteDurBeats] = useState<Record<number, number>>({});
  const [noteStartShiftBeats, setNoteStartShiftBeats] = useState<Record<number, number>>({});
  const [manualRollNotes, setManualRollNotes] = useState<ManualRollNote[]>([]);
  const [roll808BpmOverride, setRoll808BpmOverride] = useState<number | null>(null);
  const [rollTimelineBars, setRollTimelineBars] = useState<RollTimelineBarChoice>(16);
  const [labDeckTransport, setLabDeckTransport] = useState<Lab808DeckTransportState>('stopped');
  const [quantize, setQuantize] = useState<Lab808Quantize>('1/16');
  const [rollLowOct, setRollLowOct] = useState(LAB808_OCTAVE_LOW_DEFAULT);
  const [rollHighOct, setRollHighOct] = useState(LAB808_OCTAVE_HIGH_DEFAULT);
  const [import808Hint, setImport808Hint] = useState<string | null>(null);
  const [chordRootLock, setChordRootLock] = useState(false);
  const [chordLockSource, setChordLockSource] = useState<Lab808ChordLockSource>(() => readLab808ChordLockSource());
  const [padDeckBank, setPadDeckBank] = useState<Lab808PadDeckBank>('tone');
  const [mpcKitId, setMpcKitId] = useState<LabMpcKitId>('trapDark');
  const [drumMasterLevel, setDrumMasterLevel] = useState(0.92);
  const [toneMuted, setToneMuted] = useState(false);
  const [toneSolo, setToneSolo] = useState(false);
  const [drumMuted, setDrumMuted] = useState(false);
  const [drumSolo, setDrumSolo] = useState(false);
  const [internal808Link, setInternal808Link] = useState(() => readLab808InternalLink());
  const [bpmSyncTarget, setBpmSyncTarget] = useState<Lab808BpmSyncTarget>(() => readLab808BpmSyncTarget());
  const [transportMirror, setTransportMirror] = useState<Lab808TransportMirrorTarget>(() =>
    readLab808TransportMirror(),
  );
  const transportMirrorRef = useRef<Lab808TransportMirrorTarget>(transportMirror);
  transportMirrorRef.current = transportMirror;
  const suppressOutboundMirrorRef = useRef(false);
  const followGrooveLabSessionRef = useRef(followGrooveLabSession);
  followGrooveLabSessionRef.current = followGrooveLabSession;
  const [chordPlayThrough, setChordPlayThrough] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [padExportRequest, setPadExportRequest] = useState<'tone' | 'drums' | null>(null);
  const [toneRollSelection, setToneRollSelection] = useState<Lab808ToneRollRegion | null>(null);
  const [toneRollPastePending, setToneRollPastePending] = useState(false);
  const [toneRollEraseMode, setToneRollEraseMode] = useState(false);
  const toneRollClipRef = useRef<Lab808ToneRollClip | null>(null);
  const toneRollEraseModeRef = useRef(toneRollEraseMode);
  toneRollEraseModeRef.current = toneRollEraseMode;
  const toneRollPastePendingRef = useRef(toneRollPastePending);
  toneRollPastePendingRef.current = toneRollPastePending;
  const rollPlayheadBeatRef = useRef(0);
  const toneRollSelectDragRef = useRef<{
    anchorBeat: number;
    anchorMidi: number;
    pointerId: number;
    gestured: boolean;
  } | null>(null);
  const chordPlayThroughRef = useRef(chordPlayThrough);
  chordPlayThroughRef.current = chordPlayThrough;
  const [activeRootHighlight, setActiveRootHighlight] = useState<number | null>(null);
  const [activeNoteHighlightId, setActiveNoteHighlightId] = useState<string | null>(null);
  const onRollDisplayQuarterBeatRef = useRef<(quarterBeat: number) => void>(() => {});

  const rollAreaRef = useRef<HTMLDivElement | null>(null);
  const rollPlaylineRef = useRef<HTMLDivElement | null>(null);
  const lab808DeckTransportRef = useRef<Lab808DrumTransportHandle | null>(null);
  const hoverRef = useRef({ idx: -1, t: 0 });
  type NoteBodyDragAxis = 'pitch' | 'slide';
  const dragRef = useRef<{
    idx: number;
    startClientX: number;
    startClientY: number;
    startMidi: number;
    startShift: number;
    startBeatBase: number;
    axis: NoteBodyDragAxis | null;
    gestured: boolean;
  } | null>(null);
  const resizeRef = useRef<{ idx: number; startClientX: number; startDur: number; startBeatAbs: number } | null>(
    null,
  );
  const dragTouchSurfaceRef = useRef<HTMLElement | null>(null);
  const resizeTouchSurfaceRef = useRef<HTMLElement | null>(null);
  const manualDragRef = useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    startMidi: number;
    startBeat: number;
    startDur: number;
    axis: NoteBodyDragAxis | null;
    gestured: boolean;
  } | null>(null);
  const manualResizeRef = useRef<{
    id: string;
    startClientX: number;
    startDur: number;
    startBeat: number;
  } | null>(null);
  const manualDragTouchSurfaceRef = useRef<HTMLElement | null>(null);
  const manualResizeTouchSurfaceRef = useRef<HTMLElement | null>(null);
  const rollEmptyTapRef = useRef<{ clientX: number; clientY: number; velocity01: number } | null>(null);
  const pxPerBeatRef = useRef(PX_PER_BEAT_BASE);
  const quantizeRef = useRef<Lab808Quantize>(quantize);
  quantizeRef.current = quantize;

  const rollRows = useMemo(() => {
    const lo = Math.min(rollLowOct, rollHighOct);
    const hi = Math.max(rollLowOct, rollHighOct);
    return buildCbPianoRows(lo, hi);
  }, [rollLowOct, rollHighOct]);

  const quantizeStep = useMemo(() => quantizeStepBeats(quantize, BEATS_PER_BAR), [quantize]);

  const sync = useMemo(() => readChordSync(), [syncTick]);
  useEffect(() => {
    const id = window.setInterval(() => setSyncTick((n) => n + 1), 1200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const bump = () => setSyncTick((n) => n + 1);
    window.addEventListener(LAB808_CHORD_SOURCES_CHANGED_EVENT, bump);
    return () => window.removeEventListener(LAB808_CHORD_SOURCES_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    const onLab808SyncChanged = () => {
      setSyncTick((n) => n + 1);
      setTransportMirror(readLab808TransportMirror());
      setBpmSyncTarget(readLab808BpmSyncTarget());
    };
    window.addEventListener(LAB808_SYNC_CHANGED_EVENT, onLab808SyncChanged);
    return () => window.removeEventListener(LAB808_SYNC_CHANGED_EVENT, onLab808SyncChanged);
  }, []);

  const blockCount = sync?.blocks?.length ?? 0;
  useEffect(() => {
    setNoteDurBeats((prev) => {
      const next = { ...prev };
      for (let i = 0; i < blockCount; i++) {
        if (next[i] == null) next[i] = DEFAULT_NOTE_BEATS;
      }
      for (const k of Object.keys(next)) {
        if (+k >= blockCount) delete next[+k];
      }
      return next;
    });
    setNoteStartShiftBeats((prev) => {
      const next = { ...prev };
      for (let i = 0; i < blockCount; i++) {
        if (next[i] == null) next[i] = 0;
      }
      for (const k of Object.keys(next)) {
        if (+k >= blockCount) delete next[+k];
      }
      return next;
    });
  }, [blockCount, sync?.progressionName]);

  const mode = sync ? coerceMode(sync.mode) : 'major';
  const keyName = sync ? NOTE_NAMES[((sync.keyRoot % 12) + 12) % 12] : '—';
  const labStripBpm = sync?.bpm ?? fallbackBpm;
  const linkedToGrooveLab =
    transportMirror === 'groove-lab' || followGrooveLabSession === true;

  const apply808Sync = useCallback(() => {
    if (bpmSyncTarget === '808-internal' && !followGrooveLabSession) {
      setRoll808BpmOverride(null);
      return;
    }
    const target =
      followGrooveLabSession || bpmSyncTarget === 'groove-lab' ? 'groove-lab' : bpmSyncTarget;
    const next = resolveLab808SyncBpm({
      target,
      beatLabBpm: fallbackBpm,
      grooveLabBpm: masterGrooveBpm ?? fallbackBpm,
      fallbackBpm: labStripBpm,
    });
    setRoll808BpmOverride(next);
  }, [bpmSyncTarget, fallbackBpm, labStripBpm, followGrooveLabSession, masterGrooveBpm]);

  const link808ToGrooveLab = useCallback(() => {
    setBpmSyncTarget('groove-lab');
    storeLab808BpmSyncTarget('groove-lab');
    setTransportMirror('groove-lab');
    storeLab808TransportMirror('groove-lab');
    const next = resolveLab808SyncBpm({
      target: 'groove-lab',
      beatLabBpm: fallbackBpm,
      grooveLabBpm: fallbackBpm,
      fallbackBpm: labStripBpm,
    });
    setRoll808BpmOverride(next);
  }, [fallbackBpm, labStripBpm]);

  const handleInternal808LinkChange = useCallback((linked: boolean) => {
    setInternal808Link(linked);
    storeLab808InternalLink(linked);
    if (linked) apply808Sync();
  }, [apply808Sync]);

  const handleBpmSyncTargetChange = useCallback(
    (target: Lab808BpmSyncTarget) => {
      setBpmSyncTarget(target);
      storeLab808BpmSyncTarget(target);
      if (target === 'groove-lab') link808ToGrooveLab();
      else apply808Sync();
    },
    [apply808Sync, link808ToGrooveLab],
  );

  const handleTransportMirrorChange = useCallback(
    (target: Lab808TransportMirrorTarget) => {
      setTransportMirror(target);
      storeLab808TransportMirror(target);
      if (target === 'groove-lab') apply808Sync();
    },
    [apply808Sync],
  );

  /** Creation Station SESSION LINK — Beat Lab BPM chip overrides pad-deck unless user linked Groove Lab. */
  useEffect(() => {
    if (sessionBpmLinked == null) return;
    if (readLab808BpmSyncTarget() === 'groove-lab') return;
    const target: Lab808BpmSyncTarget = sessionBpmLinked ? 'beat-lab' : '808-internal';
    setBpmSyncTarget(target);
    storeLab808BpmSyncTarget(target);
  }, [sessionBpmLinked]);

  useEffect(() => {
    if (sessionBpmLinked == null) return;
    apply808Sync();
  }, [sessionBpmLinked, fallbackBpm, apply808Sync]);

  useEffect(() => {
    if (!followGrooveLabSession) return;
    if (readLab808TransportMirror() !== 'groove-lab') {
      storeLab808TransportMirror('groove-lab');
      setTransportMirror('groove-lab');
    }
    if (readLab808BpmSyncTarget() !== 'groove-lab') {
      storeLab808BpmSyncTarget('groove-lab');
      setBpmSyncTarget('groove-lab');
    }
  }, [followGrooveLabSession]);

  useEffect(() => {
    if (linkedToGrooveLab || bpmSyncTarget === 'groove-lab') apply808Sync();
  }, [
    linkedToGrooveLab,
    followGrooveLabSession,
    masterGrooveBpm,
    fallbackBpm,
    bpmSyncTarget,
    apply808Sync,
  ]);

  const labDeckTransportRef = useRef<Lab808DeckTransportState>('stopped');
  labDeckTransportRef.current = labDeckTransport;

  const transport808FiredRef = useRef<Set<string>>(new Set());
  const primeGrooveLinkedRootsRef = useRef<(ctx: AudioContext) => void>(() => {});

  const applyInbound808TransportMirror = useCallback(
    (action: Lab808TransportMirrorAction) => {
    const deck = lab808DeckTransportRef.current;
    if (!deck) return;
    suppressOutboundMirrorRef.current = true;
    try {
      if (action === 'play') {
        transport808FiredRef.current.clear();
        if (followGrooveLabSessionRef.current) {
          const ctx = getAudioContext();
          if (ctx) primeGrooveLinkedRootsRef.current(ctx);
        }
        if (labDeckTransportRef.current !== 'playing') deck.transportTogglePlayPause();
      } else if (action === 'pause') {
        if (labDeckTransportRef.current === 'playing') deck.transportTogglePlayPause();
      } else if (action === 'stop') {
        deck.transportStop();
      }
    } finally {
      requestAnimationFrame(() => {
        suppressOutboundMirrorRef.current = false;
      });
    }
  },
    [getAudioContext],
  );

  /** Beat Lab or Groove Lab PLAY → 808 (Session Link Sync + Groove mirror). */
  useEffect(() => {
    if (!sessionPlayLinked && !linkedToGrooveLab) return;
    const onBeatLabMirror = (ev: Event) => {
      const detail = (ev as CustomEvent<CreationBeatlabPlayMirrorDetail>).detail;
      if (!detail || detail.target !== '808-lab') return;
      applyInbound808TransportMirror(detail.action);
    };
    const onGrooveMirror = (ev: Event) => {
      const detail = (ev as CustomEvent<GrooveLabTransportMirrorDetail>).detail;
      if (!detail) return;
      applyInbound808TransportMirror(detail.action);
    };
    window.addEventListener(CREATION_BEATLAB_PLAY_MIRROR_EVENT, onBeatLabMirror);
    window.addEventListener(GROOVE_LAB_TRANSPORT_MIRROR_EVENT, onGrooveMirror);
    return () => {
      window.removeEventListener(CREATION_BEATLAB_PLAY_MIRROR_EVENT, onBeatLabMirror);
      window.removeEventListener(GROOVE_LAB_TRANSPORT_MIRROR_EVENT, onGrooveMirror);
    };
  }, [sessionPlayLinked, linkedToGrooveLab, applyInbound808TransportMirror]);

  const roll808Bpm = useMemo(() => {
    if (roll808BpmOverride != null) return Math.max(40, Math.min(220, Math.round(roll808BpmOverride)));
    return Math.max(40, Math.min(220, Math.round(labStripBpm)));
  }, [roll808BpmOverride, labStripBpm]);
  const playbackPreset = useMemo(
    () =>
      soundLane === 'bass'
        ? BASS_LOW_BASS_PRESETS[bassPresetId]
        : TRAP_HOLD_808_PRESETS[trapKickPresetId],
    [soundLane, bassPresetId, trapKickPresetId],
  );

  const applyPresetFilterHints = useCallback((preset: EightZeroEightPresetDef) => {
    if (preset.filterHpHz != null && preset.filterHpHz >= 25) setLab808HpHz(preset.filterHpHz);
    else if (preset.filterHpHz === 0) setLab808HpHz(0);
    if (preset.filterLpHz != null && preset.filterLpHz >= 200) setLab808LpHz(preset.filterLpHz);
  }, []);

  useEffect(() => {
    applyPresetFilterHints(playbackPreset);
  }, [playbackPreset, applyPresetFilterHints]);

  const lab808FilterRef = useRef<Lab808FilterFx>({ hpHz: 0, lpHz: 0 });
  lab808FilterRef.current = { hpHz: lab808HpHz, lpHz: lab808LpHz };

  const playbackPresetRef = useRef(playbackPreset);
  playbackPresetRef.current = playbackPreset;

  const rows = useMemo(() => {
    if (!sync?.blocks?.length) return [];
    return sync.blocks.map((b, i) => ({
      i,
      chord: b.chord,
      name: chordSymbolToName(b.chord as ChordSymbol, sync.keyRoot, mode),
      beats: b.durationBeats,
      midi: resolveAnchorMidi(b.chord, sync.keyRoot, mode, anchor, octaveShift),
    }));
  }, [sync, mode, anchor, octaveShift]);

  const displayRows = useMemo(
    () => rows.map((r) => ({ ...r, midi: r.midi == null ? null : (rollPitchOverride[r.i] ?? r.midi) })),
    [rows, rollPitchOverride],
  );

  const rollData = useMemo(() => {
    let beat = 0;
    return displayRows.map((r) => {
      const startBeat = beat;
      beat += r.beats;
      return { ...r, startBeat, endBeat: beat };
    });
  }, [displayRows]);

  const totalBeats = rollData.length ? rollData[rollData.length - 1]!.endBeat : 0;

  const noteDurBeatsRef = useRef(noteDurBeats);
  noteDurBeatsRef.current = noteDurBeats;
  const totalBeatsRef = useRef(totalBeats);
  totalBeatsRef.current = totalBeats;

  const stepMidiRef = useRef<Record<number, number>>({});
  useEffect(() => {
    const m: Record<number, number> = {};
    for (const r of displayRows) {
      if (r.midi != null) m[r.i] = r.midi;
    }
    stepMidiRef.current = m;
  }, [displayRows]);

  const maxNoteEndBeat = useMemo(() => {
    let m = totalBeats;
    for (const r of rollData) {
      if (r.midi == null) continue;
      const d = noteDurBeats[r.i] ?? DEFAULT_NOTE_BEATS;
      const sh = noteStartShiftBeats[r.i] ?? 0;
      m = Math.max(m, r.startBeat + sh + d);
    }
    for (const n of manualRollNotes) {
      m = Math.max(m, n.startBeat + n.durBeats);
    }
    return m;
  }, [rollData, totalBeats, noteDurBeats, noteStartShiftBeats, manualRollNotes]);

  const timelineFloorBeats = rollTimelineBars * BEATS_PER_BAR;
  const maxGridBeats = Math.max(timelineFloorBeats, Math.ceil(maxNoteEndBeat) + 1);
  /** Full bars only — ruler chips and beat grid share this width (matches Chord Builder). */
  const rollBarCount = Math.max(1, Math.ceil(maxGridBeats / BEATS_PER_BAR));
  const layoutBeats = rollBarCount * BEATS_PER_BAR;

  const nSemitones = rollRows.length;
  const rollMinMidi = cbPianoNoteNameToMidi(rollRows[nSemitones - 1]!);
  const rollMaxMidi = cbPianoNoteNameToMidi(rollRows[0]!);
  /** Row 0 = top = highest pitch. */
  const midiAtRollRow = (rowIndex: number) =>
    rowIndex >= 0 && rowIndex < nSemitones ? cbPianoNoteNameToMidi(rollRows[rowIndex]!) : rollMinMidi;
  const midiOnRoll = (midi: number) => midi >= rollMinMidi && midi <= rollMaxMidi;
  const rollTopPxForMidi = (midi: number): number | null => {
    if (!midiOnRoll(midi)) return null;
    return (rollMaxMidi - midi) * rollRowH;
  };

  const rollViewportRef = useRef<HTMLDivElement>(null);
  const [rollViewport, setRollViewport] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = rollViewportRef.current;
    if (!el) {
      setRollViewport({ w: 0, h: 0 });
      return;
    }
    const apply = () => {
      setRollViewport({
        w: Math.max(0, Math.round(el.clientWidth)),
        h: Math.max(0, Math.round(el.clientHeight)),
      });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layoutBeats, manualRollNotes.length, rollRows.length]);

  const pxPerBeat = useMemo(() => {
    const beats = Math.max(1, layoutBeats);
    const base = PX_PER_BEAT_BASE;
    const innerW = rollViewport.w;
    if (innerW < ROLL_METRICS.labelW + 60) return base;
    const avail = Math.max(40, innerW - ROLL_METRICS.labelW);
    if (beats * base <= avail) return base;
    return Math.max(PX_PER_BEAT_MIN, Math.floor(avail / beats));
  }, [rollViewport.w, layoutBeats]);

  useEffect(() => {
    pxPerBeatRef.current = pxPerBeat;
  }, [pxPerBeat]);

  const rollRowH = ROLL_METRICS.rowH;

  const rollHeight = rollRowH * nSemitones;
  const rollScrollsVertically = rollHeight > rollViewport.h + 2;

  useLayoutEffect(() => {
    const vp = rollViewportRef.current;
    if (!vp) return;
    const c2Idx = rollRows.indexOf('C2');
    if (c2Idx < 0) return;
    vp.scrollTop = Math.max(0, c2Idx * rollRowH - rollRowH * 2);
  }, [rollRowH, rollRows]);

  const noteMinW = Math.max(22, Math.floor(pxPerBeat * 0.7));
  const noteMinH = Math.max(18, rollRowH - 2);

  const rootChordLabel = useMemo(
    () =>
      !sync?.blocks?.length
        ? null
        : {
            roman: sync.blocks[0]!.chord,
            name: chordSymbolToName(sync.blocks[0]!.chord as ChordSymbol, sync.keyRoot, mode),
          },
    [sync, mode],
  );

  const roll808BpmRef = useRef(roll808Bpm);
  roll808BpmRef.current = roll808Bpm;
  const manualRollNotesRef = useRef(manualRollNotes);
  manualRollNotesRef.current = manualRollNotes;

  /** Transport/pads always use locked source roots — roll notes are display/edit only. */
  const progressionRoots = useMemo(
    () =>
      resolveLab808RootsForSource(chordLockSource, {
        sync,
        mode,
        octaveShift,
      }),
    [chordLockSource, sync, mode, octaveShift, syncTick],
  );
  const progressionRootsRef = useRef<Lab808ProgressionRoot[]>(progressionRoots);
  progressionRootsRef.current = progressionRoots;
  const chordRootLockRef = useRef(chordRootLock);
  chordRootLockRef.current = chordRootLock;
  const chordLockSourceRef = useRef(chordLockSource);
  chordLockSourceRef.current = chordLockSource;
  const progressionConnected = progressionRoots.length > 0;
  const progressionLabel = useMemo(() => {
    if (manualRollNotes.length > 0) return 'Roll roots';
    if (chordLockSource === 'chord-builder') return sync?.progressionName ?? null;
    if (progressionRoots.length > 0) return LAB808_CHORD_LOCK_SOURCE_LABELS[chordLockSource];
    return null;
  }, [manualRollNotes.length, chordLockSource, sync?.progressionName, progressionRoots.length]);

  const noteIdForRootIndex = useCallback((rootIndex: number) => {
    const n = manualRollNotesRef.current[rootIndex];
    if (n) return n.id;
    const r = progressionRootsRef.current[rootIndex];
    return r ? `808-root-${rootIndex}-${r.startBeat}` : null;
  }, []);

  const canGenerateChordRoots = useMemo(
    () => lab808SourceHasProgressionSync(chordLockSource, sync?.blocks ?? null),
    [chordLockSource, sync?.blocks, syncTick],
  );

  const handleGenerateChordRoots = useCallback(() => {
    const roots = fetchLab808RootsForChordLockSource(chordLockSource, { sync, mode, octaveShift });
    if (!roots.length) {
      setImport808Hint(`No chords in ${LAB808_CHORD_LOCK_SOURCE_LABELS[chordLockSource]}`);
      window.setTimeout(() => setImport808Hint(null), 3200);
      return;
    }
    setManualRollNotes(progressionRootsToManualRollNotes(roots));
    setImport808Hint(
      `${roots.length} root${roots.length === 1 ? '' : 's'} from ${LAB808_CHORD_LOCK_SOURCE_LABELS[chordLockSource]} → roll`,
    );
    window.setTimeout(() => setImport808Hint(null), 4500);
  }, [chordLockSource, sync, mode, octaveShift]);

  const handleChordLockSourceChange = useCallback(
    (source: Lab808ChordLockSource) => {
      setChordLockSource(source);
      storeLab808ChordLockSource(source);
    },
    [],
  );

  const handleChordRootLockChange = useCallback(
    (on: boolean) => {
      setChordRootLock(on);
      if (!on) {
        setActiveRootHighlight(null);
        setActiveNoteHighlightId(null);
      }
    },
    [],
  );

  const lab808LoopBeats = useMemo(() => {
    let beats = compute808LabLoopBeats({
      syncBlocks: chordLockSource === 'chord-builder' ? (sync?.blocks ?? null) : null,
      manualNotes: manualRollNotes,
    });
    for (const r of progressionRoots) {
      beats = Math.max(beats, r.startBeat + r.durBeats);
    }
    return beats;
  }, [chordLockSource, sync?.blocks, manualRollNotes, progressionRoots]);
  const lab808LoopBars = useMemo(
    () => Math.max(1, Math.ceil(lab808LoopBeats / BEATS_PER_BAR)),
    [lab808LoopBeats],
  );
  const lab808LoopBeatsRef = useRef(lab808LoopBeats);
  lab808LoopBeatsRef.current = lab808LoopBeats;

  useEffect(() => {
    onRollDisplayQuarterBeatRef.current = (quarterBeat) => {
      rollPlayheadBeatRef.current = quarterBeat;
      if (labDeckTransport !== 'playing') return;
      const loopLen = Math.max(1e-6, lab808LoopBeatsRef.current);
      const roots = progressionRootsRef.current;
      const manual = manualRollNotesRef.current;
      const locked = chordRootLockRef.current;

      if (locked && roots.length > 0) {
        const idx = lab808ActiveRootIndexAtBeat(roots, quarterBeat, loopLen);
        setActiveRootHighlight(idx);
        setActiveNoteHighlightId(idx != null ? noteIdForRootIndex(idx) : null);
        return;
      }
      for (const n of manual) {
        const pos = ((quarterBeat % loopLen) + loopLen) % loopLen;
        if (pos >= n.startBeat && pos < n.startBeat + n.durBeats) {
          setActiveNoteHighlightId(n.id);
          setActiveRootHighlight(null);
          return;
        }
      }
      setActiveRootHighlight(null);
      setActiveNoteHighlightId(null);
    };
  }, [labDeckTransport, noteIdForRootIndex]);

  const applyImported808Roots = useCallback(() => {
    const payload = read808LabImportedRoots();
    if (!payload?.notes?.length) return;
    const notes = manualRollNotesFrom808Import(payload);
    setManualRollNotes(notes);
    setRoll808BpmOverride(null);
    if (typeof payload.octaveShift === 'number') setOctaveShift(payload.octaveShift);
    const minOct = Math.min(...notes.map((n) => midiTo808RollOctave(n.midi)));
    const maxOct = Math.max(...notes.map((n) => midiTo808RollOctave(n.midi)));
    setRollLowOct((lo) => Math.min(lo, Math.max(LAB808_OCTAVE_MIN, minOct)));
    setRollHighOct((hi) => Math.max(hi, Math.min(LAB808_OCTAVE_MAX, maxOct)));
    const src =
      payload.source === 'chord-sequencer' ? 'Chord/Bass Sequencer' : 'Chord Builder';
    setImport808Hint(
      `Loaded ${payload.notes.length} root${payload.notes.length === 1 ? '' : 's'} from ${src} · ${payload.progressionName}`,
    );
  }, []);

  useEffect(() => {
    applyImported808Roots();
    const onImport = () => applyImported808Roots();
    window.addEventListener(LAB808_ROOTS_IMPORTED_EVENT, onImport);
    return () => window.removeEventListener(LAB808_ROOTS_IMPORTED_EVENT, onImport);
  }, [applyImported808Roots]);

  useEffect(() => {
    if (!isScreenActive) return;
    applyImported808Roots();
  }, [isScreenActive, applyImported808Roots]);

  useEffect(() => {
    if (!import808Hint) return;
    const t = window.setTimeout(() => setImport808Hint(null), 5000);
    return () => window.clearTimeout(t);
  }, [import808Hint]);

  useEffect(() => {
    const needBars = snap808LabLoopBars(lab808LoopBars);
    const timelineOpt = ROLL_TIMELINE_BAR_OPTIONS.find((o) => o >= needBars) ?? 32;
    setRollTimelineBars((prev) => (timelineOpt > prev ? timelineOpt : prev));
  }, [lab808LoopBars]);

  const toneAudible = useMemo(
    () => lab808BankAudible('tone', toneMuted, drumMuted, toneSolo, drumSolo),
    [toneMuted, drumMuted, toneSolo, drumSolo],
  );
  const drumAudible = useMemo(
    () => lab808BankAudible('drums', toneMuted, drumMuted, toneSolo, drumSolo),
    [toneMuted, drumMuted, toneSolo, drumSolo],
  );
  const toneEffectiveLevel = useMemo(
    () => lab808EffectiveLevel(velocity, toneAudible),
    [velocity, toneAudible],
  );
  const drumEffectiveLevel = useMemo(
    () => lab808EffectiveLevel(drumMasterLevel, drumAudible),
    [drumMasterLevel, drumAudible],
  );

  /** Optional harmony under 808 — only when user turns on + CHORDS (808 kick/bass stays default). */
  const maybeAuditionLockedHarmony = useCallback(
    (ctx: AudioContext, when: number, root: Lab808ProgressionRoot, holdBeats: number, velocity01 = 0.88) => {
      if (!chordRootLockRef.current || !chordPlayThroughRef.current) return;
      auditionLab808LockedHarmony(ctx, when, root, chordLockSourceRef.current, {
        bpm: roll808BpmRef.current,
        velocity: velocity01,
        holdBeats,
      });
    },
    [],
  );

  const refillLockedRootsOnTransport = useCallback(
    (
      ctx: AudioContext,
      ctSnap: number,
      mpc: {
        sessionStart: number;
        originStepBeat: number;
        stepSpb: number;
        stepsPerBar: number;
      },
    ) => {
      if (!toneAudible) return;
      const locked = chordRootLockRef.current;
      const roots = progressionRootsRef.current;
      const manual = manualRollNotesRef.current;
      const useRoots = locked && roots.length > 0;
      if (!useRoots && !manual.length) return;
      refillLab808LockedRoots({
        ctx,
        ctSnap,
        loopBeats: lab808LoopBeatsRef.current,
        useGrooveClock: followGrooveLabSessionRef.current,
        lockedRoots: useRoots ? roots : [],
        manualNotes: useRoots ? [] : manual,
        firedKeys: transport808FiredRef.current,
        mpc,
        onRoot: (index, when) => {
          const n = roots[index]!;
          setActiveRootHighlight(index);
          setActiveNoteHighlightId(noteIdForRootIndex(index));
          playEightZeroEight(ctx, when, n.midi, playbackPresetRef.current, toneEffectiveLevel, {
            holdBeats: n.durBeats,
            bpm: roll808BpmRef.current,
            kickKeyboardMap: true,
            kickMonophonic: true,
            velocity01: 0.88,
            soundLane,
            subOscOnly: soundLane === 'bass',
            filterFx: lab808FilterRef.current,
          });
          maybeAuditionLockedHarmony(ctx, when, n, n.durBeats, 0.88);
        },
        onManual: (note, when) => {
          setActiveNoteHighlightId(note.id);
          setActiveRootHighlight(null);
          playEightZeroEight(ctx, when, note.midi, playbackPresetRef.current, toneEffectiveLevel, {
            holdBeats: note.durBeats,
            bpm: roll808BpmRef.current,
            kickKeyboardMap: true,
            kickMonophonic: true,
            velocity01: 0.88,
            soundLane,
            subOscOnly: soundLane === 'bass',
            filterFx: lab808FilterRef.current,
          });
        },
      });
    },
    [soundLane, toneAudible, toneEffectiveLevel, noteIdForRootIndex, maybeAuditionLockedHarmony],
  );

  primeGrooveLinkedRootsRef.current = (ctx: AudioContext) => {
    if (!toneAudible || !chordRootLockRef.current) return;
    const roots = progressionRootsRef.current;
    if (roots.length === 0) return;
    const fireRoot = (index: number, when: number) => {
      const n = roots[index]!;
      setActiveRootHighlight(index);
      setActiveNoteHighlightId(noteIdForRootIndex(index));
      playEightZeroEight(ctx, when, n.midi, playbackPresetRef.current, toneEffectiveLevel, {
        holdBeats: n.durBeats,
        bpm: roll808BpmRef.current,
        kickKeyboardMap: true,
        kickMonophonic: true,
        velocity01: 0.88,
        soundLane,
        subOscOnly: soundLane === 'bass',
        filterFx: lab808FilterRef.current,
      });
      maybeAuditionLockedHarmony(ctx, when, n, n.durBeats, 0.88);
    };
    primeLab808GrooveCycleCatchup({
      ctx,
      ctSnap: Math.max(0, ctx.currentTime),
      lockedRoots: roots,
      firedKeys: transport808FiredRef.current,
      onRoot: (index, when) => fireRoot(index, when),
    });
  };

  const onLabDeckTransportChange = useCallback((state: Lab808DeckTransportState) => {
    setLabDeckTransport(state);
    const mirror = transportMirrorRef.current;
    if (followGrooveLabSessionRef.current) return;
    if (!suppressOutboundMirrorRef.current && mirror !== 'none') {
      if (state === 'playing') dispatchLab808TransportMirror('play', mirror);
      else if (state === 'paused') dispatchLab808TransportMirror('pause', mirror);
      else if (state === 'stopped') dispatchLab808TransportMirror('stop', mirror);
    }
    if (state === 'stopped') {
      transport808FiredRef.current.clear();
      setActiveRootHighlight(null);
      setActiveNoteHighlightId(null);
    }
  }, [transportMirror]);

  const tonePresetLabel = useMemo(
    () =>
      soundLane === 'kick'
        ? formatLab808KickDisplayLabel(lab808TrapKickCreatedName(trapKickPresetId))
        : formatLab808KickDisplayLabel(lab808BassCreatedName(bassPresetId)),
    [soundLane, trapKickPresetId, bassPresetId],
  );

  const toneExportNotes = useMemo((): Lab808ToneExportNote[] => {
    if (chordRootLock && progressionRoots.length > 0) {
      return progressionRoots.map((r) => ({
        startBeat: r.startBeat,
        midi: r.midi,
        durBeats: r.durBeats,
        velocity01: 0.88,
      }));
    }
    return manualRollNotes.map((n) => ({
      startBeat: n.startBeat,
      midi: n.midi,
      durBeats: n.durBeats,
      velocity01: 0.88,
    }));
  }, [chordRootLock, progressionRoots, manualRollNotes]);

  const toneExportOpts = useMemo(
    () => ({
      bpm: roll808Bpm,
      preset: playbackPreset,
      soundLane,
      gain: velocity,
      filterFx: { hpHz: lab808HpHz, lpHz: lab808LpHz } as Lab808FilterFx,
      trackName: `808 Lab ${soundLane}`,
    }),
    [roll808Bpm, playbackPreset, soundLane, velocity, lab808HpHz, lab808LpHz],
  );

  const toneExportHasNotes = toneExportNotes.length > 0;
  const padExportEnabled = Boolean(onExportToPad);

  const flashExportStatus = useCallback((msg: string) => {
    setExportStatus(msg);
    window.setTimeout(() => setExportStatus(null), 4000);
  }, []);

  const handleToneExportMidi = useCallback(() => {
    if (!toneExportHasNotes || exportBusy) return;
    downloadLab808ToneMidi(toneExportNotes, toneExportOpts, `808Lab_${soundLane}`);
    flashExportStatus('✓ MIDI downloaded (Kick/Bass roll)');
  }, [toneExportHasNotes, exportBusy, toneExportNotes, toneExportOpts, soundLane, flashExportStatus]);

  const handleToneExportWav = useCallback(async () => {
    if (!toneExportHasNotes || exportBusy) return;
    setExportBusy(true);
    setExportStatus('Rendering WAV…');
    try {
      await downloadLab808ToneWav(toneExportNotes, toneExportOpts, `808Lab_${soundLane}`);
      flashExportStatus('✓ WAV downloaded (Kick/Bass roll)');
    } catch {
      flashExportStatus('WAV export failed');
    } finally {
      setExportBusy(false);
    }
  }, [toneExportHasNotes, exportBusy, toneExportNotes, toneExportOpts, soundLane, flashExportStatus]);

  const handleToneExportToPadRequest = useCallback(() => {
    if (!onExportToPad || !toneExportHasNotes || exportBusy) {
      if (!onExportToPad) flashExportStatus('Pad export needs Creation Station Beat Lab');
      return;
    }
    setPadExportRequest((prev) => (prev === 'tone' ? null : 'tone'));
  }, [onExportToPad, toneExportHasNotes, exportBusy, flashExportStatus]);

  const handleDrumExportMidi = useCallback(() => {
    const snap = lab808DeckTransportRef.current?.getDrumExportSnapshot();
    if (!snap || exportBusy) return;
    downloadLab808DrumMidi(snap, `808Lab_Drums_${snap.bankSlot}`);
    flashExportStatus('✓ MIDI downloaded (Drum kits roll)');
  }, [exportBusy, flashExportStatus]);

  const handleDrumExportWav = useCallback(async () => {
    const snap = lab808DeckTransportRef.current?.getDrumExportSnapshot();
    if (!snap || exportBusy) return;
    setExportBusy(true);
    setExportStatus('Rendering WAV…');
    try {
      await downloadLab808DrumWav(snap, `808Lab_Drums_${snap.bankSlot}`);
      flashExportStatus('✓ WAV downloaded (Drum kits roll)');
    } catch {
      flashExportStatus('WAV export failed');
    } finally {
      setExportBusy(false);
    }
  }, [exportBusy, flashExportStatus]);

  const handleDrumExportToPadRequest = useCallback(() => {
    if (!onExportToPad || exportBusy) {
      if (!onExportToPad) flashExportStatus('Pad export needs Creation Station Beat Lab');
      return;
    }
    setPadExportRequest((prev) => (prev === 'drums' ? null : 'drums'));
  }, [onExportToPad, exportBusy, flashExportStatus]);

  const confirmPadExport = useCallback(
    async (padIndex: number) => {
      const kind = padExportRequest;
      setPadExportRequest(null);
      if (!onExportToPad || kind == null || padIndex < 0 || padIndex > 15) return;
      setExportBusy(true);
      setExportStatus(`Rendering WAV for pad ${padIndex + 1}…`);
      try {
        let wavBytes: Uint8Array;
        let label: string;
        if (kind === 'tone') {
          wavBytes = await renderLab808ToneToWav(toneExportNotes, toneExportOpts);
          label = `808 ${soundLane} · ${tonePresetLabel}`;
        } else {
          const snap = lab808DeckTransportRef.current?.getDrumExportSnapshot();
          if (!snap) throw new Error('No drum pattern');
          wavBytes = await renderLab808DrumsToWav(snap);
          label = `808 Drums ${snap.bankSlot} · ${snap.kitId}`;
        }
        await onExportToPad({ padIndex, wavBytes, label, rootBpm: roll808Bpm });
        flashExportStatus(`✓ Loaded pad ${padIndex + 1} · ${label}`);
      } catch {
        flashExportStatus('Pad export failed');
      } finally {
        setExportBusy(false);
      }
    },
    [
      padExportRequest,
      onExportToPad,
      toneExportNotes,
      toneExportOpts,
      soundLane,
      tonePresetLabel,
      roll808Bpm,
      flashExportStatus,
    ],
  );

  const playHit = useCallback(
    (
      midi: number,
      stepIdx?: number,
      opts?: { holdBeats?: number; velocity01?: number; rootIndex?: number },
    ) => {
      if (!toneAudible) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      void ctx.resume();
      const hold =
        opts?.holdBeats ?? (stepIdx != null ? (noteDurBeats[stepIdx] ?? DEFAULT_NOTE_BEATS) : DEFAULT_NOTE_BEATS);
      const shift = stepIdx != null ? (noteStartShiftBeats[stepIdx] ?? 0) : 0;
      const strike = opts?.velocity01 ?? 0.88;
      const bps = Math.max(1, roll808Bpm) / 60;
      const floorT = ctx.currentTime + 0.012;
      const desired = ctx.currentTime + 0.02 + shift / bps;
      const when = Math.max(floorT, desired);
      playEightZeroEight(ctx, when, midi, playbackPresetRef.current, toneEffectiveLevel, {
        holdBeats: hold,
        bpm: roll808Bpm,
        kickKeyboardMap: true,
        kickMonophonic: true,
        velocity01: strike,
        soundLane,
        subOscOnly: soundLane === 'bass',
        filterFx: lab808FilterRef.current,
      });
      if (chordRootLockRef.current && progressionRootsRef.current.length > 0) {
        const roots = progressionRootsRef.current;
        const root =
          opts?.rootIndex != null && roots[opts.rootIndex]
            ? roots[opts.rootIndex]
            : stepIdx != null && roots[stepIdx]
              ? roots[stepIdx]
              : lab808ProgressionRootAtRollMidi(roots, midi);
        if (root) maybeAuditionLockedHarmony(ctx, when, root, hold, strike);
      }
    },
    [getAudioContext, toneEffectiveLevel, noteDurBeats, noteStartShiftBeats, roll808Bpm, soundLane, maybeAuditionLockedHarmony],
  );

  const playTonePad = useCallback(
    (midi: number, velocity01: number, holdBeats?: number, rootIndex?: number) => {
      if (rootIndex != null) {
        setActiveRootHighlight(rootIndex);
        setActiveNoteHighlightId(noteIdForRootIndex(rootIndex));
      }
      playHit(midi, undefined, {
        holdBeats:
          holdBeats ??
          (soundLane === 'bass' ? KEY_PREVIEW_HOLD_BEATS_BASS : KEY_PREVIEW_HOLD_BEATS_KICK),
        velocity01,
        rootIndex,
      });
    },
    [playHit, soundLane, noteIdForRootIndex],
  );

  const playProgression = useCallback(() => {
    if (!toneAudible) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    if (!sync?.blocks?.length && manualRollNotes.length === 0) return;
    void ctx.resume();
    const bpmPlay = Math.max(1, roll808Bpm);
    const bps = bpmPlay / 60;
    const floorT = ctx.currentTime + 0.012;
    const tBase = ctx.currentTime + 0.06;
    type Hit = { t: number; midi: number; holdBeats: number };
    const hits: Hit[] = [];
    let beatCursor = 0;
    if (sync?.blocks?.length) {
    sync.blocks.forEach((b, i) => {
      const base = resolveAnchorMidi(b.chord, sync.keyRoot, mode, anchor, octaveShift);
      const midi = base == null ? null : (rollPitchOverride[i] ?? base);
      if (midi != null) {
        const shift = noteStartShiftBeats[i] ?? 0;
          const tHit = tBase + (beatCursor + shift) / bps;
          hits.push({ t: tHit, midi, holdBeats: noteDurBeats[i] ?? DEFAULT_NOTE_BEATS });
      }
      beatCursor += b.durationBeats;
    });
    }
    for (const n of manualRollNotes) {
      hits.push({ t: tBase + n.startBeat / bps, midi: n.midi, holdBeats: n.durBeats });
    }
    if (hits.length === 0) return;
    const minT = Math.min(...hits.map((h) => h.t));
    const slip = minT < floorT ? floorT - minT : 0;
    for (const h of hits) {
      playEightZeroEight(ctx, h.t + slip, h.midi, playbackPresetRef.current, toneEffectiveLevel, {
        holdBeats: h.holdBeats,
        bpm: bpmPlay,
        kickKeyboardMap: true,
        kickMonophonic: soundLane === 'kick',
        velocity01: 0.88,
        soundLane,
        subOscOnly: soundLane === 'bass',
        filterFx: lab808FilterRef.current,
      });
    }
  }, [
    getAudioContext,
    sync,
    mode,
    anchor,
    octaveShift,
    rollPitchOverride,
    toneAudible,
    toneEffectiveLevel,
    roll808Bpm,
    noteDurBeats,
    noteStartShiftBeats,
    manualRollNotes,
    soundLane,
  ]);

  const clientYToMidi = useCallback(
    (clientY: number): number | null => {
      const el = rollAreaRef.current;
      if (!el) return null;
      const y = clientY - el.getBoundingClientRect().top;
      const row = Math.floor(y / rollRowH);
      if (row < 0 || row >= nSemitones) return null;
      return midiAtRollRow(row);
    },
    [nSemitones, rollRowH],
  );

  const auditionHover = useCallback(
    (stepIdx: number, midi: number) => {
      const now = performance.now();
      if (hoverRef.current.idx === stepIdx && now - hoverRef.current.t < HOVER_MS) return;
      hoverRef.current = { idx: stepIdx, t: now };
      playHit(midi, stepIdx);
    },
    [playHit],
  );

  const manualHoverRef = useRef({ id: '', t: 0 });
  const auditionManualHover = useCallback(
    (id: string, midi: number, dur: number) => {
      const now = performance.now();
      if (manualHoverRef.current.id === id && now - manualHoverRef.current.t < HOVER_MS) return;
      manualHoverRef.current = { id, t: now };
      playHit(midi, undefined, { holdBeats: dur });
    },
    [playHit],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startClientX;
      const dy = e.clientY - d.startClientY;
      if (d.axis === null) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_AXIS_LOCK_PX) return;
        d.axis = Math.abs(dx) > Math.abs(dy) ? 'slide' : 'pitch';
      }
      d.gestured = true;
      if (d.axis === 'pitch') {
        const m = clientYToMidi(e.clientY);
        if (m == null) return;
        setRollPitchOverride((p) => (p[d.idx] === m ? p : { ...p, [d.idx]: m }));
      } else {
        const dur = noteDurBeatsRef.current[d.idx] ?? DEFAULT_NOTE_BEATS;
        const deltaBeats = Math.round((e.clientX - d.startClientX) / pxPerBeat);
        let nextShift = d.startShift + deltaBeats;
        const minSh = -d.startBeatBase;
        const maxSh = totalBeatsRef.current + TIMELINE_TAIL_PAD_BEATS - dur - d.startBeatBase;
        const absBeat = d.startBeatBase + nextShift;
        nextShift =
          snapBeatToQuantize(absBeat, quantizeRef.current, BEATS_PER_BAR) - d.startBeatBase;
        nextShift = Math.max(minSh, Math.min(maxSh, nextShift));
        setNoteStartShiftBeats((p) => (p[d.idx] === nextShift ? p : { ...p, [d.idx]: nextShift }));
      }
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      const dragSurf = dragTouchSurfaceRef.current;
      if (dragSurf) {
        dragSurf.style.touchAction = '';
        dragTouchSurfaceRef.current = null;
      }
      if (!d) return;
      if (!d.gestured) {
        playHit(d.startMidi, d.idx);
        return;
      }
      if (d.axis === 'pitch') {
        const snap = clientYToMidi(e.clientY);
        if (snap != null) playHit(snap, d.idx);
      } else {
        const midi = stepMidiRef.current[d.idx] ?? d.startMidi;
        playHit(midi, d.idx);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [clientYToMidi, playHit, pxPerBeat]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = resizeRef.current;
      if (!d) return;
      const pxb = pxPerBeatRef.current;
      const step = quantizeStepBeats(quantizeRef.current, BEATS_PER_BAR);
      const rawEnd = d.startBeatAbs + d.startDur + (e.clientX - d.startClientX) / pxb;
      const snappedEnd = snapBeatToQuantize(rawEnd, quantizeRef.current, BEATS_PER_BAR);
      const next = Math.min(MAX_NOTE_BEATS, Math.max(step, snappedEnd - d.startBeatAbs));
      setNoteDurBeats((p) => (p[d.idx] === next ? p : { ...p, [d.idx]: next }));
    };
    const onUp = () => {
      resizeRef.current = null;
      const rs = resizeTouchSurfaceRef.current;
      if (rs) {
        rs.style.touchAction = '';
        resizeTouchSurfaceRef.current = null;
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const beginNoteDrag = useCallback((e: React.PointerEvent, stepIdx: number, midi: number, startBeatBase: number) => {
    if (e.button !== 0) return;
    const startShift = noteStartShiftBeats[stepIdx] ?? 0;
    dragRef.current = {
      idx: stepIdx,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startMidi: midi,
      startShift,
      startBeatBase,
      axis: null,
      gestured: false,
    };
    const el = e.currentTarget as HTMLElement;
    dragTouchSurfaceRef.current = el;
    el.style.touchAction = 'none';
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* */
    }
  }, [noteStartShiftBeats]);

  const beginResize = useCallback(
    (e: React.PointerEvent, stepIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return;
    const dur = noteDurBeats[stepIdx] ?? DEFAULT_NOTE_BEATS;
      const row = rollData[stepIdx];
      const shift = noteStartShiftBeats[stepIdx] ?? 0;
      const startBeatAbs = row != null ? row.startBeat + shift : 0;
      resizeRef.current = { idx: stepIdx, startClientX: e.clientX, startDur: dur, startBeatAbs };
    const el = e.currentTarget as HTMLElement;
    resizeTouchSurfaceRef.current = el;
    el.style.touchAction = 'none';
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* */
    }
    },
    [noteDurBeats, noteStartShiftBeats, rollData],
  );

  const beatAtClientXY = useCallback(
    (clientX: number, clientY: number): { beat: number; midi: number } | null => {
      const vp = rollViewportRef.current;
      if (!vp) return null;
      const vRect = vp.getBoundingClientRect();
      const x = clientX - vRect.left + vp.scrollLeft - ROLL_METRICS.labelW;
      const midi = clientYToMidi(clientY);
      if (midi == null) return null;
      const rawBeat = Math.max(0, x / pxPerBeatRef.current);
      const beat = snapBeatToQuantize(rawBeat, quantizeRef.current, BEATS_PER_BAR);
      return { beat, midi };
    },
    [clientYToMidi],
  );

  const newManualNoteId = useCallback(() => {
    try {
      return crypto.randomUUID();
    } catch {
      return `m-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    }
  }, []);

  const beginManualNoteDrag = useCallback((e: React.PointerEvent, n: ManualRollNote) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (toneRollEraseModeRef.current) {
      setManualRollNotes((prev) => prev.filter((x) => x.id !== n.id));
      return;
    }
    setToneRollSelection(lab808ToneRollNoteRegion(n));
    manualDragRef.current = {
      id: n.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startMidi: n.midi,
      startBeat: n.startBeat,
      startDur: n.durBeats,
      axis: null,
      gestured: false,
    };
    const el = e.currentTarget as HTMLElement;
    manualDragTouchSurfaceRef.current = el;
    el.style.touchAction = 'none';
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* */
    }
  }, []);

  const beginManualResize = useCallback((e: React.PointerEvent, n: ManualRollNote) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return;
    setToneRollSelection(lab808ToneRollNoteRegion(n));
    manualResizeRef.current = { id: n.id, startClientX: e.clientX, startDur: n.durBeats, startBeat: n.startBeat };
    const el = e.currentTarget as HTMLElement;
    manualResizeTouchSurfaceRef.current = el;
    el.style.touchAction = 'none';
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = manualDragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startClientX;
      const dy = e.clientY - d.startClientY;
      if (d.axis === null) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_AXIS_LOCK_PX) return;
        d.axis = Math.abs(dx) > Math.abs(dy) ? 'slide' : 'pitch';
      }
      d.gestured = true;
      const pxb = pxPerBeatRef.current;
      if (d.axis === 'pitch') {
        const m = clientYToMidi(e.clientY);
        if (m == null) return;
        setManualRollNotes((prev) => prev.map((x) => (x.id === d.id ? { ...x, midi: m } : x)));
      } else {
        const maxStart = Math.max(0, totalBeatsRef.current + TIMELINE_TAIL_PAD_BEATS - d.startDur);
        const rawBeat = d.startBeat + (e.clientX - d.startClientX) / pxb;
        let nextBeat = lab808ToneRollSnapNoteStart(rawBeat, quantizeRef.current, BEATS_PER_BAR);
        nextBeat = Math.max(0, Math.min(maxStart, nextBeat));
        setManualRollNotes((prev) => prev.map((x) => (x.id === d.id ? { ...x, startBeat: nextBeat } : x)));
      }
    };
    const onUp = (e: PointerEvent) => {
      const d = manualDragRef.current;
      manualDragRef.current = null;
      const surf = manualDragTouchSurfaceRef.current;
      if (surf) {
        surf.style.touchAction = '';
        manualDragTouchSurfaceRef.current = null;
      }
      if (!d) return;
      if (!d.gestured) {
        playHit(d.startMidi, undefined, { holdBeats: d.startDur });
        return;
      }
      const q = quantizeRef.current;
      setManualRollNotes((prev) =>
        prev.map((x) => {
          if (x.id !== d.id) return x;
          const m = d.axis === 'pitch' ? (clientYToMidi(e.clientY) ?? x.midi) : x.midi;
          return {
            ...x,
            midi: m,
            startBeat: lab808ToneRollSnapNoteStart(x.startBeat, q, BEATS_PER_BAR),
            durBeats: lab808ToneRollSnapNoteDuration(x.durBeats, q, BEATS_PER_BAR),
          };
        }),
      );
      const fin = manualRollNotesRef.current.find((x) => x.id === d.id);
      if (fin) {
        setToneRollSelection(lab808ToneRollNoteRegion(fin));
        playHit(fin.midi, undefined, { holdBeats: fin.durBeats });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [clientYToMidi, playHit]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = manualResizeRef.current;
      if (!d) return;
      const pxb = pxPerBeatRef.current;
      const rawDur = d.startDur + (e.clientX - d.startClientX) / pxb;
      const next = lab808ToneRollSnapNoteDuration(rawDur, quantizeRef.current, BEATS_PER_BAR, MAX_NOTE_BEATS);
      setManualRollNotes((prev) => prev.map((x) => (x.id === d.id ? { ...x, durBeats: next } : x)));
    };
    const onUp = () => {
      const d = manualResizeRef.current;
      manualResizeRef.current = null;
      const rs = manualResizeTouchSurfaceRef.current;
      if (rs) {
        rs.style.touchAction = '';
        manualResizeTouchSurfaceRef.current = null;
      }
      if (!d) return;
      const q = quantizeRef.current;
      setManualRollNotes((prev) =>
        prev.map((x) =>
          x.id === d.id
            ? { ...x, durBeats: lab808ToneRollSnapNoteDuration(x.durBeats, q, BEATS_PER_BAR, MAX_NOTE_BEATS) }
            : x,
        ),
      );
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const rollGridMinW = Math.max(80, layoutBeats * pxPerBeat);
  const rollWidth = ROLL_METRICS.labelW + rollGridMinW;

  const quantGridBeats = useMemo(
    () => quantizeGridBeats(layoutBeats, quantize, BEATS_PER_BAR),
    [layoutBeats, quantize],
  );

  const octaveOptions = useMemo(
    () => Array.from({ length: LAB808_OCTAVE_MAX - LAB808_OCTAVE_MIN + 1 }, (_, i) => LAB808_OCTAVE_MIN + i),
    [],
  );

  const miniSelectStyle = lab808RollSelect;

  const toneRollClipboardReady = toneRollClipRef.current != null;

  const clearToneRoll = useCallback(() => {
    setManualRollNotes([]);
    setRollPitchOverride({});
    setNoteDurBeats(() => {
      const next: Record<number, number> = {};
      for (let i = 0; i < rollData.length; i++) next[i] = DEFAULT_NOTE_BEATS;
      return next;
    });
    setNoteStartShiftBeats(() => {
      const next: Record<number, number> = {};
      for (let i = 0; i < rollData.length; i++) next[i] = 0;
      return next;
    });
    setToneRollSelection(null);
    setToneRollPastePending(false);
  }, [rollData.length]);

  const copyToneRollSelection = useCallback(() => {
    if (!toneRollSelection || !lab808ToneRollRegionHasNotes(manualRollNotes, toneRollSelection)) return false;
    const clip = lab808ToneRollExtractClip(manualRollNotes, toneRollSelection);
    if (!clip) return false;
    toneRollClipRef.current = clip;
    return true;
  }, [manualRollNotes, toneRollSelection]);

  const pasteToneRollClipboardAt = useCallback(
    (destBeat: number, destMidiOrigin: number) => {
      const clip = toneRollClipRef.current;
      if (!clip) return false;
      setManualRollNotes((prev) =>
        lab808ToneRollPasteClip(prev, clip, destBeat, destMidiOrigin, newManualNoteId),
      );
      setToneRollPastePending(false);
      return true;
    },
    [newManualNoteId],
  );

  const pasteToneRollClipboard = useCallback(() => {
    const clip = toneRollClipRef.current;
    if (!clip) return false;
    const destBeat = snapBeatToQuantize(rollPlayheadBeatRef.current, quantize, BEATS_PER_BAR);
    return pasteToneRollClipboardAt(destBeat, clip.midiOrigin);
  }, [pasteToneRollClipboardAt, quantize]);

  const duplicateToneRollSelection = useCallback(() => {
    if (!toneRollSelection) return false;
    const maxBeat = layoutBeats + TIMELINE_TAIL_PAD_BEATS;
    const result = lab808ToneRollDuplicateNotes(
      manualRollNotes,
      toneRollSelection,
      maxBeat,
      BEATS_PER_BAR,
      quantize,
      newManualNoteId,
    );
    if (!result) return false;
    setManualRollNotes(result.notes);
    setToneRollSelection(result.region);
    return true;
  }, [manualRollNotes, toneRollSelection, layoutBeats, quantize, newManualNoteId]);

  const eraseToneRollSelection = useCallback(() => {
    if (!toneRollSelection || !lab808ToneRollRegionHasNotes(manualRollNotes, toneRollSelection)) return false;
    setManualRollNotes((prev) => lab808ToneRollEraseRegion(prev, toneRollSelection));
    setToneRollSelection(null);
    return true;
  }, [manualRollNotes, toneRollSelection]);

  const toneRollEditBtn = useCallback(
    (active?: boolean): CSSProperties => ({
      ...rollBtn(active ? '#422006' : '#27272f', active ? '#fde68a' : '#a1a1aa', active ? '#ca8a04' : '#52525b'),
    }),
    [],
  );

  useEffect(() => {
    if (padDeckBank !== 'tone' || isScreenActive === false) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'c') {
        if (copyToneRollSelection()) e.preventDefault();
        return;
      }
      if (mod && e.key.toLowerCase() === 'v') {
        if (toneRollClipRef.current) {
          e.preventDefault();
          if (!pasteToneRollClipboard()) setToneRollPastePending(true);
        }
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        if (duplicateToneRollSelection()) e.preventDefault();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (eraseToneRollSelection()) e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    padDeckBank,
    isScreenActive,
    copyToneRollSelection,
    pasteToneRollClipboard,
    duplicateToneRollSelection,
    eraseToneRollSelection,
  ]);

  useEffect(() => {
    const onUp = (e: PointerEvent) => {
      const tap = rollEmptyTapRef.current;
      rollEmptyTapRef.current = null;
      if (
        !tap ||
        manualDragRef.current ||
        manualResizeRef.current ||
        dragRef.current ||
        resizeRef.current ||
        toneRollSelectDragRef.current?.gestured
      )
        return;
      if (Math.hypot(e.clientX - tap.clientX, e.clientY - tap.clientY) > ROLL_EMPTY_TAP_MAX_PX) return;
      const pos = beatAtClientXY(e.clientX, e.clientY);
      if (!pos) return;
      if (toneRollPastePendingRef.current) {
        const clip = toneRollClipRef.current;
        if (clip) pasteToneRollClipboardAt(pos.beat, pos.midi);
        return;
      }
      if (toneRollEraseModeRef.current) return;
      const id = newManualNoteId();
      setManualRollNotes((prev) => [...prev, { id, startBeat: pos.beat, midi: pos.midi, durBeats: DEFAULT_NOTE_BEATS }]);
      playHit(pos.midi, undefined, { holdBeats: DEFAULT_NOTE_BEATS, velocity01: tap.velocity01 });
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [beatAtClientXY, newManualNoteId, playHit, pasteToneRollClipboardAt]);

  return (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', background: CB_PIANO_BG, color: '#d0d0d0', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div
        style={{
          flex: '0 0 auto',
          marginTop: padDeckBank === 'drums' ? '0.12in' : '0.2in',
          maxHeight: padDeckBank === 'drums' ? undefined : 'min(40vh, 368px)',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
          flexShrink: 0,
          position: 'relative',
          zIndex: padDeckBank === 'drums' ? 2 : 1,
        }}
      >
      <Lab808DualPadDeck
        getAudioContext={getAudioContext}
        prefetchActive={isScreenActive !== false}
        soundLane={soundLane}
        onSoundLaneChange={setSoundLane}
        tonePresetLabel={tonePresetLabel}
        onPlayToneMidi={playTonePad}
        embedded={embedded}
        onBack={onBack}
        padDeckBank={padDeckBank}
        onPadDeckBankChange={setPadDeckBank}
        mpcKitId={mpcKitId}
        onMpcKitIdChange={setMpcKitId}
        chordRootLock={chordRootLock}
        onChordRootLockChange={handleChordRootLockChange}
        chordLockSource={chordLockSource}
        onChordLockSourceChange={handleChordLockSourceChange}
        canGenerateChordRoots={canGenerateChordRoots}
        onGenerateChordRoots={handleGenerateChordRoots}
        progressionRoots={progressionRoots}
        progressionConnected={progressionConnected}
        progressionLabel={progressionLabel}
        activeRootHighlight={activeRootHighlight}
        toneMasterLevel={velocity}
        onToneMasterLevelChange={setVelocity}
        drumMasterLevel={drumMasterLevel}
        onDrumMasterLevelChange={setDrumMasterLevel}
        toneMuted={toneMuted}
        toneSolo={toneSolo}
        onToneMutedToggle={() => setToneMuted((m) => !m)}
        onToneSoloToggle={() => setToneSolo((s) => !s)}
        toneAudible={toneAudible}
        drumMuted={drumMuted}
        drumSolo={drumSolo}
        onDrumMutedToggle={() => setDrumMuted((m) => !m)}
        onDrumSoloToggle={() => setDrumSolo((s) => !s)}
        drumAudible={drumAudible}
        internal808Link={internal808Link}
        onInternal808LinkChange={handleInternal808LinkChange}
        bpmSyncTarget={bpmSyncTarget}
        onBpmSyncTargetChange={handleBpmSyncTargetChange}
        transportMirror={transportMirror}
        onTransportMirrorChange={handleTransportMirrorChange}
        onApply808Sync={apply808Sync}
        chordPlayThrough={chordPlayThrough}
        onChordPlayThroughChange={setChordPlayThrough}
      />
      </div>

      <div
        style={{
          flex: '1 1 0',
          minHeight: padDeckBank === 'drums' ? 0 : 200,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {padDeckBank === 'tone' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 2px 2px', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', borderRadius: 0, border: `1px solid ${CB_PIANO_MINT_BORDER}`, overflow: 'hidden', background: CB_PIANO_BG }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#8a8a98', padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.30)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, letterSpacing: '0.06em' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, width: '100%' }}>
                <span style={{ flex: '1 1 140px', minWidth: 0, lineHeight: 1.35 }}>
                  <span style={{ color: CB_PIANO_MINT }}>808 Kick / Bass roll</span>
                  {' · '}
                  {nSemitones} keys · {rollRows[nSemitones - 1]}–{rollRows[0]}
                  {import808Hint ? (
                    <span style={{ color: CB_PIANO_MINT }}> · {import808Hint}</span>
                  ) : manualRollNotes.length > 0 ? (
                    <span style={{ color: CB_PIANO_MINT }}> · {manualRollNotes.length} root hits on roll</span>
                  ) : (
                    <span style={{ color: '#52525b' }}>
                      {' '}
                      · CHORD LOCK → pick CB / GL / NS → <strong style={{ color: '#ca8a04' }}>Generate</strong>
                    </span>
                  )}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, flexShrink: 0 }}>
                <div style={{ ...lab808RollTransportCluster, background: '#0a0a0e', border: '1px solid #2a2a32', boxShadow: 'none' }} title="808 Lab MPC transport (same clock as Drum machine tab)">
          <button
            type="button"
                    onClick={() => lab808DeckTransportRef.current?.transportSeekStart()}
                    style={{ ...lab808RollTransportButtonStyle(), width: LAB808_ROLL_TRANSPORT_BTN, height: LAB808_ROLL_TRANSPORT_H }}
                    title="Return to start"
                  >
                    <SkipBack size={LAB808_ROLL_TRANSPORT_ICON} />
          </button>
                  <button
                    type="button"
                    onClick={() => lab808DeckTransportRef.current?.transportStop()}
                    style={{ ...lab808RollTransportButtonStyle(), width: LAB808_ROLL_TRANSPORT_BTN, height: LAB808_ROLL_TRANSPORT_H }}
                    title="Stop"
                  >
                    <Square size={LAB808_ROLL_TRANSPORT_ICON} fill="currentColor" />
                  </button>
                  <button
                    type="button"
                    onClick={() => lab808DeckTransportRef.current?.transportTogglePlayPause()}
            style={{
                      ...lab808RollTransportButtonStyle(labDeckTransport === 'playing'),
                      width: LAB808_ROLL_TRANSPORT_PLAY_W,
                      height: LAB808_ROLL_TRANSPORT_H,
                    }}
                    title={labDeckTransport === 'playing' ? 'Pause' : 'Play'}
                  >
                    {labDeckTransport === 'playing' ? <Pause size={LAB808_ROLL_TRANSPORT_ICON} fill="currentColor" /> : <Play size={LAB808_ROLL_TRANSPORT_ICON} fill="currentColor" />}
                  </button>
                  {sync?.blocks?.length ? (
                    <button
                      type="button"
                      onClick={() => playProgression()}
                      style={{ ...rollBtn('#112015', '#86efac', '#1f3a29'), marginLeft: 2 }}
                      title="Preview chord roots once (no drums)"
                    >
                      ▶ Chords
                    </button>
                  ) : null}
              </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (toneRollSelection && lab808ToneRollRegionHasNotes(manualRollNotes, toneRollSelection)) {
                          eraseToneRollSelection();
                        } else {
                          setToneRollEraseMode((v) => !v);
                        }
                      }}
                      style={toneRollEditBtn(toneRollEraseMode)}
                      title="Erase selection (Delete) or erase-brush — click notes to remove"
                    >
                      Erase
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToneRollSelection()}
                      style={toneRollEditBtn(false)}
                      title="Copy selection (Ctrl+C) — drag empty grid to highlight"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      disabled={!toneRollClipboardReady}
                      onClick={() => {
                        if (!pasteToneRollClipboard()) setToneRollPastePending(true);
                      }}
                      style={{
                        ...toneRollEditBtn(toneRollPastePending),
                        opacity: toneRollClipboardReady ? 1 : 0.45,
                        cursor: toneRollClipboardReady ? 'pointer' : 'not-allowed',
                      }}
                      title={
                        toneRollClipboardReady
                          ? 'Paste (Ctrl+V) — click top-left cell, or pastes at playhead'
                          : 'Copy a region first'
                      }
                    >
                      Paste
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateToneRollSelection()}
                      style={toneRollEditBtn(false)}
                      title="Duplicate selection to next bar line (Ctrl+D)"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={clearToneRoll}
                      style={rollBtn('#111', '#f87171', '#3a1f1f')}
                      title="Clear all notes on this roll"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  <label style={lab808RollToolbarLabel}>
                    Bars
                    <select
                      value={rollTimelineBars}
                      onChange={(e) => setRollTimelineBars(Number(e.target.value) as RollTimelineBarChoice)}
                      style={miniSelectStyle}
                      title="Timeline length (4–32 bars). Grid squeezes to fit the viewport."
                    >
                      {ROLL_TIMELINE_BAR_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div style={{ ...lab808ToolbarBpmRow, gap: 4 }}>
                    <span style={{ fontSize: 8, fontWeight: 800, color: '#71717a', flexShrink: 0 }}>BPM</span>
                    <input
                      type="number"
                      min={40}
                      max={220}
                      step={1}
                      value={roll808Bpm}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isFinite(v)) return;
                        setRoll808BpmOverride(Math.max(40, Math.min(220, v)));
                      }}
                      style={lab808RollBpmInputStyle()}
                      title="808 Lab tempo (preview hits + MPC transport base)"
                    />
          <button
            type="button"
                      onClick={() => setRoll808BpmOverride(null)}
                      disabled={roll808BpmOverride == null}
            style={{
                        ...rollBtn('#27272f', roll808BpmOverride == null ? '#52525b' : '#fde68a', '#52525b'),
                        opacity: roll808BpmOverride == null ? 0.35 : 1,
                        cursor: roll808BpmOverride == null ? 'default' : 'pointer',
                      }}
                      title={
                        roll808BpmOverride == null
                          ? 'Following sync target BPM (use SYNC in pad header or pick Beat Lab / Groove Lab / Chord Builder)'
                          : 'Match BPM from sync target (808 LINK shares with Drum Kits)'
                      }
                    >
                      Sync
          </button>
                  </div>
                  <label style={lab808RollToolbarLabel}>
                    Quant
                    <select
                      value={quantize}
                      onChange={(e) => setQuantize(e.target.value as Lab808Quantize)}
                      style={miniSelectStyle}
                      title="Snap notes to grid"
                    >
                      {LAB808_QUANTIZE_OPTIONS.map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))}
              </select>
            </label>
                  <label style={lab808RollToolbarLabel}>
                    Lo
                    <select
                      value={rollLowOct}
                      onChange={(e) => {
                        const v = +e.target.value;
                        setRollLowOct(v);
                        if (v > rollHighOct) setRollHighOct(v);
                      }}
                      style={miniSelectStyle}
                      title="Lowest octave on keyboard"
                    >
                      {octaveOptions.map((o) => (
                        <option key={o} value={o}>
                          C{o}
                        </option>
                      ))}
                    </select>
            </label>
                  <label style={lab808RollToolbarLabel}>
                    Hi
              <select
                      value={rollHighOct}
                      onChange={(e) => {
                        const v = +e.target.value;
                        setRollHighOct(v);
                        if (v < rollLowOct) setRollLowOct(v);
                      }}
                      style={miniSelectStyle}
                      title="Highest octave on keyboard"
                    >
                      {octaveOptions.map((o) => (
                        <option key={o} value={o}>
                          C{o}
                  </option>
                ))}
              </select>
            </label>
                  <span style={{ fontSize: 8, color: '#52525b', fontWeight: 700 }}>step {quantizeStep.toFixed(3)}b</span>
                </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, width: '100%' }}>
                  <button type="button" onClick={() => setSoundLane('kick')} style={{ ...rollBtn(soundLane === 'kick' ? '#422006' : '#27272f', soundLane === 'kick' ? '#fde68a' : '#a1a1aa', soundLane === 'kick' ? '#ca8a04' : '#52525b') }}>Kick</button>
                  <button type="button" onClick={() => setSoundLane('bass')} style={{ ...rollBtn(soundLane === 'bass' ? '#052e16' : '#27272f', soundLane === 'bass' ? '#86efac' : '#a1a1aa', soundLane === 'bass' ? '#22c55e' : '#52525b') }}>Bass</button>
              <select
                    value={soundLane === 'kick' ? trapKickPresetId : bassPresetId}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (soundLane === 'kick') setTrapKickPresetId(v as TrapHold808PresetId);
                      else setBassPresetId(v as BassLowBassPresetId);
                    }}
                    style={{ ...lab808RollSelect, minWidth: 120, maxWidth: 180 }}
                  >
                    {soundLane === 'kick'
                      ? TRAP_HOLD_808_ORDER.map((id) => (
                          <option key={id} value={id}>
                            {formatLab808KickDisplayLabel(lab808TrapKickCreatedName(id))}
                          </option>
                        ))
                      : BASS_LOW_BASS_ORDER.map((id) => (
                          <option key={id} value={id}>
                            {formatLab808KickDisplayLabel(lab808BassCreatedName(id))}
                          </option>
                        ))}
              </select>
                  <span style={lab808RollFxLabel}>HP</span>
                  <input type="range" min={0} max={8000} step={10} value={lab808HpHz < 25 ? 0 : lab808HpHz} onChange={(e) => { const v = +e.target.value; setLab808HpHz(v < 25 ? 0 : v); }} style={{ ...lab808FilterRangeStyle('#7cf4c6'), width: 72, height: 4 }} title="High-pass filter" />
                  <span style={lab808RollFxLabel}>LP</span>
                  <input type="range" min={200} max={20000} step={50} value={lab808LpHz >= 200 && lab808LpHz < 19900 ? lab808LpHz : 20000} onChange={(e) => { const v = +e.target.value; setLab808LpHz(v >= 19900 ? 0 : v); }} style={{ ...lab808FilterRangeStyle('#7cf4c6'), width: 72, height: 4 }} title="Low-pass filter" />
                  <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    <GrooveLabExportStrip
                      toolbarInline
                      showExportLabel
                      widerButtons
                      busy={exportBusy}
                      status={exportStatus}
                      hasChords={toneExportHasNotes}
                      hasRollNotes={toneExportHasNotes}
                      onExportMidi={handleToneExportMidi}
                      onExportWav={handleToneExportWav}
                      onExportToPad={handleToneExportToPadRequest}
                      padExportEnabled={padExportEnabled}
                      padPickerOpen={padExportRequest === 'tone'}
                    />
                  </div>
            </div>
            </div>
            <div
              ref={rollViewportRef}
              style={{
                flex: 1,
                minHeight: 0,
                minWidth: 0,
                  overflowX: 'auto',
                  overflowY: rollScrollsVertically ? 'auto' : 'hidden',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
              }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: rollWidth, flexShrink: 0 }}>
                <div
                  style={{ ...cbPianoRulerStyle(ROLL_METRICS), minWidth: rollWidth, cursor: 'pointer' }}
                  title="Click timeline to cue the playhead (same transport as Drum machine)"
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    const vp = rollViewportRef.current;
                    if (!vp) return;
                    const vRect = vp.getBoundingClientRect();
                    const x = e.clientX - vRect.left + vp.scrollLeft - ROLL_METRICS.labelW;
                    let bRoll = Math.max(0, x / Math.max(1e-6, pxPerBeat));
                    bRoll = snapBeatToQuantize(bRoll, quantize, BEATS_PER_BAR);
                    lab808DeckTransportRef.current?.transportSeekToRollQuarterBeat(bRoll);
                  }}
                >
                  <div style={cbPianoRulerLabelStyle(ROLL_METRICS)}>BAR</div>
                  <div style={{ display: 'flex', minWidth: rollGridMinW }}>
                    {Array.from({ length: rollBarCount }, (_, bar) => (
                      <div key={bar} style={cbPianoRulerBarStyle(BEATS_PER_BAR * pxPerBeat, ROLL_METRICS)}>
                        {bar + 1}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', height: rollHeight, minWidth: rollWidth, flexShrink: 0 }}>
                <div style={{ ...cbPianoKeyRailOuterStyle(ROLL_METRICS), height: rollHeight }}>
                  {rollRows.map((noteName) => {
                    const midi = cbPianoNoteNameToMidi(noteName);
                    const inScale = sync != null && isInScalePitch(midi, sync.keyRoot, mode);
                    const isRoot = sync != null && ((midi - sync.keyRoot) % 12 + 12) % 12 === 0;
                    const dim = sync != null && !inScale && !isRoot;
                    return (
                      <div key={noteName} style={cbPianoPitchRowStyle(midi, ROLL_METRICS)}>
                        <button
                          type="button"
                          title={`${noteName} · MIDI ${midi}`}
                          aria-label={`808 ${noteName} MIDI ${midi}`}
                          onPointerDown={(e) => {
                            if (e.button !== 0) return;
                            e.preventDefault();
                            e.stopPropagation();
                            playHit(midi, undefined, {
                              holdBeats: soundLane === 'bass' ? KEY_PREVIEW_HOLD_BEATS_BASS : KEY_PREVIEW_HOLD_BEATS_KICK,
                              velocity01: pointerStrikeVelocity(e),
                            });
                          }}
                    style={{
                            ...cbPianoKeyCellStyle(ROLL_METRICS),
                      height: rollRowH,
                            opacity: dim ? 0.45 : 1,
                          }}
                        >
                          <div style={cbPianoKeyFaceStyle(midi, isRoot, ROLL_METRICS)}>{cbPianoKeyLabel(midi)}</div>
                        </button>
                  </div>
                    );
                  })}
              </div>
              <div
                ref={rollAreaRef}
                style={{
                  position: 'relative',
                    zIndex: 1,
                    width: rollGridMinW,
                    minWidth: rollGridMinW,
                    maxWidth: rollGridMinW,
                    height: rollHeight,
                    flex: '0 0 auto',
                    overflow: 'hidden',
                  touchAction: 'pan-x pan-y',
                }}
              >
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    {rollRows.map((noteName, j) => {
                      const midi = cbPianoNoteNameToMidi(noteName);
                    const top = j * rollRowH;
                    const rk = sync && ((midi - sync.keyRoot) % 12 + 12) % 12 === 0;
                      const inScale = sync != null && isInScalePitch(midi, sync.keyRoot, mode);
                      const rowBase = cbPianoGridRowStyle(midi);
                    return (
                      <div
                          key={noteName}
                        style={{
                          position: 'absolute',
                          top,
                          height: rollRowH,
                            ...rowBase,
                            borderBottom: rk
                              ? '1px solid rgba(124,244,198,0.22)'
                              : inScale
                                ? '1px solid rgba(124,244,198,0.10)'
                                : rowBase.borderBottom,
                            background: rk
                              ? 'rgba(124,244,198,0.14)'
                              : inScale
                                ? 'rgba(124,244,198,0.06)'
                                : rowBase.background,
                        }}
                      />
                    );
                  })}
                </div>
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    {quantGridBeats.map((beat, gi) => {
                      const isBar = isQuantizeBarLine(beat, BEATS_PER_BAR);
                      const isBeat = isQuantizeBeatLine(beat);
                    return (
                      <div
                          key={`${beat}-${gi}`}
                        style={{
                          position: 'absolute',
                          top: 0,
                          height: rollHeight,
                            left: beat * pxPerBeat,
                            width: 1,
                            marginLeft: isBar ? -1 : 0,
                            background: isBar
                              ? CB_PIANO_MINT_BORDER
                              : isBeat
                                ? 'rgba(124,244,198,0.12)'
                                : 'rgba(255,255,255,0.04)',
                            opacity: 1,
                        }}
                      />
                    );
                  })}
                </div>
                  {toneRollSelection && (() => {
                    const topHi = rollTopPxForMidi(toneRollSelection.midiHi);
                    const topLo = rollTopPxForMidi(toneRollSelection.midiLo);
                    if (topHi == null || topLo == null) return null;
                    const top = Math.min(topHi, topLo);
                    const h = Math.abs(topLo - topHi) + rollRowH;
                    return (
                      <div
                        style={{
                          position: 'absolute',
                          zIndex: 2,
                          left: toneRollSelection.beat0 * pxPerBeat + 1,
                          top,
                          width: Math.max(4, (toneRollSelection.beat1 - toneRollSelection.beat0 + quantizeStep) * pxPerBeat),
                          height: h,
                          border: '1px dashed #fde68a',
                          background: 'rgba(253, 224, 108, 0.1)',
                          pointerEvents: 'none',
                        }}
                      />
                    );
                  })()}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 1,
                      touchAction: 'pan-x pan-y',
                      cursor: toneRollPastePending ? 'copy' : toneRollEraseMode ? 'cell' : 'crosshair',
                    }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      if (toneRollPastePendingRef.current) {
                        rollEmptyTapRef.current = {
                          clientX: e.clientX,
                          clientY: e.clientY,
                          velocity01: pointerStrikeVelocity(e),
                        };
                        return;
                      }
                      const pos = beatAtClientXY(e.clientX, e.clientY);
                      if (!pos) return;
                      toneRollSelectDragRef.current = {
                        anchorBeat: pos.beat,
                        anchorMidi: pos.midi,
                        pointerId: e.pointerId,
                        gestured: false,
                        clientX: e.clientX,
                        clientY: e.clientY,
                      };
                      rollEmptyTapRef.current = {
                        clientX: e.clientX,
                        clientY: e.clientY,
                        velocity01: pointerStrikeVelocity(e),
                      };
                      try {
                        e.currentTarget.setPointerCapture(e.pointerId);
                      } catch {
                        /* */
                      }
                    }}
                    onPointerMove={(e) => {
                      const sel = toneRollSelectDragRef.current;
                      if (!sel || sel.pointerId !== e.pointerId) return;
                      if (!sel.gestured) {
                        if (Math.hypot(e.clientX - sel.clientX, e.clientY - sel.clientY) < ROLL_EMPTY_TAP_MAX_PX) return;
                        sel.gestured = true;
                        rollEmptyTapRef.current = null;
                      }
                      const pos = beatAtClientXY(e.clientX, e.clientY);
                      if (!pos) return;
                      setToneRollSelection(
                        lab808ToneRollRegionFromPoints(sel.anchorBeat, sel.anchorMidi, pos.beat, pos.midi),
                      );
                    }}
                    onLostPointerCapture={() => {
                      toneRollSelectDragRef.current = null;
                    }}
                    aria-hidden
                  />
                  {SHOW_SYNC_CHORD_NOTES_ON_ROLL &&
                    rollData.map((r) => {
                  if (r.midi == null) return null;
                    const rowTop = rollTopPxForMidi(r.midi);
                    if (rowTop == null) return null;
                  const dur = noteDurBeats[r.i] ?? DEFAULT_NOTE_BEATS;
                  const shift = noteStartShiftBeats[r.i] ?? 0;
                    const top = rowTop;
                  const left = (r.startBeat + shift) * pxPerBeat + 1;
                  const w = Math.max(noteMinW, dur * pxPerBeat - 2);
                  const h = Math.max(noteMinH, rollRowH - 2);
                  const tw = rollPitchOverride[r.i] != null || shift !== 0;
                  const bodyW = Math.max(8, w - RESIZE_HANDLE_W);
                  return (
                    <div
                      key={r.i}
                      role="button"
                      tabIndex={0}
                      onPointerEnter={(e) => {
                        if (e.buttons !== 0) return;
                        auditionHover(r.i, r.midi!);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          playHit(r.midi!, r.i);
                        }
                      }}
                      style={{
                        position: 'absolute',
                          zIndex: 2,
                        left,
                        top: top + Math.max(0, (rollRowH - h) / 2),
                        width: w,
                        height: h,
                      borderRadius: 6,
                        border: tw ? '2px solid #22d3ee' : '1px solid #15803d',
                        background: '#0f172a',
                        boxShadow: tw ? '0 0 12px rgba(34,211,238,0.45)' : '0 0 10px rgba(74,222,128,0.35)',
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'stretch',
                        overflow: 'hidden',
                        opacity: isScreenActive === false ? 0.75 : 1,
                        userSelect: 'none',
                      }}
                    >
                      <div
                        onPointerDown={(e) => beginNoteDrag(e, r.i, r.midi!, r.startBeat)}
                        onLostPointerCapture={(e) => {
                          const t = e.currentTarget as HTMLElement;
                          if (dragTouchSurfaceRef.current === t) {
                            dragTouchSurfaceRef.current = null;
                            t.style.touchAction = '';
                          }
                          dragRef.current = null;
                        }}
                        style={{
                          width: bodyW,
                          cursor: 'grab',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                            ...lab808RollChordNoteFont,
                          color: '#052e16',
                          background: tw ? 'linear-gradient(180deg,#6ee7b7,#0f766e)' : 'linear-gradient(180deg,#4ade80,#166534)',
                          minWidth: 0,
                            padding: '2px 4px',
                        }}
                      >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }}>
                          {dur >= 4 ? r.chord : ''}
                          {dur < 4 && dur > 1 ? `${dur}b` : ''}
                        </span>
                      </div>
                      <div
                        onPointerDown={(e) => beginResize(e, r.i)}
                        onLostPointerCapture={(e) => {
                          const t = e.currentTarget as HTMLElement;
                          if (resizeTouchSurfaceRef.current === t) {
                            resizeTouchSurfaceRef.current = null;
                            t.style.touchAction = '';
                          }
                          resizeRef.current = null;
                        }}
                        style={{
                          width: RESIZE_HANDLE_W,
                          flexShrink: 0,
                          cursor: 'ew-resize',
                          background: 'linear-gradient(180deg,#14532d,#052e16)',
                          borderLeft: '1px solid rgba(0,0,0,0.35)',
                        }}
                      />
                    </div>
                  );
                })}
                  {manualRollNotes.map((n) => {
                    const dur = n.durBeats;
                    const rowTop = rollTopPxForMidi(n.midi);
                    if (rowTop == null) return null;
                    const top = rowTop;
                    const left = n.startBeat * pxPerBeat + 1;
                    const w = Math.max(noteMinW, dur * pxPerBeat - 2);
                    const h = Math.max(noteMinH, rollRowH - 2);
                    const bodyW = Math.max(8, w - RESIZE_HANDLE_W);
                    const isPlaying = activeNoteHighlightId === n.id;
                    const isSelected = lab808ToneRollNoteInRegion(n, toneRollSelection);
                    const rollLabel = n.chord ? `${n.chord} · ${midiToLabel(n.midi)}` : midiToLabel(n.midi);
                    return (
                      <div
                        key={n.id}
                        role="button"
                        tabIndex={0}
                        onPointerEnter={(e) => {
                          if (e.buttons !== 0) return;
                          auditionManualHover(n.id, n.midi, dur);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setManualRollNotes((prev) => prev.filter((x) => x.id !== n.id));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            playHit(n.midi, undefined, { holdBeats: dur });
                          }
                        }}
                        style={{
                          position: 'absolute',
                          zIndex: isPlaying ? 8 : isSelected ? 5 : 3,
                          left,
                          top: top + Math.max(0, (rollRowH - h) / 2),
                          width: w,
                          height: h,
                          borderRadius: 4,
                          border: isPlaying
                            ? '2px solid #fde68a'
                            : isSelected
                              ? '2px solid #fde68a'
                              : `1px solid ${CB_PIANO_MINT_BORDER_STRONG}`,
                          background: isPlaying || isSelected ? '#0f172a' : CB_PIANO_BG,
                          boxShadow: isPlaying
                            ? '0 0 18px rgba(253, 224, 108, 0.65), 0 0 10px rgba(124, 244, 198, 0.45)'
                            : isSelected
                              ? '0 0 14px rgba(253, 224, 108, 0.5), 0 0 8px rgba(124, 244, 198, 0.4)'
                              : '0 0 6px rgba(124, 244, 198, 0.35)',
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'stretch',
                          overflow: 'hidden',
                          opacity: isScreenActive === false ? 0.75 : 1,
                          userSelect: 'none',
                        }}
                      >
                        <div
                          onPointerDown={(e) => beginManualNoteDrag(e, n)}
                          onLostPointerCapture={(e) => {
                            const t = e.currentTarget as HTMLElement;
                            if (manualDragTouchSurfaceRef.current === t) {
                              manualDragTouchSurfaceRef.current = null;
                              t.style.touchAction = '';
                            }
                            manualDragRef.current = null;
                          }}
                          style={{
                            width: bodyW,
                            cursor: 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            ...lab808RollChordNoteFont,
                            minWidth: 0,
                            padding: '2px 4px',
                            ...(isPlaying
                              ? {
                                  color: '#052e16',
                                  background: 'linear-gradient(180deg, #fde68a, #ca8a04)',
                                }
                              : cbPianoManualNoteBodyStyle()),
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }}>
                            {rollLabel}
                          </span>
              </div>
                        <div
                          onPointerDown={(e) => beginManualResize(e, n)}
                          onLostPointerCapture={(e) => {
                            const t = e.currentTarget as HTMLElement;
                            if (manualResizeTouchSurfaceRef.current === t) {
                              manualResizeTouchSurfaceRef.current = null;
                              t.style.touchAction = '';
                            }
                            manualResizeRef.current = null;
                          }}
                          style={{
                            width: RESIZE_HANDLE_W,
                            flexShrink: 0,
                            cursor: 'ew-resize',
                            ...cbPianoManualNoteResizeStyle(),
                          }}
                        />
            </div>
                    );
                  })}
                  <div
                    ref={rollPlaylineRef}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: 2,
                      height: rollHeight,
                      marginLeft: -1,
                      borderRadius: 1,
                      background: CB_PIANO_MINT,
                      boxShadow: '0 0 8px rgba(124,244,198,0.55)',
                      zIndex: 12,
                      pointerEvents: 'none',
                    }}
                    aria-hidden
                  />
          </div>
                </div>
                </div>
              </div>
            </div>
        </div>
        ) : null}
        <div
          style={{
            flex: padDeckBank === 'drums' ? '1 1 0' : '0 0 auto',
            minHeight: padDeckBank === 'drums' ? 0 : 0,
            height: padDeckBank === 'drums' ? '100%' : 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            pointerEvents: padDeckBank === 'drums' ? 'auto' : 'none',
            position: 'relative',
            zIndex: 1,
          }}
          aria-hidden={padDeckBank !== 'drums'}
        >
        <EightZeroEightLabDrumMachine
          ref={lab808DeckTransportRef}
          active={isScreenActive !== false || linkedToGrooveLab}
          transportKeepAlive={padDeckBank === 'tone' || linkedToGrooveLab}
          sequencerVisible={padDeckBank === 'drums'}
          embeddedIn808Lab
          masterLevel={drumEffectiveLevel}
          mpcKitId={mpcKitId}
          onMpcKitIdChange={setMpcKitId}
          rollPlaylineRef={padDeckBank === 'tone' ? rollPlaylineRef : undefined}
          rollPxPerBeat={pxPerBeat}
          rollLayoutBeats={layoutBeats}
          rollLoopBeats={lab808LoopBeats}
          onRefillLockedRoots={refillLockedRootsOnTransport}
          alignTransportToGrooveClock={followGrooveLabSession || linkedToGrooveLab}
          onAfterGrooveAlignedPlay={(ctx) => {
            if (followGrooveLabSessionRef.current) primeGrooveLinkedRootsRef.current(ctx);
          }}
          onTransportChange={onLabDeckTransportChange}
          onRollDisplayQuarterBeatRef={onRollDisplayQuarterBeatRef}
          isScreenActive={isScreenActive}
          getAudioContext={getAudioContext}
          labStripBpm={roll808Bpm}
          linkedPlaybackBpm={internal808Link ? roll808Bpm : undefined}
          labBpmOverrideActive={roll808BpmOverride != null}
          onLabBpmSyncReset={() => setRoll808BpmOverride(null)}
          onLabBpmOverride={(bpm) => setRoll808BpmOverride(bpm)}
          drumExportBusy={exportBusy}
          drumExportStatus={exportStatus}
          onDrumExportMidi={handleDrumExportMidi}
          onDrumExportWav={handleDrumExportWav}
          onDrumExportToPad={handleDrumExportToPadRequest}
          drumPadExportEnabled={padExportEnabled}
          drumPadPickerOpen={padExportRequest === 'drums'}
          suggestedLoopBars={lab808LoopBars}
        />
        </div>
      </div>
      <GrooveLabBeatLabPadPicker
        open={padExportRequest != null}
        busy={exportBusy}
        title={
          padExportRequest === 'drums'
            ? 'Export Drum kits roll to Beat Lab pad'
            : 'Export 808 Kick/Bass roll to Beat Lab pad'
        }
        onPick={confirmPadExport}
        onCancel={() => setPadExportRequest(null)}
      />
    </div>
  );
}
