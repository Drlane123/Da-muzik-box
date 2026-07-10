/**
 * MasterVU — Large always-visible master level display anchored to the top bar
 * Shows peak+RMS, LUFS estimate, and pumping animation
 */
import { useEffect, useRef } from 'react';
import { useMasterClock } from '@/app/context/MasterClockContext';

function linToDb(lin: number): number {
  if (lin <= 0) return -96;
  return Math.max(-96, 20 * Math.log10(lin));
}

interface MasterVUProps {
  masterLevel: number;
  /** Meter width in px — default 120; ~200 sits under transport + loop row */
  barWidth?: number;
}

export default function MasterVU({ masterLevel, barWidth = 120 }: MasterVUProps) {
  const { transport } = useMasterClock();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peakHoldRef = useRef(0);
  const peakTimerRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      if (!ctx || !canvas) return;
      const W = canvas.width;
      const H = canvas.height;

      // Peak hold
      if (masterLevel > peakHoldRef.current) {
        peakHoldRef.current = masterLevel;
        peakTimerRef.current = 60;
      } else {
        peakTimerRef.current--;
        if (peakTimerRef.current <= 0) {
          peakHoldRef.current = Math.max(0, peakHoldRef.current - 0.008);
        }
      }

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, W, H);

      const db = linToDb(masterLevel);
      const peakDb = linToDb(peakHoldRef.current);

      // Color
      const color = db >= -6 ? '#ff2222' : db >= -12 ? '#ffcc00' : '#00e676';

      // RMS fill (horizontal)
      const fillW = Math.max(0, ((db + 48) / 48)) * (W - 2);
      // Green segment
      const greenW = Math.min(fillW, ((36) / 48) * (W - 2)); // up to -12dB
      const yellowW = Math.max(0, Math.min(fillW - greenW, (6 / 48) * (W - 2))); // -12 to -6
      const redW = Math.max(0, fillW - greenW - yellowW); // -6 to 0

      if (greenW > 0) {
        ctx.fillStyle = '#00e676';
        ctx.globalAlpha = 0.9;
        ctx.fillRect(1, 1, greenW, H - 2);
      }
      if (yellowW > 0) {
        ctx.fillStyle = '#ffcc00';
        ctx.globalAlpha = 0.9;
        ctx.fillRect(1 + greenW, 1, yellowW, H - 2);
      }
      if (redW > 0) {
        ctx.fillStyle = '#ff2222';
        ctx.globalAlpha = 0.9;
        ctx.fillRect(1 + greenW + yellowW, 1, redW, H - 2);
      }
      ctx.globalAlpha = 1;

      // Glow on body
      if (db > -48) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.1;
        ctx.fillRect(1, 1, fillW, H - 2);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      // Peak hold line
      const peakX = Math.max(0, ((peakDb + 48) / 48)) * (W - 2);
      if (peakHoldRef.current > 0.01) {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.9;
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 4;
        ctx.fillRect(peakX, 0, 2, H);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // -6dB sweet spot tick
      const sweetX = ((42) / 48) * (W - 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.3;
      ctx.fillRect(sweetX, 0, 1, H);
      ctx.globalAlpha = 1;

      // Tick marks
      [-48, -36, -24, -18, -12, -6, -3, 0].forEach(tDb => {
        const tx = Math.max(0, ((tDb + 48) / 48)) * (W - 2);
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(tx, H - 4, 1, 4);
      });

      // Border
      ctx.strokeStyle = db >= -6 ? '#ff222244' : db >= -12 ? '#ffcc0044' : '#00e67644';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [masterLevel, transport]);

  const db = linToDb(masterLevel);
  const color = db >= -6 ? '#ff2222' : db >= -12 ? '#ffcc00' : '#00e676';

  return (
    <div className="flex flex-col gap-0.5 shrink-0" style={{ width: barWidth }}>
      <div className="flex items-center justify-between px-0.5">
        <span style={{ fontSize: 7, color: '#444', fontFamily: 'monospace' }}>MASTER</span>
        <span className="font-mono font-bold" style={{ fontSize: 8, color }}>
          {db > -96 ? `${db.toFixed(1)}dB` : '-∞'}
        </span>
      </div>
      <canvas ref={canvasRef} width={barWidth} height={10} style={{ display: 'block' }} />
    </div>
  );
}
