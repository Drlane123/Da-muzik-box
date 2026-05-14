import { useMemo, useState } from 'react';
import { Music2, Plus, Sparkles, Trash2, X } from 'lucide-react';

import {
  GENRES,
  KEY_ROOTS,
  PATTERNS,
  buildChordEvents,
  getGenre,
  getPattern,
  suggestNextChord,
  type ChordEventOut,
  type ChordMode,
  type ChordSymbol,
  type GenreDef,
} from '@/app/lib/creationStation/chordBuilder';

const MINT = '#7cf4c6';
const MINT_DIM = 'rgba(124, 244, 198, 0.35)';
const MINT_BG  = 'rgba(124, 244, 198, 0.10)';
const PANEL_BG = 'linear-gradient(165deg, #12141a 0%, #08090c 100%)';

interface ChordBuilderModalProps {
  open: boolean;
  onClose: () => void;
  /** Caller decides how to map (midi,col) → its piano-roll storage. */
  onAddNotes: (notes: ChordEventOut[]) => void;
  /** Quarter-note columns per bar in the host's grid (typically 4). */
  colsPerBar: number;
  /** Visible MIDI band — used to auto-fit voicings inside the user's view. */
  bandLow: number;
  bandHigh: number;
  /** Optional pre-seed of which chord lane the user last placed (for Suggest Next). */
  lastChordOnLane?: ChordSymbol | null;
}

