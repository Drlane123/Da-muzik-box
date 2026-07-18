'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from 'react';
import {
  type BeatPadsSpreadDirection,
} from '@/app/lib/creationStation/beatPadsHitSpread';
import {
  buildBeatPadsSpreadVoiceFromPad,
  playBeatPadsSpreadRow,
  BEAT_PADS_SPREAD_MIXER_CH,
  clampBeatPadsSpreadMixerChannel,
  beatPadsSpreadClampNotesToLoop,
  beatPadsSpreadConvertNotesGridSteps,
  type BeatPadsSpreadLoopBars,
  type BeatPadsSpreadNote,
  type BeatPadsSpreadTrackState,
  type BeatPadsSpreadVoice,
} from '@/app/lib/creationStation/beatPadsSpreadTrack';
import { generateBeatPadsSpreadChordRootNotes } from '@/app/lib/creationStation/beatPadsSpreadChordGenerate';
import {
  se2BeatPadsSpreadSnapshotFromTrack,
  se2BeatPadsSpreadTrackFromSnapshot,
} from '@/app/lib/studio/se2BeatPadsSpreadStore';
import {
  beatLabDrumVoiceGridVelocity,
  beatLabDrumVoiceManualVelocity,
  beatLabDrumVoiceScheduleOffsetSec,
  beatLabDrumVoiceToSamplerOpts,
  clampBeatLabDrumPadVoiceOpts,
  defaultBeatLabDrumPadVoiceOpts,
  type BeatLabDrumPadVoiceOpts,
} from '@/app/lib/creationStation/beatLabDrumPadVoice';
import {
  countBeatPadsSessionNotes,
  findBeatPadsSavedSession,
  loadBeatPadsSavedSessions,
  persistBeatPadsSavedSessions,
  renameBeatPadsSavedSession,
  upsertBeatPadsSavedSession,
  type BeatPadsSavedSession,
} from '@/app/lib/creationStation/beatPadsSavedSessions';
import { audioBufferToStoredKitSample } from '@/app/lib/creationStation/drumKitGenerator';
import { playPadSampleBuffer } from '@/app/lib/creationStation/padSamplePlayback';
import { getSe2BeatPadsMainVolume } from '@/app/lib/studio/se2BeatPadsMainVolume';
import {
  clonePadSamplerFxRack,
  defaultPadSamplerFxRack,
  fxRackFromStored,
  writeFxRackToStored,
  type PadSamplerFxRack,
} from '@/app/lib/creationStation/padSamplerFxRack';
import { setSe2BeatPadsLivePadShaping } from '@/app/lib/studio/se2BeatPadsTransportPlayback';
import {
  beatLabProducerKitMeta,
  ensureBeatLabProducerKitLoaded,
  type BeatLabProducerKitId,
} from '@/app/lib/creationStation/beatLabProducerKits';
import { planAutoDrumPadMatch } from '@/app/lib/creationStation/beatPadsAutoDrumPadMatch';
import type { BeatPadsDrumRole } from '@/app/lib/creationStation/beatPadsLanePlacementTemplates';
import { trapPadSamplerOpts } from '@/app/lib/creationStation/beatLabFolderImport';
import {
  beatLabPatternBankIdForPresetGenre,
  type BeatLabPatternBankId,
  type BeatLabPatternSlotId,
} from '@/app/lib/creationStation/beatLabPatternBank';
import {
  beatLabProducerKitIdForPatternPreset,
} from '@/app/lib/creationStation/beatLabPatternPresetKits';
import {
  countSavedKitPads,
  findBeatLabSavedKit,
  loadBeatLabSavedKits,
  upsertBeatLabSavedKit,
  type BeatLabSavedKit,
} from '@/app/lib/creationStation/beatLabSavedKits';
import type { PatternPreset } from '@/app/lib/patternPresets';
import {
  fetchAndDecodeFamilySample,
  samplerOptsForFamily,
} from '@/app/lib/creationStation/soundFamiliesCatalog';
import {
  ORCHESTRA_HITS_SOUND_FAMILY_ID,
  orchestraHitsPadDefForFile,
} from '@/app/lib/creationStation/soundFamilyOrchestraHits';
import { KEY_ROOTS, MODE_LABELS, type ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { Se2BeatPadsHarmonySourceTrack } from '@/app/lib/studio/se2BeatPadsHarmony';
import {
  se2BeatPadsSpreadDefaultMatchTrackIndex,
  se2BeatPadsSpreadKeyLockSemiAtCol,
  se2BeatPadsSpreadMatchTrackOptions,
  se2BeatPadsSpreadResolveMatchTrackIndex,
} from '@/app/lib/studio/se2BeatPadsSpreadHarmony';
import { se2TrackNumberedName } from '@/app/lib/studio/se2StudioTrackNumber';
import {
  loadSe2BeatPadsPadStore,
  saveSe2BeatPadsPadStore,
  se2BeatPadsPadKey,
} from '@/app/lib/studio/se2BeatPadsPadStorage';
import {
  readSe2BeatPadsSamplerCache,
  writeSe2BeatPadsSamplerCache,
} from '@/app/lib/studio/se2BeatPadsSamplerCache';
import {
  chromaticPadMetaFromStored,
  defaultPadSamplerPlaybackOpts,
  fileToStoredPadSample,
  samplerOptsFromStored,
  storedToArrayBuffer,
  writeChromaticPadMetaToStored,
  writeSamplerOptsToStored,
  type PadSamplerPlaybackOpts,
  type StoredPadSample,
} from '@/app/lib/padSampleStorage';
import type { BeatPadsDrumPattern, BeatPadsGridStepsPerBar } from '@/app/lib/creationStation/beatLabDrumMachineSequencer';

const PRESET_KITS = ['Default', 'Trap 808', 'Lo-Fi', 'Acoustic', 'Electronic', 'Afrobeats'] as const;
const PAD_VEL = [115, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 127];

function se2VoiceKey(trackId: string, padIndex: number): string {
  return se2BeatPadsPadKey(trackId, padIndex);
}

export type UseSe2BeatPadsSamplerArgs = {
  trackId: string;
  trackIndex: number;
  bpm: number;
  sessionBpm?: number;
  ensureCtx: () => Promise<AudioContext>;
  getTrackStripInput?: () => GainNode | null;
  /** SE2 master bus — count-in clicks route here when set. */
  getMasterOutput?: () => GainNode | null;
  trackVolume127?: number;
  producerKitId?: BeatLabProducerKitId;
  matchedPresetId?: string;
  onMatchedPresetIdChange?: (presetId: string) => void;
  onProducerKitIdChange?: (id: BeatLabProducerKitId) => void;
  onPadStoreChanged?: () => void;
  disabled?: boolean;
  onClose?: () => void;
  /** When false, user must load a producer kit manually (SE2 — avoids freeze on panel open). */
  autoBootstrapKit?: boolean;
  /** Playback-time semitone offset for the selected kick target pad (C-root → song key). */
  kickKeySemi?: number;
  /** Pad index (0–15) that receives 808-in-key pitch lock. */
  kickTargetPad?: number;
  onKickTargetPadChange?: (padIndex: number) => void;
  /** SE2 spread roll — chord roots from studio MIDI tracks (not harmony-strip kick lock). */
  harmonyTracks?: readonly Se2BeatPadsHarmonySourceTrack[];
  songKeyRoot?: number;
  songKeyMode?: ChordMode;
  beatsPerBar?: number;
  beatPadsSpreadSnapshot?: import('@/app/lib/studio/se2BeatPadsSpreadStore').Se2BeatPadsSpreadSnapshot | null;
  onBeatPadsSpreadChange?: (
    snap: import('@/app/lib/studio/se2BeatPadsSpreadStore').Se2BeatPadsSpreadSnapshot | null,
  ) => void;
};

export function useSe2BeatPadsSampler({
  trackId,
  trackIndex,
  bpm,
  sessionBpm,
  ensureCtx,
  getTrackStripInput,
  getMasterOutput,
  trackVolume127 = 100,
  producerKitId: producerKitIdProp = 'trapDarkVault',
  matchedPresetId,
  onMatchedPresetIdChange,
  onProducerKitIdChange,
  onPadStoreChanged,
  disabled = false,
  onClose,
  autoBootstrapKit = true,
  kickKeySemi = 0,
  kickTargetPad = 0,
  onKickTargetPadChange,
  harmonyTracks,
  songKeyRoot = 0,
  songKeyMode = 'major',
  beatsPerBar = 4,
  beatPadsSpreadSnapshot = null,
  onBeatPadsSpreadChange,
}: UseSe2BeatPadsSamplerArgs) {
  const [selectedPad, setSelectedPad] = useState(() =>
    Math.max(0, Math.min(15, Math.round(kickTargetPad))),
  );
  const [padSamplePresence, setPadSamplePresence] = useState<Record<string, boolean>>({});
  const [padSampleLabels, setPadSampleLabels] = useState<Record<string, string>>({});
  const [padSampleRootBpms, setPadSampleRootBpms] = useState<Record<string, number>>({});
  const [producerKitId, setProducerKitId] = useState<BeatLabProducerKitId>(producerKitIdProp);
  const [producerKitLoading, setProducerKitLoading] = useState(false);
  const [loadingProducerKitId, setLoadingProducerKitId] = useState<BeatLabProducerKitId | null>(null);
  const [beatPadsSpreadTrack, setBeatPadsSpreadTrack] = useState<BeatPadsSpreadTrackState | null>(null);
  const beatPadsSpreadActive = beatPadsSpreadTrack != null;
  const beatPadsSpreadVoiceRef = useRef<BeatPadsSpreadVoice | null>(null);
  const spreadChordGenSeedRef = useRef(0);
  const [savedBeatPadsSessions, setSavedBeatPadsSessions] = useState<BeatPadsSavedSession[]>(() =>
    loadBeatPadsSavedSessions(),
  );
  const [beatPadsSessionSaveStatus, setBeatPadsSessionSaveStatus] = useState<string | null>(null);
  const [beatPadsSessionInject, setBeatPadsSessionInject] = useState<{
    session: BeatPadsSavedSession;
    nonce: number;
  } | null>(null);
  const [kitSelectValue, setKitSelectValue] = useState(`preset:${PRESET_KITS[0]}`);
  const [kitLabel, setKitLabel] = useState<string>(PRESET_KITS[0]);
  const [savedKits, setSavedKits] = useState<BeatLabSavedKit[]>(() => loadBeatLabSavedKits());
  const [saveKitStatus, setSaveKitStatus] = useState<string | null>(null);
  const [patternSlot, setPatternSlot] = useState<BeatLabPatternSlotId>('A');
  const [loadedPatternBankId, setLoadedPatternBankId] = useState<BeatLabPatternBankId | null>(null);
  const [loadedPatternPresetId, setLoadedPatternPresetId] = useState<string | null>(
    matchedPresetId ?? null,
  );
  const [trapKitBrowserOpen, setTrapKitBrowserOpen] = useState(false);
  const [trapKitBrowserFiles, setTrapKitBrowserFiles] = useState<File[]>([]);

  const padSampleBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const padSamplePlaybackOptsRef = useRef<Record<string, PadSamplerPlaybackOpts>>({});
  const padSampleFxRackRef = useRef<Record<string, PadSamplerFxRack>>({});
  const padSampleRootMidiRef = useRef<Record<string, number>>({});
  const padSampleStrikeMidiRef = useRef<Record<string, number>>({});
  const padSampleChromaticRef = useRef<Record<string, boolean>>({});
  const padDrumVoiceOptsRef = useRef<Record<string, BeatLabDrumPadVoiceOpts>>({});
  const padSampleActiveStoppersRef = useRef<Map<string, Set<{ stop: () => void; when: number }>>>(
    new Map(),
  );

  const pendingPadSampleRef = useRef<number | null>(null);
  const padSampleFileInputRef = useRef<HTMLInputElement | null>(null);
  const trapKitFolderInputRef = useRef<HTMLInputElement | null>(null);
  const producerKitLoadGenRef = useRef(0);
  const padStorePersistRef = useRef(Promise.resolve());
  const onPadStoreChangedRef = useRef(onPadStoreChanged);
  const padStoreNotifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bpmRef = useRef(bpm);
  const trackVolumeRef = useRef(trackVolume127);
  const trackIdRef = useRef(trackId);
  const kickKeySemiRef = useRef(kickKeySemi);
  const kickTargetPadRef = useRef(kickTargetPad);
  const harmonyTracksRef = useRef(harmonyTracks);
  const songKeyRootRef = useRef(songKeyRoot);
  const songKeyModeRef = useRef(songKeyMode);
  const beatsPerBarRef = useRef(beatsPerBar);
  const onBeatPadsSpreadChangeRef = useRef(onBeatPadsSpreadChange);
  onBeatPadsSpreadChangeRef.current = onBeatPadsSpreadChange;

  const persistSpreadSnapshot = useCallback((track: BeatPadsSpreadTrackState | null) => {
    onBeatPadsSpreadChangeRef.current?.(
      track ? se2BeatPadsSpreadSnapshotFromTrack(track) : null,
    );
  }, []);

  const spreadPersistReadyRef = useRef(false);

  useEffect(() => {
    spreadPersistReadyRef.current = false;
  }, [trackId]);

  useEffect(() => {
    if (!spreadPersistReadyRef.current) {
      if (beatPadsSpreadTrack) spreadPersistReadyRef.current = true;
      return;
    }
    persistSpreadSnapshot(beatPadsSpreadTrack);
  }, [beatPadsSpreadTrack, persistSpreadSnapshot]);

  const spreadRestoredForTrackRef = useRef<string | null>(null);

  useEffect(() => {
    spreadRestoredForTrackRef.current = null;
  }, [trackId]);

  useEffect(() => {
    if (!beatPadsSpreadSnapshot || beatPadsSpreadTrack) return;
    if (spreadRestoredForTrackRef.current === trackId) return;
    let cancelled = false;
    void (async () => {
      await ensureCtx();
      const snap = beatPadsSpreadSnapshot;
      for (let attempt = 0; attempt < 24; attempt += 1) {
        if (cancelled) return;
        const srcKey = se2BeatPadsPadKey(trackIdRef.current, snap.sourcePad);
        const buf = padSampleBuffersRef.current.get(srcKey);
        if (buf) {
          const srcOpts = padSamplePlaybackOptsRef.current[srcKey] ?? defaultPadSamplerPlaybackOpts();
          const fxTemplate = clonePadSamplerFxRack(
            padSampleFxRackRef.current[srcKey] ?? defaultPadSamplerFxRack(),
          );
          const rootBpm = padSampleRootBpms[srcKey] ?? bpmRef.current;
          const label = padSampleLabels[srcKey] ?? snap.baseLabel;
          const voice = buildBeatPadsSpreadVoiceFromPad({
            buffer: buf,
            label,
            rootMidi: padSampleRootMidiRef.current[srcKey] ?? snap.rootMidi,
            chromatic: padSampleChromaticRef.current[srcKey],
            sampler: srcOpts,
            fx: fxTemplate,
            rootBpm,
            direction: snap.direction,
            mixerChannel: snap.mixerChannel,
          });
          beatPadsSpreadVoiceRef.current = voice;
          const stored = audioBufferToStoredKitSample(buf, voice.baseLabel, rootBpm);
          writeSamplerOptsToStored(stored, voice.sampler);
          writeFxRackToStored(stored, fxTemplate);
          writeChromaticPadMetaToStored(stored, voice.rootMidi, true);
          spreadRestoredForTrackRef.current = trackId;
          setBeatPadsSpreadTrack(se2BeatPadsSpreadTrackFromSnapshot(snap, stored));
          return;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 40));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    beatPadsSpreadSnapshot,
    beatPadsSpreadTrack,
    ensureCtx,
    padSampleLabels,
    padSampleRootBpms,
    trackId,
  ]);
  bpmRef.current = bpm;
  trackVolumeRef.current = trackVolume127;
  trackIdRef.current = trackId;
  kickKeySemiRef.current = kickKeySemi;
  kickTargetPadRef.current = kickTargetPad;
  harmonyTracksRef.current = harmonyTracks;
  songKeyRootRef.current = songKeyRoot;
  songKeyModeRef.current = songKeyMode;
  beatsPerBarRef.current = beatsPerBar;
  onPadStoreChangedRef.current = onPadStoreChanged;
  const beatPadsSpreadTrackLiveRef = useRef(beatPadsSpreadTrack);
  beatPadsSpreadTrackLiveRef.current = beatPadsSpreadTrack;
  const selectedPadLiveRef = useRef(selectedPad);
  selectedPadLiveRef.current = selectedPad;
  const producerKitIdLiveRef = useRef(producerKitId);
  producerKitIdLiveRef.current = producerKitId;
  const padSampleLabelsLiveRef = useRef(padSampleLabels);
  padSampleLabelsLiveRef.current = padSampleLabels;
  const padSampleRootBpmsLiveRef = useRef(padSampleRootBpms);
  padSampleRootBpmsLiveRef.current = padSampleRootBpms;

  useEffect(() => {
    const cached = readSe2BeatPadsSamplerCache(trackId);
    if (cached) {
      for (const [k, buf] of cached.padSampleBuffers) {
        padSampleBuffersRef.current.set(k, buf);
      }
      Object.assign(padSamplePlaybackOptsRef.current, cached.padSamplePlaybackOpts);
      Object.assign(padSampleFxRackRef.current, cached.padSampleFxRack);
      Object.assign(padSampleRootMidiRef.current, cached.padSampleRootMidi);
      Object.assign(padSampleStrikeMidiRef.current, cached.padSampleStrikeMidi);
      Object.assign(padSampleChromaticRef.current, cached.padSampleChromatic);
      Object.assign(padDrumVoiceOptsRef.current, cached.padDrumVoiceOpts);
      setPadSamplePresence((prev) => ({ ...prev, ...cached.padSamplePresence }));
      setPadSampleRootBpms((prev) => ({ ...prev, ...cached.padSampleRootBpms }));
      setPadSampleLabels((prev) => ({ ...prev, ...cached.padSampleLabels }));
      setSelectedPad(cached.selectedPad);
      setProducerKitId(cached.producerKitId);
      if (cached.beatPadsSpreadTrack) {
        beatPadsSpreadVoiceRef.current = cached.beatPadsSpreadVoice;
        setBeatPadsSpreadTrack(cached.beatPadsSpreadTrack);
        spreadPersistReadyRef.current = true;
        spreadRestoredForTrackRef.current = trackId;
      }
    }
    return () => {
      const tid = trackIdRef.current;
      const prefix = `${tid}_`;
      const presence: Record<string, boolean> = {};
      for (const k of padSampleBuffersRef.current.keys()) {
        if (k.startsWith(prefix)) presence[k] = true;
      }
      writeSe2BeatPadsSamplerCache(tid, {
        padSampleBuffers: new Map(padSampleBuffersRef.current),
        padSamplePlaybackOpts: { ...padSamplePlaybackOptsRef.current },
        padSampleFxRack: { ...padSampleFxRackRef.current },
        padSampleRootMidi: { ...padSampleRootMidiRef.current },
        padSampleStrikeMidi: { ...padSampleStrikeMidiRef.current },
        padSampleChromatic: { ...padSampleChromaticRef.current },
        padDrumVoiceOpts: { ...padDrumVoiceOptsRef.current },
        padSamplePresence: presence,
        padSampleRootBpms: { ...padSampleRootBpmsLiveRef.current },
        padSampleLabels: { ...padSampleLabelsLiveRef.current },
        selectedPad: selectedPadLiveRef.current,
        producerKitId: producerKitIdLiveRef.current,
        beatPadsSpreadTrack: beatPadsSpreadTrackLiveRef.current,
        beatPadsSpreadVoice: beatPadsSpreadVoiceRef.current,
      });
    };
  }, [trackId]);

  const queuePadStoreChanged = useCallback(() => {
    if (!onPadStoreChangedRef.current) return;
    if (padStoreNotifyTimerRef.current) clearTimeout(padStoreNotifyTimerRef.current);
    padStoreNotifyTimerRef.current = setTimeout(() => {
      padStoreNotifyTimerRef.current = null;
      onPadStoreChangedRef.current?.();
    }, 150);
  }, []);

  useEffect(
    () => () => {
      if (padStoreNotifyTimerRef.current) clearTimeout(padStoreNotifyTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    setProducerKitId(producerKitIdProp);
  }, [producerKitIdProp]);

  /** Never leave "Load kit" stuck if decode/network hangs. */
  useEffect(() => {
    if (!producerKitLoading) return;
    const t = setTimeout(() => {
      setProducerKitLoading(false);
      setLoadingProducerKitId(null);
    }, 90_000);
    return () => clearTimeout(t);
  }, [producerKitLoading]);

  useEffect(() => {
    setLoadedPatternPresetId(matchedPresetId ?? null);
  }, [matchedPresetId, trackId]);

  useEffect(() => {
    const next = Math.max(0, Math.min(15, Math.round(kickTargetPad)));
    setSelectedPad(next);
  }, [kickTargetPad, trackId]);

  const handleSelectPad = useCallback(
    (padIndex: number) => {
      const pi = Math.max(0, Math.min(15, Math.round(padIndex)));
      setSelectedPad(pi);
      kickTargetPadRef.current = pi;
      onKickTargetPadChange?.(pi);
    },
    [onKickTargetPadChange],
  );

  useEffect(() => {
    void ensureCtx().then((ctx) => {
      audioCtxRef.current = ctx;
    });
  }, [ensureCtx, trackId]);

  useEffect(() => {
    for (let pi = 0; pi < 16; pi += 1) {
      const vk = se2VoiceKey(trackId, pi);
      padDrumVoiceOptsRef.current[vk] = clampBeatLabDrumPadVoiceOpts({}, pi);
    }
  }, [trackId]);

  useEffect(() => {
    let cancelled = false;
    const store = loadSe2BeatPadsPadStore();
    const prefix = `${trackId}_`;
    const keys = Object.keys(store).filter((k) => k.startsWith(prefix));
    void (async () => {
      const ctx = await ensureCtx();
      audioCtxRef.current = ctx;
      const nextPresence: Record<string, boolean> = {};
      const nextRoots: Record<string, number> = {};
      const nextLabels: Record<string, string> = {};
      for (const k of keys) {
        if (cancelled) return;
        try {
          const st = store[k]!;
          const ab = storedToArrayBuffer(st);
          const buf = await ctx.decodeAudioData(ab.slice(0));
          if (cancelled) return;
          padSampleBuffersRef.current.set(k, buf);
          const samp = samplerOptsFromStored(st);
          const fx = fxRackFromStored(st);
          padSamplePlaybackOptsRef.current[k] = samp;
          padSampleFxRackRef.current[k] = fx;
          const padIndex = Number(k.slice(prefix.length));
          if (Number.isFinite(padIndex)) {
            setSe2BeatPadsLivePadShaping(trackId, padIndex, samp, fx);
          }
          const chromMeta = chromaticPadMetaFromStored(st);
          if (chromMeta) {
            padSampleRootMidiRef.current[k] = chromMeta.rootMidi;
            padSampleChromaticRef.current[k] = true;
            if (typeof chromMeta.strikeMidi === 'number') {
              padSampleStrikeMidiRef.current[k] = chromMeta.strikeMidi;
            }
          }
          nextPresence[k] = true;
          const rb = st.rootBpm;
          if (typeof rb === 'number' && rb > 0) nextRoots[k] = rb;
          const lb = typeof st.label === 'string' ? st.label.trim() : '';
          if (lb) nextLabels[k] = lb;
        } catch {
          /* skip corrupt */
        }
      }
      if (!cancelled) {
        setPadSamplePresence((prev) => ({ ...prev, ...nextPresence }));
        setPadSampleRootBpms((prev) => ({ ...prev, ...nextRoots }));
        setPadSampleLabels((prev) => ({ ...prev, ...nextLabels }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trackId, ensureCtx]);

  const persistPadRow = useCallback((padIndex: number, stored: StoredPadSample) => {
    const k = se2BeatPadsPadKey(trackIdRef.current, padIndex);
    padStorePersistRef.current = padStorePersistRef.current
      .then(() => {
        const store = loadSe2BeatPadsPadStore();
        store[k] = stored;
        saveSe2BeatPadsPadStore(store);
        queuePadStoreChanged();
      })
      .catch(() => {});
  }, [queuePadStoreChanged]);

  const playPadSound = useCallback(
    (
      pi: number,
      vel: number,
      when?: number,
      notePitchSemi = 0,
      playOpts?: {
        tempoSyncRate?: number;
        beatPadVoice?: BeatLabDrumPadVoiceOpts;
        midiNote?: number;
      },
    ) => {
      const run = (ctx: AudioContext) => {
        const isManual = when === undefined;
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => {});
        }
        const now = ctx.currentTime;
        const scheduleWhen = isManual ? now : Math.max(when!, now + 0.001);
        const rawVelocity = Math.max(0, Math.min(1, vel / 127));
        if (rawVelocity <= 0.02) return;
        const shapedVelocity = Math.pow(rawVelocity, 0.7);
        const safeVelocity = Math.round(Math.max(0.12, Math.min(1, shapedVelocity)) * 127);
        const key = se2BeatPadsPadKey(trackIdRef.current, pi);
        const buf = padSampleBuffersRef.current.get(key);
        if (!buf) return;
        const rate =
          typeof playOpts?.tempoSyncRate === 'number' && playOpts.tempoSyncRate > 0
            ? Math.min(4, Math.max(0.25, playOpts.tempoSyncRate))
            : 1;
        const useTimeStretch = rate !== 1;
        let bag = padSampleActiveStoppersRef.current.get(key);
        if (!bag) {
          bag = new Set();
          padSampleActiveStoppersRef.current.set(key, bag);
        }
        if (isManual && bag.size > 0) {
          const entries = Array.from(bag);
          for (let i = 0; i < entries.length; i += 1) {
            try {
              entries[i]!.stop();
            } catch {
              /* */
            }
          }
        }
        let sampOpts = padSamplePlaybackOptsRef.current[key] ?? defaultPadSamplerPlaybackOpts();
        if (playOpts?.beatPadVoice) {
          sampOpts = beatLabDrumVoiceToSamplerOpts(playOpts.beatPadVoice, { ...sampOpts });
        }
        const chromatic = padSampleChromaticRef.current[key] === true;
        const rootMidi = padSampleRootMidiRef.current[key] ?? 60;
        let chromaticDetuneCents = 0;
        const useTimeStretchLocal = chromatic ? true : useTimeStretch;
        let optsWithPitch: PadSamplerPlaybackOpts;
        if (chromatic) {
          const defaultStrike = padSampleStrikeMidiRef.current[key] ?? rootMidi;
          const targetMidi =
            typeof playOpts?.midiNote === 'number' && Number.isFinite(playOpts.midiNote)
              ? Math.max(0, Math.min(127, Math.round(playOpts.midiNote)))
              : defaultStrike;
          const fine = sampOpts.fineSemi ?? 0;
          const keyLockSemi = pi === kickTargetPadRef.current ? kickKeySemiRef.current : 0;
          chromaticDetuneCents = (targetMidi - rootMidi + fine + keyLockSemi) * 100;
          chromaticDetuneCents = Math.max(-12000, Math.min(12000, chromaticDetuneCents));
          optsWithPitch = { ...sampOpts, fineSemi: 0 };
        } else {
          const keyLockSemi = pi === kickTargetPadRef.current ? kickKeySemiRef.current : 0;
          optsWithPitch = {
            ...sampOpts,
            fineSemi: Math.max(-12, Math.min(12, (sampOpts.fineSemi ?? 0) + notePitchSemi + keyLockSemi)),
          };
        }
        const fxRack = padSampleFxRackRef.current[key] ?? defaultPadSamplerFxRack();
        // Prefer track strip; fall back to master so VocalBox Pvw / pad taps stay audible
        // when insert FX / transport-lock briefly returns a null strip input.
        const stripIn = getTrackStripInput?.() ?? null;
        const masterOut = getMasterOutput?.() ?? null;
        const outNode = stripIn ?? masterOut ?? undefined;
        const voiceStop = playPadSampleBuffer(
          ctx,
          buf,
          1,
          safeVelocity,
          scheduleWhen,
          { 1: trackVolumeRef.current },
          rate,
          () => {
            bag!.delete(voiceEntry);
            if (bag!.size === 0) padSampleActiveStoppersRef.current.delete(key);
          },
          optsWithPitch,
          useTimeStretchLocal,
          fxRack,
          Math.max(1, sessionBpm ?? bpmRef.current),
          isManual,
          chromaticDetuneCents,
          {
            outputNode: outNode,
            skipMeter: true,
            registerSe2VuTap: true,
            outputGain: getSe2BeatPadsMainVolume(),
          },
        );
        const voiceEntry = { stop: voiceStop, when: scheduleWhen };
        bag.add(voiceEntry);
      };

      const existing = audioCtxRef.current;
      if (existing && existing.state !== 'closed') {
        run(existing);
        return;
      }
      void ensureCtx().then((ctx) => {
        audioCtxRef.current = ctx;
        run(ctx);
      });
    },
    [ensureCtx, getMasterOutput, getTrackStripInput, sessionBpm],
  );

  const onStrikePad = useCallback(
    (padIndex: number, velocity01: number, gridCol?: number, whenSec?: number) => {
      const vk = se2VoiceKey(trackIdRef.current, padIndex);
      const voice = padDrumVoiceOptsRef.current[vk] ?? defaultBeatLabDrumPadVoiceOpts(padIndex);
      const vel =
        gridCol != null
          ? beatLabDrumVoiceGridVelocity(voice, gridCol)
          : beatLabDrumVoiceManualVelocity(voice, velocity01);
      const offsetSec =
        gridCol != null ? beatLabDrumVoiceScheduleOffsetSec(voice, gridCol) : 0;

      const schedule = (ctx: AudioContext) => {
        audioCtxRef.current = ctx;
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => {});
        }
        const when =
          whenSec != null
            ? whenSec + offsetSec
            : gridCol != null
              ? ctx.currentTime + Math.max(0.002, offsetSec)
              : undefined;
        playPadSound(padIndex, vel, when, 0, { beatPadVoice: voice });
      };

      const existing = audioCtxRef.current;
      if (existing && existing.state !== 'closed') {
        schedule(existing);
        return;
      }
      void ensureCtx().then(schedule);
    },
    [ensureCtx, playPadSound],
  );

  const padLabelForPad = useCallback(
    (padIndex: number) => padSampleLabels[se2BeatPadsPadKey(trackId, padIndex)],
    [padSampleLabels, trackId],
  );

  const hasPadSample = useCallback(
    (padIndex: number) => {
      const k = se2BeatPadsPadKey(trackId, padIndex);
      return Boolean(padSamplePresence[k] || padSampleBuffersRef.current.get(k));
    },
    [padSamplePresence, trackId],
  );

  const getDrumPadVoice = useCallback(
    (padIndex: number) =>
      padDrumVoiceOptsRef.current[se2VoiceKey(trackId, padIndex)] ??
      defaultBeatLabDrumPadVoiceOpts(padIndex),
    [trackId],
  );

  const commitDrumPadVoice = useCallback((padIndex: number, voice: BeatLabDrumPadVoiceOpts) => {
    padDrumVoiceOptsRef.current[se2VoiceKey(trackIdRef.current, padIndex)] =
      clampBeatLabDrumPadVoiceOpts(voice, padIndex);
  }, []);

  const getPadSamplerOpts = useCallback(
    (padIndex: number) =>
      padSamplePlaybackOptsRef.current[se2BeatPadsPadKey(trackId, padIndex)] ??
      defaultPadSamplerPlaybackOpts(),
    [trackId],
  );

  const commitPadSamplerOpts = useCallback(
    (padIndex: number, o: PadSamplerPlaybackOpts) => {
      const k = se2BeatPadsPadKey(trackIdRef.current, padIndex);
      padSamplePlaybackOptsRef.current[k] = o;
      setSe2BeatPadsLivePadShaping(
        trackIdRef.current,
        padIndex,
        o,
        padSampleFxRackRef.current[k] ?? defaultPadSamplerFxRack(),
      );
      const store = loadSe2BeatPadsPadStore();
      const row = store[k];
      if (row) {
        writeSamplerOptsToStored(row, o);
        store[k] = row;
        saveSe2BeatPadsPadStore(store);
        queuePadStoreChanged();
      }
    },
    [queuePadStoreChanged],
  );

  const getPadSamplerFxRack = useCallback(
    (padIndex: number) =>
      padSampleFxRackRef.current[se2BeatPadsPadKey(trackId, padIndex)] ?? defaultPadSamplerFxRack(),
    [trackId],
  );

  const commitPadSamplerFxRack = useCallback((padIndex: number, rack: PadSamplerFxRack) => {
    const k = se2BeatPadsPadKey(trackIdRef.current, padIndex);
    padSampleFxRackRef.current[k] = clonePadSamplerFxRack(rack);
    setSe2BeatPadsLivePadShaping(
      trackIdRef.current,
      padIndex,
      padSamplePlaybackOptsRef.current[k] ?? defaultPadSamplerPlaybackOpts(),
      rack,
    );
    const store = loadSe2BeatPadsPadStore();
    const row = store[k];
    if (row) {
      writeFxRackToStored(row, rack);
      store[k] = row;
      saveSe2BeatPadsPadStore(store);
      queuePadStoreChanged();
    }
  }, [queuePadStoreChanged]);

  const getPadSampleAudioBuffer = useCallback(
    (padIndex: number) => padSampleBuffersRef.current.get(se2BeatPadsPadKey(trackId, padIndex)),
    [trackId],
  );

  const ingestPadSample = useCallback(
    async (file: File, pad: number, label?: string) => {
      const ctx = await ensureCtx();
      audioCtxRef.current = ctx;
      const storedBase = await fileToStoredPadSample(file);
      const stored = { ...storedBase, rootBpm: bpmRef.current };
      const display = (label ?? stored.label ?? '').trim();
      if (display) stored.label = display;
      const ab = storedToArrayBuffer(stored);
      const buffer = await ctx.decodeAudioData(ab.slice(0));
      const k = se2BeatPadsPadKey(trackIdRef.current, pad);
      padSampleBuffersRef.current.set(k, buffer);
      setPadSamplePresence((prev) => ({ ...prev, [k]: true }));
      setPadSampleRootBpms((prev) => ({ ...prev, [k]: bpmRef.current }));
      if (display) setPadSampleLabels((prev) => ({ ...prev, [k]: display }));
      writeSamplerOptsToStored(stored, defaultPadSamplerPlaybackOpts());
      writeFxRackToStored(stored, defaultPadSamplerFxRack());
      padSamplePlaybackOptsRef.current[k] = samplerOptsFromStored(stored);
      padSampleFxRackRef.current[k] = defaultPadSamplerFxRack();
      persistPadRow(pad, stored);
    },
    [ensureCtx, persistPadRow],
  );

  const onLoadPad = useCallback((padIndex: number) => {
    pendingPadSampleRef.current = padIndex;
    padSampleFileInputRef.current?.click();
  }, []);

  const handlePadSampleFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      const padRaw = pendingPadSampleRef.current;
      pendingPadSampleRef.current = null;
      if (padRaw == null || !file) return;
      const pad = Math.max(0, Math.min(15, Math.floor(Number(padRaw))));
      try {
        await ingestPadSample(file, pad);
        playPadSound(pad, PAD_VEL[pad] ?? 100);
      } catch {
        /* */
      }
    },
    [ingestPadSample, playPadSound],
  );

  const snapshotTrackKitPads = useCallback((): Record<string, StoredPadSample> => {
    const out: Record<string, StoredPadSample> = {};
    const store = loadSe2BeatPadsPadStore();
    for (let pi = 0; pi < 16; pi += 1) {
      const k = se2BeatPadsPadKey(trackIdRef.current, pi);
      const fromStore = store[k];
      const buffer = padSampleBuffersRef.current.get(k);
      if (!buffer && !fromStore) continue;
      if (buffer) {
        const label = padSampleLabels[k] ?? `Pad ${pi + 1}`;
        const root = padSampleRootBpms[k] ?? bpmRef.current;
        const row = audioBufferToStoredKitSample(buffer, label, root);
        writeSamplerOptsToStored(
          row,
          padSamplePlaybackOptsRef.current[k] ?? defaultPadSamplerPlaybackOpts(),
        );
        writeChromaticPadMetaToStored(
          row,
          padSampleRootMidiRef.current[k],
          padSampleChromaticRef.current[k],
          padSampleStrikeMidiRef.current[k],
        );
        writeFxRackToStored(row, padSampleFxRackRef.current[k] ?? defaultPadSamplerFxRack());
        out[String(pi)] = row;
      } else if (fromStore) {
        out[String(pi)] = fromStore;
      }
    }
    return out;
  }, [padSampleLabels, padSampleRootBpms]);

  const applyKitPadsToTrack = useCallback(
    async (pads: Record<string, StoredPadSample>) => {
      const ctx = await ensureCtx();
      audioCtxRef.current = ctx;
      let loaded = 0;
      const storeBatch = loadSe2BeatPadsPadStore();
      const nextPresence: Record<string, boolean> = {};
      const nextLabels: Record<string, string> = {};
      const nextRoots: Record<string, number> = {};
      for (const [piStr, row] of Object.entries(pads)) {
        const pi = Number(piStr);
        if (!Number.isFinite(pi) || pi < 0 || pi > 15) continue;
        try {
          const ab = storedToArrayBuffer(row);
          const buffer = await ctx.decodeAudioData(ab.slice(0));
          const k = se2BeatPadsPadKey(trackIdRef.current, pi);
          padSampleBuffersRef.current.set(k, buffer);
          padSamplePlaybackOptsRef.current[k] = samplerOptsFromStored(row);
          padSampleFxRackRef.current[k] = fxRackFromStored(row);
          const chromMeta = chromaticPadMetaFromStored(row);
          if (chromMeta) {
            padSampleRootMidiRef.current[k] = chromMeta.rootMidi;
            padSampleChromaticRef.current[k] = true;
            if (typeof chromMeta.strikeMidi === 'number') {
              padSampleStrikeMidiRef.current[k] = chromMeta.strikeMidi;
            } else {
              delete padSampleStrikeMidiRef.current[k];
            }
          } else {
            delete padSampleRootMidiRef.current[k];
            delete padSampleStrikeMidiRef.current[k];
            delete padSampleChromaticRef.current[k];
          }
          storeBatch[k] = row;
          nextPresence[k] = true;
          const lb = typeof row.label === 'string' ? row.label.trim() : '';
          if (lb) nextLabels[k] = lb;
          const rb = row.rootBpm;
          if (typeof rb === 'number' && rb > 0) nextRoots[k] = rb;
          loaded += 1;
        } catch {
          /* */
        }
      }
      if (loaded > 0) {
        saveSe2BeatPadsPadStore(storeBatch);
        setPadSamplePresence((prev) => ({ ...prev, ...nextPresence }));
        setPadSampleLabels((prev) => ({ ...prev, ...nextLabels }));
        setPadSampleRootBpms((prev) => ({ ...prev, ...nextRoots }));
        queuePadStoreChanged();
      }
      return loaded;
    },
    [ensureCtx, queuePadStoreChanged],
  );

  const handleKitSelectChange = useCallback(
    (value: string) => {
      setKitSelectValue(value);
      if (value.startsWith('saved:')) {
        void (async () => {
          const saved = findBeatLabSavedKit(savedKits, value.slice(6));
          if (!saved) return;
          const loaded = await applyKitPadsToTrack(saved.pads);
          if (loaded > 0) {
            setKitLabel(saved.name);
            setSaveKitStatus(`Loaded "${saved.name}" (${loaded} pads)`);
          }
        })();
      } else if (value.startsWith('preset:')) {
        setKitLabel(value.slice(7));
      }
    },
    [applyKitPadsToTrack, savedKits],
  );

  const handleSaveKit = useCallback(
    async (rawName: string) => {
      await padStorePersistRef.current.catch(() => {});
      const pads = snapshotTrackKitPads();
      const n = countSavedKitPads(pads);
      if (n === 0) {
        setSaveKitStatus('Load at least one pad sample first');
        return;
      }
      const { kits, kit: saved } = upsertBeatLabSavedKit(savedKits, rawName, pads);
      setSavedKits(kits);
      setKitLabel(saved.name);
      setKitSelectValue(`saved:${saved.id}`);
      setSaveKitStatus(`Saved ${n} pad${n === 1 ? '' : 's'}`);
    },
    [savedKits, snapshotTrackKitPads],
  );

  const beginOpenTrapKitBrowser = useCallback(() => {
    trapKitFolderInputRef.current?.click();
  }, []);

  const handleTrapKitFolder = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    e.target.value = '';
    if (!list?.length) return;
    const files = Array.from(list).filter((f) =>
      /\.(wav|mp3|ogg|flac|m4a|aac|aif|aiff)$/i.test(f.name),
    );
    if (files.length === 0) return;
    setTrapKitBrowserFiles(files);
    setTrapKitBrowserOpen(true);
  }, []);

  const loadTrapKitSampleToPad = useCallback(
    async (file: File, pad: number, label: string) => {
      try {
        await ingestPadSample(file, pad, label);
        const opts = trapPadSamplerOpts(pad);
        commitPadSamplerOpts(pad, opts);
        handleSelectPad(pad);
        playPadSound(pad, PAD_VEL[pad] ?? 100);
      } catch {
        /* */
      }
    },
    [commitPadSamplerOpts, handleSelectPad, ingestPadSample, playPadSound],
  );

  const onPatternPresetHighlighted = useCallback((preset: PatternPreset) => {
    const bankId = beatLabPatternBankIdForPresetGenre(preset.genre);
    if (bankId) {
      setLoadedPatternBankId(bankId);
      setLoadedPatternPresetId(preset.id);
    }
    onMatchedPresetIdChange?.(preset.id);
  }, [onMatchedPresetIdChange]);

  const undoSpreadHitToPads = useCallback(() => {
    beatPadsSpreadVoiceRef.current = null;
    setBeatPadsSpreadTrack(null);
  }, []);

  const applySpreadHitToPads = useCallback(
    async (
      sourcePad: number,
      direction: BeatPadsSpreadDirection,
      gridStepsPerBar: import('@/app/lib/creationStation/beatLabDrumMachineSequencer').BeatPadsGridStepsPerBar = 16,
    ) => {
      const srcKey = se2BeatPadsPadKey(trackIdRef.current, sourcePad);
      const buf = padSampleBuffersRef.current.get(srcKey);
      if (!buf) return;
      const srcOpts = padSamplePlaybackOptsRef.current[srcKey] ?? defaultPadSamplerPlaybackOpts();
      const fxTemplate = clonePadSamplerFxRack(
        padSampleFxRackRef.current[srcKey] ?? defaultPadSamplerFxRack(),
      );
      const rootBpm = padSampleRootBpms[srcKey] ?? bpmRef.current;
      const label = padSampleLabels[srcKey] ?? `Pad ${sourcePad + 1}`;
      const voice = buildBeatPadsSpreadVoiceFromPad({
        buffer: buf,
        label,
        rootMidi: padSampleRootMidiRef.current[srcKey],
        chromatic: padSampleChromaticRef.current[srcKey],
        sampler: srcOpts,
        fx: fxTemplate,
        rootBpm,
        direction,
        mixerChannel: beatPadsSpreadTrack?.mixerChannel ?? BEAT_PADS_SPREAD_MIXER_CH,
      });
      beatPadsSpreadVoiceRef.current = voice;
      const tracks = harmonyTracksRef.current ?? [];
      const lanePad = Math.max(2, String(tracks.length).length);
      const defaultHarmonyIdx = se2BeatPadsSpreadDefaultMatchTrackIndex(
        tracks,
        trackIdRef.current,
        lanePad,
      );
      const stored = audioBufferToStoredKitSample(buf, voice.baseLabel, rootBpm);
      writeSamplerOptsToStored(stored, voice.sampler);
      writeFxRackToStored(stored, fxTemplate);
      writeChromaticPadMetaToStored(stored, voice.rootMidi, true);
      setBeatPadsSpreadTrack((prev) => ({
        bank: 0,
        sourcePad,
        direction,
        rootMidi: voice.rootMidi,
        baseLabel: voice.baseLabel,
        loopBars: prev?.loopBars ?? 8,
        stepsPerBar: gridStepsPerBar,
        mixerChannel: prev?.mixerChannel ?? BEAT_PADS_SPREAD_MIXER_CH,
        keyLockEnabled: prev?.keyLockEnabled ?? false,
        harmonyTrackIndex: prev?.harmonyTrackIndex ?? defaultHarmonyIdx,
        notes: prev?.notes ?? [],
        sample: stored,
      }));
    },
    [padSampleLabels, padSampleRootBpms, beatPadsSpreadTrack?.mixerChannel],
  );

  const strikeBeatPadsSpreadRow = useCallback(
    (row: number, gridCol = 0, whenSec?: number) => {
      const voice = beatPadsSpreadVoiceRef.current;
      const spread = beatPadsSpreadTrack;
      if (!voice) return;
      void ensureCtx().then((ctx) => {
        const when = whenSec ?? ctx.currentTime + 0.002;
        const ch = clampBeatPadsSpreadMixerChannel(voice.mixerChannel);
        const tracks = harmonyTracksRef.current;
        const trackIdx = spread?.harmonyTrackIndex;
        const harmonyTrack = trackIdx != null ? tracks?.[trackIdx] : undefined;
        const keyLockSemi = se2BeatPadsSpreadKeyLockSemiAtCol({
          voiceRootMidi: voice.rootMidi,
          track: harmonyTrack,
          gridCol,
          stepsPerBar: spread?.stepsPerBar ?? 16,
          loopBars: spread?.loopBars ?? 8,
          beatsPerBar: beatsPerBarRef.current,
          keyLockEnabled: spread?.keyLockEnabled ?? false,
          songKeyRoot: songKeyRootRef.current,
          songKeyMode: songKeyModeRef.current,
        });
        playBeatPadsSpreadRow(
          ctx,
          voice,
          row,
          100,
          when,
          { [ch]: trackVolumeRef.current ?? 100 },
          false,
          keyLockSemi,
          {
            outputNode: getTrackStripInput?.() ?? undefined,
            skipMeter: true,
            registerSe2VuTap: true,
            outputGain: getSe2BeatPadsMainVolume(),
          },
        );
      });
    },
    [beatPadsSpreadTrack, ensureCtx, getTrackStripInput],
  );

  const generateSpreadChordNotesForTrack = useCallback(
    (spread: BeatPadsSpreadTrackState, variationSeed?: number) => {
      const voice = beatPadsSpreadVoiceRef.current;
      if (!voice) return spread.notes;
      const tracks = harmonyTracksRef.current;
      const trackIdx = spread.harmonyTrackIndex;
      const harmonyTrack = trackIdx != null ? tracks?.[trackIdx] : undefined;
      const generated = generateBeatPadsSpreadChordRootNotes({
        voiceRootMidi: voice.rootMidi,
        direction: spread.direction,
        loopBars: spread.loopBars,
        stepsPerBar: spread.stepsPerBar,
        keyLockEnabled: spread.keyLockEnabled ?? false,
        variationSeed: variationSeed ?? spreadChordGenSeedRef.current,
        harmonyTrack,
        beatsPerBar: beatsPerBarRef.current,
        songKeyRoot: songKeyRootRef.current,
        songKeyMode: songKeyModeRef.current,
      });
      return generated.length > 0 ? generated : spread.notes;
    },
    [],
  );

  const handleBeatPadsSpreadNotesChange = useCallback((notes: BeatPadsSpreadNote[]) => {
    setBeatPadsSpreadTrack((prev) => (prev ? { ...prev, notes } : prev));
  }, []);

  const handleBeatPadsSpreadLoopBarsChange = useCallback((loopBars: BeatPadsSpreadLoopBars) => {
    setBeatPadsSpreadTrack((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        loopBars,
        notes: beatPadsSpreadClampNotesToLoop(prev.notes, loopBars, prev.stepsPerBar),
      };
      if (next.keyLockEnabled) {
        next.notes = generateSpreadChordNotesForTrack(next);
      }
      return next;
    });
  }, [generateSpreadChordNotesForTrack]);

  const handleBeatPadsSpreadGridStepsPerBarChange = useCallback(
    (stepsPerBar: import('@/app/lib/creationStation/beatLabDrumMachineSequencer').BeatPadsGridStepsPerBar) => {
      setBeatPadsSpreadTrack((prev) => {
        if (!prev || prev.stepsPerBar === stepsPerBar) return prev;
        return {
          ...prev,
          stepsPerBar,
          notes: beatPadsSpreadConvertNotesGridSteps(prev.notes, prev.loopBars, prev.stepsPerBar, stepsPerBar),
        };
      });
    },
    [],
  );

  const handleBeatPadsSpreadDirectionChange = useCallback(
    (direction: BeatPadsSpreadDirection) => {
      const voice = beatPadsSpreadVoiceRef.current;
      if (voice) beatPadsSpreadVoiceRef.current = { ...voice, direction };
      setBeatPadsSpreadTrack((prev) => {
        if (!prev) return prev;
        const next = { ...prev, direction };
        if (next.keyLockEnabled) {
          next.notes = generateSpreadChordNotesForTrack(next);
        }
        return next;
      });
    },
    [generateSpreadChordNotesForTrack],
  );

  const handleBeatPadsSpreadMixerChannelChange = useCallback((mixerChannel: number) => {
    const ch = clampBeatPadsSpreadMixerChannel(mixerChannel);
    const voice = beatPadsSpreadVoiceRef.current;
    if (voice) beatPadsSpreadVoiceRef.current = { ...voice, mixerChannel: ch };
    setBeatPadsSpreadTrack((prev) => (prev ? { ...prev, mixerChannel: ch } : prev));
  }, []);

  const handleBeatPadsSpreadKeyLockChange = useCallback(
    (enabled: boolean) => {
      setBeatPadsSpreadTrack((prev) => {
        if (!prev) return prev;
        const next = { ...prev, keyLockEnabled: enabled };
        if (enabled) {
          spreadChordGenSeedRef.current = 0;
          next.notes = generateSpreadChordNotesForTrack(next, 0);
        }
        return next;
      });
    },
    [generateSpreadChordNotesForTrack],
  );

  const handleBeatPadsSpreadHarmonyTrackIndexChange = useCallback(
    (trackIndex: number) => {
      setBeatPadsSpreadTrack((prev) => {
        if (!prev) return prev;
        const next = { ...prev, harmonyTrackIndex: trackIndex };
        if (next.keyLockEnabled) {
          next.notes = generateSpreadChordNotesForTrack(next);
        }
        return next;
      });
    },
    [generateSpreadChordNotesForTrack],
  );

  const handleBeatPadsSpreadRegenerateChordRoots = useCallback(() => {
    spreadChordGenSeedRef.current += 1;
    setBeatPadsSpreadTrack((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        notes: generateSpreadChordNotesForTrack(prev, spreadChordGenSeedRef.current),
      };
    });
  }, [generateSpreadChordNotesForTrack]);

  const spreadSe2MatchTrackOptions = useMemo(() => {
    if (!harmonyTracks?.length) return undefined;
    const lanePad = Math.max(2, String(harmonyTracks.length).length);
    return se2BeatPadsSpreadMatchTrackOptions(harmonyTracks, trackId, lanePad).map(
      ({ trackIndex, label }) => ({ trackIndex, label }),
    );
  }, [harmonyTracks, trackId]);

  useEffect(() => {
    if (!beatPadsSpreadTrack || !spreadSe2MatchTrackOptions?.length) return;
    const resolved = se2BeatPadsSpreadResolveMatchTrackIndex(
      spreadSe2MatchTrackOptions,
      beatPadsSpreadTrack.harmonyTrackIndex,
    );
    if (resolved == null) return;
    if (beatPadsSpreadTrack.harmonyTrackIndex === resolved) return;
    handleBeatPadsSpreadHarmonyTrackIndexChange(resolved);
  }, [
    beatPadsSpreadTrack,
    beatPadsSpreadTrack?.harmonyTrackIndex,
    spreadSe2MatchTrackOptions,
    handleBeatPadsSpreadHarmonyTrackIndexChange,
  ]);

  const beatPadsSpreadKeyLabel = useMemo(() => {
    const keyName = KEY_ROOTS.find((k) => k.value === songKeyRoot)?.label ?? '?';
    const trackIdx = beatPadsSpreadTrack?.harmonyTrackIndex;
    const tr = trackIdx != null ? harmonyTracks?.[trackIdx] : undefined;
    const lanePad = Math.max(2, String(harmonyTracks?.length ?? 0).length);
    const trLabel = tr
      ? se2TrackNumberedName(tr.laneNumber, tr.name ?? 'Track', lanePad)
      : 'track';
    return `${trLabel} · ${keyName} ${MODE_LABELS[songKeyMode]}`;
  }, [
    beatPadsSpreadTrack?.harmonyTrackIndex,
    harmonyTracks,
    songKeyRoot,
    songKeyMode,
  ]);

  const applyProducerKit = useCallback(
    async (kitIdOverride?: BeatLabProducerKitId) => {
      const kitToLoad = kitIdOverride ?? producerKitId;
      const meta = beatLabProducerKitMeta(kitToLoad);
      if (!meta) return;
      if (kitIdOverride != null) {
        setProducerKitId(kitToLoad);
        onProducerKitIdChange?.(kitToLoad);
      }
      const loadGen = ++producerKitLoadGenRef.current;
      const ctx = await ensureCtx();
      if (loadGen !== producerKitLoadGenRef.current) return;
      setProducerKitLoading(true);
      setLoadingProducerKitId(kitToLoad);
      try {
        const pads = await ensureBeatLabProducerKitLoaded(kitToLoad, ctx);
        if (loadGen !== producerKitLoadGenRef.current) return;
        if (pads.length === 0) return;
        const defaultFx = defaultPadSamplerFxRack();
        const nextPresence: Record<string, boolean> = {};
        const nextRoots: Record<string, number> = {};
        const nextLabels: Record<string, string> = {};
        const storeBatch = loadSe2BeatPadsPadStore();
        for (const { pad, buffer, label, sampler, rootMidi, chromatic } of pads) {
          const k = se2BeatPadsPadKey(trackIdRef.current, pad);
          padSampleBuffersRef.current.set(k, buffer);
          nextPresence[k] = true;
          nextRoots[k] = bpmRef.current;
          nextLabels[k] = label;
          padSamplePlaybackOptsRef.current[k] = sampler;
          padSampleFxRackRef.current[k] = defaultFx;
          setSe2BeatPadsLivePadShaping(trackIdRef.current, pad, sampler, defaultFx);
          if (chromatic) {
            padSampleChromaticRef.current[k] = true;
            padSampleRootMidiRef.current[k] = typeof rootMidi === 'number' ? rootMidi : 60;
          }
          const stored = audioBufferToStoredKitSample(buffer, label, bpmRef.current);
          writeSamplerOptsToStored(stored, sampler);
          writeFxRackToStored(stored, defaultFx);
          if (chromatic && typeof rootMidi === 'number') {
            writeChromaticPadMetaToStored(stored, rootMidi, true);
          }
          storeBatch[k] = stored;
        }
        saveSe2BeatPadsPadStore(storeBatch);
        setPadSamplePresence((prev) => ({ ...prev, ...nextPresence }));
        setPadSampleRootBpms((prev) => ({ ...prev, ...nextRoots }));
        setPadSampleLabels((prev) => ({ ...prev, ...nextLabels }));
        queuePadStoreChanged();
      } finally {
        if (loadGen === producerKitLoadGenRef.current) {
          setProducerKitLoading(false);
          setLoadingProducerKitId(null);
        }
      }
    },
    [ensureCtx, onProducerKitIdChange, producerKitId, queuePadStoreChanged],
  );

  const applyProducerKitRef = useRef(applyProducerKit);
  applyProducerKitRef.current = applyProducerKit;

  /** Empty lane — optional auto kit load (Beat Lab on; SE2 off until user taps Load kit). */
  useEffect(() => {
    if (!autoBootstrapKit) return;
    let cancelled = false;
    void (async () => {
      await ensureCtx();
      if (cancelled) return;
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      if (cancelled) return;
      const prefix = `${trackId}_`;
      const hasBuffers = Array.from(padSampleBuffersRef.current.keys()).some((k) => k.startsWith(prefix));
      const store = loadSe2BeatPadsPadStore();
      const hasStored = Object.keys(store).some((k) => k.startsWith(prefix));
      if (hasBuffers || hasStored) return;
      await applyProducerKitRef.current(producerKitIdProp);
    })();
    return () => {
      cancelled = true;
    };
  }, [trackId, producerKitIdProp, ensureCtx, autoBootstrapKit]);

  const loadSoundFamilySample = useCallback(
    async (args: { familyId: string; pad: number; label: string; relFile: string }) => {
      const { familyId, pad, label, relFile } = args;
      try {
        const ctx = await ensureCtx();
        const buf = await fetchAndDecodeFamilySample(relFile, ctx);
        const stored = audioBufferToStoredKitSample(buf, label, bpmRef.current);
        const k = se2BeatPadsPadKey(trackIdRef.current, pad);
        padSampleBuffersRef.current.set(k, buf);
        const opts = samplerOptsForFamily(familyId, pad, relFile);
        writeSamplerOptsToStored(stored, opts);
        writeFxRackToStored(stored, defaultPadSamplerFxRack());
        const orchPad =
          familyId === ORCHESTRA_HITS_SOUND_FAMILY_ID ? orchestraHitsPadDefForFile(relFile) : undefined;
        if (orchPad?.chromatic && typeof orchPad.rootMidi === 'number') {
          writeChromaticPadMetaToStored(stored, orchPad.rootMidi, true);
          padSampleRootMidiRef.current[k] = orchPad.rootMidi;
          padSampleChromaticRef.current[k] = true;
        }
        padSamplePlaybackOptsRef.current[k] = samplerOptsFromStored(stored);
        padSampleFxRackRef.current[k] = defaultPadSamplerFxRack();
        persistPadRow(pad, stored);
        setPadSamplePresence((prev) => ({ ...prev, [k]: true }));
        setPadSampleRootBpms((prev) => ({ ...prev, [k]: bpmRef.current }));
        setPadSampleLabels((prev) => ({ ...prev, [k]: label }));
        handleSelectPad(pad);
        playPadSound(pad, PAD_VEL[pad] ?? 100);
      } catch {
        /* */
      }
    },
    [ensureCtx, handleSelectPad, persistPadRow, playPadSound],
  );

  const installPadSampleOnPad = useCallback(
    async (
      targetPad: number,
      buffer: AudioBuffer,
      label: string,
      sampler = defaultPadSamplerPlaybackOpts(),
      chromatic?: boolean,
      rootMidi?: number,
    ): Promise<void> => {
      const ctx = await ensureCtx();
      const stored = audioBufferToStoredKitSample(buffer, label, bpmRef.current);
      writeSamplerOptsToStored(stored, sampler);
      writeFxRackToStored(stored, defaultPadSamplerFxRack());
      const k = se2BeatPadsPadKey(trackIdRef.current, targetPad);
      padSampleBuffersRef.current.set(k, buffer);
      padSamplePlaybackOptsRef.current[k] = sampler;
      padSampleFxRackRef.current[k] = defaultPadSamplerFxRack();
      setSe2BeatPadsLivePadShaping(trackIdRef.current, targetPad, sampler, defaultPadSamplerFxRack());
      if (chromatic && typeof rootMidi === 'number') {
        writeChromaticPadMetaToStored(stored, rootMidi, true);
        padSampleRootMidiRef.current[k] = rootMidi;
        padSampleChromaticRef.current[k] = true;
      } else {
        delete padSampleChromaticRef.current[k];
        delete padSampleRootMidiRef.current[k];
      }
      persistPadRow(targetPad, stored);
      setPadSamplePresence((prev) => ({ ...prev, [k]: true }));
      setPadSampleRootBpms((prev) => ({ ...prev, [k]: bpmRef.current }));
      setPadSampleLabels((prev) => ({ ...prev, [k]: label }));
      handleSelectPad(targetPad);
      playPadSound(targetPad, PAD_VEL[targetPad] ?? 100);
      void ctx;
    },
    [ensureCtx, handleSelectPad, persistPadRow, playPadSound],
  );

  const clonePadSampleToPad = useCallback(
    async (sourcePad: number, targetPad: number): Promise<boolean> => {
      if (sourcePad === targetPad) return true;
      const srcKey = se2BeatPadsPadKey(trackIdRef.current, sourcePad);
      const buf = padSampleBuffersRef.current.get(srcKey);
      if (!buf) return false;
      const label = padSampleLabelsLiveRef.current[srcKey] ?? `Pad ${sourcePad + 1}`;
      const sampler =
        padSamplePlaybackOptsRef.current[srcKey] ?? defaultPadSamplerPlaybackOpts();
      const chromatic = padSampleChromaticRef.current[srcKey];
      const rootMidi = padSampleRootMidiRef.current[srcKey];
      await installPadSampleOnPad(targetPad, buf, label, sampler, chromatic, rootMidi);
      return true;
    },
    [installPadSampleOnPad],
  );

  const applyAutoDrumPadSample = useCallback(
    async (
      targetPad: number,
      query: string,
      role: BeatPadsDrumRole,
    ): Promise<{ applied: boolean; label?: string; source?: string }> => {
      const pi = Math.max(0, Math.min(15, Math.floor(targetPad)));
      const trackPads: { pad: number; label: string }[] = [];
      for (let pad = 0; pad < 16; pad += 1) {
        const k = se2BeatPadsPadKey(trackIdRef.current, pad);
        if (!padSampleBuffersRef.current.get(k) && !padSamplePresence[k]) continue;
        trackPads.push({
          pad,
          label: padSampleLabelsLiveRef.current[k] ?? `Pad ${pad + 1}`,
        });
      }

      const plan = planAutoDrumPadMatch(
        query,
        role,
        trackPads,
        producerKitIdLiveRef.current,
        pi,
      );
      if (!plan) return { applied: false };

      if (plan.kind === 'copyTrackPad') {
        const ok = await clonePadSampleToPad(plan.sourcePad, pi);
        return ok
          ? { applied: true, label: plan.label, source: `Pad ${plan.sourcePad + 1}` }
          : { applied: false };
      }

      try {
        const ctx = await ensureCtx();
        const pads = await ensureBeatLabProducerKitLoaded(plan.kitId, ctx);
        const hit = pads.find((p) => p.pad === plan.kitPad);
        if (!hit) return { applied: false };
        await installPadSampleOnPad(
          pi,
          hit.buffer,
          hit.label,
          hit.sampler,
          hit.chromatic,
          hit.rootMidi,
        );
        return { applied: true, label: hit.label, source: 'kit' };
      } catch {
        return { applied: false };
      }
    },
    [clonePadSampleToPad, ensureCtx, installPadSampleOnPad, padSamplePresence],
  );

  const previewSoundFamilySample = useCallback(
    async (args: { familyId: string; pad: number; relFile: string }) => {
      try {
        const ctx = await ensureCtx();
        const buf = await fetchAndDecodeFamilySample(args.relFile, ctx);
        const when = ctx.currentTime + 0.001;
        playPadSampleBuffer(
          ctx,
          buf,
          1,
          PAD_VEL[args.pad] ?? 100,
          when,
          { 1: trackVolumeRef.current },
          1,
          undefined,
          samplerOptsForFamily(args.familyId, args.pad, args.relFile),
          false,
          defaultPadSamplerFxRack(),
          Math.max(1, bpmRef.current),
          false,
          0,
          {
            outputNode: getTrackStripInput?.() ?? undefined,
            skipMeter: true,
            registerSe2VuTap: true,
            outputGain: getSe2BeatPadsMainVolume(),
          },
        );
      } catch {
        /* */
      }
    },
    [ensureCtx, getTrackStripInput],
  );

  const onLoadBeatPadsPatternKit = useCallback(
    (preset: PatternPreset) => {
      const kitPick = beatLabProducerKitIdForPatternPreset(preset);
      void applyProducerKit(kitPick);
    },
    [applyProducerKit],
  );

  const handleSaveBeatPadsSession = useCallback(
    async (args: {
      name: string;
      pattern: BeatPadsDrumPattern;
      loopBars: number;
      stepsPerBar: BeatPadsGridStepsPerBar;
      bpm: number;
    }) => {
      await padStorePersistRef.current.catch(() => {});
      const kitSnap = { pads: snapshotTrackKitPads(), label: trackIdRef.current };
      const noteCount = countBeatPadsSessionNotes(args.pattern);
      if (noteCount === 0 && Object.keys(kitSnap.pads).length === 0) {
        setBeatPadsSessionSaveStatus('Add pattern steps or load pad sounds first');
        return;
      }
      const { sessions, session, persisted } = upsertBeatPadsSavedSession(
        savedBeatPadsSessions,
        args.name,
        {
          bankIndex: 0,
          loopBars: args.loopBars,
          stepsPerBar: args.stepsPerBar,
          bpm: args.bpm,
          pattern: args.pattern,
          kit: kitSnap,
        },
      );
      setSavedBeatPadsSessions(sessions);
      setBeatPadsSessionSaveStatus(
        persisted ? `Saved "${session.name}"` : 'Saved in session only — storage full',
      );
    },
    [savedBeatPadsSessions, snapshotTrackKitPads],
  );

  const handleLoadBeatPadsSession = useCallback(
    async (id: string) => {
      const row = findBeatPadsSavedSession(savedBeatPadsSessions, id);
      if (!row) return;
      if (row.kit?.pads && Object.keys(row.kit.pads).length > 0) {
        await applyKitPadsToTrack(row.kit.pads);
      }
      setBeatPadsSessionInject({ session: row, nonce: Date.now() });
    },
    [applyKitPadsToTrack, savedBeatPadsSessions],
  );

  const handleRenameBeatPadsSession = useCallback((id: string, name: string) => {
    setSavedBeatPadsSessions(renameBeatPadsSavedSession(savedBeatPadsSessions, id, name));
  }, [savedBeatPadsSessions]);

  const handleDeleteBeatPadsSession = useCallback((id: string) => {
    const next = savedBeatPadsSessions.filter((s) => s.id !== id);
    setSavedBeatPadsSessions(next);
    persistBeatPadsSavedSessions(next);
  }, [savedBeatPadsSessions]);

  const onLivePadFxRackDraft = useCallback((padIndex: number, rack: PadSamplerFxRack) => {
    const k = se2BeatPadsPadKey(trackIdRef.current, padIndex);
    padSampleFxRackRef.current[k] = clonePadSamplerFxRack(rack);
    setSe2BeatPadsLivePadShaping(
      trackIdRef.current,
      padIndex,
      padSamplePlaybackOptsRef.current[k] ?? defaultPadSamplerPlaybackOpts(),
      rack,
    );
  }, []);

  const onLiveSamplerDraft = useCallback((padIndex: number, o: PadSamplerPlaybackOpts) => {
    const k = se2BeatPadsPadKey(trackIdRef.current, padIndex);
    padSamplePlaybackOptsRef.current[k] = o;
    setSe2BeatPadsLivePadShaping(
      trackIdRef.current,
      padIndex,
      o,
      padSampleFxRackRef.current[k] ?? defaultPadSamplerFxRack(),
    );
  }, []);

  const onLiveDrumPadVoiceDraft = useCallback((padIndex: number, voice: BeatLabDrumPadVoiceOpts) => {
    padDrumVoiceOptsRef.current[se2VoiceKey(trackIdRef.current, padIndex)] =
      clampBeatLabDrumPadVoiceOpts(voice, padIndex);
  }, []);

  const onPreviewDrumPad = useCallback(
    (padIndex: number) => {
      playPadSound(padIndex, PAD_VEL[padIndex] ?? 90);
    },
    [playPadSound],
  );

  const onWarmAudio = useCallback(
    async () => {
      const ctx = await ensureCtx();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          /* autoplay */
        }
      }
    },
    [ensureCtx],
  );

  const getAudioContext = useCallback(() => audioCtxRef.current, []);

  const getAudioOutput = useCallback(() => {
    return getMasterOutput?.() ?? getTrackStripInput?.() ?? null;
  }, [getMasterOutput, getTrackStripInput]);

  const onProducerKitIdChangeInternal = useCallback(
    (id: BeatLabProducerKitId) => {
      setProducerKitId(id);
      onProducerKitIdChange?.(id);
    },
    [onProducerKitIdChange],
  );

  const producerKitTribute = beatLabProducerKitMeta(producerKitId)?.tribute ?? null;

  return {
    selectedPad,
    setSelectedPad: handleSelectPad,
    padSampleFileInputRef: padSampleFileInputRef as RefObject<HTMLInputElement>,
    trapKitFolderInputRef: trapKitFolderInputRef as RefObject<HTMLInputElement>,
    handlePadSampleFile,
    handleTrapKitFolder,
    trapKitBrowserOpen,
    trapKitBrowserFiles,
    setTrapKitBrowserOpen,
    loadTrapKitSampleToPad,
    overlayProps: {
      open: true,
      embedded: true,
      se2MeterTrackIndex: trackIndex,
      onClose: onClose ?? (() => {}),
      activeBank: 0,
      selectedPad,
      onSelectPad: handleSelectPad,
      onStrikePad,
      padLabelForPad,
      hasPadSample,
      onLoadPad,
      getDrumPadVoice,
      commitDrumPadVoice,
      onPreviewDrumPad,
      onSpreadHitToPads: applySpreadHitToPads,
      onUndoSpreadHitToPads: undoSpreadHitToPads,
      beatPadsSpreadActive,
      beatPadsSpreadDirection: beatPadsSpreadTrack?.direction ?? 'down',
      beatPadsSpreadRootMidi: beatPadsSpreadTrack?.rootMidi ?? 60,
      beatPadsSpreadBaseLabel: beatPadsSpreadTrack?.baseLabel ?? 'Spread',
      beatPadsSpreadNotes: beatPadsSpreadTrack?.notes ?? [],
      beatPadsSpreadLoopBars: beatPadsSpreadTrack?.loopBars ?? 8,
      beatPadsSpreadStepsPerBar: beatPadsSpreadTrack?.stepsPerBar ?? 16,
      beatPadsSpreadMixerChannel: beatPadsSpreadTrack?.mixerChannel ?? 17,
      beatPadsSpreadKeyLockEnabled: beatPadsSpreadTrack?.keyLockEnabled ?? false,
      beatPadsSpreadKeyLabel: spreadSe2MatchTrackOptions?.length ? beatPadsSpreadKeyLabel : 'key',
      beatPadsSpreadSe2MatchTrackOptions: spreadSe2MatchTrackOptions,
      beatPadsSpreadHarmonyTrackIndex: beatPadsSpreadTrack?.harmonyTrackIndex,
      onBeatPadsSpreadNotesChange: handleBeatPadsSpreadNotesChange,
      onBeatPadsSpreadLoopBarsChange: handleBeatPadsSpreadLoopBarsChange,
      onBeatPadsSpreadDirectionChange: handleBeatPadsSpreadDirectionChange,
      onBeatPadsSpreadMixerChannelChange: handleBeatPadsSpreadMixerChannelChange,
      onBeatPadsSpreadGridStepsPerBarChange: handleBeatPadsSpreadGridStepsPerBarChange,
      onBeatPadsSpreadKeyLockChange: spreadSe2MatchTrackOptions?.length
        ? handleBeatPadsSpreadKeyLockChange
        : undefined,
      onBeatPadsSpreadHarmonyTrackIndexChange: spreadSe2MatchTrackOptions?.length
        ? handleBeatPadsSpreadHarmonyTrackIndexChange
        : undefined,
      onBeatPadsSpreadRegenerateChordRoots: spreadSe2MatchTrackOptions?.length
        ? handleBeatPadsSpreadRegenerateChordRoots
        : undefined,
      onPreviewBeatPadsSpreadRow: (row: number, gridCol?: number) =>
        strikeBeatPadsSpreadRow(row, gridCol),
      onStrikeBeatPadsSpreadRow: strikeBeatPadsSpreadRow,
      onCloseBeatPadsSpread: undoSpreadHitToPads,
      beatLabMixerSpreadActive: beatPadsSpreadActive,
      onWarmAudio,
      kitSelectValue,
      onKitSelectChange: handleKitSelectChange,
      presetKitNames: PRESET_KITS,
      savedKits: savedKits.map((k) => ({ id: k.id, name: k.name })),
      setKit: setKitLabel,
      producerKitId,
      onProducerKitIdChange: onProducerKitIdChangeInternal,
      onLoadProducerKit: () => applyProducerKit(),
      producerKitLoading,
      producerKitTribute,
      onLoadDefaultKitToBank: (kitId: BeatLabProducerKitId) => void applyProducerKit(kitId),
      loadingProducerKitId,
      patternActionsDisabled: disabled,
      onUploadPad: () => onLoadPad(selectedPad),
      onOpenKitBrowser: beginOpenTrapKitBrowser,
      onLoadSoundFamilySample: loadSoundFamilySample,
      onPreviewSoundFamilySample: previewSoundFamilySample,
      onSaveBeatPadsSession: handleSaveBeatPadsSession,
      savedBeatPadsSessions: savedBeatPadsSessions.map((s) => ({
        id: s.id,
        name: s.name,
        savedAt: s.savedAt,
      })),
      beatPadsSessionSaveStatus,
      onLoadBeatPadsSession: handleLoadBeatPadsSession,
      onRenameBeatPadsSession: handleRenameBeatPadsSession,
      onDeleteBeatPadsSession: handleDeleteBeatPadsSession,
      beatPadsSessionInject,
      onBeatPadsSessionInjectConsumed: () => setBeatPadsSessionInject(null),
      onSaveKit: handleSaveKit,
      getPadSamplerOpts,
      commitPadSamplerOpts,
      getPadSamplerFxRack,
      commitPadSamplerFxRack,
      onLivePadFxRackDraft,
      onLiveSamplerDraft,
      onLiveDrumPadVoiceDraft,
      getPadSampleAudioBuffer,
      sessionBpm: sessionBpm ?? bpm,
      getAudioContext,
      getAudioOutput,
      onLoadBeatPadsPatternKit,
      onPatternPresetHighlighted,
      patternSlot,
      onPatternSlotChange: setPatternSlot,
      loadedPatternBankId,
      loadedPatternPresetId,
      patternBankDisabled: disabled,
      onAutoDrumPadSample: applyAutoDrumPadSample,
    },
  };
}
