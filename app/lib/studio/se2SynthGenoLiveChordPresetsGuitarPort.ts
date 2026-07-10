/**
 * Geno Build 1 — SE2 Guitar strummer progressions ported as Live Chord presets.
 * Roman numerals are key-relative (transpose with the lane key).
 */
import type { ChordMode, ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import type { Se2SynthGenoLivePresetDef } from '@/app/lib/studio/se2SynthGenoLiveChordPresets';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import { SE2_GUITAR_PROGRESSIONS } from '@/app/lib/studio/se2GuitarProgressions';

type GuitarPortMeta = {
  mode: ChordMode;
  romans: readonly ChordSymbol[];
  loop?: readonly ChordSymbol[];
  bpm?: number;
};

/** Hand-mapped from SE2 guitar progression cards — matches strummer harmony. */
const GUITAR_PORT_ROMANS: Record<string, GuitarPortMeta> = {
  pop_1564: { mode: 'major', romans: ['Imaj7', 'V7', 'vi7', 'IVmaj7'] },
  pop_6415: { mode: 'major', romans: ['vi7', 'IVmaj7', 'Imaj7', 'V7'] },
  pop_1625: { mode: 'major', romans: ['Imaj7', 'vi7', 'ii7', 'V7'] },
  rnb_2516: { mode: 'major', romans: ['ii7', 'V7', 'Imaj7', 'vi7'] },
  rnb_gospel: { mode: 'major', romans: ['Imaj7', 'IVmaj7', 'vi7', 'V7'] },
  rnb_neo: { mode: 'minor', romans: ['i7', 'IV9', 'bVIImaj7', 'IIImaj7'], bpm: 82 },
  pop_edm: { mode: 'major', romans: ['vi7', 'IVmaj7', 'Imaj7', 'V7'], bpm: 128 },
  pop_indie: { mode: 'minor', romans: ['i7', 'bVImaj7', 'bIIImaj7', 'bVII7'] },
  pop_top40: { mode: 'major', romans: ['Imaj7', 'V7', 'vi7', 'IVmaj7'], bpm: 118 },
  rnb_90s: { mode: 'major', romans: ['Imaj7', 'bVIImaj7', 'IVmaj7', 'Imaj7'], bpm: 88 },
  soul_ballad: { mode: 'major', romans: ['Imaj9', 'vi9', 'IVmaj9', 'V13'], bpm: 72 },
  country_pop: { mode: 'major', romans: ['Imaj7', 'IVmaj7', 'vi7', 'V7'], bpm: 104 },
  pop_standby: { mode: 'major', romans: ['Imaj7', 'IVmaj7', 'vi7', 'V7'] },
  pop_iveiv: { mode: 'major', romans: ['Imaj7', 'V7', 'IVmaj7', 'V7'], bpm: 120 },
  pop_ivvivi: { mode: 'major', romans: ['IVmaj7', 'V7', 'vi7', 'Imaj7'] },
  pop_iviii: { mode: 'major', romans: ['IVmaj7', 'V7', 'iii7', 'vi7'] },
  pop_viiviii: { mode: 'major', romans: ['vi7', 'IVmaj7', 'Imaj7', 'V7'] },
  pop_iiivi: { mode: 'major', romans: ['iii7', 'vi7', 'IVmaj7', 'Imaj7'] },
  pop_iiviv: { mode: 'major', romans: ['Imaj7', 'ii7', 'vi7', 'V7'] },
  pop_vivvi: { mode: 'major', romans: ['vi7', 'Imaj7', 'IVmaj7', 'V7'] },
  pop_ivivi: { mode: 'major', romans: ['IVmaj7', 'Imaj7', 'V7', 'vi7'] },
  pop_iveii: { mode: 'major', romans: ['Imaj7', 'V7', 'ii7', 'V7'] },
  pop_worship: { mode: 'major', romans: ['Imaj7', 'V7', 'vi7', 'IVmaj7'], bpm: 76 },
  pop_duet: { mode: 'major', romans: ['Imaj7', 'iii7', 'vi7', 'IVmaj7'] },
  rnb_mary: { mode: 'major', romans: ['Imaj7', 'vi7', 'IVmaj7', 'V6'], bpm: 84 },
  rnb_coltrane: { mode: 'major', romans: ['iii7', 'VI7', 'ii7', 'V7'] },
  rnb_sade: { mode: 'major', romans: ['vi7', 'ii9', 'V7', 'Imaj7'], bpm: 78 },
  rnb_dangelo: { mode: 'minor', romans: ['ii9', 'iii7', 'vi9', 'bVIImaj7'], bpm: 80 },
  rnb_beyonce: { mode: 'major', romans: ['vi7', 'IVmaj7', 'ii7', 'V7'] },
  rnb_usher: { mode: 'major', romans: ['Imaj7', 'Vmaj7', 'vi7', 'IVmaj7'], bpm: 100 },
  rnb_stevie: { mode: 'major', romans: ['Imaj7', 'IVmaj7', 'Vmaj7', 'IVmaj7'] },
  rnb_passing: { mode: 'major', romans: ['Imaj7', 'vi7', 'ii9', 'V7'] },
  rnb_morning: { mode: 'major', romans: ['vi7', 'IVmaj7', 'ii7', 'V7'] },
  rnb_frank: { mode: 'major', romans: ['Imaj7', 'IVmaj7', 'ii9', 'V7'], bpm: 70 },
  rnb_gospel_walk: { mode: 'major', romans: ['Imaj7', 'IVmaj7', 'Imaj7', 'V7'] },
  rnb_minor_plagal: { mode: 'major', romans: ['vi9', 'IVmaj7', 'Imaj7', 'V6'] },
};

function loopFromProgression(id: string, romans4: readonly ChordSymbol[]): ChordSymbol[] {
  const meta = GUITAR_PORT_ROMANS[id];
  if (meta?.loop) return [...meta.loop];
  const prog = SE2_GUITAR_PROGRESSIONS.find((p) => p.id === id);
  if (prog?.chords8) {
    const tail = GUITAR_PORT_ROMANS[id];
    if (tail && romans4.length === 4) {
      return [...romans4, ...romans4];
    }
  }
  return [...romans4, ...romans4];
}

function guitarPortName(label: string, hint: string): string {
  if (!label.includes('–') && !label.includes('-') && label.length < 24) return label;
  const short = hint.split('—')[0]?.split(' - ')[0]?.trim();
  return short && short.length < 28 ? short : label.replace(/[–-]/g, ' ').slice(0, 24);
}

function defs(genreId: Se2SynthGenoLiveGenreId, items: Se2SynthGenoLivePresetDef[]): Se2SynthGenoLivePresetDef[] {
  return items.map((item) => ({ ...item, id: `${genreId}-${item.id}` }));
}

export const SE2_SYNTH_GENO_LIVE_GUITAR_LINES_DEFS: Se2SynthGenoLivePresetDef[] = defs(
  'guitar-lines',
  SE2_GUITAR_PROGRESSIONS.map((prog) => {
    const meta = GUITAR_PORT_ROMANS[prog.id] ?? {
      mode: 'major' as ChordMode,
      romans: ['Imaj7', 'V7', 'vi7', 'IVmaj7'] as ChordSymbol[],
    };
    const romans = [...meta.romans] as ChordSymbol[];
    return {
      id: prog.id,
      name: guitarPortName(prog.label, prog.hint),
      tag: prog.label,
      mode: meta.mode,
      romans,
      loop: loopFromProgression(prog.id, romans),
      bpm: meta.bpm,
    };
  }),
);
