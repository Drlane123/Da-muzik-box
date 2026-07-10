'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import {
  GENO_PROGRESSIONS,
  SE2_SYNTH_GENO_CHORD_DEFAULTS,
  se2SynthGenoApplyStylePreset,
  se2SynthGenoBarDegreesFromProgression,
  se2SynthGenoClearPluginPart,
  se2SynthGenoDefaultPartSeeds,
  se2SynthGenoRebuildPluginHarmony,
  se2SynthGenoRegeneratePluginPart,
  type Se2SynthGenoChordPluginState,
  type Se2SynthGenoPluginDraft,
  type Se2SynthGenoPluginPartId,
  type Se2SynthGenoPluginPartSeeds,
  type Se2SynthGenoPluginSoundSelection,
  SE2_SYNTH_GENO_DEFAULT_SOUND_SELECTION,
} from '@/app/lib/studio/se2SynthGenoChordPlugin';
import {
  readSe2SynthGenoPluginSession,
  writeSe2SynthGenoPluginSession,
} from '@/app/lib/studio/se2SynthGenoPluginSessionCache';
import type {
  GenoBarChordSpec,
  GenoBarChopQuant,
  GenoChordType,
  GenoExtension,
  GenoPerfMode,
  GenoRepeaterQuant,
} from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import {
  melodyHasRepeaterLikeSpacing,
  melodyLooksLikeVoicingArpeggio,
  type GenoMelodyGenre,
} from '@/app/lib/studio/se2SynthGenoMelodyEngine';
import { type GenoBassPattern } from '@/app/lib/studio/se2SynthGenoBassEngine';
import {
  type Se2SynthGenoPluginPreviewOpts,
  getSe2SynthGenoPluginPreviewLoopBeat,
} from '@/app/lib/studio/se2SynthGenoPluginPreview';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import { GENO_STYLE_CHIP_ORDER, genoStylePreset } from '@/app/lib/studio/se2SynthGenoStylePresets';
import type { Se2SynthGenoComposeNote, Se2SynthGenoStackPart, Se2SynthGenoApplyStackMeta } from '@/app/lib/studio/se2SynthGenoCompose';
import {
  genoNotesInBar,
  se2SynthGenoPluginBarLaneUndoKey,
  se2SynthGenoPluginRegenerateBarLane,
  se2SynthGenoPluginUndoBarLane,
  type Se2SynthGenoPluginBarLanePart,
  type Se2SynthGenoPluginRegenContext,
} from '@/app/lib/studio/se2SynthGenoPluginBarRegen';
import {
  genoChordLoopStackCanUndo,
  genoLaneRegenStackCanUndo,
  genoPopChordLoopUndoStack,
  genoPopLaneRegenStack,
  genoPushChordLoopUndoStack,
  genoPushLaneRegenStack,
  type GenoChordLoopUndoStack,
  type GenoLaneRegenNoteStack,
} from '@/app/lib/studio/se2SynthGenoLaneRegenUndo';
import { type Se2ComposeResolvedKey } from '@/app/lib/studio/se2SynthGenoKeyLock';
import {
  se2SynthGenoSoundBankEntries,
  se2SynthGenoMelodyLaneSoundEntries,
  se2SynthGenoFillerLaneSoundEntries,
  se2SynthGenoSanitizePluginMelodyBankId,
  se2SynthGenoSanitizePluginFillerBankId,
  se2SynthGenoSanitizeSoundBankId,
  type Se2SynthGenoSoundBankCategory,
} from '@/app/lib/studio/se2SynthGenoSoundBank';
import type { Se2SynthGenoVoiceParams } from '@/app/lib/studio/se2SynthGenoTypes';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import { Se2SynthGenoSyncBpmChip } from '@/app/components/studio/Se2SynthGenoSyncBpmChip';
import { Se2SynthGenoPluginLoopView } from '@/app/components/studio/Se2SynthGenoPluginLoopView';
import { Se2SynthGenoPluginDualKeyboard } from '@/app/components/studio/Se2SynthGenoPluginDualKeyboard';
import { Se2SynthGenoEraProgressionLibrary } from '@/app/components/studio/Se2SynthGenoEraProgressionLibrary';
import {
  se2SynthGenoApplyEraProgressionPreset,
  se2SynthGenoAppendNextChord,
  se2SynthGenoEraPresetById,
  se2SynthGenoSpecsToDegrees,
  se2SynthGenoPluginMapPatternToBarCount,
  type Se2SynthGenoEraPreset,
  type Se2SynthGenoNextChordOption,
} from '@/app/lib/studio/se2SynthGenoEraProgressionLibrary';
import { Se2SynthGenoChordPianoStrip } from '@/app/components/studio/Se2SynthGenoChordPianoPicker';
import { Se2SynthGenoLaneSoundStrip } from '@/app/components/studio/Se2SynthGenoLaneSoundStrip';
import { Se2SynthGenoLaneSoundStripGroup } from '@/app/components/studio/Se2SynthGenoLaneSoundStripGroup';
import {
  se2SynthGenoSanitizeChordPianoBankId,
} from '@/app/lib/studio/se2SynthGenoChordPianoLibrary';
import { se2SynthGenoApplyLivePreset } from '@/app/lib/studio/se2SynthGenoLiveChordLibrary';
import type { Se2SynthGenoLivePreset } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import {
  se2SynthGenoPluginRebuildSpecForDegree,
  se2SynthGenoVoicePluginChordFromSpec,
} from '@/app/lib/studio/se2SynthGenoPluginChordVoicing';
import {
  se2SynthGenoPluginApplyAllVoicingDepth,
  se2SynthGenoPluginBuildProgressionKeyboard,
  se2SynthGenoPluginChordCount,
  se2SynthGenoPluginPlayOrder,
  se2SynthGenoPluginResetPlayOrder,
  se2SynthGenoPluginSlotEnabled,
  se2SynthGenoPluginSwapPlayOrder,
  se2SynthGenoPluginReplaceSlotChord,
  se2SynthGenoPluginSyncLoopToBars,
  se2SynthGenoPluginToggleSlot,
  se2SynthGenoPluginRomansForLoop,
  se2SynthGenoPluginBaseLoop,
} from '@/app/lib/studio/se2SynthGenoPluginProgressionTriggers';
import { se2SynthGenoPluginSlotSubstituteOptions } from '@/app/lib/studio/se2SynthGenoSlotSubstitutes';
import { Se2SynthGenoLiveChordPanel } from '@/app/components/studio/Se2SynthGenoLiveChordColumn';
import { Se2SynthGenoGrooveLeadDock } from '@/app/components/studio/Se2SynthGenoGrooveLeadDock';
import { se2SynthGenoPluginSlotSpecForVoice } from '@/app/lib/studio/se2SynthGenoPluginLoopSpec';
import { SE2_SYNTH_GENO_PLUGIN_VOICING_REVISION } from '@/app/lib/studio/se2SynthGenoLiveChordRoman';
import { se2SynthGenoEraCategoryBpm } from '@/app/lib/studio/se2SynthGenoEraCategoryTempo';
import { se2SynthGenoLiveSlotForPreviewBeat } from '@/app/lib/studio/se2SynthGenoLiveChordMap';
import {
  se2SynthGenoDefaultVoicingDepthForStyle,
  type GenoVoicingDepth,
} from '@/app/lib/studio/se2SynthGenoVoicingDepth';
import { se2SynthGenoBuildPluginApplyStack } from '@/app/lib/studio/se2SynthGenoPluginApplyStack';
import {
  SE2_SYNTH_GENO_BUILD_2_LABEL,
  se2SynthGenoFusionMapToChordState,
  type Se2SynthGenoFusionParams,
} from '@/app/lib/studio/se2SynthGenoFusionEngine';
import {
  Se2SynthGenoBuildFullscreenFrame,
  Se2SynthGenoBuildFullscreenPlaceholder,
} from '@/app/components/studio/Se2SynthGenoBuildFullscreenFrame';
import { Se2SynthGenoHarmonyIntelStrip } from '@/app/components/studio/Se2SynthGenoHarmonyIntelStrip';
import {
  se2SynthGenoEffectiveScaleMode,
  se2SynthGenoPassingOptionsForBar,
  se2SynthGenoPassingTransitionForBar,
  se2SynthGenoPluginInsertPassingAfterBar,
  type GenoAnchorProgressionOption,
  type GenoPassingChordOption,
} from '@/app/lib/studio/se2SynthGenoHarmonyIntel';
import { genoBuildPluginLoopBarViews } from '@/app/lib/studio/se2SynthGenoPluginDisplay';
import type { GenoLoopBarCount } from '@/app/lib/studio/se2SynthGenoLoopBarCount';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { GenoProgressionId } from '@/app/lib/studio/se2SynthGenoChordEngine';
import { se2SynthGenoRomanToBarSpec } from '@/app/lib/studio/se2SynthGenoEraProgressionLibrary';
import {
  se2SynthGenoBuildHarmonySteps,
  type Se2SynthGenoGrooveLeadLockInput,
} from '@/app/lib/studio/se2SynthGenoGrooveLeadLock';
import { se2GrooveLeadB01Voice } from '@/app/lib/studio/se2GrooveLeadTypes';
import {
  genoFillerQuantStep,
  type GenoFillerQuant,
} from '@/app/lib/studio/se2SynthGenoFillerEngine';
import { genoNormalizePluginFillerNotes } from '@/app/lib/studio/se2SynthGenoRanges';
import {
  genoDefaultLanePreviewGains,
  genoLanePreviewGainsToPreviewOpts,
  setGenoPluginPreviewMixGains,
  type GenoLanePreviewGainId,
  type GenoLanePreviewGains,
} from '@/app/lib/studio/se2SynthGenoLanePreviewGains';

type Se2SynthGenoFullscreenBuild = 'b01' | 'b02';

export type Se2SynthGenoChordPluginPanelProps = {
  trackIndex: number;
  accentHex?: string;
  resolvedKey: Se2ComposeResolvedKey;
  beatsPerBar: number;
  bpm: number;
  disabled?: boolean;
  seed: number;
  voice: Se2SynthGenoVoiceParams;
  fusionParams?: Se2SynthGenoFusionParams;
  onSeedBump: () => void;
  onPreviewDraft: (
    draft: Se2SynthGenoPluginDraft,
    sounds: Se2SynthGenoPluginSoundSelection,
    previewOpts?: Se2SynthGenoPluginPreviewOpts,
  ) => void;
  onStopPreview: () => void;
  onApplyNotes: (
    notes: Se2SynthGenoComposeNote[],
    key: { keyRoot: number; keyMode: StudioDetectedKeyMode },
  ) => void;
  onApplyStack?: (
    stack: Se2SynthGenoStackPart[],
    bars: number,
    meta: Se2SynthGenoApplyStackMeta,
  ) => void;
  onApplyAudio?: (
    draft: Se2SynthGenoPluginDraft,
    sounds: Se2SynthGenoPluginSoundSelection,
    previewOpts?: Se2SynthGenoPluginPreviewOpts,
  ) => void | Promise<void>;
  onPlayLiveChord?: (
    tones: readonly number[],
    accordBankId: string,
    opts?: { chordGlide?: boolean; genreId?: string },
  ) => void;
  /** Notifies SE2 when Geno Build 1/2 full-screen editor opens or closes. */
  onBuildFullscreenChange?: (active: boolean) => void;
  onLockGrooveLead?: (input: Se2SynthGenoGrooveLeadLockInput) => number | null;
  getAudioContext?: () => AudioContext;
  getGrooveLeadPreviewDestination?: (ctx: AudioContext) => AudioNode;
};

