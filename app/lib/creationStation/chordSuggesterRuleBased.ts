/**
 * Rule-based chord suggester — the default backend behind Chord Builder's
 * "AI Suggestions" strip.
 *
 * Strategy:
 *  1. Build a 2-gram (and 1-gram fallback) Markov table from every curated
 *     progression in the active genre. Each (prev, next) and (prev_prev,
 *     prev, next) tuple gets a frequency count.
 *  2. Given the user's progression-so-far, prefer the 2-gram model when
 *     the last two chords appear in the table; otherwise fall back to the
 *     1-gram model anchored on the last chord; otherwise fall back to the
 *     most common starting chords in the genre.
 *  3. Normalise the top-K frequencies into a probability distribution
 *     summing to 1.0 so the UI can render confidence bars without further
 *     scaling.
 *
 * This is intentionally compatible with the original `suggestNextChord` /
 * `suggestLikelyNextChords` helpers — same data source, same chord-symbol
 * space — just packaged behind the swappable {@link ChordSuggester}
 * interface so the UI can pivot to an ONNX backend later with zero
 * call-site churn.
 */

import { getModePads, type ChordSymbol, type GenreDef } from './chordBuilder';
import type {
  ChordSuggestArgs,
  ChordSuggester,
  ChordSuggestion,
} from './chordSuggester';

/**
 * Mine 1-gram and 2-gram transition counts out of every curated
 * progression in `genre`. Progressions are treated as cyclic — the last
 * chord transitions back to the first — so loop-friendly suggestions stay
 * available even when the user is near the end of a phrase.
 */
function buildTransitionTables(genre: GenreDef): {
  unigram: Record<string, Record<string, number>>;
  bigram: Record<string, Record<string, number>>;
  startCounts: Record<string, number>;
} {
  const unigram: Record<string, Record<string, number>> = {};
  const bigram: Record<string, Record<string, number>> = {};
  const startCounts: Record<string, number> = {};
  for (const prog of genre.progressions) {
    const chords = prog.chords;
    if (chords.length === 0) continue;
    const first = chords[0]!;
    startCounts[first] = (startCounts[first] ?? 0) + 1;
    for (let i = 0; i < chords.length; i++) {
      const prev = chords[i]!;
      const next = chords[(i + 1) % chords.length]!;
      if (!unigram[prev]) unigram[prev] = {};
      unigram[prev][next] = (unigram[prev][next] ?? 0) + 1;
      if (i > 0) {
        const prev2 = chords[i - 1]!;
        const key = `${prev2}|${prev}`;
        if (!bigram[key]) bigram[key] = {};
        bigram[key][next] = (bigram[key][next] ?? 0) + 1;
      }
    }
  }
  return { unigram, bigram, startCounts };
}

/**
 * Convert `{chord: count}` records to a top-K array of normalised
 * suggestions. Total of `confidence` sums to ~1 across the returned slice.
 * `rationaleFn` receives the raw count + total and produces a tooltip
 * string the UI surfaces on hover.
 */
function topKFromCounts(
  counts: Record<string, number>,
  topK: number,
  rationaleFn: (chord: ChordSymbol, count: number, total: number) => string,
): ChordSuggestion[] {
  const entries = Object.entries(counts);
  if (entries.length === 0) return [];
  entries.sort((a, b) => b[1] - a[1]);
  const head = entries.slice(0, Math.max(1, topK));
  const totalHead = head.reduce((acc, [, c]) => acc + c, 0);
  const overallTotal = entries.reduce((acc, [, c]) => acc + c, 0);
  return head.map(([chord, count]) => ({
    chord,
    confidence: totalHead > 0 ? count / totalHead : 0,
    rationale: rationaleFn(chord, count, overallTotal),
  }));
}

/**
 * Suggest a next chord with no progression context. Used when the user
 * clears the timeline — we surface the most common starting chords in the
 * genre so they always have something clickable.
 */
function suggestFromStart(
  startCounts: Record<string, number>,
  genre: GenreDef,
  topK: number,
): ChordSuggestion[] {
  const fromStarts = topKFromCounts(startCounts, topK, (_c, count, total) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `${count} ${count === 1 ? 'progression' : 'progressions'} in ${genre.label} start here (${pct}% of starts)`;
  });
  if (fromStarts.length > 0) return fromStarts;
  // Absolute last-resort fallback — surface the mode's tonic (first pad
  // returned by `getModePads`) so the UI never renders empty.
  const modePads = getModePads(genre.mode);
  const tonic = modePads[0] ?? 'I';
  return [
    {
      chord: tonic,
      confidence: 1,
      rationale: `Default tonic chord for ${genre.mode}`,
    },
  ];
}

/**
 * Concrete implementation of the {@link ChordSuggester} contract.
 *
 * Notes:
 *  - The function is `async` to match the interface, but never awaits
 *    anything — all work is in-memory and synchronous. Returning a Promise
 *    keeps the call site uniform with future ONNX backends that *will*
 *    await a web-worker round-trip.
 *  - Tables are recomputed per call. The genre data is small (~hundreds of
 *    chords total) so caching wouldn't move the needle; keeping it
 *    stateless avoids any cache-invalidation footguns when the user edits
 *    the underlying preset data.
 */
async function ruleBasedSuggest(
  args: ChordSuggestArgs,
): Promise<ChordSuggestion[]> {
  const topK = Math.max(1, Math.min(12, args.topK));
  const { unigram, bigram, startCounts } = buildTransitionTables(args.genre);
  const ctx = args.context;
  const last = ctx.length >= 1 ? ctx[ctx.length - 1]! : null;
  const prev = ctx.length >= 2 ? ctx[ctx.length - 2]! : null;

  // Prefer 2-gram when the last two chords ever co-occurred in the genre.
  if (prev && last) {
    const bigramCounts = bigram[`${prev}|${last}`];
    if (bigramCounts && Object.keys(bigramCounts).length > 0) {
      return topKFromCounts(bigramCounts, topK, (_chord, count, total) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return `Follows ${prev} → ${last} ${count} time${count === 1 ? '' : 's'} in ${args.genre.label} (${pct}% of 2-gram matches)`;
      });
    }
  }

  // Fall back to 1-gram on the most recent chord.
  if (last) {
    const unigramCounts = unigram[last];
    if (unigramCounts && Object.keys(unigramCounts).length > 0) {
      return topKFromCounts(unigramCounts, topK, (_chord, count, total) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return `Appears ${count} time${count === 1 ? '' : 's'} after ${last} in ${args.genre.label} (${pct}% of transitions from ${last})`;
      });
    }
  }

  // No context, or the last chord never appears anywhere in this genre →
  // surface common starting chords so the UI always has something useful.
  return suggestFromStart(startCounts, args.genre, topK);
}

export const ruleBasedSuggester: ChordSuggester = {
  id: 'rule-based',
  displayName: 'Rule-Based',
  description:
    'Markov chain over curated progressions. Uses 2-gram context when available, ' +
    'falls back to 1-gram and then to genre-typical starting chords.',
  isLocal: true,
  isAvailable: true,
  suggest: ruleBasedSuggest,
};
