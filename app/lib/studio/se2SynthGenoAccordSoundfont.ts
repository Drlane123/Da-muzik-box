/**
 * Synth Geno accord — smplr sampled pianos / Rhodes (not oscillator synth).
 * Uses SplendidGrandPiano + ElectricPiano where possible; GM MusyngKite as fallback.
 */
import {
  ElectricPiano,
  Scheduler,
  Soundfont,
  SplendidGrandPiano,
  type Soundfont as SmplrSoundfont,
} from 'smplr';

const GENO_ACCORD_KIT = 'MusyngKite' as const;

/** smplr default ~200 ms lookahead — Geno preview schedules full loop passes at once. */
const GENO_ACCORD_SCHEDULER_LOOKAHEAD_MS = 40_000;

const transportSchedulerByCtx = new WeakMap<BaseAudioContext, ReturnType<typeof Scheduler>>();

/** Bumped on every halt — stale async smplr schedules must not fire after Stop. */
let accordPreviewSessionId = 0;

export function currentGenoAccordPreviewSession(): number {
  return accordPreviewSessionId;
}

function bumpAccordPreviewSession(): number {
  accordPreviewSessionId += 1;
  return accordPreviewSessionId;
}

function resetGenoAccordTransport(ctx: BaseAudioContext): void {
  try {
    transportSchedulerByCtx.get(ctx)?.stop();
  } catch {
    /* */
  }
  transportSchedulerByCtx.delete(ctx);
}

function genoAccordTransportScheduler(ctx: BaseAudioContext): ReturnType<typeof Scheduler> {
  let sched = transportSchedulerByCtx.get(ctx);
  if (!sched) {
    sched = Scheduler(ctx, {
      lookaheadMs: GENO_ACCORD_SCHEDULER_LOOKAHEAD_MS,
      intervalMs: 16,
    });
    transportSchedulerByCtx.set(ctx, sched);
  }
  return sched;
}

type GenoAccordSampler = {
  start: (opts: { note: number; velocity: number; time: number; duration: number }) => void;
  stop: () => void;
  load?: Promise<unknown>;
  output?: { pan: number };
};

/** Bank id → smplr instrument key (each Rhodes / piano slot is unique). */
export const GENO_ACCORD_GM_BY_BANK: Record<string, string> = {
  'rhodes-studio': 'epiano:CP80',
  'rhodes-classic': 'epiano:PianetT',
  'rhodes-bright': 'epiano:TX81Z',
  'rhodes-wurli': 'epiano:WurlitzerEP200',
  'rhodes-lofi': 'gm:electric_piano_1',
  'piano-grand': 'splendid:grand',
  'piano-upright': 'gm:honky_tonk_piano',
  'piano-rnb': 'gm:bright_acoustic_piano',
  'piano-gospel': 'gm:drawbar_organ',
};

export function genoAccordGmInstrument(bankId: string): string {
  return GENO_ACCORD_GM_BY_BANK[bankId] ?? 'epiano:CP80';
}

type GenoAccordLaneId = 'chords' | 'melody';

const instrumentCache = new Map<string, Promise<GenoAccordSampler>>();
const instrumentReady = new Map<string, GenoAccordSampler>();
let cacheCtx: AudioContext | null = null;

/** smplr connects here — we repatch this bus to the active strip (never disconnect smplr.output). */
let routableBus: GainNode | null = null;
let routableBusCtx: AudioContext | null = null;
let stereoWidenerOut: AudioNode | null = null;
let stereoWidenerCtx: AudioContext | null = null;

function cacheKey(instrumentId: string, lane: GenoAccordLaneId = 'chords'): string {
  return lane === 'chords' ? instrumentId : `${instrumentId}@melody`;
}

function ensureCache(ctx: AudioContext): void {
  if (cacheCtx === ctx) return;
  instrumentCache.clear();
  instrumentReady.clear();
  cacheCtx = ctx;
  routableBus = null;
  routableBusCtx = null;
  stereoWidenerOut = null;
  stereoWidenerCtx = null;
}

function ensureRoutableBus(ctx: AudioContext): GainNode {
  if (!routableBus || routableBusCtx !== ctx) {
    routableBus = ctx.createGain();
    routableBus.gain.value = 1;
    routableBusCtx = ctx;
    stereoWidenerOut = null;
    stereoWidenerCtx = null;
  }
  return routableBus;
}

