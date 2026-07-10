'use client';

import { useEffect, useRef, useState, memo, type CSSProperties } from 'react';
import { MuzikBootBackdropVideo } from '@/app/components/MuzikBootBackdropVideo';
import { preloadBeatLabBootChunk, setBootSplashCovering } from '@/app/lib/boot/beatLabBootGate';

function readHtmlBootProgress(): number {
  if (typeof window === 'undefined') return 0;
  const w = window as Window & { __daMuzikBootPct?: number };
  const n = w.__daMuzikBootPct;
  if (typeof n === 'number' && Number.isFinite(n)) {
    return Math.max(0, Math.min(100, Math.floor(n)));
  }
  return 0;
}

const isDevBoot = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

const MIN_BOOT_SPLASH_MS = isDevBoot ? 2200 : 8500;
const POST_READY_HOLD_MS = isDevBoot ? 500 : 4200;
const ABSOLUTE_MAX_BOOT_MS = isDevBoot ? 10000 : 90000;

const BOOT_RISE_FEATURES = [
  'Studio Editor 2',
  'SE2 Chord Generator',
  'Beat Lab',
  'Beat Pads',
  'Groove Lab',
  'Drum Generator',
  'Creation Station',
  'Bass Glide',
  'Synth Geno',
  'Groove Lead',
  'Geno Ultra Synth',
  'Geno Bass Synth',
  'Guitar',
  'Track Align',
  'Lane Placements',
  'AI Vocal Lab',
] as const;

/** Unique glide path per module — no shared lanes, timing, or motion sync. */
type BootRiseProfile = {
  left: number;
  delay: number;
  duration: number;
  drift: number;
  variant: 'a' | 'b';
};

const BOOT_RISE_PROFILES: BootRiseProfile[] = [
  { left: 10, delay: 0.0, duration: 3.52, drift: -7, variant: 'a' },
  { left: 27, delay: 1.45, duration: 4.18, drift: 6, variant: 'b' },
  { left: 45, delay: 0.62, duration: 3.38, drift: -4, variant: 'a' },
  { left: 62, delay: 2.25, duration: 4.42, drift: 8, variant: 'b' },
  { left: 79, delay: 0.95, duration: 3.72, drift: -6, variant: 'a' },
  { left: 15, delay: 3.35, duration: 4.08, drift: 5, variant: 'b' },
  { left: 33, delay: 1.82, duration: 3.64, drift: -8, variant: 'a' },
  { left: 51, delay: 4.15, duration: 4.28, drift: 7, variant: 'b' },
  { left: 68, delay: 2.68, duration: 3.46, drift: -5, variant: 'a' },
  { left: 86, delay: 0.28, duration: 4.55, drift: 4, variant: 'b' },
  { left: 22, delay: 3.78, duration: 3.88, drift: -3, variant: 'a' },
  { left: 40, delay: 1.18, duration: 4.62, drift: 9, variant: 'b' },
  { left: 57, delay: 2.92, duration: 3.98, drift: -7, variant: 'a' },
  { left: 74, delay: 4.48, duration: 3.58, drift: 6, variant: 'b' },
  { left: 8, delay: 2.05, duration: 4.12, drift: -2, variant: 'a' },
  { left: 49, delay: 3.58, duration: 3.82, drift: 5, variant: 'b' },
];

function riseItemStyle(index: number): CSSProperties {
  const profile = BOOT_RISE_PROFILES[index % BOOT_RISE_PROFILES.length];
  return {
    left: `${profile.left}%`,
    animationDelay: `${profile.delay}s`,
    animationDuration: `${profile.duration}s`,
    ['--rise-drift' as string]: `${profile.drift}px`,
  };
}

function riseItemClass(index: number): string {
  const variant = BOOT_RISE_PROFILES[index % BOOT_RISE_PROFILES.length]?.variant ?? 'a';
  return `muzik-boot-rise-item muzik-boot-rise-item--${variant}`;
}

const MuzikBootSplashFooter = memo(function MuzikBootSplashFooter() {
  return (
    <footer className="muzik-boot-footer" aria-hidden>
      <div className="muzik-boot-rise-field">
        {BOOT_RISE_FEATURES.map((name, i) => (
          <span key={name} className={riseItemClass(i)} style={riseItemStyle(i)}>
            {name}
          </span>
        ))}
      </div>
      <div className="muzik-boot-footer-meta">
        <span className="muzik-boot-footer-brand">The Music Box</span>
        <span className="muzik-boot-footer-dot" aria-hidden>
          ·
        </span>
        <span className="muzik-boot-footer-gendaw">Gen-DAW</span>
      </div>
      <div className="muzik-boot-footer-version">Version 1.4</div>
    </footer>
  );
});

function setBootProgressUi(
  barFill: HTMLDivElement | null,
  pctEl: HTMLSpanElement | null,
  value: number,
) {
  const clamped = Math.max(0, Math.min(100, Math.floor(value)));
  if (barFill) barFill.style.width = `${clamped}%`;
  if (pctEl) pctEl.textContent = `${clamped}%`;
}

export type DaMuzikBoxBootSplashProps = {
  onComplete: () => void;
};

