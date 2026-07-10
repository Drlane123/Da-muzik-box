'use client';

import { STUDIO_UI_FONT_FAMILY } from '@/app/lib/studio/studioUiTypography';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { GripVertical } from 'lucide-react';

import { StudioAllInOneFxPanel } from '@/app/components/studio/StudioAllInOneFxPanel';
import { StudioInsertFxEditor } from '@/app/components/studio/StudioInsertFxEditor';
import {
  StudioFxPopoverMenu,
  useStudioFxPopover,
} from '@/app/components/studio/studioVocalFxPopoverWidgets';
import {
  normalizeFxStackOrder,
  reorderFxStack,
  type StudioFxStackSlot,
} from '@/app/lib/studio/studioFxStackOrder';
import {
  cloneStudioTrackInsertFxRack,
  studioInsertFxSuiteActive,
  type StudioTrackInsertFxRack,
} from '@/app/lib/studio/studioTrackInsertFx';
import { studioTrackVocalFxActive, type StudioTrackVocalFx } from '@/app/lib/studio/studioTrackVocalFx';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioVocoderCarrierTrack } from '@/app/lib/studio/studioVocoderCarrier';

/**
 * **F|X** opens a picker: DA FX Suite · Pitch Tune DSP · Vocoder DSP.
 * Each editor is separate — vocal DSP is not inside the FX Suite.
 */

export const CHANNEL_FX_SLOT_COUNT = 3 as const;

export type MixerEffectId =
  | ''
  | 'autotune'
  | 'vocoder'
  | 'eq'
  | 'compressor'
  | 'gate'
  | 'reverb'
  | 'delay'
  | 'chorus'
  | 'saturation'
  | 'filter'
  | 'limiter';

export const MIXER_EFFECT_OPTIONS: { id: MixerEffectId; label: string }[] = [
  { id: '', label: '— None —' },
  { id: 'eq', label: 'EQ' },
  { id: 'compressor', label: 'Comp' },
  { id: 'gate', label: 'Gate' },
  { id: 'reverb', label: 'Verb' },
  { id: 'delay', label: 'Delay' },
  { id: 'chorus', label: 'Chorus' },
  { id: 'saturation', label: 'Drive' },
  { id: 'filter', label: 'Filter' },
  { id: 'limiter', label: 'Limit' },
];

/** @deprecated Vocal DSP is not a mixer slot — use the F|X effect picker. */
export const MIXER_AUDIO_TRACK_EFFECT_OPTIONS = MIXER_EFFECT_OPTIONS;

export function emptyMixerFxSlots(): [MixerEffectId, MixerEffectId, MixerEffectId] {
  return ['', '', ''];
}

type SlotIndex = 0 | 1 | 2;

const PITCH_TUNE_ACCENT = '#ff9f43';
const VOCODER_ACCENT = '#67e8f9';
const ARMED_LED = '#4ade80';
/** Strip menu above F|X — DA FX Suite + vocal DSP labels + armed LED. */
const EFFECT_PICKER_MENU_W = 224;

type EffectPickerKind = 'suite' | 'autotune' | 'vocoder';

const STACK_SLOT_TO_KIND: Record<StudioFxStackSlot, EffectPickerKind> = {
  suite: 'suite',
  pitchTune: 'autotune',
  vocoder: 'vocoder',
};

