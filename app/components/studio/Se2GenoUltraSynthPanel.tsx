'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BeatLabSynthV2Oscilloscope } from '@/app/components/creation/BeatLabSynthV2Oscilloscope';
import {
  AnaCenterRack,
  AnaOscSamplerPanel,
  type AnaCenterTab,
  type AnaFxSlotId,
} from '@/app/components/studio/genoUltraAnaFxRack';
import { GenoUltraArpGateFxProvider } from '@/app/components/studio/genoUltraArpGateFxContext';
import { AnaArpGateFxSekModule } from '@/app/components/studio/genoUltraArpGateFxSekModule';
import { AnaArpPumperFxSekModule } from '@/app/components/studio/genoUltraArpPumperFxSekModule';
import {
  SekFooterTabs,
  SekLedMeter,
  SekModule,
  SekOnBtn,
  SekPresetBrowser,
  SekSequencerBrandBanner,
  SEKTOR,
} from '@/app/components/studio/genoUltraSektorUi';
import {
  AnaBtn,
  AnaChordMemoryPanel,
  AnaGraphicEnv,
  AnaHorizFader,
  AnaKeyboard,
  AnaKnob,
  AnaKnobRow,
  AnaLcdBar,
  AnaMacroKnob,
  AnaPerformanceStrip,
  AnaScopeFrame,
  AnaWaveScreen,
  AnaWheel,
  AnaWoodTrimFrame,
  filterResponsePath,
  lfoPath,
} from '@/app/components/studio/genoUltraAnaUi';
import { GENO_ULTRA_MOD_SLOT_COUNT, genoUltraVoicePreviewHoldSec, sanitizeGenoUltraFxParams } from '@/app/lib/studio/genoUltraSynthTypes';
import {
  GENO_ULTRA_CINEMATIC_HIT_PRESET_IDS,
  genoUltraPresetById,
  genoUltraSynthPresetsForCategory,
  genoUltraSynthPresetsForCenterSoundPicker,
} from '@/app/lib/studio/genoUltraSynthPresets';
import {
  GENO_ULTRA_ARP_MELODY_PRESETS,
  GENO_ULTRA_ARP_MELODY_TAGS,
  genoUltraArpMelodyPresetById,
  type GenoUltraArpMelodyTag,
} from '@/app/lib/studio/genoUltraArpMelodyPresets';
import {
  cloneGenoUltraVoice,
  getGenoUltraArpSavedPattern,
  genoUltraUserPatternBrowserId,
  isGenoUltraArpMelodyTag,
  listGenoUltraArpSavedPatterns,
  listGenoUltraArpSavedPatternsForMelodyTag,
  parseGenoUltraUserPatternBrowserId,
  type GenoUltraArpSavedPattern,
} from '@/app/lib/studio/genoUltraArpUserSaves';
import { previewGenoUltraSynthNote, stopGenoUltraArpPreviewVoices, stopGenoUltraKeyboardPreviewVoices } from '@/app/lib/studio/se2GenoUltraSynthPreview';
import type { GenoUltraArpSe2RollNote } from '@/app/lib/studio/genoUltraArpExport';
import type {
  GenoBuildTrackRef,
  GenoUltraGenoBuildChordSource,
} from '@/app/lib/studio/genoUltraArpChordImport';
import { isGenoUltraArpPreviewRunning, setGenoUltraSynthPanelActive } from '@/app/lib/creationStation/creationTransportSync';
import { ensureGenoCinematicOrchestraHitReady } from '@/app/lib/studio/genoCinematicOrchestraPlayback';
import { resolveGenoUltraStripOutput } from '@/app/lib/studio/genoUltraSynthMeterBus';
import type {
  GenoUltraFilterMode,
  GenoUltraLfoShape,
  GenoUltraModDest,
  GenoUltraModSource,
  GenoUltraOscParams,
  GenoUltraOscWave,
  GenoUltraSynthVoiceParams,
} from '@/app/lib/studio/genoUltraSynthTypes';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';

export type Se2GenoUltraSynthPanelProps = {
  accentHex?: string;
  disabled?: boolean;
  voice: GenoUltraSynthVoiceParams;
  presetId: string;
  bpm?: number;
  /** Stable Geno Ultra track id for per-lane ARP tempo. */
  arpTrackId?: string;
  /** Per-track standalone ARP tempo (not SE2 session BPM). */
  arpBpm?: number;
  onArpBpmChange?: (bpm: number) => void;
  songKeyRoot?: number;
  songKeyMode?: StudioDetectedKeyMode;
  getAudioContext?: () => AudioContext | null;
  /** Await SE2 ensureCtx — creates graph + resumes suspended context (required for first preview). */
  ensureAudioContext?: () => Promise<AudioContext>;
  getStripOutput?: (ctx: AudioContext) => AudioNode;
  onVoiceChange: (voice: GenoUltraSynthVoiceParams) => void;
  onPresetIdChange: (id: string) => void;
  onPatchLabelChange: (label: string) => void;
  /** Flatten current ARP pattern into this track's SE2 piano roll. */
  onApplyArpToPianoRoll?: (notes: readonly GenoUltraArpSe2RollNote[]) => void;
  genoBuildSources?: readonly GenoUltraGenoBuildChordSource[];
  genoBuildImportTracks?: readonly GenoBuildTrackRef[];
  beatsPerBar?: number;
  /** SE2 — ARP preview follows main transport when locked. */
  se2SyncLocked?: boolean;
  se2TransportPlaying?: boolean;
  onSe2SyncToggle?: () => void;
  getSe2PlayheadBeat?: () => number;
  getSe2TransportOriginBeat?: () => number;
  keySourceTracks?: readonly import('@/app/lib/studio/genoUltraArpKeySource').GenoUltraArpKeySourceTrack[];
  keySourceTrackIndex?: number;
  onKeySourceTrackIndexChange?: (trackIndex: number) => void;
  onDetectKeyFromSourceTrack?: (trackIndex: number) => boolean | void;
  followSe2SongKey?: boolean;
  onFollowSe2SongKeyChange?: (linked: boolean) => void;
  getSe2TrackChordImport?: (
    trackIndex: number,
    barLength: import('@/app/lib/studio/genoUltraArpPattern').GenoArpBarLength,
  ) =>
    | import('@/app/lib/studio/genoUltraArpChordImport').GenoUltraArpChordImportResult
    | import('@/app/lib/studio/genoUltraArpChordImport').GenoUltraArpChordImportError;
  followSourceTrackChords?: boolean;
};

