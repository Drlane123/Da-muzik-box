'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode, type CSSProperties } from 'react';
import { ExternalLink, Link2, Lock, Play, RefreshCw, Unlock, X } from 'lucide-react';
import {
  BEAT_PADS_GENO_SLOT_LABELS,
  BEAT_PADS_GENO_SLOT_ORDER,
  BEAT_PADS_GENO_SLOT_SHORT_LABELS,
  beatPadsAutoAssignGenoTracks,
  beatPadsGenoLanesForSlot,
  beatPadsGenoSlotAccent,
  beatPadsGenoSlotLockedKey,
  beatPadsGenoSlotTrackIdKey,
  beatPadsResolveGenoLaneForSlot,
  beatPadsTransportFromBridge,
  dispatchBeatPadsGenoTrigger,
  dispatchBeatPadsOpenSe2,
  loadBeatPadsGenoSyncState,
  loadBeatPadsSe2BridgeSnapshot,
  saveBeatPadsGenoSyncState,
  subscribeBeatPadsSe2Bridge,
  type BeatPadsGenoBuildSlot,
  type BeatPadsGenoSyncState,
  type BeatPadsSe2BridgeSnapshot,
} from '@/app/lib/creationStation/beatPadsSe2Bridge';

const MINT = '#7cf4c6';

const slotBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 26,
  padding: '0 8px',
  borderRadius: 5,
  border: '1px solid rgba(255, 255, 255, 0.14)',
  background: '#12121a',
  color: '#c8d0dc',
  fontSize: 9,
  fontWeight: 800,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

export type BeatPadsGenoSyncBarProps = {
  onApplyTransport?: (opts: { bpm: number; loopBars: number }) => void;
  onHarmonyTrackIdChange?: (trackId: string, slot: BeatPadsGenoBuildSlot) => void;
  /** When true, dims controls (never used for Geno sync — keep independent of pattern lock). */
  disabled?: boolean;
  compact?: boolean;
  /** Poll bridge while Beat Pads is open. */
  pollBridge?: boolean;
  /** SE2 dock — collapse pads machine; sequencer may stay open. */
  onClose?: () => void;
  closeLabel?: string;
  closeTitle?: string;
  /** Rendered after Geno slot triggers (e.g. Sound Families scroll strip). */
  trailing?: ReactNode;
};

