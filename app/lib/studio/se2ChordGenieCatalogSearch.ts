/**
 * Full preset-card search index — every catalog card is searchable by typed phrase.
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  buildGrooveProgressionPresetCatalog,
  loopLabelFromProgressionCatalogEntry,
  type GrooveProgressionPresetEntry,
} from '@/app/lib/creationStation/grooveLabProgressionLibrary';
import { se2ChordGeniePresetCatalog } from '@/app/lib/studio/se2ChordGenieGenerate';

function phraseMatchesQuery(q: string, phrase: string): boolean {
  if (phrase.includes(' ')) return q.includes(phrase);
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(q);
}

export type ChordGenieCatalogIndexEntry = {
  preset: GrooveProgressionPresetEntry;
  /** Display card title — name before roman numerals. */
  shortName: string;
  /** Full loop label (genre stripped). */
  loopLabel: string;
  /** Lowercase search blob: label, id, slug parts, genre. */
  haystack: string;
  /** Distinct phrases users might type (card title, slug, genre words). */
  phrases: readonly string[];
};

const INDEX_CACHE = new Map<string, ChordGenieCatalogIndexEntry[]>();

const QUERY_STOP_WORDS = new Set([
  'in',
  'at',
  'the',
  'and',
  'with',
  'for',
  'key',
  'of',
  'bar',
  'bars',
  'bpm',
  'tempo',
  'chord',
  'chords',
  'card',
  'cards',
  'progression',
  'progressions',
  'loop',
  'length',
  'generate',
  'make',
  'give',
  'me',
  'want',
  'need',
  'please',
  'major',
  'minor',
  'min',
  'maj',
  'passing',
  'pass',
  'transition',
  'wheel',
  'walk',
  'random',
  'surprise',
  'roll',
  'shuffle',
  'anything',
  'from',
  'style',
  'genre',
  'type',
]);

function cardShortName(loopLabel: string): string {
  const head = loopLabel.split('(')[0]?.trim() ?? loopLabel;
  const segments = head
    .split('·')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const named = segments.filter((s) => /[a-zA-Z]{2,}/.test(s) && !/^\d+$/.test(s));
  if (named.length > 0) return named[named.length - 1]!;
  return segments[segments.length - 1] ?? head;
}

function slugParts(progressionId: string): string[] {
  return progressionId
    .split('-')
    .map((p) => p.trim())
    .filter((p) => p.length > 2);
}

function buildPhrases(preset: GrooveProgressionPresetEntry, loopLabel: string, shortName: string): string[] {
  const out = new Set<string>();
  const add = (s: string) => {
    const t = s.toLowerCase().trim();
    if (t.length > 1) out.add(t);
  };

  add(shortName);
  add(loopLabel);
  add(loopLabel.split('(')[0]!.trim());
  add(preset.label);
  add(preset.genreLabel);
  add(preset.progressionId);
  add(preset.id);

  for (const part of slugParts(preset.progressionId)) add(part);
  for (const part of slugParts(preset.genreId)) add(part);

  for (const seg of loopLabel.split('·')) {
    const t = seg.trim();
    if (t.length > 2) add(t.split('(')[0]!.trim());
  }

  for (const word of shortName.toLowerCase().split(/\s+/)) {
    if (word.length > 2) add(word);
  }

  return [...out];
}

function buildIndexEntry(preset: GrooveProgressionPresetEntry): ChordGenieCatalogIndexEntry {
  const loopLabel = loopLabelFromProgressionCatalogEntry(preset.label);
  const shortName = cardShortName(loopLabel);
  const phrases = buildPhrases(preset, loopLabel, shortName);
  const haystack = phrases.join(' ').toLowerCase();

  return { preset, shortName, loopLabel, haystack, phrases };
}

export function chordGenieCatalogIndex(
  keyRoot: number,
  mode: ChordMode,
): readonly ChordGenieCatalogIndexEntry[] {
  const cacheKey = `${keyRoot}:${mode}`;
  const hit = INDEX_CACHE.get(cacheKey);
  if (hit) return hit;

  const catalog = se2ChordGeniePresetCatalog(keyRoot, mode);
  const built = catalog.map(buildIndexEntry);
  INDEX_CACHE.set(cacheKey, built);
  return built;
}

/** All cards (mode-agnostic count) — for diagnostics / help. */
export function chordGenieFullCatalogCardCount(keyRoot = 0): number {
  return buildGrooveProgressionPresetCatalog(keyRoot).length;
}

export function filterComposeQueryTokens(q: string): string[] {
  return q
    .split(/\s+/)
    .filter(
      (t) =>
        t.length > 1 &&
        !QUERY_STOP_WORDS.has(t) &&
        !/^\d{2,3}$/.test(t) &&
        t !== 'bars',
    );
}

export type CatalogEraHint = {
  decade: string;
  label: string;
};