const EXT_OPTIONS: GenoExtension[] = ['6', 'M7', 'm7', '9', '11', '13'];
const TYPE_OPTIONS: GenoChordType[] = ['maj', 'min', 'sus', 'dim', 'aug'];
const PERF_OPTIONS: { id: GenoPerfMode; label: string }[] = [
  { id: 'block', label: 'Block' },
  { id: 'strum', label: 'Strum' },
  { id: 'arp', label: 'Arp' },
  { id: 'slop', label: 'Slop' },
  { id: 'repeater', label: 'Repeater' },
];
const REPEATER_QUANT_OPTIONS: { id: GenoRepeaterQuant; label: string }[] = [
  { id: '1/4', label: '1/4' },
  { id: '1/8', label: '1/8' },
  { id: '1/16', label: '1/16' },
  { id: '1/32', label: '1/32' },
];
const STYLE_OPTIONS = GENO_STYLE_CHIP_ORDER.filter((s) => s !== 'default');
const MELODY_GENRE_OPTIONS: { id: GenoMelodyGenre; label: string }[] = [
  { id: 'pop', label: 'Pop hook' },
  { id: 'rnb', label: 'R&B soul' },
  { id: 'rnbFunk', label: 'R&B funk' },
  { id: 'trap', label: 'Trap sparse' },
  { id: 'dance', label: 'Dance hook' },
  { id: 'disco', label: 'Disco line' },
  { id: 'dark', label: 'Dark minor' },
  { id: 'minor', label: 'Minor' },
  { id: 'bright', label: 'Bright major' },
  { id: 'major', label: 'Major' },
  { id: 'gospel', label: 'Gospel' },
  { id: 'kpop', label: 'K-pop' },
];
const BASS_PATTERN: { id: GenoBassPattern; label: string }[] = [
  { id: 'root', label: 'Root' },
  { id: 'root-fifth', label: 'Root·5' },
  { id: 'walk', label: 'Walk' },
  { id: 'funk', label: 'Funk' },
  { id: 'kpop', label: 'K-pop' },
];
const VOICING_DEPTH_OPTIONS: GenoVoicingDepth[] = [4, 5, 6, 7];

function draftSummary(draft: Se2SynthGenoPluginDraft): string {
  const parts: string[] = [];
  if (draft.chordNotes.length) parts.push(`${draft.chordNotes.length} chords`);
  if (draft.melodyNotes.length) parts.push(`${draft.melodyNotes.length} melody`);
  if (draft.bassNotes.length) parts.push(`${draft.bassNotes.length} bass`);
  if (draft.fillerNotes?.length) parts.push(`${draft.fillerNotes.length} filler`);
  return `${draft.progressionId} · ${draft.bars} bars · ${parts.join(' · ') || 'empty'}`;
}

function Section({
  title,
  children,
  accentHex,
}: {
  title?: string;
  children: ReactNode;
  accentHex: string;
}) {
  return (
    <div
      className="rounded-lg border px-3 py-2.5 flex flex-col gap-2"
      style={{ borderColor: '#2a2a38', background: 'rgba(0,0,0,0.28)' }}
    >
      {title ? (
        <span
          className="text-[8px] font-bold uppercase tracking-widest"
          style={{ color: '#c8c8d4' }}
        >
          {title}
        </span>
      ) : null}
      {children}
    </div>
  );
}

function mergePluginState(
  base: Se2SynthGenoChordPluginState,
): Se2SynthGenoChordPluginState {
  const melodyGenre = base.melodyGenre === 'arp' ? 'pop' : base.melodyGenre;
  return se2SynthGenoPluginSyncLoopToBars({
    ...base,
    melodyGenre,
    repeaterQuant: base.repeaterQuant ?? '1/8',
    accordBankId: se2SynthGenoSanitizeChordPianoBankId(
      base.accordBankId ?? SE2_SYNTH_GENO_DEFAULT_SOUND_SELECTION.accordBankId,
    ),
    melodyBankId: se2SynthGenoSanitizePluginMelodyBankId(
      base.melodyBankId ?? SE2_SYNTH_GENO_DEFAULT_SOUND_SELECTION.melodyBankId,
    ),
    bassBankId: base.bassBankId ?? SE2_SYNTH_GENO_DEFAULT_SOUND_SELECTION.bassBankId,
    fillerBankId: se2SynthGenoSanitizePluginFillerBankId(
      base.fillerBankId ?? SE2_SYNTH_GENO_DEFAULT_SOUND_SELECTION.fillerBankId,
    ),
    bassGlide: base.bassGlide ?? false,
  });
}

