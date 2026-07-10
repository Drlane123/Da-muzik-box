/**
 * Synth Geno Chord Generator — standalone rule-based engine.
 * Inspired by external MIDI chord plugins (progression + voicing + performance pieces).
 * Does NOT import Orchid, Groove Lab, Progression+, or Creation Station harmony code.
 */
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import { mulberry32 } from '@/app/lib/groovePatternEngine';
import {
  se2DiatonicTriadQuality,
  se2ScaleDegreeRootMidi,
} from '@/app/lib/studio/se2SynthGenoKeyLock';
import {
  GENO_BASS_MIDI_MAX,
  GENO_BASS_MIDI_MIN,
  GENO_CHORD_MIDI_MAX,
  GENO_CHORD_MIDI_MIN,
  GENO_CHORD_REF_MIDI,
  GENO_CHORD_ROOT_OCTAVE_MIDI,
  genoBassPitchFromHarmonyRoot,
  genoLiftVoicingToRange,
  genoShiftVoicingToRange,
  genoWrapMidiToRange,
} from '@/app/lib/studio/se2SynthGenoRanges';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import {
  genoPickProgressionForStyle,
  genoStylePreset,
} from '@/app/lib/studio/se2SynthGenoStylePresets';
import {
  se2SynthGenoEnrichForStyle,
  se2SynthGenoDefaultVoicingDepthForStyle,
} from '@/app/lib/studio/se2SynthGenoVoicingDepth';

export type GenoProgressionId =
  | 'hold-i'
  | 'I-IV-V-I'
  | 'I-V-vi-IV'
  | 'ii-V-I'
  | 'I-vi-IV-V'
  | 'i-VI-III-VII'
  | 'vi-IV-I-V'
  | 'IV-I-V-vi'
  | 'I-III-vi-IV'
  | 'vi-ii-V-I'
  | 'i-VII-VI-V'
  | 'i-iv-VI-VII'
  | 'I-IV-vi-V'
  | 'IV-V-I-vi';

export const GENO_PROGRESSIONS: readonly { id: GenoProgressionId; label: string; degrees: readonly number[] }[] = [
  { id: 'hold-i', label: 'I (hold)', degrees: [0] },
  { id: 'I-IV-V-I', label: 'I · IV · V · I', degrees: [0, 3, 4, 0] },
  { id: 'I-V-vi-IV', label: 'I · V · vi · IV', degrees: [0, 4, 5, 3] },
  { id: 'ii-V-I', label: 'ii · V · I', degrees: [1, 4, 0] },
  { id: 'I-vi-IV-V', label: 'I · vi · IV · V', degrees: [0, 5, 3, 4] },
  { id: 'i-VI-III-VII', label: 'i · VI · III · VII', degrees: [0, 5, 2, 6] },
  { id: 'vi-IV-I-V', label: 'vi · IV · I · V', degrees: [5, 3, 0, 4] },
  { id: 'IV-I-V-vi', label: 'IV · I · V · vi', degrees: [3, 0, 4, 5] },
  { id: 'I-III-vi-IV', label: 'I · iii · vi · IV', degrees: [0, 2, 5, 3] },
  { id: 'vi-ii-V-I', label: 'vi · ii · V · I', degrees: [5, 1, 4, 0] },
  { id: 'i-VII-VI-V', label: 'i · VII · VI · V', degrees: [0, 6, 5, 4] },
  { id: 'i-iv-VI-VII', label: 'i · iv · VI · VII', degrees: [0, 3, 5, 6] },
  { id: 'I-IV-vi-V', label: 'I · IV · vi · V', degrees: [0, 3, 5, 4] },
  { id: 'IV-V-I-vi', label: 'IV · V · I · vi', degrees: [3, 4, 0, 5] },
];

export type GenoChordType = 'maj' | 'min' | 'sus' | 'dim' | 'aug';
export type GenoExtension = '6' | 'M7' | 'm7' | '9' | '11' | '13';
export type GenoPerfMode = 'block' | 'strum' | 'arp' | 'slop' | 'repeater';
export type GenoRepeaterQuant = '1/4' | '1/8' | '1/16' | '1/32';

/** Per-bar chord rhythm chop in the loop editor (whole bar vs repeated hits). */
export type GenoBarChopQuant = 'whole' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32';

