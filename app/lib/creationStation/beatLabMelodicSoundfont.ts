/**
 * Beat Lab channels 17–32 — MusyngKite GM soundfont via smplr (open-source, high quality).
 * @see https://github.com/danigb/smplr
 */
import { Scheduler, Soundfont, type Soundfont as SmplrSoundfont } from 'smplr';
import { scheduleBeatLabMeterPulseAt } from '@/app/lib/creationStation/beatLabChannelMeters';
import { CREATION_SCHEDULE_AHEAD_SEC } from '@/app/lib/creationStation/creationTransportSystem';
import { BEAT_LAB_MELODIC_LANE_START, BEAT_LAB_PAD_LANES } from './beatLabMidiRoll';

/**
 * smplr's default scheduler only dispatches notes within 200ms of `currentTime`.
 * Beat Lab lookahead schedules ~3s ahead — those notes sat in a 50ms JS queue and fired late.
 */
const SMPLR_TRANSPORT_SCHEDULER_LOOKAHEAD_MS = Math.ceil(CREATION_SCHEDULE_AHEAD_SEC * 1000) + 250;

const transportSchedulerByCtx = new WeakMap<BaseAudioContext, ReturnType<typeof Scheduler>>();

function beatLabMelodicTransportScheduler(ctx: BaseAudioContext): ReturnType<typeof Scheduler> {
  let sched = transportSchedulerByCtx.get(ctx);
  if (!sched) {
    sched = Scheduler(ctx, {
      lookaheadMs: SMPLR_TRANSPORT_SCHEDULER_LOOKAHEAD_MS,
      intervalMs: 16,
    });
    transportSchedulerByCtx.set(ctx, sched);
  }
  return sched;
}

export type BeatLabMelodicPlayOpts = {
  lane: number;
  midi: number;
  velocity: number;
  when: number;
  durationSec: number;
  channelVolumes: Record<number, number>;
  instrumentId?: string;
  /** Sound-bank level (e.g. NEW SYNTH piano roll) — not the mixer strip fader. */
  instrumentGain?: number;
  /**
   * Beat Lab transport only — pull onset earlier so GM piano attack lines up with
   * bass / metronome (soundfont samples have ~15–20 ms attack vs instant V2 bass).
   */
  transportOnsetLeadSec?: number;
  /** Pre-locked `AudioContext` time — do not re-floor after async instrument load. */
  whenLocked?: number;
};

/** GM piano sample attack after `time` (smplr) — applied once samples are preloaded on Play. */
export const BEAT_LAB_PIANO_TRANSPORT_ONSET_LEAD_SEC = 0.022;

export const BEAT_LAB_MELODIC_KIT = 'MusyngKite' as const;

/** One GM instrument per melodic lane (CH 17–32) — curated for beat production. */
export const BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS: readonly string[] = [
  'acoustic_grand_piano',
  'electric_piano_1',
  'drawbar_organ',
  'violin',
  'cello',
  'acoustic_bass',
  'trumpet',
  'tenor_sax',
  'flute',
  'clarinet',
  'acoustic_guitar_nylon',
  'electric_guitar_clean',
  'synth_bass_1',
  'string_ensemble_1',
  'pad_2_warm',
  'lead_6_voice',
];

export type BeatLabMelodicInstrumentOption = { id: string; label: string; group: string };

