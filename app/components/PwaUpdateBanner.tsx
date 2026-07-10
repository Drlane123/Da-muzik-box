'use client';

import { useEffect, useState } from 'react';
import { applyPwaUpdate, subscribePwaUpdate } from '@/app/lib/pwa/registerAppPwa';

/** Studio One–style “update available” banner for the installed desktop app. */
export default function PwaUpdateBanner() {
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => subscribePwaUpdate(setNeedRefresh), []);

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[99999] flex max-w-md -translate-x-1/2 items-center gap-3 rounded-lg border border-amber-500/40 bg-[#1a1408] px-4 py-3 text-sm text-amber-50 shadow-lg"
    >
      <span>A new version of Da Muzik Box is ready.</span>
      <button
        type="button"
        className="rounded-md bg-amber-500 px-3 py-1.5 font-semibold text-black hover:bg-amber-400"
        onClick={() => applyPwaUpdate()}
      >
        Update now
      </button>
      <button
        type="button"
        className="text-amber-200/70 hover:text-amber-100"
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss update"
      >
        Later
      </button>
    </div>
  );
}
