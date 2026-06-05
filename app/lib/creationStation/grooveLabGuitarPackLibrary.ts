/**
 * Groove Lab — Guitar bar licks (sample triggers on the roll, chord-root locked).
 * Each entry is a real guitar one-shot / wah lick from the sample manifest.
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { GrooveStagedProgression } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import {
  getLoadedGuitarLickDefs,
  isGuitarLickSampleId,
  type GuitarLickDef,
  type GuitarLickId,
} from '@/app/lib/creationStation/grooveLabGuitarLickBank';
import type { PlayGrooveLabLeadSoundOpts } from '@/app/lib/creationStation/grooveLabLeadSounds';
import {
  GROOVE_LAB_BASS_REFERENCE_MIDI,
  grooveLabClampGuitarMidi,
} from '@/app/lib/creationStation/grooveLabPitch';
import {
  GROOVE_LAB_SLOTS_PER_BAR,
  grooveLabChordAttackColumns,
  grooveLabSlotsPerCell,
  grooveLabTotalSlots,
  normalizeGrooveBarCount,
  snapGrooveSlot,
  snapGrooveSustain,
  type GrooveLabBarCount,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';

export type GrooveGuitarPackKind = 'bar' | 'stab';

export type GrooveGuitarPackEntry = {
  id: string;
  label: string;
  categoryId: string;
  categoryLabel: string;
  lickId: GuitarLickId;
  kind: GrooveGuitarPackKind;
  rootMidi: number;
};

export type GrooveGuitarPackCategory = {
  id: string;
  label: string;
};

const STATIC_LICK_SEEDS: readonly {
  lickId: GuitarLickId;
  label: string;
  categoryId: string;
  categoryLabel: string;
  kind: GrooveGuitarPackKind;
}[] = [
  { lickId: 'lickSample_wahClean', label: 'Wah clean', categoryId: 'wah', categoryLabel: 'Wah bar', kind: 'bar' },
  { lickId: 'lickSample_wahDrive', label: 'Wah drive', categoryId: 'wah', categoryLabel: 'Wah bar', kind: 'bar' },
  { lickId: 'lickSample_bluesRiff', label: 'Blues bar', categoryId: 'bar', categoryLabel: 'Bar licks', kind: 'bar' },
  { lickId: 'lickSample_arenaHook', label: 'Arena hook', categoryId: 'bar', categoryLabel: 'Bar licks', kind: 'bar' },
  { lickId: 'lickSample_neoSoulBend', label: 'Soul bend', categoryId: 'bar', categoryLabel: 'Bar licks', kind: 'bar' },
  { lickId: 'lickSample_slideSoul', label: 'Slide soul', categoryId: 'bar', categoryLabel: 'Bar licks', kind: 'bar' },
  { lickId: 'lickSample_cleanPick', label: 'Clean pick', categoryId: 'bar', categoryLabel: 'Bar licks', kind: 'bar' },
  { lickId: 'lickSample_palmMute', label: 'Palm mute', categoryId: 'bar', categoryLabel: 'Bar licks', kind: 'bar' },
  { lickId: 'lickSample_chimeHarmonic', label: 'Chime', categoryId: 'bar', categoryLabel: 'Bar licks', kind: 'bar' },
  { lickId: 'lickSample_wahClean', label: 'Wah stab', categoryId: 'stab', categoryLabel: 'One shot', kind: 'stab' },
  { lickId: 'lickSample_wahDrive', label: 'Wah drive stab', categoryId: 'stab', categoryLabel: 'One shot', kind: 'stab' },
  { lickId: 'lickSample_cleanPick', label: 'Pick stab', categoryId: 'stab', categoryLabel: 'One shot', kind: 'stab' },
  { lickId: 'lickSample_chimeHarmonic', label: 'Harm stab', categoryId: 'stab', categoryLabel: 'One shot', kind: 'stab' },
];

function seedPackId(seed: (typeof STATIC_LICK_SEEDS)[number]): string {
  return `${seed.kind}::${seed.lickId}::${seed.categoryId}`;
}

function entryFromSeed(
  seed: (typeof STATIC_LICK_SEEDS)[number],
  def?: GuitarLickDef,
): GrooveGuitarPackEntry {
  const rootMidi = grooveLabClampGuitarMidi(def?.rootMidi ?? 72);
  return {
    id: seedPackId(seed),
    label: seed.label,
    categoryId: seed.categoryId,
    categoryLabel: seed.categoryLabel,
    lickId: seed.lickId,
    kind: seed.kind,
    rootMidi,
  };
}

/** Wah + bar lick + one-shot catalog (no chord-melody generation). */
export function buildGrooveGuitarPackCatalog(_keyRoot = 0): GrooveGuitarPackEntry[] {
  const loaded = getLoadedGuitarLickDefs();
  const byId = new Map(loaded.map((d) => [d.id, d]));
  const out: GrooveGuitarPackEntry[] = [];
  const seen = new Set<string>();
  for (const seed of STATIC_LICK_SEEDS) {
    if (!isGuitarLickSampleId(seed.lickId)) continue;
    const sid = seedPackId(seed);
    if (seen.has(sid)) continue;
    seen.add(sid);
    out.push(entryFromSeed(seed, byId.get(seed.lickId)));
  }
  for (const def of loaded) {
    if (!isGuitarLickSampleId(def.id)) continue;
    const id = `bar::${def.id}::extra`;
    if (seen.has(id)) continue;
    if (out.some((e) => e.lickId === def.id && e.kind === 'bar')) continue;
    seen.add(id);
    const tag = def.tag ?? '';
    const wah = tag.includes('wah');
    out.push({
      id,
      label: def.label,
      categoryId: wah ? 'wah' : 'bar',
      categoryLabel: wah ? 'Wah bar' : 'Bar licks',
      lickId: def.id,
      kind: 'bar',
      rootMidi: grooveLabClampGuitarMidi(def.rootMidi),
    });
  }
  return out;
}

