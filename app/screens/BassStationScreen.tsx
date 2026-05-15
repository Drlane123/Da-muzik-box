/**
 * Bass Low — professional bassline generator.
 *
 * Trap / hip-hop bassline quality standard:
 *   • 8-row velocity step sequencer (each cell shows a velocity bar —
 *     click to toggle, drag vertically to set velocity level)
 *   • 20 genre presets with genre-accurate patterns
 *   • 4 synthesis voices: 808, Electric, Sub, Pluck (own engine, no deps)
 *   • Real-time audio clock playhead (no step skipping)
 *   • Manual "Follow Chords" panel for chord-root-locked generation
 *   • Export loop as WAV to any Beat Lab pad
 */

import {
  useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect,
} from 'react';
import {
  ChevronDown, ChevronUp, RefreshCw, Sparkles,
  Play, Square, SkipBack, X, ChevronRight, Music2,
} from 'lucide-react';

import { mulberry32, mixSeed } from '@/app/lib/groovePatternEngine';
import { readChordSync } from '@/app/lib/chordBuilderSync';
import { chordSymbolToMidi, type ChordMode as ChordSymMode } from '@/app/lib/creationStation/chordBuilder';
import TransportPulseWorker from '../workers/transportPulse.worker?worker';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ROWS = 8;
const STEPS_PER_BAR = 16;
const LOOK_AHEAD_SEC = 0.25;
const SCHEDULE_INTERVAL_MS = 25;
const DEFAULT_VELOCITY = 0.85;

const KEY_LABELS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const;

const GENRES = [
  'Trap 808', 'Dark Trap', 'Melodic Trap', 'Boom Bap', 'Drill', 'UK Drill',
  'House', 'Deep House', 'Disco', 'Afro House',
  'R&B', 'Neo Soul', 'Soul', 'Funk',
  'Lo-Fi', 'Jazz', 'Latin', 'Afrobeats', 'Dancehall', 'Pop',
] as const;

const LOOP_LENGTHS = [1, 2, 4] as const;

const MODE_INTERVALS: Record<string, ReadonlyArray<number>> = {
  major: [0, 2, 4, 5, 7, 9, 11, 12],
  minor: [0, 2, 3, 5, 7, 8, 10, 12],
};

/** Row colors — from bright (root, row 0) down to deep (octave, row 7). */
const ROW_COLORS = [
  '#f472b6', '#e879f9', '#c084fc', '#a855f7',
  '#818cf8', '#60a5fa', '#34d399', '#a3e635',
] as const;

type BassVoice = '808' | 'electric' | 'sub' | 'pluck';

// ─────────────────────────────────────────────────────────────────────────────
// Grid type: velocities  (0 = off, 0.0–1.0 = velocity)
// ─────────────────────────────────────────────────────────────────────────────

type VeloGrid = number[][];

function emptyGrid(steps: number): VeloGrid {
  return Array.from({ length: ROWS }, () => new Array<number>(steps).fill(0));
}

function gridToBool(g: VeloGrid): boolean[][] {
  return g.map((r) => r.map((v) => v > 0));
}

// ─────────────────────────────────────────────────────────────────────────────
// Genre preset patterns  (8 rows × 16 steps, boolean, velocity filled in later)
// Row 0 = root (C2), row 4 = fifth (G2), row 7 = octave (C3)
// ─────────────────────────────────────────────────────────────────────────────

function p(row: string): boolean[] { return row.split('').map((c) => c !== '.'); }

