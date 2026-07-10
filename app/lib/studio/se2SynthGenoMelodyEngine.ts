/**
 * Synth Geno melody — chord-locked phrases (Melody Sauce 3–style: contour over chord tones).
 */
import { mulberry32 } from '@/app/lib/groovePatternEngine';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import type { GenoHarmony, GenoBarChordSpec } from '@/app/lib/studio/se2SynthGenoChordEngine';
import {
  GENO_MELODY_MIDI_MAX,
  GENO_MELODY_MIDI_MIN,
  GENO_MELODY_REF_MIDI,
  genoMelodyCandidatesFromHarmony,
  genoMelodyRootFromHarmonyRoot,
  genoNormalizePartNotes,
  genoNormalizePluginMelodyNotes,
  genoPluginMelodyCandidatesFromHarmony,
  genoPluginMelodyRootFromHarmonyRoot,
  genoPluginMelodyUniformQuantStep,
  genoSnapPluginMelodyStartBeat,
  genoWrapMidiToRange,
  GENO_PLUGIN_MELODY_MIDI_MIN,
  GENO_PLUGIN_MELODY_MIDI_MAX,
} from '@/app/lib/studio/se2SynthGenoRanges';
import {
  SE2_GROOVE_LEAD_PITCH_DEFAULT_HI,
  SE2_GROOVE_LEAD_PITCH_DEFAULT_LO,
} from '@/app/lib/studio/se2GrooveLeadNotes';
import { snapMidiToNeuralHumScale } from '@/app/lib/vocalLab/neuralHumKeyLock';
import {
  genoMelodyPickPhraseTemplate,
  type GenoPhraseTemplate,
} from '@/app/lib/studio/se2SynthGenoMelodyPhrases';
import {
  genoPhraseBarRoot,
  genoPhraseChordTones,
  genoPhraseRenderTemplate,
  genoPhraseScaleBeat,
} from '@/app/lib/studio/se2SynthGenoPhraseHarmony';

/** Legacy + genre flavors for chord plugin / compose. */
export type GenoMelodyStyle = 'lyrical' | 'riff' | 'arp';

export type GenoMelodyGenre =
  | GenoMelodyStyle
  | 'pop'
  | 'rnb'
  | 'rnbFunk'
  | 'trap'
  | 'dance'
  | 'disco'
  | 'dark'
  | 'bright'
  | 'major'
  | 'minor'
  | 'kpop'
  | 'gospel';

type MelodyParams = {
  stepBeats: number;
  restChance: number;
  maxLeap: number;
  refMidi: number;
  durMul: number;
  syncopate: boolean;
  sparse: boolean;
  octaveHook: boolean;
  velBase: number;
  /** 0 = stay on chord tones, 1 = allow passing tones between chord tones */
  chordFit: number;
};

function scaleId(mode: StudioDetectedKeyMode): 'major' | 'minor' {
  return mode === 'minor' ? 'minor' : 'major';
}

function snapMelodyToKey(midi: number, keyRoot: number, keyMode: StudioDetectedKeyMode): number {
  return genoWrapMidiToRange(
    snapMidiToNeuralHumScale(midi, keyRoot, scaleId(keyMode)),
    GENO_MELODY_MIDI_MIN,
    GENO_MELODY_MIDI_MAX,
  );
}

function clampMelody(m: number): number {
  return genoWrapMidiToRange(m, GENO_MELODY_MIDI_MIN, GENO_MELODY_MIDI_MAX);
}

