'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { BeatLabSynthV2Oscilloscope } from '@/app/components/creation/BeatLabSynthV2Oscilloscope';
import {
  GenoBassBrandBanner,
  GenoBassBtn,
  GenoBassGrooveWoodEdgeFrame,
  GenoBassKeyboardBed,
  GenoBassLcd,
  GenoBassMainTabs,
  GenoBassMoogKnob,
  GenoBassOctaveStack,
  GenoBassSemiFineStack,
  GenoBassPresetBrowser,
  GenoBassSideRail,
  GenoBassStereoMeter,
  GenoBassSub52Frame,
  GenoBassWheel,
  GENO_BASS_THEME,
} from '@/app/components/studio/genoBassWoodUi';
import {
  genoBassPreviewVelocityMidi,
  genoBassRootFromOctaveShift,
  genoBassMidiNoteLabel,
  genoBassKeyboardStartOctave,
  previewGenoBassKeyboardNote,
  GENO_BASS_OCTAVE_SHIFTS,
  type GenoBassOctaveShift,
} from '@/app/lib/studio/genoBassLoopExport';
import type { GenoUltraArpSe2RollNote } from '@/app/lib/studio/genoUltraArpExport';
import type { GenoUltraSynthVoiceParams } from '@/app/lib/studio/genoUltraSynthTypes';
import { genoUltraVoicePreviewHoldSec } from '@/app/lib/studio/genoUltraSynthTypes';
import {
  GENO_BASS_CINEMATIC_PRESET_IDS,
  GENO_BASS_DEFAULT_PRESET_ID,
  GENO_BASS_GROUP_LABELS,
  GENO_BASS_SYNTH_PRESETS,
  genoBassPresetById,
  type GenoBassSynthGroup,
} from '@/app/lib/studio/genoBassSynthPresets';
import { setGenoUltraSynthPanelActive } from '@/app/lib/creationStation/creationTransportSync';
import {
  stopGenoUltraArpPreviewVoices,
} from '@/app/lib/studio/se2GenoUltraSynthPreview';
import { stopGenoBassLoopPreview } from '@/app/lib/studio/genoBassLoopPreview';
import { ensureGenoCinematicOrchestraHitReady } from '@/app/lib/studio/genoCinematicOrchestraPlayback';
import { resolveGenoUltraStripOutput } from '@/app/lib/studio/genoUltraSynthMeterBus';
import {
  genoBassVoiceForGrooveSoundMatch,
  type GenoBassGrooveSoundMatch,
} from '@/app/lib/studio/genoBassGrooveSoundMatch';
import {
  GENO_BASS_LOOP_EDITOR_MAX,
  GENO_BASS_LOOP_EDITOR_MIN,
  GENO_BASS_LOOP_DEFAULT_ROOT,
} from '@/app/lib/studio/genoBassGroovePresets';
import { AnaHorizFader, AnaKeyboard } from '@/app/components/studio/genoUltraAnaUi';
import { GenoBassEnvScreen } from '@/app/components/studio/genoBassEnvScreen';
import { GenoBassFxPanel } from '@/app/components/studio/GenoBassFxPanel';
import { GenoBassModPanel } from '@/app/components/studio/GenoBassModPanel';

const GenoBassLoopPanel = lazy(() =>
  import('@/app/components/studio/GenoBassLoopPanel').then((m) => ({ default: m.GenoBassLoopPanel })),
);

type Se2GenoBassSynthErrorBoundaryProps = {
  children: React.ReactNode;
};

type Se2GenoBassSynthErrorBoundaryState = {
  error: Error | null;
};

class Se2GenoBassSynthErrorBoundary extends React.Component<
  Se2GenoBassSynthErrorBoundaryProps,
  Se2GenoBassSynthErrorBoundaryState
