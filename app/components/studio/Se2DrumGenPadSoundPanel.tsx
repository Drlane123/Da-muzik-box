'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, RotateCcw, Search, Upload, Volume2 } from 'lucide-react';

import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';
import {
  se2DrumPadDefaultBrowseItems,
  se2DrumPadDisplayLabel,
  se2DrumPadProducerBrowseItems,
  type Se2DrumPadOverride,
  type Se2DrumPadOverrides,
  type Se2DrumPadSoundBrowseItem,
} from '@/app/lib/studio/se2DrumPadOverrides';
import { fileToStoredPadSample } from '@/app/lib/padSampleStorage';
import { getSoundsList } from '@/app/lib/soundLibrary';

const ACCENT = '#ffb84d';
const MENU_BG = '#1a1a24';
const MENU_BORDER = '#3a3a4c';

/** Match Pick lane / Drum pat strip triggers. */
export const PAD_CELL_W_PX = 118;
const PAD_CELL_FONT_PX = 11;
const PAD_CELL_PAD = '4px 8px';

const PICKER_W_PX = 280;
const PICKER_MAX_H_PX = 320;

function anchoredMenuStyleForButton(btn: HTMLElement, menuW = PICKER_W_PX, maxHPx = PICKER_MAX_H_PX): CSSProperties {
  const r = btn.getBoundingClientRect();
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  let left = r.left;
  if (left + menuW > vw - 8) left = Math.max(8, vw - menuW - 8);
  const spaceBelow = vh - r.bottom - 8;
  const spaceAbove = r.top - 8;
  const useBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
  const maxH = Math.min(maxHPx, Math.max(140, useBelow ? spaceBelow : spaceAbove));
  return {
    position: 'fixed',
    left,
    width: menuW,
    maxHeight: maxH,
    zIndex: 30100,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    ...(useBelow ? { top: r.bottom + 2 } : { bottom: vh - r.top + 2 }),
  };
}

export type Se2DrumGenPadSoundPanelProps = {
  kitId?: BeatLabProducerKitId;
  overrides?: Se2DrumPadOverrides;
  disabled?: boolean;
  sideSlot?: ReactNode;
  onSetPadOverride: (padIndex: number, override: Se2DrumPadOverride | null) => void;
  onResetAllPads: () => void;
  /** Audition a list candidate — does not load onto the pad. */
  onAuditionOverride: (override: Se2DrumPadOverride) => void;
  /** Preview the sound currently assigned to this pad. */
  onPreviewAssignedPad: (padIndex: number) => void;
};

