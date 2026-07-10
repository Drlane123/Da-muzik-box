/**
 * Build Beat Lab chord-rail shape from SE2 progression / piano-roll sources.
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { BeatLabImportedChordRail } from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import { grooveProgressionStepsToChordRail } from '@/app/lib/creationStation/grooveLabBeatLabImport';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { studioTrackDetectedKeyFromFields } from '@/app/lib/studio/se2GlideBassNotes';

export type Se2HarmonySourceTrack = {
  id: string;
  name?: string;
  laneNumber?: number;
  kind: string;
  harmonySteps?: readonly GrooveProgressionStep[];
  rhythmSteps?: readonly GrooveProgressionStep[];
  trackKeyRoot?: number;
  trackKeyMode?: ChordMode;
  a2mKeyRoot?: number;
  a2mKeyMode?: ChordMode;
};

export function se2HarmonySourceSteps(tr: Se2HarmonySourceTrack): readonly GrooveProgressionStep[] {
  if ((tr.harmonySteps?.length ?? 0) > 0) return tr.harmonySteps!;
  if ((tr.rhythmSteps?.length ?? 0) > 0) return tr.rhythmSteps!;
  return [];
}

export function se2GlideBassChordRailFromSource(
  source: Se2HarmonySourceTrack | undefined,
  beatsPerBar: number,
  fallbackKeyRoot = 0,
  fallbackKeyMode: ChordMode = 'major',
): BeatLabImportedChordRail | null {
  if (!source) return null;
  const steps = se2HarmonySourceSteps(source);
  if (steps.length === 0) return null;
  const { keyRoot, keyMode } = studioTrackDetectedKeyFromFields(source, fallbackKeyRoot, fallbackKeyMode);
  return grooveProgressionStepsToChordRail(steps, beatsPerBar, keyRoot, keyMode);
}

export function se2ResolveGlideBassHarmonyTrack<
  T extends Se2HarmonySourceTrack & { id: string; kind: string },
>(tracks: readonly T[], glideBass: { glideBassHarmonyTrackId?: string }, glideBassId: string): T | undefined {
  const want = glideBass.glideBassHarmonyTrackId?.trim();
  if (want) {
    const picked = tracks.find((t) => t.id === want);
    if (
      picked &&
      picked.id !== glideBassId &&
      picked.kind !== 'glideBass' &&
      picked.kind !== 'audio'
    ) {
      return picked;
    }
  }
  return tracks.find(
    (t) =>
      t.id !== glideBassId &&
      t.kind !== 'glideBass' &&
      t.kind !== 'audio' &&
      se2HarmonySourceSteps(t).length > 0,
  );
}
