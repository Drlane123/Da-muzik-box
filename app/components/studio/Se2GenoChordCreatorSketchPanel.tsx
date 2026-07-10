'use client';

import { useCallback, useMemo, useRef } from 'react';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { defaultGenrePackForMode } from '@/app/lib/creationStation/grooveLabProgressionLibrary';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { GrooveEightChordSketch } from '@/app/components/creation/GrooveEightChordSketch';
import { useGrooveLabProgressionAudition } from '@/app/hooks/useGrooveLabProgressionAudition';
import {
  se2ChordGeniePresetCatalog,
} from '@/app/lib/studio/se2ChordGenieGenerate';
import type { Se2GenoChordCreatorTrack } from '@/app/lib/studio/se2ChordGenieTrack';
import {
  se2GenoChordCreatorAudioOn,
  se2GenoChordCreatorLoopBars,
  se2GenoChordCreatorPresetId,
} from '@/app/lib/studio/se2ChordGenieTrack';
import type { StudioHarmonyLoopBars } from '@/app/lib/studio/studioInstrumentHarmony';

export type Se2GenoChordCreatorSketchPanelProps = {
  track: Se2GenoChordCreatorTrack;
  bpm: number;
  beatsPerBar: number;
  disabled?: boolean;
  transportPlaying?: boolean;
  getAudioContext?: () => AudioContext | null;
  onLoopBarsChange: (bars: StudioHarmonyLoopBars) => void;
  onDraftStepsChange: (steps: GrooveProgressionStep[]) => void;
  onExportToTrack: (steps: GrooveProgressionStep[], loopBars: StudioHarmonyLoopBars) => void;
  /** Drops under Length/Audio in the generator header — narrow, collapsible. */
  embedded?: boolean;
  defaultOpen?: boolean;
};

export function Se2GenoChordCreatorSketchPanel({
  track,
  bpm,
  beatsPerBar,
  disabled = false,
  transportPlaying = false,
  getAudioContext,
  onLoopBarsChange,
  onDraftStepsChange,
  onExportToTrack,
  embedded = false,
  defaultOpen = false,
}: Se2GenoChordCreatorSketchPanelProps) {
  const emptyStepsRef = useRef<GrooveProgressionStep[]>([]);
  const keyRoot = track.trackKeyRoot ?? 0;
  const keyMode: ChordMode = track.trackKeyMode === 'minor' ? 'minor' : 'major';
  const loopBars = se2GenoChordCreatorLoopBars(track);
  const audioOn = se2GenoChordCreatorAudioOn(track);
  const draftSteps = track.harmonySteps ?? emptyStepsRef.current;

  const presetId = se2GenoChordCreatorPresetId(track);
  const genreId = useMemo(() => {
    const catalog = se2ChordGeniePresetCatalog(keyRoot, keyMode);
    const hit = catalog.find((p) => p.id === presetId);
    return hit?.genreId ?? defaultGenrePackForMode(keyMode);
  }, [keyMode, keyRoot, presetId]);

  const draftSyncToken = useMemo(() => {
    if (draftSteps.length === 0) return 0;
    return draftSteps.reduce((n, s) => n + (s.label?.length ?? 0) + (s.beats ?? 0), draftSteps.length);
  }, [draftSteps]);

  const audition = useGrooveLabProgressionAudition({
    getAudioContext,
    bpm,
    chordVoice: 'grand',
    perfMode: 'block',
    linkedChordVolume: 0.82,
  });

  const stopAudition = useCallback(() => {
    if (transportPlaying) return;
    audition.stopPlayback();
  }, [audition, transportPlaying]);

  return (
    <div className={embedded ? 'shrink-0' : 'px-2 py-2 pb-4'}>
      <GrooveEightChordSketch
        defaultOpen={defaultOpen}
        studioGenoChordCreator
        compactEmbed={embedded}
        draftSyncToken={draftSyncToken}
        keyRoot={keyRoot}
        mode={keyMode}
        genreId={genreId}
        mainTimelineSteps={draftSteps}
        packChordLabels={[]}
        auditionPlaying={audition.playing}
        auditionStepIndex={audition.activeStepIndex}
        onPreviewStep={(step) => {
          if (!audioOn || transportPlaying) return;
          audition.previewStep(step, { genreId });
        }}
        onPlayProgression={(steps) => {
          if (!audioOn || transportPlaying) return;
          audition.playProgressionOnce(steps, bpm, genreId);
        }}
        onLoopProgression={(steps) => {
          if (!audioOn || transportPlaying) return;
          audition.playProgressionLoop(steps, bpm, genreId);
        }}
        onStopAudition={stopAudition}
        onSendToMainTimeline={onDraftStepsChange}
        onDropToRoll={(steps) => {
          onExportToTrack(steps, loopBars);
        }}
        onLoopBarsChange={onLoopBarsChange}
        onSketchStepsReady={onDraftStepsChange}
        defaultCardBeats={beatsPerBar}
        autoSongBankTempo={false}
        loopBars={loopBars}
      />
    </div>
  );
}
