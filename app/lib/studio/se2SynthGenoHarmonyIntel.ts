/**
 * Synth Geno Build 1 & 2 — scale-aware passing chords + anchor-chord progression ideas.
 * Additive harmony helpers (Chordio-style); does not replace existing engines.
 */
import {
  chordSymbolIntervalMap,
  MODE_LABELS,
  MODES_BY_FAMILY,
  type ChordMode,
  type ChordSymbol,
} from '@/app/lib/creationStation/chordBuilder';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import {
  GENO_PROGRESSIONS,
  type GenoBarChordSpec,
} from '@/app/lib/studio/se2SynthGenoChordEngine';
import {
  se2SynthGenoEraProgressionMode,
  se2SynthGenoRomanToBarSpec,
  type Se2SynthGenoEraCategoryId,
} from '@/app/lib/studio/se2SynthGenoEraProgressionLibrary';
import { SE2_SYNTH_GENO_ERA_PRESETS } from '@/app/lib/studio/se2SynthGenoEraProgressionLibrary';
import { se2SynthGenoLiveRomanToBarSpec } from '@/app/lib/studio/se2SynthGenoLiveChordRoman';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import { SE2_SYNTH_GENO_LIVE_ALL_DEFS } from '@/app/lib/studio/se2SynthGenoLiveChordPresets';
import { SE2_SYNTH_GENO_LIVE_DRILL_DEFS } from '@/app/lib/studio/se2SynthGenoLiveChordPresetsBatch2';
import { SE2_SYNTH_GENO_LIVE_JAZZ_DEFS } from '@/app/lib/studio/se2SynthGenoLiveChordPresetsJazz';
import { SE2_SYNTH_GENO_LIVE_GUITAR_LINES_DEFS } from '@/app/lib/studio/se2SynthGenoLiveChordPresetsGuitarPort';
import { SE2_SYNTH_GENO_LIVE_KPOP_DEFS } from '@/app/lib/studio/se2SynthGenoLiveChordPresetsKpop';
import type { Se2SynthGenoChordPluginState } from '@/app/lib/studio/se2SynthGenoChordPlugin';
import { se2SynthGenoBarDegreesFromProgression } from '@/app/lib/studio/se2SynthGenoChordPlugin';
import { se2SynthGenoPluginMapPatternToBarCount } from '@/app/lib/studio/se2SynthGenoEraProgressionLibrary';
import { se2SynthGenoPluginSyncLoopToBars, se2SynthGenoPluginBaseLoop } from '@/app/lib/studio/se2SynthGenoPluginProgressionTriggers';
import {
  se2SynthGenoApplyClusterVoicing,
  se2SynthGenoClusterStyleForGenre,
} from '@/app/lib/studio/se2SynthGenoClusterVoicing';
import type { GenoBarChopQuant } from '@/app/lib/studio/se2SynthGenoChordEngine';

const ROMAN_DEGREE: Record<string, number> = {
  I: 0,
  Imaj7: 0,
  I7: 0,
  Isus4: 0,
  'i(maj7)': 0,
  i: 0,
  i7: 0,
  ii: 1,
  ii7: 1,
  'ii°': 1,
  'iiø7': 1,
  iii: 2,
  iii7: 2,
  bIII: 2,
  bIIImaj7: 2,
  IV: 3,
  IVmaj7: 3,
  IV7: 3,
  iv: 3,
  iv7: 3,
  V: 4,
  V7: 4,
  Vsus4: 4,
  v: 4,
  vi: 5,
  vi7: 5,
  bVI: 5,
  bVImaj7: 5,
  VI: 5,
  VImaj7: 5,
  'vii°': 6,
  'vii°7': 6,
  bVII: 6,
  bVIImaj7: 6,
  bVII7: 6,
  VII: 6,
  VII7: 6,
  bII: 1,
  bIImaj7: 1,
};

export type GenoPassingChordKind =
  | 'passing'
  | 'approach'
  | 'bridge'
  | 'chromatic'
  | 'emotional'
  | 'cluster';

