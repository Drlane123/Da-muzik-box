'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { BeatLabDefaultKitsButton } from '@/app/components/creation/BeatLabDefaultKitsButton';
import { BeatPadsSavedSessionsButton } from '@/app/components/creation/BeatPadsSavedSessionsButton';
import { SoundFamiliesBar } from '@/app/components/creation/SoundFamiliesBar';
import { useBeatPadsLocalTransport } from '@/app/hooks/useBeatPadsLocalTransport';
import type { Se2BeatPadsSe2SyncMode } from '@/app/lib/studio/se2BeatPadsTrack';
import { resetBeatPadsPlaylineToStart, BEAT_PADS_GRID_COL_W, setBeatPadsPlaylineAtCol } from '@/app/lib/creationStation/beatPadsPlaylineWapi';
import { pointerStrikeVelocity } from '@/app/lib/creationStation/eightZeroEightVoice';
import { BeatLabDrumMachineSequencer } from '@/app/components/creation/BeatLabDrumMachineSequencer';
import { BeatPadsPatternBankSidebar } from '@/app/components/creation/BeatPadsPatternBankSidebar';
import { BeatPadsVocalBoxPanel, BEAT_PADS_VOCALBOX_MIC_SRC, BEAT_PADS_VOCALBOX_MIC_STYLE, BEAT_PADS_VOCALBOX_TAGLINE, BEAT_PADS_VOCALBOX_PANEL_H_PX } from '@/app/components/creation/BeatPadsVocalBoxPanel';
import { BeatPads808LabPanel, BEAT_PADS_808_LAB_ACCENT } from '@/app/components/creation/BeatPads808LabPanel';
import {
  BeatPadsOrchHitsPanel,
  BEAT_PADS_ORCH_HITS_ACCENT,
} from '@/app/components/creation/BeatPadsOrchHitsPanel';
import type { Se2Lab808ChordLockHarmonyTrack } from '@/app/lib/studio/se2Lab808ChordLock';
import type { Se2Lab808ToneGridRollNote } from '@/app/lib/studio/se2Lab808ToneGridExport';
import type { Se2Lab808VoiceParams } from '@/app/lib/studio/se2Lab808Types';
import { SE2_LAB808_DOCK_TECH_LABEL } from '@/app/lib/studio/se2Lab808UiTheme';
import type { BeatPadsOrchHitsVoice } from '@/app/lib/studio/se2BeatPadsOrchHitsVoice';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  BeatLabDrumMachineFxPanel,
} from '@/app/components/creation/BeatLabDrumMachinePadSidePanels';
import {
  BeatLabPadSampleFxWaveform,
  PAD_FX_SCOPE_ROW_H,
  type BeatLabPadSampleFxWaveformProps,
} from '@/app/components/creation/BeatLabPadSampleFxWaveform';
import {
  beatLabDrumPadNoteRepeatIntervalSec,
  beatLabDrumPadNoteRepeatGridSteps,
  beatLabDrumPadNoteRepeatRollLabel,
  type BeatLabDrumPadVoiceOpts,
} from '@/app/lib/creationStation/beatLabDrumPadVoice';
import {
  beatPadsConvertPatternGridSteps,
  clearBeatPadsLane,
} from '@/app/lib/creationStation/beatPadsPatternEdit';
import type { PadSamplerFxRack } from '@/app/lib/creationStation/padSamplerFxRack';
import type { PadSamplerPlaybackOpts } from '@/app/lib/padSampleStorage';
import {
  BEAT_LAB_PRODUCER_KITS,
  type BeatLabProducerKitId,
} from '@/app/lib/creationStation/beatLabProducerKits';
import {
  lab808PadAccentFromLabel,
  lab808PadBorder,
  lab808PadSurface,
} from '@/app/lib/creationStation/lab808PadColors';
import {
  BEAT_PADS_DEFAULT_LOOP_BARS,
  beatPadsPatternBankKey,
  beatPadsPatternCols,
  clampBeatPadsBpm,
  emptyBeatPadsPattern,
  loadBeatPadsBpmStore,
  loadBeatPadsPatternStore,
  normalizeBeatPadsPattern,
  resizeBeatPadsPattern,
  saveBeatPadsBpmStore,
  saveBeatPadsPatternStore,
  type BeatPadsDrumPattern,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import {
  presetToBeatPadsPattern,
  type BeatLabPatternBankId,
  type BeatLabPatternSlotId,
} from '@/app/lib/creationStation/beatLabPatternBank';
import {
  applyBeatPadsLanePlacementTemplate,
  beatPadsDrumRoleFromLabel,
  getBeatPadsLaneTemplateById,
  type BeatPadsDrumRole,
  type BeatPadsLanePlacementTemplate,
} from '@/app/lib/creationStation/beatPadsLanePlacementTemplates';
import type { PatternPreset } from '@/app/lib/patternPresets';
import type { BeatPadsSavedSession } from '@/app/lib/creationStation/beatPadsSavedSessions';
import {
  BeatPadsGenoSyncBar,
  useBeatPadsGenoSyncLock,
} from '@/app/components/creation/BeatPadsGenoSyncBar';
import type { BeatPadsGenoBuildSlot } from '@/app/lib/creationStation/beatPadsSe2Bridge';

export type BeatPadsPatternControl = {
  pattern: BeatPadsDrumPattern;
  loopBars: number;
  stepsPerBar: BeatPadsGridStepsPerBar;
  onPatternChange: (pattern: BeatPadsDrumPattern) => void;
  onLoopBarsChange: (loopBars: number) => void;
  onStepsPerBarChange?: (steps: BeatPadsGridStepsPerBar) => void;
};

const PAD_COUNT = 16;
/** Fixed square MPC pads — compact cluster (Open Drum / 808 Lab style). */
const PAD_SIZE = 66;
const PAD_GRID_GAP = 7;
const PAD_BLOCK_H = PAD_SIZE * 4 + PAD_GRID_GAP * 3;
const PAD_BLOCK_W = PAD_SIZE * 4 + PAD_GRID_GAP * 3;
/** FX panel matches pad grid height — knobs inline, limiter on utility tab. */
const PAD_FX_PANEL_H = PAD_BLOCK_H;
/** FX edit box — base width + ~½″ horizontal stretch. */
const PAD_FX_BOX_MAX_W = 'calc(560px + 0.5in)';
const BANK_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const DEFAULT_PRESET_KITS = ['Default', 'Trap 808', 'Lo-Fi', 'Acoustic', 'Electronic', 'Afrobeats'] as const;

const miniBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 26,
  padding: '0 8px',
  borderRadius: 5,
  border: '1px solid rgba(255, 255, 255, 0.14)',
  background: '#12121a',
  color: '#c8d0dc',
  fontSize: 10,
  fontWeight: 800,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

export type BeatLabDrumMachineOverlayProps = {
  open: boolean;
  /** Inline dock (SE2 Beat Pads lane) — no portal, no close chrome. */
  embedded?: boolean;
  /** Parent-owned pattern (SE2 timeline lane). Skips bank localStorage. */
  patternControl?: BeatPadsPatternControl;
  onClose?: () => void;
  activeBank?: number;
  selectedPad?: number | null;
  onSelectPad?: (padIndex: number) => void;
  onStrikePad: (padIndex: number, velocity01: number, gridCol?: number, whenSec?: number) => void;
  padLabelForPad?: (padIndex: number) => string | undefined;
  hasPadSample?: (padIndex: number) => boolean;
  onLoadPad?: (padIndex: number) => void;
  getDrumPadVoice?: (padIndex: number) => BeatLabDrumPadVoiceOpts;
  commitDrumPadVoice?: (padIndex: number, voice: BeatLabDrumPadVoiceOpts) => void;
  onPreviewDrumPad?: (padIndex: number) => void;
  /** Open CH 17 spread pitch roll — pads stay untouched. */
  onSpreadHitToPads?: (
    sourcePad: number,
    direction: import('@/app/lib/creationStation/beatPadsHitSpread').BeatPadsSpreadDirection,
    gridStepsPerBar?: BeatPadsGridStepsPerBar,
  ) => void;
  onUndoSpreadHitToPads?: (sourcePad: number) => void;
  beatPadsSpreadActive?: boolean;
  beatPadsSpreadDirection?: import('@/app/lib/creationStation/beatPadsHitSpread').BeatPadsSpreadDirection;
  beatPadsSpreadRootMidi?: number;
  beatPadsSpreadBaseLabel?: string;
  beatPadsSpreadNotes?: import('@/app/lib/creationStation/beatPadsSpreadTrack').BeatPadsSpreadNote[];
  beatPadsSpreadLoopBars?: import('@/app/lib/creationStation/beatPadsSpreadTrack').BeatPadsSpreadLoopBars;
  beatPadsSpreadStepsPerBar?: BeatPadsGridStepsPerBar;
  onBeatPadsSpreadNotesChange?: (notes: import('@/app/lib/creationStation/beatPadsSpreadTrack').BeatPadsSpreadNote[]) => void;
  onBeatPadsSpreadLoopBarsChange?: (bars: import('@/app/lib/creationStation/beatPadsSpreadTrack').BeatPadsSpreadLoopBars) => void;
  onBeatPadsSpreadDirectionChange?: (direction: import('@/app/lib/creationStation/beatPadsHitSpread').BeatPadsSpreadDirection) => void;
  onBeatPadsSpreadGridStepsPerBarChange?: (stepsPerBar: BeatPadsGridStepsPerBar) => void;
  onPreviewBeatPadsSpreadRow?: (row: number, gridCol?: number) => void;
  onStrikeBeatPadsSpreadRow?: (row: number, gridCol?: number, whenSec?: number) => void;
  onCloseBeatPadsSpread?: () => void;
  beatPadsSpreadMixerChannel?: number;
  onBeatPadsSpreadMixerChannelChange?: (ch: number) => void;
  beatPadsSpreadKeyLockEnabled?: boolean;
  beatPadsSpreadKeyLabel?: string;
  beatPadsSpreadHarmonyLane?: number;
  beatPadsSpreadHarmonyLaneNotes?: import('@/app/lib/creationStation/beatLabMidiRoll').BeatLabMidiNote[];
  beatPadsSpreadSe2MatchTrackOptions?: readonly { trackIndex: number; label: string }[];
  beatPadsSpreadHarmonyTrackIndex?: number;
  onBeatPadsSpreadKeyLockChange?: (enabled: boolean) => void;
  onBeatPadsSpreadHarmonyLaneChange?: (lane: number) => void;
  onBeatPadsSpreadHarmonyTrackIndexChange?: (trackIndex: number) => void;
  onBeatPadsSpreadRegenerateChordRoots?: () => void;
  beatPadsSpreadMidiExportTrackOptions?: readonly { trackIndex: number; label: string }[];
  beatPadsSpreadWavExportTrackOptions?: readonly { trackIndex: number; label: string }[];
  beatPadsSpreadDefaultMidiExportTrackIndex?: number;
  beatPadsSpreadDefaultWavExportTrackIndex?: number;
  onExportBeatPadsSpreadMidi?: (targetTrackIndex: number) => void | Promise<void>;
  onExportBeatPadsSpreadWav?: (targetTrackIndex: number) => void | Promise<void>;
  beatPadsSpreadExportStatus?: string | null;
  /** Pre-warm AudioContext when overlay opens / before first pad hit. */
  onWarmAudio?: () => void | Promise<void>;
  /** Full-bank kit preset / saved kit dropdown. */
  kitSelectValue?: string;
  onKitSelectChange?: (value: string) => void;
  presetKitNames?: readonly string[];
  savedKits?: { id: string; name: string }[];
  setKit?: (name: string) => void;
  /** Crew / producer flagship kits. */
  producerKitId?: BeatLabProducerKitId;
  onProducerKitIdChange?: (id: BeatLabProducerKitId) => void;
  onLoadProducerKit?: () => void | Promise<void>;
  producerKitLoading?: boolean;
  producerKitTribute?: string | null;
  onLoadDefaultKitToBank?: (kitId: BeatLabProducerKitId, bankIndex: number) => void;
  loadingProducerKitId?: BeatLabProducerKitId | null;
  patternActionsDisabled?: boolean;
  /** Per-pad sound swap (selected pad). */
  onUploadPad?: () => void;
  onOpenKitBrowser?: () => void;
  onLoadSoundFamilySample?: (args: { familyId: string; pad: number; label: string; relFile: string }) => void;
  onPreviewSoundFamilySample?: (args: { familyId: string; pad: number; relFile: string }) => void;
  /** Pull Beat Lab grid into the overlay loop. */
  onImportFromBeatLab?: () => { pattern: BeatPadsDrumPattern; loopBars: number } | void;
  /** Push overlay loop to Beat Lab sequencer grid. */
  onExportToBeatLab?: (pattern: BeatPadsDrumPattern, loopBars: number) => void;
  /** Send overlay loop to Studio Editor 2 as drum MIDI. */
  onExportToStudioEditor2?: (args: {
    pattern: BeatPadsDrumPattern;
    loopBars: number;
    stepsPerBar: BeatPadsGridStepsPerBar;
    bpm: number;
  }) => void;
  /** Save loop session (pattern + kit) — parent snapshots kit pads. */
  onSaveBeatPadsSession?: (args: {
    name: string;
    pattern: BeatPadsDrumPattern;
    loopBars: number;
    stepsPerBar: BeatPadsGridStepsPerBar;
    bpm: number;
  }) => void | Promise<void>;
  savedBeatPadsSessions?: { id: string; name: string; savedAt: number }[];
  beatPadsSessionSaveStatus?: string | null;
  onLoadBeatPadsSession?: (id: string) => void | Promise<void>;
  onRenameBeatPadsSession?: (id: string, name: string) => void;
  onDeleteBeatPadsSession?: (id: string) => void;
  beatPadsSessionInject?: { session: BeatPadsSavedSession; nonce: number } | null;
  onBeatPadsSessionInjectConsumed?: () => void;
  onSaveKit?: (name: string) => void | Promise<void>;
  /** One-click save loop pattern + kit snapshot (same as Save loop menu). */
  onQuickSaveKitAndLoop?: (name: string) => void | Promise<void>;
  /** Download loop + kit as .wav (SE2 embedded). */
  onExportWav?: (args: {
    pattern: BeatPadsDrumPattern;
    loopBars: number;
    stepsPerBar: BeatPadsGridStepsPerBar;
    bpm: number;
  }) => void | Promise<void>;
  /** Bounce loop + kit to a new audio track on the timeline (SE2 embedded). */
  onExportToTrack?: (args: {
    pattern: BeatPadsDrumPattern;
    loopBars: number;
    stepsPerBar: BeatPadsGridStepsPerBar;
    bpm: number;
  }) => void | Promise<void>;
  exportStatus?: string | null;
  /** Per-pad HPF/LPF/snap (stored with sample). */
  getPadSamplerOpts?: (padIndex: number) => PadSamplerPlaybackOpts;
  commitPadSamplerOpts?: (padIndex: number, o: PadSamplerPlaybackOpts) => void;
  getPadSamplerFxRack?: (padIndex: number) => PadSamplerFxRack;
  commitPadSamplerFxRack?: (padIndex: number, rack: PadSamplerFxRack) => void;
  /** Live FX while overlay knobs move (before commit). */
  onLivePadFxRackDraft?: (padIndex: number, rack: PadSamplerFxRack) => void;
  onLiveSamplerDraft?: (padIndex: number, o: PadSamplerPlaybackOpts) => void;
  /** Live tune/decay while FX knobs move — grid hits pick up immediately. */
  onLiveDrumPadVoiceDraft?: (padIndex: number, voice: BeatLabDrumPadVoiceOpts) => void;
  getPadSampleAudioBuffer?: (padIndex: number) => AudioBuffer | undefined;
  /** Project BPM — note repeat rolls sync to this tempo. */
  sessionBpm?: number;
  /** Shared AudioContext for Beat Pads local transport scheduling. */
  getAudioContext?: () => AudioContext | null;
  /** Master / track output for VocalBox count-in clicks. */
  getAudioOutput?: () => AudioNode | null;
  /** SE2 embedded — miniature 808 Lab (piano roll) beside VocalBox. */
  beatPads808Lab?: {
    trackId: string;
    trackName?: string;
    songKeyRoot: number;
    songKeyMode: ChordMode;
    studioTracks: readonly Se2Lab808ChordLockHarmonyTrack[];
    lanePad?: number;
    voice: Se2Lab808VoiceParams;
    onVoiceChange: (voice: Se2Lab808VoiceParams) => void;
    syncedToBeatPads: boolean;
    onSyncedToBeatPadsChange: (synced: boolean) => void;
    getPreviewDestination: (ctx: AudioContext) => AudioNode | null;
    onExportToneGridToPianoRoll?: (notes: Se2Lab808ToneGridRollNote[]) => void;
    onExportToneGridWavToTrack?: (args: {
      buffer: AudioBuffer;
      loopBars: number;
      bpm: number;
      sourceTrackName: string;
    }) => void;
  } | null;
  /** SE2 embedded — ORCH hits round pad (Sound Families orchestra hits piano grid). */
  beatPadsOrchHits?: {
    trackId: string;
    songKeyRoot: number;
    songKeyMode: ChordMode;
    studioTracks: readonly Se2Lab808ChordLockHarmonyTrack[];
    lanePad?: number;
    voice: BeatPadsOrchHitsVoice;
    onVoiceChange: (voice: BeatPadsOrchHitsVoice) => void;
    syncedToBeatPads: boolean;
    onSyncedToBeatPadsChange: (synced: boolean) => void;
    getPreviewDestination: (ctx: AudioContext) => AudioNode | null;
    exportTrackOptions?: readonly { trackIndex: number; label: string }[];
    onExportMidiToTrack?: (args: {
      targetTrackIndex: number;
      notes: { pitch: number; startBeat: number; durationBeats: number; velocity: number }[];
      loopBars: number;
    }) => boolean | void;
  } | null;
  /** Beat Lab mixer (CH 1–16 pads) — toggle from top bar while overlay stays open. */
  beatLabMixerOpen?: boolean;
  onBeatLabMixerToggle?: () => void;
  /** Show CH 17 Spread strip in Beat Pads mixer. */
  beatLabMixerSpreadActive?: boolean;
  /** Pattern Bank router — Beat Pads loop when overlay open, else Beat Lab grid. */
  onLoadPatternPreset?: (preset: PatternPreset) => void;
  /** Queued preset from footer Pattern Bank while overlay is open. */
  beatPadsPatternInject?: { preset: PatternPreset; nonce: number } | null;
  onBeatPadsPatternInjectConsumed?: () => void;
  /** Open full machine from SE2 Beat Pads lane with pattern snapshot. */
  beatPadsSe2Inject?: {
    pattern: BeatPadsDrumPattern;
    loopBars: number;
    stepsPerBar: BeatPadsGridStepsPerBar;
    bpm: number;
    trackName?: string;
    nonce: number;
  } | null;
  onBeatPadsSe2InjectConsumed?: () => void;
  onPatternPresetHighlighted?: (preset: PatternPreset) => void;
  /** Load matching producer kit samples when a Pattern Bank preset lands on Beat Pads. */
  onLoadBeatPadsPatternKit?: (preset: PatternPreset) => void;
  /** A/B genre tabs — same categories as Beat Lab Pattern Bank. */
  patternSlot?: BeatLabPatternSlotId;
  onPatternSlotChange?: (slot: BeatLabPatternSlotId) => void;
  loadedPatternBankId?: BeatLabPatternBankId | null;
  loadedPatternPresetId?: string | null;
  patternBankDisabled?: boolean;
  /** SE2 embedded — Geno sync callbacks from parent track. */
  onGenoApplyTransport?: (opts: { bpm: number; loopBars: number }) => void;
  /** SE2 embedded — report live loop BPM/bars so Sync SE2 can push tempo to the main transport. */
  onReportLiveTransport?: (opts: { bpm: number; loopBars: number }) => void;
  /** Auto Drum — swap sample on the selected pad to match typed instructions. */
  onAutoDrumPadSample?: (
    targetPad: number,
    query: string,
    role: BeatPadsDrumRole,
  ) => Promise<{ applied: boolean; label?: string; source?: string }>;
  onGenoHarmonyTrackIdChange?: (trackId: string, slot: BeatPadsGenoBuildSlot) => void;
  /** SE2 embedded — hide pads/kit/FX; keep Geno bar + step sequencer visible. */
  embeddedMachineChromeOpen?: boolean;
  /** SE2 embedded edit dock — slave grid transport + playline to SE2 when linked. */
  se2SyncMode?: Se2BeatPadsSe2SyncMode;
  onSe2SyncModeChange?: (mode: Se2BeatPadsSe2SyncMode) => void;
  /** SE2 session loop length — Beat Pads follows when synced as slave. */
  sessionLoopBars?: number;
  se2TransportPlaying?: boolean;
  getSe2PlayheadBeat?: () => number;
  getSe2TransportOriginBeat?: () => number;
  onSe2TransportToggle?: () => void;
  /** Seek SE2 session playhead (beats) when Beat Pads Sync is linked. */
  onSeekSe2Beat?: (beat: number) => void;
  se2BeatsPerBar?: number;
  sequencerMinVisibleLanes?: number;
};

export function BeatLabDrumMachineOverlay({
  open,
  embedded = false,
  patternControl,
  onClose = () => {},
  activeBank = 0,
  selectedPad = null,
  onSelectPad,
  onStrikePad,
  padLabelForPad,
  hasPadSample,
  onLoadPad,
  getDrumPadVoice,
  commitDrumPadVoice,
  onPreviewDrumPad,
  onSpreadHitToPads,
  onUndoSpreadHitToPads,
  beatPadsSpreadActive = false,
  beatPadsSpreadDirection = 'down',
  beatPadsSpreadRootMidi = 60,
  beatPadsSpreadBaseLabel = 'Spread',
  beatPadsSpreadNotes = [],
  beatPadsSpreadLoopBars = 8,
  beatPadsSpreadStepsPerBar = 16,
  onBeatPadsSpreadNotesChange,
  onBeatPadsSpreadLoopBarsChange,
  onBeatPadsSpreadDirectionChange,
  onBeatPadsSpreadGridStepsPerBarChange,
  onPreviewBeatPadsSpreadRow,
  onStrikeBeatPadsSpreadRow,
  onCloseBeatPadsSpread,
  beatPadsSpreadMixerChannel = 17,
  onBeatPadsSpreadMixerChannelChange,
  beatPadsSpreadKeyLockEnabled = false,
  beatPadsSpreadKeyLabel = 'key',
  beatPadsSpreadHarmonyLane = 17,
  beatPadsSpreadHarmonyLaneNotes = [],
  beatPadsSpreadSe2MatchTrackOptions,
  beatPadsSpreadHarmonyTrackIndex,
  onBeatPadsSpreadKeyLockChange,
  onBeatPadsSpreadHarmonyLaneChange,
  onBeatPadsSpreadHarmonyTrackIndexChange,
  onBeatPadsSpreadRegenerateChordRoots,
  beatPadsSpreadMidiExportTrackOptions,
  beatPadsSpreadWavExportTrackOptions,
  beatPadsSpreadDefaultMidiExportTrackIndex,
  beatPadsSpreadDefaultWavExportTrackIndex,
  onExportBeatPadsSpreadMidi,
  onExportBeatPadsSpreadWav,
  beatPadsSpreadExportStatus,
  onWarmAudio,
  kitSelectValue,
  onKitSelectChange,
  presetKitNames = DEFAULT_PRESET_KITS,
  savedKits = [],
  setKit,
  producerKitId = 'trapDarkVault',
  onProducerKitIdChange,
  onLoadProducerKit,
  producerKitLoading = false,
  producerKitTribute,
  onLoadDefaultKitToBank,
  loadingProducerKitId = null,
  patternActionsDisabled = false,
  onUploadPad,
  onOpenKitBrowser,
  onLoadSoundFamilySample,
  onPreviewSoundFamilySample,
  onImportFromBeatLab,
  onExportToBeatLab,
  onExportToStudioEditor2,
  onSaveBeatPadsSession,
  savedBeatPadsSessions = [],
  beatPadsSessionSaveStatus,
  onLoadBeatPadsSession,
  onRenameBeatPadsSession,
  onDeleteBeatPadsSession,
  beatPadsSessionInject = null,
  onBeatPadsSessionInjectConsumed,
  onSaveKit,
  onQuickSaveKitAndLoop,
  onExportWav,
  onExportToTrack,
  exportStatus = null,
  getPadSamplerOpts,
  commitPadSamplerOpts,
  getPadSamplerFxRack,
  commitPadSamplerFxRack,
  onLivePadFxRackDraft,
  onLiveSamplerDraft,
  onLiveDrumPadVoiceDraft,
  getPadSampleAudioBuffer,
  sessionBpm = 120,
  getAudioContext,
  getAudioOutput,
  beatPads808Lab = null,
  beatPadsOrchHits = null,
  beatLabMixerOpen = false,
  onBeatLabMixerToggle,
  beatLabMixerSpreadActive = false,
  onLoadPatternPreset,
  patternSlot = 'A',
  onPatternSlotChange,
  loadedPatternBankId = null,
  loadedPatternPresetId = null,
  patternBankDisabled = false,
  beatPadsPatternInject = null,
  onBeatPadsPatternInjectConsumed,
  beatPadsSe2Inject = null,
  onBeatPadsSe2InjectConsumed,
  onPatternPresetHighlighted,
  onLoadBeatPadsPatternKit,
  onGenoApplyTransport,
  onReportLiveTransport,
  onAutoDrumPadSample,
  onGenoHarmonyTrackIdChange,
  embeddedMachineChromeOpen = true,
  se2SyncMode = 'off',
  onSe2SyncModeChange,
  sessionLoopBars,
  se2TransportPlaying = false,
  getSe2PlayheadBeat,
  getSe2TransportOriginBeat,
  onSe2TransportToggle,
  onSeekSe2Beat,
  se2BeatsPerBar = 4,
  sequencerMinVisibleLanes,
}: BeatLabDrumMachineOverlayProps) {
  const noteRepeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRepeatPadRef = useRef<number | null>(null);
  const noteRepeatVelRef = useRef(0.88);
  const playlineElRef = useRef<HTMLDivElement | null>(null);
  const overlayOpenRef = useRef(false);
  const overlayBankRef = useRef(activeBank);
  const appliedInjectNonceRef = useRef<number | null>(null);
  const appliedSessionNonceRef = useRef<number | null>(null);
  const appliedSe2InjectNonceRef = useRef<number | null>(null);
  const [litPad, setLitPad] = useState<number | null>(null);
  const [gridExpanded, setGridExpanded] = useState(false);
  /** SE2 Beat Pads — VocalBox tab above the pad FX column (mouth → kick/snare/hat). */
  const [vocalBoxOpen, setVocalBoxOpen] = useState(false);
  /** SE2 Beat Pads — miniature 808 Lab piano-roll tab (next to VocalBox). */
  const [lab808Open, setLab808Open] = useState(false);
  /** SE2 Beat Pads — ORCH hits round pad (between pads and FX). */
  const [orchHitsOpen, setOrchHitsOpen] = useState(false);
  const [internalLoopBars, setInternalLoopBars] = useState(BEAT_PADS_DEFAULT_LOOP_BARS);
  const [internalPattern, setInternalPattern] = useState<BeatPadsDrumPattern>(() =>
    emptyBeatPadsPattern(BEAT_PADS_DEFAULT_LOOP_BARS),
  );
  const [localBpm, setLocalBpm] = useState(() => clampBeatPadsBpm(sessionBpm));
  const [internalGridStepsPerBar, setInternalGridStepsPerBar] = useState<BeatPadsGridStepsPerBar>(16);
  const loopBars = patternControl?.loopBars ?? internalLoopBars;
  const pattern = patternControl?.pattern ?? internalPattern;
  const gridStepsPerBar = patternControl?.stepsPerBar ?? internalGridStepsPerBar;
  const patternFromControlRef = useRef(pattern);
  patternFromControlRef.current = pattern;
  const setLoopBars = useCallback(
    (bars: number) => {
      if (patternControl) patternControl.onLoopBarsChange(bars);
      else setInternalLoopBars(bars);
    },
    [patternControl],
  );
  const setPattern = useCallback(
    (next: BeatPadsDrumPattern | ((prev: BeatPadsDrumPattern) => BeatPadsDrumPattern)) => {
      const resolved =
        typeof next === 'function' ? next(patternFromControlRef.current) : next;
      patternFromControlRef.current = resolved;
      if (patternControl) patternControl.onPatternChange(resolved);
      else setInternalPattern(resolved);
    },
    [patternControl],
  );
  const setGridStepsPerBar = useCallback(
    (steps: BeatPadsGridStepsPerBar) => {
      if (patternControl?.onStepsPerBarChange) patternControl.onStepsPerBarChange(steps);
      else setInternalGridStepsPerBar(steps);
    },
    [patternControl],
  );
  const [rollDrawActive, setRollDrawActive] = useState(true);
  const [externalWaveformProps, setExternalWaveformProps] =
    useState<BeatLabPadSampleFxWaveformProps | null>(null);
  const handleExternalWaveformProps = useCallback((props: BeatLabPadSampleFxWaveformProps | null) => {
    setExternalWaveformProps(props);
  }, []);
  const gridStepsRef = useRef<BeatPadsGridStepsPerBar>(gridStepsPerBar);
  useEffect(() => {
    gridStepsRef.current = gridStepsPerBar;
  }, [gridStepsPerBar]);
  const [laneDrumRoles, setLaneDrumRoles] = useState<Record<string, BeatPadsDrumRole>>({});
  const [activeLaneTemplateIds, setActiveLaneTemplateIds] = useState<Record<string, string>>({});

  useBeatPadsGenoSyncLock(
    patternControl
      ? undefined
      : useCallback((opts: { bpm: number; loopBars: number }) => {
          setLocalBpm(clampBeatPadsBpm(opts.bpm));
          setLoopBars(opts.loopBars);
        }, [setLoopBars]),
  );

  const editPad = selectedPad ?? 0;
  const laneKey = `${activeBank}_${editPad}`;
  const laneLabel = padLabelForPad?.(editPad)?.trim() || `Pad ${editPad + 1}`;
  const inferredDrumRole = beatPadsDrumRoleFromLabel(laneLabel, editPad);
  const laneDrumRole = laneDrumRoles[laneKey] ?? inferredDrumRole;
  const activeLaneTemplateId = activeLaneTemplateIds[laneKey] ?? null;
  const activeLaneTemplateName =
    (activeLaneTemplateId ? getBeatPadsLaneTemplateById(activeLaneTemplateId)?.name : null) ?? null;

  const [localVoice, setLocalVoice] = useState<BeatLabDrumPadVoiceOpts | null>(null);

  useEffect(() => {
    if (!open || !getDrumPadVoice) {
      setLocalVoice(null);
      return;
    }
    setLocalVoice(getDrumPadVoice(editPad));
  }, [open, editPad, activeBank, getDrumPadVoice]);

  const scrollSequencerToStart = useCallback(() => {
    requestAnimationFrame(() => {
      const v = document.querySelector('.beat-pads-grid-v-scroll');
      const inner = document.querySelector('.beat-pads-grid-h-scroll-inner');
      const bar = document.querySelector('.beat-pads-grid-h-scroll');
      if (v instanceof HTMLElement) {
        v.scrollTop = 0;
      }
      if (inner instanceof HTMLElement) inner.scrollLeft = 0;
      if (bar instanceof HTMLElement) bar.scrollLeft = 0;
      resetBeatPadsPlaylineToStart(playlineElRef.current, BEAT_PADS_GRID_COL_W);
    });
  }, []);

  useEffect(() => {
    if (!open) {
      overlayOpenRef.current = false;
      appliedInjectNonceRef.current = null;
      setLitPad(null);
      if (noteRepeatTimerRef.current != null) {
        clearTimeout(noteRepeatTimerRef.current);
        noteRepeatTimerRef.current = null;
      }
      noteRepeatPadRef.current = null;
      return;
    }

    const openingNow = !overlayOpenRef.current;
    const bankChanged = overlayBankRef.current !== activeBank;
    overlayOpenRef.current = true;
    overlayBankRef.current = activeBank;

    if (!patternControl && (openingNow || bankChanged)) {
      onWarmAudio?.();
      const store = loadBeatPadsPatternStore();
      const saved = store[beatPadsPatternBankKey(activeBank)];
      if (saved) {
        const bars = saved.loopBars;
        const steps = saved.stepsPerBar === 32 ? 32 : 16;
        setInternalLoopBars(bars);
        setInternalGridStepsPerBar(steps);
        gridStepsRef.current = steps;
        setInternalPattern(normalizeBeatPadsPattern(saved.pattern, bars, steps));
      } else {
        setInternalLoopBars(BEAT_PADS_DEFAULT_LOOP_BARS);
        setInternalGridStepsPerBar(16);
        gridStepsRef.current = 16;
        setInternalPattern(emptyBeatPadsPattern(BEAT_PADS_DEFAULT_LOOP_BARS));
      }
      const bpmStore = loadBeatPadsBpmStore();
      const savedBpm = bpmStore[beatPadsPatternBankKey(activeBank)];
      setLocalBpm(clampBeatPadsBpm(savedBpm ?? sessionBpm));
    } else if (openingNow) {
      onWarmAudio?.();
      setLocalBpm(clampBeatPadsBpm(sessionBpm));
    }

    if (!embedded) {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    return undefined;
  }, [open, onClose, onWarmAudio, activeBank, sessionBpm, patternControl, embedded]);

  useEffect(() => {
    if (!open || patternControl) return;
    const store = loadBeatPadsBpmStore();
    store[beatPadsPatternBankKey(activeBank)] = localBpm;
    saveBeatPadsBpmStore(store);
  }, [open, activeBank, localBpm, patternControl]);

  useEffect(() => {
    if (!open || patternControl) return;
    const store = loadBeatPadsPatternStore();
    store[beatPadsPatternBankKey(activeBank)] = { loopBars, pattern, stepsPerBar: gridStepsPerBar };
    saveBeatPadsPatternStore(store);
  }, [open, activeBank, loopBars, pattern, gridStepsPerBar, patternControl]);

  const voice = localVoice;

  const showFxPanel = Boolean(
    getPadSamplerOpts && commitPadSamplerOpts && getPadSamplerFxRack && commitPadSamplerFxRack,
  );

  const handleLiveDrumPadVoiceDraft = useCallback(
    (padIndex: number, next: BeatLabDrumPadVoiceOpts) => {
      onLiveDrumPadVoiceDraft?.(padIndex, next);
      if (padIndex !== editPad) return;
      setLocalVoice(next);
      const nr = next.noteRepeat;
      if (nr === 'off') {
        if (gridStepsRef.current === 32) {
          applyGridStepsPerBarRef.current(16);
        }
        return;
      }
      applyGridStepsPerBarRef.current(beatLabDrumPadNoteRepeatGridSteps(nr));
    },
    [editPad, onLiveDrumPadVoiceDraft],
  );

  const applyGridStepsPerBarRef = useRef<(next: BeatPadsGridStepsPerBar) => void>(() => {});

  const stopNoteRepeat = useCallback(() => {
    if (noteRepeatTimerRef.current != null) {
      clearTimeout(noteRepeatTimerRef.current);
      noteRepeatTimerRef.current = null;
    }
    noteRepeatPadRef.current = null;
  }, []);

  const startNoteRepeat = useCallback(
    (padIndex: number, vel01: number) => {
      stopNoteRepeat();
      const padVoice = getDrumPadVoice?.(padIndex);
      if (!padVoice || padVoice.noteRepeat === 'off') return;
      const intervalSec = beatLabDrumPadNoteRepeatIntervalSec(localBpm, padVoice.noteRepeat);
      if (!intervalSec) return;
      noteRepeatPadRef.current = padIndex;
      noteRepeatVelRef.current = vel01;
      const tick = () => {
        if (noteRepeatPadRef.current !== padIndex) return;
        onStrikePad(padIndex, noteRepeatVelRef.current);
        noteRepeatTimerRef.current = setTimeout(tick, intervalSec * 1000);
      };
      noteRepeatTimerRef.current = setTimeout(tick, intervalSec * 1000);
    },
    [getDrumPadVoice, localBpm, onStrikePad, stopNoteRepeat],
  );

  const handleTransportStrike = useCallback(
    (lane: number, col: number, whenSec: number) => {
      onStrikePad(lane, 0.88, col, whenSec);
    },
    [onStrikePad],
  );

  const handleTransportStrikeSpread = useCallback(
    (row: number, col: number, whenSec: number) => {
      onStrikeBeatPadsSpreadRow?.(row, col, whenSec);
    },
    [onStrikeBeatPadsSpreadRow],
  );

  const beatPadsTransport = useBeatPadsLocalTransport({
    open: open && !(embedded && se2SyncMode !== 'off'),
    pattern,
    loopBars,
    stepsPerBar: gridStepsPerBar,
    bpm: localBpm,
    playlineElRef,
    onStrikeStep: handleTransportStrike,
    spreadNotes: beatPadsSpreadActive ? beatPadsSpreadNotes : undefined,
    spreadLoopBars: beatPadsSpreadActive ? beatPadsSpreadLoopBars : undefined,
    spreadActive: beatPadsSpreadActive,
    onStrikeSpreadRow: beatPadsSpreadActive ? handleTransportStrikeSpread : undefined,
    lab808Link:
      beatPads808Lab != null
        ? {
            synced: beatPads808Lab.syncedToBeatPads,
            trackId: beatPads808Lab.trackId,
            voice: beatPads808Lab.voice,
            getDestination: beatPads808Lab.getPreviewDestination,
          }
        : null,
    orchHitsLink:
      beatPadsOrchHits != null
        ? {
            synced: beatPadsOrchHits.syncedToBeatPads,
            trackId: beatPadsOrchHits.trackId,
            voice: beatPadsOrchHits.voice,
            getDestination: beatPadsOrchHits.getPreviewDestination,
          }
        : null,
    onWarmAudio,
    getAudioContext,
  });

  useEffect(() => {
    if (!open || !beatPadsSpreadActive) return;
    if (beatPadsSpreadStepsPerBar !== gridStepsPerBar) {
      onBeatPadsSpreadGridStepsPerBarChange?.(gridStepsPerBar);
    }
  }, [
    open,
    beatPadsSpreadActive,
    beatPadsSpreadStepsPerBar,
    gridStepsPerBar,
    onBeatPadsSpreadGridStepsPerBarChange,
  ]);

  const se2SyncActive = embedded && se2SyncMode !== 'off';
  const se2SyncMaster = embedded && se2SyncMode === 'master';
  const effectiveTransportPlaying = se2SyncActive ? se2TransportPlaying : beatPadsTransport.isPlaying;
  const effectiveTransportBpm = clampBeatPadsBpm(localBpm);

  useEffect(() => {
    if (!embedded || se2SyncMode !== 'slave') return;
    setLocalBpm(clampBeatPadsBpm(sessionBpm));
  }, [embedded, se2SyncMode, sessionBpm]);

  // Slave follows SE2 BPM only — keep Beat Pads pattern length (e.g. 8 bars).
  // Do not force-resize to sessionLoopBars; that truncated patterns to SE2 arrangement length.

  useEffect(() => {
    if (!embedded || !onReportLiveTransport) return;
    onReportLiveTransport({ bpm: clampBeatPadsBpm(localBpm), loopBars });
  }, [embedded, localBpm, loopBars, onReportLiveTransport]);

  // When sync arms, park local transport once. Do not re-run on every render
  // (beatPadsTransport object identity changes) — that was haltPadSamplePlayback()'ing
  // SE2 lookahead and leaving dedupe keys stuck so only the first kick survived.
  const stopLocalTransport = beatPadsTransport.stop;
  const prevSe2SyncActiveRef = useRef(false);
  useEffect(() => {
    if (se2SyncActive && !prevSe2SyncActiveRef.current) {
      stopLocalTransport();
    }
    prevSe2SyncActiveRef.current = se2SyncActive;
  }, [se2SyncActive, stopLocalTransport]);

  const se2PlayheadColF = useCallback(
    (beat: number) => {
      const cols = beatPadsPatternCols(loopBars, gridStepsPerBar);
      if (cols <= 0) return 0;
      const bpb = Math.max(2, Math.min(16, Math.round(se2BeatsPerBar)));
      const patternLoopBeats = loopBars * bpb;
      const stepBeats = patternLoopBeats / cols;
      if (stepBeats <= 0) return 0;
      const origin = getSe2TransportOriginBeat?.() ?? 0;
      const elapsed = beat - origin;
      const wrapped = ((elapsed % patternLoopBeats) + patternLoopBeats) % patternLoopBeats;
      return wrapped / stepBeats;
    },
    [gridStepsPerBar, getSe2TransportOriginBeat, loopBars, se2BeatsPerBar],
  );

  const syncSe2PlaylineScroll = useCallback(
    (colF: number) => {
      const el = playlineElRef.current;
      if (!el) return;
      const scrollHost =
        (el.closest('.beat-pads-grid-h-scroll-inner') as HTMLElement | null)
        ?? (el.closest('.beat-pads-grid-h-scroll') as HTMLElement | null);
      if (!scrollHost) return;
      const applyScrollLeft = (left: number) => {
        scrollHost.scrollLeft = left;
        const host = scrollHost.closest('.beat-pads-grid-scroll-host');
        const bar = host?.querySelector('.beat-pads-grid-h-scroll');
        const inner = host?.querySelector('.beat-pads-grid-h-scroll-inner');
        if (bar instanceof HTMLElement && bar !== scrollHost) bar.scrollLeft = left;
        if (inner instanceof HTMLElement && inner !== scrollHost) inner.scrollLeft = left;
      };
      const laneLabelW = 72;
      const playheadX = laneLabelW + colF * BEAT_PADS_GRID_COL_W;
      const viewLeft = scrollHost.scrollLeft;
      const viewRight = viewLeft + scrollHost.clientWidth;
      const margin = BEAT_PADS_GRID_COL_W * 2;
      if (playheadX < viewLeft + margin) {
        applyScrollLeft(Math.max(0, playheadX - margin));
      } else if (playheadX + BEAT_PADS_GRID_COL_W > viewRight - margin) {
        applyScrollLeft(playheadX + BEAT_PADS_GRID_COL_W + margin - scrollHost.clientWidth);
      }
    },
    [playlineElRef],
  );

  useEffect(() => {
    if (!open || !se2SyncActive || typeof getSe2PlayheadBeat !== 'function') return;
    let raf = 0;
    const tick = () => {
      const colF = se2PlayheadColF(getSe2PlayheadBeat());
      setBeatPadsPlaylineAtCol(playlineElRef.current, colF, BEAT_PADS_GRID_COL_W);
      if (se2TransportPlaying) syncSe2PlaylineScroll(colF);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    open,
    se2SyncActive,
    se2TransportPlaying,
    getSe2PlayheadBeat,
    se2PlayheadColF,
    playlineElRef,
    syncSe2PlaylineScroll,
  ]);

  const handleSe2SyncedTransportPlay = useCallback(() => {
    if (!se2TransportPlaying) onSe2TransportToggle?.();
  }, [onSe2TransportToggle, se2TransportPlaying]);

  const handleSe2SyncedTransportStop = useCallback(() => {
    beatPadsTransport.stop();
    if (se2TransportPlaying) onSe2TransportToggle?.();
  }, [beatPadsTransport, onSe2TransportToggle, se2TransportPlaying]);

  const handleTransportPlay = se2SyncActive ? handleSe2SyncedTransportPlay : beatPadsTransport.start;
  const handleTransportStop = se2SyncActive
    ? handleSe2SyncedTransportStop
    : beatPadsTransport.stopOrResetToStart;

  /** Beat Pads grid scrub — local parked col; when Sync SE2 is on, also move the SE2 playhead. */
  const handleSeekPlayheadCol = useCallback(
    (col: number) => {
      beatPadsTransport.seekCol(col);
      if (!se2SyncActive || !onSeekSe2Beat) return;
      const cols = beatPadsPatternCols(loopBars, gridStepsPerBar);
      if (cols <= 0) return;
      const bpb = Math.max(2, Math.min(16, Math.round(se2BeatsPerBar)));
      const patternLoopBeats = loopBars * bpb;
      const stepBeats = patternLoopBeats / Math.max(1, cols);
      const origin = getSe2TransportOriginBeat?.() ?? 0;
      const clamped = Math.max(0, Math.min(cols - 1, Math.floor(col)));
      onSeekSe2Beat(origin + clamped * stepBeats);
    },
    [
      beatPadsTransport,
      getSe2TransportOriginBeat,
      gridStepsPerBar,
      loopBars,
      onSeekSe2Beat,
      se2BeatsPerBar,
      se2SyncActive,
    ],
  );

  const handleTransportBpmChange = useCallback(
    (next: number) => {
      const clamped = clampBeatPadsBpm(next);
      setLocalBpm(clamped);
      if (embedded && se2SyncMaster && onGenoApplyTransport) {
        onGenoApplyTransport({ bpm: clamped, loopBars });
      }
    },
    [embedded, loopBars, onGenoApplyTransport, se2SyncMaster],
  );

  const beatPadsExportBpm = effectiveTransportBpm;

  const handleExportWav = useCallback(() => {
    onExportWav?.({
      pattern,
      loopBars,
      stepsPerBar: gridStepsPerBar,
      bpm: beatPadsExportBpm,
    });
  }, [beatPadsExportBpm, gridStepsPerBar, loopBars, onExportWav, pattern]);

  const handleExportToTrack = useCallback(() => {
    onExportToTrack?.({
      pattern,
      loopBars,
      stepsPerBar: gridStepsPerBar,
      bpm: beatPadsExportBpm,
    });
  }, [beatPadsExportBpm, gridStepsPerBar, loopBars, onExportToTrack, pattern]);

  const applyGridStepsPerBar = useCallback(
    (next: BeatPadsGridStepsPerBar) => {
      const prev = gridStepsRef.current;
      if (prev === next) return;
      beatPadsTransport.stop();
      gridStepsRef.current = next;
      if (patternControl?.onStepsPerBarChange) {
        patternControl.onStepsPerBarChange(next);
      } else {
        setPattern((p) => beatPadsConvertPatternGridSteps(p, loopBars, prev, next));
        setGridStepsPerBar(next);
      }
      if (beatPadsSpreadActive) onBeatPadsSpreadGridStepsPerBarChange?.(next);
    },
    [
      beatPadsSpreadActive,
      beatPadsTransport,
      loopBars,
      onBeatPadsSpreadGridStepsPerBarChange,
      patternControl,
      setGridStepsPerBar,
      setPattern,
    ],
  );

  applyGridStepsPerBarRef.current = applyGridStepsPerBar;

  useEffect(() => {
    if (!open) return;
    const release = () => {
      stopNoteRepeat();
      setLitPad(null);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [open, stopNoteRepeat]);

  useEffect(() => {
    if (!open) return;
    const nr = localVoice?.noteRepeat ?? getDrumPadVoice?.(editPad)?.noteRepeat ?? 'off';
    if (nr === 'off') {
      if (gridStepsRef.current === 32) {
        applyGridStepsPerBarRef.current(16);
      }
      return;
    }
    applyGridStepsPerBarRef.current(beatLabDrumPadNoteRepeatGridSteps(nr));
  }, [open, editPad, getDrumPadVoice, localVoice?.noteRepeat]);

  const handleRollDrawChange = useCallback(
    (_on: boolean) => {
      setRollDrawActive(true);
      const nr = localVoice?.noteRepeat ?? getDrumPadVoice?.(editPad)?.noteRepeat ?? 'off';
      if (nr === 'off') return;
      applyGridStepsPerBarRef.current(beatLabDrumPadNoteRepeatGridSteps(nr));
    },
    [editPad, getDrumPadVoice, localVoice?.noteRepeat],
  );

  const strike = useCallback(
    (padIndex: number, e: PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const vel = pointerStrikeVelocity(e);
      void Promise.resolve(onWarmAudio?.());
      onStrikePad(padIndex, vel);
      startNoteRepeat(padIndex, vel);
      onSelectPad?.(padIndex);
      setLitPad(padIndex);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
    },
    [onSelectPad, onStrikePad, onWarmAudio, startNoteRepeat],
  );

  const releaseLit = useCallback(() => {
    stopNoteRepeat();
    setLitPad(null);
  }, [stopNoteRepeat]);

  const handleLoopBarsChange = useCallback(
    (bars: number) => {
      beatPadsTransport.stop();
      if (patternControl) {
        patternControl.onLoopBarsChange(bars);
      } else {
        setLoopBars(bars);
        setPattern((prev) => resizeBeatPadsPattern(prev, bars, gridStepsRef.current));
      }
      if (embedded && se2SyncMaster && onGenoApplyTransport) {
        onGenoApplyTransport({ bpm: clampBeatPadsBpm(localBpm), loopBars: bars });
      }
    },
    [beatPadsTransport, embedded, localBpm, onGenoApplyTransport, patternControl, se2SyncMaster, setLoopBars, setPattern],
  );

  const handlePatternChange = useCallback((next: BeatPadsDrumPattern) => {
    setPattern(next);
  }, []);

  const handleNoteAdded = useCallback(
    (lane: number, col: number) => {
      void Promise.resolve(onWarmAudio?.());
      onStrikePad(lane, 0.88, col);
    },
    [onStrikePad, onWarmAudio],
  );

  const handleClearPattern = useCallback(() => {
    setPattern(emptyBeatPadsPattern(loopBars));
  }, [loopBars]);

  const handleClearLane = useCallback(() => {
    setPattern((prev) => clearBeatPadsLane(prev, editPad));
  }, [editPad]);

  const handleImportFromBeatLab = useCallback(() => {
    const imported = onImportFromBeatLab?.();
    if (!imported) return;
    setLoopBars(imported.loopBars);
    setPattern(normalizeBeatPadsPattern(imported.pattern, imported.loopBars));
  }, [onImportFromBeatLab]);

  const handleExportToBeatLab = useCallback(() => {
    const exportPat =
      gridStepsRef.current === 32
        ? beatPadsConvertPatternGridSteps(pattern, loopBars, 32, 16)
        : pattern;
    onExportToBeatLab?.(exportPat, loopBars);
  }, [loopBars, onExportToBeatLab, pattern]);

  const handleExportToStudioEditor2 = useCallback(() => {
    onExportToStudioEditor2?.({
      pattern,
      loopBars,
      stepsPerBar: gridStepsRef.current,
      bpm: localBpm,
    });
  }, [localBpm, loopBars, onExportToStudioEditor2, pattern]);

  const handleSaveBeatPadsSession = useCallback(
    (name: string) => {
      void Promise.resolve(
        onSaveBeatPadsSession?.({
          name,
          pattern,
          loopBars,
          stepsPerBar: gridStepsRef.current,
          bpm: localBpm,
        }),
      );
    },
    [localBpm, loopBars, onSaveBeatPadsSession, pattern],
  );

  const handleQuickSaveKitAndLoop = useCallback(
    (name: string) => {
      if (typeof onQuickSaveKitAndLoop === 'function') {
        onQuickSaveKitAndLoop(name);
        return;
      }
      handleSaveBeatPadsSession(name);
    },
    [handleSaveBeatPadsSession, onQuickSaveKitAndLoop],
  );

  const applyBeatPadsPatternPreset = useCallback(
    (preset: PatternPreset) => {
      const wasPlaying = beatPadsTransport.isPlaying;
      const loaded = presetToBeatPadsPattern(preset);
      setLoopBars(loaded.loopBars);
      setGridStepsPerBar(16);
      gridStepsRef.current = 16;
      setPattern(normalizeBeatPadsPattern(loaded.pattern, loaded.loopBars, 16));
      setLocalBpm(clampBeatPadsBpm(loaded.bpm));
      onLoadBeatPadsPatternKit?.(preset);
      scrollSequencerToStart();
      if (wasPlaying) {
        queueMicrotask(() => {
          void beatPadsTransport.restartFromBarOne();
        });
      }
    },
    [beatPadsTransport, onLoadBeatPadsPatternKit, scrollSequencerToStart],
  );

  const handleSidebarPatternPick = useCallback(
    (preset: PatternPreset) => {
      applyBeatPadsPatternPreset(preset);
      onPatternPresetHighlighted?.(preset);
    },
    [applyBeatPadsPatternPreset, onPatternPresetHighlighted],
  );

  const handleApplyLaneTemplate = useCallback(
    (template: BeatPadsLanePlacementTemplate) => {
      const targetLane = editPad;
      const targetLaneKey = `${activeBank}_${targetLane}`;
      setPattern((prev) =>
        applyBeatPadsLanePlacementTemplate(
          prev,
          targetLane,
          loopBars,
          template.steps,
          gridStepsRef.current,
        ),
      );
      setActiveLaneTemplateIds((prev) => ({ ...prev, [targetLaneKey]: template.id }));
      void Promise.resolve(onWarmAudio?.());
      onStrikePad(targetLane, 0.88);
      onSelectPad?.(targetLane);
    },
    [activeBank, editPad, loopBars, onSelectPad, onStrikePad, onWarmAudio],
  );

  const handleLaneDrumRoleChange = useCallback(
    (role: BeatPadsDrumRole) => {
      setLaneDrumRoles((prev) => ({ ...prev, [laneKey]: role }));
    },
    [laneKey],
  );

  useLayoutEffect(() => {
    if (!open || !beatPadsPatternInject) return;
    if (appliedInjectNonceRef.current === beatPadsPatternInject.nonce) return;
    appliedInjectNonceRef.current = beatPadsPatternInject.nonce;
    applyBeatPadsPatternPreset(beatPadsPatternInject.preset);
    onBeatPadsPatternInjectConsumed?.();
  }, [
    open,
    beatPadsPatternInject,
    applyBeatPadsPatternPreset,
    onBeatPadsPatternInjectConsumed,
  ]);

  useLayoutEffect(() => {
    if (!open || !beatPadsSessionInject) return;
    if (appliedSessionNonceRef.current === beatPadsSessionInject.nonce) return;
    appliedSessionNonceRef.current = beatPadsSessionInject.nonce;
    const session = beatPadsSessionInject.session;
    beatPadsTransport.stop();
    setLoopBars(session.loopBars);
    const spb = session.stepsPerBar === 32 ? 32 : 16;
    setGridStepsPerBar(spb);
    gridStepsRef.current = spb;
    setPattern(normalizeBeatPadsPattern(session.pattern, session.loopBars, spb));
    setLocalBpm(clampBeatPadsBpm(session.bpm));
    scrollSequencerToStart();
    onBeatPadsSessionInjectConsumed?.();
  }, [
    open,
    beatPadsSessionInject,
    beatPadsTransport,
    onBeatPadsSessionInjectConsumed,
    scrollSequencerToStart,
  ]);

  useLayoutEffect(() => {
    if (!open || !beatPadsSe2Inject) return;
    if (appliedSe2InjectNonceRef.current === beatPadsSe2Inject.nonce) return;
    appliedSe2InjectNonceRef.current = beatPadsSe2Inject.nonce;
    const spb = beatPadsSe2Inject.stepsPerBar === 32 ? 32 : 16;
    beatPadsTransport.stop();
    setLoopBars(beatPadsSe2Inject.loopBars);
    setGridStepsPerBar(spb);
    gridStepsRef.current = spb;
    setPattern(
      normalizeBeatPadsPattern(beatPadsSe2Inject.pattern, beatPadsSe2Inject.loopBars, spb),
    );
    setLocalBpm(clampBeatPadsBpm(beatPadsSe2Inject.bpm));
    scrollSequencerToStart();
    onBeatPadsSe2InjectConsumed?.();
  }, [
    open,
    beatPadsSe2Inject,
    beatPadsTransport,
    onBeatPadsSe2InjectConsumed,
    scrollSequencerToStart,
  ]);

  useEffect(() => {
    if (!open) setGridExpanded(false);
  }, [open]);

  useEffect(() => {
    if (!gridExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setGridExpanded(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [gridExpanded]);

  const showPatternBank = true;

  if (!open) return null;

  const bankLabel = embedded ? 'LANE' : (BANK_LABELS[activeBank] ?? String(activeBank + 1));
  const padLabel = padLabelForPad?.(editPad)?.trim() || `Pad ${editPad + 1}`;
  const kitDropdownValue =
    kitSelectValue ?? `preset:${presetKitNames[0] ?? DEFAULT_PRESET_KITS[0]}`;
  const showKitBar =
    typeof onKitSelectChange === 'function' ||
    typeof onLoadProducerKit === 'function' ||
    typeof onLoadPad === 'function';
  const showEmbeddedMachineChrome = !embedded || embeddedMachineChromeOpen;

  const renderSequencerPane = () => (
    <div
      className="beat-pads-sequencer-pane"
      style={{
        flex: '1 1 auto',
        minHeight: 168,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {showEmbeddedMachineChrome && !gridExpanded && showFxPanel && externalWaveformProps ? (
        <div
          className="beat-pads-scope-over-grid"
          style={{
            flexShrink: 0,
            height: PAD_FX_SCOPE_ROW_H,
            minHeight: PAD_FX_SCOPE_ROW_H,
            padding: '6px 10px 4px',
            boxSizing: 'border-box',
            borderBottom: '1px solid rgba(124, 244, 198, 0.12)',
            background: 'rgba(0, 0, 0, 0.28)',
          }}
        >
          <BeatLabPadSampleFxWaveform {...externalWaveformProps} layout="split" />
        </div>
      ) : null}
      <BeatLabDrumMachineSequencer
        pattern={pattern}
        loopBars={loopBars}
        stepsPerBar={gridStepsPerBar}
        rollDrawMode={rollDrawActive}
        rollDrawLabel={beatLabDrumPadNoteRepeatRollLabel(voice?.noteRepeat ?? 'off')}
        selectedLane={editPad}
        onSelectLane={(lane) => onSelectPad?.(lane)}
        onPatternChange={handlePatternChange}
        onNoteAdded={handleNoteAdded}
        onLoopBarsChange={handleLoopBarsChange}
        onClear={handleClearPattern}
        onClearLane={handleClearLane}
        onImportFromBeatLab={
          !embedded && typeof onImportFromBeatLab === 'function' ? handleImportFromBeatLab : undefined
        }
        onExportToBeatLab={
          !embedded && typeof onExportToBeatLab === 'function' ? handleExportToBeatLab : undefined
        }
        onExportToStudioEditor2={
          !embedded && typeof onExportToStudioEditor2 === 'function'
            ? handleExportToStudioEditor2
            : undefined
        }
        padLabelForLane={padLabelForPad}
        disabled={patternActionsDisabled}
        laneVoice={undefined}
        onLaneVoiceParam={undefined}
        transportPlaying={effectiveTransportPlaying}
        playlineElRef={playlineElRef}
        transportParkedCol={beatPadsTransport.parkedCol}
        transportBpm={effectiveTransportBpm}
        onTransportPlay={handleTransportPlay}
        onTransportStop={handleTransportStop}
        onTransportBpmChange={handleTransportBpmChange}
        onSeekPlayheadCol={handleSeekPlayheadCol}
        se2SyncMode={embedded ? se2SyncMode : undefined}
        onSe2SyncModeChange={embedded ? onSe2SyncModeChange : undefined}
        minVisibleLanes={sequencerMinVisibleLanes}
        gridExpanded={gridExpanded}
        onGridExpandedChange={setGridExpanded}
        gridExpandedLiftPx={gridExpanded ? PAD_FX_SCOPE_ROW_H : 0}
      />
    </div>
  );

  const body = (
    <div
      role={embedded ? 'region' : 'dialog'}
      aria-modal={embedded ? undefined : true}
      aria-label="Beat Pads drum machine"
      data-beat-pads-embedded-root
      data-beat-pads-grid-expanded={gridExpanded ? '' : undefined}
      className="beat-pads-embedded-root"
      style={{
        background: embedded
          ? 'transparent'
          : 'radial-gradient(ellipse 120% 80% at 50% 0%, rgba(124,244,198,0.08) 0%, transparent 55%), linear-gradient(180deg, #0a0c10 0%, #040506 100%)',
        ...(embedded
          ? { display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, overflow: 'hidden' }
          : {}),
      }}
    >
      <div
        className="beat-lab-drum-machine-overlay"
        style={{
          flex: '1 1 auto',
          width: '100%',
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'transparent',
          borderRadius: 0,
          border: 'none',
          boxShadow: 'none',
          overflow: 'hidden',
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {!embedded ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexShrink: 0,
            padding: '12px 16px',
            borderBottom: '1px solid rgba(124, 244, 198, 0.18)',
            background: 'rgba(124, 244, 198, 0.05)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: '0.16em',
                color: '#7cf4c6',
                textTransform: 'uppercase',
              }}
            >
              Beat Pads · Drum Machine
            </span>
            <span style={{ fontSize: 9, fontWeight: 600, color: '#6a7280' }}>
              Bank {bankLabel} · 4×4 MPC pads · modules sidebar stays open · Esc to close
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {typeof onBeatLabMixerToggle === 'function' ? (
              <button
                type="button"
                onClick={() => onBeatLabMixerToggle()}
                title="Open Beat Lab mixer — CH 1–16 sampler pads"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  height: 30,
                  padding: '0 10px',
                  borderRadius: 6,
                  border: `1px solid ${beatLabMixerOpen ? 'rgba(0, 229, 255, 0.55)' : 'rgba(72, 78, 92, 0.45)'}`,
                  background: beatLabMixerOpen ? 'rgba(0, 229, 255, 0.14)' : 'rgba(8, 8, 12, 0.65)',
                  color: beatLabMixerOpen ? '#00E5FF' : '#8a9098',
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: 0.6,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                <SlidersHorizontal size={12} aria-hidden />
                Mixer
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              title="Close drum machine"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 30,
                padding: '0 12px',
                borderRadius: 6,
                border: '1px solid rgba(255, 255, 255, 0.14)',
                background: '#12121a',
                color: '#c8d0dc',
                fontSize: 10,
                fontWeight: 800,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <X size={14} aria-hidden /> Close
            </button>
          </div>
        </div>
        ) : null}

        {showEmbeddedMachineChrome ? (
        <div className="beat-pads-machine-chrome">
        <BeatPadsGenoSyncBar
          compact={embedded}
          pollBridge={!embedded}
          disabled={patternActionsDisabled}
          onApplyTransport={(opts) => {
            setLocalBpm(clampBeatPadsBpm(opts.bpm));
            setLoopBars(opts.loopBars);
            onGenoApplyTransport?.(opts);
          }}
          onHarmonyTrackIdChange={onGenoHarmonyTrackIdChange}
          trailing={
            typeof onLoadSoundFamilySample === 'function' ? (
              <SoundFamiliesBar
                inlineScroll
                hideTitle
                targetPad={editPad}
                onTargetPadChange={(pad) => onSelectPad?.(pad)}
                onLoadSample={onLoadSoundFamilySample}
                onPreviewSample={onPreviewSoundFamilySample}
                style={{ flex: '1 1 auto', minWidth: 0, width: '100%' }}
              />
            ) : undefined
          }
        />

        {showKitBar ? (
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: '8px 14px',
              borderBottom: '1px solid rgba(124, 244, 198, 0.12)',
              background: 'rgba(6, 8, 12, 0.92)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 6,
                rowGap: 4,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: '0.14em',
                  color: '#a78bfa',
                  flexShrink: 0,
                }}
              >
                KIT · BANK {bankLabel}
              </span>
              {typeof onKitSelectChange === 'function' ? (
                <select
                  value={kitDropdownValue}
                  disabled={patternActionsDisabled}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.startsWith('preset:')) setKit?.(v.slice(7));
                    onKitSelectChange(v);
                  }}
                  title="Preset label or load a saved kit (all 16 pads)"
                  style={{
                    padding: '4px 6px',
                    borderRadius: 4,
                  border: '1px solid rgba(167, 139, 250, 0.4)',
                  background: '#1e1e26',
                  color: '#e8e8f0',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: patternActionsDisabled ? 'not-allowed' : 'pointer',
                  maxWidth: 132,
                    minWidth: 0,
                    flex: '1 1 100px',
                  }}
                >
                  <optgroup label="Presets">
                    {presetKitNames.map((k) => (
                      <option key={`preset:${k}`} value={`preset:${k}`}>
                        {k}
                      </option>
                    ))}
                  </optgroup>
                  {savedKits.length > 0 ? (
                    <optgroup label="My saved kits">
                      {savedKits.map((sk) => (
                        <option key={`saved:${sk.id}`} value={`saved:${sk.id}`}>
                          ★ {sk.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              ) : null}
              {typeof onProducerKitIdChange === 'function' ? (
                <select
                  value={producerKitId}
                  onChange={(e) => onProducerKitIdChange(e.target.value as BeatLabProducerKitId)}
                  disabled={producerKitLoading || patternActionsDisabled}
                  title="Crew / producer flagship kit"
                  style={{
                    padding: '4px 6px',
                    borderRadius: 4,
                  border: '1px solid rgba(255, 200, 80, 0.4)',
                  background: '#1e1e26',
                  color: '#f0e6c8',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: producerKitLoading ? 'wait' : 'pointer',
                  maxWidth: 140,
                    minWidth: 0,
                    flex: '1 1 110px',
                  }}
                >
                  {BEAT_LAB_PRODUCER_KITS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.title}
                    </option>
                  ))}
                </select>
              ) : null}
              {typeof onLoadProducerKit === 'function' ? (
                <button
                  type="button"
                  disabled={producerKitLoading || patternActionsDisabled}
                  onClick={() => onLoadProducerKit()}
                  title="Load crew kit onto all pads on this bank"
                  style={{
                    ...miniBtn,
                    borderColor: 'rgba(255, 200, 80, 0.45)',
                    color: '#ffd966',
                    opacity: producerKitLoading || patternActionsDisabled ? 0.5 : 1,
                  }}
                >
                  {producerKitLoading ? 'Loading…' : 'Load kit'}
                </button>
              ) : null}
              {typeof onLoadDefaultKitToBank === 'function' ? (
                <BeatLabDefaultKitsButton
                  disabled={patternActionsDisabled}
                  activeBank={activeBank}
                  loadingKitId={loadingProducerKitId}
                  onLoadKitToBank={onLoadDefaultKitToBank}
                />
              ) : null}
              <BeatPadsSavedSessionsButton
                disabled={patternActionsDisabled}
                activeBank={activeBank}
                savedSessions={savedBeatPadsSessions}
                saveStatus={beatPadsSessionSaveStatus}
                onSaveSession={handleSaveBeatPadsSession}
                onLoadSession={onLoadBeatPadsSession}
                onRenameSession={onRenameBeatPadsSession}
                onDeleteSession={onDeleteBeatPadsSession}
              />
              {typeof onSaveKit === 'function' ? (
                <button
                  type="button"
                  disabled={patternActionsDisabled}
                  onClick={() => onSaveKit(`Kit ${bankLabel}`)}
                  title="Save kit only (all 16 pads + FX) — shared with Beat Lab"
                  style={{
                    ...miniBtn,
                    borderColor: 'rgba(167, 139, 250, 0.45)',
                    color: '#c4b5fd',
                  }}
                >
                  Save kit
                </button>
              ) : null}
              {typeof onSaveBeatPadsSession === 'function' ? (
                <button
                  type="button"
                  disabled={patternActionsDisabled}
                  onClick={() => handleQuickSaveKitAndLoop(`Kit+Loop ${bankLabel}`)}
                  title="Save this loop pattern and all 16 pad samples together — load later from Save loop"
                  style={{
                    ...miniBtn,
                    borderColor: 'rgba(124, 244, 198, 0.55)',
                    color: '#7cf4c6',
                    background: 'rgba(124, 244, 198, 0.1)',
                  }}
                >
                  Save kit & loop
                </button>
              ) : null}
              {typeof onExportWav === 'function' ? (
                <button
                  type="button"
                  disabled={patternActionsDisabled}
                  onClick={() => void handleExportWav()}
                  title="Download loop + kit as .wav audio file"
                  style={{
                    ...miniBtn,
                    borderColor: 'rgba(255, 200, 80, 0.45)',
                    color: '#ffd966',
                  }}
                >
                  Export WAV
                </button>
              ) : null}
              {typeof onExportToTrack === 'function' ? (
                <button
                  type="button"
                  disabled={patternActionsDisabled}
                  onClick={() => void handleExportToTrack()}
                  title="Bounce loop + kit to a new audio track on the timeline"
                  style={{
                    ...miniBtn,
                    borderColor: 'rgba(0, 229, 255, 0.45)',
                    color: '#00E5FF',
                    background: 'rgba(0, 229, 255, 0.08)',
                  }}
                >
                  Export to track
                </button>
              ) : null}
              {embedded ? (
                <div
                  className="beat-pads-vocalbox-promo"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  {beatPadsOrchHits ? (
                    <button
                      type="button"
                      className="beat-pads-orch-hits-round"
                      title="ORCH hits — Sound Families orchestra hits piano grid"
                      aria-pressed={orchHitsOpen}
                      aria-label="ORCH hits"
                      disabled={patternActionsDisabled}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (orchHitsOpen) {
                          // Closing: keep pattern, but always clear Sync — user must arm it again.
                          if (beatPadsOrchHits.syncedToBeatPads) {
                            beatPadsOrchHits.onSyncedToBeatPadsChange(false);
                          }
                          setOrchHitsOpen(false);
                          return;
                        }
                        setVocalBoxOpen(false);
                        if (lab808Open && beatPads808Lab?.syncedToBeatPads) {
                          beatPads808Lab.onSyncedToBeatPadsChange(false);
                        }
                        setLab808Open(false);
                        setOrchHitsOpen(true);
                      }}
                      style={{
                        width: 40,
                        height: 28,
                        borderRadius: 14,
                        flexShrink: 0,
                        padding: '0 4px',
                        border: orchHitsOpen
                          ? `1.5px solid ${BEAT_PADS_ORCH_HITS_ACCENT}`
                          : beatPadsOrchHits.syncedToBeatPads
                            ? '1.5px solid #4ade80'
                            : `1px solid ${BEAT_PADS_ORCH_HITS_ACCENT}99`,
                        background: orchHitsOpen
                          ? `radial-gradient(circle at 35% 30%, ${BEAT_PADS_ORCH_HITS_ACCENT}77, #1a1206 72%)`
                          : beatPadsOrchHits.syncedToBeatPads
                            ? 'radial-gradient(circle at 35% 30%, rgba(74,222,128,0.4), #12100a 72%)'
                            : `radial-gradient(circle at 35% 30%, ${BEAT_PADS_ORCH_HITS_ACCENT}40, #100c06 72%)`,
                        color:
                          orchHitsOpen || beatPadsOrchHits.syncedToBeatPads
                            ? '#fff8e8'
                            : BEAT_PADS_ORCH_HITS_ACCENT,
                        fontSize: 8,
                        fontWeight: 800,
                        letterSpacing: 0.3,
                        lineHeight: 1.05,
                        textAlign: 'center',
                        cursor: patternActionsDisabled ? 'default' : 'pointer',
                        opacity: patternActionsDisabled ? 0.5 : 1,
                        boxShadow: orchHitsOpen
                          ? `0 0 8px ${BEAT_PADS_ORCH_HITS_ACCENT}55`
                          : 'none',
                      }}
                    >
                      ORCH
                      {beatPadsOrchHits.syncedToBeatPads && !orchHitsOpen ? (
                        <span style={{ display: 'block', fontSize: 5, color: '#4ade80' }}>·</span>
                      ) : null}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={patternActionsDisabled}
                    onClick={() => {
                      setVocalBoxOpen((o) => !o);
                      if (lab808Open && beatPads808Lab?.syncedToBeatPads) {
                        beatPads808Lab.onSyncedToBeatPadsChange(false);
                      }
                      if (orchHitsOpen && beatPadsOrchHits?.syncedToBeatPads) {
                        beatPadsOrchHits.onSyncedToBeatPadsChange(false);
                      }
                      setLab808Open(false);
                      setOrchHitsOpen(false);
                    }}
                    title={
                      vocalBoxOpen
                        ? 'Close VocalBox — return to pad FX'
                        : 'VocalBox — create your own drum pattern with your mouth'
                    }
                    aria-label="VocalBox — create your own drum pattern with your mouth"
                    style={{
                      ...miniBtn,
                      height: 32,
                      minHeight: 32,
                      padding: '0 6px 0 0',
                      gap: 5,
                      overflow: 'hidden',
                      flexShrink: 0,
                      borderColor: vocalBoxOpen ? 'rgba(213, 0, 249, 0.65)' : 'rgba(213, 0, 249, 0.38)',
                      color: vocalBoxOpen ? '#f0c0ff' : '#D500F9',
                      background: vocalBoxOpen ? 'rgba(213, 0, 249, 0.2)' : 'rgba(213, 0, 249, 0.08)',
                      opacity: patternActionsDisabled ? 0.5 : 1,
                    }}
                  >
                    <img
                      src={BEAT_PADS_VOCALBOX_MIC_SRC}
                      alt=""
                      aria-hidden
                      style={{
                        ...BEAT_PADS_VOCALBOX_MIC_STYLE,
                        height: 32,
                        width: 68,
                      }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.03em', paddingRight: 2 }}>
                      VocalBox
                    </span>
                  </button>
                  <span
                    className="se2-beat-pads-electric-title beat-pads-vocalbox-tagline pointer-events-none select-none shrink-0"
                    title="VocalBox — create your own drum pattern with your mouth"
                    aria-hidden
                  >
                    <span className="se2-beat-pads-electric-title-word beat-pads-vocalbox-tagline-word">
                      {BEAT_PADS_VOCALBOX_TAGLINE}
                    </span>
                  </span>
                  {beatPads808Lab ? (
                    <button
                      type="button"
                      disabled={patternActionsDisabled}
                      onClick={() => {
                        setLab808Open((o) => {
                          if (o) {
                            // Closing: keep pattern, but always clear Sync — user must arm it again.
                            if (beatPads808Lab.syncedToBeatPads) {
                              beatPads808Lab.onSyncedToBeatPadsChange(false);
                            }
                            return false;
                          }
                          setVocalBoxOpen(false);
                          if (orchHitsOpen && beatPadsOrchHits?.syncedToBeatPads) {
                            beatPadsOrchHits.onSyncedToBeatPadsChange(false);
                          }
                          setOrchHitsOpen(false);
                          return true;
                        });
                      }}
                      title={
                        lab808Open
                          ? 'Close 808 Lab — pattern kept · Sync turns off (arm Sync when you want it with Beat Pads)'
                          : beatPads808Lab.syncedToBeatPads
                            ? '808 Lab — Synced to BeatPads (plays with drums)'
                            : '808 Lab — piano-roll 808s (turn Sync on to play with Beat Pads)'
                      }
                      aria-label="808 Lab — piano-roll 808s inside Beat Pads"
                      className="beat-pads-808lab-tab"
                      style={{
                        ...miniBtn,
                        height: 32,
                        minHeight: 32,
                        padding: '0 10px',
                        gap: 4,
                        overflow: 'hidden',
                        flexShrink: 0,
                        borderColor: lab808Open
                          ? 'rgba(0, 229, 255, 0.75)'
                          : beatPads808Lab.syncedToBeatPads
                            ? 'rgba(0, 229, 255, 0.55)'
                            : 'rgba(0, 229, 255, 0.42)',
                        color: lab808Open ? '#b8f7ff' : BEAT_PADS_808_LAB_ACCENT,
                        background: lab808Open
                          ? 'rgba(0, 229, 255, 0.22)'
                          : beatPads808Lab.syncedToBeatPads
                            ? 'rgba(0, 229, 255, 0.14)'
                            : 'rgba(0, 229, 255, 0.08)',
                        opacity: patternActionsDisabled ? 0.5 : 1,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.03em' }}>
                        808 Lab{beatPads808Lab.syncedToBeatPads && !lab808Open ? ' · SYNC' : ''}
                      </span>
                    </button>
                  ) : null}
                  {beatPads808Lab ? (
                    <span
                      className="se2-beat-pads-electric-title beat-pads-808lab-chord-lock pointer-events-none select-none shrink-0"
                      title="Chord Lock Technology — 808 roots follow your harmony"
                      aria-hidden
                      style={{
                        fontSize: 7,
                        letterSpacing: '0.08em',
                        marginLeft: 2,
                      }}
                    >
                      <span className="se2-beat-pads-electric-title-word">
                        {SE2_LAB808_DOCK_TECH_LABEL}
                      </span>
                    </span>
                  ) : null}
                </div>
              ) : null}
              {exportStatus ? (
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    color: '#9aa3b0',
                    lineHeight: 1.2,
                    flex: '1 1 120px',
                    minWidth: 0,
                  }}
                >
                  {exportStatus}
                </span>
              ) : null}
              {producerKitTribute && !embedded ? (
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    color: '#c9a227',
                    lineHeight: 1.2,
                    flex: '1 1 120px',
                    minWidth: 0,
                  }}
                >
                  {producerKitTribute}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
        </div>
        ) : null}

        <div
          className="beat-pads-808lab-stage"
          style={{
            position: 'relative',
            flex: '1 1 auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
        {showEmbeddedMachineChrome ? (
        <div
          className="beat-pads-pad-fx-row"
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            padding: '4px 12px 4px 18px',
            boxSizing: 'border-box',
            borderBottom: '1px solid rgba(124, 244, 198, 0.14)',
            background: 'rgba(0, 0, 0, 0.22)',
            minHeight: PAD_BLOCK_H,
          }}
        >
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 6,
              height: PAD_BLOCK_H,
            }}
          >
            <div
              style={{
                width: 280,
                maxWidth: 280,
                height: PAD_BLOCK_H,
                flexShrink: 0,
                display: 'flex',
                overflow: 'hidden',
              }}
            >
              {showPatternBank ? (
                <BeatPadsPatternBankSidebar
                  onLoadPreset={handleSidebarPatternPick}
                  disabled={patternBankDisabled || patternActionsDisabled}
                  patternSlot={patternSlot}
                  onPatternSlotChange={onPatternSlotChange}
                  loadedBankId={loadedPatternBankId}
                  loadedPresetId={loadedPatternPresetId}
                  selectedLane={editPad}
                  laneLabel={laneLabel}
                  laneDrumRole={laneDrumRole}
                  onLaneDrumRoleChange={handleLaneDrumRoleChange}
                  onApplyLaneTemplate={handleApplyLaneTemplate}
                  onLaneBpmChange={handleTransportBpmChange}
                  onAutoDrumPadSample={onAutoDrumPadSample}
                  activeLaneTemplateId={activeLaneTemplateId}
                  activeLaneTemplateName={activeLaneTemplateName}
                />
              ) : null}
            </div>
            <div
              className="beat-pads-pad-grid"
              style={{
                width: PAD_BLOCK_W,
                height: PAD_BLOCK_H,
                flexShrink: 0,
                display: 'grid',
                gridTemplateColumns: `repeat(4, ${PAD_SIZE}px)`,
                gridTemplateRows: `repeat(4, ${PAD_SIZE}px)`,
                gap: PAD_GRID_GAP,
                boxSizing: 'border-box',
                filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.55))',
              }}
            >
          {Array.from({ length: PAD_COUNT }, (_, padIndex) => {
            const label = padLabelForPad?.(padIndex)?.trim() || `Pad ${padIndex + 1}`;
            const shortLabel = label.length > 12 ? `${label.slice(0, 10)}…` : label;
            const loaded = hasPadSample?.(padIndex) ?? false;
            const selected = selectedPad === padIndex;
            const lit = litPad === padIndex;
            const accent = lab808PadAccentFromLabel(label, padIndex);

            return (
              <button
                key={padIndex}
                type="button"
                className="cs-pad-hit lab808-pad-hit"
                aria-label={`Pad ${padIndex + 1} ${label}`}
                aria-pressed={selected}
                onPointerDown={(e) => strike(padIndex, e)}
                onPointerUp={releaseLit}
                onPointerCancel={releaseLit}
                onLostPointerCapture={releaseLit}
                title={`Pad ${padIndex + 1} · ${label}${loaded ? ' · loaded' : ''}`}
                style={{
                  width: PAD_SIZE,
                  height: PAD_SIZE,
                  minWidth: 0,
                  minHeight: 0,
                  maxWidth: PAD_SIZE,
                  maxHeight: PAD_SIZE,
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'flex-end',
                  padding: '5px 6px 6px',
                  borderRadius: 8,
                  border: `2px solid ${lab808PadBorder(accent, selected || lit)}`,
                  background: lab808PadSurface(accent, lit || selected),
                  boxShadow: lit
                    ? `0 0 14px color-mix(in srgb, ${accent} 50%, transparent), inset 0 1px 0 rgba(255,255,255,0.1)`
                    : selected
                      ? `0 0 12px color-mix(in srgb, ${accent} 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.08)`
                      : 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -2px 0 rgba(0,0,0,0.35)',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  userSelect: 'none',
                  color: '#e4e4e7',
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: 'rgba(255,255,255,0.35)',
                    letterSpacing: '0.06em',
                    alignSelf: 'flex-start',
                    lineHeight: 1,
                  }}
                >
                  {padIndex + 1}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    lineHeight: 1.1,
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: 'auto',
                    color: selected || lit ? '#f0fdf4' : loaded ? '#d4d4d8' : 'rgba(255,255,255,0.72)',
                    textShadow: `0 0 8px color-mix(in srgb, ${accent} 35%, transparent)`,
                  }}
                  title={label}
                >
                  {shortLabel}
                </span>
              </button>
            );
          })}
            </div>
          </div>

          <div
            className="beat-pads-fx-box"
            style={{
              flex: `1 1 ${PAD_FX_BOX_MAX_W}`,
              minWidth: 280,
              maxWidth: PAD_FX_BOX_MAX_W,
              width: PAD_FX_BOX_MAX_W,
              height: PAD_FX_PANEL_H,
              overflow: 'hidden',
              boxSizing: 'border-box',
              position: 'relative',
            }}
          >
            {embedded && showFxPanel ? (
              <div className="beat-pads-fx-per-pad-hint" aria-hidden>
                <span className="beat-pads-fx-per-pad-hint__text">Effects per pad</span>
                <span className="beat-pads-fx-per-pad-hint__arrow">→</span>
              </div>
            ) : null}
            {embedded && vocalBoxOpen ? (
              <div
                className="beat-pads-vocalbox-drop"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  zIndex: 4,
                  padding: '0 0 4px',
                  pointerEvents: 'auto',
                }}
              >
                <BeatPadsVocalBoxPanel
                  bpm={localBpm}
                  loopBars={loopBars}
                  stepsPerBar={gridStepsPerBar}
                  beatsPerBar={se2BeatsPerBar}
                  pattern={pattern}
                  onPatternChange={handlePatternChange}
                  padLabelForPad={padLabelForPad}
                  onStrikePad={(padIndex, velocity01, gridCol, whenSec) =>
                    onStrikePad(padIndex, velocity01, gridCol, whenSec)
                  }
                  hasPadSample={hasPadSample}
                  getAudioContext={getAudioContext}
                  getAudioOutput={getAudioOutput}
                  warmAudio={onWarmAudio}
                  onEnsurePadSamples={
                    typeof onLoadProducerKit === 'function'
                      ? () => Promise.resolve(onLoadProducerKit())
                      : undefined
                  }
                  disabled={patternActionsDisabled}
                />
              </div>
            ) : null}
            {showFxPanel ? (
              <BeatLabDrumMachineFxPanel
                padIndex={editPad}
                padLabel={padLabel}
                hasSample={hasPadSample?.(editPad) ?? false}
                getSamplerOpts={getPadSamplerOpts!}
                commitSamplerOpts={commitPadSamplerOpts!}
                getFxRack={getPadSamplerFxRack!}
                commitFxRack={commitPadSamplerFxRack!}
                onLiveFxRack={onLivePadFxRackDraft}
                onLiveSamplerDraft={onLiveSamplerDraft}
                getPadSampleAudioBuffer={getPadSampleAudioBuffer}
                getDrumPadVoice={getDrumPadVoice}
                commitDrumPadVoice={commitDrumPadVoice}
                onLiveDrumPadVoiceDraft={handleLiveDrumPadVoiceDraft}
                rollDrawActive={rollDrawActive}
                onRollDrawChange={handleRollDrawChange}
                onPreviewPad={
                  typeof onPreviewDrumPad === 'function' ? () => onPreviewDrumPad(editPad) : undefined
                }
                onSpreadHitToPads={
                  typeof onSpreadHitToPads === 'function'
                    ? (direction) => onSpreadHitToPads(editPad, direction, gridStepsPerBar)
                    : undefined
                }
                onUndoSpread={
                  typeof onUndoSpreadHitToPads === 'function'
                    ? () => onUndoSpreadHitToPads(editPad)
                    : undefined
                }
                spreadActive={beatPadsSpreadActive}
                beatPadsSpreadDirection={beatPadsSpreadDirection}
                beatPadsSpreadRootMidi={beatPadsSpreadRootMidi}
                beatPadsSpreadBaseLabel={beatPadsSpreadBaseLabel}
                beatPadsSpreadNotes={beatPadsSpreadNotes}
                beatPadsSpreadLoopBars={beatPadsSpreadLoopBars}
                beatPadsSpreadStepsPerBar={gridStepsPerBar}
                beatPadsSpreadMixerChannel={beatPadsSpreadMixerChannel}
                beatPadsSpreadKeyLockEnabled={beatPadsSpreadKeyLockEnabled}
                beatPadsSpreadKeyLabel={beatPadsSpreadKeyLabel}
                beatPadsSpreadHarmonyLane={beatPadsSpreadHarmonyLane}
                beatPadsSpreadHarmonyLaneNotes={beatPadsSpreadHarmonyLaneNotes}
                beatPadsSpreadSe2MatchTrackOptions={beatPadsSpreadSe2MatchTrackOptions}
                beatPadsSpreadHarmonyTrackIndex={beatPadsSpreadHarmonyTrackIndex}
                onBeatPadsSpreadNotesChange={onBeatPadsSpreadNotesChange}
                onBeatPadsSpreadLoopBarsChange={onBeatPadsSpreadLoopBarsChange}
                onBeatPadsSpreadDirectionChange={onBeatPadsSpreadDirectionChange}
                onBeatPadsSpreadMixerChannelChange={onBeatPadsSpreadMixerChannelChange}
                onBeatPadsSpreadKeyLockChange={onBeatPadsSpreadKeyLockChange}
                onBeatPadsSpreadHarmonyLaneChange={onBeatPadsSpreadHarmonyLaneChange}
                onBeatPadsSpreadHarmonyTrackIndexChange={onBeatPadsSpreadHarmonyTrackIndexChange}
                onBeatPadsSpreadRegenerateChordRoots={onBeatPadsSpreadRegenerateChordRoots}
                onPreviewBeatPadsSpreadRow={onPreviewBeatPadsSpreadRow}
                onStrikeBeatPadsSpreadRow={onStrikeBeatPadsSpreadRow}
                onWarmAudio={onWarmAudio}
                getAudioContext={getAudioContext}
                beatPadsSpreadMidiExportTrackOptions={beatPadsSpreadMidiExportTrackOptions}
                beatPadsSpreadWavExportTrackOptions={beatPadsSpreadWavExportTrackOptions}
                beatPadsSpreadDefaultMidiExportTrackIndex={beatPadsSpreadDefaultMidiExportTrackIndex}
                beatPadsSpreadDefaultWavExportTrackIndex={beatPadsSpreadDefaultWavExportTrackIndex}
                onExportBeatPadsSpreadMidi={onExportBeatPadsSpreadMidi}
                onExportBeatPadsSpreadWav={onExportBeatPadsSpreadWav}
                beatPadsSpreadExportStatus={beatPadsSpreadExportStatus}
                onLoadPad={typeof onLoadPad === 'function' ? () => onLoadPad(editPad) : undefined}
                onOpenKitBrowser={
                  typeof onOpenKitBrowser === 'function' ? () => onOpenKitBrowser() : undefined
                }
                onUploadPad={typeof onUploadPad === 'function' ? () => onUploadPad() : undefined}
                waveformPlacement="external"
                onExternalWaveformProps={handleExternalWaveformProps}
                compactLayout
                panelHeight={PAD_FX_PANEL_H}
                sessionBpm={localBpm}
              />
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 16,
                  borderRadius: 8,
                  border: '1px solid rgba(124, 244, 198, 0.22)',
                  background:
                    'linear-gradient(165deg, rgba(11, 11, 16, 0.55) 0%, rgba(8, 8, 12, 0.95) 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                  color: '#8a9098',
                  fontSize: 10,
                  textAlign: 'center',
                }}
              >
                Pad edit panel loading…
              </div>
            )}
          </div>
        </div>
        ) : null}

        {embedded && lab808Open && beatPads808Lab ? (
          <div
            className="beat-pads-808lab-drop"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 80,
              display: 'flex',
              flexDirection: 'column',
              padding: '0 6px 6px',
              boxSizing: 'border-box',
              pointerEvents: 'auto',
              background: 'rgba(4, 12, 18, 0.94)',
            }}
          >
            <BeatPads808LabPanel
              bpm={localBpm}
              trackId={beatPads808Lab.trackId}
              trackName={beatPads808Lab.trackName}
              accentHex={BEAT_PADS_808_LAB_ACCENT}
              disabled={patternActionsDisabled}
              songKeyRoot={beatPads808Lab.songKeyRoot}
              songKeyMode={beatPads808Lab.songKeyMode}
              studioTracks={beatPads808Lab.studioTracks}
              lanePad={beatPads808Lab.lanePad}
              voice={beatPads808Lab.voice}
              onVoiceChange={beatPads808Lab.onVoiceChange}
              syncedToBeatPads={beatPads808Lab.syncedToBeatPads}
              onSyncedToBeatPadsChange={beatPads808Lab.onSyncedToBeatPadsChange}
              getAudioContext={getAudioContext ?? (() => null)}
              getPreviewDestination={beatPads808Lab.getPreviewDestination}
              warmAudio={onWarmAudio}
              onExportToneGridToPianoRoll={beatPads808Lab.onExportToneGridToPianoRoll}
              onExportToneGridWavToTrack={beatPads808Lab.onExportToneGridWavToTrack}
              fullBleed
            />
          </div>
        ) : null}

        {embedded && orchHitsOpen && beatPadsOrchHits ? (
          <div
            className="beat-pads-orch-hits-drop"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 120,
              display: 'flex',
              flexDirection: 'column',
              padding: '4px 6px 6px',
              boxSizing: 'border-box',
              pointerEvents: 'auto',
              background: 'rgba(12, 8, 4, 0.96)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 8,
                flexShrink: 0,
                marginBottom: 4,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (beatPadsOrchHits.syncedToBeatPads) {
                    beatPadsOrchHits.onSyncedToBeatPadsChange(false);
                  }
                  setOrchHitsOpen(false);
                }}
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: `1px solid ${BEAT_PADS_ORCH_HITS_ACCENT}`,
                  background: `${BEAT_PADS_ORCH_HITS_ACCENT}22`,
                  color: BEAT_PADS_ORCH_HITS_ACCENT,
                  cursor: 'pointer',
                }}
              >
                Close ORCH
              </button>
            </div>
            <BeatPadsOrchHitsPanel
              bpm={localBpm}
              accentHex={BEAT_PADS_ORCH_HITS_ACCENT}
              disabled={patternActionsDisabled}
              trackId={beatPadsOrchHits.trackId}
              songKeyRoot={beatPadsOrchHits.songKeyRoot}
              songKeyMode={beatPadsOrchHits.songKeyMode}
              studioTracks={beatPadsOrchHits.studioTracks}
              lanePad={beatPadsOrchHits.lanePad}
              voice={beatPadsOrchHits.voice}
              onVoiceChange={beatPadsOrchHits.onVoiceChange}
              syncedToBeatPads={beatPadsOrchHits.syncedToBeatPads}
              onSyncedToBeatPadsChange={beatPadsOrchHits.onSyncedToBeatPadsChange}
              getAudioContext={getAudioContext ?? (() => null)}
              getPreviewDestination={beatPadsOrchHits.getPreviewDestination}
              warmAudio={onWarmAudio}
              exportTrackOptions={beatPadsOrchHits.exportTrackOptions}
              onExportMidiToTrack={beatPadsOrchHits.onExportMidiToTrack}
              fullBleed
            />
          </div>
        ) : null}

        {renderSequencerPane()}
        </div>
      </div>
    </div>
  );

  if (embedded) return body;
  if (typeof document === 'undefined') return null;
  const portalRoot = document.querySelector('main') ?? document.body;
  return createPortal(body, portalRoot);
}