/** Haas-style widen — GM chord samples are mono-centred; spread L/R for chorus playback. */
function ensureStereoWidener(ctx: AudioContext, monoIn: GainNode): AudioNode {
  if (stereoWidenerOut && stereoWidenerCtx === ctx) return stereoWidenerOut;

  const merger = ctx.createChannelMerger(2);
  const left = ctx.createGain();
  const right = ctx.createGain();
  const delayR = ctx.createDelay(0.05);
  delayR.delayTime.value = 0.022;
  left.gain.value = 0.92;
  right.gain.value = 0.88;

  monoIn.connect(left);
  monoIn.connect(delayR);
  delayR.connect(right);
  left.connect(merger, 0, 0);
  right.connect(merger, 0, 1);

  stereoWidenerOut = merger;
  stereoWidenerCtx = ctx;
  return merger;
}

/** Repatch accord bus to the current preview / transport strip input. */
function routeAccordBusTo(dest: AudioNode): void {
  const bus = routableBus;
  if (!bus || !routableBusCtx) return;
  unmuteAccordPreviewBus(routableBusCtx);
  const widener = ensureStereoWidener(routableBusCtx, bus);
  try {
    widener.disconnect();
  } catch {
    /* */
  }
  widener.connect(dest);
}

function parseAccordInstrumentKey(id: string): {
  kind: 'gm' | 'splendid' | 'epiano';
  gmId?: string;
  epianoModel?: string;
} {
  if (id.startsWith('splendid:')) return { kind: 'splendid' };
  if (id.startsWith('epiano:')) return { kind: 'epiano', epianoModel: id.slice('epiano:'.length) };
  if (id.startsWith('gm:')) return { kind: 'gm', gmId: id.slice('gm:'.length) };
  return { kind: 'gm', gmId: id };
}

function createAccordSampler(
  ctx: AudioContext,
  instrumentId: string,
  bus: GainNode,
): GenoAccordSampler {
  const parsed = parseAccordInstrumentKey(instrumentId);
  const sched = genoAccordTransportScheduler(ctx);

  if (parsed.kind === 'splendid') {
    return SplendidGrandPiano(ctx, {
      destination: bus,
      volume: 96,
      scheduler: sched,
    });
  }

  if (parsed.kind === 'epiano' && parsed.epianoModel) {
    return ElectricPiano(ctx, {
      instrument: parsed.epianoModel,
      destination: bus,
      volume: 94,
      scheduler: sched,
    });
  }

  const gmId = parsed.gmId || 'electric_piano_1';
  return Soundfont(ctx, {
    instrument: gmId,
    kit: GENO_ACCORD_KIT,
    destination: bus,
    volume: 100,
    scheduler: sched,
  }) as SmplrSoundfont;
}

export function getGenoAccordInstrument(
  ctx: AudioContext,
  instrumentId: string,
  dest: AudioNode,
  lane: GenoAccordLaneId = 'chords',
): Promise<GenoAccordSampler> {
  ensureCache(ctx);
  const bus = ensureRoutableBus(ctx);
  routeAccordBusTo(dest);
  const id = instrumentId || 'epiano:CP80';
  const key = cacheKey(id, lane);
  let pending = instrumentCache.get(key);
  if (!pending) {
    pending = (async () => {
      const inst = createAccordSampler(ctx, id, bus);
      if (inst.load) await inst.load;
      instrumentReady.set(key, inst);
      return inst;
    })().catch((err) => {
      instrumentCache.delete(key);
      instrumentReady.delete(key);
      throw err;
    });
    instrumentCache.set(key, pending);
  } else {
    routeAccordBusTo(dest);
  }
  return pending;
}

/** Spread chord tones left–right by pitch (low = left, high = right). */
function genoChordNotePan(pitch: number): number {
  return Math.max(-0.58, Math.min(0.58, ((Math.round(pitch) - 67) / 16) * 0.55));
}

function startAt(
  ctx: AudioContext,
  inst: GenoAccordSampler,
  dest: AudioNode,
  when: number,
  durationSec: number,
  pitch: number,
  velocity: number,
  pan?: number,
): void {
  routeAccordBusTo(dest);
  const t = Math.max(when, ctx.currentTime + 0.008);
  const dur = Math.max(0.06, durationSec);
  if (inst.output) {
    inst.output.pan = pan ?? genoChordNotePan(pitch);
  }
  inst.start({
    note: Math.max(0, Math.min(127, Math.round(pitch))),
    velocity: Math.max(1, Math.min(127, Math.round(velocity))),
    time: t,
    duration: dur,
  });
}