export type GenoPassingChordOption = {
  id: string;
  label: string;
  roman: ChordSymbol;
  spec: GenoBarChordSpec;
  kind: GenoPassingChordKind;
  /** Cluster-enriched voicing — lush stacked semitones. */
  isCluster?: boolean;
  /** Short hint for UI tooltips. */
  hint?: string;
  /** In-bar tail slice — keeps loop at 4/8/12 bars (no extra slots). */
  tailQuant?: Exclude<GenoBarChopQuant, 'whole'>;
};

export function se2SynthGenoPassingTailQuant(
  opt: GenoPassingChordOption,
): Exclude<GenoBarChopQuant, 'whole'> {
  return opt.tailQuant ?? (opt.isCluster ? '1/4' : '1/8');
}

export type GenoAnchorProgressionOption = {
  id: string;
  label: string;
  romanLine: string;
  romans: ChordSymbol[];
  source: 'era' | 'geno' | 'live';
  eraPresetId?: string;
  livePresetId?: string;
  /** Higher = stronger match (starts on anchor). */
  weight: number;
};

export type GenoBuildScaleOption = {
  id: ChordMode;
  label: string;
  group: 'Major family' | 'Minor family' | 'Other';
};

export const GENO_BUILD_SCALE_OPTIONS: readonly GenoBuildScaleOption[] = [
  ...MODES_BY_FAMILY.major.map((id) => ({
    id,
    label: MODE_LABELS[id],
    group: 'Major family' as const,
  })),
  ...MODES_BY_FAMILY.minor.map((id) => ({
    id,
    label: MODE_LABELS[id],
    group: 'Minor family' as const,
  })),
  ...MODES_BY_FAMILY.other.map((id) => ({
    id,
    label: MODE_LABELS[id],
    group: 'Other' as const,
  })),
];

const LIVE_DEF_POOL = [
  ...SE2_SYNTH_GENO_LIVE_ALL_DEFS,
  ...SE2_SYNTH_GENO_LIVE_DRILL_DEFS,
  ...SE2_SYNTH_GENO_LIVE_JAZZ_DEFS,
  ...SE2_SYNTH_GENO_LIVE_GUITAR_LINES_DEFS,
  ...SE2_SYNTH_GENO_LIVE_KPOP_DEFS,
];

function degreeOf(roman: ChordSymbol): number {
  return ROMAN_DEGREE[roman] ?? 0;
}

function validRoman(roman: ChordSymbol, mode: ChordMode): boolean {
  return chordSymbolIntervalMap(roman, mode) != null;
}

export function se2SynthGenoEffectiveScaleMode(
  keyMode: StudioDetectedKeyMode,
  scaleModeOverride?: ChordMode | null,
  presetMode?: ChordMode,
): ChordMode {
  if (scaleModeOverride) return scaleModeOverride;
  if (presetMode) return presetMode;
  return keyMode === 'minor' ? 'minor' : 'major';
}

function romanMatchesAnchor(roman: ChordSymbol, anchor: ChordSymbol): boolean {
  if (roman === anchor) return true;
  const a = degreeOf(anchor);
  const r = degreeOf(roman);
  return a === r;
}

function specForRoman(
  roman: ChordSymbol,
  mode: ChordMode,
  opts: {
    eraCategoryId?: Se2SynthGenoEraCategoryId;
    genreId?: Se2SynthGenoLiveGenreId;
    chopQuant?: GenoBarChopQuant;
  },
): GenoBarChordSpec {
  let spec: GenoBarChordSpec;
  if (opts.eraCategoryId) {
    spec = se2SynthGenoRomanToBarSpec(roman, opts.eraCategoryId);
  } else {
    spec = se2SynthGenoLiveRomanToBarSpec(
      roman,
      mode,
      opts.genreId ?? 'rnb',
    );
  }
  if (opts.chopQuant) {
    spec = { ...spec, chopQuant: opts.chopQuant };
  }
  return spec;
}

