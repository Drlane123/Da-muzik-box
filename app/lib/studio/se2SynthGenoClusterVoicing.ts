/**
 * Cluster voicings for transitional / passing chords — neo-soul, jazz, R&B stacks.
 * Adds close semitone color on top of Roman spellings (Chordio-style clusters).
 */
import type { GenoBarChordSpec, GenoExtension } from '@/app/lib/studio/se2SynthGenoChordEngine';

export type GenoClusterStyle = 'neo-soul' | 'jazz' | 'rnb' | 'cinematic';

/** Semitone additions relative to chord root interval (key-root spelling). */
const CLUSTER_LAYERS: Record<GenoClusterStyle, readonly number[]> = {
  /** Maj7 · 9 · #11 tight stack — Chris Brown / neo-soul pads. */
  'neo-soul': [10, 14, 15, 18, 21],
  /** b9 · 9 · #11 — jazz approach tones. */
  jazz: [10, 13, 14, 15, 18, 20],
  /** m7 · 9 · 11 — contemporary R&B. */
  rnb: [10, 14, 17, 19],
  /** Dark maj7 · add9 · sus cluster — film / trap soul. */
  cinematic: [10, 14, 15, 17, 22],
};

function mergeExtensions(
  base: readonly GenoExtension[] | undefined,
  extra: readonly GenoExtension[],
): GenoExtension[] {
  return [...new Set([...(base ?? []), ...extra])];
}

/** Enrich a bar spec with cluster intervals + lush voicing depth. */
export function se2SynthGenoApplyClusterVoicing(
  spec: GenoBarChordSpec,
  style: GenoClusterStyle = 'neo-soul',
): GenoBarChordSpec {
  const base = spec.chordIntervals;
  if (!base || base.length === 0) {
    return {
      ...spec,
      voicingDepth: 7,
      inversion: Math.max(spec.inversion ?? 0, 2),
      stackOctave: true,
      extensions: mergeExtensions(spec.extensions, ['9', '11', '13']),
    };
  }

  const rootIv = base[0]!;
  const out = new Set(base.map((iv) => Math.round(iv)));
  for (const layer of CLUSTER_LAYERS[style]) {
    out.add(rootIv + layer);
  }

  return {
    ...spec,
    chordIntervals: [...out].sort((a, b) => a - b),
    voicingDepth: 7,
    inversion: Math.max(spec.inversion ?? 0, style === 'jazz' ? 2 : 1),
    stackOctave: true,
    extensions: mergeExtensions(spec.extensions, ['9', '11', '13']),
  };
}

/** Pick cluster color from genre / scale feel. */
export function se2SynthGenoClusterStyleForGenre(
  genreId?: string,
  scaleMode?: string,
): GenoClusterStyle {
  if (genreId === 'jazz') return 'jazz';
  if (genreId === 'dark-cinematic' || genreId === 'lofi-cinematic') return 'cinematic';
  if (
    genreId === 'rnb'
    || genreId === 'rnb-pop'
    || genreId === 'neo-soul'
    || genreId === 'gospel'
    || scaleMode === 'dorian'
    || scaleMode === 'mixolydian'
  ) {
    return 'neo-soul';
  }
  return 'rnb';
}
