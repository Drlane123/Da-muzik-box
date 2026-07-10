'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenoBassBtn, GenoBassLcd, GenoBassLcdValueBar, GenoBassSection, GENO_BASS_THEME } from '@/app/components/studio/genoBassWoodUi';
import {
  Se2SynthGenoLoopChordPianoRoll,
  type Se2SynthGenoLoopChordPianoRollEditState,
  type Se2SynthGenoLoopChordPianoRollHandle,
} from '@/app/components/studio/Se2SynthGenoLoopChordPianoRoll';
import { Se2SynthGenoLoopPianoRollEditToolbar } from '@/app/components/studio/Se2SynthGenoLoopPianoRollEditToolbar';
import {
  GENO_BASS_GROOVE_DEFAULT_ID,
  GENO_BASS_GROOVE_GROUPS,
  GENO_BASS_GROOVE_PRESETS,
  GENO_BASS_DEFAULT_GATE,
  GENO_BASS_DEFAULT_QUANTIZE,
  GENO_BASS_GROOVE_QUANTIZE_OPTIONS,
  GENO_BASS_LOOP_DEFAULT_ROOT,
  genoBassPresetBpm,
  genoBassPresetToRollNotes,
  genoBassSimilarRollNotes,
  type GenoBassGroovePreset,
  type GenoBassGrooveQuantize,
} from '@/app/lib/studio/genoBassGroovePresets';
import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';
import { GENO_BASS_SYNTH_PRESETS, genoBassPresetById } from '@/app/lib/studio/genoBassSynthPresets';
import {
  GENO_BASS_LOOP_BAR_LENGTHS,
  genoBassAudiblePreviewVoice,
  genoBassEditorRollNotesToTrackNotes,
  genoBassMidiNoteLabel,
  genoBassPianoRollKeyboardRange,
  type GenoBassLoopBarLength,
} from '@/app/lib/studio/genoBassLoopExport';
import {
  startGenoBassLoopPreview,
  stopGenoBassLoopPreview,
  getGenoBassLoopPreviewBeat,
} from '@/app/lib/studio/genoBassLoopPreview';
import { genoBassLockRollNotesToChordTimeline } from '@/app/lib/studio/genoBassChordRootSync';
import {
  isGenoUltraArpChordImportError,
  type GenoUltraArpChordImportResult,
} from '@/app/lib/studio/genoUltraArpChordImport';
import {
  genoUltraKeySourceTrackLabel,
  type GenoUltraArpKeySourceTrack,
} from '@/app/lib/studio/genoUltraArpKeySource';
import { resolveGenoUltraStripOutput } from '@/app/lib/studio/genoUltraSynthMeterBus';
import type { GenoUltraArpSe2RollNote } from '@/app/lib/studio/genoUltraArpExport';
import type { GenoUltraArpChordSegment } from '@/app/lib/studio/genoUltraArpState';
import type { GenoUltraSynthVoiceParams } from '@/app/lib/studio/genoUltraSynthTypes';
import { studioKeyLabel, type StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import {
  isGenoBassMidiImportError,
  parseGenoBassMidiFile,
} from '@/app/lib/studio/genoBassMidiImport';
import {
  resolveGenoBassGrooveSound,
  type GenoBassGrooveSoundMatch,
} from '@/app/lib/studio/genoBassGrooveSoundMatch';
import {
  getGenoBassSavedPattern,
  getGenoBassSavedSound,
  genoBassPatternIdFromUserGroovePresetId,
  genoBassUserGroovePresetId,
  genoBassUserGroovePresetsFromSaves,
  listGenoBassSavedPatternsOnly,
  listGenoBassSavedSoundAndPatterns,
  listGenoBassSavedSounds,
  saveGenoBassPattern,
  saveGenoBassSound,
  type GenoBassSavedPattern,
} from '@/app/lib/studio/genoBassUserSaves';

const BEATS_PER_BAR = 4;

function GenoBassGroovePresetDropUp({
  presets,
  value,
  disabled = false,
  onSelect,
}: {
  presets: readonly GenoBassGroovePreset[];
  value: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const displayPreset = presets.find((p) => p.id === value) ?? presets[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [presets]);

  if (!presets.length) return null;

  const currentIdx = Math.max(0, presets.findIndex((p) => p.id === value));
  const canCycle = presets.length > 1 && !disabled;

  const cyclePreset = (dir: -1 | 1) => {
    if (!canCycle) return;
    const nextIdx = (currentIdx + dir + presets.length) % presets.length;
    const next = presets[nextIdx];
    if (next) onSelect(next.id);
  };

  const arrowBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 22,
    padding: 0,
    flexShrink: 0,
    fontSize: 8,
    fontWeight: 800,
    borderRadius: 3,
    border: `1px solid ${GENO_BASS_THEME.border}`,
    background: GENO_BASS_THEME.panelInset,
    color: GENO_BASS_THEME.label,
    cursor: canCycle ? 'pointer' : 'default',
    opacity: canCycle ? 1 : 0.35,
  };

  const menuShell: React.CSSProperties = {
    position: 'absolute',
    bottom: 'calc(100% + 4px)',
    left: 0,
    zIndex: 260,
    minWidth: '100%',
    maxWidth: 280,
    maxHeight: 220,
    overflowY: 'auto',
    borderRadius: 4,
    border: `1px solid ${GENO_BASS_THEME.border}`,
    background: '#1c1c22',
    backgroundImage: `linear-gradient(180deg, #24242c 0%, #141418 55%, #0e0e12 100%)`,
    boxShadow:
      '0 -2px 0 0 #08080a, 0 -10px 28px rgba(0,0,0,0.92), 0 -22px 48px rgba(0,0,0,0.78), inset 0 1px 0 rgba(255,255,255,0.05)',
    isolation: 'isolate',
  };

  return (
    <div
      ref={rootRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        position: 'relative',
        flexShrink: 0,
        minWidth: 0,
        zIndex: open ? 250 : undefined,
      }}
    >
      <button
        type="button"
        disabled={!canCycle}
        aria-label="Previous groove pattern"
        title="Previous pattern"
        onClick={() => cyclePreset(-1)}
        style={arrowBtnStyle}
      >
        ◀
      </button>
      <div style={{ position: 'relative', flexShrink: 0, minWidth: 0 }}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={displayPreset ? `${displayPreset.genre} · ${displayPreset.label} · ${displayPreset.bpm} BPM` : 'Choose groove pattern'}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 22,
          minWidth: 148,
          maxWidth: 240,
          padding: '0 8px',
          fontSize: 8,
          fontWeight: 700,
          borderRadius: 3,
          border: `1px solid ${open ? GENO_BASS_THEME.amberHi : GENO_BASS_THEME.border}`,
          background: open
            ? `linear-gradient(180deg, ${GENO_BASS_THEME.panelHi}, ${GENO_BASS_THEME.panelInset})`
            : GENO_BASS_THEME.panelInset,
          color: GENO_BASS_THEME.lcdText,
          boxShadow: open ? `0 0 10px ${GENO_BASS_THEME.amberGlow}` : 'none',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayPreset?.label ?? 'Pattern'}
        </span>
        <span style={{ fontSize: 7, color: GENO_BASS_THEME.labelDim, flexShrink: 0 }} aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open ? (
        <div role="listbox" aria-label="Groove patterns" style={menuShell}>
          {presets.map((p) => {
            const active = p.id === value;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={active}
                title={`${p.genre} · ${p.bpm} BPM`}
                onClick={() => {
                  onSelect(p.id);
                  setOpen(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '5px 8px',
                  fontSize: 8,
                  fontWeight: active ? 800 : 600,
                  border: 'none',
                  borderBottom: `1px solid ${GENO_BASS_THEME.border}`,
                  background: active
                    ? `linear-gradient(90deg, rgba(240,160,32,0.2), #1a1a20)`
                    : '#1a1a20',
                  color: active ? GENO_BASS_THEME.amberHi : GENO_BASS_THEME.label,
                  cursor: 'pointer',
                }}
              >
                {p.label}
                <span style={{ marginLeft: 6, fontSize: 7, color: GENO_BASS_THEME.labelDim, fontWeight: 600 }}>
                  {p.genre} · {p.bpm}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      </div>
      <button
        type="button"
        disabled={!canCycle}
        aria-label="Next groove pattern"
        title="Next pattern"
        onClick={() => cyclePreset(1)}
        style={arrowBtnStyle}
      >
        ▶
      </button>
    </div>
  );
}

function GenoBassGrooveQuantSelect({
  value,
  disabled = false,
  onChange,
}: {
  value: GenoBassGrooveQuantize;
  disabled?: boolean;
  onChange: (quant: GenoBassGrooveQuantize) => void;
}) {
  const active = GENO_BASS_GROOVE_QUANTIZE_OPTIONS.find((q) => q.id === value);
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span style={{ fontSize: 7, fontWeight: 800, color: GENO_BASS_THEME.labelDim, letterSpacing: '0.08em' }}>
        GRID
      </span>
      <select
        value={value}
        disabled={disabled}
        title={active?.hint ?? 'Pattern grid — 1/8 slower · 1/32 faster'}
        onChange={(e) => onChange(e.target.value as GenoBassGrooveQuantize)}
        style={{
          height: 22,
          minWidth: 52,
          padding: '0 6px',
          fontSize: 8,
          fontWeight: 700,
          borderRadius: 3,
          border: `1px solid ${GENO_BASS_THEME.border}`,
          background: GENO_BASS_THEME.panelInset,
          color: GENO_BASS_THEME.lcdText,
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        {GENO_BASS_GROOVE_QUANTIZE_OPTIONS.map((q) => (
          <option key={q.id} value={q.id}>
            {q.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export type GenoBassLoopPanelProps = {
  /** Tab-embedded layout — fills parent, no outer section chrome. */
  embedded?: boolean;
  /** Groove tab — tall roll area; preset/length hug the keyboard wood edge. */
  grooveTallRoll?: boolean;
  disabled?: boolean;
  bpm?: number;
  beatsPerBar?: number;
  songKeyRoot?: number;
  songKeyMode?: StudioDetectedKeyMode;
  voice: GenoUltraSynthVoiceParams;
  basePitch?: number;
  getStripOutput?: (ctx: AudioContext) => AudioNode;
  ensureAudioContext?: () => Promise<AudioContext>;
  onApplyToPianoRoll?: (notes: GenoUltraArpSe2RollNote[]) => void;
  se2TransportPlaying?: boolean;
  getSe2PlayheadBeat?: () => number;
  getSe2TransportOriginBeat?: () => number;
  keySourceTracks?: readonly GenoUltraArpKeySourceTrack[];
  keySourceTrackIndex?: number;
  onKeySourceTrackIndexChange?: (trackIndex: number) => void;
  onDetectKeyFromSourceTrack?: (trackIndex: number) => boolean | void;
  getSe2TrackChordImport?: (
    trackIndex: number,
    barLength: GenoBassLoopBarLength,
  ) => GenoUltraArpChordImportResult | { message: string };
  getSe2TrackMidiImport?: (
    trackIndex: number,
  ) => import('@/app/lib/studio/genoBassMidiImport').GenoBassMidiImportResult | { message: string };
  followSourceTrackChords?: boolean;
  onPresetBpmChange?: (bpm: number) => void;
  /** Loads groove-matched synth tone (preset + filter / FX tweaks for pattern type). */
  onSoundPresetChange?: (match: GenoBassGrooveSoundMatch) => void;
  /** Groove / one-shot loop preview running — drives scope motion. */
  onSeqActiveChange?: (active: boolean) => void;
  /** Geno Bass synth bank preset id (for user saves). */
  soundPresetId?: string;
  patchLabel?: string;
  /** Recall a saved sound or pattern voice into the parent panel. */
  onApplySavedVoice?: (
    voice: GenoUltraSynthVoiceParams,
    soundPresetId: string,
    patchLabel: string,
  ) => void;
  previewHeldPitch?: number | null;
  onPianoKeyPreview?: (pitch: number) => void;
  onPianoKeyRelease?: () => void;
};

export function GenoBassLoopPanel({
  embedded = false,
  grooveTallRoll = false,
  disabled = false,
  bpm = 120,
  beatsPerBar = BEATS_PER_BAR,
  songKeyRoot = 0,
  songKeyMode = 'major',
  voice,
  basePitch = GENO_BASS_LOOP_DEFAULT_ROOT,
  getStripOutput,
  ensureAudioContext,
  onApplyToPianoRoll,
  se2TransportPlaying = false,
  getSe2PlayheadBeat,
  getSe2TransportOriginBeat,
  keySourceTracks = [],
  keySourceTrackIndex = 0,
  onKeySourceTrackIndexChange,
  onDetectKeyFromSourceTrack,
  getSe2TrackChordImport,
  getSe2TrackMidiImport,
  followSourceTrackChords: followSourceTrackChordsProp = true,
  onPresetBpmChange,
  onSoundPresetChange,
  onSeqActiveChange,
  soundPresetId = '',
  patchLabel = '',
  onApplySavedVoice,
  previewHeldPitch = null,
  onPianoKeyPreview,
  onPianoKeyRelease,
}: GenoBassLoopPanelProps) {
  const [barLength, setBarLength] = useState<GenoBassLoopBarLength>(4);
  const [presetId, setPresetId] = useState(GENO_BASS_GROOVE_DEFAULT_ID);
  const [presetGroup, setPresetGroup] = useState<'808' | 'synth' | 'funk' | 'pop' | 'hits' | 'rnb' | 'electro' | 'my'>('rnb');
  const [grooveBpm, setGrooveBpm] = useState(() => genoBassPresetBpm(GENO_BASS_GROOVE_DEFAULT_ID));
  const [gate, setGate] = useState(GENO_BASS_DEFAULT_GATE);
  const [grooveQuantize, setGrooveQuantize] = useState<GenoBassGrooveQuantize>(GENO_BASS_DEFAULT_QUANTIZE);
  const [templateNotes, setTemplateNotes] = useState<StudioEditor2GenNote[]>(() =>
    genoBassPresetToRollNotes({
      presetId: GENO_BASS_GROOVE_DEFAULT_ID,
      barLength: 4,
      rootMidi: GENO_BASS_LOOP_DEFAULT_ROOT,
      gate: GENO_BASS_DEFAULT_GATE,
      quantize: GENO_BASS_DEFAULT_QUANTIZE,
    }),
  );
  const [chordTimeline, setChordTimeline] = useState<GenoUltraArpChordSegment[] | null>(null);
  const [chordTotalBeats, setChordTotalBeats] = useState(16);
  const [chordKeyRoot, setChordKeyRoot] = useState(songKeyRoot);
  const [chordKeyMode, setChordKeyMode] = useState<StudioDetectedKeyMode>(songKeyMode);
  const [chordLocked, setChordLocked] = useState(false);
  const [syncHint, setSyncHint] = useState('');
  const [loopOn, setLoopOn] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [se2SyncLocked, setSe2SyncLocked] = useState(false);
  const [followSourceTrackChords, setFollowSourceTrackChords] = useState(followSourceTrackChordsProp);
  const [previewBeat, setPreviewBeat] = useState<number | null>(null);
  const [randSeed, setRandSeed] = useState(() => Math.floor(Math.random() * 99999));
  const [rollEdit, setRollEdit] = useState<Se2SynthGenoLoopChordPianoRollEditState>({
    hasSelection: false,
    canUndo: false,
  });
  const [userSaveRev, setUserSaveRev] = useState(0);
  const [loadUserSaveId, setLoadUserSaveId] = useState('');
  const [saveDialogMode, setSaveDialogMode] = useState<'sound' | 'pattern' | 'soundAndPattern' | null>(null);
  const [saveNameDraft, setSaveNameDraft] = useState('');
  const saveNameInputRef = useRef<HTMLInputElement>(null);

  const pianoRollRef = useRef<Se2SynthGenoLoopChordPianoRollHandle>(null);
  const midiImportFileRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const templateNotesRef = useRef(templateNotes);
  templateNotesRef.current = templateNotes;
  const chordTimelineRef = useRef(chordTimeline);
  chordTimelineRef.current = chordTimeline;
  const chordLockedRef = useRef(chordLocked);
  chordLockedRef.current = chordLocked;
  const getSe2TrackChordImportRef = useRef(getSe2TrackChordImport);
  getSe2TrackChordImportRef.current = getSe2TrackChordImport;
  const getSe2TrackMidiImportRef = useRef(getSe2TrackMidiImport);
  getSe2TrackMidiImportRef.current = getSe2TrackMidiImport;
  const followSourceTrackChordsRef = useRef(followSourceTrackChords);
  followSourceTrackChordsRef.current = followSourceTrackChords;
  const getSe2PlayheadBeatRef = useRef(getSe2PlayheadBeat);
  getSe2PlayheadBeatRef.current = getSe2PlayheadBeat;
  const getSe2TransportOriginBeatRef = useRef(getSe2TransportOriginBeat);
  getSe2TransportOriginBeatRef.current = getSe2TransportOriginBeat;
  const barLengthRef = useRef(barLength);
  barLengthRef.current = barLength;
  const gateRef = useRef(gate);
  gateRef.current = gate;
  const grooveQuantizeRef = useRef(grooveQuantize);
  grooveQuantizeRef.current = grooveQuantize;
  const basePitchRef = useRef(basePitch);
  basePitchRef.current = basePitch;
  const prevRootRef = useRef(basePitch);
  const getStripOutputRef = useRef(getStripOutput);
  getStripOutputRef.current = getStripOutput;
  const onPresetBpmChangeRef = useRef(onPresetBpmChange);
  onPresetBpmChangeRef.current = onPresetBpmChange;
  const onSoundPresetChangeRef = useRef(onSoundPresetChange);
  onSoundPresetChangeRef.current = onSoundPresetChange;
  const onApplySavedVoiceRef = useRef(onApplySavedVoice);
  onApplySavedVoiceRef.current = onApplySavedVoice;
  const soundPresetIdRef = useRef(soundPresetId);
  soundPresetIdRef.current = soundPresetId;
  const patchLabelRef = useRef(patchLabel);
  patchLabelRef.current = patchLabel;
  const se2SyncLockedRef = useRef(se2SyncLocked);
  se2SyncLockedRef.current = se2SyncLocked;

  const activePreset = GENO_BASS_GROOVE_PRESETS.find((p) => p.id === presetId);
  const linkedSoundLabel = useMemo(() => {
    if (!activePreset) return null;
    const sid = resolveGenoBassGrooveSound(activePreset).soundPresetId;
    return GENO_BASS_SYNTH_PRESETS.find((p) => p.id === sid)?.label ?? null;
  }, [activePreset]);
  const presetBpm = activePreset?.bpm ?? genoBassPresetBpm(presetId);
  const previewBpm = se2SyncLocked ? bpm : grooveBpm;
  const previewBpmRef = useRef(previewBpm);
  previewBpmRef.current = previewBpm;

  useEffect(() => {
    setFollowSourceTrackChords(followSourceTrackChordsProp);
  }, [followSourceTrackChordsProp]);

  useEffect(() => {
    if (chordLockedRef.current && chordTimelineRef.current?.length) return;
    setChordKeyRoot(songKeyRoot);
    setChordKeyMode(songKeyMode);
  }, [songKeyRoot, songKeyMode]);

  const effectiveNotes = useMemo(() => {
    if (!chordLocked || !chordTimeline?.length) return templateNotes;
    return genoBassLockRollNotesToChordTimeline(
      templateNotes,
      basePitch,
      chordTimeline,
      chordTotalBeats,
      chordKeyRoot,
      chordKeyMode,
    );
  }, [basePitch, chordKeyMode, chordKeyRoot, chordLocked, chordTimeline, chordTotalBeats, templateNotes]);

  const rollSig = useMemo(
    () => effectiveNotes.map((n) => `${n.startBeat}:${n.pitch}:${n.durationBeats}:${n.velocity}`).join('|'),
    [effectiveNotes],
  );

  const loopDrive = se2SyncLocked ? se2TransportPlaying : loopOn;

  const savedSounds = useMemo(() => listGenoBassSavedSounds(), [userSaveRev]);
  const savedPatternsOnly = useMemo(() => listGenoBassSavedPatternsOnly(), [userSaveRev]);
  const savedSoundAndPatterns = useMemo(() => listGenoBassSavedSoundAndPatterns(), [userSaveRev]);

  const groupPresets = useMemo(() => {
    if (presetGroup === 'my') {
      return genoBassUserGroovePresetsFromSaves(savedSoundAndPatterns);
    }
    const items = GENO_BASS_GROOVE_PRESETS.filter((p) => p.group === presetGroup);
    if (presetGroup !== 'synth') return items;
    const isIconic = (id: string) => id.startsWith('ek-kingdom') || id.startsWith('pp-risk');
    const iconic = items.filter((p) => isIconic(p.id));
    const rest = items.filter((p) => !isIconic(p.id));
    return [...iconic, ...rest];
  }, [presetGroup, savedSoundAndPatterns]);

  const rollKeyboardRange = useMemo(
    () => genoBassPianoRollKeyboardRange(basePitch),
    [basePitch],
  );

  const stableStripOutput = useCallback((ctx: AudioContext) => {
    const raw = getStripOutputRef.current?.(ctx) ?? ctx.destination;
    return resolveGenoUltraStripOutput(ctx, raw);
  }, []);

  const applyPresetTempo = useCallback((id: string) => {
    if (se2SyncLockedRef.current) return;
    setGrooveBpm(genoBassPresetBpm(id));
  }, []);

  const handleGrooveBpmChange = useCallback((next: number) => {
    setGrooveBpm(clampGrooveLabBpm(next));
  }, []);

  const fillFromPreset = useCallback(
    (id: string, seed?: number, barsOverride?: GenoBassLoopBarLength, mutate = false) => {
      const preset = GENO_BASS_GROOVE_PRESETS.find((p) => p.id === id);
      const nextGate = preset?.defaultGate ?? gateRef.current;
      if (preset?.defaultGate != null) {
        setGate(preset.defaultGate);
        gateRef.current = preset.defaultGate;
      }
      const notes = genoBassPresetToRollNotes({
        presetId: id,
        barLength: barsOverride ?? barLengthRef.current,
        rootMidi: basePitchRef.current,
        gate: nextGate,
        seed: seed ?? randSeed,
        quantize: grooveQuantizeRef.current,
        keyMode: chordKeyMode,
        mutate,
      });
      setPresetId(id);
      setTemplateNotes(notes);
      applyPresetTempo(id);
      if (preset) {
        onSoundPresetChangeRef.current?.(resolveGenoBassGrooveSound(preset));
      }
    },
    [applyPresetTempo, chordKeyMode, randSeed],
  );

  useEffect(() => {
    applyPresetTempo(GENO_BASS_GROOVE_DEFAULT_ID);
    const preset = GENO_BASS_GROOVE_PRESETS.find((p) => p.id === GENO_BASS_GROOVE_DEFAULT_ID);
    if (preset) {
      onSoundPresetChangeRef.current?.(resolveGenoBassGrooveSound(preset));
    }
  }, [applyPresetTempo]);

  const applyChordImport = useCallback((result: GenoUltraArpChordImportResult) => {
    setChordTimeline(result.chordTimeline.map((s) => ({ ...s, pitches: [...s.pitches] })));
    setChordTotalBeats(result.totalPatternBeats);
    setChordKeyRoot(result.keyRoot);
    setChordKeyMode(result.keyMode);
    setSyncHint(
      `${result.chordTimeline.length} chords · ${result.bpm.toFixed(0)} BPM · ${studioKeyLabel(result.keyRoot, result.keyMode)}`,
    );
  }, []);

  const followChordsFromSourceTrack = useCallback(
    (trackIndex: number, barsOverride?: GenoBassLoopBarLength) => {
      const fn = getSe2TrackChordImportRef.current;
      if (!fn) return false;
      const src = keySourceTracks.find((t) => t.trackIndex === trackIndex);
      if (src && src.canFollowChords === false) {
        setSyncHint(`${genoUltraKeySourceTrackLabel(src)} — no chord data on that lane`);
        return false;
      }
      const result = fn(trackIndex, barsOverride ?? barLengthRef.current);
      if (isGenoUltraArpChordImportError(result)) {
        setSyncHint(result.message);
        return false;
      }
      applyChordImport(result);
      onDetectKeyFromSourceTrack?.(trackIndex);
      return true;
    },
    [applyChordImport, keySourceTracks, onDetectKeyFromSourceTrack],
  );

  useEffect(() => {
    if (!followSourceTrackChordsRef.current || !getSe2TrackChordImportRef.current) return;
    followChordsFromSourceTrack(keySourceTrackIndex);
  }, [keySourceTrackIndex, followChordsFromSourceTrack]);

  useEffect(() => {
    if (!followSourceTrackChordsRef.current || !chordLockedRef.current) return;
    followChordsFromSourceTrack(keySourceTrackIndex, barLength);
  }, [barLength, keySourceTrackIndex, followChordsFromSourceTrack]);

  const runPreview = useCallback(
    (opts: { loop: boolean; onComplete?: () => void }) => {
      const ensure = ensureAudioContext;
      if (!ensure || !getStripOutputRef.current) return;
      void (async () => {
        const ctx = await ensure();
        if (!ctx || ctx.state === 'closed') return;
        if (ctx.state === 'suspended') {
          try {
            await ctx.resume();
          } catch {
            /* autoplay */
          }
        }
        startGenoBassLoopPreview({
          ctx,
          getStripOutput: () => stableStripOutput(ctx),
          getVoice: () =>
            genoBassAudiblePreviewVoice(
              voiceRef.current,
              genoBassPresetById(soundPresetId).bassGroup,
            ),
          getRollNotes: () => {
            const notes = templateNotesRef.current;
            const timeline = chordTimelineRef.current;
            if (chordLockedRef.current && timeline?.length) {
              return genoBassLockRollNotesToChordTimeline(
                notes,
                basePitchRef.current,
                timeline,
                chordTotalBeats,
                chordKeyRoot,
                chordKeyMode,
              );
            }
            return notes;
          },
          barLength: barLengthRef.current,
          bpm: previewBpmRef.current,
          getBpm: () => previewBpmRef.current,
          getBarLength: () => barLengthRef.current,
          loop: opts.loop,
          getTransportPatternBeat: se2SyncLocked
            ? () => {
                const playhead = getSe2PlayheadBeatRef.current?.() ?? 0;
                const origin = getSe2TransportOriginBeatRef.current?.() ?? 0;
                const patternBeats = barLengthRef.current * beatsPerBar;
                const elapsed = playhead - origin;
                return ((elapsed % patternBeats) + patternBeats) % patternBeats;
              }
            : undefined,
          onComplete: opts.onComplete,
        });
      })();
    },
    [beatsPerBar, chordKeyMode, chordKeyRoot, chordTotalBeats, ensureAudioContext, previewBpm, se2SyncLocked, stableStripOutput],
  );

  const generatePattern = useCallback(() => {
    const next = randSeed + 1;
    setRandSeed(next);
    fillFromPreset(presetId, next, undefined, true);
  }, [fillFromPreset, presetId, randSeed]);

  const createSimilar = useCallback(() => {
    const next = randSeed + 1;
    setRandSeed(next);
    setTemplateNotes((prev) => genoBassSimilarRollNotes(prev, next, barLengthRef.current));
  }, [randSeed]);

  useEffect(() => {
    if (prevRootRef.current === basePitch) return;
    prevRootRef.current = basePitch;
    fillFromPreset(presetId, randSeed);
  }, [basePitch, fillFromPreset, presetId, randSeed]);

  const regenGate = useCallback(() => {
    fillFromPreset(presetId, randSeed);
  }, [fillFromPreset, presetId, randSeed]);

  const applyMidiImportResult = useCallback(
    (result: import('@/app/lib/studio/genoBassMidiImport').GenoBassMidiImportResult) => {
      setBarLength(result.barLength);
      barLengthRef.current = result.barLength;
      setTemplateNotes(result.notes);
      setSyncHint(
        `✓ Imported ${result.noteCount} bass notes · ${result.barLength} bars · ${result.bpm} BPM · ${result.fileName}`,
      );
      if (!se2SyncLockedRef.current) {
        setGrooveBpm(clampGrooveLabBpm(result.bpm));
      }
    },
    [],
  );

  const importMidiBassline = useCallback(
    async (file: File) => {
      try {
        const data = await file.arrayBuffer();
        const result = parseGenoBassMidiFile(data, file.name);
        if (isGenoBassMidiImportError(result)) {
          setSyncHint(result.message);
          return;
        }
        applyMidiImportResult(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setSyncHint(msg || 'Could not import MIDI file.');
      }
    },
    [applyMidiImportResult],
  );

  const importMidiFromSe2Track = useCallback(() => {
    const fn = getSe2TrackMidiImportRef.current;
    if (!fn) {
      setSyncHint('SE2 track import is not available.');
      return;
    }
    const src = keySourceTracks.find((t) => t.trackIndex === keySourceTrackIndex);
    const result = fn(keySourceTrackIndex);
    if (isGenoBassMidiImportError(result)) {
      setSyncHint(result.message);
      return;
    }
    applyMidiImportResult(result);
    if (src) {
      setSyncHint(
        `✓ Imported ${result.noteCount} bass notes · ${result.barLength} bars · ${result.bpm} BPM · ${genoUltraKeySourceTrackLabel(src)}`,
      );
    }
  }, [applyMidiImportResult, keySourceTrackIndex, keySourceTracks]);

  const applyToRoll = useCallback(() => {
    if (!effectiveNotes.length) return;
    onApplyToPianoRoll?.(genoBassEditorRollNotesToTrackNotes(effectiveNotes));
  }, [effectiveNotes, onApplyToPianoRoll]);

  const applySavedVoice = useCallback((v: GenoUltraSynthVoiceParams, sid: string, label: string) => {
    onApplySavedVoiceRef.current?.(v, sid, label);
  }, []);

  const applySavedPattern = useCallback(
    (saved: GenoBassSavedPattern | undefined, opts?: { selectInMyGrooves?: boolean }) => {
      if (!saved) {
        setSyncHint('Saved pattern not found');
        return;
      }
      setTemplateNotes(saved.templateNotes.map((n) => ({ ...n })));
      setBarLength(saved.barLength);
      if (!saved.patternOnly) {
        setPresetId(genoBassUserGroovePresetId(saved.id));
        setPresetGroup('my');
      } else {
        setPresetId(saved.presetId);
        setPresetGroup(saved.presetGroup);
      }
      setGate(saved.gate);
      gateRef.current = saved.gate;
      setGrooveQuantize(saved.grooveQuantize);
      grooveQuantizeRef.current = saved.grooveQuantize;
      setChordLocked(saved.chordLocked);
      chordLockedRef.current = saved.chordLocked;
      setChordTimeline(
        saved.chordTimeline?.length
          ? saved.chordTimeline.map((s) => ({ ...s, pitches: [...s.pitches] }))
          : null,
      );
      setChordTotalBeats(saved.chordTotalBeats);
      setChordKeyRoot(saved.chordKeyRoot);
      setChordKeyMode(saved.chordKeyMode);
      setRandSeed(saved.randSeed);
      if (!saved.patternOnly) {
        applySavedVoice(saved.voice, saved.soundPresetId, saved.patchLabel);
      }
      if (opts?.selectInMyGrooves && !saved.patternOnly) {
        setPresetGroup('my');
        setPresetId(genoBassUserGroovePresetId(saved.id));
      }
      setSyncHint(
        saved.patternOnly
          ? `✓ Loaded pattern only · ${saved.name}`
          : `✓ Loaded sound + pattern · ${saved.name}`,
      );
    },
    [applySavedVoice],
  );

  const buildPatternSavePayload = useCallback(
    () => ({
      voice: voiceRef.current,
      soundPresetId: soundPresetIdRef.current,
      patchLabel: patchLabelRef.current || voiceRef.current.label,
      templateNotes: templateNotesRef.current.map((n) => ({ ...n })),
      barLength: barLengthRef.current,
      presetId,
      presetGroup,
      gate: gateRef.current,
      grooveQuantize: grooveQuantizeRef.current,
      basePitch: basePitchRef.current,
      chordLocked: chordLockedRef.current,
      chordTimeline: chordTimelineRef.current?.length
        ? chordTimelineRef.current.map((s) => ({ ...s, pitches: [...s.pitches] }))
        : null,
      chordTotalBeats,
      chordKeyRoot,
      chordKeyMode,
      randSeed,
    }),
    [chordKeyMode, chordKeyRoot, chordTotalBeats, presetGroup, presetId, randSeed],
  );

  const selectGroovePreset = useCallback(
    (id: string, seed?: number) => {
      const userPatternId = genoBassPatternIdFromUserGroovePresetId(id);
      if (userPatternId) {
        applySavedPattern(getGenoBassSavedPattern(userPatternId), { selectInMyGrooves: true });
        return;
      }
      fillFromPreset(id, seed);
    },
    [applySavedPattern, fillFromPreset],
  );

  const openSaveDialog = useCallback(
    (mode: 'sound' | 'pattern' | 'soundAndPattern') => {
      const seed =
        mode === 'sound'
          ? (patchLabelRef.current || voiceRef.current.label || 'My Bass Sound').trim().slice(0, 48)
          : (patchLabelRef.current || activePreset?.label || (mode === 'pattern' ? 'My Bass Pattern' : 'My Bass Groove'))
              .trim()
              .slice(0, 48);
      setSaveNameDraft(seed || (mode === 'sound' ? 'My Bass Sound' : mode === 'pattern' ? 'My Bass Pattern' : 'My Bass Groove'));
      setSaveDialogMode(mode);
      queueMicrotask(() => {
        const el = saveNameInputRef.current;
        if (!el) return;
        el.focus();
        el.select();
      });
    },
    [activePreset?.label],
  );

  const cancelSaveDialog = useCallback(() => {
    setSaveDialogMode(null);
  }, []);

  const confirmSaveDialog = useCallback(() => {
    if (!saveDialogMode) return;
    const name =
      saveNameDraft.trim().slice(0, 48) ||
      (saveDialogMode === 'sound'
        ? 'My Bass Sound'
        : saveDialogMode === 'pattern'
          ? 'My Bass Pattern'
          : 'My Bass Groove');

    if (saveDialogMode === 'sound') {
      const entry = saveGenoBassSound(
        name,
        voiceRef.current,
        soundPresetIdRef.current,
        patchLabelRef.current || voiceRef.current.label,
      );
      setUserSaveRev((n) => n + 1);
      setSyncHint(`✓ Saved sound · ${entry.name} · Sounds only`);
    } else if (saveDialogMode === 'pattern') {
      if (!templateNotesRef.current.length) {
        setSyncHint('Add notes to the groove roll before saving a pattern');
        return;
      }
      const entry = saveGenoBassPattern(name, {
        ...buildPatternSavePayload(),
        patternOnly: true,
      });
      setUserSaveRev((n) => n + 1);
      setSyncHint(`✓ Saved pattern only · ${entry.name} · Patterns only`);
    } else {
      if (!templateNotesRef.current.length) {
        setSyncHint('Add notes to the groove roll before saving sound + pattern');
        return;
      }
      const entry = saveGenoBassPattern(name, {
        ...buildPatternSavePayload(),
        patternOnly: false,
      });
      setUserSaveRev((n) => n + 1);
      setPresetGroup('my');
      setPresetId(genoBassUserGroovePresetId(entry.id));
      setSyncHint(`✓ Saved sound + pattern · ${entry.name} · My Grooves`);
    }
    setSaveDialogMode(null);
  }, [buildPatternSavePayload, saveDialogMode, saveNameDraft]);

  const handleSaveSound = useCallback(() => {
    openSaveDialog('sound');
  }, [openSaveDialog]);

  const handleSavePattern = useCallback(() => {
    if (!templateNotesRef.current.length) {
      setSyncHint('Add notes to the groove roll before saving a pattern');
      return;
    }
    openSaveDialog('pattern');
  }, [openSaveDialog]);

  const handleSaveSoundAndPattern = useCallback(() => {
    if (!templateNotesRef.current.length) {
      setSyncHint('Add notes to the groove roll before saving sound + pattern');
      return;
    }
    openSaveDialog('soundAndPattern');
  }, [openSaveDialog]);

  const handleLoadUserSave = useCallback(
    (token: string) => {
      setLoadUserSaveId(token);
      if (!token) return;
      if (token.startsWith('sound:')) {
        const sound = getGenoBassSavedSound(token.slice(6));
        if (!sound) {
          setSyncHint('Saved sound not found');
          return;
        }
        applySavedVoice(sound.voice, sound.soundPresetId, sound.patchLabel);
        setSyncHint(`✓ Loaded sound · ${sound.name}`);
      } else if (token.startsWith('pattern:')) {
        applySavedPattern(getGenoBassSavedPattern(token.slice(8)));
      }
      queueMicrotask(() => setLoadUserSaveId(''));
    },
    [applySavedPattern, applySavedVoice],
  );

  const previewOnce = useCallback(() => {
    setLoopOn(false);
    stopGenoBassLoopPreview();
    setPreviewing(true);
  }, []);

  useEffect(() => {
    if (!loopDrive && !previewing) {
      stopGenoBassLoopPreview();
      setPreviewBeat(null);
      return;
    }
    if (!ensureAudioContext || !getStripOutputRef.current) return;
    stopGenoBassLoopPreview();
    if (loopDrive) {
      runPreview({ loop: true });
    } else {
      runPreview({
        loop: false,
        onComplete: () => {
          setPreviewing(false);
          setPreviewBeat(null);
        },
      });
    }
    return () => {
      stopGenoBassLoopPreview();
      setPreviewBeat(null);
    };
  }, [bpm, ensureAudioContext, loopDrive, previewBpm, previewing, runPreview, rollSig]);

  useEffect(() => () => stopGenoBassLoopPreview(), []);

  const seqActive = loopDrive || previewing;

  useEffect(() => {
    onSeqActiveChange?.(seqActive);
  }, [seqActive, onSeqActiveChange]);

  useEffect(() => {
    if (!seqActive) {
      setPreviewBeat(null);
      return;
    }
    let raf = 0;
    const tick = () => {
      const beat = getGenoBassLoopPreviewBeat();
      if (beat != null) setPreviewBeat(beat);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seqActive]);

  const onBarLengthChange = useCallback(
    (bars: GenoBassLoopBarLength) => {
      setBarLength(bars);
      fillFromPreset(presetId, randSeed, bars);
    },
    [fillFromPreset, presetId, randSeed],
  );

  const body = (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: grooveTallRoll ? 4 : embedded ? 6 : 8,
          height: embedded || grooveTallRoll ? '100%' : undefined,
          minHeight: embedded || grooveTallRoll ? 0 : undefined,
          position: grooveTallRoll ? 'relative' : undefined,
          zIndex: grooveTallRoll ? 1 : undefined,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <GenoBassBtn
            small
            active={previewing}
            disabled={disabled}
            onClick={previewOnce}
            title="Play one groove cycle — listen before applying to track"
          >
            ▶ PREVIEW
          </GenoBassBtn>
          {GENO_BASS_LOOP_BAR_LENGTHS.map((bars) => (
            <GenoBassBtn
              key={bars}
              small
              active={barLength === bars}
              disabled={disabled}
              onClick={() => onBarLengthChange(bars)}
            >
              {bars} BAR
            </GenoBassBtn>
          ))}
          <span style={{ width: 1, height: 16, background: GENO_BASS_THEME.border, margin: '0 2px' }} />
          <GenoBassBtn small disabled={disabled} onClick={generatePattern} title="Regenerate groove variation">
            GEN
          </GenoBassBtn>
          <GenoBassBtn
            small
            disabled={disabled || !templateNotes.length}
            onClick={createSimilar}
            title="Create similar — keep shape, nudge timing and velocity"
          >
            SIMILAR
          </GenoBassBtn>
          {!se2SyncLocked ? (
            <GenoBassBtn
              small
              active={loopOn}
              disabled={disabled}
              onClick={() => setLoopOn((v) => !v)}
            >
              {loopOn ? '● LOOP' : '○ LOOP'}
            </GenoBassBtn>
          ) : null}
          <GenoBassBtn
            small
            active={se2SyncLocked}
            disabled={disabled}
            onClick={() => {
              setSe2SyncLocked((v) => {
                if (!v && loopOn) setLoopOn(false);
                return !v;
              });
            }}
            title="Lock preview loop to SE2 transport playhead and BPM"
          >
            {se2SyncLocked ? '● SYNC SE2' : '○ SYNC SE2'}
          </GenoBassBtn>
          <GenoBassBtn small disabled={disabled} onClick={applyToRoll} title="Apply groove to track piano roll">
            APPLY ROLL
          </GenoBassBtn>
          <input
            ref={midiImportFileRef}
            type="file"
            accept=".mid,.midi,audio/midi"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importMidiBassline(f);
              e.target.value = '';
            }}
          />
          <GenoBassBtn
            small
            disabled={disabled}
            onClick={() => midiImportFileRef.current?.click()}
            title="Import a 4–8 bar MIDI bassline (.mid) into the groove piano roll"
          >
            IMPORT MIDI
          </GenoBassBtn>
          <GenoBassBtn
            small
            disabled={
              disabled ||
              !getSe2TrackMidiImport ||
              !keySourceTracks.some((t) => t.trackIndex === keySourceTrackIndex && t.noteCount > 0)
            }
            onClick={importMidiFromSe2Track}
            title="Import bass MIDI from the selected SE2 track (lane dropdown)"
          >
            IMPORT TRACK
          </GenoBassBtn>
          <span style={{ width: 1, height: 16, background: GENO_BASS_THEME.border, margin: '0 2px' }} />
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '1px 5px',
              borderRadius: 2,
              border: '1px solid rgba(255,130,130,0.55)',
              boxShadow: '0 0 0 1px rgba(255,85,85,0.1)',
            }}
            title="Save — Sound = synth only · Pattern = groove roll only · S+PAT = both into My Grooves"
          >
            <span style={{ fontSize: 7, fontWeight: 800, color: GENO_BASS_THEME.labelDim, letterSpacing: '0.1em' }}>
              SAVE
            </span>
            <GenoBassBtn
              small
              saveHighlight
              disabled={disabled}
              onClick={handleSaveSound}
              title="Save Sound — oscillators, filter, envelope, FX (your edited synth patch)"
            >
              SND
            </GenoBassBtn>
            <GenoBassBtn
              small
              saveHighlight
              disabled={disabled || !templateNotes.length}
              onClick={handleSavePattern}
              title="Save Pattern — groove roll + harmony only (keeps your current sound on load)"
            >
              PAT
            </GenoBassBtn>
            <GenoBassBtn
              small
              saveHighlight
              disabled={disabled || !templateNotes.length}
              onClick={handleSaveSoundAndPattern}
              title="Save Sound + Pattern — full bass timbre + groove into My Grooves"
            >
              S+PAT
            </GenoBassBtn>
            {savedSounds.length > 0 || savedPatternsOnly.length > 0 || savedSoundAndPatterns.length > 0 ? (
              <select
                value={loadUserSaveId}
                disabled={disabled}
                title="Load — recall a saved sound, pattern only, or sound + pattern"
                onChange={(e) => handleLoadUserSave(e.target.value)}
                style={{
                  fontSize: 7,
                  fontWeight: 700,
                  maxWidth: 132,
                  minWidth: 88,
                  padding: '2px 4px',
                  borderRadius: 2,
                  border: `1px solid ${GENO_BASS_THEME.border}`,
                  background: GENO_BASS_THEME.panelInset,
                  color: GENO_BASS_THEME.label,
                }}
              >
                <option value="">— Load —</option>
                {savedSoundAndPatterns.length > 0 ? (
                  <optgroup label="Sound + pattern (My Grooves)">
                    {savedSoundAndPatterns.map((p) => (
                      <option key={p.id} value={`pattern:${p.id}`}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {savedPatternsOnly.length > 0 ? (
                  <optgroup label="Patterns only">
                    {savedPatternsOnly.map((p) => (
                      <option key={p.id} value={`pattern:${p.id}`}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {savedSounds.length > 0 ? (
                  <optgroup label="Sounds only">
                    {savedSounds.map((s) => (
                      <option key={s.id} value={`sound:${s.id}`}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            ) : null}
            {saveDialogMode ? (
              <div
                role="dialog"
                aria-label={
                  saveDialogMode === 'sound'
                    ? 'Save sound'
                    : saveDialogMode === 'pattern'
                      ? 'Save pattern only'
                      : 'Save sound and pattern'
                }
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  zIndex: 40,
                  marginTop: 4,
                  minWidth: 236,
                  padding: '8px 10px',
                  borderRadius: 4,
                  border: `1px solid ${GENO_BASS_THEME.border}`,
                  background: GENO_BASS_THEME.panel,
                  boxShadow: '0 8px 20px rgba(0,0,0,0.45)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 8, fontWeight: 800, color: GENO_BASS_THEME.labelHi, letterSpacing: '0.08em' }}>
                  {saveDialogMode === 'sound'
                    ? 'SAVE SOUND'
                    : saveDialogMode === 'pattern'
                      ? 'SAVE PATTERN ONLY'
                      : 'SAVE SOUND + PATTERN'}
                </span>
                <span style={{ fontSize: 7, fontWeight: 600, color: GENO_BASS_THEME.labelDim, lineHeight: 1.35 }}>
                  {saveDialogMode === 'sound'
                    ? 'Your save · this device · recall from Load → Sounds only'
                    : saveDialogMode === 'pattern'
                      ? 'Your save · this device · recall from Load → Patterns only'
                      : 'Your save · this device · My Grooves tab + Load → Sound + pattern'}
                </span>
                <input
                  ref={saveNameInputRef}
                  type="text"
                  value={saveNameDraft}
                  maxLength={48}
                  disabled={disabled}
                  onChange={(e) => setSaveNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      confirmSaveDialog();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelSaveDialog();
                    }
                  }}
                  style={{
                    height: 24,
                    padding: '0 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: GENO_BASS_THEME.labelHi,
                    background: GENO_BASS_THEME.panelInset,
                    border: `1px solid ${GENO_BASS_THEME.border}`,
                    borderRadius: 3,
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <GenoBassBtn small disabled={disabled} onClick={cancelSaveDialog}>
                    Cancel
                  </GenoBassBtn>
                  <GenoBassBtn small disabled={disabled} onClick={confirmSaveDialog}>
                    Save
                  </GenoBassBtn>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {se2SyncLocked ? (
            <GenoBassLcd sub="SONG" width={72}>
              {bpm.toFixed(0)} BPM
            </GenoBassLcd>
          ) : (
            <GenoBassLcdValueBar
              value={grooveBpm}
              suffix="BPM"
              width={72}
              sub="GROOVE"
              disabled={disabled}
              title="Groove BPM — click to type, drag up/down to change (sync off only)"
              onChange={handleGrooveBpmChange}
            />
          )}
          {se2SyncLocked ? (
            <GenoBassLcd sub="PRESET" width={72}>
              {presetBpm.toFixed(0)} BPM
            </GenoBassLcd>
          ) : null}
          <GenoBassLcd sub="KEY">{studioKeyLabel(chordKeyRoot, chordKeyMode)}</GenoBassLcd>
          {keySourceTracks.length > 0 ? (
            <select
              disabled={disabled}
              value={keySourceTrackIndex}
              onChange={(e) => onKeySourceTrackIndexChange?.(Number(e.target.value))}
              title="SE2 lane — read chord roots from this track for bass lock"
              style={{
                height: 22,
                minWidth: 140,
                maxWidth: 210,
                fontSize: 8,
                fontWeight: 700,
                padding: '0 6px',
                borderRadius: 3,
                border: `1px solid ${GENO_BASS_THEME.border}`,
                background: GENO_BASS_THEME.panelInset,
                color: GENO_BASS_THEME.lcdText,
              }}
            >
              {keySourceTracks.map((t) => (
                <option key={t.trackIndex} value={t.trackIndex}>
                  {genoUltraKeySourceTrackLabel(t)}
                  {t.canFollowChords
                    ? ' · CH'
                    : t.storedKeyRoot != null && t.storedKeyMode
                      ? ` · ${studioKeyLabel(t.storedKeyRoot, t.storedKeyMode)}`
                      : t.noteCount > 0
                        ? ` · ${t.noteCount}n`
                        : ''}
                </option>
              ))}
            </select>
          ) : null}
          {onDetectKeyFromSourceTrack ? (
            <GenoBassBtn
              small
              disabled={
                disabled || !keySourceTracks.some((t) => t.trackIndex === keySourceTrackIndex && t.canDetectKey)
              }
              onClick={() => {
                const ok = onDetectKeyFromSourceTrack(keySourceTrackIndex);
                const src = keySourceTracks.find((t) => t.trackIndex === keySourceTrackIndex);
                const label = src ? genoUltraKeySourceTrackLabel(src) : `T${keySourceTrackIndex + 1}`;
                setSyncHint(
                  ok === false
                    ? `${label} — no key (add melodic notes or analyze audio)`
                    : `Key from ${label}`,
                );
              }}
              title="Detect key from the selected SE2 track"
            >
              DETECT
            </GenoBassBtn>
          ) : null}
          <GenoBassBtn
            small
            active={followSourceTrackChords}
            disabled={
              disabled ||
              !getSe2TrackChordImport ||
              !keySourceTracks.some((t) => t.trackIndex === keySourceTrackIndex && t.canFollowChords)
            }
            onClick={() => {
              if (followSourceTrackChords) {
                setFollowSourceTrackChords(false);
                setSyncHint('MIDI follow off');
                return;
              }
              setFollowSourceTrackChords(true);
              followChordsFromSourceTrack(keySourceTrackIndex);
            }}
            title="Follow chord changes from the selected MIDI / harmony lane"
          >
            {followSourceTrackChords ? '● MIDI SYNC' : '○ MIDI SYNC'}
          </GenoBassBtn>
          <GenoBassBtn
            small
            active={chordLocked}
            disabled={disabled || !chordTimeline?.length}
            onClick={() => {
              setChordLocked((v) => {
                const next = !v;
                if (next && !chordTimeline?.length) {
                  followChordsFromSourceTrack(keySourceTrackIndex);
                }
                return next;
              });
            }}
            title="Lock bassline to chord root per bar — matches Geno Ultra / 808 root follow"
          >
            {chordLocked ? '● LOCK ROOT' : '○ LOCK ROOT'}
          </GenoBassBtn>
          {syncHint ? (
            <span style={{ fontSize: 7, color: GENO_BASS_THEME.labelDim, maxWidth: 220 }}>{syncHint}</span>
          ) : null}
        </div>

        <div
          style={{
            borderRadius: grooveTallRoll ? '4px 4px 0 0' : 4,
            border: `1px solid ${GENO_BASS_THEME.border}`,
            background: GENO_BASS_THEME.panelInset,
            flex: embedded || grooveTallRoll ? 1 : undefined,
            flexShrink: embedded || grooveTallRoll ? undefined : 0,
            minHeight: grooveTallRoll ? 0 : embedded ? 0 : 200,
            display: embedded || grooveTallRoll ? 'flex' : undefined,
            flexDirection: embedded || grooveTallRoll ? 'column' : undefined,
            overflow: embedded || grooveTallRoll ? 'hidden' : undefined,
            position: grooveTallRoll ? 'relative' : undefined,
            zIndex: grooveTallRoll ? 0 : undefined,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
              padding: '4px 8px',
              borderBottom: `1px solid ${GENO_BASS_THEME.border}`,
              background: 'rgba(0,0,0,0.25)',
            }}
          >
            <span
              style={{
                fontFamily: 'system-ui, Segoe UI, sans-serif',
                fontSize: 7,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: GENO_BASS_THEME.labelDim,
              }}
            >
              BASS PIANO ROLL — {barLength} BAR
              {effectiveNotes.length ? ` · ${effectiveNotes.length} hits` : ' (pick a preset or GEN)'}
              {chordLocked ? ' · ROOT LOCK' : ''}
            </span>
            <Se2SynthGenoLoopPianoRollEditToolbar
              accentHex={GENO_BASS_THEME.amber}
              disabled={disabled || chordLocked}
              hasSelection={rollEdit.hasSelection}
              canUndo={rollEdit.canUndo}
              hasNotes={templateNotes.length > 0}
              onErase={() => pianoRollRef.current?.deleteSelected()}
              onDuplicate={() => pianoRollRef.current?.duplicateSelected()}
              onCut={() => pianoRollRef.current?.cutSelected()}
              onUndo={() => pianoRollRef.current?.undo()}
              onClear={() => pianoRollRef.current?.clearAll()}
            />
          </div>
          <div
            style={{
              overflow: 'auto',
              minHeight: grooveTallRoll ? 0 : embedded ? 0 : 168,
              maxHeight: grooveTallRoll ? undefined : embedded ? undefined : 260,
              flex: embedded || grooveTallRoll ? 1 : undefined,
            }}
          >
            <Se2SynthGenoLoopChordPianoRoll
              ref={pianoRollRef}
              notes={effectiveNotes}
              barCount={barLength}
              beatsPerBar={beatsPerBar}
              accentHex={GENO_BASS_THEME.amber}
              minMidi={rollKeyboardRange.minMidi}
              maxMidi={rollKeyboardRange.maxMidi}
              previewBeat={seqActive ? previewBeat : null}
              previewHeldMidi={previewHeldPitch}
              onPianoKeyPreview={onPianoKeyPreview}
              onPianoKeyRelease={onPianoKeyRelease}
              disabled={disabled}
              editLocked={chordLocked}
              onNotesChange={setTemplateNotes}
              onEditStateChange={setRollEdit}
              gridEditTool="draw"
              sixteenthGrid={grooveQuantize !== '8'}
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'center',
            flexShrink: 0,
            ...(grooveTallRoll
              ? { position: 'relative', zIndex: 20, paddingBottom: 2, background: GENO_BASS_THEME.panel }
              : {}),
          }}
        >
          <span style={{ fontSize: 7, fontWeight: 800, color: GENO_BASS_THEME.labelDim, letterSpacing: '0.08em' }}>
            PRESET
          </span>
          {GENO_BASS_GROOVE_GROUPS.map((g) => (
            <GenoBassBtn
              key={g.id}
              small
              active={presetGroup === g.id}
              disabled={disabled}
              onClick={() => {
                setPresetGroup(g.id);
                if (g.id === 'my' && savedSoundAndPatterns[0]) {
                  setPresetId(genoBassUserGroovePresetId(savedSoundAndPatterns[0].id));
                }
              }}
            >
              {g.label}
            </GenoBassBtn>
          ))}
          <span style={{ width: 1, height: 16, background: GENO_BASS_THEME.border, margin: '0 2px' }} />
          <GenoBassGroovePresetDropUp
            presets={groupPresets}
            value={presetId}
            disabled={disabled}
            onSelect={(id) => selectGroovePreset(id, randSeed)}
          />
          <GenoBassGrooveQuantSelect
            value={grooveQuantize}
            disabled={disabled}
            onChange={(quant) => {
              setGrooveQuantize(quant);
              grooveQuantizeRef.current = quant;
              fillFromPreset(presetId, randSeed);
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
            fontSize: 7,
            color: GENO_BASS_THEME.labelDim,
            flexShrink: 0,
            ...(grooveTallRoll
              ? { position: 'relative', zIndex: 1, paddingBottom: 3, background: GENO_BASS_THEME.panel }
              : {}),
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            LENGTH
            <input
              type="range"
              min={0.35}
              max={1}
              step={0.02}
              value={gate}
              disabled={disabled}
              onChange={(e) => setGate(Number(e.target.value))}
              onPointerUp={regenGate}
              style={{ width: 72, accentColor: GENO_BASS_THEME.amber }}
              title="Note length — release to refresh pattern"
            />
          </label>
          <span style={{ color: GENO_BASS_THEME.lcdDim }}>
            {activePreset?.label ?? 'Groove'} · {previewBpm} BPM · GRID{' '}
            {GENO_BASS_GROOVE_QUANTIZE_OPTIONS.find((q) => q.id === grooveQuantize)?.label ?? '1/16'} · ROOT{' '}
            {genoBassMidiNoteLabel(basePitch)}
            {linkedSoundLabel ? ` · ${linkedSoundLabel}` : ''}
            {chordLocked ? ' · LOCKED' : ''} · {effectiveNotes.length} HITS
          </span>
        </div>
      </div>
  );

  if (embedded) {
    return body;
  }
  return <GenoBassSection title="Bass Groove — 4 / 8 Bar Generator">{body}</GenoBassSection>;
}
