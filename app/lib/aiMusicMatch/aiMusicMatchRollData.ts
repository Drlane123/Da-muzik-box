/**
 * Lightweight roll data for AI Music Match — Groove Lab hits only, no SE2 Geno engine.
 */
import {
  buildGrooveLabMatchSession,
  type AiMatchGenre,
  type AiMatchMood,
} from '@/app/lib/aiMusicMatch/aiMusicMatch';
import {
  chordSymbolToName,
  type ChordMode,
  type ChordSymbol,
} from '@/app/lib/creationStation/chordBuilder';
import { grooveLabIsBassSubMidi } from '@/app/lib/creationStation/grooveComposerEngine';
import {
  expandProgressionToBars,
  type MelodyProgressionCandidate,
} from '@/app/lib/creationStation/melodyToChordProgression';
import {
  GROOVE_LAB_SLOTS_PER_BAR,
  grooveLabPickChordChannel,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';

export type MatchLoopBarCount = 4 | 8;

export type MatchRollBar = {
  bar: number;
  roman: string;
  chordName: string;
};

export type MatchRollNote = {
  lane: 'chord' | 'bass';
  startBeat: number;
  durationBeats: number;
  midi: number;
};

const PLACEHOLDER_CHORDS: ChordSymbol[] = ['I', 'V', 'vi', 'IV'];

export function coerceMatchLoopBars(n: number): MatchLoopBarCount {
  if (n <= 4) return 4;
  return 8;
}

function slotToBeat(slot: number): number {
  return (slot / GROOVE_LAB_SLOTS_PER_BAR) * 4;
}

function hitsToNotes(hits: readonly GrooveRollHit[]): MatchRollNote[] {
  const notes: MatchRollNote[] = [];
  for (const h of hits) {
    notes.push({
      lane: grooveLabIsBassSubMidi(h.midi) ? 'bass' : 'chord',
      startBeat: slotToBeat(h.slot),
      durationBeats: Math.max(0.25, (h.sustainSlots / GROOVE_LAB_SLOTS_PER_BAR) * 4),
      midi: h.midi,
    });
  }
  return notes;
}

export function buildMatchRollBars(
  chords: readonly ChordSymbol[],
  barCount: MatchLoopBarCount,
  keyRoot: number,
  mode: ChordMode,
): MatchRollBar[] {
  const tiled = expandProgressionToBars(chords, barCount);
  return tiled.map((sym, bar) => ({
    bar,
    roman: sym,
    chordName: chordSymbolToName(sym, keyRoot, mode),
  }));
}

export function buildMatchRollData(opts: {
  candidate: MelodyProgressionCandidate;
  keyRoot: number;
  mode: ChordMode;
  barCount: MatchLoopBarCount;
  genre: AiMatchGenre;
  mood: AiMatchMood;
}): { bars: MatchRollBar[]; notes: MatchRollNote[] } | null {
  const built = buildGrooveLabMatchSession({
    candidate: opts.candidate,
    keyRoot: opts.keyRoot,
    mode: opts.mode,
    barCount: opts.barCount,
    genre: opts.genre,
    mood: opts.mood,
  });
  if ('message' in built) return null;

  const ch = grooveLabPickChordChannel();
  const merged = built.notesByChannel[ch] ?? [];
  const chordHits = merged.filter((h) => !grooveLabIsBassSubMidi(h.midi));
  const bassHits = merged.filter((h) => grooveLabIsBassSubMidi(h.midi));

  return {
    bars: buildMatchRollBars(opts.candidate.chords, opts.barCount, opts.keyRoot, opts.mode),
    notes: [...hitsToNotes(chordHits), ...hitsToNotes(bassHits)],
  };
}

/** Instant grid — no Groove Lab session build (avoids main-thread freeze on upload). */
export function buildStaticPlaceholderRollData(
  keyRoot: number,
  mode: ChordMode,
  barCount: MatchLoopBarCount,
): { bars: MatchRollBar[]; notes: MatchRollNote[] } {
  const bars = buildMatchRollBars(PLACEHOLDER_CHORDS, barCount, keyRoot, mode);
  const notes: MatchRollNote[] = [];
  for (let bar = 0; bar < barCount; bar++) {
    const beat = bar * 4;
    notes.push({ lane: 'chord', startBeat: beat, durationBeats: 3.5, midi: 60 + (bar % 4) });
    notes.push({ lane: 'bass', startBeat: beat, durationBeats: 3.5, midi: 36 + (bar % 4) });
  }
  return { bars, notes };
}

export function buildPlaceholderRollData(
  keyRoot: number,
  mode: ChordMode,
  barCount: MatchLoopBarCount,
  genre: AiMatchGenre,
  mood: AiMatchMood,
): { bars: MatchRollBar[]; notes: MatchRollNote[] } {
  return buildStaticPlaceholderRollData(keyRoot, mode, barCount);
}