export function Se2SynthGenoChordPluginPanel({
  trackIndex,
  accentHex = '#00E5CC',
  resolvedKey,
  beatsPerBar,
  bpm,
  disabled = false,
  seed,
  voice,
  fusionParams,
  onSeedBump,
  onPreviewDraft,
  onStopPreview,
  onApplyNotes,
  onApplyStack,
  onApplyAudio,
  onPlayLiveChord,
  onBuildFullscreenChange,
  onLockGrooveLead,
  getAudioContext,
  getGrooveLeadPreviewDestination,
}: Se2SynthGenoChordPluginPanelProps) {
  const cached = readSe2SynthGenoPluginSession(trackIndex);
  const [grooveLeadDockOpen, setGrooveLeadDockOpen] = useState(false);
  const [grooveLeadNotes, setGrooveLeadNotes] = useState<StudioEditor2GenNote[]>([]);
  const [enableFiller, setEnableFiller] = useState(false);
  const [fillerQuant, setFillerQuant] = useState<GenoFillerQuant>('8th');
  const [fillerEditTool, setFillerEditTool] = useState<'draw' | 'erase'>('draw');
  const [laneGains, setLaneGains] = useState<GenoLanePreviewGains>(() => genoDefaultLanePreviewGains());
  const [state, setState] = useState<Se2SynthGenoChordPluginState>(() => {
    if (cached?.state) return mergePluginState(cached.state);
    return {
      ...SE2_SYNTH_GENO_CHORD_DEFAULTS,
      barDegrees: se2SynthGenoBarDegreesFromProgression(
        SE2_SYNTH_GENO_CHORD_DEFAULTS.progressionId,
        SE2_SYNTH_GENO_CHORD_DEFAULTS.barCount,
      ),
    };
  });
  const [draft, setDraft] = useState<Se2SynthGenoPluginDraft | null>(() => cached?.draft ?? null);
  const [previewing, setPreviewing] = useState(false);
  const [previewBeat, setPreviewBeat] = useState<number | null>(null);
  const [partSeeds, setPartSeeds] = useState<Se2SynthGenoPluginPartSeeds>(() => {
    const defaults = se2SynthGenoDefaultPartSeeds(seed);
    if (!cached?.partSeeds) return defaults;
    return { ...defaults, ...cached.partSeeds, filler: cached.partSeeds.filler ?? defaults.filler };
  });
  const [selectedBar, setSelectedBar] = useState<number | null>(() => cached?.selectedBar ?? null);
  const [tailFocusBar, setTailFocusBar] = useState<number | null>(null);
  const [activeEraPresetId, setActiveEraPresetId] = useState<string | null>(null);
  const [pluginPreviewBpm, setPluginPreviewBpm] = useState(() => bpm);
  const [syncBpmOnApply, setSyncBpmOnApply] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [pressedSlot, setPressedSlot] = useState<number | null>(null);
  const [slotReplaceUndo, setSlotReplaceUndo] = useState<
    Record<number, { spec: GenoBarChordSpec; roman: ChordSymbol }>
  >({});
  const [selectedVoicingDepth, setSelectedVoicingDepth] = useState<GenoVoicingDepth>(() =>
    se2SynthGenoDefaultVoicingDepthForStyle(state.stylePreset),
  );
  const melodyGridMigratedRef = useRef(false);
  const registerLiftMigratedRef = useRef(false);
  const [barLaneRegenSeeds, setBarLaneRegenSeeds] = useState<
    Record<Se2SynthGenoPluginBarLanePart, number[]>
  >({
    melody: Array(state.barCount).fill(0),
    bass: Array(state.barCount).fill(0),
  });
  const [barLaneUndo, setBarLaneUndo] = useState<Record<string, Se2SynthGenoPluginDraft['melodyNotes']>>({});
  const [laneRegenUndo, setLaneRegenUndo] = useState<{
    chords?: GenoLaneRegenNoteStack;
    melody?: GenoLaneRegenNoteStack;
    bass?: GenoLaneRegenNoteStack;
    filler?: GenoLaneRegenNoteStack;
  }>({});
  const [chordLoopUndo, setChordLoopUndo] = useState<GenoChordLoopUndoStack>([]);
  const chordUndoRestoreRef = useRef(false);
  const [fullscreenBuild, setFullscreenBuild] = useState<Se2SynthGenoFullscreenBuild | null>(null);
  const b02Expanded = fullscreenBuild === 'b02';
  const [harmonyScaleMode, setHarmonyScaleMode] = useState<ChordMode>(() =>
    resolvedKey.keyMode === 'minor' ? 'minor' : 'major',
  );

  useEffect(() => {
    onBuildFullscreenChange?.(fullscreenBuild !== null);
    return () => onBuildFullscreenChange?.(false);
  }, [fullscreenBuild, onBuildFullscreenChange]);

  useEffect(() => {
    if (!previewing) {
      setPreviewBeat(null);
      return;
    }
    let raf = 0;
    const tick = () => {
      setPreviewBeat(getSe2SynthGenoPluginPreviewLoopBeat());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [previewing]);

  const patch = useCallback((partial: Partial<Se2SynthGenoChordPluginState>) => {
    setState((s) => ({ ...s, ...partial }));
  }, []);

  const soundSelection = useCallback(
    (): Se2SynthGenoPluginSoundSelection => ({
      accordBankId: se2SynthGenoSanitizeChordPianoBankId(state.accordBankId),
      melodyBankId: se2SynthGenoSanitizePluginMelodyBankId(state.melodyBankId),
      bassBankId: state.bassBankId,
      fillerBankId: se2SynthGenoSanitizePluginFillerBankId(state.fillerBankId),
    }),
    [state.melodyBankId, state.bassBankId, state.accordBankId, state.fillerBankId],
  );

  const effectiveBarChordSpecs = useCallback(
    () =>
      state.barChordSpecs ??
      se2SynthGenoPluginMapPatternToBarCount(
        (state.barDegrees ??
          se2SynthGenoBarDegreesFromProgression(state.progressionId, state.barCount)).map(
          (d) => ({ degree: d, smartMatch: true }),
        ),
        state.barCount,
        {
          romans: state.progressionRomans,
          eraCategoryId: state.eraCategoryId,
          presetId: state.eraPresetId,
        },
      ),
    [state.barChordSpecs, state.barCount, state.barDegrees, state.progressionId, state.progressionRomans, state.eraCategoryId, state.eraPresetId],
  );

  const pluginPreviewOpts = useCallback(
    (): Se2SynthGenoPluginPreviewOpts => ({
      bassGlide: state.bassGlide,
      bpm: pluginPreviewBpm,
      beatsPerBar,
      barChordSpecs: effectiveBarChordSpecs(),
      timelineBarCount: state.barCount,
      grooveLeadNotes: grooveLeadNotes.length > 0 ? grooveLeadNotes : undefined,
      grooveLeadTrackIndex: trackIndex,
      grooveLeadVoice: se2GrooveLeadB01Voice(),
      fillerQuant,
      ...genoLanePreviewGainsToPreviewOpts(laneGains),
    }),
    [state.bassGlide, state.barCount, pluginPreviewBpm, beatsPerBar, effectiveBarChordSpecs, grooveLeadNotes, trackIndex, fillerQuant, laneGains],
  );

  const bassSoundEntries = useMemo(() => se2SynthGenoSoundBankEntries('bass'), []);

  const draftForPlayback = useCallback(
    (d: Se2SynthGenoPluginDraft): Se2SynthGenoPluginDraft => ({
      ...d,
      bars: state.barCount,
      melodyNotes: state.enableMelody ? d.melodyNotes : [],
      fillerNotes: enableFiller ? (d.fillerNotes ?? []) : [],
      grooveLeadNotes,
    }),
    [state.enableMelody, state.barCount, enableFiller, grooveLeadNotes],
  );

  const pickBank = useCallback(
    (category: Se2SynthGenoSoundBankCategory | 'filler', id: string) => {
      const wasPreviewing = previewing;
      const d = draft;
      onStopPreview();
      const nextSounds: Se2SynthGenoPluginSoundSelection = {
        accordBankId:
          category === 'accord'
            ? se2SynthGenoSanitizeChordPianoBankId(id)
            : se2SynthGenoSanitizeChordPianoBankId(state.accordBankId),
        melodyBankId:
          category === 'melody'
            ? se2SynthGenoSanitizePluginMelodyBankId(id)
            : se2SynthGenoSanitizePluginMelodyBankId(state.melodyBankId),
        bassBankId: category === 'bass' ? id : state.bassBankId,
        fillerBankId:
          category === 'filler'
            ? se2SynthGenoSanitizePluginFillerBankId(id)
            : se2SynthGenoSanitizePluginFillerBankId(state.fillerBankId),
      };
      if (category === 'accord') patch({ accordBankId: id });
      else if (category === 'melody') patch({ melodyBankId: id });
      else if (category === 'filler') patch({ fillerBankId: id });
      else patch({ bassBankId: id });
      if (wasPreviewing && d) {
        void Promise.resolve(
          onPreviewDraft(draftForPlayback(d), nextSounds, pluginPreviewOpts()),
        )
          .then(() => setPreviewing(true))
          .catch(() => setPreviewing(false));
      } else {
        setPreviewing(false);
      }
    },
    [onStopPreview, patch, previewing, draft, draftForPlayback, state.accordBankId, state.melodyBankId, state.bassBankId, state.fillerBankId, onPreviewDraft, pluginPreviewOpts],
  );

  const patchLaneGain = useCallback((lane: GenoLanePreviewGainId, gain: number) => {
    setLaneGains((prev) => {
      const next = { ...prev, [lane]: gain };
      setGenoPluginPreviewMixGains(next);
      return next;
    });
  }, []);

  const laneVolumes = useMemo(
    () => ({
      chords: {
        value: laneGains.chords,
        onChange: (gain: number) => patchLaneGain('chords', gain),
      },
      melody: {
        value: laneGains.melody,
        onChange: (gain: number) => patchLaneGain('melody', gain),
      },
      bass: {
        value: laneGains.bass,
        onChange: (gain: number) => patchLaneGain('bass', gain),
      },
      filler: {
        value: laneGains.filler,
        onChange: (gain: number) => patchLaneGain('filler', gain),
      },
    }),
    [laneGains.chords, laneGains.melody, laneGains.bass, laneGains.filler, patchLaneGain],
  );

  const handleGrooveLeadGainChange = useCallback((gain: number) => {
    patchLaneGain('grooveLead', gain);
  }, [patchLaneGain]);

  const regenOpts = useCallback(
    () => ({
      keyRoot: resolvedKey.keyRoot,
      keyMode: resolvedKey.keyMode,
      beatsPerBar,
      bpm,
    }),
    [resolvedKey, beatsPerBar, bpm],
  );

  const regenContext = useMemo((): Se2SynthGenoPluginRegenContext | null => {
    if (!draft?.harmony) return null;
    return {
      keyRoot: resolvedKey.keyRoot,
      keyMode: resolvedKey.keyMode,
      beatsPerBar,
      barCount: state.barCount,
      melodyBaseSeed: partSeeds.melody,
      bassBaseSeed: partSeeds.bass,
      melodyGenre: state.melodyGenre,
      bassPattern: state.bassPattern,
      enableMelody: state.enableMelody,
      enableBass: state.enableBass,
      barChordSpecs: effectiveBarChordSpecs(),
    };
  }, [
    draft?.harmony,
    state.barCount,
    resolvedKey.keyRoot,
    resolvedKey.keyMode,
    beatsPerBar,
    partSeeds.melody,
    partSeeds.bass,
    state.melodyGenre,
    state.bassPattern,
    state.enableMelody,
    state.enableBass,
    effectiveBarChordSpecs,
  ]);

  useEffect(() => {
    setBarLaneRegenSeeds({ melody: Array(state.barCount).fill(0), bass: Array(state.barCount).fill(0) });
    setBarLaneUndo({});
    setLaneRegenUndo({});
    setChordLoopUndo([]);
  }, [draft?.progressionId, state.barCount]);

  const applyDraft = useCallback(
    (
      next: Se2SynthGenoPluginDraft,
      nextSeeds?: Se2SynthGenoPluginPartSeeds,
    ) => {
      setDraft(next);
      if (nextSeeds) setPartSeeds(nextSeeds);
      return next;
    },
    [],
  );

  const captureChordLoopUndo = useCallback(() => {
    if (!draft || chordUndoRestoreRef.current) return;
    const specs = state.barChordSpecs ?? effectiveBarChordSpecs();
    setChordLoopUndo((prev) =>
      genoPushChordLoopUndoStack(prev, {
        chordNotes: draft.chordNotes,
        barChordSpecs: specs.map((s) => ({ ...s })),
      }),
    );
  }, [draft, effectiveBarChordSpecs, state.barChordSpecs]);

  const undoChordLoopEdit = useCallback(() => {
    if (!draft) return;
    const { snapshot, stack } = genoPopChordLoopUndoStack(chordLoopUndo);
    if (!snapshot) return;
    onStopPreview();
    setPreviewing(false);
    setChordLoopUndo(stack ?? []);
    chordUndoRestoreRef.current = true;
    applyDraft({ ...draft, chordNotes: snapshot.chordNotes });
    if (snapshot.barChordSpecs) {
      setState((s) => ({ ...s, barChordSpecs: snapshot.barChordSpecs }));
    }
    chordUndoRestoreRef.current = false;
  }, [applyDraft, chordLoopUndo, draft, onStopPreview]);

  const onChordNotesChange = useCallback(
    (notes: StudioEditor2GenNote[]) => {
      if (!draft) return;
      applyDraft({ ...draft, chordNotes: notes });
    },
    [applyDraft, draft],
  );

  const onBassNotesChange = useCallback(
    (notes: StudioEditor2GenNote[]) => {
      if (!draft) return;
      applyDraft({ ...draft, bassNotes: notes });
    },
    [applyDraft, draft],
  );

  const onMelodyNotesChange = useCallback(
    (notes: StudioEditor2GenNote[]) => {
      if (!draft) return;
      applyDraft({ ...draft, melodyNotes: notes });
    },
    [applyDraft, draft],
  );

  const fillerSnapBeats = useMemo(
    () => genoFillerQuantStep(fillerQuant, beatsPerBar),
    [fillerQuant, beatsPerBar],
  );

  const fillerControls = useMemo(
    () => ({
      quant: fillerQuant,
      editTool: fillerEditTool,
      snapBeats: fillerSnapBeats,
      onQuantChange: (q: GenoFillerQuant) => {
        setFillerQuant(q);
        if (previewing) {
          onStopPreview();
          setPreviewing(false);
        }
      },
      onEditToolChange: setFillerEditTool,
    }),
    [fillerQuant, fillerEditTool, fillerSnapBeats, previewing, onStopPreview],
  );

  const onFillerNotesChange = useCallback(
    (notes: StudioEditor2GenNote[]) => {
      if (!draft) return;
      const normalized = genoNormalizePluginFillerNotes(
        notes,
        beatsPerBar,
        state.barCount,
        fillerSnapBeats,
      );
      applyDraft({ ...draft, fillerNotes: normalized });
    },
    [applyDraft, draft, beatsPerBar, state.barCount, fillerSnapBeats],
  );

  const regeneratePart = useCallback(
    (
      part: Se2SynthGenoPluginPartId | 'all',
      nextState?: Se2SynthGenoChordPluginState,
      bumpSeed = true,
      freshDraft = false,
    ) => {
      onStopPreview();
      setPreviewing(false);
      const st = nextState ?? state;
      if (draft && bumpSeed) {
        if (part === 'all' || part === 'chords') {
          captureChordLoopUndo();
        }
        setLaneRegenUndo((prev) => ({
          ...prev,
          melody:
            part === 'all' || part === 'melody'
              ? genoPushLaneRegenStack(prev.melody, draft.melodyNotes)
              : prev.melody,
          bass:
            part === 'all' || part === 'bass'
              ? genoPushLaneRegenStack(prev.bass, draft.bassNotes)
              : prev.bass,
          filler:
            part === 'all' || part === 'filler'
              ? genoPushLaneRegenStack(prev.filler, draft.fillerNotes ?? [])
              : prev.filler,
        }));
      }
      const seeds = { ...partSeeds };
      if (bumpSeed) {
        if (part === 'all' || part === 'chords') seeds.chords += 1;
        if (part === 'all' || part === 'melody') seeds.melody += 1;
        if (part === 'all' || part === 'bass') seeds.bass += 1;
        if (part === 'all' || part === 'filler') seeds.filler += 1;
      }
      if (part === 'all') onSeedBump();
      const regenFiller = part === 'filler' ? true : part === 'all' ? enableFiller : undefined;
      const next = se2SynthGenoRegeneratePluginPart({
        draft,
        state: st,
        part,
        seeds,
        ...regenOpts(),
        stableVoicing: true,
        freshDraft,
        enableFiller: regenFiller,
        fillerQuant,
      });
      return applyDraft(next, seeds);
    },
    [state, draft, partSeeds, regenOpts, onStopPreview, onSeedBump, applyDraft, captureChordLoopUndo, enableFiller, fillerQuant],
  );

  const undoLaneRegen = useCallback(
    (part: 'chords' | 'melody' | 'bass' | 'filler') => {
      if (!draft) return;
      const stack =
        part === 'chords'
          ? laneRegenUndo.chords
          : part === 'melody'
            ? laneRegenUndo.melody
            : part === 'bass'
              ? laneRegenUndo.bass
              : laneRegenUndo.filler;
      const { notes: saved, stack: rest } = genoPopLaneRegenStack(stack);
      if (!saved) return;
      onStopPreview();
      setPreviewing(false);
      applyDraft({
        ...draft,
        chordNotes: part === 'chords' ? saved : draft.chordNotes,
        melodyNotes: part === 'melody' ? saved : draft.melodyNotes,
        bassNotes: part === 'bass' ? saved : draft.bassNotes,
        fillerNotes: part === 'filler' ? saved : (draft.fillerNotes ?? []),
      });
      setLaneRegenUndo((prev) => ({
        ...prev,
        chords: part === 'chords' ? rest : prev.chords,
        melody: part === 'melody' ? rest : prev.melody,
        bass: part === 'bass' ? rest : prev.bass,
        filler: part === 'filler' ? rest : prev.filler,
      }));
    },
    [applyDraft, draft, laneRegenUndo, onStopPreview],
  );

  const regenPluginBarLane = useCallback(
    (bar: number, part: Se2SynthGenoPluginBarLanePart) => {
      if (!draft || !regenContext) return;
      onStopPreview();
      setPreviewing(false);
      const undoKey = se2SynthGenoPluginBarLaneUndoKey(part, bar);
      const notesField = part === 'melody' ? draft.melodyNotes : draft.bassNotes;
      setBarLaneUndo((prev) => ({
        ...prev,
        [undoKey]: genoNotesInBar(notesField, bar, beatsPerBar),
      }));
      const nextBarSeed = (barLaneRegenSeeds[part][bar] ?? 0) + 1;
      const patch = se2SynthGenoPluginRegenerateBarLane(draft, bar, part, nextBarSeed, regenContext);
      setBarLaneRegenSeeds((prev) => {
        const next = { ...prev, [part]: [...prev[part]] };
        next[part][bar] = nextBarSeed;
        return next;
      });
      applyDraft({ ...draft, ...patch });
    },
    [applyDraft, barLaneRegenSeeds, beatsPerBar, draft, onStopPreview, regenContext],
  );

  const undoPluginBarLane = useCallback(
    (bar: number, part: Se2SynthGenoPluginBarLanePart) => {
      if (!draft) return;
      const undoKey = se2SynthGenoPluginBarLaneUndoKey(part, bar);
      const saved = barLaneUndo[undoKey];
      if (!saved) return;
      onStopPreview();
      setPreviewing(false);
      const patch = se2SynthGenoPluginUndoBarLane(draft, bar, part, saved, beatsPerBar);
      applyDraft({ ...draft, ...patch });
      setBarLaneUndo((prev) => {
        const next = { ...prev };
        delete next[undoKey];
        return next;
      });
    },
    [applyDraft, barLaneUndo, beatsPerBar, draft, onStopPreview],
  );

  const canUndoPluginBarLane = useCallback(
    (bar: number, part: Se2SynthGenoPluginBarLanePart) =>
      Boolean(barLaneUndo[se2SynthGenoPluginBarLaneUndoKey(part, bar)]?.length),
    [barLaneUndo],
  );

  const commitLoopState = useCallback(
    (nextState: Se2SynthGenoChordPluginState, opts?: { freshDraft?: boolean; bumpSeed?: boolean }) => {
      onStopPreview();
      setPreviewing(false);
      setState(nextState);
      setBarLaneRegenSeeds({
        melody: Array(nextState.barCount).fill(0),
        bass: Array(nextState.barCount).fill(0),
      });
      setBarLaneUndo({});
      setLaneRegenUndo({});
      regeneratePart('all', nextState, opts?.bumpSeed ?? true, opts?.freshDraft ?? true);
    },
    [onStopPreview, regeneratePart],
  );

  const chordCount = useMemo(() => se2SynthGenoPluginChordCount(state), [state]);
  const playOrder = useMemo(
    () => se2SynthGenoPluginPlayOrder(state, chordCount),
    [state, chordCount],
  );
  const slotEnabled = useMemo(
    () => se2SynthGenoPluginSlotEnabled(state, chordCount),
    [state, chordCount],
  );
  const keyboardKeys = useMemo(
    () =>
      se2SynthGenoPluginBuildProgressionKeyboard({
        state,
        keyRoot: resolvedKey.keyRoot,
        keyMode: resolvedKey.keyMode,
      }),
    [state, resolvedKey.keyRoot, resolvedKey.keyMode],
  );

  const voicingForSlot = useCallback(
    (slotIndex: number | null): number[] => {
      if (slotIndex == null) return [];
      const loopSpec = se2SynthGenoPluginBaseLoop(state)[slotIndex];
      const depth = loopSpec?.voicingDepth ?? selectedVoicingDepth;
      const spec = se2SynthGenoPluginSlotSpecForVoice(state, slotIndex, resolvedKey.keyMode, {
        voicingDepth: depth,
        chopQuant: loopSpec?.chopQuant,
        inversion: loopSpec?.inversion,
      });
      if (!spec) return [];
      return [
        ...se2SynthGenoVoicePluginChordFromSpec(
          resolvedKey.keyRoot,
          resolvedKey.keyMode,
          state,
          spec,
        ),
      ];
    },
    [
      resolvedKey.keyMode,
      resolvedKey.keyRoot,
      selectedVoicingDepth,
      state,
      SE2_SYNTH_GENO_PLUGIN_VOICING_REVISION,
    ],
  );

  const playbackSlot = useMemo(() => {
    if (!previewing || previewBeat == null) return null;
    return se2SynthGenoLiveSlotForPreviewBeat(
      previewBeat,
      beatsPerBar,
      state.barCount,
      playOrder,
      chordCount,
    );
  }, [previewing, previewBeat, beatsPerBar, state.barCount, playOrder, chordCount]);

  const previewSlot = useMemo(() => {
    if (pressedSlot != null) return pressedSlot;
    if (previewing) return playbackSlot;
    return activeSlot ?? playbackSlot ?? (se2SynthGenoPluginBaseLoop(state).length > 0 ? 0 : null);
  }, [pressedSlot, previewing, playbackSlot, activeSlot, state]);

  const displayVoicingMidis = useMemo(
    () => (previewSlot != null ? voicingForSlot(previewSlot) : []),
    [previewSlot, voicingForSlot],
  );

  useEffect(() => {
    const loop = se2SynthGenoPluginBaseLoop(state);
    const depths = loop.map((s) => s.voicingDepth).filter((d): d is GenoVoicingDepth => d != null);
    if (depths.length > 0 && depths.every((d) => d === depths[0])) {
      setSelectedVoicingDepth(depths[0]!);
    }
  }, [state.progressionId, state.progressionLoop, state.barChordSpecs, state.stylePreset, state.eraCategoryId, SE2_SYNTH_GENO_PLUGIN_VOICING_REVISION]);

  const loopRepairRef = useRef(false);
  useEffect(() => {
    if (loopRepairRef.current) return;
    loopRepairRef.current = true;

    const preset = state.eraPresetId ? se2SynthGenoEraPresetById(state.eraPresetId) : undefined;
    const seedLen = preset?.romans.length ?? 0;
    const harmony = draft?.harmony?.columns;
    const looksTiled =
      seedLen > 0
      && seedLen < state.barCount
      && harmony
      && harmony.length >= state.barCount
      && harmony[0]?.degree === harmony[seedLen]?.degree;

    let nextState = state;
    if (preset && seedLen < state.barCount && looksTiled) {
      nextState = se2SynthGenoPluginResetPlayOrder(
        se2SynthGenoPluginSyncLoopToBars(
          se2SynthGenoApplyEraProgressionPreset(state, preset),
          resolvedKey.keyMode,
        ),
      );
      setActiveEraPresetId(preset.id);
    } else if (
      state.barChordSpecs
      && state.barChordSpecs.length < state.barCount
    ) {
      nextState = se2SynthGenoPluginSyncLoopToBars(state, resolvedKey.keyMode);
    }

    const needsRegen =
      looksTiled
      || !draft?.harmony?.columns.length
      || draft.harmony.columns.length < state.barCount
      || draft.bars !== state.barCount
      || nextState !== state;

    if (needsRegen) {
      if (nextState !== state) setState(nextState);
      regeneratePart('all', nextState, false, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- repair cached Geno B2 sessions once on mount
  }, []);

  const releaseSlot = useCallback(() => {
    setPressedSlot(null);
  }, []);

  const playSlot = useCallback(
    (slotIndex: number) => {
      if (disabled || !slotEnabled[slotIndex]) return;
      onStopPreview();
      setPreviewing(false);
      const tones = voicingForSlot(slotIndex);
      if (tones.length === 0) return;
      setActiveSlot(slotIndex);
      setPressedSlot(slotIndex);
      onPlayLiveChord?.(tones, se2SynthGenoSanitizeChordPianoBankId(state.accordBankId));
    },
    [disabled, onPlayLiveChord, onStopPreview, slotEnabled, state.accordBankId, voicingForSlot],
  );

  const toggleSlot = useCallback(
    (slotIndex: number) => {
      commitLoopState(se2SynthGenoPluginToggleSlot(state, slotIndex));
    },
    [commitLoopState, state],
  );

  const setPlayOrderPosition = useCallback(
    (slotIndex: number, position: number) => {
      commitLoopState(se2SynthGenoPluginSwapPlayOrder(state, slotIndex, position));
    },
    [commitLoopState, state],
  );

  const replaceSlotChord = useCallback(
    (fromSlotIndex: number, toSlotIndex: number) => {
      if (fromSlotIndex === toSlotIndex) return;
      const loop = se2SynthGenoPluginBaseLoop(state);
      const romans = se2SynthGenoPluginRomansForLoop(state, loop, resolvedKey.keyMode);
      const priorSpec = loop[toSlotIndex];
      const priorRoman = romans[toSlotIndex];
      if (priorSpec && priorRoman) {
        setSlotReplaceUndo((prev) => ({
          ...prev,
          [toSlotIndex]: { spec: { ...priorSpec }, roman: priorRoman },
        }));
      }
      commitLoopState(
        se2SynthGenoPluginReplaceSlotChord(state, fromSlotIndex, toSlotIndex, resolvedKey.keyMode),
      );
    },
    [commitLoopState, resolvedKey.keyMode, state],
  );

  const undoReplaceSlot = useCallback(
    (slotIndex: number) => {
      const saved = slotReplaceUndo[slotIndex];
      if (!saved) return;
      const loop = [...se2SynthGenoPluginBaseLoop(state)];
      const romans = [...se2SynthGenoPluginRomansForLoop(state, loop, resolvedKey.keyMode)];
      if (!loop[slotIndex]) return;
      loop[slotIndex] = { ...saved.spec };
      romans[slotIndex] = saved.roman;
      setSlotReplaceUndo((prev) => {
        const next = { ...prev };
        delete next[slotIndex];
        return next;
      });
      commitLoopState(
        se2SynthGenoPluginSyncLoopToBars({
          ...state,
          progressionLoop: loop,
          progressionRomans: romans,
        }),
      );
    },
    [commitLoopState, resolvedKey.keyMode, slotReplaceUndo, state],
  );

  const canUndoReplace = useMemo(() => {
    const count = se2SynthGenoPluginChordCount(state);
    return Array.from({ length: count }, (_, i) => Boolean(slotReplaceUndo[i]));
  }, [state, slotReplaceUndo]);

  const slotSubstitutes = useMemo(() => {
    const loop = se2SynthGenoPluginBaseLoop(state);
    const count = loop.length;
    if (count === 0) return [];
    const romans = se2SynthGenoPluginRomansForLoop(state, loop, resolvedKey.keyMode);
    return Array.from({ length: count }, (_, i) =>
      se2SynthGenoPluginSlotSubstituteOptions({
        slotIndex: i,
        currentRoman: romans[i] ?? 'I',
        priorSpec: loop[i],
        keyMode: resolvedKey.keyMode,
        eraCategoryId: state.eraCategoryId,
        stylePreset: state.stylePreset ?? 'pop',
        keyRoot: resolvedKey.keyRoot,
      }),
    );
  }, [resolvedKey.keyMode, resolvedKey.keyRoot, state]);

  const applySlotSubstitute = useCallback(
    (slotIndex: number, optionId: string) => {
      const opt = slotSubstitutes[slotIndex]?.find((o) => o.id === optionId);
      if (!opt) return;
      const loop = [...se2SynthGenoPluginBaseLoop(state)];
      const romans = [...se2SynthGenoPluginRomansForLoop(state, loop, resolvedKey.keyMode)];
      const priorSpec = loop[slotIndex];
      const priorRoman = romans[slotIndex];
      if (priorSpec && priorRoman) {
        setSlotReplaceUndo((prev) => ({
          ...prev,
          [slotIndex]: { spec: { ...priorSpec }, roman: priorRoman },
        }));
      }
      loop[slotIndex] = { ...opt.spec };
      romans[slotIndex] = opt.roman;
      commitLoopState(
        se2SynthGenoPluginSyncLoopToBars({
          ...state,
          progressionLoop: loop,
          progressionRomans: romans,
        }),
      );
    },
    [commitLoopState, resolvedKey.keyMode, slotSubstitutes, state],
  );

  const applyAllVoicingDepth = useCallback(
    (depth: GenoVoicingDepth) => {
      setSelectedVoicingDepth(depth);
      commitLoopState(se2SynthGenoPluginApplyAllVoicingDepth(state, depth));
    },
    [commitLoopState, state],
  );

  const pickVoicingDepth = useCallback(
    (depth: GenoVoicingDepth) => {
      applyAllVoicingDepth(depth);
    },
    [applyAllVoicingDepth],
  );

  /** Voicing / perf changes only affect chords — rebuild lanes so repeater never sticks on melody. */
  const patchVoicing = useCallback(
    (partial: Partial<Se2SynthGenoChordPluginState>) => {
      onStopPreview();
      setPreviewing(false);
      const nextState = { ...state, ...partial };
      const leavingRepeater =
        state.perfMode === 'repeater' &&
        partial.perfMode !== undefined &&
        partial.perfMode !== 'repeater';
      setState(nextState);

      if (!draft) return;

      const seeds = { ...partSeeds };
      if (leavingRepeater) {
        if (nextState.enableMelody) seeds.melody += 1;
        if (nextState.enableBass) seeds.bass += 1;
        setPartSeeds(seeds);
        const next = se2SynthGenoRegeneratePluginPart({
          draft,
          state: nextState,
          part: 'all',
          seeds,
          ...regenOpts(),
        });
        applyDraft(next, seeds);
        return;
      }

      if (nextState.enableChords && (draft.chordNotes.length > 0 || draft.harmony)) {
        regeneratePart('chords', nextState, false);
      }
    },
    [state, draft, partSeeds, regenOpts, onStopPreview, regeneratePart, applyDraft],
  );

  const patchMelodyFlavor = useCallback(
    (melodyGenre: Se2SynthGenoChordPluginState['melodyGenre']) => {
      onStopPreview();
      setPreviewing(false);
      const nextState = { ...state, melodyGenre };
      setState(nextState);
      if (draft?.melodyNotes.length || draft?.harmony) {
        regeneratePart('melody', nextState, true);
      }
    },
    [state, draft, onStopPreview, regeneratePart],
  );

  const clearPart = useCallback(
    (part: Se2SynthGenoPluginPartId) => {
      onStopPreview();
      setPreviewing(false);
      if (!draft) return;
      applyDraft(se2SynthGenoClearPluginPart(draft, part));
    },
    [draft, onStopPreview, applyDraft],
  );

  const toggleMelodyLane = useCallback(() => {
    onStopPreview();
    setPreviewing(false);
    const next = !state.enableMelody;
    const nextState = { ...state, enableMelody: next };
    setState(nextState);
    if (!draft) return;
    if (!next) {
      applyDraft(se2SynthGenoClearPluginPart(draft, 'melody'));
      return;
    }
    regeneratePart('melody', nextState, true);
  }, [applyDraft, draft, onStopPreview, regeneratePart, state]);

  const toggleFillerLane = useCallback(() => {
    onStopPreview();
    setPreviewing(false);
    const next = !enableFiller;
    setEnableFiller(next);
    if (!draft) return;
    if (!next) {
      applyDraft(se2SynthGenoClearPluginPart(draft, 'filler'));
      return;
    }
    regeneratePart('filler', undefined, true);
  }, [applyDraft, draft, enableFiller, onStopPreview, regeneratePart]);

  const stateWithFusionMacros = useCallback(
    (base: Se2SynthGenoChordPluginState): Se2SynthGenoChordPluginState => {
      if (!fusionParams) return base;
      const { state: fusionPatch, voicingDepth } = se2SynthGenoFusionMapToChordState(fusionParams);
      setSelectedVoicingDepth(voicingDepth);
      return mergePluginState({ ...base, ...fusionPatch, barCount: 8 });
    },
    [fusionParams],
  );

  const bumpSeedAndBuild = useCallback(
    (nextState?: Se2SynthGenoChordPluginState) => {
      onSeedBump();
      const st = stateWithFusionMacros(nextState ?? state);
      setState(st);
      return regeneratePart('all', st, true);
    },
    [onSeedBump, regeneratePart, state, stateWithFusionMacros],
  );

  useEffect(() => {
    writeSe2SynthGenoPluginSession(trackIndex, { state, draft, partSeeds, selectedBar });
  }, [trackIndex, state, draft, partSeeds, selectedBar]);

  useEffect(() => {
    return () => onStopPreview();
  }, [onStopPreview]);

  /** Rebuild melody once if an old session still has arpeggio / repeater-spaced notes. */
  useEffect(() => {
    if (!b02Expanded) return;
    if (melodyGridMigratedRef.current) return;
    if (!draft || !state.enableMelody || draft.melodyNotes.length === 0) return;
    const needsRebuild =
      melodyHasRepeaterLikeSpacing(draft.melodyNotes)
      || melodyLooksLikeVoicingArpeggio(draft.melodyNotes, draft.harmony, beatsPerBar)
      || state.melodyGenre === 'arp';
    if (!needsRebuild) return;
    melodyGridMigratedRef.current = true;
    const nextState =
      state.melodyGenre === 'arp' ? { ...state, melodyGenre: 'pop' as const } : state;
    if (state.melodyGenre === 'arp') setState(nextState);
    regeneratePart('melody', nextState, true);
  }, [b02Expanded, draft, state, beatsPerBar, regeneratePart]);

  /** Re-voice cached drafts once — warm block chords + harmony-locked melody/bass. */
  useEffect(() => {
    if (!b02Expanded) return;
    if (registerLiftMigratedRef.current || !draft) return;
    registerLiftMigratedRef.current = true;
    if (draft.chordNotes.length === 0 && draft.melodyNotes.length === 0 && draft.bassNotes.length === 0) {
      return;
    }
    regeneratePart('all', state, false);
  }, [b02Expanded, draft, state, regeneratePart]);

  const applyStyle = useCallback(
    (style: GenoChordStyle) => {
      const nextState = se2SynthGenoApplyStylePreset(state, style, resolvedKey.keyMode);
      const withDegrees = {
        ...nextState,
        barDegrees: se2SynthGenoBarDegreesFromProgression(nextState.progressionId, nextState.barCount),
      };
      setState(withDegrees);
      regeneratePart('all', withDegrees, true);
    },
    [state, resolvedKey.keyMode, regeneratePart],
  );

  const onProgressionChange = useCallback(
    (progressionId: Se2SynthGenoChordPluginState['progressionId']) => {
      const barDegrees = se2SynthGenoBarDegreesFromProgression(progressionId, state.barCount);
      const nextState = se2SynthGenoPluginResetPlayOrder(
        se2SynthGenoPluginSyncLoopToBars({
          ...state,
          progressionId,
          progressionRomans: undefined,
          eraCategoryId: undefined,
          eraPresetId: undefined,
          barDegrees,
          barChordSpecs: undefined,
          progressionLoop: undefined,
          pluginPlayOrder: undefined,
          pluginSlotEnabled: undefined,
        }),
      );
      setActiveEraPresetId(null);
      commitLoopState(nextState, { freshDraft: true, bumpSeed: true });
    },
    [state, commitLoopState],
  );

  const onEraPresetSelect = useCallback(
    (preset: Se2SynthGenoEraPreset) => {
      setActiveEraPresetId(preset.id);
      setPluginPreviewBpm(se2SynthGenoEraCategoryBpm(preset.categoryId));
      setSlotReplaceUndo({});
      commitLoopState(
        se2SynthGenoPluginResetPlayOrder(
          se2SynthGenoPluginSyncLoopToBars(se2SynthGenoApplyEraProgressionPreset(state, preset)),
        ),
        { freshDraft: true, bumpSeed: true },
      );
    },
    [state, commitLoopState],
  );

  const onEraCategoryPreviewBpm = useCallback((categoryId: Se2SynthGenoEraPreset['categoryId']) => {
    setPluginPreviewBpm(se2SynthGenoEraCategoryBpm(categoryId));
  }, []);

  const onLivePresetLoad = useCallback(
    (preset: Se2SynthGenoLivePreset) => {
      const nextState = mergePluginState(se2SynthGenoApplyLivePreset(state, preset));
      setActiveEraPresetId(null);
      setSlotReplaceUndo({});
      setState(nextState);
      setBarLaneRegenSeeds({
        melody: Array(nextState.barCount).fill(0),
        bass: Array(nextState.barCount).fill(0),
      });
      setBarLaneUndo({});
      setLaneRegenUndo({});
      regeneratePart('all', nextState, true, true);
    },
    [state, regeneratePart],
  );

  const onAppendNextChord = useCallback(
    (option: Se2SynthGenoNextChordOption) => {
      const nextState = se2SynthGenoPluginSyncLoopToBars(se2SynthGenoAppendNextChord(state, option.spec));
      commitLoopState(nextState);
    },
    [state, commitLoopState],
  );

  const pluginRomans = useMemo(() => {
    const loop = se2SynthGenoPluginBaseLoop(state);
    return se2SynthGenoPluginRomansForLoop(state, loop, resolvedKey.keyMode);
  }, [state, resolvedKey.keyMode]);

  const effectiveScaleMode = useMemo(
    () => se2SynthGenoEffectiveScaleMode(resolvedKey.keyMode, harmonyScaleMode),
    [resolvedKey.keyMode, harmonyScaleMode],
  );

  const harmonyAnchorRoman = useMemo(() => {
    if (previewSlot == null) return null;
    return pluginRomans[previewSlot] ?? null;
  }, [previewSlot, pluginRomans]);

  const harmonyAnchorLabel = useMemo(() => {
    if (previewSlot == null || !harmonyAnchorRoman) return undefined;
    const key = keyboardKeys.find((k) => k.slotIndex === previewSlot);
    return key ? `${key.triggerLabel} · ${harmonyAnchorRoman}` : harmonyAnchorRoman;
  }, [previewSlot, harmonyAnchorRoman, keyboardKeys]);

  const loopBarRomans = useMemo(() => {
    if (!draft) return [] as string[];
    const views = genoBuildPluginLoopBarViews({
      harmony: draft.harmony,
      chordNotes: draft.chordNotes,
      melodyNotes: draft.melodyNotes,
      bassNotes: draft.bassNotes,
      barCount: state.barCount,
      beatsPerBar,
      keyRoot: resolvedKey.keyRoot,
      keyMode: resolvedKey.keyMode,
      barChordSpecs: state.barChordSpecs,
    });
    return views.map((v) => v.roman);
  }, [draft, state.barCount, state.barChordSpecs, beatsPerBar, resolvedKey.keyRoot, resolvedKey.keyMode]);

  const tailPassingOptions = useMemo(() => {
    if (tailFocusBar == null || loopBarRomans.length < 2) return [];
    return se2SynthGenoPassingOptionsForBar(tailFocusBar, loopBarRomans, effectiveScaleMode, {
      eraCategoryId: state.eraCategoryId,
      maxOptions: 14,
      includeClusters: true,
      loopWrap: true,
    });
  }, [tailFocusBar, loopBarRomans, effectiveScaleMode, state.eraCategoryId]);

  const tailInsertContext = useMemo(() => {
    if (tailFocusBar == null) {
      return { fromRoman: '', toRoman: '', canInsert: false, isLoopWrap: false };
    }
    const transition = se2SynthGenoPassingTransitionForBar(tailFocusBar, loopBarRomans, true);
    if (!transition) {
      return { fromRoman: '', toRoman: '', canInsert: false, isLoopWrap: false };
    }
    return {
      fromRoman: String(transition.fromRoman),
      toRoman: String(transition.toRoman),
      canInsert: transition.canInsert,
      isLoopWrap: transition.isLoopWrap,
    };
  }, [tailFocusBar, loopBarRomans]);

  const applyAnchorProgression = useCallback(
    (opt: GenoAnchorProgressionOption) => {
      if (opt.eraPresetId) {
        const preset = se2SynthGenoEraPresetById(opt.eraPresetId);
        if (preset) onEraPresetSelect(preset);
        return;
      }
      if (opt.source === 'geno') {
        const genoId = opt.id.replace(/^geno-/, '') as GenoProgressionId;
        if (GENO_PROGRESSIONS.some((p) => p.id === genoId)) {
          onProgressionChange(genoId);
        }
        return;
      }
      const categoryId = state.eraCategoryId ?? 'pop-eras';
      const len = Math.min(opt.romans.length, state.barCount);
      const specs = opt.romans.slice(0, len).map((roman) => se2SynthGenoRomanToBarSpec(roman, categoryId));
      commitLoopState(
        se2SynthGenoPluginSyncLoopToBars(
          {
            ...state,
            progressionLoop: specs,
            progressionRomans: opt.romans.slice(0, len),
            eraPresetId: undefined,
          },
          resolvedKey.keyMode,
        ),
      );
    },
    [commitLoopState, onEraPresetSelect, onProgressionChange, resolvedKey.keyMode, state],
  );

  const insertPassingAtBar = useCallback(
    (bar: number, opt: GenoPassingChordOption) => {
      captureChordLoopUndo();
      const nextState = se2SynthGenoPluginInsertPassingAfterBar(state, bar, opt);
      setState(nextState);
      setTailFocusBar(bar);
      onStopPreview();
      setPreviewing(false);
      regeneratePart('all', nextState, false);
    },
    [captureChordLoopUndo, onStopPreview, regeneratePart, state],
  );

  const onBarCountChange = useCallback(
    (barCount: GenoLoopBarCount) => {
      const nextState = se2SynthGenoPluginSyncLoopToBars({ ...state, barCount }, resolvedKey.keyMode);
      commitLoopState(nextState);
    },
    [state, commitLoopState],
  );

  const onBarDegreeChange = useCallback(
    (bar: number, degree: number) => {
      captureChordLoopUndo();
      setSelectedBar(bar);
      const baseSpecs =
        state.barChordSpecs ??
        se2SynthGenoPluginMapPatternToBarCount(
          (state.barDegrees ??
            se2SynthGenoBarDegreesFromProgression(state.progressionId, state.barCount)).map(
            (d) => ({ degree: d, smartMatch: true }),
          ),
          state.barCount,
          {
            romans: state.progressionRomans,
            eraCategoryId: state.eraCategoryId,
            presetId: state.eraPresetId,
          },
        );
      const barChordSpecs = [...baseSpecs];
      const prior = barChordSpecs[bar] ?? { degree: 0 };
      barChordSpecs[bar] = se2SynthGenoPluginRebuildSpecForDegree(
        degree,
        resolvedKey.keyMode,
        state.stylePreset ?? 'pop',
        {
          voicingDepth: prior.voicingDepth ?? selectedVoicingDepth,
          chopQuant: prior.chopQuant,
          inversion: prior.inversion,
        },
      );
      const nextState = { ...state, barChordSpecs };
      setState(nextState);
      onStopPreview();
      setPreviewing(false);
      regeneratePart('all', nextState, false);
    },
    [captureChordLoopUndo, onStopPreview, regeneratePart, resolvedKey.keyMode, selectedVoicingDepth, state],
  );

  const onBarChopQuantChange = useCallback(
    (bar: number, chopQuant: GenoBarChopQuant) => {
      captureChordLoopUndo();
      setSelectedBar(bar);
      const baseSpecs =
        state.barChordSpecs ??
        se2SynthGenoPluginMapPatternToBarCount(
          (state.barDegrees ??
            se2SynthGenoBarDegreesFromProgression(state.progressionId, state.barCount)).map(
            (d) => ({ degree: d, smartMatch: true }),
          ),
          state.barCount,
          {
            romans: state.progressionRomans,
            eraCategoryId: state.eraCategoryId,
            presetId: state.eraPresetId,
          },
        );
      const barChordSpecs = [...baseSpecs];
      barChordSpecs[bar] = {
        ...barChordSpecs[bar],
        degree: barChordSpecs[bar]?.degree ?? baseSpecs[bar]?.degree ?? 0,
        chopQuant,
      };
      const nextState = { ...state, barChordSpecs };
      setState(nextState);
      onStopPreview();
      setPreviewing(false);
      regeneratePart('chords', nextState, false);
    },
    [captureChordLoopUndo, state, onStopPreview, regeneratePart],
  );

  const togglePreview = useCallback(() => {
    if (previewing) {
      onStopPreview();
      setPreviewing(false);
      return;
    }
    const d = draftForPlayback(draft ?? bumpSeedAndBuild());
    if (d.chordNotes.length === 0 && d.melodyNotes.length === 0 && d.bassNotes.length === 0 && (d.fillerNotes?.length ?? 0) === 0) return;
    onStopPreview();
    setActiveSlot(null);
    setPressedSlot(null);
    setGenoPluginPreviewMixGains({ ...laneGains });
    void Promise.resolve(
      onPreviewDraft(d, soundSelection(), pluginPreviewOpts()),
    )
      .then(() => setPreviewing(true))
      .catch((err) => {
        console.warn('[Synth Geno] preview failed:', err);
        setPreviewing(false);
      });
  }, [previewing, draft, bumpSeedAndBuild, draftForPlayback, onPreviewDraft, onStopPreview, soundSelection, pluginPreviewOpts, laneGains]);

  const applyToDaw = useCallback(() => {
    onStopPreview();
    setPreviewing(false);
    const d = { ...(draft ?? bumpSeedAndBuild()), bars: state.barCount };
    const stack = se2SynthGenoBuildPluginApplyStack({
      draft: d,
      sounds: soundSelection(),
      resolvedKey,
      beatsPerBar,
      bassGlide: state.bassGlide,
      bpm: pluginPreviewBpm,
      enableChords: state.enableChords,
      enableMelody: state.enableMelody,
      enableBass: state.enableBass,
      enableFiller,
      fillerQuant,
      barChordSpecs: effectiveBarChordSpecs(),
    });
    if (stack.length === 0) return;
    const keyMeta: Se2SynthGenoApplyStackMeta = {
      keyRoot: resolvedKey.keyRoot,
      keyMode: resolvedKey.keyMode,
      chordBpm: pluginPreviewBpm,
      syncTransportBpm: syncBpmOnApply,
    };
    if (onApplyStack) {
      onApplyStack(stack, state.barCount, keyMeta);
      return;
    }
    if (stack[0]) onApplyNotes(stack[0].notes, keyMeta);
  }, [
    draft,
    bumpSeedAndBuild,
    resolvedKey,
    beatsPerBar,
    onStopPreview,
    onApplyNotes,
    onApplyStack,
    state.bassGlide,
    pluginPreviewBpm,
    syncBpmOnApply,
    state.enableChords,
    state.enableMelody,
    state.enableBass,
    enableFiller,
    fillerQuant,
    soundSelection,
    effectiveBarChordSpecs,
  ]);

  const minimizeB02 = useCallback(() => {
    onStopPreview();
    setPreviewing(false);
    setFullscreenBuild(null);
  }, [onStopPreview]);

  const canLockGrooveLead = useMemo(() => {
    const built = se2SynthGenoBuildHarmonySteps({
      build: 'b02',
      state,
      keyRoot: resolvedKey.keyRoot,
      keyMode: resolvedKey.keyMode,
      harmonyScaleMode,
      beatsPerBar,
      bpm,
      draft,
      melodySeed: seed,
    });
    return !('message' in built);
  }, [state, resolvedKey.keyRoot, resolvedKey.keyMode, harmonyScaleMode, beatsPerBar, bpm, draft, seed]);

  const lockGrooveLead = useCallback(() => {
    if (!onLockGrooveLead) return;
    onLockGrooveLead({
      build: 'b02',
      state,
      keyRoot: resolvedKey.keyRoot,
      keyMode: resolvedKey.keyMode,
      harmonyScaleMode,
      beatsPerBar,
      bpm,
      draft: draft ? { ...draft, grooveLeadNotes } : draft,
      melodySeed: seed,
      grooveLeadNotes,
    });
  }, [
    onLockGrooveLead,
    state,
    resolvedKey.keyRoot,
    resolvedKey.keyMode,
    harmonyScaleMode,
    beatsPerBar,
    bpm,
    draft,
    seed,
    grooveLeadNotes,
  ]);

  const chip = (active: boolean, onClick: () => void, label: string, color?: string) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border px-2.5 py-1 text-[8px] font-bold uppercase tracking-wide disabled:opacity-40"
      style={{
        borderColor: active ? `${color ?? accentHex}99` : '#3a3a48',
        background: active ? `${color ?? accentHex}20` : '#12121a',
        color: active ? (color ?? accentHex) : '#a8a8b8',
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3 w-full min-w-0">
      {onPlayLiveChord ? (
        <Se2SynthGenoLiveChordPanel
          accentHex={accentHex}
          disabled={disabled}
          resolvedKey={resolvedKey}
          beatsPerBar={beatsPerBar}
          bpm={bpm}
          seed={seed}
          accordBankId={state.accordBankId}
          melodyBankId={state.melodyBankId}
          bassBankId={state.bassBankId}
          fillerBankId={state.fillerBankId}
          fusionParams={fusionParams}
          onAccordBankChange={(id) => pickBank('accord', id)}
          onMelodyBankChange={(id) => pickBank('melody', id)}
          onBassBankChange={(id) => pickBank('bass', id)}
          onFillerBankChange={(id) => pickBank('filler', id)}
          onPlayLiveChord={onPlayLiveChord}
          onPreviewDraft={onPreviewDraft}
          onStopPreview={onStopPreview}
          onLoadPreset={onLivePresetLoad}
          onApplyStack={onApplyStack}
          onApplyAudio={onApplyAudio}
          buildExpanded={fullscreenBuild === 'b01'}
          onBuildExpandedChange={(open) => setFullscreenBuild(open ? 'b01' : null)}
          onLockGrooveLead={onLockGrooveLead}
          trackIndex={trackIndex}
          getAudioContext={getAudioContext}
          getGrooveLeadPreviewDestination={getGrooveLeadPreviewDestination}
          grooveLeadDockOpen={grooveLeadDockOpen}
          onGrooveLeadDockOpenChange={setGrooveLeadDockOpen}
          grooveLeadNotes={grooveLeadNotes}
          onGrooveLeadNotesChange={setGrooveLeadNotes}
        />
      ) : null}

      {!b02Expanded ? (
        <div
          className="w-full rounded-lg border px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
          style={{
            borderColor: `${accentHex}44`,
            background: `linear-gradient(180deg, ${accentHex}10 0%, transparent 100%)`,
          }}
        >
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] font-black uppercase tracking-[0.14em]" style={{ color: accentHex }}>
              {SE2_SYNTH_GENO_BUILD_2_LABEL}
            </span>
            <span className="text-[8px] opacity-65 leading-relaxed">
              Build full loops — progression library, loop editor with chords, melody &amp; bass, then apply to the piano roll.
            </span>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setFullscreenBuild('b02')}
            className="shrink-0 self-start sm:self-center rounded-md border px-2.5 py-1 text-[8px] font-bold uppercase tracking-wide disabled:opacity-40 flex items-center gap-1"
            style={{ borderColor: `${accentHex}66`, color: accentHex, background: `${accentHex}12` }}
          >
            <span aria-hidden className="text-[10px] leading-none">
              →
            </span>
            Open
          </button>
        </div>
      ) : (
        <>
          <Se2SynthGenoBuildFullscreenPlaceholder accentHex={accentHex} label={SE2_SYNTH_GENO_BUILD_2_LABEL} />
          <Se2SynthGenoBuildFullscreenFrame
            expanded={b02Expanded}
            accentHex={accentHex}
            label={SE2_SYNTH_GENO_BUILD_2_LABEL}
            subtitle={
              <>
                Pick a style and progression, generate chords + melody + bass, edit bars in the loop strip, and apply
                to the piano roll — or preview the full loop first.
                <span className="block mt-1 text-[8px] font-mono truncate" style={{ color: '#9a9aaa' }}>
                  {resolvedKey.label} · {bpm} BPM · {voice.label}
                  {draft ? ` · ${draftSummary(draft)}` : ' · no loop yet — hit Generate All'}
                </span>
              </>
            }
            disabled={disabled}
            onMinimize={minimizeB02}
          >
          <div className="px-3 flex flex-wrap items-center justify-end gap-3">
            <Se2SynthGenoSyncBpmChip
              chordBpm={pluginPreviewBpm}
              enabled={syncBpmOnApply}
              onToggle={() => setSyncBpmOnApply((v) => !v)}
              disabled={disabled || !draft}
              accentHex="#86efac"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => bumpSeedAndBuild()}
              className="rounded-md border px-3 py-1.5 text-[8px] font-bold uppercase tracking-wide disabled:opacity-40 whitespace-nowrap"
              style={{ borderColor: `${accentHex}88`, background: `${accentHex}22`, color: accentHex }}
            >
              Generate All
            </button>
            <button
              type="button"
              disabled={disabled || !draft}
              onClick={applyToDaw}
              className="rounded-md border px-3 py-1.5 text-[8px] font-black uppercase tracking-wide disabled:opacity-40 whitespace-nowrap"
              style={{ borderColor: '#22c55e88', background: '#22c55e18', color: '#86efac' }}
            >
              Apply → Piano Roll
            </button>
            {onLockGrooveLead ? (
              <button
                type="button"
                disabled={disabled || !canLockGrooveLead}
                onClick={lockGrooveLead}
                className="rounded-md border px-3 py-1.5 text-[8px] font-black uppercase tracking-wide disabled:opacity-40 whitespace-nowrap"
                style={{ borderColor: '#7cf4c688', background: '#14221c', color: '#7cf4c6' }}
                title="Create or update a Groove Lead lane locked to this Geno progression — edit on that track's piano roll"
              >
                Lock Groove Lead
              </button>
            ) : null}
          </div>

          <div className="px-3 pb-3 flex flex-col gap-3">
      <Se2SynthGenoEraProgressionLibrary
        accentHex={accentHex}
        disabled={disabled}
        activePresetId={activeEraPresetId}
        liveLoopSpecs={state.progressionLoop ?? state.barChordSpecs}
        onSelect={onEraPresetSelect}
        onAppendNextChord={onAppendNextChord}
        onCategoryChange={onEraCategoryPreviewBpm}
      />

      <Section accentHex={accentHex}>
        <div className="flex flex-wrap items-end gap-2 -mt-1 mb-1">
          <span
            className="text-[7px] font-bold uppercase tracking-widest opacity-45"
            style={{ color: '#a8a8b8' }}
            title="Voicing pipeline revision — bump forces fresh Roman→pad specs"
          >
            CG r{SE2_SYNTH_GENO_PLUGIN_VOICING_REVISION}
          </span>
          {state.eraCategoryId ? (
            <span className="text-[7px] font-bold" style={{ color: '#9a9aaa' }}>
              Preview {pluginPreviewBpm} BPM
            </span>
          ) : null}
          <span className="w-px h-4 bg-white/10 mx-0.5 self-center" />
          {chip(state.enableMelody, toggleMelodyLane, 'Melody', '#a78bfa')}
          {chip(enableFiller, toggleFillerLane, 'Note Filler', '#38bdf8')}
          <Se2SynthGenoLaneSoundStripGroup>
            <Se2SynthGenoChordPianoStrip
              stripId="cg-chord-piano"
              accentHex={accentHex}
              disabled={disabled}
              selectedId={state.accordBankId}
              onSelect={(id) => pickBank('accord', id)}
            />
            {state.enableMelody ? (
              <Se2SynthGenoLaneSoundStrip
                stripId="cg-melody-sound"
                accentHex="#a78bfa"
                disabled={disabled}
                label="Melody"
                panelButtonLabel="Sounds"
                panelTitle="Melody · piano &amp; plucks"
                entries={se2SynthGenoMelodyLaneSoundEntries()}
                selectedId={se2SynthGenoSanitizePluginMelodyBankId(state.melodyBankId)}
                onSelect={(id) => pickBank('melody', id)}
                sanitizeId={se2SynthGenoSanitizePluginMelodyBankId}
                showSoundGrid
              />
            ) : null}
            <Se2SynthGenoLaneSoundStrip
              stripId="cg-bass-sound"
              accentHex="#fbbf24"
              disabled={disabled}
              label="Bass"
              panelButtonLabel="Filter"
              panelTitle="Bass · Moog &amp; bass guitar"
              entries={bassSoundEntries}
              selectedId={state.bassBankId}
              onSelect={(id) => pickBank('bass', id)}
              sanitizeId={(id) => se2SynthGenoSanitizeSoundBankId('bass', id)}
            />
            {enableFiller ? (
              <Se2SynthGenoLaneSoundStrip
                stripId="cg-filler-sound"
                accentHex="#38bdf8"
                disabled={disabled}
                label="Note Filler"
                panelButtonLabel="Sounds"
                panelTitle="Note Filler · piano &amp; plucks"
                entries={se2SynthGenoFillerLaneSoundEntries()}
                selectedId={se2SynthGenoSanitizePluginFillerBankId(state.fillerBankId)}
                onSelect={(id) => pickBank('filler', id)}
                sanitizeId={se2SynthGenoSanitizePluginFillerBankId}
                showSoundGrid
              />
            ) : null}
          </Se2SynthGenoLaneSoundStripGroup>
        </div>
        <Se2SynthGenoPluginDualKeyboard
          keys={keyboardKeys}
          slotEnabled={slotEnabled}
          displayVoicingMidis={displayVoicingMidis}
          voicingDepth={selectedVoicingDepth}
          accentHex={accentHex}
          disabled={disabled}
          onPlaySlot={playSlot}
          onReleaseSlot={releaseSlot}
          onToggleSlot={toggleSlot}
          playOrder={playOrder}
          chordCount={chordCount}
          onPlayOrderChange={setPlayOrderPosition}
          onReplaceSlot={replaceSlotChord}
          canUndoReplace={canUndoReplace}
          onUndoReplaceSlot={undoReplaceSlot}
          slotSubstitutes={slotSubstitutes}
          onApplySlotSubstitute={applySlotSubstitute}
          playbackSlot={previewing ? playbackSlot : null}
          loopPreviewActive={previewing}
          onTogglePreview={togglePreview}
          previewing={previewing}
          previewDisabled={disabled || !draft}
        />
        <Se2SynthGenoHarmonyIntelStrip
          accentHex={accentHex}
          disabled={disabled}
          scaleMode={effectiveScaleMode}
          onScaleModeChange={setHarmonyScaleMode}
          anchorRoman={harmonyAnchorRoman}
          anchorLabel={harmonyAnchorLabel}
          romans={pluginRomans}
          playOrder={playOrder}
          eraCategoryId={state.eraCategoryId}
          onApplyAnchorProgression={applyAnchorProgression}
          focusedSlotIndex={previewSlot}
        />

      </Section>

      <Se2SynthGenoPluginLoopView
        draft={draft}
        beatsPerBar={beatsPerBar}
        timelineBarCount={state.barCount}
        previewBeat={previewing ? previewBeat : null}
        loopBarCount={state.barCount}
        onLoopBarCountChange={onBarCountChange}
        previewing={previewing}
        onTogglePreview={togglePreview}
        previewDisabled={!draft}
        voicingDepth={{
          selected: selectedVoicingDepth,
          options: VOICING_DEPTH_OPTIONS,
          onPick: pickVoicingDepth,
        }}
        styleSelect={{
          value: state.stylePreset,
          options: STYLE_OPTIONS.map((st) => ({ id: st, label: genoStylePreset(st).label })),
          onChange: (id) => applyStyle(id as GenoChordStyle),
        }}
        keyRoot={resolvedKey.keyRoot}
        keyMode={resolvedKey.keyMode}
        accentHex={accentHex}
        showChords={state.enableChords}
        showMelody={state.enableMelody}
        showBass={state.enableBass}
        showFiller={enableFiller}
        selectedBar={selectedBar}
        disabled={disabled}
        barChordSpecs={state.barChordSpecs}
        onBarDegreeChange={onBarDegreeChange}
        onBarChopQuantChange={onBarChopQuantChange}
        onChordNotesChange={onChordNotesChange}
        onBassNotesChange={onBassNotesChange}
        onMelodyNotesChange={onMelodyNotesChange}
        onFillerNotesChange={onFillerNotesChange}
        fillerControls={enableFiller ? fillerControls : undefined}
        bassGlideControls={
          state.enableBass
            ? {
                slideOn: state.bassGlide,
                onSlideOn: () => patch({ bassGlide: true }),
                onSlideOff: () => patch({ bassGlide: false }),
              }
            : undefined
        }
        tailInsert={
          draft && state.enableChords
            ? {
                focusBar: tailFocusBar,
                fromRoman: tailInsertContext.fromRoman,
                toRoman: tailInsertContext.toRoman,
                canInsert: tailInsertContext.canInsert,
                isLoopWrap: tailInsertContext.isLoopWrap,
                options: tailPassingOptions,
                onFocusBar: setTailFocusBar,
                onInsert: (opt) => {
                  if (tailFocusBar != null) insertPassingAtBar(tailFocusBar, opt);
                },
              }
            : undefined
        }
        chordLane={{
          enabled: state.enableChords,
          hasNotes: (draft?.chordNotes.length ?? 0) > 0,
          onToggle: () => patch({ enableChords: !state.enableChords }),
          onClear: () => clearPart('chords'),
          onRegen: () => regeneratePart('chords'),
          canUndoRegen: genoChordLoopStackCanUndo(chordLoopUndo),
          onUndoRegen: undoChordLoopEdit,
        }}
        melodyLane={{
          enabled: state.enableMelody,
          hasNotes: (draft?.melodyNotes.length ?? 0) > 0,
          onToggle: toggleMelodyLane,
          onClear: () => {
            patch({ enableMelody: false });
            clearPart('melody');
          },
          onRegen: () => regeneratePart('melody'),
          canUndoRegen: genoLaneRegenStackCanUndo(laneRegenUndo.melody),
          onUndoRegen: () => undoLaneRegen('melody'),
        }}
        bassLane={{
          enabled: state.enableBass,
          hasNotes: (draft?.bassNotes.length ?? 0) > 0,
          onToggle: () => patch({ enableBass: !state.enableBass }),
          onClear: () => clearPart('bass'),
          onRegen: () => regeneratePart('bass'),
        }}
        fillerLane={{
          enabled: enableFiller,
          hasNotes: (draft?.fillerNotes?.length ?? 0) > 0,
          onToggle: toggleFillerLane,
          onClear: () => {
            setEnableFiller(false);
            clearPart('filler');
          },
          onRegen: () => regeneratePart('filler'),
          canUndoRegen: genoLaneRegenStackCanUndo(laneRegenUndo.filler),
          onUndoRegen: () => undoLaneRegen('filler'),
        }}
        laneVolumes={laneVolumes}
      />

      <div className="px-3 pb-6 shrink-0">
      <Se2SynthGenoGrooveLeadDock
        open={grooveLeadDockOpen}
        onOpenChange={setGrooveLeadDockOpen}
        grooveLeadNotes={grooveLeadNotes}
        onGrooveLeadNotesChange={setGrooveLeadNotes}
        draft={draft}
        beatsPerBar={beatsPerBar}
        timelineBarCount={state.barCount}
        keyRoot={resolvedKey.keyRoot}
        keyMode={resolvedKey.keyMode}
        harmonyScaleMode={harmonyScaleMode}
        barChordSpecs={state.barChordSpecs}
        bpm={pluginPreviewBpm}
        disabled={disabled}
        previewBeat={previewing ? previewBeat : null}
        onLockToTrack={onLockGrooveLead ? lockGrooveLead : undefined}
        canLockToTrack={canLockGrooveLead}
        getAudioContext={getAudioContext}
        getPreviewDestination={getGrooveLeadPreviewDestination}
        trackIndex={trackIndex}
        genoBuild="b02"
        onStopPreview={onStopPreview}
        loopPreviewing={previewing && grooveLeadNotes.length > 0}
        previewGain={laneGains.grooveLead}
        onPreviewGainChange={handleGrooveLeadGainChange}
      />
      </div>

      <Section title="Progression" accentHex={accentHex}>
        <select
          disabled={disabled}
          value={state.progressionId}
          onChange={(e) =>
            onProgressionChange(e.target.value as Se2SynthGenoChordPluginState['progressionId'])
          }
          className="rounded-md border px-3 py-2 text-[10px] outline-none disabled:opacity-50 w-full"
          style={{ borderColor: '#3a3a48', background: '#0c0c14', color: '#e8e8f4' }}
        >
          {GENO_PROGRESSIONS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Section>

      <Section title="Performance & voicing" accentHex={accentHex}>
        <div className="flex flex-wrap gap-2">
          {PERF_OPTIONS.map((p) =>
            chip(state.perfMode === p.id, () => patchVoicing({ perfMode: p.id }), p.label),
          )}
        </div>
        {state.perfMode === 'repeater' ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[7px] font-bold uppercase tracking-widest shrink-0" style={{ color: '#a8a8b8' }}>Quant</span>
            {REPEATER_QUANT_OPTIONS.map((q) =>
              chip(
                state.repeaterQuant === q.id,
                () => patchVoicing({ repeaterQuant: q.id }),
                q.label,
                accentHex,
              ),
            )}
            <span className="text-[7px] w-full leading-relaxed" style={{ color: '#7a7a88' }}>
              Re-triggers chord voicing on each grid step · melody &amp; bass are separate
            </span>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-1">
          {EXT_OPTIONS.map((ext) =>
            chip(
              state.extensions.includes(ext),
              () =>
                patchVoicing({
                  extensions: state.extensions.includes(ext)
                    ? state.extensions.filter((e) => e !== ext)
                    : [...state.extensions, ext],
                }),
              ext,
            ),
          )}
          {chip(state.smartMatch, () => patchVoicing({ smartMatch: !state.smartMatch }), 'Smart')}
          {[0, 1, 2].map((inv) =>
            chip(state.inversion === inv, () => patchVoicing({ inversion: inv }), `Inv ${inv}`),
          )}
          {chip(state.staccato, () => patchVoicing({ staccato: !state.staccato }), 'Staccato')}
        </div>
      </Section>

      {(state.enableMelody || state.enableBass) && (
        <Section title="Melody & bass flavor" accentHex={accentHex}>
          {state.enableMelody ? (
            <div className="flex flex-wrap gap-2">
              {MELODY_GENRE_OPTIONS.map((m) =>
                chip(state.melodyGenre === m.id, () => patchMelodyFlavor(m.id), m.label, '#a78bfa'),
              )}
            </div>
          ) : null}
          {state.enableBass ? (
            <>
              <div className="flex flex-wrap gap-2 mt-1">
                {BASS_PATTERN.map((b) =>
                  chip(state.bassPattern === b.id, () => patch({ bassPattern: b.id }), b.label, '#fbbf24'),
                )}
              </div>
            </>
          ) : null}
        </Section>
      )}

          </div>
          </Se2SynthGenoBuildFullscreenFrame>
        </>
      )}

    </div>
  );
}
