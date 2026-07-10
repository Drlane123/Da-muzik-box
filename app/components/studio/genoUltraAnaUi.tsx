'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import {
  GENO_ARP_CTRL_DEST_OPTIONS,
  type GenoArpCtrlDest,
} from '@/app/lib/studio/genoUltraArpCtrlLanes';
import {
  buildGenoArpGridPattern,
  emptyGenoArpLaneLevels,
  genoArpActiveRowsAtStep,
  genoArpGridCols,
  genoArpDisplayRowForBarOct,
  genoArpStoredRowForBarOct,
  genoArpGridColToBarIndex,
  genoArpGridPixelSize,
  genoArpLaneRowForLevel,
  genoArpLevelFromRow,
  genoArpRowToPitch,
  genoArpSanitizeBarLength,
  emptyGenoArpBarOctShifts,
  GENO_ARP_BAR_LENGTHS,
  GENO_ARP_CELL_COL_W_PX,
  GENO_ARP_CELL_ROW_H_PX,
  GENO_ARP_STEPS_PER_BAR,
  GENO_ARP_ORDERS,
  GENO_ARP_OCT_RANGES,
  GENO_ARP_RATE_LABELS,
  GENO_ARP_ROWS,
  GENO_ARP_MAX_COLS,
  GENO_ARP_VARIATIONS,
  genoArpSwingDelayMs,
  resizeGenoArpGridByBars,
  resizeGenoArpLaneLevelsByBars,
  padGenoArpGridRows,
  emptyGenoArpStepMask,
  emptyGenoArpStepHits,
  blankGenoArpStepSequencer,
  genoArpStepMaskIsBlank,
  genoArpStepHitsIsBlank,
  genoArpCycleStepHits,
  genoArpSanitizeStepHits,
  genoArpSanitizePhraseSteps,
  GENO_ARP_PHRASE_STEP_PRESETS,
  duplicateGenoArpSelectionToNextBar,
  genoArpGridCellKey,
  type GenoArpGridCellKey,
  type GenoArpBarLength,
  type GenoArpBarOctShift,
  type GenoArpGlobalOctShift,
  type GenoArpOctRange,
  type GenoArpVariation,
  type GenoArpStepHits,
} from '@/app/lib/studio/genoUltraArpPattern';
import {
  buildGenoArpMelodyFromChordTimeline,
  buildGenoArpMelodyVelLevels,
  regenerateGenoArpGridFromSteps,
  genoArpRegenTargetCols,
  genoArpCollectActiveRows,
} from '@/app/lib/studio/genoUltraArpChordMelody';
import {
  useGenoUltraArpGateFx,
  useGenoUltraArpGateFxPreviewGetters,
} from '@/app/components/studio/genoUltraArpGateFxContext';
import { genoUltraArpPitchSpreadFromSnapshot, genoUltraArpTotalPatternBeats } from '@/app/lib/studio/genoUltraArpChordPitch';
import {
  genoArpCanPaintStoredRowInKey,
  genoArpStoredRowIsInKey,
  type GenoArpDrawInKeyOpts,
} from '@/app/lib/studio/genoUltraArpDrawInKey';
import {
  GENO_ARP_CHORD_TYPE_OPTIONS,
  genoArpRevoiceSegment,
  genoArpScaleIdFromKeyMode,
  type GenoArpChordType,
} from '@/app/lib/studio/genoUltraArpHarmony';
import {
  startGenoUltraArpPreviewLoop,
  stopGenoUltraArpPreviewLoop,
  stopGenoUltraArpPreviewVoices,
} from '@/app/lib/studio/se2GenoUltraSynthPreview';
import {
  buildGenoUltraArpMelodyApplyPatch,
  genoUltraArpMelodyPresetById,
} from '@/app/lib/studio/genoUltraArpMelodyPresets';
import {
  applyGenoArpStylePreset,
  GENO_ARP_STYLE_CATEGORIES,
  GENO_ARP_STYLE_PRESETS,
  genoArpStyleSoundPresetId,
} from '@/app/lib/studio/genoUltraArpStylePresets';
import { setGenoUltraArpPreviewRunning, isGenoUltraArpPreviewRunning } from '@/app/lib/creationStation/creationTransportSync';
import {
  genoUltraArpAllCardOptions,
  importGenoUltraArpFromCard,
  importGenoUltraArpFromGenoBuild,
  isGenoUltraArpChordImportError,
  isGenoUltraArpMidiFileName,
  parseGenoUltraArpMidiFile,
  type GenoUltraGenoBuildChordSource,
  type GenoBuildTrackRef,
} from '@/app/lib/studio/genoUltraArpChordImport';
import {
  buildGenoUltraArpSnapshot,
  downloadGenoUltraArpMidi,
  downloadGenoUltraArpWav,
  genoUltraArpSnapshotToSe2RollNotes,
  type GenoUltraArpSe2RollNote,
  type GenoUltraArpSongKey,
} from '@/app/lib/studio/genoUltraArpExport';
import {
  getGenoUltraArpBpmForTrack,
  genoUltraArpBpmOrDefault,
  setGenoUltraArpBpmForTrack,
} from '@/app/lib/studio/genoUltraArpBpmStore';
import { genoUltraArpBpmForStylePreset } from '@/app/lib/studio/genoUltraArpGenreBpm';
import {
  clampGenoUltraArpBpm,
  GENO_ULTRA_ARP_DEFAULT_BPM,
  type GenoUltraArpChordSegment,
} from '@/app/lib/studio/genoUltraArpState';
import {
  NEURAL_HUM_KEY_NAMES,
  NEURAL_HUM_SCALES,
  type NeuralHumScaleId,
} from '@/app/lib/vocalLab/neuralHumKeyLock';
import {
  studioKeyLabel,
  type StudioDetectedKeyMode,
} from '@/app/lib/studio/studioAudioClipAnalysis';
import { studioMidiRootFromSongKey } from '@/app/lib/studio/studioMidiKeyConvert';
import {
  genoUltraKeySourceTrackLabel,
  type GenoUltraArpKeySourceTrack,
} from '@/app/lib/studio/genoUltraArpKeySource';
import {
  getGenoUltraArpSavedPattern,
  getGenoUltraArpSavedSound,
  listGenoUltraArpSavedPatternsOnly,
  listGenoUltraArpSavedSoundAndPatterns,
  listGenoUltraArpSavedSounds,
  saveGenoUltraArpPattern,
  saveGenoUltraArpSound,
  type GenoUltraArpSavedPattern,
} from '@/app/lib/studio/genoUltraArpUserSaves';
import type { GenoUltraArpMelodyTag } from '@/app/lib/studio/genoUltraArpMelodyPresets';
import type { GenoUltraSynthVoiceParams, GenoUltraFxParams } from '@/app/lib/studio/genoUltraSynthTypes';
import {
  GENO_ULTRA_EQ_BANDS,
  type GenoUltraEqBandId,
} from '@/app/lib/studio/genoUltraEqGraph';
import {
  AnaModernEqDisplay,
} from '@/app/components/studio/genoUltraFxVisuals';
import {
  GENO_LOOP_PIANO_GRID,
  GENO_LOOP_PIANO_ROW_H_PX,
  GENO_LOOP_PIANO_RULER_H_PX,
} from '@/app/lib/studio/se2SynthGenoLoopPianoRoll';

/** ANA 2 Ultra — dark Sektor skin (slate + neon green + blue). */
export const ANA = {
  bg: '#0e1014',
  bgDeep: '#060708',
  bgPanel: '#141820',
  bgInset: '#0a0c10',
  border: '#222830',
  borderHi: '#323844',
  green: '#39ff14',
  greenHi: '#6dff4a',
  greenDim: '#1a8020',
  cyan: '#39ff14',
  cyanHi: '#6dff4a',
  cyanDim: '#1a8020',
  knobRingLo: '#245878',
  knobRingHi: '#58a8e8',
  knobBody: '#101418',
  orange: '#f0a030',
  text: '#9aa0ac',
  textDim: '#4e5560',
  textHi: '#dce0e8',
  meter: '#39ff14',
  faderCap: '#181c24',
  faderCapHi: '#2a3038',
  screenBg: '#050608',
  screenBgHi: '#0a0e14',
  screenGrid: '#161c26',
  screenGlow: '#39ff14',
} as const;

export function clampAnaNum(v: number, min?: number, max?: number, fallback = 0): number {
  if (!Number.isFinite(v)) return fallback;
  let n = v;
  if (min != null) n = Math.max(min, n);
  if (max != null) n = Math.min(max, n);
  return n;
}

export const ANA_KNOB = 40;
export const ANA_FADER_H = 80;

export function AnaPanel({
  title,
  sub,
  children,
  style,
  flex,
}: {
  title?: string;
  sub?: string;
  children: ReactNode;
  style?: CSSProperties;
  flex?: string;
}) {
  return (
    <div
      style={{
        flex,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        border: `1px solid ${ANA.border}`,
        background: `linear-gradient(180deg, ${ANA.bgPanel} 0%, ${ANA.bgInset} 100%)`,
        boxShadow: `inset 0 1px 0 ${ANA.borderHi}33`,
        ...style,
      }}
    >
      {title ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            padding: '3px 8px',
            borderBottom: `1px solid ${ANA.border}`,
            background: ANA.bgDeep,
          }}
        >
          <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.14em', color: ANA.greenHi }}>{title}</span>
          {sub ? <span style={{ fontSize: 7, fontWeight: 700, color: ANA.textDim, letterSpacing: '0.08em' }}>{sub}</span> : null}
        </div>
      ) : null}
      <div style={{ padding: 6, flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

export function AnaBtn({
  children,
  active,
  disabled,
  onClick,
  small,
  variant = 'blue',
  title,
  saveHighlight,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  small?: boolean;
  /** blue = Sektor tabs/toggles; green = solid highlight (arp transport) */
  variant?: 'blue' | 'green';
  /** Native hover tooltip — what this control does */
  title?: string;
  /** Light red outline for Save Sound / Save Pattern */
  saveHighlight?: boolean;
}) {
  const accent = variant === 'green' ? ANA.green : ANA.knobRingHi;
  const saveRing = 'rgba(255,118,118,0.72)';
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{
        padding: small ? '2px 7px' : '4px 12px',
        fontSize: small ? 7 : 8,
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        borderRadius: 3,
        border: saveHighlight
          ? `1px solid ${saveRing}`
          : `1px solid ${active ? accent : ANA.borderHi}`,
        background: active
          ? variant === 'green'
            ? ANA.green
            : `linear-gradient(180deg, ${ANA.knobRingLo}88, ${ANA.bgInset})`
          : ANA.bgInset,
        color: active ? (variant === 'green' ? ANA.bgDeep : accent) : ANA.textDim,
        boxShadow: saveHighlight
          ? `0 0 0 1px rgba(255,90,90,0.22)${active ? `, 0 0 10px ${accent}66` : ''}`
          : active
            ? `0 0 10px ${accent}66, inset 0 1px 0 rgba(255,255,255,0.08)`
            : 'inset 0 1px 0 rgba(255,255,255,0.03)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function AnaTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { id: string; label: string; title?: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${ANA.border}`, background: ANA.bgDeep }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          title={t.title ?? t.label}
          onClick={(e) => {
            e.stopPropagation();
            onChange(t.id);
          }}
          style={{
            flex: 1,
            padding: '5px 4px',
            fontSize: 7,
            fontWeight: 900,
            letterSpacing: '0.1em',
            border: 'none',
            borderBottom: active === t.id ? `2px solid ${ANA.knobRingHi}` : '2px solid transparent',
            background: active === t.id ? `linear-gradient(180deg, ${ANA.knobRingLo}66, ${ANA.bgInset})` : 'transparent',
            color: active === t.id ? ANA.knobRingHi : ANA.textDim,
            cursor: 'pointer',
            textShadow: active === t.id ? `0 0 8px ${ANA.knobRingHi}66` : 'none',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

const lcdScanline: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)',
  pointerEvents: 'none',
};

/** Green LED / LCD readout bar (preset name, voice count, etc.). */
export function AnaLcdBar({
  children,
  width,
  size = 'md',
  title,
}: {
  children: ReactNode;
  width?: number | string;
  size?: 'sm' | 'md' | 'lg';
  title?: string;
}) {
  const fs = size === 'lg' ? 12 : size === 'sm' ? 8 : 10;
  return (
    <div
      title={title}
      style={{
        position: 'relative',
        width: width ?? 'auto',
        minWidth: size === 'lg' ? 240 : 76,
        padding: size === 'sm' ? '3px 8px' : '5px 12px',
        background: `linear-gradient(180deg, ${ANA.bgDeep} 0%, ${ANA.bgInset} 100%)`,
        border: `1px solid ${ANA.greenDim}`,
        boxShadow: `inset 0 2px 10px rgba(0,0,0,0.92), inset 0 0 16px ${ANA.green}10, 0 0 1px ${ANA.greenDim}`,
        fontFamily: 'Consolas, "Lucida Console", monospace',
        fontSize: fs,
        fontWeight: 700,
        color: ANA.cyanHi,
        textShadow: `0 0 10px ${ANA.cyan}, 0 0 2px ${ANA.cyan}`,
        letterSpacing: '0.1em',
        textAlign: 'center',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
      }}
    >
      <div style={lcdScanline} />
      <span style={{ position: 'relative' }}>{children}</span>
    </div>
  );
}

/** Green LCD bar — click to type BPM/value; drag vertically to scrub. */
export function AnaLcdValueBar({
  value,
  suffix = '',
  width,
  size = 'md',
  title,
  onChange,
  disabled,
  min = 40,
  max = 300,
  step = 1,
  decimals = 0,
}: {
  value: number;
  suffix?: string;
  width?: number | string;
  size?: 'sm' | 'md' | 'lg';
  title?: string;
  onChange?: (v: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
}) {
  const safeVal = clampAnaNum(value, min, max, min ?? 0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const dragRef = useRef<{ y: number; val: number; moved: boolean } | null>(null);
  const fs = size === 'lg' ? 12 : size === 'sm' ? 8 : 10;

  const display =
    decimals <= 0 && Number.isInteger(safeVal)
      ? String(Math.round(safeVal))
      : safeVal.toFixed(decimals);

  const commit = useCallback(
    (raw: string | number) => {
      if (!onChange) return;
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
      onChange(clampAnaNum(n, min, max, safeVal));
    },
    [max, min, onChange, safeVal],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (disabled || !onChange || editing) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { y: e.clientY, val: safeVal, moved: false };
    },
    [disabled, editing, onChange, safeVal],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || !onChange || disabled) return;
      const dy = dragRef.current.y - e.clientY;
      if (Math.abs(dy) > 3) dragRef.current.moved = true;
      const range = max != null && min != null ? max - min : 100;
      const delta = dy * (range / 120);
      const next = clampAnaNum(dragRef.current.val + delta, min, max, safeVal);
      const snapped = step > 0 ? Math.round(next / step) * step : next;
      onChange(snapped);
    },
    [disabled, max, min, onChange, safeVal, step],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      if (drag && !drag.moved && !editing && onChange && !disabled) {
        setDraft(display);
        setEditing(true);
      }
      dragRef.current = null;
    },
    [disabled, display, editing, onChange],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commit(draft);
        setEditing(false);
      } else if (e.key === 'Escape') {
        setEditing(false);
      }
    },
    [commit, draft],
  );

  const interactive = !!onChange && !disabled;

  return (
    <div
      title={
        title ??
        (interactive ? 'Click to type · drag up/down to change' : undefined)
      }
      style={{
        position: 'relative',
        width: width ?? 'auto',
        minWidth: size === 'lg' ? 240 : 76,
        padding: size === 'sm' ? '3px 8px' : '5px 12px',
        background: `linear-gradient(180deg, ${ANA.bgDeep} 0%, ${ANA.bgInset} 100%)`,
        border: `1px solid ${ANA.greenDim}`,
        boxShadow: `inset 0 2px 10px rgba(0,0,0,0.92), inset 0 0 16px ${ANA.green}10, 0 0 1px ${ANA.greenDim}`,
        fontFamily: 'Consolas, "Lucida Console", monospace',
        fontSize: fs,
        fontWeight: 700,
        color: ANA.cyanHi,
        textShadow: `0 0 10px ${ANA.cyan}, 0 0 2px ${ANA.cyan}`,
        letterSpacing: '0.1em',
        textAlign: 'center',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        cursor: interactive ? (editing ? 'text' : 'pointer') : 'default',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div style={lcdScanline} />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            commit(draft);
            setEditing(false);
          }}
          onKeyDown={onKeyDown}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            width: '100%',
            fontSize: fs,
            fontWeight: 700,
            fontFamily: 'Consolas, "Lucida Console", monospace',
            color: ANA.cyanHi,
            background: '#020404',
            border: `1px solid ${ANA.cyan}`,
            textAlign: 'center',
            outline: 'none',
            letterSpacing: '0.1em',
          }}
        />
      ) : (
        <span style={{ position: 'relative' }}>
          {display}
          {suffix}
        </span>
      )}
    </div>
  );
}

/** Small numeric LCD field — drag vertically to adjust; double-click to type. */
export function AnaLcdField({
  label,
  value,
  unit,
  onChange,
  disabled,
  min,
  max,
  step = 1,
  decimals = 0,
}: {
  label: string;
  value: number;
  unit?: string;
  onChange?: (v: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
}) {
  const safeVal = clampAnaNum(value, min, max, min ?? 0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const dragRef = useRef<{ y: number; val: number } | null>(null);

  const display =
    decimals <= 0 && Number.isInteger(safeVal)
      ? String(Math.round(safeVal))
      : safeVal.toFixed(decimals);

  const commit = useCallback(
    (raw: string | number) => {
      if (!onChange) return;
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
      onChange(clampAnaNum(n, min, max, safeVal));
    },
    [max, min, onChange, safeVal],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (disabled || !onChange || editing) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { y: e.clientY, val: safeVal };
    },
    [disabled, editing, onChange, safeVal],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || !onChange || disabled) return;
      const dy = dragRef.current.y - e.clientY;
      const range = max != null && min != null ? max - min : 100;
      const delta = dy * (range / 120);
      const next = clampAnaNum(dragRef.current.val + delta, min, max, safeVal);
      const snapped = step > 0 ? Math.round(next / step) * step : next;
      onChange(snapped);
    },
    [disabled, max, min, onChange, safeVal, step],
  );

  const onPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    dragRef.current = null;
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commit(draft);
        setEditing(false);
      } else if (e.key === 'Escape') {
        setEditing(false);
      }
    },
    [commit, draft],
  );

  const boxStyle: CSSProperties = {
    position: 'relative',
    padding: '4px 5px 3px',
    background: `linear-gradient(180deg, ${ANA.bgDeep} 0%, ${ANA.bgInset} 100%)`,
    border: `1px solid ${ANA.borderHi}`,
    boxShadow: `inset 0 2px 8px rgba(0,0,0,0.94), inset 0 0 10px ${ANA.green}08`,
    minWidth: 38,
    textAlign: 'center',
    cursor: disabled || !onChange ? 'default' : editing ? 'text' : 'ns-resize',
    opacity: disabled ? 0.45 : 1,
    userSelect: 'none',
    touchAction: 'none',
  };

  return (
    <div
      style={boxStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => {
        if (disabled || !onChange) return;
        setDraft(display);
        setEditing(true);
      }}
      title={onChange ? `${label} — drag, double-click to type` : label}
    >
      <div style={lcdScanline} />
      <div style={{ fontSize: 6, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.14em', marginBottom: 2 }}>
        {label}
      </div>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            commit(draft);
            setEditing(false);
          }}
          onKeyDown={onKeyDown}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            fontSize: 9,
            fontWeight: 800,
            fontFamily: 'Consolas, monospace',
            color: ANA.cyanHi,
            background: '#020404',
            border: `1px solid ${ANA.cyan}`,
            textAlign: 'center',
            outline: 'none',
          }}
        />
      ) : (
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            fontFamily: 'Consolas, monospace',
            color: ANA.cyanHi,
            textShadow: `0 0 8px ${ANA.cyan}`,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}
        >
          {display}
          {unit ? <span style={{ fontSize: 7, color: ANA.cyanDim, marginLeft: 1 }}>{unit}</span> : null}
        </div>
      )}
    </div>
  );
}

export function AnaLcdRow({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>{children}</div>;
}

/** Dual vertical peak meters (L / R). */
export function AnaStereoMeter({ level = 0.35 }: { level?: number }) {
  const seg = 16;
  const lit = Math.round(level * seg);
  const col = (ch: 'L' | 'R') => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 6, fontWeight: 800, color: ANA.textDim }}>{ch}</span>
      <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 1, height: 52 }}>
        {Array.from({ length: seg }, (_, i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 3,
              borderRadius: 1,
              background:
                i < lit
                  ? i > seg - 4
                    ? ANA.orange
                    : ANA.green
                  : ANA.bgInset,
              boxShadow: i < lit ? `0 0 4px ${ANA.green}88` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
  return (
    <div style={{ display: 'flex', gap: 6, padding: '0 4px' }}>
      {col('L')}
      {col('R')}
    </div>
  );
}

/** Recessed OLED/LCD screen bezel — navy interior, cyan grid, vignette. */
export function AnaDigitalScreen({
  children,
  height,
  minHeight,
  gridCols = 16,
  gridRows = 6,
  showGrid = true,
}: {
  children: ReactNode;
  height?: number | string;
  minHeight?: number;
  gridCols?: number;
  gridRows?: number;
  showGrid?: boolean;
}) {
  return (
    <div
      style={{
        position: 'relative',
        height: height ?? 'auto',
        minHeight: minHeight ?? 72,
        border: `1px solid ${ANA.borderHi}`,
        borderRadius: 3,
        background: `radial-gradient(ellipse 88% 78% at 50% 38%, ${ANA.screenBgHi} 0%, ${ANA.screenBg} 52%, #020304 100%)`,
        boxShadow: `inset 0 2px 18px rgba(0,0,0,0.96), inset 0 0 20px ${ANA.green}06, 0 0 1px ${ANA.border}`,
        overflow: 'hidden',
      }}
    >
      {showGrid ? (
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.55 }}
          preserveAspectRatio="none"
        >
          {Array.from({ length: gridRows + 1 }, (_, i) => (
            <line
              key={`h${i}`}
              x1="0"
              y1={`${(i / gridRows) * 100}%`}
              x2="100%"
              y2={`${(i / gridRows) * 100}%`}
              stroke={ANA.screenGrid}
              strokeWidth="0.6"
            />
          ))}
          {Array.from({ length: gridCols + 1 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={`${(i / gridCols) * 100}%`}
              y1="0"
              x2={`${(i / gridCols) * 100}%`}
              y2="100%"
              stroke={ANA.screenGrid}
              strokeWidth="0.6"
            />
          ))}
        </svg>
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 95% 90% at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />
      <div style={lcdScanline} />
      <div style={{ position: 'relative', height: '100%', minHeight: minHeight ?? 72 }}>{children}</div>
    </div>
  );
}

/** Wave display with grid + scanlines (ANA oscilloscope window). */
export function AnaScopeFrame({
  children,
  height = 72,
}: {
  children: ReactNode;
  height?: number;
}) {
  return (
    <AnaDigitalScreen height={height} minHeight={height} gridCols={12} gridRows={8} showGrid>
      {children}
    </AnaDigitalScreen>
  );
}

/** G-ENV style multi-segment envelope graphic. */
export function AnaGraphicEnv({
  attack,
  decay,
  sustain,
  release,
  height = 88,
}: {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  height?: number;
}) {
  const path = envelopePath(attack, decay, sustain, release);
  const gPath = `${path} L200,80 L0,80 Z`;
  return (
    <AnaScopeFrame height={height}>
      <svg viewBox="0 0 200 80" width="100%" height="100%" preserveAspectRatio="none">
        <path d={gPath} fill={`${ANA.green}44`} stroke="none" />
        <path d={path} stroke={ANA.greenHi} strokeWidth="2" fill="none" style={{ filter: `drop-shadow(0 0 6px ${ANA.green})` }} />
        {[20, 60, 100, 140, 180].map((x) => (
          <circle key={x} cx={x} cy={40 - sustain * 20} r="3" fill={ANA.greenHi} style={{ filter: `drop-shadow(0 0 4px ${ANA.green})` }} />
        ))}
      </svg>
    </AnaScopeFrame>
  );
}

/** Single ADSR column with curve + velocity mini knobs (ANA envelope row). */
export function AnaEnvColumn({
  title,
  attack,
  decay,
  sustain,
  release,
  disabled,
  onChange,
}: {
  title: string;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  disabled?: boolean;
  onChange: (p: { attack?: number; decay?: number; sustain?: number; release?: number }) => void;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 7, fontWeight: 900, color: ANA.greenHi, letterSpacing: '0.1em' }}>{title}</span>
      <AnaAdsrBlock
        title=""
        attack={attack}
        decay={decay}
        sustain={sustain}
        release={release}
        disabled={disabled}
        onChange={onChange}
      />
      <AnaKnobRow>
        <AnaKnob label="CURVE" value={0.5} min={0} max={1} disabled={disabled} onChange={() => {}} />
        <AnaKnob label="VELO" value={0.72} min={0} max={1} disabled={disabled} onChange={() => {}} />
      </AnaKnobRow>
    </div>
  );
}