function pushPassingOption(
  out: GenoPassingChordOption[],
  seen: Set<string>,
  opt: Omit<GenoPassingChordOption, 'id'> & { idSuffix: string },
  fromRoman: ChordSymbol,
  toRoman: ChordSymbol,
  max: number,
): void {
  if (out.length >= max) return;
  const key = `${opt.roman}-${opt.isCluster ? 'c' : 's'}-${opt.idSuffix}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({
    ...opt,
    id: `pass-${fromRoman}-${toRoman}-${opt.idSuffix}${opt.isCluster ? '-cluster' : ''}`,
  });
}

type PassingRule = {
  id: string;
  label: string;
  kind: GenoPassingChordKind;
  hint?: string;
  clusterEligible?: boolean;
  halfBar?: boolean;
  roman: (mode: ChordMode, fromDeg: number, toDeg: number) => ChordSymbol;
  match: (fromDeg: number, toDeg: number, mode: ChordMode) => boolean;
};

const PASSING_RULES: readonly PassingRule[] = [
  {
    id: 'ii-approach',
    label: 'ii7 approach',
    kind: 'approach',
    hint: 'Sets up home with a soft ii → I pull',
    clusterEligible: true,
    roman: () => 'ii7',
    match: (f, t, m) => t === 0 && f !== 1 && (m === 'major' || m === 'mixolydian' || m === 'lydian'),
  },
  {
    id: 'V-turn',
    label: 'V7 turn',
    kind: 'approach',
    hint: 'Classic dominant pull into tonic',
    clusterEligible: true,
    roman: () => 'V7',
    match: (f, t) => t === 0 && f !== 4,
  },
  {
    id: 'iii-bridge',
    label: 'iii7 bridge',
    kind: 'bridge',
    hint: 'I → vi emotional side-step',
    clusterEligible: true,
    roman: () => 'iii7',
    match: (f, t) => f === 0 && t === 5,
  },
  {
    id: 'vi-bridge',
    label: 'vi7 bridge',
    kind: 'emotional',
    hint: 'Adds longing before IV or V',
    clusterEligible: true,
    roman: () => 'vi7',
    match: (f, t) => f === 0 && (t === 3 || t === 4),
  },
  {
    id: 'ii-V',
    label: 'iiø7 · V setup',
    kind: 'approach',
    hint: 'Jazz / gospel ii → V tension',
    clusterEligible: true,
    roman: (m) => (m === 'minor' || m === 'harmonicMinor' ? 'iiø7' : 'ii7'),
    match: (f, t) => t === 4 && f !== 1,
  },
  {
    id: 'dim-pass',
    label: 'vii°7 passing',
    kind: 'passing',
    hint: 'Diminished bridge — instant movement',
    clusterEligible: true,
    roman: () => 'vii°7',
    match: (f, t) => Math.abs(t - f) >= 2 && Math.abs(t - f) <= 4,
  },
  {
    id: 'bVII-neo',
    label: '♭VII maj7 (neo)',
    kind: 'chromatic',
    hint: 'Neo-soul lift — borrowed color',
    clusterEligible: true,
    roman: () => 'bVIImaj7',
    match: (f, t, m) =>
      (m === 'major' || m === 'mixolydian' || m === 'dorian') && (t === 3 || t === 0) && f !== 6,
  },
  {
    id: 'bII-phrygian',
    label: '♭II maj7 approach',
    kind: 'chromatic',
    hint: 'Phrygian / dark approach to i',
    clusterEligible: true,
    roman: () => 'bIImaj7',
    match: (f, t, m) =>
      (m === 'minor' || m === 'phrygian' || m === 'harmonicMinor') && t === 0 && f !== 1,
  },
  {
    id: 'sus-lift',
    label: 'Isus4 sus lift',
    kind: 'bridge',
    hint: 'Suspended tension before lift',
    clusterEligible: false,
    roman: (m) => (m === 'minor' ? 'i7' : 'Isus4'),
    match: (f, t) => f === 0 && t >= 3,
  },
  {
    id: 'IV-bridge',
    label: 'IV maj7 pad',
    kind: 'bridge',
    hint: 'Warm pad into dominant area',
    clusterEligible: true,
    roman: () => 'IVmaj7',
    match: (f, t) => f <= 1 && t >= 4,
  },
  {
    id: 'borrowed-iv',
    label: 'iv minor (borrowed)',
    kind: 'emotional',
    hint: 'Beatles / gospel ache — major key iv',
    clusterEligible: true,
    roman: () => 'iv7',
    match: (f, t, m) =>
      (m === 'major' || m === 'mixolydian' || m === 'lydian') && f === 0 && (t === 4 || t === 5),
  },
  {
    id: 'bVI-lift',
    label: '♭VI maj7 lift',
    kind: 'emotional',
    hint: 'Deceptive lift — cinematic release',
    clusterEligible: true,
    roman: () => 'bVImaj7',
    match: (f, t, m) =>
      (m === 'major' || m === 'mixolydian') && t === 5 && f !== 5,
  },
  {
    id: 'bIII-color',
    label: '♭III maj7 color',
    kind: 'chromatic',
    hint: 'Chromatic mediant — sudden brightness',
    clusterEligible: true,
    roman: () => 'bIIImaj7',
    match: (f, t, m) =>
      (m === 'minor' || m === 'dorian' || m === 'phrygian') && Math.abs(t - f) >= 2,
  },
  {
    id: 'Vsus4-pass',
    label: 'Vsus4 → V sus',
    kind: 'bridge',
    hint: 'Hanging dominant — resolves forward',
    clusterEligible: false,
    roman: () => 'Vsus4',
    match: (f, t) => t === 4 && f !== 4,
  },
  {
    id: 'tritone-sub',
    label: '♭II7 tritone sub',
    kind: 'chromatic',
    hint: 'Jazz / R&B slide into V',
    clusterEligible: true,
    roman: () => 'bIImaj7',
    match: (f, t) => t === 4 && f <= 2,
  },
  {
    id: 'deceptive-bVI',
    label: '♭VI deceptive',
    kind: 'emotional',
    hint: 'V expected → emotional sidestep',
    clusterEligible: true,
    roman: (m) => (m === 'minor' ? 'VImaj7' : 'bVImaj7'),
    match: (f, t) => f === 4 && t === 5,
  },
  {
    id: 'secondary-V-vi',
    label: 'V7/vi secondary',
    kind: 'approach',
    hint: 'Dominant of vi — pulls into relative minor',
    clusterEligible: true,
    roman: () => 'V7',
    match: (f, t) => t === 5 && f !== 4,
  },
  {
    id: 'Idim-pass',
    label: '#Idim7 passing',
    kind: 'passing',
    hint: 'Gospel chromatic connector',
    clusterEligible: true,
    roman: () => 'vii°7',
    match: (f, t) => f === 0 && t === 1,
  },
  {
    id: 'maj7-breathe',
    label: 'I maj7 breathe',
    kind: 'emotional',
    hint: 'Pause on tonic maj7 — soul reset',
    clusterEligible: true,
    halfBar: true,
    roman: (m) => (m === 'minor' ? 'i(maj7)' : 'Imaj7'),
    match: (f, t) => f === 3 && t === 0,
  },
  {
    id: 'IV7-blues',
    label: 'IV7 blues slide',
    kind: 'bridge',
    hint: 'Blues dominant color into V',
    clusterEligible: true,
    roman: () => 'IV7',
    match: (f, t, m) =>
      (m === 'mixolydian' || m === 'major' || m === 'dorian') && t === 4 && f === 3,
  },
  {
    id: 'min-plagal',
    label: 'iv plagal ache',
    kind: 'emotional',
    hint: 'Minor plagal — deep feeling',
    clusterEligible: true,
    roman: () => 'iv7',
    match: (f, t, m) =>
      (m === 'minor' || m === 'dorian' || m === 'harmonicMinor') && f === 0 && t >= 3,
  },
  {
    id: 'bVII7-rock',
    label: '♭VII maj7 rock lift',
    kind: 'chromatic',
    hint: 'Mixolydian power lift',
    clusterEligible: true,
    roman: () => 'bVIImaj7',
    match: (f, t, m) => (m === 'mixolydian' || m === 'major') && t === 3,
  },
];

/** Passing chords between two progression steps (scale-aware + optional clusters). */
export function se2SynthGenoPassingChordsBetween(
  fromRoman: ChordSymbol,
  toRoman: ChordSymbol,
  scaleMode: ChordMode,
  opts?: {
    eraCategoryId?: Se2SynthGenoEraCategoryId;
    genreId?: Se2SynthGenoLiveGenreId;
    maxOptions?: number;
    includeClusters?: boolean;
  },
): GenoPassingChordOption[] {
  const fromDeg = degreeOf(fromRoman);
  const toDeg = degreeOf(toRoman);
  const max = opts?.maxOptions ?? 10;
  const includeClusters = opts?.includeClusters !== false;
  const out: GenoPassingChordOption[] = [];
  const seen = new Set<string>();
  const clusterStyle = se2SynthGenoClusterStyleForGenre(opts?.genreId, scaleMode);

  for (const rule of PASSING_RULES) {
    if (!rule.match(fromDeg, toDeg, scaleMode)) continue;
    const roman = rule.roman(scaleMode, fromDeg, toDeg);
    if (!validRoman(roman, scaleMode)) continue;

    const baseSpec = specForRoman(roman, scaleMode, {
      eraCategoryId: opts?.eraCategoryId,
      genreId: opts?.genreId,
    });
    const tailQuant: Exclude<GenoBarChopQuant, 'whole'> = rule.halfBar ? '1/2' : '1/8';

    pushPassingOption(
      out,
      seen,
      {
        idSuffix: rule.id,
        label: rule.label,
        roman,
        spec: baseSpec,
        kind: rule.kind,
        hint: rule.hint,
        isCluster: false,
        tailQuant,
      },
      fromRoman,
      toRoman,
      max,
    );

    if (includeClusters && rule.clusterEligible !== false && out.length < max) {
      const clusterSpec = se2SynthGenoApplyClusterVoicing(baseSpec, clusterStyle);
      pushPassingOption(
        out,
        seen,
        {
          idSuffix: `${rule.id}-cluster`,
          label: `${rule.label} · cluster`,
          roman,
          spec: clusterSpec,
          kind: 'cluster',
          hint: `${rule.hint ?? rule.label} — stacked 9 · #11 · 13 color`,
          isCluster: true,
          tailQuant: rule.halfBar ? '1/2' : '1/4',
        },
        fromRoman,
        toRoman,
        max,
      );
    }

    if (out.length >= max) break;
  }

  if (out.length === 0) {
    const neighbor =
      scaleMode === 'minor' || scaleMode === 'dorian' || scaleMode === 'phrygian'
        ? 'VImaj7'
        : 'vi7';
    if (validRoman(neighbor as ChordSymbol, scaleMode)) {
      const base = specForRoman(neighbor as ChordSymbol, scaleMode, opts ?? {});
      pushPassingOption(
        out,
        seen,
        {
          idSuffix: 'color',
          label: 'Color bridge',
          roman: neighbor as ChordSymbol,
          spec: base,
          kind: 'bridge',
          isCluster: false,
        },
        fromRoman,
        toRoman,
        max,
      );
      if (includeClusters) {
        pushPassingOption(
          out,
          seen,
          {
            idSuffix: 'color-cluster',
            label: 'Color bridge · cluster',
            roman: neighbor as ChordSymbol,
            spec: se2SynthGenoApplyClusterVoicing(base, clusterStyle),
            kind: 'cluster',
            isCluster: true,
          },
          fromRoman,
          toRoman,
          max,
        );
      }
    }
  }

  return out;
}

