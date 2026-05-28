import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  CHORD_VOICE_MAP,
  type ChordVoiceId,
} from '@/app/lib/creationStation/chordSequencerVoices';
import {
  buildOrchidNotes,
  buildOrchidNotesForBassRoot,
  diatonicOrchidTypeForRootPc,
  formatOrchidChordName,
  getDiatonicRootsInKey,
  getOrchidBassKeypadLayout,
  scheduleOrchidChord,
  type OrchidChordType,
  type OrchidExtension,
  type OrchidPerformanceMode,
} from '@/app/lib/creationStation/orchidChordEngine';
import {
  generateGrooveComposerPart,
  grooveComposerHarmonyFromChordHits,
  grooveComposerMergePart,
  type GrooveComposerPart,
} from '@/app/lib/creationStation/grooveComposerEngine';
import { GROOVE_LAB_SLOTS_PER_BEAT } from '@/app/lib/creationStation/grooveLabGrid';
import {
  grooveLabBuildSubKeypadGuide,
  grooveLabSubGuideToRollHits,
  type GrooveSubKeypadGuide,
} from '@/app/lib/creationStation/grooveLabSubKeypadGuide';
import {
  GROOVE_LAB_BASS_SOUND_DEFAULT,
  grooveLabBassSoundDef,
  grooveLabIs808SubRootSound,
  playGrooveLabBassSound,
  type GrooveLabBassSoundId,
} from '@/app/lib/creationStation/grooveLabBassSounds';
import { runWithGrooveLabAudio } from '@/app/lib/creationStation/grooveLabAudio';
import { GROOVE_LAB_KEYPAD_CHORD_MIX_GAIN } from '@/app/lib/creationStation/grooveLabLayers';
import { cbPianoMidiToNoteName } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import {
  GROOVE_LAB_CHORD_ROLL_MIDI_MIN,
  GROOVE_LAB_MELODY_REFERENCE_MIDI,
  grooveLabClampBassRootMidi,
  grooveLabIsMelodyMidi,
  grooveLabClampChordRollMidi,
  grooveLabLiftChordsAboveBass,
} from '@/app/lib/creationStation/grooveLabPitch';
import {
  generateOrchidChordProgressionHits,
  ORCHID_PROGRESSIONS,
  type OrchidProgressionId,
} from '@/app/lib/creationStation/grooveLabOrchidMatch';
import {
  GROOVE_LAB_ROOT_MIDI,
  grooveLabBassAnchorsFromHits,
  grooveLabChordAnchorsFromHits,
  grooveLabLockChordsToSeparateChannel,
  grooveLabLockOrchidChordsToBassline,
  grooveLabStackChordHitsAtSlot,
  grooveLabRemoveHitsAtSlot,
  grooveLabReplaceBassAtSlot,
  grooveLabSpreadChordHits,
  grooveLabSlotsPerCell,
  grooveLabTotalSlots,
  grooveLabWriteOrchidColumn,
  snapGrooveSlot,
  snapGrooveSustain,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';

const GROOVE_BASS_SOUND_KEY = 'groove-lab-bass-sound';
const GROOVE_MELODY_SOUND_KEY = 'groove-lab-melody-sound';
const GROOVE_COMPOSER_COMPLEXITY_KEY = 'groove-lab-composer-complexity';
const GROOVE_CHORD_VOICE_KEY = 'groove-lab-chord-voice';
const GROOVE_BASS_KEYPAD_PREVIEW_KEY = 'groove-lab-bass-keypad-preview';
const GROOVE_ORCHID_PROGRESSION_KEY = 'groove-lab-orchid-progression';

function readStoredProgression(): OrchidProgressionId {
  if (typeof window === 'undefined') return 'I-IV-V-I';
  try {
    const v = window.localStorage.getItem(GROOVE_ORCHID_PROGRESSION_KEY) as OrchidProgressionId | null;
    return ORCHID_PROGRESSIONS.some((p) => p.id === v) ? v! : 'I-IV-V-I';
  } catch {
    return 'I-IV-V-I';
  }
}

export type BassKeypadPreviewMode = 'bass' | 'chord';

function readStoredChordVoice(): ChordVoiceId {
  if (typeof window === 'undefined') return 'grand';
  try {
    const v = window.localStorage.getItem(GROOVE_CHORD_VOICE_KEY) as ChordVoiceId | null;
    return v && CHORD_VOICE_MAP[v] ? v : 'grand';
  } catch {
    return 'grand';
  }
}

function readStoredBassSound(): GrooveLabBassSoundId {
  if (typeof window === 'undefined') return GROOVE_LAB_BASS_SOUND_DEFAULT;
  try {
    const v = window.localStorage.getItem(GROOVE_BASS_SOUND_KEY);
    return (v as GrooveLabBassSoundId) || GROOVE_LAB_BASS_SOUND_DEFAULT;
  } catch {
    return GROOVE_LAB_BASS_SOUND_DEFAULT;
  }
}

function readStoredBassKeypadPreview(): BassKeypadPreviewMode {
  if (typeof window === 'undefined') return 'bass';
  try {
    const v = window.localStorage.getItem(GROOVE_BASS_KEYPAD_PREVIEW_KEY);
    return v === 'chord' ? 'chord' : 'bass';
  } catch {
    return 'bass';
  }
}

function readStoredComposerComplexity(): number {
  if (typeof window === 'undefined') return 0.55;
  try {
    const v = Number.parseFloat(window.localStorage.getItem(GROOVE_COMPOSER_COMPLEXITY_KEY) ?? '');
    if (Number.isFinite(v)) return Math.max(0, Math.min(1, v));
  } catch {
    /* ignore */
  }
  return 0.55;
}

function readStoredMelodySound(): GrooveLabBassSoundId {
  if (typeof window === 'undefined') return 'gtrFinger';
  try {
    const v = window.localStorage.getItem(GROOVE_MELODY_SOUND_KEY);
    if (v) return v as GrooveLabBassSoundId;
  } catch {
    /* ignore */
  }
  return 'gtrFinger';
}

export type UseGrooveLabOrchidArgs = {
  getAudioContext?: () => AudioContext;
  bpm: number;
  activeChannel: number;
  barCount: number;
  noteLengthSlots: number;
  quantize: GrooveLabQuantize;
  hits: GrooveRollHit[];
  onHitsChange: (hits: GrooveRollHit[]) => void;
  /** When true, bass stays on {@link hits} channel; chords go to {@link chordHits}. */
  splitChordChannel?: boolean;
  chordHits?: GrooveRollHit[];
  onChordHitsChange?: (hits: GrooveRollHit[]) => void;
  melodyHits?: GrooveRollHit[];
  onMelodyHitsChange?: (hits: GrooveRollHit[]) => void;
};

export function useGrooveLabOrchid({
  getAudioContext,
  bpm,
  activeChannel,
  barCount,
  noteLengthSlots,
  quantize,
  hits,
  onHitsChange,
  splitChordChannel = false,
  chordHits = [],
  onChordHitsChange,
  melodyHits = [],
  onMelodyHitsChange,
}: UseGrooveLabOrchidArgs) {
  const splitChords = splitChordChannel && !!onChordHitsChange;
  const splitMelody = splitChords && !!onMelodyHitsChange;
  const [keyRoot, setKeyRoot] = useState(0);
  const [mode, setMode] = useState<ChordMode>('major');
  const [orchidType, setOrchidType] = useState<OrchidChordType>('maj');
  const [orchidExtensions, setOrchidExtensions] = useState<Set<OrchidExtension>>(() => new Set());
  const [orchidInversion, setOrchidInversion] = useState(0);
  /** BLOCK = all voices on the grid line; STRUM staggers attacks and feels late on the roll. */
  const [orchidPerfMode, setOrchidPerfMode] = useState<OrchidPerformanceMode>('block');
  const [orchidRootMidi, setOrchidRootMidi] = useState(GROOVE_LAB_ROOT_MIDI);
  const [orchidSmartMatch, setOrchidSmartMatch] = useState(true);
  const [orchidLinkedChordVolume, setOrchidLinkedChordVolume] = useState(0.75);
  /** Bass keypad / MIDI library = bass only; chord layer is opt-in via CHORD LAYER ON. */
  const [orchidLinkedChordsMuted, setOrchidLinkedChordsMuted] = useState(true);
  const [bassMuted, setBassMuted] = useState(false);
  const [orchidWriteToPianoRoll, setOrchidWriteToPianoRoll] = useState(true);
  const [orchidBassMatchLabel, setOrchidBassMatchLabel] = useState('');
  const [bassSoundId, setBassSoundId] = useState<GrooveLabBassSoundId>(readStoredBassSound);
  const [melodySoundId, setMelodySoundId] = useState<GrooveLabBassSoundId>(readStoredMelodySound);
  const [composerComplexity, setComposerComplexity] = useState(readStoredComposerComplexity);
  const [grooveSeed, setGrooveSeed] = useState(1);
  const [subGuideSeed, setSubGuideSeed] = useState(1);
  const [subGuideAuditionMidi, setSubGuideAuditionMidi] = useState<number | null>(null);
  const subGuideAuditionStopRef = useRef<(() => void) | null>(null);
  const [editSlot, setEditSlot] = useState(0);
  const [bassAutoAdvance, setBassAutoAdvance] = useState(false);
  const [bassDrawNotes, setBassDrawNotes] = useState(false);
  const [bassKeypadPreviewMode, setBassKeypadPreviewMode] =
    useState<BassKeypadPreviewMode>(readStoredBassKeypadPreview);
  const [chordVoice, setChordVoice] = useState<ChordVoiceId>(readStoredChordVoice);
  const [orchidProgressionId, setOrchidProgressionId] =
    useState<OrchidProgressionId>(readStoredProgression);
  const [chordAutoAdvance, setChordAutoAdvance] = useState(true);
  const recordSlotRef = useRef(0);

  const diatonicRoots = useMemo(() => getDiatonicRootsInKey(keyRoot, mode, 3), [keyRoot, mode]);
  const orchidBassKeys = useMemo(
    () => getOrchidBassKeypadLayout(keyRoot, mode, 2),
    [keyRoot, mode],
  );

  const orchidBuiltNotes = useMemo(
    () => buildOrchidNotes(orchidRootMidi, orchidType, orchidExtensions, orchidInversion, 3),
    [orchidRootMidi, orchidType, orchidExtensions, orchidInversion],
  );

  const orchidLabel = useMemo(
    () => formatOrchidChordName(orchidRootMidi, orchidType, orchidExtensions),
    [orchidRootMidi, orchidType, orchidExtensions],
  );

  const orchidMaxInversion = Math.max(0, orchidBuiltNotes.length - 1);

  useEffect(() => {
    if (orchidInversion > orchidMaxInversion) setOrchidInversion(orchidMaxInversion);
  }, [orchidInversion, orchidMaxInversion]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(GROOVE_BASS_SOUND_KEY, bassSoundId);
    } catch {
      /* ignore */
    }
  }, [bassSoundId]);

  useEffect(() => {
    if (grooveLabIs808SubRootSound(bassSoundId)) return;
    setBassSoundId(GROOVE_LAB_BASS_SOUND_DEFAULT);
  }, [bassSoundId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(GROOVE_MELODY_SOUND_KEY, melodySoundId);
    } catch {
      /* ignore */
    }
  }, [melodySoundId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(GROOVE_COMPOSER_COMPLEXITY_KEY, String(composerComplexity));
    } catch {
      /* ignore */
    }
  }, [composerComplexity]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(GROOVE_CHORD_VOICE_KEY, chordVoice);
    } catch {
      /* ignore */
    }
  }, [chordVoice]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(GROOVE_BASS_KEYPAD_PREVIEW_KEY, bassKeypadPreviewMode);
    } catch {
      /* ignore */
    }
  }, [bassKeypadPreviewMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(GROOVE_ORCHID_PROGRESSION_KEY, orchidProgressionId);
    } catch {
      /* ignore */
    }
  }, [orchidProgressionId]);

  const chordMidisForBass = useCallback(
    (bassMidi: number) => {
      const type = orchidSmartMatch
        ? diatonicOrchidTypeForRootPc(bassMidi % 12, keyRoot, mode)
        : orchidType;
      return buildOrchidNotesForBassRoot(bassMidi, type, orchidExtensions, orchidInversion);
    },
    [orchidSmartMatch, keyRoot, mode, orchidType, orchidExtensions, orchidInversion],
  );

  const placeBassAtSlot = useCallback(
    (bassMidi: number, anchorSlot?: number, opts?: { sustainSlots?: number }) => {
      const slot = snapGrooveSlot(anchorSlot ?? editSlot, quantize, barCount);
      const susLen = opts?.sustainSlots ?? noteLengthSlots;
      const sus = snapGrooveSustain(slot, susLen, quantize, barCount);
      onHitsChange(grooveLabReplaceBassAtSlot(hits, slot, bassMidi, sus, 0.94));
      setEditSlot(slot);
      recordSlotRef.current = slot;
      return slot;
    },
    [hits, onHitsChange, quantize, barCount, noteLengthSlots, editSlot],
  );

  const toggleOrchidExtension = useCallback((ext: OrchidExtension) => {
    setOrchidExtensions((prev) => {
      const next = new Set(prev);
      if (next.has(ext)) next.delete(ext);
      else next.add(ext);
      return next;
    });
  }, []);

  const previewOrchidChord = useCallback(
    (rootMidi?: number) => {
      runWithGrooveLabAudio(getAudioContext, (ctx, when) => {
        const root = rootMidi ?? orchidRootMidi;
        const type = orchidSmartMatch
          ? diatonicOrchidTypeForRootPc(root % 12, keyRoot, mode)
          : orchidType;
        const notes = buildOrchidNotes(root, type, orchidExtensions, orchidInversion, 3);
        scheduleOrchidChord(ctx, notes, when, 0.85, chordVoice, 0.9, {
          mode: orchidPerfMode,
          bpm,
        });
      });
    },
    [
      getAudioContext,
      orchidRootMidi,
      orchidSmartMatch,
      keyRoot,
      mode,
      orchidType,
      orchidExtensions,
      orchidInversion,
      chordVoice,
      orchidPerfMode,
      bpm,
    ],
  );

  const writeOrchidChordAtEditSlot = useCallback(() => {
    const type = orchidSmartMatch
      ? diatonicOrchidTypeForRootPc(orchidRootMidi % 12, keyRoot, mode)
      : orchidType;
    const chordNotes = buildOrchidNotesForBassRoot(
      orchidRootMidi,
      type,
      orchidExtensions,
      orchidInversion,
    );
    const slot = snapGrooveSlot(editSlot, quantize, barCount);
    const bassRef =
      grooveLabBassAnchorsFromHits(hits).find((a) => a.slot === slot)?.midi ?? orchidRootMidi;
    const stack = grooveLabStackChordHitsAtSlot({
      anchorSlot: slot,
      chordMidis: chordNotes,
      sustainSlots: noteLengthSlots,
      quantize,
      barCount,
      bassMidiForLift: bassRef,
    });
    if (splitChords) {
      const withoutSlot = grooveLabRemoveHitsAtSlot(chordHits, slot);
      onChordHitsChange!([...withoutSlot, ...stack]);
    } else {
      const atSlot = hits.filter((h) => h.slot === slot);
      const bassMidi = atSlot.length > 0 ? Math.min(...atSlot.map((h) => h.midi)) : null;
      const withoutSlot = grooveLabRemoveHitsAtSlot(hits, slot);
      const next: GrooveRollHit[] = [...withoutSlot, ...stack];
      if (bassMidi != null) {
        const sus = snapGrooveSustain(slot, noteLengthSlots, quantize, barCount);
        next.push({
          slot,
          midi: grooveLabClampBassRootMidi(bassMidi),
          sustainSlots: sus,
          vel: 0.94,
        });
      }
      onHitsChange(next);
    }
    setEditSlot(slot);
    recordSlotRef.current = slot;
    previewOrchidChord();
    if (chordAutoAdvance) {
      const total = grooveLabTotalSlots(barCount);
      const next = (slot + grooveLabSlotsPerCell(quantize)) % total;
      setEditSlot(next);
      recordSlotRef.current = next;
    }
  }, [
    orchidSmartMatch,
    orchidRootMidi,
    keyRoot,
    mode,
    orchidType,
    orchidExtensions,
    orchidInversion,
    editSlot,
    quantize,
    barCount,
    noteLengthSlots,
    hits,
    chordHits,
    splitChords,
    onHitsChange,
    onChordHitsChange,
    previewOrchidChord,
    chordAutoAdvance,
  ]);

  const writeSpreadChordAtSlot = useCallback(
    (bassMidi: number, anchorSlot: number) => {
      const type = orchidSmartMatch
        ? diatonicOrchidTypeForRootPc(bassMidi % 12, keyRoot, mode)
        : orchidType;
      const chordNotes = buildOrchidNotesForBassRoot(bassMidi, type, orchidExtensions, orchidInversion);
      const slot = snapGrooveSlot(anchorSlot, quantize, barCount);
      if (splitChords) {
        const spread = grooveLabSpreadChordHits({
          anchorSlot: slot,
          chordMidis: chordNotes,
          sustainSlots: noteLengthSlots,
          quantize,
          barCount,
          bpm,
          perfMode: orchidPerfMode,
        }).filter((h) => !(h.slot === slot && h.midi === Math.round(bassMidi)));
        const withoutSlot = grooveLabRemoveHitsAtSlot(chordHits, slot);
        onChordHitsChange!([...withoutSlot, ...spread]);
        return slot;
      }
      const column = grooveLabWriteOrchidColumn({
        anchorSlot: slot,
        bassMidi,
        chordMidis: chordNotes,
        sustainSlots: noteLengthSlots,
        quantize,
        barCount,
        bpm,
        perfMode: orchidPerfMode,
      });
      const withoutSlot = grooveLabRemoveHitsAtSlot(hits, slot);
      onHitsChange([...withoutSlot, ...column]);
      return slot;
    },
    [
      orchidSmartMatch,
      keyRoot,
      mode,
      orchidType,
      orchidExtensions,
      orchidInversion,
      noteLengthSlots,
      quantize,
      barCount,
      bpm,
      orchidPerfMode,
      hits,
      chordHits,
      onHitsChange,
      onChordHitsChange,
      splitChords,
    ],
  );

  const recordBassToRoll = useCallback(
    (bassMidi: number) => {
      if (!orchidWriteToPianoRoll) return;
      const slot = placeBassAtSlot(bassMidi);
      if (!bassAutoAdvance) return;
      const total = grooveLabTotalSlots(barCount);
      const next = (slot + grooveLabSlotsPerCell(quantize)) % total;
      setEditSlot(next);
      recordSlotRef.current = next;
    },
    [orchidWriteToPianoRoll, placeBassAtSlot, bassAutoAdvance, barCount, quantize],
  );

  const chordHitsForComposer = useMemo(() => {
    if (splitChords) return chordHits;
    return hits.filter((h) => h.midi >= GROOVE_LAB_CHORD_ROLL_MIDI_MIN);
  }, [splitChords, chordHits, hits]);

  const subKeypadGuide: GrooveSubKeypadGuide = useMemo(() => {
    const harmony = grooveComposerHarmonyFromChordHits(chordHitsForComposer, {
      keyRoot,
      mode,
      referenceMidi: grooveLabClampBassRootMidi(orchidRootMidi),
    });
    if (harmony.columns.length === 0) {
      return { steps: [], suggestedKeyMidis: [] };
    }
    return grooveLabBuildSubKeypadGuide({
      harmony,
      keypadMidis: orchidBassKeys.map((k) => k.midi),
      seed: subGuideSeed,
      complexity: composerComplexity,
    });
  }, [
    chordHitsForComposer,
    keyRoot,
    mode,
    orchidRootMidi,
    orchidBassKeys,
    subGuideSeed,
    composerComplexity,
  ]);

  const stopSubKeypadAudition = useCallback(() => {
    subGuideAuditionStopRef.current?.();
    subGuideAuditionStopRef.current = null;
    setSubGuideAuditionMidi(null);
  }, []);

  const regenerateSubKeypadGuide = useCallback(() => {
    stopSubKeypadAudition();
    setSubGuideSeed((s) => s + 1);
  }, [stopSubKeypadAudition]);

  const auditionSubKeypadGuide = useCallback(() => {
    stopSubKeypadAudition();
    const steps = subKeypadGuide.steps;
    if (steps.length === 0) return;

    let cancelled = false;
    subGuideAuditionStopRef.current = () => {
      cancelled = true;
    };

    const beatSec = 60 / Math.max(40, bpm);
    const slotSec = beatSec / GROOVE_LAB_SLOTS_PER_BEAT;

    void (async () => {
      let prevSlot = steps[0]!.slot;
      for (let i = 0; i < steps.length; i++) {
        if (cancelled) return;
        const step = steps[i]!;
        setSubGuideAuditionMidi(step.keypadMidi);
        setOrchidRootMidi(step.keypadMidi);
        setOrchidBassMatchLabel(step.label);
        setEditSlot(step.slot);
        recordSlotRef.current = step.slot;
        if (!bassMuted) {
          runWithGrooveLabAudio(getAudioContext, (ctx, when) => {
            playGrooveLabBassSound(ctx, step.keypadMidi, bassSoundId, when, 0.92, bpm);
          });
        }
        if (i > 0) {
          const waitMs = Math.max(120, (step.slot - prevSlot) * slotSec * 1000);
          await new Promise((r) => setTimeout(r, waitMs));
          if (cancelled) return;
        }
        prevSlot = step.slot;
      }
      if (!cancelled) setSubGuideAuditionMidi(null);
    })();
  }, [
    stopSubKeypadAudition,
    subKeypadGuide.steps,
    bpm,
    bassMuted,
    getAudioContext,
    bassSoundId,
  ]);

  const applySubKeypadGuideToRoll = useCallback(() => {
    const generated = grooveLabSubGuideToRollHits(subKeypadGuide, quantize);
    if (generated.length === 0) return;
    onHitsChange(grooveComposerMergePart(hits, 'bass', generated));
    recordSlotRef.current = 0;
    setEditSlot(0);
  }, [subKeypadGuide, quantize, hits, onHitsChange]);

  useEffect(() => () => stopSubKeypadAudition(), [stopSubKeypadAudition]);

  const generateComposerPart = useCallback(
    (part: GrooveComposerPart) => {
      const harmony = grooveComposerHarmonyFromChordHits(chordHitsForComposer, {
        keyRoot,
        mode,
        referenceMidi: grooveLabClampBassRootMidi(orchidRootMidi),
      });
      if (harmony.columns.length === 0) return;
      const seed = grooveSeed + 1;
      setGrooveSeed(seed);
      const generated = generateGrooveComposerPart({
        part,
        harmony,
        barCount,
        quantize,
        keyRoot,
        mode,
        referenceMidi:
          part === 'bass'
            ? grooveLabClampBassRootMidi(orchidRootMidi)
            : GROOVE_LAB_MELODY_REFERENCE_MIDI,
        complexity: composerComplexity,
        seed,
      });
      if (part === 'bass') {
        onHitsChange(grooveComposerMergePart(hits, part, generated));
      } else if (splitMelody) {
        onMelodyHitsChange!(grooveComposerMergePart(melodyHits, part, generated));
      } else {
        onHitsChange(grooveComposerMergePart(hits, part, generated));
      }
      recordSlotRef.current = 0;
    },
    [
      chordHitsForComposer,
      keyRoot,
      mode,
      orchidRootMidi,
      grooveSeed,
      barCount,
      quantize,
      composerComplexity,
      hits,
      melodyHits,
      onHitsChange,
      onMelodyHitsChange,
      splitMelody,
    ],
  );

  const generateChordProgression = useCallback(() => {
    const columns = generateOrchidChordProgressionHits({
      progressionId: orchidProgressionId,
      keyRoot,
      mode,
      smartMatch: orchidSmartMatch,
      lockedType: orchidType,
      extensions: orchidExtensions,
      inversion: orchidInversion,
      barCount,
      quantize,
      sustainSlots: noteLengthSlots,
    });
    if (splitChords && onChordHitsChange) {
      onChordHitsChange(columns);
    } else {
      onHitsChange(columns);
    }
    recordSlotRef.current = 0;
    setEditSlot(0);
    setSubGuideSeed((s) => s + 1);
    previewOrchidChord();
  }, [
    orchidProgressionId,
    keyRoot,
    mode,
    orchidSmartMatch,
    orchidType,
    orchidExtensions,
    orchidInversion,
    barCount,
    quantize,
    noteLengthSlots,
    orchidRootMidi,
    splitChords,
    onChordHitsChange,
    onHitsChange,
    previewOrchidChord,
  ]);

  const chordAnchorOpts = useMemo(
    () => ({
      keyRoot,
      mode,
      referenceMidi: grooveLabClampBassRootMidi(orchidRootMidi),
    }),
    [keyRoot, mode, orchidRootMidi],
  );

  const melodyNoteCount = useMemo(
    () => (splitMelody ? melodyHits : hits).filter((h) => grooveLabIsMelodyMidi(h.midi)).length,
    [splitMelody, melodyHits, hits],
  );

  /** Light 808 sub keys for the current chord columns (does not write the roll). */
  const matchBassToChords = useCallback(() => {
    regenerateSubKeypadGuide();
  }, [regenerateSubKeypadGuide]);

  const lockChordsToGroove = useCallback((opts?: { forceSplit?: boolean }) => {
    const lockOpts = {
      getChordMidis: chordMidisForBass,
      sustainSlots: noteLengthSlots,
      quantize,
      barCount,
      bpm,
      perfMode: orchidPerfMode,
    };
    const useSplit = splitChords || (opts?.forceSplit === true && !!onChordHitsChange);
    if (useSplit && onChordHitsChange) {
      onChordHitsChange(grooveLabLockChordsToSeparateChannel(hits, chordHits, lockOpts));
      return;
    }
    onHitsChange(grooveLabLockOrchidChordsToBassline(hits, lockOpts));
  }, [
    hits,
    chordHits,
    onHitsChange,
    onChordHitsChange,
    splitChords,
    chordMidisForBass,
    noteLengthSlots,
    quantize,
    barCount,
    bpm,
    orchidPerfMode,
  ]);

  const bassAnchorCount = useMemo(() => grooveLabBassAnchorsFromHits(hits).length, [hits]);

  const chordAnchorCount = useMemo(() => {
    const source = splitChords ? chordHits : hits;
    return grooveLabChordAnchorsFromHits(source, chordAnchorOpts).length;
  }, [splitChords, chordHits, hits, chordAnchorOpts]);

  const spreadChordToRoll = useCallback(() => {
    const total = grooveLabTotalSlots(barCount);
    const rawSlot = snapGrooveSlot(editSlot, quantize, barCount);
    writeSpreadChordAtSlot(orchidRootMidi, rawSlot);
    const next = (rawSlot + grooveLabSlotsPerCell(quantize)) % total;
    setEditSlot(next);
    recordSlotRef.current = next;
  }, [barCount, quantize, orchidRootMidi, editSlot, writeSpreadChordAtSlot]);

  const deleteChordAtSlot = useCallback(
    (slot: number) => {
      if (splitChords) {
        onChordHitsChange!(grooveLabRemoveHitsAtSlot(chordHits, slot));
        return;
      }
      onHitsChange(grooveLabRemoveHitsAtSlot(hits, slot));
    },
    [hits, chordHits, onHitsChange, onChordHitsChange, splitChords],
  );

  const playLinkedChords = useCallback(
    (ctx: AudioContext, bassMidi: number, when: number, sustain: number) => {
      if (orchidLinkedChordsMuted || orchidLinkedChordVolume <= 0.02) return;
      const type = orchidSmartMatch
        ? diatonicOrchidTypeForRootPc(bassMidi % 12, keyRoot, mode)
        : orchidType;
      const chordNotes = buildOrchidNotesForBassRoot(bassMidi, type, orchidExtensions, orchidInversion);
      scheduleOrchidChord(
        ctx,
        chordNotes,
        when,
        sustain,
        chordVoice,
        orchidLinkedChordVolume * GROOVE_LAB_KEYPAD_CHORD_MIX_GAIN,
        {
          mode: orchidPerfMode,
          bpm,
        },
      );
    },
    [
      orchidLinkedChordsMuted,
      orchidLinkedChordVolume,
      orchidSmartMatch,
      keyRoot,
      mode,
      orchidType,
      orchidExtensions,
      orchidInversion,
      orchidPerfMode,
      bpm,
    ],
  );

  const setOrchidRootWithPreview = useCallback(
    (midi: number) => {
      setOrchidRootMidi(midi);
      previewOrchidChord(midi);
    },
    [previewOrchidChord],
  );

  const setOrchidTypeWithPreview = useCallback(
    (t: OrchidChordType) => {
      setOrchidType(t);
      previewOrchidChord();
    },
    [previewOrchidChord],
  );

  const setChordVoiceWithPreview = useCallback(
    (id: ChordVoiceId) => {
      setChordVoice(id);
      previewOrchidChord();
    },
    [previewOrchidChord],
  );

  const playOrchidBassKey = useCallback(
    (bassMidi: number) => {
      const type = orchidSmartMatch
        ? diatonicOrchidTypeForRootPc(bassMidi % 12, keyRoot, mode)
        : orchidType;
      setOrchidBassMatchLabel(formatOrchidChordName(bassMidi, type, orchidExtensions));
      setOrchidRootMidi(bassMidi);
      if (bassDrawNotes) {
        const step = grooveLabSlotsPerCell(quantize);
        const slot = placeBassAtSlot(bassMidi, editSlot, { sustainSlots: step });
        if (bassAutoAdvance) {
          const total = grooveLabTotalSlots(barCount);
          const next = (slot + step) % total;
          setEditSlot(next);
          recordSlotRef.current = next;
        }
      } else {
        recordBassToRoll(bassMidi);
      }

      if (bassMuted) return;

      runWithGrooveLabAudio(getAudioContext, (ctx, when) => {
        playGrooveLabBassSound(ctx, bassMidi, bassSoundId, when, 0.92, bpm);
      });
    },
    [
      bassMuted,
      orchidSmartMatch,
      keyRoot,
      mode,
      orchidType,
      orchidExtensions,
      orchidInversion,
      bassDrawNotes,
      bassAutoAdvance,
      placeBassAtSlot,
      editSlot,
      quantize,
      barCount,
      recordBassToRoll,
      getAudioContext,
      bassSoundId,
      bpm,
    ],
  );

  const orchidLinkedActive =
    !orchidLinkedChordsMuted && orchidLinkedChordVolume > 0.02;

  const rollChordType = useMemo(() => {
    if (!orchidSmartMatch) return orchidType;
    return diatonicOrchidTypeForRootPc(orchidRootMidi % 12, keyRoot, mode);
  }, [orchidSmartMatch, orchidRootMidi, keyRoot, mode, orchidType]);

  const orchidRollPreviewMidis = useMemo(() => {
    const bassRef = grooveLabClampBassRootMidi(orchidRootMidi);
    const raw = buildOrchidNotesForBassRoot(
      orchidRootMidi,
      rollChordType,
      orchidExtensions,
      orchidInversion,
    );
    return grooveLabLiftChordsAboveBass(bassRef, raw).map((m) =>
      grooveLabClampChordRollMidi(m, bassRef),
    );
  }, [orchidRootMidi, rollChordType, orchidExtensions, orchidInversion]);

  const orchidChordNotePreview = useMemo(() => {
    if (orchidRollPreviewMidis.length === 0) return '';
    return orchidRollPreviewMidis.map((m) => cbPianoMidiToNoteName(m)).join(' · ');
  }, [orchidRollPreviewMidis]);

  const rollChordNotes = useMemo(
    () =>
      orchidLinkedActive ? orchidRollPreviewMidis : [],
    [orchidLinkedActive, orchidRollPreviewMidis],
  );

  const rollMatchLabel = useMemo(
    () => formatOrchidChordName(orchidRootMidi, rollChordType, orchidExtensions),
    [orchidRootMidi, rollChordType, orchidExtensions],
  );

  return {
    keyRoot,
    setKeyRoot,
    mode,
    setMode,
    orchidType,
    setOrchidType,
    setOrchidTypeWithPreview,
    orchidExtensions,
    toggleOrchidExtension,
    orchidInversion,
    setOrchidInversion,
    orchidMaxInversion,
    orchidPerfMode,
    setOrchidPerfMode,
    orchidRootMidi,
    setOrchidRootMidi,
    setOrchidRootWithPreview,
    orchidSmartMatch,
    setOrchidSmartMatch,
    orchidLinkedChordVolume,
    setOrchidLinkedChordVolume,
    orchidLinkedChordsMuted,
    setOrchidLinkedChordsMuted,
    bassMuted,
    setBassMuted,
    orchidWriteToPianoRoll,
    setOrchidWriteToPianoRoll,
    chordVoice,
    setChordVoice,
    setChordVoiceWithPreview,
    diatonicRoots,
    orchidBassKeys,
    orchidLabel,
    orchidBassMatchLabel: orchidBassMatchLabel || orchidLabel,
    previewOrchidChord,
    playOrchidBassKey,
    bassSoundId,
    setBassSoundId,
    melodySoundId,
    setMelodySoundId,
    composerComplexity,
    setComposerComplexity,
    generateComposerPart,
    generateChordProgression,
    matchBassToChords,
    subKeypadGuide,
    subGuideAuditionMidi,
    regenerateSubKeypadGuide,
    auditionSubKeypadGuide,
    applySubKeypadGuideToRoll,
    stopSubKeypadAudition,
    melodyNoteCount,
    lockChordsToGroove,
    bassAnchorCount,
    chordAnchorCount,
    orchidProgressionId,
    setOrchidProgressionId,
    orchidProgressions: ORCHID_PROGRESSIONS,
    chordAutoAdvance,
    setChordAutoAdvance,
    editSlot,
    setEditSlot,
    placeBassAtSlot,
    bassAutoAdvance,
    setBassAutoAdvance,
    bassDrawNotes,
    setBassDrawNotes,
    bassKeypadPreviewMode,
    setBassKeypadPreviewMode,
    bassKeypadSoundLabel: grooveLabBassSoundDef(bassSoundId).label,
    bassKeypadChordVoiceLabel: CHORD_VOICE_MAP[chordVoice]?.label ?? chordVoice,
    spreadChordToRoll,
    writeOrchidChordAtEditSlot,
    deleteChordAtSlot,
    orchidLinkedActive,
    orchidChordNotePreview,
    orchidRollPreviewMidis,
    rollChordNotes,
    rollMatchLabel,
    bassRootMidi: orchidRootMidi,
    activeChannel,
  };
}
