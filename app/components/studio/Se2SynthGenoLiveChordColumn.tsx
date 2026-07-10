'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { Se2ComposeResolvedKey } from '@/app/lib/studio/se2SynthGenoKeyLock';
import {
  se2SynthGenoMelodyLaneSoundEntries,
  se2SynthGenoFillerLaneSoundEntries,
  SE2_SYNTH_GENO_FILLER_LANE_DEFAULT_BANK,
  se2SynthGenoSanitizePluginMelodyBankId,
  se2SynthGenoSanitizePluginFillerBankId,
  se2SynthGenoSanitizeSoundBankId,
  se2SynthGenoSoundBankEntries,
} from '@/app/lib/studio/se2SynthGenoSoundBank';
import { se2SynthGenoSanitizeChordPianoBankId } from '@/app/lib/studio/se2SynthGenoChordPianoLibrary';
import { Se2SynthGenoChordPianoStrip } from '@/app/components/studio/Se2SynthGenoChordPianoPicker';
import { Se2SynthGenoLaneSoundStrip } from '@/app/components/studio/Se2SynthGenoLaneSoundStrip';
import { Se2SynthGenoLaneSoundStripGroup } from '@/app/components/studio/Se2SynthGenoLaneSoundStripGroup';
import {
  se2SynthGenoLiveBuildDraft,
  se2SynthGenoLivePresetsForGenre,
  se2SynthGenoLivePresetFromUserEdits,
  SE2_SYNTH_GENO_LIVE_GENRES,
} from '@/app/lib/studio/se2SynthGenoLiveChordLibrary';
import type { GenoLoopBarCount } from '@/app/lib/studio/se2SynthGenoLoopBarCount';
import { se2SynthGenoTileBarSpecs } from '@/app/lib/studio/se2SynthGenoEraProgressionLibrary';
import {
  se2SynthGenoLiveBuildProgressionKeyboard,
  se2SynthGenoLiveDefaultPlayOrder,
  se2SynthGenoLiveOrderedSlotIndices,
  se2SynthGenoLiveReplaceSlotChord,
  se2SynthGenoLiveSwapPlayOrder,
  se2SynthGenoLiveSlotForPreviewBeat,
} from '@/app/lib/studio/se2SynthGenoLiveChordMap';
import type { Se2SynthGenoLivePreset, Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import { SE2_SYNTH_GENO_LIVE_ZONE_SIZE } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import { se2SynthGenoLiveSlotSubstituteOptions } from '@/app/lib/studio/se2SynthGenoSlotSubstitutes';
import {
  SE2_SYNTH_GENO_LIVE_VOICING_REVISION,
  se2SynthGenoLiveRebuildSpecForDegree,
  se2SynthGenoLiveRomanForDegree,
  se2SynthGenoLiveRomanToBarSpec,
} from '@/app/lib/studio/se2SynthGenoLiveChordRoman';
import { se2SynthGenoVoiceLiveChord } from '@/app/lib/studio/se2SynthGenoLiveChordVoicing';
import { Se2SynthGenoLiveDualKeyboard } from '@/app/components/studio/Se2SynthGenoLiveDualKeyboard';
import { Se2SynthGenoLiveGenreLibrary } from '@/app/components/studio/Se2SynthGenoLiveGenreLibrary';
import { Se2SynthGenoPluginLoopView } from '@/app/components/studio/Se2SynthGenoPluginLoopView';
import type { GenoVoicingDepth } from '@/app/lib/studio/se2SynthGenoVoicingDepth';
import { se2SynthGenoDefaultVoicingDepth } from '@/app/lib/studio/se2SynthGenoVoicingDepth';
import type { GenoBarChordSpec, GenoBarChopQuant } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import type {
  Se2SynthGenoPluginDraft,
  Se2SynthGenoPluginSoundSelection,
} from '@/app/lib/studio/se2SynthGenoChordPlugin';
import { writeSe2SynthGenoLiveBuildSession } from '@/app/lib/studio/se2SynthGenoLiveBuildSessionCache';
import type { Se2SynthGenoStackPart, Se2SynthGenoApplyStackMeta } from '@/app/lib/studio/se2SynthGenoCompose';
import {
  type Se2SynthGenoPluginPreviewOpts,
  getSe2SynthGenoPluginPreviewLoopBeat,
} from '@/app/lib/studio/se2SynthGenoPluginPreview';
import { se2GrooveLeadB01Voice } from '@/app/lib/studio/se2GrooveLeadTypes';
import { Se2SynthGenoSyncBpmChip } from '@/app/components/studio/Se2SynthGenoSyncBpmChip';
import { se2SynthGenoBuildPluginApplyStack } from '@/app/lib/studio/se2SynthGenoPluginApplyStack';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import type { GenoLiveArpPattern, GenoLiveArpRate } from '@/app/lib/studio/se2SynthGenoLiveArpEngine';
import {
  genoFillerQuantStep,
  type GenoFillerQuant,
} from '@/app/lib/studio/se2SynthGenoFillerEngine';
import { genoNormalizePluginFillerNotes } from '@/app/lib/studio/se2SynthGenoRanges';
import { GENO_LIVE_ARP_PREVIEW_MELODY_GAIN } from '@/app/lib/studio/se2SynthGenoLiveArpTypes';
import {
  genoDefaultLanePreviewGains,
  genoLanePreviewGainsToPreviewOpts,
  genoPreviewOptsWithoutMixGains,
  setGenoPluginPreviewMixGains,
  type GenoLanePreviewGainId,
  type GenoLanePreviewGains,
} from '@/app/lib/studio/se2SynthGenoLanePreviewGains';
import {
  genoNotesInBar,
  se2SynthGenoLiveBarLaneUndoKey,
  se2SynthGenoLiveRegenerateBarLane,
  se2SynthGenoLiveRegenerateLanePart,
  se2SynthGenoLiveUndoBarLane,
  type Se2SynthGenoLiveBarLanePart,
  type Se2SynthGenoLiveRegenContext,
} from '@/app/lib/studio/se2SynthGenoLiveBarRegen';
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
import { genoStylePreset } from '@/app/lib/studio/se2SynthGenoStylePresets';
import {
  se2SynthGenoLiveGenreBpm,
  se2SynthGenoLivePresetBpm,
} from '@/app/lib/studio/se2SynthGenoLiveGenreTempo';
import {
  SE2_SYNTH_GENO_BUILD_1_LABEL,
  SE2_SYNTH_GENO_BUILD_2_LABEL,
  type Se2SynthGenoFusionParams,
} from '@/app/lib/studio/se2SynthGenoFusionEngine';
import {
  Se2SynthGenoBuildFullscreenFrame,
  Se2SynthGenoBuildFullscreenPlaceholder,
} from '@/app/components/studio/Se2SynthGenoBuildFullscreenFrame';
import { Se2SynthGenoHarmonyIntelStrip } from '@/app/components/studio/Se2SynthGenoHarmonyIntelStrip';
import {
  se2SynthGenoEffectiveScaleMode,
  se2SynthGenoLiveInsertPassingAfterBar,
  se2SynthGenoPassingOptionsForBar,
  se2SynthGenoPassingTransitionForBar,
  type GenoAnchorProgressionOption,
  type GenoPassingChordOption,
} from '@/app/lib/studio/se2SynthGenoHarmonyIntel';
import { se2SynthGenoEraPresetById } from '@/app/lib/studio/se2SynthGenoEraProgressionLibrary';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  se2SynthGenoBuildHarmonySteps,
  type Se2SynthGenoGrooveLeadLockInput,
} from '@/app/lib/studio/se2SynthGenoGrooveLeadLock';
import { Se2SynthGenoGrooveLeadDock } from '@/app/components/studio/Se2SynthGenoGrooveLeadDock';

/** Last tile cycle (e.g. bars 9–12 on a 12-bar / 4-card loop) — editable independently of bars 1–4. */
function se2SynthGenoLiveIsIndependentLoopBar(
  bar: number,
  barCount: number,
  loopLength: number,
): boolean {
  return loopLength > 0 && barCount > loopLength && bar >= barCount - loopLength;
}

export type Se2SynthGenoLiveChordPlayOpts = {
  chordGlide?: boolean;
  genreId?: Se2SynthGenoLiveGenreId;
  padTrigger?: boolean;
};

export type Se2SynthGenoLiveChordPanelProps = {
  accentHex?: string;
  disabled?: boolean;
  resolvedKey: Se2ComposeResolvedKey;
  beatsPerBar: number;
  bpm: number;
  seed: number;
  accordBankId: string;
  melodyBankId: string;
  bassBankId: string;
  fillerBankId?: string;
  fusionParams?: Se2SynthGenoFusionParams;
  onAccordBankChange?: (id: string) => void;
  onMelodyBankChange?: (id: string) => void;
  onBassBankChange?: (id: string) => void;
  onFillerBankChange?: (id: string) => void;
  onPlayLiveChord: (
    tones: readonly number[],
    accordBankId: string,
    opts?: Se2SynthGenoLiveChordPlayOpts,
  ) => void;
  onPreviewDraft: (
    draft: Se2SynthGenoPluginDraft,
    sounds: Se2SynthGenoPluginSoundSelection,
    previewOpts?: Se2SynthGenoPluginPreviewOpts,
  ) => void | Promise<void>;
  onStopPreview: () => void;
  onLoadPreset?: (preset: Se2SynthGenoLivePreset) => void;
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
  /** When set, Open/Minimize is controlled by the parent (Geno Build 2 shell). */
  buildExpanded?: boolean;
  onBuildExpandedChange?: (expanded: boolean) => void;
  onLockGrooveLead?: (input: Se2SynthGenoGrooveLeadLockInput) => number | null;
  trackIndex?: number;
  getAudioContext?: () => AudioContext;
  getGrooveLeadPreviewDestination?: (ctx: AudioContext) => AudioNode;
  grooveLeadDockOpen?: boolean;
  onGrooveLeadDockOpenChange?: (open: boolean) => void;
  grooveLeadNotes?: readonly StudioEditor2GenNote[];
  onGrooveLeadNotesChange?: (notes: StudioEditor2GenNote[]) => void;
};

