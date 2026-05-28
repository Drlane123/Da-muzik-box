import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GrooveLabLayerLegend } from '@/app/components/creation/GrooveLabLayerLegend';
import { GrooveLabTempoStrip } from '@/app/components/creation/GrooveLabTempoStrip';
import { GROOVE_LAB_CHORD_MIX_GAIN } from '@/app/lib/creationStation/grooveLabLayers';
import { GrooveLabBeatLabPadPicker } from '@/app/components/creation/GrooveLabBeatLabPadPicker';
import { OrchidPerformancePanel } from '@/app/components/creation/OrchidPerformancePanel';
import { GrooveLabPianoRoll } from '@/app/components/creation/GrooveLabPianoRoll';
import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';
import {
  progressionStepsToGrooveHits,
  type GrooveProgressionStep,
  type GrooveStagedProgression,
} from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { orchidVoiceAuditionLabel } from '@/app/lib/creationStation/grooveLabProgressionPreview';
import { useGrooveLabProgressionAudition } from '@/app/hooks/useGrooveLabProgressionAudition';
import { useGrooveLabOrchid } from '@/app/hooks/useGrooveLabOrchid';
import { useGrooveLabTransport } from '@/app/hooks/useGrooveLabTransport';
import { chordBassSeqChannelLabel } from '@/app/lib/creationStation/chordBassSequencerSession';
import { previewGrooveLabRoll } from '@/app/lib/creationStation/grooveLabTransport';
import {
  armGrooveLabPlayback,
  getOrCreateGrooveLabPlaybackBus,
  runWithGrooveLabAudio,
  silenceGrooveLabPlayback,
  withGrooveLabPlaybackSink,
} from '@/app/lib/creationStation/grooveLabAudio';
import { withProgressionAuditionOutput } from '@/app/lib/creationStation/chordSequencerVoices';
import { playGrooveLabBassSound } from '@/app/lib/creationStation/grooveLabBassSounds';
import { grooveLabGlobalColToSlot, grooveLabSlotToGlobalCol } from '@/app/lib/creationStation/grooveLabGrid';
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
  grooveLabPickMelodyChannel,
  loadGrooveLabSession,
  normalizeGrooveBarCount,
  sanitizeGrooveLabHits,
  sanitizeGrooveLabChordChannelHits,
  grooveLabRollHasChordNotes,
  grooveLabTransportChordsMuted,
  saveGrooveLabSession,
  type GrooveLabBarCount,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';
import {
  grooveLabIsBassSubMidi,
  grooveLabIsMelodyMidi,
  grooveLabStripSubRootHits,
} from '@/app/lib/creationStation/grooveComposerEngine';
import {
  GROOVE_LAB_ROLL_OCTAVE_OPTS,
  grooveLabCountLayerHits,
  grooveLabTransposeChordStackHitsOctave,
  grooveLabTransposeMelodyHitsOctave,
  grooveLabTransposeSubHitsOctave,
  type GrooveLabOctaveLayer,
} from '@/app/lib/creationStation/grooveLabOctaveShift';
import { GROOVE_LAB_CHORD_ROLL_MIDI_MIN } from '@/app/lib/creationStation/grooveLabPitch';
import {
  downloadGrooveChordMidi,
  downloadGrooveChordWav,
  progressionStepsToChordHits,
  renderGrooveChordHitsToWav,
  type GrooveChordExportOpts,
} from '@/app/lib/creationStation/grooveLabChordExport';

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
  progressionSteps?: GrooveProgressionStep[] | null;
};
const GROOVE_BASS_CH_KEY = 'groove-lab-bass-ch';
const GROOVE_CHORD_CH_KEY = 'groove-lab-chord-ch';
const GROOVE_MELODY_CH_KEY = 'groove-lab-melody-ch';
const GROOVE_METRONOME_KEY = 'groove-lab-metronome-on';

function readStoredBassChannel(): number {
  const { bass } = grooveLabDefaultLayerChannels();
  if (typeof window === 'undefined') return bass;
  try {
    const v = Number(window.localStorage.getItem(GROOVE_BASS_CH_KEY));
    return grooveLabChannelIds().includes(v) ? v : bass;
  } catch {
    return bass;
  }
}

function readStoredChordChannel(bassChannel: number): number {
  if (typeof window === 'undefined') return grooveLabPickChordChannel(bassChannel);
  try {
    const v = Number(window.localStorage.getItem(GROOVE_CHORD_CH_KEY));
    return grooveLabPickChordChannel(bassChannel, Number.isFinite(v) ? v : undefined);
  } catch {
    return grooveLabPickChordChannel(bassChannel);
  }
}

