import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ensureGrooveLabAudioReady,
  resumeGrooveLabAudioContext,
} from '@/app/lib/creationStation/grooveLabAudio';
import {
  runWithGrooveLabAudio,
  resolveGrooveLabChannelDest,
} from '@/app/lib/creationStation/grooveLabAudio';
import { playGrooveLabGuitarNoteScheduled } from '@/app/lib/creationStation/grooveLabGuitarAudition';
import {
  buildGuitarPackRoll,
  buildGrooveGuitarPackCatalog,
  grooveGuitarPackCategories,
  type GrooveGuitarPackEntry,
  type GrooveGuitarPackRollBuild,
} from '@/app/lib/creationStation/grooveLabGuitarPackLibrary';
import {
  ensureGuitarLickBuffer,
  getGuitarLickDef,
  grooveLabGuitarBarSec,
  isGuitarLickSampleId,
  loadGuitarLickManifest,
  preloadGuitarLickBank,
} from '@/app/lib/creationStation/grooveLabGuitarLickBank';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { GrooveLabGuitarFxSettings } from '@/app/lib/creationStation/grooveLabGuitarFx';
import type { GrooveLabAnyLeadSoundId } from '@/app/lib/creationStation/grooveLabLeadSounds';
import { GROOVE_LAB_BASS_REFERENCE_MIDI, grooveLabClampGuitarMidi } from '@/app/lib/creationStation/grooveLabPitch';
import {
  grooveLabChordBarFirstAttackColumns,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';

const DROPDOWN_MIN_W = 200;
const DROPDOWN_MAX_W = 268;
const DROPDOWN_MAX_H = 200;
const VIEWPORT_PAD = 6;

export type GrooveLabGuitarPackPanelProps = {
  bpm: number;
  quantize: GrooveLabQuantize;
  barCount: number;
  sustainSlots: number;
  chordHits: readonly GrooveRollHit[];
  keyRoot: number;
  mode: ChordMode;
  bassRootMidi?: number;
  guitarChannel: number;
  channelVolumes?: Record<number, number>;
  getAudioContext: () => AudioContext | null;
  onDropToRoll: (built: GrooveGuitarPackRollBuild) => void;
  onPickGuitarLick: (lickId: GrooveLabAnyLeadSoundId) => void;
  onStopAudition: () => void;
  onStatus?: (msg: string | null) => void;
  guitarFx?: GrooveLabGuitarFxSettings;
};

function computeDropdownPosition(anchor: DOMRect): { top: number; left: number; width: number } {
  const gap = 4;
  const width = Math.min(DROPDOWN_MAX_W, Math.max(DROPDOWN_MIN_W, anchor.width));
  let left = anchor.left;
  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - width - VIEWPORT_PAD));
  let top = anchor.bottom + gap;
  if (top + DROPDOWN_MAX_H > window.innerHeight - VIEWPORT_PAD) {
    top = Math.max(VIEWPORT_PAD, anchor.top - gap - DROPDOWN_MAX_H);
  }
  return { top, left, width };
}

const selectStyle: CSSProperties = {
  width: '100%',
  background: '#0a0a0e',
  color: '#e5e7eb',
  border: '1px solid #2a2a32',
  borderRadius: 4,
  padding: '3px 6px',
  fontSize: 10,
  fontWeight: 800,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 8,
  fontWeight: 900,
  color: '#6b7280',
  letterSpacing: 0.3,
};