export function AnaEqGridVisual({
  fx,
  disabled,
  onBandAdjust,
  onToggleEnabled,
}: {
  fx: GenoUltraFxParams;
  disabled?: boolean;
  onBandAdjust: (band: GenoUltraEqBandId, patch: { db?: number; hz?: number }) => void;
  onToggleEnabled?: () => void;
}) {
  return (
    <AnaModernEqDisplay
      fx={fx}
      disabled={disabled}
      onBandAdjust={onBandAdjust}
      onToggleEnabled={onToggleEnabled}
    />
  );
}

export function AnaEqPanel({
  fx,
  disabled,
  onPatchFx,
}: {
  fx: GenoUltraFxParams;
  disabled?: boolean;
  onPatchFx: (partial: Partial<GenoUltraFxParams>) => void;
}) {
  const setBand = useCallback(
    (band: GenoUltraEqBandId, patch: { db?: number; hz?: number }) => {
      const meta = GENO_ULTRA_EQ_BANDS.find((b) => b.id === band);
      if (!meta) return;
      const next: Partial<GenoUltraFxParams> = {};
      if (patch.db !== undefined) next[meta.gainKey] = patch.db;
      if (patch.hz !== undefined) next[meta.hzKey] = patch.hz;
      onPatchFx(next);
    },
    [onPatchFx],
  );

  return (
    <AnaEqGridVisual
      fx={fx}
      disabled={disabled}
      onBandAdjust={setBand}
      onToggleEnabled={() => onPatchFx({ eqEnabled: !fx.eqEnabled })}
    />
  );
}

export function AnaEqStrip({
  fx,
  disabled,
  onPatchFx,
}: {
  fx: GenoUltraFxParams;
  disabled?: boolean;
  onPatchFx: (partial: Partial<GenoUltraFxParams>) => void;
}) {
  return <AnaEqPanel fx={fx} disabled={disabled} onPatchFx={onPatchFx} />;
}

export function AnaChordMemoryPanel({ disabled }: { disabled?: boolean }) {
  return (
    <AnaPanel title="CMD" sub="CHORD MEMORY" style={{ minWidth: 140, flex: '0 0 148px' }}>
      <AnaLcdBar size="sm">OFF</AnaLcdBar>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
        {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((n) => (
          <AnaBtn key={n} small disabled={disabled}>
            {n}
          </AnaBtn>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <AnaBtn small disabled={disabled}>
          Learn
        </AnaBtn>
        <AnaBtn small disabled={disabled}>
          Reset
        </AnaBtn>
      </div>
    </AnaPanel>
  );
}

export function AnaPerformanceStrip({
  mono,
  legato,
  slide,
  slideAnchor,
  bend,
  poly,
  portamento,
  disabled,
  onMono,
  onLegato,
  onSlide,
  onSlideAnchor,
  onBend,
  onPoly,
  onPortamento,
}: {
  mono: boolean;
  legato: boolean;
  slide: boolean;
  slideAnchor: 'mid' | 'end';
  bend: number;
  poly: number;
  portamento: number;
  disabled?: boolean;
  onMono: () => void;
  onLegato: () => void;
  onSlide: () => void;
  onSlideAnchor: (anchor: 'mid' | 'end') => void;
  onBend: (v: number) => void;
  onPoly: (v: number) => void;
  onPortamento: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, minWidth: 120 }}>
      <AnaLcdRow>
        <AnaLcdField label="BEND" value={bend} unit="st" onChange={onBend} disabled={disabled} min={0} max={24} />
        <AnaLcdField label="POLY" value={poly} onChange={onPoly} disabled={disabled} min={1} max={16} />
        <AnaLcdField label="PORTA" value={portamento} unit="ms" onChange={onPortamento} disabled={disabled} min={0} max={500} />
      </AnaLcdRow>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <AnaBtn small active={mono} disabled={disabled} onClick={onMono} title="Mono — one note at a time">
          Mono
        </AnaBtn>
        <AnaBtn
          small
          active={legato}
          disabled={disabled}
          onClick={onLegato}
          title="Legato — notes flow together without re-attacking the envelope"
        >
          Legato
        </AnaBtn>
        <AnaBtn
          small
          active={slide}
          disabled={disabled}
          onClick={onSlide}
          title="Slide — pitch glide at bar mid or bar end (pick one)"
        >
          Slide
        </AnaBtn>
      </div>
      {slide ? (
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          <span style={{ fontSize: 6, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.08em' }}>GLIDE</span>
          <AnaBtn
            small
            active={slideAnchor === 'mid'}
            disabled={disabled}
            onClick={() => onSlideAnchor('mid')}
            title="Glide at the middle of each bar (step 8)"
          >
            MID
          </AnaBtn>
          <AnaBtn
            small
            active={slideAnchor === 'end'}
            disabled={disabled}
            onClick={() => onSlideAnchor('end')}
            title="Glide at the end of each bar (step 16)"
          >
            END
          </AnaBtn>
        </div>
      ) : null}
    </div>
  );
}

export function AnaRotaryKnob({
  label,
  value,
  min,
  max,
  decimals = 2,
  unit = '',
  disabled = false,
  onChange,
  defaultValue,
  size = ANA_KNOB,
  title,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  decimals?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (v: number) => void;
  defaultValue?: number;
  size?: number;
  title?: string;
}) {
  const ringGradId = useId().replace(/:/g, '');
  const bodyGradId = useId().replace(/:/g, '');
  const startRef = useRef<{ val: number; y: number; x: number } | null>(null);
  const def = defaultValue ?? (min + max) / 2;
  const safeValue = Number.isFinite(value) ? value : def;
  const t = Math.max(0, Math.min(1, (safeValue - min) / (max - min || 1)));
  const sweepDeg = 270;
  const startDeg = -135;
  const markerDeg = startDeg + t * sweepDeg;
  const markerRad = (markerDeg * Math.PI) / 180;
  const cx = size / 2;
  const cy = size / 2;
  const rTrack = size * 0.42;
  const rMarker = size * 0.36;
  const arcLen = (sweepDeg / 360) * 2 * Math.PI * rTrack * t;

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      startRef.current = { val: safeValue, y: e.clientY, x: e.clientX };
    },
    [disabled, safeValue],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!startRef.current || disabled) return;
      const dy = startRef.current.y - e.clientY;
      const dx = (startRef.current.x - e.clientX) * 0.12;
      const range = max - min || 1;
      const next = Math.max(min, Math.min(max, startRef.current.val + (dy + dx) * (range / 140)));
      onChange(Number(next.toPrecision(10)));
      startRef.current = { ...startRef.current, y: e.clientY, x: e.clientX, val: next };
    },
    [disabled, max, min, onChange],
  );

  const onPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    startRef.current = null;
  }, []);

  const onDoubleClick = useCallback(() => {
    if (!disabled) onChange(def);
  }, [def, disabled, onChange]);

  const display =
    decimals <= 0 ? String(Math.round(safeValue)) : Number(safeValue.toFixed(decimals)).toString();

  return (
    <div
      role="presentation"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        minWidth: size + 8,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'default' : 'ns-resize',
        userSelect: 'none',
        touchAction: 'none',
      }}
      title={title ?? `${label} — drag up/down, double-click reset`}
    >
      <svg
        width={size + 8}
        height={size + 8}
        viewBox={`0 0 ${size + 8} ${size + 8}`}
        style={{
          overflow: 'visible',
          filter: `drop-shadow(0 0 ${4 + t * 6}px ${ANA.knobRingHi}66) drop-shadow(0 2px 4px rgba(0,0,0,0.65))`,
        }}
      >
        <defs>
          <linearGradient id={ringGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={ANA.knobRingLo} />
            <stop offset="55%" stopColor={ANA.knobRingHi} />
            <stop offset="100%" stopColor={ANA.knobRingHi} />
          </linearGradient>
          <radialGradient id={bodyGradId} cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#282830" />
            <stop offset="45%" stopColor={ANA.knobBody} />
            <stop offset="100%" stopColor={ANA.bgDeep} />
          </radialGradient>
        </defs>
        {/* Recessed well */}
        <circle cx={cx + 4} cy={cy + 4} r={size * 0.46} fill={ANA.bgDeep} stroke={ANA.border} strokeWidth={1} />
        {/* Value ring track */}
        <circle
          cx={cx + 4}
          cy={cy + 4}
          r={rTrack}
          fill="none"
          stroke="#121218"
          strokeWidth={3.5}
          opacity={0.95}
        />
        {/* Glowing value arc */}
        <circle
          cx={cx + 4}
          cy={cy + 4}
          r={rTrack}
          fill="none"
          stroke={`url(#${ringGradId})`}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${9999}`}
          transform={`rotate(${startDeg} ${cx + 4} ${cy + 4})`}
          style={{ filter: `drop-shadow(0 0 3px ${ANA.cyan}aa)` }}
        />
        {/* Knob body */}
        <circle
          cx={cx + 4}
          cy={cy + 4}
          r={size * 0.3}
          fill={`url(#${bodyGradId})`}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
        {/* Cyan position marker on rim */}
        <line
          x1={cx + 4 + rMarker * Math.cos(markerRad)}
          y1={cy + 4 + rMarker * Math.sin(markerRad)}
          x2={cx + 4 + (rMarker + size * 0.08) * Math.cos(markerRad)}
          y2={cy + 4 + (rMarker + size * 0.08) * Math.sin(markerRad)}
          stroke={ANA.cyanHi}
          strokeWidth={2.2}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${ANA.cyan})` }}
        />
      </svg>
      <span
        style={{
          fontSize: 7,
          fontWeight: 800,
          color: ANA.cyan,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          textAlign: 'center',
          maxWidth: 56,
          lineHeight: 1.1,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 8, fontWeight: 800, color: ANA.textHi, fontVariantNumeric: 'tabular-nums' }}>
        {display}
        {unit ? <span style={{ color: ANA.textDim, marginLeft: 2, fontSize: 7 }}>{unit}</span> : null}
      </span>
    </div>
  );
}

/** ANA-style vertical fader — thin groove + metallic cap with cyan stripe. */
export function AnaVertFader({
  label,
  value,
  min,
  max,
  disabled = false,
  onChange,
  height = ANA_FADER_H,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
  height?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const t = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const capTop = (1 - t) * (height - 10);

  const dragFrom = useCallback(
    (clientY: number) => {
      const el = trackRef.current;
      if (!el || disabled) return;
      const rect = el.getBoundingClientRect();
      const rel = 1 - (clientY - rect.top) / Math.max(1, rect.height);
      const next = min + Math.max(0, Math.min(1, rel)) * (max - min);
      onChange(next);
    },
    [disabled, max, min, onChange],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragFrom(e.clientY);
    },
    [disabled, dragFrom],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId) || disabled) return;
      dragFrom(e.clientY);
    },
    [disabled, dragFrom],
  );

  const display = max <= 1 && min >= 0 ? value.toFixed(2) : value < 10 ? value.toFixed(1) : String(Math.round(value));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        minWidth: 28,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <span style={{ fontSize: 7, fontWeight: 800, color: ANA.textHi, letterSpacing: '0.14em' }}>{label}</span>
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => {
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* */
          }
        }}
        style={{
          position: 'relative',
          width: 14,
          height,
          cursor: disabled ? 'default' : 'ns-resize',
          touchAction: 'none',
        }}
      >
        {/* Groove */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 4,
            bottom: 4,
            width: 2,
            transform: 'translateX(-50%)',
            background: `linear-gradient(180deg, ${ANA.border}, #2a2a32, ${ANA.border})`,
            borderRadius: 1,
            boxShadow: 'inset 0 0 4px rgba(0,0,0,0.8)',
          }}
        />
        {/* Fill glow below cap */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 4,
            width: 4,
            height: `${t * 100}%`,
            transform: 'translateX(-50%)',
            background: `linear-gradient(0deg, ${ANA.cyanDim}44, ${ANA.cyan}22)`,
            borderRadius: 2,
            pointerEvents: 'none',
          }}
        />
        {/* Metallic cap */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: capTop,
            width: 20,
            height: 9,
            transform: 'translateX(-50%)',
            borderRadius: 2,
            background: `linear-gradient(180deg, ${ANA.faderCapHi}, ${ANA.faderCap}, #222228)`,
            border: `1px solid ${ANA.borderHi}`,
            boxShadow: `0 0 6px ${ANA.cyan}44, inset 0 1px 0 rgba(255,255,255,0.12)`,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 2,
              right: 2,
              top: '50%',
              height: 2,
              transform: 'translateY(-50%)',
              borderRadius: 1,
              background: ANA.cyan,
              boxShadow: `0 0 6px ${ANA.cyan}, 0 0 2px ${ANA.cyanHi}`,
            }}
          />
        </div>
      </div>
      <span style={{ fontSize: 7, fontWeight: 700, color: ANA.cyan, fontVariantNumeric: 'tabular-nums' }}>{display}</span>
    </div>
  );
}

