import {
  useState,
  useEffect,
  useSyncExternalStore,
  useRef,
  useCallback,
  useMemo,
  memo,
} from 'react';
import { flushSync } from 'react-dom';

import { Send, ZoomIn, ZoomOut, Maximize2, Zap, ChevronUp, ChevronDown, Volume2, Plus, X } from 'lucide-react';

import { useMasterClock, PPQ } from '@/app/context/MasterClockContext';
import TransportPulseWorker from '../workers/transportPulse.worker?worker';

import { usePianoNotes } from '@/app/context/PianoNotesContext';

import ProMeter from '@/app/components/ProMeter';
import LoopMarkersBrace, { LoopVerticalGuides } from '@/app/components/LoopMarkersBrace';


import {
  computeUsedCreationChannelMeta,
  writeCreationChannelManifestToStorage,
  DA_SESSION_TRACKS_SYNC_EVENT,
  CREATION_PAD_NAMES as PAD_NAMES,
  CREATION_PAD_COLORS as PAD_COLORS,
} from '@/app/lib/sessionChannelTracks';

import { CREATION_STATION_CLIP_DATA_KEY } from '@/app/lib/sessionClipContent';

import {
  fileToStoredPadSample,
  loadPadSampleStore,
  padSampleKey,
  savePadSampleStore,
  storedToArrayBuffer,
} from '@/app/lib/padSampleStorage';


// ── MIDI Note to Frequency (standard A=440Hz) ──────────────────────────────────

const NOTE_NAMES   = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function midiNoteToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function noteNameToMidi(name: string): number {
  const octave = parseInt(name[name.length - 1]);
  const noteName = name.slice(0, -1);
  const noteIdx = NOTE_NAMES.indexOf(noteName);
  return octave * 12 + noteIdx + 12;
}

function midiToNoteName(midi: number): string {
  const safeMidi = Math.max(12, Math.min(119, midi));
  const noteName = NOTE_NAMES[safeMidi % 12];
  const octave = Math.floor(safeMidi / 12) - 1;
  return `${noteName}${octave}`;
}


// ── Constants ─────────────────────────────────────────────────────────────────

const KITS         = ['Default','Trap 808','Lo-Fi','Acoustic','Electronic','Afrobeats'];

const BANKS        = ['A','B','C','D','E','F','G','H'];

const NOTES        = ['C5','B4','A#4','A4','G#4','G4','F#4','F4','E4','D#4','D4','C#4','C4','B3','A#3','A3'];

const PAD_VEL      = [115,90,90,90,90,90,90,90,90,90,90,90,90,90,90,127];

const INSTRUMENTS  = ['Piano','Synth','Bass','Lead'];

const EFFECTS      = ['Reverb','Delay','Distortion','Filter','Compressor','EQ','Chorus','Phaser'];


const DRUM_GRID_BARS   = 16;
const CREATION_PIANO_BARS = 64;

const TOTAL_BARS       = CREATION_PIANO_BARS;

const MEASURES_PER_BAR = 4;
/** User rule: four metronome quarter-clicks = four “measures” = one Creation “bar” — never use time-sig `qpb` here. */
const CREATION_QUARTERS_PER_BAR = MEASURES_PER_BAR;
/** 4/4 phrase: one measure = 4 quarter-note beats; bar-group cycles every 4 measures (16 beats). */
const BEATS_PER_MEASURE_44 = MEASURES_PER_BAR;
const MEASURES_PER_4BAR_PHRASE = 4;

const TOTAL_COLS       = TOTAL_BARS * MEASURES_PER_BAR;

/** Piano roll ruler: each song bar is always `MEASURES_PER_BAR` quarter columns (4 clicks = 1 bar). */
const PIANO_RULER_BAR_STEP_COUNTS = Array.from(
  { length: CREATION_PIANO_BARS },
  () => MEASURES_PER_BAR,
);

const KEY_W            = 56;

const LABEL_W          = 72;

const ROW_H            = 30;

const MIN_CW           = 10;

const MAX_CW           = 48;

const DEF_CW           = 26;

const ZOOM_STEP        = 4;

// Keep drum programming grid comfortably large for faster step entry.
const DRUM_GRID_ROW_H  = 30;
const DRUM_GRID_MIN_CW = 24;
const PIANO_GRID_MIN_CW = 34;

const SUB_CHANNEL      = 17;

// ── BAR/MEASURE HUD: display-only from master transport frame state ────────────────────────────────

let creationRulerSeq = 0;
let creationRulerBeatHighlight: number | null = null;
const creationRulerListeners = new Set<() => void>();

function subscribeCreationRulerBeat(cb: () => void) {
  creationRulerListeners.add(cb);
  return () => creationRulerListeners.delete(cb);
}

function getCreationRulerSeq() {
  return creationRulerSeq;
}

