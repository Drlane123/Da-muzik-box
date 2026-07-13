'use client';

import { useCallback, useState, type CSSProperties, type PointerEvent } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  pointerStrikeVelocity,
  LAB808_FILTER_DEFAULT,
  type Lab808SoundLane,
} from '@/app/lib/creationStation/eightZeroEightVoice';
import { BeatPadsFxSuiteKnob } from '@/app/components/creation/BeatPadsFxSuiteInsert';
import { Se2Lab808FilterGraph } from '@/app/components/studio/Se2Lab808FilterGraph';
import {
  LAB808_TONE_PAD_COUNT,
  isLab808BlackKeyMidi,
  lab808DefaultTonePadBaseMidi,
  lab808ShiftTonePadBase,
  lab808TonePadMidi,
  lab808TonePadNoteLabel,
  lab808TonePadRangeLabel,
} from '@/app/lib/creationStation/lab808TonePads';
import { previewSe2Lab808Note } from '@/app/lib/studio/se2Lab808Preview';
import type { Se2Lab808VoiceParams } from '@/app/lib/studio/se2Lab808Types';
import { SE2_LAB808_FILTER_VIZ_SURFACE } from '@/app/lib/studio/se2Lab808UiTheme';
import type { Lab808ProgressionRoot } from '@/app/lib/creationStation/lab808ChordRoots';

export type Se2Lab808TonePadsProps = {
  voice: Se2Lab808VoiceParams;
  bpm: number;
  accent: string;
  disabled?: boolean;
  getAudioContext: () => AudioContext;
  getPreviewDestination: (ctx: AudioContext) => AudioNode;
  onVoiceChange: (voice: Se2Lab808VoiceParams) => void;
  /** Controls only (label + Oct±) for sidebar layout. */
  controlsOnly?: boolean;
  /** Pad grid only for sidebar layout. */
  padsOnly?: boolean;
  /** Larger pad cells when used above the tone grid. */
  size?: 'default' | 'large';
  chordRootLock?: boolean;
  progressionRoots?: readonly Lab808ProgressionRoot[];
  selectedRootIndex?: number | null;
  onPadPlay?: (padIndex: number, midi: number) => void;
  /** Glass cyan pads that light up on hit (Beat Pads 808 Lab). */
  accentPads?: boolean;
};

function tonePadSurface(
  lane: Lab808SoundLane,
  blackKey: boolean,
  playing: boolean,
  lockedChord: boolean,
  chromeAccent?: string,
): string {
  if (chromeAccent) {
    const mix = playing ? 72 : lockedChord ? 42 : blackKey ? 14 : 22;
    const base = blackKey ? 'rgba(6, 14, 20, 0.55)' : 'rgba(8, 22, 32, 0.42)';
    return `linear-gradient(165deg, color-mix(in srgb, ${chromeAccent} ${mix}%, transparent) 0%, ${base} 100%)`;
  }
  const accent = playing ? '#fde68a' : lockedChord ? '#7cf4c6' : lane === 'kick' ? '#ca8a04' : '#22c55e';
  const mix = playing ? 88 : blackKey ? 42 : 62;
  const base = blackKey ? '#0a0a0e' : '#14141c';
  return `linear-gradient(165deg, color-mix(in srgb, ${accent} ${mix}%, ${base}) 0%, #1e1e24 100%)`;
}

function tonePadBorder(
  lane: Lab808SoundLane,
  playing: boolean,
  lockedChord: boolean,
  chromeAccent?: string,
): string {
  if (chromeAccent) {
    if (playing) return chromeAccent;
    if (lockedChord) return `color-mix(in srgb, ${chromeAccent} 70%, #3f3f46)`;
    return `color-mix(in srgb, ${chromeAccent} 40%, #3f3f46)`;
  }
  if (playing) return '#fde68a';
  if (lockedChord) return 'color-mix(in srgb, #7cf4c6 55%, #3f3f46)';
  return lane === 'kick' ? 'color-mix(in srgb, #ca8a04 55%, #3f3f46)' : 'color-mix(in srgb, #22c55e 55%, #3f3f46)';
}

const TONE_PAD_COLS = 8;
const TONE_PAD_ROWS = 2;

const TONE_PAD_SIZE = {
  default: { minW: 48, maxW: 56, minH: 52, pad: '8px 6px', font: [10, 11] as const, columnGap: 5, rowGap: 2 },
  large: { minW: 58, maxW: 68, minH: 66, pad: '10px 8px', font: [11, 13] as const, columnGap: 7, rowGap: 2.5 },
} as const;

