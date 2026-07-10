'use client';

import { Music2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { OrchidProgressionBuilder } from '@/app/components/creation/OrchidProgressionBuilder';
import { GrooveLabHelpProvider } from '@/app/components/creation/GrooveLabHelpHub';
import { useGrooveLabProgressionAudition } from '@/app/hooks/useGrooveLabProgressionAudition';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  BAKED_ORCHESTRA_HIT_MANIFEST,
  loadedOrchestraHitLabelById,
  type OrchestraHitId,
} from '@/app/lib/creationStation/grooveLabOrchestraHitBank';
import type { GrooveLabLeadSoundId } from '@/app/lib/creationStation/grooveLabLeadSounds';
import { GROOVE_LAB_LEAD_SOUND_DEFAULT } from '@/app/lib/creationStation/grooveLabLeadSounds';
import {
  expandProgressionStepsForHits,
  progressionStepsNeedRhythmExpand,
  progressionStepsToGrooveHits,
  type GrooveProgressionStep,
  type GrooveStagedProgression,
} from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { GROOVE_LAB_QUANTIZE_DEFAULT } from '@/app/lib/creationStation/grooveLabRoll';
import {
  WAVE_LEAF_MELODY_GENRES,
  waveLeafMelodyGenreForStyle,
  waveLeafMelodyStyleById,
  type WaveLeafMelodyStyleId,
} from '@/app/lib/creationStation/waveLeafMelodyStyles';
import {
  STUDIO_HARMONY_GROOVE_LEAD_GROUPS,
  STUDIO_HARMONY_LOOP_BAR_OPTIONS,
  studioGrooveLeadSoundLabel,
  studioResolveHarmonyBarCount,
  type StudioHarmonyLoopBars,
  type StudioHarmonySoundKind,
} from '@/app/lib/studio/studioInstrumentHarmony';
import { registerStudioProgressionAuditionInterrupt } from '@/app/lib/studio/studioProgressionAuditionGuard';

export type StudioInstrumentHarmonyPanelProps = {
  open: boolean;
  onClose: () => void;
  accentHex?: string;
  disabled?: boolean;
  bpm: number;
  getAudioContext: () => AudioContext | null;
  keyRoot: number;
  keyMode: ChordMode;
  beatsPerBar: number;
  loopBars: StudioHarmonyLoopBars;
  steps: GrooveProgressionStep[];
  soundKind: StudioHarmonySoundKind;
  orchHitId: OrchestraHitId;
  grooveLeadId: GrooveLabLeadSoundId;
  melodyStyleId: WaveLeafMelodyStyleId;
  onStepsChange: (steps: GrooveProgressionStep[]) => void;
  onMelodyStyleChange: (id: WaveLeafMelodyStyleId) => void;
  onLoopBarsChange: (bars: StudioHarmonyLoopBars) => void;
  onSoundKindChange: (kind: StudioHarmonySoundKind) => void;
  onOrchHitChange: (id: OrchestraHitId) => void;
  onGrooveLeadChange: (id: GrooveLabLeadSoundId) => void;
  onApplyRootHits: (
    steps: GrooveProgressionStep[],
    soundKind: StudioHarmonySoundKind,
    orchHitId: OrchestraHitId,
    grooveLeadId: GrooveLabLeadSoundId,
    loopBars: StudioHarmonyLoopBars,
    melodyStyleId: WaveLeafMelodyStyleId,
  ) => void;
  onApplyChords: (steps: GrooveProgressionStep[], loopBars: StudioHarmonyLoopBars) => void;
  onRegenerateMelody?: () => void;
  canRegenerateMelody?: boolean;
  hasNoteSelection?: boolean;
  noteCount?: number;
  onDeleteSelected?: () => void;
  onDeleteAll?: () => void;
  /** SE2 transport play — silence Progression+ preview so it does not layer over track playback. */
  transportPlaying?: boolean;
};

const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function keyLabel(root: number, mode: ChordMode): string {
  const r = ((root % 12) + 12) % 12;
  return `${KEY_NAMES[r] ?? 'C'} ${mode === 'minor' ? 'min' : 'maj'}`;
}