export const GENO_BAR_CHOP_OPTIONS: { id: GenoBarChopQuant; label: string; title: string }[] = [
  { id: 'whole', label: '1×', title: 'Whole bar — one sustained chord' },
  { id: '1/2', label: '½', title: 'Half note — 2 hits per bar (4/4)' },
  { id: '1/4', label: '¼', title: 'Quarter note — 4 hits per bar (4/4)' },
  { id: '1/8', label: '⅛', title: 'Eighth note — 8 hits per bar (4/4)' },
  { id: '1/16', label: '16', title: 'Sixteenth note — 16 hits per bar (4/4)' },
  { id: '1/32', label: '32', title: 'Thirty-second — 32 hits per bar (4/4)' },
];

export type GenoHarmonyColumn = {
  bar: number;
  degree: number;
  rootMidi: number;
  tones: number[];
};

export type GenoHarmony = {
  columns: GenoHarmonyColumn[];
};

/** Short transitional hit at the end of a bar — stays inside 4/8/12-bar loops. */
export type GenoBarPassingTail = {
  spec: GenoBarChordSpec;
  roman?: string;
  quant: Exclude<GenoBarChopQuant, 'whole'>;
};

/** Per-chord voicing in a progression loop — degree + optional color overrides. */
export type GenoBarChordSpec = {
  degree: number;
  /** Semitone intervals from key root (Roman symbol spelling — includes borrowed chords). */
  chordIntervals?: readonly number[];
  lockedType?: GenoChordType;
  extensions?: readonly GenoExtension[];
  inversion?: number;
  smartMatch?: boolean;
  /** Stack the top note an octave up (R&B / soul pads). */
  stackOctave?: boolean;
  /** Target voiced note count — 4 (triad/7th) through 7 (lush stacks). */
  voicingDepth?: 4 | 5 | 6 | 7;
  /** Loop editor — chop this bar into repeated chord hits (overrides global repeater for this bar). */
  chopQuant?: GenoBarChopQuant;
  /** Transitional chord as a short tail slice before the next bar chord. */
  passingTail?: GenoBarPassingTail;
};

export type GenoChordBuildSettings = {
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  barCount: number;
  beatsPerBar: number;
  bpm?: number;
  progressionId: GenoProgressionId;
  smartMatch: boolean;
  lockedType: GenoChordType;
  extensions: ReadonlySet<GenoExtension>;
  inversion: number;
  perfMode: GenoPerfMode;
  staccato: boolean;
  /** Grid for perfMode === 'repeater' — re-triggers voicing on each step. */
  repeaterQuant: GenoRepeaterQuant;
  includeBassRoot: boolean;
  /** When set, overrides progression template per bar (scale degrees 0–6). */
  barDegrees?: readonly number[];
  /** Rich per-chord voicing — tiled across bars with {@link barDegrees}. */
  barChordSpecs?: readonly GenoBarChordSpec[];
  /** Genre tag for velocity / voicing tweaks. */
  stylePreset?: GenoChordStyle;
  /** When set, re-roll voicing (inversion / spread) per bar — chord Regen in loop editor. */
  voicingSeed?: number;
};

export type GenoChordBuildResult = {
  progressionId: GenoProgressionId;
  harmony: GenoHarmony;
  notes: StudioEditor2GenNote[];
};

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

const EXT_INTERVAL: Record<GenoExtension, number> = {
  '6': 9,
  M7: 11,
  m7: 10,
  '9': 14,
  '11': 17,
  '13': 21,
};

function normalizePc(n: number): number {
  return ((Math.round(n) % 12) + 12) % 12;
}

function scaleForMode(mode: StudioDetectedKeyMode): readonly number[] {
  return mode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
}

function smartTypeForDegree(mode: StudioDetectedKeyMode, degree: number): GenoChordType {
  const q = se2DiatonicTriadQuality(mode, degree);
  if (q === 'dim') return 'dim';
  if (q === 'min') return 'min';
  return 'maj';
}

function triadIntervals(type: GenoChordType): number[] {
  switch (type) {
    case 'min':
      return [0, 3, 7];
    case 'sus':
      return [0, 5, 7];
    case 'dim':
      return [0, 3, 6];
    case 'aug':
      return [0, 4, 8];
    default:
      return [0, 4, 7];
  }
}

