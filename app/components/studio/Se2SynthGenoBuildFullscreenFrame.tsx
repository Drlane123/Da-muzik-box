'use client';

import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Minimize2 } from 'lucide-react';
import { Se2SynthGenoPlatinumMark } from '@/app/components/studio/Se2SynthGenoPlatinumMark';

export function useSe2SynthGenoBuildFullscreenEsc(expanded: boolean, onMinimize: () => void) {
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMinimize();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, onMinimize]);
}

export function Se2SynthGenoBuildFullscreenPlaceholder({
  accentHex,
  label,
}: {
  accentHex: string;
  label: string;
}) {
  return (
    <div
      className="w-full rounded-lg border px-3 py-2 shrink-0"
      style={{ borderColor: `${accentHex}44`, background: `${accentHex}08` }}
    >
      <span
        className="text-[8px] font-bold uppercase tracking-wide opacity-75"
        style={{ color: accentHex }}
      >
        {label} · full screen — Minimize or Esc
      </span>
    </div>
  );
}

function genoBuildTitleStyle(accentHex: string): CSSProperties {
  return {
    fontFamily: 'Orbitron, "Audiowide", "Exo 2", "Rajdhani", system-ui, sans-serif',
    fontWeight: 800,
    fontStyle: 'italic',
    fontSize: 22,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    lineHeight: 1.15,
    whiteSpace: 'nowrap',
    display: 'inline-block',
    transform: 'skewX(-10deg)',
    color: accentHex,
    textShadow: `0 1px 2px rgba(0, 0, 0, 0.45)`,
  };
}

export type Se2SynthGenoBuildFullscreenFrameProps = {
  expanded: boolean;
  accentHex: string;
  label: string;
  subtitle?: ReactNode;
  disabled?: boolean;
  onMinimize: () => void;
  children: ReactNode;
};

/** Geno Build 1 / 2 — full-viewport editor shell (Fusion roll pattern). */
export function Se2SynthGenoBuildFullscreenFrame({
  expanded,
  accentHex,
  label,
  subtitle,
  disabled,
  onMinimize,
  children,
}: Se2SynthGenoBuildFullscreenFrameProps) {
  useSe2SynthGenoBuildFullscreenEsc(expanded, onMinimize);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (expanded) {
      document.body.setAttribute('data-studio-geno-build-fullscreen', '');
    } else {
      document.body.removeAttribute('data-studio-geno-build-fullscreen');
    }
    return () => document.body.removeAttribute('data-studio-geno-build-fullscreen');
  }, [expanded]);

  if (!expanded || typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-studio-synth-geno-build-fullscreen
      className="fixed inset-0 z-[99900] flex flex-col w-screen h-[100dvh] max-w-none overflow-hidden"
      style={{
        background: 'linear-gradient(165deg, #1e1e26 0%, #07070b 55%, #060609 100%)',
        color: '#dcdce8',
      }}
    >
      <div
        className="relative shrink-0 w-full border-b px-4 py-2"
        style={{ borderColor: `${accentHex}33`, background: `${accentHex}10` }}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={onMinimize}
          className="absolute top-1.5 right-2 z-20 shrink-0 rounded-md border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide disabled:opacity-40 inline-flex items-center gap-1 outline-none transition-colors hover:bg-white/[0.06]"
          style={{
            borderColor: `${accentHex}88`,
            background: `${accentHex}22`,
            color: accentHex,
          }}
          title="Minimize back to dock (Esc)"
        >
          <Minimize2 size={11} aria-hidden />
          Minimize
        </button>

        <div className="flex flex-col items-center justify-center gap-1 text-center px-10 sm:px-14">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
            <Se2SynthGenoPlatinumMark size="title" />
            <span style={genoBuildTitleStyle(accentHex)}>{label}</span>
          </div>
          {subtitle ? (
            <p className="text-[9px] leading-snug max-w-2xl mx-auto" style={{ color: '#a8a8b8' }}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div className="flex flex-col gap-3 w-full min-w-0 px-2 pb-8 pt-2 sm:px-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