function paramsForGenre(genre: GenoMelodyGenre): MelodyParams {
  switch (genre) {
    case 'trap':
    case 'riff':
      return {
        stepBeats: 0.5,
        restChance: 0.52,
        maxLeap: 5,
        refMidi: 62,
        durMul: 0.82,
        syncopate: false,
        sparse: true,
        octaveHook: false,
        velBase: 74,
        chordFit: 0.92,
      };
    case 'rnb':
      return {
        stepBeats: 0.25,
        restChance: 0.28,
        maxLeap: 7,
        refMidi: GENO_MELODY_REF_MIDI + 2,
        durMul: 1.08,
        syncopate: true,
        sparse: false,
        octaveHook: false,
        velBase: 62,
        chordFit: 0.78,
      };
    case 'rnbFunk':
      return {
        stepBeats: 0.25,
        restChance: 0.18,
        maxLeap: 9,
        refMidi: GENO_MELODY_REF_MIDI + 1,
        durMul: 1.18,
        syncopate: true,
        sparse: false,
        octaveHook: true,
        velBase: 56,
        chordFit: 0.7,
      };
    case 'dance':
      return {
        stepBeats: 0.25,
        restChance: 0.12,
        maxLeap: 6,
        refMidi: GENO_MELODY_REF_MIDI + 2,
        durMul: 0.88,
        syncopate: false,
        sparse: false,
        octaveHook: true,
        velBase: 78,
        chordFit: 0.82,
      };
    case 'disco':
      return {
        stepBeats: 0.25,
        restChance: 0.16,
        maxLeap: 9,
        refMidi: GENO_MELODY_REF_MIDI + 5,
        durMul: 1.05,
        syncopate: false,
        sparse: false,
        octaveHook: true,
        velBase: 80,
        chordFit: 0.75,
      };
    case 'dark':
      return {
        stepBeats: 0.5,
        restChance: 0.42,
        maxLeap: 5,
        refMidi: GENO_MELODY_REF_MIDI,
        durMul: 1.1,
        syncopate: true,
        sparse: true,
        octaveHook: false,
        velBase: 58,
        chordFit: 0.85,
      };
    case 'minor':
      return {
        stepBeats: 0.5,
        restChance: 0.3,
        maxLeap: 6,
        refMidi: GENO_MELODY_REF_MIDI - 1,
        durMul: 1.02,
        syncopate: true,
        sparse: false,
        octaveHook: false,
        velBase: 64,
        chordFit: 0.82,
      };
    case 'bright':
      return {
        stepBeats: 0.5,
        restChance: 0.18,
        maxLeap: 8,
        refMidi: GENO_MELODY_REF_MIDI + 7,
        durMul: 1.08,
        syncopate: false,
        sparse: false,
        octaveHook: false,
        velBase: 82,
        chordFit: 0.72,
      };
    case 'major':
      return {
        stepBeats: 0.5,
        restChance: 0.22,
        maxLeap: 7,
        refMidi: GENO_MELODY_REF_MIDI + 2,
        durMul: 1.0,
        syncopate: false,
        sparse: false,
        octaveHook: false,
        velBase: 76,
        chordFit: 0.78,
      };
    case 'kpop':
      return {
        stepBeats: 0.25,
        restChance: 0.12,
        maxLeap: 7,
        refMidi: GENO_MELODY_REF_MIDI + 4,
        durMul: 0.9,
        syncopate: false,
        sparse: false,
        octaveHook: true,
        velBase: 80,
        chordFit: 0.8,
      };
    case 'gospel':
      return {
        stepBeats: 0.5,
        restChance: 0.24,
        maxLeap: 6,
        refMidi: GENO_MELODY_REF_MIDI + 3,
        durMul: 1.0,
        syncopate: true,
        sparse: false,
        octaveHook: false,
        velBase: 72,
        chordFit: 0.8,
      };
    case 'arp':
      return {
        stepBeats: 0.25,
        restChance: 0,
        maxLeap: 12,
        refMidi: GENO_MELODY_REF_MIDI,
        durMul: 0.72,
        syncopate: false,
        sparse: false,
        octaveHook: false,
        velBase: 70,
        chordFit: 1,
      };
    case 'pop':
    case 'lyrical':
    default:
      return {
        stepBeats: 0.5,
        restChance: 0.26,
        maxLeap: 6,
        refMidi: GENO_MELODY_REF_MIDI,
        durMul: 0.92,
        syncopate: false,
        sparse: false,
        octaveHook: false,
        velBase: 72,
        chordFit: 0.8,
      };
  }
}

function chordTonesForBar(col: { rootMidi: number; tones: readonly number[] }): number[] {
  return [...new Set(genoMelodyCandidatesFromHarmony(col))].sort((a, b) => a - b);
}

