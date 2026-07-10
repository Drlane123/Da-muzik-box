/**
 * SE2 Guitar lane — inline channel FX (drive, chorus, reverb).
 */
import type { Se2GuitarTrack } from '@/app/lib/studio/se2GuitarTrack';

export type Se2GuitarFxSettings = {
  /** Soft saturation 0–100 */
  drive: number;
  /** Modulated delay width 0–100 */
  chorus: number;
  /** Room reverb mix 0–100 */
  reverb: number;
  /** Presence / mid EQ — Shreddage Console tone shaping 0–100 */
  tone: number;
  /** Dynamics glue — compressor amount 0–100 */
  comp: number;
};

export const SE2_GUITAR_FX_DEFAULTS: Se2GuitarFxSettings = {
  drive: 0,
  chorus: 22,
  reverb: 18,
  tone: 55,
  comp: 42,
};

function clampPct(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function se2GuitarFxFromTrack(tr: {
  guitarFxDrive?: number;
  guitarFxChorus?: number;
  guitarFxReverb?: number;
  guitarFxTone?: number;
  guitarFxComp?: number;
}): Se2GuitarFxSettings {
  return {
    drive: clampPct(tr.guitarFxDrive ?? SE2_GUITAR_FX_DEFAULTS.drive),
    chorus: clampPct(tr.guitarFxChorus ?? SE2_GUITAR_FX_DEFAULTS.chorus),
    reverb: clampPct(tr.guitarFxReverb ?? SE2_GUITAR_FX_DEFAULTS.reverb),
    tone: clampPct(tr.guitarFxTone ?? SE2_GUITAR_FX_DEFAULTS.tone),
    comp: clampPct(tr.guitarFxComp ?? SE2_GUITAR_FX_DEFAULTS.comp),
  };
}

export function se2GuitarFxPatchFromTrack(
  tr: Se2GuitarTrack,
  patch: Partial<Se2GuitarFxSettings>,
): Pick<
  Se2GuitarTrack,
  'guitarFxDrive' | 'guitarFxChorus' | 'guitarFxReverb' | 'guitarFxTone' | 'guitarFxComp'
> {
  const cur = se2GuitarFxFromTrack(tr);
  return {
    guitarFxDrive: clampPct(patch.drive ?? cur.drive),
    guitarFxChorus: clampPct(patch.chorus ?? cur.chorus),
    guitarFxReverb: clampPct(patch.reverb ?? cur.reverb),
    guitarFxTone: clampPct(patch.tone ?? cur.tone),
    guitarFxComp: clampPct(patch.comp ?? cur.comp),
  };
}