/** Horizontal fader — cyan dot on thin track (mod matrix, curve/velo). */
export function AnaHorizFader({
  value,
  min,
  max,
  disabled,
  onChange,
  width = 120,
}: {
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
  width?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const t = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));

  const dragFrom = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || disabled) return;
      const rect = el.getBoundingClientRect();
      const rel = (clientX - rect.left) / Math.max(1, rect.width);
      onChange(min + Math.max(0, Math.min(1, rel)) * (max - min));
    },
    [disabled, max, min, onChange],
  );

  return (
    <div
      ref={trackRef}
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragFrom(e.clientX);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId) || disabled) return;
        dragFrom(e.clientX);
      }}
      onPointerUp={(e) => {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* */
        }
      }}
      style={{
        position: 'relative',
        width,
        height: 14,
        cursor: disabled ? 'default' : 'ew-resize',
        touchAction: 'none',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: 2,
          transform: 'translateY(-50%)',
          background: `linear-gradient(90deg, ${ANA.border}, #2a2a34, ${ANA.border})`,
          borderRadius: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `calc(${t * 100}% - 5px)`,
          top: '50%',
          width: 10,
          height: 10,
          transform: 'translateY(-50%)',
          borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, ${ANA.cyanHi}, ${ANA.cyan})`,
          boxShadow: `0 0 8px ${ANA.cyan}, 0 0 3px ${ANA.cyanHi}`,
          border: `1px solid ${ANA.cyanDim}`,
        }}
      />
    </div>
  );
}

export function AnaVertSlider({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  accent?: string;
  onChange: (v: number) => void;
}) {
  return (
    <AnaVertFader label={label} value={value} min={min} max={max} disabled={disabled} onChange={onChange} />
  );
}

export function AnaAdsrBlock({
  title,
  attack,
  decay,
  sustain,
  release,
  attackMax,
  decayMax,
  releaseMax,
  disabled,
  accent,
  onChange,
}: {
  title: string;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  attackMax?: number;
  decayMax?: number;
  releaseMax?: number;
  disabled?: boolean;
  accent?: string;
  onChange: (patch: { attack?: number; decay?: number; sustain?: number; release?: number }) => void;
}) {
  const col = accent ?? ANA.green;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 7, fontWeight: 900, color: col, letterSpacing: '0.12em', textAlign: 'center' }}>{title}</span>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        <AnaVertFader label="A" value={attack} min={0} max={attackMax ?? 800} disabled={disabled} onChange={(v) => onChange({ attack: v })} height={88} />
        <AnaVertFader label="D" value={decay} min={4} max={decayMax ?? 1200} disabled={disabled} onChange={(v) => onChange({ decay: v })} height={88} />
        <AnaVertFader label="S" value={sustain} min={0} max={1} disabled={disabled} onChange={(v) => onChange({ sustain: v })} height={88} />
        <AnaVertFader label="R" value={release} min={8} max={releaseMax ?? 2000} disabled={disabled} onChange={(v) => onChange({ release: v })} height={88} />
      </div>
    </div>
  );
}

export function AnaWaveScreen({
  path,
  accent = ANA.cyanHi,
  height = 56,
}: {
  path: string;
  accent?: string;
  height?: number;
}) {
  return (
    <svg viewBox="0 0 200 80" width="100%" height={height} preserveAspectRatio="none" style={{ display: 'block' }}>
      <path d={path} stroke={accent} strokeWidth="1.8" fill="none" opacity={0.95} style={{ filter: `drop-shadow(0 0 5px ${accent})` }} />
      <path d={path} stroke={accent} strokeWidth="4" fill="none" opacity={0.1} />
    </svg>
  );
}

export function defaultArpGrid(): boolean[][] {
  return buildGenoArpGridPattern({ barLength: 4, order: 'UP/DN', octShift: 0, rateIdx: 1 });
}

/** Label column — aligned with piano-roll key strip width (compact). */
const GENO_ARP_LABEL_W = 44;
const GENO_ARP_PIANO = GENO_LOOP_PIANO_GRID;
/** Geno Ultra ARP — neon green note blocks (Sektor piano-roll style). */
const GENO_ARP_NOTE_ACCENT = ANA.green;
const GENO_ARP_NOTE_ACCENT_HI = ANA.greenHi;
const GENO_ARP_NOTE_ACCENT_DIM = ANA.greenDim;
const GENO_ARP_NOTE_BLOCK_PX = Math.max(6, Math.min(GENO_ARP_CELL_COL_W_PX, GENO_ARP_CELL_ROW_H_PX) - 4);
/** Scale-lock grid — thin in-key row lines only (IN KEY mode). */
const GENO_ARP_SCALE_IN_KEY_LINE = 'rgba(57, 255, 20, 0.26)';
const GENO_ARP_SCALE_IN_KEY_LINE_HI = 'rgba(109, 255, 74, 0.34)';

/** Piano-roll bar shades + row stripes + beat/bar lines (same tokens as SE2 Geno loop roll). */
function GenoArpPianoRollBackdrop({
  rows,
  cols,
  bars,
  colsPerBar,
  drawInKeyMode = false,
  barOctShifts,
  isCellInKey,
}: {
  rows: number;
  cols: number;
  bars: number;
  colsPerBar: number;
  drawInKeyMode?: boolean;
  barOctShifts?: readonly number[];
  isCellInKey?: (storedRow: number, col: number) => boolean;
}) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {Array.from({ length: rows }, (_, ri) => {
        const displayRow = rows - 1 - ri;
        const labelStoredRow = genoArpStoredRowForBarOct(displayRow, barOctShifts?.[0] ?? 0);
        const rowInKey = drawInKeyMode && isCellInKey ? isCellInKey(labelStoredRow, 0) : false;
        return (
          <div
            key={`arp-row-${ri}`}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${(ri / rows) * 100}%`,
              height: `${100 / rows}%`,
              background: ri % 2 === 0 ? GENO_ARP_PIANO.rowWhite : GENO_ARP_PIANO.rowBlack,
              borderBottom: rowInKey
                ? `1px solid ${GENO_ARP_SCALE_IN_KEY_LINE}`
                : `1px solid ${GENO_ARP_PIANO.rowBorder}`,
              boxShadow: rowInKey ? `inset 0 1px 0 ${GENO_ARP_SCALE_IN_KEY_LINE_HI}` : undefined,
            }}
          />
        );
      })}
      {Array.from({ length: bars }, (_, bi) => (
        <div
          key={`arp-bar-shade-${bi}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${((bi * colsPerBar) / cols) * 100}%`,
            width: `${(colsPerBar / cols) * 100}%`,
            background: bi % 2 === 0 ? GENO_ARP_PIANO.barFillA : GENO_ARP_PIANO.barFillB,
          }}
        />
      ))}
      {Array.from({ length: bars }, (_, bi) => (
        <div
          key={`arp-bar-line-${bi}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${((bi * colsPerBar) / cols) * 100}%`,
            borderLeft: `1px solid ${GENO_ARP_PIANO.barLine}`,
          }}
        />
      ))}
      {Array.from({ length: cols + 1 }, (_, ci) => {
        if (ci === 0 || ci % colsPerBar === 0) return null;
        return (
          <div
            key={`arp-step-line-${ci}`}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${(ci / cols) * 100}%`,
              borderLeft: `1px solid ${GENO_ARP_PIANO.beatLine}`,
            }}
          />
        );
      })}
    </div>
  );
}

/** ARP step grid — fixed piano-roll cells (17×14px) + horizontal scroll + per-bar OCT strip. */
export function AnaArpGridVisual({
  grid,
  barLength = 4,
  rateIdx = 1,
  playStep = -1,
  rateLabel = '1/16',
  orderLabel = 'UP/DN',
  gate = 0.82,
  seqActive = false,
  disabled,
  onToggle,
  drawNoteMode = false,
  drawInKeyMode = false,
  isCellInKey,
  onPaintCell,
  barOctShifts = emptyGenoArpBarOctShifts(),
  onSetBarOct,
  stepMask,
  stepHits,
  phraseSteps,
  onPhraseSteps,
  onToggleStep,
  onSetStepHits,
  onRegenerateSteps,
  stepRegenRandom,
  onStepRegenRandomToggle,
  selectedBar = null,
  selectedCells,
  onSelectBar,
  onToggleSelectCell,
}: {
  grid: boolean[][];
  barLength?: number;
  rateIdx?: number;
  playStep?: number;
  rateLabel?: string;
  orderLabel?: string;
  gate?: number;
  seqActive?: boolean;
  disabled?: boolean;
  onToggle?: (row: number, col: number) => void;
  /** Click-drag paint on the note grid (Shift or right-drag erases). */
  drawNoteMode?: boolean;
  /** When on, out-of-scale rows are dimmed and paint snaps to the nearest in-key pitch. */
  drawInKeyMode?: boolean;
  isCellInKey?: (storedRow: number, col: number) => boolean;
  onPaintCell?: (row: number, col: number, on: boolean) => void;
  barOctShifts?: GenoArpBarOctShift[];
  onSetBarOct?: (barIndex: number, oct: GenoArpBarOctShift) => void;
  /** Retrologue step sequencer — shares columns with the note grid. */
  stepMask?: boolean[];
  stepHits?: number[];
  phraseSteps?: number;
  onPhraseSteps?: (n: number) => void;
  onToggleStep?: (col: number) => void;
  onSetStepHits?: (col: number, hits: GenoArpStepHits) => void;
  onRegenerateSteps?: () => void;
  stepRegenRandom?: boolean;
  onStepRegenRandomToggle?: () => void;
  /** Bar ruler highlight — whole-bar duplicate source. */
  selectedBar?: number | null;
  selectedCells?: ReadonlySet<GenoArpGridCellKey>;
  onSelectBar?: (barIndex: number) => void;
  onToggleSelectCell?: (row: number, col: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridAreaRef = useRef<HTMLDivElement>(null);
  const paintRef = useRef<{ active: boolean; erase: boolean; lastKey: string } | null>(null);
  const bars = genoArpSanitizeBarLength(barLength);
  const cols = genoArpGridCols(barLength);
  const colsPerBar = GENO_ARP_STEPS_PER_BAR;
  const rows = GENO_ARP_ROWS;
  const gatePct = Math.round(gate * 100);
  const rulerH = GENO_LOOP_PIANO_RULER_H_PX - 2;
  const barSelectH = Math.max(rulerH, 26);
  const octStripH = 22;
  const stepLaneH = 26;
  const hitsLaneH = 20;
  const hasStepSeq = !!onToggleStep && !!onSetStepHits;
  const phraseLen = genoArpSanitizePhraseSteps(phraseSteps ?? cols, cols);
  const { width: gridW, height: gridH } = genoArpGridPixelSize(cols, rows);
  const innerW = GENO_ARP_LABEL_W + gridW;
  const colTemplate = `repeat(${cols}, ${GENO_ARP_CELL_COL_W_PX}px)`;
  const rowTemplate = `repeat(${rows}, ${GENO_ARP_CELL_ROW_H_PX}px)`;
  const barColTemplate = `repeat(${bars}, ${colsPerBar * GENO_ARP_CELL_COL_W_PX}px)`;
  const scrollMaxH =
    rows * GENO_ARP_CELL_ROW_H_PX +
    octStripH +
    barSelectH +
    (hasStepSeq ? stepLaneH + hitsLaneH + 28 : 0);

  const displayOn = useMemo(() => {
    const set = new Set<string>();
    for (let ci = 0; ci < cols; ci += 1) {
      const bi = genoArpGridColToBarIndex(ci);
      const barOct = barOctShifts[bi] ?? 0;
      for (let sr = 0; sr < rows; sr += 1) {
        if (grid[sr]?.[ci]) {
          const dr = genoArpDisplayRowForBarOct(sr, barOct);
          set.add(`${dr}-${ci}`);
        }
      }
    }
    return set;
  }, [grid, cols, rows, barOctShifts]);

  const cellFromPointer = useCallback(
    (clientX: number, clientY: number): { row: number; col: number } | null => {
      const el = gridAreaRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x >= gridW || y >= gridH) return null;
      const ci = Math.min(cols - 1, Math.floor(x / GENO_ARP_CELL_COL_W_PX));
      const ri = Math.min(rows - 1, Math.floor(y / GENO_ARP_CELL_ROW_H_PX));
      return { row: rows - 1 - ri, col: ci };
    },
    [cols, gridH, gridW, rows],
  );

  const paintCellAt = useCallback(
    (row: number, col: number, on: boolean) => {
      if (!onPaintCell) return;
      const barIdx = genoArpGridColToBarIndex(col);
      const barOct = barOctShifts[barIdx] ?? 0;
      const storedRow = genoArpStoredRowForBarOct(row, barOct);
      if (on && drawInKeyMode && isCellInKey && !isCellInKey(storedRow, col)) return;
      const key = `${storedRow}-${col}`;
      if (paintRef.current?.lastKey === key) return;
      if (paintRef.current) paintRef.current.lastKey = key;
      onPaintCell(storedRow, col, on);
    },
    [barOctShifts, drawInKeyMode, isCellInKey, onPaintCell],
  );

  const endGridPaint = useCallback(() => {
    paintRef.current = null;
  }, []);

  useEffect(() => {
    if (!drawNoteMode || !onPaintCell) return;
    const onMove = (e: PointerEvent) => {
      if (!paintRef.current?.active) return;
      const cell = cellFromPointer(e.clientX, e.clientY);
      if (!cell) return;
      paintCellAt(cell.row, cell.col, !paintRef.current.erase);
    };
    const onUp = () => {
      paintRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [drawNoteMode, cellFromPointer, onPaintCell, paintCellAt]);

  const startDrawAtCell = useCallback(
    (e: React.PointerEvent, row: number, col: number) => {
      if (!drawNoteMode || !onPaintCell || disabled) return;
      if (e.button !== 0 && e.button !== 2) return;
      e.preventDefault();
      e.stopPropagation();
      const erase = e.button === 2 || e.shiftKey;
      paintRef.current = { active: true, erase, lastKey: '' };
      try {
        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      paintCellAt(row, col, !erase);
    },
    [disabled, drawNoteMode, onPaintCell, paintCellAt],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          padding: '2px 4px',
          fontSize: 7,
          fontWeight: 800,
          letterSpacing: '0.08em',
          color: ANA.textDim,
          borderBottom: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
          background: ANA.bgDeep,
        }}
      >
        <span
          style={{
            color: seqActive ? GENO_ARP_NOTE_ACCENT_HI : ANA.textDim,
            textShadow: seqActive ? `0 0 6px ${GENO_ARP_NOTE_ACCENT}` : 'none',
          }}
        >
          {seqActive ? '● ARP RUN' : '○ ARP STOP'}
        </span>
        <span style={{ color: ANA.textDim }}>
          {orderLabel} · {rateLabel} · {bars}BAR · {cols}ST · G{gatePct}%
          {hasStepSeq ? ` · PHRASE ${phraseLen}` : ''}
          {drawInKeyMode ? (
            <span style={{ color: ANA.greenHi, marginLeft: 6 }}>
              · <span style={{ color: GENO_ARP_SCALE_IN_KEY_LINE_HI }}>—</span> in scale
            </span>
          ) : null}
        </span>
      </div>

      {hasStepSeq ? (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexWrap: 'wrap',
            padding: '3px 4px',
            borderBottom: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
            background: ANA.bgDeep,
          }}
        >
          <span
            style={{ fontSize: 7, fontWeight: 800, color: ANA.greenHi, letterSpacing: '0.1em' }}
            title="Step sequencer — same columns as the note grid (Retrologue-style)"
          >
            STEP SEQ
          </span>
          <span style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.1em' }}>
            LENGTH
          </span>
          {GENO_ARP_PHRASE_STEP_PRESETS.filter((n) => n <= cols).map((n) => (
            <AnaBtn
              key={n}
              small
              active={phraseLen === n}
              disabled={disabled}
              onClick={() => onPhraseSteps?.(n)}
              title={`Phrase length = ${n} steps`}
            >
              {n}
            </AnaBtn>
          ))}
          <AnaBtn
            small
            active={phraseLen === cols}
            disabled={disabled}
            onClick={() => onPhraseSteps?.(cols)}
            title={`Full pattern length (${cols} steps)`}
          >
            ALL
          </AnaBtn>
          <AnaBtn
            small
            disabled={disabled || !onRegenerateSteps}
            onClick={() => onRegenerateSteps?.()}
            title="Regenerate melody on armed steps — stays within notes already on the grid"
          >
            Regenerate
          </AnaBtn>
          <AnaBtn
            small
            active={!!stepRegenRandom}
            disabled={disabled || !onStepRegenRandomToggle}
            onClick={() => onStepRegenRandomToggle?.()}
            title="Random mode — Regenerate can use any pitch on the grid"
          >
            Random
          </AnaBtn>
          <span style={{ fontSize: 7, color: ANA.textDim }}>
            pads = on/off · hits = 1–4 per step
          </span>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        style={{
          overflowX: 'auto',
          overflowY: 'auto',
          maxHeight: scrollMaxH,
          maxWidth: '100%',
          borderBottom: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
        }}
      >
        <div style={{ width: innerW, minWidth: innerW }}>
          {hasStepSeq ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `${GENO_ARP_LABEL_W}px ${gridW}px`,
                  height: stepLaneH,
                  borderBottom: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
                  background: ANA.bgDeep,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: 4,
                    fontSize: 7,
                    fontWeight: 800,
                    color: ANA.greenHi,
                    letterSpacing: '0.06em',
                    borderRight: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
                  }}
                >
                  STEP
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: colTemplate,
                    width: gridW,
                    height: stepLaneH,
                  }}
                >
                  {Array.from({ length: cols }, (_, ci) => {
                    const inPhrase = ci < phraseLen;
                    const on = inPhrase && stepMask?.[ci] !== false;
                    const isPlay = seqActive && playStep === ci;
                    return (
                      <button
                        key={`step-${ci}`}
                        type="button"
                        disabled={disabled || !inPhrase}
                        onClick={() => onToggleStep?.(ci)}
                        title={
                          inPhrase
                            ? on
                              ? `Step ${ci + 1} on — click to rest`
                              : `Step ${ci + 1} rest — click to arm`
                            : `Outside phrase (${phraseLen} steps)`
                        }
                        style={{
                          margin: 0,
                          padding: 0,
                          border: 'none',
                          borderRight: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
                          borderRadius: 0,
                          cursor: disabled || !inPhrase ? 'default' : 'pointer',
                          width: GENO_ARP_CELL_COL_W_PX,
                          height: stepLaneH,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isPlay
                            ? `${ANA.greenHi}33`
                            : ci % 4 === 0
                              ? '#0a0e14'
                              : '#080a10',
                          opacity: inPhrase ? 1 : 0.22,
                        }}
                      >
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 2,
                            border: `1px solid ${
                              isPlay ? ANA.greenHi : on ? ANA.green : ANA.borderHi
                            }`,
                            background: on
                              ? isPlay
                                ? ANA.greenHi
                                : ANA.green
                              : '#12161e',
                            boxShadow: on
                              ? isPlay
                                ? `0 0 8px ${ANA.greenHi}`
                                : `0 0 4px ${ANA.green}66`
                              : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `${GENO_ARP_LABEL_W}px ${gridW}px`,
                  height: hitsLaneH,
                  borderBottom: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
                  background: ANA.bgInset,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: 4,
                    fontSize: 7,
                    fontWeight: 800,
                    color: ANA.orange,
                    letterSpacing: '0.06em',
                    borderRight: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
                  }}
                >
                  HITS
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: colTemplate,
                    width: gridW,
                    height: hitsLaneH,
                  }}
                >
                  {Array.from({ length: cols }, (_, ci) => {
                    const inPhrase = ci < phraseLen;
                    const on = inPhrase && stepMask?.[ci] !== false;
                    const hits = genoArpSanitizeStepHits(
                      stepHits?.[ci] ?? (on ? 1 : 0),
                    );
                    const hitVal = hits > 0 ? hits : 1;
                    return (
                      <div
                        key={`hits-${ci}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRight: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
                          width: GENO_ARP_CELL_COL_W_PX,
                          height: hitsLaneH,
                          opacity: inPhrase ? 1 : 0.22,
                          boxSizing: 'border-box',
                        }}
                      >
                        <select
                          value={hitVal}
                          disabled={disabled || !inPhrase || !on}
                          title={`Step ${ci + 1} — how many hits (1–4)`}
                          onChange={(e) =>
                            onSetStepHits?.(ci, genoArpSanitizeStepHits(Number(e.target.value)))
                          }
                          style={{
                            width: GENO_ARP_CELL_COL_W_PX - 2,
                            height: hitsLaneH - 4,
                            margin: 0,
                            padding: 0,
                            fontSize: 7,
                            fontWeight: 800,
                            lineHeight: 1,
                            color: ANA.orange,
                            background: ANA.bgInset,
                            border: `1px solid ${ANA.borderHi}`,
                            borderRadius: 2,
                            cursor: disabled || !inPhrase || !on ? 'default' : 'pointer',
                            textAlign: 'center',
                            textAlignLast: 'center',
                          }}
                        >
                          {[1, 2, 3, 4].map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `${GENO_ARP_LABEL_W}px ${gridW}px`,
              minHeight: barSelectH,
              background: ANA.bgDeep,
              borderBottom: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: 4,
                fontSize: 6,
                fontWeight: 800,
                color: ANA.textDim,
                letterSpacing: '0.08em',
                borderRight: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
              }}
            >
              BAR
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: barColTemplate,
                width: gridW,
                alignItems: 'stretch',
                minHeight: barSelectH,
              }}
            >
              {Array.from({ length: bars }, (_, bi) => {
                const barOct = barOctShifts[bi] ?? 0;
                const barActive =
                  seqActive && playStep >= bi * colsPerBar && playStep < (bi + 1) * colsPerBar;
                const barSelected = selectedBar === bi;
                return (
                  <button
                    key={`bar-sel-${bi}`}
                    type="button"
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectBar?.(bi);
                    }}
                    title={`Select BAR ${bi + 1} — DUP → copies to BAR ${bi + 2}`}
                    style={{
                      margin: 0,
                      padding: '4px 2px',
                      width: '100%',
                      minHeight: barSelectH,
                      border: barSelected
                        ? `2px solid ${GENO_ARP_NOTE_ACCENT_HI}`
                        : `1px solid ${GENO_ARP_PIANO.rowBorder}`,
                      borderRadius: 0,
                      background: barActive
                        ? `${GENO_ARP_NOTE_ACCENT}18`
                        : bi % 2 === 0
                          ? '#0c1018'
                          : '#080c14',
                      fontSize: 7,
                      fontWeight: 800,
                      color: barActive
                        ? GENO_ARP_NOTE_ACCENT_HI
                        : barOct !== 0
                          ? GENO_ARP_NOTE_ACCENT
                          : ANA.textDim,
                      textAlign: 'center',
                      letterSpacing: '0.08em',
                      cursor: disabled ? 'default' : 'pointer',
                      boxSizing: 'border-box',
                    }}
                  >
                    BAR {bi + 1}
                    {barOct !== 0 ? (barOct > 0 ? ` +${barOct}` : ` ${barOct}`) : ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `${GENO_ARP_LABEL_W}px ${gridW}px`,
              height: gridH,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateRows: rowTemplate,
                borderRight: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
                background: ANA.bgDeep,
              }}
            >
              {Array.from({ length: rows }, (_, ri) => {
                const noteNum = rows - ri;
                const displayRow = rows - 1 - ri;
                const labelStoredRow = genoArpStoredRowForBarOct(displayRow, barOctShifts[0] ?? 0);
                const rowInKey =
                  !drawInKeyMode || !isCellInKey || isCellInKey(labelStoredRow, 0);
                return (
                  <div
                    key={noteNum}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: 4,
                      height: GENO_ARP_CELL_ROW_H_PX,
                      fontSize: 7,
                      fontWeight: 800,
                      color:
                        drawInKeyMode && isCellInKey
                          ? rowInKey
                            ? ANA.textHi
                            : ANA.textDim
                          : ANA.textDim,
                      letterSpacing: '0.06em',
                      borderBottom: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
                      borderLeft:
                        drawInKeyMode && isCellInKey && rowInKey
                          ? `1px solid ${GENO_ARP_SCALE_IN_KEY_LINE_HI}`
                          : '1px solid transparent',
                      background: 'transparent',
                    }}
                  >
                    N{noteNum}
                  </div>
                );
              })}
            </div>

            <div
              ref={gridAreaRef}
              style={{
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: colTemplate,
                gridTemplateRows: rowTemplate,
                width: gridW,
                height: gridH,
                background: ANA.bgInset,
                touchAction: drawNoteMode ? 'none' : undefined,
                cursor: drawNoteMode && !disabled ? 'crosshair' : undefined,
              }}
            >
              <GenoArpPianoRollBackdrop
                rows={rows}
                cols={cols}
                bars={bars}
                colsPerBar={colsPerBar}
                drawInKeyMode={drawInKeyMode}
                barOctShifts={barOctShifts}
                isCellInKey={isCellInKey}
              />
              {Array.from({ length: rows * cols }, (_, idx) => {
                const ri = Math.floor(idx / cols);
                const ci = idx % cols;
                const row = rows - 1 - ri;
                const on = displayOn.has(`${row}-${ci}`);
                const isPlay = seqActive && playStep === ci;
                const barIdx = genoArpGridColToBarIndex(ci);
                const barOct = barOctShifts[barIdx] ?? 0;
                const storedRow = genoArpStoredRowForBarOct(row, barOct);
                const cellSelKey = genoArpGridCellKey(storedRow, ci);
                const isCellSelected = selectedCells?.has(cellSelKey) ?? false;
                const stepArmed =
                  !hasStepSeq || (ci < phraseLen && stepMask?.[ci] !== false);
                const inKey =
                  !drawInKeyMode || (isCellInKey ? isCellInKey(storedRow, ci) : false);
                return (
                  <button
                    key={`${row}-${ci}`}
                    type="button"
                    disabled={disabled}
                    onPointerDown={(e) => startDrawAtCell(e, row, ci)}
                    onPointerUp={endGridPaint}
                    onPointerCancel={endGridPaint}
                    onClick={(e) => {
                      if (drawNoteMode) return;
                      if (e.shiftKey && onToggleSelectCell) {
                        e.preventDefault();
                        if (on) onToggleSelectCell(storedRow, ci);
                        return;
                      }
                      onToggle?.(storedRow, ci);
                    }}
                    style={{
                      margin: 0,
                      padding: 0,
                      border: isCellSelected ? `1px solid ${GENO_ARP_NOTE_ACCENT_HI}` : 'none',
                      borderRadius: 0,
                      cursor:
                        drawNoteMode && drawInKeyMode && !inKey
                          ? 'not-allowed'
                          : drawNoteMode
                            ? 'crosshair'
                            : disabled
                              ? 'default'
                              : drawInKeyMode && !inKey
                                ? 'not-allowed'
                                : 'pointer',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      width: GENO_ARP_CELL_COL_W_PX,
                      height: GENO_ARP_CELL_ROW_H_PX,
                      position: 'relative',
                      zIndex: 1,
                      opacity: stepArmed ? 1 : 0.28,
                    }}
                    aria-label={`Note ${row + 1} step ${ci + 1}`}
                    aria-selected={isCellSelected}
                  >
                    {(on || isPlay) && (
                      <span
                        style={{
                          width: GENO_ARP_NOTE_BLOCK_PX,
                          height: GENO_ARP_NOTE_BLOCK_PX,
                          borderRadius: 2,
                          border: `1px solid ${
                            isCellSelected
                              ? '#fff'
                              : isPlay
                                ? GENO_ARP_NOTE_ACCENT_HI
                                : GENO_ARP_NOTE_ACCENT_DIM
                          }`,
                          background: on
                            ? isPlay
                              ? `linear-gradient(180deg, ${GENO_ARP_NOTE_ACCENT_HI} 0%, ${GENO_ARP_NOTE_ACCENT} 100%)`
                              : `linear-gradient(180deg, ${GENO_ARP_NOTE_ACCENT}dd 0%, ${GENO_ARP_NOTE_ACCENT}88 100%)`
                            : `${GENO_ARP_NOTE_ACCENT}22`,
                          boxShadow:
                            isCellSelected
                              ? `0 0 0 1px ${GENO_ARP_NOTE_ACCENT_HI}, 0 0 8px ${GENO_ARP_NOTE_ACCENT}`
                              : on && isPlay
                                ? `0 0 8px ${GENO_ARP_NOTE_ACCENT}`
                                : on
                                  ? `0 0 3px ${GENO_ARP_NOTE_ACCENT}55`
                                  : 'none',
                          opacity: disabled ? 0.5 : on && !isPlay ? 0.55 + gate * 0.45 : 1,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `${GENO_ARP_LABEL_W}px ${gridW}px`,
              minHeight: octStripH,
              background: ANA.bgInset,
              borderTop: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: 4,
                fontSize: 6,
                fontWeight: 800,
                color: ANA.textDim,
                letterSpacing: '0.08em',
              }}
            >
              OCT
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: barColTemplate,
                width: gridW,
                alignItems: 'center',
              }}
            >
              {Array.from({ length: bars }, (_, bi) => (
                <div
                  key={`bar-oct-${bi}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    padding: '2px 0',
                    flexWrap: 'wrap',
                  }}
                >
                  <AnaBtn
                    small
                    active={barOctShifts[bi] === -2}
                    disabled={disabled || !onSetBarOct}
                    onClick={() => onSetBarOct?.(bi, -2)}
                    title={`Bar ${bi + 1} −2 oct`}
                  >
                    −2
                  </AnaBtn>
                  <AnaBtn
                    small
                    active={barOctShifts[bi] === -1}
                    disabled={disabled || !onSetBarOct}
                    onClick={() => onSetBarOct?.(bi, -1)}
                    title={`Bar ${bi + 1} −1 oct`}
                  >
                    −
                  </AnaBtn>
                  <AnaBtn
                    small
                    active={(barOctShifts[bi] ?? 0) === 0}
                    disabled={disabled || !onSetBarOct}
                    onClick={() => onSetBarOct?.(bi, 0)}
                    title={`Bar ${bi + 1} center`}
                  >
                    0
                  </AnaBtn>
                  <AnaBtn
                    small
                    active={barOctShifts[bi] === 1}
                    disabled={disabled || !onSetBarOct}
                    onClick={() => onSetBarOct?.(bi, 1)}
                    title={`Bar ${bi + 1} +1 oct`}
                  >
                    +
                  </AnaBtn>
                  <AnaBtn
                    small
                    active={barOctShifts[bi] === 2}
                    disabled={disabled || !onSetBarOct}
                    onClick={() => onSetBarOct?.(bi, 2)}
                    title={`Bar ${bi + 1} +2 oct`}
                  >
                    +2
                  </AnaBtn>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export type GenoArpSubLaneId = 'mod1' | 'mod2' | 'vel';

/**
 * Retrologue-style step operator — numbered dots for phrase length + per-step hits.
 * Click a big dot to arm/rest that step. Click the mini-dots to set how many times
 * the note fires on that step (0–4). STEPS presets set how many dots are in the loop.
 */
export function AnaArpStepOperator({
  phraseSteps,
  maxSteps,
  stepMask,
  stepHits,
  playStep = -1,
  seqActive = false,
  disabled,
  onPhraseSteps,
  onToggleStep,
  onSetStepHits,
}: {
  phraseSteps: number;
  maxSteps: number;
  stepMask: boolean[];
  stepHits: number[];
  playStep?: number;
  seqActive?: boolean;
  disabled?: boolean;
  onPhraseSteps: (n: number) => void;
  onToggleStep: (col: number) => void;
  onSetStepHits: (col: number, hits: GenoArpStepHits) => void;
}) {
  const len = genoArpSanitizePhraseSteps(phraseSteps, maxSteps);
  const show = Math.max(len, Math.min(maxSteps, 16));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '4px 6px 6px',
        borderTop: `1px solid ${ANA.borderHi}44`,
        borderBottom: `1px solid ${ANA.borderHi}44`,
        background: 'linear-gradient(180deg, #0c1018 0%, #080a10 100%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span
          style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.12em' }}
          title="Retrologue-style step operator — how many steps are in the phrase"
        >
          STEP OP
        </span>
        <span style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.1em' }}>STEPS</span>
        {GENO_ARP_PHRASE_STEP_PRESETS.filter((n) => n <= maxSteps).map((n) => (
          <AnaBtn
            key={n}
            small
            active={len === n}
            disabled={disabled}
            onClick={() => onPhraseSteps(n)}
            title={`Phrase length = ${n} steps (how many dots in the loop)`}
          >
            {n}
          </AnaBtn>
        ))}
        <AnaLcdBar size="sm" title="Active phrase length">
          {len} STEPS
        </AnaLcdBar>
        <span style={{ fontSize: 7, color: ANA.textDim, marginLeft: 4 }}>
          click dot = on/off · hits dropdown = 1–4
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${show}, minmax(18px, 1fr))`,
          gap: 4,
          alignItems: 'end',
        }}
      >
        {Array.from({ length: show }, (_, i) => {
          const inPhrase = i < len;
          const on = inPhrase && (stepMask[i] !== false);
          const hits = genoArpSanitizeStepHits(stepHits[i] ?? (on ? 1 : 0));
          const playing = seqActive && playStep === i;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                opacity: inPhrase ? 1 : 0.28,
                pointerEvents: inPhrase && !disabled ? 'auto' : 'none',
              }}
            >
              <button
                type="button"
                disabled={disabled || !inPhrase}
                onClick={() => onToggleStep(i)}
                title={
                  on
                    ? `Step ${i + 1} armed — click to rest`
                    : `Step ${i + 1} rest — click to arm`
                }
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: playing
                    ? `2px solid ${ANA.greenHi}`
                    : `1px solid ${on ? ANA.green : ANA.borderHi}`,
                  background: on
                    ? playing
                      ? ANA.greenHi
                      : ANA.green
                    : '#12161e',
                  boxShadow: on
                    ? playing
                      ? `0 0 10px ${ANA.greenHi}`
                      : `0 0 6px ${ANA.green}88`
                    : 'inset 0 1px 2px rgba(0,0,0,0.6)',
                  cursor: disabled ? 'default' : 'pointer',
                  padding: 0,
                }}
              />
              <select
                value={hits > 0 ? hits : 1}
                disabled={disabled || !inPhrase || !on}
                title={`Step ${i + 1} hits — pick 1–4`}
                onChange={(e) =>
                  onSetStepHits(i, genoArpSanitizeStepHits(Number(e.target.value)))
                }
                style={{
                  width: 28,
                  height: 16,
                  margin: 0,
                  padding: '0 2px',
                  fontSize: 8,
                  fontWeight: 800,
                  color: ANA.orange,
                  background: ANA.bgInset,
                  border: `1px solid ${ANA.borderHi}`,
                  borderRadius: 2,
                  cursor: disabled || !on ? 'default' : 'pointer',
                }}
              >
                {[1, 2, 3, 4].map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 7, fontWeight: 700, color: ANA.textDim, lineHeight: 1 }}>
                {i + 1}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Retrologue Step mode — VEL + CTRL 1–3 bar lanes, column-aligned with the note grid.
 * Draw bars per step; each CTRL has ON, DPTH, DEST (like Cubase Retrologue 2).
 */
export function AnaArpRetrologueStepLanes({
  barLength,
  velLevels,
  mod1Levels,
  mod2Levels,
  mod3Levels,
  gateLevels,
  ctrl1On,
  ctrl2On,
  ctrl3On,
  ctrl1Depth,
  ctrl2Depth,
  ctrl3Depth,
  ctrl1Dest,
  ctrl2Dest,
  ctrl3Dest,
  playStep = -1,
  seqActive = false,
  phraseSteps,
  disabled,
  onSetVel,
  onSetMod1,
  onSetMod2,
  onSetMod3,
  onSetGate,
  onCtrl1On,
  onCtrl2On,
  onCtrl3On,
  gateFxOn,
  onCtrl1Depth,
  onCtrl2Depth,
  onCtrl3Depth,
  onCtrl1Dest,
  onCtrl2Dest,
  onCtrl3Dest,
}: {
  barLength: number;
  velLevels: number[];
  mod1Levels: number[];
  mod2Levels: number[];
  mod3Levels: number[];
  gateLevels: number[];
  ctrl1On: boolean;
  ctrl2On: boolean;
  ctrl3On: boolean;
  gateFxOn: boolean;
  ctrl1Depth: number;
  ctrl2Depth: number;
  ctrl3Depth: number;
  ctrl1Dest: string;
  ctrl2Dest: string;
  ctrl3Dest: string;
  playStep?: number;
  seqActive?: boolean;
  phraseSteps: number;
  disabled?: boolean;
  onSetVel: (col: number, level: number) => void;
  onSetMod1: (col: number, level: number) => void;
  onSetMod2: (col: number, level: number) => void;
  onSetMod3: (col: number, level: number) => void;
  onSetGate: (col: number, level: number) => void;
  onCtrl1On: (on: boolean) => void;
  onCtrl2On: (on: boolean) => void;
  onCtrl3On: (on: boolean) => void;
  onCtrl1Depth: (n: number) => void;
  onCtrl2Depth: (n: number) => void;
  onCtrl3Depth: (n: number) => void;
  onCtrl1Dest: (d: string) => void;
  onCtrl2Dest: (d: string) => void;
  onCtrl3Dest: (d: string) => void;
}) {
  const cols = genoArpGridCols(barLength);
  const phraseLen = genoArpSanitizePhraseSteps(phraseSteps, cols);
  const { width: gridW } = genoArpGridPixelSize(cols, GENO_ARP_ROWS);
  const innerW = GENO_ARP_LABEL_W + gridW;
  const colTemplate = `repeat(${cols}, ${GENO_ARP_CELL_COL_W_PX}px)`;
  const laneH = 36;

  const paintLevel = (
    e: ReactMouseEvent<HTMLDivElement>,
    col: number,
    onSet: (col: number, level: number) => void,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    onSet(col, y);
  };

  const renderBarLane = (
    label: string,
    levels: number[],
    accent: string,
    onSet: (col: number, level: number) => void,
    enabled: boolean,
  ) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${GENO_ARP_LABEL_W}px ${gridW}px`,
        height: laneH,
        borderBottom: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
        opacity: enabled ? 1 : 0.4,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 4,
          fontSize: 7,
          fontWeight: 800,
          color: accent,
          letterSpacing: '0.06em',
          borderRight: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
          background: ANA.bgDeep,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: colTemplate,
          width: gridW,
          height: laneH,
          background: ANA.bgInset,
        }}
      >
        {Array.from({ length: cols }, (_, ci) => {
          const inPhrase = ci < phraseLen;
          const level = Math.max(0, Math.min(1, levels[ci] ?? 0));
          const isPlay = seqActive && playStep === ci;
          return (
            <div
              key={`${label}-${ci}`}
              role="slider"
              aria-valuenow={Math.round(level * 100)}
              aria-label={`${label} step ${ci + 1}`}
              onMouseDown={(e) => {
                if (disabled || !inPhrase || !enabled) return;
                paintLevel(e, ci, onSet);
                const move = (ev: MouseEvent) => {
                  const el = e.currentTarget;
                  if (!el) return;
                  const rect = el.getBoundingClientRect();
                  const y = Math.max(0, Math.min(1, 1 - (ev.clientY - rect.top) / rect.height));
                  onSet(ci, y);
                };
                const up = () => {
                  window.removeEventListener('mousemove', move);
                  window.removeEventListener('mouseup', up);
                };
                window.addEventListener('mousemove', move);
                window.addEventListener('mouseup', up);
              }}
              style={{
                width: GENO_ARP_CELL_COL_W_PX,
                height: laneH,
                borderRight: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
                position: 'relative',
                cursor: disabled || !inPhrase || !enabled ? 'default' : 'ns-resize',
                opacity: inPhrase ? 1 : 0.22,
                background: isPlay ? `${accent}22` : ci % 4 === 0 ? '#0a0e14' : 'transparent',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 2,
                  right: 2,
                  bottom: 1,
                  height: `${Math.max(level > 0.01 ? 8 : 0, level * (laneH - 4))}px`,
                  borderRadius: '2px 2px 0 0',
                  background: isPlay
                    ? `linear-gradient(180deg, #fff 0%, ${accent} 100%)`
                    : `linear-gradient(180deg, ${accent}cc 0%, ${accent}66 100%)`,
                  boxShadow: level > 0.05 ? `0 0 4px ${accent}66` : 'none',
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  const ctrlRow = (
    label: string,
    on: boolean,
    depth: number,
    dest: string,
    setOn: (v: boolean) => void,
    setDepth: (n: number) => void,
    setDest: (d: string) => void,
  ) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        padding: '2px 4px',
        borderBottom: `1px solid ${ANA.borderHi}33`,
        background: ANA.bgDeep,
      }}
    >
      <span style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, width: 40 }}>{label}</span>
      <AnaBtn small active={on} disabled={disabled} onClick={() => setOn(!on)} title={`${label} on/off`}>
        {on ? 'ON' : 'OFF'}
      </AnaBtn>
      <span style={{ fontSize: 7, color: ANA.textDim }}>DPTH</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={depth}
        disabled={disabled || !on}
        onChange={(e) => setDepth(Number(e.target.value))}
        style={{ width: 72 }}
        title="Modulation depth"
      />
      <span style={{ fontSize: 7, color: ANA.textDim }}>DEST</span>
      <select
        value={dest}
        disabled={disabled || !on}
        onChange={(e) => setDest(e.target.value)}
        style={{
          fontSize: 9,
          background: ANA.bgInset,
          color: ANA.text,
          border: `1px solid ${ANA.borderHi}`,
          borderRadius: 3,
          padding: '1px 4px',
        }}
      >
        {GENO_ARP_CTRL_DEST_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 4px',
          borderBottom: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
          background: ANA.bgDeep,
        }}
      >
        <span style={{ fontSize: 7, fontWeight: 800, color: ANA.greenHi, letterSpacing: '0.1em' }}>
          MODE · STEP
        </span>
        <span style={{ fontSize: 7, color: ANA.textDim }}>
          VEL + CTRL lanes (Retrologue) — drag bars up/down per step
        </span>
      </div>
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <div style={{ width: innerW, minWidth: innerW }}>
          {renderBarLane('VEL', velLevels, ANA.orange, onSetVel, true)}
          {renderBarLane('CTRL 1', mod1Levels, ANA.green, onSetMod1, ctrl1On)}
          {renderBarLane('CTRL 2', mod2Levels, ANA.knobRingHi, onSetMod2, ctrl2On)}
          {renderBarLane('GATE', gateLevels, ANA.greenHi, onSetGate, gateFxOn)}
          {renderBarLane('CTRL 3', mod3Levels, '#7dd3fc', onSetMod3, ctrl3On)}
        </div>
      </div>
      {ctrlRow('CTRL 1', ctrl1On, ctrl1Depth, ctrl1Dest, onCtrl1On, onCtrl1Depth, onCtrl1Dest)}
      {ctrlRow('CTRL 2', ctrl2On, ctrl2Depth, ctrl2Dest, onCtrl2On, onCtrl2Depth, onCtrl2Dest)}
      {ctrlRow('CTRL 3', ctrl3On, ctrl3Depth, ctrl3Dest, onCtrl3On, onCtrl3Depth, onCtrl3Dest)}
    </div>
  );
}