/** Pick next melody pitch — step through chord tones, not repeat same note every hit. */
function pickMelodyMotionTone(
  cursor: number,
  tones: readonly number[],
  barRoot: number,
  hintIndex: number,
  maxLeap: number,
  allowRepeat: boolean,
  rnd: () => number,
): number {
  if (tones.length === 0) return barRoot;
  if (tones.length === 1) return tones[0]!;

  const hint = tones[Math.min(hintIndex, tones.length - 1)]!;
  const different = tones.filter((t) => allowRepeat || t !== cursor);

  const scored = different.map((t) => {
    const step = Math.abs(t - cursor);
    const hintBias = t === hint ? -0.35 : 0;
    const rootBias = t === barRoot ? 0.15 : 0;
    const repeatPenalty = t === cursor ? 2.5 : 0;
    return { t, score: step + hintBias + rootBias + repeatPenalty + rnd() * 0.55 };
  });

  scored.sort((a, b) => a.score - b.score);

  for (const { t } of scored) {
    if (Math.abs(t - cursor) <= maxLeap + 1) return t;
  }
  return scored[0]?.t ?? hint;
}

/** Contour indices into sorted chord-tone list (root → color → top). */
function contourForBar(
  genre: GenoMelodyGenre,
  toneCount: number,
  bar: number,
  rnd: () => number,
): number[] {
  const n = Math.max(1, toneCount);
  const i1 = Math.min(1, n - 1);
  const i2 = Math.min(2, n - 1);
  const iTop = n - 1;

  const patterns: Record<string, number[][]> = {
    trap: [
      [0, 0, i2, 0],
      [0, i2, 0, 0],
      [0, i1, 0, i2],
    ],
    rnb: [
      [0, i1, i2, i1],
      [0, i2, i1, iTop],
      [i1, i2, i1, 0],
    ],
    arp: [Array.from({ length: 8 }, (_, k) => k % n)],
    pop: [
      [0, i1, i2, i1],
      [0, i2, i1, 0],
      [i1, i2, iTop, i2],
      [0, i1, i1, i2],
    ],
    bright: [
      [i1, i2, iTop, i2],
      [0, i2, iTop, i1],
      [i2, iTop, i2, i1],
    ],
    dark: [
      [0, i1, 0, i1],
      [i1, 0, i1, 0],
      [0, 0, i1, 0],
    ],
    minor: [
      [0, i1, i2, i1],
      [i1, 0, i2, i1],
      [0, i1, 0, i2],
    ],
    major: [
      [0, i1, i2, i1],
      [0, i2, i1, i2],
      [i1, i2, i1, 0],
    ],
    kpop: [
      [0, i2, iTop, i2],
      [i1, iTop, i2, i1],
      [0, i2, i1, iTop],
    ],
  };

  const pool =
    patterns[genre] ??
    patterns[genre === 'dance' || genre === 'disco' || genre === 'bright' ? 'bright' : 'pop'] ??
    patterns.pop!;
  return pool[(bar + Math.floor(rnd() * pool.length)) % pool.length]!;
}

