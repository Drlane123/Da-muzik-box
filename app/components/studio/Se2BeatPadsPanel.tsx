'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BeatLabDrumMachineOverlay } from '@/app/components/creation/BeatLabDrumMachineOverlay';
import { TrapKitBrowserPanel } from '@/app/components/creation/TrapKitBrowserPanel';
import { Se2BeatPadsHarmonyStrip } from '@/app/components/studio/Se2BeatPadsHarmonyStrip';
import {
  useRegisterSe2BeatPadsExportBridge,
  type Se2BeatPadsLaneExportRequest,
} from '@/app/components/studio/Se2BeatPadsExportContext';
import {
  emptyBeatPadsPattern,
  normalizeBeatPadsPattern,
  resizeBeatPadsPattern,
  type BeatPadsDrumPattern,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import { beatPadsConvertPatternGridSteps } from '@/app/lib/creationStation/beatPadsPatternEdit';
import { beatPadsPatternToStudioNotes } from '@/app/lib/creationStation/beatPadsStudioExport';
import {
  beatPadsLaneHasHits,
  beatPadsLaneToStudioNotes,
} from '@/app/lib/creationStation/beatPadsLaneExport';
import {
  beatPadsPatternHasHits,
  downloadBeatPadsLoopWav,
  renderBeatPadsLoopToAudioBuffer,
} from '@/app/lib/creationStation/beatPadsExport';
import {
  beatPadsSpreadHasHits,
  beatPadsSpreadToStudioNotes,
  downloadBeatPadsSpreadMidiFile,
  downloadBeatPadsSpreadWav,
  renderBeatPadsSpreadToAudioBuffer,
} from '@/app/lib/creationStation/beatPadsSpreadExport';
import { loadSe2BeatPadsTrackSession } from '@/app/lib/studio/se2BeatPadsTransportPlayback';
import {
  se2BeatPadsSpreadDefaultMidiExportTrackIndex,
  se2BeatPadsSpreadDefaultWavExportTrackIndex,
  se2BeatPadsSpreadMidiExportTrackOptions,
  se2BeatPadsSpreadWavExportTrackOptions,
} from '@/app/lib/studio/se2BeatPadsSpreadHarmony';
import type { BeatPadsGenoBuildSlot } from '@/app/lib/creationStation/beatPadsSe2Bridge';
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';
import { useSe2BeatPadsSampler } from '@/app/hooks/useSe2BeatPadsSampler';
import type { Se2DrumGenStyle } from '@/app/lib/studio/se2DrumGeneratorTrack';
import type { Se2BeatPadsHarmonySourceTrack } from '@/app/lib/studio/se2BeatPadsHarmony';
import { se2BeatPadsHarmonyKey, se2ResolveBeatPadsHarmonyTrack } from '@/app/lib/studio/se2BeatPadsHarmony';
import { se2BeatPadsKickKeySemiForTrack } from '@/app/lib/studio/se2BeatPadsTransportPlayback';
import { se2BeatPadsPadLabelsForTrack } from '@/app/lib/studio/se2BeatPadsPianoRoll';
import type { Se2BeatPadsTrack, Se2BeatPadsSe2SyncMode } from '@/app/lib/studio/se2BeatPadsTrack';

export type Se2BeatPadsTimelineNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

export type Se2BeatPadsPanelProps = {
  track: Se2BeatPadsTrack;
  trackIndex: number;
  bpm: number;
  disabled?: boolean;
  ensureCtx: () => Promise<AudioContext>;
  getTrackStripInput?: () => GainNode | null;
  getMasterOutput?: () => GainNode | null;
  trackVolume127?: number;
  onPatternChange: (
    trackIndex: number,
    pattern: BeatPadsDrumPattern,
    loopBars: number,
    stepsPerBar: BeatPadsGridStepsPerBar,
  ) => void;
  onHarmonyTrackIdChange: (trackIndex: number, trackId: string, slot: BeatPadsGenoBuildSlot) => void;
  onApplyTransport: (trackIndex: number, opts: { bpm: number; loopBars: number }) => void;
  /** Beat Pads drum machine reports its live loop BPM/bars for SE2 sync. */
  onReportLiveTransport?: (opts: { bpm: number; loopBars: number }) => void;
  onProducerKitIdChange?: (trackIndex: number, kitId: BeatLabProducerKitId) => void;
  matchedPresetId?: string;
  onMatchedPresetIdChange?: (presetId: string) => void;
  onPadStoreChanged?: () => void;
  onClose?: () => void;
  /** SE2 — pads/kit/FX visible; sequencer always stays mounted. */
  machineChromeOpen?: boolean;
  autoBootstrapKit?: boolean;
  se2SyncMode?: Se2BeatPadsSe2SyncMode;
  onSe2SyncModeChange?: (mode: Se2BeatPadsSe2SyncMode) => void;
  se2TransportPlaying?: boolean;
  getSe2PlayheadBeat?: () => number;
  getSe2TransportOriginBeat?: () => number;
  onSe2TransportToggle?: () => void;
  se2BeatsPerBar?: number;
  /** SE2 — match chords / key / groove to harmony lanes. */
  harmonyTracks?: readonly Se2BeatPadsHarmonySourceTrack[];
  songKeyRoot?: number;
  songKeyMode?: 'major' | 'minor';
  sessionLoopBars?: number;
  onBeatPadsHarmonyTrackIdChange?: (trackId: string) => void;
  onBeatPadsHarmonyLockedChange?: (locked: boolean) => void;
  onBeatPadsPatternStyleChange?: (style: Se2DrumGenStyle) => void;
  onBeatPadsSyncFromHarmony?: () => void;
  onBeatPadsLoadMatchedPattern?: () => void | Promise<void>;
  onBeatPadsKickKeyLockChange?: (locked: boolean) => void;
  onBeatPadsKickTargetPadChange?: (padIndex: number) => void;
  onBeatPadsRegeneratePad?: (targetPadIndex: number) => string | void | Promise<string | void>;
  /** Bounce rendered loop to a new SE2 audio track. */
  onExportBeatPadsToAudioTrack?: (args: {
    buffer: AudioBuffer;
    loopBars: number;
    bpm: number;
    sourceTrackName: string;
  }) => void | Promise<void>;
  onExportBeatPadsSpreadMidiToTrack?: (args: {
    targetTrackIndex: number;
    notes: Se2BeatPadsTimelineNote[];
    loopBars: number;
  }) => boolean | void;
  onExportBeatPadsSpreadWavToTrack?: (args: {
    targetTrackIndex: number;
    buffer: AudioBuffer;
    loopBars: number;
    bpm: number;
    sourceLabel: string;
  }) => boolean | void;
  /** Selected pads → individual WAV / MIDI tracks on the SE2 timeline. */
  onExportBeatPadsLanesToTracks?: (args: {
    lanes: readonly {
      padIndex: number;
      label: string;
      wav?: { buffer: AudioBuffer; loopBars: number; bpm: number };
      midi?: {
        notes: Se2BeatPadsTimelineNote[];
        loopBars: number;
      };
    }[];
  }) => { created: number; skipped: number } | void;
  onBeatPadsSpreadChange?: (
    snap: import('@/app/lib/studio/se2BeatPadsSpreadStore').Se2BeatPadsSpreadSnapshot | null,
  ) => void;
};

export function Se2BeatPadsPanel({
  track,
  trackIndex,
  bpm,
  disabled = false,
  ensureCtx,
  getTrackStripInput,
  getMasterOutput,
  trackVolume127,
  onPatternChange,
  onHarmonyTrackIdChange,
  onApplyTransport,
  onReportLiveTransport,
  onProducerKitIdChange,
  matchedPresetId,
  onMatchedPresetIdChange,
  onPadStoreChanged,
  onClose,
  machineChromeOpen = true,
  autoBootstrapKit = false,
  se2SyncMode = 'off',
  onSe2SyncModeChange,
  se2TransportPlaying = false,
  getSe2PlayheadBeat,
  getSe2TransportOriginBeat,
  onSe2TransportToggle,
  se2BeatsPerBar = 4,
  harmonyTracks,
  songKeyRoot = 0,
  songKeyMode = 'major',
  sessionLoopBars = 8,
  onBeatPadsHarmonyTrackIdChange,
  onBeatPadsHarmonyLockedChange,
  onBeatPadsPatternStyleChange,
  onBeatPadsSyncFromHarmony,
  onBeatPadsLoadMatchedPattern,
  onBeatPadsKickKeyLockChange,
  onBeatPadsKickTargetPadChange,
  onBeatPadsRegeneratePad,
  onExportBeatPadsToAudioTrack,
  onExportBeatPadsSpreadMidiToTrack,
  onExportBeatPadsSpreadWavToTrack,
  onExportBeatPadsLanesToTracks,
  onBeatPadsSpreadChange,
}: Se2BeatPadsPanelProps) {
  const [loadingPattern, setLoadingPattern] = useState(false);
  const [regeneratingPad, setRegeneratingPad] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const exportStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopBars = track.beatPadsLoopBars ?? 8;
  const stepsPerBar = track.beatPadsStepsPerBar ?? 16;
  const pattern = useMemo(
    () => normalizeBeatPadsPattern(track.beatPadsPattern ?? emptyBeatPadsPattern(loopBars), loopBars, stepsPerBar),
    [track.beatPadsPattern, loopBars, stepsPerBar],
  );

  const latestPatternRef = useRef({ pattern, loopBars, stepsPerBar, trackIndex });
  latestPatternRef.current = { pattern, loopBars, stepsPerBar, trackIndex };

  const handlePatternChange = useCallback(
    (next: BeatPadsDrumPattern) => {
      const snap = latestPatternRef.current;
      latestPatternRef.current = { ...snap, pattern: next };
      onPatternChange(snap.trackIndex, next, snap.loopBars, snap.stepsPerBar);
    },
    [onPatternChange],
  );

  useEffect(() => {
    return () => {
      const snap = latestPatternRef.current;
      onPatternChange(snap.trackIndex, snap.pattern, snap.loopBars, snap.stepsPerBar);
    };
  }, [onPatternChange]);

  const handleLoopBarsChange = useCallback(
    (bars: number) => {
      const resized = resizeBeatPadsPattern(pattern, bars, stepsPerBar);
      latestPatternRef.current = { pattern: resized, loopBars: bars, stepsPerBar, trackIndex };
      onPatternChange(trackIndex, resized, bars, stepsPerBar);
    },
    [onPatternChange, trackIndex, pattern, stepsPerBar],
  );

  const handleStepsPerBarChange = useCallback(
    (steps: BeatPadsGridStepsPerBar) => {
      const converted = beatPadsConvertPatternGridSteps(pattern, loopBars, stepsPerBar, steps);
      latestPatternRef.current = { pattern: converted, loopBars, stepsPerBar: steps, trackIndex };
      onPatternChange(trackIndex, converted, loopBars, steps);
    },
    [onPatternChange, trackIndex, pattern, loopBars, stepsPerBar],
  );

  const kickKeySemi = useMemo(() => {
    if (!track.beatPadsKickKeyLock) return 0;
    const harmony = harmonyTracks
      ? se2ResolveBeatPadsHarmonyTrack(harmonyTracks, track, track.id)
      : undefined;
    const { keyRoot } = se2BeatPadsHarmonyKey(harmony, songKeyRoot, songKeyMode);
    return se2BeatPadsKickKeySemiForTrack(track, keyRoot);
  }, [
    track,
    harmonyTracks,
    songKeyRoot,
    songKeyMode,
    track.beatPadsKickKeyLock,
    track.beatPadsHarmonyTrackId,
  ]);

  const kickTargetPad = track.beatPadsKickTargetPad ?? 0;

  const flashExportStatus = useCallback((msg: string) => {
    setExportStatus(msg);
    if (exportStatusTimerRef.current) clearTimeout(exportStatusTimerRef.current);
    exportStatusTimerRef.current = setTimeout(() => {
      exportStatusTimerRef.current = null;
      setExportStatus(null);
    }, 3200);
  }, []);

  const buildBeatPadsExportSession = useCallback(async () => {
    const ctx = await ensureCtx();
    return loadSe2BeatPadsTrackSession(
      ctx,
      track.id,
      track.beatPadsProducerKitId ?? 'trapDarkVault',
    );
  }, [ensureCtx, track.beatPadsProducerKitId, track.id]);

  const handleExportWav = useCallback(
    async (args: {
      pattern: BeatPadsDrumPattern;
      loopBars: number;
      stepsPerBar: BeatPadsGridStepsPerBar;
      bpm: number;
    }) => {
      if (!beatPadsPatternHasHits(args.pattern, args.loopBars, args.stepsPerBar)) {
        flashExportStatus('Nothing to export — paint steps first');
        return;
      }
      try {
        flashExportStatus('Rendering WAV…');
        const session = await buildBeatPadsExportSession();
        await downloadBeatPadsLoopWav({
          ...args,
          session,
          filenameBase: `${track.name} · ${args.loopBars} bars`,
          trackVolume127,
          kickKeySemi,
          kickKeyLockTrack: track,
        });
        flashExportStatus('WAV downloaded');
      } catch (err) {
        flashExportStatus(err instanceof Error ? err.message : 'WAV export failed');
      }
    },
    [buildBeatPadsExportSession, flashExportStatus, kickKeySemi, track, trackVolume127],
  );

  const handleExportToTrack = useCallback(
    async (args: {
      pattern: BeatPadsDrumPattern;
      loopBars: number;
      stepsPerBar: BeatPadsGridStepsPerBar;
      bpm: number;
    }) => {
      if (!onExportBeatPadsToAudioTrack) return;
      if (!beatPadsPatternHasHits(args.pattern, args.loopBars, args.stepsPerBar)) {
        flashExportStatus('Nothing to export — paint steps first');
        return;
      }
      try {
        flashExportStatus('Bouncing to track…');
        const session = await buildBeatPadsExportSession();
        const buffer = await renderBeatPadsLoopToAudioBuffer({
          ...args,
          session,
          beatsPerBar: se2BeatsPerBar,
          trackVolume127,
          kickKeySemi,
          kickKeyLockTrack: track,
        });
        await onExportBeatPadsToAudioTrack({
          buffer,
          loopBars: args.loopBars,
          bpm: args.bpm,
          sourceTrackName: track.name,
        });
        flashExportStatus('Added audio track');
      } catch (err) {
        flashExportStatus(err instanceof Error ? err.message : 'Export to track failed');
      }
    },
    [
      buildBeatPadsExportSession,
      flashExportStatus,
      kickKeySemi,
      onExportBeatPadsToAudioTrack,
      se2BeatsPerBar,
      track,
      trackVolume127,
    ],
  );

  const spreadMidiExportTrackOptions = useMemo(() => {
    if (!harmonyTracks?.length) return undefined;
    const lanePad = Math.max(2, String(harmonyTracks.length).length);
    return se2BeatPadsSpreadMidiExportTrackOptions(harmonyTracks, lanePad);
  }, [harmonyTracks]);

  const spreadWavExportTrackOptions = useMemo(() => {
    if (!harmonyTracks?.length) return undefined;
    const lanePad = Math.max(2, String(harmonyTracks.length).length);
    return se2BeatPadsSpreadWavExportTrackOptions(harmonyTracks, lanePad);
  }, [harmonyTracks]);

  const spreadDefaultMidiExportTrackIndex = useMemo(() => {
    if (!harmonyTracks?.length) return 0;
    const lanePad = Math.max(2, String(harmonyTracks.length).length);
    return (
      se2BeatPadsSpreadDefaultMidiExportTrackIndex(harmonyTracks, track.id, lanePad) ?? trackIndex
    );
  }, [harmonyTracks, track.id, trackIndex]);

  const spreadDefaultWavExportTrackIndex = useMemo(() => {
    if (!harmonyTracks?.length) return 0;
    const lanePad = Math.max(2, String(harmonyTracks.length).length);
    return se2BeatPadsSpreadDefaultWavExportTrackIndex(harmonyTracks, lanePad) ?? 0;
  }, [harmonyTracks]);

  const buildSpreadExportContext = useCallback(() => {
    const snap = track.beatPadsSpread;
    if (!snap || !beatPadsSpreadHasHits(snap.notes)) return null;
    const harmonyTrack =
      snap.harmonyTrackIndex != null ? harmonyTracks?.[snap.harmonyTrackIndex] : undefined;
    return {
      snap,
      harmonyTrack,
      filenameBase: `${track.name} · Spread · ${snap.loopBars}b`,
      exportArgs: {
        notes: snap.notes,
        rootMidi: snap.rootMidi,
        direction: snap.direction,
        loopBars: snap.loopBars,
        stepsPerBar: snap.stepsPerBar,
        beatsPerBar: se2BeatsPerBar,
        bpm,
        keyLockEnabled: snap.keyLockEnabled,
        harmonyTrack,
        songKeyRoot,
        songKeyMode,
      },
    };
  }, [
    bpm,
    harmonyTracks,
    se2BeatsPerBar,
    songKeyMode,
    songKeyRoot,
    track.beatPadsSpread,
    track.name,
  ]);

  const handleExportSpreadMidi = useCallback(
    async (targetTrackIndex: number) => {
      if (!onExportBeatPadsSpreadMidiToTrack) return;
      const ctx = buildSpreadExportContext();
      if (!ctx) {
        flashExportStatus('Nothing to export — paint spread notes first');
        return;
      }
      try {
        flashExportStatus('Exporting spread MIDI…');
        const notes = beatPadsSpreadToStudioNotes(ctx.exportArgs);
        await downloadBeatPadsSpreadMidiFile({
          ...ctx.exportArgs,
          filenameBase: ctx.filenameBase,
        });
        const ok = onExportBeatPadsSpreadMidiToTrack({
          targetTrackIndex,
          notes,
          loopBars: ctx.snap.loopBars,
        });
        flashExportStatus(
          ok === false ? 'Choose an SE2 instrument (MIDI) lane' : 'Spread MIDI sent to SE2 instrument lane',
        );
      } catch (err) {
        flashExportStatus(err instanceof Error ? err.message : 'Spread MIDI export failed');
      }
    },
    [buildSpreadExportContext, flashExportStatus, onExportBeatPadsSpreadMidiToTrack],
  );

  const handleExportSpreadWav = useCallback(
    async (targetTrackIndex: number) => {
      if (!onExportBeatPadsSpreadWavToTrack) return;
      const ctx = buildSpreadExportContext();
      if (!ctx) {
        flashExportStatus('Nothing to export — paint spread notes first');
        return;
      }
      try {
        flashExportStatus('Rendering spread WAV…');
        const session = await buildBeatPadsExportSession();
        const buffer = await renderBeatPadsSpreadToAudioBuffer({
          ...ctx.exportArgs,
          spread: ctx.snap,
          session,
          trackVolume127,
        });
        await downloadBeatPadsSpreadWav({
          ...ctx.exportArgs,
          spread: ctx.snap,
          session,
          trackVolume127,
          filenameBase: ctx.filenameBase,
        });
        const ok = onExportBeatPadsSpreadWavToTrack({
          targetTrackIndex,
          buffer,
          loopBars: ctx.snap.loopBars,
          bpm,
          sourceLabel: ctx.filenameBase,
        });
        flashExportStatus(
          ok === false ? 'Choose an SE2 Audio lane' : 'Spread WAV bounced to SE2 audio lane',
        );
      } catch (err) {
        flashExportStatus(err instanceof Error ? err.message : 'Spread WAV export failed');
      }
    },
    [
      bpm,
      buildBeatPadsExportSession,
      buildSpreadExportContext,
      flashExportStatus,
      onExportBeatPadsSpreadWavToTrack,
      trackVolume127,
    ],
  );

  const padLabels = useMemo(
    () => se2BeatPadsPadLabelsForTrack(track.id, track.beatPadsProducerKitId ?? 'trapDarkVault'),
    [track.beatPadsProducerKitId, track.id],
  );

  const handleExportLanes = useCallback(
    async (req: Se2BeatPadsLaneExportRequest) => {
      if (!onExportBeatPadsLanesToTracks) return;
      const lanes = req.lanes.filter((lane) =>
        beatPadsLaneHasHits(pattern, lane, loopBars, stepsPerBar),
      );
      if (lanes.length === 0) {
        flashExportStatus('Nothing to export — selected pads have no steps');
        return;
      }
      const wantWav = req.format === 'wav' || req.format === 'both';
      const wantMidi = req.format === 'midi' || req.format === 'both';
      try {
        flashExportStatus('Exporting pads to SE2…');
        const session = await buildBeatPadsExportSession();
        const exportLanes: {
          padIndex: number;
          label: string;
          wav?: { buffer: AudioBuffer; loopBars: number; bpm: number };
          midi?: { notes: Se2BeatPadsTimelineNote[]; loopBars: number };
        }[] = [];

        for (const padIndex of lanes) {
          const label = padLabels[padIndex] ?? `Pad ${padIndex + 1}`;
          const lanePayload: (typeof exportLanes)[number] = { padIndex, label };
          if (wantWav) {
            const buffer = await renderBeatPadsLoopToAudioBuffer({
              pattern,
              loopBars,
              stepsPerBar,
              bpm,
              beatsPerBar: se2BeatsPerBar,
              session,
              trackVolume127,
              kickKeySemi,
              kickKeyLockTrack: track,
              lanes: [padIndex],
            });
            lanePayload.wav = { buffer, loopBars, bpm };
          }
          if (wantMidi) {
            const notes = beatPadsLaneToStudioNotes(pattern, padIndex, {
              loopBars,
              stepsPerBar,
              beatsPerBar: se2BeatsPerBar,
            });
            if (notes.length > 0) {
              lanePayload.midi = { notes, loopBars };
            }
          }
          if (lanePayload.wav || lanePayload.midi) {
            exportLanes.push(lanePayload);
          }
        }

        const result = onExportBeatPadsLanesToTracks({ lanes: exportLanes });
        const created = result?.created ?? exportLanes.length;
        const skipped = result?.skipped ?? 0;
        flashExportStatus(
          skipped > 0
            ? `Exported ${created} track(s) — ${skipped} skipped (track limit)`
            : `Exported ${created} track(s) to SE2`,
        );
      } catch (err) {
        flashExportStatus(err instanceof Error ? err.message : 'Pad export failed');
      }
    },
    [
      bpm,
      buildBeatPadsExportSession,
      flashExportStatus,
      kickKeySemi,
      loopBars,
      onExportBeatPadsLanesToTracks,
      padLabels,
      pattern,
      se2BeatsPerBar,
      stepsPerBar,
      track,
      trackVolume127,
    ],
  );

  const exportBridge = useMemo(
    () =>
      onExportBeatPadsLanesToTracks
        ? {
            padLabels,
            disabled,
            exportStatus,
            runLaneExport: handleExportLanes,
          }
        : null,
    [disabled, exportStatus, handleExportLanes, onExportBeatPadsLanesToTracks, padLabels],
  );

  useRegisterSe2BeatPadsExportBridge(exportBridge);

  const sampler = useSe2BeatPadsSampler({
    trackId: track.id,
    trackIndex,
    bpm,
    sessionBpm: bpm,
    ensureCtx,
    getTrackStripInput,
    getMasterOutput,
    trackVolume127,
    producerKitId: track.beatPadsProducerKitId,
    matchedPresetId,
    onMatchedPresetIdChange,
    onProducerKitIdChange: (kitId) => onProducerKitIdChange?.(trackIndex, kitId),
    onPadStoreChanged,
    disabled,
    autoBootstrapKit,
    kickKeySemi,
    kickTargetPad,
    onKickTargetPadChange: (pad) => onBeatPadsKickTargetPadChange?.(pad),
    harmonyTracks,
    songKeyRoot,
    songKeyMode,
    beatsPerBar: se2BeatsPerBar,
    beatPadsSpreadSnapshot: track.beatPadsSpread ?? null,
    onBeatPadsSpreadChange,
  });

  const patternControl = useMemo(
    () => ({
      pattern,
      loopBars,
      stepsPerBar,
      onPatternChange: handlePatternChange,
      onLoopBarsChange: handleLoopBarsChange,
      onStepsPerBarChange: handleStepsPerBarChange,
    }),
    [pattern, loopBars, stepsPerBar, handlePatternChange, handleLoopBarsChange, handleStepsPerBarChange],
  );

  return (
    <div className="se2-beat-pads-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      {harmonyTracks && onBeatPadsHarmonyTrackIdChange ? (
        <div className="se2-beat-pads-harmony-strip shrink-0">
        <Se2BeatPadsHarmonyStrip
          track={track}
          tracks={harmonyTracks}
          songKeyRoot={songKeyRoot}
          songKeyMode={songKeyMode}
          sessionBpm={bpm}
          sessionLoopBars={sessionLoopBars}
          disabled={disabled}
          kickTargetPad={sampler.selectedPad}
          onHarmonyTrackIdChange={onBeatPadsHarmonyTrackIdChange}
          onHarmonyLockedChange={(locked) => onBeatPadsHarmonyLockedChange?.(locked)}
          onPatternStyleChange={(style) => onBeatPadsPatternStyleChange?.(style)}
          onSyncFromHarmony={() => onBeatPadsSyncFromHarmony?.()}
          onLoadMatchedPattern={() => {
            if (!onBeatPadsLoadMatchedPattern) return;
            setLoadingPattern(true);
            void Promise.resolve(onBeatPadsLoadMatchedPattern()).finally(() => setLoadingPattern(false));
          }}
          onKickKeyLockChange={(locked) => {
            onBeatPadsKickKeyLockChange?.(locked);
            if (locked) onBeatPadsKickTargetPadChange?.(sampler.selectedPad);
          }}
          onRegeneratePad={() => {
            if (!onBeatPadsRegeneratePad) return;
            setRegeneratingPad(true);
            void Promise.resolve(onBeatPadsRegeneratePad(sampler.selectedPad)).finally(() =>
              setRegeneratingPad(false),
            );
          }}
          regeneratingPad={regeneratingPad}
          loadingPattern={loadingPattern}
        />
        </div>
      ) : null}
      <input
        ref={sampler.padSampleFileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={sampler.handlePadSampleFile}
      />
      <input
        ref={sampler.trapKitFolderInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aif,.aiff"
        multiple
        // @ts-expect-error — directory picker (Chrome / Edge)
        webkitdirectory=""
        directory=""
        style={{ display: 'none' }}
        onChange={sampler.handleTrapKitFolder}
      />
      <TrapKitBrowserPanel
        open={sampler.trapKitBrowserOpen}
        files={sampler.trapKitBrowserFiles}
        bankLabel="Lane"
        targetPad={sampler.selectedPad}
        onTargetPadChange={sampler.setSelectedPad}
        onClose={() => sampler.setTrapKitBrowserOpen(false)}
        onLoadSample={sampler.loadTrapKitSampleToPad}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <BeatLabDrumMachineOverlay
        {...sampler.overlayProps}
        embeddedMachineChromeOpen={machineChromeOpen}
        onExportToTrack={onExportBeatPadsToAudioTrack ? handleExportToTrack : undefined}
        exportStatus={exportStatus}
        beatPadsSpreadMidiExportTrackOptions={spreadMidiExportTrackOptions}
        beatPadsSpreadWavExportTrackOptions={spreadWavExportTrackOptions}
        beatPadsSpreadDefaultMidiExportTrackIndex={spreadDefaultMidiExportTrackIndex}
        beatPadsSpreadDefaultWavExportTrackIndex={spreadDefaultWavExportTrackIndex}
        onExportBeatPadsSpreadMidi={
          onExportBeatPadsSpreadMidiToTrack ? handleExportSpreadMidi : undefined
        }
        onExportBeatPadsSpreadWav={
          onExportBeatPadsSpreadWavToTrack ? handleExportSpreadWav : undefined
        }
        beatPadsSpreadExportStatus={exportStatus}
        patternControl={patternControl}
        onGenoApplyTransport={(opts) => onApplyTransport(trackIndex, opts)}
        onReportLiveTransport={onReportLiveTransport}
        onGenoHarmonyTrackIdChange={(id, slot) => onHarmonyTrackIdChange(trackIndex, id, slot)}
        sessionLoopBars={sessionLoopBars}
        se2SyncMode={se2SyncMode}
        onSe2SyncModeChange={onSe2SyncModeChange}
        se2TransportPlaying={se2TransportPlaying}
        getSe2PlayheadBeat={getSe2PlayheadBeat}
        getSe2TransportOriginBeat={getSe2TransportOriginBeat}
        onSe2TransportToggle={onSe2TransportToggle}
        se2BeatsPerBar={se2BeatsPerBar}
      />
      </div>
    </div>
  );
}

export function se2BeatPadsPatternToTrackNotes(
  pattern: BeatPadsDrumPattern,
  loopBars: number,
  stepsPerBar: BeatPadsGridStepsPerBar,
): Se2BeatPadsTimelineNote[] {
  return beatPadsPatternToStudioNotes(pattern, { loopBars, stepsPerBar });
}
