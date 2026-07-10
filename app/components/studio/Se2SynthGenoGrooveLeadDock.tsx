'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { GenoBarChordSpec } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { Se2SynthGenoPluginDraft } from '@/app/lib/studio/se2SynthGenoChordPlugin';
import {
  Se2SynthGenoLoopChordPianoRoll,
  type Se2SynthGenoLoopChordPianoRollEditState,
  type Se2SynthGenoLoopChordPianoRollHandle,
} from '@/app/components/studio/Se2SynthGenoLoopChordPianoRoll';
import { Se2SynthGenoLoopPianoRollEditToolbar } from '@/app/components/studio/Se2SynthGenoLoopPianoRollEditToolbar';
import {
  se2GrooveLeadPitchRangeForNotes,
} from '@/app/lib/studio/se2GrooveLeadNotes';
import { scheduleSe2GrooveLeadPolyRoll } from '@/app/lib/studio/se2GrooveLeadLegatoPlayback';
import {
  se2SynthGenoDraftChordHitsForGrooveLead,
  se2SynthGenoGrooveLeadTimelineBarCount,
  se2SynthGenoRegenerateGrooveLeadNotes,
} from '@/app/lib/studio/se2SynthGenoGrooveLeadDock';
import { haltWaveLeafVoices } from '@/app/lib/creationStation/waveLeafEngine';
import { bypassWaveLeafLeadChopGate } from '@/app/lib/creationStation/waveLeafLeadChop';
import { se2GrooveLeadB01Voice } from '@/app/lib/studio/se2GrooveLeadTypes';
import {
  GENO_B01_GROOVE_LEAD_STYLE_ID,
} from '@/app/lib/studio/se2SynthGenoLiveGrooveLeadEngine';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import {
  WAVE_LEAF_MELODY_GENRES,
  waveLeafMelodyGenreForStyle,
  waveLeafMelodyStyleById,
  type WaveLeafMelodyStyleId,
} from '@/app/lib/creationStation/waveLeafMelodyStyles';
import { Se2SynthGenoLaneVolumeSlider } from '@/app/components/studio/Se2SynthGenoLaneVolumeSlider';
import { GENO_LANE_PREVIEW_GAIN_DEFAULTS } from '@/app/lib/studio/se2SynthGenoLanePreviewGains';

export type Se2SynthGenoGrooveLeadDockProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grooveLeadNotes: readonly StudioEditor2GenNote[];
  onGrooveLeadNotesChange: (notes: StudioEditor2GenNote[]) => void;
  draft: Se2SynthGenoPluginDraft | null;
  beatsPerBar: number;
  timelineBarCount: number;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  harmonyScaleMode?: ChordMode;
  barChordSpecs?: readonly GenoBarChordSpec[];
  bpm: number;
  disabled?: boolean;
  previewBeat?: number | null;
  onLockToTrack?: () => void;
  canLockToTrack?: boolean;
  getAudioContext?: () => AudioContext;
  getPreviewDestination?: (ctx: AudioContext) => AudioNode;
  trackIndex?: number;
  /** Route B01 to sparse sine-lead engine; omit or b02 for legacy path. */
  genoBuild?: 'b01' | 'b02';
  /** Parent loop preview (▶) — Stop also halts the full Geno loop. */
  onStopPreview?: () => void;
  loopPreviewing?: boolean;
  previewGain?: number;
  onPreviewGainChange?: (gain: number) => void;
};

const GROOVE_LEAD_ACCENT = '#7CF4C6';

