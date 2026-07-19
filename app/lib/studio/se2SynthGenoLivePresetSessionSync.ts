/**
 * Drum Generator — manual match-cards generation from applied MIDI on a harmony lane.
 */
import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';
import { getPatternPresetBpm } from '@/app/lib/patternPresets';
import type { Se2DrumGeneratorLoad } from '@/app/lib/studio/se2DrumGeneratorEngine';
import { se2InferDrumGenStyleFromHarmonyTrack } from '@/app/lib/studio/se2DrumGeneratorEngine';
import {
  se2GenerateModernBankLoad,
  se2ModernBankPresetById,
  se2ModernBankPresetsForGenre,
  se2ResolveModernGenreFromHarmony,
  type Se2DrumGenModernGenre,
  type Se2DrumGenModernPreset,
} from '@/app/lib/studio/se2DrumGenModernBank';
import {
  se2DrumGenTrackHarmonyReady,
  se2NormalizeDrumGenStyle,
  type Se2DrumGenHarmonySourceTrack,
  type Se2DrumGenStyle,
  se2NormalizeDrumGenTemperature,
  type Se2DrumGeneratorTrack,
} from '@/app/lib/studio/se2DrumGeneratorTrack';
import { GENRE_VOICING } from '@/app/lib/studio/se2SynthGenoLiveGenreVoicing';
import { se2SynthGenoLivePresetBpm } from '@/app/lib/studio/se2SynthGenoLiveGenreTempo';
import type { Se2SynthGenoLiveGenreId, Se2SynthGenoLivePreset } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';

export type Se2SynthGenoLivePresetSessionSync = {
  bpm: number;
  presetId: string;
  presetName: string;
  liveGenreId: Se2SynthGenoLiveGenreId;
  chordStyle: Se2DrumGenStyle;
  modernGenre: Se2DrumGenModernGenre;
  drumPresetId: string;
  drumPreset: Se2DrumGenModernPreset;
};

export function se2ModernGenreFromLiveGenre(genreId: Se2SynthGenoLiveGenreId): Se2DrumGenModernGenre {
  switch (genreId) {
    case 'kpop':
      return 'kpop';
    case 'trap':
    case 'drill':
    case 'plug-rage':
    case 'latin-trap':
    case 'dark-cinematic':
      return 'drill';
    case 'rnb':
    case 'neo-soul':
    case 'gospel':
    case 'jazz':
    case 'rich-jazz':
    case 'deep-neo':
    case 'boom-bap':
    case 'lofi':
    case 'lofi-cinematic':
    case 'hip-hop':
      return 'lofi';
    case 'house-dance':
    case 'jersey-bounce':
    case 'pop':
    case 'rnb-pop':
    case 'afrobeats':
    case 'guitar-lines':
    default:
      return 'dance';
  }
}

export function se2DrumStyleFromLiveGenre(genreId: Se2SynthGenoLiveGenreId): Se2DrumGenStyle {
  const style = GENRE_VOICING[genreId]?.stylePreset ?? 'pop';
  if (style === 'minor') return 'dark';
  if (style === 'bright' || style === 'major') return 'pop';
  if (style === 'jazz') return 'rnb';
  return style as Se2DrumGenStyle;
}

