/**
 * Groove Lab — Orchestra hit bank catalog (ORCH lane · CH 36).
 */
import {
  getLoadedOrchestraHitDefs,
  isOrchestraHitId,
  type OrchestraHitId,
} from '@/app/lib/creationStation/grooveLabOrchestraHitBank';

export type OrchestraHitSoundDef = {
  id: OrchestraHitId;
  label: string;
  describe: string;
};

export const GROOVE_ORCHESTRA_HIT_DEFAULT: OrchestraHitId = 'orchHit_brass';

export const GROOVE_ORCHESTRA_HIT_SOUNDS: OrchestraHitSoundDef[] = getLoadedOrchestraHitDefs().map((d) => ({
  id: d.id,
  label: d.label,
  describe: `Cinematic sample — ${d.label}`,
}));

export const GROOVE_ORCHESTRA_HIT_MAP: Record<string, OrchestraHitSoundDef> = (() => {
  const acc: Record<string, OrchestraHitSoundDef> = {};
  for (const s of GROOVE_ORCHESTRA_HIT_SOUNDS) acc[s.id] = s;
  return acc;
})();

export function resolveGrooveLabOrchestraHitId(raw?: string | null): OrchestraHitId {
  if (raw && isOrchestraHitId(raw) && GROOVE_ORCHESTRA_HIT_MAP[raw]) return raw;
  return GROOVE_ORCHESTRA_HIT_DEFAULT;
}

/** Refresh catalog after manifest load (call once on mount). */
export function refreshOrchestraHitSoundCatalog(): OrchestraHitSoundDef[] {
  return getLoadedOrchestraHitDefs().map((d) => ({
    id: d.id,
    label: d.label,
    describe: `Cinematic sample — ${d.label}`,
  }));
}
