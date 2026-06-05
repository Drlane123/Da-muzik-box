import {
  GrooveStyleTCapVolumeFader,
  GrooveStyleTCapVolumeFaderStyles,
} from '@/app/components/creation/GrooveStyleTCapVolumeFader';
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { pointerStrikeVelocity } from '@/app/lib/creationStation/eightZeroEightVoice';
import {
  LAB_MPC_KIT_LIST,
  LAB_MPC_PAD_COUNT,
  ensureLabMpcKitLoaded,
  getLabMpcKitLoadState,
  labMpcKitInitialPadFx,
  labMpcKitMeta,
  labMpcPadLabel,
  playLabMpcPad,
  type LabMpcKitId,
  type LabMpcPadPlayOpts,
} from '@/app/lib/creationStation/labMpcKits';
import {
  lab808PadAccentFromLabel,
  lab808PadBorder,
  lab808PadSurface,
} from '@/app/lib/creationStation/lab808PadColors';
import { lab808BtnGhost, lab808Select } from '@/app/lib/creationStation/lab808UiTheme';
import { Lab808MuteSoloButtons } from '@/app/components/creation/Lab808MuteSoloButtons';

const PAD_CELL_MIN_H = 56;
const PAD_GRID_GAP = 6;
const VOL_STRIP_W = 42;
const PAD_BLOCK_H = PAD_CELL_MIN_H * 4 + PAD_GRID_GAP * 3;
const MS_ROW_H = 22;
const VOL_CHROME_H = 30;
const FADER_AREA_H = Math.max(48, PAD_BLOCK_H - VOL_CHROME_H - MS_ROW_H);

export interface Lab808PadBankProps {
  getAudioContext: () => AudioContext | null;
  /** Controlled kit (optional). */
  kitId?: LabMpcKitId;
  onKitIdChange?: (id: LabMpcKitId) => void;
  selectedPad?: number;
  onSelectedPadChange?: (pad: number) => void;
  /** When false, kit prefetch is idle. */
  prefetchActive?: boolean;
  /** 0–1 master level for drum pads + roll. */
  masterLevel?: number;
  onMasterLevelChange?: (level: number) => void;
  muted?: boolean;
  solo?: boolean;
  onMutedToggle?: () => void;
  onSoloToggle?: () => void;
  /** When false, pad hits are silent (mute/solo — fader unchanged). */
  audible?: boolean;
}

function kitIndex(id: LabMpcKitId): number {
  const i = LAB_MPC_KIT_LIST.findIndex((k) => k.id === id);
  return i >= 0 ? i : 0;
}