/** Pick Bank 2 groove closest to card BPM — K-pop uses feel tags when present. */
export function se2ModernDrumPresetForLiveBpm(
  genre: Se2DrumGenModernGenre,
  targetBpm: number,
  preset?: Pick<Se2SynthGenoLivePreset, 'name' | 'tag' | 'genreId'>,
): Se2DrumGenModernPreset {
  const pool = se2ModernBankPresetsForGenre(genre);
  if (pool.length === 0) {
    return se2ModernBankPresetById('se2-kpop-1') ?? se2ModernBankPresetsForGenre('dance')[0]!;
  }

  if (genre === 'kpop' && preset) {
    const label = `${preset.name} ${preset.tag ?? ''}`.toLowerCase();
    if (/\bballad\b|\btear\b|\bslow\b/.test(label)) {
      return se2ModernBankPresetById('se2-kpop-4') ?? pool[0]!;
    }
    if (/\bedm\b|\bfestival\b|\banthem\b|\bteen\b|\bclub\b|\bhouse\b/.test(label)) {
      return se2ModernBankPresetById('se2-kpop-3') ?? se2ModernBankPresetById('se2-kpop-1') ?? pool[0]!;
    }
    if (/\bverse\b|\bpocket\b|\bfunk\b|\bsyncop|\br&b\b|\bdark\b/.test(label)) {
      return se2ModernBankPresetById('se2-kpop-2') ?? pool[0]!;
    }
    if (/\bpre-chorus\b|\bdrop\b|\bsus\b|\baxis\b|\bhook\b/.test(label)) {
      return se2ModernBankPresetById('se2-kpop-1') ?? pool[0]!;
    }
  }

  let best = pool[0]!;
  let bestDist = Infinity;
  for (const p of pool) {
    const pb = p.bpm ?? getPatternPresetBpm(p);
    const dist = Math.abs(pb - targetBpm);
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best;
}

export function se2SynthGenoLivePresetSessionSync(
  preset: Se2SynthGenoLivePreset,
): Se2SynthGenoLivePresetSessionSync {
  const bpm = se2SynthGenoLivePresetBpm(preset);
  const modernGenre = se2ModernGenreFromLiveGenre(preset.genreId);
  const drumPreset = se2ModernDrumPresetForLiveBpm(modernGenre, bpm, preset);
  return {
    bpm,
    presetId: preset.id,
    presetName: preset.name,
    liveGenreId: preset.genreId,
    chordStyle: se2DrumStyleFromLiveGenre(preset.genreId),
    modernGenre,
    drumPresetId: drumPreset.id,
    drumPreset,
  };
}

export function se2DrumGenTrackIndexForHarmonySource(
  tracks: readonly { id: string; kind?: string; drumGenHarmonyTrackId?: string }[],
  harmonyTrackId: string,
): number | null {
  const idx = tracks.findIndex(
    (t) => t.kind === 'drumGenerator' && t.drumGenHarmonyTrackId === harmonyTrackId,
  );
  return idx >= 0 ? idx : null;
}

export type Se2GenerateDrumGenFromMatchCardsOpts = {
  drumTrack: Pick<Se2DrumGeneratorTrack, 'drumGenStyle' | 'drumGenSeed' | 'drumGenTemperature'>;
  harmony: Se2DrumGenHarmonySourceTrack;
  allTracks: readonly Se2DrumGenHarmonySourceTrack[];
  beatsPerBar: number;
  loopBars: number;
  transportBpm: number;
  bumpSeed?: boolean;
};

/** Bank 2 grooves from MIDI already on the matched lane — user triggers from Drum Generator. */
export async function se2GenerateDrumGenFromMatchCards(
  opts: Se2GenerateDrumGenFromMatchCardsOpts,
): Promise<{ load: Se2DrumGeneratorLoad; seed: number; chordStyle: Se2DrumGenStyle } | null> {
  if (!se2DrumGenTrackHarmonyReady(opts.harmony)) return null;

  const inferred = se2InferDrumGenStyleFromHarmonyTrack(opts.harmony, opts.allTracks);
  const chordStyle = se2NormalizeDrumGenStyle(opts.drumTrack.drumGenStyle ?? inferred ?? 'pop');
  const modernGenre = se2ResolveModernGenreFromHarmony(opts.harmony, opts.allTracks, chordStyle);
  const baseSeed = opts.drumTrack.drumGenSeed ?? Date.now() % 1_000_000;
  const seed = opts.bumpSeed ? baseSeed + 1 + Math.floor(Math.random() * 997) : baseSeed;
  const bpm = clampGrooveLabBpm(Math.round(opts.transportBpm));

  const load = await se2GenerateModernBankLoad({
    chordStyle,
    harmony: opts.harmony,
    allTracks: opts.allTracks,
    forceGenre: modernGenre,
    seed,
    temperature: se2NormalizeDrumGenTemperature(opts.drumTrack.drumGenTemperature),
    beatsPerBar: opts.beatsPerBar,
    loopBars: opts.loopBars,
    transportBpm: bpm,
  });

  return { load, seed, chordStyle };
}
