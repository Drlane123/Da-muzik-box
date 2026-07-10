'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Save, Trash2 } from 'lucide-react';

import { MasteringBayMiniWaveStrip, type MasteringBaySourcePreview } from '@/app/components/masteringBay/MasteringBayMiniWaveStrip';
import { MasteringBayTransportControls } from '@/app/components/masteringBay/MasteringBayTransportControls';
import { ProcessVisual } from '@/app/components/masteringBay/ProcessVisual';
import { RackKnob } from '@/app/components/masteringBay/RackKnob';
import type { MasteringBayTransport } from '@/app/hooks/useMasteringBayEngine';
import type {
  DeNoiseState,
  MasteringBayPreset,
  MasteringBayRackState,
} from '@/app/lib/masteringBay/masteringBayPresets';
import {
  deleteUserMasteringPreset,
  getAllMasteringPresets,
  saveUserPresetFromState,
} from '@/app/lib/masteringBay/masteringBayPresets';
import {
  IDLE_PROCESS_LIVE,
  type ProcessLiveFeed,
} from '@/app/lib/masteringBay/masteringBayProcessLive';

type Props = {
  activePresetId: string;
  rackState: MasteringBayRackState;
  onSelectPreset: (preset: MasteringBayPreset) => void;
  onPresetsChange?: () => void;
  transport?: MasteringBayTransport;
  sourcePreview?: MasteringBaySourcePreview | null;
  onSeek?: (sec: number) => void;
  onDeNoiseChange?: (patch: Partial<DeNoiseState>) => void;
  processLive?: ProcessLiveFeed;
  onSaveNewMaster?: () => void;
};

