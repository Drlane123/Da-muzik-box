import { useMemo, useState } from 'react';
import {
  chordSymbolToName,
  progressionResolvesInMode,
  type ChordMode,
} from '@/app/lib/creationStation/chordBuilder';
import {
  PRO_PROGRESSION_CATEGORIES,
  getProgressionsByCategory,
  type ProProgressionEntry,
} from '@/app/lib/creationStation/professionalChordProgressions';
import {
  CHORD_VOICING_OPTIONS,
  type ChordVoicingSize,
} from '@/app/lib/creationStation/chordVoicing';

export interface ProChordProgressionsPanelProps {
  keyRoot: number;
  mode: ChordMode;
  onLoad: (entry: ProProgressionEntry) => void;
  /** Chord Builder mint theme vs Chord Sequencer green theme. */
  variant?: 'builder' | 'sequencer';
  /** Default category on first open. */
  defaultCategoryId?: string;
  chordVoicingSize?: ChordVoicingSize;
  onChordVoicingSize?: (v: ChordVoicingSize) => void;
}

const BUILDER = {
  accent: '#7cf4c6',
  accentDim: 'rgba(124, 244, 198, 0.28)',
  accentBg: 'rgba(124, 244, 198, 0.08)',
  panelBg: 'linear-gradient(180deg, rgba(124, 244, 198, 0.06) 0%, rgba(10, 10, 14, 0.85) 100%)',
  border: 'rgba(124, 244, 198, 0.18)',
  text: '#dcdce4',
  muted: '#6a6a78',
  inputBg: 'rgba(10, 10, 14, 0.85)',
  inputBorder: 'rgba(124, 244, 198, 0.28)',
};

const SEQUENCER = {
  accent: '#86efac',
  accentDim: '#22c55e44',
  accentBg: '#0d1210',
  panelBg: 'linear-gradient(180deg, rgba(34, 197, 94, 0.06) 0%, #080808 100%)',
  border: '#1f3a29',
  text: '#d1d5db',
  muted: '#6b7280',
  inputBg: '#101010',
  inputBorder: '#1f3a29',
};

function previewChain(
  chords: ProProgressionEntry['chords'],
  keyRoot: number,
  mode: ChordMode,
): string {
  const names = chords.map((c) => chordSymbolToName(c, keyRoot, mode));
  if (names.length <= 6) return names.join(' · ');
  return `${names.slice(0, 6).join(' · ')} · …`;
}

