'use client';

import { useEffect } from 'react';

import { useSettings } from '@/app/context/SettingsContext';
import {
  applyDocumentUiScale,
  clearDocumentUiScale,
  resolveUiScale,
} from '@/app/lib/uiScale';

/**
 * Applies Settings → Display size (auto fit on smaller windows, or manual slider).
 * Uses document zoom so portaled modals scale with the rest of the app.
 * Does not touch Studio Editor / Beat Lab transport code.
 */
export default function UiScaleBootstrap() {
  const { settings } = useSettings();
  const mode = settings.uiScaleMode;
  const manual = settings.uiScale;

  useEffect(() => {
    const apply = () => applyDocumentUiScale(resolveUiScale(mode, manual));
    apply();
    if (mode !== 'auto') {
      return () => clearDocumentUiScale();
    }
    const onResize = () => apply();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('scroll', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('scroll', onResize);
      clearDocumentUiScale();
    };
  }, [mode, manual]);

  return null;
}
