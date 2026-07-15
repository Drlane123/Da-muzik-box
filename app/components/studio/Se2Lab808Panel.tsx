'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BASS_LOW_BASS_ORDER,
  BASS_LOW_BASS_PRESETS,
  EIGHT_ZERO_EIGHT_KICK_ROOT_MIDI,
  TRAP_HOLD_808_ORDER,
  TRAP_HOLD_808_PRESETS,
  lab808MergePresetFilterHints,
  type BassLowBassPresetId,
  type TrapHold808PresetId,
} from '@/app/lib/creationStation/eightZeroEightVoice';
import {
  downloadLab808ToneMidi,
  downloadLab808ToneWav,
  renderLab808ToneToWav,
} from '@/app/lib/creationStation/lab808Export';
import { LAB808_DISPLAY_NAME } from '@/app/lib/creationStation/lab808UiTheme';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { previewSe2Lab808Note } from '@/app/lib/studio/se2Lab808Preview';
import { Se2Lab808ChordLockPanel } from '@/app/components/studio/Se2Lab808ChordLockPanel';
import { Se2Lab808DrumGrid } from '@/app/components/studio/Se2Lab808DrumGrid';
import { Se2Lab808HumBox } from '@/app/components/studio/Se2Lab808HumBox';
import { Se2Lab808PercStrip } from '@/app/components/studio/Se2Lab808PercStrip';
import { Se2Lab808RootScope } from '@/app/components/studio/Se2Lab808RootScope';
import { Se2Lab808TonePads } from '@/app/components/studio/Se2Lab808TonePads';
import {
  se2Lab808ChordLockKey,
  se2Lab808ProgressionRoots,
  se2Lab808ResolveHarmonyTrack,
  type Se2Lab808ChordLockHarmonyTrack,
} from '@/app/lib/studio/se2Lab808ChordLock';
import { se2Lab808GenerateRootGridPattern } from '@/app/lib/studio/se2Lab808RootGridGenerate';
import {
  se2Lab808GenerateSparseLowsPattern,
  type Se2Lab808SparseLowsGenre,
} from '@/app/lib/studio/se2Lab808SparseLowsGenerate';
import { se2Lab808ToneGridHasHits } from '@/app/lib/studio/se2Lab808DrumPattern';
import {
  se2Lab808ToneGridExportRenderOpts,
  se2Lab808ToneGridToExportNotes,
  se2Lab808ToneGridToRollNotes,
  se2Lab808WavBytesToAudioBuffer,
  type Se2Lab808ToneGridRollNote,
} from '@/app/lib/studio/se2Lab808ToneGridExport';
import type { Se2Lab808Track } from '@/app/lib/studio/se2Lab808Track';
import type { Se2Lab808VoiceParams } from '@/app/lib/studio/se2Lab808Types';
import { studioKeyLabel, type StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { CSSProperties } from 'react';

export type Se2Lab808PanelTrack = Se2Lab808Track & {
  id: string;
  colorHex?: string;
  name?: string;
  laneNumber?: number;
};

export type Se2Lab808PanelProps = {
  track: Se2Lab808PanelTrack;
  voice: Se2Lab808VoiceParams;
  bpm: number;
  disabled?: boolean;
  songKeyRoot: number;
  songKeyMode: ChordMode;
  studioTracks: readonly Se2Lab808ChordLockHarmonyTrack[];
  lanePad: number;
  getAudioContext: () => AudioContext;
  getPreviewDestination: (ctx: AudioContext) => AudioNode;
  onVoiceChange: (voice: Se2Lab808VoiceParams) => void;
  onExportToneGridToPianoRoll?: (notes: Se2Lab808ToneGridRollNote[]) => void;
  onExportToneGridWavToTrack?: (args: {
    buffer: AudioBuffer;
    loopBars: number;
    bpm: number;
    sourceTrackName: string;
  }) => void;
  /** Beat Pads dropdown — compact piano-roll 808 Lab (no Root Scope dial). */
  miniature?: boolean;
  /** Override tone-grid Play button label (Beat Pads uses Preview). */
  playButtonLabel?: string;
  /** Transparent accent-colored pads that light up on hit (Beat Pads cyan chrome). */
  accentPads?: boolean;
  /** Warm AudioContext before Hum Box mic capture (Beat Pads). */
  warmAudio?: () => void | Promise<void>;
};

const laneBtn = (active: boolean, accent: string): CSSProperties => ({
  padding: '6px 8px',
  borderRadius: 6,
  border: `1px solid ${active ? `${accent}aa` : '#333340'}`,
  background: active ? `${accent}22` : 'rgba(255,255,255,0.03)',
  color: active ? accent : '#a8a8b8',
  fontSize: 10,
  fontWeight: 800,
  lineHeight: 1.05,
  minHeight: 28,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const sideLabel: CSSProperties = {
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#8a8a98',
};

const genBtn = (accent: string, enabled: boolean, compact = false): CSSProperties => ({
  padding: compact ? '6px 5px' : '6px 8px',
  borderRadius: 6,
  border: `1px solid ${enabled ? `${accent}88` : '#333340'}`,
  background: enabled ? `${accent}18` : 'rgba(255,255,255,0.03)',
  color: enabled ? accent : '#6a6a78',
  fontSize: compact ? 9 : 8,
  fontWeight: 800,
  lineHeight: 1.05,
  minHeight: compact ? 28 : undefined,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  cursor: enabled ? 'pointer' : 'default',
  width: compact ? 'auto' : '100%',
  minWidth: compact ? 72 : undefined,
  whiteSpace: compact ? 'nowrap' : undefined,
  textAlign: 'center',
  display: compact ? 'flex' : undefined,
  alignItems: compact ? 'center' : undefined,
  justifyContent: compact ? 'center' : undefined,
  opacity: enabled ? 1 : 0.55,
});

export function Se2Lab808Panel({
  track,
  voice,
  bpm,
  disabled = false,
  songKeyRoot,
  songKeyMode,
  studioTracks,
  lanePad,
  getAudioContext,
  getPreviewDestination,
  onVoiceChange,
  onExportToneGridToPianoRoll,
  onExportToneGridWavToTrack,
  miniature = false,
  playButtonLabel,
  accentPads = false,
  warmAudio,
}: Se2Lab808PanelProps) {
  const accent = track.colorHex ?? '#E8784A';
  const isKick = voice.soundLane === 'kick';
  const presetOptions = isKick ? TRAP_HOLD_808_ORDER : BASS_LOW_BASS_ORDER;
  const presetId = isKick ? voice.kickPresetId : voice.bassPresetId;

  const [livePitchClass, setLivePitchClass] = useState<number | null>(null);
  const [selectedRootIndex, setSelectedRootIndex] = useState<number | null>(null);
  const [gridStatus, setGridStatus] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  /** Sparse chord-progression lows tab (R&B / Trap / Reggae) — separate from Generate roots. */
  const [lowsTabOpen, setLowsTabOpen] = useState(false);
  const [lowsGenre, setLowsGenre] = useState<Se2Lab808SparseLowsGenre>('trap');
  const lowsSeedRef = useRef(1);
  const lowsWrapRef = useRef<HTMLDivElement | null>(null);
  const exportStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close Lows panel on outside click (inline beside button — not a covering overlay).
  useEffect(() => {
    if (!lowsTabOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t || lowsWrapRef.current?.contains(t)) return;
      setLowsTabOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLowsTabOpen(false);
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [lowsTabOpen]);

  const toneGridHasHits = useMemo(
    () => se2Lab808ToneGridHasHits(voice.toneGridSteps),
    [voice.toneGridSteps],
  );

  const flashExportStatus = useCallback((msg: string) => {
    setExportStatus(msg);
    if (exportStatusTimerRef.current) clearTimeout(exportStatusTimerRef.current);
    exportStatusTimerRef.current = setTimeout(() => {
      exportStatusTimerRef.current = null;
      setExportStatus(null);
    }, 4000);
  }, []);

  const toneExportNotes = useMemo(() => se2Lab808ToneGridToExportNotes(voice), [voice]);
  const toneExportOpts = useMemo(
    () => se2Lab808ToneGridExportRenderOpts(voice, bpm, track.name),
    [voice, bpm, track.name],
  );

  const handleExportMidi = useCallback(() => {
    if (!toneGridHasHits || exportBusy) return;
    downloadLab808ToneMidi(
      toneExportNotes,
      toneExportOpts,
      `808Lab_${voice.soundLane}`,
    );
    flashExportStatus('✓ MIDI downloaded');
  }, [toneExportNotes, toneExportOpts, toneGridHasHits, exportBusy, voice.soundLane, flashExportStatus]);

  const handleExportWav = useCallback(async () => {
    if (!toneGridHasHits || exportBusy) return;
    setExportBusy(true);
    setExportStatus('Rendering WAV…');
    try {
      await downloadLab808ToneWav(toneExportNotes, toneExportOpts, `808Lab_${voice.soundLane}`);
      flashExportStatus('✓ WAV downloaded');
    } catch (err) {
      flashExportStatus(err instanceof Error ? err.message : 'WAV export failed');
    } finally {
      setExportBusy(false);
    }
  }, [toneExportNotes, toneExportOpts, toneGridHasHits, exportBusy, voice.soundLane, flashExportStatus]);

  const handleToPianoRoll = useCallback(() => {
    if (!toneGridHasHits || exportBusy || !onExportToneGridToPianoRoll) return;
    onExportToneGridToPianoRoll(se2Lab808ToneGridToRollNotes(voice));
    flashExportStatus('✓ Sent to piano roll');
  }, [toneGridHasHits, exportBusy, onExportToneGridToPianoRoll, voice, flashExportStatus]);

  const handleToTrack = useCallback(async () => {
    if (!toneGridHasHits || exportBusy || !onExportToneGridWavToTrack) return;
    setExportBusy(true);
    setExportStatus('Bouncing to track…');
    try {
      const wav = await renderLab808ToneToWav(toneExportNotes, toneExportOpts);
      const buffer = await se2Lab808WavBytesToAudioBuffer(getAudioContext(), wav);
      onExportToneGridWavToTrack({
        buffer,
        loopBars: voice.toneGridLoopBars,
        bpm,
        sourceTrackName: track.name ?? '808 Lab',
      });
      flashExportStatus('✓ Added audio track');
    } catch (err) {
      flashExportStatus(err instanceof Error ? err.message : 'Export to track failed');
    } finally {
      setExportBusy(false);
    }
  }, [
    toneGridHasHits,
    exportBusy,
    onExportToneGridWavToTrack,
    toneExportNotes,
    toneExportOpts,
    getAudioContext,
    voice.toneGridLoopBars,
    bpm,
    track.name,
    flashExportStatus,
  ]);

  const toneGridExport = useMemo(
    () =>
      onExportToneGridToPianoRoll || onExportToneGridWavToTrack
        ? {
            busy: exportBusy,
            status: exportStatus,
            hasHits: toneGridHasHits,
            onExportMidi: handleExportMidi,
            onExportWav: handleExportWav,
            onToPianoRoll: handleToPianoRoll,
            onToTrack: handleToTrack,
          }
        : undefined,
    [
      onExportToneGridToPianoRoll,
      onExportToneGridWavToTrack,
      exportBusy,
      exportStatus,
      toneGridHasHits,
      handleExportMidi,
      handleExportWav,
      handleToPianoRoll,
      handleToTrack,
    ],
  );

  const progressionRoots = useMemo(
    () =>
      se2Lab808ProgressionRoots({
        tracks: studioTracks,
        lab808TrackId: track.id,
        lock: voice.chordLock,
        songKeyRoot,
        songKeyMode,
        loopBars: voice.toneGridLoopBars,
      }),
    [studioTracks, track.id, voice.chordLock, voice.toneGridLoopBars, songKeyRoot, songKeyMode],
  );
  const chordRootLock = voice.chordLock.enabled && progressionRoots.length > 0;

  const harmonySource = useMemo(
    () => se2Lab808ResolveHarmonyTrack(studioTracks, voice.chordLock, track.id),
    [studioTracks, voice.chordLock, track.id],
  );
  const lockKey = useMemo(
    () => se2Lab808ChordLockKey(voice.chordLock, harmonySource, songKeyRoot, songKeyMode),
    [voice.chordLock, harmonySource, songKeyRoot, songKeyMode],
  );
  const keyLabel = studioKeyLabel(lockKey.keyRoot, lockKey.keyMode as StudioDetectedKeyMode);

  const previewMidi = useCallback(
    (midi: number) => {
      if (disabled) return;
      const ctx = getAudioContext();
      previewSe2Lab808Note(
        ctx,
        getPreviewDestination(ctx),
        midi,
        100,
        voice,
        bpm,
        isKick ? 0.35 : 0.75,
      );
      setLivePitchClass(((midi % 12) + 12) % 12);
      window.setTimeout(() => setLivePitchClass(null), 140);
    },
    [bpm, disabled, getAudioContext, getPreviewDestination, isKick, voice],
  );

  const onPadPlay = useCallback((padIndex: number, midi: number) => {
    setSelectedRootIndex(padIndex);
    setLivePitchClass(((midi % 12) + 12) % 12);
    window.setTimeout(() => setLivePitchClass(null), 140);
  }, []);

  const canGenerate = progressionRoots.length > 0;
  const voiceRef = useRef(voice);
  const rootsRef = useRef(progressionRoots);
  const lockKeyRef = useRef(lockKey);
  const seedRef = useRef(voice.rootGenSeed ?? 1);
  voiceRef.current = voice;
  rootsRef.current = progressionRoots;
  lockKeyRef.current = lockKey;
  useEffect(() => {
    seedRef.current = voice.rootGenSeed ?? 1;
  }, [voice.rootGenSeed]);

  const applyGeneratedGrid = useCallback(
    (seed: number) => {
      const v = voiceRef.current;
      const roots = rootsRef.current;
      const key = lockKeyRef.current;
      const result = se2Lab808GenerateRootGridPattern({
        roots,
        loopBars: v.toneGridLoopBars,
        soundLane: v.soundLane,
        seed,
        keyRoot: key.keyRoot,
        keyMode: key.keyMode === 'minor' ? 'minor' : 'major',
        quantize: v.rootGenQuantize ?? '1/8',
        genre: v.rootGenGenre ?? 'trap',
      });
      seedRef.current = seed;
      onVoiceChange({
        ...v,
        toneGridSteps: result.pattern,
        tonePadBaseMidi: result.tonePadBaseMidi,
        rootGenSeed: seed,
      });
      setGridStatus(result.status);
      window.setTimeout(() => setGridStatus(null), 4500);
    },
    [onVoiceChange],
  );

  const handleGenerateRoots = useCallback(() => {
    if (!canGenerate) return;
    applyGeneratedGrid(seedRef.current || 1);
  }, [applyGeneratedGrid, canGenerate]);

  const handleRegenerateRoots = useCallback(() => {
    if (!canGenerate) return;
    // Always advance seed (ref-backed) so each click lands a new in-key pocket.
    applyGeneratedGrid((seedRef.current || 1) + 1);
  }, [applyGeneratedGrid, canGenerate]);

  const applySparseLowsGrid = useCallback(
    (genre: Se2Lab808SparseLowsGenre, seed: number) => {
      const v = voiceRef.current;
      const roots = rootsRef.current;
      const key = lockKeyRef.current;
      const result = se2Lab808GenerateSparseLowsPattern({
        roots,
        loopBars: v.toneGridLoopBars,
        genre,
        seed,
        keyRoot: key.keyRoot,
        keyMode: key.keyMode === 'minor' ? 'minor' : 'major',
      });
      lowsSeedRef.current = seed;
      onVoiceChange({
        ...v,
        toneGridSteps: result.pattern,
        tonePadBaseMidi: result.tonePadBaseMidi,
        rootGenSeed: seed,
      });
      setGridStatus(result.status);
      window.setTimeout(() => setGridStatus(null), 4500);
    },
    [onVoiceChange],
  );

  const handleGenerateLows = useCallback(
    (genre: Se2Lab808SparseLowsGenre) => {
      setLowsGenre(genre);
      applySparseLowsGrid(genre, lowsSeedRef.current || 1);
    },
    [applySparseLowsGrid],
  );

  const handleRegenerateLows = useCallback(() => {
    applySparseLowsGrid(lowsGenre, (lowsSeedRef.current || 1) + 1);
  }, [applySparseLowsGrid, lowsGenre]);

  const tonePadsShared = {
    voice,
    bpm,
    accent,
    disabled,
    chordRootLock,
    progressionRoots,
    selectedRootIndex,
    onPadPlay,
    getAudioContext,
    getPreviewDestination,
    onVoiceChange,
    accentPads,
  };

  return (
    <div
      className={miniature ? 'flex flex-col gap-1 p-1.5' : 'flex flex-col gap-1.5 p-2'}
      data-se2-lab808-panel
      data-se2-lab808-miniature={miniature ? '1' : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-black uppercase tracking-wide" style={{ color: accent }}>
          {LAB808_DISPLAY_NAME}
          {miniature ? ' · Beat Pads' : ''}
        </span>
        <span className="text-[8px]" style={{ color: '#6a6a78' }}>
          {miniature
            ? 'Piano-roll 808 — Preview alone, then export to any SE2 track'
            : 'Standalone lane — not linked to Creation Station'}
        </span>
      </div>

      {/* Sticky at top of dock scroll — was buried under pads before */}
      <div
        className="sticky top-0 z-30 shrink-0"
        style={{
          background: 'rgba(10, 10, 16, 0.96)',
          paddingBottom: 4,
          boxShadow: '0 6px 12px rgba(0,0,0,0.45)',
        }}
      >
        <Se2Lab808PercStrip
          voice={voice}
          accent={accent}
          disabled={false}
          getAudioContext={getAudioContext}
          getPreviewDestination={getPreviewDestination}
          onVoiceChange={onVoiceChange}
        />
      </div>

      <Se2Lab808DrumGrid
        voice={voice}
        bpm={bpm}
        accent={accent}
        disabled={disabled}
        getAudioContext={getAudioContext}
        getPreviewDestination={getPreviewDestination}
        onVoiceChange={onVoiceChange}
        toneGridExport={toneGridExport}
        playButtonLabel={playButtonLabel ?? (miniature ? 'Preview' : 'Play')}
        gridMaxHeightPx={miniature ? 220 : undefined}
        aboveGrid={
          <div className="flex items-start gap-2 min-w-0 w-full">
            <Se2Lab808TonePads {...tonePadsShared} padsOnly size={miniature ? 'default' : 'large'} />

            <aside
              className="relative flex flex-col gap-2.5 shrink-0 min-w-0 overflow-visible"
              style={{ width: miniature ? 188 : 210 }}
            >
              <div className="flex flex-col gap-1">
                <span style={sideLabel}>Lane</span>
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <button
                      type="button"
                      disabled={disabled}
                      style={laneBtn(isKick, accent)}
                      onClick={() => onVoiceChange({ ...voice, soundLane: 'kick' })}
                    >
                      808 Kick
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      style={laneBtn(!isKick, accent)}
                      onClick={() => onVoiceChange({ ...voice, soundLane: 'bass' })}
                    >
                      Bass Low
                    </button>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0 items-stretch">
                    <button
                      type="button"
                      disabled={!canGenerate}
                      style={genBtn('#ca8a04', canGenerate, true)}
                      onClick={handleGenerateRoots}
                      title="Write chord / key roots onto the tone grid"
                    >
                      Generate roots
                    </button>
                    <button
                      type="button"
                      disabled={!canGenerate}
                      style={genBtn(accent, canGenerate, true)}
                      onClick={handleRegenerateRoots}
                      title="Roll a new trap pocket + in-key fills (same key / roots)"
                    >
                      Regenerate
                    </button>
                  </div>
                  {/* Lows beside Gen/Regen; menu is position:absolute so Bass + grid never move. */}
                  <div ref={lowsWrapRef} className="relative shrink-0 self-start">
                    <button
                      type="button"
                      disabled={disabled}
                      style={genBtn(lowsTabOpen ? '#f5a623' : '#c4a574', true, true)}
                      onClick={() => setLowsTabOpen((o) => !o)}
                      title="Dark sparse lows — 2 hits/bar in key (R&B · Trap · Reggae · Dance)"
                    >
                      {lowsTabOpen ? 'Lows ✕' : 'Lows'}
                    </button>
                    {lowsTabOpen ? (
                      <div
                        className="absolute top-0 left-full z-50 flex flex-col gap-1 rounded-md border px-1.5 py-1.5"
                        style={{
                          marginLeft: 6,
                          width: miniature ? 132 : 142,
                          borderColor: '#f5a62366',
                          background: 'rgba(18, 14, 8, 0.98)',
                          boxShadow: '0 6px 18px rgba(0,0,0,0.55)',
                        }}
                      >
                        <span style={{ ...sideLabel, color: '#f5a623' }}>Dark lows</span>
                        <div className="flex flex-col gap-1">
                          {(
                            [
                              ['rnb', 'R&B lows'],
                              ['trap', 'Trap lows'],
                              ['reggae', 'Reggae'],
                              ['dance', 'Dance'],
                            ] as const
                          ).map(([id, label]) => {
                            const on = lowsGenre === id;
                            return (
                              <button
                                key={id}
                                type="button"
                                disabled={disabled}
                                onClick={() => setLowsGenre(id)}
                                style={{
                                  ...laneBtn(on, '#f5a623'),
                                  fontSize: 8,
                                  minHeight: 22,
                                  padding: '3px 5px',
                                }}
                                title={`${label} — dark sparse melodies for drum tracks`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={disabled}
                            style={{ ...genBtn('#f5a623', !disabled, true), flex: 1, minWidth: 0 }}
                            onClick={() => {
                              handleGenerateLows(lowsGenre);
                              setLowsTabOpen(false);
                            }}
                            title={`Generate dark ${
                              lowsGenre === 'rnb'
                                ? 'R&B'
                                : lowsGenre === 'reggae'
                                  ? 'Reggae'
                                  : lowsGenre === 'dance'
                                    ? 'Dance'
                                    : 'Trap'
                            } lows — 2 hits/bar · in key`}
                          >
                            Gen
                          </button>
                          <button
                            type="button"
                            disabled={disabled}
                            style={{ ...genBtn(accent, !disabled, true), flex: 1, minWidth: 0 }}
                            onClick={() => {
                              handleRegenerateLows();
                              setLowsTabOpen(false);
                            }}
                            title="Roll another dark lows melody (same genre · in key)"
                          >
                            Regen
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1 min-w-0">
                <label style={sideLabel}>Preset</label>
                <select
                  disabled={disabled}
                  value={presetId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const nextVoice = isKick
                      ? {
                          ...voice,
                          kickPresetId: id as TrapHold808PresetId,
                          filterFx: lab808MergePresetFilterHints(
                            voice.filterFx,
                            TRAP_HOLD_808_PRESETS[id as TrapHold808PresetId],
                          ),
                        }
                      : {
                          ...voice,
                          bassPresetId: id as BassLowBassPresetId,
                          filterFx: lab808MergePresetFilterHints(
                            voice.filterFx,
                            BASS_LOW_BASS_PRESETS[id as BassLowBassPresetId],
                          ),
                        };
                    onVoiceChange(nextVoice);
                    if (!disabled) {
                      const ctx = getAudioContext();
                      previewSe2Lab808Note(
                        ctx,
                        getPreviewDestination(ctx),
                        Math.max(voice.tonePadBaseMidi, EIGHT_ZERO_EIGHT_KICK_ROOT_MIDI),
                        100,
                        nextVoice,
                        bpm,
                        isKick ? 0.35 : 0.75,
                      );
                    }
                  }}
                  className="w-full rounded border px-2 py-1.5 text-[9px] outline-none"
                  style={{
                    borderColor: '#333340',
                    background: '#0a0a10',
                    color: '#e0e0ea',
                    maxWidth: '100%',
                  }}
                >
                  {presetOptions.map((id) => {
                    const label = isKick
                      ? TRAP_HOLD_808_PRESETS[id as TrapHold808PresetId].label
                      : BASS_LOW_BASS_PRESETS[id as BassLowBassPresetId].label;
                    return (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>

              <Se2Lab808ChordLockPanel
                lock={voice.chordLock}
                rootCount={progressionRoots.length}
                connected={progressionRoots.length > 0}
                disabled={disabled}
                songKeyRoot={songKeyRoot}
                songKeyMode={songKeyMode}
                lab808TrackId={track.id}
                tracks={studioTracks}
                lanePad={lanePad}
                onLockChange={(chordLock) => onVoiceChange({ ...voice, chordLock })}
                besideSource={
                  <span
                    className="shrink-0 text-[7px] font-semibold leading-none whitespace-nowrap"
                    style={{ color: '#8a8a98' }}
                    title={
                      gridStatus ??
                      (canGenerate
                        ? `${progressionRoots.length} roots · ${voice.toneGridLoopBars}-bar · ${keyLabel}`
                        : 'Select key or chord lane')
                    }
                  >
                    {gridStatus ??
                      (canGenerate
                        ? `${progressionRoots.length}r · ${voice.toneGridLoopBars}-bar`
                        : 'Pick key')}
                  </span>
                }
              />
            </aside>

            {!miniature ? (
              <div className="flex-1 flex items-start justify-end gap-2 min-w-0 pl-1">
                <Se2Lab808HumBox
                  bpm={bpm}
                  voice={voice}
                  keyRoot={lockKey.keyRoot}
                  keyMode={lockKey.keyMode === 'minor' ? 'minor' : 'major'}
                  keyLabel={keyLabel}
                  disabled={disabled}
                  getAudioContext={getAudioContext}
                  getPreviewDestination={getPreviewDestination}
                  warmAudio={warmAudio}
                  onVoiceChange={onVoiceChange}
                  onStatus={(msg) => setGridStatus(msg)}
                />
                <Se2Lab808RootScope
                  dialSize={176}
                  keyRoot={lockKey.keyRoot}
                  keyMode={lockKey.keyMode}
                  keyLabel={keyLabel}
                  progressionRoots={progressionRoots}
                  livePitchClass={livePitchClass}
                  selectedRootIndex={selectedRootIndex}
                  disabled={disabled}
                  onSelectRoot={setSelectedRootIndex}
                  onPreviewMidi={previewMidi}
                />
              </div>
            ) : null}
          </div>
        }
      />
    </div>
  );
}
