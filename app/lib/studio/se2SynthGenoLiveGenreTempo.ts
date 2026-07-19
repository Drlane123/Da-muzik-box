/**
 * Live Chord — genre-authentic preview / transport BPM per preset library.
 */
import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import type { Se2SynthGenoLivePreset } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';

type LiveGenreTempoRange = { min: number; max: number; defaultBpm: number };

/** Production-realistic BPM windows per Live Chord genre tab. */
export const SE2_SYNTH_GENO_LIVE_GENRE_TEMPO: Record<Se2SynthGenoLiveGenreId, LiveGenreTempoRange> = {
  trap: { min: 130, max: 160, defaultBpm: 142 },
  'hip-hop': { min: 72, max: 98, defaultBpm: 86 },
  rnb: { min: 58, max: 94, defaultBpm: 78 },
  'rnb-pop': { min: 68, max: 108, defaultBpm: 88 },
  drill: { min: 118, max: 138, defaultBpm: 128 },
  lofi: { min: 68, max: 92, defaultBpm: 76 },
  'neo-soul': { min: 72, max: 100, defaultBpm: 88 },
  pop: { min: 96, max: 124, defaultBpm: 110 },
  gospel: { min: 72, max: 108, defaultBpm: 92 },
  afrobeats: { min: 95, max: 115, defaultBpm: 105 },
  'latin-trap': { min: 88, max: 104, defaultBpm: 96 },
  'house-dance': { min: 118, max: 128, defaultBpm: 124 },
  'jersey-bounce': { min: 128, max: 145, defaultBpm: 138 },
  'boom-bap': { min: 78, max: 96, defaultBpm: 88 },
  'plug-rage': { min: 140, max: 165, defaultBpm: 150 },
  'lofi-cinematic': { min: 60, max: 82, defaultBpm: 68 },
  'dark-cinematic': { min: 56, max: 84, defaultBpm: 72 },
  jazz: { min: 90, max: 180, defaultBpm: 120 },
  'rich-jazz': { min: 68, max: 118, defaultBpm: 92 },
  'deep-neo': { min: 66, max: 96, defaultBpm: 78 },
  'guitar-lines': { min: 68, max: 128, defaultBpm: 96 },
  kpop: { min: 76, max: 132, defaultBpm: 118 },
};

export function se2SynthGenoLiveGenreBpm(genreId: Se2SynthGenoLiveGenreId): number {
  return clampGrooveLabBpm(SE2_SYNTH_GENO_LIVE_GENRE_TEMPO[genreId]?.defaultBpm ?? 100);
}

function tempoFromPresetLabel(label: string, range: LiveGenreTempoRange): number {
  const n = label.toLowerCase();
  if (
    /\bslow\b|\bballad\b|\brain\b|\bsoft\b|\bchill\b|\bquiet\b|\bpad\b|\bdust\b|\bcinematic\b|\bambient\b|\bprayer\b|\bintimate\b|\bdusty\b|\bvinyl\b|\bfog\b|\bmist\b|\bdeep\b|\bmarinate\b|\bvoodoo\b|\bneo\b|\bdorian\b|\bfloat\b|\bwick\b/.test(
      n,
    )
  ) {
    return Math.round(range.defaultBpm - (range.defaultBpm - range.min) * 0.38);
  }
  if (
    /\bclub\b|\banthem\b|\brage\b|\btrap\b|\bbounce\b|\bdrive\b|\buptempo\b|\bfestival\b|\bpeak\b|\bheat\b|\bknock\b|\b808\b|\bdembow\b|\bperreo\b|\bstadium\b|\btiktok\b|\bchart\b|\baxis\b|\bkiss\b|\bsummer\b|\bradio\b/.test(
      n,
    )
  ) {
    return Math.round(range.defaultBpm + (range.max - range.defaultBpm) * 0.42);
  }
  return range.defaultBpm;
}

/** BPM for a selected Live Chord card — explicit preset BPM, else name/tag heuristics. */
export function se2SynthGenoLivePresetBpm(
  preset: Pick<Se2SynthGenoLivePreset, 'name' | 'genreId' | 'bpm' | 'tag'>,
): number {
  if (preset.bpm != null && Number.isFinite(preset.bpm)) {
    return clampGrooveLabBpm(Math.round(preset.bpm));
  }
  const range = SE2_SYNTH_GENO_LIVE_GENRE_TEMPO[preset.genreId];
  if (!range) return clampGrooveLabBpm(100);
  const label = `${preset.name} ${preset.tag ?? ''}`;
  return clampGrooveLabBpm(tempoFromPresetLabel(label, range));
}
