'use client';

import { useCallback, useMemo, useRef, useState, useEffect, type ReactNode, Component } from 'react';
import { ChevronLeft, ChevronRight, Music2, Plus } from 'lucide-react';
import { useMasterClock } from '@/app/context/MasterClockContext';

import {
  SE2_GUITAR_INSTRUMENT_OPTIONS,
  se2SanitizeGuitarInstrumentId,
  type Se2GuitarInstrumentId,
} from '@/app/lib/studio/se2GuitarInstruments';
import {
  SE2_GUITAR_RIG_PRESETS,
  se2GuitarRigCategoryLabel,
  se2GuitarRigPresetIndex,
  type Se2GuitarRigPreset,
} from '@/app/lib/studio/se2GuitarRigPresets';
import { SE2_GUITAR_LICKS, se2GuitarLickNotesAtBar, type Se2GuitarLickId } from '@/app/lib/studio/se2GuitarLicks';
import { auditionSe2GuitarNote, ensureSe2GuitarAudioReady, previewSe2GuitarStrumNotes, warmupSe2GuitarInstrument } from '@/app/lib/studio/se2GuitarSoundfont';
import type { Se2GuitarTrack, Se2GuitarMockNote } from '@/app/lib/studio/se2GuitarTrack';
import { se2GuitarMidisToFretDots, type Se2GuitarFretDot } from '@/app/lib/studio/se2GuitarFretboard';
import { Se2GuitarFxStrip } from '@/app/components/studio/Se2GuitarFxStrip';
import { Se2GuitarTabChrome } from '@/app/components/studio/Se2GuitarTabChrome';
import { Se2GuitarMainPage } from '@/app/components/studio/Se2GuitarMainPage';
import { Se2GuitarDarkSelect } from '@/app/components/studio/Se2GuitarDarkSelect';
import { Se2GuitarStrummerPanel } from '@/app/components/studio/Se2GuitarStrummerPanel';
import { Se2GuitarStrumGridPanel } from '@/app/components/studio/Se2GuitarLoopWorkstation';
import { Se2GuitarLoopsPanel } from '@/app/components/studio/Se2GuitarLoopsPanel';
import { se2GuitarFxFromTrack, type Se2GuitarFxSettings } from '@/app/lib/studio/se2GuitarFx';
import { subscribeSe2GuitarVisualNotes } from '@/app/lib/studio/se2GuitarVisualBus';
import {
  se2GuitarApplyArticulationToVelocity,
  se2GuitarArticulationInsertNote,
  se2GuitarArticulationVoice,
  se2GuitarResolvePreviewInstrument,
  type Se2GuitarArticulationId,
} from '@/app/lib/studio/se2GuitarArticulation';
import type { Se2GuitarScaleId } from '@/app/lib/studio/se2GuitarScales';
import {
  se2GuitarKeySemitoneDelta,
  type Se2GuitarKeyConvertSelection,
} from '@/app/lib/studio/se2GuitarKeyConvert';
import type { Se2GuitarPartBars } from '@/app/lib/studio/se2GuitarPartBars';

import { SE2_GUITAR_UI } from '@/app/lib/studio/se2GuitarUiTheme';

const ACCENT = SE2_GUITAR_UI.accent;

type Se2GuitarTab = 'main' | 'strummer' | 'loops' | 'fx';

const TABS: { id: Se2GuitarTab; label: string }[] = [
  { id: 'main', label: 'Main' },
  { id: 'strummer', label: 'Strummer' },
  { id: 'loops', label: 'Loops' },
  { id: 'fx', label: 'FX' },
];

class Se2GuitarPanelErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="rounded border px-3 py-3 text-[10px] font-semibold leading-relaxed"
          style={{ borderColor: '#e8a04066', background: '#1a1408', color: '#e8c890' }}
        >
          Guitar panel could not load. Try reloading the page, or close and reopen the panel.
          <pre className="mt-2 max-h-24 overflow-auto text-[9px] font-mono whitespace-pre-wrap text-[#9a8060]">
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export type { Se2GuitarMockNote } from '@/app/lib/studio/se2GuitarTrack';

