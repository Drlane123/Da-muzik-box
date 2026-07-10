/**
 * Geno Bass — lock groove roll notes to chord roots from an SE2 MIDI / harmony lane.
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { grooveLabClampBassRootMidi } from '@/app/lib/creationStation/grooveLabPitch';
import {
  genoBassApproachMidi,
  genoBassChordToneMidi,
  genoBassResolveChordRoot,
  type GenoBassKeyMode,
} from '@/app/lib/studio/genoBassGrooveEngine';
import { genoUltraArpChordSegmentAtBeat } from '@/app/lib/studio/genoUltraArpChordPitch';
import type { GenoUltraArpChordSegment } from '@/app/lib/studio/genoUltraArpState';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';

const BEATS_PER_BAR = 4;

export function genoBassRootMidiFromChordSegment(
  segment: GenoUltraArpChordSegment | undefined,
  keyRoot: number,
  keyMode: StudioDetectedKeyMode | ChordMode,
  fallbackRoot: number,
): number {
  return genoBassResolveChordRoot(segment, keyRoot, keyMode, fallbackRoot);
}

export function genoBassRootMidiAtBeat(
  timeline: readonly GenoUltraArpChordSegment[],
  beat: number,
  totalBeats: number,
  keyRoot: number,
  keyMode: StudioDetectedKeyMode,
  fallbackRoot: number,
): number {
  const seg = genoUltraArpChordSegmentAtBeat(timeline, beat, totalBeats);
  return genoBassRootMidiFromChordSegment(seg, keyRoot, keyMode, fallbackRoot);
}

function templateDegreeFromPatternNote(
  pitch: number,
  patternRoot: number,
  _mode: GenoBassKeyMode,
): number {
  const delta = ((Math.round(pitch) - Math.round(patternRoot)) % 12 + 12) % 12;
  const majorMap: Record<number, number> = {
    0: 0,
    2: 2,
    3: 2,
    4: 2,
    5: 5,
    7: 4,
    8: 5,
    9: 6,
    10: 6,
    11: 6,
  };
  const role = majorMap[delta] ?? 0;
  if (delta >= 10) return 9;
  if (pitch - patternRoot >= 10) return 7;
  return role;
}

function nextChordRootAtBeat(
  timeline: readonly GenoUltraArpChordSegment[],
  beat: number,
  totalBeats: number,
  keyRoot: number,
  keyMode: StudioDetectedKeyMode,
  fallbackRoot: number,
): number | null {
  const bpb = BEATS_PER_BAR;
  const nextBeat = beat + bpb * 0.5;
  if (nextBeat >= totalBeats) return null;
  const cur = genoBassRootMidiAtBeat(timeline, beat, totalBeats, keyRoot, keyMode, fallbackRoot);
  const nxt = genoBassRootMidiAtBeat(timeline, nextBeat, totalBeats, keyRoot, keyMode, fallbackRoot);
  if (cur === nxt) return null;
  return nxt;
}

/** Re-harmonize degree-based bass pattern to chord tones bar-by-bar (Bass Dragon–style). */
export function genoBassLockRollNotesToChordTimeline(
  notes: readonly StudioEditor2GenNote[],
  patternRoot: number,
  timeline: readonly GenoUltraArpChordSegment[],
  totalBeats: number,
  keyRoot: number,
  keyMode: StudioDetectedKeyMode,
): StudioEditor2GenNote[] {
  if (!timeline.length) return notes.map((n) => ({ ...n }));
  const span = Math.max(0.001, totalBeats);
  const patternRootClamped = grooveLabClampBassRootMidi(patternRoot);

  return notes.map((n) => {
    const seg = genoUltraArpChordSegmentAtBeat(timeline, n.startBeat, span);
    const chordRoot = genoBassResolveChordRoot(seg, keyRoot, keyMode, patternRootClamped);
    const beatInBar = n.startBeat % BEATS_PER_BAR;
    const templateDegree = templateDegreeFromPatternNote(n.pitch, patternRootClamped, keyMode);

    let pitch = genoBassChordToneMidi({
      templateDegree,
      chordRootMidi: chordRoot,
      chordPitches: seg?.pitches ?? [chordRoot],
      keyRoot,
      keyMode,
    });

    const nextRoot = nextChordRootAtBeat(timeline, n.startBeat, span, keyRoot, keyMode, patternRootClamped);
    if (nextRoot != null && beatInBar >= BEATS_PER_BAR * 0.68) {
      pitch = genoBassApproachMidi(pitch, nextRoot, beatInBar, BEATS_PER_BAR);
    }

    return { ...n, pitch };
  });
}
