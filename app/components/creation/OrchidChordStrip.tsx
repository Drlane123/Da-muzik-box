import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { GrooveOctaveShiftButtons } from '@/app/components/creation/GrooveOctaveShiftButtons';
import { GrooveLabMixerPanel } from '@/app/components/creation/GrooveLabMixerPanel';
import { GrooveLabGuitarFxStrip } from '@/app/components/creation/GrooveLabGuitarFxStrip';
import { GrooveLabMidiToVocalBoxPanel, type GrooveLabMidiToVocalBoxPanelProps } from '@/app/components/creation/GrooveLabMidiToVocalBoxPanel';
import { GrooveLabGuitarPackPanel } from '@/app/components/creation/GrooveLabGuitarPackPanel';
import type { GrooveLabGuitarFxSettings } from '@/app/lib/creationStation/grooveLabGuitarFx';
import { OrchidProgressionBuilder } from '@/app/components/creation/OrchidProgressionBuilder';
import type { GrooveGuitarPackRollBuild } from '@/app/lib/creationStation/grooveLabGuitarPackLibrary';
import type { GrooveLabQuantize } from '@/app/lib/creationStation/grooveLabRoll';
import { GrooveLabChannelRail } from '@/app/components/creation/GrooveLabChannelRail';
import { GrooveLabTempoStrip } from '@/app/components/creation/GrooveLabTempoStrip';
import { OrchidTransportControls } from '@/app/components/creation/OrchidTransportControls';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import type { GrooveStagedProgression } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import {
  CHORD_VOICES_BY_CATEGORY,
  CHORD_VOICE_MAP,
  type ChordVoiceCategory,
  type ChordVoiceId,
} from '@/app/lib/creationStation/chordSequencerVoices';
import type { GrooveLabAnyLeadSoundId } from '@/app/lib/creationStation/grooveLabLeadSounds';
import {
  GROOVE_GUITAR_SOUND_CATEGORIES,
  GROOVE_GUITAR_SOUND_MAP,
  GROOVE_GUITAR_SOUNDS_BY_CATEGORY,
} from '@/app/lib/creationStation/grooveLabGuitarSoundBank';
import {
  loadOrchestraHitManifest,
  type OrchestraHitId,
} from '@/app/lib/creationStation/grooveLabOrchestraHitBank';
import {
  GROOVE_ORCHESTRA_HIT_MAP,
  refreshOrchestraHitSoundCatalog,
} from '@/app/lib/creationStation/grooveLabOrchestraHitSoundBank';
import {
  ORCHID_CHORD_TYPES,
  ORCHID_EXTENSIONS,
  ORCHID_PERF_MODES,
  type OrchidChordType,
  type OrchidExtension,
  type OrchidPerformanceMode,
} from '@/app/lib/creationStation/orchidChordEngine';
import type { OrchidProgressionId } from '@/app/lib/creationStation/grooveLabOrchidMatch';
import { GrooveLabHelpTip } from '@/app/components/creation/GrooveLabHelpHub';

const CHORD_SOUND_CATEGORIES: { id: ChordVoiceCategory; label: string }[] = [
  { id: 'piano', label: 'PIANO' },
  { id: 'strings', label: 'STRINGS' },
  { id: 'keys', label: 'KEYS' },
  { id: 'blend', label: 'BLENDS' },
];

