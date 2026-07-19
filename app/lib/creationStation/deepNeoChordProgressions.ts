/**
 * Deep Neo — lush rearrangeable chord palettes for SE2 Chord Generator.
 * Same Building Blocks–style color sets as Geno Build 1 Deep Neo.
 */
import type { GenreDef } from '@/app/lib/creationStation/chordBuilder';
import { SE2_SYNTH_GENO_LIVE_DEEP_NEO_DEFS } from '@/app/lib/studio/se2SynthGenoLiveChordPresetsDeepNeo';

export const DEEP_NEO_GENRE: GenreDef = {
  id: 'deep-neo',
  label: 'Deep Neo',
  mode: 'major',
  progressions: SE2_SYNTH_GENO_LIVE_DEEP_NEO_DEFS.map((def) => {
    const shortId = def.id.replace(/^deep-neo-/, '');
    return {
      id: `deepneo-${shortId}`,
      name: def.name,
      mode: def.mode,
      chords: def.loop ?? def.romans,
    };
  }),
};

export const DEEP_NEO_GENRES: GenreDef[] = [DEEP_NEO_GENRE];
