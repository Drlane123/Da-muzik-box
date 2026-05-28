import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { parseChordSymbolToken } from '@/app/lib/creationStation/chordProgressionParse';
import {
  buildGrooveProgressionPresetCatalog,
  defaultGenrePackForMode,
  GROOVE_CHORD_PALETTE,
  GROOVE_PROGRESSION_GENRE_PACKS,
  presetToGrooveSteps,
  suggestNextChordLabels,
  type GrooveNextChordSuggestion,
} from '@/app/lib/creationStation/grooveLabProgressionLibrary';
import { resolveProgressionBpm } from '@/app/lib/creationStation/genreTempoProfiles';
import {
  GROOVE_PROGRESSION_BEATS_PER_BAR,
  newProgressionStepId,
  stepsFromPasteLine,
  type GrooveProgressionStep,
  type GrooveStagedProgression,
} from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { GrooveEightChordSketch } from '@/app/components/creation/GrooveEightChordSketch';
import { GrooveLabTempoStrip } from '@/app/components/creation/GrooveLabTempoStrip';

const PANEL_WIDTH = 680;
const PANEL_MAX_HEIGHT = 720;
const VIEWPORT_PAD = 8;

export interface OrchidProgressionBuilderProps {
  grooveBranding?: boolean;
  bpm: number;
  onBpmChange?: (bpm: number) => void;
  /** Same session clock as main Groove Lab tempo strip when embedded in Creation Station. */
  sessionBpmLocked?: boolean;
  keyRoot: number;
  mode: ChordMode;
  chordVoiceLabel: string;
  staged: GrooveStagedProgression | null;
  status: string | null;
  auditionPlaying?: boolean;
  /** Step index in the progression currently sounding (for playhead highlight). */
  auditionStepIndex?: number | null;
  onStepsChange: (steps: GrooveProgressionStep[]) => void;
  onBuild: (steps: GrooveProgressionStep[]) => void;
  onPreviewStep: (step: GrooveProgressionStep) => void;
  onPlayProgression: (steps: GrooveProgressionStep[]) => void;
  onLoopProgression: (steps: GrooveProgressionStep[]) => void;
  onStopAudition: () => void;
  onDropChordsToRoll: (steps: GrooveProgressionStep[]) => void;
  onDropWithMatchBass?: (steps: GrooveProgressionStep[]) => void;
  exportBusy?: boolean;
  exportStatus?: string | null;
  onExportTimelineMidi?: (steps: GrooveProgressionStep[]) => void;
  onExportTimelineWav?: (steps: GrooveProgressionStep[]) => void | Promise<void>;
  onExportTimelineWavToPad?: (steps: GrooveProgressionStep[]) => void | Promise<void>;
  onSendTimelineToNewSynth?: (steps: GrooveProgressionStep[]) => void;
  onSendRollToNewSynth?: () => void;
  onExportRollMidi?: () => void;
  onExportRollWav?: () => void | Promise<void>;
  onExportRollWavToPad?: () => void | Promise<void>;
  rollHasChords?: boolean;
}

function computePanelPosition(anchor: DOMRect): { top: number; left: number } {
  const gap = 8;
  let left = anchor.left + anchor.width / 2 - PANEL_WIDTH / 2;
  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - PANEL_WIDTH - VIEWPORT_PAD));

  const spaceBelow = window.innerHeight - anchor.bottom - gap - VIEWPORT_PAD;
  const spaceAbove = anchor.top - gap - VIEWPORT_PAD;
  let top: number;
  if (spaceBelow >= Math.min(PANEL_MAX_HEIGHT, 360) || spaceBelow >= spaceAbove) {
    top = anchor.bottom + gap;
    top = Math.min(top, window.innerHeight - PANEL_MAX_HEIGHT - VIEWPORT_PAD);
  } else {
    top = Math.max(VIEWPORT_PAD, anchor.top - gap - PANEL_MAX_HEIGHT);
  }
  return { top, left };
}

function seedPresetId(catalog: ReturnType<typeof buildGrooveProgressionPresetCatalog>): string {
  return (
    catalog.find((p) => p.genreId === 'rnb-90s' && p.progressionId === 'rnb90-ballad')?.id ??
    catalog.find((p) => p.genreId === 'rnb-true')?.id ??
    catalog.find((p) => p.genreId === 'pop')?.id ??
    catalog[0]?.id ??
    ''
  );
}