function rhythmOffsetsForBar(
  genre: GenoMelodyGenre,
  beatsPerBar: number,
  bar: number,
  rnd: () => number,
): number[] {
  const bpb = Math.max(1, beatsPerBar);
  if (genre === 'arp') {
    const steps = Math.max(4, Math.floor(bpb / 0.25));
    return Array.from({ length: steps }, (_, i) => i * 0.25).filter((t) => t < bpb);
  }
  if (genre === 'rnb' || genre === 'rnbFunk') {
    const sets =
      bpb >= 4
        ? [
            [0, 0.75, 1.5, 2.5, 3.25],
            [0, 1, 1.75, 2.5, 3.5],
            [0, 0.5, 1.5, 2.25, 3],
          ]
        : [[0, 0.5, 1, 1.5]];
    return sets[(bar + Math.floor(rnd() * sets.length)) % sets.length]!;
  }
  if (genre === 'trap' || genre === 'dark' || genre === 'minor') {
    const sets =
      bpb >= 4
        ? [
            [0, 1.5, 3],
            [0, 2],
            [0, 1, 2.5],
          ]
        : [[0, 1]];
    return sets[(bar + Math.floor(rnd() * sets.length)) % sets.length]!;
  }
  if (genre === 'kpop') {
    const sets =
      bpb >= 4
        ? [
            [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
            [0, 1, 1.5, 2.5, 3],
            [0, 0.5, 2, 2.5, 3.5],
          ]
        : [[0, 0.5, 1, 1.5]];
    return sets[(bar + Math.floor(rnd() * sets.length)) % sets.length]!;
  }
  const sets =
    bpb >= 4
      ? [
          [0, 1, 2, 3],
          [0, 0.5, 2, 3],
          [0, 1.5, 2.5, 3.5],
          [0, 1, 2.5, 3],
        ]
      : [[0, 0.5, 1, 1.5]];
  return sets[(bar + Math.floor(rnd() * sets.length)) % sets.length]!;
}

function shouldRest(
  genre: GenoMelodyGenre,
  slot: number,
  slots: number,
  bar: number,
  rnd: () => number,
  p: MelodyParams,
): boolean {
  if (genre === 'arp') return false;
  if (p.sparse && slot > 0 && rnd() < p.restChance) return true;
  if (p.syncopate && slot % 2 === 1 && rnd() < 0.35) return true;
  if (slot > 0 && rnd() < p.restChance * 0.65) return true;
  void bar;
  void slots;
  return false;
}

/** Snap melody to chord root in that bar (Chord Generator — not voicing arpeggio). */
export function genoLockMelodyNotesToHarmonyRoot(
  notes: readonly StudioEditor2GenNote[],
  harmony: GenoHarmony,
  beatsPerBar: number,
): StudioEditor2GenNote[] {
  if (notes.length === 0 || harmony.columns.length === 0) return [...notes];
  const bpb = Math.max(1, beatsPerBar);
  return notes.map((n) => {
    const bar = Math.min(
      harmony.columns.length - 1,
      Math.max(0, Math.floor(n.startBeat / bpb)),
    );
    const col = harmony.columns[bar];
    if (!col) return n;
    return { ...n, pitch: clampMelody(genoMelodyRootFromHarmonyRoot(col.rootMidi)) };
  });
}

/** Snap melody to nearest chord tone in that bar (Live arp / legacy compose). */
export function genoLockMelodyNotesToHarmony(
  notes: readonly StudioEditor2GenNote[],
  harmony: GenoHarmony,
  beatsPerBar: number,
): StudioEditor2GenNote[] {
  if (notes.length === 0 || harmony.columns.length === 0) return [...notes];
  const bpb = Math.max(1, beatsPerBar);
  return notes.map((n) => {
    const bar = Math.min(
      harmony.columns.length - 1,
      Math.max(0, Math.floor(n.startBeat / bpb)),
    );
    const col = harmony.columns[bar];
    if (!col) return n;
    const tones = chordTonesForBar(col);
    if (tones.length === 0) return n;
    let best = tones[0]!;
    let bestDist = Math.abs(n.pitch - best);
    for (const t of tones) {
      const d = Math.abs(n.pitch - t);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return { ...n, pitch: clampMelody(best) };
  });
}

/** One pitch-class per chord color in plugin lead register (root → extensions). */
function genoPluginLeadChordToneStack(col: {
  rootMidi: number;
  tones: readonly number[];
}): number[] {
  const rootPitch = genoPluginMelodyRootFromHarmonyRoot(col.rootMidi);
  const rootPc = ((rootPitch % 12) + 12) % 12;
  const pool = genoPluginMelodyCandidatesFromHarmony(col);

  const byPc = new Map<number, number>();
  byPc.set(rootPc, rootPitch);

  for (const t of pool) {
    const pc = ((t % 12) + 12) % 12;
    const wrapped = genoWrapMidiToRange(t, GENO_PLUGIN_MELODY_MIDI_MIN, GENO_PLUGIN_MELODY_MIDI_MAX);
    const existing = byPc.get(pc);
    if (existing == null || Math.abs(wrapped - rootPitch) < Math.abs(existing - rootPitch)) {
      byPc.set(pc, wrapped);
    }
  }

  const stack = [byPc.get(rootPc)!];
  for (const pitch of [...byPc.values()].sort((a, b) => a - b)) {
    if (!stack.includes(pitch)) stack.push(pitch);
  }
  return stack;
}

/** Snap B2 plugin melody to chord-tone stack; downbeats lock to the bar root. */
export function genoLockPluginMelodyNotesToHarmony(
  notes: readonly StudioEditor2GenNote[],
  harmony: GenoHarmony,
  beatsPerBar: number,
  barChordSpecs?: readonly GenoBarChordSpec[],
): StudioEditor2GenNote[] {
  if (notes.length === 0 || harmony.columns.length === 0) return [...notes];
  const bpb = Math.max(1, beatsPerBar);
  const step = genoPluginMelodyUniformQuantStep(bpb, barChordSpecs);
  const downbeatTol = Math.max(step * 0.21, bpb / 48);
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  let prevPitch: number | null = null;
  const out: StudioEditor2GenNote[] = [];

  for (const n of sorted) {
    const bar = Math.min(
      harmony.columns.length - 1,
      Math.max(0, Math.floor(n.startBeat / bpb + 1e-9)),
    );
    const col = harmony.columns[bar];
    if (!col) {
      out.push(n);
      continue;
    }
    const stack = genoPluginLeadChordToneStack(col);
    if (stack.length === 0) {
      out.push(n);
      continue;
    }

    const rel = n.startBeat - bar * bpb;
    const onDownbeat = rel < downbeatTol;
    let pitch = stack[0]!;
    if (!onDownbeat) {
      let hint = stack[0]!;
      let hintDist = Math.abs(n.pitch - hint);
      for (const t of stack) {
        const d = Math.abs(n.pitch - t);
        if (d < hintDist) {
          hintDist = d;
          hint = t;
        }
      }
      if (prevPitch != null) {
        let best = stack[0]!;
        let bestScore = Number.POSITIVE_INFINITY;
        for (const t of stack) {
          const leap = Math.abs(t - prevPitch);
          let score = leap * 2.4;
          if (t === hint) score -= 5;
          if (leap <= 2) score -= 6;
          if (t === stack[0]) score -= 1.5;
          if (score < bestScore) {
            bestScore = score;
            best = t;
          }
        }
        pitch = best;
      } else {
        pitch = hint;
      }
    }

    out.push({
      ...n,
      pitch: genoWrapMidiToRange(pitch, GENO_PLUGIN_MELODY_MIDI_MIN, GENO_PLUGIN_MELODY_MIDI_MAX),
    });
    prevPitch = pitch;
  }

  return out;
}

/** Groove Lead (Melodio) — voiced chord PCs in C4–C6; no downbeat-root collapse. */
export function genoGrooveLeadChordToneStack(col: {
  rootMidi: number;
  tones: readonly number[];
}): number[] {
  const lo = SE2_GROOVE_LEAD_PITCH_DEFAULT_LO;
  const hi = SE2_GROOVE_LEAD_PITCH_DEFAULT_HI;
  const rootPc = ((genoWrapMidiToRange(col.rootMidi, lo, hi) % 12) + 12) % 12;
  const byPc = new Map<number, number>();
  byPc.set(rootPc, genoWrapMidiToRange(col.rootMidi, lo, hi));

  for (const raw of col.tones) {
    const wrapped = genoWrapMidiToRange(Math.round(raw), lo, hi);
    const pc = ((wrapped % 12) + 12) % 12;
    const existing = byPc.get(pc);
    if (existing == null || Math.abs(wrapped - 76) < Math.abs(existing - 76)) {
      byPc.set(pc, wrapped);
    }
  }

  const stack = [...byPc.values()].sort((a, b) => a - b);
  return stack.length > 0 ? stack : [genoWrapMidiToRange(76, lo, hi)];
}

/** Melodio-style lock — keep contour + voice-leading; never force bar downbeat to root. */
export function genoLockGrooveLeadNotesToHarmony(
  notes: readonly StudioEditor2GenNote[],
  harmony: GenoHarmony,
  beatsPerBar: number,
): StudioEditor2GenNote[] {
  if (notes.length === 0 || harmony.columns.length === 0) return [...notes];
  const bpb = Math.max(1, beatsPerBar);
  const lo = SE2_GROOVE_LEAD_PITCH_DEFAULT_LO;
  const hi = SE2_GROOVE_LEAD_PITCH_DEFAULT_HI;
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  let prevPitch: number | null = null;
  const out: StudioEditor2GenNote[] = [];

  for (const n of sorted) {
    const bar = Math.min(
      harmony.columns.length - 1,
      Math.max(0, Math.floor(n.startBeat / bpb + 1e-9)),
    );
    const col = harmony.columns[bar];
    if (!col) {
      out.push(n);
      continue;
    }
    const stack = genoGrooveLeadChordToneStack(col);
    if (stack.length === 0) {
      out.push(n);
      continue;
    }

    const target = genoWrapMidiToRange(n.pitch, lo, hi);
    let best = stack[0]!;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const t of stack) {
      const hintDist = Math.abs(t - target);
      let score = hintDist * 1.8;
      if (prevPitch != null) {
        const leap = Math.abs(t - prevPitch);
        score += leap * 2.2;
        if (leap <= 2) score -= 7;
        if (leap > 6) score += 10;
        if (t === prevPitch) score += 4;
      }
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }

    const pitch = genoWrapMidiToRange(best, lo, hi);
    out.push({ ...n, pitch });
    prevPitch = pitch;
  }

  return out;
}

/** Contour indices into sorted chord-tone list (root → color → top). */
export function genoMelodyContourForBar(
  genre: GenoMelodyGenre,
  toneCount: number,
  bar: number,
  rnd: () => number,
): number[] {
  return contourForBar(genre, toneCount, bar, rnd);
}

/** Pick next phrase pitch — step through chord tones with smooth motion. */
export function genoMelodyPickMotionTone(
  cursor: number,
  tones: readonly number[],
  barRoot: number,
  hintIndex: number,
  maxLeap: number,
  allowRepeat: boolean,
  rnd: () => number,
): number {
  return pickMelodyMotionTone(cursor, tones, barRoot, hintIndex, maxLeap, allowRepeat, rnd);
}

/**
 * SongEngine-style melodic phrase — lyrical templates with dyads + cross-bar continuity.
 */
export function genoPhraseMelodyNotesForBar(
  bar: number,
  col: { rootMidi: number; tones: readonly number[] },
  opts: {
    beatsPerBar: number;
    barCount: number;
    style: GenoMelodyGenre;
    keyRoot: number;
    keyMode: StudioDetectedKeyMode;
    rnd: () => number;
    maxLeap?: number;
    lastPitch?: number;
    /** B2 Chord Generator — lower register + plugin chord-tone map. */
    pluginRegister?: boolean;
    /** Tiled loop slot — same rhythm when the progression repeats (bar 5 = bar 1). */
    phraseTemplate?: GenoPhraseTemplate;
    barChordSpecs?: readonly GenoBarChordSpec[];
  },
): StudioEditor2GenNote[] {
  const barRoot = opts.pluginRegister
    ? genoPluginMelodyRootFromHarmonyRoot(col.rootMidi)
    : genoPhraseBarRoot(col);
  const tones = opts.pluginRegister
    ? genoPluginLeadChordToneStack(col)
    : genoPhraseChordTones(col);
  if (tones.length === 0) {
    if (opts.pluginRegister) {
      return [
        {
          pitch: barRoot,
          startBeat: bar * opts.beatsPerBar,
          durationBeats: Math.max(0.35, opts.beatsPerBar * 0.5),
          velocity: 72,
        },
      ];
    }
    return [];
  }

  const p = paramsForGenre(opts.style);
  const template =
    opts.phraseTemplate ?? genoMelodyPickPhraseTemplate(opts.style, bar, opts.rnd);
  let notes = genoPhraseRenderTemplate(template, {
    bar,
    beatsPerBar: opts.beatsPerBar,
    barCount: opts.barCount,
    tones,
    barRoot,
    velBase: p.velBase + (opts.pluginRegister ? 0 : 4),
    rnd: opts.rnd,
    steadyDurations: opts.pluginRegister === true,
    monophonic: opts.pluginRegister === true,
  });

  if (opts.pluginRegister) {
    const step = genoPluginMelodyUniformQuantStep(opts.beatsPerBar, opts.barChordSpecs);
    notes = notes.map((n) => {
      const startBeat = genoSnapPluginMelodyStartBeat(
        n.startBeat,
        opts.beatsPerBar,
        opts.barCount,
        opts.barChordSpecs,
      );
      const noteBar = Math.floor(startBeat / opts.beatsPerBar + 1e-9);
      const barEnd = (noteBar + 1) * opts.beatsPerBar;
      const maxDur = Math.max(step * 0.5, barEnd - startBeat - step * 0.25);
      const durationBeats = Math.max(
        step * 0.5,
        Math.min(n.durationBeats, maxDur),
        Math.round(Math.min(n.durationBeats, maxDur) / step) * step,
      );
      return { ...n, startBeat, durationBeats };
    });
  }

  if (notes.length === 0) {
    notes = [
      {
        pitch: barRoot,
        startBeat: bar * opts.beatsPerBar,
        durationBeats: Math.max(0.35, opts.beatsPerBar * 0.5),
        velocity: Math.min(110, p.velBase + 6),
      },
    ];
  }

  return notes;
}

function melodyLastPitch(notes: readonly StudioEditor2GenNote[]): number | undefined {
  if (notes.length === 0) return undefined;
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);
  return sorted[sorted.length - 1]?.pitch;
}