const PASSING_KIND_SORT_ORDER: Record<GenoPassingChordKind, number> = {
  approach: 0,
  passing: 1,
  bridge: 2,
  emotional: 3,
  chromatic: 4,
  cluster: 5,
};

/** Traditional-first ordering for loop editor chips. */
export function se2SynthGenoSortPassingOptions(
  options: readonly GenoPassingChordOption[],
): GenoPassingChordOption[] {
  return [...options].sort((a, b) => {
    const ka = PASSING_KIND_SORT_ORDER[a.kind] ?? 9;
    const kb = PASSING_KIND_SORT_ORDER[b.kind] ?? 9;
    if (ka !== kb) return ka - kb;
    if (!!a.isCluster !== !!b.isCluster) return a.isCluster ? 1 : -1;
    return a.label.localeCompare(b.label);
  });
}

export function se2SynthGenoIsClassicPassingOption(opt: GenoPassingChordOption): boolean {
  return !opt.isCluster && opt.kind !== 'chromatic';
}

export function se2SynthGenoIsColorPassingOption(opt: GenoPassingChordOption): boolean {
  return opt.isCluster || opt.kind === 'chromatic';
}

export type GenoPassingBarTransition = {
  fromRoman: ChordSymbol | string;
  toRoman: ChordSymbol | string;
  canInsert: boolean;
  isLoopWrap: boolean;
};

