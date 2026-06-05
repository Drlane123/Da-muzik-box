/**
 * Groove Lead melody generator — Melody Sauce / Eva Beat–style (genre, style, generate pad).
 * Dropdown opens upward; does not resize the Groove Lead panel shell.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GrooveRollHit } from '@/app/lib/creationStation/grooveLabRoll';
import type { GrooveComposerPart } from '@/app/lib/creationStation/grooveComposerEngine';
import { GROOVE_LAB_QUANTIZE_OPTIONS, type GrooveLabQuantize } from '@/app/lib/creationStation/grooveLabRoll';
import { generateWaveLeafPhraseFromChords } from '@/app/lib/creationStation/waveLeafPhraseGen';
import {
  WAVE_LEAF_DEFAULT_STYLE_ID,
  WAVE_LEAF_MELODY_GENRES,
  waveLeafMelodyGenreForStyle,
  waveLeafMelodyStyleById,
  type WaveLeafMelodyStyleId,
} from '@/app/lib/creationStation/waveLeafMelodyStyles';
import {
  GrooveStyleTCapParamHorizontalFader,
  GrooveStyleTCapVolumeFaderStyles,
} from '@/app/components/creation/GrooveStyleTCapVolumeFader';
import { WAVE_LEAF_UI } from '@/app/lib/creationStation/waveLeafBranding';
import { WAVE_LEAF_REGISTER_LABEL } from '@/app/lib/creationStation/waveLeafPitch';

export type WaveLeafMelodyGenPanelProps = {
  chordColumnCount: number;
  leadNoteCount: number;
  barCount: number;
  quantize: GrooveLabQuantize;
  keyRoot: number;
  mode: 'major' | 'minor';
  bpm: number;
  bassRootMidi?: number;
  chordHits: readonly GrooveRollHit[];
  onGenerated: (hits: GrooveRollHit[], loopBars: number) => void;
  canUndo?: boolean;
  onUndo?: () => void;
};

const SLOT_H = 52;

export function WaveLeafMelodyGenPanel({
  chordColumnCount,
  leadNoteCount,
  barCount,
  quantize,
  keyRoot,
  mode,
  bpm,
  bassRootMidi,
  chordHits,
  onGenerated,
  canUndo = false,
  onUndo,
}: WaveLeafMelodyGenPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [styleId, setStyleId] = useState<WaveLeafMelodyStyleId>(WAVE_LEAF_DEFAULT_STYLE_ID);
  const [seed, setSeed] = useState(1);
  const [movement, setMovement] = useState(() => waveLeafMelodyStyleById(WAVE_LEAF_DEFAULT_STYLE_ID).movement);
  const [chordFit, setChordFit] = useState(() => waveLeafMelodyStyleById(WAVE_LEAF_DEFAULT_STYLE_ID).chordFit);
  const [part, setPart] = useState<GrooveComposerPart>('melody');
  const [rate, setRate] = useState<GrooveLabQuantize>('1/8');
  const [phraseGrid, setPhraseGrid] = useState(true);
  const [complexity, setComplexity] = useState(0.55);
  const [status, setStatus] = useState<string | null>(null);

  const style = waveLeafMelodyStyleById(styleId);
  const genre = waveLeafMelodyGenreForStyle(styleId);
  const disabled = chordColumnCount === 0 || chordHits.length === 0;

  const applyStyle = useCallback((id: WaveLeafMelodyStyleId) => {
    const s = waveLeafMelodyStyleById(id);
    setStyleId(id);
    setMovement(s.movement);
    setChordFit(s.chordFit);
    setPart(s.part);
    setRate(s.rate);
    setPhraseGrid(s.phraseGrid);
    setComplexity(s.complexity);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const applyGeneration = useCallback(
    (action: 'generate' | 'regenerate') => {
      if (disabled) {
        setStatus('Build Groove chord columns first');
        return;
      }
      const useSeed = action === 'regenerate' ? seed + 1 : seed;
      const s = waveLeafMelodyStyleById(styleId);
      const { hits, loopBars, chordColumns } = generateWaveLeafPhraseFromChords({
        chordHits,
        barCount,
        quantize,
        keyRoot,
        mode,
        seed: useSeed,
        style: s,
        movement,
        chordFit,
        part,
        rate,
        phraseGrid,
        complexity,
        bpm,
        bassRootMidi,
      });
      if (chordColumns === 0) {
        setStatus('Add green chord stacks (CH 34 roll) first');
        return;
      }
      if (hits.length === 0) {
        setStatus('No lead notes — add green chords (C3–A4) then GENERATE again');
        return;
      }
      onGenerated(hits, loopBars);
      setSeed(useSeed + 1);
      const tag = action === 'regenerate' ? 'regen' : 'new';
      setStatus(`✓ ${hits.length} notes (${tag}) · ${genre.label} / ${s.label}`);
    },
    [
      disabled,
      styleId,
      chordHits,
      barCount,
      quantize,
      keyRoot,
      mode,
      seed,
      movement,
      chordFit,
      part,
      rate,
      phraseGrid,
      complexity,
      bpm,
      bassRootMidi,
      onGenerated,
      genre.label,
    ],
  );

  const runGenerate = useCallback(() => applyGeneration('generate'), [applyGeneration]);
  const runRegenerate = useCallback(() => applyGeneration('regenerate'), [applyGeneration]);

  const regenDisabled = disabled || leadNoteCount === 0;
  const undoDisabled = !canUndo || !onUndo;

  return (
    <div ref={rootRef} style={{ position: 'relative', height: SLOT_H, flexShrink: 0 }}>
      <GrooveStyleTCapVolumeFaderStyles />
      {open ? (
        <div
          role="dialog"
          aria-label="Melody generator settings"
          style={{
            position: 'absolute',
            left: 'calc(46% + 4px)',
            right: 0,
            bottom: SLOT_H,
            zIndex: 40,
            maxHeight: 240,
            overflowY: 'auto',
            borderRadius: 4,
            border: `1px solid ${WAVE_LEAF_UI.borderHi}`,
            background: `linear-gradient(165deg, ${WAVE_LEAF_UI.bgDeep} 0%, ${WAVE_LEAF_UI.bgInset} 40%, #030810 100%)`,
            boxShadow: `0 -10px 28px rgba(0,0,0,0.65), 0 0 16px ${WAVE_LEAF_UI.accent}33, inset 0 1px 0 ${WAVE_LEAF_UI.accentHi}22`,
            padding: '8px 8px 10px',
          }}
          className="groove-lead-preset-scroll"
        >
          <div
            style={{
              fontSize: 8,
              fontWeight: 900,
              color: WAVE_LEAF_UI.accentHi,
              marginBottom: 8,
              letterSpacing: 0.8,
              textShadow: `0 0 12px ${WAVE_LEAF_UI.accent}44`,
            }}
          >
            MELODY GENERATOR · follows Groove chord
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
            <label className="groove-lead-type-label" style={genreLabelStyle}>
              GENRE
              <select
                value={genre.id}
                onChange={(e) => {
                  const g = WAVE_LEAF_MELODY_GENRES.find((x) => x.id === e.target.value);
                  if (g?.styles[0]) applyStyle(g.styles[0].id);
                }}
                className="groove-lead-type-label"
                style={selectStyle}
              >
                {WAVE_LEAF_MELODY_GENRES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="groove-lead-type-label" style={genreLabelStyle}>
              STYLE
              <select
                value={styleId}
                onChange={(e) => applyStyle(e.target.value)}
                className="groove-lead-type-label"
                style={selectStyle}
              >
                {WAVE_LEAF_MELODY_GENRES.find((g) => g.id === genre.id)?.styles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
            {(['melody', 'riff', 'arp'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPart(p)}
                style={pillStyle(part === p)}
              >
                {p.toUpperCase()}
              </button>
            ))}
            <button type="button" onClick={() => setPhraseGrid((v) => !v)} style={pillStyle(phraseGrid)} title="8-bar phrase shapes">
              PHRASE {phraseGrid ? 'ON' : 'OFF'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            <MixerSliderRow label="MOVEMENT" value={movement} onChange={setMovement} accent={WAVE_LEAF_UI.accentHi} />
            <MixerSliderRow label="CHORD FIT" value={chordFit} onChange={setChordFit} accent="#7ee8ff" />
            <MixerSliderRow label="FEEL" value={complexity} onChange={setComplexity} accent={WAVE_LEAF_UI.accent} />
          </div>

          <label style={{ fontSize: 6, color: WAVE_LEAF_UI.textDim, fontWeight: 800, display: 'block', marginBottom: 6 }}>
            RATE
            <select value={rate} onChange={(e) => setRate(e.target.value as GrooveLabQuantize)} style={selectStyle}>
              {GROOVE_LAB_QUANTIZE_OPTIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className="groove-lead-type-label"
              disabled={disabled}
              onClick={runGenerate}
              style={{ ...genBtnStyle(disabled), flex: 1 }}
            >
              ▶ GENERATE
            </button>
            <button
              type="button"
              className="groove-lead-type-label"
              disabled={regenDisabled}
              onClick={runRegenerate}
              style={{ ...genBtnStyle(regenDisabled), flex: 1 }}
            >
              ↻ REGEN
            </button>
            <button
              type="button"
              className="groove-lead-type-label"
              disabled={undoDisabled}
              onClick={() => onUndo?.()}
              style={{ ...genBtnStyle(undoDisabled), flex: '0 0 52px' }}
            >
              UNDO
            </button>
          </div>
        </div>
      ) : null}

      <div
        style={{
          height: SLOT_H,
          boxSizing: 'border-box',
          borderRadius: 6,
          border: `1px solid ${open ? WAVE_LEAF_UI.borderHi : WAVE_LEAF_UI.border}`,
          background: `linear-gradient(180deg, ${WAVE_LEAF_UI.bgInset} 0%, ${WAVE_LEAF_UI.bgDeep} 100%)`,
          padding: '4px 6px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        {disabled || status ? (
          <div
            className="groove-lead-type-label"
            style={{
              flexShrink: 0,
              fontSize: 8,
              fontWeight: 700,
              color: disabled ? WAVE_LEAF_UI.textDim : WAVE_LEAF_UI.accentHi,
              lineHeight: 1.15,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={status ?? undefined}
          >
            {disabled ? 'Needs Groove chords' : status}
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'stretch', gap: 3, flex: 1, minHeight: 0 }}>
          <MelodyActionBtn
            label="GEN"
            headline="LEAD GEN"
            subLabel={WAVE_LEAF_REGISTER_LABEL}
            disabled={disabled}
            onClick={runGenerate}
            title={
              disabled
                ? 'Add Groove chords first'
                : `Generate melody · ${WAVE_LEAF_REGISTER_LABEL}${leadNoteCount > 0 ? ` · ${leadNoteCount} notes · #${seed}` : ''}`
            }
            primary
          />
          <MelodyActionBtn
            label="REGEN"
            disabled={regenDisabled}
            onClick={runRegenerate}
            title={regenDisabled ? 'Generate a melody first' : 'New variation (next seed)'}
          />
          <MelodyActionBtn
            label="UNDO"
            disabled={undoDisabled}
            onClick={() => onUndo?.()}
            title={undoDisabled ? 'No previous melody' : 'Restore previous lead roll'}
          />
          <button
            type="button"
            className="groove-lead-type-label"
            onClick={() => setOpen((v) => !v)}
            title={`${genre.label} · ${style.label} — click for settings`}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 28,
              padding: '2px 6px',
              borderRadius: 5,
              border: `1px solid ${open ? WAVE_LEAF_UI.borderHi : WAVE_LEAF_UI.border}`,
              background: open ? WAVE_LEAF_UI.presetOn : WAVE_LEAF_UI.bgModule,
              color: WAVE_LEAF_UI.accentHi,
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                lineHeight: 1.15,
                letterSpacing: 0.02,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {genre.label} · {style.label}
            </span>
            <span
              style={{
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 900,
                lineHeight: 1,
                color: WAVE_LEAF_UI.accentHi,
              }}
            >
              {open ? '▴' : '▾'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function MelodyActionBtn({
  label,
  headline,
  subLabel,
  disabled,
  onClick,
  title,
  primary = false,
}: {
  label: string;
  headline?: string;
  subLabel?: string;
  disabled: boolean;
  onClick: () => void;
  title: string;
  primary?: boolean;
}) {
  const stackedPrimary = primary && (headline || subLabel);

  return (
    <button
      type="button"
      className="groove-lead-type-label"
      disabled={disabled}
      onClick={onClick}
      title={title}
      style={{
        flex: label === 'UNDO' ? '0 0 34px' : 1,
        minWidth: 0,
        border: primary ? 'none' : `1px solid ${WAVE_LEAF_UI.border}`,
        borderRadius: 5,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        background: primary
          ? `radial-gradient(ellipse 80% 70% at 50% 30%, ${WAVE_LEAF_UI.accentHi}55, ${WAVE_LEAF_UI.accentDim})`
          : WAVE_LEAF_UI.bgModule,
        boxShadow: disabled || !primary ? 'none' : `0 0 10px ${WAVE_LEAF_UI.accent}44`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 28,
        padding: stackedPrimary ? '2px 3px' : '0 2px',
      }}
    >
      {stackedPrimary ? (
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            lineHeight: 1.05,
            width: '100%',
          }}
        >
          {headline ? (
            <span
              style={{
                fontSize: 8,
                fontWeight: 700,
                color: '#e8f8ff',
                letterSpacing: 0.4,
              }}
            >
              {headline}
            </span>
          ) : (
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: 0.4,
              }}
            >
              {label}
            </span>
          )}
          {subLabel ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: WAVE_LEAF_UI.accentHi,
                letterSpacing: 0.2,
                textShadow: `0 0 10px ${WAVE_LEAF_UI.accent}aa, 0 1px 0 rgba(0,0,0,0.5)`,
              }}
            >
              {subLabel}
            </span>
          ) : null}
        </span>
      ) : (
        <span
          style={{
            fontSize: label === 'GEN' ? 8 : 9,
            fontWeight: 700,
            color: primary ? '#e8f8ff' : WAVE_LEAF_UI.accentHi,
            letterSpacing: 0.25,
            lineHeight: 1,
          }}
        >
          {label}
        </span>
      )}
    </button>
  );
}

function MixerSliderRow({
  label,
  value,
  onChange,
  accent,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  accent: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 7,
            fontWeight: 900,
            color: WAVE_LEAF_UI.textDim,
            letterSpacing: 0.5,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 8,
            fontWeight: 900,
            color: accent,
            fontFamily: 'monospace',
            textShadow: `0 0 6px ${accent}55`,
          }}
        >
          {pct}
        </span>
      </div>
      <GrooveStyleTCapParamHorizontalFader
        min={0}
        max={100}
        step={1}
        value={pct}
        accent={accent}
        onChange={(v) => onChange(v / 100)}
        ariaLabel={label}
        style={{ height: 26 }}
      />
    </div>
  );
}

const genreLabelStyle: CSSProperties = {
  fontSize: 8,
  color: WAVE_LEAF_UI.textDim,
  fontWeight: 700,
};

const selectStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 2,
  fontSize: 9,
  fontWeight: 700,
  padding: '2px 4px',
  borderRadius: 3,
  border: `1px solid ${WAVE_LEAF_UI.border}`,
  background: WAVE_LEAF_UI.bgModule,
  color: WAVE_LEAF_UI.accentHi,
};


function pillStyle(on: boolean): CSSProperties {
  return {
    fontSize: 7,
    fontWeight: 900,
    padding: '3px 7px',
    borderRadius: 2,
    cursor: 'pointer',
    border: `1px solid ${on ? WAVE_LEAF_UI.presetBorderOn : WAVE_LEAF_UI.border}`,
    background: on ? WAVE_LEAF_UI.presetOn : 'transparent',
    color: on ? WAVE_LEAF_UI.accentHi : WAVE_LEAF_UI.textDim,
  };
}

function genBtnStyle(disabled: boolean): CSSProperties {
  return {
    width: '100%',
    fontSize: 9,
    fontWeight: 700,
    padding: '6px 8px',
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    border: `1px solid ${WAVE_LEAF_UI.presetBorderOn}`,
    background: `linear-gradient(145deg, ${WAVE_LEAF_UI.presetOn}, ${WAVE_LEAF_UI.accentDim})`,
    color: WAVE_LEAF_UI.accentHi,
    letterSpacing: 0.35,
    lineHeight: 1.1,
  };
}
