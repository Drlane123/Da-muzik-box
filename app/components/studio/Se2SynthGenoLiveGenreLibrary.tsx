'use client';

import { useMemo } from 'react';
import {
  SE2_SYNTH_GENO_LIVE_GENRES,
  se2SynthGenoLivePresetsForGenre,
} from '@/app/lib/studio/se2SynthGenoLiveChordLibrary';
import { se2SynthGenoLiveGenreBpm } from '@/app/lib/studio/se2SynthGenoLiveGenreTempo';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import type { Se2SynthGenoLivePreset } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import {
  Se2SynthGenoPresetCard,
  Se2SynthGenoSelectChip,
} from '@/app/components/studio/Se2SynthGenoSelectionUi';

export type Se2SynthGenoLiveGenreLibraryProps = {
  accentHex?: string;
  disabled?: boolean;
  genreId: Se2SynthGenoLiveGenreId;
  activePresetId?: string | null;
  onGenreChange: (genreId: Se2SynthGenoLiveGenreId) => void;
  onSelect: (preset: Se2SynthGenoLivePreset) => void;
};

/** Live Chord preset picker — compact genre chips + dense preset strip. */
export function Se2SynthGenoLiveGenreLibrary({
  accentHex = '#00E5CC',
  disabled = false,
  genreId,
  activePresetId = null,
  onGenreChange,
  onSelect,
}: Se2SynthGenoLiveGenreLibraryProps) {
  const activeGenre = SE2_SYNTH_GENO_LIVE_GENRES.find((g) => g.id === genreId);
  const presets = useMemo(() => se2SynthGenoLivePresetsForGenre(genreId), [genreId]);

  return (
    <div
      className="mx-3 rounded-md border px-2 py-1.5 flex flex-col gap-1.5 max-h-[108px] overflow-y-auto overscroll-contain"
      style={{
        borderColor: `${accentHex}38`,
        background: 'linear-gradient(180deg, #161820 0%, #0a0a10 100%)',
      }}
    >
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        <span
          className="text-[7px] font-black uppercase tracking-widest shrink-0"
          style={{ color: accentHex }}
        >
          Preset library
        </span>
        <span
          className="text-[6px] font-mono font-bold shrink-0 rounded border px-1 py-px"
          style={{ borderColor: `${accentHex}38`, color: accentHex, background: `${accentHex}0a` }}
        >
          {se2SynthGenoLiveGenreBpm(genreId)} BPM
        </span>
        <span className="text-[6px] opacity-40 shrink-0">{presets.length} loops</span>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-0.5 shrink-0">
        {SE2_SYNTH_GENO_LIVE_GENRES.map((g) => (
          <Se2SynthGenoSelectChip
            key={g.id}
            active={genreId === g.id}
            accentHex={accentHex}
            label={g.label}
            title={g.description}
            disabled={disabled}
            onClick={() => onGenreChange(g.id)}
            size="xs"
          />
        ))}
      </div>

      <div className="flex gap-1 overflow-x-auto pb-0.5 shrink-0">
        {presets.map((p) => (
          <Se2SynthGenoPresetCard
            key={p.id}
            size="compact"
            active={activePresetId === p.id}
            accentHex={accentHex}
            disabled={disabled}
            title={p.name}
            romanLine={p.romanLine}
            onClick={() => onSelect(p)}
          />
        ))}
      </div>
    </div>
  );
}
