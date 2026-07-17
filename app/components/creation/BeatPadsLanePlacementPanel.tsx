'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Dices, RefreshCw, Sparkles, Undo2, X } from 'lucide-react';
import {
  BEAT_PADS_DRUM_ROLES,
  BEAT_PADS_PLACEMENT_GENRES,
  beatPadsDrumRoleLabel,
  beatPadsPlacementGenreLabel,
  beatPadsPlacementStepPreview,
  getBeatPadsLaneTemplates,
  pickAlternateBeatPadsLaneTemplate,
  pickRandomBeatPadsKitLanePlacements,
  type BeatPadsDrumRole,
  type BeatPadsLanePlacementTemplate,
  type BeatPadsPlacementGenre,
} from '@/app/lib/creationStation/beatPadsLanePlacementTemplates';
import { peekBeatPadsAutoDrumGenre, resolveBeatPadsAutoDrum } from '@/app/lib/creationStation/beatPadsAutoDrum';
import { BEAT_PADS_LANE_PLACEMENT_HELP } from '@/app/lib/creationStation/beatPadsLanePlacementInstructions';

const MINT = '#7cf4c6';
const VIOLET = '#c4b5fd';
const VIOLET_DEEP = '#2e1a4a';
const BLUE = '#60a5fa';
const BLUE_DEEP = '#1e3a5f';

const REGEN_BTN: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  height: 24,
  padding: '0 7px',
  borderRadius: 4,
  border: '1px solid rgba(167, 139, 250, 0.4)',
  background: 'rgba(167, 139, 250, 0.1)',
  color: '#ddd6fe',
  fontSize: 9,
  fontWeight: 800,
  flexShrink: 0,
};

const HELP_BTN: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 14,
  height: 14,
  padding: 0,
  flexShrink: 0,
  borderRadius: 3,
  border: '1px solid rgba(167, 139, 250, 0.45)',
  background: 'rgba(167, 139, 250, 0.12)',
  color: VIOLET,
  fontSize: 9,
  fontWeight: 900,
  lineHeight: 1,
  cursor: 'pointer',
};

function BeatPadsLanePlacementHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-label={BEAT_PADS_LANE_PLACEMENT_HELP.title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10070,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(420px, 96vw)',
          maxHeight: 'min(480px, 88vh)',
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a0e',
          border: '1px solid rgba(167, 139, 250, 0.45)',
          borderRadius: 10,
          boxShadow: '0 20px 48px rgba(0,0,0,0.65)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderBottom: '1px solid rgba(167, 139, 250, 0.2)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 900, color: VIOLET, letterSpacing: 0.4 }}>
            {BEAT_PADS_LANE_PLACEMENT_HELP.title.toUpperCase()}
          </span>
          <button
            type="button"
            aria-label="Close help"
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 5,
              border: '1px solid #2a2a32',
              background: '#12121a',
              color: '#9a9aa8',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>
        <div
          style={{
            overflowY: 'auto',
            padding: '10px 12px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {BEAT_PADS_LANE_PLACEMENT_HELP.sections.map((s) => (
            <div key={s.heading}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  color: MINT,
                  letterSpacing: 0.3,
                  marginBottom: 4,
                }}
              >
                {s.heading}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  lineHeight: 1.45,
                  color: '#b8bcc8',
                  fontWeight: 600,
                }}
              >
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export type BeatPadsLanePlacementPanelProps = {
  laneIndex: number;
  laneLabel: string;
  drumRole: BeatPadsDrumRole;
  onDrumRoleChange: (role: BeatPadsDrumRole) => void;
  onApplyTemplate: (template: BeatPadsLanePlacementTemplate) => void;
  /** Dice: apply one random placement per role (any genre mix) onto kit lanes. */
  onApplyMultiRoleTemplates?: (
    picks: ReadonlyArray<{ role: BeatPadsDrumRole; template: BeatPadsLanePlacementTemplate }>,
  ) => void;
  /** Undo last Lane Placements dice roll (previous kit pattern). */
  onUndoKitDice?: () => void;
  canUndoKitDice?: boolean;
  /** When Auto Drum phrase includes a tempo (e.g. "bpm 97"). */
  onBpmChange?: (bpm: number) => void;
  /** Load / swap pad sample on the selected lane to match typed instructions. */
  onAutoDrumPadSample?: (
    targetPad: number,
    query: string,
    role: BeatPadsDrumRole,
  ) => Promise<{ applied: boolean; label?: string; source?: string }>;
  disabled?: boolean;
  activeTemplateId?: string | null;
  activeTemplateName?: string | null;
};

