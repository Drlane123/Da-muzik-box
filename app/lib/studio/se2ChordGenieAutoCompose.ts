/**
 * Chord Generator compose — match typed instructions to preset + tempo/key/bars.
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { genreHasProgressionsForMode } from '@/app/lib/creationStation/chordBuilder';
import {
  GROOVE_PROGRESSION_GENRE_PACKS,
  type GrooveProgressionPresetEntry,
} from '@/app/lib/creationStation/grooveLabProgressionLibrary';
import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';
import { se2ChordGeniePresetCatalog } from '@/app/lib/studio/se2ChordGenieGenerate';
import { parseKeyFromComposePrompt } from '@/app/lib/studio/se2SynthGenoKeyLock';
import {
  parseGenoChordStyleFromPrompt,
  type GenoChordStyle,
} from '@/app/lib/studio/se2SynthGenoComposePrompt';
import {
  CHORD_GENIE_GENRE_PROFILES,
  CHORD_GENIE_INSTRUCTION_RULES,
  type ChordGenieInstructionRule,
} from '@/app/lib/studio/se2ChordGenieAutoComposePhrases';
import {
  cardTitleFromPreset,
  chordGenieCatalogIndex,
  filterComposeQueryTokens,
  scoreCatalogCards,
  type ChordGenieCatalogIndexEntry,
} from '@/app/lib/studio/se2ChordGenieCatalogSearch';
import type { StudioHarmonyLoopBars } from '@/app/lib/studio/studioInstrumentHarmony';

const SUGGESTION_LIMIT = 5;

const BPM_PATTERNS: readonly RegExp[] = [
  /\b(?:bpm|tempo)\s*(?:at\s*)?(\d{2,3})\b/i,
  /\b(\d{2,3})\s*(?:bpm|tempo)\b/i,
  /\bat\s+(\d{2,3})\s*(?:bpm)?\b/i,
];

const GENRE_STRONG = new Set([
  'pop',
  'rnb',
  'gospel',
  'jazz',
  'trap',
  'house',
  'dance',
  'disco',
  'ballad',
  'kpop',
  'afro',
  'reggae',
  'blues',
  'lofi',
  'funk',
  'country',
  'hiphop',
  'hip hop',
  'garage',
  'soul',
  'neo soul',
  'neosoul',
  'neo-soul',
  'deep rnb',
  'deep chords',
  'deep cards',
  'rich jazz',
  'neo jazz',
  'neojazz',
]);

const STYLE_TO_GENRE: Partial<Record<GenoChordStyle, string>> = {
  pop: 'pop',
  rnb: 'rnb',
  gospel: 'gospel',
  trap: 'trap',
  dance: 'dance',
  disco: 'disco',
  dark: 'dance',
  bright: 'pop',
  kpop: 'kpop-eras',
  jazz: 'rich-jazz',
  minor: 'trap',
};

export type ChordGenieEraHint = {
  decade: '60s' | '70s' | '80s' | '90s' | '00s' | '10s';
  label: string;
};

const ERA_PATTERNS: readonly { decade: ChordGenieEraHint['decade']; label: string; re: RegExp }[] = [
  { decade: '60s', label: '60s', re: /\b(60s|60 s|sixties)\b/ },
  { decade: '70s', label: '70s', re: /\b(70s|70 s|seventies)\b/ },
  { decade: '80s', label: '80s', re: /\b(80s|80 s|eighties)\b/ },
  { decade: '90s', label: '90s', re: /\b(90s|90 s|nineties)\b/ },
  { decade: '00s', label: '2000s', re: /\b(00s|2000s|two thousands|y2k)\b/ },
  { decade: '10s', label: '2010s', re: /\b(10s|2010s|twenty tens)\b/ },
];

export function detectChordGenieEra(q: string): ChordGenieEraHint | null {
  for (const row of ERA_PATTERNS) {
    if (row.re.test(q)) return { decade: row.decade, label: row.label };
  }
  return null;
}

function eraGenreForQuery(q: string, era: ChordGenieEraHint): string | null {
  if (/\b(deep\s*rnb|deep\s*r\s*&\s*b|deep\s*chords?|deep\s*cards|deep\s*soul)\b/.test(q)) return 'deep-rnb';
  if (/\b(rich\s*jazz|neo[- ]?jazz|70s?\s*soul\s*jazz|jazz\s*neo)\b/.test(q)) return 'rich-jazz';
  const rnbish = /\b(rnb|r and b|soul|quiet storm|slow jam|neo soul|neosoul)\b/.test(q);
  const popish = /\bpop\b/.test(q);
  if (rnbish) {
    if (era.decade === '60s') return 'doowop';
    if (era.decade === '70s' || era.decade === '80s') return 'rnb-eras';
    if (era.decade === '90s') return 'rnb-90s';
    return 'rnb-eras';
  }
  if (popish) return 'pop-eras';
  if (era.decade === '70s' || era.decade === '80s') return 'rnb-eras';
  if (era.decade === '90s') return 'rnb-90s';
  if (era.decade === '60s') return 'doowop';
  if (era.decade === '00s' || era.decade === '10s') return 'rnb-eras';
  return null;
}

export type Se2ChordGenieAutoComposeResult = {
  presetId: string;
  presetLabel: string;
  genreId: string;
  genreLabel: string;
  keyRoot?: number;
  keyMode?: ChordMode;
  loopBars?: StudioHarmonyLoopBars;
  bpm?: number;
  understood: string[];
  summary: string;
  genreExplicit: boolean;
  alternates: string[];
  addPassingChord: boolean;
  useWheel: boolean;
  randomPick: boolean;
};

export type Se2ChordGenieAutoComposeOptions = {
  keyRoot: number;
  keyMode: ChordMode;
  fallbackGenreId: string;
  loopBars: StudioHarmonyLoopBars;
  /** Skip this preset — Regen tries another match. */
  excludePresetId?: string | null;
};

export function normalizeChordGenieComposeQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/\bcards\b/g, 'chords')
    .replace(/\bcard\b/g, 'chord')
    .replace(/k\s*-\s*pop/g, 'kpop')
    .replace(/k\s+pop/g, 'kpop')
    .replace(/r\s*&\s*b/g, 'rnb')
    .replace(/r and b/g, 'rnb')
    .replace(/neo\s*soul/g, 'neo soul')
    .replace(/2\s*-\s*5\s*-\s*1/g, '2-5-1')
    .replace(/ii\s*v\s*i/g, 'ii v i')
    .replace(/ii\s*-\s*v\s*-\s*i/g, 'ii v i')
    .replace(/four\s+chord/g, 'four chord')
    .replace(/four\s*[- ]?\s*bar(?:s)?(?:\s*chart)?/g, '4 bars')
    .replace(/eight\s*[- ]?\s*bar(?:s)?(?:\s*chart)?/g, '8 bars')
    .replace(/\bfaux\s+bar(?:s)?\b/g, '4 bars')
    .replace(/\bbar\s+cart\b/g, '4 bars')
    .replace(/give\s+me\s+(?:some\s+)?chords?/g, 'chords')
    .replace(/make\s+it\s+/g, '')
    .replace(/\bsixties\b/g, '60s')
    .replace(/\bseventies\b/g, '70s')
    .replace(/\beighties\b/g, '80s')
    .replace(/\bnineties\b/g, '90s')
    .replace(/\b1960s\b/g, '60s')
    .replace(/\b1970s\b/g, '70s')
    .replace(/\b1980s\b/g, '80s')
    .replace(/\b1990s\b/g, '90s')
    .replace(/\b2000s\b/g, '00s')
    .replace(/\b2010s\b/g, '10s')
    .replace(/\btwo\s+thousands?\b/g, '00s')
    .replace(/\by2k\b/g, '00s')
    .replace(/\b8\s+bar\b(?!s)/g, '8 bars')
    .replace(/\b4\s+bar\b(?!s)/g, '4 bars')
    .replace(/lo\s*-\s*fi/g, 'lofi')
    .replace(/lo\s+fi/g, 'lofi')
    .replace(/hip\s*-\s*hop/g, 'hip hop')
    .replace(/[^a-z0-9&+\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function phraseMatchesComposeQuery(q: string, phrase: string): boolean {
  if (phrase.includes(' ')) return q.includes(phrase);
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(q);
}

function genreLabelFor(id: string): string {
  return GROOVE_PROGRESSION_GENRE_PACKS.find((g) => g.id === id)?.label ?? id;
}

function detectBpm(q: string): number | undefined {
  for (const re of BPM_PATTERNS) {
    const m = q.match(re);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n)) return clampGrooveLabBpm(n);
  }
  return undefined;
}

