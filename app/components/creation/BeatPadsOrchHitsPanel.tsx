'use client';

/**
 * Beat Pads — ORCH hits Lab (Sound Families orchestra hits on a piano grid).
 * Local Play/Stop loop, progression chord lock, presets/generate, Sync / Export to SE2 track.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { setBeatPadsPlaylineAtCol } from '@/app/lib/creationStation/beatPadsPlaylineWapi';
import { BeatPadsInstrumentAnalogKnob } from '@/app/components/creation/BeatPadsInstrumentAnalogKnob';
import { Se2Lab808ChordLockPanel } from '@/app/components/studio/Se2Lab808ChordLockPanel';
import {
  se2Lab808ChordLockConnected,
  se2Lab808ProgressionRoots,
  type Se2Lab808ChordLockHarmonyTrack,
} from '@/app/lib/studio/se2Lab808ChordLock';
import {
  BEAT_PADS_ORCH_HITS_PRESET_GENRES,
  beatPadsOrchHitsApplyPreset,
  beatPadsOrchHitsRootMidiPerBar,
  getBeatPadsOrchHitsPresets,
  type BeatPadsOrchHitsPresetGenre,
} from '@/app/lib/studio/beatPadsOrchHitsPresets';
import { beatPadsOrchHitsToRollNotes } from '@/app/lib/studio/se2BeatPadsOrchHitsExport';
import { auditionBeatPadsOrchHit } from '@/app/lib/studio/se2BeatPadsOrchHitsTransport';
import { useBeatPadsOrchHitsToneGridTransport } from '@/app/lib/studio/useBeatPadsOrchHitsToneGridTransport';
import {
  BEAT_PADS_ORCH_HIT_IDS,
  BEAT_PADS_ORCH_HIT_LABELS,
  BEAT_PADS_ORCH_HITS_LOOP_BARS_OPTIONS,
  BEAT_PADS_ORCH_HITS_PIANO_LANES,
  BEAT_PADS_ORCH_HITS_STEPS_PER_BAR,
  beatPadsOrchHitsDuplicateFourBars,
  beatPadsOrchHitsHasHits,
  beatPadsOrchHitsMidiForLane,
  beatPadsOrchHitsNormalizeLoopBars,
  beatPadsOrchHitsPlaceRootsOnBars,
  beatPadsOrchHitsStepCount,
  normalizeBeatPadsOrchHitsGrid,
  resolveBeatPadsOrchHitId,
  type BeatPadsOrchHitsLoopBars,
  type BeatPadsOrchHitsVoice,
} from '@/app/lib/studio/se2BeatPadsOrchHitsVoice';

export const BEAT_PADS_ORCH_HITS_ACCENT = '#F5A623';
const ORCH_HITS_LABEL_W = 44;

export type BeatPadsOrchHitsExportTrackOption = {
  trackIndex: number;
  label: string;
};

export type BeatPadsOrchHitsPanelProps = {
  bpm: number;
  accentHex?: string;
  disabled?: boolean;
  trackId: string;
  songKeyRoot: number;
  songKeyMode: ChordMode;
  studioTracks?: readonly Se2Lab808ChordLockHarmonyTrack[];
  lanePad?: number;
  voice: BeatPadsOrchHitsVoice;
  onVoiceChange: (voice: BeatPadsOrchHitsVoice) => void;
  syncedToBeatPads?: boolean;
  onSyncedToBeatPadsChange?: (synced: boolean) => void;
  getAudioContext: () => AudioContext | null;
  getPreviewDestination: (ctx: AudioContext) => AudioNode | null;
  warmAudio?: () => void | Promise<void>;
  fullBleed?: boolean;
  /** SE2 instrument lanes that can receive ORCH MIDI. */
  exportTrackOptions?: readonly BeatPadsOrchHitsExportTrackOption[];
  onExportMidiToTrack?: (args: {
    targetTrackIndex: number;
    notes: { pitch: number; startBeat: number; durationBeats: number; velocity: number }[];
    loopBars: number;
  }) => boolean | void;
};

function noteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${names[pc]}${oct}`;
}

function toolBtn(active: boolean, accent: string, danger = false): CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 700,
    padding: '3px 9px',
    borderRadius: 4,
    border: `1px solid ${danger ? '#666' : accent}`,
    background: active ? `${accent}33` : danger ? 'transparent' : `${accent}18`,
    color: active ? accent : danger ? '#999' : accent,
    cursor: 'pointer',
  };
}

export function BeatPadsOrchHitsPanel({
  bpm,
  accentHex = BEAT_PADS_ORCH_HITS_ACCENT,
  disabled = false,
  trackId,
  songKeyRoot,
  songKeyMode,
  studioTracks = [],
  lanePad = 2,
  voice,
  onVoiceChange,
  syncedToBeatPads = false,
  onSyncedToBeatPadsChange,
  getAudioContext,
  getPreviewDestination,
  warmAudio,
  fullBleed = false,
  exportTrackOptions = [],
  onExportMidiToTrack,
}: BeatPadsOrchHitsPanelProps) {
  const loopBars = beatPadsOrchHitsNormalizeLoopBars(voice.loopBars);
  const cols = beatPadsOrchHitsStepCount(loopBars);
  const grid = useMemo(
    () => normalizeBeatPadsOrchHitsGrid(voice.gridSteps, loopBars),
    [voice.gridSteps, loopBars],
  );
  const hasHits = beatPadsOrchHitsHasHits(grid);

  const [presetGenre, setPresetGenre] = useState<BeatPadsOrchHitsPresetGenre>('trap');
  const [presetId, setPresetId] = useState(getBeatPadsOrchHitsPresets('trap')[0]?.id ?? '');
  const [genSeed, setGenSeed] = useState(1);
  const [status, setStatus] = useState<string | null>(null);
  const [exportTrackIndex, setExportTrackIndex] = useState<number | ''>('');
  const playlineElRef = useRef<HTMLDivElement | null>(null);
  const gridWrapRef = useRef<HTMLDivElement | null>(null);
  const [colW, setColW] = useState(12);
  /** After Generate/Regen, restart ORCH preview once the new voice commits. */
  const pendingOrchRestartRef = useRef(false);
  const scrubbingRef = useRef(false);

  const presets = useMemo(() => getBeatPadsOrchHitsPresets(presetGenre), [presetGenre]);
  useEffect(() => {
    if (!presets.some((p) => p.id === presetId)) {
      setPresetId(presets[0]?.id ?? '');
    }
  }, [presets, presetId]);

  useEffect(() => {
    if (exportTrackIndex !== '' && exportTrackOptions.some((o) => o.trackIndex === exportTrackIndex)) {
      return;
    }
    setExportTrackIndex(exportTrackOptions[0]?.trackIndex ?? '');
  }, [exportTrackOptions, exportTrackIndex]);

  useEffect(() => {
    const el = gridWrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const labelW = 44;
      const next = Math.max(10, Math.floor((w - labelW) / Math.max(1, cols)));
      setColW(next);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [cols]);

  const { playing, playheadCol, play, stop, stopOrResetToStart, seekCol, restartFromStart } =
    useBeatPadsOrchHitsToneGridTransport({
      stepCount: cols,
      bpm,
      voice,
      disabled,
      colWidthPx: colW,
      playlineElRef,
      getAudioContext,
      getPreviewDestination,
    });

  useEffect(() => {
    if (playing) return;
    setBeatPadsPlaylineAtCol(playlineElRef.current, Math.floor(playheadCol), colW);
  }, [colW, playheadCol, playing]);

  useEffect(() => {
    if (cols > 0 && Math.floor(playheadCol) >= cols) seekCol(0);
  }, [cols, playheadCol, seekCol]);

  const seekColFromClientX = useCallback(
    (clientX: number) => {
      if (disabled || cols <= 0) return;
      const grid = gridWrapRef.current?.querySelector('[data-orch-hits-grid]') as HTMLElement | null;
      if (!grid) return;
      const rect = grid.getBoundingClientRect();
      const x = clientX - rect.left - ORCH_HITS_LABEL_W;
      const cellW = Math.max(1, colW);
      const col = Math.max(0, Math.min(cols - 1, Math.floor(x / cellW)));
      seekCol(col);
    },
    [colW, cols, disabled, seekCol],
  );

  const onScrubPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (disabled || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      scrubbingRef.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
      seekColFromClientX(e.clientX);
    },
    [disabled, seekColFromClientX],
  );

  const onScrubPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!scrubbingRef.current) return;
      seekColFromClientX(e.clientX);
    },
    [seekColFromClientX],
  );

  const endScrub = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
  }, []);

  const progressionRoots = useMemo(
    () =>
      se2Lab808ProgressionRoots({
        tracks: studioTracks,
        lab808TrackId: trackId,
        lock: voice.chordLock,
        songKeyRoot,
        songKeyMode,
        loopBars,
      }),
    [studioTracks, trackId, voice.chordLock, songKeyRoot, songKeyMode, loopBars],
  );
  const chordConnected = se2Lab808ChordLockConnected(voice.chordLock, progressionRoots);

  const patch = useCallback(
    (partial: Partial<BeatPadsOrchHitsVoice>) => {
      if (disabled) return;
      onVoiceChange({ ...voice, ...partial });
    },
    [disabled, onVoiceChange, voice],
  );

  const flash = useCallback((msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 3500);
  }, []);

  const setLoopBars = useCallback(
    (bars: BeatPadsOrchHitsLoopBars) => {
      if (disabled || bars === voice.loopBars) return;
      if (playing) stop();
      seekCol(0);
      patch({
        loopBars: bars,
        gridSteps: normalizeBeatPadsOrchHitsGrid(voice.gridSteps, bars),
      });
    },
    [disabled, patch, playing, seekCol, stop, voice.gridSteps, voice.loopBars],
  );

  const toggleCell = useCallback(
    (lane: number, col: number) => {
      if (disabled) return;
      const next = grid.map((row) => [...row]);
      const row = next[lane];
      if (!row) return;
      row[col] = !row[col];
      patch({ gridSteps: next });
    },
    [disabled, grid, patch],
  );

  const audition = useCallback(
    (midi?: number) => {
      void warmAudio?.();
      const ctx = getAudioContext();
      if (!ctx || ctx.state === 'closed') return;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      const dest = getPreviewDestination(ctx) ?? ctx.destination;
      auditionBeatPadsOrchHit(ctx, voice, dest, midi);
    },
    [getAudioContext, getPreviewDestination, voice, warmAudio],
  );

  const placeRoots = useCallback(() => {
    if (disabled) return;
    const perBar = beatPadsOrchHitsRootMidiPerBar(progressionRoots, loopBars, voice.baseMidi);
    onVoiceChange(beatPadsOrchHitsPlaceRootsOnBars(voice, perBar));
    flash(
      voice.chordLock.enabled
        ? 'Placed on progression roots'
        : 'Placed on song-key roots — enable Chord lock + pick a track for song chords',
    );
  }, [disabled, flash, loopBars, onVoiceChange, progressionRoots, voice]);

  const applySelectedPreset = useCallback(
    (seed: number) => {
      if (disabled) return;
      const preset = presets.find((p) => p.id === presetId) ?? presets[0];
      if (!preset) return;
      // Keep the Sound Families hit the user picked — only rewrite hit placement.
      const next = beatPadsOrchHitsApplyPreset(voice, preset, progressionRoots, seed);
      const wasPlaying = playing;
      if (wasPlaying) stop();
      setGenSeed(seed);
      onVoiceChange(next);
      flash(`Generated · ${preset.name}`);
      pendingOrchRestartRef.current = wasPlaying;
      if (!wasPlaying) void restartFromStart();
    },
    [disabled, flash, onVoiceChange, playing, presetId, presets, progressionRoots, restartFromStart, stop, voice],
  );

  useEffect(() => {
    if (!pendingOrchRestartRef.current) return;
    pendingOrchRestartRef.current = false;
    void play();
  }, [voice.gridSteps, voice.hitId, play]);

  const clearGrid = useCallback(() => {
    if (disabled) return;
    patch({ gridSteps: normalizeBeatPadsOrchHitsGrid([], loopBars) });
  }, [disabled, loopBars, patch]);

  const duplicateFourBars = useCallback(() => {
    if (disabled) return;
    if (playing) stop();
    onVoiceChange(beatPadsOrchHitsDuplicateFourBars(voice));
    flash(loopBars === 4 ? 'Duplicated 4 → 8 bars' : 'Duplicated bars 1–4 onto bars 5–8');
  }, [disabled, flash, loopBars, onVoiceChange, playing, stop, voice]);

  const toggleSync = useCallback(() => {
    if (disabled || !onSyncedToBeatPadsChange) return;
    if (playing) stop();
    onSyncedToBeatPadsChange(!syncedToBeatPads);
  }, [disabled, onSyncedToBeatPadsChange, playing, stop, syncedToBeatPads]);

  const handlePlay = useCallback(async () => {
    void warmAudio?.();
    await play();
  }, [play, warmAudio]);

  const handleExport = useCallback(() => {
    if (!onExportMidiToTrack || exportTrackIndex === '' || !hasHits) return;
    const notes = beatPadsOrchHitsToRollNotes(voice);
    if (!notes.length) {
      flash('No hits to export');
      return;
    }
    const ok = onExportMidiToTrack({
      targetTrackIndex: exportTrackIndex,
      notes,
      loopBars,
    });
    flash(ok === false ? 'Pick an SE2 instrument (MIDI) lane' : 'ORCH hits exported to SE2 track');
  }, [exportTrackIndex, flash, hasHits, loopBars, onExportMidiToTrack, voice]);

  const selectedHitIdx = Math.max(
    0,
    BEAT_PADS_ORCH_HIT_IDS.findIndex((id) => id === resolveBeatPadsOrchHitId(voice.hitId)),
  );

  return (
    <div
      className={
        fullBleed
          ? 'beat-pads-orch-hits-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border'
          : 'beat-pads-orch-hits-panel flex shrink-0 flex-col overflow-hidden rounded-md border'
      }
      style={{
        borderColor: `${accentHex}99`,
        background: 'linear-gradient(165deg, #1a1408 0%, #0a0804 100%)',
        boxShadow: '0 4px 18px rgba(0,0,0,0.7)',
        ...(fullBleed ? { height: '100%', width: '100%' } : { maxHeight: 520 }),
      }}
    >
      {/* One control strip per row — nothing absolute / side-stacked that can overlap. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          flexShrink: 0,
          borderBottom: `1px solid ${accentHex}44`,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            overflowX: 'auto',
          }}
        >
          <span
            style={{
              color: accentHex,
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: 0.4,
              flexShrink: 0,
            }}
          >
            ORCH hits
          </span>
          {BEAT_PADS_ORCH_HITS_LOOP_BARS_OPTIONS.map((b) => (
            <button
              key={b}
              type="button"
              disabled={disabled}
              onClick={() => setLoopBars(b)}
              style={{
                fontSize: 10,
                padding: '3px 8px',
                borderRadius: 4,
                border: `1px solid ${loopBars === b ? accentHex : '#444'}`,
                background: loopBars === b ? `${accentHex}33` : 'transparent',
                color: loopBars === b ? accentHex : '#bbb',
                flexShrink: 0,
              }}
            >
              {b} bars
            </button>
          ))}
          <button
            type="button"
            disabled={disabled || playing}
            onClick={() => void handlePlay()}
            style={{ ...toolBtn(playing, accentHex), flexShrink: 0 }}
            title="Play ORCH loop from the parked playhead"
          >
            Play
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={stopOrResetToStart}
            style={{ ...toolBtn(playing, accentHex), flexShrink: 0 }}
            title={
              playing
                ? 'Stop — parks playhead here (Play resumes from this spot)'
                : 'Reset playhead to the start of the grid'
            }
          >
            Stop
          </button>
          <span style={{ color: '#8a8070', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
            {Math.floor(playheadCol) + 1}/{cols}
          </span>
          <button
            type="button"
            disabled={disabled || !onSyncedToBeatPadsChange}
            onClick={toggleSync}
            style={{
              fontSize: 10,
              padding: '3px 8px',
              borderRadius: 4,
              border: `1px solid ${syncedToBeatPads ? '#4ade80' : accentHex}`,
              background: syncedToBeatPads ? 'rgba(74,222,128,0.2)' : `${accentHex}22`,
              color: syncedToBeatPads ? '#4ade80' : accentHex,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {syncedToBeatPads ? 'Synced' : 'Sync to BeatPads'}
          </button>
          <div style={{ flexShrink: 0, marginLeft: 4 }}>
            <BeatPadsInstrumentAnalogKnob
              label="Vol"
              value={Math.max(0, Math.min(1.5, voice.level ?? 1))}
              min={0}
              max={1.5}
              step={0.01}
              disabled={disabled}
              accent={accentHex}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(level) => patch({ level })}
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
            gap: 6,
            padding: '6px 8px',
            borderTop: '1px solid #333',
            overflowX: 'auto',
          }}
        >
          <label style={{ color: '#aaa', fontSize: 10, flexShrink: 0 }}>Hit</label>
          <select
            disabled={disabled}
            value={resolveBeatPadsOrchHitId(voice.hitId)}
            onChange={(e) => {
              const hitId = resolveBeatPadsOrchHitId(e.target.value);
              patch({ hitId });
              audition();
            }}
            style={{
              fontSize: 11,
              background: '#111',
              color: '#eee',
              border: '1px solid #555',
              borderRadius: 4,
              padding: '2px 6px',
              maxWidth: 150,
              flexShrink: 0,
            }}
          >
            {BEAT_PADS_ORCH_HIT_IDS.map((id, i) => (
              <option key={id} value={id}>
                {i + 1}. {BEAT_PADS_ORCH_HIT_LABELS[i]}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: 4 }}>
            {BEAT_PADS_ORCH_HIT_IDS.map((id, i) => (
              <button
                key={id}
                type="button"
                title={BEAT_PADS_ORCH_HIT_LABELS[i]}
                disabled={disabled}
                onClick={() => {
                  patch({ hitId: id });
                  audition();
                }}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  fontSize: 9,
                  border: `1px solid ${selectedHitIdx === i ? accentHex : '#555'}`,
                  background: selectedHitIdx === i ? `${accentHex}44` : '#1a1a1a',
                  color: selectedHitIdx === i ? accentHex : '#999',
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Key alone — never share this row with Place / Clear / Genre */}
        <div
          style={{
            display: 'block',
            padding: '6px 8px',
            borderTop: '1px solid #333',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ width: '100%', maxWidth: 220 }}>
            <Se2Lab808ChordLockPanel
              lock={voice.chordLock}
              rootCount={progressionRoots.length}
              connected={chordConnected}
              disabled={disabled}
              songKeyRoot={songKeyRoot}
              songKeyMode={songKeyMode}
              lab808TrackId={trackId}
              tracks={studioTracks}
              lanePad={lanePad}
              onLockChange={(chordLock) => patch({ chordLock })}
            />
          </div>
        </div>

        {/* Place / Clear on their own row under Key */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderTop: '1px solid #333',
            overflowX: 'auto',
            position: 'relative',
            zIndex: 1,
            background: 'rgba(10, 8, 4, 0.96)',
          }}
        >
          <button type="button" disabled={disabled} onClick={placeRoots} style={{ ...toolBtn(false, accentHex), flexShrink: 0 }}>
            Place on roots
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={clearGrid}
            style={{ ...toolBtn(false, accentHex, true), flexShrink: 0 }}
          >
            Clear
          </button>
          <button
            type="button"
            disabled={disabled || !hasHits}
            onClick={duplicateFourBars}
            style={{ ...toolBtn(false, accentHex), flexShrink: 0 }}
            title="Copy bars 1–4 onto bars 5–8 (expands to 8 if needed)"
          >
            Duplicate 4→8
          </button>
        </div>

        {/* Genre chips alone — never share space with Place / Clear */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
            gap: 6,
            padding: '6px 8px',
            borderTop: '1px solid #333',
            overflowX: 'auto',
            position: 'relative',
            zIndex: 1,
            background: 'rgba(10, 8, 4, 0.96)',
          }}
        >
          <label style={{ color: '#aaa', fontSize: 10, flexShrink: 0 }}>Genre</label>
          {BEAT_PADS_ORCH_HITS_PRESET_GENRES.map((g) => {
            const on = presetGenre === g.id;
            return (
              <button
                key={g.id}
                type="button"
                disabled={disabled}
                onClick={() => setPresetGenre(g.id)}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 4,
                  border: `1px solid ${on ? accentHex : '#555'}`,
                  background: on ? `${accentHex}33` : '#141210',
                  color: on ? accentHex : '#ccc',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {g.label}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
            gap: 6,
            padding: '6px 8px',
            borderTop: '1px solid #333',
            overflowX: 'auto',
          }}
        >
          <label style={{ color: '#aaa', fontSize: 10, flexShrink: 0 }}>Placement</label>
          <select
            disabled={disabled}
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            style={{
              fontSize: 11,
              background: '#111',
              color: '#eee',
              border: '1px solid #555',
              borderRadius: 4,
              padding: '3px 8px',
              minWidth: 140,
              flexShrink: 0,
            }}
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={disabled || !presets.length}
            onClick={() => applySelectedPreset(genSeed || 1)}
            style={{ ...toolBtn(false, accentHex), flexShrink: 0 }}
            title="Generate hits from preset + chord roots"
          >
            Generate
          </button>
          <button
            type="button"
            disabled={disabled || !presets.length}
            onClick={() => applySelectedPreset((genSeed || 1) + 1)}
            style={{ ...toolBtn(false, accentHex), flexShrink: 0 }}
            title="Regenerate with a new variation"
          >
            Regen
          </button>
          {onExportMidiToTrack ? (
            <>
              <label style={{ color: '#aaa', fontSize: 10, flexShrink: 0, marginLeft: 4 }}>Export</label>
              <select
                disabled={disabled || !exportTrackOptions.length || !hasHits}
                value={exportTrackIndex === '' ? '' : String(exportTrackIndex)}
                onChange={(e) => {
                  const v = e.target.value;
                  setExportTrackIndex(v === '' ? '' : Number(v));
                }}
                style={{
                  fontSize: 11,
                  background: '#111',
                  color: '#eee',
                  border: '1px solid #555',
                  borderRadius: 4,
                  padding: '3px 8px',
                  minWidth: 140,
                  flexShrink: 0,
                }}
                title="Export ORCH MIDI to any SE2 instrument track"
              >
                {!exportTrackOptions.length ? (
                  <option value="">No MIDI tracks</option>
                ) : (
                  exportTrackOptions.map((o) => (
                    <option key={o.trackIndex} value={o.trackIndex}>
                      {o.label}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                disabled={disabled || !hasHits || exportTrackIndex === ''}
                onClick={handleExport}
                style={{ ...toolBtn(false, accentHex), flexShrink: 0 }}
              >
                Export to track
              </button>
            </>
          ) : null}
          {status ? (
            <span style={{ color: accentHex, fontSize: 10, fontWeight: 600, flexShrink: 0 }}>{status}</span>
          ) : null}
        </div>
      </div>

      <div ref={gridWrapRef} className="relative min-h-0 flex-1 overflow-auto px-1 py-1">
        <div
          data-orch-hits-grid
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: `44px repeat(${cols}, minmax(10px, 1fr))`,
            gap: 1,
            minWidth: 44 + cols * 11,
          }}
        >
          <div
            ref={playlineElRef}
            aria-hidden
            onPointerDown={onScrubPointerDown}
            onPointerMove={onScrubPointerMove}
            onPointerUp={endScrub}
            onPointerCancel={endScrub}
            title={disabled ? undefined : 'Drag playhead'}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 44,
              width: 12,
              marginLeft: -5,
              zIndex: 8,
              pointerEvents: disabled ? 'none' : 'auto',
              cursor: disabled ? 'default' : 'ew-resize',
              touchAction: disabled ? undefined : 'none',
              background: 'transparent',
              willChange: playing ? 'transform' : undefined,
              // While playing WAAPI owns transform; while stopped keep parked column.
              ...(playing
                ? {}
                : {
                    transform: `translate3d(${Math.floor(playheadCol) * Math.max(1, colW)}px, 0, 0)`,
                  }),
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 5,
                top: 0,
                bottom: 0,
                width: 2,
                background: playing ? accentHex : `${accentHex}99`,
                boxShadow: playing ? `0 0 6px ${accentHex}88` : undefined,
                pointerEvents: 'none',
              }}
            />
          </div>
          <div />
          {Array.from({ length: cols }, (_, c) => (
            <div
              key={`h${c}`}
              onPointerDown={onScrubPointerDown}
              onPointerMove={onScrubPointerMove}
              onPointerUp={endScrub}
              onPointerCancel={endScrub}
              title={disabled ? undefined : 'Drag to move playhead'}
              style={{
                fontSize: 8,
                color: c % BEAT_PADS_ORCH_HITS_STEPS_PER_BAR === 0 ? accentHex : '#555',
                textAlign: 'center',
                cursor: disabled ? 'default' : 'ew-resize',
                touchAction: disabled ? undefined : 'none',
                userSelect: 'none',
              }}
            >
              {c % BEAT_PADS_ORCH_HITS_STEPS_PER_BAR === 0
                ? Math.floor(c / BEAT_PADS_ORCH_HITS_STEPS_PER_BAR) + 1
                : ''}
            </div>
          ))}
          {Array.from({ length: BEAT_PADS_ORCH_HITS_PIANO_LANES }, (_, laneFromTop) => {
            const lane = BEAT_PADS_ORCH_HITS_PIANO_LANES - 1 - laneFromTop;
            const midi = beatPadsOrchHitsMidiForLane(voice.baseMidi, lane);
            return (
              <div key={`row-${lane}`} style={{ display: 'contents' }}>
                <button
                  type="button"
                  title={`Audition ${noteName(midi)}`}
                  disabled={disabled}
                  onClick={() => audition(midi)}
                  style={{
                    fontSize: 9,
                    color: '#bbb',
                    textAlign: 'right',
                    paddingRight: 4,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {noteName(midi)}
                </button>
                {Array.from({ length: cols }, (_, col) => {
                  const on = Boolean(grid[lane]?.[col]);
                  const barStart = col % BEAT_PADS_ORCH_HITS_STEPS_PER_BAR === 0;
                  return (
                    <button
                      key={`${lane}-${col}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleCell(lane, col)}
                      style={{
                        height: 14,
                        borderRadius: 2,
                        border: barStart ? `1px solid ${accentHex}55` : '1px solid #222',
                        background: on ? accentHex : col % 2 === 0 ? '#141210' : '#0e0c0a',
                        padding: 0,
                        cursor: disabled ? 'default' : 'pointer',
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
