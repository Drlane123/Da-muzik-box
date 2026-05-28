import type { BassKeypadPreviewMode } from '@/app/hooks/useGrooveLabOrchid';
import { GrooveLabComposerPanel } from '@/app/components/creation/GrooveLabComposerPanel';
import { OrchidBassKeypad } from '@/app/components/creation/OrchidBassKeypad';
import { OrchidChordStrip } from '@/app/components/creation/OrchidChordStrip';
import type { GrooveComposerPart } from '@/app/lib/creationStation/grooveComposerEngine';
import type { GrooveLabBassSoundId } from '@/app/lib/creationStation/grooveLabBassSounds';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { ChordVoiceId } from '@/app/lib/creationStation/chordSequencerVoices';
import type { OrchidBassKeyDef } from '@/app/lib/creationStation/orchidChordEngine';
import type {
  OrchidChordType,
  OrchidExtension,
  OrchidPerformanceMode,
} from '@/app/lib/creationStation/orchidChordEngine';
import type { OrchidProgressionId } from '@/app/lib/creationStation/grooveLabOrchidMatch';
import type {
  GrooveProgressionStep,
  GrooveStagedProgression,
} from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { grooveLabChordLabels } from '@/app/lib/creationStation/grooveLabBranding';
import type { GrooveLabQuantize, GrooveRollHit } from '@/app/lib/creationStation/grooveLabRoll';

