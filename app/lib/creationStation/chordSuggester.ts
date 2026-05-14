/**
 * Pluggable "next-chord" suggestion engine for Chord Builder.
 *
 * The Chord Builder UI calls one interface — `ChordSuggester` — and never
 * cares which brain is running underneath. Today that brain is the
 * rule-based Markov chain that mines transitions out of your curated genre
 * data. Tomorrow it can be a real neural net (ChordSeqAI's Conditional
 * Transformer L exported to ONNX, run in the browser via ONNX Runtime Web
 * inside a web worker — same approach the upstream project uses).
 *
 * Swapping engines is a one-file change: add a new module that implements
 * {@link ChordSuggester}, list it in {@link CHORD_SUGGESTER_BACKENDS}, and
 * the UI picks it up with no further wiring.
 *
 * Reference upstream: https://github.com/PetrIvan/chord-seq-ai-app (MIT)
 */

import type { ChordMode, ChordSymbol, GenreDef } from './chordBuilder';

// ─────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────

/**
 * A single ranked suggestion the engine produces for the next chord slot.
 * `confidence` is a [0,1] probability — the suggester is responsible for
 * normalising across the top-K it returns so the UI can render a clean bar
 * chart without re-scaling.
 */
export interface ChordSuggestion {
  /** Roman-numeral chord symbol from the active mode (e.g. `i`, `IV7`, `V`). */
  chord: ChordSymbol;
  /** Normalised probability in [0,1]. The top-K returned should sum to ~1. */
  confidence: number;
  /** Short human-readable explanation — shown as a tooltip / debug hint.
   *  Rule-based: "appears 4× after Am in 90s R&B". ONNX: "p=0.42 · softmax". */
  rationale?: string;
}

/**
 * Everything the suggester needs to make a call. `context` is the full
 * progression-so-far (oldest → newest); rule-based engines may only look
 * at the tail, but a sequence model will use all of it.
 */
export interface ChordSuggestArgs {
  context: ReadonlyArray<ChordSymbol>;
  genre: GenreDef;
  mode: ChordMode;
  /** MIDI pitch-class of the key root (0=C … 11=B). Currently unused by the
   *  rule-based backend (it works in Roman-numeral space) but exposed
   *  because a future MIDI-tokenised ONNX backend will need it. */
  keyRoot: number;
  /** How many candidates to return. Most UIs render 4–6. */
  topK: number;
  /**
   * Sampling temperature for stochastic backends. >1 = more adventurous,
   * <1 = safer. Rule-based ignores this; ONNX backends scale logits by
   * `1/temperature` before softmax. Default = 1.0.
   */
  temperature?: number;
  /**
   * Optional decade tag — used by ChordSeqAI's Conditional Transformer to
   * bias generation. The rule-based backend ignores it, but the type lives
   * here so callers can plumb it through today without touching UI code
   * once we flip to ONNX. Format: '50s' | '60s' | '70s' | '80s' | '90s' |
   * '2000s' | '2010s' | undefined = no preference.
   */
  decade?: string;
}

/**
 * The contract every backend implements. `name` and `displayName` show up
 * in the "AI Suggestions" strip so the user knows which brain is talking.
 */
export interface ChordSuggester {
  /** Stable identifier (kebab-case). Used in URLs / settings / telemetry. */
  readonly id: ChordSuggesterId;
  /** Short label rendered in the UI badge ("Rule-Based", "Cond. T-L"). */
  readonly displayName: string;
  /** Long description rendered in the info popover / tooltip. */
  readonly description: string;
  /** True when the backend runs purely client-side without a model file —
   *  used to decide whether to show a "loading model…" spinner on first use. */
  readonly isLocal: boolean;
  /** True when the backend is shippable today. ONNX is `false` until the
   *  model files are bundled; the factory hides unavailable backends. */
  readonly isAvailable: boolean;
  /**
   * Produce up to `topK` candidate next chords. Async because future
   * backends will call into a web worker / ONNX session; the rule-based
   * implementation resolves synchronously inside the Promise.
   */
  suggest(args: ChordSuggestArgs): Promise<ChordSuggestion[]>;
}

/** Stable identifiers for every backend the factory knows about. Add a
 *  new literal here when you wire in a new engine. */
export type ChordSuggesterId =
  | 'rule-based'
  | 'onnx-rnn'
  | 'onnx-cond-transformer-s'
  | 'onnx-cond-transformer-m'
  | 'onnx-cond-transformer-l';

// ─────────────────────────────────────────────────────────────────────────
// Backend registry
// ─────────────────────────────────────────────────────────────────────────

/**
 * Backend metadata exposed to the UI (model picker). Keep this list in
 * sync with the implementations below — order is display order. The actual
 * implementations are imported lazily inside {@link getChordSuggester} so
 * onnxruntime-web never enters the bundle until somebody picks an ONNX
 * backend.
 */
