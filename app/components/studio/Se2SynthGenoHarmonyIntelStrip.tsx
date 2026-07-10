'use client';

import { useMemo } from 'react';
import type { ChordMode, ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import {
  GENO_BUILD_SCALE_OPTIONS,
  se2SynthGenoProgressionsFromAnchor,
  type GenoAnchorProgressionOption,
} from '@/app/lib/studio/se2SynthGenoHarmonyIntel';
import type { Se2SynthGenoEraCategoryId } from '@/app/lib/studio/se2SynthGenoEraProgressionLibrary';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import {
  Se2SynthGenoPresetCard,
  Se2SynthGenoSelectChip,
  genoSelectGlow,
} from '@/app/components/studio/Se2SynthGenoSelectionUi';

export type Se2SynthGenoHarmonyIntelStripProps = {
  accentHex?: string;
  disabled?: boolean;
  scaleMode: ChordMode;
  onScaleModeChange: (mode: ChordMode) => void;
  anchorRoman?: ChordSymbol | null;
  anchorLabel?: string;
  romans: readonly ChordSymbol[];
  playOrder: readonly number[];
  eraCategoryId?: Se2SynthGenoEraCategoryId;
  genreId?: Se2SynthGenoLiveGenreId;
  onApplyAnchorProgression?: (option: GenoAnchorProgressionOption) => void;
  /** Preview / played trigger — shows step context only (insert tail lives on piano roll). */
  focusedSlotIndex?: number | null;
};

export function Se2SynthGenoHarmonyIntelStrip({
  accentHex = '#00E5CC',
  disabled = false,
  scaleMode,
  onScaleModeChange,
  anchorRoman = null,
  anchorLabel,
  romans,
  playOrder,
  eraCategoryId,
  genreId,
  onApplyAnchorProgression,
  focusedSlotIndex = null,
}: Se2SynthGenoHarmonyIntelStripProps) {
  const anchorProgressions = useMemo(() => {
    if (!anchorRoman || !onApplyAnchorProgression) return [];
    return se2SynthGenoProgressionsFromAnchor(anchorRoman, scaleMode, {
      eraCategoryId,
      maxResults: 6,
    });
  }, [anchorRoman, scaleMode, eraCategoryId, onApplyAnchorProgression]);

  const focusContext = useMemo(() => {
    if (focusedSlotIndex == null) return null;
    const ordered = [...Array.from({ length: romans.length }, (_, i) => i)].sort(
      (a, b) => (playOrder[a] ?? a + 1) - (playOrder[b] ?? b + 1),
    );
    const pos = ordered.indexOf(focusedSlotIndex);
    const fromRoman = romans[focusedSlotIndex];
    const nextSlot = pos >= 0 && pos < ordered.length - 1 ? ordered[pos + 1] : undefined;
    const toRoman = nextSlot != null ? romans[nextSlot] : undefined;
    return {
      step: playOrder[focusedSlotIndex] ?? focusedSlotIndex + 1,
      fromRoman,
      toRoman,
      canInsert: pos >= 0 && pos < ordered.length - 1,
    };
  }, [focusedSlotIndex, romans, playOrder]);

  return (
    <div
      className="rounded-md border px-2 py-1.5 flex flex-col gap-1.5 max-h-[168px] overflow-y-auto overscroll-contain"
      style={{
        borderColor: `${accentHex}38`,
        background: 'linear-gradient(180deg, #161820 0%, #0a0a10 100%)',
      }}
    >
      <div className="flex flex-col gap-1 shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="text-[7px] font-black uppercase tracking-widest shrink-0"
            style={{ color: accentHex }}
          >
            Harmony intel
          </span>
          <span className="text-[6px] opacity-40 leading-snug">
            Trigger above ↑ · insert tail on piano roll bars
          </span>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {GENO_BUILD_SCALE_OPTIONS.map((o) => (
            <Se2SynthGenoSelectChip
              key={o.id}
              active={scaleMode === o.id}
              accentHex={accentHex}
              label={o.label}
              size="xs"
              title={`${o.group} · ${o.label}`}
              disabled={disabled}
              onClick={() => onScaleModeChange(o.id)}
            />
          ))}
        </div>
      </div>

      {focusedSlotIndex != null && focusContext ? (
        <div
          className="rounded border px-1.5 py-1 flex flex-wrap items-center gap-1.5 shrink-0"
          style={{
            borderColor: `${accentHex}44`,
            background: `${accentHex}0c`,
            boxShadow: genoSelectGlow(true, accentHex),
          }}
        >
          <span className="text-[6px] font-black uppercase tracking-widest" style={{ color: accentHex }}>
            Step {focusContext.step}
          </span>
          <span className="text-[7px] font-mono font-bold" style={{ color: '#e0e0ec' }}>
            {focusContext.fromRoman ?? '—'}
            {focusContext.toRoman ? <span className="opacity-45 mx-0.5">→</span> : null}
            {focusContext.toRoman ?? ''}
          </span>
        </div>
      ) : (
        <div className="text-[6px] opacity-40 shrink-0">Click a trigger card above.</div>
      )}

      {anchorRoman && onApplyAnchorProgression ? (
        <div className="flex flex-col gap-1 pt-0.5 border-t border-white/6 shrink-0">
          <span className="text-[6px] font-black uppercase tracking-widest" style={{ color: accentHex }}>
            Load loop · {anchorLabel ?? anchorRoman}
          </span>
          {anchorProgressions.length === 0 ? (
            <span className="text-[6px] opacity-40">No loops for this chord in {scaleMode}.</span>
          ) : (
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              {anchorProgressions.map((opt) => (
                <Se2SynthGenoPresetCard
                  key={opt.id}
                  size="compact"
                  accentHex={accentHex}
                  disabled={disabled}
                  title={opt.label}
                  romanLine={opt.romanLine}
                  onClick={() => onApplyAnchorProgression(opt)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
