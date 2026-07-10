import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GROOVE_LAB_CHORD_MIX_GAIN,
  grooveLabChordStripVoiceMix,
  grooveLabWaveLeafBankOutputGain,
} from '@/app/lib/creationStation/grooveLabLayers';
import { GrooveLabBeatLabPadPicker } from '@/app/components/creation/GrooveLabBeatLabPadPicker';
import { OrchidPerformancePanel } from '@/app/components/creation/OrchidPerformancePanel';
import { GrooveLabChannelRail } from '@/app/components/creation/GrooveLabChannelRail';
import { GrooveLabPianoRoll } from '@/app/components/creation/GrooveLabPianoRoll';
import { grooveLabLayerScopeForChannel } from '@/app/lib/creationStation/grooveLabPianoRollLayers';
import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';
import {
  dispatchGrooveLabTransportMirror,
  GROOVE_LAB_LOCAL_TRANSPORT_EVENT,
  LAB808_SYNC_CHANGED_EVENT,
  LAB808_TRANSPORT_MIRROR_EVENT,
  readLab808TransportMirror,
  type GrooveLabLocalTransportDetail,
  type Lab808TransportMirrorDetail,
} from '@/app/lib/creationStation/lab808Sync';
import {
  CREATION_BEATLAB_PLAY_MIRROR_EVENT,
  type CreationBeatlabPlayMirrorDetail,
} from '@/app/lib/creationStation/creationSessionLink';
import type { GrooveGuitarPackRollBuild } from '@/app/lib/creationStation/grooveLabGuitarPackLibrary';
import {
  progressionStepsNeedRhythmExpand,
  progressionStepsToGrooveHits,
  type GrooveProgressionStep,
  type GrooveStagedProgression,
} from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { orchidVoiceAuditionLabel } from '@/app/lib/creationStation/grooveLabProgressionPreview';
import { useMasterClock } from '@/app/context/MasterClockContext';
import { useGrooveLabProgressionAudition } from '@/app/hooks/useGrooveLabProgressionAudition';
import { useMidiInputRoute } from '@/app/hooks/useMidiInputRoute';
import { MIDI_INPUT_ROUTES } from '@/app/lib/midi/midiInputBus';
import { useGrooveLabOrchid } from '@/app/hooks/useGrooveLabOrchid';
import { useGrooveLabTransport } from '@/app/hooks/useGrooveLabTransport';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { chordBassSeqChannelLabel } from '@/app/lib/creationStation/chordBassSequencerSession';
import { grooveLabSecPerSlot, previewGrooveLabRoll } from '@/app/lib/creationStation/grooveLabTransport';
import {
  applyGrooveLabChannelVolumes,
  ensureGrooveLabAudioReady,
  grooveLabAudioWhen,
  resolveGrooveLabChannelDest,
  restoreGrooveLabTransportGuitarBus,
  restoreGrooveLabTransportMelodyBus,
  resumeGrooveLabAudioContext,
  runWithGrooveLabAudio,
} from '@/app/lib/creationStation/grooveLabAudio';
import { restoreChordSequencerTransportVoices } from '@/app/lib/creationStation/chordSequencerVoices';
import {
  auditionGrooveLabGuitarLick,
  playGrooveLabGuitarNoteScheduled,
  scheduleGrooveLabGuitarTransportHit,
} from '@/app/lib/creationStation/grooveLabGuitarAudition';
import { grooveLabGuitarFxToPlayOpts, type GrooveLabGuitarFxSettings } from '@/app/lib/creationStation/grooveLabGuitarFx';
import {
  GROOVE_GUITAR_SOUND_DEFAULT,
  resolveGrooveLabGuitarSoundId,
} from '@/app/lib/creationStation/grooveLabGuitarSoundBank';
import {
  ensureGuitarLickBuffer,
  getGuitarLickDef,
  isGuitarLickSampleId,
  grooveLabGuitarBarSec,
} from '@/app/lib/creationStation/grooveLabGuitarLickBank';
import { mergeGuitarPlaybackFx } from '@/app/lib/creationStation/grooveLabGuitarFx';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';
import { GROOVE_LAB_GUITAR_MONO_GROUP } from '@/app/lib/creationStation/grooveLabLeadMono';
import {
  playGrooveLabLeadSound,
  type GrooveLabAnyLeadSoundId,
} from '@/app/lib/creationStation/grooveLabLeadSounds';
import {
  GROOVE_LAB_CHANNEL_MS_CHANGED,
  repairGrooveLabLayerMuteSolo,
} from '@/app/lib/creationStation/grooveLabChannelMuteSolo';
import {
  grooveLabChannelTransportOpen,
  grooveLabChannelVolumeGain,
  grooveLabMeterPeakFromVelocity,
  scheduleGrooveLabMeterPulseAt,
} from '@/app/lib/creationStation/grooveLabChannelMeters';
import {
  GROOVE_LAB_DEFAULT_CHANNEL_VOL,
  grooveLabChannelsNeedingVolumeRepair,
} from '@/app/lib/studio/se2MixerFaderScale';
import { grooveLabGlobalColToSlot, grooveLabSlotToGlobalCol } from '@/app/lib/creationStation/grooveLabGrid';
import { notifyLab808ChordSourcesChanged } from '@/app/lib/creationStation/lab808ChordLockSources';
import {
  isGrooveLabMidiImportError,
  isMidiFileName,
  parseGrooveLabMidiFile,
} from '@/app/lib/creationStation/grooveLabMidiImport';
import {
  GROOVE_LAB_QUANTIZE_DEFAULT,
  GROOVE_LAB_SLOTS_PER_BAR,
  clipGrooveHitsToBarCount,
  grooveLabChannelIds,
  grooveLabDefaultLayerChannels,
  grooveLabPickChordChannel,
  grooveLabPickGuitarChannel,
  grooveLabPickMelodyChannel,
  grooveLabPickSampleChannel,
  sanitizeGrooveLabGuitarChannelHits,
  grooveLabTrimGuitarHitsMonophonic,
  loadGrooveLabSession,
  normalizeGrooveBarCount,
  sanitizeGrooveLabHits,
  grooveLabChordHitsForTransport,
  sanitizeGrooveLabChordChannelHits,
  grooveLabTransportChordsMuted,
  saveGrooveLabSession,
  type GrooveLabBarCount,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';
import {
  grooveLabIsBassSubMidi,
  grooveLabIsMelodyMidi,
  grooveLabStripMelodyHits,
  grooveLabStripSubRootHits,
} from '@/app/lib/creationStation/grooveComposerEngine';
import { grooveLabIsGuitarMidi } from '@/app/lib/creationStation/grooveLabPitch';
import {
  defaultGrooveLabChannelSound,
  grooveLabAssignLayerToChannel,
  grooveLabSanitizeLayerRouting,
  readGrooveLabChannelSounds,
  resolveGrooveLabChordVoiceId,
  resolveGrooveLabLeadSoundId,
  resolveGrooveLabOrchestraHitSoundId,
  resolveGrooveLabWaveLeafPresetId,
  writeGrooveLabChannelSounds,
  type GrooveLabChannelSoundConfig,
  type GrooveLabLayerRole,
} from '@/app/lib/creationStation/grooveLabChannelConfig';
import { preloadGuitarLickBank } from '@/app/lib/creationStation/grooveLabGuitarLickBank';
import { preloadOrchestraHitBank } from '@/app/lib/creationStation/grooveLabOrchestraHitBank';
import {
  auditionGrooveLabOrchestraHit,
  scheduleGrooveLabOrchestraTransportHit,
} from '@/app/lib/creationStation/grooveLabOrchestraHitAudition';
import { buildOrchestraHitRoll, grooveLabOrchestraHitRollMidiFromRoot } from '@/app/lib/creationStation/grooveLabOrchestraHitRoll';
import type { OrchestraHitId } from '@/app/lib/creationStation/grooveLabOrchestraHitBank';
import {
  NEURAL_HUM_CREATION_IMPORT_EVENT,
  takeNeuralHumCreationImport,
  timedNotesToGrooveMelodyHits,
} from '@/app/lib/vocalLab/neuralHumCreationExport';
import { bypassWaveLeafLeadChopGate } from '@/app/lib/creationStation/waveLeafLeadChop';
import {
  waveLeafIsLeadMidi,
  waveLeafPrepareRollHits,
  waveLeafSanitizeHits,
  waveLeafSanitizeRollEdits,
  waveLeafStoreRollEdits,
  waveLeafTransposeHitsOctave,
} from '@/app/lib/creationStation/waveLeafPitch';
import {
  readWaveLeafOutputGain,
  readWaveLeafSynthSettings,
  writeWaveLeafRuntimeSettings,
} from '@/app/lib/creationStation/waveLeafRuntimeSettings';
import { WAVE_LEAF_PRESETS } from '@/app/lib/creationStation/waveLeafPresets';
import { waveLeafMelodyGenColumnCount } from '@/app/lib/creationStation/waveLeafPhraseGen';
import {
  GROOVE_LAB_ROLL_OCTAVE_OPTS,
  grooveLabCountLayerHits,
  grooveLabTransposeChordStackHitsOctave,
} from '@/app/lib/creationStation/grooveLabOctaveShift';
import {
  grooveLabClampBassRootMidi,
  grooveLabIsChordStackMidi,
  GROOVE_LAB_CHORD_ROLL_MIDI_MIN,
} from '@/app/lib/creationStation/grooveLabPitch';
import {
  downloadGrooveChordMidi,
  downloadGrooveChordWav,
  progressionStepsToChordHits,
  renderGrooveChordHitsToWav,
  type GrooveChordExportOpts,
} from '@/app/lib/creationStation/grooveLabChordExport';
import { GrooveLabHelpProvider, GrooveLabHelpTip } from '@/app/components/creation/GrooveLabHelpHub';

const KEY_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export type GrooveLabPadExportArgs = {
  padIndex: number;
  wavBytes: Uint8Array;
  label: string;
  rootBpm: number;
};

export type GrooveLabNewSynthExportArgs = {
  chordHits: GrooveRollHit[];
  bpm: number;
  label: string;
  /** When set (timeline export), import uses progression; `null` = roll hits only. */
  progressionSteps?: GrooveProgressionStep[] | null;
  quantize?: GrooveLabQuantize;
  barCount?: number;
  keyRoot: number;
  mode: ChordMode;
};
const GROOVE_CHORD_CH_KEY = 'groove-lab-chord-ch';
const GROOVE_MELODY_CH_KEY = 'groove-lab-melody-ch';
const GROOVE_GUITAR_CH_KEY = 'groove-lab-guitar-ch';
const GROOVE_SAMPLE_CH_KEY = 'groove-lab-sample-ch';
const GROOVE_EDIT_CH_KEY = 'groove-lab-edit-ch';
const GROOVE_METRONOME_KEY = 'groove-lab-metronome-on';

function readStoredChordChannel(): number {
  const { chord } = grooveLabDefaultLayerChannels();
  if (typeof window === 'undefined') return chord;
  try {
    const v = Number(window.localStorage.getItem(GROOVE_CHORD_CH_KEY));
    return grooveLabPickChordChannel(Number.isFinite(v) ? v : undefined);
  } catch {
    return chord;
  }
}

function readStoredMelodyChannel(chordChannel: number): number {
  const { melody } = grooveLabDefaultLayerChannels();
  if (typeof window === 'undefined') return melody;
  try {
    const v = Number(window.localStorage.getItem(GROOVE_MELODY_CH_KEY));
    return grooveLabPickMelodyChannel(chordChannel, Number.isFinite(v) ? v : undefined);
  } catch {
    return grooveLabPickMelodyChannel(chordChannel);
  }
}

function readStoredGuitarChannel(chordChannel: number, melodyChannel: number): number {
  const { guitar } = grooveLabDefaultLayerChannels();
  if (typeof window === 'undefined') return guitar;
  try {
    const v = Number(window.localStorage.getItem(GROOVE_GUITAR_CH_KEY));
    return grooveLabPickGuitarChannel(
      chordChannel,
      melodyChannel,
      Number.isFinite(v) ? v : undefined,
    );
  } catch {
    return grooveLabPickGuitarChannel(chordChannel, melodyChannel);
  }
}

function readStoredEditChannel(fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = Number(window.localStorage.getItem(GROOVE_EDIT_CH_KEY));
    if (!grooveLabChannelIds().includes(v)) return fallback;
    return v;
  } catch {
    return fallback;
  }
}

