import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { parseChordSymbolToken } from '@/app/lib/creationStation/chordProgressionParse';
import {
  DEFAULT_GROOVE_8BAR_SONG_ID,
  GROOVE_8BAR_SONG_BANK,
  GROOVE_8BAR_SONG_BANK_SECTIONS,
  GROOVE_CHORD_PALETTE,
  chordLabelsToEightBarSketch,
  bpmFor8BarSongPreset,
  format8BarSongPresetLabel,
  resolve8BarSongPresetTempo,
  songBankToEightBarSketch,
  suggestNextChordLabels,
} from '@/app/lib/creationStation/grooveLabProgressionLibrary';
import {
  newProgressionStepId,
  type GrooveProgressionStep,
} from '@/app/lib/creationStation/grooveLabProgressionBuilder';

export type GrooveSketchBarCount = 4 | 8;
const BEATS_PER_BAR = 4;
const BAR_MIN_WIDTH = 96;

export type SketchSlot = {
  label: string;
  rest: boolean;
};

function emptySlots(barCount: number): SketchSlot[] {
  return Array.from({ length: barCount }, () => ({ label: '', rest: false }));
}

function sketchToSteps(slots: readonly SketchSlot[], beatsPerCard: number): GrooveProgressionStep[] {
  return slots.map((s) => ({
    id: newProgressionStepId(),
    label: s.rest ? '' : s.label.trim(),
    beats: beatsPerCard,
    rest: s.rest || (!s.rest && !s.label.trim()),
  }));
}

function stepsToSketch(steps: readonly GrooveProgressionStep[], barCount: number): SketchSlot[] {
  const labels = steps
    .filter((s) => !s.rest && s.label.trim())
    .map((s) => s.label.trim());
  return chordLabelsToEightBarSketch(labels, barCount);
}

function firstEmptyBar(slots: readonly SketchSlot[], barCount: number): number {
  const i = slots.findIndex((s) => s.rest || !s.label.trim());
  return i >= 0 ? i : barCount - 1;
}

export interface GrooveEightChordSketchProps {
  grooveBranding?: boolean;
  defaultOpen?: boolean;
  keyRoot: number;
  mode: ChordMode;
  genreId: string;
  mainTimelineSteps: readonly GrooveProgressionStep[];
  packChordLabels: readonly string[];
  auditionPlaying?: boolean;
  auditionStepIndex?: number | null;
  onPreviewStep: (step: GrooveProgressionStep) => void;
  onPlayProgression: (steps: GrooveProgressionStep[]) => void;
  onLoopProgression: (steps: GrooveProgressionStep[]) => void;
  onStopAudition: () => void;
  onSendToMainTimeline: (steps: GrooveProgressionStep[]) => void;
  /** Place sketch chords directly on the piano roll (bar-aligned). */
  onDropToRoll?: (steps: GrooveProgressionStep[]) => void;
  /** 2 = half bar (eighth-note feel) · 4 = full bar per card */
  defaultCardBeats?: number;
  /** When true (and onBpmChange set), loading a song bank sets session BPM. */
  autoSongBankTempo?: boolean;
  onBpmChange?: (bpm: number) => void;
  onSongBankTempoNote?: (note: string | null) => void;
}