/** From-bar → to-bar for passing inserts (includes last bar → bar 1 when loopWrap). */
export function se2SynthGenoPassingTransitionForBar(
  barIndex: number,
  barRomans: readonly (ChordSymbol | string)[],
  loopWrap = true,
): GenoPassingBarTransition | null {
  if (barIndex < 0 || barIndex >= barRomans.length || barRomans.length < 2) return null;
  const fromRoman = barRomans[barIndex];
  if (!fromRoman) return null;
  if (barIndex < barRomans.length - 1) {
    const toRoman = barRomans[barIndex + 1];
    if (!toRoman) return null;
    return { fromRoman, toRoman, canInsert: true, isLoopWrap: false };
  }
  if (!loopWrap) {
    return { fromRoman, toRoman: '', canInsert: false, isLoopWrap: false };
  }
  const toRoman = barRomans[0];
  if (!toRoman) return null;
  return { fromRoman, toRoman, canInsert: true, isLoopWrap: true };
}

/** Per-slot passing options (from this slot → next in play order). */
export function se2SynthGenoPassingOptionsForSlot(
  slotIndex: number,
  romans: readonly ChordSymbol[],
  playOrder: readonly number[],
  scaleMode: ChordMode,
  opts?: {
    eraCategoryId?: Se2SynthGenoEraCategoryId;
    genreId?: Se2SynthGenoLiveGenreId;
    maxOptions?: number;
    includeClusters?: boolean;
  },
): GenoPassingChordOption[] {
  const ordered = [...Array.from({ length: romans.length }, (_, i) => i)].sort(
    (a, b) => (playOrder[a] ?? a + 1) - (playOrder[b] ?? b + 1),
  );
  const pos = ordered.indexOf(slotIndex);
  if (pos < 0 || pos >= ordered.length - 1) return [];
  const fromRoman = romans[slotIndex];
  const nextSlot = ordered[pos + 1]!;
  const toRoman = romans[nextSlot];
  if (!fromRoman || !toRoman) return [];
  return se2SynthGenoPassingChordsBetween(fromRoman, toRoman, scaleMode, opts);
}