function applyInversion(sorted: number[], steps: number): number[] {
  if (sorted.length === 0) return sorted;
  let out = [...sorted].sort((a, b) => a - b);
  const n = ((steps % out.length) + out.length) % out.length;
  for (let i = 0; i < n; i++) {
    const low = out.shift()!;
    out.push(low + 12);
  }
  return out.filter((m) => m <= GENO_CHORD_MIDI_MAX + 12);
}

function spreadVoicing(midis: number[]): number[] {
  let sorted = [...new Set(midis.map((m) => Math.round(m)))].sort((a, b) => a - b);
  sorted = genoLiftVoicingToRange(sorted, GENO_CHORD_MIDI_MIN, GENO_CHORD_MIDI_MAX);
  return sorted;
}

function settingsForBarSpec(
  settings: GenoChordBuildSettings,
  spec?: GenoBarChordSpec,
): GenoChordBuildSettings {
  if (!spec) return settings;
  return {
    ...settings,
    smartMatch: spec.smartMatch ?? settings.smartMatch,
    lockedType: spec.lockedType ?? settings.lockedType,
    extensions: spec.extensions ? new Set(spec.extensions) : settings.extensions,
    inversion: spec.inversion ?? settings.inversion,
  };
}

function stackTopOctave(tones: number[]): number[] {
  if (tones.length < 3) return tones;
  const top = tones[tones.length - 1]!;
  if (top < GENO_CHORD_REF_MIDI + 14 && top + 12 <= GENO_CHORD_MIDI_MAX) {
    return [...new Set([...tones, top + 12])].sort((a, b) => a - b);
  }
  return tones;
}

function rootMidiFromKeyInterval(keyRoot: number, rootInterval: number): number {
  const baseOct = Math.floor(GENO_CHORD_ROOT_OCTAVE_MIDI / 12) * 12;
  return baseOct + normalizePc(keyRoot) + rootInterval;
}

function buildVoicing(
  keyRoot: number,
  mode: StudioDetectedKeyMode,
  degree: number,
  settings: GenoChordBuildSettings,
  spec?: GenoBarChordSpec,
): { rootMidi: number; tones: number[] } {
  const eff = settingsForBarSpec(settings, spec);

  if (spec?.chordIntervals && spec.chordIntervals.length > 0) {
    const rootIv = spec.chordIntervals[0]!;
    const rootMidi = rootMidiFromKeyInterval(keyRoot, rootIv);
    const depth = spec.voicingDepth ?? se2SynthGenoDefaultVoicingDepthForStyle(eff.stylePreset);
    const spelled =
      depth > spec.chordIntervals.length
        ? se2SynthGenoEnrichForStyle(spec.chordIntervals, depth, eff.stylePreset)
        : [...spec.chordIntervals];
    let tones = [...new Set(spelled.map((iv) => rootMidi + (iv - rootIv)))].sort(
      (a, b) => a - b,
    );
    tones = applyInversion(tones, eff.inversion);
    tones = spreadVoicing(tones);
    if (spec.stackOctave || eff.stylePreset === 'rnb') {
      tones = stackTopOctave(tones);
    }
    return { rootMidi, tones };
  }

  const rootMidi = se2ScaleDegreeRootMidi(keyRoot, mode, degree, GENO_CHORD_ROOT_OCTAVE_MIDI);
  const type =
    eff.stylePreset === 'bright' && (degree === 0 || degree === 3)
      ? 'sus'
      : eff.smartMatch
        ? smartTypeForDegree(mode, degree)
        : eff.lockedType;
  const intervals = [...triadIntervals(type)];
  for (const ext of eff.extensions) {
    intervals.push(EXT_INTERVAL[ext]);
  }
  const base = rootMidi;
  let tones = [...new Set(intervals.map((iv) => base + iv))].sort((a, b) => a - b);
  tones = applyInversion(tones, eff.inversion);
  tones = spreadVoicing(tones);
  if (spec?.stackOctave || eff.stylePreset === 'rnb') {
    tones = stackTopOctave(tones);
  }
  return { rootMidi, tones };
}