export interface OrchidChordStripProps {
  grooveBranding?: boolean;
  chordSectionLabel?: string;
  chordLabel: string;
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
  grooveGuitarPackQuantize?: GrooveLabQuantize;
  grooveGuitarPackBarCount?: number;
  grooveGuitarPackSustainSlots?: number;
  grooveGuitarPackChordHits?: readonly import('@/app/lib/creationStation/grooveLabRoll').GrooveRollHit[];
  grooveGuitarPackBassRootMidi?: number;
  onDropGuitarPack?: (built: GrooveGuitarPackRollBuild) => void;
  onDropOrchestraHit?: () => void;
  grooveGuitarPackGetAudioContext?: () => AudioContext | null;
  onGuitarPackStatus?: (msg: string | null) => void;
  onPreview: () => void;
  /** Stack green chord notes on the roll at the edit column (one note per key). */
  onWriteChordToRoll?: () => void;
  chordNotePreview?: string;
  progressionId?: OrchidProgressionId;
  progressions?: ReadonlyArray<{ id: OrchidProgressionId; label: string }>;
  onProgressionChange?: (id: OrchidProgressionId) => void;
  onGenerateChordPattern?: () => void;
  onMatchBassToChords?: () => void;
  chordColumnCount?: number;
  chordAutoAdvance?: boolean;
  onChordAutoAdvanceChange?: (on: boolean) => void;
  /** Orchid Studio / pad bank — omit in Groove Lab (no chord pads). */
  onPinToPad?: () => void;
  pinDisabled?: boolean;
  chordVoice: ChordVoiceId;
  onChordVoiceChange: (id: ChordVoiceId) => void;
  /** Groove Lab — guitar channel timbre (not chord / lead bank). */
  guitarSoundId?: GrooveLabAnyLeadSoundId;
  onGuitarSoundChange?: (id: GrooveLabAnyLeadSoundId) => void;
  orchestraHitId?: OrchestraHitId;
  onOrchestraHitChange?: (id: OrchestraHitId) => void;
  guitarFx?: GrooveLabGuitarFxSettings;
  onGuitarWahAmountChange?: (v: number) => void;
  onGuitarWahRateHzChange?: (v: number) => void;
  onGuitarFilterCutoffHzChange?: (v: number) => void;
  onGuitarLowCutHzChange?: (v: number) => void;
  onGuitarHighCutHzChange?: (v: number) => void;
  onGuitarDriveChange?: (v: number) => void;
  onGuitarDistortionChange?: (v: number) => void;
  onGuitarLfoRateHzChange?: (v: number) => void;
  onGuitarLfoDepthCentsChange?: (v: number) => void;
  onGuitarGlideMsChange?: (v: number) => void;
  transportPlaying?: boolean;
  transportDisabled?: boolean;
  onTransportRewind?: () => void;
  onTransportStop?: () => void;
  onTransportPlayPause?: () => void;
  onTransportFastForward?: () => void;
  layerChannels?: readonly number[];
  chordChannel?: number;
  melodyChannel?: number;
  guitarChannel?: number;
  sampleChannel?: number;
  onChordChannelChange?: (ch: number) => void;
  onMelodyChannelChange?: (ch: number) => void;
  channelSounds?: Record<number, import('@/app/lib/creationStation/grooveLabChannelConfig').GrooveLabChannelSoundConfig>;
  onChannelSoundChange?: (
    ch: number,
    cfg: import('@/app/lib/creationStation/grooveLabChannelConfig').GrooveLabChannelSoundConfig,
  ) => void;
  onAssignLayerRole?: (
    ch: number,
    role: import('@/app/lib/creationStation/grooveLabChannelConfig').GrooveLabLayerRole,
  ) => void;
  selectedEditChannel?: number;
  onSelectEditChannel?: (ch: number) => void;
  channelNoteCounts?: Record<number, number>;
  channelVolumes?: Record<number, number>;
  setChannelVolume?: (chId: number, volume: number) => void;
  metronomeEnabled?: boolean;
  onMetronomeToggle?: () => void;
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
  rollHasNotes?: boolean;
  padExportEnabled?: boolean;
  chordStackNoteCount?: number;
  onChordOctaveDown?: () => void;
  onChordOctaveUp?: () => void;
  /** Groove Lab — MIDI melody + lyrics → VocalBox auto-tune preview. */
  vocalBox?: GrooveLabMidiToVocalBoxPanelProps | null;
}

