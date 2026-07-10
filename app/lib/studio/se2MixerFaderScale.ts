/**
 * Shared fader dB scale (math only) — Studio Editor 2, Groove Lab, and Beat Lab UIs.
 * Mixer **state** is separate: SE2 uses `se2StudioMixerState`; labs use MasterClock CH volumes / pan storage.
 */

export const MIXER_FADER_RAIL_LEFT = '78%';
export const MIXER_DB_SCALE_EDGE_LEFT_PX = 6;
export const MIXER_DB_SCALE_EDGE_RIGHT = 'calc(22% + 20px)';

export const MIXER_FADER_INSET_TOP_PX = 10;
export const MIXER_FADER_INSET_BOTTOM_PX = 16;
export const MIXER_FADER_INSET_SUM_PX = MIXER_FADER_INSET_TOP_PX + MIXER_FADER_INSET_BOTTOM_PX;
export const MIXER_FADER_KNOB_H_PX = 18;
export const MIXER_FADER_ARROW_REF_FROM_BOTTOM_PX = 13;

/** Unity / 0 dB on the printed scale (default fader position). */
export const MIXER_UNITY_VOL = 100;

export const GROOVE_LAB_DEFAULT_CHANNEL_VOL = MIXER_UNITY_VOL;

export const MIXER_FADER_MAX_BOOST_DB = 6;
export const MIXER_FADER_CUT_END_DB = 60;

export const MIXER_FADER_DB_TICKS: { label: string; vol: number }[] = [
  { label: '+6', vol: 127 },
  { label: '+3', vol: 114 },
  { label: '0', vol: 100 },
  { label: '-6', vol: 90 },
  { label: '-12', vol: 80 },
  { label: '-18', vol: 70 },
  { label: '-24', vol: 60 },
  { label: '-36', vol: 41 },
  { label: '-48', vol: 21 },
  { label: '-60', vol: 1 },
];

export function mixerFaderTravelBottom(vol127: number): string {
  const t = Math.max(0, Math.min(1, vol127 / 127));
  const pct = t * 100;
  return `calc(${MIXER_FADER_INSET_BOTTOM_PX}px + ${pct.toFixed(5)}% - ${(t * MIXER_FADER_INSET_SUM_PX).toFixed(5)}px)`;
}

export function mixerFaderKnobBottom(vol127: number): string {
  const t = Math.max(0, Math.min(1, vol127 / 127));
  const pct = t * 100;
  const ref = MIXER_FADER_ARROW_REF_FROM_BOTTOM_PX;
  return `calc(${MIXER_FADER_INSET_BOTTOM_PX - ref}px + ${pct.toFixed(5)}% - ${(t * MIXER_FADER_INSET_SUM_PX).toFixed(5)}px)`;
}

export function mixerFaderFillHeight(vol127: number): string {
  const t = Math.max(0, Math.min(1, vol127 / 127));
  const pct = t * 100;
  return `calc(${pct.toFixed(5)}% - ${(t * MIXER_FADER_INSET_SUM_PX).toFixed(5)}px)`;
}

export function mixerVolToDb(vol127: number): number {
  if (vol127 <= 0) return -Infinity;
  if (vol127 < 100) {
    return -MIXER_FADER_CUT_END_DB + ((vol127 - 1) / 99) * MIXER_FADER_CUT_END_DB;
  }
  if (vol127 === 100) return 0;
  return ((vol127 - 100) / 27) * MIXER_FADER_MAX_BOOST_DB;
}

export function mixerVolToLinearGain(vol127: number): number {
  const db = mixerVolToDb(vol127);
  if (!Number.isFinite(db)) return 0;
  return Math.pow(10, db / 20);
}

export function formatMixerFaderDb(vol127: number): string {
  if (vol127 <= 0) return '-∞';
  if (vol127 < 100) {
    const db = -MIXER_FADER_CUT_END_DB + ((vol127 - 1) / 99) * MIXER_FADER_CUT_END_DB;
    return `${Math.round(db)}`;
  }
  if (vol127 === 100) return '0';
  const plusDb = ((vol127 - 100) / 27) * MIXER_FADER_MAX_BOOST_DB;
  const dec = Math.round(plusDb * 10) / 10;
  return `+${String(dec).replace(/\.0$/, '')}`;
}

/** Snap to nearest printed tick when the cap is released close to a hash mark. */
export function snapMixerFaderVol127(vol127: number, threshold = 1.25): number {
  const v = Math.max(0, Math.min(127, Math.round(vol127)));
  let best = v;
  let bestDist = threshold + 1;
  for (const { vol: tickVol } of MIXER_FADER_DB_TICKS) {
    const d = Math.abs(v - tickVol);
    if (d <= threshold && d < bestDist) {
      bestDist = d;
      best = tickVol;
    }
  }
  return best;
}

/** Old Groove embed stored 0–100 as linear percent — map to closest 127-step fader. */
export function legacyLinearPercentToVol127(percent: number): number {
  const target = Math.max(0, Math.min(1, percent / 100));
  if (target <= 0) return 0;
  let best = 1;
  let bestErr = Infinity;
  for (let v = 0; v <= 127; v += 1) {
    const err = Math.abs(mixerVolToLinearGain(v) - target);
    if (err < bestErr) {
      bestErr = err;
      best = v;
    }
  }
  return best;
}

/** Seed / repair popup-mixer unity (0 dB) — missing keys or stuck-at-silence fader values. */
export function grooveLabChannelsNeedingVolumeRepair(
  channelVolumes: Record<number, number> | undefined,
  channelIds: readonly number[],
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const ch of channelIds) {
    const raw = channelVolumes?.[ch];
    if (raw == null || !Number.isFinite(raw)) {
      out[ch] = GROOVE_LAB_DEFAULT_CHANNEL_VOL;
      continue;
    }
    const vol127 = grooveLabChannelVol127(raw);
    if (mixerVolToLinearGain(vol127) <= 0.001) {
      out[ch] = GROOVE_LAB_DEFAULT_CHANNEL_VOL;
    }
  }
  return out;
}

/** @deprecated Use {@link grooveLabChannelsNeedingVolumeRepair}. */
export function grooveLabMissingChannelVolumeDefaults(
  channelVolumes: Record<number, number> | undefined,
  channelIds: readonly number[],
): Record<number, number> {
  return grooveLabChannelsNeedingVolumeRepair(channelVolumes, channelIds);
}

export function grooveLabChannelVol127(raw: number | undefined): number {
  if (raw == null || !Number.isFinite(raw)) return GROOVE_LAB_DEFAULT_CHANNEL_VOL;
  const v = Math.round(raw);
  if (v < 0) return 0;
  if (v > 127) return 127;
  if (v > 100) return v;
  if (v === GROOVE_LAB_DEFAULT_CHANNEL_VOL) return v;
  /** Previous Groove Lab default was linear 80 — treat as unity on the dB scale. */
  if (v === 80) return GROOVE_LAB_DEFAULT_CHANNEL_VOL;
  return legacyLinearPercentToVol127(v);
}
