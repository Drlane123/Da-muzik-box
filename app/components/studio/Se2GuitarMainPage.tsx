'use client';

import { type ReactNode } from 'react';
import { Se2GuitarFretboardStrip } from '@/app/components/studio/Se2GuitarFretboardStrip';
import { Se2GuitarMainControls } from '@/app/components/studio/Se2GuitarMainControls';
import { Se2GuitarPianoKeyboard } from '@/app/components/studio/Se2GuitarPianoKeyboard';
import type { Se2GuitarFxSettings } from '@/app/lib/studio/se2GuitarFx';
import type { Se2GuitarFretDot } from '@/app/lib/studio/se2GuitarFretboard';
import type { Se2GuitarArticulationId } from '@/app/lib/studio/se2GuitarArticulation';
import type { Se2GuitarScaleId } from '@/app/lib/studio/se2GuitarScales';

export type Se2GuitarMainPageProps = {
  capo: number;
  transpose?: number;
  scaleRoot?: string;
  scaleId?: Se2GuitarScaleId;
  onScaleRootChange?: (root: string) => void;
  onScaleIdChange?: (scaleId: Se2GuitarScaleId) => void;
  articulation: Se2GuitarArticulationId;
  disabled?: boolean;
  fx: Se2GuitarFxSettings;
  highlightDots?: readonly Se2GuitarFretDot[];
  playingMidis?: readonly number[];
  activeString?: number | null;
  onFretPlay: (midi: number, velocity?: number, placement?: Se2GuitarFretDot) => void;
  onFretInsert?: (midi: number) => void;
  onKeyPlay: (midi: number, velocity?: number) => void;
  onKeyInsert?: (midi: number) => void;
  onFxChange: (patch: Partial<Se2GuitarFxSettings>) => void;
  onCapoChange: (fret: number) => void;
  onArticulationChange: (id: Se2GuitarArticulationId) => void;
  onPrimeAudio?: () => void;
  footer?: ReactNode;
};

import { SE2_GUITAR_UI } from '@/app/lib/studio/se2GuitarUiTheme';

/** Main tab — scale fretboard + controls + piano keys (no guitar image). */
export function Se2GuitarMainPage({
  capo,
  scaleRoot,
  scaleId,
  onScaleRootChange,
  onScaleIdChange,
  articulation,
  disabled = false,
  fx,
  highlightDots,
  playingMidis = [],
  activeString = null,
  onFretPlay,
  onFretInsert,
  onKeyPlay,
  onKeyInsert,
  onFxChange,
  onCapoChange,
  onArticulationChange,
  onPrimeAudio,
  footer,
}: Se2GuitarMainPageProps) {
  return (
    <div
      className="flex w-full min-w-[280px] flex-col gap-2"
      data-se2-guitar-main-page
      style={{
        border: `1px solid ${SE2_GUITAR_UI.border}`,
        borderRadius: 4,
        overflow: 'hidden',
        background: SE2_GUITAR_UI.shellBg,
      }}
    >
      <Se2GuitarFretboardStrip
        capo={capo}
        root={scaleRoot}
        scaleId={scaleId}
        onRootChange={onScaleRootChange}
        onScaleChange={onScaleIdChange}
        disabled={disabled}
        highlightDots={highlightDots}
        activeString={activeString}
        onFretPlay={onFretPlay}
        onFretInsert={onFretInsert}
        onPrimeAudio={onPrimeAudio}
      />

      <Se2GuitarMainControls
        fx={fx}
        capo={capo}
        articulation={articulation}
        disabled={disabled}
        onFxChange={onFxChange}
        onCapoChange={onCapoChange}
        onArticulationChange={onArticulationChange}
      />

      <Se2GuitarPianoKeyboard
        disabled={disabled}
        activeMidis={playingMidis}
        onKeyPlay={onKeyPlay}
        onKeyInsert={onKeyInsert}
      />

      {footer ? (
        <div className="border-t px-2 py-1.5" style={{ borderColor: SE2_GUITAR_UI.border, background: SE2_GUITAR_UI.panelBg }}>{footer}</div>
      ) : null}
    </div>
  );
}
