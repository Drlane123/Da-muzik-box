/**
 * Studio Editor 2 — per-MIDI-channel instrument catalog (UI + future playback routing).
 * Sources: GM soundfont (Beat Lab), 808 bass engine (Groove Lab), synth presets (Beat Lab CH 17–32).
 */

import { BEAT_LAB_MELODIC_INSTRUMENT_OPTIONS } from '@/app/lib/creationStation/beatLabMelodicSoundfont';
import { BEAT_LAB_BASS_SYNTH_PRESETS } from '@/app/lib/creationStation/beatLabMelodicSynthPresets';
import {
  GROOVE_LAB_808_SUBROOT_SOUND_IDS,
  GROOVE_LAB_BASS_SOUNDS,
} from '@/app/lib/creationStation/grooveLabBassSounds';
import { BAKED_ORCHESTRA_HIT_MANIFEST } from '@/app/lib/creationStation/grooveLabOrchestraHitBank';
import {
  studioGrooveLeadSoundLabel,
  studioParseGrooveLeadInstrumentId,
  studioParseOrchestraHitInstrumentId,
} from '@/app/lib/studio/studioInstrumentHarmony';
import { loadedOrchestraHitLabelById } from '@/app/lib/creationStation/grooveLabOrchestraHitBank';

export type StudioMidiInstrumentCategory = 'instrument' | 'bass' | 'drums' | 'synth';

export type StudioMidiInstrumentSource = 'gm' | 'synth' | 'bass808' | 'drums' | 'orchHit';

export type StudioMidiInstrumentOption = {
  id: string;
  label: string;
  category: StudioMidiInstrumentCategory;
  subgroup: string;
  source: StudioMidiInstrumentSource;
};

export const STUDIO_MIDI_CATEGORY_LABELS: Record<StudioMidiInstrumentCategory, string> = {
  instrument: 'Instrument',
  bass: 'Bass',
  drums: 'Drums',
  synth: 'Synth',
};

export const STUDIO_MIDI_CATEGORY_ORDER: StudioMidiInstrumentCategory[] = [
  'instrument',
  'bass',
  'drums',
  'synth',
];

const BASS_GM_GROUPS = new Set(['Bass']);
const SYNTH_GM_GROUPS = new Set(['Synth']);

const DRUM_KIT_OPTIONS: { id: string; label: string }[] = [
  { id: 'gm:standard_drums', label: 'Standard Kit' },
  { id: 'gm:room_drums', label: 'Room Kit' },
  { id: 'gm:power_drums', label: 'Power Kit' },
  { id: 'gm:electronic_drums', label: 'Electronic Kit' },
  { id: 'gm:hiphop_drums', label: 'Hip-Hop Kit' },
  { id: 'gm:trap_drums', label: 'Trap Kit' },
];

function buildStudioMidiInstrumentCatalog(): StudioMidiInstrumentOption[] {
  const out: StudioMidiInstrumentOption[] = [];

  for (const hit of BAKED_ORCHESTRA_HIT_MANIFEST) {
    out.push({
      id: `orchHit:${hit.id}`,
      label: hit.label,
      category: 'instrument',
      subgroup: hit.pickerSubgroup ?? 'Cinematic / Orchestra',
      source: 'orchHit',
    });
  }

  for (const opt of BEAT_LAB_MELODIC_INSTRUMENT_OPTIONS) {
    if (BASS_GM_GROUPS.has(opt.group) || SYNTH_GM_GROUPS.has(opt.group)) continue;
    out.push({
      id: `gm:${opt.id}`,
      label: opt.label,
      category: 'instrument',
      subgroup: opt.group,
      source: 'gm',
    });
  }

  for (const opt of BEAT_LAB_MELODIC_INSTRUMENT_OPTIONS) {
    if (!BASS_GM_GROUPS.has(opt.group)) continue;
    out.push({
      id: `gm:${opt.id}`,
      label: opt.label,
      category: 'bass',
      subgroup: 'GM Bass',
      source: 'gm',
    });
  }

  for (const s of GROOVE_LAB_BASS_SOUNDS) {
    out.push({
      id: `bass808:${s.id}`,
      label: s.label,
      category: 'bass',
      subgroup: '808 / Sub',
      source: 'bass808',
    });
  }

  for (const d of DRUM_KIT_OPTIONS) {
    out.push({
      id: d.id,
      label: d.label,
      category: 'drums',
      subgroup: 'Drum Kits',
      source: 'drums',
    });
  }

  for (const opt of BEAT_LAB_MELODIC_INSTRUMENT_OPTIONS) {
    if (!SYNTH_GM_GROUPS.has(opt.group)) continue;
    out.push({
      id: `gm:${opt.id}`,
      label: opt.label,
      category: 'synth',
      subgroup: 'GM Synth',
      source: 'gm',
    });
  }

  for (const p of BEAT_LAB_BASS_SYNTH_PRESETS) {
    out.push({
      id: `synth:${p.id}`,
      label: p.name,
      category: 'synth',
      subgroup: 'Synth Engine',
      source: 'synth',
    });
  }

  return out;
}

export const STUDIO_MIDI_INSTRUMENT_CATALOG: readonly StudioMidiInstrumentOption[] =
  buildStudioMidiInstrumentCatalog();