export function Se2DrumGenPadSoundPanel({
  kitId,
  overrides,
  disabled = false,
  sideSlot,
  onSetPadOverride,
  onResetAllPads,
  onAuditionOverride,
  onPreviewAssignedPad,
}: Se2DrumGenPadSoundPanelProps) {
  const [pickerPad, setPickerPad] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [auditioningId, setAuditioningId] = useState<string | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [libraryRev, setLibraryRev] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const padBtnRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const allProducerItems = useMemo(() => se2DrumPadProducerBrowseItems(), []);

  const browsePool = useMemo(() => {
    void libraryRev;
    const sounds = getSoundsList();
    if (pickerPad == null) return [];
    const q = query.trim().toLowerCase();
    if (q) {
      const merged = [...se2DrumPadDefaultBrowseItems({ kitId, padIndex: pickerPad, sounds }), ...allProducerItems];
      const seen = new Set<string>();
      const out: Se2DrumPadSoundBrowseItem[] = [];
      for (const it of merged) {
        if (seen.has(it.id)) continue;
        if (!it.label.toLowerCase().includes(q) && !it.group.toLowerCase().includes(q)) continue;
        seen.add(it.id);
        out.push(it);
      }
      return out;
    }
    return se2DrumPadDefaultBrowseItems({ kitId, padIndex: pickerPad, sounds });
  }, [allProducerItems, kitId, libraryRev, pickerPad, query]);

  const groupedItems = useMemo(() => {
    const order = ['This kit', 'Beat Lab pads', 'Sound library', 'More kits'];
    const map = new Map<string, Se2DrumPadSoundBrowseItem[]>();
    for (const it of browsePool) {
      const list = map.get(it.group) ?? [];
      list.push(it);
      map.set(it.group, list);
    }
    const groups = [...map.entries()];
    groups.sort((a, b) => {
      const ia = order.indexOf(a[0]);
      const ib = order.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return groups;
  }, [browsePool]);

  const closePicker = useCallback(() => {
    setPickerPad(null);
    setQuery('');
    setAuditioningId(null);
  }, []);

  const openPickerForPad = useCallback(
    (padIndex: number, e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (disabled) return;
      setLibraryRev((n) => n + 1);
      if (pickerPad === padIndex) {
        closePicker();
        return;
      }
      if (typeof window !== 'undefined') {
        const btn = e.currentTarget;
        setMenuStyle(anchoredMenuStyleForButton(btn));
        padBtnRefs.current.set(padIndex, btn);
      }
      setPickerPad(padIndex);
      setQuery('');
      setAuditioningId(null);
    },
    [closePicker, disabled, pickerPad],
  );

  useEffect(() => {
    if (pickerPad == null) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (menuRef.current?.contains(t)) return;
      for (const btn of padBtnRefs.current.values()) {
        if (btn.contains(t)) return;
      }
      closePicker();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePicker();
    };
    const tid = window.setTimeout(() => {
      document.addEventListener('mousedown', handler, true);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      window.clearTimeout(tid);
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [closePicker, pickerPad]);

  const pickSound = useCallback(
    (override: Se2DrumPadOverride) => {
      if (pickerPad == null) return;
      onSetPadOverride(pickerPad, override);
      closePicker();
    },
    [closePicker, onSetPadOverride, pickerPad],
  );

  const auditionSound = useCallback(
    (it: Se2DrumPadSoundBrowseItem, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (disabled) return;
      setAuditioningId(it.id);
      onAuditionOverride(it.override);
    },
    [disabled, onAuditionOverride],
  );

  const onUploadFile = useCallback(
    async (file: File) => {
      if (pickerPad == null || disabled) return;
      setUploading(true);
      try {
        const sample = await fileToStoredPadSample(file);
        onSetPadOverride(pickerPad, { kind: 'sample', sample });
        closePicker();
      } finally {
        setUploading(false);
      }
    },
    [closePicker, disabled, onSetPadOverride, pickerPad],
  );

  const hasOverrides = Boolean(overrides && Object.keys(overrides).length > 0);

  const pickerEl =
    pickerPad != null && typeof document !== 'undefined' ? (
      <div
        ref={menuRef}
        role="listbox"
        aria-label={`Sounds for pad ${pickerPad + 1}`}
        className="rounded border shadow-2xl flex flex-col"
        style={{
          ...menuStyle,
          borderColor: MENU_BORDER,
          background: MENU_BG,
          boxShadow: '0 12px 40px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between gap-1 px-2 py-1.5 border-b shrink-0"
          style={{ borderColor: '#2e2e3a' }}
        >
          <span className="truncate text-[10px] font-black uppercase" style={{ color: ACCENT }}>
            Pad {pickerPad + 1} · audition then Use
          </span>
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[7px] font-bold uppercase disabled:opacity-45"
            style={{ borderColor: '#3a4860', color: '#9ab0c8' }}
          >
            <Upload size={8} />
            Upload
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void onUploadFile(f);
            }}
          />
        </div>

        <div className="px-2 py-1 shrink-0">
          <label
            className="flex items-center gap-1 rounded border px-2 py-0.5"
            style={{ borderColor: '#333', background: '#12121a' }}
          >
            <Search size={9} style={{ color: '#6a6a78', flexShrink: 0 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all kits…"
              className="w-full min-w-0 bg-transparent text-[10px] font-semibold outline-none text-[#f0f0f8] placeholder:text-[#5a5a68]"
              autoFocus
            />
          </label>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-1"
          style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
        >
          {!kitId ? (
            <div className="py-4 px-1 text-[9px] font-semibold text-[#8a8ab0] leading-snug text-center">
              Generate or load a pattern first — then pad sounds appear here.
            </div>
          ) : groupedItems.length === 0 ? (
            <div className="py-4 px-1 text-[9px] font-semibold text-[#8a8ab0] leading-snug text-center">
              No sounds yet — upload a WAV, load pads in Beat Lab, or add files in Sound Library.
            </div>
          ) : (
            groupedItems.map(([group, items]) => (
              <div key={group} className="mb-1">
                <div
                  className="sticky top-0 py-0.5 text-[7px] font-black uppercase tracking-widest"
                  style={{ background: MENU_BG, color: '#9a9ab0', zIndex: 1 }}
                >
                  {group}
                </div>
                {items.map((it) => {
                  const auditioning = auditioningId === it.id;
                  return (
                    <div
                      key={it.id}
                      className="flex items-center gap-0.5 mb-0.5 rounded border"
                      style={{
                        borderColor: auditioning ? `${ACCENT}66` : '#2e2e38',
                        background: auditioning ? `${ACCENT}10` : 'transparent',
                      }}
                    >
                      <button
                        type="button"
                        disabled={disabled}
                        title="Audition (does not load)"
                        aria-label={`Audition ${it.label}`}
                        onClick={(e) => auditionSound(it, e)}
                        className="shrink-0 flex items-center justify-center rounded-l border-r outline-none transition-colors hover:bg-[#2a2a38] disabled:opacity-45"
                        style={{
                          width: 26,
                          height: 26,
                          borderColor: '#2e2e38',
                          color: auditioning ? ACCENT : '#9a9ab0',
                        }}
                      >
                        <Volume2 size={11} />
                      </button>
                      <span
                        className="flex-1 min-w-0 truncate px-1 text-[10px] font-semibold"
                        style={{ color: '#d8d8e8' }}
                        title={it.label}
                      >
                        {it.label}
                      </span>
                      <button
                        type="button"
                        disabled={disabled}
                        title="Load onto this pad"
                        onClick={() => pickSound(it.override)}
                        className="shrink-0 rounded-r border-l px-2 py-1 text-[7px] font-black uppercase outline-none transition-colors hover:bg-[#2a2830] disabled:opacity-45"
                        style={{ borderColor: '#2e2e38', color: ACCENT }}
                      >
                        Use
                      </button>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          className="flex items-center justify-between gap-2 px-2 py-1.5 border-t shrink-0"
          style={{ borderColor: '#2e2e3a' }}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (pickerPad == null) return;
              onSetPadOverride(pickerPad, null);
              closePicker();
            }}
            className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[7px] font-bold uppercase disabled:opacity-45"
            style={{ borderColor: '#4a3030', color: '#c89090' }}
          >
            <RotateCcw size={8} />
            Kit default
          </button>
          <span className="text-[7px] font-semibold text-[#6a6a78]">▶ hear · Use loads</span>
        </div>
      </div>
    ) : null;

  return (
    <>
      <div className="flex flex-row flex-wrap gap-2 items-start w-full min-w-0">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-black uppercase tracking-wide shrink-0" style={{ color: ACCENT }}>
              Pad sounds
            </span>
            {hasOverrides ? (
              <button
                type="button"
                disabled={disabled}
                onClick={onResetAllPads}
                className="text-[7px] font-bold uppercase tracking-wide disabled:opacity-45 shrink-0"
                style={{ color: '#9a8070' }}
              >
                Reset all
              </button>
            ) : null}
          </div>
          <div className="overflow-x-auto min-w-0 pb-0.5">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(4, ${PAD_CELL_W_PX}px)`,
                width: 'max-content',
              }}
            >
              {Array.from({ length: 16 }, (_, padIndex) => {
                const custom = Boolean(overrides?.[padIndex]);
                const label = se2DrumPadDisplayLabel(padIndex, kitId, overrides);
                const short = label.length > 11 ? `${label.slice(0, 10)}…` : label;
                const open = pickerPad === padIndex;
                return (
                  <button
                    key={padIndex}
                    ref={(el) => {
                      if (el) padBtnRefs.current.set(padIndex, el);
                      else padBtnRefs.current.delete(padIndex);
                    }}
                    type="button"
                    disabled={disabled}
                    title={`Pad ${padIndex + 1}: ${label}${custom ? ' (custom)' : ''} — right-click preview loaded`}
                    onClick={(e) => openPickerForPad(padIndex, e)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onPreviewAssignedPad(padIndex);
                    }}
                    className="inline-flex shrink-0 items-center justify-between gap-0.5 rounded border text-left outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#1e1810]"
                    style={{
                      width: PAD_CELL_W_PX,
                      padding: PAD_CELL_PAD,
                      borderColor: open ? `${ACCENT}88` : custom ? `${ACCENT}88` : '#3a4860',
                      background: open ? `${ACCENT}22` : custom ? `${ACCENT}14` : '#12121a',
                      color: '#f0f0f8',
                      fontSize: PAD_CELL_FONT_PX,
                      fontWeight: 700,
                      lineHeight: 1.2,
                    }}
                  >
                    <span className="truncate min-w-0 flex-1">
                      <span style={{ color: custom || open ? ACCENT : '#8a9aae' }}>{padIndex + 1} </span>
                      {short}
                    </span>
                    <ChevronDown size={10} style={{ color: '#9a9ab0', flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {sideSlot ? (
          <div
            className="flex flex-col gap-1 shrink-0 min-w-0"
            style={{ marginLeft: 48 }}
          >
            {sideSlot}
          </div>
        ) : null}
      </div>
      {pickerEl ? createPortal(pickerEl, document.body) : null}
    </>
  );
}
