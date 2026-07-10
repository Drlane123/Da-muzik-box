'use client';

import { RefreshCw, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { genreHasProgressionsForMode } from '@/app/lib/creationStation/chordBuilder';
import {
  defaultGenrePackForMode,
  GROOVE_PROGRESSION_GENRE_PACKS,
  bpmForGenrePack,
  bpmForProgressionPreset,
  formatProgressionCatalogLabel,
} from '@/app/lib/creationStation/grooveLabProgressionLibrary';
import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { useGrooveLabProgressionAudition } from '@/app/hooks/useGrooveLabProgressionAudition';
import { GenoChordCreatorMiniRoll } from '@/app/components/studio/GenoChordCreatorMiniRoll';
import { Se2GenoChordCreatorSketchPanel } from '@/app/components/studio/Se2GenoChordCreatorSketchPanel';
import { Se2ChordGeneratorUpSelect } from '@/app/components/studio/Se2ChordGeneratorUpSelect';
import {
  GenoChordCreatorWheel,
  genoChordCreatorKeyDisplayLabel,
} from '@/app/components/studio/GenoChordCreatorWheel';
import {
  se2ChordGeniePresetCatalog,
  se2GenerateChordGenieProgression,
  se2GenerateFromWheelSelection,
} from '@/app/lib/studio/se2ChordGenieGenerate';
import type { Se2GenoChordCreatorTrack } from '@/app/lib/studio/se2ChordGenieTrack';
import {
  SE2_GENO_CHORD_CREATOR_ACCENT,
  se2GenoChordCreatorAudioOn,
  se2GenoChordCreatorLoopBars,
  se2GenoChordCreatorPresetId,
  se2GenoChordCreatorSe2Sync,
} from '@/app/lib/studio/se2ChordGenieTrack';
import {
  se2BarHasPassingTail,
  se2InjectPassingChordAtBar,
  se2PassingTailLabelForBar,
} from '@/app/lib/studio/se2ChordGeneratorPassingRhythm';
import {
  STUDIO_HARMONY_LOOP_BAR_OPTIONS,
  progressionStepsToChordNotes,
  type StudioHarmonyLoopBars,
} from '@/app/lib/studio/studioInstrumentHarmony';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import {
  getSe2ChordGenieSavedPattern,
  listSe2ChordGenieSavedPatterns,
  deleteSe2ChordGenieSavedPattern,
  renameSe2ChordGenieSavedPattern,
  saveSe2ChordGeniePattern,
  se2ChordGenieIsDeletableUserPattern,
  se2ChordGenieIsUserPatternOptionId,
  se2ChordGenieSavedPatternLabel,
  se2ChordGenieUserPatternIdFromOption,
  se2ChordGenieUserPatternOptionId,
} from '@/app/lib/studio/se2ChordGenieUserSaves';
import {
  peekSe2ChordGenieComposeGenre,
  resolveSe2ChordGenieAutoCompose,
  type Se2ChordGenieAutoComposeResult,
} from '@/app/lib/studio/se2ChordGenieAutoCompose';
import { SE2_CHORD_GENIE_COMPOSE_HELP } from '@/app/lib/studio/se2ChordGenieAutoComposeInstructions';
import {
  SE2_MIDI_COMPOSER_HELP,
  SE2_MIDI_COMPOSER_LABEL,
  type Se2ChordGenieAiMidiMode,
} from '@/app/lib/studio/se2ChordGenieAiMidi';
import { Se2ChordGenieAiMidiPanel, type Se2MidiComposerGeneratedPayload } from '@/app/components/studio/Se2ChordGenieAiMidiPanel';

const COMPOSE_MINT = '#7cf4c6';
const COMPOSE_REGEN_BTN = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  height: 24,
  padding: '0 7px',
  borderRadius: 4,
  border: '1px solid rgba(124, 244, 198, 0.4)',
  background: 'rgba(124, 244, 198, 0.1)',
  color: '#b8ffe8',
  fontSize: 9,
  fontWeight: 800,
  flexShrink: 0,
} as const;