const CATEGORIES = ['bass', 'lead', 'pad', 'pluck', 'keys', 'fx'] as const;
const OSC_WAVES: GenoUltraOscWave[] = ['saw', 'square', 'triangle', 'sine'];
const LFO_SHAPES: GenoUltraLfoShape[] = ['sine', 'triangle', 'square', 'saw'];
const FILTER_MODES: GenoUltraFilterMode[] = ['lowpass', 'bandpass', 'highpass', 'notch'];
const MOD_SOURCES: GenoUltraModSource[] = ['off', 'lfo1', 'lfo2', 'ampEnv', 'filterEnv', 'velocity'];
const MOD_DESTS: GenoUltraModDest[] = [
  'off', 'filterCutoff', 'filterRes', 'osc1Pitch', 'osc2Pitch', 'osc3Pitch', 'ampLevel', 'pan',
];
const MOD_SRC_LABEL: Record<GenoUltraModSource, string> = {
  off: '—', lfo1: 'LFO 1', lfo2: 'LFO 2', ampEnv: 'Amp Env', filterEnv: 'Filter Env', velocity: 'Velocity',
};
const MOD_DST_LABEL: Record<GenoUltraModDest, string> = {
  off: '—', filterCutoff: 'Cutoff', filterRes: 'Res', osc1Pitch: 'OSC1', osc2Pitch: 'OSC2',
  osc3Pitch: 'OSC3', ampLevel: 'Amp', pan: 'Pan',
};