export function ChordBuilderModal({
  open,
  onClose,
  onAddNotes,
  colsPerBar,
  bandLow,
  bandHigh,
  lastChordOnLane = null,
}: ChordBuilderModalProps) {
  const [keyRoot, setKeyRoot] = useState(0);
  const [mode, setMode] = useState<ChordMode>('major');
  const [genreId, setGenreId] = useState(GENRES[0]!.id);
  const [patternId, setPatternId] = useState(PATTERNS[0]!.id);
  const [barsPerChord, setBarsPerChord] = useState(1);
  const [startBar, setStartBar] = useState(1);
  const [workingChords, setWorkingChords] = useState<ChordSymbol[]>([]);

  const genre = useMemo<GenreDef>(() => getGenre(genreId) ?? GENRES[0]!, [genreId]);
  const pattern = useMemo(() => getPattern(patternId) ?? PATTERNS[0]!, [patternId]);

  function onGenreChange(id: string) {
    const next = getGenre(id);
    if (!next) return;
    setGenreId(id);
    setMode(next.mode);
    setWorkingChords([]);
  }

  function onSelectPreset(chords: ChordSymbol[]) {
    setWorkingChords(chords);
  }

  function onSuggestNext() {
    const prev = workingChords[workingChords.length - 1] ?? lastChordOnLane;
    const next = suggestNextChord(prev ?? null, genre);
    setWorkingChords((cs) => [...cs, next]);
  }

  function onClearWorking() {
    setWorkingChords([]);
  }

  function onRemoveChord(idx: number) {
    setWorkingChords((cs) => cs.filter((_, i) => i !== idx));
  }

  function onAddToLane() {
    if (workingChords.length === 0) return;
    const startCol = Math.max(0, Math.round((startBar - 1) * colsPerBar));
    const events = buildChordEvents({
      progression: workingChords,
      keyRoot,
      mode,
      pattern,
      barsPerChord,
      startCol,
      colsPerBar,
      bandLow,
      bandHigh,
    });
    onAddNotes(events);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="chord-builder-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 4000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(560px, 100%)',
          maxHeight: '90vh',
          overflow: 'auto',
          borderRadius: 12,
          border: `1px solid ${MINT_DIM}`,
          background: PANEL_BG,
          boxShadow: '0 24px 80px rgba(0,0,0,0.65)',
          color: '#dcdce4',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Header onClose={onClose} />

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <KeyAndGenreRow
            keyRoot={keyRoot}
            onKeyRoot={setKeyRoot}
            mode={mode}
            onMode={setMode}
            genreId={genreId}
            onGenre={onGenreChange}
          />

          <PresetsRow
            genre={genre}
            workingChords={workingChords}
            onSelectPreset={onSelectPreset}
          />

          <WorkingChordsRow
            chords={workingChords}
            onRemove={onRemoveChord}
            onClear={onClearWorking}
            onSuggestNext={onSuggestNext}
            lastChordOnLane={lastChordOnLane}
          />

          <RhythmRow
            patternId={patternId}
            onPattern={setPatternId}
            barsPerChord={barsPerChord}
            onBarsPerChord={setBarsPerChord}
            startBar={startBar}
            onStartBar={setStartBar}
          />
        </div>

        <Footer
          disabled={workingChords.length === 0}
          chordCount={workingChords.length}
          barsPerChord={barsPerChord}
          onAddToLane={onAddToLane}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: `1px solid ${MINT_DIM}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Music2 size={18} color={MINT} aria-hidden />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span id="chord-builder-title" style={{ fontSize: 13, fontWeight: 800, color: MINT, letterSpacing: 0.5 }}>
            CHORD BUILDER
          </span>
          <span style={{ fontSize: 9, fontWeight: 600, color: '#8a8a98', letterSpacing: 0.4 }}>
            Genre packs · suggest next · MIDI to piano roll
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close Chord Builder"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#9a9aa8',
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}

function KeyAndGenreRow({
  keyRoot,
  onKeyRoot,
  mode,
  onMode,
  genreId,
  onGenre,
}: {
  keyRoot: number;
  onKeyRoot: (v: number) => void;
  mode: ChordMode;
  onMode: (v: ChordMode) => void;
  genreId: string;
  onGenre: (id: string) => void;
}) {
  return (
    <Section title="Key & Genre">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8 }}>
        <SelectBox label="Key" value={String(keyRoot)} onChange={(v) => onKeyRoot(Number(v))}>
          {KEY_ROOTS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </SelectBox>
        <SelectBox label="Mode" value={mode} onChange={(v) => onMode(v as ChordMode)}>
          <option value="major">Major</option>
          <option value="minor">Minor</option>
        </SelectBox>
        <SelectBox label="Genre" value={genreId} onChange={onGenre}>
          {GENRES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </SelectBox>
      </div>
    </Section>
  );
}

function PresetsRow({
  genre,
  workingChords,
  onSelectPreset,
}: {
  genre: GenreDef;
  workingChords: ChordSymbol[];
  onSelectPreset: (chords: ChordSymbol[]) => void;
}) {
  const activeKey = workingChords.join('-');
  return (
    <Section title={`${genre.label} progressions`}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {genre.progressions.map((p) => {
          const key = p.chords.join('-');
          const isActive = key === activeKey;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPreset(p.chords)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 3,
                padding: '8px 10px',
                borderRadius: 6,
                border: `1px solid ${isActive ? MINT_DIM : 'rgba(255,255,255,0.08)'}`,
                background: isActive ? MINT_BG : 'rgba(255,255,255,0.02)',
                color: isActive ? MINT : '#cfd0d8',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>{p.name}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? MINT : '#8a8a98', fontFamily: 'monospace' }}>
                {p.chords.join(' · ')}
              </span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function WorkingChordsRow({
  chords,
  onRemove,
  onClear,
  onSuggestNext,
  lastChordOnLane,
}: {
  chords: ChordSymbol[];
  onRemove: (i: number) => void;
  onClear: () => void;
  onSuggestNext: () => void;
  lastChordOnLane: ChordSymbol | null;
}) {
  const hasChords = chords.length > 0;
  return (
    <Section
      title="Working progression"
      right={
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={onSuggestNext}
            title={lastChordOnLane && !hasChords ? `Continue from "${lastChordOnLane}" on the lane` : 'Append next chord'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 6,
              border: `1px solid ${MINT_DIM}`,
              background: MINT_BG,
              color: MINT,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.4,
              cursor: 'pointer',
            }}
          >
            <Sparkles size={11} aria-hidden />
            Suggest Next
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={!hasChords}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'transparent',
              color: hasChords ? '#cfd0d8' : '#54545e',
              fontSize: 10,
              fontWeight: 700,
              cursor: hasChords ? 'pointer' : 'not-allowed',
            }}
          >
            <Trash2 size={11} aria-hidden />
            Clear
          </button>
        </div>
      }
    >
      {!hasChords ? (
        <div
          style={{
            padding: 10,
            borderRadius: 6,
            border: '1px dashed rgba(255,255,255,0.12)',
            color: '#8a8a98',
            fontSize: 10,
            lineHeight: 1.5,
          }}
        >
          Pick a preset above to load a progression, or hit <strong style={{ color: MINT }}>Suggest Next</strong> to
          start from scratch — it pulls the most common first chord for this genre (or continues from your last lane
          chord if any).
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {chords.map((c, i) => (
            <button
              key={`${c}-${i}`}
              type="button"
              onClick={() => onRemove(i)}
              title="Remove this chord"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 6,
                border: `1px solid ${MINT_DIM}`,
                background: MINT_BG,
                color: MINT,
                fontSize: 11,
                fontWeight: 800,
                fontFamily: 'monospace',
                cursor: 'pointer',
              }}
            >
              <span style={{ opacity: 0.55, fontSize: 9 }}>{i + 1}</span>
              {c}
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}

function RhythmRow({
  patternId,
  onPattern,
  barsPerChord,
  onBarsPerChord,
  startBar,
  onStartBar,
}: {
  patternId: string;
  onPattern: (v: string) => void;
  barsPerChord: number;
  onBarsPerChord: (v: number) => void;
  startBar: number;
  onStartBar: (v: number) => void;
}) {
  return (
    <Section title="Rhythm & placement">
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
        <SelectBox label="Pattern" value={patternId} onChange={onPattern}>
          {PATTERNS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </SelectBox>
        <SelectBox label="Bars / chord" value={String(barsPerChord)} onChange={(v) => onBarsPerChord(Number(v))}>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="4">4</option>
        </SelectBox>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#8a8a98', letterSpacing: 0.5 }}>Start bar</span>
          <input
            type="number"
            min={1}
            value={startBar}
            onChange={(e) => onStartBar(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            style={inputStyle}
          />
        </label>
      </div>
    </Section>
  );
}

function Footer({
  disabled,
  chordCount,
  barsPerChord,
  onAddToLane,
  onClose,
}: {
  disabled: boolean;
  chordCount: number;
  barsPerChord: number;
  onAddToLane: () => void;
  onClose: () => void;
}) {
  const totalBars = chordCount * barsPerChord;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderTop: `1px solid ${MINT_DIM}`,
        background: 'rgba(0,0,0,0.25)',
      }}
    >
      <span style={{ fontSize: 10, color: '#8a8a98' }}>
        {chordCount > 0
          ? `${chordCount} chord${chordCount === 1 ? '' : 's'} · ${totalBars} bar${totalBars === 1 ? '' : 's'}`
          : 'No chords yet'}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'transparent',
            color: '#cfd0d8',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onAddToLane}
          disabled={disabled}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 6,
            border: `1px solid ${MINT_DIM}`,
            background: disabled ? 'rgba(124, 244, 198, 0.04)' : MINT_BG,
            color: disabled ? 'rgba(124, 244, 198, 0.45)' : MINT,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.4,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <Plus size={12} aria-hidden />
          Add to Piano Roll
        </button>
      </div>
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: '#9a9aa8', letterSpacing: 1 }}>{title.toUpperCase()}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function SelectBox({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: '#8a8a98', letterSpacing: 0.5 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        {children}
      </select>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
  color: '#dcdce4',
  fontSize: 11,
  fontWeight: 600,
  outline: 'none',
  appearance: 'none',
};
