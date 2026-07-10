'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { parseChordSymbolToken } from '@/app/lib/creationStation/chordProgressionParse';
import {
  barBeatPatternKey,
  barBeatsFromHitsPerBar,
  findBarBeatPatternOption,
  GROOVE_BAR_BEAT_PATTERN_OPTIONS,
  GROOVE_PROGRESSION_MAX_TIMELINE_CARDS,
  newProgressionStepId,
  normalizeBarBeats,
  resolveStepBarBeats,
  stepsFromPasteLine,
  type GrooveProgressionStep,
} from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import {
  STUDIO_HARMONY_LOOP_BAR_OPTIONS,
  type StudioHarmonyLoopBars,
} from '@/app/lib/studio/studioInstrumentHarmony';
import { StudioEditor2HelpTip } from '@/app/components/studio/StudioEditor2HelpHub';

export type StudioRhythmPullSourceTrack = {
  index: number;
  name: string;
  noteCount: number;
  hasSteps: boolean;
};

export type StudioRhythmEditTrackPanelProps = {
  steps: GrooveProgressionStep[];
  onStepsChange: (steps: GrooveProgressionStep[]) => void;
  loopBars: StudioHarmonyLoopBars;
  onLoopBarsChange: (bars: StudioHarmonyLoopBars) => void;
  onApplyToRoll: () => void;
  onPreviewStep: (step: GrooveProgressionStep) => void;
  /** Other melodic MIDI lanes to copy notes / chord steps from. */
  pullSources?: StudioRhythmPullSourceTrack[];
  onPullFromTrack?: (sourceTrackIndex: number) => void;
  disabled?: boolean;
  accentHex?: string;
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 7,
  color: '#4b5563',
  fontWeight: 800,
  letterSpacing: 0.2,
  lineHeight: 1,
};

const sectionLabelStyle: CSSProperties = {
  ...fieldLabelStyle,
  fontSize: 9,
  color: '#6b7280',
  marginLeft: 5,
  marginRight: 2,
};

const smallBtnStyle: CSSProperties = {
  background: '#112015',
  color: '#86efac',
  border: '1px solid #1f3a29',
  borderRadius: 3,
  padding: '3px 8px',
  fontSize: 9,
  lineHeight: 1.15,
  fontWeight: 900,
  cursor: 'pointer',
};

const toolRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: 8,
  rowGap: 3,
};

function miniToggleStyle(active: boolean): CSSProperties {
  return {
    background: active ? '#1a1530' : '#0a0e14',
    color: active ? '#c4b5fd' : '#6b7280',
    border: `1px solid ${active ? '#7c3aed66' : '#1a2438'}`,
    borderRadius: 3,
    padding: '2px 7px',
    margin: 0,
    fontSize: 11,
    lineHeight: 1.15,
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
    cursor: 'pointer',
  };
}