/** Polyphonic melody hits — each pitch gets its own voice (no mono retrigger clash). */
export function scheduleGenoAccordSoundfontMelodyPoly(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  hits: readonly { pitch: number; velocity: number; durationSec: number }[],
  instrumentId: string,
): void {
  if (hits.length === 0) return;
  const id = instrumentId || 'epiano:CP80';
  const sessionAtSchedule = currentGenoAccordPreviewSession();
  routeAccordBusTo(dest);
  const ready = instrumentReady.get(cacheKey(id, 'melody'));

  const playHits = (inst: GenoAccordSampler) => {
    if (sessionAtSchedule !== currentGenoAccordPreviewSession()) return;
    const t = Math.max(when, ctx.currentTime + 0.008);
    if (t < ctx.currentTime - 0.02) return;
    if (inst.output) inst.output.pan = 0;
    for (const hit of hits) {
      const dur = Math.max(0.05, hit.durationSec);
      inst.start({
        note: Math.max(0, Math.min(127, Math.round(hit.pitch))),
        velocity: Math.max(1, Math.min(127, Math.round(hit.velocity))),
        time: t,
        duration: dur,
      });
    }
  };

  if (ready) {
    try {
      playHits(ready);
      return;
    } catch (err) {
      console.warn('[Synth Geno] melody poly failed, retrying load:', id, err);
      instrumentReady.delete(cacheKey(id, 'melody'));
      instrumentCache.delete(cacheKey(id, 'melody'));
    }
  }
  void getGenoAccordInstrument(ctx, id, dest, 'melody')
    .then((inst) => {
      if (sessionAtSchedule !== currentGenoAccordPreviewSession()) return;
      if (when < ctx.currentTime - 0.08) return;
      playHits(inst);
    })
    .catch((err) => {
      console.warn('[Synth Geno] melody poly failed — triangle fallback:', id, err);
      if (when < ctx.currentTime - 0.08) return;
      const t = Math.max(when, ctx.currentTime + 0.008);
      for (const hit of hits) {
        playAccordFallbackBeep(ctx, dest, t, Math.max(0.05, hit.durationSec), hit.pitch, hit.velocity);
      }
    });
}

/**
 * Rip Chord / Chord Prism block chord — every tone at the same time, centered pan.
 * Per-note pan on a shared smplr output breaks simultaneous stacks.
 */
export function scheduleGenoAccordSoundfontChord(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  durationSec: number,
  pitches: readonly number[],
  velocity: number,
  instrumentId: string,
  lane: GenoAccordLaneId = 'chords',
): void {
  const id = instrumentId || 'epiano:CP80';
  const unique = [...new Set(pitches.map((p) => Math.round(p)))].sort((a, b) => a - b);
  if (unique.length === 0) return;
  const sessionAtSchedule = currentGenoAccordPreviewSession();

  routeAccordBusTo(dest);
  const ready = instrumentReady.get(cacheKey(id, lane));
  const playBlock = (inst: GenoAccordSampler) => {
    if (sessionAtSchedule !== currentGenoAccordPreviewSession()) return;
    const t = Math.max(when, ctx.currentTime + 0.008);
    if (t < ctx.currentTime - 0.02) return;
    const dur = Math.max(0.06, durationSec);
    const velBase = Math.max(1, Math.min(127, Math.round(velocity)));
    if (inst.output) inst.output.pan = 0;
    for (let i = 0; i < unique.length; i += 1) {
      const pitch = unique[i]!;
      const vel = Math.max(1, Math.min(127, velBase - Math.floor(i * 0.6)));
      inst.start({
        note: Math.max(0, Math.min(127, pitch)),
        velocity: vel,
        time: t,
        duration: dur,
      });
    }
  };

  if (ready) {
    try {
      playBlock(ready);
      return;
    } catch (err) {
      console.warn('[Synth Geno] accord chord block failed, retrying load:', id, err);
      instrumentReady.delete(cacheKey(id, lane));
      instrumentCache.delete(cacheKey(id, lane));
    }
  }
  void getGenoAccordInstrument(ctx, id, dest, lane)
    .then((inst) => {
      if (sessionAtSchedule !== currentGenoAccordPreviewSession()) return;
      if (when < ctx.currentTime - 0.08) return;
      playBlock(inst);
    })
    .catch((err) => {
      console.warn('[Synth Geno] accord chord block failed — triangle fallback:', id, err);
      if (when < ctx.currentTime - 0.08) return;
      const t = Math.max(when, ctx.currentTime + 0.008);
      const dur = Math.max(0.08, durationSec);
      for (const pitch of unique) {
        playAccordFallbackBeep(ctx, dest, t, dur, pitch, velocity);
      }
    });
}