/** ANA 2 — MOD / VEL sub-lane under the note grid (fixed piano-roll column width). */
export function AnaArpSubLaneGrid({
  lane,
  levels,
  barLength,
  rateIdx,
  playStep = -1,
  seqActive = false,
  disabled,
  onSetLevel,
}: {
  lane: GenoArpSubLaneId;
  levels: number[];
  barLength: number;
  rateIdx: number;
  playStep?: number;
  seqActive?: boolean;
  disabled?: boolean;
  onSetLevel: (col: number, row: number) => void;
}) {
  const cols = genoArpGridCols(barLength);
  const rows = GENO_ARP_ROWS;
  const bars = genoArpSanitizeBarLength(barLength);
  const colsPerBar = GENO_ARP_STEPS_PER_BAR;
  const laneH = 44;
  const laneLabel = lane === 'mod1' ? 'MOD 1' : lane === 'mod2' ? 'MOD 2' : 'VELOCITY';
  const accent = lane === 'vel' ? ANA.orange : ANA.knobRingHi;
  const { width: gridW } = genoArpGridPixelSize(cols, rows);
  const innerW = GENO_ARP_LABEL_W + gridW;
  const colTemplate = `repeat(${cols}, ${GENO_ARP_CELL_COL_W_PX}px)`;
  const rowTemplate = `repeat(${rows}, ${Math.floor(laneH / rows)}px)`;
  const blockPx = Math.max(4, Math.min(GENO_ARP_NOTE_BLOCK_PX, Math.floor(laneH / rows) - 3));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, width: '100%' }}>
      <div style={{ display: 'flex', gap: 4, minWidth: 0, width: '100%', paddingLeft: 4 }}>
        <div style={{ width: GENO_ARP_LABEL_W, flexShrink: 0 }} aria-hidden />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 7, fontWeight: 800, color: accent, letterSpacing: '0.12em' }}>{laneLabel}</span>
          <span style={{ fontSize: 6, color: ANA.textDim }}>Tap row to set per-step depth</span>
        </div>
      </div>
      <div style={{ overflowX: 'auto', overflowY: 'hidden', maxWidth: '100%' }}>
        <div style={{ width: innerW, minWidth: innerW, display: 'grid', gridTemplateColumns: `${GENO_ARP_LABEL_W}px ${gridW}px` }}>
          <div aria-hidden />
          <div
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: colTemplate,
              gridTemplateRows: rowTemplate,
              width: gridW,
              height: laneH,
              border: `1px solid ${GENO_ARP_PIANO.rowBorder}`,
              background: ANA.bgInset,
            }}
          >
            <GenoArpPianoRollBackdrop rows={rows} cols={cols} bars={bars} colsPerBar={colsPerBar} />
            {Array.from({ length: rows * cols }, (_, idx) => {
              const ri = Math.floor(idx / cols);
              const ci = idx % cols;
              const row = rows - 1 - ri;
              const level = levels[ci] ?? 0;
              const activeRow = genoArpLaneRowForLevel(level);
              const on = activeRow >= 0 && activeRow === row;
              const isPlay = seqActive && playStep === ci;
              return (
                <button
                  key={`${lane}-${row}-${ci}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSetLevel(ci, row)}
                  style={{
                    margin: 0,
                    padding: 0,
                    border: 'none',
                    borderRadius: 0,
                    cursor: disabled ? 'default' : 'pointer',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: GENO_ARP_CELL_COL_W_PX,
                    height: Math.floor(laneH / rows),
                    position: 'relative',
                    zIndex: 1,
                  }}
                  aria-label={`${laneLabel} step ${ci + 1} row ${row + 1}`}
                >
                  {on && (
                    <span
                      style={{
                        width: blockPx,
                        height: blockPx,
                        borderRadius: 2,
                        background: isPlay
                          ? `linear-gradient(180deg, #fff 0%, ${accent} 100%)`
                          : `linear-gradient(180deg, ${accent}cc 0%, ${accent}66 100%)`,
                        boxShadow: isPlay ? `0 0 8px ${accent}` : `inset 0 0 3px ${accent}88`,
                        opacity: disabled ? 0.45 : 1,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Full ARP tab panel — ANA 2 polyphonic step sequencer + live preview. */
export function AnaArpSequencerPanel({
  disabled,
  bpm = 120,
  arpTrackId,
  arpBpm,
  onArpBpmChange,
  basePitch = 60,
  songKeyRoot = 0,
  songKeyMode = 'major',
  getArpVoice,
  patchLabel = '',
  activePresetId = '',
  onLoadPreset,
  onApplyVoice,
  soundPresets = [],
  registerArpMelodyApplier,
  registerArpUserPatternApplier,
  melodyTag,
  activeMelodyLabel = '',
  onPatternSaved,
  getStripOutput,
  ensureAudioContext,
  onArpStep,
  onApplyToPianoRoll,
  genoBuildSources = [],
  genoBuildImportTracks = [],
  beatsPerBar = 4,
  monophonic = true,
  polyphony = 8,
  onMonophonicChange,
  se2SyncLocked = false,
  se2TransportPlaying = false,
  onSe2SyncToggle,
  getSe2PlayheadBeat,
  getSe2TransportOriginBeat,
  keySourceTracks = [],
  keySourceTrackIndex = 0,
  onKeySourceTrackIndexChange,
  onDetectKeyFromSourceTrack,
  followSe2SongKey: followSe2SongKeyProp = true,
  onFollowSe2SongKeyChange,
  getSe2TrackChordImport,
  followSourceTrackChords: followSourceTrackChordsProp = true,
  arpPerformanceGetters,
}: {
  disabled?: boolean;
  /** SE2 session tempo — only used while SYNC SE2 is on. */
  bpm?: number;
  /** Stable track id — each Geno Ultra lane keeps its own local ARP tempo. */
  arpTrackId?: string;
  /** Per-arp / per-track local tempo (never SE2 session BPM). */
  arpBpm?: number;
  onArpBpmChange?: (bpm: number) => void;
  beatsPerBar?: number;
  basePitch?: number;
  /** SE2 project song key — exports transpose into this key. */
  songKeyRoot?: number;
  songKeyMode?: StudioDetectedKeyMode;
  getArpVoice: () => GenoUltraSynthVoiceParams;
  /** Current patch name from Browser — shown on sequencer. */
  patchLabel?: string;
  activePresetId?: string;
  /** Same handler as Browser tab — loads timbre into ARP voice (optional voice overrides). */
  onLoadPreset?: (presetId: string, voicePatch?: Partial<GenoUltraSynthVoiceParams>) => void;
  /** Apply a full edited voice (user saves + pattern recall). */
  onApplyVoice?: (voice: GenoUltraSynthVoiceParams) => void;
  soundPresets?: readonly { id: string; label: string; category: string }[];
  /** Parent registers one-shot melody loader (avoids effect loop on preset apply). */
  registerArpMelodyApplier?: (fn: (melodyId: string) => void) => void;
  /** Parent registers loader for user-saved patterns (Browser ARP Melodies). */
  registerArpUserPatternApplier?: (fn: (patternId: string) => void) => void;
  /** ARP Melodies category the user is working in (pattern saves land here). */
  melodyTag?: GenoUltraArpMelodyTag;
  /** Active factory melody name — default rename seed for Save Pattern. */
  activeMelodyLabel?: string;
  /** Fired after a pattern is saved so the Browser can list it under its melody category. */
  onPatternSaved?: (entry: GenoUltraArpSavedPattern) => void;
  getStripOutput?: (ctx: AudioContext) => AudioNode;
  ensureAudioContext?: () => Promise<AudioContext>;
  onArpStep?: (step: number, pitch: number | null, gateSec: number) => void;
  /** SE2 — stamp flattened ARP into the track piano roll. */
  onApplyToPianoRoll?: (notes: readonly GenoUltraArpSe2RollNote[]) => void;
  /** Synth Geno lanes — Geno Build 1 / 2 chord loops ready to pull in. */
  genoBuildSources?: readonly GenoUltraGenoBuildChordSource[];
  /** Full Synth Geno track list for resolving Geno Build imports. */
  genoBuildImportTracks?: readonly GenoBuildTrackRef[];
  /** Keyboard / preview voice mode — mono replaces notes; poly stacks up to polyphony. */
  monophonic?: boolean;
  polyphony?: number;
  onMonophonicChange?: (mono: boolean) => void;
  /** SE2 — when locked, ARP preview follows main transport play/stop and BPM. */
  se2SyncLocked?: boolean;
  se2TransportPlaying?: boolean;
  onSe2SyncToggle?: () => void;
  /** SE2 playhead beat — phase-locks ARP when SYNC SE2 is on. */
  getSe2PlayheadBeat?: () => number;
  getSe2TransportOriginBeat?: () => number;
  /** SE2 lanes available as arp key source. */
  keySourceTracks?: readonly import('@/app/lib/studio/genoUltraArpKeySource').GenoUltraArpKeySourceTrack[];
  keySourceTrackIndex?: number;
  onKeySourceTrackIndexChange?: (trackIndex: number) => void;
  /** Detect key from the chosen SE2 lane and apply to arp harmony. */
  onDetectKeyFromSourceTrack?: (trackIndex: number) => boolean | void;
  followSe2SongKey?: boolean;
  onFollowSe2SongKeyChange?: (linked: boolean) => void;
  /** SE2 — build chord timeline from any lane (Progression+, rhythm, chord MIDI). */
  getSe2TrackChordImport?: (
    trackIndex: number,
    barLength: GenoArpBarLength,
  ) =>
    | import('@/app/lib/studio/genoUltraArpChordImport').GenoUltraArpChordImportResult
    | import('@/app/lib/studio/genoUltraArpChordImport').GenoUltraArpChordImportError;
  /** Auto-detect + lock chords when the source track dropdown changes. */
  followSourceTrackChords?: boolean;
  /** Footer MONO / LEGATO / SLIDE — live refs for arp preview. */
  arpPerformanceGetters?: import('@/app/lib/studio/genoUltraArpPerformance').GenoUltraArpPerformanceGetters;
}) {
  const {
    gateLevels,
    setGateLevels,
    gateFxOn,
    gateFxDepth,
    gateFxAttackMs,
    gateFxReleaseMs,
    pumperOn,
    pumperRate,
    pumperDepth,
    pumperAttackMs,
    pumperReleaseMs,
    pumperHighFilter,
    pumperLowFilter,
    resetGateFx,
    applyGateFxSnapshot,
  } = useGenoUltraArpGateFx();
  const gateFxPreviewGetters = useGenoUltraArpGateFxPreviewGetters();
  const arpPerformanceGettersRef = useRef(arpPerformanceGetters);
  arpPerformanceGettersRef.current = arpPerformanceGetters;
  const [arpOn, setArpOn] = useState(false);
  const arpOnRef = useRef(false);
  arpOnRef.current = arpOn;
  const se2SyncLockedRef = useRef(se2SyncLocked);
  se2SyncLockedRef.current = se2SyncLocked;
  const se2TransportPlayingRef = useRef(se2TransportPlaying);
  se2TransportPlayingRef.current = se2TransportPlaying;
  const getSe2PlayheadBeatRef = useRef(getSe2PlayheadBeat);
  getSe2PlayheadBeatRef.current = getSe2PlayheadBeat;
  const getSe2TransportOriginBeatRef = useRef(getSe2TransportOriginBeat);
  getSe2TransportOriginBeatRef.current = getSe2TransportOriginBeat;
  /**
   * Standalone ARP tempo — owned by this arp/track.
   * Never seeded from SE2 session `bpm`. Never force every track to 120.
   */
  const [localArpBpm, setLocalArpBpmState] = useState(() => {
    const stored =
      arpTrackId != null
        ? getGenoUltraArpBpmForTrack(arpTrackId, arpBpm)
        : typeof arpBpm === 'number'
          ? clampGenoUltraArpBpm(arpBpm)
          : undefined;
    return genoUltraArpBpmOrDefault(stored);
  });
  const onArpBpmChangeRef = useRef(onArpBpmChange);
  onArpBpmChangeRef.current = onArpBpmChange;
  const arpTrackIdRef = useRef(arpTrackId);
  arpTrackIdRef.current = arpTrackId;
  const setLocalArpBpm = useCallback((v: number) => {
    const next = clampGenoUltraArpBpm(v);
    setLocalArpBpmState(next);
    const id = arpTrackIdRef.current;
    if (id) setGenoUltraArpBpmForTrack(id, next);
    onArpBpmChangeRef.current?.(next);
  }, []);
  const effectiveArpBpm = se2SyncLocked ? clampGenoUltraArpBpm(bpm) : localArpBpm;
  const arpLoopDrive = se2SyncLocked ? se2TransportPlaying : arpOn;
  const arpLoopDriveRef = useRef(arpLoopDrive);
  arpLoopDriveRef.current = arpLoopDrive;
  const arpLoopSessionRef = useRef(0);
  const [presetLock, setPresetLock] = useState(false);
  const [octShift, setOctShift] = useState<GenoArpGlobalOctShift>(0);
  const [barOctShifts, setBarOctShifts] = useState<GenoArpBarOctShift[]>(() => emptyGenoArpBarOctShifts());
  const [barLength, setBarLength] = useState<GenoArpBarLength>(4);
  const [rateIdx, setRateIdx] = useState(1);
  const [orderIdx, setOrderIdx] = useState(2);
  const [arpVariation, setArpVariation] = useState<GenoArpVariation>(0);
  const [octRange, setOctRange] = useState<GenoArpOctRange>(1);
  const [orderInversion, setOrderInversion] = useState(false);
  const [gate, setGate] = useState(0.82);
  const [swing, setSwing] = useState(0.12);
  const [modDepth, setModDepth] = useState(0.35);
  const [modRate, setModRate] = useState(0.5);
  const [grid, setGrid] = useState(() => defaultArpGrid());
  const [mod1Levels, setMod1Levels] = useState(() => blankGenoArpStepSequencer().mod1Levels);
  const [mod2Levels, setMod2Levels] = useState(() => blankGenoArpStepSequencer().mod2Levels);
  const [mod3Levels, setMod3Levels] = useState(() => blankGenoArpStepSequencer().mod3Levels);
  const [velLevels, setVelLevels] = useState(() => blankGenoArpStepSequencer().velLevels);
  /** Retrologue CTRL lane enable / depth / destination — off until user sets up. */
  const [ctrl1On, setCtrl1On] = useState(false);
  const [ctrl2On, setCtrl2On] = useState(false);
  const [ctrl3On, setCtrl3On] = useState(false);
  const [ctrl1Depth, setCtrl1Depth] = useState(0.5);
  const [ctrl2Depth, setCtrl2Depth] = useState(0.5);
  const [ctrl3Depth, setCtrl3Depth] = useState(0.5);
  const [ctrl1Dest, setCtrl1Dest] = useState<GenoArpCtrlDest>('filterCutoff');
  const [ctrl2Dest, setCtrl2Dest] = useState<GenoArpCtrlDest>('filterRes');
  const [ctrl3Dest, setCtrl3Dest] = useState<GenoArpCtrlDest>('ampLevel');
  /** Blank STEP / HITS — user programs like Retrologue init. */
  const [stepMask, setStepMask] = useState(() => blankGenoArpStepSequencer().stepMask);
  const [stepHits, setStepHits] = useState(() => blankGenoArpStepSequencer().stepHits);
  const [phraseSteps, setPhraseSteps] = useState(16);
  const [stepRegenRandom, setStepRegenRandom] = useState(false);
  const [subLane, setSubLane] = useState<GenoArpSubLaneId>('mod1');
  const [playStep, setPlayStep] = useState(-1);
  const playStepUiRef = useRef(-1);
  const playStepRafRef = useRef(0);
  const queuePlayStepUi = useCallback((step: number) => {
    playStepUiRef.current = step;
    if (playStepRafRef.current) return;
    playStepRafRef.current = requestAnimationFrame(() => {
      playStepRafRef.current = 0;
      setPlayStep(playStepUiRef.current);
    });
  }, []);
  const [seqRunning, setSeqRunning] = useState(false);
  const [stylePresetId, setStylePresetId] = useState('');
  const [randSeed, setRandSeed] = useState(() => Math.floor(Math.random() * 99999));
  const [chordTimeline, setChordTimeline] = useState<GenoUltraArpChordSegment[] | undefined>();
  const [chordLocked, setChordLocked] = useState(false);
  const [preserveImportedVoicing, setPreserveImportedVoicing] = useState(false);
  const preserveImportedVoicingRef = useRef(preserveImportedVoicing);
  preserveImportedVoicingRef.current = preserveImportedVoicing;
  const [chordLabel, setChordLabel] = useState('');
  const [keyRoot, setKeyRoot] = useState(basePitch);
  const [keyMode, setKeyMode] = useState<StudioDetectedKeyMode>('major');
  const [arpScaleId, setArpScaleId] = useState<NeuralHumScaleId>(() => genoArpScaleIdFromKeyMode(songKeyMode));
  const [arpChordType, setArpChordType] = useState<GenoArpChordType>('maj');
  const [cardPresetId, setCardPresetId] = useState('');
  const [genoBuildSourceId, setGenoBuildSourceId] = useState('');
  const [importHint, setImportHint] = useState('');
  const [userSaveRev, setUserSaveRev] = useState(0);
  const [loadUserSaveId, setLoadUserSaveId] = useState('');
  const [saveDialogMode, setSaveDialogMode] = useState<'pattern' | 'soundAndPattern' | null>(null);
  const [savePatternNameDraft, setSavePatternNameDraft] = useState('');
  const [drawNoteMode, setDrawNoteMode] = useState(false);
  const [drawInKeyMode, setDrawInKeyMode] = useState(false);
  const [selectedBar, setSelectedBar] = useState<number | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<GenoArpGridCellKey>>(() => new Set());
  const savePatternNameInputRef = useRef<HTMLInputElement>(null);
  const midiInputRef = useRef<HTMLInputElement>(null);
  const cardOptions = useMemo(() => genoUltraArpAllCardOptions(), []);
  const savedSounds = useMemo(() => listGenoUltraArpSavedSounds(), [userSaveRev]);
  const savedPatternsOnly = useMemo(() => listGenoUltraArpSavedPatternsOnly(), [userSaveRev]);
  const savedSoundAndPatterns = useMemo(() => listGenoUltraArpSavedSoundAndPatterns(), [userSaveRev]);

  const gridRef = useRef(grid);
  gridRef.current = grid;
  const mod1Ref = useRef(mod1Levels);
  mod1Ref.current = mod1Levels;
  const mod2Ref = useRef(mod2Levels);
  mod2Ref.current = mod2Levels;
  const mod3Ref = useRef(mod3Levels);
  mod3Ref.current = mod3Levels;
  const ctrl1OnRef = useRef(ctrl1On);
  ctrl1OnRef.current = ctrl1On;
  const ctrl2OnRef = useRef(ctrl2On);
  ctrl2OnRef.current = ctrl2On;
  const ctrl3OnRef = useRef(ctrl3On);
  ctrl3OnRef.current = ctrl3On;
  const ctrl1DepthRef = useRef(ctrl1Depth);
  ctrl1DepthRef.current = ctrl1Depth;
  const ctrl2DepthRef = useRef(ctrl2Depth);
  ctrl2DepthRef.current = ctrl2Depth;
  const ctrl3DepthRef = useRef(ctrl3Depth);
  ctrl3DepthRef.current = ctrl3Depth;
  const ctrl1DestRef = useRef(ctrl1Dest);
  ctrl1DestRef.current = ctrl1Dest;
  const ctrl2DestRef = useRef(ctrl2Dest);
  ctrl2DestRef.current = ctrl2Dest;
  const ctrl3DestRef = useRef(ctrl3Dest);
  ctrl3DestRef.current = ctrl3Dest;
  const velRef = useRef(velLevels);
  velRef.current = velLevels;
  const stepMaskRef = useRef(stepMask);
  stepMaskRef.current = stepMask;
  const stepHitsRef = useRef(stepHits);
  stepHitsRef.current = stepHits;
  const phraseStepsRef = useRef(phraseSteps);
  phraseStepsRef.current = phraseSteps;
  const onArpStepRef = useRef(onArpStep);
  onArpStepRef.current = onArpStep;
  const basePitchRef = useRef(basePitch);
  basePitchRef.current = basePitch;
  const [followSe2SongKey, setFollowSe2SongKey] = useState(followSe2SongKeyProp);
  useEffect(() => {
    setFollowSe2SongKey(followSe2SongKeyProp);
  }, [followSe2SongKeyProp]);

  const [followSourceTrackChords, setFollowSourceTrackChords] = useState(followSourceTrackChordsProp);
  useEffect(() => {
    setFollowSourceTrackChords(followSourceTrackChordsProp);
  }, [followSourceTrackChordsProp]);

  const toggleFollowSe2SongKey = useCallback(() => {
    setFollowSe2SongKey((prev) => {
      const next = !prev;
      onFollowSe2SongKeyChange?.(next);
      return next;
    });
  }, [onFollowSe2SongKeyChange]);

  const songKeyRef = useRef<GenoUltraArpSongKey>({ keyRoot: songKeyRoot, keyMode: songKeyMode });
  songKeyRef.current = { keyRoot: songKeyRoot, keyMode: songKeyMode };
  const keyPitchClass = ((Math.round(keyRoot) % 12) + 12) % 12;
  const setKeyPitchClass = useCallback((pc: number) => {
    const octave = Math.floor(keyRoot / 12);
    setKeyRoot(Math.max(36, Math.min(84, octave * 12 + pc)));
  }, [keyRoot]);
  const chordTimelineRef = useRef(chordTimeline);
  chordTimelineRef.current = chordTimeline;
  const chordLockedRef = useRef(chordLocked);
  chordLockedRef.current = chordLocked;
  useEffect(() => {
    if (!followSe2SongKey) return;
    if (chordTimeline?.length && chordLocked) return;
    setKeyRoot((prev) => studioMidiRootFromSongKey(songKeyRoot, prev));
    setKeyMode(songKeyMode);
    setArpScaleId(genoArpScaleIdFromKeyMode(songKeyMode));
  }, [songKeyRoot, songKeyMode, followSe2SongKey, chordTimeline?.length, chordLocked]);
  const arpScaleIdRef = useRef(arpScaleId);
  arpScaleIdRef.current = arpScaleId;
  const arpChordTypeRef = useRef(arpChordType);
  arpChordTypeRef.current = arpChordType;
  const keyRootHarmonyRef = useRef(keyRoot);
  keyRootHarmonyRef.current = keyRoot;
  const octShiftRef = useRef(octShift);
  octShiftRef.current = octShift;
  const barOctShiftsRef = useRef(barOctShifts);
  barOctShiftsRef.current = barOctShifts;
  const arpVariationRef = useRef(arpVariation);
  arpVariationRef.current = arpVariation;
  const octRangeRef = useRef(octRange);
  octRangeRef.current = octRange;
  const orderInversionRef = useRef(orderInversion);
  orderInversionRef.current = orderInversion;
  const displayColsRef = useRef(genoArpGridCols(barLength));
  displayColsRef.current = genoArpGridCols(barLength);
  const displayCols = genoArpGridCols(barLength);

  const drawInKeyOpts = useMemo<GenoArpDrawInKeyOpts>(
    () => ({
      basePitch,
      globalOctShift: octShift,
      barOctShifts,
      barLength,
      harmony: {
        keyRoot,
        scaleId: arpScaleId,
        chordType: arpChordType,
        chordTimeline,
        preserveImportedVoicing,
      },
    }),
    [
      basePitch,
      octShift,
      barOctShifts,
      barLength,
      keyRoot,
      arpScaleId,
      arpChordType,
      chordTimeline,
      preserveImportedVoicing,
    ],
  );

  const isCellInKey = useCallback(
    (storedRow: number, col: number) => genoArpStoredRowIsInKey(drawInKeyOpts, storedRow, col),
    [drawInKeyOpts],
  );

  const order = GENO_ARP_ORDERS[orderIdx] ?? 'UP/DN';
  const rateLabel = GENO_ARP_RATE_LABELS[rateIdx] ?? '1/16';

  const regenPattern = useCallback(
    (seedOverride?: number) => {
      const seed = order === 'RAND' ? (seedOverride ?? randSeed) : 0;
      setGrid(
        buildGenoArpGridPattern({
          barLength,
          order,
          octShift,
          randSeed: seed,
          variation: arpVariation,
        }),
      );
    },
    [barLength, order, octShift, randSeed, arpVariation],
  );

  /** Retrologue init — blank STEP / HITS / VEL / CTRL (user programs them). */
  const applyBlankStepSequencer = useCallback((phrase = 16) => {
    const blank = blankGenoArpStepSequencer(phrase);
    setStepMask(blank.stepMask);
    setStepHits(blank.stepHits);
    setVelLevels(blank.velLevels);
    setMod1Levels(blank.mod1Levels);
    setMod2Levels(blank.mod2Levels);
    setMod3Levels(blank.mod3Levels);
    resetGateFx();
    setCtrl1On(false);
    setCtrl2On(false);
    setCtrl3On(false);
    setCtrl1Depth(0.5);
    setCtrl2Depth(0.5);
    setCtrl3Depth(0.5);
    setCtrl1Dest('filterCutoff');
    setCtrl2Dest('filterRes');
    setCtrl3Dest('ampLevel');
    setPhraseSteps(blank.phraseSteps);
  }, [resetGateFx]);

  const regenerateMelodyFromChords = useCallback(
    (seedOverride?: number) => {
      const timeline = chordTimelineRef.current;
      if (!timeline?.length) return;
      const nextSeed = seedOverride ?? Math.floor(Math.random() * 99999);
      const cols = genoArpGridCols(barLengthRef.current);
      const harmony = {
        keyRoot: keyRootHarmonyRef.current,
        scaleId: arpScaleIdRef.current,
        chordType: arpChordTypeRef.current,
        chordTimeline: timeline,
        preserveImportedVoicing: preserveImportedVoicingRef.current,
      };
      setGrid(
        buildGenoArpMelodyFromChordTimeline({
          barLength: barLengthRef.current,
          order,
          variation: arpVariationRef.current,
          randSeed: order === 'RAND' ? nextSeed : randSeed,
          melodySeed: nextSeed,
          chordTimeline: timeline,
          harmony,
        }),
      );
      applyBlankStepSequencer(cols);
      setPresetLock(true);
      setStylePresetId('');
      setImportHint(`Melody · ${timeline.length} chords · in key`);
    },
    [order, randSeed, applyBlankStepSequencer],
  );

  const rerollRandom = useCallback(() => {
    const next = Math.floor(Math.random() * 99999);
    setRandSeed(next);
    setGrid(buildGenoArpGridPattern({ barLength, order: 'RAND', octShift, randSeed: next, variation: arpVariation }));
  }, [barLength, octShift, arpVariation]);

  const toggleCell = useCallback(
    (row: number, col: number) => {
      setPresetLock(true);
      setStylePresetId('');
      setGrid((prev) => {
        const turningOn = !prev[row]?.[col];
        if (
          turningOn &&
          drawInKeyMode &&
          !genoArpCanPaintStoredRowInKey(drawInKeyOpts, row, col)
        ) {
          return prev;
        }
        const next = prev.map((r) => [...r]);
        next[row]![col] = !next[row]![col];
        return next;
      });
    },
    [drawInKeyMode, drawInKeyOpts],
  );

  const paintCell = useCallback(
    (row: number, col: number, on: boolean) => {
      if (on && drawInKeyMode && !genoArpCanPaintStoredRowInKey(drawInKeyOpts, row, col)) {
        return;
      }
      setPresetLock(true);
      setStylePresetId('');
      setGrid((prev) => {
        const next = prev.map((r) => [...r]);
        if (on) {
          for (let r = 0; r < GENO_ARP_ROWS; r += 1) {
            next[r]![col] = r === row;
          }
        } else {
          next[row]![col] = false;
        }
        return next;
      });
    },
    [drawInKeyMode, drawInKeyOpts],
  );

  const selectBarForDuplicate = useCallback((barIndex: number) => {
    setSelectedBar(barIndex);
    setSelectedCells(new Set());
    setImportHint(`BAR ${barIndex + 1} selected — DUP → copies to BAR ${barIndex + 2}`);
  }, []);

  const toggleSelectCell = useCallback((row: number, col: number) => {
    setSelectedBar(null);
    setSelectedCells((prev) => {
      const key = genoArpGridCellKey(row, col);
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const duplicateToNextBar = useCallback(() => {
    const cols = gridRef.current[0]?.length ?? genoArpGridCols(barLength);
    const totalBars = Math.max(1, Math.floor(cols / GENO_ARP_STEPS_PER_BAR));

    let sourceBar = selectedBar;
    const cells = selectedCells;

    if (cells.size > 0) {
      const barSet = new Set<number>();
      cells.forEach((key) => {
        const comma = key.indexOf(',');
        if (comma < 0) return;
        const col = Number(key.slice(comma + 1));
        if (Number.isFinite(col)) barSet.add(genoArpGridColToBarIndex(col));
      });
      if (barSet.size === 0) {
        setImportHint('Shift+click notes to select, then Duplicate');
        return;
      }
      if (barSet.size > 1) {
        setImportHint('Selection spans multiple bars — pick one bar');
        return;
      }
      sourceBar = [...barSet][0]!;
    }

    if (sourceBar == null) {
      setImportHint('Click BAR or Shift+click notes, then Duplicate');
      return;
    }
    if (sourceBar + 1 >= totalBars) {
      setImportHint('No next bar');
      return;
    }

    const nextGrid = duplicateGenoArpSelectionToNextBar(gridRef.current, {
      sourceBar,
      selectedCells: cells.size > 0 ? cells : undefined,
    });
    if (!nextGrid) {
      setImportHint('No next bar');
      return;
    }

    setPresetLock(true);
    setStylePresetId('');
    setGrid(nextGrid);
    setSelectedBar(sourceBar + 1);
    setSelectedCells(new Set());
    setImportHint(`Duplicated BAR ${sourceBar + 1} → BAR ${sourceBar + 2}`);
  }, [barLength, selectedBar, selectedCells]);

  const canDuplicateToNextBar = useMemo(() => {
    const cols = grid[0]?.length ?? genoArpGridCols(barLength);
    const totalBars = Math.max(1, Math.floor(cols / GENO_ARP_STEPS_PER_BAR));
    let sourceBar = selectedBar;
    if (selectedCells.size > 0) {
      const barSet = new Set<number>();
      selectedCells.forEach((key) => {
        const comma = key.indexOf(',');
        if (comma < 0) return;
        const col = Number(key.slice(comma + 1));
        if (Number.isFinite(col)) barSet.add(genoArpGridColToBarIndex(col));
      });
      if (barSet.size !== 1) return false;
      sourceBar = [...barSet][0]!;
    }
    return sourceBar != null && sourceBar + 1 < totalBars;
  }, [barLength, grid, selectedBar, selectedCells]);

  useEffect(() => {
    if (presetLock) return;
    if (chordLockedRef.current && chordTimelineRef.current?.length) return;
    regenPattern();
  }, [presetLock, regenPattern]);

  useEffect(() => {
    if (!chordLocked || !chordTimelineRef.current?.length) return;
    if (preserveImportedVoicing) return;
    setChordTimeline((prev) =>
      prev?.map((seg) =>
        genoArpRevoiceSegment(seg, {
          keyRoot,
          scaleId: arpScaleId,
          chordType: arpChordType,
        }),
      ),
    );
  }, [chordLocked, keyRoot, arpScaleId, arpChordType, preserveImportedVoicing]);

  const getArpVoiceRef = useRef(getArpVoice);
  getArpVoiceRef.current = getArpVoice;

  const handleSoundPresetChange = useCallback(
    (presetId: string) => {
      if (!presetId || !onLoadPreset) return;
      onLoadPreset(presetId);
      applyBlankStepSequencer(phraseStepsRef.current);
    },
    [onLoadPreset, applyBlankStepSequencer],
  );

  useEffect(() => {
    if (!activePresetId) return;
    if (isGenoUltraArpPreviewRunning()) return;
    stopGenoUltraArpPreviewVoices();
  }, [activePresetId]);
  const ensureAudioContextRef = useRef(ensureAudioContext);
  ensureAudioContextRef.current = ensureAudioContext;
  const getStripOutputRef = useRef(getStripOutput);
  getStripOutputRef.current = getStripOutput;
  const bpmRef = useRef(effectiveArpBpm);
  bpmRef.current = effectiveArpBpm;

  /** Track switch — load that lane's stored local tempo only (never SE2 session BPM, never blanket 120). */
  const prevArpTrackIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (arpTrackId == null) return;
    const stored = getGenoUltraArpBpmForTrack(arpTrackId, arpBpm);
    const trackChanged = prevArpTrackIdRef.current !== arpTrackId;
    prevArpTrackIdRef.current = arpTrackId;
    if (stored != null) {
      setLocalArpBpmState(stored);
      return;
    }
    // Only seed default when entering a lane that has never had a tempo saved.
    if (trackChanged) setLocalArpBpmState(GENO_ULTRA_ARP_DEFAULT_BPM);
  }, [arpTrackId, arpBpm]);
  const barLengthRef = useRef(barLength);
  barLengthRef.current = barLength;
  const rateIdxRef = useRef(rateIdx);
  rateIdxRef.current = rateIdx;
  const gateRef = useRef(gate);
  gateRef.current = gate;
  const swingRef = useRef(swing);
  swingRef.current = swing;
  const modDepthRef = useRef(modDepth);
  modDepthRef.current = modDepth;
  const modRateRef = useRef(modRate);
  modRateRef.current = modRate;

  const currentSnapshot = useCallback(
    () =>
      buildGenoUltraArpSnapshot({
        grid: gridRef.current,
        barLength,
        rateIdx,
        gate,
        swing,
        bpm: localArpBpm,
        octShift,
        barOctShifts,
        mod1Levels,
        mod2Levels,
        mod3Levels,
        velLevels,
        gateLevels,
        ctrl1On,
        ctrl2On,
        ctrl3On,
        gateFxOn,
        gateFxDepth,
        gateFxAttackMs,
        gateFxReleaseMs,
        pumperOn,
        pumperRate,
        pumperDepth,
        pumperAttackMs,
        pumperReleaseMs,
        pumperHighFilter,
        pumperLowFilter,
        ctrl1Dest,
        ctrl2Dest,
        ctrl3Dest,
        ctrl1Depth,
        ctrl2Depth,
        ctrl3Depth,
        stepMask,
        stepHits,
        phraseSteps,
        basePitch: basePitchRef.current,
        keyRoot,
        keyMode,
        arpScaleId,
        arpChordType,
        chordLabel: chordLabel || undefined,
        stylePresetId: stylePresetId || undefined,
        chordTimeline,
        arpVariation,
        octRange,
        orderInversion,
      }),
    [
      barLength,
      rateIdx,
      gate,
      swing,
      localArpBpm,
      octShift,
      barOctShifts,
      mod1Levels,
      mod2Levels,
      mod3Levels,
      velLevels,
      gateLevels,
      ctrl1On,
      ctrl2On,
      ctrl3On,
      gateFxOn,
      gateFxDepth,
      gateFxAttackMs,
      gateFxReleaseMs,
      pumperOn,
      pumperRate,
      pumperDepth,
      pumperAttackMs,
      pumperReleaseMs,
      pumperHighFilter,
      pumperLowFilter,
      ctrl1Dest,
      ctrl2Dest,
      ctrl3Dest,
      ctrl1Depth,
      ctrl2Depth,
      ctrl3Depth,
      stepMask,
      stepHits,
      phraseSteps,
      keyRoot,
      keyMode,
      arpScaleId,
      arpChordType,
      chordLabel,
      stylePresetId,
      chordTimeline,
      arpVariation,
      octRange,
      orderInversion,
    ],
  );

  const handleSaveSound = useCallback(() => {
    const name = window.prompt('Save sound as…', patchLabel || 'My Sound');
    if (name == null) return;
    const entry = saveGenoUltraArpSound(name, getArpVoiceRef.current());
    setUserSaveRev((n) => n + 1);
    setImportHint(`Saved sound · ${entry.name}`);
  }, [patchLabel]);

  const applySavedPattern = useCallback(
    (saved: GenoUltraArpSavedPattern | undefined) => {
      if (!saved) return;
      const snap = saved.snapshot;
      setGrid(snap.grid.map((r) => [...r]));
      setBarLength(snap.barLength);
      setRateIdx(snap.rateIdx);
      setGate(snap.gate);
      setSwing(snap.swing);
      if (snap.bpm != null) setLocalArpBpm(clampGenoUltraArpBpm(snap.bpm));
      setOctShift(snap.octShift);
      setBarOctShifts([...snap.barOctShifts]);
      /** Only restore step-seq if the user saved it; otherwise stay blank. */
      if (snap.stepMask || snap.stepHits || snap.mod3Levels != null || snap.ctrl1On != null) {
        setMod1Levels([...snap.mod1Levels]);
        setMod2Levels([...snap.mod2Levels]);
        setMod3Levels(snap.mod3Levels ? [...snap.mod3Levels] : emptyGenoArpLaneLevels(0));
        setVelLevels([...snap.velLevels]);
        setCtrl1On(snap.ctrl1On === true);
        setCtrl2On(snap.ctrl2On === true);
        setCtrl3On(snap.ctrl3On === true);
        setCtrl1Dest((snap.ctrl1Dest as GenoArpCtrlDest) || 'filterCutoff');
        setCtrl2Dest((snap.ctrl2Dest as GenoArpCtrlDest) || 'filterRes');
        setCtrl3Dest((snap.ctrl3Dest as GenoArpCtrlDest) || 'ampLevel');
        setCtrl1Depth(snap.ctrl1Depth ?? 0.5);
        setCtrl2Depth(snap.ctrl2Depth ?? 0.5);
        setCtrl3Depth(snap.ctrl3Depth ?? 0.5);
        applyGateFxSnapshot({
          gateLevels: snap.gateLevels,
          gateFxOn: snap.gateFxOn,
          gateFxDepth: snap.gateFxDepth,
          gateFxAttackMs: snap.gateFxAttackMs,
          gateFxReleaseMs: snap.gateFxReleaseMs,
          pumperOn: snap.pumperOn,
          pumperRate: snap.pumperRate as import('@/app/lib/studio/genoUltraArpPumper').GenoArpPumperRateIdx | undefined,
          pumperDepth: snap.pumperDepth,
          pumperAttackMs: snap.pumperAttackMs,
          pumperReleaseMs: snap.pumperReleaseMs,
          pumperHighFilter: snap.pumperHighFilter,
          pumperLowFilter: snap.pumperLowFilter,
        });
        setStepMask(snap.stepMask ? [...snap.stepMask] : emptyGenoArpStepMask(false));
        setStepHits(
          snap.stepHits
            ? snap.stepHits.map((h) => genoArpSanitizeStepHits(h))
            : emptyGenoArpStepHits(0),
        );
        setPhraseSteps(
          genoArpSanitizePhraseSteps(
            snap.phraseSteps ?? genoArpGridCols(snap.barLength),
            genoArpGridCols(snap.barLength),
          ),
        );
      } else {
        applyBlankStepSequencer(genoArpGridCols(snap.barLength));
      }
      setKeyRoot(snap.keyRoot);
      setKeyMode(snap.keyMode);
      setArpScaleId(snap.arpScaleId ?? genoArpScaleIdFromKeyMode(snap.keyMode));
      setArpChordType(snap.arpChordType ?? 'maj');
      setChordLabel(snap.chordLabel ?? '');
      setStylePresetId(snap.stylePresetId ?? '');
      setChordTimeline(
        snap.chordTimeline?.map((s) => ({ ...s, pitches: [...s.pitches] })),
      );
      setChordLocked(!!snap.chordTimeline?.length);
      setOrderIdx(saved.orderIdx);
      setArpVariation(saved.snapshot.arpVariation ?? 0);
      setOctRange(saved.snapshot.octRange ?? 1);
      setOrderInversion(!!saved.snapshot.orderInversion);
      setModDepth(saved.modDepth);
      setModRate(saved.modRate);
      setRandSeed(saved.randSeed);
      setPresetLock(saved.presetLock);
      setCardPresetId(saved.cardPresetId);
      stopGenoUltraArpPreviewVoices();
      if (!saved.patternOnly) {
        onApplyVoice?.(saved.voice);
      }
      setImportHint(
        saved.patternOnly
          ? `Loaded pattern only · ${saved.name}${snap.bpm != null ? ` · ${clampGenoUltraArpBpm(snap.bpm)} BPM` : ''}`
          : `Loaded sound + pattern · ${saved.name}${snap.bpm != null ? ` · ${clampGenoUltraArpBpm(snap.bpm)} BPM` : ''}`,
      );
    },
    [onApplyVoice, setLocalArpBpm, applyBlankStepSequencer],
  );

  const handleSavePattern = useCallback(() => {
    const seed = (activeMelodyLabel || patchLabel || 'My Pattern').trim().slice(0, 48) || 'My Pattern';
    setSavePatternNameDraft(seed);
    setSaveDialogMode('pattern');
    queueMicrotask(() => {
      const el = savePatternNameInputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
  }, [activeMelodyLabel, patchLabel]);

  const handleSaveSoundAndPattern = useCallback(() => {
    const seed = (activeMelodyLabel || patchLabel || 'My Melody').trim().slice(0, 48) || 'My Melody';
    setSavePatternNameDraft(seed);
    setSaveDialogMode('soundAndPattern');
    queueMicrotask(() => {
      const el = savePatternNameInputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
  }, [activeMelodyLabel, patchLabel]);

  const confirmSaveDialog = useCallback(() => {
    const name = savePatternNameDraft.trim().slice(0, 48) || 'My Pattern';
    const soundAndPattern = saveDialogMode === 'soundAndPattern';
    const entry = saveGenoUltraArpPattern(name, getArpVoiceRef.current(), {
      snapshot: currentSnapshot(),
      orderIdx,
      modDepth,
      modRate,
      randSeed,
      presetLock,
      cardPresetId,
      melodyTag: soundAndPattern ? melodyTag : undefined,
      patternOnly: !soundAndPattern,
    });
    setSaveDialogMode(null);
    setUserSaveRev((n) => n + 1);
    if (soundAndPattern) {
      const folderHint = entry.melodyTag ? ` · ${entry.melodyTag} melodies` : ' · My Melodies';
      setImportHint(`Saved sound + pattern · ${entry.name}${folderHint}`);
      onPatternSaved?.(entry);
    } else {
      setImportHint(`Saved pattern only · ${entry.name}`);
    }
  }, [
    saveDialogMode,
    savePatternNameDraft,
    currentSnapshot,
    orderIdx,
    modDepth,
    modRate,
    randSeed,
    presetLock,
    cardPresetId,
    melodyTag,
    onPatternSaved,
  ]);

  const cancelSaveDialog = useCallback(() => {
    setSaveDialogMode(null);
  }, []);

  const handleLoadUserSave = useCallback(
    (token: string) => {
      setLoadUserSaveId(token);
      if (!token) return;
      if (token.startsWith('sound:')) {
        const sound = getGenoUltraArpSavedSound(token.slice(6));
        if (!sound) {
          setImportHint('Saved sound not found');
          return;
        }
        stopGenoUltraArpPreviewVoices();
        onApplyVoice?.(sound.voice);
        setImportHint(`Loaded sound · ${sound.name}`);
        return;
      }
      if (token.startsWith('pattern:')) {
        applySavedPattern(getGenoUltraArpSavedPattern(token.slice(8)));
      }
      queueMicrotask(() => setLoadUserSaveId(''));
    },
    [applySavedPattern, onApplyVoice],
  );

  const applyChordImport = useCallback(
    (result: {
      chordTimeline: GenoUltraArpChordSegment[];
      barLength: GenoArpBarLength;
      chordLabel: string;
      keyRoot: number;
      keyMode: StudioDetectedKeyMode;
      basePitch: number;
      bpm: number;
      importSource: 'midi' | 'card' | 'genoBuild' | 'se2Track';
    }) => {
      setChordTimeline(result.chordTimeline.map((s) => ({ ...s, pitches: [...s.pitches] })));
      setChordLabel(result.chordLabel);
      setKeyRoot(result.basePitch);
      setKeyMode(result.keyMode);
      setArpScaleId(genoArpScaleIdFromKeyMode(result.keyMode));
      setBarLength(result.barLength);
      setChordLocked(true);
      setPreserveImportedVoicing(
        result.importSource === 'se2Track' || result.importSource === 'genoBuild',
      );
      setPresetLock(true);
      // Import tempo is this arp's local BPM — do not adopt SE2 session tempo.
      if (!se2SyncLockedRef.current) {
        setLocalArpBpm(clampGenoUltraArpBpm(result.bpm));
      }
      const src =
        result.importSource === 'midi'
          ? 'MIDI'
          : result.importSource === 'genoBuild'
            ? 'GENO BUILD'
            : result.importSource === 'se2Track'
              ? 'SE2 TRACK'
              : 'CARD';
      setImportHint(`${src} · ${result.chordTimeline.length} chords · ${clampGenoUltraArpBpm(result.bpm)} BPM`);
      queueMicrotask(() => regenerateMelodyFromChords());
    },
    [regenerateMelodyFromChords, setLocalArpBpm],
  );

  const getSe2TrackChordImportRef = useRef(getSe2TrackChordImport);
  getSe2TrackChordImportRef.current = getSe2TrackChordImport;

  const followChordsFromSourceTrack = useCallback(
    (trackIndex: number, bl?: GenoArpBarLength) => {
      const fn = getSe2TrackChordImportRef.current;
      if (!fn) return false;
      const src = keySourceTracks.find((t) => t.trackIndex === trackIndex);
      if (src && src.canFollowChords === false) {
        setImportHint(`${genoUltraKeySourceTrackLabel(src)} — no chord data on that lane`);
        return false;
      }
      const result = fn(trackIndex, bl ?? barLengthRef.current);
      if (isGenoUltraArpChordImportError(result)) {
        setImportHint(result.message);
        return false;
      }
      applyChordImport(result);
      onDetectKeyFromSourceTrack?.(trackIndex);
      return true;
    },
    [applyChordImport, keySourceTracks, onDetectKeyFromSourceTrack],
  );

  const followSourceTrackChordsRef = useRef(followSourceTrackChords);
  followSourceTrackChordsRef.current = followSourceTrackChords;

  useEffect(() => {
    if (!followSourceTrackChordsRef.current || !getSe2TrackChordImportRef.current) return;
    followChordsFromSourceTrack(keySourceTrackIndex);
  }, [keySourceTrackIndex, keySourceTracks, followChordsFromSourceTrack]);

  useEffect(() => {
    if (!followSourceTrackChordsRef.current || !chordLockedRef.current) return;
    followChordsFromSourceTrack(keySourceTrackIndex, barLength);
  }, [barLength, keySourceTrackIndex, followChordsFromSourceTrack]);

  const handleMidiFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !isGenoUltraArpMidiFileName(file.name)) {
        setImportHint('Pick a .mid file');
        return;
      }
      void file.arrayBuffer().then((buf) => {
        const parsed = parseGenoUltraArpMidiFile(buf, file.name);
        if (isGenoUltraArpChordImportError(parsed)) {
          setImportHint(parsed.message);
          return;
        }
        applyChordImport(parsed);
      });
    },
    [applyChordImport],
  );

  const handleCardImport = useCallback(
    (presetId: string) => {
      setCardPresetId(presetId);
      setGenoBuildSourceId('');
      if (!presetId) {
        setChordTimeline(undefined);
        setChordLabel('');
        setImportHint('');
        return;
      }
      const parsed = importGenoUltraArpFromCard(
        presetId,
        songKeyRef.current.keyRoot,
        barLengthRef.current,
      );
      if (isGenoUltraArpChordImportError(parsed)) {
        setImportHint(parsed.message);
        return;
      }
      applyChordImport({
        ...parsed,
        keyRoot: songKeyRef.current.keyRoot,
        keyMode: songKeyRef.current.keyMode,
        basePitch: songKeyRef.current.keyRoot,
      });
    },
    [applyChordImport],
  );

  const handleGenoBuildImport = useCallback(
    (sourceId: string) => {
      setGenoBuildSourceId(sourceId);
      setCardPresetId('');
      if (!sourceId) {
        setChordTimeline(undefined);
        setChordLabel('');
        setImportHint('');
        return;
      }
      const parsed = importGenoUltraArpFromGenoBuild(
        sourceId,
        genoBuildImportTracks,
        beatsPerBar,
        bpmRef.current,
        songKeyRef.current,
        barLengthRef.current,
      );
      if (isGenoUltraArpChordImportError(parsed)) {
        setImportHint(parsed.message);
        return;
      }
      applyChordImport(parsed);
    },
    [applyChordImport, genoBuildImportTracks, beatsPerBar],
  );

  const handleExportMidi = useCallback(() => {
    try {
      downloadGenoUltraArpMidi(currentSnapshot(), bpmRef.current, songKeyRef.current, 'GenoUltraArp');
      setImportHint(`MIDI · ${studioKeyLabel(songKeyRef.current.keyRoot, songKeyRef.current.keyMode)}`);
    } catch (err) {
      setImportHint(err instanceof Error ? err.message : 'Export failed');
    }
  }, [currentSnapshot]);

  const handleExportWav = useCallback(() => {
    void (async () => {
      try {
        const ensure = ensureAudioContextRef.current;
        if (ensure) await ensure();
        await downloadGenoUltraArpWav(
          currentSnapshot(),
          getArpVoiceRef.current(),
          bpmRef.current,
          songKeyRef.current,
          'GenoUltraArp',
        );
        setImportHint(`WAV · ${studioKeyLabel(songKeyRef.current.keyRoot, songKeyRef.current.keyMode)}`);
      } catch (err) {
        setImportHint(err instanceof Error ? err.message : 'Render failed');
      }
    })();
  }, [currentSnapshot]);

  const handleApplyToPianoRoll = useCallback(() => {
    if (!onApplyToPianoRoll) return;
    try {
      const notes = genoUltraArpSnapshotToSe2RollNotes(
        currentSnapshot(),
        bpmRef.current,
        songKeyRef.current,
      );
      if (!notes.length) {
        setImportHint('No ARP steps — enable steps in the grid first');
        return;
      }
      onApplyToPianoRoll(notes);
      setImportHint(
        `Piano roll · ${notes.length} notes · ${studioKeyLabel(songKeyRef.current.keyRoot, songKeyRef.current.keyMode)}`,
      );
    } catch (err) {
      setImportHint(err instanceof Error ? err.message : 'Send to roll failed');
    }
  }, [currentSnapshot, onApplyToPianoRoll]);

  const clearChordImport = useCallback(() => {
    setChordTimeline(undefined);
    setChordLabel('');
    setCardPresetId('');
    setGenoBuildSourceId('');
    setChordLocked(false);
    setPreserveImportedVoicing(false);
    setImportHint('');
  }, []);

  const resetArpToDefaults = useCallback(() => {
    arpLoopSessionRef.current += 1;
    stopGenoUltraArpPreviewLoop();
    stopGenoUltraArpPreviewVoices();
    setGenoUltraArpPreviewRunning(false);
    setArpOn(false);
    setPlayStep(-1);
    setSeqRunning(false);
    setPresetLock(false);
    setOctShift(0);
    setBarOctShifts(emptyGenoArpBarOctShifts());
    setBarLength(4);
    setRateIdx(1);
    setOrderIdx(2);
    setArpVariation(0);
    setOctRange(1);
    setOrderInversion(false);
    setGate(0.82);
    setSwing(0.12);
    setLocalArpBpm(GENO_ULTRA_ARP_DEFAULT_BPM);
    setModDepth(0.35);
    setModRate(0.5);
    setGrid(defaultArpGrid());
    applyBlankStepSequencer(16);
    setSubLane('mod1');
    setStylePresetId('');
    setRandSeed(Math.floor(Math.random() * 99999));
    setChordTimeline(undefined);
    setChordLocked(false);
    setPreserveImportedVoicing(false);
    setChordLabel('');
    setKeyRoot(basePitchRef.current);
    setKeyMode(songKeyRef.current.keyMode);
    setArpScaleId(genoArpScaleIdFromKeyMode(songKeyRef.current.keyMode));
    setArpChordType('maj');
    setCardPresetId('');
    setGenoBuildSourceId('');
    setLoadUserSaveId('');
    setImportHint('Arp reset · factory defaults');
  }, [applyBlankStepSequencer]);

  const startLoop = useCallback((loop: boolean, maxCycles?: number) => {
    const session = ++arpLoopSessionRef.current;
    void (async () => {
      const ensure = ensureAudioContextRef.current;
      if (!ensure) return;
      const ctx = await ensure();
      if (!ctx || ctx.state === 'closed') return;
      if (session !== arpLoopSessionRef.current) return;
      if (loop && !arpLoopDriveRef.current) return;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          /* autoplay */
        }
      }
      if (session !== arpLoopSessionRef.current) return;
      if (loop && !arpLoopDriveRef.current) return;
      setSeqRunning(true);
      startGenoUltraArpPreviewLoop({
        ctx,
        getStripOutput: () => getStripOutputRef.current?.(ctx) ?? ctx.destination,
        getVoice: () => getArpVoiceRef.current(),
        getGrid: () => gridRef.current,
        barLength: barLengthRef.current,
        rateIdx: rateIdxRef.current,
        getBarLength: () => barLengthRef.current,
        getRateIdx: () => rateIdxRef.current,
        gate: gateRef.current,
        swing: swingRef.current,
        getGate: () => gateRef.current,
        getSwing: () => swingRef.current,
        bpm: bpmRef.current,
        getBpm: () => bpmRef.current,
        basePitch: basePitchRef.current,
        getBasePitch: () =>
          chordLockedRef.current ? keyRootHarmonyRef.current : basePitchRef.current,
        octShift: octShiftRef.current,
        getOctShift: () => octShiftRef.current,
        getBarOctShifts: () => barOctShiftsRef.current,
        getHarmony: () => ({
          keyRoot: keyRootHarmonyRef.current,
          scaleId: arpScaleIdRef.current,
          chordType: arpChordTypeRef.current,
          chordTimeline: chordTimelineRef.current,
          preserveImportedVoicing:
            preserveImportedVoicingRef.current && !!chordTimelineRef.current?.length,
        }),
        getPitchSpread: () =>
          genoUltraArpPitchSpreadFromSnapshot({
            octRange: octRangeRef.current,
            orderInversion: orderInversionRef.current,
          }),
        getTransportPatternBeat: se2SyncLockedRef.current
          ? () => {
              const playhead = getSe2PlayheadBeatRef.current?.() ?? 0;
              const origin = getSe2TransportOriginBeatRef.current?.() ?? 0;
              const patternBeats = genoUltraArpTotalPatternBeats(barLengthRef.current);
              const elapsed = playhead - origin;
              return ((elapsed % patternBeats) + patternBeats) % patternBeats;
            }
          : undefined,
        loop,
        maxCycles,
        getVelAtStep: (step) => velRef.current[step] ?? 0.82,
        getMod1AtStep: (step) => (mod1Ref.current[step] ?? 0) * ctrl1DepthRef.current,
        getMod2AtStep: (step) => (mod2Ref.current[step] ?? 0) * ctrl2DepthRef.current,
        getMod3AtStep: (step) => (mod3Ref.current[step] ?? 0) * ctrl3DepthRef.current,
        getMod1Dest: () => ctrl1DestRef.current,
        getMod2Dest: () => ctrl2DestRef.current,
        getMod3Dest: () => ctrl3DestRef.current,
        getMod1On: () => ctrl1OnRef.current,
        getMod2On: () => ctrl2OnRef.current,
        getMod3On: () => ctrl3OnRef.current,
        ...gateFxPreviewGetters,
        getArpLegato: () => arpPerformanceGettersRef.current?.getArpLegato?.() ?? false,
        getArpSlide: () => arpPerformanceGettersRef.current?.getArpSlide?.() ?? false,
        getArpPortamentoMs: () => arpPerformanceGettersRef.current?.getArpPortamentoMs?.() ?? 120,
        getArpSlideAnchor: () => arpPerformanceGettersRef.current?.getArpSlideAnchor?.() ?? 'mid',
        getStepEnabled: (step) => stepMaskRef.current[step] !== false,
        getStepMaskBlank: () => genoArpStepMaskIsBlank(stepMaskRef.current),
        getStepHits: (step) => stepHitsRef.current[step] ?? 0,
        getStepHitsBlank: () => genoArpStepHitsIsBlank(stepHitsRef.current),
        getPhraseSteps: () => phraseStepsRef.current,
        onStep: (step, pitch, gateSec) => {
          queuePlayStepUi(step);
          setSeqRunning(step >= 0);
          onArpStepRef.current?.(step, pitch, gateSec);
        },
      });
    })();
  }, []);

  useEffect(() => {
    if (!arpLoopDrive) {
      setGenoUltraArpPreviewRunning(false);
      return;
    }
    setGenoUltraArpPreviewRunning(true);
    startLoop(true);
    return () => {
      arpLoopSessionRef.current += 1;
      stopGenoUltraArpPreviewLoop();
      setPlayStep(-1);
      setSeqRunning(false);
    };
    // Pattern/rate/bar changes are read live via refs in the preview scheduler — do not restart here.
  }, [arpLoopDrive, startLoop]);

  useEffect(() => {
    if (se2SyncLocked && arpOn) setArpOn(false);
  }, [se2SyncLocked, arpOn]);

  useEffect(
    () => () => {
      if (playStepRafRef.current) cancelAnimationFrame(playStepRafRef.current);
      stopGenoUltraArpPreviewLoop();
      setSeqRunning(false);
    },
    [],
  );

  const previewPatternOnce = useCallback(() => {
    arpLoopSessionRef.current += 1;
    stopGenoUltraArpPreviewLoop();
    startLoop(false, 1);
  }, [startLoop]);

  const setSubLaneLevel = useCallback((lane: GenoArpSubLaneId, col: number, row: number) => {
    setStylePresetId('');
    const level = genoArpLevelFromRow(row);
    const patch = (prev: number[]) => {
      const next = [...prev];
      next[col] = level;
      return next;
    };
    if (lane === 'mod1') setMod1Levels(patch);
    else if (lane === 'mod2') setMod2Levels(patch);
    else setVelLevels(patch);
  }, []);

  const setBarLaneLevel = useCallback((lane: 'vel' | 'mod1' | 'mod2' | 'mod3' | 'gate', col: number, level: number) => {
    setStylePresetId('');
    const v = Math.max(0, Math.min(1, level));
    const patch = (prev: number[]) => {
      const next = [...prev];
      next[col] = v;
      return next;
    };
    if (lane === 'vel') setVelLevels(patch);
    else if (lane === 'mod1') setMod1Levels(patch);
    else if (lane === 'mod2') setMod2Levels(patch);
    else if (lane === 'gate') setGateLevels(patch);
    else setMod3Levels(patch);
  }, []);

  const applyOrder = (idx: number) => {
    const nextOrder = GENO_ARP_ORDERS[idx] ?? 'UP';
    if (nextOrder === 'RAND' && orderIdx === idx) {
      rerollRandom();
      setOrderIdx(idx);
      return;
    }
    setOrderIdx(idx);
    if (nextOrder === 'RAND') {
      const next = Math.floor(Math.random() * 99999);
      setRandSeed(next);
      setGrid(buildGenoArpGridPattern({ barLength, order: 'RAND', octShift, rateIdx, randSeed: next, variation: arpVariation }));
      return;
    }
    if (!presetLock) {
      setGrid(buildGenoArpGridPattern({ barLength, order: nextOrder, octShift, rateIdx, variation: arpVariation }));
    }
  };

  const applyVariation = (variation: GenoArpVariation) => {
    setArpVariation(variation);
    if (!presetLock) {
      setGrid(
        buildGenoArpGridPattern({
          barLength,
          order,
          octShift,
          rateIdx,
          randSeed: order === 'RAND' ? randSeed : 0,
          variation,
        }),
      );
    }
  };

  const applyOctRange = (range: GenoArpOctRange) => {
    setOctRange(range);
  };

  const applyOct = (oct: -1 | 0 | 1) => {
    setOctShift(oct);
    if (!presetLock) {
      setGrid(
        buildGenoArpGridPattern({
          barLength,
          order,
          octShift: oct,
          rateIdx,
          variation: arpVariation,
        }),
      );
    }
  };

  const setBarOct = useCallback((barIndex: number, oct: GenoArpBarOctShift) => {
    setBarOctShifts((prev) => {
      const next = [...prev] as GenoArpBarOctShift[];
      next[barIndex] = oct;
      return next;
    });
  }, []);

  const toggleStepMask = useCallback((col: number) => {
    setStepMask((prev) => {
      const next = [...prev];
      const on = next[col] !== false;
      next[col] = !on;
      return next;
    });
    setStepHits((prev) => {
      const next = [...prev] as GenoArpStepHits[];
      const on = stepMaskRef.current[col] !== false;
      /** Arming a dark step restores ×1 hits; resting clears hits. */
      next[col] = on ? 0 : 1;
      return next;
    });
  }, []);

  const setStepHitsAt = useCallback((col: number, hits: GenoArpStepHits) => {
    const sanitized = genoArpSanitizeStepHits(hits);
    setStepHits((prev) => {
      const next = [...prev] as GenoArpStepHits[];
      next[col] = sanitized;
      return next;
    });
    if (sanitized > 0) {
      setStepMask((prev) => {
        const next = [...prev];
        next[col] = true;
        return next;
      });
    }
  }, []);

  const cycleStepHits = useCallback((col: number) => {
    setStepHits((prev) => {
      const next = [...prev] as GenoArpStepHits[];
      const h = genoArpCycleStepHits(prev[col] ?? 1);
      next[col] = h;
      return next;
    });
    setStepMask((prev) => {
      const next = [...prev];
      const h = genoArpCycleStepHits(stepHitsRef.current[col] ?? 1);
      next[col] = h > 0;
      return next;
    });
  }, []);

  const applyPhraseSteps = useCallback(
    (n: number) => {
      setPhraseSteps(genoArpSanitizePhraseSteps(n, genoArpGridCols(barLength)));
    },
    [barLength],
  );

  const regenerateStepPattern = useCallback(() => {
    const nextSeed = Math.floor(Math.random() * 99999);
    const timeline = chordTimelineRef.current;
    const cols = genoArpGridCols(barLength);
    const phraseLen = genoArpSanitizePhraseSteps(phraseSteps, cols);
    const targets = genoArpRegenTargetCols(phraseLen, stepMaskRef.current, grid);
    if (!targets.length) {
      setImportHint('Arm STEP pads in phrase first (or add notes)');
      return;
    }
    if (!stepRegenRandom) {
      const phraseCols = Array.from({ length: phraseLen }, (_, i) => i);
      const notePool = genoArpCollectActiveRows(grid, phraseCols);
      if (!notePool.length) {
        setImportHint('Add notes on the grid first — Regenerate stays in that pitch range');
        return;
      }
    }
    const harmony =
      timeline?.length
        ? {
            keyRoot: keyRootHarmonyRef.current,
            scaleId: arpScaleIdRef.current,
            chordType: arpChordTypeRef.current,
            chordTimeline: timeline,
            preserveImportedVoicing: preserveImportedVoicingRef.current,
          }
        : undefined;
    setGrid((prev) =>
      regenerateGenoArpGridFromSteps({
        barLength,
        phraseSteps,
        stepMask: stepMaskRef.current,
        currentGrid: prev,
        order,
        variation: arpVariation,
        randSeed: stepRegenRandom ? nextSeed : randSeed,
        melodySeed: nextSeed,
        randomMode: stepRegenRandom,
        chordTimeline: timeline ?? undefined,
        harmony,
      }),
    );
    if (stepRegenRandom) setRandSeed(nextSeed);
    setPresetLock(true);
    setStylePresetId('');
    setImportHint(
      stepRegenRandom
        ? 'Random pattern · armed steps'
        : `Regenerated · ${targets.length} steps · same note range`,
    );
  }, [barLength, phraseSteps, order, arpVariation, randSeed, stepRegenRandom, grid]);

  const applyBarLength = (n: GenoArpBarLength) => {
    const next = genoArpSanitizeBarLength(n);
    const oldCols = genoArpGridCols(barLength);
    const newCols = genoArpGridCols(next);
    setBarLength(next);
    if (cardPresetId && !chordLockedRef.current) {
      const reparsed = importGenoUltraArpFromCard(cardPresetId, songKeyRef.current.keyRoot, next);
      if (!isGenoUltraArpChordImportError(reparsed)) {
        setChordTimeline(reparsed.chordTimeline.map((s) => ({ ...s, pitches: [...s.pitches] })));
      }
    }
    if (stylePresetId) {
      const preset = GENO_ARP_STYLE_PRESETS.find((p) => p.id === stylePresetId);
      if (preset) {
        const applied = applyGenoArpStylePreset(preset, next);
        setPresetLock(true);
        setGrid(applied.grid);
        applyBlankStepSequencer(newCols);
        if (applied.barOctShifts) setBarOctShifts([...applied.barOctShifts]);
        return;
      }
    }
    if (presetLock) {
      setGrid((prev) => resizeGenoArpGridByBars(prev, oldCols, newCols));
      setVelLevels((prev) => resizeGenoArpLaneLevelsByBars(prev, oldCols, newCols));
      setMod1Levels((prev) => resizeGenoArpLaneLevelsByBars(prev, oldCols, newCols));
      setMod2Levels((prev) => resizeGenoArpLaneLevelsByBars(prev, oldCols, newCols));
      setMod3Levels((prev) => resizeGenoArpLaneLevelsByBars(prev, oldCols, newCols));
      setGateLevels((prev) => resizeGenoArpLaneLevelsByBars(prev, oldCols, newCols));
      setStepMask((prev) => {
        const resized = resizeGenoArpLaneLevelsByBars(
          prev.map((on) => (on ? 1 : 0)),
          oldCols,
          newCols,
        );
        return resized.map((v) => v > 0);
      });
      setStepHits((prev) => resizeGenoArpLaneLevelsByBars(prev, oldCols, newCols));
      setPhraseSteps((prev) => genoArpSanitizePhraseSteps(prev, newCols));
      setBarOctShifts((prev) => {
        const out = [...prev];
        while (out.length < next) out.push(0);
        return out.slice(0, next);
      });
      return;
    }
    applyBlankStepSequencer(newCols);
    setGrid(
      buildGenoArpGridPattern({
        barLength: next,
        order,
        octShift,
        rateIdx,
        variation: arpVariation,
      }),
    );
  };

  const applyRate = (idx: number) => {
    setRateIdx(idx);
  };

  const applyStylePreset = useCallback(
    (presetId: string) => {
      setStylePresetId(presetId);
      if (!presetId) return;
      const preset = GENO_ARP_STYLE_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      const applied = applyGenoArpStylePreset(preset, barLength);
      setPresetLock(true);
      if (applied.barLength != null) setBarLength(applied.barLength);
      setGrid(applied.grid);
      setRateIdx(applied.rateIdx);
      setGate(applied.gate);
      setSwing(applied.swing);
      applyBlankStepSequencer(genoArpGridCols(applied.barLength ?? barLength));
      if (applied.barOctShifts) setBarOctShifts([...applied.barOctShifts]);
      if (applied.octShift != null) setOctShift(applied.octShift);
      if (preset.order) {
        const idx = GENO_ARP_ORDERS.indexOf(preset.order);
        if (idx >= 0) setOrderIdx(idx);
      }
      // Genre-typical local tempo (house 124, techno 130, trap 140, …) — not SE2 session BPM.
      if (!se2SyncLockedRef.current) {
        setLocalArpBpm(genoUltraArpBpmForStylePreset(preset));
      }
      const soundId = preset.soundPresetId ?? genoArpStyleSoundPresetId(preset.id);
      onLoadPreset?.(soundId);
    },
    [barLength, onLoadPreset, setLocalArpBpm, applyBlankStepSequencer],
  );

  const applyMelodyPreset = useCallback(
    (melodyId: string) => {
      const melody = genoUltraArpMelodyPresetById(melodyId);
      if (!melody) return;
      const patch = buildGenoUltraArpMelodyApplyPatch(
        melody,
        barLength,
        orderIdx,
        arpVariation,
        octRange,
        orderInversion,
      );
      if (!patch) return;
      setStylePresetId(patch.stylePresetId);
      setBarLength(patch.barLength);
      setPresetLock(patch.presetLock);
      setGrid(patch.grid);
      setRateIdx(patch.rateIdx);
      setGate(patch.gate);
      setSwing(patch.swing);
      if (patch.stepSeq) {
        const s = patch.stepSeq;
        setStepMask([...s.stepMask]);
        setStepHits(s.stepHits.map((h) => genoArpSanitizeStepHits(h)));
        setVelLevels([...s.velLevels]);
        setMod1Levels([...s.mod1Levels]);
        setMod2Levels([...s.mod2Levels]);
        setMod3Levels([...(s.mod3Levels ?? emptyGenoArpLaneLevels(0))]);
        setCtrl1On(s.ctrl1On);
        setCtrl2On(s.ctrl2On);
        setCtrl3On(s.ctrl3On);
        setCtrl1Depth(s.ctrl1Depth);
        setCtrl2Depth(s.ctrl2Depth);
        setCtrl3Depth(s.ctrl3Depth);
        setCtrl1Dest(s.ctrl1Dest);
        setCtrl2Dest(s.ctrl2Dest);
        setCtrl3Dest(s.ctrl3Dest);
        setPhraseSteps(s.phraseSteps);
      } else {
        applyBlankStepSequencer(genoArpGridCols(patch.barLength));
      }
      if (patch.barOctShifts) setBarOctShifts([...patch.barOctShifts]);
      if (patch.octShift != null) setOctShift(patch.octShift);
      setOrderIdx(patch.orderIdx);
      setArpVariation(patch.arpVariation);
      setOctRange(patch.octRange);
      setOrderInversion(patch.orderInversion);
      if (patch.keyPitchClass != null) setKeyPitchClass(patch.keyPitchClass);
      if (patch.keyMode != null) setKeyMode(patch.keyMode);
      if (patch.arpScaleId != null) setArpScaleId(patch.arpScaleId);
      if (patch.arpChordType != null) setArpChordType(patch.arpChordType);
      // Genre / song-typical local tempo — each melody loads its own pocket.
      if (!se2SyncLockedRef.current) {
        setLocalArpBpm(patch.bpm);
      }
      onLoadPreset?.(
        melody.soundPresetId,
        melody.tag === 'step-climb'
          ? { filterCutoffHz: 80 }
          : melody.tag === 'horror' || melody.tag === 'keys'
            ? {
                filterCutoffHz: melody.tag === 'horror' ? 750 : 850,
                filterDecayMs: 110,
                filterSustain: 0,
                filterReleaseMs: 55,
                ampDecayMs: melody.tag === 'horror' ? 150 : 165,
                ampSustain: 0,
                ampReleaseMs: 65,
              }
            : undefined,
      );
    },
    [
      barLength,
      orderIdx,
      arpVariation,
      octRange,
      orderInversion,
      onLoadPreset,
      setKeyPitchClass,
      setLocalArpBpm,
      applyBlankStepSequencer,
    ],
  );

  const applyMelodyPresetRef = useRef(applyMelodyPreset);
  applyMelodyPresetRef.current = applyMelodyPreset;

  useLayoutEffect(() => {
    registerArpMelodyApplier?.((id) => applyMelodyPresetRef.current(id));
  }, [registerArpMelodyApplier]);

  const applySavedPatternRef = useRef(applySavedPattern);
  applySavedPatternRef.current = applySavedPattern;

  useLayoutEffect(() => {
    registerArpUserPatternApplier?.((id) => {
      applySavedPatternRef.current(getGenoUltraArpSavedPattern(id));
    });
  }, [registerArpUserPatternApplier]);

  const anaSelectStyle: CSSProperties = {
    height: 22,
    minWidth: 148,
    maxWidth: 200,
    padding: '0 6px',
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: ANA.textHi,
    background: ANA.bgInset,
    border: `1px solid ${ANA.borderHi}`,
    borderRadius: 2,
    cursor: 'pointer',
  };

  const soundCategories = useMemo(() => {
    const cats = new Set(soundPresets.map((p) => p.category));
    return Array.from(cats);
  }, [soundPresets]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        height: '100%',
        minHeight: 0,
        width: '100%',
        minWidth: 0,
      }}
    >
      {/* Toolbar — two visual rows in one strip (no extra lane) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexShrink: 0, width: '100%' }}>
        <AnaBtn
          small
          active={se2SyncLocked ? se2TransportPlaying : arpOn}
          variant="green"
          disabled={disabled || se2SyncLocked}
          onClick={() => setArpOn((v) => !v)}
          title={
            se2SyncLocked
              ? 'Synced to SE2 transport — use the main transport bar to play and stop the arp'
              : arpOn
                ? 'Arpeggiator on — standalone preview at Ultra tempo'
                : 'Arpeggiator off — keyboard preview only'
          }
        >
          {se2SyncLocked
            ? se2TransportPlaying
              ? '● SE2 PLAY'
              : '○ SE2 WAIT'
            : arpOn
              ? '● ARP ON'
              : '○ ARP OFF'}
        </AnaBtn>
        {typeof onSe2SyncToggle === 'function' ? (
          <AnaBtn
            small
            active={se2SyncLocked}
            disabled={disabled}
            onClick={() => {
              // Keep each arp's local BPM intact — SYNC only borrows SE2 tempo while locked.
              onSe2SyncToggle();
            }}
            title={
              se2SyncLocked
                ? 'Synced to SE2 play/stop + BPM — click to unsync (Ultra keeps its own local tempo)'
                : 'Ultra runs on its own tempo — click to sync play/stop + BPM with SE2'
            }
          >
            {se2SyncLocked ? '● SYNC SE2' : '○ SYNC SE2'}
          </AnaBtn>
        ) : null}
        <AnaBtn
          small
          disabled={disabled}
          onClick={previewPatternOnce}
          title="Play one pattern cycle from keyboard root (default C3 / MIDI 60)"
        >
          ▶ PREVIEW
        </AnaBtn>
        <AnaBtn
          small
          active={presetLock}
          disabled={disabled}
          onClick={() => setPresetLock((v) => !v)}
          title={presetLock ? 'Locked — manual pattern' : 'Unlocked — settings rebuild pattern'}
        >
          {presetLock ? 'LOCKED' : 'AUTO PAT'}
        </AnaBtn>
        <div style={{ width: 1, height: 18, background: `${ANA.borderHi}55`, flexShrink: 0 }} />
        <span style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.1em' }} title="Pattern length in bars">LENGTH</span>
        <select
          value={barLength}
          disabled={disabled}
          title="Pattern length in bars"
          onChange={(e) => applyBarLength(Number(e.target.value) as GenoArpBarLength)}
          style={{ ...anaSelectStyle, minWidth: 72, maxWidth: 88 }}
        >
          {GENO_ARP_BAR_LENGTHS.map((b) => (
            <option key={b} value={b}>
              {b} BAR
            </option>
          ))}
        </select>
        <AnaLcdBar size="sm" title={`${barLength} bars · ${displayCols} arp steps`}>
          {barLength} BAR · {displayCols} STEPS
        </AnaLcdBar>
        <div style={{ flex: 1, minWidth: 8 }} />
        <span style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.1em' }} title="Note rate per arp step">RATE</span>
        <select
          value={rateIdx}
          disabled={disabled}
          title="Note rate per arp step"
          onChange={(e) => applyRate(Number(e.target.value))}
          style={{ ...anaSelectStyle, minWidth: 56, maxWidth: 72 }}
        >
          {GENO_ARP_RATE_LABELS.map((r, i) => (
            <option key={r} value={i}>
              {r}
            </option>
          ))}
        </select>
        <AnaLcdBar size="sm" title={`Current arp rate: ${rateLabel}`}>{rateLabel}</AnaLcdBar>
        <div style={{ width: 1, height: 18, background: `${ANA.borderHi}55`, flexShrink: 0 }} />
        {onLoadPreset && soundPresets.length > 0 ? (
          <>
            <span style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.1em' }}>SOUND</span>
            <select
              value={activePresetId}
              disabled={disabled}
              title="Synth patch from Browser — drives ARP timbre"
              onChange={(e) => {
                const id = e.target.value;
                if (id) handleSoundPresetChange(id);
              }}
              style={{ ...anaSelectStyle, minWidth: 120, maxWidth: 176 }}
            >
              <option value="">— Select —</option>
              {soundCategories.map((cat) => (
                <optgroup key={cat} label={cat.toUpperCase()}>
                  {soundPresets
                    .filter((p) => p.category === cat)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            {patchLabel ? (
              <AnaLcdBar size="sm" title={patchLabel}>
                {patchLabel.slice(0, 22)}
              </AnaLcdBar>
            ) : null}
          </>
        ) : null}
        <div style={{ width: 1, height: 18, background: `${ANA.borderHi}55`, flexShrink: 0 }} />
        <span style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.1em' }}>STYLE</span>
        <select
          value={stylePresetId}
          disabled={disabled}
          title="Genre arpeggio presets — trap, hip hop, techno, house, dance"
          onChange={(e) => applyStylePreset(e.target.value)}
          style={anaSelectStyle}
        >
          <option value="">— Custom —</option>
          {GENO_ARP_STYLE_CATEGORIES.map((cat) => (
            <optgroup key={cat.id} label={cat.label}>
              {GENO_ARP_STYLE_PRESETS.filter((p) => p.category === cat.id).map((p) => (
                <option key={p.id} value={p.id} title={p.description}>
                  {p.name.replace(`${cat.label} — `, '')}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div style={{ flexBasis: '100%', height: 0, margin: 0, padding: 0 }} aria-hidden />
        <span style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.1em' }}>KEY</span>
        <select
          value={keyPitchClass}
          disabled={disabled}
          title="Arp harmony root (pitch class)"
          onChange={(e) => setKeyPitchClass(Number(e.target.value))}
          style={{ ...anaSelectStyle, minWidth: 44, maxWidth: 52 }}
        >
          {NEURAL_HUM_KEY_NAMES.map((name, i) => (
            <option key={name} value={i}>
              {name}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.1em' }}>SCALE</span>
        <select
          value={arpScaleId}
          disabled={disabled}
          title="Scale for chord voicing and import re-voice"
          onChange={(e) => setArpScaleId(e.target.value as NeuralHumScaleId)}
          style={{ ...anaSelectStyle, minWidth: 72, maxWidth: 96 }}
        >
          {NEURAL_HUM_SCALES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.1em' }}>TYPE</span>
        <select
          value={arpChordType}
          disabled={disabled}
          title="Chord quality — maj, min, 7ths, sus, etc."
          onChange={(e) => setArpChordType(e.target.value as GenoArpChordType)}
          style={{ ...anaSelectStyle, minWidth: 52, maxWidth: 64 }}
        >
          {GENO_ARP_CHORD_TYPE_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <div style={{ width: 1, height: 18, background: `${ANA.borderHi}55`, flexShrink: 0 }} />
        <span style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.1em' }}>CHORD</span>
        <input
          ref={midiInputRef}
          type="file"
          accept=".mid,.midi,audio/midi"
          style={{ display: 'none' }}
          onChange={handleMidiFile}
        />
        <AnaBtn
          small
          disabled={disabled}
          onClick={() => midiInputRef.current?.click()}
          title="Import chord progression from a Standard MIDI file"
        >
          .MID IN
        </AnaBtn>
        <select
          value={cardPresetId}
          disabled={disabled}
          title="Factory Synth Geno chord cards — genre presets"
          onChange={(e) => handleCardImport(e.target.value)}
          style={{ ...anaSelectStyle, minWidth: 108, maxWidth: 148 }}
        >
          <option value="">— Card —</option>
          {Array.from(new Set(cardOptions.map((c) => c.genreId))).map((genreId) => {
            const genreLabel = cardOptions.find((c) => c.genreId === genreId)?.genreLabel ?? genreId;
            return (
              <optgroup key={genreId} label={genreLabel}>
                {cardOptions
                  .filter((c) => c.genreId === genreId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
              </optgroup>
            );
          })}
        </select>
        <AnaBtn
          small
          variant="green"
          active={drawNoteMode}
          disabled={disabled}
          onClick={() => {
            setDrawNoteMode((v) => {
              const next = !v;
              if (next) setPresetLock(true);
              return next;
            });
          }}
          title={
            drawNoteMode
              ? 'Draw on — drag the step grid to paint (Shift or right-drag erases)'
              : 'Draw notes — turn on, then drag on the step grid'
          }
        >
          ✎ {drawNoteMode ? 'ON' : 'DRAW'}
        </AnaBtn>
        <AnaBtn
          small
          variant="green"
          active={drawInKeyMode}
          disabled={disabled}
          onClick={() => setDrawInKeyMode((v) => !v)}
          title={
            drawInKeyMode
              ? 'Draw in key on — thin green row lines = in scale; other rows blocked'
              : 'Draw in key — only paint notes inside the current KEY + SCALE'
          }
        >
          ♯ {drawInKeyMode ? 'KEY ON' : 'IN KEY'}
        </AnaBtn>
        <AnaBtn
          small
          variant="blue"
          disabled={disabled || !canDuplicateToNextBar}
          onClick={duplicateToNextBar}
          title="Duplicate selection to next bar (clears next bar first). Click BAR label or Shift+click notes."
        >
          DUP →
        </AnaBtn>
        <select
          value={genoBuildSourceId}
          disabled={disabled}
          title={
            genoBuildSources.length
              ? 'Pull chord progression from a Synth Geno lane (Geno Build 1 or 2)'
              : 'Build chords on a Synth Geno track first — pick a vibe/card in Geno Build 1 or a progression in Geno Build 2, then return here'
          }
          onChange={(e) => handleGenoBuildImport(e.target.value)}
          style={{
            ...anaSelectStyle,
            minWidth: 132,
            maxWidth: 196,
            opacity: genoBuildSources.length ? 1 : 0.72,
          }}
        >
          <option value="">
            {genoBuildSources.length ? '— Geno Build —' : '— Geno Build (none yet) —'}
          </option>
          {genoBuildSources.some((s) => s.build === 'b01') ? (
            <optgroup label="Geno Build 1">
              {genoBuildSources
                .filter((s) => s.build === 'b01')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.chordCount})
                  </option>
                ))}
            </optgroup>
          ) : null}
          {genoBuildSources.some((s) => s.build === 'b02') ? (
            <optgroup label="Geno Build 2">
              {genoBuildSources
                .filter((s) => s.build === 'b02')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.chordCount})
                  </option>
                ))}
            </optgroup>
          ) : null}
        </select>
        {chordTimeline?.length ? (
          <AnaBtn small disabled={disabled} onClick={clearChordImport} title="Clear imported chords">
            CLR CH
          </AnaBtn>
        ) : null}
        <div style={{ width: 1, height: 18, background: `${ANA.borderHi}55`, flexShrink: 0 }} />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '1px 5px',
            borderRadius: 3,
            border: '1px solid rgba(255,130,130,0.55)',
            boxShadow: '0 0 0 1px rgba(255,85,85,0.1)',
          }}
          title="Save — Sound = synth only · Pattern = arp grid only · S+PAT = both into Melodies"
        >
          <span
            style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.1em' }}
            title="Save section — pick sound only, pattern only, or sound + pattern into Melodies"
          >
            SAVE
          </span>
          <AnaBtn
            small
            disabled={disabled}
            saveHighlight
            onClick={handleSaveSound}
            title="Save Sound — synth patch only (oscillators, filter, envelope, FX)"
          >
            SND
          </AnaBtn>
          <AnaBtn
            small
            disabled={disabled}
            saveHighlight
            onClick={handleSavePattern}
            title="Save Pattern — arp grid, steps, chords, and lanes only (keeps your current sound on load)"
          >
            PAT
          </AnaBtn>
          <AnaBtn
            small
            disabled={disabled}
            saveHighlight
            onClick={handleSaveSoundAndPattern}
            title="Save Sound and Pattern — full timbre + arp setup into your Melodies folder"
          >
            S+PAT
          </AnaBtn>
          {(savedSounds.length > 0 || savedPatternsOnly.length > 0 || savedSoundAndPatterns.length > 0) ? (
            <select
              value={loadUserSaveId}
              disabled={disabled}
              title="Load — recall a saved sound, pattern only, or sound + pattern"
              onChange={(e) => handleLoadUserSave(e.target.value)}
              style={{ ...anaSelectStyle, minWidth: 96, maxWidth: 140 }}
            >
              <option value="">— Load —</option>
              {savedSoundAndPatterns.length > 0 ? (
                <optgroup label="Sound + pattern (Melodies)">
                  {savedSoundAndPatterns.map((p) => (
                    <option key={p.id} value={`pattern:${p.id}`}>
                      {p.melodyTag ? `${p.name} [${p.melodyTag}]` : p.name}
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
              aria-label={saveDialogMode === 'soundAndPattern' ? 'Save sound and pattern' : 'Save pattern only'}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                zIndex: 40,
                marginTop: 4,
                minWidth: 220,
                padding: '8px 10px',
                borderRadius: 4,
                border: `1px solid ${ANA.borderHi}`,
                background: ANA.bgPanel,
                boxShadow: '0 8px 20px rgba(0,0,0,0.45)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 8, fontWeight: 800, color: ANA.textHi, letterSpacing: '0.08em' }}>
                {saveDialogMode === 'soundAndPattern' ? 'SAVE SOUND + PATTERN' : 'SAVE PATTERN ONLY'}
              </span>
              <span style={{ fontSize: 7, fontWeight: 600, color: ANA.textDim }}>
                {saveDialogMode === 'soundAndPattern'
                  ? `Saves timbre + arp into ${melodyTag ? `${melodyTag} melodies` : 'My Melodies'}`
                  : 'Saves arp grid only — your current sound stays when you load'}
              </span>
              <input
                ref={savePatternNameInputRef}
                type="text"
                value={savePatternNameDraft}
                maxLength={48}
                disabled={disabled}
                onChange={(e) => setSavePatternNameDraft(e.target.value)}
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
                  color: ANA.textHi,
                  background: ANA.bgInset,
                  border: `1px solid ${ANA.borderHi}`,
                  borderRadius: 3,
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <AnaBtn small disabled={disabled} onClick={cancelSaveDialog}>
                  Cancel
                </AnaBtn>
                <AnaBtn small variant="green" disabled={disabled} onClick={confirmSaveDialog}>
                  Save
                </AnaBtn>
              </div>
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '1px 5px',
            borderRadius: 3,
            border: `1px solid ${ANA.borderHi}88`,
          }}
          title="Keyboard voice mode — mono or polyphonic playback"
        >
          <span style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.1em' }} title="Play mode for keyboard preview">
            PLAY
          </span>
          <AnaBtn
            small
            active={monophonic}
            disabled={disabled}
            onClick={() => onMonophonicChange?.(true)}
            title="Monophonic — one note at a time; new keys replace the previous note"
          >
            MONO
          </AnaBtn>
          <AnaBtn
            small
            active={!monophonic}
            disabled={disabled}
            onClick={() => onMonophonicChange?.(false)}
            title={`Polyphonic — play up to ${polyphony} notes at once (keyboard preview)`}
          >
            POLY
          </AnaBtn>
          {chordTimeline?.length ? (
            <>
              <div style={{ width: 1, height: 16, background: `${ANA.borderHi}55`, margin: '0 2px' }} />
              <AnaBtn
                small
                active={chordLocked}
                disabled={disabled}
                onClick={() => setChordLocked((v) => !v)}
                title={
                  chordLocked
                    ? 'Chord progression locked — regenerate keeps the same chords'
                    : 'Unlock chords — key/scale changes may alter progression'
                }
              >
                {chordLocked ? '● LOCK CHORD' : '○ LOCK CHORD'}
              </AnaBtn>
              <AnaBtn
                small
                variant="green"
                disabled={disabled}
                onClick={() => regenerateMelodyFromChords()}
                title="Generate a new melody in song key following the locked chord progression"
              >
                ↻ REGENERATE
              </AnaBtn>
            </>
          ) : null}
        </div>
      </div>

      {/* Note grid + STEP pads (shared columns) */}
      <div style={{ flexShrink: 0, minWidth: 0, margin: '0 -8px' }}>
        <AnaArpGridVisual
          grid={grid}
          barLength={barLength}
          rateIdx={rateIdx}
          playStep={playStep}
          rateLabel={rateLabel}
          orderLabel={order}
          gate={gate}
          seqActive={seqRunning}
          disabled={disabled}
          onToggle={toggleCell}
          drawNoteMode={drawNoteMode}
          drawInKeyMode={drawInKeyMode}
          isCellInKey={isCellInKey}
          onPaintCell={paintCell}
          barOctShifts={barOctShifts}
          onSetBarOct={setBarOct}
          stepMask={stepMask}
          stepHits={stepHits}
          phraseSteps={phraseSteps}
          onPhraseSteps={applyPhraseSteps}
          onToggleStep={toggleStepMask}
          onSetStepHits={setStepHitsAt}
          onRegenerateSteps={regenerateStepPattern}
          stepRegenRandom={stepRegenRandom}
          onStepRegenRandomToggle={() => setStepRegenRandom((v) => !v)}
          selectedBar={selectedBar}
          selectedCells={selectedCells}
          onSelectBar={selectBarForDuplicate}
          onToggleSelectCell={toggleSelectCell}
        />
      </div>

      {/* Retrologue MODE·STEP — VEL + CTRL 1–3 bar lanes with the note grid */}
      <div style={{ flexShrink: 0, minWidth: 0, margin: '0 -8px' }}>
        <AnaArpRetrologueStepLanes
          barLength={barLength}
          velLevels={velLevels}
          mod1Levels={mod1Levels}
          mod2Levels={mod2Levels}
          mod3Levels={mod3Levels}
          gateLevels={gateLevels}
          ctrl1On={ctrl1On}
          ctrl2On={ctrl2On}
          ctrl3On={ctrl3On}
          gateFxOn={gateFxOn}
          ctrl1Depth={ctrl1Depth}
          ctrl2Depth={ctrl2Depth}
          ctrl3Depth={ctrl3Depth}
          ctrl1Dest={ctrl1Dest}
          ctrl2Dest={ctrl2Dest}
          ctrl3Dest={ctrl3Dest}
          playStep={playStep}
          seqActive={seqRunning}
          phraseSteps={phraseSteps}
          disabled={disabled}
          onSetVel={(col, level) => setBarLaneLevel('vel', col, level)}
          onSetMod1={(col, level) => setBarLaneLevel('mod1', col, level)}
          onSetMod2={(col, level) => setBarLaneLevel('mod2', col, level)}
          onSetMod3={(col, level) => setBarLaneLevel('mod3', col, level)}
          onSetGate={(col, level) => setBarLaneLevel('gate', col, level)}
          onCtrl1On={setCtrl1On}
          onCtrl2On={setCtrl2On}
          onCtrl3On={setCtrl3On}
          onCtrl1Depth={setCtrl1Depth}
          onCtrl2Depth={setCtrl2Depth}
          onCtrl3Depth={setCtrl3Depth}
          onCtrl1Dest={(d) => setCtrl1Dest(d as GenoArpCtrlDest)}
          onCtrl2Dest={(d) => setCtrl2Dest(d as GenoArpCtrlDest)}
          onCtrl3Dest={(d) => setCtrl3Dest(d as GenoArpCtrlDest)}
        />
      </div>

      {/* Bottom stack — OCT / ORDER / performance knobs */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3, margin: '0 -8px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flexWrap: 'wrap',
          padding: '2px 0',
          borderTop: `1px solid ${ANA.borderHi}33`,
          borderBottom: `1px solid ${ANA.borderHi}33`,
        }}
      >
        <span style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.1em', marginRight: 2 }} title="Octave shift for arp notes">OCT</span>
        <AnaBtn small active={octShift === 1} disabled={disabled} onClick={() => applyOct(1)} title="Shift arp up one octave">
          +1
        </AnaBtn>
        <AnaBtn small active={octShift === 0} disabled={disabled} onClick={() => applyOct(0)} title="No octave shift">
          0
        </AnaBtn>
        <AnaBtn small active={octShift === -1} disabled={disabled} onClick={() => applyOct(-1)} title="Shift arp down one octave">
          −1
        </AnaBtn>
        <div style={{ width: 1, height: 16, background: `${ANA.borderHi}55`, margin: '0 4px' }} />
        <span style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.1em' }} title="Octave range spread for arp notes">RNG</span>
        <select
          value={octRange}
          disabled={disabled}
          title="Octave range — how many octaves the arp spans"
          onChange={(e) => applyOctRange(Number(e.target.value) as GenoArpOctRange)}
          style={{ ...anaSelectStyle, minWidth: 44, maxWidth: 52 }}
        >
          {GENO_ARP_OCT_RANGES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={orderInversion ? 'inv' : 'off'}
          disabled={disabled}
          title="Logic Inversions — flip chord-tone order"
          onChange={(e) => setOrderInversion(e.target.value === 'inv')}
          style={{ ...anaSelectStyle, minWidth: 48, maxWidth: 56 }}
        >
          <option value="off">—</option>
          <option value="inv">INV</option>
        </select>
        <div style={{ flex: 1, minWidth: 8 }} />
        <span style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.1em' }} title="Order notes are played within each chord">ORDER</span>
        {GENO_ARP_ORDERS.filter((o) => o !== 'RAND').map((o) => {
          const i = GENO_ARP_ORDERS.indexOf(o);
          return (
            <AnaBtn
              key={o}
              small
              active={orderIdx === i}
              disabled={disabled}
              onClick={() => applyOrder(i)}
              title={`Arp note order: ${o}`}
            >
              {o}
            </AnaBtn>
          );
        })}
        <div style={{ width: 1, height: 16, background: `${ANA.borderHi}55`, margin: '0 4px' }} />
        <span style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.1em' }} title="Pattern variation (alternate layouts)">VAR</span>
        <select
          value={arpVariation}
          disabled={disabled}
          title="Pattern variation — alternate arp layouts"
          onChange={(e) => applyVariation(Number(e.target.value) as GenoArpVariation)}
          style={{ ...anaSelectStyle, minWidth: 44, maxWidth: 52 }}
        >
          {GENO_ARP_VARIATIONS.map((v) => (
            <option key={v} value={v}>
              {v + 1}
            </option>
          ))}
        </select>
        <AnaLcdBar size="sm" title={`Order ${order}${arpVariation > 0 ? ` · variation ${arpVariation + 1}` : ''}`}>
          {order}{arpVariation > 0 ? ` V${arpVariation + 1}` : ''}
        </AnaLcdBar>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          borderTop: `1px solid ${ANA.borderHi}33`,
          paddingTop: 4,
          paddingBottom: 2,
        }}
      >
        <span style={{ fontSize: 7, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.1em', alignSelf: 'center' }}>
          GATE SCALE · SWING
        </span>
        <AnaKnob label="GATE" value={gate} min={0.1} max={1} disabled={disabled} onChange={setGate} title="Gate scale — how long each arp step rings" />
        <AnaKnob label="SWING" value={swing} min={0} max={0.5} disabled={disabled} onChange={setSwing} title="Swing shuffle — delays off-beat steps" />
        <AnaKnob
          label="OCTAVE"
          value={octShift}
          min={-1}
          max={1}
          decimals={0}
          disabled={disabled}
          onChange={(v) => applyOct(Math.max(-1, Math.min(1, Math.round(v))) as -1 | 0 | 1)}
          title="Global octave shift for the phrase"
        />
        <AnaKnob
          label="BPM"
          value={se2SyncLocked ? effectiveArpBpm : localArpBpm}
          min={40}
          max={300}
          decimals={0}
          disabled={disabled || se2SyncLocked}
          onChange={(v) => setLocalArpBpm(v)}
          title={
            se2SyncLocked
              ? 'SE2 session tempo (locked) — turn off SYNC SE2 to edit this arp’s own BPM'
              : 'This arp’s local tempo — each pattern/track keeps its own BPM (not SE2 session)'
          }
        />
        <AnaLcdValueBar
          size="sm"
          value={effectiveArpBpm}
          suffix={se2SyncLocked ? ' BPM · SE2' : ' BPM · LOCAL'}
          min={40}
          max={300}
          step={1}
          decimals={0}
          disabled={disabled || se2SyncLocked}
          onChange={(v) => setLocalArpBpm(v)}
          title={
            se2SyncLocked
              ? 'SE2 session tempo (synced) — turn off SYNC SE2 to edit'
              : 'Click to type BPM · drag up/down to scrub'
          }
        />
        <div style={{ flex: 1, minWidth: 8 }} />
        <AnaBtn
          small
          disabled={disabled}
          onClick={resetArpToDefaults}
          title="Reset arpeggiator to factory defaults — grid, chords, lanes, and settings"
        >
          Reset
        </AnaBtn>
        <AnaBtn
          small
          disabled={disabled}
          onClick={() => {
            setPresetLock(false);
            if (order === 'RAND') rerollRandom();
            else regenPattern();
          }}
          title="Rebuild pattern from current style and settings (unlocked mode)"
        >
          Rebuild
        </AnaBtn>
        <AnaBtn
          small
          disabled={disabled}
          onClick={() => {
            setGrid(Array.from({ length: GENO_ARP_ROWS }, () => Array(GENO_ARP_MAX_COLS).fill(false)));
            setPresetLock(true);
          }}
          title="Clear all arp steps on the grid"
        >
          Clear
        </AnaBtn>
        <div style={{ width: 1, height: 18, background: `${ANA.borderHi}55`, flexShrink: 0 }} />
        <AnaBtn small disabled={disabled} onClick={handleExportMidi} title={`Download .mid in song key (${studioKeyLabel(songKeyRoot, songKeyMode)})`}>
          MIDI OUT
        </AnaBtn>
        {onApplyToPianoRoll ? (
          <AnaBtn
            small
            disabled={disabled}
            onClick={handleApplyToPianoRoll}
            title={`Send arpeggiation to this track's SE2 piano roll (${studioKeyLabel(songKeyRoot, songKeyMode)})`}
          >
            MIDI TO ROLL
          </AnaBtn>
        ) : null}
        <AnaBtn small disabled={disabled} onClick={handleExportWav} title={`Render WAV in song key (${studioKeyLabel(songKeyRoot, songKeyMode)})`}>
          WAV OUT
        </AnaBtn>
        <AnaLcdBar size="sm">KEY {studioKeyLabel(songKeyRoot, songKeyMode)}</AnaLcdBar>
        {keySourceTracks.length > 0 ? (
          <select
            disabled={disabled}
            value={keySourceTrackIndex}
            onChange={(e) => onKeySourceTrackIndexChange?.(Number(e.target.value))}
            title="SE2 track — arp auto-detects key + chords from this lane"
            style={{
              height: 22,
              minWidth: 148,
              maxWidth: 220,
              fontSize: 8,
              fontWeight: 700,
              padding: '0 6px',
              borderRadius: 3,
              border: `1px solid ${ANA.borderHi}`,
              background: ANA.bgDeep,
              color: ANA.textHi,
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
          <AnaBtn
            small
            disabled={disabled || !keySourceTracks.some((t) => t.trackIndex === keySourceTrackIndex && t.canDetectKey)}
            onClick={() => {
              const ok = onDetectKeyFromSourceTrack(keySourceTrackIndex);
              const src = keySourceTracks.find((t) => t.trackIndex === keySourceTrackIndex);
              const label = src ? genoUltraKeySourceTrackLabel(src) : `T${keySourceTrackIndex + 1}`;
              setImportHint(
                ok === false
                  ? `${label} — no key (add melodic notes or analyze audio)`
                  : `Key from ${label}`,
              );
            }}
            title="Re-detect key from the selected SE2 track"
          >
            DETECT
          </AnaBtn>
        ) : null}
        <AnaBtn
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
              setImportHint('Manual chord follow off — pick a track to re-enable');
              return;
            }
            setFollowSourceTrackChords(true);
            followChordsFromSourceTrack(keySourceTrackIndex);
          }}
          title={
            followSourceTrackChords
              ? 'Auto-follow chords from selected track (click to pause)'
              : 'Follow chords from selected SE2 track — locks arp + export to that progression'
          }
        >
          FOLLOW
        </AnaBtn>
        <AnaBtn
          small
          active={followSe2SongKey}
          disabled={disabled}
          onClick={toggleFollowSe2SongKey}
          title={
            followSe2SongKey
              ? 'Arp linked to selected track key (click to unlink)'
              : 'Link arp harmony to selected track key'
          }
        >
          LINK
        </AnaBtn>
      </div>
      </div>
    </div>
  );
}

export function AnaMeter({ level = 0.35 }: { level?: number }) {
  const bars = 12;
  const lit = Math.round(level * bars);
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 48, padding: '0 4px' }}>
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          style={{
            width: 4,
            height: 8 + i * 3,
            borderRadius: 1,
            background: i < lit ? (i > bars - 3 ? ANA.orange : ANA.meter) : ANA.bgInset,
            border: `1px solid ${ANA.border}`,
            opacity: i < lit ? 1 : 0.5,
          }}
        />
      ))}
    </div>
  );
}