function detectLoopBars(q: string): StudioHarmonyLoopBars | undefined {
  const m = q.match(/\b(4|8)\s*(?:bar|bars)\b/);
  if (m) return Number(m[1]) === 8 ? 8 : 4;
  const m2 = q.match(/\b(?:loop|length)\s*(?:of\s*)?(4|8)\b/);
  if (m2) return Number(m2[1]) === 8 ? 8 : 4;
  if (/\b(?:four|4)\s*[- ]?\s*bar(?:s)?\b/.test(q) || /\bbar\s*chart\b/.test(q)) return 4;
  if (/\b(?:eight|8)\s*[- ]?\s*bar(?:s)?\b/.test(q)) return 8;
  return undefined;
}

function scoreGenreProfile(q: string, profile: (typeof CHORD_GENIE_GENRE_PROFILES)[number]): number {
  let score = 0;
  for (const t of profile.strong) {
    if (phraseMatchesComposeQuery(q, t)) score += 14;
  }
  for (const t of profile.medium) {
    if (phraseMatchesComposeQuery(q, t)) score += 7;
  }
  for (const t of profile.weak) {
    if (phraseMatchesComposeQuery(q, t)) score += 3;
  }
  return score;
}

function detectGenre(
  q: string,
  fallbackGenreId: string,
): { genreId: string; explicit: boolean } {
  const era = detectChordGenieEra(q);
  if (era) {
    const eraGenre = eraGenreForQuery(q, era);
    if (eraGenre) return { genreId: eraGenre, explicit: true };
  }

  let bestId = fallbackGenreId;
  let bestScore = 0;
  let explicit = false;

  for (const profile of CHORD_GENIE_GENRE_PROFILES) {
    const score = scoreGenreProfile(q, profile);
    if (score <= 0) continue;
    for (const t of profile.strong) {
      if (phraseMatchesComposeQuery(q, t) && GENRE_STRONG.has(t.replace(/\s+/g, ' '))) {
        explicit = true;
        break;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = profile.genreId;
    }
  }

  const style = parseGenoChordStyleFromPrompt(q);
  const styleGenre = STYLE_TO_GENRE[style];
  if (styleGenre && bestScore < 10) {
    bestId = styleGenre;
    if (style !== 'default' && style !== 'major') explicit = true;
  }

  return { genreId: bestId, explicit };
}

function detectMode(q: string, fallback: ChordMode): ChordMode {
  const fromKey = parseKeyFromComposePrompt(q);
  if (fromKey.keyMode) return fromKey.keyMode === 'minor' ? 'minor' : 'major';
  if (/\b(minor|min\b)/.test(q) && !/\bmajor\b/.test(q)) return 'minor';
  if (/\b(major|maj\b)/.test(q)) return 'major';
  if (/\b(dark|moody|sad|melanchol|haunt|drill|trap)\b/.test(q) && !/\bbright\b/.test(q)) {
    return 'minor';
  }
  if (/\b(bright|happy|uplift|sunshine)\b/.test(q)) return 'major';
  return fallback;
}

function detectPassing(q: string): boolean {
  return /\b(passing|pass chord|transition chord|walk(?:ing)? chord|turnaround chord)\b/.test(q);
}

function detectWheel(q: string): boolean {
  return /\b(wheel walk|from wheel|tonic walk|key wheel|wheel style)\b/.test(q);
}

function detectRandom(q: string): boolean {
  return /\b(random|surprise|roll|shuffle|anything)\b/.test(q);
}

function ruleMatchesQuery(rule: ChordGenieInstructionRule, q: string): boolean {
  if (rule.allOf?.length) {
    if (!rule.allOf.every((t) => phraseMatchesComposeQuery(q, t))) return false;
  }
  return rule.anyOf.some((t) => phraseMatchesComposeQuery(q, t));
}

function ruleAppliesToGenre(rule: ChordGenieInstructionRule, genreId: string): boolean {
  if (!rule.genres?.length) return true;
  return rule.genres.includes(genreId);
}

function resolveRulePickId(rule: ChordGenieInstructionRule, genreId: string): string | undefined {
  return rule.pickByGenre?.[genreId] ?? rule.pickId;
}

function applyInstructionBoosts(
  preset: GrooveProgressionPresetEntry,
  genreId: string,
  q: string,
): { score: number; labels: string[] } {
  let boost = 0;
  const labels: string[] = [];
  const hay = `${preset.id} ${preset.label}`.toLowerCase();

  for (const rule of CHORD_GENIE_INSTRUCTION_RULES) {
    if (!ruleAppliesToGenre(rule, genreId)) continue;
    if (!ruleMatchesQuery(rule, q)) continue;

    labels.push(rule.label);
    const pickId = resolveRulePickId(rule, genreId);
    if (pickId && preset.id === pickId) boost += 120;
    if (rule.idBoosts) {
      for (const frag of rule.idBoosts) {
        if (hay.includes(frag.toLowerCase())) boost += 10;
      }
    }
  }

  return { score: boost, labels };
}

type RankedPreset = {
  preset: GrooveProgressionPresetEntry;
  score: number;
  labels: string[];
};

function rankCatalogPresets(
  index: readonly ChordGenieCatalogIndexEntry[],
  genreId: string,
  q: string,
  genreExplicit: boolean,
  era: ChordGenieEraHint | null,
): RankedPreset[] {
  const tokens = filterComposeQueryTokens(q);
  const cardScores = scoreCatalogCards(index, q, tokens, genreId, genreExplicit, era);

  const ranked = cardScores.map(({ entry, score, matchedPhrases }) => {
    const { score: boost, labels: ruleLabels } = applyInstructionBoosts(
      entry.preset,
      genreId,
      q,
    );
    const labels = [
      ...matchedPhrases.map((p) => {
        if (p === entry.shortName || p === entry.loopLabel) return entry.shortName;
        return p;
      }),
      ...ruleLabels,
    ];
    return { preset: entry.preset, score: score + boost, labels };
  });

  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      cardTitleFromPreset(a.preset).localeCompare(cardTitleFromPreset(b.preset)) ||
      a.preset.id.localeCompare(b.preset.id),
  );
  return ranked;
}