export function MasteringBayPresetBar({
  activePresetId,
  rackState,
  onSelectPreset,
  onPresetsChange,
  transport,
  sourcePreview = null,
  onSeek,
  onDeNoiseChange,
  processLive = IDLE_PROCESS_LIVE,
  onSaveNewMaster,
}: Props) {
  const [presetList, setPresetList] = useState(() => getAllMasteringPresets());
  const [menuOpen, setMenuOpen] = useState(false);
  const [deNoiseOpen, setDeNoiseOpen] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [saveNameDraft, setSaveNameDraft] = useState('');
  const [saveNameError, setSaveNameError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const deNoiseRef = useRef<HTMLDivElement>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const saveNameInputRef = useRef<HTMLInputElement>(null);
  const deNoise = rackState.deNoise;

  const refresh = useCallback(() => {
    setPresetList(getAllMasteringPresets());
    onPresetsChange?.();
  }, [onPresetsChange]);

  const activeIndex = Math.max(0, presetList.findIndex((p) => p.id === activePresetId));
  const active = presetList[activeIndex] ?? presetList[0];

  const cycle = useCallback(
    (dir: -1 | 1) => {
      if (presetList.length === 0) return;
      const next = (activeIndex + dir + presetList.length) % presetList.length;
      onSelectPreset(presetList[next]);
    },
    [activeIndex, onSelectPreset, presetList],
  );

  const openSaveMenu = useCallback(() => {
    setMenuOpen(false);
    setDeNoiseOpen(false);
    setSaveNameDraft('');
    setSaveNameError(null);
    setSaveMenuOpen(true);
  }, []);

  const closeSaveMenu = useCallback(() => {
    setSaveMenuOpen(false);
    setSaveNameDraft('');
    setSaveNameError(null);
  }, []);

  const confirmSavePreset = useCallback(() => {
    const name = saveNameDraft.trim();
    if (!name) {
      setSaveNameError('Rename your preset before saving.');
      saveNameInputRef.current?.focus();
      return;
    }
    const saved = saveUserPresetFromState(name, rackState);
    refresh();
    onSelectPreset(saved);
    closeSaveMenu();
  }, [closeSaveMenu, onSelectPreset, rackState, refresh, saveNameDraft]);

  const handleRemove = useCallback(() => {
    if (!active?.userOwned) return;
    const ok = window.confirm(
      `Are you sure you want to remove “${active.name}”?\n\nThis cannot be undone.`,
    );
    if (!ok) return;
    if (!deleteUserMasteringPreset(active.id)) return;
    const nextList = getAllMasteringPresets();
    setPresetList(nextList);
    onPresetsChange?.();
    const fallback = nextList[0];
    if (fallback) onSelectPreset(fallback);
  }, [active, onPresetsChange, onSelectPreset]);

  useEffect(() => {
    if (!menuOpen && !deNoiseOpen && !saveMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuOpen && !menuRef.current?.contains(t)) setMenuOpen(false);
      if (deNoiseOpen && !deNoiseRef.current?.contains(t)) setDeNoiseOpen(false);
      if (saveMenuOpen && !saveMenuRef.current?.contains(t)) closeSaveMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setDeNoiseOpen(false);
        closeSaveMenu();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [closeSaveMenu, deNoiseOpen, menuOpen, saveMenuOpen]);

  useEffect(() => {
    if (!saveMenuOpen) return;
    const t = window.setTimeout(() => saveNameInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [saveMenuOpen]);

  if (!active) return null;

  const hasSource = sourcePreview != null;
  const deNoiseOn = deNoise.power;

  return (
    <div className="mb-preset-bar">
      {transport && (
        <div className="mb-preset-bar__deck">
          <MasteringBayMiniWaveStrip
            preview={sourcePreview}
            playheadSec={transport.playheadSec}
            onSeek={onSeek}
          />
          <MasteringBayTransportControls transport={transport} hasSource={hasSource} compact />
        </div>
      )}

      <div className="mb-preset-bar__denoise" ref={deNoiseRef}>
        <button
          type="button"
          className={`mb-preset-bar__denoise-btn${deNoiseOpen ? ' is-open' : ''}${deNoiseOn ? ' is-on' : ''}`}
          onClick={() => {
            setDeNoiseOpen((v) => !v);
            setMenuOpen(false);
          }}
          aria-haspopup="dialog"
          aria-expanded={deNoiseOpen}
          title="De-Noise settings"
        >
          De-Noise
          <ChevronDown size={12} aria-hidden />
        </button>

        {deNoiseOpen && (
          <div className="mb-preset-bar__denoise-panel" role="dialog" aria-label="De-Noise">
            <div className="mb-preset-bar__denoise-vis">
              <ProcessVisual
                kind="denoise"
                powered={deNoiseOn}
                live={processLive}
                params={{
                  hissAmount: deNoise.hissAmount,
                  hissFreq: deNoise.hissFreq,
                  clickAmount: deNoise.clickAmount,
                  clickThresh: deNoise.clickThresh,
                }}
              />
            </div>

            <div className="mb-preset-bar__denoise-place" role="group" aria-label="De-Noise placement">
              <button
                type="button"
                className={deNoise.placement === 'before' ? 'is-active' : ''}
                onClick={() => onDeNoiseChange?.({ placement: 'before' })}
              >
                Before Master
              </button>
              <button
                type="button"
                className={deNoise.placement === 'after' ? 'is-active' : ''}
                onClick={() => onDeNoiseChange?.({ placement: 'after' })}
              >
                After Master
              </button>
            </div>

            <div className="mb-preset-bar__denoise-knobs">
              <div className="mb-preset-bar__denoise-row">
                <RackKnob
                  label="HISS"
                  size="sm"
                  accent="green"
                  ledRing
                  min={0}
                  max={100}
                  step={1}
                  value={deNoise.hissAmount}
                  readout={`${deNoise.hissAmount.toFixed(0)}%`}
                  onChange={(hissAmount) => onDeNoiseChange?.({ hissAmount })}
                />
                <RackKnob
                  label="FREQ"
                  size="sm"
                  accent="green"
                  ledRing
                  min={4000}
                  max={14000}
                  step={100}
                  value={deNoise.hissFreq}
                  readout={`${(deNoise.hissFreq / 1000).toFixed(1)}k`}
                  onChange={(hissFreq) => onDeNoiseChange?.({ hissFreq })}
                />
              </div>
              <div className="mb-preset-bar__denoise-row">
                <RackKnob
                  label="CLICK"
                  size="sm"
                  accent="green"
                  ledRing
                  min={0}
                  max={100}
                  step={1}
                  value={deNoise.clickAmount}
                  readout={`${deNoise.clickAmount.toFixed(0)}%`}
                  onChange={(clickAmount) => onDeNoiseChange?.({ clickAmount })}
                />
                <RackKnob
                  label="THR"
                  size="sm"
                  accent="green"
                  ledRing
                  min={-30}
                  max={-6}
                  step={0.5}
                  value={deNoise.clickThresh}
                  readout={`${deNoise.clickThresh.toFixed(1)}`}
                  onChange={(clickThresh) => onDeNoiseChange?.({ clickThresh })}
                />
              </div>
            </div>

            <button
              type="button"
              className={`mb-preset-bar__denoise-power${deNoiseOn ? ' is-on' : ''}`}
              onClick={() => onDeNoiseChange?.({ power: !deNoise.power })}
            >
              {deNoiseOn ? 'ON' : 'OFF'}
            </button>
          </div>
        )}
      </div>

      <div className="mb-preset-bar__carousel">
        <button type="button" onClick={() => cycle(-1)} aria-label="Previous preset">
          <ChevronLeft size={16} />
        </button>

        <div className="mb-preset-bar__picker" ref={menuRef}>
          <button
            type="button"
            className={`mb-preset-bar__label mb-preset-bar__label--btn${menuOpen ? ' is-open' : ''}`}
            onClick={() => {
              setMenuOpen((v) => !v);
              setDeNoiseOpen(false);
            }}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            title="Choose master preset"
          >
            <span className="mb-preset-bar__category">{active.category}</span>
            <strong>{active.name}</strong>
            <span className="mb-preset-bar__tags">{active.tags.join(' · ')}</span>
            <ChevronDown size={14} className="mb-preset-bar__chevron" aria-hidden />
          </button>

          {menuOpen && (
            <div className="mb-preset-bar__menu" role="listbox" aria-label="Master presets">
              {presetList.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={p.id === active.id}
                  className={`mb-preset-bar__menu-item${p.id === active.id ? ' is-active' : ''}`}
                  onClick={() => {
                    onSelectPreset(p);
                    setMenuOpen(false);
                  }}
                >
                  <span className="mb-preset-bar__menu-name">{p.name}</span>
                  <span className="mb-preset-bar__menu-meta">
                    {p.category}
                    {p.tags.length ? ` · ${p.tags.slice(0, 2).join(' · ')}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="button" onClick={() => cycle(1)} aria-label="Next preset">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="mb-preset-bar__actions">
        <div className="mb-preset-bar__save-wrap" ref={saveMenuRef}>
          <button
            type="button"
            className={saveMenuOpen ? 'is-open' : ''}
            onClick={() => {
              if (saveMenuOpen) closeSaveMenu();
              else openSaveMenu();
            }}
            title="Save preset"
            aria-haspopup="dialog"
            aria-expanded={saveMenuOpen}
          >
            <Save size={13} />
            Save
            <ChevronDown size={12} aria-hidden />
          </button>
          {saveMenuOpen && (
            <div
              className="mb-preset-bar__save-menu"
              role="dialog"
              aria-label="Save mastering preset"
            >
              <div className="mb-preset-bar__save-rename">
                <label className="mb-preset-bar__save-rename-label" htmlFor="mb-save-preset-name">
                  Rename
                </label>
                <input
                  id="mb-save-preset-name"
                  ref={saveNameInputRef}
                  type="text"
                  className="mb-preset-bar__save-rename-input"
                  value={saveNameDraft}
                  maxLength={48}
                  placeholder="Name this preset…"
                  onChange={(e) => {
                    setSaveNameDraft(e.target.value);
                    if (saveNameError) setSaveNameError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      confirmSavePreset();
                    }
                  }}
                />
                {saveNameError ? (
                  <p className="mb-preset-bar__save-rename-error" role="alert">
                    {saveNameError}
                  </p>
                ) : (
                  <p className="mb-preset-bar__save-rename-hint">
                    Saves after the factory masters in the preset list.
                  </p>
                )}
                <button
                  type="button"
                  className="mb-preset-bar__save-rename-btn"
                  disabled={!saveNameDraft.trim()}
                  onClick={confirmSavePreset}
                >
                  Save Preset
                </button>
              </div>
              <div className="mb-preset-bar__save-divider" aria-hidden />
              <button
                type="button"
                className="mb-preset-bar__save-export"
                onClick={() => {
                  closeSaveMenu();
                  onSaveNewMaster?.();
                }}
              >
                <strong>Save New Master</strong>
                <span>Export tagged WAV with cover art</span>
              </button>
            </div>
          )}
        </div>
        <button type="button" onClick={openSaveMenu} title="New preset from current settings">
          <Plus size={13} />
          New
        </button>
        {active.userOwned ? (
          <button
            type="button"
            className="mb-preset-bar__remove"
            onClick={handleRemove}
            title="Remove this saved preset"
          >
            <Trash2 size={13} />
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