function playAccordFallbackBeep(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  durationSec: number,
  pitch: number,
  velocity: number,
): void {
  const t = Math.max(when, ctx.currentTime + 0.008);
  const dur = Math.max(0.08, durationSec);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 440 * 2 ** ((Math.max(0, Math.min(127, pitch)) - 69) / 12);
  const vel = Math.max(0.05, Math.min(1, velocity / 127));
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel * 0.28, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Schedule one chord note from sampled piano / Rhodes. */
export function scheduleGenoAccordSoundfontNote(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  durationSec: number,
  pitch: number,
  velocity: number,
  instrumentId: string,
  lane: GenoAccordLaneId = 'chords',
): void {
  const id = instrumentId || 'epiano:CP80';
  const sessionAtSchedule = currentGenoAccordPreviewSession();
  routeAccordBusTo(dest);
  const ready = instrumentReady.get(cacheKey(id, lane));
  const play = (inst: GenoAccordSampler) => {
    if (sessionAtSchedule !== currentGenoAccordPreviewSession()) return;
    startAt(ctx, inst, dest, when, durationSec, pitch, velocity);
  };
  if (ready) {
    try {
      play(ready);
      return;
    } catch (err) {
      console.warn('[Synth Geno] accord schedule failed, retrying load:', id, err);
      instrumentReady.delete(cacheKey(id, lane));
      instrumentCache.delete(cacheKey(id, lane));
    }
  }
  void getGenoAccordInstrument(ctx, id, dest, lane)
    .then((inst) => {
      if (sessionAtSchedule !== currentGenoAccordPreviewSession()) return;
      if (when < ctx.currentTime - 0.08) return;
      play(inst);
    })
    .catch((err) => {
      console.warn('[Synth Geno] accord soundfont failed — triangle fallback:', id, err);
      if (when < ctx.currentTime - 0.08) return;
      playAccordFallbackBeep(ctx, dest, when, durationSec, pitch, velocity);
    });
}

/** Preload accord instruments before preview / transport. */
export async function warmupGenoAccordSoundfont(
  ctx: AudioContext,
  dest: AudioNode,
  instrumentIds: readonly string[],
  lanes: readonly GenoAccordLaneId[] = ['chords'],
): Promise<void> {
  routeAccordBusTo(dest);
  const unique = [...new Set(instrumentIds.filter(Boolean))];
  const jobs: Promise<unknown>[] = [];
  for (const id of unique) {
    for (const lane of lanes) {
      jobs.push(getGenoAccordInstrument(ctx, id, dest, lane).catch(() => undefined));
    }
  }
  await Promise.all(jobs);
}

function unmuteAccordPreviewBus(ctx: AudioContext): void {
  if (routableBus && routableBusCtx === ctx) {
    routableBus.gain.setValueAtTime(1, ctx.currentTime);
  }
}

function stopAllAccordInstruments(): void {
  for (const inst of instrumentReady.values()) {
    try {
      inst.stop();
    } catch {
      /* */
    }
  }
  instrumentReady.clear();
  instrumentCache.clear();
}

/** Disconnect accord preview bus — stale smplr voices cannot leak when bus is unmuted again. */
function teardownAccordPreviewBus(ctx: AudioContext): void {
  if (routableBus && routableBusCtx === ctx) {
    const t = ctx.currentTime;
    try {
      routableBus.gain.cancelScheduledValues(t);
      routableBus.gain.setValueAtTime(0, t);
      routableBus.disconnect();
    } catch {
      /* */
    }
    routableBus = null;
    routableBusCtx = null;
  }
  if (stereoWidenerOut && stereoWidenerCtx === ctx) {
    try {
      stereoWidenerOut.disconnect();
    } catch {
      /* */
    }
    stereoWidenerOut = null;
    stereoWidenerCtx = null;
  }
}

/** Drop queued smplr events between loop passes — same preview session. */
export function clearGenoAccordPassQueue(ctx: AudioContext): void {
  resetGenoAccordTransport(ctx);
  for (const inst of instrumentReady.values()) {
    try {
      inst.stop();
    } catch {
      /* */
    }
  }
}

/** Hard-stop accord preview — kills smplr queue, voices, and bus (not a mute). */
export function haltGenoAccordPreviewNotes(ctx?: AudioContext | null): void {
  bumpAccordPreviewSession();
  stopAllAccordInstruments();
  if (ctx) {
    resetGenoAccordTransport(ctx);
    teardownAccordPreviewBus(ctx);
  }
}

/** Fresh accord bus + full level before the next preview pass. */
export function primeGenoAccordPreviewBus(ctx: AudioContext): void {
  ensureRoutableBus(ctx);
  unmuteAccordPreviewBus(ctx);
}

export function genoAccordUsesSoundfont(gmInstrumentId: string | undefined): boolean {
  return typeof gmInstrumentId === 'string' && gmInstrumentId.length > 0;
}
