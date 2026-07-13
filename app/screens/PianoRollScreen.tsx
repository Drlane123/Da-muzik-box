import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import {
  Piano, Send, ZoomIn, ZoomOut, Maximize2, Repeat,
  Play, Pause, Square, SkipBack, Rewind, FastForward,
} from 'lucide-react';

import { useMasterClock, LOOP_BAR_OPTIONS } from '@/app/context/MasterClockContext';
import { usePianoRollSe2Transport } from '@/app/hooks/usePianoRollSe2Transport';
import { PianoRollPlayheadMount } from '@/app/components/pianoRoll/PianoRollPlayheadMount';

import { useView } from '@/app/context/ViewContext';

import { useMidiInputRoute } from '@/app/hooks/useMidiInputRoute';
import { MIDI_INPUT_ROUTES } from '@/app/lib/midi/midiInputBus';

import ResizablePanel from '@/app/components/ResizablePanel';
import LoopMarkersBrace, { LoopVerticalGuides } from '@/app/components/LoopMarkersBrace';
import {
  CB_PIANO_MINT,
  CB_PIANO_MINT_BG,
  CB_PIANO_MINT_BORDER,
  CB_PIANO_MINT_BORDER_STRONG,
  cbPianoKeyCellStyle,
  cbPianoKeyFaceStyle,
  cbPianoKeyLabel,
  cbPianoManualNoteBodyStyle,
  type PianoRollMetrics,
} from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import {
  PIANO_ROLL_DRUM_CATALOG,
  PIANO_ROLL_RNB_PRESETS,
  PIANO_ROLL_TRAP_PRESETS,
  pianoRollPatternToNotes,
  pianoRollTransportBpmForPreset,
  pianoRollDrumPresetById,
  type PianoRollDrumPreset,
} from '@/app/lib/pianoRoll/pianoRollDrumCatalog';
import {
  loadPianoRollDrumKit,
  pianoRollPadIndexForMidi,
  pianoRollPadLabelsForKit,
  PIANO_ROLL_DRUM_PADS,
  triggerPianoRollDrumPad,
  type PianoRollDrumKitSession,
} from '@/app/lib/pianoRoll/pianoRollDrumEngine';
import {
  PIANO_ROLL_BEATS_PER_BAR,
  PIANO_ROLL_STEPS_PER_BAR,
  type PianoRollTransportData,
} from '@/app/lib/pianoRoll/pianoRollSe2Scheduler';


const OCTAVES = [5, 4, 3, 2];

const NOTE_LABELS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const IS_BLACK    = [false,true,false,true,false,false,true,false,true,false,true,false];

const INSTRUMENTS = ['Piano','Synth','Bass','Lead','Pad','Keys'];

const INST_COLORS = ['#00E5FF','#D500F9','#00ff88','#ff6b35','#a78bfa','#ffcc00'];

const DRUM_COLORS = [
  '#D500F9', '#00E5FF', '#ff6b35', '#00ff88', '#ffcc00', '#a78bfa', '#f472b6', '#60a5fa',
  '#fb7185', '#34d399', '#fbbf24', '#818cf8', '#e879f9', '#22d3ee', '#f97316', '#4ade80',
];


type Note = { row: number; col: number }; // col = 1/16th step index

type PlayVoice = { osc: OscillatorNode; gain: GainNode };


const PIANO_KEY_W = 56;

const DRUM_KEY_W  = 84;

/** Default cell size at zoom 1 — matches Chord Builder / Groove Lab beat columns. */
const PIANO_ROLL_PX_PER_BEAT = 36;
const PIANO_ROLL_MIN_COL_W = 24;
const PIANO_ROLL_ROW_H = 22;


// How many 1/16th steps per display column at each zoom level

// At default zoom: 1 col = 1 beat = 4 sixteenth notes

// We always render at 1 col = 1/16th note internally, but group visually