/** Picker list — popular MusyngKite instruments (valid GM names). */
export const BEAT_LAB_MELODIC_INSTRUMENT_OPTIONS: readonly BeatLabMelodicInstrumentOption[] = [
  { id: 'acoustic_grand_piano', label: 'Grand Piano', group: 'Keys' },
  { id: 'bright_acoustic_piano', label: 'Bright Piano', group: 'Keys' },
  { id: 'electric_piano_1', label: 'Electric Piano 1', group: 'Keys' },
  { id: 'electric_piano_2', label: 'Electric Piano 2', group: 'Keys' },
  { id: 'harpsichord', label: 'Harpsichord', group: 'Keys' },
  { id: 'clavinet', label: 'Clavinet', group: 'Keys' },
  { id: 'drawbar_organ', label: 'Drawbar Organ', group: 'Keys' },
  { id: 'rock_organ', label: 'Rock Organ', group: 'Keys' },
  { id: 'acoustic_guitar_nylon', label: 'Nylon Guitar', group: 'Guitar' },
  { id: 'acoustic_guitar_steel', label: 'Steel Guitar', group: 'Guitar' },
  { id: 'electric_guitar_clean', label: 'Clean E. Guitar', group: 'Guitar' },
  { id: 'electric_guitar_muted', label: 'Muted E. Guitar', group: 'Guitar' },
  { id: 'overdriven_guitar', label: 'Overdrive Guitar', group: 'Guitar' },
  { id: 'acoustic_bass', label: 'Acoustic Bass', group: 'Bass' },
  { id: 'electric_bass_finger', label: 'Finger Bass', group: 'Bass' },
  { id: 'synth_bass_1', label: 'Synth Bass 1', group: 'Bass' },
  { id: 'synth_bass_2', label: 'Synth Bass 2', group: 'Bass' },
  { id: 'violin', label: 'Violin', group: 'Strings' },
  { id: 'viola', label: 'Viola', group: 'Strings' },
  { id: 'cello', label: 'Cello', group: 'Strings' },
  { id: 'contrabass', label: 'Contrabass', group: 'Strings' },
  { id: 'string_ensemble_1', label: 'String Ensemble', group: 'Strings' },
  { id: 'synth_strings_1', label: 'Synth Strings', group: 'Strings' },
  { id: 'trumpet', label: 'Trumpet', group: 'Brass' },
  { id: 'trombone', label: 'Trombone', group: 'Brass' },
  { id: 'french_horn', label: 'French Horn', group: 'Brass' },
  { id: 'brass_section', label: 'Brass Section', group: 'Brass' },
  { id: 'alto_sax', label: 'Alto Sax', group: 'Reed' },
  { id: 'tenor_sax', label: 'Tenor Sax', group: 'Reed' },
  { id: 'flute', label: 'Flute', group: 'Wind' },
  { id: 'clarinet', label: 'Clarinet', group: 'Wind' },
  { id: 'oboe', label: 'Oboe', group: 'Wind' },
  { id: 'pad_1_new_age', label: 'Pad New Age', group: 'Synth' },
  { id: 'pad_2_warm', label: 'Warm Pad', group: 'Synth' },
  { id: 'pad_3_polysynth', label: 'Polysynth Pad', group: 'Synth' },
  { id: 'lead_1_square', label: 'Square Lead', group: 'Synth' },
  { id: 'lead_2_sawtooth', label: 'Saw Lead', group: 'Synth' },
  { id: 'lead_6_voice', label: 'Voice Lead', group: 'Synth' },
  { id: 'marimba', label: 'Marimba', group: 'Mallet' },
  { id: 'vibraphone', label: 'Vibraphone', group: 'Mallet' },
  { id: 'music_box', label: 'Music Box', group: 'Chromatic' },
  { id: 'kalimba', label: 'Kalimba', group: 'Chromatic' },
];

export function beatLabMelodicSlotIndex(lane: number): number {
  return lane - BEAT_LAB_MELODIC_LANE_START;
}

export function beatLabIsMelodicLane(lane: number): boolean {
  return lane >= BEAT_LAB_MELODIC_LANE_START && lane < BEAT_LAB_PAD_LANES + 16;
}

export function beatLabMelodicMixerChannel(lane: number): number {
  return lane + 1;
}

export function normalizeBeatLabMelodicInstruments(raw: unknown): string[] {
  const out = BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS.slice();
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < 16; i += 1) {
    const v = raw[i];
    if (typeof v === 'string' && v.trim()) out[i] = v.trim();
  }
  return out;
}

function masterDestination(ctx: BaseAudioContext): AudioNode {
  const master = (window as unknown as { __daMusicMasterGain?: GainNode | null }).__daMusicMasterGain;
  return master && master.context === ctx ? master : ctx.destination;
}

function channelPan(ch: number): number {
  const raw =
    (window as unknown as { __daMusicChannelPans?: Record<number, number> }).__daMusicChannelPans?.[ch] ??
    0;
  return Math.max(-1, Math.min(1, raw / 100));
}

function channelVolumeGain(ch: number, channelVolumes: Record<number, number>): number {
  return Math.max(0, Math.min(1, (channelVolumes[ch] ?? 80) / 100));
}

const instrumentCache = new Map<string, Promise<SmplrSoundfont>>();
/** Resolved instruments — transport can `start()` synchronously (no await microtask slip). */
const instrumentReady = new Map<string, SmplrSoundfont>();
/** smplr `start()` stop handles — cut on Beat Lab Stop (lookahead queues ~3s ahead). */
const activeMelodicTransportStops = new Set<() => void>();
let melodicTransportEpoch = 0;
const loadProgressListeners = new Set<(loaded: number, total: number) => void>();

