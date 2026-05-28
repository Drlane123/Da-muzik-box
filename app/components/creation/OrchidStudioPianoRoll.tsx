import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Eraser, Minimize2, Music2, Pencil, Piano } from 'lucide-react';
import type { OrchidPerformanceMode } from '@/app/lib/creationStation/orchidChordEngine';
import { orchidNoteOnsets } from '@/app/lib/creationStation/orchidChordEngine';
import {
  CHORD_BASS_SEQ_CHANNEL_BASE,
  chordBassSeqStepChannelLabel,
} from '@/app/lib/creationStation/chordBassSequencerSession';
import {
  CB_PIANO_MINT,
  CB_PIANO_MINT_BORDER,
  cbPianoMidiToNoteName,
} from '@/app/lib/creationStation/chordBuilderPianoRollTheme';

export interface OrchidBassRollHit {
  slot: number;
  sustainSlots: number;
  midiOffset: number;
  vel: number;
}

export interface OrchidStudioPianoRollProps {
  stepIndex: number;
  stepCount: number;
  bassRootMidi: number;
  chordLabel: string;
  orchidMatchLabel: string;
  hits: OrchidBassRollHit[];
  onHitsChange: (hits: OrchidBassRollHit[]) => void;
  noteLengthSlots: number;
  onNoteLengthChange: (slots: number) => void;
  onPreviewStep: () => void;
  onStepChange: (stepIndex: number) => void;
  onClearStep: () => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  linkedChordsActive: boolean;
  orchidChordNotes: number[];
  bpm: number;
  perfMode: OrchidPerformanceMode;
  /** Side-panel layout (Beat Lab style) — piano keys left, grid right. */
  sidePanel?: boolean;
}

const SLOT_COUNT = 8;
const ROW_H = 18;
const LABEL_W = 56;
const RULER_H = 20;

const ROW_OFFSETS = [
  12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12,
] as const;

function clampSus(slot: number, sus: number): number {
  return Math.max(1, Math.min(SLOT_COUNT - slot, Math.round(sus)));
}

function hitId(h: OrchidBassRollHit): string {
  return `${h.slot}:${h.midiOffset}`;
}

function chordGhostSlots(noteCount: number, bpm: number, perfMode: OrchidPerformanceMode): number[] {
  const secPerStep = (60 / Math.max(40, bpm)) * 2;
  const onsets = orchidNoteOnsets(noteCount, secPerStep * 0.85, { mode: perfMode, bpm });
  return onsets.map((t) => Math.min(SLOT_COUNT - 1, Math.max(0, Math.floor((t / secPerStep) * SLOT_COUNT))));
}

type DragState = {
  origSlot: number;
  origOffset: number;
  curSlot: number;
  curOffset: number;
  sustainSlots: number;
  vel: number;
  moved: boolean;
};

type ResizeState = {
  startSlot: number;
  midiOffset: number;
  endSlot: number;
};

