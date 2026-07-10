'use client';

import { Minus, Plus } from 'lucide-react';
import type { RefObject } from 'react';

export type StudioTransportPositionBoxProps = {
  barsReadoutRef: RefObject<HTMLSpanElement | null>;
  timeReadoutRef: RefObject<HTMLSpanElement | null>;
  bpm: number;
  beatsPerBar: number;
  disabled?: boolean;
  /** Compact footer layout — matches Pre / count-in control height. */
  compact?: boolean;
  onBpmChange: (bpm: number) => void;
  onBpmDelta: (delta: number) => void;
};

const transportClusterSectionStyle = {
  borderColor: '#2a2a34',
  background: 'linear-gradient(180deg, #101018 0%, #0a0a10 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), inset 0 -1px 0 rgba(0, 0, 0, 0.55)',
  boxSizing: 'border-box' as const,
};

const readoutFixedStyle = {
  display: 'inline-block' as const,
  textAlign: 'center' as const,
  fontVariantNumeric: 'tabular-nums' as const,
};

/**
 * Mixcraft-style transport readout — bars, wall-clock time, and BPM stay grouped
 * but in separate mini-panels so digit updates do not jitter the cluster frame.
 */
export function StudioTransportPositionBox({
  barsReadoutRef,
  timeReadoutRef,
  bpm,
  beatsPerBar,
  disabled = false,
  compact = false,
  onBpmChange,
  onBpmDelta,
}: StudioTransportPositionBoxProps) {
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const transportBtnBase =
    'inline-flex items-center justify-center border-0 bg-transparent cursor-pointer transition-opacity hover:opacity-90 active:scale-[0.96] disabled:cursor-not-allowed';

  const panelH = compact ? 'h-7' : 'h-9';
  const panelRound = compact ? 'rounded' : 'rounded-md';
  const panelPx = compact ? 'px-2' : 'px-3';
  const barsMinW = compact ? 'w-[8rem]' : 'min-w-[6.5rem]';
  const timeMinW = compact ? 'w-[6.25rem]' : 'min-w-[6.25rem]';
  const bpmMinW = compact ? 'min-w-[4.5rem]' : 'min-w-[6.5rem]';
  const valueClass = compact ? 'text-[10px]' : 'text-[13px]';
  const bpmInputClass = compact ? 'text-[10px] h-[13px] w-[2.25rem]' : 'text-[13px] h-[15px] w-[3rem]';
  const bpmBtnW = compact ? 'w-5' : 'w-7';
  const bpmIcon = compact ? 11 : 13;
  const readoutMin = compact ? '14ch' : '6.75ch';
  const timeReadoutMin = compact ? '8.5ch' : '8.25ch';

  const captionClass = compact ? 'se2-transport-pos-label' : 'se2-transport-pos-label text-[8px]';
  const sigClass = compact ? 'se2-transport-pos-sig' : 'se2-transport-pos-sig text-[7px]';

  return (
    <div
      className={`flex shrink-0 select-none ${compact ? 'items-end gap-2' : 'items-end gap-1.5'}`}
      title="Song position, time, and tempo"
    >
      {/* Bars / beats */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <div className="flex items-center gap-0.5 leading-none">
          <span className={`se2-type-micro ${captionClass}`} style={{ color: '#8a8a98' }}>
            Bars
          </span>
          <span className={`se2-type-value ${sigClass}`}>{bpb}/4</span>
        </div>
        <div
          className={`flex items-center justify-center ${panelH} ${panelRound} border ${panelPx} ${barsMinW}`}
          style={transportClusterSectionStyle}
        >
          <span
            ref={barsReadoutRef}
            className={`se2-type-value ${valueClass} leading-none text-white whitespace-nowrap tabular-nums`}
            style={{
              ...readoutFixedStyle,
              minWidth: readoutMin,
            }}
          >
            01.1.00
          </span>
        </div>
      </div>

      {/* Wall-clock time */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <span className={`se2-type-micro ${captionClass} leading-none`} style={{ color: '#8a8a98' }}>
          Time
        </span>
        <div
          className={`flex items-center justify-center ${panelH} ${panelRound} border ${panelPx} ${timeMinW}`}
          style={transportClusterSectionStyle}
        >
          <span
            ref={timeReadoutRef}
            className={`se2-type-value ${valueClass} leading-none whitespace-nowrap tabular-nums`}
            style={{
              ...readoutFixedStyle,
              minWidth: timeReadoutMin,
              color: '#7cf4c6',
              textShadow: compact ? '0 0 8px rgba(124,244,198,0.2)' : '0 0 12px rgba(124,244,198,0.25)',
            }}
          >
            00:00:00
          </span>
        </div>
      </div>

      {/* BPM */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <span className={`se2-type-micro ${captionClass} leading-none`} style={{ color: '#8a8a98' }}>
          BPM
        </span>
        <div
          className={`flex items-center gap-0 ${panelH} ${panelRound} border ${compact ? 'px-0.5' : 'px-1'} ${bpmMinW}`}
          style={transportClusterSectionStyle}
        >
          <button
            type="button"
            title="BPM −1"
            disabled={disabled}
            className={`${transportBtnBase} h-full ${bpmBtnW} text-[#a8a8b4] disabled:opacity-35`}
            onClick={() => onBpmDelta(-1)}
          >
            <Minus size={bpmIcon} strokeWidth={2.5} />
          </button>
          <div className={`flex items-center justify-center flex-1 ${compact ? 'min-w-[2rem]' : 'min-w-[2.75rem]'}`}>
            <input
              type="number"
              min={40}
              max={240}
              value={bpm}
              disabled={disabled}
              onChange={(e) => onBpmChange(Number(e.target.value) || 120)}
              className={`se2-type-value text-center leading-none bg-transparent border-0 outline-none py-0 tabular-nums disabled:opacity-45 ${bpmInputClass}`}
              style={{ color: '#ffb84d' }}
              aria-label="Project BPM"
            />
          </div>
          <button
            type="button"
            title="BPM +1"
            disabled={disabled}
            className={`${transportBtnBase} h-full ${bpmBtnW} text-[#a8a8b4] disabled:opacity-35`}
            onClick={() => onBpmDelta(1)}
          >
            <Plus size={bpmIcon} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