/**
 * Gino Build 2 — phrase repeat length for melody generation.
 * In 8-bar mode use the full timeline so bar 7 does not reuse bar 1's contour early.
 */
function genoPluginMelodyTiledLoopBars(harmony: GenoHarmony, barCount: number): number {
  if (barCount === 8 || barCount === 4) return barCount;
  const cols = harmony.columns;
  const n = Math.min(Math.max(1, barCount), cols.length);
  if (n <= 1) return 1;
  for (let period = 1; period <= n; period += 1) {
    let tiles = true;
    for (let bar = period; bar < barCount; bar += 1) {
      const cur = cols[bar];
      const ref = cols[bar % period];
      if (!cur || !ref) continue;
      if (cur.rootMidi !== ref.rootMidi) {
        tiles = false;
        break;
      }
    }
    if (tiles) return period;
  }
  return n;
}

/** Chord Generator — phrase contours over voiced chord tones (SongEngine-style). */
export function genoGeneratePluginMelodyFromHarmony(opts: {
  harmony: GenoHarmony;
  barCount: number;
  beatsPerBar: number;
  style: GenoMelodyGenre;
  seed: number;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  barChordSpecs?: readonly GenoBarChordSpec[];
}): StudioEditor2GenNote[] {
  const rnd = mulberry32(opts.seed ^ 0x4d454c);
  const notes: StudioEditor2GenNote[] = [];
  let lastPitch: number | undefined;
  const loopBars = genoPluginMelodyTiledLoopBars(opts.harmony, opts.barCount);
  const phraseByLoopBar = new Map<number, GenoPhraseTemplate>();

  for (let bar = 0; bar < opts.barCount; bar += 1) {
    const col = opts.harmony.columns[bar];
    if (!col) continue;
    const loopBar = bar % loopBars;
    let phraseTemplate = phraseByLoopBar.get(loopBar);
    if (!phraseTemplate) {
      phraseTemplate = genoMelodyPickPhraseTemplate(opts.style, loopBar, rnd);
      phraseByLoopBar.set(loopBar, phraseTemplate);
    }
    const barNotes = genoPhraseMelodyNotesForBar(bar, col, {
      beatsPerBar: opts.beatsPerBar,
      barCount: opts.barCount,
      style: opts.style,
      keyRoot: opts.keyRoot,
      keyMode: opts.keyMode,
      rnd,
      lastPitch,
      pluginRegister: true,
      phraseTemplate,
      barChordSpecs: opts.barChordSpecs,
    });
    notes.push(...barNotes);
    lastPitch = melodyLastPitch(barNotes) ?? lastPitch;
  }

  const locked = genoLockPluginMelodyNotesToHarmony(
    notes,
    opts.harmony,
    opts.beatsPerBar,
    opts.barChordSpecs,
  );
  return genoNormalizePluginMelodyNotes(
    locked,
    opts.beatsPerBar,
    opts.barCount,
    opts.barChordSpecs,
  );
}