export interface OrchidPerformancePanelProps {
  /** Groove Lab uses Groove Studio / Groove Chord; other screens keep Orchid labels. */
  grooveBranding?: boolean;
  chordLabel: string;
  matchLabel: string;
  orchidType: OrchidChordType;
  onTypeChange: (t: OrchidChordType) => void;
  extensions: ReadonlySet<OrchidExtension>;
  onToggleExtension: (ext: OrchidExtension) => void;
  inversion: number;
  maxInversion: number;
  onInversionChange: (inv: number) => void;
  perfMode: OrchidPerformanceMode;
  onPerfModeChange: (m: OrchidPerformanceMode) => void;
  diatonicRoots: number[];
  selectedRootMidi: number;
  onRootChange: (midi: number) => void;
  smartMatch: boolean;
  onSmartMatchChange: (on: boolean) => void;
  progressionBpm?: number;
  onProgressionBpmChange?: (bpm: number) => void;
  progressionSessionBpmLocked?: boolean;
  progressionKeyRoot?: number;
  progressionMode?: ChordMode;
  progressionChordVoiceLabel?: string;
  progressionStaged?: GrooveStagedProgression | null;
  progressionStatus?: string | null;
  progressionAuditionPlaying?: boolean;
  progressionAuditionStepIndex?: number | null;
  onProgressionStepsChange?: (steps: GrooveProgressionStep[]) => void;
  onProgressionBuild?: (steps: GrooveProgressionStep[]) => void;
  onProgressionPreviewStep?: (step: GrooveProgressionStep) => void;
  onProgressionPlay?: (steps: GrooveProgressionStep[]) => void;
  onProgressionLoop?: (steps: GrooveProgressionStep[]) => void;
  onProgressionStopAudition?: () => void;
  onProgressionDropChords?: (steps: GrooveProgressionStep[]) => void;
  onProgressionDropWithBass?: (steps: GrooveProgressionStep[]) => void;
  onPreview: () => void;
  onWriteChordToRoll?: () => void;
  chordNotePreview?: string;
  onPinToPad: () => void;
  pinDisabled?: boolean;
  bassKeys: OrchidBassKeyDef[];
  linkedChordVolume: number;
  onLinkedChordVolumeChange: (v: number) => void;
  linkedChordsMuted: boolean;
  onLinkedChordsMutedChange: (muted: boolean) => void;
  bassMuted?: boolean;
  onBassMutedChange?: (muted: boolean) => void;
  writeToPianoRoll: boolean;
  onWriteToPianoRollChange: (on: boolean) => void;
  onBassKeyDown: (midi: number) => void;
  /** Blue 808 Trap SubRoots on the roll (all channels). */
  subRootNoteCount?: number;
  onClearAllSubRoots?: () => void;
  onSubOctaveDown?: () => void;
  onSubOctaveUp?: () => void;
  chordStackNoteCount?: number;
  onChordOctaveDown?: () => void;
  onChordOctaveUp?: () => void;
  melodyLayerNoteCount?: number;
  onMelodyOctaveDown?: () => void;
  onMelodyOctaveUp?: () => void;
  suggestedSubMidis?: readonly number[];
  subGuideAuditionMidi?: number | null;
  subGuideStepCount?: number;
  onRegenerateSubGuide?: () => void;
  onAuditionSubGuide?: () => void;
  onStopSubGuideAudition?: () => void;
  onPushSubGuideToRoll?: () => void;
  bassAutoAdvance?: boolean;
  onBassAutoAdvanceChange?: (on: boolean) => void;
  bassDrawNotes?: boolean;
  onBassDrawNotesChange?: (on: boolean) => void;
  bassKeypadPreviewMode?: BassKeypadPreviewMode;
  onBassKeypadPreviewModeChange?: (mode: BassKeypadPreviewMode) => void;
  bassKeypadSoundLabel?: string;
  bassKeypadChordVoiceLabel?: string;
  bassSoundId?: GrooveLabBassSoundId;
  onBassSoundChange?: (id: GrooveLabBassSoundId) => void;
  /** Groove Lab — MELODY & RIFFS composer (optional on Orchid Studio). */
  melodySoundId?: GrooveLabBassSoundId;
  onMelodySoundChange?: (id: GrooveLabBassSoundId) => void;
  composerComplexity?: number;
  onComposerComplexityChange?: (v: number) => void;
  onGenerateComposerPart?: (part: GrooveComposerPart) => void;
  onLockChords?: () => void;
  melodyNoteCount?: number;
  /** Progression strip — optional sub roots (+ SUB in composer panel). */
  onMatchBassToChords?: () => void;
  onGenerateChordPattern?: () => void;
  progressionId?: OrchidProgressionId;
  progressions?: ReadonlyArray<{ id: OrchidProgressionId; label: string }>;
  onProgressionChange?: (id: OrchidProgressionId) => void;
  chordColumnCount?: number;
  chordAutoAdvance?: boolean;
  onChordAutoAdvanceChange?: (on: boolean) => void;
  bassAnchorCount?: number;
  chordVoice?: ChordVoiceId;
  onChordVoiceChange?: (id: ChordVoiceId) => void;
  transportPlaying?: boolean;
  transportDisabled?: boolean;
  onTransportRewind?: () => void;
  onTransportStop?: () => void;
  onTransportPlayPause?: () => void;
  onTransportFastForward?: () => void;
  layerChannels?: readonly number[];
  bassChannel?: number;
  chordChannel?: number;
  melodyChannel?: number;
  onBassChannelChange?: (ch: number) => void;
  onChordChannelChange?: (ch: number) => void;
  onMelodyChannelChange?: (ch: number) => void;
  channelVolumes?: Record<number, number>;
  setChannelVolume?: (chId: number, volume: number) => void;
  metronomeEnabled?: boolean;
  onMetronomeToggle?: () => void;
  grooveQuantize?: GrooveLabQuantize;
  grooveBarCount?: number;
  getAudioContext?: () => AudioContext;
  onApplyImportedBassHits?: (hits: GrooveRollHit[]) => void;
  progressionExportBusy?: boolean;
  progressionExportStatus?: string | null;
  onProgressionExportTimelineMidi?: (steps: GrooveProgressionStep[]) => void;
  onProgressionExportTimelineWav?: (steps: GrooveProgressionStep[]) => void | Promise<void>;
  onProgressionExportTimelineWavToPad?: (steps: GrooveProgressionStep[]) => void | Promise<void>;
  onProgressionExportRollMidi?: () => void;
  onProgressionExportRollWav?: () => void | Promise<void>;
  onProgressionExportRollWavToPad?: () => void | Promise<void>;
  onProgressionSendToNewSynth?: (steps: GrooveProgressionStep[]) => void;
  onProgressionSendRollToNewSynth?: () => void;
  rollHasChordsForExport?: boolean;
  rollHasNotesForExport?: boolean;
  padExportEnabled?: boolean;
}

