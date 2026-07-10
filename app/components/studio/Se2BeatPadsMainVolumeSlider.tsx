'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  getSe2BeatPadsMainVolume,
  setSe2BeatPadsMainVolume,
  subscribeSe2BeatPadsMainVolume,
  SE2_BEAT_PADS_MAIN_VOLUME_DEFAULT,
} from '@/app/lib/studio/se2BeatPadsMainVolume';
import { saveSe2OwnerStartupBeatPadsMainVolume } from '@/app/lib/studio/se2OwnerStartupTemplate';

export type Se2BeatPadsMainVolumeSliderProps = {
  accentHex?: string;
};

/**
 * Embedded Vol strip for the Beat Pads dock header — modern slider + Save template.
 */
export function Se2BeatPadsMainVolumeSlider({ accentHex = '#7cf4c6' }: Se2BeatPadsMainVolumeSliderProps) {
  const [value, setValue] = useState(() => getSe2BeatPadsMainVolume());
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => subscribeSe2BeatPadsMainVolume(() => setValue(getSe2BeatPadsMainVolume())), []);

  const commit = useCallback((next: number) => {
    setValue(setSe2BeatPadsMainVolume(next));
  }, []);

  const onSaveTemplate = useCallback(() => {
    const ok = saveSe2OwnerStartupBeatPadsMainVolume();
    if (ok) {
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1400);
    }
  }, []);

  const pct = Math.round(value * 100);
  const defaultPct = Math.round(SE2_BEAT_PADS_MAIN_VOLUME_DEFAULT * 100);

  const stripStyle: CSSProperties = {
    marginLeft: 10,
    height: 24,
    padding: '0 7px',
    gap: 6,
    borderRadius: 4,
    borderColor: `${accentHex}44`,
    background: `linear-gradient(180deg, ${accentHex}12 0%, rgba(6,10,8,0.94) 100%)`,
    boxShadow: `inset 0 1px 0 ${accentHex}22`,
  };

  return (
    <div
      className="se2-beat-pads-vol-strip inline-flex shrink-0 items-center border"
      style={stripStyle}
      title={`Beat Pads volume ${pct}% · double-click resets to ${defaultPct}%`}
      onDoubleClick={() => commit(SE2_BEAT_PADS_MAIN_VOLUME_DEFAULT)}
    >
      <span
        className="text-[8px] font-black uppercase tracking-wide leading-none shrink-0"
        style={{ color: accentHex }}
      >
        Vol
      </span>

      <div
        className="se2-beat-pads-vol-slider relative shrink-0"
        style={{ '--se2-bp-vol-accent': accentHex } as CSSProperties}
      >
        <div className="se2-beat-pads-vol-slider__track" aria-hidden>
          <div className="se2-beat-pads-vol-slider__fill" style={{ width: `${pct}%` }} />
          <div
            className="se2-beat-pads-vol-slider__sweet-spot"
            style={{ left: `${defaultPct}%` }}
            title={`Sweet spot ${defaultPct}%`}
          />
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          onChange={(e) => commit(Number(e.target.value) / 100)}
          onDoubleClick={(e) => e.stopPropagation()}
          className="se2-beat-pads-vol-slider__input"
          aria-label={`Beat Pads volume ${pct} percent`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        />
      </div>

      <span
        className="w-5 shrink-0 text-right text-[8px] font-bold tabular-nums leading-none"
        style={{ color: accentHex }}
      >
        {pct}
      </span>
      <button
        type="button"
        onClick={onSaveTemplate}
        className="se2-beat-pads-vol-save shrink-0 inline-flex items-center justify-center rounded border transition-colors hover:bg-white/[0.08]"
        style={{
          width: 20,
          height: 20,
          borderColor: savedFlash ? `${accentHex}aa` : `${accentHex}44`,
          color: accentHex,
          background: savedFlash ? `${accentHex}28` : `${accentHex}10`,
        }}
        title="Save Beat Pads volume to template"
        aria-label="Save Beat Pads volume to template"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
          className="shrink-0"
        >
          <rect x="2" y="1.5" width="12" height="13" rx="1" stroke="currentColor" strokeWidth="1.35" />
          <path d="M4.5 1.5V5.5H8.5" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
          <rect x="4.5" y="8.5" width="7" height="4.5" rx="0.5" fill="currentColor" opacity="0.85" />
        </svg>
      </button>
    </div>
  );
}
