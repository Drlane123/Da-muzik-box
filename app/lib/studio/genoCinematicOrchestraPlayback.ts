/**
 * Geno Bass / Geno Ultra — cinematic library presets play real orchestra-hit WAVs
 * (same bank as Beat Pads Cinematic Hits + SE2 instrument picker).
 */
import {
  ensureOrchestraHitBuffer,
  getOrchestraHitDef,
  playOrchestraHitSample,
  type OrchestraHitId,
} from '@/app/lib/creationStation/grooveLabOrchestraHitBank';

/** Preset id suffix (after bass- / ultra-) → orchestra hit manifest id. */
const CINEMATIC_SUFFIX_TO_ORCH: Record<string, OrchestraHitId> = {
  'cine-impact': 'orchHit_cine',
  'cine-impact-dark': 'orchHit_cineDark',
  'cine-impact-sub': 'orchHit_cineSub',
  'cine-impact-bright': 'orchHit_cineBright',
  'cine-impact-filtered': 'orchHit_cineFiltered',
  'cine-symphony-hit': 'orchHit_brass',
  'cine-brass-impact': 'orchHit_proteus',
  'cine-big-brass-hit': 'orchHit_jv2080',
  'cine-classic-orch-hit': 'orchHit_sc88',
  'cine-choir-stab': 'orchHit_choir',
  'cine-tight-low-strings': 'orchHit_strings',
  'cine-pizzicato-stab': 'orchHit_pizz',
  'cine-pizz-chord': 'orchHit_pizzChord',
  'cine-sharp-brass-stab': 'orchHit_tg500',
};

export function genoCinematicPresetSuffix(presetId: string): string | null {
  if (presetId.startsWith('bass-')) return presetId.slice('bass-'.length);
  if (presetId.startsWith('ultra-')) return presetId.slice('ultra-'.length);
  return null;
}

export function genoOrchestraHitIdForPreset(presetId: string): OrchestraHitId | null {
  const suffix = genoCinematicPresetSuffix(presetId);
  if (!suffix) return null;
  return CINEMATIC_SUFFIX_TO_ORCH[suffix] ?? null;
}

export function genoPresetIsCinematicOrchestraHit(presetId: string): boolean {
  return genoOrchestraHitIdForPreset(presetId) != null;
}

export async function ensureGenoCinematicOrchestraHitReady(
  ctx: BaseAudioContext,
  presetId: string,
): Promise<boolean> {
  const hitId = genoOrchestraHitIdForPreset(presetId);
  if (!hitId) return false;
  const def = getOrchestraHitDef(hitId);
  if (!def) return false;
  const buf = await ensureOrchestraHitBuffer(ctx, def);
  return buf != null;
}

export function tryPlayGenoCinematicOrchestraHit(
  ctx: AudioContext,
  outputNode: AudioNode,
  presetId: string,
  pitch: number,
  velocityMidi: number,
  when?: number,
): boolean {
  const hitId = genoOrchestraHitIdForPreset(presetId);
  if (!hitId) return false;
  const def = getOrchestraHitDef(hitId);
  if (!def) return false;
  const t0 = when ?? ctx.currentTime + 0.008;
  const vel01 = Math.min(1, Math.max(0.05, velocityMidi / 127));
  return playOrchestraHitSample(ctx, def, t0, vel01, {
    outputNode,
    nativePitch: false,
    targetMidi: pitch,
  });
}

export async function playGenoCinematicOrchestraHit(
  ctx: AudioContext,
  outputNode: AudioNode,
  presetId: string,
  pitch: number,
  velocityMidi: number,
  when?: number,
): Promise<boolean> {
  await ensureGenoCinematicOrchestraHitReady(ctx, presetId);
  return tryPlayGenoCinematicOrchestraHit(ctx, outputNode, presetId, pitch, velocityMidi, when);
}