/** Loop editor piano roll — passing tails between consecutive timeline bars (or loop wrap). */
export function se2SynthGenoPassingOptionsForBar(
  barIndex: number,
  barRomans: readonly (ChordSymbol | string)[],
  scaleMode: ChordMode,
  opts?: {
    eraCategoryId?: Se2SynthGenoEraCategoryId;
    genreId?: Se2SynthGenoLiveGenreId;
    maxOptions?: number;
    includeClusters?: boolean;
    loopWrap?: boolean;
  },
): GenoPassingChordOption[] {
  const transition = se2SynthGenoPassingTransitionForBar(
    barIndex,
    barRomans,
    opts?.loopWrap !== false,
  );
  if (!transition?.canInsert) return [];
  return se2SynthGenoSortPassingOptions(
    se2SynthGenoPassingChordsBetween(
      transition.fromRoman as ChordSymbol,
      transition.toRoman as ChordSymbol,
      scaleMode,
      opts,
    ),
  );
}

function se2SynthGenoApplyPassingTailToSpec(
  spec: GenoBarChordSpec,
  option: GenoPassingChordOption,
): GenoBarChordSpec {
  const quant = se2SynthGenoPassingTailQuant(option);
  const { chopQuant: _chop, passingTail: _prev, ...passSpec } = option.spec;
  return {
    ...spec,
    passingTail: {
      spec: { ...passSpec },
      roman: option.roman,
      quant,
    },
  };
}