function tonePadButton(
  padIndex: number,
  baseMidi: number,
  voice: Se2Lab808VoiceParams,
  playingPad: number | null,
  disabled: boolean,
  onPadPointerDown: (e: PointerEvent, padIndex: number) => void,
  size: 'default' | 'large',
  locked: boolean,
  root: Lab808ProgressionRoot | null,
  selected: boolean,
  chromeAccent?: string,
) {
  const midi = locked && root ? root.midi : lab808TonePadMidi(baseMidi, padIndex);
  const label = locked && root ? root.chord : lab808TonePadNoteLabel(midi);
  const black = locked ? false : isLab808BlackKeyMidi(midi);
  const playing = playingPad === padIndex;
  const lockedChord = locked && !!root;
  const selectedChord = selected && lockedChord;
  const sz = TONE_PAD_SIZE[size];
  const hitGlow = chromeAccent
    ? `0 0 20px color-mix(in srgb, ${chromeAccent} 65%, transparent)`
    : '0 0 18px rgba(253,224,108,0.55)';
  return (
    <button
      key={`${baseMidi}-${padIndex}`}
      type="button"
      disabled={disabled || (locked && !root)}
      aria-label={`Pad ${padIndex + 1} ${voice.soundLane} ${label}`}
      onPointerDown={(e) => onPadPointerDown(e, padIndex)}
      className="outline-none touch-manipulation select-none relative"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        padding: sz.pad,
        minHeight: sz.minH,
        minWidth: sz.minW,
        borderRadius: size === 'large' ? 11 : 10,
        border: `2px solid ${
          selectedChord && chromeAccent
            ? chromeAccent
            : selectedChord
              ? '#fde68a'
              : tonePadBorder(voice.soundLane, playing, lockedChord, chromeAccent)
        }`,
        background: tonePadSurface(
          voice.soundLane,
          black,
          playing,
          lockedChord || selectedChord,
          chromeAccent,
        ),
        boxShadow: playing
          ? hitGlow
          : selectedChord
            ? chromeAccent
              ? `0 0 12px color-mix(in srgb, ${chromeAccent} 40%, transparent)`
              : '0 0 12px rgba(253,224,108,0.35)'
            : lockedChord
              ? chromeAccent
                ? `inset 0 0 10px color-mix(in srgb, ${chromeAccent} 18%, transparent)`
                : 'inset 0 0 10px rgba(124,244,198,0.12)'
              : 'inset 0 1px 0 rgba(255,255,255,0.06)',
        cursor: disabled || (locked && !root) ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : locked && !root ? 0.28 : 1,
        backdropFilter: chromeAccent ? 'blur(6px)' : undefined,
      }}
    >
      <span
        className="absolute font-black tabular-nums leading-none pointer-events-none select-none"
        style={{
          top: size === 'large' ? 5 : 4,
          left: size === 'large' ? 6 : 5,
          fontSize: size === 'large' ? 8 : 7,
          color: playing
            ? chromeAccent
              ? 'rgba(0, 40, 50, 0.85)'
              : 'rgba(66,32,6,0.75)'
            : black
              ? 'rgba(255,255,255,0.45)'
              : chromeAccent
                ? 'rgba(180, 240, 255, 0.55)'
                : 'rgba(0,0,0,0.38)',
        }}
      >
        {padIndex + 1}
      </span>
      <span
        style={{
          fontSize: black ? sz.font[0] : sz.font[1],
          fontWeight: 900,
          color: playing
            ? chromeAccent
              ? '#031820'
              : '#422006'
            : black
              ? '#d4d4d8'
              : chromeAccent
                ? '#e8fbff'
                : '#f4f4f5',
          lineHeight: 1.1,
        }}
      >
        {label}
      </span>
    </button>
  );
}

const octBtn: CSSProperties = {
  padding: '5px 14px',
  borderRadius: 6,
  border: '1px solid #3f3f46',
  background: '#18181b',
  color: '#d4d4d8',
  fontSize: 9,
  fontWeight: 800,
  cursor: 'pointer',
  minHeight: 28,
  minWidth: 56,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
};

const LAB808_FX_KNOB_SIZE = 44;
const LAB808_FILTER_VIZ_ACCENT = '#58c4ff';
const LAB808_HP_SCALE_HZ = 400;
const LAB808_LP_SCALE_HZ = 16000;

