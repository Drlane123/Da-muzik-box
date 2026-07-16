/**
 * SE2 transport — play Beat Pads lane MIDI with the same per-track samples as the Beat Pads machine.
 */
import { playPadSampleBuffer } from '@/app/lib/creationStation/padSamplePlayback';
import {
  clonePadSamplerFxRack,
  defaultPadSamplerFxRack,
  fxRackFromStored,
  type PadSamplerFxRack,
} from '@/app/lib/creationStation/padSamplerFxRack';
import {
  ensureBeatLabProducerKitLoaded,
  type BeatLabProducerKitId,
} from '@/app/lib/creationStation/beatLabProducerKits';
import { BEAT_PADS_LANE_GM_PITCH } from '@/app/lib/creationStation/beatPadsStudioExport';
import {
  samplerOptsFromStored,
  storedToArrayBuffer,
  type PadSamplerPlaybackOpts,
} from '@/app/lib/padSampleStorage';
import { beatPadsLaneActiveAtStep } from '@/app/lib/creationStation/beatPadsPatternEdit';
import {
  beatPadsPatternCols,
  emptyBeatPadsPattern,
  normalizeBeatPadsPattern,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import {
  buildBeatPadsSpreadVoiceFromPad,
  beatPadsSpreadNotesAtColumn,
  beatPadsSpreadPatternCols,
  beatPadsSpreadRowMidi,
  clampBeatPadsSpreadMixerChannel,
  type BeatPadsSpreadVoice,
} from '@/app/lib/creationStation/beatPadsSpreadTrack';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { loadSe2BeatPadsPadStore, se2BeatPadsPadKey } from '@/app/lib/studio/se2BeatPadsPadStorage';
import { se2BeatPadsLaneIndexForPitch } from '@/app/lib/studio/se2BeatPadsPianoRoll';
import { se2BeatPadsKickKeySemitones, se2BeatPadsPadGetsKickKeyLock } from '@/app/lib/studio/se2BeatPadsKickMatch';
import type { Se2BeatPadsHarmonySourceTrack } from '@/app/lib/studio/se2BeatPadsHarmony';
import { se2BeatPadsSpreadKeyLockSemiAtCol } from '@/app/lib/studio/se2BeatPadsSpreadHarmony';
import type { Se2BeatPadsSpreadSnapshot } from '@/app/lib/studio/se2BeatPadsSpreadStore';
import type { Se2BeatPadsTrack } from '@/app/lib/studio/se2BeatPadsTrack';
import {
  getSe2BeatPadsMainVolume,
  SE2_BEAT_PADS_MAIN_VOLUME_DEFAULT,
} from '@/app/lib/studio/se2BeatPadsMainVolume';

/** @deprecated Use getSe2BeatPadsMainVolume() — default preset only. */
export const SE2_BEAT_PADS_OUTPUT_GAIN = SE2_BEAT_PADS_MAIN_VOLUME_DEFAULT;

export type Se2BeatPadsPadVoice = {
  buffer: AudioBuffer;
  sampler: PadSamplerPlaybackOpts;
  fx: PadSamplerFxRack;
};

export type Se2BeatPadsTrackSession = {
  trackId: string;
  kitId: BeatLabProducerKitId;
  pads: Map<number, Se2BeatPadsPadVoice>;
};

/**
 * Live Instrument / Pad FX shaping from the Beat Pads panel.
 * Transport + piano-roll use the session cache; this map is updated on every knob
 * drag so OSC / FILTER / PITCH / AMP / DIST apply immediately (not only after persist).
 */
type Se2BeatPadsLiveShaping = {
  sampler: PadSamplerPlaybackOpts;
  fx: PadSamplerFxRack;
};

const livePadShaping = new Map<string, Se2BeatPadsLiveShaping>();

export function setSe2BeatPadsLivePadShaping(
  trackId: string,
  padIndex: number,
  sampler: PadSamplerPlaybackOpts,
  fx?: PadSamplerFxRack,
): void {
  const key = se2BeatPadsPadKey(trackId, padIndex);
  const prev = livePadShaping.get(key);
  livePadShaping.set(key, {
    sampler: { ...sampler },
    fx: fx
      ? clonePadSamplerFxRack(fx)
      : prev
        ? clonePadSamplerFxRack(prev.fx)
        : defaultPadSamplerFxRack(),
  });
}

export function clearSe2BeatPadsLivePadShaping(trackId: string, padIndex?: number): void {
  if (padIndex != null) {
    livePadShaping.delete(se2BeatPadsPadKey(trackId, padIndex));
    return;
  }
  const prefix = `${trackId}_`;
  for (const key of [...livePadShaping.keys()]) {
    if (key.startsWith(prefix)) livePadShaping.delete(key);
  }
}

function resolveSe2BeatPadsPadVoice(
  session: Se2BeatPadsTrackSession,
  padIndex: number,
): Se2BeatPadsPadVoice | null {
  const voice = session.pads.get(padIndex);
  if (!voice) return null;
  const live = livePadShaping.get(se2BeatPadsPadKey(session.trackId, padIndex));
  if (!live) return voice;
  return {
    buffer: voice.buffer,
    sampler: { ...live.sampler },
    fx: clonePadSamplerFxRack(live.fx),
  };
}

export function se2BeatPadsStoreSignature(trackId: string): string {
  const store = loadSe2BeatPadsPadStore();
  const prefix = `${trackId}_`;
  return Object.keys(store)
    .filter((k) => k.startsWith(prefix))
    .sort()
    .join('|');
}

export async function loadSe2BeatPadsTrackSession(
  ctx: AudioContext,
  trackId: string,
  kitId: BeatLabProducerKitId = 'trapDarkVault',
): Promise<Se2BeatPadsTrackSession> {
  const pads = new Map<number, Se2BeatPadsPadVoice>();
  const store = loadSe2BeatPadsPadStore();
  const prefix = `${trackId}_`;

  for (const k of Object.keys(store)) {
    if (!k.startsWith(prefix)) continue;
    const padStr = k.slice(prefix.length);
    const padIndex = Number(padStr);
    if (!Number.isFinite(padIndex) || padIndex < 0 || padIndex > 15) continue;
    try {
      const st = store[k]!;
      const ab = storedToArrayBuffer(st);
      const buffer = await ctx.decodeAudioData(ab.slice(0));
      pads.set(padIndex, {
        buffer,
        sampler: samplerOptsFromStored(st),
        fx: fxRackFromStored(st),
      });
    } catch {
      /* skip corrupt */
    }
  }

  if (pads.size === 0) {
    const kitPads = await ensureBeatLabProducerKitLoaded(kitId, ctx);
    const defaultFx = defaultPadSamplerFxRack();
    for (const { pad, buffer, sampler } of kitPads) {
      if (pad < 0 || pad > 15) continue;
      pads.set(pad, { buffer, sampler, fx: clonePadSamplerFxRack(defaultFx) });
    }
  }

  return { trackId, kitId, pads };
}

export function triggerSe2BeatPadsPad(
  session: Se2BeatPadsTrackSession | null | undefined,
  padIndex: number,
  ctx: AudioContext,
  velocity: number,
  when?: number,
  dest?: AudioNode,
  opts?: {
    sessionBpm?: number;
    trackVolume127?: number;
    kickKeySemi?: number;
    kickKeyLockTrack?: Pick<Se2BeatPadsTrack, 'beatPadsKickKeyLock' | 'beatPadsKickTargetPad'>;
  },
): boolean {
  if (!session) return false;
  const voice = resolveSe2BeatPadsPadVoice(session, padIndex);
  if (!voice) return false;
  const whenPlay = when ?? ctx.currentTime;
  const keySemi =
    opts?.kickKeySemi != null &&
    opts.kickKeyLockTrack &&
    se2BeatPadsPadGetsKickKeyLock(padIndex, opts.kickKeyLockTrack)
      ? opts.kickKeySemi
      : 0;
  const sampler =
    keySemi !== 0
      ? {
          ...voice.sampler,
          fineSemi: Math.max(-12, Math.min(12, (voice.sampler.fineSemi ?? 0) + keySemi)),
        }
      : voice.sampler;
  playPadSampleBuffer(
    ctx,
    voice.buffer,
    1,
    velocity,
    whenPlay,
    { 1: opts?.trackVolume127 ?? 100 },
    1,
    undefined,
    sampler,
    false,
    voice.fx,
    Math.max(1, opts?.sessionBpm ?? 120),
    when == null,
    0,
    { outputNode: dest, skipMeter: true, outputGain: getSe2BeatPadsMainVolume() },
  );
  return true;
}

export function se2BeatPadsSpreadVoiceFromSession(
  session: Se2BeatPadsTrackSession,
  spread: Se2BeatPadsSpreadSnapshot,
  sessionBpm: number,
): BeatPadsSpreadVoice | null {
  const padVoice = resolveSe2BeatPadsPadVoice(session, spread.sourcePad);
  if (!padVoice) return null;
  return buildBeatPadsSpreadVoiceFromPad({
    buffer: padVoice.buffer,
    label: spread.baseLabel,
    rootMidi: spread.rootMidi,
    chromatic: true,
    sampler: padVoice.sampler,
    fx: padVoice.fx,
    rootBpm: sessionBpm,
    direction: spread.direction,
    mixerChannel: spread.mixerChannel,
  });
}

export function triggerSe2BeatPadsSpreadRow(
  voice: BeatPadsSpreadVoice,
  row: number,
  ctx: AudioContext,
  velocity: number,
  when: number,
  dest: AudioNode,
  opts?: {
    sessionBpm?: number;
    trackVolume127?: number;
    keyLockSemi?: number;
  },
): boolean {
  const strikeMidi = beatPadsSpreadRowMidi(voice.rootMidi, row, voice.direction);
  const keyLockSemi = opts?.keyLockSemi ?? 0;
  const detuneCents = (strikeMidi - voice.rootMidi + keyLockSemi) * 100;
  playPadSampleBuffer(
    ctx,
    voice.buffer,
    clampBeatPadsSpreadMixerChannel(voice.mixerChannel),
    velocity,
    when,
    { 1: opts?.trackVolume127 ?? 100 },
    1,
    undefined,
    voice.sampler,
    true,
    voice.fx,
    Math.max(1, opts?.sessionBpm ?? voice.rootBpm),
    false,
    detuneCents,
    { outputNode: dest, skipMeter: true, outputGain: getSe2BeatPadsMainVolume() },
  );
  return true;
}

/** Schedule Beat Pads pattern steps on SE2 transport (not piano-roll notes). */
export function refillSe2BeatPadsPatternOnTransport(args: {
  ctx: AudioContext;
  ctSnap: number;
  horizon: number;
  chainFloor: number;
  track: Se2BeatPadsTrack;
  session: Se2BeatPadsTrackSession | null;
  stripIn: AudioNode;
  originBeat: number;
  sessionStart: number;
  spb: number;
  bpm: number;
  beatsPerBar: number;
  trackVolume127: number;
  scheduled: Set<string>;
  kickKeySemi?: number;
}): void {
  const {
    ctx,
    ctSnap,
    horizon,
    chainFloor,
    track,
    session,
    stripIn,
    originBeat,
    sessionStart,
    spb,
    bpm,
    beatsPerBar,
    trackVolume127,
    scheduled,
  } = args;

  const kickKeySemi = args.kickKeySemi ?? 0;

  const loopBars = track.beatPadsLoopBars ?? 8;
  const stepsPerBar: BeatPadsGridStepsPerBar = track.beatPadsStepsPerBar ?? 16;
  const pattern = normalizeBeatPadsPattern(
    track.beatPadsPattern ?? emptyBeatPadsPattern(loopBars),
    loopBars,
    stepsPerBar,
  );
  const cols = beatPadsPatternCols(loopBars, stepsPerBar);
  if (cols <= 0) return;

  const patternLoopBeats = loopBars * beatsPerBar;
  const stepBeats = patternLoopBeats / cols;
  const beatNow = originBeat + Math.max(0, ctSnap - sessionStart) / spb;
  const purgeBeforeBeat = beatNow - 1;
  const elapsedSec = Math.max(0, ctSnap - sessionStart);
  const loopSec = patternLoopBeats * spb;
  const catchUpSec = 0.15;

  for (let col = 0; col < cols; col += 1) {
    const stepOffset = col * stepBeats;
    const stepOffSec = stepOffset * spb;
    const kStart = Math.floor(Math.max(0, elapsedSec - stepOffSec - catchUpSec) / Math.max(loopSec, 1e-9));
    const kMax =
      kStart + Math.ceil(Math.max(0, horizon - sessionStart - stepOffSec) / Math.max(loopSec, 1e-9)) + 2;

    for (let k = kStart; k <= kMax; k += 1) {
      const occurrenceBeat = originBeat + stepOffset + k * patternLoopBeats;
      const tOn = sessionStart + stepOffSec + k * loopSec;
      if (tOn > horizon + 1e-6) break;

      for (let lane = 0; lane < 16; lane += 1) {
        if (!beatPadsLaneActiveAtStep(pattern[lane], col)) continue;
        const pitch = BEAT_PADS_LANE_GM_PITCH[lane] ?? 36 + lane;

        // Include sessionStart so loop-brace splice (new audio anchor) can reschedule.
        const key = `bp:${track.id}:${col}:${lane}:${occurrenceBeat.toFixed(4)}@${Math.round(bpm)}@${sessionStart.toFixed(3)}`;
        if (tOn < ctSnap - 0.03) {
          if (occurrenceBeat < purgeBeforeBeat) scheduled.delete(key);
          else scheduled.add(key);
          continue;
        }
        if (scheduled.has(key)) continue;
        scheduled.add(key);

        const when = Math.max(tOn, ctSnap + chainFloor);
        if (
          !session ||
          !triggerSe2BeatPadsMidiPitch(session, pitch, ctx, 100, when, stripIn, {
            sessionBpm: bpm,
            trackVolume127,
            kickKeySemi,
            kickKeyLockTrack: track,
          })
        ) {
          scheduled.delete(key);
        }
      }
    }
  }
}

/** Schedule CH 17 spread roll on SE2 transport — same grid clock as the step pattern. */
export function refillSe2BeatPadsSpreadOnTransport(args: {
  ctx: AudioContext;
  ctSnap: number;
  horizon: number;
  chainFloor: number;
  track: Se2BeatPadsTrack;
  session: Se2BeatPadsTrackSession | null;
  stripIn: AudioNode;
  originBeat: number;
  sessionStart: number;
  spb: number;
  bpm: number;
  beatsPerBar: number;
  trackVolume127: number;
  scheduled: Set<string>;
  harmonyTracks?: readonly Se2BeatPadsHarmonySourceTrack[];
  songKeyRoot?: number;
  songKeyMode?: ChordMode;
}): void {
  const {
    ctx,
    ctSnap,
    horizon,
    chainFloor,
    track,
    session,
    stripIn,
    originBeat,
    sessionStart,
    spb,
    bpm,
    beatsPerBar,
    trackVolume127,
    scheduled,
  } = args;

  const spread = track.beatPadsSpread;
  if (!spread?.notes.length || !session) return;

  const voice = se2BeatPadsSpreadVoiceFromSession(session, spread, bpm);
  if (!voice) return;

  const mainLoopBars = track.beatPadsLoopBars ?? 8;
  const mainStepsPerBar = track.beatPadsStepsPerBar ?? 16;
  const mainCols = beatPadsPatternCols(mainLoopBars, mainStepsPerBar);
  if (mainCols <= 0) return;

  const spreadCols = beatPadsSpreadPatternCols(spread.loopBars, spread.stepsPerBar);
  if (spreadCols <= 0) return;

  const harmonyTrack =
    spread.harmonyTrackIndex != null ? args.harmonyTracks?.[spread.harmonyTrackIndex] : undefined;

  const patternLoopBeats = mainLoopBars * beatsPerBar;
  const stepBeats = patternLoopBeats / mainCols;
  const beatNow = originBeat + Math.max(0, ctSnap - sessionStart) / spb;
  const purgeBeforeBeat = beatNow - 1;
  const elapsedSec = Math.max(0, ctSnap - sessionStart);
  const loopSec = patternLoopBeats * spb;
  const catchUpSec = 0.15;

  for (let col = 0; col < mainCols; col += 1) {
    const spreadCol = ((col % spreadCols) + spreadCols) % spreadCols;
    const notesAtCol = beatPadsSpreadNotesAtColumn(spread.notes, spreadCol);
    if (notesAtCol.length === 0) continue;

    const stepOffset = col * stepBeats;
    const stepOffSec = stepOffset * spb;
    const kStart = Math.floor(Math.max(0, elapsedSec - stepOffSec - catchUpSec) / Math.max(loopSec, 1e-9));
    const kMax =
      kStart + Math.ceil(Math.max(0, horizon - sessionStart - stepOffSec) / Math.max(loopSec, 1e-9)) + 2;

    for (let k = kStart; k <= kMax; k += 1) {
      const occurrenceBeat = originBeat + stepOffset + k * patternLoopBeats;
      const tOn = sessionStart + stepOffSec + k * loopSec;
      if (tOn > horizon + 1e-6) break;

      for (const note of notesAtCol) {
        const key = `bps:${track.id}:${col}:${note.row}:${spreadCol}:${occurrenceBeat.toFixed(4)}@${Math.round(bpm)}@${sessionStart.toFixed(3)}`;
        if (tOn < ctSnap - 0.03) {
          if (occurrenceBeat < purgeBeforeBeat) scheduled.delete(key);
          else scheduled.add(key);
          continue;
        }
        if (scheduled.has(key)) continue;
        scheduled.add(key);

        const when = Math.max(tOn, ctSnap + chainFloor);
        const keyLockSemi = se2BeatPadsSpreadKeyLockSemiAtCol({
          voiceRootMidi: voice.rootMidi,
          track: harmonyTrack,
          gridCol: spreadCol,
          stepsPerBar: spread.stepsPerBar,
          loopBars: spread.loopBars,
          beatsPerBar,
          keyLockEnabled: spread.keyLockEnabled ?? false,
          songKeyRoot: args.songKeyRoot ?? 0,
          songKeyMode: args.songKeyMode ?? 'major',
        });
        if (
          !triggerSe2BeatPadsSpreadRow(voice, note.row, ctx, 100, when, stripIn, {
            sessionBpm: bpm,
            trackVolume127,
            keyLockSemi,
          })
        ) {
          scheduled.delete(key);
        }
      }
    }
  }
}

export function triggerSe2BeatPadsMidiPitch(
  session: Se2BeatPadsTrackSession | null | undefined,
  pitch: number,
  ctx: AudioContext,
  velocity: number,
  when?: number,
  dest?: AudioNode,
  opts?: {
    sessionBpm?: number;
    trackVolume127?: number;
    kickKeySemi?: number;
    kickKeyLockTrack?: Pick<Se2BeatPadsTrack, 'beatPadsKickKeyLock' | 'beatPadsKickTargetPad'>;
  },
): boolean {
  const exact = BEAT_PADS_LANE_GM_PITCH.indexOf(pitch);
  const padIndex = exact >= 0 ? exact : se2BeatPadsLaneIndexForPitch(pitch);
  if (padIndex < 0 || padIndex > 15) return false;
  return triggerSe2BeatPadsPad(session, padIndex, ctx, velocity, when, dest, opts);
}

export function se2BeatPadsKickKeySemiForTrack(
  track: Se2BeatPadsTrack,
  keyRoot: number | undefined,
): number {
  if (!(track.beatPadsKickKeyLock ?? false)) return 0;
  if (keyRoot == null) return 0;
  return se2BeatPadsKickKeySemitones(keyRoot);
}
