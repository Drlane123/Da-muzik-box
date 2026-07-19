/**
 * Live Chord presets — Deep R&B Chords (Geno Build 1).
 * Same progressive quiet-storm / neo-soul packs as SE2 Chord Generator Deep R&B Chords.
 */
import type { ChordMode, ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import { DEEP_RNB_GENRE } from '@/app/lib/creationStation/deepRnbChordProgressions';
import type { Se2SynthGenoLivePresetDef } from '@/app/lib/studio/se2SynthGenoLiveChordPresets';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';

function defs(genreId: Se2SynthGenoLiveGenreId, items: Se2SynthGenoLivePresetDef[]) {
  return items.map((item) => ({ ...item, id: `${genreId}-${item.id}` }));
}

function padLoop(chords: readonly ChordSymbol[], bars = 8): ChordSymbol[] {
  if (chords.length >= bars) return chords.slice(0, bars);
  const out: ChordSymbol[] = [...chords];
  let i = 0;
  while (out.length < bars) {
    out.push(chords[i % chords.length]!);
    i += 1;
  }
  return out;
}

function shortName(progName: string): string {
  return progName.replace(/\s·\s*\d+\s*$/, '').trim();
}

function tagFromName(progName: string): string {
  if (/minor|smoky|liquid/i.test(progName)) return 'minor deep';
  if (/dorian/i.test(progName)) return 'dorian deep';
  if (/13sus|silk/i.test(progName)) return '13sus';
  if (/quiet storm|candle|orchid|velvet/i.test(progName)) return 'quiet storm';
  return 'deep r&b';
}

function bpmFor(progName: string, mode: ChordMode): number {
  if (/quiet storm|candle|velvet|crawl|midnight/i.test(progName)) return 66;
  if (/smoky|liquid|mist/i.test(progName)) return 64;
  if (mode === 'dorian') return 72;
  if (mode === 'minor') return 68;
  return 72;
}

const DEEP_RNB_ITEMS: Se2SynthGenoLivePresetDef[] = DEEP_RNB_GENRE.progressions.map((prog) => {
  const mode = (prog.mode ?? DEEP_RNB_GENRE.mode) as ChordMode;
  const loop = padLoop(prog.chords as ChordSymbol[], 8);
  const name = shortName(prog.name);
  return {
    id: prog.id.replace(/^deeprnb-/, ''),
    name,
    tag: tagFromName(prog.name),
    mode,
    bpm: bpmFor(prog.name, mode),
    romans: loop.slice(0, 4),
    loop,
  };
});

export const SE2_SYNTH_GENO_LIVE_DEEP_RNB_DEFS: Se2SynthGenoLivePresetDef[] = defs(
  'deep-rnb',
  DEEP_RNB_ITEMS,
);
