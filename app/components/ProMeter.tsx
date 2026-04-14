/**
 * ProMeter — Professional Peak+RMS dual-segment meter
 * - Green (-∞ to -12dB) → Yellow (-12 to -6dB) → Red (-6 to 0dB)
 * - Solid RMS body + fast thin peak hold line
 * - Sweet spot marker at -6dB
 * - Canvas-based for zero-lag rendering
 */
import { useEffect, useRef } from 'react';

interface ProMeterProps {
  level: number;      // 0..1 linear (maps to 0dB peak)
  peakLevel?: number; // separate peak hold, 0..1
  width?: number;
  height?: number;
  vertical?: boolean;
  label?: string;
  showDb?: boolean;
}

// linear 0..1 → dB  (-∞ to 0)
function linToDb(lin: number): number {
  if (lin <= 0) return -96;
  return Math.max(-96, 20 * Math.log10(lin));
}

// dB → 0..1 meter position  (-48dB bottom, 0dB top)
function dbToPos(db: number): number {
  return Math.max(0, Math.min(1, (db + 48) / 48));
}

// dB → color — Light sky blue theme
function dbToColor(db: number): string {
  if (db >= -6) return '#0ea5e9';
  if (db >= -12) return '#38bdf8';
  return '#7dd3fc';
}

export default function ProMeter({
  level, peakLevel, width = 14, height = 80, vertical = true, label, showDb = false,
}: ProMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peakRef = useRef(level);
  const peakDecayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Peak hold with slow decay
  if (level > peakRef.current) {
    peakRef.current = level;
    if (peakDecayRef.current) clearInterval(peakDecayRef.current);
    let decayCount = 0;
    peakDecayRef.current = setInterval(() => {
      if (decayCount++ > 20) {
        peakRef.current = Math.max(0, peakRef.current - 0.015);
      }
      if (peakRef.current <= 0) {
        clearInterval(peakDecayRef.current!);
        peakDecayRef.current = null;
      }
    }, 40);
  }

  useEffect(() => {
    return () => { if (peakDecayRef.current) clearInterval(peakDecayRef.current); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    if (vertical) {
      const rmsDb = linToDb(level);
      const peakDb = linToDb(peakLevel ?? peakRef.current);
      const rmsPos = dbToPos(rmsDb);
      const peakPos = dbToPos(peakDb);

      // Draw RMS body — gradient segments from bottom
      const rmsH = rmsPos * H;
      const rmsY = H - rmsH;

      // Draw in 3 color bands
      const thresholds = [
        { db: -48, color: '#00e676' },
        { db: -12, color: '#ffcc00' },
        { db: -6,  color: '#ff2222' },
      ];

      for (let seg = 0; seg < thresholds.length; seg++) {
        const segStartDb = thresholds[seg].db;
        const segEndDb = seg + 1 < thresholds.length ? thresholds[seg + 1].db : 0;
        const segStartPos = dbToPos(segStartDb);
        const segEndPos = dbToPos(segEndDb);
        const segStartY = H - segEndPos * H;
        const segEndY = H - segStartPos * H;
        const fillEnd = H - rmsPos * H;
        const actualEndY = Math.max(fillEnd, segStartY);

        if (actualEndY < segEndY) {
          ctx.fillStyle = thresholds[seg].color;
          ctx.globalAlpha = 0.85;
          ctx.fillRect(1, actualEndY, W - 2, segEndY - actualEndY);
          ctx.globalAlpha = 1;
        }
      }

      // Glow on active body
      if (rmsDb > -48) {
        ctx.shadowColor = dbToColor(rmsDb);
        ctx.shadowBlur = 4;
        ctx.fillStyle = dbToColor(rmsDb);
        ctx.globalAlpha = 0.15;
        ctx.fillRect(0, rmsY, W, rmsH);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      // Peak hold line (bright thin line)
      if (peakDb > -48) {
        const peakY = H - peakPos * H;
        ctx.fillStyle = dbToColor(peakDb);
        ctx.globalAlpha = 0.95;
        ctx.fillRect(0, peakY - 1, W, 2);
        ctx.globalAlpha = 1;
        // Peak glow
        ctx.shadowColor = dbToColor(peakDb);
        ctx.shadowBlur = 6;
        ctx.fillRect(0, peakY - 1, W, 2);
        ctx.shadowBlur = 0;
      }

      // -6dB sweet spot marker (white tick)
      const sweetY = H - dbToPos(-6) * H;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.4;
      ctx.fillRect(0, sweetY, W, 1);
      ctx.globalAlpha = 1;

      // -12dB marker
      const midY = H - dbToPos(-12) * H;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.15;
      ctx.fillRect(0, midY, W, 1);
      ctx.globalAlpha = 1;

      // Border
      ctx.strokeStyle = '#1e1e1e';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

      // dB label
      if (showDb && rmsDb > -48) {
        ctx.fillStyle = dbToColor(rmsDb);
        ctx.font = '7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(rmsDb.toFixed(0), W / 2, H - 2);
      }
    }
  });

  return (
    <div className="flex flex-col items-center gap-0.5">
      <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block', imageRendering: 'pixelated' }} />
      {label && <span style={{ fontSize: 7, color: '#444', fontFamily: 'monospace', textAlign: 'center', maxWidth: width }}>{label}</span>}
    </div>
  );
}
