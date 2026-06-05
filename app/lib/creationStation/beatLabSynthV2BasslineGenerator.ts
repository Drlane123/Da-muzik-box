import type { ChordMode, ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import { chordSymbolToRootMidi } from '@/app/lib/creationStation/chordBuilder';
import {
  beatLabStepsPerBar,
  type BeatLabImportedChordRail,
} from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import {
  beatLabMelodicLanePitch,
  type BeatLabMidiNote,
} from '@/app/lib/creationStation/beatLabMidiRoll';
import { parseChordSymbolToken } from '@/app/lib/creationStation/chordProgressionParse';
import {
  GROOVE_LAB_CHORD_ROLL_MIDI_MIN,
  grooveLabClampBassRootMidi,
  grooveLabInferBassRootFromChordMidis,
} from '@/app/lib/creationStation/grooveLabPitch';

function voiceLead(prev: number, midi: number): number {
  let m = midi;
  while (m - prev > 7) m -= 12;
  while (prev - m > 7) m += 12;
  return Math.max(21, Math.min(60, m));
}

/** Groove / letter-name chords (C, Am7) — not Roman numerals in MODE_TABLES. */
export function beatLabSynthV2RootMidiFromChordLabel(
  label: string,
  keyRoot = 0,
  baseOct = 2,
): number | null {
  const parsed = parseChordSymbolToken(label.trim());
  if (!parsed) return null;
  return grooveLabClampBassRootMidi(12 * (baseOct + 1) + ((keyRoot + parsed.rootPc) % 12));
}

/** Chord rail symbol: letter name (Groove) or Roman (Chord Builder). */
export function beatLabSynthV2ResolveChordRootMidi(
  symbol: string,
  keyRoot: number,
  mode: ChordMode,
  baseOct = 2,
): number | null {
  const fromLabel = beatLabSynthV2RootMidiFromChordLabel(symbol, keyRoot, baseOct);
  if (fromLabel != null) return fromLabel;
  return chordSymbolToRootMidi(symbol as ChordSymbol, keyRoot, mode, baseOct);
}

function midisInBar(
  laneNotes: readonly BeatLabMidiNote[],
  lane: number,
  c0: number,
  c1: number,
  includeMuted: boolean,
  midiAtNote: (n: BeatLabMidiNote) => number,
): number[] {
  const midis: number[] = [];
  for (const n of laneNotes) {
    if (n.lane !== lane || (n.muted && !includeMuted)) continue;
    if (n.col < c0 || n.col >= c1) continue;
    midis.push(midiAtNote(n));
  }
  return midis;
}

function inferRootInBar(
  midis: readonly number[],
  keyRoot: number,
  mode: ChordMode,
  prevMidi: number,
): number {
  if (midis.length === 0) return prevMidi;
  const ref = grooveLabClampBassRootMidi(prevMidi);
  return voiceLead(prevMidi, grooveLabInferBassRootFromChordMidis(midis, keyRoot, mode, ref));
}

/** Step columns that hold chord stacks and/or C4+ harmony (Groove Lab voicing). */
export function beatLabSynthV2HarmonyColumnsOnLane(
  notes: readonly BeatLabMidiNote[],
  lane: number,
  midiAtNote: (n: BeatLabMidiNote) => number,
): Set<number> {
  const harmony = new Set(beatLabSynthV2ChordColumnsOnLane(notes, lane));
  for (const n of notes) {
    if (n.lane !== lane) continue;
    if (midiAtNote(n) >= GROOVE_LAB_CHORD_ROLL_MIDI_MIN) harmony.add(n.col);
  }
  return harmony;
}

/** Every generated bar gets a root hit on beat 1; keep syncopation after it. */
function barPatternWithDownbeat(hits: BarHit[]): BarHit[] {
  if (hits.length === 0) return [{ start: 0, dur: 1, semiOff: 0 }];
  const tail = hits
    .filter((h) => h.start > 0.02)
    .sort((a, b) => a.start - b.start);
  const gap = tail.length > 0 ? Math.min(0.5, tail[0]!.start) : 1;
  return [{ start: 0, dur: Math.max(0.125, gap), semiOff: 0 }, ...tail];
}

/** Root midi per bar from imported chord rail symbols only. */
export function beatLabSynthV2ChordRootMidiPerBar(opts: {
  chordRail?: BeatLabImportedChordRail | null;
  layoutBars: number;
  baseOct?: number;
}): number[] {
  const rail = opts.chordRail;
  const keyRoot = rail?.keyRoot ?? 0;
  const mode = rail?.mode ?? 'minor';
  const baseOct = opts.baseOct ?? 2;
  let prevMidi = 12 * (baseOct + 1) + keyRoot;
  const roots: number[] = [];
  for (let bar = 0; bar < opts.layoutBars; bar += 1) {
    const symbol = rail?.timeline[bar]?.chord ?? null;
    let midi =
      symbol != null ? beatLabSynthV2ResolveChordRootMidi(symbol, keyRoot, mode, baseOct) : null;
    if (midi == null) midi = prevMidi;
    midi = voiceLead(prevMidi, midi);
    prevMidi = midi;
    roots.push(midi);
  }
  return roots;
}

/** Lowest pitch per bar from NEW SYNTH piano roll (Groove Lab drop or hand-drawn chords). */
export function beatLabSynthV2RootsFromPianoRoll(opts: {
  notes: readonly BeatLabMidiNote[];
  lane: number;
  layoutBars: number;
  stepsPerBar: number;
  midiAtNote: (n: BeatLabMidiNote) => number;
  /** Bass generator: still read muted chord stacks for roots. */
  includeMutedHarmony?: boolean;
  keyRoot?: number;
  mode?: ChordMode;
}): { roots: number[]; hasHarmony: boolean } {
  const { notes, lane, layoutBars, stepsPerBar, midiAtNote, includeMutedHarmony } = opts;
  const keyRoot = opts.keyRoot ?? 0;
  const mode = opts.mode ?? 'major';
  let prev = grooveLabClampBassRootMidi(12 * 3 + keyRoot);
  let hasHarmony = false;
  const roots: number[] = [];
  for (let bar = 0; bar < layoutBars; bar += 1) {
    const c0 = bar * stepsPerBar;
    const c1 = (bar + 1) * stepsPerBar;
    const midis = midisInBar(notes, lane, c0, c1, includeMutedHarmony === true, midiAtNote);
    if (midis.length > 0) {
      hasHarmony = true;
      prev = inferRootInBar(midis, keyRoot, mode, prev);
      roots.push(prev);
    } else {
      roots.push(prev);
    }
  }
  return { roots, hasHarmony };
}

/**
 * Per-bar roots: chord rail symbol when present, else piano-roll chord inference per bar.
 * (Groove Lab → NEW SYNTH roll, or chords drawn in roll.)
 */
export function beatLabSynthV2ResolveRootsPerBar(opts: {
  chordRail?: BeatLabImportedChordRail | null;
  laneNotes: readonly BeatLabMidiNote[];
  lane: number;
  layoutBars: number;
  stepsPerBar: number;
  midiAtNote: (n: BeatLabMidiNote) => number;
  baseOct?: number;
  includeMutedHarmony?: boolean;
}): number[] {
  const baseOct = opts.baseOct ?? 2;
  const railRoots = beatLabSynthV2ChordRootMidiPerBar({
    chordRail: opts.chordRail,
    layoutBars: opts.layoutBars,
    baseOct,
  });
  const keyRoot = opts.chordRail?.keyRoot ?? 0;
  const mode = opts.chordRail?.mode ?? 'major';
  const roll = beatLabSynthV2RootsFromPianoRoll({
    notes: opts.laneNotes,
    lane: opts.lane,
    layoutBars: opts.layoutBars,
    stepsPerBar: opts.stepsPerBar,
    midiAtNote: opts.midiAtNote,
    includeMutedHarmony: opts.includeMutedHarmony,
    keyRoot,
    mode,
  });
  let prev = 12 * (baseOct + 1) + keyRoot;
  const out: number[] = [];
  for (let bar = 0; bar < opts.layoutBars; bar += 1) {
    const symbol = opts.chordRail?.timeline[bar]?.chord ?? null;
    let midi: number | null =
      symbol != null
        ? beatLabSynthV2ResolveChordRootMidi(symbol, keyRoot, mode, baseOct)
        : null;
    if (midi == null && roll.hasHarmony) {
      const c0 = bar * opts.stepsPerBar;
      const c1 = (bar + 1) * opts.stepsPerBar;
      const midis = midisInBar(
        opts.laneNotes,
        opts.lane,
        c0,
        c1,
        opts.includeMutedHarmony === true,
        opts.midiAtNote,
      );
      if (midis.length > 0) midi = inferRootInBar(midis, keyRoot, mode, prev);
    }
    if (midi == null) midi = railRoots[bar] ?? prev;
    midi = voiceLead(prev, midi);
    prev = midi;
    out.push(midi);
  }
  return out;
}

/** Columns with 2+ pitches = chord stacks (keep when replacing bass). */
export function beatLabSynthV2ChordColumnsOnLane(
  notes: readonly BeatLabMidiNote[],
  lane: number,
): Set<number> {
  const byCol = new Map<number, Set<number>>();
  for (const n of notes) {
    if (n.lane !== lane) continue;
    const semi = n.pitchSemi ?? 0;
    const set = byCol.get(n.col) ?? new Set<number>();
    set.add(semi);
    byCol.set(n.col, set);
  }
  const chordCols = new Set<number>();
  for (const [col, semis] of byCol) {
    if (semis.size >= 2) chordCols.add(col);
  }
  return chordCols;
}

/** True when every note in chord-stack columns is muted (nothing to unmute). */
export function beatLabSynthV2IsChordHarmonyMuted(
  notes: readonly BeatLabMidiNote[],
  lane: number,
  midiAtNote: (n: BeatLabMidiNote) => number,
): boolean {
  const chordCols = beatLabSynthV2ChordColumnsOnLane(notes, lane);
  if (chordCols.size === 0) return false;
  let sawChordNote = false;
  for (const n of notes) {
    if (n.lane !== lane || !chordCols.has(n.col)) continue;
    sawChordNote = true;
    if (!n.muted) return false;
  }
  return sawChordNote;
}

/** Mute / unmute chord-stack columns (2+ pitches per step) — notes stay on the roll. */
export function beatLabSynthV2ApplyChordHarmonyMute(
  notes: readonly BeatLabMidiNote[],
  lane: number,
  mute: boolean,
  midiAtNote: (n: BeatLabMidiNote) => number,
): BeatLabMidiNote[] {
  const chordCols = beatLabSynthV2HarmonyColumnsOnLane(notes, lane, midiAtNote);
  if (chordCols.size === 0) return [...notes];
  return notes.map((n) => {
    if (n.lane !== lane || !chordCols.has(n.col)) return n;
    if (mute) return { ...n, muted: true };
    if (!n.muted) return n;
    const { muted: _m, ...rest } = n;
    return rest;
  });
}

/**
 * Replace all notes on the bass lane in the layout window; keep every other lane
 * (piano-roll / harmony on its own CH). Bass lane is monophonic generated roots only.
 */
export function beatLabSynthV2MergeGeneratedBass(
  existing: readonly BeatLabMidiNote[],
  bassLane: number,
  layoutBars: number,
  stepsPerBar: number,
  newBass: readonly BeatLabMidiNote[],
): BeatLabMidiNote[] {
  const windowCols = layoutBars * stepsPerBar;
  const kept = existing.filter((n) => n.lane !== bassLane);
  const bass = newBass.filter((n) => n.lane === bassLane && n.col < windowCols);
  return [...kept, ...bass];
}

/** True when `probe` is the lowest (bass) pitch on `lane` at `col`. */
export function beatLabSynthV2IsLowestNoteAtCol(
  roll: readonly BeatLabMidiNote[],
  probe: BeatLabMidiNote,
  col: number,
  lane: number,
  midiAtNote: (n: BeatLabMidiNote) => number,
): boolean {
  let best = probe;
  let bestMidi = midiAtNote(probe);
  for (const o of roll) {
    if (o.lane !== lane || o.col !== col || o.muted) continue;
    const m = midiAtNote(o);
    if (m < bestMidi) {
      best = o;
      bestMidi = m;
    }
  }
  return best === probe;
}

/** One note per step column — lowest pitch wins (drops stray chord stacks on bass CH). */
export function beatLabSynthV2MonophonicLaneNotes(
  notes: readonly BeatLabMidiNote[],
  lane: number,
  midiAtNote: (n: BeatLabMidiNote) => number,
  maxStepCol = Number.POSITIVE_INFINITY,
): BeatLabMidiNote[] {
  const byCol = new Map<number, BeatLabMidiNote>();
  for (const n of notes) {
    if (n.lane !== lane || n.muted || n.col >= maxStepCol) continue;
    const cur = byCol.get(n.col);
    if (!cur) {
      byCol.set(n.col, n);
      continue;
    }
    if (midiAtNote(n) < midiAtNote(cur)) byCol.set(n.col, n);
  }
  return [...byCol.values()].sort((a, b) => a.col - b.col || (a.pitchSemi ?? 0) - (b.pitchSemi ?? 0));
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return (): number => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function rootMidiToLanePitchSemi(lane: number, rootMidi: number): number {
  const base = beatLabMelodicLanePitch(lane);
  let m = rootMidi;
  while (m - base > 24) m -= 12;
  while (m - base < -24) m += 12;
  return Math.max(-24, Math.min(24, Math.round(m - base)));
}

type BarHit = { start: number; dur: number; semiOff: number };

/**
 * Rhythmic bass shapes — every hit is root + semiOff (0 = chord root, 7 = fifth, etc.).
 * `variationSeed` picks different patterns each GENERATOR click.
 */
function barPattern(
  nextRoot: number,
  root: number,
  rnd: () => number,
): BarHit[] {
  const pid = Math.floor(rnd() * 8);
  const fifth = 7;
  const octave = 12;
  const rootDiff = nextRoot - root;
  const approach =
    rootDiff === 0
      ? 0
      : Math.sign(rootDiff) * Math.min(4, Math.max(1, Math.round(Math.abs(rootDiff) * 0.5)));

  switch (pid) {
    case 0:
      return [{ start: 0, dur: 1, semiOff: 0 }];
    case 1:
      return [
        { start: 0, dur: 0.5, semiOff: 0 },
        { start: 0.5, dur: 0.5, semiOff: 0 },
      ];
    case 2:
      return [
        { start: 0, dur: 0.25, semiOff: 0 },
        { start: 0.25, dur: 0.25, semiOff: 0 },
        { start: 0.5, dur: 0.25, semiOff: fifth },
        { start: 0.75, dur: 0.25, semiOff: 0 },
      ];
    case 3:
      return [
        { start: 0, dur: 0.375, semiOff: 0 },
        { start: 0.375, dur: 0.25, semiOff: fifth },
        { start: 0.625, dur: 0.375, semiOff: approach },
      ];
    case 4:
      return [
        { start: 0, dur: 0.5, semiOff: 0 },
        { start: 0.5, dur: 0.25, semiOff: octave },
        { start: 0.75, dur: 0.25, semiOff: 0 },
      ];
    case 5:
      return [
        { start: 0, dur: 0.5, semiOff: 0 },
        { start: 0.5, dur: 0.25, semiOff: fifth },
        { start: 0.75, dur: 0.25, semiOff: approach },
      ];
    case 6:
      return [
        { start: 0, dur: 0.25, semiOff: 0 },
        { start: 0.25, dur: 0.25, semiOff: fifth },
        { start: 0.5, dur: 0.25, semiOff: 0 },
        { start: 0.75, dur: 0.25, semiOff: approach },
      ];
    default:
      return [
        { start: 0, dur: 0.33, semiOff: 0 },
        { start: 0.33, dur: 0.17, semiOff: fifth },
        { start: 0.5, dur: 0.33, semiOff: 0 },
        { start: 0.83, dur: 0.17, semiOff: approach },
      ];
  }
}

export function beatLabSynthV2BassNoteSpans(
  notes: readonly BeatLabMidiNote[],
  lane: number,
  midiAtNote: (n: BeatLabMidiNote) => number,
  maxStepCol: number,
): { col0: number; col1: number; midi: number }[] {
  const laneNotes = beatLabSynthV2MonophonicLaneNotes(notes, lane, midiAtNote, maxStepCol);
  return laneNotes.map((n, i) => {
    const nextCol = i + 1 < laneNotes.length ? laneNotes[i + 1]!.col : Number.POSITIVE_INFINITY;
    const rawEnd = n.col + Math.max(1, n.len);
    const col1 = Math.max(n.col + 1, Math.min(rawEnd, nextCol, maxStepCol));
    return { col0: n.col, col1, midi: midiAtNote(n) };
  });
}

/**
 * Build bass notes locked to resolved chord roots — each Generator tap picks new rhythms.
 */
export function beatLabSynthV2GenerateBassRollNotes(opts: {
  lane: number;
  /** Piano-roll lane — chord roots / harmony source (defaults to `lane`). */
  harmonyLane?: number;
  layoutBars: 4 | 8;
  /** Step subdiv per beat (Beat Lab quant). */
  subdiv?: number;
  beatsPerBar?: number;
  /** Quarter columns per bar on the SYNTH roll (usually 4). */
  colsPerBar?: number;
  stepsPerBar?: number;
  patternCols: number;
  chordRail?: BeatLabImportedChordRail | null;
  laneNotes?: readonly BeatLabMidiNote[];
  midiAtNote?: (n: BeatLabMidiNote) => number;
  variationSeed?: number;
}): BeatLabMidiNote[] {
  const harmonyLane = opts.harmonyLane ?? opts.lane;
  const stepsPerBar =
    opts.stepsPerBar ??
    beatLabStepsPerBar(opts.subdiv ?? 4, opts.beatsPerBar ?? 4, opts.colsPerBar ?? 4);
  const midiAt =
    opts.midiAtNote ??
    ((n: BeatLabMidiNote) => beatLabMelodicLanePitch(harmonyLane) + (n.pitchSemi ?? 0));
  const rnd = mulberry32(
    (opts.variationSeed ?? 1) ^ (opts.lane * 917_503) ^ (harmonyLane * 131_071) ^ (stepsPerBar * 31_937),
  );
  const laneNotes = opts.laneNotes ?? [];
  const roots = beatLabSynthV2ResolveRootsPerBar({
    chordRail: opts.chordRail,
    laneNotes,
    lane: harmonyLane,
    layoutBars: opts.layoutBars,
    stepsPerBar,
    midiAtNote: midiAt,
    includeMutedHarmony: true,
  });
  const { lane } = opts;
  const notes: BeatLabMidiNote[] = [];
  const harmonyDownbeats = beatLabSynthV2HarmonyColumnsOnLane(laneNotes, harmonyLane, midiAt);

  for (let bar = 0; bar < opts.layoutBars; bar += 1) {
    const rootMidi = roots[bar]!;
    const nextRoot = roots[Math.min(bar + 1, roots.length - 1)]!;
    const baseSemi = rootMidiToLanePitchSemi(lane, rootMidi);
    const pat = barPatternWithDownbeat(barPattern(nextRoot, rootMidi, rnd));
    const barStart = bar * stepsPerBar;

    const hits = pat.map((h) => {
      const startF = Math.max(0, Math.min(1 - 1e-6, h.start));
      const durF = Math.max(0, Math.min(1 - startF, h.dur));
      let off = Math.round(startF * stepsPerBar);
      let span = Math.max(1, Math.round(durF * stepsPerBar));
      if (off >= stepsPerBar) off = stepsPerBar - 1;
      span = Math.max(1, Math.min(span, stepsPerBar - off));
      const semi = Math.max(-24, Math.min(24, baseSemi + h.semiOff));
      return { off, span, semi };
    });

    hits.sort((a, b) => a.off - b.off);
    const barEnd = barStart + stepsPerBar;
    for (let hi = 0; hi < hits.length; hi += 1) {
      let { off, span, semi } = hits[hi]!;
      const hit = pat[hi]!;
      /** Bar-root hits share the same step column as snapped chord downbeats (not rounded sub-beats). */
      let col = barStart + off;
      if (hit.start < 0.02) {
        const barEnd = barStart + stepsPerBar;
        for (const hc of harmonyDownbeats) {
          if (hc >= barStart && hc < barEnd) {
            col = hc;
            break;
          }
        }
      }
      if (notes.some((n) => n.lane === lane && n.col === col)) continue;
      const nextHit = hits[hi + 1];
      const hardEnd = nextHit ? barStart + nextHit.off : barEnd;
      span = Math.max(1, Math.min(span, hardEnd - col));
      if (col >= opts.patternCols) continue;
      const lenClamped = Math.min(span, opts.patternCols - col);
      if (lenClamped < 1) continue;

      notes.push({
        lane,
        col,
        len: lenClamped,
        vel: 100,
        pitchSemi: semi,
      });
    }
  }

  return beatLabSynthV2MonophonicLaneNotes(
    notes,
    lane,
    (n) => beatLabMelodicLanePitch(lane) + (n.pitchSemi ?? 0),
    opts.patternCols,
  );
}

/**
 * After new harmony lands on NEW SYNTH, retune existing bass roots and snap bar-1 hits
 * to the same downbeat columns as the chord stack (keeps rhythmic pattern).
 */
export function beatLabSynthV2ResyncBassToHarmony(opts: {
  notes: readonly BeatLabMidiNote[];
  bassLane: number;
  harmonyLane: number;
  layoutBars: 4 | 8;
  stepsPerBar: number;
  patternCols: number;
  chordRail?: BeatLabImportedChordRail | null;
  midiAtHarmony?: (n: BeatLabMidiNote) => number;
  midiAtBass?: (n: BeatLabMidiNote) => number;
}): BeatLabMidiNote[] {
  const stepsPerBar = Math.max(1, Math.round(opts.stepsPerBar));
  const windowCols = Math.min(
    Math.max(1, Math.round(opts.patternCols)),
    opts.layoutBars * stepsPerBar,
  );
  const midiAtHarmony =
    opts.midiAtHarmony ??
    ((n: BeatLabMidiNote) => beatLabMelodicLanePitch(opts.harmonyLane) + (n.pitchSemi ?? 0));
  const midiAtBass =
    opts.midiAtBass ??
    ((n: BeatLabMidiNote) => beatLabMelodicLanePitch(opts.bassLane) + (n.pitchSemi ?? 0));

  const harmonyNotes = opts.notes.filter((n) => n.lane === opts.harmonyLane);
  const bassNotes = opts.notes.filter((n) => n.lane === opts.bassLane && n.col < windowCols);
  if (bassNotes.length === 0 || harmonyNotes.length === 0) return [...opts.notes];

  const harmonyDownbeats = beatLabSynthV2HarmonyColumnsOnLane(
    harmonyNotes,
    opts.harmonyLane,
    midiAtHarmony,
  );
  const roots = beatLabSynthV2ResolveRootsPerBar({
    chordRail: opts.chordRail,
    laneNotes: harmonyNotes,
    lane: opts.harmonyLane,
    layoutBars: opts.layoutBars,
    stepsPerBar,
    midiAtNote: midiAtHarmony,
    includeMutedHarmony: true,
  });

  let out = opts.notes.map((n) => ({ ...n }));
  for (let bar = 0; bar < opts.layoutBars; bar += 1) {
    const barStart = bar * stepsPerBar;
    const barEnd = barStart + stepsPerBar;
    const downbeatCol =
      [...harmonyDownbeats].find((c) => c >= barStart && c < barEnd) ?? barStart;
    const newBase = rootMidiToLanePitchSemi(opts.bassLane, roots[bar]!);

    const bassInBar = out.filter(
      (n) => n.lane === opts.bassLane && n.col >= barStart && n.col < barEnd && !n.muted,
    );
    if (bassInBar.length === 0) continue;

    const anchor =
      bassInBar.find((n) => n.col === barStart) ??
      [...bassInBar].sort((a, b) => a.col - b.col)[0]!;
    const oldBase = anchor.pitchSemi ?? newBase;
    const delta = newBase - oldBase;

    out = out.map((n) => {
      if (n.lane !== opts.bassLane || n.col < barStart || n.col >= barEnd) return n;
      let col = n.col;
      if (n.col === anchor.col || n.col === barStart) col = downbeatCol;
      const pitchSemi = Math.max(-24, Math.min(24, (n.pitchSemi ?? 0) + delta));
      return col === n.col && pitchSemi === (n.pitchSemi ?? 0) ? n : { ...n, col, pitchSemi };
    });
  }

  return beatLabSynthV2MonophonicLaneNotes(out, opts.bassLane, midiAtBass, windowCols);
}