export function Se2Lab808TonePads({
  voice,
  bpm,
  accent,
  disabled = false,
  getAudioContext,
  getPreviewDestination,
  onVoiceChange,
  controlsOnly = false,
  padsOnly = false,
  size = 'default',
  chordRootLock = false,
  progressionRoots = [],
  selectedRootIndex = null,
  onPadPlay,
  accentPads = false,
}: Se2Lab808TonePadsProps) {
  const [playingPad, setPlayingPad] = useState<number | null>(null);
  const baseMidi = voice.tonePadBaseMidi ?? lab808DefaultTonePadBaseMidi();
  const isKick = voice.soundLane === 'kick';
  const locked = chordRootLock && progressionRoots.length > 0;

  const playPad = useCallback(
    (padIndex: number, velocity01: number) => {
      if (disabled) return;
      const ctx = getAudioContext();
      if (locked) {
        const root = progressionRoots[padIndex];
        if (!root) return;
        onPadPlay?.(padIndex, root.midi);
        previewSe2Lab808Note(
          ctx,
          getPreviewDestination(ctx),
          root.midi,
          Math.max(1, Math.round(velocity01 * 127)),
          voice,
          bpm,
          isKick ? 0.35 : 0.75,
        );
        setPlayingPad(padIndex);
        window.setTimeout(() => setPlayingPad((p) => (p === padIndex ? null : p)), 120);
        return;
      }
      const midi = lab808TonePadMidi(baseMidi, padIndex);
      onPadPlay?.(padIndex, midi);
      previewSe2Lab808Note(
        ctx,
        getPreviewDestination(ctx),
        midi,
        Math.max(1, Math.round(velocity01 * 127)),
        voice,
        bpm,
        isKick ? 0.35 : 0.75,
      );
      setPlayingPad(padIndex);
      window.setTimeout(() => setPlayingPad((p) => (p === padIndex ? null : p)), 120);
    },
    [bpm, disabled, getAudioContext, getPreviewDestination, isKick, locked, onPadPlay, progressionRoots, voice],
  );

  const onPadPointerDown = useCallback(
    (e: PointerEvent, padIndex: number) => {
      e.preventDefault();
      if (disabled) return;
      try {
        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      playPad(padIndex, pointerStrikeVelocity(e));
    },
    [disabled, playPad],
  );

  const setBaseMidi = (next: number) => onVoiceChange({ ...voice, tonePadBaseMidi: next });

  const octaveRow = (
    <div className="flex flex-wrap items-center gap-3" aria-label="Tone pad octave">
      <button
        type="button"
        disabled={disabled}
        style={octBtn}
        onClick={() => setBaseMidi(lab808ShiftTonePadBase(baseMidi, -12))}
        title="Octave down"
      >
        <ChevronDown size={12} />
        <span>Oct−</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        style={octBtn}
        onClick={() => setBaseMidi(lab808ShiftTonePadBase(baseMidi, 12))}
        title="Octave up"
      >
        <span>Oct+</span>
        <ChevronUp size={12} />
      </button>
      <span className="text-[8px] font-bold tabular-nums px-1" style={{ color: '#9a9aac' }}>
        {lab808TonePadRangeLabel(baseMidi)}
      </span>
    </div>
  );

  const hpHz = voice.filterFx.hpHz ?? LAB808_FILTER_DEFAULT.hpHz ?? 0;
  const lpHz = voice.filterFx.lpHz ?? LAB808_FILTER_DEFAULT.lpHz ?? 0;
  const filterLive = hpHz > 0 || (lpHz > 0 && lpHz < LAB808_LP_SCALE_HZ);

  const filterViz = (
    <div
      className="beat-pads-fx-suite-viz-chrome lab808-filter-viz-chrome shrink-0 flex flex-col"
      style={{
        width: 124,
        minHeight: 76,
        borderColor: `${LAB808_FILTER_VIZ_ACCENT}33`,
        boxShadow: `inset 0 0 24px ${LAB808_FILTER_VIZ_ACCENT}08`,
      }}
      aria-label="808 high-pass and low-pass filter response"
    >
      <div
        className="beat-pads-fx-suite-readout"
        style={{ gridTemplateColumns: '1fr 1fr 1fr' }}
      >
        <div className="beat-pads-fx-suite-readout-cell">
          <span className="beat-pads-fx-suite-readout-title">HP</span>
          <span className="beat-pads-fx-suite-readout-value" style={{ color: LAB808_FILTER_VIZ_ACCENT }}>
            {hpHz <= 0 ? 'OFF' : `${Math.round(hpHz)}`}
          </span>
        </div>
        <div className="beat-pads-fx-suite-readout-cell">
          <span className="beat-pads-fx-suite-readout-title">LP</span>
          <span className="beat-pads-fx-suite-readout-value" style={{ color: LAB808_FILTER_VIZ_ACCENT }}>
            {lpHz <= 0 ? 'OFF' : `${Math.round(lpHz)}`}
          </span>
        </div>
        <div className="beat-pads-fx-suite-readout-cell">
          <span className="beat-pads-fx-suite-readout-title">FILT</span>
          <span
            className="beat-pads-fx-suite-readout-value"
            style={{ color: filterLive ? LAB808_FILTER_VIZ_ACCENT : '#8a92a0' }}
          >
            {filterLive ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>
      <div className="lab808-filter-viz-graph-slot flex-1 min-h-[44px] px-1 py-1">
        <Se2Lab808FilterGraph
          hpHz={hpHz}
          lpHz={lpHz}
          accent={LAB808_FILTER_VIZ_ACCENT}
          hpScaleHz={LAB808_HP_SCALE_HZ}
          hpFloorHz={5}
          lpScaleHz={LAB808_LP_SCALE_HZ}
          lpMinActiveHz={1}
        />
      </div>
    </div>
  );

  const fxKnobRow = (
    <div className="flex items-stretch gap-3 shrink-0" aria-label="808 output and filter">
      {filterViz}
      <div className="flex items-end gap-3">
      <BeatPadsFxSuiteKnob
        label="OUT"
        dialSize={LAB808_FX_KNOB_SIZE}
        min={20}
        max={100}
        step={1}
        disabled={disabled}
        value={Math.round(voice.output * 100)}
        onChange={(v) => onVoiceChange({ ...voice, output: Math.max(0.2, Math.min(1, v / 100)) })}
        format={(v) => `${Math.round(v)}%`}
      />
      <BeatPadsFxSuiteKnob
        label="HP"
        dialSize={LAB808_FX_KNOB_SIZE}
        min={0}
        max={400}
        step={5}
        disabled={disabled}
        value={hpHz}
        onChange={(v) =>
          onVoiceChange({
            ...voice,
            filterFx: { ...voice.filterFx, hpHz: Math.max(0, Math.min(400, Math.round(v))) },
          })
        }
        format={(v) => (v <= 0 ? 'OFF' : `${Math.round(v)}`)}
      />
      <BeatPadsFxSuiteKnob
        label="LP"
        dialSize={LAB808_FX_KNOB_SIZE}
        min={0}
        max={16000}
        step={100}
        disabled={disabled}
        value={lpHz}
        onChange={(v) =>
          onVoiceChange({
            ...voice,
            filterFx: { ...voice.filterFx, lpHz: Math.max(0, Math.min(16000, Math.round(v))) },
          })
        }
        format={(v) => (v <= 0 ? 'OFF' : `${Math.round(v)}`)}
      />
      </div>
    </div>
  );

  const padsToolbar = (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 min-w-0 w-full">
      {octaveRow}
      {fxKnobRow}
    </div>
  );

  const padSize = padsOnly && size === 'default' ? 'large' : size;
  const sz = TONE_PAD_SIZE[padSize];

  const padGrid = (
    <div
      className="rounded border px-2 pt-2 pb-1.5"
      style={{
        borderColor: SE2_LAB808_FILTER_VIZ_SURFACE.borderHex,
        background: SE2_LAB808_FILTER_VIZ_SURFACE.backgroundOpaque,
        boxShadow: SE2_LAB808_FILTER_VIZ_SURFACE.insetShadow,
      }}
    >
      <div
        className="grid"
        style={{
          columnGap: sz.columnGap,
          rowGap: sz.rowGap,
          gridTemplateColumns: `repeat(${TONE_PAD_COLS}, minmax(${sz.minW}px, ${sz.maxW}px))`,
          gridTemplateRows: `repeat(${TONE_PAD_ROWS}, minmax(${sz.minH}px, auto))`,
        }}
      >
        {Array.from({ length: LAB808_TONE_PAD_COUNT }, (_, padIndex) =>
          tonePadButton(
            padIndex,
            baseMidi,
            voice,
            playingPad,
            disabled,
            onPadPointerDown,
            padSize,
            locked,
            locked ? (progressionRoots[padIndex] ?? null) : null,
            selectedRootIndex === padIndex,
            accentPads ? accent : undefined,
          ),
        )}
      </div>
    </div>
  );

  if (controlsOnly) {
    return (
      <div aria-label="808 tone pad octave controls" className="min-w-0">
        {octaveRow}
      </div>
    );
  }

  if (padsOnly) {
    return (
      <section className="min-w-0 shrink-0 flex flex-col gap-1.5" aria-label="808 tone preview pads">
        {padsToolbar}
        {padGrid}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-1.5" aria-label="808 tone preview pads">
      {padsToolbar}
      {padGrid}
    </section>
  );
}