export function OrchidChordStrip({
  grooveBranding = false,
  chordSectionLabel = 'ORCHID CHORD',
  chordLabel,
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
  grooveGuitarPackQuantize,
  grooveGuitarPackBarCount,
  grooveGuitarPackSustainSlots,
  grooveGuitarPackChordHits,
  grooveGuitarPackBassRootMidi,
  onDropGuitarPack,
  onDropOrchestraHit,
  grooveGuitarPackGetAudioContext,
  onGuitarPackStatus,
  onPreview,
  onWriteChordToRoll,
  chordNotePreview,
  progressionId,
  progressions,
  onProgressionChange,
  onGenerateChordPattern,
  onMatchBassToChords,
  chordColumnCount = 0,
  chordAutoAdvance = true,
  onChordAutoAdvanceChange,
  onPinToPad,
  pinDisabled,
  chordVoice,
  onChordVoiceChange,
  guitarSoundId,
  onGuitarSoundChange,
  orchestraHitId,
  onOrchestraHitChange,
  guitarFx,
  onGuitarWahAmountChange,
  onGuitarWahRateHzChange,
  onGuitarFilterCutoffHzChange,
  onGuitarLowCutHzChange,
  onGuitarHighCutHzChange,
  onGuitarDriveChange,
  onGuitarDistortionChange,
  onGuitarLfoRateHzChange,
  onGuitarLfoDepthCentsChange,
  onGuitarGlideMsChange,
  transportPlaying = false,
  transportDisabled = true,
  onTransportRewind,
  onTransportStop,
  onTransportPlayPause,
  onTransportFastForward,
  layerChannels,
  chordChannel,
  melodyChannel,
  guitarChannel,
  sampleChannel,
  onChordChannelChange,
  onMelodyChannelChange,
  channelSounds,
  onChannelSoundChange,
  onAssignLayerRole,
  channelVolumes,
  setChannelVolume,
  metronomeEnabled = true,
  onMetronomeToggle,
  exportBusy,
  exportStatus,
  onExportTimelineMidi,
  onExportTimelineWav,
  onExportTimelineWavToPad,
  onSendTimelineToNewSynth,
  onSendRollToNewSynth,
  onExportRollMidi,
  onExportRollWav,
  onExportRollWavToPad,
  rollHasChords = false,
  rollHasNotes = false,
  padExportEnabled = true,
  chordStackNoteCount = 0,
  onChordOctaveDown,
  onChordOctaveUp,
  vocalBox,
  selectedEditChannel,
  onSelectEditChannel,
  channelNoteCounts,
}: OrchidChordStripProps) {
  const voiceDef = CHORD_VOICE_MAP[chordVoice];
  const guitarVoiceDef = guitarSoundId ? GROOVE_GUITAR_SOUND_MAP[guitarSoundId] : undefined;
  const showGuitarSoundBank =
    grooveBranding && guitarChannel != null && onGuitarSoundChange != null && guitarSoundId != null;
  const showOrchestraHitBank =
    grooveBranding &&
    sampleChannel != null &&
    onOrchestraHitChange != null &&
    orchestraHitId != null;
  const [orchestraHitCatalog, setOrchestraHitCatalog] = useState(refreshOrchestraHitSoundCatalog);
  const orchestraHitDef = GROOVE_ORCHESTRA_HIT_MAP[orchestraHitId ?? ''] ?? orchestraHitCatalog[0];

  useEffect(() => {
    if (!showOrchestraHitBank) return;
    let cancelled = false;
    void (async () => {
      await loadOrchestraHitManifest();
      if (cancelled) return;
      setOrchestraHitCatalog(refreshOrchestraHitSoundCatalog());
    })();
    return () => {
      cancelled = true;
    };
  }, [showOrchestraHitBank]);

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const showGrooveChannelBank =
    grooveBranding &&
    chordChannel != null &&
    melodyChannel != null &&
    onAssignLayerRole != null &&
    selectedEditChannel != null &&
    onSelectEditChannel != null;
  const showGrooveMixer =
    grooveBranding && channelVolumes != null && setChannelVolume != null;
  const [grooveLabMixerOpen, setGrooveLabMixerOpen] = useState(false);
  const showTransport =
    onTransportRewind != null &&
    onTransportStop != null &&
    onTransportPlayPause != null &&
    onTransportFastForward != null;
  const mixerSectionRef = useRef<HTMLDivElement>(null);
  const showMixerSection = showGrooveChannelBank || showGrooveMixer;
  const showMixerToolbar = showTransport || showGrooveMixer;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #071208 0%, #050805 100%)',
        padding: '6px 12px',
        height: '100%',
        minHeight: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: 0.6,
            color: '#a7f3d0',
          }}
        >
          {chordSectionLabel}
          <GrooveLabHelpTip tab="chords" title="Orchid chord strip help" />
        </span>
        <span style={{ fontSize: 8, color: '#4ade80', fontWeight: 800 }}>green C layer</span>
        <span style={{ fontSize: 11, fontWeight: 900, color: '#ecfdf5' }}>{chordLabel}</span>
        <span style={{ fontSize: 8, color: '#4b5563', fontWeight: 700 }}>
          {voiceDef?.short ?? 'Grand'} · piano/strings (not 808)
        </span>
        {chordNotePreview ? (
          <span
            style={{ fontSize: 8, color: '#4ade80', fontWeight: 800 }}
            title="Notes that will land on the chord channel (high keys)"
          >
            {chordNotePreview}
          </span>
        ) : null}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onSmartMatchChange(!smartMatch)}
            title={smartMatch
              ? 'Bass keypad picks chord type per scale degree (I, ii, V…)'
              : 'Bass keypad uses the TYPE buttons above for every key'}
            style={{
              background: smartMatch ? '#0e2838' : '#1a0f0f',
              color: smartMatch ? '#67e8f9' : '#f87171',
              border: `1px solid ${smartMatch ? '#3b82f688' : '#3a1f1f'}`,
              borderRadius: 5,
              padding: '3px 8px',
              fontSize: 8,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            {smartMatch ? 'SMART MATCH' : 'LOCK TYPE'}
          </button>
          {onProgressionBuild &&
          onProgressionPreviewStep &&
          onProgressionPlay &&
          onProgressionLoop &&
          onProgressionStopAudition &&
          onProgressionDropChords ? (
            <OrchidProgressionBuilder
              grooveBranding={grooveBranding}
              bpm={progressionBpm}
              onBpmChange={onProgressionBpmChange}
              sessionBpmLocked={progressionSessionBpmLocked}
              keyRoot={progressionKeyRoot}
              mode={progressionMode}
              chordVoiceLabel={progressionChordVoiceLabel}
              staged={progressionStaged}
              status={progressionStatus}
              auditionPlaying={progressionAuditionPlaying}
              auditionStepIndex={progressionAuditionStepIndex}
              onStepsChange={onProgressionStepsChange ?? (() => {})}
              onBuild={onProgressionBuild}
              onPreviewStep={onProgressionPreviewStep}
              onPlayProgression={onProgressionPlay}
              onLoopProgression={onProgressionLoop}
              onStopAudition={onProgressionStopAudition}
              onDropChordsToRoll={onProgressionDropChords}
              onDropWithMatchBass={onProgressionDropWithBass}
              exportBusy={exportBusy}
              exportStatus={exportStatus}
              onExportTimelineMidi={onExportTimelineMidi}
              onExportTimelineWav={onExportTimelineWav}
              onExportTimelineWavToPad={onExportTimelineWavToPad}
              onSendTimelineToNewSynth={onSendTimelineToNewSynth}
              onSendRollToNewSynth={onSendRollToNewSynth}
              onExportRollMidi={onExportRollMidi}
              onExportRollWav={onExportRollWav}
              onExportRollWavToPad={onExportRollWavToPad}
              rollHasChords={rollHasChords}
            />
          ) : null}
          {grooveBranding &&
          onDropGuitarPack &&
          grooveGuitarPackQuantize != null &&
          grooveGuitarPackBarCount != null &&
          grooveGuitarPackSustainSlots != null &&
          grooveGuitarPackChordHits != null &&
          guitarChannel != null &&
          grooveGuitarPackGetAudioContext &&
          onGuitarSoundChange &&
          onProgressionStopAudition ? (
            <GrooveLabGuitarPackPanel
              bpm={progressionBpm}
              quantize={grooveGuitarPackQuantize}
              barCount={grooveGuitarPackBarCount}
              sustainSlots={grooveGuitarPackSustainSlots}
              chordHits={grooveGuitarPackChordHits}
              keyRoot={progressionKeyRoot}
              mode={progressionMode}
              bassRootMidi={grooveGuitarPackBassRootMidi}
              guitarChannel={guitarChannel}
              channelVolumes={channelVolumes}
              getAudioContext={grooveGuitarPackGetAudioContext}
              onDropToRoll={onDropGuitarPack}
              onPickGuitarLick={onGuitarSoundChange}
              onStopAudition={onProgressionStopAudition}
              onStatus={onGuitarPackStatus}
              guitarFx={guitarFx}
            />
          ) : null}
          <button
            type="button"
            onClick={onPreview}
            style={{
              background: '#112015',
              color: '#86efac',
              border: '1px solid #22c55e55',
              borderRadius: 5,
              padding: '3px 10px',
              fontSize: 9,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            ▶ PREVIEW
          </button>
          {onWriteChordToRoll ? (
            <button
              type="button"
              onClick={onWriteChordToRoll}
              title="Place each chord tone as a separate green note on the grid (C4+, aligned to column)"
              style={{
                background: '#15321e',
                color: '#4ade80',
                border: '1px solid #22c55e88',
                borderRadius: 5,
                padding: '3px 10px',
                fontSize: 9,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              + CHORD TO GRID
            </button>
          ) : null}
          {onChordOctaveDown && onChordOctaveUp ? (
            <GrooveOctaveShiftButtons
              layerLabel="CHORD"
              accentColor="#86efac"
              borderColor="#22c55e"
              noteCount={chordStackNoteCount}
              onOctaveDown={onChordOctaveDown}
              onOctaveUp={onChordOctaveUp}
              downTitle="All green chord tones — down one octave"
              upTitle="All green chord tones — up one octave"
            />
          ) : null}
          {showGuitarSoundBank &&
          guitarFx &&
          onGuitarWahAmountChange &&
          onGuitarWahRateHzChange &&
          onGuitarFilterCutoffHzChange &&
          onGuitarDriveChange &&
          onGuitarDistortionChange &&
          onGuitarLfoRateHzChange &&
          onGuitarLfoDepthCentsChange &&
          onGuitarGlideMsChange ? (
            <GrooveLabGuitarFxStrip
              fx={guitarFx}
              onWahAmountChange={onGuitarWahAmountChange}
              onWahRateHzChange={onGuitarWahRateHzChange}
              onFilterCutoffHzChange={onGuitarFilterCutoffHzChange}
              onLowCutHzChange={onGuitarLowCutHzChange}
              onHighCutHzChange={onGuitarHighCutHzChange}
              onDriveChange={onGuitarDriveChange}
              onDistortionChange={onGuitarDistortionChange}
              onLfoRateHzChange={onGuitarLfoRateHzChange}
              onLfoDepthCentsChange={onGuitarLfoDepthCentsChange}
              onGlideMsChange={onGuitarGlideMsChange}
            />
          ) : null}
          {onChordAutoAdvanceChange ? (
            <button
              type="button"
              onClick={() => onChordAutoAdvanceChange(!chordAutoAdvance)}
              title="After + CHORD TO GRID, move playhead to the next column"
              style={{
                background: chordAutoAdvance ? '#0e2838' : '#111',
                color: chordAutoAdvance ? '#67e8f9' : '#6b7280',
                border: `1px solid ${chordAutoAdvance ? '#3b82f666' : '#1a1a1a'}`,
                borderRadius: 5,
                padding: '3px 8px',
                fontSize: 8,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              {chordAutoAdvance ? 'ADV COL' : 'STAY COL'}
            </button>
          ) : null}
          {grooveBranding && vocalBox ? <GrooveLabMidiToVocalBoxPanel {...vocalBox} /> : null}
          {onMatchBassToChords ? (
            <button
              type="button"
              onClick={onMatchBassToChords}
              disabled={chordColumnCount === 0}
              title="Regenerate orange sub keys on the 808 keypad from green chord columns (roll unchanged)"
              style={{
                background: '#0c1828',
                color: '#93c5fd',
                border: '1px solid #3b82f688',
                borderRadius: 5,
                padding: '3px 10px',
                fontSize: 9,
                fontWeight: 900,
                cursor: chordColumnCount === 0 ? 'not-allowed' : 'pointer',
                opacity: chordColumnCount === 0 ? 0.45 : 1,
              }}
            >
              LIGHT SUB KEYS
            </button>
          ) : null}
          {onPinToPad ? (
            <button
              type="button"
              onClick={onPinToPad}
              disabled={pinDisabled}
              title="Store this voicing on the selected chord pad"
              style={{
                background: pinDisabled ? '#111' : '#1a1408',
                color: pinDisabled ? '#555' : '#fde68a',
                border: `1px solid ${pinDisabled ? '#222' : '#4a3c1a'}`,
                borderRadius: 5,
                padding: '3px 10px',
                fontSize: 9,
                fontWeight: 900,
                cursor: pinDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              PIN TO PAD
            </button>
          ) : null}
        </div>
      </div>

      {progressions && progressionId && onProgressionChange && onGenerateChordPattern ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 6,
            padding: '4px 0',
            borderBottom: '1px solid #1a2e22',
          }}
        >
          <span style={{ fontSize: 8, color: '#4b5563', fontWeight: 800 }}>KEY DEGREES</span>
          <select
            value={progressionId}
            onChange={(e) => onProgressionChange(e.target.value as OrchidProgressionId)}
            style={{
              background: '#0a0e16',
              color: '#86efac',
              border: '1px solid #22c55e55',
              borderRadius: 4,
              padding: '3px 6px',
              fontSize: 8,
              fontWeight: 800,
              maxWidth: 180,
            }}
            title="Diatonic chord pattern across bars (one chord per bar)"
          >
            {progressions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onGenerateChordPattern}
            style={{
              background: '#15321e',
              color: '#86efac',
              border: '1px solid #22c55e88',
              borderRadius: 5,
              padding: '4px 12px',
              fontSize: 9,
              fontWeight: 900,
              cursor: 'pointer',
            }}
            title="Write full green chord pattern to the roll from TYPE + KEY + progression"
          >
            GEN CHORD PATTERN
          </button>
          <span style={{ fontSize: 7, color: '#4b5563', lineHeight: 1.35 }}>
            {onMatchBassToChords
              ? <>Build chords here first · then <strong style={{ color: '#93c5fd' }}>MATCH BASS →</strong> or draw bass under each column</>
              : 'Build chords here · production bass lives in Beat Lab NEW SYNTH'}
          </span>
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
        <span style={{ fontSize: 8, color: '#4b5563', fontWeight: 800, minWidth: 32 }}>TYPE</span>
        {ORCHID_CHORD_TYPES.map((t) => {
          const on = orchidType === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTypeChange(t.id)}
              style={{
                background: on ? '#15321e' : '#0d0d0d',
                color: on ? '#4ade80' : '#6b7280',
                border: `1px solid ${on ? '#22c55e88' : '#1a1a1a'}`,
                borderRadius: 5,
                padding: '3px 10px',
                fontSize: 9,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          );
        })}

        <div style={{ width: 1, height: 14, background: '#1f2e22' }} />

        <span style={{ fontSize: 8, color: '#4b5563', fontWeight: 800 }}>EXT</span>
        {ORCHID_EXTENSIONS.map((e) => {
          const on = extensions.has(e.id);
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onToggleExtension(e.id)}
              title="Hold/stack — toggle multiple"
              style={{
                background: on ? '#0e2838' : '#0d0d0d',
                color: on ? '#67e8f9' : '#6b7280',
                border: `1px solid ${on ? '#3b82f688' : '#1a1a1a'}`,
                borderRadius: 5,
                padding: '3px 8px',
                fontSize: 9,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              {e.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
        <span style={{ fontSize: 8, color: '#4b5563', fontWeight: 800, minWidth: 32 }}>ROOT</span>
        {diatonicRoots.map((midi) => {
          const on = midi % 12 === selectedRootMidi % 12;
          const label = NOTE_NAMES[midi % 12] ?? '?';
          return (
            <button
              key={midi}
              type="button"
              onClick={() => onRootChange(midi)}
              style={{
                background: on ? '#112015' : '#0d0d0d',
                color: on ? '#22c55e' : '#7a7a7a',
                border: `1px solid ${on ? '#1f3a29' : '#1a1a1a'}`,
                borderRadius: 5,
                padding: '2px 8px',
                fontSize: 10,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}

        <div style={{ width: 1, height: 14, background: '#1f2e22', marginLeft: 4 }} />

        <span style={{ fontSize: 8, color: '#4b5563', fontWeight: 800 }}>VOICING</span>
        <button
          type="button"
          onClick={() => onInversionChange(Math.max(0, inversion - 1))}
          style={{
            background: '#111',
            color: '#86efac',
            border: '1px solid #1f3a29',
            borderRadius: 4,
            padding: '1px 8px',
            fontSize: 11,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          −
        </button>
        <span style={{ fontSize: 9, color: '#a7f3d0', fontWeight: 900, minWidth: 48, textAlign: 'center' }}>
          inv {inversion + 1}/{maxInversion + 1}
        </span>
        <button
          type="button"
          onClick={() => onInversionChange(Math.min(maxInversion, inversion + 1))}
          style={{
            background: '#111',
            color: '#86efac',
            border: '1px solid #1f3a29',
            borderRadius: 4,
            padding: '1px 8px',
            fontSize: 11,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>

      <div
        style={{
          marginBottom: 6,
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          gap: 10,
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        <div style={{ flex: '0 0 auto', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 8, color: '#4b5563', fontWeight: 800, minWidth: 72 }}>SOUND BANK</span>
            <span style={{ fontSize: 8, color: '#6b7280', fontWeight: 600 }} title={voiceDef?.describe}>
              {voiceDef?.describe ?? 'Chord preview timbre'}
            </span>
          </div>
          {CHORD_SOUND_CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 3 }}
            >
              <span style={{ fontSize: 7, color: '#374151', fontWeight: 800, minWidth: 52 }}>{cat.label}</span>
              {CHORD_VOICES_BY_CATEGORY[cat.id].map((v) => {
                const on = chordVoice === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onChordVoiceChange(v.id)}
                    title={v.describe}
                    style={{
                      background: on ? '#112015' : '#0a0a0a',
                      color: on ? '#86efac' : '#6b7280',
                      border: `1px solid ${on ? '#22c55e66' : '#1a1a1a'}`,
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 7,
                      fontWeight: 900,
                      cursor: 'pointer',
                      letterSpacing: 0.2,
                    }}
                  >
                    {v.short}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {showGuitarSoundBank ? (
          <div
            style={{
              flex: '0 0 auto',
              borderLeft: '1px solid #2a2410',
              paddingLeft: 8,
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 8, color: '#92400e', fontWeight: 800 }}>GUITAR</span>
              <span
                style={{ fontSize: 7, color: '#78716c', fontWeight: 600 }}
                title={guitarVoiceDef?.describe ?? 'Guitar channel only'}
              >
                CH {guitarChannel}
              </span>
            </div>
            {GROOVE_GUITAR_SOUND_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flexWrap: 'nowrap',
                  marginBottom: 3,
                }}
              >
                <span style={{ fontSize: 7, color: '#57534e', fontWeight: 800, minWidth: 34 }}>
                  {cat.label}
                </span>
                {GROOVE_GUITAR_SOUNDS_BY_CATEGORY[cat.id].map((v) => {
                  const on = guitarSoundId === v.id;
                  return (
                    <button
                      key={`${cat.id}-${v.id}`}
                      type="button"
                      onClick={() => onGuitarSoundChange(v.id)}
                      title={v.describe}
                      style={{
                        background: on ? '#2a2410' : '#0a0a0a',
                        color: on ? '#fbbf24' : '#6b7280',
                        border: `1px solid ${on ? '#f59e0b88' : '#1a1a1a'}`,
                        borderRadius: 4,
                        padding: '2px 5px',
                        fontSize: 7,
                        fontWeight: 900,
                        cursor: 'pointer',
                        letterSpacing: 0.15,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            ))}
            {showOrchestraHitBank ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flexWrap: 'nowrap',
                  marginTop: 3,
                  marginBottom: 0,
                }}
              >
                <span style={{ fontSize: 7, color: '#57534e', fontWeight: 800, minWidth: 34 }}>
                  ORCH
                </span>
                <select
                  value={orchestraHitId}
                  onChange={(e) => onOrchestraHitChange!(e.target.value as OrchestraHitId)}
                  title={orchestraHitDef?.describe ?? 'Orchestra hit — CH 36 lane'}
                  style={{
                    flex: '1 1 auto',
                    minWidth: 0,
                    maxWidth: 120,
                    background: '#2a1a38',
                    color: '#c4b5fd',
                    border: '1px solid #a78bfa66',
                    borderRadius: 4,
                    padding: '2px 4px',
                    fontSize: 7,
                    fontWeight: 900,
                    cursor: 'pointer',
                    letterSpacing: 0.15,
                  }}
                >
                  {orchestraHitCatalog.map((hit) => (
                    <option key={hit.id} value={hit.id}>
                      {hit.label}
                    </option>
                  ))}
                </select>
                {onDropOrchestraHit ? (
                  <button
                    type="button"
                    onClick={onDropOrchestraHit}
                    disabled={chordColumnCount === 0}
                    title={
                      chordColumnCount === 0
                        ? 'Drop green chords first — orch hits lock to each chord downbeat'
                        : `Stamp ${orchestraHitDef?.label ?? 'orch hit'} on CH ${sampleChannel} at each chord root`
                    }
                    style={{
                      background: chordColumnCount === 0 ? '#0a0a0a' : '#2a1a38',
                      color: chordColumnCount === 0 ? '#4b5563' : '#c4b5fd',
                      border: `1px solid ${chordColumnCount === 0 ? '#1a1a1a' : '#a78bfa66'}`,
                      borderRadius: 4,
                      padding: '2px 5px',
                      fontSize: 7,
                      fontWeight: 900,
                      cursor: chordColumnCount === 0 ? 'not-allowed' : 'pointer',
                      letterSpacing: 0.15,
                      flexShrink: 0,
                      opacity: chordColumnCount === 0 ? 0.45 : 1,
                    }}
                  >
                    DROP
                  </button>
                ) : null}
                <span
                  style={{ fontSize: 6, color: '#6b7280', fontWeight: 700, flexShrink: 0 }}
                  title={`Orchestra hits play on CH ${sampleChannel}`}
                >
                  CH {sampleChannel}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 8, color: '#4b5563', fontWeight: 800, minWidth: 32 }}>PLAY</span>
        {ORCHID_PERF_MODES.map((p) => {
          const on = perfMode === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPerfModeChange(p.id)}
              title={p.hint}
              style={{
                background: on ? '#15321e' : '#0d0d0d',
                color: on ? '#4ade80' : '#6b7280',
                border: `1px solid ${on ? '#22c55e66' : '#1a1a1a'}`,
                borderRadius: 5,
                padding: '2px 8px',
                fontSize: 8,
                fontWeight: 900,
                cursor: 'pointer',
                letterSpacing: 0.3,
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {showMixerSection ? (
        <div
          ref={mixerSectionRef}
          style={{
            flex: showGrooveChannelBank ? 1 : undefined,
            display: 'flex',
            flexDirection: 'column',
            minHeight: showGrooveChannelBank ? 48 : undefined,
            minWidth: 0,
            marginTop: showGrooveChannelBank ? 4 : 0,
            position: 'relative',
          }}
        >
          {showMixerToolbar ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 6,
                flexShrink: 0,
                paddingBottom: 4,
                minHeight: 34,
              }}
            >
              {showTransport ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexShrink: 0,
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                  }}
                >
                  {grooveBranding && onProgressionBpmChange ? (
                    <GrooveLabTempoStrip
                      transportBar
                      bpm={progressionBpm}
                      onBpmChange={onProgressionBpmChange}
                      sessionLocked={progressionSessionBpmLocked}
                      transportPlaying={transportPlaying}
                    />
                  ) : null}
                  {grooveBranding && onMetronomeToggle ? (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={metronomeEnabled}
                      title={
                        metronomeEnabled
                          ? 'Metronome on — click to turn off'
                          : 'Metronome off — click to turn on'
                      }
                      onClick={onMetronomeToggle}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 26,
                        minWidth: 30,
                        padding: '0 6px',
                        borderRadius: 5,
                        border: '1px solid',
                        borderColor: metronomeEnabled ? '#1f3a29' : '#2a2a32',
                        background: metronomeEnabled ? '#15321e' : '#0d120f',
                        color: metronomeEnabled ? '#86efac' : '#5c5c68',
                        fontSize: 9,
                        fontWeight: 900,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      MET
                    </button>
                  ) : null}
                  <OrchidTransportControls
                    playing={transportPlaying}
                    playDisabled={transportDisabled}
                    onRewind={onTransportRewind!}
                    onStop={onTransportStop!}
                    onPlayPause={onTransportPlayPause!}
                    onFastForward={onTransportFastForward!}
                  />
                  <GrooveLabHelpTip tab="transport" title="Transport & playback help" />
                </div>
              ) : null}
              {showGrooveMixer ? (
                <>
                  <button
                    type="button"
                    onClick={() => setGrooveLabMixerOpen((o) => !o)}
                    title="16-channel Groove Lab mixer · CH 33–48 · CHORD · GROOVE LEAD · work lanes"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      height: 38,
                      padding: '0 14px',
                      borderRadius: 7,
                      border: `1px solid ${grooveLabMixerOpen ? 'rgba(74, 222, 128, 0.65)' : 'rgba(74, 222, 128, 0.35)'}`,
                      background: grooveLabMixerOpen
                        ? 'rgba(34, 197, 94, 0.16)'
                        : 'rgba(5, 12, 8, 0.92)',
                      color: '#86efac',
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: 'pointer',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <SlidersHorizontal size={18} strokeWidth={2.2} aria-hidden />
                    Mixer
                  </button>
                  <GrooveLabHelpTip tab="mixer" title="Groove Lab mixer help" />
                </>
              ) : null}
            </div>
          ) : null}
          {showGrooveChannelBank ? (
            <div
              style={{
                position: 'relative',
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {showGrooveMixer && grooveLabMixerOpen ? (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    bottom: '100%',
                    marginBottom: 2,
                    zIndex: 10,
                    maxWidth: 'min(98vw, 980px)',
                  }}
                >
                  <GrooveLabMixerPanel
                    open
                    onClose={() => setGrooveLabMixerOpen(false)}
                    channelVolumes={channelVolumes!}
                    setChannelVolume={setChannelVolume!}
                    chordChannel={chordChannel}
                    melodyChannel={melodyChannel}
                    guitarChannel={guitarChannel}
                    sampleChannel={sampleChannel}
                  />
                </div>
              ) : null}
              <GrooveLabChannelRail
                embed
                selectedChannel={selectedEditChannel!}
                onSelectChannel={onSelectEditChannel!}
                chordChannel={chordChannel!}
                melodyChannel={melodyChannel!}
                guitarChannel={guitarChannel}
                sampleChannel={sampleChannel}
                onAssignLayerRole={onAssignLayerRole!}
                noteCountByChannel={channelNoteCounts}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