let warmupStarted = false;
/** Instruments are bound to one AudioContext — drop cache when the context changes. */
let cacheCtx: BaseAudioContext | null = null;

function ensureInstrumentCacheForContext(ctx: BaseAudioContext): void {
  if (cacheCtx === ctx) return;
  instrumentCache.clear();
  instrumentReady.clear();
  cacheCtx = ctx;
  warmupStarted = false;
}

/** Clear cached soundfonts (e.g. after AudioContext rebuild). */
export function clearBeatLabMelodicInstrumentCache(): void {
  instrumentCache.clear();
  instrumentReady.clear();
  cacheCtx = null;
  warmupStarted = false;
}

export function subscribeBeatLabMelodicLoadProgress(
  cb: (loaded: number, total: number) => void,
): () => void {
  loadProgressListeners.add(cb);
  return () => loadProgressListeners.delete(cb);
}

function emitLoadProgress(loaded: number, total: number) {
  loadProgressListeners.forEach((cb) => cb(loaded, total));
}

function cacheKey(instrument: string): string {
  return `${BEAT_LAB_MELODIC_KIT}:${instrument}`;
}

/** Drop cached instrument so the next play retries load (e.g. after offline / blocked fetch). */
export function invalidateBeatLabMelodicInstrument(instrumentId: string): void {
  const key = cacheKey(instrumentId || BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[0]!);
  instrumentCache.delete(key);
  instrumentReady.delete(key);
}

export function resetBeatLabMelodicWarmupFlag(): void {
  warmupStarted = false;
}

function scheduleTimeForPreview(ctx: AudioContext, when: number): number {
  return Math.max(when, ctx.currentTime + 0.008);
}

/** Same floor as metronome click scheduling — never snap late to `now + 8ms`. */
function lockMelodicTransportWhen(
  ctx: AudioContext,
  when: number,
  onsetLeadSec = 0,
): number {
  const t = when - Math.max(0, onsetLeadSec);
  return Math.max(t, ctx.currentTime + 0.001);
}

function getReadyMelodicInstrument(ctx: AudioContext, instrumentId: string): SmplrSoundfont | null {
  ensureInstrumentCacheForContext(ctx);
  const id = instrumentId || BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[0]!;
  return instrumentReady.get(cacheKey(id)) ?? null;
}

/** True when transport can call {@link startMelodicVoiceAt} without awaiting `load`. */
export function isBeatLabMelodicInstrumentReady(ctx: AudioContext, instrumentId: string): boolean {
  return getReadyMelodicInstrument(ctx, instrumentId) != null;
}

/** Await preload for specific instruments (call before Play / after AudioContext rebuild). */
export async function ensureBeatLabMelodicInstrumentsReady(
  ctx: AudioContext,
  instruments: readonly string[],
): Promise<void> {
  ensureInstrumentCacheForContext(ctx);
  const unique = [...new Set(instruments.filter(Boolean))];
  await Promise.all(unique.map((id) => getBeatLabMelodicInstrument(ctx, id)));
}

function startMelodicVoiceAt(
  ctx: AudioContext,
  inst: SmplrSoundfont,
  opts: BeatLabMelodicPlayOpts,
  when: number,
): () => void {
  const volGain = applyChannelMix(inst, opts.lane, opts.channelVolumes);
  const vel = beatLabMelodicOutputVelocity(opts.velocity, volGain, opts.instrumentGain ?? 1);
  pulseMelodicChannelMeter(ctx, opts.lane, vel, opts.channelVolumes, when);
  const dur = Math.max(0.04, opts.durationSec);
  const rawStop = inst.start({
    note: Math.max(0, Math.min(127, Math.round(opts.midi))),
    velocity: vel,
    time: when,
    duration: dur,
  });
  const wrappedStop = () => {
    activeMelodicTransportStops.delete(wrappedStop);
    try {
      rawStop();
    } catch {
      /* already stopped */
    }
  };
  activeMelodicTransportStops.add(wrappedStop);
  return wrappedStop;
}

