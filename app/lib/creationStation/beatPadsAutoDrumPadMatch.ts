/**
 * Auto Drum — find the best pad sample for typed instructions (one lane at a time).
 */
import {
  beatLabProducerKitMeta,
  type BeatLabProducerKitId,
} from '@/app/lib/creationStation/beatLabProducerKits';
import type { BeatPadsDrumRole } from '@/app/lib/creationStation/beatPadsLanePlacementTemplates';

export type BeatPadsTrackPadLabel = { pad: number; label: string };

export type BeatPadsAutoDrumPadMatchPlan =
  | { kind: 'copyTrackPad'; sourcePad: number; label: string; score: number }
  | { kind: 'producerKitPad'; kitId: BeatLabProducerKitId; kitPad: number; label: string; score: number };

const KICK_808_TOKENS = ['808', 'eight o eight', 'eight oh eight', 'eight zero eight'];

/** Kits to search when the active kit has no strong match. */
const FALLBACK_KITS_FOR_ROLE: Readonly<Partial<Record<BeatPadsDrumRole, readonly BeatLabProducerKitId[]>>> = {
  kick: ['trapTrunk808', 'trapDarkVault', 'vault808', 'brassTrap'],
  snare: ['trapDarkVault', 'trapTrunk808', 'trapSlabAtl'],
  clap: ['trapClapStack', 'trapDarkVault'],
  hihat: ['trapDarkVault', 'clubPocket'],
  openHat: ['trapDarkVault', 'houseDrive'],
  rim: ['trapDarkVault', 'trapAnalogRoom'],
};

/** Canonical producer-kit pad indices per role (trap layout). */
const ROLE_KIT_PADS: Readonly<Record<BeatPadsDrumRole, readonly number[]>> = {
  kick: [0, 5, 6, 15],
  snare: [1, 7, 14, 12],
  clap: [2, 9],
  hihat: [3, 12],
  openHat: [4],
  rim: [7, 8, 12],
};

