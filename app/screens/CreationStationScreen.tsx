import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useSyncExternalStore,
  useRef,
  useCallback,
  useMemo,
  memo,
} from 'react';
import type { MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, Zap, ChevronUp, ChevronDown, Volume2, Play, Pause, Square, Circle, SkipBack, Repeat, Save, Cable, Upload, FolderOpen, X, Download, Plus, SlidersHorizontal, Music2, Waves, Copy, Undo2 } from 'lucide-react';

import {
  useMasterClock,
  PPQ,
} from '@/app/context/MasterClockContext';
import { useSettings } from '@/app/context/SettingsContext';
import { useMidiInputRoute } from '@/app/hooks/useMidiInputRoute';
import { MIDI_INPUT_ROUTES, midiDrumNoteToPadIndex } from '@/app/lib/midi/midiInputBus';

import { usePianoNotes } from '@/app/context/PianoNotesContext';
import LoopMarkersBrace, { LoopVerticalGuides } from '@/app/components/LoopMarkersBrace';


import {
  computeUsedCreationChannelMeta,
  writeCreationChannelManifestToStorage,
  DA_SESSION_TRACKS_SYNC_EVENT,
  CREATION_PAD_NAMES as PAD_NAMES,
  CREATION_PAD_COLORS as PAD_COLORS,
} from '@/app/lib/sessionChannelTracks';

import { CREATION_STATION_CLIP_DATA_KEY } from '@/app/lib/sessionClipContent';
import { KEY_ROOTS, MODE_LABELS, type ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { readChordSync } from '@/app/lib/chordBuilderSync';
import { beatLabMelodicChannelForLane } from '@/app/lib/creationStation/beatLabSynthV2LaneRoles';
import { markBeatLabBootRendered } from '@/app/lib/boot/beatLabBootGate';

/* Beat Lab: **own** transport (CreationStation + creationStation/*). Mirrors proven DAW patterns
 * that also exist in Studio Editor 2 — SE2 is read-only reference; never import/link/edit SE2 here.
 * `se2TransportClock` = shared math/constants only, not SE2 transport state. */
import {
  SE2_AUDIO_START_FLOOR_SEC,
  refillCreationMetronome,
  refillCreationTransportLookahead,
  resetCreationTransportStepClock,
  reanchorNextStepWhileRunning,
  reanchorNextStepWhileStopped,
  seedCreationTransportOnPlay,
} from '@/app/lib/creationStation/creationTransportSystem';
import {
  tickBeatLabChannelMeters,
} from '@/app/lib/creationStation/beatLabChannelMeters';
import {
  beatLabAnimationTickBeats,
  beatLabAnimationTickLoopWrap,
  beatLabSynth2AnimationTickLoopWrap,
  beatFromCreationPlaylineWapiAnim,
  beatLabAudioNow,
  beatLabDisplayBeatFromAudioClock,
  beatLabRewindTargetBeat,
  beatLabSnapBeatToQuarterGrid,
  beatLabVisualBeatFromWapi,
} from '@/app/lib/creationStation/beatLabSe2TransportEngine';
import { resolveBeatLabAudioContext, beatLabSampleDrumRefillOpts, resetBeatLabSampleDrumClock, seedBeatLabSampleDrumClock, syncBeatLabSampleDrumClockToBeat } from '@/app/lib/creationStation/beatLabStepScheduler';
import { useBeatLabSe2TransportMirror } from '@/app/hooks/useBeatLabSe2TransportMirror';
import {
  getCreationTransportBeatEpoch,
  publishCreationTransportBeat,
  subscribeCreationTransportBeat,
} from '@/app/lib/creationStation/creationTransportBeatExternal';
import {
  beatAtSessionTime,
  cancelCreationScheduledMetroNodes,
  ensureCreationMetronomeClickBuffers,
  scheduleCreationMetronomeClickAt,
  isGrooveLabScreenActive,
  isGrooveLabTransportRunning,
  setCreationBeatLabTransportRunning,
  setGrooveLabScreenActive,
  setLab808ScreenActive,
  type CreationMetronomeClickBuffers,
  type CreationScheduledMetroNode,
} from '@/app/lib/creationStation/creationTransportSync';
import { smoothSchedNow, updateSchedAnchor } from '@/app/lib/studio/se2TransportClock';
import {
  CREATION_DRUM_PLAYLINE_CENTER_X,
  CREATION_PIANO_PLAYLINE_CENTER_X,
  CREATION_PLAYLINE_WAPI_SEG_IDLE,
  cancelCreationPlaylineWapi,
  creationPlaylineColFAndPx,
  creationPlaylineWapiCompositorMs,
  CREATION_SE2_PLAYHEAD_GRIP_W_PX,
  CREATION_SE2_PLAYHEAD_LINE_W_PX,
  kickCreationPlaylineWapiPlaying,
  launchCreationPlaylineWapi,
  creationPlaylineAnimIsLive,
  resolveCreationActivePlaylineAnim,
  resolveCreationDrumPlaylineAnim,
  setCreationPlaylineTransformStatic,
  type CreationPlaylineWapiSegState,
} from '@/app/lib/creationStation/creationPlaylineWapi';
import {
  beatLabGridStepsPerQuarter,
  beatLabMeasureDigitForQuarterIndex,
  creationDrumGridStepBottomBorder,
  creationDrumGridVerticalLineColor,
} from '@/app/lib/creationStation/creationDrumGridAdaptive';
import {
  beatLabDrumStepTileLook,
  beatLabTileGridActive,
  loadBeatLabTileGridPref,
  saveBeatLabTileGridPref,
} from '@/app/lib/creationStation/beatLabTileGrid';
import {
  beatLabScrollGridFollowPlayhead,
  scrollBeatLabContainerToPlayhead,
} from '@/app/lib/creationStation/beatLabGridPlayheadScroll';

import {
  defaultPadSamplerPlaybackOpts,
  fileToStoredPadSample,
  loadPadSampleStore,
  padSampleKey,
  type PadSamplerPlaybackOpts,
  type StoredPadSample,
  samplerOptsFromStored,
  savePadSampleStore,
  storedToArrayBuffer,
  writeSamplerOptsToStored,
  writeChromaticPadMetaToStored,
  chromaticPadMetaFromStored,
} from '@/app/lib/padSampleStorage';
import {
  clonePadSamplerFxRack,
  connectPadSamplerFxRack,
  padSamplerDelayTimeLabel,
  padSamplerDelayTimeMs,
  PAD_SAMPLER_DELAY_NOTE_OPTIONS,
  defaultPadSamplerFxRack,
  fxRackFromStored,
  padSamplerFxRackIsActive,
  writeFxRackToStored,
  type PadSamplerFxRack,
} from '@/app/lib/creationStation/padSamplerFxRack';
import { DrumKitGeneratorModal } from '@/app/components/creation/DrumKitGeneratorModal';
import { BeatLabMixerOverlay } from '@/app/components/creation/BeatLabMixerOverlay';
import { BeatLabDrumMachineOverlay } from '@/app/components/creation/BeatLabDrumMachineOverlay';
import {
  beatLabDrumPadVoiceKey,
  beatLabDrumVoiceGridVelocity,
  beatLabDrumVoiceManualVelocity,
  beatLabDrumVoiceScheduleOffsetSec,
  beatLabDrumVoiceToSamplerOpts,
  clampBeatLabDrumPadVoiceOpts,
  defaultBeatLabDrumPadVoiceOpts,
  loadBeatLabDrumPadVoiceStore,
  saveBeatLabDrumPadVoiceStore,
  warmBeatLabLivePadAudio,
  type BeatLabDrumPadVoiceOpts,
} from '@/app/lib/creationStation/beatLabDrumPadVoice';
import {
  BEAT_PADS_MAX_LOOP_BARS,
  BEAT_PADS_MIN_LOOP_BARS,
  BEAT_PADS_STEPS_PER_BAR,
  normalizeBeatPadsPattern,
  type BeatPadsDrumPattern,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import { beatPadsConvertPatternGridSteps, beatPadsPatternToStepGrid } from '@/app/lib/creationStation/beatPadsPatternEdit';
import {
  readBeatPadsSpreadSession,
  writeBeatPadsSpreadSession,
  beatPadsSpreadSessionFromTrack,
} from '@/app/lib/creationStation/beatPadsSpreadSession';
import {
  bankLooksLikeBeatPadsSpread,
  type BeatPadsSpreadDirection,
} from '@/app/lib/creationStation/beatPadsHitSpread';
import {
  beatPadsSpreadClampNotesToLoop,
  beatPadsSpreadConvertNotesGridSteps,
  beatPadsSpreadDefaultHarmonyLane,
  beatPadsSpreadKeyLockSemiAtCol,
  buildBeatPadsSpreadVoiceFromPad,
  playBeatPadsSpreadRow,
  BEAT_PADS_SPREAD_MIXER_CH,
  clampBeatPadsSpreadMixerChannel,
  type BeatPadsSpreadLoopBars,
  type BeatPadsSpreadNote,
  type BeatPadsSpreadTrackState,
  type BeatPadsSpreadVoice,
} from '@/app/lib/creationStation/beatPadsSpreadTrack';
import { generateBeatPadsSpreadChordRootNotes } from '@/app/lib/creationStation/beatPadsSpreadChordGenerate';
import {
  buildBeatPadsStudioImport,
  type PendingBeatPadsStudioImport,
} from '@/app/lib/creationStation/beatPadsStudioExport';
import {
  consumeBeatPadsOpenFromSe2,
} from '@/app/lib/creationStation/beatPadsSe2Bridge';
import {
  countBeatPadsSessionNotes,
  deleteBeatPadsSavedSession,
  findBeatPadsSavedSession,
  loadBeatPadsSavedSessions,
  renameBeatPadsSavedSession,
  upsertBeatPadsSavedSession,
  type BeatPadsSavedSession,
} from '@/app/lib/creationStation/beatPadsSavedSessions';
import { TrapKitBrowserPanel } from '@/app/components/creation/TrapKitBrowserPanel';
import { SoundFamiliesBar } from '@/app/components/creation/SoundFamiliesBar';
import { PatternBankPanel } from '@/app/components/creation/PatternBankPanel';
import { BeatLabHelpProvider, BeatLabHelpTip } from '@/app/components/creation/BeatLabHelpHub';
import { BeatLabDefaultKitsButton } from '@/app/components/creation/BeatLabDefaultKitsButton';
import { BeatLabSavedKitsButton } from '@/app/components/creation/BeatLabSavedKitsButton';
import { BeatLabSavedPatternsButton } from '@/app/components/creation/BeatLabSavedPatternsButton';
import { PadFxHorizontalTCapSlider, PadFxVerticalFader, PadSamplerEqCompControls, PadSamplerFxTCapStyles } from '@/app/components/creation/PadSamplerFxWidgets';
import {
  beatLabPatternBankCategoryLabel,
  beatLabPatternBankIdForPresetGenre,
  BEAT_LAB_USER_SAVES_BANK_ID,
  BEAT_LAB_PRESET_LOOP_BARS,
  presetToBeatLabDrums,
  type BeatLabPatternBankId,
} from '@/app/lib/creationStation/beatLabPatternBank';
import { BEAT_LAB_DEFAULT_BPM } from '@/app/lib/creationStation/beatLabFactoryDefaults';
import { beatLabModernRnbDrumsPostProcess } from '@/app/lib/creationStation/beatLabModernRnbPatterns';
import { getPatternPresetBpm, getPatternPresetProducerGridBpm, type PatternPreset } from '@/app/lib/patternPresets';
import { beatLabTrapProducerGridBpmLabel } from '@/app/lib/creationStation/beatLabTrapTempo';
import { registerBeatLabMeterVoice } from '@/app/lib/creationStation/beatLabChannelMeters';
import { playPadSampleBuffer } from '@/app/lib/creationStation/padSamplePlayback';
import {
  audioBufferToStoredKitSample,
  buildKitGroovePattern,
  synthesizeKitPadBuffer,
  type DrumKitGeneratorStyle,
} from '@/app/lib/creationStation/drumKitGenerator';
import { ChordBuilderTab } from '@/app/components/creation/ChordBuilderTab';
import { CreationSessionLinkStrip } from '@/app/components/creation/CreationSessionLinkStrip';
import {
  CREATION_SESSION_LINK_CHANGED,
  GROOVE_LAB_BEATLAB_MIRROR_CHANGED,
  GROOVE_LAB_BEATLAB_MIRROR_EVENT,
  dispatchCreationSessionPlayMirror,
  type GrooveLabBeatlabMirrorDetail,
  type CreationSessionPlayMirrorVisibility,
  readCreationSessionLink,
  readGrooveLabBeatlabPlayMirror,
  storeCreationSessionLink,
  storeGrooveLabBeatlabPlayMirror,
  toggleCreationSessionBpmLink,
  toggleCreationSessionPlayLink,
  type CreationSessionLinkModuleId,
  type CreationSessionLinkState,
} from '@/app/lib/creationStation/creationSessionLink';
import {
  beatLabChordRailFromImportSections,
  beatLabLaneNoteLenCols,
  beatLabPatternColsForLoop,
  beatLabStepsPerBar,
  chordBuilderSongRollToBeatLabRoll,
  snapBeatLabChordNotesToBarDownbeats,
  type BeatLabImportedChordRail,
  type ChordBuilderBeatLabImportSection,
} from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import {
  grooveProgressionStepsToChordRail,
  grooveRollBarsNeeded,
  grooveProgressionStepsToBeatLabRoll,
  grooveRollHitsToBeatLabRoll,
  grooveRollHitsToChordRail,
} from '@/app/lib/creationStation/grooveLabBeatLabImport';
import { writeBeatLabSynthChordRailSync } from '@/app/lib/creationStation/lab808ChordLockSources';
import {
  dispatchGrooveLabLocalTransport,
  LAB808_SYNC_CHANGED_EVENT,
  LAB808_TRANSPORT_MIRROR_EVENT,
  readLab808TransportMirror,
  storeLab808BpmSyncTarget,
  storeLab808TransportMirror,
  type Lab808TransportMirrorDetail,
} from '@/app/lib/creationStation/lab808Sync';
import {
  beatLabSynthV2ApplyChordHarmonyMute,
  beatLabSynthV2HarmonyColumnsOnLane,
  beatLabSynthV2IsChordHarmonyMuted,
  beatLabSynthV2IsLowestNoteAtCol,
  beatLabSynthV2ResyncBassToHarmony,
} from '@/app/lib/creationStation/beatLabSynthV2BasslineGenerator';
import {
  beatLabSynth2IsBassLane,
  beatLabSynth2IsHarmonyLane,
  beatLabSynth2NormalizePair,
  readStoredBeatLabSynth2Lanes,
  storeBeatLabSynth2Lanes,
} from '@/app/lib/creationStation/beatLabSynthV2LaneRoles';
import {
  BEAT_LAB_SYNTH2_DEFAULT_PIANO_INSTRUMENT,
  normalizeBeatLabSynth2PianoInstrument,
  beatLabSynth2PianoRollInstrumentGain,
} from '@/app/lib/creationStation/beatLabSynthV2PianoBank';
import { BeatLabSynthV2ChannelAssign } from '@/app/components/creation/BeatLabSynthV2ChannelAssign';
import {
  ensureBeatLabMelodicInstrumentsReady,
  haltBeatLabMelodicTransportNotes,
  scheduleBeatLabMelodicNote,
} from '@/app/lib/creationStation/beatLabMelodicSoundfont';
import { BeatLabPianoRoll } from '@/app/components/creation/BeatLabPianoRoll';
import { BeatLabSnapGridOverlay } from '@/app/components/creation/BeatLabSnapGridOverlay';
import { CreationSe2PlayheadMark } from '@/app/components/creation/CreationSe2PlayheadMark';
import { BeatLabMelodicChannelPanel } from '@/app/components/creation/BeatLabMelodicChannelPanel';
import { BeatLabSynthPianoRoll } from '@/app/components/creation/BeatLabSynthPianoRoll';
import { BeatLabSynthV2Panel } from '@/app/components/creation/BeatLabSynthV2Panel';
import { BeatLabSynthV2Workspace } from '@/app/components/creation/BeatLabSynthV2Workspace';
import {
  beatLabSynth2BeatFromPlaylineWapiAnim,
  beatLabSynth2BeatToQuarterColF,
  beatLabSynth2QuarterColFToPx,
  cancelBeatLabSynth2PlaylineWapi,
  createBeatLabSynth2PlaylineWapiRefs,
  launchBeatLabSynth2PlaylineWapi,
  seekRunningBeatLabSynth2PlaylineWapi,
  snapBeatLabSynth2PlaylineStatic,
} from '@/app/lib/creationStation/beatLabSynth2PlaylineWapi';
import {
  refillBeatLabSynth2Schedule,
  seedBeatLabSynth2TransportOnPlay,
  type BeatLabSynth2TransportClock,
  type BeatLabSynth2TransportData,
} from '@/app/lib/creationStation/beatLabSynth2Transport';
import { beatLabSynthQuarterCellW } from '@/app/lib/creationStation/beatLabChordPianoRollAdapter';
import { CB_PIANO_LABEL_W } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import { beatLabSynthWapiPianoColW } from '@/app/lib/creationStation/beatLabChordPianoRollAdapter';
import {
  BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS,
  BEAT_LAB_MELODIC_INSTRUMENT_OPTIONS,
  BEAT_LAB_PIANO_TRANSPORT_ONSET_LEAD_SEC,
  beatLabMelodicSlotIndex,
  normalizeBeatLabMelodicInstruments,
  previewBeatLabMelodicNote,
  resetBeatLabMelodicWarmupFlag,
  startBeatLabMelodicPreview,
  warmupBeatLabMelodicSoundfont,
} from '@/app/lib/creationStation/beatLabMelodicSoundfont';
import {
  BEAT_LAB_DEFAULT_SYNTH_PRESET_ID,
  beatLabBassSynthPresetById,
  normalizeBeatLabMelodicSynthPresetIds,
} from '@/app/lib/creationStation/beatLabMelodicSynthPresets';
import {
  beatLabBassSynthVoiceParamsFromPresetId,
  normalizeBeatLabBassSynthVoiceParams,
} from '@/app/lib/creationStation/beatLabMelodicSynthV2State';
import {
  previewBeatLabSynthV2Note,
  scheduleBeatLabSynthV2Note,
  haltBeatLabSynthV2TransportVoices,
  isBeatLabSynthV2HeldPreviewActive,
  startBeatLabSynthV2HeldPreview,
  stopBeatLabSynthV2HeldPreview,
  touchBeatLabSynthV2HeldPreview,
  playBeatLabSynthV2KeyboardNote,
  releaseBeatLabSynthV2Keyboard,
} from '@/app/lib/creationStation/beatLabMelodicSynthV2Engine';
import {
  haltChordSequencerTransportVoices,
  restoreChordSequencerTransportVoices,
} from '@/app/lib/creationStation/chordSequencerVoices';
import {
  beatLabSynthV2ChordGlideSourceMidi,
  beatLabSynthV2LegatoSourceMidi,
  beatLabSynthV2TransportDurationSec,
  resetBeatLabSynthV2GlideState,
} from '@/app/lib/creationStation/beatLabMelodicSynthV2Timing';
import { beatLabNoteMidi, beatLabPitchSemiForMidi } from '@/app/lib/creationStation/beatLabMelodicSynth';
import {
  BeatLabEditToolToggle,
  BeatLabHistoryControls,
} from '@/app/components/creation/BeatLabGridControls';
import {
  BEAT_LAB_UNDO_STACK_MAX,
  BEAT_LAB_DUP_UNDO_STACK_MAX,
  captureBeatLabHistorySnapshot,
  cloneBeatLabBanks,
  restoreBeatLabHistorySnapshot,
  type BeatLabHistorySnapshot,
} from '@/app/lib/creationStation/beatLabBankHistory';
import {
  beatLabMelodicLanePitch,
  beatLabMelodicSynthV2AuditionPitch,
  beatLabPadPlaybackRateDetune,
  beatLabLaneIsPad,
  beatLabRollNotesOverlap,
  BEAT_LAB_PAD_LANES,
  BEAT_LAB_MIDI_LANES,
  BEAT_LAB_MELODIC_LANE_START,
  BEAT_LAB_ROLL_LABEL_W,
  clampBeatLabNoteLen,
  beatLabNoteResizeFromStartHead,
  beatLabSliceColForPointer,
  normalizeBeatLabMidiRoll,
  beatLabSplitMidiNoteAt,
  type BeatLabDeckFocus,
  type BeatLabGridZoomMode,
  type BeatLabGridLayoutMode,
  type BeatLabEditTool,
  type BeatLabMidiNote,
} from '@/app/lib/creationStation/beatLabMidiRoll';
import { mergeHumMelodyApplyIntoMidiRoll } from '@/app/lib/creationStation/vocalBoxHumMelodyBeatLabImport';
import {
  beatLabDrumBrushValue,
  beatLabDrumCellKey,
  beatLabDrumCellsAlongSegment,
  beatLabDrumCellFromPointer,
  beatLabToolUsesDrumBrush,
} from '@/app/lib/creationStation/beatLabGridPaint';
import type { BeatLabPitchAutomationSelection } from '@/app/components/creation/BeatLabBarAutomationLanes';
import {
  beatLabBarFineStart,
  beatLabCopyAutomationSegment,
  beatLabEffectiveVelocity,
  beatLabFineColsPerBar,
  beatLabPasteAutomationSegment,
  beatLabPitchSemiAtColumn,
  beatLabPitchSliceMidiNoteAt,
  normalizeBeatLabPitchAutomation,
  normalizeBeatLabVolAutomation,
} from '@/app/lib/creationStation/beatLabAutomation';
import {
  creationSubScreenToTab,
  type CreationSubScreenId,
} from '@/app/lib/creationStation/creationSubScreens';
import {
  creationSubAllowedForPlan,
  defaultCreationSubForPlan,
} from '@/app/lib/pricing/planEntitlements';
import ChordSequencerScreen from '@/app/screens/ChordSequencerScreen';
import GrooveLabScreen, { type GrooveLabNewSynthExportArgs } from '@/app/screens/GrooveLabScreen';
import {
  NEURAL_HUM_CREATION_IMPORT_EVENT,
  takeNeuralHumCreationImport,
  timedNotesToBeatLabHarmonyRoll,
} from '@/app/lib/vocalLab/neuralHumCreationExport';
import EightZeroEightTab from '@/app/screens/EightZeroEightTab';
import { uint8ArrayToBase64 } from '@/app/lib/creationStation/chordRender';
import {
  assignTrapDrumFolderToPads,
  BRASS_ROOM_BANK_INDEX,
  BRASS_ROOM_KIT_DISPLAY_NAME,
  trapPadSamplerOpts,
} from '@/app/lib/creationStation/beatLabFolderImport';
import { trapKitInstrumentLabel } from '@/app/lib/creationStation/trapKitBrowser';
import {
  familyInstrumentLabel,
  fetchAndDecodeFamilySample,
  fetchSoundFamiliesCatalog,
  samplerOptsForFamily,
  type SoundFamily,
} from '@/app/lib/creationStation/soundFamiliesCatalog';
import {
  ORCHESTRA_HITS_SOUND_FAMILY_ID,
  orchestraHitsPadDefForFile,
} from '@/app/lib/creationStation/soundFamilyOrchestraHits';
import { soundFamilySampleDisplayTitle } from '@/app/lib/creationStation/soundFamilySampleTitles';
import { loadBrassRoomBankFromPublic } from '@/app/lib/creationStation/brassRoomBankLoader';
import {
  BEAT_LAB_FLAGSHIP_KIT_ORDER,
  BEAT_LAB_PRODUCER_KITS,
  beatLabProducerKitMeta,
  ensureBeatLabProducerKitLoaded,
  type BeatLabProducerKitId,
} from '@/app/lib/creationStation/beatLabProducerKits';
import { seedBeatLabFlagshipBanksIfNeeded } from '@/app/lib/creationStation/beatLabDefaultBankKits';
import { beatLabPatternHasPairedKit } from '@/app/lib/creationStation/beatLabPatternPresetKits';
import { beatLabProducerKitIdForPatternPreset } from '@/app/lib/creationStation/beatLabPatternPresetKits';
import {
  captureActiveBankKitPads,
  countSavedKitPads,
  deleteBeatLabSavedKit,
  findBeatLabSavedKit,
  loadBeatLabSavedKits,
  renameBeatLabSavedKit,
  upsertBeatLabSavedKit,
  type BeatLabSavedKit,
} from '@/app/lib/creationStation/beatLabSavedKits';
import {
  captureBeatLabSongSnapshot,
  countSequenceSteps,
  deleteBeatLabSavedSong,
  findBeatLabSavedSong,
  loadBeatLabSavedSongs,
  renameBeatLabSavedSong,
  upsertBeatLabSavedSong,
  type BeatLabSavedSong,
} from '@/app/lib/creationStation/beatLabSavedSongs';

import {
  captureBeatLabPatternSnapshot,
  countPatternSteps,
  deleteBeatLabSavedPattern,
  findBeatLabSavedPattern,
  loadBeatLabSavedPatterns,
  renameBeatLabSavedPattern,
  upsertBeatLabSavedPattern,
  type BeatLabSavedPattern,
} from '@/app/lib/creationStation/beatLabSavedPatterns';

import {
  BEAT_LAB_DRUMLOOP_SNAP_SUBDIV,
  drumloopLoopBarsForVariant,
  type BeatLabDrumloopPresetVariant,
} from '@/app/lib/creationStation/beatLabDrumloopPreset';
import {
  beatLabDuplicateLoopPattern,
  beatLabLoopSpanPatternCols,
} from '@/app/lib/creationStation/beatLabDuplicateLoop';
import {
  normalizePianoSnapSubdiv,
  PIANO_SNAP_SUBDIV_STORAGE_KEY,
  readPianoSnapSubdivFromStorage,
  snapLabelFromPianoSnapSubdiv,
  ticksPerPianoSnapCell,
} from '@/app/lib/sharedPianoSnapSubdiv';

const DMB_STUDIO_PRECOUNT_CANCEL = 'dmb-studio-precount-cancel';

// ?? MIDI Note to Frequency (standard A=440Hz) ??????????????????????????????????

const NOTE_NAMES   = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function midiNoteToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function noteNameToMidi(name: string): number {
  const octave = parseInt(name[name.length - 1]);
  const noteName = name.slice(0, -1);
  const noteIdx = NOTE_NAMES.indexOf(noteName);
  return octave * 12 + noteIdx + 12;
}

function midiToNoteName(midi: number): string {
  const safeMidi = Math.max(12, Math.min(119, midi));
  const noteName = NOTE_NAMES[safeMidi % 12];
  const octave = Math.floor(safeMidi / 12) - 1;
  return `${noteName}${octave}`;
}


// ?? Constants ?????????????????????????????????????????????????????????????????

const KITS         = ['Default','Trap 808','Lo-Fi','Acoustic','Electronic','Afrobeats'];

const BANKS        = ['A','B','C','D','E','F','G','H'];

const NOTES        = ['C5','B4','A#4','A4','G#4','G4','F#4','F4','E4','D#4','D4','C#4','C4','B3','A#3','A3'];

const PAD_VEL      = [115,90,90,90,90,90,90,90,90,90,90,90,90,90,90,127];

const INSTRUMENTS  = ['Piano','Synth','Bass','Lead'];


const DRUM_GRID_BARS   = 16;
const CREATION_PIANO_BARS = 64;

const TOTAL_BARS       = CREATION_PIANO_BARS;

/** Hard cap — loop + visible grid never exceed this many bars. */
const BEAT_LAB_MAX_LOOP_BARS = TOTAL_BARS;

const MEASURES_PER_BAR = 4;
/** User rule: four metronome quarter-clicks = four ?measures? = one Creation ?bar? ? never use time-sig `qpb` here. */
const CREATION_QUARTERS_PER_BAR = MEASURES_PER_BAR;
/** 4/4 phrase: one measure = 4 quarter-note beats; bar-group cycles every 4 measures (16 beats). */
const BEATS_PER_MEASURE_44 = MEASURES_PER_BAR;
const MEASURES_PER_4BAR_PHRASE = 4;

const TOTAL_COLS       = TOTAL_BARS * MEASURES_PER_BAR;

/** Piano roll ruler: each song bar is always `MEASURES_PER_BAR` quarter columns (4 clicks = 1 bar). */
const PIANO_RULER_BAR_STEP_COUNTS = Array.from(
  { length: CREATION_PIANO_BARS },
  () => MEASURES_PER_BAR,
);

const KEY_W            = 64;

/** Wider rail for Genius-style sound-bank labels (group + name + CH). */
const LABEL_W          = 124;

/** Piano-roll note mode: one row height per semitone (pitch lane). */
const ROW_H            = 22;

const MIN_CW           = 24;

const MAX_CW           = 128;

/** Default column width on app open (slider minimum = widest zoom-out view). */
const DEF_CW           = MIN_CW;

const ZOOM_STEP        = 4;

/** Step sequencer lane height (16 pad lanes). */
const DRUM_GRID_ROW_H  = 40;
/** Sticky MEASURES row above the step grid. */
const DRUM_SEQ_MEASURES_ROW_H = 16;
/** BARS + quant label band (two stacked sub-rows). */
const DRUM_SEQ_QUANT_SUBROW_H = 11;
const DRUM_SEQ_QUANT_BAND_H = DRUM_SEQ_QUANT_SUBROW_H * 2;
/** Bar labels inside the sticky quant {@link Ruler} (drum grid only). */
const DRUM_SEQ_RULER_BAR_ROW_H = 9;
/** Step digits (1?16) inside the sticky quant {@link Ruler} (drum grid only). */
const DRUM_SEQ_RULER_STEP_ROW_H = DRUM_SEQ_QUANT_BAND_H - DRUM_SEQ_RULER_BAR_ROW_H;
const DRUM_SEQ_HEADER_H = DRUM_SEQ_MEASURES_ROW_H + DRUM_SEQ_QUANT_BAND_H;
/** Step grid scroll area ? sticky ruler height before pad lanes (for brush hit-tests). */
const DRUM_GRID_SCROLL_HEADER_H = DRUM_SEQ_HEADER_H;
/** Sampler pad cell min height in 8?2 grid. */
const BEAT_LAB_PAD_CELL_MIN_H = 54;
const DRUM_GRID_MIN_CW = MIN_CW;
const PIANO_GRID_MIN_CW = 24;

/** Max ?cells per quarter? (1/128 straight ? 32; triplet modes use 3 / 6). */
const DRUM_MAX_SUBDIV = 32;

function resetCreationLoopWrapDetectRefs(
  wapiPrevPhaseMsRef: MutableRefObject<number>,
  wapiLoopCycleSeenRef: MutableRefObject<number>,
  loopPhaseRef: MutableRefObject<number>,
): void {
  wapiPrevPhaseMsRef.current = -1;
  wapiLoopCycleSeenRef.current = 0;
  loopPhaseRef.current = -1;
}

/** One readout for BAR / MSR / phrase ? derived from the same pattern column as the playhead + ruler. */
type CreationHudSync = { bar: number; measure: number; phrase: number };

function creationDrumColOffsetSteps(
  loopOn: boolean,
  loopStartBeat: number,
  subdiv: number,
): number {
  const s = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(subdiv)));
  return Math.floor(Math.max(0, loopOn ? loopStartBeat * s : 0) + 1e-8);
}

/** Integer pattern column `ci` ? same math as `beatMathCol` / playline loop wrap. */
function creationPatternColFromTransportStep(
  transportStepIndexLive: number,
  subdiv: number,
  patternColsDrums: number,
  loopOn: boolean,
  loopStartBeat: number,
  loopEndBeat: number,
  playMode: 'single' | 'chainAB',
): number {
  const subdivR = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(subdiv)));
  const pcols = Math.max(1, patternColsDrums);
  const ls = Math.floor(loopStartBeat + 1e-8);
  const le = Math.floor(loopEndBeat + 1e-8);
  const lsStep = ls * subdivR;
  const leStep = le * subdivR;
  const drumColOffset = creationDrumColOffsetSteps(loopOn, loopStartBeat, subdivR);

  if (loopOn && leStep > lsStep) {
    if (transportStepIndexLive < lsStep) {
      return Math.max(0, Math.min(pcols - 1, transportStepIndexLive));
    }
    const span = Math.max(1, leStep - lsStep);
    const relLoop = Math.max(0, transportStepIndexLive - lsStep);
    const pos = (relLoop % span + span) % span;
    return ((pos % pcols) + pcols) % pcols;
  }
  const rel = Math.max(0, transportStepIndexLive - drumColOffset);
  void playMode;
  return ((rel % pcols) + pcols) % pcols;
}

/** Pattern column from fractional beat ? same mapping as `creationPatternColFromTransportStep` + playline. */
function creationPatternColFromDisplayBeat(
  bDisplay: number,
  subdiv: number,
  patternColsDrums: number,
  loopOn: boolean,
  loopStartBeat: number,
  loopEndBeat: number,
  playMode: 'single' | 'chainAB',
): number {
  const subdivR = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(subdiv)));
  const stepIdx = Math.floor(Math.max(0, bDisplay * subdivR) + 1e-8);
  return creationPatternColFromTransportStep(
    stepIdx,
    subdivR,
    patternColsDrums,
    loopOn,
    loopStartBeat,
    loopEndBeat,
    playMode,
  );
}

/** Resets quant cell imperative styles (legacy pump tint ? kept for tab switches / cleanup). */
function clearQuantMeasureCellImperativeLit(el: HTMLElement | null): void {
  if (!el) return;
  el.style.background = '#121212';
  el.style.color = '#b98ab9';
  el.style.boxShadow = 'none';
  el.removeAttribute('data-drum-quant-imperative-lit');
}

/** Parse `translate3d(tx px,?)` or CSS `matrix` / `matrix3d` translate X (px) from a keyframe string. */
function readTranslateXFromTransformString(t: string | undefined): number | null {
  if (!t) return null;
  const td = t.match(/translate3d\(\s*([-0-9.eE+]+)\s*px/i);
  if (td) {
    const v = parseFloat(td[1]!);
    return Number.isFinite(v) ? v : null;
  }
  if (t.startsWith('matrix3d(')) {
    const parts = t.slice(9, -1).split(/\s*,\s*/);
    if (parts.length >= 13) {
      const tx = parseFloat(parts[12]!);
      return Number.isFinite(tx) ? tx : null;
    }
    return null;
  }
  if (t.startsWith('matrix(')) {
    const parts = t.slice(7, -1).split(/\s*,\s*/);
    if (parts.length >= 6) {
      const tx = parseFloat(parts[4]!);
      return Number.isFinite(tx) ? tx : null;
    }
    return null;
  }
  return null;
}

/**
 * Read-only: translate X from the stored drum playline `Animation` (same timeline as compositor arrow).
 * Does not modify `currentTime` ? only reads keyframes + timing.
 */
function readDrumPlaylineTxFromKeyframeEffect(a: Animation | null): number | null {
  if (!a || (a.playState !== 'running' && a.playState !== 'paused' && a.playState !== 'finished')) return null;
  const eff = a.effect;
  if (!eff || !(eff instanceof KeyframeEffect)) return null;
  const kfs = eff.getKeyframes() as { transform?: string | string[] }[];
  if (kfs.length < 2) return null;
  const tf0 = kfs[0]?.transform;
  const tfL = kfs[kfs.length - 1]?.transform;
  const s0 = Array.isArray(tf0) ? tf0[0] : tf0;
  const s1 = Array.isArray(tfL) ? tfL[0] : tfL;
  const t0 = readTranslateXFromTransformString(s0);
  const t1 = readTranslateXFromTransformString(s1);
  if (t0 == null || t1 == null) return null;
  const span = t1 - t0;
  if (Math.abs(span) < 1e-6) return null;
  const ct = eff.getComputedTiming();
  const lp = (ct as ComputedEffectTiming & { localProgress?: number | null }).localProgress;
  let u: number;
  if (typeof lp === 'number' && Number.isFinite(lp)) {
    u = Math.min(1, Math.max(0, lp));
  } else {
    const dur = ct.duration;
    const cur = a.currentTime;
    if (typeof dur !== 'number' || dur <= 0 || typeof cur !== 'number' || !Number.isFinite(cur)) return null;
    const local = ((cur % dur) + dur) % dur;
    u = Math.min(1, Math.max(0, local / dur));
  }
  return t0 + (t1 - t0) * u;
}

function readTranslateXFromWapiKeyframeAnim(el: HTMLElement | null): number | null {
  if (!el) return null;
  for (const anim of el.getAnimations()) {
    const tx = readDrumPlaylineTxFromKeyframeEffect(anim);
    if (tx != null) return tx;
  }
  return null;
}

function readTranslateXFromComputedTransform(el: HTMLElement | null): number | null {
  if (!el) return null;
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return null;
  return readTranslateXFromTransformString(t);
}

/**
 * BAR / MSR / phrase from **global** integer beat (same clock as SE2 `refillMetronome` / `k`).
 * - **Bar** stays anchored to the visible loop (`loopStartBar` + `loopStartBeat`) for ruler alignment.
 * - **Measure** uses the same phase as the metronome: `(?beat? ? transportOriginBeat) % q` so MSR
 *   rolls with **k % bpb** downbeats (Studio Editor 2), not pattern column `ci` (which repeats in a loop).
 */
function computeCreationTransportHudFromBeat(
  beatNow: number,
  opts: {
    subdiv: number;
    pcols: number;
    loopOn: boolean;
    loopStartBeat: number;
    loopEndBeat: number;
    playMode: 'single' | 'chainAB';
    loopStartBar: number;
    qpb: number;
    /** Same quarter index as `nextStepBeatRef` / SE2 `nextMetroKRef` at play (session origin beat). */
    transportOriginBeat: number;
  },
): CreationHudSync {
  const { loopStartBeat, loopStartBar, qpb, transportOriginBeat } = opts;
  void opts.subdiv;
  void opts.pcols;
  void opts.loopOn;
  void opts.loopEndBeat;
  void opts.playMode;
  const q = Math.max(2, Math.min(16, Math.round(qpb)));
  const bInt = Math.floor(Math.max(0, beatNow) + 1e-8);
  const lsB = Math.floor(Math.max(0, loopStartBeat) + 1e-8);
  const orgB = Math.floor(Math.max(0, transportOriginBeat) + 1e-8);
  const beatInRegion = Math.max(0, bInt - lsB);
  const bar = loopStartBar + Math.floor(beatInRegion / q);
  const measure = (((bInt - orgB) % q) + q) % q + 1;
  const phrase = Math.floor((Math.max(1, bar) - 1) / MEASURES_PER_4BAR_PHRASE) + 1;
  return { bar, measure, phrase };
}

/** Studio Editor 2 `formatBarsBeatsTicks` ? global bar ? beat-in-bar ? centisecond tick. */
function formatCreationSe2BarsBeatsTicks(displayBeats: number, beatsPerBar: number): string {
  const bpb = Math.max(1, beatsPerBar);
  const db = Math.max(0, displayBeats);
  const bar = Math.floor(db / bpb) + 1;
  const beatInBar = Math.floor(db % bpb) + 1;
  const tick = Math.floor((db % 1) * 100);
  return `${bar}.${beatInBar}.${String(tick).padStart(2, '0')}`;
}

/** Studio Editor 2 `formatTimeMmSsFf` ? MM:SS:cs from musical time at BPM. */
function formatCreationSe2TimeMmSsFf(beats: number, bpm: number): string {
  const totalSeconds = (Math.max(0, beats) / Math.max(1, bpm)) * 60;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  const f = Math.floor((totalSeconds % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

/** Fixed 1:1 pad index ? mixer channel (CH1?CH16); not user-editable. */
function creationPadMixerCh(padIndex: number): number {
  return padIndex + 1;
}

const CREATION_PAD_CHANNELS_FIXED = Array.from({ length: 16 }, (_, i) => i + 1);

// ?? BAR/MEASURE HUD: display-only from master transport frame state ????????????????????????????????

let creationRulerSeq = 0;
let creationRulerBeatHighlight: number | null = null;
const creationRulerListeners = new Set<() => void>();

function subscribeCreationRulerBeat(cb: () => void) {
  creationRulerListeners.add(cb);
  return () => creationRulerListeners.delete(cb);
}

function getCreationRulerSeq() {
  return creationRulerSeq;
}

function publishCreationRulerBeat(m: number | null) {
  if (creationRulerBeatHighlight === m) return;
  creationRulerBeatHighlight = m;
  creationRulerSeq += 1;
  creationRulerListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

/** DOM slots RAF paints for BAR + beat-in-bar fraction + phrase (no separate MSR LED strip). */
type CreationHudDomSlots = {
  barDigits: HTMLSpanElement | null;
  msrFrac: HTMLSpanElement | null;
  phrase: HTMLSpanElement | null;
};

function paintCreationHudQuarterIntoDom(
  slots: CreationHudDomSlots,
  hud: CreationHudSync,
  qpb: number,
  opts: { active: boolean },
  holdRef: MutableRefObject<{ m: number; b: number; ph: number }>,
  publishBeatToRuler: boolean,
): void {
  const q = Math.max(2, Math.min(16, Math.round(qpb)));
  const m = Math.max(1, Math.min(q, hud.measure));
  const bar = Math.max(1, hud.bar);
  const ph = hud.phrase;
  holdRef.current = { m, b: bar, ph };
  const { active } = opts;
  const bEl = slots.barDigits;
  if (bEl) {
    bEl.textContent = String(bar).padStart(3, '0');
    bEl.style.color = active ? '#00E5FF' : '#4a4a58';
  }
  const msrEl = slots.msrFrac;
  if (msrEl) {
    msrEl.textContent = `${m}/${q}`;
  }
  const phEl = slots.phrase;
  if (phEl) {
    phEl.textContent = `PH${ph}`;
  }
  if (publishBeatToRuler) {
    publishCreationRulerBeat(m);
  }
}

type CreationTransportHudBarProps = {
  transportNotStopped: boolean;
  displayBarNumber: number;
  measureInBar: number;
  measureLedCount: number;
  paintHudFromRaf?: boolean;
  hudDomSlotsRef?: MutableRefObject<CreationHudDomSlots>;
  /** Compact row (sequence toolbar) vs transport strip */
  compact?: boolean;
};

/** BAR digits only ? {@link paintCreationHudQuarterIntoDom} updates `barDigits` during play/rec. */
function CreationTransportHudBar({
  transportNotStopped,
  displayBarNumber,
  measureInBar,
  measureLedCount,
  paintHudFromRaf,
  hudDomSlotsRef,
  compact,
}: CreationTransportHudBarProps) {
  const barTitle = `Creation bar ${displayBarNumber}. Measure ${measureInBar} of ${measureLedCount}.`;
  const showReactHudText = !paintHudFromRaf;
  return (
    <div
      role="group"
      aria-label={`Bar ${displayBarNumber}`}
      title={barTitle}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontFamily: 'monospace',
        padding: compact ? '0 2px' : undefined,
      }}
    >
      <span style={{ fontSize: compact ? 4 : 5, color: '#4a4a58', letterSpacing: 1.2, lineHeight: 1 }}>BAR</span>
      <span
        ref={(el) => {
          if (hudDomSlotsRef) hudDomSlotsRef.current.barDigits = el;
        }}
        style={{
          fontSize: compact ? 12 : 14,
          fontWeight: 900,
          color: paintHudFromRaf ? '#00E5FF' : transportNotStopped ? '#00E5FF' : '#4a4a58',
          lineHeight: 1,
        }}
      >
        {showReactHudText ? String(displayBarNumber).padStart(3, '0') : '\u2007\u2007\u2007'}
      </span>
    </div>
  );
}

/** Master volume ? rotary knob + vertical fader (shared 0?1 level). */
function BeatLabMasterVolume({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (linear: number) => void;
  disabled?: boolean;
}) {
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null);
  const linear = Math.max(0, Math.min(1, value));
  const pct = Math.round(linear * 100);
  const norm = pct / 100;
  const angle = -135 + norm * 270;
  const faderH = 72;

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const dy = d.startY - e.clientY;
      const next = d.startVal + dy / 120;
      onChange(Math.max(0, Math.min(1, next)));
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onChange]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 8,
        flexShrink: 0,
        padding: '4px 8px',
        borderRadius: 4,
        border: '1px solid #2a2a32',
        background: '#0a0a0e',
        opacity: disabled ? 0.45 : 1,
      }}
      title={`Master volume: ${pct}%`}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Volume2 size={10} style={{ color: '#7cf4c6' }} />
          <span style={{ fontSize: 8, fontWeight: 800, color: '#7a7a88', letterSpacing: 0.3 }}>Master</span>
        </div>
        <div
          title="Volume knob ? drag up/down"
          data-touch-drag
          onMouseDown={(e) => {
            if (disabled) return;
            e.preventDefault();
            dragRef.current = { startY: e.clientY, startVal: linear };
          }}
          style={{
            width: 30,
            height: 30,
            touchAction: 'none',
          borderRadius: '50%',
          border: `2px solid ${disabled ? 'rgba(255,255,255,0.12)' : 'rgba(124,244,198,0.35)'}`,
          background: 'radial-gradient(circle at 35% 30%, rgba(124,244,198,0.16) 0%, rgba(10,10,14,0.95) 70%)',
          position: 'relative',
          cursor: disabled ? 'not-allowed' : 'ns-resize',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 2,
            height: 9,
            marginLeft: -1,
            marginTop: -9,
            background: disabled ? '#6a6a78' : '#7cf4c6',
            borderRadius: 1,
            transform: `rotate(${angle}deg)`,
            transformOrigin: '50% 100%',
          }}
        />
      </div>
        <span style={{ fontSize: 9, fontWeight: 800, color: disabled ? '#5a5a66' : '#e8e8f0', fontFamily: 'monospace' }}>
          {pct}%
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          paddingLeft: 6,
          borderLeft: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span style={{ fontSize: 7, fontWeight: 800, color: '#6a6a78', letterSpacing: 0.4 }}>FADER</span>
        <div
          style={{
            position: 'relative',
            width: 28,
            height: faderH,
            borderRadius: 3,
            background: '#050507',
            border: '1px solid #1e1e26',
          }}
          title="Volume fader ? drag up for louder"
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 2,
              transform: 'translateX(-50%)',
              width: 4,
              height: `calc(${pct}% - 4px)`,
              minHeight: 2,
              maxHeight: faderH - 4,
              background: 'linear-gradient(180deg, rgba(124,244,198,0.55) 0%, rgba(124,244,198,0.9) 100%)',
              borderRadius: 2,
              pointerEvents: 'none',
            }}
          />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            disabled={disabled}
            value={pct}
            onChange={(e) => onChange(Number(e.target.value) / 100)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              margin: 0,
              opacity: 0,
              cursor: disabled ? 'not-allowed' : 'ns-resize',
              writingMode: 'vertical-lr',
              direction: 'rtl',
            }}
            aria-label="Master volume fader"
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: `calc(${pct}% - 7px)`,
              transform: 'translateX(-50%)',
              width: 18,
              height: 8,
              borderRadius: 2,
              background: disabled
                ? '#3a3a44'
                : 'linear-gradient(180deg, #b8f5dc 0%, #7cf4c6 55%, #4ac998 100%)',
              border: '1px solid rgba(0,0,0,0.35)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}

const BAR_PALETTE = ['#ffff00','#00E5FF','#00ff88','#ff6b35','#a78bfa','#f472b6','#60a5fa','#c4b5fd'];

function barColor(b: number) { return BAR_PALETTE[b % BAR_PALETTE.length]; }

function colColor(ci: number) { return barColor(Math.floor(ci / MEASURES_PER_BAR)); }

const PAD_BANK_GROUP_TAGS = [
  'KICK', 'KICK', 'SNR', 'HAT', 'HAT', 'TOM', 'TOM', 'RIM',
  'PERC', 'PERC', 'CYM', 'CYM', 'FX', 'FX', 'FX', 'SUB',
] as const;

/** Beat Lab lane labels (left rail + pattern rows). */
const GENIUS_LANE_LABELS = [
  'Kick 1',
  'Snare 1',
  'Snare 2',
  'Hi Hat 2',
  'Open Hat',
  'Pan Crash',
  'Tom',
  'Rim',
  'Perc 1',
  'Perc 2',
  'China',
  'Ride',
  'FX 1',
  'FX 2',
  'FX 3',
  'My Place',
] as const;

/** Beat Lab sampler — distinct outline accents (Groove Lab mixer-style, not loud fills). */
const BEAT_LAB_PAD_COLORS: readonly string[] = [
  '#5ecde8',
  '#e088b8',
  '#b8a0e8',
  '#68d8a8',
  '#e8c858',
  '#e89090',
  '#78c8e8',
  '#e8b858',
  '#c898e8',
  '#88d0e8',
  '#e8a8c8',
  '#70d8b8',
  '#e8c078',
  '#e89898',
  '#a8b0e0',
  '#e8b0c8',
];

function beatLabPadColor(padIndex: number): string {
  return BEAT_LAB_PAD_COLORS[Math.max(0, Math.min(15, padIndex))] ?? '#b8c0d0';
}

/** Crisp micro-copy on colored pad faces — no size change, stronger legibility. */
function beatLabPadReadableTextShadow(deep = false): string {
  return deep
    ? '0 1px 0 rgba(0,0,0,0.95), 0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.45)'
    : '0 1px 2px rgba(0,0,0,0.88)';
}

function beatLabPadMicroChipBg(open = false): string {
  return open
    ? 'linear-gradient(165deg, rgba(14, 14, 20, 0.92) 0%, rgba(8, 8, 12, 0.98) 100%)'
    : 'linear-gradient(165deg, rgba(16, 16, 22, 0.94) 0%, rgba(10, 10, 14, 0.98) 100%)';
}

/** Sample pad EDIT / EFX popover typography — readable at arm's length. */
const PAD_POP_TITLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
};
const PAD_POP_SECTION: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: '#b8c4d8',
  letterSpacing: 0.45,
};
const PAD_POP_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#d0d8e8',
  display: 'block',
  marginBottom: 4,
};
const PAD_POP_VALUE: React.CSSProperties = {
  fontSize: 10,
  color: '#e8eef8',
  marginBottom: 8,
  lineHeight: 1.35,
};
const PAD_POP_HINT: React.CSSProperties = {
  fontSize: 9,
  color: '#a8b4c8',
  marginBottom: 4,
};
const PAD_POP_TOGGLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
};
const PAD_POP_ACTION: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  padding: '5px 12px',
  borderRadius: 4,
  cursor: 'pointer',
};

/** Groove Lab mixer-style outline alpha on 7-char hex accents. */
function beatLabPadAccentOutline(padIndex: number, alphaHex = '44'): string {
  return `${beatLabPadColor(padIndex)}${alphaHex}`;
}

/** Lane / sampler surface — legacy helpers kept for grid accents; pads use dark face + outline. */
function beatLabPadSurfaceBg(padIndex: number, mixPct = 48): string {
  return `color-mix(in srgb, ${beatLabPadColor(padIndex)} ${mixPct}%, #0a0c12)`;
}

function beatLabPadBorder(padIndex: number): string {
  return beatLabPadAccentOutline(padIndex, '44');
}

function beatLabPadAccentBg(padIndex: number): string {
  return `linear-gradient(180deg, ${beatLabPadAccentOutline(padIndex, '0c')} 0%, #060806 100%)`;
}

function beatLabPadButtonFill(padIndex: number, selected = false): string {
  const accent = beatLabPadColor(padIndex);
  if (selected) {
    return `linear-gradient(180deg, ${accent}38 0%, ${accent}16 45%, #060806 100%)`;
  }
  return `linear-gradient(180deg, ${accent}0c 0%, #060806 100%)`;
}

function beatLabLaneBackdropBorder(): string {
  return '#343a4c';
}

/** High-gloss piano-lacquer deck — deep black tray around sampler pads. */
function beatLabStudioWoodGrainBg(): string {
  return [
    'linear-gradient(180deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.025) 10%, transparent 28%)',
    'linear-gradient(118deg, transparent 38%, rgba(255,255,255,0.04) 50%, transparent 62%)',
    'repeating-radial-gradient(circle at 21% 39%, rgba(255,255,255,0.006) 0 0.38px, transparent 0.38px 2.1px)',
    'repeating-radial-gradient(circle at 69% 61%, rgba(0,0,0,0.1) 0 0.48px, transparent 0.48px 2.6px)',
    'radial-gradient(circle at 13% 33%, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.68) 12%, rgba(40,44,52,0.05) 21%, transparent 48%)',
    'radial-gradient(circle at 82% 18%, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.62) 14%, rgba(38,42,50,0.04) 23%, transparent 50%)',
    'radial-gradient(circle at 54% 76%, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.72) 15%, rgba(34,38,46,0.06) 25%, transparent 52%)',
    'radial-gradient(ellipse 122% 96% at 50% 114%, rgba(0,0,0,0.88) 0%, transparent 54%)',
    'linear-gradient(168deg, #040406 0%, #020203 18%, #010101 48%, #000000 72%, #030304 100%)',
  ].join(', ');
}

function beatLabStudioWoodDeckBorder(): string {
  return '1px solid rgba(255, 255, 255, 0.04)';
}

function beatLabStudioWoodDeckShadow(): string {
  return [
    'inset 0 1px 0 rgba(255,255,255,0.07)',
    'inset 0 18px 48px rgba(255,255,255,0.015)',
    'inset 0 0 72px rgba(0,0,0,0.78)',
    'inset 0 -10px 32px rgba(0,0,0,0.92)',
    '0 14px 38px rgba(0,0,0,0.88)',
    '0 0 0 1px rgba(0,0,0,0.65)',
  ].join(', ');
}

/** Smoke-gray rim groove — neutral bezel, slightly lifted from the backdrop. */
function beatLabStudioPadRingBg(): string {
  return '#050506';
}

function beatLabStudioPadRingBorder(uploadHighlight = false): string {
  if (uploadHighlight) {
    return '1px solid rgba(124, 244, 198, 0.42)';
  }
  return '1px solid rgba(48, 52, 62, 0.72)';
}

function beatLabStudioPadRingShadow(selected = false, _padIndex?: number): string {
  const parts = [
    'inset 0 3px 7px rgba(0,0,0,0.72)',
    'inset 0 0 0 1px rgba(0,0,0,0.55)',
    'inset 0 1px 0 rgba(72, 78, 92, 0.14)',
    'inset 0 -1px 0 rgba(0,0,0,0.45)',
  ];
  if (selected) {
    parts.unshift('inset 0 0 0 1px rgba(124, 244, 198, 0.18)');
  }
  return parts.join(', ');
}

/** Near-black pad interior — colored rim stays on beatLabStudioPadFaceShadow / border. */
const BEAT_LAB_PAD_FACE_BG_IDLE =
  'linear-gradient(180deg, #060607 0%, #020203 42%, #010101 100%)';
const BEAT_LAB_PAD_FACE_BG_SELECTED =
  'linear-gradient(180deg, #080809 0%, #030304 42%, #020202 100%)';
/** Muted silver — readable without harsh white glare on dark pads. */
const BEAT_LAB_PAD_LABEL_WHITE = '#8f949e';
const BEAT_LAB_PAD_NAME_STRIP_BG =
  'linear-gradient(180deg, #030304 0%, #010101 100%)';

/** Sampler / lane face — dark interior; rim glow from beatLabStudioPadFaceShadow. */
function beatLabStudioPadFaceBg(
  _padIndex: number,
  opts: { hasSample?: boolean; selected?: boolean; lane?: boolean },
): string {
  const { selected = false } = opts;
  return selected ? BEAT_LAB_PAD_FACE_BG_SELECTED : BEAT_LAB_PAD_FACE_BG_IDLE;
}

/** Physical pad rim — dark well + subtle colored inner glow. */
function beatLabStudioPadIdleLitShadow(padIndex: number): string {
  const accent = beatLabPadColor(padIndex);
  return [
    'inset 0 1px 0 rgba(255,255,255,0.03)',
    'inset 0 -3px 7px rgba(0,0,0,0.68)',
    'inset 0 0 0 1px rgba(0,0,0,0.5)',
    `inset 0 0 0 0.5px ${accent}44`,
    `inset 0 0 5px ${accent}1a`,
  ].join(', ');
}

function beatLabStudioPadFaceShadow(
  padIndex: number,
  opts: { hasSample?: boolean; selected?: boolean; lane?: boolean },
): string {
  const accent = beatLabPadColor(padIndex);
  const { selected = false } = opts;
  if (selected) {
    return [
      'inset 0 1px 0 rgba(255,255,255,0.04)',
      'inset 0 -3px 7px rgba(0,0,0,0.62)',
      'inset 0 0 0 1px rgba(0,0,0,0.45)',
      `inset 0 0 0 0.5px ${accent}88`,
      `inset 0 0 8px ${accent}33`,
    ].join(', ');
  }
  return beatLabStudioPadIdleLitShadow(padIndex);
}

function beatLabStudioPadFaceBorderCss(padIndex: number, selected: boolean): string {
  const accent = beatLabPadColor(padIndex);
  return selected ? `1px solid ${accent}99` : `1px solid ${accent}44`;
}

function beatLabPadFaceAccentVar(padIndex: number): React.CSSProperties {
  return { ['--beat-lab-pad-accent' as string]: beatLabPadColor(padIndex) };
}

/** Beat Lab grid ? all painted steps use the same green (not per-pad color). */
const BEAT_LAB_STEP_NOTE_GREEN = '#7cf4c6';
const BEAT_LAB_STEP_CELL_ON_BG = '#0f2218';

function beatLabGridStepOnFill(): string {
  return `linear-gradient(180deg, ${BEAT_LAB_STEP_NOTE_GREEN}, #34d399)`;
}

/** Loaded sample name when set; otherwise default lane name (Kick 1, Snare 1, ?). */
function beatLabLaneDisplayLabel(padIndex: number, sampleLabel?: string): string {
  const custom = sampleLabel?.trim();
  if (custom) return custom;
  return GENIUS_LANE_LABELS[padIndex] ?? PAD_NAMES[padIndex] ?? `Pad ${padIndex + 1}`;
}

function drumLaneBg(rowIndex: number): string {
  return rowIndex % 2 === 0 ? '#12182a' : '#0e1626';
}

function drumStepBg(
  ci: number,
  rowIndex: number,
  isHead: boolean,
  stepsPerBar: number = MEASURES_PER_BAR,
): string {
  if (isHead) return '#1f3d5c';
  const lane = drumLaneBg(rowIndex);
  /* Genius-style bar banding: every 4 steps (one ?measure? strip) slightly lifted */
  if (ci % (stepsPerBar * 4) === 0) return '#1a2840';
  if (ci % stepsPerBar === 0) return '#162238';
  return lane;
}

function pianoLaneBg(rowIndex: number): string {
  return rowIndex % 2 === 0 ? '#102938' : '#0e2432';
}

function pianoStepBg(
  ci: number,
  rowIndex: number,
  isHead: boolean,
  stepsPerBar: number = MEASURES_PER_BAR,
): string {
  if (isHead) return '#1a3a4f';
  if (ci % (stepsPerBar * 4) === 0) return '#1c3e54';
  if (ci % stepsPerBar === 0) return '#18405a';
  return pianoLaneBg(rowIndex);
}


/** Decimated peaks for sample-edit waveform (absolute sample magnitudes, 0?1 per bucket). */
function computePadSampleWaveformPeaks(buf: AudioBuffer, bucketCount = 400): number[] {
  const channels = Math.min(buf.numberOfChannels, 2);
  const len = buf.length;
  if (len <= 0 || bucketCount <= 0) {
    return Array.from({ length: Math.max(1, bucketCount) }, () => 0);
  }
  const step = len / bucketCount;
  const peaks: number[] = new Array(bucketCount);
  for (let i = 0; i < bucketCount; i++) {
    let max = 0;
    const j0 = Math.floor(i * step);
    const j1 = Math.min(Math.floor((i + 1) * step), len);
    for (let c = 0; c < channels; c++) {
      const ch = buf.getChannelData(c);
      for (let j = j0; j < j1; j++) {
        const v = Math.abs(ch[j]!);
        if (v > max) max = v;
      }
    }
    peaks[i] = max;
  }
  return peaks;
}

function formatBeatLabSampleTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00.000';
  const totalMs = Math.round(seconds * 1000);
  const m = Math.floor(totalMs / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

const PAD_TRIM_WAVE_CSS_H = 56;

/** Keep trim window valid (same constraints as the % sliders under the waveform). */
function clampBeatLabTrimPair(t0: number, t1: number): { trim0: number; trim1: number } {
  let trim0 = Math.max(0, Math.min(0.95, t0));
  let trim1 = Math.max(0.05, Math.min(1, t1));
  if (trim1 <= trim0 + 0.02) {
    trim1 = Math.min(1, trim0 + 0.08);
  }
  if (trim1 <= trim0 + 0.02) {
    trim0 = Math.max(0, trim1 - 0.08);
  }
  return { trim0, trim1 };
}

const PadSampleTrimWaveform = memo(function PadSampleTrimWaveform({
  peaks,
  trim0,
  trim1,
  onTrimChange,
}: {
  peaks: number[] | null;
  trim0: number;
  trim1: number;
  /** When set, drag the yellow start/end lines on the waveform (same as the % sliders). */
  onTrimChange?: (trim0: number, trim1: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const latestTrimRef = useRef({ trim0, trim1 });
  latestTrimRef.current = { trim0, trim1 };
  const dragWhichRef = useRef<0 | 1 | null>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const ctx2 = canvas.getContext('2d');
      if (!ctx2) return;
      const cssW = Math.max(120, canvas.clientWidth || 280);
      const cssH = PAD_TRIM_WAVE_CSS_H;
      const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.floor(cssH * dpr);
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2.clearRect(0, 0, cssW, cssH);
      ctx2.fillStyle = '#060b0a';
      ctx2.fillRect(0, 0, cssW, cssH);
      if (!peaks || peaks.length < 1) {
        ctx2.fillStyle = '#4b5563';
        ctx2.font = '10px ui-monospace, system-ui, sans-serif';
        ctx2.fillText('No waveform', 8, cssH / 2 + 3);
        return;
      }
      const n = peaks.length;
      let peakMax = 1e-6;
      for (let i = 0; i < n; i++) peakMax = Math.max(peakMax, peaks[i]!);
      const scale = Math.min((cssH * 0.46) / peakMax, cssH * 4);
      const midY = cssH / 2;
      const barW = Math.max(1, cssW / n);
      const t0 = Math.max(0, Math.min(1, trim0));
      const t1 = Math.max(t0 + 1e-4, Math.min(1, trim1));
      const iStart = Math.max(0, Math.min(n - 1, Math.floor(t0 * n)));
      const iEnd = Math.max(iStart + 1, Math.min(n, Math.ceil(t1 * n)));
      for (let i = 0; i < n; i++) {
        const x = (i / n) * cssW;
        const bh = Math.min(peaks[i]! * scale, cssH * 0.48);
        const outside = i < iStart || i >= iEnd;
        ctx2.fillStyle = outside ? 'rgba(45, 55, 52, 0.65)' : '#5eead4';
        ctx2.fillRect(x, midY - bh / 2, barW - 0.55, Math.max(1, bh));
      }
      ctx2.strokeStyle = 'rgba(251, 191, 72, 0.95)';
      ctx2.lineWidth = 1.25;
      const x0 = t0 * cssW;
      const x1 = t1 * cssW;
      ctx2.beginPath();
      ctx2.moveTo(x0 + 0.5, 0);
      ctx2.lineTo(x0 + 0.5, cssH);
      ctx2.stroke();
      ctx2.beginPath();
      ctx2.moveTo(x1 - 0.5, 0);
      ctx2.lineTo(x1 - 0.5, cssH);
      ctx2.stroke();
    };
    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [peaks, trim0, trim1]);

  const applyPointerTrim = useCallback(
    (clientX: number, canvas: HTMLCanvasElement, which: 0 | 1) => {
      if (!onTrimChange) return;
      const rect = canvas.getBoundingClientRect();
      const u = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
      const { trim0: cur0, trim1: cur1 } = latestTrimRef.current;
      const next = which === 0 ? clampBeatLabTrimPair(u, cur1) : clampBeatLabTrimPair(cur0, u);
      onTrimChange(next.trim0, next.trim1);
    },
    [onTrimChange],
  );

  const onWavePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!onTrimChange) return;
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const w = Math.max(1, rect.width);
      const x0 = trim0 * w;
      const x1 = trim1 * w;
      const hit = 12;
      const near0 = Math.abs(px - x0) <= hit;
      const near1 = Math.abs(px - x1) <= hit;
      let which: 0 | 1;
      if (near0 && near1) which = Math.abs(px - x0) <= Math.abs(px - x1) ? 0 : 1;
      else if (near0) which = 0;
      else if (near1) which = 1;
      else which = px / w < (trim0 + trim1) / 2 ? 0 : 1;
      dragWhichRef.current = which;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
      applyPointerTrim(e.clientX, canvas, which);
      e.preventDefault();
    },
    [onTrimChange, trim0, trim1, applyPointerTrim],
  );

  const onWavePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (dragWhichRef.current === null || !onTrimChange) return;
      applyPointerTrim(e.clientX, e.currentTarget, dragWhichRef.current);
    },
    [onTrimChange, applyPointerTrim],
  );

  const endWaveDrag = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragWhichRef.current === null) return;
    dragWhichRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      onPointerDown={onWavePointerDown}
      onPointerMove={onWavePointerMove}
      onPointerUp={endWaveDrag}
      onPointerCancel={endWaveDrag}
      onLostPointerCapture={() => {
        dragWhichRef.current = null;
      }}
      style={{
        width: '100%',
        height: PAD_TRIM_WAVE_CSS_H,
        display: 'block',
        borderRadius: 4,
        border: '1px solid #1a2824',
        background: '#060b0a',
        cursor: onTrimChange ? 'ew-resize' : 'default',
        touchAction: onTrimChange ? 'none' : undefined,
      }}
    />
  );
});


type DrumPattern = boolean[][];

type PianoNote   = { row: number; col: number };

interface Bank {
  drums: DrumPattern;
  notes: PianoNote[];
  midiRoll: BeatLabMidiNote[];
  /** Per-pattern-column volume automation 0?127 (FL event lane). */
  volAutomation?: number[];
  /** Per-pattern-column pitch automation (64 = 0 st). */
  pitchAutomation?: number[];
  /** MusyngKite GM instrument per melodic lane (CH 17?32). */
  melodicInstruments?: string[];
  /** Bass synth preset id per melodic lane (CH 17-32). */
  melodicSynthPresetIds?: string[];
  /** Editable synth v2 voice params per melodic lane (CH 17-32). */
  melodicSynthVoices?: ReturnType<typeof normalizeBeatLabBassSynthVoiceParams>;
}

function emptyDrums(): DrumPattern {
  return Array.from({ length: 16 }, () => Array(TOTAL_COLS).fill(false));
}

/** Restore saved song patterns to the current grid column count. */
function normalizeSavedDrumPattern(pat: boolean[][]): DrumPattern {
  return Array.from({ length: 16 }, (_, pi) => {
    const row = pat[pi];
    if (!Array.isArray(row)) return Array(TOTAL_COLS).fill(false);
    return Array.from({ length: TOTAL_COLS }, (_, ci) => Boolean(row[ci]));
  });
}

/** Coerce localStorage / pattern-slot payloads into a valid 16?TOTAL_COLS grid. */
function normalizeBankDrumPattern(pat: unknown): DrumPattern {
  if (!Array.isArray(pat)) return emptyDrums();
  return normalizeSavedDrumPattern(pat as boolean[][]);
}

type PatternSlot = 'A' | 'B';


// ?? Ruler ?????????????????????????????????????????????????????????????????????

function Ruler({
  activeCol,
  colWidth,
  maxBars = TOTAL_BARS,
  barNumberStart = 1,
  onRangeCommit,
  stepsPerBar = MEASURES_PER_BAR,
  /** If set (sum must match drum pattern column count), beat row uses variable widths per bar ? keeps ruler aligned with the grid in odd meters. */
  barStepCounts,
  /** When `barStepCounts` groups columns differently from one DAW bar per segment, set header labels (e.g. DAW bar at each segment start). */
  segmentHeaderLabels,
  /** Map pattern column index ? DAW bar for loop drag; required when segment count ? DAW bars in range. */
  patternColToDawBar,
  /**
   * When set, the beat row highlights the **beat within the bar** (1?`creationBeatsPerBar`) that contains `activeCol`,
   * using `creationStepSubdiv` columns per beat (e.g. 4 for 16ths). Omit `creationStepSubdiv` for 1 column = 1 beat.
   */
  creationBeatHighlight,
  creationBeatsPerBar,
  creationStepSubdiv,
  disablePlayheadHighlight = false,
  /** When set, each beat cell is exactly `colWidth` px (border-box) with pad-matching vertical grid lines ? required for playline ? digit alignment. */
  drumGridBeatBorders,
  onSeekPatternCol,
}: {
  activeCol: number;
  colWidth: number;
  maxBars?: number;
  /** First bar label (1-based) ? use for global bar numbers when the loop is not at bar 1. */
  barNumberStart?: number;
  /** Drag across bar headers to set shared loop range (master loop state). */
  onRangeCommit?: (startBar: number, endBar: number) => void;
  /** Quarter-note columns per bar ? fallback when `barStepCounts` omitted. */
  stepsPerBar?: number;
  barStepCounts?: number[];
  segmentHeaderLabels?: number[];
  patternColToDawBar?: (patternCol: number) => number;
  creationBeatHighlight?: number | null;
  creationBeatsPerBar?: number;
  creationStepSubdiv?: number;
  disablePlayheadHighlight?: boolean;
  drumGridBeatBorders?: { bankColOffset: number; qpb: number; subdiv: number };
  onSeekPatternCol?: (patternCol: number) => void;
}) {
  const headerRef = useRef<HTMLDivElement>(null);
  const dragStartBarRef = useRef<number | null>(null);
  const highlightBeats = Math.max(1, Math.min(16, Math.round(creationBeatsPerBar ?? MEASURES_PER_BAR)));
  const highlightSubdiv = Math.max(1, Math.round(creationStepSubdiv ?? 1));

  const counts =
    barStepCounts && barStepCounts.length > 0
      ? barStepCounts
      : Array.from({ length: maxBars }, () => stepsPerBar);
  const barN = counts.length;

  const pxToBarIndex = (clientX: number) => {
    const el = headerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    let acc = 0;
    for (let bi = 0; bi < barN; bi++) {
      const w = colWidth * counts[bi]!;
      if (x < acc + w) return Math.max(0, Math.min(barN - 1, bi));
      acc += w;
    }
    return Math.max(0, barN - 1);
  };

  const pxToPatternCol = (clientX: number): number => {
    const el = headerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    let accPx = 0;
    let colAcc = 0;
    for (let bi = 0; bi < barN; bi++) {
      const w = colWidth * counts[bi]!;
      if (x < accPx + w) {
        const within = x - accPx;
        const colInSeg = Math.min(
          counts[bi]! - 1,
          Math.max(0, Math.floor(within / colWidth)),
        );
        return colAcc + colInSeg;
      }
      accPx += w;
      colAcc += counts[bi]!;
    }
    return Math.max(0, colAcc - 1);
  };

  const dawBarFromPointer = (clientX: number) =>
    patternColToDawBar
      ? patternColToDawBar(pxToPatternCol(clientX))
      : barNumberStart + pxToBarIndex(clientX);

  const compactDrumRuler = drumGridBeatBorders != null;
  const rulerH = compactDrumRuler ? DRUM_SEQ_QUANT_BAND_H : 28;
  const barRowH = compactDrumRuler ? DRUM_SEQ_RULER_BAR_ROW_H : 14;
  const stepRowH = compactDrumRuler ? DRUM_SEQ_RULER_STEP_ROW_H : 14;

  let colStartAcc = 0;
  return (
    <div ref={headerRef} style={{ display: 'flex', height: rulerH, flexShrink: 0, overflow: compactDrumRuler ? 'visible' : 'hidden' }}>
      {Array.from({ length: barN }, (_, bi) => {
        const stepsThisBar = counts[bi]!;
        const colStart = colStartAcc;
        colStartAcc += stepsThisBar;
        /** Drum Beat Lab: no segment-wide header tint ? only the digit under the playline column turns violet. */
        const isActiveBar =
          drumGridBeatBorders == null &&
          !disablePlayheadHighlight &&
          activeCol >= colStart &&
          activeCol < colStart + stepsThisBar;
        const color = barColor(bi);
        const barLabel =
          segmentHeaderLabels && segmentHeaderLabels.length === barN
            ? segmentHeaderLabels[bi]!
            : barNumberStart + bi;
        const segmentOuterStyle =
          drumGridBeatBorders != null
            ? {
                width: colWidth * stepsThisBar,
                flexShrink: 0 as const,
                boxSizing: 'border-box' as const,
                /** Flat column model ? pad grid has no per-bar inset; extra 1px here skewed playline vs digits. */
                borderLeft: 'none',
                display: 'flex' as const,
                flexDirection: 'column' as const,
              }
            : {
                width: colWidth * stepsThisBar,
                flexShrink: 0 as const,
                borderLeft: `1px solid ${bi % 4 === 0 ? '#2a2a32' : '#1c1c24'}`,
                display: 'flex' as const,
                flexDirection: 'column' as const,
              };
        return (
          <div key={bi} style={segmentOuterStyle}>
            <div
              onPointerDown={onRangeCommit ? (e) => {
                dragStartBarRef.current = dawBarFromPointer(e.clientX);
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } : undefined}
              onPointerUp={onRangeCommit ? (e) => {
                if (dragStartBarRef.current == null) return;
                const endBar = dawBarFromPointer(e.clientX);
                const s = dragStartBarRef.current;
                onRangeCommit(Math.min(s, endBar), Math.max(s, endBar));
                dragStartBarRef.current = null;
                try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* */ }
              } : undefined}
              style={{
                height: barRowH,
                flexShrink: 0,
                fontSize: compactDrumRuler ? 11 : 8,
                fontFamily: 'monospace',
                fontWeight: 900,
                color: isActiveBar ? color : '#4a4a58',
                textAlign: 'center',
                lineHeight: `${barRowH}px`,
                background: isActiveBar ? `${color}15` : 'transparent',
                borderBottom: `1px solid ${isActiveBar ? color : '#1a1a24'}`,
                cursor: onRangeCommit ? 'ew-resize' : 'default',
                touchAction: 'none',
                overflow: compactDrumRuler ? 'visible' : 'hidden',
                position: 'relative' as const,
                zIndex: compactDrumRuler ? 2 : undefined,
              }}
            >
              {barLabel}
            </div>
            <div
              style={{
                display: 'flex',
                flex: compactDrumRuler ? undefined : 1,
                height: compactDrumRuler ? stepRowH : undefined,
                flexShrink: 0,
                alignItems: 'center',
              }}
            >
              {Array.from({ length: stepsThisBar }, (_, mi) => {
                const ci = colStart + mi;
                const inActiveSeg =
                  activeCol >= colStart &&
                  activeCol < colStart + stepsThisBar;
                const beatInSeg = Math.floor(mi / highlightSubdiv) + 1;
                const useCreationHighlight =
                  creationBeatHighlight != null &&
                  creationBeatHighlight >= 1 &&
                  creationBeatHighlight <= highlightBeats;
                const isHead = disablePlayheadHighlight
                  ? false
                  : useCreationHighlight
                  ? inActiveSeg && beatInSeg === creationBeatHighlight
                  : activeCol === ci;
                /** Drum grid: playline column only tints digit (violet), not bar-color cell wash. */
                const drumBeatPlayline =
                  drumGridBeatBorders != null && isHead;
                /** Drum quant row: quarter count 1–4 per bar (same as MEASURES row), not 1–N step index per column. */
                const quantStepLabel =
                  drumGridBeatBorders != null
                    ? mi % highlightSubdiv === 0
                      ? String(beatInSeg)
                      : ''
                    : String(mi + 1);
                const bankCol =
                  drumGridBeatBorders != null ? ci + drumGridBeatBorders.bankColOffset : -1;
                const beatBorderLeft =
                  drumGridBeatBorders != null && bankCol >= 0
                    ? `1px solid ${creationDrumGridVerticalLineColor({
                        colWidthPx: colWidth,
                        bankCol,
                        qpb: drumGridBeatBorders.qpb,
                        subdiv: drumGridBeatBorders.subdiv,
                        blendTo: '#0a0a0e',
                      })}`
                    : mi > 0
                      ? '1px solid #2a2a2a'
                      : 'none';
                const beatCellSizing =
                  drumGridBeatBorders != null
                    ? {
                        width: colWidth,
                        minWidth: colWidth,
                        maxWidth: colWidth,
                        flexShrink: 0 as const,
                        boxSizing: 'border-box' as const,
                      }
                    : { flex: 1 };
                return (
                  <div
                    key={mi}
                    onClick={
                      onSeekPatternCol && drumGridBeatBorders
                        ? (e) => {
                            e.stopPropagation();
                            onSeekPatternCol(ci);
                          }
                        : undefined
                    }
                    data-drum-pattern-col={drumGridBeatBorders != null ? ci : undefined}
                    data-drum-playline-lit-cell={drumGridBeatBorders != null ? '1' : undefined}
                    style={{
                      ...beatCellSizing,
                      fontSize: 7,
                      textAlign: 'center',
                      color: drumBeatPlayline ? '#7cf4c6' : isHead ? color : '#2a2a32',
                      fontWeight: drumBeatPlayline ? 900 : isHead ? 700 : 400,
                      background: drumBeatPlayline
                        ? 'rgba(124, 244, 198, 0.18)'
                        : isHead
                          ? `${color}20`
                          : 'transparent',
                      boxShadow: drumBeatPlayline ? 'inset 0 0 0 1px rgba(124, 244, 198, 0.45)' : undefined,
                      borderLeft: beatBorderLeft,
                      fontFamily: 'monospace',
                      lineHeight: compactDrumRuler ? `${stepRowH}px` : '13px',
                      height: compactDrumRuler ? stepRowH : undefined,
                      display: compactDrumRuler ? 'flex' : undefined,
                      alignItems: compactDrumRuler ? 'center' : undefined,
                      justifyContent: compactDrumRuler ? 'center' : undefined,
                      overflow: compactDrumRuler ? 'hidden' : undefined,
                      position: 'relative' as const,
                      cursor: onSeekPatternCol && drumGridBeatBorders ? 'pointer' : undefined,
                    }}
                    title={onSeekPatternCol && drumGridBeatBorders ? 'Move playhead here' : undefined}
                  >
                    {quantStepLabel}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ?? BankButtons (memoized to prevent re-render on BPM change) ?????????????????

interface BankButtonsProps {
  activeBank: number;
  setActiveBank: (i: number) => void;
  hasDrums: (i: number) => boolean;
  hasNotes: (i: number) => boolean;
}


const BankButtons = memo(({ activeBank, setActiveBank, hasDrums, hasNotes }: BankButtonsProps) => (
  <div style={{ display: 'flex', gap: 3 }}>
    {BANKS.map((b, i) => (
      <button key={b} onClick={() => setActiveBank(i)} style={{ position: 'relative', width: 24, height: 24, borderRadius: 4, fontSize: 10, fontWeight: 900, background: activeBank === i ? '#193025' : '#1a1a24', color: activeBank === i ? '#7cf4c6' : '#6a6a78', border: `1px solid ${activeBank === i ? 'rgba(124,244,198,0.45)' : '#2a2a32'}`, cursor: 'pointer' }}>
        {b}
        {hasDrums(i) && <div style={{ position: 'absolute', top: 1, right: 1, width: 4, height: 4, borderRadius: '50%', background: '#ff6b35' }} />}
        {hasNotes(i) && <div style={{ position: 'absolute', bottom: 1, right: 1, width: 4, height: 4, borderRadius: '50%', background: '#00E5FF' }} />}
      </button>
    ))}
  </div>
));

BankButtons.displayName = 'BankButtons';


// ?? Beat Lab deck toolbar (under transport ? preset, uploads, kit, sampler) ?

type CreationSe2ReadoutRegistry = {
  bars: React.MutableRefObject<Set<HTMLSpanElement>>;
  time: React.MutableRefObject<Set<HTMLSpanElement>>;
};

function CreationSe2BarsClockChip({ registry }: { registry: CreationSe2ReadoutRegistry }) {
  const valueRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = valueRef.current;
    if (!el) return;
    registry.bars.current.add(el);
    return () => {
      registry.bars.current.delete(el);
    };
  }, [registry]);
  return (
    <div
      style={{
        height: 32,
        borderRadius: 4,
        border: '1px solid #2a2a32',
        padding: '0 8px',
        boxSizing: 'border-box',
        background: 'rgba(0,0,0,0.45)',
        minWidth: 112,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
      }}
      title="Bar ? beat ? tick (Studio Editor 2)"
    >
      <span
        style={{
          fontSize: 7,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          lineHeight: 1,
          color: '#6a6a78',
        }}
      >
        Bars
      </span>
      <span
        ref={valueRef}
        style={{
          fontSize: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          marginTop: 2,
          color: '#fff',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          width: '100%',
        }}
      >
        1.1.00
      </span>
    </div>
  );
}

function CreationSe2TimeClockChip({ registry }: { registry: CreationSe2ReadoutRegistry }) {
  const valueRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = valueRef.current;
    if (!el) return;
    registry.time.current.add(el);
    return () => {
      registry.time.current.delete(el);
    };
  }, [registry]);
  return (
    <div
      style={{
        height: 32,
        borderRadius: 4,
        border: '1px solid #2a2a32',
        padding: '0 6px',
        boxSizing: 'border-box',
        background: 'rgba(0,0,0,0.45)',
        minWidth: 72,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
      }}
      title="Elapsed time at playhead"
    >
      <span
        style={{
          fontSize: 7,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          lineHeight: 1,
          color: '#6a6a78',
        }}
      >
        Time
      </span>
      <span
        ref={valueRef}
        style={{
          fontSize: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          marginTop: 2,
          color: '#9dc6ff',
        }}
      >
        00:00:00
      </span>
    </div>
  );
}

function CreationSe2TransportClockChips({ registry }: { registry: CreationSe2ReadoutRegistry }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <CreationSe2BarsClockChip registry={registry} />
      <CreationSe2TimeClockChip registry={registry} />
    </div>
  );
}

function BeatLabDeckFocusChip({
  active,
  label,
  onClick,
  title,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        fontSize: 9,
        fontWeight: 800,
        color: active ? '#7cf4c6' : '#8a8a98',
        background: active ? 'rgba(124, 244, 198, 0.14)' : 'rgba(255, 255, 255, 0.04)',
        border: `1px solid ${active ? 'rgba(124, 244, 198, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
        borderRadius: 4,
        padding: '3px 7px',
        cursor: 'pointer',
        letterSpacing: 0.4,
      }}
    >
      {label}
    </button>
  );
}

function BeatLabGridLayoutToggle({
  mode,
  onDefault,
  onFull,
}: {
  mode: BeatLabGridLayoutMode;
  onDefault: () => void;
  onFull: () => void;
}) {
  const chip = (active: boolean) => ({
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: 3,
    fontSize: 9,
    fontWeight: 800 as const,
    color: active ? '#7cf4c6' : '#8a8a98',
    background: active ? 'rgba(124, 244, 198, 0.14)' : 'rgba(255, 255, 255, 0.04)',
    border: `1px solid ${active ? 'rgba(124, 244, 198, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
    borderRadius: 4,
    padding: '3px 6px',
    cursor: 'pointer' as const,
  });
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginLeft: 4,
        paddingLeft: 8,
        borderLeft: '1px solid rgba(124, 244, 198, 0.18)',
      }}
    >
      <span style={{ fontSize: 8, fontWeight: 800, color: '#5c5c68', letterSpacing: 0.6 }}>GRID</span>
      <button
        type="button"
        onClick={onDefault}
        title="Standard layout ? sampler pads and tools above the step grid"
        style={chip(mode === 'default')}
      >
        <Minimize2 size={10} aria-hidden />
        STD
      </button>
      <button
        type="button"
        onClick={onFull}
        title="Full grid editor ? maximize step sequencer workspace for editing"
        style={chip(mode === 'full')}
      >
        <Maximize2 size={10} aria-hidden />
        FULL
      </button>
    </div>
  );
}


interface BeatLabDeckToolbarProps {
  kit: string;
  setKit: (k: string) => void;
  hasPadSample: (padIndex: number) => boolean;
  onLoadPadSample: (padIndex: number) => void;
  onClearPadSample: (padIndex: number) => void;
  onGeniusUpload?: () => void;
  /** Pick a folder of drum samples from disk ? auto-maps to pads. */
  onGeniusImportFolder?: () => void;
  /** Load trap drum folder into Bank B with renamed instruments (808 / clap / hits). */
  onLoadBrassRoomFolder?: () => void;
  onLoadBrassRoomFromProject?: () => void;
  brassRoomLoading?: boolean;
  onOpenTrapKitBrowser?: () => void;
  kitImportHint?: string | null;
  producerKitId?: BeatLabProducerKitId;
  onProducerKitIdChange?: (id: BeatLabProducerKitId) => void;
  onLoadProducerKit?: () => void;
  producerKitLoading?: boolean;
  producerKitTribute?: string | null;
  loadingProducerKitId?: BeatLabProducerKitId | null;
  activeBank?: number;
  onLoadDefaultKitToBank?: (kitId: BeatLabProducerKitId, bankIndex: number) => void;
  /** Last Pattern Bank drum preset — highlighted next to crew kit / Load kit. */
  patternBankActivePick?: string | null;
  onGeniusMySoundPlay?: (padIndex: number) => void;
  /** Velocity-sensitive pad strike from Beat Pads drum machine overlay. */
  onStrikeDrumPad?: (padIndex: number, velocity01: number, gridCol?: number, whenSec?: number) => void;
  /** VocalBox Hum Melody → Beat Lab SYNTH (CH 17–19). */
  onApplyHumMelody?: (payload: import('@/app/components/creation/BeatPadsVocalBoxHumMelodyPanel').BeatPadsVocalBoxHumMelodyApply) => void;
  getDrumPadVoice?: (padIndex: number) => BeatLabDrumPadVoiceOpts;
  commitDrumPadVoice?: (padIndex: number, voice: BeatLabDrumPadVoiceOpts) => void;
  onPreviewDrumPad?: (padIndex: number) => void;
  /** Open CH 17 spread pitch roll (pads unchanged). */
  onSpreadHitToPads?: (
    sourcePad: number,
    direction: BeatPadsSpreadDirection,
    gridStepsPerBar?: import('@/app/lib/creationStation/beatLabDrumMachineSequencer').BeatPadsGridStepsPerBar,
  ) => void;
  onUndoSpreadHitToPads?: (sourcePad: number) => void;
  beatPadsSpreadActive?: boolean;
  beatPadsSpreadDirection?: BeatPadsSpreadDirection;
  beatPadsSpreadRootMidi?: number;
  beatPadsSpreadBaseLabel?: string;
  beatPadsSpreadNotes?: BeatPadsSpreadNote[];
  beatPadsSpreadLoopBars?: BeatPadsSpreadLoopBars;
  beatPadsSpreadStepsPerBar?: import('@/app/lib/creationStation/beatLabDrumMachineSequencer').BeatPadsGridStepsPerBar;
  onBeatPadsSpreadNotesChange?: (notes: BeatPadsSpreadNote[]) => void;
  onBeatPadsSpreadLoopBarsChange?: (bars: BeatPadsSpreadLoopBars) => void;
  onBeatPadsSpreadDirectionChange?: (direction: BeatPadsSpreadDirection) => void;
  onBeatPadsSpreadMixerChannelChange?: (ch: number) => void;
  onBeatPadsSpreadGridStepsPerBarChange?: (
    stepsPerBar: import('@/app/lib/creationStation/beatLabDrumMachineSequencer').BeatPadsGridStepsPerBar,
  ) => void;
  beatPadsSpreadMixerChannel?: number;
  beatPadsSpreadKeyLockEnabled?: boolean;
  beatPadsSpreadKeyLabel?: string;
  beatPadsSpreadHarmonyLane?: number;
  beatPadsSpreadHarmonyLaneNotes?: import('@/app/lib/creationStation/beatLabMidiRoll').BeatLabMidiNote[];
  onBeatPadsSpreadKeyLockChange?: (enabled: boolean) => void;
  onBeatPadsSpreadHarmonyLaneChange?: (lane: number) => void;
  onBeatPadsSpreadRegenerateChordRoots?: () => void;
  onPreviewBeatPadsSpreadRow?: (row: number, gridCol?: number) => void;
  onStrikeBeatPadsSpreadRow?: (row: number, gridCol?: number, whenSec?: number) => void;
  onCloseBeatPadsSpread?: () => void;
  onWarmAudio?: () => void | Promise<void>;
  onLoadSoundFamilySample?: (args: { familyId: string; pad: number; label: string; relFile: string }) => void;
  onPreviewSoundFamilySample?: (args: { familyId: string; pad: number; relFile: string }) => void;
  onImportBeatPadsFromBeatLab?: () => { pattern: BeatPadsDrumPattern; loopBars: number } | void;
  onExportBeatPadsToBeatLab?: (pattern: BeatPadsDrumPattern, loopBars: number) => void;
  onExportBeatPadsToStudioEditor2?: (args: {
    pattern: BeatPadsDrumPattern;
    loopBars: number;
    stepsPerBar: BeatPadsGridStepsPerBar;
    bpm: number;
  }) => void;
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
  beatPadsSe2Inject?: {
    pattern: BeatPadsDrumPattern;
    loopBars: number;
    stepsPerBar: BeatPadsGridStepsPerBar;
    bpm: number;
    trackName?: string;
    nonce: number;
  } | null;
  onBeatPadsSe2InjectConsumed?: () => void;
  /** Beat Pads drum machine overlay — sampler deck stays visible underneath. */
  beatPadsMachineOpen: boolean;
  setBeatPadsMachineOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** Footer Pattern Bank → Beat Pads loop when overlay is open. */
  beatPadsPatternInject?: { preset: PatternPreset; nonce: number } | null;
  onBeatPadsPatternInjectConsumed?: () => void;
  onPatternPresetHighlighted?: (preset: PatternPreset) => void;
  onLoadBeatPadsPatternKit?: (preset: PatternPreset) => void;
  /** Pattern Bank — routes to Beat Pads loop when overlay open, else Beat Lab grid. */
  onLoadPatternPreset?: (preset: PatternPreset) => void;
  patternSlot?: PatternSlot;
  onPatternSlotChange?: (slot: PatternSlot) => void;
  loadedPatternBankId?: BeatLabPatternBankId | null;
  loadedPatternPresetId?: string | null;
  patternBankDisabled?: boolean;
  /** Stop all currently playing sample voices on this pad (long samples / stacked hits). */
  onStopPadSamplePlayback?: (padIndex: number) => void;
  /** Pad index 0?15 that receives the next file from ?Upload sound?. */
  geniusSamplerTargetPad?: number;
  onGeniusSamplerTargetPadChange?: (padIndex: number) => void;
  /** Source BPM for tempo sync (optional per pad). */
  padSampleRootBpmForPad?: (padIndex: number) => number | undefined;
  onCommitPadSampleRootBpm?: (padIndex: number, raw: string) => void;
  /** Loaded sample display name (matches sequencer lane when set). */
  padSampleLabelForPad?: (padIndex: number) => string | undefined;
  /** Persist display name for this pad?s sample (localStorage + lane label). */
  onCommitPadSampleLabel?: (padIndex: number, label: string) => void;
  /** Bump local numeric field when bank / stored root changes */
  samplerUiBank?: number;
  /** Per-pad HPF/LPF/trim/fine (stored with sample). */
  getPadSamplerOpts?: (padIndex: number) => PadSamplerPlaybackOpts;
  commitPadSamplerOpts?: (padIndex: number, o: PadSamplerPlaybackOpts) => void;
  /** One-shot preview using these opts (does not persist until Apply). */
  onPreviewSamplerFx?: (padIndex: number, o: PadSamplerPlaybackOpts) => void;
  getPadSamplerFxRack?: (padIndex: number) => PadSamplerFxRack;
  commitPadSamplerFxRack?: (padIndex: number, rack: PadSamplerFxRack) => void;
  /** Keep pad playback in sync while EFX popover is open (before Apply). */
  onLivePadFxRackDraft?: (padIndex: number, rack: PadSamplerFxRack) => void;
  /** Beat Pads overlay — in-memory sampler opts while dragging knobs. */
  onLiveSamplerDraft?: (padIndex: number, o: PadSamplerPlaybackOpts) => void;
  onLiveDrumPadVoiceDraft?: (padIndex: number, voice: BeatLabDrumPadVoiceOpts) => void;
  onPreviewSamplerFxRack?: (padIndex: number, rack: PadSamplerFxRack) => void;
  /** Preview with SRC BPM field value (does not persist until blur/Enter). */
  onPreviewSamplerRootBpmDraft?: (padIndex: number, raw: string) => void;
  /** Loaded buffer for trim waveform + time readouts (same pad as Beat Lab lane). */
  getPadSampleAudioBuffer?: (padIndex: number) => AudioBuffer | undefined;
  /** Same row as kit: clear grid/lane + Studio handoff */
  patternActionsDisabled?: boolean;
  onClearGrid?: () => void;
  onClearLane?: () => void;
  clearLaneDisabled?: boolean;
  clearLaneTitle?: string;
  onDownloadHandoff?: () => void;
  /** Kit dropdown: `preset:Name` or `saved:<id>` */
  kitSelectValue?: string;
  onKitSelectChange?: (value: string) => void;
  presetKitNames?: readonly string[];
  savedKits?: { id: string; name: string }[];
  onSaveKit?: (name: string) => void;
  onRenameSavedKit?: (id: string, name: string) => void;
  onDeleteSavedKit?: (id: string) => void;
  saveKitStatus?: string | null;
  savedSongs?: { id: string; name: string }[];
  onSaveSong?: (name: string) => void;
  onLoadSavedSong?: (id: string) => void;
  onRenameSavedSong?: (id: string, name: string) => void;
  onDeleteSavedSong?: (id: string) => void;
  saveSongStatus?: string | null;
  /** SESSION link + grid zoom (px slider, FIT) */
  sessionZoomTools?: React.ReactNode;
  /** Grid snap subdiv — rendered beside Save on kit row */
  snapTools?: React.ReactNode;
  /** Bars / Time readouts ? beside Save and under grid zoom */
  deckTransportClocks?: React.ReactNode;
  /** 32-ch piano roll panel (under sampler pads) */
  pianoRollSlot?: React.ReactNode;
  /** Beat Lab mixer strip panel (pads CH 1–16 + melodic CH 17–32) */
  beatLabMixerOpen?: boolean;
  onBeatLabMixerToggle?: (opts?: { padsOnly?: boolean }) => void;
  beatLabDeckFocus?: BeatLabDeckFocus;
  onBeatLabDeckFocusChange?: (focus: BeatLabDeckFocus) => void;
  /** GRID full editor ? hide 16-pad sampler block; kit row stays visible. */
  hideSamplerPads?: boolean;
  /** Lane 1?16 focus ? lights matching sampler pad + grid rail. */
  selectedDrumPad?: number | null;
  onSelectDrumPad?: (padIndex: number) => void;
  selectedMelodicLane?: number | null;
  melodicInstruments?: string[];
  melodicSynthPresetIds?: string[];
  channelVolumes?: Record<number, number>;
  getAudioContext?: () => AudioContext;
  onMelodicInstrumentChange?: (slotIndex: number, instrumentId: string) => void;
  onMelodicSynthPresetChange?: (slotIndex: number, presetId: string) => void;
  creationBackendBlank?: boolean;
  /** Project BPM ? delay sync + readout in EFX rack. */
  sessionBpm?: number;
}

function BeatLabDeckToolbar({
  kit,
  setKit,
  hasPadSample,
  onLoadPadSample,
  onClearPadSample,
  onGeniusUpload,
  onGeniusImportFolder,
  onLoadBrassRoomFolder,
  onLoadBrassRoomFromProject,
  brassRoomLoading = false,
  onOpenTrapKitBrowser,
  kitImportHint,
  producerKitId = 'trapDarkVault',
  onProducerKitIdChange,
  onLoadProducerKit,
  producerKitLoading = false,
  producerKitTribute,
  loadingProducerKitId = null,
  activeBank = 0,
  onLoadDefaultKitToBank,
  patternBankActivePick = null,
  onGeniusMySoundPlay,
  onStrikeDrumPad,
  onApplyHumMelody,
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
  onBeatPadsSpreadMixerChannelChange,
  onBeatPadsSpreadGridStepsPerBarChange,
  beatPadsSpreadMixerChannel = 17,
  beatPadsSpreadKeyLockEnabled = false,
  beatPadsSpreadKeyLabel = 'key',
  beatPadsSpreadHarmonyLane = 17,
  beatPadsSpreadHarmonyLaneNotes = [],
  onBeatPadsSpreadKeyLockChange,
  onBeatPadsSpreadHarmonyLaneChange,
  onBeatPadsSpreadRegenerateChordRoots,
  onPreviewBeatPadsSpreadRow,
  onStrikeBeatPadsSpreadRow,
  onCloseBeatPadsSpread,
  onWarmAudio,
  onLoadSoundFamilySample,
  onPreviewSoundFamilySample,
  onImportBeatPadsFromBeatLab,
  onExportBeatPadsToBeatLab,
  onExportBeatPadsToStudioEditor2,
  onSaveBeatPadsSession,
  savedBeatPadsSessions = [],
  beatPadsSessionSaveStatus,
  onLoadBeatPadsSession,
  onRenameBeatPadsSession,
  onDeleteBeatPadsSession,
  beatPadsSessionInject,
  onBeatPadsSessionInjectConsumed,
  beatPadsSe2Inject,
  onBeatPadsSe2InjectConsumed,
  beatPadsMachineOpen,
  setBeatPadsMachineOpen,
  beatPadsPatternInject,
  onBeatPadsPatternInjectConsumed,
  onPatternPresetHighlighted,
  onLoadBeatPadsPatternKit,
  onLoadPatternPreset,
  patternSlot = 'A',
  onPatternSlotChange,
  loadedPatternBankId = null,
  loadedPatternPresetId = null,
  patternBankDisabled = false,
  onStopPadSamplePlayback,
  geniusSamplerTargetPad = 14,
  onGeniusSamplerTargetPadChange,
  padSampleRootBpmForPad,
  onCommitPadSampleRootBpm,
  padSampleLabelForPad,
  onCommitPadSampleLabel,
  samplerUiBank = 0,
  getPadSamplerOpts,
  commitPadSamplerOpts,
  onPreviewSamplerFx,
  getPadSamplerFxRack,
  commitPadSamplerFxRack,
  onLivePadFxRackDraft,
  onLiveSamplerDraft,
  onLiveDrumPadVoiceDraft,
  onPreviewSamplerFxRack,
  onPreviewSamplerRootBpmDraft,
  getPadSampleAudioBuffer,
  patternActionsDisabled = false,
  onClearGrid,
  onClearLane,
  clearLaneDisabled = true,
  clearLaneTitle,
  onDownloadHandoff,
  kitSelectValue,
  onKitSelectChange,
  presetKitNames = KITS,
  savedKits = [],
  onSaveKit,
  onRenameSavedKit,
  onDeleteSavedKit,
  saveKitStatus = null,
  savedSongs = [],
  onSaveSong,
  onLoadSavedSong,
  onRenameSavedSong,
  onDeleteSavedSong,
  saveSongStatus = null,
  sessionZoomTools,
  snapTools,
  deckTransportClocks,
  pianoRollSlot,
  beatLabMixerOpen = false,
  onBeatLabMixerToggle,
  beatLabDeckFocus = 'sequence',
  onBeatLabDeckFocusChange,
  hideSamplerPads = false,
  selectedDrumPad = null,
  onSelectDrumPad,
  selectedMelodicLane = null,
  melodicInstruments = [...BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS],
  melodicSynthPresetIds = Array.from({ length: 16 }, () => BEAT_LAB_DEFAULT_SYNTH_PRESET_ID),
  channelVolumes = {},
  getAudioContext,
  onMelodicInstrumentChange,
  onMelodicSynthPresetChange,
  creationBackendBlank = false,
  sessionBpm = 120,
}: BeatLabDeckToolbarProps) {
  const kitDropdownValue = kitSelectValue ?? `preset:${presetKitNames[0] ?? KITS[0]}`;
  const [saveKitOpen, setSaveKitOpen] = useState(false);
  const [saveKitNameDraft, setSaveKitNameDraft] = useState('');
  const [saveSongNameDraft, setSaveSongNameDraft] = useState('');
  const [renameKitId, setRenameKitId] = useState<string | null>(null);
  const [renameKitDraft, setRenameKitDraft] = useState('');
  const [renameSongId, setRenameSongId] = useState<string | null>(null);
  const [renameSongDraft, setRenameSongDraft] = useState('');
  const saveKitPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!saveKitOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-save-kit-root]')) return;
      setSaveKitOpen(false);
      setRenameKitId(null);
      setRenameSongId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, [saveKitOpen]);

  /** Which pad?s SRC BPM popover is open (null = all closed). */
  const [srcBpmOpenPad, setSrcBpmOpenPad] = useState<number | null>(null);
  const [srcBpmDraft, setSrcBpmDraft] = useState('');
  const srcBpmDraftRef = useRef('');
  srcBpmDraftRef.current = srcBpmDraft;
  const srcBpmOpenPadRef = useRef<number | null>(null);
  srcBpmOpenPadRef.current = srcBpmOpenPad;
  /** Stable ref ? parent recreates `onCommitPadSampleRootBpm` when `padSamplePresence` changes; must not re-run bank-switch FX close. */
  const onCommitPadSampleRootBpmRef = useRef(onCommitPadSampleRootBpm);
  onCommitPadSampleRootBpmRef.current = onCommitPadSampleRootBpm;

  const [fxOpenPad, setFxOpenPad] = useState<number | null>(null);
  const [fxDraft, setFxDraft] = useState<PadSamplerPlaybackOpts>(() => defaultPadSamplerPlaybackOpts());
  const fxDraftRef = useRef(fxDraft);
  fxDraftRef.current = fxDraft;

  const [efxOpenPad, setEfxOpenPad] = useState<number | null>(null);
  const [efxDraft, setEfxDraft] = useState<PadSamplerFxRack>(() => defaultPadSamplerFxRack());
  const efxDraftRef = useRef(efxDraft);
  efxDraftRef.current = efxDraft;
  /** Lane / pad name while SAMPLE EDIT is open ? kept in ref for document dismiss + pad switch commits. */
  const [fxLabelDraft, setFxLabelDraft] = useState('');
  const fxLabelDraftRef = useRef('');
  fxLabelDraftRef.current = fxLabelDraft;
  const onCommitPadSampleLabelRef = useRef(onCommitPadSampleLabel);
  onCommitPadSampleLabelRef.current = onCommitPadSampleLabel;

  useEffect(() => {
    if (fxOpenPad === null) {
      setFxLabelDraft('');
      return;
    }
    setFxLabelDraft((padSampleLabelForPad?.(fxOpenPad) ?? '').trim());
    // Only when opening a pad or switching bank ? not when `padSampleLabelForPad` identity changes (parent inline fn).
  }, [fxOpenPad, samplerUiBank]);

  const fxOpenTrimBuffer =
    fxOpenPad !== null ? getPadSampleAudioBuffer?.(fxOpenPad) : undefined;
  const fxTrimWavePeaks = useMemo(() => {
    if (!fxOpenTrimBuffer || fxOpenTrimBuffer.length === 0) return null;
    return computePadSampleWaveformPeaks(fxOpenTrimBuffer, 400);
  }, [fxOpenPad, fxOpenTrimBuffer]);

  const toggleSrcBpmMenu = useCallback(
    (padIndex: number) => {
      if (srcBpmOpenPad === padIndex) {
        onCommitPadSampleRootBpm?.(padIndex, srcBpmDraftRef.current);
        setSrcBpmOpenPad(null);
        return;
      }
      if (fxOpenPad !== null) {
        onCommitPadSampleLabelRef.current?.(fxOpenPad, fxLabelDraftRef.current.trim());
        commitPadSamplerOpts?.(fxOpenPad, fxDraftRef.current);
        setFxOpenPad(null);
      }
      if (efxOpenPad !== null) {
        commitPadSamplerFxRack?.(efxOpenPad, efxDraftRef.current);
        setEfxOpenPad(null);
      }
      if (srcBpmOpenPad !== null && srcBpmOpenPad !== padIndex) {
        onCommitPadSampleRootBpm?.(srcBpmOpenPad, srcBpmDraftRef.current);
      }
      setSrcBpmOpenPad(padIndex);
      const r = padSampleRootBpmForPad?.(padIndex);
      setSrcBpmDraft(r != null && r > 0 ? String(r) : '');
    },
    [srcBpmOpenPad, fxOpenPad, efxOpenPad, padSampleRootBpmForPad, onCommitPadSampleRootBpm, commitPadSamplerOpts, commitPadSamplerFxRack],
  );

  const toggleFxMenu = useCallback(
    (padIndex: number) => {
      if (!commitPadSamplerOpts || !getPadSamplerOpts) return;
      if (fxOpenPad === padIndex) {
        onCommitPadSampleLabelRef.current?.(padIndex, fxLabelDraftRef.current.trim());
        commitPadSamplerOpts(padIndex, fxDraftRef.current);
        setFxOpenPad(null);
        return;
      }
      if (srcBpmOpenPad !== null) {
        onCommitPadSampleRootBpm?.(srcBpmOpenPad, srcBpmDraftRef.current);
        setSrcBpmOpenPad(null);
      }
      if (efxOpenPad !== null) {
        commitPadSamplerFxRack?.(efxOpenPad, efxDraftRef.current);
        setEfxOpenPad(null);
      }
      if (fxOpenPad !== null && fxOpenPad !== padIndex) {
        onCommitPadSampleLabelRef.current?.(fxOpenPad, fxLabelDraftRef.current.trim());
        commitPadSamplerOpts(fxOpenPad, fxDraftRef.current);
      }
      setFxOpenPad(padIndex);
      setFxDraft({ ...getPadSamplerOpts(padIndex) });
    },
    [fxOpenPad, efxOpenPad, srcBpmOpenPad, commitPadSamplerOpts, getPadSamplerOpts, onCommitPadSampleRootBpm, commitPadSamplerFxRack],
  );

  const toggleEfxMenu = useCallback(
    (padIndex: number) => {
      if (!commitPadSamplerFxRack || !getPadSamplerFxRack) return;
      if (efxOpenPad === padIndex) {
        commitPadSamplerFxRack(padIndex, efxDraftRef.current);
        setEfxOpenPad(null);
        return;
      }
      if (srcBpmOpenPad !== null) {
        onCommitPadSampleRootBpm?.(srcBpmOpenPad, srcBpmDraftRef.current);
        setSrcBpmOpenPad(null);
      }
      if (fxOpenPad !== null) {
        onCommitPadSampleLabelRef.current?.(fxOpenPad, fxLabelDraftRef.current.trim());
        commitPadSamplerOpts?.(fxOpenPad, fxDraftRef.current);
        setFxOpenPad(null);
      }
      if (efxOpenPad !== null && efxOpenPad !== padIndex) {
        commitPadSamplerFxRack(efxOpenPad, efxDraftRef.current);
      }
      setEfxOpenPad(padIndex);
      setEfxDraft({ ...getPadSamplerFxRack(padIndex) });
    },
    [efxOpenPad, fxOpenPad, srcBpmOpenPad, commitPadSamplerFxRack, getPadSamplerFxRack, commitPadSamplerOpts, onCommitPadSampleRootBpm],
  );

  useEffect(() => {
    const pad = srcBpmOpenPadRef.current;
    if (pad !== null) {
      onCommitPadSampleRootBpmRef.current?.(pad, srcBpmDraftRef.current);
      setSrcBpmOpenPad(null);
    }
    /** Bank switch: close FX panel without auto-commit (avoids writing to wrong bank index). */
    setFxOpenPad(null);
    setEfxOpenPad(null);
  }, [samplerUiBank]);

  useEffect(() => {
    if (srcBpmOpenPad === null) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-src-bpm-root]')) return;
      if (t?.closest?.('[data-fx-root]')) return;
      if (t?.closest?.('[data-efx-root]')) return;
      if (t?.closest?.('[data-beatlab-portal-popover]')) return;
      onCommitPadSampleRootBpmRef.current?.(srcBpmOpenPad, srcBpmDraftRef.current);
      setSrcBpmOpenPad(null);
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, [srcBpmOpenPad]);

  useEffect(() => {
    if (fxOpenPad === null) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-fx-root]')) return;
      if (t?.closest?.('[data-efx-root]')) return;
      if (t?.closest?.('[data-src-bpm-root]')) return;
      if (t?.closest?.('[data-beatlab-portal-popover]')) return;
      onCommitPadSampleLabelRef.current?.(fxOpenPad, fxLabelDraftRef.current.trim());
      commitPadSamplerOpts?.(fxOpenPad, fxDraftRef.current);
      setFxOpenPad(null);
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, [fxOpenPad, commitPadSamplerOpts]);

  useEffect(() => {
    if (efxOpenPad === null) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-efx-root]')) return;
      if (t?.closest?.('[data-fx-root]')) return;
      if (t?.closest?.('[data-src-bpm-root]')) return;
      if (t?.closest?.('[data-beatlab-portal-popover]')) return;
      commitPadSamplerFxRack?.(efxOpenPad, efxDraftRef.current);
      setEfxOpenPad(null);
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, [efxOpenPad, commitPadSamplerFxRack]);

  useEffect(() => {
    if (efxOpenPad === null || !onLivePadFxRackDraft) return;
    onLivePadFxRackDraft(efxOpenPad, clonePadSamplerFxRack(efxDraftRef.current));
  }, [efxDraft, efxOpenPad, onLivePadFxRackDraft]);

  /** Anchors for fixed popovers (portaled to `document.body` ? avoids Creation root `overflow:hidden`). */
  const srcBpmTriggerRefs = useRef<Array<HTMLButtonElement | null>>(Array.from({ length: 16 }, () => null));
  const fxTriggerRefs = useRef<Array<HTMLButtonElement | null>>(Array.from({ length: 16 }, () => null));
  const efxTriggerRefs = useRef<Array<HTMLButtonElement | null>>(Array.from({ length: 16 }, () => null));
  const srcBpmPopoverMeasureRef = useRef<HTMLDivElement | null>(null);
  const fxPopoverMeasureRef = useRef<HTMLDivElement | null>(null);
  const efxPopoverMeasureRef = useRef<HTMLDivElement | null>(null);
  type BeatLabPopRect = { left: number; top: number; width: number };
  const [srcBpmPopRect, setSrcBpmPopRect] = useState<BeatLabPopRect | null>(null);
  const [fxPopRect, setFxPopRect] = useState<BeatLabPopRect | null>(null);
  const [efxPopRect, setEfxPopRect] = useState<BeatLabPopRect | null>(null);

  const layoutBeatLabPortals = useCallback(() => {
    const VIEW = 8;
    const GAP = 4;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;

    if (fxOpenPad !== null) {
      const btn = fxTriggerRefs.current[fxOpenPad];
      if (btn) {
        const br = btn.getBoundingClientRect();
        const w = Math.min(272, vw - 2 * VIEW);
        const panel = fxPopoverMeasureRef.current;
        const rawH = panel?.offsetHeight ?? 360;
        const h = Math.min(rawH, vh - 2 * VIEW);
        let left = br.right - w;
        left = Math.max(VIEW, Math.min(left, vw - w - VIEW));
        let top = br.bottom + GAP;
        if (top + h > vh - VIEW) {
          top = br.top - GAP - h;
        }
        if (top < VIEW) {
          top = VIEW;
        }
        setFxPopRect({ left, top, width: w });
      } else {
        setFxPopRect(null);
      }
    } else {
      setFxPopRect(null);
    }

    if (efxOpenPad !== null) {
      const btn = efxTriggerRefs.current[efxOpenPad];
      if (btn) {
        const br = btn.getBoundingClientRect();
        const w = Math.min(304, vw - 2 * VIEW);
        const panel = efxPopoverMeasureRef.current;
        const rawH = panel?.offsetHeight ?? 320;
        const h = Math.min(rawH, vh - 2 * VIEW);
        let left = br.right - w;
        left = Math.max(VIEW, Math.min(left, vw - w - VIEW));
        let top = br.bottom + GAP;
        if (top + h > vh - VIEW) {
          top = br.top - GAP - h;
        }
        if (top < VIEW) {
          top = VIEW;
        }
        setEfxPopRect({ left, top, width: w });
      } else {
        setEfxPopRect(null);
      }
    } else {
      setEfxPopRect(null);
    }

    if (srcBpmOpenPad !== null) {
      const btn = srcBpmTriggerRefs.current[srcBpmOpenPad];
      if (btn) {
        const br = btn.getBoundingClientRect();
        const w = Math.min(Math.max(br.width, 180), vw - 2 * VIEW);
        let left = br.left;
        left = Math.max(VIEW, Math.min(left, vw - w - VIEW));
        const panel = srcBpmPopoverMeasureRef.current;
        const rawH = panel?.offsetHeight ?? 120;
        const h = Math.min(rawH, vh - 2 * VIEW);
        let top = br.bottom + GAP;
        if (top + h > vh - VIEW) {
          top = br.top - GAP - h;
        }
        if (top < VIEW) {
          top = VIEW;
        }
        setSrcBpmPopRect({ left, top, width: w });
      } else {
        setSrcBpmPopRect(null);
      }
    } else {
      setSrcBpmPopRect(null);
    }
  }, [fxOpenPad, efxOpenPad, srcBpmOpenPad]);

  useLayoutEffect(() => {
    layoutBeatLabPortals();
    const id = requestAnimationFrame(() => layoutBeatLabPortals());
    return () => cancelAnimationFrame(id);
  }, [layoutBeatLabPortals, fxDraft, efxDraft, srcBpmDraft]);

  useEffect(() => {
    if (fxOpenPad === null && efxOpenPad === null && srcBpmOpenPad === null) return;
    const onResizeOrScroll = () => layoutBeatLabPortals();
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);
    return () => {
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
    };
  }, [fxOpenPad, efxOpenPad, srcBpmOpenPad, layoutBeatLabPortals]);

  const showGeniusDeck = typeof onGeniusImportFolder === 'function';

  const miniBtn = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid #2a2a32',
    background: '#1e1e26',
    color: '#9dc6ff',
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  } as const;

  return (
    <>
    <div
      style={{
        width: '100%',
        maxWidth: '100%',
        padding: '5px 7px 6px',
        borderRadius: 10,
        border: '1px solid rgba(124, 244, 198, 0.22)',
        background: 'linear-gradient(165deg, rgba(11, 11, 16, 0.55) 0%, rgba(8, 8, 12, 0.95) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        overflow: 'visible',
        position: 'relative',
        zIndex: 120,
        isolation: 'isolate',
      }}
    >
        {showGeniusDeck ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'nowrap',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, rowGap: 4, flex: '1 1 auto', minWidth: 0 }}>
              <button type="button" onClick={() => onGeniusUpload?.()} style={{ ...miniBtn }}>
                <Upload size={16} strokeWidth={2} />
                Upload
              </button>
              <button
                type="button"
                onClick={() => onGeniusImportFolder?.()}
                title="Load your own drum folder from PC ? 808s, claps, snares, hats auto-map to pads (use this for custom kits)"
                style={{ ...miniBtn }}
              >
                <FolderOpen size={16} strokeWidth={2} />
                Import folder
              </button>
              <button
                type="button"
                onClick={() => onOpenTrapKitBrowser?.()}
                title="Browse kit folders (808s, Claps, Kicks, Hats?) ? load any sound onto any pad"
                style={{
                  ...miniBtn,
                  borderColor: 'rgba(255, 200, 80, 0.55)',
                  color: '#ffd966',
                  fontWeight: 900,
                }}
              >
                <FolderOpen size={16} strokeWidth={2} />
                Kit browser
              </button>
              <BeatLabHelpTip tab="kits" title="How to use Kit browser" />
              {sessionZoomTools && !hideSamplerPads ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  {sessionZoomTools}
                </div>
              ) : null}
              {kitImportHint ? (
                <span style={{ fontSize: 9, fontWeight: 700, color: '#7cf4c6', maxWidth: 200 }}>{kitImportHint}</span>
              ) : null}
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 6,
                rowGap: 4,
                marginLeft: 'auto',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 6px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 200, 80, 0.35)',
                  background: 'rgba(20, 16, 8, 0.55)',
                  maxWidth: 360,
                }}
                title="Crew kits + default banks A–H (Trap / R&B / Dance flagship kits)"
              >
                <span style={{ fontSize: 7, color: '#c9a227', fontWeight: 900, letterSpacing: 0.8 }}>CREW KITS</span>
                <BeatLabHelpTip tab="kits" title="How to use Crew kits" />
                {typeof onLoadDefaultKitToBank === 'function' ? (
                  <BeatLabDefaultKitsButton
                    disabled={patternActionsDisabled}
                    activeBank={activeBank}
                    loadingKitId={loadingProducerKitId}
                    onLoadKitToBank={onLoadDefaultKitToBank}
                  />
                ) : null}
                {typeof onSaveKit === 'function' ? (
                  <BeatLabSavedKitsButton
                    disabled={patternActionsDisabled}
                    activeBank={activeBank}
                    savedKits={savedKits}
                    draftName={kit}
                    saveKitStatus={saveKitStatus}
                    onSaveKit={onSaveKit}
                    onLoadKit={(id) => onKitSelectChange?.(`saved:${id}`)}
                    onRenameSavedKit={onRenameSavedKit}
                    onDeleteSavedKit={onDeleteSavedKit}
                  />
                ) : null}
                {patternBankActivePick ? (
                  <span
                    title={patternBankActivePick}
                    style={{
                      fontSize: 8,
                      fontWeight: 900,
                      color: '#7cf4c6',
                      padding: '3px 7px',
                      borderRadius: 4,
                      border: '1px solid rgba(124, 244, 198, 0.5)',
                      background: 'rgba(124, 244, 198, 0.12)',
                      maxWidth: 160,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flexShrink: 1,
                      letterSpacing: 0.2,
                    }}
                  >
                    Pattern: {patternBankActivePick}
                  </span>
                ) : null}
                <select
                  value={producerKitId}
                  onChange={(e) => onProducerKitIdChange?.(e.target.value as BeatLabProducerKitId)}
                  disabled={producerKitLoading}
                  style={{
                    padding: '4px 6px',
                    borderRadius: 4,
                    border: '1px solid #3a3020',
                    background: '#1e1e26',
                    color: '#f0e6c8',
                    fontSize: 9,
                    fontWeight: 700,
                    cursor: producerKitLoading ? 'wait' : 'pointer',
                    maxWidth: 168,
                  }}
                >
                  {BEAT_LAB_PRODUCER_KITS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={producerKitLoading || typeof onLoadProducerKit !== 'function'}
                  onClick={() => onLoadProducerKit?.()}
                  style={{
                    ...miniBtn,
                    opacity: producerKitLoading ? 0.55 : 1,
                    borderColor: 'rgba(255, 200, 80, 0.45)',
                    color: '#ffd966',
                  }}
                >
                  {producerKitLoading ? 'Loading?' : 'Load kit'}
                </button>
                {producerKitTribute ? (
                  <span style={{ fontSize: 8, fontWeight: 700, color: '#c9a227', lineHeight: 1.25, flex: '1 1 140px' }}>
                    {producerKitTribute}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: 'inline-flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            minWidth: 0,
            width: '100%',
            padding: '4px 6px 4px 8px',
            borderRadius: 8,
            border: '1px solid rgba(167, 139, 250, 0.4)',
            background: '#0a0a0e',
            boxSizing: 'border-box',
          }}
          title="Kit preset or your saved kit ? Save sounds + edits ? Clear pattern ? Download"
        >
          <select
            value={kitDropdownValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v.startsWith('preset:')) setKit(v.slice(7));
              onKitSelectChange?.(v);
            }}
            title="Preset label or load a saved kit (all pads + FX)"
            style={{
              padding: '5px 8px',
              borderRadius: 4,
              border: '1px solid rgba(167, 139, 250, 0.35)',
              background: '#1e1e26',
              color: '#e8e8f0',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              maxWidth: 140,
              minWidth: 0,
              flex: '0 1 auto',
              boxSizing: 'border-box',
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
                    ? {sk.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
          {typeof onClearGrid === 'function' ? (
            <button
              type="button"
              disabled={patternActionsDisabled}
              onClick={() => {
                if (patternActionsDisabled) return;
                onClearGrid();
              }}
              title="Clear all steps on the drum grid (current bank + pattern slot)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                height: 28,
                padding: '0 8px',
                borderRadius: 4,
                border: '1px solid #633',
                background: '#1a1218',
                color: '#f6a9a9',
                fontSize: 10,
                fontWeight: 800,
                cursor: patternActionsDisabled ? 'not-allowed' : 'pointer',
                opacity: patternActionsDisabled ? 0.45 : 1,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              <X size={12} strokeWidth={2.5} />
              Clear grid
            </button>
          ) : null}
          {typeof onClearLane === 'function' ? (
            <button
              type="button"
              disabled={patternActionsDisabled || clearLaneDisabled}
              onClick={() => {
                if (patternActionsDisabled || clearLaneDisabled) return;
                onClearLane();
              }}
              title={clearLaneTitle ?? 'Select a lane, then clear that row'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                height: 28,
                padding: '0 8px',
                borderRadius: 4,
                border: '1px solid #4a3a32',
                background: '#141018',
                color: '#d4a88a',
                fontSize: 10,
                fontWeight: 800,
                cursor:
                  patternActionsDisabled || clearLaneDisabled ? 'not-allowed' : 'pointer',
                opacity: patternActionsDisabled || clearLaneDisabled ? 0.45 : 1,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              <X size={11} strokeWidth={2.5} />
              Clear lane
            </button>
          ) : null}
          {typeof onDownloadHandoff === 'function' ? (
            <button
              type="button"
              disabled={patternActionsDisabled}
              onClick={() => {
                if (patternActionsDisabled) return;
                onDownloadHandoff();
              }}
              title="Export / Studio handoff (closest to Genius Home Studio Download WAV ? full render uses Export)."
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                height: 28,
                padding: '0 8px',
                borderRadius: 4,
                border: '1px solid rgba(124, 244, 198, 0.35)',
                background: 'rgba(11, 11, 16, 0.65)',
                color: '#7cf4c6',
                fontSize: 10,
                fontWeight: 800,
                cursor: patternActionsDisabled ? 'not-allowed' : 'pointer',
                opacity: patternActionsDisabled ? 0.45 : 1,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              <Download size={13} />
              Download
            </button>
          ) : null}
          {deckTransportClocks}
          {typeof onLoadBrassRoomFolder === 'function' ? (
            <button
              type="button"
              disabled={brassRoomLoading}
              onClick={() => onLoadBrassRoomFolder()}
              title={`Auto-load whole folder into Bank ${BANKS[BRASS_ROOM_BANK_INDEX]}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                height: 28,
                padding: '0 8px',
                borderRadius: 4,
                border: '1px solid rgba(124, 244, 198, 0.35)',
                background: 'rgba(11, 11, 16, 0.65)',
                color: '#7cf4c6',
                fontSize: 10,
                fontWeight: 800,
                cursor: brassRoomLoading ? 'wait' : 'pointer',
                opacity: brassRoomLoading ? 0.55 : 1,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {brassRoomLoading ? 'Loading?' : `Load all ? ${BANKS[BRASS_ROOM_BANK_INDEX]}`}
            </button>
          ) : null}
          {typeof onLoadBrassRoomFromProject === 'function' ? (
            <button
              type="button"
              disabled={brassRoomLoading}
              onClick={() => onLoadBrassRoomFromProject()}
              title="Load optional extra WAVs from public/samples/brass-room/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                height: 28,
                padding: '0 8px',
                borderRadius: 4,
                border: '1px solid rgba(124, 244, 198, 0.35)',
                background: 'rgba(11, 11, 16, 0.65)',
                color: '#7cf4c6',
                fontSize: 9,
                fontWeight: 800,
                cursor: brassRoomLoading ? 'wait' : 'pointer',
                opacity: brassRoomLoading ? 0.55 : 1,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              Load project folder
            </button>
          ) : null}
          {typeof onBeatLabMixerToggle === 'function' ? (
            <button
              type="button"
              disabled={patternActionsDisabled}
              onClick={() => {
                if (patternActionsDisabled) return;
                onBeatLabMixerToggle({ padsOnly: false });
              }}
              title="32-channel Beat Lab mixer · CH 1–16 pads · CH 17–32 melodic lanes"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                height: 28,
                padding: '0 8px',
                borderRadius: 4,
                border: '1px solid rgba(0, 229, 255, 0.45)',
                background: beatLabMixerOpen ? 'rgba(0, 229, 255, 0.14)' : 'rgba(11, 11, 16, 0.65)',
                color: '#00E5FF',
                fontSize: 10,
                fontWeight: 800,
                cursor: patternActionsDisabled ? 'not-allowed' : 'pointer',
                opacity: patternActionsDisabled ? 0.45 : 1,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              <SlidersHorizontal size={13} aria-hidden />
              Mixer
            </button>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
          {snapTools}
          {showGeniusDeck ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 8, color: '#6a6a78', fontWeight: 800, whiteSpace: 'nowrap' }}>Upload ? pad</span>
              <select
                value={geniusSamplerTargetPad}
                title="File from Upload assigns here"
                onChange={(e) => onGeniusSamplerTargetPadChange?.(Number(e.target.value))}
                style={{
                  height: 28,
                  padding: '0 6px',
                  borderRadius: 4,
                  border: '1px solid #2a2a32',
                  background: '#1a1a24',
                  color: '#ccc',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  maxWidth: 120,
                }}
              >
                {Array.from({ length: 16 }, (_, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {PAD_NAMES[i]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {typeof onSaveKit === 'function' ? (
            <div data-save-kit-root style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                disabled={patternActionsDisabled}
                onClick={() => {
                  if (patternActionsDisabled) return;
                  setSaveKitOpen((o) => !o);
                  if (!saveKitOpen) {
                    const preset =
                      kitDropdownValue.startsWith('preset:') ? kitDropdownValue.slice(7) : kit;
                    const savedName = savedKits.find((s) => kitDropdownValue === `saved:${s.id}`)?.name;
                    const draft = savedName ?? preset ?? '';
                    setSaveKitNameDraft(draft);
                    setSaveSongNameDraft(draft);
                  }
                }}
                title="Save kit and/or song (sequence + kit with all edits)"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  height: 28,
                  padding: '0 8px',
                  borderRadius: 4,
                  border: '1px solid rgba(167, 139, 250, 0.45)',
                  background: saveKitOpen ? 'rgba(167, 139, 250, 0.12)' : 'rgba(11, 11, 16, 0.65)',
                  color: '#c4b5fd',
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: patternActionsDisabled ? 'not-allowed' : 'pointer',
                  opacity: patternActionsDisabled ? 0.45 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                <Save size={13} />
                Save
              </button>
              {saveKitOpen ? (
                <div
                  ref={saveKitPanelRef}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    zIndex: 500,
                    width: 280,
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid rgba(167, 139, 250, 0.45)',
                    background: '#1e1e26',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
                    maxHeight: 'min(70vh, 420px)',
                    overflowY: 'auto',
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#7cf4c6', marginBottom: 6, letterSpacing: 0.4 }}>
                    SAVE SONG / SEQUENCE + KIT
                  </div>
                  <div style={{ fontSize: 9, color: '#8a8a98', marginBottom: 8, lineHeight: 1.35 }}>
                    Pattern A and B, BPM, loop, and full kit (samples + FX) on this bank.
                  </div>
                  <input
                    type="text"
                    value={saveSongNameDraft}
                    onChange={(e) => setSaveSongNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && onSaveSong) {
                        e.preventDefault();
                        onSaveSong(saveSongNameDraft);
                        setSaveKitOpen(false);
                      }
                    }}
                    placeholder="Song name?"
                    maxLength={56}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '6px 8px',
                      marginBottom: 6,
                      borderRadius: 4,
                      border: '1px solid rgba(124, 244, 198, 0.35)',
                      background: '#1a1a24',
                      color: '#e8e8f0',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  />
                  {typeof onSaveSong === 'function' ? (
                    <button
                      type="button"
                      onClick={() => {
                        onSaveSong(saveSongNameDraft);
                        setSaveKitOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        marginBottom: 10,
                        borderRadius: 4,
                        border: '1px solid rgba(124, 244, 198, 0.5)',
                        background: 'rgba(124, 244, 198, 0.14)',
                        color: '#7cf4c6',
                        fontSize: 10,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Save song + kit
                    </button>
                  ) : null}
                  {saveSongStatus ? (
                    <div style={{ marginBottom: 8, fontSize: 9, fontWeight: 700, color: '#7cf4c6' }}>{saveSongStatus}</div>
                  ) : null}
                  {savedSongs.length > 0 ? (
                    <div style={{ marginBottom: 10, borderBottom: '1px solid #2a2a32', paddingBottom: 8 }}>
                      <div style={{ fontSize: 8, fontWeight: 800, color: '#6a6a78', marginBottom: 6 }}>MY SAVED SONGS</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
                        {savedSongs.map((ss) => (
                          <div key={ss.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                            {renameSongId === ss.id ? (
                              <input
                                type="text"
                                value={renameSongDraft}
                                onChange={(e) => setRenameSongDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    onRenameSavedSong?.(ss.id, renameSongDraft);
                                    setRenameSongId(null);
                                  }
                                  if (e.key === 'Escape') setRenameSongId(null);
                                }}
                                onBlur={() => {
                                  if (renameSongDraft.trim()) onRenameSavedSong?.(ss.id, renameSongDraft);
                                  setRenameSongId(null);
                                }}
                                autoFocus
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  padding: '3px 6px',
                                  borderRadius: 3,
                                  border: '1px solid #2a2a32',
                                  background: '#1a1a24',
                                  color: '#e8e8f0',
                                  fontSize: 10,
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => onLoadSavedSong?.(ss.id)}
                                title="Load sequence + kit on current bank"
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  textAlign: 'left',
                                  padding: '4px 6px',
                                  borderRadius: 3,
                                  border: '1px solid transparent',
                                  background: 'transparent',
                                  color: '#e8e8f0',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                ? {ss.name}
                              </button>
                            )}
                            {renameSongId !== ss.id ? (
                              <>
                                <button
                                  type="button"
                                  title="Rename"
                                  onClick={() => {
                                    setRenameSongId(ss.id);
                                    setRenameSongDraft(ss.name);
                                  }}
                                  style={{
                                    padding: '2px 5px',
                                    borderRadius: 3,
                                    border: '1px solid #2a2a32',
                                    background: '#1a1a24',
                                    color: '#9ca3af',
                                    fontSize: 8,
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  title="Delete saved song"
                                  onClick={() => onDeleteSavedSong?.(ss.id)}
                                  style={{
                                    padding: '2px 5px',
                                    borderRadius: 3,
                                    border: '1px solid #633',
                                    background: '#1a1014',
                                    color: '#f6a9a9',
                                    fontSize: 8,
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Del
                                </button>
                              </>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#a78bfa', marginBottom: 6, letterSpacing: 0.4 }}>
                    KIT ONLY (CURRENT BANK)
                  </div>
                  <div style={{ fontSize: 9, color: '#8a8a98', marginBottom: 8, lineHeight: 1.35 }}>
                    Pads only ? no sequence.
                  </div>
                  <input
                    type="text"
                    value={saveKitNameDraft}
                    onChange={(e) => setSaveKitNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onSaveKit(saveKitNameDraft);
                        setSaveKitOpen(false);
                      }
                    }}
                    placeholder="Kit name?"
                    maxLength={48}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '6px 8px',
                      marginBottom: 8,
                      borderRadius: 4,
                      border: '1px solid #2a2a32',
                      background: '#1a1a24',
                      color: '#e8e8f0',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onSaveKit(saveKitNameDraft);
                      setSaveKitOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: 4,
                      border: '1px solid rgba(167, 139, 250, 0.5)',
                      background: 'rgba(167, 139, 250, 0.18)',
                      color: '#e9d5ff',
                      fontSize: 10,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Save to My kits
                  </button>
                  {saveKitStatus ? (
                    <div style={{ marginTop: 8, fontSize: 9, fontWeight: 700, color: '#7cf4c6' }}>{saveKitStatus}</div>
                  ) : null}
                  {savedKits.length > 0 ? (
                    <div style={{ marginTop: 10, borderTop: '1px solid #2a2a32', paddingTop: 8 }}>
                      <div style={{ fontSize: 8, fontWeight: 800, color: '#6a6a78', marginBottom: 6 }}>MY SAVED KITS</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
                        {savedKits.map((sk) => (
                          <div key={sk.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                            {renameKitId === sk.id ? (
                              <input
                                type="text"
                                value={renameKitDraft}
                                onChange={(e) => setRenameKitDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    onRenameSavedKit?.(sk.id, renameKitDraft);
                                    setRenameKitId(null);
                                  }
                                  if (e.key === 'Escape') setRenameKitId(null);
                                }}
                                onBlur={() => {
                                  if (renameKitDraft.trim()) onRenameSavedKit?.(sk.id, renameKitDraft);
                                  setRenameKitId(null);
                                }}
                                autoFocus
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  padding: '3px 6px',
                                  borderRadius: 3,
                                  border: '1px solid #2a2a32',
                                  background: '#1a1a24',
                                  color: '#e8e8f0',
                                  fontSize: 10,
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => onKitSelectChange?.(`saved:${sk.id}`)}
                                title="Load this kit on the current bank"
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  textAlign: 'left',
                                  padding: '4px 6px',
                                  borderRadius: 3,
                                  border: '1px solid transparent',
                                  background:
                                    kitDropdownValue === `saved:${sk.id}`
                                      ? 'rgba(124,244,198,0.1)'
                                      : 'transparent',
                                  color: '#e8e8f0',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                ? {sk.name}
                              </button>
                            )}
                            {renameKitId !== sk.id ? (
                              <>
                                <button
                                  type="button"
                                  title="Rename"
                                  onClick={() => {
                                    setRenameKitId(sk.id);
                                    setRenameKitDraft(sk.name);
                                  }}
                                  style={{
                                    padding: '2px 5px',
                                    borderRadius: 3,
                                    border: '1px solid #2a2a32',
                                    background: '#1a1a24',
                                    color: '#9ca3af',
                                    fontSize: 8,
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  title="Delete saved kit"
                                  onClick={() => onDeleteSavedKit?.(sk.id)}
                                  style={{
                                    padding: '2px 5px',
                                    borderRadius: 3,
                                    border: '1px solid #633',
                                    background: '#1a1014',
                                    color: '#f6a9a9',
                                    fontSize: 8,
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Del
                                </button>
                              </>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          </div>
        </div>

        {!hideSamplerPads ? (
        <div
          style={{
            borderTop: '1px solid rgba(124, 244, 198, 0.1)',
            paddingTop: 4,
            overflow: 'visible',
            position: 'relative',
            zIndex: 1,
            background: 'linear-gradient(180deg, #030304 0%, #010102 100%)',
          }}
        >
        {/* Fixed 8×2 MPC layout — dark lunar rock canvas + convex pads */}
        <div
          className="cs-beat-lab-studio-deck"
          style={{
            padding: '10px 9px 7px',
            borderRadius: 10,
            background: beatLabStudioWoodGrainBg(),
            border: beatLabStudioWoodDeckBorder(),
            boxShadow: beatLabStudioWoodDeckShadow(),
            position: 'relative',
            overflow: 'hidden',
          }}
        >
        <div
          className="cs-beat-lab-studio-deck-title"
          title={
            'Sampler pad 1?16 is the same pad as Beat Lab lane 1?16: a sound loaded here is that lane?s sample. 8?2 MPC layout. FX/SRC BPM per pad; Apply FX before switching bank.'
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: 9,
            color: '#5c616a',
            fontWeight: 900,
            letterSpacing: 1.35,
            textTransform: 'uppercase',
            width: '100%',
            flexShrink: 0,
            marginBottom: 7,
            textShadow: '0 0 8px rgba(70,75,85,0.14), 0 1px 0 rgba(0,0,0,0.96)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <span>SAMPLER ? 16 PADS</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 1,
              minWidth: 0,
              flexWrap: 'nowrap',
              justifyContent: 'flex-end',
            }}
          >
            <button
              type="button"
              id="beat-pads-deck-tab"
              onClick={() => {
                void onWarmAudio?.();
                setBeatPadsMachineOpen((v) => {
                  const next = !v;
                  if (next && beatLabMixerOpen) onBeatLabMixerToggle?.();
                  return next;
                });
              }}
              title="Open 16-pad drum machine overlay — same lanes as sampler"
              style={{
                height: 30,
                minWidth: 92,
                padding: '0 16px',
                borderRadius: 5,
                border: `1px solid ${beatPadsMachineOpen ? 'rgba(255, 200, 80, 0.9)' : 'rgba(255, 200, 80, 0.58)'}`,
                background: beatPadsMachineOpen
                  ? 'linear-gradient(180deg, rgba(255, 210, 90, 0.28) 0%, rgba(255, 180, 50, 0.14) 100%)'
                  : 'linear-gradient(180deg, rgba(255, 200, 80, 0.18) 0%, rgba(255, 170, 40, 0.08) 100%)',
                color: '#ffd966',
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 0.85,
                cursor: 'pointer',
                textTransform: 'uppercase',
                boxShadow: beatPadsMachineOpen
                  ? '0 0 14px rgba(255, 200, 80, 0.45), inset 0 1px 0 rgba(255, 230, 160, 0.22)'
                  : '0 0 10px rgba(255, 200, 80, 0.28), inset 0 1px 0 rgba(255, 220, 140, 0.12)',
                textShadow: '0 0 8px rgba(255, 200, 80, 0.35)',
                flexShrink: 0,
              }}
            >
              Beat Pads
            </button>
            <button
              type="button"
              onClick={() => {
                if (!beatLabMixerOpen) setBeatPadsMachineOpen(false);
                onBeatLabMixerToggle?.({ padsOnly: false });
              }}
              title="Open 32-channel Beat Lab mixer overlay"
              style={{
                height: 22,
                padding: '0 8px',
                borderRadius: 4,
                border: `1px solid ${beatLabMixerOpen ? 'rgba(0, 229, 255, 0.55)' : 'rgba(72, 78, 92, 0.45)'}`,
                background: beatLabMixerOpen ? 'rgba(0, 229, 255, 0.14)' : 'rgba(8, 8, 12, 0.65)',
                color: beatLabMixerOpen ? '#00E5FF' : '#8a9098',
                fontSize: 8,
                fontWeight: 900,
                letterSpacing: 0.6,
                cursor: 'pointer',
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                flexShrink: 0,
              }}
            >
              <SlidersHorizontal size={10} aria-hidden />
              Mixer
            </button>
            <BeatLabHelpTip tab="sampler" title="How to use the 16 sampler pads" />
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '0 4px 0 0',
                textAlign: 'left',
                flexShrink: 1,
                minWidth: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              <svg
                width="40"
                height="22"
                viewBox="0 0 40 22"
                aria-hidden
                style={{ flexShrink: 0, overflow: 'visible' }}
              >
                <path
                  d="M38 11 H10"
                  stroke="rgba(255, 200, 80, 0.55)"
                  strokeWidth="1.25"
                  strokeDasharray="3 2"
                  fill="none"
                />
                <path
                  d="M10 11 L16 7 M10 11 L16 15"
                  stroke="#ffd966"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <circle cx="38" cy="11" r="2.25" fill="rgba(255, 200, 80, 0.35)" />
              </svg>
              <span
                style={{
                  display: 'inline-flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'nowrap',
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontFamily: '"Rajdhani", "Exo 2", system-ui, sans-serif',
                    fontSize: 11,
                    fontWeight: 700,
                    lineHeight: 1.15,
                    color: '#ffd966',
                    letterSpacing: 0.35,
                    textShadow: '0 0 10px rgba(255, 200, 80, 0.22)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Beat Pads — the ultimate drum machine.
                </span>
                <span
                  aria-hidden
                  style={{
                    width: 1,
                    height: 14,
                    background: 'rgba(255, 200, 80, 0.28)',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: '"Rajdhani", "Exo 2", system-ui, sans-serif',
                    fontSize: 8,
                    fontWeight: 600,
                    lineHeight: 1.15,
                    color: '#9a9488',
                    letterSpacing: 0.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minWidth: 0,
                  }}
                >
                  Same pads as Beat Lab · step sequencer & pattern bank — create your best beats here.
                </span>
              </span>
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
            gridTemplateRows: `repeat(2, minmax(${BEAT_LAB_PAD_CELL_MIN_H}px, auto))`,
            gap: 5,
            width: '100%',
            overflow: 'visible',
            position: 'relative',
            zIndex: 1,
            background: '#040405',
            borderRadius: 6,
            padding: 4,
            boxSizing: 'border-box',
          }}
        >
          {Array.from({ length: 16 }, (_, padIndex) => {
            const has = hasPadSample(padIndex);
            const hasBuffer = Boolean(getPadSampleAudioBuffer?.(padIndex));
            const hasLabel = Boolean(padSampleLabelForPad?.(padIndex)?.trim());
            const loaded = has || hasBuffer || hasLabel;
            const root = padSampleRootBpmForPad?.(padIndex);
            const uploadHere = padIndex === geniusSamplerTargetPad;
            const padSelected = selectedDrumPad === padIndex;
            const displayLabel = beatLabLaneDisplayLabel(padIndex, loaded ? padSampleLabelForPad?.(padIndex) : undefined);
            return (
              <div
                key={padIndex}
                className="cs-pad-hit cs-beat-lab-studio-pad"
                role="button"
                tabIndex={0}
                onMouseDown={() => onSelectDrumPad?.(padIndex)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectDrumPad?.(padIndex);
                  }
                }}
                title={`Sampler pad ${padIndex + 1} = Beat Lab lane ${padIndex + 1} ? ${displayLabel}${loaded ? ' ? sample loaded' : ''}${uploadHere ? ' ? UPLOAD ? this pad' : ''}${padSelected ? ' ? selected channel' : ''}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0,
                  minHeight: BEAT_LAB_PAD_CELL_MIN_H,
                  padding: 2,
                  borderRadius: 8,
                  border: beatLabStudioPadRingBorder(uploadHere),
                  background: beatLabStudioPadRingBg(),
                  boxShadow: beatLabStudioPadRingShadow(padSelected, padIndex),
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: onSelectDrumPad ? 'pointer' : undefined,
                }}
              >
                <div
                  className="cs-beat-lab-studio-pad-face"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: 4,
                    flex: 1,
                    minHeight: 0,
                    padding: '3px 4px 4px',
                    borderRadius: 5,
                    border: beatLabStudioPadFaceBorderCss(padIndex, padSelected),
                    background: beatLabStudioPadFaceBg(padIndex, { hasSample: loaded, selected: padSelected }),
                    boxShadow: beatLabStudioPadFaceShadow(padIndex, { hasSample: loaded, selected: padSelected }),
                    position: 'relative',
                    zIndex: 2,
                    overflow: 'hidden',
                    ...beatLabPadFaceAccentVar(padIndex),
                  }}
                >
                {loaded ? (
                  <button
                    type="button"
                    className="cs-pad-clear-btn"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearPadSample(padIndex);
                    }}
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      width: 14,
                      height: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 3,
                      border: '1px solid rgba(248, 113, 113, 0.65)',
                      background: 'rgba(18, 4, 4, 0.92)',
                      color: '#fecaca',
                      cursor: 'pointer',
                      padding: 0,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.45)',
                    }}
                    title="Clear sample from this pad"
                  >
                    <X size={9} strokeWidth={2.5} />
                  </button>
                ) : null}
                <div
                  className="cs-pad-face-name-strip"
                  style={{
                    width: '100%',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 4px',
                    paddingRight: loaded ? 16 : 4,
                    borderRadius: 4,
                    background: BEAT_LAB_PAD_NAME_STRIP_BG,
                    border: '1px solid rgba(72, 78, 92, 0.28)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025), inset 0 -2px 4px rgba(0,0,0,0.45)',
                    boxSizing: 'border-box',
                    minWidth: 0,
                  }}
                >
                  <span
                    className="cs-pad-face-num"
                    aria-hidden
                    style={{
                      flexShrink: 0,
                      minWidth: 14,
                      fontSize: 10,
                      fontWeight: 900,
                      color: BEAT_LAB_PAD_LABEL_WHITE,
                      textAlign: 'left',
                      lineHeight: 1,
                      textShadow: '0 1px 2px rgba(0,0,0,0.75)',
                    }}
                  >
                    {padIndex + 1}
                  </span>
                  <span
                    className="cs-pad-face-name"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 9,
                      fontWeight: 800,
                      lineHeight: 1.2,
                      textAlign: 'left',
                      color: BEAT_LAB_PAD_LABEL_WHITE,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      wordBreak: 'break-word',
                      letterSpacing: 0.04,
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                      WebkitFontSmoothing: 'antialiased',
                    }}
                  >
                    {displayLabel}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 0, flexShrink: 0 }}>
                  {getPadSamplerOpts && commitPadSamplerOpts ? (
                    <div
                      data-fx-root={padIndex}
                      style={{ display: 'flex', flex: 1, minWidth: 0, gap: 3, lineHeight: 0 }}
                    >
                      <button
                        type="button"
                        ref={(el) => {
                          fxTriggerRefs.current[padIndex] = el;
                        }}
                        disabled={!loaded}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!loaded) return;
                          toggleFxMenu(padIndex);
                        }}
                        title={
                          loaded
                            ? 'Sample edit: filters, trim, pitch, trigger (saved with this pad)'
                            : 'Load a sample on this pad first ? then you can open sample edit'
                        }
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: 24,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 1,
                          borderRadius: 4,
                          border: `1px solid ${
                            !loaded ? '#2a2a32' : fxOpenPad === padIndex ? 'rgba(255, 255, 255, 0.38)' : '#3a4254'
                          }`,
                          background: !loaded
                            ? '#0a0a0e'
                            : fxOpenPad === padIndex
                              ? 'rgba(255, 255, 255, 0.1)'
                              : beatLabPadMicroChipBg(false),
                          color: !loaded ? '#4b5563' : fxOpenPad === padIndex ? '#f8fafc' : '#c8e4ff',
                          cursor: !loaded ? 'not-allowed' : 'pointer',
                          padding: '1px 2px 0',
                          opacity: loaded ? 1 : 0.75,
                          boxShadow: loaded ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 3px rgba(0,0,0,0.45)' : undefined,
                          filter: loaded ? 'drop-shadow(0 0 0.5px rgba(0,0,0,0.6))' : undefined,
                        }}
                      >
                        <SlidersHorizontal size={10} strokeWidth={2.2} />
                        <span
                          className="cs-pad-micro-label"
                          style={{
                            fontSize: 8,
                            fontWeight: 900,
                            letterSpacing: 0.4,
                            lineHeight: 1,
                            color: 'inherit',
                            textShadow: beatLabPadReadableTextShadow(),
                          }}
                        >
                          EDIT
                        </span>
                      </button>
                      {getPadSamplerFxRack && commitPadSamplerFxRack ? (
                        <div data-efx-root={padIndex} style={{ display: 'flex', flex: 1, minWidth: 0, lineHeight: 0 }}>
                        <button
                          type="button"
                          ref={(el) => {
                            efxTriggerRefs.current[padIndex] = el;
                          }}
                          disabled={!loaded}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!loaded) return;
                            toggleEfxMenu(padIndex);
                          }}
                          title={
                            loaded
                              ? 'EFX rack: EQ, compressor, drive, delay, reverb (per pad)'
                              : 'Load a sample first ? then open the EFX rack'
                          }
                          style={{
                            flex: 1,
                            minWidth: 0,
                            height: 24,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 1,
                            borderRadius: 4,
                            border: `1px solid ${
                              !loaded ? '#2a2a32' : efxOpenPad === padIndex ? 'rgba(124, 244, 198, 0.55)' : '#3a4254'
                            }`,
                            background: !loaded
                              ? '#0a0a0e'
                              : efxOpenPad === padIndex
                                ? 'rgba(124, 244, 198, 0.14)'
                                : beatLabPadMicroChipBg(false),
                            color: !loaded ? '#4b5563' : efxOpenPad === padIndex ? '#d4fff0' : '#ddd6fe',
                            cursor: !loaded ? 'not-allowed' : 'pointer',
                            padding: '1px 2px 0',
                            opacity: loaded ? 1 : 0.75,
                            boxShadow: loaded ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 3px rgba(0,0,0,0.45)' : undefined,
                            filter: loaded ? 'drop-shadow(0 0 0.5px rgba(0,0,0,0.6))' : undefined,
                          }}
                        >
                          <Waves size={10} strokeWidth={2.4} />
                          <span
                            className="cs-pad-micro-label"
                            style={{
                              fontSize: 8,
                              fontWeight: 900,
                              letterSpacing: 0.4,
                              lineHeight: 1,
                              color: 'inherit',
                              textShadow: beatLabPadReadableTextShadow(),
                            }}
                          >
                            EFX
                          </span>
                      </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, marginLeft: 'auto' }}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onGeniusMySoundPlay?.(padIndex);
                      }}
                      style={{ border: 'none', background: 'transparent', color: '#c8e4ff', cursor: 'pointer', padding: 2, flexShrink: 0, lineHeight: 0, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.75))' }}
                      title="Play"
                    >
                      <Play size={15} fill="currentColor" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onStopPadSamplePlayback?.(padIndex)}
                      style={{ border: 'none', background: 'transparent', color: '#d1d5db', cursor: 'pointer', padding: 2, flexShrink: 0, lineHeight: 0, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.75))' }}
                      title="Stop ? cut all playing sample voices on this pad (long loops / stacked hits)"
                    >
                      <Square size={12} fill="currentColor" strokeWidth={0} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onLoadPadSample(padIndex)}
                      style={{ border: 'none', background: 'transparent', color: '#c8e4ff', cursor: 'pointer', padding: 2, flexShrink: 0, lineHeight: 0, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.75))' }}
                      title="Load sample"
                    >
                      <Plus size={15} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    width: '100%',
                    minWidth: 0,
                  }}
                >
                  <div data-src-bpm-root={padIndex} style={{ minWidth: 0, position: 'relative', width: '100%' }}>
                    <button
                      type="button"
                      ref={(el) => {
                        srcBpmTriggerRefs.current[padIndex] = el;
                      }}
                      onClick={() => toggleSrcBpmMenu(padIndex)}
                      title="Source BPM (optional) ? click to set. Session BPM scales sample speed+pitch."
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 4,
                        padding: '3px 6px',
                        borderRadius: 4,
                        border: `1px solid ${
                          srcBpmOpenPad === padIndex ? 'rgba(124, 244, 198, 0.55)' : '#3a4254'
                        }`,
                        background:
                          srcBpmOpenPad === padIndex
                            ? beatLabPadMicroChipBg(true)
                            : beatLabPadMicroChipBg(false),
                        color: '#d4dae8',
                        cursor: 'pointer',
                        fontSize: 6,
                        fontWeight: 800,
                        letterSpacing: 0.5,
                        textAlign: 'left',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 1px 3px rgba(0,0,0,0.4)',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                        <span
                          className="cs-pad-micro-label"
                          style={{
                            color: '#e2e8f8',
                            letterSpacing: 0.65,
                            textShadow: beatLabPadReadableTextShadow(),
                            WebkitFontSmoothing: 'antialiased',
                          }}
                        >
                          SRC BPM
                        </span>
                        {root != null && root > 0 ? (
                          <span
                            style={{
                              color: '#c8e8ff',
                              fontFamily: 'monospace',
                              fontSize: 9,
                              fontWeight: 700,
                              textShadow: beatLabPadReadableTextShadow(),
                            }}
                          >
                            {root}
                          </span>
                        ) : (
                          <span
                            style={{
                              color: '#94a0b8',
                              fontSize: 7,
                              fontWeight: 700,
                              textShadow: beatLabPadReadableTextShadow(),
                            }}
                          >
                            ?
                          </span>
                        )}
                      </span>
                      <ChevronDown
                        size={11}
                        style={{
                          flexShrink: 0,
                          color: srcBpmOpenPad === padIndex ? '#7cf4c6' : '#6a6a78',
                          transform: srcBpmOpenPad === padIndex ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.12s',
                        }}
                      />
                    </button>
                  </div>
                </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>
        ) : null}
        {beatLabDeckFocus !== 'sequence' &&
        selectedMelodicLane != null &&
        selectedMelodicLane >= BEAT_LAB_MELODIC_LANE_START &&
        getAudioContext &&
        onMelodicInstrumentChange ? (
          <BeatLabMelodicChannelPanel
            lane={selectedMelodicLane}
            instrumentId={
              melodicInstruments[beatLabMelodicSlotIndex(selectedMelodicLane)] ??
              BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[beatLabMelodicSlotIndex(selectedMelodicLane)]!
            }
            melodicInstruments={melodicInstruments}
            synthPresetId={
              melodicSynthPresetIds[beatLabMelodicSlotIndex(selectedMelodicLane)] ??
              BEAT_LAB_DEFAULT_SYNTH_PRESET_ID
            }
            channelVolumes={channelVolumes}
            disabled={creationBackendBlank}
            getAudioContext={getAudioContext}
            onInstrumentChange={onMelodicInstrumentChange}
            onSynthPresetChange={(slotIndex, presetId) => {
              onMelodicSynthPresetChange?.(slotIndex, presetId);
            }}
          />
        ) : null}
    </div>
    {typeof document !== 'undefined' &&
      srcBpmOpenPad !== null &&
      srcBpmPopRect &&
      createPortal(
        <div
          data-beatlab-portal-popover=""
          ref={srcBpmPopoverMeasureRef}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: srcBpmPopRect.left,
            top: srcBpmPopRect.top,
            width: srcBpmPopRect.width,
            zIndex: 50000,
            padding: 8,
            borderRadius: 6,
            border: '1px solid rgba(124, 244, 198, 0.35)',
            background: 'linear-gradient(165deg, rgba(11, 11, 16, 0.75) 0%, rgba(8, 8, 12, 0.96) 100%)',
            boxShadow: '0 10px 28px rgba(0,0,0,0.65)',
            boxSizing: 'border-box',
            maxHeight: 'min(280px, calc(100vh - 16px))',
            overflow: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 6,
            }}
          >
            <div style={{ fontSize: 8, color: '#777', fontWeight: 700 }}>Source tempo (40?320)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <button
                type="button"
                title="Preview ? hear sample at this tempo (not saved until you leave the field or press Enter)"
                onClick={() => {
                  if (srcBpmOpenPad === null) return;
                  onPreviewSamplerRootBpmDraft?.(srcBpmOpenPad, srcBpmDraft);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 26,
                  borderRadius: 4,
                  border: '1px solid rgba(124, 244, 198, 0.35)',
                  background: 'rgba(11, 11, 16, 0.75)',
                  color: '#9dc6ff',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <Play size={13} fill="currentColor" />
              </button>
              <button
                type="button"
                title="Stop sample on this pad"
                onClick={() => {
                  if (srcBpmOpenPad === null) return;
                  onStopPadSamplePlayback?.(srcBpmOpenPad);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 26,
                  borderRadius: 4,
                  border: '1px solid #444',
                  background: '#141418',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <Square size={11} fill="currentColor" strokeWidth={0} />
              </button>
            </div>
          </div>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="40?320 or clear"
            value={srcBpmDraft}
            onChange={(e) => setSrcBpmDraft(e.target.value)}
            onBlur={(e) => {
              if (srcBpmOpenPad === null) return;
              const rel = e.relatedTarget as HTMLElement | null;
              if (rel?.closest?.('[data-beatlab-portal-popover]')) return;
              onCommitPadSampleRootBpmRef.current?.(srcBpmOpenPad, srcBpmDraftRef.current);
              setSrcBpmOpenPad(null);
            }}
            onKeyDown={(e) => {
              if (srcBpmOpenPad === null) return;
              if (e.key === 'Enter') {
                onCommitPadSampleRootBpmRef.current?.(srcBpmOpenPad, srcBpmDraft);
                setSrcBpmOpenPad(null);
              } else if (e.key === 'Escape') {
                const r = padSampleRootBpmForPad?.(srcBpmOpenPad);
                setSrcBpmDraft(r != null && r > 0 ? String(r) : '');
                setSrcBpmOpenPad(null);
              }
            }}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 4,
              border: '1px solid #444',
              background: '#0a0a0e',
              color: '#e8eef5',
              fontSize: 13,
              fontFamily: 'monospace',
              fontWeight: 700,
              boxSizing: 'border-box',
            }}
          />
        </div>,
        document.body,
      )}
    {(fxOpenPad !== null || efxOpenPad !== null) ? <PadSamplerFxTCapStyles /> : null}
    {typeof document !== 'undefined' &&
      fxOpenPad !== null &&
      fxPopRect &&
      commitPadSamplerOpts &&
      getPadSamplerOpts &&
      createPortal(
        <div
          data-beatlab-portal-popover=""
          className="beat-lab-pad-pop beat-lab-pad-pop-edit"
          ref={fxPopoverMeasureRef}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: fxPopRect.left,
            top: fxPopRect.top,
            width: fxPopRect.width,
            zIndex: 50000,
            boxSizing: 'border-box',
            padding: 12,
            borderRadius: 6,
            border: '1px solid rgba(124, 244, 198, 0.35)',
            background: 'linear-gradient(165deg, rgba(11, 11, 16, 0.92) 0%, rgba(8, 8, 12, 0.98) 100%)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.75)',
            overflow: 'hidden',
            maxHeight: 'min(420px, calc(100vh - 16px))',
          }}
        >
          <div
            style={{
              maxHeight: 'min(62vh, 380px)',
              overflowY: 'auto',
              overflowX: 'hidden',
              margin: '-2px',
              padding: '2px 6px 2px 2px',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ ...PAD_POP_TITLE, color: '#9ec7d4' }}>SAMPLE EDIT</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <button
                  type="button"
                  title="Preview ? hear current slider settings (saved with Apply or when you close this panel)"
                  onClick={() => {
                    if (fxOpenPad === null) return;
                    onPreviewSamplerFx?.(fxOpenPad, { ...fxDraft });
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 26,
                    borderRadius: 4,
                    border: '1px solid rgba(124, 244, 198, 0.45)',
                    background: 'rgba(124, 244, 198, 0.12)',
                    color: '#7cf4c6',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <Play size={13} fill="currentColor" />
                </button>
                <button
                  type="button"
                  title="Stop sample on this pad"
                  onClick={() => {
                    if (fxOpenPad === null) return;
                    onStopPadSamplePlayback?.(fxOpenPad);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 26,
                    borderRadius: 4,
                    border: '1px solid #444',
                    background: '#141418',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <Square size={11} fill="currentColor" strokeWidth={0} />
                </button>
              </div>
            </div>
            {onCommitPadSampleLabel ? (
              <>
                <label
                  htmlFor={`creation-fx-label-${fxOpenPad}`}
                  style={PAD_POP_LABEL}
                >
                  Pad / lane name
                </label>
                <input
                  id={`creation-fx-label-${fxOpenPad}`}
                  type="text"
                  autoComplete="off"
                  value={fxLabelDraft}
                  onChange={(e) => setFxLabelDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && fxOpenPad !== null) {
                      onCommitPadSampleLabel?.(fxOpenPad, fxLabelDraft.trim());
                    }
                  }}
                  placeholder="Shown on pad + sequencer lane"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    marginBottom: 10,
                    padding: '7px 9px',
                    borderRadius: 4,
                    border: '1px solid #444',
                    background: '#0a0a0e',
                    color: '#f1f5f9',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                />
              </>
            ) : null}
            <label style={PAD_POP_LABEL}>High-pass (0 = off)</label>
            <PadFxHorizontalTCapSlider
              min={0}
              max={8000}
              step={10}
              value={fxDraft.hpHz < 25 ? 0 : fxDraft.hpHz}
              accent="#7cf4c6"
              ariaLabel="High-pass filter"
              onChange={(v) => setFxDraft((d) => ({ ...d, hpHz: v < 25 ? 0 : v }))}
            />
            <div style={PAD_POP_VALUE}>
              {fxDraft.hpHz < 25 ? 'Off' : `${Math.round(fxDraft.hpHz)} Hz`}
            </div>
            <label style={PAD_POP_LABEL}>Low-pass (max = open)</label>
            <PadFxHorizontalTCapSlider
              min={200}
              max={20000}
              step={50}
              value={fxDraft.lpHz >= 200 && fxDraft.lpHz < 19900 ? fxDraft.lpHz : 20000}
              accent="#7cf4c6"
              ariaLabel="Low-pass filter"
              onChange={(v) => setFxDraft((d) => ({ ...d, lpHz: v >= 19900 ? 0 : v }))}
            />
            <div style={PAD_POP_VALUE}>
              {fxDraft.lpHz >= 200 && fxDraft.lpHz < 19900 ? `${Math.round(fxDraft.lpHz)} Hz` : 'Full bandwidth'}
            </div>
            <label
              style={PAD_POP_LABEL}
              title="MPC-style pad trigger: short gain spike on hit so one-shots bite harder (more hardware sampler punch)."
            >
              Sample trigger (MPC punch)
            </label>
            <PadFxHorizontalTCapSlider
              min={0}
              max={100}
              step={1}
              value={Math.round((fxDraft.triggerSnap ?? 0) * 100)}
              accent="#f472b6"
              ariaLabel="Sample trigger MPC punch"
              onChange={(v) =>
                setFxDraft((d) => ({ ...d, triggerSnap: Math.max(0, Math.min(1, v / 100)) }))
              }
            />
            <div style={PAD_POP_VALUE}>
              {Math.round((fxDraft.triggerSnap ?? 0) * 100)}% ? harder hit / less soft fade-in to level
            </div>
            <label
              style={PAD_POP_LABEL}
              title="Studio-style trim: waveform = full file; teal = plays back; dim = outside region. Yellow lines = start / end."
            >
              Trim ? wave + time (start / end)
            </label>
            <PadSampleTrimWaveform
              peaks={fxTrimWavePeaks}
              trim0={fxDraft.trim0}
              trim1={fxDraft.trim1}
              onTrimChange={(t0, t1) => setFxDraft((d) => ({ ...d, trim0: t0, trim1: t1 }))}
            />
            {(() => {
              const dur = fxOpenPad !== null ? getPadSampleAudioBuffer?.(fxOpenPad)?.duration ?? 0 : 0;
              const t0s = fxDraft.trim0 * dur;
              const t1s = fxDraft.trim1 * dur;
              const playLen = Math.max(0, t1s - t0s);
              return (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px 12px',
                    ...PAD_POP_VALUE,
                    marginBottom: 6,
                    marginTop: 4,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  }}
                >
                  <span>
                    Start <strong style={{ color: '#fcd34d' }}>{formatBeatLabSampleTime(t0s)}</strong>{' '}
                    <span style={{ color: '#6b7280' }}>({Math.round(fxDraft.trim0 * 100)}%)</span>
                  </span>
                  <span>
                    End <strong style={{ color: '#fcd34d' }}>{formatBeatLabSampleTime(t1s)}</strong>{' '}
                    <span style={{ color: '#6b7280' }}>({Math.round(fxDraft.trim1 * 100)}%)</span>
                  </span>
                  <span>
                    Play <strong style={{ color: '#a7f3d0' }}>{formatBeatLabSampleTime(playLen)}</strong>
                    {dur > 0 ? <span style={{ color: '#6b7280' }}>{` ? file ${dur.toFixed(3)} s`}</span> : null}
                  </span>
                </div>
              );
            })()}
            <div style={PAD_POP_HINT}>Start % (top) ? end % (bottom)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', boxSizing: 'border-box' }}>
              <PadFxHorizontalTCapSlider
                min={0}
                max={95}
                step={1}
                value={Math.round(fxDraft.trim0 * 100)}
                accent="#fbbf24"
                ariaLabel="Trim start"
                style={{ margin: '4px 0' }}
                onChange={(v) => {
                  const t0 = Math.min(0.95, v / 100);
                  setFxDraft((d) => {
                    let t1 = d.trim1;
                    if (t1 <= t0 + 0.02) t1 = Math.min(1, t0 + 0.08);
                    return { ...d, trim0: t0, trim1: t1 };
                  });
                }}
              />
              <PadFxHorizontalTCapSlider
                min={5}
                max={100}
                step={1}
                value={Math.round(fxDraft.trim1 * 100)}
                accent="#fbbf24"
                ariaLabel="Trim end"
                style={{ margin: '4px 0' }}
                onChange={(v) => {
                  const t1 = Math.max(0.05, Math.min(1, v / 100));
                  setFxDraft((d) => {
                    let t0 = d.trim0;
                    if (t1 <= t0 + 0.02) t0 = Math.max(0, t1 - 0.08);
                    return { ...d, trim0: t0, trim1: t1 };
                  });
                }}
              />
            </div>
            <label style={PAD_POP_LABEL}>
              Fine pitch (semitones, on top of SRC BPM rate)
            </label>
            <PadFxHorizontalTCapSlider
              min={-12}
              max={12}
              step={0.25}
              value={fxDraft.fineSemi}
              accent="#7cf4c6"
              ariaLabel="Fine pitch semitones"
              onChange={(v) => setFxDraft((d) => ({ ...d, fineSemi: v }))}
            />
            <div style={{ ...PAD_POP_VALUE, marginBottom: 10 }}>
              {fxDraft.fineSemi >= 0 ? '+' : ''}
              {fxDraft.fineSemi.toFixed(2)} st
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setFxDraft(defaultPadSamplerPlaybackOpts())}
                style={{
                  ...PAD_POP_ACTION,
                  border: '1px solid #444',
                  background: '#1a1a24',
                  color: '#c8d0e0',
                }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fxOpenPad === null) return;
                  onCommitPadSampleLabel?.(fxOpenPad, fxLabelDraft.trim());
                  commitPadSamplerOpts(fxOpenPad, fxDraft);
                  setFxOpenPad(null);
                }}
                style={{
                  ...PAD_POP_ACTION,
                  border: '1px solid rgba(124, 244, 198, 0.45)',
                  background: 'rgba(124, 244, 198, 0.14)',
                  color: '#7cf4c6',
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    {typeof document !== 'undefined' &&
      efxOpenPad !== null &&
      efxPopRect &&
      commitPadSamplerFxRack &&
      getPadSamplerFxRack &&
      createPortal(
        <div
          data-beatlab-portal-popover=""
          className="beat-lab-pad-pop beat-lab-pad-pop-efx"
          ref={efxPopoverMeasureRef}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: efxPopRect.left,
            top: efxPopRect.top,
            width: efxPopRect.width,
            zIndex: 50000,
            boxSizing: 'border-box',
            padding: 12,
            borderRadius: 6,
            border: '1px solid rgba(167, 139, 250, 0.4)',
            background: 'linear-gradient(165deg, rgba(14, 11, 22, 0.94) 0%, rgba(8, 8, 14, 0.98) 100%)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.75)',
            overflow: 'hidden',
            maxHeight: 'min(560px, calc(100vh - 16px))',
          }}
        >
          <div
            style={{
              maxHeight: 'min(68vh, 520px)',
              overflowY: 'auto',
              overflowX: 'hidden',
              margin: '-2px',
              padding: '2px 6px 2px 2px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ ...PAD_POP_TITLE, color: '#c4b5fd' }}>EFX RACK</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <button
                  type="button"
                  title="Preview ? hear current rack settings"
                  onClick={() => {
                    if (efxOpenPad === null) return;
                    onPreviewSamplerFxRack?.(efxOpenPad, { ...efxDraft });
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 26,
                    borderRadius: 4,
                    border: '1px solid rgba(167, 139, 250, 0.4)',
                    background: 'rgba(11, 11, 16, 0.75)',
                    color: '#c4b5fd',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <Play size={13} fill="currentColor" />
                </button>
                <button
                  type="button"
                  title="Stop sample on this pad"
                  onClick={() => {
                    if (efxOpenPad === null) return;
                    onStopPadSamplePlayback?.(efxOpenPad);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 26,
                    borderRadius: 4,
                    border: '1px solid #444',
                    background: '#141418',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <Square size={11} fill="currentColor" strokeWidth={0} />
                </button>
              </div>
            </div>
            <div style={{ ...PAD_POP_SECTION, marginBottom: 8 }}>DRIVE / SAT</div>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'flex-start',
                gap: 12,
                marginBottom: 10,
              }}
            >
              <PadFxVerticalFader
                label="DRIVE"
                min={0}
                max={100}
                step={1}
                value={Math.round(efxDraft.drive * 100)}
                onChange={(pct) =>
                  setEfxDraft((d) => ({ ...d, drive: Math.max(0, Math.min(1, pct / 100)) }))
                }
                format={(v) => `${Math.round(v)}%`}
                accent="#a78bfa"
              />
            </div>
            <PadSamplerEqCompControls
              eq={efxDraft.eq}
              onEqChange={(next) =>
                setEfxDraft((d) => ({
                  ...d,
                  eq: { ...d.eq, ...next },
                }))
              }
              comp={efxDraft.compressor}
              onCompChange={(next) =>
                setEfxDraft((d) => ({
                  ...d,
                  compressor: { ...d.compressor, ...next },
                }))
              }
            />
            <div style={{ ...PAD_POP_SECTION, marginBottom: 6 }}>DELAY</div>
            <button
              type="button"
              onClick={() => setEfxDraft((d) => ({ ...d, delay: { ...d.delay, enabled: !d.delay.enabled } }))}
              style={{
                ...PAD_POP_TOGGLE,
                marginBottom: 8,
                border: `1px solid ${efxDraft.delay.enabled ? 'rgba(167, 139, 250, 0.5)' : '#444'}`,
                background: efxDraft.delay.enabled ? 'rgba(167, 139, 250, 0.14)' : '#101014',
                color: efxDraft.delay.enabled ? '#e9d5ff' : '#b8bfd0',
              }}
            >
              {efxDraft.delay.enabled ? 'ON' : 'OFF'}
            </button>
            {efxDraft.delay.enabled ? (
              <>
                <div
                  style={{
                    ...PAD_POP_VALUE,
                    color: '#ddd6fe',
                    fontWeight: 700,
                    marginBottom: 8,
                    fontFamily: 'monospace',
                  }}
                >
                  {padSamplerDelayTimeLabel(sessionBpm, efxDraft.delay)}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEfxDraft((d) => ({
                      ...d,
                      delay: { ...d.delay, syncToBpm: !d.delay.syncToBpm },
                    }))
                  }
                  style={{
                    ...PAD_POP_TOGGLE,
                    marginBottom: 8,
                    border: `1px solid ${efxDraft.delay.syncToBpm ? 'rgba(167, 139, 250, 0.55)' : '#444'}`,
                    background: efxDraft.delay.syncToBpm ? 'rgba(167, 139, 250, 0.18)' : '#101014',
                    color: efxDraft.delay.syncToBpm ? '#e9d5ff' : '#b8bfd0',
                  }}
                  title="Lock delay time to project BPM"
                >
                  {efxDraft.delay.syncToBpm ? 'BPM SYNC ON' : 'BPM SYNC OFF'}
                </button>
                {efxDraft.delay.syncToBpm ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
                    {PAD_SAMPLER_DELAY_NOTE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setEfxDraft((d) => ({
                            ...d,
                            delay: { ...d.delay, note: opt.id },
                          }))
                        }
                        style={{
                          ...PAD_POP_TOGGLE,
                          padding: '4px 7px',
                          borderRadius: 3,
                          border: `1px solid ${
                            efxDraft.delay.note === opt.id ? 'rgba(167, 139, 250, 0.6)' : '#3a3a44'
                          }`,
                          background:
                            efxDraft.delay.note === opt.id ? 'rgba(167, 139, 250, 0.2)' : '#1e1e24',
                          color: efxDraft.delay.note === opt.id ? '#f3e8ff' : '#c8d0e0',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <label style={PAD_POP_LABEL}>Time (ms) ? free</label>
                    <PadFxHorizontalTCapSlider
                      min={20}
                      max={2000}
                      step={5}
                      value={efxDraft.delay.timeMs}
                      accent="#a78bfa"
                      ariaLabel="Delay time"
                      style={{ margin: '4px 0' }}
                      onChange={(v) =>
                        setEfxDraft((d) => ({
                          ...d,
                          delay: { ...d.delay, timeMs: v },
                        }))
                      }
                    />
                    <div style={{ ...PAD_POP_VALUE, fontFamily: 'monospace' }}>
                      {efxDraft.delay.timeMs} ms
                    </div>
                  </>
                )}
                <label style={PAD_POP_LABEL}>Repeats (feedback)</label>
                <PadFxHorizontalTCapSlider
                  min={0}
                  max={92}
                  step={1}
                  value={Math.round(efxDraft.delay.feedback * 100)}
                  accent="#a78bfa"
                  ariaLabel="Delay feedback"
                  style={{ margin: '4px 0' }}
                  onChange={(v) =>
                    setEfxDraft((d) => ({
                      ...d,
                      delay: { ...d.delay, feedback: v / 100 },
                    }))
                  }
                />
                <div style={PAD_POP_VALUE}>
                  {Math.round(efxDraft.delay.feedback * 100)}% ? higher = longer echo tail
                </div>
                <label style={PAD_POP_LABEL}>Wet mix</label>
                <PadFxHorizontalTCapSlider
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(efxDraft.delay.mix * 100)}
                  accent="#a78bfa"
                  ariaLabel="Delay wet mix"
                  style={{ margin: '4px 0 8px' }}
                  onChange={(v) =>
                    setEfxDraft((d) => ({
                      ...d,
                      delay: { ...d.delay, mix: v / 100 },
                    }))
                  }
                />
              </>
            ) : null}
            <div style={{ ...PAD_POP_SECTION, marginBottom: 6, marginTop: 6 }}>REVERB</div>
            <button
              type="button"
              onClick={() => setEfxDraft((d) => ({ ...d, reverb: { ...d.reverb, enabled: !d.reverb.enabled } }))}
              style={{
                ...PAD_POP_TOGGLE,
                marginBottom: 8,
                border: `1px solid ${efxDraft.reverb.enabled ? 'rgba(167, 139, 250, 0.5)' : '#444'}`,
                background: efxDraft.reverb.enabled ? 'rgba(167, 139, 250, 0.14)' : '#101014',
                color: efxDraft.reverb.enabled ? '#e9d5ff' : '#b8bfd0',
              }}
            >
              {efxDraft.reverb.enabled ? 'ON' : 'OFF'}
            </button>
            {efxDraft.reverb.enabled ? (
              <>
                <label style={PAD_POP_LABEL}>Mix</label>
                <PadFxHorizontalTCapSlider
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(efxDraft.reverb.mix * 100)}
                  accent="#a78bfa"
                  ariaLabel="Reverb mix"
                  style={{ margin: '4px 0 8px' }}
                  onChange={(v) =>
                    setEfxDraft((d) => ({
                      ...d,
                      reverb: { ...d.reverb, mix: v / 100 },
                    }))
                  }
                />
                <label style={PAD_POP_LABEL}>Decay (s)</label>
                <PadFxHorizontalTCapSlider
                  min={20}
                  max={300}
                  step={5}
                  value={Math.round(efxDraft.reverb.decaySec * 100)}
                  accent="#a78bfa"
                  ariaLabel="Reverb decay"
                  style={{ margin: '4px 0 8px' }}
                  onChange={(v) =>
                    setEfxDraft((d) => ({
                      ...d,
                      reverb: { ...d.reverb, decaySec: v / 100 },
                    }))
                  }
                />
              </>
            ) : null}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setEfxDraft(defaultPadSamplerFxRack())}
                style={{
                  ...PAD_POP_ACTION,
                  border: '1px solid #444',
                  background: '#1a1a24',
                  color: '#c8d0e0',
                }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  if (efxOpenPad === null) return;
                  commitPadSamplerFxRack(efxOpenPad, efxDraft);
                  setEfxOpenPad(null);
                }}
                style={{
                  ...PAD_POP_ACTION,
                  border: '1px solid rgba(167, 139, 250, 0.5)',
                  background: 'rgba(167, 139, 250, 0.14)',
                  color: '#ddd6fe',
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    <BeatLabDrumMachineOverlay
      open={beatPadsMachineOpen}
      onClose={() => setBeatPadsMachineOpen(false)}
      activeBank={samplerUiBank}
      selectedPad={selectedDrumPad ?? null}
      onSelectPad={onSelectDrumPad}
      onStrikePad={(padIndex, velocity01, gridCol, whenSec) => {
        if (onStrikeDrumPad) {
          onStrikeDrumPad(padIndex, velocity01, gridCol, whenSec);
        } else {
          onGeniusMySoundPlay?.(padIndex);
        }
      }}
      onApplyHumMelody={onApplyHumMelody}
      padLabelForPad={padSampleLabelForPad}
      hasPadSample={hasPadSample}
      onLoadPad={onLoadPadSample}
      getDrumPadVoice={getDrumPadVoice}
      commitDrumPadVoice={commitDrumPadVoice}
      onPreviewDrumPad={onPreviewDrumPad}
      onSpreadHitToPads={onSpreadHitToPads}
      onUndoSpreadHitToPads={onUndoSpreadHitToPads}
      beatPadsSpreadActive={beatPadsSpreadActive}
      beatPadsSpreadDirection={beatPadsSpreadDirection}
      beatPadsSpreadRootMidi={beatPadsSpreadRootMidi}
      beatPadsSpreadBaseLabel={beatPadsSpreadBaseLabel}
      beatPadsSpreadNotes={beatPadsSpreadNotes}
      beatPadsSpreadLoopBars={beatPadsSpreadLoopBars}
      beatPadsSpreadStepsPerBar={beatPadsSpreadStepsPerBar}
      onBeatPadsSpreadNotesChange={onBeatPadsSpreadNotesChange}
      onBeatPadsSpreadLoopBarsChange={onBeatPadsSpreadLoopBarsChange}
      onBeatPadsSpreadDirectionChange={onBeatPadsSpreadDirectionChange}
      onBeatPadsSpreadMixerChannelChange={onBeatPadsSpreadMixerChannelChange}
      onBeatPadsSpreadGridStepsPerBarChange={onBeatPadsSpreadGridStepsPerBarChange}
      beatPadsSpreadMixerChannel={beatPadsSpreadMixerChannel}
      beatPadsSpreadKeyLockEnabled={beatPadsSpreadKeyLockEnabled}
      beatPadsSpreadKeyLabel={beatPadsSpreadKeyLabel}
      beatPadsSpreadHarmonyLane={beatPadsSpreadHarmonyLane}
      beatPadsSpreadHarmonyLaneNotes={beatPadsSpreadHarmonyLaneNotes}
      onBeatPadsSpreadKeyLockChange={onBeatPadsSpreadKeyLockChange}
      onBeatPadsSpreadHarmonyLaneChange={onBeatPadsSpreadHarmonyLaneChange}
      onBeatPadsSpreadRegenerateChordRoots={onBeatPadsSpreadRegenerateChordRoots}
      onPreviewBeatPadsSpreadRow={onPreviewBeatPadsSpreadRow}
      onStrikeBeatPadsSpreadRow={onStrikeBeatPadsSpreadRow}
      onCloseBeatPadsSpread={onCloseBeatPadsSpread}
      beatLabMixerSpreadActive={beatPadsSpreadActive}
      onWarmAudio={onWarmAudio}
      kitSelectValue={kitSelectValue}
      onKitSelectChange={onKitSelectChange}
      presetKitNames={presetKitNames}
      savedKits={savedKits}
      setKit={setKit}
      producerKitId={producerKitId}
      onProducerKitIdChange={onProducerKitIdChange}
      onLoadProducerKit={onLoadProducerKit}
      producerKitLoading={producerKitLoading}
      producerKitTribute={producerKitTribute}
      onLoadDefaultKitToBank={onLoadDefaultKitToBank}
      loadingProducerKitId={loadingProducerKitId}
      patternActionsDisabled={patternActionsDisabled}
      onUploadPad={() => onGeniusUpload?.()}
      onOpenKitBrowser={() => onOpenTrapKitBrowser?.()}
      onLoadSoundFamilySample={onLoadSoundFamilySample}
      onPreviewSoundFamilySample={onPreviewSoundFamilySample}
      onImportFromBeatLab={onImportBeatPadsFromBeatLab}
      onExportToBeatLab={onExportBeatPadsToBeatLab}
      onExportToStudioEditor2={onExportBeatPadsToStudioEditor2}
      onSaveBeatPadsSession={onSaveBeatPadsSession}
      savedBeatPadsSessions={savedBeatPadsSessions}
      beatPadsSessionSaveStatus={beatPadsSessionSaveStatus}
      onLoadBeatPadsSession={onLoadBeatPadsSession}
      onRenameBeatPadsSession={onRenameBeatPadsSession}
      onDeleteBeatPadsSession={onDeleteBeatPadsSession}
      beatPadsSessionInject={beatPadsSessionInject}
      onBeatPadsSessionInjectConsumed={onBeatPadsSessionInjectConsumed}
      beatPadsSe2Inject={beatPadsSe2Inject}
      onBeatPadsSe2InjectConsumed={onBeatPadsSe2InjectConsumed}
      onSaveKit={onSaveKit}
      getPadSamplerOpts={getPadSamplerOpts}
      commitPadSamplerOpts={commitPadSamplerOpts}
      getPadSamplerFxRack={getPadSamplerFxRack}
      commitPadSamplerFxRack={commitPadSamplerFxRack}
      onLivePadFxRackDraft={onLivePadFxRackDraft}
      onLiveSamplerDraft={onLiveSamplerDraft}
      onLiveDrumPadVoiceDraft={onLiveDrumPadVoiceDraft}
      getPadSampleAudioBuffer={getPadSampleAudioBuffer}
      sessionBpm={sessionBpm}
      getAudioContext={getAudioContext}
      beatLabMixerOpen={beatLabMixerOpen}
      onBeatLabMixerToggle={() => onBeatLabMixerToggle?.({ padsOnly: true })}
      beatPadsPatternInject={beatPadsPatternInject}
      onBeatPadsPatternInjectConsumed={onBeatPadsPatternInjectConsumed}
      onPatternPresetHighlighted={onPatternPresetHighlighted}
      onLoadBeatPadsPatternKit={onLoadBeatPadsPatternKit}
      onLoadPatternPreset={onLoadPatternPreset}
      patternSlot={patternSlot}
      onPatternSlotChange={onPatternSlotChange}
      loadedPatternBankId={loadedPatternBankId}
      loadedPatternPresetId={loadedPatternPresetId}
      patternBankDisabled={patternBankDisabled}
    />
  </>
  );
}

/** Isolated rAF tick so elapsed `m:ss` updates smoothly without forcing the whole screen to re-render. */
function CreationGeniusElapsedDisplay({
  displayBeatRef,
  bpmRef,
  isPlaybackOrRecord,
}: {
  displayBeatRef: MutableRefObject<number>;
  bpmRef: MutableRefObject<number>;
  isPlaybackOrRecord: boolean;
}) {
  const [, setRafTick] = useState(0);
  useEffect(() => {
    if (!isPlaybackOrRecord) return;
    let raf = 0;
    const loop = () => {
      setRafTick((n) => (n + 1) & 0xffff);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isPlaybackOrRecord]);
  const beatNow = Math.max(0, displayBeatRef.current);
  const sec = beatNow * (60 / Math.max(1, bpmRef.current));
  const total = Math.floor(Math.min(5999, Math.max(0, sec)));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return <>{`${m}:${String(s).padStart(2, '0')}`}</>;
}


// ?? Main Screen ????????????????????????????????????????????????????????????????

const BEAT_LAB_STORAGE_KEYS = ['creationStation_banks', 'creationStation_patternSlots'] as const;

function clearBeatLabStorage(): void {
  for (const key of BEAT_LAB_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

class CreationStationErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            height: '100%',
            padding: 24,
            background: '#060607',
            color: '#e8e8f0',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 800, color: '#7cf4c6' }}>Beat Lab could not load</p>
          <p style={{ fontSize: 12, color: '#9a9aa8', maxWidth: 420, lineHeight: 1.5 }}>
            Saved pattern data may be corrupt. Reset Beat Lab storage and reload, or open another screen from the sidebar.
          </p>
          <button
            type="button"
            onClick={() => {
              clearBeatLabStorage();
              window.location.reload();
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid rgba(124,244,198,0.45)',
              background: 'rgba(124,244,198,0.12)',
              color: '#7cf4c6',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Reset Beat Lab data &amp; reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function CreationStationScreenBody({
  onExport,
  onBeatPadsToStudio,
  isScreenActive = true,
  creationSubScreen = 'beat-lab',
  onCreationSubScreenChange,
}: {
  onExport: (dest: string) => void;
  onBeatPadsToStudio?: (payload: PendingBeatPadsStudioImport) => void;
  isScreenActive?: boolean;
  creationSubScreen?: CreationSubScreenId;
  onCreationSubScreenChange?: (sub: CreationSubScreenId) => void;
}) {
  /** Transport: audio = `creationTransportSystem`; loops = `useBeatLabSe2TransportMirror` (SE2 rAF + 25 ms). */
  const CREATION_BACKEND_BLANK = false;
  const isScreenActiveRef = useRef(isScreenActive);
  isScreenActiveRef.current = isScreenActive;
  const creationSubScreenRef = useRef(creationSubScreen);
  creationSubScreenRef.current = creationSubScreen;

  const {
    triggerChannel,
    channelVolumes,
    setChannelVolume,
    getOrCreateAudioContext,
    getMetronomeBusGain,
    masterOutputLinear,
    setMasterOutputLinear,
    // Keep shared audio routing / synth only; Creation transport is local.
    stopMetronomeLoop,
    pause: pauseMasterTransport,
    transport: masterTransport,
  } = useMasterClock();
  const masterTransportRef = useRef(masterTransport);
  masterTransportRef.current = masterTransport;
  const { settings, updateSetting } = useSettings();

  useEffect(() => {
    setMasterOutputLinear(settings.masterVolume);
  }, [settings.masterVolume, setMasterOutputLinear]);

  const onMasterVolumeChange = useCallback(
    (v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      setMasterOutputLinear(clamped);
      updateSetting('masterVolume', clamped);
    },
    [setMasterOutputLinear, updateSetting],
  );
  const masterOutputLinearRef = useRef(masterOutputLinear);
  masterOutputLinearRef.current = masterOutputLinear;

  type LocalTransportState = 'stopped' | 'playing' | 'paused' | 'recording';
  const [transport, setTransport] = useState<LocalTransportState>('stopped');
  /** Audio lookahead + rAF gate — set only in start / pause / stop (do not mirror from React state here). */
  const runningRef = useRef(false);
  const recordingRef = useRef(false);
  /** Bumped on stop/pause — invalidates queued play refills and loop-wrap scheduling. */
  const beatLabPlayGenerationRef = useRef(0);
  /** Stop fires on pointerdown + click — skip duplicate heavy cleanup on the click. */
  const beatLabStopFromPointerRef = useRef(false);
  /** NEW SYNTH playhead — same single SE2 engine as grid (one pump, one MET path). */
  const beatLabSynth2LastScrollColRef = useRef(-1);
  /**
   * Keep master `pause`/`stop` from suspending the shared graph while Beat Lab is playing.
   * `runningRef` is set before `setTransport` — never clear the flag from stale React transport alone.
   */
  useLayoutEffect(() => {
    /** Audio lookahead flag follows `runningRef` only — not React transport alone (SE2 mirror). */
    setCreationBeatLabTransportRunning(runningRef.current);
  }, [transport]);

  const [bpm, setBpm] = useState(() => {
    try {
      const raw = localStorage.getItem('da-music-box-creation-station-clip-data-v1');
      if (raw) {
        const clip = JSON.parse(raw) as { bpm?: number };
        if (typeof clip.bpm === 'number' && Number.isFinite(clip.bpm) && clip.bpm > 0) {
          return Math.round(clip.bpm);
        }
      }
    } catch {
      /* fall through */
    }
    return BEAT_LAB_DEFAULT_BPM;
  });
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;
  const [sessionLink, setSessionLink] = useState<CreationSessionLinkState>(() => readCreationSessionLink());
  const sessionLinkRef = useRef(sessionLink);
  sessionLinkRef.current = sessionLink;

  useEffect(() => {
    const onChanged = () => setSessionLink(readCreationSessionLink());
    window.addEventListener(CREATION_SESSION_LINK_CHANGED, onChanged);
    return () => window.removeEventListener(CREATION_SESSION_LINK_CHANGED, onChanged);
  }, []);

  const tabRef = useRef<'drums' | 'grid' | 'groove-lab' | 'piano' | 'chord' | 'chord-seq' | '808-lab'>('grid');

  /** Groove Lab PLAY → Beat Lab: skip echo back to Groove when Beat Lab was mirror-started. */
  const suppressGrooveInboundBeatLabMirrorRef = useRef(false);

  /** Session play mirror to play-linked modules (Groove / 808 stay hidden-mounted on Beat Lab tab). */
  const dispatchVisibleSessionPlayMirror = useCallback(
    (action: 'play' | 'pause' | 'stop') => {
      if (suppressGrooveInboundBeatLabMirrorRef.current && action !== 'stop') return;
      const link = sessionLinkRef.current;
      const visible: CreationSessionPlayMirrorVisibility = {
        grooveLab: link.playLinked['groove-lab'],
        eightOhEight: link.playLinked['808-lab'],
        chordBuilder: link.playLinked['chord-builder'],
      };
      dispatchCreationSessionPlayMirror(action, link, visible);
    },
    [],
  );

  /** Keep 808 Lab mounted when pad-deck PLAY → Groove Lab is linked (Groove can drive 808 transport). */
  const [groove808PlayLinked, setGroove808PlayLinked] = useState(
    () => readLab808TransportMirror() === 'groove-lab',
  );
  useEffect(() => {
    const bump = () => {
      setGroove808PlayLinked(
        readLab808TransportMirror() === 'groove-lab' ||
          (tabRef.current === 'groove-lab' && readCreationSessionLink().playLinked['808-lab']),
      );
    };
    bump();
    window.addEventListener(LAB808_SYNC_CHANGED_EVENT, bump);
    window.addEventListener(CREATION_SESSION_LINK_CHANGED, bump);
    return () => {
      window.removeEventListener(LAB808_SYNC_CHANGED_EVENT, bump);
      window.removeEventListener(CREATION_SESSION_LINK_CHANGED, bump);
    };
  }, []);

  /** Groove Lab tab — optional PLAY → Beat Lab mirror (reverse of Session Link Sync). */
  const [grooveBeatlabMirror, setGrooveBeatlabMirror] = useState(() => readGrooveLabBeatlabPlayMirror());
  useEffect(() => {
    const bump = () => setGrooveBeatlabMirror(readGrooveLabBeatlabPlayMirror());
    window.addEventListener(GROOVE_LAB_BEATLAB_MIRROR_CHANGED, bump);
    return () => window.removeEventListener(GROOVE_LAB_BEATLAB_MIRROR_CHANGED, bump);
  }, []);
  const toggleGrooveBeatlabMirror = useCallback(() => {
    const next = !readGrooveLabBeatlabPlayMirror();
    storeGrooveLabBeatlabPlayMirror(next);
    setGrooveBeatlabMirror(next);
  }, []);

  const toggleSessionBpmLink = useCallback((moduleId: CreationSessionLinkModuleId) => {
    setSessionLink((prev) => {
      const next = toggleCreationSessionBpmLink(prev, moduleId);
      storeCreationSessionLink(next);
      if (moduleId === '808-lab' && tabRef.current === 'groove-lab' && next.bpmLinked['808-lab']) {
        storeLab808BpmSyncTarget('groove-lab');
      }
      return next;
    });
  }, []);

  const toggleSessionPlayLink = useCallback((moduleId: CreationSessionLinkModuleId) => {
    setSessionLink((prev) => {
      const next = toggleCreationSessionPlayLink(prev, moduleId);
      storeCreationSessionLink(next);
      if (moduleId === '808-lab' && tabRef.current === 'groove-lab' && next.playLinked['808-lab']) {
        storeLab808TransportMirror('groove-lab');
        storeLab808BpmSyncTarget('groove-lab');
      }
      return next;
    });
  }, []);

  const setChordBuilderSessionBpmLinked = useCallback((linked: boolean) => {
    setSessionLink((prev) => {
      if (prev.bpmLinked['chord-builder'] === linked) return prev;
      const next = { ...prev, bpmLinked: { ...prev.bpmLinked, 'chord-builder': linked } };
      storeCreationSessionLink(next);
      return next;
    });
  }, []);

  /** Linked modules set session BPM; allow on Groove Lab tab even if Beat Lab transport is running. */
  const pushSessionBpmFromLinkedModule = useCallback((next: number) => {
    const clamped = Math.max(40, Math.min(240, Math.round(next)));
    if (clamped === bpmRef.current) return;
    if (runningRef.current && tabRef.current !== 'groove-lab') return;
    setBpm(clamped);
    setBpmInput(String(clamped));
  }, []);

  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const metroOnRef = useRef(false);
  metroOnRef.current = metronomeEnabled;
  const currentDrumsRef = useRef<boolean[][]>([]);

  // SE2-style loop region in beats (bars * beatsPerBar).
  /** 4/4: four quarter-note measures per bar (matches {@link MEASURES_PER_BAR} + MEASURES row). */
  const [beatsPerBar, setBeatsPerBar] = useState(MEASURES_PER_BAR);
  const beatsPerBarRef = useRef(MEASURES_PER_BAR);
  beatsPerBarRef.current = MEASURES_PER_BAR;
  const [loopOn, setLoopOn] = useState(false);
  const loopOnRef = useRef(false);
  loopOnRef.current = loopOn;
  const [loopBars, setLoopBars] = useState(BEAT_LAB_PRESET_LOOP_BARS);
  const loopBarsRef = useRef(BEAT_LAB_PRESET_LOOP_BARS);
  loopBarsRef.current = loopBars;
  /** Which DL chip (4×16 / 2×16 / 1×16) is active — drives highlight on the toolbar. */
  const [beatLabDrumloopPresetActive, setBeatLabDrumloopPresetActive] =
    useState<BeatLabDrumloopPresetVariant>('8bar');
  /** Same subdivision key as Studio Editor 2 piano/drum grid (1/4 ? 1/64). */
  const [pianoSnapSubdiv, setPianoSnapSubdiv] = useState(readPianoSnapSubdivFromStorage);
  const [loopStartBeat, setLoopStartBeat] = useState(0);
  const [loopEndBeat, setLoopEndBeat] = useState(
    () => beatsPerBarRef.current * BEAT_LAB_PRESET_LOOP_BARS,
  );
  const loopStartBeatRef = useRef(0);
  const loopEndBeatRef = useRef(loopEndBeat);
  loopStartBeatRef.current = loopStartBeat;
  loopEndBeatRef.current = loopEndBeat;
  const [patternPlayMode, setPatternPlayMode] = useState<'single' | 'chainAB'>('single');
  const patternPlayModeRef = useRef<'single' | 'chainAB'>('single');
  patternPlayModeRef.current = patternPlayMode;
  const [colWidth, setColWidth]     = useState(DEF_CW);
  const [follow, setFollow]         = useState(true);
  const followRef = useRef(follow);
  followRef.current = follow;
  const isPlaybackOrRecordRef = useRef(false);
  const transportNotStoppedRef = useRef(false);
  const [pianoMode, setPianoMode]   = useState<'notes'|'drums'>('notes');
  const [pianoRegisterShift, setPianoRegisterShift] = useState(0);

  const qpb = beatsPerBarRef.current; // SE2 grid: beats per bar (denom fixed 4)
  const ticksPerBar = qpb * PPQ;
  const loopStartTick = Math.round(loopStartBeatRef.current * PPQ);
  const drumStepSubdiv = Math.max(1, Math.min(DRUM_MAX_SUBDIV, normalizePianoSnapSubdiv(pianoSnapSubdiv)));
  const beatLabLoopBarsClamped = Math.max(1, Math.min(BEAT_LAB_MAX_LOOP_BARS, loopBars));
  /** Step grid + transport span — matches loop length (max 64 bars, no trailing empty columns). */
  const patternColsDrumsBeats = Math.max(
    1,
    Math.round((beatLabLoopBarsClamped * ticksPerBar) / PPQ + 1e-6),
  );
  const patternColsDrums = Math.max(
    1,
    Math.min(TOTAL_COLS, patternColsDrumsBeats * drumStepSubdiv),
  );

  const ctxRef = useRef<AudioContext | null>(null);
  const synthV2KeyboardLaneRef = useRef(BEAT_LAB_MELODIC_LANE_START);
  const clearSynthV2PlayingMidisRef = useRef<() => void>(() => {});
  const releaseHarmonyPianoKeyRef = useRef<() => void>(() => {});
  const sessionStartRef = useRef(0);
  const originBeatRef = useRef(0);
  const cursorBeatRef = useRef(0);
  const displayBeatRef = useRef(0);
  /** SE2 sched anchor — extrapolate audio time for BAR/MSR/time (`smoothSchedNow` → `bDisplay`). */
  const schedAnchorTimeRef = useRef(0);
  const schedAnchorPerfRef = useRef(0);
  /** Maps `sessionStart` (audio) → `performance.now()` for optional visual re-anchor (SE2 contract). */
  const creationPerfSessionStartMsRef = useRef(0);
  const creationWapiSegStateRef = useRef<CreationPlaylineWapiSegState>({
    ...CREATION_PLAYLINE_WAPI_SEG_IDLE,
  });
  const creationWapiBpmRef = useRef(120);
  const creationMetroClickBuffersRef = useRef<CreationMetronomeClickBuffers | null>(null);
  /** Last BAR/MEASURE/PH; RAF paints BAR + beat-in-bar + phrase into `creationHudDomRef` during playback. */
  const creationHudHoldRef = useRef({ m: 1, b: 1, ph: 1 });
  const creationHudDomRef = useRef<CreationHudDomSlots>({
    barDigits: null,
    msrFrac: null,
    phrase: null,
  });
  /** Studio Editor 2?style Bars / Time chips in deck toolbar (imperative `textContent`, same strings as SE2). */
  const creationSe2BarsReadoutElsRef = useRef(new Set<HTMLSpanElement>());
  const creationSe2TimeReadoutElsRef = useRef(new Set<HTMLSpanElement>());
  const creationSe2ReadoutRegistry = useMemo<CreationSe2ReadoutRegistry>(
    () => ({
      bars: creationSe2BarsReadoutElsRef,
      time: creationSe2TimeReadoutElsRef,
    }),
    [],
  );
  /** Last painted BAR|MSR key ? from `computeCreationTransportHudFromBeat` during playback. */
  const creationHudQuarterPaintedRef = useRef('');
  const colWidthRef = useRef(colWidth);
  const patternColsDrumsRef = useRef(patternColsDrums);
  const drumStepSubdivRef = useRef(drumStepSubdiv);
  const patternColsDrumsBeatsRef = useRef(patternColsDrumsBeats);
  /** Active pad voices — `when` is Web Audio schedule time (loop splice cancels future only). */
  const padSampleActiveStoppersRef = useRef<
    Map<string, Set<{ stop: () => void; when: number }>>
  >(new Map());
  /** Ignore compositor loop-wrap glitches right after Play (SE2 contract). */
  const beatLabTransportPlayStartPerfRef = useRef(0);
  const drumPlaylineRef = useRef<HTMLDivElement>(null);
  const drumGridContentRef = useRef<HTMLDivElement>(null);
  const pianoPlaylineRef = useRef<HTMLDivElement>(null);
  const beatLabRollPlaylineRef = useRef<HTMLDivElement>(null);
  const beatLabSynthPlaylineRef = useRef<HTMLDivElement>(null);
  /** NEW SYNTH v2 — sole playhead (isolated from grid / ROLL / legacy SYNTH). */
  const beatLabSynth2PlaylineRef = useRef<HTMLDivElement>(null);
  const beatLabSynth2PlayheadWapiRefs = useMemo(() => createBeatLabSynth2PlaylineWapiRefs(), []);
  const beatLabRollScrollRef = useRef<HTMLDivElement>(null);
  const beatLabSynthScrollRef = useRef<HTMLDivElement>(null);
  const beatLabRollScrollSync = useRef<'roll' | 'drum' | null>(null);
  const beatLabDeckFocusRef = useRef<BeatLabDeckFocus>('sequence');
  const beatLabSynthFocusRef = useRef<{ lane: number; col: number } | null>(null);

  const beatLabDeckIsSynthRoll = (focus: BeatLabDeckFocus = beatLabDeckFocusRef.current) =>
    focus === 'synth' || focus === 'synth2';

  const beatLabPianoPlaylineEl = (): HTMLDivElement | null => {
    if (tabRef.current !== 'grid') return pianoPlaylineRef.current;
    if (beatLabDeckFocusRef.current === 'synth2') return null;
    /** GRID step sequencer — drum playline is the only WAAPI authority (not the roll strip). */
    if (beatLabDeckFocusRef.current === 'sequence') return null;
    if (beatLabDeckFocusRef.current === 'synth') return beatLabSynthPlaylineRef.current;
    return beatLabRollPlaylineRef.current;
  };

  /** SE2 single playhead — cancel WAAPI on inactive roll/synth nodes so two compositor lines never stack. */
  const cancelOrphanBeatLabPianoPlaylines = useCallback((except?: HTMLElement | null) => {
    if (except !== beatLabSynth2PlaylineRef.current) {
      cancelBeatLabSynth2PlaylineWapi(
        beatLabSynth2PlayheadWapiRefs,
        beatLabSynth2PlaylineRef.current,
      );
    }
    for (const el of [
      pianoPlaylineRef.current,
      beatLabRollPlaylineRef.current,
      beatLabSynthPlaylineRef.current,
      beatLabSynth2PlaylineRef.current,
    ]) {
      if (!el || el === except) continue;
      el.getAnimations().forEach((a) => a.cancel());
      el.style.removeProperty('will-change');
      el.style.removeProperty('transform');
    }
    if (!except || except !== beatLabPianoPlaylineEl()) {
      creationPianoPlaylineAnimRef.current = null;
    }
  }, [beatLabSynth2PlayheadWapiRefs]);

  /** Step-grid col width (ROLL) or scaled width so WAAPI `colF` matches SYNTH quarter columns. */
  const beatLabPianoColWForView = (gridColW: number): number => {
    if (beatLabDeckIsSynthRoll()) {
      return beatLabSynthWapiPianoColW(
        drumStepSubdivRef.current,
        beatsPerBarRef.current,
        MEASURES_PER_BAR,
      );
    }
    return gridColW;
  };
  /** Compositor-thread playline (Studio Editor 2 pattern); RAF must not overwrite while `playState === 'running'`. */
  const creationDrumPlaylineAnimRef = useRef<Animation | null>(null);
  const creationPianoPlaylineAnimRef = useRef<Animation | null>(null);
  const creationDrumQuantGlowAnimRef = useRef<Animation | null>(null);
  /** Loop-wrap edge detect (WAAPI cycle + phase rewind) — audio splice re-anchors sessionStart (SE2). */
  const creationWapiPrevPhaseMsRef = useRef(-1);
  const creationWapiLoopCycleSeenRef = useRef(0);
  /** NEW SYNTH — separate WAAPI cycle detect (Groove Lab mirror; not shared with grid loop segments). */
  const beatLabSynth2WapiPrevPhaseMsRef = useRef(-1);
  const beatLabSynth2WapiLoopCycleSeenRef = useRef(0);
  const creationLoopPhaseRef = useRef(-1);
  /** Debounce loop-edge refill — WAAPI + audio can both fire in one frame. */
  /** Ignore spurious loop-wrap during the first moments after Play (was canceling metronome). */
  /** Suppress duplicate WAAPI rebuilds when Play races pattern-load / BPM effects. */
  const beatLabPlaylineGeomKeyRef = useRef('');
  const beatLabLastPlayBpmRef = useRef(bpm);
  /** User dragged the grid scrollbar — pause FOLLOW until Play / Rewind / FOLLOW re-enabled. */
  const beatLabFollowScrollPausedRef = useRef(false);
  /** FOLLOW sets scrollLeft — must not count as user scroll (would disable follow). */
  const beatLabProgrammaticScrollRef = useRef(false);
  const beatLabDrumScrollViewportWRef = useRef(640);
  const stampBeatLabPlaylineEffectKeys = useCallback(() => {
    beatLabPlaylineGeomKeyRef.current = `${colWidthRef.current}|${drumStepSubdivRef.current}|${patternPlayModeRef.current}|${patternColsDrumsRef.current}`;
    beatLabLastPlayBpmRef.current = bpmRef.current;
  }, []);
  /** Beat Lab quant row cells ? ref array for clearing any legacy imperative styles on tab change. */
  const quantMeasureCellElsRef = useRef<(HTMLDivElement | null)[]>([]);
  colWidthRef.current = colWidth;
  patternColsDrumsRef.current = patternColsDrums;
  drumStepSubdivRef.current = drumStepSubdiv;
  patternColsDrumsBeatsRef.current = patternColsDrumsBeats;

  /** Latest rAF frame handler (assigned each render so the pump always calls current HUD/playline logic). */
  const creationTransportOnFrameRef = useRef<(bDisplay: number) => void>(() => {});
  /**
   * Last values for which we publish {@link publishCreationTransportBeat}.
   * We only bump on **pattern column** or **BAR|MSR|PH** changes ? not every subdiv step ? so the main
   * screen is not re-rendered ~32?/s while the playline still moves on the compositor (WAAPI).
   */
  const creationTransportUiPublishRef = useRef<{
    activeCol: number;
    hudKey: string;
  }>({
    activeCol: Number.NaN,
    hudKey: '',
  });
  /** Solid transport clock: next step index/time are advanced monotonically from the audio clock only. */
  const nextStepBeatRef = useRef(0);
  const nextStepTimeRef = useRef(0);
  /** Integer sample index for the next drum quarter — phase-compensated loop wrap. */
  const nextStepSampleRef = useRef(0);
  const nextMetroKRef = useRef(0);
  /** Anti-double-metronome: at most one buffer click per quarter index (refill races / master+local). */
  const lastScheduledQuarterRef = useRef<number>(Number.NEGATIVE_INFINITY);
  /** Caller audio-time snapshot for the active refill (DAW chain rule — do not re-read `ctx.currentTime` in steps). */
  const creationRefillCtSnapRef = useRef(0);
  /** Set from `refillCreationSchedule` (defined after `fireStepAt`) so cold start can call it. */
  const refillCreationScheduleRef = useRef<
    (
      ctx: AudioContext,
      ctSnap: number,
      opts?: { loopContinuation?: boolean; skipOverdueCatchUp?: boolean },
    ) => void
  >(() => {});
  const onAudioContextRebuiltRef = useRef<(ctx: AudioContext) => void>();

  /** Same idea as SE2 `scheduledMetroNodesRef` — buffer clicks queued ~3s ahead; stop on pause/stop. */
  const scheduledCreationMetroNodesRef = useRef<CreationScheduledMetroNode[]>([]);

  const cancelScheduledCreationMetroNodes = useCallback(() => {
    cancelCreationScheduledMetroNodes(scheduledCreationMetroNodesRef.current);
  }, []);

  /** Stop all pad voices (pause / stop / play). */
  const stopAllScheduledPadVoices = useCallback(() => {
    const map = padSampleActiveStoppersRef.current;
    for (const bag of map.values()) {
      for (const entry of [...bag]) {
        try {
          entry.stop();
        } catch {
          /* */
        }
      }
    }
    map.clear();
  }, []);

  /** Loop splice — cancel only not-yet-started pad hits in the ~3 s lookahead (SE2 preview cancel). */
  const stopFutureScheduledPadVoices = useCallback((ctx: AudioContext) => {
    const now = ctx.currentTime;
    const cutoff = now + 0.002;
    const map = padSampleActiveStoppersRef.current;
    for (const [key, bag] of map.entries()) {
      for (const entry of [...bag]) {
        if (entry.when > cutoff) {
          try {
            entry.stop();
          } catch {
            /* */
          }
          bag.delete(entry);
        }
      }
      if (bag.size === 0) map.delete(key);
    }
  }, []);

  /** Metronome click — SE2 `playClick` / Musio buffer contract via {@link scheduleCreationMetronomeClickAt}. */
  const scheduleMetronomeClickAt = useCallback(
    (ctx: AudioContext, idealT: number, accent: boolean, audioNowForClamp: number) => {
      if (!metroOnRef.current) return;
      /** Groove Lab tab owns MET when its transport is running — never stack on Beat Lab clicks. */
      /** Groove mirror transport shares the master bus — never stack a second metronome on Beat Lab. */
      if (isGrooveLabTransportRunning()) return;
      const buffers = ensureCreationMetronomeClickBuffers(
        ctx,
        creationMetroClickBuffersRef.current,
      );
      creationMetroClickBuffersRef.current = buffers;
      scheduleCreationMetronomeClickAt(
        ctx,
        idealT,
        accent,
        audioNowForClamp,
        buffers,
        getMetronomeBusGain,
        scheduledCreationMetroNodesRef.current,
      );
    },
    [getMetronomeBusGain],
  );

  const ensureCtx = useCallback(async (): Promise<AudioContext> => {
    const ctx = ctxRef.current ?? getOrCreateAudioContext();
    ctxRef.current = ctx;
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { /* autoplay */ }
    }
    warmBeatLabLivePadAudio(ctx);
    return ctx;
  }, [getOrCreateAudioContext]);

  const resetCreationPlaylineTransforms = useCallback(() => {
    const pianoEl = beatLabPianoPlaylineEl();
    cancelCreationPlaylineWapi(
      {
        drumAnimRef: creationDrumPlaylineAnimRef,
        pianoAnimRef: creationPianoPlaylineAnimRef,
        drumQuantGlowAnimRef: creationDrumQuantGlowAnimRef,
      },
      drumPlaylineRef.current,
      pianoEl,
      null,
    );
    const drumEl = drumPlaylineRef.current;
    if (drumEl) drumEl.style.transform = `translate3d(${-CREATION_DRUM_PLAYLINE_CENTER_X}px, 0, 0)`;
    if (pianoEl) pianoEl.style.transform = `translate3d(${-CREATION_PIANO_PLAYLINE_CENTER_X}px, 0, 0)`;
  }, []);

  /**
   * Imperative snap: cancel WAAPI + `transform` ? **only while transport is not running**.
   * During play, motion + loop wrap are owned by {@link launchCreationPlaylineWapiNow} (compositor);
   * calling this with `runningRef` true would cancel that anim and desync the line from audio.
   */
  const haltCreationPlaylineAtBeat = useCallback((beatNow: number) => {
    if (beatLabDeckFocusRef.current === 'synth2') {
      cancelBeatLabSynth2PlaylineWapi(beatLabSynth2PlayheadWapiRefs, beatLabSynth2PlaylineRef.current);
      const tb = Math.max(1e-9, patternColsDrumsBeatsRef.current);
      snapBeatLabSynth2PlaylineStatic({
        el: beatLabSynth2PlaylineRef.current,
        beatNow,
        totalBeats: tb,
        quarterCols: Math.max(
          1,
          Math.ceil((tb * MEASURES_PER_BAR) / Math.max(1, beatsPerBarRef.current)),
        ),
        colsPerBar: MEASURES_PER_BAR,
      });
      return;
    }
    const pianoEl = beatLabPianoPlaylineEl();
    const drumEl = drumPlaylineRef.current;
    const playlineEls = new Set<HTMLElement>();
    if (drumEl) playlineEls.add(drumEl);
    if (pianoEl) playlineEls.add(pianoEl);
    for (const el of [
      beatLabRollPlaylineRef.current,
      beatLabSynthPlaylineRef.current,
      pianoPlaylineRef.current,
    ]) {
      if (el) playlineEls.add(el);
    }

    /** Cancel compositor motion first — static `transform` after cancel, never before (infinite WAAPI). */
    for (const anim of [
      creationDrumPlaylineAnimRef.current,
      creationPianoPlaylineAnimRef.current,
      creationDrumQuantGlowAnimRef.current,
    ]) {
      if (!anim || anim.playState === 'idle') continue;
      try {
        anim.pause();
        anim.cancel();
      } catch {
        /* */
      }
    }
    for (const el of playlineEls) {
      el.getAnimations().forEach((a) => {
        try {
          a.pause();
          a.cancel();
        } catch {
          /* */
        }
      });
      el.style.removeProperty('will-change');
      el.style.removeProperty('transform');
    }
    cancelCreationPlaylineWapi(
      {
        drumAnimRef: creationDrumPlaylineAnimRef,
        pianoAnimRef: creationPianoPlaylineAnimRef,
        drumQuantGlowAnimRef: creationDrumQuantGlowAnimRef,
        wapiSegStateRef: creationWapiSegStateRef,
        wapiBpmRef: creationWapiBpmRef,
      },
      drumEl,
      pianoEl,
      null,
    );
    creationWapiSegStateRef.current = { ...CREATION_PLAYLINE_WAPI_SEG_IDLE };

    const cw = Math.max(colWidthRef.current, DRUM_GRID_MIN_CW);
    const pcw = beatLabPianoColWForView(Math.max(colWidthRef.current, PIANO_GRID_MIN_CW));
    const snapCommon = {
      beatNow,
      subdiv: drumStepSubdivRef.current,
      pcols: patternColsDrumsRef.current,
      drumColW: cw,
      pianoColW: pcw,
      loopOn: loopOnRef.current,
      loopStartBeat: loopStartBeatRef.current,
      loopEndBeat: loopEndBeatRef.current,
      playMode: patternPlayModeRef.current,
      drumQuantGlowEl: null as HTMLElement | null,
    };
    if (drumEl) {
      setCreationPlaylineTransformStatic({
        ...snapCommon,
        drumEl,
        pianoEl: null,
      });
    }
    for (const el of playlineEls) {
      if (el === drumEl) continue;
      setCreationPlaylineTransformStatic({
        ...snapCommon,
        drumEl: null,
        pianoEl: el,
      });
    }
  }, []);

  const updateCreationPlaylineTransforms = useCallback((beatNow: number) => {
    if (runningRef.current) return;
    const anim = resolveCreationDrumPlaylineAnim(
      creationDrumPlaylineAnimRef,
      drumPlaylineRef.current,
    );
    if (anim && creationPlaylineAnimIsLive(anim)) return;
    haltCreationPlaylineAtBeat(beatNow);
  }, [haltCreationPlaylineAtBeat]);

  const scrollCreationGridsToPlayheadPx = useCallback(
    (drumX: number, pianoX: number) => {
      scrollBeatLabContainerToPlayhead(
        drumScrollRef.current,
        drumX,
        beatLabProgrammaticScrollRef,
      );
      if (tabRef.current === 'grid') {
        scrollBeatLabContainerToPlayhead(
          beatLabDeckIsSynthRoll()
            ? beatLabSynthScrollRef.current
            : beatLabRollScrollRef.current,
          pianoX,
          beatLabProgrammaticScrollRef,
        );
      } else {
        scrollBeatLabContainerToPlayhead(
          pianoScrollRef.current,
          pianoX,
          beatLabProgrammaticScrollRef,
        );
      }
    },
    [],
  );

  /** Scroll drum + piano/synth decks so `beat` is visible (document-style, centered in view). */
  const scrollCreationGridsToBeat = useCallback(
    (beat: number) => {
      const subdivR = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
      const pcolsR = Math.max(1, patternColsDrumsRef.current);
      const cwD = Math.max(colWidthRef.current, DRUM_GRID_MIN_CW);
      const cwP = beatLabPianoColWForView(Math.max(colWidthRef.current, PIANO_GRID_MIN_CW));
      const { drumX, pianoX } = creationPlaylineColFAndPx(
        beat,
        subdivR,
        pcolsR,
        loopOnRef.current,
        loopStartBeatRef.current,
        loopEndBeatRef.current,
        patternPlayModeRef.current,
        cwD,
        cwP,
      );
      scrollCreationGridsToPlayheadPx(drumX, pianoX);
    },
    [scrollCreationGridsToPlayheadPx],
  );

  const creationPlaylineWapiRefs = useMemo(
    () => ({
      drumAnimRef: creationDrumPlaylineAnimRef,
      pianoAnimRef: creationPianoPlaylineAnimRef,
      drumQuantGlowAnimRef: creationDrumQuantGlowAnimRef,
      wapiSegStateRef: creationWapiSegStateRef,
      wapiBpmRef: creationWapiBpmRef,
      wapiLoopCycleSeenRef: creationWapiLoopCycleSeenRef,
      wapiPrevPhaseMsRef: creationWapiPrevPhaseMsRef,
    }),
    [],
  );

  /** WAAPI owns drum/piano playline motion + loop segment (pause → seek → play); SE2 `launchWapiAnims`. */
  const launchCreationPlaylineWapiNow = useCallback((
    beatNow: number,
    play: boolean,
    opts?: { immediateCompositorStart?: boolean },
  ) => {
    const pianoEl = beatLabPianoPlaylineEl();
    cancelOrphanBeatLabPianoPlaylines(pianoEl);
    const cw = Math.max(colWidthRef.current, DRUM_GRID_MIN_CW);
    const pcw = beatLabPianoColWForView(Math.max(colWidthRef.current, PIANO_GRID_MIN_CW));
    launchCreationPlaylineWapi(creationPlaylineWapiRefs, {
      drumEl: drumPlaylineRef.current,
      pianoEl,
      drumQuantGlowEl: null,
      beatNow,
      play,
      bpm: bpmRef.current,
      subdiv: drumStepSubdivRef.current,
      pcols: patternColsDrumsRef.current,
      drumColW: cw,
      pianoColW: pcw,
      loopOn: loopOnRef.current,
      loopStartBeat: loopStartBeatRef.current,
      loopEndBeat: loopEndBeatRef.current,
      playMode: patternPlayModeRef.current,
      totalBeats: Math.max(1e-9, patternColsDrumsBeatsRef.current),
      audioStartLeadSec: SE2_AUDIO_START_FLOOR_SEC,
      immediateCompositorStart: play ? (opts?.immediateCompositorStart ?? true) : opts?.immediateCompositorStart,
    });
  }, [cancelOrphanBeatLabPianoPlaylines, creationPlaylineWapiRefs]);

  const beatLabSynth2QuarterCols = useCallback(() => {
    const tb = Math.max(1e-9, patternColsDrumsBeatsRef.current);
    return Math.max(
      1,
      Math.ceil((tb * MEASURES_PER_BAR) / Math.max(1, beatsPerBarRef.current)),
    );
  }, []);

  const beatLabSynth2ClockFromMain = useCallback((): BeatLabSynth2TransportClock => {
    return {
      runningRef,
      sessionStartRef,
      originBeatRef,
      cursorBeatRef,
      displayBeatRef,
      bpmRef,
      nextStepBeatRef,
      nextStepTimeRef,
      nextMetroKRef,
      lastScheduledQuarterRef,
      schedAnchorTimeRef,
      schedAnchorPerfRef,
      perfSessionStartMsRef: creationPerfSessionStartMsRef,
      creationRefillCtSnapRef,
    };
  }, []);

  /** SE2 `launchWapiAnims` — one playhead authority; deck picks which WAAPI element. */
  const launchBeatLabActivePlaylineNow = useCallback(
    (beatNow: number, play: boolean, opts?: { immediateCompositorStart?: boolean }) => {
      if (beatLabDeckFocusRef.current === 'synth2') {
        const tb = Math.max(1e-9, patternColsDrumsBeatsRef.current);
        launchBeatLabSynth2PlaylineWapi(beatLabSynth2PlayheadWapiRefs, {
          el: beatLabSynth2PlaylineRef.current,
          beatNow,
          play,
          bpm: bpmRef.current,
          totalBeats: tb,
          quarterCols: beatLabSynth2QuarterCols(),
          colsPerBar: MEASURES_PER_BAR,
          immediateCompositorStart: play ? (opts?.immediateCompositorStart ?? true) : opts?.immediateCompositorStart,
        });
        return;
      }
      launchCreationPlaylineWapiNow(beatNow, play, opts);
    },
    [beatLabSynth2QuarterCols, launchCreationPlaylineWapiNow],
  );

  const scrollBeatLabSynth2FollowBeat = useCallback((visualBeat: number) => {
    const scrollEl = beatLabSynthScrollRef.current;
    if (!scrollEl || !followRef.current || beatLabFollowScrollPausedRef.current) return;
    const tb = Math.max(1e-9, patternColsDrumsBeatsRef.current);
    const qc = beatLabSynth2QuarterCols();
    const colF = beatLabSynth2BeatToQuarterColF(visualBeat, tb, qc) + 0.5 / Math.max(1, qc);
    const col = Math.floor(colF);
    if (col === beatLabSynth2LastScrollColRef.current) return;
    beatLabSynth2LastScrollColRef.current = col;
    const qcw = beatLabSynthQuarterCellW(Math.max(colWidthRef.current, PIANO_GRID_MIN_CW));
    const px = CB_PIANO_LABEL_W + beatLabSynth2QuarterColFToPx(colF, qcw) - CREATION_PIANO_PLAYLINE_CENTER_X;
    const margin = scrollEl.clientWidth * 0.28;
    const left = scrollEl.scrollLeft;
    const right = left + scrollEl.clientWidth;
    if (px < left + margin || px > right - margin) {
      beatLabProgrammaticScrollRef.current = true;
      scrollEl.scrollLeft = Math.max(0, px - scrollEl.clientWidth * 0.35);
      beatLabProgrammaticScrollRef.current = false;
    }
  }, [beatLabSynth2QuarterCols]);

  /**
   * Hard stop for audio lookahead + master metro — must run **before** any async work.
   * Invalidates in-flight `startTransport` via `beatLabPlayGenerationRef`.
   */
  const abortBeatLabTransportPlayback = useCallback(() => {
    cancelScheduledCreationMetroNodes();
    stopMetronomeLoop();
    beatLabPlayGenerationRef.current += 1;
    runningRef.current = false;
    sessionStartRef.current = 0;
    setCreationBeatLabTransportRunning(false);
    stopAllScheduledPadVoices();
    haltBeatLabMelodicTransportNotes();
    haltChordSequencerTransportVoices();
    const mt = masterTransportRef.current;
    if (mt === 'playing' || mt === 'recording' || mt === 'counting') {
      pauseMasterTransport();
    }
    cancelCreationPlaylineWapi(
      creationPlaylineWapiRefs,
      drumPlaylineRef.current,
      beatLabPianoPlaylineEl(),
      null,
    );
    cancelBeatLabSynth2PlaylineWapi(beatLabSynth2PlayheadWapiRefs, beatLabSynth2PlaylineRef.current);
    creationWapiSegStateRef.current = { ...CREATION_PLAYLINE_WAPI_SEG_IDLE };
    for (const el of [
      drumPlaylineRef.current,
      beatLabRollPlaylineRef.current,
      beatLabSynthPlaylineRef.current,
      pianoPlaylineRef.current,
    ]) {
      if (!el) continue;
      el.getAnimations().forEach((a) => {
        try {
          a.cancel();
        } catch {
          /* */
        }
      });
      el.style.removeProperty('will-change');
    }
  }, [
    cancelScheduledCreationMetroNodes,
    creationPlaylineWapiRefs,
    pauseMasterTransport,
    stopAllScheduledPadVoices,
    stopMetronomeLoop,
  ]);

  /** Immediate silence — metro, pads, ~3s lookahead melodic/synth. Playline handled by pause/stop callers. */
  const haltBeatLabTransportAudio = useCallback(
    (opts?: { skipPlayline?: boolean }) => {
      abortBeatLabTransportPlayback();
      if (!opts?.skipPlayline) {
        launchBeatLabActivePlaylineNow(cursorBeatRef.current, false);
      }
    },
    [abortBeatLabTransportPlayback, launchBeatLabActivePlaylineNow],
  );

  /** Studio Editor 2?style Bars / Time text (same `formatBarsBeatsTicks` + `formatTimeMmSsFf` as SE2). */
  const paintCreationSe2TransportReadouts = useCallback((beats: number, paused: boolean) => {
    const db = Math.max(0, beats);
    const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBarRef.current)));
    const bpmR = Math.max(1, bpmRef.current);
    const bars = formatCreationSe2BarsBeatsTicks(db, bpb);
    const time = formatCreationSe2TimeMmSsFf(db, bpmR);
    const barsText = paused ? `pause ${bars}` : bars;
    for (const el of creationSe2BarsReadoutElsRef.current) el.textContent = barsText;
    for (const el of creationSe2TimeReadoutElsRef.current) el.textContent = time;
  }, []);

  const startTransport = useCallback(async (mode: 'play' | 'record') => {
    recordingRef.current = mode === 'record';
    beatLabFollowScrollPausedRef.current = false;
    /** Hold shared graph before master pause — otherwise `pause()` can suspend mid–Beat Lab start. */
    setCreationBeatLabTransportRunning(true);
    const mt = masterTransportRef.current;
    if (mt === 'playing' || mt === 'recording' || mt === 'counting') {
      pauseMasterTransport();
    }
    stopMetronomeLoop();

    const playGen = beatLabPlayGenerationRef.current + 1;
    beatLabPlayGenerationRef.current = playGen;

    const tb = Math.max(1e-9, patternColsDrumsBeatsRef.current);
    const rawBeat = Math.max(0, cursorBeatRef.current);
    const snapped =
      rawBeat < 1e-6 ? 0 : beatLabSnapBeatToQuarterGrid(rawBeat, tb);
    cursorBeatRef.current = snapped;
    originBeatRef.current = snapped;
    displayBeatRef.current = snapped;

    let started = false;
    try {
      let ctx = ctxRef.current;
      if (!ctx || ctx.state === 'closed') {
        ctx = await ensureCtx();
      } else if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          /* autoplay */
        }
      }
      ctxRef.current = ctx;
      if (beatLabPlayGenerationRef.current !== playGen) return;

      const masterGain = (window as unknown as { __daMusicMasterGain?: GainNode | null })
        .__daMusicMasterGain;
      if (masterGain && masterGain.context === ctx) {
        const now = ctx.currentTime;
        const target = Math.max(0, Math.min(1, masterOutputLinearRef.current));
        try {
          masterGain.gain.cancelScheduledValues(now);
          masterGain.gain.setValueAtTime(target, now);
        } catch {
          masterGain.gain.value = target;
        }
      }

      restoreChordSequencerTransportVoices();

      resetCreationLoopWrapDetectRefs(
        creationWapiPrevPhaseMsRef,
        creationWapiLoopCycleSeenRef,
        creationLoopPhaseRef,
      );
      resetCreationLoopWrapDetectRefs(
        beatLabSynth2WapiPrevPhaseMsRef,
        beatLabSynth2WapiLoopCycleSeenRef,
        creationLoopPhaseRef,
      );

      const tCapture = beatLabAudioNow(ctx);
      beatLabTransportPlayStartPerfRef.current = performance.now();
      sessionStartRef.current = tCapture + SE2_AUDIO_START_FLOOR_SEC;
      schedAnchorTimeRef.current = tCapture;
      schedAnchorPerfRef.current = performance.now();
      creationPerfSessionStartMsRef.current =
        performance.now() + SE2_AUDIO_START_FLOOR_SEC * 1000;

      const spb = 60 / Math.max(1, bpmRef.current);
      if (beatLabDeckFocusRef.current === 'synth2') {
        seedBeatLabSynth2TransportOnPlay(
          beatLabSynth2ClockFromMain(),
          snapped,
          sessionStartRef.current,
          spb,
        );
        beatLabSynth2LastScrollColRef.current = -1;
        haltBeatLabMelodicTransportNotes();
        haltBeatLabSynthV2TransportVoices();
      } else {
        seedCreationTransportOnPlay(
          { nextStepBeatRef, nextStepTimeRef },
          snapped,
          sessionStartRef.current,
          spb,
        );
        seedBeatLabSampleDrumClock(
          { nextStepSampleRef },
          sessionStartRef.current,
          snapped,
          Math.ceil(snapped - 1e-8),
          bpmRef.current,
          ctx.sampleRate,
        );
        nextMetroKRef.current = Math.floor(snapped + 1e-8);
        lastScheduledQuarterRef.current = Math.ceil(snapped - 1e-8) - 1;
      }

      if (beatLabPlayGenerationRef.current !== playGen) return;

      /** SE2 `startTransport`: WAAPI at audio anchor before heavy cleanup / refill. */
      launchBeatLabActivePlaylineNow(snapped, true, { immediateCompositorStart: true });
      runningRef.current = true;
      setCreationBeatLabTransportRunning(true);
      setTransport(mode === 'record' ? 'recording' : 'playing');

      for (const el of [
        drumPlaylineRef.current,
        beatLabPianoPlaylineEl(),
        beatLabSynth2PlaylineRef.current,
      ]) {
        if (el) el.style.opacity = '1';
      }
      stampBeatLabPlaylineEffectKeys();

      /** First paint + follow scroll — do not wait for React `isPlaying` / rAF effect. */
      creationTransportOnFrameRef.current(0);
      requestAnimationFrame(() => {
        if (runningRef.current) creationTransportOnFrameRef.current(0);
      });

      cancelScheduledCreationMetroNodes();
      stopAllScheduledPadVoices();

      /** Immediate refill at tCapture — beat-0 before the 25 ms pump (SE2 `refillMetronome`). */
      refillCreationScheduleRef.current(ctx, tCapture);
      queueMicrotask(() => {
        if (!runningRef.current) return;
        const ctxTop = ctxRef.current;
        if (!ctxTop || ctxTop.state === 'closed') return;
        refillCreationScheduleRef.current(ctxTop, Math.max(0, ctxTop.currentTime));
      });
      void ensureBeatLabMelodicInstrumentsReady(ctx, [
        ...melodicInstrumentsRef.current,
        beatLabSynth2PianoInstrumentRef.current,
      ]);
      paintCreationSe2TransportReadouts(snapped, false);
      started = beatLabPlayGenerationRef.current === playGen;
    } catch {
      /* ctx closed or play aborted mid-await */
    } finally {
      if (!started) {
        runningRef.current = false;
        sessionStartRef.current = 0;
        setCreationBeatLabTransportRunning(false);
        haltCreationPlaylineAtBeat(cursorBeatRef.current);
      }
    }
    if (started && beatLabPlayGenerationRef.current === playGen) {
      dispatchVisibleSessionPlayMirror('play');
    }
  }, [
    ensureCtx,
    SE2_AUDIO_START_FLOOR_SEC,
    beatLabSynth2ClockFromMain,
    dispatchVisibleSessionPlayMirror,
    launchBeatLabActivePlaylineNow,
    paintCreationSe2TransportReadouts,
    stopAllScheduledPadVoices,
    stopMetronomeLoop,
    pauseMasterTransport,
    cancelScheduledCreationMetroNodes,
    stampBeatLabPlaylineEffectKeys,
    haltCreationPlaylineAtBeat,
  ]);

  const pauseTransport = useCallback(() => {
    cancelScheduledCreationMetroNodes();
    stopAllScheduledPadVoices();
    haltBeatLabMelodicTransportNotes();
    haltBeatLabSynthV2TransportVoices();
    let pauseBeat = cursorBeatRef.current;
    const ctx = ctxRef.current;
    if (ctx && ctx.state !== 'closed' && sessionStartRef.current > 0) {
      updateSchedAnchor(ctx, schedAnchorTimeRef, schedAnchorPerfRef);
      const tNow = smoothSchedNow(schedAnchorTimeRef, schedAnchorPerfRef, ctx);
      const b = beatAtSessionTime(tNow, sessionStartRef.current, originBeatRef.current, bpmRef.current);
      pauseBeat = Math.max(0, Math.min(patternColsDrumsBeatsRef.current, b));
    }
    runningRef.current = false;
    setCreationBeatLabTransportRunning(false);
    recordingRef.current = false;
    setTransport('paused');
    cursorBeatRef.current = pauseBeat;
    displayBeatRef.current = pauseBeat;
    resetCreationLoopWrapDetectRefs(
      creationWapiPrevPhaseMsRef,
      creationWapiLoopCycleSeenRef,
      creationLoopPhaseRef,
    );
    /** SE2 `pauseTransport`: paused WAAPI at `pauseBeat` (not cancel + static snap). */
    launchBeatLabActivePlaylineNow(pauseBeat, false);
    const qpbR = Math.max(2, Math.min(16, Math.round(beatsPerBarRef.current)));
    const subdiv = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
    const pcols = Math.max(1, patternColsDrumsRef.current);
    const loopStartBarR = Math.floor(loopStartBeatRef.current / qpbR) + 1;
    const hudPause = computeCreationTransportHudFromBeat(pauseBeat, {
      subdiv,
      pcols,
      loopOn: loopOnRef.current,
      loopStartBeat: loopStartBeatRef.current,
      loopEndBeat: loopEndBeatRef.current,
      playMode: patternPlayModeRef.current,
      loopStartBar: loopStartBarR,
      qpb: qpbR,
      transportOriginBeat: originBeatRef.current,
    });
    creationHudQuarterPaintedRef.current = `${hudPause.bar}|${hudPause.measure}|${hudPause.phrase}`;
    paintCreationHudQuarterIntoDom(
      creationHudDomRef.current,
      hudPause,
      qpbR,
      { active: false },
      creationHudHoldRef,
      true,
    );
    creationTransportUiPublishRef.current = {
      activeCol: Number.NaN,
      hudKey: '',
    };
    paintCreationSe2TransportReadouts(pauseBeat, true);
    releaseHarmonyPianoKeyRef.current();
    clearSynthV2PlayingMidisRef.current();
    dispatchVisibleSessionPlayMirror('pause');
    publishCreationTransportBeat();
  }, [
    dispatchVisibleSessionPlayMirror,
    launchBeatLabActivePlaylineNow,
    paintCreationSe2TransportReadouts,
  ]);

  const stopTransport = useCallback(() => {
    runningRef.current = false;
    beatLabPlayGenerationRef.current += 1;
    setCreationBeatLabTransportRunning(false);
    /** Silence first — same order as SE2 pause (metro + lookahead before playline). */
    cancelScheduledCreationMetroNodes();
    stopMetronomeLoop();
    stopAllScheduledPadVoices();
    haltBeatLabMelodicTransportNotes();
    haltChordSequencerTransportVoices();

    let freezeBeat = cursorBeatRef.current;
    const pianoEl = beatLabPianoPlaylineEl();
    const preferPiano =
      tabRef.current === 'grid' && beatLabDeckFocusRef.current !== 'synth2' && pianoEl != null;
    const wapiAnim = resolveCreationActivePlaylineAnim(
      creationPlaylineWapiRefs,
      drumPlaylineRef.current,
      pianoEl,
      preferPiano,
    );
    const animMs = wapiAnim ? creationPlaylineWapiCompositorMs(wapiAnim) : null;
    if (animMs != null) {
      freezeBeat = beatFromCreationPlaylineWapiAnim(
        animMs,
        creationWapiSegStateRef.current,
        creationWapiBpmRef.current,
      );
    }
    const tb = Math.max(1e-9, patternColsDrumsBeatsRef.current);
    const b = Math.max(0, Math.min(tb, freezeBeat));

    sessionStartRef.current = 0;
    schedAnchorTimeRef.current = 0;
    schedAnchorPerfRef.current = 0;
    creationPerfSessionStartMsRef.current = 0;
    resetCreationLoopWrapDetectRefs(
      creationWapiPrevPhaseMsRef,
      creationWapiLoopCycleSeenRef,
      creationLoopPhaseRef,
    );
    cursorBeatRef.current = b;
    originBeatRef.current = b;
    displayBeatRef.current = b;
    lastScheduledQuarterRef.current = Number.NEGATIVE_INFINITY;
    resetCreationTransportStepClock({ nextStepBeatRef, nextStepTimeRef });
    resetBeatLabSampleDrumClock({ nextStepSampleRef });
    reanchorNextStepWhileStopped({ nextStepBeatRef, nextStepTimeRef }, b);

    recordingRef.current = false;
    setTransport('stopped');
    /** One paused WAAPI settle — avoid double haltCreationPlaylineAtBeat + abort pass. */
    launchBeatLabActivePlaylineNow(b, false);
    releaseHarmonyPianoKeyRef.current();
    clearSynthV2PlayingMidisRef.current();

    const z = creationHudDomRef.current;
    const qpbR = Math.max(2, Math.min(16, Math.round(beatsPerBarRef.current)));
    const subdiv = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
    const pcols = Math.max(1, patternColsDrumsRef.current);
    const loopStartBarR = Math.floor(loopStartBeatRef.current / qpbR) + 1;
    const hudStop = computeCreationTransportHudFromBeat(b, {
      subdiv,
      pcols,
      loopOn: loopOnRef.current,
      loopStartBeat: loopStartBeatRef.current,
      loopEndBeat: loopEndBeatRef.current,
      playMode: patternPlayModeRef.current,
      loopStartBar: loopStartBarR,
      qpb: qpbR,
      transportOriginBeat: originBeatRef.current,
    });
    creationHudQuarterPaintedRef.current = `${hudStop.bar}|${hudStop.measure}|${hudStop.phrase}`;
    paintCreationHudQuarterIntoDom(z, hudStop, qpbR, { active: false }, creationHudHoldRef, true);
    paintCreationSe2TransportReadouts(b, false);
    dispatchVisibleSessionPlayMirror('stop');
    creationTransportUiPublishRef.current = { activeCol: Number.NaN, hudKey: '' };
    publishCreationTransportBeat();
  }, [
    cancelScheduledCreationMetroNodes,
    haltBeatLabMelodicTransportNotes,
    haltChordSequencerTransportVoices,
    launchBeatLabActivePlaylineNow,
    paintCreationSe2TransportReadouts,
    stopAllScheduledPadVoices,
    stopMetronomeLoop,
  ]);

  /** 808 Lab PLAY → Beat Lab mirror (when user selects Beat Lab under pad-deck sync strip). */
  useEffect(() => {
    const on808Mirror = (ev: Event) => {
      const detail = (ev as CustomEvent<Lab808TransportMirrorDetail>).detail;
      if (!detail || detail.target !== 'beat-lab') return;
      if (detail.action === 'play') void startTransport('play');
      else if (detail.action === 'pause') void pauseTransport();
      else if (detail.action === 'stop') stopTransport();
    };
    window.addEventListener(LAB808_TRANSPORT_MIRROR_EVENT, on808Mirror);
    return () => window.removeEventListener(LAB808_TRANSPORT_MIRROR_EVENT, on808Mirror);
  }, [startTransport, pauseTransport, stopTransport]);

  /** Groove Lab PLAY → Beat Lab mirror (Groove tab BeatLab toggle). */
  useEffect(() => {
    const onGrooveBeatlabMirror = (ev: Event) => {
      const detail = (ev as CustomEvent<GrooveLabBeatlabMirrorDetail>).detail;
      if (!detail) return;
      if (detail.action === 'play') {
        suppressGrooveInboundBeatLabMirrorRef.current = true;
        void startTransport('play').finally(() => {
          suppressGrooveInboundBeatLabMirrorRef.current = false;
        });
        return;
      }
      if (detail.action === 'pause') {
        suppressGrooveInboundBeatLabMirrorRef.current = true;
        pauseTransport();
        queueMicrotask(() => {
          suppressGrooveInboundBeatLabMirrorRef.current = false;
        });
        return;
      }
      if (detail.action === 'stop') {
        stopTransport();
      }
    };
    window.addEventListener(GROOVE_LAB_BEATLAB_MIRROR_EVENT, onGrooveBeatlabMirror);
    return () => window.removeEventListener(GROOVE_LAB_BEATLAB_MIRROR_EVENT, onGrooveBeatlabMirror);
  }, [startTransport, pauseTransport, stopTransport]);

  /** Stop transport + return to bar 1 / beat 0 (Skip Back) — playhead, HUD, and scroll. */
  const rewindTransport = useCallback(() => {
    runningRef.current = false;
    beatLabPlayGenerationRef.current += 1;
    setCreationBeatLabTransportRunning(false);
    cancelScheduledCreationMetroNodes();
    stopMetronomeLoop();
    stopAllScheduledPadVoices();
    haltCreationPlaylineAtBeat(0);
    abortBeatLabTransportPlayback();
    recordingRef.current = false;
    setTransport('stopped');
    schedAnchorTimeRef.current = 0;
    schedAnchorPerfRef.current = 0;
    creationPerfSessionStartMsRef.current = 0;
    lastScheduledQuarterRef.current = Number.NEGATIVE_INFINITY;
    resetCreationTransportStepClock({ nextStepBeatRef, nextStepTimeRef });
    resetBeatLabSampleDrumClock({ nextStepSampleRef });
    resetCreationLoopWrapDetectRefs(
      creationWapiPrevPhaseMsRef,
      creationWapiLoopCycleSeenRef,
      creationLoopPhaseRef,
    );
    const rewindBeat = beatLabRewindTargetBeat(loopOnRef.current, loopStartBeatRef.current);
    cursorBeatRef.current = rewindBeat;
    originBeatRef.current = rewindBeat;
    displayBeatRef.current = rewindBeat;
    beatLabFollowScrollPausedRef.current = false;
    reanchorNextStepWhileStopped({ nextStepBeatRef, nextStepTimeRef }, rewindBeat);
    haltCreationPlaylineAtBeat(rewindBeat);
    scrollCreationGridsToBeat(rewindBeat);
    const qpbR = Math.max(2, Math.min(16, Math.round(beatsPerBarRef.current)));
    const subdiv = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
    const pcols = Math.max(1, patternColsDrumsRef.current);
    const hud0 = computeCreationTransportHudFromBeat(rewindBeat, {
      subdiv,
      pcols,
      loopOn: loopOnRef.current,
      loopStartBeat: loopStartBeatRef.current,
      loopEndBeat: loopEndBeatRef.current,
      playMode: patternPlayModeRef.current,
      loopStartBar: Math.floor(loopStartBeatRef.current / qpbR) + 1,
      qpb: qpbR,
      transportOriginBeat: rewindBeat,
    });
    creationHudQuarterPaintedRef.current = `${hud0.bar}|${hud0.measure}|${hud0.phrase}`;
    paintCreationHudQuarterIntoDom(
      creationHudDomRef.current,
      hud0,
      qpbR,
      { active: false },
      creationHudHoldRef,
      true,
    );
    paintCreationSe2TransportReadouts(rewindBeat, false);
    dispatchVisibleSessionPlayMirror('stop');
    creationTransportUiPublishRef.current = { activeCol: Number.NaN, hudKey: '' };
    publishCreationTransportBeat();
  }, [
    abortBeatLabTransportPlayback,
    dispatchVisibleSessionPlayMirror,
    haltCreationPlaylineAtBeat,
    scrollCreationGridsToBeat,
    paintCreationSe2TransportReadouts,
  ]);

  const seekBeats = useCallback((b: number) => {
    const nb = Math.max(0, b);
    const tb = Math.max(1e-9, patternColsDrumsBeatsRef.current);
    const clamped = Math.max(0, Math.min(tb, nb));
    cursorBeatRef.current = clamped;
    displayBeatRef.current = clamped;
    if (runningRef.current && ctxRef.current) {
      const ctx = ctxRef.current;
      const tCapture = Math.max(0, ctx.currentTime);
      sessionStartRef.current = tCapture + SE2_AUDIO_START_FLOOR_SEC;
      originBeatRef.current = clamped;
      const spb = 60 / Math.max(1, bpmRef.current);
      reanchorNextStepWhileRunning(
        {
          nextStepBeatRef,
          nextStepTimeRef,
          sessionStartRef,
          originBeatRef,
          lastScheduledQuarterRef,
        },
        sessionStartRef.current,
        clamped,
        spb,
      );
      syncBeatLabSampleDrumClockToBeat(
        { nextStepSampleRef },
        sessionStartRef.current,
        originBeatRef.current,
        nextStepBeatRef.current,
        bpmRef.current,
        ctx.sampleRate,
      );
      nextMetroKRef.current = beatLabSnapBeatToQuarterGrid(clamped, tb);
      cancelScheduledCreationMetroNodes();
      if (beatLabDeckFocusRef.current === 'synth2') {
        haltBeatLabMelodicTransportNotes();
        haltBeatLabSynthV2TransportVoices();
        launchBeatLabActivePlaylineNow(clamped, true, { immediateCompositorStart: true });
        refillCreationScheduleRef.current(ctx, tCapture, { skipOverdueCatchUp: true });
      } else {
        launchBeatLabActivePlaylineNow(clamped, true);
      }
    } else {
      originBeatRef.current = clamped;
      sessionStartRef.current = 0;
      reanchorNextStepWhileStopped({ nextStepBeatRef, nextStepTimeRef }, clamped);
      if (beatLabDeckFocusRef.current === 'synth2') {
        snapBeatLabSynth2PlaylineStatic({
          el: beatLabSynth2PlaylineRef.current,
          beatNow: clamped,
          totalBeats: tb,
          quarterCols: beatLabSynth2QuarterCols(),
          colsPerBar: MEASURES_PER_BAR,
        });
      } else {
        haltCreationPlaylineAtBeat(clamped);
      }
    }
    scrollCreationGridsToBeat(clamped);
    const qpbR = Math.max(2, Math.min(16, Math.round(beatsPerBarRef.current)));
    const subdiv = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
    const pcols = Math.max(1, patternColsDrumsRef.current);
    const loopStartBarR = Math.floor(loopStartBeatRef.current / qpbR) + 1;
    const hudSeek = computeCreationTransportHudFromBeat(clamped, {
      subdiv,
      pcols,
      loopOn: loopOnRef.current,
      loopStartBeat: loopStartBeatRef.current,
      loopEndBeat: loopEndBeatRef.current,
      playMode: patternPlayModeRef.current,
      loopStartBar: loopStartBarR,
      qpb: qpbR,
      transportOriginBeat: originBeatRef.current,
    });
    if (runningRef.current) {
      creationHudQuarterPaintedRef.current = '';
    } else {
      creationHudQuarterPaintedRef.current = `${hudSeek.bar}|${hudSeek.measure}|${hudSeek.phrase}`;
      paintCreationHudQuarterIntoDom(
        creationHudDomRef.current,
        hudSeek,
        qpbR,
        { active: false },
        creationHudHoldRef,
        true,
      );
    }
    creationTransportUiPublishRef.current = { activeCol: Number.NaN, hudKey: '' };
    publishCreationTransportBeat();
    paintCreationSe2TransportReadouts(clamped, false);
  }, [
    SE2_AUDIO_START_FLOOR_SEC,
    beatLabSynth2QuarterCols,
    haltCreationPlaylineAtBeat,
    launchBeatLabActivePlaylineNow,
    scrollCreationGridsToBeat,
    paintCreationSe2TransportReadouts,
  ]);

  /** Click timeline column (ruler / quant row / Ctrl+pad) ? move playhead to that step. */
  const seekTransportToPatternColumn = useCallback(
    (patternColCi: number) => {
      if (CREATION_BACKEND_BLANK) return;
      const s = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
      const off = creationDrumColOffsetSteps(loopOnRef.current, loopStartBeatRef.current, s);
      const pc = Math.max(1, patternColsDrumsRef.current);
      const ci = Math.max(0, Math.min(pc - 1, Math.floor(patternColCi)));
      const beat = (ci + off) / s;
      seekBeats(beat);
    },
    [seekBeats],
  );

  const setLoopRangeBeats = useCallback((startB: number, endB: number) => {
    const s = Math.max(0, Math.min(startB, endB));
    const e = Math.max(s + beatsPerBarRef.current, Math.max(startB, endB));
    const bars = Math.max(
      1,
      Math.min(BEAT_LAB_MAX_LOOP_BARS, Math.round((e - s) / beatsPerBarRef.current)),
    );
    const qpbR = beatsPerBarRef.current;
    setLoopStartBeat(s);
    setLoopEndBeat(s + bars * qpbR);
    setLoopBars(bars);
  }, []);

  /** Beat Lab default layout: eight-bar loop span (extend via LEN up to 64). */
  useEffect(() => {
    const defaultBars = BEAT_LAB_PRESET_LOOP_BARS;
    setLoopBars(defaultBars);
    setLoopRangeBeats(loopStartBeatRef.current, loopStartBeatRef.current + defaultBars * beatsPerBarRef.current);
  }, [setLoopRangeBeats]);

  // Compatibility vars for existing UI components (Creation now uses local SE2-style loop).
  const loopEnabled = loopOn;
  const setLoopEnabled = setLoopOn;
  const loopStartBar = Math.floor(loopStartBeatRef.current / beatsPerBarRef.current) + 1;
  const loopEndBar = Math.floor(loopEndBeatRef.current / beatsPerBarRef.current);
  const loopSection: string | null = null;

  const drumStepSubdivUi = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdiv)));

  /** Ruler segments: one header per DAW bar (`measures × subdiv` columns each). */
  const creationDrumRulerCounts = useMemo(() => {
    const cols = patternColsDrums;
    const colsPerBar = Math.max(1, MEASURES_PER_BAR * drumStepSubdiv);
    const out: number[] = [];
    for (let o = 0; o < cols; o += colsPerBar) {
      out.push(Math.min(colsPerBar, cols - o));
    }
    return out;
  }, [patternColsDrums, drumStepSubdiv]);
  const { notes: sharedNotes, addNote: addSharedNote, removeNote: removeSharedNote } = usePianoNotes();

  /** Land on Genius Home Studio layout (sounds rail + sequence) ? sub-tools live in the module sidebar. */
  const [tab, setTab]               = useState<'drums' | 'grid' | 'groove-lab' | 'piano' | 'chord' | 'chord-seq' | '808-lab'>(() =>
    creationSubScreenToTab(creationSubScreen),
  );
  tabRef.current = tab;

  /** Master transport UI only exists on Beat Lab — pause if the user leaves while playing so audio is not stuck with no controls. */
  useEffect(() => {
    if (isScreenActive) return;
    if (!runningRef.current) {
      setCreationBeatLabTransportRunning(false);
      return;
    }
    void pauseTransport();
  }, [isScreenActive, pauseTransport]);

  useEffect(() => {
    if (tab === 'grid') return;
    if (tab === 'groove-lab' && grooveBeatlabMirror) return;
    if (!runningRef.current) return;
    void pauseTransport();
  }, [tab, grooveBeatlabMirror, pauseTransport]);

  /** Groove Lab owns transport + metronome — silence master MET lookahead and Beat Lab metro on that tab. */
  useEffect(() => {
    if (tab !== 'groove-lab') return;
    if (grooveBeatlabMirror) return;
    stopMetronomeLoop();
    cancelScheduledCreationMetroNodes();
    setCreationBeatLabTransportRunning(false);
  }, [tab, grooveBeatlabMirror, stopMetronomeLoop, cancelScheduledCreationMetroNodes]);

  /** Keep shared AudioContext running while Groove Lab is open (keypad preview / transport). */
  useEffect(() => {
    const active = isScreenActive && tab === 'groove-lab';
    setGrooveLabScreenActive(active);
    return () => setGrooveLabScreenActive(false);
  }, [isScreenActive, tab]);

  /** Keep shared AudioContext running while 808 Lab is open (pads / MPC / tone grid). */
  useEffect(() => {
    const active = isScreenActive && tab === '808-lab';
    setLab808ScreenActive(active);
    return () => setLab808ScreenActive(false);
  }, [isScreenActive, tab]);

  /** Beat Lab / NEW SYNTH use local lookahead MET — never stack on master-clock worker clicks. */
  useEffect(() => {
    if (!isScreenActive || tab === 'groove-lab') return;
    stopMetronomeLoop();
  }, [isScreenActive, tab, stopMetronomeLoop]);

  /** MET toggle while playing — drop queued clicks and re-seed from `nextMetroKRef`. */
  useEffect(() => {
    if (!runningRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx || ctx.state === 'closed') return;
    stopMetronomeLoop();
    cancelScheduledCreationMetroNodes();
    refillCreationScheduleRef.current(ctx, Math.max(0, ctx.currentTime), { skipOverdueCatchUp: true });
  }, [metronomeEnabled, cancelScheduledCreationMetroNodes, stopMetronomeLoop]);

  const [drumKitGenOpen, setDrumKitGenOpen] = useState(false);

  const goToCreationSub = useCallback(
    (sub: CreationSubScreenId) => {
      const next = creationSubAllowedForPlan(sub) ? sub : defaultCreationSubForPlan();
      onCreationSubScreenChange?.(next);
      setTab(creationSubScreenToTab(next));
      if (next === 'drum-kit-generator') setDrumKitGenOpen(true);
    },
    [onCreationSubScreenChange],
  );

  useEffect(() => {
    const nextTab = creationSubScreenToTab(creationSubScreen);
    setTab((prev) => (prev === nextTab ? prev : nextTab));
    if (creationSubScreen === 'drum-kit-generator') setDrumKitGenOpen(true);
  }, [creationSubScreen]);
  const [drumKitGenStyle, setDrumKitGenStyle] = useState<DrumKitGeneratorStyle>('house');
  const [drumKitGenBusy, setDrumKitGenBusy] = useState(false);
  const [bpmInput, setBpmInput]     = useState(String(bpm));
  const [kit, setKit]               = useState(KITS[0]);
  const [kitSelectValue, setKitSelectValue] = useState(`preset:${KITS[0]}`);
  const [savedKits, setSavedKits] = useState<BeatLabSavedKit[]>(() => loadBeatLabSavedKits());
  const [savedBeatPadsSessions, setSavedBeatPadsSessions] = useState<BeatPadsSavedSession[]>(() =>
    loadBeatPadsSavedSessions(),
  );
  const [beatPadsSessionSaveStatus, setBeatPadsSessionSaveStatus] = useState<string | null>(null);
  const [savedPatterns, setSavedPatterns] = useState<BeatLabSavedPattern[]>(() => loadBeatLabSavedPatterns());
  const [savePatternStatus, setSavePatternStatus] = useState<string | null>(null);
  const [patternBankHint, setPatternBankHint] = useState<string | null>(null);
  const [patternBankOpenUserSaves, setPatternBankOpenUserSaves] = useState(false);
  const [loadedPatternBankPick, setLoadedPatternBankPick] = useState<{
    bankId: BeatLabPatternBankId;
    presetId: string;
    presetName: string;
  } | null>(null);
  const [savedSongs, setSavedSongs] = useState<BeatLabSavedSong[]>(() => loadBeatLabSavedSongs());
  const [saveKitStatus, setSaveKitStatus] = useState<string | null>(null);
  const [saveSongStatus, setSaveSongStatus] = useState<string | null>(null);
  const [activeBank, setActiveBank] = useState(0);
  const [rollInstr, setRollInstr]   = useState(0);
  const [banks, setBanks]           = useState<Bank[]>(() => {
    try {
      const saved = localStorage.getItem('creationStation_banks');
      if (saved) {
        const parsed = JSON.parse(saved) as unknown;
        if (Array.isArray(parsed)) {
          return BANKS.map((_, i) => {
            const b = parsed[i] as { drums?: unknown; notes?: unknown } | undefined;
            if (!b) return { drums: emptyDrums(), notes: [], midiRoll: [] };
            return {
              drums: normalizeBankDrumPattern(b.drums),
              notes: Array.isArray(b.notes) ? (b.notes as PianoNote[]) : [],
              midiRoll: normalizeBeatLabMidiRoll((b as { midiRoll?: unknown }).midiRoll),
              volAutomation: Array.isArray((b as { volAutomation?: unknown }).volAutomation)
                ? ((b as { volAutomation: number[] }).volAutomation)
                : undefined,
              pitchAutomation: Array.isArray((b as { pitchAutomation?: unknown }).pitchAutomation)
                ? ((b as { pitchAutomation: number[] }).pitchAutomation)
                : undefined,
              melodicInstruments: normalizeBeatLabMelodicInstruments(
                (b as { melodicInstruments?: unknown }).melodicInstruments,
              ),
              melodicSynthPresetIds: normalizeBeatLabMelodicSynthPresetIds(
                (b as { melodicSynthPresetIds?: unknown }).melodicSynthPresetIds,
              ),
              melodicSynthVoices: normalizeBeatLabBassSynthVoiceParams(
                (b as { melodicSynthVoices?: unknown }).melodicSynthVoices,
                normalizeBeatLabMelodicSynthPresetIds(
                  (b as { melodicSynthPresetIds?: unknown }).melodicSynthPresetIds,
                ),
              ),
            };
          });
        }
      }
    } catch (e) {
      console.warn('Beat Lab: corrupt bank storage, resetting', e);
      clearBeatLabStorage();
    }
    return BANKS.map(() => ({
      drums: emptyDrums(),
      notes: [],
      midiRoll: [],
      volAutomation: undefined,
      pitchAutomation: undefined,
      melodicInstruments: normalizeBeatLabMelodicInstruments(undefined),
      melodicSynthPresetIds: normalizeBeatLabMelodicSynthPresetIds(undefined),
      melodicSynthVoices: normalizeBeatLabBassSynthVoiceParams(undefined),
    }));
  });
  const [beatLabDeckFocus, setBeatLabDeckFocusState] = useState<BeatLabDeckFocus>('sequence');
  /** Bumped when chords land on NEW SYNTH — expands piano roll so playhead DOM exists. */
  const [beatLabSynth2RollExpandKey, setBeatLabSynth2RollExpandKey] = useState(0);
  const setBeatLabDeckFocus = useCallback((focus: BeatLabDeckFocus) => {
    setBeatLabDeckFocusState(focus);
  }, []);
  useEffect(() => {
    setBeatLabDeckFocusState((f) => {
      const legacy = f as string;
      if (legacy === 'pads' || legacy === 'split') return 'roll';
      return f;
    });
  }, []);
  useEffect(() => {
    if (beatLabDeckFocus === 'synth' || beatLabDeckFocus === 'synth2') {
      setSelectedBeatLabLane((lane) =>
        lane != null && lane >= BEAT_LAB_MELODIC_LANE_START ? lane : BEAT_LAB_MELODIC_LANE_START,
      );
      return;
    }
    if (beatLabDeckFocus === 'sequence') {
      setSelectedBeatLabLane((lane) =>
        lane != null && lane >= BEAT_LAB_MELODIC_LANE_START ? null : lane,
      );
    }
  }, [beatLabDeckFocus]);

  const [beatLabMixerOpen, setBeatLabMixerOpen] = useState(false);
  const [beatLabMixerPadsOnly, setBeatLabMixerPadsOnly] = useState(false);
  /** Beat Pads overlay open — Pattern Bank loads local loop instead of main grid. */
  const [beatPadsMachineOpen, setBeatPadsMachineOpen] = useState(false);
  const beatPadsMachineOpenRef = useRef(false);
  useEffect(() => {
    beatPadsMachineOpenRef.current = beatPadsMachineOpen;
  }, [beatPadsMachineOpen]);
  const [beatPadsPatternInject, setBeatPadsPatternInject] = useState<{
    preset: PatternPreset;
    nonce: number;
  } | null>(null);
  const consumeBeatPadsPatternInject = useCallback(() => {
    setBeatPadsPatternInject(null);
  }, []);
  const [beatPadsSessionInject, setBeatPadsSessionInject] = useState<{
    session: BeatPadsSavedSession;
    nonce: number;
  } | null>(null);
  const consumeBeatPadsSessionInject = useCallback(() => {
    setBeatPadsSessionInject(null);
  }, []);
  const [beatPadsSe2Inject, setBeatPadsSe2Inject] = useState<{
    pattern: BeatPadsDrumPattern;
    loopBars: number;
    stepsPerBar: BeatPadsGridStepsPerBar;
    bpm: number;
    trackName?: string;
    nonce: number;
  } | null>(null);
  const consumeBeatPadsSe2Inject = useCallback(() => {
    setBeatPadsSe2Inject(null);
  }, []);

  useEffect(() => {
    if (!isScreenActive) return;
    const req = consumeBeatPadsOpenFromSe2();
    if (!req) return;
    setBeatPadsSe2Inject({
      pattern: normalizeBeatPadsPattern(req.pattern, req.loopBars, req.stepsPerBar),
      loopBars: req.loopBars,
      stepsPerBar: req.stepsPerBar,
      bpm: req.bpm,
      trackName: req.trackName,
      nonce: req.nonce,
    });
    setBeatPadsMachineOpen(true);
    onCreationSubScreenChange?.('beat-lab');
  }, [isScreenActive, onCreationSubScreenChange]);

  const toggleBeatLabMixer = useCallback((opts?: { padsOnly?: boolean }) => {
    setBeatLabMixerOpen((wasOpen) => {
      const next = !wasOpen;
      if (opts?.padsOnly === true) {
        setBeatLabMixerPadsOnly(true);
      } else if (opts?.padsOnly === false || !next) {
        setBeatLabMixerPadsOnly(false);
      }
      return next;
    });
  }, []);
  const [beatLabSynthChordRail, setBeatLabSynthChordRail] = useState<BeatLabImportedChordRail | null>(null);
  const beatLabSynthChordRailRef = useRef<BeatLabImportedChordRail | null>(null);
  beatLabSynthChordRailRef.current = beatLabSynthChordRail;

  useEffect(() => {
    writeBeatLabSynthChordRailSync(beatLabSynthChordRail);
  }, [beatLabSynthChordRail]);

  const [beatLabSynth2BassLane, setBeatLabSynth2BassLane] = useState(
    () => readStoredBeatLabSynth2Lanes().bassLane,
  );
  const [beatLabSynth2HarmonyLane, setBeatLabSynth2HarmonyLane] = useState(
    () => readStoredBeatLabSynth2Lanes().harmonyLane,
  );
  const [beatLabSynth2PianoInstrument, setBeatLabSynth2PianoInstrument] = useState(
    BEAT_LAB_SYNTH2_DEFAULT_PIANO_INSTRUMENT,
  );
  const beatLabSynth2BassLaneRef = useRef(beatLabSynth2BassLane);
  const beatLabSynth2HarmonyLaneRef = useRef(beatLabSynth2HarmonyLane);
  const beatLabSynth2PianoInstrumentRef = useRef(beatLabSynth2PianoInstrument);
  beatLabSynth2BassLaneRef.current = beatLabSynth2BassLane;
  beatLabSynth2HarmonyLaneRef.current = beatLabSynth2HarmonyLane;
  beatLabSynth2PianoInstrumentRef.current = beatLabSynth2PianoInstrument;

  useEffect(() => {
    if ((beatLabDeckFocus !== 'synth' && beatLabDeckFocus !== 'synth2') || CREATION_BACKEND_BLANK) return;
    resetBeatLabMelodicWarmupFlag();
    const ctx = getOrCreateAudioContext();
    void ctx.resume().then(() => {
      void warmupBeatLabMelodicSoundfont(
        ctx,
        [...melodicInstrumentsRef.current, beatLabSynth2PianoInstrumentRef.current],
        true,
      );
    });
  }, [beatLabDeckFocus, getOrCreateAudioContext]);

  /** Warm AudioContext + GM soundfonts while Beat Lab is open so Play does not stall on first click. */
  useEffect(() => {
    if (!isScreenActive || creationSubScreen !== 'beat-lab' || CREATION_BACKEND_BLANK) return;
    const ctx = getOrCreateAudioContext();
    void ctx.resume().then(() => {
      void warmupBeatLabMelodicSoundfont(
        ctx,
        [...melodicInstrumentsRef.current, beatLabSynth2PianoInstrumentRef.current],
        false,
      );
    });
  }, [isScreenActive, creationSubScreen, getOrCreateAudioContext]);

  const synth2HarmonyPulseRef = useRef<(midis: number[], ms: number) => void>(() => {});

  const [beatLabGridZoomMode, setBeatLabGridZoomMode] = useState<BeatLabGridZoomMode>('min');
  const [beatLabTileGrid, setBeatLabTileGrid] = useState(() => loadBeatLabTileGridPref());
  const [beatLabGridLayoutMode, setBeatLabGridLayoutMode] = useState<BeatLabGridLayoutMode>('default');
  const [beatLabEditTool, setBeatLabEditTool] = useState<BeatLabEditTool>('pointer');
  const [beatLabRollSelection, setBeatLabRollSelection] = useState<{ lane: number; col: number } | null>(
    null,
  );
  const beatLabRollSelectionRef = useRef(beatLabRollSelection);
  beatLabRollSelectionRef.current = beatLabRollSelection;
  /** Last grid cell pointer-down (any tool) ? shortcuts work without PTR selection state. */
  const beatLabGridFocusRef = useRef<{ lane: number; col: number } | null>(null);
  beatLabDeckFocusRef.current = beatLabDeckFocus;

  const beatLabRollClipboardRef = useRef<BeatLabMidiNote[]>([]);
  const [beatLabTimeStretch, setBeatLabTimeStretch] = useState(false);
  const beatLabTimeStretchRef = useRef(false);
  const beatLabGridFullView =
    beatLabDeckFocus === 'sequence' && beatLabGridLayoutMode === 'full';
  const drumPaintRef = useRef<{
    active: boolean;
    on: boolean;
    lastKey: string;
    lastX: number;
    lastY: number;
  } | null>(null);
  const beatLabGridResizeRef = useRef<{
    lane: number;
    headCol: number;
    startX: number;
    startLen: number;
    previewLen: number;
  } | null>(null);
  const beatLabGridDragRef = useRef<{
    fromLane: number;
    fromCol: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const beatLabGridJustDraggedRef = useRef(false);
  const resizeBeatLabMidiRollNoteRef = useRef<
    (lane: number, col: number, len: number) => void
  >(() => {});
  const moveBeatLabMidiRollNoteRef = useRef<
    (fromLane: number, fromCol: number, toLane: number, toCol: number) => void
  >(() => {});
  const banksBootRef = useRef(banks);
  banksBootRef.current = banks;
  const [patternSlot, setPatternSlot] = useState<PatternSlot>('A');
  const [bankPatternSlots, setBankPatternSlots] = useState<
    Array<Record<PatternSlot, DrumPattern>>
  >(() => BANKS.map(() => ({ A: emptyDrums(), B: emptyDrums() })));
  const patternSlotsInitializedRef = useRef(false);
  const bankPatternSlotsRef = useRef<Array<Record<PatternSlot, DrumPattern>>>(
    bankPatternSlots,
  );
  bankPatternSlotsRef.current = bankPatternSlots;

  useEffect(() => {
    setBpmInput(String(Math.round(bpm)));
  }, [bpm]);

  useEffect(() => {
    try {
      localStorage.setItem(
        PIANO_SNAP_SUBDIV_STORAGE_KEY,
        String(normalizePianoSnapSubdiv(pianoSnapSubdiv)),
      );
    } catch {
      /* ignore */
    }
  }, [pianoSnapSubdiv]);

  useEffect(() => {
    saveBeatLabTileGridPref(beatLabTileGrid);
  }, [beatLabTileGrid]);

  useEffect(() => {
    if (!isScreenActive) return;
    setPianoSnapSubdiv(readPianoSnapSubdivFromStorage());
  }, [isScreenActive]);

  // Persist banks to localStorage
  useEffect(() => {
    localStorage.setItem('creationStation_banks', JSON.stringify(banks));
  }, [banks]);
  useEffect(() => {
    try {
      localStorage.setItem('creationStation_patternSlots', JSON.stringify(bankPatternSlots));
    } catch {
      /* ignore */
    }
  }, [bankPatternSlots]);
  useEffect(() => {
    if (patternSlotsInitializedRef.current) return;
    let loaded: Array<Record<PatternSlot, DrumPattern>> | null = null;
    try {
      const raw = localStorage.getItem('creationStation_patternSlots');
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          loaded = parsed.map((entry) => {
            const e = entry as Partial<Record<PatternSlot, unknown>>;
            return {
              A: normalizeBankDrumPattern(e.A),
              B: normalizeBankDrumPattern(e.B),
            };
          });
        }
      }
    } catch (e) {
      console.warn('Beat Lab: corrupt pattern-slot storage, resetting slots', e);
      try {
        localStorage.removeItem('creationStation_patternSlots');
      } catch {
        /* ignore */
      }
    }
    const boot = banksBootRef.current;
    const nextSlots = BANKS.map((_, i) => ({
      A: loaded?.[i]?.A ?? normalizeBankDrumPattern(boot[i]?.drums),
      B: loaded?.[i]?.B ?? emptyDrums(),
    }));
    bankPatternSlotsRef.current = nextSlots;
    setBankPatternSlots(nextSlots);
    patternSlotsInitializedRef.current = true;
  }, []);

  const syncActiveBankDrumsFromSlot = useCallback(
    (slot: PatternSlot = patternSlot) => {
      const slotDrums = normalizeBankDrumPattern(
        bankPatternSlotsRef.current[activeBank]?.[slot],
      );
      setBanks((prev) =>
        prev.map((b, i) =>
          i === activeBank ? { ...b, drums: slotDrums.map((r) => r.slice()) } : b,
        ),
      );
    },
    [activeBank, patternSlot],
  );

  useEffect(() => {
    if (!patternSlotsInitializedRef.current) return;
    syncActiveBankDrumsFromSlot(patternSlot);
  }, [activeBank, patternSlot, syncActiveBankDrumsFromSlot]);

  const [pressedPianoKeyRow, setPressedPianoKeyRow] = useState<number | null>(null);
  const [selectedBeatLabLane, setSelectedBeatLabLane] = useState<number | null>(null);

  useEffect(() => {
    const lane = beatLabRollSelection?.lane;
    if (lane != null && lane >= 0 && lane < BEAT_LAB_MIDI_LANES) {
      setSelectedBeatLabLane(lane);
    }
  }, [beatLabRollSelection]);

  const selectedDrumPad =
    selectedBeatLabLane != null && selectedBeatLabLane < BEAT_LAB_PAD_LANES
      ? selectedBeatLabLane
      : null;
  const selectedBeatLabLaneRef = useRef<number | null>(selectedBeatLabLane);
  selectedBeatLabLaneRef.current = selectedBeatLabLane;
  const [mutedPads, setMutedPads] = useState<boolean[]>(() => Array(16).fill(false));
  const mutedPadsRef = useRef<boolean[]>(Array(16).fill(false));
  mutedPadsRef.current = mutedPads;
  /** MPC-style: per-bank pad samples (key `${bank}_${pad}`) ? presence drives UI; buffers in ref for playback. */
  const [padSamplePresence, setPadSamplePresence] = useState<Record<string, boolean>>({});
  /** Optional source BPM per sample key (pad SRC-BPM UI + preview; not tied to main tempo slider). */
  const [padSampleRootBpms, setPadSampleRootBpms] = useState<Record<string, number>>({});
  const padSampleRootBpmRef = useRef<Record<string, number>>({});
  /** Display name per pad sample key ? mirrors `StoredPadSample.label` (sampler + sequencer lane). */
  const [padSampleLabels, setPadSampleLabels] = useState<Record<string, string>>({});
  const [geniusSamplerTargetPad, setGeniusSamplerTargetPad] = useState(14);

  /** Keep Sound Families target aligned with the highlighted drum pad (snare, kick, etc.). */
  useEffect(() => {
    if (selectedDrumPad != null) setGeniusSamplerTargetPad(selectedDrumPad);
  }, [selectedDrumPad]);

  const padSampleBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  /** HPF/LPF/trim/fine-tune per `${bank}_${pad}` ? mirrors optional fields on `StoredPadSample`. */
  const padSamplePlaybackOptsRef = useRef<Record<string, PadSamplerPlaybackOpts>>({});
  const padSampleRootMidiRef = useRef<Record<string, number>>({});
  const padSampleStrikeMidiRef = useRef<Record<string, number>>({});
  const padSampleChromaticRef = useRef<Record<string, boolean>>({});
  const beatPadsSpreadVoiceRef = useRef<BeatPadsSpreadVoice | null>(null);
  const spreadChordGenSeedRef = useRef(0);
  const [beatPadsSpreadTrack, setBeatPadsSpreadTrack] = useState<BeatPadsSpreadTrackState | null>(null);
  const beatPadsSpreadActive =
    beatPadsSpreadTrack != null && beatPadsSpreadTrack.bank === activeBank;
  const clearedOrphanSpreadBanksRef = useRef<Set<number>>(new Set());
  const clearBeatPadsSpreadTrack = useCallback(() => {
    beatPadsSpreadVoiceRef.current = null;
    setBeatPadsSpreadTrack(null);
    writeBeatPadsSpreadSession(null);
  }, []);
  const padSampleFxRackRef = useRef<Record<string, PadSamplerFxRack>>({});
  const padDrumVoiceOptsRef = useRef<Record<string, BeatLabDrumPadVoiceOpts>>({});
  const playPadSoundRef = useRef<
    (
      pi: number,
      vel: number,
      when?: number,
      notePitchSemi?: number,
      opts?: {
        tempoSyncRate?: number;
        beatPadVoice?: BeatLabDrumPadVoiceOpts;
        /** Chromatic orchestra hit — target MIDI note (keyboard). */
        midiNote?: number;
      },
    ) => void
  >(() => {});
  const activeBankRef = useRef(activeBank);
  const channelVolumesRef = useRef(channelVolumes);
  const pendingPadSampleRef = useRef<number | null>(null);
  const padSampleFileInputRef = useRef<HTMLInputElement | null>(null);
  const padSampleFolderInputRef = useRef<HTMLInputElement | null>(null);
  /** `true` = next folder pick loads Bank B with cleaned labels. */
  const folderImportBrassRoomRef = useRef(false);
  const trapKitFolderInputRef = useRef<HTMLInputElement | null>(null);
  const [trapKitBrowserOpen, setTrapKitBrowserOpen] = useState(false);
  const [trapKitBrowserFiles, setTrapKitBrowserFiles] = useState<File[]>([]);
  const [brassRoomLoading, setBrassRoomLoading] = useState(false);
  const [kitImportHint, setKitImportHint] = useState<string | null>(null);
  const kitImportHintTimerRef = useRef<number | null>(null);
  const [producerKitId, setProducerKitId] = useState<BeatLabProducerKitId>('trapDarkVault');
  const [producerKitLoading, setProducerKitLoading] = useState(false);
  const [loadingProducerKitId, setLoadingProducerKitId] = useState<BeatLabProducerKitId | null>(null);
  const producerKitLoadGenRef = useRef(0);
  const padStorePersistRef = useRef(Promise.resolve());

  useEffect(() => {
    beatLabTimeStretchRef.current = beatLabTimeStretch;
  }, [beatLabTimeStretch]);

  useEffect(() => { activeBankRef.current = activeBank; }, [activeBank]);
  useEffect(() => { channelVolumesRef.current = channelVolumes; }, [channelVolumes]);
  useEffect(() => {
    padSampleRootBpmRef.current = padSampleRootBpms;
  }, [padSampleRootBpms]);

  useEffect(() => {
    const voiceStore = loadBeatLabDrumPadVoiceStore();
    for (let bank = 0; bank < BANKS.length; bank += 1) {
      for (let pi = 0; pi < 16; pi += 1) {
        const vk = beatLabDrumPadVoiceKey(bank, pi);
        padDrumVoiceOptsRef.current[vk] = clampBeatLabDrumPadVoiceOpts(
          voiceStore[vk] ?? {},
          pi,
        );
      }
    }
  }, []);

  // Load persisted pad samples (decode once into AudioBuffers).
  useEffect(() => {
    let cancelled = false;
    const store = loadPadSampleStore();
    const keys = Object.keys(store);
    if (keys.length === 0) return;
    const ctx = getOrCreateAudioContext();
    void (async () => {
      const nextPresence: Record<string, boolean> = {};
      const nextRoots: Record<string, number> = {};
      const nextLabels: Record<string, string> = {};
      for (const k of keys) {
        if (cancelled) return;
        try {
          const st = store[k];
          const ab = storedToArrayBuffer(st);
          const buf = await ctx.decodeAudioData(ab.slice(0));
          if (cancelled) return;
          padSampleBuffersRef.current.set(k, buf);
          padSamplePlaybackOptsRef.current[k] = samplerOptsFromStored(st);
          padSampleFxRackRef.current[k] = fxRackFromStored(st);
          const chromMeta = chromaticPadMetaFromStored(st);
          if (chromMeta) {
            padSampleRootMidiRef.current[k] = chromMeta.rootMidi;
            padSampleChromaticRef.current[k] = true;
            if (typeof chromMeta.strikeMidi === 'number') {
              padSampleStrikeMidiRef.current[k] = chromMeta.strikeMidi;
            } else {
              delete padSampleStrikeMidiRef.current[k];
            }
          } else {
            delete padSampleRootMidiRef.current[k];
            delete padSampleStrikeMidiRef.current[k];
            delete padSampleChromaticRef.current[k];
          }
          nextPresence[k] = true;
          const rb = st.rootBpm;
          if (typeof rb === 'number' && rb > 0) nextRoots[k] = rb;
          const lb = typeof st.label === 'string' ? st.label.trim() : '';
          if (lb) nextLabels[k] = lb;
        } catch {
          /* skip corrupt entry */
        }
      }
      if (!cancelled) {
        setPadSamplePresence((prev) => ({ ...prev, ...nextPresence }));
        setPadSampleRootBpms((prev) => ({ ...prev, ...nextRoots }));
        setPadSampleLabels((prev) => ({ ...prev, ...nextLabels }));
      }
    })();
    return () => { cancelled = true; };
  }, [getOrCreateAudioContext]);

  // Pad hit + sequencer use this (refs keep scheduler callback stable).
  useEffect(() => {
    const MIN_TRIGGER = 0.02;
    const MIN_AUDIBLE_VELOCITY = 0.12;
    playPadSoundRef.current = (
      pi: number,
      vel: number,
      when?: number,
      notePitchSemi = 0,
      playOpts?: {
        tempoSyncRate?: number;
        beatPadVoice?: BeatLabDrumPadVoiceOpts;
        midiNote?: number;
      },
    ) => {
      const ctx = getOrCreateAudioContext();
      ctxRef.current = ctx;
      const isManual = when === undefined;
      if (isManual && ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      } else if (!isManual && ctx.state !== 'running') {
        void ctx.resume().catch(() => {});
      }
      const transportScheduled = !isManual;
      const now = ctx.currentTime;
      const scheduleWhen = isManual ? now : Math.max(when!, now + 0.001);
      const rawVelocity = Math.max(0, Math.min(1, vel / 127));
      if (rawVelocity <= MIN_TRIGGER) return;
      const shapedVelocity = Math.pow(rawVelocity, 0.7);
      const safeVelocity = Math.round(
        Math.max(MIN_AUDIBLE_VELOCITY, Math.min(1, shapedVelocity)) * 127,
      );
      const key = `${activeBankRef.current}_${pi}`;
      const buf = padSampleBuffersRef.current.get(key);
      if (buf) {
        /**
         * Session BPM only moves the grid/metronome — not sample speed/pitch.
         * Pad pitch = fine-tune / roll automation (`fineSemi`). Optional `tempoSyncRate`
         * is for SRC-BPM pad preview only (time-stretch keeps pitch stable).
         */
        const rate =
          typeof playOpts?.tempoSyncRate === 'number' && playOpts.tempoSyncRate > 0
            ? Math.min(4, Math.max(0.25, playOpts.tempoSyncRate))
            : 1;
        const useTimeStretch = rate !== 1 || beatLabTimeStretchRef.current;
        let bag = padSampleActiveStoppersRef.current.get(key);
        if (!bag) {
          bag = new Set();
          padSampleActiveStoppersRef.current.set(key, bag);
        }
        if (isManual && bag.size > 0) {
          for (const entry of [...bag]) {
            try {
              entry.stop();
            } catch {
              /* */
            }
          }
        }
        let voiceStop: () => void = () => {};
        const voiceEntry = { stop: () => voiceStop(), when: scheduleWhen };
        const afterVoice = () => {
          bag!.delete(voiceEntry);
          if (bag!.size === 0) padSampleActiveStoppersRef.current.delete(key);
        };
        let sampOpts =
          padSamplePlaybackOptsRef.current[key] ?? defaultPadSamplerPlaybackOpts();
        if (playOpts?.beatPadVoice) {
          sampOpts = beatLabDrumVoiceToSamplerOpts(playOpts.beatPadVoice, { ...sampOpts });
        }
        const chromatic = padSampleChromaticRef.current[key] === true;
        const rootMidi = padSampleRootMidiRef.current[key] ?? 60;
        let chromaticDetuneCents = 0;
        const useTimeStretchLocal = chromatic ? true : useTimeStretch;
        let optsWithPitch: PadSamplerPlaybackOpts;
        if (chromatic) {
          const defaultStrike =
            padSampleStrikeMidiRef.current[key] ?? rootMidi;
          const targetMidi =
            typeof playOpts?.midiNote === 'number' && Number.isFinite(playOpts.midiNote)
              ? Math.max(0, Math.min(127, Math.round(playOpts.midiNote)))
              : defaultStrike;
          const fine = sampOpts.fineSemi ?? 0;
          chromaticDetuneCents = (targetMidi - rootMidi + fine) * 100;
          chromaticDetuneCents = Math.max(-12000, Math.min(12000, chromaticDetuneCents));
          optsWithPitch = { ...sampOpts, fineSemi: 0 };
        } else {
          optsWithPitch = {
            ...sampOpts,
            fineSemi: Math.max(-12, Math.min(12, (sampOpts.fineSemi ?? 0) + notePitchSemi)),
          };
        }
        const fxRack = padSampleFxRackRef.current[key] ?? defaultPadSamplerFxRack();
        voiceStop = playPadSampleBuffer(
          ctx,
          buf,
          creationPadMixerCh(pi),
          safeVelocity,
          scheduleWhen,
          channelVolumesRef.current,
          rate,
          afterVoice,
          optsWithPitch,
          useTimeStretchLocal,
          fxRack,
          Math.max(1, bpmRef.current),
          isManual,
          chromaticDetuneCents,
        );
        bag.add(voiceEntry);
        if (transportScheduled) {
          /** Catch-up only — scheduler fix removed double-fires; delayed mono choke was cutting steady grid hits. */
          const now2 = ctx.currentTime;
          if (scheduleWhen <= now2 + 0.04) {
            for (const entry of [...bag]) {
              if (entry === voiceEntry) continue;
              if (entry.when <= now2 + 0.04) {
                try {
                  entry.stop();
                } catch {
                  /* */
                }
                bag.delete(entry);
              }
            }
          }
        }
      } else {
        const stopDrum = triggerChannel(
          creationPadMixerCh(pi),
          safeVelocity,
          isManual ? undefined : scheduleWhen,
        );
        if (stopDrum) {
          const drumKey = '__beat_lab_builtin_drums__';
          let drumBag = padSampleActiveStoppersRef.current.get(drumKey);
          if (!drumBag) {
            drumBag = new Set();
            padSampleActiveStoppersRef.current.set(drumKey, drumBag);
          }
          const drumEntry = { stop: stopDrum, when: scheduleWhen };
          const wrappedStop = () => {
            drumBag!.delete(drumEntry);
            if (drumBag!.size === 0) padSampleActiveStoppersRef.current.delete(drumKey);
            stopDrum();
          };
          drumEntry.stop = wrappedStop;
          drumBag.add(drumEntry);
        }
      }
    };
  }, [triggerChannel, getOrCreateAudioContext]);

  // Shared DAW session: manifest + per-channel sequencer data ? Studio tracks/clips (audioTrack === mixer CH).
  useEffect(() => {
    const meta = computeUsedCreationChannelMeta(banks, CREATION_PAD_CHANNELS_FIXED, false);
    writeCreationChannelManifestToStorage(meta);
    const maxCols = patternColsDrums;
    const payload = {
      bpm,
      drumLoopBars: loopBars,
      measuresPerBar: qpb,
      drumStepSubdiv,
      padChannels: CREATION_PAD_CHANNELS_FIXED,
      activeBank,
      subOn: false,
      drums: (banks[activeBank]?.drums ?? []).map((row) => row.slice(0, maxCols)),
    };
    try {
      localStorage.setItem(CREATION_STATION_CLIP_DATA_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(DA_SESSION_TRACKS_SYNC_EVENT));
  }, [banks, bpm, loopBars, activeBank, qpb, drumStepSubdiv, patternColsDrums, CREATION_BACKEND_BLANK]);

  // Re-sync Studio [CS] clips when pad samples load/clear (payload unchanged; Studio reads pad sample store).
  useEffect(() => {
    window.dispatchEvent(new Event(DA_SESSION_TRACKS_SYNC_EVENT));
  }, [padSamplePresence]);

  const drumScrollRef  = useRef<HTMLDivElement>(null);
  /** Single vertical scroll — lane pads + grid rows move together. */
  const drumVerticalScrollRef = useRef<HTMLDivElement>(null);
  const pianoScrollRef = useRef<HTMLDivElement>(null);

  const onDrumVerticalScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (e.isTrusted && !beatLabProgrammaticScrollRef.current) {
      beatLabFollowScrollPausedRef.current = true;
    }
    const hScroll = drumScrollRef.current;
    if (hScroll) {
      beatLabDrumScrollViewportWRef.current = Math.max(1, hScroll.clientWidth);
    }
  }, []);

  const onDrumGridHScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    beatLabDrumScrollViewportWRef.current = Math.max(1, e.currentTarget.clientWidth);
    if (e.isTrusted && !beatLabProgrammaticScrollRef.current) {
      beatLabFollowScrollPausedRef.current = true;
    }
    const roll = beatLabRollScrollRef.current;
    if (roll && beatLabRollScrollSync.current !== 'roll') {
      beatLabRollScrollSync.current = 'drum';
      roll.scrollLeft = e.currentTarget.scrollLeft;
      queueMicrotask(() => {
        beatLabRollScrollSync.current = null;
      });
    }
  }, []);

  const onBeatLabRollScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (e.isTrusted && !beatLabProgrammaticScrollRef.current) {
      beatLabFollowScrollPausedRef.current = true;
    }
    const grid = drumScrollRef.current;
    if (!grid || beatLabRollScrollSync.current === 'drum') return;
    beatLabRollScrollSync.current = 'roll';
    grid.scrollLeft = e.currentTarget.scrollLeft;
    queueMicrotask(() => {
      beatLabRollScrollSync.current = null;
    });
  }, []);

  /** Ruler highlight: updates only when isolated HUD changes measure (avoids 60fps full-screen repaints). */
  const _creationRulerPulse = useSyncExternalStore(
    subscribeCreationRulerBeat,
    getCreationRulerSeq,
    () => 0,
  );
  void _creationRulerPulse;

  const transportBeatEpoch = useSyncExternalStore(
    subscribeCreationTransportBeat,
    getCreationTransportBeatEpoch,
    () => 0,
  );
  void transportBeatEpoch;

  /** Same subdiv the audio scheduler + playline use (`drumStepSubdivRef`) ? avoids one-frame HUD/grid mismatch after snap changes. */
  const subdivHud = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));

  /**
   * Quarter index of **loopStartTick** ? matches `floor(tick / PPQ)`; avoids
   * `(loopStartBar - 1) * round(qpb)` when `ticksPerBar` and PPQ don?t line up with rounded quarters.
   */
  const drumColOffset = Math.floor(
    Math.max(0, loopOnRef.current ? loopStartBeatRef.current * subdivHud : 0) + 1e-8,
  );
  const drumColOffsetRef = useRef(drumColOffset);
  drumColOffsetRef.current = drumColOffset;

  /** 4/4 Beat Lab: one bar = four quarter-note measures (grid lines + MEASURES row). */
  const beatLabQpb = MEASURES_PER_BAR;

  const creationDrumRulerHeaderLabels = useMemo(() => {
    const labels: number[] = [];
    const colsPerBar = Math.max(1, beatLabQpb * drumStepSubdivUi);
    const baseBar = Math.floor(drumColOffset / colsPerBar);
    let acc = 0;
    for (let i = 0; i < creationDrumRulerCounts.length; i++) {
      const relBar = Math.floor((drumColOffset + acc) / colsPerBar) - baseBar;
      labels.push(loopStartBar + relBar);
      acc += creationDrumRulerCounts[i]!;
    }
    return labels;
  }, [creationDrumRulerCounts, drumColOffset, drumStepSubdivUi, loopStartBar]);

  const drumPatternColToDawBar = useCallback(
    (ci: number) => {
      const colsPerBar = Math.max(1, beatLabQpb * subdivHud);
      return loopStartBar + Math.floor(Math.max(0, ci) / colsPerBar);
    },
    [loopStartBar, beatLabQpb, subdivHud],
  );

  const qpbHud = Math.max(2, Math.min(16, Math.round(qpb)));

  const currentDrums = banks[activeBank]?.drums ?? emptyDrums();
  const currentMidiRoll = banks[activeBank]?.midiRoll ?? [];
  const currentMelodicInstruments = useMemo(
    () =>
      banks[activeBank]?.melodicInstruments ??
      normalizeBeatLabMelodicInstruments(undefined),
    [activeBank, banks],
  );
  const melodicInstrumentsRef = useRef(currentMelodicInstruments);
  melodicInstrumentsRef.current = currentMelodicInstruments;
  const currentMelodicSynthPresetIds = useMemo(
    () =>
      banks[activeBank]?.melodicSynthPresetIds ??
      normalizeBeatLabMelodicSynthPresetIds(undefined),
    [activeBank, banks],
  );
  const currentMelodicSynthVoices = useMemo(
    () =>
      banks[activeBank]?.melodicSynthVoices ??
      normalizeBeatLabBassSynthVoiceParams(undefined, currentMelodicSynthPresetIds),
    [activeBank, banks, currentMelodicSynthPresetIds],
  );
  const melodicSynthPresetIdsRef = useRef(currentMelodicSynthPresetIds);
  melodicSynthPresetIdsRef.current = currentMelodicSynthPresetIds;
  const melodicSynthVoicesRef = useRef(currentMelodicSynthVoices);
  melodicSynthVoicesRef.current = currentMelodicSynthVoices;

  const beatLabMixerPadStripLabels = useMemo(
    () =>
      PAD_NAMES.map((_, i) =>
        beatLabLaneDisplayLabel(i, padSampleLabels[padSampleKey(activeBank, i)]),
      ),
    [activeBank, padSampleLabels],
  );

  const beatLabMelodicMixerStripLabels = useMemo(
    () =>
      currentMelodicSynthPresetIds.map((id) => beatLabBassSynthPresetById(id).name),
    [currentMelodicSynthPresetIds],
  );

  const beatLabMixerOverlayNode = useMemo(
    () => (
      <BeatLabMixerOverlay
        open={beatLabMixerOpen}
        onClose={() => {
          setBeatLabMixerOpen(false);
          setBeatLabMixerPadsOnly(false);
        }}
        padsOnly={beatLabMixerPadsOnly}
        spreadTrackActive={beatPadsSpreadActive}
        spreadTrackLabel={beatPadsSpreadTrack?.baseLabel ?? 'Spread'}
        spreadTrackMixerChannel={beatPadsSpreadTrack?.mixerChannel ?? 17}
        padStripLabels={beatLabMixerPadStripLabels}
        melodicInstrumentIds={currentMelodicInstruments}
        melodicStripLabels={
          beatLabDeckFocus === 'synth2' ? beatLabMelodicMixerStripLabels : undefined
        }
        channelVolumes={channelVolumes}
        setChannelVolume={setChannelVolume}
        masterOutputLinear={masterOutputLinear}
        onMasterVolumeChange={onMasterVolumeChange}
      />
    ),
    [
      beatLabDeckFocus,
      beatLabMelodicMixerStripLabels,
      beatLabMixerOpen,
      beatLabMixerPadsOnly,
      beatPadsSpreadActive,
      beatPadsSpreadTrack?.baseLabel,
      beatLabMixerPadStripLabels,
      channelVolumes,
      currentMelodicInstruments,
      masterOutputLinear,
      onMasterVolumeChange,
      setChannelVolume,
    ],
  );

  const patchMelodicInstrument = useCallback((slotIndex: number, instrumentId: string) => {
    setBanks((prev) =>
      prev.map((b, i) => {
        if (i !== activeBank) return b;
        const next = normalizeBeatLabMelodicInstruments(b.melodicInstruments);
        next[slotIndex] = instrumentId;
        return { ...b, melodicInstruments: next };
      }),
    );
  }, [activeBank]);
  const patchMelodicSynthPreset = useCallback((slotIndex: number, presetId: string) => {
    setBanks((prev) =>
      prev.map((b, i) => {
        if (i !== activeBank) return b;
        const next = normalizeBeatLabMelodicSynthPresetIds(b.melodicSynthPresetIds);
        next[slotIndex] = presetId;
        return { ...b, melodicSynthPresetIds: next };
      }),
    );
  }, [activeBank]);
  const patchMelodicSynthVoice = useCallback(
    (slotIndex: number, nextPatch: Partial<ReturnType<typeof beatLabBassSynthVoiceParamsFromPresetId>>) => {
      setBanks((prev) =>
        prev.map((b, i) => {
          if (i !== activeBank) return b;
          const ids = normalizeBeatLabMelodicSynthPresetIds(b.melodicSynthPresetIds);
          const voices = normalizeBeatLabBassSynthVoiceParams(b.melodicSynthVoices, ids);
          voices[slotIndex] = { ...voices[slotIndex], ...nextPatch };
          return { ...b, melodicSynthVoices: voices };
        }),
      );
    },
    [activeBank],
  );
  const loadMelodicSynthVoiceFromPreset = useCallback(
    (slotIndex: number, presetId: string) => {
      setBanks((prev) =>
        prev.map((b, i) => {
          if (i !== activeBank) return b;
          const ids = normalizeBeatLabMelodicSynthPresetIds(b.melodicSynthPresetIds);
          const voices = normalizeBeatLabBassSynthVoiceParams(b.melodicSynthVoices, ids);
          const prevOut = voices[slotIndex]?.outputLevel;
          voices[slotIndex] = {
            ...beatLabBassSynthVoiceParamsFromPresetId(presetId),
            outputLevel: prevOut,
          };
          return { ...b, melodicSynthVoices: voices };
        }),
      );
    },
    [activeBank],
  );

  const currentMidiRollRef = useRef(currentMidiRoll);
  currentMidiRollRef.current = currentMidiRoll;

  const currentVolAutomation = useMemo(
    () => normalizeBeatLabVolAutomation(banks[activeBank]?.volAutomation, patternColsDrums),
    [banks, activeBank, patternColsDrums],
  );
  const currentVolAutomationRef = useRef(currentVolAutomation);
  currentVolAutomationRef.current = currentVolAutomation;

  const currentPitchAutomation = useMemo(
    () => normalizeBeatLabPitchAutomation(banks[activeBank]?.pitchAutomation, patternColsDrums),
    [banks, activeBank, patternColsDrums],
  );
  const currentPitchAutomationRef = useRef(currentPitchAutomation);
  currentPitchAutomationRef.current = currentPitchAutomation;

  const beatLabSynth2TransportDataRef = useRef<BeatLabSynth2TransportData>({
    currentMidiRollRef,
    channelVolumesRef,
    currentPitchAutomationRef,
    currentVolAutomationRef,
    melodicInstrumentsRef,
    melodicSynthPresetIdsRef,
    melodicSynthVoicesRef,
    beatLabSynth2BassLaneRef,
    beatLabSynth2HarmonyLaneRef,
    beatLabSynth2PianoInstrumentRef,
    beatLabSynthChordRailRef,
    patternColsDrumsRef,
    patternColsDrumsBeatsRef,
    drumStepSubdivRef,
    beatsPerBarRef,
    loopOnRef,
    loopStartBeatRef,
    loopEndBeatRef,
    colWidthRef,
    bpmRef,
    measuresPerBar: MEASURES_PER_BAR,
  });
  beatLabSynth2TransportDataRef.current = {
    currentMidiRollRef,
    channelVolumesRef,
    currentPitchAutomationRef,
    currentVolAutomationRef,
    melodicInstrumentsRef,
    melodicSynthPresetIdsRef,
    melodicSynthVoicesRef,
    beatLabSynth2BassLaneRef,
    beatLabSynth2HarmonyLaneRef,
    beatLabSynth2PianoInstrumentRef,
    beatLabSynthChordRailRef,
    patternColsDrumsRef,
    patternColsDrumsBeatsRef,
    drumStepSubdivRef,
    beatsPerBarRef,
    loopOnRef,
    loopStartBeatRef,
    loopEndBeatRef,
    colWidthRef,
    bpmRef,
    measuresPerBar: MEASURES_PER_BAR,
  };

  const beatLabSynth2TransportActive =
    beatLabDeckFocus === 'synth2' && tab === 'grid' && isScreenActive;

  const beatLabMainTransportPlaying =
    transport === 'playing' || transport === 'recording';
  const isPlaybackOrRecord = beatLabMainTransportPlaying;
  const isRecording = transport === 'recording';
  const isCounting = false;
  const isPaused = transport === 'paused';
  const transportNeedsPause = isPlaybackOrRecord || isCounting;
  const isPlaying = isPlaybackOrRecord;
  const transportNotStopped = transport !== 'stopped';
  isPlaybackOrRecordRef.current = isPlaybackOrRecord;
  transportNotStoppedRef.current = transportNotStopped;

  const creationTransportKeysRef = useRef({
    needsPause: false,
    start: () => {},
    pause: () => {},
    stop: () => {},
  });
  creationTransportKeysRef.current = {
    needsPause: transportNeedsPause,
    start: () => void startTransport('play'),
    pause: () => void pauseTransport(),
    stop: () => stopTransport(),
  };
  const keyboardShortcutsEnabledRef = useRef(settings.keyboardShortcutsEnabled);
  keyboardShortcutsEnabledRef.current = settings.keyboardShortcutsEnabled;

  const displayBeatLive = displayBeatRef.current;
  const transportStepIndexLive = Math.floor(Math.max(0, displayBeatLive * subdivHud) + 1e-8);

  const activeTransportCursorBeat = cursorBeatRef.current;
  /** SE2 playhead split: WAAPI owns the moving line while playing; React column tint only when halted. */
  const visualSyncCol = creationPatternColFromDisplayBeat(
    Math.max(0, activeTransportCursorBeat),
    subdivHud,
    patternColsDrums,
    loopOnRef.current,
    loopStartBeatRef.current,
    loopEndBeatRef.current,
    patternPlayModeRef.current,
  );

  /** When not playing, keep SE2 Bars/Time in sync with scrub / BPM (rAF pump only runs while `runningRef`). */
  useEffect(() => {
    if (tab !== 'grid') return;
    if (isPlaybackOrRecord) return;
    const beat = displayBeatRef.current;
    paintCreationSe2TransportReadouts(Math.max(0, beat), isPaused);
  }, [
    tab,
    isPlaybackOrRecord,
    isPaused,
    bpm,
    paintCreationSe2TransportReadouts,
  ]);

  let activeCol = -1;
  if (transportNotStopped && !isPlaying) activeCol = visualSyncCol;
  const beatLabSynthPlayheadStepCol =
    activeCol >= 0 ? activeCol : visualSyncCol;

  useEffect(() => {
    if (!transportNotStopped) {
      publishCreationRulerBeat(null);
    }
  }, [transportNotStopped]);

  const patchVolAutomation = useCallback(
    (next: number[]) => {
      setBanks((prev) =>
        prev.map((b, i) => (i === activeBank ? { ...b, volAutomation: next } : b)),
      );
    },
    [activeBank],
  );

  const patchPitchAutomation = useCallback(
    (next: number[]) => {
      setBanks((prev) =>
        prev.map((b, i) => (i === activeBank ? { ...b, pitchAutomation: next } : b)),
      );
    },
    [activeBank],
  );

  const pitchAutomationClipboardRef = useRef<number[] | null>(null);
  const pitchAutomationSelectionRef = useRef<BeatLabPitchAutomationSelection | null>(null);

  const banksRef = useRef(banks);
  banksRef.current = banks;
  const beatLabUndoStackRef = useRef<Bank[][]>([]);
  const beatLabRedoStackRef = useRef<Bank[][]>([]);
  const beatLabUndoGestureRef = useRef(false);
  const [beatLabHistoryRev, setBeatLabHistoryRev] = useState(0);
  /** Loop DUP undo — restores pattern + loop length (grid undo alone cannot revert DUP). */
  const beatLabDupUndoStackRef = useRef<BeatLabHistorySnapshot<Bank>[]>([]);
  const [beatLabDupUndoRev, setBeatLabDupUndoRev] = useState(0);

  const captureCurrentBeatLabSnapshot = useCallback((): BeatLabHistorySnapshot<Bank> => {
    return captureBeatLabHistorySnapshot({
      banks: banksRef.current,
      bankPatternSlots: bankPatternSlotsRef.current,
      loopBars: loopBarsRef.current,
      loopStartBeat: loopStartBeatRef.current,
      loopEndBeat: loopEndBeatRef.current,
      loopOn: loopOnRef.current,
    });
  }, []);

  const pushBeatLabUndo = useCallback(() => {
    beatLabUndoStackRef.current = [
      ...beatLabUndoStackRef.current.slice(-(BEAT_LAB_UNDO_STACK_MAX - 1)),
      cloneBeatLabBanks(banksRef.current),
    ];
    beatLabRedoStackRef.current = [];
    setBeatLabHistoryRev((n) => n + 1);
  }, []);

  const beginBeatLabUndoGesture = useCallback(() => {
    if (!beatLabUndoGestureRef.current) {
      pushBeatLabUndo();
      beatLabUndoGestureRef.current = true;
    }
  }, [pushBeatLabUndo]);

  const endBeatLabUndoGesture = useCallback(() => {
    beatLabUndoGestureRef.current = false;
  }, []);

  const beatLabPitchColsPerBar = Math.max(1, beatLabQpb * subdivHud);

  const copyPitchAutomation = useCallback(() => {
    const vals = currentPitchAutomationRef.current;
    const sel = pitchAutomationSelectionRef.current;
    if (sel) {
      pitchAutomationClipboardRef.current = beatLabCopyAutomationSegment(
        vals,
        sel.fineLo,
        sel.fineHi,
      );
      return;
    }
    const col = Math.max(0, activeCol >= 0 ? activeCol : 0);
    const fineStart = beatLabBarFineStart(col, beatLabPitchColsPerBar);
    const fineLen = beatLabFineColsPerBar(beatLabPitchColsPerBar);
    pitchAutomationClipboardRef.current = beatLabCopyAutomationSegment(
      vals,
      fineStart,
      fineStart + fineLen - 1,
    );
  }, [activeCol, beatLabPitchColsPerBar]);

  const pastePitchAutomation = useCallback(() => {
    const clip = pitchAutomationClipboardRef.current;
    if (!clip?.length) return;
    pushBeatLabUndo();
    const col = Math.max(0, activeCol >= 0 ? activeCol : 0);
    const fineDest = beatLabBarFineStart(col, beatLabPitchColsPerBar);
    const next = beatLabPasteAutomationSegment(
      currentPitchAutomationRef.current,
      clip,
      fineDest,
    );
    patchPitchAutomation(next);
  }, [activeCol, beatLabPitchColsPerBar, patchPitchAutomation, pushBeatLabUndo]);

  const beatLabUndo = useCallback(() => {
    const stack = beatLabUndoStackRef.current;
    if (!stack.length) return;
    const snap = stack[stack.length - 1]!;
    beatLabRedoStackRef.current = [
      ...beatLabRedoStackRef.current.slice(-(BEAT_LAB_UNDO_STACK_MAX - 1)),
      cloneBeatLabBanks(banksRef.current),
    ];
    beatLabUndoStackRef.current = stack.slice(0, -1);
    setBanks(cloneBeatLabBanks(snap));
    setBeatLabHistoryRev((n) => n + 1);
  }, []);

  const beatLabRedo = useCallback(() => {
    const stack = beatLabRedoStackRef.current;
    if (!stack.length) return;
    const snap = stack[stack.length - 1]!;
    beatLabUndoStackRef.current = [
      ...beatLabUndoStackRef.current.slice(-(BEAT_LAB_UNDO_STACK_MAX - 1)),
      cloneBeatLabBanks(banksRef.current),
    ];
    beatLabRedoStackRef.current = stack.slice(0, -1);
    setBanks(cloneBeatLabBanks(snap));
    setBeatLabHistoryRev((n) => n + 1);
  }, []);

  const canBeatLabUndo = useMemo(() => {
    void beatLabHistoryRev;
    return beatLabUndoStackRef.current.length > 0;
  }, [beatLabHistoryRev]);

  const canBeatLabRedo = useMemo(() => {
    void beatLabHistoryRev;
    return beatLabRedoStackRef.current.length > 0;
  }, [beatLabHistoryRev]);

  useEffect(() => {
    beatLabUndoStackRef.current = [];
    beatLabRedoStackRef.current = [];
    setBeatLabHistoryRev((n) => n + 1);
  }, [patternColsDrums]);

  const resetBeatLabVolAutomation = useCallback(() => {
    pushBeatLabUndo();
    const next = normalizeBeatLabVolAutomation(undefined, patternColsDrums);
    setBanks((prev) =>
      prev.map((b, i) => (i === activeBank ? { ...b, volAutomation: next } : b)),
    );
  }, [activeBank, patternColsDrums, pushBeatLabUndo]);

  const resetBeatLabPitchAutomation = useCallback(() => {
    pushBeatLabUndo();
    const next = normalizeBeatLabPitchAutomation(undefined, patternColsDrums);
    setBanks((prev) =>
      prev.map((b, i) => (i === activeBank ? { ...b, pitchAutomation: next } : b)),
    );
  }, [activeBank, patternColsDrums, pushBeatLabUndo]);

  const patchActiveBankMidiRoll = useCallback((next: BeatLabMidiNote[]) => {
    const roll = normalizeBeatLabMidiRoll(next);
    setBanks((prev) =>
      prev.map((b, i) => (i === activeBank ? { ...b, midiRoll: roll } : b)),
    );
  }, [activeBank]);

  const patchActiveBankMidiRollWithUndo = useCallback(
    (next: BeatLabMidiNote[]) => {
      pushBeatLabUndo();
      patchActiveBankMidiRoll(next);
    },
    [patchActiveBankMidiRoll, pushBeatLabUndo],
  );

  const toggleBeatLabMidiRollNote = useCallback(
    (lane: number, col: number) => {
      if (CREATION_BACKEND_BLANK) return;
      const existing = currentMidiRoll.find((n) => n.lane === lane && n.col === col);
      if (existing) {
        patchActiveBankMidiRollWithUndo(
          currentMidiRoll.filter((n) => !(n.lane === lane && n.col === col)),
        );
        return;
      }
      patchActiveBankMidiRollWithUndo([
        ...currentMidiRoll,
        { lane, col, len: 1, vel: PAD_VEL[lane] ?? 100 },
      ]);
    },
    [currentMidiRoll, patchActiveBankMidiRollWithUndo],
  );

  const setBeatLabMidiRollStep = useCallback(
    (lane: number, col: number, on: boolean) => {
      if (CREATION_BACKEND_BLANK) return;
      const existing = currentMidiRoll.find((n) => n.lane === lane && n.col === col);
      if (on) {
        if (!existing) {
          patchActiveBankMidiRoll([
            ...currentMidiRoll,
            { lane, col, len: 1, vel: PAD_VEL[lane] ?? 100 },
          ]);
        }
        return;
      }
      if (existing) {
        patchActiveBankMidiRoll(currentMidiRoll.filter((n) => !(n.lane === lane && n.col === col)));
      }
    },
    [currentMidiRoll, patchActiveBankMidiRoll],
  );

  const toggleBeatLabMelodicSynthNote = useCallback(
    (lane: number, col: number, midi: number) => {
      if (CREATION_BACKEND_BLANK) return;
      const semi = beatLabPitchSemiForMidi(lane, midi);
      const existing = currentMidiRoll.find(
        (n) => n.lane === lane && n.col === col && (n.pitchSemi ?? 0) === semi,
      );
      if (existing) {
        patchActiveBankMidiRollWithUndo(
          currentMidiRoll.filter(
            (n) => !(n.lane === lane && n.col === col && (n.pitchSemi ?? 0) === semi),
          ),
        );
        return;
      }
      patchActiveBankMidiRollWithUndo([
        ...currentMidiRoll,
        { lane, col, len: 1, vel: 100, pitchSemi: semi },
      ]);
    },
    [currentMidiRoll, patchActiveBankMidiRollWithUndo],
  );

  const setBeatLabMelodicSynthNote = useCallback(
    (lane: number, col: number, midi: number, on: boolean) => {
      if (CREATION_BACKEND_BLANK) return;
      const semi = beatLabPitchSemiForMidi(lane, midi);
      const existing = currentMidiRoll.find(
        (n) => n.lane === lane && n.col === col && (n.pitchSemi ?? 0) === semi,
      );
      if (on) {
        if (!existing) {
          patchActiveBankMidiRoll([
            ...currentMidiRoll,
            { lane, col, len: 1, vel: 100, pitchSemi: semi },
          ]);
        }
        return;
      }
      if (existing) {
        patchActiveBankMidiRoll(
          currentMidiRoll.filter(
            (n) => !(n.lane === lane && n.col === col && (n.pitchSemi ?? 0) === semi),
          ),
        );
      }
    },
    [currentMidiRoll, patchActiveBankMidiRoll],
  );

  const previewBeatLabMelodicMidi = useCallback((lane: number, midi: number) => {
    if (CREATION_BACKEND_BLANK) return;
    setSelectedBeatLabLane(lane);
    const ctx = getOrCreateAudioContext();
    void ctx.resume().then(() => {
      const slot = beatLabMelodicSlotIndex(lane);
      const when = ctx.currentTime + 0.01;
      const channelVolumes = channelVolumesRef.current;
      const bassLane = beatLabSynth2BassLaneRef.current;
      const harmonyLane = beatLabSynth2HarmonyLaneRef.current;
      if (beatLabSynth2IsHarmonyLane(lane, harmonyLane)) {
        const pianoId = beatLabSynth2PianoInstrumentRef.current;
        previewBeatLabMelodicNote(ctx, {
          lane,
          midi,
          velocity: 100,
          when,
          durationSec: 0.45,
          channelVolumes,
          instrumentId: pianoId,
          instrumentGain: beatLabSynth2PianoRollInstrumentGain(pianoId),
        });
        return;
      }
      if (beatLabSynth2IsBassLane(lane, bassLane)) {
        const bassSlot = beatLabMelodicSlotIndex(bassLane);
        const presetId =
          melodicSynthPresetIdsRef.current[bassSlot] ?? BEAT_LAB_DEFAULT_SYNTH_PRESET_ID;
        const voice =
          melodicSynthVoicesRef.current[bassSlot] ??
          beatLabBassSynthVoiceParamsFromPresetId(presetId);
        previewBeatLabSynthV2Note(ctx, {
          lane,
          midi,
          velocity: 100,
          when,
          durationSec: 0.45,
          channelVolumes,
          voice,
          bpm: bpmRef.current,
        });
        return;
      }
      previewBeatLabMelodicNote(ctx, {
        lane,
        midi,
        velocity: 100,
        when,
        durationSec: 0.45,
        channelVolumes,
        instrumentId:
          melodicInstrumentsRef.current[slot] ??
          BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[slot] ??
          'acoustic_grand_piano',
      });
    });
  }, [getOrCreateAudioContext]);

  const synthV2AuditionMidiRef = useRef<number | null>(null);

  const synthV2VoiceForLane = useCallback((lane: number) => {
    const slot = beatLabMelodicSlotIndex(lane);
    const presetId = melodicSynthPresetIdsRef.current[slot] ?? BEAT_LAB_DEFAULT_SYNTH_PRESET_ID;
    return (
      melodicSynthVoicesRef.current[slot] ??
      beatLabBassSynthVoiceParamsFromPresetId(presetId)
    );
  }, []);

  const previewBeatLabSynthV2Lane = useCallback(
    (lane: number, midi?: number) => {
      if (CREATION_BACKEND_BLANK) return;
      setSelectedBeatLabLane(lane);
      const ctx = getOrCreateAudioContext();
      void ctx.resume().then(() => {
        const note =
          midi ?? synthV2AuditionMidiRef.current ?? beatLabMelodicSynthV2AuditionPitch(lane);
        if (midi != null) synthV2AuditionMidiRef.current = midi;
        previewBeatLabSynthV2Note(ctx, {
          lane,
          midi: note,
          velocity: 100,
          when: ctx.currentTime + 0.01,
          channelVolumes: channelVolumesRef.current,
          voice: synthV2VoiceForLane(lane),
          bpm: bpmRef.current,
        });
      });
    },
    [getOrCreateAudioContext, synthV2VoiceForLane],
  );

  const startSynthV2Audition = useCallback(
    (lane: number) => {
      if (CREATION_BACKEND_BLANK) return;
      const ctx = getOrCreateAudioContext();
      void ctx.resume().then(() => {
        const midi =
          synthV2AuditionMidiRef.current ?? beatLabMelodicSynthV2AuditionPitch(lane);
        startBeatLabSynthV2HeldPreview(ctx, {
          lane,
          midi,
          velocity: 100,
          channelVolumes: channelVolumesRef.current,
          voice: synthV2VoiceForLane(lane),
          bpm: bpmRef.current,
        });
      });
    },
    [getOrCreateAudioContext, synthV2VoiceForLane],
  );

  const touchSynthV2Audition = useCallback(
    (lane: number) => {
      if (CREATION_BACKEND_BLANK) return;
      const ctx = getOrCreateAudioContext();
      void ctx.resume().then(() => {
        const midi =
          synthV2AuditionMidiRef.current ?? beatLabMelodicSynthV2AuditionPitch(lane);
        touchBeatLabSynthV2HeldPreview(ctx, {
          lane,
          midi,
          velocity: 100,
          channelVolumes: channelVolumesRef.current,
          voice: synthV2VoiceForLane(lane),
          bpm: bpmRef.current,
        });
      });
    },
    [getOrCreateAudioContext, synthV2VoiceForLane],
  );

  const stopSynthV2Audition = useCallback((lane: number) => {
    stopBeatLabSynthV2HeldPreview(lane);
  }, []);

  useMidiInputRoute(MIDI_INPUT_ROUTES.beatLab, {
    enabled: isScreenActive && tab === 'grid',
    onNoteOn: (e) => {
      const bank = activeBankRef.current;
      const padFromDrumMap = midiDrumNoteToPadIndex(e.note);
      const chromKey = (pi: number) => `${bank}_${pi}`;

      if (beatPadsMachineOpenRef.current) {
        const selected = selectedBeatLabLaneRef.current;
        if (
          selected != null
          && selected >= 0
          && selected < 16
          && padSampleChromaticRef.current[chromKey(selected)]
        ) {
          playPadSoundRef.current?.(selected, e.velocity, undefined, 0, { midiNote: e.note });
          return;
        }
        if (padSampleChromaticRef.current[chromKey(padFromDrumMap)]) {
          playPadSoundRef.current?.(padFromDrumMap, e.velocity, undefined, 0, { midiNote: e.note });
          return;
        }
      }

      if (e.channel === 9) {
        playPadSoundRef.current?.(padFromDrumMap, e.velocity);
        return;
      }
      const lane = selectedBeatLabLaneRef.current;
      if (lane != null && lane >= BEAT_LAB_MELODIC_LANE_START) {
        previewBeatLabSynthV2Lane(lane, e.note);
        return;
      }
      playPadSoundRef.current?.(midiDrumNoteToPadIndex(e.note), e.velocity);
    },
    onNoteOff: (e) => {
      if (e.channel === 9) return;
      const lane = selectedBeatLabLaneRef.current;
      if (lane != null && lane >= BEAT_LAB_MELODIC_LANE_START) {
        stopSynthV2Audition(lane);
      }
    },
  });

  const [synthV2PlayingMidis, setSynthV2PlayingMidis] = useState<ReadonlySet<number>>(() => new Set());
  clearSynthV2PlayingMidisRef.current = () => setSynthV2PlayingMidis(new Set());
  const harmonyPianoKeyStopRef = useRef<(() => void) | null>(null);
  const harmonyPianoHighlightTimerRef = useRef<number | null>(null);

  const clearHarmonyPianoHighlightTimer = useCallback(() => {
    if (harmonyPianoHighlightTimerRef.current != null) {
      window.clearTimeout(harmonyPianoHighlightTimerRef.current);
      harmonyPianoHighlightTimerRef.current = null;
    }
  }, []);

  const pulseHarmonyPianoKeyHighlight = useCallback(
    (midis: number[], holdMs: number) => {
      if (midis.length === 0) return;
      const clampedMs = Math.max(60, Math.min(420, Math.round(holdMs)));
      setSynthV2PlayingMidis(new Set(midis));
      clearHarmonyPianoHighlightTimer();
      harmonyPianoHighlightTimerRef.current = window.setTimeout(() => {
        setSynthV2PlayingMidis(new Set());
        harmonyPianoHighlightTimerRef.current = null;
      }, clampedMs);
    },
    [clearHarmonyPianoHighlightTimer],
  );

  const sustainHarmonyPianoKey = useCallback(
    (lane: number, midi: number) => {
      if (CREATION_BACKEND_BLANK) return;
      setSelectedBeatLabLane(lane);
      clearHarmonyPianoHighlightTimer();
      setSynthV2PlayingMidis(new Set([midi]));
      const ctx = getOrCreateAudioContext();
      void ctx.resume().then(async () => {
        harmonyPianoKeyStopRef.current?.();
        harmonyPianoKeyStopRef.current = null;
        const pianoId = beatLabSynth2PianoInstrumentRef.current;
        const stop = await startBeatLabMelodicPreview(ctx, {
          lane,
          midi,
          velocity: 100,
          when: ctx.currentTime + 0.005,
          durationSec: 1.1,
          channelVolumes: channelVolumesRef.current,
          instrumentId: pianoId,
          instrumentGain: beatLabSynth2PianoRollInstrumentGain(pianoId),
        });
        harmonyPianoKeyStopRef.current = stop;
      });
    },
    [clearHarmonyPianoHighlightTimer, getOrCreateAudioContext],
  );

  const releaseHarmonyPianoKey = useCallback(() => {
    harmonyPianoKeyStopRef.current?.();
    harmonyPianoKeyStopRef.current = null;
    clearHarmonyPianoHighlightTimer();
    setSynthV2PlayingMidis(new Set());
  }, [clearHarmonyPianoHighlightTimer]);
  releaseHarmonyPianoKeyRef.current = releaseHarmonyPianoKey;

  useEffect(() => {
    synth2HarmonyPulseRef.current = pulseHarmonyPianoKeyHighlight;
  }, [pulseHarmonyPianoKeyHighlight]);

  const previewHarmonyChordMidis = useCallback(
    (midis: number[]) => {
      if (CREATION_BACKEND_BLANK || midis.length === 0) return;
      const harmonyLane = beatLabSynth2HarmonyLaneRef.current;
      setSelectedBeatLabLane(harmonyLane);
      pulseHarmonyPianoKeyHighlight(midis, 340);
      const ctx = getOrCreateAudioContext();
      void ctx.resume().then(() => {
        const when = ctx.currentTime + 0.01;
        const pianoId = beatLabSynth2PianoInstrumentRef.current;
        const channelVolumes = channelVolumesRef.current;
        const gain = beatLabSynth2PianoRollInstrumentGain(pianoId);
        for (const midi of midis) {
          previewBeatLabMelodicNote(ctx, {
            lane: harmonyLane,
            midi,
            velocity: 96,
            when,
            durationSec: 0.38,
            channelVolumes,
            instrumentId: pianoId,
            instrumentGain: gain,
          });
        }
      });
    },
    [getOrCreateAudioContext, pulseHarmonyPianoKeyHighlight],
  );

  const sustainSynthV2Midi = useCallback(
    (lane: number, midi: number) => {
      if (CREATION_BACKEND_BLANK) return;
      setSelectedBeatLabLane(lane);
      synthV2KeyboardLaneRef.current = lane;
      synthV2AuditionMidiRef.current = midi;
      setSynthV2PlayingMidis(new Set([midi]));
      const ctx = getOrCreateAudioContext();
      void ctx.resume().then(() => {
        playBeatLabSynthV2KeyboardNote(ctx, {
          lane,
          midi,
          velocity: 100,
          channelVolumes: channelVolumesRef.current,
          voice: synthV2VoiceForLane(lane),
          bpm: bpmRef.current,
        });
      });
    },
    [getOrCreateAudioContext, synthV2VoiceForLane],
  );

  const releaseSynthV2Midi = useCallback(
    (lane: number) => {
      releaseBeatLabSynthV2Keyboard(lane);
      setSynthV2PlayingMidis(new Set());
    },
    [],
  );

  const applyDrumSpanForPadNote = useCallback(
    (
      drums: DrumPattern,
      pad: number,
      patternCol: number,
      len: number,
      on: boolean,
    ): DrumPattern =>
      drums.map((row, r) => {
        if (r !== pad) return row;
        return row.map((v, c) => {
          const pc = c - drumColOffset;
          if (pc >= patternCol && pc < patternCol + len) return on;
          return v;
        });
      }),
    [drumColOffset],
  );

  const beatLabNoteFromDrumSpan = useCallback(
    (lane: number, patternCol: number, drums: DrumPattern, off: number): BeatLabMidiNote | null => {
      if (lane >= BEAT_LAB_PAD_LANES || !drums[lane]?.[patternCol + off]) return null;
      let headCol = patternCol;
      while (headCol > 0 && drums[lane]![headCol - 1 + off]) headCol -= 1;
      let len = 1;
      while (headCol + len < patternColsDrums && drums[lane]![headCol + len + off]) len += 1;
      return { lane, col: headCol, len, vel: PAD_VEL[lane] ?? 100 };
    },
    [patternColsDrums],
  );

  const beatLabNoteHeadAt = useCallback(
    (lane: number, patternCol: number): BeatLabMidiNote | null => {
      const rollHead = currentMidiRoll.find(
        (n) => n.lane === lane && patternCol >= n.col && patternCol < n.col + n.len,
      );
      if (rollHead) return rollHead;
      return beatLabNoteFromDrumSpan(lane, patternCol, currentDrums, drumColOffset);
    },
    [beatLabNoteFromDrumSpan, currentDrums, currentMidiRoll, drumColOffset],
  );

  /** Always reads latest bank pattern (keyboard handler must not use a stale render). */
  const beatLabNoteHeadAtLive = useCallback((lane: number, patternCol: number): BeatLabMidiNote | null => {
    const roll = currentMidiRollRef.current;
    const drums = currentDrumsRef.current;
    const off = drumColOffsetRef.current;
    const rollHead = roll.find(
      (n) => n.lane === lane && patternCol >= n.col && patternCol < n.col + n.len,
    );
    if (rollHead) return rollHead;
    return beatLabNoteFromDrumSpan(lane, patternCol, drums, off);
  }, [beatLabNoteFromDrumSpan]);

  const moveBeatLabMidiRollNote = useCallback(
    (fromLane: number, fromCol: number, toLane: number, toCol: number) => {
      if (CREATION_BACKEND_BLANK) return;
      pushBeatLabUndo();
      let moved = false;
      setBanks((prev) => {
        const bank = prev[activeBank];
        if (!bank) return prev;
        const roll = bank.midiRoll ?? [];
        const drums = normalizeBankDrumPattern(bank.drums);
        let note = roll.find((n) => n.lane === fromLane && n.col === fromCol);
        if (!note && fromLane < BEAT_LAB_PAD_LANES && drums[fromLane]?.[fromCol + drumColOffset]) {
          note = { lane: fromLane, col: fromCol, len: 1, vel: PAD_VEL[fromLane] ?? 100 };
        }
        if (!note) return prev;
        const len = clampBeatLabNoteLen(note.len, toCol, patternColsDrums);
        if (
          beatLabRollNotesOverlap(roll, toLane, toCol, len, {
            lane: fromLane,
            col: fromCol,
          })
        ) {
          return prev;
        }
        moved = true;
        const nextRoll = [
          ...roll.filter((n) => !(n.lane === fromLane && n.col === fromCol)),
          { ...note, lane: toLane, col: toCol, len },
        ];
        let nextDrums = drums;
        if (fromLane < BEAT_LAB_PAD_LANES) {
          nextDrums = applyDrumSpanForPadNote(nextDrums, fromLane, fromCol, note.len, false);
          nextDrums = applyDrumSpanForPadNote(nextDrums, toLane, toCol, len, true);
        }
        return prev.map((b, i) =>
          i === activeBank ? { ...b, midiRoll: nextRoll, drums: nextDrums } : b,
        );
      });
      if (moved) setBeatLabRollSelection({ lane: toLane, col: toCol });
    },
    [activeBank, applyDrumSpanForPadNote, drumColOffset, patternColsDrums, pushBeatLabUndo],
  );

  const insertBeatLabMidiNoteAt = useCallback(
    (note: BeatLabMidiNote, toLane: number, toCol: number) => {
      if (CREATION_BACKEND_BLANK) return false;
      pushBeatLabUndo();
      let inserted = false;
      setBanks((prev) => {
        const bank = prev[activeBank];
        if (!bank) return prev;
        const roll = bank.midiRoll ?? [];
        const len = clampBeatLabNoteLen(note.len, toCol, patternColsDrums);
        if (beatLabRollNotesOverlap(roll, toLane, toCol, len)) return prev;
        inserted = true;
        const nextRoll = [
          ...roll,
          {
            lane: toLane,
            col: toCol,
            len,
            vel: note.vel,
            ...(note.muted ? { muted: true } : {}),
          },
        ];
        let nextDrums = normalizeBankDrumPattern(bank.drums);
        if (toLane < BEAT_LAB_PAD_LANES) {
          nextDrums = applyDrumSpanForPadNote(nextDrums, toLane, toCol, len, true);
        }
        return prev.map((b, i) =>
          i === activeBank ? { ...b, midiRoll: nextRoll, drums: nextDrums } : b,
        );
      });
      if (inserted) setBeatLabRollSelection({ lane: toLane, col: toCol });
      return inserted;
    },
    [activeBank, applyDrumSpanForPadNote, patternColsDrums, pushBeatLabUndo],
  );

  const deleteBeatLabMidiRollNote = useCallback(
    (lane: number, col: number) => {
      if (CREATION_BACKEND_BLANK) return;
      pushBeatLabUndo();
      setBanks((prev) => {
        const bank = prev[activeBank];
        if (!bank) return prev;
        const roll = bank.midiRoll ?? [];
        const note = roll.find((n) => n.lane === lane && n.col === col);
        const len = note?.len ?? 1;
        const nextRoll = roll.filter((n) => !(n.lane === lane && n.col === col));
        const hadDrum =
          lane < BEAT_LAB_PAD_LANES && bank.drums[lane]?.[col + drumColOffset];
        if (nextRoll.length === roll.length && !hadDrum) return prev;
        let nextDrums = normalizeBankDrumPattern(bank.drums);
        if (lane < BEAT_LAB_PAD_LANES) {
          nextDrums = applyDrumSpanForPadNote(nextDrums, lane, col, len, false);
        }
        return prev.map((b, i) =>
          i === activeBank ? { ...b, midiRoll: nextRoll, drums: nextDrums } : b,
        );
      });
      setBeatLabRollSelection((sel) =>
        sel && sel.lane === lane && sel.col === col ? null : sel,
      );
    },
    [activeBank, applyDrumSpanForPadNote, drumColOffset, pushBeatLabUndo],
  );

  const resizeBeatLabMidiRollNoteFromStart = useCallback(
    (lane: number, headCol: number, newHeadCol: number) => {
      if (CREATION_BACKEND_BLANK) return;
      let nextHeadCol = headCol;
      setBanks((prev) => {
        const bank = prev[activeBank];
        if (!bank) return prev;
        const roll = bank.midiRoll ?? [];
        const drums = normalizeBankDrumPattern(bank.drums);
        let note = roll.find((n) => n.lane === lane && n.col === headCol);
        if (!note) {
          const fromDrums = beatLabNoteFromDrumSpan(lane, headCol, drums, drumColOffset);
          if (!fromDrums || fromDrums.col !== headCol) return prev;
          note = fromDrums;
        }
        const { col, len } = beatLabNoteResizeFromStartHead(
          headCol,
          note.len,
          newHeadCol,
          patternColsDrums,
        );
        nextHeadCol = col;
        if (col === headCol && len === note.len) return prev;
        if (beatLabRollNotesOverlap(roll, lane, col, len, { lane, col: headCol })) return prev;
        const nextRoll = [
          ...roll.filter((n) => !(n.lane === lane && n.col === headCol)),
          { ...note, col, len },
        ];
        let nextDrums = drums;
        if (lane < BEAT_LAB_PAD_LANES) {
          nextDrums = applyDrumSpanForPadNote(nextDrums, lane, headCol, note.len, false);
          nextDrums = applyDrumSpanForPadNote(nextDrums, lane, col, len, true);
        }
        return prev.map((b, i) =>
          i === activeBank ? { ...b, midiRoll: nextRoll, drums: nextDrums } : b,
        );
      });
      setBeatLabRollSelection((sel) =>
        sel && sel.lane === lane && sel.col === headCol ? { lane, col: nextHeadCol } : sel,
      );
    },
    [activeBank, applyDrumSpanForPadNote, beatLabNoteFromDrumSpan, drumColOffset, patternColsDrums],
  );

  const resizeBeatLabMidiRollNote = useCallback(
    (lane: number, col: number, len: number) => {
      if (CREATION_BACKEND_BLANK) return;
      setBanks((prev) => {
        const bank = prev[activeBank];
        if (!bank) return prev;
        const roll = bank.midiRoll ?? [];
        const drums = normalizeBankDrumPattern(bank.drums);
        let note = roll.find((n) => n.lane === lane && n.col === col);
        if (!note) {
          const fromDrums = beatLabNoteFromDrumSpan(lane, col, drums, drumColOffset);
          if (!fromDrums || fromDrums.col !== col) return prev;
          note = fromDrums;
        }
        let nextLen = clampBeatLabNoteLen(len, col, patternColsDrums);
        while (
          nextLen > 1 &&
          beatLabRollNotesOverlap(roll, lane, col, nextLen, { lane, col })
        ) {
          nextLen -= 1;
        }
        if (nextLen === note.len && roll.some((n) => n.lane === lane && n.col === col)) return prev;
        const inRoll = roll.some((n) => n.lane === lane && n.col === col);
        const nextRoll = inRoll
          ? roll.map((n) => (n.lane === lane && n.col === col ? { ...n, len: nextLen } : n))
          : [...roll, { ...note, len: nextLen }];
        let nextDrums = drums;
        if (lane < BEAT_LAB_PAD_LANES) {
          nextDrums = applyDrumSpanForPadNote(nextDrums, lane, col, note.len, false);
          nextDrums = applyDrumSpanForPadNote(nextDrums, lane, col, nextLen, true);
        }
        return prev.map((b, i) =>
          i === activeBank ? { ...b, midiRoll: nextRoll, drums: nextDrums } : b,
        );
      });
    },
    [activeBank, applyDrumSpanForPadNote, beatLabNoteFromDrumSpan, drumColOffset, patternColsDrums],
  );

  resizeBeatLabMidiRollNoteRef.current = resizeBeatLabMidiRollNote;
  moveBeatLabMidiRollNoteRef.current = moveBeatLabMidiRollNote;

  const clearBeatLabMidiRoll = useCallback(() => {
    if (CREATION_BACKEND_BLANK) return;
    pushBeatLabUndo();
    patchActiveBankMidiRoll([]);
  }, [patchActiveBankMidiRoll, pushBeatLabUndo]);

  /** Pad lane to clear — grid selection, else highlighted sampler pad (0–15). */
  const resolveBeatLabClearLaneIndex = useCallback((): number | null => {
    const lane = selectedBeatLabLaneRef.current;
    if (lane != null && lane >= 0 && lane < BEAT_LAB_PAD_LANES) return lane;
    const pad = geniusSamplerTargetPad;
    if (pad >= 0 && pad < BEAT_LAB_PAD_LANES) return pad;
    return null;
  }, [geniusSamplerTargetPad]);

  /** Wipe drum grid steps — `drums` + pad-lane `midiRoll` (both drive playback). */
  const wipeBeatLabDrumPattern = useCallback(
    (laneOnly?: number) => {
      if (CREATION_BACKEND_BLANK) return;
      pushBeatLabUndo();

      const wipeDrums = (drumsIn: DrumPattern): DrumPattern => {
        const drums = normalizeBankDrumPattern(drumsIn).map((row) => row.slice());
        if (laneOnly != null) {
          /** Full bank row — not only visible loop columns (long spans / DUP can extend past view). */
          return drums.map((row, i) =>
            i === laneOnly ? Array(TOTAL_COLS).fill(false) : row,
          );
        }
        return emptyDrums().map((row) => row.slice());
      };

      const wipeRoll = (rollIn: BeatLabMidiNote[]): BeatLabMidiNote[] => {
        const roll = normalizeBeatLabMidiRoll(rollIn);
        if (laneOnly != null) {
          return roll.filter((n) => n.lane !== laneOnly);
        }
        return roll.filter((n) => !beatLabLaneIsPad(n.lane));
      };

      setBanks((prev) =>
        prev.map((b, i) => {
          if (i !== activeBank) return b;
          return {
            ...b,
            drums: wipeDrums(b.drums),
            midiRoll: wipeRoll(b.midiRoll ?? []),
          };
        }),
      );
      const nextSlots = bankPatternSlotsRef.current.map((slots, i) =>
        i !== activeBank
          ? slots
          : { ...slots, [patternSlot]: wipeDrums(slots[patternSlot]) },
      );
      bankPatternSlotsRef.current = nextSlots;
      setBankPatternSlots(nextSlots);
      setBeatLabRollSelection(null);
    },
    [activeBank, patternSlot, pushBeatLabUndo],
  );

  const clearDrumLaneRef = useRef<(padIndex: number) => void>(() => {});

  const setBeatLabMidiRollMuted = useCallback(
    (lane: number, col: number, muted: boolean) => {
      if (CREATION_BACKEND_BLANK) return;
      const note = currentMidiRoll.find((n) => n.lane === lane && n.col === col);
      if (!note) return;
      patchActiveBankMidiRoll(
        currentMidiRoll.map((n) =>
          n.lane === lane && n.col === col
            ? { ...n, muted: muted ? true : undefined }
            : n,
        ),
      );
    },
    [currentMidiRoll, patchActiveBankMidiRoll],
  );

  const setBeatLabMidiRollVelocity = useCallback(
    (lane: number, col: number, vel: number) => {
      if (CREATION_BACKEND_BLANK) return;
      const note = currentMidiRoll.find((n) => n.lane === lane && n.col === col);
      if (!note) return;
      const v = Math.max(1, Math.min(127, Math.round(vel)));
      patchActiveBankMidiRoll(
        currentMidiRoll.map((n) => (n.lane === lane && n.col === col ? { ...n, vel: v } : n)),
      );
    },
    [currentMidiRoll, patchActiveBankMidiRoll],
  );

  const sliceBeatLabMidiRollNote = useCallback(
    (lane: number, headCol: number, splitCol: number, pitchSlice = false) => {
      if (CREATION_BACKEND_BLANK) return;
      setBanks((prev) => {
        const bank = prev[activeBank];
        if (!bank) return prev;
        const roll = bank.midiRoll ?? [];
        const drums = normalizeBankDrumPattern(bank.drums);
        let note = roll.find((n) => n.lane === lane && n.col === headCol);
        if (!note) {
          const fromDrums = beatLabNoteFromDrumSpan(lane, headCol, drums, drumColOffset);
          if (!fromDrums) return prev;
          note = fromDrums;
          headCol = fromDrums.col;
        }
        const split = beatLabSliceColForPointer(headCol, note.len, splitCol);
        if (split == null) return prev;
        const nextRoll = pitchSlice
          ? beatLabPitchSliceMidiNoteAt(roll, lane, headCol, split, patternColsDrums)
          : beatLabSplitMidiNoteAt(roll, lane, headCol, split, patternColsDrums);
        if (nextRoll.length === roll.length) return prev;
        let nextDrums = drums;
        if (lane < BEAT_LAB_PAD_LANES) {
          nextDrums = applyDrumSpanForPadNote(nextDrums, lane, headCol, note.len, false);
          const left = nextRoll.find((n) => n.lane === lane && n.col === headCol);
          const right = nextRoll.find((n) => n.lane === lane && n.col === split);
          if (left) nextDrums = applyDrumSpanForPadNote(nextDrums, lane, left.col, left.len, true);
          if (right) nextDrums = applyDrumSpanForPadNote(nextDrums, lane, right.col, right.len, true);
        }
        return prev.map((b, i) =>
          i === activeBank ? { ...b, midiRoll: nextRoll, drums: nextDrums } : b,
        );
      });
      setBeatLabRollSelection((sel) =>
        sel && sel.lane === lane && sel.col === headCol ? { lane, col: headCol } : sel,
      );
    },
    [activeBank, applyDrumSpanForPadNote, beatLabNoteFromDrumSpan, drumColOffset, patternColsDrums],
  );

  const resolveBeatLabGridTarget = useCallback(() => {
    if (beatLabDeckFocusRef.current === 'synth' && beatLabSynthFocusRef.current) {
      return beatLabSynthFocusRef.current;
    }
    return beatLabRollSelectionRef.current ?? beatLabGridFocusRef.current;
  }, []);

  const copyBeatLabRollSelection = useCallback(() => {
    const sel = resolveBeatLabGridTarget();
    if (!sel) return false;
    const note = beatLabNoteHeadAtLive(sel.lane, sel.col);
    if (!note) return false;
    beatLabRollClipboardRef.current = [{ ...note, col: note.col }];
    return true;
  }, [beatLabNoteHeadAtLive, resolveBeatLabGridTarget]);

  const resolveBeatLabPasteTarget = useCallback(
    (src: BeatLabMidiNote, explicitCol?: number) => {
      const focus = resolveBeatLabGridTarget();
      const lane = focus?.lane ?? src.lane;
      let col =
        explicitCol ??
        focus?.col ??
        (activeCol >= 0 ? activeCol : undefined);
      if (col == null) {
        col = src.col + Math.max(1, src.len);
        if (col >= patternColsDrums) col = Math.max(0, src.col - 1);
      }
      col = Math.max(0, Math.min(patternColsDrums - 1, col));
      if (lane === src.lane && col >= src.col && col < src.col + src.len) {
        col = Math.min(patternColsDrums - 1, src.col + Math.max(1, src.len));
      }
      return { lane, col };
    },
    [activeCol, patternColsDrums, resolveBeatLabGridTarget],
  );

  const pasteBeatLabRollClipboard = useCallback(
    (atCol?: number) => {
      if (CREATION_BACKEND_BLANK || beatLabRollClipboardRef.current.length === 0) return false;
      const src = beatLabRollClipboardRef.current[0]!;
      const { lane, col } = resolveBeatLabPasteTarget(src, atCol);
      return insertBeatLabMidiNoteAt(src, lane, col);
    },
    [insertBeatLabMidiNoteAt, resolveBeatLabPasteTarget],
  );

  const duplicateBeatLabRollSelection = useCallback(() => {
    const sel = resolveBeatLabGridTarget();
    if (!sel) return false;
    const note = beatLabNoteHeadAtLive(sel.lane, sel.col);
    if (!note) return false;
    const col = Math.min(patternColsDrums - 1, note.col + Math.max(1, note.len));
    return insertBeatLabMidiNoteAt(note, note.lane, col);
  }, [beatLabNoteHeadAtLive, insertBeatLabMidiNoteAt, patternColsDrums, resolveBeatLabGridTarget]);

  const beatLabGridShortcutsRef = useRef({
    copy: copyBeatLabRollSelection,
    paste: pasteBeatLabRollClipboard,
    duplicate: duplicateBeatLabRollSelection,
    deleteNote: deleteBeatLabMidiRollNote,
    noteHeadAt: beatLabNoteHeadAtLive,
    resolveTarget: resolveBeatLabGridTarget,
  });
  beatLabGridShortcutsRef.current = {
    copy: copyBeatLabRollSelection,
    paste: pasteBeatLabRollClipboard,
    duplicate: duplicateBeatLabRollSelection,
    deleteNote: deleteBeatLabMidiRollNote,
    noteHeadAt: beatLabNoteHeadAtLive,
    resolveTarget: resolveBeatLabGridTarget,
  };

  useEffect(() => {
    const isBeatLabGridView = () => {
      const sub = creationSubScreenRef.current;
      if (sub === 'beat-lab' || sub === 'drum-kit-generator') return true;
      return tabRef.current === 'grid';
    };
    const keyMatch = (e: KeyboardEvent, letter: string) =>
      e.code === `Key${letter.toUpperCase()}` || e.key.toLowerCase() === letter;

    function handleKeyDown(e: KeyboardEvent) {
      if (!isScreenActiveRef.current) return;
      if (!keyboardShortcutsEnabledRef.current) return;

      const target = e.target as HTMLElement | null;
      const typing = Boolean(
        target?.closest('input, textarea, select, [contenteditable="true"]'),
      );

      if (!typing) {
        if (e.code === 'Space') {
          e.preventDefault();
          if (tabRef.current === 'groove-lab') {
            dispatchGrooveLabLocalTransport(
              isGrooveLabTransportRunning() ? 'pause' : 'play',
            );
          } else {
            const tr = creationTransportKeysRef.current;
            if (tr.needsPause) tr.pause();
            else tr.start();
          }
          return;
        }
        if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          if (tabRef.current === 'groove-lab') {
            dispatchGrooveLabLocalTransport('stop');
          } else {
            creationTransportKeysRef.current.stop();
          }
          return;
        }
      }

      if (isBeatLabGridView() && !typing) {
        const mod = e.ctrlKey || e.metaKey;
        if (mod && keyMatch(e, 'z') && !e.shiftKey) {
          e.preventDefault();
          beatLabUndo();
          return;
        }
        if (mod && (keyMatch(e, 'y') || (keyMatch(e, 'z') && e.shiftKey))) {
          e.preventDefault();
          beatLabRedo();
          return;
        }
        if (!mod) {
          if (keyMatch(e, 'p')) {
            e.preventDefault();
            setBeatLabEditTool('pointer');
            return;
          }
          if (keyMatch(e, 'b')) {
            e.preventDefault();
            setBeatLabEditTool('draw');
            return;
          }
          if (keyMatch(e, 'd')) {
            e.preventDefault();
            setBeatLabEditTool('erase');
            return;
          }
          if (keyMatch(e, 't')) {
            e.preventDefault();
            setBeatLabEditTool('mute');
            return;
          }
          if (keyMatch(e, 'v')) {
            e.preventDefault();
            setBeatLabEditTool('velocity');
            return;
          }
          if (keyMatch(e, 'c')) {
            e.preventDefault();
            setBeatLabEditTool('slice');
            return;
          }
          if (keyMatch(e, 'a')) {
            e.preventDefault();
            setBeatLabEditTool('automation');
            return;
          }
          if (keyMatch(e, 'h')) {
            e.preventDefault();
            setBeatLabEditTool('pitch');
            return;
          }
        }
        const sc = beatLabGridShortcutsRef.current;
        const sel = sc.resolveTarget();
        const head = sel ? sc.noteHeadAt(sel.lane, sel.col) : null;

        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (head) {
            e.preventDefault();
            sc.deleteNote(head.lane, head.col);
            return;
          }
          const lane = resolveBeatLabClearLaneIndex();
          if (lane != null && isBeatLabGridView()) {
            e.preventDefault();
            clearDrumLaneRef.current(lane);
            return;
          }
        }
        if (mod && keyMatch(e, 'c')) {
          if (beatLabEditTool === 'pitch') {
            e.preventDefault();
            copyPitchAutomation();
            return;
          }
          if (head) {
            e.preventDefault();
            sc.copy();
            return;
          }
        }
        if (mod && keyMatch(e, 'x') && head) {
          e.preventDefault();
          sc.copy();
          sc.deleteNote(head.lane, head.col);
          return;
        }
        if (mod && keyMatch(e, 'v')) {
          if (beatLabEditTool === 'pitch' && pitchAutomationClipboardRef.current?.length) {
            e.preventDefault();
            pastePitchAutomation();
            return;
          }
          e.preventDefault();
          sc.paste();
          return;
        }
        if (mod && keyMatch(e, 'd') && head) {
          e.preventDefault();
          sc.duplicate();
          return;
        }
      }

      // Bank switches: 1?8
      if (e.key >= '1' && e.key <= '8') {
        setActiveBank(parseInt(e.key) - 1);
        return;
      }
      // Clear current bank: Ctrl+K
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        if (confirm(`Clear bank ${BANKS[activeBank]}?`)) {
          setBanks(prev => prev.map((b, i) => i === activeBank ? { drums: emptyDrums(), notes: [], midiRoll: [] } : b));
        }
        return;
      }
      // Tab switch: Ctrl+G Beat Lab, Ctrl+H chord builder, Ctrl+A AI pattern, Ctrl+8 808 Lab
      if (e.ctrlKey) {
        if (e.key === 'g') { e.preventDefault(); goToCreationSub('beat-lab'); }
        else if (e.key === 'h') { e.preventDefault(); goToCreationSub('chord-builder'); }
        else if (e.key === '8') { e.preventDefault(); goToCreationSub('808-lab'); }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeBank,
    beatLabEditTool,
    beatLabRedo,
    beatLabUndo,
    copyPitchAutomation,
    goToCreationSub,
    pastePitchAutomation,
    resolveBeatLabClearLaneIndex,
  ]);

  const beatLabPianoRollExpanded = beatLabDeckFocus === 'sequence';
  const beatLabSynthBassLane = beatLabSynth2BassLane;
  const beatLabSynthHarmonyLane = beatLabSynth2HarmonyLane;
  /** V2 editor / glide follows selected melodic CH when it is the bass lane. */
  const beatLabSynthLane =
    selectedBeatLabLane != null && beatLabSynth2IsBassLane(selectedBeatLabLane, beatLabSynthBassLane)
      ? selectedBeatLabLane
      : beatLabSynthBassLane;

  const setBeatLabSynth2BassLaneSafe = useCallback((lane: number) => {
    const pair = beatLabSynth2NormalizePair(lane, beatLabSynth2HarmonyLaneRef.current);
    setBeatLabSynth2BassLane(pair.bassLane);
    if (pair.harmonyLane !== beatLabSynth2HarmonyLaneRef.current) {
      setBeatLabSynth2HarmonyLane(pair.harmonyLane);
    }
    storeBeatLabSynth2Lanes(pair.bassLane, pair.harmonyLane);
  }, []);

  const setBeatLabSynth2HarmonyLaneSafe = useCallback((lane: number) => {
    const pair = beatLabSynth2NormalizePair(beatLabSynth2BassLaneRef.current, lane);
    setBeatLabSynth2HarmonyLane(pair.harmonyLane);
    if (pair.bassLane !== beatLabSynth2BassLaneRef.current) {
      setBeatLabSynth2BassLane(pair.bassLane);
    }
    storeBeatLabSynth2Lanes(pair.bassLane, pair.harmonyLane);
  }, []);

  const onBeatLabSynth2PianoInstrumentChange = useCallback(
    (instrumentId: string) => {
      const norm = normalizeBeatLabSynth2PianoInstrument(instrumentId);
      setBeatLabSynth2PianoInstrument(norm);
      const slot = beatLabMelodicSlotIndex(beatLabSynth2HarmonyLaneRef.current);
      patchMelodicInstrument(slot, norm);
      const ctx = getOrCreateAudioContext();
      void ctx.resume().then(() => {
        resetBeatLabMelodicWarmupFlag();
        void warmupBeatLabMelodicSoundfont(ctx, [norm], true);
      });
    },
    [getOrCreateAudioContext, patchMelodicInstrument],
  );

  useEffect(() => {
    const slot = beatLabMelodicSlotIndex(beatLabSynth2HarmonyLane);
    const fromSlot = currentMelodicInstruments[slot];
    if (!fromSlot) return;
    const norm = normalizeBeatLabSynth2PianoInstrument(fromSlot);
    setBeatLabSynth2PianoInstrument((prev) => (prev === norm ? prev : norm));
  }, [beatLabSynth2HarmonyLane, currentMelodicInstruments]);

  useEffect(() => {
    if (beatLabDeckFocus !== 'synth2') {
      stopBeatLabSynthV2HeldPreview(beatLabSynthBassLane);
      releaseBeatLabSynthV2Keyboard(beatLabSynthBassLane);
      setSynthV2PlayingMidis(new Set());
    }
  }, [beatLabDeckFocus, beatLabSynthBassLane]);

  const fitBeatLabGridToViewport = useCallback(() => {
    const onDrumGrid = beatLabDeckFocus === 'sequence';
    const el = onDrumGrid ? drumScrollRef.current : beatLabRollScrollRef.current;
    if (!el) return;
    const gutter = onDrumGrid ? 0 : BEAT_LAB_ROLL_LABEL_W + 8;
    const visible = Math.max(120, el.clientWidth - gutter);
    const n = Math.max(1, patternColsDrums);
    const next = Math.floor(visible / n);
    setColWidth(Math.max(MIN_CW, Math.min(MAX_CW, next)));
    el.scrollLeft = 0;
    if (onDrumGrid) {
      const roll = beatLabRollScrollRef.current;
      if (roll) roll.scrollLeft = 0;
    }
  }, [beatLabDeckFocus, patternColsDrums]);
  const applyBeatLabGridLayoutDefault = useCallback(() => {
    setBeatLabGridLayoutMode('default');
  }, []);
  const applyBeatLabGridLayoutFull = useCallback(() => {
    setBeatLabGridLayoutMode('full');
    if (beatLabDeckFocus !== 'sequence') {
      setBeatLabDeckFocus('sequence');
    }
    setBeatLabGridZoomMode('max');
    requestAnimationFrame(() => fitBeatLabGridToViewport());
  }, [beatLabDeckFocus, fitBeatLabGridToViewport]);

  useEffect(() => {
    if (beatLabDeckFocus !== 'sequence' && beatLabGridLayoutMode === 'full') {
      setBeatLabGridLayoutMode('default');
    }
  }, [beatLabDeckFocus, beatLabGridLayoutMode]);

  useEffect(() => {
    if (!beatLabGridFullView) return;
    const id = requestAnimationFrame(() => fitBeatLabGridToViewport());
    return () => cancelAnimationFrame(id);
  }, [beatLabGridFullView, fitBeatLabGridToViewport]);

  const beatLabPianoRollPanel = useMemo(
    () => (
      <BeatLabPianoRoll
        notes={currentMidiRoll}
        patternCols={patternColsDrums}
        colWidth={colWidth}
        activeCol={-1}
        transportNotStopped={transportNotStopped}
        playheadElRef={beatLabRollPlaylineRef}
        scrollRef={beatLabRollScrollRef}
        onScroll={onBeatLabRollScroll}
        onSeekCol={seekTransportToPatternColumn}
        onToggleNote={toggleBeatLabMidiRollNote}
        onSetNote={setBeatLabMidiRollStep}
        editTool={beatLabEditTool}
        onModeChange={setBeatLabEditTool}
        onSetNoteMuted={setBeatLabMidiRollMuted}
        onSetNoteVelocity={setBeatLabMidiRollVelocity}
        onSliceNote={sliceBeatLabMidiRollNote}
        volAutomation={currentVolAutomation}
        pitchAutomation={currentPitchAutomation}
        onVolAutomationPaint={patchVolAutomation}
        onPitchAutomationPaint={patchPitchAutomation}
        onAutomationGestureStart={beginBeatLabUndoGesture}
        onAutomationGestureEnd={endBeatLabUndoGesture}
        pitchSelectionRef={pitchAutomationSelectionRef}
        onEditGestureStart={beginBeatLabUndoGesture}
        onEditGestureEnd={endBeatLabUndoGesture}
        onMoveNote={moveBeatLabMidiRollNote}
        onResizeNote={resizeBeatLabMidiRollNote}
        onResizeNoteFromStart={resizeBeatLabMidiRollNoteFromStart}
        onDeleteNote={deleteBeatLabMidiRollNote}
        onDuplicateNote={(fromLane, fromCol, toLane, toCol) => {
          const note = currentMidiRoll.find(
            (n) => n.lane === fromLane && n.col === fromCol,
          );
          if (note) insertBeatLabMidiNoteAt(note, toLane, toCol);
        }}
        selectedNote={beatLabRollSelection}
        onSelectNote={(sel) => {
          beatLabGridFocusRef.current = sel;
          setBeatLabRollSelection(sel);
        }}
        onClearNotes={() => {
          clearBeatLabMidiRoll();
        }}
        laneLabelForPad={(pi) =>
          beatLabLaneDisplayLabel(pi, padSampleLabels[padSampleKey(activeBank, pi)])
        }
        laneColorForPad={beatLabPadColor}
        selectedLane={selectedBeatLabLane}
        onLaneSelect={setSelectedBeatLabLane}
        onPadLanePreview={(pi) => {
          if (CREATION_BACKEND_BLANK) return;
          setSelectedBeatLabLane(pi);
          if (pi < BEAT_LAB_PAD_LANES) {
            playPadSoundRef.current(pi, PAD_VEL[pi] ?? 90);
            return;
          }
          const base =
            beatLabDeckFocus === 'synth2'
              ? beatLabMelodicSynthV2AuditionPitch(pi)
              : beatLabMelodicLanePitch(pi);
          previewBeatLabMelodicMidi(pi, base);
        }}
        deckFocus={beatLabDeckFocus}
        onDeckFocusChange={setBeatLabDeckFocus}
        melodicLanesOnly={false}
        gridSnap={{
          qpb: beatLabQpb,
          subdiv: subdivHud,
          bankColOffset: drumColOffset,
        }}
        editToolSnapHint={snapLabelFromPianoSnapSubdiv(pianoSnapSubdiv)}
        disabled={CREATION_BACKEND_BLANK}
        hideHeaderToolbar
      />
    ),
    [
      activeBank,
      activeCol,
      beatLabDeckFocus,
      beatLabEditTool,
      setBeatLabMidiRollMuted,
      setBeatLabMidiRollVelocity,
      sliceBeatLabMidiRollNote,
      currentVolAutomation,
      currentPitchAutomation,
      patchVolAutomation,
      patchPitchAutomation,
      clearBeatLabMidiRoll,
      colWidth,
      setBeatLabMidiRollStep,
      loopBars,
      pianoSnapSubdiv,
      qpbHud,
      subdivHud,
      drumColOffset,
      currentMidiRoll,
      moveBeatLabMidiRollNote,
      onBeatLabRollScroll,
      padSampleLabels,
      patternColsDrums,
      selectedBeatLabLane,
      resizeBeatLabMidiRollNote,
      seekTransportToPatternColumn,
      toggleBeatLabMidiRollNote,
      transportNotStopped,
      visualSyncCol,
    ],
  );

  const beatLabMelodicChannelLabel = useCallback(
    (lane: number) => {
      const slot = beatLabMelodicSlotIndex(lane);
      const instId =
        currentMelodicInstruments[slot] ?? BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[slot]!;
      return (
        BEAT_LAB_MELODIC_INSTRUMENT_OPTIONS.find((o) => o.id === instId)?.label ??
        beatLabLaneDisplayLabel(lane)
      );
    },
    [currentMelodicInstruments],
  );

  const patchBeatLabSynthLaneNotes = useCallback(
    (lane: number, laneNotes: BeatLabMidiNote[]) => {
      if (CREATION_BACKEND_BLANK) return;
      let normalized = laneNotes;
      if (beatLabSynth2IsHarmonyLane(lane, beatLabSynth2HarmonyLaneRef.current)) {
        const subdiv = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
        const spb = beatLabStepsPerBar(subdiv, beatsPerBarRef.current, MEASURES_PER_BAR);
        normalized = snapBeatLabChordNotesToBarDownbeats(laneNotes, {
          stepsPerBar: spb,
          patternCols: patternColsDrumsRef.current,
        });
      }
      const kept = currentMidiRoll.filter((n) => n.lane !== lane);
      patchActiveBankMidiRollWithUndo([...kept, ...normalized]);
    },
    [currentMidiRoll, patchActiveBankMidiRollWithUndo],
  );

  const beatLabSynthHarmonyLaneNotes = useMemo(
    () => currentMidiRoll.filter((n) => n.lane === beatLabSynthHarmonyLane),
    [currentMidiRoll, beatLabSynthHarmonyLane],
  );

  const beatLabSynthHarmonyMidiAt = useCallback(
    (n: BeatLabMidiNote) => beatLabNoteMidi(beatLabSynthHarmonyLane, n),
    [beatLabSynthHarmonyLane],
  );

  const beatLabSynthChordsMuted = useMemo(
    () =>
      beatLabSynthV2IsChordHarmonyMuted(
        beatLabSynthHarmonyLaneNotes,
        beatLabSynthHarmonyLane,
        beatLabSynthHarmonyMidiAt,
      ),
    [beatLabSynthHarmonyMidiAt, beatLabSynthHarmonyLaneNotes, beatLabSynthHarmonyLane],
  );

  const toggleBeatLabSynthChordMute = useCallback(() => {
    if (CREATION_BACKEND_BLANK) return;
    const next = beatLabSynthV2ApplyChordHarmonyMute(
      beatLabSynthHarmonyLaneNotes,
      beatLabSynthHarmonyLane,
      !beatLabSynthChordsMuted,
      beatLabSynthHarmonyMidiAt,
    );
    patchBeatLabSynthLaneNotes(beatLabSynthHarmonyLane, next);
  }, [
    beatLabSynthHarmonyMidiAt,
    beatLabSynthChordsMuted,
    beatLabSynthHarmonyLane,
    beatLabSynthHarmonyLaneNotes,
    patchBeatLabSynthLaneNotes,
  ]);

  const transposeBeatLabSynthHarmonyOctaves = useCallback(
    (direction: -1 | 1) => {
      if (CREATION_BACKEND_BLANK) return;
      const lane = beatLabSynthHarmonyLane;
      const delta = direction * 12;
      const laneNotes = currentMidiRoll.filter((n) => n.lane === lane);
      if (laneNotes.length === 0) return;
      const shifted = laneNotes.map((n) => {
        const merged = Math.max(-24, Math.min(24, (n.pitchSemi ?? 0) + delta));
        const { pitchSemi: _drop, ...rest } = n;
        return merged === 0 ? rest : { ...rest, pitchSemi: merged };
      });
      patchBeatLabSynthLaneNotes(lane, shifted as BeatLabMidiNote[]);
    },
    [beatLabSynthHarmonyLane, currentMidiRoll, patchBeatLabSynthLaneNotes],
  );

  const beatLabSynthPanel = useMemo(
    () => (
      <BeatLabSynthPianoRoll
        notes={currentMidiRoll}
        lane={beatLabSynthLane}
        patternCols={patternColsDrums}
        beatsPerBar={beatsPerBar}
        colsPerBar={MEASURES_PER_BAR}
        stepSubdiv={subdivHud}
        playheadStepCol={beatLabSynthPlayheadStepCol}
        isPlaying={isPlaying}
        playheadElRef={beatLabSynthPlaylineRef}
        scrollContainerRef={beatLabSynthScrollRef}
        playingMidis={new Set()}
        onNotesChange={patchBeatLabSynthLaneNotes}
        onSeekStepCol={seekTransportToPatternColumn}
        onPreviewMidi={previewBeatLabMelodicMidi}
        onSelectLane={setSelectedBeatLabLane}
        onPreviewLane={(pi) => previewBeatLabMelodicMidi(pi, beatLabMelodicLanePitch(pi))}
        channelLabelForLane={beatLabMelodicChannelLabel}
        melodicInstruments={currentMelodicInstruments}
        melodicSynthPresetIds={currentMelodicSynthPresetIds}
        onMelodicInstrumentChange={patchMelodicInstrument}
        onMelodicSynthPresetChange={patchMelodicSynthPreset}
        editTool={beatLabEditTool}
        onEditGestureStart={beginBeatLabUndoGesture}
        onEditGestureEnd={endBeatLabUndoGesture}
        onGridCellFocus={(stepCol) => {
          beatLabSynthFocusRef.current = { lane: beatLabSynthLane, col: stepCol };
        }}
        disabled={CREATION_BACKEND_BLANK}
      />
    ),
    [
      beatLabSynthPlayheadStepCol,
      beatLabEditTool,
      beatLabMelodicChannelLabel,
      beatLabMelodicLanePitch,
      beatLabSynthLane,
      beginBeatLabUndoGesture,
      endBeatLabUndoGesture,
      getOrCreateAudioContext,
      setSelectedBeatLabLane,
      beatsPerBar,
      currentMelodicInstruments,
      currentMelodicSynthPresetIds,
      currentMidiRoll,
      patchBeatLabSynthLaneNotes,
      patchMelodicInstrument,
      patchMelodicSynthPreset,
      patternColsDrums,
      previewBeatLabMelodicMidi,
      seekTransportToPatternColumn,
      subdivHud,
      isPlaying,
    ],
  );

  const beatLabSynthV2Panel = useMemo(() => {
    const bassLane = beatLabSynthBassLane;
    const slot = beatLabMelodicSlotIndex(bassLane);
    const synthPresetId = currentMelodicSynthPresetIds[slot] ?? BEAT_LAB_DEFAULT_SYNTH_PRESET_ID;
    const voice = currentMelodicSynthVoices[slot] ?? beatLabBassSynthVoiceParamsFromPresetId(synthPresetId);
    return (
      <BeatLabSynthV2Panel
        bassLane={bassLane}
        harmonyLane={beatLabSynthHarmonyLane}
        presetId={synthPresetId}
        voice={voice}
        onPresetChange={(presetId) => patchMelodicSynthPreset(slot, presetId)}
        onLoadPresetToVoice={(presetId) => loadMelodicSynthVoiceFromPreset(slot, presetId)}
        onPatchVoice={(next) => patchMelodicSynthVoice(slot, next)}
        onPreview={() => previewBeatLabSynthV2Lane(bassLane)}
        onPreviewMidi={(midi) => {
          synthV2AuditionMidiRef.current = midi;
          if (isBeatLabSynthV2HeldPreviewActive(bassLane)) {
            const ctx = getOrCreateAudioContext();
            void ctx.resume().then(() => {
              startBeatLabSynthV2HeldPreview(ctx, {
                lane: bassLane,
                midi,
                velocity: 100,
                channelVolumes: channelVolumesRef.current,
                voice: synthV2VoiceForLane(bassLane),
                bpm: bpmRef.current,
              });
            });
            return;
          }
          previewBeatLabSynthV2Lane(bassLane, midi);
        }}
        onAuditionStart={() => startSynthV2Audition(bassLane)}
        onAuditionStop={() => stopSynthV2Audition(bassLane)}
        onAuditionTouch={() => touchSynthV2Audition(bassLane)}
        onSustainMidi={(midi) => sustainSynthV2Midi(bassLane, midi)}
        onReleaseMidi={() => releaseSynthV2Midi(bassLane)}
        playingMidis={synthV2PlayingMidis}
        bpm={bpm}
        quantSubdiv={subdivHud}
        chordRail={beatLabSynthChordRail}
        laneNotes={currentMidiRoll}
        patternCols={patternColsDrums}
        beatsPerBar={beatLabQpb}
        colsPerBar={MEASURES_PER_BAR}
        isActive={beatLabDeckFocus === 'synth2'}
        onApplyBassLaneNotes={(notes) => patchBeatLabSynthLaneNotes(bassLane, notes)}
        onApplyHarmonyLaneNotes={(notes) =>
          patchBeatLabSynthLaneNotes(beatLabSynthHarmonyLane, notes)
        }
      />
    );
  }, [
    beatLabSynthBassLane,
    beatLabSynthHarmonyLane,
    currentMelodicSynthPresetIds,
    currentMelodicSynthVoices,
    currentMidiRoll,
    patternColsDrums,
    beatLabQpb,
    beatLabDeckFocus,
    patchMelodicSynthPreset,
    loadMelodicSynthVoiceFromPreset,
    patchMelodicSynthVoice,
    previewBeatLabSynthV2Lane,
    startSynthV2Audition,
    stopSynthV2Audition,
    touchSynthV2Audition,
    sustainSynthV2Midi,
    releaseSynthV2Midi,
    synthV2PlayingMidis,
    bpm,
    subdivHud,
    beatLabSynthChordRail,
    patchBeatLabSynthLaneNotes,
    getOrCreateAudioContext,
    synthV2VoiceForLane,
  ]);

  /**
   * NEW SYNTH roll — memoized; playhead is a stable mount (WAAPI only, no transport props).
   */
  const beatLabSynthV2RollPanel = useMemo(
    () => (
      <BeatLabSynthPianoRoll
        engineVariant="v2"
        notes={currentMidiRoll}
        lane={beatLabSynthHarmonyLane}
        v2HarmonyLane={beatLabSynthHarmonyLane}
        v2PianoInstrumentId={beatLabSynth2PianoInstrument}
        onV2PianoInstrumentChange={onBeatLabSynth2PianoInstrumentChange}
        patternCols={patternColsDrums}
        beatsPerBar={beatsPerBar}
        colsPerBar={MEASURES_PER_BAR}
        stepSubdiv={subdivHud}
        playheadStepCol={0}
        isPlaying={false}
        playheadElRef={beatLabSynth2PlaylineRef}
        playheadMountOnly
        scrollContainerRef={beatLabSynthScrollRef}
        playingMidis={synthV2PlayingMidis}
        onNotesChange={patchBeatLabSynthLaneNotes}
        onSeekStepCol={seekTransportToPatternColumn}
        onPreviewMidi={previewBeatLabMelodicMidi}
        onSustainMidi={(l, midi) => sustainHarmonyPianoKey(l, midi)}
        onReleaseMidi={() => releaseHarmonyPianoKey()}
        onPreviewHarmonyMidis={previewHarmonyChordMidis}
        onSelectLane={setSelectedBeatLabLane}
        channelLabelForLane={beatLabMelodicChannelLabel}
        melodicInstruments={currentMelodicInstruments}
        melodicSynthPresetIds={currentMelodicSynthPresetIds}
        onMelodicInstrumentChange={patchMelodicInstrument}
        onMelodicSynthPresetChange={patchMelodicSynthPreset}
        editTool={beatLabEditTool}
        onEditGestureStart={beginBeatLabUndoGesture}
        onEditGestureEnd={endBeatLabUndoGesture}
        onGridCellFocus={(stepCol) => {
          beatLabSynthFocusRef.current = { lane: beatLabSynthHarmonyLane, col: stepCol };
        }}
        disabled={CREATION_BACKEND_BLANK}
        chordRail={beatLabSynthChordRail}
      />
    ),
    [
      currentMidiRoll,
      beatLabSynthHarmonyLane,
      beatLabSynth2PianoInstrument,
      onBeatLabSynth2PianoInstrumentChange,
      patternColsDrums,
      beatsPerBar,
      subdivHud,
      synthV2PlayingMidis,
      patchBeatLabSynthLaneNotes,
      seekTransportToPatternColumn,
      previewBeatLabMelodicMidi,
      sustainHarmonyPianoKey,
      releaseHarmonyPianoKey,
      previewHarmonyChordMidis,
      beatLabMelodicChannelLabel,
      currentMelodicInstruments,
      currentMelodicSynthPresetIds,
      patchMelodicInstrument,
      patchMelodicSynthPreset,
      beatLabEditTool,
      beginBeatLabUndoGesture,
      endBeatLabUndoGesture,
      beatLabSynthChordRail,
    ],
  );

  const beatLabSynthV2RollChrome = useMemo(
    () => (
      <>
        <BeatLabSynthV2ChannelAssign
          bassLane={beatLabSynthBassLane}
          harmonyLane={beatLabSynthHarmonyLane}
          pianoInstrumentId={beatLabSynth2PianoInstrument}
          onBassLaneChange={setBeatLabSynth2BassLaneSafe}
          onHarmonyLaneChange={setBeatLabSynth2HarmonyLaneSafe}
          onPianoInstrumentChange={onBeatLabSynth2PianoInstrumentChange}
          disabled={CREATION_BACKEND_BLANK}
        />
        <button
          type="button"
          disabled={CREATION_BACKEND_BLANK}
          onClick={() => transposeBeatLabSynthHarmonyOctaves(-1)}
          title="Transpose piano-roll chords down one octave (−12 semitones)"
          style={{
            fontSize: 8,
            fontWeight: 900,
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid #3a4860',
            background: '#121820',
            color: '#d8e4f8',
            cursor: CREATION_BACKEND_BLANK ? 'default' : 'pointer',
            opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
          }}
        >
          −8va
        </button>
        <button
          type="button"
          disabled={CREATION_BACKEND_BLANK}
          onClick={() => transposeBeatLabSynthHarmonyOctaves(1)}
          title="Transpose piano-roll chords up one octave (+12 semitones)"
          style={{
            fontSize: 8,
            fontWeight: 900,
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid #3a4860',
            background: '#121820',
            color: '#d8e4f8',
            cursor: CREATION_BACKEND_BLANK ? 'default' : 'pointer',
            opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
          }}
        >
          +8va
        </button>
        <button
          type="button"
          disabled={
            CREATION_BACKEND_BLANK ||
            beatLabSynthV2HarmonyColumnsOnLane(
              beatLabSynthHarmonyLaneNotes,
              beatLabSynthHarmonyLane,
              beatLabSynthHarmonyMidiAt,
            ).size === 0
          }
          onClick={toggleBeatLabSynthChordMute}
          title={
            beatLabSynthChordsMuted
              ? 'Unmute chord stacks on the piano roll'
              : 'Mute chord stacks — hear bass only; chords stay for GENERATOR'
          }
          style={{
            fontSize: 8,
            fontWeight: 900,
            padding: '4px 8px',
            borderRadius: 4,
            border: `1px solid ${beatLabSynthChordsMuted ? 'rgba(251,191,36,0.5)' : 'rgba(147,197,253,0.45)'}`,
            background: beatLabSynthChordsMuted ? 'rgba(251,191,36,0.12)' : 'rgba(59,130,246,0.1)',
            color: beatLabSynthChordsMuted ? '#fde68a' : '#bfdbfe',
            cursor: CREATION_BACKEND_BLANK ? 'default' : 'pointer',
            opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
          }}
        >
          {beatLabSynthChordsMuted ? 'Unmute chords' : 'Mute chords'}
        </button>
        {beatLabSynthChordRail ? (
          <>
            <span
              title="Imported from Chord Builder — bar headers follow chord rhythm"
              style={{
                fontSize: 8,
                fontWeight: 800,
                color: '#58c4ff',
                padding: '3px 8px',
                borderRadius: 4,
                border: '1px solid rgba(88, 196, 255, 0.35)',
                background: 'rgba(88, 196, 255, 0.07)',
                whiteSpace: 'nowrap',
              }}
            >
              {KEY_ROOTS.find((k) => k.value === beatLabSynthChordRail.keyRoot)?.label ?? '?'}
              {` ${MODE_LABELS[beatLabSynthChordRail.mode]} · chord rail`}
            </span>
            <button
              type="button"
              onClick={() => setBeatLabSynthChordRail(null)}
              title="Hide chord names in the roll (MIDI notes stay)"
              style={{
                fontSize: 8,
                fontWeight: 800,
                padding: '4px 8px',
                borderRadius: 4,
                border: '1px solid #4a3848',
                background: '#18141a',
                color: '#b8a8bc',
                cursor: 'pointer',
              }}
            >
              Clear chord rail
            </button>
          </>
        ) : null}
      </>
    ),
    [
      CREATION_BACKEND_BLANK,
      beatLabSynthBassLane,
      beatLabSynthHarmonyLane,
      beatLabSynth2PianoInstrument,
      setBeatLabSynth2BassLaneSafe,
      setBeatLabSynth2HarmonyLaneSafe,
      onBeatLabSynth2PianoInstrumentChange,
      beatLabSynthChordRail,
      beatLabSynthHarmonyMidiAt,
      beatLabSynthChordsMuted,
      beatLabSynthHarmonyLane,
      beatLabSynthHarmonyLaneNotes,
      toggleBeatLabSynthChordMute,
      transposeBeatLabSynthHarmonyOctaves,
    ],
  );

  const currentNotes = banks[activeBank]?.notes ?? [];
  const displayNotes = useMemo(
    () =>
      NOTES.map((n) => {
        const shifted = noteNameToMidi(n) + pianoRegisterShift * 12;
        return midiToNoteName(shifted);
      }),
    [pianoRegisterShift],
  );
  currentDrumsRef.current = currentDrums;

  const fireStepAt = useCallback((k: number, idealGridT: number, ctx: AudioContext) => {
    if (!runningRef.current || sessionStartRef.current <= 0) return false;
    if (k <= lastScheduledQuarterRef.current) return true;
    const subdiv = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
    const drumBeatOff = Math.floor(Math.max(0, loopOnRef.current ? loopStartBeatRef.current : 0) + 1e-8);
    const drumColOff = Math.floor(Math.max(0, loopOnRef.current ? loopStartBeatRef.current * subdiv : 0) + 1e-8);
    /** Must match {@link patternColsDrums} / playline / grid ? `patternColsDrumsBeats * subdiv` can exceed `TOTAL_COLS`. */
    const gridCols = Math.max(1, patternColsDrumsRef.current);
    const quarterSpan = Math.max(1, Math.floor(gridCols / subdiv));
    let posInPattern = k - drumBeatOff;
    if (loopOnRef.current && loopEndBeatRef.current > loopStartBeatRef.current) {
      const ls = Math.floor(loopStartBeatRef.current + 1e-8);
      const le = Math.floor(loopEndBeatRef.current + 1e-8);
      const span = Math.max(1, le - ls);
      posInPattern = ((k - ls) % span + span) % span;
    }
    const playModeR = patternPlayModeRef.current;
    const activeSlots = bankPatternSlotsRef.current[activeBank];
    const patternDrums =
      playModeR === 'chainAB' && activeSlots
        ? (((Math.floor(posInPattern / Math.max(1, quarterSpan)) % 2 + 2) % 2) === 0 ? activeSlots.A : activeSlots.B)
        : currentDrumsRef.current;
    const ctSnap = creationRefillCtSnapRef.current;
    const whenSnap = Math.max(idealGridT, ctSnap + SE2_AUDIO_START_FLOOR_SEC);
    const spbQ = 60 / Math.max(1, bpmRef.current);
    const subSpb = spbQ / subdiv;
    for (let s = 0; s < subdiv; s += 1) {
      const colInPattern = ((posInPattern * subdiv + s) % gridCols + gridCols) % gridCols;
      const bankCol = colInPattern + drumColOff;
      /** Metronome uses `idealGridT`; pads use `whenSnap` (chain floor). */
      const gridT = idealGridT + s * subSpb;
      const whenSub = whenSnap + s * subSpb;
      const harmonyStepMidis: number[] = [];
      let harmonyHighlightMs = 0;
      const colPitch = beatLabPitchSemiAtColumn(
        currentPitchAutomationRef.current,
        colInPattern,
        0,
      );
      const drumsFiredPads = new Set<number>();
      const gridSequencerOnly = beatLabDeckFocusRef.current === 'sequence';
      /** SYNTH / NEW SYNTH — piano-roll transport only; drum grid stays silent (one metronome + roll notes). */
      if (!beatLabDeckIsSynthRoll()) {
        patternDrums.forEach((row, pi) => {
          if (row[bankCol] && !mutedPadsRef.current[pi]) {
            drumsFiredPads.add(pi);
            const padVel = gridSequencerOnly
              ? pi === 0
                ? 92
                : (PAD_VEL[pi] ?? 90)
              : beatLabEffectiveVelocity(
                  PAD_VEL[pi],
                  currentVolAutomationRef.current,
                  colInPattern,
                );
            playPadSoundRef.current(pi, padVel, whenSub, colPitch);
          }
        });
      }
      /** Step grid (sequence deck) — 16 pad lanes only; roll/synth scheduling is on other decks. */
      if (beatLabDeckFocusRef.current !== 'synth2' && !gridSequencerOnly) {
      const roll = currentMidiRollRef.current;
      for (const n of roll) {
        if (n.col !== colInPattern || n.muted) continue;
        if (beatLabLaneIsPad(n.lane)) {
          if (drumsFiredPads.has(n.lane)) continue;
          if (!mutedPadsRef.current[n.lane]) {
            const effVel = beatLabEffectiveVelocity(
              n.vel,
              currentVolAutomationRef.current,
              colInPattern,
            );
            playPadSoundRef.current(
              n.lane,
              effVel,
              whenSub,
              n.pitchSemi ?? 0,
            );
          }
          continue;
        }
        const slot = beatLabMelodicSlotIndex(n.lane);
        const midi = Math.max(
          0,
          Math.min(
            127,
            Math.round(
              beatLabNoteMidi(n.lane, n) +
                beatLabPitchSemiAtColumn(currentPitchAutomationRef.current, colInPattern, 0),
            ),
          ),
        );
        const velocity = beatLabEffectiveVelocity(
          n.vel,
          currentVolAutomationRef.current,
          colInPattern,
        );
        const stepsPerBar = beatLabStepsPerBar(subdiv, beatsPerBarRef.current, MEASURES_PER_BAR);
        const colInBar = ((colInPattern % stepsPerBar) + stepsPerBar) % stepsPerBar;
        const safeLenCols = beatLabLaneNoteLenCols(n, colInPattern, roll, gridCols);
        const channelVolumes = channelVolumesRef.current;
        const bassLane = beatLabSynth2BassLaneRef.current;
        const harmonyLane = beatLabSynth2HarmonyLaneRef.current;

        /** Piano-roll / chord lane — always GM piano bank, never bass V2 presets. */
        if (beatLabSynth2IsHarmonyLane(n.lane, harmonyLane)) {
          /** Bar chords live on the first step of each bar — ignore stray sub-step columns. */
          if (colInBar !== 0) continue;
          const durationSec = Math.max(0.08, subSpb * safeLenCols);
          const pianoId = beatLabSynth2PianoInstrumentRef.current;
          /** Same grid instant as bass (`whenSub`) — smplr uses Web Audio `time` on that clock. */
          const whenChord = whenSub;
          const lead = BEAT_LAB_PIANO_TRANSPORT_ONSET_LEAD_SEC;
          const whenLocked = Math.max(whenChord - lead, ctx.currentTime + 0.001);
          scheduleBeatLabMelodicNote(ctx, {
            lane: n.lane,
            midi,
            velocity,
            when: whenChord,
            whenLocked,
            durationSec,
            channelVolumes,
            instrumentId: pianoId,
            instrumentGain: beatLabSynth2PianoRollInstrumentGain(pianoId),
            transportOnsetLeadSec: 0,
          });
          harmonyStepMidis.push(midi);
          harmonyHighlightMs = Math.max(harmonyHighlightMs, Math.round(durationSec * 1000));
          continue;
        }

        const whenNote = whenSub;

        /** Bass lane only — Web Audio bass synth (left panel presets). */
        if (!beatLabSynth2IsBassLane(n.lane, bassLane)) {
          const durationSec = Math.max(0.08, subSpb * safeLenCols);
          scheduleBeatLabMelodicNote(ctx, {
            lane: n.lane,
            midi,
            velocity,
            when: whenNote,
            durationSec,
            channelVolumes,
            instrumentId:
              melodicInstrumentsRef.current[slot] ??
              BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[slot] ??
              'acoustic_grand_piano',
          });
          continue;
        }

        const bassMidiAt = (note: BeatLabMidiNote) =>
          Math.max(
            0,
            Math.min(
              127,
              Math.round(
                beatLabNoteMidi(bassLane, note) +
                  beatLabPitchSemiAtColumn(currentPitchAutomationRef.current, colInPattern, 0),
              ),
            ),
          );
        if (!beatLabSynthV2IsLowestNoteAtCol(roll, n, colInPattern, bassLane, bassMidiAt)) {
          continue;
        }

        const bassSlot = beatLabMelodicSlotIndex(bassLane);
        const presetId =
          melodicSynthPresetIdsRef.current[bassSlot] ?? BEAT_LAB_DEFAULT_SYNTH_PRESET_ID;
        const voice =
          melodicSynthVoicesRef.current[bassSlot] ??
          beatLabBassSynthVoiceParamsFromPresetId(presetId);
        const durationSec = beatLabSynthV2TransportDurationSec(subSpb, safeLenCols, voice);
        const playLane = bassLane;
        const legatoFromMidi =
          voice.glideMode === 'legato'
            ? beatLabSynthV2LegatoSourceMidi(roll, playLane, colInPattern, bassMidiAt)
            : undefined;
        const chordRail = beatLabSynthChordRailRef.current;
        const chordFromMidi =
          voice.glideMode === 'chord' && chordRail
            ? beatLabSynthV2ChordGlideSourceMidi(
                roll,
                playLane,
                colInPattern,
                midi,
                chordRail,
                subdiv,
                MEASURES_PER_BAR,
                MEASURES_PER_BAR,
                voice.glideBarMask ?? 0xffffffff,
              )
            : undefined;
        const lead = BEAT_LAB_PIANO_TRANSPORT_ONSET_LEAD_SEC;
        const whenLockedBass =
          colInBar === 0
            ? Math.max(whenNote - lead, ctx.currentTime + 0.001)
            : undefined;
        scheduleBeatLabSynthV2Note(ctx, {
          lane: playLane,
          midi,
          velocity,
          when: whenNote,
          whenLocked: whenLockedBass,
          durationSec,
          channelVolumes,
          voice,
          legatoFromMidi,
          chordFromMidi,
          bpm: bpmRef.current,
          stepCol: colInPattern,
          stepLenCols: safeLenCols,
          subdiv,
          beatsPerBar: MEASURES_PER_BAR,
          strictNoteOff: true,
          keyRoot: chordRail?.keyRoot,
          keyMode: chordRail?.mode,
        });
      }
      }
      if (harmonyStepMidis.length > 0) {
        pulseHarmonyPianoKeyHighlight(harmonyStepMidis, harmonyHighlightMs);
      }
    }
    /**
     * Downbeat matches MSR / quant row: same quarter phase as {@link computeCreationTransportHudFromBeat}
     * (`floor(originBeat)`), not raw global `k % bpb` (which desyncs accents when play/seek starts mid-bar).
     */
    return true;
  }, [activeBank, originBeatRef, patternPlayModeRef, pulseHarmonyPianoKeyHighlight, triggerChannel]);

  const playCreationMetronomeClick = useCallback(
    (k: number, idealGridT: number, ctx: AudioContext) => {
      const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBarRef.current)));
      const orgQ = Math.floor(Math.max(0, originBeatRef.current) + 1e-8);
      const downbeat = (((k - orgQ) % bpb) + bpb) % bpb === 0;
      scheduleMetronomeClickAt(ctx, idealGridT, downbeat, creationRefillCtSnapRef.current);
    },
    [scheduleMetronomeClickAt],
  );

  const refillCreationSchedule = useCallback(
    (ctx: AudioContext, ctSnap: number, opts?: { loopContinuation?: boolean }) => {
      if (!runningRef.current || sessionStartRef.current <= 0) return;
      creationRefillCtSnapRef.current = ctSnap;
      if (runningRef.current && sessionStartRef.current > 0) {
        creationPerfSessionStartMsRef.current =
          performance.now() + (sessionStartRef.current - ctSnap) * 1000;
      }
      if (beatLabDeckFocusRef.current === 'synth2') {
        refillBeatLabSynth2Schedule(
          ctx,
          ctSnap,
          beatLabSynth2ClockFromMain(),
          beatLabSynth2TransportDataRef.current,
          playCreationMetronomeClick,
          () => metroOnRef.current,
          (midis, ms) => synth2HarmonyPulseRef.current(midis, ms),
          opts,
        );
        return;
      }
      const spb = 60 / Math.max(1, bpmRef.current);
      const tb = Math.max(1e-9, patternColsDrumsBeatsRef.current);
      refillCreationMetronome(
        ctx,
        ctSnap,
        spb,
        {
          nextMetroKRef,
          sessionStartRef,
          originBeatRef,
        },
        playCreationMetronomeClick,
        () => runningRef.current,
        () => metroOnRef.current,
        beatLabSampleDrumRefillOpts(
          ctx,
          { nextStepSampleRef },
          loopOnRef.current,
          loopStartBeatRef.current,
          loopEndBeatRef.current,
          opts,
        ),
        tb,
      );
      refillCreationTransportLookahead(
        ctx,
        ctSnap,
        spb,
        {
          nextStepBeatRef,
          nextStepTimeRef,
          sessionStartRef,
          originBeatRef,
          lastScheduledQuarterRef,
        },
        fireStepAt,
        () => runningRef.current,
        beatLabSampleDrumRefillOpts(
          ctx,
          { nextStepSampleRef },
          loopOnRef.current,
          loopStartBeatRef.current,
          loopEndBeatRef.current,
          opts,
        ),
      );
    },
    [beatLabSynth2ClockFromMain, fireStepAt, playCreationMetronomeClick],
  );

  refillCreationScheduleRef.current = refillCreationSchedule;

  onAudioContextRebuiltRef.current = (ctx: AudioContext) => {
    if (!runningRef.current) return;
    void ensureBeatLabMelodicInstrumentsReady(ctx, [
      ...melodicInstrumentsRef.current,
      beatLabSynth2PianoInstrumentRef.current,
    ]);
    const tCapture = Math.max(0, ctx.currentTime);
    sessionStartRef.current = tCapture + SE2_AUDIO_START_FLOOR_SEC;
    schedAnchorTimeRef.current = tCapture;
    schedAnchorPerfRef.current = performance.now();
    creationPerfSessionStartMsRef.current =
      performance.now() + (sessionStartRef.current - tCapture) * 1000;
    const spb = 60 / Math.max(1, bpmRef.current);
    const k0 = Math.ceil(originBeatRef.current - 1e-8);
    seedCreationTransportOnPlay(
      { nextStepBeatRef, nextStepTimeRef },
      originBeatRef.current,
      sessionStartRef.current,
      spb,
    );
    seedBeatLabSampleDrumClock(
      { nextStepSampleRef },
      sessionStartRef.current,
      originBeatRef.current,
      k0,
      bpmRef.current,
      ctx.sampleRate,
    );
    nextMetroKRef.current = k0;
    creationMetroClickBuffersRef.current = null;
    refillCreationScheduleRef.current(ctx, tCapture, { skipOverdueCatchUp: true });
    launchBeatLabActivePlaylineNow(cursorBeatRef.current, true, { immediateCompositorStart: true });
  };

  const clearAllQuantMeasureImperativeLit = useCallback(() => {
    const cells = quantMeasureCellElsRef.current;
    for (let i = 0; i < cells.length; i++) {
      const el = cells[i];
      if (!el) continue;
      if (el.hasAttribute('data-drum-quant-imperative-lit')) {
        clearQuantMeasureCellImperativeLit(el);
      }
    }
  }, []);

  /** Clear any legacy imperative quant styles after React commits / transport bumps. */
  useLayoutEffect(() => {
    if (tab !== 'grid') {
      for (const el of quantMeasureCellElsRef.current) {
        clearQuantMeasureCellImperativeLit(el);
      }
      return;
    }
    void transportBeatEpoch;
    clearAllQuantMeasureImperativeLit();
  }, [tab, transportBeatEpoch, clearAllQuantMeasureImperativeLit]);

  creationTransportOnFrameRef.current = (_bDisplayPump: number) => {
    /** SE2 `animationTick` — single authority; ignore pump-passed beat (Chord Builder / 808 use that path). */
    const totalBeats = Math.max(1e-9, patternColsDrumsBeatsRef.current);
    const audioAnchored = sessionStartRef.current > 0;
    const ctxFrame = ctxRef.current;

    /** SE2 `playheadWapiRef` — compositor visual beat; BAR/MSR from audio `bDisplay`. */
    let b: number;
    let bDisplay: number;

    if (beatLabDeckFocusRef.current === 'synth2') {
      if (runningRef.current && ctxFrame && ctxFrame.state === 'running' && audioAnchored) {
        bDisplay = beatLabDisplayBeatFromAudioClock(
          ctxFrame,
          { schedAnchorTimeRef, schedAnchorPerfRef },
          sessionStartRef.current,
          originBeatRef.current,
          bpmRef.current,
          totalBeats,
        );
      } else {
        bDisplay = displayBeatRef.current;
      }
      const synth2Anim = beatLabSynth2PlayheadWapiRefs.animRef.current;
      const synth2Seg = beatLabSynth2PlayheadWapiRefs.wapiSegStateRef.current;
      if (runningRef.current && synth2Anim && synth2Anim.playState !== 'idle') {
        b = beatLabSynth2BeatFromPlaylineWapiAnim(
          Number(synth2Anim.currentTime ?? 0),
          synth2Seg,
        );
      } else {
        b = bDisplay;
      }
      if (runningRef.current && synth2Anim && synth2Anim.playState !== 'idle' && audioAnchored) {
        ({ b, bDisplay } = beatLabSynth2AnimationTickLoopWrap({
          ctx: ctxFrame && ctxFrame.state !== 'closed' ? ctxFrame : null,
          anim: synth2Anim,
          seg: synth2Seg,
          b,
          bDisplay,
          totalBeats,
          bpm: bpmRef.current,
          loopOn: loopOnRef.current,
          loopStartBeat: loopStartBeatRef.current,
          loopEndBeat: loopEndBeatRef.current,
          playStartPerfMs: beatLabTransportPlayStartPerfRef.current,
          refs: {
            sessionStartRef,
            originBeatRef,
            schedAnchorTimeRef,
            schedAnchorPerfRef,
            nextMetroKRef,
            cursorBeatRef,
            displayBeatRef,
            perfSessionStartMsRef: creationPerfSessionStartMsRef,
            nextStepBeatRef,
            nextStepTimeRef,
            lastScheduledQuarterRef,
          },
          wapiPrevPhaseMsRef: beatLabSynth2WapiPrevPhaseMsRef,
          wapiLoopCycleSeenRef: beatLabSynth2WapiLoopCycleSeenRef,
          onPatternCycle: (ctxLoop, tCapture) => {
            haltBeatLabMelodicTransportNotes();
            haltBeatLabSynthV2TransportVoices();
            refillCreationScheduleRef.current(ctxLoop, tCapture, { loopContinuation: true });
          },
          onDiscreteLoopWrap: (ctxLoop, tCapture) => {
            haltBeatLabMelodicTransportNotes();
            haltBeatLabSynthV2TransportVoices();
            refillCreationScheduleRef.current(ctxLoop, tCapture, { loopContinuation: true });
          },
          seekPlaylineToBeat: (beat) => {
            seekRunningBeatLabSynth2PlaylineWapi(beatLabSynth2PlayheadWapiRefs, beat);
          },
        }));
      }
      if (runningRef.current) {
        cursorBeatRef.current = b;
        displayBeatRef.current = bDisplay;
        scrollBeatLabSynth2FollowBeat(b);
      }
    } else {
    const pianoPlaylineEl = beatLabPianoPlaylineEl();
    const preferPianoPlayline =
      tabRef.current === 'grid' &&
      beatLabDeckFocusRef.current !== 'synth2' &&
      beatLabDeckFocusRef.current !== 'sequence' &&
      pianoPlaylineEl != null;
    const wapiAnim = runningRef.current
        ? resolveCreationActivePlaylineAnim(
            creationPlaylineWapiRefs,
            drumPlaylineRef.current,
            pianoPlaylineEl,
            preferPianoPlayline,
          )
        : null;
      if (runningRef.current && wapiAnim?.playState === 'paused') {
        kickCreationPlaylineWapiPlaying(creationPlaylineWapiRefs);
      }
      const animMs = creationPlaylineWapiCompositorMs(wapiAnim);
      const seg = creationWapiSegStateRef.current;
      ({ b, bDisplay } = beatLabAnimationTickBeats({
        running: runningRef.current,
        ctx: ctxFrame && ctxFrame.state !== 'closed' ? ctxFrame : null,
        anchors: { schedAnchorTimeRef, schedAnchorPerfRef },
        sessionStart: sessionStartRef.current,
        originBeat: originBeatRef.current,
        bpm: bpmRef.current,
        totalBeats,
        loopOn: loopOnRef.current,
        loopStartBeat: loopStartBeatRef.current,
        loopEndBeat: loopEndBeatRef.current,
        animMs,
        seg,
        wapiBpm: creationWapiBpmRef.current,
      }));

    if (runningRef.current && wapiAnim && wapiAnim.playState !== 'idle' && audioAnchored) {
      const animMsLoop =
        animMs ??
        (wapiAnim.playState === 'running' ? Number(wapiAnim.currentTime ?? 0) : 0);
      ({ b, bDisplay } = beatLabAnimationTickLoopWrap({
        ctx: ctxFrame && ctxFrame.state !== 'closed' ? ctxFrame : null,
        animMs: animMsLoop,
        wapiPlayState: wapiAnim.playState,
        b,
        bDisplay,
        totalBeats,
        bpm: bpmRef.current,
        loopOn: loopOnRef.current,
        loopStartBeat: loopStartBeatRef.current,
        loopEndBeat: loopEndBeatRef.current,
        seg,
        playStartPerfMs: beatLabTransportPlayStartPerfRef.current,
        refs: {
          sessionStartRef,
          originBeatRef,
          schedAnchorTimeRef,
          schedAnchorPerfRef,
          nextMetroKRef,
          cursorBeatRef,
          displayBeatRef,
          perfSessionStartMsRef: creationPerfSessionStartMsRef,
          nextStepBeatRef,
          nextStepTimeRef,
          lastScheduledQuarterRef,
        },
        wapiLoopCycleSeenRef: creationWapiLoopCycleSeenRef,
        wapiPrevPhaseMsRef: creationWapiPrevPhaseMsRef,
        onSeamlessSplice: (ctxLoop, tCapture) => {
          cancelScheduledCreationMetroNodes();
          syncBeatLabSampleDrumClockToBeat(
            { nextStepSampleRef },
            sessionStartRef.current,
            originBeatRef.current,
            nextStepBeatRef.current,
            bpmRef.current,
            ctxLoop.sampleRate,
          );
          refillCreationScheduleRef.current(ctxLoop, tCapture, {
            loopContinuation: true,
          });
          queueMicrotask(() => {
            if (!runningRef.current) return;
            refillCreationScheduleRef.current(ctxLoop, Math.max(0, ctxLoop.currentTime), {
              loopContinuation: true,
            });
          });
        },
        onDiscreteWrap: (ctxLoop, tCapture) => {
          cancelScheduledCreationMetroNodes();
          syncBeatLabSampleDrumClockToBeat(
            { nextStepSampleRef },
            sessionStartRef.current,
            originBeatRef.current,
            nextStepBeatRef.current,
            bpmRef.current,
            ctxLoop.sampleRate,
          );
          refillCreationScheduleRef.current(ctxLoop, tCapture, { loopContinuation: true });
          queueMicrotask(() => {
            if (!runningRef.current) return;
            refillCreationScheduleRef.current(ctxLoop, Math.max(0, ctxLoop.currentTime), {
              loopContinuation: true,
            });
          });
        },
        relaunchPlaylineAtLoopStart: (ls) => {
          launchBeatLabActivePlaylineNow(ls, true, { immediateCompositorStart: true });
        },
      }));
    }
    }

    if (runningRef.current) {
      cursorBeatRef.current = b;
    }
    displayBeatRef.current = bDisplay;

    const qpbR = Math.max(2, Math.min(16, Math.round(beatsPerBarRef.current)));
    const subdiv = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
    const pcols = Math.max(1, patternColsDrumsRef.current);
    const loopStartBarR = Math.floor(loopStartBeatRef.current / qpbR) + 1;
    if (!runningRef.current) clearAllQuantMeasureImperativeLit();

    const hudRaf = computeCreationTransportHudFromBeat(bDisplay, {
      subdiv,
      pcols,
      loopOn: loopOnRef.current,
      loopStartBeat: loopStartBeatRef.current,
      loopEndBeat: loopEndBeatRef.current,
      playMode: patternPlayModeRef.current,
      loopStartBar: loopStartBarR,
      qpb: qpbR,
      transportOriginBeat: originBeatRef.current,
    });
    const gqHudKey = `${hudRaf.bar}|${hudRaf.measure}|${hudRaf.phrase}`;
    if (gqHudKey !== creationHudQuarterPaintedRef.current) {
      creationHudQuarterPaintedRef.current = gqHudKey;
      paintCreationHudQuarterIntoDom(
        creationHudDomRef.current,
        hudRaf,
        qpbR,
        { active: true },
        creationHudHoldRef,
        true,
      );
    }

    /**
     * DAW Follow (FL continuous / Cubase stationary cursor / Live Follow): WAAPI moves the
     * playhead; the grid scrolls underneath so the line stays in view across the full 64-bar grid.
     */
    if (
      followRef.current &&
      !beatLabFollowScrollPausedRef.current &&
      runningRef.current &&
      beatLabDeckFocusRef.current !== 'synth2'
    ) {
      const cwD = Math.max(colWidthRef.current, DRUM_GRID_MIN_CW);
      const cwP = beatLabPianoColWForView(Math.max(colWidthRef.current, PIANO_GRID_MIN_CW));
      const pos = creationPlaylineColFAndPx(
        b,
        subdiv,
        pcols,
        loopOnRef.current,
        loopStartBeatRef.current,
        loopEndBeatRef.current,
        patternPlayModeRef.current,
        cwD,
        cwP,
      );
      beatLabScrollGridFollowPlayhead(
        drumScrollRef.current,
        pos.drumX,
        beatLabProgrammaticScrollRef,
      );
      if (tabRef.current === 'grid') {
        beatLabScrollGridFollowPlayhead(
          beatLabDeckIsSynthRoll()
            ? beatLabSynthScrollRef.current
            : beatLabRollScrollRef.current,
          pos.pianoX,
          beatLabProgrammaticScrollRef,
        );
      } else {
        beatLabScrollGridFollowPlayhead(
          pianoScrollRef.current,
          pos.pianoX,
          beatLabProgrammaticScrollRef,
        );
      }
    }

    if (runningRef.current && ctxFrame && ctxFrame.state !== 'closed') {
      tickBeatLabChannelMeters(ctxFrame.currentTime, true);
    }

    const pub = creationTransportUiPublishRef.current;
    /** While playing, WAAPI is the only playhead — publish React only on BAR/MSR HUD changes. */
    const acWapi = creationPatternColFromDisplayBeat(
      b,
      subdiv,
      pcols,
      loopOnRef.current,
      loopStartBeatRef.current,
      loopEndBeatRef.current,
      patternPlayModeRef.current,
    );
    const churn = runningRef.current
      ? gqHudKey !== pub.hudKey
      : acWapi !== pub.activeCol || gqHudKey !== pub.hudKey;
    if (churn) {
      if (!runningRef.current) pub.activeCol = acWapi;
      pub.hudKey = gqHudKey;
      publishCreationTransportBeat();
    }
    paintCreationSe2TransportReadouts(bDisplay, false);
  };

  const beatLabTransportPumpActive = isScreenActive;

  /** Mixer VU decay while stopped — not part of transport rAF (SE2 meters live in `animationTick` only). */
  useEffect(() => {
    if (!isScreenActive || isPlaying) return;
    const id = window.setInterval(() => {
      const ctx = resolveBeatLabAudioContext(ctxRef, getOrCreateAudioContext);
      if (ctx.state !== 'closed') {
        tickBeatLabChannelMeters(ctx.currentTime, false);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [isScreenActive, isPlaying, getOrCreateAudioContext]);

  /** SE2 mirror: 25 ms audio clock only — visual rAF lives in the effect below. */
  useBeatLabSe2TransportMirror(
    {
      ctxRef,
      runningRef,
      sessionStartRef,
      originBeatRef,
      displayBeatRef,
      bpmRef,
      lastScheduledQuarterRef,
      schedAnchorTimeRef,
      schedAnchorPerfRef,
      totalBeatsRef: patternColsDrumsBeatsRef,
      perfSessionStartMsRef: creationPerfSessionStartMsRef,
    },
    {
      isScreenActive: beatLabTransportPumpActive,
      isPlaying: beatLabMainTransportPlaying,
      getOrCreateAudioContext,
      refillRef: refillCreationScheduleRef,
      onFrameRef: creationTransportOnFrameRef,
      onAudioContextRebuiltRef,
    },
  );

  /**
   * Playline relaunch — **same split as Studio Editor 2** (`StudioEditor2Screen` ~6220–6231):
   * 1) ?zoom? (here: column width + Creation-only grid geometry: snap subdiv, chain mode, pattern width).
   * 2) Loop bounds only (`loopOn` / `loopStartBeat` / `loopEndBeat`).
   * 3) **BPM / pattern column count** ? separate effects below so WAAPI `durationMs` always matches
   *    `60/bpm` like the metronome / lookahead when tempo or loop bar count changes during play.
   * Uses `runningRef` like SE2 uses `runningRef`, **not** `isPlaying` in deps, so Play/Resume does not
   * immediately re-cancel the anim that `startTransport` just started.
   */
  useEffect(() => {
    if (!isScreenActive) return;
    const geomKey = `${colWidth}|${drumStepSubdiv}|${patternPlayMode}|${patternColsDrums}`;
    if (runningRef.current) {
      if (beatLabPlaylineGeomKeyRef.current === geomKey) return;
      const beat = cursorBeatRef.current;
      beatLabPlaylineGeomKeyRef.current = geomKey;
      launchBeatLabActivePlaylineNow(beat, true, { immediateCompositorStart: true });
    } else {
      beatLabPlaylineGeomKeyRef.current = geomKey;
      updateCreationPlaylineTransforms(cursorBeatRef.current);
    }
  }, [
    beatLabDeckFocus,
    colWidth,
    drumStepSubdiv,
    patternPlayMode,
    patternColsDrums,
    isScreenActive,
    launchBeatLabActivePlaylineNow,
    updateCreationPlaylineTransforms,
  ]);

  /** Tempo change during play — re-anchor step/metro clocks to audio beat, then rebuild WAAPI. */
  useEffect(() => {
    if (!isScreenActive || !runningRef.current) {
      beatLabLastPlayBpmRef.current = bpm;
      return;
    }
    if (beatLabLastPlayBpmRef.current === bpm) return;
    beatLabLastPlayBpmRef.current = bpm;
    const ctx = ctxRef.current;
    if (!ctx || ctx.state === 'closed') return;
    const tb = Math.max(1e-9, patternColsDrumsBeatsRef.current);
    const b = beatLabDisplayBeatFromAudioClock(
      ctx,
      { schedAnchorTimeRef, schedAnchorPerfRef },
      sessionStartRef.current,
      originBeatRef.current,
      bpmRef.current,
      tb,
    );
    displayBeatRef.current = b;
    const spb = 60 / Math.max(1, bpmRef.current);
    reanchorNextStepWhileRunning(
      {
        nextStepBeatRef,
        nextStepTimeRef,
        sessionStartRef,
        originBeatRef,
        lastScheduledQuarterRef,
      },
      sessionStartRef.current,
      b,
      spb,
    );
    syncBeatLabSampleDrumClockToBeat(
      { nextStepSampleRef },
      sessionStartRef.current,
      originBeatRef.current,
      nextStepBeatRef.current,
      bpmRef.current,
      ctx.sampleRate,
    );
    nextMetroKRef.current = beatLabSnapBeatToQuarterGrid(
      b,
      Math.max(1e-9, patternColsDrumsBeatsRef.current),
    );
    cancelScheduledCreationMetroNodes();
    refillCreationScheduleRef.current(ctx, Math.max(0, ctx.currentTime), { skipOverdueCatchUp: true });
    launchBeatLabActivePlaylineNow(b, true, { immediateCompositorStart: true });
  }, [bpm, isScreenActive, launchBeatLabActivePlaylineNow]);

  useEffect(() => {
    if (!isScreenActive || !runningRef.current) return;
    launchBeatLabActivePlaylineNow(cursorBeatRef.current, true, { immediateCompositorStart: true });
  }, [loopOn, loopStartBeat, loopEndBeat, isScreenActive, launchBeatLabActivePlaylineNow]);

  /** Deck-aware playline rebuild (grid roll vs NEW SYNTH) — one WAAPI authority via `launchBeatLabActivePlaylineNow`. */
  useEffect(() => {
    if (!isScreenActive || tab !== 'grid') return;
    if (runningRef.current) {
      launchBeatLabActivePlaylineNow(cursorBeatRef.current, true, { immediateCompositorStart: true });
    } else if (beatLabDeckFocus !== 'synth2') {
      updateCreationPlaylineTransforms(cursorBeatRef.current);
    }
  }, [
    beatLabDeckFocus,
    pianoSnapSubdiv,
    isScreenActive,
    launchBeatLabActivePlaylineNow,
    updateCreationPlaylineTransforms,
    tab,
  ]);

  /** Loop bounds change while stopped ? static playline only (no second WAAPI launch with zoom effect). */
  useEffect(() => {
    if (!isScreenActive || runningRef.current || beatLabDeckFocus === 'synth2') return;
    updateCreationPlaylineTransforms(cursorBeatRef.current);
  }, [beatLabDeckFocus, loopOn, loopStartBeat, loopEndBeat, isScreenActive, updateCreationPlaylineTransforms]);

  const zoomIn    = useCallback(() => {
    setBeatLabGridZoomMode('min');
    setColWidth(w => Math.min(MAX_CW, w + ZOOM_STEP));
  }, []);
  const zoomOut   = useCallback(() => {
    setBeatLabGridZoomMode('min');
    setColWidth(w => Math.max(MIN_CW, w - ZOOM_STEP));
  }, []);
  const zoomReset = useCallback(() => {
    setBeatLabGridZoomMode('min');
    setColWidth(DEF_CW);
  }, []);
  /** Toolbar FIT + MAX zoom ? fit loop columns to the active grid viewport. */
  const fitDrumGridToLoop = useCallback(() => {
    setBeatLabGridZoomMode('max');
    fitBeatLabGridToViewport();
  }, [fitBeatLabGridToViewport]);
  /** Refit column width whenever loop length / step count changes (MAX zoom only). */
  useEffect(() => {
    if (tab !== 'grid' || beatLabGridZoomMode !== 'max') return;
    const run = () => fitBeatLabGridToViewport();
    const id = requestAnimationFrame(() => {
      if (beatLabDeckFocus === 'sequence') requestAnimationFrame(run);
      else run();
    });
    return () => cancelAnimationFrame(id);
  }, [fitBeatLabGridToViewport, patternColsDrums, loopBars, pianoSnapSubdiv, tab, beatLabDeckFocus, beatLabGridZoomMode]);

  /** MAX zoom: keep columns fitted when the active grid viewport resizes. */
  useEffect(() => {
    if (tab !== 'grid' || beatLabGridZoomMode !== 'max') return;
    const el =
      beatLabDeckFocus === 'sequence'
        ? drumScrollRef.current
        : beatLabRollScrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => fitBeatLabGridToViewport());
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab, beatLabDeckFocus, beatLabGridZoomMode, beatLabGridFullView, fitBeatLabGridToViewport]);

  /** MAX zoom: refit when switching GRID / ROLL. */
  useEffect(() => {
    if (tab !== 'grid' || beatLabGridZoomMode !== 'max') return;
    const id = requestAnimationFrame(() => fitBeatLabGridToViewport());
    return () => cancelAnimationFrame(id);
  }, [beatLabDeckFocus, beatLabGridZoomMode, fitBeatLabGridToViewport, tab]);

  const beatLabSessionZoomTools = useMemo(
    () => (
      <>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid #2a2a32',
            background: '#090909',
            flexShrink: 0,
          }}
          title="Creation patterns sync to the DAW session when you arrange or open Studio"
        >
          <span style={{ fontSize: 8, color: '#6a6a78', fontFamily: 'monospace', letterSpacing: 0.5 }}>SESSION</span>
          <span style={{ fontSize: 9, color: '#666', fontFamily: 'monospace', fontWeight: 700 }}>LINKED</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#0a0a0e',
            border: '1px solid #2a2a32',
            borderRadius: 4,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <button type="button" onClick={zoomOut} style={{ padding: '3px 7px', background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><ZoomOut size={11} /></button>
          <span style={{ padding: '0 6px', fontFamily: 'monospace', fontSize: 10, color: '#4a4a58', borderLeft: '1px solid #2a2a32', borderRight: '1px solid #2a2a32' }}>{colWidth}px</span>
          <input
            type="range"
            min={MIN_CW}
            max={MAX_CW}
            step={1}
            value={colWidth}
            onChange={(e) => {
              setBeatLabGridZoomMode('min');
              setColWidth(Number(e.target.value));
            }}
            style={{ width: 92, height: 4, margin: '0 6px', accentColor: '#00E5FF', cursor: 'ew-resize' }}
            title="Drag to zoom grid in/out"
          />
          <button type="button" onClick={zoomIn} style={{ padding: '3px 7px', background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><ZoomIn size={11} /></button>
          <button type="button" onClick={zoomReset} style={{ padding: '3px 7px', background: 'none', border: 'none', color: '#666', cursor: 'pointer', borderLeft: '1px solid #2a2a32' }}><Maximize2 size={11} /></button>
          <button
            type="button"
            onClick={fitDrumGridToLoop}
            style={{ padding: '3px 8px', background: 'none', border: 'none', color: '#7aa2b8', cursor: 'pointer', borderLeft: '1px solid #2a2a32', fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }}
            title={`Fit ${loopBars} bar${loopBars !== 1 ? 's' : ''} to screen`}
          >
            FIT
          </button>
          <button
            type="button"
            onClick={() => setBeatLabTileGrid((v) => !v)}
            style={{
              padding: '3px 8px',
              background: beatLabTileGrid ? 'rgba(124, 244, 198, 0.12)' : 'none',
              border: 'none',
              borderLeft: '1px solid #2a2a32',
              color: beatLabTileGrid ? '#7cf4c6' : '#666',
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'monospace',
              fontWeight: 700,
            }}
            title={
              beatLabTileGrid
                ? 'Square step tiles on — click for classic full-cell grid'
                : 'Square step tiles off — click for Drumloop-style square grid'
            }
          >
            TILES
          </button>
        </div>
      </>
    ),
    [beatLabTileGrid, colWidth, fitDrumGridToLoop, loopBars, zoomIn, zoomOut, zoomReset],
  );

  const beatLabSnapTools = useMemo(
    () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 8, color: '#6a6a78', fontWeight: 700 }}>SNAP</span>
        <select
          value={normalizePianoSnapSubdiv(pianoSnapSubdiv)}
          title={`Snap ? ${PPQ} PPQ; one column = ${Math.round(ticksPerPianoSnapCell(PPQ, normalizePianoSnapSubdiv(pianoSnapSubdiv)))} ticks at this grid; zoom changes pixel width`}
          onChange={(e) => setPianoSnapSubdiv(Number(e.target.value))}
          style={{
            height: 28,
            borderRadius: 4,
            border: '1px solid #2a2a32',
            background: '#0a0a0e',
            color: '#7cf4c6',
            fontSize: 11,
            fontFamily: 'monospace',
            fontWeight: 700,
            cursor: 'pointer',
            minWidth: 56,
          }}
        >
          <option value={1}>{snapLabelFromPianoSnapSubdiv(1)}</option>
          <option value={2}>{snapLabelFromPianoSnapSubdiv(2)}</option>
          <option value={3}>{snapLabelFromPianoSnapSubdiv(3)}</option>
          <option value={4}>{snapLabelFromPianoSnapSubdiv(4)}</option>
          <option value={6}>{snapLabelFromPianoSnapSubdiv(6)}</option>
          <option value={8}>{snapLabelFromPianoSnapSubdiv(8)}</option>
          <option value={16}>{snapLabelFromPianoSnapSubdiv(16)}</option>
          <option value={32}>{snapLabelFromPianoSnapSubdiv(32)}</option>
        </select>
      </div>
    ),
    [pianoSnapSubdiv],
  );

  const stopPadSamplePlayback = useCallback((padIndex: number) => {
    const key = padSampleKey(activeBank, padIndex);
    const bag = padSampleActiveStoppersRef.current.get(key);
    if (!bag?.size) return;
    padSampleActiveStoppersRef.current.delete(key);
    for (const fn of [...bag]) {
      try {
        fn();
      } catch {
        /* */
      }
    }
  }, [activeBank]);

  const clearPadSample = useCallback((padIndex: number) => {
    stopPadSamplePlayback(padIndex);
    const k = padSampleKey(activeBank, padIndex);
    padSampleBuffersRef.current.delete(k);
    delete padSamplePlaybackOptsRef.current[k];
    delete padSampleFxRackRef.current[k];
    delete padSampleRootMidiRef.current[k];
    delete padSampleStrikeMidiRef.current[k];
    delete padSampleChromaticRef.current[k];
    setPadSamplePresence(prev => {
      const n = { ...prev };
      delete n[k];
      return n;
    });
    setPadSampleRootBpms((prev) => {
      const n = { ...prev };
      delete n[k];
      return n;
    });
    setPadSampleLabels((prev) => {
      const n = { ...prev };
      delete n[k];
      return n;
    });
    const store = loadPadSampleStore();
    delete store[k];
    savePadSampleStore(store);
  }, [activeBank, stopPadSamplePlayback]);

  const flashKitImportHint = useCallback((msg: string) => {
    setKitImportHint(msg);
    if (kitImportHintTimerRef.current != null) {
      window.clearTimeout(kitImportHintTimerRef.current);
    }
    kitImportHintTimerRef.current = window.setTimeout(() => {
      setKitImportHint(null);
      kitImportHintTimerRef.current = null;
    }, 4500);
  }, []);

  /** Legacy spread was persisted to localStorage — strip stuck layout when there is no undo session. */
  useEffect(() => {
    if (readBeatPadsSpreadSession()?.bank === activeBank) return;
    if (clearedOrphanSpreadBanksRef.current.has(activeBank)) return;
    if (
      !bankLooksLikeBeatPadsSpread(
        activeBank,
        padSampleLabels,
        padSamplePresence,
        padSampleChromaticRef.current,
      )
    ) {
      return;
    }
    clearedOrphanSpreadBanksRef.current.add(activeBank);
    const store = loadPadSampleStore();
    for (let pi = 0; pi < 16; pi += 1) {
      const k = padSampleKey(activeBank, pi);
      stopPadSamplePlayback(pi);
      padSampleBuffersRef.current.delete(k);
      delete padSamplePlaybackOptsRef.current[k];
      delete padSampleFxRackRef.current[k];
      delete padSampleRootMidiRef.current[k];
      delete padSampleStrikeMidiRef.current[k];
      delete padSampleChromaticRef.current[k];
      delete store[k];
    }
    savePadSampleStore(store);
    setPadSamplePresence((prev) => {
      const n = { ...prev };
      for (let pi = 0; pi < 16; pi += 1) delete n[padSampleKey(activeBank, pi)];
      return n;
    });
    setPadSampleRootBpms((prev) => {
      const n = { ...prev };
      for (let pi = 0; pi < 16; pi += 1) delete n[padSampleKey(activeBank, pi)];
      return n;
    });
    setPadSampleLabels((prev) => {
      const n = { ...prev };
      for (let pi = 0; pi < 16; pi += 1) delete n[padSampleKey(activeBank, pi)];
      return n;
    });
    flashKitImportHint('Old spread layout cleared — reload your kit or spread again');
  }, [activeBank, flashKitImportHint, padSampleLabels, padSamplePresence, stopPadSamplePlayback]);

  /** DrumloopAI-style grid: 1/16 snap, full grid + FIT (8/16-bar default or 1-bar classic). Loop brace stays off until you enable it. */
  const applyDrumloopGridPreset = useCallback(
    (variant: BeatLabDrumloopPresetVariant = '8bar') => {
      const bars = drumloopLoopBarsForVariant(variant);
      const bpb = beatsPerBarRef.current;
      setBeatLabDrumloopPresetActive(variant);
      setLoopBars(bars);
      setPianoSnapSubdiv(BEAT_LAB_DRUMLOOP_SNAP_SUBDIV);
      setLoopOn(false);
      setLoopRangeBeats(0, bars * bpb);
      setBeatLabEditTool('draw');
      setBeatLabGridLayoutMode('full');
      if (beatLabDeckFocus !== 'sequence') setBeatLabDeckFocus('sequence');
      setBeatLabGridZoomMode('max');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => fitBeatLabGridToViewport());
      });
      flashKitImportHint(
        `Drumloop grid · 1/16 · ${bars} bar${bars === 1 ? '' : 's'} · loop off · draw tool`,
      );
    },
    [beatLabDeckFocus, fitBeatLabGridToViewport, flashKitImportHint, setLoopRangeBeats],
  );

  const canUndoBeatLabDup = useMemo(() => {
    void beatLabDupUndoRev;
    return beatLabDupUndoStackRef.current.length > 0;
  }, [beatLabDupUndoRev]);

  const undoBeatLabDup = useCallback(() => {
    const stack = beatLabDupUndoStackRef.current;
    if (!stack.length) return;
    const snap = stack[stack.length - 1]!;
    beatLabDupUndoStackRef.current = stack.slice(0, -1);
    const restored = restoreBeatLabHistorySnapshot(snap);
    setBanks(restored.banks);
    setBankPatternSlots(restored.bankPatternSlots);
    setLoopBars(Math.max(1, Math.min(BEAT_LAB_MAX_LOOP_BARS, restored.loopBars)));
    setLoopStartBeat(restored.loopStartBeat);
    setLoopEndBeat(restored.loopEndBeat);
    setLoopOn(restored.loopOn);
    setBeatLabDupUndoRev((n) => n + 1);
    flashKitImportHint('Undid loop duplicate');
  }, [flashKitImportHint]);

  /** Append a copy of the current loop region (doubles bar count, e.g. 4 → 8). */
  const duplicateBeatLabLoop = useCallback(() => {
    if (CREATION_BACKEND_BLANK) return;
    const subdiv = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
    const spanCols = beatLabLoopSpanPatternCols(
      loopStartBeatRef.current,
      loopEndBeatRef.current,
      subdiv,
    );
    const currentBars = loopBarsRef.current;
    const newLoopBars = Math.min(BEAT_LAB_MAX_LOOP_BARS, currentBars * 2);
    const bpb = beatsPerBarRef.current;
    const maxCols = Math.min(TOTAL_COLS, Math.round(newLoopBars * bpb * subdiv + 1e-6));
    if (spanCols * 2 > maxCols) {
      const maxBars = Math.max(1, Math.floor(maxCols / Math.max(1, bpb * subdiv)));
      flashKitImportHint(`Cannot duplicate — max about ${maxBars} bars at this snap`);
      return;
    }

    const bank = banksRef.current[activeBank];
    if (!bank) return;
    const result = beatLabDuplicateLoopPattern({
      drums: normalizeBankDrumPattern(bank.drums),
      midiRoll: bank.midiRoll ?? [],
      drumColOffset: drumColOffsetRef.current,
      spanCols,
      maxPatternCols: maxCols,
    });
    if (!result) {
      flashKitImportHint('Nothing to duplicate');
      return;
    }

    beatLabDupUndoStackRef.current = [
      ...beatLabDupUndoStackRef.current.slice(-(BEAT_LAB_DUP_UNDO_STACK_MAX - 1)),
      captureCurrentBeatLabSnapshot(),
    ];
    setBeatLabDupUndoRev((n) => n + 1);
    setBanks((prev) =>
      prev.map((b, i) =>
        i === activeBank
          ? {
              ...b,
              drums: result.drums,
              midiRoll: result.midiRoll,
            }
          : b,
      ),
    );
    setBankPatternSlots((prev) =>
      prev.map((slots, i) =>
        i !== activeBank
          ? slots
          : {
              ...slots,
              [patternSlot]: result.drums.map((row) => row.slice()),
            },
      ),
    );
    setLoopBars(newLoopBars);
    setLoopRangeBeats(loopStartBeatRef.current, loopStartBeatRef.current + newLoopBars * bpb);
    setLoopOn(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => fitBeatLabGridToViewport());
    });
    flashKitImportHint(
      `Duplicated ${currentBars} bar${currentBars === 1 ? '' : 's'} → ${newLoopBars} bars total`,
    );
  }, [
    activeBank,
    captureCurrentBeatLabSnapshot,
    fitBeatLabGridToViewport,
    flashKitImportHint,
    patternSlot,
    setLoopRangeBeats,
  ]);

  const applyKitPadsToActiveBank = useCallback(
    async (pads: Record<string, StoredPadSample>) => {
      clearBeatPadsSpreadTrack();
      const ctx = await ensureCtx();
      const store = loadPadSampleStore();
      for (let pi = 0; pi < 16; pi++) {
        stopPadSamplePlayback(pi);
        const k = padSampleKey(activeBank, pi);
        padSampleBuffersRef.current.delete(k);
        delete padSamplePlaybackOptsRef.current[k];
        delete padSampleFxRackRef.current[k];
        delete padSampleRootMidiRef.current[k];
        delete padSampleStrikeMidiRef.current[k];
        delete padSampleChromaticRef.current[k];
        delete store[k];
      }
      let loaded = 0;
      const nextPresence: Record<string, boolean> = {};
      const nextRoots: Record<string, number> = {};
      const nextLabels: Record<string, string> = {};
      for (const [piStr, stored] of Object.entries(pads)) {
        const pi = Number(piStr);
        if (!Number.isFinite(pi) || pi < 0 || pi > 15 || !stored?.data) continue;
        try {
          const ab = storedToArrayBuffer(stored);
          const buf = await ctx.decodeAudioData(ab.slice(0));
          const k = padSampleKey(activeBank, pi);
          const row = JSON.parse(JSON.stringify(stored)) as typeof stored;
          padSampleBuffersRef.current.set(k, buf);
          padSamplePlaybackOptsRef.current[k] = samplerOptsFromStored(row);
          padSampleFxRackRef.current[k] = fxRackFromStored(row);
          const chromMeta = chromaticPadMetaFromStored(row);
          if (chromMeta) {
            padSampleRootMidiRef.current[k] = chromMeta.rootMidi;
            padSampleChromaticRef.current[k] = true;
            if (typeof chromMeta.strikeMidi === 'number') {
              padSampleStrikeMidiRef.current[k] = chromMeta.strikeMidi;
            } else {
              delete padSampleStrikeMidiRef.current[k];
            }
          } else {
            delete padSampleRootMidiRef.current[k];
            delete padSampleStrikeMidiRef.current[k];
            delete padSampleChromaticRef.current[k];
          }
          store[k] = row;
          nextPresence[k] = true;
          const rb = row.rootBpm;
          if (typeof rb === 'number' && rb > 0) nextRoots[k] = rb;
          const lb = typeof row.label === 'string' ? row.label.trim() : '';
          if (lb) nextLabels[k] = lb;
          loaded++;
        } catch {
          /* skip corrupt pad */
        }
      }
      savePadSampleStore(store);
      setPadSamplePresence((prev) => {
        const n = { ...prev };
        for (let pi = 0; pi < 16; pi++) delete n[padSampleKey(activeBank, pi)];
        return { ...n, ...nextPresence };
      });
      setPadSampleRootBpms((prev) => {
        const n = { ...prev };
        for (let pi = 0; pi < 16; pi++) delete n[padSampleKey(activeBank, pi)];
        return { ...n, ...nextRoots };
      });
      setPadSampleLabels((prev) => {
        const n = { ...prev };
        for (let pi = 0; pi < 16; pi++) delete n[padSampleKey(activeBank, pi)];
        return { ...n, ...nextLabels };
      });
      return loaded;
    },
    [activeBank, clearBeatPadsSpreadTrack, ensureCtx, stopPadSamplePlayback],
  );

  const applySavedBeatLabKit = useCallback(
    async (kitId: string) => {
      const saved = findBeatLabSavedKit(savedKits, kitId);
      if (!saved) {
        flashKitImportHint('Saved kit not found');
        return;
      }
      const loaded = await applyKitPadsToActiveBank(saved.pads);
      setKit(saved.name);
      setKitSelectValue(`saved:${saved.id}`);
      flashKitImportHint(
        loaded > 0
          ? `Loaded "${saved.name}" ? ${loaded} pad${loaded === 1 ? '' : 's'} on bank ${BANKS[activeBank]}`
          : `Kit "${saved.name}" had no valid samples`,
      );
    },
    [activeBank, applyKitPadsToActiveBank, flashKitImportHint, savedKits],
  );

  const applySavedBeatLabSong = useCallback(
    async (songId: string) => {
      const song = findBeatLabSavedSong(savedSongs, songId);
      if (!song) {
        flashKitImportHint('Saved song not found');
        return;
      }
      const seq = song.sequence;
      const bpb = MEASURES_PER_BAR;
      const loopBarsClamped = Math.max(1, Math.min(BEAT_LAB_MAX_LOOP_BARS, seq.loopBars));
      setBpm(seq.bpm);
      setBpmInput(String(Math.round(seq.bpm)));
      setLoopBars(loopBarsClamped);
      setLoopOn(false);
      setLoopRangeBeats(0, loopBarsClamped * bpb);
      setBeatsPerBar(MEASURES_PER_BAR);
      setPatternPlayMode(seq.patternPlayMode);
      setPianoSnapSubdiv(normalizePianoSnapSubdiv(seq.drumStepSubdiv));
      const patA = normalizeSavedDrumPattern(seq.patternA);
      const patB = normalizeSavedDrumPattern(seq.patternB);
      const activePat = seq.activePatternSlot === 'B' ? patB : patA;
      setPatternSlot(seq.activePatternSlot);
      setBankPatternSlots((prev) =>
        prev.map((slots, i) => (i !== activeBank ? slots : { A: patA, B: patB })),
      );
      setBanks((prev) =>
        prev.map((b, i) =>
          i !== activeBank ? b : { ...b, drums: activePat.map((row) => row.slice()) },
        ),
      );
      const loaded = await applyKitPadsToActiveBank(song.kit.pads);
      setKit(song.kit.label?.trim() || song.name);
      setKitSelectValue(`preset:${KITS[0]}`);
      const steps = countSequenceSteps(seq);
      flashKitImportHint(
        `Loaded "${song.name}" ? ${steps} step${steps === 1 ? '' : 's'}, ${loaded} pad${loaded === 1 ? '' : 's'} (bank ${BANKS[activeBank]}, slot ${seq.activePatternSlot})`,
      );
      setSaveSongStatus(`Loaded "${song.name}"`);
    },
    [activeBank, applyKitPadsToActiveBank, flashKitImportHint, savedSongs, setLoopRangeBeats],
  );

  const handleKitSelectChange = useCallback(
    (value: string) => {
      setKitSelectValue(value);
      if (value.startsWith('saved:')) {
        void applySavedBeatLabKit(value.slice(6));
      } else if (value.startsWith('preset:')) {
        setKit(value.slice(7));
      }
    },
    [applySavedBeatLabKit],
  );

  /** Snapshot pads from localStorage store, falling back to live in-memory buffers (crew kits may not be persisted yet). */
  const snapshotActiveBankKitPads = useCallback((): Record<string, StoredPadSample> => {
    const out: Record<string, StoredPadSample> = { ...captureActiveBankKitPads(activeBank) };
    for (let pi = 0; pi < 16; pi++) {
      const k = padSampleKey(activeBank, pi);
      const buffer = padSampleBuffersRef.current.get(k);
      if (!buffer) continue;
      const label = padSampleLabels[k] ?? PAD_NAMES[pi] ?? `Pad ${pi + 1}`;
      const root = padSampleRootBpms[k] ?? bpm;
      const row = audioBufferToStoredKitSample(buffer, label, root);
      writeSamplerOptsToStored(
        row,
        padSamplePlaybackOptsRef.current[k] ?? defaultPadSamplerPlaybackOpts(),
      );
      writeChromaticPadMetaToStored(
        row,
        padSampleRootMidiRef.current[k],
        padSampleChromaticRef.current[k],
        padSampleStrikeMidiRef.current[k],
      );
      writeFxRackToStored(row, padSampleFxRackRef.current[k] ?? defaultPadSamplerFxRack());
      out[String(pi)] = row;
    }
    return out;
  }, [activeBank, bpm, padSampleLabels, padSampleRootBpms]);

  const handleSaveBeatLabKit = useCallback(
    async (rawName: string) => {
      await padStorePersistRef.current.catch(() => {});
      const pads = snapshotActiveBankKitPads();
      const n = countSavedKitPads(pads);
      if (n === 0) {
        setSaveKitStatus('Load at least one pad sample on this bank first');
        flashKitImportHint('Nothing to save ? load or record sounds on the pads first');
        return;
      }
      const { kits, kit: saved } = upsertBeatLabSavedKit(savedKits, rawName, pads);
      setSavedKits(kits);
      setKit(saved.name);
      setKitSelectValue(`saved:${saved.id}`);
      setSaveKitStatus(`Saved ${n} pad${n === 1 ? '' : 's'}`);
      flashKitImportHint(`Saved kit "${saved.name}" (${n} pads)`);
    },
    [flashKitImportHint, savedKits, snapshotActiveBankKitPads],
  );

  const handleRenameSavedBeatLabKit = useCallback((id: string, name: string) => {
    const next = renameBeatLabSavedKit(savedKits, id, name);
    setSavedKits(next);
    if (kitSelectValue === `saved:${id}`) {
      const row = findBeatLabSavedKit(next, id);
      if (row) setKit(row.name);
    }
    flashKitImportHint('Kit renamed');
  }, [flashKitImportHint, kitSelectValue, savedKits]);

  const handleDeleteSavedBeatLabKit = useCallback(
    (id: string) => {
      const row = findBeatLabSavedKit(savedKits, id);
      if (!row) return;
      if (!window.confirm(`Delete saved kit "${row.name}"?`)) return;
      const next = deleteBeatLabSavedKit(savedKits, id);
      setSavedKits(next);
      if (kitSelectValue === `saved:${id}`) {
        setKitSelectValue(`preset:${KITS[0]}`);
        setKit(KITS[0]);
      }
      flashKitImportHint(`Deleted "${row.name}"`);
    },
    [flashKitImportHint, kitSelectValue, savedKits],
  );

  const handleSaveBeatLabSong = useCallback(
    (rawName: string) => {
      const { kit: kitSnapshot, sequence } = captureBeatLabSongSnapshot({
        bankIndex: activeBank,
        bankPatternSlots,
        patternSlot,
        bpm,
        drumStepSubdiv,
        loopBars,
        beatsPerBar,
        patternPlayMode,
        kitLabel: kit,
      });
      const padCount = countSavedKitPads(kitSnapshot.pads);
      const stepCount = countSequenceSteps(sequence);
      if (padCount === 0 && stepCount === 0) {
        setSaveSongStatus('Add pattern steps or load pad samples first');
        flashKitImportHint('Nothing to save ? paint the grid or load kit sounds');
        return;
      }
      const { songs, song } = upsertBeatLabSavedSong(savedSongs, rawName, kitSnapshot, sequence);
      setSavedSongs(songs);
      setSaveSongStatus(
        `Saved ${stepCount} step${stepCount === 1 ? '' : 's'} + ${padCount} pad${padCount === 1 ? '' : 's'}`,
      );
      flashKitImportHint(`Saved song "${song.name}"`);
    },
    [
      activeBank,
      bankPatternSlots,
      bpm,
      beatsPerBar,
      drumStepSubdiv,
      flashKitImportHint,
      kit,
      loopBars,
      patternPlayMode,
      patternSlot,
      savedSongs,
    ],
  );

  const handleRenameSavedBeatLabSong = useCallback(
    (id: string, name: string) => {
      const next = renameBeatLabSavedSong(savedSongs, id, name);
      setSavedSongs(next);
      flashKitImportHint('Song renamed');
    },
    [flashKitImportHint, savedSongs],
  );

  const handleDeleteSavedBeatLabSong = useCallback(
    (id: string) => {
      const row = findBeatLabSavedSong(savedSongs, id);
      if (!row) return;
      if (!window.confirm(`Delete saved song "${row.name}"?`)) return;
      const next = deleteBeatLabSavedSong(savedSongs, id);
      setSavedSongs(next);
      flashKitImportHint(`Deleted "${row.name}"`);
    },
    [flashKitImportHint, savedSongs],
  );

  const applyBeatLabSequence = useCallback(
    (seq: BeatLabSavedPattern['sequence']) => {
      const subdivForPattern = normalizePianoSnapSubdiv(seq.drumStepSubdiv);
      const bpb = Math.max(1, Math.round(MEASURES_PER_BAR));
      const loopBarsClamped = Math.max(1, Math.min(BEAT_LAB_MAX_LOOP_BARS, seq.loopBars));
      const colsForPattern = Math.max(
        1,
        Math.min(TOTAL_COLS, loopBarsClamped * bpb * subdivForPattern),
      );

      setBpm(seq.bpm);
      setBpmInput(String(Math.round(seq.bpm)));
      setBeatsPerBar(MEASURES_PER_BAR);
      setPatternPlayMode(seq.patternPlayMode);
      setPianoSnapSubdiv(subdivForPattern);
      setLoopOn(false);
      setLoopRangeBeats(0, loopBarsClamped * bpb);

      drumStepSubdivRef.current = subdivForPattern;
      patternColsDrumsBeatsRef.current = Math.max(1, loopBarsClamped * bpb);
      patternColsDrumsRef.current = colsForPattern;
      beatLabPlaylineGeomKeyRef.current = '';

      const patA = normalizeSavedDrumPattern(seq.patternA);
      const patB = normalizeSavedDrumPattern(seq.patternB);
      const activePat = seq.activePatternSlot === 'B' ? patB : patA;

      const nextSlots = bankPatternSlotsRef.current.map((slots, i) =>
        i !== activeBank ? slots : { A: patA, B: patB },
      );
      bankPatternSlotsRef.current = nextSlots;
      setBankPatternSlots(nextSlots);
      setPatternSlot(seq.activePatternSlot);
      setBanks((prev) =>
        prev.map((b, i) =>
          i !== activeBank ? b : { ...b, drums: activePat.map((row) => row.slice()) },
        ),
      );

      cursorBeatRef.current = 0;
      originBeatRef.current = 0;
      displayBeatRef.current = 0;
      if (!runningRef.current) {
        haltCreationPlaylineAtBeat(0);
      }

      return countPatternSteps(seq);
    },
    [activeBank, haltCreationPlaylineAtBeat, setLoopRangeBeats],
  );

  const applySavedBeatLabPattern = useCallback(
    async (patternId: string) => {
      const fromStorage = loadBeatLabSavedPatterns();
      const saved =
        findBeatLabSavedPattern(fromStorage, patternId) ??
        findBeatLabSavedPattern(savedPatterns, patternId);
      if (!saved) {
        setPatternBankHint('Saved pattern not found');
        return;
      }
      if (fromStorage.length !== savedPatterns.length) {
        setSavedPatterns(fromStorage);
      }

      goToCreationSub('beat-lab');
      if (beatLabDeckFocus !== 'sequence') {
        setBeatLabDeckFocus('sequence');
      }

      const steps = applyBeatLabSequence(saved.sequence);
      setLoadedPatternBankPick({
        bankId: BEAT_LAB_USER_SAVES_BANK_ID,
        presetId: saved.id,
        presetName: saved.name,
      });

      let kitLoaded = 0;
      if (saved.kit?.pads && Object.keys(saved.kit.pads).length > 0) {
        kitLoaded = await applyKitPadsToActiveBank(saved.kit.pads);
        const label = saved.kit.label?.trim();
        if (label) {
          setKit(label);
          setKitSelectValue(`preset:${KITS[0]}`);
        }
      }

      setPatternBankHint(
        kitLoaded > 0
          ? `Loaded "${saved.name}" — ${steps} steps + ${kitLoaded} pads`
          : steps > 0
            ? `Loaded "${saved.name}" — ${steps} step${steps === 1 ? '' : 's'}`
            : `Loaded "${saved.name}" (no grid steps in save — try saving again)`,
      );

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fitBeatLabGridToViewport();
          drumVerticalScrollRef.current?.scrollTo({ top: 0 });
        });
      });
    },
    [
      applyBeatLabSequence,
      applyKitPadsToActiveBank,
      beatLabDeckFocus,
      fitBeatLabGridToViewport,
      goToCreationSub,
      savedPatterns,
    ],
  );

  const handleSaveBeatLabPattern = useCallback(
    async (rawName: string) => {
      await padStorePersistRef.current.catch(() => {});

      const mergedSlots = bankPatternSlotsRef.current.map((slots, i) => {
        if (i !== activeBank) return slots;
        const liveDrums = normalizeBankDrumPattern(banksBootRef.current[i]?.drums);
        return { ...slots, [patternSlot]: liveDrums };
      });

      const { sequence } = captureBeatLabPatternSnapshot(
        {
          bankIndex: activeBank,
          bankPatternSlots: mergedSlots,
          patternSlot,
          bpm,
          drumStepSubdiv,
          loopBars,
          beatsPerBar,
          patternPlayMode,
          kitLabel: kit,
        },
        false,
      );
      const kitSnap = { pads: snapshotActiveBankKitPads(), label: kit };
      const steps = countPatternSteps(sequence);
      const padCount = countSavedKitPads(kitSnap.pads);
      if (steps === 0 && padCount === 0) {
        setSavePatternStatus('Paint steps on the grid or load pad sounds first');
        setPatternBankHint('Nothing to save — add grid steps or load samples on the pads');
        return;
      }
      const { patterns, pattern: saved, persisted } = upsertBeatLabSavedPattern(
        savedPatterns,
        rawName,
        sequence,
        kitSnap,
      );
      setSavedPatterns(patterns);
      if (!persisted) {
        setSavePatternStatus('Saved in session only — browser storage full');
        setPatternBankHint('Pattern saved for now but could not write to storage (quota full)');
        return;
      }
      setSavePatternStatus(
        padCount > 0
          ? `Saved ${steps} steps + ${padCount} pads`
          : `Saved ${steps} step${steps === 1 ? '' : 's'}`,
      );
      setPatternBankHint(
        padCount > 0
          ? `Saved pattern + kit "${saved.name}"`
          : `Saved pattern "${saved.name}"`,
      );
      setLoadedPatternBankPick({
        bankId: BEAT_LAB_USER_SAVES_BANK_ID,
        presetId: saved.id,
        presetName: saved.name,
      });
      setPatternBankOpenUserSaves(true);
      queueMicrotask(() => setPatternBankOpenUserSaves(false));
    },
    [
      activeBank,
      bpm,
      beatsPerBar,
      drumStepSubdiv,
      kit,
      loopBars,
      patternPlayMode,
      patternSlot,
      savedPatterns,
      snapshotActiveBankKitPads,
    ],
  );

  const handleRenameSavedBeatLabPattern = useCallback(
    (id: string, name: string) => {
      const next = renameBeatLabSavedPattern(savedPatterns, id, name);
      setSavedPatterns(next);
      setPatternBankHint('Pattern renamed');
    },
    [savedPatterns],
  );

  const handleDeleteSavedBeatLabPattern = useCallback(
    (id: string) => {
      const row = findBeatLabSavedPattern(savedPatterns, id);
      if (!row) return;
      if (!window.confirm(`Delete saved pattern "${row.name}"?`)) return;
      const next = deleteBeatLabSavedPattern(savedPatterns, id);
      setSavedPatterns(next);
      setPatternBankHint(`Deleted "${row.name}"`);
      setLoadedPatternBankPick((prev) =>
        prev?.bankId === BEAT_LAB_USER_SAVES_BANK_ID && prev.presetId === id ? null : prev,
      );
      if (savePatternStatus) setSavePatternStatus(null);
    },
    [savedPatterns, savePatternStatus],
  );

  const ingestPadSampleToBank = useCallback(
    async (
      file: File,
      pad: number,
      bank: number,
      label?: string,
      samplerOpts = defaultPadSamplerPlaybackOpts(),
    ) => {
      const ctx = getOrCreateAudioContext();
      const storedBase = await fileToStoredPadSample(file);
      const stored = { ...storedBase, rootBpm: bpm };
      const display = (label ?? stored.label ?? '').trim();
      if (display) stored.label = display;
      const ab = storedToArrayBuffer(stored);
      const buffer = await ctx.decodeAudioData(ab.slice(0));
      const k = padSampleKey(bank, pad);
      padSampleBuffersRef.current.set(k, buffer);
      setPadSamplePresence((prev) => ({ ...prev, [k]: true }));
      setPadSampleRootBpms((prev) => ({ ...prev, [k]: bpm }));
      if (display) setPadSampleLabels((prev) => ({ ...prev, [k]: display }));
      else
        setPadSampleLabels((prev) => {
          const n = { ...prev };
          delete n[k];
          return n;
        });
      const store = loadPadSampleStore();
      store[k] = stored;
      writeSamplerOptsToStored(stored, samplerOpts);
      writeFxRackToStored(stored, defaultPadSamplerFxRack());
      savePadSampleStore(store);
      padSamplePlaybackOptsRef.current[k] = samplerOptsFromStored(stored);
      padSampleFxRackRef.current[k] = fxRackFromStored(stored);
    },
    [bpm, getOrCreateAudioContext],
  );

  const ingestPadSample = useCallback(
    async (file: File, pad: number) => {
      await ingestPadSampleToBank(file, pad, activeBank);
    },
    [activeBank, ingestPadSampleToBank],
  );

  const beginLoadPadSample = useCallback((padIndex: number) => {
    pendingPadSampleRef.current = padIndex;
    padSampleFileInputRef.current?.click();
  }, []);

  const beginImportPadFolder = useCallback(() => {
    folderImportBrassRoomRef.current = false;
    padSampleFolderInputRef.current?.click();
  }, []);

  const beginImportBrassRoomFolder = useCallback(() => {
    folderImportBrassRoomRef.current = true;
    padSampleFolderInputRef.current?.click();
  }, []);

  const beginOpenTrapKitBrowser = useCallback(() => {
    trapKitFolderInputRef.current?.click();
  }, []);

  const handleTrapKitFolder = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    e.target.value = '';
    if (!list?.length) return;
    const files = Array.from(list).filter((f) => /\.(wav|mp3|ogg|flac|m4a|aac|aif|aiff)$/i.test(f.name));
    if (files.length === 0) {
      flashKitImportHint('No audio in that folder');
      return;
    }
    setTrapKitBrowserFiles(files);
    setTrapKitBrowserOpen(true);
    setActiveBank(BRASS_ROOM_BANK_INDEX);
    flashKitImportHint(`Kit browser ? ${files.length} samples (pick 808s, claps, kicks per pad)`);
  }, [flashKitImportHint]);

  const loadTrapKitSampleToPad = useCallback(
    async (file: File, pad: number, label: string) => {
      try {
        await ingestPadSampleToBank(file, pad, BRASS_ROOM_BANK_INDEX, label, trapPadSamplerOpts(pad));
        flashKitImportHint(`Pad ${pad + 1}: ${label}`);
        playPadSoundRef.current(pad, PAD_VEL[pad] ?? 100);
      } catch (err) {
        console.debug('Kit browser load failed:', err);
        flashKitImportHint('Could not load that sample');
      }
    },
    [ingestPadSampleToBank, flashKitImportHint],
  );

  const loadSoundFamilySample = useCallback(
    async (args: { familyId: string; pad: number; label: string; relFile: string }) => {
      const { familyId, pad, label, relFile } = args;
      const bank = activeBankRef.current;
      try {
        const ctx = getOrCreateAudioContext();
        const buf = await fetchAndDecodeFamilySample(relFile, ctx);
        const stored = audioBufferToStoredKitSample(buf, label, bpm);
        const k = padSampleKey(bank, pad);
        padSampleBuffersRef.current.set(k, buf);
        const opts = samplerOptsForFamily(familyId, pad, relFile);
        const store = loadPadSampleStore();
        writeSamplerOptsToStored(stored, opts);
        writeFxRackToStored(stored, defaultPadSamplerFxRack());
        const orchPad =
          familyId === ORCHESTRA_HITS_SOUND_FAMILY_ID ? orchestraHitsPadDefForFile(relFile) : undefined;
        if (orchPad?.chromatic && typeof orchPad.rootMidi === 'number') {
          writeChromaticPadMetaToStored(stored, orchPad.rootMidi, true);
        }
        store[k] = stored;
        savePadSampleStore(store);
        padSamplePlaybackOptsRef.current[k] = samplerOptsFromStored(stored);
        padSampleFxRackRef.current[k] = fxRackFromStored(stored);
        if (orchPad?.chromatic && typeof orchPad.rootMidi === 'number') {
          padSampleRootMidiRef.current[k] = orchPad.rootMidi;
          padSampleChromaticRef.current[k] = true;
        } else {
          delete padSampleRootMidiRef.current[k];
          delete padSampleStrikeMidiRef.current[k];
          delete padSampleChromaticRef.current[k];
        }
        setPadSamplePresence((prev) => ({ ...prev, [k]: true }));
        setPadSampleRootBpms((prev) => ({ ...prev, [k]: bpm }));
        setPadSampleLabels((prev) => ({ ...prev, [k]: label }));
        setGeniusSamplerTargetPad(pad);
        flashKitImportHint(`${label} → ${PAD_NAMES[pad] ?? `pad ${pad + 1}`} (bank ${BANKS[bank]})`);
        playPadSoundRef.current(pad, PAD_VEL[pad] ?? 100);
      } catch (err) {
        console.debug('Sound family load failed:', err);
        flashKitImportHint('Built-in sound not found');
      }
    },
    [bpm, flashKitImportHint, getOrCreateAudioContext],
  );

  const soundFamilyPreviewStopRef = useRef<(() => void) | null>(null);
  const previewSoundFamilySample = useCallback(
    async (args: { familyId: string; pad: number; relFile: string }) => {
      try {
        const ctx = getOrCreateAudioContext();
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => {});
        }
        soundFamilyPreviewStopRef.current?.();
        soundFamilyPreviewStopRef.current = null;
        const buf = await fetchAndDecodeFamilySample(args.relFile, ctx);
        const when = ctx.currentTime + 0.001;
        const stop = playPadSampleBuffer(
          ctx,
          buf,
          creationPadMixerCh(args.pad),
          PAD_VEL[args.pad] ?? 100,
          when,
          channelVolumesRef.current,
          1,
          () => {
            if (soundFamilyPreviewStopRef.current === stop) {
              soundFamilyPreviewStopRef.current = null;
            }
          },
          samplerOptsForFamily(args.familyId, args.pad, args.relFile),
          false,
          defaultPadSamplerFxRack(),
          Math.max(1, bpmRef.current),
        );
        soundFamilyPreviewStopRef.current = stop;
      } catch (err) {
        console.debug('Sound family preview failed:', err);
      }
    },
    [getOrCreateAudioContext],
  );

  const loadSoundFamilyFullBank = useCallback(
    async (primaryFamily: SoundFamily) => {
      void primaryFamily;
      setBrassRoomLoading(true);
      try {
        const catalog = await fetchSoundFamiliesCatalog();
        if (!catalog) {
          flashKitImportHint('Built-in drum library unavailable');
          return;
        }
        const ctx = getOrCreateAudioContext();
        let ok = 0;
        for (const family of catalog.families) {
          const sample = family.samples[0];
          if (!sample) continue;
          try {
            const buf = await fetchAndDecodeFamilySample(sample.file, ctx);
            const pad = family.defaultPad;
            const title = soundFamilySampleDisplayTitle(family.id, 0);
            const label = familyInstrumentLabel(pad, title);
            const stored = audioBufferToStoredKitSample(buf, label, bpm);
            const k = padSampleKey(BRASS_ROOM_BANK_INDEX, pad);
            padSampleBuffersRef.current.set(k, buf);
            const opts = samplerOptsForFamily(family.id, pad);
            writeSamplerOptsToStored(stored, opts);
            writeFxRackToStored(stored, defaultPadSamplerFxRack());
            const store = loadPadSampleStore();
            store[k] = stored;
            savePadSampleStore(store);
            padSamplePlaybackOptsRef.current[k] = samplerOptsFromStored(stored);
            padSampleFxRackRef.current[k] = fxRackFromStored(stored);
            setPadSamplePresence((prev) => ({ ...prev, [k]: true }));
            setPadSampleRootBpms((prev) => ({ ...prev, [k]: bpm }));
            setPadSampleLabels((prev) => ({ ...prev, [k]: label }));
            ok++;
          } catch {
            /* skip */
          }
        }
        setActiveBank(BRASS_ROOM_BANK_INDEX);
        flashKitImportHint(`Sound families ? ${ok} pads on bank ${BANKS[BRASS_ROOM_BANK_INDEX]} (808 main)`);
      } finally {
        setBrassRoomLoading(false);
      }
    },
    [bpm, flashKitImportHint, getOrCreateAudioContext],
  );

  const applyPadsToBank = useCallback(
    async (
      bank: number,
      items: ReadonlyArray<{ pad: number; label: string; stored: StoredPadSample }>,
    ) => {
      const ctx = getOrCreateAudioContext();
      const store = loadPadSampleStore();
      for (const { pad, label, stored } of items) {
        const k = padSampleKey(bank, pad);
        const row = { ...stored, label, rootBpm: bpm };
        const ab = storedToArrayBuffer(row);
        const decoded = await ctx.decodeAudioData(ab.slice(0));
        padSampleBuffersRef.current.set(k, decoded);
        const opts = trapPadSamplerOpts(pad);
        writeSamplerOptsToStored(row, opts);
        writeFxRackToStored(row, defaultPadSamplerFxRack());
        store[k] = row;
        padSamplePlaybackOptsRef.current[k] = samplerOptsFromStored(row);
        padSampleFxRackRef.current[k] = fxRackFromStored(row);
        setPadSamplePresence((prev) => ({ ...prev, [k]: true }));
        setPadSampleRootBpms((prev) => ({ ...prev, [k]: bpm }));
        setPadSampleLabels((prev) => ({ ...prev, [k]: label }));
      }
      savePadSampleStore(store);
      setActiveBank(bank);
    },
    [bpm, getOrCreateAudioContext],
  );

  const loadBrassRoomFromProjectFolder = useCallback(async () => {
    setBrassRoomLoading(true);
    flashKitImportHint(`Loading ${BRASS_ROOM_KIT_DISPLAY_NAME} from project folder?`);
    try {
      const ctx = getOrCreateAudioContext();
      const { bankIndex, pads, kitName } = await loadBrassRoomBankFromPublic(ctx);
      if (pads.length === 0) {
        flashKitImportHint(
          `Use Sound Families in Beat Lab, or copy WAVs to public/samples/brass-room/`,
        );
        return;
      }
      await applyPadsToBank(
        bankIndex,
        pads.map((p) => ({ pad: p.pad, label: p.label, stored: p.stored })),
      );
      flashKitImportHint(
        `${kitName} ? ${pads.length} sounds on bank ${BANKS[bankIndex]} (renamed instruments)`,
      );
    } catch (err) {
      console.debug('Built-in kit folder load failed:', err);
      flashKitImportHint('Use Sound Families ? built-in drums are already in the app');
    } finally {
      setBrassRoomLoading(false);
    }
  }, [applyPadsToBank, flashKitImportHint]);

  const handlePadSampleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      const padRaw = pendingPadSampleRef.current;
      pendingPadSampleRef.current = null;
      if (padRaw == null || !file) return;
      const pad = Math.max(0, Math.min(15, Math.floor(Number(padRaw))));
      try {
        await ingestPadSample(file, pad);
      } catch (err) {
        console.debug('Pad sample load failed:', err);
        flashKitImportHint('Could not load that file ? try .wav or .mp3');
      }
    },
    [ingestPadSample, flashKitImportHint],
  );

  const handlePadSampleFolder = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      e.target.value = '';
      const brassRoom = folderImportBrassRoomRef.current;
      folderImportBrassRoomRef.current = false;
      if (!list?.length) return;
      const files = Array.from(list);
      const assignments = brassRoom
        ? assignTrapDrumFolderToPads(files, BRASS_ROOM_KIT_DISPLAY_NAME)
        : assignTrapDrumFolderToPads(files, `Bank ${BANKS[activeBank]}`);
      if (assignments.length === 0) {
        flashKitImportHint('No audio files in folder (.wav, .mp3, .ogg, ?)');
        return;
      }
      const bank = brassRoom ? BRASS_ROOM_BANK_INDEX : activeBank;
      if (brassRoom) setBrassRoomLoading(true);
      let ok = 0;
      try {
        for (const { file, pad, label } of assignments) {
          try {
            await ingestPadSampleToBank(file, pad, bank, label, trapPadSamplerOpts(pad));
            ok++;
          } catch (err) {
            console.debug('Folder import skip:', file.name, err);
          }
        }
      } finally {
        if (brassRoom) setBrassRoomLoading(false);
      }
      if (ok === 0) {
        flashKitImportHint('Import failed ? files too large or unsupported format');
        return;
      }
      if (brassRoom) setActiveBank(BRASS_ROOM_BANK_INDEX);
      flashKitImportHint(
        brassRoom
          ? `${BRASS_ROOM_KIT_DISPLAY_NAME} ? ${ok} sounds on bank ${BANKS[bank]} (808/clap/hits renamed)`
          : `Loaded ${ok} sample${ok === 1 ? '' : 's'} on bank ${BANKS[bank]} (renamed)`,
      );
    },
    [activeBank, ingestPadSampleToBank, flashKitImportHint],
  );

  const commitPadSamplerPlaybackOpts = useCallback((padIndex: number, o: PadSamplerPlaybackOpts) => {
    const k = padSampleKey(activeBank, padIndex);
    if (!padSampleBuffersRef.current.get(k)) return;
    padSamplePlaybackOptsRef.current[k] = { ...o };
    const store = loadPadSampleStore();
    const row = store[k];
    if (!row) return;
    writeSamplerOptsToStored(row, o);
    savePadSampleStore(store);
  }, [activeBank]);

  /** Beat Pads overlay — update playback opts in memory while dragging (no localStorage). */
  const applyPadSamplerOptsLive = useCallback((padIndex: number, o: PadSamplerPlaybackOpts) => {
    const k = padSampleKey(activeBank, padIndex);
    if (!padSampleBuffersRef.current.get(k)) return;
    padSamplePlaybackOptsRef.current[k] = { ...o };
  }, [activeBank]);

  const applyDrumPadVoiceLive = useCallback((padIndex: number, voice: BeatLabDrumPadVoiceOpts) => {
    const vk = beatLabDrumPadVoiceKey(activeBank, padIndex);
    padDrumVoiceOptsRef.current[vk] = clampBeatLabDrumPadVoiceOpts(voice, padIndex);
  }, [activeBank]);

  const getPadSamplerPlaybackOpts = useCallback((padIndex: number) => {
    const k = padSampleKey(activeBank, padIndex);
    return padSamplePlaybackOptsRef.current[k] ?? defaultPadSamplerPlaybackOpts();
  }, [activeBank]);

  const getDrumPadVoice = useCallback((padIndex: number) => {
    const vk = beatLabDrumPadVoiceKey(activeBank, padIndex);
    return padDrumVoiceOptsRef.current[vk] ?? defaultBeatLabDrumPadVoiceOpts(padIndex);
  }, [activeBank]);

  const commitDrumPadVoice = useCallback((padIndex: number, voice: BeatLabDrumPadVoiceOpts) => {
    const vk = beatLabDrumPadVoiceKey(activeBank, padIndex);
    const clamped = clampBeatLabDrumPadVoiceOpts(voice, padIndex);
    padDrumVoiceOptsRef.current[vk] = clamped;
    const voiceStore = loadBeatLabDrumPadVoiceStore();
    voiceStore[vk] = clamped;
    saveBeatLabDrumPadVoiceStore(voiceStore);
  }, [activeBank]);

  const previewDrumPadStrike = useCallback((padIndex: number) => {
    const vk = beatLabDrumPadVoiceKey(activeBank, padIndex);
    const voice = padDrumVoiceOptsRef.current[vk] ?? defaultBeatLabDrumPadVoiceOpts(padIndex);
    const vel = beatLabDrumVoiceManualVelocity(voice, 0.88);
    playPadSoundRef.current(padIndex, vel, undefined, 0, {
      beatPadVoice: voice,
    });
  }, [activeBank]);

  /** Close CH 17 spread roll — pads were never modified. */
  const undoBeatPadsHitSpread = useCallback(() => {
    clearBeatPadsSpreadTrack();
    flashKitImportHint('Spread closed — your 16 pads are unchanged');
  }, [clearBeatPadsSpreadTrack, flashKitImportHint]);

  const persistBeatPadsSpreadTrack = useCallback((track: BeatPadsSpreadTrackState) => {
    setBeatPadsSpreadTrack(track);
    writeBeatPadsSpreadSession(beatPadsSpreadSessionFromTrack(track));
  }, []);

  const applyBeatPadsHitSpread = useCallback(
    async (
      sourcePad: number,
      direction: BeatPadsSpreadDirection,
      gridStepsPerBar: import('@/app/lib/creationStation/beatLabDrumMachineSequencer').BeatPadsGridStepsPerBar = 16,
    ) => {
      const bank = activeBank;
      const srcKey = padSampleKey(bank, sourcePad);
      const buf = padSampleBuffersRef.current.get(srcKey);
      if (!buf) {
        flashKitImportHint('Load a hit on this pad first, then Spread ↓/↑ 16');
        return;
      }

      const srcOpts = padSamplePlaybackOptsRef.current[srcKey] ?? defaultPadSamplerPlaybackOpts();
      const fxTemplate = clonePadSamplerFxRack(
        padSampleFxRackRef.current[srcKey] ?? defaultPadSamplerFxRack(),
      );
      const rootBpm = padSampleRootBpms[srcKey] ?? bpm;
      const label = padSampleLabels[srcKey] ?? `Pad ${sourcePad + 1}`;
      const prev = beatPadsSpreadTrack?.bank === bank ? beatPadsSpreadTrack : null;
      const midiRoll = banks[activeBank]?.midiRoll ?? [];

      const voice = buildBeatPadsSpreadVoiceFromPad({
        buffer: buf,
        label,
        rootMidi: padSampleRootMidiRef.current[srcKey],
        chromatic: padSampleChromaticRef.current[srcKey],
        sampler: srcOpts,
        fx: fxTemplate,
        rootBpm,
        direction,
        mixerChannel: prev?.mixerChannel ?? BEAT_PADS_SPREAD_MIXER_CH,
      });
      beatPadsSpreadVoiceRef.current = voice;

      const stored = audioBufferToStoredKitSample(buf, voice.baseLabel, rootBpm);
      writeSamplerOptsToStored(stored, voice.sampler);
      writeFxRackToStored(stored, fxTemplate);
      writeChromaticPadMetaToStored(stored, voice.rootMidi, true);

      const track: BeatPadsSpreadTrackState = {
        bank,
        sourcePad,
        direction,
        rootMidi: voice.rootMidi,
        baseLabel: voice.baseLabel,
        loopBars: prev?.loopBars ?? 8,
        stepsPerBar: gridStepsPerBar,
        mixerChannel: prev?.mixerChannel ?? BEAT_PADS_SPREAD_MIXER_CH,
        keyLockEnabled: prev?.keyLockEnabled ?? false,
        harmonyLane: prev?.harmonyLane ?? beatPadsSpreadDefaultHarmonyLane(midiRoll),
        notes: prev?.notes ?? [],
        sample: stored,
      };
      persistBeatPadsSpreadTrack(track);

      const stepHint = direction === 'up' ? '↑ chromatic' : '↓ chromatic';
      flashKitImportHint(
        `Spread roll · CH 17 · "${voice.baseLabel}" · ${stepHint} · pads unchanged`,
      );
    },
    [activeBank, banks, beatPadsSpreadTrack, bpm, flashKitImportHint, padSampleLabels, padSampleRootBpms, persistBeatPadsSpreadTrack],
  );

  const strikeBeatPadsSpreadRow = useCallback(
    (row: number, gridCol = 0, whenSec?: number) => {
      const voice = beatPadsSpreadVoiceRef.current;
      const track = beatPadsSpreadTrack;
      if (!voice) return;
      void ensureCtx();
      const ctx = getOrCreateAudioContext();
      const when = whenSec ?? ctx.currentTime + 0.002;
      const stepsPerBar = track?.stepsPerBar ?? 16;
      const midiRoll = banks[activeBank]?.midiRoll ?? [];
      const sync = readChordSync();
      const chordRail = beatLabSynthChordRailRef.current;
      const keyRoot = chordRail?.keyRoot ?? sync?.keyRoot ?? 0;
      const mode = (chordRail?.mode ?? sync?.mode ?? 'minor') as ChordMode;
      const keyLockSemi = beatPadsSpreadKeyLockSemiAtCol({
        voiceRootMidi: voice.rootMidi,
        laneNotes: midiRoll,
        harmonyLane: track?.harmonyLane ?? beatLabSynth2HarmonyLaneRef.current,
        gridCol,
        stepsPerBar,
        loopBars: track?.loopBars ?? 8,
        keyLockEnabled: track?.keyLockEnabled ?? false,
        chordRail,
        keyRoot,
        mode,
      });
      playBeatPadsSpreadRow(ctx, voice, row, 100, when, channelVolumesRef.current, false, keyLockSemi);
    },
    [activeBank, banks, beatPadsSpreadTrack, ensureCtx],
  );

  const previewBeatPadsSpreadRow = useCallback(
    (row: number, gridCol = 0) => {
      strikeBeatPadsSpreadRow(row, gridCol);
    },
    [strikeBeatPadsSpreadRow],
  );

  const generateSpreadChordNotesForTrack = useCallback(
    (spread: BeatPadsSpreadTrackState, variationSeed?: number) => {
      const voice = beatPadsSpreadVoiceRef.current;
      if (!voice) return spread.notes;
      const midiRoll = banks[activeBank]?.midiRoll ?? [];
      const sync = readChordSync();
      const chordRail = beatLabSynthChordRailRef.current;
      const keyRoot = chordRail?.keyRoot ?? sync?.keyRoot ?? 0;
      const mode = (chordRail?.mode ?? sync?.mode ?? 'minor') as ChordMode;
      const generated = generateBeatPadsSpreadChordRootNotes({
        voiceRootMidi: voice.rootMidi,
        direction: spread.direction,
        loopBars: spread.loopBars,
        stepsPerBar: spread.stepsPerBar,
        keyLockEnabled: spread.keyLockEnabled ?? false,
        variationSeed: variationSeed ?? spreadChordGenSeedRef.current,
        laneNotes: midiRoll,
        harmonyLane: spread.harmonyLane ?? beatLabSynth2HarmonyLaneRef.current,
        chordRail,
        keyRoot,
        mode,
      });
      return generated.length > 0 ? generated : spread.notes;
    },
    [activeBank, banks],
  );

  const handleBeatPadsSpreadKeyLockChange = useCallback(
    (enabled: boolean) => {
      setBeatPadsSpreadTrack((prev) => {
        if (!prev || prev.bank !== activeBank) return prev;
        const next = { ...prev, keyLockEnabled: enabled };
        if (enabled) {
          spreadChordGenSeedRef.current = 0;
          next.notes = generateSpreadChordNotesForTrack(next, 0);
        }
        writeBeatPadsSpreadSession(beatPadsSpreadSessionFromTrack(next));
        return next;
      });
    },
    [activeBank, generateSpreadChordNotesForTrack],
  );

  const handleBeatPadsSpreadHarmonyLaneChange = useCallback(
    (harmonyLane: number) => {
      setBeatPadsSpreadTrack((prev) => {
        if (!prev || prev.bank !== activeBank) return prev;
        const next = { ...prev, harmonyLane };
        if (next.keyLockEnabled) {
          next.notes = generateSpreadChordNotesForTrack(next);
        }
        writeBeatPadsSpreadSession(beatPadsSpreadSessionFromTrack(next));
        return next;
      });
    },
    [activeBank, generateSpreadChordNotesForTrack],
  );

  const handleBeatPadsSpreadRegenerateChordRoots = useCallback(() => {
    spreadChordGenSeedRef.current += 1;
    setBeatPadsSpreadTrack((prev) => {
      if (!prev || prev.bank !== activeBank) return prev;
      const next = {
        ...prev,
        notes: generateSpreadChordNotesForTrack(prev, spreadChordGenSeedRef.current),
      };
      writeBeatPadsSpreadSession(beatPadsSpreadSessionFromTrack(next));
      return next;
    });
  }, [activeBank, generateSpreadChordNotesForTrack]);

  const beatPadsSpreadKeyLabel = useMemo(() => {
    const lane = beatPadsSpreadTrack?.harmonyLane ?? beatLabSynth2HarmonyLane;
    const sync = readChordSync();
    const rail = beatLabSynthChordRail;
    const keyRoot = rail?.keyRoot ?? sync?.keyRoot ?? 0;
    const mode = (rail?.mode ?? sync?.mode ?? 'minor') as ChordMode;
    const keyName = KEY_ROOTS.find((k) => k.value === keyRoot)?.label ?? '?';
    return `CH ${beatLabMelodicChannelForLane(lane)} · ${keyName} ${MODE_LABELS[mode]}`;
  }, [beatLabSynthChordRail, beatLabSynth2HarmonyLane, beatPadsSpreadTrack?.harmonyLane]);

  const handleBeatPadsSpreadNotesChange = useCallback(
    (notes: BeatPadsSpreadNote[]) => {
      setBeatPadsSpreadTrack((prev) => {
        if (!prev || prev.bank !== activeBank) return prev;
        const next = { ...prev, notes };
        writeBeatPadsSpreadSession(beatPadsSpreadSessionFromTrack(next));
        return next;
      });
    },
    [activeBank],
  );

  const handleBeatPadsSpreadLoopBarsChange = useCallback(
    (loopBars: BeatPadsSpreadLoopBars) => {
      setBeatPadsSpreadTrack((prev) => {
        if (!prev || prev.bank !== activeBank) return prev;
        const next = {
          ...prev,
          loopBars,
          notes: beatPadsSpreadClampNotesToLoop(prev.notes, loopBars, prev.stepsPerBar),
        };
        if (next.keyLockEnabled) {
          next.notes = generateSpreadChordNotesForTrack(next);
        }
        writeBeatPadsSpreadSession(beatPadsSpreadSessionFromTrack(next));
        return next;
      });
    },
    [activeBank, generateSpreadChordNotesForTrack],
  );

  const handleBeatPadsSpreadGridStepsPerBarChange = useCallback(
    (stepsPerBar: import('@/app/lib/creationStation/beatLabDrumMachineSequencer').BeatPadsGridStepsPerBar) => {
      setBeatPadsSpreadTrack((prev) => {
        if (!prev || prev.bank !== activeBank || prev.stepsPerBar === stepsPerBar) return prev;
        const next = {
          ...prev,
          stepsPerBar,
          notes: beatPadsSpreadConvertNotesGridSteps(prev.notes, prev.loopBars, prev.stepsPerBar, stepsPerBar),
        };
        writeBeatPadsSpreadSession(beatPadsSpreadSessionFromTrack(next));
        return next;
      });
    },
    [activeBank],
  );

  const handleBeatPadsSpreadDirectionChange = useCallback(
    (direction: BeatPadsSpreadDirection) => {
      const voice = beatPadsSpreadVoiceRef.current;
      if (voice) beatPadsSpreadVoiceRef.current = { ...voice, direction };
      setBeatPadsSpreadTrack((prev) => {
        if (!prev || prev.bank !== activeBank) return prev;
        const next = { ...prev, direction };
        if (next.keyLockEnabled) {
          next.notes = generateSpreadChordNotesForTrack(next);
        }
        writeBeatPadsSpreadSession(beatPadsSpreadSessionFromTrack(next));
        return next;
      });
    },
    [activeBank, generateSpreadChordNotesForTrack],
  );

  const handleBeatPadsSpreadMixerChannelChange = useCallback(
    (mixerChannel: number) => {
      const ch = clampBeatPadsSpreadMixerChannel(mixerChannel);
      const voice = beatPadsSpreadVoiceRef.current;
      if (voice) beatPadsSpreadVoiceRef.current = { ...voice, mixerChannel: ch };
      setBeatPadsSpreadTrack((prev) => {
        if (!prev || prev.bank !== activeBank) return prev;
        const next = { ...prev, mixerChannel: ch };
        writeBeatPadsSpreadSession(beatPadsSpreadSessionFromTrack(next));
        return next;
      });
    },
    [activeBank],
  );

  useEffect(() => {
    if (beatPadsSpreadTrack?.bank === activeBank && beatPadsSpreadVoiceRef.current) return;
    const session = readBeatPadsSpreadSession();
    if (!session || session.bank !== activeBank) {
      if (beatPadsSpreadTrack && beatPadsSpreadTrack.bank !== activeBank) {
        beatPadsSpreadVoiceRef.current = null;
        setBeatPadsSpreadTrack(null);
      }
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const ctx = await ensureCtx();
        const ab = storedToArrayBuffer(session.sample);
        const buffer = await ctx.decodeAudioData(ab.slice(0));
        if (cancelled) return;
        const sampler = samplerOptsFromStored(session.sample);
        const fx = fxRackFromStored(session.sample);
        const voice = buildBeatPadsSpreadVoiceFromPad({
          buffer,
          label: session.baseLabel,
          rootMidi: session.rootMidi,
          chromatic: true,
          sampler,
          fx,
          rootBpm: session.sample.rootBpm ?? bpm,
          direction: session.direction,
          mixerChannel: session.mixerChannel ?? BEAT_PADS_SPREAD_MIXER_CH,
        });
        beatPadsSpreadVoiceRef.current = voice;
        setBeatPadsSpreadTrack({
          bank: session.bank,
          sourcePad: session.sourcePad,
          direction: session.direction,
          rootMidi: session.rootMidi,
          baseLabel: session.baseLabel,
          loopBars: session.loopBars,
          stepsPerBar: session.stepsPerBar,
          mixerChannel: session.mixerChannel ?? BEAT_PADS_SPREAD_MIXER_CH,
          keyLockEnabled: session.keyLockEnabled ?? false,
          harmonyLane: session.harmonyLane,
          notes: session.notes,
          sample: session.sample,
        });
      } catch {
        writeBeatPadsSpreadSession(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeBank, beatPadsSpreadTrack, bpm, ensureCtx]);

  const importBeatPadsPatternFromBeatLab = useCallback(() => {
    const drums = normalizeBankDrumPattern(banks[activeBank]?.drums ?? emptyDrums());
    const bars = Math.max(
      BEAT_PADS_MIN_LOOP_BARS,
      Math.min(BEAT_PADS_MAX_LOOP_BARS, loopBars),
    );
    const overlayCols = bars * BEAT_PADS_STEPS_PER_BAR;
    const stepsPerBarMain = Math.max(1, qpb * drumStepSubdiv);
    const boolGrid: boolean[][] = Array.from({ length: 16 }, () =>
      Array.from({ length: overlayCols }, () => false),
    );
    for (let pi = 0; pi < 16; pi += 1) {
      for (let oc = 0; oc < overlayCols; oc += 1) {
        const mainCol = Math.min(
          Math.max(0, patternColsDrums - 1),
          Math.floor((oc * stepsPerBarMain) / BEAT_PADS_STEPS_PER_BAR),
        );
        boolGrid[pi]![oc] = drums[pi]?.[mainCol] ?? false;
      }
    }
    return { pattern: normalizeBeatPadsPattern(boolGrid, bars), loopBars: bars };
  }, [activeBank, banks, drumStepSubdiv, loopBars, patternColsDrums, qpb]);

  const exportBeatPadsPatternToBeatLab = useCallback(
    (pattern: BeatPadsDrumPattern, bars: number) => {
      if (CREATION_BACKEND_BLANK) return;
      const loopBarsClamped = Math.max(
        BEAT_PADS_MIN_LOOP_BARS,
        Math.min(BEAT_PADS_MAX_LOOP_BARS, Math.round(bars)),
      );
      const overlayCols = loopBarsClamped * BEAT_PADS_STEPS_PER_BAR;
      setLoopBars(loopBarsClamped);
      setPianoSnapSubdiv(4);
      const stepGrid = beatPadsPatternToStepGrid(pattern, overlayCols);
      const mutate = (drums: DrumPattern) => {
        const next = normalizeBankDrumPattern(drums);
        for (let pi = 0; pi < 16; pi += 1) {
          for (let ci = 0; ci < TOTAL_COLS; ci += 1) {
            next[pi]![ci] = ci < overlayCols ? (stepGrid[pi]?.[ci] ?? false) : false;
          }
        }
        return next;
      };
      setBanks((prev) =>
        prev.map((b, i) =>
          i !== activeBank ? b : { ...b, drums: mutate(normalizeBankDrumPattern(b.drums)) },
        ),
      );
      setBankPatternSlots((prev) =>
        prev.map((slots, i) =>
          i !== activeBank
            ? slots
            : { ...slots, [patternSlot]: mutate(normalizeBankDrumPattern(slots[patternSlot])) },
        ),
      );
      flashKitImportHint(
        `Exported ${loopBarsClamped}-bar loop to Beat Lab grid (bank ${BANKS[activeBank]})`,
      );
    },
    [activeBank, flashKitImportHint, patternSlot],
  );

  const handleSaveBeatPadsSession = useCallback(
    async (args: {
      name: string;
      pattern: BeatPadsDrumPattern;
      loopBars: number;
      stepsPerBar: BeatPadsGridStepsPerBar;
      bpm: number;
    }) => {
      await padStorePersistRef.current.catch(() => {});
      const kitSnap = { pads: snapshotActiveBankKitPads(), label: kit };
      const noteCount = countBeatPadsSessionNotes(args.pattern);
      const padCount = countSavedKitPads(kitSnap.pads);
      if (noteCount === 0 && padCount === 0) {
        setBeatPadsSessionSaveStatus('Add pattern steps or load pad sounds first');
        flashKitImportHint('Nothing to save — paint the loop or load samples on the pads');
        return;
      }
      const { sessions, session, persisted } = upsertBeatPadsSavedSession(
        savedBeatPadsSessions,
        args.name,
        {
          bankIndex: activeBank,
          loopBars: args.loopBars,
          stepsPerBar: args.stepsPerBar,
          bpm: args.bpm,
          pattern: args.pattern,
          kit: kitSnap,
        },
      );
      setSavedBeatPadsSessions(sessions);
      if (!persisted) {
        setBeatPadsSessionSaveStatus('Saved in session only — browser storage full');
        flashKitImportHint(`Saved "${session.name}" but storage is full`);
        return;
      }
      const detail =
        padCount > 0
          ? `${noteCount} hit${noteCount === 1 ? '' : 's'} + ${padCount} pad${padCount === 1 ? '' : 's'}`
          : `${noteCount} hit${noteCount === 1 ? '' : 's'}`;
      setBeatPadsSessionSaveStatus(`Saved ${detail}`);
      flashKitImportHint(`Saved Beat Pads loop "${session.name}" (${detail})`);
    },
    [activeBank, flashKitImportHint, kit, savedBeatPadsSessions, snapshotActiveBankKitPads],
  );

  const handleLoadBeatPadsSession = useCallback(
    async (id: string) => {
      const row = findBeatPadsSavedSession(savedBeatPadsSessions, id);
      if (!row) return;
      if (row.kit?.pads && Object.keys(row.kit.pads).length > 0) {
        const loaded = await applyKitPadsToActiveBank(row.kit.pads);
        if (row.kit.label) setKit(row.kit.label);
        if (loaded > 0) {
          flashKitImportHint(`Loaded kit (${loaded} pad${loaded === 1 ? '' : 's'}) + loop "${row.name}"`);
        }
      } else {
        flashKitImportHint(`Loaded loop "${row.name}"`);
      }
      setBeatPadsSessionInject({ session: row, nonce: Date.now() });
    },
    [applyKitPadsToActiveBank, flashKitImportHint, savedBeatPadsSessions],
  );

  const handleRenameBeatPadsSession = useCallback(
    (id: string, name: string) => {
      const next = renameBeatPadsSavedSession(savedBeatPadsSessions, id, name);
      setSavedBeatPadsSessions(next);
      flashKitImportHint('Loop renamed');
    },
    [flashKitImportHint, savedBeatPadsSessions],
  );

  const handleDeleteBeatPadsSession = useCallback(
    (id: string) => {
      const row = findBeatPadsSavedSession(savedBeatPadsSessions, id);
      if (!row) return;
      const next = deleteBeatPadsSavedSession(savedBeatPadsSessions, id);
      setSavedBeatPadsSessions(next);
      flashKitImportHint(`Deleted "${row.name}"`);
    },
    [flashKitImportHint, savedBeatPadsSessions],
  );

  const exportBeatPadsToStudioEditor2 = useCallback(
    (args: {
      pattern: BeatPadsDrumPattern;
      loopBars: number;
      stepsPerBar: BeatPadsGridStepsPerBar;
      bpm: number;
    }) => {
      if (CREATION_BACKEND_BLANK) return;
      const loopBarsClamped = Math.max(
        BEAT_PADS_MIN_LOOP_BARS,
        Math.min(BEAT_PADS_MAX_LOOP_BARS, Math.round(args.loopBars)),
      );
      const exportPat =
        args.stepsPerBar === 32
          ? beatPadsConvertPatternGridSteps(args.pattern, loopBarsClamped, 32, 16)
          : args.pattern;
      const payload = buildBeatPadsStudioImport(exportPat, {
        loopBars: loopBarsClamped,
        stepsPerBar: 16,
        bpm: args.bpm,
        trackName: `Beat Pads · Bank ${BANKS[activeBank] ?? activeBank + 1}`,
      });
      if (payload.notes.length === 0) {
        flashKitImportHint('Nothing to export — paint steps on the Beat Pads loop first');
        return;
      }
      if (onBeatPadsToStudio) {
        onBeatPadsToStudio(payload);
        flashKitImportHint(
          `Sent ${loopBarsClamped}-bar loop to Studio Editor 2 (${payload.notes.length} hits)`,
        );
        return;
      }
      onExport('studio-editor');
      flashKitImportHint('Opening Studio Editor 2…');
    },
    [activeBank, flashKitImportHint, onBeatPadsToStudio, onExport],
  );

  /** Preview sample edit sliders without committing (restores saved opts after trigger). */
  const previewSamplerFxDraft = useCallback((padIndex: number, o: PadSamplerPlaybackOpts) => {
    const k = padSampleKey(activeBank, padIndex);
    if (!padSampleBuffersRef.current.get(k)) return;
    const saved = padSamplePlaybackOptsRef.current[k] ?? defaultPadSamplerPlaybackOpts();
    padSamplePlaybackOptsRef.current[k] = { ...o };
    playPadSoundRef.current(padIndex, PAD_VEL[padIndex] ?? 90);
    padSamplePlaybackOptsRef.current[k] = saved;
  }, [activeBank]);

  const applyPadFxRackLive = useCallback((padIndex: number, rack: PadSamplerFxRack) => {
    const k = padSampleKey(activeBank, padIndex);
    padSampleFxRackRef.current[k] = clonePadSamplerFxRack(rack);
  }, [activeBank]);

  const commitPadSamplerFxRack = useCallback((padIndex: number, rack: PadSamplerFxRack) => {
    const k = padSampleKey(activeBank, padIndex);
    padSampleFxRackRef.current[k] = clonePadSamplerFxRack(rack);
    if (!padSampleBuffersRef.current.get(k)) return;
    const store = loadPadSampleStore();
    const row = store[k];
    if (!row) return;
    writeFxRackToStored(row, rack);
    savePadSampleStore(store);
  }, [activeBank]);

  const getPadSamplerFxRack = useCallback((padIndex: number) => {
    const k = padSampleKey(activeBank, padIndex);
    return padSampleFxRackRef.current[k] ?? defaultPadSamplerFxRack();
  }, [activeBank]);

  const previewPadSamplerFxRack = useCallback((padIndex: number, rack: PadSamplerFxRack) => {
    const k = padSampleKey(activeBank, padIndex);
    if (!padSampleBuffersRef.current.get(k)) return;
    const saved = padSampleFxRackRef.current[k] ?? defaultPadSamplerFxRack();
    padSampleFxRackRef.current[k] = clonePadSamplerFxRack(rack);
    playPadSoundRef.current(padIndex, PAD_VEL[padIndex] ?? 90);
    padSampleFxRackRef.current[k] = saved;
  }, [activeBank]);

  /** Preview with the SRC BPM typed in the popover (restores committed root after trigger). */
  const previewSamplerRootBpmDraft = useCallback((padIndex: number, raw: string) => {
    const k = padSampleKey(activeBank, padIndex);
    if (!padSampleBuffersRef.current.get(k)) return;
    const t = raw.trim();
    let previewRate: number | undefined;
    if (t !== '') {
      const parsed = parseFloat(t);
      if (!Number.isFinite(parsed)) return;
      const root = Math.round(Math.max(40, Math.min(320, parsed)));
      previewRate = Math.min(4, Math.max(0.25, bpmRef.current / root));
    }
    playPadSoundRef.current(padIndex, PAD_VEL[padIndex] ?? 90, undefined, 0, {
      tempoSyncRate: previewRate,
    });
  }, [activeBank]);

  /** Persist a Chord Builder / AI Pattern bounce into a Beat Lab sampler
   *  pad. Shared by both embedded modules so the on-pad behavior is
   *  identical (decode, label, root-BPM, persistence). Pattern mirrors
   *  `handlePadSampleFile` (uploads) and `applyDrumKitGenSinglePad`
   *  (kit gen). Stable identity via useCallback so the embedded screens
   *  don't see their `onExportToPad` prop change every parent render. */
  const onPadBounceExport = useCallback(
    async (args: { padIndex: number; wavBytes: Uint8Array; label: string; rootBpm: number }) => {
      const { padIndex, wavBytes, label, rootBpm } = args;
      if (padIndex < 0 || padIndex > 15) return;
      try {
        const data = uint8ArrayToBase64(wavBytes);
        const stored = { mime: 'audio/wav', data, label, rootBpm };
        const ctx = getOrCreateAudioContext();
        const ab = storedToArrayBuffer(stored);
        const buffer = await ctx.decodeAudioData(ab.slice(0));
        const k = padSampleKey(activeBank, padIndex);
        padSampleBuffersRef.current.set(k, buffer);
        setPadSamplePresence((prev) => ({ ...prev, [k]: true }));
        setPadSampleRootBpms((prev) => ({ ...prev, [k]: rootBpm }));
        setPadSampleLabels((prev) => ({ ...prev, [k]: label }));
        const store = loadPadSampleStore();
        store[k] = stored;
        writeSamplerOptsToStored(stored, defaultPadSamplerPlaybackOpts());
        writeFxRackToStored(stored, defaultPadSamplerFxRack());
        savePadSampleStore(store);
        padSamplePlaybackOptsRef.current[k] = defaultPadSamplerPlaybackOpts();
        padSampleFxRackRef.current[k] = defaultPadSamplerFxRack();
      } catch (err) {
        console.debug('Pad bounce export failed:', err);
      }
    },
    [activeBank, getOrCreateAudioContext],
  );

  /** Chord Builder ? Beat Lab SYNTH: merge MIDI into channels 17?32 and open SYNTH view. */
  const onSendChordMidiToBeatLabSynth = useCallback(
    (args: {
      sections: ReadonlyArray<ChordBuilderBeatLabImportSection>;
      bpm: number;
      label: string;
    }) => {
      if (CREATION_BACKEND_BLANK) return;
      const subdiv = Math.max(
        1,
        Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)),
      );
      const bpb = Math.max(1, Math.round(beatsPerBarRef.current));
      let maxQuarterEnd = 0;
      let colsPerBarChord = MEASURES_PER_BAR;
      for (const sec of args.sections) {
        maxQuarterEnd = Math.max(maxQuarterEnd, sec.totalQuarterCols);
        colsPerBarChord = Math.max(1, Math.round(sec.colsPerBar));
      }
      const barsNeeded = Math.min(
        BEAT_LAB_MAX_LOOP_BARS,
        Math.max(1, Math.ceil(maxQuarterEnd / colsPerBarChord)),
      );
      const patternColsForImport = beatLabPatternColsForLoop(
        barsNeeded,
        subdiv,
        bpb,
        TOTAL_COLS,
      );
      setLoopStartBeat(0);
      setLoopEndBeat(barsNeeded * bpb);
      setLoopBars(barsNeeded);
      const harmonyLane = beatLabSynth2HarmonyLaneRef.current;
      const imported = chordBuilderSongRollToBeatLabRoll(args.sections, {
        stepSubdiv: subdiv,
        patternCols: patternColsForImport,
        beatsPerBar: bpb,
        targetLane: harmonyLane,
      });
      if (imported.length === 0) return;
      const kept = currentMidiRoll.filter((n) => n.lane !== harmonyLane);
      patchActiveBankMidiRollWithUndo([...kept, ...imported]);
      const chordRail = beatLabChordRailFromImportSections(args.sections);
      setBeatLabSynthChordRail(chordRail);
      const ctx = getOrCreateAudioContext();
      try {
        if (ctx.state === 'suspended') void ctx.resume();
      } catch {
        /* autoplay */
      }
      void warmupBeatLabMelodicSoundfont(ctx, [beatLabSynth2PianoInstrumentRef.current], true);
      setBeatLabSynth2RollExpandKey((k) => k + 1);
      setBeatLabDeckFocus('synth2');
      goToCreationSub('beat-lab');
      setSelectedBeatLabLane(harmonyLane);
    },
    [
      currentMidiRoll,
      getOrCreateAudioContext,
      goToCreationSub,
      patchActiveBankMidiRollWithUndo,
      setBeatLabDeckFocus,
    ],
  );

  /** Groove Lab chord roll → Beat Lab NEW SYNTH (no Chord Builder). */
  const onSendGrooveChordsToNewSynth = useCallback(
    (args: GrooveLabNewSynthExportArgs) => {
      if (CREATION_BACKEND_BLANK) return;
      const subdiv = Math.max(
        1,
        Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)),
      );
      const bpb = Math.max(1, Math.round(beatsPerBarRef.current));
      const barsNeeded = Math.min(
        BEAT_LAB_MAX_LOOP_BARS,
        Math.max(1, grooveRollBarsNeeded(args.chordHits)),
      );
      const patternColsForImport = beatLabPatternColsForLoop(
        barsNeeded,
        subdiv,
        bpb,
        TOTAL_COLS,
      );
      setLoopStartBeat(0);
      setLoopEndBeat(barsNeeded * bpb);
      setLoopBars(barsNeeded);
      const harmonyLane = beatLabSynth2HarmonyLaneRef.current;
      const imported =
        args.progressionSteps && args.progressionSteps.length > 0
          ? grooveProgressionStepsToBeatLabRoll(args.progressionSteps, {
              stepSubdiv: subdiv,
              patternCols: patternColsForImport,
              beatsPerBar: bpb,
              targetLane: harmonyLane,
              quantize: args.quantize,
              barCount: args.barCount ?? barsNeeded,
            })
          : grooveRollHitsToBeatLabRoll(args.chordHits, {
              stepSubdiv: subdiv,
              patternCols: patternColsForImport,
              beatsPerBar: bpb,
              targetLane: harmonyLane,
              quantize: args.quantize,
              barCount: args.barCount ?? barsNeeded,
            });
      if (imported.length === 0) return;
      const stepsPerBar = beatLabStepsPerBar(subdiv, bpb, MEASURES_PER_BAR);
      const keyRoot = args.keyRoot ?? 0;
      const mode = args.mode ?? 'major';
      const chordRail =
        args.progressionSteps && args.progressionSteps.length > 0
          ? grooveProgressionStepsToChordRail(args.progressionSteps, bpb, keyRoot, mode)
          : grooveRollHitsToChordRail(args.chordHits, keyRoot, mode);
      const bassLane = beatLabSynth2BassLaneRef.current;
      const bassSlot = beatLabMelodicSlotIndex(bassLane);
      const bassVoice = melodicSynthVoicesRef.current[bassSlot];
      const layoutBars: 4 | 8 = bassVoice?.glideLayoutBars === 4 ? 4 : 8;
      const midiAtHarmony = (n: BeatLabMidiNote) => beatLabNoteMidi(harmonyLane, n);
      const midiAtBass = (n: BeatLabMidiNote) => beatLabNoteMidi(bassLane, n);
      const mergedHarmony = [...currentMidiRoll.filter((n) => n.lane !== harmonyLane), ...imported];
      const withSyncedBass = beatLabSynthV2ResyncBassToHarmony({
        notes: mergedHarmony,
        bassLane,
        harmonyLane,
        layoutBars,
        stepsPerBar,
        patternCols: patternColsForImport,
        chordRail,
        midiAtHarmony,
        midiAtBass,
      });
      patchActiveBankMidiRollWithUndo(withSyncedBass);
      setBeatLabSynthChordRail(chordRail);
      const ctx = getOrCreateAudioContext();
      try {
        if (ctx.state === 'suspended') void ctx.resume();
      } catch {
        /* autoplay */
      }
      void warmupBeatLabMelodicSoundfont(ctx, [beatLabSynth2PianoInstrumentRef.current], true);
      setBeatLabSynth2RollExpandKey((k) => k + 1);
      setBeatLabDeckFocus('synth2');
      goToCreationSub('beat-lab');
      setSelectedBeatLabLane(harmonyLane);
    },
    [
      currentMidiRoll,
      getOrCreateAudioContext,
      goToCreationSub,
      patchActiveBankMidiRollWithUndo,
      setBeatLabDeckFocus,
    ],
  );

  useEffect(() => {
    if (!isScreenActive) return;
    const applyNeuralHumNewSynth = () => {
      const payload = takeNeuralHumCreationImport('new-synth');
      if (!payload || payload.notes.length === 0) return;
      if (CREATION_BACKEND_BLANK) return;

      const subdiv = Math.max(
        1,
        Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)),
      );
      const bpb = Math.max(1, Math.round(beatsPerBarRef.current));
      const bpmImport = Math.max(30, Math.min(300, payload.bpm));
      const spb = 60 / bpmImport;
      const endBeat = payload.notes.reduce(
        (max, n) => Math.max(max, n.startSec / spb + n.durationSec / spb),
        0,
      );
      const barsNeeded = Math.min(
        BEAT_LAB_MAX_LOOP_BARS,
        Math.max(1, Math.ceil(endBeat / bpb)),
      );
      const patternColsForImport = beatLabPatternColsForLoop(
        barsNeeded,
        subdiv,
        bpb,
        TOTAL_COLS,
      );
      const harmonyLane = beatLabSynth2HarmonyLaneRef.current;
      const imported = timedNotesToBeatLabHarmonyRoll(payload.notes, {
        bpm: bpmImport,
        stepSubdiv: subdiv,
        patternCols: patternColsForImport,
        beatsPerBar: bpb,
        colsPerBar: MEASURES_PER_BAR,
        harmonyLane,
        transposeSemis: payload.transposeSemis ?? 0,
      });
      if (imported.length === 0) return;

      setLoopStartBeat(0);
      setLoopEndBeat(barsNeeded * bpb);
      setLoopBars(barsNeeded);
      const mergedHarmony = [
        ...currentMidiRoll.filter((n) => n.lane !== harmonyLane),
        ...imported,
      ];
      patchActiveBankMidiRollWithUndo(mergedHarmony);
      const ctx = getOrCreateAudioContext();
      try {
        if (ctx.state === 'suspended') void ctx.resume();
      } catch {
        /* autoplay */
      }
      void warmupBeatLabMelodicSoundfont(ctx, [beatLabSynth2PianoInstrumentRef.current], true);
      setBeatLabSynth2RollExpandKey((k) => k + 1);
      setBeatLabDeckFocus('synth2');
      goToCreationSub('beat-lab');
      setSelectedBeatLabLane(harmonyLane);
    };

    window.addEventListener(NEURAL_HUM_CREATION_IMPORT_EVENT, applyNeuralHumNewSynth);
    applyNeuralHumNewSynth();
    return () => window.removeEventListener(NEURAL_HUM_CREATION_IMPORT_EVENT, applyNeuralHumNewSynth);
  }, [
    currentMidiRoll,
    getOrCreateAudioContext,
    goToCreationSub,
    isScreenActive,
    patchActiveBankMidiRollWithUndo,
    setBeatLabDeckFocus,
  ]);

  const applyDrumKitGenSinglePad = useCallback(
    async (padIndex: number) => {
      const ctx = await ensureCtx();
      setDrumKitGenBusy(true);
      try {
        const pi = Math.max(0, Math.min(15, Math.floor(padIndex)));
        const sr = ctx.sampleRate;
        const seed = (Date.now() ^ (activeBank * 31 + pi) * 0x85ebca6b) >>> 0;
        const buf = synthesizeKitPadBuffer(sr, pi, drumKitGenStyle, seed);
        const label = `${PAD_NAMES[pi]} (kit gen)`;
        const stored = audioBufferToStoredKitSample(buf, label, bpm);
        const ab = storedToArrayBuffer(stored);
        const buffer = await ctx.decodeAudioData(ab.slice(0));
        const k = padSampleKey(activeBank, pi);
        padSampleBuffersRef.current.set(k, buffer);
        setPadSamplePresence((prev) => ({ ...prev, [k]: true }));
        setPadSampleRootBpms((prev) => ({ ...prev, [k]: bpm }));
        setPadSampleLabels((prev) => ({ ...prev, [k]: label }));
        const store = loadPadSampleStore();
        store[k] = stored;
        writeSamplerOptsToStored(stored, defaultPadSamplerPlaybackOpts());
        writeFxRackToStored(stored, defaultPadSamplerFxRack());
        savePadSampleStore(store);
        padSamplePlaybackOptsRef.current[k] = defaultPadSamplerPlaybackOpts();
        padSampleFxRackRef.current[k] = defaultPadSamplerFxRack();
      } catch (err) {
        console.debug('Drum kit generator (single pad) failed:', err);
      } finally {
        setDrumKitGenBusy(false);
      }
    },
    [activeBank, bpm, drumKitGenStyle, ensureCtx],
  );

  const applyBeatLabProducerKit = useCallback(
    async (
      kitIdOverride?: BeatLabProducerKitId,
      opts?: { bankIndex?: number; quiet?: boolean },
    ) => {
      const kitToLoad = kitIdOverride ?? producerKitId;
      const targetBank = opts?.bankIndex ?? activeBank;
      const bankLabel = BANKS[targetBank] ?? String(targetBank + 1);
      const meta = beatLabProducerKitMeta(kitToLoad);
      if (!meta) return;
      if (kitIdOverride != null) {
        setProducerKitId(kitToLoad);
      }
      const loadGen = ++producerKitLoadGenRef.current;
      const ctx = await ensureCtx();
      if (loadGen !== producerKitLoadGenRef.current) return;
      if (!opts?.quiet) {
        setProducerKitLoading(true);
        setLoadingProducerKitId(kitToLoad);
        flashKitImportHint(`Loading ${meta.title} → bank ${bankLabel}…`);
      }
      try {
        const pads = await ensureBeatLabProducerKitLoaded(kitToLoad, ctx);
        if (loadGen !== producerKitLoadGenRef.current) return;
        if (pads.length === 0) {
          if (!opts?.quiet) {
            flashKitImportHint(`Bank ${bankLabel} — kit download failed (check connection)`);
          }
          return;
        }
        const defaultFx = defaultPadSamplerFxRack();
        const nextPresence: Record<string, boolean> = {};
        const nextRoots: Record<string, number> = {};
        const nextLabels: Record<string, string> = {};
        for (const { pad, buffer, label, sampler, rootMidi, chromatic } of pads) {
          const k = padSampleKey(targetBank, pad);
          padSampleBuffersRef.current.set(k, buffer);
          nextPresence[k] = true;
          nextRoots[k] = bpm;
          nextLabels[k] = label;
          padSamplePlaybackOptsRef.current[k] = sampler;
          padSampleFxRackRef.current[k] = defaultFx;
          if (chromatic) {
            padSampleChromaticRef.current[k] = true;
            padSampleRootMidiRef.current[k] =
              typeof rootMidi === 'number' ? rootMidi : 60;
          } else {
            delete padSampleChromaticRef.current[k];
            delete padSampleRootMidiRef.current[k];
            delete padSampleStrikeMidiRef.current[k];
          }
        }
        setPadSamplePresence((prev) => ({ ...prev, ...nextPresence }));
        setPadSampleRootBpms((prev) => ({ ...prev, ...nextRoots }));
        setPadSampleLabels((prev) => ({ ...prev, ...nextLabels }));
        if (!opts?.quiet) {
          flashKitImportHint(
            `${meta.title} — ${pads.length} pads on bank ${bankLabel}`,
          );
        }
        const persistBank = targetBank;
        const persistBpm = bpm;
        padStorePersistRef.current = padStorePersistRef.current
          .then(() => {
            const store = loadPadSampleStore();
            for (const { pad, buffer, label, sampler, rootMidi, chromatic } of pads) {
              const k = padSampleKey(persistBank, pad);
              const stored = audioBufferToStoredKitSample(buffer, label, persistBpm);
              writeSamplerOptsToStored(stored, sampler);
              writeChromaticPadMetaToStored(stored, rootMidi, chromatic);
              writeFxRackToStored(stored, defaultFx);
              store[k] = stored;
            }
            savePadSampleStore(store);
          })
          .catch((err) => {
            console.debug('Producer kit persist failed:', err);
          });
      } catch (err) {
        console.debug('Producer kit load failed:', err);
        if (!opts?.quiet) {
          flashKitImportHint(`Bank ${bankLabel} — could not load ${meta.title}`);
        }
      } finally {
        if (!opts?.quiet && loadGen === producerKitLoadGenRef.current) {
          setProducerKitLoading(false);
          setLoadingProducerKitId(null);
        }
      }
    },
    [activeBank, bpm, ensureCtx, flashKitImportHint, producerKitId],
  );

  const applyDrumKitGenFullKit = useCallback(async () => {
    const ctx = await ensureCtx();
    setDrumKitGenBusy(true);
    try {
      const sr = ctx.sampleRate;
      const seed = (Date.now() ^ (activeBank + 1) * 0x1a2b3c4d) >>> 0;
      for (let pi = 0; pi < 16; pi++) {
        const buf = synthesizeKitPadBuffer(sr, pi, drumKitGenStyle, seed);
        const label = `${PAD_NAMES[pi]} (kit gen)`;
        const stored = audioBufferToStoredKitSample(buf, label, bpm);
        const ab = storedToArrayBuffer(stored);
        const buffer = await ctx.decodeAudioData(ab.slice(0));
        const k = padSampleKey(activeBank, pi);
        padSampleBuffersRef.current.set(k, buffer);
        setPadSamplePresence((prev) => ({ ...prev, [k]: true }));
        setPadSampleRootBpms((prev) => ({ ...prev, [k]: bpm }));
        setPadSampleLabels((prev) => ({ ...prev, [k]: label }));
        const store = loadPadSampleStore();
        store[k] = stored;
        writeSamplerOptsToStored(stored, defaultPadSamplerPlaybackOpts());
        savePadSampleStore(store);
        padSamplePlaybackOptsRef.current[k] = defaultPadSamplerPlaybackOpts();
      }
    } catch (err) {
      console.debug('Drum kit generator (full kit) failed:', err);
    } finally {
      setDrumKitGenBusy(false);
    }
  }, [activeBank, bpm, drumKitGenStyle, ensureCtx]);

  const applyDrumKitGenPattern = useCallback(() => {
    const seed = (Date.now() ^ (activeBank + 3) * 0x4d5e6f70) >>> 0;
    const q = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
    const pat = buildKitGroovePattern({
      totalCols: TOTAL_COLS,
      patternCols: patternColsDrums,
      subdiv: drumStepSubdiv,
      qpb: q,
      style: drumKitGenStyle,
      seed,
    });
    setBankPatternSlots((prev) =>
      prev.map((slots, i) =>
        i !== activeBank ? slots : { ...slots, [patternSlot]: pat.map((r) => r.slice()) },
      ),
    );
    setBanks((prev) =>
      prev.map((b, i) => (i !== activeBank ? b : { ...b, drums: pat.map((row) => row.slice()) })),
    );
    goToCreationSub('beat-lab');
  }, [activeBank, beatsPerBar, drumKitGenStyle, drumStepSubdiv, patternColsDrums, patternSlot, goToCreationSub]);

  const patternBankActivePickSummary =
    loadedPatternBankPick != null
      ? `${beatLabPatternBankCategoryLabel(loadedPatternBankPick.bankId)} · ${loadedPatternBankPick.presetName}`
      : null;

  const applyBeatLabPatternPreset = useCallback(
    (preset: PatternPreset) => {
      if (CREATION_BACKEND_BLANK) return;
      const bankId = beatLabPatternBankIdForPresetGenre(preset.genre);
      if (bankId) {
        setLoadedPatternBankPick({ bankId, presetId: preset.id, presetName: preset.name });
      }
      /** Presets are authored on a 1/16 grid — align snap so column spacing matches playback. */
      setPianoSnapSubdiv(BEAT_LAB_DRUMLOOP_SNAP_SUBDIV);
      const subdivForPattern = BEAT_LAB_DRUMLOOP_SNAP_SUBDIV;
      const bpb = Math.max(1, Math.round(beatsPerBarRef.current));
      const patternBars = BEAT_LAB_PRESET_LOOP_BARS;
      const gridStepsPerBar = bpb * subdivForPattern;
      const colsForPattern = Math.max(1, Math.min(TOTAL_COLS, patternBars * gridStepsPerBar));
      const pat = beatLabModernRnbDrumsPostProcess(
        preset.id,
        presetToBeatLabDrums(preset, {
          totalCols: colsForPattern,
          gridStepsPerBar,
        }).map((r) => r.slice()),
      );
      const presetBpm = getPatternPresetBpm(preset);
      const producerGridBpm = getPatternPresetProducerGridBpm(preset);
      const trapGridLabel = beatLabTrapProducerGridBpmLabel(preset, producerGridBpm, presetBpm);
      const kitPick = beatLabProducerKitIdForPatternPreset(preset);
      const kitMeta = beatLabProducerKitMeta(kitPick);
      const flagshipBankIndex =
        beatLabPatternHasPairedKit(preset.id)
          ? BEAT_LAB_FLAGSHIP_KIT_ORDER.indexOf(kitPick)
          : -1;
      const targetBank = flagshipBankIndex >= 0 ? flagshipBankIndex : activeBank;
      if (flagshipBankIndex >= 0) {
        setActiveBank(flagshipBankIndex);
      }
      setBanks((prev) =>
        prev.map((b, i) => (i === targetBank ? { ...b, drums: pat.map((row) => row.slice()) } : b)),
      );
      setBankPatternSlots((prev) =>
        prev.map((slots, i) =>
          i !== targetBank ? slots : { ...slots, [patternSlot]: pat.map((row) => row.slice()) },
        ),
      );
      /** Snap refs before Play so WAAPI geometry matches the loaded grid on the first frame. */
      drumStepSubdivRef.current = subdivForPattern;
      patternColsDrumsRef.current = colsForPattern;
      patternColsDrumsBeatsRef.current = Math.max(1, patternBars * bpb);
      cursorBeatRef.current = 0;
      originBeatRef.current = 0;
      displayBeatRef.current = 0;
      beatLabPlaylineGeomKeyRef.current = '';
      setLoopOn(false);
      setLoopRangeBeats(0, patternBars * bpb);
      setBeatLabGridZoomMode('max');
      if (beatLabDeckFocus !== 'sequence') setBeatLabDeckFocus('sequence');
      if (!runningRef.current) {
        haltCreationPlaylineAtBeat(0);
      }
      setBpm(presetBpm);
      beatLabLastPlayBpmRef.current = presetBpm;
      setBpmInput(String(presetBpm));
      setPatternBankHint(
        trapGridLabel != null
          ? `Loaded "${preset.name}" @ ${presetBpm} BPM feel (grid ${trapGridLabel}) — ${kitMeta?.title ?? 'Crew'} kit — bank ${BANKS[targetBank]} slot ${patternSlot}`
          : `Loaded "${preset.name}" @ ${presetBpm} BPM — ${kitMeta?.title ?? 'Crew'} kit — bank ${BANKS[targetBank]} slot ${patternSlot}`,
      );
      goToCreationSub('beat-lab');
      void applyBeatLabProducerKit(kitPick, { bankIndex: targetBank });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => fitBeatLabGridToViewport());
      });
    },
    [
      CREATION_BACKEND_BLANK,
      activeBank,
      applyBeatLabProducerKit,
      beatLabDeckFocus,
      fitBeatLabGridToViewport,
      patternSlot,
      goToCreationSub,
      haltCreationPlaylineAtBeat,
      setLoopRangeBeats,
    ],
  );

  const syncPatternBankPickHint = useCallback((preset: PatternPreset, target: 'beat-pads' | 'beat-lab') => {
    const bankId = beatLabPatternBankIdForPresetGenre(preset.genre);
    if (bankId) {
      setLoadedPatternBankPick({ bankId, presetId: preset.id, presetName: preset.name });
    }
    const presetBpm = getPatternPresetBpm(preset);
    if (target === 'beat-pads') {
      setPatternBankHint(`Loaded "${preset.name}" @ ${presetBpm} BPM → Beat Pads loop`);
    }
  }, []);

  const loadBeatPadsPatternKit = useCallback(
    (preset: PatternPreset) => {
      if (CREATION_BACKEND_BLANK) return;
      const kitPick = beatLabProducerKitIdForPatternPreset(preset);
      void applyBeatLabProducerKit(kitPick, { bankIndex: activeBank, quiet: true });
    },
    [CREATION_BACKEND_BLANK, activeBank, applyBeatLabProducerKit],
  );

  const applyPatternBankPreset = useCallback(
    (preset: PatternPreset) => {
      if (CREATION_BACKEND_BLANK) return;
      if (beatPadsMachineOpen) {
        setBeatPadsPatternInject({ preset, nonce: Date.now() });
        syncPatternBankPickHint(preset, 'beat-pads');
        return;
      }
      applyBeatLabPatternPreset(preset);
    },
    [CREATION_BACKEND_BLANK, applyBeatLabPatternPreset, beatPadsMachineOpen, syncPatternBankPickHint],
  );

  useEffect(() => {
    if (!patternBankHint) return;
    const t = window.setTimeout(() => setPatternBankHint(null), 4000);
    return () => window.clearTimeout(t);
  }, [patternBankHint]);

  /** First launch — fill empty banks A–H with flagship Trap / R&B / Dance kits (16 pads each). */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { seeded } = await seedBeatLabFlagshipBanksIfNeeded(async (kitId, bankIndex) => {
          if (cancelled) return;
          await applyBeatLabProducerKit(kitId, { bankIndex, quiet: true });
        });
        if (!cancelled && seeded > 0) {
          flashKitImportHint(
            `Flagship kits loaded — Trap / R&B / Dance on banks A–H (${seeded} bank${seeded === 1 ? '' : 's'})`,
          );
        }
      } catch (err) {
        console.debug('Flagship bank seed failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyBeatLabProducerKit, flashKitImportHint]);

  const applyDrumKitGenBoth = useCallback(async () => {
    await applyDrumKitGenFullKit();
    applyDrumKitGenPattern();
    setDrumKitGenOpen(false);
  }, [applyDrumKitGenFullKit, applyDrumKitGenPattern]);

  const commitPadSampleLabel = useCallback((padIndex: number, raw: string) => {
    const k = padSampleKey(activeBank, padIndex);
    if (!padSampleBuffersRef.current.get(k)) return;
    const store = loadPadSampleStore();
    const row = store[k];
    if (!row) return;
    const t = raw.trim();
    if (t) row.label = t;
    else delete row.label;
    savePadSampleStore(store);
    if (t) setPadSampleLabels((prev) => ({ ...prev, [k]: t }));
    else {
      setPadSampleLabels((prev) => {
        const n = { ...prev };
        delete n[k];
        return n;
      });
    }
  }, [activeBank]);

  const commitPadSampleRootBpm = useCallback(
    (padIndex: number, raw: string) => {
      const k = padSampleKey(activeBank, padIndex);
      if (!padSamplePresence[k]) return;
      const store = loadPadSampleStore();
      const row = store[k];
      if (!row) return;
      const t = raw.trim();
      if (t === '') {
        delete row.rootBpm;
        savePadSampleStore(store);
        setPadSampleRootBpms((prev) => {
          const n = { ...prev };
          delete n[k];
          return n;
        });
        return;
      }
      const parsed = parseFloat(t);
      if (!Number.isFinite(parsed)) return;
      const v = Math.round(Math.max(40, Math.min(320, parsed)));
      row.rootBpm = v;
      savePadSampleStore(store);
      setPadSampleRootBpms((prev) => ({ ...prev, [k]: v }));
    },
    [activeBank, padSamplePresence],
  );

  const hasPadSampleForActiveBank = useCallback(
    (padIndex: number) => {
      const k = padSampleKey(activeBank, padIndex);
      return !!(padSamplePresence[k] || padSampleBuffersRef.current.get(k));
    },
    [padSamplePresence, activeBank],
  );

  function toggleDrum(pad: number, col: number) {
    const mutate = (drums: DrumPattern) =>
      drums.map((row, r) => row.map((v, c) => (r === pad && c === col ? !v : v)));
    setBanks((prev) =>
      prev.map((b, i) =>
        i !== activeBank ? b : { ...b, drums: mutate(normalizeBankDrumPattern(b.drums)) },
      ),
    );
    setBankPatternSlots((prev) =>
      prev.map((slots, i) =>
        i !== activeBank
          ? slots
          : { ...slots, [patternSlot]: mutate(normalizeBankDrumPattern(slots[patternSlot])) },
      ),
    );
  }

  function setDrumStep(pad: number, col: number, enabled: boolean, slot: PatternSlot = patternSlot) {
    const mutate = (drums: DrumPattern) =>
      drums.map((row, r) => row.map((v, c) => (r === pad && c === col ? enabled : v)));
    setBanks((prev) =>
      prev.map((b, i) =>
        i !== activeBank ? b : { ...b, drums: mutate(normalizeBankDrumPattern(b.drums)) },
      ),
    );
    setBankPatternSlots((prev) =>
      prev.map((slots, i) =>
        i !== activeBank
          ? slots
          : { ...slots, [slot]: mutate(normalizeBankDrumPattern(slots[slot])) },
      ),
    );
  }

  const auditionDrumLane = useCallback((padIndex: number) => {
    setSelectedBeatLabLane(padIndex);
    playPadSoundRef.current(padIndex, PAD_VEL[padIndex] ?? 90);
  }, []);

  const clearDrumLane = useCallback(
    (padIndex: number) => {
      if (CREATION_BACKEND_BLANK) return;
      wipeBeatLabDrumPattern(padIndex);
    },
    [wipeBeatLabDrumPattern],
  );

  clearDrumLaneRef.current = clearDrumLane;

  /** Clear all drum steps for current bank + pattern slot. */
  const clearCurrentPatternDrums = useCallback(() => {
    if (CREATION_BACKEND_BLANK) return;
    wipeBeatLabDrumPattern();
    flashKitImportHint(`Cleared grid — bank ${BANKS[activeBank]}, slot ${patternSlot}`);
  }, [activeBank, flashKitImportHint, patternSlot, wipeBeatLabDrumPattern]);

  const copyPatternAToB = useCallback(() => {
    setBankPatternSlots((prev) =>
      prev.map((slots, i) => {
        if (i !== activeBank) return slots;
        const nextB = normalizeBankDrumPattern(slots.A).map((r) => r.slice());
        if (patternSlot === 'B') {
          setBanks((bprev) =>
            bprev.map((b, bi) => (bi !== activeBank ? b : { ...b, drums: nextB.map((r) => r.slice()) })),
          );
        }
        return { ...slots, B: nextB };
      }),
    );
  }, [activeBank, patternSlot]);

  const swapPatternAB = useCallback(() => {
    setBankPatternSlots((prev) =>
      prev.map((slots, i) => {
        if (i !== activeBank) return slots;
        const nextA = normalizeBankDrumPattern(slots.B).map((r) => r.slice());
        const nextB = normalizeBankDrumPattern(slots.A).map((r) => r.slice());
        const activePat = patternSlot === 'B' ? nextB : nextA;
        setBanks((bprev) =>
          bprev.map((b, bi) =>
            bi !== activeBank ? b : { ...b, drums: activePat.map((r) => r.slice()) },
          ),
        );
        return { A: nextA, B: nextB };
      }),
    );
  }, [activeBank, patternSlot]);
  function toggleNote(row: number, col: number) {
    if (sharedNotes.some(n => n.row === row && n.col === col)) {
      removeSharedNote(row, col);
    } else {
      addSharedNote(row, col);
    }
  }

  // Piano note synthesis ? use shared MasterClock AudioContext (same graph as drums/transport).
  const playingOscsRef = useRef(new Map<string, { osc: OscillatorNode; gain: GainNode }>());

  const playPianoNote = useCallback((noteRow: number, duration = 0.5) => {
    try {
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime;
      const midiNote = noteNameToMidi(displayNotes[noteRow] ?? NOTES[noteRow]);
      const freq = midiNoteToFreq(midiNote);
      const key = `${midiNote}`;
      
      // Create oscillator + gain
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      const master = (window as unknown as { __daMusicMasterGain?: GainNode | null })
        .__daMusicMasterGain;
      const dest =
        master && master.context === ctx ? master : ctx.destination;
      gain.connect(dest);
      
      // Instrument selection
      switch (rollInstr) {
        case 0: // Piano
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.02, now + duration);
          break;
        case 1: // Synth
          osc.type = 'triangle';
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
          break;
        case 2: // Bass
          osc.type = 'sawtooth';
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.03, now + duration);
          break;
        case 3: // Lead
          osc.type = 'square';
          gain.gain.setValueAtTime(0.10, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + duration * 0.8);
          break;
      }
      
      osc.frequency.setValueAtTime(freq, now);
      osc.start(now);
      osc.stop(now + duration);
      
      if (playingOscsRef.current) {
        playingOscsRef.current.set(key, { osc, gain });
        setTimeout(() => playingOscsRef.current?.delete(key), duration * 1000);
      }
    } catch (e) {
      console.debug('Piano synth error:', e);
    }
  }, [rollInstr, getOrCreateAudioContext, displayNotes]);

  // Trigger piano notes from Piano Roll during playback.
  useEffect(() => {
    if (!isScreenActive) return;
    if (!isPlaying || activeCol < 0) return;
    if (tab !== 'piano' || pianoMode !== 'notes') return;
    const notesAtCol = sharedNotes.filter(n => n.col === activeCol);
    notesAtCol.forEach(note => playPianoNote(note.row, 0.3));
  }, [activeCol, isPlaying, sharedNotes, playPianoNote, tab, pianoMode, isScreenActive]);

  const hasDrums = (i: number) => {
    const drums = banks[i]?.drums;
    if (!Array.isArray(drums)) return false;
    return drums.some((r) => Array.isArray(r) && r.some(Boolean));
  };
  const hasNotes = (i: number) => (banks[i]?.notes?.length ?? 0) > 0;
  const drumGridColW = Math.max(colWidth, DRUM_GRID_MIN_CW);
  const beatLabTileGridOn = beatLabTileGridActive(beatLabTileGrid, drumGridColW);
  const pianoGridColW = Math.max(colWidth, PIANO_GRID_MIN_CW);

  /** Place or clear a grid step ? keeps drums + midiRoll in sync for pad lanes (single bank write). */
  const placeBeatLabGridStep = useCallback(
    (pad: number, patternCol: number, on: boolean) => {
      if (CREATION_BACKEND_BLANK) return;
      const bankCol = patternCol + drumColOffset;
      const mutateDrums = (drums: DrumPattern) =>
        drums.map((row, r) =>
          row.map((v, c) => (r === pad && c === bankCol ? on : v)),
        );

      setBanks((prev) => {
        const bank = prev[activeBank];
        if (!bank) return prev;
        const roll = bank.midiRoll ?? [];
        const nextDrums = mutateDrums(normalizeBankDrumPattern(bank.drums));

        if (pad >= BEAT_LAB_PAD_LANES) {
          return prev.map((b, i) =>
            i === activeBank ? { ...b, drums: nextDrums } : b,
          );
        }

        if (on) {
          if (roll.some((n) => n.lane === pad && n.col === patternCol)) {
            return prev.map((b, i) =>
              i === activeBank ? { ...b, drums: nextDrums } : b,
            );
          }
          const nextRoll = [
            ...roll,
            { lane: pad, col: patternCol, len: 1, vel: PAD_VEL[pad] ?? 100 },
          ];
          return prev.map((b, i) =>
            i === activeBank ? { ...b, drums: nextDrums, midiRoll: nextRoll } : b,
          );
        }

        const note = roll.find((n) => n.lane === pad && n.col === patternCol);
        const nextRoll = roll.filter((n) => !(n.lane === pad && n.col === patternCol));
        if (nextRoll.length === roll.length && !nextDrums[pad]?.[bankCol]) {
          return prev.map((b, i) =>
            i === activeBank ? { ...b, drums: nextDrums } : b,
          );
        }
        let drumsOut = nextDrums;
        if (note) {
          drumsOut = applyDrumSpanForPadNote(drumsOut, pad, patternCol, note.len, false);
        } else {
          drumsOut = applyDrumSpanForPadNote(drumsOut, pad, patternCol, 1, false);
        }
        return prev.map((b, i) =>
          i === activeBank ? { ...b, drums: drumsOut, midiRoll: nextRoll } : b,
        );
      });

      setBankPatternSlots((prev) =>
        prev.map((slots, i) =>
          i !== activeBank
            ? slots
            : {
                ...slots,
                [patternSlot]: mutateDrums(normalizeBankDrumPattern(slots[patternSlot])),
              },
        ),
      );
    },
    [activeBank, applyDrumSpanForPadNote, drumColOffset, patternSlot],
  );

  const paintDrumAtClient = useCallback(
    (clientX: number, clientY: number, on: boolean) => {
      const el = drumScrollRef.current;
      const contentEl = drumGridContentRef.current;
      if (!el || !contentEl || CREATION_BACKEND_BLANK) return;
      const cell = beatLabDrumCellFromPointer(clientX, clientY, el, {
        colWidth: drumGridColW,
        headerH: DRUM_GRID_SCROLL_HEADER_H,
        rowH: DRUM_GRID_ROW_H,
        laneCount: PAD_NAMES.length,
        patternCols: patternColsDrums,
        colOffset: drumColOffset,
        contentEl,
      });
      if (!cell) return;
      const key = beatLabDrumCellKey(cell.pad, cell.bankCol);
      const paint = drumPaintRef.current;
      if (paint?.active && paint.lastKey === key) return;
      if (paint?.active) paint.lastKey = key;
      placeBeatLabGridStep(cell.pad, cell.patternCol, on);
    },
    [CREATION_BACKEND_BLANK, drumColOffset, drumGridColW, patternColsDrums, placeBeatLabGridStep],
  );

  const paintDrumSegment = useCallback(
    (x0: number, y0: number, x1: number, y1: number, on: boolean) => {
      const el = drumScrollRef.current;
      const contentEl = drumGridContentRef.current;
      if (!el || !contentEl || CREATION_BACKEND_BLANK) return;
      const cells = beatLabDrumCellsAlongSegment(x0, y0, x1, y1, el, {
        colWidth: drumGridColW,
        headerH: DRUM_GRID_SCROLL_HEADER_H,
        rowH: DRUM_GRID_ROW_H,
        laneCount: PAD_NAMES.length,
        patternCols: patternColsDrums,
        colOffset: drumColOffset,
        contentEl,
      });
      for (const cell of cells) {
        placeBeatLabGridStep(cell.pad, cell.patternCol, on);
      }
      const last = cells[cells.length - 1];
      if (last && drumPaintRef.current?.active) {
        drumPaintRef.current.lastKey = beatLabDrumCellKey(last.pad, last.bankCol);
      }
    },
    [CREATION_BACKEND_BLANK, drumColOffset, drumGridColW, patternColsDrums, placeBeatLabGridStep],
  );

  const beginDrumPaint = useCallback(
    (clientX: number, clientY: number, shiftKey: boolean) => {
      if (CREATION_BACKEND_BLANK || !beatLabToolUsesDrumBrush(beatLabEditTool)) return;
      const on = beatLabDrumBrushValue(beatLabEditTool, shiftKey);
      if (on === null) return;
      drumPaintRef.current = {
        active: true,
        on,
        lastKey: '',
        lastX: clientX,
        lastY: clientY,
      };
      paintDrumAtClient(clientX, clientY, on);
    },
    [CREATION_BACKEND_BLANK, beatLabEditTool, paintDrumAtClient],
  );

  const beginGridNoteResize = useCallback(
    (
      e: { preventDefault(): void; stopPropagation(): void; clientX: number; pointerId?: number },
      lane: number,
      headCol: number,
      note: BeatLabMidiNote,
      captureTarget?: HTMLElement | null,
    ) => {
      if (CREATION_BACKEND_BLANK || beatLabEditTool !== 'pointer') return;
      e.preventDefault();
      e.stopPropagation();
      beatLabGridDragRef.current = null;
      beatLabGridFocusRef.current = { lane, col: headCol };
      setBeatLabRollSelection({ lane, col: headCol });
      beatLabGridResizeRef.current = {
        lane,
        headCol,
        startX: e.clientX,
        startLen: note.len,
        previewLen: note.len,
      };
      if (captureTarget != null && e.pointerId != null) {
        try {
          captureTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    },
    [beatLabEditTool],
  );

  useEffect(() => {
    const onUp = () => {
      drumPaintRef.current = null;
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, []);

  useEffect(() => {
    if (!beatLabToolUsesDrumBrush(beatLabEditTool)) return;
    const onMove = (e: MouseEvent) => {
      const paint = drumPaintRef.current;
      if (!paint?.active) return;
      paintDrumSegment(paint.lastX, paint.lastY, e.clientX, e.clientY, paint.on);
      paint.lastX = e.clientX;
      paint.lastY = e.clientY;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [beatLabEditTool, paintDrumSegment]);

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const r = beatLabGridResizeRef.current;
      if (!r) return;
      e.preventDefault();
      const deltaCols = Math.round((e.clientX - r.startX) / drumGridColW);
      const nextLen = Math.max(1, r.startLen + deltaCols);
      if (nextLen === r.previewLen) return;
      r.previewLen = nextLen;
      resizeBeatLabMidiRollNoteRef.current(r.lane, r.headCol, r.previewLen);
    }
    function onPointerUp() {
      const r = beatLabGridResizeRef.current;
      if (r) {
        resizeBeatLabMidiRollNoteRef.current(r.lane, r.headCol, r.previewLen);
        beatLabGridJustDraggedRef.current = true;
        beatLabGridResizeRef.current = null;
      }
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [drumGridColW]);

  useEffect(() => {
    if (beatLabEditTool !== 'pointer') return;
    function onMove(e: MouseEvent) {
      const drag = beatLabGridDragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      drag.moved = true;
    }
    function onUp(e: MouseEvent) {
      const drag = beatLabGridDragRef.current;
      if (!drag) return;
      if (drag.moved) {
        const el = drumScrollRef.current;
        const contentEl = drumGridContentRef.current;
        if (el && contentEl) {
          const cell = beatLabDrumCellFromPointer(e.clientX, e.clientY, el, {
            colWidth: drumGridColW,
            headerH: DRUM_GRID_SCROLL_HEADER_H,
            rowH: DRUM_GRID_ROW_H,
            laneCount: PAD_NAMES.length,
            patternCols: patternColsDrums,
            colOffset: drumColOffset,
            contentEl,
          });
          if (
            cell &&
            (cell.pad !== drag.fromLane || cell.patternCol !== drag.fromCol)
          ) {
            moveBeatLabMidiRollNoteRef.current(
              drag.fromLane,
              drag.fromCol,
              cell.pad,
              cell.patternCol,
            );
          }
        }
        beatLabGridJustDraggedRef.current = true;
      }
      beatLabGridDragRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [beatLabEditTool, drumColOffset, drumGridColW, patternColsDrums]);

  const drumGridW = patternColsDrums * drumGridColW;
  const drumGridContentW = drumGridW;
  const drumLoopEndBar = loopStartBar + loopBars - 1;
  const drumVisLoopStart = Math.max(1, loopStartBar);
  const drumVisLoopEnd = Math.min(TOTAL_BARS, drumLoopEndBar);
  const drumLoopRegionOk = loopEnabled && drumVisLoopEnd >= drumVisLoopStart;
  const drumColsPerBar = Math.max(1, beatLabQpb * subdivHud);
  const drumLoopLeftPx = (drumVisLoopStart - 1) * drumColsPerBar * drumGridColW;
  const drumLoopWidthPx =
    (drumVisLoopEnd - drumVisLoopStart + 1) * drumColsPerBar * drumGridColW;
  const totalW   = TOTAL_COLS * pianoGridColW;
  const pianoLoopEndBar = loopStartBar + loopBars - 1;
  const pianoVisLoopStart = Math.max(1, loopStartBar);
  const pianoVisLoopEnd = Math.min(TOTAL_BARS, pianoLoopEndBar);
  const pianoLoopRegionOk = loopEnabled && pianoVisLoopEnd >= pianoVisLoopStart;
  const pianoLoopLeftPx = (pianoVisLoopStart - 1) * MEASURES_PER_BAR * pianoGridColW;
  const pianoLoopWidthPx = (pianoVisLoopEnd - pianoVisLoopStart + 1) * MEASURES_PER_BAR * pianoGridColW;
  const pianoRollLoopGridH =
    (pianoMode === 'notes' ? displayNotes.length : 1) * (pianoMode === 'drums' ? DRUM_GRID_ROW_H : ROW_H);
  const activeDrumPadIndex = selectedDrumPad ?? 0;
  /** Sourced from transport HUD via {@link publishCreationRulerBeat} ? integer change only. */
  const rulerCreationBeatHighlight = creationRulerBeatHighlight;

  const persistCreationToStorage = useCallback(() => {
    try {
      localStorage.setItem('creationStation_banks', JSON.stringify(banks));
      localStorage.setItem(
        PIANO_SNAP_SUBDIV_STORAGE_KEY,
        String(normalizePianoSnapSubdiv(pianoSnapSubdiv)),
      );
    } catch {
      /* ignore */
    }
  }, [banks, pianoSnapSubdiv]);

  const beatLabDeckTransportClocks = (
    <CreationSe2TransportClockChips registry={creationSe2ReadoutRegistry} />
  );

  const beatLabPatternBankRow = (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 10,
        flexWrap: 'wrap',
        padding: '4px 2px 0',
        position: 'relative',
        zIndex: 50,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          flex: '2 1 380px',
          minWidth: 320,
          padding: '4px 8px 5px',
          borderRadius: 10,
          border: '1px solid rgba(124, 244, 198, 0.22)',
          background: 'linear-gradient(165deg, rgba(11, 11, 16, 0.55) 0%, rgba(8, 8, 12, 0.95) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#7cf4c6', fontWeight: 800, letterSpacing: 0.8 }}>
            <span>
              PATTERN BANK
              <span style={{ marginLeft: 6, fontSize: 8, fontWeight: 700, color: '#9a9aa8', letterSpacing: 0.4 }}>
                {patternSlot === 'B' ? '· Afro / Reggae / House' : '· Trap / R&B / Up Tempo…'}
              </span>
            </span>
            <BeatLabHelpTip tab="pattern-bank" title="How to use Pattern Bank" />
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {patternBankHint ? (
              <span style={{ fontSize: 9, color: '#7cf4c6', fontWeight: 700 }}>{patternBankHint}</span>
            ) : null}
            <BeatLabSavedPatternsButton
              disabled={CREATION_BACKEND_BLANK}
              savedPatterns={savedPatterns.map((p) => ({
                id: p.id,
                name: p.name,
                hasKit: !!(p.kit?.pads && Object.keys(p.kit.pads).length > 0),
              }))}
              draftName={loadedPatternBankPick?.presetName ?? kit}
              savePatternStatus={savePatternStatus}
              onSavePattern={handleSaveBeatLabPattern}
              onLoadPattern={(id) => {
                void applySavedBeatLabPattern(id);
              }}
              onRenameSavedPattern={handleRenameSavedBeatLabPattern}
              onDeleteSavedPattern={handleDeleteSavedBeatLabPattern}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              {(['A', 'B'] as const).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  disabled={CREATION_BACKEND_BLANK}
                  onClick={() => setPatternSlot(slot)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 3,
                    border: `1px solid ${patternSlot === slot ? '#7cf4c6' : 'rgba(255,255,255,0.14)'}`,
                    background: patternSlot === slot ? 'rgba(124, 244, 198, 0.12)' : 'rgba(255,255,255,0.04)',
                    color: patternSlot === slot ? '#7cf4c6' : '#9a9aa8',
                    fontSize: 8,
                    fontWeight: 900,
                    cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                    opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
                  }}
                >
                  {slot}
                </button>
              ))}
              <button
                type="button"
                disabled={CREATION_BACKEND_BLANK}
                onClick={copyPatternAToB}
                title="Copy pattern A into slot B"
                style={{
                  padding: '3px 6px',
                  borderRadius: 3,
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#9a9aa8',
                  fontSize: 7,
                  fontWeight: 800,
                  cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                  opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
                }}
              >
                A→B
              </button>
            </div>
          </div>
        </div>
        <PatternBankPanel
          onLoadPreset={applyPatternBankPreset}
          disabled={CREATION_BACKEND_BLANK}
          patternSlot={patternSlot}
          loadedBankId={loadedPatternBankPick?.bankId ?? null}
          loadedPresetId={loadedPatternBankPick?.presetId ?? null}
          savedPatterns={savedPatterns.map((p) => ({
            id: p.id,
            name: p.name,
            hasKit: !!(p.kit?.pads && Object.keys(p.kit.pads).length > 0),
          }))}
          openUserSavesOnMount={patternBankOpenUserSaves}
          onLoadSavedPattern={(id) => {
            void applySavedBeatLabPattern(id);
            setLoadedPatternBankPick({
              bankId: BEAT_LAB_USER_SAVES_BANK_ID,
              presetId: id,
              presetName: findBeatLabSavedPattern(savedPatterns, id)?.name ?? 'My pattern',
            });
          }}
          onRenameSavedPattern={handleRenameSavedBeatLabPattern}
          onDeleteSavedPattern={handleDeleteSavedBeatLabPattern}
        />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          flex: '2.25 1 320px',
          minWidth: 260,
          minHeight: 0,
          padding: '3px 8px 4px',
          borderRadius: 10,
          border: '1px solid rgba(52, 211, 153, 0.18)',
          background: 'linear-gradient(165deg, rgba(6, 40, 32, 0.35) 0%, rgba(8, 8, 10, 0.95) 100%)',
          overflow: 'visible',
          position: 'relative',
          zIndex: 50,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#7cf4c6', fontWeight: 800, letterSpacing: 0.65 }}>
            SOUND FAMILIES
            <BeatLabHelpTip tab="sound-families" title="How to use Sound Families" />
          </span>
          <span style={{ fontSize: 8, color: '#6a6a78', fontFamily: 'monospace', fontWeight: 700 }}>
            Bank {BANKS[activeBank] ?? '?'}
          </span>
        </div>
        <SoundFamiliesBar
          targetPad={geniusSamplerTargetPad}
          onTargetPadChange={setGeniusSamplerTargetPad}
          onLoadSample={(args) => {
            void loadSoundFamilySample(args);
          }}
          onPreviewSample={(args) => {
            void previewSoundFamilySample(args);
          }}
        />
      </div>
    </div>
  );

  return (
    <BeatLabHelpProvider autoIntro={tab === 'grid' && isScreenActive && creationSubScreen === 'beat-lab'}>
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#060607', color: '#c8c8d0', overflow: 'hidden', position: 'relative' }}>
      <style>{`
        .cs-pad-hit { transition: filter 0.14s ease-out; }
        .cs-pad-hit:active,
        .cs-pad-hit:has(*:active) {
          filter: brightness(1.7) saturate(0.95);
        }
        .cs-beat-lab-studio-pad.cs-pad-hit:active,
        .cs-beat-lab-studio-pad.cs-pad-hit:has(*:active) {
          filter: none;
        }
        .cs-beat-lab-studio-lane.cs-pad-hit:active,
        .cs-beat-lab-studio-lane.cs-pad-hit:has(*:active) {
          filter: none;
        }
        .cs-beat-lab-studio-pad,
        .cs-beat-lab-studio-lane {
          transition: box-shadow 0.07s ease-out, border-color 0.07s ease-out, background 0.07s ease-out;
        }
        .cs-beat-lab-studio-pad:active:not(:has(button:active)),
        .cs-beat-lab-studio-lane:active {
          border-color: rgba(58, 62, 74, 0.82) !important;
          background: #0c0e14 !important;
          box-shadow:
            inset 0 3px 9px rgba(0,0,0,0.68),
            inset 0 0 0 1px rgba(72, 78, 92, 0.32) !important;
        }
        .cs-pad-clear-btn {
          position: absolute !important;
          z-index: 10 !important;
          pointer-events: auto;
        }
        .cs-beat-lab-studio-pad .cs-beat-lab-studio-pad-face::before,
        .cs-beat-lab-studio-pad-face::before,
        .cs-beat-lab-studio-pad .cs-beat-lab-studio-pad-face::after,
        .cs-beat-lab-studio-lane .cs-beat-lab-studio-pad-face::after {
          content: none;
        }
        .cs-beat-lab-studio-pad-face > *:not(.cs-pad-clear-btn) {
          position: relative;
          z-index: 3;
        }
        .cs-beat-lab-studio-pad:active:not(:has(button:active)) .cs-beat-lab-studio-pad-face,
        .cs-beat-lab-studio-lane:active .cs-beat-lab-studio-pad-face {
          transform: translateY(1px) scale(0.992);
          filter: none;
          border-color: var(--beat-lab-pad-accent, #86efac) !important;
          box-shadow:
            inset 0 0 0 0.5px var(--beat-lab-pad-accent, #86efac),
            inset 0 0 10px color-mix(in srgb, var(--beat-lab-pad-accent, #86efac) 58%, transparent),
            inset 0 0 16px color-mix(in srgb, var(--beat-lab-pad-accent, #86efac) 32%, transparent) !important;
        }
        .cs-beat-lab-studio-pad-face {
          transition: transform 0.08s ease-out, filter 0.08s ease-out, box-shadow 0.08s ease-out;
          isolation: isolate;
        }
        .cs-beat-lab-studio-deck {
          background-blend-mode: overlay, soft-light, overlay, soft-light, multiply, multiply, soft-light, multiply, normal;
        }
        .cs-beat-lab-studio-deck::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-radius: inherit;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.035) 12%, transparent 36%),
            linear-gradient(125deg, transparent 36%, rgba(255,255,255,0.045) 50%, transparent 64%),
            radial-gradient(circle at 11% 38%, rgba(0,0,0,0.62) 0%, rgba(48,52,60,0.05) 23%, transparent 50%),
            radial-gradient(circle at 86% 16%, rgba(0,0,0,0.58) 0%, rgba(44,48,56,0.04) 21%, transparent 48%),
            radial-gradient(circle at 50% 84%, rgba(0,0,0,0.68) 0%, rgba(40,44,52,0.05) 24%, transparent 54%),
            radial-gradient(ellipse 102% 52% at 50% 2%, rgba(255,255,255,0.04) 0%, transparent 50%),
            linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.28) 100%);
          opacity: 1;
          z-index: 0;
        }
        .cs-beat-lab-studio-deck::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-radius: inherit;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 18%),
            linear-gradient(0deg, transparent 47%, rgba(0,0,0,0.32) 49.8%, rgba(255,255,255,0.02) 50%, rgba(0,0,0,0.32) 50.2%, transparent 53%);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.04),
            inset 0 0 96px rgba(0,0,0,0.82),
            inset 0 2px 0 rgba(255,255,255,0.06),
            inset 0 24px 56px rgba(0,0,0,0.35);
          z-index: 0;
        }
        .cs-beat-lab-studio-deck-title::after {
          content: '';
          display: block;
          height: 1px;
          margin: 5px auto 0;
          width: min(248px, 74%);
          background: linear-gradient(90deg, transparent, rgba(70,75,85,0.32), transparent);
          opacity: 0.65;
        }
        .cs-beat-lab-studio-deck > * {
          position: relative;
          z-index: 1;
        }
        .cs-beat-lab-studio-pad-face .cs-pad-face-name,
        .cs-beat-lab-studio-pad-face .cs-pad-face-num,
        .cs-beat-lab-studio-pad-face .cs-pad-micro-label {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .beat-lab-pad-pop {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          font-size: 10px;
          color: #8f949e;
        }
      `}</style>

      <div
        style={{
          flexShrink: 0,
          width: '100%',
          padding: '3px 10px',
          borderBottom: '1px solid rgba(124, 244, 198, 0.12)',
          background: 'linear-gradient(180deg, #0a0a0e 0%, #070709 100%)',
          boxSizing: 'border-box',
        }}
      >
        <CreationSessionLinkStrip
          sessionBpm={bpm}
          linkState={sessionLink}
          onToggleBpmLink={toggleSessionBpmLink}
          onTogglePlayLink={toggleSessionPlayLink}
          grooveBeatlabMirror={grooveBeatlabMirror}
          onToggleGrooveBeatlabMirror={toggleGrooveBeatlabMirror}
          showGrooveBeatlabMirror={tab === 'groove-lab'}
          disabled={CREATION_BACKEND_BLANK}
        />
      </div>

      {tab === 'grid' && (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '4px 10px 6px',
          background: 'linear-gradient(180deg, #1c1c24 0%, #1a1a20 100%)',
          borderBottom: '1px solid #141418',
          flexShrink: 0,
          gap: 6,
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        }}
      >
        {/* ?? Top: Genius-style beat lab deck (transport + status) ? Beat Lab only; other tabs ship their own transport. ?? */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            gap: 8,
            flexWrap: 'nowrap',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap', flexShrink: 0 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 1,
              padding: '1px 10px 1px 2px',
              borderRight: '1px solid rgba(124, 244, 198, 0.35)',
              minWidth: 0,
            }}
            title="Elapsed musical time from playhead (m:ss)."
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#e8e8f0', lineHeight: 1.1 }}>Creation</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: '#f0d060',
                  fontFamily: 'monospace',
                  lineHeight: 1,
                  letterSpacing: 0.5,
                }}
              >
                <CreationGeniusElapsedDisplay
                  displayBeatRef={displayBeatRef}
                  bpmRef={bpmRef}
                  isPlaybackOrRecord={isPlaybackOrRecord}
                />
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 6, letterSpacing: 2, color: '#7cf4c6', fontWeight: 800 }}>
                BEAT LAB
                <BeatLabHelpTip tab="transport" title="Transport & playback help" />
              </span>
              <span style={{ fontSize: 5, color: '#6a6a78', fontWeight: 800, letterSpacing: 1 }}>TIME</span>
            </div>
          </div>

          {tab !== 'groove-lab' ? (
          <button
            type="button"
            role="switch"
            aria-checked={CREATION_BACKEND_BLANK ? false : metronomeEnabled}
            disabled={CREATION_BACKEND_BLANK}
            title="Metronome"
            onClick={() => {
              if (CREATION_BACKEND_BLANK) return;
              setMetronomeEnabled(!metronomeEnabled);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 36,
              minWidth: 36,
              flexShrink: 0,
              padding: '0 8px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: CREATION_BACKEND_BLANK ? '#2a2a32' : metronomeEnabled ? '#2a4a3c' : '#2a2a32',
              color: CREATION_BACKEND_BLANK ? '#5c5c68' : metronomeEnabled ? '#7cf4c6' : '#5c5c68',
              background: CREATION_BACKEND_BLANK ? 'transparent' : metronomeEnabled ? '#14221c' : 'transparent',
              fontSize: 11,
              fontWeight: 700,
              cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
              opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
            }}
          >
            Met
          </button>
          ) : (
          <button
            type="button"
            role="switch"
            aria-checked={CREATION_BACKEND_BLANK ? false : metronomeEnabled}
            disabled={CREATION_BACKEND_BLANK}
            title="Groove Lab metronome"
            onClick={() => {
              if (CREATION_BACKEND_BLANK) return;
              setMetronomeEnabled(!metronomeEnabled);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 36,
              minWidth: 36,
              flexShrink: 0,
              padding: '0 8px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: CREATION_BACKEND_BLANK ? '#2a2a32' : metronomeEnabled ? '#2a4a3c' : '#2a2a32',
              color: CREATION_BACKEND_BLANK ? '#5c5c68' : metronomeEnabled ? '#7cf4c6' : '#5c5c68',
              background: CREATION_BACKEND_BLANK ? 'transparent' : metronomeEnabled ? '#14221c' : 'transparent',
              fontSize: 11,
              fontWeight: 700,
              cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
              opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
            }}
          >
            Met
          </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, alignSelf: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, background: '#0a0a0e', border: '1px solid #2a2a32', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px' }}>
                <Zap size={11} style={{ color: '#7cf4c6' }} />
                <input
                  type="text"
                  inputMode="numeric"
                  readOnly={CREATION_BACKEND_BLANK}
                  value={bpmInput}
                  onChange={(e) => {
                    if (CREATION_BACKEND_BLANK) return;
                    setBpmInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (CREATION_BACKEND_BLANK) return;
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    } else if (e.key === 'Escape') {
                      setBpmInput(String(bpm));
                      e.currentTarget.blur();
                    }
                  }}
                  onBlur={() => {
                    if (CREATION_BACKEND_BLANK) return;
                    const v = parseInt(bpmInput.trim(), 10);
                    if (Number.isFinite(v)) {
                      const clamped = Math.max(40, Math.min(240, v));
                      setBpm(clamped);
                      setBpmInput(String(clamped));
                    } else {
                      setBpmInput(String(bpm));
                    }
                  }}
                  onFocus={(e) => e.currentTarget.select()}
                  style={{
                    width: 50,
                    background: 'transparent',
                    border: 'none',
                    color: '#7cf4c6',
                    fontSize: 13,
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    outline: 'none',
                    textAlign: 'center',
                    cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'text',
                    opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
                  }}
                  title={CREATION_BACKEND_BLANK ? 'Creation backend disabled' : 'Type tempo (40-240), press Enter'}
                />
                <span style={{ fontSize: 9, color: '#666' }}>BPM</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderLeft: '1px solid #2a2a32' }}>
                <button
                  type="button"
                  disabled={CREATION_BACKEND_BLANK}
                  onClick={() => {
                    if (CREATION_BACKEND_BLANK) return;
                    const n = Math.min(240, bpm + 1);
                    setBpm(n);
                    setBpmInput(String(n));
                  }}
                  style={{
                    flex: 1,
                    padding: '0 6px',
                    border: 'none',
                    background: '#1a1a24',
                    color: '#7cf4c6',
                    cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                    fontSize: 10,
                    fontWeight: 'bold',
                    transition: 'all 0.1s',
                    opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
                  }}
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  type="button"
                  disabled={CREATION_BACKEND_BLANK}
                  onClick={() => {
                    if (CREATION_BACKEND_BLANK) return;
                    const n = Math.max(40, bpm - 1);
                    setBpm(n);
                    setBpmInput(String(n));
                  }}
                  style={{
                    flex: 1,
                    padding: '0 6px',
                    border: 'none',
                    background: '#0a0a0e',
                    color: '#7cf4c6',
                    cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                    fontSize: 10,
                    fontWeight: 'bold',
                    transition: 'all 0.1s',
                    borderTop: '1px solid #2a2a32',
                    opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
                  }}
                >
                  <ChevronDown size={13} />
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'nowrap',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 4,
              background: '#0a0a0e',
              border: '1px solid #2a2a32',
            }}
            title="Creation Station dedicated transport controls"
          >
            <button
              type="button"
              disabled={CREATION_BACKEND_BLANK}
              onPointerDown={(e) => {
                if (CREATION_BACKEND_BLANK) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                rewindTransport();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                flexShrink: 0,
                border: '1px solid #2a2a32',
                borderRadius: 6,
                background: '#101014',
                color: '#8aa0b5',
                cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
              }}
              title="Return to start (bar 1)"
            >
              <SkipBack size={18} />
            </button>
            <button
              type="button"
              disabled={CREATION_BACKEND_BLANK}
              onPointerDown={(e) => {
                if (CREATION_BACKEND_BLANK) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                beatLabStopFromPointerRef.current = true;
                if (beatLabDeckFocusRef.current === 'synth2') {
                  stopTransport();
                } else {
                  stopTransport();
                }
              }}
              onClick={(e) => {
                e.preventDefault();
                if (CREATION_BACKEND_BLANK) return;
                if (beatLabStopFromPointerRef.current) {
                  beatLabStopFromPointerRef.current = false;
                  return;
                }
                if (beatLabDeckFocusRef.current === 'synth2') {
                  stopTransport();
                } else {
                  stopTransport();
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                flexShrink: 0,
                border: '1px solid #2a2a32',
                borderRadius: 6,
                background: '#101014',
                color: '#8aa0b5',
                cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
              }}
              title="Stop playback"
            >
              <Square size={18} />
            </button>
            <button
              type="button"
              disabled={CREATION_BACKEND_BLANK}
              onPointerDown={() => {
                if (CREATION_BACKEND_BLANK) return;
                void ensureCtx().then((ctx) => {
                  void ensureBeatLabMelodicInstrumentsReady(ctx, [
                    ...melodicInstrumentsRef.current,
                    beatLabSynth2PianoInstrumentRef.current,
                  ]);
                });
              }}
              onClick={() => {
                if (CREATION_BACKEND_BLANK) return;
                if (transportNeedsPause) {
                  void pauseTransport();
                } else {
                  void startTransport('play');
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 36,
                flexShrink: 0,
                border: 'none',
                borderRadius: 6,
                background: transportNeedsPause ? 'rgba(0, 229, 255, 0.18)' : 'linear-gradient(145deg, #1e3a5f, #122032)',
                color: transportNeedsPause ? '#5eead4' : '#cffafe',
                boxShadow: transportNeedsPause ? 'inset 0 0 0 1px rgba(94,234,212,0.35)' : '0 0 18px rgba(0,229,255,0.12)',
                cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
              }}
              title={
                transportNeedsPause
                  ? (isRecording ? 'Pause recording' : isCounting ? 'Pause count-in' : 'Pause playback')
                  : isPaused
                    ? 'Resume'
                    : 'Play'
              }
            >
              {transportNeedsPause ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button
              type="button"
              disabled={CREATION_BACKEND_BLANK}
              onClick={() => {
                if (CREATION_BACKEND_BLANK) return;
                void startTransport('record');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 38,
                height: 36,
                flexShrink: 0,
                border: `1px solid ${isRecording ? '#f8717188' : '#7f1d1d'}`,
                borderRadius: 6,
                background: isRecording
                  ? 'linear-gradient(180deg, #f87171, #dc2626)'
                  : 'linear-gradient(180deg, #2a1518, #1a0f0f)',
                color: isRecording ? '#fff' : '#fecaca',
                cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
              }}
              title={isRecording ? 'Recording' : 'Record'}
            >
              <Circle size={18} />
            </button>
          </div>

          <BeatLabMasterVolume
            value={masterOutputLinear}
            onChange={onMasterVolumeChange}
            disabled={CREATION_BACKEND_BLANK}
          />
          </div>

          <div
            className="beat-lab-toolbar-scroll"
            style={{
              flex: '1 1 0%',
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'nowrap',
              overflowX: 'scroll',
              overflowY: 'hidden',
              padding: '2px 0 8px 8px',
              borderLeft: '1px solid #2a2a32',
            }}
            title="Loop / length / click timing / zoom ? scroll horizontally if the window is narrow"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                flexShrink: 0,
                paddingLeft: 6,
                borderLeft: '1px solid #2a2a32',
              }}
              title="DrumloopAI-style step grid: 1/16, loop on, full grid fitted to screen"
            >
              <span style={{ fontSize: 8, color: '#6a6a78', fontWeight: 700 }}>DL</span>
              {(
                [
                  { variant: '8bar' as const, label: '8×16', title: 'Eight bars · 128 steps at 1/16' },
                  { variant: '16bar' as const, label: '16×16', title: 'Sixteen bars · 256 steps at 1/16' },
                  { variant: '2bar' as const, label: '2×16', title: 'Two bars · 32 steps at 1/16' },
                  {
                    variant: '1bar' as const,
                    label: '1×16',
                    title: 'One bar · 16 steps (classic drum machine)',
                  },
                ] as const
              ).map(({ variant, label, title }) => {
                const active = beatLabDrumloopPresetActive === variant;
                return (
                  <button
                    key={variant}
                    type="button"
                    aria-pressed={active}
                    title={title}
                    onClick={() => applyDrumloopGridPreset(variant)}
                    style={{
                      height: 28,
                      padding: active ? '0 8px' : '0 6px',
                      borderRadius: 4,
                      border: active
                        ? '1px solid rgba(0, 229, 255, 0.45)'
                        : '1px solid rgba(0, 229, 255, 0.28)',
                      background: active
                        ? 'rgba(0, 229, 255, 0.1)'
                        : 'rgba(0, 229, 255, 0.06)',
                      color: active ? '#00E5FF' : '#7aa2b8',
                      fontSize: 9,
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                flexShrink: 0,
                padding: '0 6px',
                borderLeft: '1px solid #2a2a32',
                borderRight: '1px solid #2a2a32',
              }}
            >
              <BeatLabEditToolToggle
                embedded
                compact
                mode={beatLabEditTool}
                onModeChange={setBeatLabEditTool}
                snapHint={snapLabelFromPianoSnapSubdiv(drumStepSubdiv)}
              />
            </div>

            <button
              type="button"
              aria-pressed={loopOn}
              title={
                loopOn
                  ? `Loop on ? ${loopBars} bar${loopBars !== 1 ? 's' : ''}`
                  : 'Loop off ? click to enable'
              }
              onClick={() => {
                setLoopOn((v) => !v);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                height: 36,
                padding: '0 8px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: loopOn ? '#2a4a3c' : '#3a3a46',
                background: loopOn ? '#14221c' : '#1c1c24',
                color: loopOn ? '#7cf4c6' : '#6a6a78',
                fontSize: 9,
                fontWeight: 800,
                fontFamily: 'monospace',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Repeat size={12} strokeWidth={2.5} />
              <span>Loop</span>
            </button>

            <button
              type="button"
              disabled={CREATION_BACKEND_BLANK || !canUndoBeatLabDup}
              title="Undo last loop duplicate (pattern + loop length)"
              onClick={() => undoBeatLabDup()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                height: 36,
                padding: '0 8px',
                borderRadius: 6,
                border: '1px solid rgba(124, 244, 198, 0.28)',
                background: 'rgba(124, 244, 198, 0.06)',
                color: '#7cf4c6',
                fontSize: 9,
                fontWeight: 800,
                fontFamily: 'monospace',
                cursor:
                  CREATION_BACKEND_BLANK || !canUndoBeatLabDup ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                opacity: CREATION_BACKEND_BLANK || !canUndoBeatLabDup ? 0.45 : 1,
              }}
            >
              <Undo2 size={12} strokeWidth={2.5} />
              <span>Undo DUP</span>
            </button>

            <button
              type="button"
              title={`Duplicate loop (${loopBars} bar${loopBars !== 1 ? 's' : ''}) — paste copy right after, double length`}
              onClick={() => duplicateBeatLabLoop()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                height: 36,
                padding: '0 8px',
                borderRadius: 6,
                border: '1px solid rgba(124, 244, 198, 0.35)',
                background: 'rgba(124, 244, 198, 0.08)',
                color: '#7cf4c6',
                fontSize: 9,
                fontWeight: 800,
                fontFamily: 'monospace',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Copy size={12} strokeWidth={2.5} />
              <span>DUP</span>
            </button>

            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                flexShrink: 0,
                minWidth: 0,
              }}
              title="Loop length (bars) — max 64; grid fills the screen"
            >
              <span style={{ fontSize: 8, color: '#6a6a78', fontWeight: 700 }}>LEN</span>
              <select
                value={loopBars}
                title="Loop length (bars) — max 64; grid width matches loop"
                onChange={(e) => {
                  const n = Math.max(
                    1,
                    Math.min(BEAT_LAB_MAX_LOOP_BARS, Number(e.target.value)),
                  );
                  if (!Number.isFinite(n)) return;
                  setLoopBars(n);
                  setLoopRangeBeats(
                    loopStartBeatRef.current,
                    loopStartBeatRef.current + n * beatsPerBarRef.current,
                  );
                }}
                style={{
                  height: 28,
                  borderRadius: 4,
                  border: '1px solid #2a2a32',
                  background: '#0a0a0e',
                  color: '#aeb7c6',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  cursor: 'pointer',
                  maxWidth: 108,
                  flexShrink: 0,
                }}
              >
                {Array.from(new Set([1, 2, 4, 8, 12, 16, 24, 32, 64, loopBars]))
                  .sort((a, b) => a - b)
                  .map((n) => (
                  <option key={n} value={n}>
                    {n} bar{n !== 1 ? 's' : ''}{n === 64 ? ' ? full' : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              title="Save banks + pad routing + snap to local storage"
              onClick={persistCreationToStorage}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                height: 36,
                flexShrink: 0,
                padding: '0 10px',
                borderRadius: 6,
                border: '1px solid #2a2a32',
                background: '#1a1a24',
                color: '#aeb7be',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Save size={14} />
              Save
            </button>

            <button
              type="button"
              title="Send session to Studio Editor 2 (pattern / MIDI handoff)"
              disabled={CREATION_BACKEND_BLANK}
              onClick={() => {
                if (CREATION_BACKEND_BLANK) return;
                onExport('studio-editor');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                height: 36,
                flexShrink: 0,
                padding: '0 10px',
                borderRadius: 6,
                border: '1px solid #00E5FF44',
                background: '#1a1a24',
                color: '#00E5FF',
                fontSize: 10,
                fontWeight: 700,
                cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
              }}
            >
              <Cable size={14} />
              MIDI
            </button>
          </div>

        </div>

        {/* Beat Lab: kit + sampler pads (GRID / ROLL). SYNTH views use the workspace below only. */}
          {beatLabDeckFocus !== 'synth' && beatLabDeckFocus !== 'synth2' ? (
          <div
            style={{
              position: 'relative',
              zIndex: 200,
              overflow: 'visible',
              flexShrink: 0,
            }}
          >
          <BeatLabDeckToolbar
            kit={kit}
            setKit={setKit}
            hasPadSample={hasPadSampleForActiveBank}
            onLoadPadSample={beginLoadPadSample}
            onClearPadSample={clearPadSample}
            onGeniusUpload={() => beginLoadPadSample(geniusSamplerTargetPad)}
            onGeniusImportFolder={beginImportPadFolder}
            onLoadBrassRoomFolder={beginImportBrassRoomFolder}
            onLoadBrassRoomFromProject={() => {
              void loadBrassRoomFromProjectFolder();
            }}
            onOpenTrapKitBrowser={beginOpenTrapKitBrowser}
            brassRoomLoading={brassRoomLoading}
            kitImportHint={kitImportHint}
            producerKitId={producerKitId}
            onProducerKitIdChange={setProducerKitId}
            onLoadProducerKit={() => {
              void applyBeatLabProducerKit();
            }}
            producerKitLoading={producerKitLoading}
            producerKitTribute={beatLabProducerKitMeta(producerKitId)?.tribute ?? null}
            loadingProducerKitId={loadingProducerKitId}
            activeBank={activeBank}
            onLoadDefaultKitToBank={(kitId, bankIndex) => {
              setActiveBank(bankIndex);
              void applyBeatLabProducerKit(kitId, { bankIndex });
            }}
            patternBankActivePick={patternBankActivePickSummary}
            onGeniusMySoundPlay={(pi) => {
              playPadSoundRef.current(pi, PAD_VEL[pi] ?? 90);
            }}
            onApplyHumMelody={(payload) => {
              const maxCols = Math.max(1, patternColsDrumsRef.current);
              const stepsPerBar = Math.max(1, drumStepSubdivRef.current);
              const next = mergeHumMelodyApplyIntoMidiRoll(currentMidiRollRef.current, payload, {
                stepsPerBar,
                beatsPerBar: 4,
                maxCols,
                replaceLane: true,
              });
              patchActiveBankMidiRollWithUndo(next);
            }}
            onStrikeDrumPad={(pi, vel01, gridCol, whenSec) => {
              void ensureCtx();
              const ctx = getOrCreateAudioContext();
              const vk = beatLabDrumPadVoiceKey(activeBank, pi);
              const voice =
                padDrumVoiceOptsRef.current[vk] ?? defaultBeatLabDrumPadVoiceOpts(pi);
              const vel =
                gridCol != null
                  ? beatLabDrumVoiceGridVelocity(voice, gridCol)
                  : beatLabDrumVoiceManualVelocity(voice, vel01);
              const offsetSec =
                gridCol != null ? beatLabDrumVoiceScheduleOffsetSec(voice, gridCol) : 0;
              const when =
                whenSec != null
                  ? whenSec + offsetSec
                  : gridCol != null
                    ? ctx.currentTime + Math.max(0.002, offsetSec)
                    : undefined;
              playPadSoundRef.current(pi, vel, when, 0, { beatPadVoice: voice });
            }}
            getDrumPadVoice={getDrumPadVoice}
            commitDrumPadVoice={commitDrumPadVoice}
            onPreviewDrumPad={previewDrumPadStrike}
            onSpreadHitToPads={(pi, direction, gridStepsPerBar) => {
              void applyBeatPadsHitSpread(pi, direction, gridStepsPerBar);
            }}
            onUndoSpreadHitToPads={() => {
              undoBeatPadsHitSpread();
            }}
            beatPadsSpreadActive={beatPadsSpreadActive}
            beatPadsSpreadDirection={beatPadsSpreadTrack?.direction ?? 'down'}
            beatPadsSpreadRootMidi={beatPadsSpreadTrack?.rootMidi ?? 60}
            beatPadsSpreadBaseLabel={beatPadsSpreadTrack?.baseLabel ?? 'Spread'}
            beatPadsSpreadNotes={beatPadsSpreadTrack?.notes ?? []}
            beatPadsSpreadLoopBars={beatPadsSpreadTrack?.loopBars ?? 8}
            beatPadsSpreadStepsPerBar={beatPadsSpreadTrack?.stepsPerBar ?? 16}
            onBeatPadsSpreadNotesChange={handleBeatPadsSpreadNotesChange}
            onBeatPadsSpreadLoopBarsChange={handleBeatPadsSpreadLoopBarsChange}
            onBeatPadsSpreadDirectionChange={handleBeatPadsSpreadDirectionChange}
            onBeatPadsSpreadMixerChannelChange={handleBeatPadsSpreadMixerChannelChange}
            onBeatPadsSpreadGridStepsPerBarChange={handleBeatPadsSpreadGridStepsPerBarChange}
            beatPadsSpreadMixerChannel={beatPadsSpreadTrack?.mixerChannel ?? 17}
            beatPadsSpreadKeyLockEnabled={beatPadsSpreadTrack?.keyLockEnabled ?? false}
            beatPadsSpreadKeyLabel={beatPadsSpreadKeyLabel}
            beatPadsSpreadHarmonyLane={beatPadsSpreadTrack?.harmonyLane ?? beatLabSynth2HarmonyLane}
            beatPadsSpreadHarmonyLaneNotes={currentMidiRoll}
            onBeatPadsSpreadKeyLockChange={handleBeatPadsSpreadKeyLockChange}
            onBeatPadsSpreadHarmonyLaneChange={handleBeatPadsSpreadHarmonyLaneChange}
            onBeatPadsSpreadRegenerateChordRoots={handleBeatPadsSpreadRegenerateChordRoots}
            onPreviewBeatPadsSpreadRow={previewBeatPadsSpreadRow}
            onStrikeBeatPadsSpreadRow={strikeBeatPadsSpreadRow}
            onCloseBeatPadsSpread={undoBeatPadsHitSpread}
            onWarmAudio={() => ensureCtx()}
            onLoadSoundFamilySample={(args) => {
              void loadSoundFamilySample(args);
            }}
            onPreviewSoundFamilySample={(args) => {
              void previewSoundFamilySample(args);
            }}
            onImportBeatPadsFromBeatLab={importBeatPadsPatternFromBeatLab}
            onExportBeatPadsToBeatLab={exportBeatPadsPatternToBeatLab}
            onExportBeatPadsToStudioEditor2={exportBeatPadsToStudioEditor2}
            onSaveBeatPadsSession={handleSaveBeatPadsSession}
            savedBeatPadsSessions={savedBeatPadsSessions.map((s) => ({
              id: s.id,
              name: s.name,
              savedAt: s.savedAt,
            }))}
            beatPadsSessionSaveStatus={beatPadsSessionSaveStatus}
            onLoadBeatPadsSession={handleLoadBeatPadsSession}
            onRenameBeatPadsSession={handleRenameBeatPadsSession}
            onDeleteBeatPadsSession={handleDeleteBeatPadsSession}
            beatPadsSessionInject={beatPadsSessionInject}
            onBeatPadsSessionInjectConsumed={consumeBeatPadsSessionInject}
            beatPadsSe2Inject={beatPadsSe2Inject}
            onBeatPadsSe2InjectConsumed={consumeBeatPadsSe2Inject}
            beatPadsMachineOpen={beatPadsMachineOpen}
            setBeatPadsMachineOpen={setBeatPadsMachineOpen}
            beatPadsPatternInject={beatPadsPatternInject}
            onBeatPadsPatternInjectConsumed={consumeBeatPadsPatternInject}
            onPatternPresetHighlighted={(preset) => syncPatternBankPickHint(preset, 'beat-pads')}
            onLoadBeatPadsPatternKit={loadBeatPadsPatternKit}
            onLoadPatternPreset={applyPatternBankPreset}
            patternSlot={patternSlot}
            onPatternSlotChange={setPatternSlot}
            loadedPatternBankId={loadedPatternBankPick?.bankId ?? null}
            loadedPatternPresetId={loadedPatternBankPick?.presetId ?? null}
            patternBankDisabled={CREATION_BACKEND_BLANK}
            onStopPadSamplePlayback={stopPadSamplePlayback}
            geniusSamplerTargetPad={geniusSamplerTargetPad}
            onGeniusSamplerTargetPadChange={setGeniusSamplerTargetPad}
            padSampleRootBpmForPad={(pi) => padSampleRootBpms[padSampleKey(activeBank, pi)]}
            onCommitPadSampleRootBpm={commitPadSampleRootBpm}
            padSampleLabelForPad={(pi) => padSampleLabels[padSampleKey(activeBank, pi)]}
            onCommitPadSampleLabel={commitPadSampleLabel}
            samplerUiBank={activeBank}
            getPadSamplerOpts={getPadSamplerPlaybackOpts}
            commitPadSamplerOpts={commitPadSamplerPlaybackOpts}
            onPreviewSamplerFx={previewSamplerFxDraft}
            getPadSamplerFxRack={getPadSamplerFxRack}
            commitPadSamplerFxRack={commitPadSamplerFxRack}
            onLivePadFxRackDraft={applyPadFxRackLive}
            onLiveSamplerDraft={applyPadSamplerOptsLive}
            onLiveDrumPadVoiceDraft={applyDrumPadVoiceLive}
            onPreviewSamplerFxRack={previewPadSamplerFxRack}
            onPreviewSamplerRootBpmDraft={previewSamplerRootBpmDraft}
            getPadSampleAudioBuffer={(pi) => padSampleBuffersRef.current.get(padSampleKey(activeBank, pi))}
            patternActionsDisabled={CREATION_BACKEND_BLANK}
            onClearGrid={clearCurrentPatternDrums}
            onClearLane={() => {
              const lane = resolveBeatLabClearLaneIndex();
              if (lane == null) return;
              clearDrumLaneRef.current(lane);
            }}
            clearLaneDisabled={resolveBeatLabClearLaneIndex() == null}
            clearLaneTitle={
              resolveBeatLabClearLaneIndex() != null
                ? (() => {
                    const li = resolveBeatLabClearLaneIndex()!;
                    return `Clear lane ${li + 1} (${beatLabLaneDisplayLabel(li, padSampleLabels[padSampleKey(activeBank, li)])})`;
                  })()
                : 'Click a lane name on the left (or a sampler pad), then Clear lane'
            }
            onDownloadHandoff={() => {
              onExport('studio-editor');
            }}
            kitSelectValue={kitSelectValue}
            onKitSelectChange={handleKitSelectChange}
            presetKitNames={KITS}
            savedKits={savedKits.map((k) => ({ id: k.id, name: k.name }))}
            onSaveKit={handleSaveBeatLabKit}
            onRenameSavedKit={handleRenameSavedBeatLabKit}
            onDeleteSavedKit={handleDeleteSavedBeatLabKit}
            saveKitStatus={saveKitStatus}
            savedSongs={savedSongs.map((s) => ({ id: s.id, name: s.name }))}
            onSaveSong={handleSaveBeatLabSong}
            onLoadSavedSong={(id) => {
              void applySavedBeatLabSong(id);
            }}
            onRenameSavedSong={handleRenameSavedBeatLabSong}
            onDeleteSavedSong={handleDeleteSavedBeatLabSong}
            saveSongStatus={saveSongStatus}
            sessionZoomTools={beatLabSessionZoomTools}
            snapTools={beatLabSnapTools}
            deckTransportClocks={beatLabDeckTransportClocks}
            beatLabMixerOpen={beatLabMixerOpen}
            onBeatLabMixerToggle={toggleBeatLabMixer}
            beatLabDeckFocus={beatLabDeckFocus}
            onBeatLabDeckFocusChange={setBeatLabDeckFocus}
            hideSamplerPads={beatLabGridFullView}
            selectedDrumPad={selectedDrumPad}
            onSelectDrumPad={setSelectedBeatLabLane}
            selectedMelodicLane={
              selectedBeatLabLane != null && selectedBeatLabLane >= BEAT_LAB_MELODIC_LANE_START
                ? selectedBeatLabLane
                : null
            }
            melodicInstruments={currentMelodicInstruments}
            melodicSynthPresetIds={currentMelodicSynthPresetIds}
            channelVolumes={channelVolumes}
            getAudioContext={getOrCreateAudioContext}
            onMelodicInstrumentChange={patchMelodicInstrument}
            onMelodicSynthPresetChange={patchMelodicSynthPreset}
            sessionBpm={bpm}
            creationBackendBlank={CREATION_BACKEND_BLANK}
          />
          </div>
          ) : null}

      </div>
      )}

      <input
        ref={padSampleFileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handlePadSampleFile}
      />
      <input
        ref={padSampleFolderInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aif,.aiff"
        multiple
        // @ts-expect-error ? non-standard directory picker (Chrome / Edge)
        webkitdirectory=""
        directory=""
        style={{ display: 'none' }}
        onChange={handlePadSampleFolder}
      />
      <input
        ref={trapKitFolderInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aif,.aiff"
        multiple
        // @ts-expect-error ? kit browser folder pick
        webkitdirectory=""
        directory=""
        style={{ display: 'none' }}
        onChange={handleTrapKitFolder}
      />
      <TrapKitBrowserPanel
        open={trapKitBrowserOpen}
        files={trapKitBrowserFiles}
        bankLabel={BANKS[BRASS_ROOM_BANK_INDEX] ?? 'B'}
        targetPad={geniusSamplerTargetPad}
        onTargetPadChange={setGeniusSamplerTargetPad}
        onClose={() => setTrapKitBrowserOpen(false)}
        onLoadSample={(file, pad, label) => {
          void loadTrapKitSampleToPad(file, pad, label);
        }}
        onPreviewSample={(file) => {
          const title = file.name.replace(/\.[^/.]+$/i, '');
          void loadTrapKitSampleToPad(file, geniusSamplerTargetPad, trapKitInstrumentLabel(geniusSamplerTargetPad, title));
        }}
      />
      {beatLabMixerOverlayNode}

      {/* Creation sub-tools live in the module sidebar under Creation Station. */}
      {/* Full-height shell for tab bodies (Beat Lab, Piano, overlays).
          Ensures a flex:1 region below the tab bar when Chord Builder is
          unmounted (returns null) so module tabs still get real height. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
      {/* ?? MORE (placeholder ? former Drums tab; primary workflow is Beat Lab) ?? */}
      {tab === 'drums' && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            background: '#18181e',
            color: '#8a8a9a',
            textAlign: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 800, color: '#7cf4c6', letterSpacing: 2 }}>MORE</span>
          <span style={{ fontSize: 12, maxWidth: 420, lineHeight: 1.6 }}>
            This area is reserved for a future module. Drum programming, kit, and sampler live under{' '}
            <strong style={{ color: '#7cf4c6' }}>Beat Lab</strong>.
          </span>
          <button
            type="button"
            onClick={() => goToCreationSub('beat-lab')}
            style={{
              marginTop: 8,
              padding: '8px 20px',
              borderRadius: 8,
              border: '1px solid rgba(124, 244, 198, 0.45)',
              background: 'rgba(124, 244, 198, 0.12)',
              color: '#7cf4c6',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Open Beat Lab
          </button>
        </div>
      )}

      {/* ?? Chord Builder (SongEngine-style chord-pad rail + bar timeline) ?? */}
      <ChordBuilderTab
        active={tab === 'chord'}
        bpm={bpm}
        syncToProject={sessionLink.bpmLinked['chord-builder']}
        onSyncToProjectChange={setChordBuilderSessionBpmLinked}
        sessionPlayLinked={sessionLink.playLinked['chord-builder']}
        colsPerBar={MEASURES_PER_BAR}
        getAudioContext={() => {
          try {
            return getOrCreateAudioContext();
          } catch {
            return null;
          }
        }}
        onClose={() => goToCreationSub('beat-lab')}
        onExportToPad={onPadBounceExport}
        onSendMidiToBeatLabSynth={onSendChordMidiToBeatLabSynth}
        onOpen808Lab={() => goToCreationSub('808-lab')}
      />

      {(tab === 'groove-lab' ||
        tab === '808-lab' ||
        (sessionLink.playLinked['groove-lab'] &&
          (tab === 'grid' || tab === 'drums' || tab === 'piano'))) && (
        <div
          style={{
            flex: tab === 'groove-lab' ? 1 : undefined,
            minHeight: tab === 'groove-lab' ? 0 : undefined,
            height: tab === 'groove-lab' ? undefined : 0,
            overflow: 'hidden',
            background: '#030303',
            display: tab === 'groove-lab' ? 'flex' : 'none',
            flexDirection: 'column',
            pointerEvents: tab === 'groove-lab' ? 'auto' : 'none',
          }}
          aria-hidden={tab !== 'groove-lab'}
        >
          <GrooveLabScreen
            embedded
            isScreenActive={tab === 'groove-lab'}
            companion808Lab={tab === '808-lab'}
            bpm={sessionLink.bpmLinked['groove-lab'] ? bpm : undefined}
            sessionBpmLinked={sessionLink.bpmLinked['groove-lab']}
            sessionPlayLinked={sessionLink.playLinked['groove-lab']}
            session808PlayLinked={sessionLink.playLinked['808-lab']}
            metronomeEnabled={metronomeEnabled}
            onMetronomeEnabledChange={setMetronomeEnabled}
            channelVolumes={channelVolumes}
            setChannelVolume={setChannelVolume}
            onBpmChange={
              sessionLink.bpmLinked['groove-lab'] ? pushSessionBpmFromLinkedModule : undefined
            }
            getAudioContext={getOrCreateAudioContext}
            onExportChordWavToPad={onPadBounceExport}
            onSendChordsToNewSynth={onSendGrooveChordsToNewSynth}
          />
        </div>
      )}

      {/* ?? Chord Sequencer (full tab body) ?? */}
      {tab === 'chord-seq' && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            background: '#030303',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <ChordSequencerScreen
            embedded
            isScreenActive={tab === 'chord-seq'}
            onBack={() => goToCreationSub('beat-lab')}
            onExportToPad={onPadBounceExport}
            onOpen808Lab={() => goToCreationSub('808-lab')}
            bpm={bpm}
            getAudioContext={getOrCreateAudioContext}
          />
        </div>
      )}

      {(tab === '808-lab' || sessionLink.playLinked['808-lab'] || groove808PlayLinked) && (
        <div
          style={{
            flex: tab === '808-lab' ? 1 : undefined,
            minHeight: tab === '808-lab' ? 0 : undefined,
            height: tab === '808-lab' ? undefined : 0,
            overflow: 'hidden',
            background: '#16161c',
            display: tab === '808-lab' ? 'flex' : 'none',
            flexDirection: 'column',
          }}
        >
          <EightZeroEightTab
            embedded
            isScreenActive={tab === '808-lab'}
            onBack={() => goToCreationSub('beat-lab')}
            getAudioContext={getOrCreateAudioContext}
            fallbackBpm={bpm}
            sessionBpmLinked={sessionLink.bpmLinked['808-lab']}
            sessionPlayLinked={sessionLink.playLinked['808-lab']}
            followGrooveLabSession={
              sessionLink.playLinked['groove-lab'] && sessionLink.playLinked['808-lab']
            }
            masterGrooveBpm={tab === 'groove-lab' ? bpm : undefined}
            onExportToPad={onPadBounceExport}
          />
        </div>
      )}

      {/* ?? Beat Lab workspace ? step grid fills center (same slot as ROLL piano roll) ?? */}
      {tab === 'grid' && (
        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
            background: '#2a2a2a',
          }}
        >
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              rowGap: 6,
              padding: '5px 10px',
              borderBottom: '1px solid rgba(124, 244, 198, 0.12)',
              background: 'rgba(0,0,0,0.35)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 900, color: '#7cf4c6', letterSpacing: 1 }}>
              VIEW
              <BeatLabHelpTip tab="grid" title="Step grid & sequencer help" />
            </span>
            <BeatLabDeckFocusChip
              active={beatLabDeckFocus === 'sequence'}
              label="GRID"
              title="Center the step sequencer in the workspace"
              onClick={() => setBeatLabDeckFocus('sequence')}
            />
            <BeatLabDeckFocusChip
              active={beatLabDeckFocus === 'synth2'}
              label="NEW SYNTH"
              title="New scratch-built synth workspace (separate from current synth)"
              onClick={() => setBeatLabDeckFocus('synth2')}
            />
            <BeatLabDeckFocusChip
              active={beatLabDeckFocus === 'roll'}
              label="ROLL"
              title="32-channel piano roll ? edit all lanes"
              onClick={() => setBeatLabDeckFocus('roll')}
            />
            <BeatLabDeckFocusChip
              active={beatLabDeckFocus === 'synth'}
              label="SYNTH"
              title="MIDI synth channels 17?32 ? piano keyboard + pitch roll"
              onClick={() => setBeatLabDeckFocus('synth')}
            />
            {beatLabDeckFocus === 'sequence' ? (
              <BeatLabGridLayoutToggle
                mode={beatLabGridLayoutMode}
                onDefault={applyBeatLabGridLayoutDefault}
                onFull={applyBeatLabGridLayoutFull}
              />
            ) : null}
            <BeatLabEditToolToggle
              mode={beatLabEditTool}
              onModeChange={setBeatLabEditTool}
              timeStretch={beatLabTimeStretch}
              onTimeStretchChange={setBeatLabTimeStretch}
              snapHint={snapLabelFromPianoSnapSubdiv(
                beatLabDeckFocus === 'roll' ||
                  beatLabDeckFocus === 'synth' ||
                  beatLabDeckFocus === 'synth2'
                  ? pianoSnapSubdiv
                  : drumStepSubdiv,
              )}
            />
            <BeatLabHistoryControls
              canUndo={canBeatLabUndo}
              canRedo={canBeatLabRedo}
              onUndo={beatLabUndo}
              onRedo={beatLabRedo}
              onResetVol={resetBeatLabVolAutomation}
              onResetPitch={resetBeatLabPitchAutomation}
              disabled={CREATION_BACKEND_BLANK}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginLeft: 4,
                paddingLeft: 8,
                borderLeft: '1px solid rgba(124, 244, 198, 0.18)',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 8, fontWeight: 800, color: '#5c5c68', letterSpacing: 0.6 }}>BANK</span>
              <BankButtons activeBank={activeBank} setActiveBank={setActiveBank} hasDrums={hasDrums} hasNotes={hasNotes} />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginLeft: 4,
                paddingLeft: 8,
                borderLeft: '1px solid rgba(124, 244, 198, 0.18)',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setFollow((p) => {
                    const next = !p;
                    if (next) beatLabFollowScrollPausedRef.current = false;
                    return next;
                  });
                }}
                title="Follow playhead while playing (FL/Cubase-style — grid scrolls under the line; drag scrollbar to pause follow until Play)"
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  color: follow ? '#5eeadb' : '#8a8a98',
                  background: follow ? 'rgba(0, 229, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${follow ? 'rgba(0, 229, 255, 0.42)' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: 4,
                  padding: '3px 7px',
                  cursor: 'pointer',
                }}
              >
                FOLLOW
              </button>
            </div>
            {beatLabPianoRollExpanded ? (
              <button
                type="button"
                disabled={CREATION_BACKEND_BLANK}
                onClick={() => {
                  if (CREATION_BACKEND_BLANK) return;
                  clearBeatLabMidiRoll();
                }}
                title="Clear all notes in this bank's piano roll"
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: '#7cf4c6',
                  background: 'rgba(124, 244, 198, 0.10)',
                  border: '1px solid rgba(124, 244, 198, 0.30)',
                  borderRadius: 4,
                  padding: '3px 8px',
                  cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                  opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
                }}
              >
                CLEAR
              </button>
            ) : null}
            {beatLabGridFullView || beatLabDeckFocus === 'synth' || beatLabDeckFocus === 'synth2' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={CREATION_BACKEND_BLANK}
                  onClick={() => {
                    if (CREATION_BACKEND_BLANK) return;
                    setBeatLabMixerOpen((v) => !v);
                  }}
                  title="32-channel Beat Lab mixer · CH 1–16 pads · CH 17–32 synth"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    height: 28,
                    padding: '0 10px',
                    borderRadius: 4,
                    border: `1px solid ${beatLabMixerOpen ? 'rgba(0, 229, 255, 0.65)' : 'rgba(0, 229, 255, 0.35)'}`,
                    background: beatLabMixerOpen ? 'rgba(0, 229, 255, 0.16)' : 'rgba(11, 11, 16, 0.65)',
                    color: '#00E5FF',
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                    opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
                    flexShrink: 0,
                  }}
                >
                  <SlidersHorizontal size={13} aria-hidden />
                  Mixer
                </button>
                {beatLabSessionZoomTools}
                {beatLabDeckTransportClocks}
              </div>
            ) : null}
            {beatLabDeckFocus === 'roll' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={CREATION_BACKEND_BLANK}
                  onClick={() => setBeatLabMixerOpen((v) => !v)}
                  title="Beat Lab mixer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    height: 28,
                    padding: '0 10px',
                    borderRadius: 4,
                    border: `1px solid ${beatLabMixerOpen ? 'rgba(0, 229, 255, 0.65)' : 'rgba(0, 229, 255, 0.35)'}`,
                    background: beatLabMixerOpen ? 'rgba(0, 229, 255, 0.16)' : 'rgba(11, 11, 16, 0.65)',
                    color: '#00E5FF',
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                    opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
                  }}
                >
                  <SlidersHorizontal size={13} aria-hidden />
                  Mixer
                </button>
              </div>
            ) : null}
          </div>
          {beatLabDeckFocus === 'roll' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: '1 1 auto',
                minHeight: 0,
                overflow: 'hidden',
                flexShrink: 1,
              }}
            >
              <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {beatLabPianoRollPanel}
              </div>
            </div>
          )}
          {beatLabDeckFocus === 'synth' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: '1 1 auto',
                minHeight: 0,
                overflow: 'hidden',
                flexShrink: 1,
              }}
            >
              <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {beatLabSynthPanel}
              </div>
            </div>
          )}
          {beatLabDeckFocus === 'synth2' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: '1 1 auto',
                minHeight: 0,
                overflow: 'hidden',
                flexShrink: 1,
              }}
            >
              <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <BeatLabSynthV2Workspace
                  synthEditor={beatLabSynthV2Panel}
                  pianoRoll={beatLabSynthV2RollPanel}
                  rollHeaderExtra={beatLabSynthV2RollChrome}
                  isPlaying={isPlaying}
                  expandRollKey={beatLabSynth2RollExpandKey}
                  onRollOpenChange={(open) => {
                    if (!open || !runningRef.current) return;
                    launchBeatLabActivePlaylineNow(cursorBeatRef.current, true, {
                      immediateCompositorStart: true,
                    });
                  }}
                />
              </div>
            </div>
          )}
          {beatLabDeckFocus === 'sequence' && (
        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
            background: '#2a2a2a',
          }}
        >
        <div
          style={{
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
            minHeight: 0,
            ...(beatLabDeckFocus === 'sequence'
              ? {
                  alignItems: 'stretch',
                  justifyContent: 'stretch',
                  padding: beatLabGridFullView ? '2px 4px' : '4px 6px',
                  width: '100%',
                }
              : {}),
          }}
        >
          <div
            style={{
              flex: 1,
              width: beatLabDeckFocus === 'sequence' ? '100%' : undefined,
              minWidth: 0,
              maxWidth: beatLabDeckFocus === 'sequence' ? '100%' : undefined,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              background: '#070708',
              boxShadow: 'inset 0 1px 0 rgba(124, 244, 198, 0.08)',
              borderRadius: beatLabDeckFocus === 'sequence' ? 8 : undefined,
              border:
                beatLabDeckFocus === 'sequence' ? '1px solid rgba(124, 244, 198, 0.22)' : undefined,
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
          {/* Unified vertical scroll — lane pads + grid rows are one document (no separate lane scrollbar). */}
          <div
            ref={drumVerticalScrollRef}
            className="beat-lab-drum-grid-scroll"
            data-touch-scroll
            onScroll={onDrumVerticalScroll}
            onWheel={(e) => {
              if (!(e.ctrlKey || e.metaKey)) return;
              e.preventDefault();
              if (e.deltaY < 0) zoomIn();
              else if (e.deltaY > 0) zoomOut();
            }}
            style={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              background: '#2a2a2a',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                minWidth: '100%',
              }}
            >
          <div
            className="beat-lab-drum-lane-rail"
            style={{
              width: LABEL_W,
              flexShrink: 0,
              position: 'sticky',
              left: 0,
              zIndex: 26,
              alignSelf: 'flex-start',
              background: 'linear-gradient(180deg, rgba(12, 12, 18, 0.98) 0%, rgba(8, 8, 12, 0.99) 100%)',
              borderRight: '1px solid rgba(124, 244, 198, 0.18)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 24,
                height: DRUM_SEQ_MEASURES_ROW_H,
                flexShrink: 0,
                borderBottom: '1px solid #303030',
                background: '#2c2c2c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 900, color: '#7cf4c6', letterSpacing: 1.2 }}>MEASURES</span>
            </div>
            <div
              style={{
                position: 'sticky',
                top: DRUM_SEQ_MEASURES_ROW_H,
                zIndex: 23,
                height: DRUM_SEQ_QUANT_BAND_H,
                flexShrink: 0,
                borderBottom: '1px solid #303030',
                background: '#2a2a2a',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                justifyContent: 'flex-start',
              }}
            >
              <div
                style={{
                  height: DRUM_SEQ_QUANT_SUBROW_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  fontWeight: 900,
                  color: '#9ec7d4',
                  letterSpacing: 1,
                  borderBottom: '1px solid #303030',
                }}
              >
                BARS
              </div>
              <div
                style={{
                  height: DRUM_SEQ_QUANT_SUBROW_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  fontWeight: 900,
                  color: '#c8d2dd',
                  letterSpacing: 0.8,
                }}
              >
                Q {snapLabelFromPianoSnapSubdiv(drumStepSubdiv)}
              </div>
            </div>
            {PAD_NAMES.map((_, pi) => {
              const laneText = beatLabLaneDisplayLabel(
                pi,
                padSampleLabels[padSampleKey(activeBank, pi)],
              );
              const laneSelected = pi === selectedDrumPad;
              return (
              <div
                key={pi}
                style={{
                  height: DRUM_GRID_ROW_H,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'stretch',
                  padding: '0 5px',
                  textAlign: 'left',
                  borderTop: '1px solid #1c1c20',
                  borderBottom: '1px solid #2a2a32',
                  background: laneSelected ? '#12151c' : '#08090c',
                  borderLeft: `3px solid ${laneSelected ? beatLabPadColor(pi) : beatLabLaneBackdropBorder()}`,
                  borderRadius: 0,
                  overflow: 'visible',
                  boxSizing: 'border-box',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <button
                  type="button"
                  className="cs-pad-hit cs-beat-lab-studio-lane"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSelectedBeatLabLane(pi);
                  }}
                  onClick={() => auditionDrumLane(pi)}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 8,
                    border: beatLabStudioPadRingBorder(false),
                    background: beatLabStudioPadRingBg(),
                    boxShadow: beatLabStudioPadRingShadow(laneSelected, pi),
                    color: BEAT_LAB_PAD_LABEL_WHITE,
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                    padding: 2,
                    textAlign: 'center',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    justifyContent: 'stretch',
                    boxSizing: 'border-box',
                    transition: 'box-shadow 0.12s ease, filter 0.12s ease',
                    filter: laneSelected ? 'brightness(1.03)' : 'none',
                  }}
                  title={`Beat Lab lane ${pi + 1} = sampler pad ${pi + 1} ? ${laneText}`}
                >
                  <div
                    className="cs-beat-lab-studio-pad-face"
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 5px 2px 3px',
                      borderRadius: 5,
                      border: beatLabStudioPadFaceBorderCss(pi, laneSelected),
                      background: beatLabStudioPadFaceBg(pi, { selected: laneSelected, lane: true }),
                      boxShadow: beatLabStudioPadFaceShadow(pi, { selected: laneSelected, lane: true }),
                      position: 'relative',
                      overflow: 'hidden',
                      minHeight: 0,
                      minWidth: 0,
                      ...beatLabPadFaceAccentVar(pi),
                    }}
                  >
                  <span
                    aria-hidden
                    style={{
                      flexShrink: 0,
                      width: 14,
                      fontSize: 12,
                      fontWeight: 900,
                      color: BEAT_LAB_PAD_LABEL_WHITE,
                      letterSpacing: 0.4,
                      lineHeight: 1,
                      textAlign: 'left',
                      textShadow: '0 1px 2px rgba(0,0,0,0.75)',
                    }}
                  >
                    {pi + 1}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 10,
                      fontWeight: 800,
                      lineHeight: 1.15,
                      color: BEAT_LAB_PAD_LABEL_WHITE,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      wordBreak: 'break-word',
                      textAlign: 'left',
                      textShadow: '0 1px 2px rgba(0,0,0,0.75)',
                    }}
                  >
                    {laneText}
                  </span>
                  </div>
                </button>
              </div>
            );
            })}
          </div>

          {/* Grid — horizontal scroll only; vertical scroll is on the unified parent above */}
          <div
            ref={drumScrollRef}
            className="beat-lab-drum-grid-h-scroll"
            onScroll={onDrumGridHScroll}
            style={{
              flex: 1,
              overflowX: 'auto',
              overflowY: 'visible',
              background: '#2a2a2a',
              minWidth: 0,
              isolation: 'isolate',
            }}
          >
            <div
              ref={drumGridContentRef}
              data-touch-draw
            style={{ width: drumGridContentW, minWidth: drumGridContentW, position: 'relative' }}
          >
            <BeatLabSnapGridOverlay
              colWidthPx={drumGridColW}
              qpb={beatLabQpb}
              subdiv={subdivHud}
              bankColOffset={drumColOffset}
              style={{
                top: 0,
                width: drumGridW,
                height: DRUM_SEQ_HEADER_H + PAD_NAMES.length * DRUM_GRID_ROW_H,
                zIndex: 0,
              }}
            />
              <div
                ref={drumPlaylineRef}
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: CREATION_SE2_PLAYHEAD_GRIP_W_PX,
                  height: DRUM_SEQ_HEADER_H + PAD_NAMES.length * DRUM_GRID_ROW_H,
                  background: 'transparent',
                  pointerEvents: 'none',
                  zIndex: 4,
                  opacity: transportNotStopped ? 1 : 0.42,
                }}
              >
                <CreationSe2PlayheadMark variant="timeline" height="100%" />
              </div>
              <div
                data-drum-measure-cells-row
                title="Measures 1–4 in every bar (four quarters per bar)"
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 24,
                  height: DRUM_SEQ_MEASURES_ROW_H,
                  display: 'flex',
                  alignItems: 'stretch',
                  width: drumGridW,
                  minWidth: drumGridW,
                  flexShrink: 0,
                  borderBottom: '1px solid #303030',
                  background: '#121212',
                }}
              >
                {(() => {
                  const stepsPerQuarter = beatLabGridStepsPerQuarter(
                    patternColsDrums,
                    patternColsDrumsBeats,
                  );
                  const measureQuarterCount = Math.max(
                    1,
                    Math.ceil(patternColsDrums / stepsPerQuarter),
                  );
                  const qFont = Math.max(
                    7,
                    Math.min(11, drumGridColW >= 10 ? 10 : drumGridColW >= 6 ? 9 : 8),
                  );
                  return Array.from({ length: measureQuarterCount }, (_, qi) => {
                    const patternCol = qi * stepsPerQuarter;
                    const bankCol = patternCol + drumColOffset;
                    const measureDigit = beatLabMeasureDigitForQuarterIndex(qi, beatLabQpb);
                    const cellW = stepsPerQuarter * drumGridColW;
                    return (
                      <div
                        key={`grid-measure-q-${qi}`}
                        data-drum-pattern-col={patternCol}
                        data-drum-measure-digit={measureDigit}
                        onClick={
                          CREATION_BACKEND_BLANK
                            ? undefined
                            : () => {
                                seekTransportToPatternColumn(patternCol);
                              }
                        }
                        title={
                          CREATION_BACKEND_BLANK
                            ? undefined
                            : `Measure ${measureDigit} — move playhead`
                        }
                        ref={(el) => {
                          if (quantMeasureCellElsRef.current.length !== measureQuarterCount) {
                            quantMeasureCellElsRef.current = Array.from(
                              { length: measureQuarterCount },
                              () => null,
                            );
                          }
                          quantMeasureCellElsRef.current[qi] = el;
                        }}
                        style={{
                          width: cellW,
                          flexShrink: 0,
                          height: DRUM_SEQ_MEASURES_ROW_H,
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: 'auto',
                          borderLeft: `1px solid ${creationDrumGridVerticalLineColor({
                            colWidthPx: drumGridColW,
                            bankCol,
                            qpb: beatLabQpb,
                            subdiv: subdivHud,
                            blendTo: '#121212',
                          })}`,
                          borderBottom: '1px solid #474747',
                          cursor: CREATION_BACKEND_BLANK ? undefined : 'pointer',
                          background: '#121212',
                          fontFamily: 'monospace',
                          fontSize: qFont,
                          fontWeight: 900,
                          lineHeight: 1,
                          color: '#e8b4e8',
                          textShadow: '0 0 6px rgba(232, 180, 232, 0.45)',
                          userSelect: 'none',
                        }}
                      >
                        {measureDigit}
                      </div>
                    );
                  });
                })()}
              </div>
              <div
                style={{
                  position: 'sticky',
                  top: DRUM_SEQ_MEASURES_ROW_H,
                  zIndex: 20,
                  display: 'flex',
                  height: DRUM_SEQ_QUANT_BAND_H,
                  overflow: 'visible',
                  borderBottom: '1px solid #303030',
                  background: '#0a0a0e',
                }}
              >
                <Ruler
                  activeCol={-1}
                  colWidth={drumGridColW}
                  barNumberStart={1}
                  stepsPerBar={beatLabQpb * subdivHud}
                  barStepCounts={creationDrumRulerCounts}
                  segmentHeaderLabels={creationDrumRulerHeaderLabels}
                  patternColToDawBar={drumPatternColToDawBar}
                  creationBeatHighlight={null}
                  creationBeatsPerBar={beatLabQpb}
                  creationStepSubdiv={subdivHud}
                  disablePlayheadHighlight
                  drumGridBeatBorders={{
                    bankColOffset: drumColOffset,
                    qpb: beatLabQpb,
                    subdiv: subdivHud,
                  }}
                  onSeekPatternCol={CREATION_BACKEND_BLANK ? undefined : seekTransportToPatternColumn}
                />
                <LoopMarkersBrace
                  visible={drumLoopRegionOk}
                  leftPx={drumLoopLeftPx}
                  widthPx={drumLoopWidthPx}
                  height={DRUM_SEQ_QUANT_BAND_H}
                  variant="dark"
                />
              </div>
              {PAD_NAMES.map((name, pi) => (
                <div
                  key={pi}
                  className="cs-pad-hit"
                  style={{
                    display: 'flex',
                    height: DRUM_GRID_ROW_H,
                    alignItems: 'stretch',
                    borderTop: '1px solid #1c1c20',
                    borderBottom: `1px solid rgba(42, 42, 50, ${drumGridColW < 6 ? 0.3 : drumGridColW < 10 ? 0.55 : 1})`,
                    background: pi === selectedDrumPad ? '#141820' : drumLaneBg(pi),
                    cursor: 'pointer',
                    boxShadow: pi === selectedDrumPad ? 'inset 0 0 0 1px rgba(255,255,255,0.08)' : 'none',
                    position: 'relative',
                    zIndex: 1,
                  }}
                  onClick={(e) => {
                    if (e.target !== e.currentTarget) return;
                    auditionDrumLane(pi);
                  }}
                >
                  {Array.from({ length: patternColsDrums }, (_, ci) => {
                    const bankCol = ci + drumColOffset;
                    const onDrum = currentDrums[pi]?.[bankCol] ?? false;
                    const noteHere = beatLabNoteHeadAt(pi, ci);
                    const on = onDrum || !!noteHere;
                    const isHead = false;
                    const isNoteSelected = (() => {
                      if (!beatLabRollSelection || beatLabRollSelection.lane !== pi) return false;
                      const n = beatLabNoteHeadAt(pi, beatLabRollSelection.col);
                      if (!n) return false;
                      return ci >= n.col && ci < n.col + n.len;
                    })();
                    const isNoteEnd =
                      !!noteHere && ci === noteHere.col + noteHere.len - 1;
                    const isNoteSpanHead = !!noteHere && ci === noteHere.col;
                    const isNoteSpanMid =
                      !!noteHere &&
                      ci > noteHere.col &&
                      ci < noteHere.col + noteHere.len - 1;
                    const padStepBg = drumStepBg(bankCol, pi, isHead, beatLabQpb * subdivHud);
                    const noteCellRadius =
                      isNoteSpanHead && isNoteEnd
                        ? 4
                        : isNoteSpanHead
                          ? '4px 0 0 4px'
                          : isNoteEnd
                            ? '0 4px 4px 0'
                            : isNoteSpanMid
                              ? 0
                              : 4;
                    const stepTileLook = beatLabDrumStepTileLook({
                      tileGrid: beatLabTileGridOn,
                      colWidthPx: drumGridColW,
                      rowHeightPx: DRUM_GRID_ROW_H,
                      bankCol,
                      qpb: beatLabQpb,
                      subdiv: subdivHud,
                      padStepBg,
                      on,
                      isNoteSelected,
                      isHead,
                      noteCellRadius,
                      noteLen: noteHere?.len,
                      beatLabGridStepOnFill,
                    });
                    const stepCursor = beatLabToolUsesDrumBrush(beatLabEditTool)
                      ? 'crosshair'
                      : beatLabEditTool === 'pointer' && on && isNoteEnd
                        ? 'ew-resize'
                        : beatLabEditTool === 'pointer' && noteHere && on
                          ? 'grab'
                          : 'pointer';
                    return (
                      <button
                        key={ci}
                        type="button"
                        className="touch-compact"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (CREATION_BACKEND_BLANK) return;
                          if ((e.target as HTMLElement).closest('[data-beat-lab-resize]')) return;
                          if (e.ctrlKey || e.metaKey) {
                            seekTransportToPatternColumn(ci);
                            return;
                          }
                          beatLabGridFocusRef.current = { lane: pi, col: ci };
                          if (beatLabToolUsesDrumBrush(beatLabEditTool)) {
                            beginDrumPaint(e.clientX, e.clientY, e.shiftKey);
                            return;
                          }
                          if (beatLabEditTool === 'pointer' && on && noteHere) {
                            beatLabGridFocusRef.current = {
                              lane: noteHere.lane,
                              col: noteHere.col,
                            };
                            setBeatLabRollSelection({
                              lane: noteHere.lane,
                              col: noteHere.col,
                            });
                            const rect = e.currentTarget.getBoundingClientRect();
                            const resizeZone = Math.max(
                              14,
                              Math.min(Math.floor(drumGridColW * 0.48), drumGridColW - 1),
                            );
                            if (
                              isNoteEnd &&
                              e.clientX > rect.right - resizeZone
                            ) {
                              beginGridNoteResize(e, noteHere.lane, noteHere.col, noteHere);
                              return;
                            }
                            beatLabGridDragRef.current = {
                              fromLane: noteHere.lane,
                              fromCol: noteHere.col,
                              startX: e.clientX,
                              startY: e.clientY,
                              moved: false,
                            };
                          }
                        }}
                        onMouseEnter={(e) => {
                          if (CREATION_BACKEND_BLANK || !beatLabToolUsesDrumBrush(beatLabEditTool)) return;
                          if (!drumPaintRef.current?.active) return;
                          paintDrumAtClient(e.clientX, e.clientY, drumPaintRef.current.on);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (beatLabGridJustDraggedRef.current) {
                            beatLabGridJustDraggedRef.current = false;
                            return;
                          }
                          if (!CREATION_BACKEND_BLANK && (e.ctrlKey || e.metaKey)) {
                            seekTransportToPatternColumn(ci);
                            return;
                          }
                          if (beatLabToolUsesDrumBrush(beatLabEditTool)) return;
                          if (beatLabEditTool === 'pointer') {
                            if (noteHere) {
                              beatLabGridFocusRef.current = {
                                lane: noteHere.lane,
                                col: noteHere.col,
                              };
                              setBeatLabRollSelection({
                                lane: noteHere.lane,
                                col: noteHere.col,
                              });
                              return;
                            }
                            placeBeatLabGridStep(pi, ci, true);
                            setBeatLabRollSelection({ lane: pi, col: ci });
                            return;
                          }
                          placeBeatLabGridStep(pi, ci, !on);
                        }}
                        style={{
                          width: drumGridColW,
                          boxSizing: 'border-box',
                          flexShrink: 0,
                          height: DRUM_GRID_ROW_H,
                          position: 'relative',
                          cursor: stepCursor,
                          ...stepTileLook.button,
                        }}
                        title={
                          CREATION_BACKEND_BLANK
                            ? undefined
                            : beatLabEditTool === 'draw'
                              ? 'Draw ? drag to paint steps ? Ctrl+click playhead'
                              : beatLabEditTool === 'erase'
                                ? 'Erase ? drag to clear steps ? Ctrl+click playhead'
                                : beatLabEditTool === 'pointer'
                                  ? 'PTR ? drag note to move ? drag right edge to resize ? Ctrl+C/V/X'
                                  : 'Ctrl+click: move playhead ? click: toggle step'
                        }
                      >
                        {stepTileLook.inner ? (
                          <span aria-hidden style={stepTileLook.inner} />
                        ) : null}
                        {on && isNoteEnd && beatLabEditTool === 'pointer' && noteHere ? (
                          <span
                            role="separator"
                            aria-label="Resize note"
                            data-beat-lab-resize="end"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onPointerDown={(e) => {
                              beginGridNoteResize(
                                e,
                                noteHere.lane,
                                noteHere.col,
                                noteHere,
                                e.currentTarget as HTMLElement,
                              );
                            }}
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              bottom: 0,
                              width: Math.max(
                                14,
                                Math.min(Math.floor(drumGridColW * 0.48), drumGridColW - 1),
                              ),
                              cursor: 'ew-resize',
                              zIndex: 2,
                              touchAction: 'none',
                              background: 'transparent',
                            }}
                            title="Drag to resize note length"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
              <LoopVerticalGuides
                visible={drumLoopRegionOk}
                leftPx={drumLoopLeftPx}
                widthPx={drumLoopWidthPx}
                height={DRUM_SEQ_HEADER_H + PAD_NAMES.length * DRUM_GRID_ROW_H}
                topPx={0}
              />
            </div>
          </div>
            </div>
          </div>
        </div>
            <div
              style={{
                flexShrink: 0,
                padding: '8px 10px 10px',
                borderTop: '1px solid rgba(124, 244, 198, 0.15)',
                background: 'linear-gradient(180deg, rgba(8, 8, 12, 0.92) 0%, rgba(5, 5, 8, 0.98) 100%)',
              }}
            >
              {beatLabPatternBankRow}
            </div>
          </div>
        </div>
        </div>
          )}
        </div>
      )}

      {/* ?? PIANO ROLL TAB ?? */}
      {tab === 'piano' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Sub-tab + instruments */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', flexShrink: 0, background: '#2c2c2c', borderBottom: '1px solid #2c2c2c' }}>
            {(['notes','drums'] as const).map(st => (
              <button key={st} onClick={() => setPianoMode(st)} style={{ padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: pianoMode===st ? '#193025' : '#1a1a24', color: pianoMode===st ? '#7cf4c6' : '#6a6a78', border: `1px solid ${pianoMode===st ? 'rgba(124,244,198,0.45)' : '#2a2a32'}`, cursor: 'pointer' }}>
                {st === 'notes' ? '?? Notes' : '?? Drums'}
              </button>
            ))}
            {pianoMode === 'notes' && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 6 }}>
                  <button
                    onClick={() => setPianoRegisterShift((v) => Math.max(-2, v - 1))}
                    style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#1a1a24', color: '#b8b8ca', border: '1px solid #2a2a32', cursor: 'pointer' }}
                  >
                    OCT-
                  </button>
                  <span style={{ fontSize: 9, color: '#888', fontFamily: 'monospace', minWidth: 44, textAlign: 'center' }}>
                    {pianoRegisterShift >= 0 ? `+${pianoRegisterShift}` : pianoRegisterShift}
                  </span>
                  <button
                    onClick={() => setPianoRegisterShift((v) => Math.min(2, v + 1))}
                    style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#1a1a24', color: '#b8b8ca', border: '1px solid #2a2a32', cursor: 'pointer' }}
                  >
                    OCT+
                  </button>
                </div>
                {INSTRUMENTS.map((ins, i) => (
                  <button key={ins} onClick={() => setRollInstr(i)} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: rollInstr===i ? '#00E5FF' : '#1a1a24', color: rollInstr===i ? '#000' : '#6a6a78', border: `1px solid ${rollInstr===i ? '#00E5FF' : '#2a2a32'}`, cursor: 'pointer' }}>
                    {ins}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Piano roll */}
          <div style={{ flex: '1 1 0%', display: 'flex', overflow: 'hidden', minHeight: 0, borderTop: '2px solid #2c2c2c' }}>
            {/* Fixed keys */}
            <div style={{ width: KEY_W, flexShrink: 0, background: '#0c141a', borderRight: '1px solid #213646', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: DRUM_SEQ_QUANT_BAND_H, flexShrink: 0, borderBottom: '1px solid #303030', background: '#2a2a2a' }} />
              <div style={{ overflowY: 'hidden', flex: 1 }}>
                {(pianoMode === 'notes' ? displayNotes : [PAD_NAMES[activeDrumPadIndex]]).map((label, ri) => {
                  const padIndex = pianoMode === 'drums' ? activeDrumPadIndex : ri;
                  if (pianoMode === 'drums') {
                    return (
                      <div
                        key={ri}
                        style={{
                          height: DRUM_GRID_ROW_H,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          paddingRight: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          color: '#aeb7be',
                          background: drumLaneBg(0),
                          borderBottom: '1px solid #1f3a4a',
                          flexShrink: 0,
                        }}
                      >
                        {label}
                      </div>
                    );
                  }
                  const isBlack = label.includes('#');
                  return (
                    <div
                      key={ri}
                      onPointerDown={() => {
                        if (pianoMode === 'notes') setPressedPianoKeyRow(ri);
                      }}
                      onPointerUp={() => setPressedPianoKeyRow((v) => (v === ri ? null : v))}
                      onPointerLeave={() => setPressedPianoKeyRow((v) => (v === ri ? null : v))}
                      onClick={() => {
                        if (pianoMode === 'notes') playPianoNote(ri, 0.35);
                      }}
                      style={{
                        height: ROW_H,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isBlack ? 'flex-end' : 'space-between',
                        paddingRight: 5,
                        paddingLeft: 6,
                        fontSize: 9,
                        fontFamily: 'monospace',
                        color: isBlack ? '#aeb7be' : '#2c3136',
                        background: isBlack
                          ? pressedPianoKeyRow === ri ? '#161b1f' : '#1f2429'
                          : pressedPianoKeyRow === ri ? '#b8c2cb' : '#d6dce1',
                        borderBottom: '1px solid #2b3c48',
                        flexShrink: 0,
                        boxShadow: isBlack
                          ? pressedPianoKeyRow === ri
                            ? 'inset 0 2px 0 #0f1316, inset 0 -1px 0 #0b0f12'
                            : 'inset 0 -1px 0 #14191d'
                          : pressedPianoKeyRow === ri
                            ? 'inset 0 2px 0 #9ea8b2, inset 0 -1px 0 #8a949e'
                            : 'inset 0 -1px 0 #bcc6ce',
                        cursor: 'pointer',
                        transform: pressedPianoKeyRow === ri ? 'translateX(2px) scaleX(0.98)' : 'translateX(0) scaleX(1)',
                        transition: 'transform 0.06s ease, background 0.06s ease, box-shadow 0.06s ease',
                      }}
                    >
                      
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Note grid */}
            <div ref={pianoScrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
              <div style={{ width: totalW, minWidth: totalW, position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  <Ruler
                    activeCol={activeCol}
                    colWidth={pianoGridColW}
                    maxBars={CREATION_PIANO_BARS}
                    stepsPerBar={pianoMode === 'drums' ? qpbHud * subdivHud : MEASURES_PER_BAR}
                    barStepCounts={PIANO_RULER_BAR_STEP_COUNTS}
                    creationBeatHighlight={rulerCreationBeatHighlight}
                    creationBeatsPerBar={pianoMode === 'drums' ? qpbHud : MEASURES_PER_BAR}
                    creationStepSubdiv={pianoMode === 'drums' ? subdivHud : 1}
                    disablePlayheadHighlight
                  />
                  <LoopMarkersBrace
                    visible={pianoLoopRegionOk}
                    leftPx={pianoLoopLeftPx}
                    widthPx={pianoLoopWidthPx}
                    height={28}
                    variant="dark"
                  />
                </div>
              <div
                ref={pianoPlaylineRef}
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 28,
                  width: CREATION_SE2_PLAYHEAD_LINE_W_PX,
                  height: pianoRollLoopGridH,
                  background: 'transparent',
                  pointerEvents: 'none',
                  zIndex: 16,
                  visibility: transportNotStopped ? 'visible' : 'hidden',
                }}
              >
                <CreationSe2PlayheadMark variant="piano" height="100%" />
              </div>
                {(pianoMode === 'notes' ? displayNotes : [PAD_NAMES[activeDrumPadIndex]]).map((note, ri) => {
                  const padIndex = pianoMode === 'drums' ? activeDrumPadIndex : ri;
                  return (
                    <div
                      key={ri}
                      style={{
                        display: 'flex',
                        height: pianoMode === 'drums' ? DRUM_GRID_ROW_H : ROW_H,
                        borderTop: '1px solid #1c1c20',
                        borderBottom: '1px solid #35566e',
                        background: pianoMode === 'drums' ? drumLaneBg(0) : pianoLaneBg(ri),
                      }}
                    >
                      {Array.from({ length: TOTAL_COLS }, (_, ci) => {
                        const on = pianoMode === 'drums'
                          ? (currentDrums[padIndex]?.[ci] ?? false)
                          : sharedNotes.some(n => n.row === ri && n.col === ci);
                        const isHead = false;
                        return (
                          <button
                            key={ci}
                            onClick={() => {
                              if (pianoMode === 'drums') {
                                toggleDrum(padIndex, ci);
                                playPadSoundRef.current(padIndex, PAD_VEL[padIndex] ?? 90);
                              } else {
                                toggleNote(ri, ci);
                                playPianoNote(ri, 0.3);
                              }
                            }}
                            style={{
                              width: pianoGridColW,
                              boxSizing: 'border-box',
                              flexShrink: 0,
                              height: pianoMode === 'drums' ? DRUM_GRID_ROW_H : ROW_H,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: pianoMode === 'drums' ? drumStepBg(ci, padIndex, isHead) : pianoStepBg(ci, ri, isHead),
                              borderLeft: `1px solid ${ci % (MEASURES_PER_BAR * 4) === 0 ? '#7ba5bf' : ci % MEASURES_PER_BAR === 0 ? '#5e88a3' : '#3f6278'}`,
                              borderTop: 'none',
                              borderRight: 'none',
                              borderBottom: '1px solid #000',
                              boxShadow: on && isHead ? '0 0 8px #b8f5c599' : 'none',
                              cursor: 'pointer',
                              transition: isHead ? 'none' : 'background 0.05s',
                              padding: 0,
                            }}
                          >
                            {on && (
                              <div
                                style={{
                                  width: Math.max(6, Math.floor(pianoGridColW * (pianoMode === 'drums' ? 0.78 : 0.72))),
                                  height: Math.floor((pianoMode === 'drums' ? DRUM_GRID_ROW_H : ROW_H) * (pianoMode === 'drums' ? 0.82 : 0.68)),
                                  borderRadius: pianoMode === 'drums' ? 1 : 2,
                                  background: '#b8f5c5',
                                  border: '1px solid #dbffe2',
                                  boxShadow: '0 0 7px #b8f5c599',
                                }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
                <LoopVerticalGuides
                  visible={pianoLoopRegionOk}
                  leftPx={pianoLoopLeftPx}
                  widthPx={pianoLoopWidthPx}
                  height={pianoRollLoopGridH}
                  topPx={28}
                  zIndex={12}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      </div>

      <DrumKitGeneratorModal
        open={drumKitGenOpen}
        onClose={() => !drumKitGenBusy && setDrumKitGenOpen(false)}
        style={drumKitGenStyle}
        onStyleChange={setDrumKitGenStyle}
        busy={drumKitGenBusy}
        onApplySinglePad={applyDrumKitGenSinglePad}
        onApplyFullKit={applyDrumKitGenFullKit}
        onApplyPattern={applyDrumKitGenPattern}
        onApplyBoth={applyDrumKitGenBoth}
      />

    </div>
    </BeatLabHelpProvider>
  );
}

export default function CreationStationScreen(props: {
  onExport: (dest: string) => void;
  onBeatPadsToStudio?: (payload: PendingBeatPadsStudioImport) => void;
  isScreenActive?: boolean;
  creationSubScreen?: CreationSubScreenId;
  onCreationSubScreenChange?: (sub: CreationSubScreenId) => void;
}) {
  useLayoutEffect(() => {
    markBeatLabBootRendered();
  }, []);

  return (
    <CreationStationErrorBoundary>
      <CreationStationScreenBody {...props} />
    </CreationStationErrorBoundary>
  );
}