/**
 * Full-screen first-load splash — stays until Beat Lab chunk is loaded + extra hold.
 */
export function DaMuzikBoxBootSplash({ onComplete }: DaMuzikBoxBootSplashProps) {
  const [phase, setPhase] = useState<'loading' | 'out'>('loading');
  const [caption, setCaption] = useState('Starting DA MUZIK BOX...');
  const doneRef = useRef(false);
  const releaseAtRef = useRef<number | null>(null);
  const releaseScheduledRef = useRef(false);
  const milestoneRef = useRef(-1);
  const progressRef = useRef(Math.max(8, readHtmlBootProgress()));
  const barFillRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setBootProgressUi(barFillRef.current, pctRef.current, progressRef.current);
    const htmlSplash = document.getElementById('boot-splash');
    if (htmlSplash) htmlSplash.remove();

    setBootSplashCovering(true);

    const milestones: { at: number; cap: string }[] = [
      { at: 600, cap: 'Loading core engine...' },
      { at: 2200, cap: 'Wiring audio and transport...' },
      { at: 4500, cap: 'Loading effects and instruments...' },
      { at: 7000, cap: 'Preparing your studio...' },
      { at: 11000, cap: 'Setting up pads and patterns...' },
      { at: 16000, cap: 'Almost ready...' },
    ];

    let cancelled = false;
    let raf = 0;
    const start = performance.now();
    let beatLabReadyAt: number | null = null;

    const finishSplash = () => {
      if (doneRef.current || cancelled) return;
      doneRef.current = true;
      cancelAnimationFrame(raf);
      progressRef.current = 100;
      setBootProgressUi(barFillRef.current, pctRef.current, 100);
      setCaption('Welcome to DA MUZIK BOX');
      window.setTimeout(() => {
        if (cancelled) return;
        setPhase('out');
        window.setTimeout(() => {
          setBootSplashCovering(false);
          onComplete();
        }, 560);
      }, 480);
    };

    const scheduleRelease = () => {
      if (beatLabReadyAt == null || releaseScheduledRef.current) return;
      releaseScheduledRef.current = true;
      const releaseAt = Math.max(
        start + MIN_BOOT_SPLASH_MS,
        beatLabReadyAt + POST_READY_HOLD_MS,
      );
      releaseAtRef.current = releaseAt;
      const waitMs = Math.max(0, releaseAt - performance.now());
      window.setTimeout(() => {
        if (!cancelled && !doneRef.current) finishSplash();
      }, waitMs);
    };

    const tick = (now: number) => {
      if (cancelled || doneRef.current) return;
      const elapsed = now - start;
      for (let i = milestones.length - 1; i >= 0; i--) {
        if (elapsed >= milestones[i].at && milestoneRef.current < i) {
          milestoneRef.current = i;
          setCaption(milestones[i].cap);
          break;
        }
      }

      const releaseAt = releaseAtRef.current ?? start + MIN_BOOT_SPLASH_MS + POST_READY_HOLD_MS;
      const progressSpan = Math.max(1200, releaseAt - start - 600);
      const crawl = Math.min(94, 8 + ((elapsed / progressSpan) * 86));
      const nearEnd = elapsed >= releaseAt - 500;
      const target = nearEnd ? 100 : crawl;
      if (target > progressRef.current) {
        progressRef.current = Math.floor(target);
        setBootProgressUi(barFillRef.current, pctRef.current, progressRef.current);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    preloadBeatLabBootChunk()
      .then(() => {
        if (cancelled) return;
        beatLabReadyAt = performance.now();
        setCaption('Finalizing studio...');
        scheduleRelease();
      })
      .catch(() => {
        if (cancelled) return;
        beatLabReadyAt = performance.now();
        scheduleRelease();
      });

    const forceTimer = window.setTimeout(() => {
      if (cancelled || doneRef.current) return;
      beatLabReadyAt = beatLabReadyAt ?? performance.now();
      scheduleRelease();
    }, ABSOLUTE_MAX_BOOT_MS);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(forceTimer);
      setBootSplashCovering(false);
    };
  }, [onComplete]);

  return (
    <div
      className={`muzik-boot-overlay${phase === 'out' ? ' muzik-boot-overlay--out' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={phase === 'loading'}
      aria-label="Loading DA MUZIK BOX"
    >
      <header className="muzik-boot-header">
        <h1 className="muzik-boot-gold-title">
          <span className="muzik-boot-gold-title-line">D A</span>
          <span className="muzik-boot-gold-title-line">M U Z I K</span>
          <span className="muzik-boot-gold-title-line muzik-boot-gold-title-line--box">B O X</span>
        </h1>
      </header>

      <div className="muzik-boot-stage">
        <div className="muzik-boot-cube-wrap">
          <MuzikBootBackdropVideo />
        </div>

        <div className="muzik-boot-load">
          <div className="muzik-boot-bar-track" aria-hidden>
            <div ref={barFillRef} className="muzik-boot-bar-fill" />
          </div>
          <span ref={pctRef} className="muzik-boot-pct">
            {progressRef.current}%
          </span>
          <span className="muzik-boot-caption">{caption}</span>
        </div>
      </div>

      <MuzikBootSplashFooter />
    </div>
  );
}
