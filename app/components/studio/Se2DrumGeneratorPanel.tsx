'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, RefreshCw, Sparkles } from 'lucide-react';

import { StudioBeatLabPatternBankMenu } from '@/app/components/studio/StudioBeatLabPatternBankMenu';
import { Se2DrumGenModernBankMenu } from '@/app/components/studio/Se2DrumGenModernBankMenu';
import { Se2DrumGenPadSoundPanel } from '@/app/components/studio/Se2DrumGenPadSoundPanel';
import { StudioDrumPatternMenu } from '@/app/components/studio/StudioDrumPatternMenu';
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';
import type { Se2DrumPadOverride } from '@/app/lib/studio/se2DrumPadOverrides';
import type { PatternPreset } from '@/app/lib/patternPresets';
import type { PianoRollDrumPreset } from '@/app/lib/studio/studioEditor2DrumPatterns';
import {
  se2InferDrumGenStyleFromHarmonyTrack,
  se2GenerateDrumGeneratorLoad,
} from '@/app/lib/studio/se2DrumGeneratorEngine';
import {
  BEAT_PADS_GENO_SLOT_SHORT_LABELS,
} from '@/app/lib/creationStation/beatPadsSe2Bridge';
import {
  SE2_DRUM_GEN_STYLE_CHIPS,
  se2DrumGenHarmonyKindLabel,
  se2DrumGenHarmonyOptionHint,
  se2DrumGenHarmonyReadyCandidates,
  se2DrumGenHarmonySourceCandidates,
  se2DrumGenTrackHarmonyReady,
  se2NormalizeDrumGenStyle,
  se2NormalizeDrumGenTemperature,
  se2ResolveDrumGenHarmonyTrack,
  se2SortDrumGenHarmonyCandidates,
  type Se2DrumGenGenoBuildSlot,
  type Se2DrumGenHarmonySourceTrack,
  type Se2DrumGenStyle,
  type Se2DrumGeneratorTrack,
} from '@/app/lib/studio/se2DrumGeneratorTrack';
import { se2TrackNumberedName } from '@/app/lib/studio/se2StudioTrackNumber';

const ACCENT = '#ffb84d';

const MATCH_MENU_BG = '#1a1a24';
const MATCH_MENU_BORDER = '#3a3a4c';
const MATCH_ITEM_TEXT = '#f0f0f8';
const MATCH_ITEM_MUTED = '#9a9ab0';

/** Closed trigger width — leave room for controls beside it in the strip. */
const PICKER_TRIGGER_W_PX = 118;
const PICKER_TRIGGER_FONT_PX = 11;
const PICKER_MENU_FONT_PX = 11;
const PICKER_MENU_HINT_FONT_PX = 9;

function shortHarmonyKindLabel(kind: string): string {
  switch (kind) {
    case 'synthGeno':
      return 'Geno';
    case 'glideBass':
      return 'Bass';
    case 'grooveLead':
      return 'Lead';
    case 'rhythm':
      return 'Rhythm';
    case 'midi':
      return 'Prog+';
    default:
      return se2DrumGenHarmonyKindLabel(kind).slice(0, 6);
  }
}

type DrumGenHarmonyPickerProps = {
  selectedTrackId: string;
  candidates: readonly Se2DrumGenHarmonySourceTrack[];
  readyCount: number;
  disabled?: boolean;
  lanePad: number;
  onSelect: (trackId: string) => void;
};

