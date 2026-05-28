import React, { useEffect, useRef, useState } from 'react';
import {
  midiToShortLabel,
  subscribeBeatLabSynthV2GlidePulse,
  type BeatLabSynthV2GlidePulse,
} from '@/app/lib/creationStation/beatLabSynthV2GlidePulse';

type Props = {
  lane: number;
};

type GlideFrame = {
  fromMidi: number;
  toMidi: number;
  /** 0–1 through the engine’s linear pitch ramp (wall-clock). */
  t: number;
  label: string;
};

/**
 * Live portamento motion for the GLIDE FX channel strip — matches engine linearRamp glide.
 */
export function BeatLabSynthV2GlideActivityMeter({ lane }: Props) {
  const [frame, setFrame] = useState<GlideFrame | null>(null);
  const rafRef = useRef(0);
  const activeRef = useRef<BeatLabSynthV2GlidePulse | null>(null);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  useEffect(() => {
    return subscribeBeatLabSynthV2GlidePulse((p) => {
      if (!p || p.lane !== lane) return;
      activeRef.current = p;
      cancelAnimationFrame(rafRef.current);
      const durationMs = Math.max(12, p.durationSec * 1000);

      const tick = () => {
        const pulse = activeRef.current;
        if (!pulse || pulse.lane !== lane) return;

        const elapsed = performance.now() - pulse.startPerfMs;
        const t = Math.min(1, elapsed / durationMs);
        const curMidi = pulse.fromMidi + (pulse.toMidi - pulse.fromMidi) * t;

        const lo = Math.min(pulse.fromMidi, pulse.toMidi);
        const hi = Math.max(pulse.fromMidi, pulse.toMidi);
        const span = Math.max(1e-6, hi - lo);
        const pctFromBottom = (curMidi - lo) / span;

        setFrame({
          fromMidi: pulse.fromMidi,
          toMidi: pulse.toMidi,
          t,
          label:
            t < 0.995
              ? `${midiToShortLabel(pulse.fromMidi)} → ${midiToShortLabel(pulse.toMidi)}`
              : `${midiToShortLabel(pulse.toMidi)} · landed`,
        });

        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };

      tick();
    });
  }, [lane]);

  const f = frame;
  const t = f?.t ?? 0;
  const lo = f ? Math.min(f.fromMidi, f.toMidi) : 0;
  const hi = f ? Math.max(f.fromMidi, f.toMidi) : 0;
  const span = Math.max(1e-6, hi - lo);
  const curMidi = f ? f.fromMidi + (f.toMidi - f.fromMidi) * t : 0;
  const pctFromBottom = f ? (curMidi - lo) / span : 0.5;

  return (
    <div
      style={{
        flex: '1 1 148px',
        minWidth: 132,
        maxWidth: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        justifyContent: 'center',
      }}
      title="Live glide / slide on this synth lane (matches audio portamento)"
    >
      <div style={{ fontSize: 8, fontWeight: 800, color: '#c8b8e8', letterSpacing: 0.4 }}>
        GLIDE MOTION
      </div>
      <div
        style={{
          position: 'relative',
          height: 44,
          borderRadius: 6,
          border: '1px solid rgba(184, 140, 255, 0.35)',
          background: 'linear-gradient(180deg, rgba(184,140,255,0.08) 0%, rgba(6,8,14,0.95) 100%)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${Math.round(t * 100)}%`,
            background: 'linear-gradient(180deg, rgba(184,140,255,0.35) 0%, rgba(120,90,200,0.12) 100%)',
            pointerEvents: 'none',
          }}
        />
        {f ? (
          <>
            <div
              style={{
                position: 'absolute',
                left: 4,
                right: 4,
                bottom: `${pctFromBottom * 100}%`,
                height: 3,
                marginBottom: -1.5,
                borderRadius: 2,
                background: 'rgba(255, 230, 180, 0.95)',
                boxShadow: '0 0 8px rgba(255,220,140,0.55)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 2,
                left: 5,
                fontSize: 7,
                fontWeight: 800,
                color: '#9aa6bc',
              }}
            >
              {midiToShortLabel(Math.max(f.fromMidi, f.toMidi))}
            </div>
            <div
              style={{
                position: 'absolute',
                bottom: 2,
                left: 5,
                fontSize: 7,
                fontWeight: 800,
                color: '#9aa6bc',
              }}
            >
              {midiToShortLabel(Math.min(f.fromMidi, f.toMidi))}
            </div>
          </>
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 8,
              fontWeight: 700,
              color: '#5c687c',
            }}
          >
            Play overlapping notes…
          </div>
        )}
      </div>
      <div style={{ fontSize: 8, fontWeight: 700, color: '#8a9aaf', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {f ? f.label : '— idle —'}
      </div>
    </div>
  );
}