/** Regenerate melody for one loop bar only (Chord Generator). */
export function genoGeneratePluginMelodyForBar(opts: {
  harmony: GenoHarmony;
  bar: number;
  beatsPerBar: number;
  barCount: number;
  style: GenoMelodyGenre;
  seed: number;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  barChordSpecs?: readonly GenoBarChordSpec[];
}): StudioEditor2GenNote[] {
  const col = opts.harmony.columns[opts.bar];
  if (!col) return [];
  const loopBars = genoPluginMelodyTiledLoopBars(opts.harmony, opts.barCount);
  const loopBar = opts.bar % loopBars;
  const rnd = mulberry32(opts.seed ^ 0x4d454c ^ loopBar * 977);
  const notes = genoPhraseMelodyNotesForBar(opts.bar, col, {
    beatsPerBar: opts.beatsPerBar,
    barCount: opts.barCount,
    style: opts.style,
    keyRoot: opts.keyRoot,
    keyMode: opts.keyMode,
    rnd,
    pluginRegister: true,
    phraseTemplate: genoMelodyPickPhraseTemplate(opts.style, loopBar, rnd),
    barChordSpecs: opts.barChordSpecs,
  });
  const locked = genoLockPluginMelodyNotesToHarmony(
    notes,
    opts.harmony,
    opts.beatsPerBar,
    opts.barChordSpecs,
  );
  return genoNormalizePluginMelodyNotes(
    locked,
    opts.beatsPerBar,
    opts.barCount,
    opts.barChordSpecs,
  );
}

