/**
 * Live Chord (B01) — chord-locked monophonic lead melody.
 * Voice-led chord tones, transitional / passing phrases, cross-bar continuity.
 * Geno Build 2 uses se2SynthGenoMelodyEngine — do not route B02 through here.
 */
import { mulberry32 } from '@/app/lib/groovePatternEngine';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import type { GenoHarmony } from '@/app/lib/studio/se2SynthGenoChordEngine';
import {
  GENO_MELODY_MIDI_MAX,
  GENO_MELODY_MIDI_MIN,
  genoMelodyCandidatesFromHarmony,
  genoMelodyRootFromHarmonyRoot,
  genoNormalizeLiveMelodyNotes,
  genoWrapMidiToRange,
} from '@/app/lib/studio/se2SynthGenoRanges';
import {
  GENO_LIVE_ARP_VEL_BASE,
  type GenoLiveArpPattern,
  type GenoLiveArpRate,
} from '@/app/lib/studio/se2SynthGenoLiveArpTypes';
import { genoLiveMelodyPickPhraseForBar } from '@/app/lib/studio/se2SynthGenoLiveMelodyPhrases';
import {
  genoPhraseScaleBeat,
  genoPhraseScaleDur,
  genoPhraseShiftTemplateDegrees,
  type GenoPhraseDegree,
  type GenoPhraseTemplate,
} from '@/app/lib/studio/se2SynthGenoPhraseHarmony';

export type { GenoLiveArpPattern, GenoLiveArpRate } from '@/app/lib/studio/se2SynthGenoLiveArpTypes';

function clampMelody(m: number): number {
  return genoWrapMidiToRange(m, GENO_MELODY_MIDI_MIN, GENO_MELODY_MIDI_MAX);
}