function readStoredSampleChannel(
  chordChannel: number,
  melodyChannel: number,
  guitarChannel: number,
): number {
  if (typeof window === 'undefined') {
    return grooveLabPickSampleChannel(chordChannel, melodyChannel, guitarChannel);
  }
  try {
    const v = Number(window.localStorage.getItem(GROOVE_SAMPLE_CH_KEY));
    return grooveLabPickSampleChannel(
      chordChannel,
      melodyChannel,
      guitarChannel,
      Number.isFinite(v) ? v : undefined,
    );
  } catch {
    return grooveLabPickSampleChannel(chordChannel, melodyChannel, guitarChannel);
  }
}

function readStoredGrooveLayerRouting() {
  const chord = readStoredChordChannel();
  const melody = readStoredMelodyChannel(chord);
  const guitar = readStoredGuitarChannel(chord, melody);
  const sample = readStoredSampleChannel(chord, melody, guitar);
  return grooveLabSanitizeLayerRouting({ chord, melody, guitar, sample });
}

function readStoredGrooveMetronome(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const v = window.localStorage.getItem(GROOVE_METRONOME_KEY);
    if (v == null) return false;
    return v !== '0';
  } catch {
    return false;
  }
}

export interface GrooveLabScreenProps {
  embedded?: boolean;
  isScreenActive?: boolean;
  bpm?: number;
  /** When set (Creation Station), Groove Lab tempo edits update the session BPM. */
  onBpmChange?: (bpm: number) => void;
  /** When false (session BPM unlinked), Groove Lab keeps its own local tempo. */
  sessionBpmLinked?: boolean;
  /** When false, Beat Lab transport does not start/stop Groove Lab (808 mirror strip still works). */
  sessionPlayLinked?: boolean;
  /** Session Link Sync on 808 Lab — Groove transport also starts/stops 808. */
  session808PlayLinked?: boolean;
  /** 808 Lab tab open — keep Groove transport engine alive for PLAY mirror from pad deck. */
  companion808Lab?: boolean;
  getAudioContext?: () => AudioContext;
  /** Creation Station: load rendered chord WAV into a Beat Lab sampler pad. */
  onExportChordWavToPad?: (args: GrooveLabPadExportArgs) => void | Promise<void>;
  /** Creation Station: green chord roll → Beat Lab NEW SYNTH piano roll (no Chord Builder). */
  onSendChordsToNewSynth?: (args: GrooveLabNewSynthExportArgs) => void;
  /** When set (embedded Creation Station), single metronome toggle — do not use a second local MET. */
  metronomeEnabled?: boolean;
  onMetronomeEnabledChange?: (enabled: boolean) => void;
  /** Shared master mixer lanes CH 33–48 (Creation Station). */
  channelVolumes?: Record<number, number>;
  setChannelVolume?: (chId: number, volume: number) => void;
}

function previewGrooveLabRollPitch(
  ctx: AudioContext,
  when: number,
  midi: number,
  lanes: {
    chordChannel: number;
    melodyChannel: number;
    guitarChannel: number;
    guitarSoundId: GrooveLabAnyLeadSoundId;
    guitarFx: GrooveLabGuitarFxSettings;
    bpm: number;
  },
  channelVolumes: Record<number, number>,
  meterChannel?: number,
): void {
  const meterCh = meterChannel ?? lanes.guitarChannel;

  if (
    grooveLabIsGuitarMidi(midi) &&
    (meterChannel == null || meterChannel === lanes.guitarChannel)
  ) {
    const soundId = resolveGrooveLabGuitarSoundId(lanes.guitarSoundId);
    const sustainSec = isGuitarLickSampleId(soundId)
      ? grooveLabGuitarBarSec(lanes.bpm, 1)
      : 0.55;
    playGrooveLabGuitarNoteScheduled(ctx, {
      midi,
      soundId,
      when,
      velocity01: 0.88,
      bpm: lanes.bpm,
      sustainSec,
      guitarFx: lanes.guitarFx,
      guitarChannel: lanes.guitarChannel,
      channelVolumes,
      route: 'channel',
    });
    return;
  }

  if (grooveLabIsBassSubMidi(midi)) return;
  if (waveLeafIsLeadMidi(midi)) return;
  if (grooveLabIsMelodyMidi(midi)) return;
  if (meterChannel != null) {
    scheduleGrooveLabMeterPulseAt(
      ctx,
      meterChannel,
      grooveLabMeterPeakFromVelocity(0.75, meterChannel, channelVolumes),
      0,
      when,
    );
  }
}

