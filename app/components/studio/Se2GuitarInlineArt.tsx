'use client';

import { useEffect, useRef } from 'react';

const GUITAR_SRC = '/ref-acoustic-guitar.svg';

export type Se2GuitarInlineArtProps = {
  onLoadError?: () => void;
};

/** Decorative guitar SVG — interaction lives on {@link Se2GuitarNeckOverlay}. */
export function Se2GuitarInlineArt({ onLoadError }: Se2GuitarInlineArtProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(GUITAR_SRC)
      .then((r) => {
        if (!r.ok) throw new Error('svg fetch failed');
        return r.text();
      })
      .then((text) => {
        if (cancelled || !hostRef.current) return;
        hostRef.current.innerHTML = text;
        const svg = hostRef.current.querySelector('svg');
        if (svg) {
          svg.setAttribute('width', '100%');
          svg.setAttribute('height', '100%');
          svg.setAttribute('preserveAspectRatio', 'none');
          svg.style.display = 'block';
          svg.style.pointerEvents = 'none';
        }
      })
      .catch(() => onLoadError?.());

    return () => {
      cancelled = true;
    };
  }, [onLoadError]);

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
      data-se2-guitar-inline-art
      aria-hidden
    />
  );
}
