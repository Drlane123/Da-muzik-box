'use client';

import React, { lazy, Suspense, useMemo } from 'react';

import { BEAT_LAB_DEFAULT_SYNTH_PRESET_ID } from '@/app/lib/creationStation/beatLabMelodicSynthPresets';
import type { BeatLabMidiNote } from '@/app/lib/creationStation/beatLabMidiRoll';
import type { BeatLabBassSynthVoiceParams } from '@/app/lib/creationStation/beatLabMelodicSynthV2State';
import {
  se2GlideBassChordRailFromSource,
  se2ResolveGlideBassHarmonyTrack,
} from '@/app/lib/studio/se2GlideBassHarmony';
import {
  se2BeatLabLaneForTrack,
  se2BeatLabMidiToMockNotes,
  se2MockNotesToBeatLabRoll,
} from '@/app/lib/studio/se2GlideBassNotes';
import {
  se2GlideBassHarmonyReadyCandidates,
  se2GlideBassHarmonySourceCandidates,
  se2TrackHasProgressionSteps,
  type Se2GlideBassTrack,
} from '@/app/lib/studio/se2GlideBassTrack';
import { se2TrackNumberedName } from '@/app/lib/studio/se2StudioTrackNumber';

const BeatLabSynthV2Panel = lazy(() =>
  import('@/app/components/creation/BeatLabSynthV2Panel').then((m) => ({
    default: m.BeatLabSynthV2Panel,
  })),
);

type Se2GlideBassSynthErrorBoundaryProps = {
  children: React.ReactNode;
};

type Se2GlideBassSynthErrorBoundaryState = {
  error: Error | null;
};

class Se2GlideBassSynthErrorBoundary extends React.Component<
  Se2GlideBassSynthErrorBoundaryProps,
  Se2GlideBassSynthErrorBoundaryState
> {
  state: Se2GlideBassSynthErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): Se2GlideBassSynthErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            border: '1px solid #e85d7566',
            background: 'rgba(42,20,24,0.85)',
            color: '#e8b4bc',
            fontSize: 10,
            lineHeight: 1.45,
          }}
        >
          <strong style={{ display: 'block', marginBottom: 6, color: '#ffb7c9' }}>
            Bass Glide panel could not load
          </strong>
          Hide this strip and try again, or refresh the page. Your chords and drums are still saved.
          <pre
            style={{
              marginTop: 8,
              fontSize: 9,
              whiteSpace: 'pre-wrap',
              color: '#c9a0a8',
            }}
          >
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

type HarmonyTrack = {
  id: string;
  name: string;
  laneNumber?: number;
  kind: string;
  notes?: readonly { pitch: number; startBeat: number; durationBeats: number; velocity: number }[];
  harmonySteps?: readonly unknown[];
  rhythmSteps?: readonly unknown[];
  trackKeyRoot?: number;
  trackKeyMode?: import('@/app/lib/creationStation/chordBuilder').ChordMode;
  a2mKeyRoot?: number;
  a2mKeyMode?: import('@/app/lib/creationStation/chordBuilder').ChordMode;
};

export type Se2GlideBassPanelProps = {
  trackIndex: number;
  track: Se2GlideBassTrack;
  tracks: readonly HarmonyTrack[];
  voice: BeatLabBassSynthVoiceParams;
  presetId: string;
  bpm: number;
  beatsPerBar: number;
  subdiv?: number;
  patternCols: number;
  songKeyRoot: number;
  songKeyMode: import('@/app/lib/creationStation/chordBuilder').ChordMode;
  disabled?: boolean;
  onHarmonyTrackIdChange: (sourceTrackId: string) => void;
  onPresetChange: (presetId: string) => void;
  onLoadPresetToVoice: (presetId: string) => void;
  onPatchVoice: (patch: Partial<BeatLabBassSynthVoiceParams>) => void;
  onApplyBassNotes: (notes: { pitch: number; startBeat: number; durationBeats: number; velocity: number }[]) => void;
  onPreview?: () => void;
  onPreviewMidi?: (midi: number) => void;
  onAuditionStart?: () => void;
  onAuditionStop?: () => void;
  onAuditionTouch?: () => void;
  onSustainMidi?: (midi: number) => void;
  onReleaseMidi?: () => void;
  playingMidis?: ReadonlySet<number>;
};

