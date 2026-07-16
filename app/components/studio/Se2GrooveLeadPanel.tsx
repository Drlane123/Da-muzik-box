'use client';

import React, { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  GROOVE_LAB_QUANTIZE_DEFAULT,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';
import { haltWaveLeafVoices, playWaveLeafNote } from '@/app/lib/creationStation/waveLeafEngine';
import { waveLeafPreset } from '@/app/lib/creationStation/waveLeafPresets';
import type { WaveLeafSe2ControlledSettings } from '@/app/components/creation/WaveLeafSynthPanel';
import {
  se2GrooveLeadCanFollowHarmonySource,
  se2GrooveLeadChordHitsFromHarmonySource,
  type Se2GrooveLeadHarmonyMelodyInput,
} from '@/app/lib/studio/se2GrooveLeadHarmonyMelody';
import { waveLeafMelodyGenColumnCount } from '@/app/lib/creationStation/waveLeafPhraseGen';
import {
  se2GrooveRollHitsToMockNotes,
  se2MockNotesToGrooveRollHits,
  type Se2MockMidiNote,
} from '@/app/lib/studio/se2GrooveLeadNotes';
import { se2GrooveLeadMonoGroup } from '@/app/lib/studio/se2GrooveLeadPreview';
import {
  se2ResolveGrooveLeadHarmonyTrack,
  type Se2GrooveLeadTrack,
} from '@/app/lib/studio/se2GrooveLeadTrack';
import type { Se2GrooveLeadVoiceParams } from '@/app/lib/studio/se2GrooveLeadTypes';
import { studioTrackDetectedKeyFromFields } from '@/app/lib/studio/se2GlideBassNotes';
import {
  SE2_GROOVE_LEAD_PITCH_DEFAULT_HI,
  SE2_GROOVE_LEAD_PITCH_DEFAULT_LO,
} from '@/app/lib/studio/se2GrooveLeadNotes';
import { StudioTrackKeyMenu } from '@/app/components/studio/StudioTrackKeyMenu';
import { se2TrackNumberedName } from '@/app/lib/studio/se2StudioTrackNumber';

const WaveLeafSynthPanel = lazy(() =>
  import('@/app/components/creation/WaveLeafSynthPanel').then((m) => ({
    default: m.WaveLeafSynthPanel,
  })),
);

type Se2GrooveLeadSynthErrorBoundaryProps = {
  children: React.ReactNode;
};

type Se2GrooveLeadSynthErrorBoundaryState = {
  error: Error | null;
};

class Se2GrooveLeadSynthErrorBoundary extends React.Component<
  Se2GrooveLeadSynthErrorBoundaryProps,
  Se2GrooveLeadSynthErrorBoundaryState
> {
  state: Se2GrooveLeadSynthErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): Se2GrooveLeadSynthErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            border: '1px solid #4ec8e866',
            background: 'rgba(8,20,32,0.85)',
            color: '#b8e8f8',
            fontSize: 10,
            lineHeight: 1.45,
          }}
        >
          <strong style={{ display: 'block', marginBottom: 6, color: '#7ee8ff' }}>
            Groove Lead panel could not load
          </strong>
          Hide this strip and try again, or refresh the page.
          <pre style={{ marginTop: 8, fontSize: 9, whiteSpace: 'pre-wrap', color: '#8ac0d8' }}>
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export type Se2GrooveLeadPanelProps = {
  trackIndex: number;
  track: Se2GrooveLeadTrack;
  tracks: readonly (Se2GrooveLeadTrack & {
    id: string;
    name: string;
    laneNumber?: number;
    harmonySteps?: readonly unknown[];
    rhythmSteps?: readonly unknown[];
    notes?: readonly { pitch: number; startBeat: number; durationBeats: number; velocity?: number }[];
  })[];
  voice: Se2GrooveLeadVoiceParams;
  notes: readonly Se2MockMidiNote[];
  bpm: number;
  beatsPerBar: number;
  loopBars: number;
  songKeyRoot: number;
  songKeyMode: ChordMode;
  disabled?: boolean;
  getAudioContext: () => AudioContext;
  getPreviewDestination: (ctx: AudioContext) => AudioNode;
  onVoiceChange: (voice: Se2GrooveLeadVoiceParams) => void;
  onHarmonyTrackIdChange: (trackId: string) => void;
  onApplyNotes: (notes: Se2MockMidiNote[]) => void;
  onDetectTrackKey?: () => void;
  onConvertTrackToSongKey?: () => void;
};

