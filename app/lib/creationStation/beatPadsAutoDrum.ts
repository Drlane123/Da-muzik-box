/**
 * Auto Drum — type groove instructions for one lane; match template + optional BPM.
 * Genre-aware: trap patterns stay trap, dance stays dance, etc.
 */
import { clampBeatPadsBpm } from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import {
  GENRE_PROFILES,
  INSTRUCTION_RULES,
  KICK_808_TOKENS,
  ROLE_ALIASES,
  type AutoDrumInstructionRule,
} from '@/app/lib/creationStation/beatPadsAutoDrumPhrases';
import {
  beatPadsPlacementGenreLabel,
  getBeatPadsLaneTemplateById,
  getBeatPadsLaneTemplates,
  type BeatPadsDrumRole,
  type BeatPadsLanePlacementTemplate,
  type BeatPadsPlacementGenre,
} from '@/app/lib/creationStation/beatPadsLanePlacementTemplates';

const SUGGESTION_LIMIT = 5;

export type BeatPadsAutoDrumResult = {
  template: BeatPadsLanePlacementTemplate;
  summary: string;
  bpm?: number;
  understood: string[];
  detectedGenre: BeatPadsPlacementGenre;
  genreExplicit: boolean;
  /** Other same-genre placements to try in the list below. */
  alternates: string[];
};

const BPM_PATTERNS: readonly RegExp[] = [
  /\b(?:bpm|tempo)\s*(?:at\s*)?(\d{2,3})\b/i,
  /\b(\d{2,3})\s*(?:bpm|tempo)\b/i,
  /\bat\s+(\d{2,3})\s*(?:bpm)?\b/i,
  /\b(?:speed|pace)\s*(?:at\s*)?(\d{2,3})\b/i,
];

const GENRE_STRONG_WORDS = new Set([
  'trap',
  'dance',
  'house',
  'pop',
  'rnb',
  'drill',
  'edm',
  'kpop',
  'k-pop',
  'afro',
  'reggae',
  'blues',
  'soul',
  'ska',
  'dub',
  'phonk',
  'techno',
  'lofi',
  'lo-fi',
  'hiphop',
  'hip hop',
  'boom bap',
  'boombap',
]);

