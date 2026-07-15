/**
 * Studio Editor 2 — play MIDI track instruments selected from the lane dropdown
 * (GM keys/strings/brass, 808 subs, synth presets) onto the mixer strip.
 */
import { Scheduler, Soundfont, type Soundfont as SmplrSoundfont } from 'smplr';
import {
  playEightZeroEight,
  type EightZeroEightPresetDef,
} from '@/app/lib/creationStation/eightZeroEightVoice';
import {
  grooveLabBassSoundDef,
  grooveLabDefaultSoundRole,
  type GrooveLabBassSoundId,
} from '@/app/lib/creationStation/grooveLabBassSounds';
import { scheduleBeatLabSynthV2Note } from '@/app/lib/creationStation/beatLabMelodicSynthV2Engine';
import { beatLabBassSynthVoiceParamsFromPresetId } from '@/app/lib/creationStation/beatLabMelodicSynthV2State';
import { BEAT_LAB_DEFAULT_SYNTH_PRESET_ID } from '@/app/lib/creationStation/beatLabMelodicSynthPresets';
import { se2BeatLabLaneForTrack } from '@/app/lib/studio/se2GlideBassNotes';
import {
  studioMidiInstrumentOption,
  type StudioMidiInstrumentSource,
} from '@/app/lib/studio/studioEditor2Instruments';

const SE2_GM_KIT = 'MusyngKite' as const;
/** Match SE2 metro lookahead (~3s) so transport notes aren't late. */
const SE2_GM_SCHEDULER_LOOKAHEAD_MS = 3250;

const gmCache = new Map<string, Promise<SmplrSoundfont>>();
const gmReady = new Map<string, SmplrSoundfont>();
const gmSchedulerByCtx = new WeakMap<BaseAudioContext, ReturnType<typeof Scheduler>>();
let gmCacheCtx: BaseAudioContext | null = null;
const destIds = new WeakMap<AudioNode, number>();
let nextDestId = 1;
/** Active smplr stop handles — cleared on SE2 Stop/Pause. */
const activeGmStops = new Set<() => void>();
let gmTransportEpoch = 0;

export type StudioEditor2MidiPlaybackKind =
  | { kind: 'gm'; gmId: string }
  | { kind: 'bass808'; soundId: GrooveLabBassSoundId }
  | { kind: 'synth'; presetId: string }
  | { kind: 'drums'; instrumentId: string };

function ensureGmCache(ctx: BaseAudioContext): void {
  if (gmCacheCtx === ctx) return;
  gmCache.clear();
  gmReady.clear();
  gmCacheCtx = ctx;
}

function destinationKey(destination: AudioNode): number {
  let id = destIds.get(destination);
  if (id == null) {
    id = nextDestId++;
    destIds.set(destination, id);
  }
  return id;
}

function gmCacheKey(gmId: string, destination: AudioNode): string {
  return `${SE2_GM_KIT}:${gmId}:d${destinationKey(destination)}`;
}

function gmScheduler(ctx: BaseAudioContext): ReturnType<typeof Scheduler> {
  let sched = gmSchedulerByCtx.get(ctx);
  if (!sched) {
    sched = Scheduler(ctx, { lookaheadMs: SE2_GM_SCHEDULER_LOOKAHEAD_MS, intervalMs: 16 });
    gmSchedulerByCtx.set(ctx, sched);
  }
  return sched;
}

function stripGmPrefix(id: string): string {
  return id.startsWith('gm:') ? id.slice(3) : id;
}

/** Resolve dropdown id → playback engine (excludes orchHit / grooveLead — already handled). */
export function studioParseEditor2MidiPlayback(
  instrumentId: string | undefined,
): StudioEditor2MidiPlaybackKind | null {
  if (!instrumentId) return null;
  if (instrumentId.startsWith('orchHit:') || instrumentId.startsWith('grooveLead:')) return null;

  const opt = studioMidiInstrumentOption(instrumentId);
  const source: StudioMidiInstrumentSource | undefined = opt?.source;

  if (instrumentId.startsWith('bass808:') || source === 'bass808') {
    const soundId = (instrumentId.startsWith('bass808:')
      ? instrumentId.slice('bass808:'.length)
      : instrumentId) as GrooveLabBassSoundId;
    return { kind: 'bass808', soundId };
  }
  if (instrumentId.startsWith('synth:') || source === 'synth') {
    const presetId = instrumentId.startsWith('synth:')
      ? instrumentId.slice('synth:'.length)
      : instrumentId;
    return { kind: 'synth', presetId: presetId || BEAT_LAB_DEFAULT_SYNTH_PRESET_ID };
  }
  if (source === 'drums' || /_drums$/.test(instrumentId)) {
    return { kind: 'drums', instrumentId };
  }
  if (instrumentId.startsWith('gm:') || source === 'gm') {
    const gmId = stripGmPrefix(instrumentId);
    if (!gmId || /_drums$/.test(gmId)) return { kind: 'drums', instrumentId };
    return { kind: 'gm', gmId };
  }
  return null;
}

