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
 *
 * Phones: re-apply several times after orientationchange — WebViews often report
 * the old portrait size on the first event, which made landscape look “stuck.”
 */
export default function UiScaleBootstrap() {
  const { settings } = useSettings();
  const mode = settings.uiScaleMode;
  const manual = settings.uiScale;

  useEffect(() => {
    const apply = () => applyDocumentUiScale(resolveUiScale(mode, manual));
    apply();

    const timers: number[] = [];
    const applySoon = () => {
      apply();
      for (const ms of [50, 150, 350, 700]) {
        timers.push(window.setTimeout(apply, ms));
      }
    };

    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', applySoon);
    window.screen?.orientation?.addEventListener?.('change', applySoon);
    window.visualViewport?.addEventListener('resize', apply);
    window.visualViewport?.addEventListener('scroll', apply);

    const mq = window.matchMedia('(orientation: landscape)');
    const onMq = () => applySoon();
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onMq);
    else mq.addListener(onMq);

    return () => {
      for (const id of timers) window.clearTimeout(id);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', applySoon);
      window.screen?.orientation?.removeEventListener?.('change', applySoon);
      window.visualViewport?.removeEventListener('resize', apply);
      window.visualViewport?.removeEventListener('scroll', apply);
      if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', onMq);
      else mq.removeListener(onMq);
      if (mode === 'auto' || mode === 'manual') clearDocumentUiScale();
    };
  }, [mode, manual]);

  return null;
}
