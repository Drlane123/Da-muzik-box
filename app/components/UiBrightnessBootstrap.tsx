'use client';

import { useEffect } from 'react';

import { useSettings } from '@/app/context/SettingsContext';
import {
  applyDocumentUiBrightness,
  clearDocumentUiBrightness,
} from '@/app/lib/uiBrightness';

/**
 * Applies Settings → Brightness (lighten / darken the whole shell).
 * Default 1.0 = current lightened chrome. Does not touch transport code.
 */
export default function UiBrightnessBootstrap() {
  const { settings } = useSettings();
  const brightness = settings.uiBrightness;

  useEffect(() => {
    applyDocumentUiBrightness(brightness);
    return () => clearDocumentUiBrightness();
  }, [brightness]);

  return null;
}