const catalogById = new Map(STUDIO_MIDI_INSTRUMENT_CATALOG.map((o) => [o.id, o]));

export const STUDIO_MIDI_DEFAULT_INSTRUMENT_ID = 'gm:acoustic_grand_piano';

export const STUDIO_DRUM_TRACK_DEFAULT_INSTRUMENT_ID = 'gm:standard_drums';

const DRUM_TRACK_808_SUB_IDS = new Set(
  GROOVE_LAB_808_SUBROOT_SOUND_IDS.map((id) => `bass808:${id}`),
);

/** Drum lanes: GM drum kits + 808 sub roots only (no keys, GM bass, synth, etc.). */
export function studioMidiInstrumentAllowedOnDrumTrack(opt: StudioMidiInstrumentOption): boolean {
  if (opt.category === 'drums') return true;
  return opt.source === 'bass808' && DRUM_TRACK_808_SUB_IDS.has(opt.id);
}

/** Demo lane names → default timbre (Instrument / Bass / Drums rows). */
export const STUDIO_MIDI_SEED_INSTRUMENT_BY_TRACK_NAME: Record<string, string> = {
  Instrument: 'gm:acoustic_grand_piano',
  Bass: 'bass808:trapLowBass',
  Drums: 'gm:standard_drums',
};

export function studioMidiInstrumentOption(id: string): StudioMidiInstrumentOption | undefined {
  return catalogById.get(id);
}

export function studioMidiInstrumentLabel(id: string | undefined): string {
  if (!id) return 'Grand Piano';
  const cat = catalogById.get(id);
  if (cat) return cat.label;
  const orch = studioParseOrchestraHitInstrumentId(id);
  if (orch) return loadedOrchestraHitLabelById(orch) ?? orch;
  const lead = studioParseGrooveLeadInstrumentId(id);
  if (lead) return studioGrooveLeadSoundLabel(lead);
  return id.replace(/^(gm|synth|bass808|orchHit|grooveLead):/, '');
}

export function studioNormalizeMidiInstrumentId(raw: string | undefined): string {
  if (raw && catalogById.has(raw)) return raw;
  if (raw && studioParseOrchestraHitInstrumentId(raw)) return raw;
  if (raw && studioParseGrooveLeadInstrumentId(raw)) return raw;
  return STUDIO_MIDI_DEFAULT_INSTRUMENT_ID;
}

export function studioDefaultMidiInstrumentForTrackName(trackName: string): string {
  const seed = STUDIO_MIDI_SEED_INSTRUMENT_BY_TRACK_NAME[trackName.trim()];
  if (seed && catalogById.has(seed)) return seed;
  return STUDIO_MIDI_DEFAULT_INSTRUMENT_ID;
}

function studioMidiInstrumentsGroupedFromCatalog(
  catalog: readonly StudioMidiInstrumentOption[],
  categoryOrder: readonly StudioMidiInstrumentCategory[],
): Array<{
  category: StudioMidiInstrumentCategory;
  label: string;
  subgroups: Array<{ subgroup: string; options: StudioMidiInstrumentOption[] }>;
}> {
  const byCat = new Map<StudioMidiInstrumentCategory, Map<string, StudioMidiInstrumentOption[]>>();
  for (const opt of catalog) {
    let subMap = byCat.get(opt.category);
    if (!subMap) {
      subMap = new Map();
      byCat.set(opt.category, subMap);
    }
    const prev = subMap.get(opt.subgroup) ?? [];
    subMap.set(opt.subgroup, [...prev, opt]);
  }
  return categoryOrder.filter((c) => byCat.has(c)).map((category) => {
    const subMap = byCat.get(category)!;
    return {
      category,
      label: STUDIO_MIDI_CATEGORY_LABELS[category],
      subgroups: [...subMap.entries()].map(([subgroup, options]) => ({ subgroup, options })),
    };
  });
}

export function studioMidiInstrumentsGrouped(): Array<{
  category: StudioMidiInstrumentCategory;
  label: string;
  subgroups: Array<{ subgroup: string; options: StudioMidiInstrumentOption[] }>;
}> {
  return studioMidiInstrumentsGroupedFromCatalog(
    STUDIO_MIDI_INSTRUMENT_CATALOG,
    STUDIO_MIDI_CATEGORY_ORDER,
  );
}

/** Instrument picker on drum tracks — kits first, then 808 / sub roots. */
export function studioMidiInstrumentsGroupedForDrumTrack(): Array<{
  category: StudioMidiInstrumentCategory;
  label: string;
  subgroups: Array<{ subgroup: string; options: StudioMidiInstrumentOption[] }>;
}> {
  const drumCatalog = STUDIO_MIDI_INSTRUMENT_CATALOG.filter(studioMidiInstrumentAllowedOnDrumTrack);
  return studioMidiInstrumentsGroupedFromCatalog(drumCatalog, ['drums', 'bass']);
}

export function studioNormalizeMidiInstrumentIdForDrumTrack(raw: string | undefined): string {
  if (raw && catalogById.has(raw)) {
    const opt = catalogById.get(raw)!;
    if (studioMidiInstrumentAllowedOnDrumTrack(opt)) return raw;
  }
  return STUDIO_DRUM_TRACK_DEFAULT_INSTRUMENT_ID;
}