export default function PianoRollScreen({
  onExport,
  isScreenActive = true,
}: {
  onExport: (dest: string) => void;
  isScreenActive?: boolean;
}) {
  const clock = useMasterClock();
  const {
    globalZoom, setGlobalZoom, globalVZoom, setGlobalVZoom,
    pianoHeight, setPianoHeight, selectedBar, setSelectedBar,
    totalDisplayBars, setTotalDisplayBars, fitBarsToWidth,
  } = useView();
  /** Standalone roll — not shared with Beat Lab / Creation Station. */
  const [notes, setNotes] = useState<Note[]>([]);

  const [instrument, setInstrument] = useState(0);
  const [drumMode, setDrumMode]     = useState(false);
  const [drumNotes, setDrumNotes]   = useState<Note[]>([]);
  const [drumPresetId, setDrumPresetId] = useState(PIANO_ROLL_TRAP_PRESETS[0]?.id ?? PIANO_ROLL_DRUM_CATALOG[0]!.id);
  const [drumCategory, setDrumCategory] = useState<'Trap' | 'R&B'>('Trap');
  const [drumRowLabels, setDrumRowLabels] = useState<string[]>(() =>
    pianoRollPadLabelsForKit(PIANO_ROLL_TRAP_PRESETS[0]?.kitId ?? 'trapStreetCyborgWoofer'),
  );
  const [kitLoading, setKitLoading] = useState(false);
  const drumKitSessionRef = useRef<PianoRollDrumKitSession | null>(null);
  const activeDrumPreset = useMemo(
    () => PIANO_ROLL_DRUM_CATALOG.find((p) => p.id === drumPresetId) ?? PIANO_ROLL_DRUM_CATALOG[0]!,
    [drumPresetId],
  );
  const drumBankPresets = drumCategory === 'Trap' ? PIANO_ROLL_TRAP_PRESETS : PIANO_ROLL_RNB_PRESETS;
  const [autoScroll, setAutoScroll] = useState(true);
  const [pressedKeyRow, setPressedKeyRow] = useState<number | null>(null);

  /** Restore readable cell size when landing here (other screens may have zoomed out). */
  useEffect(() => {
    if (!isScreenActive) return;
    if (globalZoom < 1) setGlobalZoom(1);
    if (globalVZoom < 1) setGlobalVZoom(1);
  }, [isScreenActive, globalZoom, globalVZoom, setGlobalZoom, setGlobalVZoom]);

  const zoom   = Math.max(0.1, Math.min(4, globalZoom));
  const pxPerBeat = Math.round(PIANO_ROLL_PX_PER_BEAT * zoom);
  const pxPer16th = Math.max(
    Math.ceil(PIANO_ROLL_MIN_COL_W / 4),
    Math.round(pxPerBeat / PIANO_ROLL_BEATS_PER_BAR),
  );
  const BARS   = Math.max(4, Math.min(128, totalDisplayBars));
  const COLS   = BARS * PIANO_ROLL_STEPS_PER_BAR;
  const beatW  = pxPer16th * PIANO_ROLL_BEATS_PER_BAR;
  const barW   = pxPer16th * PIANO_ROLL_STEPS_PER_BAR;
  const rowH   = Math.round(PIANO_ROLL_ROW_H * Math.max(1, Math.min(4, globalVZoom)));
  const keyW   = drumMode ? DRUM_KEY_W : PIANO_KEY_W;
  const color  = INST_COLORS[instrument];

  const scrollRef    = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playheadRef  = useRef<HTMLDivElement>(null);
  const playingOscsRef = useRef<Map<string, PlayVoice>>(new Map());

  // Center on selectedBar
  useEffect(() => {
    if (selectedBar === null || !scrollRef.current) return;
    scrollRef.current.scrollLeft = Math.max(0, (selectedBar - 1) * barW - 120);
  }, [selectedBar, barW]);

  // Fit to window (F key)
  const handleFit = useCallback(() => {
    const w = containerRef.current?.clientWidth ?? window.innerWidth;
    // target: all bars fit → colW16 = (w - keyW) / (BARS * STEPS_PER_BAR)
    const target16 = Math.max(6, Math.floor((w - keyW) / (BARS * PIANO_ROLL_STEPS_PER_BAR)));
    const newZoom = (target16 * PIANO_ROLL_BEATS_PER_BAR) / PIANO_ROLL_PX_PER_BEAT;
    setGlobalZoom(Math.max(0.1, Math.min(4, newZoom)));
  }, [BARS, keyW, setGlobalZoom]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'KeyF' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault(); handleFit();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleFit]);

  const {
    bpm,
    masterOutputLinear,
    loopEnabled,
    loopStartBar,
    loopBars,
    loopSection,
    setLoopEnabled,
    clearLoop,
    setLoopRange,
    getOrCreateAudioContext,
    setBpm,
    metronomeEnabled,
    setMetronomeEnabled,
    stopMetronomeLoop,
  } = clock;

  const applyDrumPreset = useCallback(
    async (preset: PianoRollDrumPreset) => {
      setDrumCategory(preset.category);
      setDrumRowLabels(pianoRollPadLabelsForKit(preset.kitId));
      setDrumNotes(pianoRollPatternToNotes(preset.pattern));
      setBpm(pianoRollTransportBpmForPreset(preset));
      setKitLoading(true);
      try {
        const ctx = getOrCreateAudioContext();
        if (ctx.state === 'suspended') await ctx.resume();
        drumKitSessionRef.current = await loadPianoRollDrumKit(preset.kitId, ctx);
      } catch {
        drumKitSessionRef.current = null;
      } finally {
        setKitLoading(false);
      }
    },
    [getOrCreateAudioContext, setBpm],
  );

  useEffect(() => {
    if (!drumMode || !isScreenActive) return;
    void applyDrumPreset(activeDrumPreset);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload kit when preset changes in drum mode
  }, [drumMode, isScreenActive, drumPresetId]);

  const loadDrumPreset = useCallback(
    (preset: PianoRollDrumPreset) => {
      setDrumPresetId(preset.id);
      setDrumCategory(preset.category);
    },
    [],
  );

  const loopLengthOptions = useMemo(() => {
    const set = new Set<number>([...LOOP_BAR_OPTIONS, loopBars]);
    return [...set].filter((n) => n >= 1 && n <= BARS).sort((a, b) => a - b);
  }, [loopBars, BARS]);

  const rows: { label: string; isBlack: boolean }[] = [];
  for (const oct of OCTAVES) {
    for (let n = 11; n >= 0; n--) {
      rows.push({ label: `${NOTE_LABELS[n]}${oct}`, isBlack: IS_BLACK[n] });
    }
  }

  function toggleNote(row: number, col: number) {
    setNotes((prev) =>
      prev.some((n) => n.row === row && n.col === col)
        ? prev.filter((n) => !(n.row === row && n.col === col))
        : [...prev, { row, col }],
    );
  }
  function toggleDrum(row: number, col: number) {
    setDrumNotes(prev => prev.some(n => n.row === row && n.col === col)
      ? prev.filter(n => !(n.row === row && n.col === col))
      : [...prev, { row, col }]);
  }

  function noteNameToMidi(name: string): number {
    const octave = parseInt(name[name.length - 1] ?? '4', 10);
    const noteName = name.slice(0, -1);
    const noteIdx = NOTE_LABELS.indexOf(noteName);
    return octave * 12 + noteIdx + 12;
  }

  const audioDest = useCallback(
    (ctx: AudioContext) => {
      const master = (window as unknown as { __daMusicMasterGain?: GainNode | null })
        .__daMusicMasterGain;
      return master && master.context === ctx ? master : ctx.destination;
    },
    [],
  );

  const rowIndexForMidi = useCallback(
    (midi: number): number => {
      let best = -1;
      let dist = 999;
      for (let i = 0; i < rows.length; i++) {
        const d = Math.abs(noteNameToMidi(rows[i]!.label) - midi);
        if (d < dist) {
          dist = d;
          best = i;
        }
      }
      return dist <= 2 ? best : -1;
    },
    [rows],
  );

  const playPianoRow = useCallback((rowIndex: number, duration = 0.35, velocity = 100) => {
    try {
      const row = rows[rowIndex];
      if (!row) return;
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime;
      const midiNote = noteNameToMidi(row.label);
      const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
      const key = `${midiNote}`;
      const vel = Math.max(0.04, Math.min(1, velocity / 127));

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(audioDest(ctx));

      switch (instrument) {
        case 0:
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.15 * vel, now);
          gain.gain.exponentialRampToValueAtTime(0.02, now + duration);
          break;
        case 1:
          osc.type = 'triangle';
          gain.gain.setValueAtTime(0.12 * vel, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
          break;
        case 2:
          osc.type = 'sawtooth';
          gain.gain.setValueAtTime(0.14 * vel, now);
          gain.gain.exponentialRampToValueAtTime(0.02, now + duration);
          break;
        default:
          osc.type = 'square';
          gain.gain.setValueAtTime(0.10 * vel, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + duration * 0.8);
      }

      osc.frequency.setValueAtTime(freq, now);
      osc.start(now);
      osc.stop(now + duration);
      playingOscsRef.current.set(key, { osc, gain });
      setTimeout(() => playingOscsRef.current.delete(key), duration * 1000);
    } catch {
      /* ignore playback errors */
    }
  }, [rows, getOrCreateAudioContext, instrument, audioDest]);

  const playDrumRow = useCallback(
    (rowIndex: number, velocity = 100) => {
      try {
        const ctx = getOrCreateAudioContext();
        if (ctx.state === 'suspended') void ctx.resume();
        if (triggerPianoRollDrumPad(drumKitSessionRef.current, rowIndex, ctx, velocity)) return;
        const now = ctx.currentTime;
        const dest = audioDest(ctx);
        const vel = Math.max(0.05, Math.min(1, velocity / 127));
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(dest);
        const profiles: { type: OscillatorType; freq: number; dur: number; peak: number }[] = [
          { type: 'sine', freq: 52, dur: 0.22, peak: 0.42 },
          { type: 'triangle', freq: 180, dur: 0.12, peak: 0.28 },
          { type: 'square', freq: 320, dur: 0.08, peak: 0.18 },
          { type: 'square', freq: 8000, dur: 0.04, peak: 0.12 },
          { type: 'sine', freq: 420, dur: 0.18, peak: 0.2 },
          { type: 'triangle', freq: 140, dur: 0.1, peak: 0.22 },
          { type: 'triangle', freq: 96, dur: 0.14, peak: 0.24 },
          { type: 'square', freq: 620, dur: 0.05, peak: 0.14 },
        ];
        const p = profiles[rowIndex % profiles.length] ?? profiles[0]!;
        osc.type = p.type;
        osc.frequency.setValueAtTime(p.freq, now);
        gain.gain.setValueAtTime(p.peak * vel, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + p.dur);
        osc.start(now);
        osc.stop(now + p.dur + 0.02);
      } catch {
        /* ignore */
      }
    },
    [audioDest, getOrCreateAudioContext],
  );

  const playMidiNote = useCallback(
    (midi: number, velocity: number, drumChannel: boolean) => {
      if (drumMode || drumChannel) {
        playDrumRow(pianoRollPadIndexForMidi(midi), velocity);
        return;
      }
      const row = rowIndexForMidi(midi);
      if (row >= 0) {
        setPressedKeyRow(row);
        playPianoRow(row, 0.4, velocity);
      }
    },
    [drumMode, playDrumRow, playPianoRow, rowIndexForMidi],
  );

  useMidiInputRoute(MIDI_INPUT_ROUTES.pianoRoll, {
    enabled: isScreenActive,
    onNoteOn: (e) => playMidiNote(e.note, e.velocity, e.channel === 9),
    onNoteOff: () => setPressedKeyRow(null),
  });

  const notesRef = useRef(notes);
  const drumNotesRef = useRef(drumNotes);
  const drumModeRef = useRef(drumMode);
  notesRef.current = notes;
  drumNotesRef.current = drumNotes;
  drumModeRef.current = drumMode;
  const instrumentRef = useRef(instrument);
  instrumentRef.current = instrument;
  const playPianoAtRef = useRef<(row: number, when: number, ctx: AudioContext) => void>(() => {});
  playPianoAtRef.current = (rowIndex, when, ctx) => {
    try {
      const row = rows[rowIndex];
      if (!row) return;
      const midiNote = noteNameToMidi(row.label);
      const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(audioDest(ctx));
      const duration = 0.28;
      const inst = instrumentRef.current;
      osc.type = inst === 0 ? 'sine' : inst === 1 ? 'triangle' : inst === 2 ? 'sawtooth' : 'square';
      gain.gain.setValueAtTime(0.12, when);
      gain.gain.exponentialRampToValueAtTime(0.01, when + duration);
      osc.frequency.setValueAtTime(freq, when);
      osc.start(when);
      osc.stop(when + duration);
    } catch {
      /* ignore */
    }
  };

  const patternColsRef = useRef(COLS);
  const patternBeatsRef = useRef(BARS * PIANO_ROLL_BEATS_PER_BAR);
  const loopOnDataRef = useRef(loopEnabled);
  const loopStartBeatDataRef = useRef(0);
  const loopEndBeatDataRef = useRef(0);
  patternColsRef.current = COLS;
  patternBeatsRef.current = BARS * PIANO_ROLL_BEATS_PER_BAR;
  loopOnDataRef.current = loopEnabled;
  loopStartBeatDataRef.current = (Math.max(1, loopStartBar) - 1) * PIANO_ROLL_BEATS_PER_BAR;
  loopEndBeatDataRef.current =
    loopStartBeatDataRef.current + Math.max(1, loopBars) * PIANO_ROLL_BEATS_PER_BAR;

  const transportDataRef = useRef<PianoRollTransportData>({
    patternColsRef,
    patternBeatsRef,
    drumModeRef,
    drumNotesRef,
    notesRef,
    drumKitSessionRef,
    loopOnRef: loopOnDataRef,
    loopStartBeatRef: loopStartBeatDataRef,
    loopEndBeatRef: loopEndBeatDataRef,
    playPianoAtRef,
  });

  const prTransport = usePianoRollSe2Transport({
    active: isScreenActive,
    bpm,
    bars: BARS,
    pxPer16th,
    loopEnabled,
    loopStartBar,
    loopBars,
    metronomeEnabled,
    getOrCreateAudioContext,
    stopMetronomeLoop,
    masterOutputLinear,
    data: transportDataRef.current,
    scrollRef,
    playheadElRef: playheadRef,
    keyW,
    autoScroll,
  });

  const {
    transport,
    isPlaying,
    active16Col,
    hudBeat,
    stop,
    togglePlay,
    primeAudio,
    returnToZero,
    nudgeBeats,
  } = prTransport;

  /** Always call latest handlers from footer (avoids stale closures). */
  const transportActionsRef = useRef({
    togglePlay,
    stop,
    returnToZero,
    nudgeBeats,
    primeAudio,
  });
  transportActionsRef.current = {
    togglePlay,
    stop,
    returnToZero,
    nudgeBeats,
    primeAudio,
  };
  const currentBar = Math.floor(hudBeat / PIANO_ROLL_BEATS_PER_BAR) + 1;
  const currentBeat = Math.floor(hudBeat % PIANO_ROLL_BEATS_PER_BAR) + 1;
  const active16 =
    isPlaying || transport === 'paused' ? active16Col : -1;

  const transportBtn =
    'flex items-center justify-center shrink-0 rounded-md border h-9 w-9 transition-colors';
  const onTransportPointerDown = () => transportActionsRef.current.primeAudio();

  const STEP_RAIL_W = 44;
  function StepTransportRail({ tall }: { tall: number }) {
    return (
      <div
        className="shrink-0 flex flex-col items-center gap-1.5 py-2 border-r"
        style={{
          width: STEP_RAIL_W,
          minHeight: tall,
          background: 'linear-gradient(180deg, #0a0a10 0%, #060608 100%)',
          borderColor: '#1a1a24',
        }}
      >
        <button
          type="button"
          title="Return to start"
          className={transportBtn}
          style={{ borderColor: '#2a2a32', color: '#b0b0bc', height: 32, width: 32 }}
          onPointerDown={onTransportPointerDown}
          onClick={() => transportActionsRef.current.returnToZero()}
        >
          <SkipBack size={14} />
        </button>
        <button
          type="button"
          title={isPlaying ? 'Pause' : 'Play'}
          className="flex items-center justify-center shrink-0 rounded-full border"
          style={{
            height: 36,
            width: 36,
            background: isPlaying ? '#152018' : '#13221c',
            borderColor: isPlaying ? '#2a4a38' : '#2d5a48',
            color: '#7cf4c6',
          }}
          onPointerDown={onTransportPointerDown}
          onClick={() => transportActionsRef.current.togglePlay()}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
        <button
          type="button"
          title="Stop"
          className={transportBtn}
          style={{ background: '#1a1214', borderColor: '#3a2828', color: '#e89898', height: 32, width: 32 }}
          onPointerDown={onTransportPointerDown}
          onClick={() => transportActionsRef.current.stop()}
        >
          <Square size={12} />
        </button>
        <button
          type="button"
          title="Metronome"
          onClick={() => setMetronomeEnabled(!metronomeEnabled)}
          className="rounded text-[9px] font-black font-mono"
          style={{
            width: 32,
            height: 22,
            background: metronomeEnabled ? 'rgba(124,244,198,0.14)' : '#242424',
            color: metronomeEnabled ? CB_PIANO_MINT : '#666',
            border: `1px solid ${metronomeEnabled ? CB_PIANO_MINT_BORDER : '#333'}`,
          }}
        >
          MET
        </button>
      </div>
    );
  }

  // Grid lines — mint on charcoal (matches Beat Lab / Groove Lab rolls)
  function colBorderStyle(ci: number): string {
    if (ci % PIANO_ROLL_STEPS_PER_BAR === 0) return `1px solid ${CB_PIANO_MINT_BORDER}`;
    if (ci % PIANO_ROLL_BEATS_PER_BAR === 0) return `1px solid ${CB_PIANO_MINT_BG}`;
    return '1px solid rgba(255,255,255,0.02)';
  }

  function cellBg(ci: number, isHead: boolean, isSelBar: boolean, isBlack = false): string {
    const base = isBlack ? '#18181e' : '#1e1e24';
    if (isHead) return 'rgba(124, 244, 198, 0.12)';
    if (isSelBar) return CB_PIANO_MINT_BG;
    return base;
  }

  const showBeatRulerLabels = pxPer16th >= 8;
  const beatRulerFontPx = Math.min(8, Math.max(5, Math.floor(pxPer16th * 0.85)));

  const RULER_H = 36;
  const rollMetrics: PianoRollMetrics = { rowH, labelW: keyW, rulerH: RULER_H };
  const loopEndBarMaster = loopStartBar + loopBars - 1;
  const rollVisLoopStart = Math.max(1, loopStartBar);
  const rollVisLoopEnd = Math.min(BARS, loopEndBarMaster);
  const rollLoopRegionOk = loopEnabled && rollVisLoopEnd >= rollVisLoopStart;
  const rollLoopBraceLeftPx = keyW + (rollVisLoopStart - 1) * barW;
  const rollLoopBraceWidthPx = (rollVisLoopEnd - rollVisLoopStart + 1) * barW;
  const rollLoopGridH = (drumMode ? PIANO_ROLL_DRUM_PADS : rows.length) * rowH;

  // Ruler: top row = bar numbers, bottom row = beat (quarter) 1–4 within each bar
  function RulerRows() {
    return (
      <>
        {/* Row 1: Bar numbers */}
        <div className="flex" style={{ height: 20, background: '#2c2c2c', borderBottom: `1px solid ${CB_PIANO_MINT_BORDER}` }}>
          <div style={{ width: keyW, flexShrink: 0, borderRight: `1px solid ${CB_PIANO_MINT_BORDER}`, background: '#18181e' }} />
          {Array.from({ length: BARS }, (_, bi) => {
            const barNum = bi + 1;
            const isActive = barNum === currentBar && isPlaying;
            const isSelected = selectedBar !== null && barNum === selectedBar;
            return (
              <div key={bi}
                onClick={() => setSelectedBar(isSelected ? null : barNum)}
                className="flex items-center pl-1 font-bold font-mono cursor-pointer"
                style={{
                  width: barW, flexShrink: 0, fontSize: Math.min(10, Math.max(7, barW * 0.12)),
                  color: isActive ? CB_PIANO_MINT : isSelected ? 'rgba(124,244,198,0.85)' : '#4a4a58',
                  background: isActive ? 'rgba(124, 244, 198, 0.14)' : isSelected ? CB_PIANO_MINT_BG : 'transparent',
                  borderLeft: `1px solid ${CB_PIANO_MINT_BORDER}`,
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  whiteSpace: 'nowrap',
                }}>
                {barNum}
              </div>
            );
          })}
        </div>
        {/* Row 2: Beats 1–4 (quarters) — clip so digits don’t smear when zoomed out */}
        <div className="flex" style={{ height: 16, background: 'rgba(8, 8, 12, 0.98)', borderBottom: `1px solid ${CB_PIANO_MINT_BG}` }}>
          <div style={{ width: keyW, flexShrink: 0, borderRight: `1px solid ${CB_PIANO_MINT_BORDER}`, background: '#18181e' }} />
          {Array.from({ length: COLS }, (_, ci) => {
            const stepInBar    = ci % PIANO_ROLL_STEPS_PER_BAR;
            const beatInBar1   = Math.floor(stepInBar / PIANO_ROLL_BEATS_PER_BAR) + 1;
            const barIdx       = Math.floor(ci / PIANO_ROLL_STEPS_PER_BAR);
            const barNum       = barIdx + 1;
            const isActive     = ci === active16 && (isPlaying || transport === 'paused');
            const isSelected   = selectedBar !== null && barNum === selectedBar;

            return (
              <div key={ci}
                className="flex items-center justify-center"
                style={{
                  width: pxPer16th, flexShrink: 0, height: 16, minWidth: 0,
                  borderLeft: colBorderStyle(ci),
                  background: isActive ? 'rgba(124, 244, 198, 0.18)' : isSelected ? CB_PIANO_MINT_BG : stepInBar % PIANO_ROLL_BEATS_PER_BAR === 0 ? '#101018' : '#2c2c2c',
                  fontSize: beatRulerFontPx, fontFamily: 'monospace',
                  color: isActive ? CB_PIANO_MINT : '#4a4a58',
                  fontWeight: 'bold',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  lineHeight: 1,
                }}>
                {showBeatRulerLabels && stepInBar % PIANO_ROLL_BEATS_PER_BAR === 0 ? beatInBar1 : ''}
              </div>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full min-h-0 overflow-hidden"
      style={{ background: '#2a2a2a', color: '#ccc' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0 flex-wrap gap-2"
        style={{ borderBottom: '1px solid #2c2c2c', background: '#2c2c2c' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#00E5FF22', color: '#00E5FF' }}><Piano size={16} /></div>
          <h2 className="text-sm font-bold" style={{ color: '#fff' }}>Piano Roll</h2>
          <span className="text-xs font-mono px-3 py-1 rounded font-bold"
            style={{ background: '#000', border: '1px solid #2a2a2a', color: '#ffcc00' }}>
            ⚡ {bpm} BPM
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded"
            style={{ background: '#000', border: '1px solid #2c2c2c', color: '#555' }}
            title="SE2 audio clock — BAR/BEAT from transport">
            BAR {currentBar} · BEAT {currentBeat}/4
          </span>
          <span data-piano-roll-bars-readout className="text-xs font-mono px-2 py-0.5 rounded"
            style={{ background: '#000', border: '1px solid #2c2c2c', color: CB_PIANO_MINT }}>
            1.1.000
          </span>
          <span data-piano-roll-time-readout className="text-xs font-mono px-2 py-0.5 rounded"
            style={{ background: '#000', border: '1px solid #2c2c2c', color: '#888' }}>
            00:00.00
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded font-bold"
            style={{
              background: isPlaying ? 'rgba(124,244,198,0.2)' : '#00ff8812',
              color: isPlaying ? CB_PIANO_MINT : '#00ff8888',
              border: `1px solid ${isPlaying ? CB_PIANO_MINT_BORDER : '#00ff8822'}`,
              fontSize: 8,
            }}>
            {isPlaying ? '▶ PLAYING' : transport === 'paused' ? '⏸ PAUSED' : 'SE2 TRANSPORT · 1/16'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setAutoScroll(v => !v)} className="px-2 py-1 rounded text-xs font-bold"
            style={{ background: autoScroll ? '#00ff8818' : '#242424', color: autoScroll ? '#00ff88' : '#555', border: `1px solid ${autoScroll ? '#00ff8844' : '#333'}` }}>
            ↔ Scroll
          </button>
          <button onClick={handleFit} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
            style={{ background: '#2c2c2c', color: '#ffcc00', border: '1px solid #ffcc0044' }}>
            <Maximize2 size={10} /> Fit (F)
          </button>
          {/* Total bars */}
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{ color: '#555' }}>BARS</span>
            {[4, 8, 16, 32, 64, 128].map(n => (
              <button key={n} onClick={() => setTotalDisplayBars(n)} className="w-7 h-6 rounded text-xs font-bold"
                style={{ background: BARS === n ? '#D500F922' : '#242424', color: BARS === n ? '#D500F9' : '#444', border: `1px solid ${BARS === n ? '#D500F944' : '#222'}` }}>
                {n}
              </button>
            ))}
          </div>
          <div className="w-px h-5" style={{ background: '#2a2a2a' }} />
          {/* H zoom */}
          <span className="text-xs" style={{ color: '#555' }}>H</span>
          <button onClick={() => setGlobalZoom(Math.max(0.1, +(zoom - 0.1).toFixed(2)))} className="w-6 h-6 flex items-center justify-center rounded" style={{ background: '#2c2c2c', color: '#666' }}><ZoomOut size={11} /></button>
          <span className="text-xs font-mono w-8 text-center" style={{ color: '#00E5FF' }}>{zoom.toFixed(1)}x</span>
          <button onClick={() => setGlobalZoom(Math.min(4, +(zoom + 0.1).toFixed(2)))} className="w-6 h-6 flex items-center justify-center rounded" style={{ background: '#2c2c2c', color: '#666' }}><ZoomIn size={11} /></button>
          {/* V zoom */}
          <span className="text-xs" style={{ color: '#555' }}>V</span>
          <button onClick={() => setGlobalVZoom(Math.max(1, +(globalVZoom - 0.5).toFixed(1)))} className="w-6 h-6 flex items-center justify-center rounded" style={{ background: '#2c2c2c', color: '#666' }}><ZoomOut size={11} /></button>
          <span className="text-xs font-mono w-7 text-center" style={{ color: '#D500F9' }}>{globalVZoom.toFixed(1)}x</span>
          <button onClick={() => setGlobalVZoom(Math.min(8, +(globalVZoom + 0.5).toFixed(1)))} className="w-6 h-6 flex items-center justify-center rounded" style={{ background: '#2c2c2c', color: '#666' }}><ZoomIn size={11} /></button>
          <div className="w-px h-5 mx-1" style={{ background: '#2a2a2a' }} />
          <button onClick={() => onExport('studio-editor')} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold" style={{ background: '#1a1a2a', color: '#00E5FF', border: '1px solid #00E5FF44' }}><Send size={10} /> Studio</button>
          <button onClick={() => onExport('master-arranger')} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold" style={{ background: '#2c2c2c', color: '#D500F9', border: '1px solid #D500F944' }}><Send size={10} /> Arrange</button>
        </div>
      </div>

      {/* ── Mode toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-1.5 shrink-0 flex-wrap" style={{ borderBottom: '1px solid #2c2c2c', background: '#2c2c2c' }}>
        <button onClick={() => setDrumMode(false)} className="px-3 py-1 rounded text-xs font-bold"
          style={{ background: !drumMode ? color : '#242424', color: !drumMode ? '#000' : '#666', border: `1px solid ${!drumMode ? color : '#333'}` }}>
          🎵 Notes
        </button>
        <button onClick={() => setDrumMode(true)} className="px-3 py-1 rounded text-xs font-bold"
          style={{ background: drumMode ? '#D500F9' : '#242424', color: drumMode ? '#000' : '#666', border: `1px solid ${drumMode ? '#D500F9' : '#333'}` }}>
          🥁 Drums
        </button>
        <div className="w-px h-5 mx-1" style={{ background: '#2a2a2a' }} />
        {!drumMode && INSTRUMENTS.map((ins, i) => (
          <button key={ins} onClick={() => setInstrument(i)} className="px-2 py-1 rounded text-xs font-bold"
            style={{ background: instrument === i ? `${INST_COLORS[i]}22` : '#242424', color: instrument === i ? INST_COLORS[i] : '#555', border: `1px solid ${instrument === i ? INST_COLORS[i] : '#333'}` }}>
            {ins}
          </button>
        ))}
        {drumMode && (
          <>
            <div className="w-px h-5 mx-1" style={{ background: '#2a2a2a' }} />
            {(['Trap', 'R&B'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setDrumCategory(cat);
                  const list = cat === 'Trap' ? PIANO_ROLL_TRAP_PRESETS : PIANO_ROLL_RNB_PRESETS;
                  const first = list[0];
                  if (first) loadDrumPreset(first);
                }}
                className="px-2 py-1 rounded text-xs font-bold"
                style={{
                  background: drumCategory === cat ? '#D500F922' : '#242424',
                  color: drumCategory === cat ? '#D500F9' : '#666',
                  border: `1px solid ${drumCategory === cat ? '#D500F944' : '#333'}`,
                }}
              >
                {cat}
              </button>
            ))}
            <select
              value={drumPresetId}
              onChange={(e) => {
                const preset = pianoRollDrumPresetById(e.target.value);
                if (preset) loadDrumPreset(preset);
              }}
              className="max-w-[220px] h-7 rounded px-2 text-xs font-bold truncate"
              style={{ background: '#242424', border: '1px solid #333', color: '#eee' }}
              title={activeDrumPreset.desc ?? activeDrumPreset.name}
            >
              {drumBankPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: kitLoading ? '#ffcc0018' : '#00ff8818', color: kitLoading ? '#ffcc00' : '#00ff88', border: '1px solid #333' }}>
              {kitLoading ? 'Loading kit…' : `16-pad · ${PIANO_ROLL_DRUM_CATALOG.length} presets`}
            </span>
          </>
        )}
        <span className="ml-auto font-mono" style={{ color: '#2a2a2a', fontSize: 9 }}>
          {pxPer16th}px/16th · {barW}px/bar · {BARS} bars · SE2 playhead
        </span>
      </div>

      {/* Loop region: drives transport loop + brace for this screen (saved in Piano Roll profile). */}
      <div
        className="flex items-center gap-2 px-4 py-1.5 shrink-0 flex-wrap"
        style={{
          borderBottom: '1px solid #2c2c2c',
          background: 'rgba(0,0,0,0.30)',
        }}
      >
        <Repeat size={12} style={{ color: loopEnabled ? CB_PIANO_MINT : '#555', flexShrink: 0 }} aria-hidden />
        <button
          type="button"
          onClick={() => (loopEnabled ? clearLoop() : setLoopEnabled(true))}
          className="px-2 py-1 rounded text-xs font-black font-mono"
          style={{
            background: loopEnabled ? CB_PIANO_MINT_BG : '#242424',
            color: loopEnabled ? CB_PIANO_MINT : '#888',
            border: `1px solid ${loopEnabled ? CB_PIANO_MINT_BORDER_STRONG : '#333'}`,
          }}
          title="Enable or disable looping for Piano Roll (same as title bar when you are on this screen)"
        >
          LOOP
        </button>
        <span className="text-[10px] font-mono shrink-0" style={{ color: '#666' }}>
          from bar
        </span>
        <input
          type="number"
          min={1}
          max={BARS}
          value={loopStartBar}
          onChange={(e) => {
            const s = Math.max(1, Math.min(BARS, Math.round(Number(e.target.value)) || 1));
            setLoopRange(s, Math.min(BARS, s + loopBars - 1), loopSection ?? undefined);
          }}
          className="w-11 h-6 rounded px-1 text-center font-mono text-xs shrink-0"
          style={{ background: '#242424', border: '1px solid #333', color: '#eee' }}
          title="Loop start bar"
        />
        <span className="text-[10px] font-mono shrink-0" style={{ color: '#666' }}>
          length
        </span>
        <select
          value={loopBars}
          onChange={(e) => {
            const n = Math.max(1, Math.min(BARS, Number(e.target.value)));
            setLoopRange(loopStartBar, Math.min(BARS, loopStartBar + n - 1), loopSection ?? undefined);
          }}
          className="h-6 px-1.5 rounded text-xs font-bold font-mono shrink-0"
          style={{
            background: '#242424',
            color: loopEnabled ? CB_PIANO_MINT : '#888',
            border: `1px solid ${loopEnabled ? CB_PIANO_MINT_BORDER : '#333'}`,
          }}
          title="Loop length in bars"
        >
          {loopLengthOptions.map((n) => (
            <option key={n} value={n}>
              {n} bars
            </option>
          ))}
        </select>
        <span className="text-[9px] font-mono" style={{ color: '#5a6570' }}>
          Ruler brace + vertical lines = loop; transport follows when LOOP is on.
        </span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <ResizablePanel height={pianoHeight} minH={120} maxH={900} defaultH={0} onResize={setPianoHeight}
        style={{ flex: '1 1 0%', minHeight: 0, maxHeight: pianoHeight > 0 ? pianoHeight : undefined }}>
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {drumMode && <StepTransportRail tall={RULER_H + rollLoopGridH} />}
          <div ref={scrollRef} className="flex-1 overflow-auto min-h-0" style={{ position: 'relative' }}>
          <div className="flex flex-col" style={{ minWidth: keyW + pxPer16th * COLS }}>
            <div className="sticky top-0 z-20" style={{ width: keyW + pxPer16th * COLS, position: 'relative' }}>
              <RulerRows />
              <LoopMarkersBrace
                visible={rollLoopRegionOk}
                leftPx={rollLoopBraceLeftPx}
                widthPx={rollLoopBraceWidthPx}
                height={RULER_H}
                variant="dark"
                zIndex={25}
              />
            </div>
            <div style={{ position: 'relative', background: '#2a2a2a', minHeight: rollLoopGridH }}>
              <PianoRollPlayheadMount ref={playheadRef} keyW={keyW} />
              {drumMode ? (
                Array.from({ length: PIANO_ROLL_DRUM_PADS }, (_, ri) => {
                  const padColor = DRUM_COLORS[ri % DRUM_COLORS.length]!;
                  const name = drumRowLabels[ri] ?? `Pad ${ri + 1}`;
                  return (
                  <div key={ri} className="flex" style={{ borderBottom: '1px solid #101014', height: rowH }}>
                    <button
                      type="button"
                      onClick={() => playDrumRow(ri)}
                      className="flex items-center justify-end pr-2 font-medium shrink-0"
                      style={{
                        width: keyW,
                        color: padColor,
                        background: `color-mix(in srgb, ${padColor} 12%, #0a0a0e)`,
                        borderRight: `2px solid color-mix(in srgb, ${padColor} 55%, #1a1a24)`,
                        fontSize: 8,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}>
                      {name}
                    </button>
                    {Array.from({ length: COLS }, (_, ci) => {
                      const on     = drumNotes.some(n => n.row === ri && n.col === ci);
                      const isHead = ci === active16;
                      const barIdx = Math.floor(ci / PIANO_ROLL_STEPS_PER_BAR);
                      const isSelBar = selectedBar !== null && (barIdx + 1) === selectedBar;
                      return (
                        <button key={ci} onClick={() => { toggleDrum(ri, ci); playDrumRow(ri); }}
                          style={{
                            width: pxPer16th, height: '100%', flexShrink: 0,
                            background: on ? padColor : cellBg(ci, isHead, isSelBar),
                            borderLeft: colBorderStyle(ci),
                            boxShadow: on && isHead ? `0 0 8px ${padColor}` : 'none',
                          }} />
                      );
                    })}
                  </div>
                );})
              ) : (
                rows.map((row, ri) => {
                  const midi = noteNameToMidi(row.label);
                  return (
                  <div key={ri} className="flex" style={{ borderBottom: row.isBlack ? '1px solid rgba(255,255,255,0.02)' : '1px solid rgba(124,244,198,0.06)', height: rowH }}>
                    <button
                      type="button"
                      onPointerDown={() => setPressedKeyRow(ri)}
                      onPointerUp={() => setPressedKeyRow((v) => (v === ri ? null : v))}
                      onPointerLeave={() => setPressedKeyRow((v) => (v === ri ? null : v))}
                      onClick={() => playPianoRow(ri, 0.35)}
                      style={{
                        ...cbPianoKeyCellStyle(rollMetrics),
                        width: keyW,
                        height: rowH,
                        transform: pressedKeyRow === ri ? 'translateX(2px) scaleX(0.98)' : 'translateX(0) scaleX(1)',
                        transition: 'transform 0.06s ease',
                      }}
                    >
                      <span style={cbPianoKeyFaceStyle(midi, pressedKeyRow === ri, rollMetrics)}>
                        {cbPianoKeyLabel(midi)}
                      </span>
                    </button>
                    {Array.from({ length: COLS }, (_, ci) => {
                      const on     = notes.some(n => n.row === ri && n.col === ci);
                      const isHead = ci === active16;
                      const barIdx = Math.floor(ci / PIANO_ROLL_STEPS_PER_BAR);
                      const isSelBar = selectedBar !== null && (barIdx + 1) === selectedBar;
                      return (
                        <button key={ci} onClick={() => toggleNote(ri, ci)}
                          style={{
                            width: pxPer16th, height: '100%', flexShrink: 0,
                            background: cellBg(ci, isHead, isSelBar, row.isBlack),
                            borderLeft: colBorderStyle(ci),
                            boxShadow: on && isHead ? `0 0 6px ${color}` : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderBottom: '1px solid #000',
                          }}>
                          {on && (
                            <div
                              style={{
                                width: Math.max(6, Math.floor(pxPer16th * 0.72)),
                                height: Math.max(8, Math.floor(rowH * 0.68)),
                                borderRadius: 3,
                                border: '2px solid #16a34a',
                                ...cbPianoManualNoteBodyStyle(),
                              }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
                })
              )}
              <LoopVerticalGuides
                visible={rollLoopRegionOk}
                leftPx={rollLoopBraceLeftPx}
                widthPx={rollLoopBraceWidthPx}
                height={rollLoopGridH}
                topPx={0}
                zIndex={15}
              />
            </div>
          </div>
          </div>
        </div>
      </ResizablePanel>
      </div>

      {/* Standalone transport — Piano Roll only (not master TitleBar). */}
      <footer
        data-piano-roll-transport-footer
        className="shrink-0 border-t flex flex-wrap items-center gap-3 px-3 py-2"
        style={{
          borderColor: '#12121a',
          background: 'linear-gradient(180deg, #1e1e24 0%, #18181e 100%)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.45)',
          pointerEvents: 'auto',
          position: 'relative',
          zIndex: 60,
        }}
      >
        <span
          className="text-[10px] font-mono font-bold uppercase tracking-wide shrink-0"
          style={{ color: isPlaying ? CB_PIANO_MINT : transport === 'paused' ? '#ffcc00' : '#666' }}
        >
          {isPlaying ? 'Playing' : transport === 'paused' ? 'Paused' : 'Stopped'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            title="Return to start"
            className={transportBtn}
            style={{ borderColor: '#2a2a32', color: '#b0b0bc' }}
            onPointerDown={onTransportPointerDown}
            onClick={() => transportActionsRef.current.returnToZero()}
          >
            <SkipBack size={16} />
          </button>
          <button
            type="button"
            title="Rewind one bar"
            disabled={isPlaying}
            className={transportBtn}
            style={{
              borderColor: '#2a2a32',
              color: '#b0b0bc',
              opacity: isPlaying ? 0.4 : 1,
            }}
            onPointerDown={onTransportPointerDown}
            onClick={() => transportActionsRef.current.nudgeBeats(-PIANO_ROLL_BEATS_PER_BAR)}
          >
            <Rewind size={16} />
          </button>
          <button
            type="button"
            title={isPlaying ? 'Pause' : 'Play'}
            className="flex items-center justify-center shrink-0 rounded-full border h-10 w-10"
            style={{
              background: isPlaying ? '#152018' : '#13221c',
              borderColor: isPlaying ? '#2a4a38' : '#2d5a48',
              color: '#7cf4c6',
            }}
            onPointerDown={onTransportPointerDown}
            onClick={() => transportActionsRef.current.togglePlay()}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>
          <button
            type="button"
            title="Stop"
            className={transportBtn}
            style={{ background: '#1a1214', borderColor: '#3a2828', color: '#e89898' }}
            onPointerDown={onTransportPointerDown}
            onClick={() => transportActionsRef.current.stop()}
          >
            <Square size={14} />
          </button>
          <button
            type="button"
            title="Fast-forward one bar"
            disabled={isPlaying}
            className={transportBtn}
            style={{
              borderColor: '#2a2a32',
              color: '#b0b0bc',
              opacity: isPlaying ? 0.4 : 1,
            }}
            onPointerDown={onTransportPointerDown}
            onClick={() => transportActionsRef.current.nudgeBeats(PIANO_ROLL_BEATS_PER_BAR)}
          >
            <FastForward size={16} />
          </button>
        </div>

        <button
          type="button"
          title="Metronome"
          onClick={() => setMetronomeEnabled(!metronomeEnabled)}
          className="px-2.5 py-1 rounded text-xs font-black font-mono shrink-0"
          style={{
            background: metronomeEnabled ? 'rgba(124,244,198,0.14)' : '#242424',
            color: metronomeEnabled ? CB_PIANO_MINT : '#666',
            border: `1px solid ${metronomeEnabled ? CB_PIANO_MINT_BORDER : '#333'}`,
          }}
        >
          MET
        </button>

        <span className="text-[10px] font-mono" style={{ color: '#5a6570' }}>
          Space = play/pause · S = stop · Drums mode: load a preset then play
        </span>
      </footer>
    </div>
  );
}
