/**
 * Local chord-roll preview — schedules edited piano-roll notes (not progression steps).
 */
import { GROOVE_LAB_CHORD_MIX_GAIN } from '@/app/lib/creationStation/grooveLabLayers';
import type { ProgressionAuditionOpts } from '@/app/lib/creationStation/grooveLabProgressionPreview';
import { scheduleOrchidChord } from '@/app/lib/creationStation/orchidChordEngine';
import { withProgressionAuditionBus } from '@/app/lib/creationStation/chordSequencerVoices';
import {
  genoLoopPianoSnapBeat,
  type GenoLoopPianoRollNote,
} from '@/app/lib/studio/se2SynthGenoLoopPianoRoll';

export function genoLoopRollTotalBeats(barCount: number, beatsPerBar: number): number {
  return Math.max(1, barCount * Math.max(1, beatsPerBar));
}

type RollNotePick = Pick<GenoLoopPianoRollNote, 'pitch' | 'startBeat' | 'durationBeats' | 'velocity'>;

function groupNotesByStartBeat(notes: readonly RollNotePick[]): Map<number, RollNotePick[]> {
  const groups = new Map<number, RollNotePick[]>();
  for (const n of notes) {
    const key = genoLoopPianoSnapBeat(n.startBeat, 0.25);
    const list = groups.get(key) ?? [];
    list.push(n);
    groups.set(key, list);
  }
  return groups;
}

/** Schedule roll notes from `fromBeat` through loop end; returns audible span in seconds. */
export function scheduleGenoLoopRollAudition(
  ctx: AudioContext,
  notes: readonly RollNotePick[],
  anchorTime: number,
  fromBeat: number,
  totalBeats: number,
  opts: ProgressionAuditionOpts,
): number {
  const secPerBeat = 60 / Math.max(40, opts.bpm);
  const vol = (opts.volume ?? 0.88) * GROOVE_LAB_CHORD_MIX_GAIN;
  const groups = groupNotesByStartBeat(notes);
  const sortedStarts = [...groups.keys()].sort((a, b) => a - b);
  let maxEndBeat = fromBeat;

  for (const startBeat of sortedStarts) {
    if (startBeat < fromBeat - 1e-6) continue;
    const chordNotes = groups.get(startBeat);
    if (!chordNotes?.length) continue;
    const midis = [...new Set(chordNotes.map((n) => Math.round(n.pitch)))].sort((a, b) => a - b);
    const durBeats = Math.max(...chordNotes.map((n) => n.durationBeats));
    const when = anchorTime + (startBeat - fromBeat) * secPerBeat;
    const sustainSec = Math.max(0.12, durBeats * secPerBeat * 0.88);
    scheduleOrchidChord(ctx, midis, when, sustainSec, opts.chordVoice, vol, {
      mode: opts.perfMode,
      bpm: opts.bpm,
    });
    maxEndBeat = Math.max(maxEndBeat, startBeat + durBeats);
  }

  const spanBeats = Math.max(0.25, Math.min(totalBeats, maxEndBeat) - fromBeat);
  return spanBeats * secPerBeat;
}

export function genoLoopRollBeatAtElapsed(
  fromBeat: number,
  elapsedBeats: number,
  totalBeats: number,
  loop: boolean,
): number {
  const raw = fromBeat + elapsedBeats;
  if (!loop || totalBeats <= 0) return Math.min(totalBeats, Math.max(0, raw));
  return ((raw % totalBeats) + totalBeats) % totalBeats;
}

export function genoLoopRollWrapBeat(beat: number, totalBeats: number): number {
  if (totalBeats <= 0) return 0;
  return ((beat % totalBeats) + totalBeats) % totalBeats;
}

const SE2_SYNC_SCHEDULE_AHEAD_SEC = 2.5;
const SE2_SYNC_CHAIN_FLOOR_SEC = 0.008;

/** Lookahead chord hits for SE2-transport-locked roll preview. */
export function refillGenoLoopRollSe2Sync(
  ctx: AudioContext,
  notes: readonly RollNotePick[],
  loopBeat: number,
  totalBeats: number,
  opts: ProgressionAuditionOpts,
  scheduled: Set<string>,
): void {
  if (notes.length === 0 || totalBeats <= 0) return;
  const secPerBeat = 60 / Math.max(40, opts.bpm);
  const vol = (opts.volume ?? 0.88) * GROOVE_LAB_CHORD_MIX_GAIN;
  const now = ctx.currentTime;
  const groups = groupNotesByStartBeat(notes);
  const wrappedBeat = genoLoopRollWrapBeat(loopBeat, totalBeats);

  for (const startBeat of [...groups.keys()].sort((a, b) => a - b)) {
    const chordNotes = groups.get(startBeat);
    if (!chordNotes?.length) continue;
    let deltaBeats = startBeat - wrappedBeat;
    if (deltaBeats < -1e-6) deltaBeats += totalBeats;
    const tOn = now + deltaBeats * secPerBeat;
    if (tOn > now + SE2_SYNC_SCHEDULE_AHEAD_SEC) continue;
    if (tOn < now - 0.08) continue;
    const lap = Math.floor((loopBeat + deltaBeats) / totalBeats);
    const key = `lap${lap}:sb${startBeat}`;
    if (scheduled.has(key)) continue;
    scheduled.add(key);
    const midis = [...new Set(chordNotes.map((n) => Math.round(n.pitch)))].sort((a, b) => a - b);
    const durBeats = Math.max(...chordNotes.map((n) => n.durationBeats));
    const when = Math.max(tOn, now + SE2_SYNC_CHAIN_FLOOR_SEC);
    const sustainSec = Math.max(0.12, durBeats * secPerBeat * 0.88);
    withProgressionAuditionBus(ctx, () => {
      scheduleOrchidChord(ctx, midis, when, sustainSec, opts.chordVoice, vol, {
        mode: opts.perfMode,
        bpm: opts.bpm,
      });
    });
  }
}
