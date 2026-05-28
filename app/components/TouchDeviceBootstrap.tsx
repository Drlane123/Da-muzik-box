'use client';

import { useEffect } from 'react';

import { useSettings } from '@/app/context/SettingsContext';
import { applyTouchDeviceHtmlClass, touchOptimizationsActive } from '@/app/lib/touch/touchDevice';
import { setTouchPointerBridgeEnabled } from '@/app/lib/touch/touchPointerBridge';

/**
 * Applies Settings → Touch mode: CSS targets + pointer→mouse bridge for the whole app.
 */
export default function TouchDeviceBootstrap() {
  const { settings } = useSettings();
  const mode = settings.touchInput;

  useEffect(() => {
    const active = touchOptimizationsActive(mode);
    const offMq = applyTouchDeviceHtmlClass(mode);
    setTouchPointerBridgeEnabled(active);
    return () => {
      offMq();
      setTouchPointerBridgeEnabled(false);
    };
  }, [mode]);

  return null;
}
