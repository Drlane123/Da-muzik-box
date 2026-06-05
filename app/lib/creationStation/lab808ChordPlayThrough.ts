/**
 * When 808 chord lock is on, pad hits / transport roots can also audition the locked
 * harmony source (Chord Builder, Groove Lab roll chords, New Synth) — same AudioContext.
 */
import type { ChordMode, ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import { chordSymbolToMidi, coerceChordSymbolForMode } from '@/app/lib/creationStation/chordBuilder';
import {
  buildOrchidNotesForBassRoot,
  scheduleOrchidChord,
} from '@/app/lib/creationStation/orchidChordEngine';
import type { ChordVoiceId } from '@/app/lib/creationStation/chordSequencerVoices';
import { withGrooveLabTransportChordRouting } from '@/app/lib/creationStation/chordSequencerVoices';
import { resolveGrooveLabChannelDest } from '@/app/lib/creationStation/grooveLabAudio';
import { GROOVE_LAB_CHORD_MIX_GAIN } from '@/app/lib/creationStation/grooveLabLayers';
import {
  grooveLabChordStackAtBeat,
  readBeatLabSynthChordRailSync,
  type Lab808ChordLockSource,
} from '@/app/lib/creationStation/lab808ChordLockSources';
import type { Lab808ProgressionRoot } from '@/app/lib/creationStation/lab808ChordRoots';
import { grooveLabPickChordChannel } from '@/app/lib/creationStation/grooveLabRoll';
import { grooveLabSlotsPerBeat } from '@/app/lib/creationStation/grooveLabTransport';
import { readChordSync } from '@/app/lib/chordBuilderSync';

const DEFAULT_VOICE: ChordVoiceId = 'stringPad';

function chordNotesForRoot(
  root: Lab808ProgressionRoot,
  source: Lab808ChordLockSource,
): number[] {
  if (source === 'chord-builder') {
    const sync = readChordSync();
    if (sync && root.chord && root.chord !== '·') {
      const sym = coerceChordSymbolForMode(root.chord as ChordSymbol, sync.mode as ChordMode);
      const midis = chordSymbolToMidi(sym, sync.keyRoot, sync.mode as ChordMode, Math.floor(root.midi / 12) - 1);
      if (midis?.length) return midis;
    }
  }
  if (source === 'new-synth') {
    const rail = readBeatLabSynthChordRailSync();
    if (rail && root.chord && root.chord !== '·') {
      const sym = coerceChordSymbolForMode(root.chord as ChordSymbol, rail.mode);
      const midis = chordSymbolToMidi(sym, rail.keyRoot, rail.mode, Math.floor(root.midi / 12) - 1);
      if (midis?.length) return midis;
    }
  }
  return buildOrchidNotesForBassRoot(root.midi, 'maj', new Set(), 0);
}

function scheduleGrooveLabChordStack(
  ctx: AudioContext,
  when: number,
  startBeat: number,
  opts?: { bpm?: number; velocity?: number; holdBeats?: number },
): void {
  const stack = grooveLabChordStackAtBeat(startBeat);
  if (!stack?.midis.length) return;
  const bpm = Math.max(40, opts?.bpm ?? 120);
  const spb = grooveLabSlotsPerBeat();
  const durBeats = Math.max(0.5, opts?.holdBeats ?? stack.sustainSlots / spb);
  const sustainSec = (durBeats / bpm) * 60;
  const vel = Math.max(0.05, Math.min(1, (opts?.velocity ?? 0.88) * GROOVE_LAB_CHORD_MIX_GAIN));
  const chordCh = grooveLabPickChordChannel();
  const scheduleChord = () =>
    scheduleOrchidChord(ctx, stack.midis, when, sustainSec, DEFAULT_VOICE, vel, { mode: 'block', bpm });
  const chordDest = resolveGrooveLabChannelDest(ctx, chordCh, undefined);
  withGrooveLabTransportChordRouting(ctx, scheduleChord, chordDest);
}

export function auditionLab808LockedSourceChord(
  ctx: AudioContext,
  when: number,
  root: Lab808ProgressionRoot,
  source: Lab808ChordLockSource,
  opts?: { bpm?: number; velocity?: number; holdBeats?: number },
): void {
  const notes = chordNotesForRoot(root, source);
  if (notes.length === 0) return;
  const bpm = Math.max(40, opts?.bpm ?? 120);
  const holdBeats = Math.max(0.5, opts?.holdBeats ?? 2);
  const sustainSec = (holdBeats / bpm) * 60;
  const vel = Math.max(0.05, Math.min(1, opts?.velocity ?? 0.72));
  scheduleOrchidChord(ctx, notes, when, sustainSec, DEFAULT_VOICE, vel, { mode: 'block' });
}

/** Audition locked harmony while 808 kick/bass fires (Groove roll chords or Orchid stack). */
export function auditionLab808LockedHarmony(
  ctx: AudioContext,
  when: number,
  root: Lab808ProgressionRoot,
  source: Lab808ChordLockSource,
  opts?: { bpm?: number; velocity?: number; holdBeats?: number },
): void {
  if (source === 'groove-lab') {
    scheduleGrooveLabChordStack(ctx, when, root.startBeat, opts);
    return;
  }
  auditionLab808LockedSourceChord(ctx, when, root, source, opts);
}