const GENO_ULTRA_PIANO = {
  bed: '#0c0e12',
  bedBorder: '#1a1e26',
  whiteTop: '#fffffc',
  whiteFace: '#f6f4ec',
  whiteBottom: '#d4d2ca',
  whiteEdge: '#b0aea6',
  whiteGap: '#181a20',
  blackTop: '#48484e',
  blackFace: '#242428',
  blackBottom: '#08080a',
  blackEdge: '#020204',
  activeWhiteTop: '#b8f0b8',
  activeWhiteFace: '#d8f8d8',
  activeWhiteBottom: '#a8c8a8',
  activeBlackTop: '#2a6a3a',
  activeBlackFace: '#143820',
  activeBlackBottom: '#061408',
  woodBase: '#4a3018',
  woodHi: '#6b4828',
  woodLo: '#2e1c0c',
  woodGrain: '#3a2410',
} as const;

/** Walnut-style grain — layered CSS, no image asset. */
const GENO_ULTRA_WOOD_BG: CSSProperties = {
  backgroundColor: GENO_ULTRA_PIANO.woodBase,
  backgroundImage: `
    linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 36%),
    repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 2px,
      rgba(0,0,0,0.07) 2px,
      rgba(0,0,0,0.07) 2.5px
    ),
    repeating-linear-gradient(
      94deg,
      ${GENO_ULTRA_PIANO.woodLo} 0px,
      ${GENO_ULTRA_PIANO.woodHi} 4px,
      ${GENO_ULTRA_PIANO.woodGrain} 7px,
      ${GENO_ULTRA_PIANO.woodBase} 10px,
      ${GENO_ULTRA_PIANO.woodLo} 13px
    )
  `,
};