function se2SynthGenoPluginTimelineBarSpecs(state: Se2SynthGenoChordPluginState): GenoBarChordSpec[] {
  if (state.barChordSpecs?.length) {
    return state.barChordSpecs.map((s) => ({ ...s }));
  }
  return se2SynthGenoPluginMapPatternToBarCount(
    (state.barDegrees ??
      se2SynthGenoBarDegreesFromProgression(state.progressionId, state.barCount)).map(
      (d) => ({ degree: d, smartMatch: true }),
    ),
    state.barCount,
    {
      romans: state.progressionRomans,
      eraCategoryId: state.eraCategoryId,
      presetId: state.eraPresetId,
    },
  );
}

/** Build 2 — in-bar passing tail on a timeline bar (loop length stays 4/8/12). */
export function se2SynthGenoPluginInsertPassingAfterBar(
  state: Se2SynthGenoChordPluginState,
  afterBarIndex: number,
  option: GenoPassingChordOption,
): Se2SynthGenoChordPluginState {
  const barChordSpecs = se2SynthGenoPluginTimelineBarSpecs(state);
  if (afterBarIndex < 0 || afterBarIndex >= barChordSpecs.length) return state;
  barChordSpecs[afterBarIndex] = se2SynthGenoApplyPassingTailToSpec(
    barChordSpecs[afterBarIndex]!,
    option,
  );
  return { ...state, barChordSpecs };
}

/** Build 1 — in-bar passing tail on a timeline bar. */
export function se2SynthGenoLiveInsertPassingAfterBar(
  barSpecs: readonly GenoBarChordSpec[],
  afterBarIndex: number,
  option: GenoPassingChordOption,
): GenoBarChordSpec[] | null {
  if (afterBarIndex < 0 || afterBarIndex >= barSpecs.length) return null;
  const nextSpecs = barSpecs.map((s) => ({ ...s }));
  nextSpecs[afterBarIndex] = se2SynthGenoApplyPassingTailToSpec(nextSpecs[afterBarIndex]!, option);
  return nextSpecs;
}

function pushAnchorOption(
  out: GenoAnchorProgressionOption[],
  seen: Set<string>,
  opt: GenoAnchorProgressionOption,
  max: number,
): void {
  if (seen.has(opt.id) || out.length >= max) return;
  seen.add(opt.id);
  out.push(opt);
}