const GENRE_PRESETS: Record<string, boolean[][]> = {
  'Trap 808': [
    p('X...........X...'),
    p('................'),
    p('................'),
    p('................'),
    p('....X.......X...'),
    p('................'),
    p('................'),
    p('................'),
  ],
  'Dark Trap': [
    p('X.....X.........'),
    p('................'),
    p('...X............'),
    p('................'),
    p('........X.X.....'),
    p('................'),
    p('.........X......'),
    p('..............X.'),
  ],
  'Melodic Trap': [
    p('X...X...........'),
    p('................'),
    p('....X...X.......'),
    p('................'),
    p('........X...X...'),
    p('................'),
    p('...........X....'),
    p('.......X........'),
  ],
  'Boom Bap': [
    p('X...X.X.........'),
    p('................'),
    p('.......X........'),
    p('................'),
    p('....X......X....'),
    p('................'),
    p('............X...'),
    p('................'),
  ],
  'Drill': [
    p('X.....X.........'),
    p('................'),
    p('...X............'),
    p('................'),
    p('........X.X.....'),
    p('X...............'),
    p('................'),
    p('..........X.X...'),
  ],
  'UK Drill': [
    p('X...........X...'),
    p('................'),
    p('....X...........'),
    p('................'),
    p('..X...X.........'),
    p('................'),
    p('.........X......'),
    p('................'),
  ],
  'House': [
    p('X.X.X.X.X.X.X.X.'),
    p('................'),
    p('................'),
    p('................'),
    p('.X...X...X...X..'),
    p('................'),
    p('................'),
    p('................'),
  ],
  'Deep House': [
    p('X...X...X...X...'),
    p('................'),
    p('..X.............'),
    p('..........X.....'),
    p('.......X........'),
    p('................'),
    p('................'),
    p('................'),
  ],
  'Disco': [
    p('X...X.X.X.......'),
    p('................'),
    p('....X...........'),
    p('..X.........X...'),
    p('........X.X.....'),
    p('................'),
    p('...........X....'),
    p('...X............'),
  ],
  'Afro House': [
    p('X.......X.X.....'),
    p('................'),
    p('....X...........'),
    p('..X.......X.....'),
    p('......X.......X.'),
    p('................'),
    p('...X............'),
    p('..........X.....'),
  ],
  'R&B': [
    p('X.......X.......'),
    p('................'),
    p('....X...........'),
    p('................'),
    p('..X.....X.X.....'),
    p('................'),
    p('...........X....'),
    p('................'),
  ],
  'Neo Soul': [
    p('X...X...........'),
    p('..X.............'),
    p('....X.X.........'),
    p('..........X.....'),
    p('........X.......'),
    p('................'),
    p('.............X..'),
    p('...X............'),
  ],
  'Soul': [
    p('X.X.............'),
    p('................'),
    p('....X...........'),
    p('..........X.....'),
    p('......X.X.......'),
    p('................'),
    p('............X...'),
    p('...X............'),
  ],
  'Funk': [
    p('X.X..X.X.X......'),
    p('.X..............'),
    p('................'),
    p('........X.X.....'),
    p('....X...........'),
    p('................'),
    p('...........X.X..'),
    p('................'),
  ],
  'Lo-Fi': [
    p('X...............'),
    p('................'),
    p('....X...........'),
    p('................'),
    p('........X.......'),
    p('................'),
    p('............X...'),
    p('................'),
  ],
  'Jazz': [
    p('X...............'),
    p('................'),
    p('....X...........'),
    p('................'),
    p('........X.......'),
    p('................'),
    p('............X...'),
    p('................'),
  ],
  'Latin': [
    p('X.......X.......'),
    p('................'),
    p('................'),
    p('..X...X.........'),
    p('....X.....X.....'),
    p('................'),
    p('...........X....'),
    p('.X..............'),
  ],
  'Afrobeats': [
    p('X...X.......X...'),
    p('................'),
    p('....X...X.......'),
    p('..X.............'),
    p('........X.X.....'),
    p('.........X......'),
    p('...X............'),
    p('................'),
  ],
  'Dancehall': [
    p('X...X.X.X...X.X.'),
    p('................'),
    p('................'),
    p('................'),
    p('..X.....X.X.....'),
    p('................'),
    p('................'),
    p('................'),
  ],
  'Pop': [
    p('X...X...X...X...'),
    p('................'),
    p('................'),
    p('..X.........X...'),
    p('....X.......X...'),
    p('................'),
    p('................'),
    p('................'),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Music helpers
// ─────────────────────────────────────────────────────────────────────────────

function rowToMidi(row: number, keyRoot: number, mode: string): number {
  const intervals = MODE_INTERVALS[mode] ?? MODE_INTERVALS.minor;
  const semitone = (keyRoot + (intervals[row] ?? 0)) % 12;
  const octave = row < 7 ? 2 : 3;
  return 12 + octave * 12 + semitone;
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function defaultVoiceForGenre(genre: string): BassVoice {
  const g = genre.toLowerCase();
  if (g.includes('808') || g.includes('trap') || g.includes('drill')) return '808';
  if (g.includes('house') || g.includes('disco') || g.includes('afro') || g.includes('dance')) return 'electric';
  if (g.includes('jazz') || g.includes('lo-fi') || g.includes('funk') || g.includes('soul') || g.includes('boom')) return 'pluck';
  return 'sub';
}

// ─────────────────────────────────────────────────────────────────────────────
// Bass Synthesizer — own engine, no AI Pattern Generator dependencies
// ─────────────────────────────────────────────────────────────────────────────

function scheduleBassHit(
  ctx: AudioContext,
  row: number,
  keyRoot: number,
  mode: string,
  voice: BassVoice,
  startTime: number,
  sustainSec: number,
  velocity: number,
): void {
  const midi = rowToMidi(row, keyRoot, mode);
  const freq = midiToFreq(midi);
  const vol = Math.max(0.01, Math.min(1, velocity));

  if (voice === '808') {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 4, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq, startTime + 0.075);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(vol, startTime + 0.005);
    env.gain.setTargetAtTime(vol * 0.65, startTime + 0.012, 0.04);
    env.gain.setTargetAtTime(0, startTime + sustainSec * 0.65, sustainSec * 0.38);
    osc.connect(env); env.connect(ctx.destination);
    osc.start(startTime); osc.stop(startTime + sustainSec + 0.35);
    osc.onended = () => { try { osc.disconnect(); env.disconnect(); } catch(_){} };

  } else if (voice === 'electric') {
    const tri = ctx.createOscillator();
    tri.type = 'triangle'; tri.frequency.value = freq;
    const sq = ctx.createOscillator();
    sq.type = 'square'; sq.frequency.value = freq;
    const sqG = ctx.createGain(); sqG.gain.value = 0.07;
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(freq * 7, startTime);
    flt.frequency.exponentialRampToValueAtTime(freq * 1.4, startTime + 0.14);
    flt.Q.value = 1.8;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(vol, startTime + 0.003);
    env.gain.setTargetAtTime(vol * 0.48, startTime + 0.05, 0.09);
    env.gain.setTargetAtTime(0, startTime + sustainSec * 0.58, sustainSec * 0.42);
    sq.connect(sqG); sqG.connect(flt); tri.connect(flt);
    flt.connect(env); env.connect(ctx.destination);
    tri.start(startTime); sq.start(startTime);
    tri.stop(startTime + sustainSec + 0.35);
    sq.stop(startTime + sustainSec + 0.35);
    tri.onended = () => { try { tri.disconnect(); sq.disconnect(); sqG.disconnect(); flt.disconnect(); env.disconnect(); } catch(_){} };

  } else if (voice === 'sub') {
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(vol, startTime + 0.012);
    env.gain.setTargetAtTime(vol * 0.78, startTime + 0.022, 0.055);
    env.gain.setTargetAtTime(0, startTime + sustainSec * 0.72, sustainSec * 0.32);
    osc.connect(env); env.connect(ctx.destination);
    osc.start(startTime); osc.stop(startTime + sustainSec + 0.25);
    osc.onended = () => { try { osc.disconnect(); env.disconnect(); } catch(_){} };

  } else { // pluck
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth'; osc.frequency.value = freq;
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(freq * 14, startTime);
    flt.frequency.exponentialRampToValueAtTime(freq * 1.1, startTime + 0.09);
    flt.Q.value = 3;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(vol * 0.78, startTime + 0.002);
    env.gain.setTargetAtTime(0, startTime + 0.018, 0.065);
    osc.connect(flt); flt.connect(env); env.connect(ctx.destination);
    osc.start(startTime); osc.stop(startTime + sustainSec + 0.25);
    osc.onended = () => { try { osc.disconnect(); flt.disconnect(); env.disconnect(); } catch(_){} };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WAV export
// ─────────────────────────────────────────────────────────────────────────────

async function renderToWav(
  grid: VeloGrid,
  loopLength: number,
  bpm: number,
  keyRoot: number,
  mode: string,
  voice: BassVoice,
): Promise<Uint8Array> {
  const totalSteps = loopLength * STEPS_PER_BAR;
  const secPerStep = (60 / bpm) / 4;
  const sustainSec = secPerStep * 3.5;
  const sampleRate = 44100;
  const frames = Math.ceil((totalSteps * secPerStep + 1.5) * sampleRate);
  const offline = new OfflineAudioContext(1, frames, sampleRate);

  for (let step = 0; step < totalSteps; step++) {
    const t = step * secPerStep;
    for (let row = 0; row < ROWS; row++) {
      const vel = grid[row]?.[step] ?? 0;
      if (vel <= 0) continue;
      const midi = rowToMidi(row, keyRoot, mode);
      const freq = midiToFreq(midi);
      // Inline scheduling for OfflineAudioContext (same synth logic)
      if (voice === '808') {
        const osc = offline.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 4, t);
        osc.frequency.exponentialRampToValueAtTime(freq, t + 0.075);
        const env = offline.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(vel, t + 0.005);
        env.gain.setTargetAtTime(vel * 0.65, t + 0.012, 0.04);
        env.gain.setTargetAtTime(0, t + sustainSec * 0.65, sustainSec * 0.38);
        osc.connect(env); env.connect(offline.destination);
        osc.start(t); osc.stop(t + sustainSec + 0.35);
      } else if (voice === 'electric') {
        const tri = offline.createOscillator(); tri.type = 'triangle'; tri.frequency.value = freq;
        const sq = offline.createOscillator(); sq.type = 'square'; sq.frequency.value = freq;
        const sqG = offline.createGain(); sqG.gain.value = 0.07;
        const flt = offline.createBiquadFilter(); flt.type = 'lowpass';
        flt.frequency.setValueAtTime(freq * 7, t);
        flt.frequency.exponentialRampToValueAtTime(freq * 1.4, t + 0.14);
        flt.Q.value = 1.8;
        const env = offline.createGain();
        env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(vel, t + 0.003);
        env.gain.setTargetAtTime(vel * 0.48, t + 0.05, 0.09);
        env.gain.setTargetAtTime(0, t + sustainSec * 0.58, sustainSec * 0.42);
        sq.connect(sqG); sqG.connect(flt); tri.connect(flt);
        flt.connect(env); env.connect(offline.destination);
        tri.start(t); sq.start(t); tri.stop(t + sustainSec + 0.35); sq.stop(t + sustainSec + 0.35);
      } else if (voice === 'sub') {
        const osc = offline.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
        const env = offline.createGain();
        env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(vel, t + 0.012);
        env.gain.setTargetAtTime(vel * 0.78, t + 0.022, 0.055);
        env.gain.setTargetAtTime(0, t + sustainSec * 0.72, sustainSec * 0.32);
        osc.connect(env); env.connect(offline.destination);
        osc.start(t); osc.stop(t + sustainSec + 0.25);
      } else {
        const osc = offline.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = freq;
        const flt = offline.createBiquadFilter(); flt.type = 'lowpass';
        flt.frequency.setValueAtTime(freq * 14, t);
        flt.frequency.exponentialRampToValueAtTime(freq * 1.1, t + 0.09);
        flt.Q.value = 3;
        const env = offline.createGain();
        env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(vel * 0.78, t + 0.002);
        env.gain.setTargetAtTime(0, t + 0.018, 0.065);
        osc.connect(flt); flt.connect(env); env.connect(offline.destination);
        osc.start(t); osc.stop(t + sustainSec + 0.25);
      }
    }
  }

  const buf = await offline.startRendering();
  const pcm = buf.getChannelData(0);
  const out = new Uint8Array(44 + pcm.length * 2);
  const dv = new DataView(out.buffer);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length * 2, true);
  w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  w(36, 'data'); dv.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]!));
    dv.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pattern generation
