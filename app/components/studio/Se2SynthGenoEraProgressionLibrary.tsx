'use client';

import { useMemo, useState } from 'react';
import {
  SE2_SYNTH_GENO_ERA_CATEGORIES,
  se2SynthGenoEraPresetById,
  se2SynthGenoEraPresetsForCategory,
  se2SynthGenoNextChordOptionsForLoop,
  type Se2SynthGenoEraCategoryId,
  type Se2SynthGenoEraPreset,
  type Se2SynthGenoNextChordOption,
} from '@/app/lib/studio/se2SynthGenoEraProgressionLibrary';
import type { GenoBarChordSpec } from '@/app/lib/studio/se2SynthGenoChordEngine';
import { se2SynthGenoEraCategoryBpm } from '@/app/lib/studio/se2SynthGenoEraCategoryTempo';
import {
  Se2SynthGenoInsertAction,
  Se2SynthGenoPresetCard,
  Se2SynthGenoSelectChip,
} from '@/app/components/studio/Se2SynthGenoSelectionUi';

export type Se2SynthGenoEraProgressionLibraryProps = {
  accentHex?: string;
  disabled?: boolean;
  activePresetId?: string | null;
  liveLoopSpecs?: readonly GenoBarChordSpec[];
  onSelect: (preset: Se2SynthGenoEraPreset) => void;
  onAppendNextChord?: (option: Se2SynthGenoNextChordOption) => void;
  onCategoryChange?: (categoryId: Se2SynthGenoEraCategoryId) => void;
};

export function Se2SynthGenoEraProgressionLibrary({
  accentHex = '#00E5CC',
  disabled = false,
  activePresetId = null,
  liveLoopSpecs,
  onSelect,
  onAppendNextChord,
  onCategoryChange,
}: Se2SynthGenoEraProgressionLibraryProps) {
  const [categoryId, setCategoryId] = useState<Se2SynthGenoEraCategoryId>('soul-eras');

  const activePreset = activePresetId ? se2SynthGenoEraPresetById(activePresetId) : null;
  const nextChords = useMemo(() => {
    if (!activePreset || !onAppendNextChord) return [];
    const specs = liveLoopSpecs ?? activePreset.chordSpecs;
    return se2SynthGenoNextChordOptionsForLoop(specs, activePreset.categoryId);
  }, [activePreset, liveLoopSpecs, onAppendNextChord]);

  const presets = useMemo(
    () => se2SynthGenoEraPresetsForCategory(categoryId),
    [categoryId],
  );

  return (
    <div
      className="rounded-md border px-2 py-1.5 flex flex-col gap-1.5 max-h-[120px] overflow-y-auto overscroll-contain"
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
        <span className="text-[6px] opacity-40 shrink-0">{presets.length} loops</span>
        <span
          className="text-[6px] font-mono font-bold shrink-0 rounded border px-1 py-px"
          style={{ borderColor: `${accentHex}38`, color: accentHex, background: `${accentHex}0a` }}
        >
          {se2SynthGenoEraCategoryBpm(categoryId)} BPM
        </span>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-0.5 shrink-0">
        {SE2_SYNTH_GENO_ERA_CATEGORIES.map((c) => (
          <Se2SynthGenoSelectChip
            key={c.id}
            active={categoryId === c.id}
            accentHex={accentHex}
            label={c.label}
            disabled={disabled}
            size="xs"
            onClick={() => {
              setCategoryId(c.id);
              onCategoryChange?.(c.id);
            }}
          />
        ))}
      </div>

      <div className="flex gap-1 overflow-x-auto pb-0.5 shrink-0">
        {presets.map((p) => {
          const shortName = p.name.split(' · ').slice(1).join(' · ') || p.name;
          return (
            <Se2SynthGenoPresetCard
              key={p.id}
              size="compact"
              active={activePresetId === p.id}
              accentHex={accentHex}
              disabled={disabled}
              title={shortName}
              romanLine={p.romanLine}
              onClick={() => onSelect(p)}
            />
          );
        })}
      </div>

      {activePreset && nextChords.length > 0 && onAppendNextChord ? (
        <div className="flex flex-col gap-1 pt-0.5 border-t border-white/6 shrink-0">
          <span className="text-[6px] font-black uppercase tracking-widest" style={{ color: accentHex }}>
            Append · {activePreset.name.split(' · ')[0]}
          </span>
          <div className="flex flex-wrap gap-1">
            {nextChords.map((opt) => (
              <Se2SynthGenoInsertAction
                key={opt.id}
                size="compact"
                label={opt.label}
                accentHex={accentHex}
                disabled={disabled}
                title={`Append ${opt.label}`}
                onClick={() => onAppendNextChord(opt)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