/** Full progression ideas that start on (or strongly feature) one anchor chord. */
export function se2SynthGenoProgressionsFromAnchor(
  anchorRoman: ChordSymbol,
  scaleMode: ChordMode,
  opts?: {
    eraCategoryId?: Se2SynthGenoEraCategoryId;
    maxResults?: number;
  },
): GenoAnchorProgressionOption[] {
  const max = opts?.maxResults ?? 8;
  const out: GenoAnchorProgressionOption[] = [];
  const seen = new Set<string>();

  for (const preset of SE2_SYNTH_GENO_ERA_PRESETS) {
    if (opts?.eraCategoryId && preset.categoryId !== opts.eraCategoryId) continue;
    const mode = se2SynthGenoEraProgressionMode(preset.categoryId);
    if (scaleMode !== mode && scaleMode !== 'major' && scaleMode !== 'minor') {
      // Allow cross-family only when anchor validates in scale
      if (!validRoman(anchorRoman, scaleMode)) continue;
    }
    const starts = romanMatchesAnchor(preset.romans[0]!, anchorRoman);
    const contains = preset.romans.some((r) => romanMatchesAnchor(r, anchorRoman));
    if (!starts && !contains) continue;
    pushAnchorOption(
      out,
      seen,
      {
        id: `era-${preset.id}`,
        label: preset.name.split(' · ').slice(-1)[0] ?? preset.name,
        romanLine: preset.romanLine,
        romans: [...preset.romans],
        source: 'era',
        eraPresetId: preset.id,
        weight: starts ? 100 : 60,
      },
      max,
    );
  }

  for (const def of GENO_PROGRESSIONS) {
    const romans = def.label.split('·').map((s) => s.trim()) as ChordSymbol[];
    const starts = romanMatchesAnchor(romans[0]!, anchorRoman);
    if (!starts) continue;
    pushAnchorOption(
      out,
      seen,
      {
        id: `geno-${def.id}`,
        label: def.label,
        romanLine: def.label,
        romans,
        source: 'geno',
        weight: 80,
      },
      max,
    );
  }

  for (const def of LIVE_DEF_POOL) {
    const loop = def.loop ?? def.romans12 ?? def.romans;
    if (loop.length === 0) continue;
    const starts = romanMatchesAnchor(loop[0]!, anchorRoman);
    const contains = loop.some((r) => romanMatchesAnchor(r, anchorRoman));
    if (!starts && !contains) continue;
    if (def.mode !== scaleMode && !validRoman(anchorRoman, scaleMode)) continue;
    pushAnchorOption(
      out,
      seen,
      {
        id: `live-${def.id}`,
        label: def.name,
        romanLine: loop.slice(0, 8).join(' · '),
        romans: loop.slice(0, 8),
        source: 'live',
        livePresetId: def.id,
        weight: starts ? 90 : 50,
      },
      max,
    );
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, max);
}

/** Build 2 — attach a short in-bar passing tail (loop length stays 4/8/12). */
export function se2SynthGenoPluginInsertPassingAfter(
  state: Se2SynthGenoChordPluginState,
  afterSlotIndex: number,
  option: GenoPassingChordOption,
  keyMode: StudioDetectedKeyMode,
): Se2SynthGenoChordPluginState {
  if (afterSlotIndex < 0 || afterSlotIndex >= state.barCount) return state;
  const quant = se2SynthGenoPassingTailQuant(option);
  const { chopQuant: _chop, passingTail: _prev, ...passSpec } = option.spec;
  const loop = se2SynthGenoPluginBaseLoop(state).map((s) => ({ ...s }));
  loop[afterSlotIndex] = {
    ...loop[afterSlotIndex]!,
    passingTail: {
      spec: { ...passSpec },
      roman: option.roman,
      quant,
    },
  };
  return se2SynthGenoPluginSyncLoopToBars(
    {
      ...state,
      progressionLoop: loop,
    },
    keyMode,
  );
}

/** Build 1 — in-bar passing tail on the focused slot (no splice / no odd bar counts). */
export function se2SynthGenoLiveInsertPassingAfter(
  specs: readonly GenoBarChordSpec[],
  romans: readonly ChordSymbol[],
  afterSlotIndex: number,
  option: GenoPassingChordOption,
): { specs: GenoBarChordSpec[]; romans: ChordSymbol[] } | null {
  if (afterSlotIndex < 0 || afterSlotIndex >= specs.length) return null;
  const quant = se2SynthGenoPassingTailQuant(option);
  const { chopQuant: _chop, passingTail: _prev, ...passSpec } = option.spec;
  const nextSpecs = specs.map((s) => ({ ...s }));
  nextSpecs[afterSlotIndex] = {
    ...nextSpecs[afterSlotIndex]!,
    passingTail: {
      spec: { ...passSpec },
      roman: option.roman,
      quant,
    },
  };
  return { specs: nextSpecs, romans: [...romans] };
}