// ─────────────────────────────────────────────────────────────────────────────

function applyVelocityVariation(
  boolGrid: boolean[][],
  temperature: number,
  seed: number,
): VeloGrid {
  const rng = mulberry32(seed + 321);
  const flip = Math.min(0.3, Math.max(0, (temperature - 1.0) * 0.14));
  return boolGrid.map((row) =>
    row.map((on) => {
      if (!on) {
        return (rng() < flip * 0.35) ? 0.5 + rng() * 0.35 : 0;
      }
      // Velocity jitter — makes it feel played, not robotically quantized
      const base = 0.7 + rng() * 0.28;
      return on ? (temperature > 1 ? Math.max(0.35, base + (rng() - 0.5) * 0.3) : base) : 0;
    }),
  );
}

function generatePattern(
  genre: string,
  loopLength: number,
  seed: number,
  temperature: number,
): VeloGrid {
  // Try the exact genre, then fall back to a related one
  const preset = GENRE_PRESETS[genre] ?? GENRE_PRESETS['Trap 808']!;
  const varied = applyVelocityVariation(preset, temperature, seed);
  const steps = loopLength * STEPS_PER_BAR;
  const srcLen = varied[0]?.length ?? STEPS_PER_BAR;
  return varied.map((row) => {
    const tiled = new Array<number>(steps);
    for (let s = 0; s < steps; s++) tiled[s] = row[s % srcLen] ?? 0;
    return tiled;
  });
}

// Chord-following — manual chord changes typed by user
interface ChordChange { bar: number; root: number; flavor: 'major' | 'minor'; }