function repeaterQuantBeats(quant: GenoRepeaterQuant): number {
  switch (quant) {
    case '1/4':
      return 1;
    case '1/8':
      return 0.5;
    case '1/16':
      return 0.25;
    case '1/32':
      return 0.125;
  }
}

/** Beat length of one chop grid cell — matches loop editor quant (⅛, 16, etc.). */
export function genoBarChopStepBeats(quant: GenoBarChopQuant, beatsPerBar: number): number {
  const bpb = Math.max(1, beatsPerBar);
  switch (quant) {
    case '1/2':
      return bpb / 2;
    case '1/4':
      return bpb / 4;
    case '1/8':
      return bpb / 8;
    case '1/16':
      return bpb / 16;
    case '1/32':
      return bpb / 32;
    default:
      return bpb;
  }
}

export function genoBarChordSpecAtTimelineBar(
  bar: number,
  specs?: readonly GenoBarChordSpec[],
): GenoBarChordSpec | undefined {
  const specLen = specs?.length ?? 0;
  if (specLen === 0) return undefined;
  return specs![bar] ?? specs![bar % specLen];
}

function barChordSpecForBar(settings: GenoChordBuildSettings, bar: number): GenoBarChordSpec | undefined {
  return genoBarChordSpecAtTimelineBar(bar, settings.barChordSpecs);
}

/** Per-bar chop from loop editor; falls back to global repeater perf mode. */
function resolveBarChopStepBeats(
  settings: GenoChordBuildSettings,
  bar: number,
): number | null {
  const spec = barChordSpecForBar(settings, bar);
  const chop = spec?.chopQuant;
  if (chop && chop !== 'whole') {
    return genoBarChopStepBeats(chop, settings.beatsPerBar);
  }
  if (settings.perfMode === 'repeater') {
    return repeaterQuantBeats(settings.repeaterQuant ?? '1/8');
  }
  return null;
}

/** Apply seeded inversion / stack variation while keeping the same progression degrees. */
function applyVoicingSeed(
  settings: GenoChordBuildSettings,
  bar: number,
  spec?: GenoBarChordSpec,
): GenoBarChordSpec | undefined {
  if (settings.voicingSeed == null) return spec;
  const rnd = mulberry32((settings.voicingSeed ^ bar * 131) >>> 0);
  const base: GenoBarChordSpec = spec ? { ...spec } : { degree: 0 };
  return {
    ...base,
    inversion: Math.floor(rnd() * 3),
    stackOctave: rnd() > 0.46 ? true : spec?.stackOctave,
  };
}

/** Performance offsets in beats (low → high) — Chord Generator–style strum/arp, implemented locally. */
function perfOffsets(
  count: number,
  beatsPerBar: number,
  bpm: number,
  mode: GenoPerfMode,
  voicingSeed?: number,
): number[] {
  if (count <= 0) return [];
  const sixteenthBeats = 1 / 4;

  switch (mode) {
    case 'block':
      return Array.from({ length: count }, () => 0);
    case 'strum': {
      const step = Math.min(0.06, beatsPerBar * 0.08 / Math.max(1, count - 1));
      if (voicingSeed == null) {
        return Array.from({ length: count }, (_, i) => i * step);
      }
      const rnd = mulberry32(voicingSeed ^ 0x537472);
      const spread = step * (0.82 + rnd() * 0.38);
      return Array.from({ length: count }, (_, i) => i * spread);
    }
    case 'arp':
      if (voicingSeed == null) {
        return Array.from({ length: count }, (_, i) => i * sixteenthBeats * 0.9);
      }
      const rnd = mulberry32(voicingSeed ^ 0x415270);
      const gap = sixteenthBeats * (0.72 + rnd() * 0.42);
      return Array.from({ length: count }, (_, i) => i * gap);
    case 'slop': {
      const rnd = mulberry32(voicingSeed ?? count * 7919 + bpm);
      return Array.from({ length: count }, () => (rnd() - 0.5) * sixteenthBeats * 1.2);
    }
    default:
      return Array.from({ length: count }, () => 0);
  }
}

function progressionDegrees(id: GenoProgressionId): readonly number[] {
  return GENO_PROGRESSIONS.find((p) => p.id === id)?.degrees ?? [0, 4, 5, 3];
}

