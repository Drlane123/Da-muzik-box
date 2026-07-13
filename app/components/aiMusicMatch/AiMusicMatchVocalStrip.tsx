'use client';

import { useEffect, useMemo, useRef } from 'react';

const MINT = '#7cf4c6';

function computePeaks(buf: AudioBuffer, bucketCount: number): number[] {
  const buckets = Math.max(8, Math.min(4096, Math.floor(bucketCount)));
  const channels = Math.min(buf.numberOfChannels, 2);
  const len = buf.length;
  if (len <= 0) return Array.from({ length: buckets }, () => 0);
  const step = len / buckets;
  const raw: number[] = new Array(buckets);
  for (let i = 0; i < buckets; i++) {
    let max = 0;
    const j0 = Math.floor(i * step);
    const j1 = Math.min(len, Math.floor((i + 1) * step));
    for (let c = 0; c < channels; c++) {
      const ch = buf.getChannelData(c);
      for (let j = j0; j < j1; j++) {
        const v = Math.abs(ch[j]!);
        if (v > max) max = v;
      }
    }
    raw[i] = max;
  }
  const mx = Math.max(0.001, ...raw);
  return raw.map((p) => Math.min(1, p / mx));
}

export function AiMusicMatchVocalStrip({
  audioBuffer,
  loopBars,
  bpm,
  beatsPerBar = 4,
  previewBeat,
  previewing,
  label = 'Vocals',
}: {
  audioBuffer: AudioBuffer;
  loopBars: number;
  bpm: number;
  beatsPerBar?: number;
  previewBeat: number | null;
  previewing: boolean;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopSec = (loopBars * beatsPerBar * 60) / Math.max(40, bpm);
  const loopSamples = Math.min(audioBuffer.length, Math.floor(audioBuffer.sampleRate * loopSec));

  const peaks = useMemo(() => {
    const cap = Math.min(audioBuffer.length, loopSamples, Math.floor(audioBuffer.sampleRate * 45));
    if (cap <= 0) return Array.from({ length: 320 }, () => 0);
    if (cap >= audioBuffer.length) {
      return computePeaks(audioBuffer, 320);
    }
    const slice = new AudioBuffer({
      length: cap,
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
    });
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      slice.copyToChannel(audioBuffer.getChannelData(c).subarray(0, cap), c);
    }
    return computePeaks(slice, 320);
  }, [audioBuffer, loopSamples]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w <= 0 || h <= 0) return;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0d0d14';
    ctx.fillRect(0, 0, w, h);
    const mid = h / 2;
    const barW = w / Math.max(1, peaks.length);
    for (let i = 0; i < peaks.length; i++) {
      const p = peaks[i] ?? 0;
      const bh = Math.max(1, p * (h * 0.42));
      ctx.fillStyle = `${MINT}88`;
      ctx.fillRect(i * barW, mid - bh, Math.max(1, barW - 0.5), bh * 2);
    }
    for (let bar = 0; bar <= loopBars; bar++) {
      const x = (bar / loopBars) * w;
      ctx.strokeStyle = bar === 0 ? '#444' : '#16161c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    if (previewing && previewBeat != null) {
      const loopBeats = loopBars * beatsPerBar;
      const beatInLoop = ((previewBeat % loopBeats) + loopBeats) % loopBeats;
      const x = (beatInLoop / loopBeats) * w;
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }, [beatsPerBar, loopBars, peaks, previewBeat, previewing]);

  return (
    <div
      className="rounded-lg overflow-hidden flex flex-col"
      style={{ border: '1px solid #2a2a38', background: '#0d0d14' }}
    >
      <div
        className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border-b"
        style={{ color: MINT, borderColor: '#2a2a38', background: 'rgba(0,0,0,0.35)' }}
      >
        {label}
      </div>
      <canvas ref={canvasRef} className="w-full" style={{ height: 56, display: 'block' }} />
    </div>
  );
}
