'use client';

import { Minus, Plus } from 'lucide-react';
import type { RefObject } from 'react';

export type StudioTransportBarsReadoutRefs = {
  bar: RefObject<HTMLSpanElement | null>;
  beat: RefObject<HTMLSpanElement | null>;
  tick: RefObject<HTMLSpanElement | null>;
  pause?: RefObject<HTMLSpanElement | null>;
};

export type StudioTransportTimeReadoutRefs = {
  minutes: RefObject<HTMLSpanElement | null>;
  seconds: RefObject<HTMLSpanElement | null>;
  frames: RefObject<HTMLSpanElement | null>;
};

export type StudioTransportPositionBoxProps = {
  barsReadoutRefs: StudioTransportBarsReadoutRefs;
  timeReadoutRefs: StudioTransportTimeReadoutRefs;
  bpm: number;
  beatsPerBar: number;
  disabled?: boolean;
  /** Compact footer layout — matches Pre / count-in control height. */
  compact?: boolean;
  onBpmChange: (bpm: number) => void;
  onBpmDelta: (delta: number) => void;
};

const panelStyle = {
  borderColor: '#2a2a34',
  background: '#0a0a10',
  boxSizing: 'border-box' as const,
};

const readoutTopBevelStyle = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  height: 1,
  pointerEvents: 'none' as const,
  background: 'rgba(255, 255, 255, 0.05)',
};

const transportBtnBase =
  'inline-flex items-center justify-center border-0 bg-transparent cursor-pointer transition-opacity hover:opacity-90 active:scale-[0.96] disabled:cursor-not-allowed';

type IslandProps = {
  compact?: boolean;
};

type BarsIslandProps = IslandProps & {
  barsReadoutRefs: StudioTransportBarsReadoutRefs;
  beatsPerBar: number;
};

type TimeIslandProps = IslandProps & {
  timeReadoutRefs: StudioTransportTimeReadoutRefs;
};

type BpmIslandProps = IslandProps & {
  bpm: number;
  disabled?: boolean;
  onBpmChange: (bpm: number) => void;
  onBpmDelta: (delta: number) => void;
};

function useIslandLayout(compact: boolean) {
  return {
    readoutPanelH: compact ? 'h-8' : 'h-10',
    panelRound: compact ? 'rounded' : 'rounded-md',
    valueClass: compact ? 'text-[10px]' : 'text-[13px]',
    captionClass: compact ? 'se2-transport-pos-label' : 'se2-transport-pos-label text-[8px]',
    sigClass: compact ? 'se2-transport-pos-sig' : 'se2-transport-pos-sig text-[7px]',
    bpmInputClass: compact ? 'text-[10px] h-[13px] w-[2.5rem]' : 'text-[13px] h-[15px] w-[3rem]',
    bpmBtnW: compact ? 'w-5' : 'w-7',
    bpmIcon: compact ? 11 : 13,
  };
}

