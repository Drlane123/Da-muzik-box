import { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from 'react';

import { Piano, Send, ZoomIn, ZoomOut, Maximize2, Repeat } from 'lucide-react';

import { useMasterClock, STEPS_PER_BAR, LOOP_BAR_OPTIONS } from '@/app/context/MasterClockContext';

import { useView } from '@/app/context/ViewContext';

import { usePianoNotes } from '@/app/context/PianoNotesContext';

import ResizablePanel from '@/app/components/ResizablePanel';
import LoopMarkersBrace, { LoopVerticalGuides } from '@/app/components/LoopMarkersBrace';


const OCTAVES = [5, 4, 3, 2];

const NOTE_LABELS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const IS_BLACK    = [false,true,false,true,false,false,true,false,true,false,true,false];

const INSTRUMENTS = ['Piano','Synth','Bass','Lead','Pad','Keys'];

const INST_COLORS = ['#00E5FF','#D500F9','#00ff88','#ff6b35','#a78bfa','#ffcc00'];

const DRUM_ROWS   = ['Kick','Snare','Clap','Hi-Hat','Open HH','Tom Hi','Tom Lo','Rim'];

const DRUM_COLORS = ['#D500F9','#00E5FF','#ff6b35','#00ff88','#ffcc00','#a78bfa','#f472b6','#60a5fa'];


type Note = { row: number; col: number }; // col = 1/16th step index

type PlayVoice = { osc: OscillatorNode; gain: GainNode };


const PIANO_KEY_W = 52;

const DRUM_KEY_W  = 84;

const BASE_ROW_H  = 18;


// How many 1/16th steps per display column at each zoom level

// At default zoom: 1 col = 1 beat = 4 sixteenth notes

// We always render at 1 col = 1/16th note internally, but group visually


export default function PianoRollScreen({ onExport }: { onExport: (dest: string) => void }) {
  const clock = useMasterClock();
  const {
    globalZoom, setGlobalZoom, globalVZoom, setGlobalVZoom,
    pianoHeight, setPianoHeight, selectedBar, setSelectedBar,
    totalDisplayBars, setTotalDisplayBars, fitBarsToWidth,
  } = useView();
  const { notes, addNote, removeNote } = usePianoNotes();

  const [instrument, setInstrument] = useState(0);
  const [drumMode, setDrumMode]     = useState(false);
  const [drumNotes, setDrumNotes]   = useState<Note[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [pressedKeyRow, setPressedKeyRow] = useState<number | null>(null);

  const zoom   = Math.max(0.1, Math.min(4, globalZoom));
  // colW = width of ONE measure in pixels (4 measures per bar)
  const colW16 = Math.max(6, Math.round(20 * zoom)); // larger default grid cell width
  const BARS   = Math.max(4, Math.min(128, totalDisplayBars));
  const COLS   = BARS * STEPS_PER_BAR; // total measure columns
  const beatW  = colW16;               // 1 measure = 1 column
  const barW   = colW16 * STEPS_PER_BAR; // width of one bar (4 measures)
  const rowH   = Math.round(BASE_ROW_H * Math.max(1, Math.min(4, globalVZoom)));
  const keyW   = drumMode ? DRUM_KEY_W : PIANO_KEY_W;
  const color  = INST_COLORS[instrument];
  const pianoTransportBeatUi = useSyncExternalStore(
    clock.subscribeTransportBeatUi,
    clock.getTransportBeatUiSnapshot,
    clock.getTransportBeatUiSnapshot,
  );
  const pianoQuarter = pianoTransportBeatUi.wrappedQuarter;
  const currentBar = Math.floor(pianoQuarter / STEPS_PER_BAR) + 1;
  const currentTick =
    ((pianoQuarter % STEPS_PER_BAR) + STEPS_PER_BAR) % STEPS_PER_BAR;
  const currentBeat = currentTick + 1;

  // Current 1/16th column index (absolute) — bar offset + tick within bar
  const active16 = (clock.transport === 'playing' || clock.transport === 'recording')
    ? (currentBar - 1) * STEPS_PER_BAR + currentTick
    : -1;

  const scrollRef    = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isRunning    = clock.transport === 'playing' || clock.transport === 'recording';
  const totalW       = COLS * colW16;
  const wrappedQuarter = ((pianoQuarter % COLS) + COLS) % COLS;
  const playheadX    = isRunning ? keyW + wrappedQuarter * colW16 : -4;

  const prevXRef = useRef(playheadX);
  const playingOscsRef = useRef<Map<string, PlayVoice>>(new Map());
  useEffect(() => {
    if (!autoScroll || !isRunning || !scrollRef.current) return;
    if (Math.abs(playheadX - prevXRef.current) > 0) {
      scrollRef.current.scrollLeft = Math.max(0, playheadX - scrollRef.current.clientWidth / 3);
    }
    prevXRef.current = playheadX;
  }, [playheadX, autoScroll, isRunning]);

  // Center on selectedBar
  useEffect(() => {
    if (selectedBar === null || !scrollRef.current) return;
    scrollRef.current.scrollLeft = Math.max(0, (selectedBar - 1) * barW - 120);
  }, [selectedBar, barW]);

  // Fit to window (F key)
  const handleFit = useCallback(() => {
    const w = containerRef.current?.clientWidth ?? window.innerWidth;
    // target: all bars fit → colW16 = (w - keyW) / (BARS * STEPS_PER_BAR)
    const targetCol16 = Math.max(2, Math.floor((w - keyW) / (BARS * STEPS_PER_BAR)));
    const newZoom = targetCol16 / 16;
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
    transport,
    loopEnabled,
    loopStartBar,
    loopBars,
    loopSection,
    setLoopEnabled,
    clearLoop,
    setLoopRange,
    getOrCreateAudioContext,
  } = clock;

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
    if (notes.some(n => n.row === row && n.col === col)) {
      removeNote(row, col);
    } else {
      addNote(row, col);
    }
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

  const playPianoRow = useCallback((rowIndex: number, duration = 0.35) => {
    try {
      const row = rows[rowIndex];
      if (!row) return;
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime;
      const midiNote = noteNameToMidi(row.label);
      const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
      const key = `${midiNote}`;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      switch (instrument) {
        case 0:
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.02, now + duration);
          break;
        case 1:
          osc.type = 'triangle';
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
          break;
        case 2:
          osc.type = 'sawtooth';
          gain.gain.setValueAtTime(0.14, now);
          gain.gain.exponentialRampToValueAtTime(0.02, now + duration);
          break;
        default:
          osc.type = 'square';
          gain.gain.setValueAtTime(0.10, now);
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
  }, [rows, getOrCreateAudioContext, instrument]);

  // Grid line style at a given column index (ci = measure index)
  function colBorderStyle(ci: number): string {
    if (ci % STEPS_PER_BAR === 0) return '2px solid #6b8392';  // bar line
    return '1px solid #3f5563';                                // step line
  }

  // Cell bg color
  function cellBg(ci: number, isHead: boolean, isSelBar: boolean, isBlack = false): string {
    if (isHead) return '#163246';
    if (isSelBar) return 'rgba(0,255,136,0.05)';
    if (ci % STEPS_PER_BAR === 0) return isBlack ? '#11293a' : '#0f2434';
    return isBlack ? '#091a25' : '#0b1f2b';
  }

  const showBeatRulerLabels = colW16 >= 10;
  const beatRulerFontPx = Math.min(8, Math.max(5, Math.floor(colW16 * 0.85)));

  const RULER_H = 36;
  const loopEndBarMaster = loopStartBar + loopBars - 1;
  const rollVisLoopStart = Math.max(1, loopStartBar);
  const rollVisLoopEnd = Math.min(BARS, loopEndBarMaster);
  const rollLoopRegionOk = loopEnabled && rollVisLoopEnd >= rollVisLoopStart;
  const rollLoopBraceLeftPx = keyW + (rollVisLoopStart - 1) * barW;
  const rollLoopBraceWidthPx = (rollVisLoopEnd - rollVisLoopStart + 1) * barW;
  const rollLoopGridH = (drumMode ? DRUM_ROWS.length : rows.length) * rowH;

  // Ruler: top row = bar numbers, bottom row = beat (quarter) 1–4 within each bar
  function RulerRows() {
    return (
      <>
        {/* Row 1: Bar numbers */}
        <div className="flex" style={{ height: 20, background: '#0d0d0d', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ width: keyW, flexShrink: 0, borderRight: '1px solid #1e1e1e' }} />
          {Array.from({ length: BARS }, (_, bi) => {
            const barNum = bi + 1;
            const isActive = barNum === currentBar && (transport === 'playing' || transport === 'recording');
            const isSelected = selectedBar !== null && barNum === selectedBar;
            return (
              <div key={bi}
                onClick={() => setSelectedBar(isSelected ? null : barNum)}
                className="flex items-center pl-1 font-bold font-mono cursor-pointer"
                style={{
                  width: barW, flexShrink: 0, fontSize: Math.min(10, Math.max(7, barW * 0.12)),
                  color: isActive ? '#D500F9' : isSelected ? '#00ff88' : '#555',
                  background: isActive ? 'rgba(213,0,249,0.1)' : isSelected ? 'rgba(0,255,136,0.08)' : 'transparent',
                  borderLeft: '2px solid #333',
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
        <div className="flex" style={{ height: 16, background: '#0a0a0a', borderBottom: '1px solid #222' }}>
          <div style={{ width: keyW, flexShrink: 0, borderRight: '1px solid #1e1e1e' }} />
          {Array.from({ length: COLS }, (_, ci) => {
            const stepInBar    = ci % STEPS_PER_BAR;
            const beatInBar1   = stepInBar + 1; // 1–4
            const barIdx       = Math.floor(ci / STEPS_PER_BAR);
            const barNum       = barIdx + 1;
            const isActive     = ci === active16 && (transport === 'playing' || transport === 'recording');
            const isSelected   = selectedBar !== null && barNum === selectedBar;

            return (
              <div key={ci}
                className="flex items-center justify-center"
                style={{
                  width: colW16, flexShrink: 0, height: 16, minWidth: 0,
                  borderLeft: colBorderStyle(ci),
                  background: isActive ? 'rgba(255,255,255,0.12)' : isSelected ? 'rgba(0,255,136,0.05)' : 'transparent',
                  fontSize: beatRulerFontPx, fontFamily: 'monospace',
                  color: isActive ? '#fff' : '#555',
                  fontWeight: 'bold',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  lineHeight: 1,
                }}>
                {showBeatRulerLabels ? beatInBar1 : ''}
              </div>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full" style={{ background: '#050505', color: '#ccc' }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0 flex-wrap gap-2"
        style={{ borderBottom: '1px solid #1a1a1a', background: '#080808' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#00E5FF22', color: '#00E5FF' }}><Piano size={16} /></div>
          <h2 className="text-sm font-bold" style={{ color: '#fff' }}>Piano Roll</h2>
          <span className="text-xs font-mono px-3 py-1 rounded font-bold"
            style={{ background: '#000', border: '1px solid #2a2a2a', color: '#ffcc00' }}>
            ⚡ {bpm} BPM
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded"
            style={{ background: '#000', border: '1px solid #1a1a1a', color: '#555' }}
            title="Bar = song position; Beat = quarter (1–4) within the current bar">
            BAR {currentBar} · BEAT {currentBeat}/4
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded font-bold"
            style={{ background: '#00ff8812', color: '#00ff8888', border: '1px solid #00ff8822', fontSize: 8 }}>
            MTC SLAVE · 1/16Q
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setAutoScroll(v => !v)} className="px-2 py-1 rounded text-xs font-bold"
            style={{ background: autoScroll ? '#00ff8818' : '#111', color: autoScroll ? '#00ff88' : '#555', border: `1px solid ${autoScroll ? '#00ff8844' : '#333'}` }}>
            ↔ Scroll
          </button>
          <button onClick={handleFit} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
            style={{ background: '#1a1a1a', color: '#ffcc00', border: '1px solid #ffcc0044' }}>
            <Maximize2 size={10} /> Fit (F)
          </button>
          {/* Total bars */}
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{ color: '#555' }}>BARS</span>
            {[4, 8, 16, 32, 64, 128].map(n => (
              <button key={n} onClick={() => setTotalDisplayBars(n)} className="w-7 h-6 rounded text-xs font-bold"
                style={{ background: BARS === n ? '#D500F922' : '#111', color: BARS === n ? '#D500F9' : '#444', border: `1px solid ${BARS === n ? '#D500F944' : '#222'}` }}>
                {n}
              </button>
            ))}
          </div>
          <div className="w-px h-5" style={{ background: '#2a2a2a' }} />
          {/* H zoom */}
          <span className="text-xs" style={{ color: '#555' }}>H</span>
          <button onClick={() => setGlobalZoom(Math.max(0.1, +(zoom - 0.1).toFixed(2)))} className="w-6 h-6 flex items-center justify-center rounded" style={{ background: '#1a1a1a', color: '#666' }}><ZoomOut size={11} /></button>
          <span className="text-xs font-mono w-8 text-center" style={{ color: '#00E5FF' }}>{zoom.toFixed(1)}x</span>
          <button onClick={() => setGlobalZoom(Math.min(4, +(zoom + 0.1).toFixed(2)))} className="w-6 h-6 flex items-center justify-center rounded" style={{ background: '#1a1a1a', color: '#666' }}><ZoomIn size={11} /></button>
          {/* V zoom */}
          <span className="text-xs" style={{ color: '#555' }}>V</span>
          <button onClick={() => setGlobalVZoom(Math.max(1, +(globalVZoom - 0.5).toFixed(1)))} className="w-6 h-6 flex items-center justify-center rounded" style={{ background: '#1a1a1a', color: '#666' }}><ZoomOut size={11} /></button>
          <span className="text-xs font-mono w-7 text-center" style={{ color: '#D500F9' }}>{globalVZoom.toFixed(1)}x</span>
          <button onClick={() => setGlobalVZoom(Math.min(8, +(globalVZoom + 0.5).toFixed(1)))} className="w-6 h-6 flex items-center justify-center rounded" style={{ background: '#1a1a1a', color: '#666' }}><ZoomIn size={11} /></button>
          <div className="w-px h-5 mx-1" style={{ background: '#2a2a2a' }} />
          <button onClick={() => onExport('studio-editor')} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold" style={{ background: '#1a1a2a', color: '#00E5FF', border: '1px solid #00E5FF44' }}><Send size={10} /> Studio</button>
          <button onClick={() => onExport('master-arranger')} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold" style={{ background: '#1a1a1a', color: '#D500F9', border: '1px solid #D500F944' }}><Send size={10} /> Arrange</button>
        </div>
      </div>

      {/* ── Mode toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-1.5 shrink-0 flex-wrap" style={{ borderBottom: '1px solid #1a1a1a', background: '#080808' }}>
        <button onClick={() => setDrumMode(false)} className="px-3 py-1 rounded text-xs font-bold"
          style={{ background: !drumMode ? color : '#111', color: !drumMode ? '#000' : '#666', border: `1px solid ${!drumMode ? color : '#333'}` }}>
          🎵 Notes
        </button>
        <button onClick={() => setDrumMode(true)} className="px-3 py-1 rounded text-xs font-bold"
          style={{ background: drumMode ? '#D500F9' : '#111', color: drumMode ? '#000' : '#666', border: `1px solid ${drumMode ? '#D500F9' : '#333'}` }}>
          🥁 Drums
        </button>
        <div className="w-px h-5 mx-1" style={{ background: '#2a2a2a' }} />
        {!drumMode && INSTRUMENTS.map((ins, i) => (
          <button key={ins} onClick={() => setInstrument(i)} className="px-2 py-1 rounded text-xs font-bold"
            style={{ background: instrument === i ? `${INST_COLORS[i]}22` : '#111', color: instrument === i ? INST_COLORS[i] : '#555', border: `1px solid ${instrument === i ? INST_COLORS[i] : '#333'}` }}>
            {ins}
          </button>
        ))}
        <span className="ml-auto font-mono" style={{ color: '#2a2a2a', fontSize: 9 }}>
          {colW16}px/16th · {barW}px/bar · {BARS} bars · 1/16 grid
        </span>
      </div>

      {/* Loop region: drives transport loop + brace for this screen (saved in Piano Roll profile). */}
      <div
        className="flex items-center gap-2 px-4 py-1.5 shrink-0 flex-wrap"
        style={{
          borderBottom: '1px solid #1a1a1a',
          background: 'linear-gradient(90deg, rgba(213,0,249,0.08) 0%, rgba(0,229,255,0.04) 40%, transparent 100%)',
        }}
      >
        <Repeat size={12} style={{ color: loopEnabled ? '#D500F9' : '#555', flexShrink: 0 }} aria-hidden />
        <button
          type="button"
          onClick={() => (loopEnabled ? clearLoop() : setLoopEnabled(true))}
          className="px-2 py-1 rounded text-xs font-black font-mono"
          style={{
            background: loopEnabled ? '#D500F928' : '#111',
            color: loopEnabled ? '#D500F9' : '#888',
            border: `1px solid ${loopEnabled ? '#D500F988' : '#333'}`,
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
          style={{ background: '#111', border: '1px solid #333', color: '#eee' }}
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
            background: '#111',
            color: loopEnabled ? '#D500F9' : '#888',
            border: `1px solid ${loopEnabled ? '#D500F966' : '#333'}`,
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

      <ResizablePanel height={pianoHeight} minH={180} maxH={900} defaultH={0} onResize={setPianoHeight}
        style={{ flex: pianoHeight > 0 ? 'none' : '1', minHeight: pianoHeight > 0 ? pianoHeight : 180 }}>
        <div ref={scrollRef} className="flex-1 overflow-auto min-h-0" style={{ position: 'relative' }}>
          {drumMode ? (
            <div className="flex flex-col" style={{ minWidth: keyW + colW16 * COLS }}>
              <div className="sticky top-0 z-20" style={{ width: keyW + colW16 * COLS, position: 'relative' }}>
                <RulerRows />
                <LoopMarkersBrace
                  visible={rollLoopRegionOk}
                  leftPx={rollLoopBraceLeftPx}
                  widthPx={rollLoopBraceWidthPx}
                  height={RULER_H}
                  variant="purple"
                  zIndex={25}
                />
              </div>
              <div style={{ position: 'relative' }}>
                {DRUM_ROWS.map((name, ri) => (
                  <div key={ri} className="flex" style={{ borderBottom: '1px solid #111', height: rowH }}>
                    <div className="flex items-center justify-end pr-2 font-medium shrink-0"
                      style={{ width: keyW, color: DRUM_COLORS[ri], background: '#0d0d0d', borderRight: '1px solid #1e1e1e', fontSize: 9 }}>
                      {name}
                    </div>
                    {Array.from({ length: COLS }, (_, ci) => {
                      const on     = drumNotes.some(n => n.row === ri && n.col === ci);
                      const isHead = ci === active16;
                      const barIdx = Math.floor(ci / STEPS_PER_BAR);
                      const isSelBar = selectedBar !== null && (barIdx + 1) === selectedBar;
                      return (
                        <button key={ci} onClick={() => toggleDrum(ri, ci)}
                          style={{
                            width: colW16, height: '100%', flexShrink: 0,
                            background: on ? DRUM_COLORS[ri] : cellBg(ci, isHead, isSelBar),
                            borderLeft: colBorderStyle(ci),
                            boxShadow: on && isHead ? `0 0 8px ${DRUM_COLORS[ri]}` : 'none',
                          }} />
                      );
                    })}
                  </div>
                ))}
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
          ) : (
            <div className="flex flex-col" style={{ minWidth: keyW + colW16 * COLS }}>
              <div className="sticky top-0 z-20" style={{ width: keyW + colW16 * COLS, position: 'relative' }}>
                <RulerRows />
                <LoopMarkersBrace
                  visible={rollLoopRegionOk}
                  leftPx={rollLoopBraceLeftPx}
                  widthPx={rollLoopBraceWidthPx}
                  height={RULER_H}
                  variant="purple"
                  zIndex={25}
                />
              </div>
              <div style={{ position: 'relative' }}>
                {rows.map((row, ri) => (
                  <div key={ri} className="flex" style={{ borderBottom: `1px solid ${row.isBlack ? '#0c0c0c' : '#111'}`, height: rowH }}>
                    <div
                      className="flex items-center justify-end pr-1 shrink-0"
                      onPointerDown={() => setPressedKeyRow(ri)}
                      onPointerUp={() => setPressedKeyRow((v) => (v === ri ? null : v))}
                      onPointerLeave={() => setPressedKeyRow((v) => (v === ri ? null : v))}
                      onClick={() => playPianoRow(ri, 0.35)}
                      style={{
                        width: keyW,
                        background: row.isBlack
                          ? pressedKeyRow === ri ? '#161b1f' : '#1f2429'
                          : pressedKeyRow === ri ? '#b8c2cb' : '#d6dce1',
                        borderRight: '1px solid #2b3c48',
                        color: row.isBlack ? '#aeb7be' : '#2c3136',
                        fontSize: 8,
                        cursor: 'pointer',
                        transform: pressedKeyRow === ri ? 'translateX(2px) scaleX(0.98)' : 'translateX(0) scaleX(1)',
                        transition: 'transform 0.06s ease, background 0.06s ease',
                      }}
                    >
                    </div>
                    {Array.from({ length: COLS }, (_, ci) => {
                      const on     = notes.some(n => n.row === ri && n.col === ci);
                      const isHead = ci === active16;
                      const barIdx = Math.floor(ci / STEPS_PER_BAR);
                      const isSelBar = selectedBar !== null && (barIdx + 1) === selectedBar;
                      return (
                        <button key={ci} onClick={() => toggleNote(ri, ci)}
                          style={{
                            width: colW16, height: '100%', flexShrink: 0,
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
                                width: Math.max(6, Math.floor(colW16 * 0.72)),
                                height: Math.max(8, Math.floor(rowH * 0.68)),
                                borderRadius: 2,
                                background: '#b8f5c5',
                                border: '1px solid #dbffe2',
                                boxShadow: '0 0 7px #b8f5c599',
                              }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
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
          )}
        </div>
      </ResizablePanel>
    </div>
  );
}
