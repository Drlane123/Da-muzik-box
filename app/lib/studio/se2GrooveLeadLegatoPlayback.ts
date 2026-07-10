/**
 * Groove Lead roll scheduler — polyphonic back-to-back (Geno B01).
 * Notes sit right behind one another with a tiny breath gap; no mono choke clash.
 */
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import { grooveLeadCollapseDuplicatePitches } from '@/app/lib/studio/se2GrooveLeadMelodicFlow';
import { scheduleSe2GrooveLeadNote } from '@/app/lib/studio/se2GrooveLeadPreview';
import type { Se2GrooveLeadVoiceParams } from '@/app/lib/studio/se2GrooveLeadTypes';

export type GrooveLeadLegatoScheduleOpts = {
  ctx: AudioContext;
  stripIn: AudioNode;
  sessionStartSec: number;
  bpm: number;
  notes: readonly StudioEditor2GenNote[];
  voice: Se2GrooveLeadVoiceParams;
  trackIndex: number;
  /** Preview gain multiplier (default 1). */
  gainMul?: number;
};

/** @deprecated Mono legato overlap — use scheduleSe2GrooveLeadPolyRoll for B01. */
const LEGATO_ON_RATIO = 0.9;

/** @deprecated Playback start beats for mono legato glide overlap. */
export function grooveLeadLegatoPlayStartBeats(notes: readonly StudioEditor2GenNote[]): number[] {
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  const starts: number[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i === 0) {
      starts.push(sorted[i]!.startBeat);
    } else {
      const prev = sorted[i - 1]!;
      starts.push(prev.startBeat + prev.durationBeats * LEGATO_ON_RATIO);
    }
  }
  return starts;
}

/** Polyphonic roll — respects sustain durations from the generator (long holds + short fills). */
export function scheduleSe2GrooveLeadPolyRoll(opts: GrooveLeadLegatoScheduleOpts): void {
  const spb = 60 / Math.max(40, opts.bpm);
  const collapsed = grooveLeadCollapseDuplicatePitches(opts.notes);
  const sorted = [...collapsed].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  if (sorted.length === 0) return;
  const gainMul = opts.gainMul ?? 1;

  for (let i = 0; i < sorted.length; i += 1) {
    const cur = sorted[i]!;
    const when = opts.sessionStartSec + cur.startBeat * spb;
    const holdBeats = Math.max(0.12, cur.durationBeats);
    const vel = Math.max(1, Math.min(127, Math.round(cur.velocity * gainMul)));

    scheduleSe2GrooveLeadNote(
      opts.ctx,
      opts.stripIn,
      when,
      when + holdBeats * spb,
      cur.pitch,
      vel,
      opts.voice,
      opts.trackIndex,
      opts.bpm,
      cur.attackSec,
      true,
    );
  }
}

/** @deprecated Mono legato overlap roll — clashes when notes overlap. Prefer poly roll. */
export function scheduleSe2GrooveLeadLegatoRoll(
  opts: GrooveLeadLegatoScheduleOpts,
  rnd: () => number = Math.random,
): void {
  scheduleSe2GrooveLeadPolyRoll(opts);
  void rnd;
}
