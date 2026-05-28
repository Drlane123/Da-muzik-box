import { useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { GrooveOctaveShiftButtons } from '@/app/components/creation/GrooveOctaveShiftButtons';
import { GrooveLabMixerPanel } from '@/app/components/creation/GrooveLabMixerPanel';
import { OrchidProgressionBuilder } from '@/app/components/creation/OrchidProgressionBuilder';
import { GrooveLabExportStrip } from '@/app/components/creation/GrooveLabExportStrip';
import { GrooveLabDraggableCornerPanel } from '@/app/components/creation/GrooveLabDraggableCornerPanel';
import { GrooveLabLayerChannels } from '@/app/components/creation/GrooveLabLayerChannels';
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
import {
  ORCHID_CHORD_TYPES,
  ORCHID_EXTENSIONS,
  ORCHID_PERF_MODES,
  type OrchidChordType,
  type OrchidExtension,
  type OrchidPerformanceMode,
} from '@/app/lib/creationStation/orchidChordEngine';
import type { OrchidProgressionId } from '@/app/lib/creationStation/grooveLabOrchidMatch';

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
  onPinToPad: () => void;
  pinDisabled?: boolean;
  chordVoice: ChordVoiceId;
  onChordVoiceChange: (id: ChordVoiceId) => void;
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
  transportPlaying = false,
  transportDisabled = true,
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
}: OrchidChordStripProps) {
  const voiceDef = CHORD_VOICE_MAP[chordVoice];
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const showLayerChannels =
    grooveBranding &&
    layerChannels != null &&
    bassChannel != null &&
    chordChannel != null &&
    melodyChannel != null &&
    onBassChannelChange != null &&
    onChordChannelChange != null &&
    onMelodyChannelChange != null;
  const showGrooveMixer =
    showLayerChannels && channelVolumes != null && setChannelVolume != null;
  const [grooveLabMixerOpen, setGrooveLabMixerOpen] = useState(false);
  const showTransport =
    onTransportRewind != null &&
    onTransportStop != null &&
    onTransportPlayPause != null &&
    onTransportFastForward != null;
  const stripRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={stripRef}
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, #071208 0%, #050805 100%)',
        padding: '6px 12px',
        height: '100%',
        minHeight: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: 0.6,
            color: '#a7f3d0',
          }}
        >
          {chordSectionLabel}
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
          {(onExportRollMidi || onExportRollWav || onExportRollWavToPad) ? (
            <GrooveLabExportStrip
              compact
              busy={exportBusy}
              status={exportStatus}
              hasChords={rollHasChords}
              hasRollNotes={rollHasNotes}
              onExportMidi={onExportRollMidi}
              onExportWav={onExportRollWav}
              onExportToPad={onExportRollWavToPad}
              padExportEnabled={padExportEnabled}
            />
          ) : null}
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
            Build chords here first · then <strong style={{ color: '#93c5fd' }}>MATCH BASS →</strong> or draw bass
            under each column
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

      <div style={{ marginBottom: 6 }}>
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
                  {v.label}
                </button>
              );
            })}
          </div>
        ))}
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

      {/* LOCKED — groove-lab-chord-strip-embed-lock.mdc: embedded corner panels; do not re-stack or move anchors */}
      {showGrooveMixer ? (
        <GrooveLabDraggableCornerPanel
          boundsRef={stripRef}
          storageKey="groove-lab-mixer-btn-pos"
          defaultRight={10}
          defaultBottom={148}
          bare
          embedded
          dragTitle="Drag to move Mixer button"
        >
          <button
            type="button"
            onClick={() => setGrooveLabMixerOpen((o) => !o)}
            title="16-channel Groove Lab mixer · CH 33–48 · SUB · CHORD · MELODY lanes"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 38,
              padding: '0 14px',
              borderRadius: 7,
              border: `1px solid ${grooveLabMixerOpen ? 'rgba(74, 222, 128, 0.65)' : 'rgba(74, 222, 128, 0.35)'}`,
              background: grooveLabMixerOpen ? 'rgba(34, 197, 94, 0.16)' : 'rgba(5, 12, 8, 0.92)',
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
        </GrooveLabDraggableCornerPanel>
      ) : null}

      {showGrooveMixer && grooveLabMixerOpen ? (
        <GrooveLabDraggableCornerPanel
          boundsRef={stripRef}
          storageKey="groove-lab-mixer-panel-pos"
          defaultRight={10}
          defaultBottom={196}
          embedded
          dragTitle="Drag to move Groove Lab mixer"
          style={{ maxWidth: 'min(98vw, 980px)', zIndex: 10 }}
        >
          <GrooveLabMixerPanel
            open
            onClose={() => setGrooveLabMixerOpen(false)}
            channelVolumes={channelVolumes}
            setChannelVolume={setChannelVolume}
            bassChannel={bassChannel}
            chordChannel={chordChannel}
            melodyChannel={melodyChannel}
          />
        </GrooveLabDraggableCornerPanel>
      ) : null}

      {showLayerChannels ? (
        <GrooveLabDraggableCornerPanel
          boundsRef={stripRef}
          storageKey="groove-lab-work-ch-panel-pos"
          defaultRight={10}
          defaultBottom={78}
          embedded
          dragTitle="Drag to move WORK CH panel"
          style={{ zIndex: 4 }}
        >
          <GrooveLabLayerChannels
            compact
            channels={layerChannels}
            bassChannel={bassChannel}
            chordChannel={chordChannel}
            melodyChannel={melodyChannel}
            onBassChannelChange={onBassChannelChange}
            onChordChannelChange={onChordChannelChange}
            onMelodyChannelChange={onMelodyChannelChange}
          />
        </GrooveLabDraggableCornerPanel>
      ) : null}

      {showTransport ? (
        <GrooveLabDraggableCornerPanel
          boundsRef={stripRef}
          storageKey="groove-lab-transport-panel-pos"
          defaultRight={10}
          defaultBottom={8}
          bare
          embedded
          dragTitle="Drag to move transport"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
              disabled={transportDisabled}
              onRewind={onTransportRewind}
              onStop={onTransportStop}
              onPlayPause={onTransportPlayPause}
              onFastForward={onTransportFastForward}
            />
          </div>
        </GrooveLabDraggableCornerPanel>
      ) : null}
    </div>
  );
}