export function genoDefaultSettingsForStyle(
  style: GenoChordStyle,
  keyMode: StudioDetectedKeyMode,
): Partial<GenoChordBuildSettings> {
  const preset = genoStylePreset(style);
  void keyMode;
  return {
    progressionId: preset.defaultProgression,
    extensions: new Set(preset.extensions),
    inversion: preset.inversion,
    lockedType: preset.lockedType,
    smartMatch: preset.smartMatch,
    staccato: preset.staccato,
    perfMode: preset.perfMode,
    stylePreset: style,
  };
}

export function genoBuildHarmony(settings: GenoChordBuildSettings): GenoHarmony {
  const template = progressionDegrees(settings.progressionId);
  const specLoop = settings.barChordSpecs;
  const specLen = specLoop?.length ?? 0;
  const columns: GenoHarmonyColumn[] = [];
  for (let bar = 0; bar < settings.barCount; bar += 1) {
    const spec =
      specLen > 0
        ? specLen >= settings.barCount && bar < settings.barCount
          ? specLoop![bar]
          : specLoop![bar % specLen]
        : undefined;
    const voicedSpec = applyVoicingSeed(settings, bar, spec);
    const degree =
      voicedSpec?.degree ??
      spec?.degree ??
      settings.barDegrees?.[bar] ??
      template[bar % template.length] ??
      0;
    const voiced = buildVoicing(settings.keyRoot, settings.keyMode, degree, settings, voicedSpec);
    columns.push({ bar, degree, rootMidi: voiced.rootMidi, tones: voiced.tones });
  }
  return { columns };
}

function chordVelocityForHit(
  settings: GenoChordBuildSettings,
  col: GenoHarmonyColumn,
  voiceIndex: number,
  hitIndex: number,
  totalHits: number,
): number {
  const base = settings.stylePreset ? genoStylePreset(settings.stylePreset).chordVelocityBase : 76;
  const decay = totalHits > 1 ? (hitIndex / (totalHits - 1)) * 0.2 : 0;
  const accent = settings.perfMode === 'repeater' && hitIndex % 2 === 0 ? 6 : 0;
  return Math.max(
    48,
    Math.min(110, base + voiceIndex * 4 + (col.bar % 2) * 6 + accent - Math.round(decay * 18)),
  );
}

function pushVoicedChordHit(
  notes: StudioEditor2GenNote[],
  settings: GenoChordBuildSettings,
  col: GenoHarmonyColumn,
  hitStart: number,
  hitDur: number,
  hitIndex: number,
  totalHits: number,
  innerPerf: Exclude<GenoPerfMode, 'repeater'>,
): void {
  const bpm = settings.bpm ?? 120;
  const bpb = settings.beatsPerBar;
  const maxBeat = settings.barCount * bpb;
  const voices = col.tones;
  const offsets = perfOffsets(voices.length, bpb, bpm, innerPerf, settings.voicingSeed);

  voices.forEach((pitch, i) => {
    const startBeat = hitStart + offsets[i]!;
    if (startBeat >= maxBeat) return;
    const dur = Math.max(0.125, Math.min(hitDur - offsets[i]!, maxBeat - startBeat));
    notes.push({
      pitch,
      startBeat,
      durationBeats: dur,
      velocity: chordVelocityForHit(settings, col, i, hitIndex, totalHits),
    });
  });
}