export type Se2GuitarPanelProps = {
  track: Se2GuitarTrack;
  notes: readonly Se2GuitarMockNote[];
  beatsPerBar: number;
  bpm?: number;
  getPlayheadBeat?: () => number;
  disabled?: boolean;
  getAudioContext: () => AudioContext;
  getPreviewDestination: (ctx: AudioContext) => AudioNode;
  onInstrumentIdChange: (id: Se2GuitarInstrumentId) => void;
  onTransposeChange: (semi: number) => void;
  onApplyNotes: (notes: Se2GuitarMockNote[]) => void;
  onFxChange: (patch: Partial<Se2GuitarFxSettings>) => void;
  /** Block roll insert (right-click) while transport runs — play stays live. */
  insertDisabled?: boolean;
};

export function Se2GuitarPanel(props: Se2GuitarPanelProps) {
  return (
    <Se2GuitarPanelErrorBoundary>
      <Se2GuitarPanelInner {...props} />
    </Se2GuitarPanelErrorBoundary>
  );
}

function Se2GuitarPanelInner({
  track,
  notes,
  beatsPerBar,
  bpm = 120,
  getPlayheadBeat,
  disabled = false,
  getAudioContext,
  getPreviewDestination,
  onInstrumentIdChange,
  onTransposeChange,
  onApplyNotes,
  onFxChange,
  insertDisabled = false,
}: Se2GuitarPanelProps) {
  const { getOrCreateAudioContext } = useMasterClock();
  const instrumentId = se2SanitizeGuitarInstrumentId(track.guitarInstrumentId);
  const transpose = track.guitarTranspose ?? 0;
  const guitarFx = se2GuitarFxFromTrack(track);

  const [tab, setTab] = useState<Se2GuitarTab>('main');
  const [capo, setCapo] = useState(0);
  const [scaleRoot, setScaleRoot] = useState('A');
  const [scaleId, setScaleId] = useState<Se2GuitarScaleId>('major');
  const [keyShiftSemis, setKeyShiftSemis] = useState(0);
  const [keySelection, setKeySelection] = useState<Se2GuitarKeyConvertSelection | null>(null);
  const [loopBars, setLoopBars] = useState<Se2GuitarPartBars>(4);
  const [articulation, setArticulation] = useState<Se2GuitarArticulationId>('sus');
  const [presetIdx, setPresetIdx] = useState(() =>
    se2GuitarRigPresetIndex(instrumentId, guitarFx),
  );

  const rigPreset = SE2_GUITAR_RIG_PRESETS[presetIdx] ?? SE2_GUITAR_RIG_PRESETS[0]!;

  useEffect(() => {
    const idx = se2GuitarRigPresetIndex(instrumentId, guitarFx);
    setPresetIdx(idx);
  }, [guitarFx, instrumentId]);

  const [playingMidis, setPlayingMidis] = useState<number[]>([]);
  const [highlightDots, setHighlightDots] = useState<Se2GuitarFretDot[]>([]);
  const [activeString, setActiveString] = useState<number | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashFeedback = useCallback(
    (midis: number[], dots: Se2GuitarFretDot[], durationMs = 420) => {
      setPlayingMidis(midis);
      setHighlightDots(dots);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => {
        flashTimerRef.current = null;
        setPlayingMidis([]);
        setHighlightDots([]);
      }, durationMs);
    },
    [],
  );

  useEffect(() => {
    return subscribeSe2GuitarVisualNotes((ev) => {
      const dots = ev.placement
        ? [ev.placement]
        : se2GuitarMidisToFretDots([ev.pitch], capo);
      flashFeedback([ev.pitch], dots, ev.durationMs ?? 420);
    });
  }, [capo, flashFeedback]);

  const resolveAudioContext = useCallback(async (): Promise<AudioContext> => {
    try {
      const existing = getAudioContext();
      if (existing && existing.state !== 'closed') {
        ensureSe2GuitarAudioReady(existing);
        return existing;
      }
    } catch {
      /* parent getter not ready */
    }
    const ctx = await getOrCreateAudioContext();
    ensureSe2GuitarAudioReady(ctx);
    return ctx;
  }, [getAudioContext, getOrCreateAudioContext]);

  const primeAudio = useCallback(async () => {
    try {
      const ctx = await resolveAudioContext();
      const dest = getPreviewDestination(ctx);
      await warmupSe2GuitarInstrument(ctx, instrumentId, dest);
    } catch {
      /* context not ready */
    }
  }, [getPreviewDestination, instrumentId, resolveAudioContext]);

  useEffect(() => {
    void primeAudio();
  }, [primeAudio]);

  const previewNote = useCallback(
    (
      pitch: number,
      velocity = 96,
      tone = instrumentId,
      placement?: Se2GuitarFretDot,
    ) => {
      const voice = se2GuitarArticulationVoice(articulation, tone);
      const resolvedTone = se2GuitarResolvePreviewInstrument(articulation, tone);
      const vel = se2GuitarApplyArticulationToVelocity(articulation, tone, velocity);
      const midi = Math.max(0, Math.min(127, Math.round(pitch + transpose)));
      const dots = placement ? [placement] : se2GuitarMidisToFretDots([midi], capo);
      const durationMs = Math.max(480, Math.round(voice.previewDurationSec * 1000));

      if (placement) {
        setActiveString(placement.stringIndex);
        if (stringTimerRef.current) clearTimeout(stringTimerRef.current);
        stringTimerRef.current = setTimeout(() => {
          stringTimerRef.current = null;
          setActiveString(null);
        }, durationMs);
      }

      flashFeedback([midi], dots, durationMs);

      void (async () => {
        try {
          const ctx = await resolveAudioContext();
          const dest = getPreviewDestination(ctx);
          await auditionSe2GuitarNote(
            ctx,
            dest,
            pitch,
            resolvedTone,
            vel,
            transpose,
            {
              emitVisual: false,
              placement,
              durationSec: voice.previewDurationSec,
              articulation,
              strokeNoise: true,
              releaseNoise: true,
            },
          );
        } catch {
          /* audio not ready */
        }
      })();
    },
    [articulation, capo, flashFeedback, getPreviewDestination, instrumentId, resolveAudioContext, transpose],
  );

  const applyRigPreset = useCallback(
    (preset: Se2GuitarRigPreset, idx: number) => {
      setPresetIdx(idx);
      onInstrumentIdChange(preset.instrumentId);
      onFxChange(preset.fx);
      if (preset.articulation) setArticulation(preset.articulation);
      previewNote(60, 96, preset.instrumentId);
    },
    [onFxChange, onInstrumentIdChange, previewNote],
  );

  const previewStrumNotes = useCallback(
    (strumNotes: readonly Se2GuitarMockNote[]) => {
      const resolvedTone = se2GuitarResolvePreviewInstrument(articulation, instrumentId);
      const voice = se2GuitarArticulationVoice(articulation, instrumentId);
      const durScale =
        articulation === 'pm' ? 0.55 : articulation === 'hp' ? 0.75 : 1;
      const notes = strumNotes.map((n) => ({
        ...n,
        velocity: se2GuitarApplyArticulationToVelocity(articulation, instrumentId, n.velocity),
      }));
      void (async () => {
        try {
          const ctx = await resolveAudioContext();
          previewSe2GuitarStrumNotes(
            ctx,
            getPreviewDestination(ctx),
            notes,
            resolvedTone,
            bpm,
            transpose,
            {
              durationScale: durScale * (voice.previewDurationSec / 0.55),
              articulation,
              renderMode: notes.length > 1 ? 'smplr' : undefined,
              strokeNoise: notes.length <= 1,
              releaseNoise: notes.length <= 1,
            },
          );
        } catch {
          /* audio not ready */
        }
      })();
    },
    [articulation, bpm, getPreviewDestination, instrumentId, resolveAudioContext, transpose],
  );

  const previewPitches = useCallback(
    (pitches: readonly number[]) => {
      const beat = getPlayheadBeat?.() ?? 0;
      const spread = articulation === 'pm' ? 0.04 : 0.035;
      const strumNotes = pitches.map((pitch, i) =>
        se2GuitarArticulationInsertNote(articulation, instrumentId, pitch, beat + i * spread, 92 - i * 2),
      );
      previewStrumNotes(strumNotes);
    },
    [articulation, getPlayheadBeat, instrumentId, previewStrumNotes],
  );

  const insertSingleNote = useCallback(
    (pitch: number) => {
      if (insertDisabled) return;
      const beat = getPlayheadBeat?.() ?? 0;
      const fresh = se2GuitarArticulationInsertNote(articulation, instrumentId, pitch, beat, 96);
      onApplyNotes([...notes, fresh]);
    },
    [articulation, getPlayheadBeat, insertDisabled, instrumentId, notes, onApplyNotes],
  );

  const cyclePreset = useCallback(
    (dir: -1 | 1) => {
      const next = (presetIdx + dir + SE2_GUITAR_RIG_PRESETS.length) % SE2_GUITAR_RIG_PRESETS.length;
      applyRigPreset(SE2_GUITAR_RIG_PRESETS[next]!, next);
    },
    [applyRigPreset, presetIdx],
  );

  const insertLick = useCallback(
    (lickId: Se2GuitarLickId) => {
      const lick = SE2_GUITAR_LICKS.find((l) => l.id === lickId);
      if (!lick) return;
      const beat = getPlayheadBeat?.() ?? 0;
      const insertBar = Math.max(0, Math.floor(beat / Math.max(1, beatsPerBar)));
      const fresh = se2GuitarLickNotesAtBar(lick, insertBar, beatsPerBar).map((n) => ({
        pitch: n.pitch,
        startBeat: n.startBeat,
        durationBeats: n.durationBeats,
        velocity: n.velocity,
      }));
      onApplyNotes([...notes, ...fresh]);
      flashFeedback(
        fresh.map((n) => n.pitch),
        se2GuitarMidisToFretDots(fresh.map((n) => n.pitch), capo),
        480,
      );
      if (fresh[0]) previewNote(fresh[0]!.pitch, fresh[0]!.velocity);
    },
    [beatsPerBar, capo, flashFeedback, getPlayheadBeat, instrumentId, notes, onApplyNotes, previewNote],
  );

  const handleKeySelection = useCallback((sel: Se2GuitarKeyConvertSelection | null) => {
    setKeySelection(sel);
    setKeyShiftSemis(0);
  }, []);

  const handleConvertKey = useCallback(() => {
    if (!keySelection) return;
    setKeyShiftSemis(se2GuitarKeySemitoneDelta(keySelection.sourceKey, scaleRoot));
  }, [keySelection, scaleRoot]);

  const handleResetKey = useCallback(() => setKeyShiftSemis(0), []);

  const handleScaleRootChange = useCallback((root: string) => {
    setScaleRoot(root);
    setKeyShiftSemis(0);
  }, []);

  const chromeProps = {
    capo,
    disabled: false,
    highlightDots,
    playingMidis,
    activeString,
    scaleRoot,
    scaleId,
    onScaleRootChange: handleScaleRootChange,
    onScaleIdChange: setScaleId,
    onFretPlay: (midi: number, vel?: number, placement?: Se2GuitarFretDot) =>
      previewNote(midi, vel, instrumentId, placement),
    onFretInsert: insertDisabled ? undefined : insertSingleNote,
    onKeyPlay: (midi: number, vel?: number) => previewNote(midi, vel),
    onKeyInsert: insertDisabled ? undefined : insertSingleNote,
  } as const;

  return (
    <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
      <style>{`
        .se2-guitar-select { color-scheme: dark; }
        .se2-guitar-select option,
        .se2-guitar-select optgroup {
          background-color: #0a0a0e !important;
          color: #e8e8f0 !important;
        }
      `}</style>
      {/* Ample-style preset bar */}
      <div
        className="flex flex-wrap items-center gap-1.5 rounded border px-2 py-1"
        style={{ borderColor: `${ACCENT}33`, background: SE2_GUITAR_UI.shellBg }}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => cyclePreset(-1)}
          className="rounded border p-0.5 disabled:opacity-40"
          style={{ borderColor: '#4a4030', color: ACCENT }}
          title="Previous rig preset"
        >
          <ChevronLeft size={12} />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => cyclePreset(1)}
          className="rounded border p-0.5 disabled:opacity-40"
          style={{ borderColor: '#4a4030', color: ACCENT }}
          title="Next rig preset"
        >
          <ChevronRight size={12} />
        </button>
        <span
          className="min-w-0 flex-1 truncate text-[9px] font-black uppercase tracking-wide"
          style={{ color: '#f0e8d8' }}
          title={rigPreset.hint}
        >
          {rigPreset.label}
          <span className="font-bold normal-case tracking-normal text-[#8a8070]">
            {' '}
            · {se2GuitarRigCategoryLabel(rigPreset.category)}
          </span>
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => previewNote(60)}
          className="rounded border px-2 py-0.5 text-[7px] font-bold uppercase"
          style={{ borderColor: `${ACCENT}55`, color: ACCENT, background: `${ACCENT}10` }}
        >
          Play
        </button>
      </div>

      {/* Tab bar — Main | Strummer | Loops | FX */}
      <div
        className="flex gap-0.5 rounded border p-0.5"
        style={{ borderColor: '#2a2420', background: '#080604' }}
        role="tablist"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={disabled}
              onClick={() => setTab(t.id)}
              className="flex-1 rounded px-2 py-1 text-[8px] font-black uppercase tracking-wider transition-colors disabled:opacity-40"
              style={{
                background: active ? `${ACCENT}22` : 'transparent',
                color: active ? ACCENT : '#7a7060',
                borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'main' ? (
        <Se2GuitarMainPage
          capo={capo}
          transpose={transpose}
          scaleRoot={scaleRoot}
          scaleId={scaleId}
          onScaleRootChange={handleScaleRootChange}
          onScaleIdChange={setScaleId}
          articulation={articulation}
          disabled={false}
          fx={guitarFx}
          playingMidis={playingMidis}
          highlightDots={highlightDots}
          activeString={activeString}
          onFretPlay={(midi, vel, placement) => previewNote(midi, vel, instrumentId, placement)}
          onFretInsert={insertDisabled ? undefined : insertSingleNote}
          onKeyPlay={(midi, vel) => previewNote(midi, vel)}
          onKeyInsert={insertDisabled ? undefined : insertSingleNote}
          onFxChange={onFxChange}
          onCapoChange={setCapo}
          onArticulationChange={setArticulation}
          onPrimeAudio={() => void primeAudio()}
          footer={
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-[8px] font-bold uppercase text-[#8888a0]">
                  <Music2 size={10} style={{ color: ACCENT }} />
                  Rig
                  <Se2GuitarDarkSelect
                    disabled={disabled}
                    value={String(presetIdx)}
                    onChange={(v) => {
                      const idx = Number(v);
                      const preset = SE2_GUITAR_RIG_PRESETS[idx];
                      if (preset) applyRigPreset(preset, idx);
                    }}
                    className="max-w-[160px]"
                    options={SE2_GUITAR_RIG_PRESETS.map((p, i) => ({
                      value: String(i),
                      label: `${p.label} (${se2GuitarRigCategoryLabel(p.category)})`,
                    }))}
                  />
                </label>
                <label className="inline-flex items-center gap-1.5 text-[8px] font-bold uppercase text-[#8888a0]">
                  GM
                  <Se2GuitarDarkSelect
                    disabled={disabled}
                    value={instrumentId}
                    onChange={(v) => {
                      const id = v as Se2GuitarInstrumentId;
                      onInstrumentIdChange(id);
                    }}
                    className="max-w-[110px]"
                    options={SE2_GUITAR_INSTRUMENT_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
                  />
                </label>
                <label className="inline-flex items-center gap-1 text-[8px] font-bold uppercase text-[#8888a0]">
                  Transpose
                  <Se2GuitarDarkSelect
                    disabled={disabled}
                    value={String(transpose)}
                    onChange={(v) => onTransposeChange(Number(v))}
                    className="tabular-nums"
                    options={[-12, -7, -5, -2, 0, 2, 5, 7, 12].map((s) => ({
                      value: String(s),
                      label: s > 0 ? `+${s}` : String(s),
                    }))}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-1">
                {SE2_GUITAR_LICKS.map((lick) => (
                  <button
                    key={lick.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => insertLick(lick.id)}
                    className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[7px] font-bold uppercase"
                    style={{ borderColor: '#4a4030', background: '#141008', color: '#d8c8a8' }}
                    title={lick.hint}
                  >
                    <Plus size={8} style={{ color: ACCENT }} />
                    {lick.label}
                  </button>
                ))}
              </div>
            </div>
          }
        />
      ) : null}

      {tab === 'strummer' ? (
        <Se2GuitarTabChrome variant="main" {...chromeProps} onPrimeAudio={() => void primeAudio()}>
          <Se2GuitarStrummerPanel
            beatsPerBar={beatsPerBar}
            disabled={disabled}
            insertDisabled={insertDisabled}
            getPlayheadBeat={getPlayheadBeat}
            notes={notes}
            scaleRoot={scaleRoot}
            scaleId={scaleId}
            keyShiftSemis={keyShiftSemis}
            keySelection={keySelection}
            onKeySelection={handleKeySelection}
            onConvertKey={handleConvertKey}
            onResetKey={handleResetKey}
            onScaleRootChange={handleScaleRootChange}
            onScaleIdChange={setScaleId}
            onApplyNotes={onApplyNotes}
            onPreviewStrum={previewStrumNotes}
            onPreviewChord={previewPitches}
          />
          <Se2GuitarStrumGridPanel
            beatsPerBar={beatsPerBar}
            bpm={bpm}
            disabled={disabled}
            insertDisabled={insertDisabled}
            instrumentId={instrumentId}
            transpose={transpose}
            scaleRoot={scaleRoot}
            scaleId={scaleId}
            keyShiftSemis={keyShiftSemis}
            keySelection={keySelection}
            onKeySelection={handleKeySelection}
            onConvertKey={handleConvertKey}
            onResetKey={handleResetKey}
            getPlayheadBeat={getPlayheadBeat}
            getAudioContext={getAudioContext}
            getPreviewDestination={getPreviewDestination}
            notes={notes}
            onApplyNotes={onApplyNotes}
            onInstrumentIdChange={onInstrumentIdChange}
            onPlayingMidis={(midis, ms) =>
              flashFeedback(midis, se2GuitarMidisToFretDots(midis, capo), ms)
            }
          />
        </Se2GuitarTabChrome>
      ) : null}

      {tab === 'loops' ? (
        <Se2GuitarTabChrome variant="loops" {...chromeProps} onPrimeAudio={() => void primeAudio()}>
          <Se2GuitarLoopsPanel
            beatsPerBar={beatsPerBar}
            bpm={bpm}
            disabled={disabled}
            insertDisabled={insertDisabled}
            instrumentId={instrumentId}
            transpose={transpose}
            scaleRoot={scaleRoot}
            scaleId={scaleId}
            keyShiftSemis={keyShiftSemis}
            keySelection={keySelection}
            onKeySelection={handleKeySelection}
            onConvertKey={handleConvertKey}
            onResetKey={handleResetKey}
            onScaleRootChange={handleScaleRootChange}
            onScaleIdChange={setScaleId}
            loopBars={loopBars}
            onLoopBarsChange={setLoopBars}
            getPlayheadBeat={getPlayheadBeat}
            ensureAudioContext={resolveAudioContext}
            getAudioContext={() => {
              const c = getAudioContext();
              if (c && c.state !== 'closed') return c;
              throw new Error('AudioContext not ready');
            }}
            getPreviewDestination={getPreviewDestination}
            notes={notes}
            onApplyNotes={onApplyNotes}
            onInstrumentIdChange={onInstrumentIdChange}
          />
        </Se2GuitarTabChrome>
      ) : null}

      {tab === 'fx' ? (
        <Se2GuitarFxStrip fx={guitarFx} disabled={disabled} onChange={onFxChange} />
      ) : null}
    </div>
  );
}