export function getStudioEditor2GmInstrument(
  ctx: AudioContext,
  gmId: string,
  destination: AudioNode,
): Promise<SmplrSoundfont> {
  ensureGmCache(ctx);
  const id = gmId || 'acoustic_grand_piano';
  const key = gmCacheKey(id, destination);
  let pending = gmCache.get(key);
  if (!pending) {
    pending = (async () => {
      const inst = Soundfont(ctx, {
        instrument: id,
        kit: SE2_GM_KIT,
        destination,
        volume: 100,
        scheduler: gmScheduler(ctx),
      });
      await inst.load;
      gmReady.set(key, inst);
      return inst;
    })().catch((err) => {
      gmCache.delete(key);
      gmReady.delete(key);
      throw err;
    });
    gmCache.set(key, pending);
  }
  return pending;
}

function readyGm(ctx: AudioContext, gmId: string, destination: AudioNode): SmplrSoundfont | null {
  ensureGmCache(ctx);
  return gmReady.get(gmCacheKey(gmId || 'acoustic_grand_piano', destination)) ?? null;
}

function startGmVoice(
  inst: SmplrSoundfont,
  midi: number,
  velocity: number,
  when: number,
  durationSec: number,
): void {
  inst.output.pan = 0;
  const rawStop = inst.start({
    note: Math.max(0, Math.min(127, Math.round(midi))),
    velocity: Math.max(1, Math.min(127, Math.round(velocity))),
    time: Math.max(when, 0),
    duration: Math.max(0.04, durationSec),
  });
  const wrappedStop = () => {
    activeGmStops.delete(wrappedStop);
    try {
      rawStop();
    } catch {
      /* already stopped */
    }
  };
  activeGmStops.add(wrappedStop);
}

function scheduleGmNote(
  ctx: AudioContext,
  destination: AudioNode,
  gmId: string,
  midi: number,
  velocity: number,
  when: number,
  durationSec: number,
  /** Preview/audition — play after load even if the original onset has passed. */
  allowLateLoad = false,
): void {
  const whenLocked = Math.max(when, ctx.currentTime + 0.001);
  const epoch = gmTransportEpoch;
  const ready = readyGm(ctx, gmId, destination);
  if (ready) {
    try {
      startGmVoice(ready, midi, velocity, whenLocked, durationSec);
      return;
    } catch (err) {
      console.warn('[SE2 MIDI] GM sync schedule failed:', gmId, err);
    }
  }
  void getStudioEditor2GmInstrument(ctx, gmId, destination)
    .then((inst) => {
      if (gmTransportEpoch !== epoch) return;
      if (!allowLateLoad && whenLocked < ctx.currentTime - 0.04) return;
      startGmVoice(inst, midi, velocity, Math.max(whenLocked, ctx.currentTime + 0.001), durationSec);
    })
    .catch((err) => {
      console.warn('[SE2 MIDI] GM load failed:', gmId, err);
    });
}

/** Stop queued GM/synth/808 SE2 track-instrument notes on Stop/Pause. */
export function haltStudioEditor2MidiInstrumentNotes(): void {
  gmTransportEpoch += 1;
  for (const stop of activeGmStops) {
    try {
      stop();
    } catch {
      /* */
    }
  }
  activeGmStops.clear();
  if (gmCacheCtx) {
    try {
      gmSchedulerByCtx.get(gmCacheCtx)?.stop();
    } catch {
      /* */
    }
  }
  const ready = [...gmReady.values()];
  if (ready.length > 0) {
    queueMicrotask(() => {
      for (const inst of ready) {
        try {
          inst.stop();
        } catch {
          /* */
        }
      }
    });
  }
}

function bassFilterFx(preset: EightZeroEightPresetDef) {
  const fx: { hpHz?: number; lpHz?: number } = {};
  if (preset.filterHpHz != null && preset.filterHpHz >= 25) fx.hpHz = preset.filterHpHz;
  if (preset.filterLpHz != null && preset.filterLpHz >= 200) fx.lpHz = preset.filterLpHz;
  return fx.hpHz != null || fx.lpHz != null ? fx : undefined;
}