export function GrooveLabGuitarPackPanel({
  bpm,
  quantize,
  barCount,
  sustainSlots,
  chordHits,
  keyRoot,
  mode,
  bassRootMidi = GROOVE_LAB_BASS_REFERENCE_MIDI,
  guitarChannel,
  channelVolumes,
  getAudioContext,
  onDropToRoll,
  onPickGuitarLick,
  onStopAudition,
  onStatus,
  guitarFx,
}: GrooveLabGuitarPackPanelProps) {
  const [catalogTick, setCatalogTick] = useState(0);
  const catalog = useMemo(() => buildGrooveGuitarPackCatalog(), [catalogTick]);
  const categories = useMemo(() => grooveGuitarPackCategories(catalog), [catalog]);
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('wah');
  const [packId, setPackId] = useState('');
  const [loopOn, setLoopOn] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: DROPDOWN_MIN_W });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const loopTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadGuitarLickManifest();
      if (cancelled) return;
      setCatalogTick((t) => t + 1);
      try {
        const ctx = getAudioContext?.();
        if (ctx) await preloadGuitarLickBank(ctx);
      } catch {
        /* preload optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAudioContext]);

  const categoryPacks = useMemo(
    () => catalog.filter((p) => p.categoryId === categoryId),
    [catalog, categoryId],
  );

  const selected = useMemo(
    () => catalog.find((p) => p.id === packId) ?? categoryPacks[0],
    [catalog, packId, categoryPacks],
  );

  const loopDurationMs = useMemo(() => {
    if (!selected) return 2000;
    const bars = selected.kind === 'bar' ? Math.max(1, barCount) : 1;
    return Math.max(500, grooveLabGuitarBarSec(bpm, bars) * 1000);
  }, [selected, barCount, bpm]);

  const stopGuitarLoop = useCallback(() => {
    if (loopTimerRef.current != null) {
      clearInterval(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    setLoopOn(false);
  }, []);

  useEffect(() => {
    if (!packId && categoryPacks[0]) setPackId(categoryPacks[0].id);
  }, [categoryPacks, packId]);

  useEffect(() => {
    if (categories.length && !categories.some((c) => c.id === categoryId)) {
      setCategoryId(categories[0]!.id);
    }
  }, [categories, categoryId]);

  const pickLick = useCallback(
    (entry: GrooveGuitarPackEntry | undefined) => {
      if (entry && isGuitarLickSampleId(entry.lickId)) {
        onPickGuitarLick(entry.lickId);
      }
    },
    [onPickGuitarLick],
  );

  useEffect(
    () => () => {
      stopGuitarLoop();
    },
    [stopGuitarLoop],
  );

  const repositionPanel = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    setPanelPos(computeDropdownPosition(btn.getBoundingClientRect()));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    repositionPanel();
    window.addEventListener('resize', repositionPanel);
    window.addEventListener('scroll', repositionPanel, true);
    return () => {
      window.removeEventListener('resize', repositionPanel);
      window.removeEventListener('scroll', repositionPanel, true);
    };
  }, [open, repositionPanel]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        btnRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
      stopGuitarLoop();
      onStopAudition();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onStopAudition, stopGuitarLoop]);

  const previewRootMidi = useMemo(() => {
    const cols = grooveLabChordBarFirstAttackColumns(chordHits, {
      keyRoot,
      mode,
      referenceMidi: bassRootMidi,
      quantize,
    });
    if (cols.length === 0) return null;
    return grooveLabClampGuitarMidi(cols[0]!.rootMidi);
  }, [chordHits, keyRoot, mode, bassRootMidi, quantize]);

  const buildRoll = useCallback(
    (entry: GrooveGuitarPackEntry) =>
      buildGuitarPackRoll(entry, {
        keyRoot,
        mode,
        quantize,
        barCount,
        sustainSlots,
        chordHits,
        referenceMidi: bassRootMidi,
      }),
    [keyRoot, mode, quantize, barCount, sustainSlots, chordHits, bassRootMidi],
  );

  const previewLick = useCallback(
    (entry: GrooveGuitarPackEntry) => {
      if (!getAudioContext) {
        onStatus?.('Tap Play or a pad first to unlock audio.');
        return;
      }
      const previewMidi = previewRootMidi ?? grooveLabClampGuitarMidi(entry.rootMidi);
      const bars = entry.kind === 'bar' ? 1 : 0.25;
      const sustainSec = grooveLabGuitarBarSec(bpm, bars);
      try {
        runWithGrooveLabAudio(getAudioContext, (ctx, when) => {
          playGrooveLabGuitarNoteScheduled(ctx, {
            midi: previewMidi,
            soundId: entry.lickId,
            when,
            velocity01: 0.92,
            bpm,
            sustainSec,
            guitarFx,
            guitarChannel,
            channelVolumes,
            route: 'channel',
          });
        });
        const def = getGuitarLickDef(entry.lickId);
        if (def) void ensureGuitarLickBuffer(getAudioContext(), def);
      } catch {
        onStatus?.('Tap Play or a pad first to unlock audio.');
      }
    },
    [bpm, guitarChannel, channelVolumes, getAudioContext, onStatus, guitarFx, previewRootMidi],
  );

  const handleStop = useCallback(() => {
    stopGuitarLoop();
    onStopAudition();
  }, [stopGuitarLoop, onStopAudition]);

  const handlePlayOnce = useCallback(() => {
    if (!selected) {
      onStatus?.('Pick a wah or bar lick first.');
      return;
    }
    stopGuitarLoop();
    void previewLick(selected);
  }, [selected, stopGuitarLoop, previewLick, onStatus]);

  const handleLoop = useCallback(() => {
    if (!selected) return;
    if (loopOn) {
      handleStop();
      return;
    }
    stopGuitarLoop();
    void previewLick(selected);
    setLoopOn(true);
    loopTimerRef.current = setInterval(() => void previewLick(selected), loopDurationMs);
  }, [selected, loopOn, handleStop, stopGuitarLoop, previewLick, loopDurationMs]);

  const handleDrop = useCallback(() => {
    if (!selected) return;
    const built = buildRoll(selected);
    if ('message' in built) {
      onStatus?.(built.message);
      return;
    }
    stopGuitarLoop();
    pickLick(selected);
    onDropToRoll(built);
    const kindLabel = selected.kind === 'bar' ? 'bar licks' : 'one shot';
    onStatus?.(`✓ ${built.guitarHits.length} ${kindLabel} · CH ${guitarChannel}`);
    setOpen(false);
  }, [selected, buildRoll, stopGuitarLoop, pickLick, onDropToRoll, onStatus, guitarChannel]);

  const menu = open ? (
    <div
      ref={panelRef}
      role="menu"
      aria-label="Guitar wah bar licks"
      style={{
        position: 'fixed',
        top: panelPos.top,
        left: panelPos.left,
        width: panelPos.width,
        maxHeight: DROPDOWN_MAX_H,
        overflow: 'auto',
        zIndex: 12000,
        background: '#0c0b08',
        border: '1px solid #3d3428',
        borderRadius: 6,
        padding: 6,
        boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
      }}
    >
      <p style={{ margin: '0 0 6px', fontSize: 7, color: '#78716c', lineHeight: 1.35 }}>
        Wah / bar samples — one trigger at the start of each green chord column (root in G3–A4).
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={fieldLabelStyle}>TYPE</span>
          <select
            value={categoryId}
            onChange={(e) => {
              const cid = e.target.value;
              setCategoryId(cid);
              const first = catalog.find((p) => p.categoryId === cid);
              if (first) {
                setPackId(first.id);
                pickLick(first);
              }
            }}
            style={selectStyle}
          >
            {categories.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={fieldLabelStyle}>LICK</span>
          <select
            value={categoryPacks.some((p) => p.id === packId) ? packId : (categoryPacks[0]?.id ?? '')}
            onChange={(e) => {
              const id = e.target.value;
              setPackId(id);
              pickLick(catalog.find((p) => p.id === id));
            }}
            style={selectStyle}
          >
            {categoryPacks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.kind === 'bar' ? ' · bar' : ' · 1×'}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
        <button
          type="button"
          onPointerDown={() => {
            try {
              const getCtx = getAudioContext;
              if (!getCtx) return;
              void (async () => {
                const ctx = await ensureGrooveLabAudioReady(getCtx);
                if (ctx) void preloadGuitarLickBank(ctx);
              })();
            } catch {
              /* unlock */
            }
          }}
          onClick={handlePlayOnce}
          style={actionBtn('#1a2e1a', '#86efac')}
        >
          ▶ PREVIEW
        </button>
        <button
          type="button"
          onClick={handleLoop}
          style={actionBtn(loopOn ? '#2a2410' : '#1a2530', loopOn ? '#fbbf24' : '#67e8f9')}
        >
          {loopOn ? '■ STOP' : '⟳ LOOP'}
        </button>
        <button
          type="button"
          onPointerDown={() => {
            try {
              const getCtx = getAudioContext;
              if (!getCtx) return;
              void (async () => {
                const ctx = await ensureGrooveLabAudioReady(getCtx);
                if (ctx) void preloadGuitarLickBank(ctx);
              })();
            } catch {
              /* unlock */
            }
          }}
          onClick={handleDrop}
          style={actionBtn('#2a2410', '#fbbf24')}
        >
          ↓ DROP
        </button>
      </div>
    </div>
  ) : null;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (!next) {
              handleStop();
            } else {
              requestAnimationFrame(repositionPanel);
            }
            return next;
          });
        }}
        title="Wah guitar bar licks — sample triggers on the guitar roll"
        style={{
          background: open ? '#2a2410' : '#14120e',
          color: open ? '#fbbf24' : '#9ca3af',
          border: `1px solid ${open ? '#f59e0b88' : '#3d3428'}`,
          borderRadius: 5,
          padding: '3px 10px',
          fontSize: 8,
          fontWeight: 900,
          cursor: 'pointer',
          letterSpacing: 0.3,
        }}
      >
        GUITAR ▾
      </button>
      {typeof document !== 'undefined' && menu ? createPortal(menu, document.body) : null}
    </span>
  );
}

function actionBtn(bg: string, color: string): CSSProperties {
  return {
    background: bg,
    color,
    border: `1px solid ${color}44`,
    borderRadius: 4,
    padding: '3px 8px',
    fontSize: 7,
    fontWeight: 900,
    cursor: 'pointer',
  };
}