/** One pitch per chord color — root first, then 3rd / 5th / 7th from the live voicing. */
export function genoLiveArpChordToneStack(col: {
  rootMidi: number;
  tones: readonly number[];
}): number[] {
  const rootPitch = genoMelodyRootFromHarmonyRoot(col.rootMidi);
  const rootPc = ((rootPitch % 12) + 12) % 12;
  const pool = genoMelodyCandidatesFromHarmony(col);

  const byPc = new Map<number, number>();
  byPc.set(rootPc, rootPitch);

  for (const t of pool) {
    const pc = ((t % 12) + 12) % 12;
    const wrapped = clampMelody(t);
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

function liveMelodyQuantStep(rate: GenoLiveArpRate, beatsPerBar: number): number {
  const scale = beatsPerBar / 4;
  switch (rate) {
    case '4th':
      return 1 * scale;
    case '16th':
      return 0.25 * scale;
    case 'triplet8':
      return (1 / 3) * scale;
    default:
      return 0.5 * scale;
  }
}

function stackPitchForDegree(degree: GenoPhraseDegree, stack: readonly number[]): number {
  const n = stack.length;
  if (n === 0) return GENO_MELODY_MIDI_MIN;
  const i1 = Math.min(1, n - 1);
  const i2 = Math.min(2, n - 1);
  const i3 = Math.min(3, n - 1);
  switch (degree) {
    case 'root':
      return stack[0]!;
    case 'third':
      return stack[i1]!;
    case 'fifth':
      return stack[i2]!;
    case 'seventh':
      return stack[i3]!;
    case 'top':
      return stack[n - 1]!;
  }
}

function harmonyBarChordChanged(
  prev: { rootMidi: number; tones: readonly number[] } | undefined,
  cur: { rootMidi: number; tones: readonly number[] } | undefined,
): boolean {
  if (!prev || !cur) return false;
  if (prev.rootMidi !== cur.rootMidi) return true;
  const pcs = (tones: readonly number[]) =>
    [...new Set(tones.map((t) => ((t % 12) + 12) % 12))].sort((a, b) => a - b).join(',');
  return pcs(prev.tones) !== pcs(cur.tones);
}

function commonToneBetweenStacks(a: readonly number[], b: readonly number[]): number | null {
  for (const t of a) {
    for (const u of b) {
      if (Math.abs(t - u) <= 1) return t;
      if (Math.abs(t - u - 12) <= 1) return t;
      if (Math.abs(t - u + 12) <= 1) return t;
    }
  }
  return null;
}

function pickVoiceLedFromStack(
  stack: readonly number[],
  prevPitch: number | null,
  hintPitch: number,
  onDownbeat: boolean,
  prevStack?: readonly number[],
): number {
  if (stack.length === 0) return hintPitch;
  if (stack.length === 1) return stack[0]!;

  if (onDownbeat && prevPitch != null && prevStack && prevStack.length > 0) {
    const common = commonToneBetweenStacks(prevStack, stack);
    if (common != null) {
      return pickVoiceLedFromStack(stack, prevPitch, common, false);
    }
  }

  let hint = stack[0]!;
  let hintDist = Math.abs(hintPitch - hint);
  for (const t of stack) {
    const d = Math.abs(hintPitch - t);
    if (d < hintDist) {
      hintDist = d;
      hint = t;
    }
  }

  if (prevPitch == null) return hint;

  let best = stack[0]!;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const t of stack) {
    const leap = Math.abs(t - prevPitch);
    let score = leap * 2.4;
    if (t === hint) score -= 5;
    if (leap <= 2) score -= 6;
    if (leap === 0) score -= 4;
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

function passingPickupPitch(lastPitch: number, nextStack: readonly number[]): number | null {
  let best: number | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const tone of nextStack) {
    for (const half of [-1, 1, -2, 2] as const) {
      const pass = clampMelody(tone + half);
      const leapFrom = Math.abs(pass - lastPitch);
      if (leapFrom < 0.5 || leapFrom > 3) continue;
      const distToChord = Math.min(...nextStack.map((t) => Math.abs(pass - t)));
      const score = leapFrom * 1.4 + distToChord * 0.55;
      if (score < bestScore) {
        bestScore = score;
        best = pass;
      }
    }
  }
  return best;
}

function applyPatternToPhrase(template: GenoPhraseTemplate, pattern: GenoLiveArpPattern): GenoPhraseTemplate {
  switch (pattern) {
    case 'up':
      return genoPhraseShiftTemplateDegrees(template, 'up');
    case 'down':
      return genoPhraseShiftTemplateDegrees(template, 'down');
    case 'up-down':
      return genoPhraseShiftTemplateDegrees(template, 'up-down');
    case 'root':
      return {
        ...template,
        events: template.events.map((ev) => ({ ...ev, degrees: ['root' as GenoPhraseDegree] })),
      };
    case 'chord':
    default:
      return template;
  }
}

/** Voice-led lock — chord-stack tones; common tones across chord changes. */
export function genoLockLiveArpNotesToHarmony(
  notes: readonly StudioEditor2GenNote[],
  harmony: GenoHarmony,
  beatsPerBar: number,
): StudioEditor2GenNote[] {
  if (notes.length === 0 || harmony.columns.length === 0) return [...notes];
  const bpb = Math.max(1, beatsPerBar);
  const downbeatTol = bpb / 48;
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  let prevPitch: number | null = null;
  let prevBar = -1;
  let prevStack: number[] = [];
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
    const stack = genoLiveArpChordToneStack(col);
    if (stack.length === 0) {
      out.push(n);
      continue;
    }

    const rel = n.startBeat - bar * bpb;
    const onDownbeat = rel < downbeatTol;
    const prevBarStack =
      bar !== prevBar && bar > 0 ? genoLiveArpChordToneStack(harmony.columns[bar - 1]!) : prevStack;
    const pitch = pickVoiceLedFromStack(stack, prevPitch, n.pitch, onDownbeat, prevBarStack);
    out.push({ ...n, pitch });
    prevPitch = pitch;
    prevBar = bar;
    prevStack = stack;
  }

  return out;
}

function genoLiveMelodyTiledLoopBars(harmony: GenoHarmony, barCount: number): number {
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

function renderLiveMonophonicPhrase(
  template: GenoPhraseTemplate,
  bar: number,
  stack: readonly number[],
  opts: {
    beatsPerBar: number;
    barCount: number;
    skipBarStart?: boolean;
    velBase: number;
    prevPitch?: number | null;
    prevStack?: readonly number[];
  },
): StudioEditor2GenNote[] {
  const notes: StudioEditor2GenNote[] = [];
  const barStart = bar * opts.beatsPerBar;
  const scaledBeats = template.events.map((e) => genoPhraseScaleBeat(e.beat, opts.beatsPerBar));
  const hitPad = opts.beatsPerBar / 64;
  let prevPitch = opts.prevPitch ?? null;

  for (let ei = 0; ei < template.events.length; ei += 1) {
    const ev = template.events[ei]!;
    const beat = scaledBeats[ei]!;
    if (opts.skipBarStart && beat <= 1e-6) continue;

    const startBeat = barStart + beat;
    if (startBeat >= opts.barCount * opts.beatsPerBar) break;

    const degree = ev.degrees[0];
    if (!degree) continue;

    const onDownbeat = beat < opts.beatsPerBar / 48;
    const hint = stackPitchForDegree(degree, stack);
    const pitch = pickVoiceLedFromStack(stack, prevPitch, hint, onDownbeat, opts.prevStack);

    const roomInBar = Math.max(0.12, opts.beatsPerBar - beat);
    const roomUntilNext =
      ei + 1 < scaledBeats.length
        ? Math.max(0.12, scaledBeats[ei + 1]! - beat - hitPad)
        : roomInBar;
    const dur = Math.max(
      0.22,
      Math.min(roomInBar, roomUntilNext, genoPhraseScaleDur(ev.dur, opts.beatsPerBar)),
    );
    const vel = Math.min(
      96,
      (ev.vel ?? opts.velBase) + (onDownbeat ? 3 : 0) + (ei === 0 && prevPitch != null ? 2 : 0),
    );

    notes.push({ pitch, startBeat, durationBeats: dur, velocity: vel });
    prevPitch = pitch;
  }

  return notes;
}

function appendApproachPickup(
  notes: StudioEditor2GenNote[],
  bar: number,
  beatsPerBar: number,
  barCount: number,
  nextStack: readonly number[],
  lastPitch: number | null,
): StudioEditor2GenNote[] {
  if (nextStack.length === 0 || lastPitch == null) return notes;
  const pickupBeat = (bar + 1) * beatsPerBar - beatsPerBar * 0.125;
  if (pickupBeat >= barCount * beatsPerBar) return notes;
  if (notes.some((n) => Math.abs(n.startBeat - pickupBeat) < beatsPerBar / 32)) return notes;

  const pass = passingPickupPitch(lastPitch, nextStack);
  if (pass == null) return notes;

  return [
    ...notes,
    {
      pitch: pass,
      startBeat: pickupBeat,
      durationBeats: Math.max(0.12, beatsPerBar * 0.1),
      velocity: GENO_LIVE_ARP_VEL_BASE - 5,
    },
  ];
}

function finalizeLiveMelodyNotes(
  notes: readonly StudioEditor2GenNote[],
  harmony: GenoHarmony,
  beatsPerBar: number,
  barCount: number,
  rate: GenoLiveArpRate,
): StudioEditor2GenNote[] {
  const step = liveMelodyQuantStep(rate, beatsPerBar);
  const locked = genoLockLiveArpNotesToHarmony(notes, harmony, beatsPerBar);
  return genoNormalizeLiveMelodyNotes(locked, beatsPerBar, barCount, step);
}

function generateLeadMelodyForBar(
  bar: number,
  col: { rootMidi: number; tones: readonly number[] },
  opts: {
    beatsPerBar: number;
    barCount: number;
    pattern: GenoLiveArpPattern;
    skipBarStart?: boolean;
    phraseTemplate: GenoPhraseTemplate;
    prevPitch?: number | null;
    prevStack?: readonly number[];
    nextStack?: readonly number[];
  },
): StudioEditor2GenNote[] {
  const stack = genoLiveArpChordToneStack(col);
  if (stack.length === 0) return [];

  const template = applyPatternToPhrase(opts.phraseTemplate, opts.pattern);
  let notes = renderLiveMonophonicPhrase(template, bar, stack, {
    beatsPerBar: opts.beatsPerBar,
    barCount: opts.barCount,
    skipBarStart: opts.skipBarStart,
    velBase: GENO_LIVE_ARP_VEL_BASE,
    prevPitch: opts.prevPitch,
    prevStack: opts.prevStack,
  });

  const lastPitch = notes.length > 0 ? notes[notes.length - 1]!.pitch : (opts.prevPitch ?? null);
  if (opts.nextStack && opts.nextStack.length > 0) {
    notes = appendApproachPickup(
      notes,
      bar,
      opts.beatsPerBar,
      opts.barCount,
      opts.nextStack,
      lastPitch,
    );
  }

  return notes;
}

function pickPhraseForBar(
  harmony: GenoHarmony,
  bar: number,
  barCount: number,
  loopBars: number,
  rnd: () => number,
  phraseByKey: Map<string, GenoPhraseTemplate>,
): GenoPhraseTemplate {
  const col = harmony.columns[bar];
  const prevCol = bar > 0 ? harmony.columns[bar - 1] : undefined;
  const nextCol = bar + 1 < harmony.columns.length ? harmony.columns[bar + 1] : undefined;
  const chordChanged = harmonyBarChordChanged(prevCol, col);
  const approachingChange = harmonyBarChordChanged(col, nextCol);
  const loopBar = bar % loopBars;
  const key = `${loopBar}:${chordChanged ? 't' : 's'}:${approachingChange ? 'p' : 'h'}`;
  let phrase = phraseByKey.get(key);
  if (!phrase) {
    phrase = genoLiveMelodyPickPhraseForBar({
      loopBar,
      rnd,
      chordChanged,
      approachingChange,
    });
    phraseByKey.set(key, phrase);
  }
  return phrase;
}

/** Regenerate lead melody for one loop bar only (B01). */
export function genoGenerateLiveArpForBar(opts: {
  harmony: GenoHarmony;
  bar: number;
  beatsPerBar: number;
  barCount: number;
  pattern: GenoLiveArpPattern;
  rate: GenoLiveArpRate;
  seed: number;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  skipBarStart?: boolean;
}): StudioEditor2GenNote[] {
  void opts.keyRoot;
  void opts.keyMode;
  const col = opts.harmony.columns[opts.bar];
  if (!col) return [];
  const loopBars = genoLiveMelodyTiledLoopBars(opts.harmony, opts.barCount);
  const rnd = mulberry32(opts.seed ^ 0x4d454c ^ opts.bar * 977);
  const prevCol = opts.bar > 0 ? opts.harmony.columns[opts.bar - 1] : undefined;
  const nextCol =
    opts.bar + 1 < opts.harmony.columns.length ? opts.harmony.columns[opts.bar + 1] : undefined;
  const prevStack = prevCol ? genoLiveArpChordToneStack(prevCol) : undefined;
  const nextStack = nextCol ? genoLiveArpChordToneStack(nextCol) : undefined;
  const phraseByKey = new Map<string, GenoPhraseTemplate>();

  const notes = generateLeadMelodyForBar(opts.bar, col, {
    beatsPerBar: opts.beatsPerBar,
    barCount: opts.barCount,
    pattern: opts.pattern,
    skipBarStart: opts.skipBarStart,
    phraseTemplate: pickPhraseForBar(
      opts.harmony,
      opts.bar,
      opts.barCount,
      loopBars,
      rnd,
      phraseByKey,
    ),
    prevStack,
    nextStack,
  });
  return finalizeLiveMelodyNotes(notes, opts.harmony, opts.beatsPerBar, opts.barCount, opts.rate);
}

/** Generate chord-locked lead melody for Geno Build 1 loop preview / export. */
export function genoGenerateLiveArpFromHarmony(opts: {
  harmony: GenoHarmony;
  barCount: number;
  beatsPerBar: number;
  pattern: GenoLiveArpPattern;
  rate: GenoLiveArpRate;
  seed: number;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  skipBarStart?: boolean;
}): StudioEditor2GenNote[] {
  void opts.keyRoot;
  void opts.keyMode;
  const rnd = mulberry32(opts.seed ^ 0x4d454c);
  const loopBars = genoLiveMelodyTiledLoopBars(opts.harmony, opts.barCount);
  const phraseByKey = new Map<string, GenoPhraseTemplate>();
  const notes: StudioEditor2GenNote[] = [];
  let lastPitch: number | null = null;
  let lastStack: number[] = [];

  for (let bar = 0; bar < opts.barCount; bar += 1) {
    const col = opts.harmony.columns[bar];
    if (!col) continue;
    const prevCol = bar > 0 ? opts.harmony.columns[bar - 1] : undefined;
    const nextCol = bar + 1 < opts.harmony.columns.length ? opts.harmony.columns[bar + 1] : undefined;
    const prevStack = prevCol ? genoLiveArpChordToneStack(prevCol) : lastStack;
    const nextStack = nextCol ? genoLiveArpChordToneStack(nextCol) : undefined;

    const barNotes = generateLeadMelodyForBar(bar, col, {
      beatsPerBar: opts.beatsPerBar,
      barCount: opts.barCount,
      pattern: opts.pattern,
      skipBarStart: opts.skipBarStart,
      phraseTemplate: pickPhraseForBar(
        opts.harmony,
        bar,
        opts.barCount,
        loopBars,
        rnd,
        phraseByKey,
      ),
      prevPitch: lastPitch,
      prevStack: prevStack.length > 0 ? prevStack : undefined,
      nextStack,
    });
    notes.push(...barNotes);
    if (barNotes.length > 0) {
      lastPitch = barNotes[barNotes.length - 1]!.pitch;
      lastStack = genoLiveArpChordToneStack(col);
    }
  }

  return finalizeLiveMelodyNotes(notes, opts.harmony, opts.beatsPerBar, opts.barCount, opts.rate);
}

/** @deprecated B01 pattern chips no longer switch genre pools — kept for callers. */
export function genoLiveMelodyGenreForPattern(pattern: GenoLiveArpPattern): string {
  void pattern;
  return 'b01-live';
}