function GenoGrooveLeadVibeMenu({
  styleId,
  movement,
  chordFit,
  disabled,
  onStyleIdChange,
  onMovementChange,
  onChordFitChange,
  onRegen,
}: {
  styleId: WaveLeafMelodyStyleId;
  movement: number;
  chordFit: number;
  disabled: boolean;
  onStyleIdChange: (id: WaveLeafMelodyStyleId) => void;
  onMovementChange: (v: number) => void;
  onChordFitChange: (v: number) => void;
  onRegen: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const style = waveLeafMelodyStyleById(styleId);
  const genre = waveLeafMelodyGenreForStyle(styleId);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const applyStyle = (id: WaveLeafMelodyStyleId) => {
    const s = waveLeafMelodyStyleById(id);
    onStyleIdChange(id);
    onMovementChange(s.movement);
    onChordFitChange(s.chordFit);
  };

  return (
    <div ref={rootRef} className="relative shrink-0" style={{ zIndex: 40 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[7px] font-bold uppercase disabled:opacity-40"
        style={{ borderColor: `${GROOVE_LEAD_ACCENT}55`, background: '#0e1c18', color: GROOVE_LEAD_ACCENT }}
        title="Vibe style — Silk Transit, Chorus Lift, etc."
      >
        <span className="truncate max-w-[5.5rem]">{genre.label} · {style.label}</span>
        <ChevronDown size={10} aria-hidden className={open ? 'rotate-180' : ''} />
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full mt-1 w-[11.5rem] rounded border shadow-lg flex flex-col gap-1.5 p-2"
          style={{
            zIndex: 200,
            borderColor: '#1a3a32',
            background: '#0a1614',
            boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
          }}
        >
          <label className="text-[6px] font-bold uppercase tracking-wide" style={{ color: '#5a8a78' }}>
            Genre
          </label>
          <select
            value={genre.id}
            onChange={(e) => {
              const g = WAVE_LEAF_MELODY_GENRES.find((x) => x.id === e.target.value);
              if (g?.styles[0]) applyStyle(g.styles[0].id);
            }}
            className="w-full rounded border px-1 py-0.5 text-[7px] outline-none"
            style={{ borderColor: '#1a3a32', background: '#0c1a18', color: '#c8f5e8' }}
          >
            {WAVE_LEAF_MELODY_GENRES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>

          <label className="text-[6px] font-bold uppercase tracking-wide" style={{ color: '#5a8a78' }}>
            Style
          </label>
          <select
            value={styleId}
            onChange={(e) => applyStyle(e.target.value)}
            className="w-full rounded border px-1 py-0.5 text-[7px] outline-none"
            style={{ borderColor: '#1a3a32', background: '#0c1a18', color: '#c8f5e8' }}
          >
            {WAVE_LEAF_MELODY_GENRES.find((g) => g.id === genre.id)?.styles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <label className="flex items-center justify-between gap-2 text-[6px] font-bold uppercase" style={{ color: '#5a8a78' }}>
            <span>Chord fit</span>
            <span style={{ color: '#8ab8a8' }}>{Math.round(chordFit * 100)}%</span>
          </label>
          <input
            type="range"
            min={0.7}
            max={0.98}
            step={0.01}
            value={chordFit}
            onChange={(e) => onChordFitChange(Number(e.target.value))}
            className="w-full h-1 accent-emerald-400"
          />

          <label className="flex items-center justify-between gap-2 text-[6px] font-bold uppercase" style={{ color: '#5a8a78' }}>
            <span>Movement</span>
            <span style={{ color: '#8ab8a8' }}>{Math.round(movement * 100)}%</span>
          </label>
          <input
            type="range"
            min={0.2}
            max={0.75}
            step={0.01}
            value={movement}
            onChange={(e) => onMovementChange(Number(e.target.value))}
            className="w-full h-1 accent-emerald-400"
          />

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onRegen();
              setOpen(false);
            }}
            className="mt-0.5 w-full rounded border px-2 py-1 text-[7px] font-black uppercase disabled:opacity-40"
            style={{ borderColor: `${GROOVE_LEAD_ACCENT}66`, background: '#14221c', color: GROOVE_LEAD_ACCENT }}
          >
            Regen lead
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Se2SynthGenoGrooveLeadDock({
  open,
  onOpenChange,
  grooveLeadNotes,
  onGrooveLeadNotesChange,
  draft,
  beatsPerBar,
  timelineBarCount,
  keyRoot,
  keyMode,
  harmonyScaleMode,
  barChordSpecs,
  bpm,
  disabled = false,
  previewBeat = null,
  onLockToTrack,
  canLockToTrack = false,
  getAudioContext,
  getPreviewDestination,
  trackIndex = 0,
  genoBuild,
  onStopPreview,
  loopPreviewing = false,
  previewGain = GENO_LANE_PREVIEW_GAIN_DEFAULTS.grooveLead,
  onPreviewGainChange,
}: Se2SynthGenoGrooveLeadDockProps) {
  const defaultStyleId = GENO_B01_GROOVE_LEAD_STYLE_ID;
  const [melodySeed, setMelodySeed] = useState(1);
  const [styleId, setStyleId] = useState<WaveLeafMelodyStyleId>(defaultStyleId);
  const [movement, setMovement] = useState(() => waveLeafMelodyStyleById(defaultStyleId).movement);
  const [chordFit, setChordFit] = useState(() => waveLeafMelodyStyleById(defaultStyleId).chordFit);
  const [localOpen, setLocalOpen] = useState(open);
  const [leadPreviewing, setLeadPreviewing] = useState(false);
  const previewEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pianoRollRef = useRef<Se2SynthGenoLoopChordPianoRollHandle>(null);
  const [rollEdit, setRollEdit] = useState<Se2SynthGenoLoopChordPianoRollEditState>({
    hasSelection: false,
    canUndo: false,
  });
  const voice = useMemo(() => se2GrooveLeadB01Voice(), []);

  useEffect(() => {
    setLocalOpen(open);
  }, [open]);

  const setExpanded = useCallback(
    (next: boolean) => {
      setLocalOpen(next);
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const pitchRange = useMemo(
    () => se2GrooveLeadPitchRangeForNotes(grooveLeadNotes),
    [grooveLeadNotes],
  );

  const chordHits = useMemo(() => {
    if (!draft) return [];
    return se2SynthGenoDraftChordHitsForGrooveLead(draft, beatsPerBar, timelineBarCount);
  }, [draft, beatsPerBar, timelineBarCount]);

  const barCount = draft
    ? se2SynthGenoGrooveLeadTimelineBarCount(draft, timelineBarCount)
    : timelineBarCount;

  const regenFromChords = useCallback(() => {
    if (!draft || chordHits.length === 0) return;
    const nextSeed = melodySeed + 1;
    const notes = se2SynthGenoRegenerateGrooveLeadNotes({
      draft,
      beatsPerBar,
      timelineBarCount,
      keyRoot,
      keyMode,
      harmonyScaleMode,
      barChordSpecs,
      bpm,
      seed: nextSeed,
      styleId,
      movement,
      chordFit,
      build: genoBuild ?? 'b02',
    });
    setMelodySeed(nextSeed);
    onGrooveLeadNotesChange(notes);
    if (notes.length > 0) setExpanded(true);
  }, [
    draft,
    chordHits.length,
    melodySeed,
    beatsPerBar,
    timelineBarCount,
    keyRoot,
    keyMode,
    harmonyScaleMode,
    barChordSpecs,
    bpm,
    styleId,
    movement,
    chordFit,
    onGrooveLeadNotesChange,
    setExpanded,
    genoBuild,
  ]);

  const stopGrooveLeadPreview = useCallback(() => {
    if (previewEndRef.current != null) {
      clearTimeout(previewEndRef.current);
      previewEndRef.current = null;
    }
    haltWaveLeafVoices();
    setLeadPreviewing(false);
    onStopPreview?.();
  }, [onStopPreview]);

  useEffect(() => () => {
    if (previewEndRef.current != null) clearTimeout(previewEndRef.current);
    haltWaveLeafVoices();
  }, []);

  const previewRoll = useCallback(() => {
    if (!getAudioContext || !getPreviewDestination || grooveLeadNotes.length === 0) return;
    if (previewEndRef.current != null) {
      clearTimeout(previewEndRef.current);
      previewEndRef.current = null;
    }
    haltWaveLeafVoices();
    const ctx = getAudioContext();
    const stripIn = getPreviewDestination(ctx);
    bypassWaveLeafLeadChopGate(ctx, 35);
    const t0 = ctx.currentTime + 0.04;
    scheduleSe2GrooveLeadPolyRoll({
      ctx,
      stripIn,
      sessionStartSec: t0,
      bpm,
      notes: grooveLeadNotes,
      voice,
      trackIndex,
      gainMul: previewGain,
    });
    const last = grooveLeadNotes.reduce(
      (m, n) => Math.max(m, n.startBeat + n.durationBeats),
      0,
    );
    setLeadPreviewing(true);
    previewEndRef.current = setTimeout(() => {
      setLeadPreviewing(false);
      previewEndRef.current = null;
    }, Math.max(120, last * (60 / Math.max(40, bpm)) * 1000 + 200));
  }, [getAudioContext, getPreviewDestination, grooveLeadNotes, voice, bpm, trackIndex, previewGain]);

  const isAuditioning = leadPreviewing || loopPreviewing;
  const hasChords = (draft?.chordNotes.length ?? 0) > 0;

  return (
    <div
      className="rounded-lg border shrink-0"
      style={{ borderColor: `${GROOVE_LEAD_ACCENT}44`, background: 'rgba(12,28,24,0.55)' }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setExpanded(!localOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left disabled:opacity-40"
        style={{ color: GROOVE_LEAD_ACCENT }}
        title="Groove Lead — locked to chords in this loop editor"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-[9px] font-black uppercase tracking-widest">Groove Lead</span>
          <span className="text-[7px] font-semibold truncate" style={{ color: '#6a9a88' }}>
            {grooveLeadNotes.length > 0
              ? `${grooveLeadNotes.length} notes · chord-locked`
              : hasChords
                ? 'Open to build lead on loop chords'
                : 'Build chords first'}
          </span>
        </span>
        {localOpen ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
      </button>

      {localOpen ? (
        <div className="px-3 pb-4 flex flex-col gap-2 border-t" style={{ borderColor: `${GROOVE_LEAD_ACCENT}22` }}>
          <p className="text-[7px] leading-relaxed pt-2 m-0" style={{ color: '#8ab8a8' }}>
            <strong style={{ color: GROOVE_LEAD_ACCENT }}>Wave Leads soul</strong> — chord-locked from
            bar one, velvet glide + legato overlap (same engine on Build 1 &amp; Build 2).
          </p>

          <div
            className="flex flex-wrap items-center gap-1.5 relative isolate"
            style={{ zIndex: 40 }}
          >
            <GenoGrooveLeadVibeMenu
              styleId={styleId}
              movement={movement}
              chordFit={chordFit}
              disabled={disabled || !hasChords}
              onStyleIdChange={setStyleId}
              onMovementChange={setMovement}
              onChordFitChange={setChordFit}
              onRegen={regenFromChords}
            />
            <button
              type="button"
              disabled={disabled || !hasChords}
              onClick={regenFromChords}
              className="rounded border px-2 py-0.5 text-[7px] font-bold uppercase disabled:opacity-40"
              style={{ borderColor: `${GROOVE_LEAD_ACCENT}44`, background: '#101a16', color: '#8ab8a8' }}
              title="Regenerate with current vibe settings"
            >
              ↻
            </button>
            {getAudioContext && grooveLeadNotes.length > 0 ? (
              <button
                type="button"
                disabled={disabled}
                onClick={previewRoll}
                className="rounded border px-2 py-0.5 text-[7px] font-bold uppercase disabled:opacity-40"
                style={{ borderColor: '#4a6a5a', background: '#101a16', color: '#a8d8c8' }}
              >
                Preview
              </button>
            ) : null}
            {isAuditioning ? (
              <button
                type="button"
                disabled={disabled}
                onClick={stopGrooveLeadPreview}
                className="rounded border px-2 py-0.5 text-[7px] font-black uppercase disabled:opacity-40"
                style={{ borderColor: '#ef444466', background: '#1a1010', color: '#fca5a5' }}
                title="Stop groove lead preview"
              >
                Stop
              </button>
            ) : null}
            {onLockToTrack ? (
              <button
                type="button"
                disabled={disabled || !canLockToTrack}
                onClick={onLockToTrack}
                className="rounded border px-2 py-0.5 text-[7px] font-black uppercase disabled:opacity-40"
                style={{ borderColor: '#22c55e66', background: '#142218', color: '#86efac' }}
                title="Push this lead to the Groove Lead lane on the timeline"
              >
                Lock → lane
              </button>
            ) : null}
          </div>

          <div
            className="rounded border overflow-hidden min-h-[220px] relative"
            style={{ zIndex: 0, borderColor: '#2a3a34', background: 'rgba(0,0,0,0.2)' }}
          >
            <div
              className="flex items-center justify-between gap-2 px-2 py-1 border-b flex-wrap"
              style={{ borderColor: '#2a3a34', background: 'rgba(0,0,0,0.35)' }}
            >
              <span
                className="text-[7px] font-bold uppercase tracking-wide shrink-0"
                style={{ color: GROOVE_LEAD_ACCENT }}
              >
                Groove Lead · {pitchRange.min}–{pitchRange.max}
              </span>
              {onPreviewGainChange ? (
                <Se2SynthGenoLaneVolumeSlider
                  value={previewGain}
                  onChange={onPreviewGainChange}
                  color={GROOVE_LEAD_ACCENT}
                  disabled={disabled}
                  laneEnabled={grooveLeadNotes.length > 0}
                />
              ) : null}
              <Se2SynthGenoLoopPianoRollEditToolbar
                accentHex={GROOVE_LEAD_ACCENT}
                disabled={disabled}
                hasSelection={rollEdit.hasSelection}
                canUndo={rollEdit.canUndo}
                hasNotes={grooveLeadNotes.length > 0}
                onErase={() => pianoRollRef.current?.deleteSelected()}
                onDuplicate={() => pianoRollRef.current?.duplicateSelected()}
                onCut={() => pianoRollRef.current?.cutSelected()}
                onUndo={() => pianoRollRef.current?.undo()}
                onClear={() => pianoRollRef.current?.clearAll()}
              />
            </div>
            <Se2SynthGenoLoopChordPianoRoll
              ref={pianoRollRef}
              notes={grooveLeadNotes}
              barCount={barCount}
              beatsPerBar={beatsPerBar}
              accentHex={GROOVE_LEAD_ACCENT}
              minMidi={pitchRange.min}
              maxMidi={pitchRange.max}
              previewBeat={previewBeat}
              disabled={disabled}
              onNotesChange={onGrooveLeadNotesChange}
              onEditStateChange={setRollEdit}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