export function Se2GrooveLeadPanel({
  trackIndex,
  track,
  tracks,
  voice,
  notes,
  bpm,
  beatsPerBar,
  loopBars,
  songKeyRoot,
  songKeyMode,
  disabled = false,
  getAudioContext,
  getPreviewDestination,
  onVoiceChange,
  onHarmonyTrackIdChange,
  onApplyNotes,
  onDetectTrackKey,
  onConvertTrackToSongKey,
}: Se2GrooveLeadPanelProps) {
  const [melodyUndoStack, setMelodyUndoStack] = useState<Se2MockMidiNote[][]>([]);
  const previewStripRef = useRef<AudioNode | null>(null);

  const harmonySource = useMemo(
    () => se2ResolveGrooveLeadHarmonyTrack(tracks, track, track.id),
    [tracks, track],
  );

  const harmonyCandidates = useMemo(
    () =>
      tracks.filter(
        (t) =>
          t.id !== track.id &&
          t.kind !== 'grooveLead' &&
          t.kind !== 'audio' &&
          se2GrooveLeadCanFollowHarmonySource(t as Se2GrooveLeadHarmonyMelodyInput),
      ),
    [tracks, track.id],
  );

  const { keyRoot, keyMode } = harmonySource
    ? studioTrackDetectedKeyFromFields(harmonySource, songKeyRoot, songKeyMode)
    : studioTrackDetectedKeyFromFields(track, songKeyRoot, songKeyMode);

  const trackDetectedKey = studioTrackDetectedKeyFromFields(track, songKeyRoot, songKeyMode);

  const chordHits = useMemo((): GrooveRollHit[] => {
    if (!harmonySource) return [];
    return se2GrooveLeadChordHitsFromHarmonySource(
      harmonySource as Se2GrooveLeadHarmonyMelodyInput,
      beatsPerBar,
      loopBars,
    );
  }, [harmonySource, loopBars, beatsPerBar]);

  const chordColumnCount = useMemo(
    () =>
      waveLeafMelodyGenColumnCount(chordHits, {
        barCount: loopBars,
        keyRoot,
        mode: keyMode,
        bassRootMidi: 36,
      }),
    [chordHits, loopBars, keyRoot, keyMode],
  );

  const se2Controlled: WaveLeafSe2ControlledSettings = useMemo(
    () => ({
      presetId: voice.presetId,
      categoryIdx: voice.categoryIdx,
      glideMs: voice.glideMs,
      brightness: voice.brightness,
      warmth: voice.warmth,
      drive: voice.drive,
      output: voice.output,
      vibratoDepthCents: voice.vibratoDepthCents,
      phraseQuantize: voice.phraseQuantize,
      leadChopOn: voice.leadChopOn,
    }),
    [voice],
  );

  const onSe2SettingsChange = useCallback(
    (patch: Partial<WaveLeafSe2ControlledSettings>) => {
      onVoiceChange({ ...voice, ...patch });
    },
    [voice, onVoiceChange],
  );

  const previewRoll = useCallback(() => {
    const ctx = getAudioContext();
    const stripIn = getPreviewDestination(ctx);
    previewStripRef.current = stripIn;
    haltWaveLeafVoices();
    const hits = se2MockNotesToGrooveRollHits(notes);
    const preset = waveLeafPreset(voice.presetId);
    const spb = 60 / Math.max(40, bpm);
    const slotsPerBeat = 16;
    let t = ctx.currentTime + 0.02;
    for (const h of hits) {
      playWaveLeafNote(ctx, h.midi, t, {
        preset,
        glideMs: voice.glideMs,
        brightness: voice.brightness,
        warmth: voice.warmth,
        drive: voice.drive,
        vibratoDepthCents: voice.vibratoDepthCents,
        outputGain: voice.output,
        velocity: h.vel,
        bpm,
        holdBeats: Math.max(0.25, h.sustainSlots / slotsPerBeat),
        destination: stripIn,
        monophonic: true,
        monoGroup: se2GrooveLeadMonoGroup(trackIndex),
      });
      t += (h.sustainSlots / slotsPerBeat) * spb * 0.85;
    }
  }, [getAudioContext, getPreviewDestination, notes, voice, bpm, trackIndex]);

  const onMelodyGenerated = useCallback(
    (hits: GrooveRollHit[], _loopBars: number) => {
      setMelodyUndoStack((stack) => [...stack.slice(-7), notes.map((n) => ({ ...n }))]);
      onApplyNotes(se2GrooveRollHitsToMockNotes(hits));
    },
    [notes, onApplyNotes],
  );

  const onUndoMelody = useCallback(() => {
    setMelodyUndoStack((stack) => {
      const prev = stack[stack.length - 1];
      if (!prev) return stack;
      onApplyNotes(prev.map((n) => ({ ...n })));
      return stack.slice(0, -1);
    });
  }, [onApplyNotes]);

  return (
    <div className="flex min-w-0 flex-col gap-1" style={{ minWidth: 320 }}>
      {harmonyCandidates.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1 px-1 pt-1">
          <span className="se2-type-micro text-[7px] font-bold uppercase" style={{ color: '#5a8aa8' }}>
            Chords from
          </span>
          <select
            disabled={disabled}
            value={track.grooveLeadHarmonyTrackId ?? ''}
            onChange={(e) => onHarmonyTrackIdChange(e.target.value)}
            className="max-w-[10rem] truncate rounded border px-1 py-0.5 text-[8px] outline-none"
            style={{ borderColor: '#1a3a52', background: '#0c1a2c', color: '#c8e8f5' }}
            title="Chord source — Groove Lead locks melody roots to this lane's progression or chord MIDI"
          >
            <option value="">Auto (first with chords)</option>
            {harmonyCandidates.map((t) => (
              <option key={t.id} value={t.id}>
                {se2TrackNumberedName(t.laneNumber ?? 0, t.name, 2)}
              </option>
            ))}
          </select>
          {!harmonySource || !se2GrooveLeadCanFollowHarmonySource(harmonySource as Se2GrooveLeadHarmonyMelodyInput) ? (
            <span className="se2-type-micro text-[7px]" style={{ color: '#6a6a78' }}>
              Pick a lane with chords or root notes, then Generate melody
            </span>
          ) : chordColumnCount === 0 ? (
            <span className="se2-type-micro text-[7px]" style={{ color: '#c09050' }}>
              Source lane needs chords or roots on the roll
            </span>
          ) : null}
        </div>
      ) : (
        <p className="px-1 pt-1 se2-type-micro text-[7px]" style={{ color: '#6a6a78' }}>
          Add chord MIDI, root notes, or Progression+ on another lane — then Generate melody.
        </p>
      )}
      <Se2GrooveLeadSynthErrorBoundary>
        <Suspense
          fallback={
            <div className="px-2 py-4 text-[9px]" style={{ color: '#5a8aa8' }}>
              Loading Groove Lead synth…
            </div>
          }
        >
          <div style={{ minHeight: 280, minWidth: 300 }}>
            <WaveLeafSynthPanel
              channel={trackIndex}
              noteCount={notes.length}
              bpm={bpm}
              getAudioContext={getAudioContext}
              chordColumnCount={chordColumnCount}
              chordHits={chordHits}
              barCount={loopBars}
              quantize={GROOVE_LAB_QUANTIZE_DEFAULT}
              keyRoot={keyRoot}
              mode={keyMode}
              onPreviewRoll={previewRoll}
              onClearHits={() => onApplyNotes([])}
              onMelodyGenerated={onMelodyGenerated}
              canUndoMelody={melodyUndoStack.length > 0}
              onUndoMelody={onUndoMelody}
              se2Controlled={se2Controlled}
              onSe2SettingsChange={onSe2SettingsChange}
              getPreviewDestination={getPreviewDestination}
              se2RollHint="Draw Groove Lead melodies on this lane's piano roll — R&B, gospel, and neo-soul presets from Groove Lab."
              previewKeysMinMidi={SE2_GROOVE_LEAD_PITCH_DEFAULT_LO}
              previewKeysMaxMidi={SE2_GROOVE_LEAD_PITCH_DEFAULT_HI}
              previewKeysRegisterLabel="C4–C6"
              headerKeyMenu={
                onDetectTrackKey ? (
                  <StudioTrackKeyMenu
                    compact
                    keyRoot={trackDetectedKey.keyRoot}
                    keyMode={trackDetectedKey.keyMode}
                    songKeyRoot={songKeyRoot}
                    songKeyMode={songKeyMode}
                    onDetect={onDetectTrackKey}
                    onConvertToSongKey={onConvertTrackToSongKey ?? (() => {})}
                    disabled={disabled}
                    detectDisabled={disabled || notes.length === 0}
                    convertDisabled={disabled || notes.length === 0}
                    accentHex={track.colorHex}
                    title={`Detect key from ${track.name} notes`}
                    className="shrink-0"
                  />
                ) : undefined
              }
            />
          </div>
        </Suspense>
      </Se2GrooveLeadSynthErrorBoundary>
    </div>
  );
}
