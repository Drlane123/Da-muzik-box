'use client';

import { useRef, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, Dices, Undo2 } from 'lucide-react';
import { PatternBankPanel, type PatternBankPanelHandle } from '@/app/components/creation/PatternBankPanel';
import { BeatPadsLanePlacementPanel } from '@/app/components/creation/BeatPadsLanePlacementPanel';
import type { BeatLabPatternBankId, BeatLabPatternSlotId } from '@/app/lib/creationStation/beatLabPatternBank';
import type {
  BeatPadsDrumRole,
  BeatPadsLanePlacementTemplate,
} from '@/app/lib/creationStation/beatPadsLanePlacementTemplates';
import type { PatternPreset } from '@/app/lib/patternPresets';

/** Lane Placements + Pattern Bank column — ~¼″ wider for Regen controls. */
const BEAT_PADS_SIDEBAR_W = 280;
const MINT = '#7cf4c6';
const MINT_DIM = 'rgba(124, 244, 198, 0.35)';

const MINI_DICE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  padding: 0,
  borderRadius: 4,
  border: `1px solid ${MINT_DIM}`,
  background: 'rgba(124, 244, 198, 0.08)',
  color: MINT,
  flexShrink: 0,
};

export type BeatPadsPatternBankSidebarProps = {
  onLoadPreset: (preset: PatternPreset) => void;
  disabled?: boolean;
  patternSlot?: BeatLabPatternSlotId;
  onPatternSlotChange?: (slot: BeatLabPatternSlotId) => void;
  loadedBankId?: BeatLabPatternBankId | null;
  loadedPresetId?: string | null;
  /** Per-lane placement templates — below Pattern Bank. */
  selectedLane?: number;
  laneLabel?: string;
  laneDrumRole?: BeatPadsDrumRole;
  onLaneDrumRoleChange?: (role: BeatPadsDrumRole) => void;
  onApplyLaneTemplate?: (template: BeatPadsLanePlacementTemplate) => void;
  onApplyMultiRoleTemplates?: (
    picks: ReadonlyArray<{ role: BeatPadsDrumRole; template: BeatPadsLanePlacementTemplate }>,
  ) => void;
  onUndoKitDice?: () => void;
  canUndoKitDice?: boolean;
  /** Same-bank Pattern Bank dice — new groove, same pad sounds. */
  onRandomizeBankPattern?: () => void;
  onUndoBankPatternDice?: () => void;
  canRandomizeBankPattern?: boolean;
  canUndoBankPatternDice?: boolean;
  onLaneBpmChange?: (bpm: number) => void;
  onAutoDrumPadSample?: (
    targetPad: number,
    query: string,
    role: BeatPadsDrumRole,
  ) => Promise<{ applied: boolean; label?: string; source?: string }>;
  activeLaneTemplateId?: string | null;
  activeLaneTemplateName?: string | null;
};