function publishCreationRulerBeat(m: number | null) {
  if (creationRulerBeatHighlight === m) return;
  creationRulerBeatHighlight = m;
  creationRulerSeq += 1;
  creationRulerListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

type CreationTransportHudProps = {
  transportNotStopped: boolean;
  qpb: number;
  measureInBar: number;
  displayBarNumber: number;
  phraseEveryFourMeasures: number;
  debugText?: string;
};

/** Display-only: numbers come from parent so MEASURE/BAR use the same quarter index as the playhead. */
function CreationTransportHud({
  transportNotStopped,
  qpb,
  measureInBar,
  displayBarNumber,
  phraseEveryFourMeasures,
  debugText,
}: CreationTransportHudProps) {
  const measureLedCount = MEASURES_PER_BAR;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: '#000',
        border: `1px solid ${transportNotStopped ? '#D500F966' : '#222'}`,
        borderRadius: 4,
        overflow: 'hidden',
        fontFamily: 'monospace',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '2px 8px',
          borderRight: '1px solid #1a1a1a',
        }}
        title={`Creation bar ${displayBarNumber}: four measures (1→2→3→4) per bar — not DAW time sig (${qpb} beats/notated bar). Now measure ${measureInBar} of ${CREATION_QUARTERS_PER_BAR}. Phrase ${phraseEveryFourMeasures} (every ${MEASURES_PER_4BAR_PHRASE} Creation bars).`}
      >
        <span style={{ fontSize: 6, color: '#444', letterSpacing: 2 }}>BAR</span>
        <span
          style={{
            fontSize: 18,
            fontWeight: 900,
            color: transportNotStopped ? '#00E5FF' : '#444',
            lineHeight: 1,
          }}
        >
          {String(displayBarNumber).padStart(3, '0')}
        </span>
        <span style={{ fontSize: 9, color: '#aaa', marginTop: 1, fontWeight: 700 }}>
          {measureInBar}→{CREATION_QUARTERS_PER_BAR}
        </span>
        <span style={{ fontSize: 8, color: '#666', marginTop: 1 }}>
          PH {phraseEveryFourMeasures}
        </span>
        {debugText ? (
          <span style={{ fontSize: 7, color: '#f66', marginTop: 1, letterSpacing: 0.3 }}>
            {debugText}
          </span>
        ) : null}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '2px 8px',
        }}
        title={`Measures 1–${measureLedCount} in order within each Creation bar (${CREATION_QUARTERS_PER_BAR} per bar). Not the same as DAW bar lines (${qpb} beats/notated bar).`}
      >
        <span style={{ fontSize: 6, color: '#444', letterSpacing: 1 }}>MEASURE</span>
        <div style={{ display: 'flex', gap: 3, marginTop: 2, flexWrap: 'wrap' }}>
          {Array.from({ length: measureLedCount }, (_, i) => i + 1).map((m) => (
            <div
              key={m}
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8,
                fontWeight: 900,
                background:
                  transportNotStopped && measureInBar === m ? '#D500F920' : '#0f0f0f',
                color: transportNotStopped && measureInBar === m ? '#D500F9' : '#2a2a2a',
                border: `1px solid ${
                  transportNotStopped && measureInBar === m ? '#D500F9' : '#1a1a1a'
                }`,
                boxShadow:
                  transportNotStopped && measureInBar === m ? '0 0 8px #D500F9' : 'none',
              }}
            >
              {m}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const BAR_PALETTE = ['#ffff00','#00E5FF','#00ff88','#ff6b35','#a78bfa','#f472b6','#60a5fa','#ffcc00'];

function barColor(b: number) { return BAR_PALETTE[b % BAR_PALETTE.length]; }

function colColor(ci: number) { return barColor(Math.floor(ci / MEASURES_PER_BAR)); }

function drumLaneBg(rowIndex: number): string {
  return rowIndex % 2 === 0 ? '#102938' : '#0e2432';
}

function drumStepBg(
  ci: number,
  rowIndex: number,
  isHead: boolean,
  stepsPerBar: number = MEASURES_PER_BAR,
): string {
  if (isHead) return '#1a3a4f';
  const lane = drumLaneBg(rowIndex);
  if (ci % (stepsPerBar * 4) === 0) return '#1c3e54';
  if (ci % stepsPerBar === 0) return '#18405a';
  return lane;
}

function pianoLaneBg(rowIndex: number): string {
  return rowIndex % 2 === 0 ? '#102938' : '#0e2432';
}

function pianoStepBg(
  ci: number,
  rowIndex: number,
  isHead: boolean,
  stepsPerBar: number = MEASURES_PER_BAR,
): string {
  if (isHead) return '#1a3a4f';
  if (ci % (stepsPerBar * 4) === 0) return '#1c3e54';
  if (ci % stepsPerBar === 0) return '#18405a';
  return pianoLaneBg(rowIndex);
}


/** One-shot sample through the same master bus / pan as drum synth (MPC-style pad sample). */
function playPadSampleBuffer(
  ctx: AudioContext,
  buffer: AudioBuffer,
  chId: number,
  vel: number,
  when: number,
  channelVolumes: Record<number, number>,
) {
  const chVol = (channelVolumes[chId] ?? 80) / 100;
  const vol = (vel / 127) * 0.85 * chVol;
  const rawPan =
    ((window as unknown as { __daMusicChannelPans?: Record<number, number> }).__daMusicChannelPans?.[chId] ?? 0) / 100;
  const panNode = ctx.createStereoPanner();
  panNode.pan.value = Math.max(-1, Math.min(1, rawPan));
  const master = (window as unknown as { __daMusicMasterGain?: GainNode | null }).__daMusicMasterGain;
  const dest =
    master && master.context === ctx ? master : ctx.destination;
  panNode.connect(dest);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(g);
  g.connect(panNode);
  src.start(when);
  src.onended = () => {
    try {
      src.disconnect();
      g.disconnect();
      panNode.disconnect();
    } catch {
      /* */
    }
  };
}


type DrumPattern = boolean[][];

type PianoNote   = { row: number; col: number };

interface Bank   { drums: DrumPattern; notes: PianoNote[]; }

interface FxParam { label: string; value: number; }

interface Effect { type: string; enabled: boolean; params: FxParam[]; }

function GraphicEQ({
  params,
  color,
  signal,
  onBandGainChange,
}: {
  params: FxParam[];
  color: string;
  signal: number;
  onBandGainChange?: (bandIndex: number, value: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragBand, setDragBand] = useState<number | null>(null);
  const dragStartYRef = useRef(0);
  const dragStartValueRef = useRef(50);
  const bandColors = [
    '#00E5FF', '#2ad9ff', '#5bd4ff', '#7fc3ff',
    '#9a7cff', '#b56bff', '#D500F9', '#e64bd1',
    '#ff5bb0', '#ff7f8a', '#ffad5b', '#ffcc00',
  ];
  const chartW = 236;
  const chartH = 92;
  const bandXs = [14, 30, 46, 62, 78, 94, 110, 126, 146, 166, 190, 214];
  const bandLabels = ['60', '90', '140', '220', '350', '550', '850', '1.3k', '2k', '3.2k', '5k', '8k'];
  const gainFromParams = (i: number) =>
    params.find((p) => p.label === `Band ${i + 1} Gain`)?.value ??
    params.find((p) => p.label === ['Low Gain', 'Mid Gain', 'High Gain'][i])?.value ??
    50;
  const gains = Array.from({ length: 12 }, (_, i) => gainFromParams(i));
  const toDb = (v: number) => ((v - 50) / 50) * 24; // wider range: -24..+24dB
  const valueToY = (v: number) => 46 - (toDb(v) / 24) * 34;
  const yToValue = (y: number) => {
    const clamped = Math.max(8, Math.min(84, y));
    const db = ((46 - clamped) / 34) * 24;
    return Math.round(Math.max(0, Math.min(100, 50 + (db / 24) * 50)));
  };
  const points = gains.map((g, i) => ({ x: bandXs[i], y: valueToY(g) }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const bandEnergy = gains.map((g) => Math.max(0, Math.min(1, signal * (0.65 + Math.abs(g - 50) / 70))));
  const bins = Array.from({ length: 54 }, (_, i) => {
    const x = 4 + i * 4.2;
    const posX = Math.round(x);
    let y = points[0].y;
    for (let j = 0; j < points.length - 1; j += 1) {
      const a = points[j];
      const b = points[j + 1];
      if (posX >= a.x && posX <= b.x) {
        const t = (posX - a.x) / Math.max(1, b.x - a.x);
        y = a.y + (b.y - a.y) * t;
        break;
      }
      if (posX > points[points.length - 1].x) y = points[points.length - 1].y;
    }
    const reactiveLift = 8 + Math.round(signal * 34);
    const h = Math.max(4, Math.min(82, Math.round(86 - y + reactiveLift)));
    return { x, h };
  });
  const beginDrag = (bandIndex: number, e: React.PointerEvent<SVGCircleElement>) => {
    setDragBand(bandIndex);
    dragStartYRef.current = e.clientY;
    dragStartValueRef.current = gains[bandIndex] ?? 50;
  };
  const endDrag = () => setDragBand(null);
  const moveDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragBand === null || !onBandGainChange || !svgRef.current) return;
    const deltaY = dragStartYRef.current - e.clientY;
    // Shift = fine, Alt = large.
    const sensitivity = e.shiftKey ? 0.12 : e.altKey ? 0.7 : 0.32;
    const next = Math.max(0, Math.min(100, Math.round(dragStartValueRef.current + deltaY * sensitivity)));
    onBandGainChange(dragBand, next);
  };

  return (
    <div style={{ marginTop: 6, marginBottom: 6, borderRadius: 4, border: '1px solid #233746', background: 'linear-gradient(180deg, #071019 0%, #071627 100%)', padding: 8 }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${chartW} ${chartH}`}
        width="100%"
        height="186"
        preserveAspectRatio="none"
        aria-label="6-band graphic EQ response"
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <defs>
          <linearGradient id="eqBgGradient6" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#08131e" />
            <stop offset="100%" stopColor="#0a1f2f" />
          </linearGradient>
          <linearGradient id="eqCurveGradient6" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00E5FF" />
            <stop offset="50%" stopColor="#D500F9" />
            <stop offset="100%" stopColor="#ffcc00" />
          </linearGradient>
          <linearGradient id="eqBarsGradient6" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#30d5ff" />
            <stop offset="55%" stopColor="#1ab3f0" />
            <stop offset="100%" stopColor="#1274a4" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={chartW} height={chartH} fill="url(#eqBgGradient6)" />
        {[10, 18, 26, 34, 42, 50, 58, 66, 74, 82].map((y, yi) => (
          <line
            key={`h-${y}`}
            x1="0"
            y1={y}
            x2={chartW}
            y2={y}
            stroke={signal > 0.04 && yi % 2 === 0 ? 'rgba(66,191,255,0.45)' : '#1a3246'}
            strokeWidth={signal > 0.08 && yi % 2 === 0 ? 1.2 : 1}
          />
        ))}
        {Array.from({ length: 24 }, (_, i) => 10 + i * ((chartW - 20) / 23)).map((x) => {
          let nearest = 0;
          let minD = Infinity;
          for (let bi = 0; bi < bandXs.length; bi += 1) {
            const d = Math.abs(x - bandXs[bi]);
            if (d < minD) {
              minD = d;
              nearest = bi;
            }
          }
          const e = bandEnergy[nearest] ?? 0;
          const lit = e > 0.06;
          return (
            <line
              key={`v-${x}`}
              x1={x}
              y1="0"
              x2={x}
              y2={chartH}
              stroke={lit ? bandColors[nearest] : '#1a3246'}
              strokeOpacity={lit ? 0.25 + e * 0.65 : 1}
              strokeWidth={lit ? 1 + e * 0.8 : 1}
            />
          );
        })}
        {bins.map((b, i) => (
          <rect key={`bin-${i}`} x={b.x} y={chartH - 4 - b.h} width="2.8" height={b.h} rx="0.8" fill="url(#eqBarsGradient6)" opacity={0.92} />
        ))}
        <path d={path} fill="none" stroke="url(#eqCurveGradient6)" strokeWidth={2.4 + signal * 2.4} />
        {points.map((p, i) => (
          <circle
            key={`pt-${i}`}
            cx={p.x}
            cy={p.y}
            r={2.8 + signal * 1.2}
            fill={bandColors[i]}
            stroke="#0b0b0b"
            strokeWidth="1"
            style={{ cursor: 'ns-resize', touchAction: 'none' }}
            onPointerDown={(e) => {
              e.preventDefault();
              beginDrag(i, e);
              (e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              onBandGainChange?.(i, 50); // 0 dB center
            }}
          />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#7ca0bb', fontFamily: 'monospace', marginTop: 6 }}>
        {bandLabels.map((l, i) => (
          <span key={l} style={{ color: bandColors[i], fontWeight: 700 }}>{l}</span>
        ))}
      </div>
      <div style={{ marginTop: 4, fontSize: 7, color: '#6f879a', fontFamily: 'monospace', textAlign: 'right' }}>
        Drag dots: Shift=fine, Alt=big
      </div>
      <div style={{ marginTop: 2, fontSize: 7, color: '#6f879a', fontFamily: 'monospace', textAlign: 'right' }}>
        Double-click dot: reset band to 0 dB
      </div>
    </div>
  );
}

function formatFxParamValue(label: string, value: number): string {
  const l = label.toLowerCase();
  if (l.includes('gain')) {
    const db = (((value - 50) / 50) * 12).toFixed(1);
    return `${db} dB`;
  }
  if (l === 'low freq') {
    const hz = Math.round(40 * Math.pow(12, value / 100)); // ~40..480 Hz
    return `${hz} Hz`;
  }
  if (l === 'mid freq') {
    const hz = Math.round(200 * Math.pow(10, value / 100)); // ~200..2000 Hz
    return `${hz} Hz`;
  }
  if (l === 'high freq') {
    const hz = Math.round(1500 * Math.pow(8, value / 100)); // ~1.5k..12k Hz
    return `${hz} Hz`;
  }
  if (l.includes('time') || l.includes('attack')) return `${Math.round(5 + value * 4.5)} ms`;
  if (l.includes('pre-delay')) return `${Math.round(value * 2.4)} ms`;
  if (l.includes('release')) return `${Math.round(20 + value * 8)} ms`;
  if (l.includes('rate')) return `${(0.1 + (value / 100) * 9.9).toFixed(2)} Hz`;
  if (l.includes('depth') || l.includes('width') || l.includes('shape') || l.includes('size') || l.includes('diffusion')) return `${value}%`;
  if (l.includes('threshold')) return `${Math.round(-60 + value * 0.6)} dB`;
  if (l.includes('ratio')) return `${(1 + (value / 100) * 19).toFixed(1)}:1`;
  if (l.includes('output') || l.includes('trim') || l.includes('gain')) return `${(((value - 50) / 50) * 12).toFixed(1)} dB`;
  if (l.includes('feedback')) return `${value}%`;
  if (l.includes('mix') || l.includes('wet') || l.includes('dry')) return `${value}%`;
  if (l.includes('drive')) return `${value}%`;
  if (l.includes('cutoff')) return `${Math.round(40 * Math.pow(250, value / 100))} Hz`;
  if (l.includes('resonance')) return `${(0.1 + (value / 100) * 9.9).toFixed(1)} Q`;
  return String(value);
}

function normalizeEqParams(params: FxParam[]): FxParam[] {
  const read = (label: string) => params.find((p) => p.label === label)?.value;
  const lowLegacy = read('Low Gain');
  const midLegacy = read('Mid Gain');
  const highLegacy = read('High Gain');
  const filled = Array.from({ length: 12 }, (_, i) => {
    const bandLabel = `Band ${i + 1} Gain`;
    const bandVal = read(bandLabel);
    if (typeof bandVal === 'number') return { label: bandLabel, value: bandVal };
    // Backfill legacy 3-band EQ into 12-band layout.
    if (i < 4 && typeof lowLegacy === 'number') return { label: bandLabel, value: lowLegacy };
    if (i >= 4 && i < 8 && typeof midLegacy === 'number') return { label: bandLabel, value: midLegacy };
    if (i >= 8 && typeof highLegacy === 'number') return { label: bandLabel, value: highLegacy };
    return { label: bandLabel, value: 50 };
  });
  return filled;
}

function FxKnob({
  label,
  value,
  color,
  onChange,
}: {
  label: string;
  value: number;
  color: string;
  onChange: (v: number) => void;
}) {
  const startYRef = useRef(0);
  const startValRef = useRef(value);
  const draggingRef = useRef(false);
  const angle = -135 + (Math.max(0, Math.min(100, value)) / 100) * 270;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 74 }}>
      <div
        onPointerDown={(e) => {
          e.preventDefault();
          draggingRef.current = true;
          startYRef.current = e.clientY;
          startValRef.current = value;
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current) return;
          const sensitivity = e.shiftKey ? 0.18 : e.altKey ? 1.0 : 0.58;
          const delta = (startYRef.current - e.clientY) * sensitivity;
          onChange(Math.max(0, Math.min(100, Math.round(startValRef.current + delta))));
        }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={(e) => {
          draggingRef.current = false;
          (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        }}
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 25%, #2f3941 0%, #1a2127 65%, #10161b 100%)',
          border: `1px solid ${color}66`,
          boxShadow: `inset 0 0 0 1px #000, 0 0 8px ${color}33`,
          position: 'relative',
          cursor: 'ns-resize',
          touchAction: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 2,
            height: 15,
            borderRadius: 2,
            background: color,
            transform: `translate(-50%, -96%) rotate(${angle}deg)`,
            transformOrigin: '50% 100%',
            boxShadow: `0 0 4px ${color}`,
          }}
        />
      </div>
      <span style={{ fontSize: 8, fontWeight: 700, color: '#90a9bc', fontFamily: 'monospace' }}>{label}</span>
      <span style={{ fontSize: 8, color: '#6f879a', fontFamily: 'monospace' }}>{formatFxParamValue(label, value)}</span>
    </div>
  );
}

function EffectVisualizer({
  type,
  params,
  signal,
}: {
  type: string;
  params: FxParam[];
  signal: number;
}) {
  const p = (i: number, fallback = 50) => params[i]?.value ?? fallback;
  const a = p(0);
  const b = p(1);
  const c = p(2);
  const hueBase =
    type === 'Reverb' ? 165 :
    type === 'Delay' ? 205 :
    type === 'Distortion' ? 12 :
    type === 'Filter' ? 58 :
    type === 'Compressor' ? 300 :
    type === 'Chorus' ? 230 :
    type === 'Phaser' ? 280 : 190;
  const points = Array.from({ length: 28 }, (_, i) => {
    const t = (i / 27) * Math.PI * 2;
    const wobble = 14 + (a / 100) * 10 + signal * 10 + Math.sin(t * (1 + b / 60)) * (4 + c / 20 + signal * 6);
    const x = 70 + Math.cos(t) * wobble;
    const y = 50 + Math.sin(t) * wobble;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <div
      style={{
        marginBottom: 8,
        borderRadius: 6,
        border: `1px solid hsla(${hueBase}, 80%, 60%, 0.35)`,
        background: `radial-gradient(circle at 30% 25%, hsla(${hueBase}, 85%, 50%, 0.20) 0%, rgba(8,18,28,0.95) 55%, rgba(7,15,24,1) 100%)`,
        boxShadow: `inset 0 0 ${30 + signal * 36}px hsla(${hueBase}, 75%, 45%, ${0.14 + signal * 0.3})`,
        padding: 8,
      }}
    >
      <svg viewBox="0 0 140 96" width="100%" height="96" preserveAspectRatio="xMidYMid meet" aria-label={`${type} visualizer`}>
        <defs>
          <linearGradient id={`fx-grad-${type}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={`hsla(${hueBase}, 100%, 72%, 0.85)`} />
            <stop offset="100%" stopColor={`hsla(${(hueBase + 70) % 360}, 100%, 58%, 0.70)`} />
          </linearGradient>
        </defs>
        {Array.from({ length: 9 }, (_, i) => {
          const r = 8 + i * 6;
          return <circle key={r} cx="70" cy="50" r={r} fill="none" stroke="rgba(90,130,160,0.22)" strokeWidth="0.8" />;
        })}
        <polygon points={points} fill={`url(#fx-grad-${type})`} opacity={0.45 + signal * 0.45} stroke={`hsla(${hueBase}, 100%, 70%, 0.95)`} strokeWidth={1.2 + signal * 1.2} />
        <circle cx="70" cy="50" r={8 + (a / 100) * 7 + signal * 6} fill={`hsla(${hueBase}, 90%, 55%, ${0.7 + signal * 0.3})`} />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 8, fontFamily: 'monospace', color: '#7ea1b7' }}>
        <span>{type.toUpperCase()}</span>
        <span>{formatFxParamValue(params[0]?.label ?? 'Amt', a)}</span>
      </div>
    </div>
  );
}

function emptyDrums(): DrumPattern {
  return Array.from({ length: 16 }, () => Array(TOTAL_COLS).fill(false));
}


// ── Ruler ─────────────────────────────────────────────────────────────────────

function Ruler({
  activeCol,
  colWidth,
  maxBars = TOTAL_BARS,
  barNumberStart = 1,
  onRangeCommit,
  stepsPerBar = MEASURES_PER_BAR,
  /** If set (sum must match drum pattern column count), beat row uses variable widths per bar — keeps ruler aligned with the grid in odd meters. */
  barStepCounts,
  /** When `barStepCounts` groups columns differently from one DAW bar per segment, set header labels (e.g. DAW bar at each segment start). */
  segmentHeaderLabels,
  /** Map pattern column index → DAW bar for loop drag; required when segment count ≠ DAW bars in range. */
  patternColToDawBar,
  /**
   * When set to 1–4, the beat row lights that number inside the segment that contains `activeCol`.
   * (Pattern may have only 2 columns in 2/4 but each segment still shows 1–4 — avoids “2/4 ruler”.)
   */
  creationBeatHighlight,
}: {
  activeCol: number;
  colWidth: number;
  maxBars?: number;
  /** First bar label (1-based) — use for global bar numbers when the loop is not at bar 1. */
  barNumberStart?: number;
  /** Drag across bar headers to set shared loop range (master loop state). */
  onRangeCommit?: (startBar: number, endBar: number) => void;
  /** Quarter-note columns per bar — fallback when `barStepCounts` omitted. */
  stepsPerBar?: number;
  barStepCounts?: number[];
  segmentHeaderLabels?: number[];
  patternColToDawBar?: (patternCol: number) => number;
  creationBeatHighlight?: number | null;
}) {
  const headerRef = useRef<HTMLDivElement>(null);
  const dragStartBarRef = useRef<number | null>(null);

  const counts =
    barStepCounts && barStepCounts.length > 0
      ? barStepCounts
      : Array.from({ length: maxBars }, () => stepsPerBar);
  const barN = counts.length;

  const pxToBarIndex = (clientX: number) => {
    const el = headerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    let acc = 0;
    for (let bi = 0; bi < barN; bi++) {
      const w = colWidth * counts[bi]!;
      if (x < acc + w) return Math.max(0, Math.min(barN - 1, bi));
      acc += w;
    }
    return Math.max(0, barN - 1);
  };

  const pxToPatternCol = (clientX: number): number => {
    const el = headerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    let accPx = 0;
    let colAcc = 0;
    for (let bi = 0; bi < barN; bi++) {
      const w = colWidth * counts[bi]!;
      if (x < accPx + w) {
        const within = x - accPx;
        const colInSeg = Math.min(
          counts[bi]! - 1,
          Math.max(0, Math.floor(within / colWidth)),
        );
        return colAcc + colInSeg;
      }
      accPx += w;
      colAcc += counts[bi]!;
    }
    return Math.max(0, colAcc - 1);
  };

  const dawBarFromPointer = (clientX: number) =>
    patternColToDawBar
      ? patternColToDawBar(pxToPatternCol(clientX))
      : barNumberStart + pxToBarIndex(clientX);

  let colStartAcc = 0;
  return (
    <div ref={headerRef} style={{ display: 'flex', height: 28, flexShrink: 0 }}>
      {Array.from({ length: barN }, (_, bi) => {
        const stepsThisBar = counts[bi]!;
        const colStart = colStartAcc;
        colStartAcc += stepsThisBar;
        const isActiveBar =
          activeCol >= colStart && activeCol < colStart + stepsThisBar;
        const color = barColor(bi);
        const barLabel =
          segmentHeaderLabels && segmentHeaderLabels.length === barN
            ? segmentHeaderLabels[bi]!
            : barNumberStart + bi;
        return (
          <div key={bi} style={{ width: colWidth * stepsThisBar, flexShrink: 0, borderLeft: `1px solid ${bi % 4 === 0 ? '#333' : '#1e1e1e'}`, display: 'flex', flexDirection: 'column' }}>
            <div
              onPointerDown={onRangeCommit ? (e) => {
                dragStartBarRef.current = dawBarFromPointer(e.clientX);
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } : undefined}
              onPointerUp={onRangeCommit ? (e) => {
                if (dragStartBarRef.current == null) return;
                const endBar = dawBarFromPointer(e.clientX);
                const s = dragStartBarRef.current;
                onRangeCommit(Math.min(s, endBar), Math.max(s, endBar));
                dragStartBarRef.current = null;
                try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* */ }
              } : undefined}
              style={{
                fontSize: 8,
                fontFamily: 'monospace',
                fontWeight: 700,
                color: isActiveBar ? color : '#444',
                textAlign: 'center',
                lineHeight: '14px',
                background: isActiveBar ? `${color}15` : 'transparent',
                borderBottom: `2px solid ${isActiveBar ? color : '#1a1a1a'}`,
                cursor: onRangeCommit ? 'ew-resize' : 'default',
                touchAction: 'none',
              }}
            >
              {barLabel}
            </div>
            <div style={{ display: 'flex', flex: 1 }}>
              {Array.from({ length: stepsThisBar }, (_, mi) => {
                const ci = colStart + mi;
                const inActiveSeg =
                  activeCol >= colStart &&
                  activeCol < colStart + stepsThisBar;
                const useCreationHighlight =
                  creationBeatHighlight != null &&
                  creationBeatHighlight >= 1 &&
                  creationBeatHighlight <= MEASURES_PER_BAR;
                const isHead = useCreationHighlight
                  ? inActiveSeg && mi + 1 === creationBeatHighlight
                  : activeCol === ci;
                return (
                  <div key={mi} style={{ flex: 1, fontSize: 7, textAlign: 'center', color: isHead ? color : '#2a2a2a', fontWeight: isHead ? 700 : 400, background: isHead ? `${color}20` : 'transparent', borderLeft: mi > 0 ? '1px solid #181818' : 'none', fontFamily: 'monospace', lineHeight: '13px' }}>
                    {mi + 1}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ── Pad button ────────────────────────────────────────────────────────────────

function Pad({ name, color, channel, flashTick, onTap, onChannelChange, hasSample, onLoadSample, onClearSample }: {
  name: string; color: string; channel: number;
  flashTick: number;
  onTap: () => void; onChannelChange: (ch: number) => void;
  hasSample: boolean;
  onLoadSample: () => void;
  onClearSample: () => void;
}) {
  const [pressed, setPressed]   = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const timerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTickRef             = useRef(0);
  const PAD_SEQ_FLASH_MS = 65;
  const PAD_TAP_FLASH_MS = 85;

  useEffect(() => {
    if (flashTick === 0 || flashTick === prevTickRef.current) return;
    prevTickRef.current = flashTick;
    setPressed(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPressed(false), PAD_SEQ_FLASH_MS);
  }, [flashTick]);

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    // Render press/light state immediately before audio/parent updates.
    flushSync(() => {
      setPressed(true);
    });
    onTap();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPressed(false), PAD_TAP_FLASH_MS);
  }

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <button
        type="button"
        title="Tap = trigger · Right-click = sampler + mixer channel"
        onPointerDown={handlePointerDown}
        onContextMenu={e => { e.preventDefault(); setShowMenu(p => !p); }}
        style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '8px 10px', width: '100%', height: '100%',
          background: pressed 
            ? `linear-gradient(145deg, ${color}, ${color}dd)` 
            : `linear-gradient(145deg, ${color}15, ${color}08)`,
          backdropFilter: 'blur(10px)',
          border: `2px solid ${pressed ? color : `${color}66`}`,
          borderRadius: 12,
          color: pressed ? '#000' : color,
          cursor: 'pointer', userSelect: 'none',
          boxShadow: pressed 
            ? `0 0 30px ${color}, 0 0 60px ${color}88, inset 0 0 20px ${color}44, 0 4px 15px rgba(0,0,0,0.4)` 
            : `0 0 8px ${color}22, inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 12px rgba(0,0,0,0.3)`,
          transition: 'none',
          transform: pressed ? 'scale(0.95) translateY(2px)' : 'scale(1)',
          backgroundImage: pressed ? 'none' : `linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)`,
        }}>
        {/* LED Indicator */}
        <div style={{
          position: 'absolute', top: 6, right: 6,
          width: 8, height: 8, borderRadius: '50%',
          background: pressed ? '#fff' : color,
          boxShadow: pressed ? `0 0 12px #fff, 0 0 20px ${color}` : `0 0 6px ${color}66`,
          transition: 'none'
        }} />
        
        <span style={{ 
          fontWeight: 800, fontSize: 11, letterSpacing: 1.5,
          textShadow: pressed ? 'none' : `0 0 10px ${color}88`,
          textTransform: 'uppercase'
        }}>{name}</span>
        
        <span style={{ 
          fontFamily: 'monospace', fontSize: 9, opacity: 0.7,
          background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4,
          marginTop: 4
        }}>CH{channel}{hasSample ? ' · SAMP' : ''}</span>
      </button>
      
      {showMenu && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 999,
          background: 'linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%)',
          border: '1px solid #333',
          borderRadius: 8, padding: 4, marginTop: 4,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ fontSize: 9, color: '#888', padding: '4px 8px', letterSpacing: 1 }}>SAMPLER</div>
          <button
            type="button"
            onClick={() => { onLoadSample(); setShowMenu(false); }}
            style={{
              display: 'block', width: '100%', padding: '6px 12px',
              background: '#00ff8822', color: '#00ff88', border: 'none', borderRadius: 4,
              cursor: 'pointer', fontSize: 11, textAlign: 'left', marginBottom: 4,
            }}
          >
            Load sample…
          </button>
          {hasSample && (
            <button
              type="button"
              onClick={() => { onClearSample(); setShowMenu(false); }}
              style={{
                display: 'block', width: '100%', padding: '6px 12px',
                background: '#ff444422', color: '#ff8888', border: 'none', borderRadius: 4,
                cursor: 'pointer', fontSize: 11, textAlign: 'left', marginBottom: 6,
              }}
            >
              Clear sample
            </button>
          )}
          <div style={{ fontSize: 9, color: '#888', padding: '4px 8px', letterSpacing: 1 }}>MIXER CH</div>
          {[...Array(24)].map((_, i) => (
            <button key={i} onClick={() => { onChannelChange(i + 1); setShowMenu(false); }}
              style={{
                display: 'block', width: '100%', padding: '6px 12px',
                background: channel === i + 1 ? color : 'transparent',
                color: channel === i + 1 ? '#000' : '#fff',
                border: 'none', borderRadius: 4, cursor: 'pointer',
                fontSize: 11, textAlign: 'left',
                transition: 'all 0.1s'
              }}>
              CH {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


// ── BankButtons (memoized to prevent re-render on BPM change) ─────────────────

interface BankButtonsProps {
  activeBank: number;
  setActiveBank: (i: number) => void;
  hasDrums: (i: number) => boolean;
  hasNotes: (i: number) => boolean;
}


const BankButtons = memo(({ activeBank, setActiveBank, hasDrums, hasNotes }: BankButtonsProps) => (
  <div style={{ display: 'flex', gap: 3 }}>
    {BANKS.map((b, i) => (
      <button key={b} onClick={() => setActiveBank(i)} style={{ position: 'relative', width: 24, height: 24, borderRadius: 4, fontSize: 10, fontWeight: 900, background: activeBank === i ? '#D500F9' : '#111', color: activeBank === i ? '#000' : '#555', border: `1px solid ${activeBank === i ? '#D500F9' : '#333'}`, cursor: 'pointer' }}>
        {b}
        {hasDrums(i) && <div style={{ position: 'absolute', top: 1, right: 1, width: 4, height: 4, borderRadius: '50%', background: '#ff6b35' }} />}
        {hasNotes(i) && <div style={{ position: 'absolute', bottom: 1, right: 1, width: 4, height: 4, borderRadius: '50%', background: '#00E5FF' }} />}
      </button>
    ))}
  </div>
));

BankButtons.displayName = 'BankButtons';


// ── PadSection ──────────────────────────────────────────────────────────────────

interface PadSectionProps {
  padChannels: number[];
  padFlashTicks: number[];
  subFlashTick: number;
  subOn: boolean;
  onHitPad: (i: number) => void;
  onChannelChange: (i: number, ch: number) => void;
  onSubToggle: () => void;
  hasPadSample: (padIndex: number) => boolean;
  onLoadPadSample: (padIndex: number) => void;
  onClearPadSample: (padIndex: number) => void;
}


function PadSection({ padChannels, padFlashTicks, subFlashTick, subOn, onHitPad, onChannelChange, onSubToggle, hasPadSample, onLoadPadSample, onClearPadSample }: PadSectionProps) {
  const [subPressed, setSubPressed] = useState(false);
  const subPrevTickRef = useRef(0);
  const subTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SUB_SEQ_FLASH_MS = 65;
  const SUB_TAP_FLASH_MS = 140;

  useEffect(() => {
    if (subFlashTick === 0 || subFlashTick === subPrevTickRef.current) return;
    subPrevTickRef.current = subFlashTick;
    setSubPressed(true);
    if (subTimerRef.current) clearTimeout(subTimerRef.current);
    subTimerRef.current = setTimeout(() => setSubPressed(false), SUB_SEQ_FLASH_MS);
  }, [subFlashTick]);

  return (
    <div style={{ flexShrink: 0, padding: '6px 8px 0', background: '#080808', borderBottom: '1px solid #1a1a1a' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(4, 54px)', gap: 4 }}>
        {PAD_NAMES.map((name, i) => (
          <Pad
            key={i}
            name={name}
            color={PAD_COLORS[i]}
            channel={padChannels[i]}
            flashTick={padFlashTicks[i]}
            onTap={() => onHitPad(i)}
            onChannelChange={ch => onChannelChange(i, ch)}
            hasSample={hasPadSample(i)}
            onLoadSample={() => onLoadPadSample(i)}
            onClearSample={() => onClearPadSample(i)}
          />
        ))}
      </div>
      <div style={{ marginTop: 4, marginBottom: 6 }}>
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            onSubToggle();
            flushSync(() => {
              setSubPressed(true);
            });
            if (subTimerRef.current) clearTimeout(subTimerRef.current);
            subTimerRef.current = setTimeout(() => setSubPressed(false), SUB_TAP_FLASH_MS);
          }}
          style={{ 
            width: '100%', padding: '12px 0', borderRadius: 12, 
            fontWeight: 900, fontSize: 14, letterSpacing: 3,
            textTransform: 'uppercase',
            background: subPressed
              ? 'linear-gradient(145deg, #D500F9, #9C27B0)' 
              : 'linear-gradient(145deg, #1a1a2a, #0d0d1a)',
            color: subPressed ? '#fff' : '#D500F9', 
            border: `2px solid ${subPressed ? '#D500F9' : '#D500F944'}`,
            cursor: 'pointer',
            boxShadow: subPressed
              ? '0 0 30px #D500F988, 0 0 60px #D500F944, inset 0 0 20px rgba(255,255,255,0.2)' 
              : '0 4px 15px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: subPressed ? 'scale(1.02)' : 'scale(1)',
            backdropFilter: 'blur(10px)'
          }}
        >
          ◉ SUB BASS <span style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.7, marginLeft: 8 }}>CH{SUB_CHANNEL}</span>
        </button>
      </div>
    </div>
  );
}


// ── Main Screen ────────────────────────────────────────────────────────────────

export default function CreationStationScreen({
  onExport,
  isScreenActive = true,
}: {
  onExport: (dest: string) => void;
  isScreenActive?: boolean;
}) {
  const {
    transport,
    bpm,
    setBpm,
    triggerChannel,
    channelLevels,
    channelVolumes,
    setChannelVolume,
    getOrCreateAudioContext,
    loopBars,
    loopStartBar,
    loopEndBar,
    loopEnabled,
    loopSection,
    setLoopRange,
    getTickIntAtAudioNow,
    mapGlobalTickToAudioTime,
    wrapGlobalTickToDisplayTick,
    songStep,
    transportBeatFloat,
    getDisplayBeatsAtAudioNow,
    audioCtxRef,
    quartersPerBar,
    ticksPerBar,
    loopStartTick,
    metronomeClickLatencyMs,
    setMetronomeClickLatencyMs,
    syncMetronomeClickLatencyFromOutput,
    subscribeTransportBeatUi,
    getTransportBeatUiSnapshot,
  } = useMasterClock();

  /** Tie Creation Station repaints to the same transport frame store as the master clock RAF. */
  const _transportFrameSeq = useSyncExternalStore(
    subscribeTransportBeatUi,
    () => getTransportBeatUiSnapshot().frameSeq,
    () => 0,
  );
  void _transportFrameSeq;

  /** Quarters per bar from time sig — keep for drum step columns (beat ↔ column index). */
  const qpb = Math.max(1, Math.round(quartersPerBar + 1e-6));
  /** Quarter steps in one loop — `(loopBars*ticksPerBar)/PPQ`, not `loopBars*round(qpb)` (avoids wrap drift). */
  const patternColsDrums = Math.max(1, Math.round((loopBars * ticksPerBar) / PPQ + 1e-6));
  /** Ruler segments: always `MEASURES_PER_BAR` quarter columns per Creation “bar” (4 clicks = 1 bar). */
  const creationDrumRulerCounts = useMemo(() => {
    const cols = patternColsDrums;
    const step = MEASURES_PER_BAR;
    const out: number[] = [];
    for (let o = 0; o < cols; o += step) {
      out.push(Math.min(step, cols - o));
    }
    return out;
  }, [patternColsDrums]);
  const { notes: sharedNotes, addNote: addSharedNote, removeNote: removeSharedNote } = usePianoNotes();

  const [tab, setTab]               = useState<'drums' | 'grid' | 'piano' | 'mixer'>('drums');
  const [bpmInput, setBpmInput]     = useState(String(bpm));
  const [kit, setKit]               = useState(KITS[0]);
  const [activeBank, setActiveBank] = useState(0);
  const [padChannels, setPadChannels] = useState<number[]>(() => {
    try {
      const s = localStorage.getItem('creationStation_padChannels');
      if (s) {
        const parsed = JSON.parse(s) as unknown;
        if (Array.isArray(parsed) && parsed.length === 16 && parsed.every((x) => typeof x === 'number')) {
          return parsed as number[];
        }
      }
    } catch {
      /* ignore */
    }
    return PAD_NAMES.map((_, i) => i + 1);
  });
  const [subOn, setSubOn]           = useState(false);
  const [rollInstr, setRollInstr]   = useState(0);

  // Sync bpmInput with actual bpm when changed from other sources
  useEffect(() => {
    setBpmInput(String(bpm));
  }, [bpm]);
  const [banks, setBanks]           = useState<Bank[]>(() => {
    const saved = localStorage.getItem('creationStation_banks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((b: any) => ({
          drums: b.drums.map((row: any) => Array.isArray(row) ? row : Array(TOTAL_COLS).fill(false)),
          notes: b.notes || []
        }));
      } catch (e) {
        console.debug('Failed to load banks:', e);
      }
    }
    return BANKS.map(() => ({ drums: emptyDrums(), notes: [] }));
  });

  // Persist banks to localStorage
  useEffect(() => {
    localStorage.setItem('creationStation_banks', JSON.stringify(banks));
  }, [banks]);

  useEffect(() => {
    try {
      localStorage.setItem('creationStation_padChannels', JSON.stringify(padChannels));
    } catch {
      /* ignore */
    }
  }, [padChannels]);

  const [colWidth, setColWidth]     = useState(DEF_CW);
  const [follow, setFollow]         = useState(true);
  const [pianoMode, setPianoMode]   = useState<'notes'|'drums'>('notes');
  const [pianoRegisterShift, setPianoRegisterShift] = useState(0);
  const [pressedPianoKeyRow, setPressedPianoKeyRow] = useState<number | null>(null);
  const [padFlashTicks, setPadFlashTicks] = useState<number[]>(Array(16).fill(0));
  const [subFlashTick, setSubFlashTick] = useState(0);
  const [selectedMixerPad, setSelectedMixerPad] = useState(0);
  const [addEffectOpen, setAddEffectOpen] = useState(false);
  const [drumEffects, setDrumEffects] = useState<Record<number, Effect[]>>(
    Object.fromEntries(Array.from({ length: 17 }, (_, i) => [i + 1, []]))
  );
  const [localMeterBoost, setLocalMeterBoost] = useState<Record<number, number>>({});
  const [padStereoModes, setPadStereoModes] = useState<Record<number, 'stereo' | 'mono'>>({});
  const [subStereoMode, setSubStereoMode] = useState<'stereo' | 'mono'>('mono');
  const [drumPans, setDrumPans] = useState<Record<number, number>>(
    Object.fromEntries(Array.from({ length: 17 }, (_, i) => [i + 1, 0]))
  );
  const [selectedDrumPad, setSelectedDrumPad] = useState<number | null>(null);
  const METER_BOOST_DECAY_STEP = 0.35;
  const METER_BOOST_DECAY_MS = 16;

  /** MPC-style: per-bank pad samples (key `${bank}_${pad}`) — presence drives UI; buffers in ref for playback. */
  const [padSamplePresence, setPadSamplePresence] = useState<Record<string, boolean>>({});
  const padSampleBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const playPadSoundRef = useRef<(pi: number, vel: number, when?: number) => void>(() => {});
  const padChannelsRef = useRef(padChannels);
  const activeBankRef = useRef(activeBank);
  const channelVolumesRef = useRef(channelVolumes);
  const pendingPadSampleRef = useRef<number | null>(null);
  const padSampleFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { padChannelsRef.current = padChannels; }, [padChannels]);
  useEffect(() => { activeBankRef.current = activeBank; }, [activeBank]);
  useEffect(() => { channelVolumesRef.current = channelVolumes; }, [channelVolumes]);

  // Ensure every EQ effect uses the active 12-band parameter layout.
  useEffect(() => {
    setDrumEffects((prev) => {
      let changed = false;
      const next: Record<number, Effect[]> = {};
      for (const k in prev) {
        const fxList = prev[k] || [];
        next[k] = fxList.map((fx) => {
          if (fx.type !== 'EQ') return fx;
          const normalized = normalizeEqParams(fx.params);
          const same =
            fx.params.length === normalized.length &&
            fx.params.every((p, i) => p.label === normalized[i].label && p.value === normalized[i].value);
          if (same) return fx;
          changed = true;
          return { ...fx, params: normalized };
        });
      }
      return changed ? next : prev;
    });
  }, []);

  // Immediate local meter attack for manual taps; fast drop-off.
  useEffect(() => {
    const id = setInterval(() => {
      setLocalMeterBoost(prev => {
        let changed = false;
        const next: Record<number, number> = {};
        for (const k in prev) {
          const d = Math.max(0, prev[k] - METER_BOOST_DECAY_STEP);
          if (d > 0) next[k] = d;
          if (d !== prev[k]) changed = true;
        }
        return changed ? next : prev;
      });
    }, METER_BOOST_DECAY_MS);
    return () => clearInterval(id);
  }, [METER_BOOST_DECAY_MS, METER_BOOST_DECAY_STEP]);

  // Load persisted pad samples (decode once into AudioBuffers).
  useEffect(() => {
    let cancelled = false;
    const store = loadPadSampleStore();
    const keys = Object.keys(store);
    if (keys.length === 0) return;
    const ctx = getOrCreateAudioContext();
    void (async () => {
      const nextPresence: Record<string, boolean> = {};
      for (const k of keys) {
        if (cancelled) return;
        try {
          const st = store[k];
          const ab = storedToArrayBuffer(st);
          const buf = await ctx.decodeAudioData(ab.slice(0));
          if (cancelled) return;
          padSampleBuffersRef.current.set(k, buf);
          nextPresence[k] = true;
        } catch {
          /* skip corrupt entry */
        }
      }
      if (!cancelled) setPadSamplePresence(prev => ({ ...prev, ...nextPresence }));
    })();
    return () => { cancelled = true; };
  }, [getOrCreateAudioContext]);

  // Pad hit + sequencer use this (refs keep scheduler callback stable).
  useEffect(() => {
    const MIN_TRIGGER = 0.02;
    const MIN_AUDIBLE_VELOCITY = 0.12;
    playPadSoundRef.current = (pi: number, vel: number, when?: number) => {
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') {
        void ctx
          .resume()
          .then(() => {
            playPadSoundRef.current(pi, vel, when);
          })
          .catch(() => {
            /* ignore resume failure */
          });
        return;
      }
      const t = when ?? ctx.currentTime;
      const rawVelocity = Math.max(0, Math.min(1, vel / 127));
      if (rawVelocity <= MIN_TRIGGER) return;
      const shapedVelocity = Math.pow(rawVelocity, 0.7);
      const safeVelocity = Math.round(
        Math.max(MIN_AUDIBLE_VELOCITY, Math.min(1, shapedVelocity)) * 127,
      );
      const key = `${activeBankRef.current}_${pi}`;
      const buf = padSampleBuffersRef.current.get(key);
      if (buf) {
        playPadSampleBuffer(
          ctx,
          buf,
          padChannelsRef.current[pi],
          safeVelocity,
          t,
          channelVolumesRef.current,
        );
      } else {
        triggerChannel(padChannelsRef.current[pi], safeVelocity, t);
      }
    };
  }, [triggerChannel, getOrCreateAudioContext]);

  // Shared DAW session: manifest + per-channel sequencer data → Studio tracks/clips (audioTrack === mixer CH).
  useEffect(() => {
    const meta = computeUsedCreationChannelMeta(banks, padChannels, subOn);
    writeCreationChannelManifestToStorage(meta);
    const maxCols = patternColsDrums;
    const payload = {
      bpm,
      drumLoopBars: loopBars,
      measuresPerBar: qpb,
      padChannels,
      activeBank,
      subOn,
      drums: (banks[activeBank]?.drums ?? []).map((row) => row.slice(0, maxCols)),
    };
    try {
      localStorage.setItem(CREATION_STATION_CLIP_DATA_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(DA_SESSION_TRACKS_SYNC_EVENT));
  }, [banks, padChannels, subOn, bpm, loopBars, activeBank, qpb, patternColsDrums]);

  // Re-sync Studio [CS] clips when pad samples load/clear (payload unchanged; Studio reads pad sample store).
  useEffect(() => {
    window.dispatchEvent(new Event(DA_SESSION_TRACKS_SYNC_EVENT));
  }, [padSamplePresence]);

  const drumScrollRef  = useRef<HTMLDivElement>(null);
  const pianoScrollRef = useRef<HTMLDivElement>(null);
  const gridScrollRef  = useRef<HTMLDivElement>(null);
  /** Last BAR/MEASURE/PH while transport runs; frozen when stopped for display-only HUD. */
  const creationHudHoldRef = useRef({ m: 1, b: 1, ph: 1 });

  const isPlaying = transport === 'playing' || transport === 'recording';
  const transportNotStopped = transport !== 'stopped';
  /** Ironclad grid: `AudioContext` + master clock math — no beat “events” / incremental counters. */
  const transportClockLive = isScreenActive && transport !== 'stopped';

  /** Ruler highlight: updates only when isolated HUD changes measure (avoids 60fps full-screen repaints). */
  const _creationRulerPulse = useSyncExternalStore(
    subscribeCreationRulerBeat,
    getCreationRulerSeq,
    () => 0,
  );
  void _creationRulerPulse;

  /**
   * Single source of timing truth: transport external-store wrapped quarter index.
   * Using context `songStep` directly can skip integer steps under React batching.
   */
  const transportBeatIndexLive = getTransportBeatUiSnapshot().wrappedQuarter;

  /**
   * Quarter index of **loopStartTick** — matches `floor(tick / PPQ)`; avoids
   * `(loopStartBar - 1) * round(qpb)` when `ticksPerBar` and PPQ don’t line up with rounded quarters.
   */
  const drumColOffset = Math.floor(loopStartTick / PPQ);

  const creationDrumRulerHeaderLabels = useMemo(() => {
    const labels: number[] = [];
    const base = Math.floor(drumColOffset / qpb);
    let acc = 0;
    for (let i = 0; i < creationDrumRulerCounts.length; i++) {
      labels.push(
        loopStartBar +
          Math.floor((drumColOffset + acc) / qpb) -
          base,
      );
      acc += creationDrumRulerCounts[i]!;
    }
    return labels;
  }, [creationDrumRulerCounts, drumColOffset, qpb, loopStartBar]);

  const drumPatternColToDawBar = useCallback(
    (ci: number) =>
      loopStartBar +
      Math.floor((drumColOffset + ci) / qpb) -
      Math.floor(drumColOffset / qpb),
    [loopStartBar, drumColOffset, qpb],
  );

  /**
   * Relative quarter index for grid + playhead: **integer** (must match lookahead / column).
   */
  const relBeatMonotonic = transportBeatIndexLive - drumColOffset;
  const relColWrapped =
    ((relBeatMonotonic % patternColsDrums) + patternColsDrums) %
    patternColsDrums;

  let activeCol = -1;
  if (transportNotStopped) {
    if (tab === 'piano' || tab === 'mixer') {
      activeCol = transportBeatIndexLive % TOTAL_COLS;
    } else {
      activeCol = relColWrapped;
    }
  }

  /**
   * Global wrapped quarter — BAR (`floor/4)+1`) and MEASURE (`%4+1`) **must** use the same value so
   * each bar runs `1→2→3→4` then advances BAR. Pattern playhead can differ when loop start isn’t mod‑4.
   */
  /**
   * HUD follows the rendered playhead column exactly.
   * If columns look correct, MEASURE/BAR cannot diverge.
   */
  const hudCol = transportNotStopped ? Math.max(0, activeCol) : 0;
  const measureInBarLive = transportNotStopped
    ? (hudCol % MEASURES_PER_BAR) + 1
    : 1;
  const displayBarNumberLive = transportNotStopped
    ? Math.floor(hudCol / MEASURES_PER_BAR) + 1
    : 1;
  const phraseEveryFourMeasuresLive = transportNotStopped
    ? Math.floor(
        (Math.max(1, displayBarNumberLive) - 1) / MEASURES_PER_4BAR_PHRASE,
      ) + 1
    : 1;
  if (transportNotStopped) {
    creationHudHoldRef.current = {
      m: measureInBarLive,
      b: displayBarNumberLive,
      ph: phraseEveryFourMeasuresLive,
    };
  }
  const measureInBarHud = transportNotStopped
    ? measureInBarLive
    : creationHudHoldRef.current.m;
  const displayBarNumberHud = transportNotStopped
    ? displayBarNumberLive
    : creationHudHoldRef.current.b;
  const phraseEveryFourMeasuresHud = transportNotStopped
    ? phraseEveryFourMeasuresLive
    : creationHudHoldRef.current.ph;
  const hudDebugText = `col:${hudCol} m:${measureInBarLive} b:${displayBarNumberLive} s:${songStep}`;

  useEffect(() => {
    if (transportNotStopped) {
      publishCreationRulerBeat(measureInBarLive);
    } else {
      publishCreationRulerBeat(null);
    }
  }, [transportNotStopped, measureInBarLive]);

  const currentDrums = banks[activeBank].drums;
  const currentNotes = banks[activeBank].notes;
  const displayNotes = useMemo(
    () =>
      NOTES.map((n) => {
        const shifted = noteNameToMidi(n) + pianoRegisterShift * 12;
        return midiToNoteName(shifted);
      }),
    [pianoRegisterShift],
  );
  const currentDrumsRef = useRef(currentDrums);
  useEffect(() => { currentDrumsRef.current = currentDrums; }, [currentDrums]);
  const subOnRef = useRef(subOn);
  useEffect(() => { subOnRef.current = subOn; }, [subOn]);
  const nextNoteTimeRef = useRef(0);
  /** Global quarter-note tick — each step uses mapGlobalTickToAudioTime(tick) (hardware-clock style: no +=duration drift). */
  const nextGlobalQuarterTickRef = useRef(0);
  /**
   * Pulse interval driven by a Web Worker so main-thread/UI pauses don’t starve lookahead.
   * Timing still uses `AudioContext.currentTime` + `mapGlobalTickToAudioTime` inside each pulse.
   */
  const SCHEDULER_PULSE_MS = 8;
  const SCHEDULE_AHEAD_TIME = 0.16;

  // Lookahead drum sequencer: `AudioContext` hardware clock; worker only wakes the main thread.
  useEffect(() => {
    if (!isScreenActive || !isPlaying) {
      return;
    }

    const ctx = getOrCreateAudioContext();
    if (ctx.state === 'suspended') void ctx.resume();

    const tickNow = getTickIntAtAudioNow(ctx.currentTime);
    let startTick = Math.ceil(tickNow / PPQ) * PPQ;
    let guard = 0;
    while (mapGlobalTickToAudioTime(startTick) < ctx.currentTime && guard++ < 16) {
      startTick += PPQ;
    }
    nextGlobalQuarterTickRef.current = startTick;
    nextNoteTimeRef.current = mapGlobalTickToAudioTime(startTick);

    const scheduleStep = (when: number, globalTick: number) => {
      const whenSafe = Math.max(when, ctx.currentTime + 0.0015);
      const displayTick = wrapGlobalTickToDisplayTick(globalTick);
      const scheduledBeat = Math.floor(displayTick / PPQ + 1e-9);
      const cols = patternColsDrums;
      const relBeat = scheduledBeat - drumColOffset;
      const colIndex = ((relBeat % cols) + cols) % cols;
      const bankCol = colIndex + drumColOffset;
      currentDrumsRef.current.forEach((row, pi) => {
        if (row[bankCol]) {
          playPadSoundRef.current(pi, PAD_VEL[pi] ?? 90, whenSafe);
        }
      });
      if (subOnRef.current && colIndex % 2 === 1) {
        triggerChannel(SUB_CHANNEL, 127, whenSafe);
      }
    };

    let cancelled = false;

    const schedulerLoop = () => {
      if (cancelled) return;
      const now = ctx.currentTime;
      const horizon = now + SCHEDULE_AHEAD_TIME;
      const recomputedTime = mapGlobalTickToAudioTime(nextGlobalQuarterTickRef.current);
      if (Math.abs(recomputedTime - nextNoteTimeRef.current) > 0.03) {
        const liveTickRealign = getTickIntAtAudioNow(ctx.currentTime);
        let realignTick = Math.ceil(liveTickRealign / PPQ) * PPQ;
        let gg = 0;
        while (mapGlobalTickToAudioTime(realignTick) < ctx.currentTime && gg++ < 16) {
          realignTick += PPQ;
        }
        nextGlobalQuarterTickRef.current = realignTick;
        nextNoteTimeRef.current = mapGlobalTickToAudioTime(realignTick);
      }
      // Main-thread stall recovery: do not leave the cursor behind "now" or we'll burst late hits.
      if (nextNoteTimeRef.current < now - 0.02) {
        let guard = 0;
        while (nextNoteTimeRef.current < now + 0.001 && guard++ < 256) {
          nextGlobalQuarterTickRef.current += PPQ;
          nextNoteTimeRef.current = mapGlobalTickToAudioTime(nextGlobalQuarterTickRef.current);
        }
      }
      while (nextNoteTimeRef.current < horizon) {
        scheduleStep(nextNoteTimeRef.current, nextGlobalQuarterTickRef.current);
        nextGlobalQuarterTickRef.current += PPQ;
        nextNoteTimeRef.current = mapGlobalTickToAudioTime(nextGlobalQuarterTickRef.current);
      }
    };

    const PulseCtor = TransportPulseWorker as unknown as { new (): Worker };
    const pulseWorker = new PulseCtor();
    pulseWorker.postMessage({ cmd: 'start', intervalMs: SCHEDULER_PULSE_MS });
    pulseWorker.onmessage = () => {
      if (cancelled) return;
      schedulerLoop();
    };
    schedulerLoop();

    return () => {
      cancelled = true;
      pulseWorker.postMessage({ cmd: 'stop' });
      pulseWorker.terminate();
    };
  }, [
    getOrCreateAudioContext,
    getTickIntAtAudioNow,
    mapGlobalTickToAudioTime,
    isScreenActive,
    isPlaying,
    loopBars,
    loopEnabled,
    drumColOffset,
    patternColsDrums,
    qpb,
    triggerChannel,
    wrapGlobalTickToDisplayTick,
  ]);

  const prevPlayheadColRef = useRef<number>(-1);
  // Visual flashes follow live transport column (not lookahead-scheduled audio).
  useEffect(() => {
    if (!isPlaying || activeCol < 0) {
      if (!isPlaying) prevPlayheadColRef.current = -1;
      return;
    }
    if (!isScreenActive) return;
    const prev = prevPlayheadColRef.current;
    prevPlayheadColRef.current = activeCol;
    /** When the main thread stalls, `activeCol` can jump forward several steps in one commit — flash every column we skipped. */
    const forwardCatchUp =
      prev >= 0 &&
      activeCol > prev &&
      activeCol - prev <= patternColsDrums;
    const colsToFlash = forwardCatchUp
      ? Array.from({ length: activeCol - prev }, (_, i) => prev + 1 + i)
      : [activeCol];
    setPadFlashTicks((p0) => {
      const next = [...p0];
      for (const ci of colsToFlash) {
        const bankCol = ci + drumColOffset;
        currentDrums.forEach((row, pi) => {
          if (row[bankCol]) next[pi] = next[pi] + 1;
        });
      }
      return next;
    });
    if (subOn) {
      let bumps = 0;
      for (const ci of colsToFlash) {
        if (ci % 2 === 1) bumps++;
      }
      if (bumps > 0) setSubFlashTick((n) => n + bumps);
    }
  }, [
    activeCol,
    currentDrums,
    drumColOffset,
    isPlaying,
    isScreenActive,
    subOn,
    patternColsDrums,
  ]);

  // Auto-scroll
  useEffect(() => {
    if (!follow || !isPlaying || activeCol < 0) return;
    const scroll = (ref: React.RefObject<HTMLDivElement | null>, offset: number) => {
      const el = ref.current; if (!el) return;
      const px    = activeCol * colWidth + offset;
      const left  = el.scrollLeft, right = left + el.clientWidth, m = el.clientWidth * 0.3;
      if (px < left + m || px > right - m) el.scrollLeft = Math.max(0, px - el.clientWidth * 0.35);
    };
    scroll(drumScrollRef, LABEL_W);
    scroll(pianoScrollRef, KEY_W);
  }, [activeCol, colWidth, follow, isPlaying]);

  // Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Bank switches: 1–8
      if (e.key >= '1' && e.key <= '8') {
        setActiveBank(parseInt(e.key) - 1);
        return;
      }
      // Clear current bank: Ctrl+K
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        if (confirm(`Clear bank ${BANKS[activeBank]}?`)) {
          setBanks(prev => prev.map((b, i) => i === activeBank ? { drums: emptyDrums(), notes: [] } : b));
        }
        return;
      }
      // Tab switch: T = drums, G = grid, P = piano, M = mixer
      if (e.ctrlKey) {
        if (e.key === 't') { e.preventDefault(); setTab('drums'); }
        else if (e.key === 'g') { e.preventDefault(); setTab('grid'); }
        else if (e.key === 'p') { e.preventDefault(); setTab('piano'); }
        else if (e.key === 'm') { e.preventDefault(); setTab('mixer'); }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeBank]);

  const zoomIn    = useCallback(() => setColWidth(w => Math.min(MAX_CW, w + ZOOM_STEP)), []);
  const zoomOut   = useCallback(() => setColWidth(w => Math.max(MIN_CW, w - ZOOM_STEP)), []);
  const zoomReset = useCallback(() => setColWidth(DEF_CW), []);

  const clearPadSample = useCallback((padIndex: number) => {
    const k = padSampleKey(activeBank, padIndex);
    padSampleBuffersRef.current.delete(k);
    setPadSamplePresence(prev => {
      const n = { ...prev };
      delete n[k];
      return n;
    });
    const store = loadPadSampleStore();
    delete store[k];
    savePadSampleStore(store);
  }, [activeBank]);

  const beginLoadPadSample = useCallback((padIndex: number) => {
    pendingPadSampleRef.current = padIndex;
    padSampleFileInputRef.current?.click();
  }, []);

  const handlePadSampleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const pad = pendingPadSampleRef.current;
    pendingPadSampleRef.current = null;
    if (pad == null || !file) return;
    const ctx = getOrCreateAudioContext();
    try {
      const stored = await fileToStoredPadSample(file);
      const ab = storedToArrayBuffer(stored);
      const buffer = await ctx.decodeAudioData(ab.slice(0));
      const k = padSampleKey(activeBank, pad);
      padSampleBuffersRef.current.set(k, buffer);
      setPadSamplePresence(prev => ({ ...prev, [k]: true }));
      const store = loadPadSampleStore();
      store[k] = stored;
      savePadSampleStore(store);
    } catch (err) {
      console.debug('Pad sample load failed:', err);
    }
  }, [activeBank, getOrCreateAudioContext]);

  const hasPadSampleForActiveBank = useCallback(
    (padIndex: number) => !!padSamplePresence[padSampleKey(activeBank, padIndex)],
    [padSamplePresence, activeBank],
  );

  function toggleDrum(pad: number, col: number) {
    setBanks(prev => prev.map((b, i) => i !== activeBank ? b : {
      ...b, drums: b.drums.map((row, r) => row.map((v, c) => r === pad && c === col ? !v : v))
    }));
  }
  function toggleNote(row: number, col: number) {
    if (sharedNotes.some(n => n.row === row && n.col === col)) {
      removeSharedNote(row, col);
    } else {
      addSharedNote(row, col);
    }
  }

  // Piano note synthesis — use shared MasterClock AudioContext (same graph as drums/transport).
  const playingOscsRef = useRef(new Map<string, { osc: OscillatorNode; gain: GainNode }>());

  const playPianoNote = useCallback((noteRow: number, duration = 0.5) => {
    try {
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime;
      const midiNote = noteNameToMidi(displayNotes[noteRow] ?? NOTES[noteRow]);
      const freq = midiNoteToFreq(midiNote);
      const key = `${midiNote}`;
      
      // Create oscillator + gain
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      const master = (window as unknown as { __daMusicMasterGain?: GainNode | null })
        .__daMusicMasterGain;
      const dest =
        master && master.context === ctx ? master : ctx.destination;
      gain.connect(dest);
      
      // Instrument selection
      switch (rollInstr) {
        case 0: // Piano
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.02, now + duration);
          break;
        case 1: // Synth
          osc.type = 'triangle';
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
          break;
        case 2: // Bass
          osc.type = 'sawtooth';
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.03, now + duration);
          break;
        case 3: // Lead
          osc.type = 'square';
          gain.gain.setValueAtTime(0.10, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + duration * 0.8);
          break;
      }
      
      osc.frequency.setValueAtTime(freq, now);
      osc.start(now);
      osc.stop(now + duration);
      
      if (playingOscsRef.current) {
        playingOscsRef.current.set(key, { osc, gain });
        setTimeout(() => playingOscsRef.current?.delete(key), duration * 1000);
      }
    } catch (e) {
      console.debug('Piano synth error:', e);
    }
  }, [rollInstr, getOrCreateAudioContext, displayNotes]);

  // Trigger piano notes from Piano Roll during playback.
  useEffect(() => {
    if (!isScreenActive) return;
    if (!isPlaying || activeCol < 0) return;
    if (tab !== 'piano' || pianoMode !== 'notes') return;
    const notesAtCol = sharedNotes.filter(n => n.col === activeCol);
    notesAtCol.forEach(note => playPianoNote(note.row, 0.3));
  }, [activeCol, isPlaying, sharedNotes, playPianoNote, tab, pianoMode, isScreenActive]);

  // Mixer helpers
  function getVolume(chId: number) { return channelVolumes[chId] ?? 80; }
  function getRmsLevel(chId: number) {
    const raw = Math.max(channelLevels[chId] ?? 0, localMeterBoost[chId] ?? 0);
    return Math.min(1, raw * (getVolume(chId) / 100));
  }
  function getPeakLevel(chId: number) {
    return Math.min(1, getRmsLevel(chId) * 1.25);
  }
  function setVolume(chId: number, v: number) { setChannelVolume(chId, v); }
  function setPan(chId: number, v: number) { setDrumPans(prev => ({ ...prev, [chId]: v })); }
  function addEffectToDrum(chId: number, type: string) {
    const params =
      type === 'EQ'
        ? Array.from({ length: 12 }, (_, i) => ({ label: `Band ${i + 1} Gain`, value: 50 }))
        : type === 'Reverb'
          ? [
              { label: 'Dry', value: 62 },
              { label: 'Wet', value: 38 },
              { label: 'Size', value: 62 },
              { label: 'Shape', value: 48 },
              { label: 'Pre-Delay', value: 18 },
              { label: 'Diffusion', value: 70 },
              { label: 'Output', value: 50 },
            ]
          : type === 'Delay'
            ? [
                { label: 'Dry', value: 66 },
                { label: 'Wet', value: 34 },
                { label: 'Time', value: 34 },
                { label: 'Feedback', value: 28 },
                { label: 'Width', value: 56 },
                { label: 'Diffusion', value: 22 },
                { label: 'Output', value: 50 },
              ]
            : type === 'Distortion'
              ? [
                  { label: 'Dry', value: 58 },
                  { label: 'Wet', value: 42 },
                  { label: 'Drive', value: 58 },
                  { label: 'Tone', value: 54 },
                  { label: 'Shape', value: 46 },
                  { label: 'Output', value: 47 },
                ]
              : type === 'Filter'
                ? [
                    { label: 'Dry', value: 60 },
                    { label: 'Wet', value: 40 },
                    { label: 'Cutoff', value: 65 },
                    { label: 'Resonance', value: 28 },
                    { label: 'Drive', value: 20 },
                    { label: 'Output', value: 50 },
                  ]
                : type === 'Compressor'
                  ? [
                      { label: 'Threshold', value: 55 },
                      { label: 'Ratio', value: 35 },
                      { label: 'Attack', value: 20 },
                      { label: 'Release', value: 36 },
                      { label: 'Dry', value: 64 },
                      { label: 'Wet', value: 36 },
                      { label: 'Output', value: 50 },
                    ]
                  : type === 'Chorus'
                    ? [
                        { label: 'Dry', value: 66 },
                        { label: 'Wet', value: 34 },
                        { label: 'Depth', value: 48 },
                        { label: 'Rate', value: 28 },
                        { label: 'Width', value: 64 },
                        { label: 'Shape', value: 45 },
                        { label: 'Output', value: 50 },
                      ]
                    : type === 'Phaser'
                      ? [
                          { label: 'Dry', value: 62 },
                          { label: 'Wet', value: 38 },
                          { label: 'Depth', value: 46 },
                          { label: 'Rate', value: 33 },
                          { label: 'Feedback', value: 30 },
                          { label: 'Width', value: 54 },
                          { label: 'Output', value: 50 },
                        ]
                      : [{ label: 'Mix', value: 50 }, { label: 'Amount', value: 40 }, { label: 'Time', value: 30 }];
    setDrumEffects(prev => ({
      ...prev,
      [chId]: [...(prev[chId] || []), { type, enabled: true, params }]
    }));
    setAddEffectOpen(false);
  }
  function removeEffectFromDrum(chId: number, ei: number) {
    setDrumEffects(prev => ({
      ...prev,
      [chId]: (prev[chId] || []).filter((_, i) => i !== ei)
    }));
  }
  function toggleEffectOnDrum(chId: number, ei: number) {
    setDrumEffects(prev => ({
      ...prev,
      [chId]: (prev[chId] || []).map((e, i) => i === ei ? { ...e, enabled: !e.enabled } : e)
    }));
  }
  function setDrumEffectParam(chId: number, ei: number, pi: number, v: number) {
    setDrumEffects(prev => ({
      ...prev,
      [chId]: (prev[chId] || []).map((e, i) => i !== ei ? e : { ...e, params: e.params.map((p, j) => j !== pi ? p : { ...p, value: v }) })
    }));
  }

  const hasDrums = (i: number) => banks[i].drums.some(r => r.some(Boolean));
  const hasNotes = (i: number) => banks[i].notes.length > 0;
  const drumGridColW = Math.max(colWidth, DRUM_GRID_MIN_CW);
  const pianoGridColW = Math.max(colWidth, PIANO_GRID_MIN_CW);
  const drumGridW = patternColsDrums * drumGridColW;
  const selectedLoopLength = loopEndBar - loopStartBar + 1;
  const totalW   = TOTAL_COLS * pianoGridColW;
  const pianoLoopEndBar = loopStartBar + loopBars - 1;
  const pianoVisLoopStart = Math.max(1, loopStartBar);
  const pianoVisLoopEnd = Math.min(TOTAL_BARS, pianoLoopEndBar);
  const pianoLoopRegionOk = loopEnabled && pianoVisLoopEnd >= pianoVisLoopStart;
  const pianoLoopLeftPx = (pianoVisLoopStart - 1) * MEASURES_PER_BAR * pianoGridColW;
  const pianoLoopWidthPx = (pianoVisLoopEnd - pianoVisLoopStart + 1) * MEASURES_PER_BAR * pianoGridColW;
  const pianoRollLoopGridH =
    (pianoMode === 'notes' ? displayNotes.length : 1) * (pianoMode === 'drums' ? DRUM_GRID_ROW_H : ROW_H);
  const selCh = padChannels[selectedMixerPad];
  const selChEffects = drumEffects[selCh] || [];
  // Visual sensitivity curve: emphasize active audio, keep idle motion calm.
  const effectSignalRaw = Math.max(0, Math.min(1, getRmsLevel(selCh)));
  const effectSignal = Math.min(1, Math.pow(effectSignalRaw, 0.75) * 1.25);
  const activeDrumPadIndex = selectedDrumPad ?? 0;
  /** Sourced from {@link CreationTransportHud} via {@link publishCreationRulerBeat} — integer change only. */
  const rulerCreationBeatHighlight = creationRulerBeatHighlight;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#050505', color: '#ccc', overflow: 'hidden' }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#080808', borderBottom: '1px solid #1a1a1a', flexShrink: 0, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

          <CreationTransportHud
            transportNotStopped={transportNotStopped}
            qpb={qpb}
            measureInBar={measureInBarHud}
            displayBarNumber={displayBarNumberHud}
            phraseEveryFourMeasures={phraseEveryFourMeasuresHud}
            debugText={hudDebugText}
          />

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 6px' }} title="Pads route to mixer CH1–CH17 — same rows as Studio when synced">
            <span style={{ fontSize: 8, color: '#555', fontFamily: 'monospace', letterSpacing: 0.5 }}>SESSION</span>
            <span style={{ fontSize: 9, color: '#666', fontFamily: 'monospace', fontWeight: 700 }}>CH1–CH17</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px' }}>
              <Zap size={11} style={{ color: '#ffcc00' }} />
              <input 
                type="text"
                inputMode="numeric"
                value={bpmInput} 
                onChange={e => setBpmInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const num = Number(bpmInput);
                    if (!isNaN(num) && num >= 20 && num <= 300) {
                      setBpm(num);
                      e.currentTarget.blur();
                    }
                  } else if (e.key === 'Escape') {
                    setBpmInput(String(bpm));
                    e.currentTarget.blur();
                  }
                }}
                onBlur={() => {
                  const num = Number(bpmInput);
                  if (isNaN(num) || num < 40 || num > 240) {
                    setBpmInput(String(bpm));
                  } else {
                    setBpm(num);
                  }
                }}
                onFocus={e => e.currentTarget.select()}
                style={{ 
                  width: 50, 
                  background: 'transparent', 
                  border: 'none', 
                  color: '#ffcc00', 
                  fontSize: 13, 
                  fontFamily: 'monospace', 
                  fontWeight: 'bold', 
                  outline: 'none',
                  textAlign: 'center'
                }} 
                title="Type tempo (40-240), press Enter"
              />
              <span style={{ fontSize: 9, color: '#666' }}>BPM</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderLeft: '1px solid #2a2a2a' }}>
              <button onClick={() => setBpm(Math.min(240, bpm + 1))} style={{ flex: 1, padding: '0 6px', border: 'none', background: '#111', color: '#ffcc00', cursor: 'pointer', fontSize: 10, fontWeight: 'bold', transition: 'all 0.1s' }}><ChevronUp size={13} /></button>
              <button onClick={() => setBpm(Math.max(40, bpm - 1))} style={{ flex: 1, padding: '0 6px', border: 'none', background: '#0a0a0a', color: '#ffcc00', cursor: 'pointer', fontSize: 10, fontWeight: 'bold', transition: 'all 0.1s', borderTop: '1px solid #2a2a2a' }}><ChevronDown size={13} /></button>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              minWidth: 140,
              padding: '2px 6px',
              background: '#0a0a0a',
              border: '1px solid #2a2a2a',
              borderRadius: 4,
            }}
            title="Metronome click scheduling only (+ = later). Transport & grid use the true audio clock."
          >
            <label style={{ fontSize: 8, color: '#666', fontFamily: 'monospace' }}>
              CLICK ms{' '}
              <span style={{ color: metronomeClickLatencyMs !== 0 ? '#a78bfa' : '#555' }}>
                {metronomeClickLatencyMs > 0 ? `+${metronomeClickLatencyMs}` : metronomeClickLatencyMs}
              </span>
            </label>
            <input
              type="range"
              min={-500}
              max={500}
              step={1}
              value={metronomeClickLatencyMs}
              onChange={(e) => setMetronomeClickLatencyMs(Number(e.target.value))}
              style={{ width: '100%', height: 28, cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={syncMetronomeClickLatencyFromOutput}
                style={{
                  flex: 1,
                  padding: '3px 6px',
                  fontSize: 9,
                  fontFamily: 'monospace',
                  border: '1px solid #333',
                  borderRadius: 3,
                  background: '#111',
                  color: '#aaa',
                  cursor: 'pointer',
                }}
              >
                Auto out
              </button>
              <button
                type="button"
                onClick={() => setMetronomeClickLatencyMs(0)}
                style={{
                  padding: '3px 8px',
                  fontSize: 9,
                  fontFamily: 'monospace',
                  border: '1px solid #333',
                  borderRadius: 3,
                  background: '#111',
                  color: '#888',
                  cursor: 'pointer',
                }}
              >
                0
              </button>
            </div>
          </div>

          {/* Zoom */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 4, overflow: 'hidden' }}>
            <button onClick={zoomOut} style={{ padding: '3px 7px', background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><ZoomOut size={11} /></button>
            <span style={{ padding: '0 6px', fontFamily: 'monospace', fontSize: 10, color: '#444', borderLeft: '1px solid #2a2a2a', borderRight: '1px solid #2a2a2a' }}>{colWidth}px</span>
            <input
              type="range"
              min={MIN_CW}
              max={MAX_CW}
              step={1}
              value={colWidth}
              onChange={(e) => setColWidth(Number(e.target.value))}
              style={{ width: 92, height: 4, margin: '0 6px', accentColor: '#00E5FF', cursor: 'ew-resize' }}
              title="Drag to zoom grid in/out"
            />
            <button onClick={zoomIn} style={{ padding: '3px 7px', background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><ZoomIn size={11} /></button>
            <button onClick={zoomReset} style={{ padding: '3px 7px', background: 'none', border: 'none', color: '#666', cursor: 'pointer', borderLeft: '1px solid #2a2a2a' }}><Maximize2 size={11} /></button>
          </div>

          {/* Follow */}
          <button onClick={() => setFollow(p => !p)} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: 'monospace', background: follow ? '#00E5FF18' : '#111', color: follow ? '#00E5FF' : '#444', border: `1px solid ${follow ? '#00E5FF44' : '#2a2a2a'}`, cursor: 'pointer' }}>
            ⊳ FOLLOW
          </button>

          {/* Drum loop selector (shared by Drums + 16-BAR GRID sequencer views) */}
          {(tab === 'drums' || tab === 'grid') && (
            <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: '#666', fontWeight: 700 }}>
                {tab === 'grid' ? 'DRUM LOOP' : 'LOOP'}
              </span>
              {[4, 8, 12, 16].map(bars => (
                <button
                  key={bars}
                  onClick={() =>
                    setLoopRange(loopStartBar, loopStartBar + bars - 1, loopSection ?? undefined)
                  }
                  style={{
                    width: 28,
                    height: 24,
                    borderRadius: 4,
                    fontSize: 9,
                    fontWeight: 900,
                    background: selectedLoopLength === bars ? '#00ff88' : '#111',
                    color: selectedLoopLength === bars ? '#000' : '#555',
                    border: `1px solid ${selectedLoopLength === bars ? '#00ff88' : '#333'}`,
                    cursor: 'pointer',
                  }}
                >
                  {bars}
                </button>
              ))}
            </div>
          )}

          {/* Banks */}
          <BankButtons activeBank={activeBank} setActiveBank={setActiveBank} hasDrums={hasDrums} hasNotes={hasNotes} />

          <select value={kit} onChange={e => setKit(e.target.value)} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: '#111', color: '#888', border: '1px solid #333', outline: 'none' }}>
            {KITS.map(k => <option key={k}>{k}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onExport('studio-editor')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#1a1a2a', color: '#00E5FF', border: '1px solid #00E5FF44', cursor: 'pointer' }}>
            <Send size={9} /> Studio
          </button>
          <button onClick={() => onExport('master-arranger')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#1a1a1a', color: '#D500F9', border: '1px solid #D500F944', cursor: 'pointer' }}>
            <Send size={9} /> Arrange
          </button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #1a1a1a', flexShrink: 0, background: '#080808' }}>
        {(['drums','grid','piano','mixer'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 16px', fontSize: 11, fontWeight: 700, background: tab === t ? '#111' : 'transparent', color: tab === t ? (t === 'mixer' ? '#00E5FF' : t === 'grid' ? '#00ff88' : '#D500F9') : '#444', borderBottom: tab === t ? `2px solid ${t === 'mixer' ? '#00E5FF' : t === 'grid' ? '#00ff88' : '#D500F9'}` : '2px solid transparent', border: 'none', cursor: 'pointer' }}>
            {t === 'drums' ? '🥁 DRUMS' : t === 'grid' ? '⊞ 16-BAR GRID' : t === 'piano' ? '🎹 PIANO ROLL' : '🎚️ MIXER'}
          </button>
        ))}
      </div>

      {/* ── DRUMS TAB ── */}
      {tab === 'drums' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <input
            ref={padSampleFileInputRef}
            type="file"
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={handlePadSampleFile}
          />
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  background: '#0a0a0a',
                  borderBottom: '1px solid #1a1a1a',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 800, color: '#00ff88' }}>
                  DRUM LOOP
                </span>
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#666' }}>
                  {selectedLoopLength} BARS
                </span>
              </div>
              <PadSection
                padChannels={padChannels}
                padFlashTicks={padFlashTicks}
                subFlashTick={subFlashTick}
                subOn={subOn}
                onHitPad={i => {
                  const chId = padChannels[i];
                  const velNorm = Math.min(1, (PAD_VEL[i] ?? 90) / 127);
                  // Trigger audio first on pointer-down path; UI updates can follow.
                  playPadSoundRef.current(i, PAD_VEL[i] ?? 90);
                  flushSync(() => {
                    setLocalMeterBoost(prev => ({ ...prev, [chId]: Math.max(prev[chId] ?? 0, velNorm) }));
                  });
                  // Keep manual tap path local-only for immediate UI feedback.
                }}
                onChannelChange={(i, ch) => setPadChannels(prev => prev.map((c, idx) => idx === i ? ch : c))}
                onSubToggle={() => {
                  triggerChannel(SUB_CHANNEL, 127);
                  setSubOn(p => !p);
                  flushSync(() => {
                    setLocalMeterBoost(prev => ({ ...prev, [SUB_CHANNEL]: Math.max(prev[SUB_CHANNEL] ?? 0, 1) }));
                  });
                  setSubFlashTick((n) => n + 1);
                }}
                hasPadSample={hasPadSampleForActiveBank}
                onLoadPadSample={beginLoadPadSample}
                onClearPadSample={clearPadSample}
              />

              {/* Grid editor for selected drum pad */}
              {selectedDrumPad !== null && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderTop: '2px solid #1a1a1a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: PAD_COLORS[selectedDrumPad] }}>
                      {PAD_NAMES[selectedDrumPad]} — Grid Editor
                    </span>
                    <button
                      onClick={() => setSelectedDrumPad(null)}
                      style={{ marginLeft: 'auto', padding: '2px 6px', borderRadius: 3, fontSize: 9, background: '#1a1a1a', color: '#666', border: '1px solid #333', cursor: 'pointer' }}
                    >
                      Close
                    </button>
                  </div>
                  <div ref={gridScrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
                    <div style={{ width: drumGridW + LABEL_W, minWidth: drumGridW + LABEL_W }}>
                      <div style={{ display: 'flex', paddingLeft: LABEL_W }}>
                        <div style={{ position: 'relative', width: drumGridW, flexShrink: 0 }}>
                          <Ruler
                            activeCol={activeCol}
                            colWidth={drumGridColW}
                            barNumberStart={loopStartBar}
                            stepsPerBar={MEASURES_PER_BAR}
                            barStepCounts={creationDrumRulerCounts}
                            segmentHeaderLabels={creationDrumRulerHeaderLabels}
                            patternColToDawBar={drumPatternColToDawBar}
                            creationBeatHighlight={rulerCreationBeatHighlight}
                            onRangeCommit={(s, e) =>
                              setLoopRange(s, e, loopSection ?? undefined)
                            }
                          />
                          <LoopMarkersBrace
                            visible={loopEnabled}
                            leftPx={0}
                            widthPx={drumGridW}
                            height={28}
                            variant="dark"
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', height: DRUM_GRID_ROW_H }}>
                        <div style={{ width: LABEL_W, flexShrink: 0, color: PAD_COLORS[selectedDrumPad], fontSize: 11, fontWeight: 800, paddingRight: 4, textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                          {PAD_NAMES[selectedDrumPad]}
                        </div>
                        <div style={{ position: 'relative', display: 'flex', width: drumGridW, height: DRUM_GRID_ROW_H }}>
                          {Array.from({ length: patternColsDrums }, (_, ci) => {
                            const bankCol = ci + drumColOffset;
                            const color = barColor(Math.floor(ci / MEASURES_PER_BAR));
                            const on = currentDrums[selectedDrumPad]?.[bankCol] ?? false;
                            const isHead = activeCol === ci;
                            return (
                              <button
                                key={ci}
                                onClick={() => toggleDrum(selectedDrumPad, bankCol)}
                                style={{
                                  width: drumGridColW,
                                  flexShrink: 0,
                                  height: DRUM_GRID_ROW_H,
                                  background: on ? PAD_COLORS[selectedDrumPad] : isHead ? `${color}33` : ci % (MEASURES_PER_BAR * 4) === 0 ? '#111' : ci % MEASURES_PER_BAR === 0 ? '#101010' : '#0e0e0e',
                                  borderLeft: `1px solid ${ci % (MEASURES_PER_BAR * 4) === 0 ? '#2a2a2a' : ci % MEASURES_PER_BAR === 0 ? '#1e1e1e' : '#141414'}`,
                                  borderTop: 'none',
                                  borderRight: 'none',
                                  borderBottom: 'none',
                                  boxShadow: isHead && on ? `0 0 6px ${PAD_COLORS[selectedDrumPad]}` : 'none',
                                  cursor: 'pointer',
                                  position: 'relative',
                                  zIndex: 1,
                                  // No transition on playhead column — must snap with measure counter (same transport beat).
                                  transition: isHead ? 'none' : 'background 0.04s',
                                }}
                              />
                            );
                          })}
                          <LoopVerticalGuides
                            visible={loopEnabled}
                            leftPx={0}
                            widthPx={drumGridW}
                            height={DRUM_GRID_ROW_H}
                            zIndex={12}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mixer panel anchored at bottom */}
          <div style={{ borderTop: '1px solid #1a1a1a', background: '#080808', flexShrink: 0, display: 'flex', flexDirection: 'column', height: '340px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#00E5FF' }}>🎚️ MIXER — Live Metering</span>
            </div>
            <div style={{ display: 'flex', overflowX: 'auto', height: 320, background: '#050505' }}>
              {PAD_NAMES.map((padName, pi) => {
                const chId = padChannels[pi];
                const vol = channelVolumes[chId] ?? 80;
                const rawLevel = Math.max(channelLevels[chId] ?? 0, localMeterBoost[chId] ?? 0);
                const rmsLevel = Math.min(1, rawLevel * (vol / 100));
                const peakLevel = Math.min(1, rmsLevel * 1.25);
                const pan = drumPans[chId] ?? 0;
                const panNorm = Math.max(-1, Math.min(1, pan / 100));
                const stereoMode = padStereoModes[pi] ?? 'stereo';
                const leftLevel = Math.min(1, rmsLevel * (panNorm > 0 ? 1 - panNorm : 1));
                const rightLevel = Math.min(1, rmsLevel * (panNorm < 0 ? 1 + panNorm : 1));
                const dbLevel = rmsLevel > 0 ? (20 * Math.log10(rmsLevel)) : -60;
                const clipping = dbLevel > 0;

                return (
                  <div key={pi} style={{ display: 'flex', flexDirection: 'column', width: 80, flexShrink: 0, padding: '8px', borderRight: '1px solid #1a1a1a', gap: '6px' }}>
                    {/* Pad name */}
                    <div style={{ fontSize: 8, fontWeight: 700, color: PAD_COLORS[pi], textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {padName}
                    </div>

                    {/* LED Meter */}
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 4, minHeight: 80, background: '#000', borderRadius: 3, padding: '4px 3px', border: '1px solid #1a1a1a' }}>
                      {(stereoMode === 'stereo' ? [leftLevel, rightLevel] : [rmsLevel]).map((level, meterIdx) => (
                        <div key={meterIdx} style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', justifyContent: 'flex-end', gap: '1px' }}>
                          {Array.from({ length: 12 }, (_, i) => {
                            const threshold = i / 12;
                            const isLit = level > threshold;
                            const ledColor = clipping && i > 10 ? '#ff3333' : isLit ? (i > 9 ? '#ffaa00' : i > 6 ? '#00ff88' : PAD_COLORS[pi]) : '#0a0a0a';
                            return (
                              <div
                                key={i}
                                style={{
                                  height: '100%',
                                  borderRadius: 2,
                                  background: ledColor,
                                  boxShadow: isLit ? `0 0 4px ${ledColor}` : 'none',
                              transition: 'none'
                                }}
                              />
                            );
                          })}
                          <div style={{ fontSize: 7, textAlign: 'center', color: '#666', fontFamily: 'monospace', marginTop: 2 }}>
                            {stereoMode === 'stereo' ? (meterIdx === 0 ? 'L' : 'R') : 'M'}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* dB display */}
                    <div style={{ fontSize: 7, textAlign: 'center', color: clipping ? '#ff3333' : '#888', fontFamily: 'monospace', fontWeight: 700 }}>
                      {dbLevel.toFixed(1)} dB
                    </div>

                    {/* Stereo / Mono */}
                    <button
                      type="button"
                      onClick={() => setPadStereoModes(prev => ({ ...prev, [pi]: (prev[pi] ?? 'stereo') === 'stereo' ? 'mono' : 'stereo' }))}
                      style={{ width: '100%', padding: '3px 0', borderRadius: 3, background: stereoMode === 'stereo' ? '#1a1a1a' : '#111', color: stereoMode === 'stereo' ? '#00E5FF' : '#ffcc00', border: `1px solid ${stereoMode === 'stereo' ? '#00E5FF44' : '#ffcc0044'}`, cursor: 'pointer', fontSize: 7, fontWeight: 800, fontFamily: 'monospace' }}
                      title="Toggle stereo/mono meter mode"
                    >
                      {stereoMode === 'stereo' ? 'STEREO' : 'MONO'}
                    </button>

                    {/* Volume fader */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={vol}
                        onChange={e => setChannelVolume(chId, Number(e.target.value))}
                        style={{ width: '100%', height: 3, accentColor: PAD_COLORS[pi], cursor: 'pointer' }}
                      />
                      <div style={{ fontSize: 7, textAlign: 'center', color: '#666', fontFamily: 'monospace' }}>
                        {vol}%
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* SUB BASS */}
              <div style={{ display: 'flex', flexDirection: 'column', width: 80, flexShrink: 0, padding: '8px', borderRight: '1px solid #1a1a1a', gap: '6px' }}>
                {(() => {
                  const subLevel = Math.min(1, Math.max(channelLevels[SUB_CHANNEL] ?? 0, localMeterBoost[SUB_CHANNEL] ?? 0) * 0.8);
                  const subPan = drumPans[SUB_CHANNEL] ?? 0;
                  const subPanNorm = Math.max(-1, Math.min(1, subPan / 100));
                  const subLeft = Math.min(1, subLevel * (subPanNorm > 0 ? 1 - subPanNorm : 1));
                  const subRight = Math.min(1, subLevel * (subPanNorm < 0 ? 1 + subPanNorm : 1));
                  return (
                    <>
                <div style={{ fontSize: 8, fontWeight: 700, color: '#D500F9', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  SUB BASS
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 4, minHeight: 80, background: '#000', borderRadius: 3, padding: '4px 3px', border: '1px solid #1a1a1a' }}>
                  {(subStereoMode === 'stereo' ? [subLeft, subRight] : [subLevel]).map((level, meterIdx) => (
                    <div key={meterIdx} style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', justifyContent: 'flex-end', gap: '1px' }}>
                      {Array.from({ length: 12 }, (_, i) => {
                        const threshold = i / 12;
                        const isLit = level > threshold;
                        return (
                          <div
                            key={i}
                            style={{
                              height: '100%',
                              borderRadius: 2,
                              background: isLit ? (i > 9 ? '#ffaa00' : '#D500F9') : '#0a0a0a',
                              boxShadow: isLit ? `0 0 4px ${i > 9 ? '#ffaa00' : '#D500F9'}` : 'none',
                          transition: 'none'
                            }}
                          />
                        );
                      })}
                      <div style={{ fontSize: 7, textAlign: 'center', color: '#666', fontFamily: 'monospace', marginTop: 2 }}>
                        {subStereoMode === 'stereo' ? (meterIdx === 0 ? 'L' : 'R') : 'M'}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 7, textAlign: 'center', color: '#888', fontFamily: 'monospace', fontWeight: 700 }}>
                  {subLevel.toFixed(2)}
                </div>
                <button
                  type="button"
                  onClick={() => setSubStereoMode((m) => (m === 'stereo' ? 'mono' : 'stereo'))}
                  style={{ width: '100%', padding: '3px 0', borderRadius: 3, background: subStereoMode === 'stereo' ? '#1a1a1a' : '#111', color: subStereoMode === 'stereo' ? '#00E5FF' : '#ffcc00', border: `1px solid ${subStereoMode === 'stereo' ? '#00E5FF44' : '#ffcc0044'}`, cursor: 'pointer', fontSize: 7, fontWeight: 800, fontFamily: 'monospace' }}
                  title="Toggle stereo/mono meter mode"
                >
                  {subStereoMode === 'stereo' ? 'STEREO' : 'MONO'}
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={channelVolumes[SUB_CHANNEL] ?? 80}
                    onChange={e => setChannelVolume(SUB_CHANNEL, Number(e.target.value))}
                    style={{ width: '100%', height: 3, accentColor: '#D500F9', cursor: 'pointer' }}
                  />
                  <div style={{ fontSize: 7, textAlign: 'center', color: '#666', fontFamily: 'monospace' }}>
                    {channelVolumes[SUB_CHANNEL] ?? 80}%
                  </div>
                </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 16-BAR GRID TAB (16 BARS ONLY WITH TRACK ALIGNMENT) ── */}
      {tab === 'grid' && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0, background: '#050505' }}>
          {/* LEFT: Track labels (sync with grid rows) */}
          <div style={{ width: LABEL_W, flexShrink: 0, background: '#0a0a0a', borderRight: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ height: 28, flexShrink: 0, borderBottom: '1px solid #1e1e1e', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#666' }}>
              TRACKS
            </div>
            {PAD_NAMES.map((name, pi) => (
              <div
                key={pi}
                onClick={() => setSelectedDrumPad(pi)}
                style={{
                  height: DRUM_GRID_ROW_H,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  paddingRight: 6,
                  textAlign: 'right',
                  borderTop: '1px solid #000',
                  borderBottom: '1px solid #1f3a4a',
                  background: pi === selectedDrumPad ? `${PAD_COLORS[pi]}28` : drumLaneBg(pi),
                  borderLeft: pi === selectedDrumPad ? `3px solid ${PAD_COLORS[pi]}` : '3px solid transparent',
                  boxShadow: pi === selectedDrumPad ? `inset 0 0 0 1px ${PAD_COLORS[pi]}99` : 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: PAD_COLORS[pi], fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                  {name}
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT: drum grid aligned with tracks — width/loop from shared MasterClock loop state */}
          <div ref={drumScrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', background: '#050505' }}>
            <div style={{ width: drumGridW, minWidth: drumGridW, position: 'relative' }}>
              <div style={{ position: 'relative', display: 'flex', height: 28, borderBottom: '1px solid #1e1e1e', background: '#0a0a0a' }}>
                <Ruler
                  activeCol={activeCol}
                  colWidth={drumGridColW}
                  barNumberStart={loopStartBar}
                  onRangeCommit={(s, e) =>
                    setLoopRange(s, e, loopSection ?? undefined)
                  }
                  stepsPerBar={MEASURES_PER_BAR}
                  barStepCounts={creationDrumRulerCounts}
                  segmentHeaderLabels={creationDrumRulerHeaderLabels}
                  patternColToDawBar={drumPatternColToDawBar}
                  creationBeatHighlight={rulerCreationBeatHighlight}
                />
                <LoopMarkersBrace
                  visible={loopEnabled}
                  leftPx={0}
                  widthPx={drumGridW}
                  height={28}
                  variant="dark"
                />
              </div>
              {PAD_NAMES.map((name, pi) => (
                <div
                  key={pi}
                  style={{
                    display: 'flex',
                    height: DRUM_GRID_ROW_H,
                    alignItems: 'stretch',
                    borderTop: '1px solid #000',
                    borderBottom: '1px solid #1f3a4a',
                    background: pi === selectedDrumPad ? `${PAD_COLORS[pi]}16` : drumLaneBg(pi),
                    cursor: 'pointer',
                    boxShadow: pi === selectedDrumPad ? `inset 0 0 0 1px ${PAD_COLORS[pi]}99` : 'none',
                    position: 'relative',
                    zIndex: 1,
                  }}
                  onClick={() => setSelectedDrumPad(pi)}
                >
                  {Array.from({ length: patternColsDrums }, (_, ci) => {
                    const bankCol = ci + drumColOffset;
                    const on     = currentDrums[pi]?.[bankCol] ?? false;
                    const isHead = activeCol === ci;
                    return (
                      <button
                        key={ci}
                        onClick={(e) => { e.stopPropagation(); toggleDrum(pi, bankCol); }}
                        style={{
                          width: drumGridColW,
                          flexShrink: 0,
                          height: DRUM_GRID_ROW_H,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: drumStepBg(ci, pi, isHead),
                          borderLeft: `1px solid ${ci % (MEASURES_PER_BAR * 4) === 0 ? '#7ba5bf' : ci % MEASURES_PER_BAR === 0 ? '#5e88a3' : '#3f6278'}`,
                          borderTop: 'none',
                          borderRight: 'none',
                          borderBottom: '1px solid #000',
                          boxShadow: isHead && on ? '0 0 10px #b8f5c599' : 'none',
                          cursor: 'pointer',
                          transition: isHead ? 'none' : 'background 0.04s',
                          padding: 0,
                        }}
                      >
                        {on && (
                          <div
                            style={{
                              width: Math.max(12, Math.floor(drumGridColW * 0.78)),
                              height: Math.floor(DRUM_GRID_ROW_H * 0.84),
                              borderRadius: 1,
                              background: '#b8f5c5',
                              border: '1px solid #dbffe2',
                              boxShadow: '0 0 8px #b8f5c5aa',
                            }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
              <LoopVerticalGuides
                visible={loopEnabled}
                leftPx={0}
                widthPx={drumGridW}
                height={PAD_NAMES.length * DRUM_GRID_ROW_H}
                topPx={28}
                zIndex={12}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── PIANO ROLL TAB ── */}
      {tab === 'piano' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Sub-tab + instruments */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', flexShrink: 0, background: '#080808', borderBottom: '1px solid #1a1a1a' }}>
            {(['notes','drums'] as const).map(st => (
              <button key={st} onClick={() => setPianoMode(st)} style={{ padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: pianoMode===st ? '#D500F9' : '#111', color: pianoMode===st ? '#000' : '#555', border: 'none', cursor: 'pointer' }}>
                {st === 'notes' ? '🎵 Notes' : '🥁 Drums'}
              </button>
            ))}
            {pianoMode === 'notes' && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 6 }}>
                  <button
                    onClick={() => setPianoRegisterShift((v) => Math.max(-2, v - 1))}
                    style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#111', color: '#aaa', border: '1px solid #333', cursor: 'pointer' }}
                  >
                    OCT-
                  </button>
                  <span style={{ fontSize: 9, color: '#888', fontFamily: 'monospace', minWidth: 44, textAlign: 'center' }}>
                    {pianoRegisterShift >= 0 ? `+${pianoRegisterShift}` : pianoRegisterShift}
                  </span>
                  <button
                    onClick={() => setPianoRegisterShift((v) => Math.min(2, v + 1))}
                    style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#111', color: '#aaa', border: '1px solid #333', cursor: 'pointer' }}
                  >
                    OCT+
                  </button>
                </div>
                {INSTRUMENTS.map((ins, i) => (
                  <button key={ins} onClick={() => setRollInstr(i)} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: rollInstr===i ? '#00E5FF' : '#111', color: rollInstr===i ? '#000' : '#555', border: `1px solid ${rollInstr===i ? '#00E5FF' : '#333'}`, cursor: 'pointer' }}>
                    {ins}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Piano roll */}
          <div style={{ flex: '1 1 0%', display: 'flex', overflow: 'hidden', minHeight: 0, borderTop: '2px solid #1a1a1a' }}>
            {/* Fixed keys */}
            <div style={{ width: KEY_W, flexShrink: 0, background: '#0c141a', borderRight: '1px solid #213646', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 28, flexShrink: 0, borderBottom: '1px solid #1e1e1e', background: '#050505' }} />
              <div style={{ overflowY: 'hidden', flex: 1 }}>
                {(pianoMode === 'notes' ? displayNotes : [PAD_NAMES[activeDrumPadIndex]]).map((label, ri) => {
                  const padIndex = pianoMode === 'drums' ? activeDrumPadIndex : ri;
                  if (pianoMode === 'drums') {
                    return (
                      <div
                        key={ri}
                        style={{
                          height: DRUM_GRID_ROW_H,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          paddingRight: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          color: PAD_COLORS[padIndex] ?? '#aeb7be',
                          background: drumLaneBg(padIndex),
                          borderBottom: '1px solid #1f3a4a',
                          flexShrink: 0,
                        }}
                      >
                        {label}
                      </div>
                    );
                  }
                  const isBlack = label.includes('#');
                  return (
                    <div
                      key={ri}
                      onPointerDown={() => {
                        if (pianoMode === 'notes') setPressedPianoKeyRow(ri);
                      }}
                      onPointerUp={() => setPressedPianoKeyRow((v) => (v === ri ? null : v))}
                      onPointerLeave={() => setPressedPianoKeyRow((v) => (v === ri ? null : v))}
                      onClick={() => {
                        if (pianoMode === 'notes') playPianoNote(ri, 0.35);
                      }}
                      style={{
                        height: ROW_H,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isBlack ? 'flex-end' : 'space-between',
                        paddingRight: 5,
                        paddingLeft: 6,
                        fontSize: 9,
                        fontFamily: 'monospace',
                        color: isBlack ? '#aeb7be' : '#2c3136',
                        background: isBlack
                          ? pressedPianoKeyRow === ri ? '#161b1f' : '#1f2429'
                          : pressedPianoKeyRow === ri ? '#b8c2cb' : '#d6dce1',
                        borderBottom: '1px solid #2b3c48',
                        flexShrink: 0,
                        boxShadow: isBlack
                          ? pressedPianoKeyRow === ri
                            ? 'inset 0 2px 0 #0f1316, inset 0 -1px 0 #0b0f12'
                            : 'inset 0 -1px 0 #14191d'
                          : pressedPianoKeyRow === ri
                            ? 'inset 0 2px 0 #9ea8b2, inset 0 -1px 0 #8a949e'
                            : 'inset 0 -1px 0 #bcc6ce',
                        cursor: 'pointer',
                        transform: pressedPianoKeyRow === ri ? 'translateX(2px) scaleX(0.98)' : 'translateX(0) scaleX(1)',
                        transition: 'transform 0.06s ease, background 0.06s ease, box-shadow 0.06s ease',
                      }}
                    >
                      
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Note grid */}
            <div ref={pianoScrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
              <div style={{ width: totalW, minWidth: totalW, position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  <Ruler
                    activeCol={activeCol}
                    colWidth={pianoGridColW}
                    maxBars={CREATION_PIANO_BARS}
                    stepsPerBar={MEASURES_PER_BAR}
                    barStepCounts={PIANO_RULER_BAR_STEP_COUNTS}
                    creationBeatHighlight={rulerCreationBeatHighlight}
                  />
                  <LoopMarkersBrace
                    visible={pianoLoopRegionOk}
                    leftPx={pianoLoopLeftPx}
                    widthPx={pianoLoopWidthPx}
                    height={28}
                    variant="dark"
                  />
                </div>
                {(pianoMode === 'notes' ? displayNotes : [PAD_NAMES[activeDrumPadIndex]]).map((note, ri) => {
                  const padIndex = pianoMode === 'drums' ? activeDrumPadIndex : ri;
                  return (
                    <div
                      key={ri}
                      style={{
                        display: 'flex',
                        height: pianoMode === 'drums' ? DRUM_GRID_ROW_H : ROW_H,
                        borderTop: '1px solid #000',
                        borderBottom: '1px solid #35566e',
                        background: pianoMode === 'drums' ? drumLaneBg(padIndex) : pianoLaneBg(ri),
                      }}
                    >
                      {Array.from({ length: TOTAL_COLS }, (_, ci) => {
                        const on = pianoMode === 'drums'
                          ? (currentDrums[padIndex]?.[ci] ?? false)
                          : sharedNotes.some(n => n.row === ri && n.col === ci);
                        const isHead = activeCol === ci;
                        return (
                          <button
                            key={ci}
                            onClick={() => {
                              if (pianoMode === 'drums') {
                                toggleDrum(padIndex, ci);
                                playPadSoundRef.current(padIndex, PAD_VEL[padIndex] ?? 90);
                              } else {
                                toggleNote(ri, ci);
                                playPianoNote(ri, 0.3);
                              }
                            }}
                            style={{
                              width: pianoGridColW,
                              flexShrink: 0,
                              height: pianoMode === 'drums' ? DRUM_GRID_ROW_H : ROW_H,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: pianoMode === 'drums' ? drumStepBg(ci, padIndex, isHead) : pianoStepBg(ci, ri, isHead),
                              borderLeft: `1px solid ${ci % (MEASURES_PER_BAR * 4) === 0 ? '#7ba5bf' : ci % MEASURES_PER_BAR === 0 ? '#5e88a3' : '#3f6278'}`,
                              borderTop: 'none',
                              borderRight: 'none',
                              borderBottom: '1px solid #000',
                              boxShadow: on && isHead ? '0 0 8px #b8f5c599' : 'none',
                              cursor: 'pointer',
                              transition: isHead ? 'none' : 'background 0.05s',
                              padding: 0,
                            }}
                          >
                            {on && (
                              <div
                                style={{
                                  width: Math.max(6, Math.floor(pianoGridColW * (pianoMode === 'drums' ? 0.78 : 0.72))),
                                  height: Math.floor((pianoMode === 'drums' ? DRUM_GRID_ROW_H : ROW_H) * (pianoMode === 'drums' ? 0.82 : 0.68)),
                                  borderRadius: pianoMode === 'drums' ? 1 : 2,
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
                  );
                })}
                <LoopVerticalGuides
                  visible={pianoLoopRegionOk}
                  leftPx={pianoLoopLeftPx}
                  widthPx={pianoLoopWidthPx}
                  height={pianoRollLoopGridH}
                  topPx={28}
                  zIndex={12}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MIXER TAB ── */}
      {tab === 'mixer' && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Pad list */}
          <div style={{ width: 140, flexShrink: 0, background: '#080808', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column' }}>
            <div style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#444', padding: '6px 0', borderBottom: '1px solid #1a1a1a', background: '#050505' }}>PADS</div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', padding: '6px' }}>
              {PAD_NAMES.map((name, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedMixerPad(i)}
                  style={{
                    padding: '6px 4px',
                    borderRadius: 4,
                    fontSize: 9,
                    fontWeight: 700,
                    background: selectedMixerPad === i ? PAD_COLORS[i] : '#0a0a0a',
                    color: selectedMixerPad === i ? '#000' : PAD_COLORS[i],
                    border: `1px solid ${PAD_COLORS[i]}${selectedMixerPad === i ? '' : '44'}`,
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Mixer controls */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#0a0a0a' }}>
            <div style={{ padding: '12px', borderBottom: '1px solid #1a1a1a' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: PAD_COLORS[selectedMixerPad] }}>{PAD_NAMES[selectedMixerPad]}</div>
              <div style={{ fontSize: 10, color: '#888' }}>Channel {selCh}</div>
            </div>

            {/* Volume */}
            <div style={{ padding: '12px', borderBottom: '1px solid #1a1a1a' }}>
              <div style={{ fontSize: 10, fontWeight: 700, marginBottom: '8px' }}>VOLUME: {getVolume(selCh)}</div>
              <input
                type="range"
                min={0}
                max={100}
                value={getVolume(selCh)}
                onChange={e => setVolume(selCh, Number(e.target.value))}
                style={{ width: '100%', accentColor: PAD_COLORS[selectedMixerPad] }}
              />
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <ProMeter level={getRmsLevel(selCh)} peakLevel={getPeakLevel(selCh)} />
              </div>
            </div>

            {/* Pan */}
            <div style={{ padding: '12px', borderBottom: '1px solid #1a1a1a' }}>
              <div style={{ fontSize: 10, fontWeight: 700, marginBottom: '8px' }}>PAN: {drumPans[selCh] > 0 ? '+' : ''}{drumPans[selCh]}</div>
              <input
                type="range"
                min={-100}
                max={100}
                value={drumPans[selCh]}
                onChange={e => setPan(selCh, Number(e.target.value))}
                style={{ width: '100%', accentColor: PAD_COLORS[selectedMixerPad] }}
              />
            </div>

            {/* Effects */}
            <div style={{ padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>PAD EFFECTS</span>
                <button
                  onClick={() => setAddEffectOpen(v => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 9,
                    fontWeight: 700,
                    color: PAD_COLORS[selectedMixerPad],
                    background: '#1a1a2a',
                    border: `1px solid ${PAD_COLORS[selectedMixerPad]}66`,
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={10} /> Add
                </button>
              </div>

              {addEffectOpen && (
                <div style={{ marginBottom: '8px', padding: '8px', borderRadius: 4, background: '#1a1a2a', border: `1px solid ${PAD_COLORS[selectedMixerPad]}` }}>
                  {EFFECTS.map(e => (
                    <button
                      key={e}
                      onClick={() => addEffectToDrum(selCh, e)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        fontSize: 9,
                        padding: '6px',
                        marginBottom: '4px',
                        borderRadius: 4,
                        color: PAD_COLORS[selectedMixerPad],
                        background: '#0f0f0f',
                        border: `1px solid ${PAD_COLORS[selectedMixerPad]}44`,
                        cursor: 'pointer'
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}

              {selChEffects.length === 0 && (
                <div style={{ textAlign: 'center', padding: '12px', color: '#333' }}>
                  <p style={{ fontSize: 9 }}>No effects. Click "Add" to insert.</p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selChEffects.map((fx, fi) => (
                  <div
                    key={fi}
                    style={{
                      fontSize: 9,
                      padding: '8px',
                      borderRadius: 4,
                      background: fx.enabled ? '#1a1a2a' : '#0f0f0f',
                      borderLeft: `2px solid ${fx.enabled ? PAD_COLORS[selectedMixerPad] : '#333'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700 }}>{fx.type}</span>
                      <button
                        onClick={() => removeEffectFromDrum(selCh, fi)}
                        style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0 }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <button
                      onClick={() => toggleEffectOnDrum(selCh, fi)}
                      style={{
                        width: '100%',
                        fontSize: 9,
                        padding: '4px',
                        borderRadius: 4,
                        marginBottom: '6px',
                        background: fx.enabled ? PAD_COLORS[selectedMixerPad] + '33' : '#111',
                        color: fx.enabled ? PAD_COLORS[selectedMixerPad] : '#666',
                        border: `1px solid ${fx.enabled ? PAD_COLORS[selectedMixerPad] : '#333'}`,
                        cursor: 'pointer',
                        fontWeight: 700
                      }}
                    >
                      {fx.enabled ? '✓ ON' : '○ OFF'}
                    </button>
                    {fx.type === 'EQ' && (
                      <>
                        <GraphicEQ
                          params={fx.params}
                          color={PAD_COLORS[selectedMixerPad]}
                          signal={fx.enabled ? effectSignal : 0}
                          onBandGainChange={(bandIndex, value) => {
                            const gainLabel = `Band ${bandIndex + 1} Gain`;
                            const idx = fx.params.findIndex((p) => p.label === gainLabel);
                            if (idx >= 0) setDrumEffectParam(selCh, fi, idx, value);
                          }}
                        />
                      </>
                    )}
                    {fx.type !== 'EQ' && (
                      <div
                        style={{
                          marginTop: 6,
                          padding: 8,
                          borderRadius: 4,
                          border: '1px solid #243646',
                          background: 'linear-gradient(180deg, #0b1218 0%, #0b151d 100%)',
                        }}
                      >
                        <EffectVisualizer type={fx.type} params={fx.params} signal={fx.enabled ? effectSignal : 0} />
                        <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                          {fx.params.map((p, pi) => (
                            <FxKnob
                              key={`${p.label}-${pi}`}
                              label={p.label}
                              value={p.value}
                              color={PAD_COLORS[selectedMixerPad]}
                              onChange={(v) => setDrumEffectParam(selCh, fi, pi, v)}
                            />
                          ))}
                        </div>
                        <div
                          style={{
                            height: 66,
                            borderRadius: 3,
                            border: '1px solid #1b2d3a',
                            background: '#07111a',
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: 3,
                            padding: '4px 6px',
                          }}
                        >
                          {fx.params.map((p, i) => (
                            <div
                              key={`mini-${i}`}
                              style={{
                                flex: 1,
                                height: `${Math.max(6, Math.round((p.value / 100) * (34 + effectSignal * 92)))}px`,
                                borderRadius: 2,
                                background: PAD_COLORS[selectedMixerPad],
                                boxShadow: `0 0 ${6 + effectSignal * 18}px ${PAD_COLORS[selectedMixerPad]}66`,
                                opacity: 0.5 + effectSignal * 0.5,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