export interface ChordSuggesterBackendInfo {
  id: ChordSuggesterId;
  displayName: string;
  description: string;
  isLocal: boolean;
  isAvailable: boolean;
  /** Rough model size on the wire (MB) — shown in the picker so users know
   *  what they're committing to download. Undefined for built-ins. */
  approximateDownloadMb?: number;
  /** Higher = better in the upstream paper. Shown next to model name. */
  reportedAccuracyPercent?: number;
}

export const CHORD_SUGGESTER_BACKENDS: readonly ChordSuggesterBackendInfo[] = [
  {
    id: 'rule-based',
    displayName: 'Rule-Based',
    description:
      'Markov chain over your curated genre progressions. Looks at the previous 1–2 chords and ' +
      'ranks candidates by how often they actually follow that pattern in the dataset. Fast, ' +
      'deterministic, no model download.',
    isLocal: true,
    isAvailable: true,
  },
  // The four ONNX backends ship as `isAvailable: false` until we drop the
  // model files into `public/models/` and finish the worker glue. Listed
  // here so the picker UI can show them as "coming soon" placeholders —
  // and so a future PR only has to flip `isAvailable` to enable them.
  {
    id: 'onnx-rnn',
    displayName: 'RNN (ChordSeqAI)',
    description:
      'Recurrent network from ChordSeqAI. Tiny + fast but lower accuracy. Good for low-end devices.',
    isLocal: true,
    isAvailable: false,
    approximateDownloadMb: 2,
    reportedAccuracyPercent: 60,
  },
  {
    id: 'onnx-cond-transformer-s',
    displayName: 'Cond. Transformer S',
    description:
      'Genre + decade-aware transformer (530K params). Sweet spot between size and quality.',
    isLocal: true,
    isAvailable: false,
    approximateDownloadMb: 3,
    reportedAccuracyPercent: 75,
  },
  {
    id: 'onnx-cond-transformer-m',
    displayName: 'Cond. Transformer M',
    description:
      'Larger genre-aware transformer (1.5M params). Slightly stronger long-range structure.',
    isLocal: true,
    isAvailable: false,
    approximateDownloadMb: 7,
    reportedAccuracyPercent: 76,
  },
  {
    id: 'onnx-cond-transformer-l',
    displayName: 'Cond. Transformer L',
    description:
      'Best-quality model. 3.5M params, genre + decade conditioned. Recommended once bundled.',
    isLocal: true,
    isAvailable: false,
    approximateDownloadMb: 14,
    reportedAccuracyPercent: 77,
  },
];

/**
 * Return only the backends that are wired up + shippable today. The
 * picker UI uses this to grey out anything still flagged unavailable.
 */
export function getAvailableChordSuggesterBackends(): ChordSuggesterBackendInfo[] {
  return CHORD_SUGGESTER_BACKENDS.filter((b) => b.isAvailable);
}

export const DEFAULT_CHORD_SUGGESTER_ID: ChordSuggesterId = 'rule-based';

// ─────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────

/**
 * Resolve a backend ID to a concrete {@link ChordSuggester}. Throws if the
 * backend isn't available (UI is expected to validate first via
 * {@link getAvailableChordSuggesterBackends}). Currently always returns
 * the rule-based engine because the ONNX backends are still flagged as
 * `isAvailable: false`; the switch statement is wired up so a future PR
 * just has to populate the ONNX cases.
 */
export async function getChordSuggester(
  id: ChordSuggesterId = DEFAULT_CHORD_SUGGESTER_ID,
): Promise<ChordSuggester> {
  const info = CHORD_SUGGESTER_BACKENDS.find((b) => b.id === id);
  if (!info) {
    throw new Error(`Unknown chord suggester backend: ${id}`);
  }
  if (!info.isAvailable) {
    throw new Error(
      `Chord suggester backend "${info.displayName}" is not yet wired up. ` +
        `Falling back to the rule-based engine by default.`,
    );
  }
  switch (id) {
    case 'rule-based': {
      // Dynamic import keeps the dependency graph clean — if a future
      // backend needs ONNX Runtime, it lives behind its own import and
      // never enters the bundle for users who never pick it.
      const mod = await import('./chordSuggesterRuleBased');
      return mod.ruleBasedSuggester;
    }
    case 'onnx-rnn':
    case 'onnx-cond-transformer-s':
    case 'onnx-cond-transformer-m':
    case 'onnx-cond-transformer-l': {
      // Future: load the ONNX backend module + pass the variant.
      // const mod = await import('./chordSuggesterOnnx');
      // return mod.makeOnnxSuggester(id);
      throw new Error(
        `ONNX backend "${id}" not yet implemented — see app/lib/creationStation/chordSuggesterOnnx.ts`,
      );
    }
    default: {
      const _exhaust: never = id;
      void _exhaust;
      throw new Error(`Unhandled chord suggester backend: ${id}`);
    }
  }
}
