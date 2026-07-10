/**
 * Multi-velocity layer selection (min 4 layers — soft / medium / hard / accent).
 */
import type { GuitarSampleZone } from '@/app/lib/studio/guitarEngine/types';

export function guitarVelocityLayerIndex(velocity127: number, layerCount: number): number {
  const v = Math.max(1, Math.min(127, velocity127));
  const layer = Math.floor((v / 128) * layerCount);
  return Math.min(layerCount - 1, Math.max(0, layer));
}

/** Filter zones to the velocity layer, then pick exact velocity range match. */
export function guitarZonesForVelocity(
  zones: readonly GuitarSampleZone[],
  velocity127: number,
  layerCount: number,
): GuitarSampleZone[] {
  const layerIdx = guitarVelocityLayerIndex(velocity127, layerCount);
  const inVel = zones.filter(
    (z) => velocity127 >= z.velocityLo && velocity127 <= z.velocityHi,
  );
  if (inVel.length) return inVel;

  const byLayer = zones.filter((_, i, arr) => {
    const uniqueLayers = new Set(arr.map((z) => z.velocityLo));
    const sorted = [...uniqueLayers].sort((a, b) => a - b);
    const targetLo = sorted[layerIdx];
    return targetLo != null && zones.some((z) => z.velocityLo === targetLo);
  });

  if (byLayer.length) {
    const targetLo = [...new Set(zones.map((z) => z.velocityLo))].sort((a, b) => a - b)[layerIdx];
    return zones.filter((z) => z.velocityLo === targetLo);
  }

  return [...zones];
}