export function genoGenerateMelodyFromHarmony(opts: {
  harmony: GenoHarmony;
  barCount: number;
  beatsPerBar: number;
  style: GenoMelodyGenre;
  seed: number;
  maxLeap?: number;
  keyRoot?: number;
  keyMode?: StudioDetectedKeyMode;
  lyricalGrid?: boolean;
}): StudioEditor2GenNote[] {
  if (opts.lyricalGrid && opts.keyRoot != null && opts.keyMode) {
    return genoGeneratePluginMelodyFromHarmony({
      harmony: opts.harmony,
      barCount: opts.barCount,
      beatsPerBar: opts.beatsPerBar,
      style: opts.style,
      seed: opts.seed,
      keyRoot: opts.keyRoot,
      keyMode: opts.keyMode,
    });
  }

  const rnd = mulberry32(opts.seed ^ 0x4d454c);
  const keyRoot = opts.keyRoot ?? 0;
  const keyMode = opts.keyMode ?? 'major';
  const notes: StudioEditor2GenNote[] = [];
  let lastPitch: number | undefined;

  for (let bar = 0; bar < opts.barCount; bar += 1) {
    const col = opts.harmony.columns[bar];
    if (!col) continue;
    const barNotes = genoPhraseMelodyNotesForBar(bar, col, {
      beatsPerBar: opts.beatsPerBar,
      barCount: opts.barCount,
      style: opts.style,
      keyRoot,
      keyMode,
      rnd,
      maxLeap: opts.maxLeap,
      lastPitch,
    });
    notes.push(...barNotes);
    lastPitch = melodyLastPitch(barNotes) ?? lastPitch;
  }

  const locked = genoLockMelodyNotesToHarmony(notes, opts.harmony, opts.beatsPerBar);
  return genoNormalizePartNotes(locked, 'melody');
}