function pickFromHardRule(
  genreId: string,
  q: string,
  pool: readonly GrooveProgressionPresetEntry[],
): { preset: GrooveProgressionPresetEntry; labels: string[] } | null {
  for (const rule of CHORD_GENIE_INSTRUCTION_RULES) {
    if (!ruleAppliesToGenre(rule, genreId)) continue;
    if (!ruleMatchesQuery(rule, q)) continue;
    const pickId = resolveRulePickId(rule, genreId);
    if (!pickId) continue;
    const picked = pool.find((p) => p.id === pickId);
    if (picked) return { preset: picked, labels: [rule.label] };
  }
  return null;
}

function buildAlternates(ranked: readonly RankedPreset[], best: GrooveProgressionPresetEntry): string[] {
  const names: string[] = [];
  for (const row of ranked) {
    if (row.preset.id === best.id) continue;
    const short = cardTitleFromPreset(row.preset);
    if (names.includes(short)) continue;
    names.push(short);
    if (names.length >= SUGGESTION_LIMIT) break;
  }
  return names;
}

function buildSummary(
  preset: GrooveProgressionPresetEntry,
  genreId: string,
  understood: string[],
  bpm?: number,
): string {
  const parts: string[] = [];
  if (understood.length) parts.push(...understood);
  else parts.push(genreLabelFor(genreId));
  if (bpm != null && !understood.some((u) => u.toLowerCase().includes('bpm'))) {
    parts.push(`BPM ${bpm}`);
  }
  parts.push(cardTitleFromPreset(preset));
  return parts.join(' · ');
}