function generateChordFollowPattern(
  changes: ChordChange[],
  genre: string,
  loopLength: number,
  keyRoot: number,
  mode: string,
  seed: number,
): VeloGrid {
  if (changes.length === 0) return generatePattern(genre, loopLength, seed, 1.0);
  const totalSteps = loopLength * STEPS_PER_BAR;
  const grid = emptyGrid(totalSteps);
  const rng = mulberry32(seed);
  const sorted = [...changes].sort((a, b) => a.bar - b.bar);
  const preset = GENRE_PRESETS[genre] ?? GENRE_PRESETS['Trap 808']!;
  const intervals = MODE_INTERVALS[mode] ?? MODE_INTERVALS.minor;

  for (let ci = 0; ci < sorted.length; ci++) {
    const ch = sorted[ci]!;
    const startBar = ch.bar - 1;
    const endBar = ci + 1 < sorted.length ? sorted[ci + 1]!.bar - 1 : loopLength;
    if (startBar >= loopLength) continue;
    const startStep = startBar * STEPS_PER_BAR;
    const endStep = Math.min(endBar * STEPS_PER_BAR, totalSteps);
    const offset = ((ch.root - keyRoot) % 12 + 12) % 12;
    const rootRow = intervals.indexOf(offset);
    const effRoot = rootRow >= 0 ? rootRow : 0;
    const effFifth = Math.min(ROWS - 1, effRoot + 4);
    const baseRoot = preset[0]!;
    const baseFifth = preset[4] ?? new Array<boolean>(STEPS_PER_BAR).fill(false);

    for (let s = 0; s < endStep - startStep; s++) {
      const ps = s % STEPS_PER_BAR;
      if (baseRoot[ps]) {
        const vel = 0.72 + rng() * 0.26;
        grid[effRoot]![startStep + s] = vel;
      }
      if (baseFifth[ps]) {
        const vel = 0.55 + rng() * 0.25;
        grid[effFifth]![startStep + s] = vel;
      }
    }

    // Approach note into next chord
    if (ci + 1 < sorted.length) {
      const nextCh = sorted[ci + 1]!;
      const nextOff = ((nextCh.root - keyRoot) % 12 + 12) % 12;
      const nextRow = intervals.indexOf(nextOff);
      const nextEff = nextRow >= 0 ? nextRow : 0;
      const approach = effRoot < nextEff
        ? Math.min(ROWS - 1, effRoot + 1)
        : Math.max(0, effRoot - 1);
      const ap = endStep - (rng() < 0.6 ? 2 : 1);
      if (ap >= startStep && ap < totalSteps) grid[approach]![ap] = 0.5 + rng() * 0.2;
    }
  }
  return grid;
}

// ─────────────────────────────────────────────────────────────────────────────
// VeloCell — one step button with velocity bar
// ─────────────────────────────────────────────────────────────────────────────

interface VeloCellProps {
  velocity: number;
  isCurrentStep: boolean;
  rowColor: string;
  beatStart: boolean;
  onToggle: () => void;
  onVelocityChange: (v: number) => void;
}

function VeloCell({ velocity, isCurrentStep, rowColor, beatStart, onToggle, onVelocityChange }: VeloCellProps) {
  const on = velocity > 0;
  const cellRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ startY: number; startVel: number } | null>(null);

  useLayoutEffect(() => {
    const el = cellRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      if (!on) {
        onToggle();
        return;
      }
      dragRef.current = { startY: e.clientY, startVel: velocity };

      const onMouseMove = (me: MouseEvent) => {
        if (!dragRef.current) return;
        const dy = dragRef.current.startY - me.clientY; // up = increase
        const newVel = Math.max(0.05, Math.min(1, dragRef.current.startVel + dy / 60));
        onVelocityChange(newVel);
      };

      const onMouseUp = (me: MouseEvent) => {
        const dy = Math.abs(me.clientY - (dragRef.current?.startY ?? me.clientY));
        if (dy < 3) onToggle(); // tiny drag = toggle off
        dragRef.current = null;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    el.addEventListener('mousedown', onMouseDown);
    return () => el.removeEventListener('mousedown', onMouseDown);
  }, [on, velocity, onToggle, onVelocityChange]);

  const barHeight = on ? `${Math.round(velocity * 100)}%` : '0%';

  return (
    <button
      ref={cellRef}
      style={{
        flex: 1,
        height: 36,
        position: 'relative',
        background: isCurrentStep
          ? on ? 'transparent' : '#1e1828'
          : beatStart ? '#0a0a0a' : '#060606',
        border: `1px solid ${beatStart ? '#1a1a1a' : '#0f0f0f'}`,
        cursor: 'pointer',
        padding: 0,
        overflow: 'hidden',
        borderRadius: 2,
        boxShadow: on && isCurrentStep ? `0 0 12px ${rowColor}66` : 'none',
      }}
    >
      {/* Velocity bar */}
      {on && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: barHeight,
          background: isCurrentStep
            ? rowColor
            : `${rowColor}99`,
          transition: 'height 0.05s',
        }} />
      )}
      {/* Playhead highlight */}
      {isCurrentStep && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `${rowColor}18`,
          pointerEvents: 'none',
        }} />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

interface BassStationProps {
  embedded?: boolean;
  isScreenActive?: boolean;
  onBack?: () => void;
  onExportToPad?: (args: { padIndex: number; wavBytes: Uint8Array; label: string; rootBpm: number }) => void;
  bpm: number;
  getAudioContext: () => AudioContext;
}