export function BeatPadsLanePlacementPanel({
  laneIndex,
  laneLabel,
  drumRole,
  onDrumRoleChange,
  onApplyTemplate,
  onApplyMultiRoleTemplates,
  onUndoKitDice,
  canUndoKitDice = false,
  onBpmChange,
  onAutoDrumPadSample,
  disabled = false,
  activeTemplateId = null,
  activeTemplateName = null,
}: BeatPadsLanePlacementPanelProps) {
  const [genre, setGenre] = useState<BeatPadsPlacementGenre>('trap');
  const [autoDrumText, setAutoDrumText] = useState('');
  const [autoDrumStatus, setAutoDrumStatus] = useState<string | null>(null);
  const [lastAutoDrumTemplateId, setLastAutoDrumTemplateId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const templates = useMemo(
    () => getBeatPadsLaneTemplates(drumRole, genre),
    [drumRole, genre],
  );

  const roleLabel = beatPadsDrumRoleLabel(drumRole);
  const genreLabel = beatPadsPlacementGenreLabel(genre);

  const genrePeek = useMemo(() => {
    if (!autoDrumText.trim()) return null;
    return peekBeatPadsAutoDrumGenre(autoDrumText, genre);
  }, [autoDrumText, genre]);

  useEffect(() => {
    if (genrePeek?.explicit && genrePeek.genre !== genre) {
      setGenre(genrePeek.genre);
    }
  }, [genrePeek, genre]);

  const handlePlacementRegen = useCallback(() => {
    const pick = pickAlternateBeatPadsLaneTemplate(drumRole, genre, activeTemplateId);
    if (pick) onApplyTemplate(pick);
  }, [activeTemplateId, drumRole, genre, onApplyTemplate]);

  const handleRandomKitDice = useCallback(() => {
    if (!onApplyMultiRoleTemplates) return;
    const picks = pickRandomBeatPadsKitLanePlacements();
    if (picks.length > 0) onApplyMultiRoleTemplates(picks);
  }, [onApplyMultiRoleTemplates]);

  const applyAutoDrumResult = useCallback(
    async (result: NonNullable<ReturnType<typeof resolveBeatPadsAutoDrum>>) => {
      if (result.template.genre !== genre) setGenre(result.template.genre);
      else if (result.detectedGenre !== genre) setGenre(result.detectedGenre);
      if (result.template.role !== drumRole) onDrumRoleChange(result.template.role);
      if (result.bpm != null) onBpmChange?.(result.bpm);
      onApplyTemplate(result.template);
      setLastAutoDrumTemplateId(result.template.id);

      // Keep the pad-sample swap side effect, but keep the on-screen line dead simple —
      // just the genre + drum, e.g. "Auto Drum: Trap Kick". No alternates / extra clutter.
      if (onAutoDrumPadSample) {
        await onAutoDrumPadSample(laneIndex, autoDrumText, result.template.role);
      }
      const genreName = beatPadsPlacementGenreLabel(result.template.genre);
      const roleName = beatPadsDrumRoleLabel(result.template.role);
      setAutoDrumStatus(`Auto Drum: ${genreName} ${roleName}`);
    },
    [
      autoDrumText,
      drumRole,
      genre,
      laneIndex,
      onApplyTemplate,
      onAutoDrumPadSample,
      onBpmChange,
      onDrumRoleChange,
    ],
  );

  const handleAutoDrum = useCallback(async () => {
    const result = resolveBeatPadsAutoDrum(autoDrumText, drumRole, genre);
    if (!result) {
      setAutoDrumStatus('Type a style + drum — tap ? for examples');
      return;
    }
    await applyAutoDrumResult(result);
  }, [applyAutoDrumResult, autoDrumText, drumRole, genre]);

  const handleAutoDrumRegen = useCallback(async () => {
    const excludeId = lastAutoDrumTemplateId ?? activeTemplateId;
    const result = resolveBeatPadsAutoDrum(autoDrumText, drumRole, genre, {
      excludeTemplateId: excludeId,
    });
    if (!result) {
      setAutoDrumStatus('No other match — tweak your phrase and Go again');
      return;
    }
    await applyAutoDrumResult(result);
  }, [activeTemplateId, applyAutoDrumResult, autoDrumText, drumRole, genre, lastAutoDrumTemplateId]);

  const handleAutoDrumKey = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAutoDrum();
      }
    },
    [handleAutoDrum],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        padding: '5px 8px 6px',
        borderRadius: 8,
        border: '1px solid rgba(167, 139, 250, 0.28)',
        background: 'linear-gradient(165deg, rgba(26, 16, 48, 0.45) 0%, rgba(8, 8, 12, 0.95) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        overflow: 'hidden',
        minHeight: 0,
        flex: '1 1 0',
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
            letterSpacing: '0.08em',
            color: VIOLET,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          Lane Placements
        </span>
        <button
          type="button"
          aria-label="How Lane Placements and Pick Placement work"
          title="How Lane Placements and Pick Placement work"
          onClick={() => setHelpOpen(true)}
          style={HELP_BTN}
        >
          ?
        </button>
      </div>

      <BeatPadsLanePlacementHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <div
        className="beat-pads-lane-header-controls"
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'nowrap',
          gap: 4,
          flexShrink: 0,
          width: '100%',
        }}
      >
        <select
          className="beat-pads-drum-role-select"
          value={drumRole}
          disabled={disabled}
          aria-label="Drum type — Kick, Snare, Clap, Hi-Hat, Open Hat, Rim"
          title={`Drum type — ${roleLabel}`}
          onChange={(e) => onDrumRoleChange(e.target.value as BeatPadsDrumRole)}
          style={{
            height: 24,
            width: 68,
            flex: '0 0 68px',
            padding: '0 4px',
            borderRadius: 4,
            border: `1px solid ${BLUE}`,
            background: `linear-gradient(180deg, rgba(59, 130, 246, 0.35) 0%, ${BLUE_DEEP} 100%)`,
            color: '#dbeafe',
            fontSize: 10,
            fontWeight: 800,
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: 'inset 0 1px 0 rgba(147, 197, 253, 0.25)',
          }}
        >
          {BEAT_PADS_DRUM_ROLES.map((r) => (
            <option key={r.id} value={r.id} style={{ backgroundColor: '#1a1a22', color: '#e8e8f0' }}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          className="beat-pads-genre-select"
          value={genre}
          disabled={disabled}
          aria-label="Genre — Trap, R&B, Pop, House, Dance"
          title={`Genre — ${genreLabel}`}
          onChange={(e) => setGenre(e.target.value as BeatPadsPlacementGenre)}
          style={{
            height: 24,
            flex: '1 1 0',
            minWidth: 0,
            padding: '0 6px',
            borderRadius: 4,
            border: `1px solid ${VIOLET}`,
            background: `linear-gradient(180deg, rgba(167, 139, 250, 0.35) 0%, ${VIOLET_DEEP} 100%)`,
            color: '#f3e8ff',
            fontSize: 10,
            fontWeight: 800,
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: 'inset 0 1px 0 rgba(196, 181, 253, 0.25)',
          }}
        >
          {BEAT_PADS_PLACEMENT_GENRES.map((g) => (
            <option key={g.id} value={g.id} style={{ backgroundColor: '#1a1a22', color: '#e8e8f0' }}>
              {g.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={disabled || templates.length === 0}
          onClick={handlePlacementRegen}
          title={`Another ${genreLabel} ${roleLabel} on this lane`}
          aria-label={`Regenerate ${roleLabel} placement`}
          style={{
            ...REGEN_BTN,
            cursor: disabled || templates.length === 0 ? 'not-allowed' : 'pointer',
            opacity: disabled || templates.length === 0 ? 0.45 : 1,
          }}
        >
          <RefreshCw size={10} aria-hidden />
          Regen
        </button>
        {typeof onApplyMultiRoleTemplates === 'function' ? (
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
              disabled={disabled || !canUndoKitDice || typeof onUndoKitDice !== 'function'}
              onClick={() => onUndoKitDice?.()}
              title="Undo last randomize — restore previous kit pattern"
              aria-label="Undo last kit randomize"
              style={{
                ...REGEN_BTN,
                width: 24,
                height: 14,
                padding: 0,
                gap: 0,
                cursor:
                  disabled || !canUndoKitDice || typeof onUndoKitDice !== 'function'
                    ? 'not-allowed'
                    : 'pointer',
                opacity:
                  disabled || !canUndoKitDice || typeof onUndoKitDice !== 'function' ? 0.35 : 1,
              }}
            >
              <Undo2 size={9} aria-hidden />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={handleRandomKitDice}
              title="Random kit — solid kick on 1, snare on 2 & 4; hats/perc any genre"
              aria-label="Random kit placements with solid kick and snare"
              style={{
                ...REGEN_BTN,
                width: 24,
                padding: 0,
                gap: 0,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.45 : 1,
              }}
            >
              <Dices size={11} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 4,
          alignItems: 'stretch',
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={autoDrumText}
          disabled={disabled}
          onChange={(e) => {
            setAutoDrumText(e.target.value);
            if (autoDrumStatus) setAutoDrumStatus(null);
          }}
          onKeyDown={handleAutoDrumKey}
          placeholder="Auto Drum…"
          aria-label="Auto Drum — describe style and drum, then Go"
          style={{
            flex: 1,
            minWidth: 0,
            height: 24,
            padding: '0 8px',
            borderRadius: 4,
            border: '1px solid rgba(124, 244, 198, 0.35)',
            background: 'rgba(0, 0, 0, 0.35)',
            color: '#e8fff8',
            fontSize: 10,
            fontWeight: 600,
            outline: 'none',
          }}
        />
        <button
          type="button"
          disabled={disabled || !autoDrumText.trim()}
          onClick={handleAutoDrum}
          title="Place matching groove on this drum lane"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            height: 24,
            padding: '0 8px',
            borderRadius: 4,
            border: '1px solid rgba(124, 244, 198, 0.45)',
            background: 'rgba(124, 244, 198, 0.12)',
            color: MINT,
            fontSize: 9,
            fontWeight: 800,
            cursor: disabled || !autoDrumText.trim() ? 'not-allowed' : 'pointer',
            opacity: disabled || !autoDrumText.trim() ? 0.45 : 1,
            flexShrink: 0,
          }}
        >
          <Sparkles size={10} aria-hidden />
          Go
        </button>
        <button
          type="button"
          disabled={disabled || !autoDrumText.trim()}
          onClick={handleAutoDrumRegen}
          title="Try another match for this phrase"
          aria-label="Regenerate Auto Drum"
          style={{
            ...REGEN_BTN,
            cursor: disabled || !autoDrumText.trim() ? 'not-allowed' : 'pointer',
            opacity: disabled || !autoDrumText.trim() ? 0.45 : 1,
          }}
        >
          <RefreshCw size={10} aria-hidden />
          Regen
        </button>
      </div>
      {autoDrumStatus ? (
        <span style={{ fontSize: 9, color: '#e6e9f0', fontWeight: 600, lineHeight: 1.2, flexShrink: 0 }}>{autoDrumStatus}</span>
      ) : null}

      <div
        style={{
          flex: '1 1 auto',
          minHeight: 110,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          paddingRight: 1,
        }}
      >
        <span
          style={{
            fontSize: 8,
            fontWeight: 900,
            letterSpacing: '0.1em',
            color: '#a8adb8',
            textTransform: 'uppercase',
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 1,
            padding: '2px 0 3px',
            background: 'linear-gradient(180deg, rgba(14, 10, 22, 0.98) 70%, rgba(14, 10, 22, 0) 100%)',
          }}
        >
          Pick placement · {genreLabel}
        </span>
        {templates.length === 0 ? (
          <span style={{ fontSize: 10, color: '#8a9098', padding: '4px 2px', lineHeight: 1.3 }}>
            No {genreLabel} {roleLabel} grids.
          </span>
        ) : (
          templates.map((t) => {
            const active = activeTemplateId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={disabled}
                onClick={() => onApplyTemplate(t)}
                title={`${genreLabel} ${roleLabel} — ${t.desc}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 2,
                  width: '100%',
                  textAlign: 'left',
                  padding: '5px 6px',
                  borderRadius: 4,
                  border: `1px solid ${active ? MINT : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: active ? 'inset 2px 0 0 #7cf4c6' : undefined,
                  background: active ? 'rgba(124, 244, 198, 0.1)' : 'rgba(255,255,255,0.03)',
                  color: '#e8e8f0',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.45 : 1,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 4,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: active ? MINT : '#f0fdf4',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}
                  >
                    {t.name}
                  </span>
                  <span style={{ fontSize: 8, fontWeight: 800, color: '#8a9098', flexShrink: 0 }}>
                    {genreLabel}·{roleLabel}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 9,
                    letterSpacing: 0.4,
                    color: '#7cf4c6',
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {beatPadsPlacementStepPreview(t.steps)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