function fallbackPresetFromTokens(
  index: readonly ChordGenieCatalogIndexEntry[],
  tokens: string[],
): GrooveProgressionPresetEntry | null {
  if (!tokens.length) return null;
  for (const entry of index) {
    if (tokens.some((tok) => entry.haystack.includes(tok))) return entry.preset;
  }
  return null;
}

function seededIndex(seed: number, max: number): number {
  if (max <= 0) return 0;
  const x = Math.abs(Math.sin(seed * 12.9898) * 43758.5453);
  return Math.floor((x - Math.floor(x)) * max) % max;
}

function finalizeResult(
  primary: GrooveProgressionPresetEntry,
  ranked: RankedPreset[],
  labels: string[],
  genreId: string,
  genreExplicit: boolean,
  q: string,
  opts: {
    keyRoot?: number;
    keyMode?: ChordMode;
    loopBars?: StudioHarmonyLoopBars;
    bpm?: number;
    addPassingChord: boolean;
    useWheel: boolean;
    randomPick: boolean;
    era?: ChordGenieEraHint | null;
  },
): Se2ChordGenieAutoComposeResult {
  const understood = [...new Set(labels)];
  const fromKey = parseKeyFromComposePrompt(q);
  if (fromKey.keyRoot != null && fromKey.keyMode) {
    const keyLabel = `${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][fromKey.keyRoot % 12]} ${fromKey.keyMode}`;
    if (!understood.some((u) => u.toLowerCase().includes('key'))) understood.unshift(`Key ${keyLabel}`);
  }
  if (opts.era && !understood.some((u) => u.includes(opts.era!.label))) {
    understood.unshift(opts.era.label);
  }
  if (opts.loopBars && !understood.some((u) => u.includes('bar'))) {
    understood.unshift(`${opts.loopBars} bars`);
  }
  if (opts.addPassingChord && !understood.includes('Passing chords')) {
    understood.push('Passing chords');
  }
  if (opts.useWheel && !understood.includes('Key wheel walk')) {
    understood.push('Key wheel walk');
  }
  if (genreExplicit && !understood.includes(genreLabelFor(genreId))) {
    understood.unshift(genreLabelFor(genreId));
  }
  if (opts.bpm != null && !understood.some((u) => u.toLowerCase().includes('bpm'))) {
    understood.push(`BPM ${opts.bpm}`);
  }

  return {
    presetId: primary.id,
    presetLabel: primary.label,
    genreId,
    genreLabel: genreLabelFor(genreId),
    keyRoot: opts.keyRoot,
    keyMode: opts.keyMode,
    loopBars: opts.loopBars,
    bpm: opts.bpm,
    understood,
    genreExplicit,
    alternates: buildAlternates(ranked, primary),
    summary: buildSummary(primary, genreId, understood, opts.bpm),
    addPassingChord: opts.addPassingChord,
    useWheel: opts.useWheel,
    randomPick: opts.randomPick,
  };
}

/**
 * Match typed instructions to the best progression preset (+ key / bars / BPM hints).
 */
