/**
 * Genre- and progression-aware tempo targets for Chord Builder, Groove Lab
 * progression audition, and Chord/Bass Sequencer.
 */

import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';

export type GenreTempoProfile = {
  min: number;
  max: number;
  recommended: number;
  note: string;
};

export const DEFAULT_TEMPO_PROFILE: GenreTempoProfile = {
  min: 80,
  max: 120,
  recommended: 100,
  note: 'General songwriting tempo',
};

/** Typical BPM window per genre pack (matches real-world production ranges). */
export const GENRE_TEMPO_PROFILES: Record<string, GenreTempoProfile> = {
  pop: { min: 96, max: 124, recommended: 110, note: 'Mainstream pop mid-tempo' },
  doowop: { min: 72, max: 108, recommended: 92, note: '50s/60s doo-wop swing' },
  'ballad-80s': { min: 58, max: 88, recommended: 72, note: '70s/80s pop ballad' },
  'rnb-70s80s': { min: 84, max: 112, recommended: 98, note: 'Classic soul / quiet storm' },
  'rnb-90s': { min: 64, max: 98, recommended: 82, note: '90s R&B groove' },
  rnb: { min: 62, max: 94, recommended: 78, note: 'Neo-soul / modern R&B' },
  'rnb-true': { min: 58, max: 90, recommended: 74, note: 'True R&B vocal lane' },
  'deep-rnb': { min: 58, max: 88, recommended: 72, note: 'Deep R&B Cards · quiet-storm pocket' },
  hiphop: { min: 72, max: 98, recommended: 86, note: 'Hip-hop head-nod' },
  trap: { min: 130, max: 160, recommended: 142, note: 'Trap / drill grid' },
  house: { min: 118, max: 128, recommended: 124, note: 'Four-on-the-floor house' },
  disco: { min: 108, max: 126, recommended: 118, note: 'Disco four-on-the-floor' },
  dance: { min: 116, max: 132, recommended: 124, note: 'Dance / K-pop / club' },
  gospel: { min: 72, max: 108, recommended: 92, note: 'Gospel / church soul' },
  jazz: { min: 100, max: 200, recommended: 120, note: 'Jazz swing / standards' },
  rock: { min: 108, max: 148, recommended: 128, note: 'Rock / indie drive' },
  blues: { min: 56, max: 110, recommended: 82, note: 'Blues shuffle / slow blues' },
  lofi: { min: 68, max: 92, recommended: 76, note: 'Lo-fi chill head-nod' },
  funk: { min: 96, max: 118, recommended: 104, note: 'Funk pocket' },
  country: { min: 84, max: 120, recommended: 102, note: 'Country mid-tempo' },
  afrobeat: { min: 95, max: 115, recommended: 105, note: 'Afrobeats / Afropop · 95–115 BPM (sweet spot ~105)' },
  'uk-garage': { min: 128, max: 142, recommended: 132, note: 'UK garage · 2-step shuffle · ~130 BPM' },
  reggae: { min: 76, max: 104, recommended: 100, note: 'Reggae / dancehall snap · 76–104 BPM' },
};