function StudioInstrumentHarmonyPanelInner({
  open,
  onClose,
  accentHex = '#5B8CFF',
  disabled = false,
  bpm,
  getAudioContext,
  keyRoot,
  keyMode,
  beatsPerBar,
  loopBars,
  steps,
  soundKind,
  orchHitId,
  grooveLeadId,
  melodyStyleId,
  onStepsChange,
  onMelodyStyleChange,
  onLoopBarsChange,
  onSoundKindChange,
  onOrchHitChange,
  onGrooveLeadChange,
  onApplyRootHits,
  onApplyChords,
  hasNoteSelection = false,
  noteCount = 0,
  onDeleteSelected,
  onDeleteAll,
  onRegenerateMelody,
  canRegenerateMelody = false,
  transportPlaying = false,
}: StudioInstrumentHarmonyPanelProps) {
  const [staged, setStaged] = useState<GrooveStagedProgression | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [footerStatus, setFooterStatus] = useState<string | null>(null);

  const progressionAudition = useGrooveLabProgressionAudition({
    getAudioContext,
    bpm,
    chordVoice: 'grand',
    perfMode: 'block',
    linkedChordVolume: 0.82,
  });

  const buildProgression = useCallback(
    (nextSteps: GrooveProgressionStep[]) => {
      const barCount = studioResolveHarmonyBarCount(nextSteps, loopBars, beatsPerBar);
      const built = progressionStepsToGrooveHits(nextSteps, {
        quantize: GROOVE_LAB_QUANTIZE_DEFAULT,
        barCount,
        sustainSlots: 8,
        beatsPerBar,
      });
      if ('message' in built) {
        setStaged(null);
        setStatus(built.message);
        return;
      }
      setStaged(built);
      setStatus(null);
    },
    [beatsPerBar, loopBars],
  );

  useEffect(() => {
    if (!open) {
      progressionAudition.stopPlayback();
    }
  }, [open, progressionAudition]);

  const interruptAuditionRef = useRef(progressionAudition.interruptForExternalPlayback);
  interruptAuditionRef.current = progressionAudition.interruptForExternalPlayback;
  useEffect(
    () => registerStudioProgressionAuditionInterrupt(() => interruptAuditionRef.current()),
    [],
  );

  useEffect(() => {
    if (!open || steps.length === 0) return;
    buildProgression(steps);
  }, [open, loopBars, beatsPerBar, steps, buildProgression]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleDropChords = useCallback(
    (dropSteps: GrooveProgressionStep[]) => {
      progressionAudition.stopPlayback();
      const barCount = studioResolveHarmonyBarCount(dropSteps, loopBars, beatsPerBar);
      onApplyChords(dropSteps, barCount);
      setFooterStatus(`✓ ${barCount}-bar chords on instrument piano roll`);
      window.setTimeout(() => setFooterStatus(null), 3200);
    },
    [loopBars, beatsPerBar, onApplyChords, progressionAudition],
  );

  const handleApplyRootHits = useCallback(() => {
    if (steps.length === 0) {
      setFooterStatus('Add chords first');
      return;
    }
    progressionAudition.stopPlayback();
    const rhythmSteps = progressionStepsNeedRhythmExpand(steps)
      ? expandProgressionStepsForHits(steps)
      : steps;
    const barCount = studioResolveHarmonyBarCount(rhythmSteps, loopBars, beatsPerBar);
    onApplyRootHits(rhythmSteps, soundKind, orchHitId, grooveLeadId, barCount, melodyStyleId);
    const vibe = waveLeafMelodyGenreForStyle(melodyStyleId);
    const styleLabel = waveLeafMelodyStyleById(melodyStyleId).label;
    setFooterStatus(
      soundKind === 'grooveLead'
        ? `✓ ${barCount}-bar ${vibe.label} · ${styleLabel} melody`
        : `✓ ${barCount}-bar orch hits on instrument piano roll`,
    );
    window.setTimeout(() => setFooterStatus(null), 3200);
  }, [
    steps,
    soundKind,
    orchHitId,
    grooveLeadId,
    loopBars,
    beatsPerBar,
    melodyStyleId,
    onApplyRootHits,
    progressionAudition,
  ]);

  const handleRegenerateMelody = useCallback(() => {
    if (!onRegenerateMelody) {
      handleApplyRootHits();
      return;
    }
    progressionAudition.stopPlayback();
    onRegenerateMelody();
    const vibe = waveLeafMelodyGenreForStyle(melodyStyleId);
    setFooterStatus(`✓ New ${vibe.label} melody variation`);
    window.setTimeout(() => setFooterStatus(null), 3200);
  }, [onRegenerateMelody, handleApplyRootHits, melodyStyleId, progressionAudition]);

  const melodyGenre = useMemo(() => waveLeafMelodyGenreForStyle(melodyStyleId), [melodyStyleId]);
  const melodyStyleLabel = useMemo(() => waveLeafMelodyStyleById(melodyStyleId).label, [melodyStyleId]);

  const soundLabel = useMemo(
    () =>
      soundKind === 'grooveLead'
        ? studioGrooveLeadSoundLabel(grooveLeadId)
        : (loadedOrchestraHitLabelById(orchHitId) ?? 'Symphony Hit'),
    [soundKind, grooveLeadId, orchHitId],
  );

  const footerSlot = (
    <div
      style={{
        padding: '10px 8px',
        background: '#0a0e14',
        border: '1px solid #2a3548',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontSize: 8,
          fontWeight: 900,
          letterSpacing: 0.4,
          color: accentHex,
          marginBottom: 8,
          textTransform: 'uppercase',
        }}
      >
        Instrument channel · {soundKind === 'grooveLead' ? 'Groove Lead melody' : 'orch hits'}
      </div>

      <p
        style={{
          fontSize: 8,
          color: '#c9a86a',
          margin: '0 0 10px',
          lineHeight: 1.45,
          fontWeight: 600,
        }}
      >
        Chord progressions are built in the <strong style={{ color: '#86efac' }}>timeline above</strong> (LOAD ALL, + ADD
        TO TIMELINE, NEXT CHORDS). Buttons here only apply{' '}
        <strong style={{ color: '#fde68a' }}>orch hits or melody</strong> after chords exist — they do not create
        progressions. ↻ LOOP and Regenerate are preview / melody only.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 8, fontWeight: 800, color: '#6b7280', letterSpacing: 0.3 }}>LOOP LENGTH</span>
        {STUDIO_HARMONY_LOOP_BAR_OPTIONS.map((bars) => (
          <button
            key={bars}
            type="button"
            disabled={disabled}
            onClick={() => onLoopBarsChange(bars)}
            style={{
              borderRadius: 5,
              padding: '4px 12px',
              fontSize: 9,
              fontWeight: 900,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.4 : 1,
              border: `1px solid ${loopBars === bars ? `${accentHex}99` : '#333340'}`,
              background: loopBars === bars ? `${accentHex}22` : '#16161e',
              color: loopBars === bars ? accentHex : '#8a8a98',
            }}
          >
            {bars} bars
          </button>
        ))}
        <span style={{ fontSize: 8, color: '#5c5c6a', flex: '1 1 140px' }}>
          {soundKind === 'grooveLead'
            ? 'Full vibe melodies — regenerate until you find the one'
            : 'One root stab per bar · loops like drums'}
        </span>
      </div>

      {soundKind === 'grooveLead' ? (
        <div style={{ marginBottom: 10 }}>
          <span
            style={{
              display: 'block',
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: 0.3,
              color: '#6b7280',
              marginBottom: 4,
              textTransform: 'uppercase',
            }}
          >
            Melody vibe
          </span>
          <select
            disabled={disabled}
            value={melodyStyleId}
            onChange={(e) => onMelodyStyleChange(e.target.value as WaveLeafMelodyStyleId)}
            style={{
              width: '100%',
              borderRadius: 5,
              padding: '6px 8px',
              fontSize: 10,
              fontWeight: 700,
              border: '1px solid #333340',
              background: '#16161e',
              color: '#d8d8e8',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.4 : 1,
            }}
          >
            {WAVE_LEAF_MELODY_GENRES.map((genre) => (
              <optgroup key={genre.id} label={genre.label}>
                {genre.styles.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p style={{ fontSize: 8, color: '#5c5c6a', margin: '4px 0 0' }}>
            {melodyGenre.label} · {melodyStyleLabel} — matches chords in a {melodyGenre.label.toLowerCase()} feel
          </p>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {(['orchHit', 'grooveLead'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={disabled}
            onClick={() => onSoundKindChange(kind)}
            style={{
              flex: 1,
              borderRadius: 5,
              padding: '6px 10px',
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.4 : 1,
              border: `1px solid ${soundKind === kind ? '#7cf4c688' : '#333340'}`,
              background: soundKind === kind ? '#14221c' : '#16161e',
              color: soundKind === kind ? '#7cf4c6' : '#8a8a98',
            }}
          >
            {kind === 'orchHit' ? 'Orch hit' : 'Groove lead'}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 9, fontWeight: 600, color: '#9a9aaa', margin: '0 0 8px' }}>
        Selected: <span style={{ color: '#7cf4c6' }}>{soundLabel}</span>
      </p>

      {soundKind === 'orchHit' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 6,
            maxHeight: 120,
            overflowY: 'auto',
            marginBottom: 10,
            padding: 6,
            border: '1px solid #2a2a36',
            borderRadius: 6,
            background: '#101018',
          }}
        >
          {BAKED_ORCHESTRA_HIT_MANIFEST.map((h) => (
            <button
              key={h.id}
              type="button"
              disabled={disabled}
              onClick={() => onOrchHitChange(h.id)}
              style={{
                borderRadius: 4,
                padding: '4px 2px',
                fontSize: 9,
                fontWeight: 800,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
                border: `1px solid ${h.id === orchHitId ? '#7cf4c688' : '#333340'}`,
                background: h.id === orchHitId ? '#14221c' : '#181820',
                color: h.id === orchHitId ? '#7cf4c6' : '#a0a0b0',
              }}
            >
              {h.label}
            </button>
          ))}
        </div>
      ) : (
        <div
          style={{
            maxHeight: 160,
            overflowY: 'auto',
            marginBottom: 10,
            padding: 8,
            border: '1px solid #2a2a36',
            borderRadius: 6,
            background: '#101018',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {STUDIO_HARMONY_GROOVE_LEAD_GROUPS.map((group) => (
            <div key={group.label}>
              <span
                style={{
                  display: 'block',
                  marginBottom: 4,
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  color: '#6a6a78',
                  textTransform: 'uppercase',
                }}
              >
                {group.label}
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                {group.ids.map((id) => (
                  <button
                    key={id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onGrooveLeadChange(id)}
                    style={{
                      borderRadius: 4,
                      padding: '5px 6px',
                      fontSize: 9,
                      fontWeight: 600,
                      textAlign: 'left',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.4 : 1,
                      border: `1px solid ${id === grooveLeadId ? '#7cf4c688' : '#333340'}`,
                      background: id === grooveLeadId ? '#14221c' : '#181820',
                      color: id === grooveLeadId ? '#7cf4c6' : '#a0a0b0',
                    }}
                  >
                    {studioGrooveLeadSoundLabel(id)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={disabled || steps.length === 0}
        onClick={handleApplyRootHits}
        style={{
          width: '100%',
          borderRadius: 6,
          padding: '10px 12px',
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          cursor: disabled || steps.length === 0 ? 'not-allowed' : 'pointer',
          opacity: disabled || steps.length === 0 ? 0.4 : 1,
          border: `1px solid ${accentHex}99`,
          background: `linear-gradient(180deg, ${accentHex}40 0%, ${accentHex}18 100%)`,
          color: '#f4f4fc',
        }}
      >
        {soundKind === 'grooveLead'
          ? `Generate ${loopBars}-bar melody`
          : `Apply ${loopBars}-bar orch hits`}
      </button>

      {soundKind === 'grooveLead' ? (
        <button
          type="button"
          disabled={disabled || !canRegenerateMelody}
          onClick={handleRegenerateMelody}
          style={{
            width: '100%',
            marginTop: 8,
            borderRadius: 6,
            padding: '9px 12px',
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            cursor: disabled || !canRegenerateMelody ? 'not-allowed' : 'pointer',
            opacity: disabled || !canRegenerateMelody ? 0.4 : 1,
            border: '1px solid #7cf4c688',
            background: '#14221c',
            color: '#7cf4c6',
          }}
        >
          Regenerate melody
        </button>
      ) : null}

      {onDeleteSelected || onDeleteAll ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {onDeleteSelected ? (
            <button
              type="button"
              disabled={disabled || !hasNoteSelection}
              onClick={onDeleteSelected}
              style={{
                flex: 1,
                borderRadius: 5,
                padding: '7px 10px',
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
                cursor: disabled || !hasNoteSelection ? 'not-allowed' : 'pointer',
                opacity: disabled || !hasNoteSelection ? 0.4 : 1,
                border: '1px solid #e85d7566',
                background: '#2a1418',
                color: '#e85d75',
              }}
            >
              Delete
            </button>
          ) : null}
          {onDeleteAll ? (
            <button
              type="button"
              disabled={disabled || noteCount === 0}
              onClick={onDeleteAll}
              style={{
                flex: 1,
                borderRadius: 5,
                padding: '7px 10px',
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
                cursor: disabled || noteCount === 0 ? 'not-allowed' : 'pointer',
                opacity: disabled || noteCount === 0 ? 0.4 : 1,
                border: '1px solid #e85d7566',
                background: '#2a1418',
                color: '#e85d75',
              }}
            >
              Delete all
            </button>
          ) : null}
        </div>
      ) : null}

      {footerStatus ? (
        <div
          style={{
            fontSize: 9,
            marginTop: 8,
            fontWeight: 600,
            color: footerStatus.startsWith('✓') ? '#86efac' : '#fca5a5',
          }}
        >
          {footerStatus}
        </div>
      ) : null}
    </div>
  );

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div data-studio-harmony-panel>
      <button
        type="button"
        aria-label="Close harmony panel"
        className="fixed inset-0 z-[9590] cursor-default border-0 p-0"
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={onClose}
      />
      <div
        className="fixed z-[9605] pointer-events-none"
        style={{ inset: 0 }}
        aria-hidden
      >
        <div
          className="pointer-events-auto absolute left-1/2 top-3 flex max-w-[92vw] -translate-x-1/2 items-center justify-between gap-3 rounded-lg border px-4 py-2 shadow-lg se2-type-label"
          style={{
            width: 680,
            borderColor: `${accentHex}66`,
            background: 'linear-gradient(165deg, #14141c 0%, #0a0a10 100%)',
          }}
        >
          <span
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest"
            style={{ color: accentHex }}
          >
            <Music2 size={14} strokeWidth={2.2} aria-hidden />
            Harmony · Instrument
          </span>
          <span className="text-[10px] font-mono tabular-nums" style={{ color: '#9a9aaa' }}>
            {keyLabel(keyRoot, keyMode)} · {loopBars} bars
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 outline-none hover:bg-white/5"
            style={{ color: '#8a8a98' }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <OrchidProgressionBuilder
        grooveBranding
        bpm={bpm}
        keyRoot={keyRoot}
        mode={keyMode}
        chordVoiceLabel="Grand piano"
        staged={staged}
        status={status}
        auditionPlaying={progressionAudition.playing}
        auditionStepIndex={progressionAudition.activeStepIndex}
        onStepsChange={onStepsChange}
        onBuild={buildProgression}
        onPreviewStep={(step, opts) => progressionAudition.previewStep(step, opts)}
        onPlayProgression={(s, auditionBpm, genreId) =>
          progressionAudition.playProgressionOnce(s, auditionBpm, genreId)
        }
        onLoopProgression={(s, auditionBpm, genreId) =>
          progressionAudition.playProgressionLoop(s, auditionBpm, genreId)
        }
        onStopAudition={() => progressionAudition.stopPlayback()}
        onDropChordsToRoll={handleDropChords}
        onLoopBarsChange={onLoopBarsChange}
        harmonyLoopBars={loopBars}
        beatsPerBar={beatsPerBar}
        externalTransportPlaying={transportPlaying}
        controlledOpen={open}
        onControlledOpenChange={(next) => {
          if (!next) onClose();
        }}
        hideLauncher
        panelPlacement="centered"
        studioInstrumentChannel
        centeredTopBias={44}
        footerSlot={footerSlot}
      />
    </div>,
    document.body,
  );
}

export function StudioInstrumentHarmonyPanel(props: StudioInstrumentHarmonyPanelProps) {
  return (
    <GrooveLabHelpProvider autoIntro={false}>
      <StudioInstrumentHarmonyPanelInner {...props} />
    </GrooveLabHelpProvider>
  );
}

export { GROOVE_LAB_LEAD_SOUND_DEFAULT };
