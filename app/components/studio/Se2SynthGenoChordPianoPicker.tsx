'use client';

import {
  se2SynthGenoChordPianoBankEntries,
  se2SynthGenoChordPianoMorphDefaults,
  se2SynthGenoSanitizeChordPianoBankId,
  type Se2SynthGenoChordPianoMorph,
} from '@/app/lib/studio/se2SynthGenoChordPianoLibrary';
import { Se2SynthGenoLaneSoundStrip } from '@/app/components/studio/Se2SynthGenoLaneSoundStrip';

export type Se2SynthGenoChordPianoStripProps = {
  accentHex?: string;
  disabled?: boolean;
  stripId?: string;
  selectedId: string;
  onSelect: (id: string) => void;
  morph?: Se2SynthGenoChordPianoMorph;
  onMorphChange?: (morph: Se2SynthGenoChordPianoMorph) => void;
  pushRight?: boolean;
};

export function Se2SynthGenoChordPianoStrip({
  accentHex = '#00E5CC',
  disabled = false,
  stripId,
  selectedId,
  onSelect,
  morph,
  onMorphChange,
  pushRight = false,
}: Se2SynthGenoChordPianoStripProps) {
  return (
    <Se2SynthGenoLaneSoundStrip
      accentHex={accentHex}
      disabled={disabled}
      stripId={stripId}
      label="Chord piano"
      panelButtonLabel="8 Pianos"
      panelTitle="Chord piano library"
      entries={se2SynthGenoChordPianoBankEntries()}
      selectedId={selectedId}
      onSelect={onSelect}
      sanitizeId={se2SynthGenoSanitizeChordPianoBankId}
      showSoundGrid
      showDelay
      morph={morph}
      onMorphChange={onMorphChange}
      morphDefaults={se2SynthGenoChordPianoMorphDefaults}
      pushRight={pushRight}
    />
  );
}

/** @deprecated Use Se2SynthGenoChordPianoStrip */
export const Se2SynthGenoChordPianoPicker = Se2SynthGenoChordPianoStrip;