function norm(q: string): string {
  return q
    .toLowerCase()
    .replace(/eight\s*o(?:h)?\s*eight/g, '808')
    .replace(/eight\s*zero\s*eight/g, '808')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(q: string): string[] {
  return q.split(/\s+/).filter((t) => t.length > 1 && !/^\d{2,3}$/.test(t));
}

function scoreLabelForAutoDrum(label: string, q: string, role: BeatPadsDrumRole): number {
  const hay = label.toLowerCase();
  let score = 0;
  const toks = tokens(q);

  for (const tok of toks) {
    if (hay.includes(tok)) score += tok.length >= 4 ? 4 : 2;
  }

  if (role === 'kick') {
    if (hay.includes('kick')) score += 6;
    if (KICK_808_TOKENS.some((t) => q.includes(t))) {
      if (hay.includes('808') || hay.includes('sub') || hay.includes('trunk') || hay.includes('bass')) score += 14;
    }
    if (q.includes('long') && (hay.includes('long') || hay.includes('808') || hay.includes('sub'))) score += 10;
    if ((q.includes('hard') || q.includes('heavy') || q.includes('punch')) &&
      (hay.includes('heavy') || hay.includes('hard') || hay.includes('dark') || hay.includes('punch'))) {
      score += 8;
    }
    if (q.includes('sparse') || q.includes('minimal')) {
      if (hay.includes('minimal') || hay.includes('sparse') || hay.includes('click')) score += 6;
    }
  }

  if (role === 'snare') {
    if (hay.includes('snare') || hay.includes('snap')) score += 8;
    if (q.includes('roll') || q.includes('fill') || q.includes('build')) {
      if (hay.includes('roll') || hay.includes('fill') || hay.includes('build') || hay.includes('tail')) score += 12;
    }
    if (q.includes('ghost') && hay.includes('ghost')) score += 8;
    if (q.includes('rim') && hay.includes('rim')) score += 6;
  }

  if (role === 'clap') {
    if (hay.includes('clap') || hay.includes('snap')) score += 8;
    if (q.includes('stack') && hay.includes('stack')) score += 6;
  }

  if (role === 'hihat') {
    if (hay.includes('hat') || hay.includes('hh') || hay.includes('ch')) score += 8;
    if (q.includes('roll') && (hay.includes('roll') || hay.includes('shake'))) score += 10;
    if (q.includes('open') && hay.includes('open')) score -= 4;
  }

  if (role === 'openHat') {
    if (hay.includes('open') || hay.includes('oh')) score += 10;
  }

  if (role === 'rim') {
    if (hay.includes('rim') || hay.includes('perc') || hay.includes('shaker')) score += 8;
  }

  return score;
}

function scoreKitPadLabel(label: string, q: string, role: BeatPadsDrumRole, kitPad: number): number {
  let score = scoreLabelForAutoDrum(label, q, role);
  if (ROLE_KIT_PADS[role].includes(kitPad)) score += 3;
  return score;
}

function pickBestTrackPad(
  q: string,
  role: BeatPadsDrumRole,
  trackPads: readonly BeatPadsTrackPadLabel[],
  targetPad: number,
): BeatPadsAutoDrumPadMatchPlan | null {
  let best: BeatPadsAutoDrumPadMatchPlan | null = null;
  for (const { pad, label } of trackPads) {
    if (pad === targetPad) continue;
    const score = scoreLabelForAutoDrum(label, q, role);
    if (score < 4) continue;
    if (!best || score > best.score) {
      best = { kind: 'copyTrackPad', sourcePad: pad, label, score };
    }
  }
  return best;
}

function pickBestProducerPad(
  q: string,
  role: BeatPadsDrumRole,
  kitId: BeatLabProducerKitId,
): BeatPadsAutoDrumPadMatchPlan | null {
  const meta = beatLabProducerKitMeta(kitId);
  if (!meta) return null;
  let best: BeatPadsAutoDrumPadMatchPlan | null = null;
  for (const def of meta.pads) {
    const score = scoreKitPadLabel(def.label, q, role, def.pad);
    if (score < 3) continue;
    if (!best || score > best.score) {
      best = {
        kind: 'producerKitPad',
        kitId,
        kitPad: def.pad,
        label: def.label,
        score,
      };
    }
  }
  return best;
}

function fallbackProducerPad(role: BeatPadsDrumRole, q: string): BeatPadsAutoDrumPadMatchPlan | null {
  const kits = FALLBACK_KITS_FOR_ROLE[role] ?? ['trapDarkVault'];
  for (const kitId of kits) {
    const meta = beatLabProducerKitMeta(kitId);
    if (!meta) continue;

    if (role === 'kick' && KICK_808_TOKENS.some((t) => q.includes(t))) {
      const long808 =
        meta.pads.find((p) => p.label.toLowerCase().includes('808 long')) ??
        meta.pads.find((p) => p.pad === 0 && p.label.toLowerCase().includes('808')) ??
        meta.pads.find((p) => p.pad === 5) ??
        meta.pads.find((p) => p.pad === 15);
      if (long808) {
        return {
          kind: 'producerKitPad',
          kitId,
          kitPad: long808.pad,
          label: long808.label,
          score: 1,
        };
      }
    }

    const padIndex = ROLE_KIT_PADS[role][0] ?? 0;
    const def = meta.pads.find((p) => p.pad === padIndex) ?? meta.pads[0];
    if (def) {
      return {
        kind: 'producerKitPad',
        kitId,
        kitPad: def.pad,
        label: def.label,
        score: 1,
      };
    }
  }
  return null;
}

/**
 * Plan how to load a sample onto the user's selected pad from typed instructions.
 * Prefers copying a matching sample already on the track, then producer-kit search.
 */
export function planAutoDrumPadMatch(
  rawQuery: string,
  role: BeatPadsDrumRole,
  trackPads: readonly BeatPadsTrackPadLabel[],
  activeKitId: BeatLabProducerKitId,
  targetPad: number,
): BeatPadsAutoDrumPadMatchPlan | null {
  const q = norm(rawQuery);
  if (!q) return null;

  const fromTrack = pickBestTrackPad(q, role, trackPads, targetPad);
  if (fromTrack && fromTrack.score >= 8) return fromTrack;

  const kitIds = [activeKitId, ...(FALLBACK_KITS_FOR_ROLE[role] ?? [])].filter(
    (id, i, arr) => arr.indexOf(id) === i,
  );

  let bestKit: BeatPadsAutoDrumPadMatchPlan | null = null;
  for (const kitId of kitIds) {
    const hit = pickBestProducerPad(q, role, kitId);
    if (!hit) continue;
    if (!bestKit || hit.score > bestKit.score) bestKit = hit;
  }

  if (fromTrack && bestKit) {
    return fromTrack.score >= bestKit.score ? fromTrack : bestKit;
  }
  if (fromTrack) return fromTrack;
  if (bestKit && bestKit.score >= 4) return bestKit;

  return fallbackProducerPad(role, q);
}
