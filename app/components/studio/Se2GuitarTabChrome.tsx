'use client';

import type { ReactNode } from 'react';
import { Se2GuitarFretboardStrip } from '@/app/components/studio/Se2GuitarFretboardStrip';
import { Se2GuitarPianoKeyboard } from '@/app/components/studio/Se2GuitarPianoKeyboard';
import type { Se2GuitarFretDot } from '@/app/lib/studio/se2GuitarFretboard';

import type { Se2GuitarScaleId } from '@/app/lib/studio/se2GuitarScales';

export type Se2GuitarTabChromeProps = {
  variant?: 'main' | 'loops';
  capo?: number;
  disabled?: boolean;
  highlightDots?: readonly Se2GuitarFretDot[];
  playingMidis?: readonly number[];
  activeString?: number | null;
  scaleRoot?: string;
  scaleId?: Se2GuitarScaleId;
  onScaleRootChange?: (root: string) => void;
  onScaleIdChange?: (scaleId: Se2GuitarScaleId) => void;
  onFretPlay: (midi: number, velocity?: number, placement?: Se2GuitarFretDot) => void;
  onFretInsert?: (midi: number) => void;
  onKeyPlay: (midi: number, velocity?: number) => void;
  onKeyInsert?: (midi: number) => void;
  onPrimeAudio?: () => void;
  children?: ReactNode;
};

export function Se2GuitarTabChrome({
  variant = 'main',
  capo = 0,
  disabled = false,
  highlightDots,
  playingMidis = [],
  activeString = null,
  scaleRoot,
  scaleId,
  onScaleRootChange,
  onScaleIdChange,
  onFretPlay,
  onFretInsert,
  onKeyPlay,
  onKeyInsert,
  onPrimeAudio,
  children,
}: Se2GuitarTabChromeProps) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-1" data-se2-guitar-tab-chrome>
      {variant === 'loops' ? null : (
        <Se2GuitarFretboardStrip
        capo={capo}
        disabled={disabled}
        highlightDots={highlightDots}
        activeString={activeString}
        root={scaleRoot}
        scaleId={scaleId}
        onRootChange={onScaleRootChange}
        onScaleChange={onScaleIdChange}
        onFretPlay={onFretPlay}
        onFretInsert={onFretInsert}
        onPrimeAudio={onPrimeAudio}
      />
      )}
      {children}
      {variant === 'main' ? (
        <Se2GuitarPianoKeyboard
          disabled={disabled}
          activeMidis={playingMidis}
          onKeyPlay={onKeyPlay}
          onKeyInsert={onKeyInsert}
        />
      ) : null}
    </div>
  );
}