export default function BassStationScreen({
  embedded,
  isScreenActive,
  onBack,
  onExportToPad,
  bpm: masterBpm,
  getAudioContext: getOrCreateAudioContext,
}: BassStationProps) {
  const [localBpm, setLocalBpm] = useState(masterBpm || 120);
  const [keyRoot, setKeyRoot] = useState(0);
  const [mode, setMode] = useState<'major' | 'minor'>('minor');
  const [genre, setGenre] = useState<string>('Trap 808');
  const [voice, setVoice] = useState<BassVoice>('808');
  const [loopLength, setLoopLength] = useState<number>(2);
  const [temperature, setTemperature] = useState(1.0);
  const [generating, setGenerating] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [padPickerOpen, setPadPickerOpen] = useState(false);
  const [padExportBusy, setPadExportBusy] = useState(false);
  const [padExportStatus, setPadExportStatus] = useState<string | null>(null);
  const [followOpen, setFollowOpen] = useState(false);
  const [chordChanges, setChordChanges] = useState<ChordChange[]>([]);
  const [followEnabled, setFollowEnabled] = useState(false);

  const totalSteps = loopLength * STEPS_PER_BAR;
  const [grid, setGrid] = useState<VeloGrid>(() => emptyGrid(totalSteps));

  // ── Refs ──────────────────────────────────────────────────────────────────
  const gridRef = useRef(grid);
  useEffect(() => { gridRef.current = grid; }, [grid]);
  const bpmRef = useRef(localBpm);
  useEffect(() => { bpmRef.current = localBpm; }, [localBpm]);
  const keyRef = useRef(keyRoot);
  useEffect(() => { keyRef.current = keyRoot; }, [keyRoot]);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  const voiceRef = useRef(voice);
  useEffect(() => { voiceRef.current = voice; }, [voice]);
  const totalStepsRef = useRef(totalSteps);
  useEffect(() => { totalStepsRef.current = totalSteps; }, [totalSteps]);

  const gridOriginRef = useRef(0);
  const nextStepIdxRef = useRef(0);
  const runIdRef = useRef(0);
  const rafIdRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => { if (masterBpm > 0) setLocalBpm(masterBpm); }, [masterBpm]);
  useEffect(() => { setVoice(defaultVoiceForGenre(genre)); }, [genre]);

  // ── Row names ──────────────────────────────────────────────────────────────
  const rowNames = useMemo(() => {
    const intervals = MODE_INTERVALS[mode] ?? MODE_INTERVALS.minor;
    return Array.from({ length: ROWS }, (_, r) => {
      const semitone = (keyRoot + (intervals[r] ?? 0)) % 12;
      const octave = r < 7 ? 2 : 3;
      return `${KEY_LABELS[semitone]}${octave}`;
    });
  }, [keyRoot, mode]);

  // ── Grid tiling on loop length change ─────────────────────────────────────
  useEffect(() => {
    const newSteps = loopLength * STEPS_PER_BAR;
    setGrid((prev) => {
      const prevSteps = prev[0]?.length ?? STEPS_PER_BAR;
      if (prevSteps === newSteps) return prev;
      return prev.map((row) => {
        const t = new Array<number>(newSteps);
        for (let s = 0; s < newSteps; s++) t[s] = row[s % prevSteps] ?? 0;
        return t;
      });
    });
  }, [loopLength]);

  // ── Generate ───────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    const seed = mixSeed([genre, keyRoot, mode, temperature, Date.now()]);
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    const newGrid = followEnabled && chordChanges.length > 0
      ? generateChordFollowPattern(chordChanges, genre, loopLength, keyRoot, mode, seed)
      : generatePattern(genre, loopLength, seed, temperature);
    setGrid(newGrid);
    setGenerating(false);
  }, [genre, keyRoot, mode, temperature, followEnabled, chordChanges, loopLength]);

  // ── Playback ───────────────────────────────────────────────────────────────
  const startPlayback = useCallback(() => {
    const ctx = getOrCreateAudioContext();
    gridOriginRef.current = ctx.currentTime + 0.05;
    nextStepIdxRef.current = 0;
    const runId = ++runIdRef.current;
    setPlaying(true);

    const worker = new TransportPulseWorker();
    workerRef.current = worker;
    worker.postMessage({ cmd: 'start', intervalMs: SCHEDULE_INTERVAL_MS });

    worker.onmessage = () => {
      if (runIdRef.current !== runId) return;
      const ctx2 = getOrCreateAudioContext();
      const now = ctx2.currentTime;
      const steps = totalStepsRef.current;
      const sps = 60 / Math.max(1, bpmRef.current) / 4; // sec per 16th-note step
      const horizon = now + LOOK_AHEAD_SEC;
      const origin = gridOriginRef.current;
      let idx = nextStepIdxRef.current;
      const pat = gridRef.current;

      while (origin + idx * sps < horizon) {
        const step = idx % steps;
        const t = Math.max(origin + idx * sps, now + 0.002);
        for (let r = 0; r < ROWS; r++) {
          const vel = pat[r]?.[step] ?? 0;
          if (vel <= 0) continue;
          scheduleBassHit(ctx2, r, keyRef.current, modeRef.current, voiceRef.current, t, sps * 3.5, vel);
        }
        idx++;
        nextStepIdxRef.current = idx;
      }
    };

    // Visual playhead — reads ctx.currentTime directly at 60 fps.
    // Never driven by the worker to avoid step-skipping.
    let last = -1;
    const tick = () => {
      if (runIdRef.current !== runId) return;
      const ctx2 = getOrCreateAudioContext();
      const now = ctx2.currentTime;
      const origin = gridOriginRef.current;
      const steps = totalStepsRef.current;
      const sps = 60 / Math.max(1, bpmRef.current) / 4;
      if (now >= origin && sps > 0) {
        const s = Math.floor((now - origin) / sps) % steps;
        if (s !== last) { last = s; setCurrentStep(s); }
      }
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);
  }, [getOrCreateAudioContext]);

  const stopPlayback = useCallback(() => {
    runIdRef.current++;
    cancelAnimationFrame(rafIdRef.current);
    workerRef.current?.postMessage({ cmd: 'stop' });
    workerRef.current?.terminate();
    workerRef.current = null;
    setPlaying(false);
    setCurrentStep(-1);
    nextStepIdxRef.current = 0;
  }, []);

  useEffect(() => { if (!isScreenActive && playing) stopPlayback(); }, [isScreenActive, playing, stopPlayback]);
  useEffect(() => () => stopPlayback(), [stopPlayback]);

  // ── Step/velocity edit ────────────────────────────────────────────────────
  const toggleStep = useCallback((row: number, step: number) => {
    setGrid((prev) => prev.map((r, ri) =>
      ri !== row ? r : r.map((v, si) => si !== step ? v : v > 0 ? 0 : DEFAULT_VELOCITY),
    ));
  }, []);

  const setStepVelocity = useCallback((row: number, step: number, vel: number) => {
    setGrid((prev) => prev.map((r, ri) =>
      ri !== row ? r : r.map((v, si) => si !== step ? v : vel),
    ));
  }, []);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExportToPad = useCallback(async (padIndex: number) => {
    if (!onExportToPad || padExportBusy) return;
    setPadExportBusy(true);
    try {
      const wav = await renderToWav(grid, loopLength, localBpm, keyRoot, mode, voice);
      onExportToPad({ padIndex, wavBytes: wav, label: `Bass Low · ${genre}`, rootBpm: localBpm });
      setPadExportStatus(`✓ Exported to Pad ${padIndex + 1}`);
    } catch {
      setPadExportStatus('Export failed — try again');
    } finally {
      setPadExportBusy(false);
      setTimeout(() => setPadExportStatus(null), 3500);
    }
  }, [grid, loopLength, localBpm, keyRoot, mode, voice, genre, onExportToPad, padExportBusy]);

  const addChordChange = useCallback(() => {
    setChordChanges((p) => [...p, { bar: p.length + 1, root: keyRoot, flavor: mode }]);
  }, [keyRoot, mode]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const hasNotes = grid.some((r) => r.some((v) => v > 0));

  return (
    <div className="flex flex-col h-full overflow-hidden"
      style={{ background: '#030303', color: '#d0d0d0', fontFamily: "'Inter', system-ui, sans-serif", userSelect: 'none' }}>

      {/* ── HEADER ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 shrink-0"
        style={{ background: 'linear-gradient(180deg,#0e0e0e,#080808)', borderBottom: '1px solid #1a1a1a' }}>
        {embedded && onBack && (
          <button onClick={() => { stopPlayback(); onBack(); }}
            style={{ background: '#111', color: '#666', border: '1px solid #222', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <X size={11} /> Close
          </button>
        )}

        {/* Logo */}
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 20 }}>🐉</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: '-0.02em', color: '#f0f0f0', lineHeight: 1 }}>
              BASS LOW
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#555', letterSpacing: '0.1em' }}>
              BASSLINE GENERATOR
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 32, background: '#1a1a1a', margin: '0 4px' }} />

        {/* BPM inline */}
        <div className="flex items-center gap-1">
          <span style={{ fontSize: 9, fontWeight: 800, color: '#444', letterSpacing: '0.08em' }}>BPM</span>
          <button onClick={() => setLocalBpm((v) => Math.max(40, v - 1))} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}><ChevronDown size={14} /></button>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#e0e0e0', minWidth: 38, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{localBpm}</span>
          <button onClick={() => setLocalBpm((v) => Math.min(240, v + 1))} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}><ChevronUp size={14} /></button>
        </div>

        <div className="flex-1" />

        {/* Transport */}
        <button onClick={() => { nextStepIdxRef.current = 0; setCurrentStep(-1); }}
          style={{ background: '#111', color: '#444', border: '1px solid #1e1e1e', borderRadius: 6, padding: '5px 8px', cursor: 'pointer' }}>
          <SkipBack size={13} />
        </button>
        <button onClick={playing ? stopPlayback : startPlayback}
          style={{
            background: playing ? 'linear-gradient(135deg,#a855f7,#7c3aed)' : '#161616',
            color: playing ? '#fff' : '#888',
            border: `1px solid ${playing ? '#a855f766' : '#252525'}`,
            borderRadius: 8, padding: '6px 18px',
            fontSize: 12, fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            letterSpacing: '0.04em',
          }}>
          {playing ? <><Square size={12} fill="currentColor" /> STOP</> : <><Play size={12} fill="currentColor" /> PLAY</>}
        </button>

        {/* Export */}
        {onExportToPad && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setPadPickerOpen((v) => !v)} disabled={padExportBusy}
              style={{ background: '#111', color: padExportBusy ? '#333' : '#a855f7', border: '1px solid #252525', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: '0.04em' }}>
              {padExportBusy ? '…' : '→ PAD'}
            </button>
            {padPickerOpen && (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, padding: 12, zIndex: 50, width: 194 }}>
                <p style={{ fontSize: 9, color: '#555', marginBottom: 8, fontWeight: 700 }}>EXPORT TO PAD</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                  {Array.from({ length: 16 }, (_, i) => (
                    <button key={i} onClick={() => { setPadPickerOpen(false); handleExportToPad(i); }}
                      style={{ background: '#1a1a1a', color: '#a855f7', border: '1px solid #a855f733', borderRadius: 5, padding: '6px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {i + 1}
                    </button>
                  ))}
                </div>
                {padExportStatus && (
                  <p style={{ fontSize: 10, marginTop: 8, color: padExportStatus.startsWith('✓') ? '#34d399' : '#f87171' }}>{padExportStatus}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CONTROLS BAR ── */}
      <div className="shrink-0 px-4 py-2.5 flex items-center gap-3 flex-wrap"
        style={{ background: '#050505', borderBottom: '1px solid #111' }}>
        {/* Genre */}
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 9, fontWeight: 800, color: '#444', letterSpacing: '0.08em' }}>GENRE</span>
          <select value={genre} onChange={(e) => setGenre(e.target.value)}
            style={{ background: '#111', color: '#d0d0d0', border: '1px solid #2a2a2a', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div style={{ width: 1, height: 20, background: '#1a1a1a' }} />

        {/* Sound */}
        <div className="flex items-center gap-1">
          <span style={{ fontSize: 9, fontWeight: 800, color: '#444', letterSpacing: '0.08em' }}>SOUND</span>
          {(['808', 'electric', 'sub', 'pluck'] as BassVoice[]).map((v) => (
            <button key={v} onClick={() => setVoice(v)}
              style={{
                background: voice === v ? '#a855f722' : 'transparent',
                color: voice === v ? '#c084fc' : '#3a3a3a',
                border: `1px solid ${voice === v ? '#a855f755' : '#1a1a1a'}`,
                borderRadius: 5, padding: '3px 8px', fontSize: 10, fontWeight: 700,
                cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>{v}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: '#1a1a1a' }} />

        {/* Key */}
        <div className="flex items-center gap-1 flex-wrap">
          <span style={{ fontSize: 9, fontWeight: 800, color: '#444', letterSpacing: '0.08em' }}>KEY</span>
          {KEY_LABELS.map((k, i) => (
            <button key={k} onClick={() => setKeyRoot(i)}
              style={{
                background: keyRoot === i ? '#a855f722' : 'transparent',
                color: keyRoot === i ? '#c084fc' : '#2e2e2e',
                border: `1px solid ${keyRoot === i ? '#a855f755' : '#151515'}`,
                borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 800,
                cursor: 'pointer', minWidth: 22, textAlign: 'center',
              }}>{k}</button>
          ))}
          {(['minor', 'major'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              style={{
                background: mode === m ? '#a855f722' : 'transparent',
                color: mode === m ? '#c084fc' : '#2e2e2e',
                border: `1px solid ${mode === m ? '#a855f755' : '#151515'}`,
                borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 800,
                cursor: 'pointer', textTransform: 'capitalize',
              }}>{m}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: '#1a1a1a' }} />

        {/* Bars */}
        <div className="flex items-center gap-1">
          <span style={{ fontSize: 9, fontWeight: 800, color: '#444', letterSpacing: '0.08em' }}>BARS</span>
          {LOOP_LENGTHS.map((l) => (
            <button key={l} onClick={() => setLoopLength(l)}
              style={{
                background: loopLength === l ? '#a855f722' : 'transparent',
                color: loopLength === l ? '#c084fc' : '#2e2e2e',
                border: `1px solid ${loopLength === l ? '#a855f755' : '#151515'}`,
                borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 800, cursor: 'pointer',
              }}>{l}</button>
          ))}
        </div>

        {/* Variation */}
        <div className="flex items-center gap-1">
          <span style={{ fontSize: 9, fontWeight: 800, color: '#444', letterSpacing: '0.08em' }}>FEEL</span>
          {([1.0, 1.3, 1.6, 2.0] as const).map((t) => (
            <button key={t} onClick={() => setTemperature(t)}
              style={{
                background: temperature === t ? '#a855f722' : 'transparent',
                color: temperature === t ? '#c084fc' : '#2e2e2e',
                border: `1px solid ${temperature === t ? '#a855f755' : '#151515'}`,
                borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 800, cursor: 'pointer',
              }}>
              {t === 1.0 ? 'Tight' : t === 1.3 ? 'Loose' : t === 1.6 ? 'Funky' : 'Wild'}
            </button>
          ))}
        </div>
      </div>

      {/* ── ACTION BAR ── */}
      <div className="shrink-0 px-4 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid #0d0d0d' }}>
        <button onClick={handleGenerate} disabled={generating}
          style={{
            background: generating ? '#111' : 'linear-gradient(135deg,#a855f7 0%,#7c3aed 100%)',
            color: generating ? '#333' : '#fff',
            border: 'none', borderRadius: 8,
            padding: '9px 24px', fontSize: 12, fontWeight: 900,
            display: 'flex', alignItems: 'center', gap: 6,
            cursor: generating ? 'not-allowed' : 'pointer',
            letterSpacing: '0.06em',
            boxShadow: generating ? 'none' : '0 0 20px #a855f744',
            flex: 1,
            justifyContent: 'center',
          }}>
          {generating
            ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> GENERATING…</>
            : <><Sparkles size={13} /> GENERATE {genre.toUpperCase()}</>}
        </button>

        <button onClick={() => setGrid(emptyGrid(totalSteps))}
          style={{ background: '#0d0d0d', color: '#333', border: '1px solid #1a1a1a', borderRadius: 8, padding: '9px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
          CLEAR
        </button>

        <button onClick={() => setFollowOpen((v) => !v)}
          style={{
            background: followOpen ? '#a855f711' : '#0d0d0d',
            color: followOpen ? '#a855f7' : '#2e2e2e',
            border: `1px solid ${followOpen ? '#a855f733' : '#1a1a1a'}`,
            borderRadius: 8, padding: '9px 14px', fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
          }}>
          <Music2 size={12} />
          CHORDS
          <ChevronRight size={11} style={{ transform: followOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>
      </div>

      {/* ── FOLLOW CHORDS PANEL ── */}
      {followOpen && (
        <div className="shrink-0 px-4 py-3"
          style={{ background: '#040404', borderBottom: '1px solid #0d0d0d' }}>
          <div className="flex items-center gap-3 mb-2">
            <span style={{ fontSize: 10, fontWeight: 800, color: '#a855f7', letterSpacing: '0.06em' }}>FOLLOW CHORD CHANGES</span>
            <span style={{ fontSize: 9, color: '#2a2a2a' }}>Enter your chord roots — Bass Low follows them on Generate</span>
            <div style={{ flex: 1 }} />
            {/* Toggle */}
            <div onClick={() => setFollowEnabled((v) => !v)} style={{
              width: 32, height: 18, borderRadius: 9,
              background: followEnabled ? '#a855f7' : '#1a1a1a',
              border: '1px solid #2a2a2a',
              position: 'relative', cursor: 'pointer',
            }}>
              <div style={{
                position: 'absolute', top: 2, left: followEnabled ? 16 : 2,
                width: 12, height: 12, background: '#fff', borderRadius: '50%',
                transition: 'left 0.15s',
              }} />
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: followEnabled ? '#a855f7' : '#333' }}>
              {followEnabled ? 'ON' : 'OFF'}
            </span>
          </div>

          <div className="flex flex-col gap-1 mb-2">
            {chordChanges.map((cc, i) => (
              <div key={i} className="flex items-center gap-2">
                <span style={{ fontSize: 9, fontWeight: 700, color: '#3a3a3a', minWidth: 42 }}>BAR {cc.bar}</span>
                <select value={cc.root} onChange={(e) => setChordChanges((p) => p.map((c, ci) => ci === i ? { ...c, root: Number(e.target.value) } : c))}
                  style={{ background: '#0d0d0d', color: '#d0d0d0', border: '1px solid #2a2a2a', borderRadius: 5, padding: '2px 6px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                  {KEY_LABELS.map((k, ki) => <option key={k} value={ki}>{k}</option>)}
                </select>
                {(['minor', 'major'] as const).map((f) => (
                  <button key={f} onClick={() => setChordChanges((p) => p.map((c, ci) => ci === i ? { ...c, flavor: f } : c))}
                    style={{
                      background: cc.flavor === f ? '#a855f722' : 'transparent',
                      color: cc.flavor === f ? '#a855f7' : '#2e2e2e',
                      border: `1px solid ${cc.flavor === f ? '#a855f755' : '#151515'}`,
                      borderRadius: 4, padding: '2px 8px', fontSize: 9, fontWeight: 800, cursor: 'pointer',
                    }}>{f}</button>
                ))}
                <span style={{ fontSize: 9, color: '#2a2a2a' }}>at bar</span>
                <button onClick={() => setChordChanges((p) => p.map((c, ci) => ci === i ? { ...c, bar: Math.max(1, c.bar - 1) } : c))}
                  style={{ color: '#333', background: 'none', border: 'none', cursor: 'pointer' }}><ChevronDown size={12} /></button>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#666', minWidth: 14, textAlign: 'center' }}>{cc.bar}</span>
                <button onClick={() => setChordChanges((p) => p.map((c, ci) => ci === i ? { ...c, bar: Math.min(loopLength, c.bar + 1) } : c))}
                  style={{ color: '#333', background: 'none', border: 'none', cursor: 'pointer' }}><ChevronUp size={12} /></button>
                <button onClick={() => setChordChanges((p) => p.filter((_, ci) => ci !== i))}
                  style={{ color: '#2a2a2a', background: 'none', border: 'none', cursor: 'pointer' }}><X size={11} /></button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setChordChanges((p) => [...p, { bar: p.length + 1, root: keyRoot, flavor: mode }])}
              style={{ background: '#0d0d0d', color: '#a855f7', border: '1px solid #a855f733', borderRadius: 6, padding: '4px 12px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
              + ADD CHORD CHANGE
            </button>

            {/* IMPORT FROM CHORD SEQ — reads the latest chord progression
                from localStorage (written by Chord Sequencer Screen) and
                converts each chord into a ChordChange (root pitch class +
                major/minor flavor) that Bass Low can follow. Two chord
                steps in the Chord Sequencer (= 1 bar at 4/4) collapse into
                one ChordChange aligned to a bar boundary. */}
            <button
              onClick={() => {
                const sync = readChordSync();
                if (!sync || sync.blocks.length === 0) {
                  window.alert('No chord progression found. Open the Chord Sequencer and build one first.');
                  return;
                }
                // Each step = 2 beats; 2 steps = 1 bar at 4/4 → 1 ChordChange per bar.
                const STEPS_PER_BAR_LOCAL = 2;
                const ch: ChordChange[] = [];
                for (let i = 0; i < sync.blocks.length; i += STEPS_PER_BAR_LOCAL) {
                  const block = sync.blocks[i];
                  if (!block) break;
                  const bar = Math.floor(i / STEPS_PER_BAR_LOCAL) + 1;
                  if (bar > loopLength) break;
                  // Resolve Roman symbol → root MIDI using the SYNCED key/mode,
                  // then derive pitch class + flavor from the resulting voicing.
                  const midi = chordSymbolToMidi(block.chord, sync.keyRoot, sync.mode as ChordSymMode, 4);
                  if (!midi || midi.length === 0) continue;
                  const sorted = [...midi].sort((a, b) => a - b);
                  const rootPc = ((sorted[0]! % 12) + 12) % 12;
                  const thirdInterval = sorted.length >= 2 ? (sorted[1]! - sorted[0]!) : 4;
                  const flavor: 'major' | 'minor' = thirdInterval === 3 ? 'minor' : 'major';
                  ch.push({ bar, root: rootPc, flavor });
                }
                if (ch.length === 0) {
                  window.alert('Could not parse the chord progression — try a different key or genre and resave.');
                  return;
                }
                // Adopt the Chord Sequencer's key/mode too, so the bass plays
                // in the same key the user just heard chord previews in.
                setKeyRoot(sync.keyRoot);
                if (sync.mode === 'major' || sync.mode === 'minor') setMode(sync.mode);
                setChordChanges(ch);
                setFollowEnabled(true);
              }}
              title="Read the latest chord progression from Chord Sequencer and convert it into chord changes Bass Low will follow."
              style={{ background: '#0d0d0d', color: '#86efac', border: '1px solid #1f3a29', borderRadius: 6, padding: '4px 12px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
            >
              ↘ IMPORT FROM CHORD SEQ
            </button>

            <button
              onClick={() => setChordChanges([])}
              disabled={chordChanges.length === 0}
              title="Clear all chord changes"
              style={{ background: '#0d0d0d', color: chordChanges.length === 0 ? '#222' : '#a85555', border: '1px solid #2a2a2a', borderRadius: 6, padding: '4px 10px', fontSize: 10, fontWeight: 700, cursor: chordChanges.length === 0 ? 'not-allowed' : 'pointer' }}
            >
              CLEAR
            </button>
          </div>
        </div>
      )}

      {/* ── STEP GRID ── */}
      <div className="flex-1 overflow-auto" style={{ padding: '12px 16px' }}>
        {/* Beat number header */}
        <div style={{ display: 'flex', paddingLeft: 48, marginBottom: 4 }}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center',
              fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
              color: currentStep === i ? '#a855f7' : i % 4 === 0 ? '#333' : '#1a1a1a',
            }}>
              {i % 4 === 0 ? Math.floor(i / 4) + 1 : i % 2 === 0 ? '&' : '·'}
            </div>
          ))}
        </div>

        {/* Rows */}
        {grid.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
            {/* Note label */}
            <div style={{
              width: 48, textAlign: 'right', paddingRight: 8,
              fontSize: 10, fontWeight: 800, fontFamily: 'monospace',
              color: ROW_COLORS[ri],
              opacity: row.some((v) => v > 0) ? 1 : 0.22,
            }}>
              {rowNames[ri]}
            </div>
            {/* Steps */}
            <div style={{ display: 'flex', flex: 1, gap: 1 }}>
              {row.map((vel, si) => (
                <VeloCell
                  key={si}
                  velocity={vel}
                  isCurrentStep={currentStep === si}
                  rowColor={ROW_COLORS[ri]!}
                  beatStart={si % 4 === 0}
                  onToggle={() => toggleStep(ri, si)}
                  onVelocityChange={(v) => setStepVelocity(ri, si, v)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Playhead strip */}
        <div style={{ display: 'flex', paddingLeft: 48, marginTop: 4 }}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} style={{
              flex: 1,
              height: 2,
              borderRadius: 1,
              background: currentStep === i ? '#a855f7' : 'transparent',
              boxShadow: currentStep === i ? '0 0 6px #a855f7' : 'none',
            }} />
          ))}
        </div>

        {/* Empty state */}
        {!hasNotes && (
          <div style={{ textAlign: 'center', paddingTop: 32, color: '#1e1e1e' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🐉</div>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#2a2a2a' }}>
              Hit <span style={{ color: '#a855f7' }}>GENERATE</span> for a {genre} bassline
            </p>
            <p style={{ fontSize: 10, marginTop: 4, color: '#1a1a1a' }}>
              Key: {KEY_LABELS[keyRoot]} {mode} · Sound: {voice} · {loopLength} bar{loopLength !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div style={{ borderTop: '1px solid #0d0d0d', padding: '4px 16px', display: 'flex', alignItems: 'center', gap: 12, background: '#030303' }}>
        <span style={{ fontSize: 9, color: '#1e1e1e', fontWeight: 700, letterSpacing: '0.06em' }}>
          BASS LOW · {KEY_LABELS[keyRoot]} {mode.toUpperCase()} · {voice.toUpperCase()} · {loopLength * STEPS_PER_BAR} STEPS · {localBpm} BPM
        </span>
        {playing && (
          <span style={{ fontSize: 9, color: '#a855f7', fontWeight: 800, letterSpacing: '0.08em' }}>
            ● PLAYING
          </span>
        )}
      </div>
    </div>
  );
}
