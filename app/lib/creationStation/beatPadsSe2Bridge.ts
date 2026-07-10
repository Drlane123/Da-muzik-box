/**
 * Beat Pads ↔ Studio Editor 2 cross-screen bridge (memory + localStorage + events).
 */
import {
  SE2_SYNTH_GENO_BUILD_1_LABEL,
  SE2_SYNTH_GENO_BUILD_2_LABEL,
} from '@/app/lib/studio/se2SynthGenoFusionEngine';

export const BEAT_PADS_SE2_BRIDGE_STORAGE_KEY = 'beatPads_se2Bridge_v1';
export const BEAT_PADS_SE2_BRIDGE_EVENT = 'beat-pads-se2-bridge-sync';
export const BEAT_PADS_GENO_TRIGGER_EVENT = 'beat-pads-geno-trigger';
export const BEAT_PADS_OPEN_SE2_EVENT = 'beat-pads-open-studio-editor-2';

export type BeatPadsGenoBuildSlot = 'b01' | 'b02' | 'ultra';

export type BeatPadsSe2GenoLaneKind = 'synthGeno' | 'genoUltraSynth';

/** Short toolbar labels (Beat Pads Geno sync row). */
export const BEAT_PADS_GENO_SLOT_SHORT_LABELS: Record<BeatPadsGenoBuildSlot, string> = {
  b01: 'Geno B01',
  b02: 'Geno B02',
  ultra: 'Geno Ultra',
};

export const BEAT_PADS_GENO_SLOT_LABELS: Record<BeatPadsGenoBuildSlot, string> = {
  b01: SE2_SYNTH_GENO_BUILD_1_LABEL,
  b02: SE2_SYNTH_GENO_BUILD_2_LABEL,
  ultra: 'Geno Ultra Synth',
};

export const BEAT_PADS_GENO_SLOT_ORDER: readonly BeatPadsGenoBuildSlot[] = ['b01', 'b02', 'ultra'];

export function beatPadsGenoSlotTrackIdKey(
  slot: BeatPadsGenoBuildSlot,
): 'b01TrackId' | 'b02TrackId' | 'ultraTrackId' {
  if (slot === 'b01') return 'b01TrackId';
  if (slot === 'b02') return 'b02TrackId';
  return 'ultraTrackId';
}

export function beatPadsGenoSlotLockedKey(
  slot: BeatPadsGenoBuildSlot,
): 'b01Locked' | 'b02Locked' | 'ultraLocked' {
  if (slot === 'b01') return 'b01Locked';
  if (slot === 'b02') return 'b02Locked';
  return 'ultraLocked';
}

export function beatPadsGenoSlotAccent(slot: BeatPadsGenoBuildSlot): string {
  if (slot === 'b01') return '#7cf4c6';
  if (slot === 'b02') return '#00E5FF';
  return '#A78BFA';
}

export type BeatPadsSe2GenoLaneSnapshot = {
  trackId: string;
  name: string;
  laneNumber: number;
  kind?: BeatPadsSe2GenoLaneKind;
  patchLabel?: string;
  loopBars: number;
  beatsPerBar: number;
  bpm: number;
  keyRoot?: number;
  keyMode?: 'major' | 'minor';
  activeBuild?: BeatPadsGenoBuildSlot;
};

export type BeatPadsSe2BridgeSnapshot = {
  updatedAt: number;
  se2Active: boolean;
  bpm: number;
  loopBars: number;
  beatsPerBar: number;
  loopStartBeat: number;
  loopEndBeat: number;
  transport: 'stopped' | 'playing' | 'paused';
  genoLanes: BeatPadsSe2GenoLaneSnapshot[];
  beatPadsLanes: { trackId: string; name: string; laneNumber: number }[];
};

export type BeatPadsGenoSyncState = {
  b01TrackId: string;
  b02TrackId: string;
  ultraTrackId: string;
  b01Locked: boolean;
  b02Locked: boolean;
  ultraLocked: boolean;
};

export type BeatPadsGenoTriggerRequest = {
  nonce: number;
  slot: BeatPadsGenoBuildSlot;
  trackId?: string;
};

export type BeatPadsOpenFromSe2Request = {
  nonce: number;
  trackId: string;
  trackName: string;
  loopBars: number;
  stepsPerBar: 16 | 32;
  bpm: number;
  pattern: unknown;
  genoHarmonyTrackId?: string;
};

export const DEFAULT_BEAT_PADS_GENO_SYNC: BeatPadsGenoSyncState = {
  b01TrackId: '',
  b02TrackId: '',
  ultraTrackId: '',
  b01Locked: false,
  b02Locked: false,
  ultraLocked: false,
};

type BeatPadsBridgeWindow = Window & {
  __daMusicBeatPadsSe2Bridge?: BeatPadsSe2BridgeSnapshot;
};

