'use client';

import { useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { Se2SynthGenoPluginDraft } from '@/app/lib/studio/se2SynthGenoChordPlugin';
import type { GenoLoopBarCount } from '@/app/lib/studio/se2SynthGenoLoopBarCount';
import { GENO_LOOP_BAR_COUNTS } from '@/app/lib/studio/se2SynthGenoLoopBarCount';
import type { GenoVoicingDepth } from '@/app/lib/studio/se2SynthGenoVoicingDepth';
import {
  GENO_BAR_CHOP_OPTIONS,
  type GenoBarChordSpec,
  type GenoBarChopQuant,
} from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { GenoPassingChordOption } from '@/app/lib/studio/se2SynthGenoHarmonyIntel';
import {
  genoBuildPluginLoopBarViews,
  genoPluginLoopTimelineBarCount,
  GENO_PLUGIN_BAR_MIN_PX,
  GENO_PLUGIN_CHORD_HEADER_H_PX,
  GENO_PLUGIN_LANE_RANGES,
} from '@/app/lib/studio/se2SynthGenoPluginDisplay';
import { Se2SynthGenoSelectChip, genoSelectGlow } from '@/app/components/studio/Se2SynthGenoSelectionUi';
import { Se2SynthGenoLoopChordPianoRoll } from '@/app/components/studio/Se2SynthGenoLoopChordPianoRoll';
import type {
  Se2SynthGenoLoopChordPianoRollEditState,
  Se2SynthGenoLoopChordPianoRollHandle,
} from '@/app/components/studio/Se2SynthGenoLoopChordPianoRoll';
import { Se2SynthGenoLoopInsertTailRow } from '@/app/components/studio/Se2SynthGenoLoopInsertTailRow';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import type {
  GenoLiveArpPattern,
  GenoLiveArpRate,
} from '@/app/lib/studio/se2SynthGenoLiveArpTypes';
import { Se2SynthGenoLaneVolumeSlider } from '@/app/components/studio/Se2SynthGenoLaneVolumeSlider';

export type Se2SynthGenoPluginLoopLaneVolume = {
  value: number;
  onChange: (gain: number) => void;
};

export type Se2SynthGenoPluginLoopLaneActions = {
  enabled: boolean;
  hasNotes: boolean;
  onToggle?: () => void;
  onClear: () => void;
  onRegen: () => void;
  /** Restore notes from before the last full-lane Regenerate. */
  canUndoRegen?: boolean;
  onUndoRegen?: () => void;
};

export type Se2SynthGenoPluginLoopLaneEditActions = {
  hasSelection: boolean;
  canUndo: boolean;
  onErase: () => void;
  onDuplicate: () => void;
  onCut: () => void;
  onUndo: () => void;
};

export type Se2SynthGenoPluginLoopViewProps = {
  draft: Se2SynthGenoPluginDraft | null;
  beatsPerBar: number;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  accentHex: string;
  showChords: boolean;
  showMelody: boolean;
  showBass: boolean;
  showFiller?: boolean;
  selectedBar?: number | null;
  disabled?: boolean;
  barChordSpecs?: readonly GenoBarChordSpec[];
  onBarDegreeChange?: (bar: number, degree: number) => void;
  onBarChopQuantChange?: (bar: number, chopQuant: GenoBarChopQuant) => void;
  chordLane?: Se2SynthGenoPluginLoopLaneActions;
  melodyLane?: Se2SynthGenoPluginLoopLaneActions;
  melodyLaneLabel?: string;
  bassLane?: Se2SynthGenoPluginLoopLaneActions;
  fillerLane?: Se2SynthGenoPluginLoopLaneActions;
  /** 8-bar / 4-bar control — loop editor shows full timeline even if draft.bars is chord-card count. */
  timelineBarCount?: number;
  /** Beat within preview loop (0 … bars×beatsPerBar) — drives play marker. */
  previewBeat?: number | null;
  /** 4 / 8 / 12 bar loop selector — shown beside the Loop Editor title. */
  loopBarCount?: GenoLoopBarCount;
  onLoopBarCountChange?: (barCount: GenoLoopBarCount) => void;
  previewing?: boolean;
  onTogglePreview?: () => void;
  previewDisabled?: boolean;
  /** 4 / 5 / 6 / 7 note voicing — shown beside bar count chips in header. */
  voicingDepth?: {
    selected: GenoVoicingDepth;
    options: readonly GenoVoicingDepth[];
    onPick: (depth: GenoVoicingDepth) => void;
  };
  /** Pop / R&B / Trap style — dropdown in header, spaced from voicing depth. */
  styleSelect?: {
    value: string;
    options: readonly { id: string; label: string }[];
    onChange: (id: string) => void;
  };
  /** Insert tail — piano-roll ruler bar focus + options (Loop Editor chords lane). */
  tailInsert?: {
    focusBar: number | null;
    fromRoman: string;
    toRoman: string;
    canInsert: boolean;
    isLoopWrap?: boolean;
    options: readonly GenoPassingChordOption[];
    onFocusBar: (bar: number) => void;
    onInsert: (option: GenoPassingChordOption) => void;
  };
  /** Manual piano-roll edits (move / resize / delete). */
  onChordNotesChange?: (notes: StudioEditor2GenNote[]) => void;
  onBassNotesChange?: (notes: StudioEditor2GenNote[]) => void;
  onMelodyNotesChange?: (notes: StudioEditor2GenNote[]) => void;
  onFillerNotesChange?: (notes: StudioEditor2GenNote[]) => void;
  /** Chord voice-leading glide — rendered beside Chords in the loop editor toolbar. */
  chordGlideControls?: Se2SynthGenoPluginLoopChordGlideControls;
  /** Glide + slide toggles — rendered beside Bass in the loop editor toolbar. */
  bassGlideControls?: Se2SynthGenoPluginLoopBassGlideControls;
  /** Arp pattern + rate — rendered beside Arp in the loop editor toolbar (B01). */
  arpControls?: Se2SynthGenoPluginLoopArpControls;
  /** Note Filler quant + draw/erase (B01). */
  fillerControls?: Se2SynthGenoPluginLoopFillerControls;
  /** Preview-only mix per lane (B01 / B02 loop editor). */
  laneVolumes?: {
    chords?: Se2SynthGenoPluginLoopLaneVolume;
    melody?: Se2SynthGenoPluginLoopLaneVolume;
    bass?: Se2SynthGenoPluginLoopLaneVolume;
    filler?: Se2SynthGenoPluginLoopLaneVolume;
  };
};

export type Se2SynthGenoPluginLoopFillerControls = {
  quant: import('@/app/lib/studio/se2SynthGenoFillerEngine').GenoFillerQuant;
  editTool: 'draw' | 'erase';
  snapBeats: number;
  onQuantChange: (quant: import('@/app/lib/studio/se2SynthGenoFillerEngine').GenoFillerQuant) => void;
  onEditToolChange: (tool: 'draw' | 'erase') => void;
};

export type Se2SynthGenoPluginLoopArpControls = {
  pattern: GenoLiveArpPattern;
  rate: GenoLiveArpRate;
  onPatternChange: (pattern: GenoLiveArpPattern) => void;
  onRateChange: (rate: GenoLiveArpRate) => void;
};

export type Se2SynthGenoPluginLoopChordGlideControls = {
  glideOn: boolean;
  onGlideOn: () => void;
  onGlideOff: () => void;
};

export type Se2SynthGenoPluginLoopBassGlideControls = {
  glideOn?: boolean;
  onGlideOn?: () => void;
  onGlideOff?: () => void;
  slideOn: boolean;
  onSlideOn: () => void;
  onSlideOff: () => void;
};

function barColumnStyle(): CSSProperties {
  return {
    flex: '1 1 0',
    minWidth: GENO_PLUGIN_BAR_MIN_PX,
    maxWidth: '100%',
  };
}

function LoopBarCountChip({
  active,
  label,
  accentHex,
  disabled,
  onClick,
}: {
  active: boolean;
  label: string;
  accentHex: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Se2SynthGenoSelectChip
      active={active}
      accentHex={accentHex}
      label={label}
      disabled={disabled}
      onClick={onClick}
    />
  );
}

function LaneToolbar({
  label,
  color,
  laneActions,
  disabled,
  editActions,
  toolbarExtras,
  laneVolume,
}: {
  label: string;
  color: string;
  laneActions: Se2SynthGenoPluginLoopLaneActions;
  disabled?: boolean;
  editActions?: Se2SynthGenoPluginLoopLaneEditActions;
  toolbarExtras?: ReactNode;
  laneVolume?: Se2SynthGenoPluginLoopLaneVolume;
}) {
  const enabled = laneActions.enabled;
  const canUndo = Boolean(editActions?.canUndo || laneActions.canUndoRegen);
  const handleUndo = () => {
    if (editActions?.canUndo) {
      editActions.onUndo();
      return;
    }
    if (laneActions.canUndoRegen && laneActions.onUndoRegen) {
      laneActions.onUndoRegen();
    }
  };
  return (
    <div
      className="flex items-center justify-between gap-2 px-2.5 py-1 border-b flex-wrap"
      style={{ borderColor: '#2a2a38', background: 'rgba(0,0,0,0.35)' }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-wrap flex-1">
        <button
          type="button"
          disabled={disabled || !laneActions.onToggle}
          onClick={laneActions.onToggle}
          className="text-[9px] font-black uppercase tracking-wide shrink-0"
          style={{
            color: enabled ? color : '#666',
            opacity: enabled ? 1 : 0.5,
            cursor: laneActions.onToggle ? 'pointer' : 'default',
          }}
          title={laneActions.onToggle ? `Show/hide ${label.toLowerCase()} lane` : undefined}
        >
          {label}
        </button>
        {laneVolume ? (
          <Se2SynthGenoLaneVolumeSlider
            value={laneVolume.value}
            onChange={laneVolume.onChange}
            color={color}
            disabled={disabled}
            laneEnabled={enabled}
          />
        ) : null}
        {toolbarExtras}
      </div>
      <div className="flex gap-1 shrink-0 flex-wrap justify-end">
        {editActions ? (
          <>
            <button
              type="button"
              disabled={disabled || !enabled || !editActions.hasSelection}
              onClick={editActions.onErase}
              className="rounded border px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-wide disabled:opacity-35"
              style={{
                borderColor: '#ef444488',
                background: '#ef444414',
                color: '#fca5a5',
              }}
              title="Erase selected note (Del)"
            >
              Erase
            </button>
            <button
              type="button"
              disabled={disabled || !enabled || !editActions.hasSelection}
              onClick={editActions.onDuplicate}
              className="rounded border px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-wide disabled:opacity-35"
              style={{
                borderColor: `${color}88`,
                background: `${color}18`,
                color,
              }}
              title="Duplicate selected note (Ctrl+D)"
            >
              Duplicate
            </button>
            <button
              type="button"
              disabled={disabled || !enabled || !editActions.hasSelection}
              onClick={editActions.onCut}
              className="rounded border px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-wide disabled:opacity-35"
              style={{
                borderColor: '#94a3b888',
                background: '#94a3b814',
                color: '#cbd5e1',
              }}
              title="Cut selected note (Ctrl+X)"
            >
              Cut
            </button>
            <button
              type="button"
              disabled={disabled || !enabled || !canUndo}
              onClick={handleUndo}
              className="rounded border px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-wide disabled:opacity-35"
              style={{
                borderColor: '#a78bfa88',
                background: '#a78bfa14',
                color: '#c4b5fd',
              }}
              title={
                laneActions.canUndoRegen
                  ? 'Undo regenerate steps (Ctrl+Z when no edit history)'
                  : 'Undo edit (Ctrl+Z)'
              }
            >
              Undo
            </button>
          </>
        ) : null}
        <button
          type="button"
          disabled={disabled || !enabled}
          onClick={laneActions.onRegen}
          className="rounded border px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-wide disabled:opacity-35"
          style={{
            borderColor: `${color}88`,
            background: `${color}18`,
            color,
          }}
        >
          Regenerate
        </button>
        <button
          type="button"
          disabled={disabled || !laneActions.hasNotes}
          onClick={laneActions.onClear}
          className="rounded border px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-wide disabled:opacity-35"
          style={{
            borderColor: '#ef444488',
            background: '#ef444414',
            color: '#fca5a5',
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function ChordLaneGlideChips({
  color,
  disabled,
  laneEnabled,
  controls,
}: {
  color: string;
  disabled?: boolean;
  laneEnabled: boolean;
  controls: Se2SynthGenoPluginLoopChordGlideControls;
}) {
  const chip = (active: boolean, onClick: () => void, chipLabel: string) => (
    <button
      type="button"
      disabled={disabled || !laneEnabled}
      onClick={onClick}
      className="rounded border px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-wide disabled:opacity-35"
      style={{
        borderColor: active ? `${color}88` : '#3a3a48',
        background: active ? `${color}18` : 'transparent',
        color: active ? color : '#9a9aaa',
      }}
    >
      {chipLabel}
    </button>
  );

  return (
    <div className="flex items-center gap-1 flex-wrap min-w-0">
      {chip(controls.glideOn, controls.onGlideOn, 'Glide on')}
      {chip(!controls.glideOn, controls.onGlideOff, 'Glide off')}
    </div>
  );
}

function BassLaneGlideChips({
  color,
  disabled,
  laneEnabled,
  controls,
}: {
  color: string;
  disabled?: boolean;
  laneEnabled: boolean;
  controls: Se2SynthGenoPluginLoopBassGlideControls;
}) {
  const chip = (active: boolean, onClick: () => void, chipLabel: string) => (
    <button
      type="button"
      disabled={disabled || !laneEnabled}
      onClick={onClick}
      className="rounded border px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-wide disabled:opacity-35"
      style={{
        borderColor: active ? `${color}88` : '#3a3a48',
        background: active ? `${color}18` : 'transparent',
        color: active ? color : '#9a9aaa',
      }}
    >
      {chipLabel}
    </button>
  );

  return (
    <div className="flex items-center gap-1 flex-wrap min-w-0">
      {controls.onGlideOn && controls.onGlideOff ? (
        <>
          {chip(!!controls.glideOn, controls.onGlideOn, 'Glide on')}
          {chip(!controls.glideOn, controls.onGlideOff, 'Glide off')}
          <span className="w-px h-3 bg-white/10 shrink-0" aria-hidden />
        </>
      ) : null}
      {chip(controls.slideOn, controls.onSlideOn, 'Slide on')}
      {chip(!controls.slideOn, controls.onSlideOff, 'Slide off')}
    </div>
  );
}

const ARP_PATTERN_OPTIONS: readonly { id: GenoLiveArpPattern; label: string }[] = [
  { id: 'chord', label: 'Chord' },
  { id: 'up', label: 'Up' },
  { id: 'down', label: 'Down' },
  { id: 'up-down', label: 'U-D' },
  { id: 'root', label: 'Root' },
];

const ARP_RATE_OPTIONS: readonly { id: GenoLiveArpRate; label: string }[] = [
  { id: '4th', label: '1/4' },
  { id: '8th', label: '1/8' },
  { id: '16th', label: '1/16' },
  { id: 'triplet8', label: 'Trip' },
];

function ArpLaneToolbarChips({
  color,
  disabled,
  laneEnabled,
  controls,
}: {
  color: string;
  disabled?: boolean;
  laneEnabled: boolean;
  controls: Se2SynthGenoPluginLoopArpControls;
}) {
  const chip = (active: boolean, onClick: () => void, chipLabel: string) => (
    <button
      type="button"
      disabled={disabled || !laneEnabled}
      onClick={onClick}
      className="rounded border px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-wide disabled:opacity-35"
      style={{
        borderColor: active ? `${color}88` : '#3a3a48',
        background: active ? `${color}18` : 'transparent',
        color: active ? color : '#9a9aaa',
      }}
    >
      {chipLabel}
    </button>
  );

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1 flex-wrap min-w-0">
        {ARP_PATTERN_OPTIONS.map((opt) =>
          chip(controls.pattern === opt.id, () => controls.onPatternChange(opt.id), opt.label),
        )}
      </div>
      <div className="flex items-center gap-1 flex-wrap min-w-0">
        <span className="text-[5px] font-bold uppercase tracking-widest opacity-40 shrink-0">Rate</span>
        {ARP_RATE_OPTIONS.map((opt) =>
          chip(controls.rate === opt.id, () => controls.onRateChange(opt.id), opt.label),
        )}
      </div>
    </div>
  );
}

function FillerLaneToolbarChips({
  color,
  disabled,
  laneEnabled,
  controls,
}: {
  color: string;
  disabled?: boolean;
  laneEnabled: boolean;
  controls: Se2SynthGenoPluginLoopFillerControls;
}) {
  const chip = (active: boolean, onClick: () => void, chipLabel: string) => (
    <button
      type="button"
      disabled={disabled || !laneEnabled}
      onClick={onClick}
      className="rounded border px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-wide disabled:opacity-35"
      style={{
        borderColor: active ? `${color}88` : '#3a3a48',
        background: active ? `${color}18` : 'transparent',
        color: active ? color : '#9a9aaa',
      }}
    >
      {chipLabel}
    </button>
  );

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1 flex-wrap min-w-0">
        <span className="text-[5px] font-bold uppercase tracking-widest opacity-40 shrink-0">Quant</span>
        {GENO_FILLER_QUANT_OPTIONS.map((opt) =>
          chip(controls.quant === opt.id, () => controls.onQuantChange(opt.id), opt.label),
        )}
      </div>
      <div className="flex items-center gap-1 flex-wrap min-w-0">
        <span className="text-[5px] font-bold uppercase tracking-widest opacity-40 shrink-0">Tool</span>
        {chip(controls.editTool === 'draw', () => controls.onEditToolChange('draw'), 'Draw')}
        {chip(controls.editTool === 'erase', () => controls.onEditToolChange('erase'), 'Erase')}
      </div>
    </div>
  );
}

const GENO_FILLER_QUANT_OPTIONS = [
  { id: '4th' as const, label: '1/4' },
  { id: '8th' as const, label: '1/8' },
  { id: '16th' as const, label: '1/16' },
];

function LoopLanePianoRollCard({
  label,
  color,
  notes,
  bars,
  beatsPerBar,
  previewBeat,
  disabled,
  laneActions,
  minMidi,
  maxMidi,
  onNotesChange,
  pianoRollRef,
  rollEdit,
  onRollEditChange,
  tailInsert,
  toolbarExtras,
  snapBeatsOverride,
  gridEditTool,
  laneVolume,
}: {
  label: string;
  color: string;
  notes: readonly StudioEditor2GenNote[];
  bars: number;
  beatsPerBar: number;
  previewBeat?: number | null;
  disabled?: boolean;
  laneActions: Se2SynthGenoPluginLoopLaneActions;
  minMidi: number;
  maxMidi: number;
  onNotesChange?: (notes: StudioEditor2GenNote[]) => void;
  pianoRollRef: RefObject<Se2SynthGenoLoopChordPianoRollHandle | null>;
  rollEdit: Se2SynthGenoLoopChordPianoRollEditState;
  onRollEditChange: (state: Se2SynthGenoLoopChordPianoRollEditState) => void;
  tailInsert?: Se2SynthGenoPluginLoopViewProps['tailInsert'];
  toolbarExtras?: ReactNode;
  snapBeatsOverride?: number;
  gridEditTool?: 'draw' | 'erase';
  laneVolume?: Se2SynthGenoPluginLoopLaneVolume;
}) {
  const editable = !!onNotesChange;
  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: `${color}44`, background: '#06080c' }}
    >
      <LaneToolbar
        label={label}
        color={color}
        laneActions={laneActions}
        disabled={disabled}
        toolbarExtras={toolbarExtras}
        laneVolume={laneVolume}
        editActions={
          editable
            ? {
                hasSelection: rollEdit.hasSelection,
                canUndo: rollEdit.canUndo,
                onErase: () => pianoRollRef.current?.deleteSelected(),
                onDuplicate: () => pianoRollRef.current?.duplicateSelected(),
                onCut: () => pianoRollRef.current?.cutSelected(),
                onUndo: () => pianoRollRef.current?.undo(),
              }
            : undefined
        }
      />
      {laneActions.enabled ? (
        <>
          <Se2SynthGenoLoopChordPianoRoll
            ref={pianoRollRef}
            notes={notes}
            barCount={bars}
            beatsPerBar={beatsPerBar}
            accentHex={color}
            minMidi={minMidi}
            maxMidi={maxMidi}
            previewBeat={previewBeat}
            disabled={disabled}
            onNotesChange={onNotesChange}
            onEditStateChange={onRollEditChange}
            tailFocusBar={tailInsert?.focusBar ?? undefined}
            onTailFocusBar={tailInsert?.onFocusBar}
            snapBeatsOverride={snapBeatsOverride}
            gridEditTool={gridEditTool}
          />
          {tailInsert ? (
            <Se2SynthGenoLoopInsertTailRow
              accentHex={color}
              disabled={disabled}
              focusBar={tailInsert.focusBar}
              fromRoman={tailInsert.fromRoman}
              toRoman={tailInsert.toRoman}
              canInsert={tailInsert.canInsert}
              isLoopWrap={tailInsert.isLoopWrap}
              options={tailInsert.options}
              onInsert={tailInsert.onInsert}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function Se2SynthGenoPluginLoopView({
  draft,
  beatsPerBar,
  keyRoot,
  keyMode,
  accentHex,
  showChords,
  showMelody,
  showBass,
  showFiller = false,
  selectedBar,
  disabled = false,
  barChordSpecs,
  onBarDegreeChange,
  onBarChopQuantChange,
  chordLane,
  melodyLane,
  melodyLaneLabel = 'Melody',
  bassLane,
  fillerLane,
  timelineBarCount,
  previewBeat = null,
  loopBarCount,
  onLoopBarCountChange,
  previewing = false,
  onTogglePreview,
  previewDisabled = false,
  voicingDepth,
  styleSelect,
  tailInsert,
  onChordNotesChange,
  onBassNotesChange,
  onMelodyNotesChange,
  onFillerNotesChange,
  chordGlideControls,
  bassGlideControls,
  arpControls,
  fillerControls,
  laneVolumes,
}: Se2SynthGenoPluginLoopViewProps) {
  const chordPianoRollRef = useRef<Se2SynthGenoLoopChordPianoRollHandle>(null);
  const bassPianoRollRef = useRef<Se2SynthGenoLoopChordPianoRollHandle>(null);
  const melodyPianoRollRef = useRef<Se2SynthGenoLoopChordPianoRollHandle>(null);
  const fillerPianoRollRef = useRef<Se2SynthGenoLoopChordPianoRollHandle>(null);
  const [chordRollEdit, setChordRollEdit] = useState<Se2SynthGenoLoopChordPianoRollEditState>({
    hasSelection: false,
    canUndo: false,
  });
  const [bassRollEdit, setBassRollEdit] = useState<Se2SynthGenoLoopChordPianoRollEditState>({
    hasSelection: false,
    canUndo: false,
  });
  const [melodyRollEdit, setMelodyRollEdit] = useState<Se2SynthGenoLoopChordPianoRollEditState>({
    hasSelection: false,
    canUndo: false,
  });
  const [fillerRollEdit, setFillerRollEdit] = useState<Se2SynthGenoLoopChordPianoRollEditState>({
    hasSelection: false,
    canUndo: false,
  });

  const bars = genoPluginLoopTimelineBarCount({
    loopBarCount,
    timelineBarCount,
    draftBars: draft?.bars,
  });
  const barViews = useMemo(() => {
    if (!draft?.harmony) return [];
    return genoBuildPluginLoopBarViews({
      harmony: draft.harmony,
      chordNotes: draft.chordNotes,
      melodyNotes: draft.melodyNotes,
      bassNotes: draft.bassNotes,
      barCount: bars,
      beatsPerBar,
      keyRoot,
      keyMode,
      barChordSpecs,
    });
  }, [draft, bars, beatsPerBar, keyRoot, keyMode, barChordSpecs]);

  return (
    <div
      className="rounded-xl border overflow-hidden w-full"
      style={{
        borderColor: `${accentHex}66`,
        background: 'linear-gradient(180deg, #141820 0%, #080810 100%)',
        boxShadow: `inset 0 1px 0 ${accentHex}28, 0 8px 32px rgba(0,0,0,0.45)`,
      }}
    >
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b"
        style={{ borderColor: '#252530' }}
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
          <span className="text-[10px] font-black uppercase tracking-widest shrink-0" style={{ color: accentHex }}>
            Loop Editor
          </span>
          {onLoopBarCountChange ? (
            <div className="flex items-center gap-1 shrink-0">
              {GENO_LOOP_BAR_COUNTS.map((n) => (
                <LoopBarCountChip
                  key={n}
                  active={loopBarCount === n}
                  label={`${n} bars`}
                  accentHex={accentHex}
                  disabled={disabled}
                  onClick={() => onLoopBarCountChange(n)}
                />
              ))}
            </div>
          ) : loopBarCount != null ? (
            <span className="text-[8px] font-mono opacity-55">{loopBarCount} bars</span>
          ) : null}
          {voicingDepth ? (
            <div
              className="flex items-center shrink-0 ml-3 pl-3 border-l"
              style={{ borderColor: 'rgba(255,255,255,0.12)' }}
            >
              <div
                className="flex items-center gap-0.5 rounded-md border px-1 py-0.5"
                style={{
                  borderColor: `${accentHex}44`,
                  background: `linear-gradient(180deg, ${accentHex}12 0%, rgba(12,12,20,0.92) 100%)`,
                  boxShadow: `inset 0 1px 0 ${accentHex}18`,
                }}
              >
                {voicingDepth.options.map((depth) => {
                  const on = voicingDepth.selected === depth;
                  return (
                    <button
                      key={depth}
                      type="button"
                      disabled={disabled}
                      onClick={() => voicingDepth.onPick(depth)}
                      className="rounded border px-2 py-1 text-[7px] font-bold font-mono disabled:opacity-35 whitespace-nowrap"
                      style={{
                        borderColor: on ? `${accentHex}aa` : 'transparent',
                        background: on ? `${accentHex}28` : 'transparent',
                        color: on ? accentHex : '#b0b0bc',
                      }}
                      title={`${depth}-note voicing for every chord in the progression`}
                    >
                      {depth} notes
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {styleSelect ? (
            <div
              className="flex items-center gap-1.5 shrink-0 ml-4 pl-4 border-l"
              style={{ borderColor: 'rgba(255,255,255,0.12)' }}
            >
              <span className="text-[7px] font-bold uppercase tracking-widest opacity-50" style={{ color: '#a8a8b8' }}>
                Style
              </span>
              <select
                disabled={disabled}
                value={styleSelect.value}
                onChange={(e) => styleSelect.onChange(e.target.value)}
                className="rounded border px-2 py-1 text-[8px] font-bold outline-none disabled:opacity-40 min-w-[88px]"
                style={{
                  borderColor: `${accentHex}55`,
                  background: '#0c0c14',
                  color: '#ececf4',
                }}
                title="Chord style"
              >
                {styleSelect.options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {onTogglePreview ? (
            <div
              className="flex items-center shrink-0 ml-3 pl-3 border-l"
              style={{ borderColor: 'rgba(255,255,255,0.12)' }}
            >
              <button
                type="button"
                disabled={disabled || previewDisabled}
                onClick={onTogglePreview}
                className="rounded border px-2.5 py-1 text-[8px] font-bold uppercase tracking-wide disabled:opacity-40 whitespace-nowrap"
                style={{
                  borderColor: previewing ? '#ef444488' : `${accentHex}66`,
                  background: previewing ? '#ef444422' : `${accentHex}14`,
                  color: previewing ? '#fca5a5' : accentHex,
                }}
              >
                {previewing ? 'Stop' : 'Preview'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto overscroll-x-contain px-3 py-3">
        {!draft || barViews.length === 0 ? (
          <div className="text-center py-10 text-[9px] opacity-45">Hit Generate to fill the loop</div>
        ) : (
          <div className="relative w-full min-w-0 flex flex-col gap-4">
            <div className="flex gap-1.5 min-w-0 mb-0.5">
              {barViews.map((bv) => (
                <div
                  key={bv.bar}
                  className="rounded-lg border flex-1 min-w-0 flex items-stretch overflow-hidden transition-all"
                  style={{
                    ...barColumnStyle(),
                    minHeight: GENO_PLUGIN_CHORD_HEADER_H_PX,
                    borderColor: selectedBar === bv.bar ? `${accentHex}cc` : '#404050',
                    background:
                      selectedBar === bv.bar
                        ? `linear-gradient(180deg, ${accentHex}30 0%, #101018 100%)`
                        : 'linear-gradient(180deg, #222830 0%, #121820 100%)',
                    boxShadow: selectedBar === bv.bar ? genoSelectGlow(true, accentHex) : undefined,
                  }}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onBarDegreeChange?.(bv.bar, (bv.degree + 1) % 7)}
                    className="flex-1 min-w-0 text-left transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
                    style={{ padding: '4px 6px', background: 'transparent', border: 'none' }}
                    title="Click to cycle chord degree"
                  >
                    <div className="text-[6px] font-mono font-bold opacity-50 leading-none">BAR {bv.bar + 1}</div>
                    <div
                      className="text-[13px] font-black leading-tight truncate font-mono"
                      style={{
                        color: selectedBar === bv.bar ? accentHex : '#ececf4',
                        textShadow: selectedBar === bv.bar ? `0 0 12px ${accentHex}88` : undefined,
                      }}
                    >
                      {bv.roman}
                    </div>
                    <div
                      className="text-[8px] font-mono font-bold truncate leading-tight mt-0.5"
                      style={{ color: selectedBar === bv.bar ? `${accentHex}cc` : '#b8b8c8' }}
                    >
                      {bv.chordSymbol}
                    </div>
                  </button>
                  <select
                    disabled={disabled || !onBarChopQuantChange}
                    value={bv.chopQuant}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      onBarChopQuantChange?.(bv.bar, e.target.value as GenoBarChopQuant)
                    }
                    className="shrink-0 self-stretch text-[7px] font-bold outline-none cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                    style={{
                      width: 30,
                      padding: '0 1px',
                      border: 'none',
                      borderLeft: '1px solid #353545',
                      background: '#0a0a12',
                      color: bv.chopQuant === 'whole' ? '#6a6a78' : accentHex,
                      textAlign: 'center',
                    }}
                    title="Chop this bar — whole bar vs repeated hits (½ · ¼ · ⅛ · 16 · 32)"
                    aria-label={`Bar ${bv.bar + 1} chord chop`}
                  >
                    {GENO_BAR_CHOP_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id} title={opt.title}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {showChords && chordLane && draft ? (
              <LoopLanePianoRollCard
                label="Chords"
                color={accentHex}
                notes={draft.chordNotes}
                bars={bars}
                beatsPerBar={beatsPerBar}
                previewBeat={previewBeat}
                disabled={disabled}
                laneActions={chordLane}
                minMidi={GENO_PLUGIN_LANE_RANGES.chords.min}
                maxMidi={GENO_PLUGIN_LANE_RANGES.chords.max}
                onNotesChange={onChordNotesChange}
                pianoRollRef={chordPianoRollRef}
                rollEdit={chordRollEdit}
                onRollEditChange={setChordRollEdit}
                tailInsert={tailInsert}
                toolbarExtras={
                  chordGlideControls ? (
                    <ChordLaneGlideChips
                      color={accentHex}
                      disabled={disabled}
                      laneEnabled={chordLane.enabled}
                      controls={chordGlideControls}
                    />
                  ) : undefined
                }
                laneVolume={laneVolumes?.chords}
              />
            ) : null}
            {showMelody && melodyLane && draft ? (
              <LoopLanePianoRollCard
                label={melodyLaneLabel}
                color="#a78bfa"
                notes={draft.melodyNotes}
                bars={bars}
                beatsPerBar={beatsPerBar}
                previewBeat={previewBeat}
                disabled={disabled}
                laneActions={melodyLane}
                minMidi={GENO_PLUGIN_LANE_RANGES.melody.min}
                maxMidi={GENO_PLUGIN_LANE_RANGES.melody.max}
                onNotesChange={onMelodyNotesChange}
                pianoRollRef={melodyPianoRollRef}
                rollEdit={melodyRollEdit}
                onRollEditChange={setMelodyRollEdit}
                toolbarExtras={
                  arpControls ? (
                    <ArpLaneToolbarChips
                      color="#a78bfa"
                      disabled={disabled}
                      laneEnabled={melodyLane.enabled}
                      controls={arpControls}
                    />
                  ) : undefined
                }
                laneVolume={laneVolumes?.melody}
              />
            ) : null}
            {showBass && bassLane && draft ? (
              <LoopLanePianoRollCard
                label="Bass"
                color="#fbbf24"
                notes={draft.bassNotes}
                bars={bars}
                beatsPerBar={beatsPerBar}
                previewBeat={previewBeat}
                disabled={disabled}
                laneActions={bassLane}
                minMidi={GENO_PLUGIN_LANE_RANGES.bass.min}
                maxMidi={GENO_PLUGIN_LANE_RANGES.bass.max}
                onNotesChange={onBassNotesChange}
                pianoRollRef={bassPianoRollRef}
                rollEdit={bassRollEdit}
                onRollEditChange={setBassRollEdit}
                toolbarExtras={
                  bassGlideControls ? (
                    <BassLaneGlideChips
                      color="#fbbf24"
                      disabled={disabled}
                      laneEnabled={bassLane.enabled}
                      controls={bassGlideControls}
                    />
                  ) : undefined
                }
                laneVolume={laneVolumes?.bass}
              />
            ) : null}
            {showFiller && fillerLane && draft ? (
              <LoopLanePianoRollCard
                label="Note Filler"
                color="#38bdf8"
                notes={draft.fillerNotes ?? []}
                bars={bars}
                beatsPerBar={beatsPerBar}
                previewBeat={previewBeat}
                disabled={disabled}
                laneActions={fillerLane}
                minMidi={GENO_PLUGIN_LANE_RANGES.filler.min}
                maxMidi={GENO_PLUGIN_LANE_RANGES.filler.max}
                onNotesChange={onFillerNotesChange}
                pianoRollRef={fillerPianoRollRef}
                rollEdit={fillerRollEdit}
                onRollEditChange={setFillerRollEdit}
                snapBeatsOverride={fillerControls?.snapBeats}
                gridEditTool={fillerControls?.editTool}
                toolbarExtras={
                  fillerControls ? (
                    <FillerLaneToolbarChips
                      color="#38bdf8"
                      disabled={disabled}
                      laneEnabled={fillerLane.enabled}
                      controls={fillerControls}
                    />
                  ) : undefined
                }
                laneVolume={laneVolumes?.filler}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