/** Thin walnut lip — keyboard, wheels, and full synth outer shell. */
export function AnaWoodTrimFrame({
  children,
  className,
  style,
  trimPx = 2,
  openBottom = false,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  trimPx?: number;
  /** Flush bottom edge (keyboard / pitch wheel row). */
  openBottom?: boolean;
}) {
  const pad = `${trimPx}px`;
  const padding = openBottom ? `${trimPx}px ${trimPx}px 0` : pad;
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        borderRadius: openBottom ? '5px 5px 0 0' : 6,
        padding,
        boxSizing: 'border-box',
        ...GENO_ULTRA_WOOD_BG,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 2px 6px rgba(0,0,0,0.35)',
        border: `1px solid ${GENO_ULTRA_PIANO.woodLo}`,
        ...(openBottom ? { borderBottom: 'none' } : {}),
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: trimPx,
          right: trimPx,
          top: trimPx,
          height: 1,
          borderRadius: 1,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.2), transparent)',
          pointerEvents: 'none',
          zIndex: 4,
        }}
      />
      <div
        style={{
          position: 'relative',
          borderRadius: openBottom ? '3px 3px 0 0' : 4,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Per pitch-class: black-key center after lower white neighbor (0–1). */
const GENO_ULTRA_BLACK_OFFSET: Record<number, number> = {
  1: 0.68,
  3: 0.68,
  6: 0.4,
  8: 0.52,
  10: 0.62,
};

export function AnaWheel({
  label,
  value,
  onChange,
  disabled,
  springCenter = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  /** Pitch wheel: snap back to 0 on release */
  springCenter?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ y: number; v: number } | null>(null);
  const safeVal = clampAnaNum(value, -1, 1, 0);

  const applyFromClientY = useCallback(
    (clientY: number) => {
      const el = trackRef.current;
      if (!el || disabled) return;
      const rect = el.getBoundingClientRect();
      const rel = 1 - (clientY - rect.top) / Math.max(1, rect.height);
      onChange(clampAnaNum(rel * 2 - 1, -1, 1, safeVal));
    },
    [disabled, onChange, safeVal],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { y: e.clientY, v: safeVal };
      applyFromClientY(e.clientY);
    },
    [applyFromClientY, disabled, safeVal],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId) || disabled) return;
      const dy = dragRef.current ? dragRef.current.y - e.clientY : 0;
      if (dragRef.current) {
        const next = clampAnaNum(dragRef.current.v + dy / 48, -1, 1, safeVal);
        onChange(next);
        dragRef.current = { y: e.clientY, v: next };
      } else {
        applyFromClientY(e.clientY);
      }
    },
    [applyFromClientY, disabled, onChange, safeVal],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      dragRef.current = null;
      if (springCenter) onChange(0);
    },
    [onChange, springCenter],
  );

  const t = (safeVal + 1) / 2;
  const w = 42;
  const h = 76;
  const rollerH = 22;
  const pct = Math.round(safeVal * 100);
  const rollerTop = 6 + (1 - t) * (h - rollerH - 12);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, userSelect: 'none' }}>
      <div
        style={{
          position: 'relative',
          borderRadius: '5px 5px 0 0',
          padding: '2px 2px 0',
          boxSizing: 'border-box',
          ...GENO_ULTRA_WOOD_BG,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 2px 6px rgba(0,0,0,0.35)',
          border: `1px solid ${GENO_ULTRA_PIANO.woodLo}`,
          borderBottom: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 2,
            right: 2,
            top: 2,
            height: 1,
            borderRadius: 1,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.2), transparent)',
            pointerEvents: 'none',
            zIndex: 4,
          }}
        />
        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => {
            if (!disabled) onChange(0);
          }}
          title={`${label} — drag up/down, double-click center`}
          style={{
            width: w,
            height: h,
            borderRadius: '4px 4px 0 0',
            border: `1px solid ${GENO_ULTRA_PIANO.bedBorder}`,
            borderBottom: 'none',
            background: `linear-gradient(180deg, #1e2228 0%, #12151a 45%, #0a0c10 100%)`,
            position: 'relative',
            cursor: disabled ? 'default' : 'ns-resize',
            touchAction: 'none',
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(255,255,255,0.03)',
            overflow: 'hidden',
            opacity: disabled ? 0.45 : 1,
          }}
        >
        {/* Recessed wheel channel */}
        <div
          style={{
            position: 'absolute',
            left: 8,
            right: 8,
            top: 5,
            bottom: 5,
            borderRadius: 6,
            background: 'linear-gradient(90deg, #060708 0%, #101318 50%, #060708 100%)',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.03)',
            pointerEvents: 'none',
          }}
        />
        {springCenter ? (
          <div
            style={{
              position: 'absolute',
              left: 10,
              right: 10,
              top: '50%',
              height: 1,
              transform: 'translateY(-50%)',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        ) : null}
        {/* Rubber roller wheel */}
        <div
          style={{
            position: 'absolute',
            left: 7,
            right: 7,
            top: rollerTop,
            height: rollerH,
            borderRadius: 5,
            background: `repeating-linear-gradient(
              180deg,
              #2a2e34 0px,
              #2a2e34 2px,
              #1e2228 2px,
              #1e2228 4px,
              #343840 4px,
              #343840 5px
            )`,
            border: '1px solid #484c54',
            boxShadow: `
              inset 2px 0 4px rgba(255,255,255,0.12),
              inset -2px 0 6px rgba(0,0,0,0.55),
              0 3px 6px rgba(0,0,0,0.55),
              0 1px 0 rgba(255,255,255,0.06)
            `,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '18%',
              right: '18%',
              top: '50%',
              height: 2,
              transform: 'translateY(-50%)',
              borderRadius: 1,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
            }}
          />
        </div>
        {/* Side bezels */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 6,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent)',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 6,
            background: 'linear-gradient(270deg, rgba(0,0,0,0.35), transparent)',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        />
        </div>
      </div>
      <span style={{ fontSize: 6, fontWeight: 800, color: ANA.textDim, letterSpacing: '0.14em' }}>{label}</span>
      <span style={{ fontSize: 7, fontWeight: 700, color: ANA.textHi, fontVariantNumeric: 'tabular-nums' }}>
        {pct > 0 ? `+${pct}` : pct}%
      </span>
    </div>
  );
}