export function Se2GlideBassPanel({
  trackIndex,
  track,
  tracks,
  voice,
  presetId,
  bpm,
  beatsPerBar,
  subdiv = 4,
  patternCols,
  songKeyRoot,
  songKeyMode,
  disabled = false,
  onHarmonyTrackIdChange,
  onPresetChange,
  onLoadPresetToVoice,
  onPatchVoice,
  onApplyBassNotes,
  onPreview,
  onPreviewMidi,
  onAuditionStart,
  onAuditionStop,
  onAuditionTouch,
  onSustainMidi,
  onReleaseMidi,
  playingMidis,
}: Se2GlideBassPanelProps) {
  const lane = se2BeatLabLaneForTrack(trackIndex);
  const harmonyCandidates = useMemo(
    () => se2GlideBassHarmonySourceCandidates(tracks, track.id),
    [tracks, track.id],
  );
  const harmonyReadyCount = useMemo(
    () => se2GlideBassHarmonyReadyCandidates(tracks, track.id).length,
    [tracks, track.id],
  );
  const harmonySource = useMemo(
    () => se2ResolveGlideBassHarmonyTrack(tracks, track, track.id),
    [tracks, track],
  );
  const harmonyTrackIndex = harmonySource ? tracks.findIndex((t) => t.id === harmonySource.id) : -1;
  const chordRail = useMemo(
    () => se2GlideBassChordRailFromSource(harmonySource, beatsPerBar, songKeyRoot, songKeyMode),
    [harmonySource, beatsPerBar, songKeyRoot, songKeyMode],
  );
  const laneNotes = useMemo(
    () => se2MockNotesToBeatLabRoll(track.notes ?? [], lane, subdiv),
    [track.notes, lane, subdiv],
  );

  const applyBassLaneNotes = (bassNotes: BeatLabMidiNote[]) => {
    onApplyBassNotes(se2BeatLabMidiToMockNotes(bassNotes, lane, subdiv));
  };

  const lanePad = Math.max(2, String(tracks.length).length);
  const laneLabel = (t: HarmonyTrack, fallbackIndex: number) =>
    se2TrackNumberedName(t.laneNumber ?? fallbackIndex + 1, t.name, lanePad);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px',
          borderRadius: 8,
          border: `1px solid ${track.colorHex ?? '#9B6BFF'}44`,
          background: 'rgba(0,0,0,0.35)',
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 900,
            color: track.colorHex ?? '#9B6BFF',
            letterSpacing: 0.5,
            flexShrink: 0,
          }}
        >
          CHORD SOURCE
        </span>
        <select
          disabled={disabled || harmonyCandidates.length === 0}
          value={track.glideBassHarmonyTrackId ?? ''}
          onChange={(e) => onHarmonyTrackIdChange(e.target.value)}
          title="Pick the numbered track (T01, T02…) whose Progression+ chords drive this bass glide"
          style={{
            fontSize: 9,
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid #3a4860',
            background: '#121820',
            color: '#d8e4f8',
            minWidth: 160,
            cursor: disabled || harmonyCandidates.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          <option value="">
            {harmonyCandidates.length === 0
              ? '— add an instrument track first —'
              : harmonyReadyCount === 0
                ? '— pick the track with your chords —'
                : 'Auto (first chord track)'}
          </option>
          {harmonyCandidates.map((t) => {
            const ti = tracks.findIndex((x) => x.id === t.id);
            const ready = se2TrackHasProgressionSteps(t);
            return (
              <option key={t.id} value={t.id}>
                {laneLabel(t, ti)}
                {ready ? '' : ' · needs Progression+'}
              </option>
            );
          })}
        </select>
        {harmonyCandidates.length === 0 ? (
          <span style={{ fontSize: 8, color: '#a88', fontWeight: 600, lineHeight: 1.35, maxWidth: 280 }}>
            Add an Instrument track (it gets a number, T01, T02…). Build Progression+ chords on that
            track, then pick it here — that track becomes your chord source.
          </span>
        ) : harmonySource && chordRail ? (
          <span style={{ fontSize: 8, color: '#8a9aae', fontWeight: 600 }}>
            Chord source:{' '}
            {laneLabel(
              harmonySource,
              tracks.findIndex((x) => x.id === harmonySource.id),
            )}{' '}
            · {chordRail.timeline.filter((s) => s.chord).length} bars · bass follows this track
          </span>
        ) : harmonySource ? (
          <span style={{ fontSize: 8, color: '#c9a86a', fontWeight: 600, lineHeight: 1.35, maxWidth: 300 }}>
            {laneLabel(
              harmonySource,
              tracks.findIndex((x) => x.id === harmonySource.id),
            )}{' '}
            is your chord source — open Progression+ on that track and add chords there first
          </span>
        ) : (
          <span style={{ fontSize: 8, color: '#a88', fontWeight: 600, lineHeight: 1.35, maxWidth: 320 }}>
            Pick a track from the list (T01, T02…) — the instrument track where you put your chords.
            That numbered track becomes this bass glide&apos;s chord source; build Progression+ on it
            if it does not have chords yet.
          </span>
        )}
      </div>

      <Se2GlideBassSynthErrorBoundary>
        <Suspense
          fallback={
            <div
              style={{
                padding: '12px 8px',
                fontSize: 9,
                fontWeight: 700,
                color: '#8a9aae',
              }}
            >
              Loading Bass Glide synth…
            </div>
          }
        >
          <BeatLabSynthV2Panel
            scrollContained
            bassLane={lane}
            harmonyLane={harmonyTrackIndex >= 0 ? se2BeatLabLaneForTrack(harmonyTrackIndex) : lane}
            presetId={presetId || BEAT_LAB_DEFAULT_SYNTH_PRESET_ID}
            voice={voice}
            onPresetChange={onPresetChange}
            onLoadPresetToVoice={onLoadPresetToVoice}
            onPatchVoice={onPatchVoice}
            onPreview={onPreview}
            onPreviewMidi={onPreviewMidi}
            onAuditionStart={onAuditionStart}
            onAuditionStop={onAuditionStop}
            onAuditionTouch={onAuditionTouch}
            onSustainMidi={onSustainMidi}
            onReleaseMidi={onReleaseMidi}
            playingMidis={playingMidis}
            bpm={bpm}
            quantSubdiv={subdiv}
            chordRail={chordRail}
            laneNotes={laneNotes}
            patternCols={patternCols}
            beatsPerBar={beatsPerBar}
            colsPerBar={4}
            isActive
            onApplyBassLaneNotes={applyBassLaneNotes}
            onApplyHarmonyLaneNotes={() => {}}
          />
        </Suspense>
      </Se2GlideBassSynthErrorBoundary>
    </div>
  );
}
