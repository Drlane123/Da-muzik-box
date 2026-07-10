/**
 * SE2 808 Lab — chord lock: follow harmony lane roots or lock pads to a chosen key.
 */
import {
  chordSymbolToRootMidi,
  coerceChordSymbolForMode,
  KEY_ROOTS,
  type ChordMode,
  type ChordSymbol,
} from '@/app/lib/creationStation/chordBuilder';
import { beatLabSynthChordRailToProgressionRoots } from '@/app/lib/creationStation/lab808ChordLockSources';
import {
  fitProgressionRootsTo808Roll,
  LAB808_BEATS_PER_BAR,
  LAB808_DEFAULT_ROOT_OCTAVE_SHIFT,
  lab808HarmonicBassMidi,
  type Lab808ProgressionRoot,
} from '@/app/lib/creationStation/lab808ChordRoots';
import {
  se2DrumGenHarmonyOptionHint,
  se2DrumGenHarmonyReadyCandidates,
  se2DrumGenHarmonySourceCandidates,
  se2DrumGenTrackHarmonyReady,
  se2SortDrumGenHarmonyCandidates,
  type Se2DrumGenHarmonySourceTrack,
} from '@/app/lib/studio/se2DrumGeneratorTrack';
import {
  se2GlideBassChordRailFromSource,
  se2HarmonySourceSteps,
  type Se2HarmonySourceTrack,
} from '@/app/lib/studio/se2GlideBassHarmony';
import { studioTrackDetectedKeyFromFields } from '@/app/lib/studio/se2GlideBassNotes';
import { studioKeyLabel, type StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';

export type Se2Lab808ChordLockSourceKind = 'song-key' | 'key' | 'track';

export type Se2Lab808ChordLock = {
  enabled: boolean;
  sourceKind: Se2Lab808ChordLockSourceKind;
  harmonyTrackId?: string;
  keyRoot?: number;
  keyMode?: ChordMode;
};

export type Se2Lab808ChordLockHarmonyTrack = Se2DrumGenHarmonySourceTrack & Se2HarmonySourceTrack;

const LOOP_SYMBOLS_MAJOR = ['I', 'V', 'vi', 'IV'] as const satisfies readonly ChordSymbol[];
const LOOP_SYMBOLS_MINOR = ['i', 'VI', 'III', 'VII'] as const satisfies readonly ChordSymbol[];

export const SE2_LAB808_CHORD_LOCK_KEY_OPTIONS = KEY_ROOTS.flatMap((k) => [
  { root: k.value, mode: 'major' as const },
  { root: k.value, mode: 'minor' as const },
]);

export function se2Lab808DefaultChordLock(): Se2Lab808ChordLock {
  return {
    enabled: false,
    sourceKind: 'song-key',
  };
}

export function se2Lab808NormalizeChordLock(raw: Partial<Se2Lab808ChordLock> | undefined): Se2Lab808ChordLock {
  const base = se2Lab808DefaultChordLock();
  if (!raw) return base;
  const sourceKind =
    raw.sourceKind === 'track' || raw.sourceKind === 'key' || raw.sourceKind === 'song-key'
      ? raw.sourceKind
      : base.sourceKind;
  const keyRoot =
    typeof raw.keyRoot === 'number' && Number.isFinite(raw.keyRoot)
      ? Math.max(0, Math.min(11, Math.round(raw.keyRoot)))
      : undefined;
  const keyMode = raw.keyMode === 'minor' ? 'minor' : raw.keyMode === 'major' ? 'major' : undefined;
  return {
    enabled: !!raw.enabled,
    sourceKind,
    harmonyTrackId: raw.harmonyTrackId?.trim() || undefined,
    keyRoot,
    keyMode,
  };
}

export function se2Lab808ChordLockFromTrackFields(tr: {
  lab808ChordLockEnabled?: boolean;
  lab808ChordLockSourceKind?: string;
  lab808ChordLockHarmonyTrackId?: string;
  lab808ChordLockKeyRoot?: number;
  lab808ChordLockKeyMode?: string;
}): Se2Lab808ChordLock {
  return se2Lab808NormalizeChordLock({
    enabled: tr.lab808ChordLockEnabled,
    sourceKind: tr.lab808ChordLockSourceKind as Se2Lab808ChordLock['sourceKind'],
    harmonyTrackId: tr.lab808ChordLockHarmonyTrackId,
    keyRoot: tr.lab808ChordLockKeyRoot,
    keyMode: tr.lab808ChordLockKeyMode as ChordMode,
  });
}

export function se2Lab808ChordLockTrackFields(lock: Se2Lab808ChordLock): {
  lab808ChordLockEnabled: boolean;
  lab808ChordLockSourceKind: Se2Lab808ChordLock['sourceKind'];
  lab808ChordLockHarmonyTrackId?: string;
  lab808ChordLockKeyRoot?: number;
  lab808ChordLockKeyMode?: ChordMode;
} {
  const normalized = se2Lab808NormalizeChordLock(lock);
  return {
    lab808ChordLockEnabled: normalized.enabled,
    lab808ChordLockSourceKind: normalized.sourceKind,
    lab808ChordLockHarmonyTrackId: normalized.harmonyTrackId,
    lab808ChordLockKeyRoot: normalized.keyRoot,
    lab808ChordLockKeyMode: normalized.keyMode,
  };
}

export function se2Lab808ChordLockDropdownValue(lock: Se2Lab808ChordLock): string {
  const cfg = se2Lab808NormalizeChordLock(lock);
  if (cfg.sourceKind === 'track') return `track:${cfg.harmonyTrackId ?? ''}`;
  if (cfg.sourceKind === 'key') {
    const root = cfg.keyRoot ?? 0;
    const mode = cfg.keyMode ?? 'major';
    return `key:${root}:${mode}`;
  }
  return 'song-key';
}

export function se2Lab808ChordLockFromDropdownValue(
  value: string,
  current: Se2Lab808ChordLock,
): Se2Lab808ChordLock {
  const base = se2Lab808NormalizeChordLock(current);
  if (value.startsWith('track:')) {
    const trackId = value.slice('track:'.length).trim();
    return { ...base, enabled: base.enabled, sourceKind: 'track', harmonyTrackId: trackId || undefined };
  }
  if (value.startsWith('key:')) {
    const parts = value.split(':');
    const root = Number(parts[1]);
    const mode = parts[2] === 'minor' ? 'minor' : 'major';
    return {
      ...base,
      sourceKind: 'key',
      keyRoot: Number.isFinite(root) ? Math.max(0, Math.min(11, Math.round(root))) : 0,
      keyMode: mode,
    };
  }
  return { ...base, sourceKind: 'song-key' };
}

export function se2Lab808HarmonySourceCandidates<T extends Se2Lab808ChordLockHarmonyTrack>(
  tracks: readonly T[],
  lab808TrackId: string,
): T[] {
  return se2SortDrumGenHarmonyCandidates(se2DrumGenHarmonySourceCandidates(tracks, lab808TrackId));
}

export function se2Lab808HarmonyReadyCandidates<T extends Se2Lab808ChordLockHarmonyTrack>(
  tracks: readonly T[],
  lab808TrackId: string,
): T[] {
  return se2DrumGenHarmonyReadyCandidates(tracks, lab808TrackId);
}

export function se2Lab808ResolveHarmonyTrack<T extends Se2Lab808ChordLockHarmonyTrack>(
  tracks: readonly T[],
  lock: Se2Lab808ChordLock,
  lab808TrackId: string,
): T | undefined {
  const cfg = se2Lab808NormalizeChordLock(lock);
  if (cfg.sourceKind === 'track') {
    const want = cfg.harmonyTrackId?.trim();
    if (want) {
      const picked = tracks.find((t) => t.id === want);
      if (picked && picked.id !== lab808TrackId && picked.kind !== 'lab808' && picked.kind !== 'audio') {
        return picked;
      }
    }
    return se2Lab808HarmonyReadyCandidates(tracks, lab808TrackId)[0];
  }
  if (cfg.sourceKind === 'song-key') {
    return se2Lab808HarmonyReadyCandidates(tracks, lab808TrackId)[0];
  }
  return undefined;
}

function diatonicLoopRoots(
  keyRoot: number,
  mode: ChordMode,
  padCount = 16,
  loopBars = 8,
): Lab808ProgressionRoot[] {
  const symbols = mode === 'minor' ? LOOP_SYMBOLS_MINOR : LOOP_SYMBOLS_MAJOR;
  const raw: Array<{ startBeat: number; durBeats: number; midi: number; chord: string }> = [];
  let beat = 0;
  const maxBeat = loopBars * LAB808_BEATS_PER_BAR;
  for (let i = 0; i < padCount && beat < maxBeat; i++) {
    const sym = coerceChordSymbolForMode(symbols[i % symbols.length]!, mode);
    const root = chordSymbolToRootMidi(sym, keyRoot, mode, 0);
    if (root == null) continue;
    raw.push({
      startBeat: beat,
      durBeats: LAB808_BEATS_PER_BAR,
      midi: root + LAB808_DEFAULT_ROOT_OCTAVE_SHIFT * 12,
      chord: sym,
    });
    beat += LAB808_BEATS_PER_BAR;
  }
  if (raw.length === 0) return [];
  const bassMidis = raw.map((r) => lab808HarmonicBassMidi(r.midi));
  const rollMidis = fitProgressionRootsTo808Roll(bassMidis);
  return raw.map((r, i) => ({
    startBeat: r.startBeat,
    durBeats: r.durBeats,
    midi: bassMidis[i]!,
    rollMidi: rollMidis[i]!,
    chord: r.chord,
  }));
}

export function se2Lab808ChordLockKey(
  lock: Se2Lab808ChordLock,
  source: Se2HarmonySourceTrack | undefined,
  songKeyRoot: number,
  songKeyMode: ChordMode,
): { keyRoot: number; keyMode: ChordMode } {
  const cfg = se2Lab808NormalizeChordLock(lock);
  if (cfg.sourceKind === 'key' && cfg.keyRoot != null) {
    return { keyRoot: cfg.keyRoot, keyMode: cfg.keyMode ?? 'major' };
  }
  if (source) {
    return studioTrackDetectedKeyFromFields(source, songKeyRoot, songKeyMode);
  }
  return { keyRoot: songKeyRoot, keyMode: songKeyMode };
}

export function se2Lab808ProgressionRoots(args: {
  tracks: readonly Se2Lab808ChordLockHarmonyTrack[];
  lab808TrackId: string;
  lock: Se2Lab808ChordLock;
  songKeyRoot: number;
  songKeyMode: ChordMode;
  beatsPerBar?: number;
  loopBars?: number;
}): Lab808ProgressionRoot[] {
  const lock = se2Lab808NormalizeChordLock(args.lock);
  const beatsPerBar = args.beatsPerBar ?? LAB808_BEATS_PER_BAR;
  const loopBars = args.loopBars ?? 8;
  const source = se2Lab808ResolveHarmonyTrack(args.tracks, lock, args.lab808TrackId);
  const { keyRoot, keyMode } = se2Lab808ChordLockKey(lock, source, args.songKeyRoot, args.songKeyMode);

  if (lock.sourceKind !== 'key' && source && se2HarmonySourceSteps(source).length > 0) {
    const rail = se2GlideBassChordRailFromSource(source, beatsPerBar, keyRoot, keyMode);
    if (rail) {
      const roots = beatLabSynthChordRailToProgressionRoots(rail);
      if (roots.length > 0) return roots;
    }
  }

  return diatonicLoopRoots(keyRoot, keyMode, 16, loopBars);
}

export function se2Lab808ChordLockConnected(
  lock: Se2Lab808ChordLock,
  roots: readonly Lab808ProgressionRoot[],
): boolean {
  return se2Lab808NormalizeChordLock(lock).enabled && roots.length > 0;
}

export function se2Lab808ChordLockSourceLabel(args: {
  lock: Se2Lab808ChordLock;
  tracks: readonly Se2Lab808ChordLockHarmonyTrack[];
  lab808TrackId: string;
  songKeyRoot: number;
  songKeyMode: ChordMode;
  laneLabel: (t: Se2Lab808ChordLockHarmonyTrack) => string;
}): string {
  const lock = se2Lab808NormalizeChordLock(args.lock);
  if (lock.sourceKind === 'key') {
    const root = lock.keyRoot ?? 0;
    const mode = lock.keyMode ?? 'major';
    return studioKeyLabel(root, mode as StudioDetectedKeyMode);
  }
  if (lock.sourceKind === 'track') {
    const source = se2Lab808ResolveHarmonyTrack(args.tracks, lock, args.lab808TrackId);
    if (source) return `${args.laneLabel(source)} · ${se2DrumGenHarmonyOptionHint(source)}`;
    return 'Pick chord lane';
  }
  const source = se2Lab808ResolveHarmonyTrack(args.tracks, lock, args.lab808TrackId);
  if (source) return `${args.laneLabel(source)} (song key)`;
  return `${studioKeyLabel(args.songKeyRoot, args.songKeyMode as StudioDetectedKeyMode)} (song key)`;
}

export function se2Lab808ChordLockTrackReady(t: Se2Lab808ChordLockHarmonyTrack): boolean {
  return se2DrumGenTrackHarmonyReady(t);
}
