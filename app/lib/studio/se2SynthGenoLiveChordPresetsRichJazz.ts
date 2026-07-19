/**
 * Live Chord presets — Rich Jazz · Neo (Geno Build 1).
 * Same building-block progressions as SE2 Chord Generator Rich Jazz · Neo:
 * lush maj9 / m9 / 13 / ø7, 70s soul jazz, neo-jazz, dark jazz, gospel jazz.
 */
import type { ChordMode, ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import { RICH_JAZZ_GENRE } from '@/app/lib/creationStation/richJazzChordProgressions';
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
  if (progName.startsWith('70s')) return '70s soul';
  if (progName.startsWith('Neo')) return 'neo jazz';
  if (progName.startsWith('Dark')) return 'dark jazz';
  if (progName.startsWith('Gospel')) return 'gospel jazz';
  return 'rich jazz';
}

function bpmFor(progName: string, mode: ChordMode): number {
  if (/ballad|mist|candle|quiet storm/i.test(progName)) return 72;
  if (progName.startsWith('Dark')) return 78;
  if (progName.startsWith('70s')) return 88;
  if (progName.startsWith('Gospel')) return 94;
  if (progName.startsWith('Neo') || mode === 'dorian') return 84;
  if (/bebop|rhythm/i.test(progName)) return 118;
  return 96;
}

const RICH_JAZZ_ITEMS: Se2SynthGenoLivePresetDef[] = RICH_JAZZ_GENRE.progressions.map((prog) => {
  const mode = (prog.mode ?? RICH_JAZZ_GENRE.mode) as ChordMode;
  const loop = padLoop(prog.chords, 8);
  const name = shortName(prog.name);
  return {
    id: prog.id.replace(/^rjazz-/, ''),
    name,
    tag: tagFromName(prog.name),
    mode,
    bpm: bpmFor(prog.name, mode),
    romans: loop.slice(0, 4),
    loop,
  };
});

export const SE2_SYNTH_GENO_LIVE_RICH_JAZZ_DEFS: Se2SynthGenoLivePresetDef[] = defs(
  'rich-jazz',
  RICH_JAZZ_ITEMS,
);