export function melodyHasRepeaterLikeSpacing(notes: readonly StudioEditor2GenNote[]): boolean {
  if (notes.length < 5) return false;
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);
  let tight = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = sorted[i]!.startBeat - sorted[i - 1]!.startBeat;
    if (gap > 0.01 && gap <= 0.55) tight += 1;
  }
  return tight / (sorted.length - 1) > 0.32;
}

/** True when melody hits many non-root chord tones (old voicing arpeggio path). */
export function melodyLooksLikeVoicingArpeggio(
  notes: readonly StudioEditor2GenNote[],
  harmony: GenoHarmony,
  beatsPerBar: number,
): boolean {
  if (notes.length < 4 || harmony.columns.length === 0) return false;
  const bpb = Math.max(1, beatsPerBar);
  let offRoot = 0;
  for (const n of notes) {
    const bar = Math.min(
      harmony.columns.length - 1,
      Math.max(0, Math.floor(n.startBeat / bpb)),
    );
    const col = harmony.columns[bar];
    if (!col) continue;
    const root = genoMelodyRootFromHarmonyRoot(col.rootMidi);
    const onRoot = Math.abs(n.pitch - root) <= 1 || Math.abs(n.pitch - root - 12) <= 1;
    if (!onRoot) offRoot += 1;
  }
  return offRoot / notes.length > 0.2;
}

export function genoMelodyGenreFromStyle(
  styleChip: GenoMelodyStyle,
  chordStyle?: string,
): GenoMelodyGenre {
  if (styleChip === 'riff') return 'trap';
  if (styleChip === 'arp') return 'arp';
  if (chordStyle && chordStyle !== 'default') return chordStyle as GenoMelodyGenre;
  return 'pop';
}