export function Se2SynthGenoLiveChordPanel({
  accentHex = '#00E5CC',
  disabled = false,
  resolvedKey,
  beatsPerBar,
  bpm,
  seed,
  accordBankId,
  melodyBankId,
  bassBankId,
  fillerBankId: fillerBankIdProp,
  fusionParams,
  onAccordBankChange,
  onMelodyBankChange,
  onBassBankChange,
  onFillerBankChange,
  onPlayLiveChord,
  onPreviewDraft,
  onStopPreview,
  onLoadPreset,
  onApplyStack,
  onApplyAudio,
  buildExpanded,
  onBuildExpandedChange,
  onLockGrooveLead,
  trackIndex = 0,
  getAudioContext,
  getGrooveLeadPreviewDestination,
  grooveLeadDockOpen = false,
  onGrooveLeadDockOpenChange,
  grooveLeadNotes = [],
  onGrooveLeadNotesChange,
}: Se2SynthGenoLiveChordPanelProps) {
  const [livePreviewBpm, setLivePreviewBpm] = useState(() => se2SynthGenoLiveGenreBpm('trap'));
  const [syncBpmOnApply, setSyncBpmOnApply] = useState(false);

  useEffect(() => {
    setLivePreviewBpm(bpm);
  }, [bpm]);
  const [expandedLocal, setExpandedLocal] = useState(false);
  const expanded = onBuildExpandedChange ? (buildExpanded ?? false) : expandedLocal;
  const setExpanded = useCallback(
    (value: boolean) => {
      if (onBuildExpandedChange) onBuildExpandedChange(value);
      else setExpandedLocal(value);
    },
    [onBuildExpandedChange],
  );
  const [applyingAudio, setApplyingAudio] = useState(false);
  const [genreId, setGenreId] = useState<Se2SynthGenoLiveGenreId>('trap');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [selectedVoicingDepth, setSelectedVoicingDepth] = useState<GenoVoicingDepth>(() =>
    se2SynthGenoDefaultVoicingDepth(genreId),
  );
  const [editSpecs, setEditSpecs] = useState<GenoBarChordSpec[]>([]);
  const [editRomans, setEditRomans] = useState<ChordSymbol[]>([]);
  const [slotEnabled, setSlotEnabled] = useState<boolean[]>(() => Array.from({ length: 12 }, () => true));
  const [barCount, setBarCount] = useState<GenoLoopBarCount>(8);
  const [enableChords, setEnableChords] = useState(true);
  const [enableArp, setEnableArp] = useState(false);
  const [enableBass, setEnableBass] = useState(true);
  const [enableFiller, setEnableFiller] = useState(false);
  const [localFillerBankId, setLocalFillerBankId] = useState(SE2_SYNTH_GENO_FILLER_LANE_DEFAULT_BANK);
  const fillerBankId = fillerBankIdProp ?? localFillerBankId;
  const setFillerBankId = onFillerBankChange ?? setLocalFillerBankId;
  const [fillerQuant, setFillerQuant] = useState<GenoFillerQuant>('8th');
  const [fillerEditTool, setFillerEditTool] = useState<'draw' | 'erase'>('draw');
  const [laneGains, setLaneGains] = useState<GenoLanePreviewGains>(() =>
    genoDefaultLanePreviewGains({ melody: GENO_LIVE_ARP_PREVIEW_MELODY_GAIN }),
  );
  const [bassGlide, setBassGlide] = useState(false);
  const [chordGlide, setChordGlide] = useState(false);
  const [arpPattern, setArpPattern] = useState<GenoLiveArpPattern>('chord');
  const [arpRate, setArpRate] = useState<GenoLiveArpRate>('8th');
  const [livePreviewing, setLivePreviewing] = useState(false);
  const [previewBeat, setPreviewBeat] = useState<number | null>(null);
  const [selectedBar, setSelectedBar] = useState<number | null>(null);
  const [tailFocusBar, setTailFocusBar] = useState<number | null>(null);
  const [liveBarSpecPatches, setLiveBarSpecPatches] = useState<Record<number, GenoBarChordSpec>>({});
  const [lanePartSeeds, setLanePartSeeds] = useState({ chords: 0, arp: 0, bass: 0, filler: 0 });
  const [laneRegenUndo, setLaneRegenUndo] = useState<{
    chords?: GenoLaneRegenNoteStack;
    arp?: GenoLaneRegenNoteStack;
    bass?: GenoLaneRegenNoteStack;
    filler?: GenoLaneRegenNoteStack;
  }>({});
  const [chordLoopUndo, setChordLoopUndo] = useState<GenoChordLoopUndoStack>([]);
  const chordUndoRestoreRef = useRef(false);
  const skipDraftResetRef = useRef(0);
  const [barLaneUndo, setBarLaneUndo] = useState<Record<string, StudioEditor2GenNote[]>>({});
  const [pressedSlot, setPressedSlot] = useState<number | null>(null);
  const [slotReplaceUndo, setSlotReplaceUndo] = useState<
    Record<number, { spec: GenoBarChordSpec; roman: ChordSymbol }>
  >({});
  const [playOrder, setPlayOrder] = useState<number[]>(() => se2SynthGenoLiveDefaultPlayOrder(12));
  const [liveDraftOverride, setLiveDraftOverride] = useState<Se2SynthGenoPluginDraft | null>(null);
  const [barLaneRegenSeeds, setBarLaneRegenSeeds] = useState<Record<Se2SynthGenoLiveBarLanePart, number[]>>({
    arp: Array(8).fill(0),
    bass: Array(8).fill(0),
  });
  const [harmonyScaleMode, setHarmonyScaleMode] = useState<ChordMode>('major');

  const DEPTH_OPTIONS: GenoVoicingDepth[] = [4, 5, 6, 7];

  const presets = useMemo(
    () => (expanded ? se2SynthGenoLivePresetsForGenre(genreId) : []),
    [expanded, genreId, SE2_SYNTH_GENO_LIVE_VOICING_REVISION],
  );
  const activePreset = useMemo(() => {
    if (activePresetId) {
      return presets.find((p) => p.id === activePresetId) ?? null;
    }
    return presets[0] ?? null;
  }, [presets, activePresetId]);

  const chordCount = useMemo(
    () => (activePreset ? Math.min(activePreset.loopLength, SE2_SYNTH_GENO_LIVE_ZONE_SIZE) : 0),
    [activePreset],
  );

  const effectiveScaleMode = useMemo(
    () =>
      se2SynthGenoEffectiveScaleMode(
        resolvedKey.keyMode,
        harmonyScaleMode,
        activePreset?.mode,
      ),
    [resolvedKey.keyMode, harmonyScaleMode, activePreset?.mode],
  );

  const orderedSlotIndices = useMemo(
    () => se2SynthGenoLiveOrderedSlotIndices(playOrder, chordCount),
    [playOrder, chordCount],
  );

  const voiceSpecs = useMemo((): (GenoBarChordSpec | null)[] => {
    if (!activePreset || chordCount === 0) return [];
    return Array.from({ length: chordCount }, (_, i) => {
      const roman = editRomans[i] ?? activePreset.romans[i];
      if (!roman) return null;
      const fromRoman = se2SynthGenoLiveRomanToBarSpec(
        roman,
        activePreset.mode,
        activePreset.genreId,
      );
      const editSpec = editSpecs[i];
      return {
        ...fromRoman,
        ...(editSpec ?? {}),
        voicingDepth: editSpec?.voicingDepth ?? fromRoman.voicingDepth ?? selectedVoicingDepth,
        chopQuant: editSpec?.chopQuant ?? fromRoman.chopQuant,
      };
    });
  }, [
    activePreset,
    chordCount,
    editRomans,
    editSpecs,
    selectedVoicingDepth,
    SE2_SYNTH_GENO_LIVE_VOICING_REVISION,
  ]);

  const orderedSpecs = useMemo(
    () => orderedSlotIndices.map((i) => voiceSpecs[i]).filter((s): s is GenoBarChordSpec => s != null),
    [orderedSlotIndices, voiceSpecs],
  );

  const applyPreset = useCallback((preset: Se2SynthGenoLivePreset) => {
    setGenreId(preset.genreId);
    setActivePresetId(preset.id);
    setActiveSlot(null);
    setPressedSlot(null);
    setLiveDraftOverride(null);
    setEditSpecs(preset.chordSpecs.map((s) => ({ ...s })));
    setEditRomans([...preset.romans.slice(0, preset.loopLength)]);
    setSlotReplaceUndo({});
    setChordLoopUndo([]);
    setHarmonyScaleMode(preset.mode);
    setPlayOrder(se2SynthGenoLiveDefaultPlayOrder(preset.loopLength));
    setSlotEnabled(
      Array.from({ length: 12 }, (_, i) => i < preset.loopLength),
    );
    setLivePreviewing(false);
    onStopPreview();
    setLivePreviewBpm(se2SynthGenoLivePresetBpm(preset));
  }, [onStopPreview]);

  const onGenreChange = useCallback(
    (id: Se2SynthGenoLiveGenreId) => {
      onStopPreview();
      setLivePreviewing(false);
      setGenreId(id);
      setActivePresetId(null);
      setActiveSlot(null);
      setPressedSlot(null);
      setLiveDraftOverride(null);
      setEditSpecs([]);
      setEditRomans([]);
      setSlotReplaceUndo({});
      setChordLoopUndo([]);
      setLivePreviewBpm(se2SynthGenoLiveGenreBpm(id));
    },
    [onStopPreview],
  );

  const liveDraftBaseKey = useMemo(() => {
    if (!activePreset || orderedSpecs.length === 0) return '';
    return [
      activePreset.id,
      barCount,
      enableChords,
      enableArp,
      enableBass,
      enableFiller,
      fillerQuant,
      arpPattern,
      arpRate,
      bassGlide,
      resolvedKey.keyRoot,
      resolvedKey.keyMode,
      beatsPerBar,
      livePreviewBpm,
      seed,
      accordBankId,
      melodyBankId,
      bassBankId,
      fillerBankId,
      playOrder.slice(0, chordCount).join(','),
      editRomans.slice(0, chordCount).join('·'),
      ...orderedSpecs.map((s) => {
        const tail = s.passingTail
          ? `tail:${s.passingTail.quant}:${s.passingTail.roman ?? ''}:${(s.passingTail.spec.chordIntervals ?? []).join('+')}`
          : '';
        return `${s.degree}:${(s.chordIntervals ?? []).join('+')}:${s.chopQuant ?? 'whole'}:${s.voicingDepth ?? ''}:${s.inversion ?? ''}:${s.smartMatch ?? ''}:${tail}`;
      }),
    ].join('|');
  }, [
    activePreset,
    orderedSpecs,
    barCount,
    enableChords,
    enableArp,
    arpPattern,
    arpRate,
    enableBass,
    enableFiller,
    fillerQuant,
    bassGlide,
    resolvedKey.keyRoot,
    resolvedKey.keyMode,
    beatsPerBar,
    livePreviewBpm,
    seed,
    accordBankId,
    melodyBankId,
    bassBankId,
    fillerBankId,
    playOrder,
    chordCount,
    editRomans,
  ]);

  const arpSoundEntries = useMemo(() => se2SynthGenoMelodyLaneSoundEntries(), []);
  const bassSoundEntries = useMemo(() => se2SynthGenoSoundBankEntries('bass'), []);

  const tiledBarSpecs = useMemo(
    () => (orderedSpecs.length > 0 ? se2SynthGenoTileBarSpecs(orderedSpecs, barCount) : undefined),
    [orderedSpecs, barCount],
  );

  const effectiveBarSpecs = useMemo(() => {
    if (!tiledBarSpecs) return undefined;
    const patchBars = Object.keys(liveBarSpecPatches);
    if (patchBars.length === 0) return tiledBarSpecs;
    return tiledBarSpecs.map((spec, bar) => liveBarSpecPatches[bar] ?? spec);
  }, [tiledBarSpecs, liveBarSpecPatches]);

  const liveDraftBase = useMemo(() => {
    if (!liveDraftBaseKey || !activePreset || orderedSpecs.length === 0) return null;
    return se2SynthGenoLiveBuildDraft({
      preset: activePreset,
      chordSpecs: orderedSpecs,
      orderedSlotIndices,
      barCount,
      barSpecs:
        Object.keys(liveBarSpecPatches).length > 0 ? effectiveBarSpecs : undefined,
      toggles: {
        enableChords,
        enableMelody: false,
        enableBass,
        enableArp,
        arpPattern,
        arpRate,
        bassGlide,
        enableFiller,
        fillerQuant: fillerQuant,
      },
      keyRoot: resolvedKey.keyRoot,
      keyMode: resolvedKey.keyMode,
      beatsPerBar,
      bpm: livePreviewBpm,
      seed,
      accordBankId,
      melodyBankId,
      bassBankId,
      fillerBankId,
    });
  }, [liveDraftBaseKey, activePreset, orderedSpecs, orderedSlotIndices, barCount, liveBarSpecPatches, effectiveBarSpecs, enableChords, enableArp, arpPattern, arpRate, enableBass, enableFiller, fillerQuant, bassGlide, resolvedKey.keyRoot, resolvedKey.keyMode, beatsPerBar, livePreviewBpm, seed, accordBankId, melodyBankId, bassBankId, fillerBankId]);

  const liveDraft = liveDraftOverride ?? liveDraftBase;

  useEffect(() => {
    if (!activePreset || orderedSpecs.length === 0) return;
    const draft = liveDraft ?? liveDraftBase;
    if (!draft) return;
    writeSe2SynthGenoLiveBuildSession(trackIndex, {
      draft,
      label: activePreset.name,
      keyRoot: resolvedKey.keyRoot,
      keyMode: resolvedKey.keyMode,
      bpm: livePreviewBpm,
      beatsPerBar,
      updatedAt: Date.now(),
      b01Snapshot: {
        presetId: activePreset.id,
        editRomans: editRomans.slice(0, chordCount),
        orderedSpecs: [...orderedSpecs],
        barCount,
        playOrder: playOrder.slice(0, chordCount),
        liveBarSpecPatches: { ...liveBarSpecPatches },
        keyRoot: resolvedKey.keyRoot,
        keyMode: resolvedKey.keyMode,
        beatsPerBar,
        bpm: livePreviewBpm,
        enableChords,
      },
    });
  }, [
    trackIndex,
    activePreset,
    orderedSpecs,
    liveDraft,
    liveDraftBase,
    editRomans,
    chordCount,
    barCount,
    playOrder,
    liveBarSpecPatches,
    resolvedKey.keyRoot,
    resolvedKey.keyMode,
    livePreviewBpm,
    beatsPerBar,
    enableChords,
  ]);

  const liveDraftForPlayback = useMemo(() => {
    if (!liveDraft) return null;
    return { ...liveDraft, grooveLeadNotes: [...grooveLeadNotes] };
  }, [liveDraft, grooveLeadNotes]);

  const regenContext = useMemo((): Se2SynthGenoLiveRegenContext | null => {
    if (!activePreset || !effectiveBarSpecs?.length) return null;
    const style = genoStylePreset(activePreset.stylePreset);
    return {
      keyRoot: resolvedKey.keyRoot,
      keyMode: resolvedKey.keyMode,
      beatsPerBar,
      barCount,
      baseSeed: seed,
      chordMode: activePreset.mode,
      stylePreset: activePreset.stylePreset,
      extensions: activePreset.extensions,
      inversion: activePreset.inversion,
      genreId: activePreset.genreId,
      tiledSpecs: effectiveBarSpecs,
      arpPattern,
      arpRate,
      bassPattern: 'root',
      enableChords,
      enableArp,
      enableBass,
      enableFiller,
      fillerQuant,
    };
  }, [
    activePreset,
    effectiveBarSpecs,
    resolvedKey.keyRoot,
    resolvedKey.keyMode,
    beatsPerBar,
    barCount,
    seed,
    arpPattern,
    arpRate,
    enableChords,
    enableArp,
    enableBass,
    enableFiller,
    fillerQuant,
  ]);

  useEffect(() => {
    if (!liveDraftBaseKey) return;
    if (skipDraftResetRef.current > 0) {
      skipDraftResetRef.current -= 1;
      return;
    }
    setLiveDraftOverride(null);
    setLiveBarSpecPatches({});
    setBarLaneRegenSeeds({ arp: Array(barCount).fill(0), bass: Array(barCount).fill(0) });
    setLanePartSeeds({ chords: 0, arp: 0, bass: 0, filler: 0 });
    setBarLaneUndo({});
  }, [liveDraftBaseKey, barCount]);

  const keyboardKeys = useMemo(() => {
    if (!activePreset || voiceSpecs.length === 0) return [];
    const n = Math.min(chordCount, voiceSpecs.length, editRomans.length || chordCount);
    const romans =
      editRomans.length >= n
        ? editRomans.slice(0, n)
        : activePreset.romans.slice(0, n);
    const labels = romans.map((r, i) => `${i + 1} · ${r}`);
    return se2SynthGenoLiveBuildProgressionKeyboard({
      romans,
      specs: voiceSpecs.slice(0, n).filter((s): s is GenoBarChordSpec => s != null),
      keyRoot: resolvedKey.keyRoot,
      chordMode: activePreset.mode,
      stylePreset: activePreset.stylePreset,
      genreId: activePreset.genreId,
      chordLabels: labels,
    });
  }, [activePreset, chordCount, editRomans, voiceSpecs, resolvedKey.keyRoot]);

  const soundSelection = useMemo(
    (): Se2SynthGenoPluginSoundSelection => ({
      accordBankId: se2SynthGenoSanitizeChordPianoBankId(accordBankId),
      melodyBankId: se2SynthGenoSanitizePluginMelodyBankId(melodyBankId),
      bassBankId: se2SynthGenoSanitizeSoundBankId('bass', bassBankId),
      fillerBankId: se2SynthGenoSanitizePluginFillerBankId(fillerBankId),
    }),
    [accordBankId, melodyBankId, bassBankId, fillerBankId],
  );

  const livePreviewOpts = useMemo(
    (): Se2SynthGenoPluginPreviewOpts => ({
      bassGlide,
      bpm: livePreviewBpm,
      chordGlide,
      fillerQuant,
      timelineBarCount: barCount,
      grooveLeadNotes: grooveLeadNotes.length > 0 ? grooveLeadNotes : undefined,
      grooveLeadTrackIndex: trackIndex,
      grooveLeadVoice: se2GrooveLeadB01Voice(),
      ...genoLanePreviewGainsToPreviewOpts(laneGains),
    }),
    [bassGlide, livePreviewBpm, chordGlide, barCount, grooveLeadNotes, trackIndex, fillerQuant, laneGains],
  );

  const restartLivePreviewWithSounds = useCallback(
    (sounds: Se2SynthGenoPluginSoundSelection) => {
      if (!liveDraftForPlayback || disabled) return;
      onStopPreview();
      void Promise.resolve(onPreviewDraft(liveDraftForPlayback, sounds, livePreviewOpts))
        .then(() => setLivePreviewing(true))
        .catch(() => setLivePreviewing(false));
    },
    [liveDraftForPlayback, disabled, onStopPreview, onPreviewDraft, livePreviewOpts],
  );

  const restartLivePreviewWithGlideOpts = useCallback(
    (opts: Partial<Pick<Se2SynthGenoPluginPreviewOpts, 'bassGlide' | 'chordGlide'>>) => {
      if (!liveDraftForPlayback || disabled) return;
      onStopPreview();
      void Promise.resolve(
        onPreviewDraft(liveDraftForPlayback, soundSelection, { ...livePreviewOpts, ...opts }),
      )
        .then(() => setLivePreviewing(true))
        .catch(() => setLivePreviewing(false));
    },
    [liveDraftForPlayback, disabled, onStopPreview, onPreviewDraft, soundSelection, livePreviewOpts],
  );

  const setBassGlideLive = useCallback(
    (on: boolean) => {
      setBassGlide(on);
      if (livePreviewing) restartLivePreviewWithGlideOpts({ bassGlide: on });
    },
    [livePreviewing, restartLivePreviewWithGlideOpts],
  );

  const setChordGlideLive = useCallback(
    (on: boolean) => {
      setChordGlide(on);
      if (livePreviewing) restartLivePreviewWithGlideOpts({ chordGlide: on });
    },
    [livePreviewing, restartLivePreviewWithGlideOpts],
  );

  const handleAccordBankChange = useCallback(
    (id: string) => {
      onAccordBankChange?.(id);
      if (livePreviewing) {
        restartLivePreviewWithSounds({
          ...soundSelection,
          accordBankId: se2SynthGenoSanitizeChordPianoBankId(id),
        });
      }
    },
    [onAccordBankChange, livePreviewing, restartLivePreviewWithSounds, soundSelection],
  );

  const handleMelodyBankChange = useCallback(
    (id: string) => {
      onMelodyBankChange?.(id);
      if (livePreviewing) {
        restartLivePreviewWithSounds({
          ...soundSelection,
          melodyBankId: se2SynthGenoSanitizePluginMelodyBankId(id),
        });
      }
    },
    [onMelodyBankChange, livePreviewing, restartLivePreviewWithSounds, soundSelection],
  );

  const handleBassBankChange = useCallback(
    (id: string) => {
      onBassBankChange?.(id);
      if (livePreviewing) {
        restartLivePreviewWithSounds({
          ...soundSelection,
          bassBankId: se2SynthGenoSanitizeSoundBankId('bass', id),
        });
      }
    },
    [onBassBankChange, livePreviewing, restartLivePreviewWithSounds, soundSelection],
  );

  const handleFillerBankChange = useCallback(
    (id: string) => {
      setFillerBankId(id);
      if (livePreviewing) {
        restartLivePreviewWithSounds({
          ...soundSelection,
          fillerBankId: se2SynthGenoSanitizePluginFillerBankId(id),
        });
      }
    },
    [setFillerBankId, livePreviewing, restartLivePreviewWithSounds, soundSelection],
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

  useEffect(() => () => onStopPreview(), [onStopPreview]);

  useEffect(() => {
    if (!livePreviewing) {
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
  }, [livePreviewing]);

  useEffect(() => {
    if (!expanded || !activePreset) return;
    if (activePresetId === activePreset.id && editSpecs.length > 0) return;
    applyPreset(activePreset);
  }, [expanded, activePreset, activePresetId, editSpecs.length, applyPreset]);

  const voicingForSlot = useCallback(
    (slotIndex: number | null): number[] => {
      if (!activePreset || slotIndex == null) return [];
      const spec = voiceSpecs[slotIndex];
      if (!spec) return [];
      return [
        ...se2SynthGenoVoiceLiveChord(
          resolvedKey.keyRoot,
          activePreset.mode,
          spec,
          activePreset.stylePreset,
          activePreset.extensions,
          activePreset.inversion,
          activePreset.genreId,
        ),
      ];
    },
    [activePreset, resolvedKey.keyRoot, voiceSpecs],
  );

  const playbackSlot = useMemo(() => {
    if (!livePreviewing || previewBeat == null) return null;
    return se2SynthGenoLiveSlotForPreviewBeat(
      previewBeat,
      beatsPerBar,
      barCount,
      playOrder,
      chordCount,
    );
  }, [livePreviewing, previewBeat, beatsPerBar, barCount, playOrder, chordCount]);

  const previewSlot = useMemo(() => {
    if (pressedSlot != null) return pressedSlot;
    if (livePreviewing) return playbackSlot;
    return activeSlot ?? playbackSlot ?? (editSpecs.length > 0 ? 0 : null);
  }, [pressedSlot, livePreviewing, playbackSlot, activeSlot, editSpecs.length]);

  const displayVoicingMidis = useMemo(
    () => (previewSlot != null ? voicingForSlot(previewSlot) : []),
    [previewSlot, voicingForSlot],
  );

  useEffect(() => {
    if (editSpecs.length === 0) return;
    const depths = editSpecs.map((s) => s.voicingDepth).filter((d): d is GenoVoicingDepth => d != null);
    if (depths.length > 0 && depths.every((d) => d === depths[0])) {
      setSelectedVoicingDepth(depths[0]!);
    }
  }, [activePreset?.id, editSpecs, genreId]);

  const releaseSlot = useCallback(() => {
    setPressedSlot(null);
  }, []);

  const playSlot = useCallback(
    (slotIndex: number) => {
      if (!activePreset || disabled || !slotEnabled[slotIndex]) return;
      if (livePreviewing && genreId !== 'drill') {
        onStopPreview();
        setLivePreviewing(false);
      }
      const tones = voicingForSlot(slotIndex);
      if (tones.length === 0) return;
      setActiveSlot(slotIndex);
      setPressedSlot(slotIndex);
      onPlayLiveChord(tones, soundSelection.accordBankId, {
        /** Pads always use the selected chord soundfont — glide/slide apply to loop preview only. */
        chordGlide: false,
        padTrigger: true,
        genreId,
      });
      if (livePreviewing && genreId === 'drill') {
        onStopPreview();
        setLivePreviewing(false);
      }
    },
    [
      activePreset,
      disabled,
      genreId,
      livePreviewing,
      onPlayLiveChord,
      onStopPreview,
      slotEnabled,
      soundSelection.accordBankId,
      voicingForSlot,
    ],
  );

  const applyAllVoicingDepth = useCallback((depth: GenoVoicingDepth) => {
    setSelectedVoicingDepth(depth);
    setEditSpecs((prev) => prev.map((spec) => ({ ...spec, voicingDepth: depth })));
    setLiveDraftOverride(null);
    if (livePreviewing) {
      onStopPreview();
      setLivePreviewing(false);
    }
  }, [livePreviewing, onStopPreview]);

  const pickVoicingDepth = useCallback(
    (depth: GenoVoicingDepth) => {
      applyAllVoicingDepth(depth);
    },
    [applyAllVoicingDepth],
  );

  const toggleSlot = useCallback((slotIndex: number) => {
    setSlotEnabled((prev) => {
      const next = [...prev];
      next[slotIndex] = !next[slotIndex];
      return next;
    });
  }, []);

  const setPlayOrderPosition = useCallback(
    (slotIndex: number, position: number) => {
      setPlayOrder((prev) => se2SynthGenoLiveSwapPlayOrder(prev, slotIndex, position, chordCount));
      setLiveDraftOverride(null);
      if (livePreviewing) {
        onStopPreview();
        setLivePreviewing(false);
      }
    },
    [chordCount, livePreviewing, onStopPreview],
  );

  const replaceSlotChord = useCallback(
    (fromSlotIndex: number, toSlotIndex: number) => {
      if (fromSlotIndex === toSlotIndex) return;
      const priorSpec = editSpecs[toSlotIndex];
      const priorRoman = editRomans[toSlotIndex];
      if (priorSpec && priorRoman) {
        setSlotReplaceUndo((prev) => ({
          ...prev,
          [toSlotIndex]: { spec: { ...priorSpec }, roman: priorRoman },
        }));
      }
      const replaced = se2SynthGenoLiveReplaceSlotChord(editSpecs, editRomans, fromSlotIndex, toSlotIndex);
      if (!replaced) return;
      setEditSpecs(replaced.specs);
      setEditRomans(replaced.romans);
      setLiveDraftOverride(null);
      if (livePreviewing) {
        onStopPreview();
        setLivePreviewing(false);
      }
    },
    [editRomans, editSpecs, livePreviewing, onStopPreview],
  );

  const undoReplaceSlot = useCallback(
    (slotIndex: number) => {
      const saved = slotReplaceUndo[slotIndex];
      if (!saved) return;
      setEditSpecs((prev) => {
        const next = [...prev];
        next[slotIndex] = { ...saved.spec };
        return next;
      });
      setEditRomans((prev) => {
        const next = [...prev];
        next[slotIndex] = saved.roman;
        return next;
      });
      setSlotReplaceUndo((prev) => {
        const next = { ...prev };
        delete next[slotIndex];
        return next;
      });
      setLiveDraftOverride(null);
      if (livePreviewing) {
        onStopPreview();
        setLivePreviewing(false);
      }
    },
    [livePreviewing, onStopPreview, slotReplaceUndo],
  );

  const canUndoReplace = useMemo(
    () => Array.from({ length: chordCount }, (_, i) => Boolean(slotReplaceUndo[i])),
    [chordCount, slotReplaceUndo],
  );

  const slotSubstitutes = useMemo(() => {
    if (!activePreset || chordCount === 0) return [];
    return Array.from({ length: chordCount }, (_, i) => {
      const roman = editRomans[i] ?? activePreset.romans[i] ?? 'I';
      return se2SynthGenoLiveSlotSubstituteOptions({
        slotIndex: i,
        currentRoman: roman,
        priorSpec: editSpecs[i],
        mode: activePreset.mode,
        genreId: activePreset.genreId,
        stylePreset: activePreset.stylePreset,
        keyRoot: resolvedKey.keyRoot,
      });
    });
  }, [activePreset, chordCount, editRomans, editSpecs, resolvedKey.keyRoot]);

  const applySlotSubstitute = useCallback(
    (slotIndex: number, optionId: string) => {
      const opt = slotSubstitutes[slotIndex]?.find((o) => o.id === optionId);
      if (!opt) return;
      const priorSpec = editSpecs[slotIndex];
      const priorRoman = editRomans[slotIndex];
      if (priorSpec && priorRoman) {
        setSlotReplaceUndo((prev) => ({
          ...prev,
          [slotIndex]: { spec: { ...priorSpec }, roman: priorRoman },
        }));
      }
      setEditSpecs((prev) => {
        const next = [...prev];
        next[slotIndex] = { ...opt.spec };
        return next;
      });
      setEditRomans((prev) => {
        const next = [...prev];
        next[slotIndex] = opt.roman;
        return next;
      });
      setLiveDraftOverride(null);
      if (livePreviewing) {
        onStopPreview();
        setLivePreviewing(false);
      }
    },
    [editRomans, editSpecs, livePreviewing, onStopPreview, slotSubstitutes],
  );

  const harmonyAnchorRoman = useMemo(() => {
    if (previewSlot == null) return null;
    return editRomans[previewSlot] ?? activePreset?.romans[previewSlot] ?? null;
  }, [previewSlot, editRomans, activePreset?.romans]);

  const harmonyAnchorLabel = useMemo(() => {
    if (previewSlot == null || !harmonyAnchorRoman) return undefined;
    const key = keyboardKeys.find((k) => k.slotIndex === previewSlot);
    return key ? `${key.triggerLabel} · ${harmonyAnchorRoman}` : harmonyAnchorRoman;
  }, [previewSlot, harmonyAnchorRoman, keyboardKeys]);

  const loopBarRomans = useMemo((): ChordSymbol[] => {
    if (!liveDraft || !activePreset || orderedSlotIndices.length === 0) return [];
    const loopLength = activePreset.loopLength;
    return Array.from({ length: barCount }, (_, bar) => {
      const slotIdx = orderedSlotIndices[bar % orderedSlotIndices.length];
      if (
        slotIdx != null
        && !se2SynthGenoLiveIsIndependentLoopBar(bar, barCount, loopLength)
      ) {
        return editRomans[slotIdx] ?? activePreset.romans[slotIdx] ?? ('I' as ChordSymbol);
      }
      const spec = effectiveBarSpecs?.[bar];
      if (spec?.degree != null) {
        return se2SynthGenoLiveRomanForDegree(spec.degree, activePreset.mode);
      }
      if (slotIdx != null) {
        return editRomans[slotIdx] ?? activePreset.romans[slotIdx] ?? ('I' as ChordSymbol);
      }
      return 'I' as ChordSymbol;
    });
  }, [
    liveDraft,
    activePreset,
    orderedSlotIndices,
    barCount,
    editRomans,
    effectiveBarSpecs,
  ]);

  const tailPassingOptions = useMemo(() => {
    if (tailFocusBar == null || loopBarRomans.length < 2) return [];
    return se2SynthGenoPassingOptionsForBar(tailFocusBar, loopBarRomans, effectiveScaleMode, {
      genreId: activePreset?.genreId,
      maxOptions: 14,
      includeClusters: true,
      loopWrap: true,
    });
  }, [tailFocusBar, loopBarRomans, effectiveScaleMode, activePreset?.genreId]);

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
      if (!activePreset) return;
      if (opt.livePresetId) {
        const livePreset = presets.find((p) => p.id === opt.livePresetId);
        if (livePreset) {
          applyPreset(livePreset);
          return;
        }
      }
      if (opt.eraPresetId) {
        const era = se2SynthGenoEraPresetById(opt.eraPresetId);
        if (!era) return;
        const len = Math.min(opt.romans.length, SE2_SYNTH_GENO_LIVE_ZONE_SIZE);
        setEditSpecs(era.chordSpecs.slice(0, len).map((s) => ({ ...s })));
        setEditRomans([...era.romans.slice(0, len)]);
        setPlayOrder(se2SynthGenoLiveDefaultPlayOrder(len));
        setSlotEnabled(Array.from({ length: 12 }, (_, i) => i < len));
        setLiveDraftOverride(null);
        setSlotReplaceUndo({});
        if (livePreviewing) {
          onStopPreview();
          setLivePreviewing(false);
        }
        return;
      }
      const len = Math.min(opt.romans.length, SE2_SYNTH_GENO_LIVE_ZONE_SIZE);
      const specs = opt.romans.slice(0, len).map((roman) =>
        se2SynthGenoLiveRomanToBarSpec(roman, activePreset.mode, activePreset.genreId),
      );
      setEditSpecs(specs);
      setEditRomans([...opt.romans.slice(0, len)]);
      setPlayOrder(se2SynthGenoLiveDefaultPlayOrder(len));
      setSlotEnabled(Array.from({ length: 12 }, (_, i) => i < len));
      setLiveDraftOverride(null);
      setSlotReplaceUndo({});
      if (livePreviewing) {
        onStopPreview();
        setLivePreviewing(false);
      }
    },
    [activePreset, applyPreset, livePreviewing, onStopPreview, presets],
  );

  const toggleLivePreview = useCallback(() => {
    if (livePreviewing) {
      onStopPreview();
      setLivePreviewing(false);
      return;
    }
    if (!liveDraftForPlayback || disabled) return;
    onStopPreview();
    setActiveSlot(null);
    setPressedSlot(null);
    setGenoPluginPreviewMixGains({ ...laneGains });
    void Promise.resolve(onPreviewDraft(liveDraftForPlayback, soundSelection, livePreviewOpts))
      .then(() => setLivePreviewing(true))
      .catch(() => setLivePreviewing(false));
  }, [liveDraftForPlayback, livePreviewing, disabled, onPreviewDraft, onStopPreview, soundSelection, livePreviewOpts, laneGains]);

  const applyLiveToPianoRoll = useCallback(() => {
    if (!liveDraft || disabled || !onApplyStack) return;
    onStopPreview();
    setLivePreviewing(false);
    const stack = se2SynthGenoBuildPluginApplyStack({
      draft: liveDraft,
      sounds: soundSelection,
      resolvedKey,
      beatsPerBar,
      bassGlide,
      chordGlide,
      bpm: livePreviewBpm,
      enableChords,
      enableMelody: enableArp,
      enableBass,
      enableFiller,
      fillerQuant,
    });
    if (stack.length === 0) return;
    onApplyStack(stack, liveDraft.bars, {
      keyRoot: resolvedKey.keyRoot,
      keyMode: resolvedKey.keyMode,
      chordBpm: livePreviewBpm,
      syncTransportBpm: syncBpmOnApply,
    });
  }, [
    liveDraft,
    disabled,
    onApplyStack,
    onStopPreview,
    soundSelection,
    resolvedKey,
    beatsPerBar,
    bassGlide,
    chordGlide,
    livePreviewBpm,
    syncBpmOnApply,
    enableChords,
    enableArp,
    enableBass,
    enableFiller,
    fillerQuant,
  ]);

  const applyLiveToAudio = useCallback(() => {
    if (!liveDraft || disabled || !onApplyAudio || applyingAudio) return;
    onStopPreview();
    setLivePreviewing(false);
    const draftForApply: Se2SynthGenoPluginDraft = {
      ...liveDraft,
      chordNotes: enableChords ? liveDraft.chordNotes : [],
      melodyNotes: enableArp ? liveDraft.melodyNotes : [],
      bassNotes: enableBass ? liveDraft.bassNotes : [],
      fillerNotes: enableFiller ? (liveDraft.fillerNotes ?? []) : [],
    };
    if (
      draftForApply.chordNotes.length === 0 &&
      draftForApply.melodyNotes.length === 0 &&
      draftForApply.bassNotes.length === 0 &&
      draftForApply.fillerNotes.length === 0
    ) {
      return;
    }
    setApplyingAudio(true);
    void Promise.resolve(
      onApplyAudio(draftForApply, soundSelection, genoPreviewOptsWithoutMixGains(livePreviewOpts)),
    )
      .catch((err) => console.warn('[Live Chord] audio apply failed:', err))
      .finally(() => setApplyingAudio(false));
  }, [
    liveDraft,
    disabled,
    onApplyAudio,
    applyingAudio,
    onStopPreview,
    soundSelection,
    livePreviewOpts,
    enableChords,
    enableArp,
    enableBass,
    enableFiller,
  ]);

  const onChordNotesChange = useCallback(
    (notes: StudioEditor2GenNote[]) => {
      const base = liveDraftOverride ?? liveDraftBase;
      if (!base) return;
      setLiveDraftOverride({ ...base, chordNotes: notes });
    },
    [liveDraftBase, liveDraftOverride],
  );

  const onBassNotesChange = useCallback(
    (notes: StudioEditor2GenNote[]) => {
      const base = liveDraftOverride ?? liveDraftBase;
      if (!base) return;
      setLiveDraftOverride({ ...base, bassNotes: notes });
    },
    [liveDraftBase, liveDraftOverride],
  );

  const onMelodyNotesChange = useCallback(
    (notes: StudioEditor2GenNote[]) => {
      const base = liveDraftOverride ?? liveDraftBase;
      if (!base) return;
      setLiveDraftOverride({ ...base, melodyNotes: notes });
    },
    [liveDraftBase, liveDraftOverride],
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
        if (livePreviewing) {
          onStopPreview();
          setLivePreviewing(false);
        }
      },
      onEditToolChange: setFillerEditTool,
    }),
    [fillerQuant, fillerEditTool, fillerSnapBeats, livePreviewing, onStopPreview],
  );

  const onFillerNotesChange = useCallback(
    (notes: StudioEditor2GenNote[]) => {
      const base = liveDraftOverride ?? liveDraftBase;
      if (!base) return;
      const normalized = genoNormalizePluginFillerNotes(notes, beatsPerBar, barCount, fillerSnapBeats);
      setLiveDraftOverride({ ...base, fillerNotes: normalized });
    },
    [liveDraftBase, liveDraftOverride, beatsPerBar, barCount, fillerSnapBeats],
  );

  const captureChordLoopUndo = useCallback(() => {
    if (chordUndoRestoreRef.current) return;
    const base = liveDraftOverride ?? liveDraftBase;
    if (!base) return;
    setChordLoopUndo((prev) =>
      genoPushChordLoopUndoStack(prev, {
        chordNotes: base.chordNotes,
        editSpecs: editSpecs.map((s) => ({ ...s })),
        liveBarSpecPatches: { ...liveBarSpecPatches },
      }),
    );
  }, [editSpecs, liveBarSpecPatches, liveDraftBase, liveDraftOverride]);

  const undoChordLoopEdit = useCallback(() => {
    const base = liveDraftOverride ?? liveDraftBase;
    if (!base) return;
    const { snapshot, stack } = genoPopChordLoopUndoStack(chordLoopUndo);
    if (!snapshot) return;
    setChordLoopUndo(stack ?? []);
    skipDraftResetRef.current += 1;
    chordUndoRestoreRef.current = true;
    if (snapshot.editSpecs) setEditSpecs(snapshot.editSpecs.map((s) => ({ ...s })));
    if (snapshot.liveBarSpecPatches) setLiveBarSpecPatches({ ...snapshot.liveBarSpecPatches });
    setLiveDraftOverride({ ...base, chordNotes: snapshot.chordNotes });
    chordUndoRestoreRef.current = false;
    if (livePreviewing) {
      onStopPreview();
      setLivePreviewing(false);
    }
  }, [chordLoopUndo, liveDraftBase, liveDraftOverride, livePreviewing, onStopPreview]);

  const insertPassingAtBar = useCallback(
    (bar: number, opt: GenoPassingChordOption) => {
      const base = effectiveBarSpecs;
      if (!base) return;
      captureChordLoopUndo();
      const next = se2SynthGenoLiveInsertPassingAfterBar(base, bar, opt);
      if (!next) return;
      setLiveBarSpecPatches((prev) => ({
        ...prev,
        [bar]: next[bar]!,
      }));
      setTailFocusBar(bar);
      setLiveDraftOverride(null);
      if (livePreviewing) {
        onStopPreview();
        setLivePreviewing(false);
      }
    },
    [captureChordLoopUndo, effectiveBarSpecs, livePreviewing, onStopPreview],
  );

  const regenLivePart = useCallback(
    (part: 'chords' | 'arp' | 'bass' | 'filler') => {
      const base = liveDraftOverride ?? liveDraftBase;
      if (!base || !regenContext) return;
      if (part === 'chords') captureChordLoopUndo();
      setLaneRegenUndo((prev) => ({
        ...prev,
        arp:
          part === 'arp'
            ? genoPushLaneRegenStack(prev.arp, base.melodyNotes)
            : prev.arp,
        bass:
          part === 'bass'
            ? genoPushLaneRegenStack(prev.bass, base.bassNotes)
            : prev.bass,
        filler:
          part === 'filler'
            ? genoPushLaneRegenStack(prev.filler, base.fillerNotes ?? [])
            : prev.filler,
      }));
      const nextLaneSeed = lanePartSeeds[part] + 1;
      const updated = se2SynthGenoLiveRegenerateLanePart(base, part, nextLaneSeed, regenContext);
      const patched: Se2SynthGenoPluginDraft = {
        ...updated,
        chordNotes: part === 'chords' ? updated.chordNotes : base.chordNotes,
        melodyNotes: part === 'arp' ? updated.melodyNotes : base.melodyNotes,
        bassNotes: part === 'bass' ? updated.bassNotes : base.bassNotes,
        fillerNotes: part === 'filler' ? (updated.fillerNotes ?? []) : (base.fillerNotes ?? []),
        harmony: part === 'chords' ? updated.harmony : base.harmony,
      };
      setLanePartSeeds((prev) => ({ ...prev, [part]: nextLaneSeed }));
      setLiveDraftOverride(patched);
      if (livePreviewing) {
        onStopPreview();
        setLivePreviewing(false);
      }
    },
    [captureChordLoopUndo, liveDraftBase, liveDraftOverride, lanePartSeeds, livePreviewing, onStopPreview, regenContext],
  );

  const undoLiveLaneRegen = useCallback(
    (part: 'chords' | 'arp' | 'bass' | 'filler') => {
      const base = liveDraftOverride ?? liveDraftBase;
      if (!base) return;
      const stack =
        part === 'chords'
          ? laneRegenUndo.chords
          : part === 'arp'
            ? laneRegenUndo.arp
            : part === 'bass'
              ? laneRegenUndo.bass
              : laneRegenUndo.filler;
      const { notes: saved, stack: rest } = genoPopLaneRegenStack(stack);
      if (!saved) return;
      const patched: Se2SynthGenoPluginDraft = {
        ...base,
        chordNotes: part === 'chords' ? saved : base.chordNotes,
        melodyNotes: part === 'arp' ? saved : base.melodyNotes,
        bassNotes: part === 'bass' ? saved : base.bassNotes,
        fillerNotes: part === 'filler' ? saved : (base.fillerNotes ?? []),
      };
      setLiveDraftOverride(patched);
      setLaneRegenUndo((prev) => ({
        ...prev,
        chords: part === 'chords' ? rest : prev.chords,
        arp: part === 'arp' ? rest : prev.arp,
        bass: part === 'bass' ? rest : prev.bass,
        filler: part === 'filler' ? rest : prev.filler,
      }));
      if (livePreviewing) {
        onStopPreview();
        setLivePreviewing(false);
      }
    },
    [laneRegenUndo, liveDraftBase, liveDraftOverride, livePreviewing, onStopPreview],
  );

  const regenLiveBarLane = useCallback(
    (bar: number, part: Se2SynthGenoLiveBarLanePart) => {
      const base = liveDraftOverride ?? liveDraftBase;
      if (!base || !regenContext) return;
      const undoKey = se2SynthGenoLiveBarLaneUndoKey(part, bar);
      const notesField = part === 'arp' ? base.melodyNotes : base.bassNotes;
      setBarLaneUndo((prev) => ({
        ...prev,
        [undoKey]: genoNotesInBar(notesField, bar, beatsPerBar),
      }));
      const nextBarSeed = (barLaneRegenSeeds[part][bar] ?? 0) + 1;
      const patch = se2SynthGenoLiveRegenerateBarLane(base, bar, part, nextBarSeed, regenContext);
      setBarLaneRegenSeeds((prev) => {
        const next = { ...prev, [part]: [...prev[part]] };
        next[part][bar] = nextBarSeed;
        return next;
      });
      setLiveDraftOverride({ ...base, ...patch });
      if (livePreviewing) {
        onStopPreview();
        setLivePreviewing(false);
      }
    },
    [
      barLaneRegenSeeds,
      beatsPerBar,
      liveDraftBase,
      liveDraftOverride,
      livePreviewing,
      onStopPreview,
      regenContext,
    ],
  );

  const undoLiveBarLane = useCallback(
    (bar: number, part: Se2SynthGenoLiveBarLanePart) => {
      const base = liveDraftOverride ?? liveDraftBase;
      if (!base) return;
      const undoKey = se2SynthGenoLiveBarLaneUndoKey(part, bar);
      const saved = barLaneUndo[undoKey];
      if (!saved) return;
      const patch = se2SynthGenoLiveUndoBarLane(base, bar, part, saved, beatsPerBar);
      setLiveDraftOverride({ ...base, ...patch });
      setBarLaneUndo((prev) => {
        const next = { ...prev };
        delete next[undoKey];
        return next;
      });
      if (livePreviewing) {
        onStopPreview();
        setLivePreviewing(false);
      }
    },
    [barLaneUndo, beatsPerBar, liveDraftBase, liveDraftOverride, livePreviewing, onStopPreview],
  );

  const canUndoBarLane = useCallback(
    (bar: number, part: Se2SynthGenoLiveBarLanePart) =>
      Boolean(barLaneUndo[se2SynthGenoLiveBarLaneUndoKey(part, bar)]?.length),
    [barLaneUndo],
  );

  const onBarDegreeChange = useCallback(
    (bar: number, degree: number) => {
      if (!activePreset || !tiledBarSpecs) return;
      captureChordLoopUndo();
      setSelectedBar(bar);
      const loopLength = activePreset.loopLength;
      const rebuildOpts = (prior: GenoBarChordSpec) =>
        se2SynthGenoLiveRebuildSpecForDegree(
          degree,
          activePreset.mode,
          activePreset.genreId,
          {
            voicingDepth: prior.voicingDepth,
            chopQuant: prior.chopQuant,
            inversion: prior.inversion,
          },
        );
      if (se2SynthGenoLiveIsIndependentLoopBar(bar, barCount, loopLength)) {
        setLiveBarSpecPatches((prev) => {
          const prior = prev[bar] ?? tiledBarSpecs[bar] ?? { degree: 0 };
          return {
            ...prev,
            [bar]: {
              ...rebuildOpts(prior),
              passingTail: prior.passingTail,
            },
          };
        });
      } else {
        const slotIdx = orderedSlotIndices[bar % orderedSlotIndices.length];
        if (slotIdx == null || slotIdx < 0) return;
        const fallbackRoman =
          editRomans[slotIdx] ?? activePreset.romans[slotIdx] ?? ('I' as ChordSymbol);
        const fallbackSpec =
          tiledBarSpecs[bar]
          ?? se2SynthGenoLiveRomanToBarSpec(fallbackRoman, activePreset.mode, activePreset.genreId);
        setEditSpecs((prev) => {
          if (prev.length === 0 || orderedSlotIndices.length === 0) return prev;
          const prior = prev[slotIdx] ?? fallbackSpec;
          const next = [...prev];
          next[slotIdx] = rebuildOpts(prior);
          return next;
        });
        setEditRomans((prev) => {
          const next = [...prev];
          next[slotIdx] = se2SynthGenoLiveRomanForDegree(degree, activePreset.mode);
          return next;
        });
      }
      setLiveDraftOverride(null);
      if (livePreviewing) onStopPreview();
      setLivePreviewing(false);
    },
    [
      activePreset,
      barCount,
      captureChordLoopUndo,
      editRomans,
      livePreviewing,
      onStopPreview,
      orderedSlotIndices,
      tiledBarSpecs,
    ],
  );

  const onBarChopQuantChange = useCallback(
    (bar: number, chopQuant: GenoBarChopQuant) => {
      if (!activePreset || !tiledBarSpecs) return;
      captureChordLoopUndo();
      setSelectedBar(bar);
      const loopLength = activePreset.loopLength;
      if (se2SynthGenoLiveIsIndependentLoopBar(bar, barCount, loopLength)) {
        setLiveBarSpecPatches((prev) => {
          const prior = prev[bar] ?? tiledBarSpecs[bar] ?? { degree: 0 };
          return {
            ...prev,
            [bar]: { ...prior, chopQuant },
          };
        });
      } else {
        const slotIdx = orderedSlotIndices[bar % orderedSlotIndices.length];
        if (slotIdx == null || slotIdx < 0) return;
        setEditSpecs((prev) => {
          if (prev.length === 0 || orderedSlotIndices.length === 0) return prev;
          const prior = prev[slotIdx] ?? tiledBarSpecs[bar] ?? { degree: 0 };
          const next = [...prev];
          next[slotIdx] = { ...prior, chopQuant };
          return next;
        });
      }
      setLiveDraftOverride(null);
      if (livePreviewing) onStopPreview();
      setLivePreviewing(false);
    },
    [activePreset, barCount, captureChordLoopUndo, livePreviewing, onStopPreview, orderedSlotIndices, tiledBarSpecs],
  );

  const loadIntoGenerator = useCallback(() => {
    if (!activePreset || !onLoadPreset || orderedSpecs.length === 0) return;
    onStopPreview();
    setLivePreviewing(false);
    onLoadPreset(
      se2SynthGenoLivePresetFromUserEdits({
        base: activePreset,
        editSpecs,
        editRomans,
        orderedSlotIndices,
      }),
    );
  }, [activePreset, editRomans, editSpecs, onLoadPreset, onStopPreview, orderedSlotIndices, orderedSpecs.length]);

  const minimizeBuild = useCallback(() => {
    onStopPreview();
    setLivePreviewing(false);
    setExpanded(false);
  }, [onStopPreview, setExpanded]);

  const canLockGrooveLead = useMemo(() => {
    if (!activePreset || orderedSlotIndices.length === 0) return false;
    const built = se2SynthGenoBuildHarmonySteps({
      build: 'b01',
      activePreset,
      editRomans,
      orderedSlotIndices,
      slotEnabled,
      barCount,
      keyRoot: resolvedKey.keyRoot,
      keyMode: resolvedKey.keyMode,
      harmonyScaleMode,
      beatsPerBar,
      bpm,
      liveDraft,
      barChordSpecs: effectiveBarSpecs,
      melodySeed: seed,
    });
    return !('message' in built);
  }, [
    activePreset,
    orderedSlotIndices,
    editRomans,
    slotEnabled,
    barCount,
    resolvedKey.keyRoot,
    resolvedKey.keyMode,
    harmonyScaleMode,
    beatsPerBar,
    bpm,
    liveDraft,
    effectiveBarSpecs,
    seed,
  ]);

  const lockGrooveLead = useCallback(() => {
    if (!onLockGrooveLead || !activePreset) return;
    onLockGrooveLead({
      build: 'b01',
      activePreset,
      editRomans,
      orderedSlotIndices,
      slotEnabled,
      barCount,
      keyRoot: resolvedKey.keyRoot,
      keyMode: resolvedKey.keyMode,
      harmonyScaleMode,
      beatsPerBar,
      bpm,
      liveDraft: liveDraftForPlayback ?? liveDraft,
      barChordSpecs: effectiveBarSpecs,
      melodySeed: seed,
      grooveLeadNotes: [...grooveLeadNotes],
    });
  }, [
    onLockGrooveLead,
    activePreset,
    editRomans,
    orderedSlotIndices,
    slotEnabled,
    barCount,
    resolvedKey.keyRoot,
    resolvedKey.keyMode,
    harmonyScaleMode,
    beatsPerBar,
    bpm,
    liveDraft,
    liveDraftForPlayback,
    effectiveBarSpecs,
    seed,
    grooveLeadNotes,
  ]);

  const onLoopBarCountChange = useCallback(
    (next: GenoLoopBarCount) => {
      setBarCount(next);
      setLiveDraftOverride(null);
      if (livePreviewing) {
        onStopPreview();
        setLivePreviewing(false);
      }
    },
    [livePreviewing, onStopPreview],
  );

  const chip = (active: boolean, onClick: () => void, label: string, color?: string) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded border px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-wide disabled:opacity-40 shrink-0"
      style={{
        borderColor: active ? `${color ?? accentHex}88` : '#3a3a48',
        background: active ? `${color ?? accentHex}22` : 'transparent',
        color: active ? (color ?? accentHex) : '#b8b8c8',
      }}
    >
      {label}
    </button>
  );

  if (!expanded) {
    return (
      <div
        className="w-full rounded-lg border px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        style={{
          borderColor: `${accentHex}44`,
          background: `linear-gradient(180deg, ${accentHex}10 0%, transparent 100%)`,
        }}
      >
        <div className="flex flex-col min-w-0">
          <span className="text-[9px] font-black uppercase tracking-[0.14em]" style={{ color: accentHex }}>
            {SE2_SYNTH_GENO_BUILD_1_LABEL}
          </span>
          <span className="text-[8px] opacity-65 leading-relaxed">
            Play & preview full progressions — 12-key mouse pad, loop preview with chords, arp & bass.
          </span>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setExpanded(true)}
          className="shrink-0 self-start sm:self-center rounded-md border px-2.5 py-1 text-[8px] font-bold uppercase tracking-wide disabled:opacity-40 flex items-center gap-1"
          style={{ borderColor: `${accentHex}66`, color: accentHex, background: `${accentHex}12` }}
        >
          <span aria-hidden className="text-[10px] leading-none">
            →
          </span>
          Open
        </button>
      </div>
    );
  }

  return (
    <>
      <Se2SynthGenoBuildFullscreenPlaceholder accentHex={accentHex} label={SE2_SYNTH_GENO_BUILD_1_LABEL} />
      <Se2SynthGenoBuildFullscreenFrame
        expanded={expanded}
        accentHex={accentHex}
        label={SE2_SYNTH_GENO_BUILD_1_LABEL}
        subtitle={
          <>
            Pick a vibe, preview the full {barCount}-bar loop (chords + arp + bass), edit bars in the loop strip,
            and play individual chords on the 12-key pad — no MIDI keyboard required.
          </>
        }
        disabled={disabled}
        onMinimize={minimizeBuild}
      >
      <Se2SynthGenoLiveGenreLibrary
        accentHex={accentHex}
        disabled={disabled}
        genreId={genreId}
        activePresetId={activePresetId}
        onGenreChange={onGenreChange}
        onSelect={applyPreset}
      />

      {activePreset && liveDraft ? (
        <>
          <div className="px-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[8px] font-mono truncate flex-1" style={{ color: '#a8a8b8' }} title={activePreset.romanLine}>
              {activePreset.romanLine}
            </p>
            <div className="flex flex-wrap gap-3 shrink-0 items-center">
              {onApplyStack ? (
                <Se2SynthGenoSyncBpmChip
                  chordBpm={livePreviewBpm}
                  enabled={syncBpmOnApply}
                  onToggle={() => setSyncBpmOnApply((v) => !v)}
                  disabled={disabled || !liveDraft}
                  accentHex="#86efac"
                />
              ) : null}
              {onLoadPreset ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={loadIntoGenerator}
                  className="rounded-md border px-3 py-1.5 text-[8px] font-bold uppercase tracking-wide disabled:opacity-40 whitespace-nowrap"
                  style={{ borderColor: '#22c55e66', background: '#22c55e14', color: '#86efac' }}
                >
                  Load into {SE2_SYNTH_GENO_BUILD_2_LABEL}
                </button>
              ) : null}
              {onApplyStack ? (
                <button
                  type="button"
                  disabled={disabled || !liveDraft}
                  onClick={applyLiveToPianoRoll}
                  className="rounded-md border px-3 py-1.5 text-[8px] font-black uppercase tracking-wide disabled:opacity-40 whitespace-nowrap"
                  style={{ borderColor: '#22c55e88', background: '#22c55e18', color: '#86efac' }}
                >
                  Apply MIDI
                </button>
              ) : null}
              {onApplyAudio ? (
                <button
                  type="button"
                  disabled={disabled || !liveDraft || applyingAudio}
                  onClick={applyLiveToAudio}
                  className="rounded-md border px-3 py-1.5 text-[8px] font-bold uppercase tracking-wide disabled:opacity-40 whitespace-nowrap"
                  style={{ borderColor: `${accentHex}88`, background: `${accentHex}18`, color: accentHex }}
                >
                  {applyingAudio ? 'Rendering…' : 'Apply Audio'}
                </button>
              ) : null}
              {onLockGrooveLead ? (
                <button
                  type="button"
                  disabled={disabled || !canLockGrooveLead}
                  onClick={lockGrooveLead}
                  className="rounded-md border px-3 py-1.5 text-[8px] font-black uppercase tracking-wide disabled:opacity-40 whitespace-nowrap"
                  style={{ borderColor: '#7cf4c688', background: '#14221c', color: '#7cf4c6' }}
                  title="Create or update a Groove Lead lane locked to this Geno progression"
                >
                  Lock Groove Lead
                </button>
              ) : null}
            </div>
          </div>

          <div
            className="mx-3 rounded-lg border px-3 py-2.5 flex flex-col gap-3 overflow-visible relative z-20"
            style={{ borderColor: '#2a2a38', background: 'rgba(255,255,255,0.03)' }}
          >
            <div
              className="flex flex-wrap gap-1 items-center overflow-visible pb-2 border-b -mx-0.5 px-0.5"
              style={{ borderColor: 'rgba(42,42,56,0.65)' }}
            >
              {chip(enableChords, () => setEnableChords((v) => !v), 'Chords', accentHex)}
              {chip(enableArp, () => setEnableArp((v) => !v), 'Melody', '#a78bfa')}
              {chip(enableBass, () => setEnableBass((v) => !v), 'Bass', '#fbbf24')}
              {chip(enableFiller, () => setEnableFiller((v) => !v), 'Note Filler', '#38bdf8')}
              <span className="w-px h-3.5 bg-white/10 mx-0.5 shrink-0" aria-hidden />
              <Se2SynthGenoLaneSoundStripGroup>
                <div className="flex flex-wrap items-end gap-1 origin-left scale-[0.92]">
                  <Se2SynthGenoChordPianoStrip
                    stripId="live-chord-piano"
                    accentHex={accentHex}
                    disabled={disabled}
                    selectedId={soundSelection.accordBankId}
                    onSelect={handleAccordBankChange}
                  />
                  <Se2SynthGenoLaneSoundStrip
                    stripId="live-chord-arp"
                    accentHex="#a78bfa"
                    disabled={disabled}
                    label="Arpeggio"
                    panelButtonLabel="Sounds"
                    panelTitle="Arpeggio · piano &amp; plucks"
                    entries={arpSoundEntries}
                    selectedId={soundSelection.melodyBankId}
                    onSelect={handleMelodyBankChange}
                    sanitizeId={se2SynthGenoSanitizePluginMelodyBankId}
                    showSoundGrid
                  />
                  <Se2SynthGenoLaneSoundStrip
                    stripId="live-chord-bass"
                    accentHex="#fbbf24"
                    disabled={disabled}
                    label="Bass"
                    panelButtonLabel="Filter"
                    panelTitle="Bass · filter"
                    entries={bassSoundEntries}
                    selectedId={soundSelection.bassBankId}
                    onSelect={handleBassBankChange}
                    sanitizeId={(id) => se2SynthGenoSanitizeSoundBankId('bass', id)}
                  />
                  {enableFiller ? (
                    <Se2SynthGenoLaneSoundStrip
                      stripId="live-chord-filler"
                      accentHex="#38bdf8"
                      disabled={disabled}
                      label="Note Filler"
                      panelButtonLabel="Sounds"
                      panelTitle="Note Filler · piano &amp; plucks"
                      entries={se2SynthGenoFillerLaneSoundEntries()}
                      selectedId={soundSelection.fillerBankId}
                      onSelect={handleFillerBankChange}
                      sanitizeId={se2SynthGenoSanitizePluginFillerBankId}
                      showSoundGrid
                    />
                  ) : null}
                </div>
              </Se2SynthGenoLaneSoundStripGroup>
            </div>
            <Se2SynthGenoLiveDualKeyboard
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
              playbackSlot={livePreviewing ? playbackSlot : null}
              loopPreviewActive={livePreviewing}
              onTogglePreview={toggleLivePreview}
              previewing={livePreviewing}
              previewDisabled={disabled || !liveDraft}
            />
            <Se2SynthGenoHarmonyIntelStrip
              accentHex={accentHex}
              disabled={disabled}
              scaleMode={effectiveScaleMode}
              onScaleModeChange={setHarmonyScaleMode}
              anchorRoman={harmonyAnchorRoman}
              anchorLabel={harmonyAnchorLabel}
              romans={editRomans.length > 0 ? editRomans : (activePreset?.romans ?? [])}
              playOrder={playOrder}
              genreId={activePreset?.genreId}
              onApplyAnchorProgression={applyAnchorProgression}
              focusedSlotIndex={previewSlot}
            />

          </div>

          <div className="mx-3">
            <Se2SynthGenoPluginLoopView
              draft={liveDraft}
              beatsPerBar={beatsPerBar}
              timelineBarCount={barCount}
              loopBarCount={barCount}
              onLoopBarCountChange={onLoopBarCountChange}
              previewBeat={livePreviewing ? previewBeat : null}
              previewing={livePreviewing}
              onTogglePreview={toggleLivePreview}
              previewDisabled={!liveDraft}
              voicingDepth={{
                selected: selectedVoicingDepth,
                options: DEPTH_OPTIONS,
                onPick: pickVoicingDepth,
              }}
              styleSelect={{
                value: genreId,
                options: SE2_SYNTH_GENO_LIVE_GENRES.map((g) => ({ id: g.id, label: g.label })),
                onChange: (id) => onGenreChange(id as Se2SynthGenoLiveGenreId),
              }}
              keyRoot={resolvedKey.keyRoot}
              keyMode={resolvedKey.keyMode as StudioDetectedKeyMode}
              accentHex={accentHex}
              showChords={enableChords}
              showMelody={enableArp}
              showBass={enableBass}
              showFiller={enableFiller}
              melodyLaneLabel="Arpeggio"
              selectedBar={selectedBar}
              disabled={disabled}
              barChordSpecs={effectiveBarSpecs}
              onBarDegreeChange={onBarDegreeChange}
              onBarChopQuantChange={onBarChopQuantChange}
              onChordNotesChange={onChordNotesChange}
              onBassNotesChange={onBassNotesChange}
              onMelodyNotesChange={onMelodyNotesChange}
              onFillerNotesChange={onFillerNotesChange}
              arpControls={
                enableArp
                  ? {
                      pattern: arpPattern,
                      rate: arpRate,
                      onPatternChange: (id) => {
                        setArpPattern(id);
                        if (livePreviewing) {
                          onStopPreview();
                          setLivePreviewing(false);
                        }
                      },
                      onRateChange: (id) => {
                        setArpRate(id);
                        if (livePreviewing) {
                          onStopPreview();
                          setLivePreviewing(false);
                        }
                      },
                    }
                  : undefined
              }
              chordGlideControls={
                enableChords
                  ? {
                      glideOn: chordGlide,
                      onGlideOn: () => setChordGlideLive(true),
                      onGlideOff: () => setChordGlideLive(false),
                    }
                  : undefined
              }
              bassGlideControls={
                enableBass
                  ? {
                      glideOn: bassGlide,
                      onGlideOn: () => setBassGlideLive(true),
                      onGlideOff: () => setBassGlideLive(false),
                      slideOn: bassGlide,
                      onSlideOn: () => setBassGlideLive(true),
                      onSlideOff: () => setBassGlideLive(false),
                    }
                  : undefined
              }
              tailInsert={
                liveDraft && enableChords
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
              fillerControls={enableFiller ? fillerControls : undefined}
              chordLane={{
                enabled: enableChords,
                hasNotes: (liveDraft?.chordNotes.length ?? 0) > 0,
                onToggle: () => setEnableChords((v) => !v),
                onClear: () => setEnableChords(false),
                onRegen: () => regenLivePart('chords'),
                canUndoRegen: genoChordLoopStackCanUndo(chordLoopUndo),
                onUndoRegen: undoChordLoopEdit,
              }}
              melodyLane={{
                enabled: enableArp,
                hasNotes: (liveDraft?.melodyNotes.length ?? 0) > 0,
                onToggle: () => setEnableArp((v) => !v),
                onClear: () => setEnableArp(false),
                onRegen: () => regenLivePart('arp'),
                canUndoRegen: genoLaneRegenStackCanUndo(laneRegenUndo.arp),
                onUndoRegen: () => undoLiveLaneRegen('arp'),
              }}
              bassLane={{
                enabled: enableBass,
                hasNotes: (liveDraft?.bassNotes.length ?? 0) > 0,
                onToggle: () => setEnableBass((v) => !v),
                onClear: () => setEnableBass(false),
                onRegen: () => regenLivePart('bass'),
              }}
              fillerLane={{
                enabled: enableFiller,
                hasNotes: (liveDraft?.fillerNotes?.length ?? 0) > 0,
                onToggle: () => setEnableFiller((v) => !v),
                onClear: () => setEnableFiller(false),
                onRegen: () => regenLivePart('filler'),
                canUndoRegen: genoLaneRegenStackCanUndo(laneRegenUndo.filler),
                onUndoRegen: () => undoLiveLaneRegen('filler'),
              }}
              laneVolumes={laneVolumes}
            />
          </div>
          {onGrooveLeadNotesChange ? (
            <div className="mt-2 mb-6 shrink-0">
              <Se2SynthGenoGrooveLeadDock
                open={grooveLeadDockOpen}
                onOpenChange={onGrooveLeadDockOpenChange ?? (() => {})}
                grooveLeadNotes={grooveLeadNotes}
                onGrooveLeadNotesChange={onGrooveLeadNotesChange}
                draft={liveDraft}
                beatsPerBar={beatsPerBar}
                timelineBarCount={barCount}
                keyRoot={resolvedKey.keyRoot}
                keyMode={resolvedKey.keyMode}
                harmonyScaleMode={harmonyScaleMode}
                barChordSpecs={effectiveBarSpecs}
                bpm={livePreviewBpm}
                disabled={disabled}
                previewBeat={livePreviewing ? previewBeat : null}
                onLockToTrack={onLockGrooveLead ? lockGrooveLead : undefined}
                canLockToTrack={canLockGrooveLead}
                getAudioContext={getAudioContext}
                getPreviewDestination={getGrooveLeadPreviewDestination}
                trackIndex={trackIndex}
                genoBuild="b01"
                onStopPreview={onStopPreview}
                loopPreviewing={livePreviewing && grooveLeadNotes.length > 0}
                previewGain={laneGains.grooveLead}
                onPreviewGainChange={handleGrooveLeadGainChange}
              />
            </div>
          ) : null}
        </>
      ) : null}
      </Se2SynthGenoBuildFullscreenFrame>
    </>
  );
}

/** @deprecated Use Se2SynthGenoLiveChordPanel */
export const Se2SynthGenoLiveChordColumn = Se2SynthGenoLiveChordPanel;
