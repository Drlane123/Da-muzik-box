import { useEffect, useRef } from 'react';


interface WaveformCanvasProps {
  isRecording: boolean;
  hasAudio: boolean;
  accentColor?: string;
}


export default function WaveformCanvas({ isRecording, hasAudio, accentColor = '#D500F9' }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      if (!canvas || !ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const y = (i / 8) * H;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Center line
      ctx.strokeStyle = '#2a2a2a';
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();

      if (isRecording || hasAudio) {
        phaseRef.current += isRecording ? 0.08 : 0.02;
        const amp = isRecording ? 0.38 : 0.18;
        const freq = isRecording ? 3 : 2;

        // Draw waveform
        ctx.beginPath();
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.shadowBlur = isRecording ? 10 : 4;
        ctx.shadowColor = accentColor;

        for (let x = 0; x < W; x++) {
          const t = (x / W) * Math.PI * 2 * freq + phaseRef.current;
          const noise = isRecording ? (Math.random() - 0.5) * 0.12 : 0;
          const y = H / 2 + Math.sin(t) * H * amp * (0.8 + Math.sin(t * 2.3) * 0.2) + noise * H;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Fill under waveform
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = accentColor;
        ctx.lineTo(W, H / 2);
        ctx.lineTo(0, H / 2);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        // Idle flat line
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();

        ctx.fillStyle = '#333';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('No audio — record or upload', W / 2, H / 2 - 12);
      }

      frameRef.current = requestAnimationFrame(draw);
    }

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [isRecording, hasAudio, accentColor]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={80}
      className="w-full rounded"
      style={{ display: 'block' }}
    />
  );
}