const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11];

export function AnaKeyboard({
  /** MIDI octave index: 4 → MIDI 48 = C2 Yamaha; middle C (MIDI 60) labels as C3. */
  startOctave = 4,
  octaves = 2,
  height = 112,
  activePitch,
  disabled,
  onKey,
  onKeyUp,
}: {
  startOctave?: number;
  octaves?: number;
  height?: number;
  activePitch: number | null;
  disabled?: boolean;
  onKey: (pitch: number) => void;
  onKeyUp?: () => void;
}) {
  const [pressedPitch, setPressedPitch] = useState<number | null>(null);
  const pointerDownRef = useRef(false);
  const onKeyUpRef = useRef(onKeyUp);
  onKeyUpRef.current = onKeyUp;

  useEffect(() => {
    const end = () => {
      pointerDownRef.current = false;
      setPressedPitch(null);
      onKeyUpRef.current?.();
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

  const base = startOctave * 12;
  const whiteKeys: number[] = [];
  const blackKeys: number[] = [];
  for (let o = 0; o < octaves; o += 1) {
    for (const semi of WHITE_KEYS) whiteKeys.push(base + o * 12 + semi);
    for (const semi of [1, 3, 6, 8, 10]) blackKeys.push(base + o * 12 + semi);
  }
  const whiteW = 100 / whiteKeys.length;

  const isLit = (pitch: number) => activePitch === pitch || pressedPitch === pitch;

  const whiteStyle = (pitch: number, lit: boolean): CSSProperties => {
    const pc = pitch % 12;
    const isC = pc === 0;
    return {
      position: 'relative',
      flex: '1 1 0',
      minWidth: 0,
      height: '100%',
      border: 'none',
      borderRight: `1px solid ${GENO_ULTRA_PIANO.whiteGap}`,
      borderRadius: '0 0 4px 4px',
      background: lit
        ? `linear-gradient(180deg, ${GENO_ULTRA_PIANO.activeWhiteTop} 0%, ${GENO_ULTRA_PIANO.activeWhiteFace} 38%, ${GENO_ULTRA_PIANO.activeWhiteBottom} 100%)`
        : `linear-gradient(180deg, ${GENO_ULTRA_PIANO.whiteTop} 0%, ${GENO_ULTRA_PIANO.whiteFace} 42%, ${GENO_ULTRA_PIANO.whiteBottom} 100%)`,
      boxShadow: lit
        ? 'inset 0 2px 4px rgba(0,0,0,0.18), 0 0 0 1px rgba(57,255,20,0.25)'
        : `inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -4px 0 ${GENO_ULTRA_PIANO.whiteEdge}, 0 1px 2px rgba(0,0,0,0.1)`,
      transform: lit ? 'translateY(1px)' : 'none',
      cursor: disabled ? 'default' : 'pointer',
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingBottom: isC ? 4 : 3,
      zIndex: 1,
      touchAction: 'none',
    };
  };

  const blackStyle = (pitch: number, lit: boolean): CSSProperties => ({
    position: 'absolute',
    top: 0,
    height: '58%',
    width: `${whiteW * 0.56}%`,
    border: `1px solid ${GENO_ULTRA_PIANO.blackEdge}`,
    borderRadius: '0 0 3px 3px',
    background: lit
      ? `linear-gradient(180deg, ${GENO_ULTRA_PIANO.activeBlackTop} 0%, ${GENO_ULTRA_PIANO.activeBlackFace} 50%, ${GENO_ULTRA_PIANO.activeBlackBottom} 100%)`
      : `linear-gradient(180deg, ${GENO_ULTRA_PIANO.blackTop} 0%, ${GENO_ULTRA_PIANO.blackFace} 48%, ${GENO_ULTRA_PIANO.blackBottom} 100%)`,
    boxShadow: lit
      ? 'inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 4px rgba(0,0,0,0.65)'
      : 'inset 0 1px 0 rgba(255,255,255,0.14), 0 3px 5px rgba(0,0,0,0.55), 0 1px 0 rgba(0,0,0,0.8)',
    transform: lit ? 'translateY(1px)' : 'none',
    cursor: disabled ? 'default' : 'pointer',
    padding: 0,
    zIndex: 3,
    touchAction: 'none',
  });

  const playKey = (pitch: number) => {
    if (disabled) return;
    pointerDownRef.current = true;
    setPressedPitch(pitch);
    onKey(pitch);
  };

  const blackLeftPct = (pitch: number): number => {
    const pc = ((pitch % 12) + 12) % 12;
    const offset = GENO_ULTRA_BLACK_OFFSET[pc] ?? 0.55;
    let whiteIdx = 0;
    for (let i = 0; i < whiteKeys.length; i++) {
      if (whiteKeys[i]! < pitch) whiteIdx = i;
      else break;
    }
    return (whiteIdx + offset) * whiteW;
  };

  return (
    <div
      style={{
        position: 'relative',
        height,
        width: '100%',
        borderRadius: '5px 5px 0 0',
        padding: '2px 2px 0',
        boxSizing: 'border-box',
        ...GENO_ULTRA_WOOD_BG,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 2px 6px rgba(0,0,0,0.35)',
        border: `1px solid ${GENO_ULTRA_PIANO.woodLo}`,
        borderBottom: 'none',
      }}
    >
      {/* Nameboard — thin top highlight */}
      <div
        style={{
          position: 'absolute',
          left: 2,
          right: 2,
          top: 2,
          height: 1,
          borderRadius: 1,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.2), transparent)',
          pointerEvents: 'none',
          zIndex: 4,
        }}
      />
      <div
        style={{
          position: 'relative',
          height: '100%',
          width: '100%',
          borderRadius: '3px 3px 0 0',
          border: `1px solid ${GENO_ULTRA_PIANO.bedBorder}`,
          borderBottom: 'none',
          background: `linear-gradient(180deg, ${GENO_ULTRA_PIANO.bed} 0%, #080a0e 100%)`,
          boxShadow: 'inset 0 1px 5px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.03)',
          padding: '1px 2px 0',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch' }}>
        {whiteKeys.map((pitch) => {
          const lit = isLit(pitch);
          const isC = pitch % 12 === 0;
          // Yamaha-style: MIDI 60 = C3 (middle C), A4 = 440 Hz concert pitch.
          const octave = Math.floor(pitch / 12) - 2;
          return (
            <button
              key={`w-${pitch}`}
              type="button"
              disabled={disabled}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                playKey(pitch);
              }}
              onPointerEnter={() => {
                if (pointerDownRef.current) playKey(pitch);
              }}
              style={whiteStyle(pitch, lit)}
            >
              {isC ? (
                <span
                  style={{
                    fontSize: 7,
                    fontWeight: 700,
                    color: lit ? '#1a4a20' : '#7a7870',
                    lineHeight: 1,
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                >
                  C{octave}
                </span>
              ) : null}
            </button>
          );
        })}
        {blackKeys.map((pitch) => {
          const lit = isLit(pitch);
          return (
            <button
              key={`b-${pitch}`}
              type="button"
              disabled={disabled}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                playKey(pitch);
              }}
              onPointerEnter={() => {
                if (pointerDownRef.current) playKey(pitch);
              }}
              style={{
                ...blackStyle(pitch, lit),
                left: `calc(${blackLeftPct(pitch)}% - ${whiteW * 0.28}%)`,
              }}
            />
          );
        })}
      </div>
      </div>
    </div>
  );
}

export function AnaKnobRow({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-start', alignItems: 'flex-start' }}>
      {children}
    </div>
  );
}

export function AnaKnob(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  decimals?: number;
  unit?: string;
  accent?: string;
  disabled?: boolean;
  onChange: (v: number) => void;
  title?: string;
}) {
  return (
    <AnaRotaryKnob
      label={props.label}
      value={props.value}
      min={props.min}
      max={props.max}
      decimals={props.decimals ?? 2}
      unit={props.unit ?? ''}
      disabled={props.disabled}
      title={props.title}
      onChange={(v) => props.onChange(clampAnaNum(v, props.min, props.max, props.value))}
      size={ANA_KNOB}
    />
  );
}

