/**
 * Magenta MusicRNN — primary AI pattern path when TF.js + checkpoints load successfully.
 * Lazy-loaded so the main bundle avoids pulling TensorFlow until generation runs.
 */

import type { INoteSequence, MusicRNN } from '@magenta/music';

const DRUM_CHECKPOINT = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/drum_kit_rnn';
const MELODY_CHECKPOINT = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn';

const GRID_STEPS = 16;
const DRUM_STEPS_PER_QUARTER = 2;
const MELODY_STEPS_PER_QUARTER = 4;

let drumRnnPromise: Promise<MusicRNN> | null = null;
let melodyRnnPromise: Promise<MusicRNN> | null = null;

/**
 * Warm both RNN checkpoints in the background (TF.js + weights). Safe to call on screen mount;
 * failures are logged; generation will retry loading on demand.
 */
export function prefetchMagentaPatternModels(): Promise<void> {
  return Promise.all([getDrumRnn(), getMelodyRnn()])
    .then(() => undefined)
    .catch((e) => {
      console.warn('[Magenta] Prefetch failed — models load on first Generate', e);
    });
}

async function loadMagenta() {
  return import('@magenta/music');
}

async function getDrumRnn(): Promise<MusicRNN> {
  if (!drumRnnPromise) {
    drumRnnPromise = (async () => {
      const { MusicRNN } = await loadMagenta();
      const m = new MusicRNN(DRUM_CHECKPOINT);
      await m.initialize();
      return m;
    })();
  }
  return drumRnnPromise;
}

async function getMelodyRnn(): Promise<MusicRNN> {
  if (!melodyRnnPromise) {
    melodyRnnPromise = (async () => {
      const { MusicRNN } = await loadMagenta();
      const m = new MusicRNN(MELODY_CHECKPOINT);
      await m.initialize();
      return m;
    })();
  }
  return melodyRnnPromise;
}

/** Map GM drum pitch to 8-row step grid (Kick, Snare, Clap, HH, Open, TomHi, TomLo, Rim). */
function drumPitchToRow(pitch: number): number {
  if (pitch === 35 || pitch === 36) return 0;
  if (pitch === 37) return 7;
  if (pitch === 38 || pitch === 40) return 1;
  if (pitch === 39) return 2;
  if (pitch === 42 || pitch === 44 || pitch === 54 || pitch === 68) return 3;
  if (pitch === 46) return 4;
  if (pitch === 48 || pitch === 50 || pitch === 43) return 5;
  if (pitch === 45 || pitch === 47) return 6;
  if (pitch >= 49 && pitch <= 52) return 5;
  return 3;
}

/** Priming loop for `drum_kit_rnn` — biased by procedural `recipe` so Magenta continues in-family. */
function buildDrumSeed(recipe: string, rng: () => number): INoteSequence {
  type Note = {
    pitch: number;
    quantizedStartStep: number;
    quantizedEndStep: number;
    isDrum: boolean;
    velocity: number;
  };
  const notes: Note[] = [];
  const pushDrum = (pitch: number, step: number) => {
    notes.push({
      pitch,
      quantizedStartStep: step,
      quantizedEndStep: step + 1,
      isDrum: true,
      velocity: 100,
    });
  };
  for (let s = 0; s < GRID_STEPS; s++) {
    const m = s % 16;
    switch (recipe) {
      case 'house':
      case 'disco':
        if (m % 4 === 0) pushDrum(36, s);
        if (m === 4 || m === 12) pushDrum(38, s);
        if (stepIsActive(s, recipe, rng)) pushDrum(42, s);
        break;
      case 'techno':
        if (m === 0 || m === 7 || m === 8) pushDrum(36, s);
        if (m === 4 || m === 12) pushDrum(38, s);
        if (rng() > 0.35) pushDrum(42, s);
        break;
      case 'swingish':
        if (m === 0 || m === 6 || m === 10) pushDrum(36, s);
        if (m === 4 || m === 12) pushDrum(38, s);
        if (rng() > 0.55) pushDrum(42, s);
        break;
      case 'boombap':
        if (m === 0 || m === 10 || (m === 6 && rng() > 0.55)) pushDrum(36, s);
        if (m === 4 || m === 12) {
          pushDrum(38, s);
          if (rng() > 0.45) pushDrum(39, s);
        }
        break;
      case 'lofi':
        if (m === 0 || (m === 8 && rng() > 0.35)) pushDrum(36, s);
        if (m === 4 || m === 12) pushDrum(38, s);
        if (rng() > 0.6) pushDrum(42, s);
        break;
      case 'dark':
        if ((m === 0 || m === 9) && rng() > 0.35) pushDrum(36, s);
        if ((m === 4 || m === 12) && rng() > 0.4) pushDrum(38, s);
        if (rng() > 0.65) pushDrum(42, s);
        break;
      default:
        if (m === 0 || m === 8) pushDrum(36, s);
        if (m === 4 || m === 12) {
          pushDrum(38, s);
          if (rng() > 0.5) pushDrum(42, s);
        }
        if (rng() > 0.72 && m % 2 === 1) pushDrum(42, s);
    }
  }
  return {
    notes,
    tempos: [{ time: 0, qpm: 120 }],
    quantizationInfo: { stepsPerQuarter: DRUM_STEPS_PER_QUARTER },
    totalQuantizedSteps: GRID_STEPS,
  } as INoteSequence;
}