export function resolveSe2ChordGenieAutoCompose(
  rawQuery: string,
  options: Se2ChordGenieAutoComposeOptions,
): Se2ChordGenieAutoComposeResult | null {
  const q = normalizeChordGenieComposeQuery(rawQuery);
  if (!q) return null;

  const bpm = detectBpm(q);
  const loopBars = detectLoopBars(q);
  const { genreId: detectedGenre, explicit: genreExplicit } = detectGenre(q, options.fallbackGenreId);
  const keyFromPrompt = parseKeyFromComposePrompt(q);
  const keyMode = detectMode(q, options.keyMode);
  const keyRoot = keyFromPrompt.keyRoot ?? options.keyRoot;
  const addPassingChord = detectPassing(q);
  const useWheel = detectWheel(q);
  const randomPick = detectRandom(q);
  const era = detectChordGenieEra(q);

  let effectiveGenre = detectedGenre;
  if (!genreHasProgressionsForMode(effectiveGenre, keyMode)) {
    const fallback = CHORD_GENIE_GENRE_PROFILES.find((p) =>
      genreHasProgressionsForMode(p.genreId, keyMode),
    );
    if (fallback) effectiveGenre = fallback.genreId;
  }

  const catalog = se2ChordGeniePresetCatalog(keyRoot, keyMode);
  if (catalog.length === 0) return null;

  const fullIndex = chordGenieCatalogIndex(keyRoot, keyMode);
  const excludeId = options.excludePresetId ?? null;
  const index =
    excludeId && fullIndex.some((e) => e.preset.id !== excludeId)
      ? fullIndex.filter((e) => e.preset.id !== excludeId)
      : fullIndex;

  const tokens = filterComposeQueryTokens(q);
  const ranked = rankCatalogPresets(index, effectiveGenre, q, genreExplicit, era);
  const pool = index.map((e) => e.preset);
  const sharedOpts = {
    keyRoot: keyFromPrompt.keyRoot,
    keyMode: keyFromPrompt.keyMode ? keyMode : undefined,
    loopBars,
    bpm,
    addPassingChord,
    useWheel,
    randomPick,
    era,
  };

  if (useWheel) {
    const wheelPreset = ranked[0]?.preset ?? pool[0]!;
    return finalizeResult(
      wheelPreset,
      ranked,
      ['Key wheel walk'],
      effectiveGenre,
      genreExplicit,
      q,
      sharedOpts,
    );
  }

  const hardPick = pickFromHardRule(effectiveGenre, q, pool);
  const topRanked = ranked[0];
  const strongCatalogMatch = (topRanked?.score ?? 0) >= 200;
  const hardMatchesTop = topRanked?.preset.id === hardPick?.preset.id;
  if (
    hardPick &&
    (!excludeId || hardPick.preset.id !== excludeId) &&
    (hardMatchesTop || !strongCatalogMatch)
  ) {
    const boostedRank = ranked.map((r) =>
      r.preset.id === hardPick.preset.id
        ? { ...r, score: r.score + 1000, labels: [...new Set([...r.labels, ...hardPick.labels])] }
        : r,
    );
    boostedRank.sort((a, b) => b.score - a.score);
    return finalizeResult(
      hardPick.preset,
      boostedRank,
      hardPick.labels,
      effectiveGenre,
      genreExplicit,
      q,
      sharedOpts,
    );
  }

  let best = ranked[0];
  if (randomPick || !best || best.score <= 0) {
    const byToken = fallbackPresetFromTokens(index, tokens);
    if (byToken && (!excludeId || byToken.id !== excludeId)) {
      best = { preset: byToken, score: 1, labels: ['Chord match'] };
    } else {
      const idx = seededIndex(Date.now(), pool.length);
      const picked = pool[idx]!;
      best = { preset: picked, score: 1, labels: randomPick ? ['Random chord'] : ['Catalog pick'] };
    }
  }

  return finalizeResult(
    best.preset,
    ranked,
    best.labels,
    effectiveGenre,
    genreExplicit,
    q,
    sharedOpts,
  );
}

export function peekSe2ChordGenieComposeGenre(
  rawQuery: string,
  fallbackGenreId: string,
): { genreId: string; explicit: boolean } | null {
  const q = normalizeChordGenieComposeQuery(rawQuery);
  if (!q) return null;
  return detectGenre(q, fallbackGenreId);
}
