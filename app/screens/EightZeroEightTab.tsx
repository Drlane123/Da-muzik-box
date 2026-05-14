import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { ChordMode, ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import { chordSymbolToMidi, chordSymbolToName, MODE_LABELS } from '@/app/lib/creationStation/chordBuilder';
import { readChordSync } from '@/app/lib/chordBuilderSync';
import {
  EIGHT_ZERO_EIGHT_BODY_PRESET_ORDER,
  EIGHT_ZERO_EIGHT_PRESETS,
  merge808BodyAndSub,
  SUB_808_PRESETS,
  SUB_808_PRESET_ORDER,
  playEightZeroEight,
  type EightZeroEightBodyPresetId,
  type EightZeroEightSubPresetId,
} from '@/app/lib/creationStation/eightZeroEightVoice';

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
  const m = chordSymbolToMidi(symbol as ChordSymbol, keyRoot, mode, 2);
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
  return note + octaveShift * 12;
}
function midiToLabel(n: number): string {
  return `${NOTE_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
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
/** Preferred zoom when the viewport is large enough (shrinks automatically to show the full roll). */
const PX_PER_BEAT_BASE = 36;
const ROLL_ROW_H_BASE = 26;
const LABEL_COL_W = 64;
const HOVER_MS = 220;
/** Pixels before body-drag locks to either pitch (vertical) or slide-in-time (horizontal). */
const DRAG_AXIS_LOCK_PX = 10;
const RESIZE_HANDLE_W = 14;
/** Extra beats past progression end notes may extend into (for layout + slide clamp). */
const TIMELINE_TAIL_PAD_BEATS = 24;
const DEFAULT_NOTE_BEATS = 4;
const MIN_NOTE_BEATS = 1;
const MAX_NOTE_BEATS = 16;

export default function EightZeroEightTab({ embedded, isScreenActive, onBack, getAudioContext, fallbackBpm }: EightZeroEightTabProps) {
  const [syncTick, setSyncTick] = useState(0);
  const [bodyPresetId, setBodyPresetId] = useState<EightZeroEightBodyPresetId>('classic');
  const [subPresetId, setSubPresetId] = useState<EightZeroEightSubPresetId>('subVelvet');
  const [anchor, setAnchor] = useState<EightZeroEightAnchor>('root');
  const [octaveShift, setOctaveShift] = useState(-1);
  const [velocity, setVelocity] = useState(0.92);
  const [rollPitchOverride, setRollPitchOverride] = useState<Record<number, number>>({});
  const [noteDurBeats, setNoteDurBeats] = useState<Record<number, number>>({});
  /** Integer beats: slide note start earlier/later vs chord step grid (0 = aligned). */
  const [noteStartShiftBeats, setNoteStartShiftBeats] = useState<Record<number, number>>({});
  const rollAreaRef = useRef<HTMLDivElement | null>(null);
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
  const resizeRef = useRef<{ idx: number; startClientX: number; startDur: number } | null>(null);
  /** Restore `touch-action` after pitch drag (see window pointerup). */
  const dragTouchSurfaceRef = useRef<HTMLElement | null>(null);
  const resizeTouchSurfaceRef = useRef<HTMLElement | null>(null);

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
  const bpm = sync?.bpm ?? fallbackBpm;

  const mergedPreset = useMemo(
    () => merge808BodyAndSub(EIGHT_ZERO_EIGHT_PRESETS[bodyPresetId], SUB_808_PRESETS[subPresetId]),
    [bodyPresetId, subPresetId],
  );

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
    return m;
  }, [rollData, totalBeats, noteDurBeats, noteStartShiftBeats]);

  const maxGridBeats = Math.ceil(maxNoteEndBeat) + 1;

  const { rollMinMidi, rollMaxMidi } = useMemo(() => {
    const mids = displayRows.map((r) => r.midi).filter((m): m is number => m != null);
    if (!mids.length) return { rollMinMidi: 28, rollMaxMidi: 55 };
    let lo = Math.max(15, Math.min(...mids) - 4);
    let hi = Math.min(90, Math.max(...mids) + 4);
    if (hi - lo < 14) hi = lo + 14;
    return { rollMinMidi: lo, rollMaxMidi: hi };
  }, [displayRows]);

  const nSemitones = rollMaxMidi - rollMinMidi + 1;

  const rollViewportRef = useRef<HTMLDivElement>(null);
  const [rollViewport, setRollViewport] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = rollViewportRef.current;
    if (!el || rollData.length === 0) {
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
  }, [rollData.length, rollMinMidi, rollMaxMidi, maxGridBeats]);

  const pxPerBeat = useMemo(() => {
    const beats = Math.max(1, maxGridBeats);
    const base = PX_PER_BEAT_BASE;
    const minPx = 8;
    const innerW = rollViewport.w;
    if (innerW < LABEL_COL_W + 60) return base;
    const avail = Math.max(40, innerW - LABEL_COL_W - 12);
    const natural = beats * base + 8;
    if (natural <= avail) return base;
    return Math.max(minPx, Math.floor((avail - 8) / beats));
  }, [rollViewport.w, maxGridBeats]);

  const rollRowH = useMemo(() => {
    const rows = Math.max(1, nSemitones);
    const base = ROLL_ROW_H_BASE;
    const minRh = 10;
    const innerH = rollViewport.h;
    if (innerH < 48) return base;
    const avail = Math.max(40, innerH - 4);
    const natural = rows * base;
    if (natural <= avail) return base;
    return Math.max(minRh, Math.floor(avail / rows));
  }, [rollViewport.h, nSemitones]);

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
    (midi: number, stepIdx?: number) => {
      const ctx = getAudioContext();
      if (!ctx) return;
      const hold = stepIdx != null ? (noteDurBeats[stepIdx] ?? DEFAULT_NOTE_BEATS) : DEFAULT_NOTE_BEATS;
      const shift = stepIdx != null ? (noteStartShiftBeats[stepIdx] ?? 0) : 0;
      const bps = Math.max(1, bpm) / 60;
      const when = ctx.currentTime + 0.02 + shift / bps;
      playEightZeroEight(ctx, when, midi, mergedPreset, velocity, { holdBeats: hold, bpm });
    },
    [getAudioContext, mergedPreset, velocity, noteDurBeats, noteStartShiftBeats, bpm],
  );

  const playProgression = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx || !sync?.blocks?.length) return;
    const t0 = ctx.currentTime + 0.06;
    const bps = Math.max(1, bpm) / 60;
    let beatCursor = 0;
    sync.blocks.forEach((b, i) => {
      const base = resolveAnchorMidi(b.chord, sync.keyRoot, mode, anchor, octaveShift);
      const midi = base == null ? null : (rollPitchOverride[i] ?? base);
      if (midi != null) {
        const hold = noteDurBeats[i] ?? DEFAULT_NOTE_BEATS;
        const shift = noteStartShiftBeats[i] ?? 0;
        const tHit = t0 + (beatCursor + shift) / bps;
        playEightZeroEight(ctx, tHit, midi, mergedPreset, velocity, { holdBeats: hold, bpm });
      }
      beatCursor += b.durationBeats;
    });
  }, [
    getAudioContext,
    sync,
    mode,
    anchor,
    octaveShift,
    rollPitchOverride,
    mergedPreset,
    velocity,
    bpm,
    noteDurBeats,
    noteStartShiftBeats,
  ]);

  const clientYToMidi = useCallback(
    (clientY: number): number | null => {
      const el = rollAreaRef.current;
      if (!el) return null;
      const y = clientY - el.getBoundingClientRect().top;
      return Math.max(15, Math.min(90, rollMaxMidi - Math.floor(y / rollRowH)));
    },
    [rollMaxMidi, rollRowH],
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
      const deltaBeats = Math.round((e.clientX - d.startClientX) / pxPerBeat);
      const next = Math.max(MIN_NOTE_BEATS, Math.min(MAX_NOTE_BEATS, d.startDur + deltaBeats));
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
  }, [pxPerBeat]);

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

  const beginResize = useCallback((e: React.PointerEvent, stepIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return;
    const dur = noteDurBeats[stepIdx] ?? DEFAULT_NOTE_BEATS;
    resizeRef.current = { idx: stepIdx, startClientX: e.clientX, startDur: dur };
    const el = e.currentTarget as HTMLElement;
    resizeTouchSurfaceRef.current = el;
    el.style.touchAction = 'none';
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* */
    }
  }, [noteDurBeats]);

  const rollHeight = nSemitones * rollRowH;
  const rollWidth = Math.max(LABEL_COL_W + 80, maxGridBeats * pxPerBeat + 8);

  const hasRollTweaks =
    Object.keys(rollPitchOverride).length > 0 ||
    Object.keys(noteDurBeats).some((k) => noteDurBeats[+k] !== DEFAULT_NOTE_BEATS) ||
    Object.keys(noteStartShiftBeats).some((k) => (noteStartShiftBeats[+k] ?? 0) !== 0);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#07070a',
        color: '#d4d4d8',
        fontFamily: 'Inter,system-ui,sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          borderBottom: '1px solid #1a1a22',
          background: '#0c0c10',
          flexShrink: 0,
        }}
      >
        {embedded && onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #2a2a32',
              background: '#141418',
              color: '#a1a1aa',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            <ChevronLeft size={16} /> Back
          </button>
        )}
        <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.06em', color: '#fafafa' }}>808 LAB</span>
        <span style={{ fontSize: 11, color: '#71717a', fontWeight: 600 }}>
          Roll fits the window when possible (full progression + pitch range); otherwise scroll inside the roll.
        </span>
      </div>
      <div
        style={{
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {!!sync?.blocks?.length && rootChordLabel && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid #3f2e08',
              background: 'linear-gradient(135deg,#1c1410,#0f0f14)',
            }}
          >
            <div style={{ flex: '1 1 200px' }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: '#a8a29e' }}>KEY · MODE · TEMPO</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#fde68a', marginTop: 4 }}>
                {keyName} <span style={{ color: '#67e8f9' }}>{mode}</span>{' '}
                <span style={{ fontSize: 14, color: '#94a3b8' }}>· {Math.round(bpm)} BPM</span>
              </div>
              <div style={{ fontSize: 11, color: '#78716c', marginTop: 4 }}>{sync.progressionName}</div>
            </div>
            <div
              style={{
                flex: '1 1 220px',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid rgba(251,191,36,0.45)',
                background: 'rgba(251,191,36,0.08)',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 900, color: '#fcd34d' }}>ROOT CHORD (START)</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginTop: 2 }}>
                <span style={{ color: '#c4b5fd' }}>{rootChordLabel.roman}</span>
                <span style={{ color: '#94a3b8', fontSize: 14, marginLeft: 8 }}>{rootChordLabel.name}</span>
              </div>
            </div>
          </div>
        )}
        {!sync?.blocks?.length && (
          <div style={{ padding: 12, borderRadius: 8, border: '1px dashed #3f3f46', color: '#a78bfa', fontSize: 12 }}>
            No chord sync — open Chord Builder or Chord/Bass Sequencer first.
          </div>
        )}
        {rollData.length > 0 && hasRollTweaks && (
          <button
            type="button"
            onClick={() => {
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
            }}
            style={{
              alignSelf: 'flex-start',
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #52525b',
              background: '#1c1c24',
              color: '#a1a1aa',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Reset roll (pitch + time slide + note length)
          </button>
        )}
        {!!sync?.blocks?.length && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', flexShrink: 0 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#71717a' }}>ANCHOR</span>
              <select value={anchor} onChange={(e) => setAnchor(e.target.value as EightZeroEightAnchor)} style={selectStyle}>
                <option value="root">Root</option>
                <option value="third">3rd</option>
                <option value="fifth">5th</option>
                <option value="seventh">7th</option>
                <option value="lowest">Lowest</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#71717a' }}>OCTAVE</span>
              <input type="range" min={-2} max={1} step={1} value={octaveShift} onChange={(e) => setOctaveShift(+e.target.value)} style={{ width: 120 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#71717a' }}>808</span>
              <select
                value={bodyPresetId}
                onChange={(e) => setBodyPresetId(e.target.value as EightZeroEightBodyPresetId)}
                style={{ ...selectStyle, minWidth: 220 }}
              >
                {EIGHT_ZERO_EIGHT_BODY_PRESET_ORDER.map((id) => (
                  <option key={id} value={id}>
                    {EIGHT_ZERO_EIGHT_PRESETS[id].label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#71717a' }}>SUB 808</span>
              <select
                value={subPresetId}
                onChange={(e) => setSubPresetId(e.target.value as EightZeroEightSubPresetId)}
                style={{ ...selectStyle, minWidth: 220 }}
              >
                {SUB_808_PRESET_ORDER.map((id) => (
                  <option key={id} value={id}>
                    {SUB_808_PRESETS[id].label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#71717a' }}>LEVEL</span>
              <input type="range" min={0.35} max={1} step={0.02} value={velocity} onChange={(e) => setVelocity(+e.target.value)} style={{ width: 100 }} />
            </label>
            <button type="button" onClick={playProgression} style={btnPrimary}>
              ▶ Play progression
            </button>
            <button
              type="button"
              onClick={() => {
                const f = displayRows.find((x) => x.midi != null);
                if (f?.midi != null) playHit(f.midi, f.i);
              }}
              disabled={!displayRows.some((x) => x.midi != null)}
              style={btnGhost}
            >
              Hit first chord
            </button>
          </div>
        )}
        {displayRows.length > 0 && (
          <div
            style={{
              flexShrink: 0,
              maxHeight: 'min(36vh, 340px)',
              overflowY: 'auto',
              overflowX: 'hidden',
              borderRadius: 10,
              border: '1px solid #27272f',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 1fr 48px 44px 44px 1fr 90px',
                padding: '8px 10px',
                fontSize: 10,
                fontWeight: 900,
                color: '#71717a',
                background: '#12121a',
                borderBottom: '1px solid #27272f',
              }}
            >
              <span>#</span>
              <span>ROMAN</span>
              <span>CHORD</span>
              <span>STEP</span>
              <span>NOTE</span>
              <span>SLIDE</span>
              <span>MIDI</span>
              <span />
            </div>
            {displayRows.map((r) => {
              const rd = rollData[r.i];
              const sh = noteStartShiftBeats[r.i] ?? 0;
              const slideLabel = sh === 0 ? '0' : sh > 0 ? `+${sh}` : `${sh}`;
              const startBeatUi = rd ? rd.startBeat + sh : sh;
              return (
                <div
                  key={r.i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr 1fr 48px 44px 44px 1fr 90px',
                    alignItems: 'center',
                    padding: '8px 10px',
                    fontSize: 12,
                    borderBottom: '1px solid #1c1c24',
                    background: '#0f0f14',
                  }}
                >
                  <span style={{ color: '#52525b', fontWeight: 800 }}>{r.i + 1}</span>
                  <span style={{ color: '#a78bfa', fontWeight: 800 }}>{r.chord}</span>
                  <span style={{ color: '#86efac' }}>{r.name}</span>
                  <span style={{ color: '#94a3b8' }}>{r.beats}</span>
                  <span style={{ color: '#fcd34d', fontWeight: 800 }}>{noteDurBeats[r.i] ?? DEFAULT_NOTE_BEATS}b</span>
                  <span style={{ color: '#7dd3fc', fontWeight: 800 }} title={`Hit starts at beat ${startBeatUi}`}>{slideLabel}</span>
                  <span style={{ fontFamily: 'monospace', color: '#fde68a' }}>
                    {r.midi == null ? '—' : `${r.midi} · ${midiToLabel(r.midi)}`}
                  </span>
                  <button type="button" disabled={r.midi == null} onClick={() => r.midi != null && playHit(r.midi, r.i)} style={{ ...btnMini, opacity: r.midi ? 1 : 0.35 }}>
                    ▶ Hit
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {rollData.length > 0 && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 10,
              border: '1px solid #2a2a32',
              overflow: 'hidden',
              background: '#08080c',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                color: '#71717a',
                padding: '8px 10px',
                borderBottom: '1px solid #1f1f28',
                background: '#0c0c12',
                flexShrink: 0,
              }}
            >
              808 PIANO ROLL · each new note defaults to {DEFAULT_NOTE_BEATS} beats (one measure)
            </div>
            <div
              ref={rollViewportRef}
              style={{
                display: 'flex',
                flex: 1,
                minHeight: 0,
                minWidth: 0,
                overflow: 'auto',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <div
                style={{
                  width: LABEL_COL_W,
                  flexShrink: 0,
                  borderRight: '1px solid #27272f',
                  background: '#0a0a0e',
                  zIndex: 2,
                }}
              >
                {Array.from({ length: nSemitones }, (_, j) => rollMaxMidi - j).map((midi) => (
                  <div
                    key={midi}
                    style={{
                      height: rollRowH,
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: midi % 12 === 0 ? '#fde68a' : '#52525b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: 4,
                      borderBottom: '1px solid #141418',
                    }}
                  >
                    {midiToLabel(midi)}
                  </div>
                ))}
              </div>
              <div
                ref={rollAreaRef}
                style={{
                  position: 'relative',
                  minWidth: rollWidth,
                  minHeight: rollHeight,
                  flex: 1,
                  /* Let the scroll parent receive pans; notes set touchAction:none while dragging */
                  touchAction: 'pan-x pan-y',
                }}
              >
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  {Array.from({ length: nSemitones }, (_, j) => {
                    const midi = rollMaxMidi - j;
                    const top = j * rollRowH;
                    const rk = sync && ((midi - sync.keyRoot) % 12 + 12) % 12 === 0;
                    return (
                      <div
                        key={midi}
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top,
                          height: rollRowH,
                          borderBottom: `1px solid ${rk ? '#3f2e08' : '#12121a'}`,
                          background: rk ? 'rgba(251,191,36,0.04)' : 'transparent',
                        }}
                      />
                    );
                  })}
                </div>
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  {Array.from({ length: maxGridBeats + 1 }, (_, bi) => {
                    const isMeasure = bi % 4 === 0;
                    return (
                      <div
                        key={bi}
                        style={{
                          position: 'absolute',
                          top: 0,
                          height: rollHeight,
                          left: bi * pxPerBeat,
                          width: isMeasure ? 2 : 1,
                          marginLeft: isMeasure ? -1 : 0,
                          background: isMeasure ? '#3f3f55' : '#16161c',
                          opacity: isMeasure ? 1 : 0.85,
                        }}
                      />
                    );
                  })}
                </div>
                {rollData.map((r) => {
                  if (r.midi == null) return null;
                  const dur = noteDurBeats[r.i] ?? DEFAULT_NOTE_BEATS;
                  const shift = noteStartShiftBeats[r.i] ?? 0;
                  const top = (rollMaxMidi - r.midi) * rollRowH;
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
                      title="hover=play · drag body: horizontal=time · vertical=pitch · right strip=length"
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
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