function stepIsActive(s: number, recipe: string, rng: () => number): boolean {
  if (recipe === 'disco' && s % 4 === 2) return rng() > 0.35;
  return s % 2 === 0 && rng() > 0.15;
}

function drumNotesToGrid(ns: INoteSequence): boolean[][] {
  const grid: boolean[][] = Array.from({ length: 8 }, () => Array(GRID_STEPS).fill(false));
  for (const n of ns.notes || []) {
    if (n.quantizedStartStep == null || n.isDrum === false) continue;
    const pitch = n.pitch;
    if (pitch == null) continue;
    const isDrumHit = n.isDrum === true || (pitch >= 35 && pitch <= 81);
    if (!isDrumHit) continue;
    const step = n.quantizedStartStep % GRID_STEPS;
    const row = drumPitchToRow(pitch);
    if (row >= 0 && row < 8) grid[row][step] = true;
  }
  return grid;
}

/** Extra nudge from UI role — `basic_rnn` is one model; contour + mask fake piano vs bass vs lead. */
function buildMelodySeed(style: string | undefined, instrument: string, rng: () => number): INoteSequence {
  const ins = instrument.toLowerCase();
  const s = (style ?? '').toLowerCase();
  let transpose = 0;
  if (/(bass|southern|country|soul)/.test(s)) transpose = -5;
  else if (/(trap|dark|techno)/.test(s)) transpose = 2;
  else if (/(jazz|lo-?fi|lofi|blues|rnb|r&b)/.test(s)) transpose = -2;

  let base: number[];
  if (ins.includes('bass')) {
    transpose -= 4;
    base = [48, 50, 52, 53, 55, 52, 50, 48, 55, 57, 55, 53, 52, 50, 53, 50];
  } else if (ins.includes('piano') || ins.includes('keys')) {
    base = [60, 64, 67, 72, 67, 64, 60, 65, 69, 72, 76, 72, 69, 65, 64, 60];
  } else if (ins.includes('pad')) {
    base = [60, 60, 64, 64, 67, 67, 65, 65, 64, 64, 60, 60, 62, 62, 64, 64];
  } else if (ins.includes('lead')) {
    base = [60, 62, 67, 69, 72, 67, 65, 64, 72, 74, 76, 72, 69, 67, 65, 64];
  } else if (ins.includes('pluck') || ins.includes('guitar')) {
    base = [60, 62, 64, 67, 65, 64, 62, 60, 67, 65, 64, 62, 60, 62, 64, 67];
  } else if (ins.includes('string') || ins.includes('brass')) {
    base = [60, 64, 67, 71, 72, 71, 67, 64, 65, 69, 72, 74, 72, 69, 67, 65];
  } else if (ins.includes('percussion')) {
    base = [60, 57, 60, 55, 62, 60, 57, 55, 64, 62, 60, 57, 60, 62, 60, 57];
  } else {
    base = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 79, 76, 72, 69, 67, 65];
  }

  const notes = base.map((p, i) => ({
    pitch: Math.max(48, Math.min(83, p + transpose + Math.floor((rng() - 0.5) * 6))),
    quantizedStartStep: i * 2,
    quantizedEndStep: i * 2 + 2,
    program: 0,
    velocity: 100,
  }));
  return {
    notes,
    tempos: [{ time: 0, qpm: 120 }],
    quantizationInfo: { stepsPerQuarter: MELODY_STEPS_PER_QUARTER },
    totalQuantizedSteps: 32,
  } as INoteSequence;
}