function bridgeWindow(): BeatPadsBridgeWindow | undefined {
  return typeof window !== 'undefined' ? (window as BeatPadsBridgeWindow) : undefined;
}

function normalizeSnapshot(raw: unknown): BeatPadsSe2BridgeSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as BeatPadsSe2BridgeSnapshot;
  if (!Array.isArray(o.genoLanes)) return null;
  return {
    updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : Date.now(),
    se2Active: o.se2Active === true,
    bpm: typeof o.bpm === 'number' ? o.bpm : 120,
    loopBars: typeof o.loopBars === 'number' ? o.loopBars : 8,
    beatsPerBar: typeof o.beatsPerBar === 'number' ? o.beatsPerBar : 4,
    loopStartBeat: typeof o.loopStartBeat === 'number' ? o.loopStartBeat : 0,
    loopEndBeat: typeof o.loopEndBeat === 'number' ? o.loopEndBeat : 16,
    transport: o.transport === 'playing' || o.transport === 'paused' ? o.transport : 'stopped',
    genoLanes: o.genoLanes,
    beatPadsLanes: Array.isArray(o.beatPadsLanes) ? o.beatPadsLanes : [],
  };
}

/** Never drop cached Geno lanes when SE2 publishes an empty list on unmount. */
export function mergeBeatPadsSe2BridgeSnapshot(
  next: BeatPadsSe2BridgeSnapshot,
  prev: BeatPadsSe2BridgeSnapshot | null,
): BeatPadsSe2BridgeSnapshot {
  if (next.genoLanes.length > 0) return next;
  if (!prev?.genoLanes.length) return next;
  return {
    ...next,
    genoLanes: prev.genoLanes,
    beatPadsLanes: next.beatPadsLanes.length > 0 ? next.beatPadsLanes : prev.beatPadsLanes,
  };
}

export function loadBeatPadsSe2BridgeSnapshot(): BeatPadsSe2BridgeSnapshot | null {
  const mem = bridgeWindow()?.__daMusicBeatPadsSe2Bridge;
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(BEAT_PADS_SE2_BRIDGE_STORAGE_KEY);
    if (!raw) return null;
    return normalizeSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function publishBeatPadsSe2BridgeSnapshot(snapshot: BeatPadsSe2BridgeSnapshot): void {
  const merged = mergeBeatPadsSe2BridgeSnapshot(snapshot, loadBeatPadsSe2BridgeSnapshot());
  const w = bridgeWindow();
  if (w) w.__daMusicBeatPadsSe2Bridge = merged;
  try {
    localStorage.setItem(BEAT_PADS_SE2_BRIDGE_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* quota */
  }
  w?.dispatchEvent(new CustomEvent(BEAT_PADS_SE2_BRIDGE_EVENT, { detail: merged }));
}

export function markBeatPadsSe2BridgeInactive(): void {
  const prev = loadBeatPadsSe2BridgeSnapshot();
  if (!prev) return;
  publishBeatPadsSe2BridgeSnapshot({ ...prev, se2Active: false, updatedAt: Date.now() });
}

export function subscribeBeatPadsSe2Bridge(
  handler: (snapshot: BeatPadsSe2BridgeSnapshot | null) => void,
): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== BEAT_PADS_SE2_BRIDGE_STORAGE_KEY) return;
    handler(loadBeatPadsSe2BridgeSnapshot());
  };
  const onCustom = () => handler(loadBeatPadsSe2BridgeSnapshot());
  handler(loadBeatPadsSe2BridgeSnapshot());
  window.addEventListener('storage', onStorage);
  window.addEventListener(BEAT_PADS_SE2_BRIDGE_EVENT, onCustom);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(BEAT_PADS_SE2_BRIDGE_EVENT, onCustom);
  };
}

export function loadBeatPadsGenoSyncState(): BeatPadsGenoSyncState {
  try {
    const raw = localStorage.getItem(`${BEAT_PADS_SE2_BRIDGE_STORAGE_KEY}_genoSync`);
    if (!raw) return { ...DEFAULT_BEAT_PADS_GENO_SYNC };
    const parsed = JSON.parse(raw) as Partial<BeatPadsGenoSyncState>;
    return {
      b01TrackId: typeof parsed.b01TrackId === 'string' ? parsed.b01TrackId : '',
      b02TrackId: typeof parsed.b02TrackId === 'string' ? parsed.b02TrackId : '',
      ultraTrackId: typeof parsed.ultraTrackId === 'string' ? parsed.ultraTrackId : '',
      b01Locked: parsed.b01Locked === true,
      b02Locked: parsed.b02Locked === true,
      ultraLocked: parsed.ultraLocked === true,
    };
  } catch {
    return { ...DEFAULT_BEAT_PADS_GENO_SYNC };
  }
}