function EffectPickerRow({
  label,
  accent,
  armed,
  highlighted = false,
  position,
  dragging = false,
  dragOver = false,
  onOpen,
  onGripPointerDown,
}: {
  label: string;
  accent: string;
  armed: boolean;
  highlighted?: boolean;
  position: number;
  dragging?: boolean;
  dragOver?: boolean;
  onOpen: () => void;
  onGripPointerDown: (e: React.PointerEvent) => void;
}) {
  const lit = armed || highlighted;
  return (
    <div
      className="mb-0.5 flex w-full items-stretch gap-1 rounded border last:mb-0 transition-colors"
      style={{
        borderColor: dragOver ? `${accent}cc` : lit ? `${accent}88` : '#2a2a36',
        background: dragging
          ? 'linear-gradient(180deg, #1a1a24 0%, #101018 100%)'
          : armed
            ? `linear-gradient(145deg, ${ARMED_LED}18 0%, ${accent}0c 55%, #0a0a10 100%)`
            : highlighted
              ? `linear-gradient(145deg, ${accent}22 0%, ${accent}0a 100%)`
              : 'linear-gradient(180deg, #14141c 0%, #0a0a10 100%)',
        boxShadow: dragOver
          ? `0 0 14px ${accent}44`
          : armed
            ? `0 0 10px ${ARMED_LED}33, inset 0 1px 0 ${ARMED_LED}22`
            : highlighted
              ? `0 0 12px ${accent}28`
              : 'none',
        opacity: dragging ? 0.55 : 1,
      }}
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${label}`}
        className="shrink-0 flex items-center justify-center px-1 rounded-l cursor-grab active:cursor-grabbing touch-none"
        style={{ color: '#5a5a68' }}
        onPointerDown={onGripPointerDown}
      >
        <GripVertical size={11} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex flex-1 items-center gap-2 rounded-r border-0 bg-transparent px-2 py-1.5 text-left"
      >
        <span
          className="shrink-0 tabular-nums text-[7px] font-black"
          style={{ color: '#4a4a58', fontFamily: STUDIO_UI_FONT_FAMILY, minWidth: '1ch' }}
          title="Signal chain position — top runs first"
        >
          {position}
        </span>
        <span
          aria-hidden
          title={armed ? `${label} — active` : `${label} — off`}
          className="shrink-0 rounded-full"
          style={{
            width: 8,
            height: 8,
            background: armed ? ARMED_LED : '#1a1a22',
            border: `1px solid ${armed ? '#86efac' : '#3a3a48'}`,
            boxShadow: armed ? `0 0 8px ${ARMED_LED}, 0 0 2px ${ARMED_LED}cc` : 'inset 0 1px 2px rgba(0,0,0,0.85)',
          }}
        />
        <span
          className="min-w-0 flex-1 text-[8px] font-black uppercase tracking-wide leading-tight whitespace-nowrap"
          style={{ color: lit ? (armed ? '#e8ffe8' : accent) : '#c8c8d8', fontFamily: STUDIO_UI_FONT_FAMILY }}
        >
          {label}
        </span>
        {armed ? (
          <span
            className="shrink-0 text-[6px] font-black uppercase tracking-wider"
            style={{ color: ARMED_LED, fontFamily: STUDIO_UI_FONT_FAMILY, textShadow: `0 0 6px ${ARMED_LED}88` }}
          >
            ON
          </span>
        ) : null}
      </button>
    </div>
  );
}

function EffectStackPicker({
  accent,
  order,
  showVocalEffects,
  suiteActive,
  pitchActive,
  vocoderActive,
  suiteOpen,
  vocalEditor,
  onReorder,
  onOpenEffect,
}: {
  accent: string;
  order: readonly StudioFxStackSlot[];
  showVocalEffects: boolean;
  suiteActive: boolean;
  pitchActive: boolean;
  vocoderActive: boolean;
  suiteOpen: boolean;
  vocalEditor: 'autotune' | 'vocoder' | null;
  onReorder: (next: [StudioFxStackSlot, StudioFxStackSlot, StudioFxStackSlot]) => void;
  onOpenEffect: (kind: EffectPickerKind) => void;
}) {
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const dragFromRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const visibleSlots: readonly StudioFxStackSlot[] = showVocalEffects ? order : ['suite'];

  const metaFor = (slot: StudioFxStackSlot) => {
    if (slot === 'suite') {
      return { label: 'DA FX Suite', accent, armed: suiteActive, highlighted: suiteOpen };
    }
    if (slot === 'pitchTune') {
      return {
        label: 'Pitch Tune DSP',
        accent: PITCH_TUNE_ACCENT,
        armed: pitchActive,
        highlighted: vocalEditor === 'autotune',
      };
    }
    return {
      label: 'Vocoder DSP',
      accent: VOCODER_ACCENT,
      armed: vocoderActive,
      highlighted: vocalEditor === 'vocoder',
    };
  };

  const finishDrag = useCallback(() => {
    dragFromRef.current = null;
    dragOverRef.current = null;
    setDragFrom(null);
    setDragOver(null);
  }, []);

  useEffect(() => {
    if (dragFrom == null) return;
    const onMove = (e: PointerEvent) => {
      const y = e.clientY;
      let over: number | null = null;
      for (let i = 0; i < visibleSlots.length; i += 1) {
        const el = rowRefs.current[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (y >= r.top && y <= r.bottom) {
          over = i;
          break;
        }
      }
      dragOverRef.current = over;
      setDragOver(over);
    };
    const onUp = () => {
      const from = dragFromRef.current;
      const over = dragOverRef.current;
      if (from != null && over != null && from !== over) {
        onReorder(reorderFxStack(order, from, over));
      }
      finishDrag();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragFrom, finishDrag, onReorder, order, visibleSlots.length]);

  return (
    <>
      <div
        className="suite-type-micro mb-1 px-1 text-[5px] leading-snug"
        style={{ color: '#5a5a68', textTransform: 'none', letterSpacing: '0.04em' }}
      >
        Drag ≡ to reorder chain · top = first
      </div>
      {visibleSlots.map((slot, index) => {
        const meta = metaFor(slot);
        return (
          <div
            key={slot}
            ref={(el) => {
              rowRefs.current[index] = el;
            }}
          >
            <EffectPickerRow
              label={meta.label}
              accent={meta.accent}
              armed={meta.armed}
              highlighted={meta.highlighted}
              position={index + 1}
              dragging={dragFrom === index}
              dragOver={dragOver === index && dragFrom !== index}
              onOpen={() => onOpenEffect(STACK_SLOT_TO_KIND[slot])}
              onGripPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                dragFromRef.current = index;
                setDragFrom(index);
                setDragOver(index);
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              }}
            />
          </div>
        );
      })}
    </>
  );
}

export interface ChannelStripFxButtonProps {
  variant: 'track' | 'master';
  channelLabel: string;
  slots: [MixerEffectId, MixerEffectId, MixerEffectId];
  onSlotChange: (slot: SlotIndex, id: MixerEffectId) => void;
  trackAccentHex?: string;
  effectOptions?: { id: MixerEffectId; label: string }[];
  onActivate?: () => void;
  insertFxRack?: StudioTrackInsertFxRack;
  onInsertFxRackChange?: (next: StudioTrackInsertFxRack) => void;
  vocalFx?: StudioTrackVocalFx;
  onVocalFxChange?: (next: StudioTrackVocalFx) => void;
  vocalTrackIndex?: number;
  carrierTracks?: readonly StudioVocoderCarrierTrack[];
  songKeyRoot?: number;
  songKeyMode?: StudioDetectedKeyMode;
  sessionBpm?: number;
  /** Mixer lane for analyser / FX Suite meters. */
  trackIndex?: number;
}

export function ChannelStripFxButton({
  variant,
  channelLabel,
  slots,
  onSlotChange: _onSlotChange,
  trackAccentHex,
  effectOptions: _effectOptions = MIXER_EFFECT_OPTIONS,
  onActivate,
  insertFxRack,
  onInsertFxRackChange,
  vocalFx,
  onVocalFxChange,
  vocalTrackIndex = 0,
  carrierTracks = [],
  songKeyRoot = 0,
  songKeyMode = 'major',
  sessionBpm = 120,
  trackIndex,
}: ChannelStripFxButtonProps) {
  void _onSlotChange;
  void _effectOptions;

  const meterTrackIndex = trackIndex ?? vocalTrackIndex;
  const accent = variant === 'master' ? '#7cf4c6' : trackAccentHex ?? '#6a6a78';
  const showVocalEffects = Boolean(vocalFx && onVocalFxChange);

  const [suiteOpen, setSuiteOpen] = useState(false);
  const [vocalEditor, setVocalEditor] = useState<'autotune' | 'vocoder' | null>(null);
  const { btnRef, open: menuOpen, setOpen: setMenuOpen, menuStyle, openMenu } = useStudioFxPopover({
    preferAbove: true,
    menuWidth: EFFECT_PICKER_MENU_W,
    scrollable: false,
  });
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const suiteFlushRef = useRef<(() => void) | null>(null);
  const onInsertFxRackChangeRef = useRef(onInsertFxRackChange);
  onInsertFxRackChangeRef.current = onInsertFxRackChange;

  const suiteActive = insertFxRack ? studioInsertFxSuiteActive(insertFxRack) : false;
  const rackActive = suiteActive;
  const pitchActive = Boolean(vocalFx?.autotuneOn);
  const vocoderActive = Boolean(vocalFx?.vocoderOn);
  const vocalActive = vocalFx ? studioTrackVocalFxActive(vocalFx) : false;
  const hasFx = rackActive || vocalActive || slots.some((s) => s !== '');

  const handleRackChange = useCallback((next: StudioTrackInsertFxRack) => {
    onInsertFxRackChangeRef.current?.(cloneStudioTrackInsertFxRack(next));
  }, []);

  const bindSuiteFlush = useCallback((flush: (() => void) | null) => {
    suiteFlushRef.current = flush;
  }, []);

  const reposition = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    setAnchorRect(el.getBoundingClientRect());
  }, [btnRef]);

  const closeSuite = useCallback(() => {
    suiteFlushRef.current?.();
    setSuiteOpen(false);
  }, []);

  const closeVocalEditor = useCallback(() => {
    setVocalEditor(null);
  }, []);

  const openEffect = useCallback(
    (kind: EffectPickerKind) => {
      reposition();
      setMenuOpen(false);
      if (kind === 'suite') {
        closeVocalEditor();
        setSuiteOpen(true);
        return;
      }
      if (!onVocalFxChange || !vocalFx) return;
      closeSuite();
      if (kind === 'autotune') {
        setVocalEditor('autotune');
        return;
      }
      setVocalEditor('vocoder');
    },
    [closeSuite, closeVocalEditor, onVocalFxChange, reposition, setMenuOpen, vocalFx],
  );

  const fxStackOrder = normalizeFxStackOrder(insertFxRack?.fxStackOrder);

  const handleFxStackReorder = useCallback(
    (next: [StudioFxStackSlot, StudioFxStackSlot, StudioFxStackSlot]) => {
      if (!insertFxRack || !onInsertFxRackChange) return;
      onInsertFxRackChange({
        ...cloneStudioTrackInsertFxRack(insertFxRack),
        fxStackOrder: next,
      });
    },
    [insertFxRack, onInsertFxRackChange],
  );

  useLayoutEffect(() => {
    if (!suiteOpen && !vocalEditor) return;
    reposition();
  }, [suiteOpen, vocalEditor, reposition]);

  useEffect(() => {
    if (!suiteOpen && !vocalEditor) return;
    const onResize = () => reposition();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [suiteOpen, vocalEditor, reposition]);

  const panelLit = suiteOpen || vocalEditor != null;
  const glow = panelLit || hasFx ? accent : '#424250';
  const letterStyle = (): CSSProperties => ({
    fontFamily: STUDIO_UI_FONT_FAMILY,
    fontSize: 8,
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: panelLit || hasFx ? '#f4f4ff' : '#a0a0b4',
    textShadow: panelLit || hasFx ? `0 0 6px ${accent}` : '0 1px 1px rgba(0,0,0,0.9)',
  });

  const suite =
    suiteOpen &&
    insertFxRack &&
    onInsertFxRackChange ? (
      <StudioAllInOneFxPanel
        open
        channelLabel={channelLabel}
        accentHex={accent}
        anchorRect={anchorRect}
        rack={cloneStudioTrackInsertFxRack(insertFxRack)}
        onRackChange={handleRackChange}
        onClose={closeSuite}
        onRegisterFlush={bindSuiteFlush}
        sessionBpm={sessionBpm}
        trackIndex={meterTrackIndex}
      />
    ) : null;

  const vocalEditorPanel =
    vocalEditor &&
    insertFxRack &&
    onInsertFxRackChange &&
    onVocalFxChange ? (
      <StudioInsertFxEditor
        open
        effectId={vocalEditor}
        channelLabel={channelLabel}
        accentHex={accent}
        anchorRect={anchorRect}
        rack={cloneStudioTrackInsertFxRack(insertFxRack)}
        onRackChange={handleRackChange}
        vocalFx={vocalFx}
        onVocalFxChange={onVocalFxChange}
        vocalTrackIndex={vocalTrackIndex}
        carrierTracks={carrierTracks}
        songKeyRoot={songKeyRoot}
        songKeyMode={songKeyMode}
        onClose={closeVocalEditor}
      />
    ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={
          showVocalEffects
            ? `${channelLabel} — Effects: DA FX Suite, Pitch Tune, Vocoder`
            : `${channelLabel} — Effects: DA FX Suite`
        }
        aria-label="Effects menu"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onActivate?.();
          openMenu(e);
        }}
        className="shrink-0 flex items-center justify-center gap-0"
        style={{
          minWidth: 28,
          height: 16,
          padding: '0 5px',
          borderRadius: 2,
          border: `1px solid ${panelLit || menuOpen || hasFx ? accent : '#353545'}`,
          background: panelLit || menuOpen ? `${accent}22` : hasFx ? `${accent}0f` : '#18181f',
          boxShadow: panelLit || menuOpen ? `0 0 8px ${accent}44` : hasFx ? `0 0 4px ${accent}22` : 'none',
        }}
      >
        <span style={letterStyle()}>F</span>
        <span aria-hidden style={{ width: 1, height: 9, margin: '0 2px', background: glow, opacity: 0.6, borderRadius: 1 }} />
        <span style={letterStyle()}>X</span>
      </button>

      <StudioFxPopoverMenu
        open={menuOpen}
        menuStyle={menuStyle}
        title="Effects"
        accent={accent}
        dataTestId="studio-effect-picker"
        hideTitle
        compact
        scrollable
      >
        <EffectStackPicker
          accent={accent}
          order={fxStackOrder}
          showVocalEffects={showVocalEffects}
          suiteActive={suiteActive}
          pitchActive={pitchActive}
          vocoderActive={vocoderActive}
          suiteOpen={suiteOpen}
          vocalEditor={vocalEditor}
          onReorder={handleFxStackReorder}
          onOpenEffect={openEffect}
        />
      </StudioFxPopoverMenu>

      {suite}
      {vocalEditorPanel}
    </>
  );
}