export function ProChordProgressionsPanel({
  keyRoot,
  mode,
  onLoad,
  variant = 'sequencer',
  defaultCategoryId = 'hit-songs',
  chordVoicingSize = 5,
  onChordVoicingSize,
}: ProChordProgressionsPanelProps) {
  const t = variant === 'builder' ? BUILDER : SEQUENCER;
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [filter, setFilter] = useState('');

  const category = PRO_PROGRESSION_CATEGORIES.find((c) => c.id === categoryId)
    ?? PRO_PROGRESSION_CATEGORIES[0]!;

  const entries = useMemo(() => {
    const list = getProgressionsByCategory(categoryId).filter(
      (e) => e.chords.length > 0 && progressionResolvesInMode(e.chords, e.mode, keyRoot),
    );
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(q)
        || e.genreLabel.toLowerCase().includes(q)
        || (e.emotion?.toLowerCase().includes(q) ?? false)
        || e.chords.join(' ').toLowerCase().includes(q),
    );
  }, [categoryId, filter, keyRoot]);

  const embedded = variant === 'builder';

  return (
    <div
      style={{
        ...(embedded
          ? {
              flexShrink: 0,
              padding: '3px 8px',
              borderBottom: `1px solid ${t.border}`,
              background: t.panelBg,
            }
          : {
              marginTop: 6,
              padding: '6px 8px 8px',
              borderRadius: 6,
              border: `1px solid ${t.border}`,
              background: t.panelBg,
            }),
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: embedded ? 0 : 6 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 900,
            color: t.accent,
            letterSpacing: variant === 'builder' ? 1.4 : 0.8,
            textShadow: variant === 'builder' ? '0 0 8px rgba(124, 244, 198, 0.35)' : undefined,
          }}
        >
          {variant === 'builder' ? '✨ PROFESSIONAL CHORD PROGRESSIONS' : 'PROFESSIONAL CHORD PROGRESSIONS'}
        </span>
        <span style={{ fontSize: 8, fontWeight: 600, color: t.muted }}>
          tap to load · edit on the roll
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          title={category.description}
          style={{
            background: t.inputBg,
            color: t.accent,
            border: `1px solid ${t.inputBorder}`,
            borderRadius: 5,
            padding: '3px 8px',
            fontSize: 10,
            fontWeight: 700,
            maxWidth: 200,
          }}
        >
          {PRO_PROGRESSION_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search era, feel, chords…"
          style={{
            flex: '1 1 140px',
            minWidth: 120,
            background: variant === 'builder' ? 'rgba(0,0,0,0.35)' : '#0d0d0d',
            color: t.text,
            border: `1px solid ${t.inputBorder}`,
            borderRadius: 5,
            padding: '3px 8px',
            fontSize: 10,
          }}
        />
        {onChordVoicingSize && (
          <select
            value={String(chordVoicingSize)}
            onChange={(e) => onChordVoicingSize(Number(e.target.value) as ChordVoicingSize)}
            title="How many keys per chord when you play or export"
            style={{
              background: t.inputBg,
              color: t.accent,
              border: `1px solid ${t.inputBorder}`,
              borderRadius: 5,
              padding: '3px 8px',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {CHORD_VOICING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <span style={{ fontSize: 9, color: t.muted, fontWeight: 700 }}>
          {entries.length} loops
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 2,
          maxHeight: embedded ? 72 : 132,
        }}
      >
        {entries.length === 0 ? (
          <span style={{ fontSize: 9, color: t.muted, padding: '8px 4px' }}>
            No matches — try Hit Song Core, Emotional Core, or another era.
          </span>
        ) : (
          entries.map((p) => {
            const chain = previewChain(p.chords, keyRoot, p.mode);
            const romans = p.chords.length <= 8
              ? p.chords.join(' · ')
              : `${p.chords.slice(0, 8).join(' · ')} · …`;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onLoad(p)}
                title={`${p.name}\n${p.genreLabel}${p.emotion ? ` · ${p.emotion}` : ''}\n${p.chords.join(' · ')}\n${p.chords.map((c) => chordSymbolToName(c, keyRoot, p.mode)).join(' · ')}`}
                style={{
                  flexShrink: 0,
                  minWidth: 140,
                  maxWidth: 220,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: `1px solid ${t.accentDim}`,
                  background: variant === 'builder'
                    ? `linear-gradient(180deg, ${t.accentBg} 0%, rgba(10, 10, 14, 0.85) 100%)`
                    : t.accentBg,
                  color: t.text,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  boxShadow: variant === 'builder' ? '0 0 0 1px rgba(0,0,0,0.4) inset' : undefined,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 800, color: t.text, lineHeight: 1.1 }}>
                  {p.name.split(' (')[0]?.split(' · ')[0] ?? p.name}
                </span>
                {p.emotion && (
                  <span style={{ fontSize: 8, fontWeight: 800, color: t.accent, letterSpacing: 0.3 }}>
                    {p.emotion.toUpperCase()}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: t.accent,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    lineHeight: 1.1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {chain}
                </span>
                <span style={{ fontSize: 8, fontWeight: 600, color: t.muted, fontFamily: 'monospace' }}>
                  {romans}
                </span>
                <span style={{ fontSize: 7, color: t.muted, fontWeight: 700 }}>
                  {p.genreLabel}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
