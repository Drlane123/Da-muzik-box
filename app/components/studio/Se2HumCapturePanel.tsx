'use client';

import React, { Component, useCallback, useMemo, useRef, type ReactNode } from 'react';

import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { se2HarmonySourceSteps } from '@/app/lib/studio/se2GlideBassHarmony';
import { studioTrackDetectedKeyFromFields } from '@/app/lib/studio/se2GlideBassNotes';
import {
  se2HumCaptureSeedRollNotes,
  se2HumRollNotesToMockNotes,
  type Se2HumCaptureMockNote,
} from '@/app/lib/studio/se2HumCaptureNotes';
import {
  se2ResolveHumCaptureHarmonyTrack,
  type Se2HumCaptureTrack,
} from '@/app/lib/studio/se2HumCaptureTrack';
import { se2TrackNumberedName } from '@/app/lib/studio/se2StudioTrackNumber';
import NeuralHumPanel, { type NeuralHumSe2LaneBinding } from '@/app/screens/vocal-lab/NeuralHumPanel';
import type { NeuralHumInstrumentId } from '@/app/lib/vocalLab/neuralHumToInstrument';
import type { NeuralHumRollBarCount } from '@/app/lib/vocalLab/neuralHumMelodyRoll';

const ACCENT = '#00E5FF';

class Se2HumCapturePanelErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="rounded border px-3 py-3 text-[10px] font-semibold leading-relaxed"
          style={{ borderColor: '#e85d7566', background: '#1a1014', color: '#e8a0a8' }}
        >
          Hum / Melody Capture could not load on this lane. Try reloading the page, or close and reopen
          the panel.
          <pre
            className="mt-2 max-h-24 overflow-auto text-[9px] font-mono whitespace-pre-wrap"
            style={{ color: '#9a7a80' }}
          >
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export type Se2HumCapturePanelProps = {
  trackIndex: number;
  track: Se2HumCaptureTrack;
  tracks: readonly (Se2HumCaptureTrack & {
    id: string;
    name: string;
    laneNumber?: number;
    harmonySteps?: readonly unknown[];
    rhythmSteps?: readonly unknown[];
  })[];
  notes: readonly Se2HumCaptureMockNote[];
  bpm: number;
  beatsPerBar: number;
  songKeyRoot: number;
  songKeyMode: ChordMode;
  disabled?: boolean;
  lanePad: number;
  getAudioContext: () => AudioContext;
  getPreviewDestination: (ctx: AudioContext) => AudioNode;
  onHarmonyTrackIdChange: (trackId: string) => void;
  onRollBarsChange: (bars: NeuralHumRollBarCount) => void;
  onInstrumentIdChange: (id: NeuralHumInstrumentId) => void;
  onApplyNotes: (notes: Se2HumCaptureMockNote[]) => void;
};

export function Se2HumCapturePanel({
  trackIndex,
  track,
  tracks,
  notes,
  bpm,
  beatsPerBar,
  songKeyRoot,
  songKeyMode,
  disabled = false,
  lanePad,
  getAudioContext,
  getPreviewDestination,
  onHarmonyTrackIdChange,
  onRollBarsChange,
  onInstrumentIdChange,
  onApplyNotes,
}: Se2HumCapturePanelProps) {
  const previewStripRef = useRef<AudioNode | null>(null);

  const harmonySource = useMemo(
    () => se2ResolveHumCaptureHarmonyTrack(tracks, track, track.id),
    [tracks, track],
  );

  const harmonyCandidates = useMemo(
    () =>
      tracks.filter(
        (t) =>
          t.id !== track.id &&
          t.kind !== 'humCapture' &&
          t.kind !== 'audio' &&
          se2HarmonySourceSteps(t).length > 0,
      ),
    [tracks, track.id],
  );

  const { keyRoot, keyMode } = harmonySource
    ? studioTrackDetectedKeyFromFields(harmonySource, songKeyRoot, songKeyMode)
    : studioTrackDetectedKeyFromFields(track, songKeyRoot, songKeyMode);

  void keyRoot;
  void keyMode;

  const rollBars = (track.humCaptureRollBars === 4 ? 4 : 8) as NeuralHumRollBarCount;
  const instrumentId = (track.humCaptureInstrumentId ?? 'piano') as NeuralHumInstrumentId;
  const transpose = track.humCaptureTranspose ?? 0;
  const quantize = track.humCaptureQuantize ?? '1/16';

  const initialRollNotes = useMemo(
    () => se2HumCaptureSeedRollNotes(notes, bpm, beatsPerBar, rollBars, quantize),
    [notes, bpm, beatsPerBar, rollBars, quantize],
  );

  const trackKey = `${track.id}:${notes.length}:${rollBars}:${instrumentId}`;

  const onRollNotesCommit = useCallback(
    (rollNotes: Parameters<NonNullable<NeuralHumSe2LaneBinding['onRollNotesCommit']>>[0]) => {
      onApplyNotes(se2HumRollNotesToMockNotes(rollNotes, bpm, transpose));
    },
    [bpm, onApplyNotes, transpose],
  );

  const se2Lane: NeuralHumSe2LaneBinding = useMemo(
    () => ({
      trackKey,
      initialRollNotes,
      rollBars,
      onRollBarsChange,
      instrumentId,
      onInstrumentIdChange,
      onRollNotesCommit,
      getPreviewDestination: (ctx) => {
        const dest = getPreviewDestination(ctx);
        previewStripRef.current = dest;
        return dest;
      },
    }),
    [
      getPreviewDestination,
      initialRollNotes,
      instrumentId,
      onInstrumentIdChange,
      onRollBarsChange,
      onRollNotesCommit,
      rollBars,
      trackKey,
    ],
  );

  return (
    <div className="flex min-w-0 flex-col gap-1 py-0.5" style={{ minWidth: 480 }}>
      {harmonyCandidates.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-[9px] font-black uppercase tracking-wide shrink-0" style={{ color: ACCENT }}>
            Match chords
          </span>
          <select
            disabled={disabled}
            value={track.humCaptureHarmonyTrackId ?? ''}
            onChange={(e) => onHarmonyTrackIdChange(e.target.value)}
            className="max-w-[12rem] truncate rounded border px-2 py-1 text-[10px] font-semibold outline-none"
            style={{ borderColor: '#1a4a5c', background: '#0c1a24', color: '#c8f0ff' }}
            title="Chord / progression lane for key lock context"
          >
            <option value="">Auto (first with chords)</option>
            {harmonyCandidates.map((t) => (
              <option key={t.id} value={t.id}>
                {se2TrackNumberedName(t.laneNumber, t.name, lanePad)}
              </option>
            ))}
          </select>
          {harmonySource ? (
            <span className="text-[9px] font-semibold text-[#8a9aae] truncate">
              {se2TrackNumberedName(harmonySource.laneNumber, harmonySource.name, lanePad)} · key guide
            </span>
          ) : null}
        </div>
      ) : null}

      <Se2HumCapturePanelErrorBoundary>
        <NeuralHumPanel se2Lane={se2Lane} disabled={disabled} />
      </Se2HumCapturePanelErrorBoundary>
    </div>
  );
}
