/**
 * SE2 Drum Generator — per-pad sound overrides (16 pads).
 * Swap kick, snare, clap, etc. from producer kits or the user's sound library.
 */
import {
  ensureBeatLabProducerKitLoaded,
  BEAT_LAB_PRODUCER_KITS,
  type BeatLabProducerKitId,
  type LoadedBeatLabProducerPad,
} from '@/app/lib/creationStation/beatLabProducerKits';
import {
  loadPianoRollDrumKit,
  pianoRollPadLabelsForKit,
  triggerPianoRollDrumPad,
  type PianoRollDrumKitSession,
} from '@/app/lib/pianoRoll/pianoRollDrumEngine';
import {
  samplerOptsFromStored,
  storedToArrayBuffer,
  loadPadSampleStore,
  type StoredPadSample,
} from '@/app/lib/padSampleStorage';
import type { Sound } from '@/app/lib/soundLibrary';
import { soundToStoredPadSample } from '@/app/lib/soundLibrary';

export type Se2DrumPadOverride =
  | { kind: 'sample'; sample: StoredPadSample }
  | { kind: 'producer'; kitId: BeatLabProducerKitId; pad: number };

export type Se2DrumPadOverrides = Partial<Record<number, Se2DrumPadOverride>>;

export type Se2DrumPadSoundBrowseItem = {
  id: string;
  group: string;
  label: string;
  override: Se2DrumPadOverride;
};

export function se2DrumPadOverridesSignature(overrides: Se2DrumPadOverrides | undefined): string {
  if (!overrides || Object.keys(overrides).length === 0) return '';
  const keys = Object.keys(overrides)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  return keys
    .map((pad) => {
      const o = overrides[pad]!;
      if (o.kind === 'producer') return `${pad}:p:${o.kitId}:${o.pad}`;
      return `${pad}:s:${o.sample.label ?? ''}:${o.sample.data.length}`;
    })
    .join('|');
}

export async function decodeStoredPadSample(
  stored: StoredPadSample,
  ctx: BaseAudioContext,
): Promise<AudioBuffer> {
  const bytes = storedToArrayBuffer(stored);
  return ctx.decodeAudioData(bytes.slice(0));
}

export function se2DrumPadOverrideFromSound(sound: Sound): Se2DrumPadOverride {
  return { kind: 'sample', sample: soundToStoredPadSample(sound) };
}

export function se2DrumPadOverrideFromProducer(
  kitId: BeatLabProducerKitId,
  pad: number,
): Se2DrumPadOverride {
  return { kind: 'producer', kitId, pad };
}

/** Flat browse list — producer kit pads + caller supplies library sounds separately. */
export function se2DrumPadProducerBrowseItems(): Se2DrumPadSoundBrowseItem[] {
  const out: Se2DrumPadSoundBrowseItem[] = [];
  for (const kit of BEAT_LAB_PRODUCER_KITS) {
    for (const def of kit.pads) {
      if (def.pad < 0 || def.pad > 15) continue;
      out.push({
        id: `prod:${kit.id}:${def.pad}`,
        group: kit.title,
        label: `Pad ${def.pad + 1} · ${def.label}`,
        override: se2DrumPadOverrideFromProducer(kit.id, def.pad),
      });
    }
  }
  return out;
}

export function se2DrumPadLibraryBrowseItems(sounds: readonly Sound[]): Se2DrumPadSoundBrowseItem[] {
  return sounds.map((s) => ({
    id: `lib:${s.id}`,
    group: 'Sound library',
    label: s.name,
    override: se2DrumPadOverrideFromSound(s),
  }));
}