function RhythmStepCard({
  step,
  index,
  selected,
  onSelect,
  onRemove,
  onChange,
  onHear,
  disabled,
}: {
  step: GrooveProgressionStep;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onChange: (patch: Partial<GrooveProgressionStep>) => void;
  onHear: () => void;
  disabled?: boolean;
}) {
  const valid = Boolean(parseChordSymbolToken(step.label));
  const patternKey = barBeatPatternKey(resolveStepBarBeats(step));

  const compactSelectStyle: CSSProperties = {
    width: 34,
    flex: '0 0 auto',
    background: '#050805',
    borderRadius: 2,
    fontSize: 8,
    fontWeight: 800,
    lineHeight: 1,
    padding: '0',
    height: 18,
  };

  return (
    <div
      style={{
        flex: '0 0 auto',
        width: 'auto',
        minWidth: 148,
        maxWidth: 168,
        position: 'relative',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        margin: '0 2px',
        padding: '1px 16px 1px 4px',
        height: 22,
        boxSizing: 'border-box',
        borderRadius: 3,
        background: selected ? '#1a1530' : valid ? '#0e1018' : '#2a1411',
        border: `1px solid ${selected ? '#a78bfa' : valid ? '#312e81' : '#7f1d1d'}`,
        boxShadow: selected ? '0 0 6px #7c3aed33' : undefined,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Remove chord"
        aria-label="Remove chord"
        style={{
          position: 'absolute',
          top: 1,
          right: 1,
          width: 12,
          height: 12,
          lineHeight: '10px',
          padding: 0,
          border: 'none',
          borderRadius: 2,
          background: '#3f1515',
          color: '#fca5a5',
          fontSize: 9,
          fontWeight: 900,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        ×
      </button>
      <span
        style={{
          fontSize: 8,
          lineHeight: 1,
          color: '#6b7280',
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          flex: '0 0 auto',
        }}
      >
        {index + 1}
      </span>
      <input
        type="text"
        disabled={disabled}
        value={step.label}
        onFocus={onSelect}
        onChange={(e) => onChange({ label: e.target.value, rest: false })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onHear();
        }}
        placeholder="Cm"
        style={{
          width: 36,
          flex: '1 1 36px',
          minWidth: 28,
          boxSizing: 'border-box',
          background: '#050805',
          color: valid ? '#ede9fe' : '#f87171',
          border: `1px solid ${valid ? '#312e81' : '#7f1d1d'}`,
          borderRadius: 2,
          padding: '0 3px',
          fontSize: 10,
          lineHeight: '18px',
          height: 18,
          fontWeight: 900,
          fontFamily: 'monospace',
          textAlign: 'center',
        }}
      />
      <select
        disabled={disabled}
        value={step.beats}
        onChange={(e) => onChange({ beats: Number(e.target.value) })}
        onClick={(e) => e.stopPropagation()}
        style={{
          ...compactSelectStyle,
          color: '#67e8f9',
          border: '1px solid #1f2e22',
        }}
      >
        {[1, 2, 4].map((b) => (
          <option key={b} value={b}>
            {b === 1 ? '¼' : b === 2 ? '½' : '1'}
          </option>
        ))}
      </select>
      <select
        disabled={disabled}
        value={patternKey}
        onChange={(e) => {
          const opt = findBarBeatPatternOption(e.target.value);
          if (!opt) return;
          const barBeats = normalizeBarBeats(opt.beats);
          onChange({ barBeats, hitsPerBar: barBeats.length });
        }}
        onClick={(e) => e.stopPropagation()}
        title="Which beats in the bar fire"
        style={{
          ...compactSelectStyle,
          width: 40,
          color: '#c4b5fd',
          border: '1px solid #312e81',
        }}
      >
        {GROOVE_BAR_BEAT_PATTERN_OPTIONS.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={disabled}
        onClick={onHear}
        style={{
          ...smallBtnStyle,
          padding: '0 4px',
          fontSize: 7,
          lineHeight: '18px',
          height: 18,
          flex: '0 0 auto',
        }}
      >
        ▶
      </button>
    </div>
  );
}

export function StudioRhythmEditTrackPanel({
  steps,
  onStepsChange,
  loopBars,
  onLoopBarsChange,
  onApplyToRoll,
  onPreviewStep,
  pullSources = [],
  onPullFromTrack,
  disabled = false,
  accentHex = '#C77DFF',
}: StudioRhythmEditTrackPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(steps[0]?.id ?? null);
  const [pullFromIndex, setPullFromIndex] = useState<number>(() => pullSources[0]?.index ?? -1);
  useEffect(() => {
    if (pullSources.length === 0) {
      setPullFromIndex(-1);
      return;
    }
    if (!pullSources.some((s) => s.index === pullFromIndex)) {
      setPullFromIndex(pullSources[0]!.index);
    }
  }, [pullSources, pullFromIndex]);
  const [defaultHitsPerBar, setDefaultHitsPerBar] = useState(2);
  const [defaultBarBeats, setDefaultBarBeats] = useState<number[]>([1, 3]);
  const [defaultCardBeats, setDefaultCardBeats] = useState(1);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const hasPlayableSteps = useCallback(
    (list: readonly GrooveProgressionStep[]) =>
      list.some((s) => !s.rest && s.label.trim() && parseChordSymbolToken(s.label)),
    [],
  );

  const applyReady = hasPlayableSteps(steps);

  const updateStep = useCallback(
    (id: string, patch: Partial<GrooveProgressionStep>) => {
      onStepsChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    },
    [onStepsChange, steps],
  );

  const removeStep = useCallback(
    (id: string) => {
      const next = steps.filter((s) => s.id !== id);
      if (selectedId === id) setSelectedId(next[next.length - 1]?.id ?? null);
      onStepsChange(next);
    },
    [onStepsChange, selectedId, steps],
  );

  const addStep = useCallback(() => {
    if (steps.length >= GROOVE_PROGRESSION_MAX_TIMELINE_CARDS) return;
    const barBeats = normalizeBarBeats(defaultBarBeats);
    const step: GrooveProgressionStep = {
      id: newProgressionStepId(),
      label: '',
      beats: defaultCardBeats,
      hitsPerBar: barBeats.length || defaultHitsPerBar,
      barBeats: barBeats.length ? [...barBeats] : barBeatsFromHitsPerBar(defaultHitsPerBar),
    };
    const next = [...steps, step];
    onStepsChange(next);
    setSelectedId(step.id);
  }, [defaultBarBeats, defaultCardBeats, defaultHitsPerBar, onStepsChange, steps]);

  const applyDefaultHits = useCallback(
    (hits: number) => {
      const barBeats = barBeatsFromHitsPerBar(hits);
      const clamped = barBeats.length;
      setDefaultHitsPerBar(clamped);
      setDefaultBarBeats(barBeats);
      onStepsChange(
        steps.map((s) => ({ ...s, hitsPerBar: clamped, barBeats: [...barBeats] })),
      );
    },
    [onStepsChange, steps],
  );

  const applyDefaultBarBeats = useCallback(
    (beats: readonly number[]) => {
      const normalized = normalizeBarBeats(beats);
      if (normalized.length === 0) return;
      setDefaultBarBeats(normalized);
      setDefaultHitsPerBar(normalized.length);
      onStepsChange(
        steps.map((s) => ({ ...s, hitsPerBar: normalized.length, barBeats: [...normalized] })),
      );
    },
    [onStepsChange, steps],
  );

  const commitPaste = useCallback(() => {
    const pasted = stepsFromPasteLine(pasteText, defaultCardBeats).map((s) => ({
      ...s,
      hitsPerBar: defaultHitsPerBar,
      barBeats: [...defaultBarBeats],
    }));
    if (pasted.length === 0) return;
    const room = GROOVE_PROGRESSION_MAX_TIMELINE_CARDS - steps.length;
    const next = [...steps, ...pasted.slice(0, Math.max(0, room))];
    onStepsChange(next);
    setSelectedId(next[next.length - 1]?.id ?? null);
    setPasteText('');
    setPasteOpen(false);
  }, [defaultBarBeats, defaultCardBeats, defaultHitsPerBar, onStepsChange, pasteText, steps]);

  const accent = accentHex;

  const loopLabel = useMemo(() => `${loopBars}b`, [loopBars]);

  return (
    <div
      className="shrink-0 border-b"
      style={{
        borderColor: '#1a2438',
        background: 'linear-gradient(180deg, #06080c 0%, #030508 100%)',
        maxHeight: 132,
        overflowY: 'auto',
      }}
    >
      <div className="px-2 py-1.5">
        <div style={{ ...toolRowStyle, marginBottom: 4 }}>
          <span
            className="font-black uppercase tracking-wide inline-flex items-center gap-1"
            style={{ color: accent, fontSize: 9, lineHeight: 1 }}
          >
            Rhythm
            <StudioEditor2HelpTip tab="rhythmEdit" title="Rhythm Edit lane — how to use hits per bar" />
          </span>
          <span style={sectionLabelStyle}>HITS</span>
          {[1, 2, 3, 4].map((hits) => (
            <button
              key={hits}
              type="button"
              disabled={disabled}
              onClick={() => applyDefaultHits(hits)}
              style={miniToggleStyle(defaultHitsPerBar === hits)}
            >
              {hits}×
            </button>
          ))}
          <span style={sectionLabelStyle}>BEAT</span>
          {GROOVE_BAR_BEAT_PATTERN_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              disabled={disabled}
              onClick={() => applyDefaultBarBeats(opt.beats)}
              style={miniToggleStyle(barBeatPatternKey(defaultBarBeats) === opt.key)}
              title={opt.label}
            >
              {opt.label}
            </button>
          ))}
          <span className="ml-auto" style={{ ...fieldLabelStyle, fontSize: 7 }}>
            {steps.length}/{GROOVE_PROGRESSION_MAX_TIMELINE_CARDS}
          </span>
        </div>

        <div style={{ ...toolRowStyle, marginBottom: 4 }}>
          <span style={sectionLabelStyle}>LEN</span>
          {[1, 2, 4].map((b) => (
            <button
              key={b}
              type="button"
              disabled={disabled}
              onClick={() => setDefaultCardBeats(b)}
              style={miniToggleStyle(defaultCardBeats === b)}
            >
              {b === 1 ? '¼' : b === 2 ? '½' : '1'}
            </button>
          ))}
          <button type="button" disabled={disabled} onClick={addStep} style={smallBtnStyle}>
            + Chord
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setPasteOpen((v) => !v)}
            style={smallBtnStyle}
          >
            Paste
          </button>
          {pullSources.length > 0 && onPullFromTrack ? (
            <>
              <span style={sectionLabelStyle}>FROM</span>
              <select
                disabled={disabled}
                value={pullFromIndex}
                onChange={(e) => setPullFromIndex(Number(e.target.value))}
                className="rounded font-semibold max-w-[7rem]"
                style={{
                  background: '#0a0e14',
                  color: '#c4b5fd',
                  border: '1px solid #312e81',
                  fontSize: 8,
                  lineHeight: 1.1,
                  padding: '1px 4px',
                }}
                title="Pick another MIDI lane to copy melody or chord steps from"
              >
                {pullSources.map((src) => (
                  <option key={src.index} value={src.index}>
                    {src.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={disabled || pullFromIndex < 0}
                onClick={() => onPullFromTrack(pullFromIndex)}
                style={smallBtnStyle}
                title="Copy MIDI notes from the selected lane"
              >
                Copy
              </button>
            </>
          ) : null}
          <span style={sectionLabelStyle}>LOOP</span>
          {STUDIO_HARMONY_LOOP_BAR_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onLoopBarsChange(n)}
              style={miniToggleStyle(loopBars === n)}
            >
              {n}
            </button>
          ))}
          <span style={{ ...fieldLabelStyle, fontSize: 7 }}>{loopLabel}</span>
          <button
            type="button"
            disabled={disabled || !applyReady}
            onClick={onApplyToRoll}
            className="ml-auto"
            style={{
              ...smallBtnStyle,
              background: applyReady ? '#15321e' : '#111',
              color: applyReady ? '#4ade80' : '#444',
              border: `1px solid ${applyReady ? '#22c55e88' : '#222'}`,
              padding: '2px 10px',
            }}
            title="Chop rhythm hits into separate notes on the piano roll below"
          >
            Apply to roll
          </button>
        </div>

        {pasteOpen ? (
          <div className="flex gap-1 mb-1">
            <input
              type="text"
              disabled={disabled}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="C Am F G"
              className="flex-1 min-w-0 rounded px-1.5 font-mono"
              style={{
                background: '#0a0a0a',
                border: '1px solid #1a1a1a',
                color: '#e5e7eb',
                fontSize: 9,
                lineHeight: 1.2,
                paddingTop: 2,
                paddingBottom: 2,
              }}
            />
            <button type="button" disabled={disabled} onClick={commitPaste} style={smallBtnStyle}>
              Add
            </button>
          </div>
        ) : null}

        <div
          style={{
            padding: '2px 4px',
            background: '#020305',
            border: '1px solid #1a2438',
            borderRadius: 4,
            overflowX: 'auto',
          }}
        >
          <div style={{ display: 'flex', gap: 3, minHeight: 22, maxHeight: 22, alignItems: 'center' }}>
            {steps.length === 0 ? (
              <span style={{ fontSize: 8, color: '#4b5563', fontStyle: 'italic', padding: '0 4px', lineHeight: 1 }}>
                + Chord → Apply to roll
              </span>
            ) : (
              steps.map((step, idx) => (
                <RhythmStepCard
                  key={step.id}
                  step={step}
                  index={idx}
                  selected={step.id === selectedId}
                  onSelect={() => setSelectedId(step.id)}
                  onRemove={() => removeStep(step.id)}
                  onChange={(patch) => updateStep(step.id, patch)}
                  onHear={() => onPreviewStep(step)}
                  disabled={disabled}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
