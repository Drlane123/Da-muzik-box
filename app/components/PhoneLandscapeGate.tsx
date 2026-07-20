'use client';

import { useEffect, useState } from 'react';
import { RotateCw, Smartphone, X } from 'lucide-react';

import {
  isPhonePortraitViewport,
  readViewportSize,
} from '@/app/lib/uiScale';

const DISMISS_KEY = 'dmb-phone-rotate-hint-dismissed';

/**
 * Phones only: soft “turn sideways” hint in portrait.
 * Does NOT lock or block the UI (Facebook / in-app browsers break with hard locks).
 * Tablets and desktop never see this.
 */
export default function PhoneLandscapeGate() {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* ignore */
    }

    const sync = () => {
      const vp = readViewportSize();
      const portrait = isPhonePortraitViewport(vp.width, vp.height);
      setShowHint(portrait && !dismissed);
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

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setShowHint(false);
  };

  if (!showHint) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Tip: turn phone sideways for a better view"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'max(12px, env(safe-area-inset-bottom))',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 12,
        border: '1px solid rgba(0,229,255,0.4)',
        background: 'rgba(7, 9, 12, 0.92)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
        color: '#d4dce8',
        fontFamily: 'Rajdhani, sans-serif',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,229,255,0.1)',
          color: '#00E5FF',
          position: 'relative',
        }}
      >
        <Smartphone size={18} strokeWidth={2} aria-hidden />
        <RotateCw
          size={12}
          strokeWidth={2.5}
          aria-hidden
          style={{ position: 'absolute', right: 2, bottom: 2 }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: '#00E5FF',
          }}
        >
          Turn sideways →
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.3, color: 'rgba(212,220,232,0.7)', marginTop: 2 }}>
          Landscape looks better — portrait still works.
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss tip"
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'transparent',
          color: 'rgba(212,220,232,0.7)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