export function Lab808PadBank({
  getAudioContext,
  kitId: kitIdProp,
  onKitIdChange,
  selectedPad: selectedPadProp,
  onSelectedPadChange,
  prefetchActive = true,
  masterLevel = 0.92,
  onMasterLevelChange,
  muted = false,
  solo = false,
  onMutedToggle,
  onSoloToggle,
  audible = true,
}: Lab808PadBankProps) {
  const [kitIdInner, setKitIdInner] = useState<LabMpcKitId>('trapDark');
  const [selectedInner, setSelectedInner] = useState(0);
  const [padFx, setPadFx] = useState(() => labMpcKitInitialPadFx('trapDark'));
  const [kitUiTick, setKitUiTick] = useState(0);

  const kitId = kitIdProp ?? kitIdInner;
  const setKitId = onKitIdChange ?? setKitIdInner;
  const selectedPad = selectedPadProp ?? selectedInner;
  const setSelectedPad = onSelectedPadChange ?? setSelectedInner;

  const kitMeta = useMemo(() => labMpcKitMeta(kitId), [kitId]);
  const loadState = getLabMpcKitLoadState(kitId);

  useEffect(() => {
    if (!prefetchActive) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const slot = ensureLabMpcKitLoaded(kitId, ctx);
    void slot.readyPromise.finally(() => setKitUiTick((n) => n + 1));
  }, [kitId, getAudioContext, prefetchActive]);

  useEffect(() => {
    setPadFx(labMpcKitInitialPadFx(kitId));
  }, [kitId]);

  const playPad = useCallback(
    (row: number, velocity01: number) => {
      if (!audible) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      void ctx.resume();
      const slot = ensureLabMpcKitLoaded(kitId, ctx);
      void slot.readyPromise.then(() => {
        const opts: LabMpcPadPlayOpts = {
          tuneSemi: padFx.tuneSemi[row],
          lpCutoffHz: padFx.lpCutoffHz[row],
          drive: padFx.drive[row],
          level: (padFx.level[row] ?? 1) * masterLevel,
        };
        playLabMpcPad(ctx, kitId, row, ctx.currentTime + 0.012, velocity01, opts);
      });
    },
    [audible, getAudioContext, kitId, padFx, masterLevel],
  );

  const goKitDelta = useCallback(
    (delta: number) => {
      const idx = kitIndex(kitId);
      const next = LAB_MPC_KIT_LIST[(idx + delta + LAB_MPC_KIT_LIST.length) % LAB_MPC_KIT_LIST.length]!;
      setKitId(next.id);
    },
    [kitId, setKitId],
  );

  const onPadPointerDown = useCallback(
    (e: PointerEvent<HTMLButtonElement>, row: number) => {
      if (e.button !== 0) return;
      e.preventDefault();
      setSelectedPad(row);
      playPad(row, pointerStrikeVelocity(e));
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
    },
    [playPad, setSelectedPad],
  );

  const selectStyle: CSSProperties = { ...lab808Select, minWidth: 200, flex: '1 1 180px' };

  return (
    <section
      style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 12px 12px',
      }}
      aria-label="808 Lab drum pads"
    >
      <GrooveStyleTCapVolumeFaderStyles />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '0.14em',
            color: '#71717a',
            flexShrink: 0,
          }}
        >
          16 PADS
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '1 1 auto', minWidth: 0 }}>
          <button type="button" aria-label="Previous kit" onClick={() => goKitDelta(-1)} style={lab808BtnGhost}>
            <ChevronLeft size={20} />
          </button>
          <select value={kitId} onChange={(e) => setKitId(e.target.value as LabMpcKitId)} style={selectStyle}>
            {LAB_MPC_KIT_LIST.map((k) => (
              <option key={k.id} value={k.id}>
                {k.title}
              </option>
            ))}
          </select>
          <button type="button" aria-label="Next kit" onClick={() => goKitDelta(1)} style={lab808BtnGhost}>
            <ChevronRight size={20} />
          </button>
        </div>
        {loadState === 'loading' && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fcd34d' }} key={kitUiTick}>
            Loading…
          </span>
        )}
        {loadState === 'failed' && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171' }}>
            Kit failed — pick another
          </span>
        )}
        {kitMeta ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#52525b', flexShrink: 0 }}>{kitMeta.era}</span>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 6,
          width: '100%',
          maxWidth: 720 + VOL_STRIP_W + 16,
          margin: '8px auto 0',
        }}
      >
        <aside
          style={{
            width: VOL_STRIP_W,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            height: PAD_BLOCK_H,
            maxHeight: PAD_BLOCK_H,
            padding: '4px 3px',
            borderRadius: 6,
            background: 'rgba(0,0,0,0.28)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}
          aria-label="Drum kit volume"
        >
          <span style={{ fontSize: 7, fontWeight: 800, color: '#6f7e8e', letterSpacing: '0.08em' }}>VOL</span>
          <div
            style={{
              position: 'relative',
              flex: '1 1 auto',
              width: '100%',
              minHeight: 0,
              maxHeight: FADER_AREA_H,
              height: FADER_AREA_H,
              display: 'flex',
              alignItems: 'stretch',
              justifyContent: 'center',
              borderRadius: 4,
              background: 'rgba(0,0,0,0.2)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
            }}
          >
            <GrooveStyleTCapVolumeFader
              channelId={1}
              volume={Math.round(Math.max(0, Math.min(1, masterLevel)) * 100)}
              accent="#7cf4c6"
              onVolumeChange={(v) => onMasterLevelChange?.(Math.max(0, Math.min(1, v / 100)))}
              ariaLabel="Drum kit level"
              style={{ height: '100%', minHeight: 0 }}
            />
          </div>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: '#aab6c4',
              fontFamily: 'monospace',
              lineHeight: 1,
            }}
          >
            {Math.round(Math.max(0, Math.min(1, masterLevel)) * 100)}
          </span>
          {onMutedToggle && onSoloToggle ? (
            <Lab808MuteSoloButtons
              muted={muted}
              solo={solo}
              accent="#7cf4c6"
              onMuteToggle={onMutedToggle}
              onSoloToggle={onSoloToggle}
              bankLabel="Drums"
            />
          ) : null}
        </aside>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gridTemplateRows: `repeat(4, minmax(${PAD_CELL_MIN_H}px, 1fr))`,
            gap: PAD_GRID_GAP,
            minHeight: PAD_BLOCK_H,
            height: PAD_BLOCK_H,
          }}
        >
        {Array.from({ length: LAB_MPC_PAD_COUNT }, (_, row) => {
          const label = labMpcPadLabel(kitId, row);
          const shortLabel = label.length > 14 ? `${label.slice(0, 12)}…` : label;
          const accent = lab808PadAccentFromLabel(label, row);
          const selected = selectedPad === row;
          return (
            <button
              key={row}
              type="button"
              className="cs-pad-hit lab808-pad-hit"
              aria-label={`Pad ${row + 1} ${label}`}
              aria-pressed={selected}
              onPointerDown={(e) => onPadPointerDown(e, row)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                justifyContent: 'flex-end',
                minHeight: PAD_CELL_MIN_H,
                padding: '6px 8px 8px',
                borderRadius: 10,
                border: `2px solid ${lab808PadBorder(accent, selected)}`,
                background: lab808PadSurface(accent, selected),
                boxShadow: selected
                  ? `0 0 18px color-mix(in srgb, ${accent} 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.12)`
                  : 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -2px 0 rgba(0,0,0,0.35)',
                cursor: 'pointer',
                touchAction: 'manipulation',
                userSelect: 'none',
                color: '#e4e4e7',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'rgba(255,255,255,0.35)',
                  letterSpacing: '0.06em',
                  alignSelf: 'flex-start',
                }}
              >
                {row + 1}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  lineHeight: 1.15,
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: selected ? '#f0fdf4' : '#d4d4d8',
                  textShadow: `0 0 12px color-mix(in srgb, ${accent} 40%, transparent)`,
                }}
                title={label}
              >
                {shortLabel}
              </span>
            </button>
          );
        })}
        </div>
      </div>
    </section>
  );
}
