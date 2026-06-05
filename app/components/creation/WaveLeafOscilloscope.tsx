/**
 * Groove Lead — reserved scope slot (static; no animated waveform).
 */
import { WAVE_LEAF_UI } from '@/app/lib/creationStation/waveLeafBranding';

export type WaveLeafOscilloscopeProps = {
  height?: number;
};

/** Empty panel area above preview keys — same footprint as the old animated scope. */
export function WaveLeafOscilloscope({ height = 44 }: WaveLeafOscilloscopeProps) {
  return (
    <div
      aria-hidden
      style={{
        height,
        borderRadius: 6,
        border: `1px solid ${WAVE_LEAF_UI.border}`,
        background: `linear-gradient(180deg, ${WAVE_LEAF_UI.bgInset} 0%, ${WAVE_LEAF_UI.bgDeep} 100%)`,
      }}
    />
  );
}