function DrumGenHarmonyPicker({
  selectedTrackId,
  candidates,
  readyCount,
  disabled = false,
  lanePad,
  onSelect,
}: DrumGenHarmonyPickerProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const laneLabel = (t: Se2DrumGenHarmonySourceTrack) =>
    se2TrackNumberedName(t.laneNumber, t.name, lanePad);

  const selectedTrack = candidates.find((t) => t.id === selectedTrackId);

  const triggerLabel = selectedTrack
    ? `${laneLabel(selectedTrack)} · ${shortHarmonyKindLabel(selectedTrack.kind)}`
    : candidates.length === 0
      ? 'Add track'
      : readyCount === 0
        ? 'Pick lane'
        : 'Auto';

  const triggerTitle = selectedTrack
    ? `${laneLabel(selectedTrack)} · ${se2DrumGenHarmonyKindLabel(selectedTrack.kind)} · ${se2DrumGenHarmonyOptionHint(selectedTrack)}`
    : 'Match drums to cards already applied on a Geno / instrument lane';

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const tid = window.setTimeout(() => {
      document.addEventListener('mousedown', handler, true);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      window.clearTimeout(tid);
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggleMenu = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (disabled) return;
      if (!open && typeof window !== 'undefined') {
        const r = e.currentTarget.getBoundingClientRect();
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        const minW = PICKER_TRIGGER_W_PX;
        let left = r.left;
        if (left + minW > vw - 8) left = Math.max(8, vw - minW - 8);
        const spaceBelow = vh - r.bottom - 8;
        const maxH = Math.min(300, Math.max(140, spaceBelow));
        setMenuStyle({
          position: 'fixed',
          top: r.bottom + 2,
          left,
          width: minW,
          maxHeight: maxH,
          zIndex: 30050,
        });
      }
      setOpen((o) => !o);
    },
    [disabled, open],
  );

  const pick = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  const menuEl =
    open && typeof document !== 'undefined' ? (
      <div
        ref={menuRef}
        role="listbox"
        aria-label="Match cards lane"
        className="rounded border overflow-y-auto overflow-x-hidden shadow-2xl flex flex-col"
        style={{
          ...menuStyle,
          borderColor: MATCH_MENU_BORDER,
          background: MATCH_MENU_BG,
          boxShadow: '0 12px 40px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          role="option"
          aria-selected={!selectedTrackId}
          className="w-full text-left px-2 py-2 border-b outline-none transition-colors hover:bg-[#2a2a38]"
          style={{
            borderColor: '#2e2e3a',
            background: !selectedTrackId ? '#2a2830' : 'transparent',
            color: MATCH_ITEM_TEXT,
            fontSize: PICKER_MENU_FONT_PX,
            fontWeight: 700,
            lineHeight: 1.35,
          }}
          onClick={() => pick('')}
        >
          {candidates.length === 0
            ? 'Add Synth Geno lane first'
            : readyCount === 0
              ? 'Apply MIDI on Geno first'
              : 'Auto (first ready)'}
        </button>
        {candidates.map((t) => {
          const ready = se2DrumGenTrackHarmonyReady(t);
          const picked = selectedTrackId === t.id;
          const hint = se2DrumGenHarmonyOptionHint(t);
          return (
            <button
              key={t.id}
              type="button"
              role="option"
              aria-selected={picked}
              disabled={!ready}
              className="w-full text-left px-2 py-2 border-b outline-none transition-colors hover:bg-[#2a2a38] disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                borderColor: '#252530',
                background: picked ? '#2d2a22' : 'transparent',
                lineHeight: 1.3,
              }}
              onClick={() => {
                if (ready) pick(t.id);
              }}
            >
              <div
                style={{
                  fontSize: PICKER_MENU_FONT_PX,
                  fontWeight: picked ? 800 : 700,
                  color: ready ? MATCH_ITEM_TEXT : MATCH_ITEM_MUTED,
                }}
              >
                <span style={{ color: ready ? ACCENT : '#6a6a78' }}>{ready ? '★ ' : '○ '}</span>
                {laneLabel(t)} · {shortHarmonyKindLabel(t.kind)}
              </div>
              <div
                style={{
                  fontSize: PICKER_MENU_HINT_FONT_PX,
                  fontWeight: 600,
                  color: '#a8a8c0',
                  marginTop: 2,
                  wordBreak: 'break-word',
                }}
              >
                {hint}
              </div>
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={toggleMenu}
        onPointerDown={(e) => e.stopPropagation()}
        className="inline-flex shrink-0 items-center justify-between gap-1 rounded border px-2 py-1 text-left outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-45"
        style={{
          width: PICKER_TRIGGER_W_PX,
          borderColor: open ? `${ACCENT}88` : '#3a4860',
          background: '#12121a',
          color: '#f0f0f8',
          fontSize: PICKER_TRIGGER_FONT_PX,
          fontWeight: 700,
        }}
        title={triggerTitle}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown size={12} style={{ color: '#9a9ab0', flexShrink: 0 }} />
      </button>
      {menuEl ? createPortal(menuEl, document.body) : null}
    </>
  );
}

export type Se2DrumGeneratorPanelProps = {
  trackIndex: number;
  track: Se2DrumGeneratorTrack;
  tracks: readonly Se2DrumGenHarmonySourceTrack[];
  bpm: number;
  beatsPerBar: number;
  loopBars: number;
  disabled?: boolean;
  onStyleChange: (style: Se2DrumGenStyle) => void;
  onHarmonyTrackIdChange: (trackId: string) => void;
  onGenoBuildSlotChange: (slot: Se2DrumGenGenoBuildSlot) => void;
  onGenerateFromMatchCards: () => void | Promise<void>;
  onTemperatureChange: (temp: number) => void;
  onSelectPianoRollPreset: (preset: PianoRollDrumPreset) => void;
  onSelectBeatLabPreset: (preset: PatternPreset) => void;
  onApplyGenerated: (load: Awaited<ReturnType<typeof se2GenerateDrumGeneratorLoad>>, nextSeed: number) => void;
  onSetPadOverride: (padIndex: number, override: Se2DrumPadOverride | null) => void;
  onResetAllPadOverrides: () => void;
  onAuditionOverride: (override: Se2DrumPadOverride) => void;
  onPreviewAssignedPad: (padIndex: number) => void;
};

export function Se2DrumGeneratorPanel({
  track,
  tracks,
  bpm,
  beatsPerBar,
  loopBars,
  disabled = false,
  onStyleChange,
  onHarmonyTrackIdChange,
  onGenoBuildSlotChange,
  onGenerateFromMatchCards,
  onTemperatureChange,
  onSelectPianoRollPreset,
  onSelectBeatLabPreset,
  onApplyGenerated,
  onSetPadOverride,
  onResetAllPadOverrides,
  onAuditionOverride,
  onPreviewAssignedPad,
}: Se2DrumGeneratorPanelProps) {
  const [generating, setGenerating] = useState(false);
  const [generatingFromCards, setGeneratingFromCards] = useState(false);

  const lanePad = Math.max(2, String(tracks.length).length);

  const harmonyCandidates = useMemo(
    () => se2SortDrumGenHarmonyCandidates(se2DrumGenHarmonySourceCandidates(tracks, track.id)),
    [tracks, track.id],
  );

  const harmonyReadyCount = useMemo(
    () => se2DrumGenHarmonyReadyCandidates(tracks, track.id).length,
    [tracks, track.id],
  );

  const harmonySource = useMemo(
    () => se2ResolveDrumGenHarmonyTrack(tracks, track, track.id),
    [tracks, track],
  );

  const linkedStyle = harmonySource ? se2InferDrumGenStyleFromHarmonyTrack(harmonySource, tracks) : null;
  const activeStyle = se2NormalizeDrumGenStyle(track.drumGenStyle);
  const temperature = se2NormalizeDrumGenTemperature(track.drumGenTemperature);
  const styleSynced = linkedStyle != null && linkedStyle === activeStyle;
  const genoBuildSlot = track.drumGenGenoBuildSlot ?? 'b01';
  const linkedGeno =
    harmonySource?.kind === 'synthGeno' ||
    (track.drumGenHarmonyTrackId
      ? harmonyCandidates.find((t) => t.id === track.drumGenHarmonyTrackId)?.kind === 'synthGeno'
      : false);
  const matchCardsReady = harmonySource != null && se2DrumGenTrackHarmonyReady(harmonySource);

  const runGenerateFromMatchCards = useCallback(async () => {
    if (disabled || generatingFromCards || !matchCardsReady) return;
    setGeneratingFromCards(true);
    try {
      await Promise.resolve(onGenerateFromMatchCards());
    } finally {
      setGeneratingFromCards(false);
    }
  }, [disabled, generatingFromCards, matchCardsReady, onGenerateFromMatchCards]);

  const runGenerate = useCallback(
    async (bumpSeed: boolean) => {
      if (disabled || generating) return;
      setGenerating(true);
      try {
        const seed = bumpSeed
          ? (track.drumGenSeed ?? 0) + 1 + Math.floor(Math.random() * 997)
          : (track.drumGenSeed ?? Date.now() % 1_000_000);
        const load = await se2GenerateDrumGeneratorLoad({
          style: activeStyle,
          seed,
          temperature,
          beatsPerBar,
          loopBars,
        });
        onApplyGenerated(load, seed);
      } finally {
        setGenerating(false);
      }
    },
    [
      activeStyle,
      beatsPerBar,
      disabled,
      generating,
      loopBars,
      onApplyGenerated,
      temperature,
      track.drumGenSeed,
    ],
  );

  const laneLabel = (t: Se2DrumGenHarmonySourceTrack) =>
    se2TrackNumberedName(t.laneNumber, t.name, lanePad);

  return (
    <div className="flex flex-col gap-1.5 py-0.5 px-0.5 min-w-0">
      <div
        className="rounded border px-2 py-1.5 min-w-0"
        style={{ borderColor: `${ACCENT}44`, background: 'rgba(0,0,0,0.35)' }}
      >
        <Se2DrumGenPadSoundPanel
          kitId={track.drumProducerKitId as BeatLabProducerKitId | undefined}
          overrides={track.drumPadOverrides}
          disabled={disabled}
          onSetPadOverride={onSetPadOverride}
          onResetAllPads={onResetAllPadOverrides}
          onAuditionOverride={onAuditionOverride}
          onPreviewAssignedPad={onPreviewAssignedPad}
          sideSlot={
            <div className="flex flex-row gap-4 items-start">
              <div
                className="flex flex-col gap-1 shrink-0"
                style={{ width: PICKER_TRIGGER_W_PX * 2 + 4 }}
              >
                <span className="text-[9px] font-black uppercase tracking-wide shrink-0" style={{ color: ACCENT }}>
                  Match cards
                </span>
                <p className="text-[8px] font-semibold leading-tight text-[#8a9aae]">
                  1. Build cards in Geno B01/B02 · 2. Apply MIDI · 3. Match here
                </p>
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `repeat(2, ${PICKER_TRIGGER_W_PX}px)` }}
                >
                  <DrumGenHarmonyPicker
                    selectedTrackId={track.drumGenHarmonyTrackId ?? ''}
                    candidates={harmonyCandidates}
                    readyCount={harmonyReadyCount}
                    disabled={disabled}
                    lanePad={lanePad}
                    onSelect={onHarmonyTrackIdChange}
                  />
                  <StudioDrumPatternMenu
                    selectedPresetId={track.drumPatternPresetId}
                    onSelectPreset={onSelectPianoRollPreset}
                    disabled={disabled}
                    accentHex={ACCENT}
                    triggerWidthPx={PICKER_TRIGGER_W_PX}
                    triggerFontPx={PICKER_TRIGGER_FONT_PX}
                    title="Trap / R&B drum patterns"
                  />
                  <StudioBeatLabPatternBankMenu
                    selectedPresetId={track.beatLabPatternPresetId}
                    onSelectPreset={onSelectBeatLabPreset}
                    disabled={disabled}
                    accentHex="#7cf4c6"
                    triggerWidthPx={PICKER_TRIGGER_W_PX}
                    triggerFontPx={PICKER_TRIGGER_FONT_PX}
                    title="Beat Lab pattern bank"
                  />
                  <Se2DrumGenModernBankMenu
                    chordStyle={activeStyle}
                    harmony={harmonySource}
                    tracks={tracks}
                    selectedPresetId={track.drumGenModernPresetId}
                    seed={track.drumGenSeed ?? Date.now() % 1_000_000}
                    temperature={temperature}
                    beatsPerBar={beatsPerBar}
                    loopBars={loopBars}
                    disabled={disabled}
                    triggerWidthPx={PICKER_TRIGGER_W_PX}
                    triggerFontPx={PICKER_TRIGGER_FONT_PX}
                    onApplyGenerated={onApplyGenerated}
                  />
                </div>
                {linkedGeno ? (
                  <div className="flex flex-wrap items-center gap-1 w-full">
                    <span className="text-[8px] font-bold uppercase tracking-wide text-[#8a9aae] shrink-0">
                      Build
                    </span>
                    {(['b01', 'b02'] as const).map((slot) => {
                      const on = genoBuildSlot === slot;
                      const accent = slot === 'b01' ? '#7cf4c6' : '#00E5FF';
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={disabled}
                          onClick={() => onGenoBuildSlotChange(slot)}
                          className="rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide"
                          style={{
                            borderColor: on ? accent : '#3a4860',
                            background: on ? `${accent}22` : '#12121a',
                            color: on ? accent : '#9090a8',
                          }}
                          title={`Cards built in ${BEAT_PADS_GENO_SLOT_SHORT_LABELS[slot]}`}
                        >
                          {BEAT_PADS_GENO_SLOT_SHORT_LABELS[slot]}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={disabled || generatingFromCards || !matchCardsReady}
                  onClick={() => void runGenerateFromMatchCards()}
                  className="shrink-0 rounded border px-2 py-1 text-[9px] font-black uppercase tracking-wide w-full disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    borderColor: matchCardsReady ? '#c77dff88' : '#3a3a48',
                    background: matchCardsReady ? '#c77dff18' : '#16161e',
                    color: matchCardsReady ? '#e8d4ff' : '#6a6a78',
                  }}
                  title={
                    matchCardsReady
                      ? 'Bank 2 groove from MIDI on the matched lane'
                      : 'Apply MIDI on your Geno lane first, then match cards here'
                  }
                >
                  <span className="inline-flex items-center justify-center gap-1">
                    <Sparkles size={10} />
                    {generatingFromCards ? 'Generating…' : 'Generate from cards'}
                  </span>
                </button>
                {linkedStyle && !styleSynced ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onStyleChange(linkedStyle)}
                    className="shrink-0 rounded border px-2 py-1 text-[9px] font-bold uppercase tracking-wide w-full"
                    style={{ borderColor: '#7cf4c666', color: '#7cf4c6', background: '#7cf4c610' }}
                    title={`Set style chip to ${linkedStyle} from linked lane`}
                  >
                    Sync {linkedStyle}
                  </button>
                ) : null}
                {harmonySource ? (
                  <span className="text-[9px] font-semibold text-[#8a9aae] truncate w-full">
                    {laneLabel(harmonySource)}
                    {linkedGeno ? ` · ${BEAT_PADS_GENO_SLOT_SHORT_LABELS[genoBuildSlot]}` : ''}
                    {matchCardsReady ? ` · ${linkedStyle ?? activeStyle}` : ' · needs Apply MIDI'}
                  </span>
                ) : harmonyReadyCount === 0 ? (
                  <span className="text-[9px] font-semibold text-[#8a9aae] truncate w-full">
                    Finish Geno cards + Apply MIDI before matching
                  </span>
                ) : null}
              </div>

              <div
                className="flex flex-col gap-1 shrink-0"
                style={{ width: PICKER_TRIGGER_W_PX * 2 + 4 }}
              >
                <span className="text-[9px] font-black uppercase tracking-wide shrink-0" style={{ color: ACCENT }}>
                  Style
                </span>
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
                >
                  {SE2_DRUM_GEN_STYLE_CHIPS.map((c) => {
                    const on = activeStyle === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => onStyleChange(c.id)}
                        className="rounded border px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide truncate"
                        style={{
                          borderColor: on ? ACCENT : '#3a4860',
                          background: on ? `${ACCENT}22` : '#12121a',
                          color: on ? ACCENT : '#9090a8',
                          minHeight: 22,
                        }}
                        title={c.label}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          }
        />
      </div>

      <div
        className="flex flex-row flex-wrap items-center"
        style={{ columnGap: '2.25rem', rowGap: 0 }}
      >
        <button
          type="button"
          disabled={disabled || generating}
          onClick={() => void runGenerate(true)}
          className="inline-flex shrink-0 items-center justify-center gap-1 rounded border px-2 py-0.5 text-[8px] font-black uppercase tracking-wide"
          style={{
            borderColor: `${ACCENT}88`,
            background: `${ACCENT}18`,
            color: ACCENT,
            minWidth: '5.25rem',
          }}
        >
          <Sparkles size={10} />
          {generating ? '…' : 'Generate'}
        </button>
        <button
          type="button"
          disabled={disabled || generating}
          onClick={() => void runGenerate(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[7px] font-bold uppercase"
          style={{ borderColor: '#3a3a48', color: '#a0a0b8' }}
          title="Same style, new groove"
        >
          <RefreshCw size={9} />
          Re-roll
        </button>
        <label
          className="inline-flex shrink-0 items-center gap-2.5 text-[7px] font-semibold whitespace-nowrap"
          style={{ color: '#a8a8b8' }}
          title="Variation — more ghost notes and syncopation (not volume)"
        >
          <span className="shrink-0">Variation</span>
          <input
            type="range"
            min={1}
            max={2}
            step={0.05}
            value={temperature}
            disabled={disabled}
            onChange={(e) => onTemperatureChange(Number(e.target.value))}
            className="w-14 shrink-0 accent-[#ffb84d]"
          />
        </label>
      </div>
    </div>
  );
}
