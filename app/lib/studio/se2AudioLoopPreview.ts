/** SE2 transport loop — audible slice of an audio clip inside `[loopStart, loopEnd)`. */

export type Se2AudioClipLoopSegment = {
  segStartBeat: number;
  segEndBeat: number;
  sourceOffsetBeats: number;
};

export type Se2AudioClipLoopOccurrence = {
  occurrenceStartBeat: number;
  segStartBeat: number;
  segEndBeat: number;
  sourceOffsetBeats: number;
  tOn: number;
  tOff: number;
  repeatInLap: number;
};

export function se2AudioClipLoopSegment(args: {
  clipStartBeat: number;
  clipDurationBeats: number;
  sourceOffsetBeats: number;
  loopStartBeat: number;
  loopEndBeat: number;
}): Se2AudioClipLoopSegment | null {
  const clipEnd = args.clipStartBeat + args.clipDurationBeats;
  const segStartBeat = Math.max(args.clipStartBeat, args.loopStartBeat);
  const segEndBeat = Math.min(clipEnd, args.loopEndBeat);
  if (segEndBeat <= segStartBeat + 1e-6) return null;
  return {
    segStartBeat,
    segEndBeat,
    sourceOffsetBeats: args.sourceOffsetBeats + (segStartBeat - args.clipStartBeat),
  };
}

export function se2AudioClipIntersectsLoopRegion(args: {
  clipStartBeat: number;
  clipDurationBeats: number;
  loopStartBeat: number;
  loopEndBeat: number;
}): boolean {
  const clipEnd = args.clipStartBeat + args.clipDurationBeats;
  const span = args.loopEndBeat - args.loopStartBeat;
  return span > 1e-6 && args.clipStartBeat < args.loopEndBeat && clipEnd > args.loopStartBeat;
}

/** One WAAPI loop lap — dedupe per clip + repeat index (mirrors MIDI lap keys). */
export function se2AudioClipPreviewScheduleKeyLoopLap(
  loopLap: number,
  trackId: string,
  clipId: string,
  repeatInLap: number,
  timeStretchAlign: boolean,
): string {
  return `lap${loopLap}:audio:${trackId}:${clipId}:r${repeatInLap}:align${timeStretchAlign ? 1 : 0}`;
}

export function se2AudioPreviewPurgeLoopLapKeys(scheduled: Set<string>, lapIndex: number): void {
  const prefix = `lap${lapIndex}:audio:`;
  for (const key of [...scheduled]) {
    if (key.startsWith(prefix)) scheduled.delete(key);
  }
}

/**
 * Loop-region clips: every repeat whose wrapped onset falls in the lookahead window.
 * Non-loop: single full-clip occurrence (same contract as pre-loop scheduling).
 */
export function se2AudioClipLoopOccurrences(args: {
  clipStartBeat: number;
  clipDurationBeats: number;
  sourceOffsetBeats: number;
  originBeat: number;
  sessionStart: number;
  spb: number;
  ctSnap: number;
  horizon: number;
  loopOn: boolean;
  loopStartBeat: number;
  loopEndBeat: number;
}): Se2AudioClipLoopOccurrence[] {
  const {
    clipStartBeat,
    clipDurationBeats,
    sourceOffsetBeats,
    originBeat,
    sessionStart,
    spb,
    ctSnap,
    horizon,
    loopOn,
    loopStartBeat,
    loopEndBeat,
  } = args;

  const loopCatchUpSec = 0.15;
  const pastCutoff = ctSnap - (loopOn ? loopCatchUpSec : 0.02);
  const loopSpan = loopEndBeat - loopStartBeat;

  if (loopOn && loopSpan > 1e-6) {
    const seg = se2AudioClipLoopSegment({
      clipStartBeat,
      clipDurationBeats,
      sourceOffsetBeats,
      loopStartBeat,
      loopEndBeat,
    });
    if (!seg) return [];

    const segDurBeats = seg.segEndBeat - seg.segStartBeat;
    const durSec = Math.max(0.04, segDurBeats * spb);
    const segOffset = seg.segStartBeat - loopStartBeat;
    const beatNow =
      sessionStart > 0 ? originBeat + Math.max(0, ctSnap - sessionStart) / spb : loopStartBeat;

    const out: Se2AudioClipLoopOccurrence[] = [];
    let repeatInLap = Math.max(
      0,
      Math.floor((beatNow - loopStartBeat - segOffset) / loopSpan + 1e-9),
    );
    const maxRepeatInLap = 512;
    while (repeatInLap < maxRepeatInLap) {
      const occurrenceStartBeat = loopStartBeat + segOffset + repeatInLap * loopSpan;
      if (occurrenceStartBeat >= loopEndBeat - 1e-6) {
        repeatInLap += 1;
        continue;
      }
      const tOn = sessionStart + (occurrenceStartBeat - originBeat) * spb;
      if (tOn > horizon + 1e-6) break;
      const tOff = tOn + durSec;
      const isLoopDownbeat = segOffset < 1e-6;
      const schedulable =
        tOff >= pastCutoff ||
        tOn >= ctSnap - loopCatchUpSec ||
        (isLoopDownbeat &&
          repeatInLap ===
            Math.max(0, Math.floor((beatNow - loopStartBeat) / loopSpan + 1e-9)));
      if (schedulable) {
        out.push({
          occurrenceStartBeat,
          segStartBeat: seg.segStartBeat,
          segEndBeat: seg.segEndBeat,
          sourceOffsetBeats: seg.sourceOffsetBeats,
          tOn,
          tOff,
          repeatInLap,
        });
      }
      repeatInLap += 1;
    }
    return out;
  }

  const tOn = sessionStart + (clipStartBeat - originBeat) * spb;
  const durSec = Math.max(0.04, clipDurationBeats * spb);
  const tOff = tOn + durSec;
  if (tOff < pastCutoff || tOn > horizon + 1e-6) return [];
  return [
    {
      occurrenceStartBeat: clipStartBeat,
      segStartBeat: clipStartBeat,
      segEndBeat: clipStartBeat + clipDurationBeats,
      sourceOffsetBeats,
      tOn,
      tOff,
      repeatInLap: 0,
    },
  ];
}