export function normalizeAutoDrumQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/eight\s*o(?:h)?\s*eight/g, '808')
    .replace(/eight\s*zero\s*eight/g, '808')
    .replace(/k\s*-\s*pop/g, 'kpop')
    .replace(/k\s+pop/g, 'kpop')
    .replace(/lo\s*-\s*fi/g, 'lofi')
    .replace(/lo\s+fi/g, 'lofi')
    .replace(/chill\s*hop/g, 'chillhop')
    .replace(/hip\s*-\s*hop/g, 'hiphop')
    .replace(/hip\s+hop/g, 'hiphop')
    .replace(/boom\s*bap/g, 'boombap')
    .replace(/southern\s+soul/g, 'southern soul')
    .replace(/soul\s+blues/g, 'soul blues')
    .replace(/2\s+and\s+4/g, '2 & 4')
    .replace(/roll at the end/g, 'roll at end')
    .replace(/fill at the end/g, 'fill at end')
    .replace(/and then roll/g, 'then roll')
    .replace(/then a roll/g, 'then roll')
    .replace(/with a roll/g, 'with roll')
    .replace(/make it roll/g, 'make it roll')
    .replace(/add a roll/g, 'add roll')
    .replace(/regular snare/g, 'regular snare')
    .replace(/normal snare/g, 'normal snare')
    .replace(/r\s*&\s*b/g, 'rnb')
    .replace(/hi\s*-\s*hat/g, 'hihat')
    .replace(/hi\s+hat/g, 'hihat')
    .replace(/open\s+hat/g, 'openhat')
    .replace(/four\s+on\s+the\s+floor/g, 'four on the floor')
    .replace(/half\s+time/g, 'half time')
    .replace(/half-time/g, 'half time')
    .replace(/2\s*&\s*4/g, '2 & 4')
    .replace(/2\s+and\s+4/g, '2 & 4')
    .replace(/[^a-z0-9&+\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function queryTokens(q: string): string[] {
  return q.split(/\s+/).filter((t) => t.length > 1);
}

export function phraseMatchesQuery(q: string, phrase: string): boolean {
  if (phrase.includes(' ')) return q.includes(phrase);
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(q);
}

function scoreGenreProfile(q: string, profile: (typeof GENRE_PROFILES)[number]): number {
  let score = 0;
  for (const t of profile.strong) {
    if (phraseMatchesQuery(q, t)) score += 14;
  }
  for (const t of profile.medium) {
    if (phraseMatchesQuery(q, t)) score += 7;
  }
  for (const t of profile.weak) {
    if (phraseMatchesQuery(q, t)) score += 3;
  }
  return score;
}

export type BeatPadsAutoDrumGenrePeek = {
  genre: BeatPadsPlacementGenre;
  explicit: boolean;
  score: number;
};

/** Live hint while typing — switches Pick Placement genre when style is clear. */
export function peekBeatPadsAutoDrumGenre(
  rawQuery: string,
  fallbackGenre: BeatPadsPlacementGenre,
): BeatPadsAutoDrumGenrePeek | null {
  const q = normalizeAutoDrumQuery(rawQuery);
  if (!q) return null;

  const ranked = GENRE_PROFILES.map((p) => ({
    genre: p.genre,
    score: scoreGenreProfile(q, p),
  })).sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const second = ranked[1];
  if (!top || top.score < 7) return null;
  if (second && top.score - second.score < 4 && top.score < 14) return null;

  const explicit =
    top.score >= 14 ||
    [...GENRE_STRONG_WORDS].some((w) => phraseMatchesQuery(q, w));

  return { genre: top.genre, explicit, score: top.score };
}

function detectGenre(
  q: string,
  fallbackGenre: BeatPadsPlacementGenre,
): { genre: BeatPadsPlacementGenre; explicit: boolean } {
  const peek = peekBeatPadsAutoDrumGenre(q, fallbackGenre);
  if (peek) return { genre: peek.genre, explicit: peek.explicit };
  return { genre: fallbackGenre, explicit: false };
}

function detectBpm(q: string): number | undefined {
  for (const re of BPM_PATTERNS) {
    const m = q.match(re);
    if (m?.[1]) {
      const n = Number.parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 40 && n <= 300) {
        return clampBeatPadsBpm(n);
      }
    }
  }
  return undefined;
}

const ROLE_DETECT_PRIORITY: Record<BeatPadsDrumRole, number> = {
  kick: 5,
  snare: 5,
  clap: 4,
  hihat: 4,
  openHat: 4,
  rim: 1,
};

function detectRole(q: string, fallbackRole: BeatPadsDrumRole): BeatPadsDrumRole {
  const hits: { role: BeatPadsDrumRole; len: number; priority: number }[] = [];
  for (const { role, tokens } of ROLE_ALIASES) {
    for (const t of tokens) {
      if (phraseMatchesQuery(q, t) || q.includes(t)) {
        hits.push({ role, len: t.length, priority: ROLE_DETECT_PRIORITY[role] });
      }
    }
  }
  for (const t of KICK_808_TOKENS) {
    if (q.includes(t)) hits.push({ role: 'kick', len: t.length, priority: 5 });
  }
  if (hits.length === 0) return fallbackRole;
  hits.sort((a, b) => b.priority - a.priority || b.len - a.len);
  return hits[0]!.role;
}

function ruleAppliesToGenre(rule: AutoDrumInstructionRule, genre: BeatPadsPlacementGenre): boolean {
  return !rule.genres || rule.genres.includes(genre);
}

function resolveRulePickId(
  rule: AutoDrumInstructionRule,
  genre: BeatPadsPlacementGenre,
): string | undefined {
  return rule.pickByGenre?.[genre] ?? rule.pickId;
}

function ruleMatchesQuery(rule: AutoDrumInstructionRule, q: string): boolean {
  const anyHit = rule.anyOf.some((phrase) =>
    phrase.includes(' ') ? q.includes(phrase) : phraseMatchesQuery(q, phrase) || q.includes(phrase),
  );
  if (!anyHit) return false;
  if (rule.allOf && !rule.allOf.every((phrase) => q.includes(phrase))) return false;
  return true;
}

function scoreTemplate(
  t: BeatPadsLanePlacementTemplate,
  tokens: string[],
  lockedGenre: BeatPadsPlacementGenre,
  genreExplicit: boolean,
): number {
  const hay = `${t.id} ${t.name} ${t.desc}`.toLowerCase();
  let score = 0;
  for (const tok of tokens) {
    if (hay.includes(tok)) score += tok.length >= 4 ? 3 : 2;
    if (t.id.includes(tok)) score += 4;
    if (t.name.toLowerCase().includes(tok)) score += 3;
    if (t.desc.toLowerCase().includes(tok)) score += 1;
  }
  if (t.genre === lockedGenre) score += 20;
  else if (genreExplicit) score -= 40;
  return score;
}

function applyInstructionBoosts(
  t: BeatPadsLanePlacementTemplate,
  role: BeatPadsDrumRole,
  genre: BeatPadsPlacementGenre,
  q: string,
): { score: number; labels: string[] } {
  let boost = 0;
  const labels: string[] = [];
  const hay = `${t.id} ${t.name}`.toLowerCase();

  for (const rule of INSTRUCTION_RULES) {
    if (!rule.roles.includes(role)) continue;
    if (!ruleAppliesToGenre(rule, genre)) continue;
    if (!ruleMatchesQuery(rule, q)) continue;

    labels.push(rule.label);
    if (rule.idBoosts) {
      for (const frag of rule.idBoosts) {
        if (hay.includes(frag.toLowerCase())) boost += 10;
      }
    }
  }

  return { score: boost, labels };
}

function pickFromHardRule(
  role: BeatPadsDrumRole,
  genre: BeatPadsPlacementGenre,
  q: string,
  candidates: readonly BeatPadsLanePlacementTemplate[],
): { template: BeatPadsLanePlacementTemplate; labels: string[] } | null {
  const labels: string[] = [];

  for (const rule of INSTRUCTION_RULES) {
    if (!rule.roles.includes(role)) continue;
    if (!ruleAppliesToGenre(rule, genre)) continue;

    const pickId = resolveRulePickId(rule, genre);
    if (!pickId) continue;
    if (!ruleMatchesQuery(rule, q)) continue;

    const picked =
      getBeatPadsLaneTemplateById(pickId) ?? candidates.find((t) => t.id === pickId);
    if (picked && picked.role === role && picked.genre === genre) {
      labels.push(rule.label);
      return { template: picked, labels };
    }
  }

  return null;
}

type RankedTemplate = {
  template: BeatPadsLanePlacementTemplate;
  score: number;
  labels: string[];
};

function rankTemplates(
  pool: readonly BeatPadsLanePlacementTemplate[],
  role: BeatPadsDrumRole,
  genre: BeatPadsPlacementGenre,
  q: string,
  tokens: string[],
  genreExplicit: boolean,
): RankedTemplate[] {
  const ranked = pool.map((t) => {
    let score = scoreTemplate(t, tokens, genre, genreExplicit);
    const { score: boost, labels } = applyInstructionBoosts(t, role, genre, q);
    score += boost;
    return { template: t, score, labels };
  });
  ranked.sort((a, b) => b.score - a.score || a.template.name.localeCompare(b.template.name));
  return ranked;
}

function buildAlternates(
  ranked: readonly RankedTemplate[],
  best: BeatPadsLanePlacementTemplate,
  limit = SUGGESTION_LIMIT,
): string[] {
  const names: string[] = [];
  for (const row of ranked) {
    if (row.template.id === best.id) continue;
    if (names.includes(row.template.name)) continue;
    names.push(row.template.name);
    if (names.length >= limit) break;
  }
  return names;
}

function buildSummary(
  template: BeatPadsLanePlacementTemplate,
  detectedGenre: BeatPadsPlacementGenre,
  understood: string[],
  bpm?: number,
): string {
  const genreName = beatPadsPlacementGenreLabel(detectedGenre);
  const parts = [`${genreName}`];
  if (understood.length) parts.push(...understood);
  if (bpm != null) parts.push(`BPM ${bpm}`);
  parts.push(template.name);
  return `${parts.slice(0, -1).join(' · ')} → ${parts[parts.length - 1]}`;
}

function finalizeResult(
  primary: BeatPadsLanePlacementTemplate,
  ranked: RankedTemplate[],
  labels: string[],
  detectedGenre: BeatPadsPlacementGenre,
  genreExplicit: boolean,
  role: BeatPadsDrumRole,
  q: string,
  bpm?: number,
): BeatPadsAutoDrumResult {
  const understood = [...new Set(labels)];
  if (KICK_808_TOKENS.some((t) => q.includes(t)) && role === 'kick' && !understood.includes('808 kick')) {
    understood.unshift('808 kick');
  }
  if (genreExplicit && !understood.includes(beatPadsPlacementGenreLabel(detectedGenre))) {
    understood.unshift(beatPadsPlacementGenreLabel(detectedGenre));
  }
  return {
    template: primary,
    bpm,
    understood,
    detectedGenre,
    genreExplicit,
    alternates: buildAlternates(ranked, primary),
    summary: buildSummary(primary, detectedGenre, understood, bpm),
  };
}

export type BeatPadsAutoDrumOptions = {
  /** Skip this template — used by Auto Drum Regen to try another match. */
  excludeTemplateId?: string | null;
};

/**
 * Match typed instructions to the best lane-placement template (+ optional BPM).
 * Locks to detected genre so trap ≠ dance ≠ house patterns.
 */
export function resolveBeatPadsAutoDrum(
  rawQuery: string,
  fallbackRole: BeatPadsDrumRole,
  fallbackGenre: BeatPadsPlacementGenre,
  options?: BeatPadsAutoDrumOptions,
): BeatPadsAutoDrumResult | null {
  const q = normalizeAutoDrumQuery(rawQuery);
  if (!q) return null;

  const bpm = detectBpm(q);
  const { genre: detectedGenre, explicit: genreExplicit } = detectGenre(q, fallbackGenre);
  const role = detectRole(q, fallbackRole);
  const tokens = queryTokens(q).filter((t) => !/^\d{2,3}$/.test(t) && t !== 'bpm' && t !== 'tempo');

  const candidates = getBeatPadsLaneTemplates(role, detectedGenre);
  if (candidates.length === 0) return null;

  const excludeId = options?.excludeTemplateId ?? null;
  const pool =
    excludeId && candidates.some((t) => t.id !== excludeId)
      ? candidates.filter((t) => t.id !== excludeId)
      : candidates;

  const ranked = rankTemplates(pool, role, detectedGenre, q, tokens, genreExplicit);

  const hardPick = pickFromHardRule(role, detectedGenre, q, pool);
  if (hardPick && (!excludeId || hardPick.template.id !== excludeId)) {
    const boostedRank = ranked.map((r) =>
      r.template.id === hardPick.template.id
        ? { ...r, score: r.score + 1000, labels: [...new Set([...r.labels, ...hardPick.labels])] }
        : r,
    );
    boostedRank.sort((a, b) => b.score - a.score);
    return finalizeResult(
      hardPick.template,
      boostedRank,
      hardPick.labels,
      detectedGenre,
      genreExplicit,
      role,
      q,
      bpm,
    );
  }

  let best = ranked[0];
  if (!best || best.score <= 0) {
    const byId = pool.find((t) =>
      tokens.some((tok) => t.id.includes(tok) || t.name.toLowerCase().includes(tok)),
    );
    const fallback = byId ?? pool[Math.floor(Math.random() * pool.length)];
    if (!fallback) return null;
    best = { template: fallback, score: 1, labels: [] };
  }

  return finalizeResult(
    best.template,
    ranked,
    best.labels,
    detectedGenre,
    genreExplicit,
    role,
    q,
    bpm,
  );
}
