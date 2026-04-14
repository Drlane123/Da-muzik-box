/**
 * Live recording lane — flat tint only (no synthetic waveform / animation).
 */
import { useEffect, useRef, useState } from 'react';

type Props = {
  height: number;
  startBeat0: number;
  pixelsPerBeat: number;
  getCurrentBeat: () => number;
};

export default function RecordingWaveShade({
  height,
  startBeat0,
  pixelsPerBeat,
  getCurrentBeat,
}: Props) {
  const rafRef = useRef(0);
  const [widthPx, setWidthPx] = useState(12);

  useEffect(() => {
    const tick = () => {
      const end = getCurrentBeat();
      const spanBeats = Math.max(1 / 8, end - startBeat0);
      const w = Math.max(12, Math.min(16384, spanBeats * pixelsPerBeat));
      setWidthPx(w);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [height, startBeat0, pixelsPerBeat, getCurrentBeat]);

  return (
    <div
      style={{
        display: 'block',
        width: widthPx,
        height,
        background: 'linear-gradient(180deg, rgba(252,165,165,0.35), rgba(127,29,29,0.2))',
        borderRight: '1px solid rgba(248,113,113,0.5)',
        boxSizing: 'border-box',
      }}
      aria-hidden
    />
  );
}
