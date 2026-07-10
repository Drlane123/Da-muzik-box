'use client';

import {
  GENO_LANE_PREVIEW_GAIN_MAX,
  genoLanePreviewGainFromSlider,
  genoLanePreviewGainSliderValue,
} from '@/app/lib/studio/se2SynthGenoLanePreviewGains';

export type Se2SynthGenoLaneVolumeSliderProps = {
  value: number;
  onChange: (gain: number) => void;
  color?: string;
  disabled?: boolean;
  laneEnabled?: boolean;
};

/** Preview-only volume — each Geno loop lane toolbar (B01 / B02). */
export function Se2SynthGenoLaneVolumeSlider({
  value,
  onChange,
  color = '#9a9aaa',
  disabled,
  laneEnabled = true,
}: Se2SynthGenoLaneVolumeSliderProps) {
  const slider = genoLanePreviewGainSliderValue(value);
  const off = disabled || !laneEnabled;
  return (
    <div
      className="flex items-center gap-1 min-w-0 shrink"
      title={`Preview mix only (0–${Math.round(GENO_LANE_PREVIEW_GAIN_MAX * 100)}%)`}
    >
      <span className="text-[5px] font-bold uppercase tracking-widest opacity-40 shrink-0">Vol</span>
      <input
        type="range"
        min={0}
        max={150}
        step={1}
        disabled={off}
        value={slider}
        onChange={(e) => onChange(genoLanePreviewGainFromSlider(Number(e.target.value)))}
        className="w-14 h-1 shrink min-w-[3rem] disabled:opacity-35"
        style={{ accentColor: color }}
        aria-label="Lane preview volume"
      />
      <span className="text-[5px] font-mono tabular-nums w-7 shrink-0 text-right" style={{ color: off ? '#555' : color }}>
        {slider}%
      </span>
    </div>
  );
}
