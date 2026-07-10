import { useEffect, useRef } from 'react';

interface WaveformCanvasProps {
  isRecording: boolean;
  hasAudio: boolean;
  accentColor?: string;
  /** Live mic stream — drives real level meters while recording. */
  meterStream?: MediaStream | null;
}

const BAR_COUNT = 44;
const BAR_GAP = 2;
/** Resting tick height — same low position as the instant you hit Record. */
const REST_LEVEL = 0.012;

function barColor(level: number, accent: string): string {
  if (level > 0.82) return '#ff6b6b';
  if (level > 0.58) return accent;
  if (level > 0.28) return '#7cf4c6';
  return '#2a4a3a';
}

export default function WaveformCanvas({
  isRecording,
  hasAudio,
  accentColor = '#D500F9',
  meterStream = null,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const levelsRef = useRef<number[]>(Array.from({ length: BAR_COUNT }, () => REST_LEVEL));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const freqBufRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (!meterStream || !isRecording) {
      analyserRef.current = null;
      freqBufRef.current = null;
      const ctx = audioCtxRef.current;
      audioCtxRef.current = null;
      if (ctx) void ctx.close();
      return;
    }

    let cancelled = false;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.72;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    const src = ctx.createMediaStreamSource(meterStream);
    src.connect(analyser);
    analyserRef.current = analyser;
    freqBufRef.current = new Uint8Array(analyser.frequencyBinCount);

    void (async () => {
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          /* autoplay */
        }
      }
    })();

    return () => {
      cancelled = true;
      src.disconnect();
      analyserRef.current = null;
      freqBufRef.current = null;
      audioCtxRef.current = null;
      void ctx.close();
      void cancelled;
    };
  }, [isRecording, meterStream]);

  useEffect(() => {
    if (!isRecording) {
      levelsRef.current = Array.from({ length: BAR_COUNT }, () => REST_LEVEL);
    }
  }, [isRecording]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const readLevels = (): number[] => {
      const analyser = analyserRef.current;
      const buf = freqBufRef.current;
      if (!analyser || !buf) return levelsRef.current;

      analyser.getByteFrequencyData(buf);
      const next: number[] = [];
      const binCount = buf.length;
      const binsPerBar = Math.max(1, Math.floor(binCount / BAR_COUNT));

      for (let i = 0; i < BAR_COUNT; i++) {
        let peak = 0;
        const start = i * binsPerBar;
        for (let j = 0; j < binsPerBar; j++) {
          peak = Math.max(peak, buf[start + j] ?? 0);
        }
        const norm = Math.min(1, (peak / 255) * 1.35);
        const prev = levelsRef.current[i] ?? 0;
        const smooth = norm > prev ? prev * 0.35 + norm * 0.65 : prev * 0.78 + norm * 0.22;
        next.push(smooth);
      }
      return next;
    };

    function draw() {
      if (!canvas || !ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = '#141414';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const y = (i / 4) * H;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      const padX = 4;
      const innerW = W - padX * 2;
      const barW = Math.max(2, (innerW - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT);

      if (isRecording && analyserRef.current) {
        levelsRef.current = readLevels();
      } else if (isRecording) {
        for (let i = 0; i < BAR_COUNT; i++) {
          levelsRef.current[i] =
            (levelsRef.current[i] ?? REST_LEVEL) * 0.7 + REST_LEVEL * 0.3;
        }
      } else {
        for (let i = 0; i < BAR_COUNT; i++) {
          levelsRef.current[i] = REST_LEVEL;
        }
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        const level = isRecording
          ? Math.max(REST_LEVEL, Math.min(1, levelsRef.current[i] ?? REST_LEVEL))
          : REST_LEVEL;
        const x = padX + i * (barW + BAR_GAP);
        const barH = Math.max(2, level * (H - 6));
        const y = H - 3 - barH;

        ctx.fillStyle =
          isRecording && level > REST_LEVEL * 2 ? barColor(level, accentColor) : '#1c1c1c';
        if (isRecording && level > 0.18) {
          ctx.shadowBlur = 6;
          ctx.shadowColor = accentColor;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, barW, barH, 1);
        } else {
          ctx.rect(x, y, barW, barH);
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      if (!hasAudio && !isRecording) {
        ctx.fillStyle = '#444';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No audio — record or upload', W / 2, H / 2 + 4);
      } else if (isRecording) {
        ctx.fillStyle = '#555';
        ctx.font = '9px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('INPUT', padX, 11);
      }

      frameRef.current = requestAnimationFrame(draw);
    }

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [accentColor, hasAudio, isRecording]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={80}
      className="w-full rounded"
      style={{ display: 'block' }}
      aria-label={isRecording ? 'Live input level meters' : 'Audio level meters'}
    />
  );
}