export function BeatPadsGenoSyncBar({
  onApplyTransport,
  onHarmonyTrackIdChange,
  disabled = false,
  compact = false,
  pollBridge = true,
  onClose,
  closeLabel,
  closeTitle,
  trailing,
}: BeatPadsGenoSyncBarProps) {
  const [bridge, setBridge] = useState<BeatPadsSe2BridgeSnapshot | null>(() => loadBeatPadsSe2BridgeSnapshot());
  const [sync, setSync] = useState<BeatPadsGenoSyncState>(() => loadBeatPadsGenoSyncState());
  const [flashSlot, setFlashSlot] = useState<BeatPadsGenoBuildSlot | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refreshBridge = useCallback(() => {
    setBridge(loadBeatPadsSe2BridgeSnapshot());
  }, []);

  useEffect(() => subscribeBeatPadsSe2Bridge(setBridge), []);

  useEffect(() => {
    if (!pollBridge) return;
    refreshBridge();
    const id = window.setInterval(refreshBridge, 900);
    return () => window.clearInterval(id);
  }, [pollBridge, refreshBridge]);

  useEffect(() => {
    if (!bridge?.genoLanes.length) return;
    setSync((prev) => {
      const next = beatPadsAutoAssignGenoTracks(bridge, prev);
      if (next.b01TrackId === prev.b01TrackId && next.b02TrackId === prev.b02TrackId) return prev;
      saveBeatPadsGenoSyncState(next);
      return next;
    });
  }, [bridge]);

  useEffect(() => {
    if (!status) return;
    const id = window.setTimeout(() => setStatus(null), 3200);
    return () => window.clearTimeout(id);
  }, [status]);

  const flash = useCallback((slot: BeatPadsGenoBuildSlot) => {
    setFlashSlot(slot);
    window.setTimeout(() => setFlashSlot((cur) => (cur === slot ? null : cur)), 700);
  }, []);

  const persistSync = useCallback((next: BeatPadsGenoSyncState) => {
    setSync(next);
    saveBeatPadsGenoSyncState(next);
  }, []);

  const applySlotSync = useCallback(
    (slot: BeatPadsGenoBuildSlot) => {
      flash(slot);
      const lane = beatPadsResolveGenoLaneForSlot(bridge, sync, slot);
      const transport = beatPadsTransportFromBridge(bridge, lane);
      if (!transport) {
        setStatus('Add Synth Geno in Studio Editor 2 first — then Sync will match BPM + bars.');
        return;
      }
      onApplyTransport?.(transport);
      if (lane) onHarmonyTrackIdChange?.(lane.trackId, slot);
      setStatus(
        `${BEAT_PADS_GENO_SLOT_SHORT_LABELS[slot]} synced · ${transport.bpm} BPM · ${transport.loopBars} bars`,
      );
    },
    [bridge, sync, onApplyTransport, onHarmonyTrackIdChange, flash],
  );

  const toggleLock = useCallback(
    (slot: BeatPadsGenoBuildSlot) => {
      flash(slot);
      const lockKey = beatPadsGenoSlotLockedKey(slot);
      const wasLocked = sync[lockKey];
      const next = { ...sync, [lockKey]: !wasLocked };
      persistSync(next);
      if (!wasLocked) {
        applySlotSync(slot);
        setStatus(`${BEAT_PADS_GENO_SLOT_SHORT_LABELS[slot]} locked to Geno tempo`);
      } else {
        setStatus(`${BEAT_PADS_GENO_SLOT_SHORT_LABELS[slot]} unlock — manual BPM OK`);
      }
    },
    [sync, persistSync, applySlotSync, flash],
  );

  const triggerSlot = useCallback(
    (slot: BeatPadsGenoBuildSlot) => {
      flash(slot);
      const lane = beatPadsResolveGenoLaneForSlot(bridge, sync, slot);
      dispatchBeatPadsGenoTrigger({ slot, trackId: lane?.trackId });
      if (bridge?.se2Active) {
        setStatus(`${BEAT_PADS_GENO_SLOT_SHORT_LABELS[slot]} → opening in SE2`);
      } else if (lane) {
        setStatus(
          `${BEAT_PADS_GENO_SLOT_SHORT_LABELS[slot]} queued — open Studio Editor 2 to fire ${slot === 'ultra' ? 'Geno Ultra' : 'chords'}`,
        );
        dispatchBeatPadsOpenSe2();
      } else {
        setStatus(
          slot === 'ultra'
            ? 'Add Geno Ultra lanes in Studio Editor 2, then Trigger will jump to them.'
            : 'Add Synth Geno lanes in Studio Editor 2, then Trigger will jump to them.',
        );
        dispatchBeatPadsOpenSe2();
      }
    },
    [bridge, sync, flash],
  );

  const genoCount = bridge?.genoLanes.length ?? 0;
  const ultraCount = bridge?.genoLanes.filter((l) => l.kind === 'genoUltraSynth').length ?? 0;
  const se2Hint = bridge?.se2Active
    ? 'Studio Editor 2 live'
    : genoCount > 0
      ? `${genoCount} Geno lane${genoCount === 1 ? '' : 's'}${ultraCount > 0 ? ` · ${ultraCount} Ultra` : ''} ready (cached)`
      : 'No Geno lanes yet';

  const slots = useMemo(
    () =>
      BEAT_PADS_GENO_SLOT_ORDER.map((slot) => {
        const lane = beatPadsResolveGenoLaneForSlot(bridge, sync, slot);
        const locked = sync[beatPadsGenoSlotLockedKey(slot)];
        const accent = beatPadsGenoSlotAccent(slot);
        const trackId = sync[beatPadsGenoSlotTrackIdKey(slot)];
        const lit = flashSlot === slot || locked;
        const laneOptions = beatPadsGenoLanesForSlot(bridge, slot);
        return { slot, lane, locked, accent, trackId, lit, laneOptions };
      }),
    [bridge, sync, flashSlot],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: compact ? '4px 8px' : '6px 10px',
        borderBottom: '1px solid rgba(124, 244, 198, 0.14)',
        background: 'rgba(6, 8, 12, 0.92)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: compact ? 4 : 6 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: '0.12em',
            color: MINT,
            flexShrink: 0,
          }}
        >
          GENO SYNC
        </span>
        <span style={{ fontSize: 9, color: '#6a7280', fontWeight: 600, flexShrink: 0 }}>
          {se2Hint}
        </span>
        {bridge?.se2Active ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 8,
              fontWeight: 800,
              color: MINT,
              letterSpacing: 0.6,
              flexShrink: 0,
            }}
          >
            <Link2 size={10} aria-hidden /> linked
          </span>
        ) : null}
        {genoCount === 0 ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              dispatchBeatPadsOpenSe2();
              setStatus('Opening Studio Editor 2 — add Synth Geno or Geno Ultra, then return to Beat Pads');
            }}
            style={{
              ...slotBtn,
              borderColor: 'rgba(124, 244, 198, 0.45)',
              color: MINT,
              background: 'rgba(124, 244, 198, 0.1)',
              opacity: disabled ? 0.45 : 1,
            }}
          >
            <ExternalLink size={10} aria-hidden /> Open SE2
          </button>
        ) : null}
        {typeof onClose === 'function' ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onClose}
            title={closeTitle ?? 'Close Beat Pads and continue in Studio Editor 2'}
            aria-label={closeLabel ?? 'Close Beat Pads'}
            style={{
              ...slotBtn,
              marginLeft: 'auto',
              height: 28,
              padding: '0 10px',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              color: '#e8eaef',
              background: '#1a1a24',
              opacity: disabled ? 0.45 : 1,
            }}
          >
            <X size={12} aria-hidden /> {closeLabel ?? 'Close'}
          </button>
        ) : null}
        {slots.map(({ slot, lane, locked, accent, trackId, lit, laneOptions }) => (
          <div
            key={slot}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              flexShrink: 0,
              padding: '2px 4px',
              borderRadius: 6,
              border: lit ? `1px solid ${accent}88` : '1px solid transparent',
              background: lit ? `${accent}12` : 'transparent',
              boxShadow: lit ? `0 0 12px ${accent}33` : undefined,
              transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
            }}
          >
            <select
              value={trackId}
              disabled={disabled}
              onChange={(e) => {
                const id = e.target.value;
                const key = beatPadsGenoSlotTrackIdKey(slot);
                const next = { ...sync, [key]: id };
                persistSync(next);
                if (id) onHarmonyTrackIdChange?.(id, slot);
                flash(slot);
              }}
              title={BEAT_PADS_GENO_SLOT_LABELS[slot]}
              style={{
                height: 26,
                maxWidth: compact ? 92 : 128,
                padding: '0 6px',
                borderRadius: 4,
                border: `1px solid ${accent}55`,
                background: '#1e1e26',
                color: lane ? accent : '#9aa3b0',
                fontSize: 9,
                fontWeight: 800,
              }}
            >
              <option value="">{BEAT_PADS_GENO_SLOT_SHORT_LABELS[slot]}</option>
              {laneOptions.map((g) => (
                <option key={g.trackId} value={g.trackId}>
                  T{String(g.laneNumber).padStart(2, '0')} · {g.patchLabel ? `${g.name} (${g.patchLabel})` : g.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={disabled}
              title={`Sync BPM + loop (${BEAT_PADS_GENO_SLOT_LABELS[slot]})`}
              onClick={() => applySlotSync(slot)}
              style={{
                ...slotBtn,
                opacity: disabled ? 0.45 : 1,
                borderColor: flashSlot === slot ? accent : `${accent}55`,
                color: accent,
                background: flashSlot === slot ? `${accent}22` : '#12121a',
              }}
            >
              <RefreshCw size={10} aria-hidden /> Sync
            </button>
            <button
              type="button"
              disabled={disabled}
              title={locked ? 'Unlock Geno sync' : 'Lock BPM + bars to Geno'}
              onClick={() => toggleLock(slot)}
              style={{
                ...slotBtn,
                width: 28,
                padding: 0,
                justifyContent: 'center',
                opacity: disabled ? 0.45 : 1,
                borderColor: locked ? accent : 'rgba(255,255,255,0.14)',
                background: locked ? `${accent}28` : '#12121a',
                color: locked ? accent : '#9aa3b0',
                boxShadow: locked ? `0 0 8px ${accent}44` : undefined,
              }}
            >
              {locked ? <Lock size={11} aria-hidden /> : <Unlock size={11} aria-hidden />}
            </button>
            <button
              type="button"
              disabled={disabled}
              title={`Trigger ${BEAT_PADS_GENO_SLOT_LABELS[slot]} in Studio Editor 2`}
              onClick={() => triggerSlot(slot)}
              style={{
                ...slotBtn,
                opacity: disabled ? 0.45 : 1,
                borderColor: flashSlot === slot ? accent : `${accent}66`,
                background: flashSlot === slot ? `${accent}28` : `${accent}14`,
                color: accent,
              }}
            >
              <Play size={10} fill="currentColor" aria-hidden /> Trigger
            </button>
          </div>
        ))}
        {trailing ? (
          <div
            className="beat-pads-geno-sync-trailing"
            style={{
              flex: '1 1 160px',
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden',
              marginLeft: 2,
              paddingLeft: 6,
              borderLeft: '1px solid rgba(124, 244, 198, 0.14)',
            }}
          >
            {trailing}
          </div>
        ) : null}
      </div>

      {status ? (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: '#b8f5c5',
            lineHeight: 1.35,
            padding: '2px 0 0',
          }}
        >
          {status}
        </span>
      ) : null}
    </div>
  );
}

export function useBeatPadsGenoSyncLock(
  onApplyTransport?: (opts: { bpm: number; loopBars: number }) => void,
): void {
  useEffect(() => {
    return subscribeBeatPadsSe2Bridge((snapshot) => {
      if (!snapshot) return;
      const sync = loadBeatPadsGenoSyncState();
      for (const slot of BEAT_PADS_GENO_SLOT_ORDER) {
        if (!sync[beatPadsGenoSlotLockedKey(slot)]) continue;
        const t = beatPadsTransportFromBridge(snapshot, beatPadsResolveGenoLaneForSlot(snapshot, sync, slot));
        if (t) onApplyTransport?.(t);
      }
    });
  }, [onApplyTransport]);
}