function melodyRowMask(instrument: string): boolean[] {
  const ins = instrument.toLowerCase();
  if (ins.includes('bass')) return [true, true, false, false, false, false, false, false];
  if (ins.includes('pad')) return [false, false, false, false, true, true, true, true];
  if (ins.includes('lead')) return [false, false, false, false, true, true, true, true];
  if (ins.includes('pluck') || ins.includes('muted guitar'))
    return [false, false, false, false, true, true, true, false];
  if (ins.includes('string') || ins.includes('brass'))
    return [false, false, false, false, true, true, true, true];
  if (ins.includes('percussion')) return [true, true, true, true, false, false, false, false];
  return Array.from({ length: 8 }, () => true);
}

function melodyPitchToRow(pitch: number, mask: boolean[]): number {
  const enabled = mask.map((m, i) => (m ? i : -1)).filter((i): i is number => i >= 0);
  if (enabled.length === 0) return 0;
  const minP = 48;
  const maxP = 83;
  const t = Math.max(0, Math.min(1, (pitch - minP) / (maxP - minP || 1)));
  const idx = Math.min(enabled.length - 1, Math.floor(t * enabled.length));
  return enabled[idx]!;
}

function melodyNotesToGrid(ns: INoteSequence, mask: boolean[]): boolean[][] {
  const grid: boolean[][] = Array.from({ length: 8 }, () => Array(GRID_STEPS).fill(false));
  for (const n of ns.notes || []) {
    if (n.isDrum || n.quantizedStartStep == null) continue;
    const pitch = n.pitch;
    if (pitch == null) continue;
    const step = ((n.quantizedStartStep % GRID_STEPS) + GRID_STEPS) % GRID_STEPS;
    const row = melodyPitchToRow(pitch, mask);
    if (mask[row]) grid[row][step] = true;
  }
  return grid;
}

function gridHasContent(g: boolean[][]): boolean {
  return g.some((row) => row.some(Boolean));
}

/**
 * Try Magenta drum_kit_rnn continuation → 8×16 boolean grid. Returns null on failure or empty output.
 */
export async function tryGenerateDrumPatternWithMagenta(
  drumRecipe: string,
  temperature: number,
  rng: () => number,
): Promise<boolean[][] | null> {
  try {
    const rnn = await getDrumRnn();
    const seed = buildDrumSeed(drumRecipe, rng);
    const temp = Math.max(0.35, Math.min(2, temperature));
    const cont = await rnn.continueSequence(seed, GRID_STEPS, temp);
    const grid = drumNotesToGrid(cont);
    return gridHasContent(grid) ? grid : null;
  } catch (e) {
    console.warn('[Magenta] drum generation failed, using procedural fallback', e);
    return null;
  }
}

/**
 * Try Magenta basic_rnn continuation → 8×16 grid with instrument row mask. Returns null on failure or empty output.
 */
export async function tryGenerateMelodyPatternWithMagenta(
  instrument: string,
  style: string | undefined,
  temperature: number,
  rng: () => number,
): Promise<boolean[][] | null> {
  try {
    const rnn = await getMelodyRnn();
    const mask = melodyRowMask(instrument);
    const seed = buildMelodySeed(style, instrument, rng);
    const temp = Math.max(0.35, Math.min(2, temperature));
    const cont = await rnn.continueSequence(seed, 24, temp);
    const grid = melodyNotesToGrid(cont, mask);
    return gridHasContent(grid) ? grid : null;
  } catch (e) {
    console.warn('[Magenta] melody generation failed, using procedural fallback', e);
    return null;
  }
}