> {
  state: Se2GenoBassSynthErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): Se2GenoBassSynthErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            border: '1px solid #c9a86a66',
            background: 'rgba(26,21,16,0.9)',
            color: '#e8d4b0',
            fontSize: 10,
            lineHeight: 1.45,
          }}
        >
          <strong style={{ display: 'block', marginBottom: 6, color: '#f0c060' }}>
            Geno Bass panel could not load
          </strong>
          Hide this strip and try again, or refresh the page. Your project is still saved.
          <pre
            style={{
              marginTop: 8,
              fontSize: 9,
              whiteSpace: 'pre-wrap',
              color: '#a89068',
            }}
          >
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export type Se2GenoBassSynthPanelProps = {
  accentHex?: string;
  disabled?: boolean;
  voice: GenoUltraSynthVoiceParams;
  presetId: string;
  bpm?: number;
  beatsPerBar?: number;
  songKeyRoot?: number;
  songKeyMode?: import('@/app/lib/studio/studioAudioClipAnalysis').StudioDetectedKeyMode;
  getStripOutput?: (ctx: AudioContext) => AudioNode;
  ensureAudioContext?: () => Promise<AudioContext>;
  onVoiceChange: (voice: GenoUltraSynthVoiceParams) => void;
  onPresetIdChange: (id: string) => void;
  onPatchLabelChange: (label: string) => void;
  onApplyLoopToPianoRoll?: (notes: GenoUltraArpSe2RollNote[]) => void;
  se2TransportPlaying?: boolean;
  getSe2PlayheadBeat?: () => number;
  getSe2TransportOriginBeat?: () => number;
  keySourceTracks?: readonly import('@/app/lib/studio/genoUltraArpKeySource').GenoUltraArpKeySourceTrack[];
  keySourceTrackIndex?: number;
  onKeySourceTrackIndexChange?: (trackIndex: number) => void;
  onDetectKeyFromSourceTrack?: (trackIndex: number) => boolean | void;
  getSe2TrackChordImport?: (
    trackIndex: number,
    barLength: import('@/app/lib/studio/genoBassLoopExport').GenoBassLoopBarLength,
  ) => import('@/app/lib/studio/genoUltraArpChordImport').GenoUltraArpChordImportResult | { message: string };
  getSe2TrackMidiImport?: (
    trackIndex: number,
  ) => import('@/app/lib/studio/genoBassMidiImport').GenoBassMidiImportResult | { message: string };
  followSourceTrackChords?: boolean;
  onPresetBpmChange?: (bpm: number) => void;
};

const BASS_GROUPS: GenoBassSynthGroup[] = ['moog', 'roland', 'dx', 'analog', 'sub', 'funk', 'cinematic'];

type GenoBassCenterTab = 'library' | 'osc' | 'groove' | 'mod' | 'fx';

const GENO_BASS_CENTER_TABS: readonly { id: GenoBassCenterTab; label: string; title: string }[] = [
  { id: 'library', label: 'Library', title: 'Sound bank — bass & other patches' },
  { id: 'osc', label: 'OSC', title: 'Oscillators & tone source' },
  { id: 'groove', label: 'Groove', title: 'Bass piano grid & pattern generator' },
  { id: 'mod', label: 'Mod', title: 'LFOs & modulation envelope' },
  { id: 'fx', label: 'FX', title: 'Chorus, delay & reverb' },
];

const GENO_BASS_BODY_H_PX = 368;
/** Groove only — center roll grows past side rails, overlaps wood band above keys (keys unchanged). */
const GENO_BASS_GROOVE_CENTER_EXTRA_PX = 96;
const GENO_BASS_GROOVE_OVERLAP_WOOD_PX = 78;
const GENO_BASS_FIRMWARE_LABEL = '52.1.0';