export function Se2GenoUltraSynthPanel({
  disabled = false,
  voice,
  presetId,
  bpm = 120,
  arpTrackId,
  arpBpm,
  onArpBpmChange,
  songKeyRoot = 0,
  songKeyMode = 'major',
  getAudioContext,
  ensureAudioContext,
  getStripOutput,
  onVoiceChange,
  onPresetIdChange,
  onPatchLabelChange,
  onApplyArpToPianoRoll,
  genoBuildSources,
  genoBuildImportTracks,
  beatsPerBar = 4,
  se2SyncLocked = false,
  se2TransportPlaying = false,
  onSe2SyncToggle,
  getSe2PlayheadBeat,
  getSe2TransportOriginBeat,
  keySourceTracks,
  keySourceTrackIndex,
  onKeySourceTrackIndexChange,
  onDetectKeyFromSourceTrack,
  followSe2SongKey = true,
  onFollowSe2SongKeyChange,
  getSe2TrackChordImport,
  followSourceTrackChords = true,
}: Se2GenoUltraSynthPanelProps) {
  const previewPitchRef = useRef(60);
  const [arpRootPitch, setArpRootPitch] = useState(60);
  const [activePitch, setActivePitch] = useState<number | null>(null);
  const scopeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scopeActive, setScopeActive] = useState(false);
  const [samplerTab, setSamplerTab] = useState<4 | 5 | 6>(6);
  const [centerTab, setCenterTab] = useState<AnaCenterTab>('arp');
  const [fxSlot, setFxSlot] = useState<AnaFxSlotId>('dualDelay');
  const [footerTab, setFooterTab] = useState('keys');
  const [lfoTab, setLfoTab] = useState<1 | 2>(1);
  const [modWheel, setModWheel] = useState(0);
  const [pitchWheel, setPitchWheel] = useState(0);
  const [mono, setMono] = useState(true);
  const [legato, setLegato] = useState(false);
  const [slide, setSlide] = useState(false);
  const [slideAnchor, setSlideAnchor] = useState<'mid' | 'end'>('mid');
  const [bendSt, setBendSt] = useState(2);
  const [polyphony, setPolyphony] = useState(8);
  const [portamentoMs, setPortamentoMs] = useState(120);
  const [activeMelodyPresetId, setActiveMelodyPresetId] = useState('');
  const [activeMelodyTag, setActiveMelodyTag] = useState<GenoUltraArpMelodyTag | undefined>(undefined);
  const [browserLeftId, setBrowserLeftId] = useState('sound:bass');
  const [userPatternRev, setUserPatternRev] = useState(0);
  const applyArpMelodyRef = useRef<(id: string) => void>(() => {});
  const applyArpUserPatternRef = useRef<(id: string) => void>(() => {});

  const registerArpMelodyApplier = useCallback((fn: (id: string) => void) => {
    applyArpMelodyRef.current = fn;
  }, []);

  const registerArpUserPatternApplier = useCallback((fn: (id: string) => void) => {
    applyArpUserPatternRef.current = fn;
  }, []);

  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const modWheelRef = useRef(modWheel);
  modWheelRef.current = modWheel;
  /** Remember osc level when muted so ON restores the last audible level. */
  const oscMuteMemRef = useRef<Record<'osc1' | 'osc2' | 'osc3', number>>({
    osc1: 0.78,
    osc2: 0.42,
    osc3: 0.28,
  });

  /** Always read latest patch (including knobs not yet flushed to parent state). */
  const previewVoice = useCallback(() => {
    const v = voiceRef.current;
    const mw = modWheelRef.current;
    return {
      ...v,
      osc1: { ...v.osc1 },
      osc2: { ...v.osc2 },
      osc3: { ...v.osc3 },
      modSlots: v.modSlots.map((s) => ({ ...s })),
      fx: { ...v.fx },
      filterCutoffHz: Math.min(12000, v.filterCutoffHz * (1 + mw * 1.2)),
      lfo1Depth: Math.min(1, v.lfo1Depth * (0.35 + (mw + 1) * 0.325)),
    };
  }, []);

  /** Always reads latest browser patch — ARP stays mounted while tabs switch. */
  const getArpVoice = useCallback((): GenoUltraSynthVoiceParams => {
    const v = voiceRef.current;
    const mw = modWheelRef.current;
    return {
      ...v,
      modSlots: v.modSlots.map((s) => ({ ...s })),
      fx: { ...v.fx },
      osc1: { ...v.osc1 },
      osc2: { ...v.osc2 },
      osc3: { ...v.osc3 },
      filterCutoffHz: Math.min(12000, v.filterCutoffHz * (1 + mw * 1.2)),
      lfo1Depth: Math.min(1, v.lfo1Depth * (0.35 + (mw + 1) * 0.325)),
    };
  }, []);

  const getStripOutputRef = useRef(getStripOutput);
  getStripOutputRef.current = getStripOutput;
  const arpPerfRef = useRef({
    legato: false,
    slide: false,
    portamentoMs: 120,
    slideAnchor: 'mid' as 'mid' | 'end',
  });
  arpPerfRef.current = { legato, slide, portamentoMs, slideAnchor };
  const arpPerformanceGetters = useMemo(
    () => ({
      getArpLegato: () => arpPerfRef.current.legato,
      getArpSlide: () => arpPerfRef.current.slide,
      getArpPortamentoMs: () => arpPerfRef.current.portamentoMs,
      getArpSlideAnchor: () => arpPerfRef.current.slideAnchor,
    }),
    [],
  );
  const stableGetStripOutput = useCallback(
    (ctx: AudioContext) => {
      const dest = getStripOutputRef.current?.(ctx) ?? ctx.destination;
      return resolveGenoUltraStripOutput(ctx, dest);
    },
    [],
  );

  const bumpOscScope = useCallback((durationSec: number) => {
    setScopeActive(true);
    if (scopeTimerRef.current) clearTimeout(scopeTimerRef.current);
    scopeTimerRef.current = setTimeout(() => setScopeActive(false), Math.max(60, durationSec * 1000 + 50));
  }, []);

  useEffect(
    () => () => {
      if (scopeTimerRef.current) clearTimeout(scopeTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    setGenoUltraSynthPanelActive(true);
    return () => {
      setGenoUltraSynthPanelActive(false);
    };
  }, []);

  const primeAudio = useCallback(async (): Promise<AudioContext | null> => {
    try {
      let ctx: AudioContext | null = null;
      if (ensureAudioContext) {
        ctx = await ensureAudioContext();
      } else {
        ctx = getAudioContext?.() ?? null;
      }
      if (!ctx || ctx.state === 'closed') return null;
      if (ctx.state === 'suspended') await ctx.resume();
      return ctx;
    } catch {
      return null;
    }
  }, [ensureAudioContext, getAudioContext]);

  const releasePreview = useCallback(() => {
    setActivePitch(null);
  }, []);

  const previewAt = useCallback(
    (pitch: number, vel = 100, durationSec?: number) => {
      const bendSemi = pitchWheel * bendSt;
      const bent = Math.max(0, Math.min(127, Math.round(pitch + bendSemi)));
      previewPitchRef.current = pitch;
      setArpRootPitch(pitch);
      setActivePitch(pitch);
      void (async () => {
        const ctx = await primeAudio();
        if (!ctx) return;
        const dest = stableGetStripOutput(ctx);
        const voice = previewVoice();
        const hold = durationSec ?? genoUltraVoicePreviewHoldSec(voice);
        previewGenoUltraSynthNote(ctx, dest, bent, vel, voice, bpm, hold, {
          monophonic: mono,
          maxPoly: polyphony,
        });
        bumpOscScope(hold);
      })();
    },
    [primeAudio, stableGetStripOutput, previewVoice, bpm, pitchWheel, bendSt, bumpOscScope, mono, polyphony],
  );

  const onArpStep = useCallback(
    (step: number, pitch: number | null, gateSec: number) => {
      if (step >= 0 && pitch != null) bumpOscScope(gateSec);
    },
    [bumpOscScope],
  );

  const patch = useCallback(
    (partial: Partial<GenoUltraSynthVoiceParams>) => {
      const prev = voiceRef.current;
      const next = partial.fx
        ? { ...prev, ...partial, fx: sanitizeGenoUltraFxParams({ ...prev.fx, ...partial.fx }) }
        : { ...prev, ...partial };
      voiceRef.current = next;
      onVoiceChange(next);
    },
    [onVoiceChange],
  );

  /** Silent param update — audition via keyboard or ARP preview only. */
  const patchAudible = patch;

  const loadPreset = useCallback(
    (id: string, voicePatch?: Partial<GenoUltraSynthVoiceParams>) => {
      const base = genoUltraPresetById(id);
      const p = voicePatch ? { ...base, ...voicePatch } : base;
      voiceRef.current = p;
      const arpRunning = isGenoUltraArpPreviewRunning();
      if (!arpRunning) {
        stopGenoUltraArpPreviewVoices();
        stopGenoUltraKeyboardPreviewVoices();
      }
      onPresetIdChange(id);
      onPatchLabelChange(p.label);
      onVoiceChange(p);
      if (GENO_ULTRA_CINEMATIC_HIT_PRESET_IDS.includes(id)) {
        void primeAudio().then((ctx) => {
          if (ctx) void ensureGenoCinematicOrchestraHitReady(ctx, id);
        });
      }
    },
    [onPresetIdChange, onPatchLabelChange, onVoiceChange, primeAudio],
  );

  const applyEditedVoice = useCallback(
    (v: GenoUltraSynthVoiceParams) => {
      const next = cloneGenoUltraVoice(v);
      voiceRef.current = next;
      stopGenoUltraArpPreviewVoices();
      onVoiceChange(next);
      onPresetIdChange(next.id);
      onPatchLabelChange(next.label);
    },
    [onVoiceChange, onPresetIdChange, onPatchLabelChange],
  );


  const loadArpMelodyPreset = useCallback((id: string) => {
    const melody = genoUltraArpMelodyPresetById(id);
    if (!melody) return;
    setActiveMelodyPresetId(id);
    setActiveMelodyTag(melody.tag);
    applyArpMelodyRef.current(id);
  }, []);

  const loadArpUserPattern = useCallback((patternId: string, tag?: GenoUltraArpMelodyTag) => {
    const saved = getGenoUltraArpSavedPattern(patternId);
    const resolvedTag = tag ?? saved?.melodyTag;
    setActiveMelodyPresetId(genoUltraUserPatternBrowserId(patternId));
    if (resolvedTag) {
      setActiveMelodyTag(resolvedTag);
      setBrowserLeftId(`arp:${resolvedTag}`);
    } else {
      setActiveMelodyTag(undefined);
      setBrowserLeftId('arp:mine');
    }
    applyArpUserPatternRef.current(patternId);
  }, []);

  const handlePatternSaved = useCallback((entry: GenoUltraArpSavedPattern) => {
    setUserPatternRev((n) => n + 1);
    setActiveMelodyPresetId(genoUltraUserPatternBrowserId(entry.id));
    if (entry.melodyTag) {
      setActiveMelodyTag(entry.melodyTag);
      setBrowserLeftId(`arp:${entry.melodyTag}`);
    } else {
      setActiveMelodyTag(undefined);
      setBrowserLeftId('arp:mine');
    }
    onPatchLabelChange(entry.name);
    onVoiceChange(cloneGenoUltraVoice(entry.voice));
  }, [onPatchLabelChange, onVoiceChange]);

  const hasUntaggedUserPatterns = useMemo(
    () => listGenoUltraArpSavedPatternsForMelodyTag('mine').length > 0,
    [userPatternRev],
  );

  const browserLeftItems = useMemo(
    () => [
      ...CATEGORIES.map((c) => ({ id: `sound:${c}`, label: c, group: 'PATCHES' as const })),
      { id: 'soundbank:cinematic', label: 'cinematic hits', group: 'PATCHES' as const },
      ...(hasUntaggedUserPatterns
        ? [{ id: 'arp:mine', label: 'My Melodies', group: 'ARP MELODIES' as const }]
        : []),
      ...GENO_ULTRA_ARP_MELODY_TAGS.map((t) => ({ id: `arp:${t.id}`, label: t.label, group: 'ARP MELODIES' as const })),
    ],
    [hasUntaggedUserPatterns],
  );

  const browserRightItems = useMemo(() => {
    if (browserLeftId.startsWith('arp:')) {
      const tag = browserLeftId.slice(4);
      if (tag === 'mine') {
        return listGenoUltraArpSavedPatternsForMelodyTag('mine').map((p) => ({
          id: genoUltraUserPatternBrowserId(p.id),
          label: `★ ${p.name}`,
          description: 'Your saved sound + pattern',
        }));
      }
      if (isGenoUltraArpMelodyTag(tag)) {
        const factory = GENO_ULTRA_ARP_MELODY_PRESETS.filter((p) => p.tag === tag).map((p) => ({
          id: p.id,
          label: p.label,
          description: p.description,
        }));
        const mine = listGenoUltraArpSavedPatternsForMelodyTag(tag).map((p) => ({
          id: genoUltraUserPatternBrowserId(p.id),
          label: `★ ${p.name}`,
          description: 'Your saved sound + pattern',
        }));
        return [...mine, ...factory];
      }
      return [];
    }
    if (browserLeftId === 'soundbank:cinematic') {
      return GENO_ULTRA_CINEMATIC_HIT_PRESET_IDS.map((id) => {
        const p = genoUltraPresetById(id);
        return { id: p.id, label: p.label };
      });
    }
    const cat = browserLeftId.startsWith('sound:') ? browserLeftId.slice(6) : browserLeftId;
    return genoUltraSynthPresetsForCategory(cat as (typeof CATEGORIES)[number]).map((p) => ({
      id: p.id,
      label: p.label,
    }));
  }, [browserLeftId, userPatternRev]);

  const browserActiveRightId = activeMelodyPresetId || presetId;

  const activeMelodyLabel = useMemo(() => {
    const userPatternId = parseGenoUltraUserPatternBrowserId(activeMelodyPresetId);
    if (userPatternId) {
      return listGenoUltraArpSavedPatterns().find((p) => p.id === userPatternId)?.name ?? '';
    }
    return genoUltraArpMelodyPresetById(activeMelodyPresetId)?.label ?? '';
  }, [activeMelodyPresetId, userPatternRev]);

  /** Prefer the melody you loaded; fall back to the Melodies folder currently open in Browser. */
  const saveMelodyTag = useMemo((): GenoUltraArpMelodyTag | undefined => {
    if (activeMelodyTag) return activeMelodyTag;
    if (browserLeftId.startsWith('arp:')) {
      const tag = browserLeftId.slice(4);
      return isGenoUltraArpMelodyTag(tag) ? tag : undefined;
    }
    return undefined;
  }, [activeMelodyTag, browserLeftId]);

  const handleBrowserRightSelect = useCallback(
    (id: string) => {
      if (browserLeftId.startsWith('arp:')) {
        const userPatternId = parseGenoUltraUserPatternBrowserId(id);
        if (userPatternId) {
          const tag = browserLeftId.slice(4);
          loadArpUserPattern(
            userPatternId,
            isGenoUltraArpMelodyTag(tag) ? tag : undefined,
          );
          return;
        }
        loadArpMelodyPreset(id);
        return;
      }
      setActiveMelodyPresetId('');
      setActiveMelodyTag(undefined);
      loadPreset(id);
    },
    [browserLeftId, loadArpMelodyPreset, loadArpUserPattern, loadPreset],
  );

  const browserPrevNext = useCallback(
    (dir: -1 | 1) => {
      const idx = browserRightItems.findIndex((p) => p.id === browserActiveRightId);
      const next = browserRightItems[Math.max(0, Math.min(browserRightItems.length - 1, idx + dir))];
      if (next) handleBrowserRightSelect(next.id);
    },
    [browserRightItems, browserActiveRightId, handleBrowserRightSelect],
  );

  const patchModSlot = (i: number, partial: Partial<(typeof voice.modSlots)[number]>) => {
    patchAudible({ modSlots: voice.modSlots.map((s, j) => (j === i ? { ...s, ...partial } : s)) });
  };

  const lfoShape = lfoTab === 1 ? voice.lfo1Shape : voice.lfo2Shape;
  const lfoRate = lfoTab === 1 ? voice.lfo1RateHz : voice.lfo2RateHz;
  const lfoDepth = lfoTab === 1 ? voice.lfo1Depth : voice.lfo2Depth;
  const patchLfoShape = (shape: GenoUltraLfoShape) => {
    patchAudible(lfoTab === 1 ? { lfo1Shape: shape } : { lfo2Shape: shape });
  };

  const patchOscAt = (key: 'osc1' | 'osc2' | 'osc3', partial: Partial<GenoUltraOscParams>) => {
    const prev = voiceRef.current;
    patchAudible({ [key]: { ...prev[key], ...partial } });
  };

  const toggleOscLevel = (key: 'osc1' | 'osc2' | 'osc3', osc: GenoUltraOscParams, fallback: number) => {
    const on = osc.level > 0.01;
    if (on) {
      oscMuteMemRef.current[key] = osc.level;
      patchOscAt(key, { level: 0 });
    } else {
      patchOscAt(key, { level: oscMuteMemRef.current[key] || fallback });
    }
  };

  const renderOscBlock = (label: string, oscKey: 'osc1' | 'osc2', osc: GenoUltraOscParams) => {
    const octL = Math.floor(osc.semitone / 12);
    const semiL = ((osc.semitone % 12) + 12) % 12;
    const oscOn = osc.level > 0.01;
    const scopeLive = scopeActive && oscOn;
    const restoreLevel = oscKey === 'osc1' ? 0.78 : 0.42;
    return (
      <SekModule title={label} style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <SekOnBtn
            on={oscOn}
            disabled={disabled}
            onClick={() => toggleOscLevel(oscKey, osc, restoreLevel)}
            title={`${label} on/off — solo this oscillator while editing`}
          />
        </div>
        <AnaScopeFrame height={56}>
          <BeatLabSynthV2Oscilloscope
            osc1Wave={osc.wave}
            osc2Wave={osc.wave}
            level1={osc.level}
            level2={osc.level * 0.5}
            height={56}
            width={220}
            active={scopeLive}
          />
        </AnaScopeFrame>
        <div style={{ display: 'flex', gap: 3, margin: '4px 0', flexWrap: 'wrap' }}>
          {OSC_WAVES.map((w) => (
            <AnaBtn
              key={w}
              small
              active={osc.wave === w}
              disabled={disabled}
              onClick={() => patchOscAt(oscKey, { wave: w })}
              title={`${label} waveform: ${w}`}
            >
              {w.slice(0, 3)}
            </AnaBtn>
          ))}
        </div>
        <AnaKnobRow>
          <AnaKnob label="PITCH" value={octL} min={-2} max={2} decimals={0} disabled={disabled} onChange={(v) => patchOscAt(oscKey, { semitone: v * 12 + semiL })} />
          <AnaKnob label="PHASE" value={osc.pwm} min={0} max={1} disabled={disabled} onChange={(v) => patchOscAt(oscKey, { pwm: v })} />
          <AnaKnob label="VOICES" value={voice.unisonVoices} min={1} max={6} decimals={0} disabled={disabled} onChange={(v) => patchAudible({ unisonVoices: Math.round(v) })} />
          <AnaKnob label="DETUNE" value={voice.unisonDetuneCents} min={0} max={24} decimals={0} disabled={disabled} onChange={(v) => patchAudible({ unisonDetuneCents: Math.round(v) })} />
          <AnaKnob label="PAN" value={0.5} min={0} max={1} disabled onChange={() => {}} />
          <AnaKnob label="LEVEL" value={osc.level} min={0} max={1} disabled={disabled} onChange={(v) => patchOscAt(oscKey, { level: v })} />
          <AnaKnob label="MORPH" value={osc.pwm} min={0} max={1} disabled={disabled} onChange={(v) => patchOscAt(oscKey, { pwm: v })} />
        </AnaKnobRow>
      </SekModule>
    );
  };

  return (
    <GenoUltraArpGateFxProvider>
    <AnaWoodTrimFrame className="geno-ultra-sektor" style={{ minWidth: 1180 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: SEKTOR.bg,
          color: SEKTOR.text,
          fontFamily: 'system-ui, Segoe UI, sans-serif',
          border: `1px solid ${SEKTOR.border}`,
        }}
      >
      {/* ── TOP: Sub / Sample | Brand | Macros | Master ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderBottom: `1px solid ${SEKTOR.border}`, background: SEKTOR.bgInset }}>
        <SekModule title="Sub Osc" flex="0 0 172px" style={{ margin: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <SekOnBtn
              on={voice.subLevel > 0.01}
              disabled={disabled}
              onClick={() => patchAudible({ subLevel: voice.subLevel > 0.01 ? 0 : 0.35 })}
              title="Toggle sub oscillator — sine one octave below"
            />
            <AnaKnob label="Level" value={voice.subLevel} min={0} max={1} disabled={disabled} onChange={(v) => patchAudible({ subLevel: v })} />
            <AnaKnob label="Drive" value={voice.filterDrive} min={0} max={1} disabled={disabled} onChange={(v) => patchAudible({ filterDrive: v })} />
          </div>
        </SekModule>
        <SekModule title="Sample" flex="0 0 160px" style={{ margin: 0 }}>
          <AnaLcdBar size="sm">
            {samplerTab === 4 ? 'SUB' : samplerTab === 5 ? 'NOISE' : 'OSC 3'} · SLOT {samplerTab}
          </AnaLcdBar>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {([4, 5, 6] as const).map((n) => (
              <AnaBtn
                key={n}
                small
                active={samplerTab === n}
                disabled={disabled}
                onClick={() => setSamplerTab(n)}
                title={n === 4 ? 'Sub oscillator level' : n === 5 ? 'Noise generator level' : 'Oscillator 3 level'}
              >
                {n === 4 ? 'SUB' : n === 5 ? 'NOZ' : 'O3'}
              </AnaBtn>
            ))}
          </div>
        </SekModule>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 0 }}>
          <SekSequencerBrandBanner />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <AnaMacroKnob label="MACRO 1" value={voice.lfo1Depth} min={0} max={1} disabled={disabled} onChange={(v) => patchAudible({ lfo1Depth: v })} />
          <AnaMacroKnob label="MACRO 2" value={voice.filterResonanceQ} min={0.1} max={8} decimals={1} disabled={disabled} onChange={(v) => patchAudible({ filterResonanceQ: v })} />
          <AnaMacroKnob label="MACRO 3" value={voice.fx.reverbMix} min={0} max={1} disabled={disabled} onChange={(v) => patchAudible({ fx: { ...voice.fx, reverbMix: v } })} />
        </div>
        <SekModule title="Master" flex="0 0 120px" style={{ margin: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <AnaKnob label="Drive" value={voice.filterDrive} min={0} max={1} disabled={disabled} onChange={(v) => patchAudible({ filterDrive: v })} />
            <AnaKnob label="Volume" value={voice.outputLevel} min={0} max={1} disabled={disabled} onChange={(v) => patchAudible({ outputLevel: v })} />
            <SekLedMeter level={voice.outputLevel} />
          </div>
        </SekModule>
      </div>

      {/* ── MAIN: OSC A/B | Center display | Filter + Env ── */}
      <div style={{ display: 'flex', minHeight: 380, borderBottom: `1px solid ${SEKTOR.border}` }}>
        <div style={{ flex: '0 0 248px', padding: 6, borderRight: `1px solid ${SEKTOR.border}`, background: SEKTOR.bgPanel }}>
          {renderOscBlock('Oscillator A', 'osc1', voice.osc1)}
          {renderOscBlock('Oscillator B', 'osc2', voice.osc2)}
          {centerTab === 'arp' ? (
            <>
              <AnaArpGateFxSekModule disabled={disabled} />
              <AnaArpPumperFxSekModule disabled={disabled} />
            </>
          ) : null}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, padding: 6, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <AnaCenterRack
              voice={voice}
              disabled={disabled}
              bpm={bpm}
              arpTrackId={arpTrackId}
              arpBpm={arpBpm}
              onArpBpmChange={onArpBpmChange}
              basePitch={arpRootPitch}
              songKeyRoot={songKeyRoot}
              songKeyMode={songKeyMode}
              getArpVoice={getArpVoice}
              patchLabel={voice.label}
              activePresetId={presetId}
              onLoadPreset={loadPreset}
              onApplyVoice={applyEditedVoice}
              registerArpMelodyApplier={registerArpMelodyApplier}
              registerArpUserPatternApplier={registerArpUserPatternApplier}
              melodyTag={saveMelodyTag}
              activeMelodyLabel={activeMelodyLabel}
              onPatternSaved={handlePatternSaved}
              soundPresets={genoUltraSynthPresetsForCenterSoundPicker().map((p) => ({
                id: p.id,
                label: p.label,
                category: p.category,
              }))}
              getStripOutput={stableGetStripOutput}
              ensureAudioContext={ensureAudioContext}
              onArpStep={onArpStep}
              onApplyToPianoRoll={onApplyArpToPianoRoll}
              genoBuildSources={genoBuildSources}
              genoBuildImportTracks={genoBuildImportTracks}
              beatsPerBar={beatsPerBar}
              monophonic={mono}
              polyphony={polyphony}
              onMonophonicChange={(m) => {
                if (m) stopGenoUltraKeyboardPreviewVoices();
                setMono(m);
              }}
              se2SyncLocked={se2SyncLocked}
              se2TransportPlaying={se2TransportPlaying}
              onSe2SyncToggle={onSe2SyncToggle}
              getSe2PlayheadBeat={getSe2PlayheadBeat}
              getSe2TransportOriginBeat={getSe2TransportOriginBeat}
              keySourceTracks={keySourceTracks}
              keySourceTrackIndex={keySourceTrackIndex}
              onKeySourceTrackIndexChange={onKeySourceTrackIndexChange}
              onDetectKeyFromSourceTrack={onDetectKeyFromSourceTrack}
              followSe2SongKey={followSe2SongKey}
              onFollowSe2SongKeyChange={onFollowSe2SongKeyChange}
              getSe2TrackChordImport={getSe2TrackChordImport}
              followSourceTrackChords={followSourceTrackChords}
              arpPerformanceGetters={arpPerformanceGetters}
              centerTab={centerTab}
              onCenterTabChange={setCenterTab}
              fxSlot={fxSlot}
              onFxSlotChange={setFxSlot}
              onPatchVoice={patchAudible}
              navStyle="sektor"
              oscPlusExtra={
                <AnaOscSamplerPanel
                  voice={voice}
                  disabled={disabled}
                  scopeActive={scopeActive}
                  samplerTab={samplerTab}
                  onSamplerTabChange={setSamplerTab}
                  onPatch={patchAudible}
                />
              }
              modMatrix={
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8 }}>
                  <thead>
                    <tr style={{ color: SEKTOR.textDim }}>
                      <th style={{ width: 18 }}>#</th><th>SOURCE</th><th>DEST</th><th>AMT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voice.modSlots.slice(0, GENO_ULTRA_MOD_SLOT_COUNT).map((slot, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${SEKTOR.border}` }}>
                        <td style={{ color: SEKTOR.green, fontWeight: 900 }}>{i + 1}</td>
                        <td>
                          <select disabled={disabled} value={slot.source} onChange={(e) => patchModSlot(i, { source: e.target.value as GenoUltraModSource })} style={selectStyle}>
                            {MOD_SOURCES.map((s) => <option key={s} value={s}>{MOD_SRC_LABEL[s]}</option>)}
                          </select>
                        </td>
                        <td>
                          <select disabled={disabled} value={slot.dest} onChange={(e) => patchModSlot(i, { dest: e.target.value as GenoUltraModDest })} style={selectStyle}>
                            {MOD_DESTS.map((d) => <option key={d} value={d}>{MOD_DST_LABEL[d]}</option>)}
                          </select>
                        </td>
                        <td>
                          <AnaHorizFader value={slot.amount} min={-1} max={1} disabled={disabled} width={88} onChange={(v) => patchModSlot(i, { amount: v })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
              presetsPanel={
                <SekPresetBrowser
                  presetName={activeMelodyLabel || voice.label}
                  bankLabel="Geno Ultra"
                  leftItems={browserLeftItems}
                  activeLeftId={browserLeftId}
                  onLeftChange={setBrowserLeftId}
                  rightItems={browserRightItems}
                  activeRightId={browserActiveRightId}
                  onRightSelect={handleBrowserRightSelect}
                  onPrev={() => browserPrevNext(-1)}
                  onNext={() => browserPrevNext(1)}
                  disabled={disabled}
                />
              }
            />
          </div>
        </div>

        <div style={{ flex: '0 0 256px', padding: 6, borderLeft: `1px solid ${SEKTOR.border}`, background: SEKTOR.bgPanel, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SekModule title="Filter">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 4 }}>
              <SekOnBtn
                on={voice.filterEnabled !== false}
                disabled={disabled}
                onClick={() => patchAudible({ filterEnabled: voice.filterEnabled === false })}
                title="Filter on/off — bypass filter when off"
              />
              <SekOnBtn
                on={voice.filterEnvEnabled !== false}
                label="Env"
                disabled={disabled || voice.filterEnabled === false}
                onClick={() => patchAudible({ filterEnvEnabled: voice.filterEnvEnabled === false })}
                title="Filter envelope on/off"
              />
            </div>
            <AnaScopeFrame height={48}>
              <AnaWaveScreen path={filterResponsePath(voice.filterMode, voice.filterCutoffHz, voice.filterResonanceQ)} height={48} accent={SEKTOR.greenHi} />
            </AnaScopeFrame>
            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', margin: '4px 0' }}>
              {FILTER_MODES.map((m) => (
                <AnaBtn
                  key={m}
                  small
                  active={voice.filterMode === m}
                  disabled={disabled}
                  onClick={() => patchAudible({ filterMode: m })}
                  title={
                    m === 'lowpass'
                      ? 'Lowpass filter — cuts high frequencies'
                      : m === 'bandpass'
                        ? 'Bandpass filter — keeps mid band only'
                        : m === 'highpass'
                          ? 'Highpass filter — cuts low frequencies'
                          : 'Notch filter — cuts a narrow band'
                  }
                >
                  {m === 'lowpass' ? 'LP' : m === 'bandpass' ? 'BP' : m === 'highpass' ? 'HP' : 'N'}
                </AnaBtn>
              ))}
            </div>
            <AnaKnobRow>
              <AnaKnob label="Cutoff" value={voice.filterCutoffHz} min={80} max={12000} decimals={0} disabled={disabled} onChange={(v) => patchAudible({ filterCutoffHz: v })} />
              <AnaKnob label="Res" value={voice.filterResonanceQ} min={0.1} max={8} decimals={1} disabled={disabled} onChange={(v) => patchAudible({ filterResonanceQ: v })} />
              <AnaKnob label="Env" value={voice.filterSustain} min={0} max={1} disabled={disabled} onChange={(v) => patchAudible({ filterSustain: v })} />
              <AnaKnob label="Drive" value={voice.filterDrive} min={0} max={1} disabled={disabled} onChange={(v) => patchAudible({ filterDrive: v })} />
            </AnaKnobRow>
            <AnaKnobRow>
              <AnaKnob label="Key" value={voice.filterKeyTrack} min={0} max={1} disabled={disabled} onChange={(v) => patchAudible({ filterKeyTrack: v })} />
            </AnaKnobRow>
          </SekModule>
          <SekModule title="Envelope" flex="1">
            <AnaGraphicEnv attack={voice.ampAttackMs} decay={voice.ampDecayMs} sustain={voice.ampSustain} release={voice.ampReleaseMs} height={72} />
            <AnaKnobRow>
              <AnaKnob label="A" value={voice.ampAttackMs} min={0} max={800} decimals={0} disabled={disabled} onChange={(v) => patchAudible({ ampAttackMs: v })} />
              <AnaKnob label="D" value={voice.ampDecayMs} min={4} max={1200} decimals={0} disabled={disabled} onChange={(v) => patchAudible({ ampDecayMs: v })} />
              <AnaKnob label="S" value={voice.ampSustain} min={0} max={1} disabled={disabled} onChange={(v) => patchAudible({ ampSustain: v })} />
              <AnaKnob label="R" value={voice.ampReleaseMs} min={8} max={2000} decimals={0} disabled={disabled} onChange={(v) => patchAudible({ ampReleaseMs: v })} />
            </AnaKnobRow>
          </SekModule>
          <SekModule title="LFO">
            <div style={{ display: 'flex', gap: 3, marginBottom: 4, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 3 }}>
                {([1, 2] as const).map((n) => (
                  <AnaBtn key={n} small active={lfoTab === n} disabled={disabled} onClick={() => setLfoTab(n)}>
                    LFO {n}
                  </AnaBtn>
                ))}
              </div>
              <AnaLcdBar size="sm">{lfoTab === 1 ? 'FILTER WOB' : 'LFO 2'}</AnaLcdBar>
            </div>
            <AnaScopeFrame height={40}>
              <AnaWaveScreen path={lfoPath(lfoShape)} height={40} accent={SEKTOR.greenHi} />
            </AnaScopeFrame>
            <div style={{ display: 'flex', gap: 3, margin: '4px 0', flexWrap: 'wrap' }}>
              {LFO_SHAPES.map((w) => (
                <AnaBtn key={w} small active={lfoShape === w} disabled={disabled} onClick={() => patchLfoShape(w)} title={`LFO ${lfoTab} shape: ${w}`}>
                  {w.slice(0, 3)}
                </AnaBtn>
              ))}
            </div>
            <AnaKnobRow>
              <AnaKnob label="Depth" value={lfoDepth} min={0} max={1} disabled={disabled} onChange={(v) => patchAudible(lfoTab === 1 ? { lfo1Depth: v } : { lfo2Depth: v })} />
              <AnaKnob label="Rate" value={lfoRate} min={0.05} max={16} disabled={disabled} onChange={(v) => patchAudible(lfoTab === 1 ? { lfo1RateHz: v } : { lfo2RateHz: v })} />
            </AnaKnobRow>
          </SekModule>
        </div>
      </div>

      {/* ── FOOTER: mod tabs + wheels + keyboard ── */}
      <SekFooterTabs
        tabs={[
          { id: 'keys', label: 'Keys' },
          { id: 'xpression', label: 'Xpression' },
          { id: 'adsr', label: 'ADSR' },
          { id: 'modenv', label: 'Mod Env' },
          { id: 'lfo', label: 'LFO' },
          { id: 'matrix', label: 'Matrix' },
        ]}
        active={footerTab}
        onChange={setFooterTab}
      />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 10px', background: SEKTOR.bgInset }}>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <AnaWheel label="PITCH" value={pitchWheel} disabled={disabled} onChange={setPitchWheel} springCenter />
          <AnaWheel label="MOD" value={modWheel} disabled={disabled} onChange={setModWheel} />
        </div>
        <AnaPerformanceStrip
          mono={mono}
          legato={legato}
          slide={slide}
          slideAnchor={slideAnchor}
          bend={bendSt}
          poly={polyphony}
          portamento={portamentoMs}
          disabled={disabled}
          onMono={() => setMono((v) => !v)}
          onLegato={() => setLegato((v) => !v)}
          onSlide={() => setSlide((v) => !v)}
          onSlideAnchor={setSlideAnchor}
          onBend={setBendSt}
          onPoly={setPolyphony}
          onPortamento={setPortamentoMs}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* MIDI 48–71: C2–B3 (Yamaha); middle C = MIDI 60 labeled C3 */}
          <AnaKeyboard startOctave={4} octaves={2} activePitch={activePitch} disabled={disabled} onKey={previewAt} onKeyUp={releasePreview} />
        </div>
        <AnaChordMemoryPanel disabled={disabled} />
      </div>
      </div>
    </AnaWoodTrimFrame>
    </GenoUltraArpGateFxProvider>
  );
}

const selectStyle: CSSProperties = {
  width: '100%',
  fontSize: 8,
  padding: '3px 4px',
  borderRadius: 2,
  background: SEKTOR.bgInset,
  color: SEKTOR.textHi,
  border: `1px solid ${SEKTOR.border}`,
};
