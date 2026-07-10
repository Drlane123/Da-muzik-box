'use client';

import { RotateCcw, Square } from 'lucide-react';

import type { MasteringBayTransport } from '@/app/hooks/useMasteringBayEngine';

type Props = {
  transport: MasteringBayTransport;
  hasSource: boolean;
  compact?: boolean;
};

export function MasteringBayTransportControls({ transport, hasSource, compact = false }: Props) {
  const { isPlaying, onPlay, onStop, onRewind } = transport;
  const cls = compact ? 'mb-transport mb-transport--compact' : 'mb-source-track__transport';

  return (
    <div className={cls} role="group" aria-label="Source transport">
      <button
        type="button"
        className="mb-source-track__btn mb-source-track__btn--play"
        disabled={!hasSource || isPlaying}
        onClick={() => void onPlay()}
        aria-label="Play"
        title="Play"
      >
        {compact ? '▶' : 'Play'}
      </button>
      <button
        type="button"
        className="mb-source-track__btn mb-source-track__btn--stop"
        disabled={!hasSource}
        onClick={onStop}
        aria-label="Stop"
        title="Stop"
      >
        {compact ? <Square size={11} /> : 'Stop'}
      </button>
      <button
        type="button"
        className="mb-source-track__btn mb-source-track__btn--rewind"
        disabled={!hasSource}
        onClick={onRewind}
        aria-label="Rewind to start"
        title="Rewind to start"
      >
        {compact ? <RotateCcw size={12} /> : 'Rewind'}
      </button>
    </div>
  );
}