export function OrchidPerformancePanel({
  grooveBranding = false,
  chordLabel,
  matchLabel,
  orchidType,
  onTypeChange,
  extensions,
  onToggleExtension,
  inversion,
  maxInversion,
  onInversionChange,
  perfMode,
  onPerfModeChange,
  diatonicRoots,
  selectedRootMidi,
  onRootChange,
  smartMatch,
  onSmartMatchChange,
  progressionBpm = 120,
  onProgressionBpmChange,
  progressionSessionBpmLocked = false,
  progressionKeyRoot = 0,
  progressionMode = 'major',
  progressionChordVoiceLabel = 'Orchid',
  progressionStaged = null,
  progressionStatus = null,
  progressionAuditionPlaying = false,
  progressionAuditionStepIndex = null,
  onProgressionStepsChange,
  onProgressionBuild,
  onProgressionPreviewStep,
  onProgressionPlay,
  onProgressionLoop,
  onProgressionStopAudition,
  onProgressionDropChords,
  onProgressionDropWithBass,
  onPreview,
  onWriteChordToRoll,
  chordNotePreview,
  onPinToPad,
  pinDisabled,
  bassKeys,
  linkedChordVolume,
  onLinkedChordVolumeChange,
  linkedChordsMuted,
  onLinkedChordsMutedChange,
  bassMuted,
  onBassMutedChange,
  writeToPianoRoll,
  onWriteToPianoRollChange,
  onBassKeyDown,
  subRootNoteCount = 0,
  onClearAllSubRoots,
  onSubOctaveDown,
  onSubOctaveUp,
  chordStackNoteCount = 0,
  onChordOctaveDown,
  onChordOctaveUp,
  melodyLayerNoteCount = 0,
  onMelodyOctaveDown,
  onMelodyOctaveUp,
  suggestedSubMidis = [],
  subGuideAuditionMidi = null,
  subGuideStepCount = 0,
  onRegenerateSubGuide,
  onAuditionSubGuide,
  onStopSubGuideAudition,
  onPushSubGuideToRoll,
  bassAutoAdvance = false,
  onBassAutoAdvanceChange,
  bassDrawNotes = false,
  onBassDrawNotesChange,
  bassKeypadPreviewMode = 'bass',
  onBassKeypadPreviewModeChange,
  bassKeypadSoundLabel,
  bassKeypadChordVoiceLabel,
  bassSoundId,
  onBassSoundChange,
  melodySoundId,
  onMelodySoundChange,
  composerComplexity,
  onComposerComplexityChange,
  onGenerateComposerPart,
  onLockChords,
  melodyNoteCount,
  onMatchBassToChords,
  onGenerateChordPattern,
  progressionId,
  progressions,
  onProgressionChange,
  chordColumnCount = 0,
  chordAutoAdvance = true,
  onChordAutoAdvanceChange,
  bassAnchorCount,
  chordVoice,
  onChordVoiceChange,
  transportPlaying,
  transportDisabled,
  onTransportRewind,
  onTransportStop,
  onTransportPlayPause,
  onTransportFastForward,
  layerChannels,
  bassChannel,
  chordChannel,
  melodyChannel,
  onBassChannelChange,
  onChordChannelChange,
  onMelodyChannelChange,
  channelVolumes,
  setChannelVolume,
  metronomeEnabled,
  onMetronomeToggle,
  grooveQuantize,
  grooveBarCount,
  getAudioContext,
  onApplyImportedBassHits,
  progressionExportBusy,
  progressionExportStatus,
  onProgressionExportTimelineMidi,
  onProgressionExportTimelineWav,
  onProgressionExportTimelineWavToPad,
  onProgressionExportRollMidi,
  onProgressionExportRollWav,
  onProgressionExportRollWavToPad,
  onProgressionSendToNewSynth,
  onProgressionSendRollToNewSynth,
  rollHasChordsForExport,
  rollHasNotesForExport,
  padExportEnabled,
}: OrchidPerformancePanelProps) {
  const chordBrand = grooveLabChordLabels(grooveBranding);
  const showMelodyComposer =
    melodySoundId != null &&
    onMelodySoundChange != null &&
    onComposerComplexityChange != null &&
    onGenerateComposerPart != null &&
    onLockChords != null &&
    melodyNoteCount != null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        borderBottom: '1px solid #1a2e22',
        background: '#050805',
      }}
    >
      <div style={{ flex: 1.15, minWidth: 0 }}>
        <OrchidChordStrip
          grooveBranding={grooveBranding}
          chordSectionLabel={chordBrand.section}
          chordLabel={chordLabel}
          orchidType={orchidType}
          onTypeChange={onTypeChange}
          extensions={extensions}
          onToggleExtension={onToggleExtension}
          inversion={inversion}
          maxInversion={maxInversion}
          onInversionChange={onInversionChange}
          perfMode={perfMode}
          onPerfModeChange={onPerfModeChange}
          diatonicRoots={diatonicRoots}
          selectedRootMidi={selectedRootMidi}
          onRootChange={onRootChange}
          smartMatch={smartMatch}
          onSmartMatchChange={onSmartMatchChange}
          progressionBpm={progressionBpm}
          onProgressionBpmChange={onProgressionBpmChange}
          progressionSessionBpmLocked={progressionSessionBpmLocked}
          progressionKeyRoot={progressionKeyRoot}
          progressionMode={progressionMode}
          progressionChordVoiceLabel={progressionChordVoiceLabel}
          progressionStaged={progressionStaged}
          progressionStatus={progressionStatus}
          progressionAuditionPlaying={progressionAuditionPlaying}
          progressionAuditionStepIndex={progressionAuditionStepIndex}
          onProgressionStepsChange={onProgressionStepsChange}
          onProgressionBuild={onProgressionBuild}
          onProgressionPreviewStep={onProgressionPreviewStep}
          onProgressionPlay={onProgressionPlay}
          onProgressionLoop={onProgressionLoop}
          onProgressionStopAudition={onProgressionStopAudition}
          onProgressionDropChords={onProgressionDropChords}
          onProgressionDropWithBass={onProgressionDropWithBass}
          exportBusy={progressionExportBusy}
          exportStatus={progressionExportStatus}
          onExportTimelineMidi={onProgressionExportTimelineMidi}
          onExportTimelineWav={onProgressionExportTimelineWav}
          onExportTimelineWavToPad={onProgressionExportTimelineWavToPad}
          onSendTimelineToNewSynth={onProgressionSendToNewSynth}
          onSendRollToNewSynth={onProgressionSendRollToNewSynth}
          onExportRollMidi={onProgressionExportRollMidi}
          onExportRollWav={onProgressionExportRollWav}
          onExportRollWavToPad={onProgressionExportRollWavToPad}
          rollHasChords={rollHasChordsForExport}
          rollHasNotes={rollHasNotesForExport}
          padExportEnabled={padExportEnabled}
          onPreview={onPreview}
          onWriteChordToRoll={onWriteChordToRoll}
          chordNotePreview={chordNotePreview}
          progressionId={progressionId}
          progressions={progressions}
          onProgressionChange={onProgressionChange}
          onGenerateChordPattern={onGenerateChordPattern}
          onMatchBassToChords={onMatchBassToChords}
          chordColumnCount={chordColumnCount}
          chordAutoAdvance={chordAutoAdvance}
          onChordAutoAdvanceChange={onChordAutoAdvanceChange}
          onPinToPad={onPinToPad}
          pinDisabled={pinDisabled}
          chordVoice={chordVoice}
          onChordVoiceChange={onChordVoiceChange}
          transportPlaying={transportPlaying}
          transportDisabled={transportDisabled}
          onTransportRewind={onTransportRewind}
          onTransportStop={onTransportStop}
          onTransportPlayPause={onTransportPlayPause}
          onTransportFastForward={onTransportFastForward}
          layerChannels={layerChannels}
          bassChannel={bassChannel}
          chordChannel={chordChannel}
          melodyChannel={melodyChannel}
          onBassChannelChange={onBassChannelChange}
          onChordChannelChange={onChordChannelChange}
          onMelodyChannelChange={onMelodyChannelChange}
          channelVolumes={channelVolumes}
          setChannelVolume={setChannelVolume}
          metronomeEnabled={metronomeEnabled}
          onMetronomeToggle={onMetronomeToggle}
          chordStackNoteCount={chordStackNoteCount}
          onChordOctaveDown={onChordOctaveDown}
          onChordOctaveUp={onChordOctaveUp}
        />
      </div>
      <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column' }}>
        {showMelodyComposer ? (
          <GrooveLabComposerPanel
            grooveBranding={grooveBranding}
            melodySoundId={melodySoundId}
            onMelodySoundChange={onMelodySoundChange}
            complexity={composerComplexity ?? 0.55}
            onComplexityChange={onComposerComplexityChange}
            onGeneratePart={onGenerateComposerPart}
            onLockChords={onLockChords}
            chordColumnCount={chordColumnCount}
            melodyNoteCount={melodyNoteCount}
            subRootNoteCount={subRootNoteCount}
            onClearAllSubRoots={onClearAllSubRoots}
            onSubOctaveDown={onSubOctaveDown}
            onSubOctaveUp={onSubOctaveUp}
            melodyLayerNoteCount={melodyLayerNoteCount}
            onMelodyOctaveDown={onMelodyOctaveDown}
            onMelodyOctaveUp={onMelodyOctaveUp}
            onRegenerateSubGuide={onRegenerateSubGuide}
            onAuditionSubGuide={onAuditionSubGuide}
            onPushSubGuideToRoll={onPushSubGuideToRoll}
            subGuideStepCount={subGuideStepCount}
          />
        ) : null}
        <OrchidBassKeypad
          chordBrandShort={chordBrand.short}
          chordSoundBankLabel={chordBrand.soundBank}
          keys={bassKeys}
          matchLabel={matchLabel}
          linkedChordVolume={linkedChordVolume}
          onLinkedChordVolumeChange={onLinkedChordVolumeChange}
          linkedChordsMuted={linkedChordsMuted}
          onLinkedChordsMutedChange={onLinkedChordsMutedChange}
          bassMuted={bassMuted}
          onBassMutedChange={onBassMutedChange}
          writeToPianoRoll={writeToPianoRoll}
          onWriteToPianoRollChange={onWriteToPianoRollChange}
          onKeyDown={onBassKeyDown}
          subRootNoteCount={subRootNoteCount}
          onClearAllSubRoots={onClearAllSubRoots}
          onSubOctaveDown={onSubOctaveDown}
          onSubOctaveUp={onSubOctaveUp}
          suggestedSubMidis={suggestedSubMidis}
          guideAuditionMidi={subGuideAuditionMidi}
          subGuideStepCount={subGuideStepCount}
          onRegenerateSubGuide={onRegenerateSubGuide}
          onAuditionSubGuide={onAuditionSubGuide}
          onStopSubGuideAudition={onStopSubGuideAudition}
          onPushSubGuideToRoll={onPushSubGuideToRoll}
          bassSoundId={bassSoundId}
          onBassSoundChange={onBassSoundChange}
          bassAutoAdvance={bassAutoAdvance}
          onBassAutoAdvanceChange={onBassAutoAdvanceChange}
          bassDrawNotes={bassDrawNotes}
          onBassDrawNotesChange={onBassDrawNotesChange}
          onDropMidiToGrid={
            onGenerateComposerPart ? () => onGenerateComposerPart('melody') : undefined
          }
          previewMode={bassKeypadPreviewMode}
          onPreviewModeChange={onBassKeypadPreviewModeChange}
          bassSoundLabel={bassKeypadSoundLabel}
          chordVoiceLabel={bassKeypadChordVoiceLabel}
        />
      </div>
    </div>
  );
}