/** Stop queued GM/smplr transport notes (Stop/Pause — not keyboard preview). */
export function haltBeatLabMelodicTransportNotes(): void {
  melodicTransportEpoch += 1;
  for (const stop of activeMelodicTransportStops) {
    try {
      stop();
    } catch {
      /* */
    }
  }
  activeMelodicTransportStops.clear();
  /** smplr Scheduler queue — ~3s of undispatched `start()` events Beat Lab lookahead fills. */
  if (cacheCtx) {
    try {
      transportSchedulerByCtx.get(cacheCtx)?.stop();
    } catch {
      /* */
    }
  }
  /** Release active voices — defer full bank sweep so Stop/Play buttons feel instant. */
  const ready = [...instrumentReady.values()];
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

export function getBeatLabMelodicInstrument(
  ctx: AudioContext,
  instrumentId: string,
): Promise<SmplrSoundfont> {
  ensureInstrumentCacheForContext(ctx);
  const id = instrumentId || BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[0]!;
  const key = cacheKey(id);
  let pending = instrumentCache.get(key);
  if (!pending) {
    pending = (async () => {
      const inst = Soundfont(ctx, {
        instrument: id,
        kit: BEAT_LAB_MELODIC_KIT,
        destination: masterDestination(ctx),
        volume: 100,
        scheduler: beatLabMelodicTransportScheduler(ctx),
        onLoadProgress: ({ loaded, total }) => emitLoadProgress(loaded, total),
      });
      await inst.load;
      instrumentReady.set(key, inst);
      return inst;
    })().catch((err) => {
      instrumentCache.delete(key);
      instrumentReady.delete(key);
      throw err;
    });
    instrumentCache.set(key, pending);
  }
  return pending;
}

/** Preload default bank instruments (call after AudioContext resume). */
export async function warmupBeatLabMelodicSoundfont(
  ctx: AudioContext,
  instruments: readonly string[] = BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS,
  force = false,
): Promise<void> {
  ensureInstrumentCacheForContext(ctx);
  if (warmupStarted && !force) return;
  warmupStarted = true;
  const unique = [...new Set(instruments.filter(Boolean))];
  emitLoadProgress(0, unique.length);
  let done = 0;
  await Promise.all(
    unique.map(async (name) => {
      try {
        await getBeatLabMelodicInstrument(ctx, name);
      } catch {
        /* skip failed instrument */
      }
      done += 1;
      emitLoadProgress(done, unique.length);
    }),
  );
}

function applyChannelMix(inst: SmplrSoundfont, lane: number, channelVolumes: Record<number, number>): number {
  const ch = beatLabMelodicMixerChannel(lane);
  const pan = channelPan(ch);
  inst.output.pan = pan;
  const volGain = channelVolumeGain(ch, channelVolumes);
  return volGain;
}

function beatLabMelodicOutputVelocity(
  velocity: number,
  volGain: number,
  instrumentGain = 1,
): number {
  const timbre = Math.max(0.5, Math.min(2.25, instrumentGain));
  return Math.max(1, Math.min(127, Math.round(velocity * volGain * timbre)));
}

function pulseMelodicChannelMeter(
  ctx: AudioContext,
  lane: number,
  velocity: number,
  channelVolumes: Record<number, number>,
  whenSec: number,
): void {
  const ch = beatLabMelodicMixerChannel(lane);
  const panEntry =
    typeof window !== 'undefined'
      ? (window as unknown as { __daMusicChannelPans?: Record<number, number> }).__daMusicChannelPans?.[ch]
      : undefined;
  const panRaw = typeof panEntry === 'number' && Number.isFinite(panEntry) ? panEntry : 0;
  const panSigned = Math.max(-1, Math.min(1, panRaw / 100));
  const volGain = channelVolumeGain(ch, channelVolumes);
  const monoPeak = Math.min(1, (velocity / 127) * volGain * 0.92);
  scheduleBeatLabMeterPulseAt(ctx, ch, monoPeak, panSigned, whenSec);
}

/** Short beep when soundfont load fails — confirms audio path is live. */
function playMelodicFallbackBeep(
  ctx: AudioContext,
  lane: number,
  midi: number,
  when: number,
  velocity: number,
  channelVolumes: Record<number, number> = {},
  instrumentGain = 1,
): void {
  const t = Math.max(when, ctx.currentTime + 0.001);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 440 * 2 ** ((Math.max(0, Math.min(127, midi)) - 69) / 12);
  const ch = beatLabMelodicMixerChannel(lane);
  const volGain = channelVolumeGain(ch, channelVolumes);
  const outVel = beatLabMelodicOutputVelocity(velocity, volGain, instrumentGain);
  const vel = Math.max(0.05, Math.min(1, outVel / 127));
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel * 0.22, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  osc.connect(g);
  g.connect(masterDestination(ctx));
  osc.start(t);
  osc.stop(t + 0.32);
  pulseMelodicChannelMeter(ctx, lane, velocity, channelVolumes, t);
}

/** Play one melodic note via GM soundfont (returns smplr stop handle). */
export async function playBeatLabMelodicNote(
  ctx: AudioContext,
  opts: BeatLabMelodicPlayOpts,
): Promise<() => void> {
  const lead = opts.transportOnsetLeadSec ?? 0;
  const when =
    opts.whenLocked ??
    (lead > 0
      ? lockMelodicTransportWhen(ctx, opts.when, lead)
      : scheduleTimeForPreview(ctx, opts.when));
  const instId = opts.instrumentId || BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[0]!;
  const ready = getReadyMelodicInstrument(ctx, instId);
  if (ready) return startMelodicVoiceAt(ctx, ready, opts, when);
  const inst = await getBeatLabMelodicInstrument(ctx, instId);
  return startMelodicVoiceAt(ctx, inst, opts, when);
}

/** Synchronous transport schedule — requires {@link ensureBeatLabMelodicInstrumentsReady} on Play. */
export function scheduleBeatLabMelodicNote(
  ctx: AudioContext,
  opts: BeatLabMelodicPlayOpts,
): void {
  const lead = opts.transportOnsetLeadSec ?? 0;
  const whenLocked =
    opts.whenLocked ?? lockMelodicTransportWhen(ctx, opts.when, lead);
  const instId = opts.instrumentId || BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[0]!;
  const ready = getReadyMelodicInstrument(ctx, instId);
  if (ready) {
    try {
      startMelodicVoiceAt(ctx, ready, opts, whenLocked);
      return;
    } catch (err) {
      console.warn('[Beat Lab SYNTH] sync schedule failed:', instId, err);
    }
  }
  const epoch = melodicTransportEpoch;
  /** Async load after the grid time causes late "hesitate then hit" — never play stale hits. */
  void getBeatLabMelodicInstrument(ctx, instId)
    .then((inst) => {
      if (melodicTransportEpoch !== epoch) return;
      if (whenLocked < ctx.currentTime - 0.04) return;
      startMelodicVoiceAt(ctx, inst, opts, Math.max(whenLocked, ctx.currentTime + 0.001));
    })
    .catch((err) => {
      console.warn('[Beat Lab SYNTH] schedule note failed:', opts.instrumentId, err);
      if (melodicTransportEpoch !== epoch) return;
      if (whenLocked < ctx.currentTime - 0.04) return;
      playMelodicFallbackBeep(
        ctx,
        opts.lane,
        opts.midi,
        Math.max(whenLocked, ctx.currentTime + 0.001),
        opts.velocity,
        opts.channelVolumes,
        opts.instrumentGain ?? 1,
      );
    });
}

/** Click / key preview — short note, with oscillator fallback if samples are not ready. */
export function previewBeatLabMelodicNote(
  ctx: AudioContext,
  opts: Omit<BeatLabMelodicPlayOpts, 'durationSec'> & { durationSec?: number },
): void {
  const when = opts.when;
  void playBeatLabMelodicNote(ctx, { ...opts, durationSec: opts.durationSec ?? 0.45 }).catch((err) => {
    console.warn('[Beat Lab SYNTH] preview failed:', opts.instrumentId, err);
    invalidateBeatLabMelodicInstrument(opts.instrumentId ?? '');
    playMelodicFallbackBeep(
      ctx,
      opts.lane,
      opts.midi,
      scheduleTimeForPreview(ctx, when),
      opts.velocity,
      opts.channelVolumes,
      opts.instrumentGain ?? 1,
    );
  });
}

/** Preview keyboard / lane click — hold until stop() is called. */
export async function startBeatLabMelodicPreview(
  ctx: AudioContext,
  opts: Omit<BeatLabMelodicPlayOpts, 'durationSec'> & { durationSec?: number },
): Promise<() => void> {
  const when = scheduleTimeForPreview(ctx, opts.when ?? ctx.currentTime);
  const instId = opts.instrumentId || BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[0]!;
  const inst = await getBeatLabMelodicInstrument(ctx, instId);
  return startMelodicVoiceAt(ctx, inst, { ...opts, durationSec: opts.durationSec ?? 8 }, when);
}