export function grooveGuitarPackCategories(
  catalog: readonly GrooveGuitarPackEntry[],
): GrooveGuitarPackCategory[] {
  const seen = new Map<string, string>();
  for (const e of catalog) {
    if (!seen.has(e.categoryId)) seen.set(e.categoryId, e.categoryLabel);
  }
  const order = ['wah', 'bar', 'stab'];
  return order
    .filter((id) => seen.has(id))
    .map((id) => ({ id, label: seen.get(id)! }))
    .concat(
      [...seen.entries()]
        .filter(([id]) => !order.includes(id))
        .map(([id, label]) => ({ id, label })),
    );
}

export type GrooveGuitarPackRollBuild = GrooveStagedProgression & {
  guitarHits: GrooveRollHit[];
  lickId: GuitarLickId;
};

export function buildGuitarPackRoll(
  entry: GrooveGuitarPackEntry,
  opts: {
    keyRoot: number;
    mode: ChordMode;
    quantize: GrooveLabQuantize;
    barCount: number;
    sustainSlots: number;
    chordHits: readonly GrooveRollHit[];
    referenceMidi?: number;
  },
): GrooveGuitarPackRollBuild | { message: string } {
  const barCount: GrooveLabBarCount = normalizeGrooveBarCount(opts.barCount);
  const slotsPerBar = GROOVE_LAB_SLOTS_PER_BAR;
  const cellStep = grooveLabSlotsPerCell(opts.quantize);
  const refMidi = opts.referenceMidi ?? GROOVE_LAB_BASS_REFERENCE_MIDI;
  const columns = grooveLabChordAttackColumns(opts.chordHits, {
    keyRoot: opts.keyRoot,
    mode: opts.mode,
    referenceMidi: refMidi,
    quantize: opts.quantize,
  });
  if (columns.length === 0) {
    return { message: 'Drop green chords on the roll first — guitar licks lock to chord roots.' };
  }
  const loopEnd = grooveLabTotalSlots(barCount);
  const hits: GrooveRollHit[] = [];

  const placeAtChordColumn = (colIndex: number, vel: number) => {
    const col = columns[colIndex]!;
    const next = columns[colIndex + 1];
    const slot = snapGrooveSlot(col.slot, opts.quantize, barCount);
    const midi = grooveLabClampGuitarMidi(col.rootMidi);
    const span = next ? next.slot - slot : loopEnd - slot;
    const sustainSlots = snapGrooveSustain(
      slot,
      Math.max(cellStep, Math.min(slotsPerBar, span)),
      opts.quantize,
      barCount,
    );
    hits.push({ slot, midi, sustainSlots, vel });
  };

  if (entry.kind === 'bar') {
    for (let i = 0; i < columns.length; i += 1) {
      placeAtChordColumn(i, 0.88);
    }
  } else {
    placeAtChordColumn(0, 0.9);
  }

  if (hits.length === 0) {
    return { message: 'Could not place guitar lick on the roll.' };
  }

  return {
    chordHits: [],
    bassHits: [],
    barCount,
    steps: [],
    guitarHits: hits,
    lickId: entry.lickId,
  };
}
