import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, Pause, Play, SkipBack, Square } from 'lucide-react';
import type { ChordMode, ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import { chordSymbolToMidi, chordSymbolToName, MODE_LABELS } from '@/app/lib/creationStation/chordBuilder';
import { readChordSync } from '@/app/lib/chordBuilderSync';
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
  /** `(baseOctave+1)*12+key` — use `0` so roots sit low (sub/kick register); OCTAVE shifts from there. */
  const m = chordSymbolToMidi(symbol as ChordSymbol, keyRoot, mode, 0);
  if (!m?.length) return null;
  const sorted = [...m].sort((a, b) => a - b);
  let note: number;
  switch (anchor) {
    case 'root':
      note = m[0]!;
      break;
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
const btnMini: CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid #52525b',
  background: '#27272f',
  color: '#fde68a',
  fontWeight: 800,
  fontSize: 11,
  cursor: 'pointer',
};

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
/** Chord-sync progression blocks on the roll (off while building 808 hits on the grid). */
const SHOW_SYNC_CHORD_NOTES_ON_ROLL = false;

type ManualRollNote = { id: string; startBeat: number; midi: number; durBeats: number };

export default function EightZeroEightTab({ embedded, isScreenActive, onBack, getAudioContext, fallbackBpm }: EightZeroEightTabProps) {
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
  const [labPanel, setLabPanel] = useState<'808-roll' | 'drum-machine'>('808-roll');
  const [labDeckTransport, setLabDeckTransport] = useState<Lab808DeckTransportState>('stopped');
  const [quantize, setQuantize] = useState<Lab808Quantize>('1/16');
  const [rollLowOct, setRollLowOct] = useState(LAB808_OCTAVE_LOW_DEFAULT);
  const [rollHighOct, setRollHighOct] = useState(LAB808_OCTAVE_HIGH_DEFAULT);

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
    if (labPanel !== '808-roll') return;
    const vp = rollViewportRef.current;
    if (!vp) return;
    const c2Idx = rollRows.indexOf('C2');
    if (c2Idx < 0) return;
    vp.scrollTop = Math.max(0, c2Idx * rollRowH - rollRowH * 2);
  }, [labPanel, rollRowH, rollRows]);

  const noteMinW = Math.max(16, Math.floor(pxPerBeat * 0.7));
  const noteMinH = Math.max(12, rollRowH - 4);

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

  const playHit = useCallback(
    (midi: number, stepIdx?: number, opts?: { holdBeats?: number; velocity01?: number }) => {
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
      playEightZeroEight(ctx, when, midi, playbackPresetRef.current, velocity, {
        holdBeats: hold,
        bpm: roll808Bpm,
        kickKeyboardMap: true,
        kickMonophonic: true,
        velocity01: strike,
        soundLane,
        filterFx: lab808FilterRef.current,
      });
    },
    [getAudioContext, velocity, noteDurBeats, noteStartShiftBeats, roll808Bpm, soundLane],
  );

  const playProgression = useCallback(() => {
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
      playEightZeroEight(ctx, h.t + slip, h.midi, playbackPresetRef.current, velocity, {
        holdBeats: h.holdBeats,
        bpm: bpmPlay,
        kickKeyboardMap: true,
        kickMonophonic: soundLane === 'kick',
        velocity01: 0.88,
        soundLane,
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
    velocity,
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
    const onUp = (e: PointerEvent) => {
      const tap = rollEmptyTapRef.current;
      rollEmptyTapRef.current = null;
      if (!tap || manualDragRef.current || manualResizeRef.current || dragRef.current || resizeRef.current) return;
      if (Math.hypot(e.clientX - tap.clientX, e.clientY - tap.clientY) > ROLL_EMPTY_TAP_MAX_PX) return;
      const pos = beatAtClientXY(e.clientX, e.clientY);
      if (!pos) return;
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
  }, [beatAtClientXY, newManualNoteId, playHit]);

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
        const deltaBeats = Math.round((e.clientX - d.startClientX) / pxb);
        const maxStart = Math.max(0, totalBeatsRef.current + TIMELINE_TAIL_PAD_BEATS - d.startDur);
        let nextBeat = d.startBeat + deltaBeats;
        nextBeat = snapBeatToQuantize(nextBeat, quantizeRef.current, BEATS_PER_BAR);
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
      if (d.axis === 'pitch') {
        const snap = clientYToMidi(e.clientY);
        if (snap != null) playHit(snap, undefined, { holdBeats: d.startDur });
      } else {
        playHit(d.startMidi, undefined, { holdBeats: d.startDur });
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
      const step = quantizeStepBeats(quantizeRef.current, BEATS_PER_BAR);
      const rawEnd = d.startBeat + d.startDur + (e.clientX - d.startClientX) / pxb;
      const snappedEnd = snapBeatToQuantize(rawEnd, quantizeRef.current, BEATS_PER_BAR);
      const next = Math.min(MAX_NOTE_BEATS, Math.max(step, snappedEnd - d.startBeat));
      setManualRollNotes((prev) => prev.map((x) => (x.id === d.id ? { ...x, durBeats: next } : x)));
    };
    const onUp = () => {
      manualResizeRef.current = null;
      const rs = manualResizeTouchSurfaceRef.current;
      if (rs) {
        rs.style.touchAction = '';
        manualResizeTouchSurfaceRef.current = null;
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

  const miniSelectStyle: CSSProperties = {
    padding: '2px 4px',
    borderRadius: 4,
    border: '1px solid #3f3f46',
    background: '#12121a',
    color: '#e4e4e7',
    fontSize: 8,
    fontWeight: 800,
  };

  const hasRollTweaks =
    manualRollNotes.length > 0 ||
    Object.keys(rollPitchOverride).length > 0 ||
    Object.keys(noteDurBeats).some((k) => noteDurBeats[+k] !== DEFAULT_NOTE_BEATS) ||
    Object.keys(noteStartShiftBeats).some((k) => (noteStartShiftBeats[+k] ?? 0) !== 0);

  return (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', background: CB_PIANO_BG, color: '#d0d0d0', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: `1px solid ${CB_PIANO_MINT_BORDER}`, background: 'rgba(8,8,12,0.98)', flexShrink: 0 }}>
        {embedded && onBack && (
          <button type="button" onClick={onBack} style={{ ...btnGhost, padding: '6px 10px' }}>
            <ChevronLeft size={16} /> Back
          </button>
        )}
        <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: '-0.02em', color: '#f0f0f0' }}>808 LAB</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#555', letterSpacing: '0.1em' }}>PIANO ROLL</span>
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '4px 10px', borderBottom: `1px solid ${CB_PIANO_MINT_BORDER}`, background: 'rgba(8,8,12,0.98)', flexShrink: 0 }}>
        <button type="button" onClick={() => setLabPanel('808-roll')} style={{ ...btnMini, padding: '3px 10px', fontSize: 10, borderColor: labPanel === '808-roll' ? CB_PIANO_MINT_BORDER : '#1a1a1a', background: labPanel === '808-roll' ? CB_PIANO_MINT_BG : 'transparent', color: labPanel === '808-roll' ? CB_PIANO_MINT : '#3a3a3a' }}>
          808 Lab
        </button>
        <button type="button" onClick={() => setLabPanel('drum-machine')} style={{ ...btnMini, padding: '3px 10px', fontSize: 10, borderColor: labPanel === 'drum-machine' ? '#22c55e55' : '#1a1a1a', background: labPanel === 'drum-machine' ? '#052e16' : 'transparent', color: labPanel === 'drum-machine' ? '#86efac' : '#3a3a3a' }}>
          Drum machine
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: labPanel === '808-roll' ? 'flex' : 'none', flexDirection: 'column', padding: '2px 4px', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', borderRadius: 0, border: `1px solid ${CB_PIANO_MINT_BORDER}`, overflow: 'hidden', background: CB_PIANO_BG }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#8a8a98', padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.30)', flexShrink: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6, letterSpacing: '0.06em' }}>
                <span style={{ flex: '1 1 140px', minWidth: 0, lineHeight: 1.35 }}>
                  {nSemitones} keys · {rollRows[nSemitones - 1]}–{rollRows[0]}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }} title="808 Lab MPC transport (same clock as Drum machine tab)">
                  <button
                    type="button"
                    onClick={() => lab808DeckTransportRef.current?.transportSeekStart()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      flexShrink: 0,
                      border: 'none',
                      borderRadius: 6,
                      background: '#101014',
                      color: '#8aa0b5',
                      cursor: 'pointer',
                    }}
                    title="Return to start"
                  >
                    <SkipBack size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => lab808DeckTransportRef.current?.transportStop()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      flexShrink: 0,
                      border: 'none',
                      borderRadius: 6,
                      background: '#101014',
                      color: '#8aa0b5',
                      cursor: 'pointer',
                    }}
                    title="Stop"
                  >
                    <Square size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => lab808DeckTransportRef.current?.transportTogglePlayPause()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 34,
                      height: 28,
                      flexShrink: 0,
                      border: 'none',
                      borderRadius: 6,
                      background:
                        labDeckTransport === 'playing'
                          ? 'rgba(0, 229, 255, 0.18)'
                          : 'linear-gradient(145deg, #1e3a5f, #122032)',
                      color: labDeckTransport === 'playing' ? '#5eead4' : '#cffafe',
                      cursor: 'pointer',
                    }}
                    title={labDeckTransport === 'playing' ? 'Pause' : 'Play'}
                  >
                    {labDeckTransport === 'playing' ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#94a3b8', fontWeight: 800 }}>
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#94a3b8', fontWeight: 800 }}>
                    BPM
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
                      style={{ ...miniSelectStyle, width: 44, MozAppearance: 'textfield' }}
                      title="808 Lab tempo (preview hits + MPC transport base)"
                    />
                    <button
                      type="button"
                      onClick={() => setRoll808BpmOverride(null)}
                      disabled={roll808BpmOverride == null}
                      style={{
                        ...btnMini,
                        padding: '2px 6px',
                        fontSize: 8,
                        opacity: roll808BpmOverride == null ? 0.35 : 1,
                        cursor: roll808BpmOverride == null ? 'default' : 'pointer',
                      }}
                      title={roll808BpmOverride == null ? 'Already following Chord Builder / lab BPM' : 'Use BPM from Chord Builder sync (or fallback)'}
                    >
                      Sync
                    </button>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#94a3b8', fontWeight: 800 }}>
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#94a3b8', fontWeight: 800 }}>
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#94a3b8', fontWeight: 800 }}>
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
                  <span style={{ fontSize: 8, color: '#52525b' }}>step {quantizeStep.toFixed(3)}b</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, width: '100%' }}>
                  <button type="button" onClick={() => setSoundLane('kick')} style={{ ...btnMini, padding: '2px 6px', fontSize: 8, borderColor: soundLane === 'kick' ? '#ca8a04' : '#52525b', background: soundLane === 'kick' ? '#422006' : '#27272f', color: soundLane === 'kick' ? '#fde68a' : '#a1a1aa' }}>Kick</button>
                  <button type="button" onClick={() => setSoundLane('bass')} style={{ ...btnMini, padding: '2px 6px', fontSize: 8, borderColor: soundLane === 'bass' ? '#22c55e' : '#52525b', background: soundLane === 'bass' ? '#052e16' : '#27272f', color: soundLane === 'bass' ? '#86efac' : '#a1a1aa' }}>Bass</button>
                  <select
                    value={soundLane === 'kick' ? trapKickPresetId : bassPresetId}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (soundLane === 'kick') setTrapKickPresetId(v as TrapHold808PresetId);
                      else setBassPresetId(v as BassLowBassPresetId);
                    }}
                    style={{ padding: '2px 4px', borderRadius: 4, border: '1px solid #3f3f46', background: '#12121a', color: '#e4e4e7', fontSize: 8, fontWeight: 800, maxWidth: 128 }}
                  >
                    {soundLane === 'kick'
                      ? TRAP_HOLD_808_ORDER.map((id) => (
                          <option key={id} value={id}>
                            {TRAP_HOLD_808_PRESETS[id].label}
                          </option>
                        ))
                      : BASS_LOW_BASS_ORDER.map((id) => (
                          <option key={id} value={id}>
                            {BASS_LOW_BASS_PRESETS[id].label}
                          </option>
                        ))}
                  </select>
                  <input type="range" min={0.35} max={1} step={0.02} value={velocity} onChange={(e) => setVelocity(+e.target.value)} title="Level" style={{ width: 52, accentColor: '#ca8a04' }} />
                  <span style={{ fontSize: 8, color: '#52525b' }}>HP</span>
                  <input type="range" min={0} max={8000} step={10} value={lab808HpHz < 25 ? 0 : lab808HpHz} onChange={(e) => { const v = +e.target.value; setLab808HpHz(v < 25 ? 0 : v); }} style={{ width: 44, accentColor: '#7cf4c6' }} />
                  <span style={{ fontSize: 8, color: '#52525b' }}>LP</span>
                  <input type="range" min={200} max={20000} step={50} value={lab808LpHz >= 200 && lab808LpHz < 19900 ? lab808LpHz : 20000} onChange={(e) => { const v = +e.target.value; setLab808LpHz(v >= 19900 ? 0 : v); }} style={{ width: 44, accentColor: '#7cf4c6' }} />
                  {hasRollTweaks && (
                    <button
                      type="button"
                      onClick={() => {
                        setRollPitchOverride({});
                        setManualRollNotes([]);
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
                      }}
                      style={{ ...btnMini, padding: '2px 6px', fontSize: 8 }}
                    >
                      Reset
                    </button>
                  )}
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
                    const row = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - row.left - ROLL_METRICS.labelW;
                    const bRoll = Math.max(0, x / Math.max(1e-6, pxPerBeat));
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
                  <div
                    style={{ position: 'absolute', inset: 0, zIndex: 1, touchAction: 'pan-x pan-y', cursor: 'crosshair' }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      rollEmptyTapRef.current = {
                        clientX: e.clientX,
                        clientY: e.clientY,
                        velocity01: pointerStrikeVelocity(e),
                      };
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
                            fontSize: 12,
                            fontWeight: 900,
                            color: '#052e16',
                            background: tw ? 'linear-gradient(180deg,#6ee7b7,#0f766e)' : 'linear-gradient(180deg,#4ade80,#166534)',
                            minWidth: 0,
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>
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
                          zIndex: 3,
                          left,
                          top: top + Math.max(0, (rollRowH - h) / 2),
                          width: w,
                          height: h,
                          borderRadius: 4,
                            border: `1px solid ${CB_PIANO_MINT_BORDER_STRONG}`,
                            background: CB_PIANO_BG,
                            boxShadow: '0 0 6px rgba(124, 244, 198, 0.35)',
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
                            fontSize: 12,
                            fontWeight: 900,
                            minWidth: 0,
                            ...cbPianoManualNoteBodyStyle(),
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>{midiToLabel(n.midi)}</span>
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
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: labPanel === 'drum-machine' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
          <EightZeroEightLabDrumMachine
            ref={lab808DeckTransportRef}
            active={labPanel === 'drum-machine'}
            transportKeepAlive={labPanel === '808-roll'}
            rollPlaylineRef={rollPlaylineRef}
            rollPxPerBeat={pxPerBeat}
            onTransportChange={setLabDeckTransport}
            isScreenActive={isScreenActive}
            getAudioContext={getAudioContext}
            labStripBpm={roll808Bpm}
          />
        </div>
      </div>
    </div>
  );
}