/** Curated BPM for named loops that sit outside the genre average. */
const PROGRESSION_TEMPO_OVERRIDES: Record<string, number> = {
  'rnb-90s::rnb90-ballad': 70,
  'rnb-true::truernb-slowjam': 68,
  'deep-rnb::deeprnb-velvet-crawl': 70,
  'deep-rnb::deeprnb-min-midnight': 66,
  'deep-rnb::deeprnb-candle-glow': 72,
  'ballad-80s::ballad-endless': 64,
  'ballad-80s::ballad-careless': 70,
  'ballad-80s::ballad-saving': 76,
  'doowop::doowop-stand': 76,
  'doowop::doowop-blue': 80,
  'blues::blues-slow': 56,
  'blues::blues-12bar': 88,
  'trap::trap-drill': 150,
  'house::house-classic': 124,
  'dance::dance-kpopaxis': 128,
  'dance::dance-kpoppush': 126,
  'dance::dance-darkbrat': 132,
  'dance::dance-darkdrive': 128,
  'hiphop::hh-mellow': 78,
  'lofi::lofi-chill': 72,
  'lofi::lofi-study': 74,
  'afrobeat::afro-makosa': 102,
  'afrobeat::afro-highlife': 100,
  'afrobeat::afro-donjazzy': 104,
  'afrobeat::afro-naija': 100,
  'afrobeat::afro-sensitive': 98,
  'afrobeat::afro-uplift': 108,
  'afrobeat::afro-gospel': 100,
  'afrobeat::afro-vamp': 100,
  'afrobeat::afro-dorian': 102,
  'afrobeat::afro-neo': 100,
  'afrobeat::afro-two': 98,
  'afrobeat::afro-modal': 102,
  'afrobeat::afro-654': 100,
  'afrobeat::afro-6525': 102,
  'afrobeat::afro-amapiano': 110,
  'uk-garage::ukg-am-f': 132,
  'uk-garage::ukg-soul': 132,
  'uk-garage::ukg-vi-iv': 130,
  'uk-garage::ukg-turn': 133,
  'uk-garage::ukg-dorian': 132,
  'uk-garage::ukg-dark': 135,
  'uk-garage::ukg-speed': 138,
  'uk-garage::ukg-reggae': 102,
  'uk-garage::ukg-one-drop': 88,
  'uk-garage::ukg-warm': 130,
  'uk-garage::ukg-minor9': 130,
  'uk-garage::ukg-bm': 136,
  'reggae::reg-one-drop': 88,
  'reggae::reg-skank': 92,
  'reggae::reg-minor': 94,
  'reggae::reg-island': 96,
  'reggae::reg-dub': 100,
  'reggae::reg-count': 102,
  'reggae::reg-dancehall': 100,
  'reggae::reg-steel': 90,
  'reggae::reg-gospel': 88,
  'reggae::reg-two': 92,
  'reggae::reg-am-loop': 94,
  'reggae::reg-dorian': 96,
  'reggae::reg-bubble': 100,
  'reggae::reg-dm-drop': 90,
  'reggae::reg-offbeat': 98,
};

/** Genre packs where label keywords like "late night" must not force ballad-slow BPM. */
const GENRES_USE_RECOMMENDED_BPM = new Set(['afrobeat', 'uk-garage', 'reggae', 'house', 'dance', 'trap']);

export function getGenreTempoProfile(genreId: string): GenreTempoProfile {
  return GENRE_TEMPO_PROFILES[genreId] ?? DEFAULT_TEMPO_PROFILE;
}

export function getGenreRecommendedBpm(genreId: string): number {
  return clampGrooveLabBpm(getGenreTempoProfile(genreId).recommended);
}

function tempoFromProgressionName(name: string, profile: GenreTempoProfile, genreId?: string): number {
  if (genreId && GENRES_USE_RECOMMENDED_BPM.has(genreId)) {
    return profile.recommended;
  }
  const n = name.toLowerCase();
  if (
    /\bslow\b|\bballad\b|\bcrawl\b|\bquiet[- ]?storm\b|\bcrooner\b|\bsteady\b|\bslow dance\b|\bprayer\b|\btender\b|\bsoft\b|\bchill\b|\brainy\b|\blate night\b|\bfalsetto\b|\bmellow\b|\bwarm\b|\bstudy\b/.test(
      n,
    )
  ) {
    return Math.round(profile.min + (profile.recommended - profile.min) * 0.22);
  }
  if (
    /\bdrill\b|\btrap\b|\bclub\b|\bstomp\b|\bdark\b|\bk-pop\b|\bkpop\b|\banthem\b|\bpunk\b|\bpower\b|\bdrive\b|\bpush\b|\bshine\b|\bsaturday\b|\buplift\b/.test(
      n,
    )
  ) {
    return Math.round(profile.recommended + (profile.max - profile.recommended) * 0.5);
  }
  return profile.recommended;
}

export type ResolvedProgressionTempo = {
  bpm: number;
  note: string;
  profile: GenreTempoProfile;
};

/** Pick BPM for a genre pack + loop name (catalog id `genreId::progressionId`). */
export function resolveProgressionBpm(
  genreId: string,
  opts?: { progressionId?: string; progressionName?: string },
): ResolvedProgressionTempo {
  const profile = getGenreTempoProfile(genreId);
  const catalogKey =
    opts?.progressionId && genreId ? `${genreId}::${opts.progressionId}` : '';
  const override = catalogKey ? PROGRESSION_TEMPO_OVERRIDES[catalogKey] : undefined;
  const raw =
    override ??
    (opts?.progressionName
      ? tempoFromProgressionName(opts.progressionName, profile, genreId)
      : profile.recommended);
  return {
    bpm: clampGrooveLabBpm(raw),
    note: profile.note,
    profile,
  };
}