function Se2MidiComposerHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-label={SE2_MIDI_COMPOSER_HELP.title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10070,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(420px, 96vw)',
          maxHeight: 'min(480px, 88vh)',
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a0e',
          border: '1px solid rgba(124, 244, 198, 0.45)',
          borderRadius: 10,
          boxShadow: '0 20px 48px rgba(0,0,0,0.65)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderBottom: '1px solid rgba(124, 244, 198, 0.2)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 900, color: COMPOSE_MINT, letterSpacing: 0.4 }}>
            {SE2_MIDI_COMPOSER_HELP.title.toUpperCase()}
          </span>
          <button
            type="button"
            aria-label="Close help"
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              borderRadius: 4,
              border: '1px solid rgba(124, 244, 198, 0.35)',
              background: 'rgba(124, 244, 198, 0.08)',
              color: COMPOSE_MINT,
              cursor: 'pointer',
            }}
          >
            <X size={12} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '10px 12px' }}>
          {SE2_MIDI_COMPOSER_HELP.sections.map((section) => (
            <div key={section.heading} style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  color: COMPOSE_MINT,
                  letterSpacing: 0.3,
                  marginBottom: 4,
                }}
              >
                {section.heading.toUpperCase()}
              </div>
              <p style={{ fontSize: 10, color: '#b8c8d8', lineHeight: 1.45, margin: 0 }}>{section.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Se2ChordGenieComposeHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-label={SE2_CHORD_GENIE_COMPOSE_HELP.title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10070,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(420px, 96vw)',
          maxHeight: 'min(480px, 88vh)',
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a0e',
          border: '1px solid rgba(124, 244, 198, 0.45)',
          borderRadius: 10,
          boxShadow: '0 20px 48px rgba(0,0,0,0.65)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderBottom: '1px solid rgba(124, 244, 198, 0.2)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 900, color: COMPOSE_MINT, letterSpacing: 0.4 }}>
            {SE2_CHORD_GENIE_COMPOSE_HELP.title.toUpperCase()}
          </span>
          <button
            type="button"
            aria-label="Close help"
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              borderRadius: 4,
              border: '1px solid rgba(124, 244, 198, 0.35)',
              background: 'rgba(124, 244, 198, 0.08)',
              color: COMPOSE_MINT,
              cursor: 'pointer',
            }}
          >
            <X size={12} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '10px 12px' }}>
          {SE2_CHORD_GENIE_COMPOSE_HELP.sections.map((section) => (
            <div key={section.heading} style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  color: COMPOSE_MINT,
                  letterSpacing: 0.3,
                  marginBottom: 4,
                }}
              >
                {section.heading.toUpperCase()}
              </div>
              <p style={{ fontSize: 10, color: '#b8c8d8', lineHeight: 1.45, margin: 0 }}>{section.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export type Se2GenoChordCreatorPanelProps = {
  track: Se2GenoChordCreatorTrack;
  bpm: number;
  beatsPerBar: number;
  disabled?: boolean;
  transportPlaying?: boolean;
  getAudioContext?: () => AudioContext | null;
  getSe2TransportBeat?: () => number;
  onSe2SyncToggle?: () => void;
  onKeyChange: (root: number, mode: ChordMode) => void;
  onLoopBarsChange: (bars: StudioHarmonyLoopBars) => void;
  onPresetChange: (presetId: string) => void;
  onAudioToggle: (on: boolean) => void;
  onDraftStepsChange: (steps: GrooveProgressionStep[]) => void;
  onExportToTrack: (steps: GrooveProgressionStep[], loopBars: StudioHarmonyLoopBars) => void;
  onExportMidiToTrack: (notes: StudioEditor2GenNote[], loopBars: StudioHarmonyLoopBars) => void;
  onPreviewMidi?: (midi: number, velocity01?: number) => void;
  /** Apply catalog / user pattern tempo to SE2 session BPM. */
  onPresetBpmChange?: (bpm: number) => void;
};

export function Se2GenoChordCreatorPanel({
  track,
  bpm,
  beatsPerBar,
  disabled = false,
  transportPlaying = false,
  getAudioContext,
  getSe2TransportBeat,
  onSe2SyncToggle,
  onKeyChange,
  onLoopBarsChange,
  onPresetChange,
  onAudioToggle,
  onDraftStepsChange,
  onExportToTrack,
  onExportMidiToTrack,
  onPreviewMidi,
  onPresetBpmChange,
}: Se2GenoChordCreatorPanelProps) {
  const keyRoot = track.trackKeyRoot ?? 0;
  const keyMode: ChordMode = track.trackKeyMode === 'minor' ? 'minor' : 'major';
  const loopBars = se2GenoChordCreatorLoopBars(track);
  const audioOn = se2GenoChordCreatorAudioOn(track);
  const se2SyncEnabled = se2GenoChordCreatorSe2Sync(track);
  const [status, setStatus] = useState<string | null>(null);
  const [draftSyncToken, setDraftSyncToken] = useState(0);
  const [styleGenreId, setStyleGenreId] = useState(() => defaultGenrePackForMode(keyMode));
  const [passingBarIndex, setPassingBarIndex] = useState(0);
  const [passingSeed, setPassingSeed] = useState(0);
  const [userSaveRev, setUserSaveRev] = useState(0);
  const [saveName, setSaveName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [composeText, setComposeText] = useState('');
  const [lastComposePresetId, setLastComposePresetId] = useState<string | null>(null);
  const [composeHelpOpen, setComposeHelpOpen] = useState(false);
  const [midiComposerHelpOpen, setMidiComposerHelpOpen] = useState(false);
  const [aiMidiMode, setAiMidiMode] = useState<Se2ChordGenieAiMidiMode>('off');

  const composeGenrePeek = useMemo(() => {
    if (!composeText.trim()) return null;
    return peekSe2ChordGenieComposeGenre(composeText, styleGenreId);
  }, [composeText, styleGenreId]);

  useEffect(() => {
    setPassingBarIndex((i) => Math.min(i, loopBars - 1));
  }, [loopBars]);

  const stylePacks = useMemo(
    () =>
      GROOVE_PROGRESSION_GENRE_PACKS.filter((g) => genreHasProgressionsForMode(g.id, keyMode)),
    [keyMode],
  );

  useEffect(() => {
    if (stylePacks.some((g) => g.id === styleGenreId)) return;
    setStyleGenreId(stylePacks[0]?.id ?? defaultGenrePackForMode(keyMode));
  }, [keyMode, styleGenreId, stylePacks]);

  const presetCatalog = useMemo(
    () => se2ChordGeniePresetCatalog(keyRoot, keyMode),
    [keyRoot, keyMode],
  );

  const presetId = se2GenoChordCreatorPresetId(track) || presetCatalog[0]?.id || '';
  const presetLabel = useMemo(() => {
    const userLabel = se2ChordGenieSavedPatternLabel(presetId);
    if (userLabel) return userLabel;
    return presetCatalog.find((p) => p.id === presetId)?.label ?? 'Progression preset';
  }, [presetCatalog, presetId, userSaveRev]);

  const draftSteps = track.harmonySteps ?? [];

  const userPatterns = useMemo(
    () => listSe2ChordGenieSavedPatterns(),
    [userSaveRev],
  );

  const catalogPresetId = se2ChordGenieIsUserPatternOptionId(presetId)
    ? ''
    : presetId;

  const applyPatternBpm = useCallback(
    (nextBpm: number) => {
      onPresetBpmChange?.(clampGrooveLabBpm(nextBpm));
    },
    [onPresetBpmChange],
  );

  const audition = useGrooveLabProgressionAudition({
    getAudioContext,
    bpm,
    chordVoice: 'grand',
    perfMode: 'block',
    linkedChordVolume: 0.82,
  });

  const applyDraft = useCallback(
    (steps: GrooveProgressionStep[], message: string, nextPresetId?: string) => {
      if (nextPresetId) onPresetChange(nextPresetId);
      onDraftStepsChange(steps);
      setDraftSyncToken((t) => t + 1);
      setStatus(message);
    },
    [onDraftStepsChange, onPresetChange],
  );

  const handleMidiComposerGenerated = useCallback(
    (result: Se2MidiComposerGeneratedPayload) => {
      if (result.keyRoot !== keyRoot || result.keyMode !== keyMode) {
        onKeyChange(result.keyRoot, result.keyMode);
      }
      if (result.loopBars !== loopBars) {
        onLoopBarsChange(result.loopBars);
      }
      if (result.bpm != null) {
        applyPatternBpm(result.bpm);
      }

      if (result.steps?.length) {
        applyDraft(
          result.steps,
          `SE2 MIDI Composer: ${result.summary}`,
          result.presetId,
        );
      }

      const rollNotes =
        result.notes ??
        (result.steps?.length
          ? (() => {
              const built = progressionStepsToChordNotes(result.steps, {
                beatsPerBar,
                barCount: result.loopBars,
                sustainSlots: 4,
                maxDurationBeats: Math.min(
                  beatsPerBar * 0.92,
                  Math.max(0.5, beatsPerBar - 0.08),
                ),
              });
              return 'message' in built ? undefined : built;
            })()
          : undefined);

      if (rollNotes?.length) {
        onExportMidiToTrack(rollNotes, result.loopBars);
        if (!result.steps?.length) {
          setStatus(`SE2 MIDI Composer: ${result.summary} — ${rollNotes.length} notes on the roll`);
        }
      } else if (!result.steps?.length) {
        setStatus('SE2 MIDI Composer: nothing to load — try another prompt.');
      }
    },
    [
      applyDraft,
      applyPatternBpm,
      beatsPerBar,
      keyMode,
      keyRoot,
      loopBars,
      onExportMidiToTrack,
      onKeyChange,
      onLoopBarsChange,
    ],
  );

  const runPresetGenerate = useCallback(
    (opts?: { presetId?: string; seed?: number }) => {
      const generated = se2GenerateChordGenieProgression({
        keyRoot,
        mode: keyMode,
        loopBars,
        beatsPerBar,
        presetId: opts?.presetId ?? presetId,
        seed: opts?.seed ?? Date.now(),
      });
      if ('message' in generated) {
        setStatus(generated.message);
        return;
      }
      applyDraft(generated.steps, 'Preset cards loaded — export when ready.', generated.presetId);
      const hit = presetCatalog.find((p) => p.id === generated.presetId);
      if (hit) applyPatternBpm(bpmForProgressionPreset(hit.id, keyRoot));
    },
    [applyDraft, applyPatternBpm, beatsPerBar, keyMode, keyRoot, loopBars, presetCatalog, presetId],
  );

  const applyComposeResult = useCallback(
    (result: Se2ChordGenieAutoComposeResult) => {
      const genKeyRoot = result.keyRoot ?? keyRoot;
      const genKeyMode = result.keyMode ?? keyMode;
      const genLoopBars = result.loopBars ?? loopBars;

      if (result.keyRoot != null || result.keyMode != null) {
        onKeyChange(genKeyRoot, genKeyMode);
      }
      if (result.loopBars && result.loopBars !== loopBars) {
        onLoopBarsChange(result.loopBars);
      }
      if (result.genreId && stylePacks.some((g) => g.id === result.genreId)) {
        setStyleGenreId(result.genreId);
      }

      let steps = draftSteps;
      let message = '';
      let nextPresetId = result.presetId;

      if (result.useWheel) {
        const generated = se2GenerateFromWheelSelection({
          keyRoot: genKeyRoot,
          mode: genKeyMode,
          loopBars: genLoopBars,
          beatsPerBar,
          genreId: result.genreId,
          presetId: result.presetId,
          seed: Date.now(),
        });
        if ('message' in generated) {
          setStatus(generated.message);
          return;
        }
        steps = generated.steps;
        nextPresetId = generated.presetId || result.presetId;
        message = `Compose: ${result.summary}`;
      } else {
        const generated = se2GenerateChordGenieProgression({
          keyRoot: genKeyRoot,
          mode: genKeyMode,
          loopBars: genLoopBars,
          beatsPerBar,
          presetId: result.presetId,
          seed: Date.now(),
        });
        if ('message' in generated) {
          setStatus(generated.message);
          return;
        }
        steps = generated.steps;
        nextPresetId = generated.presetId;
        message = `Compose: ${result.summary}`;
      }

      if (result.addPassingChord && steps.length > 0) {
        const passBar = genLoopBars - 1;
        const passResult = se2InjectPassingChordAtBar(steps, passBar, genLoopBars, {
          keyRoot: genKeyRoot,
          mode: genKeyMode,
          genreId: result.genreId,
          beatsPerBar,
          seed: Date.now() * 31 + passBar,
        });
        if (passResult.passLabel) {
          steps = passResult.steps;
          message = `${message} · passing on bar ${passBar + 1}`;
        }
      }

      applyDraft(steps, message, nextPresetId);
      setLastComposePresetId(nextPresetId);

      const cat = se2ChordGeniePresetCatalog(genKeyRoot, genKeyMode);
      const hit = cat.find((p) => p.id === nextPresetId);
      if (result.bpm != null) {
        applyPatternBpm(result.bpm);
      } else if (hit) {
        applyPatternBpm(bpmForProgressionPreset(hit.id, genKeyRoot));
      } else {
        applyPatternBpm(bpmForGenrePack(result.genreId));
      }

      if (result.alternates.length) {
        setStatus(`${message} · also: ${result.alternates.slice(0, 3).join(', ')}`);
      }
    },
    [
      applyDraft,
      applyPatternBpm,
      beatsPerBar,
      draftSteps,
      keyMode,
      keyRoot,
      loopBars,
      onKeyChange,
      onLoopBarsChange,
      stylePacks,
    ],
  );

  const runComposeGo = useCallback(() => {
    const result = resolveSe2ChordGenieAutoCompose(composeText, {
      keyRoot,
      keyMode,
      fallbackGenreId: styleGenreId,
      loopBars,
    });
    if (!result) {
      setStatus('Type a style or progression — e.g. pop axis 8 bars bpm 120');
      return;
    }
    applyComposeResult(result);
  }, [applyComposeResult, composeText, keyMode, keyRoot, loopBars, styleGenreId]);

  const runComposeRegen = useCallback(() => {
    const result = resolveSe2ChordGenieAutoCompose(composeText, {
      keyRoot,
      keyMode,
      fallbackGenreId: styleGenreId,
      loopBars,
      excludePresetId: lastComposePresetId,
    });
    if (!result) {
      setStatus('Type a phrase first, then Regen for another match');
      return;
    }
    applyComposeResult(result);
  }, [applyComposeResult, composeText, keyMode, keyRoot, lastComposePresetId, loopBars, styleGenreId]);

  const handleComposeKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runComposeGo();
      }
    },
    [runComposeGo],
  );

  useEffect(() => {
    if (!composeGenrePeek?.explicit) return;
    if (!stylePacks.some((g) => g.id === composeGenrePeek.genreId)) return;
    setStyleGenreId(composeGenrePeek.genreId);
  }, [composeGenrePeek, stylePacks]);

  const handleWheelSelect = useCallback(
    (root: number, mode: ChordMode) => {
      onKeyChange(root, mode);
      const generated = se2GenerateFromWheelSelection({
        keyRoot: root,
        mode,
        loopBars,
        beatsPerBar,
        genreId: styleGenreId,
        seed: Date.now(),
      });
      if ('message' in generated) {
        setStatus(generated.message);
        return;
      }
      applyDraft(
        generated.steps,
        `Wheel: ${genoChordCreatorKeyDisplayLabel(root, mode)} · ${stylePacks.find((s) => s.id === styleGenreId)?.label ?? 'style'}`,
        generated.presetId || undefined,
      );
      if (generated.presetId) {
        applyPatternBpm(bpmForProgressionPreset(generated.presetId, root));
      } else {
        applyPatternBpm(bpmForGenrePack(styleGenreId));
      }
    },
    [applyDraft, applyPatternBpm, beatsPerBar, loopBars, onKeyChange, styleGenreId, stylePacks],
  );

  const loadUserPattern = useCallback(
    (saved: ReturnType<typeof getSe2ChordGenieSavedPattern>) => {
      if (!saved) {
        setStatus('Saved pattern not found');
        return;
      }
      onPresetChange(se2ChordGenieUserPatternOptionId(saved.id));
      onKeyChange(saved.keyRoot, saved.keyMode);
      if (saved.loopBars !== loopBars) onLoopBarsChange(saved.loopBars);
      if (saved.styleGenreId) setStyleGenreId(saved.styleGenreId);
      applyPatternBpm(saved.bpm);
      applyDraft(
        saved.steps.map((s) => ({ ...s })),
        `Loaded · ${saved.name} · ${saved.bpm} BPM`,
      );
    },
    [applyDraft, applyPatternBpm, loopBars, onKeyChange, onLoopBarsChange, onPresetChange],
  );

  const handlePresetPick = useCallback(
    (id: string) => {
      if (se2ChordGenieIsUserPatternOptionId(id)) {
        loadUserPattern(getSe2ChordGenieSavedPattern(se2ChordGenieUserPatternIdFromOption(id)));
        return;
      }
      onPresetChange(id);
      const hit = presetCatalog.find((p) => p.id === id);
      if (hit) {
        setStyleGenreId(hit.genreId);
        applyPatternBpm(bpmForProgressionPreset(hit.id, keyRoot));
      }
      runPresetGenerate({ presetId: id, seed: Date.now() });
    },
    [
      applyPatternBpm,
      keyRoot,
      loadUserPattern,
      onPresetChange,
      presetCatalog,
      runPresetGenerate,
    ],
  );

  const handleSavePattern = useCallback(() => {
    if (!draftSteps.length) {
      setStatus('Add chords to the progression before saving');
      return;
    }
    const trimmed = saveName.trim();
    if (!trimmed) {
      setStatus('Type a name for your new user pattern');
      return;
    }
    const entry = saveSe2ChordGeniePattern(trimmed, {
      steps: draftSteps.map((s) => ({ ...s })),
      keyRoot,
      keyMode,
      loopBars,
      styleGenreId,
      bpm: clampGrooveLabBpm(bpm),
      sourcePresetId: se2ChordGenieIsUserPatternOptionId(presetId)
        ? getSe2ChordGenieSavedPattern(se2ChordGenieUserPatternIdFromOption(presetId))?.sourcePresetId ??
          ''
        : presetId,
    });
    setUserSaveRev((n) => n + 1);
    setSaveName('');
    onPresetChange(se2ChordGenieUserPatternOptionId(entry.id));
    setStatus(`✓ Saved user pattern · ${entry.name} · ${entry.bpm} BPM`);
  }, [
    draftSteps,
    keyMode,
    keyRoot,
    loopBars,
    onPresetChange,
    bpm,
    presetId,
    saveName,
    styleGenreId,
  ]);

  const startRename = useCallback((id: string, currentName: string) => {
    setRenamingId(id);
    setRenameDraft(currentName);
  }, []);

  const commitRename = useCallback(() => {
    if (!renamingId) return;
    const next = renameSe2ChordGenieSavedPattern(renamingId, renameDraft);
    setRenamingId(null);
    setRenameDraft('');
    if (!next) {
      setStatus('Could not rename — name cannot be empty');
      return;
    }
    setUserSaveRev((n) => n + 1);
    if (se2ChordGenieIsUserPatternOptionId(presetId) &&
        se2ChordGenieUserPatternIdFromOption(presetId) === renamingId) {
      setStatus(`Renamed · ${next.name}`);
    }
  }, [presetId, renameDraft, renamingId]);

  const handleDeleteUserPattern = useCallback(
    (pattern: (typeof userPatterns)[number]) => {
      if (!se2ChordGenieIsDeletableUserPattern(pattern)) {
        setStatus('Built-in presets cannot be deleted — only patterns you saved with Save');
        return;
      }
      if (!window.confirm(`Delete your saved pattern "${pattern.name}"?`)) return;
      deleteSe2ChordGenieSavedPattern(pattern.id);
      if (renamingId === pattern.id) {
        setRenamingId(null);
        setRenameDraft('');
      }
      const wasActive =
        se2ChordGenieIsUserPatternOptionId(presetId) &&
        se2ChordGenieUserPatternIdFromOption(presetId) === pattern.id;
      if (wasActive) {
        const fallback = presetCatalog[0]?.id;
        if (fallback) onPresetChange(fallback);
      }
      setUserSaveRev((n) => n + 1);
      setStatus(`Deleted your save · ${pattern.name}`);
    },
    [onPresetChange, presetCatalog, presetId, renamingId],
  );

  const runPassingChordForBar = useCallback(() => {
    const bar = Math.min(passingBarIndex, loopBars - 1);
    const nextSeed = passingSeed + 1;
    const result = se2InjectPassingChordAtBar(draftSteps, bar, loopBars, {
      keyRoot,
      mode: keyMode,
      genreId: styleGenreId,
      beatsPerBar,
      seed: nextSeed * 31 + bar,
    });
    setPassingSeed(nextSeed);
    if (!result.passLabel) {
      setStatus(result.message ?? 'Could not add passing chord.');
      return;
    }
    applyDraft(result.steps, result.message ?? `Passing chord on bar ${bar + 1}.`);
  }, [
    applyDraft,
    beatsPerBar,
    draftSteps,
    keyMode,
    keyRoot,
    loopBars,
    passingBarIndex,
    passingSeed,
    styleGenreId,
  ]);

  const runRegeneratePassingForBar = useCallback(() => {
    const bar = Math.min(passingBarIndex, loopBars - 1);
    const currentPass = se2PassingTailLabelForBar(draftSteps, bar, loopBars, beatsPerBar);
    if (!currentPass) {
      setStatus(`Bar ${bar + 1} has no passing chord yet — use Passing chords first.`);
      return;
    }
    const nextSeed = passingSeed + 1;
    const result = se2InjectPassingChordAtBar(draftSteps, bar, loopBars, {
      keyRoot,
      mode: keyMode,
      genreId: styleGenreId,
      beatsPerBar,
      seed: nextSeed * 31 + bar,
      skipLabel: currentPass,
      cycleIndex: nextSeed,
    });
    setPassingSeed(nextSeed);
    if (!result.passLabel) {
      setStatus(result.message ?? 'No other passing chord found for this bar.');
      return;
    }
    applyDraft(result.steps, result.message ?? `Regenerated passing on bar ${bar + 1}.`);
  }, [
    applyDraft,
    beatsPerBar,
    draftSteps,
    keyMode,
    keyRoot,
    loopBars,
    passingBarIndex,
    passingSeed,
    styleGenreId,
  ]);

  const passingRegenerateDisabled = useMemo(() => {
    const bar = Math.min(passingBarIndex, loopBars - 1);
    return (
      draftSteps.length === 0 ||
      !se2BarHasPassingTail(draftSteps, bar, loopBars, beatsPerBar)
    );
  }, [beatsPerBar, draftSteps, loopBars, passingBarIndex]);

  const stopAudition = useCallback(() => {
    if (transportPlaying) return;
    audition.stopPlayback();
  }, [audition, transportPlaying]);

  const wheelSize = 200;
  const controlH = 28;
  const presetColW = 312;
  const presetControlH = 24;
  /** Preset column + gap + key selector box — MIDI composer panel right edge aligns here. */
  const midiComposerPanelSpanW = presetColW + 8 + 2 + (wheelSize + 16);

  const presetOptions = useMemo(
    () =>
      presetCatalog.map((p) => ({
        value: p.id,
        label: formatProgressionCatalogLabel(p, keyRoot),
      })),
    [keyRoot, presetCatalog],
  );

  const styleOptions = useMemo(
    () => stylePacks.map((g) => ({ value: g.id, label: g.label })),
    [stylePacks],
  );

  return (
    <div
      className="min-w-0 px-2 py-1"
      style={{
        background: 'linear-gradient(180deg, #101828 0%, #080c14 100%)',
      }}
    >
      {/* Left: Length/Audio + sketch · Right: presets + key wheel */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col shrink-0 min-w-0 max-w-full">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            <div className="shrink-0">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-[#7cf4c6] mb-1">
                Length
              </span>
              <div className="flex gap-1">
                {STUDIO_HARMONY_LOOP_BAR_OPTIONS.map((bars) => {
                  const sel = loopBars === bars;
                  return (
                    <button
                      key={bars}
                      type="button"
                      disabled={disabled}
                      onClick={() => onLoopBarsChange(bars)}
                      className="inline-flex items-center justify-center rounded border px-3 text-[10px] font-black uppercase disabled:opacity-40 whitespace-nowrap"
                      style={{
                        height: controlH,
                        minWidth: controlH * 2.4,
                        borderColor: sel ? '#7cf4c6' : 'rgba(77,168,255,0.22)',
                        background: sel ? 'rgba(124,244,198,0.22)' : '#080c14',
                        color: sel ? '#fff' : '#9ab0a0',
                      }}
                    >
                      {bars} bars
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="shrink-0 pb-0.5">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-[#7cf4c6] mb-1">
                BPM
              </span>
              <div
                className="inline-flex items-center rounded border overflow-hidden"
                style={{
                  height: controlH,
                  borderColor: 'rgba(77,168,255,0.22)',
                  background: '#080c14',
                }}
                title="Pattern tempo — updates when you pick a progression; edit to set session BPM"
              >
                <input
                  type="number"
                  min={40}
                  max={240}
                  step={1}
                  disabled={disabled}
                  value={clampGrooveLabBpm(bpm)}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) applyPatternBpm(n);
                  }}
                  className="w-[52px] bg-transparent text-center outline-none text-[11px] font-black tabular-nums"
                  style={{ color: '#7cf4c6' }}
                />
                <span
                  className="px-1.5 text-[8px] font-bold uppercase border-l"
                  style={{
                    color: '#6a8a78',
                    borderColor: 'rgba(77,168,255,0.18)',
                    lineHeight: `${controlH}px`,
                  }}
                >
                  bpm
                </span>
              </div>
            </div>

            <div className="shrink-0 pb-0.5">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-[#7cf4c6] mb-1">
                Audio
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAudioToggle(!audioOn)}
                className="inline-flex items-center justify-center gap-1.5 rounded border px-3 text-[10px] font-bold uppercase"
                style={{
                  height: controlH,
                  minWidth: controlH * 2.4,
                  borderColor: 'rgba(77,168,255,0.22)',
                  color: audioOn ? '#7cf4c6' : '#6a6a78',
                  background: '#080c14',
                }}
              >
                {audioOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
                {audioOn ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          <div className="mt-2.5 shrink-0">
            <Se2GenoChordCreatorSketchPanel
            embedded
            defaultOpen={false}
            track={track}
            bpm={bpm}
            beatsPerBar={beatsPerBar}
            disabled={disabled}
            transportPlaying={transportPlaying}
            getAudioContext={getAudioContext}
            onLoopBarsChange={onLoopBarsChange}
            onDraftStepsChange={onDraftStepsChange}
            onExportToTrack={onExportToTrack}
          />
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 ml-auto shrink-0">
          <div className="flex items-start gap-2 overflow-visible">
          <div className="flex flex-col gap-0.5 shrink-0 overflow-visible" style={{ width: presetColW }}>
            <div>
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#7cf4c6]">
                  Preset pattern
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => runPresetGenerate({ seed: Date.now() })}
                  className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[8px] font-black uppercase whitespace-nowrap shrink-0"
                  style={{
                    borderColor: 'rgba(124,244,198,0.45)',
                    background: 'rgba(124,244,198,0.12)',
                    color: '#7cf4c6',
                    height: presetControlH,
                  }}
                  title="Preset generate"
                >
                  <Sparkles size={10} aria-hidden />
                  Generate
                </button>
              </div>
              <Se2ChordGeneratorUpSelect
                id="se2-cc-preset"
                label="Preset pattern"
                hideLabel
                value={catalogPresetId || presetOptions[0]?.value || ''}
                options={presetOptions}
                disabled={disabled}
                onChange={handlePresetPick}
                accentHex="#7cf4c6"
                minWidthPx={presetColW}
                controlHeight={presetControlH}
                alignRight
              />
              <p
                data-se2-chord-genie-presets
                data-se2-mc-body
                className="mt-0.5 text-[#6a8a78] leading-tight"
              >
                Built-in factory presets
              </p>
            </div>

            <div data-se2-chord-genie-presets>
              <span
                data-se2-mc-label
                className="block text-[#ffb4b4] mb-0.5"
              >
                Your saved patterns
              </span>
              <p data-se2-mc-body className="mb-0.5 text-[#8a6a6a] leading-tight">
                Only names you type below and Save appear here — Delete removes your save, not factory presets
              </p>
              <div
                className="flex items-center gap-1 rounded border px-1 mb-0.5"
                style={{
                  height: 20,
                  borderColor: 'rgba(255,130,130,0.45)',
                  background: 'rgba(255,85,85,0.06)',
                }}
              >
                <input
                  type="text"
                  value={saveName}
                  disabled={disabled}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSavePattern();
                  }}
                  placeholder="New pattern name…"
                  maxLength={48}
                  data-se2-mc-input
                  className="flex-1 min-w-0 bg-transparent outline-none px-1"
                  style={{ color: '#ececf4' }}
                />
                <button
                  type="button"
                  disabled={disabled || !draftSteps.length || !saveName.trim()}
                  onClick={handleSavePattern}
                  data-se2-mc-btn
                  className="shrink-0 rounded border px-1.5 uppercase disabled:opacity-40"
                  style={{
                    height: 18,
                    borderColor: 'rgba(255,130,130,0.55)',
                    color: '#ffb4b4',
                    background: 'rgba(255,85,85,0.12)',
                  }}
                  title="Save as new user pattern (never overwrites factory presets)"
                >
                  Save
                </button>
              </div>
              <div
                className="max-h-[132px] overflow-y-auto overflow-x-hidden rounded border"
                style={{
                  borderColor: 'rgba(77,168,255,0.16)',
                  background: '#060a10',
                }}
              >
                {userPatterns.length === 0 ? (
                  <p data-se2-mc-body className="px-2 py-1.5 text-[#6a8a78]">No saved patterns yet</p>
                ) : (
                  userPatterns.map((p) => {
                    const active =
                      se2ChordGenieIsUserPatternOptionId(presetId) &&
                      se2ChordGenieUserPatternIdFromOption(presetId) === p.id;
                    const renaming = renamingId === p.id;
                    const canDelete = se2ChordGenieIsDeletableUserPattern(p);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-1 px-1 py-0.5 border-b last:border-b-0"
                        style={{
                          borderColor: 'rgba(77,168,255,0.08)',
                          background: active ? 'rgba(124,244,198,0.08)' : 'transparent',
                        }}
                      >
                        {renaming ? (
                          <input
                            type="text"
                            value={renameDraft}
                            autoFocus
                            maxLength={48}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename();
                              if (e.key === 'Escape') {
                                setRenamingId(null);
                                setRenameDraft('');
                              }
                            }}
                            onBlur={commitRename}
                            data-se2-mc-input
                            className="flex-1 min-w-0 bg-transparent outline-none"
                            style={{ color: '#fff' }}
                          />
                        ) : (
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => loadUserPattern(p)}
                            data-se2-mc-input
                            className="flex-1 min-w-0 text-left truncate disabled:opacity-40"
                            style={{ color: active ? '#7cf4c6' : '#c8d4e8' }}
                            title={`${p.name} · ${p.bpm} BPM`}
                          >
                            {p.name}
                            <span className="text-[#6a8a78]"> · {p.bpm}</span>
                          </button>
                        )}
                        {!renaming ? (
                          <>
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => startRename(p.id, p.name)}
                              data-se2-mc-label
                              className="shrink-0 px-1.5 disabled:opacity-40"
                              style={{ color: '#8aa0b8' }}
                              title="Rename your save"
                            >
                              Rename
                            </button>
                            {canDelete ? (
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => handleDeleteUserPattern(p)}
                                data-se2-mc-label
                                className="shrink-0 px-1.5 disabled:opacity-40"
                                style={{ color: '#f6a9a9' }}
                                title="Delete your saved pattern"
                              >
                                Delete
                              </button>
                            ) : null}
                          </>
                        ) : canDelete ? (
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => handleDeleteUserPattern(p)}
                            data-se2-mc-label
                            className="shrink-0 px-1.5 disabled:opacity-40"
                            style={{ color: '#f6a9a9' }}
                            title="Delete your saved pattern"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <Se2ChordGeneratorUpSelect
              id="se2-cc-wheel-style"
              label="Wheel style"
              value={styleGenreId}
              options={styleOptions}
              disabled={disabled}
              onChange={setStyleGenreId}
              accentHex="#4DA8FF"
              minWidthPx={presetColW}
              controlHeight={presetControlH}
              alignRight
            />

            <div className="mt-1 overflow-visible">
              <div className="flex items-center gap-1 flex-wrap">
                <span
                  className="se2-type-label shrink-0 font-bold uppercase tracking-wider"
                  style={{ color: '#c4b5fd', fontSize: 11 }}
                >
                  {SE2_MIDI_COMPOSER_LABEL}
                </span>
                <button
                  type="button"
                  aria-label="SE2 MIDI Composer help"
                  title="How SE2 MIDI Composer works"
                  onClick={() => setMidiComposerHelpOpen(true)}
                  className="inline-flex items-center justify-center shrink-0 rounded border text-[9px] font-black"
                  style={{
                    width: 14,
                    height: 14,
                    borderColor: 'rgba(124, 244, 198, 0.45)',
                    background: 'rgba(124, 244, 198, 0.12)',
                    color: COMPOSE_MINT,
                    lineHeight: 1,
                  }}
                >
                  ?
                </button>
                <button
                  type="button"
                  id="se2-cc-ai-midi"
                  data-se2-midi-composer-toggle
                  disabled={disabled}
                  aria-pressed={aiMidiMode === 'agent'}
                  onClick={() => setAiMidiMode(aiMidiMode === 'agent' ? 'off' : 'agent')}
                  className="inline-flex items-center justify-center shrink-0 rounded border px-2.5 outline-none disabled:opacity-40 uppercase"
                  style={{
                    height: presetControlH,
                    minWidth: 44,
                    borderColor:
                      aiMidiMode === 'agent' ? 'rgba(196, 181, 253, 0.55)' : 'rgba(77,168,255,0.22)',
                    background: aiMidiMode === 'agent' ? 'rgba(196, 181, 253, 0.12)' : '#080c14',
                    color: aiMidiMode === 'agent' ? '#c4b5fd' : '#6a6a78',
                  }}
                >
                  {aiMidiMode === 'agent' ? 'On' : 'Off'}
                </button>
              </div>
              {aiMidiMode === 'agent' ? (
                <div
                  className="flex justify-start min-w-0 overflow-visible"
                  style={{ width: midiComposerPanelSpanW, marginTop: 16 }}
                >
                  <Se2ChordGenieAiMidiPanel
                    disabled={disabled}
                    keyRoot={keyRoot}
                    keyMode={keyMode}
                    bpm={bpm}
                    beatsPerBar={beatsPerBar}
                    audioOn={audioOn}
                    transportPlaying={transportPlaying}
                    genreId={styleGenreId}
                    fallbackGenreId={styleGenreId}
                    getAudioContext={getAudioContext}
                    onKeyChange={onKeyChange}
                    onApplyToRoll={handleMidiComposerGenerated}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col justify-end self-stretch shrink-0 pl-0.5">
            <GenoChordCreatorWheel
              keyRoot={keyRoot}
              mode={keyMode}
              disabled={disabled}
              size={wheelSize}
              compact
              onSelect={handleWheelSelect}
            />
          </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span className="text-[9px] font-bold uppercase tracking-wider text-[#7cf4c6] shrink-0">
          Compose
        </span>
        <button
          type="button"
          aria-label="Compose help"
          title="How to type chord progressions"
          onClick={() => setComposeHelpOpen(true)}
          className="inline-flex items-center justify-center shrink-0 rounded border text-[9px] font-black"
          style={{
            width: 14,
            height: 14,
            borderColor: 'rgba(124, 244, 198, 0.45)',
            background: 'rgba(124, 244, 198, 0.12)',
            color: COMPOSE_MINT,
            lineHeight: 1,
          }}
        >
          ?
        </button>
        <input
          type="text"
          value={composeText}
          disabled={disabled}
          onChange={(e) => setComposeText(e.target.value)}
          onKeyDown={handleComposeKeyDown}
          placeholder="Type any chord… Quiet Storm, Teen Axis, Gospel 2-5-1"
          aria-label="Compose — describe style and progression, then Go"
          className="flex-1 min-w-[140px] rounded border bg-transparent outline-none text-[10px] font-semibold px-2"
          style={{
            height: 24,
            borderColor: 'rgba(124, 244, 198, 0.35)',
            background: 'rgba(0, 0, 0, 0.35)',
            color: '#e8fff8',
          }}
        />
        <button
          type="button"
          disabled={disabled || !composeText.trim()}
          onClick={runComposeGo}
          title="Generate progression from typed phrase"
          className="inline-flex items-center gap-1 rounded border px-2 text-[9px] font-black uppercase shrink-0 disabled:opacity-45"
          style={{
            height: 24,
            borderColor: 'rgba(124, 244, 198, 0.45)',
            background: 'rgba(124, 244, 198, 0.12)',
            color: COMPOSE_MINT,
          }}
        >
          <Sparkles size={10} aria-hidden />
          Go
        </button>
        <button
          type="button"
          disabled={disabled || !composeText.trim()}
          onClick={runComposeRegen}
          title="Try another preset for this phrase"
          aria-label="Regenerate compose match"
          style={{
            ...COMPOSE_REGEN_BTN,
            cursor: disabled || !composeText.trim() ? 'not-allowed' : 'pointer',
            opacity: disabled || !composeText.trim() ? 0.45 : 1,
          }}
        >
          <RefreshCw size={10} aria-hidden />
          Regen
        </button>
      </div>
      <Se2ChordGenieComposeHelpModal open={composeHelpOpen} onClose={() => setComposeHelpOpen(false)} />
      <Se2MidiComposerHelpModal
        open={midiComposerHelpOpen}
        onClose={() => setMidiComposerHelpOpen(false)}
      />

      <div className="mt-1 min-h-[12px]">
        {status ? (
          <p className="text-[8px] text-[#7cf4c6] leading-snug text-right">{status}</p>
        ) : (
          <p className="text-[8px] leading-snug text-[#6a8a78] truncate text-right" title={`${presetLabel} · ${clampGrooveLabBpm(bpm)} BPM`}>
            {presetLabel} · {clampGrooveLabBpm(bpm)} BPM
          </p>
        )}
      </div>

      <div
        className="mt-2 pt-2 -mx-1 border-t"
        style={{ borderColor: 'rgba(77,168,255,0.18)' }}
      >
        <GenoChordCreatorMiniRoll
          steps={draftSteps}
          loopBars={loopBars}
          beatsPerBar={beatsPerBar}
          bpm={bpm}
          getAudioContext={getAudioContext}
          audioOn={audioOn}
          transportPlaying={transportPlaying}
          se2SyncEnabled={se2SyncEnabled}
          onSe2SyncToggle={onSe2SyncToggle}
          getSe2TransportBeat={getSe2TransportBeat}
          genreId={styleGenreId}
          disabled={disabled}
          scrollWithParent
          passingBarIndex={passingBarIndex}
          onPassingBarIndexChange={setPassingBarIndex}
          onPassingChordApply={runPassingChordForBar}
          onPassingChordRegenerate={runRegeneratePassingForBar}
          passingApplyDisabled={draftSteps.length === 0}
          passingRegenerateDisabled={passingRegenerateDisabled}
          onExportMidiToTrack={(notes, bars) => {
            onExportMidiToTrack(notes, bars);
            setStatus(`Exported ${notes.length} chord notes to track — edit on the lane`);
          }}
          onClearProgression={() => {
            applyDraft([], 'Cleared progression.');
          }}
          onPreviewStart={stopAudition}
          onPreviewMidi={
            onPreviewMidi && !transportPlaying
              ? (midi) => onPreviewMidi(midi, 0.85)
              : undefined
          }
        />
      </div>
    </div>
  );
}

export const Se2ChordGeniePanel = Se2GenoChordCreatorPanel;
export type Se2ChordGeniePanelProps = Se2GenoChordCreatorPanelProps;