export function OrchidStudioPianoRoll({
  stepIndex,
  stepCount,
  bassRootMidi,
  chordLabel,
  orchidMatchLabel,
  hits,
  onHitsChange,
  noteLengthSlots,
  onNoteLengthChange,
  onPreviewStep,
  onStepChange,
  onClearStep,
  expanded,
  onExpandedChange,
  linkedChordsActive,
  orchidChordNotes,
  bpm,
  perfMode,
  sidePanel = true,
}: OrchidStudioPianoRollProps) {
  const [tool, setTool] = useState<'paint' | 'erase'>('paint');
  const [, bump] = useState(0);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const channelLabel = chordBassSeqStepChannelLabel(stepIndex);
  const colPct = 100 / SLOT_COUNT;

  const chordGhost = useMemo(() => {
    if (!linkedChordsActive || orchidChordNotes.length === 0) return [];
    const slots = chordGhostSlots(orchidChordNotes.length, bpm, perfMode);
    return orchidChordNotes.map((midi, i) => ({
      midi,
      slot: slots[i] ?? 0,
      offset: midi - bassRootMidi,
      label: cbPianoMidiToNoteName(midi),
    }));
  }, [linkedChordsActive, orchidChordNotes, bpm, perfMode, bassRootMidi]);

  const chordGhostRows = useMemo(() => {
    const seen = new Set<number>();
    const rows: { offset: number; label: string; notes: typeof chordGhost }[] = [];
    for (const g of chordGhost) {
      if (seen.has(g.offset)) continue;
      seen.add(g.offset);
      rows.push({
        offset: g.offset,
        label: g.label,
        notes: chordGhost.filter((x) => x.offset === g.offset),
      });
    }
    return rows.sort((a, b) => b.offset - a.offset);
  }, [chordGhost]);

  const deleteNote = useCallback(
    (note: OrchidBassRollHit) => {
      onHitsChange(hits.filter((h) => !(h.slot === note.slot && h.midiOffset === note.midiOffset)));
      bump((n) => n + 1);
    },
    [hits, onHitsChange],
  );

  const beginDrag = useCallback(
    (note: OrchidBassRollHit, startX: number, startY: number) => {
      dragRef.current = {
        origSlot: note.slot,
        origOffset: note.midiOffset,
        curSlot: note.slot,
        curOffset: note.midiOffset,
        sustainSlots: note.sustainSlots,
        vel: note.vel,
        moved: false,
      };
      bump((n) => n + 1);
      const TH = 5;
      const onMove = (ev: MouseEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!d.moved && dx * dx + dy * dy < TH * TH) return;
        const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
        const cell = el?.closest('[data-orchid-slot]') as HTMLElement | null;
        if (!cell) return;
        const slot = Number(cell.getAttribute('data-orchid-slot'));
        const offset = Number(cell.getAttribute('data-orchid-offset'));
        if (Number.isNaN(slot) || Number.isNaN(offset)) return;
        if (d.curSlot !== slot || d.curOffset !== offset) {
          d.curSlot = slot;
          d.curOffset = offset;
          d.moved =
            d.moved || slot !== d.origSlot || offset !== d.origOffset;
          bump((n) => n + 1);
        }
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        const d = dragRef.current;
        dragRef.current = null;
        bump((n) => n + 1);
        if (!d?.moved) return;
        const next = hits.filter(
          (h) => !(h.slot === d.origSlot && h.midiOffset === d.origOffset),
        );
        next.push({
          slot: d.curSlot,
          midiOffset: d.curOffset,
          sustainSlots: clampSus(d.curSlot, d.sustainSlots),
          vel: d.vel,
        });
        onHitsChange(next.filter(
          (h, i, arr) => arr.findIndex((x) => x.slot === h.slot && x.midiOffset === h.midiOffset) === i,
        ));
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [hits, onHitsChange],
  );

  const beginResize = useCallback(
    (note: OrchidBassRollHit) => {
      resizeRef.current = {
        startSlot: note.slot,
        midiOffset: note.midiOffset,
        endSlot: note.slot + Math.round(note.sustainSlots) - 1,
      };
      bump((n) => n + 1);
      const onMove = (ev: MouseEvent) => {
        const r = resizeRef.current;
        if (!r) return;
        const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
        const cell = el?.closest('[data-orchid-slot]') as HTMLElement | null;
        let target = r.endSlot;
        if (cell && Number(cell.getAttribute('data-orchid-offset')) === r.midiOffset) {
          target = Number(cell.getAttribute('data-orchid-slot'));
        }
        if (!Number.isNaN(target)) {
          r.endSlot = Math.max(r.startSlot, Math.min(SLOT_COUNT - 1, target));
          bump((n) => n + 1);
        }
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        const r = resizeRef.current;
        resizeRef.current = null;
        bump((n) => n + 1);
        if (!r) return;
        const sus = Math.max(1, r.endSlot - r.startSlot + 1);
        onHitsChange(
          hits.map((h) =>
            h.slot === r.startSlot && h.midiOffset === r.midiOffset
              ? { ...h, sustainSlots: clampSus(r.startSlot, sus) }
              : h,
          ),
        );
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [hits, onHitsChange],
  );

  const addNoteAt = useCallback(
    (slot: number, offset: number) => {
      const existing = hits.find((h) => h.slot === slot && h.midiOffset === offset);
      if (tool === 'erase' || existing) {
        onHitsChange(hits.filter((h) => !(h.slot === slot && h.midiOffset === offset)));
        return;
      }
      onHitsChange([
        ...hits,
        { slot, midiOffset: offset, sustainSlots: clampSus(slot, noteLengthSlots), vel: 0.88 },
      ]);
    },
    [tool, hits, onHitsChange, noteLengthSlots],
  );

  const drag = dragRef.current;
  const rz = resizeRef.current;

  const openNotesButton = (
    <button
      type="button"
      onClick={() => onExpandedChange(true)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'linear-gradient(135deg, #0d2818, #0a1a30)',
        color: '#fde68a',
        border: '2px solid #22c55e',
        borderRadius: 8,
        padding: '8px 14px',
        fontSize: 10,
        fontWeight: 900,
        cursor: 'pointer',
        boxShadow: '0 0 12px rgba(34,197,94,0.28)',
      }}
    >
      <Music2 size={14} />
      OPEN NOTES
    </button>
  );

  if (!expanded) {
    return (
      <div
        style={{
          padding: sidePanel ? '8px 10px' : '8px 10px 10px',
          borderTop: sidePanel ? 'none' : '1px solid #1a2438',
          background: '#06080f',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <Piano size={13} style={{ color: '#fde68a' }} />
          <span style={{ fontSize: 9, fontWeight: 900, color: '#fde68a' }}>NOTES · {channelLabel}</span>
          <span style={{ fontSize: 8, color: '#6b7280' }}>{hits.length} note{hits.length === 1 ? '' : 's'}</span>
          <div style={{ marginLeft: 'auto' }}>{openNotesButton}</div>
        </div>
        <p style={{ margin: 0, fontSize: 8, color: '#4b5563', lineHeight: 1.35 }}>
          Drag mint blocks · resize gold edge · bass keypad paints here
        </p>
      </div>
    );
  }

  const toolbar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 6, flexShrink: 0 }}>
      <button type="button" onClick={() => setTool('paint')} style={toolBtn(tool === 'paint', '#67e8f9', '#0e2838')}>
        <Pencil size={10} /> DRAW
      </button>
      <button type="button" onClick={() => setTool('erase')} style={toolBtn(tool === 'erase', '#fb923c', '#2a1411')}>
        <Eraser size={10} /> ERASE
      </button>
      <select
        value={noteLengthSlots}
        onChange={(e) => onNoteLengthChange(Number(e.target.value))}
        style={{
          background: '#0a0e16',
          color: '#86efac',
          border: '1px solid #1a3a29',
          borderRadius: 4,
          padding: '2px 4px',
          fontSize: 8,
          fontWeight: 800,
        }}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <button type="button" onClick={onPreviewStep} style={actionBtn('#112015', '#86efac', '#1f3a29')}>▶</button>
      <button type="button" onClick={onClearStep} style={actionBtn('#111', '#f87171', '#3a1f1f')}>CLR</button>
      <button
        type="button"
        onClick={() => onExpandedChange(false)}
        style={{ ...actionBtn('#052e2e', '#5eead4', '#14b8a6'), marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <Minimize2 size={11} /> DOCK
      </button>
    </div>
  );

  const header = (
    <div style={{ flexShrink: 0, marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, fontWeight: 900, color: '#fde68a' }}>PIANO ROLL</span>
        <span style={{ fontSize: 8, color: '#67e8f9', fontWeight: 800 }}>{channelLabel}</span>
        <span style={{ fontSize: 8, color: '#9ca3af' }}>{chordLabel}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <button type="button" onClick={() => onStepChange(Math.max(0, stepIndex - 1))} disabled={stepIndex <= 0} style={navBtn(stepIndex <= 0)}>◀</button>
          <span style={{ fontSize: 9, fontWeight: 900, color: '#e0e7ff' }}>{stepIndex + 1}/{stepCount}</span>
          <button type="button" onClick={() => onStepChange(Math.min(stepCount - 1, stepIndex + 1))} disabled={stepIndex >= stepCount - 1} style={navBtn(stepIndex >= stepCount - 1)}>▶</button>
        </div>
      </div>
      {toolbar}
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: '#06080f',
        padding: sidePanel ? '8px 8px 8px 4px' : '8px 10px',
        borderLeft: sidePanel ? '1px solid #1a2438' : undefined,
      }}
    >
      {header}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          border: `1px solid ${CB_PIANO_MINT_BORDER}`,
          borderRadius: 6,
          background: '#030508',
        }}
      >
        {/* Ruler */}
        <div style={{ display: 'flex', height: RULER_H, position: 'sticky', top: 0, zIndex: 4, background: '#0a1018', borderBottom: `1px solid ${CB_PIANO_MINT_BORDER}` }}>
          <div style={{ width: LABEL_W, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex' }}>
            {Array.from({ length: SLOT_COUNT }, (_, s) => (
              <div
                key={`r-${s}`}
                style={{
                  flex: 1,
                  fontSize: 7,
                  color: '#67e8f9',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderLeft: '1px solid #111',
                }}
              >
                {s + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Linked chord ghosts */}
        {linkedChordsActive && chordGhost.length > 0 && (
          <>
            <div style={{ padding: '4px 8px', fontSize: 7, fontWeight: 900, color: '#86efac', background: '#050a08', borderBottom: '1px solid #1a2e22' }}>
              LINKED · {orchidMatchLabel}
            </div>
            {chordGhostRows.map((row) => (
              <div key={`ch-row-${row.offset}`} style={{ display: 'flex', height: ROW_H - 2, position: 'relative' }}>
                <div
                  style={{
                    width: LABEL_W,
                    flexShrink: 0,
                    fontSize: 7,
                    color: '#86efac',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: 4,
                    background: '#070a10',
                    borderRight: `1px solid ${CB_PIANO_MINT_BORDER}`,
                  }}
                >
                  {row.label}
                </div>
                <div style={{ flex: 1, position: 'relative', height: '100%' }}>
                  {row.notes.map((g, gi) => (
                    <div
                      key={`g-${g.midi}-${gi}`}
                      style={{
                        position: 'absolute',
                        top: 1,
                        bottom: 1,
                        left: `${g.slot * colPct}%`,
                        width: `${colPct}%`,
                        background: 'rgba(134,239,172,0.45)',
                        border: '1px dashed #22c55e',
                        borderRadius: 2,
                        pointerEvents: 'none',
                        zIndex: 1,
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div style={{ height: 1, background: '#1a2438' }} />
          </>
        )}

        {/* Bass rows — draggable mint notes */}
        <div style={{ fontSize: 7, fontWeight: 900, color: '#67e8f9', padding: '3px 8px', background: '#070a10' }}>BASS · drag notes</div>
        {ROW_OFFSETS.map((offset) => {
          const isRoot = offset === 0;
          const noteName = cbPianoMidiToNoteName(bassRootMidi + offset);
          const rowHits = hits.filter((h) => h.midiOffset === offset);
          return (
            <div key={`b-${offset}`} style={{ display: 'flex', height: ROW_H, position: 'relative' }}>
              <div
                style={{
                  width: LABEL_W,
                  flexShrink: 0,
                  fontSize: 7,
                  fontWeight: isRoot ? 900 : 700,
                  color: isRoot ? '#fde68a' : '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: 4,
                  background: isRoot ? 'rgba(253,230,138,0.06)' : '#070a10',
                  borderRight: `1px solid ${CB_PIANO_MINT_BORDER}`,
                  borderTop: '1px solid #0d1117',
                }}
              >
                {noteName}
              </div>
              <div style={{ flex: 1, position: 'relative', display: 'flex', borderTop: '1px solid #0d1117' }}>
                {Array.from({ length: SLOT_COUNT }, (_, slot) => (
                  <div
                    key={`c-${offset}-${slot}`}
                    data-orchid-slot={slot}
                    data-orchid-offset={offset}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      if (tool === 'erase') return;
                      const blocked = rowHits.some(
                        (h) => slot >= h.slot && slot < h.slot + h.sustainSlots,
                      );
                      if (!blocked) addNoteAt(slot, offset);
                    }}
                    style={{
                      flex: 1,
                      borderLeft: '1px solid #0a0a0a',
                      cursor: tool === 'erase' ? 'default' : 'crosshair',
                      background: isRoot ? 'rgba(253,230,138,0.03)' : undefined,
                      boxSizing: 'border-box',
                    }}
                  />
                ))}
                {rowHits.map((note) => {
                  const isDrag =
                    drag?.origSlot === note.slot && drag.origOffset === note.midiOffset;
                  const isRz =
                    rz?.startSlot === note.slot && rz.midiOffset === note.midiOffset;
                  if (isRz) return null;
                  const slot = isDrag ? drag!.curSlot : note.slot;
                  const off = isDrag ? drag!.curOffset : note.midiOffset;
                  const sus = isDrag ? drag!.sustainSlots : note.sustainSlots;
                  return (
                    <div
                      key={hitId(note)}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        if (tool === 'erase') {
                          deleteNote(note);
                          return;
                        }
                        beginDrag(note, e.clientX, e.clientY);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteNote(note);
                      }}
                      title={`${cbPianoMidiToNoteName(bassRootMidi + off)} · drag to move · gold edge = length`}
                      style={{
                        position: 'absolute',
                        top: 1,
                        bottom: 1,
                        left: `${slot * colPct}%`,
                        width: `${sus * colPct}%`,
                        background: tool === 'erase' ? '#fca5a5' : CB_PIANO_MINT,
                        border: `2px solid ${tool === 'erase' ? '#dc2626' : '#16a34a'}`,
                        borderRadius: 3,
                        boxShadow: 'inset 4px 0 0 #14532d',
                        cursor: tool === 'erase' ? 'not-allowed' : 'grab',
                        opacity: isDrag ? 0.45 : 1,
                        zIndex: 3,
                        display: 'flex',
                        alignItems: 'stretch',
                        justifyContent: 'flex-end',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          e.stopPropagation();
                          if (tool === 'erase') {
                            deleteNote(note);
                            return;
                          }
                          beginResize(note);
                        }}
                        style={{
                          width: 6,
                          minWidth: 6,
                          cursor: 'ew-resize',
                          background: '#fde68a',
                          borderRadius: '0 2px 2px 0',
                          flexShrink: 0,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ margin: '6px 0 0', fontSize: 7, color: '#4b5563', lineHeight: 1.3, flexShrink: 0 }}>
        CH{CHORD_BASS_SEQ_CHANNEL_BASE}+ step {stepIndex + 1} · drag mint notes · keypad writes when roll ON
      </p>
    </div>
  );
}

function toolBtn(on: boolean, color: string, bg: string): CSSProperties {
  return {
    background: on ? bg : '#111',
    color: on ? color : '#6b7280',
    border: `1px solid ${on ? color + '66' : '#222'}`,
    borderRadius: 5,
    padding: '3px 7px',
    fontSize: 8,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  };
}

function actionBtn(bg: string, color: string, border: string): CSSProperties {
  return {
    background: bg,
    color,
    border: `1px solid ${border}`,
    borderRadius: 5,
    padding: '3px 8px',
    fontSize: 8,
    fontWeight: 900,
    cursor: 'pointer',
  };
}

function navBtn(disabled: boolean): CSSProperties {
  return {
    background: '#111',
    color: disabled ? '#444' : '#93c5fd',
    border: '1px solid #1a2e3a',
    borderRadius: 4,
    padding: '2px 6px',
    fontSize: 8,
    fontWeight: 900,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
