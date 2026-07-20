'use client';

import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';

import {
  isPhonePortraitViewport,
  readViewportSize,
} from '@/app/lib/uiScale';

/**
 * Phones only: block portrait and ask the user to turn sideways (landscape).
 * Tablets and desktop are never gated.
 */
export default function PhoneLandscapeGate() {
  const [needsRotate, setNeedsRotate] = useState(() => {
    if (typeof window === 'undefined') return false;
    const vp = readViewportSize();
    return isPhonePortraitViewport(vp.width, vp.height);
  });

  useEffect(() => {
    const sync = () => {
      const vp = readViewportSize();
      setNeedsRotate(isPhonePortraitViewport(vp.width, vp.height));
    };
    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    window.visualViewport?.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      window.visualViewport?.removeEventListener('resize', sync);
    };
  }, []);

  if (!needsRotate) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rotate phone to landscape"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: 28,
        textAlign: 'center',
        background:
          'radial-gradient(900px 500px at 50% 20%, rgba(0,229,255,0.12), transparent 55%), #07090c',
        color: '#d4dce8',
        fontFamily: 'Rajdhani, sans-serif',
      }}
    >
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(0,229,255,0.45)',
          background: 'rgba(0,229,255,0.08)',
          color: '#00E5FF',
          transform: 'rotate(90deg)',
        }}
      >
        <Smartphone size={44} strokeWidth={1.75} aria-hidden />
      </div>
      <div
        style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: '#fff',
        }}
      >
        Turn your phone sideways
      </div>
      <p
        style={{
          margin: 0,
          maxWidth: 320,
          fontSize: 15,
          lineHeight: 1.45,
          color: 'rgba(212,220,232,0.65)',
        }}
      >
        Da Muzik Box is built for landscape on phones. Rotate to horizontal to open
        the app — portrait mode stays locked.
      </p>
    </div>
  );
}