function readStoredMelodyChannel(bassChannel: number, chordChannel: number): number {
  if (typeof window === 'undefined') return grooveLabPickMelodyChannel(bassChannel, chordChannel);
  try {
    const v = Number(window.localStorage.getItem(GROOVE_MELODY_CH_KEY));
    return grooveLabPickMelodyChannel(
      bassChannel,
      chordChannel,
      Number.isFinite(v) ? v : undefined,
    );
  } catch {
    return grooveLabPickMelodyChannel(bassChannel, chordChannel);
  }
}

function readStoredGrooveMetronome(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const v = window.localStorage.getItem(GROOVE_METRONOME_KEY);
    if (v == null) return true;
    return v !== '0';
  } catch {
    return true;
  }
}

export interface GrooveLabScreenProps {
  embedded?: boolean;
  isScreenActive?: boolean;
  bpm?: number;
  /** When set (Creation Station), Groove Lab tempo edits update the session BPM. */
  onBpmChange?: (bpm: number) => void;
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

function previewBassPitch(
  ctx: AudioContext,
  when: number,
  midi: number,
  bassSoundId: Parameters<typeof playGrooveLabBassSound>[2],
  bpm: number,
): void {
  playGrooveLabBassSound(ctx, midi, bassSoundId, when, 0.88, bpm);
}

export default function GrooveLabScreen({
  embedded = false,
  isScreenActive = true,
  bpm: bpmProp = 100,
  onBpmChange,
  getAudioContext,
  onExportChordWavToPad,
  onSendChordsToNewSynth,
  metronomeEnabled: metronomeEnabledProp,
  onMetronomeEnabledChange,
  channelVolumes: channelVolumesProp,
  setChannelVolume: setChannelVolumeProp,
}: GrooveLabScreenProps) {
  const [localBpm, setLocalBpm] = useState(() => clampGrooveLabBpm(bpmProp));
  const bpm = onBpmChange ? clampGrooveLabBpm(bpmProp) : localBpm;
  const setBpm = useCallback(
    (next: number) => {
      const c = clampGrooveLabBpm(next);
      if (onBpmChange) onBpmChange(c);
      else setLocalBpm(c);
    },
    [onBpmChange],
  );

  useEffect(() => {
    if (!onBpmChange) setLocalBpm(clampGrooveLabBpm(bpmProp));
  }, [bpmProp, onBpmChange]);
  const channels = grooveLabChannelIds();
  const [bassChannel, setBassChannel] = useState(readStoredBassChannel);
  const [notesByChannel, setNotesByChannel] = useState(() => loadGrooveLabSession().notesByChannel);
  const [barCount, setBarCount] = useState<GrooveLabBarCount>(() => loadGrooveLabSession().barCount);
  const [noteLengthSlots, setNoteLengthSlots] = useState(8);
  const [quantize, setQuantize] = useState<GrooveLabQuantize>(GROOVE_LAB_QUANTIZE_DEFAULT);
  const [localMetronomeEnabled, setLocalMetronomeEnabled] = useState(readStoredGrooveMetronome);
  const metronomeEnabled = metronomeEnabledProp ?? localMetronomeEnabled;
  const setMetronomeEnabled = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof next === 'function' ? next(metronomeEnabled) : next;
      if (onMetronomeEnabledChange) onMetronomeEnabledChange(resolved);
      else setLocalMetronomeEnabled(resolved);
    },
    [metronomeEnabled, onMetronomeEnabledChange],
  );
  const [chordChannel, setChordChannel] = useState(() =>
    readStoredChordChannel(readStoredBassChannel()),
  );
  const [melodyChannel, setMelodyChannel] = useState(() =>
    readStoredMelodyChannel(readStoredBassChannel(), readStoredChordChannel(readStoredBassChannel())),
  );
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
  const [matchBassAfterProgressionDrop, setMatchBassAfterProgressionDrop] = useState(false);
  const [localChannelVolumes, setLocalChannelVolumes] = useState<Record<number, number>>(() => {
    const out: Record<number, number> = {};
    for (const ch of grooveLabChannelIds()) out[ch] = 80;
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

  useEffect(() => {
    setNotesByChannel((prev) => {
      let changed = false;
      const next: Record<number, GrooveRollHit[]> = { ...prev };
      for (const ch of grooveLabChannelIds()) {
        const raw = prev[ch] ?? [];
        const clean =
          ch === chordChannel
            ? sanitizeGrooveLabChordChannelHits(raw, barCount)
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
  }, [notesByChannel, barCount, isScreenActive]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(GROOVE_BASS_CH_KEY, String(bassChannel));
      window.localStorage.setItem(GROOVE_CHORD_CH_KEY, String(chordChannel));
      window.localStorage.setItem(GROOVE_MELODY_CH_KEY, String(melodyChannel));
      window.localStorage.setItem(GROOVE_METRONOME_KEY, metronomeEnabled ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [bassChannel, chordChannel, melodyChannel, metronomeEnabled]);

  useEffect(() => {
    if (chordChannel === bassChannel) {
      setChordChannel(grooveLabPickChordChannel(bassChannel, chordChannel));
    }
  }, [bassChannel, chordChannel]);

  useEffect(() => {
    if (melodyChannel === bassChannel || melodyChannel === chordChannel) {
      setMelodyChannel(grooveLabPickMelodyChannel(bassChannel, chordChannel, melodyChannel));
    }
  }, [bassChannel, chordChannel, melodyChannel]);

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

  const bassRollHits = useMemo(
    () =>
      sanitizeGrooveLabHits(
        (notesByChannel[bassChannel] ?? []).filter((h) => grooveLabIsBassSubMidi(h.midi)),
        barCount,
      ),
    [notesByChannel, bassChannel, barCount],
  );

  const melodyRollHits = useMemo(
    () =>
      sanitizeGrooveLabHits(
        (notesByChannel[melodyChannel] ?? []).filter((h) => grooveLabIsMelodyMidi(h.midi)),
        barCount,
      ),
    [notesByChannel, melodyChannel, barCount],
  );

  const transportBassHits = bassRollHits;
  const transportMelodyHits = melodyRollHits;
  const transportChordHits = chordHits;

  const setChordHits = useCallback(
    (next: GrooveRollHit[]) => {
      setNotesByChannel((prev) => ({
        ...prev,
        [chordChannel]: sanitizeGrooveLabChordChannelHits(next, barCount),
      }));
    },
    [chordChannel, barCount],
  );

  const setBassRollHits = useCallback(
    (next: GrooveRollHit[]) => {
      setNotesByChannel((prev) => ({
        ...prev,
        [bassChannel]: sanitizeGrooveLabHits(
          next.filter((h) => grooveLabIsBassSubMidi(h.midi)),
          barCount,
        ),
      }));
    },
    [bassChannel, barCount],
  );

  const setMelodyRollHits = useCallback(
    (next: GrooveRollHit[]) => {
      setNotesByChannel((prev) => ({
        ...prev,
        [melodyChannel]: sanitizeGrooveLabHits(
          next.filter((h) => grooveLabIsMelodyMidi(h.midi)),
          barCount,
        ),
      }));
    },
    [melodyChannel, barCount],
  );

  const rollHits = useMemo(
    () => [...bassRollHits, ...melodyRollHits, ...chordHits],
    [bassRollHits, melodyRollHits, chordHits],
  );

  const subRootNoteCount = useMemo(
    () => grooveLabCountLayerHits(rollHits, 'sub'),
    [rollHits],
  );

  const chordStackNoteCount = useMemo(
    () => grooveLabCountLayerHits(rollHits, 'chord'),
    [rollHits],
  );

  const melodyLayerNoteCount = useMemo(
    () => grooveLabCountLayerHits(rollHits, 'melody'),
    [rollHits],
  );

  const orchid = useGrooveLabOrchid({
    getAudioContext,
    bpm,
    activeChannel: bassChannel,
    barCount,
    noteLengthSlots,
    quantize,
    hits: bassRollHits,
    onHitsChange: setBassRollHits,
    splitChordChannel: true,
    chordHits,
    onChordHitsChange: setChordHits,
    melodyHits: melodyRollHits,
    onMelodyHitsChange: setMelodyRollHits,
  });

  const shiftLayerOctave = useCallback(
    (layer: GrooveLabOctaveLayer, dir: 1 | -1) => {
      const bassRoot = orchid.bassRootMidi;
      const rollOpts = GROOVE_LAB_ROLL_OCTAVE_OPTS;
      setNotesByChannel((prev) => {
        const next: Record<number, GrooveRollHit[]> = { ...prev };
        if (layer === 'chord') {
          const raw = prev[chordChannel] ?? [];
          next[chordChannel] = sanitizeGrooveLabChordChannelHits(
            grooveLabTransposeChordStackHitsOctave(raw, dir, bassRoot, rollOpts),
            barCount,
          );
        } else if (layer === 'melody') {
          const raw = prev[melodyChannel] ?? [];
          next[melodyChannel] = sanitizeGrooveLabHits(
            grooveLabTransposeMelodyHitsOctave(raw, dir),
            barCount,
          );
        } else if (layer === 'sub') {
          const raw = prev[bassChannel] ?? [];
          next[bassChannel] = sanitizeGrooveLabHits(
            grooveLabTransposeSubHitsOctave(raw, dir),
            barCount,
          );
        }
        return next;
      });
    },
    [chordChannel, melodyChannel, bassChannel, barCount, orchid.bassRootMidi],
  );

  const clearAllSubRootsFromRoll = useCallback(() => {
    setNotesByChannel((prev) => {
      let changed = false;
      const next: Record<number, GrooveRollHit[]> = { ...prev };
      for (const ch of channels) {
        const raw = prev[ch] ?? [];
        const stripped = grooveLabStripSubRootHits(raw);
        if (stripped.length === raw.length) continue;
        changed = true;
        next[ch] =
          ch === chordChannel
            ? sanitizeGrooveLabChordChannelHits(stripped, barCount)
            : sanitizeGrooveLabHits(stripped, barCount);
      }
      return changed ? next : prev;
    });
    orchid.setEditSlot(0);
  }, [channels, chordChannel, barCount, orchid.setEditSlot]);

  const transportChordsMuted = useMemo(
    () => grooveLabTransportChordsMuted(orchid.orchidLinkedChordsMuted, rollHits),
    [orchid.orchidLinkedChordsMuted, rollHits],
  );

  const rollChordHitsForExport = useMemo(() => {
    return chordHits;
  }, [chordHits]);

  const chordExportOpts: GrooveChordExportOpts = useMemo(
    () => ({
      bpm,
      chordVoice: orchid.chordVoice,
      chordVolume: orchid.orchidLinkedChordVolume * GROOVE_LAB_CHORD_MIX_GAIN,
      perfMode: orchid.orchidPerfMode,
      trackName: 'Groove Lab Chords',
    }),
    [bpm, orchid.chordVoice, orchid.orchidLinkedChordVolume, orchid.orchidPerfMode],
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
    requestPadExport(rollChordHitsForExport, 'GrooveLab_Roll');
  }, [rollChordHitsForExport, requestPadExport]);

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
        progressionSteps: progressionSteps ?? progressionStaged?.steps ?? null,
      });
      setChordExportStatus('✓ Sent to NEW SYNTH — Beat Lab · VIEW');
      window.setTimeout(() => setChordExportStatus(null), 5000);
    },
    [onSendChordsToNewSynth, bpm, progressionStaged?.steps],
  );

  const handleSendRollToNewSynth = useCallback(() => {
    sendChordHitsToNewSynth(rollChordHitsForExport, 'Groove Lab roll');
  }, [rollChordHitsForExport, sendChordHitsToNewSynth]);

  const handleSendTimelineToNewSynth = useCallback(
    (steps: GrooveProgressionStep[]) => {
      const hits = hitsFromTimelineSteps(steps);
      if (!hits?.length) return;
      sendChordHitsToNewSynth(hits, 'Groove Lab progression', steps);
    },
    [hitsFromTimelineSteps, sendChordHitsToNewSynth],
  );

  useEffect(() => {
    if (!grooveLabRollHasChordNotes(rollHits)) return;
    if (!orchid.orchidLinkedChordsMuted) return;
    orchid.setOrchidLinkedChordsMuted(false);
  }, [rollHits, orchid.orchidLinkedChordsMuted, orchid.setOrchidLinkedChordsMuted]);

  const grooveTransport = useGrooveLabTransport({
    getAudioContext,
    isScreenActive,
    bpm,
    barCount,
    quantize,
    pxPerCol: rollPxPerCol,
    bassHits: transportBassHits,
    chordHits: transportChordHits,
    melodyHits: transportMelodyHits,
    bassSoundId: orchid.bassSoundId,
    melodySoundId: orchid.melodySoundId,
    chordVoice: orchid.chordVoice,
    chordVolume: orchid.orchidLinkedChordVolume * GROOVE_LAB_CHORD_MIX_GAIN,
    chordsMuted: transportChordsMuted,
    bassMuted: orchid.bassMuted,
    perfMode: orchid.orchidPerfMode,
    metronomeEnabled,
    playheadElRef,
    rollScrollRef,
  });

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


  /** Warm master bus + unlock AudioContext on first tap while Groove Lab is open. */
  useEffect(() => {
    if (!isScreenActive || !getAudioContext) return;
    try {
      getAudioContext();
    } catch {
      /* ignore */
    }
    const prime = () => {
      try {
        void getAudioContext()?.resume().catch(() => {});
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('pointerdown', prime, { capture: true });
    return () => window.removeEventListener('pointerdown', prime, { capture: true });
  }, [isScreenActive, getAudioContext]);

  const handlePreview = useCallback(() => {
    runWithGrooveLabAudio(getAudioContext, (ctx, when) => {
      const bus = getOrCreateGrooveLabPlaybackBus(ctx);
      armGrooveLabPlayback(ctx);
      withGrooveLabPlaybackSink(bus, () =>
        withProgressionAuditionOutput(bus, () =>
          previewGrooveLabRoll(ctx, transportBassHits, transportChordHits, transportMelodyHits, {
            bpm,
            bassSoundId: orchid.bassSoundId,
            melodySoundId: orchid.melodySoundId,
            chordVoice: orchid.chordVoice,
            chordVolume: orchid.orchidLinkedChordVolume * GROOVE_LAB_CHORD_MIX_GAIN,
            chordsMuted: transportChordsMuted,
            bassMuted: orchid.bassMuted,
            perfMode: orchid.orchidPerfMode,
            startDelaySec: when - ctx.currentTime,
          }),
        ),
      );
    });
  }, [
    getAudioContext,
    transportBassHits,
    transportChordHits,
    transportMelodyHits,
    bpm,
    orchid.bassSoundId,
    orchid.melodySoundId,
    orchid.chordVoice,
    orchid.orchidLinkedChordVolume,
    transportChordsMuted,
    orchid.bassMuted,
    orchid.orchidPerfMode,
  ]);

  const handlePreviewPitch = useCallback(
    (midi: number) => {
      if (orchid.bassMuted) return;
      runWithGrooveLabAudio(getAudioContext, (ctx, when) => {
        previewBassPitch(ctx, when, midi, orchid.bassSoundId, bpm);
      });
    },
    [getAudioContext, orchid.bassSoundId, orchid.bassMuted, bpm],
  );

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
    (staged: GrooveStagedProgression, opts?: { matchBassAfter?: boolean }) => {
      const chordCh = grooveLabPickChordChannel(bassChannel, chordChannel);
      const melodyCh = grooveLabPickMelodyChannel(bassChannel, chordCh, melodyChannel);
      setChordChannel(chordCh);
      setMelodyChannel(melodyCh);
      setBarCount(staged.barCount);
      const chordSlots = new Set(staged.chordHits.map((h) => h.slot));
      setNotesByChannel((prev) => {
        const next: Record<number, GrooveRollHit[]> = {};
        for (const ch of channels) {
          next[ch] = clipGrooveHitsToBarCount(prev[ch] ?? [], staged.barCount);
        }
        next[chordCh] = sanitizeGrooveLabChordChannelHits(staged.chordHits, staged.barCount);
        /** Groove Studio / progression drop = green chords only — never auto-fill blue bass. */
        const prevBass = prev[bassChannel] ?? [];
        next[bassChannel] = sanitizeGrooveLabHits(
          prevBass.filter((h) => !chordSlots.has(h.slot)),
          staged.barCount,
        );
        return next;
      });
      orchid.setOrchidLinkedChordsMuted(false);
      grooveTransport.rewind();
      orchid.setEditSlot(0);
      const scrollEl = rollScrollRef.current;
      if (scrollEl) scrollEl.scrollLeft = 0;
      if (opts?.matchBassAfter) setMatchBassAfterProgressionDrop(true);
    },
    [
      bassChannel,
      chordChannel,
      melodyChannel,
      channels,
      grooveTransport,
      orchid.setEditSlot,
      orchid.setOrchidLinkedChordsMuted,
    ],
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

  useEffect(() => {
    if (!matchBassAfterProgressionDrop) return;
    if (orchid.chordAnchorCount === 0) return;
    orchid.matchBassToChords();
    setMatchBassAfterProgressionDrop(false);
    setProgressionStatus('✓ Dropped on roll · bass matched to chords');
  }, [matchBassAfterProgressionDrop, orchid.chordAnchorCount, orchid.matchBassToChords]);

  const progressionAudition = useGrooveLabProgressionAudition({
    getAudioContext,
    bpm,
    chordVoice: orchid.chordVoice,
    perfMode: orchid.orchidPerfMode,
    linkedChordVolume: orchid.orchidLinkedChordVolume,
  });

  const stopAllGrooveLabPlayback = useCallback(() => {
    progressionAudition.stopPlayback();
    grooveTransport.stop();
    if (getAudioContext) {
      try {
        silenceGrooveLabPlayback(getAudioContext());
      } catch {
        /* ignore */
      }
    }
  }, [getAudioContext, progressionAudition, grooveTransport]);

  const dropProgressionFromSteps = useCallback(
    (steps: GrooveProgressionStep[], opts?: { matchBassAfter?: boolean }) => {
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
      if (built.chordHits.length === 0) {
        setProgressionStaged(null);
        setProgressionStatus('No chord notes for the roll — check chord labels (C, Am, G7…).');
        return;
      }
      progressionAudition.stopPlayback();
      setProgressionStaged(built);
      applyProgressionStaged(built, { matchBassAfter: opts?.matchBassAfter });
      setProgressionStatus(
        `✓ ${built.barCount} bars · green chords only (C4+) — press ▶ transport · use + MATCH BASS for blue 808`,
      );
    },
    [
      quantize,
      barCount,
      noteLengthSlots,
      progressionAudition,
      applyProgressionStaged,
    ],
  );

  const handleTransportPlayPause = useCallback(() => {
    if (!grooveTransport.playing) progressionAudition.stopPlayback();
    grooveTransport.togglePlayPause();
  }, [grooveTransport, progressionAudition]);

  const stopAllRef = useRef(stopAllGrooveLabPlayback);
  stopAllRef.current = stopAllGrooveLabPlayback;
  useEffect(() => {
    if (!isScreenActive) stopAllRef.current();
  }, [isScreenActive]);

  const dropProgressionChordsOnly = useCallback(
    (steps: GrooveProgressionStep[]) => {
      dropProgressionFromSteps(steps);
    },
    [dropProgressionFromSteps],
  );

  const dropProgressionAndMatchBass = useCallback(
    (steps: GrooveProgressionStep[]) => {
      dropProgressionFromSteps(steps, { matchBassAfter: true });
    },
    [dropProgressionFromSteps],
  );

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
        const chordCh = grooveLabPickChordChannel(bassChannel, chordChannel);
        const melodyCh = grooveLabPickMelodyChannel(bassChannel, chordCh, melodyChannel);
        setChordChannel(chordCh);
        setMelodyChannel(melodyCh);
        setBpm(parsed.bpm);
        setBarCount(parsed.barCount);
        setNotesByChannel((prev) => {
          const next: Record<number, GrooveRollHit[]> = {};
          for (const ch of channels) {
            next[ch] = clipGrooveHitsToBarCount(prev[ch] ?? [], parsed.barCount);
          }
          const importedMelody = parsed.bassHits.filter((h) => grooveLabIsMelodyMidi(h.midi));
          const importedSub = parsed.bassHits.filter((h) => grooveLabIsBassSubMidi(h.midi));
          next[bassChannel] = sanitizeGrooveLabHits(importedSub, parsed.barCount);
          next[melodyCh] = sanitizeGrooveLabHits(importedMelody, parsed.barCount);
          next[chordCh] = sanitizeGrooveLabChordChannelHits(parsed.chordHits, parsed.barCount);
          return next;
        });
        grooveTransport.rewind();
        orchid.setEditSlot(0);
        flashMidiImport(
          `✓ ${file.name} · ${parsed.bpm} BPM · ${parsed.bassHits.length} bass / ${parsed.chordHits.length} chord`,
        );
      } catch (err) {
        flashMidiImport(err instanceof Error ? err.message : 'Import failed.');
      }
    },
    [
      quantize,
      barCount,
      bassChannel,
      chordChannel,
      melodyChannel,
      channels,
      setBpm,
      flashMidiImport,
      grooveTransport,
      orchid.setEditSlot,
    ],
  );

  const handleApplyImportedBassHits = useCallback(
    (hits: GrooveRollHit[]) => {
      stopAllGrooveLabPlayback();
      setBassRollHits(sanitizeGrooveLabHits(hits, barCount));
      grooveTransport.rewind();
      orchid.setEditSlot(0);
      flashMidiImport(`✓ ${hits.length} bass note${hits.length === 1 ? '' : 's'} on roll`);
    },
    [
      stopAllGrooveLabPlayback,
      setBassRollHits,
      barCount,
      grooveTransport,
      orchid.setEditSlot,
      flashMidiImport,
    ],
  );

  return (
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
          justifyContent: 'space-between',
          gap: 12,
          padding: '6px 10px',
          borderBottom: '1px solid #151515',
          background: '#090909',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.08em', color: '#f0f0f0' }}>
            GROOVE <span style={{ color: '#7cf4c6' }}>LAB</span>
          </span>
          <span style={{ fontSize: 9, color: '#67e8f9', fontWeight: 800 }}>
            SUB {chordBassSeqChannelLabel(bassChannel)}
            <span style={{ color: '#86efac', marginLeft: 6 }}>
              · CHORD {chordBassSeqChannelLabel(chordChannel)}
            </span>
            <span style={{ color: '#fbbf24', marginLeft: 6 }}>
              · MELODY {chordBassSeqChannelLabel(melodyChannel)}
            </span>
          </span>
        </div>
        <GrooveLabTempoStrip
          bpm={bpm}
          onBpmChange={setBpm}
          sessionLocked={embedded || Boolean(onBpmChange)}
          transportPlaying={grooveTransport.playing}
        />
      </div>

      <div
        style={{
          flexShrink: 0,
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
          <span style={{ fontSize: 10, fontWeight: 900, color: '#a7f3d0', letterSpacing: 0.4 }}>
            GROOVE <span style={{ color: '#22c55e' }}>STUDIO</span>
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
          progressionSessionBpmLocked={embedded || Boolean(onBpmChange)}
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
          onProgressionStopAudition={stopAllGrooveLabPlayback}
          onProgressionDropChords={dropProgressionChordsOnly}
          onProgressionDropWithBass={dropProgressionAndMatchBass}
          onPreview={orchid.previewOrchidChord}
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
          onMatchBassToChords={() => {
            orchid.matchBassToChords();
          }}
          chordColumnCount={orchid.chordAnchorCount}
          chordAutoAdvance={orchid.chordAutoAdvance}
          onChordAutoAdvanceChange={orchid.setChordAutoAdvance}
          onPinToPad={() => {}}
          pinDisabled
          bassKeys={orchid.orchidBassKeys}
          linkedChordVolume={orchid.orchidLinkedChordVolume}
          onLinkedChordVolumeChange={orchid.setOrchidLinkedChordVolume}
          linkedChordsMuted={orchid.orchidLinkedChordsMuted}
          onLinkedChordsMutedChange={orchid.setOrchidLinkedChordsMuted}
          bassMuted={orchid.bassMuted}
          onBassMutedChange={orchid.setBassMuted}
          writeToPianoRoll={orchid.orchidWriteToPianoRoll}
          onWriteToPianoRollChange={orchid.setOrchidWriteToPianoRoll}
          onBassKeyDown={orchid.playOrchidBassKey}
          subRootNoteCount={subRootNoteCount}
          onClearAllSubRoots={clearAllSubRootsFromRoll}
          onSubOctaveDown={() => shiftLayerOctave('sub', -1)}
          onSubOctaveUp={() => shiftLayerOctave('sub', 1)}
          chordStackNoteCount={chordStackNoteCount}
          onChordOctaveDown={() => shiftLayerOctave('chord', -1)}
          onChordOctaveUp={() => shiftLayerOctave('chord', 1)}
          melodyLayerNoteCount={melodyLayerNoteCount}
          onMelodyOctaveDown={() => shiftLayerOctave('melody', -1)}
          onMelodyOctaveUp={() => shiftLayerOctave('melody', 1)}
          suggestedSubMidis={orchid.subKeypadGuide.suggestedKeyMidis}
          subGuideAuditionMidi={orchid.subGuideAuditionMidi}
          subGuideStepCount={orchid.subKeypadGuide.steps.length}
          onRegenerateSubGuide={orchid.regenerateSubKeypadGuide}
          onAuditionSubGuide={orchid.auditionSubKeypadGuide}
          onStopSubGuideAudition={orchid.stopSubKeypadAudition}
          onPushSubGuideToRoll={orchid.applySubKeypadGuideToRoll}
          bassAutoAdvance={orchid.bassAutoAdvance}
          onBassAutoAdvanceChange={orchid.setBassAutoAdvance}
          bassDrawNotes={orchid.bassDrawNotes}
          onBassDrawNotesChange={orchid.setBassDrawNotes}
          bassKeypadPreviewMode={orchid.bassKeypadPreviewMode}
          onBassKeypadPreviewModeChange={orchid.setBassKeypadPreviewMode}
          bassKeypadSoundLabel={orchid.bassKeypadSoundLabel}
          bassKeypadChordVoiceLabel={orchid.bassKeypadChordVoiceLabel}
          bassSoundId={orchid.bassSoundId}
          onBassSoundChange={orchid.setBassSoundId}
          melodySoundId={orchid.melodySoundId}
          onMelodySoundChange={orchid.setMelodySoundId}
          composerComplexity={orchid.composerComplexity}
          onComposerComplexityChange={orchid.setComposerComplexity}
          onGenerateComposerPart={orchid.generateComposerPart}
          melodyNoteCount={orchid.melodyNoteCount}
          onLockChords={() => {
            orchid.lockChordsToGroove({ forceSplit: true });
          }}
          bassAnchorCount={orchid.bassAnchorCount}
          chordVoice={orchid.chordVoice}
          onChordVoiceChange={orchid.setChordVoiceWithPreview}
          transportPlaying={grooveTransport.playing}
          transportDisabled={grooveTransport.transportDisabled}
          onTransportRewind={grooveTransport.rewind}
          onTransportStop={stopAllGrooveLabPlayback}
          onTransportPlayPause={handleTransportPlayPause}
          onTransportFastForward={grooveTransport.fastForward}
          layerChannels={channels}
          bassChannel={bassChannel}
          chordChannel={chordChannel}
          melodyChannel={melodyChannel}
          onBassChannelChange={setBassChannel}
          onChordChannelChange={setChordChannel}
          onMelodyChannelChange={setMelodyChannel}
          channelVolumes={channelVolumes}
          setChannelVolume={setChannelVolume}
          metronomeEnabled={metronomeEnabled}
          onMetronomeToggle={() => setMetronomeEnabled((v) => !v)}
          grooveQuantize={quantize}
          grooveBarCount={barCount}
          getAudioContext={getAudioContext}
          onApplyImportedBassHits={handleApplyImportedBassHits}
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
        />
      </div>

      <GrooveLabLayerLegend
        splitChannels
        bassChannelLabel={chordBassSeqChannelLabel(bassChannel)}
        chordChannelLabel={chordBassSeqChannelLabel(chordChannel)}
        melodyChannelLabel={chordBassSeqChannelLabel(melodyChannel)}
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
      />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <GrooveLabPianoRoll
          channel={bassChannel}
          chordChannel={chordChannel}
          melodyChannel={melodyChannel}
          bassRootMidi={orchid.bassRootMidi}
          hits={rollHits}
          onHitsChange={setBassRollHits}
          splitChannels
          bassHits={bassRollHits}
          chordHits={chordHits}
          melodyHits={melodyRollHits}
          onBassHitsChange={setBassRollHits}
          onChordHitsChange={setChordHits}
          onMelodyHitsChange={setMelodyRollHits}
          noteLengthSlots={noteLengthSlots}
          onNoteLengthChange={setNoteLengthSlots}
          quantize={quantize}
          onQuantizeChange={setQuantize}
          barCount={barCount}
          onBarCountChange={handleBarCountChange}
          onPreview={getAudioContext ? handlePreview : undefined}
          onPreviewPitch={getAudioContext ? handlePreviewPitch : undefined}
          onSpreadChord={orchid.spreadChordToRoll}
          onDeleteChordAtSlot={orchid.deleteChordAtSlot}
          editSlot={orchid.editSlot}
          onEditSlotChange={orchid.setEditSlot}
          bassDrawNotes={orchid.bassDrawNotes}
          onPlaceBassNote={
            orchid.bassDrawNotes
              ? (midi, anchorSlot, opts) => {
                  orchid.placeBassAtSlot(midi, anchorSlot, opts);
                  handlePreviewPitch(midi);
                }
              : undefined
          }
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
          subRootNoteCount={subRootNoteCount}
          onClearAllSubRoots={clearAllSubRootsFromRoll}
          onSubOctaveDown={() => shiftLayerOctave('sub', -1)}
          onSubOctaveUp={() => shiftLayerOctave('sub', 1)}
          chordStackNoteCount={chordStackNoteCount}
          onChordOctaveDown={() => shiftLayerOctave('chord', -1)}
          onChordOctaveUp={() => shiftLayerOctave('chord', 1)}
          melodyLayerNoteCount={melodyLayerNoteCount}
          onMelodyOctaveDown={() => shiftLayerOctave('melody', -1)}
          onMelodyOctaveUp={() => shiftLayerOctave('melody', 1)}
          onMidiFileDrop={handleMidiImport}
          exportBusy={chordExportBusy}
          exportStatus={chordExportStatus}
          rollHasChords={rollChordHitsForExport.length > 0}
          rollHasNotes={rollHits.length > 0}
          onExportRollMidi={handleExportRollMidi}
          onExportRollWav={handleExportRollWav}
          onExportRollWavToPad={handleExportRollWavToPad}
          onSendRollToNewSynth={onSendChordsToNewSynth ? handleSendRollToNewSynth : undefined}
          padExportEnabled={Boolean(onExportChordWavToPad)}
        />
      </div>

      <GrooveLabBeatLabPadPicker
        open={padExportRequest != null}
        busy={chordExportBusy}
        onPick={confirmPadExport}
        onCancel={() => setPadExportRequest(null)}
      />
    </div>
  );
}