function scheduleBass808Note(
  ctx: AudioContext,
  destination: AudioNode,
  soundId: GrooveLabBassSoundId,
  midi: number,
  velocity: number,
  when: number,
  durationSec: number,
  bpm: number,
): void {
  const def = grooveLabBassSoundDef(soundId);
  const role = grooveLabDefaultSoundRole(soundId, midi);
  const isSub = role === 'sub';
  const holdBeats = Math.max(0.25, (durationSec * Math.max(1, bpm)) / 60);
  const leadHold = isSub ? holdBeats : Math.min(holdBeats, 1.35);
  playEightZeroEight(ctx, Math.max(when, ctx.currentTime + 0.001), midi, def.preset, 0.88, {
    soundLane: isSub ? 'bass' : 'kick',
    kickKeyboardMap: true,
    subOscOnly: isSub,
    kickMonophonic: false,
    velocity01: Math.max(0.05, Math.min(1, velocity / 127)),
    bpm,
    holdBeats: leadHold,
    filterFx: bassFilterFx(def.preset),
    destination,
  });
}

function scheduleSynthPresetNote(
  ctx: AudioContext,
  destination: AudioNode,
  trackIndex: number,
  presetId: string,
  midi: number,
  velocity: number,
  when: number,
  durationSec: number,
  bpm: number,
): void {
  const voice = beatLabBassSynthVoiceParamsFromPresetId(presetId || BEAT_LAB_DEFAULT_SYNTH_PRESET_ID);
  const lane = se2BeatLabLaneForTrack(trackIndex);
  scheduleBeatLabSynthV2Note(ctx, {
    lane,
    midi,
    velocity: Math.max(1, Math.min(127, Math.round(velocity))),
    when,
    durationSec: Math.max(0.04, durationSec),
    channelVolumes: { [lane + 1]: 100 },
    voice,
    stripOutput: destination,
    bpm,
    strictNoteOff: true,
    transportLite: true,
  });
}

export type ScheduleStudioEditor2MidiInstrumentOpts = {
  ctx: AudioContext;
  stripIn: AudioNode;
  trackIndex: number;
  instrumentId: string | undefined;
  midi: number;
  velocity: number;
  when: number;
  durationSec: number;
  bpm: number;
  /** Preview/audition — GM may finish loading after the click; still fire the note. */
  allowLateLoad?: boolean;
};

/**
 * Schedule one note for a track dropdown instrument.
 * Returns true when handled (caller should skip triangle fallback).
 * Drum-kit ids return false so existing drum-session path can own them.
 */
export function scheduleStudioEditor2MidiInstrumentNote(
  opts: ScheduleStudioEditor2MidiInstrumentOpts,
): boolean {
  const parsed = studioParseEditor2MidiPlayback(opts.instrumentId);
  if (!parsed) return false;
  if (parsed.kind === 'drums') return false;

  const {
    ctx,
    stripIn,
    trackIndex,
    midi,
    velocity,
    when,
    durationSec,
    bpm,
    allowLateLoad = false,
  } = opts;

  if (parsed.kind === 'gm') {
    scheduleGmNote(ctx, stripIn, parsed.gmId, midi, velocity, when, durationSec, allowLateLoad);
    return true;
  }
  if (parsed.kind === 'bass808') {
    scheduleBass808Note(ctx, stripIn, parsed.soundId, midi, velocity, when, durationSec, bpm);
    return true;
  }
  if (parsed.kind === 'synth') {
    scheduleSynthPresetNote(
      ctx,
      stripIn,
      trackIndex,
      parsed.presetId,
      midi,
      velocity,
      when,
      durationSec,
      bpm,
    );
    return true;
  }
  return false;
}

/** Piano-key / instrument-picker audition. */
export function previewStudioEditor2MidiInstrumentNote(
  opts: Omit<ScheduleStudioEditor2MidiInstrumentOpts, 'durationSec'> & { durationSec?: number },
): boolean {
  return scheduleStudioEditor2MidiInstrumentNote({
    ...opts,
    durationSec: opts.durationSec ?? 0.45,
    when: opts.when ?? opts.ctx.currentTime + 0.008,
    allowLateLoad: true,
  });
}

export async function warmupStudioEditor2MidiInstrument(
  ctx: AudioContext,
  instrumentId: string | undefined,
  destination: AudioNode,
): Promise<void> {
  const parsed = studioParseEditor2MidiPlayback(instrumentId);
  if (!parsed || parsed.kind !== 'gm') return;
  try {
    await getStudioEditor2GmInstrument(ctx, parsed.gmId, destination);
  } catch (err) {
    console.warn('[SE2 MIDI] warmup failed:', instrumentId, err);
  }
}

export async function warmupStudioEditor2TrackMidiInstruments(
  ctx: AudioContext,
  tracks: readonly { midiInstrumentId?: string; kind?: string }[],
  stripForTrack: (ti: number) => AudioNode | null,
): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (let ti = 0; ti < tracks.length; ti++) {
    const id = tracks[ti]?.midiInstrumentId;
    const parsed = studioParseEditor2MidiPlayback(id);
    if (!parsed || parsed.kind !== 'gm') continue;
    const strip = stripForTrack(ti);
    if (!strip) continue;
    jobs.push(warmupStudioEditor2MidiInstrument(ctx, id, strip));
  }
  await Promise.all(jobs);
}
