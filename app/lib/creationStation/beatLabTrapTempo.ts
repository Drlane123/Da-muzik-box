import type { PatternPreset } from '@/app/lib/patternPresets';

/**
 * Trap producer workflow: patterns are authored on a 16-step bar at **producer grid**
 * tempo (typically 130–150 BPM) so hi-hat rolls are easy to program — but the **felt**
 * groove is half-time (~65–75 BPM). Beat Lab transport runs at felt tempo; the grid
 * stays at producer resolution.
 *
 * @see https://blog.samplefocus.com/blog/everything-you-need-to-know-about-140-bpm/
 */

/** Presets at or below this BPM are already authored at felt half-time — do not halve. */
export const TRAP_FELT_BPM_CEILING = 85;

export function beatLabTrapTransportBpmFromProducer(producerGridBpm: number): number {
  const p = Math.max(40, Math.min(240, Math.round(producerGridBpm)));
  if (p <= TRAP_FELT_BPM_CEILING) return p;
  return Math.max(40, Math.min(120, Math.round(p / 2)));
}

export function beatLabTrapProducerGridForTransport(feltBpm: number): number {
  const t = Math.max(40, Math.min(120, Math.round(feltBpm)));
  if (t <= TRAP_FELT_BPM_CEILING) return Math.min(240, t * 2);
  return t * 2;
}

export function beatLabTrapPresetUsesProducerGrid(
  preset: Pick<PatternPreset, 'genre' | 'role'>,
  producerGridBpm: number,
): boolean {
  return preset.genre === 'Trap' && preset.role === 'drums' && producerGridBpm > TRAP_FELT_BPM_CEILING;
}

/** Producer grid BPM when this trap preset uses double-time authoring (undefined otherwise). */
export function beatLabTrapProducerGridBpmLabel(
  preset: PatternPreset,
  producerGridBpm: number,
  transportBpm: number,
): number | undefined {
  if (!beatLabTrapPresetUsesProducerGrid(preset, producerGridBpm)) return undefined;
  if (producerGridBpm === transportBpm) return undefined;
  return producerGridBpm;
}