export function Se2GenoBassSynthPanel({
  disabled = false,
  voice,
  presetId,
  bpm = 120,
  beatsPerBar = 4,
  songKeyRoot = 0,
  songKeyMode = 'major',
  getStripOutput,
  ensureAudioContext,
  onVoiceChange,
  onPresetIdChange,
  onPatchLabelChange,
  onApplyLoopToPianoRoll,
  se2TransportPlaying = false,
  getSe2PlayheadBeat,
  getSe2TransportOriginBeat,
  keySourceTracks,
  keySourceTrackIndex,
  onKeySourceTrackIndexChange,
  onDetectKeyFromSourceTrack,
  getSe2TrackChordImport,
  getSe2TrackMidiImport,
  followSourceTrackChords,
  onPresetBpmChange,
}: Se2GenoBassSynthPanelProps) {
  const [activeGroup, setActiveGroup] = useState<GenoBassSynthGroup>(
    () => genoBassPresetById(presetId).bassGroup,
  );
  const [centerTab, setCenterTab] = useState<GenoBassCenterTab>('library');
  const [modWheel, setModWheel] = useState(0);
  const [pitchWheel, setPitchWheel] = useState(0);
  const [activePitch, setActivePitch] = useState<number | null>(null);
  const [octaveShift, setOctaveShift] = useState<GenoBassOctaveShift>(0);
  const [mono, setMono] = useState(true);
  const [portamentoMs, setPortamentoMs] = useState(0);
  const [meterLevel, setMeterLevel] = useState(0);
  const [loopPreviewActive, setLoopPreviewActive] = useState(false);
  const loopPreviewActiveRef = useRef(false);
  loopPreviewActiveRef.current = loopPreviewActive;
  const previewPitchRef = useRef(GENO_BASS_LOOP_DEFAULT_ROOT);
  const ctxRef = useRef<AudioContext | null>(null);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const getStripOutputRef = useRef(getStripOutput);
  getStripOutputRef.current = getStripOutput;

  const bendSt = 2;

  const generationRoot = useMemo(() => genoBassRootFromOctaveShift(octaveShift), [octaveShift]);
  const keyboardStartOctave = useMemo(
    () => genoBassKeyboardStartOctave(generationRoot),
    [generationRoot],
  );

  const shiftOctave = useCallback((dir: -1 | 1) => {
    setOctaveShift((s) => {
      const idx = GENO_BASS_OCTAVE_SHIFTS.indexOf(s);
      const nextIdx = Math.max(0, Math.min(GENO_BASS_OCTAVE_SHIFTS.length - 1, idx + dir));
      return GENO_BASS_OCTAVE_SHIFTS[nextIdx] ?? s;
    });
  }, []);

  const stableGetStripOutput = useCallback((ctx: AudioContext) => {
    const raw = getStripOutputRef.current?.(ctx) ?? ctx.destination;
    return resolveGenoUltraStripOutput(ctx, raw);
  }, []);

  const primeAudio = useCallback(async (): Promise<AudioContext | null> => {
    try {
      if (!ensureAudioContext) return null;
      const ctx = await ensureAudioContext();
      if (!ctx || ctx.state === 'closed') return null;
      if (ctx.state === 'suspended') await ctx.resume();
      return ctx;
    } catch {
      return null;
    }
  }, [ensureAudioContext]);

  useEffect(() => {
    setActiveGroup(genoBassPresetById(presetId).bassGroup);
  }, [presetId]);

  useEffect(() => {
    setGenoUltraSynthPanelActive(true);
    void primeAudio().then((ctx) => {
      if (ctx) ctxRef.current = ctx;
    });
    return () => {
      setGenoUltraSynthPanelActive(false);
      stopGenoBassLoopPreview();
      stopGenoUltraArpPreviewVoices();
    };
  }, [primeAudio]);

  useEffect(() => {
    previewPitchRef.current = generationRoot;
  }, [generationRoot]);

  const releasePreview = useCallback(() => {
    setActivePitch(null);
  }, []);

  const patchAudible = useCallback(
    (patch: Partial<GenoUltraSynthVoiceParams>) => {
      onVoiceChange({ ...voiceRef.current, ...patch, label: voiceRef.current.label });
    },
    [onVoiceChange],
  );

  const filterEnvAmt =
    voice.modSlots[0]?.source === 'filterEnv' && voice.modSlots[0]?.dest === 'filterCutoff'
      ? voice.modSlots[0].amount
      : 0;

  const patchFilterEnvAmt = useCallback(
    (amt: number) => {
      const slots = voiceRef.current.modSlots.map((s, i) =>
        i === 0
          ? { source: 'filterEnv' as const, dest: 'filterCutoff' as const, amount: amt }
          : { ...s },
      );
      patchAudible({ modSlots: slots });
    },
    [patchAudible],
  );

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setMeterLevel((lv) => (lv <= 0.015 ? 0 : lv * 0.9));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const bumpMeter = useCallback((voiceLevel: number) => {
    setMeterLevel((lv) => Math.max(lv, Math.min(1, voiceLevel * 0.85 + 0.12)));
  }, []);

  const loadPreset = useCallback(
    (id: string) => {
      const hit = GENO_BASS_SYNTH_PRESETS.find((p) => p.id === id);
      if (!hit) return;
      if (!loopPreviewActiveRef.current) stopGenoBassLoopPreview();
      stopGenoUltraArpPreviewVoices();
      setActiveGroup(hit.bassGroup);
      onPresetIdChange(id);
      onPatchLabelChange(hit.label);
      onVoiceChange({
        ...hit,
        modSlots: hit.modSlots.map((s) => ({ ...s })),
        fx: { ...hit.fx },
        osc1: { ...hit.osc1 },
        osc2: { ...hit.osc2 },
        osc3: { ...hit.osc3 },
      });
      if (hit.bassGroup === 'cinematic') {
        void primeAudio().then((ctx) => {
          if (ctx) void ensureGenoCinematicOrchestraHitReady(ctx, id);
        });
      }
    },
    [onPatchLabelChange, onPresetIdChange, onVoiceChange, primeAudio],
  );

  const onGrooveSoundPresetChange = useCallback(
    (match: GenoBassGrooveSoundMatch) => {
      const bank = genoBassPresetById(match.soundPresetId);
      const hit = genoBassVoiceForGrooveSoundMatch(match);
      if (!loopPreviewActiveRef.current) stopGenoBassLoopPreview();
      stopGenoUltraArpPreviewVoices();
      setActiveGroup(bank.bassGroup);
      onPresetIdChange(match.soundPresetId);
      onPatchLabelChange(hit.label);
      onVoiceChange({
        ...hit,
        label: bank.label,
        modSlots: hit.modSlots.map((s) => ({ ...s })),
        fx: { ...hit.fx },
        osc1: { ...hit.osc1 },
        osc2: { ...hit.osc2 },
        osc3: { ...hit.osc3 },
      });
    },
    [onPatchLabelChange, onPresetIdChange, onVoiceChange],
  );

  const onApplySavedVoice = useCallback(
    (savedVoice: GenoUltraSynthVoiceParams, soundPresetId: string, label: string) => {
      const bank = genoBassPresetById(soundPresetId);
      if (!loopPreviewActiveRef.current) stopGenoBassLoopPreview();
      stopGenoUltraArpPreviewVoices();
      setActiveGroup(bank.bassGroup);
      onPresetIdChange(soundPresetId);
      onPatchLabelChange(label);
      onVoiceChange({
        ...savedVoice,
        label: savedVoice.label || label,
        modSlots: savedVoice.modSlots.map((s) => ({ ...s })),
        fx: { ...savedVoice.fx },
        osc1: { ...savedVoice.osc1 },
        osc2: { ...savedVoice.osc2 },
        osc3: { ...savedVoice.osc3 },
      });
    },
    [onPatchLabelChange, onPresetIdChange, onVoiceChange],
  );

  const previewAt = useCallback(
    (pitch: number) => {
      const bent = Math.max(
        GENO_BASS_LOOP_EDITOR_MIN,
        Math.min(
          GENO_BASS_LOOP_EDITOR_MAX,
          Math.round(pitch + pitchWheel * bendSt),
        ),
      );
      previewPitchRef.current = bent;
      setActivePitch(bent);
      stopGenoBassLoopPreview();

      const play = (ctx: AudioContext) => {
        previewGenoBassKeyboardNote(
          ctx,
          stableGetStripOutput(ctx),
          bent,
          genoBassPreviewVelocityMidi(112),
          voiceRef.current,
          bpm,
          Math.max(0.65, genoUltraVoicePreviewHoldSec(voiceRef.current)),
          activeGroup,
        );
        bumpMeter(voiceRef.current.outputLevel);
      };

      const cached = ctxRef.current;
      if (cached && cached.state !== 'closed') {
        if (cached.state === 'suspended') {
          void cached.resume().then(() => play(cached));
        } else {
          play(cached);
        }
        return;
      }
      void primeAudio().then((ctx) => {
        if (!ctx) return;
        ctxRef.current = ctx;
        play(ctx);
      });
    },
    [activeGroup, bpm, pitchWheel, primeAudio, stableGetStripOutput, bumpMeter],
  );

  const leftItems = useMemo(
    () =>
      BASS_GROUPS.map((g) => ({
        id: g,
        label: GENO_BASS_GROUP_LABELS[g],
      })),
    [],
  );

  const rightItems = useMemo(
    () =>
      GENO_BASS_SYNTH_PRESETS.filter((p) => p.bassGroup === activeGroup).map((p) => ({
        id: p.id,
        label: p.label,
      })),
    [activeGroup],
  );

  useEffect(() => {
    if (activeGroup !== 'cinematic') return;
    if (GENO_BASS_CINEMATIC_PRESET_IDS.includes(presetId)) return;
    const fallback = rightItems[0]?.id ?? GENO_BASS_CINEMATIC_PRESET_IDS[0];
    if (fallback) loadPreset(fallback);
  }, [activeGroup, presetId, rightItems, loadPreset]);

  const activeInGroup =
    rightItems.find((p) => p.id === presetId)?.id ?? rightItems[0]?.id ?? presetId;

  const scopeLive = activePitch !== null || loopPreviewActive;

  const cyclePreset = useCallback(
    (dir: -1 | 1) => {
      const all = GENO_BASS_SYNTH_PRESETS;
      const idx = all.findIndex((p) => p.id === presetId);
      const next = all[(idx + dir + all.length) % all.length];
      if (next) loadPreset(next.id);
    },
    [loadPreset, presetId],
  );

  const loopPanelProps = {
    embedded: true as const,
    disabled,
    bpm,
    beatsPerBar,
    songKeyRoot,
    songKeyMode,
    voice,
    basePitch: generationRoot,
    ensureAudioContext,
    getStripOutput,
    onApplyToPianoRoll: onApplyLoopToPianoRoll,
    se2TransportPlaying,
    getSe2PlayheadBeat,
    getSe2TransportOriginBeat,
    keySourceTracks,
    keySourceTrackIndex,
    onKeySourceTrackIndexChange,
    onDetectKeyFromSourceTrack,
    getSe2TrackChordImport,
    getSe2TrackMidiImport,
    followSourceTrackChords,
    onPresetBpmChange,
    onSoundPresetChange: onGrooveSoundPresetChange,
    onSeqActiveChange: setLoopPreviewActive,
    soundPresetId: presetId,
    patchLabel: voice.label,
    onApplySavedVoice,
    previewHeldPitch: activePitch,
    onPianoKeyPreview: previewAt,
    onPianoKeyRelease: releasePreview,
  };

  const grooveLayout = centerTab === 'groove';

  return (
    <Se2GenoBassSynthErrorBoundary>
    <GenoBassSub52Frame className="geno-bass-52" style={{ minWidth: 940 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: GENO_BASS_THEME.panel,
          color: GENO_BASS_THEME.label,
          fontFamily: 'system-ui, Segoe UI, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 12px',
            borderBottom: `1px solid ${GENO_BASS_THEME.borderSection}`,
            background: `linear-gradient(180deg, ${GENO_BASS_THEME.panelHi} 0%, ${GENO_BASS_THEME.panel} 100%)`,
            flexShrink: 0,
          }}
        >
          <GenoBassBrandBanner />
          <GenoBassLcd sub="ACTIVE PATCH">{voice.label || 'Init Bass'}</GenoBassLcd>
          <GenoBassLcd sub="FIRMWARE" width={72}>
            {GENO_BASS_FIRMWARE_LABEL}
          </GenoBassLcd>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <GenoBassBtn small disabled={disabled} onClick={() => cyclePreset(-1)} title="Previous sound">
              ◀
            </GenoBassBtn>
            <GenoBassBtn small disabled={disabled} onClick={() => cyclePreset(1)} title="Next sound">
              ▶
            </GenoBassBtn>
          </div>
        </div>

        {/* SPHINX-style body — fixed height, side rails + tabbed center */}
        <div
          style={{
            display: 'flex',
            alignItems: grooveLayout ? 'flex-start' : 'stretch',
            height: grooveLayout ? undefined : GENO_BASS_BODY_H_PX,
            minHeight: grooveLayout ? undefined : GENO_BASS_BODY_H_PX,
            maxHeight: grooveLayout ? undefined : GENO_BASS_BODY_H_PX,
            overflow: grooveLayout ? 'visible' : 'hidden',
            borderBottom: grooveLayout ? undefined : `1px solid ${GENO_BASS_THEME.border}`,
          }}
        >
          {/* Left rail — filter envelope + filter */}
          <GenoBassSideRail
            title="FILTER ENV"
            style={
              grooveLayout
                ? { height: GENO_BASS_BODY_H_PX, minHeight: GENO_BASS_BODY_H_PX, maxHeight: GENO_BASS_BODY_H_PX }
                : undefined
            }
          >
            <GenoBassEnvScreen
              label="FILTER ENV"
              variant="filter"
              attack={voice.filterAttackMs}
              decay={voice.filterDecayMs}
              sustain={voice.filterSustain}
              release={voice.filterReleaseMs}
              height={58}
            />
            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
              <GenoBassMoogKnob label="A" value={voice.filterAttackMs} min={0} max={800} decimals={0} disabled={disabled} onChange={(v) => patchAudible({ filterAttackMs: v })} />
              <GenoBassMoogKnob label="D" value={voice.filterDecayMs} min={4} max={1200} decimals={0} disabled={disabled} onChange={(v) => patchAudible({ filterDecayMs: v })} />
              <GenoBassMoogKnob label="S" value={voice.filterSustain} min={0} max={1} decimals={2} disabled={disabled} onChange={(v) => patchAudible({ filterSustain: v })} />
              <GenoBassMoogKnob label="R" value={voice.filterReleaseMs} min={8} max={2000} decimals={0} disabled={disabled} onChange={(v) => patchAudible({ filterReleaseMs: v })} />
              <GenoBassMoogKnob label="Amt" value={filterEnvAmt} min={0} max={1} decimals={2} disabled={disabled} onChange={patchFilterEnvAmt} />
            </div>
            <div style={{ fontSize: 7, fontWeight: 800, color: GENO_BASS_THEME.labelDim, letterSpacing: '0.12em', textAlign: 'center', marginTop: 4 }}>
              FILTER
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
              <GenoBassMoogKnob label="Cut" large value={voice.filterCutoffHz} min={80} max={8000} disabled={disabled} onChange={(v) => patchAudible({ filterCutoffHz: v })} />
              <GenoBassMoogKnob label="Res" value={voice.filterResonanceQ} min={0.1} max={8} decimals={1} disabled={disabled} onChange={(v) => patchAudible({ filterResonanceQ: v })} />
              <GenoBassMoogKnob label="Key" value={voice.filterKeyTrack} min={0} max={1} decimals={2} disabled={disabled} onChange={(v) => patchAudible({ filterKeyTrack: v })} />
            </div>
          </GenoBassSideRail>

          {/* Center — tabbed workspace */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              background: GENO_BASS_THEME.panel,
              position: grooveLayout ? 'relative' : undefined,
              zIndex: grooveLayout ? 2 : undefined,
              ...(grooveLayout
                ? {
                    height: GENO_BASS_BODY_H_PX + GENO_BASS_GROOVE_CENTER_EXTRA_PX,
                    minHeight: GENO_BASS_BODY_H_PX + GENO_BASS_GROOVE_CENTER_EXTRA_PX,
                    maxHeight: GENO_BASS_BODY_H_PX + GENO_BASS_GROOVE_CENTER_EXTRA_PX,
                    marginBottom: -GENO_BASS_GROOVE_OVERLAP_WOOD_PX,
                  }
                : {
                    height: GENO_BASS_BODY_H_PX,
                    minHeight: GENO_BASS_BODY_H_PX,
                    maxHeight: GENO_BASS_BODY_H_PX,
                  }),
            }}
          >
            <GenoBassMainTabs tabs={GENO_BASS_CENTER_TABS} active={centerTab} onChange={(id) => setCenterTab(id as GenoBassCenterTab)} />
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                padding: centerTab === 'library' ? 0 : grooveLayout ? '8px 8px 0' : 8,
                position: grooveLayout ? 'relative' : undefined,
              }}
            >
              {grooveLayout ? <GenoBassGrooveWoodEdgeFrame overlapPx={GENO_BASS_GROOVE_OVERLAP_WOOD_PX} /> : null}
              {centerTab === 'library' ? (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 8, gap: 6 }}>
                  <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                    <GenoBassPresetBrowser
                      bankLabel="Sound Bank"
                      leftItems={leftItems}
                      activeLeftId={activeGroup}
                      onLeftChange={(id) => setActiveGroup(id as GenoBassSynthGroup)}
                      rightItems={rightItems}
                      activeRightId={activeInGroup}
                      onRightSelect={loadPreset}
                      onPrev={() => cyclePreset(-1)}
                      onNext={() => cyclePreset(1)}
                      disabled={disabled}
                    />
                  </div>
                  <div
                    style={{
                      flexShrink: 0,
                      borderRadius: 3,
                      border: `1px solid ${GENO_BASS_THEME.border}`,
                      background: '#000',
                      overflow: 'hidden',
                      padding: '2px 4px',
                    }}
                  >
                    <BeatLabSynthV2Oscilloscope
                      osc1Wave={voice.osc1.wave}
                      osc2Wave={voice.osc2.wave}
                      level1={voice.osc1.level}
                      level2={voice.osc2.level}
                      height={36}
                      width={360}
                      active={scopeLive}
                    />
                  </div>
                </div>
              ) : null}

              {centerTab === 'osc' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div
                      style={{
                        borderRadius: 3,
                        border: `1px solid ${GENO_BASS_THEME.border}`,
                        background: '#000',
                        overflow: 'hidden',
                      }}
                    >
                      <BeatLabSynthV2Oscilloscope
                        osc1Wave={voice.osc1.wave}
                        osc2Wave={voice.osc2.wave}
                        level1={voice.osc1.level}
                        level2={voice.osc2.level}
                        height={56}
                        width={148}
                        active={scopeLive}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 7, fontWeight: 800, color: GENO_BASS_THEME.labelDim, marginBottom: 4 }}>OSC 1</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(['saw', 'square', 'triangle', 'sine'] as const).map((w) => (
                          <GenoBassBtn key={w} small active={voice.osc1.wave === w} disabled={disabled} onClick={() => patchAudible({ osc1: { ...voice.osc1, wave: w } })}>
                            {w.slice(0, 3).toUpperCase()}
                          </GenoBassBtn>
                        ))}
                      </div>
                      <div style={{ fontSize: 7, fontWeight: 800, color: GENO_BASS_THEME.labelDim, margin: '6px 0 4px' }}>OSC 2</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(['saw', 'square', 'triangle', 'sine'] as const).map((w) => (
                          <GenoBassBtn key={`o2-${w}`} small active={voice.osc2.wave === w} disabled={disabled} onClick={() => patchAudible({ osc2: { ...voice.osc2, wave: w } })}>
                            {w.slice(0, 3).toUpperCase()}
                          </GenoBassBtn>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <GenoBassMoogKnob label="Osc 1" value={voice.osc1.level} min={0} max={1} decimals={2} disabled={disabled} onChange={(v) => patchAudible({ osc1: { ...voice.osc1, level: v } })} />
                    <GenoBassMoogKnob label="Osc 2" value={voice.osc2.level} min={0} max={1} decimals={2} disabled={disabled} onChange={(v) => patchAudible({ osc2: { ...voice.osc2, level: v } })} />
                    <GenoBassMoogKnob label="Osc 3" value={voice.osc3.level} min={0} max={1} decimals={2} disabled={disabled} onChange={(v) => patchAudible({ osc3: { ...voice.osc3, level: v } })} />
                    <GenoBassMoogKnob label="Sub" value={voice.subLevel} min={0} max={1} decimals={2} disabled={disabled} onChange={(v) => patchAudible({ subLevel: v })} />
                    <GenoBassMoogKnob label="Noise" value={voice.noiseLevel} min={0} max={1} decimals={2} disabled={disabled} onChange={(v) => patchAudible({ noiseLevel: v })} />
                    <GenoBassMoogKnob label="Drive" value={voice.filterDrive} min={0} max={1} decimals={2} disabled={disabled} onChange={(v) => patchAudible({ filterDrive: v })} />
                    <GenoBassMoogKnob label="Uni" value={voice.unisonVoices} min={1} max={4} decimals={0} disabled={disabled} onChange={(v) => patchAudible({ unisonVoices: Math.round(v) })} />
                  </div>
                </div>
              ) : null}

              {/* Stay mounted while editing — loop preview keeps running across Osc / Mod / FX tabs */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: centerTab === 'groove' ? 'flex' : 'none',
                  flexDirection: 'column',
                }}
              >
                <Suspense
                  fallback={
                    <div style={{ padding: 16, fontSize: 9, color: GENO_BASS_THEME.labelDim, textAlign: 'center' }}>
                      Loading bass groove…
                    </div>
                  }
                >
                  <GenoBassLoopPanel {...loopPanelProps} grooveTallRoll />
                </Suspense>
              </div>

              {centerTab === 'mod' ? (
                <GenoBassModPanel voice={voice} disabled={disabled} onPatchVoice={patchAudible} />
              ) : null}

              {centerTab === 'fx' ? (
                <GenoBassFxPanel voice={voice} disabled={disabled} onPatchVoice={patchAudible} />
              ) : null}
            </div>
          </div>

          {/* Right rail — amp envelope + voice / output */}
          <GenoBassSideRail
            title="AMPLIFIER"
            width={156}
            edge="right"
            style={
              grooveLayout
                ? { height: GENO_BASS_BODY_H_PX, minHeight: GENO_BASS_BODY_H_PX, maxHeight: GENO_BASS_BODY_H_PX }
                : undefined
            }
          >
            <GenoBassEnvScreen
              label="AMP ENV"
              variant="amp"
              attack={voice.ampAttackMs}
              decay={voice.ampDecayMs}
              sustain={voice.ampSustain}
              release={voice.ampReleaseMs}
              height={58}
            />
            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
              <GenoBassMoogKnob label="A" value={voice.ampAttackMs} min={0} max={800} decimals={0} disabled={disabled} onChange={(v) => patchAudible({ ampAttackMs: v })} />
              <GenoBassMoogKnob label="D" value={voice.ampDecayMs} min={4} max={1200} decimals={0} disabled={disabled} onChange={(v) => patchAudible({ ampDecayMs: v })} />
              <GenoBassMoogKnob label="S" value={voice.ampSustain} min={0} max={1} decimals={2} disabled={disabled} onChange={(v) => patchAudible({ ampSustain: v })} />
              <GenoBassMoogKnob label="R" value={voice.ampReleaseMs} min={8} max={2000} decimals={0} disabled={disabled} onChange={(v) => patchAudible({ ampReleaseMs: v })} />
            </div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 6, flexWrap: 'wrap' }}>
              <GenoBassBtn small active={mono} disabled={disabled} onClick={() => setMono((m) => !m)}>
                {mono ? 'MONO' : 'POLY'}
              </GenoBassBtn>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 7, fontWeight: 800, color: GENO_BASS_THEME.labelDim, letterSpacing: '0.1em', marginBottom: 4 }}>PORTA</div>
              <AnaHorizFader value={portamentoMs} min={0} max={500} disabled={disabled} onChange={setPortamentoMs} width={132} />
            </div>
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 7, fontWeight: 800, color: GENO_BASS_THEME.labelDim, letterSpacing: '0.1em', marginBottom: 4, textAlign: 'center' }}>
                OUTPUT
              </div>
              <GenoBassStereoMeter level={meterLevel} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
              <GenoBassMoogKnob label="Vol" large value={voice.outputLevel} min={0} max={1} decimals={2} disabled={disabled} onChange={(v) => patchAudible({ outputLevel: v })} />
            </div>
          </GenoBassSideRail>
        </div>

        {/* Keyboard deck */}
        <GenoBassKeyboardBed>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              <GenoBassOctaveStack
                octaveLabel={genoBassMidiNoteLabel(generationRoot)}
                disabled={disabled}
                onOctaveDown={() => shiftOctave(-1)}
                onOctaveUp={() => shiftOctave(1)}
                octaveDownDisabled={octaveShift <= -2}
                octaveUpDisabled={octaveShift >= 2}
              />
              <GenoBassWheel
                label="PITCH"
                value={pitchWheel}
                disabled={disabled}
                onChange={setPitchWheel}
                springCenter
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              <GenoBassSemiFineStack
                semi={voice.osc1.semitone}
                fineCents={voice.osc1.fineCents}
                disabled={disabled}
                onSemiChange={(v) => patchAudible({ osc1: { ...voice.osc1, semitone: Math.round(v) } })}
                onFineChange={(v) => patchAudible({ osc1: { ...voice.osc1, fineCents: Math.round(v) } })}
              />
              <GenoBassWheel label="MOD" value={modWheel} disabled={disabled} onChange={setModWheel} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <AnaKeyboard
                startOctave={keyboardStartOctave}
                octaves={2}
                activePitch={activePitch}
                disabled={disabled}
                onKey={previewAt}
                onKeyUp={releasePreview}
              />
            </div>
          </div>
        </GenoBassKeyboardBed>
      </div>
    </GenoBassSub52Frame>
    </Se2GenoBassSynthErrorBoundary>
  );
}