export function OrchidProgressionBuilder({
  grooveBranding = false,
  bpm,
  onBpmChange,
  sessionBpmLocked = false,
  keyRoot,
  mode,
  chordVoiceLabel,
  staged,
  status,
  auditionPlaying = false,
  auditionStepIndex = null,
  onStepsChange,
  onBuild,
  onPreviewStep,
  onPlayProgression,
  onLoopProgression,
  onStopAudition,
  onDropChordsToRoll,
  onDropWithMatchBass,
  exportBusy = false,
  exportStatus = null,
  onExportTimelineMidi,
  onExportTimelineWav,
  onExportTimelineWavToPad,
  onSendTimelineToNewSynth,
  onSendRollToNewSynth,
  onExportRollMidi,
  onExportRollWav,
  onExportRollWavToPad,
  rollHasChords = false,
}: OrchidProgressionBuilderProps) {
  const chordBrand = grooveBranding ? 'Groove' : 'Orchid';
  const catalog = useMemo(() => buildGrooveProgressionPresetCatalog(keyRoot), [keyRoot]);
  const initialGenreId = defaultGenrePackForMode(mode);
  const initialPresetId = useMemo(() => {
    const inGenre = catalog.find((p) => p.genreId === initialGenreId);
    return inGenre?.id ?? seedPresetId(catalog);
  }, [catalog, initialGenreId]);

  const [open, setOpen] = useState(false);
  const [genreId, setGenreId] = useState(initialGenreId);
  const [presetCatalogId, setPresetCatalogId] = useState(initialPresetId);
  /** Empty by default — user adds/removes steps explicitly (no auto-refill on delete). */
  const [steps, setSteps] = useState<GrooveProgressionStep[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Chord picked from suggestions/palette — preview only until user adds to timeline. */
  const [candidateLabel, setCandidateLabel] = useState<string | null>(null);
  /** Loop timeline cards while building; restarts when steps change. */
  const [timelineLoopOn, setTimelineLoopOn] = useState(false);
  /** Loop genre-pack preview (does not load timeline). */
  const [packLoopOn, setPackLoopOn] = useState(false);
  const [autoGenreTempo, setAutoGenreTempo] = useState(true);
  const [tempoMatchNote, setTempoMatchNote] = useState<string | null>(null);
  const [pasteLine, setPasteLine] = useState('');
  /** 2 = half bar per card · 4 = full bar (default for new timeline + sketch cards). */
  const [defaultCardBeats, setDefaultCardBeats] = useState(GROOVE_PROGRESSION_BEATS_PER_BAR);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const packPreviewStepsRef = useRef<GrooveProgressionStep[]>([]);
  const packLoopOnRef = useRef(false);
  const timelineLoopOnRef = useRef(false);
  const previewResumeTimerRef = useRef<number | null>(null);

  const clearPreviewResumeTimer = useCallback(() => {
    if (previewResumeTimerRef.current != null) {
      window.clearTimeout(previewResumeTimerRef.current);
      previewResumeTimerRef.current = null;
    }
  }, []);

  const genrePresets = useMemo(
    () => catalog.filter((p) => p.genreId === genreId),
    [catalog, genreId],
  );

  const selectedPackEntry = useMemo(
    () => catalog.find((p) => p.id === presetCatalogId),
    [catalog, presetCatalogId],
  );

  const packPreviewSteps = useMemo(
    () => (presetCatalogId ? presetToGrooveSteps(presetCatalogId, keyRoot) : []),
    [presetCatalogId, keyRoot, catalog],
  );
  packPreviewStepsRef.current = packPreviewSteps;
  packLoopOnRef.current = packLoopOn;
  timelineLoopOnRef.current = timelineLoopOn;

  const packChordLabels = useMemo(
    () =>
      selectedPackEntry?.steps
        .filter((s) => !s.rest && s.label.trim())
        .map((s) => s.label) ?? [],
    [selectedPackEntry],
  );

  const nextChords = useMemo(
    () => suggestNextChordLabels(steps, { keyRoot, mode, genreId, topK: 12 }),
    [steps, keyRoot, mode, genreId],
  );

  const syncSteps = useCallback(
    (next: GrooveProgressionStep[]) => {
      setSteps(next);
      onStepsChange(next);
      if (selectedId && !next.some((s) => s.id === selectedId)) {
        setSelectedId(next[next.length - 1]?.id ?? null);
      }
    },
    [onStepsChange, selectedId],
  );

  const hasPlayableSteps = useCallback(
    (list: readonly GrooveProgressionStep[]) =>
      list.some((s) => !s.rest && s.label.trim() && parseChordSymbolToken(s.label)),
    [],
  );

  const applyGenreTempo = useCallback(
    (gid: string, progressionId?: string, progressionName?: string) => {
      const resolved = resolveProgressionBpm(gid, { progressionId, progressionName });
      setTempoMatchNote(resolved.note);
      if (autoGenreTempo && onBpmChange) onBpmChange(resolved.bpm);
    },
    [autoGenreTempo, onBpmChange],
  );

  /** Transport / global stop cleared audition — drop loop UI so pack/timeline does not restart. */
  useEffect(() => {
    if (auditionPlaying) return;
    setPackLoopOn(false);
    setTimelineLoopOn(false);
  }, [auditionPlaying]);

  useEffect(() => {
    if (!timelineLoopOn) return;
    if (!hasPlayableSteps(steps)) {
      setTimelineLoopOn(false);
      onStopAudition();
      return;
    }
    setPackLoopOn(false);
    onLoopProgression(steps);
  }, [steps, timelineLoopOn, hasPlayableSteps, onLoopProgression, onStopAudition, bpm]);

  useEffect(() => {
    if (!packLoopOn) return;
    if (!hasPlayableSteps(packPreviewSteps)) {
      setPackLoopOn(false);
      onStopAudition();
      return;
    }
    setTimelineLoopOn(false);
    onLoopProgression(packPreviewSteps);
  }, [packPreviewSteps, packLoopOn, hasPlayableSteps, onLoopProgression, onStopAudition, bpm]);

  const repositionPanel = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    setPanelPos(computePanelPosition(btn.getBoundingClientRect()));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    repositionPanel();
    window.addEventListener('resize', repositionPanel);
    window.addEventListener('scroll', repositionPanel, true);
    return () => {
      window.removeEventListener('resize', repositionPanel);
      window.removeEventListener('scroll', repositionPanel, true);
    };
  }, [open, repositionPanel]);

  useEffect(() => {
    if (!open || !autoGenreTempo) return;
    const entry = catalog.find((p) => p.id === presetCatalogId);
    if (entry) {
      const loopLabel = entry.label.replace(/^[^·]+·\s*/, '');
      applyGenreTempo(entry.genreId, entry.progressionId, loopLabel);
    } else {
      applyGenreTempo(genreId);
    }
  }, [open, autoGenreTempo, presetCatalogId, genreId, catalog, applyGenreTempo]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        btnRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  /** Pick genre/loop for preview only — timeline unchanged until you add chords. */
  const selectCatalogPreset = useCallback(
    (id: string) => {
      const entry = catalog.find((p) => p.id === id);
      if (!entry) return;
      setGenreId(entry.genreId);
      setPresetCatalogId(id);
      setCandidateLabel(null);
      const loopLabel = entry.label.replace(/^[^·]+·\s*/, '');
      applyGenreTempo(entry.genreId, entry.progressionId, loopLabel);
      setPasteLine(
        entry.steps
          .filter((s) => !s.rest && s.label.trim())
          .map((s) => s.label)
          .join(' '),
      );
    },
    [catalog, applyGenreTempo],
  );

  const loadPackToTimeline = useCallback(() => {
    if (!presetCatalogId) return;
    const next = presetToGrooveSteps(presetCatalogId, keyRoot);
    syncSteps(next);
    setSelectedId(next[0]?.id ?? null);
    if (hasPlayableSteps(next)) onBuild(next);
    setPackLoopOn(false);
  }, [presetCatalogId, keyRoot, syncSteps, onBuild, hasPlayableSteps]);

  const playPackOnce = useCallback(() => {
    if (!hasPlayableSteps(packPreviewSteps)) return;
    setPackLoopOn(false);
    setTimelineLoopOn(false);
    onStopAudition();
    onPlayProgression(packPreviewSteps);
  }, [packPreviewSteps, hasPlayableSteps, onPlayProgression, onStopAudition]);

  const togglePackLoop = useCallback(() => {
    if (packLoopOn) {
      setPackLoopOn(false);
      onStopAudition();
      return;
    }
    if (!hasPlayableSteps(packPreviewSteps)) return;
    setTimelineLoopOn(false);
    setPackLoopOn(true);
  }, [packLoopOn, packPreviewSteps, hasPlayableSteps, onStopAudition]);

  const previewPackChord = useCallback(
    (label: string) => {
      if (!parseChordSymbolToken(label)) return;
      const resume = packLoopOnRef.current;
      clearPreviewResumeTimer();
      if (resume) onStopAudition();
      onPreviewStep({ id: 'pack-preview', label, beats: 1 });
      if (resume && hasPlayableSteps(packPreviewStepsRef.current)) {
        previewResumeTimerRef.current = window.setTimeout(() => {
          previewResumeTimerRef.current = null;
          if (!packLoopOnRef.current) return;
          onLoopProgression(packPreviewStepsRef.current);
        }, 720);
      }
    },
    [clearPreviewResumeTimer, onPreviewStep, onStopAudition, onLoopProgression, hasPlayableSteps],
  );

  const appendStep = useCallback(
    (label: string, rest = false) => {
      const step: GrooveProgressionStep = {
        id: newProgressionStepId(),
        label: rest ? '' : label,
        beats: defaultCardBeats,
        rest,
      };
      const next = [...steps, step];
      syncSteps(next);
      setSelectedId(step.id);
      onBuild(next);
      if (!rest && !timelineLoopOn) onPreviewStep(step);
      if (!rest) setCandidateLabel(null);
    },
    [steps, syncSteps, onBuild, onPreviewStep, timelineLoopOn, defaultCardBeats],
  );

  const previewCandidate = useCallback(
    (label: string) => {
      const trimmed = label.trim();
      if (!trimmed || !parseChordSymbolToken(trimmed)) return;
      setCandidateLabel(trimmed);
      const resumeLoop = timelineLoopOnRef.current;
      clearPreviewResumeTimer();
      if (resumeLoop) onStopAudition();
      onPreviewStep({ id: 'candidate-preview', label: trimmed, beats: 1 });
      if (resumeLoop && hasPlayableSteps(stepsRef.current)) {
        previewResumeTimerRef.current = window.setTimeout(() => {
          previewResumeTimerRef.current = null;
          if (!timelineLoopOnRef.current) return;
          onLoopProgression(stepsRef.current);
        }, 720);
      }
    },
    [clearPreviewResumeTimer, onPreviewStep, onStopAudition, onLoopProgression, hasPlayableSteps],
  );

  const toggleTimelineLoop = useCallback(() => {
    if (timelineLoopOn) {
      setTimelineLoopOn(false);
      onStopAudition();
      return;
    }
    if (!hasPlayableSteps(steps)) return;
    setPackLoopOn(false);
    setTimelineLoopOn(true);
  }, [timelineLoopOn, steps, hasPlayableSteps, onStopAudition]);

  const stopAllAudition = useCallback(() => {
    clearPreviewResumeTimer();
    setTimelineLoopOn(false);
    setPackLoopOn(false);
    onStopAudition();
  }, [clearPreviewResumeTimer, onStopAudition]);

  const previewTimelineStep = useCallback(
    (step: GrooveProgressionStep) => {
      if (step.rest || !step.label.trim()) return;
      const resumeLoop = timelineLoopOnRef.current;
      clearPreviewResumeTimer();
      if (resumeLoop) onStopAudition();
      onPreviewStep(step);
      if (resumeLoop && hasPlayableSteps(stepsRef.current)) {
        previewResumeTimerRef.current = window.setTimeout(() => {
          previewResumeTimerRef.current = null;
          if (!timelineLoopOnRef.current) return;
          onLoopProgression(stepsRef.current);
        }, 720);
      }
    },
    [clearPreviewResumeTimer, onPreviewStep, onStopAudition, onLoopProgression, hasPlayableSteps],
  );

  const commitCandidate = useCallback(() => {
    if (!candidateLabel?.trim() || !parseChordSymbolToken(candidateLabel)) return;
    appendStep(candidateLabel);
  }, [candidateLabel, appendStep]);

  useEffect(() => {
    if (!open || !candidateLabel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commitCandidate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, candidateLabel, commitCandidate]);

  const applyPaste = () => {
    const next = stepsFromPasteLine(pasteLine, GROOVE_PROGRESSION_BEATS_PER_BAR);
    if (next.length === 0) return;
    setPresetCatalogId('');
    syncSteps(next);
    setSelectedId(next[0]?.id ?? null);
    if (hasPlayableSteps(next)) {
      onBuild(next);
      setTimelineLoopOn(true);
    }
  };

  const updateStep = (id: string, patch: Partial<GrooveProgressionStep>) => {
    const next = steps.map((s) => (s.id === id ? { ...s, ...patch } : s));
    syncSteps(next);
    onBuild(next);
  };

  const removeStep = (id: string) => {
    const next = steps.filter((s) => s.id !== id);
    syncSteps(next);
    onBuild(next);
  };

  const selectStep = (step: GrooveProgressionStep) => {
    setCandidateLabel(null);
    setSelectedId(step.id);
    if (!timelineLoopOn && !step.rest && step.label.trim()) onPreviewStep(step);
  };

  const panel = open ? (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Chord progression builder"
      style={{
        position: 'fixed',
        top: panelPos.top,
        left: panelPos.left,
        zIndex: 10000,
        width: PANEL_WIDTH,
        maxHeight: PANEL_MAX_HEIGHT,
        overflow: 'auto',
        background: '#070b10',
        border: '1px solid #22c55e55',
        borderRadius: 10,
        boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
        padding: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 900, color: '#4ade80', letterSpacing: 0.5 }}>
            CHORD PROGRESSION
          </div>
          <p style={{ fontSize: 8, color: '#6b7280', margin: '4px 0 0', lineHeight: 1.45, maxWidth: 360 }}>
            Audition genre-pack loops first, add only the chords you want. Uses{' '}
            <strong style={{ color: '#86efac' }}>{chordVoiceLabel}</strong> only.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {onBpmChange ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setAutoGenreTempo((wasOn) => {
                    const next = !wasOn;
                    if (next) {
                      const entry = catalog.find((p) => p.id === presetCatalogId);
                      if (entry) {
                        const loopLabel = entry.label.replace(/^[^·]+·\s*/, '');
                        applyGenreTempo(entry.genreId, entry.progressionId, loopLabel);
                      } else {
                        applyGenreTempo(genreId);
                      }
                    }
                    return next;
                  });
                }}
                title={
                  autoGenreTempo
                    ? 'When ON, genre pack and loop picks set Groove BPM automatically'
                    : 'When OFF, keep your manual BPM while browsing packs'
                }
                style={{
                  background: autoGenreTempo ? '#112015' : '#111',
                  color: autoGenreTempo ? '#22c55e' : '#6b7280',
                  border: `1px solid ${autoGenreTempo ? '#1f3a29' : '#1a1a1a'}`,
                  borderRadius: 5,
                  padding: '2px 8px',
                  fontSize: 8,
                  fontWeight: 900,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                TEMPO AUTO {autoGenreTempo ? 'ON' : 'OFF'}
              </button>
              <GrooveLabTempoStrip
                bpm={bpm}
                onBpmChange={onBpmChange}
                sessionLocked={sessionBpmLocked}
                transportPlaying={auditionPlaying}
                compact
              />
            </div>
          ) : (
            <span style={{ fontSize: 9, color: '#86efac', fontWeight: 800, flexShrink: 0 }}>{bpm} BPM</span>
          )}
          {autoGenreTempo && tempoMatchNote ? (
            <span
              style={{
                fontSize: 7,
                color: '#6b7280',
                fontWeight: 700,
                maxWidth: 220,
                textAlign: 'right',
                lineHeight: 1.35,
              }}
              title="Target tempo for the selected genre pack"
            >
              {tempoMatchNote}
            </span>
          ) : null}
        </div>
      </div>

      <GrooveEightChordSketch
        grooveBranding={grooveBranding}
        keyRoot={keyRoot}
        mode={mode}
        genreId={genreId}
        mainTimelineSteps={steps}
        packChordLabels={packChordLabels}
        auditionPlaying={auditionPlaying}
        auditionStepIndex={auditionStepIndex}
        onPreviewStep={onPreviewStep}
        onPlayProgression={onPlayProgression}
        onLoopProgression={onLoopProgression}
        onStopAudition={stopAllAudition}
        onSendToMainTimeline={(next) => {
          syncSteps(next);
          setSelectedId(next[0]?.id ?? null);
          if (hasPlayableSteps(next)) onBuild(next);
          setPackLoopOn(false);
          setTimelineLoopOn(false);
        }}
        onDropToRoll={onDropChordsToRoll}
        defaultCardBeats={defaultCardBeats}
        autoSongBankTempo={autoGenreTempo}
        onBpmChange={onBpmChange}
        onSongBankTempoNote={setTempoMatchNote}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={fieldLabelStyle}>GENRE PACK</span>
          <select
            value={genreId}
            onChange={(e) => {
              const gid = e.target.value;
              const first = catalog.find((p) => p.genreId === gid);
              if (first) selectCatalogPreset(first.id);
              else {
                setGenreId(gid);
                applyGenreTempo(gid);
              }
            }}
            style={selectStyle}
          >
            {GROOVE_PROGRESSION_GENRE_PACKS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={fieldLabelStyle}>LOOP ({genrePresets.length} in pack)</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <select
              value={genrePresets.some((p) => p.id === presetCatalogId) ? presetCatalogId : (genrePresets[0]?.id ?? '')}
              onChange={(e) => selectCatalogPreset(e.target.value)}
              style={{ ...selectStyle, flex: 1 }}
            >
              {genrePresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label.replace(/^[^·]+·\s*/, '')}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      <div
        style={{
          marginBottom: 10,
          padding: '8px 8px 10px',
          background: '#0a0e14',
          border: '1px solid #2a3548',
          borderRadius: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 6,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ ...fieldLabelStyle, color: '#93c5fd' }}>PACK PREVIEW — hear before timeline</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              disabled={packChordLabels.length === 0}
              onClick={() => {
                if (auditionPlaying) stopAllAudition();
                else playPackOnce();
              }}
              style={auditionBtnStyle(
                packChordLabels.length > 0,
                auditionPlaying,
                '#112015',
                '#86efac',
              )}
            >
              {auditionPlaying ? '■ STOP' : '▶ PLAY PACK'}
            </button>
            <button
              type="button"
              disabled={packChordLabels.length === 0}
              onClick={togglePackLoop}
              style={auditionBtnStyle(packChordLabels.length > 0, packLoopOn, '#0e2838', '#67e8f9')}
            >
              {packLoopOn ? '↻ PACK LOOP ON' : '↻ LOOP PACK'}
            </button>
            <button
              type="button"
              disabled={!presetCatalogId}
              onClick={loadPackToTimeline}
              title="Put all pack chords on your timeline (optional)"
              style={{ ...smallBtnStyle, whiteSpace: 'nowrap' }}
            >
              LOAD ALL
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minHeight: 40 }}>
          {packChordLabels.length === 0 ? (
            <span style={{ fontSize: 8, color: '#4b5563' }}>Pick a genre pack and loop</span>
          ) : (
            packChordLabels.map((label, idx) => (
              <div
                key={`${presetCatalogId}-${label}-${idx}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: '#0c1018',
                  border: '1px solid #1e3a4a',
                }}
              >
                <button
                  type="button"
                  onClick={() => previewPackChord(label)}
                  title="Hear this chord"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#a5f3fc',
                    fontSize: 12,
                    fontWeight: 900,
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {label}
                </button>
                <button
                  type="button"
                  onClick={() => appendStep(label)}
                  title="Add only this chord to your timeline"
                  style={{
                    ...smallBtnStyle,
                    padding: '2px 6px',
                    fontSize: 7,
                  }}
                >
                  + TIMELINE
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <span style={fieldLabelStyle}>NEW CARD LENGTH</span>
        <button
          type="button"
          onClick={() => setDefaultCardBeats(2)}
          style={miniToggleStyle(defaultCardBeats === 2)}
          title="One chord every half bar (2 beats)"
        >
          ½ BAR
        </button>
        <button
          type="button"
          onClick={() => setDefaultCardBeats(4)}
          style={miniToggleStyle(defaultCardBeats === 4)}
          title="One chord per full bar (4 beats)"
        >
          FULL BAR
        </button>
        <span style={{ fontSize: 7, color: '#4b5563' }}>
          Per-card length on timeline can still be changed (½b–4b dropdown).
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 6,
          flexWrap: 'wrap',
        }}
      >
        <span style={fieldLabelStyle}>YOUR TIMELINE</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            disabled={!hasPlayableSteps(steps)}
            onClick={() => {
              if (auditionPlaying) stopAllAudition();
              else {
                setPackLoopOn(false);
                setTimelineLoopOn(false);
                onPlayProgression(steps);
              }
            }}
            style={auditionBtnStyle(
              hasPlayableSteps(steps),
              auditionPlaying,
              '#112015',
              '#86efac',
            )}
          >
            {auditionPlaying ? '■ STOP' : '▶ PLAY'}
          </button>
          <button
            type="button"
            disabled={!hasPlayableSteps(steps)}
            onClick={toggleTimelineLoop}
            title="Loop timeline cards — updates when you add or edit"
            style={auditionBtnStyle(hasPlayableSteps(steps), timelineLoopOn, '#0e2838', '#67e8f9')}
          >
            {timelineLoopOn ? '↻ TIMELINE ON' : '↻ LOOP'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={pasteLine}
          onChange={(e) => setPasteLine(e.target.value)}
          placeholder="Or paste: Cmaj7 Am7 Dm7 G7"
          style={{ ...inputStyle, flex: 1, minWidth: 120 }}
        />
        <button type="button" onClick={applyPaste} style={smallBtnStyle} title="Load pasted text only">
          PASTE TO TIMELINE
        </button>
        <button type="button" onClick={() => appendStep('', true)} style={smallBtnStyle} title="Blank beat">
          + REST
        </button>
      </div>

      <CandidateBar
        chordBrand={chordBrand}
        label={candidateLabel}
        onHear={() => candidateLabel && previewCandidate(candidateLabel)}
        onAdd={commitCandidate}
      />

      <div style={{ marginBottom: 8 }}>
        <div style={{ ...fieldLabelStyle, marginBottom: 4 }}>
          NEXT CHORDS — brightest = strongest · tap to hear · double-click to add
        </div>
        <div
          style={{
            display: 'flex',
            gap: 5,
            overflowX: 'auto',
            padding: '6px 4px',
            background: '#030508',
            border: '1px solid #1a2438',
            borderRadius: 6,
          }}
        >
          {nextChords.length === 0 ? (
            <span style={{ fontSize: 8, color: '#4b5563', padding: 4 }}>
              Pick a loop or add your first chord from the palette
            </span>
          ) : (
            nextChords.map((s, idx) => {
              const selected = candidateLabel === s.label;
              const depth = strengthDepthStyle(idx, nextChords.length);
              return (
                <button
                  key={`${s.roman}-${s.label}-${idx}`}
                  type="button"
                  onClick={() => previewCandidate(s.label)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    appendStep(s.label);
                  }}
                  title={`${s.strength}% match · #${idx + 1} of ${nextChords.length} · click = hear`}
                  style={{
                    ...suggestionChipStyle,
                    background: selected ? '#15321e' : depth.background,
                    border: selected ? '2px solid #4ade80' : depth.border,
                    boxShadow: selected ? '0 0 14px #22c55e88' : depth.boxShadow,
                  }}
                >
                  <span
                    style={{
                      fontSize: depth.labelSize,
                      fontWeight: 900,
                      color: selected ? '#86efac' : depth.labelColor,
                      fontFamily: 'monospace',
                      textShadow: depth.labelGlow,
                    }}
                  >
                    {s.label}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      height: 4,
                      borderRadius: 2,
                      background: depth.meterTrack,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(8, s.strength)}%`,
                        height: '100%',
                        background: depth.meterFill,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 7, color: depth.percentColor, fontWeight: 800 }}>
                    {s.strength}%
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ ...fieldLabelStyle, marginBottom: 4 }}>
          CHORD PALETTE — tap to hear · double-click to add
        </div>
        {GROOVE_CHORD_PALETTE.map((section) => (
          <div key={section.title} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 7, color: '#374151', fontWeight: 800, marginBottom: 3 }}>{section.title}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {section.chords.map((ch) => (
                <button
                  key={`${section.title}-${ch}`}
                  type="button"
                  onClick={() => previewCandidate(ch)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    appendStep(ch);
                  }}
                  title="Click = hear · double-click = add to timeline"
                  style={{
                    ...paletteChipStyle,
                    background: candidateLabel === ch ? '#15321e' : paletteChipStyle.background,
                    border: `1px solid ${candidateLabel === ch ? '#4ade80' : '#1f3a29'}`,
                    boxShadow: candidateLabel === ch ? '0 0 8px #22c55e44' : undefined,
                  }}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginBottom: 10,
          padding: '8px 6px',
          background: '#030508',
          border: '1px solid #1a2438',
          borderRadius: 8,
          overflowX: 'auto',
        }}
      >
        <div style={{ fontSize: 7, color: '#4b5563', fontWeight: 800, marginBottom: 6 }}>
          TIMELINE — ↻ LOOP plays these cards · add with + ADD TO TIMELINE
        </div>
        <div style={{ display: 'flex', gap: 8, minHeight: 72, alignItems: 'stretch' }}>
          {steps.length === 0 ? (
            <span style={{ fontSize: 9, color: '#4b5563', fontStyle: 'italic', padding: 8 }}>
              Use NEXT CHORDS, palette, or a loop above
            </span>
          ) : (
            steps.map((step, idx) => (
              <TimelineCard
                key={step.id}
                step={step}
                index={idx}
                selected={step.id === selectedId}
                onSelect={() => selectStep(step)}
                onRemove={() => removeStep(step.id)}
                onChange={(patch) => updateStep(step.id, patch)}
                onHear={() => previewTimelineStep(step)}
              />
            ))
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          paddingTop: 10,
          borderTop: '1px solid #1a2438',
        }}
      >
        <button
          type="button"
          disabled={!hasPlayableSteps(steps)}
          onClick={() => {
            onDropChordsToRoll(steps);
            setOpen(false);
          }}
          title="Green chord notes only (C4+) — no blue bass. Use + MATCH BASS when you want 808 under the chords."
          style={{
            ...actionBtnStyle,
            background: hasPlayableSteps(steps) ? '#15321e' : '#111',
            color: hasPlayableSteps(steps) ? '#4ade80' : '#444',
            border: `1px solid ${hasPlayableSteps(steps) ? '#22c55e88' : '#222'}`,
            flex: 1,
            minWidth: 160,
          }}
        >
          DROP CHORDS TO ROLL
        </button>
        {onDropWithMatchBass ? (
          <button
            type="button"
            disabled={!hasPlayableSteps(steps)}
            onClick={() => {
              onDropWithMatchBass(steps);
              setOpen(false);
            }}
            title="Chords on roll, then auto-generate blue bass pattern"
            style={{
              ...actionBtnStyle,
              background: hasPlayableSteps(steps) ? '#0c1828' : '#111',
              color: hasPlayableSteps(steps) ? '#93c5fd' : '#444',
              border: `1px solid ${hasPlayableSteps(steps) ? '#3b82f666' : '#222'}`,
            }}
          >
            + MATCH BASS
          </button>
        ) : null}
      </div>

      {(onExportTimelineMidi ||
        onExportTimelineWav ||
        onExportTimelineWavToPad ||
        onSendTimelineToNewSynth ||
        onExportRollMidi ||
        onExportRollWav ||
        onExportRollWavToPad) && (
        <div
          style={{
            marginBottom: 10,
            padding: '8px 6px',
            background: '#0a0e14',
            border: '1px solid #2a3548',
            borderRadius: 8,
          }}
        >
          <div style={{ ...fieldLabelStyle, color: '#fde68a', marginBottom: 6 }}>EXPORT CHORDS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {onExportTimelineMidi ? (
              <button
                type="button"
                disabled={exportBusy || !hasPlayableSteps(steps)}
                onClick={() => onExportTimelineMidi(steps)}
                style={exportBtnStyle(!exportBusy && hasPlayableSteps(steps))}
              >
                MIDI · TIMELINE
              </button>
            ) : null}
            {onExportTimelineWav ? (
              <button
                type="button"
                disabled={exportBusy || !hasPlayableSteps(steps)}
                onClick={() => void onExportTimelineWav(steps)}
                style={exportBtnStyle(!exportBusy && hasPlayableSteps(steps))}
              >
                WAV · TIMELINE
              </button>
            ) : null}
            {onExportTimelineWavToPad ? (
              <button
                type="button"
                disabled={exportBusy || !hasPlayableSteps(steps)}
                onClick={() => void onExportTimelineWavToPad(steps)}
                style={exportBtnStyle(!exportBusy && hasPlayableSteps(steps))}
                title="Render timeline chords to a Beat Lab sampler pad"
              >
                PAD · TIMELINE
              </button>
            ) : null}
            {onSendTimelineToNewSynth ? (
              <button
                type="button"
                disabled={exportBusy || !hasPlayableSteps(steps)}
                onClick={() => onSendTimelineToNewSynth(steps)}
                style={{
                  ...exportBtnStyle(!exportBusy && hasPlayableSteps(steps)),
                  color: !exportBusy && hasPlayableSteps(steps) ? '#c4b5fd' : undefined,
                  borderColor: !exportBusy && hasPlayableSteps(steps) ? '#7c3aed66' : undefined,
                }}
                title="Send progression chords straight into Beat Lab NEW SYNTH piano roll"
              >
                TO NEW SYNTH
              </button>
            ) : null}
            {onSendRollToNewSynth ? (
              <button
                type="button"
                disabled={exportBusy || !rollHasChords}
                onClick={onSendRollToNewSynth}
                style={{
                  ...exportBtnStyle(!exportBusy && rollHasChords),
                  color: !exportBusy && rollHasChords ? '#c4b5fd' : undefined,
                  borderColor: !exportBusy && rollHasChords ? '#7c3aed66' : undefined,
                }}
                title="Send chord notes on the Groove piano roll into NEW SYNTH"
              >
                TO NEW SYNTH · ROLL
              </button>
            ) : null}
            {onExportRollMidi ? (
              <button
                type="button"
                disabled={exportBusy || !rollHasChords}
                onClick={onExportRollMidi}
                style={exportBtnStyle(!exportBusy && rollHasChords)}
              >
                MIDI · ROLL
              </button>
            ) : null}
            {onExportRollWav ? (
              <button
                type="button"
                disabled={exportBusy || !rollHasChords}
                onClick={() => void onExportRollWav()}
                style={exportBtnStyle(!exportBusy && rollHasChords)}
              >
                WAV · ROLL
              </button>
            ) : null}
            {onExportRollWavToPad ? (
              <button
                type="button"
                disabled={exportBusy || !rollHasChords}
                onClick={() => void onExportRollWavToPad()}
                style={exportBtnStyle(!exportBusy && rollHasChords)}
              >
                PAD · ROLL
              </button>
            ) : null}
          </div>
          {exportStatus ? (
            <div
              style={{
                fontSize: 8,
                marginTop: 6,
                color: exportStatus.startsWith('✓') || exportStatus.startsWith('Saved') ? '#86efac' : '#fca5a5',
              }}
            >
              {exportStatus}
            </div>
          ) : null}
        </div>
      )}

      {staged ? (
        <div style={{ fontSize: 8, color: '#4b5563', marginTop: 8 }}>
          {staged.barCount} bar{staged.barCount === 1 ? '' : 's'} · {bpm} BPM ·{' '}
          {staged.steps.filter((s) => !s.rest && s.label.trim()).length} chords · {catalog.length} loops
          in library
        </div>
      ) : null}
      {status ? (
        <div
          style={{
            fontSize: 8,
            marginTop: 6,
            color: status.startsWith('✓') ? '#86efac' : '#fca5a5',
          }}
        >
          {status}
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) requestAnimationFrame(repositionPanel);
            return next;
          });
        }}
        title={`Build & audition a chord progression (${chordBrand} sounds), then drop to piano roll`}
        style={{
          background: open || staged ? '#15321e' : '#0d1812',
          color: open || staged ? '#86efac' : '#6b7280',
          border: `1px solid ${open || staged ? '#22c55e88' : '#1f3a29'}`,
          borderRadius: 5,
          padding: '3px 10px',
          fontSize: 8,
          fontWeight: 900,
          cursor: 'pointer',
          letterSpacing: 0.3,
        }}
      >
        PROGRESSION {steps.length > 0 ? `(${steps.length})` : ''} ▾
      </button>
      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
    </>
  );
}

function CandidateBar({
  chordBrand,
  label,
  onHear,
  onAdd,
}: {
  chordBrand: string;
  label: string | null;
  onHear: () => void;
  onAdd: () => void;
}) {
  const valid = Boolean(label?.trim() && parseChordSymbolToken(label));
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 8,
        padding: '8px 10px',
        background: valid ? '#0a120e' : '#080a0c',
        border: `1px solid ${valid ? '#22c55e55' : '#1a2438'}`,
        borderRadius: 6,
      }}
    >
      <span style={{ fontSize: 7, color: '#4b5563', fontWeight: 800, flexShrink: 0 }}>NEXT SLOT</span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 900,
          fontFamily: 'monospace',
          color: valid ? '#86efac' : '#4b5563',
          minWidth: 48,
        }}
      >
        {valid ? label : '—'}
      </span>
      <button
        type="button"
        disabled={!valid}
        onClick={onHear}
        style={smallBtnStyle}
        title={`Hear this chord again (${chordBrand} voice)`}
      >
        ▶ HEAR
      </button>
      <button
        type="button"
        disabled={!valid}
        onClick={onAdd}
        style={{
          ...smallBtnStyle,
          background: valid ? '#15321e' : '#111',
          color: valid ? '#4ade80' : '#444',
          border: `1px solid ${valid ? '#22c55e88' : '#222'}`,
          flex: 1,
          minWidth: 140,
        }}
        title="Place selected chord on timeline (Enter)"
      >
        + ADD TO TIMELINE
      </button>
    </div>
  );
}

function TimelineCard({
  step,
  index,
  selected,
  onSelect,
  onRemove,
  onChange,
  onHear,
}: {
  step: GrooveProgressionStep;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onChange: (patch: Partial<GrooveProgressionStep>) => void;
  onHear: () => void;
}) {
  const isRest = Boolean(step.rest);
  const valid = isRest || Boolean(parseChordSymbolToken(step.label));

  return (
    <div
      style={{
        flex: '0 0 auto',
        width: 72,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '6px 6px 8px',
        borderRadius: 6,
        background: selected ? '#15321e' : isRest ? '#0f1014' : valid ? '#0c1018' : '#2a1411',
        border: `2px solid ${selected ? '#4ade80' : valid ? '#1f3a29' : '#7f1d1d'}`,
        boxShadow: selected ? '0 0 12px #22c55e33' : undefined,
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Remove this step"
        aria-label="Remove chord"
        style={{
          position: 'absolute',
          top: 2,
          right: 2,
          width: 18,
          height: 18,
          lineHeight: '16px',
          padding: 0,
          border: 'none',
          borderRadius: 3,
          background: '#3f1515',
          color: '#fca5a5',
          fontSize: 12,
          fontWeight: 900,
          cursor: 'pointer',
        }}
      >
        ×
      </button>
      <span style={{ fontSize: 7, color: '#4b5563', fontWeight: 800 }}>{index + 1}</span>
      {isRest ? (
        <button
          type="button"
          onClick={onSelect}
          style={{
            flex: 1,
            border: '1px dashed #374151',
            borderRadius: 4,
            background: 'transparent',
            color: '#6b7280',
            fontSize: 10,
            fontWeight: 800,
            cursor: 'pointer',
            padding: '8px 4px',
          }}
        >
          REST
        </button>
      ) : (
        <input
          type="text"
          value={step.label}
          onFocus={onSelect}
          onChange={(e) => onChange({ label: e.target.value, rest: false })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onHear();
          }}
          placeholder="Am7"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: '#050805',
            color: valid ? '#ecfdf5' : '#f87171',
            border: `1px solid ${valid ? '#1f3a29' : '#7f1d1d'}`,
            borderRadius: 4,
            padding: '4px 4px',
            fontSize: 11,
            fontWeight: 900,
            fontFamily: 'monospace',
            textAlign: 'center',
          }}
        />
      )}
      <select
        value={step.beats}
        onChange={(e) => onChange({ beats: Number(e.target.value) })}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          background: '#050805',
          color: '#67e8f9',
          border: '1px solid #1f2e22',
          borderRadius: 4,
          fontSize: 8,
          fontWeight: 800,
          padding: '2px',
        }}
      >
        {[0.5, 1, 2, 4].map((b) => (
          <option key={b} value={b}>
            {b === 2 ? '½ bar' : b === 4 ? 'full bar' : `${b}b`}
          </option>
        ))}
      </select>
      {!isRest ? (
        <button type="button" onClick={onHear} style={{ ...smallBtnStyle, padding: '3px 4px', fontSize: 7 }}>
          ▶
        </button>
      ) : null}
    </div>
  );
}

function auditionBtnStyle(
  enabled: boolean,
  active: boolean,
  bg: string,
  color: string,
): CSSProperties {
  return {
    background: enabled ? bg : '#111',
    color: enabled ? color : '#444',
    border: `1px solid ${enabled ? '#1f3a29' : '#222'}`,
    borderRadius: 5,
    padding: '5px 12px',
    fontSize: 9,
    fontWeight: 900,
    cursor: enabled ? 'pointer' : 'not-allowed',
    minWidth: 72,
  };
}

const fieldLabelStyle: CSSProperties = {
  fontSize: 7,
  color: '#4b5563',
  fontWeight: 800,
  letterSpacing: 0.3,
};

const selectStyle: CSSProperties = {
  background: '#0a0e16',
  color: '#86efac',
  border: '1px solid #22c55e44',
  borderRadius: 4,
  padding: '5px 8px',
  fontSize: 9,
  fontWeight: 800,
};

const inputStyle: CSSProperties = {
  background: '#0a0a0a',
  color: '#e5e7eb',
  border: '1px solid #1a1a1a',
  borderRadius: 4,
  padding: '5px 8px',
  fontSize: 10,
  fontFamily: 'monospace',
};

const smallBtnStyle: CSSProperties = {
  background: '#112015',
  color: '#86efac',
  border: '1px solid #1f3a29',
  borderRadius: 4,
  padding: '5px 10px',
  fontSize: 9,
  fontWeight: 900,
  cursor: 'pointer',
};

function miniToggleStyle(on: boolean): CSSProperties {
  return {
    background: on ? '#15321e' : '#111',
    color: on ? '#86efac' : '#6b7280',
    border: `1px solid ${on ? '#22c55e88' : '#222'}`,
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 8,
    fontWeight: 900,
    cursor: 'pointer',
  };
}

function exportBtnStyle(enabled: boolean): CSSProperties {
  return {
    background: enabled ? '#1a2438' : '#111',
    color: enabled ? '#fde68a' : '#444',
    border: `1px solid ${enabled ? '#fde68a55' : '#222'}`,
    borderRadius: 4,
    padding: '5px 10px',
    fontSize: 8,
    fontWeight: 900,
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}

/**
 * Rank-based color depth (list is already strongest → weakest).
 * t=1 leftmost chip, t=0 rightmost — high contrast so the gradient is obvious.
 */
function strengthDepthStyle(rank: number, total: number) {
  const t = total <= 1 ? 1 : 1 - rank / (total - 1);

  const bg = `linear-gradient(165deg, hsl(${148 + t * 18} ${55 + t * 35}% ${14 + t * 22}%) 0%, hsl(${165 + t * 10} ${40 + t * 25}% ${8 + t * 14}%) 100%)`;
  const borderColor = `hsl(${150 + t * 20} ${50 + t * 40}% ${28 + t * 38}%)`;

  return {
    background: bg,
    border: `2px solid ${borderColor}`,
    boxShadow:
      t >= 0.92
        ? '0 0 18px rgba(74, 222, 128, 0.55), inset 0 1px 0 rgba(255,255,255,0.12)'
        : t >= 0.55
          ? `0 0 ${6 + Math.round(t * 10)}px rgba(34, 211, 238, ${0.15 + t * 0.35})`
          : t >= 0.25
            ? 'inset 0 0 0 1px rgba(55, 65, 81, 0.5)'
            : 'none',
    labelColor: `hsl(${155 + t * 15} ${40 + t * 45}% ${42 + t * 48}%)`,
    labelSize: t >= 0.85 ? 12 : t >= 0.45 ? 11 : 10,
    labelGlow: t >= 0.7 ? '0 0 8px rgba(134, 239, 172, 0.5)' : 'none',
    percentColor: `hsl(${160 + t * 10} ${20 + t * 30}% ${32 + t * 35}%)`,
    meterTrack: `hsl(220 15% ${10 + t * 8}%)`,
    meterFill: `linear-gradient(90deg, hsl(${185 + t * 15} 70% ${35 + t * 25}%), hsl(${145 + t * 20} 75% ${40 + t * 30}%))`,
  };
}

const suggestionChipStyle: CSSProperties = {
  flex: '0 0 auto',
  minWidth: 56,
  padding: '6px 8px',
  borderRadius: 5,
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 3,
};

const paletteChipStyle: CSSProperties = {
  background: '#0c1018',
  color: '#a7f3d0',
  border: '1px solid #1f3a29',
  borderRadius: 4,
  padding: '3px 8px',
  fontSize: 9,
  fontWeight: 800,
  fontFamily: 'monospace',
  cursor: 'pointer',
};

const actionBtnStyle: CSSProperties = {
  borderRadius: 6,
  padding: '8px 14px',
  fontSize: 9,
  fontWeight: 900,
  cursor: 'pointer',
};