export function BeatPadsPatternBankSidebar({
  onLoadPreset,
  disabled = false,
  patternSlot = 'A',
  onPatternSlotChange,
  loadedBankId = null,
  loadedPresetId = null,
  selectedLane = 0,
  laneLabel = 'Kick',
  laneDrumRole = 'kick',
  onLaneDrumRoleChange,
  onApplyLaneTemplate,
  onApplyMultiRoleTemplates,
  onUndoKitDice,
  canUndoKitDice = false,
  onRandomizeBankPattern,
  onUndoBankPatternDice,
  canRandomizeBankPattern = false,
  canUndoBankPatternDice = false,
  onLaneBpmChange,
  onAutoDrumPadSample,
  activeLaneTemplateId = null,
  activeLaneTemplateName = null,
}: BeatPadsPatternBankSidebarProps) {
  const patternBankRef = useRef<PatternBankPanelHandle>(null);

  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 0,
        maxWidth: BEAT_PADS_SIDEBAR_W,
        display: 'flex',
        flexDirection: 'column',
        alignSelf: 'stretch',
        gap: 6,
        minHeight: 0,
      }}
    >
      <div
        style={{
          flex: '0 1 auto',
          minHeight: 0,
          maxHeight: '32%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 8,
          border: '1px solid rgba(124, 244, 198, 0.22)',
          background: 'linear-gradient(165deg, rgba(11, 11, 16, 0.55) 0%, rgba(8, 8, 12, 0.95) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          overflow: 'hidden',
          padding: '6px 8px 8px',
        }}
      >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: '0.1em',
            color: '#7cf4c6',
            textTransform: 'uppercase',
            lineHeight: 1.2,
            flexShrink: 0,
          }}
        >
          Pattern Bank
        </span>
        {typeof onRandomizeBankPattern === 'function' ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              disabled={disabled || !canUndoBankPatternDice}
              onClick={() => onUndoBankPatternDice?.()}
              title="Undo last Pattern Bank randomize"
              aria-label="Undo last Pattern Bank randomize"
              style={{
                ...MINI_DICE,
                height: 12,
                cursor: disabled || !canUndoBankPatternDice ? 'not-allowed' : 'pointer',
                opacity: disabled || !canUndoBankPatternDice ? 0.35 : 1,
              }}
            >
              <Undo2 size={8} aria-hidden />
            </button>
            <button
              type="button"
              disabled={disabled || !canRandomizeBankPattern}
              onClick={() => onRandomizeBankPattern()}
              title="Invent a new groove in this bank’s style — same sounds, not a catalog pick"
              aria-label="Generate a fresh Pattern Bank style groove keeping pad sounds"
              style={{
                ...MINI_DICE,
                height: 18,
                cursor: disabled || !canRandomizeBankPattern ? 'not-allowed' : 'pointer',
                opacity: disabled || !canRandomizeBankPattern ? 0.45 : 1,
              }}
            >
              <Dices size={10} aria-hidden />
            </button>
          </div>
        ) : null}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            minWidth: 0,
          }}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => patternBankRef.current?.scrollChips(-1)}
            aria-label="Scroll pattern banks left"
            title="Scroll left"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 18,
              padding: 0,
              borderRadius: 4,
              border: `1px solid ${MINT_DIM}`,
              background: 'rgba(255,255,255,0.04)',
              color: MINT,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.45 : 1,
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={12} aria-hidden />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => patternBankRef.current?.scrollChips(1)}
            aria-label="Scroll pattern banks right"
            title="Scroll right"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 18,
              padding: 0,
              borderRadius: 4,
              border: `1px solid ${MINT_DIM}`,
              background: 'rgba(255,255,255,0.04)',
              color: MINT,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.45 : 1,
              flexShrink: 0,
            }}
          >
            <ChevronRight size={12} aria-hidden />
          </button>
        </div>
        {typeof onPatternSlotChange === 'function' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {(['A', 'B'] as const).map((slot) => (
              <button
                key={slot}
                type="button"
                disabled={disabled}
                onClick={() => onPatternSlotChange(slot)}
                style={{
                  padding: '3px 9px',
                  borderRadius: 4,
                  border: `1px solid ${patternSlot === slot ? '#7cf4c6' : 'rgba(255,255,255,0.14)'}`,
                  background: patternSlot === slot ? 'rgba(124, 244, 198, 0.12)' : 'rgba(255,255,255,0.04)',
                  color: patternSlot === slot ? '#7cf4c6' : '#b8bcc8',
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.45 : 1,
                }}
              >
                {slot}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#8a9098',
          lineHeight: 1.25,
          flexShrink: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {patternSlot === 'B' ? 'Afro · Reggae · House' : 'Trap · R&B · Up Tempo…'}
      </span>
      <div
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <PatternBankPanel
          ref={patternBankRef}
          onLoadPreset={onLoadPreset}
          disabled={disabled}
          patternSlot={patternSlot}
          loadedBankId={loadedBankId}
          loadedPresetId={loadedPresetId}
          comfortable
          horizontalScroll
        />
      </div>
      </div>
      {typeof onApplyLaneTemplate === 'function' ? (
        <div
          style={{
            flex: '1 1 0',
            minHeight: 160,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <BeatPadsLanePlacementPanel
            laneIndex={selectedLane}
            laneLabel={laneLabel}
            drumRole={laneDrumRole}
            onDrumRoleChange={onLaneDrumRoleChange ?? (() => {})}
            onApplyTemplate={onApplyLaneTemplate}
            onApplyMultiRoleTemplates={onApplyMultiRoleTemplates}
            onUndoKitDice={onUndoKitDice}
            canUndoKitDice={canUndoKitDice}
            onBpmChange={onLaneBpmChange}
            onAutoDrumPadSample={onAutoDrumPadSample}
            disabled={disabled}
            activeTemplateId={activeLaneTemplateId}
            activeTemplateName={activeLaneTemplateName}
          />
        </div>
      ) : null}
    </div>
  );
}
