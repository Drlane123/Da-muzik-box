'use client';

/**
 * Studio Editor 2 Ã¢â‚¬â€ transport + timeline patterned on **Musio Create** (open source):
 * Ã‚Â· `DAWCore/Transport/TransportState.swift` ([3827cd5](https://github.com/mpatti/musio-create/commit/3827cd5c74213336d09435c28f04129c0d16d6db)) Ã¢â‚¬â€
 *   Audio clock Ã¢â€ â€™ `playheadBeats` (target); `CVDisplayLink` eases `smoothPlayheadBeats` for the UI. Web: target =
 *   `beatAtTime(audioNow,Ã¢â‚¬Â¦)`; **display** playhead/readouts ease toward target (`DISPLAY_PLAYHEAD_LERP`) while
 *   metronome stays on `sessionStart` grid ([musio-create](https://github.com/mpatti/musio-create.git)).
 *   Web analogue: **`AudioContext.currentTime`** is the single master clock for `beatAtTime`, `sessionStart`,
 *   and metronome `start()` times (same graph as [18d423b](https://github.com/mpatti/musio-create/commit/18d423bda51a55d428d64bd08052205c72662ea1) Ã¢â‚¬Å“sample-accurateÃ¢â‚¬Â binding). Do **not** mix in
 *   `getOutputTimestamp`-extrapolated time for beats Ã¢â‚¬â€ it desyncs scheduled clicks from the playhead.
 * Ã‚Â· `DAWCore/Audio/Metronome.swift` Ã¢â‚¬â€ click 1 kHz / 20 ms, accent 1.5 kHz / 30 ms, `exp(-t*50)` decay.
 * Ã‚Â· `DAWUI/Views/Transport/TransportView.swift` Ã¢â‚¬â€ control strip layout (RTZ, play/pause, record, BARS,
 *   TIME, BPM Ã‚Â±, SIG, loop, metronome).
 * Ã‚Â· `DAWUI/Views/Timeline/TimelineView.swift` Ã¢â‚¬â€ `clipX = beats * pixelsPerBeat`; grid + MIDI + **playhead line**
 *   share `beatColumnLeftPx` ([18d423b](https://github.com/mpatti/musio-create/commit/18d423bda51a55d428d64bd08052205c72662ea1) timing model). Centering a wide hit box on raw `beat*ppb` then
 *   clamping at x=0 shifts beat 0 visually into the first beat Ã¢â‚¬â€ avoid that.
 * Ã‚Â· `DAWUI/Views/PianoRoll/TrackPianoRollView.swift` Ã¢â‚¬â€ 60px key strip, bar ruler + grid horizontal scroll,
 *   shared vertical scroll keys+notes, velocity lane (`Vel`) synced to horizontal offset.
 * Ã‚Â· `MainWindowView.swift` Ã¢â‚¬â€ `PlayheadView` from eased `displayBeatRef` (Musio `smoothPlayheadBeats`); audio target stays `beatAtTime`.
 * Ã‚Â· [Repo](https://github.com/mpatti/musio-create) Ã‚Â· [Walkthrough](https://youtu.be/qW4rIXft0Bg?si=x7uoMOWxiuT1eJln)
 *
 * Web Audio: one `ctx.currentTime` for `sessionStart`, `beatAtTime`, and scheduled clicks; lookahead
 * refills `nextMetroK` so scheduling does not depend on rAF alone.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  type WheelEvent,
} from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useSettings } from '@/app/context/SettingsContext';
import { enumerateAudioDevices, type MediaDeviceOption } from '@/app/lib/audioRouting';
import {
  se2WrapBeatInLoop,
  studioMidiPreviewLoopOccurrences,
  studioMidiPreviewPurgeLoopLapKeys,
  studioMidiPreviewScheduleKeyLoopLap,
  studioMidiPreviewScheduleKeyOccurrence,
  studioPreviewKeyBlipToDestination,
} from '@/app/lib/studioMidiBackend';
import {
  buildStudioSessionFromEditor2Tracks,
  type Editor2ArrangerTrack,
} from '@/app/lib/studio/editor2SessionAdapter';
import {
  studioGetMidiAccess,
  studioListHardwareMidiOutputs,
  studioMidiChannelForTrack,
  studioNextMidiChannel,
  studioScheduleHardwareMidiNote,
  studioTrackOutputsMidi,
} from '@/app/lib/studio/studioEditor2Midi';
import {
  STUDIO_MIDI_DEFAULT_INSTRUMENT_ID,
  studioDefaultMidiInstrumentForTrackName,
  studioMidiInstrumentLabel,
  studioNormalizeMidiInstrumentId,
  studioNormalizeMidiInstrumentIdForDrumTrack,
} from '@/app/lib/studio/studioEditor2Instruments';
import { StudioMidiInstrumentPicker } from '@/app/components/studio/StudioMidiInstrumentPicker';
import { StudioAddTrackDropdown, type StudioNewTrackKind } from '@/app/components/studio/StudioAddTrackDropdown';
import { Se2LaneImportAudio } from '@/app/components/studio/Se2LaneImportAudio';
import { StudioAudioToMidiModePicker } from '@/app/components/studio/StudioAudioToMidiModePicker';
import { StudioSongKeyControl } from '@/app/components/studio/StudioSongKeyControl';
import { StudioSe2ProjectMenuControls } from '@/app/components/studio/StudioSe2ProjectMenuControls';
import {
  StudioTransportBarsIsland,
  StudioTransportBpmIsland,
  StudioTransportTimeIsland,
} from '@/app/components/studio/StudioTransportPositionBox';
import '@/app/styles/studioEditor2.css';
import { StudioTrackGenerateMenu } from '@/app/components/studio/StudioTrackGenerateMenu';
import { StudioInstrumentHarmonyPanel } from '@/app/components/studio/StudioInstrumentHarmonyPanel';
import { StudioRhythmEditTrackPanel } from '@/app/components/studio/StudioRhythmEditTrackPanel';
import { StudioTrackKeyMenu } from '@/app/components/studio/StudioTrackKeyMenu';
import { SynthRoundKnob } from '@/app/components/creation/BeatLabSynthV2Knob';
import { StudioBeatLabPatternBankMenu } from '@/app/components/studio/StudioBeatLabPatternBankMenu';
import { StudioDrumPatternMenu } from '@/app/components/studio/StudioDrumPatternMenu';
import { StudioAudioTrackLaneInput } from '@/app/components/studio/StudioAudioTrackLaneInput';
import {
  paintSe2TrackLaneMeterBar,
  paintSe2TrackLaneMeterShell,
  paintStudioMixerMeterBar,
} from '@/app/lib/studio/se2TrackLaneMeterPaint';
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';
import type { PatternPreset } from '@/app/lib/patternPresets';
import {
  STUDIO_DRUM_PATTERN_LOOP_BARS,
  STUDIO_DRUM_PATTERN_ROW_GM,
  studioBuildBeatLabPatternLoad,
  studioBuildDrumPatternLoad,
  studioDrumInstrumentOptionForBeatLabPreset,
  studioDrumInstrumentOptionForPreset,
  studioTileDrumPatternNotes,
  studioTrackIsDrumChannel,
  type PianoRollDrumPreset,
} from '@/app/lib/studio/studioEditor2DrumPatterns';
import { connectStudioPitchMonitorTap } from '@/app/lib/studio/studioPitchTuneMonitorBus';
import {
  loadPianoRollDrumKit,
  pianoRollPadIndexForMidi,
  pianoRollPadLabelsForKit,
  triggerPianoRollDrumPad,
  type PianoRollDrumKitSession,
} from '@/app/lib/pianoRoll/pianoRollDrumEngine';
import {
  buildMergedDrumKitSession,
  previewSe2DrumPadOverride,
  se2DrumPadOverridesSignature,
  type Se2DrumPadOverride,
} from '@/app/lib/studio/se2DrumPadOverrides';
import {
  analyzeStudioA2mAudioClip,
  detectKeyFromMidiNotes,
  studioKeyLabel,
  studioScaleIntervals,
  type StudioDetectedKeyMode,
} from '@/app/lib/studio/studioAudioClipAnalysis';
import {
  drawSe2ClipWaveform,
  getSe2AudioWaveformPeaks,
  invalidateSe2AudioWaveformPeaks,
  se2AudioBuffersSignature,
} from '@/app/lib/studio/se2AudioWaveformPeaks';
import {
  SE2_MIN_AUDIO_CLIP_DURATION_BEATS,
  se2AudioClipSourceOffsetBeats,
  se2BufferDurationBeats,
  se2NewAudioClipId,
  se2PunchReplaceAudioClipsUnderRange,
  se2SliceWaveformPeaksForClip,
  se2SplitAudioClipAtBeat,
} from '@/app/lib/studio/se2TimelineAudioClips';
import {
  clampSe2ClipGainDb,
  formatSe2ClipGainDb,
  SE2_CLIP_GAIN_DB_PER_PX,
  se2ClipGainAmplitudeScale,
  se2ClipPreviewGainLin,
} from '@/app/lib/studio/se2AudioClipGain';
import {
  applySe2NormalizeToSourceIds,
  consolidateSe2TrackClips,
  formatSe2ConsolidateRangeLabel,
  se2ClipOverlapsBeatRange,
  se2ConsolidateBarsForMinutes,
  se2ConsolidateRangeFromBars,
} from '@/app/lib/studio/se2AudioClipOps';
import {
  bounceSe2StereoMixInRange,
  bounceSe2TrackStemsInRange,
  type Se2ExportBounceTrack,
} from '@/app/lib/studio/se2ExportBounce';
import {
  promptSe2StemFolderSave,
  promptSe2WavSaveLocation,
  saveSe2AudioBufferWav,
  saveSe2StemWavs,
  se2ExportFilenameBase,
} from '@/app/lib/studio/se2ExportDownload';
import {
  MAX_STUDIO_TRACKS,
  SE2_ARRANGEMENT_BARS,
  SE2_BAR_WIDTH_PX,
  SE2_GRID_VIEW_MARGIN_PX,
  SE2_MAX_GRID_BITMAP_PX,
  se2ComputeGridViewport,
  se2TotalBeatsForArrangement,
} from '@/app/lib/studio/se2ArrangementConstants';
import {
  reportSe2MeterPaintWorkMs,
  reportSe2TransportFrameWorkMs,
} from '@/app/lib/studio/se2PerformanceMonitor';
import {
  metaFromAudioBuffer,
  type MasteringBaySourcePayload,
} from '@/app/lib/masteringBay/masteringBaySourceTrack';
import {
  se2TrackAlignClipDurationBeats,
  se2TrackAlignDetectSourceBpm,
  se2TrackAlignPlaybackForWallSegment,
  se2TrackAlignClipStretchRateFromClip,
  se2TrackAlignSourceOffsetBeatDelta,
  se2TrackAlignStretchRate,
  se2TrackAlignMaxDurationBeatsAtLockedRate,
  se2AudioClipPreviewScheduleKey,
  se2TrackAlignRescaleClipForSourceBpm,
  se2TrackIsAudioClipLane,
  se2TrackIsTrackAlign,
  se2TrackUsesTimeStretchAlign,
  se2TrackCanReceiveAudioClipDrag,
  se2TrackHasDraggableAudioClips,
  se2PrepareClipForAlignLane,
  se2ClipUsesAlignStretchPlayback,
} from '@/app/lib/studio/se2TrackAlign';
import {
  se2AudioClipIntersectsLoopRegion,
  se2AudioClipLoopOccurrences,
  se2AudioClipPreviewScheduleKeyLoopLap,
  se2AudioPreviewAdoptFutureLoopLapClips,
  se2AudioPreviewIsLoopLapKey,
  se2AudioPreviewLapClipHasStarted,
  se2AudioPreviewPurgeLoopLapKeys,
  se2AudioPreviewPurgeNonLapKeys,
  se2GateAudioPreviewOccurrence,
  se2PurgeDeadAudioPreviewScheduleKeys,
} from '@/app/lib/studio/se2AudioLoopPreview';
import {
  STUDIO_A2M_DEFAULT_MODE,
  studioClampMidiNotesToTimeline,
  studioDefaultInstrumentForA2mMode,
  studioMapA2mNotesToProjectBpm,
  studioMergeClipMidiNotes,
  studioNormalizeA2mMode,
  type StudioA2mMode,
} from '@/app/lib/studio/studioEditor2AudioToMidi';
import {
  buildGenoUltraArpKeySourceTracks,
  detectKeyFromStudioTrack,
  resolveKeyFromStudioTrack,
} from '@/app/lib/studio/genoUltraArpKeySource';
import {
  importGenoUltraArpFromSe2Track,
  se2TrackToGenoUltraChordInput,
} from '@/app/lib/studio/genoUltraArpSe2TrackImport';
import {
  importGenoBassMidiFromSe2Track,
  se2TrackToGenoBassMidiInput,
} from '@/app/lib/studio/genoBassSe2TrackImport';
import type { GenoArpBarLength } from '@/app/lib/studio/genoUltraArpPattern';
import {
  studioConvertMidiNotesToKey,
  studioResolveTrackKey,
} from '@/app/lib/studio/studioMidiKeyConvert';
import {
  studioDefaultInstrumentForGeneratedPart,
  studioGenerateCompanionPart,
  studioGeneratePartLabel,
  studioInferGenerateKindFromTrack,
  studioInferBarCountFromNotes,
  type StudioGeneratePartKind,
} from '@/app/lib/studio/studioEditor2PartGenerator';
import {
  progressionStepsToBarRootHits,
  progressionStepsToChordNotes,
  progressionStepsToGrooveLeadMelody,
  STUDIO_HARMONY_LOOP_BARS,
  studioDefaultHarmonyMelodyStyleId,
  studioHarmonyBarCountFromSteps,
  studioLoopBarsForMidiContent,
  studioMidiContentEndBeat,
  studioNormalizeHarmonyLoopBars,
  studioResolveHarmonyBarCount,
  studioHarmonyInstrumentId,
  type StudioHarmonyLoopBars,
  type WaveLeafMelodyStyleId,
  studioParseGrooveLeadInstrumentId,
  studioParseOrchestraHitInstrumentId,
  studioPlayGrooveLeadOnPreviewBus,
  studioPlayOrchestraHitOnPreviewBus,
  studioPreloadOrchestraHitInstrument,
  studioTrackIsInstrumentHarmonyChannel,
  type StudioHarmonySoundKind,
} from '@/app/lib/studio/studioInstrumentHarmony';
import {
  rhythmStepsToMidiNotes,
  studioTrackIsRhythmChannel,
} from '@/app/lib/studio/studioRhythmEditTrack';
import { Se2GlideBassPanel } from '@/app/components/studio/Se2GlideBassPanel';
import {
  SE2_GLIDE_BASS_DOCKED_CHROME_PX,
  Se2GlideBassDockedPanel,
} from '@/app/components/studio/Se2GlideBassDockedPanel';
import { interruptStudioProgressionAuditionForTransport } from '@/app/lib/studio/studioProgressionAuditionGuard';
import {
  buildSe2MixerArraysFromSnapshot,
  readSe2StudioMixerSnapshot,
  se2EffectiveTrackMuted,
  SE2_STUDIO_DEFAULT_MASTER_VOL,
  SE2_STUDIO_MIXER_TRACK_DEFAULTS,
  snapshotSe2MixerFromArrays,
  writeSe2StudioMixerSnapshot,
} from '@/app/lib/studio/se2StudioMixerState';
import {
  se2AssignMissingLaneNumbers,
  se2FormatTrackNumber,
  se2NextStudioLaneNumber,
  se2TrackNumberedName,
} from '@/app/lib/studio/se2StudioTrackNumber';
import {
  clampSe2SessionBpm,
  clampSe2SessionSelectedTrack,
  collectSe2AudioSourceIds,
  encodeSe2AudioSources,
  normalizeSe2SessionTracks,
  readSe2SessionSnapshot,
  restoreSe2AudioSources,
  writeSe2SessionSnapshot,
} from '@/app/lib/studio/se2SessionPersistence';
import {
  buildDaMusicBoxSongFile,
  DA_MUSIC_BOX_SONG_EXTENSION,
  downloadDaMusicBoxSongFile,
  parseDaMusicBoxSongFile,
  promptOpenDaMusicBoxSongFile,
  promptSaveDaMusicBoxSongFile,
  se2SongFilenameForName,
  serializeDaMusicBoxSongFile,
  writeDaMusicBoxSongToHandle,
} from '@/app/lib/studio/se2SongFile';
import {
  applySe2FactoryDefaultsIfNeeded,
  readSe2FactoryDefaultSession,
} from '@/app/lib/studio/se2FactoryDefaults';
import {
  applySe2OwnerStartupTemplateToSession,
  captureSe2OwnerStartupTemplate,
  hasSe2OwnerStartupTemplate,
  maybeCaptureExistingSessionAsOwnerStartup,
  readSe2OwnerStartupTemplate,
  readSe2OwnerStartupView,
} from '@/app/lib/studio/se2OwnerStartupTemplate';
import {
  BEAT_LAB_DEFAULT_SYNTH_PRESET_ID,
  beatLabBassSynthPresetById,
} from '@/app/lib/creationStation/beatLabMelodicSynthPresets';
import {
  beatLabBassSynthVoiceParamsFromPresetId,
  type BeatLabBassSynthVoiceParams,
} from '@/app/lib/creationStation/beatLabMelodicSynthV2State';
import {
  haltBeatLabSynthV2TransportVoices,
  previewBeatLabSynthV2Note,
  startBeatLabSynthV2HeldPreview,
  stopBeatLabSynthV2HeldPreview,
  touchBeatLabSynthV2HeldPreview,
} from '@/app/lib/creationStation/beatLabMelodicSynthV2Engine';
import { truncateKickKeyboardVoice } from '@/app/lib/creationStation/eightZeroEightVoice';
import { beatLabMelodicSynthV2AuditionPitch } from '@/app/lib/creationStation/beatLabMidiRoll';
import {
  CREATION_METRO_VOLUME,
  setSe2EditorScreenActive,
  setSe2EditorTransportRunning,
} from '@/app/lib/creationStation/creationTransportSync';
import {
  se2BeatLabLaneForTrack,
  se2GlideBassEmptyPitchRange,
  se2GlideBassPitchSpanNotes,
} from '@/app/lib/studio/se2GlideBassNotes';
import {
  se2GlideBassChordRailFromSource,
  se2HarmonySourceSteps,
  se2ResolveGlideBassHarmonyTrack,
} from '@/app/lib/studio/se2GlideBassHarmony';
import { se2ScheduleGlideBassNote } from '@/app/lib/studio/se2GlideBassTransport';
import {
  applySe2MetroGridLoopSplice,
  se2AnimationTickLoopWrap,
  se2LoopWrapGridTime,
  se2MetroLoopLapIndex,
  se2ShouldIgnoreLoopWrap,
} from '@/app/lib/studio/se2TransportClock';
import {
  nextGlideBassTrackName,
  se2GlideBassVoiceFromTrack,
  se2NormalizeGlideBassPresetId,
  studioTrackIsGlideBassChannel,
} from '@/app/lib/studio/se2GlideBassTrack';
import { Se2SynthGenoPanel } from '@/app/components/studio/Se2SynthGenoPanel';
import {
  SE2_SYNTH_GENO_DOCKED_CHROME_PX,
  Se2SynthGenoDockedPanel,
} from '@/app/components/studio/Se2SynthGenoDockedPanel';
import {
  se2SynthGenoDefaultVoice,
  se2SynthGenoVoiceForStackRole,
  se2SynthGenoVoiceFromRole,
} from '@/app/lib/studio/se2SynthGenoPresets';
import type { Se2SynthGenoStackPart, Se2SynthGenoApplyStackMeta } from '@/app/lib/studio/se2SynthGenoCompose';
import type { GenoDuoPartKind } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import { previewSe2SynthGenoNote, scheduleSe2SynthGenoNote } from '@/app/lib/studio/se2SynthGenoPreview';
import {
  startSe2SynthGenoPluginLoopPreview,
  stopSe2SynthGenoPluginPreview,
  buildSe2SynthGenoPluginPreviewLayers,
  type Se2SynthGenoPluginPreviewHandle,
  type Se2SynthGenoPluginPreviewOpts,
} from '@/app/lib/studio/se2SynthGenoPluginPreview';
import { renderSe2SynthGenoPluginDraftToAudioBuffer } from '@/app/lib/studio/se2SynthGenoPluginBounce';
import { genoMixGainsFromPreviewOpts, setGenoPluginPreviewMixGains } from '@/app/lib/studio/se2SynthGenoLanePreviewGains';
import {
  haltAllSe2LiveChordGlideSessions,
} from '@/app/lib/studio/se2SynthGenoLiveChordGlide';
import { playSe2SynthGenoLiveChordBlock } from '@/app/lib/studio/se2SynthGenoLiveChordPlayback';
import type {
  Se2SynthGenoPluginDraft,
  Se2SynthGenoPluginSoundSelection,
} from '@/app/lib/studio/se2SynthGenoChordPlugin';
import type { Se2SynthGenoVoiceParams, Se2SynthGenoRole } from '@/app/lib/studio/se2SynthGenoTypes';
import {
  nextSynthGenoTrackName,
  se2SynthGenoVoiceFromTrack,
  studioTrackIsSynthGenoChannel,
} from '@/app/lib/studio/se2SynthGenoTrack';
import {
  se2FindGrooveLeadForSynthGeno,
  se2SynthGenoBuildHarmonySteps,
  se2SynthGenoGrooveLeadMelodyNotes,
  se2SynthGenoGrooveLeadTrackName,
  type Se2SynthGenoGrooveLeadLockInput,
} from '@/app/lib/studio/se2SynthGenoGrooveLeadLock';
import { SE2_SYNTH_GENO_BUILD_1_LABEL } from '@/app/lib/studio/se2SynthGenoFusionEngine';
import { Se2GrooveLeadPanel } from '@/app/components/studio/Se2GrooveLeadPanel';
import {
  SE2_GROOVE_LEAD_DOCKED_CHROME_PX,
  Se2GrooveLeadDockedPanel,
} from '@/app/components/studio/Se2GrooveLeadDockedPanel';
import {
  se2GrooveLeadEmptyPitchRange,
  se2GrooveLeadPitchSpanNotes,
} from '@/app/lib/studio/se2GrooveLeadNotes';
import {
  nextGrooveLeadTrackName,
  se2GrooveLeadPatchLabelFromTrack,
  se2GrooveLeadVoiceFromTrack,
  se2NormalizeGrooveLeadPresetId,
  se2ResolveGrooveLeadHarmonyTrack,
  studioTrackIsGrooveLeadChannel,
} from '@/app/lib/studio/se2GrooveLeadTrack';
import {
  se2GrooveLeadCanFollowHarmonySource,
  se2GrooveLeadMelodyFromHarmonySource,
} from '@/app/lib/studio/se2GrooveLeadHarmonyMelody';
import type { GenoUltraArpSe2TrackChordInput } from '@/app/lib/studio/genoUltraArpSe2TrackImport';
import {
  previewSe2GrooveLeadNote,
  scheduleSe2GrooveLeadNote,
} from '@/app/lib/studio/se2GrooveLeadPreview';
import { Se2Lab808Panel } from '@/app/components/studio/Se2Lab808Panel';
import {
  SE2_LAB808_DOCKED_CHROME_PX,
  Se2Lab808DockedPanel,
} from '@/app/components/studio/Se2Lab808DockedPanel';
import {
  se2Lab808EmptyPitchRange,
  se2Lab808PitchSpanNotes,
} from '@/app/lib/studio/se2Lab808Notes';
import {
  nextLab808TrackName,
  se2Lab808PatchLabelFromTrack,
  se2Lab808VoiceFromTrack,
  studioTrackIsLab808Channel,
  type Se2Lab808Track,
} from '@/app/lib/studio/se2Lab808Track';
import {
  previewSe2Lab808Note,
  scheduleSe2Lab808Note,
} from '@/app/lib/studio/se2Lab808Preview';
import { refillSe2Lab808DrumOnTransport } from '@/app/lib/studio/se2Lab808DrumTransport';
import { refillSe2Lab808PercOnTransport } from '@/app/lib/studio/se2Lab808PercTransport';
import type { Se2Lab808ToneGridRollNote } from '@/app/lib/studio/se2Lab808ToneGridExport';
import { se2Lab808ChordLockTrackFields } from '@/app/lib/studio/se2Lab808ChordLock';
import {
  se2Lab808DefaultVoice,
  type Se2Lab808VoiceParams,
} from '@/app/lib/studio/se2Lab808Types';
import {
  Se2GenoUltraSynthPanel,
} from '@/app/components/studio/Se2GenoUltraSynthPanel';
import {
  SE2_GENO_ULTRA_DOCKED_CHROME_PX,
  Se2GenoUltraSynthDockedPanel,
} from '@/app/components/studio/Se2GenoUltraSynthDockedPanel';
import {
  SE2_GENO_BASS_DOCKED_CHROME_PX,
  Se2GenoBassSynthDockedPanel,
} from '@/app/components/studio/Se2GenoBassSynthDockedPanel';
import {
  nextGenoUltraSynthTrackName,
  se2GenoUltraPatchLabelFromTrack,
  se2GenoUltraVoiceFromTrack,
  se2DefaultGenoUltraSynthTrack,
  se2GenoUltraEmptyPitchRange,
  se2GenoUltraPitchSpanNotes,
  studioTrackIsGenoUltraSynthChannel,
  SE2_GENO_ULTRA_SYNTH_ACCENT,
} from '@/app/lib/studio/se2GenoUltraSynthTrack';
import {
  nextGenoBassSynthTrackName,
  se2GenoBassPatchLabelFromTrack,
  se2GenoBassVoiceFromTrack,
  se2DefaultGenoBassSynthTrack,
  se2GenoBassEmptyPitchRange,
  se2GenoBassPitchSpanNotes,
  studioTrackIsGenoBassSynthChannel,
  SE2_GENO_BASS_SYNTH_ACCENT,
} from '@/app/lib/studio/se2GenoBassSynthTrack';
import { GENO_ULTRA_DEFAULT_PRESET_ID, genoUltraPresetById } from '@/app/lib/studio/genoUltraSynthPresets';
import { genoBassPresetById, GENO_BASS_DEFAULT_PRESET_ID } from '@/app/lib/studio/genoBassSynthPresets';
import type { GenoUltraSynthVoiceParams } from '@/app/lib/studio/genoUltraSynthTypes';
import {
  previewSe2GenoUltraSynthNote,
  scheduleSe2GenoUltraSynthNote,
} from '@/app/lib/studio/se2GenoUltraSynthPreview';
import { haltGenoUltraSynthTransportVoices } from '@/app/lib/studio/genoUltraSynthEngine';
import {
  listGenoUltraGenoBuildChordSources,
} from '@/app/lib/studio/genoUltraArpChordImport';
import { subscribeGenoBuildSessionChanged } from '@/app/lib/studio/genoBuildSessionNotify';
import {
  se2GrooveLeadDefaultVoice,
  type Se2GrooveLeadVoiceParams,
} from '@/app/lib/studio/se2GrooveLeadTypes';
import { Se2DrumGeneratorPanel } from '@/app/components/studio/Se2DrumGeneratorPanel';
import {
  SE2_DRUM_GENERATOR_COLLAPSED_CHROME_PX,
  SE2_DRUM_GENERATOR_DOCKED_CHROME_PX,
  Se2DrumGeneratorCollapsedStrip,
  Se2DrumGeneratorDockedPanel,
} from '@/app/components/studio/Se2DrumGeneratorDockedPanel';
import type { Se2DrumGeneratorLoad } from '@/app/lib/studio/se2DrumGeneratorEngine';
import {
  nextDrumGeneratorTrackName,
  se2DrumGenHarmonySourceCandidates,
  se2DrumGenTrackHarmonyReady,
  se2NormalizeDrumGenStyle,
  se2NormalizeDrumGenTemperature,
  SE2_DRUM_GEN_DEFAULT_TEMPERATURE,
  se2ResolveDrumGenHarmonyTrack,
  studioTrackIsDrumGeneratorChannel,
  type Se2DrumGenStyle,
} from '@/app/lib/studio/se2DrumGeneratorTrack';
import { Se2GenoChordCreatorPanel } from '@/app/components/studio/Se2ChordGeniePanel';
import {
  PIANO_GENO_CHORD_CREATOR_DOCK_CHROME_PX,
  SE2_CHORD_GENIE_COLLAPSED_CHROME_PX,
  Se2ChordGenieCollapsedStrip,
  Se2ChordGenieDockedPanel,
} from '@/app/components/studio/Se2ChordGenieDockedPanel';
import {
  nextGenoChordCreatorTrackName,
  se2DefaultGenoChordCreatorTrack,
  SE2_CHORD_GENERATOR_LABEL,
  SE2_GENO_CHORD_CREATOR_ACCENT,
  studioTrackIsGenoChordCreatorChannel,
  type Se2GenoChordCreatorTrack,
} from '@/app/lib/studio/se2ChordGenieTrack';
import { se2HarmonyStepsForLoopBars } from '@/app/lib/studio/se2ChordGeneratorPassingRhythm';
import {
  se2GenerateDrumGenFromMatchCards,
} from '@/app/lib/studio/se2SynthGenoLivePresetSessionSync';
const Se2BeatPadsPanelLazy = lazy(() =>
  import('@/app/components/studio/Se2BeatPadsPanel').then((m) => ({ default: m.Se2BeatPadsPanel })),
);
const Se2GenoBassSynthPanelLazy = lazy(() =>
  import('@/app/components/studio/Se2GenoBassSynthPanel').then((m) => ({ default: m.Se2GenoBassSynthPanel })),
);
import {
  SE2_BEAT_PADS_DOCKED_MAX_PX,
  SE2_BEAT_PADS_SEQUENCER_CHROME_PX,
  Se2BeatPadsDockedPanel,
} from '@/app/components/studio/Se2BeatPadsDockedPanel';
import { Se2BeatPadsExportBridgeProvider } from '@/app/components/studio/Se2BeatPadsExportContext';
import {
  nextBeatPadsTrackName,
  se2BeatPadsSe2SyncMode,
  se2BeatPadsSe2TransportLinked,
  se2DefaultBeatPadsTrack,
  studioTrackIsBeatPadsChannel,
  type Se2BeatPadsSe2SyncMode,
  type Se2BeatPadsTrack,
} from '@/app/lib/studio/se2BeatPadsTrack';
import {
  cloneSe2Lab808VoiceParams,
  se2BeatPads808LabVoiceFromTrack,
} from '@/app/lib/studio/se2BeatPads808LabSync';
import {
  cloneBeatPadsOrchHitsVoice,
  se2BeatPadsOrchHitsVoiceFromTrack,
} from '@/app/lib/studio/se2BeatPadsOrchHitsSync';
import { refillBeatPadsOrchHitsOnTransport } from '@/app/lib/studio/se2BeatPadsOrchHitsTransport';
import type { BeatPadsOrchHitsVoice } from '@/app/lib/studio/se2BeatPadsOrchHitsVoice';
import {
  se2BeatPadsHarmonyKey,
  se2BeatPadsHarmonySyncFromLane,
  se2BeatPadsLoadMatchedPattern,
  se2BeatPadsRegeneratePadOnTrack,
  se2ResolveBeatPadsHarmonyTrack,
} from '@/app/lib/studio/se2BeatPadsHarmony';
import {
  se2BeatPadsSpreadCanReceiveSpreadMidi,
  se2BeatPadsSpreadCanReceiveSpreadWav,
} from '@/app/lib/studio/se2BeatPadsSpreadHarmony';
import {
  computeBeatPadsRollPitchView,
  se2BeatPadsPadLabelsForTrack,
} from '@/app/lib/studio/se2BeatPadsPianoRoll';
import { BEAT_PADS_LANE_GM_PITCH } from '@/app/lib/creationStation/beatPadsStudioExport';
import {
  loadSe2BeatPadsTrackSession,
  refillSe2BeatPadsPatternOnTransport,
  refillSe2BeatPadsSpreadOnTransport,
  se2BeatPadsKickKeySemiForTrack,
  se2BeatPadsStoreSignature,
  triggerSe2BeatPadsMidiPitch,
  type Se2BeatPadsTrackSession,
} from '@/app/lib/studio/se2BeatPadsTransportPlayback';
import { se2PublishBeatPadsBridgeSnapshot } from '@/app/lib/studio/se2BeatPadsBridgePublish';
import {
  BEAT_PADS_GENO_TRIGGER_EVENT,
  consumeBeatPadsGenoTrigger,
  type BeatPadsGenoBuildSlot,
} from '@/app/lib/creationStation/beatPadsSe2Bridge';
import type { BeatPadsDrumPattern, BeatPadsGridStepsPerBar } from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import { normalizeBeatPadsPattern } from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import { Se2HumCapturePanel } from '@/app/components/studio/Se2HumCapturePanel';
import {
  SE2_HUM_CAPTURE_COLLAPSED_CHROME_PX,
  SE2_HUM_CAPTURE_DOCKED_CHROME_PX,
  Se2HumCaptureCollapsedStrip,
  Se2HumCaptureDockedPanel,
} from '@/app/components/studio/Se2HumCaptureDockedPanel';
import {
  se2HumCapturePitchSpanNotes,
  se2HumCaptureEmptyPitchRange,
} from '@/app/lib/studio/se2HumCaptureNotes';
import {
  nextHumCaptureTrackName,
  se2DefaultHumCaptureTrackFields,
  studioTrackIsHumCaptureChannel,
} from '@/app/lib/studio/se2HumCaptureTrack';
import {
  previewSe2HumCaptureNote,
  scheduleSe2HumCaptureNote,
} from '@/app/lib/studio/se2HumCapturePreview';
import {
  Se2GuitarDockedPanel,
  SE2_GUITAR_DOCKED_CHROME_PX,
  SE2_GUITAR_FOCUS_VIEWPORT_FRAC,
} from '@/app/components/studio/Se2GuitarDockedPanel';
import { Se2GuitarPanel } from '@/app/components/studio/Se2GuitarPanel';
import {
  nextGuitarTrackName,
  se2DefaultGuitarTrackFields,
  se2GuitarEmptyPitchRange,
  se2GuitarInstrumentLabelFromTrack,
  se2GuitarPitchSpanNotes,
  SE2_GUITAR_ACCENT,
  studioTrackIsGuitarChannel,
} from '@/app/lib/studio/se2GuitarTrack';
import type { Se2GuitarInstrumentId } from '@/app/lib/studio/se2GuitarInstruments';
import {
  haltSe2GuitarTransportNotes,
  previewSe2GuitarNote,
  scheduleSe2GuitarNote,
  warmupSe2GuitarInstrument,
} from '@/app/lib/studio/se2GuitarSoundfont';
import { se2GuitarFxFromTrack, se2GuitarFxPatchFromTrack } from '@/app/lib/studio/se2GuitarFx';
import { resolveSe2GuitarAudioForTrack, resolveSe2GuitarDestination } from '@/app/lib/studio/se2GuitarFxChain';
import { neuralHumInstrumentMeta, type NeuralHumInstrumentId } from '@/app/lib/vocalLab/neuralHumToInstrument';
import type { NeuralHumRollBarCount } from '@/app/lib/vocalLab/neuralHumMelodyRoll';
import { parseChordSymbolToken } from '@/app/lib/creationStation/chordProgressionParse';
import {
  getOrchestraHitDef,
  haltOrchestraHitPlayback,
} from '@/app/lib/creationStation/grooveLabOrchestraHitBank';
import { haltPadSamplePlayback } from '@/app/lib/creationStation/padSamplePlayback';
import {
  newProgressionStepId,
  type GrooveProgressionStep,
} from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { se2PresetUsesOpenJazzNeoVoicing } from '@/app/lib/studio/se2OpenJazzNeoVoicing';
import { GROOVE_ORCHESTRA_HIT_DEFAULT } from '@/app/lib/creationStation/grooveLabOrchestraHitSoundBank';
import type { OrchestraHitId } from '@/app/lib/creationStation/grooveLabOrchestraHitBank';
import { GROOVE_LAB_LEAD_SOUND_DEFAULT } from '@/app/lib/creationStation/grooveLabLeadSounds';
import type { GrooveLabLeadSoundId } from '@/app/lib/creationStation/grooveLabLeadSounds';
import { mixSeed } from '@/app/lib/groovePatternEngine';
import type { PendingNeuralHumStudioImport } from '@/app/lib/vocalLab/neuralHumStudioExport';
import type { PendingBeatPadsStudioImport } from '@/app/lib/creationStation/beatPadsStudioExport';
import type { PendingAiMatchStudioImport } from '@/app/lib/aiMusicMatch/aiMusicMatchStudioExport';
import {
  studioTrackFxStackActive,
  studioUseLiveVocalFxPlayback,
} from '@/app/lib/studio/studioLiveVocalFxChain';
import { ensureStudioLivePitchTuneWorklet } from '@/app/lib/studio/studioLivePitchTune';
import {
  cleanupAllStudioLiveVocalFx,
  reindexStudioLiveVocalFxRegistryAfterRemove,
  updateStudioLiveVocalFxForTrack,
} from '@/app/lib/studio/studioLiveVocalFxRegistry';
import {
  disconnectStudioTrackVocalFxInsert,
  ensureStudioTrackVocalEntry,
  invalidateStudioTrackVocalFxInsert,
  getStudioTrackVocalFxEntry,
  removeStudioTrackVocalFxInsertAt,
  resetStudioTrackVocalFxInserts,
  syncStudioTrackVocalFxInsert,
} from '@/app/lib/studio/studioTrackVocalFxInsert';
import {
  reconnectStudioVocalLiveMicIfCached,
  resolveStudioLiveInputMonitorTarget,
  routeStudioVocalLiveSignal,
  studioLiveInputMonitorKey,
} from '@/app/lib/studio/studioVocalSignalRouter';
import { setStudioPitchMonitorRouteListener } from '@/app/lib/studio/studioPitchTuneMonitorBus';
import type { StudioVocoderCarrierTrack } from '@/app/lib/studio/studioVocoderCarrier';
import {
  cloneStudioTrackInsertFxRack,
  defaultStudioTrackInsertFxRack,
  studioArmInsertFxRackForSlot,
  studioTrackInsertFxRacksEqual,
  type StudioTrackInsertFxRack,
} from '@/app/lib/studio/studioTrackInsertFx';
import {
  STUDIO_TRACK_VOCAL_FX_DEFAULT,
  studioEffectiveTrackVocalFx,
  studioTrackVocalFxActive,
  studioVocalFxEffectiveNeedsLiveReconnect,
  studioWireA2mPitchRouteOnTrack,
  type StudioTrackVocalFx,
} from '@/app/lib/studio/studioTrackVocalFx';
import {
  ensureStudioInputMonitor,
  getStudioInputMonitorStream,
  setStudioInputMonitorGain,
  setStudioInputMonitorKeepAlive,
  setStudioInputMonitorSoftMuted,
  stopStudioInputMonitor,
  STUDIO_INPUT_MONITOR_GAIN,
  studioInputMonitorConnectDest,
  studioInputMonitorDisconnectStrip,
} from '@/app/lib/studio/studioInputMonitor';
import { se2RemoveParallelTrackSlot } from '@/app/lib/studio/se2TrackParallelSlots';
import {
  haltStudioEditor2MidiInstrumentNotes,
  previewStudioEditor2MidiInstrumentNote,
  scheduleStudioEditor2MidiInstrumentNote,
  warmupStudioEditor2MidiInstrument,
  warmupStudioEditor2TrackMidiInstruments,
} from '@/app/lib/studio/studioEditor2MidiInstrumentPlayback';
import {
  findSe2RecordTargetTrackIndex,
  se2AudioRecordingActive,
  startSe2AudioRecording,
  stopSe2AudioRecording,
} from '@/app/lib/studio/se2AudioRecording';
import {
  Se2LiveRecordingCapture,
  type Se2LiveRecordUiSession,
} from '@/app/lib/studio/se2LiveRecordingCapture';
import { runSe2Precount, createSe2PrecountRimshotBuffer, ensureSe2PrecountRimshotBuffer, SE2_PRECOUNT_CLICK_VOLUME } from '@/app/lib/studio/se2Precount';
import {
  studioMixerMeterBallisticsStep,
  studioMixerMeterFrameDt,
  studioMixerMonitorLinear,
  studioMixerDisplayToDb,
  armStudioMixerMeterDecayOnly,
  clearStudioMixerMeterDecayOnly,
  resetStudioMixerMeterBallistics,
  STUDIO_MIXER_MASTER_TRACK_INDEX,
} from '@/app/lib/studio/studioMixerMeterEngine';
import {
  applyStudioMixerStripMix,
  ensureStudioMixerStrips,
  getStudioMixerStripInput,
  preloadStudioMixerMeterWorklet,
  readStudioMasterBusMeter,
  readStudioMixerStripInputMeter,
  readStudioMixerStripMeter,
  removeStudioMixerStripAt,
  resetStudioMixerMeterPeaks,
  prepareStudioMixerMetersForStop,
  setStudioMixerStripGraphPlaybackLocked,
  isStudioMixerStripGraphPlaybackLocked,
  setStudioMixerStripCountHint,
  getStudioMixerStripCountHint,
  ensureStudioPreviewBusOutput,
  forceStudioPreviewBusOutput,
  noteStudioPreviewBusOutput,
} from '@/app/lib/studio/studioMixerStripBus';
import {
  resolveStudioTrackPlaybackInput,
  getStudioTrackInsertPreStrip,
  getStudioTrackClipPlaybackBus,
  healStudioTrackPlaybackRouteIfStale,
  resyncStudioTrackInsertFxStripInputs,
  removeStudioTrackInsertFxStripAt,
  resetStudioTrackInsertFxStrips,
} from '@/app/lib/studio/studioTrackInsertFxStrip';
import {
  ChannelStripFxButton,
  emptyMixerFxSlots,
  type MixerEffectId,
} from '@/app/screens/components/ChannelStripFxDropdowns';
import { TimelineContextMenu } from '@/app/screens/components/TimelineContextMenu';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eraser,
  FastForward,
  GripVertical,
  HelpCircle,
  Mic,
  Minus,
  MousePointer2,
  Pause,
  Pencil,
  Piano,
  Play,
  Plus,
  Maximize2,
  Minimize2,
  Music2,
  Repeat,
  Rewind,
  SkipBack,
  SlidersHorizontal,
  Square,
  Star,
  Trash2,
  Undo2,
  Redo2,
  MoveHorizontal,
  Scissors,
} from 'lucide-react';

import { PPQ, useMasterClock } from '@/app/context/MasterClockContext';
import {
  normalizePianoSnapSubdiv,
  readPianoSnapSubdivFromStorage,
  snapLabelFromPianoSnapSubdiv,
  ticksPerPianoSnapCell,
} from '@/app/lib/sharedPianoSnapSubdiv';
import {
  StudioEditor2HelpProvider,
  StudioEditor2HelpTip,
  useStudioEditor2HelpContext,
} from '@/app/components/studio/StudioEditor2HelpHub';

const BARS = SE2_ARRANGEMENT_BARS;
const BAR_WIDTH_PX = SE2_BAR_WIDTH_PX;
const TOTAL_WIDTH_PX = BAR_WIDTH_PX * BARS;
const PLAYHEAD_W_PX = 1;

/** One barÃ¢â‚¬â„¢s width in pixels is fixed; beats per bar sets horizontal scale (`TimelineView` / piano roll). */
function pixelsPerBeat(beatsPerBar: number): number {
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  return BAR_WIDTH_PX / bpb;
}

function totalBeatsForSig(beatsPerBar: number): number {
  return se2TotalBeatsForArrangement(beatsPerBar);
}

function ppbAtZoom(zoom: number, beatsPerBar: number): number {
  return pixelsPerBeat(beatsPerBar) * zoom;
}

const RULER_BAR_H_PX = 24;
const RULER_MEAS_H_PX = 36;
const RULER_TOTAL_H_PX = RULER_BAR_H_PX + RULER_MEAS_H_PX;
/** Measure-ruler pointer gesture: px before scrub vs zoom mode locks. */
const RULER_GESTURE_LOCK_PX = 5;
/** Vertical drag on beat numbers: px of pull for +1.0 timeline zoom (up = zoom in). */
const RULER_ZOOM_DRAG_SENSITIVITY = 72;
/** Vertical must exceed horizontal by this ratio to lock zoom (avoids accidental scrub lock). */
const RULER_ZOOM_AXIS_BIAS = 1.15;
/** Default arrange-lane row height; user-adjustable via drag handles (see {@link MIN_TRACK_LANE_H_PX}). */
const DEFAULT_TRACK_LANE_H_PX = 80;
const MIN_TRACK_LANE_H_PX = 48;
const MAX_TRACK_LANE_H_PX = 140;
/** Track names in piano toolbar (not the left track column). */
const TRACK_NAME_UI_CLASS =
  'se2-type-micro text-[4.5px] leading-none';

/** Left track column lane labels only (`data-studio-track-view`). */
const TRACK_DISPLAY_TEXT_CLASS =
  'se2-type-micro text-[12px] leading-tight';

/** Narrow mixer strip only â€” smaller than timeline so **FX** can dominate the header row. */
const TRACK_NAME_MIXER_CLASS =
  'se2-type-micro text-[3.8px] leading-none';

/** Channel strip â€” room for dB column + rail corridor so arrow doesnâ€™t sit on digits. */
const MIXER_STRIP_W_PX = 108;
/** Uniform mixer strip header â€” instrument, bass, drums, and audio lanes align. */
const MIXER_STRIP_HEADER_H_PX = 36;
/**
 * Fader rail / knob centre â€” far enough **right** that capsule + left arrow clear the scale band.
 * (VU meters stay a fixed sibling column â€” unchanged.)
 */
const MIXER_FADER_RAIL_LEFT = '78%';
/**
 * Printed scale band: pinned from the left edge and from the right so tick **hashes** end before the rail.
 * Arrow lines up with those hashes vertically; digits stay left of the corridor.
 */
const MIXER_DB_SCALE_EDGE_LEFT_PX = 6;
/** Distance from fader cellâ€™s right edge to the scale rowâ€™s right edge â€” clears ~half knob + gap past rail centre. */
const MIXER_DB_SCALE_EDGE_RIGHT = 'calc(22% + 20px)';

/** Top / bottom inset inside the fader cell (rail + travel). Larger bottom = clearer âˆ’60 vs bottom mark + no knob bleed into FX row. */
const MIXER_FADER_INSET_TOP_PX = 10;
const MIXER_FADER_INSET_BOTTOM_PX = 16;
/** Sum â€” travel math (same role as former 2Ã— single inset). */
const MIXER_FADER_INSET_SUM_PX = MIXER_FADER_INSET_TOP_PX + MIXER_FADER_INSET_BOTTOM_PX;
/** Capsule height â€” arrow triangle sits near the top; knob position aligns **arrow** to the scale line. */
const MIXER_FADER_KNOB_H_PX = 18;
/**
 * Distance from knob **bottom** up to the arrow centroid (`top:2` + half of 6px-tall triangle â‰ˆ 5px from knob top).
 * So at unity (vol 100) the arrow sits on the printed â€œ0â€ tick, not the grip mid-line.
 */
const MIXER_FADER_ARROW_REF_FROM_BOTTOM_PX = 13;

/**
 * Linear mapping vol 0â€¦127 â†’ `bottom` distance from fader cell base (same line as tick marks).
 * Do not round vol â€” rounded % was shifting unity off the â€œ0â€ tick.
 */
function mixerFaderTravelBottom(vol127: number): string {
  const t = Math.max(0, Math.min(1, vol127 / 127));
  const pct = t * 100;
  return `calc(${MIXER_FADER_INSET_BOTTOM_PX}px + ${pct.toFixed(5)}% - ${(t * MIXER_FADER_INSET_SUM_PX).toFixed(5)}px)`;
}

/** Bottom edge of knob so the **arrow** sits on `mixerFaderTravelBottom` (same line as printed ticks). */
function mixerFaderKnobBottom(vol127: number): string {
  const t = Math.max(0, Math.min(1, vol127 / 127));
  const pct = t * 100;
  const ref = MIXER_FADER_ARROW_REF_FROM_BOTTOM_PX;
  return `calc(${MIXER_FADER_INSET_BOTTOM_PX - ref}px + ${pct.toFixed(5)}% - ${(t * MIXER_FADER_INSET_SUM_PX).toFixed(5)}px)`;
}

/** Level fill: from bottom inset up to the travel line (stops at rail base at vol 0). */
function mixerFaderFillHeight(vol127: number): string {
  const t = Math.max(0, Math.min(1, vol127 / 127));
  const pct = t * 100;
  return `calc(${pct.toFixed(5)}% - ${(t * MIXER_FADER_INSET_SUM_PX).toFixed(5)}px)`;
}

/** MIDI-style fader value for unity / 0 dB on the printed scale. */
const MIXER_UNITY_VOL = 100;

/** Default master ≈ −10 dB — replaces the old hidden 0.32 preview-bus trim. */
const STUDIO_DEFAULT_MASTER_VOL = SE2_STUDIO_DEFAULT_MASTER_VOL;

/**
 * Industry-style channel fader (Logic / common DAW pattern): max **+6 dB** above unity,
 * unlimited cut with **~âˆ’60 dB** at the last step before silence, **âˆ’âˆž** at the bottom stop.
 * `vol` 1â€¦99 maps attenuation linearly in that display range; audio gain uses the same dB law.
 */
const MIXER_FADER_MAX_BOOST_DB = 6;
/** At `vol === 1` the readout shows **âˆ’** this many dB (typical last â€œnumberedâ€ step before âˆ’âˆž). */
const MIXER_FADER_CUT_END_DB = 60;

/**
 * Same dB curve as {@link formatMixerFaderDb}, as a number (âˆ’âˆž â†’ use for gain only via linearizer).
 */
function mixerVolToDb(vol127: number): number {
  if (vol127 <= 0) return -Infinity;
  if (vol127 < 100) {
    return -MIXER_FADER_CUT_END_DB + ((vol127 - 1) / 99) * MIXER_FADER_CUT_END_DB;
  }
  if (vol127 === 100) return 0;
  return ((vol127 - 100) / 27) * MIXER_FADER_MAX_BOOST_DB;
}

/** WebAudio gain factor â€” matches printed dB and master/track buses. */
function mixerVolToLinearGain(vol127: number): number {
  const db = mixerVolToDb(vol127);
  if (!Number.isFinite(db)) return 0;
  return Math.pow(10, db / 20);
}

/** DAW-style meter colors from bar position on the −60…0 dB ladder (LED fill). */
function meterFillGradient(displayNorm: number, muted: boolean): string {
  if (muted) return 'rgba(40,40,52,0.85)';
  if (!Number.isFinite(displayNorm) || displayNorm <= 0) return 'rgba(28,28,40,0.5)';
  const db = studioMixerDisplayToDb(displayNorm);
  if (db < 0) {
    return 'linear-gradient(to top, #00b84a 0%, #12e86a 55%, #5dff9a 100%)';
  }
  if (db < 3) {
    return 'linear-gradient(to top, #00b84a 0%, #12e86a 70%, #ffc53d 100%)';
  }
  return 'linear-gradient(to top, #00b84a 0%, #12e86a 62%, #ffb020 82%, #ff3d4a 100%)';
}

/**
 * Sparse printed ladder: +6 â€¦ âˆ’60 (lowest printed step). **No** â€œâˆ’âˆž / -INFâ€ tick â€” it sat on top of âˆ’60;
 * use the numeric readout under the strip for **âˆ’âˆž** at vol 0.
 */
const MIXER_FADER_DB_TICKS: { label: string; vol: number }[] = [
  { label: '+6', vol: 127 },
  { label: '+3', vol: 114 },
  { label: '0', vol: 100 },
  { label: '-6', vol: 90 },
  { label: '-12', vol: 80 },
  { label: '-18', vol: 70 },
  { label: '-24', vol: 60 },
  { label: '-36', vol: 41 },
  { label: '-48', vol: 21 },
  { label: '-60', vol: 1 },
];

/** Readout next to the fader â€” same law as {@link mixerVolToLinearGain} / pro channel strip. */
function formatMixerFaderDb(vol127: number): string {
  if (vol127 <= 0) return '-âˆž';
  if (vol127 < 100) {
    const db = -MIXER_FADER_CUT_END_DB + ((vol127 - 1) / 99) * MIXER_FADER_CUT_END_DB;
    return `${Math.round(db)}`;
  }
  if (vol127 === 100) return '0';
  const plusDb = ((vol127 - 100) / 27) * MIXER_FADER_MAX_BOOST_DB;
  const dec = Math.round(plusDb * 10) / 10;
  return `+${String(dec).replace(/\.0$/, '')}`;
}

/** Row count for timeline lane backgrounds (zero when project has no tracks). */
function timelineLaneRowCount(trackCount: number): number {
  return trackCount <= 0 ? 0 : Math.min(trackCount, MAX_STUDIO_TRACKS);
}

function arrangementHeightPx(trackCount: number, laneH: number): number {
  return RULER_TOTAL_H_PX + arrangementLanesHeightPx(trackCount, laneH);
}

function arrangementLanesHeightPx(trackCount: number, laneH: number): number {
  return timelineLaneRowCount(trackCount) * laneH;
}

/** Same clamp as {@link syncTimelineGridLayer} â€” DOM lane rows must match canvas `laneHClamped`. */
function clampArrangeLaneHeightPx(h: number): number {
  return Math.max(MIN_TRACK_LANE_H_PX, Math.min(MAX_TRACK_LANE_H_PX, Math.round(h)));
}
/** Track list / lane name column â€” kept relatively thin so the mixer can use horizontal space. */
const TRACK_HEADER_W_PX = 228;
const GRID_CACHE_VERSION = 12;
/** Playhead grab width Ã¢â‚¬â€ Studio-style drag target (`PlayheadView` is 2px; hit area wider). */
const PLAYHEAD_GRIP_W_PX = 22;

/** `TrackPianoRollView` / `AdvancedPianoRollView` Ã¢â‚¬â€ piano column, ruler, velocity lane. */
/** Key strip only (not the note grid); wider keys read clearer next to the ruler. */
const PIANO_KEY_W_PX = 88;
const PIANO_RULER_H_PX = 24;
const PIANO_VELOCITY_LANE_H_PX = 46;
/** Collapsed velocity strip â€” toggle row only (lane closed by default). */
const PIANO_VELOCITY_TOGGLE_H_PX = 20;
/** Gap above the transport bar so quantize / octave toolbar row stays visible. */
const PIANO_ROLL_BOTTOM_CLEARANCE_PX = 14;
/** Toolbar rows (tools + track chips + quantize/octave) — taller than a single strip. */
const PIANO_TOOLBAR_CHROME_PX = 128;
/** `AdvancedPianoRollView` default-ish row height. */
/** One horizontal band = one MIDI pitch (semitone); vertical zoom is separate from horizontal snap. */
const PIANO_NOTE_ROW_H_PX = 26;
/** `visibleOctaveRange` 2Ã¢â‚¬Â¦7 Ã¢â€ â€™ 72 rows; `pitchOffset` = 7*12+11 (see `AdvancedNoteView` in Musio). */
const PIANO_PITCH_HI = 95;
const PIANO_PITCH_LO = 24;
const PIANO_ROW_COUNT = PIANO_PITCH_HI - PIANO_PITCH_LO + 1;
const PIANO_GRID_H_PX = PIANO_ROW_COUNT * PIANO_NOTE_ROW_H_PX;
const PIANO_PANEL_H_MIN = 260;
const PIANO_PANEL_H_MAX = 900;
/** Default bottom piano-roll height when opened (fraction of viewport below header/footer). */
const PIANO_PANEL_VIEWPORT_FRAC = 0.54;
const PIANO_GRID_CACHE_VER = 11;

type MockMidiNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  /** Piano-roll block width — may be shorter than `durationBeats` for rhythm chops. */
  rollDurationBeats?: number;
  velocity: number;
  flexCurve?: { beatOffset: number; pitch: number }[];
};

function midiNoteRollDurationBeats(n: Pick<MockMidiNote, 'durationBeats' | 'rollDurationBeats'>): number {
  const roll = n.rollDurationBeats;
  return roll != null && roll > 0 ? roll : n.durationBeats;
}

type StudioTrackKind =
  | 'midi'
  | 'audio'
  | 'trackAlign'
  | 'a2m'
  | 'rhythm'
  | 'glideBass'
  | 'synthGeno'
  | 'grooveLead'
  | 'lab808'
  | 'genoUltraSynth'
  | 'genoBassSynth'
  | 'drumGenerator'
  | 'beatPads'
  | 'humCapture'
  | 'guitar'
  | 'genoChordCreator'
  | 'chordGenie';

/** Timeline audio region â€” `sourceId` keys runtime `AudioBuffer` map in the editor (playlist-style clip). */
type StudioAudioClip = {
  id: string;
  sourceId: string;
  startBeat: number;
  durationBeats: number;
  name?: string;
  /** Trim into shared buffer (beats at project BPM). */
  sourceOffsetBeats?: number;
  /** Source tempo for Track Align time-stretch (detected on import). */
  sourceBpm?: number;
  /** Track Align — pitch-stable stretch to clip length (default on). */
  alignTempoLock?: boolean;
  /** Track Align trim mode — fixed stretch ratio while cropping with edge (no Shift). */
  alignWallStretchRate?: number;
  /** Non-destructive clip gain in dB (0 = unity relative to SE2 baseline). */
  gainDb?: number;
};

type MockMusioTrack = {
  id: string;
  name: string;
  colorHex: string;
  kind: StudioTrackKind;
  /** Stable session lane id (T01, T02…) — set when the track is created. */
  laneNumber: number;
  notes: MockMidiNote[];
  audioClips: StudioAudioClip[];
  /** MIDI output channel 1â€“16 for this instrument lane (Studio Oneâ€“style). */
  midiChannel?: number;
  /** Sound source for this lane â€” GM, synth preset, 808 bass, drum kit, etc. */
  midiInstrumentId?: string;
  /** Clip-level Audio â†’ MIDI profile (`kind === 'a2m'`). */
  a2mMode?: StudioA2mMode;
  /** Tempo detected from the last analyzed clip on this lane. */
  a2mDetectedBpm?: number;
  /** Last detected source BPM on Track Align lane. */
  alignSourceBpm?: number;
  /** Key root 0=C â€¦ 11=B from clip analysis. */
  a2mKeyRoot?: number;
  a2mKeyMode?: StudioDetectedKeyMode;
  /** Imported / working key for this lane (melodic MIDI + A2M). */
  trackKeyRoot?: number;
  trackKeyMode?: StudioDetectedKeyMode;
  /**
   * Hardware mic/line input for this audio track only (`''` = follow Settings â†’ Audio Input).
   * Wired into `getUserMedia` when the track is record-armed (same pattern as Studio One / Pro Tools input list).
   */
  audioInputDeviceId?: string;
  /** Last loaded Piano Roll drum preset (Trap / R&B catalog). */
  drumPatternPresetId?: string;
  /** Last loaded Beat Lab pattern bank preset (Creation Station catalog). */
  beatLabPatternPresetId?: string;
  /** Paired 16-pad producer kit from the preset catalog. */
  drumProducerKitId?: BeatLabProducerKitId;
  /** Per-pad sound swaps (kick, snare, clap…) on this drum lane. */
  drumPadOverrides?: Partial<Record<number, Se2DrumPadOverride>>;
  /** Instrument-channel harmony builder â€” progression steps (GrooveLab-style). */
  harmonySteps?: GrooveProgressionStep[];
  /** Last selected orchestra hit for root-hit apply. */
  harmonyOrchHitId?: OrchestraHitId;
  harmonySoundKind?: StudioHarmonySoundKind;
  harmonyGrooveLeadId?: GrooveLabLeadSoundId;
  harmonyLoopBars?: StudioHarmonyLoopBars;
  harmonyMelodySeed?: number;
  harmonyMelodyStyleId?: WaveLeafMelodyStyleId;
  /** Rhythm-edit lane â€” hits-per-bar chord steps (built into track). */
  rhythmSteps?: GrooveProgressionStep[];
  rhythmLoopBars?: StudioHarmonyLoopBars;
  /** Bass Glide lane — Beat Lab synth + GLIDE FX (SE2 mirror). */
  glideBassPresetId?: string;
  /** Track id with Progression+ / rhythm steps for chord glide + bass generator. */
  glideBassHarmonyTrackId?: string;
  /** Synth Geno lane — prompt + generated patch label. */
  synthGenoPrompt?: string;
  synthGenoComposePrompt?: string;
  synthGenoPatchLabel?: string;
  /** Linked Groove Lead lane id (chord-locked from this Geno progression). */
  synthGenoGrooveLeadTrackId?: string;
  /** Groove Lead lane — WaveLeaf preset from Groove Lab. */
  grooveLeadPresetId?: string;
  /** Progression+ / rhythm source for melody generator. */
  grooveLeadHarmonyTrackId?: string;
  /** Regenerate seed for Mellodo-style lead variations. */
  grooveLeadMelodySeed?: number;
  /** 808 Lab lane — trap kick / bass synth (standalone, not Creation Station). */
  lab808SoundLane?: 'kick' | 'bass';
  lab808KickPresetId?: string;
  lab808BassPresetId?: string;
  lab808TonePadBaseMidi?: number;
  lab808ToneGridLoopBars?: number;
  lab808ToneGridSteps?: boolean[][];
  lab808ToneGridZoom?: number;
  lab808RootGenQuantize?: string;
  lab808RootGenGenre?: string;
  lab808PercSnareSteps?: boolean[];
  lab808PercClapSteps?: boolean[];
  lab808PercLevel?: number;
  lab808ChordLockEnabled?: boolean;
  lab808ChordLockSourceKind?: string;
  lab808ChordLockHarmonyTrackId?: string;
  lab808ChordLockKeyRoot?: number;
  lab808ChordLockKeyMode?: string;
  /** @deprecated */
  lab808DrumSteps?: boolean[][];
  /** Geno Ultra Synth — ANA-style subtractive instrument lane. */
  genoUltraPresetId?: string;
  genoUltraPatchLabel?: string;
  genoUltraArpSyncLocked?: boolean;
  /** Per-track Geno Ultra ARP local tempo (independent of SE2 session BPM). */
  genoUltraArpBpm?: number;
  /** Geno Bass Synth — classic Mooga / Retro Box / FM bass lane. */
  genoBassPresetId?: string;
  genoBassPatchLabel?: string;
  /** Drum Generator lane — style-matched groove generation. */
  drumGenStyle?: Se2DrumGenStyle;
  drumGenSeed?: number;
  drumGenTemperature?: number;
  drumGenHarmonyTrackId?: string;
  drumGenGenoBuildSlot?: import('@/app/lib/studio/se2DrumGeneratorTrack').Se2DrumGenGenoBuildSlot;
  drumGenModernPresetId?: string;
  drumGenModernGenre?: string;
  /** Geno Chord Creator — card sketch draft + harmony export. */
  genoChordCreatorPresetId?: string;
  genoChordCreatorAudioOn?: boolean;
  genoChordCreatorSe2Sync?: boolean;
  /** @deprecated Renamed — legacy sessions */
  chordGeniePresetId?: string;
  chordGenieAudioOn?: boolean;
  /** Beat Pads lane — full drum machine pattern + Geno sync. */
  beatPadsLoopBars?: number;
  beatPadsStepsPerBar?: BeatPadsGridStepsPerBar;
  beatPadsPattern?: BeatPadsDrumPattern;
  beatPadsHarmonyTrackId?: string;
  beatPadsGenoBuildSlot?: BeatPadsGenoBuildSlot;
  beatPadsHarmonyLocked?: boolean;
  beatPadsPatternStyle?: Se2DrumGenStyle;
  beatPadsMatchedPresetId?: string;
  beatPadsKickKeyLock?: boolean;
  beatPadsKickFollowMode?: import('@/app/lib/studio/se2BeatPadsKickMatch').Se2BeatPadsKickFollowMode;
  beatPadsKickTargetPad?: number;
  beatPadsSyncLocked?: boolean;
  beatPadsSe2SyncMode?: import('@/app/lib/studio/se2BeatPadsTrack').Se2BeatPadsSe2SyncMode;
  beatPadsProducerKitId?: import('@/app/lib/creationStation/beatLabProducerKits').BeatLabProducerKitId;
  beatPadsSpread?: import('@/app/lib/studio/se2BeatPadsSpreadStore').Se2BeatPadsSpreadSnapshot;
  /** Beat Pads mini 808 Lab — survives closing the 808 Lab tab. */
  beatPads808LabVoice?: import('@/app/lib/studio/se2Lab808Types').Se2Lab808VoiceParams;
  beatPads808LabSynced?: boolean;
  /** Beat Pads ORCH hits Lab — survives closing the ORCH pad panel. */
  beatPadsOrchHitsVoice?: BeatPadsOrchHitsVoice;
  beatPadsOrchHitsSynced?: boolean;
  /** Hum Capture lane — mic, key pads, melody roll. */
  humCaptureInstrumentId?: NeuralHumInstrumentId;
  humCaptureHarmonyTrackId?: string;
  humCaptureRollBars?: NeuralHumRollBarCount;
  humCaptureKeyLockMode?: string;
  humCaptureKeyRoot?: number;
  humCaptureScaleId?: string;
  humCaptureQuantize?: string;
  humCaptureTranspose?: number;
  /** Guitar lane — smplr MusyngKite sampled guitar. */
  guitarInstrumentId?: Se2GuitarInstrumentId;
  guitarTranspose?: number;
  guitarFxDrive?: number;
  guitarFxChorus?: number;
  guitarFxReverb?: number;
  guitarFxTone?: number;
  guitarFxComp?: number;
};

const NEW_TRACK_COLOR_HEX: string[] = ['#5B8CFF', '#D4A84B', '#E85D75', '#7CF4C6', '#FFB84D', '#C77DFF', '#6EE7F9', '#F472B6'];

function studioTrackHasMelodicKeyUi(tr: MockMusioTrack): boolean {
  if (!studioTrackOutputsMidi(tr)) return false;
  if (tr.kind === 'a2m' && studioNormalizeA2mMode(tr.a2mMode) === 'drums') return false;
  return true;
}

function studioTrackDetectedKey(tr: MockMusioTrack): {
  keyRoot?: number;
  keyMode?: StudioDetectedKeyMode;
} {
  if (tr.trackKeyRoot != null && tr.trackKeyMode) {
    return { keyRoot: tr.trackKeyRoot, keyMode: tr.trackKeyMode };
  }
  if (tr.a2mKeyRoot != null && tr.a2mKeyMode) {
    return { keyRoot: tr.a2mKeyRoot, keyMode: tr.a2mKeyMode };
  }
  return {};
}

function newTrackId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `t-${crypto.randomUUID()}`;
  }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Fresh Studio Editor 2 session — empty arrange lanes; Master bus lives in the mixer only. */
const MOCK_MUSIO_TRACKS: MockMusioTrack[] = [];

function cloneMockTracks(): MockMusioTrack[] {
  return MOCK_MUSIO_TRACKS.map((t) => ({
    ...t,
    notes: t.notes.map((n) => ({ ...n })),
    audioClips: t.audioClips.map((c) => ({ ...c })),
    rhythmSteps: t.rhythmSteps?.map((s) => ({ ...s })),
  }));
}

/** Deep snapshot for undo / clipboard (tracks after user edits â€” not just mock seed). */
function snapshotStudioTracks(tracks: MockMusioTrack[]): MockMusioTrack[] {
  return tracks.map((t) => ({
    ...t,
    notes: t.notes.map((n) => ({ ...n })),
    audioClips: t.audioClips.map((c) => ({ ...c })),
    harmonySteps: t.harmonySteps?.map((s) => ({ ...s })),
    rhythmSteps: t.rhythmSteps?.map((s) => ({ ...s })),
  }));
}

/** Notes / clips on a lane that "Clear lane" can wipe (track row stays). */
function se2TrackHasClearableLaneContent(tr: MockMusioTrack | undefined): boolean {
  if (!tr) return false;
  if (tr.kind === 'audio' || tr.kind === 'trackAlign') return tr.audioClips.length > 0;
  if (studioTrackOutputsMidi(tr)) return tr.notes.length > 0;
  return false;
}

const MIN_ZOOM = 0.5;
/** Largest track zoom — ~30.50× verified; higher values exceed browser canvas limits and blank the lane view. */
const MAX_ZOOM = 30.5;
const ZOOM_STEP = 0.125;
/** Default timeline / piano-roll horizontal zoom on open. */
const STUDIO_DEFAULT_ZOOM = 4;

function clampStudioZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

/** Seconds of audio the metronome tries to keep scheduled ahead of `currentTime`. */
const METRO_SCHEDULE_AHEAD_SEC = 3.0;
/**
 * Minimum lead for `OscillatorNode.start` vs `currentTime`.
 * Kept at 8 ms â€” small enough that metronome clicks fire almost simultaneously with the
 * visual playhead crossing each beat line (Pro Tools / Logic behaviour), yet large enough
 * to survive a Windows audio render-quantum without clipping the very first beat.
 */
const AUDIO_START_FLOOR_SEC = 0.008;
/**
 * Cold start keeps using {@link AUDIO_START_FLOOR_SEC}; loop *continuations* tighten this slightly.
 * Scheduling the first wrap click at ctSnap + 8 ms on top of cancelling all nodes reads as audible dead-air.
 */
const LOOP_METRO_CHAIN_FLOOR_SEC = 0.002;
/** Tiny spacing when batching many `start()` calls in one turn (must not pull beats off the grid). */
const METRO_NODE_EPS_SEC = 1e-5;
const MAX_METRO_SCHEDULE_PER_CALL = 256;
/** `TransportState.togglePlayPause` debounce (ms). */
const TOGGLE_DEBOUNCE_MS = 180;
/** `MetronomeSettings` / `TransportState` default metronome level — see `CREATION_METRO_VOLUME`. */
/** Default loop region `[start, end)` Ã¢â‚¬â€ configurable number of bars at current time signature. */
const LOOP_REGION_START_BEAT = 0;
function loopRegionEndBeat(beatsPerBar: number, loopBars: number): number {
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  return Math.min(totalBeatsForSig(bpb), bpb * Math.max(1, loopBars));
}
/** Keep playhead visible inside horizontal scroll (`MainWindowView` horizontal `ScrollView`). */
const TIMELINE_SCROLL_MARGIN_PX = 96;

/**
 * Playback follow scroll — pin playhead mid-viewport (not at the right edge). Engaging at the
 * right margin felt like a hard skip; pinning ~38% across is FL-style continuous scroll.
 */
const TIMELINE_FOLLOW_PIN_RATIO = 0.38;
/** Loop wrap re-entry lands at the visible grid start, under the Track View header landmark. */
const TIMELINE_LOOP_REENTRY_PIN_PX = 0;

/**
 * During follow, do NOT repaint the grid every few bars (that was the periodic jump).
 * Paint a large forward window rarely; only refill when scroll nears the painted end.
 * Grid *motion* is WAAPI (compositor) — same clock family as the playhead — so a refill
 * hitch must not freeze the strip translate. Waveform drawing is unchanged.
 */
const TIMELINE_FOLLOW_PAINT_BACK_PX = 160;
const TIMELINE_FOLLOW_PAINT_FWD_PX = 16000;
/** Refill when the right edge of the viewport is this close to the painted end. */
const TIMELINE_FOLLOW_PAINT_REARM_PX = 2400;

/**
 * Transform-only follow — scrollLeft stays frozen during play; the strip glides via translate3d.
 * Avoids scrollLeft + canvas marginLeft fights that read as playhead/grid shake.
 */
function applyTimelineTransformFollow(
  targetScrollLeft: number,
  laneStrip: HTMLElement | null,
  rulerStrip: HTMLElement | null,
  laneContent: HTMLElement | null,
  transformOriginRef: { current: number },
): { virtualScroll: number; offset: number } {
  const offset = targetScrollLeft - transformOriginRef.current;
  const tx = Math.abs(offset) > 1e-4 ? `translate3d(${-offset}px,0,0)` : '';
  if (laneStrip) laneStrip.style.transform = tx;
  if (rulerStrip) rulerStrip.style.transform = tx;
  if (laneContent) laneContent.style.transform = '';
  return { virtualScroll: targetScrollLeft, offset };
}

function clearTimelineFollowStripTransform(
  laneStrip: HTMLElement | null,
  rulerStrip: HTMLElement | null,
  laneContent: HTMLElement | null,
): void {
  if (laneStrip) laneStrip.style.transform = '';
  if (rulerStrip) rulerStrip.style.transform = '';
  if (laneContent) laneContent.style.transform = '';
}

/** Pixel-aligned beat column (same as `clipX = beats * pixelsPerBeat` in Musio `TimelineView`). */
function beatColumnLeftPx(beat: number, ppb: number): number {
  return Math.round(beat * ppb);
}

/** Read leftover follow translate (px) baked into strip.style.transform. */
function se2ReadStripFollowOffsetPx(strip: HTMLElement | null): number {
  if (!strip) return 0;
  const raw = strip.style.transform || '';
  if (!raw || raw === 'none') return 0;
  const m3d = raw.match(/translate3d\(\s*([-\d.]+)px/);
  if (m3d) {
    const tx = parseFloat(m3d[1]!);
    /* translate3d(-offset) → content X += offset */
    return Number.isFinite(tx) ? -tx : 0;
  }
  const mat = raw.match(/matrix\(([^)]+)\)/);
  if (mat) {
    const parts = mat[1]!.split(',').map((s) => parseFloat(s.trim()));
    if (parts.length >= 6 && Number.isFinite(parts[4]!)) return -parts[4]!;
  }
  return 0;
}

/** Bake leftover follow translate into scrollLeft, then clear transforms. */
function commitTimelineStripTransformToScroll(
  laneScroll: HTMLElement | null,
  rulerScroll: HTMLElement | null,
  barScroll: HTMLElement | null,
  laneStrip: HTMLElement | null,
  rulerStrip: HTMLElement | null,
  laneContent: HTMLElement | null,
): void {
  const off =
    se2ReadStripFollowOffsetPx(laneStrip) || se2ReadStripFollowOffsetPx(rulerStrip);
  if (Math.abs(off) >= 0.5) {
    const base = laneScroll?.scrollLeft ?? rulerScroll?.scrollLeft ?? 0;
    const committed = Math.max(0, Math.round(base + off));
    if (laneScroll) laneScroll.scrollLeft = committed;
    if (rulerScroll && rulerScroll.scrollLeft !== committed) rulerScroll.scrollLeft = committed;
    if (barScroll && barScroll.scrollLeft !== committed) barScroll.scrollLeft = committed;
  }
  clearTimelineFollowStripTransform(laneStrip, rulerStrip, laneContent);
}

/**
 * Absolute timeline content X from a screen click.
 * Prefer scroll-host + scrollLeft (stable on 1800-bar strips). Add any leftover
 * follow translate so math matches the painted grid.
 */
function se2TimelineXContentFromClient(
  clientX: number,
  scrollEl: HTMLElement | null,
  strip: HTMLElement | null = null,
): number {
  if (!scrollEl) return 0;
  const r = scrollEl.getBoundingClientRect();
  return clientX - r.left + scrollEl.scrollLeft + se2ReadStripFollowOffsetPx(strip);
}

function se2TimelineBeatFromClientX(
  clientX: number,
  scrollEl: HTMLElement | null,
  ppb: number,
  totalBeats: number,
  strip: HTMLElement | null = null,
): number {
  if (!scrollEl || !Number.isFinite(ppb) || ppb <= 0) return 0;
  const x = se2TimelineXContentFromClient(clientX, scrollEl, strip);
  return Math.max(0, Math.min(totalBeats, x / ppb));
}

function tracksSignature(tracks: MockMusioTrack[]): string {
  try {
    return `${tracks.length}|${JSON.stringify(
      tracks.map((t) => ({
        id: t.id,
        n: t.name,
        k: t.kind,
        ch: studioTrackOutputsMidi(t) ? (t.midiChannel ?? 0) : 0,
        inst: studioTrackOutputsMidi(t) ? (t.midiInstrumentId ?? '') : '',
        a2m: t.kind === 'a2m' ? (t.a2mMode ?? '') : '',
        a2bpm: t.kind === 'a2m' ? (t.a2mDetectedBpm ?? 0) : 0,
        a2key: t.kind === 'a2m' ? `${t.a2mKeyRoot ?? ''}:${t.a2mKeyMode ?? ''}` : '',
        tk: studioTrackHasMelodicKeyUi(t)
          ? `${t.trackKeyRoot ?? ''}:${t.trackKeyMode ?? ''}`
          : '',
        notes: t.notes,
        clips: t.audioClips,
        in: t.kind === 'audio' ? (t.audioInputDeviceId ?? '') : '',
      })),
    )}`;
  } catch {
    return String(tracks.length);
  }
}

/** Resolved MediaDevices `deviceId` for record / monitor (per-track override or project default). */
function effectiveAudioInputDeviceId(track: MockMusioTrack, projectDefaultDeviceId: string): string {
  if (track.kind !== 'audio') return projectDefaultDeviceId || 'default';
  const per = track.audioInputDeviceId?.trim();
  if (!per) return projectDefaultDeviceId || 'default';
  return per;
}

/** Clip length in quarter-note beats from file duration (FL / Studio Oneâ€“style wall clock at project BPM). */
function studioEditorVocoderCarrierTracks(tracks: MockMusioTrack[]): StudioVocoderCarrierTrack[] {
  return tracks.map((t) => ({
    name: t.name,
    kind: t.kind,
    notes: t.notes,
    a2mMode: t.a2mMode,
    midiChannel: t.midiChannel,
  }));
}

function audioDurationBeatsFromSeconds(durationSec: number, bpm: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 1 / 4;
  const spb = spbFromBpm(bpm);
  return Math.max(1 / 16, durationSec / spb);
}

function isDroppedAudioFile(f: File): boolean {
  const t = f.type ?? '';
  if (t.startsWith('audio/')) return true;
  return /\.(wav|mp3|ogg|aac|m4a|flac|opus|webm)$/i.test(f.name);
}

/** `subdivisionsPerBeat` â€” cells per quarter (1/4 â€¦ 1/128 straight + triplet 3 / 6); see `sharedPianoSnapSubdiv`. */
function snapBeatToSubdivision(b: number, subdivisionsPerBeat: number, totalBeats: number): number {
  const s = Math.max(1, Math.min(64, Math.round(subdivisionsPerBeat)));
  return Math.max(0, Math.min(totalBeats, Math.round(b * s) / s));
}

/** Duration in beats for one cell at the given snap value (same unit as startBeat). */
function oneCellDurationBeats(subdivisionsPerBeat: number): number {
  return 1 / Math.max(1, subdivisionsPerBeat);
}

/** Insert one snapped note on a MIDI lane (piano roll / timeline brush). Returns false if duplicate cell. */
function appendPianoGridNote(
  trackNotes: MockMidiNote[],
  x: number,
  y: number,
  ppb: number,
  snapSubdivisions: number,
  totalBeats: number,
  stripW: number,
  pitchView: PianoRollPitchView,
): MockMidiNote[] | null {
  const gridH = pianoGridHeightPx(pitchView);
  if (x < 0 || y < 0 || x > stripW || y > gridH) return null;
  const beat = snapBeatToSubdivision(x / ppb, snapSubdivisions, totalBeats);
  const row = Math.floor(y / pitchView.rowH);
  const pitch = pianoPitchForRow(pitchView, row);
  if (trackNotes.some((n) => n.pitch === pitch && Math.abs(n.startBeat - beat) < 1e-5)) return null;
  const dur = oneCellDurationBeats(snapSubdivisions);
  const nu: MockMidiNote = { pitch, startBeat: beat, durationBeats: dur, velocity: 100 };
  const working = [...trackNotes, nu];
  working.sort((a, b) => (a.startBeat !== b.startBeat ? a.startBeat - b.startBeat : a.pitch - b.pitch));
  return working;
}

function pianoGridBeatPitchFromXY(
  x: number,
  y: number,
  ppb: number,
  snapSubdivisions: number,
  totalBeats: number,
  stripW: number,
  gridH: number,
  pitchView: PianoRollPitchView,
): { beat: number; pitch: number } | null {
  if (x < 0 || y < 0 || x > stripW || y > gridH) return null;
  const beat = snapBeatToSubdivision(x / ppb, snapSubdivisions, totalBeats);
  const row = Math.floor(y / pitchView.rowH);
  const pitch = pianoPitchForRow(pitchView, row);
  return { beat, pitch };
}

/** Pencil drag on one pitch row â€” one sustained note from anchor beat through end beat (inclusive cells). */
function pencilLineSpanFromAnchor(
  anchorBeat: number,
  endBeat: number,
  snapSubdivisions: number,
  totalBeats: number,
): { startBeat: number; durationBeats: number } {
  const cellDur = oneCellDurationBeats(snapSubdivisions);
  const bLo = Math.min(anchorBeat, endBeat);
  const bHi = Math.max(anchorBeat, endBeat);
  const startBeat = snapBeatToSubdivision(bLo, snapSubdivisions, totalBeats);
  const endSnapped = snapBeatToSubdivision(bHi, snapSubdivisions, totalBeats);
  const durationBeats = Math.max(
    cellDur,
    Math.min(totalBeats - startBeat, endSnapped - startBeat + cellDur),
  );
  return { startBeat, durationBeats };
}

function resolvePencilStrokeNoteIndex(
  notes: MockMidiNote[],
  strokeNoteIdx: number,
  anchorPitch: number,
): number {
  if (strokeNoteIdx >= 0 && strokeNoteIdx < notes.length && notes[strokeNoteIdx]!.pitch === anchorPitch) {
    return strokeNoteIdx;
  }
  return notes.findIndex((n) => n.pitch === anchorPitch);
}

function applyPencilLineToNotes(
  notes: MockMidiNote[],
  strokeNoteIdx: number,
  anchorBeat: number,
  anchorPitch: number,
  endBeat: number,
  snapSubdivisions: number,
  totalBeats: number,
): MockMidiNote[] | null {
  const idx = resolvePencilStrokeNoteIndex(notes, strokeNoteIdx, anchorPitch);
  if (idx < 0) return null;
  const { startBeat, durationBeats } = pencilLineSpanFromAnchor(
    anchorBeat,
    endBeat,
    snapSubdivisions,
    totalBeats,
  );
  return notes.map((n, i) =>
    i === idx ? { ...n, startBeat, durationBeats, pitch: anchorPitch } : n,
  );
}

/** DAW-style stepped control: button opens a fixed menu (portal) so it works inside `overflow: hidden` layouts. */
type DawMiniMenuOption = { value: number; label: string };

type DawMiniMenuProps = {
  label: string;
  displayText: string;
  value: number;
  options: DawMiniMenuOption[];
  onChange: (value: number) => void;
  disabled?: boolean;
  title?: string;
  /** Tighter padding for piano toolbar vs footer. */
  compact?: boolean;
  /** Piano roll toolbar â€” margin between boxed controls (rhythm-edit 1Ã—/2Ã— style). */
  toolbarChip?: boolean;
};

function DawMiniMenu({
  label,
  displayText,
  value,
  options,
  onChange,
  disabled,
  title,
  compact,
  toolbarChip,
}: DawMiniMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Close on outside mousedown */
  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (!open && btnRef.current && typeof window !== 'undefined') {
      /* Calculate popup position before the state update so it renders correctly on first paint */
      const r = btnRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const minW = Math.max(r.width, compact ? 80 : 96);
      let left = r.left;
      if (left + minW > vw - 8) left = Math.max(8, vw - minW - 8);
      const spaceAbove = r.top - 8;
      const spaceBelow = vh - r.bottom - 8;
      const maxH = Math.min(320, Math.max(80, spaceAbove >= spaceBelow ? spaceAbove : spaceBelow));
      const style: React.CSSProperties =
        spaceAbove >= spaceBelow
          ? { position: 'fixed', bottom: vh - r.top + 2, left, minWidth: minW, maxHeight: maxH, zIndex: 30000 }
          : { position: 'fixed', top: r.bottom + 2, left, minWidth: minW, maxHeight: maxH, zIndex: 30000 };
      setMenuStyle(style);
    }
    setOpen((o) => !o);
  };

  const menuEl = open ? (
    <div
      ref={menuRef}
      role="listbox"
      aria-label={title ?? label}
      data-studio-daw-mini-menu
      className="rounded border py-1 shadow-2xl overflow-y-auto"
      style={{
        ...menuStyle,
        borderColor: '#4a4a58',
        background: '#1e1e2a',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
      }}
    >
      {options.map((opt) => {
        const sel = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={sel}
            onClick={() => { onChange(opt.value); setOpen(false); }}
            className="block w-full text-left font-mono font-semibold transition-none"
            style={{
              padding: compact ? '6px 12px' : '8px 14px',
              fontSize: compact ? 11 : 13,
              color: sel ? '#7cf4c6' : '#d0d0de',
              background: sel ? 'rgba(124,244,198,0.14)' : 'transparent',
              borderLeft: sel ? '2px solid #7cf4c6' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div
      className={`flex items-center gap-1 shrink-0 select-none ${toolbarChip ? 'pr-toolbar-chip' : ''} ${compact ? 'text-[9px]' : 'text-[10px]'}`}
      style={{ color: '#8a8a98' }}
    >
      <span className="font-semibold uppercase shrink-0" style={{ color: '#6a6a78' }}>{label}</span>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        title={title}
        aria-label={title ?? `${label} menu`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={openMenu}
        className={`flex items-center justify-between gap-0.5 rounded border font-mono font-bold outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-xs'
        }`}
        style={{
          borderColor: open ? '#5a5a6a' : '#3a3a46',
          background: open ? '#252530' : '#1c1c24',
          color: '#b0b0be',
          minWidth: compact ? '3.75rem' : '3.5rem',
        }}
      >
        <span className="tabular-nums">{displayText}</span>
        <ChevronDown size={compact ? 10 : 12} strokeWidth={2} className="shrink-0 opacity-70" aria-hidden
          style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.12s ease' }} />
      </button>
      {menuEl && typeof document !== 'undefined' ? createPortal(menuEl, document.body) : null}
    </div>
  );
}

function gridLineXCss(idx: number, zoom: number, beatsPerBar: number): number {
  return Math.round(idx * ppbAtZoom(zoom, beatsPerBar));
}

/** Exact sub-pixel horizontal position of the playhead (no rounding Ã¢â‚¬â€ avoids 0/1px alternating skip). */
function beatToPlayheadX(beat: number, zoom: number, beatsPerBar: number): number {
  const tb = totalBeatsForSig(beatsPerBar);
  const b = Math.max(0, Math.min(beat, tb));
  return b * ppbAtZoom(zoom, beatsPerBar);
}

function scrollTimelineToPlayhead(
  scrollEl: HTMLElement | null,
  beat: number,
  zoom: number,
  beatsPerBar: number,
  extraScrollEls: (HTMLElement | null)[] = [],
): void {
  const apply = (el: HTMLElement | null) => {
    if (!el) return;
    const x = beatToPlayheadX(beat, zoom, beatsPerBar);
    const pad = TIMELINE_SCROLL_MARGIN_PX;
    const w = el.clientWidth;
    const sl = el.scrollLeft;
    if (x < sl + pad) {
      const next = Math.max(0, x - pad);
      if (Math.abs(next - sl) >= 1) el.scrollLeft = next;
    } else if (x > sl + w - pad) {
      const next = Math.max(0, x - w + pad);
      if (Math.abs(next - sl) >= 1) el.scrollLeft = next;
    }
  };
  apply(scrollEl);
  for (const el of extraScrollEls) apply(el);
}

function quarterIndexFromBeat(b: number, totalBeats: number): number {
  return Math.max(0, Math.min(Math.floor(b + 1e-9), totalBeats));
}

function snapBeatToQuarterGrid(b: number, totalBeats: number): number {
  return Math.max(0, Math.min(quarterIndexFromBeat(b, totalBeats), totalBeats));
}

/** Snap ruler click to the nearest 1·2·3·4 beat line (integer beats). */
function snapBeatToNearestBeatLine(b: number, totalBeats: number): number {
  return Math.max(0, Math.min(totalBeats, Math.round(b)));
}

/** Snap clip start to bar downbeats (Shift while dragging). */
function snapBeatToBarGrid(b: number, beatsPerBar: number, totalBeats: number): number {
  const bpb = Math.max(1, beatsPerBar);
  const bar = Math.round(b / bpb);
  return Math.max(0, Math.min(totalBeats, bar * bpb));
}

/** Timeline audio-clip drag snap — grid ticks by default; Shift = bar, Alt = free. */
function snapTimelineAudioClipStartBeat(
  rawBeat: number,
  totalBeats: number,
  beatsPerBar: number,
  snapSubdiv: number,
  shiftKey: boolean,
  altKey: boolean,
): number {
  if (altKey) return Math.max(0, Math.min(totalBeats, rawBeat));
  if (shiftKey) return snapBeatToBarGrid(rawBeat, beatsPerBar, totalBeats);
  return snapBeatToSubdivision(rawBeat, snapSubdiv, totalBeats);
}

function timelineAudioClipInnerRect(
  track: MockMusioTrack,
  clip: StudioAudioClip,
  laneTop: number,
  laneH: number,
  ppb: number,
): { x: number; y: number; w: number; h: number; r: number } {
  const strip = laneAudioClipStripMetrics(track, laneH);
  if (!strip) return { x: 0, y: 0, w: 0, h: 0, r: 0 };
  const fillLane = se2TrackIsAudioClipLane(track.kind);
  const innerTop = laneTop + strip.top + (fillLane ? 1 : 3);
  const innerH = Math.max(4, strip.height - (fillLane ? 2 : 6));
  const x0 = beatColumnLeftPx(clip.startBeat, ppb);
  const x1 = beatColumnLeftPx(clip.startBeat + clip.durationBeats, ppb);
  return { x: x0, y: innerTop, w: Math.max(3, x1 - x0), h: innerH, r: 2 };
}

function strokeTimelineLaneSelectedAudioClip(
  g: CanvasRenderingContext2D,
  track: MockMusioTrack,
  clipId: string,
  laneTop: number,
  laneH: number,
  ppb: number,
  showGainReadout = false,
): void {
  const clip = track.audioClips.find((c) => c.id === clipId);
  if (!clip) return;
  const { x, y, w, h, r } = timelineAudioClipInnerRect(track, clip, laneTop, laneH, ppb);
  if (w < 2 || h < 2) return;
  g.save();
  g.shadowColor = 'rgba(124,244,198,0.55)';
  g.shadowBlur = 6;
  g.strokeStyle = '#7cf4c6';
  g.lineWidth = 2;
  if (typeof g.roundRect === 'function') {
    g.beginPath();
    g.roundRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1), r);
    g.stroke();
  } else {
    g.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  }
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = 1;
  g.shadowBlur = 0;
  if (typeof g.roundRect === 'function') {
    g.beginPath();
    g.roundRect(x + 1, y + 1, Math.max(0, w - 3), Math.max(0, h - 3), Math.max(0, r - 0.5));
    g.stroke();
  }
  g.restore();
  if (se2TrackIsTrackAlign(track.kind) && w >= 12) {
    const handleW = Math.min(4, Math.max(3, Math.floor(w * 0.06)));
    const handleH = Math.min(h - 4, Math.max(8, Math.floor(h * 0.55)));
    const hy = y + (h - handleH) * 0.5;
    g.fillStyle = 'rgba(110,231,249,0.92)';
    g.fillRect(x + 2, hy, handleW, handleH);
    g.fillRect(x + w - handleW - 2, hy, handleW, handleH);
  }
  /* Clip gain handle + dB readout (DAW event volume). */
  if (w >= 28 && h >= 14) {
    const midY = y + h * 0.5;
    const lineL = x + Math.min(10, w * 0.12);
    const lineR = x + w - Math.min(10, w * 0.12);
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 1;
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(lineL, midY + 0.5);
    g.lineTo(lineR, midY + 0.5);
    g.stroke();
    g.setLineDash([]);
    const knobR = 3.5;
    g.fillStyle = 'rgba(255, 107, 107, 0.95)';
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc((lineL + lineR) * 0.5, midY, knobR, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    const gainDb = clip.gainDb ?? 0;
    if (Math.abs(gainDb) >= 0.05 || showGainReadout) {
      const label = formatSe2ClipGainDb(gainDb);
      g.font = '700 9px ui-sans-serif, system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillText(label, (lineL + lineR) * 0.5 + 0.5, midY - knobR - 2.5);
      g.fillStyle = '#ffd0d0';
      g.fillText(label, (lineL + lineR) * 0.5, midY - knobR - 3);
    }
    g.restore();
  }
}

function spbFromBpm(bpm: number): number {
  return 60 / Math.max(1, bpm);
}

function se2TrackPlaybackInput(
  ctx: AudioContext,
  masterBus: GainNode,
  trackIndex: number,
  slots: [MixerEffectId, MixerEffectId, MixerEffectId],
  rack: StudioTrackInsertFxRack,
  bpm: number,
  masterOut: AudioNode,
): GainNode {
  return resolveStudioTrackPlaybackInput(
    ctx,
    masterBus,
    trackIndex,
    Math.max(getStudioMixerStripCountHint(), trackIndex + 1),
    slots,
    rack,
    bpm,
    masterOut,
  );
}

function ensureSe2MixerStrips(ctx: AudioContext, bus: GainNode, masterOut: AudioNode): boolean {
  const n = getStudioMixerStripCountHint();
  const rebuilt = ensureStudioMixerStrips(ctx, bus, n, masterOut);
  if (rebuilt && !isStudioMixerStripGraphPlaybackLocked()) {
    resyncStudioTrackInsertFxStripInputs(ctx, bus, n, masterOut);
  }
  return rebuilt;
}

function midiNoteToFreqHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** L/R metering weights from MIDI-style pan (0=left, 64=centre, 127=right); mono â‡’ equal. */
function mixerPanMeterWeights(pan127: number, mono: boolean): { wl: number; wr: number } {
  if (mono) return { wl: 1, wr: 1 };
  const p = Math.max(-1, Math.min(1, ((pan127 - 64) / 63))); // StereoPannerNode law
  const theta = ((p + 1) / 2) * (Math.PI / 2);
  return { wl: Math.cos(theta), wr: Math.sin(theta) };
}

/** Short triangle preview (Musio-style track audition) Ã¢â‚¬â€ same clock as transport `sessionStart` + beats. */
function playScheduledMidiNote(
  ctx: AudioContext,
  stripInput: GainNode,
  t0: number,
  t1: number,
  pitch: number,
  velocity01: number,
  _trackIndex = -1,
): void {
  const dur = Math.max(0.04, t1 - t0);
  const peak = Math.min(0.2, (0.035 + Math.max(0, Math.min(1, velocity01)) * 0.16) * 0.42);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  const g = ctx.createGain();
  osc.frequency.setValueAtTime(midiNoteToFreqHz(pitch), t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.006);
  g.gain.linearRampToValueAtTime(peak * 0.55, t0 + dur * 0.35);
  g.gain.linearRampToValueAtTime(0.0001, t1);
  osc.connect(g);
  g.connect(stripInput);
  osc.start(t0);
  osc.stop(t1 + 0.02);
  osc.onended = () => {
    try {
      osc.disconnect();
      g.disconnect();
    } catch {
      /* */
    }
  };
}

type ScheduledPreviewAudioClip = {
  src: AudioBufferSourceNode;
  trackIndex: number;
  scheduleKey?: string;
  /** Absolute `AudioContext` time passed to `src.start`. */
  startTime?: number;
  endTime?: number;
  liveCleanup?: () => void;
};

function stopScheduledPreviewAudioClips(
  clips: ScheduledPreviewAudioClip[],
  onlyTrackIndex?: number,
): void {
  for (let i = clips.length - 1; i >= 0; i--) {
    const clip = clips[i]!;
    if (onlyTrackIndex != null && clip.trackIndex !== onlyTrackIndex) continue;
    clip.liveCleanup?.();
    try {
      clip.src.stop(0);
    } catch {
      /* */
    }
    try {
      clip.src.disconnect();
    } catch {
      /* */
    }
    clips.splice(i, 1);
  }
}

/**
 * Loop wrap — stop previous-lap sources that already started.
 * Not-yet-started lookahead (next downbeat) is kept and re-keyed by
 * {@link se2AudioPreviewAdoptFutureLoopLapClips} so wrap does not chop bar 1.
 */
function stopScheduledPreviewAudioClipsForLoopLap(
  clips: ScheduledPreviewAudioClip[],
  lapIndex: number,
  audioNow: number,
): void {
  const prefix = `lap${lapIndex}:audio:`;
  for (let i = clips.length - 1; i >= 0; i--) {
    const clip = clips[i]!;
    const key = clip.scheduleKey;
    if (!key?.startsWith(prefix)) continue;
    if (!se2AudioPreviewLapClipHasStarted(clip, audioNow)) continue;
    clip.liveCleanup?.();
    try {
      clip.src.stop(0);
    } catch {
      /* */
    }
    try {
      clip.src.disconnect();
    } catch {
      /* */
    }
    clips.splice(i, 1);
  }
}

/**
 * Loop wrap after approaching a mid-song region — kill full-clip BufferSources that used
 * non-lap schedule keys. Those keep playing past the braces and stack under lap slices.
 */
function stopScheduledPreviewAudioClipsNonLap(clips: ScheduledPreviewAudioClip[]): void {
  for (let i = clips.length - 1; i >= 0; i--) {
    const clip = clips[i]!;
    const key = clip.scheduleKey;
    if (key && se2AudioPreviewIsLoopLapKey(key)) continue;
    clip.liveCleanup?.();
    try {
      clip.src.stop(0);
    } catch {
      /* */
    }
    try {
      clip.src.disconnect();
    } catch {
      /* */
    }
    clips.splice(i, 1);
  }
}

/**
 * Schedule one segment of an arranger audio clip on the same preview bus / pan law as
 * {@link playScheduledMidiNote} (Studio Oneâ€“style track â†’ mixer path).
 */
function scheduleAudioClipOnPreviewBus(params: {
  ctx: AudioContext;
  bus: GainNode;
  buffer: AudioBuffer;
  tClipStart: number;
  tClipEnd: number;
  tScheduleFrom: number;
  pan127: number;
  monoTrack: boolean;
  faderVol127: number;
  tracking: ScheduledPreviewAudioClip[];
  insertSlots?: [MixerEffectId, MixerEffectId, MixerEffectId];
  insertRack?: StudioTrackInsertFxRack;
  bpm?: number;
  pitchMonitorTrackIndex?: number;
  /** Live Pitch Tune / Vocoder â€” real-time graph (dry buffer + Web Audio chain). */
  useLiveVocalFx?: boolean;
  vocalFx?: StudioTrackVocalFx;
  keyRoot?: number;
  vocalTrackIndex?: number;
  carrierTracks?: readonly StudioVocoderCarrierTrack[];
  clipStartBeat?: number;
  clipDurationBeats?: number;
  /** Offset into `buffer` (seconds) where audible clip content begins. */
  sourceOffsetSec?: number;
  /** Wall-clock length of clip region on timeline (seconds). */
  clipWallDurationSec?: number;
  /** Track Align — pitch-stable tempo lock to timeline grid. */
  timeStretchAlign?: boolean;
  /** Trim mode locked stretch ratio (Track Align edge without Shift). */
  alignLockedStretchRate?: number;
  scheduleKey?: string;
  /** Per-clip event gain in dB (0 = unity). */
  gainDb?: number;
}): void {
  const {
    ctx,
    bus,
    buffer,
    tClipStart,
    tClipEnd,
    tScheduleFrom,
    pan127,
    monoTrack,
    faderVol127,
    tracking,
    insertSlots,
    insertRack,
    bpm = 120,
    pitchMonitorTrackIndex = -1,
    useLiveVocalFx = false,
    vocalFx,
    keyRoot = 0,
    vocalTrackIndex = 0,
    carrierTracks = [],
    clipStartBeat = 0,
    clipDurationBeats = 4,
    sourceOffsetSec = 0,
    clipWallDurationSec,
    timeStretchAlign = false,
    alignLockedStretchRate,
    scheduleKey,
    gainDb = 0,
  } = params;
  const tPlay = Math.max(tClipStart, tScheduleFrom);
  if (tPlay >= tClipEnd - 1e-4) return;
  const wallDur = clipWallDurationSec ?? Math.max(0.02, tClipEnd - tClipStart);
  const timelineOffSec = Math.max(0, tPlay - tClipStart);
  if (timelineOffSec >= wallDur - 1e-4) return;
  const wallRemain = wallDur - timelineOffSec;
  const clipGain = se2ClipPreviewGainLin(gainDb);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  let bufferOffSec = sourceOffsetSec + timelineOffSec;
  let playSec = Math.max(0.02, Math.min(wallRemain, buffer.duration - bufferOffSec, tClipEnd - tPlay));
  if (timeStretchAlign) {
    const aligned = se2TrackAlignPlaybackForWallSegment({
      bufferDurationSec: buffer.duration,
      sourceOffsetSec,
      clipWallDurationSec: wallDur,
      timelineOffsetSec: timelineOffSec,
      wallRemainSec: wallRemain,
      lockedStretchRate: alignLockedStretchRate,
    });
    src.playbackRate.value = aligned.playbackRate;
    src.detune.value = aligned.detuneCents;
    bufferOffSec = aligned.bufferOffsetSec;
    playSec = aligned.bufferPlaySec;
  } else {
    const bufRemain = Math.max(0, buffer.duration - sourceOffsetSec - timelineOffSec);
    playSec = Math.max(0.02, Math.min(wallRemain, bufRemain, tClipEnd - tPlay));
    bufferOffSec = sourceOffsetSec + timelineOffSec;
  }
  const g = ctx.createGain();
  g.gain.value = clipGain;
  src.connect(g);
  const dest = bus;

  const finishSource = (liveCleanup?: () => void) => {
    src.start(tPlay, bufferOffSec, playSec);
    const clipEntry: ScheduledPreviewAudioClip = {
      src,
      trackIndex: pitchMonitorTrackIndex,
      scheduleKey,
      startTime: tPlay,
      endTime: tPlay + playSec,
      liveCleanup,
    };
    tracking.push(clipEntry);
    src.onended = () => {
      liveCleanup?.();
      try {
        src.disconnect();
        g.disconnect();
      } catch {
        /* */
      }
      const ix = tracking.findIndex((c) => c.src === src);
      if (ix !== -1) tracking.splice(ix, 1);
    };
  };

  if (useLiveVocalFx && vocalFx && studioUseLiveVocalFxPlayback(vocalFx)) {
    g.connect(dest);
    finishSource();
    return;
  }

  g.connect(dest);
  finishSource();
}

/** Piano-strip one-shot audition through preview bus â€” respects pan + mono like scheduled notes. */
function previewMidiKeyThroughBus(
  ctx: AudioContext,
  outputBus: GainNode,
  pitch: number,
  velocity01: number,
  durationSec: number,
  pan127: number,
  monoTrack: boolean,
  faderLinearGain = 1,
): void {
  const now = ctx.currentTime + 0.004;
  const end = now + durationSec;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  const gn = ctx.createGain();
  const peak = Math.min(0.2, (0.05 + Math.max(0, Math.min(1, velocity01)) * 0.16) * faderLinearGain);
  osc.frequency.setValueAtTime(midiNoteToFreqHz(pitch), now);
  gn.gain.setValueAtTime(peak, now);
  gn.gain.exponentialRampToValueAtTime(0.02, end);
  osc.connect(gn);
  let panner: StereoPannerNode | null = null;
  if (!monoTrack) {
    panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, (pan127 - 64) / 63));
    gn.connect(panner);
    panner.connect(outputBus);
  } else {
    gn.connect(outputBus);
  }
  osc.start(now);
  osc.stop(end + 0.02);
  osc.onended = () => {
    try {
      osc.disconnect();
      gn.disconnect();
      panner?.disconnect();
    } catch {
      /* */
    }
  };
}

function nextMidiTrackName(tracks: MockMusioTrack[]): string {
  let maxN = 0;
  for (const t of tracks) {
    const m = /^MIDI\s+(\d+)\s*$/i.exec(t.name.trim());
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return `MIDI ${maxN + 1}`;
}

function nextAudioTrackName(tracks: MockMusioTrack[]): string {
  let maxN = 0;
  for (const t of tracks) {
    const m = /^Audio\s+(\d+)\s*$/i.exec(t.name.trim());
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return `Audio ${maxN + 1}`;
}

function nextTrackAlignTrackName(tracks: MockMusioTrack[]): string {
  let maxN = 0;
  for (const t of tracks) {
    const m = /^Track Align(?:\s+(\d+))?\s*$/i.exec(t.name.trim());
    if (m) maxN = Math.max(maxN, m[1] ? parseInt(m[1], 10) : 1);
  }
  return maxN === 0 ? 'Track Align' : `Track Align ${maxN + 1}`;
}

function nextA2mTrackName(tracks: MockMusioTrack[]): string {
  let maxN = 0;
  for (const t of tracks) {
    const m = /^A2M\s+(\d+)\s*$/i.exec(t.name.trim());
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return `A2M ${maxN + 1}`;
}

function nextRhythmTrackName(tracks: MockMusioTrack[]): string {
  let maxN = 0;
  for (const t of tracks) {
    const m = /^Rhythm\s+(\d+)\s*$/i.exec(t.name.trim());
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return `Rhythm ${maxN + 1}`;
}

function nextDrumsTrackName(tracks: MockMusioTrack[]): string {
  let maxN = 0;
  for (const t of tracks) {
    const name = t.name.trim().toLowerCase();
    if (name === 'drums') maxN = Math.max(maxN, 1);
    const m = /^drums\s+(\d+)\s*$/i.exec(t.name.trim());
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return maxN === 0 ? 'Drums' : `Drums ${maxN + 1}`;
}

function composePromptFromStackRole(part: GenoDuoPartKind | Se2SynthGenoRole | undefined): string {
  switch (part) {
    case 'bass':
      return '808 bass tight and punchy';
    case 'keys':
    case 'chords':
      return 'warm electric keys';
    case 'strings':
    case 'pad':
      return 'wide string pad soft attack';
    case 'lead':
      return 'bright lead synth';
    default:
      return 'synth geno stack part';
  }
}

function beatAtTime(t: number, sessionStart: number, originBeat: number, bpm: number, totalBeats: number): number {
  const spb = spbFromBpm(bpm);
  const b = originBeat + Math.max(0, t - sessionStart) / spb;
  return Math.max(0, Math.min(totalBeats, b));
}

function audioNow(ctx: AudioContext): number {
  return Math.max(0, ctx.currentTime);
}

/**
 * Sub-millisecond scheduling-domain clock.
 *
 * Problem: AudioContext.currentTime advances in ~2.9 ms render quanta.
 * Reading it each 16 ms RAF frame gives the same value 5Ã¢â‚¬â€œ6 frames Ã¢â€ â€™ visible jump.
 *
 * Solution (scheduling-domain anchor tracking):
 *   Every time ctx.currentTime advances (a new render quantum arrives), we record BOTH
 *   the new ctx.currentTime AND the performance.now() at that exact moment.
 *   Between advances, we extrapolate forward using performance.now() (sub-ms precision).
 *
 * This stays entirely in the SCHEDULING domain Ã¢â‚¬â€ the same domain used by sessionStartRef,
 *   originBeatRef, and all audio node scheduling calls Ã¢â‚¬â€ so there is no clock mismatch.
 *
 * IMPORTANT: call updateSchedAnchor(ctx, anchorTime, anchorPerf) every RAF frame BEFORE
 *   calling smoothSchedNow(anchorTime, anchorPerf).
 */
function updateSchedAnchor(
  ctx: AudioContext,
  anchorTimeRef: React.MutableRefObject<number>,
  anchorPerfRef: React.MutableRefObject<number>,
): void {
  const t = ctx.currentTime;
  if (t > anchorTimeRef.current) {
    /* ctx.currentTime just advanced Ã¢â‚¬â€ lock in a fresh high-res anchor. */
    anchorTimeRef.current = t;
    anchorPerfRef.current = performance.now();
  }
}

function smoothSchedNow(
  anchorTimeRef: React.MutableRefObject<number>,
  anchorPerfRef: React.MutableRefObject<number>,
  ctx: AudioContext,
): number {
  if (anchorTimeRef.current > 0) {
    return anchorTimeRef.current + (performance.now() - anchorPerfRef.current) / 1000;
  }
  return Math.max(0, ctx.currentTime);
}

type ElementWithVfc = HTMLElement & {
  requestVideoFrameCallback: (callback: VideoFrameRequestCallback) => number;
  cancelVideoFrameCallback: (handle: number) => void;
};

/** `Metronome.generateClickBuffer` Ã¢â‚¬â€ sine Ãƒâ€” exponential decay. */
function createMusioClickBuffer(
  ctx: AudioContext,
  frequencyHz: number,
  durationSec: number,
  peakLevel: number,
): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.max(1, Math.floor(sr * durationSec));
  const buf = ctx.createBuffer(1, n, sr);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const envelope = Math.exp(-t * 50);
    ch[i] = Math.sin(2 * Math.PI * frequencyHz * t) * envelope * peakLevel;
  }
  return buf;
}

function formatBarsBeatsTicks(displayBeats: number, beatsPerBar: number): string {
  const bar = Math.floor(displayBeats / beatsPerBar) + 1;
  const beatInBar = Math.floor(displayBeats % beatsPerBar) + 1;
  const tick = Math.floor((displayBeats % 1) * 100);
  return `${String(bar).padStart(2, '0')}.${beatInBar}.${String(tick).padStart(2, '0')}`;
}

function formatBarsBeatsTickParts(displayBeats: number, beatsPerBar: number): {
  bar: string;
  beat: string;
  tick: string;
} {
  const bar = Math.floor(displayBeats / beatsPerBar) + 1;
  const beatInBar = Math.floor(displayBeats % beatsPerBar) + 1;
  const tick = Math.floor((displayBeats % 1) * 100);
  return {
    bar: String(bar).padStart(2, '0'),
    beat: String(beatInBar),
    tick: String(tick).padStart(2, '0'),
  };
}

/** Snap to centisecond ticks — stops audio-clock micro-jitter from flickering the readout. */
function quantizeSe2DisplayBeatForReadout(displayBeats: number): number {
  return Math.floor(Math.max(0, displayBeats) * 100) / 100;
}

function paintSe2TransportReadoutEl(el: HTMLSpanElement | null, next: string): void {
  if (!el || el.textContent === next) return;
  el.textContent = next;
}

function paintSe2BarsReadoutSegments(
  refs: {
    bar: HTMLSpanElement | null;
    beat: HTMLSpanElement | null;
    tick: HTMLSpanElement | null;
    pause?: HTMLSpanElement | null;
  },
  parts: { bar: string; beat: string; tick: string },
  pausedLabel: boolean,
): void {
  paintSe2TransportReadoutEl(refs.bar, parts.bar);
  paintSe2TransportReadoutEl(refs.beat, parts.beat);
  paintSe2TransportReadoutEl(refs.tick, parts.tick);
  if (refs.pause) {
    paintSe2TransportReadoutEl(refs.pause, pausedLabel ? 'pause' : '');
  }
}

function paintSe2TimeReadoutSegments(
  refs: {
    minutes: HTMLSpanElement | null;
    seconds: HTMLSpanElement | null;
    frames: HTMLSpanElement | null;
  },
  parts: { minutes: string; seconds: string; frames: string },
): void {
  paintSe2TransportReadoutEl(refs.minutes, parts.minutes);
  paintSe2TransportReadoutEl(refs.seconds, parts.seconds);
  paintSe2TransportReadoutEl(refs.frames, parts.frames);
}

/** `TransportView` timeDisplay Ã¢â‚¬â€ MM:SS:centiseconds */
function formatTimeMmSsFf(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  const f = Math.floor((totalSeconds % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

function formatTimeMmSsFfParts(totalSeconds: number): {
  minutes: string;
  seconds: string;
  frames: string;
} {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  const f = Math.floor((totalSeconds % 1) * 100);
  return {
    minutes: String(m).padStart(2, '0'),
    seconds: String(s).padStart(2, '0'),
    frames: String(f).padStart(2, '0'),
  };
}

/** `Color(hex:)` + `velocityAdjustedColor` in `TimelineView.swift` / `MIDINotePreview`. */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '').trim();
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (!Number.isFinite(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbaNoteFill(colorHex: string, velocity: number): string {
  const rgb = hexToRgb(colorHex);
  const intensity = Math.max(0, Math.min(1, velocity / 127));
  const a = 0.6 + intensity * 0.4;
  if (!rgb) return `rgba(91, 140, 255, ${a})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
}

function paddedPitchRange(notes: MockMidiNote[], emptyDefault?: { min: number; max: number }): { min: number; max: number } {
  if (notes.length === 0) return emptyDefault ?? { min: 60, max: 72 };
  let minP = 127;
  let maxP = 0;
  for (const n of notes) {
    minP = Math.min(minP, n.pitch);
    maxP = Math.max(maxP, n.pitch);
  }
  const pad = 2;
  return {
    min: Math.max(0, minP - pad),
    max: Math.min(127, maxP + pad),
  };
}

/** Per-track piano roll pitch window â€” fits all notes in the visible grid without vertical scroll. */
type PianoRollPitchView = {
  pitchLo: number;
  pitchHi: number;
  rowH: number;
  /** Non-contiguous rows (Beat Pads — one row per pad). */
  rowPitches?: readonly number[];
};

function pianoPitchRowCount(v: PianoRollPitchView): number {
  if (v.rowPitches?.length) return v.rowPitches.length;
  return v.pitchHi - v.pitchLo + 1;
}

function pianoPitchForRow(v: PianoRollPitchView, row: number): number {
  if (v.rowPitches?.length) {
    const r = Math.max(0, Math.min(v.rowPitches.length - 1, row));
    return v.rowPitches[r]!;
  }
  const rows = v.pitchHi - v.pitchLo + 1;
  const r = Math.max(0, Math.min(rows - 1, row));
  return v.pitchHi - r;
}

function pianoRowIndexForPitch(v: PianoRollPitchView, pitch: number): number {
  if (v.rowPitches?.length) {
    const idx = v.rowPitches.indexOf(pitch);
    if (idx >= 0) return idx;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < v.rowPitches.length; i += 1) {
      const d = Math.abs(v.rowPitches[i]! - pitch);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }
  return v.pitchHi - pitch;
}

const PIANO_PITCH_VIEW_MIN_ROWS = 12;
const PIANO_ROW_H_MIN = 20;
const PIANO_ROW_H_MAX = 38;
/** Rhythm-edit chord strip above the roll â€” used when estimating grid height. */
const PIANO_RHYTHM_EDIT_CHROME_PX = 118;
/** Bass Glide docked synth strip above the roll (see Se2GlideBassDockedPanel). */
const PIANO_GLIDE_BASS_EDIT_CHROME_PX = SE2_GLIDE_BASS_DOCKED_CHROME_PX;
/** Synth Geno docked builder strip above the roll. */
const PIANO_SYNTH_GENO_EDIT_CHROME_PX = SE2_SYNTH_GENO_DOCKED_CHROME_PX;
/** Groove Lead docked synth strip above the roll. */
const PIANO_GROOVE_LEAD_EDIT_CHROME_PX = SE2_GROOVE_LEAD_DOCKED_CHROME_PX;
/** 808 Lab docked synth strip above the roll. */
const PIANO_LAB808_EDIT_CHROME_PX = SE2_LAB808_DOCKED_CHROME_PX;
const PIANO_GENO_ULTRA_EDIT_CHROME_PX = SE2_GENO_ULTRA_DOCKED_CHROME_PX;
const PIANO_GENO_BASS_EDIT_CHROME_PX = SE2_GENO_BASS_DOCKED_CHROME_PX;
/** Drum Generator docked panel above the roll. */
const PIANO_DRUM_GENERATOR_EDIT_CHROME_PX = SE2_DRUM_GENERATOR_DOCKED_CHROME_PX;
const PIANO_CHORD_GENIE_EDIT_CHROME_PX = PIANO_GENO_CHORD_CREATOR_DOCK_CHROME_PX;
const PIANO_BEAT_PADS_EDIT_CHROME_PX = SE2_BEAT_PADS_DOCKED_MAX_PX;
/** Hum Capture docked panel above the roll. */
const PIANO_HUM_CAPTURE_EDIT_CHROME_PX = SE2_HUM_CAPTURE_DOCKED_CHROME_PX;
const PIANO_GUITAR_EDIT_CHROME_PX = SE2_GUITAR_DOCKED_CHROME_PX;

function pianoGridHeightPx(v: PianoRollPitchView): number {
  return pianoPitchRowCount(v) * v.rowH;
}

function estimatePianoGridAvailPx(
  panelHeight: number,
  expanded: boolean,
  viewportH: number,
  rhythmEditChromePx = 0,
  velocityLaneOpen = false,
): number {
  const toolbarAndChrome = expanded ? 124 : PIANO_TOOLBAR_CHROME_PX;
  const velocityChrome = velocityLaneOpen ? PIANO_VELOCITY_LANE_H_PX : PIANO_VELOCITY_TOGGLE_H_PX;
  const chrome =
    PIANO_RULER_H_PX +
    velocityChrome +
    toolbarAndChrome +
    Math.max(0, rhythmEditChromePx) +
    (expanded ? 0 : PIANO_ROLL_BOTTOM_CLEARANCE_PX);
  if (expanded) {
    return Math.max(140, viewportH - chrome - 108);
  }
  return Math.max(140, panelHeight - chrome - 4);
}

/** Keep row height playable â€” crop pitch range instead of shrinking rows below PIANO_ROW_H_MIN. */
function clampPitchWindowForRowHeight(
  lo: number,
  hi: number,
  availPx: number,
  focusLo: number,
  focusHi: number,
): { pitchLo: number; pitchHi: number; rows: number } {
  const maxRows = Math.max(1, Math.floor(availPx / PIANO_ROW_H_MIN));
  let pitchLo = lo;
  let pitchHi = hi;
  let rows = pitchHi - pitchLo + 1;
  if (rows <= maxRows) return { pitchLo, pitchHi, rows };
  const center = Math.round((focusLo + focusHi) / 2);
  pitchLo = center - Math.floor(maxRows / 2);
  pitchHi = pitchLo + maxRows - 1;
  if (pitchLo < PIANO_PITCH_LO) {
    pitchLo = PIANO_PITCH_LO;
    pitchHi = Math.min(PIANO_PITCH_HI, pitchLo + maxRows - 1);
  }
  if (pitchHi > PIANO_PITCH_HI) {
    pitchHi = PIANO_PITCH_HI;
    pitchLo = Math.max(PIANO_PITCH_LO, pitchHi - maxRows + 1);
  }
  rows = pitchHi - pitchLo + 1;
  return { pitchLo, pitchHi, rows };
}

const STUDIO_DRUM_ROW_FALLBACK_LABELS = ['Kick', 'Snare', 'Clap', 'HiHat', 'Open', 'Tom', 'TomLo', 'Rim'] as const;

/** Drum lane â€” fixed 8-row GM grid (Kick â€¦ Rim) sized to the piano panel. */
function computeDrumRollPitchView(availGridPx: number): PianoRollPitchView {
  const lo = Math.min(...STUDIO_DRUM_PATTERN_ROW_GM);
  const hi = Math.max(...STUDIO_DRUM_PATTERN_ROW_GM);
  const rows = hi - lo + 1;
  const avail = Math.max(140, availGridPx);
  const rowH = Math.max(PIANO_ROW_H_MIN, Math.floor(avail / Math.max(rows, 8)));
  return { pitchLo: lo, pitchHi: hi, rowH };
}

function studioDrumKeyLabelForPitch(pitch: number, kitId?: BeatLabProducerKitId): string | undefined {
  const rowIdx = STUDIO_DRUM_PATTERN_ROW_GM.indexOf(pitch);
  if (rowIdx < 0 && !(pitch >= 35 && pitch <= 81)) return undefined;
  const padIdx = pianoRollPadIndexForMidi(pitch);
  if (kitId) {
    const labels = pianoRollPadLabelsForKit(kitId);
    return labels[padIdx] ?? STUDIO_DRUM_ROW_FALLBACK_LABELS[rowIdx] ?? `Pad ${padIdx + 1}`;
  }
  return rowIdx >= 0 ? STUDIO_DRUM_ROW_FALLBACK_LABELS[rowIdx] : `Pad ${padIdx + 1}`;
}

/** Groove Lead — allow shorter rows so C4–C6 fits without cropping the panel. */
const SE2_GROOVE_LEAD_PIANO_ROW_H_MIN = 8;

/** Groove Lead piano roll — fixed C4–C6; shrink row height, never crop register. */
function computeSe2GrooveLeadPianoRollPitchView(availGridPx: number): PianoRollPitchView {
  const { min: pitchLo, max: pitchHi } = se2GrooveLeadEmptyPitchRange();
  const avail = Math.max(140, availGridPx);
  const rows = pitchHi - pitchLo + 1;
  const rowH = Math.max(SE2_GROOVE_LEAD_PIANO_ROW_H_MIN, Math.floor(avail / rows));
  return { pitchLo, pitchHi, rowH };
}

/** 808 Lab piano roll — fixed C1–C6; shrink row height, never crop register. */
function computeSe2Lab808PianoRollPitchView(availGridPx: number): PianoRollPitchView {
  const { min: pitchLo, max: pitchHi } = se2Lab808EmptyPitchRange();
  const avail = Math.max(140, availGridPx);
  const rows = pitchHi - pitchLo + 1;
  const rowH = Math.max(SE2_GROOVE_LEAD_PIANO_ROW_H_MIN, Math.floor(avail / rows));
  return { pitchLo, pitchHi, rowH };
}

/** Bottom piano mode â€” grow pitch range so the grid fills the panel height (not a tiny note-only strip). */
function computePianoRollPanelPitchView(notes: MockMidiNote[], availGridPx: number): PianoRollPitchView {
  const avail = Math.max(140, availGridPx);
  const { min: rawLo, max: rawHi } = paddedPitchRange(notes);
  const maxRowsAtMinH = Math.max(1, Math.floor(avail / PIANO_ROW_H_MIN));
  let lo = Math.max(PIANO_PITCH_LO, rawLo);
  let hi = Math.min(PIANO_PITCH_HI, rawHi);
  let rows = hi - lo + 1;
  const minRowsForPanel = Math.min(
    PIANO_ROW_COUNT,
    maxRowsAtMinH,
    Math.max(PIANO_PITCH_VIEW_MIN_ROWS, Math.ceil(avail / PIANO_ROW_H_MAX)),
  );
  if (rows < minRowsForPanel) {
    const extra = minRowsForPanel - rows;
    lo = Math.max(PIANO_PITCH_LO, lo - Math.floor(extra / 2));
    hi = Math.min(PIANO_PITCH_HI, hi + Math.ceil(extra / 2));
    rows = hi - lo + 1;
  }
  while (
    rows * PIANO_ROW_H_MAX < avail &&
    rows < maxRowsAtMinH &&
    (lo > PIANO_PITCH_LO || hi < PIANO_PITCH_HI)
  ) {
    if (lo > PIANO_PITCH_LO) lo -= 1;
    if (hi < PIANO_PITCH_HI) hi += 1;
    rows = hi - lo + 1;
  }
  ({ pitchLo: lo, pitchHi: hi, rows } = clampPitchWindowForRowHeight(lo, hi, avail, rawLo, rawHi));
  let rowH = Math.floor(avail / rows);
  rowH = Math.max(PIANO_ROW_H_MIN, Math.min(PIANO_ROW_H_MAX, rowH));
  return { pitchLo: lo, pitchHi: hi, rowH };
}

function defaultPianoPanelHeightPx(viewportH: number): number {
  const headerFooterChrome = 170;
  const avail = Math.max(PIANO_PANEL_H_MIN, viewportH - headerFooterChrome);
  return Math.round(
    Math.max(PIANO_PANEL_H_MIN, Math.min(PIANO_PANEL_H_MAX, avail * PIANO_PANEL_VIEWPORT_FRAC)),
  );
}

function computePianoRollPitchView(notes: MockMidiNote[], availGridPx: number): PianoRollPitchView {
  const avail = Math.max(80, availGridPx);
  const { min: rawLo, max: rawHi } = paddedPitchRange(notes);
  let lo = Math.max(PIANO_PITCH_LO, rawLo);
  let hi = Math.min(PIANO_PITCH_HI, rawHi);
  let rows = hi - lo + 1;
  if (rows < PIANO_PITCH_VIEW_MIN_ROWS) {
    const extra = PIANO_PITCH_VIEW_MIN_ROWS - rows;
    lo = Math.max(PIANO_PITCH_LO, lo - Math.floor(extra / 2));
    hi = Math.min(PIANO_PITCH_HI, hi + Math.ceil(extra / 2));
    rows = hi - lo + 1;
  }
  ({ pitchLo: lo, pitchHi: hi, rows } = clampPitchWindowForRowHeight(lo, hi, avail, rawLo, rawHi));
  let rowH = Math.floor(avail / rows);
  rowH = Math.max(PIANO_ROW_H_MIN, Math.min(PIANO_ROW_H_MAX, rowH));
  return { pitchLo: lo, pitchHi: hi, rowH };
}

/** Edit PR / expanded editor — full 6-octave keyboard for serious MIDI editing. */
function fullPianoRollPitchView(availPx?: number): PianoRollPitchView {
  if (availPx != null && availPx > 0) {
    const rowH = Math.max(
      PIANO_ROW_H_MIN,
      Math.min(PIANO_NOTE_ROW_H_PX, Math.floor(availPx / PIANO_ROW_COUNT)),
    );
    return { pitchLo: PIANO_PITCH_LO, pitchHi: PIANO_PITCH_HI, rowH };
  }
  return { pitchLo: PIANO_PITCH_LO, pitchHi: PIANO_PITCH_HI, rowH: PIANO_NOTE_ROW_H_PX };
}

/** Audio-clip strip inside a lane row — must match hit-testing for drag. */
function laneAudioClipStripMetrics(
  track: MockMusioTrack,
  laneH: number,
): { top: number; height: number } | null {
  if (track.audioClips.length === 0) return null;
  if (se2TrackIsAudioClipLane(track.kind)) return { top: 0, height: laneH };
  if (track.kind === 'a2m') return { top: 0, height: Math.max(10, Math.round(laneH * 0.38)) };
  if (track.kind === 'synthGeno') return { top: 0, height: Math.max(10, Math.round(laneH * 0.36)) };
  return null;
}

function hitTimelineAudioClipId(
  track: MockMusioTrack,
  xCss: number,
  yLaneLocal: number,
  ppb: number,
  laneH: number,
): string | null {
  const strip = laneAudioClipStripMetrics(track, laneH);
  if (!strip || yLaneLocal < strip.top || yLaneLocal > strip.top + strip.height) return null;
  const beat = xCss / ppb;
  for (let ci = track.audioClips.length - 1; ci >= 0; ci--) {
    const c = track.audioClips[ci]!;
    if (beat >= c.startBeat && beat < c.startBeat + c.durationBeats) return c.id;
  }
  return null;
}

function hitTimelineAudioClipDragMode(
  track: MockMusioTrack,
  clipId: string,
  xCss: number,
  ppb: number,
  laneH: number,
): 'move' | 'resize-left' | 'resize-right' | null {
  const clip = track.audioClips.find((c) => c.id === clipId);
  if (!clip) return null;
  const { x, w } = timelineAudioClipInnerRect(track, clip, 0, laneH, ppb);
  const edge = se2TrackIsTrackAlign(track.kind) ? 16 : AUDIO_CLIP_RESIZE_EDGE_PX;
  const ld = xCss - x;
  const rd = x + w - xCss;
  if (w > edge * 3) {
    if (ld <= edge && rd <= edge) return ld < rd ? 'resize-left' : 'resize-right';
    if (ld <= edge) return 'resize-left';
    if (rd <= edge) return 'resize-right';
  }
  return 'move';
}

/** Mid-band gain handle — Cubase-style event volume grab (avoids resize edges). */
function hitTimelineAudioClipGainHandle(
  track: MockMusioTrack,
  clipId: string,
  xCss: number,
  yLaneLocal: number,
  ppb: number,
  laneH: number,
): boolean {
  const clip = track.audioClips.find((c) => c.id === clipId);
  if (!clip) return false;
  const { x, y, w, h } = timelineAudioClipInnerRect(track, clip, 0, laneH, ppb);
  if (w < 16 || h < 10) return false;
  const edge = se2TrackIsTrackAlign(track.kind) ? 16 : AUDIO_CLIP_RESIZE_EDGE_PX;
  if (xCss < x + edge || xCss > x + w - edge) return false;
  const midY = y + h * 0.5;
  const band = Math.max(6, Math.min(14, h * 0.28));
  return Math.abs(yLaneLocal - midY) <= band;
}

function drawLaneAudioClips(
  og: CanvasRenderingContext2D,
  clips: StudioAudioClip[],
  colorHex: string,
  laneTop: number,
  laneH: number,
  ppb: number,
  emptyHint?: string,
  audioBuffers?: ReadonlyMap<string, AudioBuffer>,
  fillLane = false,
  bpm = 120,
  livePeaksBySource?: ReadonlyMap<string, number[]>,
  alignStretchLane = false,
): void {
  if (clips.length === 0) {
    if (!emptyHint) return;
    const yMid = laneTop + laneH * 0.5;
    og.fillStyle = 'rgba(255,255,255,0.06)';
    og.font = '600 9px ui-sans-serif, system-ui, sans-serif';
    og.textAlign = 'left';
    og.textBaseline = 'middle';
    og.fillText(emptyHint, 8, yMid);
    return;
  }
  const innerTop = laneTop + (fillLane ? 1 : 3);
  const innerH = Math.max(4, laneH - (fillLane ? 2 : 6));
  const rgb = hexToRgb(colorHex);
  const baseR = rgb?.r ?? 199;
  const baseG = rgb?.g ?? 125;
  const baseB = rgb?.b ?? 255;
  for (const c of clips) {
    const x0 = beatColumnLeftPx(c.startBeat, ppb);
    const x1 = beatColumnLeftPx(c.startBeat + c.durationBeats, ppb);
    const wClip = Math.max(3, x1 - x0);
    const x = x0;
    og.fillStyle = `rgba(${baseR},${baseG},${baseB},0.38)`;
    const r = 2;
    if (typeof og.roundRect === 'function') {
      og.beginPath();
      og.roundRect(x, innerTop, wClip, innerH, r);
      og.fill();
    } else {
      og.fillRect(x, innerTop, wClip, innerH);
    }
    const buf = audioBuffers?.get(c.sourceId);
    const livePeaks = livePeaksBySource?.get(c.sourceId);
    const spb = 60 / Math.max(1, bpm);
    const slicePeaks = (peaks: number[]) => {
      if (alignStretchLane && buf) {
        const sourceOffsetSec = se2AudioClipSourceOffsetBeats(c) * spb;
        const wallSec = Math.max(1 / 16, c.durationBeats) * spb;
        const stretchRate = se2TrackAlignStretchRate({
          bufferDurationSec: buf.duration,
          sourceOffsetSec,
          clipWallDurationSec: wallSec,
        });
        const srcDurBeats = Math.max(SE2_MIN_AUDIO_CLIP_DURATION_BEATS, buf.duration / spb);
        const offBeats = (sourceOffsetSec / buf.duration) * srcDurBeats;
        const spanBeats = ((wallSec * stretchRate) / buf.duration) * srcDurBeats;
        return se2SliceWaveformPeaksForClip(
          peaks,
          offBeats,
          spanBeats,
          srcDurBeats,
          Math.max(128, Math.ceil(wClip * 12)),
        );
      }
      const srcDurBeats = buf
        ? se2BufferDurationBeats(buf, bpm)
        : Math.max(c.durationBeats, SE2_MIN_AUDIO_CLIP_DURATION_BEATS);
      return se2SliceWaveformPeaksForClip(
        peaks,
        se2AudioClipSourceOffsetBeats(c),
        c.durationBeats,
        srcDurBeats,
        Math.max(128, Math.ceil(wClip * 12)),
      );
    };
    const ampScale = se2ClipGainAmplitudeScale(c.gainDb);
    if (livePeaks && livePeaks.length > 0) {
      const sliced = slicePeaks(livePeaks);
      drawSe2ClipWaveform(og, sliced, x, innerTop, wClip, innerH, r, ampScale);
    } else if (buf) {
      const peaks = getSe2AudioWaveformPeaks(c.sourceId, buf);
      const sliced = slicePeaks(peaks);
      drawSe2ClipWaveform(og, sliced, x, innerTop, wClip, innerH, r, ampScale);
    }
    og.strokeStyle = `rgba(${baseR},${baseG},${baseB},0.72)`;
    og.lineWidth = 1;
    if (typeof og.roundRect === 'function') {
      og.beginPath();
      og.roundRect(x + 0.5, innerTop + 0.5, Math.max(0, wClip - 1), Math.max(0, innerH - 1), r);
      og.stroke();
    } else {
      og.strokeRect(x + 0.5, innerTop + 0.5, wClip - 1, innerH - 1);
    }
    const label = (c.name ?? 'Audio').slice(0, 24);
    if (wClip > 36) {
      og.fillStyle = 'rgba(255,255,255,0.85)';
      og.font = '600 8px ui-sans-serif, system-ui, sans-serif';
      og.textAlign = 'left';
      og.textBaseline = 'middle';
      og.fillText(label, x + 4, innerTop + innerH * 0.5);
    }
  }
}

function drawAudioLaneClips(
  og: CanvasRenderingContext2D,
  track: MockMusioTrack,
  laneTop: number,
  laneH: number,
  ppb: number,
  audioBuffers?: ReadonlyMap<string, AudioBuffer>,
  bpm = 120,
  livePeaksBySource?: ReadonlyMap<string, number[]>,
): void {
  if (!se2TrackIsAudioClipLane(track.kind)) return;
  const hint = se2TrackIsTrackAlign(track.kind)
    ? 'Shift+edge = stretch · edge = trim · drop audio'
    : 'Drop audio here → clip';
  drawLaneAudioClips(
    og,
    track.audioClips,
    track.colorHex,
    laneTop,
    laneH,
    ppb,
    hint,
    audioBuffers,
    true,
    bpm,
    livePeaksBySource,
    true,
  );
}

function drawA2mLane(
  og: CanvasRenderingContext2D,
  track: MockMusioTrack,
  laneTop: number,
  laneH: number,
  ppb: number,
  audioBuffers?: ReadonlyMap<string, AudioBuffer>,
  bpm = 120,
): void {
  if (track.kind !== 'a2m') return;
  const clipH = Math.max(10, Math.round(laneH * 0.38));
  const noteTop = laneTop + clipH;
  const noteH = Math.max(4, laneH - clipH);
  drawLaneAudioClips(
    og,
    track.audioClips,
    track.colorHex,
    laneTop,
    clipH,
    ppb,
    track.notes.length === 0
      ? 'Drop audio clip â†’ converts to MIDI (not full song)'
      : undefined,
    audioBuffers,
    false,
    bpm,
  );
  if (track.notes.length > 0) {
    drawMusioMidiLane(og, { ...track, kind: 'midi' }, noteTop, noteH, ppb);
  }
}

function drawSynthGenoLane(
  og: CanvasRenderingContext2D,
  track: MockMusioTrack,
  laneTop: number,
  laneH: number,
  ppb: number,
  audioBuffers?: ReadonlyMap<string, AudioBuffer>,
  bpm = 120,
): void {
  if (track.kind !== 'synthGeno') return;
  if (track.audioClips.length > 0) {
    const clipH = Math.max(10, Math.round(laneH * 0.36));
    drawLaneAudioClips(
      og,
      track.audioClips,
      track.colorHex,
      laneTop,
      clipH,
      ppb,
      undefined,
      audioBuffers,
      false,
      bpm,
    );
    drawMusioMidiLane(og, track, laneTop + clipH, Math.max(4, laneH - clipH), ppb);
    return;
  }
  drawMusioMidiLane(og, track, laneTop, laneH, ppb);
}

function drawGenoUltraSynthLane(
  og: CanvasRenderingContext2D,
  track: MockMusioTrack,
  laneTop: number,
  laneH: number,
  ppb: number,
): void {
  if (track.kind !== 'genoUltraSynth') return;
  og.save();
  og.fillStyle = 'rgba(167,139,250,0.06)';
  og.fillRect(0, laneTop, og.canvas.width, laneH);
  og.restore();
  drawMusioMidiLane(og, track, laneTop, laneH, ppb);
}

function drawGenoBassSynthLane(
  og: CanvasRenderingContext2D,
  track: MockMusioTrack,
  laneTop: number,
  laneH: number,
  ppb: number,
): void {
  if (track.kind !== 'genoBassSynth') return;
  og.save();
  og.fillStyle = 'rgba(201,168,106,0.08)';
  og.fillRect(0, laneTop, og.canvas.width, laneH);
  og.restore();
  drawMusioMidiLane(og, track, laneTop, laneH, ppb);
}

function drawMusioMidiLane(
  og: CanvasRenderingContext2D,
  track: MockMusioTrack,
  laneTop: number,
  laneH: number,
  ppb: number,
): void {
  if (!studioTrackOutputsMidi(track)) return;
  const notes = track.notes;
  if (notes.length === 0) return;
  const { min: lo, max: hi } = paddedPitchRange(notes);
  const rangeSpan = Math.max(1, hi - lo + 1);
  const innerH = laneH - 4;
  const noteH = Math.max(2, innerH / rangeSpan - 1);

  for (const ev of notes) {
    const x0 = beatColumnLeftPx(ev.startBeat, ppb);
    const x1 = beatColumnLeftPx(ev.startBeat + midiNoteRollDurationBeats(ev), ppb);
    const wNote = Math.max(2, x1 - x0);
    const x = x0;
    const yn = ((hi - ev.pitch) / rangeSpan) * innerH;
    const y = laneTop + 2 + yn;
    og.fillStyle = rgbaNoteFill(track.colorHex, ev.velocity);
    const r = 1;
    if (typeof og.roundRect === 'function') {
      og.beginPath();
      og.roundRect(x, y, wNote, noteH, r);
      og.fill();
    } else {
      og.fillRect(x, y, wNote, noteH);
    }
  }
}

/** Folded lane geometry must match {@link drawMusioMidiLane} / hit-testing. */
function a2mLaneNoteRegion(laneTop: number, laneH: number): { noteTop: number; noteH: number } {
  const clipH = Math.max(10, Math.round(laneH * 0.38));
  return { noteTop: laneTop + clipH, noteH: Math.max(4, laneH - clipH) };
}

function timelineLaneNoteRectPx(
  track: MockMusioTrack,
  ev: MockMidiNote,
  laneTop: number,
  laneH: number,
  ppb: number,
): { x: number; y: number; w: number; h: number; r: number } {
  if (!studioTrackOutputsMidi(track)) return { x: 0, y: 0, w: 0, h: 0, r: 0 };
  const region =
    track.kind === 'a2m' ? a2mLaneNoteRegion(laneTop, laneH) : { noteTop: laneTop, noteH: laneH };
  laneTop = region.noteTop;
  laneH = region.noteH;
  const notes = track.notes;
  const { min: lo, max: hi } = paddedPitchRange(notes);
  const rangeSpan = Math.max(1, hi - lo + 1);
  const innerH = laneH - 4;
  const noteH = Math.max(2, innerH / rangeSpan - 1);
  const x0 = beatColumnLeftPx(ev.startBeat, ppb);
  const x1 = beatColumnLeftPx(ev.startBeat + midiNoteRollDurationBeats(ev), ppb);
  const wNote = Math.max(2, x1 - x0);
  const yn = ((hi - ev.pitch) / rangeSpan) * innerH;
  const x = x0;
  const y = laneTop + 2 + yn;
  return { x, y, w: wNote, h: noteH, r: 1 };
}

function strokeTimelineLaneSelectedNote(
  g: CanvasRenderingContext2D,
  track: MockMusioTrack,
  noteIndex: number,
  laneTop: number,
  laneH: number,
  ppb: number,
): void {
  if (!studioTrackOutputsMidi(track)) return;
  const ev = track.notes[noteIndex];
  if (!ev) return;
  const { x, y, w, h, r } = timelineLaneNoteRectPx(track, ev, laneTop, laneH, ppb);
  g.save();
  g.shadowColor = 'rgba(124,244,198,0.55)';
  g.shadowBlur = 6;
  g.strokeStyle = '#7cf4c6';
  g.lineWidth = 2;
  if (typeof g.roundRect === 'function') {
    g.beginPath();
    g.roundRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1), r);
    g.stroke();
  } else {
    g.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  }
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = 1;
  g.shadowBlur = 0;
  if (typeof g.roundRect === 'function') {
    g.beginPath();
    g.roundRect(x + 1, y + 1, Math.max(0, w - 3), Math.max(0, h - 3), Math.max(0, r - 0.5));
    g.stroke();
  }
  g.restore();
}

function syncTimelineGridLayer(
  lanesCanvas: HTMLCanvasElement | null,
  rulerCanvas: HTMLCanvasElement | null,
  gridCacheRef: { current: HTMLCanvasElement | null },
  zoom: number,
  tracks: MockMusioTrack[],
  beatsPerBar: number,
  laneH: number,
  selectedTrackIndex: number,
  selectedNoteIndex: number | null,
  audioBuffers?: ReadonlyMap<string, AudioBuffer>,
  selectedAudioClip?: { trackIndex: number; clipId: string } | null,
  audioSplitMarkerBeat?: number | null,
  timelineBpm?: number,
  selectedNoteIndexes?: ReadonlySet<number> | null,
  scrollLeftCss = 0,
  viewportWidthCss = 1200,
  livePeaksBySource?: ReadonlyMap<string, number[]>,
  viewportMargins?: { marginBackPx?: number; marginFwdPx?: number },
  showClipGainReadout = false,
): void {
  if (!lanesCanvas && !rulerCanvas) return;
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const fullW = TOTAL_WIDTH_PX * zoom;
  const maxCssBitmap = SE2_MAX_GRID_BITMAP_PX / dpr;
  const useViewport = fullW > maxCssBitmap;
  let viewStart = 0;
  let paintW = fullW;
  if (useViewport) {
    const vp = se2ComputeGridViewport(fullW, scrollLeftCss, viewportWidthCss, viewportMargins);
    viewStart = vp.viewStart;
    paintW = Math.min(vp.paintWidth, maxCssBitmap);
  }
  const xOff = viewStart;
  const w = useViewport ? paintW : fullW;
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const totalBeats = totalBeatsForSig(bpb);
  const ppb = ppbAtZoom(zoom, bpb);
  const beatFirst = useViewport ? Math.max(0, Math.floor(viewStart / ppb)) : 0;
  const beatLast = useViewport
    ? Math.min(totalBeats, Math.ceil((viewStart + paintW) / ppb) + 1)
    : totalBeats;
  const barFirst = Math.floor(beatFirst / bpb);
  const barLast = useViewport ? Math.min(BARS, Math.ceil((beatLast + 1) / bpb)) : BARS;
  const barW = BAR_WIDTH_PX * zoom;
  const laneRows = timelineLaneRowCount(tracks.length);
  const laneHClamped = Math.max(MIN_TRACK_LANE_H_PX, Math.min(MAX_TRACK_LANE_H_PX, Math.round(laneH)));
  const lanesH = laneRows * laneHClamped;
  const h = RULER_TOTAL_H_PX + lanesH;
  const bw = Math.max(1, Math.round(w * dpr));
  const bh = Math.max(1, Math.round(h * dpr));
  const lanesBh = Math.max(1, Math.round(lanesH * dpr));
  const rulerBh = Math.max(1, Math.round(RULER_TOTAL_H_PX * dpr));
  const rulerSrcY = Math.round(RULER_TOTAL_H_PX * dpr);

  const tracksSig = `${tracksSignature(tracks)}|bpb:${bpb}|buf:${se2AudioBuffersSignature(audioBuffers)}|live:${livePeaksBySource?.size ?? 0}${useViewport ? `|vs:${viewStart}|pw:${Math.round(paintW)}` : ''}`;
  type GridOff = HTMLCanvasElement & { __gridVer: number; __zoom: number; __tracksSig: string };
  let off = gridCacheRef.current as GridOff | null;
  const offVer = off?.__gridVer ?? -1;
  const offZoom = off?.__zoom ?? -1;
  const prevSig = off?.__tracksSig ?? '';
  const needsNewBitmap =
    !off
    || off.width !== bw
    || off.height !== bh
    || offVer !== GRID_CACHE_VERSION
    || offZoom !== zoom;
  const needsRedraw = needsNewBitmap || prevSig !== tracksSig;
  /* Reuse bitmap when only the view window moved — avoids GC hitch; same waveform draw path. */
  if (needsNewBitmap) {
    off = document.createElement('canvas') as GridOff;
    off.__gridVer = GRID_CACHE_VERSION;
    off.__zoom = zoom;
    off.width = bw;
    off.height = bh;
    /* Failed bitmap alloc (GPU pressure / FX suite open) — do not poison the cache. */
    if (off.width < 1 || off.height < 1) {
      gridCacheRef.current = null;
      return;
    }
    gridCacheRef.current = off;
  }
  if (needsRedraw && off) {
    off.__tracksSig = tracksSig;
    const og = off.getContext('2d');
    if (!og) {
      gridCacheRef.current = null;
      return;
    }
    og.imageSmoothingEnabled = false;
    og.setTransform(dpr, 0, 0, dpr, 0, 0);
    og.fillStyle = '#0a0a10';
    og.fillRect(0, 0, w, h);

    for (let t = 0; t < laneRows; t++) {
      const y0 = RULER_TOTAL_H_PX + t * laneHClamped;
      og.fillStyle = t % 2 === 0 ? '#0e0e16' : '#0a0a12';
      og.fillRect(0, y0, w, laneHClamped);
    }

    og.save();
    og.translate(-xOff, 0);

    /*
     * Pixel-snapped separators aligned to DOM row *bottom* edges.
     * Left track boxes use an inset bottom hairline, which lands on the previous row's last pixel.
     * So each boundary after lane 0 must be drawn at (boundaryY - 1) in the canvas.
     */
    og.fillStyle = 'rgba(255,255,255,0.14)';
    for (let i = 1; i <= laneRows; i++) {
      const y = Math.round(RULER_TOTAL_H_PX + i * laneHClamped - 1);
      og.fillRect(xOff, y, paintW, 1);
    }

    for (let beat = beatFirst; beat <= beatLast; beat++) {
      const gx = beatColumnLeftPx(beat, ppb);
      const isBar = beat % bpb === 0;
      og.fillStyle = isBar ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)';
      og.fillRect(gx, RULER_TOTAL_H_PX, 1, h - RULER_TOTAL_H_PX);
    }

    if (zoom >= 1) {
      for (let q = beatFirst; q < beatLast; q++) {
        for (let s = 1; s <= 3; s++) {
          const gx = beatColumnLeftPx(q + s / 4, ppb);
          if (gx <= xOff || gx >= xOff + paintW) continue;
          og.fillStyle = 'rgba(255,255,255,0.05)';
          og.fillRect(gx, RULER_TOTAL_H_PX, 1, h - RULER_TOTAL_H_PX);
        }
      }
    }
    if (zoom >= 6) {
      for (let q = beatFirst; q < beatLast; q++) {
        for (let s = 1; s <= 7; s++) {
          if (s % 2 === 0) continue;
          const gx = beatColumnLeftPx(q + s / 8, ppb);
          if (gx <= xOff || gx >= xOff + paintW) continue;
          og.fillStyle = 'rgba(255,255,255,0.035)';
          og.fillRect(gx, RULER_TOTAL_H_PX, 1, h - RULER_TOTAL_H_PX);
        }
      }
    }

    const rulerGrad = og.createLinearGradient(0, 0, 0, RULER_TOTAL_H_PX);
    rulerGrad.addColorStop(0, '#1c1c26');
    rulerGrad.addColorStop(1, '#12121a');
    og.fillStyle = rulerGrad;
    og.fillRect(xOff, 0, paintW, RULER_TOTAL_H_PX);
    og.textAlign = 'left';
    og.textBaseline = 'middle';
    og.fillStyle = '#c4c4d0';
    og.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
    for (let barIdx = barFirst; barIdx < barLast; barIdx++) {
      og.fillText(String(barIdx + 1), beatColumnLeftPx(barIdx * bpb, ppb) + 4, RULER_BAR_H_PX / 2);
    }
    og.textAlign = 'center';
    og.font = 'bold 8px ui-monospace, SFMono-Regular, Menlo, monospace';
    og.fillStyle = '#8e8e9e';
    for (let q = beatFirst; q < beatLast; q++) {
      const label = String((q % bpb) + 1);
      /* Keep beat numbers directly over the corresponding beat grid lines. */
      og.fillText(label, beatColumnLeftPx(q, ppb), RULER_BAR_H_PX + RULER_MEAS_H_PX / 2);
    }
    og.fillStyle = 'rgba(255,255,255,0.12)';
    og.fillRect(xOff, Math.round(RULER_BAR_H_PX), paintW, 1);

    const drawBpm = Math.max(40, timelineBpm ?? 120);
    const nLanes = Math.min(tracks.length, laneRows);
    for (let ti = 0; ti < nLanes; ti++) {
      const laneTop = RULER_TOTAL_H_PX + ti * laneHClamped;
      const tr = tracks[ti]!;
      if (se2TrackIsAudioClipLane(tr.kind)) drawAudioLaneClips(og, tr, laneTop, laneHClamped, ppb, audioBuffers, drawBpm, livePeaksBySource);
      else if (tr.kind === 'a2m') drawA2mLane(og, tr, laneTop, laneHClamped, ppb, audioBuffers, drawBpm);
      else if (tr.kind === 'synthGeno') drawSynthGenoLane(og, tr, laneTop, laneHClamped, ppb, audioBuffers, drawBpm);
      else if (tr.kind === 'genoUltraSynth') drawGenoUltraSynthLane(og, tr, laneTop, laneHClamped, ppb);
      else if (tr.kind === 'genoBassSynth') drawGenoBassSynthLane(og, tr, laneTop, laneHClamped, ppb);
      else drawMusioMidiLane(og, tr, laneTop, laneHClamped, ppb);
    }
    og.restore();
  }

  off = gridCacheRef.current;
  if (!off) return;

  const cssW = useViewport ? paintW : fullW;
  const cssMargin = useViewport ? viewStart : 0;

  if (rulerCanvas) {
    const rg = rulerCanvas.getContext('2d');
    if (rg) {
      rg.imageSmoothingEnabled = false;
      if (rulerCanvas.width !== bw || rulerCanvas.height !== rulerBh) {
        rulerCanvas.width = bw;
        rulerCanvas.height = rulerBh;
      }
      rulerCanvas.style.marginLeft = `${cssMargin}px`;
      rulerCanvas.style.width = `${cssW}px`;
      rulerCanvas.style.height = `${RULER_TOTAL_H_PX}px`;
      rg.setTransform(dpr, 0, 0, dpr, 0, 0);
      rg.clearRect(0, 0, cssW, RULER_TOTAL_H_PX);
      rg.drawImage(off, 0, 0, bw, rulerBh, 0, 0, cssW, RULER_TOTAL_H_PX);
    }
  }

  if (lanesCanvas) {
    const g = lanesCanvas.getContext('2d');
    if (!g) return;
    g.imageSmoothingEnabled = false;
    if (lanesCanvas.width !== bw || lanesCanvas.height !== lanesBh) {
      lanesCanvas.width = bw;
      lanesCanvas.height = lanesBh;
    }
    lanesCanvas.style.marginLeft = `${cssMargin}px`;
    lanesCanvas.style.width = `${cssW}px`;
    lanesCanvas.style.height = `${lanesH}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cssW, lanesH);
    g.drawImage(off, 0, rulerSrcY, bw, lanesBh, 0, 0, cssW, lanesH);
    g.save();
    g.translate(-xOff, 0);
    if (tracks.length > 0 && selectedTrackIndex >= 0 && selectedTrackIndex < tracks.length) {
      const trSel = tracks[selectedTrackIndex]!;
      if (studioTrackOutputsMidi(trSel)) {
        const laneTop = selectedTrackIndex * laneHClamped;
        const selIdxs =
          selectedNoteIndexes && selectedNoteIndexes.size > 0
            ? [...selectedNoteIndexes]
            : selectedNoteIndex !== null
              ? [selectedNoteIndex]
              : [];
        for (const ni of selIdxs) {
          if (ni >= 0 && ni < trSel.notes.length) {
            strokeTimelineLaneSelectedNote(g, trSel, ni, laneTop, laneHClamped, ppb);
          }
        }
      }
    }
    if (selectedAudioClip) {
      const { trackIndex: ati, clipId } = selectedAudioClip;
      if (ati >= 0 && ati < tracks.length) {
        const trA = tracks[ati]!;
        if (trA.audioClips.some((c) => c.id === clipId)) {
          const laneTop = ati * laneHClamped;
          const clip = trA.audioClips.find((c) => c.id === clipId);
          strokeTimelineLaneSelectedAudioClip(
            g,
            trA,
            clipId,
            laneTop,
            laneHClamped,
            ppb,
            showClipGainReadout,
          );
          if (
            clip &&
            audioSplitMarkerBeat != null &&
            audioSplitMarkerBeat > clip.startBeat + 1e-4 &&
            audioSplitMarkerBeat < clip.startBeat + clip.durationBeats - 1e-4
          ) {
            const mx = beatColumnLeftPx(audioSplitMarkerBeat, ppb);
            g.save();
            g.strokeStyle = '#ff6b35';
            g.lineWidth = 1.5;
            g.setLineDash([4, 3]);
            g.beginPath();
            g.moveTo(mx + 0.5, laneTop + 1);
            g.lineTo(mx + 0.5, laneTop + laneHClamped - 1);
            g.stroke();
            g.setLineDash([]);
            g.restore();
          }
        }
      }
    }
    g.restore();
  }
}

/**
 * Place the timeline playhead in **strip content coordinates** (`left = beat * ppb`).
 * The playhead element must live inside the scrolling strip so it stays locked to the grid
 * at any scrollLeft / follow-translate — viewport pinning breaks after you scroll.
 */
function positionTimelinePlayheadGroup(
  el: HTMLElement | null,
  innerEl: HTMLElement | null,
  beat: number,
  zoom: number,
  beatsPerBar: number,
  _scrollLeftCss = 0,
  _viewportPinPx: number | null = null,
  _viewportLeftPx?: number,
): void {
  if (!el) return;
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const tb = totalBeatsForSig(bpb);
  const ppb = ppbAtZoom(zoom, bpb);
  const bClamped = Math.max(0, Math.min(beat, tb));
  const lineCenter = bClamped * ppb;
  const gw = PLAYHEAD_GRIP_W_PX;
  el.style.left = `${lineCenter}px`;
  el.style.transform = `translate3d(${-gw / 2}px,0,0)`;
  if (innerEl) innerEl.style.transform = 'translateX(0px)';
}

/** Loop-region playhead — same content-space placement as the main playhead. */
function positionLoopRegionPlayheadGroup(
  el: HTMLElement | null,
  innerEl: HTMLElement | null,
  beat: number,
  zoom: number,
  beatsPerBar: number,
  _scrollLeftCss = 0,
  _stripOffsetPx = 0,
): void {
  positionTimelinePlayheadGroup(el, innerEl, beat, zoom, beatsPerBar);
}

function positionPianoPlayhead(el: HTMLElement | null, beat: number, zoom: number, beatsPerBar: number): void {
  if (!el) return;
  const stripW = TOTAL_WIDTH_PX * zoom;
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const tb = totalBeatsForSig(bpb);
  const ppb = ppbAtZoom(zoom, bpb);
  const bClamped = Math.max(0, Math.min(beat, tb));
  /* Sub-pixel exact Ã¢â‚¬â€ same fix as timeline playhead. */
  const lineCenter = bClamped * ppb;
  const pw = PLAYHEAD_W_PX;
  // Unclamped: matches WAAPI from-keyframe (x0 = -pw/2) so no jump at Play
  el.style.transform = `translate3d(${bClamped * ppb - pw / 2}px,0,0)`;
}

function isBlackKeyPitch(pitch: number): boolean {
  return [1, 3, 6, 8, 10].includes(pitch % 12);
}

const WHITE_KEY_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

function whiteKeyLabel(pitch: number): string {
  const pc = pitch % 12;
  const idx = WHITE_SEMITONES.indexOf(pc);
  if (idx < 0) return '';
  const octave = Math.floor(pitch / 12) - 1;
  return `${WHITE_KEY_NAMES[idx]}${octave}`;
}

/** Hit-test Y in window coords against the key column top Ã¢â€ â€™ MIDI pitch (continuous strip, no per-row gaps). */
function pitchFromKeyStripClientY(stripTopClient: number, clientY: number): number | null {
  const y = clientY - stripTopClient;
  if (!Number.isFinite(y) || y < 0 || y >= PIANO_GRID_H_PX) return null;
  const row = Math.floor(y / PIANO_NOTE_ROW_H_PX);
  if (row < 0 || row >= PIANO_ROW_COUNT) return null;
  return PIANO_PITCH_HI - row;
}

/**
 * Vertical position in logical key-strip pixels `[0 â€¦ PIANO_GRID_H)`. Scales DOM height â†’ grid so fractional
 * layout / DPI never drops whole keys at top or bottom (common cause of â€žsound but no key pressâ€).
 */
function keyStripLogicalYFromClient(el: HTMLElement, clientY: number, gridH: number): number | null {
  const r = el.getBoundingClientRect();
  const h = r.height;
  const rawY = clientY - r.top;
  if (!Number.isFinite(rawY) || !Number.isFinite(h) || h < 4) return null;
  if (rawY < -10 || rawY > h + 10) return null;
  const t = rawY <= 0 ? 0 : rawY >= h ? 1 : rawY / h;
  return t * (gridH - 1e-6);
}

/** Row index â†’ pitch (top of strip = HI). Always clamped to visible range. */
function pitchFromLogicalKeyStripY(yLogical: number, pitchView: PianoRollPitchView): number {
  const rows = pianoPitchRowCount(pitchView);
  let row = Math.floor(yLogical / pitchView.rowH);
  row = Math.max(0, Math.min(rows - 1, row));
  return pianoPitchForRow(pitchView, row);
}

function pitchFromKeyStripElement(el: HTMLElement | null, clientY: number, pitchView: PianoRollPitchView): number | null {
  if (!el) return null;
  const gridH = pianoGridHeightPx(pitchView);
  const yLogical = keyStripLogicalYFromClient(el, clientY, gridH);
  if (yLogical === null) return null;
  return pitchFromLogicalKeyStripY(yLogical, pitchView);
}

/** Where within the activated key-row the strike landed (bottom = harder). */
function velocity01FromKeyStripStrike(el: HTMLElement, clientY: number, pitch: number, pitchView: PianoRollPitchView): number {
  const gridH = pianoGridHeightPx(pitchView);
  const yLogical = keyStripLogicalYFromClient(el, clientY, gridH);
  if (yLogical === null) return 0.78;
  const rowTop = pianoRowIndexForPitch(pitchView, pitch) * pitchView.rowH;
  const towardFront = (yLogical - rowTop) / pitchView.rowH;
  const t = Math.max(0, Math.min(1, towardFront));
  return Math.max(0.28, Math.min(1, 0.54 + t * 0.43));
}

function pitchRowY0(pitch: number, pitchView: PianoRollPitchView): number {
  return pianoRowIndexForPitch(pitchView, pitch) * pitchView.rowH + 1;
}

function hitPianoNoteIndex(
  notes: MockMidiNote[],
  xCss: number,
  yCss: number,
  ppb: number,
  pitchView: PianoRollPitchView,
): number {
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i];
    const x0 = beatColumnLeftPx(n.startBeat, ppb);
    const x1 = Math.max(x0 + 3, beatColumnLeftPx(n.startBeat + midiNoteRollDurationBeats(n), ppb));
    const y0 = pitchRowY0(n.pitch, pitchView);
    const nh = pitchView.rowH - 2;
    if (xCss >= x0 && xCss < x1 && yCss >= y0 && yCss < y0 + nh) return i;
  }
  return -1;
}

/** Timeline lane MIDI rectangles use the same folded pitch-range layout as {@link drawMusioMidiLane}. */
function timelineMidiNoteStripRect(
  track: MockMusioTrack,
  note: MockMidiNote,
  trackIndex: number,
  ppb: number,
  laneH: number,
): { x0: number; x1: number; y0: number; y1: number } | null {
  if (!studioTrackOutputsMidi(track)) return null;
  const notes = track.notes;
  const noteLaneTop = track.kind === 'a2m' ? Math.max(10, Math.round(laneH * 0.38)) : 0;
  const noteLaneH = track.kind === 'a2m' ? Math.max(4, laneH - noteLaneTop) : laneH;
  const { min: lo, max: hi } = paddedPitchRange(notes);
  const rangeSpan = Math.max(1, hi - lo + 1);
  const innerH = noteLaneH - 4;
  const noteH = Math.max(2, innerH / rangeSpan - 1);
  const x0 = beatColumnLeftPx(note.startBeat, ppb);
  const x1 = beatColumnLeftPx(note.startBeat + note.durationBeats, ppb);
  const wNote = Math.max(2, x1 - x0);
  const yn = ((hi - note.pitch) / rangeSpan) * innerH;
  const yNote = 2 + yn;
  const laneTop = trackIndex * laneH;
  return {
    x0,
    x1: x0 + wNote,
    y0: laneTop + noteLaneTop + yNote,
    y1: laneTop + noteLaneTop + yNote + noteH,
  };
}

function timelineMidiNoteIndexesInMarquee(
  track: MockMusioTrack,
  trackIndex: number,
  left: number,
  right: number,
  top: number,
  bottom: number,
  ppb: number,
  laneH: number,
): number[] {
  const hits: number[] = [];
  track.notes.forEach((n, i) => {
    const r = timelineMidiNoteStripRect(track, n, trackIndex, ppb, laneH);
    if (!r) return;
    if (r.x1 >= left && r.x0 <= right && r.y1 >= top && r.y0 <= bottom) hits.push(i);
  });
  return hits;
}

function hitTimelineMidiNoteIndex(
  track: MockMusioTrack,
  xCss: number,
  yLaneLocal: number,
  ppb: number,
  laneH: number,
): number {
  if (!studioTrackOutputsMidi(track)) return -1;
  const notes = track.notes;
  if (notes.length === 0) return -1;
  const noteLaneTop = track.kind === 'a2m' ? Math.max(10, Math.round(laneH * 0.38)) : 0;
  const noteLaneH = track.kind === 'a2m' ? Math.max(4, laneH - noteLaneTop) : laneH;
  const yAdj = yLaneLocal - noteLaneTop;
  if (track.kind === 'a2m' && yAdj < 0) return -1;
  const { min: lo, max: hi } = paddedPitchRange(notes);
  const rangeSpan = Math.max(1, hi - lo + 1);
  const innerH = noteLaneH - 4;
  const noteH = Math.max(2, innerH / rangeSpan - 1);
  for (let i = notes.length - 1; i >= 0; i--) {
    const ev = notes[i]!;
    const x0 = beatColumnLeftPx(ev.startBeat, ppb);
    const x1 = beatColumnLeftPx(ev.startBeat + ev.durationBeats, ppb);
    const wNote = Math.max(2, x1 - x0);
    const yn = ((hi - ev.pitch) / rangeSpan) * innerH;
    const yNote = 2 + yn;
    if (xCss >= x0 && xCss < x0 + wNote && yAdj >= yNote && yAdj < yNote + noteH) return i;
  }
  return -1;
}

/** Inverse of folded-lane Y mapping in {@link drawMusioMidiLane}. */
function pitchFromTimelineLaneY(track: MockMusioTrack, yLaneLocal: number, laneH: number): number {
  if (!studioTrackOutputsMidi(track)) return 60;
  if (track.kind === 'a2m') {
    const clipH = Math.max(10, Math.round(laneH * 0.38));
    yLaneLocal -= clipH;
    laneH = Math.max(4, laneH - clipH);
    if (yLaneLocal < 0) return 60;
  }
  const { min: lo, max: hi } = paddedPitchRange(
    track.notes,
    studioTrackIsGlideBassChannel(track)
      ? se2GlideBassEmptyPitchRange()
      : studioTrackIsGrooveLeadChannel(track)
        ? se2GrooveLeadEmptyPitchRange()
        : studioTrackIsLab808Channel(track)
          ? se2Lab808EmptyPitchRange()
        : studioTrackIsGenoUltraSynthChannel(track)
          ? se2GenoUltraEmptyPitchRange()
          : studioTrackIsGenoBassSynthChannel(track)
            ? se2GenoBassEmptyPitchRange()
          : studioTrackIsHumCaptureChannel(track)
            ? se2HumCaptureEmptyPitchRange()
            : studioTrackIsGuitarChannel(track)
              ? se2GuitarEmptyPitchRange()
              : undefined,
  );
  const rangeSpan = Math.max(1, hi - lo + 1);
  const innerH = laneH - 4;
  const t = (yLaneLocal - 2) / innerH;
  const clampedT = Math.max(0, Math.min(1, t));
  const pFloat = hi - clampedT * rangeSpan;
  return Math.max(PIANO_PITCH_LO, Math.min(PIANO_PITCH_HI, Math.round(pFloat)));
}

function timelineLanePointFromStripClient(
  strip: HTMLDivElement,
  clientX: number,
  clientY: number,
  trackCount: number,
  laneH: number,
  scrollEl: HTMLElement | null,
): { ti: number; yLaneLocal: number; xCss: number } | null {
  const rect = strip.getBoundingClientRect();
  const yRel = clientY - rect.top;
  if (!Number.isFinite(yRel) || yRel < 0) return null;
  const ti = Math.floor(yRel / laneH);
  if (ti < 0 || ti >= trackCount) return null;
  return {
    ti,
    yLaneLocal: yRel - ti * laneH,
    xCss: se2TimelineXContentFromClient(clientX, scrollEl, strip),
  };
}

function hitTimelineMidiNoteDragMode(
  track: MockMusioTrack,
  xCss: number,
  yLaneLocal: number,
  ppb: number,
  laneH: number,
): { index: number; mode: 'move' | 'resize-left' | 'resize-right' } | null {
  const ix = hitTimelineMidiNoteIndex(track, xCss, yLaneLocal, ppb, laneH);
  if (ix < 0) return null;
  const n = track.notes[ix];
  if (!n) return null;
  const x0 = beatColumnLeftPx(n.startBeat, ppb);
  const x1 = beatColumnLeftPx(n.startBeat + n.durationBeats, ppb);
  const xR = Math.max(x0 + 3, x1);
  const edge = PIANO_NOTE_RESIZE_EDGE_PX;
  const ld = xCss - x0;
  const rd = xR - xCss;
  if (ld <= edge && rd <= edge) {
    return ld < rd ? { index: ix, mode: 'resize-left' } : { index: ix, mode: 'resize-right' };
  }
  if (ld <= edge) return { index: ix, mode: 'resize-left' };
  if (rd <= edge) return { index: ix, mode: 'resize-right' };
  return { index: ix, mode: 'move' };
}

/** X in strip coordinates (matches `beatColumnLeftPx` / canvas); use **horizontal scroll host** rect + scrollLeft. */
function pianoGridStripXFromClient(clientX: number, hScrollEl: HTMLElement | null): number {
  if (!hScrollEl) return 0;
  const r = hScrollEl.getBoundingClientRect();
  return clientX - r.left + hScrollEl.scrollLeft;
}

function pianoGridYFromClient(clientY: number, gridEl: HTMLElement): number {
  return clientY - gridEl.getBoundingClientRect().top;
}

/** Matches `syncPianoVelocityCanvas` lane geometry â€” bars grow up from the lane floor under the divider. */
function pianoVelocityLaneMetrics(laneH: number): { velBottom: number; velSpan: number } {
  const PAD_TOP = 4;
  /* Bottom-aligned to lane floor (removed old 4px float so bars arenâ€™t visibly lifted). */
  const velBottom = laneH;
  const velSpan = Math.max(10, laneH - PAD_TOP);
  return { velBottom, velSpan };
}

function hitVelocityNoteIndex(notes: MockMidiNote[], xCss: number, yCss: number, ppb: number, laneH: number): number {
  const { velBottom, velSpan } = pianoVelocityLaneMetrics(laneH);
  for (let i = notes.length - 1; i >= 0; i--) {
    const ev = notes[i];
    const x0 = beatColumnLeftPx(ev.startBeat, ppb);
    const x1 = beatColumnLeftPx(ev.startBeat + ev.durationBeats, ppb);
    const barW = Math.max(2, x1 - x0);
    if (xCss < x0 || xCss >= x0 + barW) continue;
    const vh = (ev.velocity / 127) * velSpan;
    const y0 = velBottom - vh;
    if (yCss >= y0 - 2 && yCss <= velBottom + 2) return i;
  }
  return -1;
}

function velocityFromLaneY(yCss: number, laneH: number): number {
  const { velBottom, velSpan } = pianoVelocityLaneMetrics(laneH);
  const fromBottom = velBottom - yCss;
  const v = Math.round((fromBottom / velSpan) * 127);
  return Math.max(1, Math.min(127, v));
}

const PIANO_NOTE_RESIZE_EDGE_PX = 6;
const AUDIO_CLIP_RESIZE_EDGE_PX = 8;
const PIANO_MIN_NOTE_DURATION_BEATS = 1 / 16;

type PianoRollTool = 'select' | 'pencil' | 'erase';

/** Timeline / track arrange tools (independent of piano roll). */
type TimelineArrangeTool = 'select' | 'slice' | 'scrub';

function syncPianoRollCanvas(
  canvas: HTMLCanvasElement | null,
  cacheRef: { current: HTMLCanvasElement | null },
  track: MockMusioTrack,
  zoom: number,
  selectedNoteIndex: number | null,
  beatsPerBar: number,
  snapSubdivisions: number,
  pitchView: PianoRollPitchView,
  selectedNoteIndexes?: ReadonlySet<number>,
  ghostNotes?: MockMidiNote[],
  showScaleGuides = false,
  scaleRootPitch = 0,
  scaleMode: StudioDetectedKeyMode = 'major',
  scrollLeftCss = 0,
  viewportWidthCss = 1200,
): void {
  if (!canvas) return;
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  /* Long-form arrangements (1800 bars) make the full strip wider than the browser's
   * max canvas bitmap, which renders BLANK. Paint only a scroll-following viewport
   * window (mirrors the timeline grid's se2ComputeGridViewport windowing). */
  const fullW = TOTAL_WIDTH_PX * zoom;
  const maxCssBitmap = SE2_MAX_GRID_BITMAP_PX / dpr;
  const useViewport = fullW > maxCssBitmap;
  let viewStart = 0;
  let paintW = fullW;
  if (useViewport) {
    const vp = se2ComputeGridViewport(fullW, scrollLeftCss, viewportWidthCss);
    viewStart = vp.viewStart;
    paintW = Math.min(vp.paintWidth, maxCssBitmap);
  }
  const xOff = viewStart;
  const w = useViewport ? paintW : fullW;
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const totalBeats = totalBeatsForSig(bpb);
  const ppb = ppbAtZoom(zoom, bpb);
  const beatFirst = useViewport ? Math.max(0, Math.floor(viewStart / ppb)) : 0;
  const beatLast = useViewport
    ? Math.min(totalBeats, Math.ceil((viewStart + paintW) / ppb) + 1)
    : totalBeats;
  const h = pianoGridHeightPx(pitchView);
  const rowH = pitchView.rowH;
  const bw = Math.max(1, Math.round(w * dpr));
  const bh = Math.max(1, Math.round(h * dpr));
  const snapDiv = Math.max(1, Math.min(64, Math.round(snapSubdivisions)));

  let off = cacheRef.current;
  const ver = off && '__pVer' in off ? (off as HTMLCanvasElement & { __pVer: number }).__pVer : -1;
  const selSig = selectedNoteIndexes ? [...selectedNoteIndexes].sort((a, b) => a - b).join(',') : '';
  const ghostSig = ghostNotes?.length ?? 0;
  const rowSig = pitchView.rowPitches?.join(',') ?? '';
  const key = `${zoom}|${bpb}|${snapDiv}|${pitchView.pitchLo}|${pitchView.pitchHi}|${rowSig}|${rowH}|${track.id}|${track.name}|${track.colorHex}|${tracksSignature([track])}|s:${selectedNoteIndex ?? 'n'}|ss:${selSig}|g:${ghostSig}|sg:${showScaleGuides ? 1 : 0}|r:${scaleRootPitch}|m:${scaleMode}${useViewport ? `|vs:${Math.round(viewStart)}|pw:${Math.round(paintW)}` : ''}`;
  const prevKey = off && '__pKey' in off ? (off as HTMLCanvasElement & { __pKey: string }).__pKey : '';
  let didRebuild = false;
  if (!off || off.width !== bw || off.height !== bh || ver !== PIANO_GRID_CACHE_VER || prevKey !== key) {
    didRebuild = true;
    off = document.createElement('canvas');
    (off as HTMLCanvasElement & { __pVer: number }).__pVer = PIANO_GRID_CACHE_VER;
    (off as HTMLCanvasElement & { __pKey: string }).__pKey = key;
    off.width = bw;
    off.height = bh;
    cacheRef.current = off;
    const og = off.getContext('2d');
    if (!og) return;
    og.imageSmoothingEnabled = false;
    og.setTransform(dpr, 0, 0, dpr, 0, 0);
    og.fillStyle = '#0a0a0f';
    og.fillRect(0, 0, w, h);

    const rows = pianoPitchRowCount(pitchView);
    for (let row = 0; row < rows; row += 1) {
      const p = pianoPitchForRow(pitchView, row);
      const y = pitchRowY0(p, pitchView) - 1;
      const isB = isBlackKeyPitch(p);
      og.fillStyle = isB ? '#0c0c14' : '#101018';
      og.fillRect(0, y, w, rowH);
      if (showScaleGuides) {
        const pc = ((p % 12) + 12) % 12;
        const rootPc = ((scaleRootPitch % 12) + 12) % 12;
        if (pc === rootPc) {
          og.fillStyle = 'rgba(124,244,198,0.08)';
          og.fillRect(0, y, w, rowH);
        } else if (studioScaleIntervals(scaleMode).includes((pc - rootPc + 12) % 12)) {
          og.fillStyle = 'rgba(124,244,198,0.035)';
          og.fillRect(0, y, w, rowH);
        }
      }
      og.strokeStyle = 'rgba(255,255,255,0.12)';
      og.lineWidth = 1;
      og.beginPath();
      og.moveTo(0, y + rowH - 0.5);
      og.lineTo(w, y + rowH - 0.5);
      og.stroke();
    }

    // Draw snap-subdivision grid lines so every quantize position is visible.
    // Bar lines (brightest) Ã¢â€ â€™ beat lines Ã¢â€ â€™ snap sub-beat lines Ã¢â€ â€™ finer lines (dimmer).
    /* Vertical grid lines + notes live in world-x; shift into the painted window. */
    og.save();
    og.translate(-xOff, 0);

    if (snapDiv > 1) {
      // Draw snap subdivision lines first (faintest), behind beat lines.
      const cellBeats = 1 / snapDiv;
      const firstCell = Math.max(0, Math.floor(beatFirst * snapDiv));
      const lastCell = Math.ceil(beatLast * snapDiv);
      for (let ci = firstCell; ci <= lastCell; ci++) {
        const beatPos = ci * cellBeats;
        if (beatPos % 1 < 1e-9 || Math.abs(beatPos % 1 - 1) < 1e-9) continue; // skip exact beats
        const gx = beatColumnLeftPx(beatPos, ppb);
        if (gx < xOff || gx > xOff + paintW) continue;
        og.fillStyle = 'rgba(255,255,255,0.07)';
        og.fillRect(gx, 0, 1, h);
      }
    }

    // Beat lines (quarter-note columns)
    for (let beat = beatFirst; beat <= beatLast; beat++) {
      const gx = beatColumnLeftPx(beat, ppb);
      const isBar = beat % bpb === 0;
      og.fillStyle = isBar ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.12)';
      og.fillRect(gx, 0, 1, h);
    }

    (ghostNotes ?? []).forEach((ev) => {
      const x0 = beatColumnLeftPx(ev.startBeat, ppb);
      const x1 = beatColumnLeftPx(ev.startBeat + midiNoteRollDurationBeats(ev), ppb);
      const wNote = Math.max(2, x1 - x0);
      const y = pitchRowY0(ev.pitch, pitchView);
      const nh = Math.max(2, rowH - 2);
      og.fillStyle = 'rgba(135,135,165,0.2)';
      if (typeof og.roundRect === 'function') {
        og.beginPath();
        og.roundRect(x0, y, wNote, nh, 1.5);
        og.fill();
      } else {
        og.fillRect(x0, y, wNote, nh);
      }
    });

    track.notes.forEach((ev, ni) => {
      const x0 = beatColumnLeftPx(ev.startBeat, ppb);
      const x1 = beatColumnLeftPx(ev.startBeat + midiNoteRollDurationBeats(ev), ppb);
      const wNote = Math.max(3, x1 - x0);
      const x = x0;
      const y = pitchRowY0(ev.pitch, pitchView);
      const nh = Math.max(2, rowH - 2);
      og.fillStyle = rgbaNoteFill(track.colorHex, ev.velocity);
      const r = 2;
      if (typeof og.roundRect === 'function') {
        og.beginPath();
        og.roundRect(x, y, wNote, nh, r);
        og.fill();
      } else {
        og.fillRect(x, y, wNote, nh);
      }
      og.fillStyle = '#ffffff';
      og.globalAlpha = 0.08 + (ev.velocity / 127) * 0.22;
      if (typeof og.roundRect === 'function') {
        og.beginPath();
        og.roundRect(x, y, wNote, nh, r);
        og.fill();
      } else {
        og.fillRect(x, y, wNote, nh);
      }
      og.globalAlpha = 1;
      if ((selectedNoteIndexes?.has(ni) ?? false) || selectedNoteIndex === ni) {
        const selR = typeof og.roundRect === 'function' ? r + 0.5 : r;
        og.fillStyle = 'rgba(124,244,198,0.22)';
        if (typeof og.roundRect === 'function') {
          og.beginPath();
          og.roundRect(x - 0.5, y - 0.5, wNote + 1, nh + 1, selR);
          og.fill();
        } else {
          og.fillRect(x - 0.5, y - 0.5, wNote + 1, nh + 1);
        }
        og.shadowColor = 'rgba(124,244,198,0.45)';
        og.shadowBlur = 8;
        og.strokeStyle = '#7cf4c6';
        og.lineWidth = 2;
        if (typeof og.roundRect === 'function') {
          og.beginPath();
          og.roundRect(x + 0.5, y + 0.5, wNote - 1, nh - 1, r);
          og.stroke();
        } else {
          og.strokeRect(x + 0.5, y + 0.5, wNote - 1, nh - 1);
        }
        og.shadowBlur = 0;
        og.strokeStyle = 'rgba(255,255,255,0.9)';
        og.lineWidth = 1;
        if (typeof og.roundRect === 'function') {
          og.beginPath();
          og.roundRect(x + 1.5, y + 1.5, Math.max(0, wNote - 3), Math.max(0, nh - 3), Math.max(0.5, r - 0.5));
          og.stroke();
        }
      }
    });

    og.restore();
  }

  const g = canvas.getContext('2d');
  if (!g) return;
  g.imageSmoothingEnabled = false;
  const hadResize = canvas.width !== bw || canvas.height !== bh;
  if (hadResize) {
    canvas.width = bw;
    canvas.height = bh;
    canvas.style.height = `${h}px`;
  }
  canvas.style.width = `${w}px`;
  canvas.style.marginLeft = `${useViewport ? xOff : 0}px`;
  off = cacheRef.current;
  if (!off) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  /* Always blit â€” resizing the display canvas clears it; conditional blit left notes invisible. */
  g.drawImage(off, 0, 0, w, h);
}

/**
 * Velocity lane grid Ã¢â‚¬â€ same beat columns as the note grid (`beatColumnLeftPx`), Studio-style:
 * snap-subdivision lines, beat lines, bar lines, then horizontal velocity guides.
 */
function drawPianoVelocityLaneGrid(
  og: CanvasRenderingContext2D,
  w: number,
  laneH: number,
  ppb: number,
  zoom: number,
  totalBeats: number,
  beatsPerBar: number,
  snapSubdivisions: number,
): void {
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const snapDiv = Math.max(1, Math.min(64, Math.round(snapSubdivisions)));
  if (snapDiv > 1) {
    const cellBeats = 1 / snapDiv;
    const totalCells = Math.ceil(totalBeats * snapDiv);
    for (let ci = 0; ci <= totalCells; ci++) {
      const beatPos = ci * cellBeats;
      if (beatPos % 1 < 1e-9 || Math.abs(beatPos % 1 - 1) < 1e-9) continue;
      const gx = beatColumnLeftPx(beatPos, ppb);
      if (gx <= 0 || gx >= w) continue;
      og.fillStyle = 'rgba(255,255,255,0.055)';
      og.fillRect(gx, 0, 1, laneH);
    }
  }
  for (let beat = 0; beat <= totalBeats; beat++) {
    const gx = beatColumnLeftPx(beat, ppb);
    const isBar = beat % bpb === 0;
    og.fillStyle = isBar ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)';
    og.fillRect(gx, 0, 1, laneH);
  }
}

function syncPianoVelocityCanvas(
  canvas: HTMLCanvasElement | null,
  cacheRef: { current: HTMLCanvasElement | null },
  track: MockMusioTrack,
  zoom: number,
  beatsPerBar: number,
  snapSubdivisions: number,
): void {
  if (!canvas) return;
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const w = TOTAL_WIDTH_PX * zoom;
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const totalBeats = totalBeatsForSig(bpb);
  const ppb = ppbAtZoom(zoom, bpb);
  const laneH = PIANO_VELOCITY_LANE_H_PX;
  const bw = Math.max(1, Math.round(w * dpr));
  const bh = Math.max(1, Math.round(laneH * dpr));
  const snapDiv = Math.max(1, Math.min(64, Math.round(snapSubdivisions)));

  let off = cacheRef.current;
  const ver = off && '__vVer' in off ? (off as HTMLCanvasElement & { __vVer: number }).__vVer : -1;
  const key = `${zoom}|${bpb}|${snapDiv}|${track.id}|${track.name}|${track.colorHex}|v|${tracksSignature([track])}`;
  const prevKey = off && '__vKey' in off ? (off as HTMLCanvasElement & { __vKey: string }).__vKey : '';
  let didRebuild = false;
  if (!off || off.width !== bw || off.height !== bh || ver !== PIANO_GRID_CACHE_VER || prevKey !== key) {
    didRebuild = true;
    off = document.createElement('canvas');
    (off as HTMLCanvasElement & { __vVer: number }).__vVer = PIANO_GRID_CACHE_VER;
    (off as HTMLCanvasElement & { __vKey: string }).__vKey = key;
    off.width = bw;
    off.height = bh;
    cacheRef.current = off;
    const og = off.getContext('2d');
    if (!og) return;
    og.imageSmoothingEnabled = false;
    og.setTransform(dpr, 0, 0, dpr, 0, 0);
    og.fillStyle = '#0c0c12';
    og.fillRect(0, 0, w, laneH);
    drawPianoVelocityLaneGrid(og, w, laneH, ppb, zoom, totalBeats, bpb, snapDiv);

    const rgb = hexToRgb(track.colorHex);
    const baseR = rgb?.r ?? 91;
    const baseG = rgb?.g ?? 140;
    const baseB = rgb?.b ?? 255;
    const { velBottom, velSpan } = pianoVelocityLaneMetrics(laneH);

    for (const ev of track.notes) {
      const x0 = beatColumnLeftPx(ev.startBeat, ppb);
      const x1 = beatColumnLeftPx(ev.startBeat + midiNoteRollDurationBeats(ev), ppb);
      const barW = Math.max(2, x1 - x0);
      const x = x0;
      const vh = (ev.velocity / 127) * velSpan;
      const y0 = velBottom - vh;
      og.fillStyle = `rgba(${baseR},${baseG},${baseB},${0.35 + (ev.velocity / 127) * 0.45})`;
      if (typeof og.roundRect === 'function') {
        og.beginPath();
        og.roundRect(x, y0, barW, vh, 1);
        og.fill();
      } else {
        og.fillRect(x, y0, barW, vh);
      }
    }

    og.strokeStyle = 'rgba(255,255,255,0.2)';
    og.lineWidth = 1;
    og.beginPath();
    og.moveTo(0, laneH - 0.5);
    og.lineTo(w, laneH - 0.5);
    og.stroke();
  }

  const g = canvas.getContext('2d');
  if (!g) return;
  g.imageSmoothingEnabled = false;
  const hadResize = canvas.width !== bw || canvas.height !== bh;
  if (hadResize) {
    canvas.width = bw;
    canvas.height = bh;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${laneH}px`;
  }
  off = cacheRef.current;
  if (!off) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.drawImage(off, 0, 0, w, laneH);
}

type MusioPianoRollPanelProps = {
  visible: boolean;
  panelHeight: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  onResizeStart: (e: MouseEvent<HTMLButtonElement>) => void;
  zoom: number;
  beatsPerBar: number;
  snapSubdivisions: number;
  onBeatsPerBarChange: (n: number) => void;
  onSnapSubdivisionsChange: (n: number) => void;
  tracks: MockMusioTrack[];
  selectedTrackIndex: number;
  onSelectTrackIndex: (i: number) => void;
  onUpdateTrackNotes: (trackIndex: number, notes: MockMidiNote[]) => void;
  tool: PianoRollTool;
  onToolChange: (t: PianoRollTool) => void;
  selectedNoteIndex: number | null;
  selectedNoteIndexes: ReadonlySet<number>;
  onSelectNoteIndex: (i: number | null) => void;
  onToggleNoteIndex: (i: number) => void;
  onSelectOnlyNoteIndex: (i: number | null) => void;
  onSetSelectedNoteIndexes: (indexes: Set<number>) => void;
  onClearSelectedNotes: () => void;
  playheadRef: RefObject<HTMLDivElement | null>;
  running: boolean;
  loopOn: boolean;
  onLoopOnChange: (v: boolean) => void;
  loopBars: number;
  onLoopBarsChange: (n: number) => void;
  /** Loop region in beats (same as timeline; piano roll repeats the tinted region visuals). */
  loopStartBeat: number;
  loopEndBeat: number;
  onPauseForEdit: () => void | Promise<void>;
  /** Bar ruler click / drag Ã¢â‚¬â€ horizontal beat seek (Musio piano ruler). */
  onSeekFromPianoRuler: (stripXCss: number) => void;
  /** Live MIDI audition Ã¢â‚¬â€ optional; use `@/app/lib/studioMidiBackend` from a parent callback when wiring. */
  onPreviewPitch?: (pitch: number, velocity01?: number) => void;
  /** Parent opens edit context menu (right-click piano grid / velocity). */
  onNotesContextMenu?: (info: { clientX: number; clientY: number; noteHitIndex: number | null }) => void;
  onQuantizeSelected: () => void;
  onDuplicateSelectedPhrase: () => void;
  onTransposeSelected: (semi: number) => void;
  /** Move every note on this track up/down (whole loop — ignores selection). */
  onTransposeAllTrackNotes: (semi: number) => void;
  onHumanizeSelected: () => void;
  onLegatoSelected: () => void;
  onArpeggiateSelected: () => void;
  onStrumSelected: () => void;
  onChopSelected: () => void;
  onRandomizeVelocitySelected: () => void;
  onQuantizeStrengthChange: (n: number) => void;
  quantizeStrength: number;
  onQuantizeSwingChange: (n: number) => void;
  quantizeSwing: number;
  showGhostNotes: boolean;
  onShowGhostNotesChange: (v: boolean) => void;
  showScaleGuides: boolean;
  onShowScaleGuidesChange: (v: boolean) => void;
  songKeyRoot: number;
  songKeyMode: StudioDetectedKeyMode;
  onDetectTrackKey: () => void;
  onConvertTrackToSongKey: () => void;
  /** Fits all track notes in the visible grid (no vertical scroll). */
  pitchView: PianoRollPitchView;
  /** Drum lane â€” pad labels on the key strip instead of piano keys. */
  drumKeyLabelForPitch?: (pitch: number) => string | undefined;
  /** Drum track â€” wipe all pattern notes from the grid. */
  onClearPattern?: () => void;
  clearPatternDisabled?: boolean;
  /** Instrument-channel harmony builder slot (piano roll toolbar). */
  harmonyToolbar?: React.ReactNode;
  /** Rhythm-edit lane â€” built-in hits-per-bar editor above the grid. */
  rhythmEditPanel?: React.ReactNode;
  /** Bass Glide lane â€” synth / glide editor above the grid. */
  glideBassEditPanel?: React.ReactNode;
  glideBassStripOpen?: boolean;
  synthGenoEditPanel?: React.ReactNode;
  synthGenoStripOpen?: boolean;
  synthGenoBuildFullscreenOpen?: boolean;
  grooveLeadEditPanel?: React.ReactNode;
  grooveLeadStripOpen?: boolean;
  lab808EditPanel?: React.ReactNode;
  lab808StripOpen?: boolean;
  genoUltraSynthEditPanel?: React.ReactNode;
  genoUltraSynthStripOpen?: boolean;
  genoBassSynthEditPanel?: React.ReactNode;
  genoBassSynthStripOpen?: boolean;
  drumGeneratorEditPanel?: React.ReactNode;
  drumGeneratorStripOpen?: boolean;
  chordGenieEditPanel?: React.ReactNode;
  chordGenieStripOpen?: boolean;
  beatPadsEditPanel?: React.ReactNode;
  beatPadsStripOpen?: boolean;
  humCaptureEditPanel?: React.ReactNode;
  humCaptureStripOpen?: boolean;
  guitarEditPanel?: React.ReactNode;
  guitarStripOpen?: boolean;
  /** Change GM / synth / lead sound for this MIDI lane (incl. rhythm + A2M). */
  onMidiInstrumentChange?: (instrumentId: string) => void;
  /** Bass Glide lane — show synth preset instead of GM instrument picker. */
  glideBassPresetId?: string;
  /** Synth Geno lane — generated patch label in toolbar. */
  synthGenoPatchLabel?: string;
  /** Groove Lead lane — WaveLeaf preset label in toolbar. */
  grooveLeadPatchLabel?: string;
  /** 808 Lab lane — kick/bass preset label in toolbar. */
  lab808PatchLabel?: string;
  genoUltraPatchLabel?: string;
  genoBassPatchLabel?: string;
  /** Hum Capture lane — instrument label in toolbar. */
  humCaptureInstrumentLabel?: string;
  /** Guitar lane — tone label in toolbar. */
  guitarInstrumentLabel?: string;
};

function MusioPianoRollPanel({
  visible,
  panelHeight,
  expanded,
  onToggleExpanded,
  onResizeStart,
  zoom,
  beatsPerBar,
  snapSubdivisions,
  onBeatsPerBarChange,
  onSnapSubdivisionsChange,
  tracks,
  selectedTrackIndex,
  onSelectTrackIndex,
  onUpdateTrackNotes,
  tool,
  onToolChange,
  selectedNoteIndex,
  selectedNoteIndexes,
  onSelectNoteIndex,
  onToggleNoteIndex,
  onSelectOnlyNoteIndex,
  onSetSelectedNoteIndexes,
  onClearSelectedNotes,
  playheadRef,
  running,
  loopOn,
  onLoopOnChange,
  loopBars,
  onLoopBarsChange,
  loopStartBeat,
  loopEndBeat,
  onPauseForEdit,
  onSeekFromPianoRuler,
  onPreviewPitch,
  onNotesContextMenu,
  onQuantizeSelected,
  onDuplicateSelectedPhrase,
  onTransposeSelected,
  onTransposeAllTrackNotes,
  onHumanizeSelected,
  onLegatoSelected,
  onArpeggiateSelected,
  onStrumSelected,
  onChopSelected,
  onRandomizeVelocitySelected,
  onQuantizeStrengthChange,
  quantizeStrength,
  onQuantizeSwingChange,
  quantizeSwing,
  showGhostNotes,
  onShowGhostNotesChange,
  showScaleGuides,
  onShowScaleGuidesChange,
  songKeyRoot,
  songKeyMode,
  onDetectTrackKey,
  onConvertTrackToSongKey,
  pitchView,
  drumKeyLabelForPitch,
  onClearPattern,
  clearPatternDisabled = false,
  harmonyToolbar,
  rhythmEditPanel,
  glideBassEditPanel,
  glideBassStripOpen = false,
  synthGenoEditPanel,
  synthGenoStripOpen = false,
  synthGenoBuildFullscreenOpen = false,
  grooveLeadEditPanel,
  grooveLeadStripOpen = false,
  lab808EditPanel,
  lab808StripOpen = false,
  genoUltraSynthEditPanel,
  genoUltraSynthStripOpen = false,
  genoBassSynthEditPanel,
  genoBassSynthStripOpen = false,
  drumGeneratorEditPanel,
  drumGeneratorStripOpen = false,
  chordGenieEditPanel,
  chordGenieStripOpen = false,
  beatPadsEditPanel,
  beatPadsStripOpen = false,
  humCaptureEditPanel,
  humCaptureStripOpen = false,
  guitarEditPanel,
  guitarStripOpen = false,
  onMidiInstrumentChange,
  glideBassPresetId,
  synthGenoPatchLabel,
  grooveLeadPatchLabel,
  lab808PatchLabel,
  genoUltraPatchLabel,
  genoBassPatchLabel,
  humCaptureInstrumentLabel,
  guitarInstrumentLabel,
}: MusioPianoRollPanelProps) {
  const trackIndex =
    tracks.length > 0 ? Math.max(0, Math.min(tracks.length - 1, selectedTrackIndex)) : -1;
  const track = trackIndex >= 0 ? tracks[trackIndex] : undefined;

  if (!track) {
    if (!visible) return null;
    return (
      <div
        className="flex flex-1 min-h-0 items-center justify-center border-t px-3 py-2 shrink-0"
        style={{
          borderColor: '#1a1a22',
          background: '#07070a',
          minHeight: Math.max(PIANO_PANEL_H_MIN, panelHeight),
        }}
      >
        <span className="text-[8px] font-bold uppercase tracking-wide text-center" style={{ color: '#5c5c68' }}>
          No tracks yet — use + Add on the timeline. Master bus stays in the mixer.
        </span>
      </div>
    );
  }

  const isAudioTrack = track.kind === 'audio';
  const isTrackAlignLane = se2TrackIsTrackAlign(track.kind);
  const isAudioLikeLane = isAudioTrack || isTrackAlignLane;
  const isMidiLane = studioTrackOutputsMidi(track);
  const isDrumLane = studioTrackIsDrumChannel(track);
  const isGlideBassLane = track.kind === 'glideBass';
  const isSynthGenoLane = track.kind === 'synthGeno';
  const isGrooveLeadLane = track.kind === 'grooveLead';
  const isLab808Lane = track.kind === 'lab808';
  const isGenoUltraSynthLane = track.kind === 'genoUltraSynth';
  const isGenoBassSynthLane = track.kind === 'genoBassSynth';
  const isDrumGeneratorLane = track.kind === 'drumGenerator';
  const isBeatPadsLane = track.kind === 'beatPads';
  const isHumCaptureLane = track.kind === 'humCapture';
  const isGuitarLane = track.kind === 'guitar';
  const isGenoChordCreatorLane = track.kind === 'genoChordCreator' || track.kind === 'chordGenie';
  const midiCh = studioMidiChannelForTrack(trackIndex, tracks);
  const lanePad = Math.max(2, String(tracks.length).length);
  const trackNumbered = (tr: MockMusioTrack) => se2TrackNumberedName(tr.laneNumber, tr.name, lanePad);
  const gridSlotRef = useRef<HTMLDivElement | null>(null);
  const [gridSlotH, setGridSlotH] = useState(0);
  const [hScroll, setHScroll] = useState(0);
  const [velocityLaneOpen, setVelocityLaneOpen] = useState(false);
  const [pressedPitches, setPressedPitches] = useState<Set<number>>(() => new Set());
  const keyStripShellRef = useRef<HTMLDivElement | null>(null);
  const keyStripPointerToPitchRef = useRef<Map<number, number>>(new Map());
  const pianoGridCacheRef = useRef<HTMLCanvasElement | null>(null);
  const pianoVelCacheRef = useRef<HTMLCanvasElement | null>(null);
  const pianoGridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pianoVelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hScrollRef = useRef<HTMLDivElement | null>(null);
  const rulerCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const totalBeats = totalBeatsForSig(bpb);
  const snapS = normalizePianoSnapSubdiv(snapSubdivisions);
  const stripW = TOTAL_WIDTH_PX * zoom;
  const ppb = ppbAtZoom(zoom, bpb);
  const ghostNotes = useMemo(
    () =>
      showGhostNotes
        ? tracks
            .filter((t, i) => i !== selectedTrackIndex && t.kind === 'midi')
            .flatMap((t) => t.notes.map((n) => ({ ...n })))
        : [],
    [showGhostNotes, tracks, selectedTrackIndex],
  );
  const trackNotesSig = tracksSignature([track]);
  const effectivePitchView = useMemo(() => {
    if (expanded) return pitchView;
    if (gridSlotH < 40) return pitchView;
    if (drumKeyLabelForPitch) return pitchView;
    if (isGrooveLeadLane) return computeSe2GrooveLeadPianoRollPitchView(gridSlotH);
    if (isLab808Lane) return computeSe2Lab808PianoRollPitchView(gridSlotH);
    const notesForFit =
      isGlideBassLane && track.notes.length === 0
        ? se2GlideBassPitchSpanNotes()
        : isGenoUltraSynthLane && track.notes.length === 0
          ? se2GenoUltraPitchSpanNotes()
          : isGenoBassSynthLane && track.notes.length === 0
              ? se2GenoBassPitchSpanNotes()
            : isHumCaptureLane && track.notes.length === 0
              ? se2HumCapturePitchSpanNotes()
              : track.notes;
    return computePianoRollPanelPitchView(notesForFit, gridSlotH);
  }, [expanded, pitchView, gridSlotH, track.notes, trackNotesSig, drumKeyLabelForPitch, isGlideBassLane, isGrooveLeadLane, isLab808Lane, isGenoUltraSynthLane, isGenoBassSynthLane, isHumCaptureLane]);
  const gridH = pianoGridHeightPx(effectivePitchView);
  const rowCount = pianoPitchRowCount(effectivePitchView);
  const { pitchLo, pitchHi, rowH } = effectivePitchView;
  const detectedKey = studioTrackDetectedKey(track);
  const trackHasKey = detectedKey.keyRoot != null && detectedKey.keyMode != null;
  const effectiveScaleGuides = showScaleGuides || trackHasKey;
  const scaleRootPitch = trackHasKey
    ? (detectedKey.keyRoot ?? 0)
    : (track.notes[selectedNoteIndex ?? 0]?.pitch ?? 0);
  const scaleMode: StudioDetectedKeyMode = trackHasKey ? (detectedKey.keyMode ?? 'major') : 'major';
  const a2mBpmLabel =
    track.kind === 'a2m' && track.a2mDetectedBpm
      ? `${Math.round(track.a2mDetectedBpm)} BPM`
      : '';

  useLayoutEffect(() => {
    if (!visible || isAudioTrack) return;
    const el = gridSlotRef.current;
    if (!el) return;
    const measure = () => setGridSlotH(Math.max(0, el.clientHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visible, isAudioTrack, expanded, panelHeight, trackNotesSig, velocityLaneOpen]);

  useLayoutEffect(() => {
    if (!visible || isAudioTrack) return;
    syncPianoRollCanvas(
      pianoGridCanvasRef.current,
      pianoGridCacheRef,
      track,
      zoom,
      selectedNoteIndex,
      bpb,
      snapS,
      effectivePitchView,
      selectedNoteIndexes,
      ghostNotes,
      effectiveScaleGuides,
      scaleRootPitch,
      scaleMode,
      hScroll,
      hScrollRef.current?.clientWidth ?? 1200,
    );
    if (velocityLaneOpen) {
      syncPianoVelocityCanvas(pianoVelCanvasRef.current, pianoVelCacheRef, track, zoom, bpb, snapS);
    }
  }, [
    visible,
    isAudioTrack,
    track,
    trackNotesSig,
    zoom,
    hScroll,
    selectedNoteIndex,
    selectedNoteIndexes,
    ghostNotes,
    effectiveScaleGuides,
    scaleRootPitch,
    scaleMode,
    bpb,
    snapS,
    effectivePitchView,
    velocityLaneOpen,
  ]);

  useLayoutEffect(() => {
    if (!visible) return;
    const node = rulerCanvasRef.current;
    if (!node) return;
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const fullW = stripW;
    const maxCssBitmap = SE2_MAX_GRID_BITMAP_PX / dpr;
    const useViewport = fullW > maxCssBitmap;
    let viewStart = 0;
    let paintW = fullW;
    const viewportWidthCss = hScrollRef.current?.clientWidth ?? 1200;
    if (useViewport) {
      const vp = se2ComputeGridViewport(fullW, hScroll, viewportWidthCss);
      viewStart = vp.viewStart;
      paintW = Math.min(vp.paintWidth, maxCssBitmap);
    }
    const beatFirst = useViewport ? Math.max(0, Math.floor(viewStart / ppb)) : 0;
    const beatLast = useViewport
      ? Math.min(totalBeats, Math.ceil((viewStart + paintW) / ppb) + 1)
      : totalBeats;
    const barFirst = Math.floor(beatFirst / bpb);
    const barLast = useViewport ? Math.min(BARS, Math.ceil((beatLast + 1) / bpb)) : BARS;
    const rw = Math.max(1, Math.round(paintW * dpr));
    const rh = Math.max(1, Math.round(PIANO_RULER_H_PX * dpr));
    node.width = rw;
    node.height = rh;
    node.style.width = `${paintW}px`;
    node.style.marginLeft = `${useViewport ? viewStart : 0}px`;
    node.style.height = `${PIANO_RULER_H_PX}px`;
    const ctx = node.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0c0c12';
    ctx.fillRect(0, 0, paintW, PIANO_RULER_H_PX);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8a8a98';
    ctx.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    for (let barIdx = barFirst; barIdx < barLast; barIdx++) {
      const localX = beatColumnLeftPx(barIdx * bpb, ppb) + 4 - viewStart;
      if (localX < -40 || localX > paintW + 4) continue;
      ctx.fillText(String(barIdx + 1), localX, PIANO_RULER_H_PX / 2);
    }
  }, [visible, stripW, ppb, bpb, hScroll, totalBeats]);

  useEffect(() => {
    if (!visible) return;
    const el = hScrollRef.current;
    if (!el) return;
    const ro = () => setHScroll(el.scrollLeft);
    ro();
    el.addEventListener('scroll', ro, { passive: true });
    return () => el.removeEventListener('scroll', ro);
  }, [visible, stripW]);

  useEffect(() => {
    if (!visible) {
      setPressedPitches(new Set());
      keyStripPointerToPitchRef.current.clear();
    }
  }, [visible]);

  const pianoInteractRef = useRef({
    stripW,
    ppb,
    track,
    selectedTrackIndex,
    onUpdateTrackNotes,
    onSelectNoteIndex,
    onToggleNoteIndex,
    onSelectOnlyNoteIndex,
    onSetSelectedNoteIndexes,
    onClearSelectedNotes,
    snapSubdivisions: snapS,
    totalBeats,
    onPreviewPitch,
    pitchView: effectivePitchView,
    gridH,
    rowH,
    pitchLo,
    pitchHi,
  });
  pianoInteractRef.current = {
    stripW,
    ppb,
    track,
    selectedTrackIndex,
    onUpdateTrackNotes,
    onSelectNoteIndex,
    onToggleNoteIndex,
    onSelectOnlyNoteIndex,
    onSetSelectedNoteIndexes,
    onClearSelectedNotes,
    snapSubdivisions: snapS,
    totalBeats,
    onPreviewPitch,
    pitchView: effectivePitchView,
    gridH,
    rowH,
    pitchLo,
    pitchHi,
  };

  const syncKeyStripPressedVisual = useCallback((immediateVisual?: boolean) => {
    const next = () => setPressedPitches(new Set(keyStripPointerToPitchRef.current.values()));
    if (immediateVisual) flushSync(next);
    else next();
  }, []);

  const onKeyStripPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.pointerType === 'pen' && e.button !== 0) return;
      if (e.pointerType === 'touch' && !e.isPrimary) return;
      e.stopPropagation();
      const shell = e.currentTarget as HTMLDivElement;
      const pitch = pitchFromKeyStripElement(shell, e.clientY, effectivePitchView);
      if (pitch === null) return;
      try {
        shell.setPointerCapture(e.pointerId);
      } catch {
        /* some browsers disallow capture on discarded streams */
      }
      keyStripPointerToPitchRef.current.set(e.pointerId, pitch);
      syncKeyStripPressedVisual(true);
      const vel = velocity01FromKeyStripStrike(shell, e.clientY, pitch, effectivePitchView);
      void pianoInteractRef.current.onPreviewPitch?.(pitch, vel);
    },
    [syncKeyStripPressedVisual, effectivePitchView],
  );

  const onKeyStripPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!keyStripPointerToPitchRef.current.has(e.pointerId)) return;
      const shell = e.currentTarget as HTMLDivElement;
      const pitch = pitchFromKeyStripElement(shell, e.clientY, effectivePitchView);
      if (pitch === null) {
        keyStripPointerToPitchRef.current.delete(e.pointerId);
        try {
          if (typeof shell.releasePointerCapture === 'function') shell.releasePointerCapture(e.pointerId);
        } catch {
          /**/
        }
        syncKeyStripPressedVisual();
        return;
      }
      const prev = keyStripPointerToPitchRef.current.get(e.pointerId);
      if (prev !== pitch) {
        keyStripPointerToPitchRef.current.set(e.pointerId, pitch);
        syncKeyStripPressedVisual(true);
        void pianoInteractRef.current.onPreviewPitch?.(pitch, velocity01FromKeyStripStrike(shell, e.clientY, pitch, effectivePitchView));
      }
    },
    [syncKeyStripPressedVisual, effectivePitchView],
  );

  const onKeyStripPointerUpOrCancel = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!keyStripPointerToPitchRef.current.has(e.pointerId)) return;
      try {
        if (typeof e.currentTarget.releasePointerCapture === 'function')
          e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /**/
      }
      keyStripPointerToPitchRef.current.delete(e.pointerId);
      syncKeyStripPressedVisual(true);
    },
    [syncKeyStripPressedVisual],
  );

  /** Do not wipe â€œdownâ€ while pointer is captured (leave events still fire crossing children). */
  const onKeyStripPointerLeave = useCallback((e: PointerEvent<HTMLDivElement>) => {
    try {
      if (
        typeof (e.currentTarget as HTMLDivElement).hasPointerCapture === 'function' &&
        (e.currentTarget as HTMLDivElement).hasPointerCapture(e.pointerId)
      ) {
        return;
      }
    } catch {
      /**/
    }
    if (!keyStripPointerToPitchRef.current.has(e.pointerId)) return;
    keyStripPointerToPitchRef.current.delete(e.pointerId);
    syncKeyStripPressedVisual(true);
  }, [syncKeyStripPressedVisual]);

  const onKeyStripLostPointerCapture = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      keyStripPointerToPitchRef.current.delete(e.pointerId);
      syncKeyStripPressedVisual(true);
    },
    [syncKeyStripPressedVisual],
  );

  const onKeyStripClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    /* Sound is triggered in onPointerDown â€” stop propagation only. */
    e.stopPropagation();
  }, []);
  const paintDragRef = useRef(false);
  const dragToolRef = useRef<PianoRollTool | null>(null);
  const paintLastClientRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const pencilStrokeRef = useRef<{
    active: boolean;
    mode: 'line' | 'cells';
    anchorBeat: number;
    anchorPitch: number;
    strokeNoteIdx: number;
  } | null>(null);

  const noteDragRef = useRef<{
    active: boolean;
    mode: 'move' | 'resize';
    idx: number;
    beatPtrDown: number;
    rowPtrDown: number;
    anchorStart: number;
    anchorEnd: number;
    selectedSnapshot: { idx: number; startBeat: number; pitch: number; durationBeats: number }[];
    duplicatedViaAlt: boolean;
  }>({
    active: false,
    mode: 'move',
    idx: -1,
    beatPtrDown: 0,
    rowPtrDown: 0,
    anchorStart: 0,
    anchorEnd: 0,
    selectedSnapshot: [],
    duplicatedViaAlt: false,
  });

  const marqueeSelectRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    additive: boolean;
    baseSelection: Set<number>;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    curX: 0,
    curY: 0,
    additive: false,
    baseSelection: new Set<number>(),
  });
  const [marqueeBox, setMarqueeBox] = useState<null | { left: number; top: number; width: number; height: number }>(null);

  const selectedNoteIndexesRef = useRef(selectedNoteIndexes);
  selectedNoteIndexesRef.current = selectedNoteIndexes;

  const velPaintDragRef = useRef(false);
  const velDragToolRef = useRef<PianoRollTool | null>(null);
  const lastVelPaintKeyRef = useRef('');

  /** Piano pencil / erase: interpolate between client coords so fast drags donâ€™t skip snapped cells,
   *  and accumulate one `notes` snapshot per segment (avoid stale ref during gesture). */
  const paintGridBrushSegment = useCallback(
    (
      cx0: number,
      cy0: number,
      cx1: number,
      cy1: number,
      gridEl: HTMLDivElement,
      brush: PianoRollTool,
    ) => {
      if (brush !== 'pencil' && brush !== 'erase') return;
      const sh = pianoInteractRef.current;
      const hScrollEl = hScrollRef.current;

      const sampleStrip = (cx: number, cy: number) => {
        const x = pianoGridStripXFromClient(cx, hScrollEl);
        const y = pianoGridYFromClient(cy, gridEl);
        return { x, y, ok: x >= 0 && y >= 0 && x <= sh.stripW && y <= sh.gridH };
      };

      const dx = cx1 - cx0;
      const dy = cy1 - cy0;
      const dist = Math.hypot(dx, dy);
      const stepCount = Math.min(384, Math.max(1, Math.ceil(dist / 3)));

      if (brush === 'pencil') {
        let working = [...sh.track.notes];
        const segDone = new Set<string>();
        let lastNu: MockMidiNote | null = null;
        let changed = false;

        for (let s = 0; s <= stepCount; s++) {
          const tfrac = stepCount === 0 ? 0 : s / stepCount;
          const cx = cx0 + dx * tfrac;
          const cy = cy0 + dy * tfrac;
          const { x, y, ok } = sampleStrip(cx, cy);
          if (!ok) continue;
          const beat = snapBeatToSubdivision(x / sh.ppb, sh.snapSubdivisions, sh.totalBeats);
          const row = Math.floor(y / sh.rowH);
          const pitch = pianoPitchForRow(sh.pitchView, row);
          const cellKey = `${pitch}|${beat.toFixed(4)}`;
          if (segDone.has(cellKey)) continue;
          segDone.add(cellKey);

          const next = appendPianoGridNote(
            working,
            x,
            y,
            sh.ppb,
            sh.snapSubdivisions,
            sh.totalBeats,
            sh.stripW,
            sh.pitchView,
          );
          if (!next) continue;
          working = next;
          lastNu = working[working.length - 1] ?? null;
          changed = true;
        }

        if (changed) {
          flushSync(() => {
            sh.onUpdateTrackNotes(sh.selectedTrackIndex, working);
          });
          if (lastNu) {
            const idx = working.findIndex(
              (n) => n.pitch === lastNu!.pitch && Math.abs(n.startBeat - lastNu!.startBeat) < 1e-6,
            );
            sh.onSelectOnlyNoteIndex(idx >= 0 ? idx : null);
            sh.onPreviewPitch?.(lastNu.pitch, lastNu.velocity / 127);
          }
        }
        return;
      }

      let working = [...sh.track.notes];
      let changed = false;
      for (let s = 0; s <= stepCount; s++) {
        const tfrac = stepCount === 0 ? 0 : s / stepCount;
        const cx = cx0 + dx * tfrac;
        const cy = cy0 + dy * tfrac;
        const { x, y, ok } = sampleStrip(cx, cy);
        if (!ok) continue;
        const hit = hitPianoNoteIndex(working, x, y, sh.ppb, sh.pitchView);
        if (hit >= 0) {
          working.splice(hit, 1);
          changed = true;
        }
      }
      if (changed) {
        sh.onUpdateTrackNotes(sh.selectedTrackIndex, working);
        sh.onSelectOnlyNoteIndex(null);
      }
    },
    [],
  );

  const beginPencilStroke = useCallback((clientX: number, clientY: number, gridEl: HTMLDivElement) => {
    const sh = pianoInteractRef.current;
    const x = pianoGridStripXFromClient(clientX, hScrollRef.current);
    const y = pianoGridYFromClient(clientY, gridEl);
    const bp = pianoGridBeatPitchFromXY(
      x,
      y,
      sh.ppb,
      sh.snapSubdivisions,
      sh.totalBeats,
      sh.stripW,
      sh.gridH,
      sh.pitchView,
    );
    if (!bp) return;

    const cellDur = oneCellDurationBeats(sh.snapSubdivisions);
    const existingIdx = sh.track.notes.findIndex(
      (n) => n.pitch === bp.pitch && Math.abs(n.startBeat - bp.beat) < 1e-5,
    );
    if (existingIdx >= 0) {
      pencilStrokeRef.current = {
        active: true,
        mode: 'line',
        anchorBeat: sh.track.notes[existingIdx]!.startBeat,
        anchorPitch: bp.pitch,
        strokeNoteIdx: existingIdx,
      };
      sh.onSelectOnlyNoteIndex(existingIdx);
      return;
    }

    const nu: MockMidiNote = {
      pitch: bp.pitch,
      startBeat: bp.beat,
      durationBeats: cellDur,
      velocity: 100,
    };
    const working = [...sh.track.notes, nu].sort((a, b) =>
      a.startBeat !== b.startBeat ? a.startBeat - b.startBeat : a.pitch - b.pitch,
    );
    const idx = working.findIndex(
      (n) => n.pitch === nu.pitch && Math.abs(n.startBeat - nu.startBeat) < 1e-6,
    );
    flushSync(() => {
      sh.onUpdateTrackNotes(sh.selectedTrackIndex, working);
    });
    pencilStrokeRef.current = {
      active: true,
      mode: 'line',
      anchorBeat: bp.beat,
      anchorPitch: bp.pitch,
      strokeNoteIdx: idx >= 0 ? idx : working.length - 1,
    };
    sh.onSelectOnlyNoteIndex(idx >= 0 ? idx : working.length - 1);
    sh.onPreviewPitch?.(nu.pitch, nu.velocity / 127);
  }, []);

  const updatePencilStroke = useCallback(
    (clientX: number, clientY: number, gridEl: HTMLDivElement) => {
      const stroke = pencilStrokeRef.current;
      if (!stroke?.active) return;
      const sh = pianoInteractRef.current;
      const x = pianoGridStripXFromClient(clientX, hScrollRef.current);
      const y = pianoGridYFromClient(clientY, gridEl);
      const bp = pianoGridBeatPitchFromXY(
        x,
        y,
        sh.ppb,
        sh.snapSubdivisions,
        sh.totalBeats,
        sh.stripW,
        sh.gridH,
        sh.pitchView,
      );
      if (!bp) return;

      if (stroke.mode === 'line' && bp.pitch === stroke.anchorPitch) {
        const next = applyPencilLineToNotes(
          sh.track.notes,
          stroke.strokeNoteIdx,
          stroke.anchorBeat,
          stroke.anchorPitch,
          bp.beat,
          sh.snapSubdivisions,
          sh.totalBeats,
        );
        if (!next) return;
        const idx = resolvePencilStrokeNoteIndex(next, stroke.strokeNoteIdx, stroke.anchorPitch);
        pencilStrokeRef.current = { ...stroke, strokeNoteIdx: idx };
        sh.onUpdateTrackNotes(sh.selectedTrackIndex, next);
        sh.onSelectOnlyNoteIndex(idx >= 0 ? idx : null);
        return;
      }

      stroke.mode = 'cells';
      const last = paintLastClientRef.current;
      paintGridBrushSegment(
        last?.clientX ?? clientX,
        last?.clientY ?? clientY,
        clientX,
        clientY,
        gridEl,
        'pencil',
      );
    },
    [paintGridBrushSegment],
  );

  const applyVelocityStripAt = useCallback(
    (clientX: number, clientY: number, velEl: HTMLDivElement, t: PianoRollTool, brush: boolean) => {
      const sh = pianoInteractRef.current;
      const laneH = PIANO_VELOCITY_LANE_H_PX;
      const x = pianoGridStripXFromClient(clientX, hScrollRef.current);
      const y = clientY - velEl.getBoundingClientRect().top;
      if (x < 0 || y < 0 || x > sh.stripW || y > laneH) return;

      if (t === 'pencil') {
        const hit = hitVelocityNoteIndex(sh.track.notes, x, y, sh.ppb, laneH);
        if (hit < 0) return;
        const v = velocityFromLaneY(y, laneH);
        const key = `${hit}|${v}`;
        if (brush && lastVelPaintKeyRef.current === key) return;
        lastVelPaintKeyRef.current = key;
        const next = sh.track.notes.map((n, j) => (j === hit ? { ...n, velocity: v } : n));
        sh.onUpdateTrackNotes(sh.selectedTrackIndex, next);
        sh.onSelectOnlyNoteIndex(hit);
        const n = sh.track.notes[hit];
        if (n) sh.onPreviewPitch?.(n.pitch, v / 127);
        return;
      }

      const hit = hitVelocityNoteIndex(sh.track.notes, x, y, sh.ppb, laneH);
      if (t === 'erase') {
        if (hit < 0) return;
        sh.onUpdateTrackNotes(
          sh.selectedTrackIndex,
          sh.track.notes.filter((_, j) => j !== hit),
        );
        sh.onSelectOnlyNoteIndex(null);
        return;
      }
      sh.onSelectOnlyNoteIndex(hit >= 0 ? hit : null);
    },
    [],
  );

  const addNoteAtGridClient = useCallback((clientX: number, clientY: number, gridEl: HTMLDivElement) => {
    const sh = pianoInteractRef.current;
    const x = pianoGridStripXFromClient(clientX, hScrollRef.current);
    const y = pianoGridYFromClient(clientY, gridEl);
    const working = appendPianoGridNote(
      sh.track.notes,
      x,
      y,
      sh.ppb,
      sh.snapSubdivisions,
      sh.totalBeats,
      sh.stripW,
      sh.pitchView,
    );
    if (!working) return;
    const nu = working[working.length - 1]!;
    flushSync(() => {
      sh.onUpdateTrackNotes(sh.selectedTrackIndex, working);
    });
    const idx = working.findIndex(
      (n) => n.pitch === nu.pitch && Math.abs(n.startBeat - nu.startBeat) < 1e-6,
    );
    sh.onSelectOnlyNoteIndex(idx >= 0 ? idx : null);
    sh.onPreviewPitch?.(nu.pitch, nu.velocity / 127);
  }, []);

  const onGridDoubleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!visible || isAudioTrack) return;
      if (running) void Promise.resolve(onPauseForEdit());
      e.preventDefault();
      e.stopPropagation();
      addNoteAtGridClient(e.clientX, e.clientY, e.currentTarget);
    },
    [addNoteAtGridClient, isAudioTrack, onPauseForEdit, running, visible],
  );

  const onGridPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!visible) return;
      if (e.button !== 0) return;
      if (running) void Promise.resolve(onPauseForEdit());
      const gridEl = e.currentTarget;
      const t = tool;
      noteDragRef.current = {
        active: false, mode: 'move', idx: -1, beatPtrDown: 0, rowPtrDown: 0, anchorStart: 0, anchorEnd: 0, selectedSnapshot: [], duplicatedViaAlt: false,
      };

      if (t === 'pencil') {
        paintLastClientRef.current = { clientX: e.clientX, clientY: e.clientY };
        beginPencilStroke(e.clientX, e.clientY, gridEl);
        dragToolRef.current = t;
        paintDragRef.current = true;
        try {
          gridEl.setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
        return;
      }

      if (t === 'erase') {
        paintLastClientRef.current = { clientX: e.clientX, clientY: e.clientY };
        paintGridBrushSegment(e.clientX, e.clientY, e.clientX, e.clientY, gridEl, t);
        dragToolRef.current = t;
        paintDragRef.current = true;
        try {
          gridEl.setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
        return;
      }

      const additive = e.shiftKey || e.metaKey || e.ctrlKey;

      const sh = pianoInteractRef.current;
      const x = pianoGridStripXFromClient(e.clientX, hScrollRef.current);
      const y = pianoGridYFromClient(e.clientY, gridEl);
      if (x < 0 || y < 0 || x > sh.stripW || y > sh.gridH) return;

      const hit = hitPianoNoteIndex(sh.track.notes, x, y, sh.ppb, sh.pitchView);
      const priorSelection = selectedNoteIndexesRef.current;

      if (hit < 0) {
        if (!e.shiftKey) {
          sh.onClearSelectedNotes();
          return;
        }
        marqueeSelectRef.current = {
          active: true,
          startX: x,
          startY: y,
          curX: x,
          curY: y,
          additive: e.metaKey || e.ctrlKey,
          baseSelection: e.metaKey || e.ctrlKey ? new Set(priorSelection) : new Set(),
        };
        if (!(e.metaKey || e.ctrlKey)) sh.onClearSelectedNotes();
        setMarqueeBox({ left: x, top: y, width: 0, height: 0 });
        try {
          gridEl.setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
        return;
      }

      const n = sh.track.notes[hit];
      if (!n) return;

      let activeSelection: Set<number>;
      if (additive) {
        activeSelection = new Set(priorSelection);
        if (activeSelection.has(hit)) activeSelection.delete(hit);
        else activeSelection.add(hit);
        sh.onToggleNoteIndex(hit);
      } else if (priorSelection.has(hit)) {
        activeSelection = new Set(priorSelection);
      } else {
        activeSelection = new Set([hit]);
        sh.onSelectOnlyNoteIndex(hit);
      }

      const beatPtr = x / sh.ppb;
      const x1 = beatColumnLeftPx(n.startBeat + n.durationBeats, sh.ppb);
      const resize = x >= x1 - PIANO_NOTE_RESIZE_EDGE_PX;
      let dragSnapshots =
        !resize && activeSelection.has(hit)
          ? [...activeSelection]
              .filter((i) => i >= 0 && i < sh.track.notes.length)
              .sort((a, b) => a - b)
              .map((i) => ({
                idx: i,
                startBeat: sh.track.notes[i]!.startBeat,
                pitch: sh.track.notes[i]!.pitch,
                durationBeats: sh.track.notes[i]!.durationBeats,
              }))
          : [
              {
                idx: hit,
                startBeat: n.startBeat,
                pitch: n.pitch,
                durationBeats: n.durationBeats,
              },
            ];

      let duplicatedViaAlt = false;
      if (!resize && e.altKey && dragSnapshots.length > 0) {
        const source = dragSnapshots.map((s) => sh.track.notes[s.idx]!).filter(Boolean);
        const clones = source.map((nn) => ({ ...nn }));
        const merged = [...sh.track.notes, ...clones].sort((a, b) =>
          a.startBeat !== b.startBeat ? a.startBeat - b.startBeat : a.pitch - b.pitch,
        );
        sh.onUpdateTrackNotes(sh.selectedTrackIndex, merged);
        const used = new Set<number>();
        const cloneIdxs: number[] = [];
        clones.forEach((c) => {
          for (let i = 0; i < merged.length; i++) {
            if (used.has(i)) continue;
            const m = merged[i]!;
            if (
              m.pitch === c.pitch &&
              Math.abs(m.startBeat - c.startBeat) < 1e-6 &&
              Math.abs(m.durationBeats - c.durationBeats) < 1e-6 &&
              m.velocity === c.velocity
            ) {
              used.add(i);
              cloneIdxs.push(i);
              break;
            }
          }
        });
        if (cloneIdxs.length) {
          const nextSel = new Set(cloneIdxs);
          sh.onSetSelectedNoteIndexes(nextSel);
          sh.onSelectNoteIndex(cloneIdxs[cloneIdxs.length - 1] ?? null);
          dragSnapshots = cloneIdxs
            .sort((a, b) => a - b)
            .map((i) => ({
              idx: i,
              startBeat: merged[i]!.startBeat,
              pitch: merged[i]!.pitch,
              durationBeats: merged[i]!.durationBeats,
            }));
          duplicatedViaAlt = true;
        }
      }

      noteDragRef.current = {
        active: true,
        mode: resize ? 'resize' : 'move',
        idx: hit,
        beatPtrDown: beatPtr,
        rowPtrDown: y / sh.rowH,
        anchorStart: n.startBeat,
        anchorEnd: n.startBeat + n.durationBeats,
        selectedSnapshot: resize ? [] : dragSnapshots,
        duplicatedViaAlt,
      };
      try {
        gridEl.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
    },
    [beginPencilStroke, paintGridBrushSegment, onPauseForEdit, running, tool, visible],
  );

  const onGridPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const gridEl = e.currentTarget;
      const sh = pianoInteractRef.current;

      if (noteDragRef.current.active) {
        const nd = noteDragRef.current;
        const x = pianoGridStripXFromClient(e.clientX, hScrollRef.current);
        const y = pianoGridYFromClient(e.clientY, gridEl);
        const n = sh.track.notes[nd.idx];
        if (!n) {
          noteDragRef.current = {
            active: false, mode: 'move', idx: -1, beatPtrDown: 0, rowPtrDown: 0, anchorStart: 0, anchorEnd: 0, selectedSnapshot: [], duplicatedViaAlt: false,
          };
          return;
        }
        const beatPtr = x / sh.ppb;
        if (nd.mode === 'move') {
          if (nd.selectedSnapshot.length > 1) {
            const rawDelta = beatPtr - nd.beatPtrDown;
            const pitchDelta = Math.round(nd.rowPtrDown - y / sh.rowH);
            let minStart = Infinity;
            let maxEnd = -Infinity;
            nd.selectedSnapshot.forEach((s) => {
              minStart = Math.min(minStart, s.startBeat + rawDelta);
              maxEnd = Math.max(maxEnd, s.startBeat + s.durationBeats + rawDelta);
            });
            const boundedDelta =
              maxEnd > sh.totalBeats
                ? rawDelta - (maxEnd - sh.totalBeats)
                : minStart < 0
                  ? rawDelta - minStart
                  : rawDelta;
            const selMap = new Map(nd.selectedSnapshot.map((s) => [s.idx, s]));
            sh.onUpdateTrackNotes(
              sh.selectedTrackIndex,
              sh.track.notes.map((ev, j) => {
                const base = selMap.get(j);
                if (!base) return ev;
                const sb = snapBeatToSubdivision(base.startBeat + boundedDelta, sh.snapSubdivisions, sh.totalBeats);
                return {
                  ...ev,
                  startBeat: Math.max(0, Math.min(sh.totalBeats - base.durationBeats, sb)),
                  pitch: Math.max(sh.pitchLo, Math.min(sh.pitchHi, base.pitch + pitchDelta)),
                };
              }),
            );
            return;
          }
          const rawDelta = beatPtr - nd.beatPtrDown;
          let newStart = snapBeatToSubdivision(nd.anchorStart + rawDelta, sh.snapSubdivisions, sh.totalBeats);
          newStart = Math.max(0, Math.min(sh.totalBeats - n.durationBeats, newStart));
          const row = Math.floor(y / sh.rowH);
          const newPitch = pianoPitchForRow(sh.pitchView, row);
          sh.onUpdateTrackNotes(
            sh.selectedTrackIndex,
            sh.track.notes.map((ev, j) =>
              j === nd.idx ? { ...ev, startBeat: newStart, pitch: newPitch } : ev,
            ),
          );
        } else {
          const rawDelta = beatPtr - nd.beatPtrDown;
          let newEnd = snapBeatToSubdivision(nd.anchorEnd + rawDelta, sh.snapSubdivisions, sh.totalBeats);
          newEnd = Math.max(
            n.startBeat + PIANO_MIN_NOTE_DURATION_BEATS,
            Math.min(sh.totalBeats, newEnd),
          );
          const newDur = newEnd - n.startBeat;
          sh.onUpdateTrackNotes(
            sh.selectedTrackIndex,
            sh.track.notes.map((ev, j) => (j === nd.idx ? { ...ev, durationBeats: newDur } : ev)),
          );
        }
        return;
      }

      if (marqueeSelectRef.current.active) {
        const m = marqueeSelectRef.current;
        const x = pianoGridStripXFromClient(e.clientX, hScrollRef.current);
        const y = pianoGridYFromClient(e.clientY, gridEl);
        m.curX = x;
        m.curY = y;
        const left = Math.max(0, Math.min(m.startX, m.curX));
        const right = Math.min(sh.stripW, Math.max(m.startX, m.curX));
        const top = Math.max(0, Math.min(m.startY, m.curY));
        const bottom = Math.min(sh.gridH, Math.max(m.startY, m.curY));
        setMarqueeBox({ left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
        const hitSet = new Set<number>();
        sh.track.notes.forEach((n, i) => {
          const x0 = beatColumnLeftPx(n.startBeat, sh.ppb);
          const x1 = beatColumnLeftPx(n.startBeat + midiNoteRollDurationBeats(n), sh.ppb);
          const y0 = pitchRowY0(n.pitch, sh.pitchView);
          const y1 = y0 + Math.max(2, sh.rowH - 2);
          if (x1 >= left && x0 <= right && y1 >= top && y0 <= bottom) hitSet.add(i);
        });
        const next = m.additive ? new Set([...m.baseSelection, ...hitSet]) : hitSet;
        sh.onSetSelectedNoteIndexes(next);
        const arr = [...next].sort((a, b) => a - b);
        sh.onSelectNoteIndex(arr.length ? arr[arr.length - 1]! : null);
        return;
      }

      if (!paintDragRef.current) return;
      const dt = dragToolRef.current;
      if (dt !== 'pencil' && dt !== 'erase') return;
      const last = paintLastClientRef.current;
      if (dt === 'pencil') {
        updatePencilStroke(e.clientX, e.clientY, gridEl);
      } else {
        paintGridBrushSegment(
          last?.clientX ?? e.clientX,
          last?.clientY ?? e.clientY,
          e.clientX,
          e.clientY,
          gridEl,
          dt,
        );
      }
      paintLastClientRef.current = { clientX: e.clientX, clientY: e.clientY };
    },
    [paintGridBrushSegment, updatePencilStroke],
  );

  const onGridPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    paintDragRef.current = false;
    dragToolRef.current = null;
    paintLastClientRef.current = null;
    pencilStrokeRef.current = null;
    noteDragRef.current = {
      active: false, mode: 'move', idx: -1, beatPtrDown: 0, rowPtrDown: 0, anchorStart: 0, anchorEnd: 0, selectedSnapshot: [], duplicatedViaAlt: false,
    };
    marqueeSelectRef.current.active = false;
    setMarqueeBox(null);
    const el = e.currentTarget;
    if (typeof el.hasPointerCapture === 'function' && el.hasPointerCapture(e.pointerId)) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    }
  }, []);

  const onVelPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!visible) return;
      if (e.button !== 0) return;
      if (running) void Promise.resolve(onPauseForEdit());
      const velEl = e.currentTarget;
      const t = tool;
      lastVelPaintKeyRef.current = '';
      applyVelocityStripAt(e.clientX, e.clientY, velEl, t, false);

      if (t === 'pencil' || t === 'erase') {
        velDragToolRef.current = t;
        velPaintDragRef.current = true;
        try {
          velEl.setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
      }
    },
    [applyVelocityStripAt, onPauseForEdit, running, tool, visible],
  );

  const onVelPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!velPaintDragRef.current) return;
      const dt = velDragToolRef.current;
      if (dt !== 'pencil' && dt !== 'erase') return;
      applyVelocityStripAt(e.clientX, e.clientY, e.currentTarget, dt, true);
    },
    [applyVelocityStripAt],
  );

  const onVelPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    velPaintDragRef.current = false;
    velDragToolRef.current = null;
    lastVelPaintKeyRef.current = '';
    const el = e.currentTarget;
    if (typeof el.hasPointerCapture === 'function' && el.hasPointerCapture(e.pointerId)) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    }
  }, []);

  const onGridContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onNotesContextMenu) return;
      const x = pianoGridStripXFromClient(e.clientX, hScrollRef.current);
      const y = pianoGridYFromClient(e.clientY, e.currentTarget);
      const sh = pianoInteractRef.current;
      let hitIdx: number | null = null;
      if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x <= sh.stripW && y <= sh.gridH) {
        const hix = hitPianoNoteIndex(sh.track.notes, x, y, sh.ppb, sh.pitchView);
        hitIdx = hix >= 0 ? hix : null;
      }
      onNotesContextMenu({ clientX: e.clientX, clientY: e.clientY, noteHitIndex: hitIdx });
    },
    [onNotesContextMenu],
  );

  const onVelContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onNotesContextMenu) return;
      const sh = pianoInteractRef.current;
      const laneH = PIANO_VELOCITY_LANE_H_PX;
      const x = pianoGridStripXFromClient(e.clientX, hScrollRef.current);
      const r = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - r.top;
      let hitIdx: number | null = null;
      if (x >= 0 && y >= 0 && x <= sh.stripW && y <= laneH) {
        const hix = hitVelocityNoteIndex(sh.track.notes, x, y, sh.ppb, laneH);
        hitIdx = hix >= 0 ? hix : null;
      }
      onNotesContextMenu({ clientX: e.clientX, clientY: e.clientY, noteHitIndex: hitIdx });
    },
    [onNotesContextMenu],
  );

  const onKeyStripContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onNotesContextMenu) return;
      onNotesContextMenu({ clientX: e.clientX, clientY: e.clientY, noteHitIndex: null });
    },
    [onNotesContextMenu],
  );

  const onPianoBarRulerContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onNotesContextMenu) return;
      onNotesContextMenu({ clientX: e.clientX, clientY: e.clientY, noteHitIndex: null });
    },
    [onNotesContextMenu],
  );

  if (!visible) return null;

  const hidePianoForGenoBuild = synthGenoBuildFullscreenOpen;
  const hidePianoForBeatPads = isBeatPadsLane;
  const hidePianoForGuitar = isGuitarLane && guitarStripOpen;
  const hidePianoRoll = hidePianoForGenoBuild || hidePianoForBeatPads || hidePianoForGuitar;

  const loopLsX = beatColumnLeftPx(loopStartBeat, ppb);
  const loopLeX = beatColumnLeftPx(loopEndBeat, ppb);
  const loopSpan = Math.max(0, loopLeX - loopLsX);
  const showLoopShade = loopOn && loopSpan > 0;
  const onHScroll = () => {
    const el = hScrollRef.current;
    setHScroll(el?.scrollLeft ?? 0);
  };

  const toolBtn = (t: PianoRollTool, icon: ReactNode, title: string, label: string) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={() => onToolChange(t)}
      className="pr-toolbar-chip flex items-center gap-1 rounded px-1.5 py-0.5 transition-all active:scale-[0.98]"
      style={{
        background: tool === t ? 'rgba(124,244,198,0.14)' : 'rgba(255,255,255,0.02)',
        color: tool === t ? '#7cf4c6' : '#6a6a78',
        border: `1px solid ${tool === t ? 'rgba(124,244,198,0.38)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: tool === t ? '0 0 0 1px rgba(124,244,198,0.24), 0 0 10px rgba(124,244,198,0.18)' : 'inset 0 1px 0 rgba(255,255,255,0.05)',
        cursor: 'pointer',
      }}
    >
      {icon}
      <span className="text-[7px] font-medium whitespace-nowrap leading-none">{label}</span>
    </button>
  );

  return (
    <div
      className={
        expanded
          ? 'flex-1 min-h-0 flex flex-col border-t overflow-hidden'
          : 'flex flex-1 min-h-0 flex-col border-t overflow-hidden'
      }
      style={{
        height: expanded ? '100%' : undefined,
        minHeight: expanded ? undefined : Math.max(PIANO_PANEL_H_MIN, panelHeight),
        flex: expanded ? undefined : '1.6 1 0%',
        borderColor: '#141418',
        background: '#08080c',
        paddingBottom: expanded ? undefined : PIANO_ROLL_BOTTOM_CLEARANCE_PX,
        boxSizing: 'border-box',
      }}
      data-studio-midi-context
    >
      {!expanded && (
        <button
          type="button"
          aria-label="Resize piano roll height"
          className="h-1.5 w-full cursor-row-resize shrink-0 border-b hover:bg-white/[0.06]"
          style={{ borderColor: '#1a1a22', background: '#101014' }}
          onMouseDown={onResizeStart}
        />
      )}
      {!expanded ? synthGenoEditPanel : null}
      {!expanded ? beatPadsEditPanel : null}
      {!expanded ? chordGenieEditPanel : null}
      {!expanded ? drumGeneratorEditPanel : null}
      {!expanded ? grooveLeadEditPanel : null}
      {!expanded ? lab808EditPanel : null}
      {!expanded ? genoUltraSynthEditPanel : null}
      {!expanded ? genoBassSynthEditPanel : null}
      {!expanded ? humCaptureEditPanel : null}
      {!expanded ? guitarEditPanel : null}
      {!expanded ? glideBassEditPanel : null}
      {hidePianoRoll ? (
        hidePianoForGuitar ? null : (
        <div
          className="flex flex-1 min-h-0 items-center justify-center border-t px-3 py-2 shrink-0"
          style={{ borderColor: '#1a1a22', background: '#07070a' }}
        >
          <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: '#5c5c68' }}>
            {hidePianoForBeatPads
              ? 'Beat Pads sequencer above — edit pattern in the Beat Pads grid (synced to SE2 transport)'
              : 'Piano roll hidden — Minimize Geno Build to edit notes'}
          </span>
        </div>
        )
      ) : (
      <>
      <div
        data-studio-piano-roll-toolbar
        className={`flex flex-col gap-2 px-2 pt-1 pb-2 border-b shrink-0 ${
          !expanded &&
          (glideBassStripOpen ||
            synthGenoStripOpen ||
            grooveLeadStripOpen ||
            lab808StripOpen ||
            genoUltraSynthStripOpen ||
            genoBassSynthStripOpen ||
            drumGeneratorStripOpen ||
            chordGenieStripOpen ||
            beatPadsStripOpen ||
            humCaptureStripOpen ||
            guitarStripOpen)
            ? 'max-h-[min(28vh,168px)] overflow-y-auto overscroll-contain'
            : ''
        }`}
        style={{
          borderColor: '#1a1a22',
          background: 'linear-gradient(180deg, #0b0b10 0%, #09090d 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div className="pr-toolbar-row">
          <span
            className="text-[10px] font-bold uppercase tracking-wider shrink-0 pr-toolbar-chip"
            style={{ color: '#5c5c68' }}
          >
            Piano roll
          </span>
          {!isAudioTrack && isMidiLane && isGlideBassLane ? (
            <div className="pr-toolbar-row shrink-0 min-w-0">
              <span
                className="text-[9px] font-bold uppercase tracking-wide shrink-0 pr-toolbar-chip"
                style={{ color: track.colorHex }}
                title={trackNumbered(track)}
              >
                {trackNumbered(track)}
              </span>
              <span
                className="text-[8px] font-mono tabular-nums shrink-0 rounded border px-1 py-0.5 pr-toolbar-chip"
                style={{ color: '#9a9aac', borderColor: '#2a2a32', background: 'rgba(0,0,0,0.25)' }}
                title={`Mixer channel ${midiCh}`}
              >
                Ch {midiCh}
              </span>
              <span
                className="text-[8px] font-bold uppercase tracking-wide shrink-0 rounded border px-1.5 py-0.5 pr-toolbar-chip"
                style={{
                  color: track.colorHex,
                  borderColor: `${track.colorHex}55`,
                  background: `${track.colorHex}14`,
                }}
                title="Bass Glide synth voice — open Bass Glide panel to edit"
              >
                Bass Glide · {glideBassPresetId ? beatLabBassSynthPresetById(glideBassPresetId).name : 'Synth V2'}
              </span>
            </div>
          ) : !isAudioTrack && isMidiLane && isSynthGenoLane ? (
            <div className="pr-toolbar-row shrink-0 min-w-0">
              <span
                className="text-[9px] font-bold uppercase tracking-wide shrink-0 pr-toolbar-chip"
                style={{ color: track.colorHex }}
                title={trackNumbered(track)}
              >
                {trackNumbered(track)}
              </span>
              <span
                className="text-[8px] font-mono tabular-nums shrink-0 rounded border px-1 py-0.5 pr-toolbar-chip"
                style={{ color: '#9a9aac', borderColor: '#2a2a32', background: 'rgba(0,0,0,0.25)' }}
                title={`Mixer channel ${midiCh}`}
              >
                Ch {midiCh}
              </span>
              <span
                className="text-[8px] font-bold uppercase tracking-wide shrink-0 rounded border px-1.5 py-0.5 pr-toolbar-chip"
                style={{
                  color: track.colorHex,
                  borderColor: `${track.colorHex}55`,
                  background: `${track.colorHex}14`,
                }}
                title="Synth Geno — open panel to generate sounds"
              >
                Synth Geno · {synthGenoPatchLabel ?? track.synthGenoPatchLabel ?? 'Init Geno'}
              </span>
            </div>
          ) : !isAudioTrack && isMidiLane && isGrooveLeadLane ? (
            <div className="pr-toolbar-row shrink-0 min-w-0">
              <span
                className="text-[9px] font-bold uppercase tracking-wide shrink-0 pr-toolbar-chip"
                style={{ color: track.colorHex }}
                title={trackNumbered(track)}
              >
                {trackNumbered(track)}
              </span>
              <span
                className="text-[8px] font-mono tabular-nums shrink-0 rounded border px-1 py-0.5 pr-toolbar-chip"
                style={{ color: '#9a9aac', borderColor: '#2a2a32', background: 'rgba(0,0,0,0.25)' }}
                title={`Mixer channel ${midiCh}`}
              >
                Ch {midiCh}
              </span>
              <span
                className="text-[8px] font-bold uppercase tracking-wide shrink-0 rounded border px-1.5 py-0.5 pr-toolbar-chip"
                style={{
                  color: track.colorHex,
                  borderColor: `${track.colorHex}55`,
                  background: `${track.colorHex}14`,
                }}
                title="Groove Lead — R&B / gospel lead synth from Groove Lab"
              >
                Groove Lead · {grooveLeadPatchLabel ?? 'R&B Silk'}
              </span>
            </div>
          ) : !isAudioTrack && isMidiLane && isLab808Lane ? (
            <div className="pr-toolbar-row shrink-0 min-w-0">
              <span
                className="text-[9px] font-bold uppercase tracking-wide shrink-0 pr-toolbar-chip"
                style={{ color: track.colorHex }}
                title={trackNumbered(track)}
              >
                {trackNumbered(track)}
              </span>
              <span
                className="text-[8px] font-mono tabular-nums shrink-0 rounded border px-1 py-0.5 pr-toolbar-chip"
                style={{ color: '#9a9aac', borderColor: '#2a2a32', background: 'rgba(0,0,0,0.25)' }}
                title={`Mixer channel ${midiCh}`}
              >
                Ch {midiCh}
              </span>
              <span
                className="text-[8px] font-bold uppercase tracking-wide shrink-0 rounded border px-1.5 py-0.5 pr-toolbar-chip"
                style={{
                  color: track.colorHex,
                  borderColor: `${track.colorHex}55`,
                  background: `${track.colorHex}14`,
                }}
                title="808 Lab — trap kick & bass synth (standalone SE2 lane)"
              >
                808 Lab · {lab808PatchLabel ?? 'Kick · T knock'}
              </span>
            </div>
          ) : !isAudioTrack && isMidiLane && isGenoUltraSynthLane ? (
            <div className="pr-toolbar-row shrink-0 min-w-0">
              <span
                className="text-[9px] font-bold uppercase tracking-wide shrink-0 pr-toolbar-chip"
                style={{ color: track.colorHex }}
                title={trackNumbered(track)}
              >
                {trackNumbered(track)}
              </span>
              <span
                className="text-[8px] font-mono tabular-nums shrink-0 rounded border px-1 py-0.5 pr-toolbar-chip"
                style={{ color: '#9a9aac', borderColor: '#2a2a32', background: 'rgba(0,0,0,0.25)' }}
                title={`Mixer channel ${midiCh}`}
              >
                Ch {midiCh}
              </span>
              <span
                className="text-[8px] font-bold uppercase tracking-wide shrink-0 rounded border px-1.5 py-0.5 pr-toolbar-chip"
                style={{
                  color: track.colorHex,
                  borderColor: `${track.colorHex}55`,
                  background: `${track.colorHex}14`,
                }}
                title="Geno Ultra Synth — Grid-style subtractive instrument"
              >
                Geno Ultra · {genoUltraPatchLabel ?? track.genoUltraPatchLabel ?? 'Warm Lead'}
              </span>
            </div>
          ) : !isAudioTrack && isMidiLane && isGenoBassSynthLane ? (
            <div className="pr-toolbar-row shrink-0 min-w-0">
              <span
                className="text-[9px] font-bold uppercase tracking-wide shrink-0 pr-toolbar-chip"
                style={{ color: track.colorHex }}
                title={trackNumbered(track)}
              >
                {trackNumbered(track)}
              </span>
              <span
                className="text-[8px] font-mono tabular-nums shrink-0 rounded border px-1 py-0.5 pr-toolbar-chip"
                style={{ color: '#9a9aac', borderColor: '#2a2a32', background: 'rgba(0,0,0,0.25)' }}
                title={`Mixer channel ${midiCh}`}
              >
                Ch {midiCh}
              </span>
              <span
                className="text-[8px] font-bold uppercase tracking-wide shrink-0 rounded border px-1.5 py-0.5 pr-toolbar-chip"
                style={{
                  color: track.colorHex,
                  borderColor: `${track.colorHex}55`,
                  background: `${track.colorHex}14`,
                }}
                title="Geno Bass Synth — classic Mooga / Retro Box / FM bass"
              >
                Geno Bass · {genoBassPatchLabel ?? track.genoBassPatchLabel ?? 'Mini Mooga'}
              </span>
            </div>
          ) : !isAudioTrack && isMidiLane && isGuitarLane ? (
            <div className="pr-toolbar-row shrink-0 min-w-0">
              <span
                className="text-[9px] font-bold uppercase tracking-wide shrink-0 pr-toolbar-chip"
                style={{ color: track.colorHex }}
                title={trackNumbered(track)}
              >
                {trackNumbered(track)}
              </span>
              <span
                className="text-[8px] font-mono tabular-nums shrink-0 rounded border px-1 py-0.5 pr-toolbar-chip"
                style={{ color: '#9a9aac', borderColor: '#2a2a32', background: 'rgba(0,0,0,0.25)' }}
                title={`Mixer channel ${midiCh}`}
              >
                Ch {midiCh}
              </span>
              <span
                className="text-[8px] font-bold uppercase tracking-wide shrink-0 rounded border px-1.5 py-0.5 pr-toolbar-chip"
                style={{
                  color: track.colorHex,
                  borderColor: `${track.colorHex}55`,
                  background: `${track.colorHex}14`,
                }}
                title="Guitar — sampled GM guitar on the MIDI roll"
              >
                Guitar · {guitarInstrumentLabel ?? 'Clean Electric'}
              </span>
            </div>
          ) : !isAudioTrack && isMidiLane && isHumCaptureLane ? (
            <div className="pr-toolbar-row shrink-0 min-w-0">
              <span
                className="text-[9px] font-bold uppercase tracking-wide shrink-0 pr-toolbar-chip"
                style={{ color: track.colorHex }}
                title={trackNumbered(track)}
              >
                {trackNumbered(track)}
              </span>
              <span
                className="text-[8px] font-mono tabular-nums shrink-0 rounded border px-1 py-0.5 pr-toolbar-chip"
                style={{ color: '#9a9aac', borderColor: '#2a2a32', background: 'rgba(0,0,0,0.25)' }}
                title={`Mixer channel ${midiCh}`}
              >
                Ch {midiCh}
              </span>
              <span
                className="text-[8px] font-bold uppercase tracking-wide shrink-0 rounded border px-1.5 py-0.5 pr-toolbar-chip"
                style={{
                  color: track.colorHex,
                  borderColor: `${track.colorHex}55`,
                  background: `${track.colorHex}14`,
                }}
                title="Hum / Melody Capture — humming, singing, whistling, or a single instrument line → MIDI (pitch, timing, loudness, bends)"
              >
                Hum / Melody · {humCaptureInstrumentLabel ?? 'Piano'}
              </span>
            </div>
          ) : !isAudioTrack && isMidiLane && isDrumGeneratorLane ? (
            <div className="pr-toolbar-row shrink-0 min-w-0">
              <span
                className="text-[9px] font-bold uppercase tracking-wide shrink-0 pr-toolbar-chip"
                style={{ color: track.colorHex }}
                title={trackNumbered(track)}
              >
                {trackNumbered(track)}
              </span>
              <span
                className="text-[8px] font-mono tabular-nums shrink-0 rounded border px-1 py-0.5 pr-toolbar-chip"
                style={{ color: '#9a9aac', borderColor: '#2a2a32', background: 'rgba(0,0,0,0.25)' }}
                title="GM drum channel 10"
              >
                Ch 10
              </span>
              <span
                className="text-[8px] font-bold uppercase tracking-wide shrink-0 rounded border px-1.5 py-0.5 pr-toolbar-chip"
                style={{
                  color: track.colorHex,
                  borderColor: `${track.colorHex}55`,
                  background: `${track.colorHex}14`,
                }}
                title="Drum Generator — style-matched grooves"
              >
                Drum Gen · {se2NormalizeDrumGenStyle(track.drumGenStyle)}
              </span>
            </div>
          ) : !isAudioTrack && isMidiLane && onMidiInstrumentChange ? (
            <div className="pr-toolbar-row shrink-0 min-w-0">
              <span
                className="text-[9px] font-bold uppercase tracking-wide shrink-0 pr-toolbar-chip"
                style={{ color: track.colorHex }}
                title={trackNumbered(track)}
              >
                {trackNumbered(track)}
              </span>
              <span
                className="text-[8px] font-mono tabular-nums shrink-0 rounded border px-1 py-0.5 pr-toolbar-chip"
                style={{ color: '#9a9aac', borderColor: '#2a2a32', background: 'rgba(0,0,0,0.25)' }}
                title={`MIDI output channel ${midiCh}`}
              >
                Ch {midiCh}
              </span>
              <span
                className="text-[7px] font-bold uppercase tracking-wider shrink-0 pr-toolbar-chip"
                style={{ color: '#5c5c68' }}
              >
                Sound
              </span>
              <StudioMidiInstrumentPicker
                compact={false}
                drumTrack={isDrumLane}
                className="pr-toolbar-chip min-w-[9rem] max-w-[14rem] shrink-0"
                value={track.midiInstrumentId}
                accentHex={track.colorHex}
                title={
                  isDrumLane
                    ? `Drum kit for ${track.name} Â· Ch ${midiCh}`
                    : `Playback sound for ${track.name} Â· Ch ${midiCh}`
                }
                onChange={onMidiInstrumentChange}
              />
            </div>
          ) : !isAudioTrack ? (
            <span
              className="text-[9px] font-bold uppercase tracking-wide shrink-0 rounded border px-1.5 py-0.5 pr-toolbar-chip"
              style={{
                color: '#7cf4c6',
                borderColor: 'rgba(124,244,198,0.35)',
                background: 'rgba(124,244,198,0.08)',
              }}
              title={`Notes on this lane send on MIDI channel ${midiCh}`}
            >
              {trackNumbered(track)} Â· Ch {midiCh} Â· {studioMidiInstrumentLabel(track.midiInstrumentId)}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onToggleExpanded}
            title={expanded ? 'Minimize piano roll' : 'Expand piano roll'}
            className="pr-toolbar-chip shrink-0 flex items-center gap-1 rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide transition-colors"
            style={{
              borderColor: expanded ? '#2a4a3c' : '#2a2a32',
              color: expanded ? '#7cf4c6' : '#8a8a98',
              background: expanded ? '#14221c' : 'rgba(0,0,0,0.25)',
            }}
          >
            {expanded ? <Minimize2 size={10} strokeWidth={2.2} /> : <Maximize2 size={10} strokeWidth={2.2} />}
            <span>{expanded ? 'Min' : 'Expand'}</span>
          </button>
          <div className="pr-toolbar-row select-none">
            {toolBtn(
              'select',
              <MousePointer2 size={10} strokeWidth={2} />,
              'Select â€” drag empty grid to box-select notes; drag selection to move; Shift+click to add; Alt+drag to duplicate; Ctrl+D duplicate',
              'Select',
            )}
            {toolBtn(
              'pencil',
              <Pencil size={10} strokeWidth={2} />,
              `Pencil â€” click one cell; drag on a row to draw one sustained note (bar/line); drag across pitches for step notes`,
              'Pencil',
            )}
            {toolBtn(
              'erase',
              <Eraser size={10} strokeWidth={2} />,
              'Eraser Ã¢â‚¬â€ remove note on grid or velocity bar',
              'Eraser',
            )}
          </div>
          {selectedNoteIndexes.size > 0 ? (
            <button
              type="button"
              title="Duplicate selected notes (Ctrl+D)"
              aria-label="Duplicate selected notes"
              onClick={() => onDuplicateSelectedPhrase()}
              className="pr-toolbar-chip shrink-0 flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors"
              style={{
                borderColor: '#2a4a3c',
                background: 'rgba(124,244,198,0.1)',
                color: '#7cf4c6',
              }}
            >
              <Copy size={10} strokeWidth={2.2} aria-hidden />
              <span>Duplicate</span>
            </button>
          ) : null}
          {onClearPattern ? (
            <button
              type="button"
              disabled={clearPatternDisabled}
              title="Clear drum pattern â€” remove all hits from the grid (Del with nothing selected)"
              aria-label="Clear drum pattern"
              onClick={onClearPattern}
              className="pr-toolbar-chip shrink-0 flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                borderColor: '#4a3038',
                background: 'rgba(232,93,117,0.1)',
                color: '#e85d75',
              }}
            >
              <Trash2 size={10} strokeWidth={2.2} aria-hidden />
              <span>Clear</span>
            </button>
          ) : null}
          <div className="pr-toolbar-row">
            <DawMiniMenu
              label="Snap"
              displayText={snapLabelFromPianoSnapSubdiv(snapS)}
              value={snapS}
              options={[
                { value: 1, label: snapLabelFromPianoSnapSubdiv(1) },
                { value: 2, label: snapLabelFromPianoSnapSubdiv(2) },
                { value: 3, label: snapLabelFromPianoSnapSubdiv(3) },
                { value: 4, label: snapLabelFromPianoSnapSubdiv(4) },
                { value: 6, label: snapLabelFromPianoSnapSubdiv(6) },
                { value: 8, label: snapLabelFromPianoSnapSubdiv(8) },
                { value: 16, label: snapLabelFromPianoSnapSubdiv(16) },
                { value: 32, label: snapLabelFromPianoSnapSubdiv(32) },
              ]}
              onChange={onSnapSubdivisionsChange}
              title={`Grid snap â€” ${PPQ} PPQ; one cell = ${Math.round(ticksPerPianoSnapCell(PPQ, snapS))} ticks; zoom = pixel width`}
              compact
              toolbarChip
            />
            <DawMiniMenu
              label="Sig"
              displayText={`${bpb}/4`}
              value={bpb}
              options={Array.from({ length: 15 }, (_, i) => ({ value: i + 2, label: `${i + 2}/4` }))}
              onChange={onBeatsPerBarChange}
              title="Time signature Ã¢â‚¬â€ beats per bar"
              compact
              toolbarChip
            />
            <button
              type="button"
              title={loopOn ? `Loop on â€” ${loopBars} bar${loopBars !== 1 ? 's' : ''} (drag top ruler bar to resize)` : 'Loop off â€” click to enable, drag top ruler to set region'}
              aria-pressed={loopOn}
              onClick={() => onLoopOnChange(!loopOn)}
              className="pr-toolbar-chip flex items-center gap-0.5 rounded border font-mono font-bold text-[9px] outline-none transition-colors px-1.5 py-0.5 shrink-0"
              style={{
                borderColor: loopOn ? '#2a4a3c' : '#3a3a46',
                background: loopOn ? '#14221c' : '#1c1c24',
                color: loopOn ? '#7cf4c6' : '#6a6a78',
              }}
            >
              <Repeat size={9} strokeWidth={2.5} />
              <span>Loop</span>
            </button>
            <DawMiniMenu
              label=""
              displayText={`${loopBars} bar${loopBars !== 1 ? 's' : ''}`}
              value={loopBars}
              options={[1, 2, 4, 8, 12, 16, 24, 32].map((n) => ({ value: n, label: `${n} bar${n !== 1 ? 's' : ''}` }))}
              onChange={onLoopBarsChange}
              title="Loop length â€” also draggable on the ruler bar above"
              compact
              toolbarChip
            />
          </div>
        </div>
        <div className="pr-toolbar-row">
          {tracks.map((tr, i) => {
            const active = i === selectedTrackIndex;
            return (
              <button
                key={tr.id}
                type="button"
                title={`Edit ${trackNumbered(tr)}`}
                onClick={() => onSelectTrackIndex(i)}
                className={`pr-toolbar-chip flex items-center gap-0.5 px-1.5 py-0.5 rounded border shrink-0 max-w-[8.5rem] truncate transition-all active:scale-[0.98] ${TRACK_NAME_UI_CLASS}`}
                style={{
                  borderColor: active ? `${tr.colorHex}99` : '#2a2a32',
                  background: active ? `${tr.colorHex}22` : 'rgba(0,0,0,0.35)',
                  color: active ? '#eaeaf0' : '#7a7a88',
                  boxShadow: active ? `inset 0 0 0 1px ${tr.colorHex}44, 0 0 8px ${tr.colorHex}22` : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tr.colorHex }} aria-hidden />
                <span
                  className="font-mono tabular-nums shrink-0 text-[8px] font-bold"
                  style={{ color: tr.colorHex }}
                >
                  {se2FormatTrackNumber(tr.laneNumber, lanePad)}
                </span>
                <span className="truncate">{tr.name}</span>
              </button>
            );
          })}
          <div
            className="pr-toolbar-row min-w-0 shrink-0 border-l pl-2 ml-2"
            style={{ borderColor: '#252532' }}
          >
            <span className="shrink-0 text-[7px] font-semibold uppercase pr-toolbar-chip" style={{ color: '#6f6f7f' }}>
              Q
            </span>
            <div className="pr-toolbar-chip shrink-0">
              <SynthRoundKnob
                label="Strength"
                value={quantizeStrength}
                min={0}
                max={100}
                decimals={0}
                unit="%"
                size={27}
                accent="#7cf4c6"
                defaultValue={100}
                onChange={(v) => onQuantizeStrengthChange(Math.round(v))}
              />
            </div>
            <div className="pr-toolbar-chip shrink-0">
              <SynthRoundKnob
                label="Swing"
                value={quantizeSwing}
                min={0}
                max={80}
                decimals={0}
                unit="%"
                size={27}
                accent="#7cf4c6"
                defaultValue={0}
                onChange={(v) => onQuantizeSwingChange(Math.round(v))}
              />
            </div>
            <button
              type="button"
              onClick={onQuantizeSelected}
              className="pr-toolbar-chip shrink-0 rounded px-2 py-0.5 text-[8px] font-semibold whitespace-nowrap transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(180deg, #254036 0%, #1b2f28 100%)',
                border: '1px solid rgba(124,244,198,0.36)',
                color: '#7cf4c6',
                boxShadow: '0 0 8px rgba(124,244,198,0.18)',
              }}
              title="Quantize selected notes"
            >
              Quantize
            </button>
            {isMidiLane ? (
              <>
                <button
                  type="button"
                  disabled={running || track.notes.length === 0}
                  onClick={() => onTransposeAllTrackNotes(-12)}
                  className="pr-toolbar-chip shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    borderColor: track.notes.length > 0 ? '#5b8cff66' : '#333340',
                    background: track.notes.length > 0 ? '#141824' : '#16161e',
                    color: track.notes.length > 0 ? '#9bb8ff' : '#6a6a78',
                  }}
                  title="Octave down — move every note on this track down 12 semitones (same key, lower register)"
                >
                  Oct −
                </button>
                <button
                  type="button"
                  disabled={running || track.notes.length === 0}
                  onClick={() => onTransposeAllTrackNotes(-6)}
                  className="pr-toolbar-chip shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    borderColor: track.notes.length > 0 ? '#5b8cff44' : '#333340',
                    background: track.notes.length > 0 ? '#121620' : '#16161e',
                    color: track.notes.length > 0 ? '#8aa8e8' : '#6a6a78',
                  }}
                  title="Half octave down — move every note down 6 semitones (same key, slightly lower)"
                >
                  ½ −
                </button>
                <button
                  type="button"
                  disabled={running || track.notes.length === 0}
                  onClick={() => onTransposeAllTrackNotes(6)}
                  className="pr-toolbar-chip shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    borderColor: track.notes.length > 0 ? '#5b8cff44' : '#333340',
                    background: track.notes.length > 0 ? '#121620' : '#16161e',
                    color: track.notes.length > 0 ? '#8aa8e8' : '#6a6a78',
                  }}
                  title="Half octave up — move every note up 6 semitones (same key, slightly higher)"
                >
                  ½ +
                </button>
                <button
                  type="button"
                  disabled={running || track.notes.length === 0}
                  onClick={() => onTransposeAllTrackNotes(12)}
                  className="pr-toolbar-chip shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    borderColor: track.notes.length > 0 ? '#5b8cff66' : '#333340',
                    background: track.notes.length > 0 ? '#141824' : '#16161e',
                    color: track.notes.length > 0 ? '#9bb8ff' : '#6a6a78',
                  }}
                  title="Octave up — move every note on this track up 12 semitones (same key, higher register)"
                >
                  Oct +
                </button>
              </>
            ) : null}
          </div>
          {harmonyToolbar ? (
            <div className="pr-toolbar-row shrink-0 border-l pl-2 ml-2" style={{ borderColor: '#252532' }}>
              {harmonyToolbar}
            </div>
          ) : null}
          {studioTrackHasMelodicKeyUi(track) ? (
            <StudioTrackKeyMenu
              compact={false}
              className="pr-toolbar-chip shrink-0 min-w-[5.25rem]"
              keyRoot={detectedKey.keyRoot}
              keyMode={detectedKey.keyMode}
              songKeyRoot={songKeyRoot}
              songKeyMode={songKeyMode}
              accentHex={track.colorHex}
              disabled={running}
              detectDisabled={running || track.notes.length === 0}
              convertDisabled={running || track.notes.length === 0}
              title={`Key for ${track.name}`}
              onDetect={onDetectTrackKey}
              onConvertToSongKey={onConvertTrackToSongKey}
            />
          ) : null}
          {a2mBpmLabel ? (
            <span
              className="text-[7px] font-mono tabular-nums px-1.5 py-0.5 rounded shrink-0 pr-toolbar-chip"
              style={{ color: '#c8c8d8', background: 'rgba(255,184,77,0.12)', border: '1px solid rgba(255,184,77,0.28)' }}
              title="Detected tempo from audio clip"
            >
              {a2mBpmLabel}
            </span>
          ) : null}
        </div>
      </div>

      {isAudioLikeLane ? (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-2 px-6 min-h-0"
          style={{ background: '#0a0a0e' }}
        >
          <span className="text-[11px] font-semibold tracking-wide" style={{ color: '#9a9aac' }}>
            {isTrackAlignLane ? 'Track Align' : 'Audio track'}
          </span>
          <span className="text-[9px] leading-relaxed max-w-[22rem] text-center" style={{ color: '#5c5c68' }}>
            {isTrackAlignLane
              ? 'Drop beats or samples on the timeline — drag clip edges to stretch manually (tempo lock stays on). Drag clips between Audio and Track Align lanes.'
              : 'No piano roll — clips live on the timeline (playlist/studio editor arranger). Import from Vocal Lab or use the audio lane tools above.'}
          </span>
        </div>
      ) : (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {!expanded ? rhythmEditPanel : null}
        <div className="flex shrink-0" style={{ height: PIANO_RULER_H_PX }}>
          <div
            className="shrink-0 flex items-end justify-center pb-0.5 border-r text-[8px] font-bold uppercase"
            style={{
              width: PIANO_KEY_W_PX,
              borderColor: '#1a1a22',
              background: '#0c0c12',
              color: '#5c5c68',
            }}
          />
          <div className="flex-1 min-w-0 overflow-hidden relative" style={{ background: '#0c0c12' }}>
            <div
              className="relative"
              style={{ transform: `translateX(-${hScroll}px)`, width: stripW, height: '100%' }}
              onPointerDown={(e) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                if (running) void Promise.resolve(onPauseForEdit());
                const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
                onSeekFromPianoRuler(x);
              }}
              onContextMenu={onPianoBarRulerContextMenu}
              title="Click ruler to seek playhead"
            >
              <canvas ref={rulerCanvasRef} aria-hidden className="block max-w-none pointer-events-none" style={{ verticalAlign: 'top' }} />
              {showLoopShade && (
                <>
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                      left: loopLsX,
                      width: loopSpan,
                      zIndex: 2,
                      background: 'rgba(124,244,198,0.22)',
                      borderTop: '2px solid #7cf4c6',
                    }}
                    aria-hidden
                  />
                  {loopSpan > 40 && (
                    <div
                      className="absolute top-0 bottom-0 flex items-center pointer-events-none"
                      style={{
                        left: loopLsX + 9,
                        zIndex: 3,
                        fontSize: 8,
                        color: '#7cf4c6',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                      aria-hidden
                    >
                      {`${Math.round((loopEndBeat - loopStartBeat) / bpb)} bar loop`}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div
          ref={gridSlotRef}
          className={
            expanded
              ? 'flex-1 min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain'
              : chordGenieStripOpen
                ? 'flex flex-1 min-h-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain'
                : 'flex flex-1 min-h-0 flex-col justify-end overflow-x-hidden overflow-y-hidden'
          }
        >
          <div className="relative flex shrink-0 w-full" style={{ height: gridH }}>
            <div
              ref={keyStripShellRef}
              data-studio-piano-roll-keys
              className="shrink-0 relative flex touch-none flex-col border-r select-none isolate z-[20]"
              role="application"
              aria-label="Piano keys â€” drag along keys to play; velocity follows strike height on each key row"
              style={{
                width: PIANO_KEY_W_PX,
                height: gridH,
                borderColor: '#2a2a34',
                background: drumKeyLabelForPitch ? '#0c0c10' : '#e8e8f0',
                boxShadow: drumKeyLabelForPitch
                  ? 'inset -2px 0 8px rgba(0,0,0,0.65)'
                  : 'inset -2px 0 4px rgba(0,0,0,0.18)',
                pointerEvents: 'auto',
                touchAction: 'none',
                overflow: 'hidden',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
              onPointerDown={onKeyStripPointerDown}
              onPointerMove={onKeyStripPointerMove}
              onPointerUp={onKeyStripPointerUpOrCancel}
              onPointerCancel={onKeyStripPointerUpOrCancel}
              onPointerLeave={onKeyStripPointerLeave}
              onLostPointerCapture={onKeyStripLostPointerCapture}
              onClick={onKeyStripClick}
              onContextMenu={onKeyStripContextMenu}
            >
              {/* â”€â”€ Piano keys or drum pad labels â”€â”€ */}
              <div
                className="flex h-full min-h-0 flex-col pointer-events-none [&_*]:pointer-events-none"
                aria-hidden="true"
              >
                {Array.from({ length: rowCount }, (_, i) => {
                  const pitch = pianoPitchForRow(effectivePitchView, i);
                  const drumLab = drumKeyLabelForPitch?.(pitch);
                  if (drumLab) {
                    const down = pressedPitches.has(pitch);
                    return (
                      <div
                        key={pitch}
                        style={{
                          height: rowH,
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 4px',
                          borderBottom: '1px solid rgba(124, 244, 198, 0.32)',
                          background: down
                            ? 'linear-gradient(180deg, #1a1a20 0%, #121218 55%, #0e0e14 100%)'
                            : 'linear-gradient(180deg, #141418 0%, #0e0e12 55%, #0a0a0e 100%)',
                          boxShadow: down
                            ? 'inset 0 4px 10px rgba(0,0,0,0.72), inset 0 1px 0 rgba(72,78,92,0.08)'
                            : 'inset 0 1px 0 rgba(72,78,92,0.14), inset 0 -2px 5px rgba(0,0,0,0.58), inset 0 0 0 1px rgba(0,0,0,0.42)',
                          transform: down ? 'translateY(1px)' : undefined,
                          transition: 'transform 0.045s ease-out, background 0.045s ease-out, box-shadow 0.045s ease-out',
                        }}
                      >
                        <span
                          className="truncate font-bold uppercase tracking-wide"
                          style={{ fontSize: Math.max(7, Math.min(10, rowH - 4)), color: '#8b909a' }}
                        >
                          {drumLab}
                        </span>
                      </div>
                    );
                  }
                  const bk    = isBlackKeyPitch(pitch);
                  const lab   = whiteKeyLabel(pitch);
                  const down  = pressedPitches.has(pitch);
                  /* Black keys occupy ~62% of the strip width; the remaining right portion
                   * stays white-key coloured so the white key appears to extend behind it. */
                  const BK_W_PCT = 62;

                  return (
                    <div
                      key={pitch}
                      style={{
                        height: rowH,
                        boxSizing: 'border-box',
                        display: 'flex',
                        position: 'relative',
                        /* Thin separator between white keys only */
                        borderBottom: bk
                          ? 'none'
                          : i === rowCount - 1
                            ? 'none'
                            : '1px solid rgba(0,0,0,0.09)',
                      }}
                    >
                      {bk ? (
                        /* â”€â”€â”€ Black key row â”€â”€â”€ */
                        <>
                          {/* The actual black key cap */}
                          <div
                            style={{
                              width: `${BK_W_PCT}%`,
                              height: '100%',
                              boxSizing: 'border-box',
                              transformOrigin: 'top center',
                              transform: down ? 'translateY(1px) scaleY(0.94)' : 'translateY(0) scaleY(1)',
                              transition: down
                                ? 'transform 0.035s cubic-bezier(.2,.85,.35,1), background 0.035s ease-out, box-shadow 0.035s ease-out'
                                : 'transform 0.1s cubic-bezier(.2,.9,.35,1), background 0.1s ease-out, box-shadow 0.1s ease-out',
                              background: down
                                ? 'linear-gradient(180deg, #3a4158 0%, #484860 52%, #2a2838 100%)'
                                : 'linear-gradient(180deg, #1c1c28 0%, #262636 40%, #141420 100%)',
                              boxShadow: down
                                ? 'inset 0 6px 10px rgba(0,0,0,0.92), inset 0 2px 0 rgba(124,244,198,0.18), inset -1px 0 0 rgba(255,255,255,0.06)'
                                : 'inset 0 1px 0 rgba(255,255,255,0.10), inset -1px 0 0 rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.6)',
                              borderRight: '1px solid rgba(0,0,0,0.5)',
                              borderBottom: '1px solid rgba(0,0,0,0.4)',
                              zIndex: 2,
                            }}
                          />
                          {/* Right portion â€” white key continuation; must depress too (same row / same pitch). */}
                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                              height: '100%',
                              boxSizing: 'border-box',
                              transformOrigin: 'top center',
                              transform: down ? 'translateY(3px) scaleY(0.94)' : 'translateY(0) scaleY(1)',
                              transition: down
                                ? 'transform 0.035s cubic-bezier(.2,.85,.35,1), background 0.035s ease-out, box-shadow 0.035s ease-out'
                                : 'transform 0.1s cubic-bezier(.2,.9,.35,1), background 0.1s ease-out, box-shadow 0.1s ease-out',
                              background: down
                                ? 'linear-gradient(90deg, #c8ebe0 0%, #a8dcc8 45%, #8ad4b8 100%)'
                                : '#e8e8f0',
                              boxShadow: down
                                ? 'inset 0 4px 8px rgba(0,0,0,0.2), inset 0 2px 0 rgba(124,244,198,0.22)'
                                : 'inset 0 1px 0 rgba(255,255,255,0.35)',
                              borderBottom: '1px solid rgba(0,0,0,0.07)',
                            }}
                          />
                        </>
                      ) : (
                        /* â”€â”€â”€ White key row â”€â”€â”€ */
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            boxSizing: 'border-box',
                            transformOrigin: 'top center',
                            transform: down ? 'translateY(4px) scaleY(0.94)' : 'translateY(0) scaleY(1)',
                            transition: down
                              ? 'transform 0.035s cubic-bezier(.2,.85,.35,1), background 0.035s ease-out, box-shadow 0.035s ease-out'
                              : 'transform 0.1s cubic-bezier(.2,.9,.35,1), background 0.1s ease-out, box-shadow 0.1s ease-out',
                            background: down
                              ? 'linear-gradient(180deg, #bff5e8 0%, #7cdbbc 42%, #5bc4a8 100%)'
                              : 'linear-gradient(90deg, #e8e8f0 0%, #fafafa 30%, #f2f2f8 70%, #e4e4ec 100%)',
                            boxShadow: down
                              ? 'inset 0 6px 10px rgba(0,0,0,0.28), inset 0 3px 0 rgba(124,244,198,0.35), inset 0 1px 0 rgba(255,255,255,0.5)'
                              : 'inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            paddingLeft: 5,
                            fontSize: Math.max(9, Math.min(12, Math.round(rowH * 0.42))),
                            fontWeight: 700,
                            color: lab ? (down ? '#1a4038' : '#5a5a70') : 'transparent',
                            letterSpacing: '0.01em',
                          }}
                        >
                          {lab}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div ref={hScrollRef} className="relative z-10 min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden" onScroll={onHScroll}>
              <div
                className="relative inline-block touch-none select-none"
                style={{
                  width: stripW,
                  height: gridH,
                  verticalAlign: 'top',
                  cursor:
                    tool === 'pencil'
                      ? 'crosshair'
                      : tool === 'erase'
                        ? 'cell'
                        : 'default',
                }}
                title={
                  tool === 'select' && !isAudioTrack
                    ? 'Click notes to select and move · Shift+drag empty grid to box-select multiple · Shift+click toggles selection'
                    : undefined
                }
                onPointerDown={onGridPointerDown}
                onPointerMove={onGridPointerMove}
                onPointerUp={onGridPointerUp}
                onPointerCancel={onGridPointerUp}
                onDoubleClick={onGridDoubleClick}
                onContextMenu={onGridContextMenu}
                role="presentation"
              >
                <canvas ref={pianoGridCanvasRef} className="block max-w-none pointer-events-none" style={{ verticalAlign: 'top' }} />
                {marqueeBox && (
                  <div
                    className="absolute z-[8] pointer-events-none"
                    style={{
                      left: marqueeBox.left,
                      top: marqueeBox.top,
                      width: marqueeBox.width,
                      height: marqueeBox.height,
                      border: '1px solid rgba(124,244,198,0.85)',
                      background: 'rgba(124,244,198,0.14)',
                    }}
                    aria-hidden
                  />
                )}
                {showLoopShade && (
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none z-[5]"
                    style={{
                      left: loopLsX,
                      width: loopSpan,
                      background: 'rgba(124,244,198,0.05)',
                      boxShadow: 'inset 0 0 0 1px rgba(124,244,198,0.15)',
                    }}
                    aria-hidden
                  />
                )}
                <div
                  ref={playheadRef}
                  className="absolute left-0 top-0 bottom-0 pointer-events-none z-10"
                  style={{
                    width: PLAYHEAD_W_PX,
                    background: '#7cf4c6',
                    transform: 'translate3d(0,0,0)',
                    boxShadow: '0 0 6px rgba(124,244,198,0.35)',
                    willChange: 'transform',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          className="relative z-10 flex shrink-0 border-t"
          style={{
            borderColor: '#1a1a22',
            height: velocityLaneOpen ? PIANO_VELOCITY_LANE_H_PX : PIANO_VELOCITY_TOGGLE_H_PX,
            marginTop: 0,
            boxShadow: 'none',
            background: '#0c0c12',
          }}
        >
          <button
            type="button"
            onClick={() => setVelocityLaneOpen((v) => !v)}
            title={velocityLaneOpen ? 'Hide velocity lane' : 'Show velocity lane'}
            aria-expanded={velocityLaneOpen}
            aria-label={velocityLaneOpen ? 'Hide velocity lane' : 'Show velocity lane'}
            className="shrink-0 flex items-center justify-center gap-0.5 border-r transition-colors hover:bg-white/[0.04]"
            style={{
              width: PIANO_KEY_W_PX,
              height: '100%',
              borderColor: '#1a1a22',
              background: velocityLaneOpen ? '#0c0c12' : 'rgba(124,244,198,0.06)',
              color: velocityLaneOpen ? '#6a6a78' : '#7cf4c6',
              cursor: 'pointer',
            }}
          >
            {velocityLaneOpen ? (
              <ChevronDown size={10} strokeWidth={2.5} aria-hidden />
            ) : (
              <ChevronUp size={10} strokeWidth={2.5} aria-hidden />
            )}
            <span className="text-[8px] font-bold uppercase leading-none">Vel</span>
          </button>
          {velocityLaneOpen ? (
            <div className="flex-1 min-w-0 overflow-hidden" style={{ background: '#0c0c12' }}>
              <div
                className="relative"
                style={{
                  transform: `translateX(-${hScroll}px)`,
                  width: stripW,
                  height: PIANO_VELOCITY_LANE_H_PX,
                }}
              >
                <canvas ref={pianoVelCanvasRef} className="block max-w-none pointer-events-none" style={{ verticalAlign: 'top' }} />
                {showLoopShade && (
                  <div
                    className="absolute top-0 pointer-events-none"
                    style={{
                      left: loopLsX,
                      width: loopSpan,
                      height: PIANO_VELOCITY_LANE_H_PX,
                      background: 'rgba(124,244,198,0.05)',
                      boxShadow: 'inset 0 0 0 1px rgba(124,244,198,0.15)',
                      zIndex: 1,
                    }}
                    aria-hidden
                  />
                )}
                <div
                  className="absolute left-0 top-0 touch-none"
                  style={{
                    width: stripW,
                    height: PIANO_VELOCITY_LANE_H_PX,
                    cursor:
                      tool === 'pencil' ? 'ns-resize' : tool === 'erase' ? 'cell' : 'default',
                  }}
                  onPointerDown={onVelPointerDown}
                  onPointerMove={onVelPointerMove}
                  onPointerUp={onVelPointerUp}
                  onPointerCancel={onVelPointerUp}
                  onContextMenu={onVelContextMenu}
                  role="presentation"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
      )}
      </>
      )}
    </div>
  );
}

type StudioEditor2ScreenProps = {
  isScreenActive: boolean;
  pendingStudioAudioBlob?: Blob | null;
  onPendingStudioAudioConsumed?: () => void;
  pendingNeuralHumStudioImport?: PendingNeuralHumStudioImport | null;
  onPendingNeuralHumStudioConsumed?: () => void;
  pendingBeatPadsStudioImport?: PendingBeatPadsStudioImport | null;
  onPendingBeatPadsStudioConsumed?: () => void;
  pendingAiMatchStudioImport?: PendingAiMatchStudioImport | null;
  onPendingAiMatchStudioConsumed?: () => void;
  onOpenBeatLab?: () => void;
  onExportToMasteringBay?: (payload: MasteringBaySourcePayload) => void;
};

export default function StudioEditor2Screen({
  isScreenActive,
  pendingStudioAudioBlob = null,
  onPendingStudioAudioConsumed,
  pendingNeuralHumStudioImport = null,
  onPendingNeuralHumStudioConsumed,
  pendingBeatPadsStudioImport = null,
  onPendingBeatPadsStudioConsumed,
  pendingAiMatchStudioImport = null,
  onPendingAiMatchStudioConsumed,
  onOpenBeatLab,
  onExportToMasteringBay,
}: StudioEditor2ScreenProps) {
  const { settings } = useSettings();
  const [se2SessionBoot] = useState(() => {
    maybeCaptureExistingSessionAsOwnerStartup();
    applySe2FactoryDefaultsIfNeeded();
    applySe2OwnerStartupTemplateToSession();
    const saved = readSe2SessionSnapshot() ?? readSe2FactoryDefaultSession();
    const tracks = se2AssignMissingLaneNumbers(
      saved != null
        ? (normalizeSe2SessionTracks(saved.tracks) as MockMusioTrack[])
        : cloneMockTracks(),
    );
    const arrays = buildSe2MixerArraysFromSnapshot(
      tracks,
      readSe2StudioMixerSnapshot(),
      MAX_STUDIO_TRACKS,
    );
    return { tracks, arrays, saved };
  });
  /** Saved template view layout (which panel was showing) — restored once on cold open. */
  const [se2StartupView] = useState(() => readSe2OwnerStartupView());
  const se2SavedSession = se2SessionBoot.saved;
  const [bpm, setBpm] = useState(() => clampSe2SessionBpm(se2SavedSession?.bpm));
  const [songKeyRoot, setSongKeyRoot] = useState(() =>
    typeof se2SavedSession?.songKeyRoot === 'number' && Number.isFinite(se2SavedSession.songKeyRoot)
      ? Math.max(0, Math.min(11, Math.round(se2SavedSession.songKeyRoot)))
      : 0,
  );
  const [songKeyMode, setSongKeyMode] = useState<StudioDetectedKeyMode>(() =>
    se2SavedSession?.songKeyMode === 'minor' ? 'minor' : 'major',
  );
  const [running, setRunning] = useState(false);
  const [metroOn, setMetroOn] = useState(false);
  /** Record count-in — rimshot bars before capture (only when mic is armed + Play). */
  const [precountEnabled, setPrecountEnabled] = useState(false);
  const [precountBars, setPrecountBars] = useState<1 | 2>(1);
  const [isPrecounting, setIsPrecounting] = useState(false);
  const [precountBeatUi, setPrecountBeatUi] = useState<{ beat: number; total: number } | null>(null);
  const [zoom, setZoom] = useState(() =>
    clampStudioZoom(
      typeof se2SavedSession?.timelineZoom === 'number' && Number.isFinite(se2SavedSession.timelineZoom)
        ? se2SavedSession.timelineZoom
        : STUDIO_DEFAULT_ZOOM,
    ),
  );
  const [loopOn, setLoopOn] = useState(() => Boolean(se2SavedSession?.loopOn));
  const [loopBars, setLoopBars] = useState(() =>
    typeof se2SavedSession?.loopBars === 'number' && Number.isFinite(se2SavedSession.loopBars)
      ? Math.max(1, Math.min(SE2_ARRANGEMENT_BARS, Math.round(se2SavedSession.loopBars)))
      : 4,
  );
  /** Loop region in beats â€” draggable directly on the timeline ruler bar (FL Studio style). */
  const [loopStartBeat, setLoopStartBeat] = useState(() =>
    typeof se2SavedSession?.loopStartBeat === 'number' && Number.isFinite(se2SavedSession.loopStartBeat)
      ? Math.max(0, se2SavedSession.loopStartBeat)
      : 0,
  );
  const [loopEndBeat, setLoopEndBeat] = useState(() =>
    typeof se2SavedSession?.loopEndBeat === 'number' && Number.isFinite(se2SavedSession.loopEndBeat)
      ? Math.max(1, se2SavedSession.loopEndBeat)
      : 16,
  );
  const [recording, setRecording] = useState(false);
  /** Mic armed on transport — capture waits for Play (does not auto-start when stopped). */
  const [recordStandby, setRecordStandby] = useState(false);
  const [consolidateBusy, setConsolidateBusy] = useState(false);
  const [consolidateStartBar, setConsolidateStartBar] = useState(1);
  const [consolidateEndBar, setConsolidateEndBar] = useState(32);
  const [exportBusy, setExportBusy] = useState(false);
  const [songName, setSongName] = useState('Untitled Song');
  const [songFileLabel, setSongFileLabel] = useState<string | undefined>(undefined);
  const [songLastSavedAt, setSongLastSavedAt] = useState<string | null>(null);
  const [songSaveBusy, setSongSaveBusy] = useState(false);
  const [showPianoRoll, setShowPianoRoll] = useState(() => se2StartupView?.showPianoRoll ?? false);
  const [pianoRollExpanded, setPianoRollExpanded] = useState(false);
  const [harmonyPanelOpen, setHarmonyPanelOpen] = useState(false);
  const [glideBassPanelOpen, setGlideBassPanelOpen] = useState(false);
  const [synthGenoPanelOpen, setSynthGenoPanelOpen] = useState(false);
  const [synthGenoBuildFullscreenOpen, setSynthGenoBuildFullscreenOpen] = useState(false);
  const [grooveLeadPanelOpen, setGrooveLeadPanelOpen] = useState(false);
  const [lab808PanelOpen, setLab808PanelOpen] = useState(false);
  const [se2Lab808Voices, setSe2Lab808Voices] = useState<Se2Lab808VoiceParams[]>(() =>
    Array.from({ length: MAX_STUDIO_TRACKS }, () => se2Lab808DefaultVoice()),
  );
  const se2Lab808VoicesRef = useRef(se2Lab808Voices);
  const [genoUltraSynthPanelOpen, setGenoUltraSynthPanelOpen] = useState(false);
  const [genoBassSynthPanelOpen, setGenoBassSynthPanelOpen] = useState(false);
  const [genoUltraKeySourceTrackIndex, setGenoUltraKeySourceTrackIndex] = useState(0);
  const [genoBassKeySourceTrackIndex, setGenoBassKeySourceTrackIndex] = useState(0);
  const [genoBuildSessionTick, setGenoBuildSessionTick] = useState(0);
  const [drumGeneratorPanelOpen, setDrumGeneratorPanelOpen] = useState(false);
  const [beatPadsMachineOpen, setBeatPadsMachineOpen] = useState(() => {
    const hasBeatPads = se2SessionBoot.tracks.some((t) => studioTrackIsBeatPadsChannel(t));
    if (hasBeatPads) return true;
    return se2SavedSession?.beatPadsMachineOpen ?? true;
  });
  const [humCapturePanelOpen, setHumCapturePanelOpen] = useState(false);
  const [guitarPanelOpen, setGuitarPanelOpen] = useState(false);
  const [chordGeniePanelOpen, setChordGeniePanelOpen] = useState(false);
  const harmonyBtnRef = useRef<HTMLButtonElement>(null);
  const [se2GlideBassVoices, setSe2GlideBassVoices] = useState<BeatLabBassSynthVoiceParams[]>(() =>
    Array.from({ length: MAX_STUDIO_TRACKS }, () =>
      beatLabBassSynthVoiceParamsFromPresetId(BEAT_LAB_DEFAULT_SYNTH_PRESET_ID),
    ),
  );
  const se2GlideBassVoicesRef = useRef(se2GlideBassVoices);
  const [se2SynthGenoVoices, setSe2SynthGenoVoices] = useState<Se2SynthGenoVoiceParams[]>(() =>
    Array.from({ length: MAX_STUDIO_TRACKS }, () => se2SynthGenoDefaultVoice()),
  );
  const se2SynthGenoVoicesRef = useRef(se2SynthGenoVoices);
  const [se2GrooveLeadVoices, setSe2GrooveLeadVoices] = useState<Se2GrooveLeadVoiceParams[]>(() =>
    Array.from({ length: MAX_STUDIO_TRACKS }, () => se2GrooveLeadDefaultVoice()),
  );
  const [se2GenoUltraSynthVoices, setSe2GenoUltraSynthVoices] = useState<GenoUltraSynthVoiceParams[]>(() =>
    Array.from({ length: MAX_STUDIO_TRACKS }, () => genoUltraPresetById(GENO_ULTRA_DEFAULT_PRESET_ID)),
  );
  const [se2GenoBassSynthVoices, setSe2GenoBassSynthVoices] = useState<GenoUltraSynthVoiceParams[]>(() =>
    Array.from({ length: MAX_STUDIO_TRACKS }, () => genoBassPresetById(GENO_BASS_DEFAULT_PRESET_ID)),
  );
  const se2GrooveLeadVoicesRef = useRef(se2GrooveLeadVoices);
  const se2GenoUltraSynthVoicesRef = useRef(se2GenoUltraSynthVoices);
  const se2GenoBassSynthVoicesRef = useRef(se2GenoBassSynthVoices);
  const [pianoPanelH, setPianoPanelH] = useState(() =>
    typeof window !== 'undefined' ? defaultPianoPanelHeightPx(window.innerHeight) : 440,
  );
  const [viewportH, setViewportH] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 800,
  );
  const [showMixer, setShowMixer] = useState(() => se2StartupView?.showMixer ?? false);
  /** Populated when mixer is visible â€” browser mic/line inputs for audio-track strips. */
  const [micInputDeviceOptions, setMicInputDeviceOptions] = useState<MediaDeviceOption[]>([]);
  /** Mixer: audio-track input picker anchored to mic (no inline `<select`). */
  const [mixerAudioInputPopover, setMixerAudioInputPopover] = useState<null | { trackIndex: number; top: number; left: number }>(
    null,
  );
  const [mixerPanelH, setMixerPanelH] = useState(400);
  const mixerPersistReadyRef = useRef(false);
  const sessionPersistReadyRef = useRef(false);
  const sessionAudioRestoredRef = useRef(false);
  const songFileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const songOpenInputRef = useRef<HTMLInputElement | null>(null);
  const [ownerStartupSavedTick, setOwnerStartupSavedTick] = useState(() =>
    hasSe2OwnerStartupTemplate() ? 1 : 0,
  );
  const [templateSaveOpen, setTemplateSaveOpen] = useState(false);
  const [templateSaveName, setTemplateSaveName] = useState('SE2 Template');
  /* Per-track mixer — SE2-only (not Groove/Beat Lab CH 1–48 / MasterClock channelVolumes). */
  const [trackVolumes, setTrackVolumes] = useState<number[]>(() => se2SessionBoot.arrays.volumes);
  const [trackPans,   setTrackPans]   = useState<number[]>(() => se2SessionBoot.arrays.pans);
  const [trackMutes,  setTrackMutes]  = useState<boolean[]>(() => se2SessionBoot.arrays.mutes);
  const [trackSolos,  setTrackSolos]  = useState<boolean[]>(() => se2SessionBoot.arrays.solos);
  /** When true: ignore pan knob (collapsed mono path). When false: stereo imaging via pan knob. */
  const [trackMonos,  setTrackMonos]  = useState<boolean[]>(() => se2SessionBoot.arrays.monos);
  /** Per-channel Record Enable â€” Pro Tools/Cubase-style red R (arms track for punch-in/overdub workflows). */
  const [trackRecordArmed, setTrackRecordArmed] = useState<boolean[]>(() => Array(MAX_STUDIO_TRACKS).fill(false));
  const [masterVolume, setMasterVolume] = useState(() => se2SessionBoot.arrays.masterVol127);
  /** Tracks which fader cap is being dragged (arrow glow + readout emphasis). */
  const [mixerFaderActive, setMixerFaderActive] = useState<
    null | { kind: 'track'; index: number } | { kind: 'master' }
  >(null);
  /** Per-strip insert FX â€” 3 slots Ã— MAX_STUDIO_TRACKS; Pitch Tune / Vocoder wired on audio lanes. */
  const [trackFxSlots, setTrackFxSlots] = useState<[MixerEffectId, MixerEffectId, MixerEffectId][]>(() =>
    Array.from({ length: MAX_STUDIO_TRACKS }, () => emptyMixerFxSlots()),
  );
  const trackFxSlotsRef = useRef(trackFxSlots);
  const [trackVocalFx, setTrackVocalFx] = useState<StudioTrackVocalFx[]>(() =>
    Array.from({ length: MAX_STUDIO_TRACKS }, () => ({ ...STUDIO_TRACK_VOCAL_FX_DEFAULT })),
  );
  const trackVocalFxRef = useRef(trackVocalFx);
  const [trackInsertFxRacks, setTrackInsertFxRacks] = useState<StudioTrackInsertFxRack[]>(() =>
    Array.from({ length: MAX_STUDIO_TRACKS }, () => defaultStudioTrackInsertFxRack()),
  );
  const trackInsertFxRacksRef = useRef(trackInsertFxRacks);
  const [masterFxSlots, setMasterFxSlots] = useState<[MixerEffectId, MixerEffectId, MixerEffectId]>(() =>
    emptyMixerFxSlots(),
  );
  const [masterInsertFxRack, setMasterInsertFxRack] = useState<StudioTrackInsertFxRack>(() =>
    defaultStudioTrackInsertFxRack(),
  );

  /* Mixer meter refs â€” updated directly from animationTick (no React state for 60fps DOM writes). */
  const showMixerRef      = useRef(false);
  const mixerMeterLsRef   = useRef<(HTMLDivElement | null)[]>([]);
  const mixerMeterRsRef   = useRef<(HTMLDivElement | null)[]>([]);
  /** Track-lane horizontal IN meters — same meter loop as mixer channel strips. */
  const trackLaneMeterLsRef = useRef<(HTMLDivElement | null)[]>([]);
  const trackLaneMeterRsRef = useRef<(HTMLDivElement | null)[]>([]);
  const trackLaneMeterShellRef = useRef<(HTMLDivElement | null)[]>([]);
  const mixerMasterLRef   = useRef<HTMLDivElement | null>(null);
  const mixerMasterRRef   = useRef<HTMLDivElement | null>(null);
  /** Track-strip scroll — anchor lanes next to pinned master (grow left). */
  const mixerTrackScrollRef = useRef<HTMLDivElement | null>(null);
  /** Smoothed peak level 0â€“1 per track, decays between hits. */
  const mixerLevelsRef    = useRef<number[]>(Array(MAX_STUDIO_TRACKS).fill(0));
  /** One-time reroute of preview/metro buses onto studio master (avoid disconnect glitches during playback). */
  const se2OutputGraphMigratedRef = useRef(false);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(() => {
    const tracks = se2SessionBoot.tracks;
    const beatPadsIdx = tracks.findIndex((t) => studioTrackIsBeatPadsChannel(t));
    if (beatPadsIdx >= 0) return beatPadsIdx;
    return clampSe2SessionSelectedTrack(se2SavedSession?.selectedTrackIndex, tracks.length);
  });
  /** Bumps when Vocal FX pitch scope opens — re-resolves mic → track routing. */
  const [pitchMonitorRouteTick, setPitchMonitorRouteTick] = useState(0);
  const [studioTracks, setStudioTracks] = useState<MockMusioTrack[]>(() =>
    se2SessionBoot.tracks.map((t) =>
      studioTrackIsGenoUltraSynthChannel(t) && t.genoUltraArpSyncLocked
        ? { ...t, genoUltraArpSyncLocked: false }
        : t,
    ),
  );

  const studioTracksRef = useRef(studioTracks);
  studioTracksRef.current = studioTracks;
  /** Lane id/kind only — avoid mixer graph rebuild on 808 grid / note edits. */
  const studioMixerRouteSig = studioTracks.map((t) => `${t.id}:${t.kind}`).join('|');
  const [pianoTool, setPianoTool] = useState<PianoRollTool>('select');
  const [timelineTool, setTimelineTool] = useState<TimelineArrangeTool>('select');
  const [selectedPianoNoteIndex, setSelectedPianoNoteIndex] = useState<number | null>(null);
  const [selectedPianoNoteIndexes, setSelectedPianoNoteIndexes] = useState<Set<number>>(() => new Set());
  const [selectedTimelineAudioClip, setSelectedTimelineAudioClip] = useState<{
    trackIndex: number;
    clipId: string;
  } | null>(null);
  const [audioClipSplitMarkerBeat, setAudioClipSplitMarkerBeat] = useState<number | null>(null);
  const [audioClipDropHoverTrackIndex, setAudioClipDropHoverTrackIndex] = useState<number | null>(null);
  const [audioClipboardHeld, setAudioClipboardHeld] = useState(false);
  const [quantizeStrength, setQuantizeStrength] = useState(100);
  const [quantizeSwing, setQuantizeSwing] = useState(0);
  const [showGhostNotes, setShowGhostNotes] = useState(true);
  const [showScaleGuides, setShowScaleGuides] = useState(false);
  const [midiClipboardHeld, setMidiClipboardHeld] = useState(false);
  const [editorContextMenu, setEditorContextMenu] = useState<{ x: number; y: number } | null>(null);
  /**
   * Captured when the MIDI context menu opens (same tick as hit-testing).
   * Avoids actions reading stale `selectedPianoNoteIndex` before React flushes, and survives the
   * track/piano selection ref sync. Cleared when the menu closes.
   */
  const midiMenuTargetRef = useRef<{ trackIndex: number; noteIndex: number | null } | null>(null);
  /** While the context menu is open: does the open gesture target a note? Drives disabled rows (avoids stale React selection). */
  const [contextMenuHasNoteTarget, setContextMenuHasNoteTarget] = useState(false);
  const [contextMenuHasAudioTarget, setContextMenuHasAudioTarget] = useState(false);
  /** Time signature numerator (denominator fixed 4 in UI Ã¢â‚¬â€ `n/4`). Drives timeline + piano ruler width. */
  const [beatsPerBar, setBeatsPerBar] = useState(() =>
    typeof se2SavedSession?.beatsPerBar === 'number' && Number.isFinite(se2SavedSession.beatsPerBar)
      ? Math.max(1, Math.min(12, Math.round(se2SavedSession.beatsPerBar)))
      : 4,
  );
  /** Piano edit snap: cells per quarter (`4` = 1/16 default, 960 PPQ â†’ 240 ticks/cell). */
  const [pianoSnapSubdivisions, setPianoSnapSubdivisions] = useState(readPianoSnapSubdivFromStorage);

  useEffect(() => {
    try {
      localStorage.setItem('dmb_shared_piano_snap_subdiv', String(pianoSnapSubdivisions));
    } catch {
      /* ignore */
    }
  }, [pianoSnapSubdivisions]);

  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    return subscribeGenoBuildSessionChanged(() => {
      setGenoBuildSessionTick((t) => t + 1);
    });
  }, []);

  const beatsPerBarRef = useRef(4);
  const totalBeatsRef = useRef(totalBeatsForSig(4));
  beatsPerBarRef.current = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  totalBeatsRef.current = totalBeatsForSig(beatsPerBarRef.current);

  const ctxRef = useRef<AudioContext | null>(null);
  const metroBusRef = useRef<GainNode | null>(null);
  /** Track MIDI preview (poly) — unity summing bus → {@link studioMasterOutRef}. */
  const midiPreviewBusRef = useRef<GainNode | null>(null);
  /** Master monitor gain — metronome + preview (same dB law as master fader UI). */
  const studioMasterOutRef = useRef<GainNode | null>(null);
  const clickBufferRef = useRef<AudioBuffer | null>(null);
  const accentBufferRef = useRef<AudioBuffer | null>(null);
  const precountRimshotBufferRef = useRef<AudioBuffer | null>(null);
  /** Dedupe lookahead scheduling per note occurrence (`trackId:idx:beat`). */
  const midiPreviewScheduledRef = useRef<Set<string>>(new Set());
  /** Dedupe hardware MIDI note on/off pairs from transport lookahead. */
  const midiHardwareScheduledRef = useRef<Set<string>>(new Set());
  const midiPortRoutingRef = useRef(settings.midiPortRouting);
  const studioMidiAccessRef = useRef<MIDIAccess | null>(null);
  /** Dedupe arranger audio clip scheduling (`trackId:clipId:startBeat`). */
  const audioPreviewScheduledRef = useRef<Set<string>>(new Set());
  /** Runtime `AudioBuffer` by `StudioAudioClip.sourceId` (same role as FL playlist sample data). */
  const studioAudioBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  /** Processed vocal-FX buffers keyed by {@link studioVocalFxCacheKey}. */
  const studioVocalFxCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const studioVocalFxPendingRef = useRef<Set<string>>(new Set());
  const scheduledPreviewAudioClipsRef = useRef<ScheduledPreviewAudioClip[]>([]);
  /** Loaded 16-pad producer kits keyed by catalog id (Piano Roll drum engine). */
  const studioDrumKitSessionsRef = useRef<Map<BeatLabProducerKitId, PianoRollDrumKitSession>>(new Map());
  /** Per-track merged kit sessions (base kit + pad overrides). */
  const studioDrumTrackSessionsRef = useRef<
    Map<string, { kitId: BeatLabProducerKitId; sig: string; session: PianoRollDrumKitSession }>
  >(new Map());
  const studioBeatPadsTrackSessionsRef = useRef<
    Map<string, { kitId: BeatLabProducerKitId; sig: string; session: Se2BeatPadsTrackSession }>
  >(new Map());
  const [beatPadsPadStoreRev, setBeatPadsPadStoreRev] = useState(0);
  const beatPadsPadStoreNotifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const silenceSe2SynthPreviewVoices = useCallback(() => {
    haltBeatLabSynthV2TransportVoices();
    haltGenoUltraSynthTransportVoices();
    haltStudioEditor2MidiInstrumentNotes();
    haltSe2GuitarTransportNotes();
    const ctx = ctxRef.current;
    haltOrchestraHitPlayback(ctx);
    haltPadSamplePlayback();
    if (ctx && ctx.state !== 'closed') {
      try {
        truncateKickKeyboardVoice(ctx, ctx.currentTime);
      } catch {
        /* */
      }
    }
    for (let ti = 0; ti < studioTracksRef.current.length; ti += 1) {
      const tr = studioTracksRef.current[ti];
      if (studioTrackIsGlideBassChannel(tr)) {
        stopBeatLabSynthV2HeldPreview(se2BeatLabLaneForTrack(ti));
      }
    }
  }, []);

  const cancelArrangerPreviewScheduling = useCallback(() => {
    midiPreviewScheduledRef.current.clear();
    midiHardwareScheduledRef.current.clear();
    audioPreviewScheduledRef.current.clear();
    midiPreviewLoopLapRef.current = 0;
    stopScheduledPreviewAudioClips(scheduledPreviewAudioClipsRef.current);
    cleanupAllStudioLiveVocalFx();
    interruptStudioProgressionAuditionForTransport();
    silenceSe2SynthPreviewVoices();
  }, [silenceSe2SynthPreviewVoices]);

  useEffect(() => {
    midiPortRoutingRef.current = settings.midiPortRouting;
  }, [settings.midiPortRouting]);

  useEffect(() => {
    if (!isScreenActive) return;
    void studioGetMidiAccess().then((access) => {
      studioMidiAccessRef.current = access;
    });
  }, [isScreenActive]);

  const runningRef = useRef(false);
  /** True while startTransport is arming — blocks meter loop from rebuilding strips mid-arm. */
  const transportArmingRef = useRef(false);
  /** `performance.now()` when transport last started â€” suppress false loop splices right after Play. */
  const transportPlayStartPerfMsRef = useRef(0);
  /** Debounce ctx.resume resync — repeated stop-all-WAV resyncs caused in/out dropouts. */
  const se2LastCtxResumeResyncMsRef = useRef(0);
  const sessionStartRef = useRef(0);
  const originBeatRef = useRef(0);
  const cursorBeatRef = useRef(0);
  const displayBeatRef = useRef(0);
  const getSe2TransportBeat = useCallback(() => displayBeatRef.current, []);
  /*
   * Two-clock sync Ã¢â‚¬â€ the same technique used by Core Audio / Pro Tools for smooth display:
   *
   *   Audio scheduler (every 25 ms): converts sessionStartRef (ctx.currentTime domain) into
   *   an equivalent performance.now() timestamp Ã¢â€ â€™ perfSessionStartMsRef.
   *   Formula: perfSessionStart = perf.now() + (sessionStart - ctx.currentTime) * 1000
   *
   *   RAF visual loop: uses rafTime (vsync-aligned DOMHighResTimeStamp) to interpolate
   *   beat position.  Formula: beat = origin + max(0, (rafTime - perfSessionStart) / 1000) * bpm/60
   *
   * rafTime is perfectly smooth (sub-ms, vsync-aligned). The 25 ms audio re-anchor keeps
   * it from drifting away from the audio clock.  No ctx.currentTime quantization in the
   * visual path whatsoever.
   */
  const schedAnchorTimeRef = useRef(0);
  const schedAnchorPerfRef = useRef(0);
  const perfSessionStartMsRef = useRef(0);

  /*
   * Web Animations API (WAAPI) playhead animations.
   * WAAPI animations on elements with will-change:transform run on the compositor thread,
   * meaning they advance smoothly even when the JS main thread is blocked by GC, audio
   * node creation, React re-renders, or OS scheduling Ã¢â‚¬â€ the root cause of all the skipping.
   *
   * wapiBpmRef / wapiPpbRef record the params used when the animation was created so the
   * RAF loop can accurately convert animation.currentTime Ã¢â€ â€™ beat without knowing the keyframes.
   *
   * Formula (in RAF): beat = (anim.currentTime ms / 1000) Ãƒâ€” (bpm / 60)
   */
  const playheadWapiRef    = useRef<Animation | null>(null);
  const pianoPhWapiRef     = useRef<Animation | null>(null);
  /** Visible arrange playhead — compositor transform (JS left writes were shaking against strip WAAPI). */
  const playheadVisibleWapiRef = useRef<Animation | null>(null);
  const loopPlayheadVisibleWapiRef = useRef<Animation | null>(null);
  /** Lane + ruler strip follow — compositor translate (keeps grid gliding during canvas refill). */
  const timelineFollowWapiLaneRef = useRef<Animation | null>(null);
  const timelineFollowWapiRulerRef = useRef<Animation | null>(null);
  const timelineFollowWapiMetaRef = useRef({
    off0: 0,
    off1: 0,
    durMs: 1,
    infinite: false,
    beatStart: 0,
    beatEnd: 1,
    origin: 0,
    pin: 0,
    maxScroll: 0,
    ppb: 1,
  });
  const wapiBpmRef         = useRef(120);
  const wapiPpbRef         = useRef(100);
  const bpmRef = useRef(120);
  const songKeyRootRef = useRef(0);
  const songKeyModeRef = useRef<StudioDetectedKeyMode>('major');
  const metroOnRef = useRef(false);
  const precountEnabledRef = useRef(false);
  const precountBarsRef = useRef<1 | 2>(1);
  const isPrecountingRef = useRef(false);
  const precountCancelRef = useRef(false);
  const beginSe2RecordWithOptionalPrecountRef = useRef<
    (opts?: { fromPlay?: boolean }) => Promise<void>
  >(async () => {});
  const recordingRef = useRef(false);
  const recordStandbyRef = useRef(false);
  const transportRecBtnRef = useRef<HTMLButtonElement | null>(null);
  const liveRecordSessionRef = useRef<Se2LiveRecordUiSession | null>(null);
  const liveRecordingPeaksRef = useRef<Map<string, number[]>>(new Map());
  /** Growing take clip — DOM overlay; WAAPI scaleX locks to playhead (no per-frame width). */
  const liveRecordClipElRef = useRef<HTMLDivElement | null>(null);
  const liveRecordClipWapiRef = useRef<Animation | null>(null);
  const lastToggleMsRef = useRef(0);
  /** Next quarter index `k` to schedule (`t = sessionStart + (k - origin) * spb`). */
  const nextMetroKRef = useRef(0);
  /** All live metronome BufferSourceNodes â€” stopped en-masse on loop reset to prevent doubling. */
  const scheduledMetroNodesRef = useRef<AudioBufferSourceNode[]>([]);
  /** Count-in clicks only — never mixed with playback metronome nodes. */
  const scheduledPrecountNodesRef = useRef<AudioBufferSourceNode[]>([]);

  const barsBarReadoutRef = useRef<HTMLSpanElement | null>(null);
  const barsBeatReadoutRef = useRef<HTMLSpanElement | null>(null);
  const barsTickReadoutRef = useRef<HTMLSpanElement | null>(null);
  const barsPauseReadoutRef = useRef<HTMLSpanElement | null>(null);
  const timeMinReadoutRef = useRef<HTMLSpanElement | null>(null);
  const timeSecReadoutRef = useRef<HTMLSpanElement | null>(null);
  const timeFrameReadoutRef = useRef<HTMLSpanElement | null>(null);
  const timelineCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const timelineRulerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const playheadWapiTimingRef = useRef<HTMLDivElement | null>(null);
  const playheadGroupRef = useRef<HTMLDivElement | null>(null);
  /** Loop-region playhead — visible only while loop is on and transport is playing. */
  const loopPlayheadGroupRef = useRef<HTMLDivElement | null>(null);
  const loopPlayheadLineRef = useRef<HTMLDivElement | null>(null);
  /** Cached reference to the inner line element Ã¢â‚¬â€ avoids querySelector on every RAF frame. */
  const playheadLineRef = useRef<HTMLDivElement | null>(null);
  const timelineStripRef = useRef<HTMLDivElement | null>(null);
  /** Follow sub-pixel pan — lanes/canvas only; playhead stays outside so WAAPI does not fight it. */
  const timelineFollowContentRef = useRef<HTMLDivElement | null>(null);
  /**
   * Arrange-view lane row height (timeline canvas + track name column).
   * Ref mirrors state for transport / RAF paths that cannot depend on render closure.
   */
  const [trackLaneHeightPx, setTrackLaneHeightPx] = useState(DEFAULT_TRACK_LANE_H_PX);
  const trackLaneHRef = useRef(DEFAULT_TRACK_LANE_H_PX);
  trackLaneHRef.current = clampArrangeLaneHeightPx(trackLaneHeightPx);
  /** Whole Studio 2 shell Ã¢â‚¬â€ arrange headers, mixer, transport share MIDI edit focus (like Live/Cubase project focus). */
  const studioUiRootRef = useRef<HTMLDivElement | null>(null);
  /** Ruler strip only Ã¢â‚¬â€ Musio-style scrub lives here so lane clicks select tracks, not the playhead. */
  const timelineRulerScrubRef = useRef<HTMLDivElement | null>(null);
  const timelineRulerHScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineRulerStripRef = useRef<HTMLDivElement | null>(null);
  const timelineHScrollRef = useRef<HTMLDivElement | null>(null);
  /** Pinned bottom bar â€” always visible; synced with `timelineHScrollRef`. */
  const timelineHBarRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollSyncRef = useRef<'main' | 'ruler' | 'bar' | null>(null);
  const transportPaintHostRef = useRef<HTMLDivElement | null>(null);
  const pianoPlayheadRef = useRef<HTMLDivElement | null>(null);
  const gridCacheRef = useRef<HTMLCanvasElement | null>(null);
  /** MIDI edit snapshots for menu shortcuts (does not snapshot every piano-drag frame). */
  const undoStacksRef = useRef<MockMusioTrack[][]>([]);
  const redoStacksRef = useRef<MockMusioTrack[][]>([]);
  const [undoStackDepth, setUndoStackDepth] = useState(0);
  const [redoStackDepth, setRedoStackDepth] = useState(0);
  const syncUndoRedoUi = useCallback(() => {
    setUndoStackDepth(undoStacksRef.current.length);
    setRedoStackDepth(redoStacksRef.current.length);
  }, []);
  const midiClipboardRef = useRef<MockMidiNote[] | null>(null);
  const audioClipboardRef = useRef<StudioAudioClip | null>(null);
  /** While transport is playing with loop on, WAAPI spans only `[loopStart, loopEnd]` so the needle cannot glide past the loop end between RAF ticks. */
  const wapiSegLoopRef = useRef<{
    active: boolean;
    loopStartBeat: number;
    loopEndBeat: number;
    durMs: number;
    /** When true: one compositor-thread animation repeats forever (`iterations: Infinity`); RAF only splices audio on cycle index bumps. Avoids cancel/rebuild jerk at each wrap. */
    seamlessLoop: boolean;
  }>({ active: false, loopStartBeat: 0, loopEndBeat: 0, durMs: 1, seamlessLoop: false });
  /** Compositor seamless loop — one audio splice per WAAPI lap (metro wrap is backup only). */
  const lastCompositorLoopLapRef = useRef(-1);
  /** Last loop cycle index seen from playhead `anim.currentTime` (floor(t / durMs)) when seamlessLoop segment is active. */
  const wapiLoopCycleSeenRef = useRef(0);
  /** Last metro-grid lap index that already ran `applySe2MetroGridLoopSplice`. */
  const lastMetroLoopLapRef = useRef(0);
  const insideMetroLoopSpliceRef = useRef(false);
  const maybeSe2MetroLoopWrapRef = useRef<(ctx: AudioContext, ctSnap: number) => boolean>(() => false);
  /** Audio preview loop lap — bumped before each loop wrap refill so downbeats are not double-scheduled. */
  const midiPreviewLoopLapRef = useRef(0);
  /** Prior segment phase (mod durMs); detects wrap when RAF misses animation.currentTime crosses integer cycles. */
  const wapiPrevPhaseMsRef = useRef(-1);
  const timelineZoomRef = useRef(1);
  const scrubbingRef = useRef(false);
  const measureRulerGestureRef = useRef<{
    mode: 'pending' | 'scrub' | 'zoom';
    startX: number;
    startY: number;
    startZoom: number;
    lastY: number;
    lastZoom: number;
    anchorClientX: number;
    anchorBeat: number;
    dragCommitted: boolean;
  } | null>(null);
  /** Arrange-view lanes: draw / erase / drag MIDI (mirrors {@link MusioPianoRollPanel} tools). */
  const timelineMidiDragRef = useRef<{
    active: boolean;
    mode: 'move' | 'resize-left' | 'resize-right';
    trackIndex: number;
    noteIndex: number;
    beatPtrDown: number;
    anchorStart: number;
    anchorEnd: number;
    anchorPitch: number;
    lanePtrDown: number;
    selectedSnapshot: Array<{
      idx: number;
      startBeat: number;
      pitch: number;
      durationBeats: number;
    }>;
  }>({
    active: false,
    mode: 'move',
    trackIndex: -1,
    noteIndex: -1,
    beatPtrDown: 0,
    anchorStart: 0,
    anchorEnd: 0,
    anchorPitch: 60,
    lanePtrDown: 0,
    selectedSnapshot: [],
  });
  const timelineMarqueeRef = useRef<{
    active: boolean;
    trackIndex: number;
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    additive: boolean;
    baseSelection: Set<number>;
  }>({
    active: false,
    trackIndex: -1,
    startX: 0,
    startY: 0,
    curX: 0,
    curY: 0,
    additive: false,
    baseSelection: new Set<number>(),
  });
  const [timelineMarqueeBox, setTimelineMarqueeBox] = useState<null | {
    left: number;
    top: number;
    width: number;
    height: number;
  }>(null);
  /** Arrange-view: drag WAV clips between lanes (dedicated audio tracks). */
  const timelineAudioClipDragRef = useRef<{
    active: boolean;
    mode: 'move' | 'resize-left' | 'resize-right' | 'gain';
    sourceTrackIndex: number;
    targetTrackIndex: number;
    clipId: string;
    beatPtrDown: number;
    anchorStart: number;
    anchorEnd: number;
    anchorSourceOffset: number;
    durationBeats: number;
    startClientX: number;
    startClientY: number;
    dragCommitted: boolean;
    /** Track Align — Shift+edge = time-stretch; edge alone = trim. */
    alignEdgeStretch?: boolean;
    alignAnchorStretchRate?: number;
    /** Clip gain drag — dB at pointer-down. */
    anchorGainDb?: number;
  }>({
    active: false,
    mode: 'move',
    sourceTrackIndex: -1,
    targetTrackIndex: -1,
    clipId: '',
    beatPtrDown: 0,
    anchorStart: 0,
    anchorEnd: 0,
    anchorSourceOffset: 0,
    durationBeats: 0,
    startClientX: 0,
    startClientY: 0,
    dragCommitted: false,
    alignEdgeStretch: undefined,
    alignAnchorStretchRate: undefined,
    anchorGainDb: undefined,
  });
  /** Slice tool: drag on audio clip to position split marker, cut on pointer up. */
  const timelineAudioSliceDragRef = useRef<{
    active: boolean;
    trackIndex: number;
    clipId: string;
  }>({ active: false, trackIndex: -1, clipId: '' });
  /** Playhead scrub drag on timeline lanes (free drag; Shift = bar, Alt = free click placement). */
  const timelinePlayheadScrubRef = useRef<{ active: boolean }>({ active: false });
  const timelinePaintDragRef = useRef(false);
  const timelinePaintToolRef = useRef<PianoRollTool | null>(null);
  const timelinePaintLastClientRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const timelinePencilStrokeRef = useRef<{
    active: boolean;
    mode: 'line' | 'cells';
    trackIndex: number;
    anchorBeat: number;
    anchorPitch: number;
    strokeNoteIdx: number;
  } | null>(null);
  const transportRafRef = useRef(0);
  const isScreenActiveRef = useRef(isScreenActive);
  const loopOnRef = useRef(loopOn);
  const loopBarsRef = useRef(loopBars);

  /** FL-style loop-region drag state.
   *  mode: 'draw' = painting new region, 'left'/'right' = resizing handles, 'slide' = moving whole region */
  const loopDragRef = useRef<{
    mode: 'draw' | 'left' | 'right' | 'slide';
    startBeatSnapshot: number;
    endBeatSnapshot: number;
    anchorBeat: number;   // beat under pointer at drag start
  } | null>(null);

  /** Pan knob drag state â€” tracks which channel is being turned and its starting values. */
  const panDragRef = useRef<{ trackIndex: number; startY: number; startPan: number } | null>(null);

  const clearStudioVocalFxPlaybackCache = useCallback(() => {
    studioVocalFxCacheRef.current.clear();
    studioVocalFxPendingRef.current.clear();
    audioPreviewScheduledRef.current.clear();
    cleanupAllStudioLiveVocalFx();
    stopScheduledPreviewAudioClips(scheduledPreviewAudioClipsRef.current);
  }, []);

  const clearAudioPreviewForTrack = useCallback((trackIndex: number) => {
    stopScheduledPreviewAudioClips(scheduledPreviewAudioClipsRef.current, trackIndex);
    const tr = studioTracksRef.current[trackIndex];
    if (tr) {
      for (const key of [...audioPreviewScheduledRef.current]) {
        if (key.startsWith(`${tr.id}:`)) audioPreviewScheduledRef.current.delete(key);
      }
    }
  }, []);

  /** Rebuild Pitch Tune / Vocoder stack into strip.input — works while transport is locked. */
  const syncSe2TrackVocalFxNow = useCallback(async (
    trackIndex: number,
    fxOverride?: StudioTrackVocalFx,
  ) => {
    const ctx = ctxRef.current;
    const bus = midiPreviewBusRef.current;
    if (!ctx || !bus || ctx.state === 'closed') return;
    const masterOut = studioMasterOutRef.current ?? ctx.destination;
    ensureSe2MixerStrips(ctx, bus, masterOut);
    const slots = trackFxSlotsRef.current[trackIndex] ?? emptyMixerFxSlots();
    const rack = trackInsertFxRacksRef.current[trackIndex] ?? defaultStudioTrackInsertFxRack();
    const rawFx = fxOverride ?? trackVocalFxRef.current[trackIndex] ?? STUDIO_TRACK_VOCAL_FX_DEFAULT;
    const effectiveFx = studioEffectiveTrackVocalFx(rawFx, slots);
    se2TrackPlaybackInput(ctx, bus, trackIndex, slots, rack, bpmRef.current, masterOut);
    const preStrip = getStudioTrackInsertPreStrip(trackIndex);
    const stripIn = getStudioMixerStripInput(trackIndex);
    if (!preStrip || !stripIn) return;
    /* Park clips on entry immediately so the async stack install can splice without a dry stuck bus. */
    ensureStudioTrackVocalEntry(ctx, trackIndex, preStrip);
    const tr = studioTracksRef.current[trackIndex];
    const keyRoot = tr?.a2mKeyRoot != null ? tr.a2mKeyRoot : songKeyRootRef.current;
    const sessionStart = sessionStartRef.current;
    const origin = originBeatRef.current;
    const beatAtNow =
      runningRef.current && sessionStart > 0
        ? origin + Math.max(0, ctx.currentTime - sessionStart) * (bpmRef.current / 60)
        : origin;
    try {
      if (effectiveFx.autotuneOn) {
        await ensureStudioLivePitchTuneWorklet(ctx);
      }
      await syncStudioTrackVocalFxInsert({
        ctx,
        trackIndex,
        preStrip,
        stripIn,
        fx: effectiveFx,
        keyRoot,
        carrierTracks: studioEditorVocoderCarrierTracks(studioTracksRef.current),
        bpm: bpmRef.current,
        clipStartBeat: Math.max(0, beatAtNow),
        clipDurationBeats: 128,
        slots,
        rack,
      });
      reconnectStudioVocalLiveMicIfCached(trackIndex);
      /* Re-arm clip sources onto the (now FX-owned) entry after stack install. */
      clearAudioPreviewForTrack(trackIndex);
    } catch (e) {
      console.warn(`[Studio] Vocal DSP sync failed for track ${trackIndex}.`, e);
    }
  }, [clearAudioPreviewForTrack]);

  const onTrackVocalFxChange = useCallback(
    (trackIndex: number, nextFx: StudioTrackVocalFx) => {
      const prevFx = trackVocalFxRef.current[trackIndex] ?? STUDIO_TRACK_VOCAL_FX_DEFAULT;
      const slots = trackFxSlotsRef.current[trackIndex] ?? emptyMixerFxSlots();
      const reconnect = studioVocalFxEffectiveNeedsLiveReconnect(prevFx, nextFx, slots);
      const tr = studioTracksRef.current[trackIndex];
      const keyRoot = tr?.a2mKeyRoot != null ? tr.a2mKeyRoot : songKeyRootRef.current;
      const nextEffective = studioEffectiveTrackVocalFx(nextFx, slots);

      if (reconnect) {
        const ctx = ctxRef.current;
        const bus = midiPreviewBusRef.current;
        const preStrip = getStudioTrackInsertPreStrip(trackIndex);
        if (ctx && bus && preStrip && ctx.state !== 'closed') {
          se2TrackPlaybackInput(
            ctx,
            bus,
            trackIndex,
            slots,
            trackInsertFxRacksRef.current[trackIndex] ?? defaultStudioTrackInsertFxRack(),
            bpmRef.current,
            studioMasterOutRef.current ?? ctx.destination,
          );
          ensureStudioTrackVocalEntry(ctx, trackIndex, getStudioTrackInsertPreStrip(trackIndex) ?? preStrip);
        }
        invalidateStudioTrackVocalFxInsert(trackIndex);
        clearAudioPreviewForTrack(trackIndex);
        studioVocalFxCacheRef.current.clear();
        studioVocalFxPendingRef.current.clear();
      } else {
        /* Live stack owns clip + mic — faders update in place (same as DA FX Suite). */
        updateStudioLiveVocalFxForTrack(trackIndex, nextEffective, keyRoot, false);
      }

      setTrackVocalFx((prev) => {
        const next = prev.slice();
        next[trackIndex] = nextFx;
        trackVocalFxRef.current = next;
        return next;
      });

      /* Rebuild insert graph on TUNE/VOC power — including mid-play. */
      if (reconnect) {
        void syncSe2TrackVocalFxNow(trackIndex, nextFx);
      }
    },
    [clearAudioPreviewForTrack, syncSe2TrackVocalFxNow],
  );

  const onTrackInsertFxRackChange = useCallback(
    (trackIndex: number, nextRack: StudioTrackInsertFxRack) => {
      const cloned = cloneStudioTrackInsertFxRack(nextRack);
      setTrackInsertFxRacks((prev) => {
        const cur = prev[trackIndex] ?? defaultStudioTrackInsertFxRack();
        if (studioTrackInsertFxRacksEqual(cur, cloned)) return prev;
        const next = prev.slice();
        next[trackIndex] = cloned;
        return next;
      });
      /* Mirror immediately — render-time ref sync can lag one frame behind graph wiring. */
      const mirrored = trackInsertFxRacksRef.current.slice();
      mirrored[trackIndex] = cloned;
      trackInsertFxRacksRef.current = mirrored;
      /* Push suite into the Web Audio graph immediately — including while transport is
         locked — so preset / module changes are audible without Stop→Play. */
      const ctx = ctxRef.current;
      const bus = midiPreviewBusRef.current;
      if (ctx && bus && ctx.state !== 'closed') {
        se2TrackPlaybackInput(
          ctx,
          bus,
          trackIndex,
          trackFxSlotsRef.current[trackIndex] ?? emptyMixerFxSlots(),
          cloned,
          bpmRef.current,
          studioMasterOutRef.current ?? ctx.destination,
        );
        /* Pitch Tune / Vocoder stacks carry their own suite instance — refresh mid-edit. */
        const tr = studioTracksRef.current[trackIndex];
        if (tr && (tr.kind === 'audio' || tr.kind === 'a2m')) {
          const rawFx = trackVocalFxRef.current[trackIndex] ?? STUDIO_TRACK_VOCAL_FX_DEFAULT;
          if (studioTrackVocalFxActive(rawFx)) {
            void syncSe2TrackVocalFxNow(trackIndex, rawFx);
          }
        }
      }
      /* Do not clear audioPreviewScheduledRef here — refill would stack new BufferSources
         on still-playing clips (louder each EQ move; stuck loud until Stop). Insert strip
         live-rewires the graph; scheduled clips keep using the same preStrip bus. */
      /*
       * Soft rearm only — forcing paintEnd=0 caused a heavy rebuild hitch at the same
       * follow position. Do not change waveform drawing.
       */
      if (runningRef.current && timelineFollowPaintEndRef.current > 0) {
        const virt =
          timelineFollowTransformOriginRef.current + timelineFollowLastOffsetRef.current;
        timelineFollowPaintEndRef.current = Math.min(
          timelineFollowPaintEndRef.current,
          virt + TIMELINE_FOLLOW_PAINT_REARM_PX + 600,
        );
      }
    },
    [syncSe2TrackVocalFxNow],
  );

  const onTrackFxSlotChange = useCallback(
    (trackIndex: number, slot: 0 | 1 | 2, id: MixerEffectId) => {
      const prevRow = trackFxSlotsRef.current[trackIndex] ?? emptyMixerFxSlots();
      const prevId = prevRow[slot];
      const nextRow: [MixerEffectId, MixerEffectId, MixerEffectId] = [...prevRow];
      nextRow[slot] = id;
      let nextRack = trackInsertFxRacksRef.current[trackIndex] ?? defaultStudioTrackInsertFxRack();
      setTrackFxSlots((prev) => {
        const next = prev.slice();
        next[trackIndex] = nextRow;
        return next;
      });
      if (id !== '' && id !== 'autotune' && id !== 'vocoder') {
        nextRack = studioArmInsertFxRackForSlot(nextRack, id);
        setTrackInsertFxRacks((prev) => {
          const next = prev.slice();
          next[trackIndex] = nextRack;
          return next;
        });
      }
      if (
        id === 'autotune' ||
        id === 'vocoder' ||
        prevId === 'autotune' ||
        prevId === 'vocoder'
      ) {
        invalidateStudioTrackVocalFxInsert(trackIndex);
        clearAudioPreviewForTrack(trackIndex);
      }
      clearStudioVocalFxPlaybackCache();
      const ctx = ctxRef.current;
      const bus = midiPreviewBusRef.current;
      if (ctx && bus && ctx.state !== 'closed') {
        se2TrackPlaybackInput(
          ctx,
          bus,
          trackIndex,
          nextRow,
          nextRack,
          bpmRef.current,
          studioMasterOutRef.current ?? ctx.destination,
        );
      }
      if (
        id === 'autotune' ||
        id === 'vocoder' ||
        prevId === 'autotune' ||
        prevId === 'vocoder'
      ) {
        void syncSe2TrackVocalFxNow(trackIndex);
      }
    },
    [clearAudioPreviewForTrack, clearStudioVocalFxPlaybackCache, syncSe2TrackVocalFxNow],
  );

  const onMasterFxSlotChange = useCallback((slot: 0 | 1 | 2, id: MixerEffectId) => {
    setMasterFxSlots((prev) => {
      const row: [MixerEffectId, MixerEffectId, MixerEffectId] = [...prev];
      row[slot] = id;
      return row;
    });
  }, []);

  const loopStartBeatRef = useRef(loopStartBeat);
  const loopEndBeatRef   = useRef(loopEndBeat);
  /** User chose loop length via dropdown / ruler — do not auto-expand on Play or harmony sync. */
  const loopRegionUserLockedRef = useRef(false);

  isScreenActiveRef.current = isScreenActive;

  useEffect(() => {
    if (!isScreenActive) {
      setStudioMixerStripGraphPlaybackLocked(false);
    }
  }, [isScreenActive]);

  useEffect(() => {
    setSe2EditorScreenActive(isScreenActive);
    return () => setSe2EditorScreenActive(false);
  }, [isScreenActive]);

  useEffect(() => {
    setSe2EditorTransportRunning(running);
    return () => setSe2EditorTransportRunning(false);
  }, [running]);

  useEffect(() => {
    setStudioMixerStripCountHint(Math.max(1, studioTracks.length));
  }, [studioTracks.length]);

  useEffect(() => {
    if (!showMixer || !isScreenActive) return;
    let cancelled = false;
    const load = () => {
      void enumerateAudioDevices().then(({ inputs }) => {
        if (!cancelled) setMicInputDeviceOptions(inputs);
      });
    };
    load();
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', load);
      return () => {
        cancelled = true;
        navigator.mediaDevices.removeEventListener('devicechange', load);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [showMixer, isScreenActive]);

  useEffect(() => {
    if (!showMixer) setMixerAudioInputPopover(null);
  }, [showMixer]);

  /** Keep mixer lanes hugging the master — newest strip adjacent, older lanes scroll left. */
  useEffect(() => {
    if (!showMixer) return;
    const el = mixerTrackScrollRef.current;
    if (!el) return;
    const scrollToEnd = () => {
      el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    };
    scrollToEnd();
    const raf = requestAnimationFrame(scrollToEnd);
    return () => cancelAnimationFrame(raf);
  }, [showMixer, studioTracks.length]);

  useEffect(() => {
    if (mixerAudioInputPopover == null) return;
    const onPointerDown = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-mixer-audio-input-popover]')) return;
      if (t.closest('[data-mixer-audio-input-trigger]')) return;
      setMixerAudioInputPopover(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMixerAudioInputPopover(null);
    };
    const onScroll = () => setMixerAudioInputPopover(null);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [mixerAudioInputPopover]);

  /** First record-armed audio trackâ€™s input drives `getUserMedia` (Studio Oneâ€“style input routing). */
  useEffect(() => {
    const w = window as unknown as { __daMusicStudio2RecordInputDeviceId?: string };
    if (!isScreenActive) {
      delete w.__daMusicStudio2RecordInputDeviceId;
      return;
    }
    let chosen = settings.audioInput || 'default';
    for (let ti = 0; ti < studioTracks.length; ti++) {
      const t = studioTracks[ti];
      if (t?.kind === 'audio' && (trackRecordArmed[ti] ?? false)) {
        chosen = effectiveAudioInputDeviceId(t, settings.audioInput);
        break;
      }
    }
    w.__daMusicStudio2RecordInputDeviceId = chosen;
    return () => {
      delete w.__daMusicStudio2RecordInputDeviceId;
    };
  }, [isScreenActive, studioTracks, trackRecordArmed, settings.audioInput]);

  useEffect(() => {
    /* Keep mic tracks alive across ensure/rebuild even before React commits recording=true. */
    setStudioInputMonitorKeepAlive(
      () =>
        recordingRef.current
        || se2AudioRecordingActive()
        || liveRecordSessionRef.current != null,
    );
    return () => setStudioInputMonitorKeepAlive(null);
  }, []);

  /**
   * While recording: hard-mute software input monitor (mic must not reach speakers).
   * Dry MediaRecorder still captures the mic stream; live take UI is a DOM overlay.
   */
  useEffect(() => {
    setStudioInputMonitorSoftMuted(recording);
    if (!recording) {
      setStudioInputMonitorGain(STUDIO_INPUT_MONITOR_GAIN);
      // Re-resolve mic → strip/FX after unmute (monitor key alone may not change).
      setPitchMonitorRouteTick((n) => n + 1);
    }
    return () => {
      setStudioInputMonitorSoftMuted(false);
      setStudioInputMonitorGain(STUDIO_INPUT_MONITOR_GAIN);
    };
  }, [recording]);

  /** Record preflight â€” require a record-armed audio track (Studio One / Pro Tools model). */
  useEffect(() => {
    const w = window as unknown as { __daMusicStudioRecordPreFlight?: () => boolean };
    if (!isScreenActive) {
      delete w.__daMusicStudioRecordPreFlight;
      return;
    }
    w.__daMusicStudioRecordPreFlight = () =>
      trackRecordArmedRef.current.some(
        (armed, ti) => armed && studioTracksRef.current[ti]?.kind === 'audio',
      );
    return () => {
      delete w.__daMusicStudioRecordPreFlight;
    };
  }, [isScreenActive]);

  bpmRef.current = bpm;
  trackFxSlotsRef.current = trackFxSlots;
  trackVocalFxRef.current = trackVocalFx;
  se2GlideBassVoicesRef.current = se2GlideBassVoices;
  se2SynthGenoVoicesRef.current = se2SynthGenoVoices;
  se2GrooveLeadVoicesRef.current = se2GrooveLeadVoices;
  se2Lab808VoicesRef.current = se2Lab808Voices;
  se2GenoUltraSynthVoicesRef.current = se2GenoUltraSynthVoices;
  se2GenoBassSynthVoicesRef.current = se2GenoBassSynthVoices;
  trackInsertFxRacksRef.current = trackInsertFxRacks;
  songKeyRootRef.current = songKeyRoot;
  songKeyModeRef.current = songKeyMode;
  metroOnRef.current = metroOn;
  precountEnabledRef.current = precountEnabled;
  precountBarsRef.current = precountBars;
  isPrecountingRef.current = isPrecounting;
  recordingRef.current = recording;
  recordStandbyRef.current = recordStandby;
  timelineZoomRef.current = zoom;
  loopOnRef.current = loopOn;
  loopBarsRef.current = loopBars;
  loopStartBeatRef.current = loopStartBeat;
  loopEndBeatRef.current   = loopEndBeat;
  showMixerRef.current = showMixer;

  const trackListScrollRef = useRef<HTMLDivElement | null>(null);
  /** RAF edge-follow scroll — skip onScroll grid repaint churn. */
  const timelineProgrammaticScrollRef = useRef(false);
  const timelineFollowIntScrollRef = useRef(-1);
  /** Virtual scroll (lineCenter − pin) captured at Play — transform offset is relative to this. */
  const timelineFollowTransformOriginRef = useRef(0);
  /** Last transform offset (px) — used to commit scrollLeft on Stop/Pause. */
  const timelineFollowLastOffsetRef = useRef(0);
  /** After user click-seek: suppress idle paintTransport from fighting playhead position. */
  const timelineUserSeekGuardUntilRef = useRef(0);
  /** Playhead viewport pin written once per follow session (not every rAF). */
  const timelineFollowPinAppliedRef = useRef(false);
  /** Scroll (css px) at which the overscanned grid slice was last painted during follow. */
  const timelineFollowPaintScrollRef = useRef(Number.NEGATIVE_INFINITY);
  /** Absolute content X where the follow paint window starts (`viewStart`). */
  const timelineFollowPaintStartRef = useRef(0);
  /** Absolute content X where the follow paint window ends (viewStart + paintW). */
  const timelineFollowPaintEndRef = useRef(0);
  /**
   * Sticky edge-follow while playing. Without this, follow flips on/off every frame at the
   * right margin (playhead drifts → snap → idle → drift), which reads as jumping.
   * Cleared on stop/pause or when the user scrolls the timeline by hand.
   */
  const timelineEdgeFollowActiveRef = useRef(false);
  /**
   * Stop parked the follow strip as a CSS translate (scrollLeft unchanged).
   * Cleared on Play resume or when the user scrolls/seeks (then we commit to scroll).
   */
  const timelineFollowParkedTransformRef = useRef(false);
  /** Screen X (css px) where the playhead stays pinned once sticky follow engages. */
  const timelineFollowPinScreenXRef = useRef(0);
  /** Deferred grid repaint rAF id — keep heavy paint off the scroll/write frame. */
  const timelineFollowPaintRafRef = useRef(0);

  const cancelTimelineFollowWapi = useCallback(() => {
    timelineFollowWapiLaneRef.current?.cancel();
    timelineFollowWapiLaneRef.current = null;
    timelineFollowWapiRulerRef.current?.cancel();
    timelineFollowWapiRulerRef.current = null;
    timelineStripRef.current?.getAnimations().forEach((a) => a.cancel());
    timelineRulerStripRef.current?.getAnimations().forEach((a) => a.cancel());
  }, []);

  const readTimelineFollowWapiOffset = useCallback((): number | null => {
    const anim = timelineFollowWapiLaneRef.current;
    if (!anim || anim.playState === 'idle') return null;
    const meta = timelineFollowWapiMetaRef.current;
    const d = Math.max(1e-9, meta.durMs);
    const t = Number(anim.currentTime ?? 0);
    const phase = meta.infinite ? ((t % d) + d) % d : Math.max(0, Math.min(t, d));
    const u = phase / d;
    const span = Math.max(1e-9, meta.beatEnd - meta.beatStart);
    const beat = meta.beatStart + span * u;
    /* Same curve as JS follow / follow keyframes — not linear off0→off1. */
    const ts = Math.min(meta.maxScroll, Math.max(0, beat * meta.ppb - meta.pin));
    return ts - meta.origin;
  }, []);

  const clearTimelineEdgeFollow = useCallback(() => {
    const wasFollowing = timelineEdgeFollowActiveRef.current;
    const wasParked = timelineFollowParkedTransformRef.current;
    const scrollEl = timelineHScrollRef.current;
    const wapiOff = readTimelineFollowWapiOffset();
    if (wapiOff != null) timelineFollowLastOffsetRef.current = wapiOff;
    const laneEl = timelineStripRef.current;
    const rulerStripEl = timelineRulerStripRef.current;
    let offset = timelineFollowLastOffsetRef.current;
    if (wasParked && Math.abs(offset) < 0.5) {
      offset = se2ReadStripFollowOffsetPx(laneEl) || se2ReadStripFollowOffsetPx(rulerStripEl);
      if (Math.abs(offset) >= 0.5) timelineFollowLastOffsetRef.current = offset;
    }
    /*
     * Bake follow translate into CSS BEFORE cancel — cancel drops WAAPI and would
     * flash the grid under the playhead for a frame.
     */
    if ((wasFollowing || wasParked) && Math.abs(offset) >= 0.5) {
      const bake = `translate3d(${-offset}px, 0, 0)`;
      if (laneEl) laneEl.style.transform = bake;
      if (rulerStripEl) rulerStripEl.style.transform = bake;
    }
    cancelTimelineFollowWapi();
    if ((wasFollowing || wasParked) && scrollEl) {
      const committed = Math.max(
        0,
        Math.round(timelineFollowTransformOriginRef.current + timelineFollowLastOffsetRef.current),
      );
      scrollEl.scrollLeft = committed;
      const ruler = timelineRulerHScrollRef.current;
      const bar = timelineHBarRef.current;
      if (ruler && ruler.scrollLeft !== committed) ruler.scrollLeft = committed;
      if (bar && bar.scrollLeft !== committed) bar.scrollLeft = committed;
    }
    timelineEdgeFollowActiveRef.current = false;
    timelineFollowParkedTransformRef.current = false;
    timelineFollowIntScrollRef.current = -1;
    timelineFollowTransformOriginRef.current = 0;
    timelineFollowLastOffsetRef.current = 0;
    timelineFollowPinAppliedRef.current = false;
    timelineFollowPaintScrollRef.current = Number.NEGATIVE_INFINITY;
    timelineFollowPaintStartRef.current = 0;
    timelineFollowPaintEndRef.current = 0;
    if (timelineFollowPaintRafRef.current) {
      window.clearTimeout(timelineFollowPaintRafRef.current);
      cancelAnimationFrame(timelineFollowPaintRafRef.current);
      timelineFollowPaintRafRef.current = 0;
    }
    timelineProgrammaticScrollRef.current = false;
    /* Clear bake only after scrollLeft matches. */
    clearTimelineFollowStripTransform(
      timelineStripRef.current,
      timelineRulerStripRef.current,
      timelineFollowContentRef.current,
    );
    /* Content-space playhead uses `left = beat * ppb` — never clear it here (that jumps Stop to bar 1). */
    const ph = playheadGroupRef.current;
    if (ph) {
      ph.style.visibility = '';
      ph.style.pointerEvents = 'none';
    }
    const loopPh = loopPlayheadGroupRef.current;
    if (loopPh) loopPh.style.visibility = 'hidden';
  }, [cancelTimelineFollowWapi, readTimelineFollowWapiOffset]);

  /**
   * Stop: freeze the follow strip in place (CSS bake only). Never rewrite scrollLeft —
   * converting transform→scroll is what made the whole grid jerk on Stop.
   */
  const freezeTimelineFollowForStop = useCallback(() => {
    const wapiOff = readTimelineFollowWapiOffset();
    if (wapiOff != null) timelineFollowLastOffsetRef.current = wapiOff;
    const offset = timelineFollowLastOffsetRef.current;
    const laneEl = timelineStripRef.current;
    const rulerStripEl = timelineRulerStripRef.current;
    if (Math.abs(offset) >= 0.5) {
      const bake = `translate3d(${-offset}px, 0, 0)`;
      if (laneEl) laneEl.style.transform = bake;
      if (rulerStripEl) rulerStripEl.style.transform = bake;
      timelineFollowParkedTransformRef.current = true;
    } else {
      timelineFollowParkedTransformRef.current = false;
      clearTimelineFollowStripTransform(
        laneEl,
        rulerStripEl,
        timelineFollowContentRef.current,
      );
    }
    try {
      timelineFollowWapiLaneRef.current?.pause();
      timelineFollowWapiRulerRef.current?.pause();
    } catch {
      /* */
    }
    cancelTimelineFollowWapi();
    timelineEdgeFollowActiveRef.current = false;
    timelineFollowPinAppliedRef.current = false;
    timelineFollowPaintScrollRef.current = Number.NEGATIVE_INFINITY;
    timelineFollowPaintStartRef.current = 0;
    timelineFollowPaintEndRef.current = 0;
    if (timelineFollowPaintRafRef.current) {
      window.clearTimeout(timelineFollowPaintRafRef.current);
      cancelAnimationFrame(timelineFollowPaintRafRef.current);
      timelineFollowPaintRafRef.current = 0;
    }
    /* Keep origin + lastOffset — Play resumes the same follow frame without a scroll jump. */
    const ph = playheadGroupRef.current;
    if (ph) {
      ph.style.visibility = '';
      ph.style.pointerEvents = 'none';
    }
    const loopPh = loopPlayheadGroupRef.current;
    if (loopPh) loopPh.style.visibility = 'hidden';
  }, [cancelTimelineFollowWapi, readTimelineFollowWapiOffset]);

  const scrollTrackListToEnd = useCallback(() => {
    queueMicrotask(() => {
      const el = trackListScrollRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    studioVocalFxCacheRef.current.clear();
    studioVocalFxPendingRef.current.clear();
    audioPreviewScheduledRef.current.clear();
  }, [songKeyRoot, songKeyMode]);

  const trackVolumesRef = useRef(trackVolumes);
  trackVolumesRef.current = trackVolumes;
  const trackPansRef = useRef(trackPans);
  trackPansRef.current = trackPans;
  const trackMutesRef = useRef(trackMutes);
  trackMutesRef.current = trackMutes;
  const trackSolosRef = useRef(trackSolos);
  trackSolosRef.current = trackSolos;
  const trackMonosRef = useRef(trackMonos);
  trackMonosRef.current = trackMonos;
  const trackRecordArmedRef = useRef(trackRecordArmed);
  trackRecordArmedRef.current = trackRecordArmed;
  const selectedTrackIndexRef = useRef(selectedTrackIndex);
  selectedTrackIndexRef.current = selectedTrackIndex;
  const selectedPianoIdxRef = useRef(selectedPianoNoteIndex);
  selectedPianoIdxRef.current = selectedPianoNoteIndex;
  const selectedPianoIdxSetRef = useRef<Set<number>>(new Set());
  selectedPianoIdxSetRef.current = selectedPianoNoteIndexes;
  const selectedTimelineAudioClipRef = useRef(selectedTimelineAudioClip);
  selectedTimelineAudioClipRef.current = selectedTimelineAudioClip;
  const audioClipSplitMarkerBeatRef = useRef(audioClipSplitMarkerBeat);
  audioClipSplitMarkerBeatRef.current = audioClipSplitMarkerBeat;
  const pianoSnapEffRef = useRef(pianoSnapSubdivisions);
  pianoSnapEffRef.current = normalizePianoSnapSubdiv(pianoSnapSubdivisions);
  const pianoToolRef = useRef<PianoRollTool>('select');
  pianoToolRef.current = pianoTool;
  const timelineToolRef = useRef<TimelineArrangeTool>('select');
  timelineToolRef.current = timelineTool;

  /** Open piano roll â€” Select tool default (box-select, move, duplicate); switch to Pencil to draw. */
  const openPianoRollEditor = useCallback((options?: { expanded?: boolean }) => {
    setShowPianoRoll(true);
    setShowMixer(false);
    setPianoTool('select');
    if (options?.expanded) setPianoRollExpanded(true);
  }, []);

  const syncTimelineGridNow = useCallback((
    zoomOverride?: number,
    scrollOverride?: number,
    viewportMargins?: { marginBackPx?: number; marginFwdPx?: number },
  ) => {
    const scrollEl = timelineHScrollRef.current;
    let scrollLeft = scrollOverride ?? scrollEl?.scrollLeft ?? 0;
    let margins = viewportMargins;
    /*
     * During transform-follow play (or Stop-parked bake), scrollLeft is frozen at the
     * follow origin while the strip is CSS-translated. Painting at that frozen left
     * without follow margins (FX suite re-render, record-arm track select, rack rebuild)
     * places the canvas window behind the playhead → blank #0a0a10 strip.
     */
    const followPaintActive =
      (runningRef.current && timelineEdgeFollowActiveRef.current)
      || timelineFollowParkedTransformRef.current;
    if (followPaintActive && !margins) {
      /* Ignore scrollOverride — callers often pass frozen scrollLeft under translate follow. */
      scrollLeft = Math.max(
        0,
        Math.round(
          timelineFollowTransformOriginRef.current + timelineFollowLastOffsetRef.current,
        ),
      );
      margins = {
        marginBackPx: TIMELINE_FOLLOW_PAINT_BACK_PX,
        marginFwdPx: TIMELINE_FOLLOW_PAINT_FWD_PX,
      };
    }
    const viewportWidth = scrollEl?.clientWidth ?? 1200;
    const zoom = zoomOverride ?? timelineZoomRef.current;
    syncTimelineGridLayer(
      timelineCanvasRef.current,
      timelineRulerCanvasRef.current,
      gridCacheRef,
      zoom,
      studioTracksRef.current,
      beatsPerBarRef.current,
      trackLaneHRef.current,
      selectedTrackIndexRef.current,
      selectedPianoIdxRef.current,
      studioAudioBuffersRef.current,
      selectedTimelineAudioClipRef.current,
      audioClipSplitMarkerBeatRef.current,
      bpmRef.current,
      selectedPianoIdxSetRef.current,
      scrollLeft,
      viewportWidth,
      liveRecordingPeaksRef.current,
      margins,
      timelineAudioClipDragRef.current.active && timelineAudioClipDragRef.current.mode === 'gain',
    );
    if (margins) {
      const fullW = TOTAL_WIDTH_PX * zoom;
      const vp = se2ComputeGridViewport(fullW, scrollLeft, viewportWidth, margins);
      const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
      const maxCss = SE2_MAX_GRID_BITMAP_PX / dpr;
      const paintW = Math.min(vp.paintWidth, maxCss);
      timelineFollowPaintScrollRef.current = scrollLeft;
      timelineFollowPaintStartRef.current = vp.viewStart;
      timelineFollowPaintEndRef.current = vp.viewStart + paintW;
    }
  }, []);

  const syncTimelineGridFollowAhead = useCallback((zoom: number, scrollLeft: number) => {
    syncTimelineGridNow(zoom, scrollLeft, {
      marginBackPx: TIMELINE_FOLLOW_PAINT_BACK_PX,
      marginFwdPx: TIMELINE_FOLLOW_PAINT_FWD_PX,
    });
  }, [syncTimelineGridNow]);

  const cancelLiveRecordClipWapi = useCallback(() => {
    liveRecordClipWapiRef.current?.cancel();
    liveRecordClipWapiRef.current = null;
    const el = liveRecordClipElRef.current;
    if (!el) return;
    el.getAnimations().forEach((a) => a.cancel());
    el.style.transform = 'scaleX(0)';
    el.style.display = 'none';
  }, []);

  /**
   * Grow the live-record overlay on the compositor (scaleX), locked to the same
   * beat→time mapping as the playhead WAAPI. Do not write width from rAF — that jitters.
   */
  const launchLiveRecordClipWapi = useCallback((beatNow: number, play: boolean) => {
    const el = liveRecordClipElRef.current;
    const sess = liveRecordSessionRef.current;
    if (!el || !sess || !play) {
      liveRecordClipWapiRef.current?.cancel();
      liveRecordClipWapiRef.current = null;
      if (el && !sess) {
        el.style.display = 'none';
        el.style.transform = 'scaleX(0)';
      }
      return;
    }

    const bpm = bpmRef.current;
    const z = timelineZoomRef.current;
    const bpb = beatsPerBarRef.current;
    const ppb = ppbAtZoom(z, bpb);
    const tb = totalBeatsRef.current;
    const lsLoop = loopStartBeatRef.current;
    const leLoop = Math.min(loopEndBeatRef.current, tb);
    const inLoopRegion =
      beatNow >= lsLoop - 1e-9 && beatNow <= leLoop + 1e-9;
    const useSegment =
      play &&
      loopOnRef.current &&
      leLoop > lsLoop &&
      lsLoop >= 0 &&
      inLoopRegion;

    const beatStart = useSegment ? lsLoop : 0;
    const beatEnd = useSegment ? leLoop : tb;
    if (!(beatEnd > beatStart) || sess.startBeat >= beatEnd) {
      el.style.display = 'none';
      return;
    }

    const durMs = ((beatEnd - beatStart) / (bpm / 60)) * 1000;
    const bn = Math.min(Math.max(beatNow, beatStart), beatEnd);
    const seekMs = Math.max(0, Math.min(((bn - beatStart) / (bpm / 60)) * 1000, durMs));
    const S = sess.startBeat;
    const wMax = Math.max(3, (beatEnd - S) * ppb);
    const laneH = Math.max(
      MIN_TRACK_LANE_H_PX,
      Math.min(MAX_TRACK_LANE_H_PX, Math.round(trackLaneHRef.current)),
    );

    el.style.display = 'block';
    el.style.left = `${S * ppb}px`;
    el.style.top = `${sess.trackIndex * laneH + 1}px`;
    el.style.height = `${Math.max(4, laneH - 2)}px`;
    el.style.width = `${wMax}px`;
    el.style.transformOrigin = 'left center';
    el.style.background = `${sess.colorHex}66`;
    el.style.boxShadow = `inset 0 0 0 1px ${sess.colorHex}aa`;
    el.style.willChange = 'transform';

    const span = Math.max(1e-9, beatEnd - beatStart);
    const sAt = (beat: number) => {
      const w = Math.max(0, beat - S) * ppb;
      return Math.max(0, Math.min(1, w / wMax));
    };
    const s0 = sAt(beatStart);
    const s1 = sAt(beatEnd);
    const sSeek = sAt(bn);

    /*
     * If take starts mid-segment, hold scaleX(0) until S so the trailing edge never
     * leads the playhead, then grow linearly to the segment end (same clock as playhead).
     */
    const frames: Keyframe[] =
      S > beatStart + 1e-9
        ? [
            { offset: 0, transform: 'scaleX(0)' },
            {
              offset: Math.max(0, Math.min(1, (S - beatStart) / span)),
              transform: 'scaleX(0)',
            },
            { offset: 1, transform: `scaleX(${s1})` },
          ]
        : [
            { offset: 0, transform: `scaleX(${s0})` },
            { offset: 1, transform: `scaleX(${s1})` },
          ];

    el.style.transform = `scaleX(${sSeek})`;
    el.getAnimations().forEach((a) => a.cancel());
    const a = el.animate(frames, {
      duration: Math.max(1e-9, durMs),
      easing: 'linear',
      fill: 'forwards',
      iterations: useSegment ? Infinity : 1,
    });
    a.pause();
    a.currentTime = seekMs;
    a.play();
    liveRecordClipWapiRef.current = a;
  }, []);

  const applyPlayheadFull = useCallback((beat: number, opts?: { skipAutoScroll?: boolean }) => {
    /*
     * Stop parks follow as a CSS translate with scrollLeft frozen at the origin.
     * Must commit that bake before any grid paint — otherwise sync paints the
     * frozen window while the strip is still translated (blank grid / waves).
     * Record arm → select audio track hits this path via the layout effect.
     */
    if (timelineEdgeFollowActiveRef.current || timelineFollowParkedTransformRef.current) {
      clearTimelineEdgeFollow();
    }
    timelineFollowPinAppliedRef.current = false;
    timelineFollowTransformOriginRef.current = 0;

    const z = timelineZoomRef.current;
    const bpb = beatsPerBarRef.current;
    const scrollEl = timelineHScrollRef.current;
    const rulerEl = timelineRulerHScrollRef.current;
    if (!opts?.skipAutoScroll) {
      scrollTimelineToPlayhead(scrollEl, beat, z, bpb, [rulerEl]);
      const barEl = timelineHBarRef.current;
      if (barEl && scrollEl && barEl.scrollLeft !== scrollEl.scrollLeft) {
        barEl.scrollLeft = scrollEl.scrollLeft;
      }
    } else if (scrollEl) {
      const sl = scrollEl.scrollLeft;
      if (rulerEl && rulerEl.scrollLeft !== sl) rulerEl.scrollLeft = sl;
      const barEl = timelineHBarRef.current;
      if (barEl && barEl.scrollLeft !== sl) barEl.scrollLeft = sl;
    }

    const scrollLeft = scrollEl?.scrollLeft ?? 0;
    syncTimelineGridNow(z, scrollLeft);

    const seekMs = Math.max(0, (beat / (wapiBpmRef.current / 60)) * 1000);
    const waSeek = (a: Animation | null) => {
      if (!a) return;
      const wasRunning = a.playState === 'running';
      a.pause();
      a.currentTime = seekMs;
      if (wasRunning) a.play();
    };
    waSeek(playheadWapiRef.current);
    waSeek(pianoPhWapiRef.current);

    positionTimelinePlayheadGroup(
      playheadGroupRef.current,
      playheadLineRef.current,
      beat,
      z,
      bpb,
      scrollLeft,
    );
    const ph = playheadGroupRef.current;
    if (ph && !runningRef.current) {
      ph.style.pointerEvents = 'none';
    }
    positionPianoPlayhead(pianoPlayheadRef.current, beat, z, bpb);
  }, [clearTimelineEdgeFollow, syncTimelineGridNow]);

  /**
   * Create (or recreate) compositor-thread WAAPI animations for both playheads.
   *
   * Each animation translates the element from beat-0 pixel to beat-N pixel at a linear
   * rate proportional to BPM. The RAF loop never writes style.transform for the playhead;
   * WAAPI drives it independently of JavaScript execution.
   *
   * @param beatNow  beat to seek the animation to (0 = start of song)
   * @param play     true = play immediately, false = create paused (for stopped state)
   */
  const launchWapiAnims = useCallback((beatNow: number, play: boolean) => {
    const bpm  = bpmRef.current;
    const z    = timelineZoomRef.current;
    const bpb  = beatsPerBarRef.current;
    const ppb  = ppbAtZoom(z, bpb);
    const tb   = totalBeatsRef.current;
    const gw   = PLAYHEAD_GRIP_W_PX;
    const pw   = PLAYHEAD_W_PX;
    const totalPx  = tb * ppb;

    wapiBpmRef.current = bpm;
    wapiPpbRef.current = ppb;

    const lsLoop = loopStartBeatRef.current;
    const leLoop = Math.min(loopEndBeatRef.current, tb);
    const inLoopRegion =
      beatNow >= lsLoop - 1e-9 && beatNow <= leLoop + 1e-9;
    const useSegment =
      play &&
      loopOnRef.current &&
      leLoop > lsLoop &&
      lsLoop >= 0 &&
      inLoopRegion;

    let durMs: number;
    let x0Grip: number;
    let x1Grip: number;
    let x0Piano: number;
    let x1Piano: number;
    let seekMs: number;

    if (useSegment) {
      const spanBeats = leLoop - lsLoop;
      durMs = (spanBeats / (bpm / 60)) * 1000;
      x0Grip = lsLoop * ppb - gw / 2;
      x1Grip = leLoop * ppb - gw / 2;
      x0Piano = lsLoop * ppb - pw / 2;
      x1Piano = leLoop * ppb - pw / 2;
      const bn = Math.min(Math.max(beatNow, lsLoop), leLoop);
      seekMs = (bn - lsLoop) / (bpm / 60) * 1000;
      wapiSegLoopRef.current = {
        active: true,
        loopStartBeat: lsLoop,
        loopEndBeat: leLoop,
        durMs,
        seamlessLoop: true,
      };
    } else {
      durMs = (tb / (bpm / 60)) * 1000;
      x0Grip = -gw / 2;
      x1Grip = totalPx - gw / 2;
      x0Piano = -pw / 2;
      x1Piano = totalPx - pw / 2;
      seekMs = Math.max(0, beatNow / (bpm / 60) * 1000);
      wapiSegLoopRef.current = { active: false, loopStartBeat: lsLoop, loopEndBeat: leLoop, durMs, seamlessLoop: false };
    }

    seekMs = Math.max(0, Math.min(seekMs, durMs));
    const dSafe = Math.max(1e-9, durMs);
    if (useSegment) {
      wapiLoopCycleSeenRef.current = Math.floor(seekMs / dSafe);
      lastMetroLoopLapRef.current = 0;
      lastCompositorLoopLapRef.current = -1;
      wapiPrevPhaseMsRef.current = -1;
    } else {
      wapiLoopCycleSeenRef.current = 0;
      lastMetroLoopLapRef.current = 0;
      lastCompositorLoopLapRef.current = -1;
      wapiPrevPhaseMsRef.current = -1;
    }

    const makeAnim = (
      el: HTMLElement | null,
      x0: number,
      x1: number,
      durationMs: number,
      seekIntoMs: number,
      iterations: number,
    ): Animation | null => {
      if (!el) return null;
      /*
       * Bake the seek target into CSS BEFORE cancel(). Cancel drops WAAPI and briefly
       * falls back to the underlying style — without this the playhead flashes to x=0
       * (looks like Stop jumps backward).
       */
      const d = Math.max(1e-9, durationMs);
      const t = Math.min(Math.max(seekIntoMs, 0), durationMs);
      const seekX = x0 + ((x1 - x0) * t) / d;
      el.style.transform = `translate3d(${seekX}px, 0, 0)`;
      el.getAnimations().forEach(a => a.cancel());
      const a = el.animate(
        [
          { transform: `translate3d(${x0}px, 0, 0)` },
          { transform: `translate3d(${x1}px, 0, 0)` },
        ],
        { duration: durationMs, easing: 'linear', fill: 'forwards', iterations },
      );
      /*
       * ALWAYS pause → seek → play (never play → seek).
       * If we set currentTime while the animation is already running there is one
       * compositor frame where the element sits at the "from" keyframe before the seek
       * takes effect — that is the visible flash/jump at bar 1.
       * Pausing first ensures the compositor only ever renders the correct start position.
       */
      a.pause();
      a.currentTime = t;
      if (play) a.play();
      return a;
    };

    const wapiIters = useSegment ? Infinity : 1;
    playheadWapiRef.current = makeAnim(playheadWapiTimingRef.current, x0Grip, x1Grip, durMs, seekMs, wapiIters);
    pianoPhWapiRef.current  = makeAnim(pianoPlayheadRef.current, x0Piano, x1Piano, durMs, seekMs, wapiIters);

    /*
     * Visible playhead on the compositor (same x0/x1 as the hidden timing clock).
     * Per-frame style.left from the rAF beat was fighting strip follow WAAPI → shake/jump.
     * With left=0 and transform = beatPx − grip/2, the line glides to the pin then sits
     * while the grid translate carries the content underneath.
     */
    playheadVisibleWapiRef.current?.cancel();
    playheadVisibleWapiRef.current = null;
    loopPlayheadVisibleWapiRef.current?.cancel();
    loopPlayheadVisibleWapiRef.current = null;
    const mainPhEl = playheadGroupRef.current;
    const loopPhEl = loopPlayheadGroupRef.current;
    const seekXGrip = x0Grip + ((x1Grip - x0Grip) * seekMs) / Math.max(1e-9, durMs);
    if (play) {
      /*
       * Atomic parked→WAAPI handoff: bake transform at the resume beat BEFORE left=0.
       * Setting left=0 first (while transform is still −grip/2) flashes the line to bar 1.
       */
      if (mainPhEl) {
        mainPhEl.style.transform = `translate3d(${seekXGrip}px, 0, 0)`;
        mainPhEl.style.left = '0px';
        if (playheadLineRef.current) playheadLineRef.current.style.transform = 'translateX(0px)';
      }
      if (loopPhEl) {
        loopPhEl.style.transform = `translate3d(${seekXGrip}px, 0, 0)`;
        loopPhEl.style.left = '0px';
        if (loopPlayheadLineRef.current) loopPlayheadLineRef.current.style.transform = 'translateX(0px)';
      }
      playheadVisibleWapiRef.current = makeAnim(mainPhEl, x0Grip, x1Grip, durMs, seekMs, wapiIters);
      if (useSegment) {
        loopPlayheadVisibleWapiRef.current = makeAnim(loopPhEl, x0Grip, x1Grip, durMs, seekMs, wapiIters);
      }
    } else if (mainPhEl) {
      /* Stopped/paused — park with content-space left. Never left=0 first (Stop jerk). */
      mainPhEl.getAnimations().forEach((a) => a.cancel());
      positionTimelinePlayheadGroup(mainPhEl, playheadLineRef.current, beatNow, z, bpb);
      if (loopPhEl) {
        loopPhEl.getAnimations().forEach((a) => a.cancel());
      }
    }

    /*
     * Grid follow on the compositor. Must follow the SAME offset curve as JS follow
     * (targetScroll(beat) − origin), not a straight 0→end line — a linear strip anim
     * cancelled the playhead's content `left` and stuck it at the viewport start.
     */
    timelineFollowWapiLaneRef.current?.cancel();
    timelineFollowWapiLaneRef.current = null;
    timelineFollowWapiRulerRef.current?.cancel();
    timelineFollowWapiRulerRef.current = null;
    if (play) {
      const cw = timelineHScrollRef.current?.clientWidth ?? 0;
      const laneEl = timelineStripRef.current;
      const rulerEl = timelineRulerStripRef.current;
      if (cw > 0 && laneEl) {
        const pin = cw * TIMELINE_FOLLOW_PIN_RATIO;
        const maxScroll = Math.max(0, TOTAL_WIDTH_PX * z - cw);
        const origin = timelineFollowTransformOriginRef.current;
        const beatStart = useSegment ? lsLoop : 0;
        const beatEnd = useSegment ? leLoop : tb;
        const spanBeats = Math.max(1e-9, beatEnd - beatStart);
        const offsetAt = (beat: number) => {
          const ts = Math.min(maxScroll, Math.max(0, beat * ppb - pin));
          return ts - origin;
        };
        const steps = Math.min(160, Math.max(24, Math.ceil(spanBeats)));
        const frames: Keyframe[] = [];
        for (let i = 0; i <= steps; i++) {
          const u = i / steps;
          const beat = beatStart + spanBeats * u;
          const off = offsetAt(beat);
          frames.push({ transform: `translate3d(${-off}px, 0, 0)`, offset: u });
        }
        const off0 = offsetAt(beatStart);
        const off1 = offsetAt(beatEnd);
        timelineFollowWapiMetaRef.current = {
          off0,
          off1,
          durMs,
          infinite: useSegment,
          beatStart,
          beatEnd,
          origin,
          pin,
          maxScroll,
          ppb,
        };
        const makeFollowAnim = (el: HTMLElement | null): Animation | null => {
          if (!el) return null;
          const d = Math.max(1e-9, durMs);
          const t = Math.min(Math.max(seekMs, 0), durMs);
          const uSeek = t / d;
          const beatSeek = beatStart + spanBeats * uSeek;
          const seekOff = offsetAt(beatSeek);
          el.style.transform = `translate3d(${-seekOff}px, 0, 0)`;
          el.getAnimations().forEach((a) => a.cancel());
          const a = el.animate(frames, {
            duration: durMs,
            easing: 'linear',
            fill: 'forwards',
            iterations: wapiIters,
          });
          a.pause();
          a.currentTime = t;
          a.play();
          return a;
        };
        timelineFollowWapiLaneRef.current = makeFollowAnim(laneEl);
        timelineFollowWapiRulerRef.current = makeFollowAnim(rulerEl);
        timelineEdgeFollowActiveRef.current = true;
      }
    }

    /* Keep live take trailing edge on the same compositor clock as the playhead. */
    launchLiveRecordClipWapi(beatNow, play);
  }, [launchLiveRecordClipWapi]);

  /** Re-anchor transform follow at a beat — loop wrap uses this so the grid + loop playhead stay aligned. */
  const reanchorTimelineFollowAtBeat = useCallback(
    (beat: number, opts?: { relaunchWapi?: boolean }) => {
      const scrollElLoop = timelineHScrollRef.current;
      const cw = scrollElLoop?.clientWidth ?? 0;
      if (cw <= 0) return;
      const pin = cw * TIMELINE_FOLLOW_PIN_RATIO;
      const z = timelineZoomRef.current;
      const ppbLoop = ppbAtZoom(z, beatsPerBarRef.current);
      const maxSl = Math.max(0, TOTAL_WIDTH_PX * z - cw);
      const virt = Math.min(maxSl, Math.max(0, beat * ppbLoop - pin));
      cancelTimelineFollowWapi();
      /*
       * Follow freezes scrollLeft at the session origin and glides via translate.
       * On wrap we must re-commit scrollLeft to the new virtual scroll — otherwise
       * origin/paint jump to the loop while the viewport still shows earlier bars
       * against an empty canvas slice (grid/audio “vanishes” until a seek).
       */
      const committed = Math.max(0, Math.round(virt));
      timelineProgrammaticScrollRef.current = true;
      scrollElLoop.scrollLeft = committed;
      const rulerEl = timelineRulerHScrollRef.current;
      const barEl = timelineHBarRef.current;
      if (rulerEl && rulerEl.scrollLeft !== committed) rulerEl.scrollLeft = committed;
      if (barEl && barEl.scrollLeft !== committed) barEl.scrollLeft = committed;
      timelineFollowTransformOriginRef.current = virt;
      timelineFollowLastOffsetRef.current = 0;
      clearTimelineFollowStripTransform(
        timelineStripRef.current,
        timelineRulerStripRef.current,
        timelineFollowContentRef.current,
      );
      if (timelineFollowPaintRafRef.current) {
        window.clearTimeout(timelineFollowPaintRafRef.current);
        cancelAnimationFrame(timelineFollowPaintRafRef.current);
        timelineFollowPaintRafRef.current = 0;
      }
      timelineFollowPaintScrollRef.current = Number.NEGATIVE_INFINITY;
      timelineFollowPaintStartRef.current = 0;
      timelineFollowPaintEndRef.current = 0;
      syncTimelineGridFollowAhead(z, virt);
      if (opts?.relaunchWapi) {
        launchWapiAnims(beat, true);
      }
    },
    [cancelTimelineFollowWapi, launchWapiAnims, syncTimelineGridFollowAhead],
  );

  const cancelPlayheadCompositorAnims = useCallback(() => {
    playheadWapiRef.current?.cancel();
    playheadWapiRef.current = null;
    pianoPhWapiRef.current?.cancel();
    pianoPhWapiRef.current = null;
    playheadVisibleWapiRef.current?.cancel();
    playheadVisibleWapiRef.current = null;
    loopPlayheadVisibleWapiRef.current?.cancel();
    loopPlayheadVisibleWapiRef.current = null;
    playheadGroupRef.current?.getAnimations().forEach((a) => a.cancel());
    loopPlayheadGroupRef.current?.getAnimations().forEach((a) => a.cancel());
    playheadWapiTimingRef.current?.getAnimations().forEach((a) => a.cancel());
    pianoPlayheadRef.current?.getAnimations().forEach((a) => a.cancel());
    cancelTimelineFollowWapi();
    cancelLiveRecordClipWapi();
  }, [cancelLiveRecordClipWapi, cancelTimelineFollowWapi]);

  const applyPlayheadLineOnly = useCallback((beat: number) => {
    const z = timelineZoomRef.current;
    const bpb = beatsPerBarRef.current;
    positionTimelinePlayheadGroup(
      playheadGroupRef.current,
      playheadLineRef.current,
      beat,
      z,
      bpb,
      timelineHScrollRef.current?.scrollLeft ?? 0,
    );
    positionPianoPlayhead(pianoPlayheadRef.current, beat, z, bpb);
    scrollTimelineToPlayhead(timelineHScrollRef.current, beat, z, bpb, [timelineRulerHScrollRef.current]);
  }, []);

  const ensureCtx = useCallback(async () => {
    let ctx = ctxRef.current;
    if (!ctx) {
      ctx = new AudioContext({ latencyHint: 'playback' });
      ctxRef.current = ctx;
    }
    if (!studioMasterOutRef.current && ctx.state !== 'closed') {
      const masterOut = ctx.createGain();
      masterOut.gain.value = mixerVolToLinearGain(masterVolumeRef.current);
      masterOut.connect(ctx.destination);
      studioMasterOutRef.current = masterOut;
    }
    if (!metroBusRef.current && ctx.state !== 'closed') {
      const g = ctx.createGain();
      g.gain.value = 1;
      g.connect(studioMasterOutRef.current ?? ctx.destination);
      metroBusRef.current = g;
    }
    if (!midiPreviewBusRef.current && ctx.state !== 'closed') {
      const g = ctx.createGain();
      g.gain.value = 1;
      const masterOut = studioMasterOutRef.current ?? ctx.destination;
      g.connect(masterOut);
      noteStudioPreviewBusOutput(g, masterOut);
      midiPreviewBusRef.current = g;
    }
    /* Migrate older graphs once — repeated disconnect/reconnect during playback caused dropouts. */
    if (studioMasterOutRef.current && ctx.state !== 'closed' && !se2OutputGraphMigratedRef.current) {
      const masterOut = studioMasterOutRef.current;
      if (metroBusRef.current) {
        try {
          metroBusRef.current.disconnect();
        } catch {
          /* */
        }
        metroBusRef.current.gain.value = 1;
        metroBusRef.current.connect(masterOut);
      }
      if (midiPreviewBusRef.current) {
        try {
          midiPreviewBusRef.current.disconnect(masterOut);
        } catch {
          /* */
        }
        midiPreviewBusRef.current.gain.value = 1;
        midiPreviewBusRef.current.connect(masterOut);
        noteStudioPreviewBusOutput(midiPreviewBusRef.current, masterOut);
      }
      masterOut.gain.value = mixerVolToLinearGain(masterVolumeRef.current);
      se2OutputGraphMigratedRef.current = true;
    }
    if (!clickBufferRef.current && ctx.state !== 'closed') {
      clickBufferRef.current = createMusioClickBuffer(ctx, 1000, 0.02, 0.8);
      accentBufferRef.current = createMusioClickBuffer(ctx, 1500, 0.03, 1.0);
      precountRimshotBufferRef.current = createSe2PrecountRimshotBuffer(ctx);
      void ensureSe2PrecountRimshotBuffer(ctx).then((buf) => {
        precountRimshotBufferRef.current = buf;
      });
    }
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* autoplay */
      }
    }
    void ensureStudioLivePitchTuneWorklet(ctx).catch(() => {
      /* worklet optional â€” live pitch tune falls back to pass-through */
    });
    try {
      await preloadStudioMixerMeterWorklet(ctx);
    } catch {
      /* analyser meters — no worklet */
    }
    if (midiPreviewBusRef.current && ctx.state !== 'closed') {
      const masterOut = studioMasterOutRef.current ?? ctx.destination;
      const bus = midiPreviewBusRef.current;
      // Idempotent only — force reconnect here used to mute the bus mid-play (dropouts).
      ensureStudioPreviewBusOutput(bus, masterOut);
      if (
        !isStudioMixerStripGraphPlaybackLocked()
        && !transportArmingRef.current
        && !runningRef.current
      ) {
        ensureSe2MixerStrips(ctx, bus, masterOut);
        const tracks = studioTracksRef.current;
        for (let ti = 0; ti < tracks.length; ti++) {
          se2TrackPlaybackInput(
            ctx,
            bus,
            ti,
            trackFxSlotsRef.current[ti] ?? emptyMixerFxSlots(),
            trackInsertFxRacksRef.current[ti] ?? defaultStudioTrackInsertFxRack(),
            bpmRef.current,
            masterOut,
          );
        }
      }
    }
    return ctx;
  }, []);

  useEffect(() => {
    setStudioPitchMonitorRouteListener(() => {
      setPitchMonitorRouteTick((n) => n + 1);
    });
    return () => setStudioPitchMonitorRouteListener(null);
  }, []);

  useEffect(() => {
    if (!isScreenActive || sessionAudioRestoredRef.current || !se2SessionBoot.saved?.audioSources) {
      return;
    }
    void ensureCtx().then((ctx) => {
      if (sessionAudioRestoredRef.current || !ctx || ctx.state === 'closed') return;
      sessionAudioRestoredRef.current = true;
      return restoreSe2AudioSources(
        se2SessionBoot.saved?.audioSources,
        ctx,
        studioAudioBuffersRef.current,
      );
    });
  }, [isScreenActive, se2SessionBoot, ensureCtx]);

  const liveInputMonitorTarget = useMemo(
    () =>
      resolveStudioLiveInputMonitorTarget(
        studioTracks,
        trackRecordArmed,
        trackVocalFx,
        trackFxSlots,
        selectedTrackIndex,
        settings.audioInput,
      ),
    [
      studioTracks,
      trackRecordArmed,
      trackVocalFx,
      trackFxSlots,
      selectedTrackIndex,
      settings.audioInput,
      pitchMonitorRouteTick,
    ],
  );

  const liveInputMonitorKey = `${studioLiveInputMonitorKey(
    liveInputMonitorTarget,
    trackVocalFx,
    trackFxSlots,
    selectedTrackIndex,
  )}|route${pitchMonitorRouteTick}|rec${recording ? 1 : 0}`;

  /** Live mic → track Vocal DSP entry (stable — not torn down on fader moves). */
  useEffect(() => {
    if (!isScreenActive) {
      stopStudioInputMonitor();
      return;
    }
    if (!liveInputMonitorTarget) {
      stopStudioInputMonitor();
      return;
    }
    // Never open mic→speakers while a take is capturing (feedback loop).
    if (recordingRef.current) {
      setStudioInputMonitorSoftMuted(true);
      return;
    }

    const { trackIndex: monitorTi, deviceId } = liveInputMonitorTarget;
    let cancelled = false;

    void (async () => {
      const ctx = await ensureCtx();
      if (cancelled) return;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          /* autoplay */
        }
      }
      const bus = midiPreviewBusRef.current;
      if (!bus) return;
      ensureSe2MixerStrips(ctx, bus, studioMasterOutRef.current ?? ctx.destination);

      const rawFx = trackVocalFxRef.current[monitorTi] ?? STUDIO_TRACK_VOCAL_FX_DEFAULT;
      const effectiveFx = studioEffectiveTrackVocalFx(
        rawFx,
        trackFxSlotsRef.current[monitorTi] ?? emptyMixerFxSlots(),
      );
      const tr = studioTracksRef.current[monitorTi];
      const keyRoot = tr?.a2mKeyRoot != null ? tr.a2mKeyRoot : songKeyRootRef.current;
      const sessionStart = sessionStartRef.current;
      const origin = originBeatRef.current;
      const beatAtNow =
        runningRef.current && sessionStart > 0
          ? origin + Math.max(0, ctx.currentTime - sessionStart) * (bpmRef.current / 60)
          : origin;

      const entry = se2TrackPlaybackInput(
        ctx,
        bus,
        monitorTi,
        trackFxSlotsRef.current[monitorTi] ?? emptyMixerFxSlots(),
        trackInsertFxRacksRef.current[monitorTi] ?? defaultStudioTrackInsertFxRack(),
        bpmRef.current,
        studioMasterOutRef.current ?? ctx.destination,
      );
      const preStrip = getStudioTrackInsertPreStrip(monitorTi);
      const stripIn = getStudioMixerStripInput(monitorTi);
      if (!preStrip || !stripIn) {
        studioInputMonitorConnectDest(entry, monitorTi);
        return;
      }

      try {
        await routeStudioVocalLiveSignal({
          ctx,
          trackIndex: monitorTi,
          deviceId,
          preStrip,
          stripIn,
          fx: effectiveFx,
          keyRoot,
          carrierTracks: studioEditorVocoderCarrierTracks(studioTracksRef.current),
          bpm: bpmRef.current,
          clipStartBeat: Math.max(0, beatAtNow),
          connectMic: true,
          slots: trackFxSlotsRef.current[monitorTi] ?? emptyMixerFxSlots(),
          rack: trackInsertFxRacksRef.current[monitorTi] ?? defaultStudioTrackInsertFxRack(),
        });
      } catch (e) {
        console.warn('[Studio] Live vocal signal routing failed.', e);
        studioInputMonitorConnectDest(entry, monitorTi);
      }
    })();

    return () => {
      cancelled = true;
      if (!runningRef.current && !recordingRef.current) {
        studioInputMonitorDisconnectStrip();
      }
    };
  }, [isScreenActive, liveInputMonitorKey, ensureCtx]);

  /** Keep per-track Vocal DSP inserts synced (clip playback + live mic share the same entry). */
  useEffect(() => {
    if (!isScreenActive) {
      resetStudioTrackVocalFxInserts();
      return;
    }
    let cancelled = false;
    void (async () => {
      const ctx = await ensureCtx();
      if (cancelled) return;
      const bus = midiPreviewBusRef.current;
      if (!bus) return;
      ensureSe2MixerStrips(ctx, bus, studioMasterOutRef.current ?? ctx.destination);
      const tracks = studioTracksRef.current;
      const carrierTracks = studioEditorVocoderCarrierTracks(tracks);
      const sessionStart = sessionStartRef.current;
      const origin = originBeatRef.current;
      const beatAtNow =
        runningRef.current && sessionStart > 0
          ? origin + Math.max(0, ctx.currentTime - sessionStart) * (bpmRef.current / 60)
          : origin;

      for (let ti = 0; ti < tracks.length; ti++) {
        const tr = tracks[ti];
        if (!tr || (tr.kind !== 'audio' && tr.kind !== 'a2m')) continue;
        const rawFx = trackVocalFxRef.current[ti] ?? STUDIO_TRACK_VOCAL_FX_DEFAULT;
        const slots = trackFxSlotsRef.current[ti] ?? emptyMixerFxSlots();
        const effectiveFx = studioEffectiveTrackVocalFx(rawFx, slots);
        const rack = trackInsertFxRacksRef.current[ti] ?? defaultStudioTrackInsertFxRack();
        const recArm = tr.kind === 'audio' && (trackRecordArmedRef.current[ti] ?? false);
        const hasFx = studioTrackFxStackActive(effectiveFx, slots, rack);
        if (!hasFx && !recArm && !getStudioTrackVocalFxEntry(ti)) continue;
        const keyRoot = tr.a2mKeyRoot != null ? tr.a2mKeyRoot : songKeyRootRef.current;
        se2TrackPlaybackInput(
          ctx,
          bus,
          ti,
          slots,
          rack,
          bpmRef.current,
          studioMasterOutRef.current ?? ctx.destination,
        );
        const preStrip = getStudioTrackInsertPreStrip(ti);
        const stripIn = getStudioMixerStripInput(ti);
        if (!preStrip || !stripIn) continue;
        try {
          if (effectiveFx.autotuneOn) {
            await ensureStudioLivePitchTuneWorklet(ctx);
          }
          await syncStudioTrackVocalFxInsert({
            ctx,
            trackIndex: ti,
            preStrip,
            stripIn,
            fx: effectiveFx,
            keyRoot,
            carrierTracks,
            bpm: bpmRef.current,
            clipStartBeat: Math.max(0, beatAtNow),
            clipDurationBeats: 128,
            slots,
            rack,
          });
          // Only reconnects when this lane already owns the mic scope — never steal mid-record.
          reconnectStudioVocalLiveMicIfCached(ti);
        } catch (e) {
          console.warn(`[Studio] Vocal DSP insert sync failed for track ${ti}.`, e);
        }
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isScreenActive, studioTracks, trackVocalFx, trackFxSlots, trackRecordArmed, songKeyRoot, ensureCtx]);

  /** Rebuild per-track insert FX chains when suite rack / slots / BPM change. */
  useEffect(() => {
    if (!isScreenActive) {
      resetStudioTrackInsertFxStrips();
      return;
    }
    let cancelled = false;
    void (async () => {
      const ctx = await ensureCtx();
      if (cancelled) return;
      /*
       * Mid-play: onTrackInsertFxRackChange already wires the edited lane. Re-running
       * every track here (plus vocal stack sync) caused audible in/out dropouts with Suite on.
       */
      if (runningRef.current || isStudioMixerStripGraphPlaybackLocked()) return;
      const bus = midiPreviewBusRef.current;
      if (!bus) return;
      const masterOut = studioMasterOutRef.current ?? ctx.destination;
      ensureSe2MixerStrips(ctx, bus, masterOut);

      const tracks = studioTracksRef.current;
      const carrierTracks = studioEditorVocoderCarrierTracks(tracks);
      const sessionStart = sessionStartRef.current;
      const origin = originBeatRef.current;
      const beatAtNow =
        runningRef.current && sessionStart > 0
          ? origin + Math.max(0, ctx.currentTime - sessionStart) * (bpmRef.current / 60)
          : origin;

      for (let ti = 0; ti < tracks.length; ti++) {
        const tr = tracks[ti];
        if (!tr) continue;
        se2TrackPlaybackInput(
          ctx,
          bus,
          ti,
          trackFxSlotsRef.current[ti] ?? emptyMixerFxSlots(),
          trackInsertFxRacksRef.current[ti] ?? defaultStudioTrackInsertFxRack(),
          bpmRef.current,
          masterOut,
        );

        if (tr.kind === 'audio' || tr.kind === 'a2m') {
          const rawFx = trackVocalFxRef.current[ti] ?? STUDIO_TRACK_VOCAL_FX_DEFAULT;
          const slots = trackFxSlotsRef.current[ti] ?? emptyMixerFxSlots();
          const effectiveFx = studioEffectiveTrackVocalFx(rawFx, slots);
          const rack = trackInsertFxRacksRef.current[ti] ?? defaultStudioTrackInsertFxRack();
          const preStrip = getStudioTrackInsertPreStrip(ti);
          const stripIn = getStudioMixerStripInput(ti);
          if (
            preStrip &&
            stripIn &&
            (studioTrackFxStackActive(effectiveFx, slots, rack) || getStudioTrackVocalFxEntry(ti))
          ) {
            const keyRoot = tr.a2mKeyRoot != null ? tr.a2mKeyRoot : songKeyRootRef.current;
            try {
              if (effectiveFx.autotuneOn) {
                await ensureStudioLivePitchTuneWorklet(ctx);
              }
              await syncStudioTrackVocalFxInsert({
                ctx,
                trackIndex: ti,
                preStrip,
                stripIn,
                fx: effectiveFx,
                keyRoot,
                carrierTracks,
                bpm: bpmRef.current,
                clipStartBeat: Math.max(0, beatAtNow),
                clipDurationBeats: 128,
                slots,
                rack,
              });
            } catch (e) {
              console.warn(`[Studio] Vocal DSP reconnect after insert rebuild failed for track ${ti}.`, e);
            }
          }
          reconnectStudioVocalLiveMicIfCached(ti);
        }
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isScreenActive, trackInsertFxRacks, trackFxSlots, bpm, ensureCtx]);

  /** Live fader / preset updates on input monitor (no graph rebuild). */
  useEffect(() => {
    if (!liveInputMonitorTarget) return;
    const ti = liveInputMonitorTarget.trackIndex;
    const rawFx = trackVocalFx[ti] ?? STUDIO_TRACK_VOCAL_FX_DEFAULT;
    const effectiveFx = studioEffectiveTrackVocalFx(rawFx, trackFxSlots[ti] ?? emptyMixerFxSlots());
    if (!studioUseLiveVocalFxPlayback(effectiveFx)) return;
    const tr = studioTracks[ti];
    const keyRoot = tr?.a2mKeyRoot != null ? tr.a2mKeyRoot : songKeyRootRef.current;
    updateStudioLiveVocalFxForTrack(ti, effectiveFx, keyRoot, false);
  }, [liveInputMonitorTarget, studioTracks, trackVocalFx, trackFxSlots]);

  const ensureStudioDrumKitLoaded = useCallback(
    async (kitId: BeatLabProducerKitId): Promise<PianoRollDrumKitSession | null> => {
      const cached = studioDrumKitSessionsRef.current.get(kitId);
      if (cached) return cached;
      try {
        const ctx = await ensureCtx();
        if (ctx.state === 'closed') return null;
        if (ctx.state === 'suspended') await ctx.resume();
        const session = await loadPianoRollDrumKit(kitId, ctx);
        studioDrumKitSessionsRef.current.set(kitId, session);
        return session;
      } catch {
        return null;
      }
    },
    [ensureCtx],
  );

  const studioDrumSessionForTrack = useCallback(
    async (
      tr: { id: string; drumProducerKitId?: BeatLabProducerKitId; drumPadOverrides?: Partial<Record<number, Se2DrumPadOverride>> },
    ): Promise<PianoRollDrumKitSession | null> => {
      const kitId = tr.drumProducerKitId;
      if (!kitId) return null;
      const sig = se2DrumPadOverridesSignature(tr.drumPadOverrides);
      const cached = studioDrumTrackSessionsRef.current.get(tr.id);
      if (cached && cached.kitId === kitId && cached.sig === sig) return cached.session;
      try {
        const ctx = await ensureCtx();
        if (ctx.state === 'closed') return null;
        if (ctx.state === 'suspended') await ctx.resume();
        const session = sig
          ? await buildMergedDrumKitSession(kitId, tr.drumPadOverrides, ctx)
          : ((await ensureStudioDrumKitLoaded(kitId)) ?? null);
        if (session) studioDrumTrackSessionsRef.current.set(tr.id, { kitId, sig, session });
        return session;
      } catch {
        return null;
      }
    },
    [ensureCtx, ensureStudioDrumKitLoaded],
  );

  const studioBeatPadsSessionForTrack = useCallback(
    async (tr: Se2BeatPadsTrack): Promise<Se2BeatPadsTrackSession | null> => {
      const kitId = tr.beatPadsProducerKitId ?? 'trapDarkVault';
      const sig = se2BeatPadsStoreSignature(tr.id);
      const cached = studioBeatPadsTrackSessionsRef.current.get(tr.id);
      if (cached && cached.sig === sig && cached.kitId === kitId) return cached.session;
      try {
        const ctx = await ensureCtx();
        if (ctx.state === 'closed') return null;
        if (ctx.state === 'suspended') await ctx.resume();
        const session = await loadSe2BeatPadsTrackSession(ctx, tr.id, kitId);
        studioBeatPadsTrackSessionsRef.current.set(tr.id, { sig, kitId, session });
        return session;
      } catch {
        return null;
      }
    },
    [ensureCtx],
  );

  const handleBeatPadsPadStoreChanged = useCallback(
    (trackId: string) => {
      if (beatPadsPadStoreNotifyTimerRef.current) {
        clearTimeout(beatPadsPadStoreNotifyTimerRef.current);
      }
      beatPadsPadStoreNotifyTimerRef.current = setTimeout(() => {
        beatPadsPadStoreNotifyTimerRef.current = null;
        studioBeatPadsTrackSessionsRef.current.delete(trackId);
        setBeatPadsPadStoreRev((v) => v + 1);
      }, 200);
    },
    [],
  );

  const handleBeatPadsPadStoreChangedRef = useRef(handleBeatPadsPadStoreChanged);
  handleBeatPadsPadStoreChangedRef.current = handleBeatPadsPadStoreChanged;
  const notifyBeatPadsPadStoreChanged = useCallback((trackId: string) => {
    handleBeatPadsPadStoreChangedRef.current(trackId);
  }, []);

  const previewPianoPitch = useCallback(
    async (pitch: number, velocity01 = 0.9) => {
      const ctx = await ensureCtx();
      if (ctx.state === 'closed') return;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          /* autoplay */
        }
      }
      const ti = Math.max(0, Math.min(MAX_STUDIO_TRACKS - 1, selectedTrackIndexRef.current ?? 0));
      const tr = studioTracksRef.current[ti];
      const bus = midiPreviewBusRef.current;
      if (!bus) return;
      const stripIn = se2TrackPlaybackInput(
        ctx,
        bus,
        ti,
        trackFxSlotsRef.current[ti] ?? emptyMixerFxSlots(),
        trackInsertFxRacksRef.current[ti] ?? defaultStudioTrackInsertFxRack(),
    bpmRef.current,
    studioMasterOutRef.current ?? ctx.destination,
  );
      applyStudioMixerStripMix(ti, {
        muted: se2EffectiveTrackMuted(ti, trackMutesRef.current, trackSolosRef.current),
        vol127: trackVolumesRef.current[ti] ?? MIXER_UNITY_VOL,
        pan127: trackPansRef.current[ti] ?? 64,
        mono: trackMonosRef.current[ti] ?? false,
      });
      if (tr && studioTrackIsGlideBassChannel(tr) && stripIn) {
        const voice = se2GlideBassVoicesRef.current[ti] ?? se2GlideBassVoiceFromTrack(tr, undefined);
        previewBeatLabSynthV2Note(ctx, {
          lane: se2BeatLabLaneForTrack(ti),
          midi: pitch,
          velocity: Math.max(1, Math.round(velocity01 * 127)),
          channelVolumes: {},
          voice,
          stripOutput: stripIn,
          bpm: bpmRef.current,
        });
        return;
      }
      if (tr && studioTrackIsSynthGenoChannel(tr) && stripIn) {
        const voice =
          se2SynthGenoVoicesRef.current[ti] ?? se2SynthGenoVoiceFromTrack(tr, undefined);
        previewSe2SynthGenoNote(
          ctx,
          stripIn,
          pitch,
          Math.max(1, Math.round(velocity01 * 127)),
          voice,
        );
        return;
      }
      if (tr && studioTrackIsGrooveLeadChannel(tr) && stripIn) {
        const voice =
          se2GrooveLeadVoicesRef.current[ti] ?? se2GrooveLeadVoiceFromTrack(tr, undefined);
        previewSe2GrooveLeadNote(
          ctx,
          stripIn,
          pitch,
          Math.max(1, Math.round(velocity01 * 127)),
          voice,
          ti,
          bpmRef.current,
        );
        return;
      }
      if (tr && studioTrackIsLab808Channel(tr) && stripIn) {
        const voice = se2Lab808VoicesRef.current[ti] ?? se2Lab808VoiceFromTrack(tr, undefined);
        previewSe2Lab808Note(
          ctx,
          stripIn,
          pitch,
          Math.max(1, Math.round(velocity01 * 127)),
          voice,
          bpmRef.current,
        );
        return;
      }
      if (tr && studioTrackIsGenoUltraSynthChannel(tr) && stripIn) {
        const voice =
          se2GenoUltraSynthVoicesRef.current[ti] ?? se2GenoUltraVoiceFromTrack(tr, undefined);
        previewSe2GenoUltraSynthNote(
          ctx,
          stripIn,
          pitch,
          Math.max(1, Math.round(velocity01 * 127)),
          voice,
          bpmRef.current,
        );
        return;
      }
      if (tr && studioTrackIsGenoBassSynthChannel(tr) && stripIn) {
        const voice =
          se2GenoBassSynthVoicesRef.current[ti] ?? se2GenoBassVoiceFromTrack(tr, undefined);
        previewSe2GenoUltraSynthNote(
          ctx,
          stripIn,
          pitch,
          Math.max(1, Math.round(velocity01 * 127)),
          voice,
          bpmRef.current,
        );
        return;
      }
      if (tr && studioTrackIsHumCaptureChannel(tr) && stripIn) {
        previewSe2HumCaptureNote(
          ctx,
          stripIn,
          pitch,
          tr.humCaptureInstrumentId ?? 'piano',
          Math.max(1, Math.round(velocity01 * 127)),
          tr.humCaptureTranspose ?? 0,
        );
        return;
      }
      if (tr && studioTrackIsGuitarChannel(tr) && stripIn) {
        previewSe2GuitarNote(
          ctx,
          resolveSe2GuitarAudioForTrack(ctx, ti, stripIn, tr),
          pitch,
          tr.guitarInstrumentId ?? 'electric_guitar_clean',
          Math.max(1, Math.round(velocity01 * 127)),
          tr.guitarTranspose ?? 0,
        );
        return;
      }
      if (tr && studioTrackIsBeatPadsChannel(tr) && stripIn) {
        const session = await studioBeatPadsSessionForTrack(tr as Se2BeatPadsTrack);
        const vel = Math.max(1, Math.round(velocity01 * 127));
        if (
          triggerSe2BeatPadsMidiPitch(session, pitch, ctx, vel, undefined, stripIn, {
            sessionBpm: bpmRef.current,
            trackVolume127: trackVolumesRef.current[ti] ?? MIXER_UNITY_VOL,
          })
        ) {
          return;
        }
      }
      if (tr && studioTrackIsDrumChannel(tr) && !studioTrackIsBeatPadsChannel(tr) && tr.drumProducerKitId) {
        const session = await studioDrumSessionForTrack(tr);
        const vel = Math.max(1, Math.round(velocity01 * 127));
        const padIndex = pianoRollPadIndexForMidi(pitch);
        if (triggerPianoRollDrumPad(session, padIndex, ctx, vel, undefined, stripIn)) {
          return;
        }
      }
      const leadId = tr ? studioParseGrooveLeadInstrumentId(tr.midiInstrumentId) : null;
      const orchHitId = tr ? studioParseOrchestraHitInstrumentId(tr.midiInstrumentId) : null;
      const orchDef = orchHitId ? getOrchestraHitDef(orchHitId) : undefined;
      if (leadId && stripIn) {
        if (
          studioPlayGrooveLeadOnPreviewBus(
            ctx,
            stripIn,
            leadId,
            ctx.currentTime + 0.004,
            pitch,
            velocity01,
            64,
            false,
            MIXER_UNITY_VOL,
            bpmRef.current,
            0.5,
          )
        ) {
          return;
        }
      }
      if (orchDef && stripIn) {
        void studioPreloadOrchestraHitInstrument(ctx, tr!.midiInstrumentId);
        if (
          studioPlayOrchestraHitOnPreviewBus(
            ctx,
            stripIn,
            orchDef,
            ctx.currentTime + 0.004,
            pitch,
            velocity01,
            64,
            false,
            MIXER_UNITY_VOL,
          )
        ) {
          return;
        }
      }
      if (
        stripIn &&
        tr &&
        previewStudioEditor2MidiInstrumentNote({
          ctx,
          stripIn,
          trackIndex: ti,
          instrumentId: tr.midiInstrumentId,
          midi: pitch,
          velocity: Math.max(1, Math.round(velocity01 * 127)),
          when: ctx.currentTime + 0.008,
          durationSec: 0.45,
          bpm: bpmRef.current,
        })
      ) {
        return;
      }
      if (stripIn) {
        previewMidiKeyThroughBus(ctx, stripIn, pitch, velocity01, 0.32, 64, false, 1);
      } else {
        studioPreviewKeyBlipToDestination(ctx, pitch, velocity01, 0.32);
      }
    },
    [ensureCtx, studioDrumSessionForTrack, studioBeatPadsSessionForTrack],
  );
  const editorStudioSessionRef = useRef<ReturnType<typeof buildStudioSessionFromEditor2Tracks> | null>(null);

  useEffect(() => {
    editorStudioSessionRef.current = buildStudioSessionFromEditor2Tracks(studioTracks as Editor2ArrangerTrack[], {
      projectName: 'Studio Editor 2',
      bpm,
      songKeyRoot,
      songKeyMode,
      beatsPerBar,
      loopEnabled: loopOn,
      loopStartBeat,
      loopEndBeat,
    });
  }, [studioTracks, bpm, songKeyRoot, songKeyMode, beatsPerBar, loopOn, loopStartBeat, loopEndBeat]);

  useEffect(() => {
    if (!pendingStudioAudioBlob || pendingStudioAudioBlob.size === 0) return;
    const blob = pendingStudioAudioBlob;
    let cancelled = false;
    void (async () => {
      try {
        const ctx = await ensureCtx();
        if (ctx.state === 'suspended') {
          try {
            await ctx.resume();
          } catch {
            /* autoplay */
          }
        }
        const raw = await blob.arrayBuffer();
        const buffer = await ctx.decodeAudioData(raw.slice(0));
        if (cancelled) return;
        const sourceId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? `src-${crypto.randomUUID()}`
            : `src-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        studioAudioBuffersRef.current.set(sourceId, buffer);
        const durBeats = audioDurationBeatsFromSeconds(buffer.duration, bpmRef.current);
        const clipId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? `ac-${crypto.randomUUID()}`
            : `ac-${Date.now()}`;
        setStudioTracks((prev) => {
          const ai = prev.findIndex((t) => t.kind === 'audio');
          if (ai < 0) return prev;
          const tb = totalBeatsForSig(beatsPerBarRef.current);
          const clip: StudioAudioClip = {
            id: clipId,
            sourceId,
            startBeat: 0,
            durationBeats: Math.min(tb, durBeats),
            name: 'Imported audio',
          };
          return prev.map((t, i) => (i === ai ? { ...t, audioClips: [...t.audioClips, clip] } : t));
        });
        if (!cancelled) onPendingStudioAudioConsumed?.();
      } catch (e) {
        console.error('Studio Editor 2: failed to import pending audio blob', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingStudioAudioBlob, ensureCtx, onPendingStudioAudioConsumed]);

  const muteMetro = useCallback(() => {
    const ctx = ctxRef.current;
    const bus = metroBusRef.current;
    if (!ctx || ctx.state === 'closed' || !bus) return;
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(0, t);
  }, []);

  const unmuteMetro = useCallback(() => {
    const ctx = ctxRef.current;
    const bus = metroBusRef.current;
    if (!ctx || ctx.state === 'closed' || !bus) return;
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(1, t);
  }, []);

  /** Stop and discard all pre-scheduled metronome nodes â€” called on loop reset and transport stop
   *  to prevent previously queued clicks from firing after the transport jumps back to beat 0. */
  const cancelScheduledMetroNodes = useCallback(() => {
    const arr = scheduledMetroNodesRef.current;
    for (const src of arr) {
      try { src.stop(); } catch { /* already stopped */ }
      try { src.disconnect(); } catch { /* */ }
    }
    arr.length = 0;
  }, []);

  const cancelScheduledPrecountNodes = useCallback(() => {
    const arr = scheduledPrecountNodesRef.current;
    for (const src of arr) {
      try { src.stop(); } catch { /* already stopped */ }
      try { src.disconnect(); } catch { /* */ }
    }
    arr.length = 0;
  }, []);

  const cancelPrecountSession = useCallback(() => {
    precountCancelRef.current = true;
    cancelScheduledPrecountNodes();
    isPrecountingRef.current = false;
    setIsPrecounting(false);
    setPrecountBeatUi(null);
  }, [cancelScheduledPrecountNodes]);

  const scheduleMusioClickAt = useCallback(
    (
      ctx: AudioContext,
      idealT: number,
      downbeat: boolean,
      nodeBucket: AudioBufferSourceNode[],
    ) => {
      const buf = downbeat ? accentBufferRef.current : clickBufferRef.current;
      if (!buf) return;
      const t0 = Math.max(idealT, ctx.currentTime + 0.001);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = CREATION_METRO_VOLUME;
      src.connect(g);
      const bus = metroBusRef.current;
      if (bus) g.connect(bus);
      else g.connect(ctx.destination);
      src.start(t0);
      nodeBucket.push(src);
      src.onended = () => {
        const arr = nodeBucket;
        const idx = arr.indexOf(src);
        if (idx !== -1) arr.splice(idx, 1);
        try { src.disconnect(); g.disconnect(); } catch { /* */ }
      };
    },
    [],
  );

  const playPrecountClick = useCallback((ctx: AudioContext, idealT: number, _downbeat: boolean) => {
    if (!precountRimshotBufferRef.current && ctx.state !== 'closed') {
      precountRimshotBufferRef.current = createSe2PrecountRimshotBuffer(ctx);
    }
    const buf = precountRimshotBufferRef.current;
    if (!buf) return;
    const t0 = Math.max(idealT, ctx.currentTime + 0.001);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = SE2_PRECOUNT_CLICK_VOLUME;
    src.connect(g);
    const dest = studioMasterOutRef.current ?? ctx.destination;
    g.connect(dest);
    src.start(t0);
    const bucket = scheduledPrecountNodesRef.current;
    bucket.push(src);
    src.onended = () => {
      const idx = bucket.indexOf(src);
      if (idx !== -1) bucket.splice(idx, 1);
      try { src.disconnect(); g.disconnect(); } catch { /* */ }
    };
  }, []);

  /* Master fader → monitor output gain (music + metronome share this stage). */
  const masterVolumeRef = useRef(masterVolume);
  masterVolumeRef.current = masterVolume;

  const studioTrackIdsKey = useMemo(
    () => studioTracks.map((t) => t.id).join('\u0001'),
    [studioTracks],
  );
  const tracksPersistSig = useMemo(() => tracksSignature(studioTracks), [studioTracks]);

  const saveOwnerStartupLayout = useCallback(async (templateLabel?: string) => {
    const tracks = snapshotStudioTracks(studioTracksRef.current);
    const sourceIds = collectSe2AudioSourceIds(tracks);
    const audioSources = await encodeSe2AudioSources(studioAudioBuffersRef.current, sourceIds);
    const mixer = snapshotSe2MixerFromArrays(
      studioTracksRef.current,
      trackVolumesRef.current,
      trackPansRef.current,
      trackMutesRef.current,
      trackSolosRef.current,
      trackMonosRef.current,
      masterVolumeRef.current,
    );
    captureSe2OwnerStartupTemplate(
      {
        tracks,
        selectedTrackIndex: selectedTrackIndexRef.current,
        bpm: bpmRef.current,
        loopOn: loopOnRef.current,
        loopBars: loopBarsRef.current,
        loopStartBeat: loopStartBeatRef.current,
        loopEndBeat: loopEndBeatRef.current,
        beatsPerBar: beatsPerBarRef.current,
        beatPadsMachineOpen,
        songKeyRoot: songKeyRootRef.current,
        songKeyMode: songKeyModeRef.current,
        timelineZoom: timelineZoomRef.current,
        audioSources,
      },
      mixer,
      { showMixer, showPianoRoll },
      templateLabel,
    );
    setOwnerStartupSavedTick((n) => n + 1);
  }, [beatPadsMachineOpen, showMixer, showPianoRoll]);

  const openTemplateSaveDialog = useCallback(() => {
    const existing = readSe2OwnerStartupTemplate();
    setTemplateSaveName(existing?.templateLabel?.trim() || 'SE2 Template');
    setTemplateSaveOpen(true);
  }, []);

  const confirmSaveTemplate = useCallback(() => {
    const label = templateSaveName.trim() || 'SE2 Template';
    setTemplateSaveOpen(false);
    void saveOwnerStartupLayout(label);
  }, [saveOwnerStartupLayout, templateSaveName]);

  const collectSe2SongPayload = useCallback(async () => {
    const tracks = snapshotStudioTracks(studioTracksRef.current);
    const sourceIds = collectSe2AudioSourceIds(tracks);
    const audioSources = await encodeSe2AudioSources(studioAudioBuffersRef.current, sourceIds);
    const mixer = snapshotSe2MixerFromArrays(
      studioTracksRef.current,
      trackVolumesRef.current,
      trackPansRef.current,
      trackMutesRef.current,
      trackSolosRef.current,
      trackMonosRef.current,
      masterVolumeRef.current,
    );
    return buildDaMusicBoxSongFile({
      songName,
      session: {
        tracks,
        selectedTrackIndex: selectedTrackIndexRef.current,
        bpm: bpmRef.current,
        loopOn: loopOnRef.current,
        loopBars: loopBarsRef.current,
        loopStartBeat: loopStartBeatRef.current,
        loopEndBeat: loopEndBeatRef.current,
        beatsPerBar: beatsPerBarRef.current,
        beatPadsMachineOpen,
        songKeyRoot: songKeyRootRef.current,
        songKeyMode: songKeyModeRef.current,
        timelineZoom: timelineZoomRef.current,
        audioSources,
      },
      mixer,
      consolidateStartBar,
      consolidateEndBar,
    });
  }, [beatPadsMachineOpen, consolidateEndBar, consolidateStartBar, songName]);

  useEffect(() => {
    const w = window as unknown as { __dmbSaveSe2StartupLayout?: () => Promise<void> };
    w.__dmbSaveSe2StartupLayout = saveOwnerStartupLayout;
    return () => {
      delete w.__dmbSaveSe2StartupLayout;
    };
  }, [saveOwnerStartupLayout]);

  useEffect(() => {
    if (!sessionPersistReadyRef.current) {
      sessionPersistReadyRef.current = true;
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        const tracks = snapshotStudioTracks(studioTracksRef.current);
        const sourceIds = collectSe2AudioSourceIds(tracks);
        const audioSources = await encodeSe2AudioSources(studioAudioBuffersRef.current, sourceIds);
        writeSe2SessionSnapshot({
          tracks,
          selectedTrackIndex: selectedTrackIndexRef.current,
          bpm: bpmRef.current,
          loopOn: loopOnRef.current,
          loopBars: loopBarsRef.current,
          loopStartBeat: loopStartBeatRef.current,
          loopEndBeat: loopEndBeatRef.current,
          beatsPerBar: beatsPerBarRef.current,
          beatPadsMachineOpen,
          songKeyRoot,
          songKeyMode,
          timelineZoom: timelineZoomRef.current,
          audioSources,
        });
      })();
    }, 800);
    return () => window.clearTimeout(t);
  }, [
    tracksPersistSig,
    selectedTrackIndex,
    bpm,
    loopOn,
    loopBars,
    loopStartBeat,
    loopEndBeat,
    beatsPerBar,
    beatPadsMachineOpen,
    songKeyRoot,
    songKeyMode,
    zoom,
  ]);

  useEffect(() => {
    if (!mixerPersistReadyRef.current) {
      mixerPersistReadyRef.current = true;
      return;
    }
    const t = window.setTimeout(() => {
      writeSe2StudioMixerSnapshot(
        snapshotSe2MixerFromArrays(
          studioTracksRef.current,
          trackVolumesRef.current,
          trackPansRef.current,
          trackMutesRef.current,
          trackSolosRef.current,
          trackMonosRef.current,
          masterVolumeRef.current,
        ),
      );
    }, 600);
    return () => window.clearTimeout(t);
  }, [
    trackVolumes,
    trackPans,
    trackMutes,
    trackSolos,
    trackMonos,
    masterVolume,
    studioTrackIdsKey,
  ]);
  useEffect(() => {
    const ctx = ctxRef.current;
    const masterOut = studioMasterOutRef.current;
    if (!ctx || ctx.state === 'closed' || !masterOut) return;
    const gain = mixerVolToLinearGain(masterVolumeRef.current);
    masterOut.gain.cancelScheduledValues(ctx.currentTime);
    masterOut.gain.setValueAtTime(gain, ctx.currentTime);
  }, [masterVolume]);

  useEffect(() => {
    if (!mixerFaderActive) return undefined;
    const clear = () => setMixerFaderActive(null);
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
    return () => {
      window.removeEventListener('pointerup', clear);
      window.removeEventListener('pointercancel', clear);
    };
  }, [mixerFaderActive]);

  const playClick = useCallback((ctx: AudioContext, idealT: number, downbeat: boolean, _ctSnap: number) => {
    scheduleMusioClickAt(ctx, idealT, downbeat, scheduledMetroNodesRef.current);
  }, [scheduleMusioClickAt]);

  /**
   * Wilson-style lookahead: advance `nextMetroKRef` while grid times are in the past, then
   * schedule every attack with `t = sessionStart + (k-origin)*spb` until `now + METRO_SCHEDULE_AHEAD_SEC`.
   */
  const refillMetronome = useCallback(
    (ctx: AudioContext, ctSnap: number, opts?: { loopContinuation?: boolean }) => {
      if (!runningRef.current || !metroOnRef.current) return;
      const spb = spbFromBpm(bpmRef.current);
    const origin = originBeatRef.current;
    const sessionStart = sessionStartRef.current;
      const tb = totalBeatsRef.current;
      const bpb = beatsPerBarRef.current;
      const loopOn = loopOnRef.current;
      const loopStart = loopStartBeatRef.current;
      const loopEnd = loopEndBeatRef.current;
      const loopActive = loopOn && loopEnd > loopStart;
      const seamlessLoopActive =
        loopActive &&
        wapiSegLoopRef.current.seamlessLoop &&
        wapiSegLoopRef.current.active;
      if (loopActive && !opts?.loopContinuation && !insideMetroLoopSpliceRef.current && !seamlessLoopActive) {
        if (maybeSe2MetroLoopWrapRef.current(ctx, ctSnap)) return;
      }
      const horizon = ctSnap + METRO_SCHEDULE_AHEAD_SEC;
      /*
       * Use ctSnap (the caller's snapshot of ctx.currentTime) rather than re-reading
       * ctx.currentTime here.  Re-reading can give a value 1â€“2 ms ahead of ctSnap due
       * to audio render-quantum advances, which pushes beat-0 late by that margin and
       * widens the visual-ahead-of-audio gap.
       */
      const chainFloor = opts?.loopContinuation ? LOOP_METRO_CHAIN_FLOOR_SEC : AUDIO_START_FLOOR_SEC;
      let chain = ctSnap + chainFloor;
      let n = 0;

      if (opts?.loopContinuation && loopActive && sessionStart > 0) {
        const kAudio = origin + Math.max(0, ctSnap - sessionStart) / spb;
        const kFloor = Math.max(0, Math.floor(kAudio + 1e-9));
        const maxAhead = Math.ceil(METRO_SCHEDULE_AHEAD_SEC / spb) + 4;
        const tNextForK = sessionStart + (nextMetroKRef.current - origin) * spb;
        if (
          nextMetroKRef.current > kFloor + maxAhead ||
          (nextMetroKRef.current > kFloor + 1 && tNextForK > ctSnap + spb * 0.125)
        ) {
          nextMetroKRef.current = kFloor;
        }
      }
      /* Advance past already-elapsed beats â€” keep scheduling when loop brace is on. */
      while (loopActive || nextMetroKRef.current <= tb) {
        const tNextQuarter = sessionStart + (nextMetroKRef.current + 1 - origin) * spb;
        if (tNextQuarter > ctSnap) break;
        nextMetroKRef.current += 1;
        if (!loopActive && nextMetroKRef.current > tb) break;
      }

      while (n < MAX_METRO_SCHEDULE_PER_CALL) {
        const k = nextMetroKRef.current;
        if (!loopActive && k > tb) break;
      const tGrid = sessionStart + (k - origin) * spb;
      if (tGrid >= horizon) break;
        const t0 = Math.max(tGrid, chain);
        const wrappedBeat = loopActive
          ? se2WrapBeatInLoop(k, true, loopStart, loopEnd)
          : k;
        try {
          playClick(ctx, t0, Math.floor(wrappedBeat + 1e-9) % bpb === 0, ctSnap);
        } catch {
          break;
        }
        chain = t0 + METRO_NODE_EPS_SEC;
        nextMetroKRef.current = k + 1;
        n += 1;
      }
    },
    [playClick],
  );

  const refillMidiPreview = useCallback((ctx: AudioContext, ctSnap: number, opts?: { loopContinuation?: boolean }) => {
    if (!runningRef.current) return;
    const bus = midiPreviewBusRef.current;
    if (!bus || ctx.state === 'closed') return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
      return;
    }

    const spb = spbFromBpm(bpmRef.current);
    const origin = originBeatRef.current;
    const sessionStart = sessionStartRef.current;
    if (sessionStart <= 0) return;

    const horizon = ctSnap + METRO_SCHEDULE_AHEAD_SEC;
    const tracks = studioTracksRef.current;
    const scheduled = midiPreviewScheduledRef.current;
    const loopOn = loopOnRef.current;
    const loopStart = loopStartBeatRef.current;
    const loopEnd = loopEndBeatRef.current;
    const loopSpan = loopEnd - loopStart;
    const loopLap = midiPreviewLoopLapRef.current;
    const chainFloor = opts?.loopContinuation ? LOOP_METRO_CHAIN_FLOOR_SEC : AUDIO_START_FLOOR_SEC;

    const beatNow = origin + Math.max(0, ctSnap - sessionStart) / spb;
    const purgeBeforeBeat = beatNow - 1;
    for (const key of [...scheduled]) {
      const m = key.match(/:b([\d.]+)$/);
      if (m && parseFloat(m[1]) < purgeBeforeBeat) scheduled.delete(key);
    }

    for (let ti = 0; ti < tracks.length; ti++) {
      const tr = tracks[ti];
      if (!studioTrackOutputsMidi(tr)) continue;
      if (se2EffectiveTrackMuted(ti, trackMutesRef.current, trackSolosRef.current)) continue;
      /* Always feed MIDI/synth through the insert preStrip bus — never strip.input —
         so DA FX Suite on the channel is audible during transport lock. */
      let stripIn: GainNode | null = getStudioTrackClipPlaybackBus(ti);
      if (!stripIn && isStudioMixerStripGraphPlaybackLocked()) {
        stripIn = healStudioTrackPlaybackRouteIfStale(
          ctx,
          bus,
          ti,
          getStudioMixerStripCountHint(),
          studioMasterOutRef.current ?? ctx.destination,
        );
      }
      if (!stripIn) {
        stripIn = se2TrackPlaybackInput(
          ctx,
          bus,
          ti,
          trackFxSlotsRef.current[ti] ?? emptyMixerFxSlots(),
          trackInsertFxRacksRef.current[ti] ?? defaultStudioTrackInsertFxRack(),
          bpmRef.current,
          studioMasterOutRef.current ?? ctx.destination,
        );
      }
      if (!stripIn) continue;
      applyStudioMixerStripMix(ti, {
        muted: se2EffectiveTrackMuted(ti, trackMutesRef.current, trackSolosRef.current),
        vol127: trackVolumesRef.current[ti] ?? MIXER_UNITY_VOL,
        pan127: trackPansRef.current[ti] ?? 64,
        mono: trackMonosRef.current[ti] ?? false,
      });

      if (studioTrackIsBeatPadsChannel(tr)) {
        const bpTr = tr as Se2BeatPadsTrack;
        if (!se2BeatPadsSe2TransportLinked(bpTr)) continue;
        const kitId = bpTr.beatPadsProducerKitId ?? 'trapDarkVault';
        const sig = se2BeatPadsStoreSignature(tr.id);
        const cached = studioBeatPadsTrackSessionsRef.current.get(tr.id);
        let session =
          cached && cached.sig === sig && cached.kitId === kitId ? cached.session : null;
        if (!session) {
          void studioBeatPadsSessionForTrack(bpTr);
        }
        const harmony = se2ResolveBeatPadsHarmonyTrack(tracks, bpTr, bpTr.id);
        const { keyRoot } = se2BeatPadsHarmonyKey(
          harmony,
          songKeyRootRef.current,
          songKeyModeRef.current,
        );
        const kickKeySemi = se2BeatPadsKickKeySemiForTrack(bpTr, keyRoot);
        refillSe2BeatPadsPatternOnTransport({
          ctx,
          ctSnap,
          horizon,
          chainFloor,
          track: bpTr,
          session,
          stripIn,
          originBeat: origin,
          sessionStart,
          spb,
          bpm: bpmRef.current,
          beatsPerBar: beatsPerBarRef.current,
          trackVolume127: trackVolumesRef.current[ti] ?? MIXER_UNITY_VOL,
          scheduled,
          kickKeySemi,
        });
        refillSe2BeatPadsSpreadOnTransport({
          ctx,
          ctSnap,
          horizon,
          chainFloor,
          track: bpTr,
          session,
          stripIn,
          originBeat: origin,
          sessionStart,
          spb,
          bpm: bpmRef.current,
          beatsPerBar: beatsPerBarRef.current,
          trackVolume127: trackVolumesRef.current[ti] ?? MIXER_UNITY_VOL,
          scheduled,
          harmonyTracks: tracks,
          songKeyRoot: songKeyRootRef.current,
          songKeyMode: songKeyModeRef.current,
        });
        if (bpTr.beatPads808LabSynced && bpTr.beatPads808LabVoice) {
          const labVoice = se2BeatPads808LabVoiceFromTrack(bpTr);
          const labTrackId = `${bpTr.id}__beatPads808Lab`;
          refillSe2Lab808DrumOnTransport({
            ctx,
            ctSnap,
            horizon,
            chainFloor,
            trackId: labTrackId,
            voice: labVoice,
            toneGridSteps: labVoice.toneGridSteps,
            stripIn,
            originBeat: origin,
            sessionStart,
            spb,
            bpm: bpmRef.current,
            beatsPerBar: beatsPerBarRef.current,
            trackVolume127: trackVolumesRef.current[ti] ?? MIXER_UNITY_VOL,
            scheduled,
          });
          refillSe2Lab808PercOnTransport({
            ctx,
            ctSnap,
            horizon,
            chainFloor,
            trackId: labTrackId,
            voice: labVoice,
            stripIn,
            originBeat: origin,
            sessionStart,
            spb,
            beatsPerBar: beatsPerBarRef.current,
            scheduled,
          });
        }
        if (bpTr.beatPadsOrchHitsSynced && bpTr.beatPadsOrchHitsVoice) {
          const orchVoice = se2BeatPadsOrchHitsVoiceFromTrack(bpTr);
          refillBeatPadsOrchHitsOnTransport({
            ctx,
            ctSnap,
            horizon,
            chainFloor,
            trackId: `${bpTr.id}__beatPadsOrchHits`,
            voice: orchVoice,
            stripIn,
            originBeat: origin,
            sessionStart,
            spb,
            scheduled,
          });
        }
        continue;
      }

      if (studioTrackIsLab808Channel(tr)) {
        const voice = se2Lab808VoicesRef.current[ti] ?? se2Lab808VoiceFromTrack(tr, undefined);
        const strip = stripIn ?? ctx.destination;
        refillSe2Lab808DrumOnTransport({
          ctx,
          ctSnap,
          horizon,
          chainFloor,
          trackId: tr.id,
          voice,
          toneGridSteps: voice.toneGridSteps,
          stripIn: strip,
          originBeat: origin,
          sessionStart,
          spb,
          bpm: bpmRef.current,
          beatsPerBar: beatsPerBarRef.current,
          trackVolume127: trackVolumesRef.current[ti] ?? MIXER_UNITY_VOL,
          scheduled,
        });
        refillSe2Lab808PercOnTransport({
          ctx,
          ctSnap,
          horizon,
          chainFloor,
          trackId: tr.id,
          voice,
          stripIn: strip,
          originBeat: origin,
          sessionStart,
          spb,
          beatsPerBar: beatsPerBarRef.current,
          scheduled,
        });
      }

      for (let ni = 0; ni < tr.notes.length; ni++) {
        const note = tr.notes[ni];
        const occurrences = studioMidiPreviewLoopOccurrences({
          noteStartBeat: note.startBeat,
          noteDurationBeats: note.durationBeats,
          originBeat: origin,
          sessionStart,
          spb,
          ctSnap,
          horizon,
          loopOn,
          loopStartBeat: loopStart,
          loopEndBeat: loopEnd,
        });

        for (const occ of occurrences) {
          const inLoopRegion =
            loopOn &&
            loopSpan > 1e-6 &&
            note.startBeat >= loopStart &&
            note.startBeat < loopEnd;
          const key = inLoopRegion
            ? studioMidiPreviewScheduleKeyLoopLap(
                loopLap,
                tr.id,
                ni,
                note.startBeat - loopStart,
                occ.repeatInLap,
              )
            : studioMidiPreviewScheduleKeyOccurrence(tr.id, ni, occ.occurrenceBeat);
          const tOn = occ.tOn;
          const dur = Math.max(0.04, note.durationBeats * spb);
          const tOff = tOn + dur;
          if (tOff < ctSnap - 0.02) {
            scheduled.delete(key);
            continue;
          }
          const loopCatchUpSec = 0.15;
          const isLoopDownbeat =
            inLoopRegion && Math.abs(note.startBeat - loopStart) < 1e-6;
          if (tOn < ctSnap - 0.03) {
            const allowLoopReschedule =
              inLoopRegion &&
              (opts?.loopContinuation || isLoopDownbeat) &&
              tOn >= ctSnap - loopCatchUpSec;
            if (!allowLoopReschedule) {
              scheduled.add(key);
              continue;
            }
          }
          if (scheduled.has(key)) continue;
          scheduled.add(key);

          const when = Math.max(tOn, ctSnap + chainFloor);
          const tEnd = when + Math.min(dur, 3);

          if (studioTrackIsGlideBassChannel(tr)) {
            try {
              const voice = se2GlideBassVoicesRef.current[ti] ?? se2GlideBassVoiceFromTrack(tr, undefined);
              const harmonySource = se2ResolveGlideBassHarmonyTrack(tracks, tr, tr.id);
              const chordRail = se2GlideBassChordRailFromSource(
                harmonySource,
                beatsPerBarRef.current,
                songKeyRootRef.current,
                songKeyModeRef.current,
              );
              se2ScheduleGlideBassNote({
                ctx,
                stripOutput: stripIn,
                trackIndex: ti,
                note,
                allNotes: tr.notes,
                when,
                bpm: bpmRef.current,
                beatsPerBar: beatsPerBarRef.current,
                subdiv: pianoSnapEffRef.current,
                voice,
                chordRail,
                channelVolumes: {},
              });
            } catch {
              scheduled.delete(key);
            }
            continue;
          }

          if (studioTrackIsSynthGenoChannel(tr)) {
            try {
              const voice =
                se2SynthGenoVoicesRef.current[ti] ?? se2SynthGenoVoiceFromTrack(tr, undefined);
              scheduleSe2SynthGenoNote(
                ctx,
                stripIn,
                when,
                tEnd,
                note.pitch,
                note.velocity,
                voice,
                note.flexCurve && note.flexCurve.length >= 2
                  ? {
                      flexCurve: note.flexCurve,
                      flexDurationBeats: note.durationBeats,
                      bpm: bpmRef.current,
                    }
                  : undefined,
              );
            } catch {
              scheduled.delete(key);
            }
            continue;
          }

          if (studioTrackIsGrooveLeadChannel(tr)) {
            try {
              const voice =
                se2GrooveLeadVoicesRef.current[ti] ?? se2GrooveLeadVoiceFromTrack(tr, undefined);
              scheduleSe2GrooveLeadNote(
                ctx,
                stripIn,
                when,
                tEnd,
                note.pitch,
                note.velocity,
                voice,
                ti,
                bpmRef.current,
              );
            } catch {
              scheduled.delete(key);
            }
            continue;
          }

          if (studioTrackIsLab808Channel(tr)) {
            try {
              const voice = se2Lab808VoicesRef.current[ti] ?? se2Lab808VoiceFromTrack(tr, undefined);
              scheduleSe2Lab808Note(
                ctx,
                stripIn,
                when,
                tEnd,
                note.pitch,
                note.velocity,
                voice,
                bpmRef.current,
              );
            } catch {
              scheduled.delete(key);
            }
            continue;
          }

          if (studioTrackIsGenoUltraSynthChannel(tr)) {
            try {
              const voice =
                se2GenoUltraSynthVoicesRef.current[ti] ?? se2GenoUltraVoiceFromTrack(tr, undefined);
              scheduleSe2GenoUltraSynthNote(
                ctx,
                stripIn,
                when,
                tEnd,
                note.pitch,
                note.velocity,
                voice,
                bpmRef.current,
              );
            } catch {
              scheduled.delete(key);
            }
            continue;
          }

          if (studioTrackIsGenoBassSynthChannel(tr)) {
            try {
              const voice =
                se2GenoBassSynthVoicesRef.current[ti] ?? se2GenoBassVoiceFromTrack(tr, undefined);
              scheduleSe2GenoUltraSynthNote(
                ctx,
                stripIn,
                when,
                tEnd,
                note.pitch,
                note.velocity,
                voice,
                bpmRef.current,
              );
            } catch {
              scheduled.delete(key);
            }
            continue;
          }

          if (studioTrackIsHumCaptureChannel(tr)) {
            try {
              scheduleSe2HumCaptureNote(
                ctx,
                stripIn,
                when,
                tEnd,
                note.pitch,
                note.velocity,
                tr.humCaptureInstrumentId ?? 'piano',
                tr.humCaptureTranspose ?? 0,
              );
            } catch {
              scheduled.delete(key);
            }
            continue;
          }

          if (studioTrackIsGuitarChannel(tr)) {
            try {
              scheduleSe2GuitarNote(
                ctx,
                resolveSe2GuitarAudioForTrack(ctx, ti, stripIn, tr),
                when,
                tEnd,
                note.pitch,
                note.velocity,
                tr.guitarInstrumentId ?? 'electric_guitar_clean',
                tr.guitarTranspose ?? 0,
              );
            } catch {
              scheduled.delete(key);
            }
            continue;
          }

          if (studioTrackIsBeatPadsChannel(tr)) {
            try {
              const bpTr = tr as Se2BeatPadsTrack;
              const kitId = bpTr.beatPadsProducerKitId ?? 'trapDarkVault';
              const sig = se2BeatPadsStoreSignature(tr.id);
              const cached = studioBeatPadsTrackSessionsRef.current.get(tr.id);
              const session =
                cached && cached.sig === sig && cached.kitId === kitId ? cached.session : null;
              if (
                session &&
                triggerSe2BeatPadsMidiPitch(session, note.pitch, ctx, note.velocity, when, stripIn, {
                  sessionBpm: bpmRef.current,
                  trackVolume127: trackVolumesRef.current[ti] ?? MIXER_UNITY_VOL,
                })
              ) {
                /* beat pads sample */
              } else {
                playScheduledMidiNote(ctx, stripIn, when, tEnd, note.pitch, note.velocity / 127, ti);
              }
            } catch {
              scheduled.delete(key);
            }
            continue;
          }

          const leadId = studioParseGrooveLeadInstrumentId(tr.midiInstrumentId);
          const orchHitId = studioParseOrchestraHitInstrumentId(tr.midiInstrumentId);
          const orchDef = orchHitId ? getOrchestraHitDef(orchHitId) : undefined;
          try {
            if (leadId) {
              if (
                !studioPlayGrooveLeadOnPreviewBus(
                  ctx,
                  stripIn,
                  leadId,
                  when,
                  note.pitch,
                  note.velocity / 127,
                  64,
                  false,
                  MIXER_UNITY_VOL,
                  bpmRef.current,
                  note.durationBeats,
                )
              ) {
                playScheduledMidiNote(ctx, stripIn, when, tEnd, note.pitch, note.velocity / 127, ti);
              }
            } else if (orchDef) {
              void studioPreloadOrchestraHitInstrument(ctx, tr.midiInstrumentId);
              if (
                !studioPlayOrchestraHitOnPreviewBus(
                  ctx,
                  stripIn,
                  orchDef,
                  when,
                  note.pitch,
                  note.velocity / 127,
                  64,
                  false,
                  MIXER_UNITY_VOL,
                )
              ) {
                playScheduledMidiNote(ctx, stripIn, when, tEnd, note.pitch, note.velocity / 127, ti);
              }
            } else if (
              scheduleStudioEditor2MidiInstrumentNote({
                ctx,
                stripIn,
                trackIndex: ti,
                instrumentId: tr.midiInstrumentId,
                midi: note.pitch,
                velocity: note.velocity,
                when,
                durationSec: Math.max(0.04, tEnd - when),
                bpm: bpmRef.current,
              })
            ) {
              /* GM / 808 / synth from track instrument dropdown */
            } else {
              const drumSession =
                studioTrackIsDrumChannel(tr) &&
                !studioTrackIsBeatPadsChannel(tr) &&
                tr.drumProducerKitId
                  ? studioDrumTrackSessionsRef.current.get(tr.id)?.session
                  : undefined;
              const resolvedDrumSession =
                drumSession ??
                (studioTrackIsDrumChannel(tr) &&
                !studioTrackIsBeatPadsChannel(tr) &&
                tr.drumProducerKitId
                  ? studioDrumKitSessionsRef.current.get(tr.drumProducerKitId)
                  : undefined);
              if (
                !resolvedDrumSession ||
                !triggerPianoRollDrumPad(
                  resolvedDrumSession,
                  pianoRollPadIndexForMidi(note.pitch),
                  ctx,
                  note.velocity,
                  when,
                  stripIn,
                )
              ) {
                playScheduledMidiNote(ctx, stripIn, when, tEnd, note.pitch, note.velocity / 127, ti);
              }
            }
            const access = studioMidiAccessRef.current;
            if (access) {
              const hwOuts = studioListHardwareMidiOutputs(access, midiPortRoutingRef.current);
              if (hwOuts.length > 0) {
                const midiCh = studioMidiChannelForTrack(ti, tracks);
                const hwKey = `${tr.id}:${ni}:${when}`;
                if (!midiHardwareScheduledRef.current.has(hwKey)) {
                  midiHardwareScheduledRef.current.add(hwKey);
                  studioScheduleHardwareMidiNote(
                    hwOuts,
                    midiCh,
                    note.pitch,
                    note.velocity,
                    performance.now() + (when - ctx.currentTime) * 1000,
                    performance.now() + (tEnd - ctx.currentTime) * 1000,
                  );
                }
              }
            }
          } catch {
            scheduled.delete(key);
          }
        }
      }
    }
  }, [studioBeatPadsSessionForTrack]);

  const refillAudioPreview = useCallback(
    (ctx: AudioContext, ctSnap: number, opts?: { loopContinuation?: boolean }) => {
      if (!runningRef.current) return;
      const bus = midiPreviewBusRef.current;
      if (!bus || ctx.state === 'closed') return;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
        return;
      }
      const spb = spbFromBpm(bpmRef.current);
      const origin = originBeatRef.current;
      const sessionStart = sessionStartRef.current;
      if (sessionStart <= 0) return;
      const horizon = ctSnap + METRO_SCHEDULE_AHEAD_SEC;
      const tracks = studioTracksRef.current;
      const carrierTracks = studioEditorVocoderCarrierTracks(tracks);
      const trackFx = trackFxSlotsRef.current;
      const scheduled = audioPreviewScheduledRef.current;
      const buffers = studioAudioBuffersRef.current;
      const tracking = scheduledPreviewAudioClipsRef.current;
      const loopOn = loopOnRef.current;
      const loopStart = loopStartBeatRef.current;
      const loopEnd = loopEndBeatRef.current;
      const loopSpan = loopEnd - loopStart;
      const loopLap = midiPreviewLoopLapRef.current;
      /* Only trim/repeat into braces after transport has entered the loop (not while approaching). */
      const loopCommitted =
        loopOn && loopSpan > 1e-6 && origin >= loopStart - 1e-6;

      se2PurgeDeadAudioPreviewScheduleKeys(scheduled, tracking, ctx);

      for (let ti = 0; ti < tracks.length; ti++) {
        const tr = tracks[ti];
        if (tr.audioClips.length === 0) continue;
        if (tr.kind !== 'audio' && tr.kind !== 'trackAlign' && tr.kind !== 'a2m' && tr.kind !== 'synthGeno') continue;
        const muted = se2EffectiveTrackMuted(ti, trackMutesRef.current, trackSolosRef.current);
        if (muted) continue;
        const fxSlots = trackFx[ti] ?? emptyMixerFxSlots();
        const rawFx = trackVocalFxRef.current[ti] ?? STUDIO_TRACK_VOCAL_FX_DEFAULT;
        const effectiveFx = studioEffectiveTrackVocalFx(rawFx, fxSlots);
        const vocalFx = studioTrackVocalFxActive(effectiveFx);
        const keyRoot = tr.a2mKeyRoot != null ? tr.a2mKeyRoot : songKeyRootRef.current;

        let playbackBus = getStudioTrackClipPlaybackBus(ti);
        if (isStudioMixerStripGraphPlaybackLocked()) {
          if (!playbackBus) {
            playbackBus = healStudioTrackPlaybackRouteIfStale(
              ctx,
              bus,
              ti,
              getStudioMixerStripCountHint(),
              studioMasterOutRef.current ?? ctx.destination,
            );
          }
        }
        if (!playbackBus) {
          se2TrackPlaybackInput(
            ctx,
            bus,
            ti,
            trackFxSlotsRef.current[ti] ?? emptyMixerFxSlots(),
            trackInsertFxRacksRef.current[ti] ?? defaultStudioTrackInsertFxRack(),
            bpmRef.current,
            studioMasterOutRef.current ?? ctx.destination,
          );
          playbackBus = getStudioTrackClipPlaybackBus(ti);
        }
        if (!playbackBus) continue;

        const panMs = trackPansRef.current[ti] ?? 64;
        const monoT = trackMonosRef.current[ti] ?? false;
        const faderV = trackVolumesRef.current[ti] ?? MIXER_UNITY_VOL;
        applyStudioMixerStripMix(ti, {
          muted,
          vol127: faderV,
          pan127: panMs,
          mono: monoT,
        });

        for (const clip of tr.audioClips) {
          const dryBuf = buffers.get(clip.sourceId);
          if (!dryBuf) continue;
          /* Dry buffer → vocal entry → live Pitch Tune / Vocoder (same path as mic). */
          const useLiveVocalFx = Boolean(vocalFx && studioUseLiveVocalFxPlayback(effectiveFx));
          const timeStretchAlign = se2ClipUsesAlignStretchPlayback(tr.kind, clip);
          const sourceOffsetBeats = se2AudioClipSourceOffsetBeats(clip);
          const occurrences = se2AudioClipLoopOccurrences({
            clipStartBeat: clip.startBeat,
            clipDurationBeats: clip.durationBeats,
            sourceOffsetBeats,
            originBeat: origin,
            sessionStart,
            spb,
            ctSnap,
            horizon,
            loopOn,
            loopStartBeat: loopStart,
            loopEndBeat: loopEnd,
          });

          for (const occ of occurrences) {
            const inLoopRegion =
              loopCommitted &&
              se2AudioClipIntersectsLoopRegion({
                clipStartBeat: clip.startBeat,
                clipDurationBeats: clip.durationBeats,
                loopStartBeat: loopStart,
                loopEndBeat: loopEnd,
              });
            const key = inLoopRegion
              ? se2AudioClipPreviewScheduleKeyLoopLap(
                  loopLap,
                  tr.id,
                  clip.id,
                  occ.repeatInLap,
                  timeStretchAlign,
                )
              : se2AudioClipPreviewScheduleKey(tr.id, clip, timeStretchAlign);

            const segOffset = occ.segStartBeat - loopStart;
            const isLoopDownbeat = inLoopRegion && segOffset < 1e-6;
            const gate = se2GateAudioPreviewOccurrence({
              scheduled,
              tracking,
              key,
              ctx,
              occ,
              ctSnap,
              opts,
              inLoopRegion,
              isLoopDownbeat,
            });
            if (gate === 'skip') continue;

            scheduled.add(key);

            const segDurBeats = occ.segEndBeat - occ.segStartBeat;
            try {
              scheduleAudioClipOnPreviewBus({
                ctx,
                bus: playbackBus,
                buffer: dryBuf,
                tClipStart: occ.tOn,
                tClipEnd: occ.tOff,
                tScheduleFrom: ctSnap + 0.002,
                pan127: panMs,
                monoTrack: monoT,
                faderVol127: faderV,
                tracking,
                insertSlots: fxSlots,
                insertRack: trackInsertFxRacksRef.current[ti],
                bpm: bpmRef.current,
                pitchMonitorTrackIndex: ti,
                useLiveVocalFx,
                vocalFx: useLiveVocalFx ? effectiveFx : undefined,
                keyRoot,
                vocalTrackIndex: ti,
                carrierTracks,
                clipStartBeat: occ.occurrenceStartBeat,
                clipDurationBeats: segDurBeats,
                sourceOffsetSec: occ.sourceOffsetBeats * spb,
                clipWallDurationSec: segDurBeats * spb,
                timeStretchAlign,
                alignLockedStretchRate: clip.alignWallStretchRate,
                scheduleKey: key,
                gainDb: clip.gainDb,
              });
            } catch {
              scheduled.delete(key);
            }
          }
        }
      }
    },
    [],
  );

  /** After tab-focus ctx.resume — re-anchor clocks and top up lookahead without killing live WAV clips. */
  const resyncSe2PreviewAfterCtxResume = useCallback(
    (ctx: AudioContext) => {
      if (!runningRef.current || ctx.state !== 'running') return;
      const now = performance.now();
      if (now - se2LastCtxResumeResyncMsRef.current < 500) return;
      se2LastCtxResumeResyncMsRef.current = now;
      const t = audioNow(ctx);
      perfSessionStartMsRef.current = performance.now() + (sessionStartRef.current - t) * 1000;
      schedAnchorTimeRef.current = t;
      schedAnchorPerfRef.current = performance.now();
      se2PurgeDeadAudioPreviewScheduleKeys(
        audioPreviewScheduledRef.current,
        scheduledPreviewAudioClipsRef.current,
        ctx,
      );
      midiPreviewScheduledRef.current.clear();
      silenceSe2SynthPreviewVoices();
      refillMetronome(ctx, t);
      refillMidiPreview(ctx, t);
      refillAudioPreview(ctx, t);
    },
    [refillAudioPreview, refillMetronome, refillMidiPreview, silenceSe2SynthPreviewVoices],
  );

  const refillMetroLoopContinuation = useCallback(
    (ctx: AudioContext, tCapture: number) => {
      refillMetronome(ctx, tCapture, { loopContinuation: true });
    },
    [refillMetronome],
  );

  const refillLoopPreviewOnce = useCallback(
    (ctx: AudioContext, tCapture: number) => {
      refillMetronome(ctx, tCapture, { loopContinuation: true });
      refillMidiPreview(ctx, tCapture, { loopContinuation: true });
      refillAudioPreview(ctx, tCapture, { loopContinuation: true });
    },
    [refillAudioPreview, refillMetronome, refillMidiPreview],
  );

  const runLoopPreviewSpliceRefill = useCallback(
    (ctxLoop: AudioContext, tCapture: number) => {
      cancelScheduledMetroNodes();
      const prevLap = midiPreviewLoopLapRef.current;
      const nextLap = prevLap + 1;
      midiPreviewLoopLapRef.current = nextLap;
      const ctRefill = Math.max(tCapture, audioNow(ctxLoop));
      /*
       * Keep not-yet-started lookahead BufferSources (next downbeat) and re-key them
       * onto the new lap. Killing them then re-scheduling late chops the audible start
       * via timelineOffSec. Only stop prev-lap clips that already began.
       */
      studioMidiPreviewPurgeLoopLapKeys(midiPreviewScheduledRef.current, prevLap);
      /* Approach used full-clip (non-lap) keys — must clear or wrap stacks under lap slices. */
      se2AudioPreviewPurgeNonLapKeys(audioPreviewScheduledRef.current);
      midiHardwareScheduledRef.current.clear();

      const loopStart = loopStartBeatRef.current;
      const loopEnd = loopEndBeatRef.current;
      const span = loopEnd - loopStart;
      if (span > 1e-6 && sessionStartRef.current > 0) {
        const spb = spbFromBpm(bpmRef.current);
        const beatNow =
          originBeatRef.current + Math.max(0, tCapture - sessionStartRef.current) / spb;
        lastMetroLoopLapRef.current = Math.max(
          lastMetroLoopLapRef.current,
          se2MetroLoopLapIndex(beatNow, loopStart, span),
        );
      }

      /*
       * Adopt future lookahead onto the new lap *before* purging/stopping prev-lap keys,
       * so the next downbeat BufferSource survives wrap with a live dedupe key.
       */
      se2AudioPreviewAdoptFutureLoopLapClips(
        scheduledPreviewAudioClipsRef.current,
        audioPreviewScheduledRef.current,
        prevLap,
        nextLap,
        ctRefill,
      );
      stopScheduledPreviewAudioClipsForLoopLap(
        scheduledPreviewAudioClipsRef.current,
        prevLap,
        ctRefill,
      );
      se2AudioPreviewPurgeLoopLapKeys(audioPreviewScheduledRef.current, prevLap);
      stopScheduledPreviewAudioClipsNonLap(scheduledPreviewAudioClipsRef.current);
      silenceSe2SynthPreviewVoices();
      refillLoopPreviewOnce(ctxLoop, ctRefill);
      queueMicrotask(() => {
        if (!runningRef.current) return;
        const ctx = ctxRef.current;
        if (!ctx || ctx.state === 'closed') return;
        refillLoopPreviewOnce(ctx, Math.max(0, ctx.currentTime));
      });
    },
    [cancelScheduledMetroNodes, refillLoopPreviewOnce, silenceSe2SynthPreviewVoices],
  );

  const runMetroGridLoopSplice = useCallback(
    (ctxLoop: AudioContext, tWrap: number): { bDisplay: number } | null => {
      if (!loopOnRef.current) return null;
      const loopStart = loopStartBeatRef.current;
      const loopEnd = loopEndBeatRef.current;
      if (loopEnd <= loopStart) return null;

      const tb = totalBeatsRef.current;
      const { bDisplay } = applySe2MetroGridLoopSplice(
        ctxLoop,
        tWrap,
        loopStart,
        bpmRef.current,
        tb,
        {
          sessionStartRef,
          schedAnchorTimeRef,
          schedAnchorPerfRef,
          perfSessionStartMsRef,
          originBeatRef,
          cursorBeatRef,
          displayBeatRef,
          nextMetroKRef,
        },
      );

      runLoopPreviewSpliceRefill(ctxLoop, Math.max(tWrap, audioNow(ctxLoop)));
      const span = loopEnd - loopStart;
      if (span > 1e-6) {
        const spb = spbFromBpm(bpmRef.current);
        const beatNow =
          originBeatRef.current + Math.max(0, tWrap - sessionStartRef.current) / spb;
        lastCompositorLoopLapRef.current = Math.max(
          lastCompositorLoopLapRef.current,
          se2MetroLoopLapIndex(beatNow, loopStart, span),
        );
      }
      return { bDisplay };
    },
    [runLoopPreviewSpliceRefill],
  );

  /**
   * Loop wrap is metronome-led: after bar N (beat `loopEnd`), before bar N+1 click,
   * re-anchor on the exact grid time — not compositor cycle phase.
   */
  const maybeSe2MetroLoopWrap = useCallback(
    (ctx: AudioContext, ctSnap: number): boolean => {
      if (insideMetroLoopSpliceRef.current) return false;
      if (!runningRef.current || !loopOnRef.current) return false;
      if (se2ShouldIgnoreLoopWrap(transportPlayStartPerfMsRef.current)) return false;

      const loopStart = loopStartBeatRef.current;
      const loopEnd = loopEndBeatRef.current;
      const span = loopEnd - loopStart;
      if (span <= 1e-6) return false;

      const spb = spbFromBpm(bpmRef.current);
      const origin = originBeatRef.current;
      const sessionStart = sessionStartRef.current;
      if (sessionStart <= 0) return false;

      const beatNow = origin + Math.max(0, ctSnap - sessionStart) / spb;
      const tWrap = se2LoopWrapGridTime(sessionStart, origin, loopEnd, spb);
      let lapIndex = se2MetroLoopLapIndex(beatNow, loopStart, span);

      const nextK = nextMetroKRef.current;
      const atWrapGrid = ctSnap >= tWrap - 0.002;
      const nextClickIsLoopTop = nextK >= loopEnd && ctSnap >= tWrap - 0.05;
      if (!atWrapGrid && !nextClickIsLoopTop) return false;
      if (nextClickIsLoopTop && lapIndex < 1) lapIndex = 1;
      if (lapIndex <= lastMetroLoopLapRef.current) return false;

      insideMetroLoopSpliceRef.current = true;
      try {
        const result = runMetroGridLoopSplice(ctx, tWrap);
        if (result) {
          lastMetroLoopLapRef.current = lapIndex;
          return true;
        }
      } finally {
        insideMetroLoopSpliceRef.current = false;
      }
      return false;
    },
    [runMetroGridLoopSplice],
  );

  maybeSe2MetroLoopWrapRef.current = maybeSe2MetroLoopWrap;

  const updateReadouts = useCallback((displayBeats: number, pausedLabel: boolean) => {
    const db = quantizeSe2DisplayBeatForReadout(displayBeats);
    const parts = formatBarsBeatsTickParts(db, beatsPerBarRef.current);
    const sec = (db / Math.max(1, bpmRef.current)) * 60;
    const timeParts = formatTimeMmSsFfParts(sec);
    paintSe2BarsReadoutSegments(
      {
        bar: barsBarReadoutRef.current,
        beat: barsBeatReadoutRef.current,
        tick: barsTickReadoutRef.current,
        pause: barsPauseReadoutRef.current,
      },
      parts,
      pausedLabel,
    );
    paintSe2TimeReadoutSegments(
      {
        minutes: timeMinReadoutRef.current,
        seconds: timeSecReadoutRef.current,
        frames: timeFrameReadoutRef.current,
      },
      timeParts,
    );
  }, []);

  /** Wire every track's playback/FX output into its mixer strip (required for VU + insert FX). */
  const primeSe2MixerStripRoutes = useCallback(
    (ctx: AudioContext, bus: GainNode, masterOut: AudioNode) => {
      const tracks = studioTracksRef.current;
      for (let ti = 0; ti < tracks.length; ti++) {
        se2TrackPlaybackInput(
          ctx,
          bus,
          ti,
          trackFxSlotsRef.current[ti] ?? emptyMixerFxSlots(),
          trackInsertFxRacksRef.current[ti] ?? defaultStudioTrackInsertFxRack(),
          bpmRef.current,
          masterOut,
        );
      }
    },
    [],
  );

      /** Peak meters — track-lane IN bars always; mixer strip VU when panel open. */
  const paintMixerMeters = useCallback(() => {
    const meterT0 = performance.now();
    try {
    const ctx = ctxRef.current;
    const bus = midiPreviewBusRef.current;
    const meterActive = Boolean(ctx && ctx.state !== 'closed' && bus);
    const paintMixerStrips = showMixerRef.current;
    const dt = studioMixerMeterFrameDt();
    const tracks = studioTracksRef.current;

    for (let ti = 0; ti < tracks.length; ti++) {
      const isAudio = tracks[ti]?.kind === 'audio';
      /* Lane IN + mixer VU. During transport, strip bus uses worklet peaks (no analyser pulls). */
      const needsMeterRead = meterActive && (paintMixerStrips || isAudio);
      const muted = se2EffectiveTrackMuted(ti, trackMutesRef.current, trackSolosRef.current);
      const vol127 = trackVolumesRef.current[ti] ?? MIXER_UNITY_VOL;
      const pan127 = trackPansRef.current[ti] ?? 64;
      const monoT = trackMonosRef.current[ti] ?? false;
      applyStudioMixerStripMix(ti, { muted, vol127, pan127, mono: monoT });

      let laneL = 0;
      let laneR = 0;
      let mixL = 0;
      let mixR = 0;
      if (needsMeterRead) {
        // One strip peak read per track (worklet consume) — lane + mixer share it.
        const snap = readStudioMixerStripMeter(ti);
        if (snap) {
          if (isAudio) {
            laneL = snap.peakL;
            laneR = monoT ? snap.peakL : snap.peakR;
          }
          if (paintMixerStrips) {
            mixL = muted ? 0 : snap.peakL;
            mixR = muted ? 0 : monoT ? snap.peakL : snap.peakR;
          }
        }
        // Paused only: pre-fader IN tap (analyser) if hotter — never call strip meter twice.
        if (isAudio) {
          const inputSnap = readStudioMixerStripInputMeter(ti);
          if (inputSnap && inputSnap.linearPeak > Math.max(laneL, laneR)) {
            laneL = inputSnap.peakL;
            laneR = monoT ? inputSnap.peakL : inputSnap.peakR;
          }
        }
      }
      // Shared ballistics when mixer closed (lane only). Separate lane slot when mixer open.
      const laneDisp = studioMixerMeterBallisticsStep(
        paintMixerStrips ? ti + 10_000 : ti,
        laneL,
        laneR,
        dt,
      );
      const mixDisp = paintMixerStrips
        ? studioMixerMeterBallisticsStep(ti, mixL, mixR, dt)
        : null;

      if (isAudio) {
        paintSe2TrackLaneMeterBar(trackLaneMeterLsRef.current[ti], laneDisp.l, false, 'L');
        if (!monoT) {
          paintSe2TrackLaneMeterBar(trackLaneMeterRsRef.current[ti], laneDisp.r, false, 'R');
        } else if (trackLaneMeterRsRef.current[ti]) {
          paintSe2TrackLaneMeterBar(trackLaneMeterRsRef.current[ti], 0, false, 'R');
        }
        paintSe2TrackLaneMeterShell(
          trackLaneMeterShellRef.current[ti],
          Math.max(laneDisp.l, laneDisp.r) > 0.02,
        );
      }

      if (!paintMixerStrips || !mixDisp) continue;

      paintStudioMixerMeterBar(mixerMeterLsRef.current[ti], mixDisp.l, meterFillGradient, muted);
      paintStudioMixerMeterBar(mixerMeterRsRef.current[ti], mixDisp.r, meterFillGradient, muted);
    }

    if (!paintMixerStrips) return;

    const masterSnap = meterActive ? readStudioMasterBusMeter() : null;
    const monitorLinear = mixerVolToLinearGain(masterVolumeRef.current);
    const masterTargetL = studioMixerMonitorLinear(masterSnap?.peakL ?? 0, monitorLinear);
    const masterTargetR = studioMixerMonitorLinear(masterSnap?.peakR ?? 0, monitorLinear);
    const masterDisp = studioMixerMeterBallisticsStep(
      STUDIO_MIXER_MASTER_TRACK_INDEX,
      masterTargetL,
      masterTargetR,
      dt,
    );
    paintStudioMixerMeterBar(mixerMasterLRef.current, masterDisp.l, meterFillGradient);
    paintStudioMixerMeterBar(mixerMasterRRef.current, masterDisp.r, meterFillGradient);
    } finally {
      reportSe2MeterPaintWorkMs(performance.now() - meterT0);
    }
  }, []);

  /** Core animation tick — called directly from the RAF loop with the browser's vsync timestamp.
   * Using rafTime (not performance.now()) gives hardware-vsync-aligned motion, the web equivalent
   * of CVDisplayLink used by the reference macOS app.
   *
   * READ Ã¢â€ â€™ COMPUTE Ã¢â€ â€™ WRITE order prevents layout thrashing:
   *   1. Read scroll state (layout reads) first
   *   2. Compute beat + pixel position
   *   3. Write transforms + scroll (layout writes)
   */
  const animationTick = useCallback((_rafTime: number) => {
    if (!runningRef.current && !isScreenActiveRef.current) return;

    const actxForAnchor = ctxRef.current;
    if (runningRef.current && actxForAnchor && actxForAnchor.state === 'running') {
      updateSchedAnchor(actxForAnchor, schedAnchorTimeRef, schedAnchorPerfRef);
    }

    const tb  = totalBeatsRef.current;
    const z   = timelineZoomRef.current;
    const bpb = beatsPerBarRef.current;
    const ppb = ppbAtZoom(z, bpb);
    const stripW = TOTAL_WIDTH_PX * z;

    /* â”€â”€ 1. READ beat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     *
     *  Two beat values serve two different purposes:
     *
     *  b         â€“ visual beat, read from the WAAPI compositor animation.
     *              Drives the scroll position (keepin the line centred on screen)
     *              and the loop-boundary check.  WAAPI is on the compositor thread
     *              so it is always smooth regardless of main-thread load.
     *
     *  bDisplay  â€“ display beat, computed from the AUDIO CLOCK (ctx.currentTime
     *              extrapolated via schedAnchorTimeRef/schedAnchorPerfRef).
     *              This is the same clock the metronome uses, so the bar/beat counter
     *              rolls over at exactly the same instant as each metronome click.
     *              Falls back to b when the audio context isn't ready.
     * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    const wapiAnim = playheadWapiRef.current;
    let b: number;
    let bDisplay: number;

    if (runningRef.current && wapiAnim && wapiAnim.playState !== 'idle') {
      /* Visual beat from WAAPI */
      const animMs = Number(wapiAnim.currentTime ?? 0);
      const bpmUsed = wapiBpmRef.current;
      const seg = wapiSegLoopRef.current;
      const loopEndBeat = loopEndBeatRef.current;
      const loopStart = loopStartBeatRef.current;

      /* Loop region grew (e.g. 8-bar harmony apply) but WAPI segment still 1 bar — resync or chops die after beat 4. */
      if (
        loopOnRef.current &&
        seg.active &&
        (seg.loopEndBeat !== loopEndBeat || seg.loopStartBeat !== loopStart)
      ) {
        launchWapiAnims(cursorBeatRef.current, true);
        return;
      }

      const seamless =
        seg.seamlessLoop &&
        loopOnRef.current &&
        seg.active &&
        loopEndBeat > loopStart &&
        loopEndBeatRef.current === seg.loopEndBeat &&
        loopStartBeatRef.current === seg.loopStartBeat;

      if (seamless) {
        const d = Math.max(1e-9, seg.durMs);
        const span = seg.loopEndBeat - seg.loopStartBeat;
        const phaseMs = ((animMs % d) + d) % d;
        b = seg.loopStartBeat + (phaseMs / d) * span;
      } else if (seg.active && loopOnRef.current) {
        const d = Math.max(1e-9, seg.durMs);
        const tClamped = Math.max(0, Math.min(seg.durMs, animMs));
        const span = seg.loopEndBeat - seg.loopStartBeat;
        b = Math.min(seg.loopEndBeat, Math.max(seg.loopStartBeat, seg.loopStartBeat + (tClamped / d) * span));
      } else {
        b = Math.max(0, Math.min(tb, animMs / 1000 * (bpmUsed / 60)));
      }

      /* Display beat from audio clock â€” locked to metronome */
      const actx = ctxRef.current;
      if (actx && actx.state === 'running' && schedAnchorTimeRef.current > 0) {
        const tSmooth = smoothSchedNow(schedAnchorTimeRef, schedAnchorPerfRef, actx);
        bDisplay = Math.max(0, Math.min(tb,
          originBeatRef.current + (tSmooth - sessionStartRef.current) * (bpmRef.current / 60),
        ));
      } else {
        bDisplay = b;
      }

      if (seamless && loopEndBeat > loopStart) {
        const span = loopEndBeat - loopStart;
        bDisplay = loopStart + (((bDisplay - loopStart) % span) + span) % span;
      }

      const loopWrap = se2AnimationTickLoopWrap({
        ctx: actx && actx.state !== 'closed' ? actx : null,
        animMs,
        wapiPlayState: wapiAnim.playState,
        b,
        bDisplay,
        totalBeats: tb,
        bpm: bpmRef.current,
        loopOn: loopOnRef.current,
        loopStartBeat: loopStart,
        loopEndBeat,
        seg,
        playStartPerfMs: transportPlayStartPerfMsRef.current,
        refs: {
          sessionStartRef,
          schedAnchorTimeRef,
          schedAnchorPerfRef,
          perfSessionStartMsRef,
          originBeatRef,
          cursorBeatRef,
          displayBeatRef,
          nextMetroKRef,
        },
        wapiLoopCycleSeenRef,
        wapiPrevPhaseMsRef,
        lastCompositorLoopLapRef,
        onSeamlessSplice: (ctxLoop, tCapture) => {
          runLoopPreviewSpliceRefill(ctxLoop, tCapture);
          /*
           * Do NOT cancel/reanchor follow WAAPI on seamless laps — that kills the
           * infinite compositor glide and falls back to per-frame JS follow (shake),
           * and clearing the paint window blanks the grid/audio at loop start.
           * Soft-rearm the bitmap at the loop-start virt only.
           */
          const scrollEl = timelineHScrollRef.current;
          if (scrollEl) {
            const z = timelineZoomRef.current;
            const cw = scrollEl.clientWidth;
            if (cw > 0) {
              const pin = cw * TIMELINE_FOLLOW_PIN_RATIO;
              const ppb = ppbAtZoom(z, beatsPerBarRef.current);
              const maxSl = Math.max(0, TOTAL_WIDTH_PX * z - cw);
              const virt = Math.min(
                maxSl,
                Math.max(0, loopStartBeatRef.current * ppb - pin),
              );
              syncTimelineGridFollowAhead(z, virt);
            }
          }
        },
        onDiscreteWrap: (ctxLoop, tCapture) => runLoopPreviewSpliceRefill(ctxLoop, tCapture),
        relaunchPlaylineAtLoopStart: (ls) => {
          reanchorTimelineFollowAtBeat(ls, { relaunchWapi: true });
        },
      });
      b = loopWrap.b;
      bDisplay = loopWrap.bDisplay;
      cursorBeatRef.current = b;
      displayBeatRef.current = bDisplay;
    } else {
      b = cursorBeatRef.current;
      bDisplay = b;
      displayBeatRef.current = b;
    }

    /* ── 2. READ layout state ── */
    const scrollEl    = timelineHScrollRef.current;
    const scrollLeft  = scrollEl ? scrollEl.scrollLeft : 0;
    const clientWidth = scrollEl ? scrollEl.clientWidth : 0;

    /* â”€â”€ 3. COMPUTE pixel positions (scroll + inner-line correction only) */
    const bClamped   = Math.max(0, Math.min(b, tb));
    const lineCenter = bClamped * ppb;

    /*
     * Transform-only follow — scrollLeft frozen; strip translate glides the grid under a
     * viewport-pinned playhead (no scrollLeft / canvas margin fights).
     */
    if (!runningRef.current) {
      /* Never auto-commit a Stop-parked follow translate — that jerks the grid. */
      if (timelineEdgeFollowActiveRef.current && !timelineFollowParkedTransformRef.current) {
        clearTimelineEdgeFollow();
      }
    } else if (scrollEl && clientWidth > 0) {
      const pinPx = clientWidth * TIMELINE_FOLLOW_PIN_RATIO;
      const maxScroll = Math.max(0, Math.max(scrollEl.scrollWidth, stripW) - clientWidth);
      const targetScroll = Math.min(maxScroll, Math.max(0, lineCenter - pinPx));
      timelineProgrammaticScrollRef.current = true;
      /*
       * Prefer compositor follow WAAPI — do not overwrite transform from JS every frame
       * (that was the grid pause when canvas refill blocked the main thread).
       */
      let virtualScroll: number;
      let offset: number;
      const wapiOff = readTimelineFollowWapiOffset();
      const followRunning =
        wapiOff != null
        && timelineFollowWapiLaneRef.current
        && (timelineFollowWapiLaneRef.current.playState === 'running'
          || timelineFollowWapiLaneRef.current.playState === 'finished');
      if (followRunning) {
        offset = wapiOff!;
        virtualScroll = timelineFollowTransformOriginRef.current + offset;
      } else {
        const jsFollow = applyTimelineTransformFollow(
          targetScroll,
          timelineStripRef.current,
          timelineRulerStripRef.current,
          timelineFollowContentRef.current,
          timelineFollowTransformOriginRef,
        );
        virtualScroll = jsFollow.virtualScroll;
        offset = jsFollow.offset;
      }
      timelineFollowLastOffsetRef.current = offset;
      /* Loop needle only while WAAPI is in the brace segment — not while approaching a mid-song loop. */
      const loopPlaybackActive =
        loopOnRef.current && runningRef.current && wapiSegLoopRef.current.active;
      const mainPh = playheadGroupRef.current;
      const loopPh = loopPlayheadGroupRef.current;
      const visiblePhWapi = playheadVisibleWapiRef.current;
      const compositorPh =
        visiblePhWapi
        && (visiblePhWapi.playState === 'running' || visiblePhWapi.playState === 'finished');
      if (loopPlaybackActive) {
        if (mainPh) {
          mainPh.style.visibility = 'hidden';
          mainPh.style.pointerEvents = 'none';
        }
        if (loopPh) {
          loopPh.style.visibility = 'visible';
          /* Loop head is WAAPI-driven when launched; JS left only as fallback. */
          if (!loopPlayheadVisibleWapiRef.current || loopPlayheadVisibleWapiRef.current.playState === 'idle') {
            positionLoopRegionPlayheadGroup(
              loopPh,
              loopPlayheadLineRef.current,
              bClamped,
              z,
              bpb,
            );
          }
        }
      } else {
        if (mainPh) {
          mainPh.style.visibility = '';
          mainPh.style.pointerEvents = 'none';
        }
        if (loopPh) loopPh.style.visibility = 'hidden';
        timelineFollowPinAppliedRef.current = true;
        /* Do not write left/transform every frame — compositor playhead owns motion. */
        if (!compositorPh) {
          positionTimelinePlayheadGroup(
            mainPh,
            playheadLineRef.current,
            bClamped,
            z,
            bpb,
          );
        }
      }
      timelineFollowIntScrollRef.current = scrollEl.scrollLeft;
      timelineFollowPinScreenXRef.current = pinPx;
      timelineEdgeFollowActiveRef.current = true;
      const paintEnd = timelineFollowPaintEndRef.current;
      const paintStart = timelineFollowPaintStartRef.current;
      const needsPaint =
        paintEnd <= 0 ||
        virtualScroll + clientWidth >= paintEnd - TIMELINE_FOLLOW_PAINT_REARM_PX ||
        /* Loop wrap / seek can jump behind the painted slice. */
        virtualScroll < paintStart - 0.5;
      if (needsPaint && !timelineFollowPaintRafRef.current) {
        const paintZ = z;
        const paintScroll = virtualScroll;
        /*
         * Paint off the transport rAF — strip follow is WAAPI so motion keeps gliding.
         * Full waveform draw path unchanged (no lite peaks).
         */
        timelineFollowPaintRafRef.current = window.setTimeout(() => {
          timelineFollowPaintRafRef.current = 0;
          syncTimelineGridFollowAhead(paintZ, paintScroll);
        }, 0) as unknown as number;
      }
    }

    /* Live take clip is WAAPI-driven (launchLiveRecordClipWapi) — do not write width here. */

    /* Bar/time readouts use the audio-clock beat so they roll over with the metronome. */
    const bReadout = quantizeSe2DisplayBeatForReadout(bDisplay);
    const barParts = formatBarsBeatsTickParts(bReadout, bpb);
    const sec  = (bReadout / Math.max(1, bpmRef.current)) * 60;
    const timeParts = formatTimeMmSsFfParts(sec);

    /* --- 4. WRITE — readouts only; grid scroll is handled above during follow --- */
    if (!runningRef.current && scrollEl) {
      /*
       * Do NOT auto-scroll the timeline while stopped — that yanks the view back to the
       * playhead when the user has scrolled ahead (60–100+ bars) and is trying to click.
       * Only reposition the playhead for the current scrollLeft.
       */
      if (performance.now() >= timelineUserSeekGuardUntilRef.current) {
        positionTimelinePlayheadGroup(
          playheadGroupRef.current,
          playheadLineRef.current,
          cursorBeatRef.current,
          z,
          bpb,
          scrollLeft,
        );
      }
    }

    paintSe2BarsReadoutSegments(
      {
        bar: barsBarReadoutRef.current,
        beat: barsBeatReadoutRef.current,
        tick: barsTickReadoutRef.current,
        pause: barsPauseReadoutRef.current,
      },
      barParts,
      !runningRef.current,
    );
    paintSe2TimeReadoutSegments(
      {
        minutes: timeMinReadoutRef.current,
        seconds: timeSecReadoutRef.current,
        frames: timeFrameReadoutRef.current,
      },
      timeParts,
    );

    if (!runningRef.current) {
      syncTimelineGridNow(z);
    }

  }, [
    clearTimelineEdgeFollow,
    launchWapiAnims,
    reanchorTimelineFollowAtBeat,
    readTimelineFollowWapiOffset,
    runLoopPreviewSpliceRefill,
    syncTimelineGridFollowAhead,
    syncTimelineGridNow,
  ]);

  const paintTransport = useCallback(() => {
    animationTick(performance.now());
  }, [animationTick]);

  /** Keep mixer strip graph alive for track-lane input meters (even when mixer panel is closed). */
  useEffect(() => {
    if (!isScreenActive) return;
    if (!studioTracks.some((t) => t.kind === 'audio')) return;
    let cancelled = false;
    void (async () => {
      const ctx = await ensureCtx();
      if (cancelled || ctx.state === 'closed') return;
      const bus = midiPreviewBusRef.current;
      if (!bus) return;
      const downstream = studioMasterOutRef.current ?? ctx.destination;
      if (!runningRef.current && !transportArmingRef.current) {
        ensureSe2MixerStrips(ctx, bus, downstream);
        primeSe2MixerStripRoutes(ctx, bus, downstream);
      }
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          /* autoplay */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isScreenActive, studioMixerRouteSig, ensureCtx, primeSe2MixerStripRoutes]);

  /** Poll track-lane + mixer VU meters while Studio Editor 2 is active (~30 Hz, lighter when mixer closed). */
  useEffect(() => {
    if (!isScreenActive) return;
    let raf = 0;
    let cancelled = false;
    let lastPaintMs = 0;
    void (async () => {
      const ctx = await ensureCtx();
      if (cancelled || ctx.state === 'closed') return;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          /* autoplay policy */
        }
      }
      const bus = midiPreviewBusRef.current;
      const masterOut = studioMasterOutRef.current;
      if (bus) {
        const downstream = masterOut ?? ctx.destination;
        if (!runningRef.current && !transportArmingRef.current) {
          ensureSe2MixerStrips(ctx, bus, downstream);
          primeSe2MixerStripRoutes(ctx, bus, downstream);
        }
      }
      if (cancelled) return;
      const loop = (now: number) => {
        if (cancelled) return;
        const playing = runningRef.current;
        const mixerOpen = showMixerRef.current;
        // Playing: ~10 Hz with mixer open, ~4 Hz lane-only (worklet peaks). Idle: faster for IN meters.
        const intervalMs = playing
          ? mixerOpen
            ? 100
            : 250
          : mixerOpen
            ? 33
            : 80;
        if (now - lastPaintMs >= intervalMs) {
          lastPaintMs = now;
          paintMixerMeters();
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [isScreenActive, paintMixerMeters, ensureCtx, primeSe2MixerStripRoutes]);

  /** Thin wrapper so the RAF loop can pass its vsync timestamp straight through. */
  const transportFrame = useCallback((rafTime: number) => {
    if (!runningRef.current && !isScreenActiveRef.current) return;
    const t0 = performance.now();
    animationTick(rafTime);
    if (runningRef.current) {
      reportSe2TransportFrameWorkMs(performance.now() - t0);
    }
  }, [animationTick]);

  /** Beat under the pointer — scroll host + scrollLeft (+ leftover strip translate). */
  const clientXToBeat = useCallback((clientX: number, clientY?: number): number => {
    const z = timelineZoomRef.current;
    const bpb = beatsPerBarRef.current;
    const ppb = ppbAtZoom(z, bpb);
    const tb = totalBeatsRef.current;
    const laneScroll = timelineHScrollRef.current;
    const rulerScroll = timelineRulerHScrollRef.current;
    const laneStrip = timelineStripRef.current;
    const rulerStrip = timelineRulerStripRef.current;

    let scrollEl = laneScroll ?? rulerScroll;
    let strip = laneStrip ?? rulerStrip;
    if (clientY != null && Number.isFinite(clientY)) {
      const rulerRect = rulerStrip?.getBoundingClientRect();
      const laneRect = laneStrip?.getBoundingClientRect();
      if (rulerRect && clientY >= rulerRect.top && clientY <= rulerRect.bottom) {
        scrollEl = rulerScroll ?? laneScroll;
        strip = rulerStrip ?? laneStrip;
      } else if (laneRect && clientY >= laneRect.top && clientY <= laneRect.bottom) {
        scrollEl = laneScroll ?? rulerScroll;
        strip = laneStrip ?? rulerStrip;
      }
    }

    return se2TimelineBeatFromClientX(clientX, scrollEl, ppb, tb, strip);
  }, []);

  const setBeatFromScrubClientX = useCallback(
    (
      clientX: number,
      opts?: {
        /** @deprecated use `snap` */
        snapToBeatLine?: boolean;
        snap?: 'free' | 'subdiv' | 'bar' | 'beat';
        shiftKey?: boolean;
        altKey?: boolean;
        clientY?: number;
      },
    ) => {
      /* Commit follow translate → scrollLeft; keep lane/ruler/bar scroll locked together. */
      commitTimelineStripTransformToScroll(
        timelineHScrollRef.current,
        timelineRulerHScrollRef.current,
        timelineHBarRef.current,
        timelineStripRef.current,
        timelineRulerStripRef.current,
        timelineFollowContentRef.current,
      );
      timelineEdgeFollowActiveRef.current = false;
      timelineFollowLastOffsetRef.current = 0;
      timelineFollowTransformOriginRef.current = 0;
      timelineFollowPinAppliedRef.current = false;

      const laneScroll = timelineHScrollRef.current;
      const rulerScroll = timelineRulerHScrollRef.current;
      const barScroll = timelineHBarRef.current;
      /* Always use the lane scroller as source of truth (ruler can desync when scrolled). */
      const scrollEl = laneScroll ?? rulerScroll;
      if (!scrollEl) return;
      const sl = scrollEl.scrollLeft;
      if (rulerScroll && rulerScroll.scrollLeft !== sl) rulerScroll.scrollLeft = sl;
      if (barScroll && barScroll.scrollLeft !== sl) barScroll.scrollLeft = sl;
      if (laneScroll && laneScroll !== scrollEl && laneScroll.scrollLeft !== sl) {
        laneScroll.scrollLeft = sl;
      }

      const z = timelineZoomRef.current;
      const bpb = beatsPerBarRef.current;
      const ppb = ppbAtZoom(z, bpb);
      const tb = totalBeatsRef.current;
      if (!(ppb > 0)) return;

      const viewX = clientX - scrollEl.getBoundingClientRect().left;
      let b = Math.max(0, Math.min(tb, (viewX + scrollEl.scrollLeft) / ppb));

      const shift = opts?.shiftKey ?? false;
      const alt = opts?.altKey ?? false;
      let snap = opts?.snap;
      if (snap == null && opts?.snapToBeatLine) snap = 'beat';
      if (snap == null) snap = 'free';
      if (alt || snap === 'free') {
        /* exact click */
      } else if (shift || snap === 'bar') {
        b = snapBeatToBarGrid(b, bpb, tb);
      } else if (snap === 'beat') {
        b = snapBeatToNearestBeatLine(b, tb);
      } else {
        b = snapBeatToSubdivision(b, pianoSnapEffRef.current, tb);
      }

      timelineUserSeekGuardUntilRef.current = performance.now() + 1200;
      cursorBeatRef.current = b;
      displayBeatRef.current = b;
      applyPlayheadFull(b, { skipAutoScroll: true });
      updateReadouts(b, true);
    },
    [applyPlayheadFull, updateReadouts],
  );

  const isClientXNearPlayhead = useCallback(
    (clientX: number, tolerancePx = 14, clientY?: number): boolean => {
      const z = timelineZoomRef.current;
      const bpb = beatsPerBarRef.current;
      const ppb = ppbAtZoom(z, bpb);
      const playheadX = cursorBeatRef.current * ppb;
      const laneScroll = timelineHScrollRef.current;
      const rulerScroll = timelineRulerHScrollRef.current;
      const laneStrip = timelineStripRef.current;
      const rulerStrip = timelineRulerStripRef.current;

      let scrollEl = laneScroll ?? rulerScroll;
      let strip = laneStrip ?? rulerStrip;
      if (clientY != null && Number.isFinite(clientY)) {
        const rulerRect = rulerStrip?.getBoundingClientRect();
        if (rulerRect && clientY >= rulerRect.top && clientY <= rulerRect.bottom) {
          scrollEl = rulerScroll ?? laneScroll;
          strip = rulerStrip ?? laneStrip;
        }
      }

      const x = se2TimelineXContentFromClient(clientX, scrollEl, strip);
      return Math.abs(x - playheadX) <= tolerancePx;
    },
    [],
  );

  /** FL-style loop-region pointer-down on the ruler bar strip. */
  const onLoopRulerPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);

    const beat = clientXToBeat(e.clientX);
    const ls   = loopStartBeatRef.current;
    const le   = loopEndBeatRef.current;
    const span = le - ls;
    const HANDLE_BEATS = Math.max(0.5, span * 0.06); // ~6% of region width for handle zone

    let mode: 'draw' | 'left' | 'right' | 'slide';
    if (Math.abs(beat - ls) <= HANDLE_BEATS) {
      mode = 'left';
    } else if (Math.abs(beat - le) <= HANDLE_BEATS) {
      mode = 'right';
    } else if (beat > ls && beat < le) {
      mode = 'slide';
    } else {
      mode = 'draw';
    }

    loopDragRef.current = { mode, startBeatSnapshot: ls, endBeatSnapshot: le, anchorBeat: beat };
    /* Auto-enable loop when user touches the ruler */
    if (!loopOnRef.current) setLoopOn(true);
  }, [clientXToBeat]);

  const onLoopRulerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = loopDragRef.current;
    if (!drag) return;
    const beat  = clientXToBeat(e.clientX);
    const tb    = totalBeatsRef.current;
    const delta = beat - drag.anchorBeat;
    const bpb   = beatsPerBarRef.current;

    let newStart = drag.startBeatSnapshot;
    let newEnd   = drag.endBeatSnapshot;

    if (drag.mode === 'draw') {
      const a = drag.anchorBeat;
      newStart = Math.max(0, Math.min(a, beat));
      newEnd   = Math.min(tb, Math.max(a, beat));
    } else if (drag.mode === 'left') {
      newStart = Math.max(0, Math.min(drag.endBeatSnapshot - bpb, beat));
    } else if (drag.mode === 'right') {
      newEnd = Math.min(tb, Math.max(drag.startBeatSnapshot + bpb, beat));
    } else if (drag.mode === 'slide') {
      newStart = Math.max(0, drag.startBeatSnapshot + delta);
      newEnd   = Math.min(tb, drag.endBeatSnapshot + delta);
      /* Clamp both edges without shrinking span */
      if (newStart <= 0) { newEnd = newEnd - newStart; newStart = 0; }
      if (newEnd >= tb)  { newStart = newStart - (newEnd - tb); newEnd = tb; }
    }

    setLoopStartBeat(newStart);
    setLoopEndBeat(newEnd);
    /* Keep loopBars in sync so the old loop engine stays consistent */
    const bars = Math.max(1, Math.round((newEnd - newStart) / bpb));
    setLoopBars(bars);
  }, [clientXToBeat]);

  const lockUserLoopRegion = useCallback((bars: number, startBeat = loopStartBeatRef.current) => {
    const n = Math.max(1, Math.min(32, Math.round(bars)));
    const bpb = beatsPerBarRef.current;
    const ls = Math.max(0, startBeat);
    const le = ls + n * bpb;
    setLoopBars(n);
    setLoopStartBeat(ls);
    setLoopEndBeat(le);
    loopBarsRef.current = n;
    loopStartBeatRef.current = ls;
    loopEndBeatRef.current = le;
    loopRegionUserLockedRef.current = true;
  }, []);

  const onLoopRulerPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!loopDragRef.current) return;
    /* Snap to bar boundaries on release for clean loops */
    const bpb      = beatsPerBarRef.current;
    let newStart   = Math.round(loopStartBeatRef.current / bpb) * bpb;
    let newEnd     = Math.round(loopEndBeatRef.current   / bpb) * bpb;
    if (newEnd <= newStart) newEnd = newStart + bpb;
    const bars = Math.max(1, Math.round((newEnd - newStart) / bpb));
    lockUserLoopRegion(bars, newStart);
    loopDragRef.current = null;
    try { (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId); } catch { /**/ }
  }, [lockUserLoopRegion]);

  const applyArrangeLoopBars = useCallback(
    (bars: number) => {
      lockUserLoopRegion(bars);
    },
    [lockUserLoopRegion],
  );

  const toggleArrangeLoopOn = useCallback(() => {
    setLoopOn((wasOn) => {
      const next = !wasOn;
      if (next) {
        const bpb = beatsPerBarRef.current;
        const ls = loopStartBeatRef.current;
        let le = loopEndBeatRef.current;
        if (le <= ls) {
          le = ls + loopBarsRef.current * bpb;
          setLoopEndBeat(le);
        }
      }
      return next;
    });
  }, []);

  /** Piano bar ruler click-to-seek (strip-local X → beat via ppb). */
  const seekFromPianoStripX = useCallback(
    (stripXCss: number) => {
      const z = timelineZoomRef.current;
      const bpb = beatsPerBarRef.current;
      const ppb = ppbAtZoom(z, bpb);
      if (!Number.isFinite(ppb) || ppb <= 0) return;
      const tb = totalBeatsRef.current;
      const b = Math.max(0, Math.min(tb, stripXCss / ppb));
      timelineUserSeekGuardUntilRef.current = performance.now() + 800;
      cursorBeatRef.current = b;
      displayBeatRef.current = b;
      applyPlayheadFull(b, { skipAutoScroll: true });
      updateReadouts(b, true);
    },
    [applyPlayheadFull, updateReadouts],
  );

  /** `TransportView` Rewind / Fast-forward Ã¢â‚¬â€ nudge playhead by one bar when transport is idle. */
  const nudgePlayheadBeats = useCallback(
    (delta: number) => {
      if (runningRef.current) return;
      const tb = totalBeatsRef.current;
      const nb = Math.max(0, Math.min(tb, cursorBeatRef.current + delta));
      cursorBeatRef.current = nb;
      displayBeatRef.current = nb;
      applyPlayheadFull(nb);
      updateReadouts(nb, true);
    },
    [applyPlayheadFull, updateReadouts],
  );

  const updateTrackNotes = useCallback((trackIndex: number, notes: MockMidiNote[]) => {
    midiPreviewScheduledRef.current.clear();
    midiHardwareScheduledRef.current.clear();
    clearStudioVocalFxPlaybackCache();
    setStudioTracks((prev) =>
      prev.map((t, i) => (i === trackIndex && studioTrackOutputsMidi(t) ? { ...t, notes } : t)),
    );
  }, [clearStudioVocalFxPlaybackCache]);

  const updateTrackMidiInstrument = useCallback((trackIndex: number, midiInstrumentId: string) => {
    const tr0 = studioTracksRef.current[trackIndex];
    const nextId = studioTrackIsDrumChannel(tr0)
      ? studioNormalizeMidiInstrumentIdForDrumTrack(midiInstrumentId)
      : studioNormalizeMidiInstrumentId(midiInstrumentId);
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackOutputsMidi(t) ? { ...t, midiInstrumentId: nextId } : t,
      ),
    );
    // Mid-play instrument swap: drop queued keys for this lane so refill uses the new sound.
    if (runningRef.current && tr0?.id) {
      const tid = tr0.id;
      for (const key of [...midiPreviewScheduledRef.current]) {
        if (key.includes(tid)) midiPreviewScheduledRef.current.delete(key);
      }
      for (const key of [...midiHardwareScheduledRef.current]) {
        if (key.includes(tid)) midiHardwareScheduledRef.current.delete(key);
      }
    }
    void (async () => {
      const ctx = await ensureCtx();
      const bus = midiPreviewBusRef.current;
      if (!bus) return;
      const masterOut = studioMasterOutRef.current ?? ctx.destination;
      ensureSe2MixerStrips(ctx, bus, masterOut);
      const stripIn = se2TrackPlaybackInput(
        ctx,
        bus,
        trackIndex,
        trackFxSlotsRef.current[trackIndex] ?? emptyMixerFxSlots(),
        trackInsertFxRacksRef.current[trackIndex] ?? defaultStudioTrackInsertFxRack(),
        bpmRef.current,
        masterOut,
      );
      await warmupStudioEditor2MidiInstrument(ctx, nextId, stripIn);
      // Audition the new sound (short) even during play so the change is obvious.
      previewStudioEditor2MidiInstrumentNote({
        ctx,
        stripIn,
        trackIndex,
        instrumentId: nextId,
        midi: 60,
        velocity: 100,
        when: ctx.currentTime + 0.01,
        durationSec: 0.35,
        bpm: bpmRef.current,
      });
    })();
  }, [ensureCtx]);

  const updateTrackHarmonySteps = useCallback((trackIndex: number, steps: GrooveProgressionStep[]) => {
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsInstrumentHarmonyChannel(t) ? { ...t, harmonySteps: steps } : t,
      ),
    );
  }, []);

  const updateTrackRhythmSteps = useCallback((trackIndex: number, steps: GrooveProgressionStep[]) => {
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsRhythmChannel(t) ? { ...t, rhythmSteps: steps } : t,
      ),
    );
  }, []);

  const updateTrackRhythmLoopBars = useCallback((trackIndex: number, loopBars: StudioHarmonyLoopBars) => {
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsRhythmChannel(t)
          ? { ...t, rhythmLoopBars: studioNormalizeHarmonyLoopBars(loopBars) }
          : t,
      ),
    );
  }, []);

  const updateGlideBassHarmonyTrackId = useCallback((trackIndex: number, sourceTrackId: string) => {
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsGlideBassChannel(t)
          ? { ...t, glideBassHarmonyTrackId: sourceTrackId }
          : t,
      ),
    );
  }, []);

  const patchSe2GlideBassVoice = useCallback(
    (trackIndex: number, patch: Partial<BeatLabBassSynthVoiceParams>) => {
      setSe2GlideBassVoices((prev) => {
        const next = [...prev];
        const tr = studioTracksRef.current[trackIndex];
        const presetId = studioTrackIsGlideBassChannel(tr)
          ? se2NormalizeGlideBassPresetId(tr.glideBassPresetId)
          : BEAT_LAB_DEFAULT_SYNTH_PRESET_ID;
        next[trackIndex] = {
          ...(next[trackIndex] ?? beatLabBassSynthVoiceParamsFromPresetId(presetId)),
          ...patch,
        };
        return next;
      });
    },
    [],
  );

  const loadSe2GlideBassPresetToVoice = useCallback((trackIndex: number, presetId: string) => {
    const id = se2NormalizeGlideBassPresetId(presetId);
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsGlideBassChannel(t) ? { ...t, glideBassPresetId: id } : t,
      ),
    );
    setSe2GlideBassVoices((prev) => {
      const next = [...prev];
      next[trackIndex] = beatLabBassSynthVoiceParamsFromPresetId(id);
      return next;
    });
  }, []);

  const applyGlideBassTrackNotes = useCallback((trackIndex: number, notes: MockMidiNote[]) => {
    setStudioTracks((prev) =>
      prev.map((t, i) => (i === trackIndex && studioTrackIsGlideBassChannel(t) ? { ...t, notes } : t)),
    );
  }, []);

  const updateGrooveLeadHarmonyTrackId = useCallback((trackIndex: number, sourceTrackId: string) => {
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsGrooveLeadChannel(t)
          ? { ...t, grooveLeadHarmonyTrackId: sourceTrackId }
          : t,
      ),
    );
  }, []);

  const applyGrooveLeadVoice = useCallback((trackIndex: number, voice: Se2GrooveLeadVoiceParams) => {
    setSe2GrooveLeadVoices((prev) => {
      const next = [...prev];
      next[trackIndex] = voice;
      return next;
    });
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsGrooveLeadChannel(t)
          ? { ...t, grooveLeadPresetId: voice.presetId }
          : t,
      ),
    );
  }, []);

  const applyLab808Voice = useCallback((trackIndex: number, voice: Se2Lab808VoiceParams) => {
    setSe2Lab808Voices((prev) => {
      const next = [...prev];
      next[trackIndex] = voice;
      return next;
    });
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsLab808Channel(t)
          ? {
              ...t,
              lab808SoundLane: voice.soundLane,
              lab808KickPresetId: voice.kickPresetId,
              lab808BassPresetId: voice.bassPresetId,
              lab808TonePadBaseMidi: voice.tonePadBaseMidi,
              lab808ToneGridLoopBars: voice.toneGridLoopBars,
              lab808ToneGridSteps: voice.toneGridSteps.map((row) => [...row]),
              lab808ToneGridZoom: voice.toneGridZoom,
              lab808RootGenSeed: voice.rootGenSeed,
              lab808RootGenQuantize: voice.rootGenQuantize,
              lab808RootGenGenre: voice.rootGenGenre,
              lab808PercSnareSteps: Array.from({ length: 16 }, (_, i) => !!voice.percSnareSteps?.[i]),
              lab808PercClapSteps: Array.from({ length: 16 }, (_, i) => !!voice.percClapSteps?.[i]),
              lab808PercLevel: typeof voice.percLevel === 'number' ? voice.percLevel : 0.88,
              ...se2Lab808ChordLockTrackFields(voice.chordLock),
            }
          : t,
      ),
    );
  }, []);

  const applyGenoUltraSynthVoice = useCallback((trackIndex: number, voice: GenoUltraSynthVoiceParams) => {
    setSe2GenoUltraSynthVoices((prev) => {
      const next = [...prev];
      next[trackIndex] = voice;
      return next;
    });
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsGenoUltraSynthChannel(t)
          ? {
              ...t,
              genoUltraPresetId: voice.id,
              genoUltraPatchLabel: voice.label,
            }
          : t,
      ),
    );
  }, []);

  const applyGenoBassSynthVoice = useCallback((trackIndex: number, voice: GenoUltraSynthVoiceParams) => {
    setSe2GenoBassSynthVoices((prev) => {
      const next = [...prev];
      next[trackIndex] = voice;
      return next;
    });
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsGenoBassSynthChannel(t)
          ? {
              ...t,
              genoBassPresetId: voice.id,
              genoBassPatchLabel: voice.label,
            }
          : t,
      ),
    );
  }, []);

  const getGenoUltraSynthPreviewDestination = useCallback(
    (trackIndex: number) => (ctx: AudioContext) => {
      const bus = midiPreviewBusRef.current;
      if (!bus) return ctx.destination;
      return (
        se2TrackPlaybackInput(
          ctx,
          bus,
          trackIndex,
          trackFxSlotsRef.current[trackIndex] ?? emptyMixerFxSlots(),
          trackInsertFxRacksRef.current[trackIndex] ?? defaultStudioTrackInsertFxRack(),
          bpmRef.current,
          studioMasterOutRef.current ?? ctx.destination,
        ) ?? ctx.destination
      );
    },
    [],
  );

  const applyGrooveLeadTrackNotes = useCallback((trackIndex: number, notes: MockMidiNote[]) => {
    setStudioTracks((prev) =>
      prev.map((t, i) => (i === trackIndex && studioTrackIsGrooveLeadChannel(t) ? { ...t, notes } : t)),
    );
  }, []);

  const getGrooveLeadPreviewDestination = useCallback(
    (trackIndex: number) => (ctx: AudioContext) => {
      const bus = midiPreviewBusRef.current;
      if (!bus) return ctx.destination;
      return (
        se2TrackPlaybackInput(
          ctx,
          bus,
          trackIndex,
          trackFxSlotsRef.current[trackIndex] ?? emptyMixerFxSlots(),
          trackInsertFxRacksRef.current[trackIndex] ?? defaultStudioTrackInsertFxRack(),
          bpmRef.current,
          studioMasterOutRef.current ?? ctx.destination,
        ) ?? ctx.destination
      );
    },
    [],
  );

  const getLab808PreviewDestination = getGrooveLeadPreviewDestination;

  const updateHumCaptureHarmonyTrackId = useCallback((trackIndex: number, sourceTrackId: string) => {
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsHumCaptureChannel(t)
          ? { ...t, humCaptureHarmonyTrackId: sourceTrackId }
          : t,
      ),
    );
  }, []);

  const updateHumCaptureRollBars = useCallback((trackIndex: number, bars: NeuralHumRollBarCount) => {
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsHumCaptureChannel(t) ? { ...t, humCaptureRollBars: bars } : t,
      ),
    );
  }, []);

  const updateHumCaptureInstrumentId = useCallback(
    (trackIndex: number, instrumentId: NeuralHumInstrumentId) => {
      setStudioTracks((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsHumCaptureChannel(t)
            ? { ...t, humCaptureInstrumentId: instrumentId }
            : t,
        ),
      );
    },
    [],
  );

  const applyHumCaptureTrackNotes = useCallback((trackIndex: number, notes: MockMidiNote[]) => {
    setStudioTracks((prev) =>
      prev.map((t, i) => (i === trackIndex && studioTrackIsHumCaptureChannel(t) ? { ...t, notes } : t)),
    );
  }, []);

  const updateGuitarTranspose = useCallback((trackIndex: number, semi: number) => {
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsGuitarChannel(t)
          ? { ...t, guitarTranspose: Math.max(-24, Math.min(24, Math.round(semi))) }
          : t,
      ),
    );
  }, []);

  const applyGuitarTrackNotes = useCallback((trackIndex: number, notes: MockMidiNote[]) => {
    setStudioTracks((prev) =>
      prev.map((t, i) => (i === trackIndex && studioTrackIsGuitarChannel(t) ? { ...t, notes } : t)),
    );
  }, []);

  const applyGenoUltraSynthTrackNotes = useCallback((trackIndex: number, notes: MockMidiNote[]) => {
    setStudioTracks((prev) =>
      prev.map((t, i) => (i === trackIndex && studioTrackIsGenoUltraSynthChannel(t) ? { ...t, notes } : t)),
    );
  }, []);

  const applyGenoBassSynthTrackNotes = useCallback((trackIndex: number, notes: MockMidiNote[]) => {
    setStudioTracks((prev) =>
      prev.map((t, i) => (i === trackIndex && studioTrackIsGenoBassSynthChannel(t) ? { ...t, notes } : t)),
    );
  }, []);

  const getHumCapturePreviewDestination = useCallback(
    (trackIndex: number) => (ctx: AudioContext) => {
      const bus = midiPreviewBusRef.current;
      if (!bus) return ctx.destination;
      return (
        se2TrackPlaybackInput(
          ctx,
          bus,
          trackIndex,
          trackFxSlotsRef.current[trackIndex] ?? emptyMixerFxSlots(),
          trackInsertFxRacksRef.current[trackIndex] ?? defaultStudioTrackInsertFxRack(),
          bpmRef.current,
          studioMasterOutRef.current ?? ctx.destination,
        ) ?? ctx.destination
      );
    },
    [],
  );

  const updateGuitarFx = useCallback(
    (trackIndex: number, patch: Partial<import('@/app/lib/studio/se2GuitarFx').Se2GuitarFxSettings>) => {
      setStudioTracks((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsGuitarChannel(t)
            ? { ...t, ...se2GuitarFxPatchFromTrack(t as import('@/app/lib/studio/se2GuitarTrack').Se2GuitarTrack, patch) }
            : t,
        ),
      );
      const ctx = ctxRef.current;
      if (ctx && ctx.state !== 'closed') {
        const strip = getHumCapturePreviewDestination(trackIndex)(ctx);
        const tr = studioTracksRef.current[trackIndex];
        if (tr && studioTrackIsGuitarChannel(tr)) {
          resolveSe2GuitarDestination(ctx, trackIndex, strip, {
            ...se2GuitarFxFromTrack(tr),
            ...patch,
          });
        }
      }
    },
    [getHumCapturePreviewDestination],
  );

  const updateGuitarInstrumentId = useCallback(
    (trackIndex: number, instrumentId: Se2GuitarInstrumentId) => {
      setStudioTracks((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsGuitarChannel(t) ? { ...t, guitarInstrumentId: instrumentId } : t,
        ),
      );
      const ctx = ctxRef.current;
      if (ctx && ctx.state !== 'closed') {
        const tr = studioTracksRef.current[trackIndex];
        const strip = getHumCapturePreviewDestination(trackIndex)(ctx);
        const dest = resolveSe2GuitarAudioForTrack(ctx, trackIndex, strip, tr);
        void warmupSe2GuitarInstrument(ctx, instrumentId, dest);
      }
    },
    [getHumCapturePreviewDestination],
  );

  const stopGlideBassAudition = useCallback((trackIndex: number) => {
    stopBeatLabSynthV2HeldPreview(se2BeatLabLaneForTrack(trackIndex));
  }, []);

  const startGlideBassAudition = useCallback((trackIndex: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const tr = studioTracksRef.current[trackIndex];
    if (!tr || !studioTrackIsGlideBassChannel(tr)) return;
    const lane = se2BeatLabLaneForTrack(trackIndex);
    const bus = midiPreviewBusRef.current;
    if (!bus) return;
    const stripIn = se2TrackPlaybackInput(
      ctx,
      bus,
      trackIndex,
      trackFxSlotsRef.current[trackIndex] ?? emptyMixerFxSlots(),
      trackInsertFxRacksRef.current[trackIndex] ?? defaultStudioTrackInsertFxRack(),
    bpmRef.current,
    studioMasterOutRef.current ?? ctx.destination,
  );
    startBeatLabSynthV2HeldPreview(ctx, {
      lane,
      midi: beatLabMelodicSynthV2AuditionPitch(lane),
      velocity: 100,
      channelVolumes: {},
      voice:
        se2GlideBassVoicesRef.current[trackIndex] ??
        se2GlideBassVoiceFromTrack(tr, undefined),
      stripOutput: stripIn,
      bpm: bpmRef.current,
    });
  }, []);

  const touchGlideBassAudition = useCallback((trackIndex: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const tr = studioTracksRef.current[trackIndex];
    if (!tr || !studioTrackIsGlideBassChannel(tr)) return;
    const lane = se2BeatLabLaneForTrack(trackIndex);
    const bus = midiPreviewBusRef.current;
    if (!bus) return;
    const stripIn = se2TrackPlaybackInput(
      ctx,
      bus,
      trackIndex,
      trackFxSlotsRef.current[trackIndex] ?? emptyMixerFxSlots(),
      trackInsertFxRacksRef.current[trackIndex] ?? defaultStudioTrackInsertFxRack(),
    bpmRef.current,
    studioMasterOutRef.current ?? ctx.destination,
  );
    touchBeatLabSynthV2HeldPreview(ctx, {
      lane,
      midi: beatLabMelodicSynthV2AuditionPitch(lane),
      velocity: 100,
      channelVolumes: {},
      voice:
        se2GlideBassVoicesRef.current[trackIndex] ??
        se2GlideBassVoiceFromTrack(tr, undefined),
      stripOutput: stripIn,
      bpm: bpmRef.current,
    });
  }, []);

  const previewGlideBassLane = useCallback((trackIndex: number, midi?: number) => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state === 'closed') return;
    const tr = studioTracksRef.current[trackIndex];
    if (!studioTrackIsGlideBassChannel(tr)) return;
    const bus = midiPreviewBusRef.current;
    if (!bus) return;
    const stripIn = se2TrackPlaybackInput(
      ctx,
      bus,
      trackIndex,
      trackFxSlotsRef.current[trackIndex] ?? emptyMixerFxSlots(),
      trackInsertFxRacksRef.current[trackIndex] ?? defaultStudioTrackInsertFxRack(),
    bpmRef.current,
    studioMasterOutRef.current ?? ctx.destination,
  );
    const voice = se2GlideBassVoicesRef.current[trackIndex] ?? se2GlideBassVoiceFromTrack(tr, undefined);
    const lane = se2BeatLabLaneForTrack(trackIndex);
    const note = midi ?? beatLabMelodicSynthV2AuditionPitch(lane);
    previewBeatLabSynthV2Note(ctx, {
      lane,
      midi: note,
      velocity: 100,
      channelVolumes: {},
      voice,
      stripOutput: stripIn,
      bpm: bpmRef.current,
    });
  }, []);

  const updateSynthGenoTrackMeta = useCallback(
    (trackIndex: number, prompt: string, patchLabel: string) => {
      setStudioTracks((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsSynthGenoChannel(t)
            ? { ...t, synthGenoPrompt: prompt, synthGenoPatchLabel: patchLabel }
            : t,
        ),
      );
    },
    [],
  );

  const updateSynthGenoComposePrompt = useCallback((trackIndex: number, composePrompt: string) => {
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsSynthGenoChannel(t)
          ? { ...t, synthGenoComposePrompt: composePrompt }
          : t,
      ),
    );
  }, []);

  const applySynthGenoVoice = useCallback(
    (trackIndex: number, voice: Se2SynthGenoVoiceParams, promptUsed: string) => {
      setSe2SynthGenoVoices((prev) => {
        const next = [...prev];
        next[trackIndex] = voice;
        return next;
      });
      updateSynthGenoTrackMeta(trackIndex, promptUsed, voice.label);
    },
    [updateSynthGenoTrackMeta],
  );

  const previewSynthGenoLane = useCallback(
    async (trackIndex: number, midi = 60) => {
      const prevTi = selectedTrackIndexRef.current;
      selectedTrackIndexRef.current = trackIndex;
      await previewPianoPitch(midi, 0.92);
      selectedTrackIndexRef.current = prevTi;
    },
    [previewPianoPitch],
  );

  const synthGenoPluginPreviewRef = useRef<Se2SynthGenoPluginPreviewHandle | null>(null);

  const stopSynthGenoPluginPreview = useCallback(
    (opts?: { tearDownAccord?: boolean; haltPadGlide?: boolean }) => {
      if (opts?.haltPadGlide !== false) {
        haltAllSe2LiveChordGlideSessions(ctxRef.current);
      }
      stopSe2SynthGenoPluginPreview(synthGenoPluginPreviewRef.current, ctxRef.current, {
        tearDownAccord: opts?.tearDownAccord,
      });
      synthGenoPluginPreviewRef.current = null;
    },
    [],
  );

  useEffect(() => () => stopSynthGenoPluginPreview({ tearDownAccord: true, haltPadGlide: true }), [stopSynthGenoPluginPreview]);

  const previewSynthGenoPluginDraft = useCallback(
    async (
      trackIndex: number,
      draft: Se2SynthGenoPluginDraft,
      sounds: Se2SynthGenoPluginSoundSelection,
      previewOpts?: Se2SynthGenoPluginPreviewOpts,
    ) => {
      stopSynthGenoPluginPreview();
      const ctx = await ensureCtx();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          return;
        }
      }
      const tr = studioTracksRef.current[trackIndex];
      if (!tr || !studioTrackIsSynthGenoChannel(tr)) return;
      const bus = midiPreviewBusRef.current;
      if (!bus) return;
      const previewBpm = previewOpts?.bpm ?? bpmRef.current;
      const stripIn = se2TrackPlaybackInput(
        ctx,
        bus,
        trackIndex,
        trackFxSlotsRef.current[trackIndex] ?? emptyMixerFxSlots(),
        trackInsertFxRacksRef.current[trackIndex] ?? defaultStudioTrackInsertFxRack(),
        previewBpm,
        studioMasterOutRef.current ?? ctx.destination,
      );
      applyStudioMixerStripMix(trackIndex, {
        muted: false,
        vol127: trackVolumesRef.current[trackIndex] ?? MIXER_UNITY_VOL,
        pan127: trackPansRef.current[trackIndex] ?? 64,
        mono: trackMonosRef.current[trackIndex] ?? false,
      });
      const layers = buildSe2SynthGenoPluginPreviewLayers(draft, sounds, previewOpts);
      const grooveLeadNotes = draft.grooveLeadNotes ?? previewOpts?.grooveLeadNotes;
      if (layers.length === 0 && !(grooveLeadNotes?.length)) return;
      setGenoPluginPreviewMixGains(genoMixGainsFromPreviewOpts(previewOpts));
      synthGenoPluginPreviewRef.current = startSe2SynthGenoPluginLoopPreview({
        ctx,
        stripOutput: stripIn,
        bpm: previewBpm,
        beatsPerBar: beatsPerBarRef.current,
        barCount: Math.max(1, draft.bars),
        timelineBarCount: previewOpts?.timelineBarCount,
        layers,
        loop: true,
        grooveLeadNotes,
        grooveLeadTrackIndex: previewOpts?.grooveLeadTrackIndex ?? trackIndex,
        grooveLeadVoice: previewOpts?.grooveLeadVoice,
        grooveLeadGain: previewOpts?.grooveLeadGain,
      });
    },
    [stopSynthGenoPluginPreview, ensureCtx],
  );

  const previewSynthGenoLiveChord = useCallback(
    async (
      trackIndex: number,
      tones: readonly number[],
      accordBankId: string,
      opts?: { chordGlide?: boolean; genreId?: string; padTrigger?: boolean },
    ) => {
      const chillPad = opts?.genreId === 'drill';
      if (!chillPad) {
        stopSynthGenoPluginPreview({ tearDownAccord: false, haltPadGlide: false });
      }
      const ctx = await ensureCtx();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          return;
        }
      }
      const tr = studioTracksRef.current[trackIndex];
      if (!tr || !studioTrackIsSynthGenoChannel(tr)) return;
      const bus = midiPreviewBusRef.current;
      if (!bus) return;
      const stripIn = se2TrackPlaybackInput(
        ctx,
        bus,
        trackIndex,
        trackFxSlotsRef.current[trackIndex] ?? emptyMixerFxSlots(),
        trackInsertFxRacksRef.current[trackIndex] ?? defaultStudioTrackInsertFxRack(),
        bpmRef.current,
        studioMasterOutRef.current ?? ctx.destination,
      );
      applyStudioMixerStripMix(trackIndex, {
        muted: false,
        vol127: trackVolumesRef.current[trackIndex] ?? MIXER_UNITY_VOL,
        pan127: trackPansRef.current[trackIndex] ?? 64,
        mono: trackMonosRef.current[trackIndex] ?? false,
      });
      await playSe2SynthGenoLiveChordBlock({
        ctx,
        dest: stripIn,
        tones,
        accordBankId,
        playOpts: {
          chordGlide: opts?.chordGlide,
          genreId: opts?.genreId,
          padTrigger: opts?.padTrigger,
          sessionKey: `se2-live-${trackIndex}`,
        },
      });
      if (chillPad) {
        stopSynthGenoPluginPreview({ tearDownAccord: false, haltPadGlide: false });
      }
    },
    [stopSynthGenoPluginPreview, ensureCtx],
  );

  const pullFromTrackToRhythmLane = useCallback(
    (rhythmTrackIndex: number, sourceTrackIndex: number) => {
      const src = studioTracksRef.current[sourceTrackIndex];
      const rhythm = studioTracksRef.current[rhythmTrackIndex];
      if (!src || !rhythm || !studioTrackIsRhythmChannel(rhythm)) return;
      if (sourceTrackIndex === rhythmTrackIndex) return;
      if (!studioTrackOutputsMidi(src) || studioTrackIsDrumChannel(src)) return;

      const stepSource = src.rhythmSteps?.length
        ? src.rhythmSteps
        : src.harmonySteps?.length
          ? src.harmonySteps
          : null;
      const clonedSteps = stepSource?.map((s) => ({ ...s, id: newProgressionStepId() }));
      const notes = src.notes.map((n) => ({ ...n }));
      const nextInst = src.midiInstrumentId
        ? studioNormalizeMidiInstrumentId(src.midiInstrumentId)
        : rhythm.midiInstrumentId;

      midiPreviewScheduledRef.current.clear();
      midiHardwareScheduledRef.current.clear();
      setStudioTracks((prev) =>
        prev.map((t, i) => {
          if (i !== rhythmTrackIndex) return t;
          return {
            ...t,
            notes,
            midiInstrumentId: nextInst,
            ...(clonedSteps?.length ? { rhythmSteps: clonedSteps } : {}),
            ...(src.trackKeyRoot != null && src.trackKeyMode
              ? { trackKeyRoot: src.trackKeyRoot, trackKeyMode: src.trackKeyMode }
              : {}),
          };
        }),
      );
      setSelectedTrackIndex(rhythmTrackIndex);
      setSelectedPianoNoteIndex(null);
      setSelectedPianoNoteIndexes(new Set());
      if (runningRef.current) {
        const ctx = ctxRef.current;
        if (ctx && ctx.state !== 'closed') {
          midiPreviewScheduledRef.current.clear();
          midiHardwareScheduledRef.current.clear();
          audioPreviewScheduledRef.current.clear();
          refillLoopPreviewOnce(ctx, audioNow(ctx));
          launchWapiAnims(cursorBeatRef.current, true);
        }
      }
    },
    [launchWapiAnims, refillLoopPreviewOnce],
  );

  const onPianoRollMidiInstrumentChange = useCallback(
    (instrumentId: string) => {
      updateTrackMidiInstrument(selectedTrackIndexRef.current, instrumentId);
    },
    [updateTrackMidiInstrument],
  );

  const updateTrackHarmonyOrchHit = useCallback((trackIndex: number, orchHitId: OrchestraHitId) => {
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsInstrumentHarmonyChannel(t)
          ? { ...t, harmonyOrchHitId: orchHitId, harmonySoundKind: 'orchHit' as const }
          : t,
      ),
    );
  }, []);

  const updateTrackHarmonySoundKind = useCallback((trackIndex: number, kind: StudioHarmonySoundKind) => {
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsInstrumentHarmonyChannel(t) ? { ...t, harmonySoundKind: kind } : t,
      ),
    );
  }, []);

  const updateTrackHarmonyGrooveLead = useCallback((trackIndex: number, leadId: GrooveLabLeadSoundId) => {
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsInstrumentHarmonyChannel(t)
          ? { ...t, harmonyGrooveLeadId: leadId, harmonySoundKind: 'grooveLead' as const }
          : t,
      ),
    );
  }, []);

  const updateTrackHarmonyMelodyStyle = useCallback((trackIndex: number, styleId: WaveLeafMelodyStyleId) => {
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsInstrumentHarmonyChannel(t)
          ? { ...t, harmonyMelodyStyleId: styleId, harmonySoundKind: 'grooveLead' as const }
          : t,
      ),
    );
  }, []);

  const updateTrackHarmonyLoopBars = useCallback((trackIndex: number, loopBars: StudioHarmonyLoopBars) => {
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsInstrumentHarmonyChannel(t) ? { ...t, harmonyLoopBars: loopBars } : t,
      ),
    );
  }, []);

  const armHarmonyLoopRegion = useCallback((barCount = STUDIO_HARMONY_LOOP_BARS) => {
    const bpb = beatsPerBarRef.current;
    const loopEnd = loopRegionEndBeat(bpb, barCount);
    midiPreviewLoopLapRef.current = 0;
    midiPreviewScheduledRef.current.clear();
    midiHardwareScheduledRef.current.clear();
    setLoopOn(true);
    setLoopStartBeat(LOOP_REGION_START_BEAT);
    setLoopBars(barCount);
    setLoopEndBeat(loopEnd);
    loopOnRef.current = true;
    loopStartBeatRef.current = LOOP_REGION_START_BEAT;
    loopBarsRef.current = barCount;
    loopEndBeatRef.current = loopEnd;
    loopRegionUserLockedRef.current = false;
    if (runningRef.current) {
      launchWapiAnims(cursorBeatRef.current, true);
    }
  }, [launchWapiAnims]);

  const lockGrooveLeadToSynthGeno = useCallback(
    (synthGenoTrackIndex: number, input: Se2SynthGenoGrooveLeadLockInput): number | null => {
      const melody = se2SynthGenoGrooveLeadMelodyNotes(input);
      if ('message' in melody) {
        console.warn('[Geno → Groove Lead]', melody.message);
        return null;
      }
      const steps = se2SynthGenoBuildHarmonySteps(input);
      if ('message' in steps) {
        console.warn('[Geno → Groove Lead]', steps.message);
        return null;
      }

      const prev = studioTracksRef.current;
      const genoTr = prev[synthGenoTrackIndex];
      if (!genoTr || !studioTrackIsSynthGenoChannel(genoTr)) return null;

      const loopBars = studioNormalizeHarmonyLoopBars(
        (input.build === 'b01' ? input.barCount : input.state.barCount) <= 4 ? 4 : 8,
      );
      const notes: MockMidiNote[] = melody.map((n) => ({
        pitch: n.pitch,
        startBeat: n.startBeat,
        durationBeats: n.durationBeats,
        velocity: n.velocity,
      }));

      let grooveIdx = se2FindGrooveLeadForSynthGeno(
        prev,
        genoTr.id,
        genoTr.synthGenoGrooveLeadTrackId,
      );

      if (grooveIdx < 0) {
        if (prev.length >= MAX_STUDIO_TRACKS) return null;
        grooveIdx = prev.length;
        const initVoice = se2GrooveLeadDefaultVoice();
        const grooveLeadId = newTrackId();
        const newTrack: MockMusioTrack = {
          id: grooveLeadId,
          name: se2SynthGenoGrooveLeadTrackName(genoTr.name),
          laneNumber: se2NextStudioLaneNumber(prev),
          colorHex: '#7CF4C6',
          kind: 'grooveLead',
          midiChannel: studioNextMidiChannel(prev),
          grooveLeadPresetId: initVoice.presetId,
          grooveLeadHarmonyTrackId: genoTr.id,
          notes,
          audioClips: [],
        };
        setSe2GrooveLeadVoices((voices) => {
          const next = [...voices];
          next[grooveIdx] = initVoice;
          return next;
        });
        setStudioTracks((tracks) => {
          const geno = tracks[synthGenoTrackIndex];
          if (!geno || geno.kind !== 'synthGeno') return tracks;
          const updatedGeno: MockMusioTrack = {
            ...geno,
            harmonySteps: steps,
            trackKeyRoot: input.keyRoot,
            trackKeyMode: input.keyMode,
            synthGenoGrooveLeadTrackId: grooveLeadId,
          };
          const next = [...tracks];
          next[synthGenoTrackIndex] = updatedGeno;
          next.push(newTrack);
          return next;
        });
      } else {
        setStudioTracks((tracks) =>
          tracks.map((t, i) => {
            if (i === synthGenoTrackIndex && t.kind === 'synthGeno') {
              return {
                ...t,
                harmonySteps: steps,
                trackKeyRoot: input.keyRoot,
                trackKeyMode: input.keyMode,
              };
            }
            if (i === grooveIdx && studioTrackIsGrooveLeadChannel(t)) {
              return {
                ...t,
                notes,
                grooveLeadHarmonyTrackId: genoTr.id,
              };
            }
            return t;
          }),
        );
      }

      midiPreviewScheduledRef.current.clear();
      midiHardwareScheduledRef.current.clear();
      armHarmonyLoopRegion(loopBars);
      setSelectedTrackIndex(grooveIdx);
      setSelectedPianoNoteIndex(null);
      setSelectedPianoNoteIndexes(new Set());
      setGrooveLeadPanelOpen(true);
      openPianoRollEditor();
      scrollTrackListToEnd();
      return grooveIdx;
    },
    [armHarmonyLoopRegion, openPianoRollEditor, scrollTrackListToEnd],
  );

  const applyHarmonyRootHits = useCallback(
    (
      trackIndex: number,
      steps: GrooveProgressionStep[],
      soundKind: StudioHarmonySoundKind,
      orchHitId: OrchestraHitId,
      grooveLeadId: GrooveLabLeadSoundId,
      loopBars: StudioHarmonyLoopBars = STUDIO_HARMONY_LOOP_BARS,
      melodyStyleId: WaveLeafMelodyStyleId = studioDefaultHarmonyMelodyStyleId(),
    ) => {
      const barCount = studioResolveHarmonyBarCount(steps, loopBars, beatsPerBar);
      const tr = studioTracksRef.current[trackIndex];
      const detected = tr ? studioTrackDetectedKey(tr) : {};
      const keyRoot = detected.keyRoot ?? songKeyRootRef.current;
      const keyMode = detected.keyMode ?? songKeyModeRef.current;
      const melodySeed = (tr?.harmonyMelodySeed ?? 0) + 1;
      const styleId = melodyStyleId || tr?.harmonyMelodyStyleId || studioDefaultHarmonyMelodyStyleId();
      const built =
        soundKind === 'grooveLead'
          ? progressionStepsToGrooveLeadMelody(steps, {
              beatsPerBar,
              barCount,
              keyRoot,
              keyMode,
              seed: melodySeed,
              styleId,
              bpm: bpmRef.current,
            })
          : progressionStepsToBarRootHits(steps, { beatsPerBar, barCount });
      if ('message' in built) return;
      midiPreviewScheduledRef.current.clear();
      midiHardwareScheduledRef.current.clear();
      const soundId = soundKind === 'grooveLead' ? grooveLeadId : orchHitId;
      const instId = studioHarmonyInstrumentId(soundKind, soundId);
      setStudioTracks((prev) =>
        prev.map((t, i) => {
          if (i !== trackIndex || !studioTrackIsInstrumentHarmonyChannel(t)) return t;
          return {
            ...t,
            notes: built,
            harmonySteps: steps,
            harmonyOrchHitId: orchHitId,
            harmonyGrooveLeadId: grooveLeadId,
            harmonySoundKind: soundKind,
            harmonyLoopBars: barCount,
            harmonyMelodySeed: soundKind === 'grooveLead' ? melodySeed : t.harmonyMelodySeed,
            harmonyMelodyStyleId: soundKind === 'grooveLead' ? styleId : t.harmonyMelodyStyleId,
            midiInstrumentId: instId,
          };
        }),
      );
      armHarmonyLoopRegion(barCount);
      setSelectedTrackIndex(trackIndex);
      setSelectedPianoNoteIndex(null);
      setSelectedPianoNoteIndexes(new Set());
      if (soundKind === 'orchHit') {
        void ensureCtx().then((ctx) => studioPreloadOrchestraHitInstrument(ctx, instId));
      }
      if (runningRef.current) {
        const ctx = ctxRef.current;
        if (ctx && ctx.state !== 'closed') {
          midiPreviewScheduledRef.current.clear();
          midiHardwareScheduledRef.current.clear();
          audioPreviewScheduledRef.current.clear();
          refillLoopPreviewOnce(ctx, audioNow(ctx));
          launchWapiAnims(cursorBeatRef.current, true);
        }
      }
    },
    [armHarmonyLoopRegion, beatsPerBar, ensureCtx, launchWapiAnims, refillLoopPreviewOnce],
  );

  const applyRhythmToRoll = useCallback(
    (trackIndex: number) => {
      const tr = studioTracksRef.current[trackIndex];
      if (!tr || !studioTrackIsRhythmChannel(tr)) return;
      const steps = tr.rhythmSteps ?? [];
      const barCount = studioNormalizeHarmonyLoopBars(tr.rhythmLoopBars);
      const built = rhythmStepsToMidiNotes(steps, { beatsPerBar, barCount });
      if ('message' in built) return;
      const maxEndBeat = built.reduce((m, n) => Math.max(m, n.startBeat + n.durationBeats), 0);
      const loopBarCount = studioLoopBarsForMidiContent(maxEndBeat, beatsPerBar, barCount);
      midiPreviewScheduledRef.current.clear();
      midiHardwareScheduledRef.current.clear();
      setStudioTracks((prev) => {
        const next = prev.map((t, i) => {
          if (i !== trackIndex || !studioTrackIsRhythmChannel(t)) return t;
          return { ...t, notes: built };
        });
        studioTracksRef.current = next;
        return next;
      });
      armHarmonyLoopRegion(loopBarCount);
      setSelectedTrackIndex(trackIndex);
      setSelectedPianoNoteIndex(null);
      setSelectedPianoNoteIndexes(new Set());
      if (runningRef.current) {
        const ctx = ctxRef.current;
        if (ctx && ctx.state !== 'closed') {
          midiPreviewScheduledRef.current.clear();
          midiHardwareScheduledRef.current.clear();
          audioPreviewScheduledRef.current.clear();
          refillLoopPreviewOnce(ctx, audioNow(ctx));
          launchWapiAnims(cursorBeatRef.current, true);
        }
      }
    },
    [armHarmonyLoopRegion, beatsPerBar, launchWapiAnims, refillLoopPreviewOnce],
  );

  const applyHarmonyChords = useCallback(
    (trackIndex: number, steps: GrooveProgressionStep[], loopBars: StudioHarmonyLoopBars = STUDIO_HARMONY_LOOP_BARS) => {
      const barCount = studioResolveHarmonyBarCount(steps, loopBars, beatsPerBar);
      const built = progressionStepsToChordNotes(steps, {
        beatsPerBar,
        barCount,
        sustainSlots: 4,
        maxDurationBeats: Math.min(beatsPerBar * 0.92, Math.max(0.5, beatsPerBar - 0.08)),
      });
      if ('message' in built) return;
      const maxEndBeat = built.reduce((m, n) => Math.max(m, n.startBeat + n.durationBeats), 0);
      const loopBarCount = studioLoopBarsForMidiContent(maxEndBeat, beatsPerBar, barCount);
      interruptStudioProgressionAuditionForTransport();
      midiPreviewScheduledRef.current.clear();
      midiHardwareScheduledRef.current.clear();
      setStudioTracks((prev) => {
        const next = prev.map((t, i) => {
          if (i !== trackIndex || !studioTrackIsInstrumentHarmonyChannel(t)) return t;
          return { ...t, notes: built, harmonySteps: steps, harmonyLoopBars: loopBarCount };
        });
        studioTracksRef.current = next;
        return next;
      });
      armHarmonyLoopRegion(loopBarCount);
      setSelectedTrackIndex(trackIndex);
      setSelectedPianoNoteIndex(null);
      setSelectedPianoNoteIndexes(new Set());
      if (runningRef.current) {
        const ctx = ctxRef.current;
        if (ctx && ctx.state !== 'closed') {
          midiPreviewScheduledRef.current.clear();
          midiHardwareScheduledRef.current.clear();
          audioPreviewScheduledRef.current.clear();
          refillLoopPreviewOnce(ctx, audioNow(ctx));
        }
      } else {
        launchWapiAnims(cursorBeatRef.current, false);
      }
    },
    [armHarmonyLoopRegion, beatsPerBar, launchWapiAnims, refillLoopPreviewOnce],
  );

  const applyGenoChordCreatorToTrack = useCallback(
    (
      trackIndex: number,
      steps: GrooveProgressionStep[],
      loopBars: StudioHarmonyLoopBars,
      presetId?: string,
    ) => {
      const barCount = studioResolveHarmonyBarCount(steps, loopBars, beatsPerBar);
      const trackPresetId =
        presetId
        ?? (studioTracksRef.current[trackIndex] as { genoChordCreatorPresetId?: string } | undefined)
          ?.genoChordCreatorPresetId
        ?? '';
      const openJazzNeo = se2PresetUsesOpenJazzNeoVoicing(trackPresetId);
      const built = progressionStepsToChordNotes(steps, {
        beatsPerBar,
        barCount,
        sustainSlots: 4,
        maxDurationBeats: Math.min(beatsPerBar * 0.92, Math.max(0.5, beatsPerBar - 0.08)),
        openJazzNeo,
      });
      if ('message' in built) return;
      interruptStudioProgressionAuditionForTransport();
      midiPreviewScheduledRef.current.clear();
      midiHardwareScheduledRef.current.clear();
      setStudioTracks((prev) =>
        prev.map((t, i) => {
          if (i !== trackIndex || !studioTrackIsGenoChordCreatorChannel(t)) return t;
          return {
            ...t,
            kind: 'genoChordCreator',
            notes: built,
            harmonySteps: steps,
            harmonyLoopBars: barCount,
            ...(presetId ? { genoChordCreatorPresetId: presetId } : {}),
          };
        }),
      );
      armHarmonyLoopRegion(barCount);
      setSelectedTrackIndex(trackIndex);
      setSelectedPianoNoteIndex(null);
      setSelectedPianoNoteIndexes(new Set());
      if (runningRef.current) {
        const ctx = ctxRef.current;
        if (ctx && ctx.state !== 'closed') {
          midiPreviewScheduledRef.current.clear();
          midiHardwareScheduledRef.current.clear();
          audioPreviewScheduledRef.current.clear();
          refillLoopPreviewOnce(ctx, audioNow(ctx));
          launchWapiAnims(cursorBeatRef.current, true);
        }
      }
    },
    [armHarmonyLoopRegion, beatsPerBar, launchWapiAnims, refillLoopPreviewOnce],
  );

  const applyGenoChordCreatorMidiToTrack = useCallback(
    (
      trackIndex: number,
      notes: readonly { pitch: number; startBeat: number; durationBeats: number; velocity: number }[],
      loopBars: StudioHarmonyLoopBars,
    ) => {
      if (notes.length === 0) return;
      const sorted = [...notes]
        .map((n) => ({
          pitch: Math.max(0, Math.min(127, Math.round(n.pitch))),
          startBeat: Math.max(0, n.startBeat),
          durationBeats: Math.max(0.25, n.durationBeats),
          velocity: Math.max(1, Math.min(127, Math.round(n.velocity))),
        }))
        .sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
      const barCount = Math.max(
        studioResolveHarmonyBarCount([], loopBars, beatsPerBar),
        studioInferBarCountFromNotes(sorted, beatsPerBar, loopBars),
      ) as StudioHarmonyLoopBars;
      interruptStudioProgressionAuditionForTransport();
      midiPreviewScheduledRef.current.clear();
      midiHardwareScheduledRef.current.clear();
      setStudioTracks((prev) =>
        prev.map((t, i) => {
          if (i !== trackIndex || !studioTrackIsGenoChordCreatorChannel(t)) return t;
          return {
            ...t,
            kind: 'genoChordCreator',
            notes: sorted,
            harmonyLoopBars: barCount,
          };
        }),
      );
      armHarmonyLoopRegion(barCount);
      setSelectedTrackIndex(trackIndex);
      setSelectedPianoNoteIndex(null);
      setSelectedPianoNoteIndexes(new Set());
      if (runningRef.current) {
        const ctx = ctxRef.current;
        if (ctx && ctx.state !== 'closed') {
          midiPreviewScheduledRef.current.clear();
          midiHardwareScheduledRef.current.clear();
          audioPreviewScheduledRef.current.clear();
          refillLoopPreviewOnce(ctx, audioNow(ctx));
          launchWapiAnims(cursorBeatRef.current, true);
        }
      }
    },
    [armHarmonyLoopRegion, beatsPerBar, launchWapiAnims, refillLoopPreviewOnce],
  );

  const updateGenoChordCreatorDraft = useCallback((trackIndex: number, steps: GrooveProgressionStep[]) => {
    setStudioTracks((prev) =>
      prev.map((t, i) => {
        if (i !== trackIndex || !studioTrackIsGenoChordCreatorChannel(t)) return t;
        return { ...t, kind: 'genoChordCreator', harmonySteps: steps };
      }),
    );
  }, []);

  const updateGenoChordCreatorLoopBars = useCallback(
    (trackIndex: number, bars: StudioHarmonyLoopBars) => {
      const bpb = beatsPerBarRef.current;
      setStudioTracks((prev) =>
        prev.map((t, i) => {
          if (i !== trackIndex || !studioTrackIsGenoChordCreatorChannel(t)) return t;
          const steps = t.harmonySteps ?? [];
          const harmonySteps =
            steps.length > 0 ? se2HarmonyStepsForLoopBars(steps, bars, bpb) : steps;
          return { ...t, harmonyLoopBars: bars, harmonySteps };
        }),
      );
    },
    [],
  );

  const toggleGenoChordCreatorSe2Sync = useCallback((trackIndex: number) => {
    setStudioTracks((prev) =>
      prev.map((t, i) => {
        if (i !== trackIndex || !studioTrackIsGenoChordCreatorChannel(t)) return t;
        return { ...t, genoChordCreatorSe2Sync: !(t.genoChordCreatorSe2Sync ?? false) };
      }),
    );
  }, []);

  const detectTrackKey = useCallback((trackIndex: number) => {
    const tr = studioTracksRef.current[trackIndex];
    if (!tr || !studioTrackHasMelodicKeyUi(tr) || tr.notes.length === 0) return;
    const key = detectKeyFromMidiNotes(tr.notes, bpmRef.current);
    if (!key) return;
    const keyRoot = ((Math.round(key.keyRoot) % 12) + 12) % 12;
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex
          ? {
              ...t,
              trackKeyRoot: keyRoot,
              trackKeyMode: key.keyMode,
              ...(t.kind === 'a2m' ? { a2mKeyRoot: keyRoot, a2mKeyMode: key.keyMode } : {}),
            }
          : t,
      ),
    );
  }, []);

  const detectGenoUltraKeyFromSourceTrack = useCallback((trackIndex: number): boolean => {
    const tr = studioTracksRef.current[trackIndex];
    if (!tr) return false;
    const detected = detectKeyFromStudioTrack(
      {
        kind: tr.kind,
        a2mMode: tr.kind === 'a2m' ? studioNormalizeA2mMode(tr.a2mMode) : undefined,
        trackKeyRoot: tr.trackKeyRoot,
        trackKeyMode: tr.trackKeyMode,
        a2mKeyRoot: tr.a2mKeyRoot,
        a2mKeyMode: tr.a2mKeyMode,
        notes: tr.notes,
      },
      bpmRef.current,
    );
    if (!detected) return false;
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex
          ? {
              ...t,
              trackKeyRoot: detected.keyRoot,
              trackKeyMode: detected.keyMode,
              ...(t.kind === 'a2m' ? { a2mKeyRoot: detected.keyRoot, a2mKeyMode: detected.keyMode } : {}),
            }
          : t,
      ),
    );
    setSongKeyRoot(detected.keyRoot);
    setSongKeyMode(detected.keyMode);
    return true;
  }, []);

  const applyGenoUltraStoredKeyFromSourceTrack = useCallback((trackIndex: number) => {
    const tr = studioTracksRef.current[trackIndex];
    if (!tr) return;
    const resolved = resolveKeyFromStudioTrack(
      {
        kind: tr.kind,
        a2mMode: tr.kind === 'a2m' ? studioNormalizeA2mMode(tr.a2mMode) : undefined,
        trackKeyRoot: tr.trackKeyRoot,
        trackKeyMode: tr.trackKeyMode,
        a2mKeyRoot: tr.a2mKeyRoot,
        a2mKeyMode: tr.a2mKeyMode,
        notes: tr.notes,
      },
      bpmRef.current,
    );
    if (!resolved) return;
    setSongKeyRoot(resolved.keyRoot);
    setSongKeyMode(resolved.keyMode);
  }, []);

  const onGenoUltraKeySourceTrackIndexChange = useCallback(
    (trackIndex: number) => {
      setGenoUltraKeySourceTrackIndex(trackIndex);
      applyGenoUltraStoredKeyFromSourceTrack(trackIndex);
    },
    [applyGenoUltraStoredKeyFromSourceTrack],
  );

  const onGenoBassKeySourceTrackIndexChange = useCallback(
    (trackIndex: number) => {
      setGenoBassKeySourceTrackIndex(trackIndex);
      applyGenoUltraStoredKeyFromSourceTrack(trackIndex);
    },
    [applyGenoUltraStoredKeyFromSourceTrack],
  );

  const getGenoUltraSe2TrackChordImport = useCallback(
    (trackIndex: number, barLength: GenoArpBarLength) => {
      const tr = studioTracksRef.current[trackIndex];
      if (!tr) return { message: 'Track not found.' } as const;
      return importGenoUltraArpFromSe2Track(
        se2TrackToGenoUltraChordInput({
          kind: tr.kind,
          a2mMode: tr.kind === 'a2m' ? studioNormalizeA2mMode(tr.a2mMode) : undefined,
          name: tr.name,
          laneNumber: tr.laneNumber,
          trackKeyRoot: tr.trackKeyRoot,
          trackKeyMode: tr.trackKeyMode,
          a2mKeyRoot: tr.a2mKeyRoot,
          a2mKeyMode: tr.a2mKeyMode,
          notes: tr.notes,
          harmonySteps: tr.harmonySteps,
          harmonyLoopBars: tr.harmonyLoopBars,
          rhythmSteps: tr.rhythmSteps,
          rhythmLoopBars: tr.rhythmLoopBars,
        }),
        {
          trackIndex,
          beatsPerBar: beatsPerBarRef.current,
          bpm: bpmRef.current,
          barLength,
          songKey: { keyRoot: songKeyRootRef.current, keyMode: songKeyModeRef.current },
          lanePad: Math.max(2, String(studioTracksRef.current.length).length),
        },
      );
    },
    [],
  );

  const getGenoBassSe2TrackMidiImport = useCallback((trackIndex: number) => {
    const tr = studioTracksRef.current[trackIndex];
    if (!tr) return { message: 'Track not found.' } as const;
    return importGenoBassMidiFromSe2Track(
      se2TrackToGenoBassMidiInput({
        kind: tr.kind,
        a2mMode: tr.kind === 'a2m' ? studioNormalizeA2mMode(tr.a2mMode) : undefined,
        midiInstrumentId: tr.midiInstrumentId,
        midiChannel: tr.midiChannel,
        name: tr.name,
        laneNumber: tr.laneNumber,
        notes: tr.notes,
      }),
      {
        trackIndex,
        bpm: bpmRef.current,
        lanePad: Math.max(2, String(studioTracksRef.current.length).length),
      },
    );
  }, []);

  const genoUltraPanelWasOpenRef = useRef(false);
  useEffect(() => {
    if (genoUltraSynthPanelOpen && !genoUltraPanelWasOpenRef.current) {
      setGenoUltraKeySourceTrackIndex(selectedTrackIndex);
      applyGenoUltraStoredKeyFromSourceTrack(selectedTrackIndex);
    }
    genoUltraPanelWasOpenRef.current = genoUltraSynthPanelOpen;
  }, [genoUltraSynthPanelOpen, selectedTrackIndex, applyGenoUltraStoredKeyFromSourceTrack]);

  useEffect(() => {
    if (!genoUltraSynthPanelOpen) return;
    setGenoUltraKeySourceTrackIndex(selectedTrackIndex);
  }, [selectedTrackIndex, genoUltraSynthPanelOpen]);

  const updateTrackA2mMode = useCallback((trackIndex: number, mode: StudioA2mMode) => {
    const nextMode = studioNormalizeA2mMode(mode);
    setStudioTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex && t.kind === 'a2m'
          ? {
              ...t,
              a2mMode: nextMode,
              midiInstrumentId: studioDefaultInstrumentForA2mMode(nextMode),
            }
          : t,
      ),
    );
  }, []);

  const sortNotesLikePianoRoll = useCallback(
    (notes: MockMidiNote[]) =>
      [...notes].sort((a, b) => (a.startBeat !== b.startBeat ? a.startBeat - b.startBeat : a.pitch - b.pitch)),
    [],
  );

  const applyTracksMutation = useCallback(
    (fn: (prev: MockMusioTrack[]) => MockMusioTrack[]) => {
      setStudioTracks((prev) => {
        undoStacksRef.current = [...undoStacksRef.current.slice(-49), snapshotStudioTracks(prev)];
        redoStacksRef.current = [];
        setUndoStackDepth(undoStacksRef.current.length);
        setRedoStackDepth(0);
        const next = fn(prev);
        studioTracksRef.current = next;
        return next;
      });
    },
    [],
  );

  const normalizeSelectedTrackAudio = useCallback(() => {
    const ti = selectedTrackIndexRef.current;
    const tr = studioTracksRef.current[ti];
    if (!tr || !se2TrackHasDraggableAudioClips(tr.kind)) return;

    const sel = selectedTimelineAudioClipRef.current;
    let sourceIds: string[];
    if (sel && sel.trackIndex === ti) {
      const clip = tr.audioClips.find((c) => c.id === sel.clipId);
      sourceIds = clip ? [clip.sourceId] : [];
    } else {
      sourceIds = tr.audioClips.map((c) => c.sourceId);
    }
    if (sourceIds.length === 0) return;

    const touched = applySe2NormalizeToSourceIds(studioAudioBuffersRef.current, sourceIds);
    if (touched > 0) {
      gridCacheRef.current = null;
      audioPreviewScheduledRef.current.clear();
      stopScheduledPreviewAudioClips(scheduledPreviewAudioClipsRef.current);
    }
  }, []);

  const consolidateTracksAtIndices = useCallback(
    async (indices: number[], startBar: number, endBar: number) => {
      if (indices.length === 0 || consolidateBusy) return;
      const range = se2ConsolidateRangeFromBars(
        startBar,
        endBar,
        SE2_ARRANGEMENT_BARS,
        beatsPerBarRef.current,
      );
      if (!range) return;

      setConsolidateBusy(true);
      try {
        const ctx = await ensureCtx();
        const bpmNow = bpmRef.current;
        const tracks = studioTracksRef.current;
        const results: Array<{
          ti: number;
          sourceId: string;
          clip: StudioAudioClip;
          buffer: AudioBuffer;
        }> = [];

        for (const ti of indices) {
          const tr = tracks[ti];
          if (!tr || tr.audioClips.length === 0) continue;
          if (!se2TrackHasDraggableAudioClips(tr.kind)) continue;
          const bounced = await consolidateSe2TrackClips(ctx, tr, studioAudioBuffersRef.current, {
            bpm: bpmNow,
            rangeStartBeat: range.startBeat,
            rangeEndBeat: range.endBeat,
          });
          if (bounced) {
            results.push({
              ti,
              sourceId: bounced.sourceId,
              clip: bounced.clip as StudioAudioClip,
              buffer: bounced.buffer,
            });
          }
        }

        if (results.length === 0) return;

        for (const r of results) {
          studioAudioBuffersRef.current.set(r.sourceId, r.buffer);
        }

        applyTracksMutation((prev) => {
          const next = [...prev];
          for (const r of results) {
            const tr = next[r.ti];
            if (!tr) continue;
            const kept = tr.audioClips.filter(
              (c) => !se2ClipOverlapsBeatRange(c, range.startBeat, range.endBeat),
            );
            next[r.ti] = { ...tr, audioClips: [...kept, r.clip] };
          }
          return next;
        });
        gridCacheRef.current = null;
        audioPreviewScheduledRef.current.clear();
        stopScheduledPreviewAudioClips(scheduledPreviewAudioClipsRef.current);
      } finally {
        setConsolidateBusy(false);
      }
    },
    [applyTracksMutation, consolidateBusy, ensureCtx],
  );

  const se2ExportTracksPayload = useCallback((): Se2ExportBounceTrack[] => {
    return studioTracksRef.current.map((tr, trackIndex) => ({
      trackIndex,
      name: tr.name,
      kind: tr.kind,
      audioClips: tr.audioClips,
    }));
  }, []);

  const resolveSe2ExportRange = useCallback(() => {
    return se2ConsolidateRangeFromBars(
      consolidateStartBar,
      consolidateEndBar,
      SE2_ARRANGEMENT_BARS,
      beatsPerBarRef.current,
    );
  }, [consolidateStartBar, consolidateEndBar]);

  const runSe2StereoExport = useCallback(
    async (dest: 'mastering' | 'file') => {
      if (exportBusy || runningRef.current) return;
      const range = resolveSe2ExportRange();
      if (!range) return;
      if (!onExportToMasteringBay && dest === 'mastering') return;

      const base = se2ExportFilenameBase(consolidateStartBar, consolidateEndBar);
      const wavName = `${base}-stereo-mix.wav`;
      let saveTarget: FileSystemFileHandle | 'download' | null = null;
      if (dest === 'file') {
        saveTarget = await promptSe2WavSaveLocation(wavName);
        if (saveTarget === null) return;
      }

      setExportBusy(true);
      try {
        const ctx = await ensureCtx();
        const bpmNow = bpmRef.current;
        const tracks = se2ExportTracksPayload();
        const mix = await bounceSe2StereoMixInRange(
          ctx,
          tracks,
          studioAudioBuffersRef.current,
          {
            bpm: bpmNow,
            rangeStartBeat: range.startBeat,
            rangeEndBeat: range.endBeat,
          },
          {
            isMuted: (ti) => se2EffectiveTrackMuted(ti, trackMutesRef.current, trackSolosRef.current),
            vol127: (ti) => trackVolumesRef.current[ti] ?? MIXER_UNITY_VOL,
          },
        );
        if (!mix) return;

        const bpb = beatsPerBarRef.current;
        const barA = Math.floor(range.startBeat / bpb) + 1;
        const barB = Math.max(barA, Math.ceil(range.endBeat / bpb));
        const rangeLabel = `Bars ${barA}–${barB}`;

        if (dest === 'mastering') {
          onExportToMasteringBay?.({
            buffer: mix,
            meta: metaFromAudioBuffer(mix, `SE2 ${rangeLabel}`, 'se2-master', rangeLabel),
          });
          return;
        }

        await saveSe2AudioBufferWav(mix, wavName, saveTarget!);
      } finally {
        setExportBusy(false);
      }
    },
    [
      consolidateEndBar,
      consolidateStartBar,
      ensureCtx,
      exportBusy,
      onExportToMasteringBay,
      resolveSe2ExportRange,
      se2ExportTracksPayload,
    ],
  );

  const runSe2TrackOutsExport = useCallback(async () => {
    if (exportBusy || runningRef.current) return;
    const range = resolveSe2ExportRange();
    if (!range) return;

    const folderTarget = await promptSe2StemFolderSave();
    if (folderTarget === null) return;

    setExportBusy(true);
    try {
      const ctx = await ensureCtx();
      const stems = await bounceSe2TrackStemsInRange(
        ctx,
        se2ExportTracksPayload(),
        studioAudioBuffersRef.current,
        {
          bpm: bpmRef.current,
          rangeStartBeat: range.startBeat,
          rangeEndBeat: range.endBeat,
        },
      );
      if (stems.length === 0) return;
      const base = se2ExportFilenameBase(consolidateStartBar, consolidateEndBar);
      await saveSe2StemWavs(
        stems.map((s) => ({ name: s.name, buffer: s.buffer })),
        base,
        folderTarget,
      );
    } finally {
      setExportBusy(false);
    }
  }, [
    consolidateEndBar,
    consolidateStartBar,
    ensureCtx,
    exportBusy,
    resolveSe2ExportRange,
    se2ExportTracksPayload,
  ]);

  const patchTimelineAudioClipGain = useCallback(
    (trackIndex: number, clipId: string, gainDb: number) => {
      const nextDb = clampSe2ClipGainDb(gainDb);
      setStudioTracks((prev) => {
        const tr = prev[trackIndex];
        if (!tr) return prev;
        let changed = false;
        const audioClips = tr.audioClips.map((c) => {
          if (c.id !== clipId) return c;
          if (Math.abs((c.gainDb ?? 0) - nextDb) < 0.001) return c;
          changed = true;
          return { ...c, gainDb: nextDb };
        });
        if (!changed) return prev;
        const next = prev.map((t, i) => (i === trackIndex ? { ...t, audioClips } : t));
        studioTracksRef.current = next;
        return next;
      });
      gridCacheRef.current = null;
    },
    [],
  );

  const moveTimelineAudioClip = useCallback(
    (
      sourceTrackIndex: number,
      clipId: string,
      targetTrackIndex: number,
      patch: Partial<StudioAudioClip> & { startBeat: number },
    ) => {
      const applyPatch = (prev: MockMusioTrack[]) => {
        const src = prev[sourceTrackIndex];
        if (!src) return prev;
        const clipIndex = src.audioClips.findIndex((c) => c.id === clipId);
        if (clipIndex < 0) return prev;
        const base = src.audioClips[clipIndex]!;
        let clip: StudioAudioClip = {
          ...base,
          ...patch,
          startBeat: patch.startBeat,
        };
        const tb = totalBeatsForSig(beatsPerBarRef.current);
        clip.startBeat = Math.max(0, Math.min(tb - clip.durationBeats, clip.startBeat));
        clip.durationBeats = Math.max(
          SE2_MIN_AUDIO_CLIP_DURATION_BEATS,
          Math.min(tb - clip.startBeat, clip.durationBeats),
        );

        const tgtKind = prev[targetTrackIndex]?.kind;
        if (se2TrackUsesTimeStretchAlign(tgtKind)) {
          const buf = studioAudioBuffersRef.current.get(clip.sourceId);
          clip = se2PrepareClipForAlignLane(clip, buf, bpmRef.current);
        }

        const patchTrackAlignMeta = (t: MockMusioTrack): MockMusioTrack =>
          se2TrackUsesTimeStretchAlign(t.kind) && clip.sourceBpm != null
            ? { ...t, alignSourceBpm: clip.sourceBpm }
            : t;

        if (targetTrackIndex === sourceTrackIndex) {
          return prev.map((t, i) =>
            i === sourceTrackIndex
              ? patchTrackAlignMeta({
                  ...t,
                  audioClips: t.audioClips.map((c) => (c.id === clipId ? clip : c)),
                })
              : t,
          );
        }

        const tgt = prev[targetTrackIndex];
        if (!tgt || !se2TrackCanReceiveAudioClipDrag(tgt.kind)) return prev;

        return prev.map((t, i) => {
          if (i === sourceTrackIndex) {
            return { ...t, audioClips: t.audioClips.filter((c) => c.id !== clipId) };
          }
          if (i === targetTrackIndex) {
            return patchTrackAlignMeta({ ...t, audioClips: [...t.audioClips, clip] });
          }
          return t;
        });
      };

      const srcTrack = studioTracksRef.current[sourceTrackIndex];
      if (srcTrack) {
        const prefix = `${srcTrack.id}:${clipId}:`;
        for (const key of [...audioPreviewScheduledRef.current]) {
          if (key.startsWith(prefix)) audioPreviewScheduledRef.current.delete(key);
        }
        stopScheduledPreviewAudioClips(scheduledPreviewAudioClipsRef.current, sourceTrackIndex);
        if (targetTrackIndex !== sourceTrackIndex) {
          stopScheduledPreviewAudioClips(scheduledPreviewAudioClipsRef.current, targetTrackIndex);
        }
      }

      setStudioTracks(applyPatch);
      gridCacheRef.current = null;
    },
    [],
  );

  const toggleClipAlignTempoLock = useCallback((trackIndex: number, clipId: string) => {
    applyTracksMutation((prev) =>
      prev.map((t, i) => {
        if (i !== trackIndex || !se2TrackUsesTimeStretchAlign(t.kind)) return t;
        return {
          ...t,
          audioClips: t.audioClips.map((c) =>
            c.id === clipId ? { ...c, alignTempoLock: c.alignTempoLock === false } : c,
          ),
        };
      }),
    );
    clearStudioVocalFxPlaybackCache();
    audioPreviewScheduledRef.current.clear();
  }, [applyTracksMutation]);

  const [alignSourceBpmEditTrack, setAlignSourceBpmEditTrack] = useState<number | null>(null);

  const setTrackAlignSourceBpm = useCallback(
    (trackIndex: number, nextBpm: number) => {
      const bpm = Math.max(40, Math.min(300, Math.round(nextBpm)));
      if (!Number.isFinite(bpm)) return;
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== trackIndex || !se2TrackUsesTimeStretchAlign(t.kind)) return t;
          const clips = t.audioClips.map((c) => {
            const buf = studioAudioBuffersRef.current.get(c.sourceId);
            if (!buf) return { ...c, sourceBpm: bpm };
            return se2TrackAlignRescaleClipForSourceBpm(c, buf.duration, bpm);
          });
          return { ...t, alignSourceBpm: bpm, audioClips: clips };
        }),
      );
      setAlignSourceBpmEditTrack(null);
      audioPreviewScheduledRef.current.clear();
      gridCacheRef.current = null;
    },
    [applyTracksMutation],
  );

  const applySynthGenoComposeNotes = useCallback(
    (
      trackIndex: number,
      notes: MockMidiNote[],
      key?: { keyRoot: number; keyMode: StudioDetectedKeyMode },
    ) => {
      midiPreviewScheduledRef.current.clear();
      midiHardwareScheduledRef.current.clear();
      clearStudioVocalFxPlaybackCache();
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsSynthGenoChannel(t)
            ? {
                ...t,
                notes,
                ...(key
                  ? { trackKeyRoot: key.keyRoot, trackKeyMode: key.keyMode }
                  : {}),
              }
            : t,
        ),
      );

      const bars = studioInferBarCountFromNotes(notes, beatsPerBarRef.current, loopBarsRef.current);
      const loopBarsClamped = Math.max(1, Math.min(16, bars));
      const bpb = beatsPerBarRef.current;
      const loopEnd = loopRegionEndBeat(bpb, loopBarsClamped);
      setLoopOn(true);
      setLoopStartBeat(LOOP_REGION_START_BEAT);
      setLoopBars(loopBarsClamped);
      setLoopEndBeat(loopEnd);
      loopOnRef.current = true;
      loopStartBeatRef.current = LOOP_REGION_START_BEAT;
      loopBarsRef.current = loopBarsClamped;
      loopEndBeatRef.current = loopEnd;

      setSelectedTrackIndex(trackIndex);
      setSelectedPianoNoteIndex(null);
      setSelectedPianoNoteIndexes(new Set());
      openPianoRollEditor();

      if (runningRef.current) {
        void ensureCtx().then((ctx) => {
          if (ctx) refillLoopPreviewOnce(ctx, audioNow(ctx));
        });
      }
    },
    [
      applyTracksMutation,
      clearStudioVocalFxPlaybackCache,
      ensureCtx,
      openPianoRollEditor,
      refillLoopPreviewOnce,
    ],
  );

  const applySynthGenoFullStack = useCallback(
    (
      sourceIndex: number,
      stack: Se2SynthGenoStackPart[],
      bars: number,
      meta?: Se2SynthGenoApplyStackMeta,
    ) => {
      if (stack.length === 0) return;
      if (meta?.syncTransportBpm && meta.chordBpm != null) {
        setBpm(Math.max(40, Math.min(240, Math.round(meta.chordBpm))));
      }
      midiPreviewScheduledRef.current.clear();
      midiHardwareScheduledRef.current.clear();
      clearStudioVocalFxPlaybackCache();

      /** Timeline stack top → bottom: Chords, Melody, Bass (right above each other). */
      const stackOrder: Se2SynthGenoStackPart['role'][] = ['chords', 'melody', 'bass', 'keys', 'strings'];
      const orderedParts = [...stack].sort((a, b) => {
        const ai = stackOrder.indexOf(a.role);
        const bi = stackOrder.indexOf(b.role);
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      });

      const voiceSlots: { index: number; voice: Se2SynthGenoVoiceParams }[] = [];
      const drumKitIds: BeatLabProducerKitId[] = [];

      applyTracksMutation((prev) => {
        if (sourceIndex < 0 || sourceIndex >= prev.length) return prev;
        let tracks = [...prev];
        const src = tracks[sourceIndex];
        if (!src || !studioTrackIsSynthGenoChannel(src)) return prev;

        const baseName =
          src.name
            .replace(/\s+(Chords|Melody|Bass|Keys|Drums)$/i, '')
            .replace(/\s+Synth\s*Geno(\s+\d+)?$/i, '')
            .trim() || 'Synth Geno';

        const roleColor = (role: Se2SynthGenoStackPart['role']): string => {
          if (role === 'melody') return '#a78bfa';
          if (role === 'bass') return '#fbbf24';
          if (role === 'chords' || role === 'keys') return src.colorHex;
          return NEW_TRACK_COLOR_HEX[tracks.length % NEW_TRACK_COLOR_HEX.length]!;
        };

        const trackLabel = (part: Se2SynthGenoStackPart): string =>
          part.role === 'chords' ? 'Chords' : part.label;

        const writeSynthGenoPart = (
          part: Se2SynthGenoStackPart,
          at: number,
          replaceExisting: boolean,
        ): void => {
          const voice = se2SynthGenoVoiceForStackRole(
            part.role,
            part.label,
            part.synthGenoRole,
            part.synthGenoBankId,
          );
          const name = `${baseName} ${trackLabel(part)}`;
          const keyFields = meta
            ? { trackKeyRoot: meta.keyRoot, trackKeyMode: meta.keyMode }
            : {};

          if (replaceExisting) {
            tracks = tracks.map((t, i) =>
              i === at
                ? {
                    ...t,
                    name,
                    colorHex: roleColor(part.role),
                    notes: sortNotesLikePianoRoll(part.notes),
                    synthGenoPatchLabel: voice.label,
                    synthGenoPrompt: composePromptFromStackRole(part.synthGenoRole),
                    ...keyFields,
                  }
                : t,
            );
            voiceSlots.push({ index: at, voice });
            return;
          }

          if (tracks.length >= MAX_STUDIO_TRACKS) return;
          const newTrack: MockMusioTrack = {
            id: newTrackId(),
            name,
            laneNumber: se2NextStudioLaneNumber(tracks),
            colorHex: roleColor(part.role),
            kind: 'synthGeno',
            midiChannel: studioNextMidiChannel(tracks),
            synthGenoPrompt: composePromptFromStackRole(part.synthGenoRole),
            synthGenoComposePrompt: src.synthGenoComposePrompt,
            synthGenoPatchLabel: voice.label,
            notes: sortNotesLikePianoRoll(part.notes),
            audioClips: [],
            trackKeyRoot: meta?.keyRoot ?? songKeyRootRef.current,
            trackKeyMode: meta?.keyMode ?? songKeyModeRef.current,
          };
          tracks.splice(at, 0, newTrack);
          voiceSlots.push({ index: at, voice });
        };

        const [head, ...tail] = orderedParts;
        if (!head) return prev;

        if (head.trackKind === 'synthGeno') {
          writeSynthGenoPart(head, sourceIndex, true);
        }

        let insertAt = sourceIndex + 1;
        for (const part of tail) {
          if (tracks.length >= MAX_STUDIO_TRACKS) break;
          if (part.trackKind === 'synthGeno') {
            writeSynthGenoPart(part, insertAt, false);
            insertAt += 1;
            continue;
          }

          const newTrack: MockMusioTrack = {
            id: newTrackId(),
            name: part.role === 'drums' ? nextDrumsTrackName(tracks) : `${baseName} ${part.label}`,
            laneNumber: se2NextStudioLaneNumber(tracks),
            colorHex: NEW_TRACK_COLOR_HEX[tracks.length % NEW_TRACK_COLOR_HEX.length]!,
            kind: 'midi',
            midiChannel: part.role === 'drums' ? 10 : studioNextMidiChannel(tracks),
            midiInstrumentId: part.midiInstrumentId ?? 'gm:trap_drums',
            notes: sortNotesLikePianoRoll(part.notes),
            audioClips: [],
            drumPatternPresetId: part.drumPatternPresetId,
            drumProducerKitId: part.drumProducerKitId,
            beatLabPatternPresetId: part.drumPatternPresetId,
            trackKeyRoot: meta?.keyRoot ?? songKeyRootRef.current,
            trackKeyMode: meta?.keyMode ?? songKeyModeRef.current,
          };
          tracks.splice(insertAt, 0, newTrack);
          if (part.drumProducerKitId) drumKitIds.push(part.drumProducerKitId);
          insertAt += 1;
        }

        return tracks;
      });

      if (voiceSlots.length > 0) {
        setSe2SynthGenoVoices((voices) => {
          const next = [...voices];
          const sourceSlot = voiceSlots.find((s) => s.index === sourceIndex);
          for (const slot of voiceSlots
            .filter((s) => s.index !== sourceIndex)
            .sort((a, b) => b.index - a.index)) {
            next.splice(slot.index, 0, slot.voice);
          }
          if (sourceSlot) next[sourceIndex] = sourceSlot.voice;
          return next;
        });
      }

      const loopBarsClamped = Math.max(1, Math.min(16, bars));
      const bpb = beatsPerBarRef.current;
      const loopEnd = loopRegionEndBeat(bpb, loopBarsClamped);
      setLoopOn(true);
      setLoopStartBeat(LOOP_REGION_START_BEAT);
      setLoopBars(loopBarsClamped);
      setLoopEndBeat(loopEnd);
      loopOnRef.current = true;
      loopStartBeatRef.current = LOOP_REGION_START_BEAT;
      loopBarsRef.current = loopBarsClamped;
      loopEndBeatRef.current = loopEnd;

      setSelectedTrackIndex(sourceIndex);
      setSelectedPianoNoteIndex(null);
      setSelectedPianoNoteIndexes(new Set());
      setSynthGenoPanelOpen(false);
      openPianoRollEditor();

      for (const kitId of drumKitIds) {
        void ensureStudioDrumKitLoaded(kitId);
      }

      if (runningRef.current) {
        void ensureCtx().then((ctx) => {
          if (ctx) refillLoopPreviewOnce(ctx, audioNow(ctx));
        });
      }
    },
    [
      applyTracksMutation,
      clearStudioVocalFxPlaybackCache,
      ensureCtx,
      ensureStudioDrumKitLoaded,
      openPianoRollEditor,
      refillLoopPreviewOnce,
      setBpm,
      sortNotesLikePianoRoll,
    ],
  );

  const applySynthGenoPluginDraftToAudioTrack = useCallback(
    async (
      sourceIndex: number,
      draft: Se2SynthGenoPluginDraft,
      sounds: Se2SynthGenoPluginSoundSelection,
      previewOpts?: Se2SynthGenoPluginPreviewOpts,
    ) => {
      stopSynthGenoPluginPreview();
      midiPreviewScheduledRef.current.clear();
      midiHardwareScheduledRef.current.clear();
      clearStudioVocalFxPlaybackCache();

      const bpmNow = previewOpts?.bpm ?? bpmRef.current;
      const bpb = beatsPerBarRef.current;

      let buffer: AudioBuffer;
      try {
        buffer = await renderSe2SynthGenoPluginDraftToAudioBuffer({
          draft,
          sounds,
          bpm: bpmNow,
          beatsPerBar: bpb,
          bassGlide: previewOpts?.bassGlide,
          fusionLaneVoices: previewOpts?.fusionLaneVoices,
          chordGlide: previewOpts?.chordGlide,
          melodyGain: previewOpts?.melodyGain,
        });
      } catch (err) {
        console.warn('[Synth Geno] offline audio render failed:', err);
        return;
      }

      const sourceId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `src-${crypto.randomUUID()}`
          : `src-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const clipId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `ac-${crypto.randomUUID()}`
          : `ac-${Date.now()}`;
      studioAudioBuffersRef.current.set(sourceId, buffer);

      const loopBarsClamped = Math.max(1, Math.min(16, draft.bars));
      const loopBeats = loopBarsClamped * bpb;
      const durBeats = loopBeats;

      const src = studioTracksRef.current[sourceIndex];
      const baseName =
        src?.name
          ?.replace(/\s+(Chords|Melody|Bass|Keys|Drums|Audio)$/i, '')
          .replace(/\s+Synth\s*Geno(\s+\d+)?$/i, '')
          .trim() || SE2_SYNTH_GENO_BUILD_1_LABEL;
      const clipName = `${baseName} Fusion · 8 bars`;
      const trackName = `${baseName} Audio`;
      const newClip = {
        id: clipId,
        sourceId,
        startBeat: 0,
        durationBeats: Math.max(1 / 16, durBeats),
        name: clipName,
      };

      const placeOnSource = previewOpts?.placeOnSourceTrack === true;
      let selectedIndex = sourceIndex;

      applyTracksMutation((prev) => {
        if (placeOnSource) {
          return prev.map((t, i) =>
            i === sourceIndex
              ? { ...t, audioClips: [newClip] }
              : t,
          );
        }
        if (prev.length >= MAX_STUDIO_TRACKS) return prev;
        const insertAt = Math.min(sourceIndex + 1, prev.length);
        selectedIndex = insertAt;
        const newTrack: MockMusioTrack = {
          id: newTrackId(),
          name: trackName,
          laneNumber: se2NextStudioLaneNumber(prev),
          colorHex: NEW_TRACK_COLOR_HEX[(insertAt + 1) % NEW_TRACK_COLOR_HEX.length]!,
          kind: 'audio',
          notes: [],
          audioClips: [newClip],
          audioInputDeviceId: '',
        };
        const next = [...prev];
        next.splice(insertAt, 0, newTrack);
        return next;
      });

      const loopEnd = loopRegionEndBeat(bpb, loopBarsClamped);
      setLoopOn(true);
      setLoopStartBeat(LOOP_REGION_START_BEAT);
      setLoopBars(loopBarsClamped);
      setLoopEndBeat(loopEnd);
      loopOnRef.current = true;
      loopStartBeatRef.current = LOOP_REGION_START_BEAT;
      loopBarsRef.current = loopBarsClamped;
      loopEndBeatRef.current = loopEnd;

      setSelectedTrackIndex(selectedIndex);
      setSelectedPianoNoteIndex(null);
      setSelectedPianoNoteIndexes(new Set());
      if (!placeOnSource) {
        setSynthGenoPanelOpen(false);
      }

      if (runningRef.current) {
        void ensureCtx().then((ctx) => {
          if (ctx) refillLoopPreviewOnce(ctx, audioNow(ctx));
        });
      }
    },
    [
      applyTracksMutation,
      clearStudioVocalFxPlaybackCache,
      ensureCtx,
      refillLoopPreviewOnce,
      stopSynthGenoPluginPreview,
    ],
  );

  useEffect(() => {
    if (!pendingNeuralHumStudioImport || pendingNeuralHumStudioImport.notes.length === 0) return;
    const payload = pendingNeuralHumStudioImport;
    let cancelled = false;

    void (async () => {
      const bpmNow = bpmRef.current;
      const bpb = beatsPerBarRef.current;
      const tb = totalBeatsForSig(bpb);
      const baseName = (payload.trackName ?? 'Neural Hum').slice(0, 48);
      const notes: MockMidiNote[] = payload.notes
        .map((n) => ({
          pitch: n.pitch,
          velocity: n.velocity,
          startBeat: Math.max(0, Math.min(tb - 1 / 128, n.startBeat)),
          durationBeats: Math.max(
            1 / 128,
            Math.min(tb - Math.max(0, n.startBeat), n.durationBeats),
          ),
        }))
        .filter((n) => n.durationBeats >= 1 / 64);

      if (notes.length === 0) {
        if (!cancelled) onPendingNeuralHumStudioConsumed?.();
        return;
      }

      let audioTrack: Omit<MockMusioTrack, 'laneNumber'> | null = null;
      const wav = payload.wavBlob;
      if (wav && wav.size > 0) {
        try {
          const ctx = await ensureCtx();
          if (ctx.state === 'suspended') {
            try {
              await ctx.resume();
            } catch {
              /* autoplay */
            }
          }
          const raw = await wav.arrayBuffer();
          const buffer = await ctx.decodeAudioData(raw.slice(0));
          if (!cancelled) {
            const sourceId =
              typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? `src-${crypto.randomUUID()}`
                : `src-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            const clipId =
              typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? `ac-${crypto.randomUUID()}`
                : `ac-${Date.now()}`;
            studioAudioBuffersRef.current.set(sourceId, buffer);
            const durBeats = Math.min(tb, audioDurationBeatsFromSeconds(buffer.duration, bpmNow));
            audioTrack = {
              id: newTrackId(),
              name: `${baseName} (render)`,
              colorHex: NEW_TRACK_COLOR_HEX[1]!,
              kind: 'audio',
              notes: [],
              audioClips: [
                {
                  id: clipId,
                  sourceId,
                  startBeat: 0,
                  durationBeats: durBeats,
                  name: baseName,
                },
              ],
            };
          }
        } catch (e) {
          console.warn('Studio Editor 2: Neural Hum audio reference skipped', e);
        }
      }

      if (cancelled) return;

      applyTracksMutation((prev) => {
        if (prev.length >= MAX_STUDIO_TRACKS) return prev;
        let nextLn = se2NextStudioLaneNumber(prev);
        const insert: MockMusioTrack[] = [];
        if (audioTrack) {
          insert.push({ ...audioTrack, laneNumber: nextLn });
          nextLn = se2NextStudioLaneNumber([...prev, ...insert]);
        }
        insert.push({
          id: newTrackId(),
          name: `${baseName} MIDI`,
          laneNumber: nextLn,
          colorHex: NEW_TRACK_COLOR_HEX[0]!,
          kind: 'midi',
          midiChannel: studioNextMidiChannel(prev),
          midiInstrumentId: studioDefaultMidiInstrumentForTrackName(`${baseName} MIDI`),
          notes,
          audioClips: [],
        });
        const room = MAX_STUDIO_TRACKS - prev.length;
        return [...insert.slice(0, room), ...prev];
      });

      openPianoRollEditor();
      if (!cancelled) onPendingNeuralHumStudioConsumed?.();
    })();

    return () => {
      cancelled = true;
    };
  }, [
    applyTracksMutation,
    ensureCtx,
    onPendingNeuralHumStudioConsumed,
    openPianoRollEditor,
    pendingNeuralHumStudioImport,
  ]);

  useEffect(() => {
    if (!pendingBeatPadsStudioImport || pendingBeatPadsStudioImport.notes.length === 0) return;
    const payload = pendingBeatPadsStudioImport;
    const bpb = beatsPerBarRef.current;
    const tb = totalBeatsForSig(bpb);
    const loopBarsClamped = Math.max(1, Math.round(payload.loopBars));
    const loopBeats = Math.min(tb, bpb * loopBarsClamped);
    const baseName = (payload.trackName ?? 'Beat Pads').slice(0, 48);

    setBpm(Math.max(40, Math.min(240, Math.round(payload.transportBpm))));
    setLoopBars(loopBarsClamped);
    setLoopStartBeat(0);
    setLoopEndBeat(loopBeats);
    setLoopOn(true);

    const notes: MockMidiNote[] = payload.notes
      .map((n) => ({
        pitch: n.pitch,
        velocity: n.velocity,
        startBeat: Math.max(0, Math.min(loopBeats - 1 / 128, n.startBeat)),
        durationBeats: Math.max(
          1 / 128,
          Math.min(loopBeats - Math.max(0, n.startBeat), n.durationBeats),
        ),
      }))
      .filter((n) => n.durationBeats >= 1 / 64);

    if (notes.length === 0) {
      onPendingBeatPadsStudioConsumed?.();
      return;
    }

    applyTracksMutation((prev) => {
      if (prev.length >= MAX_STUDIO_TRACKS) return prev;
      const nextLn = se2NextStudioLaneNumber(prev);
      const insert: MockMusioTrack = {
        id: newTrackId(),
        name: baseName,
        laneNumber: nextLn,
        colorHex: NEW_TRACK_COLOR_HEX[0]!,
        kind: 'midi',
        midiChannel: 10,
        midiInstrumentId: 'gm:trap_drums',
        notes,
        audioClips: [],
      };
      return [insert, ...prev];
    });

    openPianoRollEditor();
    onPendingBeatPadsStudioConsumed?.();
  }, [
    applyTracksMutation,
    onPendingBeatPadsStudioConsumed,
    openPianoRollEditor,
    pendingBeatPadsStudioImport,
  ]);

  useEffect(() => {
    se2PublishBeatPadsBridgeSnapshot({
      se2Active: true,
      bpm,
      loopBars,
      beatsPerBar,
      loopStartBeat,
      loopEndBeat,
      transport: running ? 'playing' : 'stopped',
      tracks: studioTracks,
    });
  }, [bpm, loopBars, beatsPerBar, loopStartBeat, loopEndBeat, running, studioTracks]);

  useLayoutEffect(() => {
    se2PublishBeatPadsBridgeSnapshot({
      se2Active: true,
      bpm,
      loopBars,
      beatsPerBar,
      loopStartBeat,
      loopEndBeat,
      transport: running ? 'playing' : 'stopped',
      tracks: studioTracks,
    });
    return () => {
      se2PublishBeatPadsBridgeSnapshot({
        se2Active: false,
        bpm: bpmRef.current,
        loopBars: loopBarsRef.current,
        beatsPerBar: beatsPerBarRef.current,
        loopStartBeat,
        loopEndBeat,
        transport: running ? 'playing' : 'stopped',
        tracks: studioTracksRef.current,
      });
    };
  }, []);

  useEffect(() => {
    if (!isScreenActive) return;
    const handleGenoTrigger = (detail: { trackId?: string; slot: BeatPadsGenoBuildSlot }) => {
      const tracks = studioTracksRef.current;
      if (detail.slot === 'ultra') {
        let ti = detail.trackId ? tracks.findIndex((t) => t.id === detail.trackId) : -1;
        if (ti < 0 || tracks[ti]?.kind !== 'genoUltraSynth') {
          ti = tracks.findIndex((t) => t.kind === 'genoUltraSynth');
        }
        if (ti < 0) return;
        setSelectedTrackIndex(ti);
        setGenoUltraSynthPanelOpen(true);
        setShowPianoRoll(true);
        return;
      }
      let ti = detail.trackId ? tracks.findIndex((t) => t.id === detail.trackId) : -1;
      if (ti < 0 || tracks[ti]?.kind !== 'synthGeno') {
        const genoIdx = tracks
          .map((t, i) => (t.kind === 'synthGeno' ? i : -1))
          .filter((i) => i >= 0);
        ti = genoIdx[detail.slot === 'b02' ? 1 : 0] ?? genoIdx[0] ?? -1;
      }
      if (ti < 0) return;
      setSelectedTrackIndex(ti);
      setSynthGenoPanelOpen(true);
      setShowPianoRoll(true);
    };
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ trackId?: string; slot: BeatPadsGenoBuildSlot }>).detail;
      if (detail?.slot) handleGenoTrigger(detail);
    };
    window.addEventListener(BEAT_PADS_GENO_TRIGGER_EVENT, onEvent);
    const pending = consumeBeatPadsGenoTrigger();
    if (pending) handleGenoTrigger(pending);
    return () => window.removeEventListener(BEAT_PADS_GENO_TRIGGER_EVENT, onEvent);
  }, [isScreenActive]);

  useEffect(() => {
    if (!pendingAiMatchStudioImport || pendingAiMatchStudioImport.stack.length === 0) return;
    const payload = pendingAiMatchStudioImport;
    let cancelled = false;

    void (async () => {
      const bpmNow = Math.max(40, Math.min(240, Math.round(payload.bpm)));
      const bpb = beatsPerBarRef.current;
      const loopBarsClamped = Math.max(1, Math.min(16, payload.bars));
      const loopBeats = Math.min(totalBeatsForSig(bpb), bpb * loopBarsClamped);
      const baseName = (payload.trackName ?? 'AI Music Match').slice(0, 48);

      setBpm(bpmNow);
      setSongKeyRoot(payload.keyRoot);
      setSongKeyMode(payload.keyMode);
      setLoopBars(loopBarsClamped);
      setLoopStartBeat(0);
      setLoopEndBeat(loopBeats);
      setLoopOn(true);

      let audioTrack: Omit<MockMusioTrack, 'laneNumber'> | null = null;
      try {
        const ctx = await ensureCtx();
        if (ctx?.state === 'suspended') {
          try {
            await ctx.resume();
          } catch {
            /* autoplay */
          }
        }
        if (ctx) {
          const raw = await payload.audioBlob.arrayBuffer();
          const buffer = await ctx.decodeAudioData(raw.slice(0));
          if (!cancelled) {
            const sourceId =
              typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? `src-${crypto.randomUUID()}`
                : `src-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            const clipId =
              typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? `ac-${crypto.randomUUID()}`
                : `ac-${Date.now()}`;
            studioAudioBuffersRef.current.set(sourceId, buffer);
            const durBeats = Math.min(
              totalBeatsForSig(bpb),
              audioDurationBeatsFromSeconds(buffer.duration, bpmNow),
            );
            audioTrack = {
              id: newTrackId(),
              name: `${baseName} (vocal)`,
              colorHex: NEW_TRACK_COLOR_HEX[1]!,
              kind: 'audio',
              notes: [],
              audioClips: [
                {
                  id: clipId,
                  sourceId,
                  startBeat: 0,
                  durationBeats: durBeats,
                  name: baseName,
                },
              ],
            };
          }
        }
      } catch (e) {
        console.warn('Studio Editor 2: AI Music Match vocal track skipped', e);
      }

      if (cancelled) return;

      applyTracksMutation((prev) => {
        if (prev.length >= MAX_STUDIO_TRACKS) return prev;
        const inserts: MockMusioTrack[] = [];
        let nextLn = se2NextStudioLaneNumber(prev);

        if (audioTrack) {
          inserts.push({ ...audioTrack, laneNumber: nextLn });
          nextLn = se2NextStudioLaneNumber([...prev, ...inserts]);
        }

        const genoShell: MockMusioTrack = {
          id: newTrackId(),
          name: nextSynthGenoTrackName([...prev, ...inserts]),
          laneNumber: nextLn,
          colorHex: '#00E5CC',
          kind: 'synthGeno',
          midiChannel: studioNextMidiChannel([...prev, ...inserts]),
          synthGenoPrompt: 'warm keys with soft attack',
          synthGenoComposePrompt: 'AI Music Match chords',
          synthGenoPatchLabel: se2SynthGenoDefaultVoice().label,
          notes: [],
          audioClips: [],
          trackKeyRoot: payload.keyRoot,
          trackKeyMode: payload.keyMode,
        };
        inserts.push(genoShell);

        const room = MAX_STUDIO_TRACKS - prev.length;
        return [...inserts.slice(0, room), ...prev];
      });

      const genoIndex = audioTrack ? 1 : 0;
      window.setTimeout(() => {
        if (cancelled) return;
        applySynthGenoFullStack(genoIndex, payload.stack, payload.bars, {
          keyRoot: payload.keyRoot,
          keyMode: payload.keyMode,
        });
        openPianoRollEditor();
        onPendingAiMatchStudioConsumed?.();
      }, 0);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    applySynthGenoFullStack,
    applyTracksMutation,
    ensureCtx,
    onPendingAiMatchStudioConsumed,
    openPianoRollEditor,
    pendingAiMatchStudioImport,
  ]);

  const closeEditorContextMenu = useCallback(() => {
    midiMenuTargetRef.current = null;
    setContextMenuHasNoteTarget(false);
    setContextMenuHasAudioTarget(false);
    setEditorContextMenu(null);
  }, []);

  const clearSelectedPianoNotes = useCallback(() => {
    setSelectedPianoNoteIndex(null);
    setSelectedPianoNoteIndexes(new Set());
  }, []);

  const clearSelectedTimelineAudioClip = useCallback(() => {
    setSelectedTimelineAudioClip(null);
    setAudioClipSplitMarkerBeat(null);
  }, []);

  const resolveSelectedAudioClip = useCallback((): {
    trackIndex: number;
    clip: StudioAudioClip;
  } | null => {
    const sel = selectedTimelineAudioClipRef.current;
    if (!sel) return null;
    const tr = studioTracksRef.current[sel.trackIndex];
    const clip = tr?.audioClips.find((c) => c.id === sel.clipId);
    if (!tr || !clip) return null;
    return { trackIndex: sel.trackIndex, clip };
  }, []);

  const audioCopySelection = useCallback(() => {
    const hit = resolveSelectedAudioClip();
    if (!hit) return;
    audioClipboardRef.current = { ...hit.clip };
    setAudioClipboardHeld(true);
  }, [resolveSelectedAudioClip]);

  const audioCutSelection = useCallback(() => {
    const hit = resolveSelectedAudioClip();
    if (!hit) return;
    audioClipboardRef.current = { ...hit.clip };
    setAudioClipboardHeld(true);
    applyTracksMutation((prev) =>
      prev.map((t, i) =>
        i === hit.trackIndex ? { ...t, audioClips: t.audioClips.filter((c) => c.id !== hit.clip.id) } : t,
      ),
    );
    clearSelectedTimelineAudioClip();
  }, [applyTracksMutation, clearSelectedTimelineAudioClip, resolveSelectedAudioClip]);

  const audioPasteSelection = useCallback(() => {
    const buf = audioClipboardRef.current;
    if (!buf) return;
    const ti = selectedTrackIndexRef.current;
    const tr = studioTracksRef.current[ti];
    if (!tr || !se2TrackIsAudioClipLane(tr.kind)) return;
    const tb = totalBeatsRef.current;
    const bpb = beatsPerBarRef.current;
    const snap = pianoSnapEffRef.current;
    const pasteBeat = snapTimelineAudioClipStartBeat(
      cursorBeatRef.current,
      tb,
      bpb,
      snap,
      false,
      false,
    );
    const startBeat = Math.max(0, Math.min(tb - buf.durationBeats, pasteBeat));
    const pasted: StudioAudioClip = {
      ...buf,
      id: se2NewAudioClipId(),
      startBeat,
    };
    applyTracksMutation((prev) =>
      prev.map((t, i) => {
        if (i !== ti) return t;
        let pastedClip: StudioAudioClip = pasted;
        if (se2TrackUsesTimeStretchAlign(t.kind)) {
          const buf = studioAudioBuffersRef.current.get(pasted.sourceId);
          pastedClip = se2PrepareClipForAlignLane(pasted, buf, bpmRef.current);
        }
        return se2TrackUsesTimeStretchAlign(t.kind) && pastedClip.sourceBpm != null
          ? { ...t, audioClips: [...t.audioClips, pastedClip], alignSourceBpm: pastedClip.sourceBpm }
          : { ...t, audioClips: [...t.audioClips, pastedClip] };
      }),
    );
    setSelectedTimelineAudioClip({ trackIndex: ti, clipId: pasted.id });
    setAudioClipSplitMarkerBeat(null);
  }, [applyTracksMutation]);

  const audioDuplicateSelection = useCallback(() => {
    const hit = resolveSelectedAudioClip();
    if (!hit) return;
    const tb = totalBeatsRef.current;
    const bpb = beatsPerBarRef.current;
    const snap = pianoSnapEffRef.current;
    let newStart = snapTimelineAudioClipStartBeat(
      hit.clip.startBeat + hit.clip.durationBeats,
      tb,
      bpb,
      snap,
      false,
      false,
    );
    newStart = Math.max(0, Math.min(tb - hit.clip.durationBeats, newStart));
    const dup: StudioAudioClip = {
      ...hit.clip,
      id: se2NewAudioClipId(),
      startBeat: newStart,
    };
    applyTracksMutation((prev) =>
      prev.map((t, i) =>
        i === hit.trackIndex ? { ...t, audioClips: [...t.audioClips, dup] } : t,
      ),
    );
    setSelectedTimelineAudioClip({ trackIndex: hit.trackIndex, clipId: dup.id });
    setAudioClipSplitMarkerBeat(null);
  }, [applyTracksMutation, resolveSelectedAudioClip]);

  const audioSplitSelection = useCallback(() => {
    const hit = resolveSelectedAudioClip();
    if (!hit) return;
    const splitBeat =
      audioClipSplitMarkerBeatRef.current ??
      snapTimelineAudioClipStartBeat(
        cursorBeatRef.current,
        totalBeatsRef.current,
        beatsPerBarRef.current,
        pianoSnapEffRef.current,
        false,
        false,
      );
    const pair = se2SplitAudioClipAtBeat(hit.clip, splitBeat);
    if (!pair) return;
    const [left, right] = pair;
    applyTracksMutation((prev) =>
      prev.map((t, i) => {
        if (i !== hit.trackIndex) return t;
        const next = t.audioClips.flatMap((c) => (c.id === hit.clip.id ? [left, right] : [c]));
        return { ...t, audioClips: next };
      }),
    );
    setSelectedTimelineAudioClip({ trackIndex: hit.trackIndex, clipId: right.id });
    setAudioClipSplitMarkerBeat(null);
  }, [applyTracksMutation, resolveSelectedAudioClip]);

  const splitTimelineAudioClipAtBeat = useCallback(
    (trackIndex: number, clipId: string, splitBeat: number) => {
      const tr = studioTracksRef.current[trackIndex];
      const clip = tr?.audioClips.find((c) => c.id === clipId);
      if (!tr || !clip) return;
      const buf = studioAudioBuffersRef.current.get(clip.sourceId);
      const stretchAlign = se2ClipUsesAlignStretchPlayback(tr.kind, clip);
      const offScale =
        stretchAlign && buf
          ? se2TrackAlignClipStretchRateFromClip(clip, buf.duration, bpmRef.current)
          : 1;
      const pair = se2SplitAudioClipAtBeat(clip, splitBeat, { sourceOffsetBeatScale: offScale });
      if (!pair) return;
      const [left, right] = pair;
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== trackIndex) return t;
          const next = t.audioClips.flatMap((c) => (c.id === clipId ? [left, right] : [c]));
          return { ...t, audioClips: next };
        }),
      );
      setSelectedTimelineAudioClip({ trackIndex, clipId: right.id });
      setAudioClipSplitMarkerBeat(null);
      const prefix = `${tr.id}:${clipId}:`;
      for (const key of [...audioPreviewScheduledRef.current]) {
        if (key.startsWith(prefix)) audioPreviewScheduledRef.current.delete(key);
      }
      stopScheduledPreviewAudioClips(scheduledPreviewAudioClipsRef.current, trackIndex);
    },
    [applyTracksMutation],
  );

  const audioDeleteSelection = useCallback(() => {
    const hit = resolveSelectedAudioClip();
    if (!hit) return;
    applyTracksMutation((prev) =>
      prev.map((t, i) =>
        i === hit.trackIndex ? { ...t, audioClips: t.audioClips.filter((c) => c.id !== hit.clip.id) } : t,
      ),
    );
    clearSelectedTimelineAudioClip();
  }, [applyTracksMutation, clearSelectedTimelineAudioClip, resolveSelectedAudioClip]);

  const regenerateGrooveLeadMelody = useCallback(
    (trackIndex: number) => {
      const tr = studioTracksRef.current[trackIndex];
      if (!tr || !studioTrackIsInstrumentHarmonyChannel(tr)) return;
      const steps = tr.harmonySteps ?? [];
      if (steps.length === 0) return;
      const soundKind = tr.harmonySoundKind ?? (studioParseGrooveLeadInstrumentId(tr.midiInstrumentId) ? 'grooveLead' : 'orchHit');
      if (soundKind !== 'grooveLead') return;
      applyHarmonyRootHits(
        trackIndex,
        steps,
        'grooveLead',
        tr.harmonyOrchHitId ?? GROOVE_ORCHESTRA_HIT_DEFAULT,
        tr.harmonyGrooveLeadId ?? GROOVE_LAB_LEAD_SOUND_DEFAULT,
        studioNormalizeHarmonyLoopBars(tr.harmonyLoopBars),
        tr.harmonyMelodyStyleId ?? studioDefaultHarmonyMelodyStyleId(),
      );
    },
    [applyHarmonyRootHits],
  );

  const regenerateDedicatedGrooveLeadMelody = useCallback(
    (trackIndex: number) => {
      const tr = studioTracksRef.current[trackIndex];
      if (!tr || !studioTrackIsGrooveLeadChannel(tr)) return;
      const harmonyTr = se2ResolveGrooveLeadHarmonyTrack(studioTracksRef.current, tr, tr.id);
      if (!harmonyTr) return;
      const detected = studioTrackDetectedKey(harmonyTr);
      const keyRoot = detected.keyRoot ?? songKeyRootRef.current;
      const keyMode = detected.keyMode ?? songKeyModeRef.current;
      const melodySeed = (tr.grooveLeadMelodySeed ?? 0) + 1;
      const built = se2GrooveLeadMelodyFromHarmonySource({
        harmonyTr: harmonyTr as GenoUltraArpSe2TrackChordInput,
        beatsPerBar,
        loopBars: loopBarsRef.current,
        keyRoot,
        keyMode,
        seed: melodySeed,
        bpm: bpmRef.current,
      });
      if ('message' in built || built.length === 0) return;
      midiPreviewScheduledRef.current.clear();
      midiHardwareScheduledRef.current.clear();
      setStudioTracks((prev) =>
        prev.map((t, i) => {
          if (i !== trackIndex || !studioTrackIsGrooveLeadChannel(t)) return t;
          return {
            ...t,
            notes: built,
            grooveLeadMelodySeed: melodySeed,
          };
        }),
      );
    },
    [beatsPerBar],
  );

  const clearTrackLaneContent = useCallback(
    (trackIndex: number) => {
      const tr = studioTracksRef.current[trackIndex];
      if (!tr || !se2TrackHasClearableLaneContent(tr)) return;
      midiPreviewScheduledRef.current.clear();
      midiHardwareScheduledRef.current.clear();
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== trackIndex) return t;
          if (se2TrackIsAudioClipLane(t.kind)) {
            return { ...t, audioClips: [] };
          }
          if (!studioTrackOutputsMidi(t)) return t;
          const cleared: MockMusioTrack = { ...t, notes: [] };
          if (studioTrackIsDrumChannel(t)) {
            cleared.drumPatternPresetId = undefined;
            cleared.beatLabPatternPresetId = undefined;
          }
          return cleared;
        }),
      );
      clearSelectedPianoNotes();
      midiMenuTargetRef.current = null;
      if (runningRef.current) {
        const ctx = ctxRef.current;
        if (ctx && ctx.state !== 'closed') {
          midiPreviewScheduledRef.current.clear();
          midiHardwareScheduledRef.current.clear();
          audioPreviewScheduledRef.current.clear();
          refillLoopPreviewOnce(ctx, audioNow(ctx));
        }
      }
    },
    [applyTracksMutation, clearSelectedPianoNotes, refillLoopPreviewOnce],
  );

  /** @deprecated name — use {@link clearTrackLaneContent} */
  const clearInstrumentChannelNotes = clearTrackLaneContent;

  const loadDrumPatternOnTrack = useCallback(
    async (trackIndex: number, preset: PianoRollDrumPreset) => {
      const tr = studioTracksRef.current[trackIndex];
      if (!tr || !studioTrackIsDrumChannel(tr)) return;
      const bpb = beatsPerBarRef.current;
      const load = studioBuildDrumPatternLoad(preset, bpb);
      const loopBars = STUDIO_DRUM_PATTERN_LOOP_BARS;
      const loopEnd = loopRegionEndBeat(bpb, loopBars);
      const tiledNotes = studioTileDrumPatternNotes(load.notes, bpb, loopBars);
      const inst = studioDrumInstrumentOptionForPreset(preset)?.id;
      midiPreviewScheduledRef.current.clear();
      midiHardwareScheduledRef.current.clear();
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsDrumChannel(t)
            ? {
                ...t,
                notes: sortNotesLikePianoRoll(tiledNotes),
                drumPatternPresetId: load.presetId,
                beatLabPatternPresetId: undefined,
                drumProducerKitId: load.producerKitId,
                ...(studioTrackIsDrumGeneratorChannel(t)
                  ? { drumGenModernPresetId: undefined, drumGenModernGenre: undefined }
                  : {}),
                ...(inst ? { midiInstrumentId: inst } : {}),
              }
            : t,
        ),
      );
      setLoopOn(true);
      setLoopStartBeat(LOOP_REGION_START_BEAT);
      setLoopBars(loopBars);
      setLoopEndBeat(loopEnd);
      loopOnRef.current = true;
      loopStartBeatRef.current = LOOP_REGION_START_BEAT;
      loopBarsRef.current = loopBars;
      loopEndBeatRef.current = loopEnd;
      setSelectedTrackIndex(trackIndex);
      clearSelectedPianoNotes();
      await ensureStudioDrumKitLoaded(load.producerKitId);
      if (runningRef.current) {
        const ctx = ctxRef.current;
        if (ctx && ctx.state !== 'closed') {
          midiPreviewScheduledRef.current.clear();
          midiHardwareScheduledRef.current.clear();
          audioPreviewScheduledRef.current.clear();
          refillLoopPreviewOnce(ctx, audioNow(ctx));
          launchWapiAnims(cursorBeatRef.current, true);
        }
      }
    },
    [
      applyTracksMutation,
      clearSelectedPianoNotes,
      ensureStudioDrumKitLoaded,
      launchWapiAnims,
      refillLoopPreviewOnce,
      sortNotesLikePianoRoll,
    ],
  );

  const loadBeatLabPatternOnTrack = useCallback(
    async (trackIndex: number, preset: PatternPreset) => {
      const tr = studioTracksRef.current[trackIndex];
      if (!tr || !studioTrackIsDrumChannel(tr)) return;
      const bpb = beatsPerBarRef.current;
      const load = studioBuildBeatLabPatternLoad(preset, bpb);
      const loopBars = STUDIO_DRUM_PATTERN_LOOP_BARS;
      const loopEnd = loopRegionEndBeat(bpb, loopBars);
      const tiledNotes = studioTileDrumPatternNotes(load.notes, bpb, loopBars);
      const inst = studioDrumInstrumentOptionForBeatLabPreset(preset)?.id;
      midiPreviewScheduledRef.current.clear();
      midiHardwareScheduledRef.current.clear();
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsDrumChannel(t)
            ? {
                ...t,
                notes: sortNotesLikePianoRoll(tiledNotes),
                beatLabPatternPresetId: load.presetId,
                drumPatternPresetId: undefined,
                drumProducerKitId: load.producerKitId,
                ...(studioTrackIsDrumGeneratorChannel(t)
                  ? { drumGenModernPresetId: undefined, drumGenModernGenre: undefined }
                  : {}),
                ...(inst ? { midiInstrumentId: inst } : {}),
              }
            : t,
        ),
      );
      setLoopOn(true);
      setLoopStartBeat(LOOP_REGION_START_BEAT);
      setLoopBars(loopBars);
      setLoopEndBeat(loopEnd);
      loopOnRef.current = true;
      loopStartBeatRef.current = LOOP_REGION_START_BEAT;
      loopBarsRef.current = loopBars;
      loopEndBeatRef.current = loopEnd;
      setSelectedTrackIndex(trackIndex);
      clearSelectedPianoNotes();
      await ensureStudioDrumKitLoaded(load.producerKitId);
      if (runningRef.current) {
        const ctx = ctxRef.current;
        if (ctx && ctx.state !== 'closed') {
          midiPreviewScheduledRef.current.clear();
          midiHardwareScheduledRef.current.clear();
          audioPreviewScheduledRef.current.clear();
          refillLoopPreviewOnce(ctx, audioNow(ctx));
          launchWapiAnims(cursorBeatRef.current, true);
        }
      }
    },
    [
      applyTracksMutation,
      clearSelectedPianoNotes,
      ensureStudioDrumKitLoaded,
      launchWapiAnims,
      refillLoopPreviewOnce,
      sortNotesLikePianoRoll,
    ],
  );

  const applyDrumGeneratorLoad = useCallback(
    async (trackIndex: number, load: Se2DrumGeneratorLoad, nextSeed: number) => {
      const tr = studioTracksRef.current[trackIndex];
      if (!tr || !studioTrackIsDrumGeneratorChannel(tr)) return;
      if (load.transportBpm != null && Number.isFinite(load.transportBpm)) {
        setBpm(Math.max(40, Math.min(240, Math.round(load.transportBpm))));
      }
      studioDrumTrackSessionsRef.current.delete(tr.id);
      const bpb = beatsPerBarRef.current;
      const loopBars = STUDIO_DRUM_PATTERN_LOOP_BARS;
      const loopEnd = loopRegionEndBeat(bpb, loopBars);
      midiPreviewScheduledRef.current.clear();
      midiHardwareScheduledRef.current.clear();
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsDrumGeneratorChannel(t)
            ? {
                ...t,
                notes: sortNotesLikePianoRoll(load.notes),
                drumGenSeed: nextSeed,
                beatLabPatternPresetId: load.presetId,
                drumPatternPresetId: undefined,
                drumProducerKitId: load.producerKitId,
                ...(load.modernGenre
                  ? {
                      drumGenModernPresetId: load.presetId,
                      drumGenModernGenre: load.modernGenre,
                    }
                  : {}),
                ...(load.midiInstrumentId ? { midiInstrumentId: load.midiInstrumentId } : {}),
              }
            : t,
        ),
      );
      setLoopOn(true);
      setLoopStartBeat(LOOP_REGION_START_BEAT);
      setLoopBars(loopBars);
      setLoopEndBeat(loopEnd);
      loopOnRef.current = true;
      loopStartBeatRef.current = LOOP_REGION_START_BEAT;
      loopBarsRef.current = loopBars;
      loopEndBeatRef.current = loopEnd;
      clearSelectedPianoNotes();
      await ensureStudioDrumKitLoaded(load.producerKitId);
      if (runningRef.current) {
        const ctx = ctxRef.current;
        if (ctx && ctx.state !== 'closed') {
          midiPreviewScheduledRef.current.clear();
          midiHardwareScheduledRef.current.clear();
          audioPreviewScheduledRef.current.clear();
          refillLoopPreviewOnce(ctx, audioNow(ctx));
          launchWapiAnims(cursorBeatRef.current, true);
        }
      }
    },
    [
      applyTracksMutation,
      clearSelectedPianoNotes,
      ensureStudioDrumKitLoaded,
      launchWapiAnims,
      refillLoopPreviewOnce,
      setBpm,
      sortNotesLikePianoRoll,
    ],
  );

  const updateDrumGenStyle = useCallback((trackIndex: number, style: Se2DrumGenStyle) => {
    applyTracksMutation((prev) =>
      prev.map((t, i) => (i === trackIndex && studioTrackIsDrumGeneratorChannel(t) ? { ...t, drumGenStyle: style } : t)),
    );
  }, [applyTracksMutation]);

  const updateDrumGenHarmonyTrackId = useCallback((trackIndex: number, trackId: string) => {
    applyTracksMutation((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsDrumGeneratorChannel(t)
          ? { ...t, drumGenHarmonyTrackId: trackId }
          : t,
      ),
    );
  }, [applyTracksMutation]);

  const updateDrumGenGenoBuildSlot = useCallback(
    (trackIndex: number, slot: import('@/app/lib/studio/se2DrumGeneratorTrack').Se2DrumGenGenoBuildSlot) => {
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsDrumGeneratorChannel(t) ? { ...t, drumGenGenoBuildSlot: slot } : t,
        ),
      );
    },
    [applyTracksMutation],
  );

  const generateDrumGenFromMatchCards = useCallback(
    async (trackIndex: number, bumpSeed = true) => {
      const drumTr = studioTracksRef.current[trackIndex];
      if (!drumTr || !studioTrackIsDrumGeneratorChannel(drumTr)) return;
      const harmonySources = se2DrumGenHarmonySourceCandidates(studioTracksRef.current);
      const harmony = se2ResolveDrumGenHarmonyTrack(studioTracksRef.current, drumTr, drumTr.id);
      if (!harmony || !se2DrumGenTrackHarmonyReady(harmony)) return;

      const result = await se2GenerateDrumGenFromMatchCards({
        drumTrack: drumTr,
        harmony,
        allTracks: harmonySources,
        beatsPerBar: beatsPerBarRef.current,
        loopBars: loopBarsRef.current,
        transportBpm: bpmRef.current,
        bumpSeed,
      });
      if (!result) return;

      if (result.chordStyle !== drumTr.drumGenStyle) {
        updateDrumGenStyle(trackIndex, result.chordStyle);
      }
      await applyDrumGeneratorLoad(trackIndex, result.load, result.seed);
    },
    [applyDrumGeneratorLoad, updateDrumGenStyle],
  );

  const updateBeatPadsPattern = useCallback(
    (
      trackIndex: number,
      pattern: BeatPadsDrumPattern,
      loopBars: number,
      stepsPerBar: BeatPadsGridStepsPerBar,
    ) => {
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsBeatPadsChannel(t)
            ? {
                ...t,
                beatPadsPattern: pattern,
                beatPadsLoopBars: loopBars,
                beatPadsStepsPerBar: stepsPerBar,
                notes: [],
              }
            : t,
        ),
      );
    },
    [applyTracksMutation],
  );

  const updateBeatPadsSpread = useCallback(
    (
      trackIndex: number,
      spread: import('@/app/lib/studio/se2BeatPadsSpreadStore').Se2BeatPadsSpreadSnapshot | null,
    ) => {
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsBeatPadsChannel(t)
            ? { ...t, beatPadsSpread: spread ?? undefined }
            : t,
        ),
      );
    },
    [applyTracksMutation],
  );

  const updateBeatPads808LabVoice = useCallback(
    (trackIndex: number, voice: import('@/app/lib/studio/se2Lab808Types').Se2Lab808VoiceParams) => {
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsBeatPadsChannel(t)
            ? { ...t, beatPads808LabVoice: cloneSe2Lab808VoiceParams(voice) }
            : t,
        ),
      );
    },
    [applyTracksMutation],
  );

  const updateBeatPads808LabSynced = useCallback(
    (
      trackIndex: number,
      synced: boolean,
      voice?: import('@/app/lib/studio/se2Lab808Types').Se2Lab808VoiceParams,
    ) => {
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== trackIndex || !studioTrackIsBeatPadsChannel(t)) return t;
          return {
            ...t,
            beatPads808LabSynced: synced,
            ...(voice ? { beatPads808LabVoice: cloneSe2Lab808VoiceParams(voice) } : {}),
          };
        }),
      );
    },
    [applyTracksMutation],
  );

  const updateBeatPadsOrchHitsVoice = useCallback(
    (trackIndex: number, voice: BeatPadsOrchHitsVoice) => {
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsBeatPadsChannel(t)
            ? { ...t, beatPadsOrchHitsVoice: cloneBeatPadsOrchHitsVoice(voice) }
            : t,
        ),
      );
    },
    [applyTracksMutation],
  );

  const updateBeatPadsOrchHitsSynced = useCallback(
    (trackIndex: number, synced: boolean, voice?: BeatPadsOrchHitsVoice) => {
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== trackIndex || !studioTrackIsBeatPadsChannel(t)) return t;
          return {
            ...t,
            beatPadsOrchHitsSynced: synced,
            ...(voice ? { beatPadsOrchHitsVoice: cloneBeatPadsOrchHitsVoice(voice) } : {}),
          };
        }),
      );
    },
    [applyTracksMutation],
  );

  const updateBeatPadsHarmonyTrackId = useCallback(
    (trackIndex: number, trackId: string, slot: BeatPadsGenoBuildSlot) => {
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsBeatPadsChannel(t)
            ? { ...t, beatPadsHarmonyTrackId: trackId, beatPadsGenoBuildSlot: slot }
            : t,
        ),
      );
    },
    [applyTracksMutation],
  );

  const updateBeatPadsHarmonyTrackIdOnly = useCallback(
    (trackIndex: number, trackId: string) => {
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsBeatPadsChannel(t)
            ? { ...t, beatPadsHarmonyTrackId: trackId }
            : t,
        ),
      );
    },
    [applyTracksMutation],
  );

  const toggleBeatPadsHarmonyLocked = useCallback(
    (trackIndex: number, locked?: boolean) => {
      const tr = studioTracksRef.current[trackIndex];
      if (!tr || !studioTrackIsBeatPadsChannel(tr)) return;
      const nextLocked = locked ?? !(tr.beatPadsHarmonyLocked ?? false);
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsBeatPadsChannel(t)
            ? { ...t, beatPadsHarmonyLocked: nextLocked }
            : t,
        ),
      );
    },
    [applyTracksMutation],
  );

  const updateBeatPadsPatternStyle = useCallback(
    (trackIndex: number, style: Se2DrumGenStyle) => {
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsBeatPadsChannel(t) ? { ...t, beatPadsPatternStyle: style } : t,
        ),
      );
    },
    [applyTracksMutation],
  );

  const updateBeatPadsKickKeyLock = useCallback(
    (trackIndex: number, locked: boolean) => {
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsBeatPadsChannel(t)
            ? { ...t, beatPadsKickKeyLock: locked }
            : t,
        ),
      );
    },
    [applyTracksMutation],
  );

  const updateBeatPadsKickTargetPad = useCallback(
    (trackIndex: number, padIndex: number) => {
      const pad = Math.max(0, Math.min(15, Math.round(padIndex)));
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsBeatPadsChannel(t)
            ? { ...t, beatPadsKickTargetPad: pad }
            : t,
        ),
      );
    },
    [applyTracksMutation],
  );

  const regenerateBeatPadsPadOnTrack = useCallback(
    (trackIndex: number, targetPadIndex?: number): string => {
      const tracks = studioTracksRef.current;
      const tr = tracks[trackIndex];
      if (!tr || !studioTrackIsBeatPadsChannel(tr)) return 'Beat Pads track not found.';
      const pad = Math.max(0, Math.min(15, Math.round(targetPadIndex ?? tr.beatPadsKickTargetPad ?? 0)));
      const harmony = se2ResolveBeatPadsHarmonyTrack(tracks, tr, tr.id);
      const result = se2BeatPadsRegeneratePadOnTrack(tr, harmony, beatsPerBarRef.current, pad);
      if (!result) return 'Load or draw a pattern first.';
      const loopBars = tr.beatPadsLoopBars ?? 8;
      const stepsPerBar = tr.beatPadsStepsPerBar ?? 16;
      if (result.applied) {
        const normalized = normalizeBeatPadsPattern(result.pattern, loopBars, stepsPerBar);
        applyTracksMutation((prev) =>
          prev.map((t, i) =>
            i === trackIndex && studioTrackIsBeatPadsChannel(t)
              ? { ...t, beatPadsKickTargetPad: pad, beatPadsPattern: normalized }
              : t,
          ),
        );
      }
      return result.status;
    },
    [applyTracksMutation],
  );

  const syncBeatPadsFromHarmonyLane = useCallback(
    (trackIndex: number, opts?: { applyPattern?: boolean }) => {
      const tracks = studioTracksRef.current;
      const tr = tracks[trackIndex];
      if (!tr || !studioTrackIsBeatPadsChannel(tr)) return;
      const harmony = se2ResolveBeatPadsHarmonyTrack(tracks, tr, tr.id);
      const sync = se2BeatPadsHarmonySyncFromLane(harmony, tracks, {
        sessionBpm: bpmRef.current,
        sessionLoopBars: loopBarsRef.current,
        songKeyRoot: songKeyRootRef.current,
        songKeyMode: songKeyModeRef.current,
        styleOverride: tr.beatPadsPatternStyle,
      });
      setBpm(Math.max(40, Math.min(240, Math.round(sync.bpm))));
      if (!loopRegionUserLockedRef.current) {
        setLoopBars(sync.loopBars);
      }
      if (sync.keyRoot != null && sync.keyMode) {
        setSongKeyRoot(sync.keyRoot);
        setSongKeyMode(sync.keyMode);
      }
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== trackIndex || !studioTrackIsBeatPadsChannel(t)) return t;
          return {
            ...t,
            beatPadsLoopBars: sync.loopBars,
            ...(harmony?.id && !t.beatPadsHarmonyTrackId?.trim()
              ? { beatPadsHarmonyTrackId: harmony.id }
              : {}),
            ...(sync.style && !t.beatPadsPatternStyle ? { beatPadsPatternStyle: sync.style } : {}),
          };
        }),
      );
      if (opts?.applyPattern) {
        const load = se2BeatPadsLoadMatchedPattern({
          style: sync.style,
          seed: Date.now() % 1_000_000,
          harmony,
          sessionLoopBars: sync.loopBars,
          stepsPerBar: tr.beatPadsStepsPerBar ?? 16,
          beatsPerBar: beatsPerBarRef.current,
        });
        if (load) {
          setBpm(Math.max(40, Math.min(240, Math.round(load.bpm))));
          applyTracksMutation((prev) =>
            prev.map((t, i) =>
              i === trackIndex && studioTrackIsBeatPadsChannel(t)
                ? {
                    ...t,
                    beatPadsPattern: load.pattern,
                    beatPadsLoopBars: load.loopBars,
                    beatPadsStepsPerBar: load.stepsPerBar,
                    beatPadsMatchedPresetId: load.presetId,
                    beatPadsProducerKitId: load.producerKitId,
                    beatPadsPatternStyle: sync.style,
                    notes: [],
                  }
                : t,
            ),
          );
          void ensureStudioDrumKitLoaded(load.producerKitId);
        }
      }
    },
    [applyTracksMutation, ensureStudioDrumKitLoaded],
  );

  const loadBeatPadsMatchedPatternOnTrack = useCallback(
    (trackIndex: number) => {
      syncBeatPadsFromHarmonyLane(trackIndex, { applyPattern: true });
    },
    [syncBeatPadsFromHarmonyLane],
  );

  const beatPadsHarmonyLockSig = useMemo(() => {
    return studioTracks
      .map((t, i) => {
        if (!studioTrackIsBeatPadsChannel(t) || !(t.beatPadsHarmonyLocked ?? false)) return '';
        const h = se2ResolveBeatPadsHarmonyTrack(studioTracks, t, t.id);
        if (!h) return `${i}:none`;
        return [
          i,
          h.id,
          h.rhythmSteps?.length ?? 0,
          h.harmonySteps?.length ?? 0,
          h.notes?.length ?? 0,
          h.trackKeyRoot ?? '',
          h.trackKeyMode ?? '',
          h.rhythmLoopBars ?? '',
          h.harmonyLoopBars ?? '',
        ].join(':');
      })
      .filter(Boolean)
      .join('|');
  }, [studioTracks]);

  useEffect(() => {
    if (!isScreenActive || !beatPadsHarmonyLockSig) return;
    studioTracks.forEach((t, ti) => {
      if (studioTrackIsBeatPadsChannel(t) && (t.beatPadsHarmonyLocked ?? false)) {
        syncBeatPadsFromHarmonyLane(ti);
      }
    });
  }, [beatPadsHarmonyLockSig, isScreenActive, studioTracks, syncBeatPadsFromHarmonyLane]);

  const applyBeatPadsTransportFromGeno = useCallback(
    (trackIndex: number, opts: { bpm: number; loopBars: number }) => {
      setBpm(Math.max(40, Math.min(240, Math.round(opts.bpm))));
      const bars = Math.max(1, Math.round(opts.loopBars));
      setLoopBars(bars);
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsBeatPadsChannel(t) ? { ...t, beatPadsLoopBars: bars } : t,
        ),
      );
    },
    [applyTracksMutation],
  );

  /** Latest Beat Pads loop tempo from the embedded drum machine (for SE2 sync). */
  const beatPadsLiveTransportByTrackRef = useRef(
    new Map<number, { bpm: number; loopBars: number }>(),
  );

  const setBeatPadsSe2SyncMode = useCallback(
    (trackIndex: number, mode: Se2BeatPadsSe2SyncMode) => {
      const tr = studioTracksRef.current[trackIndex];
      if (!tr || !studioTrackIsBeatPadsChannel(tr)) return;
      const current = se2BeatPadsSe2SyncMode(tr);
      const nextMode = current === mode ? 'off' : mode;
      if (nextMode === 'master') {
        const live = beatPadsLiveTransportByTrackRef.current.get(trackIndex);
        const padsBpm = Math.max(
          40,
          Math.min(240, Math.round(live?.bpm ?? bpmRef.current)),
        );
        const padsBars = Math.max(
          1,
          Math.round(live?.loopBars ?? tr.beatPadsLoopBars ?? loopBarsRef.current),
        );
        applyBeatPadsTransportFromGeno(trackIndex, { bpm: padsBpm, loopBars: padsBars });
      }
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== trackIndex || !studioTrackIsBeatPadsChannel(t)) return t;
          return {
            ...t,
            beatPadsSe2SyncMode: nextMode,
            beatPadsSyncLocked: nextMode !== 'off',
          };
        }),
      );
      if (nextMode !== 'off') {
        void studioBeatPadsSessionForTrack(tr as Se2BeatPadsTrack);
      }
    },
    [applyBeatPadsTransportFromGeno, applyTracksMutation, studioBeatPadsSessionForTrack],
  );

  const toggleGenoUltraArpSyncLocked = useCallback(
    (trackIndex: number) => {
      const tr = studioTracksRef.current[trackIndex];
      if (!tr || !studioTrackIsGenoUltraSynthChannel(tr)) return;
      const nextLocked = !(tr.genoUltraArpSyncLocked ?? false);
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== trackIndex || !studioTrackIsGenoUltraSynthChannel(t)) return t;
          return { ...t, genoUltraArpSyncLocked: nextLocked };
        }),
      );
    },
    [applyTracksMutation],
  );

  const updateBeatPadsProducerKit = useCallback(
    (trackIndex: number, kitId: BeatLabProducerKitId) => {
      applyTracksMutation((prev) => {
        const tr = prev[trackIndex];
        if (tr && studioTrackIsBeatPadsChannel(tr)) {
          studioBeatPadsTrackSessionsRef.current.delete(tr.id);
        }
        return prev.map((t, i) =>
          i === trackIndex && studioTrackIsBeatPadsChannel(t)
            ? { ...t, beatPadsProducerKitId: kitId }
            : t,
        );
      });
    },
    [applyTracksMutation],
  );

  const updateBeatPadsMatchedPresetId = useCallback(
    (trackIndex: number, presetId: string) => {
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsBeatPadsChannel(t)
            ? { ...t, beatPadsMatchedPresetId: presetId }
            : t,
        ),
      );
    },
    [applyTracksMutation],
  );

  const exportBeatPadsToAudioTrack = useCallback(
    (
      sourceTrackIndex: number,
      args: {
        buffer: AudioBuffer;
        loopBars: number;
        bpm: number;
        sourceTrackName: string;
      },
    ) => {
      const prev = studioTracksRef.current;
      if (prev.length >= MAX_STUDIO_TRACKS) return;
      const sourceId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `src-${crypto.randomUUID()}`
          : `src-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const clipId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `ac-${crypto.randomUUID()}`
          : `ac-${Date.now()}`;
      studioAudioBuffersRef.current.set(sourceId, args.buffer);

      const durBeats = Math.max(1 / 16, args.loopBars * beatsPerBar);
      const clipName = `${args.sourceTrackName.replace(/\s+Beat Pads.*$/i, '').trim() || args.sourceTrackName} · ${args.loopBars} bars`;
      const trackName = `${clipName} Audio`;
      const newClip: StudioAudioClip = {
        id: clipId,
        sourceId,
        startBeat: loopStartBeatRef.current,
        durationBeats: durBeats,
        name: clipName,
        sourceBpm: args.bpm,
      };

      const insertAt = Math.min(sourceTrackIndex + 1, prev.length);
      applyTracksMutation((p) => {
        if (p.length >= MAX_STUDIO_TRACKS) return p;
        const newTrack: MockMusioTrack = {
          id: newTrackId(),
          name: trackName,
          laneNumber: se2NextStudioLaneNumber(p),
          colorHex: NEW_TRACK_COLOR_HEX[(insertAt + 1) % NEW_TRACK_COLOR_HEX.length]!,
          kind: 'audio',
          notes: [],
          audioClips: [newClip],
          audioInputDeviceId: '',
        };
        const next = [...p];
        next.splice(insertAt, 0, newTrack);
        return next;
      });
      setSelectedTrackIndex(insertAt);
      setSelectedPianoNoteIndex(null);
      setSelectedPianoNoteIndexes(new Set());
    },
    [applyTracksMutation, beatsPerBar],
  );

  const exportLab808ToneGridToPianoRoll = useCallback(
    (trackIndex: number, notes: Se2Lab808ToneGridRollNote[]) => {
      const loopStart = loopStartBeatRef.current;
      const rollNotes = notes.map((n) => ({
        ...n,
        startBeat: loopStart + n.startBeat,
      }));
      applyTracksMutation((p) =>
        p.map((t, i) => {
          if (i !== trackIndex || !studioTrackIsLab808Channel(t)) return t;
          return {
            ...t,
            notes: rollNotes.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch),
          };
        }),
      );
      setSelectedTrackIndex(trackIndex);
      setSelectedPianoNoteIndex(null);
      setSelectedPianoNoteIndexes(new Set());
    },
    [applyTracksMutation],
  );

  /** Beat Pads mini 808 Lab — new standalone 808 Lab lane with piano-roll notes (not the Beat Pads drum grid). */
  const exportBeatPads808LabToNewLab808Track = useCallback(
    (notes: Se2Lab808ToneGridRollNote[]) => {
      const prev = studioTracksRef.current;
      if (prev.length >= MAX_STUDIO_TRACKS) return;
      const ti = prev.length;
      const initVoice = se2Lab808DefaultVoice();
      const loopStart = loopStartBeatRef.current;
      const rollNotes = notes.map((n) => ({
        ...n,
        startBeat: loopStart + n.startBeat,
      }));
      const newTrack: MockMusioTrack = {
        id: newTrackId(),
        name: nextLab808TrackName(prev),
        laneNumber: se2NextStudioLaneNumber(prev),
        colorHex: '#E8784A',
        kind: 'lab808',
        midiChannel: studioNextMidiChannel(prev),
        lab808SoundLane: initVoice.soundLane,
        lab808KickPresetId: initVoice.kickPresetId,
        lab808BassPresetId: initVoice.bassPresetId,
        lab808TonePadBaseMidi: initVoice.tonePadBaseMidi,
        lab808ToneGridLoopBars: initVoice.toneGridLoopBars,
        lab808ToneGridSteps: initVoice.toneGridSteps.map((row) => [...row]),
        lab808PercSnareSteps: [...initVoice.percSnareSteps],
        lab808PercClapSteps: [...initVoice.percClapSteps],
        lab808PercLevel: initVoice.percLevel,
        notes: rollNotes.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch),
        audioClips: [],
      };
      setSe2Lab808Voices((voices) => {
        const next = [...voices];
        next[ti] = initVoice;
        return next;
      });
      const next = [...prev, newTrack];
      setStudioTracks(next);
      setSelectedTrackIndex(ti);
      setSelectedPianoNoteIndex(null);
      setSelectedPianoNoteIndexes(new Set());
      setLab808PanelOpen(true);
      openPianoRollEditor();
    },
    [openPianoRollEditor],
  );

  const exportBeatPadsSpreadMidiToTrack = useCallback(
    (
      targetTrackIndex: number,
      notes: { pitch: number; startBeat: number; durationBeats: number; velocity: number }[],
      loopBars: number,
    ): boolean => {
      const prev = studioTracksRef.current;
      const tgt = prev[targetTrackIndex];
      if (!tgt || !se2BeatPadsSpreadCanReceiveSpreadMidi(tgt)) return false;
      const loopStart = loopStartBeatRef.current;
      const offsetNotes = notes.map((n) => ({
        ...n,
        startBeat: loopStart + n.startBeat,
      }));
      applyTracksMutation((p) =>
        p.map((t, i) => {
          if (i !== targetTrackIndex || !se2BeatPadsSpreadCanReceiveSpreadMidi(t)) return t;
          const merged = [...t.notes, ...offsetNotes].sort(
            (a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch,
          );
          return { ...t, notes: merged };
        }),
      );
      setSelectedTrackIndex(targetTrackIndex);
      setSelectedPianoNoteIndex(null);
      setSelectedPianoNoteIndexes(new Set());
      void loopBars;
      return true;
    },
    [applyTracksMutation],
  );

  const exportBeatPadsSpreadWavToTrack = useCallback(
    (
      targetTrackIndex: number,
      args: {
        buffer: AudioBuffer;
        loopBars: number;
        bpm: number;
        sourceLabel: string;
      },
    ): boolean => {
      const prev = studioTracksRef.current;
      const tgt = prev[targetTrackIndex];
      if (!tgt || !se2BeatPadsSpreadCanReceiveSpreadWav(tgt.kind)) return false;
      const sourceId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `src-${crypto.randomUUID()}`
          : `src-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const clipId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `ac-${crypto.randomUUID()}`
          : `ac-${Date.now()}`;
      studioAudioBuffersRef.current.set(sourceId, args.buffer);
      const durBeats = Math.max(1 / 16, args.loopBars * beatsPerBar);
      const clipName = args.sourceLabel;
      const newClip: StudioAudioClip = {
        id: clipId,
        sourceId,
        startBeat: loopStartBeatRef.current,
        durationBeats: durBeats,
        name: clipName,
        sourceBpm: args.bpm,
      };
      applyTracksMutation((p) => {
        const lane = p[targetTrackIndex];
        if (!lane || !se2BeatPadsSpreadCanReceiveSpreadWav(lane.kind)) return p;
        let clip = newClip;
        if (se2TrackUsesTimeStretchAlign(lane.kind)) {
          clip = se2PrepareClipForAlignLane(clip, args.buffer, args.bpm);
        }
        return p.map((t, i) =>
          i === targetTrackIndex
            ? {
                ...t,
                audioClips: [...t.audioClips, clip],
                ...(se2TrackUsesTimeStretchAlign(t.kind) && clip.sourceBpm != null
                  ? { alignSourceBpm: clip.sourceBpm }
                  : {}),
              }
            : t,
        );
      });
      setSelectedTrackIndex(targetTrackIndex);
      setSelectedPianoNoteIndex(null);
      setSelectedPianoNoteIndexes(new Set());
      return true;
    },
    [applyTracksMutation, beatsPerBar],
  );

  const exportBeatPadsLanesToTracks = useCallback(
    (
      sourceTrackIndex: number,
      args: {
        lanes: readonly {
          padIndex: number;
          label: string;
          wav?: { buffer: AudioBuffer; loopBars: number; bpm: number };
          midi?: {
            notes: { pitch: number; startBeat: number; durationBeats: number; velocity: number }[];
            loopBars: number;
          };
        }[];
      },
    ): { created: number; skipped: number } => {
      if (args.lanes.length === 0) return { created: 0, skipped: 0 };
      const loopStart = loopStartBeatRef.current;
      let created = 0;
      let skipped = 0;

      applyTracksMutation((prev) => {
        if (prev.length >= MAX_STUDIO_TRACKS) {
          skipped = args.lanes.reduce(
            (n, lane) => n + (lane.wav ? 1 : 0) + (lane.midi ? 1 : 0),
            0,
          );
          return prev;
        }

        let insertAt = Math.min(sourceTrackIndex + 1, prev.length);
        const next = [...prev];
        const sourceName =
          prev[sourceTrackIndex]?.name.replace(/\s+Beat Pads.*$/i, '').trim() ||
          prev[sourceTrackIndex]?.name ||
          'Beat Pads';

        for (const lane of args.lanes) {
          const exports: Array<'wav' | 'midi'> = [];
          if (lane.wav) exports.push('wav');
          if (lane.midi) exports.push('midi');

          for (const kind of exports) {
            if (next.length >= MAX_STUDIO_TRACKS) {
              skipped += 1;
              continue;
            }

            if (kind === 'wav' && lane.wav) {
              const sourceId =
                typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                  ? `src-${crypto.randomUUID()}`
                  : `src-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
              const clipId =
                typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                  ? `ac-${crypto.randomUUID()}`
                  : `ac-${Date.now()}`;
              studioAudioBuffersRef.current.set(sourceId, lane.wav.buffer);
              const durBeats = Math.max(1 / 16, lane.wav.loopBars * beatsPerBar);
              const clipName = `${sourceName} · ${lane.label} · ${lane.wav.loopBars}b`;
              const newClip: StudioAudioClip = {
                id: clipId,
                sourceId,
                startBeat: loopStart,
                durationBeats: durBeats,
                name: clipName,
                sourceBpm: lane.wav.bpm,
              };
              const newTrack: MockMusioTrack = {
                id: newTrackId(),
                name: `${lane.label} (WAV)`,
                laneNumber: se2NextStudioLaneNumber(next),
                colorHex: NEW_TRACK_COLOR_HEX[(insertAt + 1) % NEW_TRACK_COLOR_HEX.length]!,
                kind: 'audio',
                notes: [],
                audioClips: [newClip],
                audioInputDeviceId: '',
              };
              next.splice(insertAt, 0, newTrack);
              insertAt += 1;
              created += 1;
              continue;
            }

            if (kind === 'midi' && lane.midi) {
              const offsetNotes = lane.midi.notes.map((n) => ({
                ...n,
                startBeat: loopStart + n.startBeat,
              }));
              const newTrack: MockMusioTrack = {
                id: newTrackId(),
                name: `${lane.label} (MIDI)`,
                laneNumber: se2NextStudioLaneNumber(next),
                colorHex: NEW_TRACK_COLOR_HEX[(insertAt + 1) % NEW_TRACK_COLOR_HEX.length]!,
                kind: 'midi',
                notes: offsetNotes,
                audioClips: [],
                audioInputDeviceId: '',
              };
              next.splice(insertAt, 0, newTrack);
              insertAt += 1;
              created += 1;
            }
          }
        }

        return next;
      });

      if (created > 0) {
        const nextIndex = Math.min(sourceTrackIndex + 1, studioTracksRef.current.length - 1);
        setSelectedTrackIndex(Math.max(0, nextIndex));
        setSelectedPianoNoteIndex(null);
        setSelectedPianoNoteIndexes(new Set());
      }

      return { created, skipped };
    },
    [applyTracksMutation, beatsPerBar],
  );

  const getBeatPadsTrackStripInput = useCallback((trackIndex: number): GainNode | null => {
    const ctx = ctxRef.current;
    const bus = midiPreviewBusRef.current;
    if (!ctx || !bus) return null;
    return se2TrackPlaybackInput(
      ctx,
      bus,
      trackIndex,
      trackFxSlotsRef.current[trackIndex] ?? emptyMixerFxSlots(),
      trackInsertFxRacksRef.current[trackIndex] ?? defaultStudioTrackInsertFxRack(),
      bpmRef.current,
      studioMasterOutRef.current ?? ctx.destination,
    );
  }, []);

  const updateDrumGenTemperature = useCallback((trackIndex: number, temp: number) => {
    const next = se2NormalizeDrumGenTemperature(temp);
    applyTracksMutation((prev) =>
      prev.map((t, i) =>
        i === trackIndex && studioTrackIsDrumGeneratorChannel(t) ? { ...t, drumGenTemperature: next } : t,
      ),
    );
  }, [applyTracksMutation]);

  const updateDrumPadOverride = useCallback(
    (trackIndex: number, padIndex: number, override: Se2DrumPadOverride | null) => {
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== trackIndex || !studioTrackIsDrumGeneratorChannel(t)) return t;
          const next = { ...(t.drumPadOverrides ?? {}) };
          if (override) next[padIndex] = override;
          else delete next[padIndex];
          const drumPadOverrides = Object.keys(next).length > 0 ? next : undefined;
          return { ...t, drumPadOverrides };
        }),
      );
      const tr = studioTracksRef.current[trackIndex];
      if (tr) {
        studioDrumTrackSessionsRef.current.delete(tr.id);
        void studioDrumSessionForTrack(tr);
      }
    },
    [applyTracksMutation, studioDrumSessionForTrack],
  );

  const resetDrumPadOverrides = useCallback(
    (trackIndex: number) => {
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackIsDrumGeneratorChannel(t)
            ? { ...t, drumPadOverrides: undefined }
            : t,
        ),
      );
      const tr = studioTracksRef.current[trackIndex];
      if (tr) {
        studioDrumTrackSessionsRef.current.delete(tr.id);
        void studioDrumSessionForTrack(tr);
      }
    },
    [applyTracksMutation, studioDrumSessionForTrack],
  );

  const previewDrumGeneratorPad = useCallback(
    async (trackIndex: number, padIndex: number) => {
      const tr = studioTracksRef.current[trackIndex];
      if (!tr || !studioTrackIsDrumChannel(tr) || !tr.drumProducerKitId) return;
      const ctx = await ensureCtx();
      if (ctx.state === 'closed') return;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          /* autoplay */
        }
      }
      const session = await studioDrumSessionForTrack(tr);
      const bus = midiPreviewBusRef.current;
      if (!bus) return;
      const stripIn = se2TrackPlaybackInput(
        ctx,
        bus,
        trackIndex,
        trackFxSlotsRef.current[trackIndex] ?? emptyMixerFxSlots(),
        trackInsertFxRacksRef.current[trackIndex] ?? defaultStudioTrackInsertFxRack(),
        bpmRef.current,
        studioMasterOutRef.current ?? ctx.destination,
      );
      applyStudioMixerStripMix(trackIndex, {
        muted: trackMutesRef.current[trackIndex] ?? false,
        vol127: trackVolumesRef.current[trackIndex] ?? MIXER_UNITY_VOL,
        pan127: trackPansRef.current[trackIndex] ?? 64,
        mono: trackMonosRef.current[trackIndex] ?? false,
      });
      triggerPianoRollDrumPad(session, padIndex, ctx, 110, undefined, stripIn);
    },
    [ensureCtx, studioDrumSessionForTrack],
  );

  const auditionDrumPadOverride = useCallback(
    async (trackIndex: number, override: Se2DrumPadOverride) => {
      const tr = studioTracksRef.current[trackIndex];
      if (!tr || !studioTrackIsDrumChannel(tr)) return;
      const ctx = await ensureCtx();
      if (ctx.state === 'closed') return;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          /* autoplay */
        }
      }
      const bus = midiPreviewBusRef.current;
      if (!bus) return;
      const stripIn = se2TrackPlaybackInput(
        ctx,
        bus,
        trackIndex,
        trackFxSlotsRef.current[trackIndex] ?? emptyMixerFxSlots(),
        trackInsertFxRacksRef.current[trackIndex] ?? defaultStudioTrackInsertFxRack(),
        bpmRef.current,
        studioMasterOutRef.current ?? ctx.destination,
      );
      applyStudioMixerStripMix(trackIndex, {
        muted: trackMutesRef.current[trackIndex] ?? false,
        vol127: trackVolumesRef.current[trackIndex] ?? MIXER_UNITY_VOL,
        pan127: trackPansRef.current[trackIndex] ?? 64,
        mono: trackMonosRef.current[trackIndex] ?? false,
      });
      await previewSe2DrumPadOverride(ctx, stripIn, override, 110);
    },
    [ensureCtx],
  );

  const generatePartFromTrack = useCallback(
    (sourceIndex: number, kind: StudioGeneratePartKind, replaceInPlace: boolean) => {
      const prev = studioTracksRef.current;
      const src = prev[sourceIndex];
      if (!src || !studioTrackHasMelodicKeyUi(src)) return;
      const bpb = beatsPerBarRef.current;
      const resolved = studioResolveTrackKey(src, bpmRef.current) ?? {
        keyRoot: songKeyRootRef.current,
        keyMode: songKeyModeRef.current,
      };
      const partKind = replaceInPlace
        ? studioInferGenerateKindFromTrack(src.notes, src.midiInstrumentId)
        : kind;
      const seed = mixSeed([src.id, partKind, replaceInPlace ? 'regen' : 'new', Date.now()]);
      const notes = studioGenerateCompanionPart({
        kind: partKind,
        sourceNotes: src.notes,
        keyRoot: resolved.keyRoot,
        keyMode: resolved.keyMode,
        beatsPerBar: bpb,
        seed,
      });
      if (notes.length === 0) return;

      midiPreviewScheduledRef.current.clear();
      midiHardwareScheduledRef.current.clear();

      if (replaceInPlace) {
        applyTracksMutation((tracks) =>
          tracks.map((t, i) =>
            i === sourceIndex
              ? {
                  ...t,
                  notes,
                  trackKeyRoot: resolved.keyRoot,
                  trackKeyMode: resolved.keyMode,
                }
              : t,
          ),
        );
        clearSelectedPianoNotes();
        return;
      }

      if (prev.length >= MAX_STUDIO_TRACKS) return;
      const newTrack: MockMusioTrack = {
        id: newTrackId(),
        name: `${src.name} ${studioGeneratePartLabel(partKind)}`,
        laneNumber: se2NextStudioLaneNumber(prev),
        colorHex: NEW_TRACK_COLOR_HEX[(sourceIndex + 1) % NEW_TRACK_COLOR_HEX.length]!,
        kind: 'midi',
        midiChannel: studioNextMidiChannel(prev),
        midiInstrumentId: studioDefaultInstrumentForGeneratedPart(partKind),
        notes,
        audioClips: [],
        trackKeyRoot: resolved.keyRoot,
        trackKeyMode: resolved.keyMode,
      };
      applyTracksMutation((tracks) => [
        ...tracks.slice(0, sourceIndex + 1),
        newTrack,
        ...tracks.slice(sourceIndex + 1),
      ]);
      setSelectedTrackIndex(sourceIndex + 1);
      clearSelectedPianoNotes();
      openPianoRollEditor();
    },
    [applyTracksMutation, clearSelectedPianoNotes, openPianoRollEditor],
  );

  const convertTrackToSongKey = useCallback(
    (trackIndex: number) => {
      const tr = studioTracksRef.current[trackIndex];
      if (!tr || !studioTrackHasMelodicKeyUi(tr) || tr.notes.length === 0) return;
      const bpmNow = bpmRef.current;
      let from = studioResolveTrackKey(tr, bpmNow);
      if (!from) {
        const detected = detectKeyFromMidiNotes(tr.notes, bpmNow);
        if (!detected) return;
        from = {
          keyRoot: ((Math.round(detected.keyRoot) % 12) + 12) % 12,
          keyMode: detected.keyMode,
        };
      }
      const to = {
        keyRoot: songKeyRootRef.current,
        keyMode: songKeyModeRef.current,
      };
      const converted = studioConvertMidiNotesToKey(
        tr.notes,
        from.keyRoot,
        from.keyMode,
        to.keyRoot,
        to.keyMode,
      );
      midiPreviewScheduledRef.current.clear();
      midiHardwareScheduledRef.current.clear();
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && studioTrackHasMelodicKeyUi(t)
            ? {
                ...t,
                notes: converted,
                trackKeyRoot: to.keyRoot,
                trackKeyMode: to.keyMode,
              }
            : t,
        ),
      );
      clearSelectedPianoNotes();
    },
    [applyTracksMutation, clearSelectedPianoNotes],
  );

  const selectOnlyPianoNote = useCallback((idx: number | null) => {
    setSelectedPianoNoteIndex(idx);
    setSelectedPianoNoteIndexes(idx === null ? new Set() : new Set([idx]));
  }, []);

  const togglePianoNoteSelection = useCallback((idx: number) => {
    setSelectedPianoNoteIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      const arr = [...next].sort((a, b) => a - b);
      setSelectedPianoNoteIndex(arr.length ? arr[arr.length - 1]! : null);
      return next;
    });
  }, []);

  const selectedIndicesForTrack = useCallback((ti: number): number[] => {
    const tr = studioTracksRef.current[ti];
    if (!tr || !studioTrackOutputsMidi(tr)) return [];
    const setVals = [...selectedPianoIdxSetRef.current]
      .filter((i) => Number.isInteger(i) && i >= 0 && i < tr.notes.length)
      .sort((a, b) => a - b);
    if (setVals.length) return setVals;
    const single = selectedPianoIdxRef.current;
    return single !== null && single >= 0 && single < tr.notes.length ? [single] : [];
  }, []);

  /** FL-style convenience: if nothing is selected, actions target all notes on active MIDI track. */
  const selectedOrAllIndicesForTrack = useCallback((ti: number): number[] => {
    const tr = studioTracksRef.current[ti];
    if (!tr || !studioTrackOutputsMidi(tr)) return [];
    const selected = selectedIndicesForTrack(ti);
    if (selected.length) return selected;
    return tr.notes.map((_, i) => i);
  }, [selectedIndicesForTrack]);

  const selectTrackAndClearPianoNote = useCallback((i: number) => {
    setSelectedTrackIndex(i);
    clearSelectedPianoNotes();
    const tr = studioTracksRef.current[i];
    if (studioTrackIsGlideBassChannel(tr)) {
      setGlideBassPanelOpen(true);
      setSynthGenoPanelOpen(false);
    } else if (studioTrackIsSynthGenoChannel(tr)) {
      setSynthGenoPanelOpen(true);
      setGlideBassPanelOpen(false);
    } else if (studioTrackIsBeatPadsChannel(tr)) {
      setSynthGenoPanelOpen(false);
      setGlideBassPanelOpen(false);
      setDrumGeneratorPanelOpen(false);
      setShowPianoRoll(false);
      setPianoRollExpanded(false);
      setBeatPadsMachineOpen(true);
    } else if (studioTrackIsGuitarChannel(tr)) {
      setGuitarPanelOpen(true);
    } else if (studioTrackIsGenoBassSynthChannel(tr)) {
      setPianoRollExpanded(false);
      setGenoBassSynthPanelOpen(true);
    }
  }, [clearSelectedPianoNotes]);

  const ingestAudioFileOnClipLane = useCallback(
    async (audioTrackIndex: number, file: File, clipStartBeat = 0) => {
      if (!file || file.size <= 0 || !isDroppedAudioFile(file)) return;

      const trTarget = studioTracksRef.current[audioTrackIndex];
      if (!trTarget || !se2TrackIsAudioClipLane(trTarget.kind)) return;

      try {
        const ctx = await ensureCtx();
        if (ctx.state === 'suspended') {
          try {
            await ctx.resume();
          } catch {
            /* autoplay */
          }
        }
        const raw = await file.arrayBuffer();
        const buffer = await ctx.decodeAudioData(raw.slice(0));
        const sourceId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? `src-${crypto.randomUUID()}`
            : `src-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const clipId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? `ac-${crypto.randomUUID()}`
            : `ac-${Date.now()}`;
        studioAudioBuffersRef.current.set(sourceId, buffer);

        const bpmNow = bpmRef.current;
        const bpb = beatsPerBarRef.current;
        const tb = totalBeatsForSig(bpb);
        const alignLane = se2TrackUsesTimeStretchAlign(trTarget.kind);
        const sourceBpm = alignLane ? se2TrackAlignDetectSourceBpm(buffer, bpmNow) : bpmNow;
        const startBeat = Math.max(0, Math.min(tb - 1 / 16, clipStartBeat));
        const durBeats = Math.min(
          tb - startBeat,
          alignLane
            ? se2TrackAlignClipDurationBeats(buffer.duration, sourceBpm)
            : audioDurationBeatsFromSeconds(buffer.duration, bpmNow),
        );
        const baseName = (file.name.replace(/\.[^.]+$/, '') || 'Audio').slice(0, 48);
        const clip: StudioAudioClip = {
          id: clipId,
          sourceId,
          startBeat,
          durationBeats: Math.max(1 / 16, durBeats),
          name: baseName,
          ...(alignLane ? { sourceBpm, alignTempoLock: true } : {}),
        };

        applyTracksMutation((prev) => {
          const ti = audioTrackIndex;
          if (ti < 0 || ti >= prev.length) return prev;
          const tgt = prev[ti];
          if (!tgt || !se2TrackIsAudioClipLane(tgt.kind)) return prev;
          return prev.map((t, i) =>
            i === ti
              ? {
                  ...tgt,
                  audioClips: [...tgt.audioClips, clip],
                  ...(alignLane ? { alignSourceBpm: sourceBpm } : {}),
                }
              : t,
          );
        });
        setSelectedTrackIndex(audioTrackIndex);
        setSelectedTimelineAudioClip({ trackIndex: audioTrackIndex, clipId });
        const previewBus = midiPreviewBusRef.current;
        if (previewBus) {
          const masterOut = studioMasterOutRef.current ?? ctx.destination;
          if (runningRef.current) {
            ensureStudioPreviewBusOutput(previewBus, masterOut);
          } else {
            forceStudioPreviewBusOutput(previewBus, masterOut);
          }
          if (!runningRef.current && !transportArmingRef.current) {
            ensureSe2MixerStrips(ctx, previewBus, masterOut);
          }
          se2TrackPlaybackInput(
            ctx,
            previewBus,
            audioTrackIndex,
            trackFxSlotsRef.current[audioTrackIndex] ?? emptyMixerFxSlots(),
            trackInsertFxRacksRef.current[audioTrackIndex] ?? defaultStudioTrackInsertFxRack(),
            bpmRef.current,
            masterOut,
          );
        }
        if (runningRef.current) {
          refillAudioPreview(ctx, audioNow(ctx));
        }
      } catch (err) {
        console.error('Studio Editor 2: audio clip import failed', err);
      }
    },
    [applyTracksMutation, ensureCtx, refillAudioPreview],
  );

  const ingestDroppedAudioOnAudioTrack = useCallback(
    async (e: DragEvent<HTMLElement>, audioTrackIndex: number, clipStartBeat = 0) => {
      e.preventDefault();
      e.stopPropagation();
      const dt = e.dataTransfer;
      if (!dt?.files?.length) return;
      const file = Array.from(dt.files).find(isDroppedAudioFile);
      if (!file) return;
      await ingestAudioFileOnClipLane(audioTrackIndex, file, clipStartBeat);
    },
    [ingestAudioFileOnClipLane],
  );

  const importAudioOnClipLaneAtPlayhead = useCallback(
    (trackIndex: number, file: File) => {
      const bpb = beatsPerBarRef.current;
      const tb = totalBeatsForSig(bpb);
      const startBeat = snapBeatToQuarterGrid(cursorBeatRef.current, tb);
      void ingestAudioFileOnClipLane(trackIndex, file, startBeat);
    },
    [ingestAudioFileOnClipLane],
  );

  const ingestAudioFileOnA2mTrack = useCallback(
    async (a2mTrackIndex: number, file: File, clipStartBeat = 0) => {
      if (!file || file.size <= 0 || !isDroppedAudioFile(file)) return;

      const trTarget = studioTracksRef.current[a2mTrackIndex];
      if (!trTarget || trTarget.kind !== 'a2m') return;

      try {
        const ctx = await ensureCtx();
        if (ctx.state === 'suspended') {
          try {
            await ctx.resume();
          } catch {
            /* autoplay */
          }
        }
        const raw = await file.arrayBuffer();
        const buffer = await ctx.decodeAudioData(raw.slice(0));
        const sourceId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? `src-${crypto.randomUUID()}`
            : `src-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const clipId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? `ac-${crypto.randomUUID()}`
            : `ac-${Date.now()}`;
        studioAudioBuffersRef.current.set(sourceId, buffer);

        const bpmNow = bpmRef.current;
        const bpb = beatsPerBarRef.current;
        const tb = totalBeatsForSig(bpb);
        const startBeat = Math.max(0, Math.min(tb - 1 / 16, clipStartBeat));
        const durBeats = Math.min(
          tb - startBeat,
          audioDurationBeatsFromSeconds(buffer.duration, bpmNow),
        );
        const mode = studioNormalizeA2mMode(trTarget.a2mMode);
        const analysis = analyzeStudioA2mAudioClip(buffer, mode, bpmNow);
        const localNotes = studioClampMidiNotesToTimeline(
          studioMapA2mNotesToProjectBpm(analysis.localNotes, analysis.detectedBpm, bpmNow),
          tb,
        );
        const baseName = (file.name.replace(/\.[^.]+$/, '') || 'Audio').slice(0, 48);
        const clip: StudioAudioClip = {
          id: clipId,
          sourceId,
          startBeat,
          durationBeats: Math.max(1 / 16, durBeats),
          name: baseName,
        };

        applyTracksMutation((prev) => {
          const ti = a2mTrackIndex;
          if (ti < 0 || ti >= prev.length) return prev;
          const tgt = prev[ti];
          if (!tgt || tgt.kind !== 'a2m') return prev;
          const merged = studioMergeClipMidiNotes(tgt.notes, clip.startBeat, clip.durationBeats, localNotes);
          return prev.map((t, i) =>
            i === ti
              ? {
                  ...tgt,
                  audioClips: [...tgt.audioClips, clip],
                  notes: merged,
                  midiInstrumentId: studioDefaultInstrumentForA2mMode(mode),
                  a2mDetectedBpm: analysis.detectedBpm,
                  a2mKeyRoot: analysis.keyRoot,
                  a2mKeyMode: analysis.keyMode,
                  trackKeyRoot: analysis.keyRoot,
                  trackKeyMode: analysis.keyMode,
                }
              : t,
          );
        });
        setTrackVocalFx((prev) => {
          const next = prev.slice();
          const fx = next[a2mTrackIndex] ?? STUDIO_TRACK_VOCAL_FX_DEFAULT;
          next[a2mTrackIndex] = studioWireA2mPitchRouteOnTrack(fx, a2mTrackIndex);
          return next;
        });
        clearStudioVocalFxPlaybackCache();
        clearSelectedPianoNotes();
        setSelectedTrackIndex(a2mTrackIndex);
        setSelectedTimelineAudioClip({ trackIndex: a2mTrackIndex, clipId });
      } catch (err) {
        console.error('Studio Editor 2: audio → MIDI clip conversion failed', err);
      }
    },
    [applyTracksMutation, clearSelectedPianoNotes, clearStudioVocalFxPlaybackCache, ensureCtx],
  );

  const importAudioOnA2mLaneAtPlayhead = useCallback(
    (trackIndex: number, file: File) => {
      const bpb = beatsPerBarRef.current;
      const tb = totalBeatsForSig(bpb);
      const startBeat = snapBeatToQuarterGrid(cursorBeatRef.current, tb);
      void ingestAudioFileOnA2mTrack(trackIndex, file, startBeat);
    },
    [ingestAudioFileOnA2mTrack],
  );

  const ingestDroppedAudioOnA2mTrack = useCallback(
    async (e: DragEvent<HTMLElement>, a2mTrackIndex: number, clipStartBeat = 0) => {
      e.preventDefault();
      e.stopPropagation();
      const dt = e.dataTransfer;
      if (!dt?.files?.length) return;
      const file = Array.from(dt.files).find(isDroppedAudioFile);
      if (!file) return;
      await ingestAudioFileOnA2mTrack(a2mTrackIndex, file, clipStartBeat);
    },
    [ingestAudioFileOnA2mTrack],
  );

  const reconvertA2mTrackClips = useCallback(
    async (trackIndex: number) => {
      const tr = studioTracksRef.current[trackIndex];
      if (!tr || tr.kind !== 'a2m' || tr.audioClips.length === 0) return;
      const bpmNow = bpmRef.current;
      const mode = studioNormalizeA2mMode(tr.a2mMode);
      let merged: MockMidiNote[] = [];
      let detectedBpm: number | undefined;
      let keyRoot: number | undefined;
      let keyMode: StudioDetectedKeyMode | undefined;
      for (const clip of tr.audioClips) {
        const buffer = studioAudioBuffersRef.current.get(clip.sourceId);
        if (!buffer) continue;
        const analysis = analyzeStudioA2mAudioClip(buffer, mode, bpmNow);
        detectedBpm = analysis.detectedBpm;
        if (analysis.keyRoot != null) {
          keyRoot = analysis.keyRoot;
          keyMode = analysis.keyMode;
        }
        const local = studioClampMidiNotesToTimeline(
          studioMapA2mNotesToProjectBpm(analysis.localNotes, analysis.detectedBpm, bpmNow),
          clip.durationBeats,
        );
        merged = studioMergeClipMidiNotes(merged, clip.startBeat, clip.durationBeats, local);
      }
      midiPreviewScheduledRef.current.clear();
      midiHardwareScheduledRef.current.clear();
      applyTracksMutation((prev) =>
        prev.map((t, i) =>
          i === trackIndex && t.kind === 'a2m'
            ? {
                ...t,
                notes: merged,
                midiInstrumentId: studioDefaultInstrumentForA2mMode(mode),
                a2mDetectedBpm: detectedBpm,
                a2mKeyRoot: keyRoot,
                a2mKeyMode: keyMode,
                trackKeyRoot: keyRoot,
                trackKeyMode: keyMode,
              }
            : t,
        ),
      );
      setTrackVocalFx((prev) => {
        const next = prev.slice();
        const fx = next[trackIndex] ?? STUDIO_TRACK_VOCAL_FX_DEFAULT;
        next[trackIndex] = studioWireA2mPitchRouteOnTrack(fx, trackIndex);
        return next;
      });
      clearStudioVocalFxPlaybackCache();
    },
    [applyTracksMutation, clearStudioVocalFxPlaybackCache],
  );

  const onStudioAudioTrackHeaderDragOver = useCallback((e: DragEvent<HTMLDivElement>, ti: number) => {
    if (!e.dataTransfer.types?.includes?.('Files')) return;
    const tr = studioTracksRef.current[ti];
    if (!se2TrackIsAudioClipLane(tr?.kind)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onStudioA2mTrackHeaderDragOver = useCallback((e: DragEvent<HTMLDivElement>, ti: number) => {
    if (!e.dataTransfer.types?.includes?.('Files')) return;
    const tr = studioTracksRef.current[ti];
    if (tr?.kind !== 'a2m') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onStudioTimelineAudioLaneDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types?.includes?.('Files')) return;
    const strip = timelineStripRef.current;
    if (!strip) return;
    const pos = timelineLanePointFromStripClient(
      strip,
      e.clientX,
      e.clientY,
      studioTracksRef.current.length,
      trackLaneHRef.current,
      timelineHScrollRef.current,
    );
    const laneKind = pos !== null ? studioTracksRef.current[pos.ti]?.kind : null;
    if (pos !== null && (se2TrackIsAudioClipLane(laneKind) || laneKind === 'a2m')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const onStudioTimelineAudioLaneDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      if (!e.dataTransfer?.types?.includes?.('Files')) return;
      const strip = timelineStripRef.current;
      if (!strip) return;
      const pos = timelineLanePointFromStripClient(
        strip,
        e.clientX,
        e.clientY,
        studioTracksRef.current.length,
        trackLaneHRef.current,
        timelineHScrollRef.current,
      );
      if (pos === null) return;
      const laneKind = studioTracksRef.current[pos.ti]?.kind;
      if (laneKind !== 'a2m' && !se2TrackIsAudioClipLane(laneKind)) return;
      e.preventDefault();
      e.stopPropagation();
      const bpb = beatsPerBarRef.current;
      const tb = totalBeatsForSig(bpb);
      const ppb = ppbAtZoom(timelineZoomRef.current, bpb);
      const clipStartBeat = snapBeatToQuarterGrid(pos.xCss / ppb, tb);
      if (se2TrackIsAudioClipLane(laneKind)) {
        await ingestDroppedAudioOnAudioTrack(e, pos.ti, clipStartBeat);
      } else {
        await ingestDroppedAudioOnA2mTrack(e, pos.ti, clipStartBeat);
      }
    },
    [ingestDroppedAudioOnA2mTrack, ingestDroppedAudioOnAudioTrack],
  );

  const putMidiOnClipboard = useCallback((clips: MockMidiNote[] | null) => {
    if (!clips?.length) {
      midiClipboardRef.current = null;
      setMidiClipboardHeld(false);
      return;
    }
    midiClipboardRef.current = clips.map((n) => ({ ...n }));
    setMidiClipboardHeld(true);
  }, []);

  const midiCopySelection = useCallback(() => {
    const mt = midiMenuTargetRef.current;
    const ti = mt?.trackIndex ?? selectedTrackIndexRef.current;
    const tr = studioTracksRef.current[ti];
    if (!tr || !studioTrackOutputsMidi(tr)) return;
    const fromMenu = mt?.noteIndex;
    const indices =
      fromMenu !== null && fromMenu !== undefined
        ? [fromMenu].filter((i) => i >= 0 && i < tr.notes.length)
        : selectedOrAllIndicesForTrack(ti);
    if (!indices.length) return;
    putMidiOnClipboard(indices.map((i) => ({ ...tr.notes[i]! })));
  }, [putMidiOnClipboard, selectedOrAllIndicesForTrack]);

  const midiCutSelection = useCallback(() => {
    const mt = midiMenuTargetRef.current;
    const ti = mt?.trackIndex ?? selectedTrackIndexRef.current;
    const tr = studioTracksRef.current[ti];
    if (!tr || !studioTrackOutputsMidi(tr)) return;
    const fromMenu = mt?.noteIndex;
    const indices =
      fromMenu !== null && fromMenu !== undefined
        ? [fromMenu].filter((i) => i >= 0 && i < tr.notes.length)
        : selectedOrAllIndicesForTrack(ti);
    if (!indices.length) return;
    const cutSet = new Set(indices);
    putMidiOnClipboard(indices.map((i) => ({ ...tr.notes[i]! })));
    applyTracksMutation((prev) =>
      prev.map((t, i) =>
        i === ti ? { ...t, notes: sortNotesLikePianoRoll(t.notes.filter((_, j) => !cutSet.has(j))) } : t,
      ),
    );
    clearSelectedPianoNotes();
    midiMenuTargetRef.current = null;
  }, [applyTracksMutation, putMidiOnClipboard, sortNotesLikePianoRoll, selectedOrAllIndicesForTrack, clearSelectedPianoNotes]);

  const midiPasteSelection = useCallback(() => {
    const buf = midiClipboardRef.current;
    if (!buf?.length) return;
    const mt = midiMenuTargetRef.current;
    const ti = mt?.trackIndex ?? selectedTrackIndexRef.current;
    const trPaste = studioTracksRef.current[ti];
    if (!trPaste || !studioTrackOutputsMidi(trPaste)) return;
    const snap = pianoSnapEffRef.current;
    const tb = totalBeatsRef.current;
    const anchor = Math.min(...buf.map((n) => n.startBeat));
    const pasteBeat = snapBeatToSubdivision(cursorBeatRef.current, snap, tb);
    const delta = pasteBeat - anchor;
    const pasted: MockMidiNote[] = buf.map((n) => {
      let sb = snapBeatToSubdivision(n.startBeat + delta, snap, tb);
      sb = Math.max(0, Math.min(tb - PIANO_MIN_NOTE_DURATION_BEATS, sb));
      const durCap = tb - sb;
      const dur = Math.max(PIANO_MIN_NOTE_DURATION_BEATS, Math.min(n.durationBeats, durCap));
      return { ...n, startBeat: sb, durationBeats: dur };
    });
    const pastedSelection = new Set<number>();
    flushSync(() => {
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== ti) return t;
          const merged = sortNotesLikePianoRoll([...t.notes, ...pasted]);
          pasted.forEach((p) => {
            const idx = merged.findIndex(
              (n) =>
                n.pitch === p.pitch &&
                Math.abs(n.startBeat - p.startBeat) < 1e-4 &&
                Math.abs(n.durationBeats - p.durationBeats) < 1e-4 &&
                Math.abs(n.velocity - p.velocity) < 1e-4,
            );
            if (idx >= 0) pastedSelection.add(idx);
          });
          return { ...t, notes: merged };
        }),
      );
    });
    const arr = [...pastedSelection].sort((a, b) => a - b);
    setSelectedPianoNoteIndexes(new Set(arr));
    setSelectedPianoNoteIndex(arr.length ? arr[arr.length - 1]! : null);
  }, [applyTracksMutation, sortNotesLikePianoRoll]);

  const midiDuplicateSelection = useCallback(() => {
    const mt = midiMenuTargetRef.current;
    const ti = mt?.trackIndex ?? selectedTrackIndexRef.current;
    const snap = pianoSnapEffRef.current;
    const tb = totalBeatsRef.current;
    const tr = studioTracksRef.current[ti];
    if (!tr || !studioTrackOutputsMidi(tr)) return;
    const selected = selectedIndicesForTrack(ti);
    const fromMenu = mt?.noteIndex;
    const indices =
      selected.length > 0
        ? selected
        : fromMenu !== null && fromMenu !== undefined
          ? [fromMenu].filter((i) => i >= 0 && i < tr.notes.length)
          : [];
    if (!indices.length) return;
    const clones: MockMidiNote[] = indices.map((ni) => {
      const n = tr.notes[ni]!;
      let newStart = snapBeatToSubdivision(n.startBeat + n.durationBeats, snap, tb);
      newStart = Math.max(0, Math.min(tb - PIANO_MIN_NOTE_DURATION_BEATS, newStart));
      const durCap = tb - newStart;
      const dur = Math.max(PIANO_MIN_NOTE_DURATION_BEATS, Math.min(n.durationBeats, durCap));
      return { pitch: n.pitch, velocity: n.velocity, startBeat: newStart, durationBeats: dur };
    });
    const cloneIdxSet = new Set<number>();
    flushSync(() => {
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== ti) return t;
          const merged = sortNotesLikePianoRoll([...t.notes, ...clones]);
          clones.forEach((c) => {
            const idx = merged.findIndex(
              (note) =>
                note.pitch === c.pitch &&
                Math.abs(note.startBeat - c.startBeat) < 1e-4 &&
                Math.abs(note.durationBeats - c.durationBeats) < 1e-4,
            );
            if (idx >= 0) cloneIdxSet.add(idx);
          });
          return { ...t, notes: merged };
        }),
      );
    });
    const arr = [...cloneIdxSet].sort((a, b) => a - b);
    setSelectedPianoNoteIndexes(new Set(arr));
    setSelectedPianoNoteIndex(arr.length ? arr[arr.length - 1]! : null);
  }, [applyTracksMutation, sortNotesLikePianoRoll, selectedIndicesForTrack]);

  const clearDrumPatternOnTrack = clearTrackLaneContent;

  const midiDeleteSelection = useCallback(() => {
    const mt = midiMenuTargetRef.current;
    const ti = mt?.trackIndex ?? selectedTrackIndexRef.current;
    const trDel = studioTracksRef.current[ti];
    if (!trDel || !studioTrackOutputsMidi(trDel)) return;
    const fromMenu = mt?.noteIndex;
    const indices =
      fromMenu !== null && fromMenu !== undefined
        ? [fromMenu].filter((i) => i >= 0 && i < trDel.notes.length)
        : selectedOrAllIndicesForTrack(ti);
    if (!indices.length) return;
    const delSet = new Set(indices);
    applyTracksMutation((prev) =>
      prev.map((t, i) => {
        if (i !== ti || !studioTrackOutputsMidi(t)) return t;
        const nextNotes = sortNotesLikePianoRoll(t.notes.filter((_, j) => !delSet.has(j)));
        const wipePresets =
          studioTrackIsDrumChannel(t) && nextNotes.length === 0
            ? { drumPatternPresetId: undefined, beatLabPatternPresetId: undefined }
            : {};
        return { ...t, ...wipePresets, notes: nextNotes };
      }),
    );
    clearSelectedPianoNotes();
  }, [applyTracksMutation, sortNotesLikePianoRoll, selectedOrAllIndicesForTrack, clearSelectedPianoNotes]);

  const midiSplitSelection = useCallback(() => {
    const mt = midiMenuTargetRef.current;
    const ti = mt?.trackIndex ?? selectedTrackIndexRef.current;
    const ni = mt?.noteIndex ?? selectedPianoIdxRef.current;
    const snap = pianoSnapEffRef.current;
    const tb = totalBeatsRef.current;
    const tr = studioTracksRef.current[ti];
    if (ni === null || !tr || !studioTrackOutputsMidi(tr) || ni < 0 || ni >= tr.notes.length) return;
    const n = tr.notes[ni]!;
    const splitRaw = snapBeatToSubdivision(cursorBeatRef.current, snap, tb);
    const eps = 1e-5;
    if (splitRaw <= n.startBeat + eps || splitRaw >= n.startBeat + n.durationBeats - eps) return;
    const durLeft = splitRaw - n.startBeat;
    const durRight = n.startBeat + n.durationBeats - splitRaw;
    if (durLeft < PIANO_MIN_NOTE_DURATION_BEATS || durRight < PIANO_MIN_NOTE_DURATION_BEATS) return;
    const left: MockMidiNote = { ...n, durationBeats: durLeft };
    const right: MockMidiNote = { ...n, startBeat: splitRaw, durationBeats: durRight };
    flushSync(() => {
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== ti) return t;
          const next = [...t.notes];
          next.splice(ni, 1, left, right);
          return { ...t, notes: sortNotesLikePianoRoll(next) };
        }),
      );
    });
    const trAfter = studioTracksRef.current[ti];
    if (trAfter) {
      const idx = trAfter.notes.findIndex(
        (note) =>
          note.pitch === n.pitch &&
          Math.abs(note.startBeat - splitRaw) < 1e-4 &&
          Math.abs(note.durationBeats - durRight) < 1e-4,
      );
      if (idx >= 0) setSelectedPianoNoteIndex(idx);
    }
  }, [applyTracksMutation, sortNotesLikePianoRoll]);

  const applySelectionTransform = useCallback(
    (transform: (notes: MockMidiNote[], selected: number[], snap: number, tb: number) => MockMidiNote[]) => {
      const ti = selectedTrackIndexRef.current;
      const tr = studioTracksRef.current[ti];
      if (!tr || !studioTrackOutputsMidi(tr)) return;
      const selected = selectedOrAllIndicesForTrack(ti);
      if (!selected.length) return;
      const snap = pianoSnapEffRef.current;
      const tb = totalBeatsRef.current;
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== ti || !studioTrackOutputsMidi(t)) return t;
          return { ...t, notes: sortNotesLikePianoRoll(transform(t.notes, selected, snap, tb)) };
        }),
      );
    },
    [applyTracksMutation, selectedOrAllIndicesForTrack, sortNotesLikePianoRoll],
  );

  const quantizeSelected = useCallback(() => {
    applySelectionTransform((notes, selected, snap, tb) => {
      const set = new Set(selected);
      const strength = Math.max(0, Math.min(1, quantizeStrength / 100));
      const swing = Math.max(0, Math.min(0.49, quantizeSwing / 200));
      return notes.map((n, i) => {
        if (!set.has(i)) return n;
        const q = snapBeatToSubdivision(n.startBeat, snap, tb);
        const next = n.startBeat + (q - n.startBeat) * strength;
        const swingOff = ((Math.floor(next * snap) % 2) === 1 ? (1 / snap) * swing : 0);
        const sb = Math.max(0, Math.min(tb - PIANO_MIN_NOTE_DURATION_BEATS, next + swingOff));
        return { ...n, startBeat: sb };
      });
    });
  }, [applySelectionTransform, quantizeStrength, quantizeSwing]);

  const transposeSelected = useCallback((semi: number) => {
    applySelectionTransform((notes, selected) => {
      const set = new Set(selected);
      return notes.map((n, i) =>
        set.has(i) ? { ...n, pitch: Math.max(PIANO_PITCH_LO, Math.min(PIANO_PITCH_HI, n.pitch + semi)) } : n,
      );
    });
  }, [applySelectionTransform]);

  const transposeAllTrackNotes = useCallback(
    (semi: number) => {
      const ti = selectedTrackIndexRef.current;
      const tr = studioTracksRef.current[ti];
      if (!tr || !studioTrackOutputsMidi(tr) || tr.notes.length === 0) return;
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== ti || !studioTrackOutputsMidi(t)) return t;
          return {
            ...t,
            notes: sortNotesLikePianoRoll(
              t.notes.map((n) => ({
                ...n,
                pitch: Math.max(PIANO_PITCH_LO, Math.min(PIANO_PITCH_HI, n.pitch + semi)),
              })),
            ),
          };
        }),
      );
    },
    [applyTracksMutation, sortNotesLikePianoRoll],
  );

  const humanizeSelected = useCallback(() => {
    applySelectionTransform((notes, selected, snap, tb) => {
      const set = new Set(selected);
      const halfCell = 0.5 * (1 / snap);
      return notes.map((n, i) => {
        if (!set.has(i)) return n;
        const j = Math.sin((n.pitch + 1) * 17.23 + n.startBeat * 43.11);
        const dt = j * halfCell * 0.35;
        const dv = Math.round(j * 10);
        return {
          ...n,
          startBeat: Math.max(0, Math.min(tb - PIANO_MIN_NOTE_DURATION_BEATS, n.startBeat + dt)),
          velocity: Math.max(1, Math.min(127, n.velocity + dv)),
        };
      });
    });
  }, [applySelectionTransform]);

  const legatoSelected = useCallback(() => {
    applySelectionTransform((notes, selected, _snap, tb) => {
      const sel = new Set(selected);
      const sortedSel = [...selected].sort((a, b) => notes[a]!.startBeat - notes[b]!.startBeat);
      const nextByIdx = new Map<number, MockMidiNote>();
      for (let i = 0; i < sortedSel.length - 1; i++) nextByIdx.set(sortedSel[i]!, notes[sortedSel[i + 1]!]!);
      return notes.map((n, i) => {
        if (!sel.has(i)) return n;
        const nx = nextByIdx.get(i);
        if (!nx) return n;
        const dur = Math.max(PIANO_MIN_NOTE_DURATION_BEATS, nx.startBeat - n.startBeat);
        return { ...n, durationBeats: Math.min(tb - n.startBeat, dur) };
      });
    });
  }, [applySelectionTransform]);

  const duplicateSelectedPhrase = useCallback(() => {
    const ti = selectedTrackIndexRef.current;
    const tr = studioTracksRef.current[ti];
    if (!tr || !studioTrackOutputsMidi(tr)) return;
    const sel = selectedOrAllIndicesForTrack(ti);
    if (!sel.length) return;
    const selectedNotes = sel.map((i) => tr.notes[i]!).sort((a, b) => a.startBeat - b.startBeat);
    const minStart = selectedNotes[0]!.startBeat;
    const maxEnd = Math.max(...selectedNotes.map((n) => n.startBeat + n.durationBeats));
    const delta = Math.max(1 / pianoSnapEffRef.current, maxEnd - minStart);
    const tb = totalBeatsRef.current;
    const clones = selectedNotes.map((n) => ({
      ...n,
      startBeat: Math.max(0, Math.min(tb - PIANO_MIN_NOTE_DURATION_BEATS, n.startBeat + delta)),
    }));
    applyTracksMutation((prev) =>
      prev.map((t, i) => (i === ti && studioTrackOutputsMidi(t) ? { ...t, notes: sortNotesLikePianoRoll([...t.notes, ...clones]) } : t)),
    );
  }, [applyTracksMutation, selectedOrAllIndicesForTrack, sortNotesLikePianoRoll]);

  const arpeggiateSelected = useCallback(() => {
    applySelectionTransform((notes, selected, snap, tb) => {
      const ordered = selected.map((i) => ({ i, n: notes[i]! })).sort((a, b) => a.n.pitch - b.n.pitch);
      if (!ordered.length) return notes;
      const step = Math.max(1 / snap, 0.25);
      const anchor = ordered[0]!.n.startBeat;
      const out = [...notes];
      ordered.forEach((o, idx) => {
        out[o.i] = { ...o.n, startBeat: Math.max(0, Math.min(tb - PIANO_MIN_NOTE_DURATION_BEATS, anchor + idx * step)) };
      });
      return out;
    });
  }, [applySelectionTransform]);

  const strumSelected = useCallback(() => {
    applySelectionTransform((notes, selected, _snap, tb) => {
      const ordered = selected.map((i) => ({ i, n: notes[i]! })).sort((a, b) => a.n.pitch - b.n.pitch);
      const out = [...notes];
      ordered.forEach((o, idx) => {
        out[o.i] = { ...o.n, startBeat: Math.max(0, Math.min(tb - PIANO_MIN_NOTE_DURATION_BEATS, o.n.startBeat + idx * 0.03)) };
      });
      return out;
    });
  }, [applySelectionTransform]);

  const chopSelected = useCallback(() => {
    const ti = selectedTrackIndexRef.current;
    const tr = studioTracksRef.current[ti];
    if (!tr || !studioTrackOutputsMidi(tr)) return;
    const sel = selectedOrAllIndicesForTrack(ti);
    if (!sel.length) return;
    const set = new Set(sel);
    const extra: MockMidiNote[] = [];
    const next = tr.notes.flatMap((n, i) => {
      if (!set.has(i)) return [n];
      const count = 3;
      const subDur = Math.max(PIANO_MIN_NOTE_DURATION_BEATS, n.durationBeats / count);
      for (let c = 1; c < count; c++) {
        extra.push({ ...n, startBeat: n.startBeat + c * subDur, durationBeats: subDur, velocity: Math.max(1, Math.min(127, n.velocity - c * 6)) });
      }
      return [{ ...n, durationBeats: subDur }];
    });
    applyTracksMutation((prev) =>
      prev.map((t, i) => (i === ti && studioTrackOutputsMidi(t) ? { ...t, notes: sortNotesLikePianoRoll([...next, ...extra]) } : t)),
    );
  }, [applyTracksMutation, selectedOrAllIndicesForTrack, sortNotesLikePianoRoll]);

  const randomizeVelocitySelected = useCallback(() => {
    applySelectionTransform((notes, selected) => {
      const set = new Set(selected);
      return notes.map((n, i) => {
        if (!set.has(i)) return n;
        const r = Math.sin((n.startBeat + n.pitch * 0.31) * 91.7);
        return { ...n, velocity: Math.max(1, Math.min(127, Math.round(n.velocity + r * 22))) };
      });
    });
  }, [applySelectionTransform]);

  const midiUndoEdit = useCallback(() => {
    const u = undoStacksRef.current;
    if (!u.length) return;
    const snap = u[u.length - 1]!;
    undoStacksRef.current = u.slice(0, -1);
    redoStacksRef.current = [...redoStacksRef.current.slice(-49), snapshotStudioTracks(studioTracksRef.current)];
    setStudioTracks(snapshotStudioTracks(snap));
    setSelectedPianoNoteIndex(null);
    setSelectedPianoNoteIndexes(new Set());
    syncUndoRedoUi();
  }, [syncUndoRedoUi]);

  const midiRedoEdit = useCallback(() => {
    const rsn = redoStacksRef.current;
    if (!rsn.length) return;
    const snap = rsn[rsn.length - 1]!;
    redoStacksRef.current = rsn.slice(0, -1);
    undoStacksRef.current = [...undoStacksRef.current.slice(-49), snapshotStudioTracks(studioTracksRef.current)];
    setStudioTracks(snapshotStudioTracks(snap));
    setSelectedPianoNoteIndex(null);
    setSelectedPianoNoteIndexes(new Set());
    syncUndoRedoUi();
  }, [syncUndoRedoUi]);

  const handlePianoRollNotesContextMenu = useCallback(
    (info: { clientX: number; clientY: number; noteHitIndex: number | null }) => {
      if (!isScreenActiveRef.current) return;
      if (info.noteHitIndex !== null) {
        setSelectedPianoNoteIndex(info.noteHitIndex);
        setSelectedPianoNoteIndexes(new Set([info.noteHitIndex]));
      }
      const ti = selectedTrackIndexRef.current;
      const ni = info.noteHitIndex !== null ? info.noteHitIndex : selectedPianoIdxRef.current;
      midiMenuTargetRef.current = { trackIndex: ti, noteIndex: ni };
      setContextMenuHasNoteTarget(
        info.noteHitIndex !== null ||
          selectedPianoIdxRef.current !== null ||
          selectedPianoIdxSetRef.current.size > 0,
      );
      setEditorContextMenu({ x: info.clientX, y: info.clientY });
    },
    [],
  );

  const applyMidiSelectionFromTimelineStripPoint = useCallback((clientX: number, clientY: number) => {
    const strip = timelineStripRef.current;
    if (!strip) return;
    const rect = strip.getBoundingClientRect();
    const yRel = clientY - rect.top;
    if (!Number.isFinite(yRel) || yRel < 0) return;
    const lh = trackLaneHRef.current;
    const ti = Math.floor(yRel / lh);
    if (ti < 0 || ti >= studioTracksRef.current.length) return;
    const xCss = clientX - rect.left;
    const yLaneLocal = yRel - ti * lh;
    const bpb = beatsPerBarRef.current;
    const z = timelineZoomRef.current;
    const ppb = ppbAtZoom(z, bpb);
    const hit = hitTimelineMidiNoteIndex(studioTracksRef.current[ti]!, xCss, yLaneLocal, ppb, lh);
    const prevTrack = selectedTrackIndexRef.current;
    setSelectedTrackIndex(ti);
    if (hit >= 0) {
      setSelectedPianoNoteIndex(hit);
      midiMenuTargetRef.current = { trackIndex: ti, noteIndex: hit };
      return;
    }
    if (ti === prevTrack) {
      const prevNi = selectedPianoIdxRef.current;
      const tr = studioTracksRef.current[ti];
      if (prevNi !== null && tr && studioTrackOutputsMidi(tr) && prevNi >= 0 && prevNi < tr.notes.length) {
        setSelectedPianoNoteIndex(prevNi);
        midiMenuTargetRef.current = { trackIndex: ti, noteIndex: prevNi };
        return;
      }
    }
    setSelectedPianoNoteIndex(null);
    midiMenuTargetRef.current = { trackIndex: ti, noteIndex: null };
  }, []);

  const onTimelineLaneMidiContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const strip = timelineStripRef.current;
      if (strip) {
        const tc = studioTracksRef.current.length;
        const lh = trackLaneHRef.current;
        const pos = timelineLanePointFromStripClient(strip, e.clientX, e.clientY, tc, lh, timelineHScrollRef.current);
        if (pos) {
          const tr = studioTracksRef.current[pos.ti];
          const ppb = ppbAtZoom(timelineZoomRef.current, beatsPerBarRef.current);
          const audioId = tr
            ? hitTimelineAudioClipId(tr, pos.xCss, pos.yLaneLocal, ppb, lh)
            : null;
          if (audioId) {
            clearSelectedPianoNotes();
            setSelectedTimelineAudioClip({ trackIndex: pos.ti, clipId: audioId });
            setSelectedTrackIndex(pos.ti);
            const beatPtr = clientXToBeat(e.clientX);
            const clip = tr!.audioClips.find((c) => c.id === audioId);
            const tb = totalBeatsRef.current;
            const markerBeat = snapTimelineAudioClipStartBeat(
              beatPtr,
              tb,
              beatsPerBarRef.current,
              pianoSnapEffRef.current,
              e.shiftKey,
              false,
            );
            if (
              clip &&
              markerBeat > clip.startBeat + 1e-4 &&
              markerBeat < clip.startBeat + clip.durationBeats - 1e-4
            ) {
              setAudioClipSplitMarkerBeat(markerBeat);
            }
            setContextMenuHasAudioTarget(true);
            setContextMenuHasNoteTarget(false);
            setEditorContextMenu({ x: e.clientX, y: e.clientY });
            return;
          }
        }
      }
        applyMidiSelectionFromTimelineStripPoint(e.clientX, e.clientY);
      setContextMenuHasAudioTarget(selectedTimelineAudioClipRef.current !== null);
      setContextMenuHasNoteTarget(midiMenuTargetRef.current?.noteIndex != null);
      setEditorContextMenu({ x: e.clientX, y: e.clientY });
    },
    [applyMidiSelectionFromTimelineStripPoint, clientXToBeat],
  );

  const onTimelinePlayheadContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const strip = timelineStripRef.current;
      if (!strip) return;
      applyMidiSelectionFromTimelineStripPoint(e.clientX, e.clientY);
      setContextMenuHasNoteTarget(midiMenuTargetRef.current?.noteIndex != null);
      setEditorContextMenu({ x: e.clientX, y: e.clientY });
    },
    [applyMidiSelectionFromTimelineStripPoint],
  );

  const midiHasNoteSel = selectedPianoNoteIndex !== null || selectedPianoNoteIndexes.size > 0;
  const hasAudioClipSel = selectedTimelineAudioClip !== null;
  const hasEditTarget = midiHasNoteSel || hasAudioClipSel;
  const canMidiUndo = undoStackDepth > 0;
  const canMidiRedo = redoStackDepth > 0;
  const canClearLaneContent = se2TrackHasClearableLaneContent(studioTracks[selectedTrackIndex]);
  const activeDrumTrack = studioTracks[selectedTrackIndex];
  const canClearDrumPattern =
    activeDrumTrack != null &&
    studioTrackIsDrumChannel(activeDrumTrack) &&
    activeDrumTrack.notes.length > 0;
  const harmonyEligibleTrack = studioTracks[selectedTrackIndex];
  const rhythmEligibleTrack = studioTracks[selectedTrackIndex];
  const glideBassEligibleTrack = studioTracks[selectedTrackIndex];
  const synthGenoEligibleTrack = studioTracks[selectedTrackIndex];
  const grooveLeadEligibleTrack = studioTracks[selectedTrackIndex];
  const lab808EligibleTrack = studioTracks[selectedTrackIndex];
  const genoUltraEligibleTrack = studioTracks[selectedTrackIndex];
  const genoBassEligibleTrack = studioTracks[selectedTrackIndex];
  const drumGeneratorEligibleTrack = studioTracks[selectedTrackIndex];
  const beatPadsEligibleTrack = studioTracks[selectedTrackIndex];
  const humCaptureEligibleTrack = studioTracks[selectedTrackIndex];
  const guitarEligibleTrack = studioTracks[selectedTrackIndex];
  const chordGenieEligibleTrack = studioTracks[selectedTrackIndex];
  const showHarmonyUi = studioTrackIsInstrumentHarmonyChannel(harmonyEligibleTrack);
  const showRhythmUi = studioTrackIsRhythmChannel(rhythmEligibleTrack);
  const showGlideBassUi = studioTrackIsGlideBassChannel(glideBassEligibleTrack);
  const showSynthGenoUi = studioTrackIsSynthGenoChannel(synthGenoEligibleTrack);
  const showGrooveLeadUi = studioTrackIsGrooveLeadChannel(grooveLeadEligibleTrack);
  const showLab808Ui = studioTrackIsLab808Channel(lab808EligibleTrack);
  const showGenoUltraSynthUi = studioTrackIsGenoUltraSynthChannel(genoUltraEligibleTrack);
  const showGenoBassSynthUi = studioTrackIsGenoBassSynthChannel(genoBassEligibleTrack);
  const showDrumGeneratorUi = studioTrackIsDrumGeneratorChannel(drumGeneratorEligibleTrack);
  const showBeatPadsUi = studioTrackIsBeatPadsChannel(beatPadsEligibleTrack);
  /** Beat Pads fills the SE2 workspace (Beat Lab style) — not the piano roll or mixer strip. */
  const beatPadsLaneLayoutActive = showBeatPadsUi;
  /** Full Beat Lab workspace when pads machine is open (hidden while mixer steals vertical space). */
  const beatPadsFullscreenActive = showBeatPadsUi && beatPadsMachineOpen && !showMixer;
  /** Close pads — tracks + SE2 chrome; step sequencer strip at bottom only. */
  const beatPadsSequencerDocked = showBeatPadsUi && !beatPadsMachineOpen;
  /** Bottom dock — step sequencer only; never while Mix view is up. */
  const beatPadsPanelDocked =
    showBeatPadsUi && !showMixer && beatPadsSequencerDocked;
  const beatPadsPanelVisible =
    showBeatPadsUi && !showMixer && (beatPadsFullscreenActive || beatPadsPanelDocked);
  const showPianoRollInLayout = showPianoRoll && !beatPadsLaneLayoutActive;

  const closeBeatPadsMachineChrome = useCallback(() => {
    setBeatPadsMachineOpen(false);
    setShowPianoRoll(false);
    setPianoRollExpanded(false);
  }, []);

  const openBeatPadsMachineChrome = useCallback(() => {
    setBeatPadsMachineOpen(true);
  }, []);

  const toggleStudioMixerView = useCallback(() => {
    setShowMixer((v) => !v);
    setShowPianoRoll(false);
    setPianoRollExpanded(false);
  }, []);

  const showHumCaptureUi = studioTrackIsHumCaptureChannel(humCaptureEligibleTrack);
  const showGuitarUi = studioTrackIsGuitarChannel(guitarEligibleTrack);
  const showGenoChordCreatorUi = studioTrackIsGenoChordCreatorChannel(chordGenieEligibleTrack);
  /** Guitar lane in Piano edit — shrink timeline, hide MIDI grid, expand dock (not in Mix view). */
  const guitarFocusActive =
    showGuitarUi && guitarPanelOpen && showPianoRoll && !showMixer && !pianoRollExpanded;
  const studioLanePad = Math.max(2, String(studioTracks.length).length);
  const consolidateTrackOptions = useMemo(
    () =>
      studioTracks.map((t, trackIndex) => ({
        trackIndex,
        label: se2TrackNumberedName(t.laneNumber, t.name, studioLanePad),
        clipCount: t.audioClips.length,
        canConsolidate: se2TrackHasDraggableAudioClips(t.kind) && t.audioClips.length > 0,
      })),
    [studioTracks, studioLanePad],
  );
  const normalizeAudioDisabled = useMemo(() => {
    const tr = studioTracks[selectedTrackIndex];
    if (!tr || !se2TrackHasDraggableAudioClips(tr.kind)) return true;
    if (
      selectedTimelineAudioClip &&
      selectedTimelineAudioClip.trackIndex === selectedTrackIndex
    ) {
      return !tr.audioClips.some((c) => c.id === selectedTimelineAudioClip.clipId);
    }
    return tr.audioClips.length === 0;
  }, [selectedTrackIndex, selectedTimelineAudioClip, studioTracks]);
  const normalizeAudioTitle = useMemo(() => {
    const tr = studioTracks[selectedTrackIndex];
    if (!tr || !se2TrackHasDraggableAudioClips(tr.kind)) {
      return 'Select an audio lane with clips to normalize';
    }
    if (
      selectedTimelineAudioClip &&
      selectedTimelineAudioClip.trackIndex === selectedTrackIndex
    ) {
      return 'Normalize the selected audio clip to peak level';
    }
    if (tr.audioClips.length === 0) return 'No audio clips on this lane';
    return `Normalize all ${tr.audioClips.length} clip(s) on ${tr.name}`;
  }, [selectedTrackIndex, selectedTimelineAudioClip, studioTracks]);
  const consolidateRange = useMemo(
    () =>
      se2ConsolidateRangeFromBars(
        consolidateStartBar,
        consolidateEndBar,
        SE2_ARRANGEMENT_BARS,
        beatsPerBar,
      ),
    [consolidateStartBar, consolidateEndBar, beatsPerBar],
  );
  const consolidateRangeLabel = useMemo(() => {
    if (!consolidateRange) return 'Set end bar after start bar';
    return formatSe2ConsolidateRangeLabel(consolidateRange, bpm, beatsPerBar);
  }, [consolidateRange, bpm, beatsPerBar]);
  const genoBuildImportTracksForUltra = useMemo(
    () =>
      studioTracks.map((t) => ({
        kind: t.kind,
        name: t.name,
        laneNumber: t.laneNumber,
        trackKeyRoot: t.trackKeyRoot,
        trackKeyMode: t.trackKeyMode,
      })),
    [studioTracks],
  );
  const genoUltraKeySourceTracks = useMemo(
    () =>
      buildGenoUltraArpKeySourceTracks(
        studioTracks.map((t) => ({
          kind: t.kind,
          a2mMode: t.kind === 'a2m' ? studioNormalizeA2mMode(t.a2mMode) : undefined,
          trackKeyRoot: t.trackKeyRoot,
          trackKeyMode: t.trackKeyMode,
          a2mKeyRoot: t.a2mKeyRoot,
          a2mKeyMode: t.a2mKeyMode,
          notes: t.notes,
          name: t.name,
          laneNumber: t.laneNumber,
          harmonySteps: t.harmonySteps,
          harmonyLoopBars: t.harmonyLoopBars,
          rhythmSteps: t.rhythmSteps,
          rhythmLoopBars: t.rhythmLoopBars,
        })),
        studioLanePad,
      ),
    [studioTracks, studioLanePad],
  );
  const genoUltraGenoBuildSources = useMemo(
    () =>
      listGenoUltraGenoBuildChordSources(genoBuildImportTracksForUltra, beatsPerBar, {
        keyRoot: songKeyRoot,
        keyMode: songKeyMode,
      }),
    [genoBuildImportTracksForUltra, beatsPerBar, songKeyRoot, songKeyMode, genoBuildSessionTick, genoUltraSynthPanelOpen],
  );
  const harmonyDetectedKey = harmonyEligibleTrack ? studioTrackDetectedKey(harmonyEligibleTrack) : {};
  const harmonyKeyRoot = harmonyDetectedKey.keyRoot ?? songKeyRoot;
  const harmonyKeyMode = harmonyDetectedKey.keyMode ?? songKeyMode;
  const canRegenerateGrooveLead =
    (harmonyEligibleTrack?.harmonySteps?.length ?? 0) > 0 &&
    (harmonyEligibleTrack?.harmonySoundKind === 'grooveLead' ||
      Boolean(studioParseGrooveLeadInstrumentId(harmonyEligibleTrack?.midiInstrumentId)));
  const harmonyToolbar = showHarmonyUi ? (
    <div className="pr-toolbar-row">
      <button
        ref={harmonyBtnRef}
        type="button"
        disabled={running}
        onClick={() => setHarmonyPanelOpen((v) => !v)}
        className="pr-toolbar-chip se2-type-micro flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[8px] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: harmonyPanelOpen ? `${harmonyEligibleTrack?.colorHex ?? '#5B8CFF'}88` : '#333340',
          background: harmonyPanelOpen ? `${harmonyEligibleTrack?.colorHex ?? '#5B8CFF'}22` : '#16161e',
          color: harmonyPanelOpen ? (harmonyEligibleTrack?.colorHex ?? '#5B8CFF') : '#a8a8b8',
        }}
        title="Build chord progressions here — LOAD ALL or + ADD TO TIMELINE, then APPLY TO INSTRUMENT (✦ sparkles does not create chords)"
      >
        <Music2 size={10} strokeWidth={2.2} aria-hidden />
        <span>Progression+</span>
      </button>
      {(harmonyEligibleTrack?.harmonySteps?.length ?? 0) === 0 ? (
        <span
          className="se2-type-micro truncate max-w-[11rem] rounded border px-1.5 py-0.5 text-[7px] font-semibold"
          style={{ borderColor: '#c9a86a44', background: '#1a1510', color: '#c9a86a' }}
          title="Open Progression+ and add chords to the timeline — ↻ LOOP and ✦ Generate do not build progressions"
        >
          Chords: build inside Progression+
        </span>
      ) : null}
      {canRegenerateGrooveLead ? (
        <button
          type="button"
          disabled={running}
          onClick={() => regenerateGrooveLeadMelody(selectedTrackIndex)}
          className="pr-toolbar-chip se2-type-micro rounded border px-1.5 py-0.5 text-[8px] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: '#7cf4c688',
            background: '#14221c',
            color: '#7cf4c6',
          }}
          title="New melody variation only — does not create or change chord progressions"
        >
          Regen melody
        </button>
      ) : null}
      <button
        type="button"
        disabled={running || !midiHasNoteSel}
        onClick={() => midiDeleteSelection()}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: midiHasNoteSel ? '#e85d7566' : '#333340',
          background: midiHasNoteSel ? '#2a1418' : '#16161e',
          color: midiHasNoteSel ? '#e85d75' : '#6a6a78',
        }}
        title="Delete selected notes on this instrument channel"
      >
        Delete
      </button>
      <button
        type="button"
        disabled={running || !(harmonyEligibleTrack?.notes.length ?? 0)}
        onClick={() => clearTrackLaneContent(selectedTrackIndex)}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: (harmonyEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d7566' : '#333340',
          background: (harmonyEligibleTrack?.notes.length ?? 0) > 0 ? '#2a1418' : '#16161e',
          color: (harmonyEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d75' : '#6a6a78',
        }}
        title="Delete all MIDI notes on this lane — Progression+ chord steps stay on the track"
      >
        Clear notes
      </button>
    </div>
  ) : undefined;

  const rhythmToolbar = showRhythmUi ? (
    <div className="pr-toolbar-row">
      <span
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide inline-flex items-center gap-1"
        style={{
          borderColor: `${rhythmEligibleTrack?.colorHex ?? '#C77DFF'}66`,
          background: `${rhythmEligibleTrack?.colorHex ?? '#C77DFF'}18`,
          color: rhythmEligibleTrack?.colorHex ?? '#C77DFF',
        }}
        title="Rhythm Edit track — hits per bar built into this lane"
      >
        Rhythm lane
        <StudioEditor2HelpTip tab="rhythmEdit" title="Rhythm Edit lane — how to use hits per bar" />
      </span>
      <button
        type="button"
        disabled={running || !midiHasNoteSel}
        onClick={() => midiDeleteSelection()}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: midiHasNoteSel ? '#e85d7566' : '#333340',
          background: midiHasNoteSel ? '#2a1418' : '#16161e',
          color: midiHasNoteSel ? '#e85d75' : '#6a6a78',
        }}
        title="Delete selected notes on this rhythm lane"
      >
        Delete
      </button>
      <button
        type="button"
        disabled={running || !(rhythmEligibleTrack?.notes.length ?? 0)}
        onClick={() => clearTrackLaneContent(selectedTrackIndex)}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: (rhythmEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d7566' : '#333340',
          background: (rhythmEligibleTrack?.notes.length ?? 0) > 0 ? '#2a1418' : '#16161e',
          color: (rhythmEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d75' : '#6a6a78',
        }}
        title="Delete all MIDI notes on this rhythm lane — rhythm step data stays"
      >
        Clear notes
      </button>
    </div>
  ) : undefined;

  const rhythmPullSources = useMemo(
    () =>
      studioTracks
        .map((t, index) => ({ t, index }))
        .filter(
          ({ t, index }) =>
            index !== selectedTrackIndex &&
            studioTrackOutputsMidi(t) &&
            !studioTrackIsDrumChannel(t) &&
            (t.notes.length > 0 ||
              (t.rhythmSteps?.length ?? 0) > 0 ||
              (t.harmonySteps?.length ?? 0) > 0),
        )
        .map(({ t, index }) => ({
          index,
          name: se2TrackNumberedName(t.laneNumber, t.name, studioLanePad),
          noteCount: t.notes.length,
          hasSteps: (t.rhythmSteps?.length ?? 0) > 0 || (t.harmonySteps?.length ?? 0) > 0,
        })),
    [selectedTrackIndex, studioLanePad, studioTracks],
  );

  const rhythmEditPanel =
    showRhythmUi && rhythmEligibleTrack ? (
      <StudioRhythmEditTrackPanel
        steps={rhythmEligibleTrack.rhythmSteps ?? []}
        onStepsChange={(steps) => updateTrackRhythmSteps(selectedTrackIndex, steps)}
        loopBars={studioNormalizeHarmonyLoopBars(rhythmEligibleTrack.rhythmLoopBars)}
        onLoopBarsChange={(bars) => updateTrackRhythmLoopBars(selectedTrackIndex, bars)}
        onApplyToRoll={() => applyRhythmToRoll(selectedTrackIndex)}
        onPreviewStep={(step) => {
          if (step.rest || !step.label.trim()) return;
          const parsed = parseChordSymbolToken(step.label);
          if (!parsed?.notes.length) return;
          void previewPianoPitch(Math.min(...parsed.notes), 0.85);
        }}
        pullSources={rhythmPullSources}
        onPullFromTrack={(sourceIndex) => pullFromTrackToRhythmLane(selectedTrackIndex, sourceIndex)}
        disabled={running}
        accentHex={rhythmEligibleTrack.colorHex}
      />
    ) : undefined;

  const glideBassToolbar = showGlideBassUi ? (
    <div className="pr-toolbar-row">
      <button
        type="button"
        disabled={running}
        aria-pressed={glideBassPanelOpen}
        onClick={() => {
          openPianoRollEditor();
          setGlideBassPanelOpen((v) => !v);
        }}
        className="pr-toolbar-chip se2-type-micro flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[8px] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: glideBassPanelOpen ? `${glideBassEligibleTrack?.colorHex ?? '#9B6BFF'}88` : '#333340',
          background: glideBassPanelOpen ? `${glideBassEligibleTrack?.colorHex ?? '#9B6BFF'}22` : '#16161e',
          color: glideBassPanelOpen ? (glideBassEligibleTrack?.colorHex ?? '#9B6BFF') : '#a8a8b8',
        }}
        title="Bass Glide synth — oscillators, filter, glide FX, bass generator"
      >
        <span>Bass Glide</span>
      </button>
      <button
        type="button"
        disabled={running || !midiHasNoteSel}
        onClick={() => midiDeleteSelection()}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: midiHasNoteSel ? '#e85d7566' : '#333340',
          background: midiHasNoteSel ? '#2a1418' : '#16161e',
          color: midiHasNoteSel ? '#e85d75' : '#6a6a78',
        }}
      >
        Delete
      </button>
      <button
        type="button"
        disabled={running || !(glideBassEligibleTrack?.notes.length ?? 0)}
        onClick={() => clearTrackLaneContent(selectedTrackIndex)}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: (glideBassEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d7566' : '#333340',
          background: (glideBassEligibleTrack?.notes.length ?? 0) > 0 ? '#2a1418' : '#16161e',
          color: (glideBassEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d75' : '#6a6a78',
        }}
        title="Clear all bass MIDI notes — keep this Bass Glide track"
      >
        Clear notes
      </button>
    </div>
  ) : undefined;

  const synthGenoToolbar = showSynthGenoUi ? (
    <div className="pr-toolbar-row">
      <button
        type="button"
        disabled={running}
        aria-pressed={synthGenoPanelOpen}
        onClick={() => {
          openPianoRollEditor();
          setSynthGenoPanelOpen((v) => !v);
        }}
        className="pr-toolbar-chip se2-type-micro flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[8px] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: synthGenoPanelOpen ? `${synthGenoEligibleTrack?.colorHex ?? '#00E5CC'}88` : '#333340',
          background: synthGenoPanelOpen ? `${synthGenoEligibleTrack?.colorHex ?? '#00E5CC'}22` : '#16161e',
          color: synthGenoPanelOpen ? (synthGenoEligibleTrack?.colorHex ?? '#00E5CC') : '#a8a8b8',
        }}
        title="Synth Geno — describe a sound and generate your patch"
      >
        <span>Synth Geno</span>
      </button>
      <StudioEditor2HelpTip tab="synthGeno" title="Synth Geno lane — chords, sound & compose" />
      <button
        type="button"
        disabled={running || !midiHasNoteSel}
        onClick={() => midiDeleteSelection()}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: midiHasNoteSel ? '#e85d7566' : '#333340',
          background: midiHasNoteSel ? '#2a1418' : '#16161e',
          color: midiHasNoteSel ? '#e85d75' : '#6a6a78',
        }}
      >
        Delete
      </button>
      <button
        type="button"
        disabled={running || !(synthGenoEligibleTrack?.notes.length ?? 0)}
        onClick={() => clearTrackLaneContent(selectedTrackIndex)}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: (synthGenoEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d7566' : '#333340',
          background: (synthGenoEligibleTrack?.notes.length ?? 0) > 0 ? '#2a1418' : '#16161e',
          color: (synthGenoEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d75' : '#6a6a78',
        }}
        title="Clear all MIDI notes — keep this Synth Geno track and patch"
      >
        Clear notes
      </button>
    </div>
  ) : undefined;

  const canRegenerateDedicatedGrooveLead = (() => {
    if (!grooveLeadEligibleTrack || !studioTrackIsGrooveLeadChannel(grooveLeadEligibleTrack)) {
      return false;
    }
    const harmonyTr = se2ResolveGrooveLeadHarmonyTrack(
      studioTracks,
      grooveLeadEligibleTrack,
      grooveLeadEligibleTrack.id,
    );
    if (!harmonyTr) return false;
    return se2GrooveLeadCanFollowHarmonySource(harmonyTr as GenoUltraArpSe2TrackChordInput);
  })();
  const grooveLeadToolbar = showGrooveLeadUi ? (
    <div className="pr-toolbar-row">
      <button
        type="button"
        disabled={running}
        aria-pressed={grooveLeadPanelOpen}
        onClick={() => {
          openPianoRollEditor();
          setGrooveLeadPanelOpen((v) => !v);
        }}
        className="pr-toolbar-chip se2-type-micro flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[8px] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: grooveLeadPanelOpen ? `${grooveLeadEligibleTrack?.colorHex ?? '#4EC8E8'}88` : '#333340',
          background: grooveLeadPanelOpen ? `${grooveLeadEligibleTrack?.colorHex ?? '#4EC8E8'}22` : '#16161e',
          color: grooveLeadPanelOpen ? (grooveLeadEligibleTrack?.colorHex ?? '#4EC8E8') : '#a8a8b8',
        }}
        title="Groove Lead — R&B / gospel lead synth from Groove Lab"
      >
        <span>Groove Lead</span>
      </button>
      <StudioEditor2HelpTip tab="grooveLead" title="Groove Lead lane — R&B / gospel lead synth" />
      {canRegenerateDedicatedGrooveLead ? (
        <button
          type="button"
          disabled={running}
          onClick={() => regenerateDedicatedGrooveLeadMelody(selectedTrackIndex)}
          className="pr-toolbar-chip se2-type-micro rounded border px-1.5 py-0.5 text-[8px] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: '#7cf4c688',
            background: '#14221c',
            color: '#7cf4c6',
          }}
          title="New Mellodo-style lead line — stepwise through chord voicing"
        >
          Regen melody
        </button>
      ) : null}
      <button
        type="button"
        disabled={running || !midiHasNoteSel}
        onClick={() => midiDeleteSelection()}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: midiHasNoteSel ? '#e85d7566' : '#333340',
          background: midiHasNoteSel ? '#2a1418' : '#16161e',
          color: midiHasNoteSel ? '#e85d75' : '#6a6a78',
        }}
      >
        Delete
      </button>
      <button
        type="button"
        disabled={running || !(grooveLeadEligibleTrack?.notes.length ?? 0)}
        onClick={() => clearTrackLaneContent(selectedTrackIndex)}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: (grooveLeadEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d7566' : '#333340',
          background: (grooveLeadEligibleTrack?.notes.length ?? 0) > 0 ? '#2a1418' : '#16161e',
          color: (grooveLeadEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d75' : '#6a6a78',
        }}
        title="Clear all lead MIDI notes — keep this Groove Lead track and patch"
      >
        Clear notes
      </button>
    </div>
  ) : undefined;

  const lab808Toolbar = showLab808Ui ? (
    <div className="pr-toolbar-row">
      <button
        type="button"
        disabled={running}
        aria-pressed={lab808PanelOpen}
        onClick={() => {
          openPianoRollEditor();
          setLab808PanelOpen((v) => !v);
        }}
        className="pr-toolbar-chip se2-type-micro flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[8px] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: lab808PanelOpen ? `${lab808EligibleTrack?.colorHex ?? '#E8784A'}88` : '#333340',
          background: lab808PanelOpen ? `${lab808EligibleTrack?.colorHex ?? '#E8784A'}22` : '#16161e',
          color: lab808PanelOpen ? (lab808EligibleTrack?.colorHex ?? '#E8784A') : '#a8a8b8',
        }}
        title="808 Lab — trap kick & bass synth (standalone SE2 lane)"
      >
        <span>808 Lab</span>
      </button>
      <StudioEditor2HelpTip tab="lab808" title="808 Lab lane — trap kick & bass synth" />
      <button
        type="button"
        disabled={running || !midiHasNoteSel}
        onClick={() => midiDeleteSelection()}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: midiHasNoteSel ? '#e85d7566' : '#333340',
          background: midiHasNoteSel ? '#2a1418' : '#16161e',
          color: midiHasNoteSel ? '#e85d75' : '#6a6a78',
        }}
      >
        Delete
      </button>
      <button
        type="button"
        disabled={running || !(lab808EligibleTrack?.notes.length ?? 0)}
        onClick={() => clearTrackLaneContent(selectedTrackIndex)}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: (lab808EligibleTrack?.notes.length ?? 0) > 0 ? '#e85d7566' : '#333340',
          background: (lab808EligibleTrack?.notes.length ?? 0) > 0 ? '#2a1418' : '#16161e',
          color: (lab808EligibleTrack?.notes.length ?? 0) > 0 ? '#e85d75' : '#6a6a78',
        }}
        title="Clear all 808 MIDI notes — keep this 808 Lab track and patch"
      >
        Clear notes
      </button>
    </div>
  ) : undefined;

  const genoUltraSynthToolbar = showGenoUltraSynthUi ? (
    <div className="pr-toolbar-row">
      <button
        type="button"
        disabled={running}
        aria-pressed={genoUltraSynthPanelOpen}
        onClick={() => {
          openPianoRollEditor();
          setGenoUltraSynthPanelOpen((v) => !v);
        }}
        className="pr-toolbar-chip se2-type-micro flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[8px] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: genoUltraSynthPanelOpen ? `${genoUltraEligibleTrack?.colorHex ?? SE2_GENO_ULTRA_SYNTH_ACCENT}88` : '#333340',
          background: genoUltraSynthPanelOpen ? `${genoUltraEligibleTrack?.colorHex ?? SE2_GENO_ULTRA_SYNTH_ACCENT}22` : '#16161e',
          color: genoUltraSynthPanelOpen ? (genoUltraEligibleTrack?.colorHex ?? SE2_GENO_ULTRA_SYNTH_ACCENT) : '#a8a8b8',
        }}
        title="Geno Ultra Synth — Grid-style subtractive instrument"
      >
        <span>Geno Ultra</span>
      </button>
      <StudioEditor2HelpTip tab="genoUltraSynth" title="Geno Ultra Synth — Grid-style instrument lane" />
      <button
        type="button"
        disabled={running || !midiHasNoteSel}
        onClick={() => midiDeleteSelection()}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: midiHasNoteSel ? '#e85d7566' : '#333340',
          background: midiHasNoteSel ? '#2a1418' : '#16161e',
          color: midiHasNoteSel ? '#e85d75' : '#6a6a78',
        }}
      >
        Delete
      </button>
      <button
        type="button"
        disabled={running || !(genoUltraEligibleTrack?.notes.length ?? 0)}
        onClick={() => clearTrackLaneContent(selectedTrackIndex)}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: (genoUltraEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d7566' : '#333340',
          background: (genoUltraEligibleTrack?.notes.length ?? 0) > 0 ? '#2a1418' : '#16161e',
          color: (genoUltraEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d75' : '#6a6a78',
        }}
        title="Clear all MIDI notes — keep this Geno Ultra patch"
      >
        Clear notes
      </button>
    </div>
  ) : undefined;

  const genoBassSynthToolbar = showGenoBassSynthUi ? (
    <div className="pr-toolbar-row">
      <button
        type="button"
        disabled={running}
        aria-pressed={genoBassSynthPanelOpen}
        onClick={() => {
          setPianoRollExpanded(false);
          openPianoRollEditor();
          setGenoBassSynthPanelOpen((v) => !v);
        }}
        className="pr-toolbar-chip se2-type-micro flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[8px] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: genoBassSynthPanelOpen ? `${genoBassEligibleTrack?.colorHex ?? SE2_GENO_BASS_SYNTH_ACCENT}88` : '#333340',
          background: genoBassSynthPanelOpen ? `${genoBassEligibleTrack?.colorHex ?? SE2_GENO_BASS_SYNTH_ACCENT}22` : '#1a1510',
          color: genoBassSynthPanelOpen ? (genoBassEligibleTrack?.colorHex ?? SE2_GENO_BASS_SYNTH_ACCENT) : '#c9b890',
        }}
        title="Geno Bass Synth — classic Mooga / Retro Box / FM bass"
      >
        <span>Geno Bass</span>
      </button>
      <StudioEditor2HelpTip tab="genoBassSynth" title="Geno Bass Synth — classic synth bass lane" />
      <button
        type="button"
        disabled={running || !midiHasNoteSel}
        onClick={() => midiDeleteSelection()}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: midiHasNoteSel ? '#e85d7566' : '#333340',
          background: midiHasNoteSel ? '#2a1418' : '#16161e',
          color: midiHasNoteSel ? '#e85d75' : '#6a6a78',
        }}
      >
        Delete
      </button>
      <button
        type="button"
        disabled={running || !(genoBassEligibleTrack?.notes.length ?? 0)}
        onClick={() => clearTrackLaneContent(selectedTrackIndex)}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: (genoBassEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d7566' : '#333340',
          background: (genoBassEligibleTrack?.notes.length ?? 0) > 0 ? '#2a1418' : '#16161e',
          color: (genoBassEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d75' : '#6a6a78',
        }}
        title="Clear all bass MIDI notes — keep this Geno Bass patch"
      >
        Clear notes
      </button>
    </div>
  ) : undefined;

  const humCaptureToolbar = showHumCaptureUi ? (
    <div className="pr-toolbar-row">
      <button
        type="button"
        disabled={running}
        aria-pressed={humCapturePanelOpen}
        onClick={() => {
          openPianoRollEditor();
          setHumCapturePanelOpen((v) => !v);
        }}
        className="pr-toolbar-chip se2-type-micro flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[8px] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: humCapturePanelOpen ? `${humCaptureEligibleTrack?.colorHex ?? '#00E5FF'}88` : '#333340',
          background: humCapturePanelOpen ? `${humCaptureEligibleTrack?.colorHex ?? '#00E5FF'}22` : '#16161e',
          color: humCapturePanelOpen ? (humCaptureEligibleTrack?.colorHex ?? '#00E5FF') : '#a8a8b8',
        }}
        title="Hum / Melody Capture — humming, singing, whistling, or a single instrument line → MIDI (pitch, timing, loudness, bends)"
      >
        <span>Hum / Melody</span>
      </button>
      <StudioEditor2HelpTip
        tab="humCapture"
        title="Hum / Melody Capture — humming, singing, whistling, or a single instrument line → MIDI (pitch, timing, loudness, bends)"
      />
      <button
        type="button"
        disabled={running || !midiHasNoteSel}
        onClick={() => midiDeleteSelection()}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: midiHasNoteSel ? '#e85d7566' : '#333340',
          background: midiHasNoteSel ? '#2a1418' : '#16161e',
          color: midiHasNoteSel ? '#e85d75' : '#6a6a78',
        }}
      >
        Delete
      </button>
      <button
        type="button"
        disabled={running || !(humCaptureEligibleTrack?.notes.length ?? 0)}
        onClick={() => clearTrackLaneContent(selectedTrackIndex)}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: (humCaptureEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d7566' : '#333340',
          background: (humCaptureEligibleTrack?.notes.length ?? 0) > 0 ? '#2a1418' : '#16161e',
          color: (humCaptureEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d75' : '#6a6a78',
        }}
        title="Clear melody MIDI — keep this Hum / Melody Capture lane and instrument"
      >
        Clear notes
      </button>
    </div>
  ) : undefined;

  const guitarToolbar = showGuitarUi ? (
    <div className="pr-toolbar-row">
      <button
        type="button"
        disabled={running}
        aria-pressed={guitarPanelOpen}
        onClick={() => {
          openPianoRollEditor();
          setGuitarPanelOpen((v) => !v);
        }}
        className="pr-toolbar-chip se2-type-micro flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[8px] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: guitarPanelOpen ? `${guitarEligibleTrack?.colorHex ?? SE2_GUITAR_ACCENT}88` : '#333340',
          background: guitarPanelOpen ? `${guitarEligibleTrack?.colorHex ?? SE2_GUITAR_ACCENT}22` : '#16161e',
          color: guitarPanelOpen ? (guitarEligibleTrack?.colorHex ?? SE2_GUITAR_ACCENT) : '#a8a8b8',
        }}
        title="Guitar — sampled tones and licks on the MIDI roll"
      >
        <span>Guitar</span>
      </button>
      <StudioEditor2HelpTip tab="guitar" title="Guitar lane — open-source sampled guitars via smplr" />
      <button
        type="button"
        disabled={running || !midiHasNoteSel}
        onClick={() => midiDeleteSelection()}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: midiHasNoteSel ? '#e85d7566' : '#333340',
          background: midiHasNoteSel ? '#2a1418' : '#16161e',
          color: midiHasNoteSel ? '#e85d75' : '#6a6a78',
        }}
      >
        Delete
      </button>
      <button
        type="button"
        disabled={running || !(guitarEligibleTrack?.notes.length ?? 0)}
        onClick={() => clearTrackLaneContent(selectedTrackIndex)}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: (guitarEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d7566' : '#333340',
          background: (guitarEligibleTrack?.notes.length ?? 0) > 0 ? '#2a1418' : '#16161e',
          color: (guitarEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d75' : '#6a6a78',
        }}
        title="Clear guitar MIDI — keep this lane and tone"
      >
        Clear notes
      </button>
    </div>
  ) : undefined;

  const chordGenieToolbar = showGenoChordCreatorUi ? (
    <div className="pr-toolbar-row">
      <button
        type="button"
        disabled={running}
        aria-pressed={chordGeniePanelOpen}
        onClick={() => {
          openPianoRollEditor();
          setChordGeniePanelOpen((v) => !v);
        }}
        className="pr-toolbar-chip se2-type-micro flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[8px] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: chordGeniePanelOpen ? `${chordGenieEligibleTrack?.colorHex ?? SE2_GENO_CHORD_CREATOR_ACCENT}88` : '#333340',
          background: chordGeniePanelOpen ? `${chordGenieEligibleTrack?.colorHex ?? SE2_GENO_CHORD_CREATOR_ACCENT}22` : '#16161e',
          color: chordGeniePanelOpen ? (chordGenieEligibleTrack?.colorHex ?? SE2_GENO_CHORD_CREATOR_ACCENT) : '#a8a8b8',
        }}
        title={`${SE2_CHORD_GENERATOR_LABEL} — 4/8 chord sketch, export when ready`}
      >
        <span>{SE2_CHORD_GENERATOR_LABEL}</span>
      </button>
      <button
        type="button"
        disabled={running || !(chordGenieEligibleTrack?.notes.length ?? 0)}
        onClick={() => clearTrackLaneContent(selectedTrackIndex)}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: (chordGenieEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d7566' : '#333340',
          background: (chordGenieEligibleTrack?.notes.length ?? 0) > 0 ? '#2a1418' : '#16161e',
          color: (chordGenieEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d75' : '#6a6a78',
        }}
        title="Clear exported MIDI on this lane — chord draft stays in the generator"
      >
        Clear roll
      </button>
    </div>
  ) : undefined;

  const drumGeneratorToolbar = showDrumGeneratorUi ? (
    <div className="pr-toolbar-row">
      <button
        type="button"
        disabled={running}
        aria-pressed={drumGeneratorPanelOpen}
        onClick={() => {
          openPianoRollEditor();
          setDrumGeneratorPanelOpen((v) => !v);
        }}
        className="pr-toolbar-chip se2-type-micro flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[8px] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: drumGeneratorPanelOpen ? `${drumGeneratorEligibleTrack?.colorHex ?? '#FFB84D'}88` : '#333340',
          background: drumGeneratorPanelOpen ? `${drumGeneratorEligibleTrack?.colorHex ?? '#FFB84D'}22` : '#16161e',
          color: drumGeneratorPanelOpen ? (drumGeneratorEligibleTrack?.colorHex ?? '#FFB84D') : '#a8a8b8',
        }}
        title="Drum Generator — grooves that match your chords and bass"
      >
        <span>Drum Generator</span>
      </button>
      <StudioEditor2HelpTip tab="drumGenerator" title="Drum Generator lane — style-matched grooves" />
      <button
        type="button"
        disabled={running || !midiHasNoteSel}
        onClick={() => midiDeleteSelection()}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: midiHasNoteSel ? '#e85d7566' : '#333340',
          background: midiHasNoteSel ? '#2a1418' : '#16161e',
          color: midiHasNoteSel ? '#e85d75' : '#6a6a78',
        }}
      >
        Delete
      </button>
      <button
        type="button"
        disabled={running || !(drumGeneratorEligibleTrack?.notes.length ?? 0)}
        onClick={() => clearTrackLaneContent(selectedTrackIndex)}
        className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: (drumGeneratorEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d7566' : '#333340',
          background: (drumGeneratorEligibleTrack?.notes.length ?? 0) > 0 ? '#2a1418' : '#16161e',
          color: (drumGeneratorEligibleTrack?.notes.length ?? 0) > 0 ? '#e85d75' : '#6a6a78',
        }}
        title="Clear drum MIDI — keep this Drum Generator lane"
      >
        Clear notes
      </button>
    </div>
  ) : undefined;

  const defaultLaneToolbar =
    !showRhythmUi && !showHarmonyUi && !showGlideBassUi && !showSynthGenoUi && !showGrooveLeadUi && !showGenoUltraSynthUi && !showGenoBassSynthUi && !showHumCaptureUi && !showGuitarUi && !showGenoChordCreatorUi && !showDrumGeneratorUi && canClearLaneContent ? (
      <div className="pr-toolbar-row">
        <button
          type="button"
          disabled={running || !midiHasNoteSel}
          onClick={() => midiDeleteSelection()}
          className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: midiHasNoteSel ? '#e85d7566' : '#333340',
            background: midiHasNoteSel ? '#2a1418' : '#16161e',
            color: midiHasNoteSel ? '#e85d75' : '#6a6a78',
          }}
        >
          Delete
        </button>
        <button
          type="button"
          disabled={running}
          onClick={() => clearTrackLaneContent(selectedTrackIndex)}
          className="pr-toolbar-chip rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: '#e85d7566',
            background: '#2a1418',
            color: '#e85d75',
          }}
          title="Clear all notes/clips on this lane — keep the track"
        >
          Clear lane
        </button>
      </div>
    ) : undefined;

  const pianoRollHarmonyToolbar = showRhythmUi
    ? rhythmToolbar
    : showGlideBassUi
      ? glideBassToolbar
      : showSynthGenoUi
        ? synthGenoToolbar
        : showGrooveLeadUi
          ? grooveLeadToolbar
          : showLab808Ui
            ? lab808Toolbar
          : showGenoUltraSynthUi
            ? genoUltraSynthToolbar
          : showGenoBassSynthUi
            ? genoBassSynthToolbar
          : showHumCaptureUi
            ? humCaptureToolbar
          : showGuitarUi
            ? guitarToolbar
          : showGenoChordCreatorUi
            ? chordGenieToolbar
          : showDrumGeneratorUi
            ? drumGeneratorToolbar
            : showHarmonyUi
            ? harmonyToolbar
            : defaultLaneToolbar;
  const pianoRollRhythmEditPanel = showRhythmUi ? rhythmEditPanel : undefined;

  const glideBassEditPanel =
    showGlideBassUi && glideBassEligibleTrack && glideBassPanelOpen ? (
      <Se2GlideBassDockedPanel
        trackName={se2TrackNumberedName(
          glideBassEligibleTrack.laneNumber,
          glideBassEligibleTrack.name,
          studioLanePad,
        )}
        accentHex={glideBassEligibleTrack.colorHex}
        onClose={() => setGlideBassPanelOpen(false)}
      >
        <Se2GlideBassPanel
          trackIndex={selectedTrackIndex}
          track={glideBassEligibleTrack}
          tracks={studioTracks}
          voice={
            se2GlideBassVoices[selectedTrackIndex] ??
            se2GlideBassVoiceFromTrack(glideBassEligibleTrack, undefined)
          }
          presetId={se2NormalizeGlideBassPresetId(glideBassEligibleTrack.glideBassPresetId)}
          bpm={bpm}
          beatsPerBar={beatsPerBar}
          subdiv={pianoSnapSubdivisions}
          patternCols={Math.max(
            16,
            Math.round(totalBeatsForSig(beatsPerBar) * normalizePianoSnapSubdiv(pianoSnapSubdivisions)),
          )}
          songKeyRoot={songKeyRoot}
          songKeyMode={songKeyMode}
          disabled={running}
          onHarmonyTrackIdChange={(id) => updateGlideBassHarmonyTrackId(selectedTrackIndex, id)}
          onPresetChange={(id) => loadSe2GlideBassPresetToVoice(selectedTrackIndex, id)}
          onLoadPresetToVoice={(id) => loadSe2GlideBassPresetToVoice(selectedTrackIndex, id)}
          onPatchVoice={(patch) => patchSe2GlideBassVoice(selectedTrackIndex, patch)}
          onApplyBassNotes={(notes) => applyGlideBassTrackNotes(selectedTrackIndex, notes)}
          onPreview={() => previewGlideBassLane(selectedTrackIndex)}
          onPreviewMidi={(midi) => previewGlideBassLane(selectedTrackIndex, midi)}
          onAuditionStart={() => startGlideBassAudition(selectedTrackIndex)}
          onAuditionStop={() => stopGlideBassAudition(selectedTrackIndex)}
          onAuditionTouch={() => touchGlideBassAudition(selectedTrackIndex)}
        />
      </Se2GlideBassDockedPanel>
    ) : undefined;

  const synthGenoEditPanel =
    showSynthGenoUi && synthGenoEligibleTrack && synthGenoPanelOpen ? (
      <Se2SynthGenoDockedPanel
        trackName={se2TrackNumberedName(
          synthGenoEligibleTrack.laneNumber,
          synthGenoEligibleTrack.name,
          studioLanePad,
        )}
        accentHex={synthGenoEligibleTrack.colorHex}
        onClose={() => {
          stopSynthGenoPluginPreview();
          setSynthGenoBuildFullscreenOpen(false);
          setSynthGenoPanelOpen(false);
        }}
      >
        <Se2SynthGenoPanel
          trackIndex={selectedTrackIndex}
          trackName={synthGenoEligibleTrack.name}
          accentHex={synthGenoEligibleTrack.colorHex}
          onBuildFullscreenChange={setSynthGenoBuildFullscreenOpen}
          prompt={synthGenoEligibleTrack.synthGenoPrompt ?? ''}
          composePrompt={
            synthGenoEligibleTrack.synthGenoComposePrompt ?? 'pop chord progression 8 bars'
          }
          notes={synthGenoEligibleTrack.notes}
          bpm={bpm}
          beatsPerBar={beatsPerBar}
          loopBars={loopBars}
          songKeyRoot={songKeyRoot}
          songKeyMode={songKeyMode}
          trackKeyRoot={synthGenoEligibleTrack.trackKeyRoot}
          trackKeyMode={synthGenoEligibleTrack.trackKeyMode}
          voice={
            se2SynthGenoVoices[selectedTrackIndex] ??
            se2SynthGenoVoiceFromTrack(synthGenoEligibleTrack, undefined)
          }
          disabled={running}
          onPromptChange={(p) =>
            updateSynthGenoTrackMeta(selectedTrackIndex, p, synthGenoEligibleTrack.synthGenoPatchLabel ?? '')
          }
          onComposePromptChange={(p) => updateSynthGenoComposePrompt(selectedTrackIndex, p)}
          onVoiceChange={(voice, promptUsed) => applySynthGenoVoice(selectedTrackIndex, voice, promptUsed)}
          onApplyNotes={(notes, key) => applySynthGenoComposeNotes(selectedTrackIndex, notes, key)}
          onApplyStack={(stack, bars, meta) =>
            applySynthGenoFullStack(selectedTrackIndex, stack, bars, meta)
          }
          onApplyPluginAudio={(draft, sounds, previewOpts) =>
            void applySynthGenoPluginDraftToAudioTrack(
              selectedTrackIndex,
              draft,
              sounds,
              previewOpts,
            )
          }
          onPreview={() => void previewSynthGenoLane(selectedTrackIndex)}
          onPreviewPluginDraft={(draft, sounds, previewOpts) =>
            void previewSynthGenoPluginDraft(selectedTrackIndex, draft, sounds, previewOpts)
          }
          onStopPluginPreview={stopSynthGenoPluginPreview}
          onPlayLiveChord={(tones, accordBankId, opts) =>
            void previewSynthGenoLiveChord(selectedTrackIndex, tones, accordBankId, opts)
          }
          onLockGrooveLead={(input) => lockGrooveLeadToSynthGeno(selectedTrackIndex, input)}
          getAudioContext={() => {
            const c = ctxRef.current;
            if (!c || c.state === 'closed') {
              void ensureCtx();
            }
            return ctxRef.current!;
          }}
          getGrooveLeadPreviewDestination={getGrooveLeadPreviewDestination(selectedTrackIndex)}
        />
      </Se2SynthGenoDockedPanel>
    ) : undefined;

  const grooveLeadEditPanel =
    showGrooveLeadUi && grooveLeadEligibleTrack && grooveLeadPanelOpen ? (
      <Se2GrooveLeadDockedPanel
        trackName={se2TrackNumberedName(
          grooveLeadEligibleTrack.laneNumber,
          grooveLeadEligibleTrack.name,
          studioLanePad,
        )}
        accentHex={grooveLeadEligibleTrack.colorHex}
        onClose={() => setGrooveLeadPanelOpen(false)}
      >
        <Se2GrooveLeadPanel
          trackIndex={selectedTrackIndex}
          track={grooveLeadEligibleTrack}
          tracks={studioTracks}
          voice={
            se2GrooveLeadVoices[selectedTrackIndex] ??
            se2GrooveLeadVoiceFromTrack(grooveLeadEligibleTrack, undefined)
          }
          notes={grooveLeadEligibleTrack.notes}
          bpm={bpm}
          beatsPerBar={beatsPerBar}
          loopBars={loopBars}
          songKeyRoot={songKeyRoot}
          songKeyMode={songKeyMode}
          disabled={running}
          getAudioContext={() => {
            const c = ctxRef.current;
            if (!c || c.state === 'closed') {
              void ensureCtx();
            }
            return ctxRef.current!;
          }}
          getPreviewDestination={getGrooveLeadPreviewDestination(selectedTrackIndex)}
          onVoiceChange={(voice) => applyGrooveLeadVoice(selectedTrackIndex, voice)}
          onHarmonyTrackIdChange={(id) => updateGrooveLeadHarmonyTrackId(selectedTrackIndex, id)}
          onApplyNotes={(notes) => applyGrooveLeadTrackNotes(selectedTrackIndex, notes)}
          onDetectTrackKey={() => detectTrackKey(selectedTrackIndex)}
          onConvertTrackToSongKey={() => convertTrackToSongKey(selectedTrackIndex)}
        />
      </Se2GrooveLeadDockedPanel>
    ) : undefined;

  const lab808EditPanel =
    showLab808Ui && lab808EligibleTrack && lab808PanelOpen ? (
      <Se2Lab808DockedPanel
        trackName={se2TrackNumberedName(
          lab808EligibleTrack.laneNumber,
          lab808EligibleTrack.name,
          studioLanePad,
        )}
        accentHex={lab808EligibleTrack.colorHex}
        onClose={() => setLab808PanelOpen(false)}
      >
        <Se2Lab808Panel
          track={lab808EligibleTrack}
          voice={
            se2Lab808Voices[selectedTrackIndex] ?? se2Lab808VoiceFromTrack(lab808EligibleTrack, undefined)
          }
          bpm={bpm}
          disabled={running}
          songKeyRoot={songKeyRoot}
          songKeyMode={songKeyMode}
          studioTracks={studioTracks}
          lanePad={studioLanePad}
          getAudioContext={() => {
            const c = ctxRef.current;
            if (!c || c.state === 'closed') {
              void ensureCtx();
            }
            return ctxRef.current!;
          }}
          getPreviewDestination={getLab808PreviewDestination(selectedTrackIndex)}
          onVoiceChange={(voice) => applyLab808Voice(selectedTrackIndex, voice)}
          onExportToneGridToPianoRoll={(notes) =>
            exportLab808ToneGridToPianoRoll(selectedTrackIndex, notes)
          }
          onExportToneGridWavToTrack={(args) =>
            exportBeatPadsToAudioTrack(selectedTrackIndex, args)
          }
        />
      </Se2Lab808DockedPanel>
    ) : undefined;

  const genoUltraSynthEditPanel =
    showGenoUltraSynthUi && genoUltraEligibleTrack && genoUltraSynthPanelOpen ? (
      <Se2GenoUltraSynthDockedPanel
        trackName={se2TrackNumberedName(
          genoUltraEligibleTrack.laneNumber,
          genoUltraEligibleTrack.name,
          studioLanePad,
        )}
        accentHex={genoUltraEligibleTrack.colorHex}
        onClose={() => setGenoUltraSynthPanelOpen(false)}
      >
        <Se2GenoUltraSynthPanel
          accentHex={genoUltraEligibleTrack.colorHex}
          disabled={running}
          songKeyRoot={songKeyRoot}
          songKeyMode={songKeyMode}
          voice={
            se2GenoUltraSynthVoices[selectedTrackIndex] ??
            se2GenoUltraVoiceFromTrack(genoUltraEligibleTrack, undefined)
          }
          presetId={genoUltraEligibleTrack.genoUltraPresetId ?? GENO_ULTRA_DEFAULT_PRESET_ID}
          bpm={bpm}
          arpTrackId={genoUltraEligibleTrack.id}
          arpBpm={
            typeof genoUltraEligibleTrack.genoUltraArpBpm === 'number'
              ? genoUltraEligibleTrack.genoUltraArpBpm
              : undefined
          }
          onArpBpmChange={(nextBpm) =>
            setStudioTracks((prev) =>
              prev.map((t, i) =>
                i === selectedTrackIndex && studioTrackIsGenoUltraSynthChannel(t)
                  ? { ...t, genoUltraArpBpm: nextBpm }
                  : t,
              ),
            )
          }
          getAudioContext={() => ctxRef.current}
          ensureAudioContext={ensureCtx}
          getStripOutput={getGenoUltraSynthPreviewDestination(selectedTrackIndex)}
          onVoiceChange={(voice) => applyGenoUltraSynthVoice(selectedTrackIndex, voice)}
          onPresetIdChange={(id) =>
            setStudioTracks((prev) =>
              prev.map((t, i) =>
                i === selectedTrackIndex && studioTrackIsGenoUltraSynthChannel(t)
                  ? { ...t, genoUltraPresetId: id }
                  : t,
              ),
            )
          }
          onPatchLabelChange={(label) =>
            setStudioTracks((prev) =>
              prev.map((t, i) =>
                i === selectedTrackIndex && studioTrackIsGenoUltraSynthChannel(t)
                  ? { ...t, genoUltraPatchLabel: label }
                  : t,
              ),
            )
          }
          onApplyArpToPianoRoll={(notes) => {
            applyGenoUltraSynthTrackNotes(selectedTrackIndex, notes);
            clearSelectedPianoNotes();
            openPianoRollEditor({ expanded: true });
          }}
          genoBuildSources={genoUltraGenoBuildSources}
          genoBuildImportTracks={genoBuildImportTracksForUltra}
          beatsPerBar={beatsPerBar}
          se2SyncLocked={genoUltraEligibleTrack.genoUltraArpSyncLocked ?? false}
          se2TransportPlaying={running}
          onSe2SyncToggle={() => toggleGenoUltraArpSyncLocked(selectedTrackIndex)}
          getSe2PlayheadBeat={() => displayBeatRef.current}
          getSe2TransportOriginBeat={() => originBeatRef.current}
          keySourceTracks={genoUltraKeySourceTracks}
          keySourceTrackIndex={genoUltraKeySourceTrackIndex}
          onKeySourceTrackIndexChange={onGenoUltraKeySourceTrackIndexChange}
          onDetectKeyFromSourceTrack={detectGenoUltraKeyFromSourceTrack}
          getSe2TrackChordImport={getGenoUltraSe2TrackChordImport}
          followSourceTrackChords
        />
      </Se2GenoUltraSynthDockedPanel>
    ) : undefined;

  const genoBassSynthEditPanel =
    showGenoBassSynthUi && genoBassEligibleTrack && genoBassSynthPanelOpen ? (
      <Se2GenoBassSynthDockedPanel
        trackName={se2TrackNumberedName(
          genoBassEligibleTrack.laneNumber,
          genoBassEligibleTrack.name,
          studioLanePad,
        )}
        accentHex={genoBassEligibleTrack.colorHex}
        onClose={() => setGenoBassSynthPanelOpen(false)}
      >
        <Suspense
          fallback={
            <div
              className="flex min-h-[120px] items-center justify-center text-[10px] font-bold uppercase tracking-wide text-[#c9a86a]/80"
              aria-busy
            >
              Loading Geno Bass…
            </div>
          }
        >
          <Se2GenoBassSynthPanelLazy
          accentHex={genoBassEligibleTrack.colorHex}
          disabled={running}
          voice={
            se2GenoBassSynthVoices[selectedTrackIndex] ??
            se2GenoBassVoiceFromTrack(genoBassEligibleTrack, undefined)
          }
          presetId={genoBassEligibleTrack.genoBassPresetId ?? GENO_BASS_DEFAULT_PRESET_ID}
          bpm={bpm}
          beatsPerBar={beatsPerBar}
          songKeyRoot={songKeyRoot}
          songKeyMode={songKeyMode}
          ensureAudioContext={ensureCtx}
          getStripOutput={getGenoUltraSynthPreviewDestination(selectedTrackIndex)}
          onVoiceChange={(voice) => applyGenoBassSynthVoice(selectedTrackIndex, voice)}
          onPresetIdChange={(id) =>
            setStudioTracks((prev) =>
              prev.map((t, i) =>
                i === selectedTrackIndex && studioTrackIsGenoBassSynthChannel(t)
                  ? { ...t, genoBassPresetId: id }
                  : t,
              ),
            )
          }
          onPatchLabelChange={(label) =>
            setStudioTracks((prev) =>
              prev.map((t, i) =>
                i === selectedTrackIndex && studioTrackIsGenoBassSynthChannel(t)
                  ? { ...t, genoBassPatchLabel: label }
                  : t,
              ),
            )
          }
          onApplyLoopToPianoRoll={(notes) => {
            applyGenoBassSynthTrackNotes(selectedTrackIndex, notes);
            clearSelectedPianoNotes();
            openPianoRollEditor({ expanded: true });
          }}
          se2TransportPlaying={running}
          getSe2PlayheadBeat={() => displayBeatRef.current}
          getSe2TransportOriginBeat={() => originBeatRef.current}
          keySourceTracks={genoUltraKeySourceTracks}
          keySourceTrackIndex={genoBassKeySourceTrackIndex}
          onKeySourceTrackIndexChange={onGenoBassKeySourceTrackIndexChange}
          onDetectKeyFromSourceTrack={detectGenoUltraKeyFromSourceTrack}
          getSe2TrackChordImport={getGenoUltraSe2TrackChordImport}
          getSe2TrackMidiImport={getGenoBassSe2TrackMidiImport}
          followSourceTrackChords
          onPresetBpmChange={(next) => setBpm(Math.max(40, Math.min(240, Math.round(next))))}
        />
        </Suspense>
      </Se2GenoBassSynthDockedPanel>
    ) : undefined;

  const humCaptureEditPanel =
    showHumCaptureUi && humCaptureEligibleTrack
      ? humCapturePanelOpen
        ? (
          <Se2HumCaptureDockedPanel
            trackName={se2TrackNumberedName(
              humCaptureEligibleTrack.laneNumber,
              humCaptureEligibleTrack.name,
              studioLanePad,
            )}
            accentHex={humCaptureEligibleTrack.colorHex}
            onClose={() => setHumCapturePanelOpen(false)}
          >
            <Se2HumCapturePanel
              trackIndex={selectedTrackIndex}
              track={humCaptureEligibleTrack}
              tracks={studioTracks}
              notes={humCaptureEligibleTrack.notes}
              bpm={bpm}
              beatsPerBar={beatsPerBar}
              songKeyRoot={songKeyRoot}
              songKeyMode={songKeyMode}
              disabled={running}
              lanePad={studioLanePad}
              getAudioContext={() => {
                const c = ctxRef.current;
                if (!c || c.state === 'closed') {
                  void ensureCtx();
                }
                return ctxRef.current!;
              }}
              getPreviewDestination={getHumCapturePreviewDestination(selectedTrackIndex)}
              onHarmonyTrackIdChange={(id) => updateHumCaptureHarmonyTrackId(selectedTrackIndex, id)}
              onRollBarsChange={(bars) => updateHumCaptureRollBars(selectedTrackIndex, bars)}
              onInstrumentIdChange={(id) => updateHumCaptureInstrumentId(selectedTrackIndex, id)}
              onApplyNotes={(notes) => applyHumCaptureTrackNotes(selectedTrackIndex, notes)}
            />
          </Se2HumCaptureDockedPanel>
        )
        : (
          <Se2HumCaptureCollapsedStrip
            trackName={se2TrackNumberedName(
              humCaptureEligibleTrack.laneNumber,
              humCaptureEligibleTrack.name,
              studioLanePad,
            )}
            accentHex={humCaptureEligibleTrack.colorHex}
            onExpand={() => setHumCapturePanelOpen(true)}
          />
        )
      : undefined;

  const guitarEditPanel =
    showGuitarUi && guitarEligibleTrack && guitarPanelOpen ? (
      <Se2GuitarDockedPanel
        layout={guitarFocusActive ? 'focus' : 'docked'}
        trackName={se2TrackNumberedName(
          guitarEligibleTrack.laneNumber,
          guitarEligibleTrack.name,
          studioLanePad,
        )}
        accentHex={guitarEligibleTrack.colorHex}
        onClose={() => setGuitarPanelOpen(false)}
      >
        <Se2GuitarPanel
          track={guitarEligibleTrack as import('@/app/lib/studio/se2GuitarTrack').Se2GuitarTrack}
          notes={guitarEligibleTrack.notes}
          beatsPerBar={beatsPerBar}
          bpm={bpm}
          getPlayheadBeat={() => cursorBeatRef.current}
          disabled={false}
          insertDisabled={running}
          getAudioContext={() => {
            const c = ctxRef.current;
            if (c && c.state !== 'closed') return c;
            void ensureCtx();
            return ctxRef.current as AudioContext;
          }}
          getPreviewDestination={(ctx) => {
            const strip = getHumCapturePreviewDestination(selectedTrackIndex)(ctx);
            return resolveSe2GuitarAudioForTrack(ctx, selectedTrackIndex, strip, guitarEligibleTrack);
          }}
          onInstrumentIdChange={(id) => updateGuitarInstrumentId(selectedTrackIndex, id)}
          onTransposeChange={(semi) => updateGuitarTranspose(selectedTrackIndex, semi)}
          onApplyNotes={(notes) => applyGuitarTrackNotes(selectedTrackIndex, notes)}
          onFxChange={(patch) => updateGuitarFx(selectedTrackIndex, patch)}
        />
      </Se2GuitarDockedPanel>
    ) : undefined;

  const drumGeneratorEditPanel =
    showDrumGeneratorUi && drumGeneratorEligibleTrack
      ? drumGeneratorPanelOpen
        ? (
          <Se2DrumGeneratorDockedPanel
            trackName={se2TrackNumberedName(
              drumGeneratorEligibleTrack.laneNumber,
              drumGeneratorEligibleTrack.name,
              studioLanePad,
            )}
            accentHex={drumGeneratorEligibleTrack.colorHex}
            onClose={() => setDrumGeneratorPanelOpen(false)}
          >
            <Se2DrumGeneratorPanel
              trackIndex={selectedTrackIndex}
              track={drumGeneratorEligibleTrack}
              tracks={studioTracks}
              bpm={bpm}
              beatsPerBar={beatsPerBar}
              loopBars={loopBars}
              disabled={running}
              onStyleChange={(style) => updateDrumGenStyle(selectedTrackIndex, style)}
              onHarmonyTrackIdChange={(id) => updateDrumGenHarmonyTrackId(selectedTrackIndex, id)}
              onGenoBuildSlotChange={(slot) => updateDrumGenGenoBuildSlot(selectedTrackIndex, slot)}
              onGenerateFromMatchCards={() => void generateDrumGenFromMatchCards(selectedTrackIndex, true)}
              onTemperatureChange={(temp) => updateDrumGenTemperature(selectedTrackIndex, temp)}
              onSelectPianoRollPreset={(preset) => void loadDrumPatternOnTrack(selectedTrackIndex, preset)}
              onSelectBeatLabPreset={(preset) => void loadBeatLabPatternOnTrack(selectedTrackIndex, preset)}
              onApplyGenerated={(load, nextSeed) => void applyDrumGeneratorLoad(selectedTrackIndex, load, nextSeed)}
              onSetPadOverride={(pad, override) => updateDrumPadOverride(selectedTrackIndex, pad, override)}
              onResetAllPadOverrides={() => resetDrumPadOverrides(selectedTrackIndex)}
              onAuditionOverride={(override) => void auditionDrumPadOverride(selectedTrackIndex, override)}
              onPreviewAssignedPad={(pad) => void previewDrumGeneratorPad(selectedTrackIndex, pad)}
            />
          </Se2DrumGeneratorDockedPanel>
        )
        : (
          <Se2DrumGeneratorCollapsedStrip
            trackName={se2TrackNumberedName(
              drumGeneratorEligibleTrack.laneNumber,
              drumGeneratorEligibleTrack.name,
              studioLanePad,
            )}
            accentHex={drumGeneratorEligibleTrack.colorHex}
            onExpand={() => setDrumGeneratorPanelOpen(true)}
          />
        )
      : undefined;

  const chordGenieEditPanel =
    showGenoChordCreatorUi && chordGenieEligibleTrack
      ? chordGeniePanelOpen
        ? (
          <Se2ChordGenieDockedPanel
            trackName={se2TrackNumberedName(
              chordGenieEligibleTrack.laneNumber,
              chordGenieEligibleTrack.name,
              studioLanePad,
            )}
            accentHex={chordGenieEligibleTrack.colorHex}
            onClose={() => setChordGeniePanelOpen(false)}
          >
            <Se2GenoChordCreatorPanel
              track={chordGenieEligibleTrack as Se2GenoChordCreatorTrack}
              bpm={bpm}
              beatsPerBar={beatsPerBar}
              transportPlaying={running}
              getAudioContext={() => {
                const c = ctxRef.current;
                if (c && c.state !== 'closed') return c;
                void ensureCtx();
                return ctxRef.current as AudioContext;
              }}
              onKeyChange={(root, mode) => {
                const keyMode: StudioDetectedKeyMode = mode === 'minor' ? 'minor' : 'major';
                setStudioTracks((prev) =>
                  prev.map((t, i) =>
                    i === selectedTrackIndex && studioTrackIsGenoChordCreatorChannel(t)
                      ? { ...t, trackKeyRoot: root, trackKeyMode: keyMode }
                      : t,
                  ),
                );
              }}
              onLoopBarsChange={(bars) =>
                updateGenoChordCreatorLoopBars(selectedTrackIndex, bars)
              }
              onPresetChange={(presetId) => {
                setStudioTracks((prev) =>
                  prev.map((t, i) =>
                    i === selectedTrackIndex && studioTrackIsGenoChordCreatorChannel(t)
                      ? { ...t, genoChordCreatorPresetId: presetId }
                      : t,
                  ),
                );
              }}
              onAudioToggle={(on) => {
                setStudioTracks((prev) =>
                  prev.map((t, i) =>
                    i === selectedTrackIndex && studioTrackIsGenoChordCreatorChannel(t)
                      ? { ...t, genoChordCreatorAudioOn: on }
                      : t,
                  ),
                );
              }}
              onDraftStepsChange={(steps) => updateGenoChordCreatorDraft(selectedTrackIndex, steps)}
              onExportToTrack={(steps, loopBars) =>
                applyGenoChordCreatorToTrack(selectedTrackIndex, steps, loopBars)
              }
              onExportMidiToTrack={(notes, loopBars) =>
                applyGenoChordCreatorMidiToTrack(selectedTrackIndex, notes, loopBars)
              }
              getSe2TransportBeat={getSe2TransportBeat}
              onSe2SyncToggle={() => toggleGenoChordCreatorSe2Sync(selectedTrackIndex)}
              onPreviewMidi={(midi, vel) => {
                void previewPianoPitch(midi, vel ?? 0.85);
              }}
              onPresetBpmChange={(next) =>
                setBpm(Math.max(40, Math.min(240, Math.round(next))))
              }
            />
          </Se2ChordGenieDockedPanel>
        )
        : (
          <Se2ChordGenieCollapsedStrip
            trackName={se2TrackNumberedName(
              chordGenieEligibleTrack.laneNumber,
              chordGenieEligibleTrack.name,
              studioLanePad,
            )}
            accentHex={chordGenieEligibleTrack.colorHex}
            onExpand={() => setChordGeniePanelOpen(true)}
          />
        )
      : undefined;

  const beatPadsLaneEntries = useMemo(
    () =>
      studioTracks
        .map((t, ti) =>
          studioTrackIsBeatPadsChannel(t) ? { track: t as Se2BeatPadsTrack, ti } : null,
        )
        .filter((x): x is { track: Se2BeatPadsTrack; ti: number } => x != null),
    [studioTracks],
  );

  const beatPadsLanesHost =
    beatPadsLaneEntries.length > 0
      ? beatPadsLaneEntries.map(({ track: bpTrack, ti }) => {
          const laneActive = ti === selectedTrackIndex && beatPadsPanelVisible;
          return (
            <div
              key={bpTrack.id}
              className={
                laneActive
                  ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
                  : 'hidden'
              }
              aria-hidden={!laneActive}
            >
              <Se2BeatPadsExportBridgeProvider>
              <Se2BeatPadsDockedPanel
                layout={beatPadsMachineOpen && !showMixer ? 'fullscreen' : 'docked'}
                trackName={se2TrackNumberedName(bpTrack.laneNumber, bpTrack.name, studioLanePad)}
                accentHex={bpTrack.colorHex}
                machineChromeOpen={beatPadsMachineOpen}
                se2SyncMode={se2BeatPadsSe2SyncMode(bpTrack)}
                onSe2SyncModeChange={(mode) => setBeatPadsSe2SyncMode(ti, mode)}
                onMachineChromeClose={closeBeatPadsMachineChrome}
                onMachineChromeOpen={openBeatPadsMachineChrome}
              >
                <Suspense
                  fallback={
                    <div
                      className="flex min-h-[120px] items-center justify-center text-[10px] font-bold uppercase tracking-wide text-[#7cf4c6]/70"
                      aria-busy
                    >
                      Loading Beat Pads…
                    </div>
                  }
                >
                  <Se2BeatPadsPanelLazy
                    track={bpTrack}
                    trackIndex={ti}
                    bpm={bpm}
                    disabled={false}
                    ensureCtx={ensureCtx}
                    getTrackStripInput={() => getBeatPadsTrackStripInput(ti)}
                    getMasterOutput={() => studioMasterOutRef.current}
                    trackVolume127={trackVolumes[ti] ?? MIXER_UNITY_VOL}
                    onPatternChange={updateBeatPadsPattern}
                    onBeatPadsSpreadChange={(spread) => updateBeatPadsSpread(ti, spread)}
                    onHarmonyTrackIdChange={updateBeatPadsHarmonyTrackId}
                    onApplyTransport={applyBeatPadsTransportFromGeno}
                    onReportLiveTransport={(opts) => {
                      beatPadsLiveTransportByTrackRef.current.set(ti, opts);
                    }}
                    onProducerKitIdChange={updateBeatPadsProducerKit}
                    matchedPresetId={bpTrack.beatPadsMatchedPresetId}
                    onMatchedPresetIdChange={(presetId) =>
                      updateBeatPadsMatchedPresetId(ti, presetId)
                    }
                    onPadStoreChanged={() => notifyBeatPadsPadStoreChanged(bpTrack.id)}
                    machineChromeOpen={beatPadsMachineOpen}
                    onClose={closeBeatPadsMachineChrome}
                    se2SyncMode={se2BeatPadsSe2SyncMode(bpTrack)}
                    onSe2SyncModeChange={(mode) => setBeatPadsSe2SyncMode(ti, mode)}
                    se2TransportPlaying={running}
                    getSe2PlayheadBeat={() => displayBeatRef.current}
                    getSe2TransportOriginBeat={() => originBeatRef.current}
                    onSe2TransportToggle={() => void onTogglePlayPause()}
                    onSeekSe2Beat={(beat) => seekSe2BeatFromBeatPads(beat)}
                    se2BeatsPerBar={beatsPerBar}
                    harmonyTracks={studioTracks}
                    songKeyRoot={songKeyRoot}
                    songKeyMode={songKeyMode}
                    sessionLoopBars={loopBars}
                    onBeatPadsHarmonyTrackIdChange={(id) => {
                      updateBeatPadsHarmonyTrackIdOnly(ti, id);
                      if (bpTrack.beatPadsHarmonyLocked) {
                        syncBeatPadsFromHarmonyLane(ti);
                      }
                    }}
                    onBeatPadsHarmonyLockedChange={(locked) => {
                      toggleBeatPadsHarmonyLocked(ti, locked);
                      if (locked) syncBeatPadsFromHarmonyLane(ti);
                    }}
                    onBeatPadsPatternStyleChange={(style) =>
                      updateBeatPadsPatternStyle(ti, style)
                    }
                    onBeatPadsSyncFromHarmony={() => syncBeatPadsFromHarmonyLane(ti)}
                    onBeatPadsLoadMatchedPattern={() => loadBeatPadsMatchedPatternOnTrack(ti)}
                    onBeatPadsKickKeyLockChange={(locked) =>
                      updateBeatPadsKickKeyLock(ti, locked)
                    }
                    onBeatPadsKickTargetPadChange={(pad) =>
                      updateBeatPadsKickTargetPad(ti, pad)
                    }
                    onBeatPadsRegeneratePad={(pad) => regenerateBeatPadsPadOnTrack(ti, pad)}
                    onExportBeatPadsToAudioTrack={(args) =>
                      exportBeatPadsToAudioTrack(ti, args)
                    }
                    onExportBeatPadsSpreadMidiToTrack={({ targetTrackIndex, notes, loopBars }) =>
                      exportBeatPadsSpreadMidiToTrack(targetTrackIndex, notes, loopBars)
                    }
                    onExportBeatPadsSpreadWavToTrack={({ targetTrackIndex, buffer, loopBars, bpm, sourceLabel }) =>
                      exportBeatPadsSpreadWavToTrack(targetTrackIndex, {
                        buffer,
                        loopBars,
                        bpm,
                        sourceLabel,
                      })
                    }
                    onExportBeatPadsLanesToTracks={({ lanes }) =>
                      exportBeatPadsLanesToTracks(ti, { lanes })
                    }
                    onExportBeatPads808LabToPianoRoll={(notes) =>
                      exportBeatPads808LabToNewLab808Track(notes)
                    }
                    onExportBeatPads808LabWavToTrack={(args) =>
                      exportBeatPadsToAudioTrack(ti, args)
                    }
                    onBeatPads808LabVoiceChange={updateBeatPads808LabVoice}
                    onBeatPads808LabSyncedChange={updateBeatPads808LabSynced}
                    onBeatPadsOrchHitsVoiceChange={updateBeatPadsOrchHitsVoice}
                    onBeatPadsOrchHitsSyncedChange={updateBeatPadsOrchHitsSynced}
                    onExportBeatPadsOrchHitsMidiToTrack={({ targetTrackIndex, notes, loopBars }) =>
                      exportBeatPadsSpreadMidiToTrack(targetTrackIndex, notes, loopBars)
                    }
                  />
                </Suspense>
              </Se2BeatPadsDockedPanel>
              </Se2BeatPadsExportBridgeProvider>
            </div>
          );
        })
      : null;

  const pianoRollGlideBassEditPanel = showGlideBassUi ? glideBassEditPanel : undefined;
  const pianoRollSynthGenoEditPanel = showSynthGenoUi ? synthGenoEditPanel : undefined;
  const pianoRollGrooveLeadEditPanel = showGrooveLeadUi ? grooveLeadEditPanel : undefined;
  const pianoRollLab808EditPanel = showLab808Ui ? lab808EditPanel : undefined;
  const pianoRollGenoUltraSynthEditPanel = showGenoUltraSynthUi ? genoUltraSynthEditPanel : undefined;
  const pianoRollGenoBassSynthEditPanel = showGenoBassSynthUi ? genoBassSynthEditPanel : undefined;
  const pianoRollHumCaptureEditPanel = showHumCaptureUi ? humCaptureEditPanel : undefined;
  const pianoRollGuitarEditPanel = showGuitarUi ? guitarEditPanel : undefined;
  const pianoRollDrumGeneratorEditPanel = showDrumGeneratorUi ? drumGeneratorEditPanel : undefined;
  const pianoRollChordGenieEditPanel = showGenoChordCreatorUi ? chordGenieEditPanel : undefined;
  const pianoRollBeatPadsEditPanel = undefined;
  const pianoRollGlideBassStripOpen = Boolean(showGlideBassUi && glideBassPanelOpen);
  const pianoRollSynthGenoStripOpen = Boolean(showSynthGenoUi && synthGenoPanelOpen);
  const pianoRollSynthGenoBuildFullscreenOpen = Boolean(
    showSynthGenoUi && synthGenoPanelOpen && synthGenoBuildFullscreenOpen,
  );
  const pianoRollGrooveLeadStripOpen = Boolean(showGrooveLeadUi && grooveLeadPanelOpen);
  const pianoRollLab808StripOpen = Boolean(showLab808Ui && lab808PanelOpen);
  const pianoRollGenoUltraSynthStripOpen = Boolean(showGenoUltraSynthUi && genoUltraSynthPanelOpen);
  const pianoRollGenoBassSynthStripOpen = Boolean(showGenoBassSynthUi && genoBassSynthPanelOpen);
  const pianoRollHumCaptureStripOpen = Boolean(showHumCaptureUi && humCapturePanelOpen);
  const pianoRollGuitarStripOpen = Boolean(showGuitarUi && guitarPanelOpen);
  const pianoRollDrumGeneratorStripOpen = Boolean(showDrumGeneratorUi && drumGeneratorPanelOpen);
  const pianoRollChordGenieStripOpen = Boolean(showGenoChordCreatorUi && chordGeniePanelOpen);
  const pianoRollBeatPadsStripOpen = false;

  const addEmptyTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const newTrack: MockMusioTrack = {
      id: newTrackId(),
      name: nextMidiTrackName(prev),
      laneNumber: se2NextStudioLaneNumber(prev),
      colorHex: NEW_TRACK_COLOR_HEX[prev.length % NEW_TRACK_COLOR_HEX.length],
      kind: 'midi',
      midiChannel: studioNextMidiChannel(prev),
      midiInstrumentId: STUDIO_MIDI_DEFAULT_INSTRUMENT_ID,
      notes: [],
      audioClips: [],
    };
    const next = [...prev, newTrack];
    setStudioTracks(next);
    setSelectedTrackIndex(next.length - 1);
    setSelectedPianoNoteIndex(null);
  }, []);

  const addAudioTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const newTrack: MockMusioTrack = {
      id: newTrackId(),
      name: nextAudioTrackName(prev),
      laneNumber: se2NextStudioLaneNumber(prev),
      colorHex: NEW_TRACK_COLOR_HEX[prev.length % NEW_TRACK_COLOR_HEX.length],
      kind: 'audio',
      notes: [],
      audioClips: [],
      audioInputDeviceId: '',
    };
    const next = [...prev, newTrack];
    setStudioTracks(next);
    setSelectedTrackIndex(next.length - 1);
    setSelectedPianoNoteIndex(null);
  }, []);

  const addTrackAlignTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const newTrack: MockMusioTrack = {
      id: newTrackId(),
      name: nextTrackAlignTrackName(prev),
      laneNumber: se2NextStudioLaneNumber(prev),
      colorHex: '#6EE7F9',
      kind: 'trackAlign',
      notes: [],
      audioClips: [],
    };
    const next = [...prev, newTrack];
    setStudioTracks(next);
    setSelectedTrackIndex(next.length - 1);
    setSelectedPianoNoteIndex(null);
  }, []);

  const addA2mTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const mode = STUDIO_A2M_DEFAULT_MODE;
    const newTrack: MockMusioTrack = {
      id: newTrackId(),
      name: nextA2mTrackName(prev),
      laneNumber: se2NextStudioLaneNumber(prev),
      colorHex: '#FFB84D',
      kind: 'a2m',
      a2mMode: mode,
      midiChannel: studioNextMidiChannel(prev),
      midiInstrumentId: studioDefaultInstrumentForA2mMode(mode),
      notes: [],
      audioClips: [],
    };
    const next = [...prev, newTrack];
    setStudioTracks(next);
    setSelectedTrackIndex(next.length - 1);
    setSelectedPianoNoteIndex(null);
  }, []);

  const addRhythmTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const newTrack: MockMusioTrack = {
      id: newTrackId(),
      name: nextRhythmTrackName(prev),
      laneNumber: se2NextStudioLaneNumber(prev),
      colorHex: '#C77DFF',
      kind: 'rhythm',
      midiChannel: studioNextMidiChannel(prev),
      midiInstrumentId: STUDIO_MIDI_DEFAULT_INSTRUMENT_ID,
      rhythmSteps: [],
      rhythmLoopBars: STUDIO_HARMONY_LOOP_BARS,
      notes: [],
      audioClips: [],
    };
    const next = [...prev, newTrack];
    setStudioTracks(next);
    setSelectedTrackIndex(next.length - 1);
    setSelectedPianoNoteIndex(null);
    openPianoRollEditor();
  }, [openPianoRollEditor]);

  const addGlideBassTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const ti = prev.length;
    const newTrack: MockMusioTrack = {
      id: newTrackId(),
      name: nextGlideBassTrackName(prev),
      laneNumber: se2NextStudioLaneNumber(prev),
      colorHex: '#9B6BFF',
      kind: 'glideBass',
      midiChannel: studioNextMidiChannel(prev),
      glideBassPresetId: BEAT_LAB_DEFAULT_SYNTH_PRESET_ID,
      glideBassHarmonyTrackId: '',
      notes: [],
      audioClips: [],
    };
    setSe2GlideBassVoices((voices) => {
      const next = [...voices];
      next[ti] = beatLabBassSynthVoiceParamsFromPresetId(BEAT_LAB_DEFAULT_SYNTH_PRESET_ID);
      return next;
    });
    const next = [...prev, newTrack];
    setStudioTracks(next);
    setSelectedTrackIndex(ti);
    setSelectedPianoNoteIndex(null);
    setGlideBassPanelOpen(true);
    openPianoRollEditor();
  }, [openPianoRollEditor]);

  const addSynthGenoTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const ti = prev.length;
    const initVoice = se2SynthGenoDefaultVoice('Init Geno');
    const newTrack: MockMusioTrack = {
      id: newTrackId(),
      name: nextSynthGenoTrackName(prev),
      laneNumber: se2NextStudioLaneNumber(prev),
      colorHex: '#00E5CC',
      kind: 'synthGeno',
      midiChannel: studioNextMidiChannel(prev),
      synthGenoPrompt: 'warm keys with soft attack',
      synthGenoComposePrompt: 'pop chord progression 8 bars',
      synthGenoPatchLabel: initVoice.label,
      notes: [],
      audioClips: [],
    };
    setSe2SynthGenoVoices((voices) => {
      const next = [...voices];
      next[ti] = initVoice;
      return next;
    });
    const next = [...prev, newTrack];
    setStudioTracks(next);
    setSelectedTrackIndex(ti);
    setSelectedPianoNoteIndex(null);
    setSynthGenoPanelOpen(true);
    openPianoRollEditor();
  }, [openPianoRollEditor]);

  const addGrooveLeadTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const ti = prev.length;
    const initVoice = se2GrooveLeadDefaultVoice();
    const newTrack: MockMusioTrack = {
      id: newTrackId(),
      name: nextGrooveLeadTrackName(prev),
      laneNumber: se2NextStudioLaneNumber(prev),
      colorHex: '#4EC8E8',
      kind: 'grooveLead',
      midiChannel: studioNextMidiChannel(prev),
      grooveLeadPresetId: initVoice.presetId,
      grooveLeadHarmonyTrackId: '',
      notes: [],
      audioClips: [],
    };
    setSe2GrooveLeadVoices((voices) => {
      const next = [...voices];
      next[ti] = initVoice;
      return next;
    });
    const next = [...prev, newTrack];
    setStudioTracks(next);
    setSelectedTrackIndex(ti);
    setSelectedPianoNoteIndex(null);
    setGrooveLeadPanelOpen(true);
    openPianoRollEditor();
  }, [openPianoRollEditor]);

  const addLab808Track = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const ti = prev.length;
    const initVoice = se2Lab808DefaultVoice();
    const newTrack: MockMusioTrack = {
      id: newTrackId(),
      name: nextLab808TrackName(prev),
      laneNumber: se2NextStudioLaneNumber(prev),
      colorHex: '#E8784A',
      kind: 'lab808',
      midiChannel: studioNextMidiChannel(prev),
      lab808SoundLane: initVoice.soundLane,
      lab808KickPresetId: initVoice.kickPresetId,
      lab808BassPresetId: initVoice.bassPresetId,
      lab808TonePadBaseMidi: initVoice.tonePadBaseMidi,
      lab808ToneGridLoopBars: initVoice.toneGridLoopBars,
      lab808ToneGridSteps: initVoice.toneGridSteps.map((row) => [...row]),
      lab808PercSnareSteps: [...initVoice.percSnareSteps],
      lab808PercClapSteps: [...initVoice.percClapSteps],
      lab808PercLevel: initVoice.percLevel,
      notes: [],
      audioClips: [],
    };
    setSe2Lab808Voices((voices) => {
      const next = [...voices];
      next[ti] = initVoice;
      return next;
    });
    const next = [...prev, newTrack];
    setStudioTracks(next);
    setSelectedTrackIndex(ti);
    setSelectedPianoNoteIndex(null);
    setLab808PanelOpen(true);
    openPianoRollEditor();
  }, [openPianoRollEditor]);

  const addGenoUltraSynthTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const ti = prev.length;
    const initVoice = genoUltraPresetById(GENO_ULTRA_DEFAULT_PRESET_ID);
    const base = se2DefaultGenoUltraSynthTrack({
      id: newTrackId(),
      name: nextGenoUltraSynthTrackName(prev),
      colorHex: SE2_GENO_ULTRA_SYNTH_ACCENT,
      midiChannel: studioNextMidiChannel(prev),
    });
    const newTrack: MockMusioTrack = {
      ...base,
      laneNumber: se2NextStudioLaneNumber(prev),
    };
    setSe2GenoUltraSynthVoices((voices) => {
      const next = [...voices];
      next[ti] = initVoice;
      return next;
    });
    const next = [...prev, newTrack];
    setStudioTracks(next);
    setSelectedTrackIndex(ti);
    setSelectedPianoNoteIndex(null);
    setGenoUltraSynthPanelOpen(true);
    openPianoRollEditor();
  }, [openPianoRollEditor]);

  const addGenoBassSynthTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const ti = prev.length;
    const initVoice = genoBassPresetById(GENO_BASS_DEFAULT_PRESET_ID);
    const base = se2DefaultGenoBassSynthTrack({
      id: newTrackId(),
      name: nextGenoBassSynthTrackName(prev),
      colorHex: SE2_GENO_BASS_SYNTH_ACCENT,
      midiChannel: studioNextMidiChannel(prev),
    });
    const newTrack: MockMusioTrack = {
      ...base,
      laneNumber: se2NextStudioLaneNumber(prev),
    };
    setSe2GenoBassSynthVoices((voices) => {
      const next = [...voices];
      next[ti] = initVoice;
      return next;
    });
    const next = [...prev, newTrack];
    setStudioTracks(next);
    setSelectedTrackIndex(ti);
    setSelectedPianoNoteIndex(null);
    setPianoRollExpanded(false);
    setGenoBassSynthPanelOpen(true);
    openPianoRollEditor();
  }, [openPianoRollEditor]);

  const addHumCaptureTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const ti = prev.length;
    const newTrack: MockMusioTrack = {
      id: newTrackId(),
      name: nextHumCaptureTrackName(prev),
      laneNumber: se2NextStudioLaneNumber(prev),
      colorHex: '#00E5FF',
      midiChannel: studioNextMidiChannel(prev),
      notes: [],
      audioClips: [],
      ...se2DefaultHumCaptureTrackFields(),
    };
    const next = [...prev, newTrack];
    setStudioTracks(next);
    setSelectedTrackIndex(ti);
    setSelectedPianoNoteIndex(null);
    setHumCapturePanelOpen(true);
    openPianoRollEditor();
  }, [openPianoRollEditor]);

  const addGuitarTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const ti = prev.length;
    const newTrack: MockMusioTrack = {
      id: newTrackId(),
      name: nextGuitarTrackName(prev),
      laneNumber: se2NextStudioLaneNumber(prev),
      colorHex: SE2_GUITAR_ACCENT,
      midiChannel: studioNextMidiChannel(prev),
      notes: [],
      audioClips: [],
      ...se2DefaultGuitarTrackFields(),
    };
    const next = [...prev, newTrack];
    setStudioTracks(next);
    setSelectedTrackIndex(ti);
    setSelectedPianoNoteIndex(null);
    setGuitarPanelOpen(true);
    openPianoRollEditor();
    const warmGuitar = (c: AudioContext) => {
      const strip = getHumCapturePreviewDestination(ti)(c);
      const dest = resolveSe2GuitarAudioForTrack(c, ti, strip, newTrack);
      void warmupSe2GuitarInstrument(c, newTrack.guitarInstrumentId ?? 'electric_guitar_clean', dest);
    };
    const ctx = ctxRef.current;
    if (ctx && ctx.state !== 'closed') {
      warmGuitar(ctx);
    } else {
      void ensureCtx().then(warmGuitar);
    }
  }, [openPianoRollEditor, ensureCtx, getHumCapturePreviewDestination]);

  const addDrumGeneratorTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const ti = prev.length;
    const newTrack: MockMusioTrack = {
      id: newTrackId(),
      name: nextDrumGeneratorTrackName(prev),
      laneNumber: se2NextStudioLaneNumber(prev),
      colorHex: '#FFB84D',
      kind: 'drumGenerator',
      midiChannel: 10,
      midiInstrumentId: 'gm:trap_drums',
      drumGenStyle: 'pop',
      drumGenSeed: Math.floor(Date.now() % 1_000_000),
      drumGenTemperature: SE2_DRUM_GEN_DEFAULT_TEMPERATURE,
      drumGenHarmonyTrackId: '',
      drumGenGenoBuildSlot: 'b01',
      notes: [],
      audioClips: [],
    };
    const next = [...prev, newTrack];
    setStudioTracks(next);
    setSelectedTrackIndex(ti);
    setSelectedPianoNoteIndex(null);
    setDrumGeneratorPanelOpen(true);
    openPianoRollEditor();
  }, [openPianoRollEditor]);

  const addBeatPadsTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const ti = prev.length;
    const base = se2DefaultBeatPadsTrack({
      id: newTrackId(),
      name: nextBeatPadsTrackName(prev),
      colorHex: '#7CF4C6',
    });
    const newTrack: MockMusioTrack = {
      ...base,
      laneNumber: se2NextStudioLaneNumber(prev),
    };
    const next = [...prev, newTrack];
    setStudioTracks(next);
    setSelectedTrackIndex(ti);
    setSelectedPianoNoteIndex(null);
    setBeatPadsMachineOpen(true);
    setShowPianoRoll(false);
    setPianoRollExpanded(false);
    setShowMixer(false);
  }, []);

  const addGenoChordCreatorTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const ti = prev.length;
    const base = se2DefaultGenoChordCreatorTrack({
      id: newTrackId(),
      name: nextGenoChordCreatorTrackName(prev),
      colorHex: SE2_GENO_CHORD_CREATOR_ACCENT,
      midiChannel: studioNextMidiChannel(prev),
    });
    const newTrack: MockMusioTrack = {
      ...base,
      laneNumber: se2NextStudioLaneNumber(prev),
      midiInstrumentId: STUDIO_MIDI_DEFAULT_INSTRUMENT_ID,
    };
    const next = [...prev, newTrack];
    setStudioTracks(next);
    setSelectedTrackIndex(ti);
    setSelectedPianoNoteIndex(null);
    setChordGeniePanelOpen(true);
    openPianoRollEditor();
  }, [openPianoRollEditor]);

  const addTrackByKind = useCallback(
    (kind: StudioNewTrackKind) => {
      if (studioTracksRef.current.length >= MAX_STUDIO_TRACKS) return;
      if (kind === 'midi') addEmptyTrack();
      else if (kind === 'audio') addAudioTrack();
      else if (kind === 'trackAlign') addTrackAlignTrack();
      else if (kind === 'rhythm') addRhythmTrack();
      else if (kind === 'glideBass') addGlideBassTrack();
      else if (kind === 'synthGeno') addSynthGenoTrack();
      else if (kind === 'grooveLead') addGrooveLeadTrack();
      else if (kind === 'lab808') addLab808Track();
      else if (kind === 'genoUltraSynth') addGenoUltraSynthTrack();
      else if (kind === 'genoBassSynth') addGenoBassSynthTrack();
      else if (kind === 'humCapture') addHumCaptureTrack();
      else if (kind === 'guitar') addGuitarTrack();
      else if (kind === 'drumGenerator') addDrumGeneratorTrack();
      else if (kind === 'beatPads') addBeatPadsTrack();
      else if (kind === 'genoChordCreator' || kind === 'chordGenie') addGenoChordCreatorTrack();
      else addA2mTrack();
      scrollTrackListToEnd();
    },
    [addEmptyTrack, addAudioTrack, addTrackAlignTrack, addA2mTrack, addRhythmTrack, addGlideBassTrack, addSynthGenoTrack, addGrooveLeadTrack, addLab808Track, addGenoUltraSynthTrack, addGenoBassSynthTrack, addHumCaptureTrack, addGuitarTrack, addDrumGeneratorTrack, addBeatPadsTrack, addGenoChordCreatorTrack, scrollTrackListToEnd],
  );

  const duplicateSelectedTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const ti = Math.max(0, Math.min(selectedTrackIndex, prev.length - 1));
    const src = prev[ti];
    if (!src) return;
    const copy: MockMusioTrack = {
      id: newTrackId(),
      name: `${src.name} copy`,
      laneNumber: se2NextStudioLaneNumber(prev),
      colorHex: src.colorHex,
      kind: src.kind,
      notes: src.notes.map((n) => ({ ...n })),
      audioClips: src.audioClips.map((c) => ({ ...c })),
      ...(src.kind === 'audio'
        ? { audioInputDeviceId: src.audioInputDeviceId ?? '' }
        : src.kind === 'trackAlign'
          ? { alignSourceBpm: src.alignSourceBpm }
          : src.kind === 'a2m'
          ? {
              midiChannel: studioNextMidiChannel(prev),
              midiInstrumentId: studioNormalizeMidiInstrumentId(src.midiInstrumentId),
              a2mMode: studioNormalizeA2mMode(src.a2mMode),
              a2mDetectedBpm: src.a2mDetectedBpm,
              a2mKeyRoot: src.a2mKeyRoot,
              a2mKeyMode: src.a2mKeyMode,
              trackKeyRoot: src.trackKeyRoot,
              trackKeyMode: src.trackKeyMode,
            }
          : src.kind === 'rhythm'
            ? {
                midiChannel: studioNextMidiChannel(prev),
                midiInstrumentId: studioNormalizeMidiInstrumentId(src.midiInstrumentId),
                rhythmSteps: src.rhythmSteps?.map((s) => ({ ...s })),
                rhythmLoopBars: src.rhythmLoopBars,
                trackKeyRoot: src.trackKeyRoot,
                trackKeyMode: src.trackKeyMode,
              }
            : src.kind === 'glideBass'
              ? {
                  midiChannel: studioNextMidiChannel(prev),
                  glideBassPresetId: src.glideBassPresetId,
                  glideBassHarmonyTrackId: src.glideBassHarmonyTrackId ?? '',
                  trackKeyRoot: src.trackKeyRoot,
                  trackKeyMode: src.trackKeyMode,
                }
              : src.kind === 'synthGeno'
                ? {
                    midiChannel: studioNextMidiChannel(prev),
                    synthGenoPrompt: src.synthGenoPrompt,
                    synthGenoComposePrompt: src.synthGenoComposePrompt,
                    synthGenoPatchLabel: src.synthGenoPatchLabel,
                    trackKeyRoot: src.trackKeyRoot,
                    trackKeyMode: src.trackKeyMode,
                  }
              : src.kind === 'grooveLead'
                ? {
                    midiChannel: studioNextMidiChannel(prev),
                    grooveLeadPresetId: src.grooveLeadPresetId,
                    grooveLeadHarmonyTrackId: src.grooveLeadHarmonyTrackId ?? '',
                    trackKeyRoot: src.trackKeyRoot,
                    trackKeyMode: src.trackKeyMode,
                  }
              : src.kind === 'lab808'
                ? {
                    midiChannel: studioNextMidiChannel(prev),
                    lab808SoundLane: src.lab808SoundLane,
                    lab808KickPresetId: src.lab808KickPresetId,
                    lab808BassPresetId: src.lab808BassPresetId,
                    lab808TonePadBaseMidi: src.lab808TonePadBaseMidi,
                    lab808ToneGridLoopBars: src.lab808ToneGridLoopBars,
                    lab808ToneGridSteps:
                      src.lab808ToneGridSteps?.map((row) => [...row]) ??
                      src.lab808DrumSteps?.map((row) => [...row]),
                    lab808ChordLockEnabled: src.lab808ChordLockEnabled,
                    lab808ChordLockSourceKind: src.lab808ChordLockSourceKind,
                    lab808ChordLockHarmonyTrackId: src.lab808ChordLockHarmonyTrackId,
                    lab808ChordLockKeyRoot: src.lab808ChordLockKeyRoot,
                    lab808ChordLockKeyMode: src.lab808ChordLockKeyMode,
                    lab808RootGenSeed: src.lab808RootGenSeed,
                    lab808ToneGridZoom: src.lab808ToneGridZoom,
                    lab808RootGenQuantize: src.lab808RootGenQuantize,
                    lab808RootGenGenre: src.lab808RootGenGenre,
                    lab808PercSnareSteps: src.lab808PercSnareSteps ? [...src.lab808PercSnareSteps] : undefined,
                    lab808PercClapSteps: src.lab808PercClapSteps ? [...src.lab808PercClapSteps] : undefined,
                    lab808PercLevel: src.lab808PercLevel,
                    trackKeyRoot: src.trackKeyRoot,
                    trackKeyMode: src.trackKeyMode,
                  }
              : src.kind === 'genoUltraSynth'
                ? {
                    midiChannel: studioNextMidiChannel(prev),
                    genoUltraPresetId: src.genoUltraPresetId,
                    genoUltraPatchLabel: src.genoUltraPatchLabel,
                    genoUltraArpSyncLocked: src.genoUltraArpSyncLocked,
                    genoUltraArpBpm: src.genoUltraArpBpm,
                    trackKeyRoot: src.trackKeyRoot,
                    trackKeyMode: src.trackKeyMode,
                  }
              : src.kind === 'genoBassSynth'
                ? {
                    midiChannel: studioNextMidiChannel(prev),
                    genoBassPresetId: src.genoBassPresetId,
                    genoBassPatchLabel: src.genoBassPatchLabel,
                    trackKeyRoot: src.trackKeyRoot,
                    trackKeyMode: src.trackKeyMode,
                  }
              : src.kind === 'humCapture'
                ? {
                    midiChannel: studioNextMidiChannel(prev),
                    humCaptureInstrumentId: src.humCaptureInstrumentId,
                    humCaptureHarmonyTrackId: src.humCaptureHarmonyTrackId ?? '',
                    humCaptureRollBars: src.humCaptureRollBars,
                    humCaptureKeyLockMode: src.humCaptureKeyLockMode,
                    humCaptureKeyRoot: src.humCaptureKeyRoot,
                    humCaptureScaleId: src.humCaptureScaleId,
                    humCaptureQuantize: src.humCaptureQuantize,
                    humCaptureTranspose: src.humCaptureTranspose,
                    trackKeyRoot: src.trackKeyRoot,
                    trackKeyMode: src.trackKeyMode,
                  }
              : src.kind === 'guitar'
                ? {
                    midiChannel: studioNextMidiChannel(prev),
                    guitarInstrumentId: src.guitarInstrumentId,
                    guitarTranspose: src.guitarTranspose,
                    guitarFxDrive: src.guitarFxDrive,
                    guitarFxChorus: src.guitarFxChorus,
                    guitarFxReverb: src.guitarFxReverb,
                    guitarFxTone: src.guitarFxTone,
                    guitarFxComp: src.guitarFxComp,
                    trackKeyRoot: src.trackKeyRoot,
                    trackKeyMode: src.trackKeyMode,
                  }
              : src.kind === 'genoChordCreator' || src.kind === 'chordGenie'
                ? {
                    midiChannel: studioNextMidiChannel(prev),
                    genoChordCreatorPresetId:
                      src.genoChordCreatorPresetId ?? src.chordGeniePresetId,
                    genoChordCreatorAudioOn:
                      src.genoChordCreatorAudioOn ?? src.chordGenieAudioOn,
                    genoChordCreatorSe2Sync: src.genoChordCreatorSe2Sync,
                    harmonySteps: src.harmonySteps?.map((s) => ({ ...s })),
                    harmonyLoopBars: src.harmonyLoopBars,
                    trackKeyRoot: src.trackKeyRoot,
                    trackKeyMode: src.trackKeyMode,
                  }
              : src.kind === 'drumGenerator'
                ? {
                    midiChannel: 10,
                    midiInstrumentId: src.midiInstrumentId,
                    drumGenStyle: src.drumGenStyle,
                    drumGenSeed: src.drumGenSeed,
                    drumGenTemperature: src.drumGenTemperature,
                    drumGenHarmonyTrackId: src.drumGenHarmonyTrackId ?? '',
                    drumGenGenoBuildSlot: src.drumGenGenoBuildSlot ?? 'b01',
                    drumGenModernPresetId: src.drumGenModernPresetId,
                    drumGenModernGenre: src.drumGenModernGenre,
                    drumPatternPresetId: src.drumPatternPresetId,
                    beatLabPatternPresetId: src.beatLabPatternPresetId,
                    drumProducerKitId: src.drumProducerKitId,
                    drumPadOverrides: src.drumPadOverrides
                      ? Object.fromEntries(
                          Object.entries(src.drumPadOverrides).map(([k, v]) => [Number(k), v]),
                        )
                      : undefined,
                  }
              : src.kind === 'beatPads'
                ? {
                    midiChannel: 10,
                    beatPadsLoopBars: src.beatPadsLoopBars,
                    beatPadsStepsPerBar: src.beatPadsStepsPerBar,
                    beatPadsPattern: src.beatPadsPattern?.map((lane) =>
                      lane.map((n) => ({ ...n })),
                    ),
                    beatPadsHarmonyTrackId: src.beatPadsHarmonyTrackId ?? '',
                    beatPadsGenoBuildSlot: src.beatPadsGenoBuildSlot,
                    beatPadsHarmonyLocked: src.beatPadsHarmonyLocked,
                    beatPadsPatternStyle: src.beatPadsPatternStyle,
                    beatPadsMatchedPresetId: src.beatPadsMatchedPresetId,
                    beatPadsKickKeyLock: src.beatPadsKickKeyLock,
                    beatPadsKickFollowMode: src.beatPadsKickFollowMode,
                    beatPadsKickTargetPad: src.beatPadsKickTargetPad,
                    beatPadsSyncLocked: src.beatPadsSyncLocked,
                    beatPadsSe2SyncMode: src.beatPadsSe2SyncMode,
                    beatPadsProducerKitId: src.beatPadsProducerKitId,
                    beatPadsSpread: src.beatPadsSpread
                      ? {
                          ...src.beatPadsSpread,
                          notes: src.beatPadsSpread.notes.map((n) => ({ ...n })),
                        }
                      : undefined,
                    beatPads808LabVoice: src.beatPads808LabVoice
                      ? cloneSe2Lab808VoiceParams(src.beatPads808LabVoice)
                      : undefined,
                    beatPads808LabSynced: src.beatPads808LabSynced,
                    beatPadsOrchHitsVoice: src.beatPadsOrchHitsVoice
                      ? cloneBeatPadsOrchHitsVoice(src.beatPadsOrchHitsVoice)
                      : undefined,
                    beatPadsOrchHitsSynced: src.beatPadsOrchHitsSynced,
                    notes: [],
                  }
              : {
                midiChannel: studioNextMidiChannel(prev),
                midiInstrumentId: studioNormalizeMidiInstrumentId(src.midiInstrumentId),
                trackKeyRoot: src.trackKeyRoot,
                trackKeyMode: src.trackKeyMode,
              }),
    };
    const next = [...prev.slice(0, ti + 1), copy, ...prev.slice(ti + 1)];
    setStudioTracks(next);
    if (src.kind === 'glideBass') {
      setSe2GlideBassVoices((voices) => {
        const vNext = [...voices];
        vNext[ti + 1] = {
          ...(voices[ti] ?? beatLabBassSynthVoiceParamsFromPresetId(src.glideBassPresetId)),
        };
        return vNext;
      });
    }
    if (src.kind === 'synthGeno') {
      setSe2SynthGenoVoices((voices) => {
        const vNext = [...voices];
        vNext[ti + 1] = {
          ...(voices[ti] ?? se2SynthGenoVoiceFromTrack(src, undefined)),
        };
        return vNext;
      });
    }
    if (src.kind === 'grooveLead') {
      setSe2GrooveLeadVoices((voices) => {
        const vNext = [...voices];
        vNext[ti + 1] = {
          ...(voices[ti] ?? se2GrooveLeadVoiceFromTrack(src, undefined)),
        };
        return vNext;
      });
    }
    if (src.kind === 'lab808') {
      setSe2Lab808Voices((voices) => {
        const vNext = [...voices];
        vNext[ti + 1] = {
          ...(voices[ti] ?? se2Lab808VoiceFromTrack(src as Se2Lab808Track, undefined)),
        };
        return vNext;
      });
    }
    if (src.kind === 'genoUltraSynth') {
      setSe2GenoUltraSynthVoices((voices) => {
        const vNext = [...voices];
        vNext[ti + 1] = {
          ...(voices[ti] ?? se2GenoUltraVoiceFromTrack(src, undefined)),
        };
        return vNext;
      });
    }
    if (src.kind === 'genoBassSynth') {
      setSe2GenoBassSynthVoices((voices) => {
        const vNext = [...voices];
        vNext[ti + 1] = {
          ...(voices[ti] ?? se2GenoBassVoiceFromTrack(src, undefined)),
        };
        return vNext;
      });
    }
    setSelectedTrackIndex(ti + 1);
    setSelectedPianoNoteIndex(null);
  }, [selectedTrackIndex]);

  const deleteStudioTrackAt = useCallback(
    (trackIndex: number) => {
      if (trackIndex < 0) return;
      applyTracksMutation((prev) => {
        if (trackIndex >= prev.length) return prev;
        const next = prev.filter((_, j) => j !== trackIndex);
        setSelectedTrackIndex(
          next.length === 0 ? 0 : Math.max(0, Math.min(next.length - 1, trackIndex)),
        );
        return next;
      });
      // Keep index-parallel mixer / arm / FX state aligned after delete (otherwise Rec arm
      // and Pitch Tune stick to stale indices and recording / vocal monitor break).
      setTrackVolumes((prev) =>
        se2RemoveParallelTrackSlot(prev, trackIndex, SE2_STUDIO_MIXER_TRACK_DEFAULTS.vol127, MAX_STUDIO_TRACKS),
      );
      setTrackPans((prev) =>
        se2RemoveParallelTrackSlot(prev, trackIndex, SE2_STUDIO_MIXER_TRACK_DEFAULTS.pan127, MAX_STUDIO_TRACKS),
      );
      setTrackMutes((prev) =>
        se2RemoveParallelTrackSlot(prev, trackIndex, SE2_STUDIO_MIXER_TRACK_DEFAULTS.muted, MAX_STUDIO_TRACKS),
      );
      setTrackSolos((prev) =>
        se2RemoveParallelTrackSlot(prev, trackIndex, SE2_STUDIO_MIXER_TRACK_DEFAULTS.solo, MAX_STUDIO_TRACKS),
      );
      setTrackMonos((prev) =>
        se2RemoveParallelTrackSlot(prev, trackIndex, SE2_STUDIO_MIXER_TRACK_DEFAULTS.mono, MAX_STUDIO_TRACKS),
      );
      setTrackRecordArmed((prev) =>
        se2RemoveParallelTrackSlot(prev, trackIndex, false, MAX_STUDIO_TRACKS),
      );
      setTrackFxSlots((prev) =>
        se2RemoveParallelTrackSlot(prev, trackIndex, emptyMixerFxSlots(), MAX_STUDIO_TRACKS),
      );
      setTrackVocalFx((prev) =>
        se2RemoveParallelTrackSlot(prev, trackIndex, { ...STUDIO_TRACK_VOCAL_FX_DEFAULT }, MAX_STUDIO_TRACKS),
      );
      setTrackInsertFxRacks((prev) =>
        se2RemoveParallelTrackSlot(prev, trackIndex, defaultStudioTrackInsertFxRack(), MAX_STUDIO_TRACKS),
      );
      removeStudioMixerStripAt(trackIndex);
      removeStudioTrackInsertFxStripAt(trackIndex);
      removeStudioTrackVocalFxInsertAt(trackIndex);
      reindexStudioLiveVocalFxRegistryAfterRemove(trackIndex);
      clearSelectedPianoNotes();
      clearSelectedTimelineAudioClip();
      gridCacheRef.current = null;
    },
    [applyTracksMutation, clearSelectedPianoNotes, clearSelectedTimelineAudioClip],
  );

  const startTransport = useCallback(async () => {
    transportArmingRef.current = true;
    setStudioMixerStripGraphPlaybackLocked(false);
    try {
    const ctx = await ensureCtx();
    const bus = midiPreviewBusRef.current;
    const masterOut = studioMasterOutRef.current;
    if (bus) {
      const downstream = masterOut ?? ctx.destination;
      setStudioMixerStripCountHint(Math.max(1, studioTracksRef.current.length));
      forceStudioPreviewBusOutput(bus, downstream);
      ensureSe2MixerStrips(ctx, bus, downstream);
      resyncStudioTrackInsertFxStripInputs(ctx, bus, getStudioMixerStripCountHint(), downstream);
      primeSe2MixerStripRoutes(ctx, bus, downstream);
      clearStudioMixerMeterDecayOnly();
      setStudioMixerStripGraphPlaybackLocked(true);
    }
    /*
     * Warm kits/instruments in the background — never block Play for this.
     * A top-up refill runs when warmup finishes so cold MIDI still catches up.
     */
    const warmupPromise = Promise.all([
      ...studioTracksRef.current
        .filter((t) => studioTrackIsDrumChannel(t) && !studioTrackIsBeatPadsChannel(t) && t.drumProducerKitId)
        .map((t) => studioDrumSessionForTrack(t)),
      ...studioTracksRef.current
        .filter((t) => studioTrackIsBeatPadsChannel(t))
        .map((t) => studioBeatPadsSessionForTrack(t as Se2BeatPadsTrack)),
      warmupStudioEditor2TrackMidiInstruments(ctx, studioTracksRef.current, (ti) => {
        const stripBus = midiPreviewBusRef.current;
        if (!stripBus) return null;
        return (
          getStudioMixerStripInput(ti) ??
          se2TrackPlaybackInput(
            ctx,
            stripBus,
            ti,
            trackFxSlotsRef.current[ti] ?? emptyMixerFxSlots(),
            trackInsertFxRacksRef.current[ti] ?? defaultStudioTrackInsertFxRack(),
            bpmRef.current,
            masterOut ?? ctx.destination,
          )
        );
      }),
    ]);
    muteMetro();
    cancelArrangerPreviewScheduling();
    resetStudioMixerMeterBallistics();
    resetStudioMixerMeterPeaks();
    transportPlayStartPerfMsRef.current = performance.now();
    /* Resume exactly where Stop parked — no quarter-grid snap on Play. */
    const resumeBeat = Math.max(0, Math.min(totalBeatsRef.current, cursorBeatRef.current));
    cursorBeatRef.current = resumeBeat;
    originBeatRef.current = resumeBeat;
    nextMetroKRef.current = Math.floor(resumeBeat);
    displayBeatRef.current = resumeBeat;
    midiPreviewLoopLapRef.current = 0;
    lastMetroLoopLapRef.current = 0;
    lastCompositorLoopLapRef.current = -1;
    midiPreviewScheduledRef.current.clear();
    midiHardwareScheduledRef.current.clear();
    /*
     * Light follow origin + scroll only — do NOT paint the full grid here.
     * If Stop parked a follow translate, keep scrollLeft + CSS transform and resume
     * from that frame (rewriting scroll here reintroduces the Stop/Play grid jerk).
     */
    const scrollEl = timelineHScrollRef.current;
    const zPlay = timelineZoomRef.current;
    const bpbPlay = beatsPerBarRef.current;
    const ppbPlay = ppbAtZoom(zPlay, bpbPlay);
    const clientW = scrollEl?.clientWidth ?? 0;
    const pinPx = clientW * TIMELINE_FOLLOW_PIN_RATIO;
    const linePx = resumeBeat * ppbPlay;
    const maxSl = Math.max(0, TOTAL_WIDTH_PX * zPlay - clientW);
    const parkedFollow = timelineFollowParkedTransformRef.current;
    let virtScroll: number;
    if (parkedFollow) {
      virtScroll = Math.max(
        0,
        timelineFollowTransformOriginRef.current + timelineFollowLastOffsetRef.current,
      );
      timelineFollowParkedTransformRef.current = false;
      timelineProgrammaticScrollRef.current = true;
      /* origin stays; launchWapiAnims rebuilds follow from the same offset. */
    } else {
      virtScroll = Math.min(maxSl, Math.max(0, linePx - pinPx));
      timelineFollowTransformOriginRef.current = virtScroll;
      timelineFollowLastOffsetRef.current = 0;
      timelineProgrammaticScrollRef.current = true;
      const committed = Math.max(0, Math.round(virtScroll));
      if (scrollEl) scrollEl.scrollLeft = committed;
      const rulerEl = timelineRulerHScrollRef.current;
      const barEl = timelineHBarRef.current;
      if (rulerEl) rulerEl.scrollLeft = committed;
      if (barEl) barEl.scrollLeft = committed;
      clearTimelineFollowStripTransform(
        timelineStripRef.current,
        timelineRulerStripRef.current,
        timelineFollowContentRef.current,
      );
    }
    if (clientW > 0) {
      /* Do not pin on Play — let the playhead glide to the pin line while the grid
       * is still; animationTick locks it once follow offset engages. */
      positionTimelinePlayheadGroup(
        playheadGroupRef.current,
        playheadLineRef.current,
        resumeBeat,
        zPlay,
        bpbPlay,
        parkedFollow
          ? (timelineHScrollRef.current?.scrollLeft ?? 0)
          : Math.max(0, Math.round(virtScroll)),
        null,
      );
      timelineFollowPinAppliedRef.current = false;
      timelineEdgeFollowActiveRef.current = true;
      timelineFollowPinScreenXRef.current = pinPx;
    }
    /*
     * Arm audio + compositor clocks together AFTER light DOM work so sessionStart is
     * not stale when WAAPI.play() and refill run in the same turn.
     */
    const tCapture = audioNow(ctx);
    sessionStartRef.current = tCapture + AUDIO_START_FLOOR_SEC;
    schedAnchorTimeRef.current = tCapture;
    schedAnchorPerfRef.current = performance.now();
    perfSessionStartMsRef.current = performance.now() + AUDIO_START_FLOOR_SEC * 1000;
    /* Compositor playhead + audio refill in one arm — playhead must not lag the music. */
    launchWapiAnims(resumeBeat, true);
    runningRef.current = true;
    setRunning(true);
    unmuteMetro();
    /*
     * Fill the audio queue NOW, while ctx.currentTime ≈ tCapture.
     * Without this, the first refill happens 25 ms later (setInterval) by which time
     * ctx.currentTime has advanced, pushing beat-0's click late for the first bar.
     */
    refillMetronome(ctx, tCapture);
    refillMidiPreview(ctx, tCapture);
    refillAudioPreview(ctx, tCapture);
    if (isScreenActiveRef.current) paintTransport();
    /* Forward waveform window — after playhead/audio are armed so Play never hitch-stalls WAAPI. */
    queueMicrotask(() => {
      if (!runningRef.current) return;
      syncTimelineGridFollowAhead(zPlay, virtScroll);
    });
    void warmupPromise.then(() => {
      if (!runningRef.current) return;
      const c = ctxRef.current;
      if (!c || c.state === 'closed') return;
      const t = audioNow(c);
      refillMidiPreview(c, t);
      refillAudioPreview(c, t);
    });
    } finally {
      transportArmingRef.current = false;
    }
  }, [
    cancelArrangerPreviewScheduling,
    ensureCtx,
    muteMetro,
    unmuteMetro,
    paintTransport,
    launchWapiAnims,
    refillAudioPreview,
    refillMetronome,
    refillMidiPreview,
    primeSe2MixerStripRoutes,
    studioDrumSessionForTrack,
    studioBeatPadsSessionForTrack,
    syncTimelineGridFollowAhead,
  ]);

  /**
   * Live compositor playhead beat (WAAPI). Used on Stop/Pause so we freeze exactly where
   * the line is — not a stale cursorBeatRef / origin snap.
   */
  const readVisualPlayheadBeat = useCallback((): number => {
    const tb = totalBeatsRef.current;
    const wapiAnim = playheadWapiRef.current;
    if (!wapiAnim || wapiAnim.playState === 'idle') {
      return Math.max(0, Math.min(tb, cursorBeatRef.current));
    }
    const animMs = Number(wapiAnim.currentTime ?? 0);
    const bpmUsed = Math.max(1e-9, wapiBpmRef.current);
    const seg = wapiSegLoopRef.current;
    const loopEndBeat = loopEndBeatRef.current;
    const loopStart = loopStartBeatRef.current;

    const seamless =
      seg.seamlessLoop &&
      loopOnRef.current &&
      seg.active &&
      loopEndBeat > loopStart &&
      loopEndBeatRef.current === seg.loopEndBeat &&
      loopStartBeatRef.current === seg.loopStartBeat;

    let b: number;
    if (seamless) {
      const d = Math.max(1e-9, seg.durMs);
      const span = seg.loopEndBeat - seg.loopStartBeat;
      const phaseMs = ((animMs % d) + d) % d;
      b = seg.loopStartBeat + (phaseMs / d) * span;
    } else if (seg.active && loopOnRef.current) {
      const d = Math.max(1e-9, seg.durMs);
      const tClamped = Math.max(0, Math.min(seg.durMs, animMs));
      const span = seg.loopEndBeat - seg.loopStartBeat;
      b = Math.min(
        seg.loopEndBeat,
        Math.max(seg.loopStartBeat, seg.loopStartBeat + (tClamped / d) * span),
      );
    } else {
      b = Math.max(0, Math.min(tb, (animMs / 1000) * (bpmUsed / 60)));
    }
    return Math.max(0, Math.min(tb, b));
  }, []);

  const pauseTransport = useCallback(() => {
    cancelPrecountSession();
    /*
     * Stop without grid jerk:
     * Freeze the follow strip translate in place (do NOT convert to scrollLeft).
     * Park the playhead on top of that frozen frame, then kill audio.
     */
    const pauseBeat = readVisualPlayheadBeat();
    const followOff = readTimelineFollowWapiOffset();
    if (followOff != null) timelineFollowLastOffsetRef.current = followOff;

    runningRef.current = false;
    setRunning(false);
    recordingRef.current = false;
    setRecording(false);
    transportPlayStartPerfMsRef.current = 0;
    cursorBeatRef.current = pauseBeat;
    displayBeatRef.current = pauseBeat;
    originBeatRef.current = pauseBeat;

    const z = timelineZoomRef.current;
    const bpb = beatsPerBarRef.current;
    const ppbStop = ppbAtZoom(z, bpb);
    const phStop = playheadGroupRef.current;
    /* Bake playhead at current beat (same pixels as running WAAPI). */
    if (phStop) {
      const seekX = pauseBeat * ppbStop - PLAYHEAD_GRIP_W_PX / 2;
      phStop.style.transform = `translate3d(${seekX}px, 0, 0)`;
      phStop.style.left = '0px';
    }
    positionPianoPlayhead(pianoPlayheadRef.current, pauseBeat, z, bpb);

    /* Freeze grid translate — no scrollLeft rewrite (that was the Stop jerk). */
    freezeTimelineFollowForStop();
    /*
     * Transport rAF stops here — repaint at the parked virtual scroll so a loop-wrap
     * canvas window does not leave bars before the braces blank until the next seek.
     */
    const parkedVirt = Math.max(
      0,
      Math.round(timelineFollowTransformOriginRef.current + timelineFollowLastOffsetRef.current),
    );
    syncTimelineGridFollowAhead(z, parkedVirt);

    /* Content-space park while frozen strip translate still applied — same screen pixels. */
    positionTimelinePlayheadGroup(
      playheadGroupRef.current,
      playheadLineRef.current,
      pauseBeat,
      z,
      bpb,
      timelineHScrollRef.current?.scrollLeft ?? 0,
    );
    positionPianoPlayhead(pianoPlayheadRef.current, pauseBeat, z, bpb);

    /* Cancel playhead/timing clocks only — leave parked strip CSS transform alone. */
    playheadWapiRef.current?.cancel();
    playheadWapiRef.current = null;
    pianoPhWapiRef.current?.cancel();
    pianoPhWapiRef.current = null;
    playheadVisibleWapiRef.current?.cancel();
    playheadVisibleWapiRef.current = null;
    loopPlayheadVisibleWapiRef.current?.cancel();
    loopPlayheadVisibleWapiRef.current = null;
    playheadGroupRef.current?.getAnimations().forEach((a) => a.cancel());
    loopPlayheadGroupRef.current?.getAnimations().forEach((a) => a.cancel());
    playheadWapiTimingRef.current?.getAnimations().forEach((a) => a.cancel());
    pianoPlayheadRef.current?.getAnimations().forEach((a) => a.cancel());
    cancelLiveRecordClipWapi();

    muteMetro();
    cancelScheduledMetroNodes();
    cancelArrangerPreviewScheduling();

    /*
     * Clear held peaks + ignore late worklet posts, then decay-only ballistics.
     * Do NOT zero ballistics here — that caused drop→jump when a stale peak arrived.
     * Strip VUs are worklet-only after Stop (no analyser merge).
     */
    prepareStudioMixerMetersForStop();
    armStudioMixerMeterDecayOnly();
    setStudioMixerStripGraphPlaybackLocked(false);

    const ctx = ctxRef.current;
    if (!ctx || ctx.state === 'closed') {
      updateReadouts(pauseBeat, true);
      return;
    }
    /* Timing clocks only — must not clear parked strip transform. */
    launchWapiAnims(pauseBeat, false);
    updateReadouts(pauseBeat, true);
  }, [
    cancelArrangerPreviewScheduling,
    cancelLiveRecordClipWapi,
    cancelPrecountSession,
    freezeTimelineFollowForStop,
    muteMetro,
    cancelScheduledMetroNodes,
    launchWapiAnims,
    readTimelineFollowWapiOffset,
    readVisualPlayheadBeat,
    syncTimelineGridFollowAhead,
    updateReadouts,
  ]);

  const applySe2SongFile = useCallback(
    async (file: ReturnType<typeof parseDaMusicBoxSongFile>, handle: FileSystemFileHandle | null) => {
      if (runningRef.current) pauseTransport();

      const tracks = se2AssignMissingLaneNumbers(
        normalizeSe2SessionTracks(file.session.tracks) as MockMusioTrack[],
      );
      const arrays = buildSe2MixerArraysFromSnapshot(tracks, file.mixer, MAX_STUDIO_TRACKS);
      const sess = file.session;

      studioAudioBuffersRef.current.clear();
      audioPreviewScheduledRef.current.clear();
      stopScheduledPreviewAudioClips(scheduledPreviewAudioClipsRef.current);
      gridCacheRef.current = null;

      const ctx = await ensureCtx();
      await restoreSe2AudioSources(sess.audioSources, ctx, studioAudioBuffersRef.current);

      setStudioTracks(
        tracks.map((t) =>
          studioTrackIsGenoUltraSynthChannel(t) && t.genoUltraArpSyncLocked
            ? { ...t, genoUltraArpSyncLocked: false }
            : t,
        ),
      );
      setSelectedTrackIndex(clampSe2SessionSelectedTrack(sess.selectedTrackIndex, tracks.length));
      setBpm(clampSe2SessionBpm(sess.bpm));
      setLoopOn(Boolean(sess.loopOn));
      if (typeof sess.loopBars === 'number' && Number.isFinite(sess.loopBars)) {
        setLoopBars(Math.max(1, Math.min(SE2_ARRANGEMENT_BARS, Math.round(sess.loopBars))));
      }
      if (typeof sess.loopStartBeat === 'number' && Number.isFinite(sess.loopStartBeat)) {
        setLoopStartBeat(Math.max(0, sess.loopStartBeat));
      }
      if (typeof sess.loopEndBeat === 'number' && Number.isFinite(sess.loopEndBeat)) {
        setLoopEndBeat(Math.max(1, sess.loopEndBeat));
      }
      if (typeof sess.beatsPerBar === 'number' && Number.isFinite(sess.beatsPerBar)) {
        setBeatsPerBar(Math.max(2, Math.min(16, Math.round(sess.beatsPerBar))));
      }
      if (typeof sess.beatPadsMachineOpen === 'boolean') {
        setBeatPadsMachineOpen(sess.beatPadsMachineOpen);
      }
      if (typeof sess.songKeyRoot === 'number' && Number.isFinite(sess.songKeyRoot)) {
        setSongKeyRoot(Math.max(0, Math.min(11, Math.round(sess.songKeyRoot))));
      }
      if (sess.songKeyMode === 'minor' || sess.songKeyMode === 'major') {
        setSongKeyMode(sess.songKeyMode);
      }
      if (typeof sess.timelineZoom === 'number' && Number.isFinite(sess.timelineZoom)) {
        setZoom(clampStudioZoom(sess.timelineZoom));
      }
      if (typeof file.consolidateStartBar === 'number' && Number.isFinite(file.consolidateStartBar)) {
        setConsolidateStartBar(Math.max(1, Math.min(SE2_ARRANGEMENT_BARS, Math.round(file.consolidateStartBar))));
      }
      if (typeof file.consolidateEndBar === 'number' && Number.isFinite(file.consolidateEndBar)) {
        setConsolidateEndBar(Math.max(1, Math.min(SE2_ARRANGEMENT_BARS, Math.round(file.consolidateEndBar))));
      }

      setTrackVolumes(arrays.volumes);
      setTrackPans(arrays.pans);
      setTrackMutes(arrays.mutes);
      setTrackSolos(arrays.solos);
      setTrackMonos(arrays.monos);
      setMasterVolume(arrays.masterVol127);
      writeSe2StudioMixerSnapshot(file.mixer);

      writeSe2SessionSnapshot({
        tracks: snapshotStudioTracks(tracks),
        selectedTrackIndex: clampSe2SessionSelectedTrack(sess.selectedTrackIndex, tracks.length),
        bpm: clampSe2SessionBpm(sess.bpm),
        loopOn: Boolean(sess.loopOn),
        loopBars: sess.loopBars,
        loopStartBeat: sess.loopStartBeat,
        loopEndBeat: sess.loopEndBeat,
        beatsPerBar: sess.beatsPerBar,
        beatPadsMachineOpen: sess.beatPadsMachineOpen,
        songKeyRoot: sess.songKeyRoot,
        songKeyMode: sess.songKeyMode,
        timelineZoom: sess.timelineZoom,
        audioSources: sess.audioSources,
      });

      setSongName(file.songName);
      songFileHandleRef.current = handle;
      setSongFileLabel(handle?.name ?? se2SongFilenameForName(file.songName));
      setSongLastSavedAt(file.savedAt);

      cursorBeatRef.current = 0;
      displayBeatRef.current = 0;
      applyPlayheadFull(0);
      updateReadouts(0, true);
    },
    [applyPlayheadFull, ensureCtx, pauseTransport, updateReadouts],
  );

  const writeSe2SongToDisk = useCallback(
    async (handle: FileSystemFileHandle | null, fallbackDownload: boolean) => {
      setSongSaveBusy(true);
      try {
        const payload = await collectSe2SongPayload();
        const json = serializeDaMusicBoxSongFile(payload);
        if (handle) {
          await writeDaMusicBoxSongToHandle(handle, json);
          songFileHandleRef.current = handle;
          setSongFileLabel(handle.name);
        } else if (fallbackDownload) {
          downloadDaMusicBoxSongFile(json, se2SongFilenameForName(payload.songName));
        } else {
          return false;
        }
        setSongLastSavedAt(payload.savedAt);
        return true;
      } finally {
        setSongSaveBusy(false);
      }
    },
    [collectSe2SongPayload],
  );

  const saveSe2Song = useCallback(async () => {
    if (songSaveBusy || exportBusy || consolidateBusy) return;
    if (songFileHandleRef.current) {
      await writeSe2SongToDisk(songFileHandleRef.current, false);
      return;
    }
    const handle = await promptSaveDaMusicBoxSongFile(se2SongFilenameForName(songName));
    if (!handle) return;
    await writeSe2SongToDisk(handle, false);
  }, [consolidateBusy, exportBusy, songName, songSaveBusy, writeSe2SongToDisk]);

  const saveSe2SongAs = useCallback(async () => {
    if (songSaveBusy || exportBusy || consolidateBusy) return;
    const handle = await promptSaveDaMusicBoxSongFile(se2SongFilenameForName(songName));
    if (handle) {
      await writeSe2SongToDisk(handle, false);
      return;
    }
    await writeSe2SongToDisk(null, true);
  }, [consolidateBusy, exportBusy, songName, songSaveBusy, writeSe2SongToDisk]);

  const openSe2SongFromText = useCallback(
    async (text: string, handle: FileSystemFileHandle | null) => {
      const file = parseDaMusicBoxSongFile(text);
      await applySe2SongFile(file, handle);
    },
    [applySe2SongFile],
  );

  const openSe2Song = useCallback(async () => {
    if (songSaveBusy || exportBusy || consolidateBusy) return;
    const picked = await promptOpenDaMusicBoxSongFile();
    if (picked) {
      await openSe2SongFromText(picked.text, picked.handle);
      return;
    }
    songOpenInputRef.current?.click();
  }, [consolidateBusy, exportBusy, openSe2SongFromText, songSaveBusy]);

  useEffect(() => {
    if (!isScreenActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable) {
        return;
      }
      e.preventDefault();
      void saveSe2Song();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isScreenActive, saveSe2Song]);

  useEffect(() => {
    if (!isScreenActive || !songFileHandleRef.current) return;
    const id = window.setInterval(() => {
      if (songSaveBusy || exportBusy || consolidateBusy || runningRef.current) return;
      void writeSe2SongToDisk(songFileHandleRef.current, false);
    }, 45_000);
    return () => window.clearInterval(id);
  }, [consolidateBusy, exportBusy, isScreenActive, songSaveBusy, writeSe2SongToDisk, songLastSavedAt]);

  const timelineLaneBrushSegment = useCallback(
    (cx0: number, cy0: number, cx1: number, cy1: number) => {
      const brush = pianoToolRef.current;
      if (brush !== 'pencil' && brush !== 'erase') return;

      const strip = timelineStripRef.current;
      if (!strip) return;
      const rect = strip.getBoundingClientRect();
      const snap = pianoSnapEffRef.current;
      const tb = totalBeatsRef.current;
      const dur = oneCellDurationBeats(snap);

      const samplePoint = (cx: number, cy: number) => {
        const lh = trackLaneHRef.current;
        const yRel = cy - rect.top;
        if (!Number.isFinite(yRel) || yRel < 0) return null;
        const ti = Math.floor(yRel / lh);
        const trs = studioTracksRef.current;
        if (ti < 0 || ti >= trs.length) return null;
        const trLane = trs[ti]!;
        if (!studioTrackOutputsMidi(trLane)) return null;
        const yLane = yRel - ti * lh;
        const xCss = cx - rect.left;
        const beat = snapBeatToSubdivision(clientXToBeat(cx), snap, tb);
        return { ti, yLane, xCss, beat, tr: trLane };
      };

      const dx = cx1 - cx0;
      const dy = cy1 - cy0;
      const dist = Math.hypot(dx, dy);
      const stepCount = Math.min(384, Math.max(1, Math.ceil(dist / 3)));

      if (brush === 'pencil') {
        const segDone = new Set<string>();
        let lastIdx = -1;
        let lastTi = -1;

        for (let s = 0; s <= stepCount; s++) {
          const tfrac = stepCount === 0 ? 0 : s / stepCount;
          const cx = cx0 + dx * tfrac;
          const cy = cy0 + dy * tfrac;
          const pt = samplePoint(cx, cy);
          if (!pt) continue;

          const freshTr = studioTracksRef.current[pt.ti]!;
          const lh = trackLaneHRef.current;
          const pitch = pitchFromTimelineLaneY(freshTr, pt.yLane, lh);
          const cellKey = `${pt.ti}|${pitch}|${pt.beat.toFixed(4)}`;
          if (segDone.has(cellKey)) continue;
          segDone.add(cellKey);

          const working = [...freshTr.notes];
          const dup = working.some((n) => n.pitch === pitch && Math.abs(n.startBeat - pt.beat) < 1e-5);
          if (dup) continue;

          working.push({ pitch, startBeat: pt.beat, durationBeats: dur, velocity: 100 });
          working.sort((a, b) => (a.startBeat !== b.startBeat ? a.startBeat - b.startBeat : a.pitch - b.pitch));
          updateTrackNotes(pt.ti, working);
          setSelectedTrackIndex(pt.ti);
          lastTi = pt.ti;
          lastIdx = working.findIndex((n) => Math.abs(n.startBeat - pt.beat) < 1e-6 && n.pitch === pitch);
          void previewPianoPitch(pitch, 100 / 127);
        }
        if (lastIdx >= 0 && lastTi >= 0) setSelectedPianoNoteIndex(lastIdx);
        return;
      }

      for (let s = 0; s <= stepCount; s++) {
        const tfrac = stepCount === 0 ? 0 : s / stepCount;
        const cx = cx0 + dx * tfrac;
        const cy = cy0 + dy * tfrac;
        const pt = samplePoint(cx, cy);
        if (!pt) continue;
        const z = timelineZoomRef.current;
        const bpb = beatsPerBarRef.current;
        const ppb = ppbAtZoom(z, bpb);
        const freshTr = studioTracksRef.current[pt.ti]!;
        const hit = hitTimelineMidiNoteIndex(freshTr, pt.xCss, pt.yLane, ppb, trackLaneHRef.current);
        if (hit < 0) continue;
        updateTrackNotes(
          pt.ti,
          freshTr.notes.filter((_, j) => j !== hit),
        );
        setSelectedTrackIndex(pt.ti);
        setSelectedPianoNoteIndex(null);
      }
    },
    [clientXToBeat, previewPianoPitch, updateTrackNotes],
  );

  const timelineLaneSamplePoint = useCallback(
    (cx: number, cy: number) => {
      const strip = timelineStripRef.current;
      if (!strip) return null;
      const rect = strip.getBoundingClientRect();
      const lh = trackLaneHRef.current;
      const yRel = cy - rect.top;
      if (!Number.isFinite(yRel) || yRel < 0) return null;
      if (!Number.isFinite(yRel) || yRel < 0) return null;
      const ti = Math.floor(yRel / lh);
      const trs = studioTracksRef.current;
      if (ti < 0 || ti >= trs.length) return null;
      const trLane = trs[ti]!;
      if (!studioTrackOutputsMidi(trLane)) return null;
      const yLane = yRel - ti * lh;
      const snap = pianoSnapEffRef.current;
      const tb = totalBeatsRef.current;
      const beat = snapBeatToSubdivision(clientXToBeat(cx), snap, tb);
      const pitch = pitchFromTimelineLaneY(trLane, yLane, lh);
      return { ti, beat, pitch };
    },
    [clientXToBeat],
  );

  const beginTimelinePencilStroke = useCallback(
    (clientX: number, clientY: number) => {
      const pt = timelineLaneSamplePoint(clientX, clientY);
      if (!pt) return;
      const snap = pianoSnapEffRef.current;
      const tb = totalBeatsRef.current;
      const cellDur = oneCellDurationBeats(snap);
      const tr = studioTracksRef.current[pt.ti]!;
      const existingIdx = tr.notes.findIndex(
        (n) => n.pitch === pt.pitch && Math.abs(n.startBeat - pt.beat) < 1e-5,
      );
      if (existingIdx >= 0) {
        timelinePencilStrokeRef.current = {
          active: true,
          mode: 'line',
          trackIndex: pt.ti,
          anchorBeat: tr.notes[existingIdx]!.startBeat,
          anchorPitch: pt.pitch,
          strokeNoteIdx: existingIdx,
        };
        setSelectedTrackIndex(pt.ti);
        setSelectedPianoNoteIndex(existingIdx);
        return;
      }
      const nu: MockMidiNote = {
        pitch: pt.pitch,
        startBeat: pt.beat,
        durationBeats: cellDur,
        velocity: 100,
      };
      const working = [...tr.notes, nu].sort((a, b) =>
        a.startBeat !== b.startBeat ? a.startBeat - b.startBeat : a.pitch - b.pitch,
      );
      const idx = working.findIndex(
        (n) => n.pitch === nu.pitch && Math.abs(n.startBeat - nu.startBeat) < 1e-6,
      );
      updateTrackNotes(pt.ti, working);
      setSelectedTrackIndex(pt.ti);
      setSelectedPianoNoteIndex(idx >= 0 ? idx : working.length - 1);
      timelinePencilStrokeRef.current = {
        active: true,
        mode: 'line',
        trackIndex: pt.ti,
        anchorBeat: pt.beat,
        anchorPitch: pt.pitch,
        strokeNoteIdx: idx >= 0 ? idx : working.length - 1,
      };
      void previewPianoPitch(nu.pitch, nu.velocity / 127);
    },
    [previewPianoPitch, timelineLaneSamplePoint, updateTrackNotes],
  );

  const updateTimelinePencilStroke = useCallback(
    (clientX: number, clientY: number) => {
      const stroke = timelinePencilStrokeRef.current;
      if (!stroke?.active) return;
      const pt = timelineLaneSamplePoint(clientX, clientY);
      if (!pt) return;
      const snap = pianoSnapEffRef.current;
      const tb = totalBeatsRef.current;

      if (pt.ti !== stroke.trackIndex) {
        stroke.mode = 'cells';
        const last = timelinePaintLastClientRef.current;
        timelineLaneBrushSegment(last?.clientX ?? clientX, last?.clientY ?? clientY, clientX, clientY);
        return;
      }

      if (stroke.mode === 'line' && pt.pitch === stroke.anchorPitch) {
        const tr = studioTracksRef.current[stroke.trackIndex]!;
        const next = applyPencilLineToNotes(
          tr.notes,
          stroke.strokeNoteIdx,
          stroke.anchorBeat,
          stroke.anchorPitch,
          pt.beat,
          snap,
          tb,
        );
        if (!next) return;
        const idx = resolvePencilStrokeNoteIndex(next, stroke.strokeNoteIdx, stroke.anchorPitch);
        timelinePencilStrokeRef.current = { ...stroke, strokeNoteIdx: idx };
        updateTrackNotes(stroke.trackIndex, next);
        setSelectedTrackIndex(stroke.trackIndex);
        setSelectedPianoNoteIndex(idx >= 0 ? idx : null);
        return;
      }

      stroke.mode = 'cells';
      const last = timelinePaintLastClientRef.current;
      timelineLaneBrushSegment(last?.clientX ?? clientX, last?.clientY ?? clientY, clientX, clientY);
    },
    [timelineLaneBrushSegment, timelineLaneSamplePoint, updateTrackNotes],
  );

  const updateAudioClipSplitMarkerAtClientX = useCallback(
    (
      clientX: number,
      trackIndex: number,
      clipId: string,
      shiftKey: boolean,
      altKey: boolean,
    ): boolean => {
      const tr = studioTracksRef.current[trackIndex];
      const clip = tr?.audioClips.find((c) => c.id === clipId);
      if (!clip) return false;
      const beatPtr = clientXToBeat(clientX);
      const markerBeat = snapTimelineAudioClipStartBeat(
        beatPtr,
        totalBeatsRef.current,
        beatsPerBarRef.current,
        pianoSnapEffRef.current,
        shiftKey,
        altKey,
      );
      if (
        markerBeat <= clip.startBeat + 1e-4 ||
        markerBeat >= clip.startBeat + clip.durationBeats - 1e-4
      ) {
        setAudioClipSplitMarkerBeat(null);
        return false;
      }
      setAudioClipSplitMarkerBeat(markerBeat);
      return true;
    },
    [clientXToBeat],
  );

  const onTimelineLanePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const strip = timelineStripRef.current;
      if (!strip) return;
      if (runningRef.current) void Promise.resolve(pauseTransport());

      const tool = pianoToolRef.current;
      const tc = studioTracksRef.current.length;
      const arrToolEarly = timelineToolRef.current;
      const pos = timelineLanePointFromStripClient(
        strip,
        e.clientX,
        e.clientY,
        tc,
        trackLaneHRef.current,
        timelineHScrollRef.current,
      );

      /* Seek on Select/Scrub arrange tools — do not require piano Select (Pencil was blocking seeks). */
      if (
        (arrToolEarly === 'select' || arrToolEarly === 'scrub') &&
        tool !== 'pencil' &&
        tool !== 'erase' &&
        !e.shiftKey
      ) {
        /*
         * Skip seek when starting clip-gain (Alt+wave or mid handle) so the playhead
         * doesn't jump while adjusting event volume.
         */
        let skipSeekForGain = false;
        if (arrToolEarly === 'select' && pos) {
          const zG = timelineZoomRef.current;
          const bpbG = beatsPerBarRef.current;
          const ppbG = ppbAtZoom(zG, bpbG);
          const lhG = trackLaneHRef.current;
          const trG = studioTracksRef.current[pos.ti];
          if (trG && se2TrackHasDraggableAudioClips(trG.kind)) {
            const cid = hitTimelineAudioClipId(trG, pos.xCss, pos.yLaneLocal, ppbG, lhG);
            if (cid) {
              const onHandle = hitTimelineAudioClipGainHandle(
                trG,
                cid,
                pos.xCss,
                pos.yLaneLocal,
                ppbG,
                lhG,
              );
              if (e.altKey || onHandle) skipSeekForGain = true;
            }
          }
        }
        if (!skipSeekForGain) {
          setBeatFromScrubClientX(e.clientX, {
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            clientY: e.clientY,
          });
        }
        if (arrToolEarly === 'scrub') {
          timelinePlayheadScrubRef.current = { active: true };
          scrubbingRef.current = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* */
          }
          return;
        }
        if (!pos) return;
      }

      if (!pos) return;

      if (tool === 'pencil') {
        if (!studioTrackOutputsMidi(studioTracksRef.current[pos.ti])) return;
        timelinePaintLastClientRef.current = { clientX: e.clientX, clientY: e.clientY };
        beginTimelinePencilStroke(e.clientX, e.clientY);
        timelinePaintToolRef.current = tool;
        timelinePaintDragRef.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
        return;
      }

      if (tool === 'erase') {
        if (!studioTrackOutputsMidi(studioTracksRef.current[pos.ti])) {
          const eraseTr = studioTracksRef.current[pos.ti];
          const zE = timelineZoomRef.current;
          const bpbE = beatsPerBarRef.current;
          const ppbE = ppbAtZoom(zE, bpbE);
          const lhE = trackLaneHRef.current;
          if (se2TrackIsAudioClipLane(eraseTr?.kind)) {
            const audioClipId = hitTimelineAudioClipId(eraseTr, pos.xCss, pos.yLaneLocal, ppbE, lhE);
            if (audioClipId) {
              const clip = eraseTr.audioClips.find((c) => c.id === audioClipId);
              if (clip) {
                const beatPtr = clientXToBeat(e.clientX);
                const tb = totalBeatsRef.current;
                const markerBeat = snapTimelineAudioClipStartBeat(
                  beatPtr,
                  tb,
                  bpbE,
                  pianoSnapEffRef.current,
                  e.shiftKey,
                  false,
                );
                if (
                  markerBeat > clip.startBeat + 1e-4 &&
                  markerBeat < clip.startBeat + clip.durationBeats - 1e-4
                ) {
                  splitTimelineAudioClipAtBeat(pos.ti, audioClipId, markerBeat);
                }
              }
            }
          }
          return;
        }
        timelinePaintLastClientRef.current = { clientX: e.clientX, clientY: e.clientY };
        timelineLaneBrushSegment(e.clientX, e.clientY, e.clientX, e.clientY);
        timelinePaintToolRef.current = tool;
        timelinePaintDragRef.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
        return;
      }

      const arrTool = timelineToolRef.current;

      if (arrTool === 'slice') {
        const zSl = timelineZoomRef.current;
        const bpbSl = beatsPerBarRef.current;
        const ppbSl = ppbAtZoom(zSl, bpbSl);
        const lhSl = trackLaneHRef.current;
        const sliceTr = studioTracksRef.current[pos.ti]!;
        if (se2TrackHasDraggableAudioClips(sliceTr.kind)) {
          const audioClipId = hitTimelineAudioClipId(sliceTr, pos.xCss, pos.yLaneLocal, ppbSl, lhSl);
          if (audioClipId) {
            clearSelectedPianoNotes();
            setSelectedTrackIndex(pos.ti);
            setSelectedTimelineAudioClip({ trackIndex: pos.ti, clipId: audioClipId });
            timelineAudioSliceDragRef.current = {
              active: true,
              trackIndex: pos.ti,
              clipId: audioClipId,
            };
            updateAudioClipSplitMarkerAtClientX(
              e.clientX,
              pos.ti,
              audioClipId,
              e.shiftKey,
              e.altKey,
            );
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* */
            }
            return;
          }
        }
        setSelectedTrackIndex(pos.ti);
        setBeatFromScrubClientX(e.clientX, {
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          clientY: e.clientY,
        });
        return;
      }

      setSelectedTrackIndex(pos.ti);
      const z = timelineZoomRef.current;
      const bpb = beatsPerBarRef.current;
      const ppb = ppbAtZoom(z, bpb);
      const tr = studioTracksRef.current[pos.ti]!;
      const lh = trackLaneHRef.current;

      const audioClipId = se2TrackHasDraggableAudioClips(tr.kind)
        ? hitTimelineAudioClipId(tr, pos.xCss, pos.yLaneLocal, ppb, lh)
        : null;
      if (audioClipId && arrTool === 'select') {
        const clip = tr.audioClips.find((c) => c.id === audioClipId);
        if (clip) {
          clearSelectedPianoNotes();
          setSelectedTimelineAudioClip({ trackIndex: pos.ti, clipId: audioClipId });
          const beatPtr = clientXToBeat(e.clientX);
          const edgeMode =
            hitTimelineAudioClipDragMode(tr, audioClipId, pos.xCss, ppb, lh) ?? 'move';
          const onGainHandle = hitTimelineAudioClipGainHandle(
            tr,
            audioClipId,
            pos.xCss,
            pos.yLaneLocal,
            ppb,
            lh,
          );
          const dragMode: 'move' | 'resize-left' | 'resize-right' | 'gain' =
            edgeMode === 'move' && (e.altKey || onGainHandle) ? 'gain' : edgeMode;
          const onAlignEdge =
            se2TrackIsTrackAlign(tr.kind) &&
            (dragMode === 'resize-left' || dragMode === 'resize-right');
          const alignBuf = studioAudioBuffersRef.current.get(clip.sourceId);
          const alignAnchorRate =
            alignBuf != null
              ? clip.alignWallStretchRate ??
                se2TrackAlignClipStretchRateFromClip(clip, alignBuf.duration, bpmRef.current)
              : 1;
          timelineAudioClipDragRef.current = {
            active: true,
            mode: dragMode,
            sourceTrackIndex: pos.ti,
            targetTrackIndex: pos.ti,
            clipId: audioClipId,
            beatPtrDown: beatPtr,
            anchorStart: clip.startBeat,
            anchorEnd: clip.startBeat + clip.durationBeats,
            anchorSourceOffset: se2AudioClipSourceOffsetBeats(clip),
            durationBeats: clip.durationBeats,
            startClientX: e.clientX,
            startClientY: e.clientY,
            dragCommitted: dragMode !== 'move',
            alignEdgeStretch: onAlignEdge ? e.shiftKey : undefined,
            alignAnchorStretchRate: onAlignEdge ? alignAnchorRate : undefined,
            anchorGainDb: dragMode === 'gain' ? clampSe2ClipGainDb(clip.gainDb ?? 0) : undefined,
          };
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* */
          }
          return;
        }
      }

      const dm = hitTimelineMidiNoteDragMode(tr, pos.xCss, pos.yLaneLocal, ppb, lh);
      const stripY = pos.ti * lh + pos.yLaneLocal;
      if (!dm) {
        clearSelectedTimelineAudioClip();
        if (!studioTrackOutputsMidi(tr)) {
          setSelectedTrackIndex(pos.ti);
          setSelectedPianoNoteIndex(null);
          clearSelectedPianoNotes();
          return;
        }
        if (!e.shiftKey) {
          setSelectedPianoNoteIndex(null);
          clearSelectedPianoNotes();
          return;
        }
        const priorSelection =
          pos.ti === selectedTrackIndexRef.current ? selectedPianoIdxSetRef.current : new Set<number>();
        const additive = e.metaKey || e.ctrlKey;
        timelineMarqueeRef.current = {
          active: true,
          trackIndex: pos.ti,
          startX: pos.xCss,
          startY: stripY,
          curX: pos.xCss,
          curY: stripY,
          additive,
          baseSelection: additive ? new Set(priorSelection) : new Set(),
        };
        setSelectedTrackIndex(pos.ti);
        if (!additive) clearSelectedPianoNotes();
        setTimelineMarqueeBox({ left: pos.xCss, top: stripY, width: 0, height: 0 });
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
        return;
      }
      clearSelectedTimelineAudioClip();
      const priorSelection =
        pos.ti === selectedTrackIndexRef.current ? selectedPianoIdxSetRef.current : new Set<number>();
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      let activeSelection: Set<number>;
      if (additive) {
        activeSelection = new Set(priorSelection);
        if (activeSelection.has(dm.index)) activeSelection.delete(dm.index);
        else activeSelection.add(dm.index);
        togglePianoNoteSelection(dm.index);
      } else if (priorSelection.has(dm.index) && pos.ti === selectedTrackIndexRef.current) {
        activeSelection = new Set(priorSelection);
      } else {
        activeSelection = new Set([dm.index]);
        selectOnlyPianoNote(dm.index);
      }
      setSelectedTrackIndex(pos.ti);
      const n = tr.notes[dm.index];
      if (!n) return;
      const beatPtr = clientXToBeat(e.clientX);
      const resize = dm.mode !== 'move';
      const dragSnapshots =
        !resize && activeSelection.has(dm.index)
          ? [...activeSelection]
              .filter((i) => i >= 0 && i < tr.notes.length)
              .sort((a, b) => a - b)
              .map((i) => ({
                idx: i,
                startBeat: tr.notes[i]!.startBeat,
                pitch: tr.notes[i]!.pitch,
                durationBeats: tr.notes[i]!.durationBeats,
              }))
          : [
              {
                idx: dm.index,
                startBeat: n.startBeat,
                pitch: n.pitch,
                durationBeats: n.durationBeats,
              },
            ];
      timelineMidiDragRef.current = {
        active: true,
        mode: dm.mode,
        trackIndex: pos.ti,
        noteIndex: dm.index,
        beatPtrDown: beatPtr,
        anchorStart: n.startBeat,
        anchorEnd: n.startBeat + n.durationBeats,
        anchorPitch: n.pitch,
        lanePtrDown: pos.yLaneLocal,
        selectedSnapshot: resize ? [] : dragSnapshots,
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
    },
    [
      beginTimelinePencilStroke,
      clearSelectedPianoNotes,
      clearSelectedTimelineAudioClip,
      clientXToBeat,
      pauseTransport,
      selectOnlyPianoNote,
      splitTimelineAudioClipAtBeat,
      setBeatFromScrubClientX,
      timelineLaneBrushSegment,
      togglePianoNoteSelection,
      updateAudioClipSplitMarkerAtClientX,
    ],
  );

  const onTimelineLanePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (timelinePlayheadScrubRef.current.active) {
        setBeatFromScrubClientX(e.clientX, {
          snap: e.altKey ? 'free' : e.shiftKey ? 'bar' : 'free',
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          clientY: e.clientY,
        });
        return;
      }

      const sliceDrag = timelineAudioSliceDragRef.current;
      if (sliceDrag.active) {
        updateAudioClipSplitMarkerAtClientX(
          e.clientX,
          sliceDrag.trackIndex,
          sliceDrag.clipId,
          e.shiftKey,
          e.altKey,
        );
        return;
      }

      const ad = timelineAudioClipDragRef.current;
      if (ad.active) {
        const strip = timelineStripRef.current;
        if (!strip) return;
        const tc = studioTracksRef.current.length;
        const lh = trackLaneHRef.current;
        const pos = timelineLanePointFromStripClient(strip, e.clientX, e.clientY, tc, lh, timelineHScrollRef.current);
        if (!pos) return;

        if (ad.mode === 'move' && !ad.dragCommitted) {
          const dx = Math.abs(e.clientX - ad.startClientX);
          const dy = Math.abs(e.clientY - ad.startClientY);
          if (dx < 4 && dy < 4) return;
          timelineAudioClipDragRef.current = { ...ad, dragCommitted: true };
        }

        const live = timelineAudioClipDragRef.current;

        if (live.mode === 'gain') {
          setAudioClipDropHoverTrackIndex(null);
          const dy = e.clientY - live.startClientY;
          /* Up = louder (negative screen Y). */
          const nextDb = clampSe2ClipGainDb(
            (live.anchorGainDb ?? 0) - dy * SE2_CLIP_GAIN_DB_PER_PX,
          );
          patchTimelineAudioClipGain(live.sourceTrackIndex, live.clipId, nextDb);
          return;
        }

        const beatPtr = clientXToBeat(e.clientX);
        const tb = totalBeatsRef.current;
        const bpb = beatsPerBarRef.current;
        const rawDelta = beatPtr - live.beatPtrDown;
        const snapSub = pianoSnapEffRef.current;
        let targetTi = live.sourceTrackIndex;
        const hoverTr = studioTracksRef.current[pos.ti];
        if (hoverTr && se2TrackCanReceiveAudioClipDrag(hoverTr.kind)) {
          targetTi = pos.ti;
        }

        if (live.mode === 'resize-right') {
          setAudioClipDropHoverTrackIndex(null);
          let newEnd = snapTimelineAudioClipStartBeat(
            live.anchorEnd + rawDelta,
            tb,
            bpb,
            snapSub,
            live.alignEdgeStretch === true ? true : e.shiftKey,
            e.altKey,
          );
          newEnd = Math.max(
            live.anchorStart + SE2_MIN_AUDIO_CLIP_DURATION_BEATS,
            Math.min(tb, newEnd),
          );
          let newDur = newEnd - live.anchorStart;
          const dragTr = studioTracksRef.current[live.sourceTrackIndex];
          const dragClip = dragTr?.audioClips.find((c) => c.id === live.clipId);
          const dragBuf = dragClip ? studioAudioBuffersRef.current.get(dragClip.sourceId) : null;
          const spbDrag = 60 / Math.max(1, bpmRef.current);
          if (live.alignEdgeStretch === true) {
            moveTimelineAudioClip(live.sourceTrackIndex, live.clipId, targetTi, {
              startBeat: live.anchorStart,
              durationBeats: newDur,
              sourceOffsetBeats: live.anchorSourceOffset,
              alignWallStretchRate: undefined,
            });
            return;
          }
          if (dragTr && se2TrackIsTrackAlign(dragTr.kind) && dragBuf && live.alignAnchorStretchRate) {
            const rate = live.alignAnchorStretchRate;
            newDur = Math.min(
              newDur,
              se2TrackAlignMaxDurationBeatsAtLockedRate(
                dragBuf.duration,
                live.anchorSourceOffset * spbDrag,
                rate,
                bpmRef.current,
              ),
            );
            moveTimelineAudioClip(live.sourceTrackIndex, live.clipId, targetTi, {
              startBeat: live.anchorStart,
              durationBeats: newDur,
              sourceOffsetBeats: live.anchorSourceOffset,
              alignWallStretchRate: rate,
            });
            return;
          }
          moveTimelineAudioClip(live.sourceTrackIndex, live.clipId, targetTi, {
            startBeat: live.anchorStart,
            durationBeats: newDur,
            sourceOffsetBeats: live.anchorSourceOffset,
          });
          return;
        }

        if (live.mode === 'resize-left') {
          setAudioClipDropHoverTrackIndex(null);
          let newStart = snapTimelineAudioClipStartBeat(
            live.anchorStart + rawDelta,
            tb,
            bpb,
            snapSub,
            live.alignEdgeStretch === true ? true : e.shiftKey,
            e.altKey,
          );
          newStart = Math.max(
            0,
            Math.min(live.anchorEnd - SE2_MIN_AUDIO_CLIP_DURATION_BEATS, newStart),
          );
          const delta = newStart - live.anchorStart;
          const newDur = live.anchorEnd - newStart;
          const dragTr = studioTracksRef.current[live.sourceTrackIndex];
          const dragClip = dragTr?.audioClips.find((c) => c.id === live.clipId);
          const dragBuf = dragClip ? studioAudioBuffersRef.current.get(dragClip.sourceId) : null;
          if (live.alignEdgeStretch === true) {
            moveTimelineAudioClip(live.sourceTrackIndex, live.clipId, targetTi, {
              startBeat: newStart,
              durationBeats: newDur,
              sourceOffsetBeats: 0,
              alignWallStretchRate: undefined,
            });
            return;
          }
          let sourceOffsetBeats = live.anchorSourceOffset + delta;
          if (
            dragTr &&
            dragClip &&
            dragBuf &&
            se2TrackIsTrackAlign(dragTr.kind) &&
            live.alignAnchorStretchRate
          ) {
            sourceOffsetBeats =
              live.anchorSourceOffset +
              se2TrackAlignSourceOffsetBeatDelta(delta, live.alignAnchorStretchRate);
            moveTimelineAudioClip(live.sourceTrackIndex, live.clipId, targetTi, {
              startBeat: newStart,
              durationBeats: newDur,
              sourceOffsetBeats,
              alignWallStretchRate: live.alignAnchorStretchRate,
            });
            return;
          }
          moveTimelineAudioClip(live.sourceTrackIndex, live.clipId, targetTi, {
            startBeat: newStart,
            durationBeats: newDur,
            sourceOffsetBeats,
          });
          return;
        }

        let newStart = snapTimelineAudioClipStartBeat(
          live.anchorStart + rawDelta,
          tb,
          bpb,
          snapSub,
          e.shiftKey,
          e.altKey,
        );
        newStart = Math.max(0, Math.min(tb - live.durationBeats, newStart));

        setAudioClipDropHoverTrackIndex(
          targetTi !== live.sourceTrackIndex ? targetTi : null,
        );

        moveTimelineAudioClip(live.sourceTrackIndex, live.clipId, targetTi, {
          startBeat: newStart,
          durationBeats: live.durationBeats,
          sourceOffsetBeats: live.anchorSourceOffset,
        });
        if (targetTi !== live.sourceTrackIndex) {
          timelineAudioClipDragRef.current = {
            ...timelineAudioClipDragRef.current,
            sourceTrackIndex: targetTi,
            targetTrackIndex: targetTi,
          };
        }
        return;
      }

      if (timelineMarqueeRef.current.active) {
        const m = timelineMarqueeRef.current;
        const strip = timelineStripRef.current;
        if (!strip) return;
        const tc = studioTracksRef.current.length;
        const lh = trackLaneHRef.current;
        const pos = timelineLanePointFromStripClient(strip, e.clientX, e.clientY, tc, lh, timelineHScrollRef.current);
        const stripY = pos ? pos.ti * lh + pos.yLaneLocal : e.clientY - strip.getBoundingClientRect().top;
        const z = timelineZoomRef.current;
        const bpb = beatsPerBarRef.current;
        const ppb = ppbAtZoom(z, bpb);
        const stripW = TOTAL_WIDTH_PX * z;
        const lanesH = tc * lh;
        m.curX = pos?.xCss ?? Math.max(0, Math.min(stripW, clientXToBeat(e.clientX) * ppb));
        m.curY = stripY;
        const left = Math.max(0, Math.min(m.startX, m.curX));
        const right = Math.min(stripW, Math.max(m.startX, m.curX));
        const top = Math.max(0, Math.min(m.startY, m.curY));
        const bottom = Math.min(lanesH, Math.max(m.startY, m.curY));
        setTimelineMarqueeBox({ left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
        const trMar = studioTracksRef.current[m.trackIndex];
        if (trMar && studioTrackOutputsMidi(trMar)) {
          const hitSet = new Set(
            timelineMidiNoteIndexesInMarquee(trMar, m.trackIndex, left, right, top, bottom, ppb, lh),
          );
          const next = m.additive ? new Set([...m.baseSelection, ...hitSet]) : hitSet;
          setSelectedPianoNoteIndexes(next);
          const arr = [...next].sort((a, b) => a - b);
          setSelectedPianoNoteIndex(arr.length ? arr[arr.length - 1]! : null);
        }
        return;
      }

      const nd = timelineMidiDragRef.current;
      if (nd.active) {
        const strip = timelineStripRef.current;
        if (!strip) return;
        const rect = strip.getBoundingClientRect();
        const yRel = e.clientY - rect.top;
        if (!Number.isFinite(yRel)) {
          timelineMidiDragRef.current = {
            active: false,
            mode: 'move',
            trackIndex: -1,
            noteIndex: -1,
            beatPtrDown: 0,
            anchorStart: 0,
            anchorEnd: 0,
            anchorPitch: 60,
            lanePtrDown: 0,
            selectedSnapshot: [],
          };
          return;
        }
        const lh = trackLaneHRef.current;
        const yLane = yRel - nd.trackIndex * lh;
        const tr = studioTracksRef.current[nd.trackIndex];
        const n = tr?.notes[nd.noteIndex];
        if (!tr || !n) {
          timelineMidiDragRef.current = {
            active: false,
            mode: 'move',
            trackIndex: -1,
            noteIndex: -1,
            beatPtrDown: 0,
            anchorStart: 0,
            anchorEnd: 0,
            anchorPitch: 60,
            lanePtrDown: 0,
            selectedSnapshot: [],
          };
          return;
        }
        const yLaneClamped = Math.max(0, Math.min(lh - 1e-6, yLane));
        const beatPtr = clientXToBeat(e.clientX);
        const snap = pianoSnapEffRef.current;
        const tb = totalBeatsRef.current;

        if (nd.mode === 'move') {
          const rawDelta = beatPtr - nd.beatPtrDown;
          const pitchAtDown = pitchFromTimelineLaneY(tr, nd.lanePtrDown, lh);
          const pitchNow = pitchFromTimelineLaneY(tr, yLaneClamped, lh);
          const pitchDelta = pitchNow - pitchAtDown;
          if (nd.selectedSnapshot.length > 1) {
            let minStart = Infinity;
            let maxEnd = -Infinity;
            nd.selectedSnapshot.forEach((s) => {
              minStart = Math.min(minStart, s.startBeat + rawDelta);
              maxEnd = Math.max(maxEnd, s.startBeat + s.durationBeats + rawDelta);
            });
            const boundedDelta =
              maxEnd > tb
                ? rawDelta - (maxEnd - tb)
                : minStart < 0
                  ? rawDelta - minStart
                  : rawDelta;
            const selMap = new Map(nd.selectedSnapshot.map((s) => [s.idx, s]));
            updateTrackNotes(
              nd.trackIndex,
              tr.notes.map((ev, j) => {
                const base = selMap.get(j);
                if (!base) return ev;
                let sb = snapBeatToSubdivision(base.startBeat + boundedDelta, snap, tb);
                sb = Math.max(0, Math.min(tb - base.durationBeats, sb));
                const np = Math.max(
                  PIANO_PITCH_LO,
                  Math.min(PIANO_PITCH_HI, base.pitch + pitchDelta),
                );
                return { ...ev, startBeat: sb, pitch: np };
              }),
            );
          } else {
            let newStart = snapBeatToSubdivision(nd.anchorStart + rawDelta, snap, tb);
            newStart = Math.max(0, Math.min(tb - n.durationBeats, newStart));
            const newPitch = pitchNow;
            updateTrackNotes(
              nd.trackIndex,
              tr.notes.map((ev, j) => (j === nd.noteIndex ? { ...ev, startBeat: newStart, pitch: newPitch } : ev)),
            );
          }
        } else if (nd.mode === 'resize-right') {
          const rawDelta = beatPtr - nd.beatPtrDown;
          let newEnd = snapBeatToSubdivision(nd.anchorEnd + rawDelta, snap, tb);
          newEnd = Math.max(n.startBeat + PIANO_MIN_NOTE_DURATION_BEATS, Math.min(tb, newEnd));
          const newDur = newEnd - n.startBeat;
          updateTrackNotes(
            nd.trackIndex,
            tr.notes.map((ev, j) => (j === nd.noteIndex ? { ...ev, durationBeats: newDur } : ev)),
          );
        } else {
          const rawDelta = beatPtr - nd.beatPtrDown;
          let newStart = snapBeatToSubdivision(nd.anchorStart + rawDelta, snap, tb);
          const maxStart = nd.anchorEnd - PIANO_MIN_NOTE_DURATION_BEATS;
          newStart = Math.max(0, Math.min(maxStart, newStart));
          const newDur = nd.anchorEnd - newStart;
          updateTrackNotes(
            nd.trackIndex,
            tr.notes.map((ev, j) => (j === nd.noteIndex ? { ...ev, startBeat: newStart, durationBeats: newDur } : ev)),
          );
        }
        return;
      }

      if (!timelinePaintDragRef.current) return;
      const ptt = timelinePaintToolRef.current;
      if (ptt !== 'pencil' && ptt !== 'erase') return;
      if (ptt === 'pencil') {
        updateTimelinePencilStroke(e.clientX, e.clientY);
      } else {
        const last = timelinePaintLastClientRef.current;
        timelineLaneBrushSegment(last?.clientX ?? e.clientX, last?.clientY ?? e.clientY, e.clientX, e.clientY);
      }
      timelinePaintLastClientRef.current = { clientX: e.clientX, clientY: e.clientY };
    },
    [
      clientXToBeat,
      moveTimelineAudioClip,
      patchTimelineAudioClipGain,
      setBeatFromScrubClientX,
      timelineLaneBrushSegment,
      updateAudioClipSplitMarkerAtClientX,
      updateTimelinePencilStroke,
      updateTrackNotes,
    ],
  );

  const onTimelineLanePointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    setAudioClipDropHoverTrackIndex(null);
    timelinePlayheadScrubRef.current = { active: false };
    scrubbingRef.current = false;
    const sliceDrag = timelineAudioSliceDragRef.current;
    if (sliceDrag.active) {
      const marker = audioClipSplitMarkerBeatRef.current;
      if (marker != null) {
        splitTimelineAudioClipAtBeat(sliceDrag.trackIndex, sliceDrag.clipId, marker);
      }
      timelineAudioSliceDragRef.current = { active: false, trackIndex: -1, clipId: '' };
    }
    const audioDrag = timelineAudioClipDragRef.current;
    const audioDragTarget = audioDrag.active ? audioDrag.targetTrackIndex : -1;
    const audioDragClipId = audioDrag.active ? audioDrag.clipId : '';
    const wasGainDrag = audioDrag.active && audioDrag.mode === 'gain';
    const gainTrackIndex = wasGainDrag ? audioDrag.sourceTrackIndex : -1;
    const gainClipId = wasGainDrag ? audioDrag.clipId : '';
    timelinePaintDragRef.current = false;
    timelinePaintToolRef.current = null;
    timelinePaintLastClientRef.current = null;
    timelinePencilStrokeRef.current = null;
    timelineMarqueeRef.current.active = false;
    setTimelineMarqueeBox(null);
    timelineAudioClipDragRef.current = {
      active: false,
      mode: 'move',
      sourceTrackIndex: -1,
      targetTrackIndex: -1,
      clipId: '',
      beatPtrDown: 0,
      anchorStart: 0,
      anchorEnd: 0,
      anchorSourceOffset: 0,
      durationBeats: 0,
      startClientX: 0,
      startClientY: 0,
      dragCommitted: false,
      alignEdgeStretch: undefined,
      alignAnchorStretchRate: undefined,
      anchorGainDb: undefined,
    };
    if (wasGainDrag && runningRef.current && gainTrackIndex >= 0 && gainClipId) {
      const ctx = ctxRef.current;
      const srcTrack = studioTracksRef.current[gainTrackIndex];
      if (ctx && ctx.state !== 'closed' && srcTrack) {
        const prefix = `${srcTrack.id}:${gainClipId}:`;
        for (const key of [...audioPreviewScheduledRef.current]) {
          if (key.startsWith(prefix) || key.includes(`:${srcTrack.id}:${gainClipId}:`)) {
            audioPreviewScheduledRef.current.delete(key);
          }
        }
        stopScheduledPreviewAudioClips(scheduledPreviewAudioClipsRef.current, gainTrackIndex);
        refillAudioPreview(ctx, audioNow(ctx));
      }
    }
    timelineMidiDragRef.current = {
      active: false,
      mode: 'move',
      trackIndex: -1,
      noteIndex: -1,
      beatPtrDown: 0,
      anchorStart: 0,
      anchorEnd: 0,
      anchorPitch: 60,
      lanePtrDown: 0,
      selectedSnapshot: [],
    };
    if (audioDragTarget >= 0 && audioDragClipId) {
      setSelectedTrackIndex(audioDragTarget);
      setSelectedTimelineAudioClip({ trackIndex: audioDragTarget, clipId: audioDragClipId });
    }
    const el = e.currentTarget;
    if (typeof el.hasPointerCapture === 'function' && el.hasPointerCapture(e.pointerId)) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    }
  }, [refillAudioPreview, splitTimelineAudioClipAtBeat]);

  const onPlayheadPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (runningRef.current) pauseTransport();
      scrubbingRef.current = true;
      timelinePlayheadScrubRef.current = { active: true };
      try {
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
      setBeatFromScrubClientX(e.clientX, {
        snap: 'free',
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        clientY: e.clientY,
      });
    },
    [pauseTransport, setBeatFromScrubClientX],
  );

  const onPlayheadPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!scrubbingRef.current && !timelinePlayheadScrubRef.current.active) return;
      setBeatFromScrubClientX(e.clientX, {
        snap: e.altKey ? 'free' : e.shiftKey ? 'bar' : 'free',
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        clientY: e.clientY,
      });
    },
    [setBeatFromScrubClientX],
  );

  const onPlayheadPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    scrubbingRef.current = false;
    timelinePlayheadScrubRef.current = { active: false };
    const el = e.currentTarget as HTMLDivElement;
    if (typeof el.hasPointerCapture === 'function' && el.hasPointerCapture(e.pointerId)) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    }
  }, []);

  const onTogglePlayPause = useCallback(async () => {
    const now = performance.now();
    if (now - lastToggleMsRef.current < TOGGLE_DEBOUNCE_MS) return;
    lastToggleMsRef.current = now;
    if (isPrecountingRef.current) return;
    if (runningRef.current) {
      pauseTransport();
      return;
    }
    /* Mic armed → start capture on Play. Pre only adds count-in inside begin — never forces record alone. */
    if (recordStandbyRef.current) {
      await beginSe2RecordWithOptionalPrecountRef.current({ fromPlay: true });
      return;
    }
    await startTransport();
  }, [pauseTransport, startTransport]);

  /** Beat Pads sequencer scrub → locate SE2 playhead (when Sync SE2 is linked). */
  const seekSe2BeatFromBeatPads = useCallback(
    (beat: number) => {
      if (runningRef.current) pauseTransport();
      const tb = Math.max(0, totalBeatsRef.current);
      const b = Math.max(0, Math.min(tb, beat));
      timelineUserSeekGuardUntilRef.current = performance.now() + 1200;
      cursorBeatRef.current = b;
      displayBeatRef.current = b;
      applyPlayheadFull(b, { skipAutoScroll: true });
      updateReadouts(b, true);
    },
    [applyPlayheadFull, pauseTransport, updateReadouts],
  );

  useEffect(() => {
    if (!isScreenActive || !settings.keyboardShortcutsEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (el?.closest('[data-studio-piano-roll-keys]')) return;
      e.preventDefault();
      void onTogglePlayPause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isScreenActive, onTogglePlayPause, settings.keyboardShortcutsEnabled]);

  useEffect(() => {
    if (!isScreenActive || !running) return;
    if (!metroOn) { muteMetro(); return; }
    unmuteMetro();
    /* Scheduling is handled by the dedicated interval Ã¢â‚¬â€ no need to call refill here. */
  }, [isScreenActive, running, metroOn, muteMetro, unmuteMetro]);

  const onReturnToZero = useCallback(async () => {
    const ctx = await ensureCtx();
    if (ctx.state === 'closed') return;
    muteMetro();
    cancelArrangerPreviewScheduling();
    cursorBeatRef.current = 0;
    originBeatRef.current = 0;
    displayBeatRef.current = 0;
    nextMetroKRef.current = 0;
    if (runningRef.current) {
      const tCap = audioNow(ctx);
      sessionStartRef.current     = tCap + AUDIO_START_FLOOR_SEC;
      schedAnchorTimeRef.current  = tCap;
      schedAnchorPerfRef.current  = performance.now();
      perfSessionStartMsRef.current = performance.now() + AUDIO_START_FLOOR_SEC * 1000;
      launchWapiAnims(0, true);
      unmuteMetro();
      cancelArrangerPreviewScheduling();
    } else {
      sessionStartRef.current     = 0;
      schedAnchorTimeRef.current  = 0;
      schedAnchorPerfRef.current  = 0;
      perfSessionStartMsRef.current = 0;
      launchWapiAnims(0, false);
    }
    updateReadouts(0, !runningRef.current);
    applyPlayheadFull(0);
  }, [
    applyPlayheadFull,
    cancelArrangerPreviewScheduling,
    ensureCtx,
    launchWapiAnims,
    muteMetro,
    unmuteMetro,
    updateReadouts,
  ]);

  const finalizeSe2RecordedTake = useCallback(
    (
      trackIndex: number,
      startBeat: number,
      buffer: AudioBuffer,
      trackName: string,
      existing?: { sourceId: string; clipId: string },
    ) => {
      const sourceId =
        existing?.sourceId ??
        (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `src-${crypto.randomUUID()}`
          : `src-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
      const clipId =
        existing?.clipId ??
        (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `ac-${crypto.randomUUID()}`
          : `ac-${Date.now()}`);
      studioAudioBuffersRef.current.set(sourceId, buffer);
      invalidateSe2AudioWaveformPeaks(sourceId);
      const durBeats = audioDurationBeatsFromSeconds(buffer.duration, bpmRef.current);
      const clipName = `${trackName} take`;
      const newClip: StudioAudioClip = {
        id: clipId,
        sourceId,
        startBeat: Math.max(0, startBeat),
        durationBeats: durBeats,
        name: clipName,
      };
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== trackIndex) return t;
          /*
           * DAW-style overwrite: drop the in-progress seed clip, punch-replace every
           * existing clip that the finished take now covers (its true length is only
           * known here at stop), then drop in the finished take. Uncovered portions of
           * older clips survive as trimmed remnants; the overlapped part is replaced.
           */
          const withoutSeed = existing
            ? t.audioClips.filter((c) => c.id !== clipId)
            : t.audioClips;
          const punched = se2PunchReplaceAudioClipsUnderRange(
            withoutSeed,
            newClip.startBeat,
            newClip.durationBeats,
          );
          return { ...t, audioClips: [...punched, newClip] };
        }),
      );
      setSelectedTrackIndex(trackIndex);
      setSelectedTimelineAudioClip({ trackIndex, clipId });
      setSelectedPianoNoteIndex(null);
      setSelectedPianoNoteIndexes(new Set());
      gridCacheRef.current = null;
      syncTimelineGridNow();
      if (runningRef.current) {
        void ensureCtx().then((ctx) => {
          if (ctx) refillAudioPreview(ctx, audioNow(ctx));
        });
      }
    },
    [applyTracksMutation, ensureCtx, refillAudioPreview, syncTimelineGridNow],
  );

  const stopSe2MediaCapture = useCallback(async () => {
    if (!se2AudioRecordingActive() && !liveRecordSessionRef.current) return;
    const live = liveRecordSessionRef.current;
    live?.capture.stop();
    cancelLiveRecordClipWapi();
    const ctx = await ensureCtx();
    const result = await stopSe2AudioRecording(ctx);
    if (live) liveRecordingPeaksRef.current.delete(live.sourceId);
    liveRecordSessionRef.current = null;

    if (result) {
      finalizeSe2RecordedTake(
        result.trackIndex,
        result.startBeat,
        result.buffer,
        result.trackName,
        live ? { sourceId: live.sourceId, clipId: live.clipId } : undefined,
      );
      return;
    }

    if (live) {
      studioAudioBuffersRef.current.delete(live.sourceId);
      invalidateSe2AudioWaveformPeaks(live.sourceId);
    }
  }, [cancelLiveRecordClipWapi, ensureCtx, finalizeSe2RecordedTake]);

  /**
   * Warm vocal insert DSP after MediaRecorder is already running.
   * Never call this before transport / capture — it was the record-start hitch.
   */
  const deferSe2RecordVocalPrep = useCallback(
    (trackIndex: number, startBeatSnapped: number, deviceId: string) => {
      window.setTimeout(() => {
        if (!recordingRef.current || !liveRecordSessionRef.current) return;
        if (liveRecordSessionRef.current.trackIndex !== trackIndex) return;
        void (async () => {
          const ctx = ctxRef.current;
          const bus = midiPreviewBusRef.current;
          const tr = studioTracksRef.current[trackIndex];
          if (!ctx || ctx.state === 'closed' || !bus || !tr) return;
          const masterOut = studioMasterOutRef.current ?? ctx.destination;
          setStudioMixerStripCountHint(Math.max(1, studioTracksRef.current.length));
          if (!isStudioMixerStripGraphPlaybackLocked()) {
            ensureSe2MixerStrips(ctx, bus, masterOut);
          } else if (!getStudioMixerStripInput(trackIndex)) {
            healStudioTrackPlaybackRouteIfStale(
              ctx,
              bus,
              trackIndex,
              getStudioMixerStripCountHint(),
              masterOut,
            );
          }
          const rawFx = trackVocalFxRef.current[trackIndex] ?? STUDIO_TRACK_VOCAL_FX_DEFAULT;
          const slots = trackFxSlotsRef.current[trackIndex] ?? emptyMixerFxSlots();
          const effectiveFx = studioEffectiveTrackVocalFx(rawFx, slots);
          const rack = trackInsertFxRacksRef.current[trackIndex] ?? defaultStudioTrackInsertFxRack();
          const keyRoot = tr.a2mKeyRoot != null ? tr.a2mKeyRoot : songKeyRootRef.current;
          se2TrackPlaybackInput(
            ctx,
            bus,
            trackIndex,
            slots,
            rack,
            bpmRef.current,
            masterOut,
          );
          const preStrip = getStudioTrackInsertPreStrip(trackIndex);
          const stripIn = getStudioMixerStripInput(trackIndex);
          if (!preStrip || !stripIn) return;
          try {
            await routeStudioVocalLiveSignal({
              ctx,
              trackIndex,
              deviceId,
              preStrip,
              stripIn,
              fx: effectiveFx,
              keyRoot,
              carrierTracks: studioEditorVocoderCarrierTracks(studioTracksRef.current),
              bpm: bpmRef.current,
              clipStartBeat: startBeatSnapped,
              connectMic: false,
              slots,
              rack,
            });
          } catch (e) {
            console.warn('[SE2 Record] Live vocal insert prep failed.', e);
          }
          setStudioInputMonitorSoftMuted(true);
        })();
      }, 48);
    },
    [],
  );

  const beginSe2RecordWithOptionalPrecount = useCallback(async (opts?: { fromPlay?: boolean }) => {
    if (recordingRef.current || isPrecountingRef.current) return;
    /*
     * Hard gate: never roll transport/capture from the mic button when stopped.
     * Play passes { fromPlay: true }. Punch-in while already playing is allowed.
     */
    if (!runningRef.current && !opts?.fromPlay) {
      console.warn('[SE2 Record] Capture blocked — arm the mic, then hit Play.');
      return;
    }

    let trackIndex = findSe2RecordTargetTrackIndex(
      studioTracksRef.current,
      trackRecordArmedRef.current,
      selectedTrackIndexRef.current,
    );
    // Convenience: if nothing is armed, arm the selected audio lane (or first audio lane).
    if (trackIndex < 0) {
      const tracks = studioTracksRef.current;
      const sel = Math.max(0, Math.min(tracks.length - 1, selectedTrackIndexRef.current));
      let autoArm = tracks[sel]?.kind === 'audio' ? sel : -1;
      if (autoArm < 0) {
        for (let ti = 0; ti < tracks.length; ti++) {
          if (tracks[ti]?.kind === 'audio') {
            autoArm = ti;
            break;
          }
        }
      }
      if (autoArm < 0) {
        console.warn(
          '[SE2 Record] Add an audio track and press Record (or arm with mixer R), then try again.',
        );
        return;
      }
      setTrackRecordArmed((prev) => {
        const next = [...prev];
        next[autoArm] = true;
        trackRecordArmedRef.current = next;
        return next;
      });
      setSelectedTrackIndex(autoArm);
      trackIndex = autoArm;
    }

    const tr = studioTracksRef.current[trackIndex];
    if (!tr || tr.kind !== 'audio') return;

    /*
     * Prep mic BEFORE transport / MediaRecorder so Play does not hitch on getUserMedia
     * and the take starts on the first beat after the click (no late capture).
     */
    setStudioInputMonitorSoftMuted(true);
    const deviceId = effectiveAudioInputDeviceId(tr, settings.audioInput);
    const ctx = await ensureCtx();
    const micOk = await ensureStudioInputMonitor(ctx, deviceId);
    if (!micOk) {
      console.error('[SE2 Record] Microphone unavailable — check Settings → Audio Input.');
      setStudioInputMonitorSoftMuted(false);
      return;
    }
    const stream =
      getStudioInputMonitorStream() ??
      (window as unknown as { __daMusicStudioMicStream?: MediaStream | null }).__daMusicStudioMicStream ??
      null;
    if (!stream) {
      console.error('[SE2 Record] No mic stream after arm — cannot capture.');
      setStudioInputMonitorSoftMuted(false);
      return;
    }

    /* Count-in only when starting from stopped Play — never during punch-in. */
    if (precountEnabledRef.current && !runningRef.current) {
      precountCancelRef.current = false;
      isPrecountingRef.current = true;
      setIsPrecounting(true);
      cancelScheduledPrecountNodes();
      precountRimshotBufferRef.current = await ensureSe2PrecountRimshotBuffer(ctx);

      const result = await runSe2Precount({
        ctx,
        bpm: bpmRef.current,
        beatsPerBar: beatsPerBarRef.current,
        bars: precountBarsRef.current,
        scheduleClick: (idealT, downbeat) => playPrecountClick(ctx, idealT, downbeat),
        onBeat: (beat, total) => setPrecountBeatUi({ beat, total }),
        isCancelled: () => precountCancelRef.current,
      });

      cancelScheduledPrecountNodes();
      isPrecountingRef.current = false;
      setIsPrecounting(false);
      setPrecountBeatUi(null);

      if (result.cancelled) {
        setStudioInputMonitorSoftMuted(false);
        return;
      }
    }

    const sourceId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `src-${crypto.randomUUID()}`
        : `src-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const clipId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `ac-${crypto.randomUUID()}`
        : `ac-${Date.now()}`;
    const placeholder = ctx.createBuffer(2, Math.max(1, Math.ceil(ctx.sampleRate * 0.01)), ctx.sampleRate);
    studioAudioBuffersRef.current.set(sourceId, placeholder);
    liveRecordingPeaksRef.current.clear();

    let startBeat = cursorBeatRef.current;
    liveRecordSessionRef.current = {
      sourceId,
      clipId,
      trackIndex,
      startBeat: Math.max(0, startBeat),
      capture: new Se2LiveRecordingCapture(),
      lastUiTickMs: 0,
      previewEnabled: false,
      colorHex: tr.colorHex || '#e85d5d',
    };

    if (!runningRef.current) {
      await startTransport();
      startBeat = originBeatRef.current;
      if (liveRecordSessionRef.current) {
        liveRecordSessionRef.current.startBeat = Math.max(0, startBeat);
      }
    }

    const startBeatSnapped = Math.max(0, startBeat);
    /* KeepAlive + MediaRecorder before any React / vocal work. */
    recordingRef.current = true;
    const started = startSe2AudioRecording(stream, {
      startBeat: startBeatSnapped,
      trackIndex,
      trackName: tr.name,
    });
    if (!started) {
      liveRecordSessionRef.current?.capture.stop();
      liveRecordSessionRef.current = null;
      studioAudioBuffersRef.current.delete(sourceId);
      cancelLiveRecordClipWapi();
      setStudioInputMonitorSoftMuted(false);
      recordingRef.current = false;
      return;
    }

    launchLiveRecordClipWapi(startBeatSnapped, true);
    recordStandbyRef.current = false;
    setRecordStandby(false);
    setRecording(true);
    setSelectedTrackIndex(trackIndex);
    setSelectedTimelineAudioClip({ trackIndex, clipId });
    /* Vocal DSP after capture is rolling — keeps playhead / metro free of the hitch. */
    deferSe2RecordVocalPrep(trackIndex, startBeatSnapped, deviceId);
  }, [
    cancelLiveRecordClipWapi,
    cancelScheduledPrecountNodes,
    deferSe2RecordVocalPrep,
    ensureCtx,
    launchLiveRecordClipWapi,
    playPrecountClick,
    settings.audioInput,
    startTransport,
  ]);
  beginSe2RecordWithOptionalPrecountRef.current = beginSe2RecordWithOptionalPrecount;

  /** Ensure an audio lane is mixer-R armed; returns track index or -1. */
  const ensureSe2RecordTargetArmed = useCallback((): number => {
    let trackIndex = findSe2RecordTargetTrackIndex(
      studioTracksRef.current,
      trackRecordArmedRef.current,
      selectedTrackIndexRef.current,
    );
    if (trackIndex >= 0) return trackIndex;
    const tracks = studioTracksRef.current;
    const sel = Math.max(0, Math.min(tracks.length - 1, selectedTrackIndexRef.current));
    let autoArm = tracks[sel]?.kind === 'audio' ? sel : -1;
    if (autoArm < 0) {
      for (let ti = 0; ti < tracks.length; ti++) {
        if (tracks[ti]?.kind === 'audio') {
          autoArm = ti;
          break;
        }
      }
    }
    if (autoArm < 0) {
      console.warn(
        '[SE2 Record] Add an audio track and press Record (or arm with mixer R), then try again.',
      );
      return -1;
    }
    setTrackRecordArmed((prev) => {
      const next = [...prev];
      next[autoArm] = true;
      trackRecordArmedRef.current = next;
      return next;
    });
    setSelectedTrackIndex(autoArm);
    return autoArm;
  }, []);

  const paintTransportRecBtn = useCallback((armed: boolean, isRec: boolean) => {
    const el = transportRecBtnRef.current;
    if (!el) return;
    el.dataset.recArmed = armed && !isRec ? '1' : '0';
    el.dataset.recOn = isRec ? '1' : '0';
  }, []);

  useEffect(() => {
    paintTransportRecBtn(recordStandby, recording);
  }, [paintTransportRecBtn, recordStandby, recording]);

  const onRecordClick = useCallback(() => {
    if (recordingRef.current) {
      recordingRef.current = false;
      setRecording(false);
      recordStandbyRef.current = false;
      setRecordStandby(false);
      paintTransportRecBtn(false, false);
      return;
    }
    if (isPrecountingRef.current) return;

    /*
     * Transport mic = arm/disarm only.
     * Never start Play or MediaRecorder here — capture begins only from Play
     * when recordStandby is on (see onTogglePlayPause).
     */
    if (recordStandbyRef.current) {
      recordStandbyRef.current = false;
      setRecordStandby(false);
      paintTransportRecBtn(false, false);
      return;
    }
    if (ensureSe2RecordTargetArmed() < 0) return;
    recordStandbyRef.current = true;
    setRecordStandby(true);
    /* Paint red immediately — don't wait on the next React commit. */
    paintTransportRecBtn(true, false);
  }, [ensureSe2RecordTargetArmed, paintTransportRecBtn]);

  useEffect(() => {
    if (recording) return;
    void stopSe2MediaCapture();
  }, [recording, stopSe2MediaCapture]);

  const onStop = useCallback(() => {
    if (isPrecountingRef.current) {
      cancelPrecountSession();
      return;
    }
    if (runningRef.current) pauseTransport();
  }, [cancelPrecountSession, pauseTransport]);

  useEffect(() => {
    if (!isScreenActive) return;
    const onKey = (e: KeyboardEvent) => {
      const root = studioUiRootRef.current;
      if (!root) return;
      const t = e.target;
      if (t instanceof Element && t.closest('input, textarea, select, [contenteditable="true"], a[href]')) return;
      const ae = document.activeElement;
      const inStudioUi =
        (t instanceof Node && root.contains(t)) ||
        (ae instanceof Node && root.contains(ae)) ||
        ae === document.body ||
        ae === document.documentElement;
      if (!inStudioUi) return;
      const mod = e.metaKey || e.ctrlKey;
      const hasMidiSelection = selectedPianoIdxSetRef.current.size > 0 || selectedPianoIdxRef.current !== null;
      const hasAudioSelection = selectedTimelineAudioClipRef.current !== null;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const ti = selectedTrackIndexRef.current;
        const trKey = studioTracksRef.current[ti];
        if (hasAudioSelection) {
          e.preventDefault();
          audioDeleteSelection();
        } else if (hasMidiSelection) {
          e.preventDefault();
          midiDeleteSelection();
        } else if (trKey && se2TrackHasClearableLaneContent(trKey)) {
          e.preventDefault();
          clearTrackLaneContent(ti);
        }
        return;
      }

      if (!mod || e.repeat) return;

      if (e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) midiRedoEdit();
        else midiUndoEdit();
        return;
      }
      if (e.code === 'KeyY') {
        e.preventDefault();
        midiRedoEdit();
        return;
      }
      if (e.code === 'KeyX') {
        if (hasAudioSelection) {
          e.preventDefault();
          audioCutSelection();
          return;
        }
        if (!hasMidiSelection) return;
        e.preventDefault();
        midiCutSelection();
        return;
      }
      if (e.code === 'KeyC') {
        if (hasAudioSelection) {
          e.preventDefault();
          audioCopySelection();
          return;
        }
        if (!hasMidiSelection) return;
        e.preventDefault();
        midiCopySelection();
        return;
      }
      if (e.code === 'KeyV') {
        if (audioClipboardRef.current) {
          e.preventDefault();
          audioPasteSelection();
          return;
        }
        if (!midiClipboardRef.current?.length) return;
        e.preventDefault();
        midiPasteSelection();
        return;
      }
      if (e.code === 'KeyD') {
        if (hasAudioSelection) {
          e.preventDefault();
          audioDuplicateSelection();
          return;
        }
        if (!hasMidiSelection) return;
        e.preventDefault();
        midiDuplicateSelection();
        return;
      }
      if (e.code === 'KeyE') {
        if (hasAudioSelection) {
          e.preventDefault();
          audioSplitSelection();
          return;
        }
        if (!hasMidiSelection) return;
        e.preventDefault();
        midiSplitSelection();
        return;
      }
      if (e.code === 'KeyQ') {
        if (!hasMidiSelection) return;
        e.preventDefault();
        quantizeSelected();
        return;
      }
      if (e.code === 'ArrowUp') {
        if (!hasMidiSelection) return;
        e.preventDefault();
        transposeSelected(e.shiftKey ? 12 : 1);
        return;
      }
      if (e.code === 'ArrowDown') {
        if (!hasMidiSelection) return;
        e.preventDefault();
        transposeSelected(e.shiftKey ? -12 : -1);
        return;
      }
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        if (hasMidiSelection) return;
        if (runningRef.current) return;
        e.preventDefault();
        const step = e.shiftKey ? beatsPerBarRef.current : 1 / pianoSnapEffRef.current;
        nudgePlayheadBeats(e.code === 'ArrowLeft' ? -step : step);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    isScreenActive,
    audioCutSelection,
    audioCopySelection,
    audioPasteSelection,
    audioDuplicateSelection,
    audioSplitSelection,
    audioDeleteSelection,
    midiCutSelection,
    midiCopySelection,
    midiPasteSelection,
    midiDuplicateSelection,
    midiSplitSelection,
    midiDeleteSelection,
    clearTrackLaneContent,
    quantizeSelected,
    transposeSelected,
    nudgePlayheadBeats,
    midiUndoEdit,
    midiRedoEdit,
  ]);

  useLayoutEffect(() => {
    const tb = totalBeatsForSig(beatsPerBar);
    if (cursorBeatRef.current > tb) cursorBeatRef.current = tb;
    if (displayBeatRef.current > tb) displayBeatRef.current = tb;

    if (!isScreenActive) return;

    const c = ctxRef.current;
    const z = timelineZoomRef.current;
    const bpb = beatsPerBarRef.current;
    if (c && c.state !== 'closed' && runningRef.current) {
      syncTimelineGridNow(z);
      paintTransport();
    } else {
      displayBeatRef.current = cursorBeatRef.current;
      /* Don't re-place the playhead during a user click-seek — keeps the line under the cursor. */
      if (performance.now() >= timelineUserSeekGuardUntilRef.current) {
        /*
         * Stop-parked / follow bake: only repaint the grid at virtual scroll.
         * applyPlayheadFull would commit/clear the park (blank wave + lost Play resume).
         * Record arm → select audio track lands here via selectedTrackIndex.
         */
        if (
          timelineFollowParkedTransformRef.current
          || timelineEdgeFollowActiveRef.current
        ) {
          syncTimelineGridNow(z);
        } else {
          applyPlayheadFull(cursorBeatRef.current, { skipAutoScroll: true });
        }
      }
      updateReadouts(displayBeatRef.current, !runningRef.current);
    }
  }, [
    isScreenActive,
    beatsPerBar,
    studioTracks,
    trackLaneHeightPx,
    selectedTrackIndex,
    selectedPianoNoteIndex,
    selectedPianoNoteIndexes,
    selectedTimelineAudioClip,
    audioClipSplitMarkerBeat,
    paintTransport,
    applyPlayheadFull,
    updateReadouts,
    syncTimelineGridNow,
  ]);

  /** Unstick scrub / ruler gestures if pointer-up is lost outside the lane overlay. */
  useEffect(() => {
    if (!isScreenActive) return;
    const resetPointerGestures = () => {
      timelinePlayheadScrubRef.current = { active: false };
      scrubbingRef.current = false;
      measureRulerGestureRef.current = null;
    };
    window.addEventListener('pointerup', resetPointerGestures);
    window.addEventListener('pointercancel', resetPointerGestures);
    return () => {
      window.removeEventListener('pointerup', resetPointerGestures);
      window.removeEventListener('pointercancel', resetPointerGestures);
    };
  }, [isScreenActive]);

  useEffect(() => {
    if (!isScreenActive) return;
    if (runningRef.current) {
      /* Zoom changed while playing â€” recreate WAAPI animations with new pixel values. */
      launchWapiAnims(cursorBeatRef.current, true);
    } else {
      paintTransport();
    }
  }, [zoom, isScreenActive, paintTransport, launchWapiAnims]);

  useEffect(() => {
    if (!isScreenActive || !runningRef.current) return;
    launchWapiAnims(cursorBeatRef.current, true);
  }, [loopOn, loopStartBeat, loopEndBeat, isScreenActive, launchWapiAnims]);

  useEffect(() => {
    if (!running) return;
    const hostRaw = transportPaintHostRef.current;
    const host = hostRaw as ElementWithVfc | null;
    const vfcSupported = host !== null && typeof host.requestVideoFrameCallback === 'function';

    /* Always use plain rAF Ã¢â‚¬â€ VFC is for <video> elements only and doesn't help here. */
    const loop = (rafTime: DOMHighResTimeStamp) => {
      transportRafRef.current = 0;
      if (!runningRef.current) return;
      try {
        transportFrame(rafTime);
      } catch {
        /* */
      }
      if (runningRef.current) transportRafRef.current = requestAnimationFrame(loop);
    };
    transportRafRef.current = requestAnimationFrame(loop);
    return () => {
      if (transportRafRef.current) cancelAnimationFrame(transportRafRef.current);
    };
  }, [running, transportFrame]);

  /**
   * Dedicated audio scheduling loop Ã¢â‚¬â€ runs every 25 ms, completely separate from the RAF visual loop.
   * Keeping audio work out of RAF prevents AudioNode creation spikes from dropping animation frames.
   */
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (!runningRef.current) return;
      const c = ctxRef.current;
      if (!c || c.state === 'closed') return;
      if (c.state === 'suspended') {
        void c
          .resume()
          .then(() => {
            // Device/tab resumes can happen without visibilitychange; re-anchor + refill immediately.
            resyncSe2PreviewAfterCtxResume(c);
          })
          .catch(() => {
            /* autoplay policy */
          });
        return;
      }
      const t = audioNow(c);
      /*
       * Re-anchor the visual clock every 25 ms.
       * Converts sessionStartRef (audio/ctx.currentTime domain) Ã¢â€ â€™ performance.now() domain
       * so the RAF loop can use rafTime (vsync-aligned) without ever touching ctx.currentTime.
       * Formula: perfSessionStart = perfNow + (sessionStart_ctx - ctx.currentTime) * 1000
       */
      perfSessionStartMsRef.current = performance.now() + (sessionStartRef.current - t) * 1000;
      /* Update scheduling-domain anchor for pauseTransport's beat snapshot. */
      schedAnchorTimeRef.current = t;
      schedAnchorPerfRef.current = performance.now();

      const seamlessLoopActive =
        loopOnRef.current &&
        wapiSegLoopRef.current.seamlessLoop &&
        wapiSegLoopRef.current.active &&
        loopEndBeatRef.current > loopStartBeatRef.current;
      if (!seamlessLoopActive) {
        maybeSe2MetroLoopWrap(c, t);
      } else {
        const loopStart = loopStartBeatRef.current;
        const loopEnd = loopEndBeatRef.current;
        const span = loopEnd - loopStart;
        const sessionStart = sessionStartRef.current;
        if (span > 1e-6 && sessionStart > 0) {
          const spb = spbFromBpm(bpmRef.current);
          const beatNow =
            originBeatRef.current + Math.max(0, t - sessionStart) / spb;
          const audioLap = Math.floor((beatNow - loopStart) / span + 1e-9);
          if (
            audioLap > lastCompositorLoopLapRef.current &&
            beatNow >= loopEnd - 0.08
          ) {
            maybeSe2MetroLoopWrap(c, t);
          }
        }
      }

      refillMetronome(c, t);
      refillMidiPreview(c, t);
      refillAudioPreview(c, t);
    };
    const id = window.setInterval(tick, 25);
    /* Fire immediately so the first beat is scheduled before the first interval fires. */
    tick();
    return () => window.clearInterval(id);
  }, [running, refillAudioPreview, refillMetronome, refillMidiPreview, maybeSe2MetroLoopWrap, resyncSe2PreviewAfterCtxResume]);

  /** Resume SE2's own AudioContext after tab focus loss (transport can look "playing" while silent). */
  useEffect(() => {
    if (!isScreenActive) return;
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const ctx = ctxRef.current;
      if (!ctx || ctx.state !== 'suspended') return;
      void ctx.resume().then(() => {
        resyncSe2PreviewAfterCtxResume(ctx);
      }).catch(() => {
        /* autoplay policy */
      });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [isScreenActive, resyncSe2PreviewAfterCtxResume]);

  const transportBtnBase =
    'inline-flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7cf4c6]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0e]';

  const arrangeLaneH = clampArrangeLaneHeightPx(trackLaneHeightPx);
  const arrangeLanesH = arrangementLanesHeightPx(studioTracks.length, arrangeLaneH);

  const atTrackCap = studioTracks.length >= MAX_STUDIO_TRACKS;
  const arrangeContentH = arrangementHeightPx(studioTracks.length, arrangeLaneH);
  const timelineStripWidthPx = TOTAL_WIDTH_PX * zoom;
  const selectedTrack = studioTracks[Math.max(0, Math.min(studioTracks.length - 1, selectedTrackIndex))];
  const selectedTrackIsMidi = selectedTrack != null && studioTrackOutputsMidi(selectedTrack);

  const collapsedPianoPanelPx = useMemo(() => {
    if (pianoRollExpanded || !showPianoRoll) return pianoPanelH;
    const transportH = Math.max(PIANO_PANEL_H_MIN, viewportH - 170);
    const fromSplit = transportH * 0.68;
    return Math.max(pianoPanelH, fromSplit, defaultPianoPanelHeightPx(viewportH));
  }, [viewportH, showPianoRoll, pianoRollExpanded, pianoPanelH]);

  const selectedDrumTrack = useMemo(() => {
    const tr = studioTracks[selectedTrackIndex];
    return tr && studioTrackIsDrumChannel(tr) ? tr : null;
  }, [studioTracks, selectedTrackIndex]);

  const pianoPitchView = useMemo(() => {
    const rhythmChrome = showRhythmUi ? PIANO_RHYTHM_EDIT_CHROME_PX : 0;
    const glideBassChrome =
      showGlideBassUi && glideBassPanelOpen ? PIANO_GLIDE_BASS_EDIT_CHROME_PX : 0;
    const synthGenoChrome =
      showSynthGenoUi && synthGenoPanelOpen ? PIANO_SYNTH_GENO_EDIT_CHROME_PX : 0;
    const grooveLeadChrome =
      showGrooveLeadUi && grooveLeadPanelOpen ? PIANO_GROOVE_LEAD_EDIT_CHROME_PX : 0;
    const lab808Chrome = showLab808Ui && lab808PanelOpen ? PIANO_LAB808_EDIT_CHROME_PX : 0;
    const genoUltraChrome =
      showGenoUltraSynthUi && genoUltraSynthPanelOpen ? PIANO_GENO_ULTRA_EDIT_CHROME_PX : 0;
    const genoBassChrome =
      showGenoBassSynthUi && genoBassSynthPanelOpen ? PIANO_GENO_BASS_EDIT_CHROME_PX : 0;
    const drumGeneratorChrome =
      showDrumGeneratorUi
        ? drumGeneratorPanelOpen
          ? PIANO_DRUM_GENERATOR_EDIT_CHROME_PX
          : SE2_DRUM_GENERATOR_COLLAPSED_CHROME_PX
        : 0;
    const chordGenieChrome =
      showGenoChordCreatorUi
        ? chordGeniePanelOpen
          ? PIANO_GENO_CHORD_CREATOR_DOCK_CHROME_PX
          : SE2_CHORD_GENIE_COLLAPSED_CHROME_PX
        : 0;
    const beatPadsChrome = showBeatPadsUi
      ? beatPadsMachineOpen
        ? PIANO_BEAT_PADS_EDIT_CHROME_PX
        : SE2_BEAT_PADS_SEQUENCER_CHROME_PX
      : 0;
    const humCaptureChrome =
      showHumCaptureUi
        ? humCapturePanelOpen
          ? PIANO_HUM_CAPTURE_EDIT_CHROME_PX
          : SE2_HUM_CAPTURE_COLLAPSED_CHROME_PX
        : 0;
    const guitarChrome = showGuitarUi && guitarPanelOpen ? PIANO_GUITAR_EDIT_CHROME_PX : 0;
    const avail = estimatePianoGridAvailPx(
      collapsedPianoPanelPx,
      pianoRollExpanded,
      viewportH,
      rhythmChrome + glideBassChrome + synthGenoChrome + grooveLeadChrome + lab808Chrome + genoUltraChrome + genoBassChrome + drumGeneratorChrome + chordGenieChrome + beatPadsChrome + humCaptureChrome + guitarChrome,
    );
    const tr = studioTracks[selectedTrackIndex];
    if (tr && studioTrackIsBeatPadsChannel(tr)) return computeBeatPadsRollPitchView(avail);
    if (selectedDrumTrack && !studioTrackIsBeatPadsChannel(selectedDrumTrack)) {
      return computeDrumRollPitchView(avail);
    }
    const notes = tr?.notes ?? [];
    if (pianoRollExpanded) {
      const expandedAvail = estimatePianoGridAvailPx(collapsedPianoPanelPx, true, viewportH, 0);
      return fullPianoRollPitchView(expandedAvail);
    }
    if (studioTrackIsGlideBassChannel(tr)) {
      return computePianoRollPanelPitchView(
        notes.length > 0 ? notes : se2GlideBassPitchSpanNotes(),
        avail,
      );
    }
    if (studioTrackIsGrooveLeadChannel(tr)) {
      return computeSe2GrooveLeadPianoRollPitchView(avail);
    }
    if (studioTrackIsLab808Channel(tr)) {
      return computeSe2Lab808PianoRollPitchView(avail);
    }
    if (studioTrackIsGenoUltraSynthChannel(tr)) {
      return computePianoRollPanelPitchView(
        notes.length > 0 ? notes : se2GenoUltraPitchSpanNotes(),
        avail,
      );
    }
    if (studioTrackIsGenoBassSynthChannel(tr)) {
      return computePianoRollPanelPitchView(
        notes.length > 0 ? notes : se2GenoBassPitchSpanNotes(),
        avail,
      );
    }
    if (studioTrackIsHumCaptureChannel(tr)) {
      return computePianoRollPanelPitchView(
        notes.length > 0 ? notes : se2HumCapturePitchSpanNotes(),
        avail,
      );
    }
    if (studioTrackIsGuitarChannel(tr)) {
      return computePianoRollPanelPitchView(
        notes.length > 0 ? notes : se2GuitarPitchSpanNotes(),
        avail,
      );
    }
    return computePianoRollPanelPitchView(notes, avail);
  }, [
    studioTracks,
    selectedTrackIndex,
    selectedDrumTrack,
    collapsedPianoPanelPx,
    pianoRollExpanded,
    viewportH,
    showRhythmUi,
    showGlideBassUi,
    glideBassPanelOpen,
    showSynthGenoUi,
    synthGenoPanelOpen,
    showGrooveLeadUi,
    grooveLeadPanelOpen,
    showLab808Ui,
    lab808PanelOpen,
    showGenoUltraSynthUi,
    genoUltraSynthPanelOpen,
    showGenoBassSynthUi,
    genoBassSynthPanelOpen,
    showHumCaptureUi,
    humCapturePanelOpen,
    showGuitarUi,
    guitarPanelOpen,
    showDrumGeneratorUi,
    drumGeneratorPanelOpen,
    showBeatPadsUi,
    beatPadsMachineOpen,
  ]);

  const selectedBeatPadsTrack = useMemo(() => {
    const tr = studioTracks[selectedTrackIndex];
    return tr && studioTrackIsBeatPadsChannel(tr) ? (tr as Se2BeatPadsTrack) : null;
  }, [studioTracks, selectedTrackIndex]);

  const drumKeyLabelForPitch = useMemo(() => {
    if (selectedBeatPadsTrack) {
      const trackId = selectedBeatPadsTrack.id;
      const kitId = selectedBeatPadsTrack.beatPadsProducerKitId ?? 'trapDarkVault';
      const labels = se2BeatPadsPadLabelsForTrack(trackId, kitId);
      const labelByPitch = new Map<number, string>();
      for (let i = 0; i < BEAT_PADS_LANE_GM_PITCH.length; i += 1) {
        const p = BEAT_PADS_LANE_GM_PITCH[i]!;
        const lab = labels[i] ?? `Pad ${i + 1}`;
        const prev = labelByPitch.get(p);
        labelByPitch.set(p, prev ? `${prev} · ${lab}` : lab);
      }
      return (pitch: number) => {
        const direct = labelByPitch.get(pitch);
        if (direct) return direct;
        if (pitch < 35 || pitch > 81) return undefined;
        const padIdx = pianoRollPadIndexForMidi(pitch);
        return labels[padIdx] ?? `Pad ${padIdx + 1}`;
      };
    }
    if (!selectedDrumTrack || studioTrackIsBeatPadsChannel(selectedDrumTrack)) return undefined;
    const kitId = selectedDrumTrack.drumProducerKitId;
    return (pitch: number) => studioDrumKeyLabelForPitch(pitch, kitId);
  }, [selectedBeatPadsTrack, selectedDrumTrack, beatPadsPadStoreRev]);

  useEffect(() => {
    const kitId = selectedDrumTrack?.drumProducerKitId;
    if (!kitId || (selectedDrumTrack && studioTrackIsBeatPadsChannel(selectedDrumTrack))) return;
    void ensureStudioDrumKitLoaded(kitId);
  }, [selectedDrumTrack?.drumProducerKitId, selectedDrumTrack, ensureStudioDrumKitLoaded]);

  useEffect(() => {
    const tr = studioTracksRef.current[selectedTrackIndex];
    if (studioTrackIsGlideBassChannel(tr)) {
      setGlideBassPanelOpen(true);
    }
    if (studioTrackIsSynthGenoChannel(tr)) {
      setSynthGenoPanelOpen(true);
    }
    if (studioTrackIsGrooveLeadChannel(tr)) {
      setGrooveLeadPanelOpen(true);
    }
    if (studioTrackIsLab808Channel(tr)) {
      setLab808PanelOpen(true);
    }
    if (studioTrackIsGenoUltraSynthChannel(tr)) {
      setGenoUltraSynthPanelOpen(true);
    }
    if (studioTrackIsGenoBassSynthChannel(tr)) {
      setPianoRollExpanded(false);
      setGenoBassSynthPanelOpen(true);
    }
    if (studioTrackIsDrumGeneratorChannel(tr)) {
      setDrumGeneratorPanelOpen(true);
    }
    if (studioTrackIsHumCaptureChannel(tr)) {
      setHumCapturePanelOpen(true);
    }
    if (studioTrackIsGuitarChannel(tr)) {
      setGuitarPanelOpen(true);
    }
  }, [selectedTrackIndex]);

  useEffect(() => {
    if (!showGlideBassUi || !glideBassPanelOpen || !showPianoRoll || pianoRollExpanded) return;
    const minH = defaultPianoPanelHeightPx(viewportH) + PIANO_GLIDE_BASS_EDIT_CHROME_PX * 0.45;
    setPianoPanelH((h) => (h < minH ? Math.round(minH) : h));
  }, [showGlideBassUi, glideBassPanelOpen, showPianoRoll, pianoRollExpanded, viewportH]);

  useEffect(() => {
    if (!showSynthGenoUi || !synthGenoPanelOpen || !showPianoRoll || pianoRollExpanded) return;
    const minH = defaultPianoPanelHeightPx(viewportH) + PIANO_SYNTH_GENO_EDIT_CHROME_PX * 0.45;
    setPianoPanelH((h) => (h < minH ? Math.round(minH) : h));
  }, [showSynthGenoUi, synthGenoPanelOpen, showPianoRoll, pianoRollExpanded, viewportH]);

  useEffect(() => {
    if (!showGrooveLeadUi || !grooveLeadPanelOpen || !showPianoRoll || pianoRollExpanded) return;
    const minH = defaultPianoPanelHeightPx(viewportH) + PIANO_GROOVE_LEAD_EDIT_CHROME_PX * 0.4;
    setPianoPanelH((h) => (h < minH ? Math.round(minH) : h));
  }, [showGrooveLeadUi, grooveLeadPanelOpen, showPianoRoll, pianoRollExpanded, viewportH]);

  useEffect(() => {
    if (!showLab808Ui || !lab808PanelOpen || !showPianoRoll || pianoRollExpanded) return;
    const minH = defaultPianoPanelHeightPx(viewportH) + PIANO_LAB808_EDIT_CHROME_PX * 0.4;
    setPianoPanelH((h) => (h < minH ? Math.round(minH) : h));
  }, [showLab808Ui, lab808PanelOpen, showPianoRoll, pianoRollExpanded, viewportH]);

  useEffect(() => {
    if (!showGenoUltraSynthUi || !genoUltraSynthPanelOpen || !showPianoRoll || pianoRollExpanded) return;
    const minH = defaultPianoPanelHeightPx(viewportH) + PIANO_GENO_ULTRA_EDIT_CHROME_PX * 0.4;
    setPianoPanelH((h) => (h < minH ? Math.round(minH) : h));
  }, [showGenoUltraSynthUi, genoUltraSynthPanelOpen, showPianoRoll, pianoRollExpanded, viewportH]);

  useEffect(() => {
    if (!showGenoBassSynthUi || !genoBassSynthPanelOpen || !showPianoRoll || pianoRollExpanded) return;
    const minH = defaultPianoPanelHeightPx(viewportH) + PIANO_GENO_BASS_EDIT_CHROME_PX * 0.4;
    setPianoPanelH((h) => (h < minH ? Math.round(minH) : h));
  }, [showGenoBassSynthUi, genoBassSynthPanelOpen, showPianoRoll, pianoRollExpanded, viewportH]);

  useEffect(() => {
    if (!showDrumGeneratorUi || !drumGeneratorPanelOpen || !showPianoRoll || pianoRollExpanded) return;
    const minH = defaultPianoPanelHeightPx(viewportH) + PIANO_DRUM_GENERATOR_EDIT_CHROME_PX * 0.4;
    setPianoPanelH((h) => (h < minH ? Math.round(minH) : h));
  }, [showDrumGeneratorUi, drumGeneratorPanelOpen, showPianoRoll, pianoRollExpanded, viewportH]);

  useEffect(() => {
    if (!showHumCaptureUi || !humCapturePanelOpen || !showPianoRoll || pianoRollExpanded) return;
    const minH = defaultPianoPanelHeightPx(viewportH) + PIANO_HUM_CAPTURE_EDIT_CHROME_PX * 0.4;
    setPianoPanelH((h) => (h < minH ? Math.round(minH) : h));
  }, [showHumCaptureUi, humCapturePanelOpen, showPianoRoll, pianoRollExpanded, viewportH]);

  useEffect(() => {
    if (!showGuitarUi || !guitarPanelOpen) return;
    const tr = studioTracksRef.current[selectedTrackIndex];
    if (!studioTrackIsGuitarChannel(tr)) return;
    const warm = (ctx: AudioContext) => {
      const strip = getHumCapturePreviewDestination(selectedTrackIndex)(ctx);
      const dest = resolveSe2GuitarAudioForTrack(ctx, selectedTrackIndex, strip, tr);
      void warmupSe2GuitarInstrument(
        ctx,
        tr.guitarInstrumentId ?? 'electric_guitar_clean',
        dest,
      );
    };
    const ctx = ctxRef.current;
    if (ctx && ctx.state !== 'closed') {
      warm(ctx);
    } else {
      void ensureCtx().then((c) => warm(c));
    }
  }, [selectedTrackIndex, showGuitarUi, guitarPanelOpen, ensureCtx, getHumCapturePreviewDestination]);

  useEffect(() => {
    if (!showGuitarUi || !guitarPanelOpen || !showPianoRoll || pianoRollExpanded) return;
    const minH = guitarFocusActive
      ? Math.round(viewportH * SE2_GUITAR_FOCUS_VIEWPORT_FRAC)
      : defaultPianoPanelHeightPx(viewportH) + PIANO_GUITAR_EDIT_CHROME_PX * 0.4;
    setPianoPanelH((h) => (h < minH ? Math.round(minH) : h));
  }, [showGuitarUi, guitarPanelOpen, showPianoRoll, pianoRollExpanded, viewportH, guitarFocusActive]);

  useEffect(() => {
    if (!showGenoChordCreatorUi || !chordGeniePanelOpen || !showPianoRoll || pianoRollExpanded) return;
    const minH =
      defaultPianoPanelHeightPx(viewportH) +
      PIANO_GENO_CHORD_CREATOR_DOCK_CHROME_PX * 0.35;
    setPianoPanelH((h) => (h < minH ? Math.round(minH) : h));
  }, [showGenoChordCreatorUi, chordGeniePanelOpen, showPianoRoll, pianoRollExpanded, viewportH]);

  useEffect(() => {
    if (!showPianoRoll || pianoRollExpanded) return;
    const target = defaultPianoPanelHeightPx(viewportH);
    setPianoPanelH((h) => (h < target ? target : h));
  }, [showPianoRoll, pianoRollExpanded, viewportH]);

  useEffect(() => {
    if (!pianoRollExpanded) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (e.defaultPrevented) return;
      setPianoRollExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pianoRollExpanded]);

  const syncTimelineHorizontalScroll = useCallback((source: 'main' | 'ruler' | 'bar' | 'programmatic', forcedScrollLeft?: number) => {
    const main = timelineHScrollRef.current;
    const ruler = timelineRulerHScrollRef.current;
    const bar = timelineHBarRef.current;

    if (source === 'programmatic' && typeof forcedScrollLeft === 'number') {
      if (main) main.scrollLeft = forcedScrollLeft;
      if (ruler) ruler.scrollLeft = forcedScrollLeft;
      if (bar) bar.scrollLeft = forcedScrollLeft;
      return;
    }

    if (timelineScrollSyncRef.current) return;
    const src = source === 'main' ? main : source === 'ruler' ? ruler : bar;
    if (!src) return;
    const left = src.scrollLeft;
    timelineScrollSyncRef.current = source;
    if (source !== 'main' && main) main.scrollLeft = left;
    if (source !== 'ruler' && ruler) ruler.scrollLeft = left;
    if (source !== 'bar' && bar) bar.scrollLeft = left;
    timelineScrollSyncRef.current = null;
  }, []);

  const syncTimelineHBarFromMain = useCallback(() => {
    syncTimelineHorizontalScroll('main');
  }, [syncTimelineHorizontalScroll]);

  const syncTimelineMainFromHBar = useCallback(() => {
    syncTimelineHorizontalScroll('bar');
  }, [syncTimelineHorizontalScroll]);

  const syncTimelineMainFromRuler = useCallback(() => {
    syncTimelineHorizontalScroll('ruler');
  }, [syncTimelineHorizontalScroll]);

  const onTimelineHScroll = useCallback(() => {
    if (timelineProgrammaticScrollRef.current) return;
    /*
     * Echo scrolls from sticky follow can arrive after programmatic is cleared elsewhere.
     * If scrollLeft still matches our follow integer, keep follow — do not re-engage snap.
     */
    if (timelineEdgeFollowActiveRef.current && runningRef.current) {
      const expected = timelineFollowIntScrollRef.current;
      const sl = timelineHScrollRef.current?.scrollLeft ?? -1;
      if (expected >= 0 && Math.abs(sl - expected) <= 1) {
        syncTimelineHBarFromMain();
        return;
      }
      clearTimelineEdgeFollow();
    } else if (timelineFollowParkedTransformRef.current) {
      /* User scrolled while Stop-parked — commit translate→scroll before continuing. */
      clearTimelineEdgeFollow();
    }
    syncTimelineHBarFromMain();
    syncTimelineGridNow();
  }, [clearTimelineEdgeFollow, syncTimelineHBarFromMain, syncTimelineGridNow]);

  const onTimelineRulerHScroll = useCallback(() => {
    if (timelineProgrammaticScrollRef.current) return;
    if (timelineEdgeFollowActiveRef.current && runningRef.current) {
      const expected = timelineFollowIntScrollRef.current;
      const sl = timelineRulerHScrollRef.current?.scrollLeft ?? -1;
      if (expected >= 0 && Math.abs(sl - expected) <= 1) {
        syncTimelineMainFromRuler();
        return;
      }
      clearTimelineEdgeFollow();
    } else if (timelineFollowParkedTransformRef.current) {
      clearTimelineEdgeFollow();
    }
    syncTimelineMainFromRuler();
  }, [clearTimelineEdgeFollow, syncTimelineMainFromRuler]);

  const onTimelineHBarScroll = useCallback(() => {
    if (timelineProgrammaticScrollRef.current) return;
    if (timelineEdgeFollowActiveRef.current && runningRef.current) {
      const expected = timelineFollowIntScrollRef.current;
      const sl = timelineHBarRef.current?.scrollLeft ?? -1;
      if (expected >= 0 && Math.abs(sl - expected) <= 1) {
        syncTimelineMainFromHBar();
        return;
      }
      clearTimelineEdgeFollow();
    } else if (timelineFollowParkedTransformRef.current) {
      clearTimelineEdgeFollow();
    }
    syncTimelineMainFromHBar();
  }, [clearTimelineEdgeFollow, syncTimelineMainFromHBar]);

  /** Zoom timeline anchored at a fixed beat (measure-ruler vertical drag). */
  const applyTimelineZoomAtBeat = useCallback(
    (nextZoom: number, anchorBeat: number, anchorClientX: number) => {
      const scrollEl = timelineHScrollRef.current;
      const clamped = clampStudioZoom(nextZoom);
      const prevZoom = timelineZoomRef.current;
      if (Math.abs(clamped - prevZoom) < 0.004) return;

      flushSync(() => {
        setZoom(clamped);
      });
      timelineZoomRef.current = clamped;

      if (scrollEl) {
        const bpb = beatsPerBarRef.current;
        const scrollRect = scrollEl.getBoundingClientRect();
        const anchorInViewport = anchorClientX - scrollRect.left;
        const ppbNew = ppbAtZoom(clamped, bpb);
        const maxScroll = Math.max(0, TOTAL_WIDTH_PX * clamped - scrollEl.clientWidth);
        scrollEl.scrollLeft = Math.max(0, Math.min(maxScroll, anchorBeat * ppbNew - anchorInViewport));
        syncTimelineHBarFromMain();
      }

      syncTimelineGridNow(clamped);
    },
    [syncTimelineHBarFromMain, syncTimelineGridNow],
  );

  const onMeasureRulerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (runningRef.current) pauseTransport();
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      setBeatFromScrubClientX(e.clientX, {
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        clientY: e.clientY,
      });
      const startZoom = timelineZoomRef.current;
      measureRulerGestureRef.current = {
        mode: 'scrub',
        startX: e.clientX,
        startY: e.clientY,
        startZoom,
        lastY: e.clientY,
        lastZoom: startZoom,
        anchorClientX: e.clientX,
        anchorBeat: clientXToBeat(e.clientX, e.clientY),
        dragCommitted: false,
      };
    },
    [clientXToBeat, pauseTransport, setBeatFromScrubClientX],
  );

  const onMeasureRulerPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const gesture = measureRulerGestureRef.current;
      if (!gesture) return;
      const dx = e.clientX - gesture.startX;
      const dy = e.clientY - gesture.startY;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      if (gesture.mode === 'scrub') {
        if (gesture.dragCommitted) {
          /* Already scrubbing — always follow the mouse; never flip to zoom mid-drag so
           * the playhead can't "pop back" or lag behind the cursor. */
          setBeatFromScrubClientX(e.clientX, {
            snap: e.shiftKey ? 'bar' : 'free',
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            clientY: e.clientY,
          });
          return;
        }
        if (ady >= RULER_GESTURE_LOCK_PX && ady > adx * RULER_ZOOM_AXIS_BIAS) {
          gesture.mode = 'zoom';
        } else if (adx >= RULER_GESTURE_LOCK_PX) {
          gesture.dragCommitted = true;
          setBeatFromScrubClientX(e.clientX, {
            snap: e.shiftKey ? 'bar' : 'free',
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            clientY: e.clientY,
          });
        }
        return;
      }

      if (gesture.mode === 'pending') {
        if (ady >= RULER_GESTURE_LOCK_PX && ady > adx * RULER_ZOOM_AXIS_BIAS) {
          gesture.mode = 'zoom';
        } else if (adx >= RULER_GESTURE_LOCK_PX && adx > ady * RULER_ZOOM_AXIS_BIAS) {
          gesture.mode = 'scrub';
          gesture.dragCommitted = true;
          setBeatFromScrubClientX(e.clientX, { clientY: e.clientY });
        } else {
          return;
        }
      }

      if (gesture.mode === 'scrub') {
        if (gesture.dragCommitted) setBeatFromScrubClientX(e.clientX, { clientY: e.clientY });
        return;
      }

      const dyStep = gesture.lastY - e.clientY;
      if (dyStep === 0) return;
      gesture.lastY = e.clientY;
      const next = gesture.lastZoom + dyStep / RULER_ZOOM_DRAG_SENSITIVITY;
      const clamped = clampStudioZoom(next);
      if (Math.abs(clamped - gesture.lastZoom) < 0.004) return;
      gesture.lastZoom = clamped;
      applyTimelineZoomAtBeat(clamped, gesture.anchorBeat, gesture.anchorClientX);
    },
    [applyTimelineZoomAtBeat, setBeatFromScrubClientX],
  );

  const onMeasureRulerPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    measureRulerGestureRef.current = null;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      /**/
    }
  }, []);

  const onTimelineWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const next = clampStudioZoom(timelineZoomRef.current * factor);
      applyTimelineZoomAtBeat(next, clientXToBeat(e.clientX), e.clientX);
      return;
    }
    const el = timelineHScrollRef.current;
    if (!el) return;
    const delta =
      Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
    if (delta === 0) return;
    e.preventDefault();
    /* User scroll breaks sticky edge-follow (programmatic stays true while following). */
    clearTimelineEdgeFollow();
    el.scrollLeft += delta;
    syncTimelineHBarFromMain();
  }, [applyTimelineZoomAtBeat, clearTimelineEdgeFollow, clientXToBeat, syncTimelineHBarFromMain]);

  useEffect(() => {
    syncTimelineHBarFromMain();
  }, [zoom, timelineStripWidthPx, syncTimelineHBarFromMain]);

  const onPianoResizeStart = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = pianoPanelH;
      const onMove = (ev: globalThis.MouseEvent) => {
        const dy = startY - ev.clientY;
        setPianoPanelH(Math.max(PIANO_PANEL_H_MIN, Math.min(PIANO_PANEL_H_MAX, startH + dy)));
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [pianoPanelH],
  );

  const onMixerResizeStart = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = mixerPanelH;
      const onMove = (ev: globalThis.MouseEvent) => {
        const dy = startY - ev.clientY;
        setMixerPanelH(Math.max(260, Math.min(480, startH + dy)));
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [mixerPanelH],
  );

  /** Drag bottom edge of track-name row: changes all arrange lane heights (DAW-style). */
  const onArrangeLaneResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = trackLaneHRef.current;
    const onMove = (ev: globalThis.MouseEvent) => {
      const dy = ev.clientY - startY;
      const next = Math.round(
        Math.max(MIN_TRACK_LANE_H_PX, Math.min(MAX_TRACK_LANE_H_PX, startH + dy)),
      );
      setTrackLaneHeightPx(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  return (
    <StudioEditor2HelpProvider active={isScreenActive} autoIntro>
    <div
      ref={studioUiRootRef}
      data-studio-editor-2
      data-studio-beat-pads-immersive={beatPadsFullscreenActive ? '' : undefined}
      className="relative flex flex-col h-full min-h-0 w-full overflow-hidden text-[#c8c8d0] antialiased"
      style={{ background: '#060607' }}
    >
      <input
        ref={songOpenInputRef}
        type="file"
        accept={`${DA_MUSIC_BOX_SONG_EXTENSION},application/vnd.da-music-box.song+json`}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          input.value = '';
          if (!file) return;
          void (async () => {
            try {
              const text = await file.text();
              await openSe2SongFromText(text, null);
            } catch (err) {
              console.warn('SE2: open song failed', err);
            }
          })();
        }}
      />
      <header
        data-studio-se2-header
        className="shrink-0 flex items-center justify-between gap-3 px-4 h-9 border-b select-none"
        style={{ borderColor: '#141418', background: '#09090c' }}
      >
        <div className="flex min-w-0 flex-nowrap items-center gap-4 sm:gap-6 overflow-x-auto">
          <div className="flex min-w-0 shrink-0 items-baseline gap-2">
            <span className="truncate text-sm font-semibold tracking-tight text-white">Da Muzik Box</span>
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-widest inline-flex items-center gap-1" style={{ color: '#4a4a58' }}>
              Studio 2
              <StudioEditor2HelpTip tab="overview" title="Studio Editor 2 â€” song DAW" />
            </span>
          </div>
          <div
            className="flex shrink-0 flex-nowrap items-center gap-2"
            role="tablist"
            aria-label="Main view"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!showPianoRoll && !showMixer}
              data-studio-se2-header-pill
              data-active={!showPianoRoll && !showMixer ? 'true' : 'false'}
              title="Track view â€” timeline and track lanes"
              className={`transition-colors ${transportBtnBase}`}
              onClick={() => { setShowPianoRoll(false); setPianoRollExpanded(false); setShowMixer(false); }}
            >
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                Track view
                <StudioEditor2HelpTip tab="timeline" title="Track view & arrangement" />
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showPianoRoll}
              data-studio-se2-header-pill
              data-active={showPianoRoll ? 'true' : 'false'}
              title="Piano roll editor for the selected track"
              className={`transition-colors ${transportBtnBase}`}
              onClick={() => openPianoRollEditor()}
            >
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                Piano
                <StudioEditor2HelpTip tab="piano" title="Piano roll editor" />
              </span>
            </button>
            <button
              type="button"
              data-studio-se2-header-pill
              data-active={ownerStartupSavedTick > 0 ? 'true' : 'false'}
              title={
                ownerStartupSavedTick > 0
                  ? 'Template saved — reload SE2 to open with this exact layout (tracks, mixer, view)'
                  : 'Save current tracks, mixer, view and zoom as your SE2 template'
              }
              className={`transition-colors ${transportBtnBase}`}
              onClick={openTemplateSaveDialog}
            >
              <Star size={12} strokeWidth={2.4} aria-hidden />
              Template
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showMixer}
              data-studio-se2-header-pill
              data-active={showMixer ? 'true' : 'false'}
              title="SE2 Mixer — audio channel mixer"
              className={`transition-colors ${transportBtnBase}`}
              onClick={toggleStudioMixerView}
            >
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                SE2 Mixer
                <StudioEditor2HelpTip tab="mixer" title="SE2 Mixer — audio channel mixer" />
              </span>
            </button>
            <button
              type="button"
              aria-pressed={loopOn}
              data-studio-se2-header-pill
              data-active={loopOn ? 'true' : 'false'}
              title={
                loopOn
                  ? `Loop on — ${loopBars} bar${loopBars !== 1 ? 's' : ''} (drag green strip on ruler to move/resize)`
                  : 'Loop off — click to repeat playback inside the loop region'
              }
              className={`transition-colors ${transportBtnBase}`}
              onClick={toggleArrangeLoopOn}
            >
              <Repeat size={12} strokeWidth={2.4} aria-hidden />
              Loop
            </button>
            <StudioSongKeyControl
              songKeyRoot={songKeyRoot}
              songKeyMode={songKeyMode}
              disabled={running}
              convertDisabled={
                running ||
                !studioTrackHasMelodicKeyUi(studioTracks[selectedTrackIndex] ?? ({} as MockMusioTrack)) ||
                (studioTracks[selectedTrackIndex]?.notes.length ?? 0) === 0
              }
              convertTitle={(() => {
                const tr = studioTracks[selectedTrackIndex];
                if (!tr || !studioTrackHasMelodicKeyUi(tr) || tr.notes.length === 0) {
                  return 'Select a melodic track with notes to convert';
                }
                const from = studioResolveTrackKey(tr, bpm);
                const song = studioKeyLabel(songKeyRoot, songKeyMode);
                if (from) {
                  return `Convert ${studioKeyLabel(from.keyRoot, from.keyMode)} → ${song}`;
                }
                return `Detect key on track first, then convert to ${song}`;
              })()}
              onSongKeyChange={(root, mode) => {
                setSongKeyRoot(root);
                setSongKeyMode(mode);
              }}
              onConvertToSongKey={() => convertTrackToSongKey(selectedTrackIndex)}
            />
            <StudioSe2ProjectMenuControls
              disabled={running || consolidateBusy || exportBusy || songSaveBusy}
              consolidateBusy={consolidateBusy}
              exportBusy={exportBusy}
              songSaveBusy={songSaveBusy}
              normalizeDisabled={normalizeAudioDisabled}
              normalizeTitle={normalizeAudioTitle}
              consolidateTracks={consolidateTrackOptions}
              maxBars={SE2_ARRANGEMENT_BARS}
              bpm={bpm}
              beatsPerBar={beatsPerBar}
              startBar={consolidateStartBar}
              endBar={consolidateEndBar}
              rangeLabel={consolidateRangeLabel}
              rangeValid={consolidateRange !== null}
              songName={songName}
              songFileLabel={songFileLabel}
              lastSavedLabel={
                songLastSavedAt
                  ? `Last saved ${new Date(songLastSavedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                  : undefined
              }
              onStartBarChange={(bar) => {
                const n = Math.max(1, Math.min(SE2_ARRANGEMENT_BARS, Math.round(bar)));
                setConsolidateStartBar(n);
                setConsolidateEndBar((prev) => Math.max(n, prev));
              }}
              onEndBarChange={(bar) => {
                const n = Math.max(
                  consolidateStartBar,
                  Math.min(SE2_ARRANGEMENT_BARS, Math.round(bar)),
                );
                setConsolidateEndBar(n);
              }}
              onEndBarFromMinutes={(minutes) => {
                setConsolidateEndBar(
                  se2ConsolidateBarsForMinutes(minutes, bpm, beatsPerBar, SE2_ARRANGEMENT_BARS),
                );
              }}
              onNormalize={normalizeSelectedTrackAudio}
              onConsolidate={(indices, startBar, endBar) => {
                void consolidateTracksAtIndices(indices, startBar, endBar);
              }}
              onSaveSong={() => {
                void saveSe2Song();
              }}
              onSaveSongAs={() => {
                void saveSe2SongAs();
              }}
              onOpenSong={() => {
                void openSe2Song();
              }}
              onExportStereoToMasteringBay={() => {
                void runSe2StereoExport('mastering');
              }}
              onSaveStereoMix={() => {
                void runSe2StereoExport('file');
              }}
              onExportTrackOuts={() => {
                void runSe2TrackOutsExport();
              }}
            />
        </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-auto pl-4">
          <StudioEditor2MidiBtn />
          <StudioEditor2HowToBtn />
        </div>
      </header>

      <main className="relative flex flex-1 min-h-0 flex-col overflow-hidden p-0">
        {beatPadsLanesHost ? (
          <div
            className={
              beatPadsPanelVisible
                ? beatPadsFullscreenActive
                  ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                  : 'order-last shrink-0 flex flex-col overflow-hidden'
                : 'hidden'
            }
            aria-hidden={!beatPadsPanelVisible}
          >
            {beatPadsLanesHost}
          </div>
        ) : null}
        <div
          ref={transportPaintHostRef}
          className={`relative flex min-h-0 flex-1 flex-col overflow-hidden border-0 rounded-none shadow-none${
            beatPadsFullscreenActive ? ' hidden' : ''
          }`}
          style={{
            borderColor: 'transparent',
            background: 'linear-gradient(165deg, #0c0c12 0%, #07070b 55%, #060609 100%)',
            boxShadow: 'none',
            minHeight: 0,
          }}
          onWheel={(e) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            const next = clampStudioZoom(timelineZoomRef.current * factor);
            applyTimelineZoomAtBeat(next, clientXToBeat(e.clientX), e.clientX);
          }}
        >
          {/*
            Pinned bar/beat ruler row (never vertically scrolls). Only track lanes scroll below —
            Pro Tools / Studio One style.
          */}
          <div
            className={
              showPianoRollInLayout && pianoRollExpanded
                ? 'hidden'
                : showPianoRollInLayout
                  ? guitarFocusActive
                    ? 'flex min-h-[80px] max-h-[168px] min-w-0 shrink-0 flex-col overflow-hidden'
                    : 'flex min-h-[96px] min-w-0 flex-[0.22] flex-col overflow-hidden'
                  : 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
            }
          >
            <div
              className="flex shrink-0 flex-row border-b"
              style={{ borderColor: '#1e1e26', background: 'linear-gradient(180deg, #1c1c26 0%, #12121a 100%)' }}
            >
              <div
                className="flex shrink-0 flex-col border-r select-none"
                style={{
                  width: TRACK_HEADER_W_PX,
                  borderColor: '#1e1e26',
                  boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.35)',
                  color: '#4a4a58',
                }}
              >
                <div
                  className="shrink-0 flex items-center px-1.5"
                  style={{
                    height: RULER_BAR_H_PX,
                    boxSizing: 'border-box',
                    boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.06)',
                  }}
                >
                  <span
                    className="se2-type-label text-[11px] leading-none truncate min-w-0"
                    style={{ color: '#b4b4c4' }}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      Tracks
                      <StudioEditor2HelpTip tab="timeline" title="Timeline lanes & clips" />
                    </span>
                  </span>
                </div>
                <div
                  className="relative z-[5] flex shrink-0 items-center gap-0.5 px-1 min-w-0"
                  style={{ height: RULER_MEAS_H_PX, boxSizing: 'border-box' }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {(
                    [
                      ['select', MousePointer2, 'Select — move clips & notes · click lane = step playhead · drag playhead line = free scrub'],
                      ['scrub', MoveHorizontal, 'Playhead — drag anywhere on tracks for free scrub · Shift = bar · Alt = free click'],
                      ['slice', Scissors, 'Slice — drag on waveform to cut · Alt = free · Shift = bar snap'],
                    ] as const
                  ).map(([t, Icon, tip]) => (
                    <button
                      key={t}
                      type="button"
                      title={tip}
                      aria-label={tip}
                      aria-pressed={timelineTool === t}
                      onClick={() => setTimelineTool(t)}
                      className="inline-flex shrink-0 items-center justify-center rounded border px-1 py-0.5 transition-colors"
                      style={{
                        borderColor: timelineTool === t ? 'rgba(0,229,255,0.38)' : 'rgba(255,255,255,0.08)',
                        background: timelineTool === t ? 'rgba(0,229,255,0.14)' : 'rgba(255,255,255,0.02)',
                        color: timelineTool === t ? '#9defff' : '#6a6a78',
                      }}
                    >
                      <Icon size={10} strokeWidth={2} aria-hidden />
                    </button>
                  ))}
                  <StudioAddTrackDropdown
                    disabled={atTrackCap}
                    duplicateDisabled={atTrackCap}
                    onAdd={addTrackByKind}
                    onDuplicate={duplicateSelectedTrack}
                  />
                </div>
              </div>
              <div
                ref={timelineRulerHScrollRef}
                className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                onScroll={onTimelineRulerHScroll}
                onWheel={onTimelineWheel}
                aria-label="Timeline bar and beat ruler"
              >
                <div
                  ref={timelineRulerStripRef}
                  className="relative shrink-0"
                  style={{ width: timelineStripWidthPx, height: RULER_TOTAL_H_PX, lineHeight: 0, willChange: 'transform' }}
                >
                  <canvas
                    ref={timelineRulerCanvasRef}
                    className="block max-w-none pointer-events-none"
                    style={{ verticalAlign: 'top' }}
                  />
                  {(() => {
                    const ppb = ppbAtZoom(zoom, beatsPerBar);
                    const lsX = beatColumnLeftPx(loopStartBeat, ppb);
                    const leX = beatColumnLeftPx(loopEndBeat, ppb);
                    const span = Math.max(0, leX - lsX);
                    const HANDLE_W = 6;
                    return (
                      <div
                        className="absolute left-0 right-0 top-0 z-[5]"
                        style={{ height: RULER_BAR_H_PX, cursor: 'crosshair', touchAction: 'none', userSelect: 'none' }}
                        aria-label="Loop region bar"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onPointerDown={onLoopRulerPointerDown}
                        onPointerMove={onLoopRulerPointerMove}
                        onPointerUp={onLoopRulerPointerUp}
                        onPointerCancel={(e) => {
                          loopDragRef.current = null;
                          try {
                            (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
                          } catch {
                            /**/
                          }
                        }}
                      >
                        {loopOn && span > 0 && (
                          <>
                            <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: lsX, width: span, background: 'rgba(124,244,198,0.22)', borderTop: '2px solid #7cf4c6' }} />
                            <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: lsX, width: HANDLE_W, background: '#7cf4c6' }} />
                            <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: leX - HANDLE_W, width: HANDLE_W, background: '#7cf4c6' }} />
                            {span > 40 && (
                              <div className="absolute top-0 bottom-0 flex items-center pointer-events-none" style={{ left: lsX + HANDLE_W + 3, fontSize: 8, color: '#7cf4c6', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {`${Math.round((loopEndBeat - loopStartBeat) / beatsPerBar)} bar loop`}
                              </div>
                            )}
                          </>
                        )}
                        {!loopOn && (
                          <div className="absolute inset-0 flex items-center px-2 pointer-events-none" style={{ fontSize: 8, color: '#3a3a4a' }}>
                            drag to set loop
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div
                    ref={timelineRulerScrubRef}
                    className="absolute left-0 right-0 z-[3]"
                    style={{
                      top: RULER_BAR_H_PX,
                      height: RULER_MEAS_H_PX,
                      cursor: 'pointer',
                      touchAction: 'none',
                    }}
                    aria-label="Timeline beat ruler — click or drag to move playhead; drag up/down to zoom"
                    title="Click or drag: move playhead · drag up/down: zoom timeline"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onPointerDown={onMeasureRulerPointerDown}
                    onPointerMove={onMeasureRulerPointerMove}
                    onPointerUp={onMeasureRulerPointerUp}
                    onPointerCancel={onMeasureRulerPointerUp}
                  />
                </div>
              </div>
            </div>
            <div
              ref={trackListScrollRef}
              className="flex min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
            >
            <div className="relative flex w-full min-w-0 shrink-0 flex-row items-start">
              <div
                data-studio-track-view
                className="flex shrink-0 flex-col border-r select-none self-start"
                style={{
                  width: TRACK_HEADER_W_PX,
                  borderColor: '#1e1e26',
                  background: 'linear-gradient(90deg, #0e0e12 0%, #0a0a0e 100%)',
                  boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.35)',
                }}
              >
            {studioTracks.map((tr, ti) => {
              const active = ti === selectedTrackIndex;
              const chPad = Math.max(2, String(studioTracks.length).length);
              const chNum =
                tr.kind === 'a2m'
                  ? 'A2M'
                  : tr.kind === 'rhythm'
                    ? 'RHY'
                    : tr.kind === 'midi'
                      ? String(studioMidiChannelForTrack(ti, studioTracks)).padStart(chPad, '0')
                      : 'â€”';
              const dropHover = audioClipDropHoverTrackIndex === ti;
              return (
                <div
                  key={tr.id}
                  className="group relative shrink-0 w-full flex flex-col"
                  style={{
                    height: arrangeLaneH,
                    boxSizing: 'border-box',
                    /* Hairline only â€” `border-b` inside a fixed height steals 1px from lane vs canvas. */
                    boxShadow: [
                      'inset 0 -1px 0 rgba(255,255,255,0.06)',
                      active ? `inset 3px 0 0 ${tr.colorHex}, inset 0 0 0 1px rgba(255,255,255,0.05)` : '',
                      dropHover ? 'inset 0 0 0 2px rgba(110,231,249,0.75)' : '',
                    ]
                      .filter(Boolean)
                      .join(', '),
                    background: active
                      ? `linear-gradient(90deg, rgba(124,244,198,0.12) 0%, rgba(8,8,12,0.5) 100%)`
                      : ti % 2 === 0
                        ? 'rgba(255,255,255,0.02)'
                        : 'transparent',
                  }}
                  {...(se2TrackIsAudioClipLane(tr.kind)
                    ? {
                        onDragOver: (e: DragEvent<HTMLDivElement>) => onStudioAudioTrackHeaderDragOver(e, ti),
                        onDrop: (e: DragEvent<HTMLDivElement>) => void ingestDroppedAudioOnAudioTrack(e, ti),
                      }
                    : tr.kind === 'a2m'
                      ? {
                          onDragOver: (e: DragEvent<HTMLDivElement>) => onStudioA2mTrackHeaderDragOver(e, ti),
                          onDrop: (e: DragEvent<HTMLDivElement>) => void ingestDroppedAudioOnA2mTrack(e, ti),
                        }
                      : {})}
                >
                  {/* Full lane height â€” matches canvas lane; resize handle overlays bottom (does not shrink this row). */}
                  <div className="relative flex h-full min-h-0 flex-row items-center gap-1 pr-1">
                    <button
                      type="button"
                      onClick={() => selectTrackAndClearPianoNote(ti)}
                      className={`flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-1.5 text-left cursor-pointer transition-colors ${TRACK_DISPLAY_TEXT_CLASS} ${se2TrackIsAudioClipLane(tr.kind) ? 'overflow-x-visible overflow-y-hidden' : 'overflow-hidden'}`}
                      style={{
                        height: arrangeLaneH,
                        maxHeight: arrangeLaneH,
                        color: active ? '#ececf4' : '#9c9cac',
                        background: 'transparent',
                        border: 'none',
                      }}
                      title={se2TrackNumberedName(tr.laneNumber, tr.name, studioLanePad)}
                    >
                      <span className="flex min-w-0 items-center gap-1.5 w-full">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: tr.colorHex, boxShadow: active ? `0 0 4px ${tr.colorHex}66` : undefined }}
                          aria-hidden
                        />
                        <span
                          className="font-mono tabular-nums shrink-0 text-[10px] font-bold"
                          style={{ color: tr.colorHex }}
                        >
                          {se2FormatTrackNumber(tr.laneNumber, studioLanePad)}
                        </span>
                        <span className="truncate min-w-0 flex-1">{tr.name}</span>
                        {tr.kind === 'audio' ? (
                          <span
                            className="shrink-0"
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <Se2LaneImportAudio
                              micro
                              disabled={running}
                              accentHex={tr.colorHex}
                              title="Import audio — places clip at playhead"
                              onImportFile={(file) => importAudioOnClipLaneAtPlayhead(ti, file)}
                            />
                          </span>
                        ) : null}
                      </span>
                      {tr.kind === 'a2m' && (
                        <span
                          className="flex w-full min-w-0 flex-wrap items-center gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <StudioAudioToMidiModePicker
                            compact
                            value={tr.a2mMode}
                            accentHex={tr.colorHex}
                            disabled={running}
                            title={`Convert mode for ${tr.name}`}
                            onChange={(mode) => updateTrackA2mMode(ti, mode)}
                          />
                          <Se2LaneImportAudio
                            micro
                            label="Imp"
                            disabled={running}
                            accentHex={tr.colorHex}
                            title="Import audio — converts to MIDI notes at playhead"
                            onImportFile={(file) => importAudioOnA2mLaneAtPlayhead(ti, file)}
                          />
                          {studioTrackHasMelodicKeyUi(tr) ? (
                            <StudioTrackKeyMenu
                              compact
                              className="min-w-0 max-w-[3.25rem] shrink-0"
                              keyRoot={studioTrackDetectedKey(tr).keyRoot}
                              keyMode={studioTrackDetectedKey(tr).keyMode}
                              songKeyRoot={songKeyRoot}
                              songKeyMode={songKeyMode}
                              accentHex={tr.colorHex}
                              disabled={running}
                              detectDisabled={running || tr.notes.length === 0}
                              convertDisabled={running || tr.notes.length === 0}
                              title={`Key for ${tr.name}`}
                              onDetect={() => detectTrackKey(ti)}
                              onConvertToSongKey={() => convertTrackToSongKey(ti)}
                            />
                          ) : null}
                        </span>
                      )}
                      {se2TrackIsTrackAlign(tr.kind) ? (
                        <span
                          className="text-[8px] font-semibold uppercase tracking-[0.12em] leading-none"
                          style={{ color: '#6ee7f9' }}
                        >
                          Time stretch
                        </span>
                      ) : null}
                      {se2TrackIsTrackAlign(tr.kind) ? (
                        <Se2LaneImportAudio
                          disabled={running}
                          accentHex="#6ee7f9"
                          title="Import audio — places clip at playhead, tempo-locked to session BPM"
                          onImportFile={(file) => importAudioOnClipLaneAtPlayhead(ti, file)}
                        />
                      ) : null}
                      {se2TrackIsTrackAlign(tr.kind) &&
                      selectedTimelineAudioClip?.trackIndex === ti &&
                      tr.audioClips.some((c) => c.id === selectedTimelineAudioClip.clipId) ? (
                        (() => {
                          const selClip = tr.audioClips.find((c) => c.id === selectedTimelineAudioClip.clipId);
                          if (!selClip) return null;
                          const locked = selClip.alignTempoLock !== false;
                          return (
                            <button
                              type="button"
                              className="text-[8px] font-semibold uppercase tracking-wide rounded px-1 py-0.5 w-fit"
                              style={{
                                color: locked ? '#0a0a0e' : '#6ee7f9',
                                background: locked ? '#6ee7f9' : 'rgba(110,231,249,0.12)',
                                border: '1px solid rgba(110,231,249,0.45)',
                              }}
                              title={
                                locked
                                  ? 'Tempo lock on — hold Shift and drag edges to time-stretch · edge alone trims'
                                  : 'Tempo lock off — clip plays at native speed (tape mode)'
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleClipAlignTempoLock(ti, selClip.id);
                              }}
                            >
                              {locked ? 'Tempo lock' : 'Tape mode'}
                            </button>
                          );
                        })()
                      ) : null}
                      {tr.kind === 'audio' ? (
                        <StudioAudioTrackLaneInput
                          trackIndex={ti}
                          trackName={tr.name}
                          recordArmed={trackRecordArmed[ti] ?? false}
                          muted={trackMutes[ti] ?? false}
                          mono={trackMonos[ti] ?? false}
                          recording={recording}
                          disabled={recording}
                          shellRef={(el) => {
                            trackLaneMeterShellRef.current[ti] = el;
                          }}
                          meterLRef={(el) => {
                            trackLaneMeterLsRef.current[ti] = el;
                          }}
                          meterRRef={(el) => {
                            trackLaneMeterRsRef.current[ti] = el;
                          }}
                          onToggleRecordArm={() => {
                            setTrackRecordArmed((prev) => {
                              const next = [...prev];
                              next[ti] = !(next[ti] ?? false);
                              return next;
                            });
                          }}
                          onSelectTrack={() => selectTrackAndClearPianoNote(ti)}
                        />
                      ) : null}
                      {se2TrackIsTrackAlign(tr.kind) && tr.alignSourceBpm ? (
                        alignSourceBpmEditTrack === ti ? (
                          <input
                            type="number"
                            min={40}
                            max={300}
                            step={1}
                            defaultValue={Math.round(tr.alignSourceBpm)}
                            autoFocus
                            className="w-14 rounded border bg-[#1c1c24] px-1 py-0.5 text-[10px] font-mono tabular-nums outline-none"
                            style={{ borderColor: '#6ee7f9', color: '#6ee7f9' }}
                            title="Source BPM — Enter to apply"
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') {
                                setTrackAlignSourceBpm(ti, Number((e.target as HTMLInputElement).value));
                              } else if (e.key === 'Escape') {
                                setAlignSourceBpmEditTrack(null);
                              }
                            }}
                            onBlur={(e) => {
                              setTrackAlignSourceBpm(ti, Number(e.target.value));
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="text-[11px] font-mono tabular-nums leading-tight rounded px-0.5 hover:bg-[#6ee7f9]/10"
                            style={{ color: '#6ee7f9' }}
                            title="Source BPM — click to fix if detection is wrong (uses session tempo as guide on import)"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAlignSourceBpmEditTrack(ti);
                            }}
                          >
                            {Math.round(tr.alignSourceBpm)} BPM src
                          </button>
                        )
                      ) : null}
                      {studioTrackIsDrumChannel(tr) && (
                        <span
                          className="flex w-full min-w-0 self-stretch gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <StudioDrumPatternMenu
                            trackChannel
                            compact
                            className="flex-1 min-w-0"
                            selectedPresetId={tr.drumPatternPresetId}
                            accentHex={tr.colorHex}
                            disabled={running}
                            title={`Piano Roll patterns (Trap / R&B) on ${tr.name}`}
                            onSelectPreset={(preset) => loadDrumPatternOnTrack(ti, preset)}
                          />
                          <StudioBeatLabPatternBankMenu
                            trackChannel
                            compact
                            className="flex-1 min-w-0"
                            selectedPresetId={tr.beatLabPatternPresetId}
                            accentHex="#7cf4c6"
                            disabled={running}
                            title={`Beat Lab pattern bank on ${tr.name}`}
                            onSelectPreset={(preset) => loadBeatLabPatternOnTrack(ti, preset)}
                          />
                          <button
                            type="button"
                            disabled={running || tr.notes.length === 0}
                            title={`Clear drum pattern on ${tr.name}`}
                            aria-label={`Clear drum pattern on ${tr.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              clearDrumPatternOnTrack(ti);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="shrink-0 flex items-center justify-center rounded border outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-35"
                            style={{
                              width: 18,
                              minHeight: 16,
                              borderColor: '#4a3038',
                              background: 'rgba(232,93,117,0.1)',
                              color: '#e85d75',
                            }}
                          >
                            <Trash2 size={9} strokeWidth={2.4} aria-hidden />
                          </button>
                        </span>
                      )}
                      {studioTrackOutputsMidi(tr) && (
                        <StudioMidiInstrumentPicker
                          compact
                          drumTrack={studioTrackIsDrumChannel(tr)}
                          className="w-full min-w-0 max-w-full self-stretch"
                          value={tr.midiInstrumentId}
                          accentHex={tr.colorHex}
                          title={
                            studioTrackIsDrumChannel(tr)
                              ? `Drum kit or 808 sub for ${tr.name} Â· MIDI Ch ${chNum}`
                              : tr.kind === 'a2m'
                                ? `Playback sound after conversion Â· ${tr.name}`
                                : tr.kind === 'rhythm'
                                  ? `Rhythm lane sound Â· ${tr.name} Â· MIDI Ch ${chNum}`
                                  : `Sound for ${tr.name} Â· MIDI Ch ${chNum}`
                          }
                          onChange={(id) => updateTrackMidiInstrument(ti, id)}
                        />
                      )}
                      {studioTrackIsInstrumentHarmonyChannel(tr) && (
                        <button
                          type="button"
                          disabled={running}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectTrackAndClearPianoNote(ti);
                            setHarmonyPanelOpen(true);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="se2-type-micro shrink-0 flex items-center gap-0.5 rounded border px-1 py-0.5 text-[11px] outline-none disabled:opacity-40"
                          style={{
                            borderColor: '#333340',
                            background: '#16161e',
                            color: '#a8a8b8',
                          }}
                          title={`Progression+ on ${tr.name} — build chords on the timeline, then APPLY TO INSTRUMENT`}
                        >
                          <Music2 size={9} strokeWidth={2.2} aria-hidden />
                          <span>Progression+</span>
                        </button>
                      )}
                      {studioTrackHasMelodicKeyUi(tr) && tr.kind !== 'a2m' && (
                        <span
                          className="flex flex-wrap items-center gap-1 self-start max-w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <StudioTrackKeyMenu
                            compact
                            trackChannel
                            className="min-w-[4rem] max-w-[4.75rem]"
                            keyRoot={studioTrackDetectedKey(tr).keyRoot}
                            keyMode={studioTrackDetectedKey(tr).keyMode}
                            songKeyRoot={songKeyRoot}
                            songKeyMode={songKeyMode}
                            accentHex={tr.colorHex}
                            disabled={running}
                            detectDisabled={running || tr.notes.length === 0}
                            convertDisabled={running || tr.notes.length === 0}
                            title={`Key for ${tr.name}`}
                            onDetect={() => detectTrackKey(ti)}
                            onConvertToSongKey={() => convertTrackToSongKey(ti)}
                          />
                        </span>
                      )}
                      {tr.kind === 'a2m' && tr.a2mDetectedBpm != null && (
                        <span
                          className="text-[11px] font-mono tabular-nums leading-tight"
                          style={{ color: '#a8a8b8' }}
                          title="Tempo detected from audio"
                        >
                          {`${Math.round(tr.a2mDetectedBpm)} BPM`}
                        </span>
                      )}
                      {tr.kind === 'a2m' && tr.audioClips.length > 0 && (
                        <button
                          type="button"
                          className="se2-type-micro self-start rounded border px-1 py-0 text-[11px]"
                          style={{ borderColor: '#4a3a20', color: '#e8c890', background: 'rgba(255,184,77,0.1)' }}
                          disabled={running}
                          title="Re-run Audio â†’ MIDI on all clips in this lane"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            void reconvertA2mTrackClips(ti);
                          }}
                        >
                          Convert
                        </button>
                      )}
                    </button>
                    <div
                      className="shrink-0 flex flex-col items-center self-stretch"
                      style={{ paddingTop: 3, paddingBottom: 6, minWidth: `${Math.max(2, chPad) + 2}ch` }}
                    >
                      <span
                        className="font-mono font-bold tabular-nums text-[13px] leading-none px-0.5 pointer-events-none"
                        style={{
                          color: active ? tr.colorHex : '#6a6a7c',
                          textShadow: active ? `0 0 6px ${tr.colorHex}44` : undefined,
                          textAlign: 'center',
                        }}
                        title={`Channel ${ti + 1}`}
                      >
                        {chNum}
                      </span>
                      <button
                        type="button"
                        aria-label={`Resize all track lanes, ${arrangeLaneH} pixels tall. Drag vertically.`}
                        title={`Lane height: ${arrangeLaneH}px â€” drag up/down`}
                        className="mt-1 flex shrink-0 cursor-ns-resize items-center justify-center rounded px-0.5 opacity-35 transition-opacity hover:opacity-90"
                        style={{ marginBottom: 2 }}
                        onMouseDown={onArrangeLaneResizeStart}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical
                          size={11}
                          strokeWidth={2.15}
                          className="pointer-events-none"
                          style={{ color: active ? tr.colorHex : 'rgba(255,255,255,0.38)' }}
                          aria-hidden
                        />
                      </button>
                    </div>
                    {studioTrackHasMelodicKeyUi(tr) && !studioTrackIsDrumChannel(tr) ? (
                      <StudioTrackGenerateMenu
                        trackChannel
                        iconOnly
                        className="self-center"
                        accentHex={tr.colorHex}
                        disabled={running}
                        hasNotes={tr.notes.length > 0}
                        title={`✦ Generate companion MIDI from notes on ${tr.name} — chord progressions: use Progression+ on this track`}
                        onGenerate={(kind, replace) => generatePartFromTrack(ti, kind, replace)}
                      />
                    ) : null}
                    {active && canClearLaneContent && (
                      <button
                        type="button"
                        title={`Clear all notes on ${tr.name} (keep track)`}
                        aria-label={`Clear lane ${tr.name}`}
                        disabled={running}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          clearTrackLaneContent(ti);
                        }}
                        className="shrink-0 self-center rounded p-0.5 opacity-50 hover:opacity-100 transition-opacity disabled:opacity-20"
                        style={{ color: '#e8c890' }}
                      >
                        <Eraser size={10} strokeWidth={2.2} aria-hidden />
                      </button>
                    )}
                    {active && (
                      <button
                        type="button"
                        title={`Delete track ${tr.name}`}
                        aria-label={`Delete track ${tr.name}`}
            disabled={running}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          deleteStudioTrackAt(ti);
                        }}
                        className="shrink-0 self-center rounded p-0.5 opacity-50 hover:opacity-100 transition-opacity disabled:opacity-20"
                        style={{ color: '#ff8080' }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                          <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            ref={timelineHScrollRef}
            className="relative min-w-0 shrink-0 flex-1 self-start overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onScroll={onTimelineHScroll}
            onWheel={onTimelineWheel}
            aria-label="Timeline lanes"
          >
            <div
              ref={timelineStripRef}
              className="relative shrink-0"
              data-studio-midi-context
              style={{
                width: timelineStripWidthPx,
                height: arrangeLanesH,
                backgroundColor: '#0a0a10',
                lineHeight: 0,
                willChange: 'transform',
              }}
            >
              {/* Hidden — WAAPI timing only; visible playhead is viewport-pinned below. */}
              <div
                ref={playheadWapiTimingRef}
                aria-hidden
                className="pointer-events-none absolute top-0"
                style={{ width: 0, height: 0, overflow: 'hidden', opacity: 0 }}
              />
              {/*
                Lanes/canvas only — strip-level translate handles follow glide; playhead is
                viewport-pinned on the scroll container sibling below.
              */}
              <div
                ref={timelineFollowContentRef}
                className="absolute inset-0"
              >
              <canvas ref={timelineCanvasRef} className="block max-w-none pointer-events-none" style={{ verticalAlign: 'top' }} />
              {/* Growing record take — compositor scaleX locked to playhead WAAPI. */}
              <div
                ref={liveRecordClipElRef}
                className="absolute z-[4] pointer-events-none rounded-[2px]"
                style={{
                  display: 'none',
                  left: 0,
                  top: 0,
                  width: 0,
                  height: 0,
                  transformOrigin: 'left center',
                  willChange: 'transform',
                  transform: 'scaleX(0)',
                }}
                aria-hidden
              />
              {/* Lane gestures: select track / draw & edit MIDI (tools match piano roll toolbar). */}
              <div
                className="absolute inset-0 z-[6]"
                style={{
                  cursor:
                    timelineTool === 'scrub'
                      ? 'ew-resize'
                      : timelineTool === 'slice'
                        ? 'crosshair'
                        : pianoTool === 'pencil'
                          ? 'crosshair'
                          : pianoTool === 'erase'
                            ? 'cell'
                            : 'default',
                  touchAction: 'none',
                  userSelect: 'none',
                }}
                aria-hidden
                onDragOver={onStudioTimelineAudioLaneDragOver}
                onDrop={(e) => void onStudioTimelineAudioLaneDrop(e)}
                onContextMenu={onTimelineLaneMidiContextMenu}
                onPointerDown={onTimelineLanePointerDown}
                onPointerMove={onTimelineLanePointerMove}
                onPointerUp={onTimelineLanePointerUp}
                onPointerCancel={onTimelineLanePointerUp}
                title={
                  timelineTool === 'scrub'
                    ? 'Drag anywhere to scrub playhead (free) · Shift = bar snap · Alt = free placement'
                    : timelineTool === 'slice'
                      ? 'Drag on audio clips to slice · Alt = free · Shift = bar'
                      : pianoTool === 'select'
                        ? 'Select clips & notes · click empty lane = step playhead · drag green playhead = free scrub · Alt = free click'
                        : undefined
                }
              />
              {timelineMarqueeBox && (
                <div
                  className="absolute z-[3] pointer-events-none"
                  style={{
                    left: timelineMarqueeBox.left,
                    top: timelineMarqueeBox.top,
                    width: timelineMarqueeBox.width,
                    height: timelineMarqueeBox.height,
                    border: '1px solid rgba(124,244,198,0.85)',
                    background: 'rgba(124,244,198,0.14)',
                  }}
                  aria-hidden
                />
              )}
              {/* Loop tint over lanes only */}
              {loopOn && (
                <div
                  className="absolute inset-y-0 pointer-events-none z-[1]"
                  style={{
                    left: beatColumnLeftPx(loopStartBeat, ppbAtZoom(zoom, beatsPerBar)),
                    width: Math.max(0, beatColumnLeftPx(loopEndBeat, ppbAtZoom(zoom, beatsPerBar)) - beatColumnLeftPx(loopStartBeat, ppbAtZoom(zoom, beatsPerBar))),
                    background: 'rgba(124,244,198,0.05)',
                    boxShadow: 'inset 0 0 0 1px rgba(124,244,198,0.15)',
                  }}
                  aria-hidden
                />
              )}
              {/* Playheads above the hit layer; pointer-events none so clicks reach the overlay. */}
              <div
                ref={loopPlayheadGroupRef}
                className="absolute top-0 bottom-0 z-[7] flex justify-center pointer-events-none select-none"
                style={{
                  width: PLAYHEAD_GRIP_W_PX,
                  visibility: 'hidden',
                  willChange: 'left, transform',
                }}
                aria-hidden
              >
                <div
                  ref={loopPlayheadLineRef}
                  data-loop-playhead-line
                  className="absolute top-0 bottom-0 pointer-events-none rounded-[1px]"
                  style={{
                    left: (PLAYHEAD_GRIP_W_PX - PLAYHEAD_W_PX) / 2,
                    width: PLAYHEAD_W_PX,
                    background: 'linear-gradient(180deg, #b8fff0 0%, #6ef0c8 50%, #3dd9a8 100%)',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.35), 0 0 8px rgba(110,240,200,0.45)',
                    willChange: 'transform',
                  }}
                />
              </div>
              <div
                ref={playheadGroupRef}
                className="absolute top-0 bottom-0 z-[7] flex justify-center pointer-events-none select-none"
                style={{
                  width: PLAYHEAD_GRIP_W_PX,
                  cursor: 'default',
                  touchAction: 'none',
                  willChange: 'left, transform',
                }}
                aria-hidden
              >
                <div
                  ref={playheadLineRef}
                  data-playhead-line
                  className="absolute top-0 bottom-0 pointer-events-none rounded-[1px]"
                  style={{
                    left: (PLAYHEAD_GRIP_W_PX - PLAYHEAD_W_PX) / 2,
                    width: PLAYHEAD_W_PX,
                    background: 'linear-gradient(180deg, #9fffd8 0%, #5ee9b4 50%, #34d399 100%)',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.35), 0 0 6px rgba(52,211,153,0.28)',
                    willChange: 'transform',
                  }}
                />
              </div>
              </div>
            </div>
          </div>
            </div>
            </div>
            <div
              className="flex shrink-0 flex-row border-t"
              style={{ borderColor: '#141418', background: '#08080c' }}
            >
              <div className="shrink-0" style={{ width: TRACK_HEADER_W_PX }} aria-hidden />
              <div
                ref={timelineHBarRef}
                className="studio-editor2-timeline-hbar min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
                aria-label="Scroll timeline horizontally"
                title="Drag to scroll through bars"
                onPointerDown={() => {
                  if (timelineEdgeFollowActiveRef.current) clearTimelineEdgeFollow();
                }}
                onScroll={onTimelineHBarScroll}
              >
                <div style={{ width: timelineStripWidthPx, height: 1 }} aria-hidden />
              </div>
            </div>
          </div>
        </div>
        {!beatPadsFullscreenActive && !pianoRollExpanded && (
          <MusioPianoRollPanel
            visible={showPianoRollInLayout}
            panelHeight={pianoPanelH}
            expanded={false}
            onToggleExpanded={() => setPianoRollExpanded(true)}
            onResizeStart={onPianoResizeStart}
            zoom={zoom}
            beatsPerBar={beatsPerBar}
            snapSubdivisions={pianoSnapSubdivisions}
            onBeatsPerBarChange={setBeatsPerBar}
            onSnapSubdivisionsChange={setPianoSnapSubdivisions}
            tracks={studioTracks}
            selectedTrackIndex={selectedTrackIndex}
            onSelectTrackIndex={selectTrackAndClearPianoNote}
            onUpdateTrackNotes={updateTrackNotes}
            tool={pianoTool}
            onToolChange={setPianoTool}
            selectedNoteIndex={selectedPianoNoteIndex}
            selectedNoteIndexes={selectedPianoNoteIndexes}
            onSelectNoteIndex={setSelectedPianoNoteIndex}
            onToggleNoteIndex={togglePianoNoteSelection}
            onSelectOnlyNoteIndex={selectOnlyPianoNote}
            onSetSelectedNoteIndexes={setSelectedPianoNoteIndexes}
            onClearSelectedNotes={clearSelectedPianoNotes}
            playheadRef={pianoPlayheadRef}
            running={running}
            loopOn={loopOn}
            onLoopOnChange={setLoopOn}
            loopBars={loopBars}
            onLoopBarsChange={(n: number) => {
              lockUserLoopRegion(n, loopStartBeat);
            }}
            loopStartBeat={loopStartBeat}
            loopEndBeat={loopEndBeat}
            onPauseForEdit={pauseTransport}
            onSeekFromPianoRuler={seekFromPianoStripX}
            onPreviewPitch={previewPianoPitch}
            onNotesContextMenu={handlePianoRollNotesContextMenu}
            onQuantizeSelected={quantizeSelected}
            onDuplicateSelectedPhrase={duplicateSelectedPhrase}
            onTransposeSelected={transposeSelected}
            onTransposeAllTrackNotes={transposeAllTrackNotes}
            onHumanizeSelected={humanizeSelected}
            onLegatoSelected={legatoSelected}
            onArpeggiateSelected={arpeggiateSelected}
            onStrumSelected={strumSelected}
            onChopSelected={chopSelected}
            onRandomizeVelocitySelected={randomizeVelocitySelected}
            onQuantizeStrengthChange={setQuantizeStrength}
            quantizeStrength={quantizeStrength}
            onQuantizeSwingChange={setQuantizeSwing}
            quantizeSwing={quantizeSwing}
            showGhostNotes={showGhostNotes}
            onShowGhostNotesChange={setShowGhostNotes}
            showScaleGuides={showScaleGuides}
            onShowScaleGuidesChange={setShowScaleGuides}
            songKeyRoot={songKeyRoot}
            songKeyMode={songKeyMode}
            onDetectTrackKey={() => detectTrackKey(selectedTrackIndex)}
            onConvertTrackToSongKey={() => convertTrackToSongKey(selectedTrackIndex)}
            pitchView={pianoPitchView}
            drumKeyLabelForPitch={drumKeyLabelForPitch}
            onClearPattern={
              canClearDrumPattern ? () => clearDrumPatternOnTrack(selectedTrackIndex) : undefined
            }
            clearPatternDisabled={running}
            harmonyToolbar={pianoRollHarmonyToolbar}
            rhythmEditPanel={pianoRollRhythmEditPanel}
            glideBassEditPanel={pianoRollGlideBassEditPanel}
            glideBassStripOpen={pianoRollGlideBassStripOpen}
            synthGenoEditPanel={pianoRollSynthGenoEditPanel}
            synthGenoStripOpen={pianoRollSynthGenoStripOpen}
            synthGenoBuildFullscreenOpen={pianoRollSynthGenoBuildFullscreenOpen}
            grooveLeadEditPanel={pianoRollGrooveLeadEditPanel}
            grooveLeadStripOpen={pianoRollGrooveLeadStripOpen}
            lab808EditPanel={pianoRollLab808EditPanel}
            lab808StripOpen={pianoRollLab808StripOpen}
            genoUltraSynthEditPanel={pianoRollGenoUltraSynthEditPanel}
            genoUltraSynthStripOpen={pianoRollGenoUltraSynthStripOpen}
            genoBassSynthEditPanel={pianoRollGenoBassSynthEditPanel}
            genoBassSynthStripOpen={pianoRollGenoBassSynthStripOpen}
            humCaptureEditPanel={pianoRollHumCaptureEditPanel}
            humCaptureStripOpen={pianoRollHumCaptureStripOpen}
            guitarEditPanel={pianoRollGuitarEditPanel}
            guitarStripOpen={pianoRollGuitarStripOpen}
            drumGeneratorEditPanel={pianoRollDrumGeneratorEditPanel}
            drumGeneratorStripOpen={pianoRollDrumGeneratorStripOpen}
            chordGenieEditPanel={pianoRollChordGenieEditPanel}
            chordGenieStripOpen={pianoRollChordGenieStripOpen}
            beatPadsEditPanel={pianoRollBeatPadsEditPanel}
            beatPadsStripOpen={pianoRollBeatPadsStripOpen}
            onMidiInstrumentChange={
              showGlideBassUi || showSynthGenoUi || showGrooveLeadUi || showLab808Ui || showGenoUltraSynthUi || showGenoBassSynthUi || showHumCaptureUi || showGuitarUi || showGenoChordCreatorUi || showDrumGeneratorUi || showBeatPadsUi
                ? undefined
                : onPianoRollMidiInstrumentChange
            }
            glideBassPresetId={
              showGlideBassUi
                ? se2NormalizeGlideBassPresetId(glideBassEligibleTrack?.glideBassPresetId)
                : undefined
            }
            synthGenoPatchLabel={
              showSynthGenoUi ? synthGenoEligibleTrack?.synthGenoPatchLabel : undefined
            }
            grooveLeadPatchLabel={
              showGrooveLeadUi && grooveLeadEligibleTrack
                ? se2GrooveLeadPatchLabelFromTrack(grooveLeadEligibleTrack)
                : undefined
            }
            lab808PatchLabel={
              showLab808Ui && lab808EligibleTrack
                ? se2Lab808PatchLabelFromTrack(
                    lab808EligibleTrack,
                    se2Lab808Voices[selectedTrackIndex],
                  )
                : undefined
            }
            genoUltraPatchLabel={
              showGenoUltraSynthUi && genoUltraEligibleTrack
                ? se2GenoUltraPatchLabelFromTrack(genoUltraEligibleTrack)
                : undefined
            }
            genoBassPatchLabel={
              showGenoBassSynthUi && genoBassEligibleTrack
                ? se2GenoBassPatchLabelFromTrack(genoBassEligibleTrack)
                : undefined
            }
            humCaptureInstrumentLabel={
              showHumCaptureUi && humCaptureEligibleTrack
                ? neuralHumInstrumentMeta(humCaptureEligibleTrack.humCaptureInstrumentId ?? 'piano').label
                : undefined
            }
            guitarInstrumentLabel={
              showGuitarUi && guitarEligibleTrack
                ? se2GuitarInstrumentLabelFromTrack(guitarEligibleTrack as import('@/app/lib/studio/se2GuitarTrack').Se2GuitarTrack)
                : undefined
            }
          />
        )}

        {!beatPadsFullscreenActive && showPianoRollInLayout && pianoRollExpanded &&
            <div
              className="absolute inset-0 z-[220] flex min-h-0 flex-col overflow-hidden"
              style={{ background: 'linear-gradient(165deg, #0c0c12 0%, #07070b 55%, #060609 100%)' }}
            >
              <MusioPianoRollPanel
                visible
                panelHeight={pianoPanelH}
                expanded
                onToggleExpanded={() => setPianoRollExpanded(false)}
                onResizeStart={onPianoResizeStart}
                zoom={zoom}
                beatsPerBar={beatsPerBar}
                snapSubdivisions={pianoSnapSubdivisions}
                onBeatsPerBarChange={setBeatsPerBar}
                onSnapSubdivisionsChange={setPianoSnapSubdivisions}
                tracks={studioTracks}
                selectedTrackIndex={selectedTrackIndex}
                onSelectTrackIndex={selectTrackAndClearPianoNote}
                onUpdateTrackNotes={updateTrackNotes}
                tool={pianoTool}
                onToolChange={setPianoTool}
                selectedNoteIndex={selectedPianoNoteIndex}
                selectedNoteIndexes={selectedPianoNoteIndexes}
                onSelectNoteIndex={setSelectedPianoNoteIndex}
                onToggleNoteIndex={togglePianoNoteSelection}
                onSelectOnlyNoteIndex={selectOnlyPianoNote}
                onSetSelectedNoteIndexes={setSelectedPianoNoteIndexes}
                onClearSelectedNotes={clearSelectedPianoNotes}
                playheadRef={pianoPlayheadRef}
                running={running}
                loopOn={loopOn}
                onLoopOnChange={setLoopOn}
                loopBars={loopBars}
                onLoopBarsChange={(n: number) => {
                  lockUserLoopRegion(n, loopStartBeat);
                }}
                loopStartBeat={loopStartBeat}
                loopEndBeat={loopEndBeat}
                onPauseForEdit={pauseTransport}
                onSeekFromPianoRuler={seekFromPianoStripX}
                onPreviewPitch={previewPianoPitch}
                onNotesContextMenu={handlePianoRollNotesContextMenu}
                onQuantizeSelected={quantizeSelected}
                onDuplicateSelectedPhrase={duplicateSelectedPhrase}
                onTransposeSelected={transposeSelected}
                onTransposeAllTrackNotes={transposeAllTrackNotes}
                onHumanizeSelected={humanizeSelected}
                onLegatoSelected={legatoSelected}
                onArpeggiateSelected={arpeggiateSelected}
                onStrumSelected={strumSelected}
                onChopSelected={chopSelected}
                onRandomizeVelocitySelected={randomizeVelocitySelected}
                onQuantizeStrengthChange={setQuantizeStrength}
                quantizeStrength={quantizeStrength}
                onQuantizeSwingChange={setQuantizeSwing}
                quantizeSwing={quantizeSwing}
                showGhostNotes={showGhostNotes}
                onShowGhostNotesChange={setShowGhostNotes}
                showScaleGuides={showScaleGuides}
                onShowScaleGuidesChange={setShowScaleGuides}
                songKeyRoot={songKeyRoot}
                songKeyMode={songKeyMode}
                onDetectTrackKey={() => detectTrackKey(selectedTrackIndex)}
                onConvertTrackToSongKey={() => convertTrackToSongKey(selectedTrackIndex)}
                pitchView={pianoPitchView}
                drumKeyLabelForPitch={drumKeyLabelForPitch}
                onClearPattern={
                  canClearDrumPattern ? () => clearDrumPatternOnTrack(selectedTrackIndex) : undefined
                }
                clearPatternDisabled={running}
                harmonyToolbar={pianoRollHarmonyToolbar}
                rhythmEditPanel={pianoRollRhythmEditPanel}
                glideBassEditPanel={pianoRollGlideBassEditPanel}
                glideBassStripOpen={pianoRollGlideBassStripOpen}
                synthGenoEditPanel={pianoRollSynthGenoEditPanel}
                synthGenoStripOpen={pianoRollSynthGenoStripOpen}
                synthGenoBuildFullscreenOpen={pianoRollSynthGenoBuildFullscreenOpen}
                grooveLeadEditPanel={pianoRollGrooveLeadEditPanel}
                grooveLeadStripOpen={pianoRollGrooveLeadStripOpen}
                lab808EditPanel={pianoRollLab808EditPanel}
                lab808StripOpen={pianoRollLab808StripOpen}
                genoUltraSynthEditPanel={pianoRollGenoUltraSynthEditPanel}
                genoUltraSynthStripOpen={pianoRollGenoUltraSynthStripOpen}
                humCaptureEditPanel={pianoRollHumCaptureEditPanel}
                humCaptureStripOpen={pianoRollHumCaptureStripOpen}
                guitarEditPanel={pianoRollGuitarEditPanel}
                guitarStripOpen={pianoRollGuitarStripOpen}
                drumGeneratorEditPanel={pianoRollDrumGeneratorEditPanel}
                drumGeneratorStripOpen={pianoRollDrumGeneratorStripOpen}
                chordGenieEditPanel={pianoRollChordGenieEditPanel}
                chordGenieStripOpen={pianoRollChordGenieStripOpen}
                beatPadsEditPanel={pianoRollBeatPadsEditPanel}
                beatPadsStripOpen={pianoRollBeatPadsStripOpen}
                onMidiInstrumentChange={
                  showGlideBassUi || showSynthGenoUi || showGrooveLeadUi || showLab808Ui || showGenoUltraSynthUi || showGenoBassSynthUi || showHumCaptureUi || showGuitarUi || showGenoChordCreatorUi || showDrumGeneratorUi || showBeatPadsUi
                    ? undefined
                    : onPianoRollMidiInstrumentChange
                }
                glideBassPresetId={
                  showGlideBassUi
                    ? se2NormalizeGlideBassPresetId(glideBassEligibleTrack?.glideBassPresetId)
                    : undefined
                }
                synthGenoPatchLabel={
                  showSynthGenoUi ? synthGenoEligibleTrack?.synthGenoPatchLabel : undefined
                }
                grooveLeadPatchLabel={
                  showGrooveLeadUi && grooveLeadEligibleTrack
                    ? se2GrooveLeadPatchLabelFromTrack(grooveLeadEligibleTrack)
                    : undefined
                }
                lab808PatchLabel={
                  showLab808Ui && lab808EligibleTrack
                    ? se2Lab808PatchLabelFromTrack(
                        lab808EligibleTrack,
                        se2Lab808Voices[selectedTrackIndex],
                      )
                    : undefined
                }
                genoUltraPatchLabel={
                  showGenoUltraSynthUi && genoUltraEligibleTrack
                    ? se2GenoUltraPatchLabelFromTrack(genoUltraEligibleTrack)
                    : undefined
                }
                humCaptureInstrumentLabel={
                  showHumCaptureUi && humCaptureEligibleTrack
                    ? neuralHumInstrumentMeta(humCaptureEligibleTrack.humCaptureInstrumentId ?? 'piano').label
                    : undefined
                }
                guitarInstrumentLabel={
                  showGuitarUi && guitarEligibleTrack
                    ? se2GuitarInstrumentLabelFromTrack(guitarEligibleTrack as import('@/app/lib/studio/se2GuitarTrack').Se2GuitarTrack)
                    : undefined
                }
              />
            </div>}

        {/* ── Audio Channel Mixer Panel ── */}
        {showMixer && !beatPadsFullscreenActive && (
          <div
            data-studio-mixer
            className="shrink-0 flex flex-col border-t select-none"
            style={{
              height: mixerPanelH,
              borderColor: '#1a1a22',
              background: '#07070a',
            }}
            onPointerDown={() => {
              const ctx = ctxRef.current;
              if (ctx && ctx.state === 'suspended') {
                void ctx.resume().catch(() => {
                  /* autoplay policy */
                });
              }
            }}
          >
            {/* Resize handle */}
            <button
              type="button"
              aria-label="Resize mixer panel"
              onMouseDown={onMixerResizeStart}
              className="w-full shrink-0 flex items-center justify-center cursor-ns-resize group"
              style={{ height: 8, background: 'transparent', border: 'none', padding: 0 }}
            >
              <div
                className="rounded-full group-hover:opacity-100 transition-opacity"
                style={{ width: 32, height: 3, background: '#3a3a48', opacity: 0.5 }}
              />
            </button>

            {/* Toolbar */}
            <div
              className="shrink-0 flex items-center gap-2 px-2 border-b"
              style={{ height: 24, borderColor: '#1a1a22' }}
            >
              <SlidersHorizontal size={11} style={{ color: '#9defff' }} />
              <span className="se2-mixer-channels-title inline-flex items-center gap-1" style={{ color: '#9defff' }}>
                Audio Channels
                <StudioEditor2HelpTip tab="mixer" title="Channel mixer & record arm" />
              </span>
              <span className="text-[8px] font-medium truncate min-w-0" style={{ color: '#4a4a58' }}>
                FX per strip Â· {studioTracks.length} track{studioTracks.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Ultra wood rail — top edge of channel strips (under Audio Channels) */}
            <div className="se2-mixer-wood-rail" aria-hidden />

            {/* Channel strips — tracks scroll; master pinned right (Studio One–style) */}
            <div className="flex-1 min-h-0 flex overflow-hidden" style={{ background: '#0a0a0f' }}>
              <div
                ref={mixerTrackScrollRef}
                className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden"
              >
              <div className="flex h-full justify-end" style={{ gap: 1, minWidth: 'max-content' }}>

                {/* T01 hugs master; higher lane numbers extend left (Studio One–style). */}
                {studioTracks.map((tr, i) => ({ tr, i })).reverse().map(({ tr, i }) => {
                  const stripTrackLabel = se2FormatTrackNumber(tr.laneNumber ?? i + 1, studioLanePad);
                  const midiCh = studioTrackOutputsMidi(tr)
                    ? studioMidiChannelForTrack(i, studioTracks)
                    : null;
                  const stripHasMidiUi = studioTrackOutputsMidi(tr);
                  const vol      = trackVolumes[i] ?? MIXER_UNITY_VOL;
                  const pan      = trackPans[i] ?? 64;
                  const muted    = trackMutes[i] ?? false;
                  const soloed   = trackSolos[i] ?? false;
                  const monoOn   = trackMonos[i] ?? false;
                  const recArm   = trackRecordArmed[i] ?? false;
                  const stripSelected = i === selectedTrackIndex;
                  const panOff   = pan - 64;
                  const panLabel = panOff === 0 ? 'C' : panOff > 0 ? `R${panOff}` : `L${Math.abs(panOff)}`;
                  const dbLabel  = formatMixerFaderDb(vol);
                  const faderTracking = mixerFaderActive?.kind === 'track' && mixerFaderActive.index === i;

                  return (
                    /* â”€â”€ Ohm Studio-style channel strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                     * Layout: narrow strip, charcoal bg, color accent under name,
                     * fader + meters side-by-side as one integrated tall column.    */
                    <div
                      key={tr.id}
                      data-studio-mixer-strip={tr.id}
                      className="flex flex-col shrink-0 h-full"
                      onClick={() => selectTrackAndClearPianoNote(i)}
                      style={{
                        width: MIXER_STRIP_W_PX,
                        cursor: 'pointer',
                        background: stripSelected
                          ? `linear-gradient(90deg, rgba(124,244,198,0.12) 0%, rgba(19,19,24,0.95) 52%)`
                          : '#131318',
                        borderRight: '1px solid #1e1e28',
                        boxShadow: stripSelected
                          ? `inset 3px 0 0 ${tr.colorHex}, inset 0 0 0 1px rgba(255,255,255,0.06)`
                          : undefined,
                      }}
                    >
                      {/* â”€â”€ Track name + instrument (MIDI lanes) â”€â”€ */}
                      <div
                        className="shrink-0 flex flex-col items-center justify-center gap-0.5 px-1 w-full overflow-hidden"
                        style={{
                          height: MIXER_STRIP_HEADER_H_PX,
                          minHeight: MIXER_STRIP_HEADER_H_PX,
                          maxHeight: MIXER_STRIP_HEADER_H_PX,
                          paddingTop: 2,
                          paddingBottom: 2,
                          background: '#1a1a22',
                          borderBottom: `2px solid ${tr.colorHex}`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <span
                          className={`truncate w-full text-center ${TRACK_NAME_MIXER_CLASS}`}
                          style={{ color: muted ? '#3a3a50' : '#a8a8bc' }}
                          title={se2TrackNumberedName(tr.laneNumber, tr.name, studioLanePad)}
                        >
                          {se2TrackNumberedName(tr.laneNumber, tr.name, studioLanePad)}
                        </span>
                        {tr.kind === 'a2m' && (
                          <StudioAudioToMidiModePicker
                            compact
                            className="w-full max-w-[92px]"
                            value={tr.a2mMode}
                            accentHex={tr.colorHex}
                            disabled={running}
                            title={`Audio â†’ MIDI mode for ${tr.name}`}
                            onChange={(mode) => updateTrackA2mMode(i, mode)}
                          />
                        )}
                        {studioTrackIsSynthGenoChannel(tr) && (
                          <span
                            className="truncate w-full text-center text-[7px] font-bold uppercase tracking-wide"
                            style={{ color: tr.colorHex }}
                            title={`Synth Geno · ${tr.synthGenoPatchLabel ?? 'Init Geno'}`}
                          >
                            Geno · {tr.synthGenoPatchLabel ?? 'Init'}
                          </span>
                        )}
                        {studioTrackIsGrooveLeadChannel(tr) && (
                          <span
                            className="truncate w-full text-center text-[7px] font-bold uppercase tracking-wide"
                            style={{ color: tr.colorHex }}
                            title={`Groove Lead · ${se2GrooveLeadPatchLabelFromTrack(tr)}`}
                          >
                            Lead · {se2GrooveLeadPatchLabelFromTrack(tr)}
                          </span>
                        )}
                        {studioTrackIsGenoUltraSynthChannel(tr) && (
                          <span
                            className="truncate w-full text-center text-[7px] font-bold uppercase tracking-wide"
                            style={{ color: tr.colorHex }}
                            title={`Geno Ultra · ${se2GenoUltraPatchLabelFromTrack(tr)}`}
                          >
                            Ultra · {se2GenoUltraPatchLabelFromTrack(tr)}
                          </span>
                        )}
                        {studioTrackIsHumCaptureChannel(tr) && (
                          <span
                            className="truncate w-full text-center text-[7px] font-bold uppercase tracking-wide"
                            style={{ color: tr.colorHex }}
                            title={`Hum / Melody Capture · ${neuralHumInstrumentMeta(tr.humCaptureInstrumentId ?? 'piano').label}`}
                          >
                            Hum / Melody · {neuralHumInstrumentMeta(tr.humCaptureInstrumentId ?? 'piano').label}
                          </span>
                        )}
                        {studioTrackIsGuitarChannel(tr) && (
                          <span
                            className="truncate w-full text-center text-[7px] font-bold uppercase tracking-wide"
                            style={{ color: tr.colorHex }}
                            title={`Guitar · ${se2GuitarInstrumentLabelFromTrack(tr)}`}
                          >
                            Guitar · {se2GuitarInstrumentLabelFromTrack(tr)}
                          </span>
                        )}
                        {stripHasMidiUi &&
                          !studioTrackIsGlideBassChannel(tr) &&
                          !studioTrackIsSynthGenoChannel(tr) &&
                          !studioTrackIsGrooveLeadChannel(tr) &&
                          !studioTrackIsGenoUltraSynthChannel(tr) &&
                          !studioTrackIsHumCaptureChannel(tr) &&
                          !studioTrackIsGuitarChannel(tr) && (
                          <StudioMidiInstrumentPicker
                            compact
                            drumTrack={studioTrackIsDrumChannel(tr)}
                            className="w-full max-w-[92px]"
                            value={tr.midiInstrumentId}
                            accentHex={tr.colorHex}
                            title={
                              studioTrackIsDrumChannel(tr)
                                ? `Drum kit or 808 sub · ${stripTrackLabel} · ${tr.name}`
                                : tr.kind === 'a2m'
                                  ? `Playback instrument · ${stripTrackLabel} · ${tr.name}`
                                  : `Instrument for ${stripTrackLabel} · ${tr.name}${
                                      midiCh != null ? ` · MIDI out ch ${midiCh}` : ''
                                    }`
                            }
                            onChange={(id) => updateTrackMidiInstrument(i, id)}
                          />
                        )}
                      </div>

                      {/* â”€â”€ Fader + Meters integrated area â”€â”€ */}
                      <div className="flex-1 flex min-h-0 w-full px-2 py-1 gap-2">
                        {/* Fader column */}
                        <div
                          className="relative flex-1 flex items-center justify-center min-h-0 min-w-0 overflow-hidden"
                          style={{ paddingLeft: 8, paddingRight: 2 }}
                        >
                          {/* Rail groove â€” inset, dark; shifted slightly right to leave room for scale labels */}
                          <div
                            className="absolute"
                            style={{
                              width: 3, top: MIXER_FADER_INSET_TOP_PX, bottom: MIXER_FADER_INSET_BOTTOM_PX, left: MIXER_FADER_RAIL_LEFT, transform: 'translateX(-50%)',
                              background: '#0a0a12',
                              borderRadius: 2,
                              boxShadow: 'inset 0 2px 4px rgba(0,0,0,1), inset 0 0 0 1px rgba(0,0,0,0.5)',
                            }}
                          />
                          {/* Colour fill strip â€” from bottom to knob */}
                          <div
                            className="absolute"
                            style={{
                              width: 3, bottom: MIXER_FADER_INSET_BOTTOM_PX, left: MIXER_FADER_RAIL_LEFT, transform: 'translateX(-50%)',
                              height: mixerFaderFillHeight(vol),
                              background: muted ? '#252530' : tr.colorHex,
                              opacity: muted ? 1 : 0.7,
                              borderRadius: 2,
                              transition: 'height 0.04s',
                            }}
                          />

                          {/* dB scale â€” printed +6 â€¦ âˆ’60 (use readout for âˆ’âˆž at minimum) */}
                          {MIXER_FADER_DB_TICKS.map(({ label, vol: v }) => {
                            const btm = mixerFaderTravelBottom(v);
                            const isZero = label === '0';
                            const isFloor60 = label === '-60';
                            return (
                              <div
                                key={`tr-${i}-${v}-${label}`}
                                className="absolute pointer-events-none flex flex-row items-center justify-end"
                                style={{
                                  bottom: btm,
                                  left: MIXER_DB_SCALE_EDGE_LEFT_PX,
                                  right: MIXER_DB_SCALE_EDGE_RIGHT,
                                  transform: 'translateY(50%)',
                                  zIndex: 3,
                                }}
                              >
                                <span style={{
                                  fontSize: 10,
                                  fontFamily: 'ui-monospace, SF Mono, monospace',
                                  lineHeight: 1.2,
                                  whiteSpace: 'nowrap',
                                  marginRight: 6,
                                  display: 'inline-block',
                                  textAlign: 'right' as const,
                                  minWidth: '3ch',
                                  color: isZero ? '#f0f0ff' : isFloor60 ? '#f4f4ff' : '#d8d8ee',
                                  fontWeight: isZero ? 800 : isFloor60 ? 700 : 600,
                                  textShadow: '0 1px 2px rgba(0,0,0,0.95)',
                                  letterSpacing: isZero ? 0 : '0.02em',
                                  ...(isFloor60
                                    ? {
                                        background: 'rgba(16,16,24,0.97)',
                                        padding: '1px 3px',
                                        borderRadius: 2,
                                        boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
                                      }
                                    : {}),
                                }}>{label}</span>
                                <div style={{
                                  width: isZero ? 8 : 5,
                                  height: isZero ? 2 : 1,
                                  flexShrink: 0,
                                  background: isZero ? '#d8d8f0' : '#9898b8',
                                  boxShadow: isZero ? '0 0 3px rgba(220,220,248,0.35)' : 'none',
                                  borderRadius: 0.5,
                                }} />
                              </div>
                            );
                          })}

                          {/* Interaction: hidden range */}
          <input
                            type="range" min={0} max={127} value={vol}
                            onChange={(e) => { const n = [...trackVolumes]; n[i] = Number(e.target.value); setTrackVolumes(n); }}
                            onPointerDown={(e) => { e.stopPropagation(); setMixerFaderActive({ kind: 'track', index: i }); }}
                            style={{ writingMode: 'vertical-lr', direction: 'rtl', position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'ns-resize' }}
                            title={`${tr.name}: ${dbLabel} dB`}
                          />
                          {/* Fader knob â€” taller capsule so it's easy to grab and drag */}
                          <div
                            className="absolute pointer-events-none"
                            style={{
                              width: 26, height: MIXER_FADER_KNOB_H_PX,
                              bottom: mixerFaderKnobBottom(vol),
                              left: MIXER_FADER_RAIL_LEFT, transform: 'translateX(-50%)', zIndex: 2,
                              borderRadius: 4,
                              background: muted
                                ? 'linear-gradient(180deg, #3a3a4a 0%, #282832 100%)'
                                : 'linear-gradient(180deg, #dcdce8 0%, #aaaabc 40%, #8888a0 70%, #606072 100%)',
                              boxShadow: muted
                                ? 'none'
                                : '0 3px 7px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -1px 0 rgba(0,0,0,0.3)',
                              transition: 'bottom 0.04s',
                            }}
                          >
                            {/* Level arrow â€” points at printed dB; glows while dragging */}
                            <div
                              aria-hidden
                              style={{
                                position: 'absolute',
                                left: -6,
                                top: 2,
                                width: 0,
                                height: 0,
                                borderTop: '3px solid transparent',
                                borderBottom: '3px solid transparent',
                                borderRight: `6px solid ${
                                  faderTracking ? '#7cf4c6' : muted ? '#5a5a68' : tr.colorHex
                                }`,
                                filter: faderTracking
                                  ? 'drop-shadow(0 0 8px rgba(124,244,198,0.95)) drop-shadow(0 0 4px rgba(124,244,198,0.6))'
                                  : undefined,
                              }}
                            />
                            {/* Top grip line */}
                            <div style={{ position: 'absolute', inset: '0 5px', top: 5, height: 1, background: muted ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.3)', borderRadius: 1 }} />
                            {/* Centre indicator line */}
                            <div style={{ position: 'absolute', inset: '0 4px', top: 9, height: 1, background: muted ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.5)', borderRadius: 1 }} />
                            {/* Bottom grip line */}
                            <div style={{ position: 'absolute', inset: '0 5px', top: 13, height: 1, background: muted ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.3)', borderRadius: 1 }} />
                          </div>
                        </div>

                        {/* Meters — Studio One–style glass panel + LED L/R segments */}
                        <div
                          className={`se2-mixer-vu-glass${monoOn ? ' se2-mixer-vu-glass--mono' : ''}`}
                          aria-hidden
                        >
                          {(['L', 'R'] as const).map((ch, ci) => (
                            <div key={ch} className="se2-mixer-vu-col">
                              <div
                                ref={(el) => {
                                  if (ci === 0) mixerMeterLsRef.current[i] = el;
                                  else mixerMeterRsRef.current[i] = el;
                                }}
                                className="se2-mixer-vu-led-fill"
                                style={{
                                  height: '0%',
                                  background: muted
                                    ? 'rgba(40,40,52,0.85)'
                                    : 'linear-gradient(to top, #00b84a 0%, #12e86a 55%, #5dff9a 100%)',
                                }}
                              />
                              <div className="se2-mixer-vu-glass-sheen" />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* â”€â”€ FX: under meters â€” CH + index left, F|X right (room for 3-digit indices) â”€â”€ */}
                      <div
                        className="shrink-0 flex w-full items-center justify-between gap-1 px-1"
                        style={{
                          paddingTop: 2,
                          paddingBottom: 2,
                          borderTop: '1px solid #1a1a22',
                          background: 'linear-gradient(180deg, #101018 0%, #0c0c10 100%)',
                        }}
                      >
                        <div
                          className="flex shrink-0 min-w-0 items-baseline gap-1"
                          style={{ paddingLeft: 2 }}
                          title={`Studio track ${stripTrackLabel}`}
                        >
        <span
                            className="font-black tabular-nums leading-none tracking-tight"
                            style={{
                              fontSize: 10,
                              minWidth: `${studioLanePad + 1}ch`,
                              textAlign: 'right',
                              color: stripSelected ? tr.colorHex : '#ececf4',
                              textShadow: stripSelected ? `0 0 8px ${tr.colorHex}55` : '0 1px 2px rgba(0,0,0,0.95)',
                            }}
                          >
                            {stripTrackLabel}
        </span>
                          <span
                            className="font-mono tabular-nums transition-all text-[8px]"
                            style={{
                              lineHeight: 1,
                              color: muted ? '#2e2e40' : faderTracking ? '#7cf4c6' : '#585868',
                              textShadow: faderTracking ? '0 0 8px rgba(124,244,198,0.45)' : undefined,
                            }}
                            title={`${tr.name} level`}
                          >
                            {dbLabel}
                          </span>
                        </div>
                        <div className="flex shrink-0">
                          <ChannelStripFxButton
                            variant="track"
                            channelLabel={stripTrackLabel}
                            slots={trackFxSlots[i] ?? emptyMixerFxSlots()}
                            onSlotChange={(slot, id) => onTrackFxSlotChange(i, slot, id)}
                            trackAccentHex={tr.colorHex}
                            onActivate={() => selectTrackAndClearPianoNote(i)}
                            insertFxRack={trackInsertFxRacks[i] ?? defaultStudioTrackInsertFxRack()}
                            onInsertFxRackChange={(rack) => onTrackInsertFxRackChange(i, rack)}
                            vocalFx={trackVocalFx[i] ?? STUDIO_TRACK_VOCAL_FX_DEFAULT}
                            onVocalFxChange={(fx) => onTrackVocalFxChange(i, fx)}
                            vocalTrackIndex={i}
                            carrierTracks={studioEditorVocoderCarrierTracks(studioTracks)}
                            songKeyRoot={tr.a2mKeyRoot ?? songKeyRoot}
                            songKeyMode={tr.a2mKeyMode ?? songKeyMode}
                            sessionBpm={bpm}
                            trackIndex={i}
                          />
                        </div>
                      </div>

                      {/* â”€â”€ ST / Mono + Record (under ST) / Pan (under M) â€” 2Ã—2 grid aligned with buttons above â”€â”€ */}
                      <div
                        className="shrink-0 grid w-full px-2 pb-1"
                        style={{
                          borderTop: '1px solid #1e1e28',
                          gridTemplateColumns: '1fr 1fr',
                          columnGap: 1,
                          rowGap: 6,
                          paddingTop: 6,
                          paddingBottom: 4,
                        }}
                      >
        <button
          type="button"
                          title="Stereo â€” pan knob affects L/R"
                          onClick={() => { const n = [...trackMonos]; n[i] = false; setTrackMonos(n); }}
                          className="w-full font-bold uppercase"
          style={{
                            padding: '2px 0', fontSize: 6, letterSpacing: '0.04em', borderRadius: 2,
                            background: !monoOn ? '#24243a' : '#14141c',
                            color: !monoOn ? '#e8e8f8' : '#4a4a65',
                            border: `1px solid ${!monoOn ? tr.colorHex : '#252530'}`,
                            boxShadow: !monoOn ? `0 0 6px ${tr.colorHex}33` : 'none',
                          }}
                        >ST</button>
                        <button
                          type="button"
                          title="Mono â€” same signal to L and R (pan ignored)"
                          onClick={() => { const n = [...trackMonos]; n[i] = true; setTrackMonos(n); }}
                          className="w-full font-bold uppercase"
                          style={{
                            padding: '2px 0', fontSize: 6, letterSpacing: '0.04em', borderRadius: 2,
                            background: monoOn ? '#24243a' : '#14141c',
                            color: monoOn ? '#e8e8f8' : '#4a4a65',
                            border: `1px solid ${monoOn ? tr.colorHex : '#252530'}`,
                            boxShadow: monoOn ? `0 0 6px ${tr.colorHex}33` : 'none',
                          }}
                        >M</button>

                        {/* Row 2: rec Â· input (audio) Â· pan â€” full strip width */}
                        <div
                          className="flex w-full min-w-0 items-start justify-between gap-1"
                          style={{ gridColumn: '1 / -1' }}
                        >
                          <div className="flex flex-col items-center justify-start gap-0.5 min-w-0">
                            <button
                              type="button"
                              aria-label={recArm ? `Record-enable off for ${tr.name}` : `Record-enable on for ${tr.name}`}
                              aria-pressed={recArm}
                              title={
                                recArm
                                  ? 'Record Enable ON â€” armed for recording (tap to disarm)'
                                  : 'Record Enable â€” arm track for recording (DAW mixer R)'
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                selectTrackAndClearPianoNote(i);
                                setTrackRecordArmed((prev) => {
                                  const next = [...prev];
                                  next[i] = !(next[i] ?? false);
                                  return next;
                                });
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                              className="flex items-center justify-center outline-none rounded-full transition-all shrink-0"
                              style={{
                                width: 40,
                                height: 40,
                                padding: 0,
                                border: 'none',
                                cursor: muted ? 'not-allowed' : 'pointer',
                                background: 'transparent',
                                opacity: muted ? 0.45 : 1,
                              }}
                            >
                              <span
                                className={`rounded-full block ${recording && recArm ? 'animate-pulse' : ''}`}
                                style={{
                                  width: 20,
                                  height: 20,
                                  boxSizing: 'border-box',
                                  background: recArm
                                    ? 'radial-gradient(circle at 32% 28%, #ff5a52 0%, #c91818 45%, #6a0909 100%)'
                                    : 'radial-gradient(circle at 32% 28%, #2a1818 0%, #120a0a 85%)',
                                  border: recArm ? '2px solid #ff9a9a' : '2px solid #5e2828',
                                  boxShadow: recArm
                                    ? `${recording ? '0 0 14px rgba(255,72,72,0.95), ' : ''}0 2px 4px rgba(0,0,0,1), inset 0 1px 0 rgba(255,230,230,0.4)`
                                    : 'inset 0 2px 5px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(90,44,44,0.3)',
                                }}
                              />
        </button>
                            <span
                              className="text-[6px] font-semibold uppercase leading-none tracking-wide"
                              style={{ color: recArm ? '#ff8a8a' : '#5a5a6a' }}
                              aria-hidden
                            >
                              rec
                            </span>
                          </div>

                          {/* Mic opens floating input picker (audio only); MIDI keeps layout alignment */}
                          {tr.kind === 'audio' ? (() => {
                            const ov = (tr.audioInputDeviceId ?? '').trim();
                            const devLabel = ov
                              ? micInputDeviceOptions.find((d) => d.deviceId === ov)?.label
                              : null;
                            const sum = devLabel
                              ? (devLabel.length > 28 ? `${devLabel.slice(0, 26)}â€¦` : devLabel)
                              : 'Project default (Settings)';
                            const inputOpen = mixerAudioInputPopover?.trackIndex === i;
                            const hasOverride = Boolean(ov);
                            return (
                              <div className="flex flex-col items-center justify-start gap-0.5 shrink-0">
        <button
          type="button"
                                  data-mixer-audio-input-trigger
                                  aria-label={`Input for ${tr.name}: ${sum}. Click to choose microphone or line source.`}
                                  aria-expanded={inputOpen}
                                  aria-haspopup="listbox"
                                  title={`Input â€” ${sum} Â· click to change`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectTrackAndClearPianoNote(i);
                                    const btn = e.currentTarget;
                                    setMixerAudioInputPopover((prev) => {
                                      if (prev?.trackIndex === i) return null;
                                      const r = btn.getBoundingClientRect();
                                      const w = 200;
                                      const left = Math.min(
                                        window.innerWidth - w - 8,
                                        Math.max(8, Math.round(r.left + r.width / 2 - w / 2)),
                                      );
                                      return { trackIndex: i, top: Math.round(r.bottom + 6), left };
                                    });
                                  }}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  className="flex items-center justify-center outline-none rounded-md transition-all shrink-0"
          style={{
                                    width: 22,
                                    height: 22,
                                    padding: 0,
                                    border: `1px solid ${inputOpen || hasOverride ? tr.colorHex : '#35354a'}`,
                                    cursor: 'pointer',
                                    background: inputOpen
                                      ? 'linear-gradient(180deg, #1c2430 0%, #12121a 100%)'
                                      : 'linear-gradient(180deg, #181820 0%, #0e0e14 100%)',
                                    boxShadow: inputOpen || hasOverride ? `0 0 8px ${tr.colorHex}44` : 'inset 0 1px 0 rgba(255,255,255,0.06)',
                                    opacity: muted ? 0.5 : 1,
                                  }}
                                >
                                  <Mic
                                    size={12}
                                    strokeWidth={2.25}
                                    style={{
                                      color: hasOverride || inputOpen ? tr.colorHex : '#7a7a94',
                                    }}
                                    aria-hidden
                                  />
        </button>
                                <span
                                  className="text-[6px] font-semibold uppercase leading-none tracking-wide"
                                  style={{ color: hasOverride ? tr.colorHex : '#5a5a6a' }}
                                  aria-hidden
                                >
                                  in
                                </span>
      </div>
                            );
                          })() : (
                            <div className="shrink-0" style={{ width: 26 }} aria-hidden />
                          )}

                          <div className="flex flex-col items-center gap-0.5 min-w-0 justify-start">
                            {/* Round pan knob â€” drag up/down to pan; double-click resets to centre */}
        <div
                              title={monoOn ? 'Pan (inactive in MONO â€” press ST for stereo imaging)' : 'Pan â€” drag up/down Â· double-click to centre'}
          style={{
                                width: 24, height: 24,
                                borderRadius: '50%',
                                background: muted
                                  ? 'radial-gradient(circle at 34% 30%, #2b2b39 0%, #151520 46%, #0a0a12 100%)'
                                  : 'radial-gradient(circle at 34% 30%, #7c7c92 0%, #3f3f53 42%, #1b1b28 78%, #0d0d15 100%)',
                                boxShadow: muted
                                  ? 'inset 0 2px 5px rgba(0,0,0,0.92), inset 0 0 0 1px rgba(255,255,255,0.04)'
                                  : '0 2px 8px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.26), inset 0 -1px 0 rgba(0,0,0,0.56), inset 0 0 0 1px rgba(255,255,255,0.08)',
                                position: 'relative',
                                cursor: monoOn ? 'default' : 'ns-resize',
                                transform: `rotate(${((pan - 64) / 63) * 140}deg)`,
                                flexShrink: 0,
                                touchAction: 'none',
                                userSelect: 'none',
                                opacity: muted ? 1 : monoOn ? 0.42 : 1,
                              }}
                              onPointerDown={(e) => {
                                if (monoOn || muted) return;
                                e.currentTarget.setPointerCapture(e.pointerId);
                                panDragRef.current = { trackIndex: i, startY: e.clientY, startPan: pan };
                              }}
                              onPointerMove={(e) => {
                                if (!panDragRef.current || panDragRef.current.trackIndex !== i) return;
                                const delta = panDragRef.current.startY - e.clientY;
                                const newPan = Math.max(0, Math.min(127, Math.round(panDragRef.current.startPan + delta * 0.7)));
                                const n = [...trackPans]; n[i] = newPan; setTrackPans(n);
                              }}
                              onPointerUp={(e) => {
                                panDragRef.current = null;
                                try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ok */ }
                              }}
                              onDoubleClick={() => { if (monoOn || muted) return; const n = [...trackPans]; n[i] = 64; setTrackPans(n); }}
        >
          <div
            style={{
                                  position: 'absolute',
                                  left: '50%',
                                  top: '50%',
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  background: muted ? '#202030' : 'radial-gradient(circle at 35% 35%, #e7e7f4 0%, #8e8ea5 100%)',
                                  boxShadow: muted ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.7)',
                                }}
                              />
                              {/* Pointer cap at 12 o'clock */}
                              <div style={{
                                position: 'absolute',
                                width: 4, height: 6, borderRadius: 2,
                                top: 2.5, left: '50%', transform: 'translateX(-50%)',
                                background: muted ? '#2e2e44' : tr.colorHex,
                                boxShadow: muted ? 'none' : `0 0 6px ${tr.colorHex}aa`,
                              }} />
                            </div>
                            <span className="text-[6px] font-mono tabular-nums" style={{ color: '#484858' }}>{panLabel}</span>
                          </div>
                        </div>
                      </div>

                      {/* â”€â”€ Mute / Solo â”€â”€ */}
                      <div className="shrink-0 flex gap-px w-full px-2 pb-2">
                        <button
                          type="button" title="Mute"
                          onClick={() => { const n = [...trackMutes]; n[i] = !n[i]; setTrackMutes(n); }}
                          className="flex-1 font-bold uppercase"
                          style={{
                            padding: '3px 0', fontSize: 7, letterSpacing: '0.05em', borderRadius: 2,
                            background: muted ? '#2c1200' : '#1a1a24',
                            color: muted ? '#ff9933' : '#383848',
                            border: `1px solid ${muted ? '#4a2200' : '#252530'}`,
                          }}
                        >M</button>
                        <button
                          type="button" title="Solo"
                          onClick={() => { const n = [...trackSolos]; n[i] = !n[i]; setTrackSolos(n); }}
                          className="flex-1 font-bold uppercase"
                          style={{
                            padding: '3px 0', fontSize: 7, letterSpacing: '0.05em', borderRadius: 2,
                            background: soloed ? '#0c2018' : '#1a1a24',
                            color: soloed ? '#7cf4c6' : '#383848',
                            border: `1px solid ${soloed ? '#1a4030' : '#252530'}`,
                          }}
                        >S</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>

                {/* ── Master bus — pinned right; track strips scroll independently ── */}
                {(() => {
                  const mvDb  = formatMixerFaderDb(masterVolume);
                  const faderMasterHot = mixerFaderActive?.kind === 'master';
                  return (
                    <div
                      data-studio-mixer-master-pinned
                      className="flex flex-col shrink-0 h-full"
                      style={{
                        width: MIXER_STRIP_W_PX,
                        background: '#0e0e16',
                        borderLeft: '2px solid #2a3a34',
                        boxShadow: '-6px 0 14px rgba(0,0,0,0.55)',
                        zIndex: 2,
                      }}
                    >
                      <div
                        className="shrink-0 flex items-center justify-center px-0.5 w-full"
                        style={{ height: MIXER_STRIP_HEADER_H_PX, background: '#141e1a', borderBottom: '2px solid #7cf4c6' }}
                      >
                        <span
                          className={`w-full text-center truncate ${TRACK_NAME_MIXER_CLASS}`}
                          style={{ color: '#6ab89a' }}
                        >
                          Master
                        </span>
                      </div>

                      {/* Fader + meters */}
                      <div className="flex-1 flex min-h-0 w-full px-2 py-1 gap-2">
                        {/* Master Fader */}
                        <div
                          className="relative flex-1 flex items-center justify-center min-h-0 min-w-0 overflow-hidden"
                          style={{ paddingLeft: 8, paddingRight: 2 }}
                        >
                          {/* Rail */}
                          <div className="absolute" style={{ width: 3, top: MIXER_FADER_INSET_TOP_PX, bottom: MIXER_FADER_INSET_BOTTOM_PX, left: MIXER_FADER_RAIL_LEFT, transform: 'translateX(-50%)', background: '#0a0a12', borderRadius: 2, boxShadow: 'inset 0 2px 4px rgba(0,0,0,1)' }} />
                          {/* Fill */}
                          <div className="absolute" style={{ width: 3, bottom: MIXER_FADER_INSET_BOTTOM_PX, left: MIXER_FADER_RAIL_LEFT, transform: 'translateX(-50%)', height: mixerFaderFillHeight(masterVolume), background: '#7cf4c6', opacity: 0.6, borderRadius: 2, transition: 'height 0.04s' }} />

                          {/* dB scale â€” printed +6 â€¦ âˆ’60; readout shows âˆ’âˆž at bottom */}
                          {MIXER_FADER_DB_TICKS.map(({ label, vol: v }) => {
                            const btm = mixerFaderTravelBottom(v);
                            const isZero = label === '0';
                            const isFloor60 = label === '-60';
                            return (
                              <div
                                key={`ms-${v}-${label}`}
                                className="absolute pointer-events-none flex flex-row items-center justify-end"
                                style={{
                                  bottom: btm,
                                  left: MIXER_DB_SCALE_EDGE_LEFT_PX,
                                  right: MIXER_DB_SCALE_EDGE_RIGHT,
                                  transform: 'translateY(50%)',
                                  zIndex: 3,
                                }}
                              >
                                <span style={{
                                  fontSize: 10,
                                  fontFamily: 'ui-monospace, SF Mono, monospace',
                                  lineHeight: 1.2,
                                  whiteSpace: 'nowrap',
                                  marginRight: 6,
                                  display: 'inline-block',
                                  textAlign: 'right' as const,
                                  minWidth: '3ch',
                                  color: isZero ? '#ecfdf6' : isFloor60 ? '#e4fff8' : '#c8eee4',
                                  fontWeight: isZero ? 800 : isFloor60 ? 700 : 600,
                                  textShadow: '0 1px 2px rgba(0,0,0,0.92)',
                                  letterSpacing: isZero ? 0 : '0.02em',
                                  ...(isFloor60
                                    ? {
                                        background: 'rgba(12,24,22,0.96)',
                                        padding: '1px 3px',
                                        borderRadius: 2,
                                        boxShadow: '0 0 0 1px rgba(124,244,198,0.12)',
                                      }
                                    : {}),
                                }}>{label}</span>
                                <div style={{
                                  width: isZero ? 8 : 5,
                                  height: isZero ? 2 : 1,
                                  flexShrink: 0,
                                  background: isZero ? '#e2fff4' : '#96d4c4',
                                  boxShadow: isZero ? '0 0 4px rgba(124,244,198,0.35)' : 'none',
                                  borderRadius: 0.5,
                                }} />
                              </div>
                            );
                          })}

                          <input
                            type="range"
                            min={0}
                            max={127}
                            value={masterVolume}
                            onChange={(e) => setMasterVolume(Number(e.target.value))}
                            onPointerDown={() => setMixerFaderActive({ kind: 'master' })}
                            style={{ writingMode: 'vertical-lr', direction: 'rtl', position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'ns-resize' }}
                            title={`Master: ${mvDb} dB`}
                          />
                          {/* Teal-tinted knob */}
                          <div className="absolute pointer-events-none" style={{
                            width: 26, height: MIXER_FADER_KNOB_H_PX,
                            bottom: mixerFaderKnobBottom(masterVolume),
                            left: MIXER_FADER_RAIL_LEFT,
                            transform: 'translateX(-50%)',
                            zIndex: 2,
                            borderRadius: 4, background: 'linear-gradient(180deg, #c8ede4 0%, #88c8b8 40%, #60a090 70%, #3a7868 100%)', boxShadow: '0 3px 7px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.3)', transition: 'bottom 0.04s'
                          }}>
                            <div
                              aria-hidden
                              style={{
                                position: 'absolute',
                                left: -6,
                                top: 2,
                                width: 0,
                                height: 0,
                                borderTop: '3px solid transparent',
                                borderBottom: '3px solid transparent',
                                borderRight: `6px solid ${faderMasterHot ? '#7cf4c6' : '#6ab89a'}`,
                                filter: faderMasterHot
                                  ? 'drop-shadow(0 0 8px rgba(124,244,198,0.95)) drop-shadow(0 0 4px rgba(124,244,198,0.6))'
                                  : undefined,
                              }}
                            />
                            <div style={{ position: 'absolute', inset: '0 5px', top: 5,  height: 1, background: 'rgba(0,0,0,0.25)', borderRadius: 1 }} />
                            <div style={{ position: 'absolute', inset: '0 4px', top: 9, height: 1, background: 'rgba(0,0,0,0.45)', borderRadius: 1 }} />
                            <div style={{ position: 'absolute', inset: '0 5px', top: 13, height: 1, background: 'rgba(0,0,0,0.25)', borderRadius: 1 }} />
          </div>
        </div>
                        {/* Master L/R — same glass LED panel as track channels */}
                        <div
                          className="se2-mixer-vu-glass se2-mixer-vu-glass--master"
                          aria-hidden
                        >
                          {(['L', 'R'] as const).map((ch) => (
                            <div key={ch} className="se2-mixer-vu-col">
                              <div
                                ref={ch === 'L' ? mixerMasterLRef : mixerMasterRRef}
                                className="se2-mixer-vu-led-fill"
                                style={{
                                  height: '0%',
                                  background:
                                    'linear-gradient(to top, #00b84a 0%, #12e86a 55%, #5dff9a 100%)',
                                }}
                              />
                              <div className="se2-mixer-vu-glass-sheen" />
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* FX under master VU meters */}
                      <div
                        className="shrink-0 flex w-full items-center justify-center"
                        style={{
                          paddingTop: 2,
                          paddingBottom: 2,
                          borderTop: '1px solid #1a2820',
                          background: 'linear-gradient(180deg, #0c1412 0%, #080c0e 100%)',
                        }}
                      >
                        <ChannelStripFxButton
                          variant="master"
                          channelLabel="MASTER"
                          slots={masterFxSlots}
                          onSlotChange={onMasterFxSlotChange}
                          sessionBpm={bpm}
                          insertFxRack={masterInsertFxRack}
                          onInsertFxRackChange={setMasterInsertFxRack}
                          trackIndex={-1}
                        />
                      </div>
                      {/* dB â€” compact row */}
                      <div className="shrink-0 flex items-center justify-center" style={{ paddingTop: 0, paddingBottom: 1, lineHeight: 1 }}>
                        <span
                          className="font-mono tabular-nums transition-all text-[8px]"
                          style={{
                            lineHeight: 1,
                            color: faderMasterHot ? '#7cf4c6' : '#3a6858',
                            textShadow: faderMasterHot ? '0 0 8px rgba(124,244,198,0.45)' : undefined,
                          }}
                        >
                          {mvDb}
                        </span>
                      </div>
                      {/* Pan knob â€” master always centred (not wired) */}
                      <div className="shrink-0 w-full px-2 pb-1" style={{ borderTop: '1px solid #1e2820' }}>
                        <div className="flex flex-col items-center gap-0.5 pt-1.5 pb-0.5">
                          <div
                            title="Master Pan â€” always centred"
                            style={{
                              width: 24, height: 24, borderRadius: '50%',
                              background: 'radial-gradient(circle at 34% 30%, #5aa890 0%, #2e5c4f 45%, #12241f 80%, #08120f 100%)',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.5), inset 0 0 0 1px rgba(124,244,198,0.2)',
                              position: 'relative', flexShrink: 0,
                            }}
                          >
                            <div style={{
                              position: 'absolute', left: '50%', top: '50%', width: 8, height: 8, borderRadius: '50%',
                              transform: 'translate(-50%, -50%)',
                              background: 'radial-gradient(circle at 35% 35%, #d7fff1 0%, #79c8af 100%)',
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.6)',
                            }} />
                            <div style={{
                              position: 'absolute', width: 4, height: 6, borderRadius: 2,
                              top: 3, left: '50%', transform: 'translateX(-50%)',
                              background: '#7cf4c6', boxShadow: '0 0 4px #7cf4c688',
                            }} />
                          </div>
                          <span className="text-[6px] font-mono" style={{ color: '#2a5040' }}>C</span>
                        </div>
                      </div>
                      {/* M/S placeholders */}
                      <div className="shrink-0 flex gap-px w-full px-2 pb-2">
                        <div className="flex-1 font-bold uppercase text-center" style={{ padding: '3px 0', fontSize: 7, borderRadius: 2, background: '#111118', color: '#202830', border: '1px solid #1a2420' }}>M</div>
                        <div className="flex-1 font-bold uppercase text-center" style={{ padding: '3px 0', fontSize: 7, borderRadius: 2, background: '#111118', color: '#202830', border: '1px solid #1a2420' }}>S</div>
      </div>
    </div>
  );
                })()}
            </div>
            {mixerAudioInputPopover != null &&
              studioTracks[mixerAudioInputPopover.trackIndex]?.kind === 'audio' &&
              typeof document !== 'undefined' &&
              createPortal(
                (() => {
                  const pi = mixerAudioInputPopover.trackIndex;
                  const popTr = studioTracks[pi];
                  if (!popTr || popTr.kind !== 'audio') return null;
                  const cur = (popTr.audioInputDeviceId ?? '').trim();
                  const setInput = (deviceId: string) => {
                    setStudioTracks((prev) =>
                      prev.map((t, idx) =>
                        idx === pi && t.kind === 'audio' ? { ...t, audioInputDeviceId: deviceId } : t,
                      ),
                    );
                    setMixerAudioInputPopover(null);
                  };
                  return (
                    <div
                      data-mixer-audio-input-popover
                      role="listbox"
                      aria-label={`Microphone / line input for ${popTr.name}`}
                      className="rounded border overflow-x-hidden overflow-y-auto font-mono"
                      style={{
                        position: 'fixed',
                        top: mixerAudioInputPopover.top,
                        left: mixerAudioInputPopover.left,
                        width: 200,
                        zIndex: 10060,
                        maxHeight: 240,
                        background: '#0e0e14',
                        borderColor: '#3a3a4c',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.05)',
                      }}
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={cur === ''}
                        className="block w-full text-left outline-none border-b truncate"
                        style={{
                          padding: '6px 8px',
                          fontSize: 9,
                          fontWeight: 700,
                          color: cur === '' ? '#7cf4c6' : '#b8b8cc',
                          background: cur === '' ? 'rgba(124,244,198,0.08)' : 'transparent',
                          borderColor: '#22222c',
                        }}
                        onClick={() => setInput('')}
                      >
                        Project default (Settings)
                      </button>
                      {micInputDeviceOptions.map((d) => {
                        const lab = d.label.length > 26 ? `${d.label.slice(0, 24)}â€¦` : d.label;
                        const sel = cur === d.deviceId;
                        return (
                          <button
                            key={d.deviceId}
                            type="button"
                            role="option"
                            aria-selected={sel}
                            className="block w-full text-left outline-none border-b last:border-b-0 truncate"
                            style={{
                              padding: '5px 8px',
                              fontSize: 8,
                              fontWeight: 600,
                              color: sel ? popTr.colorHex : '#a4a4b8',
                              background: sel ? `${popTr.colorHex}18` : 'transparent',
                              borderColor: '#1a1a22',
                            }}
                            title={d.label}
                            onClick={() => setInput(d.deviceId)}
                          >
                            {lab}
                          </button>
                        );
                      })}
                    </div>
                  );
                })(),
                document.body,
              )}

            {/* Ultra wood rail — bottom edge of channel strips (above transport) */}
            <div className="se2-mixer-wood-rail" aria-hidden />
          </div>
        )}

      </main>

      <footer
        data-studio-transport
        className="shrink-0 border-t flex flex-nowrap items-end overflow-x-clip px-3 sm:px-4 py-1 sm:py-1.5"
        style={{
          borderColor: '#12121a',
          background: 'linear-gradient(180deg, #0c0c10 0%, #08080c 100%)',
          gap: '0 1.5rem',
        }}
      >
        {/* Left: position readouts */}
        <StudioTransportBarsIsland
          compact
          barsReadoutRefs={{
            bar: barsBarReadoutRef,
            beat: barsBeatReadoutRef,
            tick: barsTickReadoutRef,
            pause: barsPauseReadoutRef,
          }}
          beatsPerBar={beatsPerBar}
        />

        <StudioTransportTimeIsland
          compact
          timeReadoutRefs={{
            minutes: timeMinReadoutRef,
            seconds: timeSecReadoutRef,
            frames: timeFrameReadoutRef,
          }}
        />

        {/* Middle: transport + record count-in */}
        <div className="se2-transport-footer-island se2-transport-transport-controls flex items-end gap-4 shrink-0 box-border">
          <button
            type="button"
            title="Return to Zero (bar 1)"
            className={`${transportBtnBase} h-9 w-9 rounded-md border`}
            style={{ borderColor: '#2a2a32', color: '#b0b0bc' }}
            onClick={() => void onReturnToZero()}
          >
            <SkipBack size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            title="Rewind one bar"
            disabled={running}
            className={`${transportBtnBase} h-9 w-9 rounded-md border disabled:opacity-40`}
            style={{ borderColor: '#2a2a32', color: '#b0b0bc' }}
            onClick={() => nudgePlayheadBeats(-beatsPerBar)}
          >
            <Rewind size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            title={
              running
                ? 'Pause'
                : recordStandby
                  ? precountEnabled
                    ? 'Play — count-in, then record'
                    : 'Play — start recording'
                  : 'Play'
            }
            disabled={isPrecounting}
            className={`${transportBtnBase} h-10 w-10 rounded-full border disabled:opacity-45`}
            style={{
              background: running ? '#152018' : '#13221c',
              borderColor: running ? '#2a4a38' : '#2d5a48',
            color: '#7cf4c6',
          }}
            onPointerDown={() => {
              /* Resume AudioContext on the gesture so Play's await ensureCtx() is fast. */
              if (!runningRef.current) void ensureCtx();
            }}
            onClick={() => void onTogglePlayPause()}
        >
            {running ? <Pause size={20} strokeWidth={2} /> : <Play size={20} className="ml-0.5" strokeWidth={2} />}
        </button>
          <button
            type="button"
            title="Stop (keeps playhead position)"
            className={`${transportBtnBase} h-9 w-9 rounded-md border`}
            style={{
              background: '#1a1214',
              borderColor: '#3a2828',
              color: '#e89898',
            }}
            onClick={onStop}
          >
            <Square size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            title="Fast-forward one bar"
            disabled={running}
            className={`${transportBtnBase} h-9 w-9 rounded-md border disabled:opacity-40`}
            style={{ borderColor: '#2a2a32', color: '#b0b0bc' }}
            onClick={() => nudgePlayheadBeats(beatsPerBar)}
          >
            <FastForward size={16} strokeWidth={2} />
          </button>
        <button
          ref={transportRecBtnRef}
          type="button"
            title={
              recording
                ? 'Recording — click to stop and commit take to armed audio track'
                : recordStandby
                  ? 'Record armed — hit Play to start (click mic again to cancel)'
                  : 'Record — arm mic only (does not play or capture); hit Play to record'
            }
            disabled={isPrecounting}
            aria-pressed={recording || recordStandby}
            data-rec-armed={recordStandby && !recording ? '1' : '0'}
            data-rec-on={recording ? '1' : '0'}
            className={`se2-transport-rec-btn ${transportBtnBase} h-9 w-9 rounded-md border disabled:opacity-45`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRecordClick();
            }}
          >
            <Mic
              size={17}
              strokeWidth={2.25}
              className={recording ? 'animate-pulse' : undefined}
              color={recording || recordStandby ? '#ff6b6b' : '#b0b0bc'}
            />
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={precountEnabled}
            title="Record count-in — 1–2 bar rimshot clicks before record (separate from playback Met)"
            className={`${transportBtnBase} h-7 min-w-[1.5rem] rounded border shrink-0 px-1 text-[9px] font-bold uppercase`}
            style={{
              borderColor: precountEnabled ? '#5a4030' : '#2a2a32',
              color: precountEnabled ? '#ffb080' : '#5c5c68',
              background: precountEnabled ? '#221610' : 'transparent',
            }}
            onClick={() => setPrecountEnabled((v) => !v)}
          >
            Pre
          </button>
          <select
            aria-label="Precount bars"
            title="Count-in length: 1 bar or 2 bars"
            value={precountBars}
            disabled={!precountEnabled}
            onChange={(e) => setPrecountBars(Number(e.target.value) === 2 ? 2 : 1)}
            className="h-7 w-[2.1rem] rounded border px-0.5 text-[9px] font-bold uppercase shrink-0 disabled:opacity-40"
            style={{
              borderColor: precountEnabled ? '#5a4030' : '#2a2a32',
              color: precountEnabled ? '#ffb080' : '#5c5c68',
              background: '#0c0c10',
            }}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </div>

        <div className="se2-transport-footer-island se2-transport-precount-island flex items-end shrink-0">
          <span
              className="text-[9px] font-bold tabular-nums shrink-0 min-w-[1.85rem] text-center inline-block"
              style={{ color: isPrecounting && precountBeatUi ? '#ffb080' : 'transparent' }}
              aria-live="polite"
              aria-hidden={!isPrecounting || !precountBeatUi}
            >
              {isPrecounting && precountBeatUi
                ? `${precountBeatUi.beat}/${precountBeatUi.total}`
                : '0/0'}
            </span>
        </div>

        <StudioTransportBpmIsland
          compact
          bpm={bpm}
          disabled={running}
          onBpmChange={(next) => setBpm(Math.max(40, Math.min(240, next)))}
          onBpmDelta={(delta) =>
            setBpm((b) => Math.max(40, Math.min(240, b + delta)))
          }
        />

        <div className="se2-transport-footer-island se2-transport-utility-btns flex items-end gap-3 shrink-0">
          <button
            type="button"
            title="Undo (Ctrl+Z)"
            disabled={!canMidiUndo || running}
            className={`${transportBtnBase} h-7 w-7 rounded border disabled:opacity-35`}
            style={{ borderColor: '#2a2a32', color: canMidiUndo ? '#b0b0bc' : '#555560' }}
            onClick={midiUndoEdit}
          >
            <Undo2 size={13} strokeWidth={2} />
          </button>
          <button
            type="button"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!canMidiRedo || running}
            className={`${transportBtnBase} h-7 w-7 rounded border disabled:opacity-35`}
            style={{ borderColor: '#2a2a32', color: canMidiRedo ? '#b0b0bc' : '#555560' }}
            onClick={midiRedoEdit}
          >
            <Redo2 size={13} strokeWidth={2} />
          </button>
        </div>

        <div className="se2-transport-footer-island se2-transport-divider h-7 w-px shrink-0 bg-[#22222c]" aria-hidden />

        <div className="se2-transport-footer-island se2-transport-piano-island flex items-end gap-2 shrink-0">
          <button
            type="button"
            title={showPianoRoll ? 'Hide piano roll' : 'Show piano roll'}
            aria-pressed={showPianoRoll}
            className={`${transportBtnBase} h-7 w-7 rounded border shrink-0`}
            style={{
              borderColor: showPianoRoll ? '#2a4a3c' : '#2a2a32',
              color: showPianoRoll ? '#7cf4c6' : '#6a6a78',
              background: showPianoRoll ? '#14221c' : 'transparent',
            }}
            onClick={() => {
              setShowPianoRoll((v) => {
                const next = !v;
                if (!next) setPianoRollExpanded(false);
                else setPianoTool('pencil');
                return next;
              });
              setShowMixer(false);
            }}
          >
            <Piano size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            title={
              selectedTrackIsMidi
                ? 'Open piano roll for the selected MIDI track'
                : 'Select a MIDI track, then open piano roll'
            }
            disabled={!selectedTrackIsMidi}
            className={`${transportBtnBase} h-7 rounded border px-2.5 text-[9px] font-bold uppercase tracking-wide shrink-0 disabled:opacity-40 disabled:cursor-not-allowed`}
            style={{
              borderColor: showPianoRoll && selectedTrackIsMidi ? '#2a4a3c' : '#2a2a32',
              color: showPianoRoll && selectedTrackIsMidi ? '#7cf4c6' : '#8a8a98',
              background: showPianoRoll && selectedTrackIsMidi ? '#14221c' : 'transparent',
            }}
            onClick={() => {
              if (!selectedTrackIsMidi) return;
              openPianoRollEditor({ expanded: true });
            }}
          >
            Edit PR
          </button>
        </div>

        <div className="se2-transport-footer-island se2-transport-mixer-island flex shrink-0">
          <span
            className="se2-transport-mixer-label se2-type-micro"
            style={{ color: showMixer ? '#7cf4c6' : '#8a8a98' }}
          >
            SE2 Mixer
          </span>
          <button
            type="button"
            title={showMixer ? 'Hide SE2 Mixer' : 'Show SE2 Mixer — audio channel mixer'}
            aria-label={showMixer ? 'Hide SE2 Mixer' : 'Show SE2 Mixer'}
            aria-pressed={showMixer}
            className={`${transportBtnBase} se2-transport-mixer-btn rounded border shrink-0 inline-flex items-center justify-center`}
            style={{
              borderColor: showMixer ? '#2a4a3c' : '#2a2a32',
              color: showMixer ? '#7cf4c6' : '#8a8a98',
              background: showMixer ? '#14221c' : 'transparent',
            }}
            onClick={toggleStudioMixerView}
          >
            <SlidersHorizontal size={13} strokeWidth={2} aria-hidden />
            SE2 Mixer
          </button>
        </div>

        <div className="se2-transport-footer-island se2-transport-metro-island flex items-end shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={metroOn}
            title="Metronome"
            className={`${transportBtnBase} se2-transport-metro-btn h-7 rounded border shrink-0 text-[9px] font-bold uppercase`}
            style={{
              borderColor: metroOn ? '#2a4a3c' : '#2a2a32',
              color: metroOn ? '#7cf4c6' : '#5c5c68',
              background: metroOn ? '#14221c' : 'transparent',
            }}
            onClick={() => setMetroOn((v) => !v)}
          >
            Met
          </button>
        </div>

        <div
          className="se2-transport-footer-island se2-transport-zoom-island se2-transport-zoom flex flex-col items-center gap-0.5 shrink-0"
          title="Timeline zoom"
        >
            <span className="se2-transport-zoom-label se2-type-micro">Zoom</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={ZOOM_STEP}
              value={zoom}
              aria-label="Timeline zoom"
              onChange={(e) => {
                const v = clampStudioZoom(Number(e.target.value));
                const scrollEl = timelineHScrollRef.current;
                if (scrollEl) {
                  const rect = scrollEl.getBoundingClientRect();
                  const anchorX = rect.left + rect.width * 0.5;
                  applyTimelineZoomAtBeat(v, clientXToBeat(anchorX), anchorX);
                } else {
                  setZoom(v);
                }
              }}
              className="se2-transport-zoom-slider"
              style={{
                ['--se2-zoom-fill' as string]: `${((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%`,
              }}
            />
            <span className="se2-transport-zoom-value se2-type-value">
              {zoom.toFixed(2)}×
            </span>
          </div>
      </footer>
      {showHarmonyUi && harmonyEligibleTrack ? (
        <StudioInstrumentHarmonyPanel
          open={harmonyPanelOpen}
          onClose={() => setHarmonyPanelOpen(false)}
          accentHex={harmonyEligibleTrack.colorHex}
          disabled={running}
          transportPlaying={running}
          bpm={bpm}
          getAudioContext={() => ctxRef.current}
          keyRoot={harmonyKeyRoot}
          keyMode={harmonyKeyMode}
          beatsPerBar={beatsPerBar}
          loopBars={studioNormalizeHarmonyLoopBars(harmonyEligibleTrack.harmonyLoopBars)}
          steps={harmonyEligibleTrack.harmonySteps ?? []}
          soundKind={harmonyEligibleTrack.harmonySoundKind ?? 'orchHit'}
          orchHitId={harmonyEligibleTrack.harmonyOrchHitId ?? GROOVE_ORCHESTRA_HIT_DEFAULT}
          grooveLeadId={harmonyEligibleTrack.harmonyGrooveLeadId ?? GROOVE_LAB_LEAD_SOUND_DEFAULT}
          melodyStyleId={harmonyEligibleTrack.harmonyMelodyStyleId ?? studioDefaultHarmonyMelodyStyleId()}
          onStepsChange={(steps) => updateTrackHarmonySteps(selectedTrackIndex, steps)}
          onMelodyStyleChange={(id) => updateTrackHarmonyMelodyStyle(selectedTrackIndex, id)}
          onLoopBarsChange={(bars) => updateTrackHarmonyLoopBars(selectedTrackIndex, bars)}
          onSoundKindChange={(kind) => updateTrackHarmonySoundKind(selectedTrackIndex, kind)}
          onOrchHitChange={(id) => updateTrackHarmonyOrchHit(selectedTrackIndex, id)}
          onGrooveLeadChange={(id) => updateTrackHarmonyGrooveLead(selectedTrackIndex, id)}
          onApplyRootHits={(steps, soundKind, orchHitId, grooveLeadId, loopBars, melodyStyleId) =>
            applyHarmonyRootHits(
              selectedTrackIndex,
              steps,
              soundKind,
              orchHitId,
              grooveLeadId,
              loopBars,
              melodyStyleId,
            )
          }
          onRegenerateMelody={() => regenerateGrooveLeadMelody(selectedTrackIndex)}
          canRegenerateMelody={canRegenerateGrooveLead}
          onApplyChords={(steps, loopBars) => applyHarmonyChords(selectedTrackIndex, steps, loopBars)}
          hasNoteSelection={midiHasNoteSel}
          noteCount={harmonyEligibleTrack.notes.length}
          onDeleteSelected={() => midiDeleteSelection()}
          onDeleteAll={() => clearTrackLaneContent(selectedTrackIndex)}
        />
      ) : null}
      <TimelineContextMenu
        contextMenu={editorContextMenu}
        onClose={closeEditorContextMenu}
        onCut={() => (hasAudioClipSel ? audioCutSelection() : midiCutSelection())}
        onCopy={() => (hasAudioClipSel ? audioCopySelection() : midiCopySelection())}
        onPaste={() => (audioClipboardHeld ? audioPasteSelection() : midiPasteSelection())}
        onDuplicate={() => (hasAudioClipSel ? audioDuplicateSelection() : midiDuplicateSelection())}
        onSplit={() => (hasAudioClipSel ? audioSplitSelection() : midiSplitSelection())}
        onDelete={() => (hasAudioClipSel ? audioDeleteSelection() : midiDeleteSelection())}
        onUndo={midiUndoEdit}
        onRedo={midiRedoEdit}
        canPaste={audioClipboardHeld || midiClipboardHeld}
        cutDisabled={!hasEditTarget && !contextMenuHasNoteTarget && !contextMenuHasAudioTarget}
        copyDisabled={!hasEditTarget && !contextMenuHasNoteTarget && !contextMenuHasAudioTarget}
        duplicateDisabled={!hasEditTarget && !contextMenuHasNoteTarget && !contextMenuHasAudioTarget}
        splitDisabled={!hasEditTarget && !contextMenuHasNoteTarget && !contextMenuHasAudioTarget}
        deleteDisabled={!hasEditTarget && !contextMenuHasNoteTarget && !contextMenuHasAudioTarget}
        undoDisabled={!canMidiUndo}
        redoDisabled={!canMidiRedo}
        extraItems={[
          ...(canClearLaneContent
            ? [
                {
                  label: 'Clear lane (keep track)',
                  action: () => clearTrackLaneContent(selectedTrackIndex),
                  shortcut: 'Del',
                  disabled: running,
                },
              ]
            : []),
          { label: 'Quantize', action: quantizeSelected, shortcut: 'Ctrl+Q', disabled: !midiHasNoteSel },
          { label: 'Transpose +1', action: () => transposeSelected(1), shortcut: 'Up', disabled: !midiHasNoteSel },
          { label: 'Transpose -1', action: () => transposeSelected(-1), shortcut: 'Down', disabled: !midiHasNoteSel },
          { label: 'Humanize', action: humanizeSelected, disabled: !midiHasNoteSel },
          { label: 'Legato', action: legatoSelected, disabled: !midiHasNoteSel },
          { label: 'Arpeggiate', action: arpeggiateSelected, disabled: !midiHasNoteSel },
          { label: 'Strum', action: strumSelected, disabled: !midiHasNoteSel },
          { label: 'Chop', action: chopSelected, disabled: !midiHasNoteSel },
          { label: 'Randomize Velocity', action: randomizeVelocitySelected, disabled: !midiHasNoteSel },
        ]}
      />
      {templateSaveOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="dialog"
              aria-modal
              aria-labelledby="se2-template-save-title"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.72)',
              }}
              onClick={() => setTemplateSaveOpen(false)}
            >
              <div
                style={{
                  minWidth: 320,
                  maxWidth: 400,
                  padding: 24,
                  borderRadius: 12,
                  border: '2px solid #7cf4c6',
                  background: '#0f0f12',
                  boxShadow: '0 20px 60px rgba(124, 244, 198, 0.25)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3
                  id="se2-template-save-title"
                  style={{
                    color: '#7cf4c6',
                    fontSize: 14,
                    fontWeight: 800,
                    marginBottom: 10,
                    textAlign: 'center',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Save SE2 Template
                </h3>
                <p style={{ color: '#9a9ab0', fontSize: 11, lineHeight: 1.45, marginBottom: 14 }}>
                  {hasSe2OwnerStartupTemplate()
                    ? 'This replaces your saved startup template with the layout on screen now (tracks, mixer, view, zoom). Rename if you want a new label.'
                    : 'Save the current layout as your SE2 startup template (tracks, mixer, view, zoom).'}
                </p>
                <label
                  style={{
                    display: 'block',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#8888a0',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Template name
                </label>
                <input
                  type="text"
                  value={templateSaveName}
                  onChange={(e) => setTemplateSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmSaveTemplate();
                    if (e.key === 'Escape') setTemplateSaveOpen(false);
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    marginBottom: 16,
                    background: '#1a1a22',
                    border: '1px solid #3a3a48',
                    borderRadius: 6,
                    color: '#e8e8f0',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button
                    type="button"
                    onClick={confirmSaveTemplate}
                    style={{
                      padding: '10px 16px',
                      background: '#7cf4c6',
                      color: '#0a0a10',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    Save template
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateSaveOpen(false)}
                    style={{
                      padding: '10px 16px',
                      background: '#1a1a22',
                      color: '#9a9ab0',
                      border: '1px solid #3a3a48',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
    </StudioEditor2HelpProvider>
  );
}

function StudioEditor2MidiBtn() {
  const { midiClockEnabled, setMidiClockEnabled } = useMasterClock();
  return (
    <button
      type="button"
      onClick={() => setMidiClockEnabled(!midiClockEnabled)}
      title="Send MIDI clock to hardware"
      data-studio-se2-header-pill
      data-midi-on={midiClockEnabled ? 'true' : 'false'}
      className="transition-colors focus:outline-none"
      style={{ cursor: 'pointer' }}
    >
      MIDI
    </button>
  );
}

function StudioEditor2HowToBtn() {
  const { openHelp } = useStudioEditor2HelpContext();
  return (
    <button
      type="button"
      onClick={() => openHelp('overview')}
      data-studio-se2-header-pill
      data-how-to="true"
      className="transition-colors focus:outline-none"
      style={{ cursor: 'pointer' }}
    >
      <HelpCircle size={12} aria-hidden />
      How to
    </button>
  );
}