/** Own footer frame — Bars readout only. */
export function StudioTransportBarsIsland({
  barsReadoutRefs,
  beatsPerBar,
  compact = false,
}: BarsIslandProps) {
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const { readoutPanelH, panelRound, valueClass, captionClass, sigClass } = useIslandLayout(compact);

  return (
    <div className="se2-transport-footer-island se2-transport-bars-island shrink-0">
      <div className="se2-transport-readout-slot">
        <div className="se2-transport-readout-caption flex items-center gap-0.5 leading-none">
          <span className={`se2-type-micro ${captionClass}`} style={{ color: '#8a8a98' }}>
            Bars
          </span>
          <span className={`se2-type-value ${sigClass}`}>{bpb}/4</span>
        </div>
        <div className="se2-transport-readout-wrap se2-transport-bars-wrap">
          <div
            className={`se2-transport-position-panel se2-transport-bars-panel ${readoutPanelH} ${panelRound} border`}
            style={panelStyle}
          >
            <span aria-hidden style={readoutTopBevelStyle} />
            <div className={`se2-transport-bars-digits-row se2-type-value ${valueClass} text-white tabular-nums`}>
              {barsReadoutRefs.pause ? (
                <span
                  ref={barsReadoutRefs.pause}
                  className="se2-transport-bars-pause-slot"
                  aria-hidden
                />
              ) : null}
              <span className="se2-transport-bars-seg-wrap se2-transport-bars-seg-bar">
                <span ref={barsReadoutRefs.bar} className="se2-transport-position-digits">
                  01
                </span>
              </span>
              <span className="se2-transport-bars-sep" aria-hidden>
                .
              </span>
              <span className="se2-transport-bars-seg-wrap se2-transport-bars-seg-beat">
                <span ref={barsReadoutRefs.beat} className="se2-transport-position-digits">
                  1
                </span>
              </span>
              <span className="se2-transport-bars-sep" aria-hidden>
                .
              </span>
              <span className="se2-transport-bars-seg-wrap se2-transport-bars-seg-tick">
                <span ref={barsReadoutRefs.tick} className="se2-transport-position-digits">
                  00
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Own footer frame — Time readout only. */
export function StudioTransportTimeIsland({
  timeReadoutRefs,
  compact = false,
}: TimeIslandProps) {
  const { readoutPanelH, panelRound, valueClass, captionClass } = useIslandLayout(compact);

  return (
    <div className="se2-transport-footer-island se2-transport-time-island shrink-0">
      <div className="se2-transport-readout-slot">
        <span className={`se2-transport-readout-caption se2-type-micro ${captionClass} leading-none`} style={{ color: '#8a8a98' }}>
          Time
        </span>
        <div className="se2-transport-readout-wrap se2-transport-time-wrap">
          <div
            className={`se2-transport-position-panel se2-transport-time-panel ${readoutPanelH} ${panelRound} border`}
            style={panelStyle}
          >
            <span aria-hidden style={readoutTopBevelStyle} />
            <div
              className={`se2-transport-time-digits-row se2-type-value ${valueClass} tabular-nums`}
              style={{ color: '#7cf4c6' }}
            >
              <span className="se2-transport-time-seg-wrap se2-transport-time-seg-min">
                <span ref={timeReadoutRefs.minutes} className="se2-transport-position-digits">
                  00
                </span>
              </span>
              <span className="se2-transport-time-sep" aria-hidden>
                :
              </span>
              <span className="se2-transport-time-seg-wrap se2-transport-time-seg-sec">
                <span ref={timeReadoutRefs.seconds} className="se2-transport-position-digits">
                  00
                </span>
              </span>
              <span className="se2-transport-time-sep" aria-hidden>
                :
              </span>
              <span className="se2-transport-time-seg-wrap se2-transport-time-seg-frame">
                <span ref={timeReadoutRefs.frames} className="se2-transport-position-digits">
                  00
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Own footer frame — BPM control only. */
export function StudioTransportBpmIsland({
  bpm,
  disabled = false,
  compact = false,
  onBpmChange,
  onBpmDelta,
}: BpmIslandProps) {
  const {
    readoutPanelH,
    panelRound,
    captionClass,
    bpmInputClass,
    bpmBtnW,
    bpmIcon,
  } = useIslandLayout(compact);

  return (
    <div className="se2-transport-footer-island se2-transport-bpm-island flex flex-col items-center gap-0.5 shrink-0">
      <span className={`se2-type-micro ${captionClass} leading-none`} style={{ color: '#8a8a98' }}>
        BPM
      </span>
      <div
        className={`se2-transport-position-panel ${readoutPanelH} ${panelRound} border`}
        style={panelStyle}
      >
        <span aria-hidden style={readoutTopBevelStyle} />
        <div className="se2-transport-position-bpm-row">
          <button
            type="button"
            title="BPM −1"
            disabled={disabled}
            className={`${transportBtnBase} h-full ${bpmBtnW} text-[#a8a8b4] disabled:opacity-35`}
            onClick={() => onBpmDelta(-1)}
          >
            <Minus size={bpmIcon} strokeWidth={2.5} />
          </button>
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

/** @deprecated Use {@link StudioTransportBarsIsland} + Time + Bpm islands in the footer. */
export function StudioTransportPositionBox(props: StudioTransportPositionBoxProps) {
  const { barsReadoutRefs, timeReadoutRefs, bpm, beatsPerBar, disabled, compact, onBpmChange, onBpmDelta } =
    props;
  return (
    <>
      <StudioTransportBarsIsland
        barsReadoutRefs={barsReadoutRefs}
        beatsPerBar={beatsPerBar}
        compact={compact}
      />
      <StudioTransportTimeIsland timeReadoutRefs={timeReadoutRefs} compact={compact} />
      <StudioTransportBpmIsland
        bpm={bpm}
        disabled={disabled}
        compact={compact}
        onBpmChange={onBpmChange}
        onBpmDelta={onBpmDelta}
      />
    </>
  );
}