export function GrooveEightChordSketch({
  grooveBranding = false,
  defaultOpen = false,
  keyRoot,
  mode,
  genreId,
  mainTimelineSteps,
  packChordLabels,
  auditionPlaying = false,
  auditionStepIndex = null,
  onPreviewStep,
  onPlayProgression,
  onLoopProgression,
  onStopAudition,
  onSendToMainTimeline,
  onDropToRoll,
  defaultCardBeats = BEATS_PER_BAR,
  autoSongBankTempo = true,
  onBpmChange,
  onSongBankTempoNote,
}: GrooveEightChordSketchProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [sketchBarCount, setSketchBarCount] = useState<GrooveSketchBarCount>(8);
  const [slots, setSlots] = useState<SketchSlot[]>(() => emptySlots(8));
  const [sketchLoopOn, setSketchLoopOn] = useState(false);
  /** True while this sketch started play/loop (so bar highlight follows sketch, not pack/timeline). */
  const [sketchDrivingAudition, setSketchDrivingAudition] = useState(false);
  const [selectedBar, setSelectedBar] = useState(0);
  const [pickedChord, setPickedChord] = useState<string | null>(null);
  const [songBankId, setSongBankId] = useState(DEFAULT_GROOVE_8BAR_SONG_ID);

  useEffect(() => {
    if (!auditionPlaying) {
      setSketchLoopOn(false);
      setSketchDrivingAudition(false);
    }
  }, [auditionPlaying]);

  const stopSketchAudition = useCallback(() => {
    setSketchLoopOn(false);
    setSketchDrivingAudition(false);
    onStopAudition();
  }, [onStopAudition]);

  const sketchSteps = useMemo(
    () => sketchToSteps(slots, defaultCardBeats),
    [slots, defaultCardBeats],
  );

  const setSketchLength = useCallback((next: GrooveSketchBarCount) => {
    setSketchBarCount(next);
    setSlots((prev) => {
      const fresh = emptySlots(next);
      for (let i = 0; i < Math.min(next, prev.length); i++) {
        fresh[i] = prev[i]!;
      }
      return fresh;
    });
    setSelectedBar((i) => Math.min(i, next - 1));
  }, []);
  const hasPlayable = sketchSteps.some(
    (s) => !s.rest && s.label.trim() && parseChordSymbolToken(s.label),
  );

  const sketchStepsForSuggest = useMemo(
    () =>
      slots
        .filter((s) => !s.rest && s.label.trim())
        .map((s, i) => ({
          id: `sk-${i}`,
          label: s.label,
          beats: defaultCardBeats,
        })),
    [slots, defaultCardBeats],
  );

  const nextChords = useMemo(
    () =>
      suggestNextChordLabels(sketchStepsForSuggest, {
        keyRoot,
        mode,
        genreId,
        topK: 10,
      }),
    [sketchStepsForSuggest, keyRoot, mode, genreId],
  );

  const updateSlot = useCallback((index: number, patch: Partial<SketchSlot>) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }, []);

  const placeChord = useCallback(
    (label: string, barIndex?: number) => {
      const trimmed = label.trim();
      if (!trimmed || !parseChordSymbolToken(trimmed)) return;
      const idx = barIndex ?? firstEmptyBar(slots, sketchBarCount);
      updateSlot(idx, { label: trimmed, rest: false });
      setSelectedBar(idx);
      setPickedChord(trimmed);
      onPreviewStep({
        id: 'sketch-place',
        label: trimmed,
        beats: defaultCardBeats,
      });
    },
    [slots, sketchBarCount, updateSlot, onPreviewStep, defaultCardBeats],
  );

  const previewBar = useCallback(
    (index: number) => {
      const step = sketchSteps[index];
      if (!step || step.rest || !step.label.trim()) return;
      setSelectedBar(index);
      onPreviewStep(step);
    },
    [sketchSteps, onPreviewStep],
  );

  const previewChord = useCallback(
    (label: string) => {
      if (!parseChordSymbolToken(label)) return;
      setPickedChord(label);
      onPreviewStep({ id: 'sketch-bank', label, beats: defaultCardBeats });
    },
    [onPreviewStep, defaultCardBeats],
  );

  const playSketchOnce = useCallback(() => {
    if (!hasPlayable) return;
    setSketchLoopOn(false);
    setSketchDrivingAudition(true);
    onStopAudition();
    onPlayProgression(sketchSteps);
  }, [hasPlayable, sketchSteps, onPlayProgression, onStopAudition]);

  const toggleSketchLoop = useCallback(() => {
    if (sketchLoopOn) {
      stopSketchAudition();
      return;
    }
    if (!hasPlayable) return;
    setSketchLoopOn(true);
    setSketchDrivingAudition(true);
    onStopAudition();
    onLoopProgression(sketchSteps);
  }, [sketchLoopOn, hasPlayable, sketchSteps, onLoopProgression, onStopAudition, stopSketchAudition]);

  const playingBarIndex =
    sketchDrivingAudition && auditionPlaying && auditionStepIndex != null
      ? auditionStepIndex
      : null;

  const loadSongBank = useCallback((id: string) => {
    const bank = GROOVE_8BAR_SONG_BANK.find((b) => b.id === id);
    if (!bank) return;
    setSongBankId(id);
    setSlots(songBankToEightBarSketch(bank.chords, sketchBarCount));
    setSelectedBar(0);
    if (autoSongBankTempo && onBpmChange) {
      const resolved = resolve8BarSongPresetTempo(bank);
      onBpmChange(resolved.bpm);
      onSongBankTempoNote?.(resolved.note);
    }
  }, [sketchBarCount, autoSongBankTempo, onBpmChange, onSongBankTempoNote]);

  const studioLabel = grooveBranding ? 'GROOVE' : 'ORCHID';
  const filledCount = slots.filter((s) => !s.rest && s.label.trim()).length;

  return (
    <div
      style={{
        marginBottom: 10,
        border: `1px solid ${open ? '#3b82f666' : '#1a2438'}`,
        borderRadius: 8,
        background: open ? '#0a1018' : '#080a0e',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="8-bar chord phrase — chord bank + song presets. Main builder unchanged until you send."
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 10px',
          background: open ? '#0e1a28' : 'transparent',
          border: 'none',
          color: open ? '#93c5fd' : '#6b7280',
          fontSize: 9,
          fontWeight: 900,
          cursor: 'pointer',
          letterSpacing: 0.3,
        }}
      >
        <span>
          {open ? '▼' : '▸'} {sketchBarCount}-CHORD SONG SKETCH
          <span style={{ color: '#4b5563', fontWeight: 700, marginLeft: 6 }}>
            ({sketchBarCount} bars · chord bank)
          </span>
        </span>
        <span style={{ fontSize: 8, color: filledCount >= sketchBarCount ? '#86efac' : '#fde68a' }}>
          {filledCount}/{sketchBarCount} bars
        </span>
      </button>

      {open ? (
        <div style={{ padding: '0 10px 10px' }}>
          <p style={{ margin: '0 0 8px', fontSize: 8, color: '#6b7280', lineHeight: 1.45 }}>
            Choose <strong style={{ color: '#93c5fd' }}>4 or 8 bars</strong>. Card length (½ bar vs full bar) follows
            the progression builder toggle. Song bank fills the visible bars.
          </p>

          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={sectionLabel}>PHRASE LENGTH</span>
            {([4, 8] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSketchLength(n)}
                style={miniBtn(sketchBarCount === n)}
              >
                {n} BARS
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={sectionLabel}>SONG BANK</div>
            <GrooveSongBankPicker value={songBankId} onSelect={loadSongBank} />
            <button
              type="button"
              onClick={() => loadSongBank(songBankId)}
              style={{ ...miniBtn(true), marginTop: 6, fontSize: 9, padding: '6px 10px' }}
            >
              LOAD {sketchBarCount}-BAR SONG
            </button>
          </div>

          {pickedChord ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
                marginBottom: 8,
                padding: '6px 8px',
                background: '#0a120e',
                border: '1px solid #22c55e55',
                borderRadius: 6,
              }}
            >
              <span style={{ fontSize: 8, color: '#4b5563', fontWeight: 800 }}>PICKED</span>
              <span style={{ fontSize: 12, fontWeight: 900, color: '#86efac', fontFamily: 'monospace' }}>
                {pickedChord}
              </span>
              <button type="button" onClick={() => previewChord(pickedChord)} style={miniBtn(true)}>
                ▶ HEAR
              </button>
              <button
                type="button"
                onClick={() => placeChord(pickedChord, selectedBar)}
                style={miniBtn(true, false, '#15321e', '#4ade80')}
              >
                → BAR {selectedBar + 1}
              </button>
              <button
                type="button"
                onClick={() => placeChord(pickedChord)}
                style={miniBtn(true)}
                title="Next empty bar"
              >
                → NEXT EMPTY
              </button>
            </div>
          ) : null}

          <div style={{ marginBottom: 8 }}>
            <div style={sectionLabel}>CHORD BANK — click hear · double-click bar {selectedBar + 1}</div>
            {GROOVE_CHORD_PALETTE.map((section) => (
              <div key={section.title} style={{ marginBottom: 5 }}>
                <div style={{ fontSize: 7, color: '#374151', fontWeight: 800, marginBottom: 3 }}>
                  {section.title}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {section.chords.map((ch) => (
                    <button
                      key={`${section.title}-${ch}`}
                      type="button"
                      onClick={() => previewChord(ch)}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        placeChord(ch, selectedBar);
                      }}
                      title={`Hear · double-click = bar ${selectedBar + 1}`}
                      style={{
                        ...bankChipStyle,
                        background: pickedChord === ch ? '#15321e' : bankChipStyle.background,
                        border: `1px solid ${pickedChord === ch ? '#4ade80' : '#1f3a29'}`,
                      }}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {nextChords.length > 0 ? (
            <div style={{ marginBottom: 8 }}>
              <div style={sectionLabel}>NEXT CHORDS (for bar {firstEmptyBar(slots) + 1})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {nextChords.map((s) => (
                  <button
                    key={`${s.roman}-${s.label}`}
                    type="button"
                    onClick={() => previewChord(s.label)}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      placeChord(s.label);
                    }}
                    style={bankChipStyle}
                    title={`${s.strength}% · double-click = next empty bar`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            <button
              type="button"
              disabled={!hasPlayable}
              onClick={() => {
                if (auditionPlaying) stopSketchAudition();
                else playSketchOnce();
              }}
              style={miniBtn(hasPlayable, auditionPlaying)}
            >
              {auditionPlaying ? '■ STOP' : '▶ PLAY 8 BARS'}
            </button>
            <button
              type="button"
              disabled={!hasPlayable}
              onClick={toggleSketchLoop}
              style={miniBtn(hasPlayable, sketchLoopOn, '#0e2838', '#67e8f9')}
            >
              {sketchLoopOn ? '↻ LOOP ON' : '↻ LOOP 8'}
            </button>
            <button
              type="button"
              disabled={packChordLabels.length === 0}
              onClick={() => setSlots(chordLabelsToEightBarSketch(packChordLabels, sketchBarCount))}
              style={miniBtn(packChordLabels.length > 0)}
              title="Repeat current pack loop across all 8 bars (4-chord packs fill ×2)"
            >
              PACK → 8 BARS
            </button>
            <button
              type="button"
              disabled={mainTimelineSteps.length === 0}
              onClick={() => setSlots(stepsToSketch(mainTimelineSteps))}
              style={miniBtn(mainTimelineSteps.length > 0)}
            >
              FROM TIMELINE
            </button>
            <button type="button" onClick={() => setSlots(emptySlots())} style={miniBtn(true)}>
              CLEAR
            </button>
            {onDropToRoll ? (
              <button
                type="button"
                disabled={!hasPlayable}
                onClick={() => {
                  setSketchLoopOn(false);
                  setSketchDrivingAudition(false);
                  onStopAudition();
                  onDropToRoll(sketchSteps);
                }}
                style={miniBtn(hasPlayable, false, '#0e2838', '#67e8f9')}
                title="Green chords only (C4+) — no blue bass. Use + MATCH BASS in progression for 808."
              >
                DROP 8 TO ROLL
              </button>
            ) : null}
            <button
              type="button"
              disabled={!hasPlayable}
              onClick={() => {
                onSendToMainTimeline(sketchSteps);
                setSketchLoopOn(false);
                setSketchDrivingAudition(false);
              }}
              style={{
                ...miniBtn(hasPlayable, false, '#15321e', '#4ade80'),
                marginLeft: onDropToRoll ? undefined : 'auto',
              }}
            >
              SEND TO MAIN BUILDER →
            </button>
          </div>

          <div
            style={{
              overflowX: 'auto',
              paddingBottom: 4,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${sketchBarCount}, ${BAR_MIN_WIDTH}px)`,
                gap: 6,
                minWidth: sketchBarCount * (BAR_MIN_WIDTH + 6),
              }}
            >
              {slots.map((slot, i) => {
                const valid =
                  slot.rest ||
                  (slot.label.trim() !== '' && Boolean(parseChordSymbolToken(slot.label)));
                const selected = selectedBar === i;
                const playing = playingBarIndex === i;
                const filled = !slot.rest && slot.label.trim();
                const borderColor = playing
                  ? '#67e8f9'
                  : selected
                    ? '#4ade80'
                    : filled
                      ? '#1f3a29'
                      : '#374151';
                return (
                  <div
                    key={i}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedBar(i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && pickedChord) placeChord(pickedChord, i);
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      padding: '6px 4px 8px',
                      borderRadius: 6,
                      background: playing
                        ? '#0e2838'
                        : selected
                          ? '#15321e'
                          : slot.rest
                            ? '#0f1014'
                            : '#0c1018',
                      border: `2px solid ${borderColor}`,
                      boxShadow: playing
                        ? '0 0 14px #22d3ee88'
                        : selected
                          ? '0 0 10px #22c55e33'
                          : undefined,
                      minHeight: 108,
                      cursor: 'pointer',
                      transition: 'background 0.08s ease, border-color 0.08s ease, box-shadow 0.08s ease',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 8,
                        color: playing ? '#67e8f9' : selected ? '#86efac' : '#4b5563',
                        fontWeight: 800,
                        textAlign: 'center',
                      }}
                    >
                      {playing ? '▶ ' : ''}BAR {i + 1}
                    </span>
                    {slot.rest ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateSlot(i, { rest: false, label: pickedChord ?? '' });
                        }}
                        style={{
                          flex: 1,
                          border: '1px dashed #374151',
                          borderRadius: 4,
                          background: 'transparent',
                          color: '#6b7280',
                          fontSize: 10,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        + CHORD
                      </button>
                    ) : (
                      <input
                        type="text"
                        value={slot.label}
                        onFocus={() => setSelectedBar(i)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateSlot(i, { label: e.target.value, rest: false })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') previewBar(i);
                        }}
                        placeholder="Cmaj7"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          background: '#050805',
                          color: valid ? '#ecfdf5' : '#f87171',
                          border: `1px solid ${valid ? '#1f3a29' : '#7f1d1d'}`,
                          borderRadius: 4,
                          padding: '6px 2px',
                          fontSize: 13,
                          fontWeight: 900,
                          fontFamily: 'monospace',
                          textAlign: 'center',
                        }}
                      />
                    )}
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateSlot(i, {
                            rest: !slot.rest,
                            label: slot.rest ? pickedChord ?? '' : slot.label,
                          });
                        }}
                        style={tinyBtn()}
                        title="Rest"
                      >
                        {slot.rest ? '♪' : '—'}
                      </button>
                      {!slot.rest && filled ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            previewBar(i);
                          }}
                          style={tinyBtn()}
                        >
                          ▶
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 7, color: '#4b5563' }}>
            Tip: 4-chord packs use <strong style={{ color: '#93c5fd' }}>PACK → 8 BARS</strong> to repeat
            the loop twice. Play always runs <strong style={{ color: '#86efac' }}>8 bars</strong> (rests
            where empty).
          </p>
        </div>
      ) : null}
    </div>
  );
}

function GrooveSongBankPicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const currentLabel = useMemo(() => {
    const bank = GROOVE_8BAR_SONG_BANK.find((b) => b.id === value);
    return bank ? format8BarSongPresetLabel(bank) : 'Choose a song preset…';
  }, [value]);

  const previewMeta = useMemo(() => {
    if (!hoverId) return null;
    const bank = GROOVE_8BAR_SONG_BANK.find((b) => b.id === hoverId);
    if (!bank) return null;
    return {
      label: bank.label,
      bpm: bpmFor8BarSongPreset(bank),
    };
  }, [hoverId]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target || rootRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const scrollList = useCallback((delta: number) => {
    listRef.current?.scrollBy({ top: delta, behavior: 'smooth' });
  }, []);

  return (
    <div ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          minHeight: 40,
          padding: '8px 12px',
          background: open ? '#0e1a28' : '#0a0e16',
          color: '#dbeafe',
          border: `2px solid ${open ? '#3b82f6' : '#1e3a5f'}`,
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 800,
          cursor: 'pointer',
          textAlign: 'left',
          boxShadow: open ? '0 0 0 1px #3b82f633' : undefined,
        }}
      >
        <span style={{ flex: 1, lineHeight: 1.35 }}>{currentLabel}</span>
        <span
          aria-hidden
          style={{
            fontSize: 16,
            lineHeight: 1,
            color: open ? '#93c5fd' : '#6b7280',
            transform: open ? 'rotate(180deg)' : undefined,
            transition: 'transform 0.12s ease',
          }}
        >
          ▾
        </span>
      </button>

      {open ? (
        <div
          style={{
            marginTop: 6,
            border: '2px solid #1e3a5f',
            borderRadius: 8,
            background: '#070b12',
            overflow: 'hidden',
            boxShadow: '0 10px 28px rgba(0,0,0,0.45)',
          }}
        >
          {previewMeta ? (
            <div
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid #1e3a5f',
                background: '#0a1220',
                fontSize: 11,
                fontWeight: 800,
                color: '#93c5fd',
                lineHeight: 1.35,
              }}
            >
              Preview: {previewMeta.label}
              <span style={{ color: '#86efac', marginLeft: 8 }}>{previewMeta.bpm} BPM</span>
            </div>
          ) : (
            <div
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid #1e3a5f',
                background: '#0a1220',
                fontSize: 10,
                fontWeight: 700,
                color: '#6b7280',
              }}
            >
              Scroll the list — hover to preview · click to load
            </div>
          )}

          <button
            type="button"
            onClick={() => scrollList(-140)}
            aria-label="Scroll song bank up"
            style={songBankScrollBtnStyle}
          >
            ▲ SCROLL UP
          </button>

          <div
            ref={listRef}
            className="groove-song-bank-scroll"
            role="listbox"
            aria-label="Song bank presets"
            style={{
              maxHeight: 300,
              overflowY: 'auto',
              padding: '4px 6px 6px',
            }}
          >
            {GROOVE_8BAR_SONG_BANK_SECTIONS.map((section) => (
              <div key={section.label} style={{ marginBottom: 6 }}>
                <div
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    padding: '6px 10px 4px',
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: 0.5,
                    color: '#60a5fa',
                    background: '#070b12',
                    borderBottom: '1px solid #152238',
                  }}
                >
                  {section.label}
                </div>
                {section.banks.map((b) => {
                  const active = b.id === value;
                  const hovered = hoverId === b.id;
                  const rowBpm = bpmFor8BarSongPreset(b);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setHoverId(b.id)}
                      onMouseLeave={() => setHoverId((id) => (id === b.id ? null : id))}
                      onClick={() => {
                        onSelect(b.id);
                        setOpen(false);
                        setHoverId(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        padding: '10px 12px',
                        marginTop: 2,
                        border: `1px solid ${active ? '#3b82f6' : hovered ? '#2563eb55' : 'transparent'}`,
                        borderRadius: 6,
                        background: active ? '#1e3a5f' : hovered ? '#0f172a' : 'transparent',
                        color: active ? '#bfdbfe' : hovered ? '#e0f2fe' : '#cbd5e1',
                        fontSize: 12,
                        fontWeight: active ? 900 : 700,
                        lineHeight: 1.4,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ flex: 1 }}>{b.label}</span>
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: 11,
                          fontWeight: 900,
                          color: active ? '#86efac' : '#6ee7b7',
                          fontFamily: 'monospace',
                        }}
                      >
                        {rowBpm} BPM
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollList(140)}
            aria-label="Scroll song bank down"
            style={songBankScrollBtnStyle}
          >
            ▼ SCROLL DOWN
          </button>
        </div>
      ) : null}
    </div>
  );
}

const songBankScrollBtnStyle: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: 'none',
  borderTop: '1px solid #1e3a5f',
  borderBottom: '1px solid #1e3a5f',
  background: '#112240',
  color: '#93c5fd',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.4,
  cursor: 'pointer',
};

const sectionLabel: CSSProperties = {
  fontSize: 8,
  color: '#93c5fd',
  fontWeight: 900,
  letterSpacing: 0.4,
  marginBottom: 4,
};

const bankChipStyle: CSSProperties = {
  background: '#0d1812',
  color: '#86efac',
  border: '1px solid #1f3a29',
  borderRadius: 5,
  padding: '3px 8px',
  fontSize: 9,
  fontWeight: 900,
  fontFamily: 'monospace',
  cursor: 'pointer',
};

function miniBtn(
  enabled: boolean,
  active = false,
  bg = '#112015',
  color = '#86efac',
): CSSProperties {
  return {
    background: enabled ? (active ? '#1a3a2a' : bg) : '#111',
    color: enabled ? color : '#444',
    border: `1px solid ${enabled ? '#1f3a29' : '#222'}`,
    borderRadius: 5,
    padding: '4px 8px',
    fontSize: 8,
    fontWeight: 900,
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}

function tinyBtn(): CSSProperties {
  return {
    background: '#111820',
    color: '#93c5fd',
    border: '1px solid #1e3a5f',
    borderRadius: 4,
    padding: '2px 5px',
    fontSize: 7,
    fontWeight: 900,
    cursor: 'pointer',
    minWidth: 22,
  };
}
