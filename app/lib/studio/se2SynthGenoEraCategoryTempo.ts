/**
 * Chord Generator — era-category preview BPM (preview-only, not session transport).
 */
import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';
import type { Se2SynthGenoEraCategoryId } from '@/app/lib/studio/se2SynthGenoEraProgressionLibrary';

/** Production-realistic default preview tempo per era category tab. */
export const SE2_SYNTH_GENO_ERA_CATEGORY_TEMPO: Record<Se2SynthGenoEraCategoryId, number> = {
  'soul-eras': 88,
  'rnb-eras': 78,
  'neo-soul-eras': 88,
  'pop-eras': 110,
  'disco-eras': 118,
  'blues-eras': 84,
  'latin-eras': 102,
  'kpop-eras': 126,
};

export function se2SynthGenoEraCategoryBpm(categoryId: Se2SynthGenoEraCategoryId): number {
  return clampGrooveLabBpm(SE2_SYNTH_GENO_ERA_CATEGORY_TEMPO[categoryId] ?? 100);
}