/** Beat Lab MPC pad sample store (banks A–H). */
export function se2DrumPadBeatLabStoreBrowseItems(): Se2DrumPadSoundBrowseItem[] {
  const store = loadPadSampleStore();
  const out: Se2DrumPadSoundBrowseItem[] = [];
  for (const [key, sample] of Object.entries(store)) {
    if (!sample?.data) continue;
    const bank = key.split('_')[0] ?? '?';
    const padNum = Number(key.split('_')[1] ?? NaN);
    const padLabel = Number.isFinite(padNum) ? `Bank ${bank} pad ${padNum + 1}` : key;
    const name = sample.label?.trim() || padLabel;
    out.push({
      id: `blstore:${key}`,
      group: 'Beat Lab pads',
      label: name,
      override: { kind: 'sample', sample },
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

/** Pads from the lane's active producer kit — shown first in the picker. */
export function se2DrumPadCurrentKitBrowseItems(kitId: BeatLabProducerKitId): Se2DrumPadSoundBrowseItem[] {
  const meta = BEAT_LAB_PRODUCER_KITS.find((k) => k.id === kitId);
  if (!meta) return [];
  return meta.pads
    .filter((def) => def.pad >= 0 && def.pad <= 15)
    .map((def) => ({
      id: `curkit:${kitId}:${def.pad}`,
      group: 'This kit',
      label: `Pad ${def.pad + 1} · ${def.label}`,
      override: se2DrumPadOverrideFromProducer(kitId, def.pad),
    }));
}

const PAD_ROLE_KEYWORDS: readonly (readonly string[])[] = [
  ['kick', '808', 'sub', 'bass', 'woofer'],
  ['snare', 'snap', 'rim'],
  ['clap', 'snap', 'slap'],
  ['hat', 'hihat', 'ch ', 'closed', 'hh'],
  ['open', 'oh ', 'cym'],
  ['tom', '808 body'],
  ['tom', 'low', 'floor'],
  ['rim', 'perc', 'percussion', 'hit'],
  ['perc', 'stab', 'shaker'],
  ['clap', 'layer', 'stack'],
  ['crash', 'cym', 'ride'],
  ['ride', 'cym'],
  ['shaker', 'perc', 'bongo'],
  ['cow', 'accent', 'perc'],
  ['snap', 'snare'],
  ['sub', '808', 'bass', 'trunk'],
];

function labelMatchesPadRole(label: string, padIndex: number): boolean {
  const keys = PAD_ROLE_KEYWORDS[padIndex] ?? ['perc', 'drum', 'hit'];
  const low = label.toLowerCase();
  return keys.some((k) => low.includes(k));
}

/** Producer one-shots that match the clicked pad role (snare pad → snares, etc.). */
export function se2DrumPadRoleMatchedBrowseItems(
  padIndex: number,
  limit = 48,
): Se2DrumPadSoundBrowseItem[] {
  const out: Se2DrumPadSoundBrowseItem[] = [];
  for (const kit of BEAT_LAB_PRODUCER_KITS) {
    for (const def of kit.pads) {
      if (def.pad < 0 || def.pad > 15) continue;
      if (!labelMatchesPadRole(def.label, padIndex)) continue;
      out.push({
        id: `role:${kit.id}:${def.pad}`,
        group: 'More kits',
        label: `${kit.title} · ${def.label}`,
        override: se2DrumPadOverrideFromProducer(kit.id, def.pad),
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function se2DrumPadDefaultBrowseItems(opts: {
  kitId?: BeatLabProducerKitId;
  padIndex: number;
  sounds: readonly Sound[];
}): Se2DrumPadSoundBrowseItem[] {
  const seen = new Set<string>();
  const push = (items: Se2DrumPadSoundBrowseItem[]) => {
    for (const it of items) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      merged.push(it);
    }
  };
  const merged: Se2DrumPadSoundBrowseItem[] = [];
  if (opts.kitId) push(se2DrumPadCurrentKitBrowseItems(opts.kitId));
  push(se2DrumPadBeatLabStoreBrowseItems());
  push(se2DrumPadLibraryBrowseItems(opts.sounds));
  push(se2DrumPadRoleMatchedBrowseItems(opts.padIndex, 40));
  return merged;
}

export function se2DrumPadDisplayLabel(
  padIndex: number,
  kitId: BeatLabProducerKitId | undefined,
  overrides: Se2DrumPadOverrides | undefined,
): string {
  const hit = overrides?.[padIndex];
  if (hit?.kind === 'sample') {
    const name = hit.sample.label?.trim();
    return name && name.length > 0 ? name : `Custom ${padIndex + 1}`;
  }
  if (hit?.kind === 'producer') {
    const meta = BEAT_LAB_PRODUCER_KITS.find((k) => k.id === hit.kitId);
    const def = meta?.pads.find((p) => p.pad === hit.pad);
    if (def) return def.label;
    return `Kit pad ${hit.pad + 1}`;
  }
  if (kitId) {
    const labels = pianoRollPadLabelsForKit(kitId);
    return labels[padIndex] ?? `Pad ${padIndex + 1}`;
  }
  return `Pad ${padIndex + 1}`;
}

async function resolveOverridePad(
  override: Se2DrumPadOverride,
  ctx: BaseAudioContext,
): Promise<LoadedBeatLabProducerPad | null> {
  if (override.kind === 'producer') {
    const pads = await ensureBeatLabProducerKitLoaded(override.kitId, ctx);
    return pads.find((p) => p.pad === override.pad) ?? null;
  }
  try {
    const buffer = await decodeStoredPadSample(override.sample, ctx);
    return {
      pad: -1,
      buffer,
      label: override.sample.label?.trim() || 'Custom',
      sampler: samplerOptsFromStored(override.sample),
    };
  } catch {
    return null;
  }
}

/** Merge base producer kit with per-pad overrides into one playback session. */
export async function buildMergedDrumKitSession(
  kitId: BeatLabProducerKitId,
  overrides: Se2DrumPadOverrides | undefined,
  ctx: AudioContext,
): Promise<PianoRollDrumKitSession> {
  const base = await loadPianoRollDrumKit(kitId, ctx);
  if (!overrides || Object.keys(overrides).length === 0) return base;

  const padMap = new Map<number, LoadedBeatLabProducerPad>();
  for (const p of base.pads) padMap.set(p.pad, p);

  const entries = Object.entries(overrides)
    .map(([k, v]) => ({ pad: Number(k), override: v }))
    .filter((e) => Number.isFinite(e.pad) && e.pad >= 0 && e.pad <= 15 && e.override);

  await Promise.all(
    entries.map(async ({ pad, override }) => {
      const loaded = await resolveOverridePad(override!, ctx);
      if (!loaded) return;
      padMap.set(pad, { ...loaded, pad });
    }),
  );

  return {
    kitId,
    pads: [...padMap.values()].sort((a, b) => a.pad - b.pad),
  };
}

/** Hear a candidate sound once — does not write to the lane. */
export async function previewSe2DrumPadOverride(
  ctx: AudioContext,
  dest: AudioNode,
  override: Se2DrumPadOverride,
  velocity = 110,
): Promise<boolean> {
  const loaded = await resolveOverridePad(override, ctx);
  if (!loaded) return false;
  const kitId: BeatLabProducerKitId =
    override.kind === 'producer' ? override.kitId : 'trapDarkVault';
  const session: PianoRollDrumKitSession = {
    kitId,
    pads: [{ ...loaded, pad: 0 }],
  };
  return triggerPianoRollDrumPad(session, 0, ctx, velocity, undefined, dest);
}
