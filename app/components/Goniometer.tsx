/**
 * Goniometer (Vector Scope) — stereo correlation meter
 * Shows the stereo image as an XY Lissajous plot
 * L+R = X axis (mono compatibility), L-R = Y axis (stereo width)
 * Points fade over time creating the "comet tail" look
 */
import { useEffect, useRef } from 'react';

import { useMasterClock } from '@/app/context/MasterClockContext';


interface GoniometerProps {
  size?: number;
  masterLevel: number;
}


export default function Goniometer({ size = 80, masterLevel }: GoniometerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { transport, bpm } = useMasterClock();
  const historyRef = useRef<{ x: number; y: number; age: number }[]>([]);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      if (!ctx || !canvas) return;
      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;
      const r = cx - 4;

      // Fade trail
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, 0, W, H);

      // Background circle
      ctx.strokeStyle = '#2c2c2c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Center crosshair
      ctx.strokeStyle = '#303030';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(cx, 2); ctx.lineTo(cx, H - 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2, cy); ctx.lineTo(W - 2, cy); ctx.stroke();
      // 45° lines
      ctx.beginPath(); ctx.moveTo(cx - r * 0.7, cy + r * 0.7); ctx.lineTo(cx + r * 0.7, cy - r * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - r * 0.7, cy - r * 0.7); ctx.lineTo(cx + r * 0.7, cy + r * 0.7); ctx.stroke();

      // Labels
      ctx.fillStyle = '#333';
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('M', cx, 8);
      ctx.fillText('S', cx, H - 2);
      ctx.textAlign = 'left';
      ctx.fillText('L', 2, cy + 4);
      ctx.textAlign = 'right';
      ctx.fillText('R', W - 2, cy + 4);

      if (transport === 'playing' || transport === 'recording') {
        phaseRef.current += (bpm / 60) * 0.04;
        const beatPhase = phaseRef.current;

        // Simulate stereo image: slight L/R imbalance, pump on beat
        const pump = Math.max(0, masterLevel);
        const lAmp = pump * (0.6 + Math.sin(beatPhase * 2.1) * 0.4);
        const rAmp = pump * (0.6 + Math.cos(beatPhase * 1.9) * 0.4);
        const width = 0.3 + pump * 0.7;

        // Add new points along L-R spread
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + beatPhase * 0.3;
          const lv = lAmp * (0.5 + Math.sin(angle) * 0.5);
          const rv = rAmp * (0.5 + Math.cos(angle) * 0.5);
          const sum = (lv + rv) * 0.5;    // M
          const diff = (lv - rv) * width; // S
          const px = cx + diff * r * 0.9;
          const py = cy - sum * r * 0.9;
          historyRef.current.push({ x: px, y: py, age: 0 });
        }
      }

      // Draw history
      historyRef.current = historyRef.current.filter(p => p.age < 30);
      historyRef.current.forEach(p => {
        const alpha = Math.max(0, 1 - p.age / 30);
        const db = linToDb(masterLevel);
        const col = db >= -6 ? `rgba(255,34,34,${alpha * 0.9})` : db >= -12 ? `rgba(255,204,0,${alpha * 0.9})` : `rgba(0,230,118,${alpha * 0.9})`;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        p.age++;
      });

      // Correlation bar at bottom
      const corr = transport === 'playing' ? (0.5 + masterLevel * 0.5) : 0.5;
      const corrW = (W - 8) * corr;
      ctx.fillStyle = '#242424';
      ctx.fillRect(4, H - 7, W - 8, 4);
      ctx.fillStyle = corr > 0.7 ? '#00e676' : corr > 0.4 ? '#ffcc00' : '#ff2222';
      ctx.fillRect(4, H - 7, corrW, 4);

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [transport, bpm, masterLevel]);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <canvas ref={canvasRef} width={size} height={size}
        style={{ display: 'block', borderRadius: '50%', border: '1px solid #303030', background: '#000' }} />
      <span style={{ fontSize: 7, color: '#444', fontFamily: 'monospace' }}>GONIO</span>
    </div>
  );
}


function linToDb(lin: number): number {
  if (lin <= 0) return -96;
  return Math.max(-96, 20 * Math.log10(lin));
}