/** Larger macro knobs (MOD DEPTH / RES / CUTOFF / AMBIENCE row). */
export function AnaMacroKnob(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  decimals?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <AnaRotaryKnob
      label={props.label}
      value={props.value}
      min={props.min}
      max={props.max}
      decimals={props.decimals ?? 2}
      unit={props.unit ?? ''}
      disabled={props.disabled}
      onChange={(v) => props.onChange(clampAnaNum(v, props.min, props.max, props.value))}
      size={52}
    />
  );
}

export function oscWavePath(type: string): string {
  if (type === 'sine') return 'M0,40 C15,8 35,8 50,40 C65,72 85,72 100,40 C115,8 135,8 150,40 C165,72 185,72 200,40';
  if (type === 'triangle') return 'M0,40 L25,8 L75,72 L125,8 L175,72 L200,40';
  if (type === 'square') return 'M0,72 L0,12 L45,12 L45,72 L95,72 L95,12 L145,12 L145,72 L200,72';
  return 'M0,65 L30,20 L60,65 L90,20 L120,65 L150,20 L180,65 L200,45';
}

export function filterResponsePath(mode: string, cutoff: number, res: number): string {
  const n = Math.max(0, Math.min(1, (Math.log10(Math.max(40, cutoff)) - Math.log10(40)) / (Math.log10(12000) - Math.log10(40))));
  const q = Math.max(0, Math.min(1, res / 8));
  const x = 20 + n * 150;
  const peak = 64 - q * 42;
  if (mode === 'highpass')
    return `M0,72 L${x - 30},72 C${x - 10},72 ${x - 8},${peak} ${x + 8},${peak} C${x + 24},${peak} 180,12 200,12`;
  if (mode === 'bandpass')
    return `M0,72 L${x - 38},72 C${x - 14},72 ${x - 6},${peak} ${x + 6},${peak} C${x + 14},${peak} ${x + 22},72 ${x + 52},72`;
  if (mode === 'notch')
    return `M0,12 L${x - 42},12 C${x - 18},12 ${x - 10},${peak + 18} ${x},${peak + 18} C${x + 10},${peak + 18} ${x + 18},12 ${x + 42},12 L200,12`;
  return `M0,12 L${x - 30},12 C${x - 12},12 ${x - 8},${peak} ${x + 10},${peak} C${x + 26},${peak} 176,72 200,72`;
}

export function envelopePath(attack: number, decay: number, sustain: number, release: number, attackMax = 800, decayMax = 1200, releaseMax = 2000): string {
  const atk = Math.max(1, Math.min(40, Math.round((attack / attackMax) * 40)));
  const dec = Math.max(8, Math.min(50, Math.round((decay / decayMax) * 50)));
  const rel = Math.max(8, Math.min(60, Math.round((release / releaseMax) * 60)));
  const susY = 72 - Math.max(0, Math.min(1, sustain)) * 56;
  const x1 = 14 + atk;
  const x2 = x1 + dec;
  const x3 = 160;
  const x4 = Math.min(200, x3 + rel);
  return `M8,72 L${x1},12 L${x2},${susY} L${x3},${susY} L${x4},72`;
}

export function lfoPath(shape: string): string {
  if (shape === 'sine') return 'M0,40 C20,8 40,72 60,40 C80,8 100,72 120,40 C140,8 160,72 180,40 C190,24 195,32 200,40';
  if (shape === 'triangle') return 'M0,40 L25,12 L50,68 L75,12 L100,68 L125,12 L150,68 L175,12 L200,40';
  if (shape === 'square') return 'M0,68 L0,12 L50,12 L50,68 L100,68 L100,12 L150,12 L150,68 L200,68';
  return 'M0,62 L25,18 L50,62 L75,18 L100,62 L125,18 L150,62 L175,18 L200,55';
}