/** Assemble chord MIDI from harmony columns + performance mode. */
export function genoHarmonyToNotes(settings: GenoChordBuildSettings, harmony: GenoHarmony): StudioEditor2GenNote[] {
  const bpb = settings.beatsPerBar;
  const maxBeat = settings.barCount * bpb;
  const notes: StudioEditor2GenNote[] = [];

  for (const col of harmony.columns) {
    const barStart = col.bar * bpb;
    const barDur =
      settings.staccato || (settings.perfMode === 'block' && settings.staccato)
        ? Math.max(0.5, bpb / 2)
        : Math.min(bpb * 0.96, bpb - 0.06);

    if (settings.includeBassRoot) {
      let bass = genoBassPitchFromHarmonyRoot(col.rootMidi);
      bass = genoWrapMidiToRange(bass, GENO_BASS_MIDI_MIN, GENO_BASS_MIDI_MAX);
      notes.push({
        pitch: bass,
        startBeat: barStart,
        durationBeats: barDur,
        velocity: 88,
      });
    }

    const barSpec = barChordSpecForBar(settings, col.bar);
    const passingTail = barSpec?.passingTail;
    const innerPerf: Exclude<GenoPerfMode, 'repeater'> =
      settings.perfMode === 'repeater' ? 'block' : settings.perfMode;

    if (passingTail) {
      const tailBeats = genoBarChopStepBeats(passingTail.quant, bpb);
      const mainBeats = Math.max(0, bpb - tailBeats);
      const passingVoiced = buildVoicing(
        settings.keyRoot,
        settings.keyMode,
        passingTail.spec.degree ?? col.degree,
        settings,
        passingTail.spec,
      );
      const passingCol: GenoHarmonyColumn = {
        bar: col.bar,
        degree: passingTail.spec.degree ?? col.degree,
        rootMidi: passingVoiced.rootMidi,
        tones: passingVoiced.tones,
      };
      if (mainBeats >= 0.125) {
        const mainDur = settings.staccato
          ? Math.max(0.125, mainBeats * 0.52)
          : Math.min(mainBeats * 0.96, mainBeats - 0.06);
        pushVoicedChordHit(notes, settings, col, barStart, mainDur, 0, 1, innerPerf);
      }
      const tailStart = barStart + mainBeats;
      const tailDur = settings.staccato
        ? Math.max(0.125, tailBeats * 0.52)
        : Math.max(0.125, tailBeats * 0.86);
      if (tailStart < maxBeat) {
        pushVoicedChordHit(
          notes,
          settings,
          passingCol,
          tailStart,
          Math.min(tailDur, maxBeat - tailStart),
          0,
          1,
          innerPerf,
        );
      }
      continue;
    }

    const chopStep = resolveBarChopStepBeats(settings, col.bar);

    if (chopStep != null && chopStep < bpb - 1e-6) {
      const hitDur = Math.max(0.125, chopStep * (settings.staccato ? 0.52 : 0.86));
      const hits: number[] = [];
      for (let t = 0; t < bpb - 1e-6; t += chopStep) {
        hits.push(barStart + t);
      }
      hits.forEach((hitStart, hitIndex) => {
        if (hitStart >= maxBeat) return;
        pushVoicedChordHit(
          notes,
          settings,
          col,
          hitStart,
          Math.min(hitDur, maxBeat - hitStart),
          hitIndex,
          hits.length,
          innerPerf,
        );
      });
      continue;
    }

    pushVoicedChordHit(
      notes,
      settings,
      col,
      barStart,
      barDur,
      0,
      1,
      innerPerf,
    );
  }

  return notes.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

export function genoGenerateChordsFromSettings(settings: GenoChordBuildSettings): GenoChordBuildResult {
  const harmony = genoBuildHarmony(settings);
  const notes = genoHarmonyToNotes(settings, harmony);
  return {
    progressionId: settings.progressionId,
    harmony,
    notes,
  };
}

export function genoGenerateChordsFromStyle(opts: {
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  barCount: number;
  beatsPerBar: number;
  bpm?: number;
  chordStyle: GenoChordStyle;
  seed: number;
  staccato?: boolean;
}): GenoChordBuildResult {
  const preset = genoDefaultSettingsForStyle(opts.chordStyle, opts.keyMode);
  const rnd = mulberry32(opts.seed ^ 0x4745_6e30);
  const progressionId = genoPickProgressionForStyle(opts.chordStyle, Math.floor(rnd() * 997));

  const settings: GenoChordBuildSettings = {
    keyRoot: normalizePc(opts.keyRoot),
    keyMode: opts.keyMode,
    barCount: opts.barCount,
    beatsPerBar: opts.beatsPerBar,
    bpm: opts.bpm,
    progressionId,
    smartMatch: preset.smartMatch ?? true,
    lockedType: preset.lockedType ?? 'maj',
    extensions: preset.extensions ?? new Set(),
    inversion: preset.inversion ?? 0,
    perfMode: preset.perfMode ?? 'block',
    staccato: opts.staccato ?? preset.staccato ?? false,
    repeaterQuant: '1/8',
    includeBassRoot: false,
    stylePreset: opts.chordStyle,
  };

  return genoGenerateChordsFromSettings(settings);
}