export default function GrooveLabScreen({
  embedded = false,
  isScreenActive = true,
  companion808Lab = false,
  bpm: bpmProp = 100,
  onBpmChange,
  sessionBpmLinked = true,
  sessionPlayLinked = true,
  session808PlayLinked = false,
  getAudioContext,
  onExportChordWavToPad,
  onSendChordsToNewSynth,
  metronomeEnabled: metronomeEnabledProp,
  onMetronomeEnabledChange,
  channelVolumes: channelVolumesProp,
  setChannelVolume: setChannelVolumeProp,
}: GrooveLabScreenProps) {
  const { getOrCreateAudioContext: masterGetAudioContext } = useMasterClock();
  const resolveAudioContext = useCallback((): AudioContext => {
    if (getAudioContext) return getAudioContext();
    return masterGetAudioContext();
  }, [getAudioContext, masterGetAudioContext]);

  const [localBpm, setLocalBpm] = useState(() => clampGrooveLabBpm(bpmProp));
  /** 808 Lab PLAY → Groove Lab: keep transport alive while user stays on the 808 tab. */
  const [mirror808PlayToGroove, setMirror808PlayToGroove] = useState(
    () => readLab808TransportMirror() === 'groove-lab',
  );
  useEffect(() => {
    const bump = () => setMirror808PlayToGroove(readLab808TransportMirror() === 'groove-lab');
    window.addEventListener(LAB808_SYNC_CHANGED_EVENT, bump);
    return () => window.removeEventListener(LAB808_SYNC_CHANGED_EVENT, bump);
  }, []);
  /** Hidden Session Link mount on Beat Lab — transport + chords, no Groove metronome on pads. */
  const sessionBeatLabPlayMirror = embedded && sessionPlayLinked;
  const grooveTransportActive =
    isScreenActive ||
    companion808Lab ||
    mirror808PlayToGroove ||
    sessionBeatLabPlayMirror;
  const bpm = onBpmChange ? clampGrooveLabBpm(bpmProp) : localBpm;
  const setBpm = useCallback(
    (next: number) => {
      const c = clampGrooveLabBpm(next);
      if (onBpmChange) onBpmChange(c);
      else setLocalBpm(c);
    },
    [onBpmChange],
  );
  const grooveSessionBpmLocked = embedded && sessionBpmLinked && Boolean(onBpmChange);

  useEffect(() => {
    if (!onBpmChange) setLocalBpm(clampGrooveLabBpm(bpmProp));
  }, [bpmProp, onBpmChange]);
  const channels = grooveLabChannelIds();
  const [notesByChannel, setNotesByChannel] = useState(() => loadGrooveLabSession().notesByChannel);
  const [barCount, setBarCount] = useState<GrooveLabBarCount>(() => loadGrooveLabSession().barCount);
  const [noteLengthSlots, setNoteLengthSlots] = useState(8);
  const [quantize, setQuantize] = useState<GrooveLabQuantize>(GROOVE_LAB_QUANTIZE_DEFAULT);
  const [localMetronomeEnabled, setLocalMetronomeEnabled] = useState(readStoredGrooveMetronome);
  const metronomeEnabled = metronomeEnabledProp ?? localMetronomeEnabled;
  /** Hidden Beat Lab play mirror follows transport; Beat Lab grid owns the one audible MET. */
  const grooveMetronomeAudible = metronomeEnabled && isScreenActive;
  const setMetronomeEnabled = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof next === 'function' ? next(metronomeEnabled) : next;
      if (onMetronomeEnabledChange) onMetronomeEnabledChange(resolved);
      else setLocalMetronomeEnabled(resolved);
    },
    [metronomeEnabled, onMetronomeEnabledChange],
  );
  const initialLayerRouting = readStoredGrooveLayerRouting();
  const [chordChannel, setChordChannel] = useState(initialLayerRouting.chord);
  const [melodyChannel, setMelodyChannel] = useState(initialLayerRouting.melody);
  const [guitarChannel, setGuitarChannel] = useState(initialLayerRouting.guitar);
  const [sampleChannel, setSampleChannel] = useState(initialLayerRouting.sample);
  const [channelSounds, setChannelSounds] = useState(readGrooveLabChannelSounds);
  const [selectedEditChannel, setSelectedEditChannel] = useState(() =>
    readStoredEditChannel(readStoredChordChannel()),
  );
  const [rollExpanded, setRollExpanded] = useState(false);
  const [rollPxPerCol, setRollPxPerCol] = useState(40);
  const playheadElRef = useRef<HTMLDivElement | null>(null);
  const rollScrollRef = useRef<HTMLDivElement | null>(null);
  const [midiImportStatus, setMidiImportStatus] = useState<string | null>(null);
  const midiImportStatusTimerRef = useRef<number | null>(null);
  const [progressionStaged, setProgressionStaged] = useState<GrooveStagedProgression | null>(null);
  const [progressionStatus, setProgressionStatus] = useState<string | null>(null);
  const [chordExportBusy, setChordExportBusy] = useState(false);
  const [chordExportStatus, setChordExportStatus] = useState<string | null>(null);
  const [padExportRequest, setPadExportRequest] = useState<{
    hits: GrooveRollHit[];
    label: string;
  } | null>(null);
  const [localChannelVolumes, setLocalChannelVolumes] = useState<Record<number, number>>(() => {
    const out: Record<number, number> = {};
    for (const ch of grooveLabChannelIds()) out[ch] = GROOVE_LAB_DEFAULT_CHANNEL_VOL;
    return out;
  });
  const channelVolumes = channelVolumesProp ?? localChannelVolumes;
  const setChannelVolume = useCallback(
    (chId: number, volume: number) => {
      if (setChannelVolumeProp) {
        setChannelVolumeProp(chId, volume);
        return;
      }
      setLocalChannelVolumes((prev) => ({ ...prev, [chId]: volume }));
    },
    [setChannelVolumeProp],
  );

  /** Embed mini-faders used to refresh bus gain on every lane; seed unity + apply from popup mixer only. */
  const seededGrooveVolumesRef = useRef(false);
  useEffect(() => {
    if (!grooveTransportActive && !isScreenActive) return;
    try {
      const migrationKey = 'groove-lab-audio-repair-v2';
      if (typeof window !== 'undefined' && !window.localStorage.getItem(migrationKey)) {
        repairGrooveLabLayerMuteSolo([chordChannel, melodyChannel, guitarChannel, sampleChannel]);
        window.localStorage.setItem(migrationKey, '1');
      }
    } catch {
      /* private mode */
    }
    const needingRepair = grooveLabChannelsNeedingVolumeRepair(channelVolumes, channels);
    if (Object.keys(needingRepair).length === 0) {
      seededGrooveVolumesRef.current = true;
      return;
    }
    for (const [chKey, vol] of Object.entries(needingRepair)) {
      setChannelVolume(Number(chKey), vol);
    }
    seededGrooveVolumesRef.current = true;
  }, [
    channelVolumes,
    channels,
    chordChannel,
    melodyChannel,
    guitarChannel,
    sampleChannel,
    grooveTransportActive,
    isScreenActive,
    setChannelVolume,
  ]);

  /** Live CH 33–48 faders — update strip bus gain immediately (not only on next note). */
  useEffect(() => {
    if (!grooveTransportActive && !isScreenActive) return;
    const pushBusGains = () => {
      let ctx: AudioContext | null = null;
      try {
        ctx = resolveAudioContext();
      } catch {
        return;
      }
      if (!ctx || ctx.state === 'closed') return;
      applyGrooveLabChannelVolumes(ctx, channelVolumes);
    };
    pushBusGains();
    window.addEventListener(GROOVE_LAB_CHANNEL_MS_CHANGED, pushBusGains);
    return () => window.removeEventListener(GROOVE_LAB_CHANNEL_MS_CHANGED, pushBusGains);
  }, [channelVolumes, grooveTransportActive, isScreenActive, resolveAudioContext]);

  useEffect(() => {
    setNotesByChannel((prev) => {
      let changed = false;
      const next: Record<number, GrooveRollHit[]> = { ...prev };

      for (const ch of grooveLabChannelIds()) {
        const raw = prev[ch] ?? [];
        let stripped = grooveLabStripSubRootHits(raw);
        if (ch === melodyChannel) {
          /** Groove Lead — C5–C6 only; do not run amber-lane strip on lead channel. */
          stripped = waveLeafSanitizeHits(stripped);
        } else if (ch === guitarChannel) {
          stripped = stripped.filter((h) => grooveLabIsGuitarMidi(h.midi));
        } else {
          stripped = grooveLabStripMelodyHits(stripped);
        }
        if (ch === chordChannel || ch === sampleChannel) {
          stripped = stripped.filter((h) => grooveLabIsChordStackMidi(h.midi));
        }
        if (stripped.length !== raw.length) {
          changed = true;
          next[ch] =
            ch === chordChannel || ch === sampleChannel
              ? sanitizeGrooveLabChordChannelHits(stripped, barCount)
              : ch === melodyChannel
                ? waveLeafPrepareRollHits(stripped, barCount)
                : ch === guitarChannel
                  ? sanitizeGrooveLabGuitarChannelHits(stripped, barCount)
                  : sanitizeGrooveLabHits(stripped, barCount);
        }
      }

      for (const ch of grooveLabChannelIds()) {
        const raw = next[ch] ?? prev[ch] ?? [];
        const clean =
          ch === chordChannel || ch === sampleChannel
            ? sanitizeGrooveLabChordChannelHits(raw, barCount)
            : ch === melodyChannel
              ? waveLeafPrepareRollHits(raw, barCount)
              : ch === guitarChannel
                ? sanitizeGrooveLabGuitarChannelHits(raw, barCount)
                : sanitizeGrooveLabHits(raw, barCount);
        if (clean.length !== raw.length) {
          changed = true;
          next[ch] = clean;
          continue;
        }
        for (let i = 0; i < clean.length; i++) {
          const a = clean[i]!;
          const b = raw[i];
          if (!b || a.slot !== b.slot || a.midi !== b.midi || a.sustainSlots !== b.sustainSlots) {
            changed = true;
            next[ch] = clean;
            break;
          }
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount: legacy / off-grid / off-downbeat chords
  }, []);

  useEffect(() => {
    if (!isScreenActive) return;
    saveGrooveLabSession(notesByChannel, barCount);
    notifyLab808ChordSourcesChanged();
  }, [notesByChannel, barCount, isScreenActive]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(GROOVE_CHORD_CH_KEY, String(chordChannel));
      window.localStorage.setItem(GROOVE_MELODY_CH_KEY, String(melodyChannel));
      window.localStorage.setItem(GROOVE_GUITAR_CH_KEY, String(guitarChannel));
      window.localStorage.setItem(GROOVE_SAMPLE_CH_KEY, String(sampleChannel));
      window.localStorage.setItem(GROOVE_EDIT_CH_KEY, String(selectedEditChannel));
      window.localStorage.setItem(GROOVE_METRONOME_KEY, metronomeEnabled ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [chordChannel, melodyChannel, guitarChannel, sampleChannel, selectedEditChannel, metronomeEnabled]);

  useEffect(() => {
    writeGrooveLabChannelSounds(channelSounds);
  }, [channelSounds]);

  const handleBarCountChange = useCallback((next: GrooveLabBarCount) => {
    const bars = normalizeGrooveBarCount(next);
    setBarCount(bars);
    setNotesByChannel((prev) => {
      const out: Record<number, GrooveRollHit[]> = {};
      for (const ch of grooveLabChannelIds()) {
        out[ch] = clipGrooveHitsToBarCount(prev[ch] ?? [], bars);
      }
      return out;
    });
  }, []);

  const chordHits = notesByChannel[chordChannel] ?? [];
  /** Same stack the CHORD roll draws — transport must not play tones the roll hides. */
  const chordHitsForTransport = useMemo(
    () => grooveLabChordHitsForTransport(chordHits, barCount, quantize),
    [chordHits, barCount, quantize],
  );

  const chordHitsForMelodyGen = chordHitsForTransport;

  const transportBassHits: GrooveRollHit[] = [];
  const transportChordHits = chordHitsForTransport;

  /** Piano roll + edits — keep user sustain / length (no monophonic trim on every frame). */
  const waveLeafRollHits = useMemo(
    () =>
      waveLeafSanitizeRollEdits(notesByChannel[melodyChannel] ?? [], barCount, {
        expanded: rollExpanded,
      }),
    [notesByChannel, melodyChannel, barCount, rollExpanded],
  );

  /** Transport playback — one note per slot, trim sustain between adjacent hits. */
  const waveLeafTransportHits = useMemo(
    () => waveLeafPrepareRollHits(notesByChannel[melodyChannel] ?? [], barCount),
    [notesByChannel, melodyChannel, barCount],
  );

  const guitarRollHits = useMemo(
    () => sanitizeGrooveLabGuitarChannelHits(notesByChannel[guitarChannel] ?? [], barCount),
    [notesByChannel, guitarChannel, barCount],
  );

  const guitarTransportHits = useMemo(
    () => grooveLabTrimGuitarHitsMonophonic(guitarRollHits),
    [guitarRollHits],
  );

  const sampleRollHits = useMemo(
    () => sanitizeGrooveLabChordChannelHits(notesByChannel[sampleChannel] ?? [], barCount),
    [notesByChannel, sampleChannel, barCount],
  );

  const sampleTransportHits = useMemo(
    () => grooveLabChordHitsForTransport(sampleRollHits, barCount, quantize),
    [sampleRollHits, barCount, quantize],
  );

  const setWaveLeafHits = useCallback(
    (next: GrooveRollHit[] | ((prev: GrooveRollHit[]) => GrooveRollHit[])) => {
      setNotesByChannel((prev) => {
        const raw = prev[melodyChannel] ?? [];
        const displayPrev = waveLeafSanitizeRollEdits(raw, barCount, { expanded: rollExpanded });
        const resolved = typeof next === 'function' ? next(displayPrev) : next;
        return {
          ...prev,
          [melodyChannel]: waveLeafStoreRollEdits(resolved, barCount, { expanded: rollExpanded }),
        };
      });
    },
    [melodyChannel, barCount, rollExpanded],
  );

  const WAVE_LEAF_MELODY_UNDO_MAX = 16;
  const [waveLeafMelodyUndoStack, setWaveLeafMelodyUndoStack] = useState<GrooveRollHit[][]>([]);

  const snapshotWaveLeafHits = useCallback(
    (hits: readonly GrooveRollHit[]) => hits.map((h) => ({ ...h })),
    [],
  );

  const setChordHits = useCallback(
    (next: GrooveRollHit[]) => {
      setNotesByChannel((prev) => ({
        ...prev,
        [chordChannel]: sanitizeGrooveLabChordChannelHits(next, barCount),
      }));
    },
    [chordChannel, barCount],
  );

  const setSampleHits = useCallback(
    (next: GrooveRollHit[]) => {
      setNotesByChannel((prev) => ({
        ...prev,
        [sampleChannel]: sanitizeGrooveLabChordChannelHits(next, barCount),
      }));
    },
    [sampleChannel, barCount],
  );

  const editLayerScope = useMemo(
    () =>
      grooveLabLayerScopeForChannel(
        selectedEditChannel,
        chordChannel,
        melodyChannel,
        guitarChannel,
        sampleChannel,
      ),
    [selectedEditChannel, chordChannel, melodyChannel, guitarChannel, sampleChannel],
  );

  const selectedRollHits = useMemo(() => {
    const raw = notesByChannel[selectedEditChannel] ?? [];
    if (editLayerScope === 'chord' || editLayerScope === 'sample') {
      return sanitizeGrooveLabChordChannelHits(raw, barCount);
    }
    if (editLayerScope === 'waveleaf') {
      return waveLeafSanitizeRollEdits(raw, barCount, { expanded: rollExpanded });
    }
    if (editLayerScope === 'guitar') {
      return sanitizeGrooveLabGuitarChannelHits(raw, barCount);
    }
    return sanitizeGrooveLabHits(raw, barCount);
  }, [notesByChannel, selectedEditChannel, editLayerScope, barCount, rollExpanded]);

  const setSelectedRollHits = useCallback(
    (next: GrooveRollHit[] | ((prev: GrooveRollHit[]) => GrooveRollHit[])) => {
      if (selectedEditChannel === chordChannel || selectedEditChannel === sampleChannel) {
        const ch = selectedEditChannel;
        setNotesByChannel((prev) => {
          const raw = prev[ch] ?? [];
          const resolved = typeof next === 'function' ? next(raw) : next;
          return { ...prev, [ch]: sanitizeGrooveLabChordChannelHits(resolved, barCount) };
        });
        return;
      }
      if (selectedEditChannel === melodyChannel) {
        setWaveLeafHits(next);
        return;
      }
      if (selectedEditChannel === guitarChannel) {
        setNotesByChannel((prev) => {
          const raw = prev[guitarChannel] ?? [];
          const resolved = typeof next === 'function' ? next(raw) : next;
          return {
            ...prev,
            [guitarChannel]: sanitizeGrooveLabGuitarChannelHits(resolved, barCount),
          };
        });
        return;
      }
      setNotesByChannel((prev) => {
        const raw = prev[selectedEditChannel] ?? [];
        const resolved = typeof next === 'function' ? next(raw) : next;
        return {
          ...prev,
          [selectedEditChannel]: sanitizeGrooveLabHits(resolved, barCount),
        };
      });
    },
    [selectedEditChannel, chordChannel, melodyChannel, guitarChannel, sampleChannel, barCount, setWaveLeafHits],
  );

  const editorRollHits = useMemo(() => {
    if (rollExpanded) {
      const raw = notesByChannel[selectedEditChannel] ?? [];
      if (editLayerScope === 'chord' || editLayerScope === 'sample') {
        return sanitizeGrooveLabChordChannelHits(raw, barCount);
      }
      if (editLayerScope === 'waveleaf') {
        return waveLeafSanitizeRollEdits(raw, barCount, { expanded: rollExpanded });
      }
      if (editLayerScope === 'guitar') {
        return sanitizeGrooveLabGuitarChannelHits(raw, barCount);
      }
      return sanitizeGrooveLabHits(raw, barCount);
    }
    return selectedRollHits;
  }, [
    rollExpanded,
    notesByChannel,
    selectedEditChannel,
    editLayerScope,
    barCount,
    selectedRollHits,
  ]);

  const setEditorRollHits = useCallback(
    (next: GrooveRollHit[] | ((prev: GrooveRollHit[]) => GrooveRollHit[])) => {
      if (rollExpanded) {
        if (editLayerScope === 'waveleaf') {
          setWaveLeafHits(next);
          return;
        }
        setNotesByChannel((prev) => {
          const raw = prev[selectedEditChannel] ?? [];
          const resolved = typeof next === 'function' ? next(raw) : next;
          const sanitized =
            editLayerScope === 'chord' || editLayerScope === 'sample'
              ? sanitizeGrooveLabChordChannelHits(resolved, barCount)
              : editLayerScope === 'guitar'
                ? sanitizeGrooveLabGuitarChannelHits(resolved, barCount)
                : sanitizeGrooveLabHits(resolved, barCount);
          return {
            ...prev,
            [selectedEditChannel]: sanitized,
          };
        });
        return;
      }
      setSelectedRollHits(next);
    },
    [rollExpanded, selectedEditChannel, barCount, setSelectedRollHits, editLayerScope, setWaveLeafHits],
  );

  const channelNoteCounts = useMemo(() => {
    const out: Record<number, number> = {};
    for (const ch of channels) {
      out[ch] = (notesByChannel[ch] ?? []).length;
    }
    return out;
  }, [notesByChannel, channels]);

  const rollHits = chordHits;

  const chordStackNoteCount = useMemo(
    () => grooveLabCountLayerHits(rollHits, 'chord'),
    [rollHits],
  );

  const sampleStackNoteCount = useMemo(
    () => grooveLabCountLayerHits(sampleRollHits, 'chord'),
    [sampleRollHits],
  );

  const noopHitsChange = useCallback(() => {}, []);

  const handleMelodyComposerHits = useCallback(
    (next: GrooveRollHit[], loopBars?: GrooveLabBarCount) => {
      const storeBars =
        loopBars != null ? normalizeGrooveBarCount(Math.max(barCount, loopBars)) : barCount;
      if (loopBars != null && loopBars > barCount) handleBarCountChange(storeBars);
      setNotesByChannel((prev) => ({
        ...prev,
        [melodyChannel]: waveLeafStoreRollEdits(next, storeBars, { expanded: rollExpanded }),
      }));
      setSelectedEditChannel(melodyChannel);
    },
    [barCount, handleBarCountChange, melodyChannel, rollExpanded],
  );

  const orchid = useGrooveLabOrchid({
    getAudioContext: resolveAudioContext,
    bpm,
    activeChannel: chordChannel,
    barCount,
    noteLengthSlots,
    quantize,
    hits: [],
    onHitsChange: noopHitsChange,
    splitChordChannel: true,
    chordHits,
    onChordHitsChange: setChordHits,
    melodyHits: waveLeafRollHits,
    onMelodyHitsChange: handleMelodyComposerHits,
    chordChannel,
    channelVolumes,
    onBarCountSync: handleBarCountChange,
  });

  const handleAssignLayerRole = useCallback(
    (ch: number, role: GrooveLabLayerRole) => {
      const next = grooveLabAssignLayerToChannel(ch, role, {
        chord: chordChannel,
        melody: melodyChannel,
        guitar: guitarChannel,
        sample: sampleChannel,
      });
      setChordChannel(next.chord);
      setMelodyChannel(next.melody);
      setGuitarChannel(next.guitar);
      setSampleChannel(next.sample);
      setChannelSounds((prev) => {
        const out = { ...prev };
        out[next.chord] = defaultGrooveLabChannelSound('chord');
        out[next.melody] = defaultGrooveLabChannelSound('waveleaf');
        out[next.guitar] = defaultGrooveLabChannelSound('guitar');
        out[next.sample] = defaultGrooveLabChannelSound('sample');
        if (role !== 'work') out[ch] = defaultGrooveLabChannelSound(role);
        return out;
      });
    },
    [chordChannel, melodyChannel, guitarChannel, sampleChannel],
  );

  const handleChannelSoundChange = useCallback(
    (ch: number, cfg: GrooveLabChannelSoundConfig) => {
      setChannelSounds((prev) => ({ ...prev, [ch]: cfg }));
      if (cfg.kind === 'chord' && cfg.chordVoice && ch === chordChannel) {
        orchid.setChordVoice(cfg.chordVoice);
      }
      if (cfg.kind === 'waveleaf' && cfg.waveLeafPreset && ch === melodyChannel) {
        const wl = readWaveLeafSynthSettings();
        writeWaveLeafRuntimeSettings({
          ...wl,
          preset: WAVE_LEAF_PRESETS[cfg.waveLeafPreset],
        });
      }
    },
    [chordChannel, melodyChannel, orchid],
  );

  const guitarSoundId = useMemo(
    () => resolveGrooveLabGuitarSoundId(resolveGrooveLabLeadSoundId(channelSounds, guitarChannel, GROOVE_GUITAR_SOUND_DEFAULT)),
    [channelSounds, guitarChannel],
  );

  const orchestraHitId = useMemo(
    () => resolveGrooveLabOrchestraHitSoundId(channelSounds, sampleChannel),
    [channelSounds, sampleChannel],
  );

  const guitarFxPlayOpts = useMemo(
    () => grooveLabGuitarFxToPlayOpts(orchid.guitarFx),
    [orchid.guitarFx],
  );

  const handleGuitarSoundChange = useCallback(
    (id: GrooveLabAnyLeadSoundId) => {
      handleChannelSoundChange(guitarChannel, { kind: 'lead', leadId: id });
      if (isGuitarLickSampleId(id)) {
        void auditionGrooveLabGuitarLick({
          getAudioContext: resolveAudioContext,
          lickId: id,
          targetMidi: 74,
          bpm,
          bars: 1,
          route: 'channel',
          guitarChannel,
          channelVolumes,
          guitarFx: orchid.guitarFx,
        });
        return;
      }
      void (async () => {
        const ctx = await ensureGrooveLabAudioReady(resolveAudioContext);
        if (!ctx) return;
        const when = grooveLabAudioWhen(ctx);
        const dest = resolveGrooveLabChannelDest(ctx, guitarChannel, channelVolumes);
        playGrooveLabLeadSound(ctx, 74, id, when, 0.9, bpm, 0.45, {
          pitchRegister: 'guitar',
          monophonic: true,
          monoGroup: GROOVE_LAB_GUITAR_MONO_GROUP,
          outputNode: dest,
        });
      })();
    },
    [guitarChannel, handleChannelSoundChange, resolveAudioContext, channelVolumes, bpm, orchid.guitarFx],
  );

  const handleOrchestraHitChange = useCallback(
    (id: OrchestraHitId) => {
      handleChannelSoundChange(sampleChannel, { kind: 'orchestra', orchestraHitId: id });
      void (async () => {
        const ctx = await ensureGrooveLabAudioReady(resolveAudioContext);
        if (!ctx) return;
        auditionGrooveLabOrchestraHit(
          ctx,
          id,
          sampleChannel,
          channelVolumes,
          grooveLabOrchestraHitRollMidiFromRoot(orchid.bassRootMidi),
        );
      })();
    },
    [sampleChannel, handleChannelSoundChange, resolveAudioContext, channelVolumes, orchid.bassRootMidi],
  );

  const melodyGenColumnCount = useMemo(
    () =>
      waveLeafMelodyGenColumnCount(chordHits, {
        barCount,
        keyRoot: orchid.keyRoot,
        mode: orchid.mode,
        bassRootMidi: orchid.bassRootMidi,
      }),
    [chordHits, barCount, orchid.keyRoot, orchid.mode, orchid.bassRootMidi],
  );

  const shiftLayerOctave = useCallback(
    (dir: 1 | -1) => {
      const bassRoot = orchid.bassRootMidi;
      const rollOpts = GROOVE_LAB_ROLL_OCTAVE_OPTS;
      const ch = editLayerScope === 'sample' ? sampleChannel : chordChannel;
      setNotesByChannel((prev) => {
        const raw = prev[ch] ?? [];
        return {
          ...prev,
          [ch]: sanitizeGrooveLabChordChannelHits(
            grooveLabTransposeChordStackHitsOctave(raw, dir, bassRoot, rollOpts),
            barCount,
          ),
        };
      });
    },
    [chordChannel, sampleChannel, editLayerScope, barCount, orchid.bassRootMidi],
  );

  const shiftWaveLeafOctave = useCallback(
    (dir: 1 | -1) => {
      setWaveLeafHits(waveLeafTransposeHitsOctave(waveLeafRollHits, dir));
    },
    [waveLeafRollHits, setWaveLeafHits],
  );

  const previewWaveLeafHitsNow = useCallback(
    (hits: readonly GrooveRollHit[]) => {
      if (hits.length === 0) return;
      haltWaveLeafVoices();
      const wl = readWaveLeafSynthSettings();
      const outGain = grooveLabWaveLeafBankOutputGain(readWaveLeafOutputGain());
      const sorted = [...hits].sort((a, b) => a.slot - b.slot);
      runWithGrooveLabAudio(resolveAudioContext, (ctx, when) => {
        bypassWaveLeafLeadChopGate(ctx, melodyChannel);
        const dest = resolveGrooveLabChannelDest(ctx, melodyChannel, channelVolumes);
        const spb = 60 / Math.max(40, bpm);
        let t = when;
        for (const h of sorted.slice(0, 24)) {
          playWaveLeafNote(ctx, h.midi, t, {
            preset: wl.preset,
            glideMs: wl.glideMs,
            brightness: wl.brightness,
            warmth: wl.warmth,
            drive: wl.drive,
            vibratoDepthCents: wl.vibratoDepthCents,
            bpm,
            holdBeats: Math.max(0.35, (h.sustainSlots / 4) * 0.25),
            velocity: h.vel,
            outputGain: outGain,
            destination: dest,
            melodyChannel,
            channelVolumes,
            monophonic: true,
          });
          t += spb * 0.45;
        }
      });
    },
    [resolveAudioContext, bpm, melodyChannel, channelVolumes],
  );

  const handlePreviewWaveLeafRoll = useCallback(() => {
    previewWaveLeafHitsNow(waveLeafRollHits);
  }, [waveLeafRollHits, previewWaveLeafHitsNow]);

  const handleWaveLeafMelodyGenerated = useCallback(
    (hits: GrooveRollHit[], loopBars: number) => {
      if (hits.length === 0) return;
      if (waveLeafRollHits.length > 0) {
        setWaveLeafMelodyUndoStack((stack) => [
          ...stack.slice(-(WAVE_LEAF_MELODY_UNDO_MAX - 1)),
          snapshotWaveLeafHits(waveLeafRollHits),
        ]);
      }
      const storeBars = normalizeGrooveBarCount(Math.max(barCount, loopBars));
      if (loopBars > barCount) handleBarCountChange(storeBars);
      setNotesByChannel((prev) => ({
        ...prev,
        [melodyChannel]: waveLeafStoreRollEdits(hits, storeBars, { expanded: rollExpanded }),
      }));
      setSelectedEditChannel(melodyChannel);
      previewWaveLeafHitsNow(hits);
    },
    [
      waveLeafRollHits,
      snapshotWaveLeafHits,
      melodyChannel,
      barCount,
      rollExpanded,
      handleBarCountChange,
      previewWaveLeafHitsNow,
    ],
  );

  const handleWaveLeafMelodyUndo = useCallback(() => {
    setWaveLeafMelodyUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const restored = stack[stack.length - 1]!;
      setWaveLeafHits(restored);
      setSelectedEditChannel(melodyChannel);
      previewWaveLeafHitsNow(restored);
      return stack.slice(0, -1);
    });
  }, [setWaveLeafHits, melodyChannel, previewWaveLeafHitsNow]);

  const canUndoWaveLeafMelody = waveLeafMelodyUndoStack.length > 0;

  const transportChordsMuted = useMemo(
    () =>
      !grooveLabChannelTransportOpen(chordChannel, channelVolumes) ||
      grooveLabTransportChordsMuted(orchid.orchidLinkedChordsMuted, rollHits),
    [chordChannel, channelVolumes, orchid.orchidLinkedChordsMuted, rollHits],
  );

  const transportLeadMuted = useMemo(
    () => !grooveLabChannelTransportOpen(melodyChannel, channelVolumes),
    [melodyChannel, channelVolumes],
  );

  const rollChordHitsForExport = useMemo(() => {
    return chordHits;
  }, [chordHits]);

  const chordExportOpts: GrooveChordExportOpts = useMemo(
    () => ({
      bpm,
      chordVoice: orchid.chordVoice,
      chordVolume: grooveLabChannelVolumeGain(chordChannel, channelVolumes) * GROOVE_LAB_CHORD_MIX_GAIN,
      perfMode: orchid.orchidPerfMode,
      trackName: 'Groove Lab Chords',
    }),
    [bpm, orchid.chordVoice, orchid.orchidPerfMode, chordChannel, channelVolumes],
  );

  const exportHitsToPad = useCallback(
    async (hits: GrooveRollHit[], label: string, padIndex: number) => {
      if (!onExportChordWavToPad) {
        setChordExportStatus('PAD export needs Creation Station Beat Lab');
        return;
      }
      if (padIndex < 0 || padIndex > 15) return;
      setChordExportBusy(true);
      setChordExportStatus(`Rendering WAV for pad ${padIndex + 1}…`);
      try {
        const wavBytes = await renderGrooveChordHitsToWav(hits, chordExportOpts);
        await onExportChordWavToPad({
          padIndex,
          wavBytes,
          label,
          rootBpm: bpm,
        });
        setChordExportStatus(`✓ Loaded pad ${padIndex + 1} · ${label}`);
      } catch {
        setChordExportStatus('PAD export failed');
      } finally {
        setChordExportBusy(false);
        window.setTimeout(() => setChordExportStatus(null), 4000);
      }
    },
    [onExportChordWavToPad, chordExportOpts, bpm],
  );

  const requestPadExport = useCallback((hits: GrooveRollHit[], label: string) => {
    if (!onExportChordWavToPad) {
      setChordExportStatus('PAD export needs Creation Station Beat Lab');
      return;
    }
    if (hits.length === 0) {
      setChordExportStatus('No chord notes to export');
      return;
    }
    setPadExportRequest({ hits, label });
  }, [onExportChordWavToPad]);

  const confirmPadExport = useCallback(
    (padIndex: number) => {
      const req = padExportRequest;
      if (!req) return;
      setPadExportRequest(null);
      void exportHitsToPad(req.hits, req.label, padIndex);
    },
    [padExportRequest, exportHitsToPad],
  );

  const hitsFromTimelineSteps = useCallback(
    (steps: GrooveProgressionStep[]) => {
      const built = progressionStepsToChordHits(steps, quantize, barCount, noteLengthSlots);
      if ('message' in built) {
        setChordExportStatus(built.message);
        return null;
      }
      return built;
    },
    [quantize, barCount, noteLengthSlots],
  );

  const handleExportTimelineMidi = useCallback(
    (steps: GrooveProgressionStep[]) => {
      const hits = hitsFromTimelineSteps(steps);
      if (!hits?.length) return;
      downloadGrooveChordMidi(hits, chordExportOpts, 'GrooveLab_Timeline');
      setChordExportStatus('✓ MIDI downloaded (timeline)');
    },
    [hitsFromTimelineSteps, chordExportOpts],
  );

  const handleExportTimelineWav = useCallback(
    async (steps: GrooveProgressionStep[]) => {
      const hits = hitsFromTimelineSteps(steps);
      if (!hits?.length) return;
      setChordExportBusy(true);
      setChordExportStatus('Rendering WAV…');
      try {
        await downloadGrooveChordWav(hits, chordExportOpts, 'GrooveLab_Timeline');
        setChordExportStatus('✓ WAV downloaded (timeline)');
      } catch {
        setChordExportStatus('WAV export failed');
      } finally {
        setChordExportBusy(false);
        window.setTimeout(() => setChordExportStatus(null), 4000);
      }
    },
    [hitsFromTimelineSteps, chordExportOpts],
  );

  const handleExportRollMidi = useCallback(() => {
    if (rollHits.length === 0) {
      setChordExportStatus('No notes on the piano roll');
      return;
    }
    downloadGrooveChordMidi(rollHits, chordExportOpts, 'GrooveLab_Roll');
    setChordExportStatus('✓ MIDI downloaded (piano roll)');
    window.setTimeout(() => setChordExportStatus(null), 4000);
  }, [rollHits, chordExportOpts]);

  const handleExportRollWav = useCallback(async () => {
    if (rollChordHitsForExport.length === 0) {
      setChordExportStatus('No chord notes on the roll');
      return;
    }
    setChordExportBusy(true);
    setChordExportStatus('Rendering WAV…');
    try {
      await downloadGrooveChordWav(rollChordHitsForExport, chordExportOpts, 'GrooveLab_Roll');
      setChordExportStatus('✓ WAV downloaded (piano roll)');
    } catch {
      setChordExportStatus('WAV export failed');
    } finally {
      setChordExportBusy(false);
      window.setTimeout(() => setChordExportStatus(null), 4000);
    }
  }, [rollChordHitsForExport, chordExportOpts]);

  const handleExportTimelineWavToPad = useCallback(
    (steps: GrooveProgressionStep[]) => {
      const hits = hitsFromTimelineSteps(steps);
      if (!hits?.length) return;
      requestPadExport(hits, 'GrooveLab_Timeline');
    },
    [hitsFromTimelineSteps, requestPadExport],
  );

  const handleExportRollWavToPad = useCallback(() => {
    if (!onExportChordWavToPad) {
      setChordExportStatus('PAD export needs Creation Station Beat Lab');
      return;
    }
    if (rollChordHitsForExport.length === 0) {
      setChordExportStatus('No chord notes to export');
      return;
    }
    setPadExportRequest((prev) =>
      prev?.label === 'GrooveLab_Roll' ? null : { hits: rollChordHitsForExport, label: 'GrooveLab_Roll' },
    );
  }, [onExportChordWavToPad, rollChordHitsForExport]);

  const sendChordHitsToNewSynth = useCallback(
    (hits: GrooveRollHit[], label: string, progressionSteps?: GrooveProgressionStep[] | null) => {
      if (!onSendChordsToNewSynth) {
        setChordExportStatus('TO NEW SYNTH needs Creation Station Beat Lab');
        return;
      }
      if (hits.length === 0) {
        setChordExportStatus('No chord notes to send');
        return;
      }
      onSendChordsToNewSynth({
        chordHits: hits,
        bpm,
        label,
        progressionSteps:
          progressionSteps !== undefined ? progressionSteps : progressionStaged?.steps ?? null,
        quantize,
        barCount,
        keyRoot: orchid.keyRoot,
        mode: orchid.mode,
      });
      setChordExportStatus('✓ Sent to NEW SYNTH — Beat Lab · VIEW');
      window.setTimeout(() => setChordExportStatus(null), 5000);
    },
    [onSendChordsToNewSynth, bpm, progressionStaged?.steps, quantize, barCount, orchid.keyRoot, orchid.mode],
  );

  const handleSendRollToNewSynth = useCallback(() => {
    sendChordHitsToNewSynth(rollChordHitsForExport, 'Groove Lab roll', null);
  }, [rollChordHitsForExport, sendChordHitsToNewSynth]);

  const handleSendTimelineToNewSynth = useCallback(
    (steps: GrooveProgressionStep[]) => {
      const hits = hitsFromTimelineSteps(steps);
      if (!hits?.length) return;
      sendChordHitsToNewSynth(hits, 'Groove Lab progression', steps);
    },
    [hitsFromTimelineSteps, sendChordHitsToNewSynth],
  );

  const suppress808OutboundMirrorRef = useRef(false);
  const suppressBeatLabOutboundMirrorRef = useRef(false);
  /** Blocks inbound mirror play from restarting Groove right after user Stop. */
  const grooveUserStopRef = useRef(false);

  const grooveTransport = useGrooveLabTransport({
    getAudioContext: resolveAudioContext,
    skip808OutboundMirrorRef: suppress808OutboundMirrorRef,
    skipBeatLabOutboundMirrorRef: suppressBeatLabOutboundMirrorRef,
    isScreenActive: grooveTransportActive,
    bpm,
    barCount,
    quantize,
    pxPerCol: rollPxPerCol,
    bassHits: transportBassHits,
    chordHits: transportChordHits,
    melodyHits: waveLeafTransportHits,
    guitarHits: guitarTransportHits,
    sampleHits: sampleTransportHits,
    bassSoundId: orchid.bassSoundId,
    melodySoundId: orchid.melodySoundId,
    chordVoice: resolveGrooveLabChordVoiceId(channelSounds, chordChannel, orchid.chordVoice),
    chordVolume: grooveLabChordStripVoiceMix(),
    chordsMuted: transportChordsMuted,
    bassMuted: true,
    leadMuted: transportLeadMuted,
    perfMode: orchid.orchidPerfMode,
    metronomeEnabled: grooveMetronomeAudible,
    chordChannel,
    melodyChannel,
    guitarChannel,
    sampleChannel,
    orchestraHitId,
    guitarSoundId: guitarSoundId,
    guitarFx: guitarFxPlayOpts,
    guitarFxSettings: orchid.guitarFx,
    channelVolumes,
    playheadElRef,
    rollScrollRef,
  });

  /** Beat Lab PLAY link → Groove Lab transport (Session Link Sync — visible or hidden mount). */
  useEffect(() => {
    if (!sessionPlayLinked) return;
    const onBeatLabMirror = (ev: Event) => {
      const detail = (ev as CustomEvent<CreationBeatlabPlayMirrorDetail>).detail;
      if (!detail || detail.target !== 'groove-lab') return;
      try {
        try {
          resumeGrooveLabAudioContext(resolveAudioContext());
        } catch {
          /* ignore */
        }
        if (detail.action === 'play') {
          if (grooveUserStopRef.current || grooveTransport.playing) return;
          suppressBeatLabOutboundMirrorRef.current = true;
          grooveTransport.togglePlayPause();
        } else if (detail.action === 'pause') {
          if (!grooveTransport.playing) return;
          suppressBeatLabOutboundMirrorRef.current = true;
          grooveTransport.pause();
        } else if (detail.action === 'stop') {
          suppressBeatLabOutboundMirrorRef.current = true;
          grooveTransport.stop();
        }
      } finally {
        /* suppress cleared in useGrooveLabTransport when echo skip is consumed */
      }
    };
    window.addEventListener(CREATION_BEATLAB_PLAY_MIRROR_EVENT, onBeatLabMirror);
    return () => window.removeEventListener(CREATION_BEATLAB_PLAY_MIRROR_EVENT, onBeatLabMirror);
  }, [sessionPlayLinked, grooveTransport, resolveAudioContext]);

  /** 808 Lab PLAY → Groove Lab mirror (808 pad-deck sync strip). */
  useEffect(() => {
    const on808Mirror = (ev: Event) => {
      const detail = (ev as CustomEvent<Lab808TransportMirrorDetail>).detail;
      if (!detail || detail.target !== 'groove-lab') return;
      try {
        try {
          resumeGrooveLabAudioContext(resolveAudioContext());
        } catch {
          /* ignore */
        }
        if (detail.action === 'play') {
          if (grooveUserStopRef.current || grooveTransport.playing) return;
          suppress808OutboundMirrorRef.current = true;
          grooveTransport.togglePlayPause();
        } else if (detail.action === 'pause') {
          if (!grooveTransport.playing) return;
          suppress808OutboundMirrorRef.current = true;
          grooveTransport.pause();
        } else if (detail.action === 'stop') {
          suppress808OutboundMirrorRef.current = true;
          grooveTransport.stop();
        }
      } finally {
        /* suppress cleared in useGrooveLabTransport when echo skip is consumed */
      }
    };
    window.addEventListener(LAB808_TRANSPORT_MIRROR_EVENT, on808Mirror);
    return () => window.removeEventListener(LAB808_TRANSPORT_MIRROR_EVENT, on808Mirror);
  }, [grooveTransport, resolveAudioContext]);

  const mirror808PlayToGrooveRef = useRef(mirror808PlayToGroove);
  mirror808PlayToGrooveRef.current = mirror808PlayToGroove;
  const session808PlayLinkedRef = useRef(session808PlayLinked);
  session808PlayLinkedRef.current = session808PlayLinked;

  const mirrorGrooveTransportTo808 = useCallback(
    (action: 'play' | 'pause' | 'stop') => {
      if (suppress808OutboundMirrorRef.current) return;
      if (!session808PlayLinkedRef.current && !mirror808PlayToGrooveRef.current) return;
      dispatchGrooveLabTransportMirror(action);
    },
    [],
  );

  const activeGlobalCol = useMemo(() => {
    if (grooveTransport.playing) return undefined;
    return grooveLabSlotToGlobalCol(grooveTransport.playheadSlot, quantize);
  }, [grooveTransport.playing, grooveTransport.playheadSlot, quantize]);

  const handleSeekCol = useCallback(
    (globalCol: number) => {
      const slot = grooveLabGlobalColToSlot(globalCol, quantize);
      grooveTransport.seekToSlot(slot);
      orchid.setEditSlot(slot);
    },
    [grooveTransport, quantize, orchid.setEditSlot],
  );


  /** Warm master bus + unlock AudioContext while Groove is visible or Beat Lab Sync keeps it mounted. */
  useEffect(() => {
    if (!grooveTransportActive) return;
    try {
      const ctx = resolveAudioContext();
      void preloadGuitarLickBank(ctx);
      void preloadOrchestraHitBank(ctx);
    } catch {
      /* ignore */
    }
    const prime = () => {
      try {
        const ctx = resolveAudioContext();
        resumeGrooveLabAudioContext(ctx);
        void preloadGuitarLickBank(ctx);
        void preloadOrchestraHitBank(ctx);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('pointerdown', prime, { capture: true });
    return () => window.removeEventListener('pointerdown', prime, { capture: true });
  }, [grooveTransportActive, resolveAudioContext]);

  const handlePreview = useCallback(() => {
    if (grooveTransport.playing) grooveTransport.pause();
    if (editLayerScope === 'waveleaf') {
      handlePreviewWaveLeafRoll();
      return;
    }
    runWithGrooveLabAudio(resolveAudioContext, (ctx, when) => {
      const previewOpts = {
        bpm,
        bassSoundId: orchid.bassSoundId,
        melodySoundId: orchid.melodySoundId,
        chordVoice: orchid.chordVoice,
        chordVolume: grooveLabChordStripVoiceMix(),
        chordsMuted: transportChordsMuted,
        bassMuted: true,
        perfMode: orchid.orchidPerfMode,
        startDelaySec: when - ctx.currentTime,
        chordChannel,
        melodyChannel,
        guitarChannel,
        guitarSoundId,
        guitarFx: guitarFxPlayOpts,
        guitarFxSettings: orchid.guitarFx,
        channelVolumes,
      };
      if (editLayerScope === 'guitar') {
        for (const hit of guitarTransportHits) {
          scheduleGrooveLabGuitarTransportHit(ctx, {
            midi: hit.midi,
            soundId: guitarSoundId,
            when: when + hit.slot * grooveLabSecPerSlot(bpm),
            velocity01: hit.vel,
            bpm,
            sustainSec: grooveLabGuitarBarSec(bpm, 1),
            guitarFx: guitarFxPlayOpts,
            guitarChannel,
            channelVolumes,
          });
        }
        return;
      }
      previewGrooveLabRoll(
        ctx,
        transportBassHits,
        transportChordHits,
        waveLeafTransportHits,
        guitarTransportHits,
        {
          ...previewOpts,
          leadMuted: transportLeadMuted,
        },
      );
    });
  }, [
    resolveAudioContext,
    transportBassHits,
    transportChordHits,
    waveLeafTransportHits,
    guitarTransportHits,
    transportLeadMuted,
    editLayerScope,
    handlePreviewWaveLeafRoll,
    grooveTransport,
    bpm,
    orchid.bassSoundId,
    orchid.melodySoundId,
    orchid.chordVoice,
    transportChordsMuted,
    orchid.orchidPerfMode,
    chordChannel,
    melodyChannel,
    guitarChannel,
    guitarSoundId,
    guitarFxPlayOpts,
    orchid.guitarFx,
    channelVolumes,
  ]);

  const previewGrooveChordOnly = useCallback(() => {
    haltWaveLeafVoices();
    orchid.previewOrchidChord();
  }, [orchid.previewOrchidChord]);

  const primeGuitarRollAudio = useCallback(() => {
    void (async () => {
      try {
        const ctx = await ensureGrooveLabAudioReady(resolveAudioContext);
        if (ctx) {
          void preloadGuitarLickBank(ctx);
          void preloadOrchestraHitBank(ctx);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [resolveAudioContext]);

  const previewGuitarNote = useCallback(
    (midi: number, velocity01 = 0.88) => {
      if (!grooveLabIsGuitarMidi(midi)) return;
      const soundId = guitarSoundId;
      const sustainSec = grooveLabGuitarBarSec(bpm, 1);
      runWithGrooveLabAudio(resolveAudioContext, (ctx, when) => {
        playGrooveLabGuitarNoteScheduled(ctx, {
          midi,
          soundId,
          when,
          velocity01,
          bpm,
          sustainSec,
          guitarFx: orchid.guitarFx,
          guitarChannel,
          channelVolumes,
          route: 'channel',
        });
      });
      const def = getGuitarLickDef(soundId);
      if (def) {
        try {
          void ensureGuitarLickBuffer(resolveAudioContext(), def);
        } catch {
          /* */
        }
      }
    },
    [
      resolveAudioContext,
      guitarSoundId,
      bpm,
      orchid.guitarFx,
      guitarChannel,
      channelVolumes,
    ],
  );

  const handlePreviewPitch = useCallback(
    (midi: number, meterChannel?: number) => {
      const meterCh = meterChannel ?? selectedEditChannel;

      if (editLayerScope === 'sample' || selectedEditChannel === sampleChannel) {
        if (!grooveLabIsChordStackMidi(midi)) return;
        runWithGrooveLabAudio(resolveAudioContext, (ctx, when) => {
          scheduleGrooveLabOrchestraTransportHit(ctx, {
            hitId: orchestraHitId,
            when,
            velocity01: 0.9,
            orchestraChannel: sampleChannel,
            channelVolumes,
            targetMidi: midi,
          });
        });
        return;
      }

      if (editLayerScope === 'guitar' || selectedEditChannel === guitarChannel) {
        previewGuitarNote(midi);
        return;
      }

      if (editLayerScope === 'waveleaf' || selectedEditChannel === melodyChannel) {
        if (!waveLeafIsLeadMidi(midi)) return;
        const wl = readWaveLeafSynthSettings();
        runWithGrooveLabAudio(resolveAudioContext, (ctx, when) => {
          bypassWaveLeafLeadChopGate(ctx, melodyChannel);
          const dest = resolveGrooveLabChannelDest(ctx, melodyChannel, channelVolumes);
          playWaveLeafNote(ctx, midi, when, {
            preset: wl.preset,
            glideMs: wl.glideMs,
            brightness: wl.brightness,
            warmth: wl.warmth,
            drive: wl.drive,
            vibratoDepthCents: wl.vibratoDepthCents,
            bpm,
            outputGain: grooveLabWaveLeafBankOutputGain(readWaveLeafOutputGain()),
            destination: dest,
            melodyChannel,
            channelVolumes,
            monophonic: true,
          });
        });
        scheduleGrooveLabMeterPulseAt(
          resolveAudioContext(),
          meterCh,
          grooveLabMeterPeakFromVelocity(0.85, meterCh, channelVolumes),
          0,
          resolveAudioContext().currentTime,
        );
        return;
      }

      if (editLayerScope === 'chord' || selectedEditChannel === chordChannel) {
        if (!grooveLabIsChordStackMidi(midi)) return;
        haltWaveLeafVoices();
        if (
          !orchid.orchidLinkedChordsMuted &&
          grooveLabChannelVolumeGain(chordChannel, channelVolumes) > 0.02
        ) {
          orchid.previewOrchidChord(orchid.orchidRootMidi);
        }
        return;
      }

      runWithGrooveLabAudio(resolveAudioContext, (ctx, when) => {
        previewGrooveLabRollPitch(
          ctx,
          when,
          midi,
          {
            chordChannel,
            melodyChannel,
            guitarChannel,
            guitarSoundId,
            guitarFx: orchid.guitarFx,
            bpm,
          },
          channelVolumes,
          meterCh,
        );
      });
    },
    [
      resolveAudioContext,
      editLayerScope,
      selectedEditChannel,
      sampleChannel,
      orchestraHitId,
      melodyChannel,
      guitarChannel,
      guitarSoundId,
      previewGuitarNote,
      orchid.guitarFx,
      orchid.orchidRootMidi,
      orchid.previewOrchidChord,
      orchid.orchidLinkedChordsMuted,
      chordChannel,
      channelVolumes,
      bpm,
    ],
  );

  useMidiInputRoute(MIDI_INPUT_ROUTES.grooveLab, {
    enabled: isScreenActive !== false,
    onNoteOn: (e) => {
      if (e.channel === 9) return;
      handlePreviewPitch(e.note);
    },
  });

  const handleSelectEditChannel = useCallback((ch: number) => {
    setSelectedEditChannel(ch);
  }, []);

  const flashMidiImport = useCallback((msg: string) => {
    if (midiImportStatusTimerRef.current != null) {
      window.clearTimeout(midiImportStatusTimerRef.current);
    }
    setMidiImportStatus(msg);
    midiImportStatusTimerRef.current = window.setTimeout(() => {
      setMidiImportStatus(null);
      midiImportStatusTimerRef.current = null;
    }, 5000);
  }, []);

  useEffect(
    () => () => {
      if (midiImportStatusTimerRef.current != null) {
        window.clearTimeout(midiImportStatusTimerRef.current);
      }
    },
    [],
  );

  const applyProgressionStaged = useCallback(
    (staged: GrooveStagedProgression) => {
      const chordCh = grooveLabPickChordChannel(chordChannel);
      setChordChannel(chordCh);
      setBarCount(staged.barCount);
      setNotesByChannel((prev) => {
        const next: Record<number, GrooveRollHit[]> = {};
        const preserveRhythm =
          progressionStepsNeedRhythmExpand(staged.steps) ||
          staged.steps.some((s) => (s.barBeats?.length ?? 0) > 0 && s.beats <= 1.001);
        for (const ch of channels) {
          const clipped = clipGrooveHitsToBarCount(prev[ch] ?? [], staged.barCount);
          const stripped = grooveLabStripMelodyHits(grooveLabStripSubRootHits(clipped));
          next[ch] =
            ch === chordCh
              ? sanitizeGrooveLabChordChannelHits(staged.chordHits, staged.barCount, {
                  preserveRhythmSlots: preserveRhythm,
                })
              : sanitizeGrooveLabHits(stripped, staged.barCount);
        }
        return next;
      });
      grooveTransport.rewind();
      orchid.setEditSlot(0);
      setSelectedEditChannel(chordCh);
      const scrollEl = rollScrollRef.current;
      if (scrollEl) scrollEl.scrollLeft = 0;
    },
    [chordChannel, channels, grooveTransport, orchid.setEditSlot],
  );

  const buildProgression = useCallback(
    (steps: GrooveProgressionStep[]) => {
      const built = progressionStepsToGrooveHits(steps, {
        quantize,
        barCount,
        sustainSlots: noteLengthSlots,
      });
      if ('message' in built) {
        setProgressionStaged(null);
        setProgressionStatus(built.message);
        return;
      }
      setProgressionStaged(built);
      setProgressionStatus(null);
    },
    [quantize, barCount, noteLengthSlots],
  );

  const progressionAudition = useGrooveLabProgressionAudition({
    getAudioContext: resolveAudioContext,
    bpm,
    chordVoice: orchid.chordVoice,
    perfMode: orchid.orchidPerfMode,
    linkedChordVolume: grooveLabChannelVolumeGain(chordChannel, channelVolumes),
  });

  const stopAllGrooveLabPlayback = useCallback(() => {
    grooveUserStopRef.current = true;
    progressionAudition.stopPlayback();
    haltWaveLeafVoices();
    grooveTransport.stop();
    mirrorGrooveTransportTo808('stop');
  }, [progressionAudition, grooveTransport, mirrorGrooveTransportTo808]);

  const dropProgressionFromSteps = useCallback(
    (steps: GrooveProgressionStep[]) => {
      const built = progressionStepsToGrooveHits(steps, {
        quantize,
        barCount,
        sustainSlots: noteLengthSlots,
      });
      if ('message' in built) {
        setProgressionStaged(null);
        setProgressionStatus(built.message);
        flashMidiImport(built.message);
        return;
      }
      if (built.chordHits.length === 0) {
        setProgressionStaged(null);
        const msg = 'No chord notes for the roll — check chord labels (C, Am, G7…).';
        setProgressionStatus(msg);
        flashMidiImport(msg);
        return;
      }
      progressionAudition.stopPlayback();
      setProgressionStaged(built);
      applyProgressionStaged(built);
      const okMsg = `✓ ${built.chordHits.length} chord notes · ${built.barCount} bars on CHORD roll — press ▶ to hear`;
      setProgressionStatus(okMsg);
      flashMidiImport(okMsg);
    },
    [
      quantize,
      barCount,
      noteLengthSlots,
      progressionAudition,
      applyProgressionStaged,
      flashMidiImport,
    ],
  );

  const handleTransportPlayPause = useCallback(() => {
    grooveUserStopRef.current = false;
    try {
      resumeGrooveLabAudioContext(resolveAudioContext());
    } catch {
      /* ignore */
    }
    if (!grooveTransport.playing) {
      progressionAudition.stopPlayback();
      restoreChordSequencerTransportVoices();
      restoreGrooveLabTransportGuitarBus();
      restoreGrooveLabTransportMelodyBus();
      try {
        const ctx = resolveAudioContext();
        if (ctx && ctx.state !== 'closed') {
          applyGrooveLabChannelVolumes(ctx, channelVolumes);
        }
      } catch {
        /* ctx not unlocked yet */
      }
    }
    grooveTransport.togglePlayPause();
  }, [grooveTransport, progressionAudition, resolveAudioContext, channelVolumes]);

  /** Creation Station keyboard shortcuts while Groove transport is mounted. */
  useEffect(() => {
    if (!grooveTransportActive) return;
    const onLocalTransport = (ev: Event) => {
      const detail = (ev as CustomEvent<GrooveLabLocalTransportDetail>).detail;
      if (!detail) return;
      if (detail.action === 'play') {
        if (!grooveTransport.playing) handleTransportPlayPause();
      } else if (detail.action === 'pause') {
        if (grooveTransport.playing) grooveTransport.pause();
      } else if (detail.action === 'stop') {
        stopAllGrooveLabPlayback();
      }
    };
    window.addEventListener(GROOVE_LAB_LOCAL_TRANSPORT_EVENT, onLocalTransport);
    return () => window.removeEventListener(GROOVE_LAB_LOCAL_TRANSPORT_EVENT, onLocalTransport);
  }, [
    grooveTransportActive,
    grooveTransport,
    handleTransportPlayPause,
    stopAllGrooveLabPlayback,
  ]);

  const stopAllRef = useRef(stopAllGrooveLabPlayback);
  stopAllRef.current = stopAllGrooveLabPlayback;
  useEffect(() => {
    if (!grooveTransportActive) {
      stopAllRef.current();
      return;
    }
    void ensureGrooveLabAudioReady(resolveAudioContext);
  }, [grooveTransportActive, resolveAudioContext]);

  const dropProgressionChordsOnly = useCallback(
    (steps: GrooveProgressionStep[]) => {
      dropProgressionFromSteps(steps);
    },
    [dropProgressionFromSteps],
  );

  const dropGuitarPack = useCallback(
    (built: GrooveGuitarPackRollBuild) => {
      if (built.guitarHits.length === 0) {
        const msg = 'No guitar licks to drop.';
        setProgressionStatus(msg);
        flashMidiImport(msg);
        return;
      }
      progressionAudition.stopPlayback();
      handleChannelSoundChange(guitarChannel, { kind: 'lead', leadId: built.lickId });
      setBarCount(built.barCount);
      setNotesByChannel((prev) => {
        const next: Record<number, GrooveRollHit[]> = {};
        for (const ch of channels) {
          const clipped = clipGrooveHitsToBarCount(prev[ch] ?? [], built.barCount);
          if (ch === guitarChannel) {
            next[ch] = sanitizeGrooveLabGuitarChannelHits(built.guitarHits, built.barCount);
          } else {
            const stripped = grooveLabStripMelodyHits(grooveLabStripSubRootHits(clipped));
            next[ch] = sanitizeGrooveLabHits(stripped, built.barCount);
          }
        }
        return next;
      });
      orchid.setEditSlot(0);
      setSelectedEditChannel(guitarChannel);
      const droppedLickId = resolveGrooveLabGuitarSoundId(built.lickId);
      const droppedHits = built.guitarHits;
      queueMicrotask(() => {
        try {
          resumeGrooveLabAudioContext(resolveAudioContext());
        } catch {
          /* */
        }
        runWithGrooveLabAudio(resolveAudioContext, (ctx, when) => {
          previewGrooveLabRoll(ctx, [], [], [], [], {
            bpm,
            bassSoundId: orchid.bassSoundId,
            melodySoundId: orchid.melodySoundId,
            chordVoice: orchid.chordVoice,
            chordVolume: grooveLabChordStripVoiceMix(),
            chordsMuted: true,
            bassMuted: true,
            perfMode: orchid.orchidPerfMode,
            startDelaySec: when - ctx.currentTime,
            chordChannel,
            melodyChannel,
            guitarChannel,
            guitarSoundId: droppedLickId,
            guitarFx: grooveLabGuitarFxToPlayOpts(orchid.guitarFx),
            guitarFxSettings: orchid.guitarFx,
            channelVolumes,
          }, droppedHits);
        });
        const def = getGuitarLickDef(droppedLickId);
        if (def) void ensureGuitarLickBuffer(resolveAudioContext(), def);
      });
      grooveTransport.rewind();
      const scrollEl = rollScrollRef.current;
      if (scrollEl) scrollEl.scrollLeft = 0;
      const okMsg = `✓ ${built.guitarHits.length} wah/bar triggers on CH ${guitarChannel} · ${built.barCount} bars`;
      setProgressionStatus(okMsg);
      flashMidiImport(okMsg);
    },
    [
      progressionAudition,
      channels,
      guitarChannel,
      chordChannel,
      melodyChannel,
      handleChannelSoundChange,
      grooveTransport,
      orchid.setEditSlot,
      orchid.guitarFx,
      orchid.bassSoundId,
      orchid.melodySoundId,
      orchid.chordVoice,
      orchid.orchidPerfMode,
      resolveAudioContext,
      bpm,
      channelVolumes,
      flashMidiImport,
    ],
  );

  const dropOrchestraHit = useCallback(() => {
    const built = buildOrchestraHitRoll(orchestraHitId, {
      keyRoot: orchid.keyRoot,
      mode: orchid.mode,
      quantize,
      barCount,
      sustainSlots: noteLengthSlots,
      chordHits: chordHitsForTransport,
      referenceMidi: orchid.bassRootMidi,
    });
    if ('message' in built) {
      setProgressionStatus(built.message);
      flashMidiImport(built.message);
      return;
    }
    progressionAudition.stopPlayback();
    handleChannelSoundChange(sampleChannel, {
      kind: 'orchestra',
      orchestraHitId: built.hitId,
    });
    setSampleHits(sanitizeGrooveLabChordChannelHits(built.orchestraHits, built.barCount));
    orchid.setEditSlot(0);
    setSelectedEditChannel(sampleChannel);
    grooveTransport.rewind();
    const scrollEl = rollScrollRef.current;
    if (scrollEl) scrollEl.scrollLeft = 0;
    const okMsg = `✓ ${built.orchestraHits.length} orch hits on CH ${sampleChannel} · locked to chord roots`;
    setProgressionStatus(okMsg);
    flashMidiImport(okMsg);
  }, [
    orchestraHitId,
    orchid.keyRoot,
    orchid.mode,
    orchid.bassRootMidi,
    orchid.setEditSlot,
    quantize,
    barCount,
    noteLengthSlots,
    chordHitsForTransport,
    progressionAudition,
    handleChannelSoundChange,
    sampleChannel,
    setSampleHits,
    grooveTransport,
    flashMidiImport,
  ]);

  const handleMidiImport = useCallback(
    async (file: File) => {
      if (!isMidiFileName(file.name)) {
        flashMidiImport('Use a .mid or .midi file.');
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        const parsed = parseGrooveLabMidiFile(buf, file.name, { quantize, barCount });
        if (isGrooveLabMidiImportError(parsed)) {
          flashMidiImport(parsed.message);
          return;
        }
        const chordCh = grooveLabPickChordChannel(chordChannel);
        setChordChannel(chordCh);
        setSelectedEditChannel(chordCh);
        setBpm(parsed.bpm);
        setBarCount(parsed.barCount);
        setNotesByChannel((prev) => {
          const next: Record<number, GrooveRollHit[]> = {};
          for (const ch of channels) {
            next[ch] = sanitizeGrooveLabHits(
              grooveLabStripMelodyHits(
                grooveLabStripSubRootHits(clipGrooveHitsToBarCount(prev[ch] ?? [], parsed.barCount)),
              ),
              parsed.barCount,
            );
          }
          next[chordCh] = sanitizeGrooveLabChordChannelHits(parsed.chordHits, parsed.barCount);
          return next;
        });
        grooveTransport.rewind();
        orchid.setEditSlot(0);
        flashMidiImport(
          `✓ ${file.name} · ${parsed.bpm} BPM · ${parsed.chordHits.length} chord`,
        );
      } catch (err) {
        flashMidiImport(err instanceof Error ? err.message : 'Import failed.');
      }
    },
    [
      quantize,
      barCount,
      chordChannel,
      melodyChannel,
      channels,
      setBpm,
      flashMidiImport,
      grooveTransport,
      orchid.setEditSlot,
    ],
  );

  useEffect(() => {
    const applyNeuralHumMelody = () => {
      const payload = takeNeuralHumCreationImport('groove-lab');
      if (!payload || payload.notes.length === 0) return;
      const { hits, barCount: bars, bpm: importBpm } = timedNotesToGrooveMelodyHits(
        payload.notes,
        payload.bpm,
        {
          quantize: payload.quantize ?? quantize,
          barCount,
          transposeSemis: payload.transposeSemis ?? 0,
        },
      );
      if (hits.length === 0) {
        flashMidiImport('No melody notes could be placed on the Groove roll.');
        return;
      }
      const melCh = grooveLabPickMelodyChannel(melodyChannel);
      setMelodyChannel(melCh);
      setSelectedEditChannel(melCh);
      setBpm(importBpm);
      setBarCount(bars);
      const prepared = waveLeafPrepareRollHits(hits, bars);
      setNotesByChannel((prev) => {
        const next: Record<number, GrooveRollHit[]> = {};
        for (const ch of channels) {
          next[ch] = sanitizeGrooveLabHits(
            grooveLabStripMelodyHits(
              grooveLabStripSubRootHits(clipGrooveHitsToBarCount(prev[ch] ?? [], bars)),
            ),
            bars,
          );
        }
        next[melCh] = waveLeafStoreRollEdits(prepared, bars, { expanded: rollExpanded });
        return next;
      });
      grooveTransport.rewind();
      orchid.setEditSlot(0);
      flashMidiImport(
        `✓ Neural Hum → melody · ${hits.length} notes · ${importBpm} BPM`,
      );
    };
    window.addEventListener(NEURAL_HUM_CREATION_IMPORT_EVENT, applyNeuralHumMelody);
    applyNeuralHumMelody();
    return () => window.removeEventListener(NEURAL_HUM_CREATION_IMPORT_EVENT, applyNeuralHumMelody);
  }, [
    barCount,
    channels,
    flashMidiImport,
    grooveTransport,
    melodyChannel,
    orchid.setEditSlot,
    quantize,
    rollExpanded,
  ]);

  return (
    <GrooveLabHelpProvider autoIntro>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: '#030303',
        color: '#cfcfcf',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '3px 10px',
          borderBottom: '1px solid #151515',
          background: '#090909',
          flexWrap: 'wrap',
          minWidth: 0,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', color: '#f0f0f0' }}>
          GROOVE <span style={{ color: '#7cf4c6' }}>LAB</span>
          <GrooveLabHelpTip tab="overview" title="Groove Lab quick start" />
        </span>
        <span style={{ fontSize: 9, color: '#86efac', fontWeight: 800 }}>
          CHORD {chordBassSeqChannelLabel(chordChannel)}
        </span>
        <span style={{ fontSize: 9, color: '#c4b5fd', fontWeight: 800 }}>
          · LEAD {chordBassSeqChannelLabel(melodyChannel)}
        </span>
      </div>

      <div
        style={{
          flexShrink: rollExpanded ? 1 : 0,
          flex: rollExpanded ? '0 1 auto' : undefined,
          minHeight: rollExpanded ? 140 : undefined,
          maxHeight: rollExpanded ? '40vh' : undefined,
          overflow: rollExpanded ? 'auto' : undefined,
          borderBottom: '2px solid #22c55e44',
          background: 'linear-gradient(180deg, #060a08 0%, #050608 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 10px',
            borderBottom: '1px solid #1a2e22',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 900, color: '#a7f3d0', letterSpacing: 0.4 }}>
            GROOVE <span style={{ color: '#22c55e' }}>STUDIO</span>
            <GrooveLabHelpTip tab="chords" title="Groove Studio & chord strip" />
          </span>
          <span style={{ fontSize: 8, color: '#4b5563', fontWeight: 700 }}>KEY</span>
          {KEY_LABELS.map((k, i) => (
            <button
              key={k}
              type="button"
              onClick={() => orchid.setKeyRoot(i)}
              style={{
                background: orchid.keyRoot === i ? '#112015' : '#111',
                color: orchid.keyRoot === i ? '#22c55e' : '#7a7a7a',
                border: `1px solid ${orchid.keyRoot === i ? '#1f3a29' : '#1a1a1a'}`,
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 9,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {k}
            </button>
          ))}
          {(['major', 'minor'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => orchid.setMode(m)}
              style={{
                background: orchid.mode === m ? '#112015' : '#111',
                color: orchid.mode === m ? '#22c55e' : '#7a7a7a',
                border: `1px solid ${orchid.mode === m ? '#1f3a29' : '#1a1a1a'}`,
                borderRadius: 4,
                padding: '2px 7px',
                fontSize: 9,
                fontWeight: 800,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {m}
            </button>
          ))}
        </div>
        <OrchidPerformancePanel
          grooveBranding
          chordLabel={orchid.orchidLabel}
          matchLabel={orchid.orchidBassMatchLabel}
          orchidType={orchid.orchidType}
          onTypeChange={orchid.setOrchidTypeWithPreview}
          extensions={orchid.orchidExtensions}
          onToggleExtension={orchid.toggleOrchidExtension}
          inversion={orchid.orchidInversion}
          maxInversion={orchid.orchidMaxInversion}
          onInversionChange={orchid.setOrchidInversion}
          perfMode={orchid.orchidPerfMode}
          onPerfModeChange={orchid.setOrchidPerfMode}
          diatonicRoots={orchid.diatonicRoots}
          selectedRootMidi={orchid.orchidRootMidi}
          onRootChange={orchid.setOrchidRootWithPreview}
          smartMatch={orchid.orchidSmartMatch}
          onSmartMatchChange={orchid.setOrchidSmartMatch}
          progressionBpm={bpm}
          onProgressionBpmChange={setBpm}
          progressionSessionBpmLocked={grooveSessionBpmLocked}
          progressionKeyRoot={orchid.keyRoot}
          progressionMode={orchid.mode}
          progressionChordVoiceLabel={orchidVoiceAuditionLabel(orchid.chordVoice)}
          progressionStaged={progressionStaged}
          progressionStatus={progressionStatus}
          progressionAuditionPlaying={progressionAudition.playing}
          progressionAuditionStepIndex={progressionAudition.activeStepIndex}
          onProgressionBuild={buildProgression}
          onProgressionPreviewStep={progressionAudition.previewStep}
          onProgressionPlay={progressionAudition.playProgressionOnce}
          onProgressionLoop={progressionAudition.playProgressionLoop}
          onProgressionStopAudition={progressionAudition.stopPlayback}
          onProgressionDropChords={dropProgressionChordsOnly}
          onPreview={previewGrooveChordOnly}
          showSubKeypad={false}
          showWaveLeaf
          waveLeaf={{
            channel: melodyChannel,
            noteCount: waveLeafRollHits.length,
            bpm,
            getAudioContext: resolveAudioContext,
            channelVolumes,
            onPreviewRoll: handlePreviewWaveLeafRoll,
            onClearHits: () => {
              setWaveLeafMelodyUndoStack([]);
              setWaveLeafHits([]);
            },
            chordColumnCount: melodyGenColumnCount,
            chordHits: chordHitsForMelodyGen,
            barCount,
            quantize,
            keyRoot: orchid.keyRoot,
            mode: orchid.mode,
            bassRootMidi: orchid.bassRootMidi,
            onMelodyGenerated: handleWaveLeafMelodyGenerated,
            canUndoMelody: canUndoWaveLeafMelody,
            onUndoMelody: handleWaveLeafMelodyUndo,
          }}
          onWriteChordToRoll={() => {
            orchid.writeOrchidChordAtEditSlot();
          }}
          chordNotePreview={orchid.orchidChordNotePreview}
          progressionId={orchid.orchidProgressionId}
          progressions={orchid.orchidProgressions}
          onProgressionChange={orchid.setOrchidProgressionId}
          onGenerateChordPattern={() => {
            orchid.generateChordProgression();
          }}
          chordColumnCount={orchid.chordAnchorCount}
          chordAutoAdvance={orchid.chordAutoAdvance}
          onChordAutoAdvanceChange={orchid.setChordAutoAdvance}
          chordStackNoteCount={chordStackNoteCount}
          onChordOctaveDown={() => shiftLayerOctave(-1)}
          onChordOctaveUp={() => shiftLayerOctave(1)}
          chordVoice={orchid.chordVoice}
          onChordVoiceChange={orchid.setChordVoiceWithPreview}
          guitarSoundId={guitarSoundId}
          onGuitarSoundChange={handleGuitarSoundChange}
          orchestraHitId={orchestraHitId}
          onOrchestraHitChange={handleOrchestraHitChange}
          guitarFx={orchid.guitarFx}
          onGuitarWahAmountChange={orchid.setGuitarWahAmount}
          onGuitarWahRateHzChange={orchid.setGuitarWahRateHz}
          onGuitarFilterCutoffHzChange={orchid.setGuitarFilterCutoffHz}
          onGuitarLowCutHzChange={orchid.setGuitarLowCutHz}
          onGuitarHighCutHzChange={orchid.setGuitarHighCutHz}
          onGuitarDriveChange={orchid.setGuitarDrive}
          onGuitarDistortionChange={orchid.setGuitarDistortion}
          onGuitarLfoRateHzChange={orchid.setGuitarLfoRateHz}
          onGuitarLfoDepthCentsChange={orchid.setGuitarLfoDepthCents}
          onGuitarGlideMsChange={orchid.setGuitarGlideMs}
          transportPlaying={grooveTransport.playing}
          transportDisabled={grooveTransport.transportDisabled}
          onTransportRewind={grooveTransport.rewind}
          onTransportStop={stopAllGrooveLabPlayback}
          onTransportPlayPause={handleTransportPlayPause}
          onTransportFastForward={grooveTransport.fastForward}
          layerChannels={channels}
          chordChannel={chordChannel}
          melodyChannel={melodyChannel}
          guitarChannel={guitarChannel}
          sampleChannel={sampleChannel}
          onChordChannelChange={setChordChannel}
          onMelodyChannelChange={setMelodyChannel}
          channelSounds={channelSounds}
          onChannelSoundChange={handleChannelSoundChange}
          onAssignLayerRole={handleAssignLayerRole}
          selectedEditChannel={selectedEditChannel}
          onSelectEditChannel={handleSelectEditChannel}
          channelNoteCounts={channelNoteCounts}
          channelVolumes={channelVolumes}
          setChannelVolume={setChannelVolume}
          metronomeEnabled={metronomeEnabled}
          onMetronomeToggle={() => setMetronomeEnabled((v) => !v)}
          grooveQuantize={quantize}
          grooveBarCount={barCount}
          getAudioContext={resolveAudioContext}
          grooveGuitarPackSustainSlots={noteLengthSlots}
          grooveGuitarPackChordHits={chordHitsForTransport}
          grooveGuitarPackBassRootMidi={orchid.bassRootMidi}
          onDropGuitarPack={dropGuitarPack}
          onDropOrchestraHit={dropOrchestraHit}
          onGuitarPackStatus={setProgressionStatus}
          progressionExportBusy={chordExportBusy}
          progressionExportStatus={chordExportStatus}
          onProgressionExportTimelineMidi={handleExportTimelineMidi}
          onProgressionExportTimelineWav={handleExportTimelineWav}
          onProgressionExportTimelineWavToPad={
            onExportChordWavToPad ? handleExportTimelineWavToPad : undefined
          }
          onProgressionExportRollMidi={handleExportRollMidi}
          onProgressionExportRollWav={handleExportRollWav}
          onProgressionExportRollWavToPad={
            onExportChordWavToPad ? handleExportRollWavToPad : undefined
          }
          onProgressionSendToNewSynth={
            onSendChordsToNewSynth ? handleSendTimelineToNewSynth : undefined
          }
          onProgressionSendRollToNewSynth={
            onSendChordsToNewSynth ? handleSendRollToNewSynth : undefined
          }
          rollHasChordsForExport={rollChordHitsForExport.length > 0}
          rollHasNotesForExport={rollHits.length > 0}
          padExportEnabled={Boolean(onExportChordWavToPad)}
          vocalBox={{
            bpm,
            melodyHits: waveLeafRollHits,
            getAudioContext: resolveAudioContext,
          }}
        />
      </div>

      <div
        style={{
          flex: rollExpanded ? '1.5 1 0' : 1,
          minHeight: rollExpanded ? 320 : 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <GrooveLabPianoRoll
          channel={selectedEditChannel}
          layerScope={editLayerScope}
          rollChrome="full"
          hits={editorRollHits}
          onHitsChange={setEditorRollHits}
          onRollExpandedChange={setRollExpanded}
          rollExpanded={rollExpanded}
          bassRootMidi={orchid.bassRootMidi}
          noteLengthSlots={noteLengthSlots}
          onNoteLengthChange={setNoteLengthSlots}
          quantize={quantize}
          onQuantizeChange={setQuantize}
          barCount={barCount}
          onBarCountChange={handleBarCountChange}
          onPreview={handlePreview}
          onPreviewPitch={handlePreviewPitch}
          onPreviewGuitarNote={
            editLayerScope === 'guitar' || selectedEditChannel === guitarChannel
              ? previewGuitarNote
              : undefined
          }
          onPrimeAudio={
            editLayerScope === 'guitar' || selectedEditChannel === guitarChannel
              ? primeGuitarRollAudio
              : undefined
          }
          onSpreadChord={
            selectedEditChannel === chordChannel ? orchid.spreadChordToRoll : undefined
          }
          onDeleteChordAtSlot={
            selectedEditChannel === chordChannel ? orchid.deleteChordAtSlot : undefined
          }
          editSlot={orchid.editSlot}
          onEditSlotChange={orchid.setEditSlot}
          playheadElRef={playheadElRef}
          rollScrollRef={rollScrollRef}
          transportNotStopped={grooveTransport.transportNotStopped}
          transportPlaying={grooveTransport.playing}
          transportDisabled={grooveTransport.transportDisabled}
          onTransportRewind={grooveTransport.rewind}
          onTransportStop={stopAllGrooveLabPlayback}
          onTransportPlayPause={handleTransportPlayPause}
          onTransportFastForward={grooveTransport.fastForward}
          activeGlobalCol={activeGlobalCol}
          onSeekCol={handleSeekCol}
          onPxPerColChange={setRollPxPerCol}
          chordStackNoteCount={
            editLayerScope === 'chord'
              ? chordStackNoteCount
              : editLayerScope === 'sample'
                ? sampleStackNoteCount
                : 0
          }
          onChordOctaveDown={
            editLayerScope === 'chord' || editLayerScope === 'sample'
              ? () => shiftLayerOctave(-1)
              : undefined
          }
          onChordOctaveUp={
            editLayerScope === 'chord' || editLayerScope === 'sample'
              ? () => shiftLayerOctave(1)
              : undefined
          }
          melodyLayerNoteCount={editLayerScope === 'waveleaf' ? waveLeafRollHits.length : 0}
          onClearAllMelody={
            editLayerScope === 'waveleaf' ? () => setWaveLeafHits([]) : undefined
          }
          onMelodyOctaveDown={
            editLayerScope === 'waveleaf' ? () => shiftWaveLeafOctave(-1) : undefined
          }
          onMelodyOctaveUp={
            editLayerScope === 'waveleaf' ? () => shiftWaveLeafOctave(1) : undefined
          }
          onMidiFileDrop={handleMidiImport}
          onImportMidi={handleMidiImport}
          midiImportStatus={midiImportStatus}
          exportBusy={chordExportBusy}
          exportStatus={chordExportStatus}
          rollHasChords={rollChordHitsForExport.length > 0}
          rollHasNotes={rollHits.length > 0}
          onExportRollMidi={handleExportRollMidi}
          onExportRollWav={handleExportRollWav}
          onExportRollWavToPad={handleExportRollWavToPad}
          onSendRollToNewSynth={onSendChordsToNewSynth ? handleSendRollToNewSynth : undefined}
          padExportEnabled={Boolean(onExportChordWavToPad)}
          padPickerOpen={padExportRequest?.label === 'GrooveLab_Roll'}
        />
      </div>

      <GrooveLabBeatLabPadPicker
        open={padExportRequest != null}
        busy={chordExportBusy}
        onPick={confirmPadExport}
        onCancel={() => setPadExportRequest(null)}
      />
    </div>
    </GrooveLabHelpProvider>
  );
}