export function saveBeatPadsGenoSyncState(state: BeatPadsGenoSyncState): void {
  try {
    localStorage.setItem(`${BEAT_PADS_SE2_BRIDGE_STORAGE_KEY}_genoSync`, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function dispatchBeatPadsGenoTrigger(req: Omit<BeatPadsGenoTriggerRequest, 'nonce'>): void {
  const payload: BeatPadsGenoTriggerRequest = { ...req, nonce: Date.now() };
  bridgeWindow()?.dispatchEvent(new CustomEvent(BEAT_PADS_GENO_TRIGGER_EVENT, { detail: payload }));
  try {
    localStorage.setItem(`${BEAT_PADS_SE2_BRIDGE_STORAGE_KEY}_genoTrigger`, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function dispatchBeatPadsOpenSe2(): void {
  bridgeWindow()?.dispatchEvent(new CustomEvent(BEAT_PADS_OPEN_SE2_EVENT));
}

export function consumeBeatPadsGenoTrigger(): BeatPadsGenoTriggerRequest | null {
  try {
    const raw = localStorage.getItem(`${BEAT_PADS_SE2_BRIDGE_STORAGE_KEY}_genoTrigger`);
    if (!raw) return null;
    localStorage.removeItem(`${BEAT_PADS_SE2_BRIDGE_STORAGE_KEY}_genoTrigger`);
    return JSON.parse(raw) as BeatPadsGenoTriggerRequest;
  } catch {
    return null;
  }
}

export function queueBeatPadsOpenFromSe2(req: Omit<BeatPadsOpenFromSe2Request, 'nonce'>): void {
  const payload: BeatPadsOpenFromSe2Request = { ...req, nonce: Date.now() };
  try {
    localStorage.setItem(`${BEAT_PADS_SE2_BRIDGE_STORAGE_KEY}_openFromSe2`, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function consumeBeatPadsOpenFromSe2(): BeatPadsOpenFromSe2Request | null {
  try {
    const raw = localStorage.getItem(`${BEAT_PADS_SE2_BRIDGE_STORAGE_KEY}_openFromSe2`);
    if (!raw) return null;
    localStorage.removeItem(`${BEAT_PADS_SE2_BRIDGE_STORAGE_KEY}_openFromSe2`);
    return JSON.parse(raw) as BeatPadsOpenFromSe2Request;
  } catch {
    return null;
  }
}

export function beatPadsGenoLanesForSlot(
  snapshot: BeatPadsSe2BridgeSnapshot | null,
  slot: BeatPadsGenoBuildSlot,
): readonly BeatPadsSe2GenoLaneSnapshot[] {
  const lanes = snapshot?.genoLanes ?? [];
  if (slot === 'ultra') {
    return lanes.filter((l) => l.kind === 'genoUltraSynth');
  }
  return lanes.filter((l) => l.kind === 'synthGeno' || l.kind == null);
}

export function beatPadsResolveGenoLaneForSlot(
  snapshot: BeatPadsSe2BridgeSnapshot | null,
  sync: BeatPadsGenoSyncState,
  slot: BeatPadsGenoBuildSlot,
): BeatPadsSe2GenoLaneSnapshot | null {
  const pool = beatPadsGenoLanesForSlot(snapshot, slot);
  if (pool.length === 0) return null;
  const trackId = sync[beatPadsGenoSlotTrackIdKey(slot)];
  if (trackId) {
    const hit = pool.find((l) => l.trackId === trackId);
    if (hit) return hit;
  }
  if (slot === 'b02') return pool[1] ?? pool[0] ?? null;
  return pool[0] ?? null;
}

export function beatPadsAutoAssignGenoTracks(
  snapshot: BeatPadsSe2BridgeSnapshot | null,
  prev: BeatPadsGenoSyncState,
): BeatPadsGenoSyncState {
  const lanes = snapshot?.genoLanes ?? [];
  const synth = lanes.filter((l) => l.kind === 'synthGeno' || l.kind == null);
  const ultra = lanes.filter((l) => l.kind === 'genoUltraSynth');
  return {
    b01TrackId: prev.b01TrackId || synth[0]?.trackId || '',
    b02TrackId: prev.b02TrackId || synth[1]?.trackId || synth[0]?.trackId || '',
    ultraTrackId: prev.ultraTrackId || ultra[0]?.trackId || '',
    b01Locked: prev.b01Locked,
    b02Locked: prev.b02Locked,
    ultraLocked: prev.ultraLocked,
  };
}

export function beatPadsTransportFromBridge(
  snapshot: BeatPadsSe2BridgeSnapshot | null,
  lane: BeatPadsSe2GenoLaneSnapshot | null,
): { bpm: number; loopBars: number } | null {
  if (lane) return { bpm: lane.bpm, loopBars: lane.loopBars };
  if (!snapshot) return null;
  return { bpm: snapshot.bpm, loopBars: snapshot.loopBars };
}
