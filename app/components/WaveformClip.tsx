/**
 * WaveformClip — HD canvas waveform renderer
 * - Deterministic fake waveform seeded by clipId (consistent across re-renders)
 * - Frequency-colored: red for lows/kicks, cyan for mids, blue for highs
 * - Amplitude emphasis scales with vZoom — quiet ghost notes vs big hits
 * - Razor cut markers displayed
 */
import { useEffect, useRef, useMemo } from 'react';


interface Cut { x: number; } // fractional 0-1 within clip


interface WaveformClipProps {
  clipId: number;
  color: string;
  trackType: string; // 'Drum'|'MIDI'|'Audio'|'Vocal'|'Bus'
  width: number;
  height: number;
  vZoom: number;    // 1..8 — vertical amplitude emphasis
  /** When set, draw real peaks from decoded audio instead of the synthetic waveform. */
  audioBuffer?: AudioBuffer | null;
  isRazorActive?: boolean;
  cuts?: Cut[];
  isSelected?: boolean;
  playheadFraction?: number; // 0-1, position of playhead within this clip
  onCut?: (fraction: number) => void;
  label?: string;
}

function peaksFromAudioBuffer(buf: AudioBuffer, pointCount: number): number[] {
  const n = Math.max(32, pointCount);
  const ch =
    buf.numberOfChannels > 0 ? buf.getChannelData(0) : new Float32Array(0);
  const len = ch.length;
  if (len <= 0) return Array.from({ length: n }, () => 0.08);
  const block = len / n;
  const raw: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = Math.floor(i * block);
    const e = Math.min(len, Math.floor((i + 1) * block));
    let peak = 0;
    for (let j = s; j < e; j++) peak = Math.max(peak, Math.abs(ch[j]));
    raw.push(peak);
  }
  const mx = Math.max(0.02, ...raw);
  return raw.map((p) => Math.min(1, (p / mx) * 0.92));
}


// Seeded pseudo-random (mulberry32)

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}


// Color by frequency character based on track type

function getWaveColor(trackType: string, amplitude: number, color: string): string {
  if (trackType === 'Drum') {
    // high amplitude = red (kick/snare), low = blue (hi-hat)
    const r = Math.round(180 + amplitude * 75);
    const g = Math.round(20 + amplitude * 20);
    const b = Math.round(200 - amplitude * 150);
    return `rgb(${r},${g},${b})`;
  }
  if (trackType === 'Vocal') {
    const r = Math.round(255 * amplitude);
    const g = Math.round(100 + 80 * amplitude);
    const b = Math.round(50);
    return `rgba(${r},${g},${b},0.85)`;
  }
  if (trackType === 'MIDI') {
    return color;
  }
  return color;
}


export default function WaveformClip({
  clipId, color, trackType, width, height, vZoom, audioBuffer,
  isRazorActive, cuts = [], isSelected, playheadFraction, onCut, label,
}: WaveformClipProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const waveData = useMemo(() => {
    const points = Math.max(256, width * 2);
    if (audioBuffer) {
      return peaksFromAudioBuffer(audioBuffer, points);
    }
    const rand = seededRand(clipId * 1337 + 42);
    const data: number[] = [];
    let envelope = 0;
    for (let i = 0; i < points; i++) {
      const t = i / points;
      const isTransient = rand() > 0.96;
      const spike = isTransient ? (0.7 + rand() * 0.3) : 0;
      envelope = Math.max(spike, envelope * 0.94);
      const noise = (rand() - 0.5) * 0.3;
      const swell = Math.sin(t * Math.PI * 4 * (1 + rand() * 0.5)) * 0.2;
      const raw = Math.max(0, Math.min(1, envelope + Math.abs(noise) + Math.abs(swell) * 0.5));
      data.push(raw);
    }
    return data;
  }, [clipId, width, audioBuffer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const midY = H / 2;
    const clampedVZoom = Math.min(vZoom, 8);

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = isSelected ? `${color}18` : `${color}0d`;
    ctx.fillRect(0, 0, W, H);

    // Draw waveform
    const step = waveData.length / W;
    for (let x = 0; x < W; x++) {
      const idx = Math.floor(x * step);
      const amp = Math.min(1, waveData[idx] * clampedVZoom);
      const halfH = amp * midY * 0.92;

      // Frequency-based color
      const fillColor = getWaveColor(trackType, amp, color);
      ctx.fillStyle = fillColor;

      // Upper half
      ctx.fillRect(x, midY - halfH, 1, halfH);
      // Lower half (mirrored, slightly dimmer)
      ctx.globalAlpha = 0.6;
      ctx.fillRect(x, midY, 1, halfH);
      ctx.globalAlpha = 1;

      // Emphasize big transients (bright glow)
      if (amp > 0.7) {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = (amp - 0.7) * 0.8;
        ctx.fillRect(x, midY - halfH, 1, 2);
        ctx.globalAlpha = 1;
      }
    }

    // Center line
    ctx.strokeStyle = `${color}44`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(W, midY);
    ctx.stroke();

    // Cut markers
    cuts.forEach(cut => {
      const cx = Math.round(cut.x * W);
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, H);
      ctx.stroke();
      ctx.setLineDash([]);
      // Scissors icon hint
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('✂', cx - 4, 9);
    });

    // Playhead within clip
    if (playheadFraction !== undefined && playheadFraction >= 0 && playheadFraction <= 1) {
      const px = Math.round(playheadFraction * W);
      ctx.strokeStyle = '#D500F9';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#D500F9';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Label
    if (label) {
      ctx.fillStyle = color;
      ctx.font = `bold 9px monospace`;
      ctx.fillText(label, 4, H - 4);
    }

    // Border
    ctx.strokeStyle = isSelected ? color : `${color}55`;
    ctx.lineWidth = isSelected ? 1.5 : 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  }, [waveData, color, trackType, vZoom, cuts, isSelected, playheadFraction, label, audioBuffer]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isRazorActive || !onCut) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    // Snap to 1/64 grid
    const snapped = Math.round(fraction * 64) / 64;
    onCut(snapped);
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleClick}
      style={{ display: 'block', cursor: isRazorActive ? 'crosshair' : 'grab' }}
    />
  );
}