function scoreEraMatch(
  entry: ChordGenieCatalogIndexEntry,
  era: CatalogEraHint,
): { score: number; label: string | null } {
  const prog = entry.preset.progressionId.toLowerCase();
  const label = entry.preset.label.toLowerCase();
  const id = entry.preset.id.toLowerCase();
  const num = era.decade.replace(/\D/g, ''); // "70" from "70s"

  if (era.decade === '60s') {
    if (
      entry.preset.genreId === 'doowop' ||
      label.includes('50s') ||
      label.includes('60s') ||
      label.includes('doo-wop') ||
      label.includes('doo wop')
    ) {
      return { score: 95, label: era.label };
    }
    return { score: 0, label: null };
  }

  const needles = [`${num}s`, `pop${num}`, `rnb${num}`, `disco${num}`, `ballad${num}`];
  for (const needle of needles) {
    if (prog.includes(needle) || id.includes(needle) || label.includes(needle)) {
      return { score: 100, label: era.label };
    }
  }
  if (label.includes(`${num} ·`) || label.includes(`· ${num}s`)) {
    return { score: 88, label: era.label };
  }
  return { score: 0, label: null };
}

export type CatalogCardScore = {
  entry: ChordGenieCatalogIndexEntry;
  score: number;
  matchedPhrases: string[];
};

/**
 * Score every catalog card against the normalized query.
 * Card-title matches beat genre-only guesses.
 */
export function scoreCatalogCards(
  index: readonly ChordGenieCatalogIndexEntry[],
  q: string,
  tokens: string[],
  genreId: string,
  genreExplicit: boolean,
  era?: CatalogEraHint | null,
): CatalogCardScore[] {
  const scored = index.map((entry) => {
    let score = 0;
    const matchedPhrases: string[] = [];
    const shortLower = entry.shortName.toLowerCase();
    const loopHead = entry.loopLabel.split('(')[0]!.trim().toLowerCase();

    if (era) {
      const eraHit = scoreEraMatch(entry, era);
      if (eraHit.score > 0) {
        score += eraHit.score;
        if (eraHit.label) matchedPhrases.push(eraHit.label);
      } else {
        score -= 80;
      }
    }

    if (shortLower.length > 2 && q.includes(shortLower)) {
      score += 160;
      matchedPhrases.push(entry.shortName);
    } else if (loopHead.length > 4 && q.includes(loopHead)) {
      score += 130;
      matchedPhrases.push(loopHead);
    }

    for (const phrase of entry.phrases) {
      if (phrase.length < 3) continue;
      if (!phrase.includes(' ') && phrase.length < 4) continue;
      if (q.includes(phrase)) {
        score += phrase.length > 8 ? 90 : 50;
        matchedPhrases.push(phrase);
      }
    }

    const nameWords = shortLower.split(/\s+/).filter((w) => w.length > 2);
    if (nameWords.length > 0) {
      const allHit = nameWords.every((w) => phraseMatchesQuery(q, w));
      if (allHit) {
        score += 70 + nameWords.length * 8;
        matchedPhrases.push(entry.shortName);
      }
    }

    for (const phrase of entry.phrases) {
      if (phraseMatchesQuery(q, phrase)) {
        score += 35;
        matchedPhrases.push(phrase);
      }
    }

    let tokenHits = 0;
    let shortNameHits = 0;
    for (const tok of tokens) {
      if (entry.haystack.includes(tok)) {
        score += 6;
        tokenHits += 1;
      }
      if (shortLower.includes(tok)) {
        score += 18;
        shortNameHits += 1;
      }
      if (entry.preset.progressionId.includes(tok)) {
        score += 14;
      }
      if (
        entry.preset.genreId.includes(tok) ||
        entry.preset.id.includes(tok) ||
        entry.preset.genreLabel.toLowerCase().includes(tok)
      ) {
        score += 28;
      }
    }
    if (shortNameHits > 0 && shortNameHits === tokens.length) {
      score += 40 + shortNameHits * 12;
      matchedPhrases.push(entry.shortName);
    }
    if (tokenHits >= 2 && tokens.length >= 2) score += tokenHits * 4;

    if (entry.preset.genreId === genreId) {
      score += genreExplicit ? 22 : 10;
    } else if (genreExplicit) {
      score -= 6;
    }

    const genreLabel = entry.preset.genreLabel.toLowerCase();
    if (genreLabel && q.includes(genreLabel)) {
      score += 25;
      matchedPhrases.push(entry.preset.genreLabel);
    }

    if (tokens.length >= 2) {
      const matchedTokens = tokens.filter((tok) => entry.haystack.includes(tok));
      const coverage = matchedTokens.length / tokens.length;
      score += Math.round(coverage * 95);
      if (coverage < 1) {
        score -= Math.round((1 - coverage) * 55);
      }
      if (coverage === 1) matchedPhrases.push(entry.shortName);
    }

    return { entry, score, matchedPhrases: [...new Set(matchedPhrases)] };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.entry.shortName.localeCompare(b.entry.shortName) ||
      a.entry.preset.id.localeCompare(b.entry.preset.id),
  );

  return scored;
}

export function cardTitleFromPreset(preset: GrooveProgressionPresetEntry): string {
  const loopLabel = loopLabelFromProgressionCatalogEntry(preset.label);
  return cardShortName(loopLabel);
}
