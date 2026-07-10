/**
 * Live Chord — string-section glide between voiced chords (voice-leading pitch bends).
 */
export type Se2LiveChordGlideOpts = {
  enabled: boolean;
  /** Portamento time between chord changes (seconds). */
  glideSec?: number;
  /** Sustain length after attack (seconds). */
  durationSec?: number;
};

type ActiveVoice = {
  id: number;
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  gain: GainNode;
  filter: BiquadFilterNode;
  pitch: number;
};

type GlideSession = {
  voices: ActiveVoice[];
  lastTones: number[];
  nextVoiceId: number;
};

const sessions = new Map<string, GlideSession>();

function midiToHz(midi: number): number {
  return 440 * 2 ** ((Math.max(0, Math.min(127, Math.round(midi))) - 69) / 12);
}

export type LiveChordVoicePair = { from?: number; to: number };

/** Greedy minimum-distance voice leading between two chord tone sets. */
export function planLiveChordVoiceLeading(
  fromTones: readonly number[],
  toTones: readonly number[],
): LiveChordVoicePair[] {
  const sortedTo = [...new Set(toTones.map((p) => Math.round(p)))].sort((a, b) => a - b);
  const pool = [...new Set(fromTones.map((p) => Math.round(p)))];
  const pairs: LiveChordVoicePair[] = [];

  for (const to of sortedTo) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < pool.length; i += 1) {
      const from = pool[i]!;
      const dist = Math.abs(from - to);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      pairs.push({ from: pool[bestIdx], to });
      pool.splice(bestIdx, 1);
    } else {
      pairs.push({ to });
    }
  }
  return pairs;
}

function spawnVoice(
  ctx: AudioContext,
  dest: AudioNode,
  pitch: number,
  t0: number,
  glideFrom: number | undefined,
  glideSec: number,
  durationSec: number,
): ActiveVoice {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2800, t0);
  filter.Q.setValueAtTime(0.7, t0);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.11, t0 + 0.045);
  gain.gain.setValueAtTime(0.09, t0 + durationSec - 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);

  const targetHz = midiToHz(pitch);
  const startHz = glideFrom != null ? midiToHz(glideFrom) : targetHz;

  const osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(startHz, t0);
  if (glideFrom != null && Math.abs(glideFrom - pitch) > 0 && glideSec > 0.001) {
    osc1.frequency.exponentialRampToValueAtTime(Math.max(20, targetHz), t0 + glideSec);
  }

  const osc2 = ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.detune.setValueAtTime(7, t0);
  osc2.frequency.setValueAtTime(startHz, t0);
  if (glideFrom != null && Math.abs(glideFrom - pitch) > 0 && glideSec > 0.001) {
    osc2.frequency.exponentialRampToValueAtTime(Math.max(20, targetHz), t0 + glideSec);
  }

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  osc1.start(t0);
  osc2.start(t0);
  osc1.stop(t0 + durationSec + 0.05);
  osc2.stop(t0 + durationSec + 0.05);

  return { id: -1, osc1, osc2, gain, filter, pitch };
}

function fadeOutVoice(voice: ActiveVoice, ctx: AudioContext, t0: number, sec = 0.1): void {
  const t = Math.max(t0, ctx.currentTime);
  try {
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), t);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, t + sec);
    voice.osc1.stop(t + sec + 0.02);
    voice.osc2.stop(t + sec + 0.02);
  } catch {
    /* voice may already be stopped */
  }
}

function rampVoicePitch(voice: ActiveVoice, toPitch: number, t0: number, glideSec: number): void {
  const targetHz = midiToHz(toPitch);
  voice.osc1.frequency.cancelScheduledValues(t0);
  voice.osc2.frequency.cancelScheduledValues(t0);
  voice.osc1.frequency.setValueAtTime(voice.osc1.frequency.value, t0);
  voice.osc2.frequency.setValueAtTime(voice.osc2.frequency.value, t0);
  voice.osc1.frequency.exponentialRampToValueAtTime(Math.max(20, targetHz), t0 + glideSec);
  voice.osc2.frequency.exponentialRampToValueAtTime(Math.max(20, targetHz), t0 + glideSec);
  voice.pitch = toPitch;
}

export function haltSe2LiveChordGlideSession(sessionKey: string, ctx?: AudioContext | null): void {
  const session = sessions.get(sessionKey);
  if (!session) return;
  const t0 = ctx?.currentTime ?? 0;
  for (const voice of session.voices) {
    if (ctx) fadeOutVoice(voice, ctx, t0, 0.06);
    else {
      try {
        voice.osc1.stop();
        voice.osc2.stop();
      } catch {
        /* */
      }
    }
  }
  sessions.delete(sessionKey);
}

/** Play a voiced chord block with optional portamento from the previous chord in this session. */
export function playSe2LiveChordGlide(
  ctx: AudioContext,
  dest: AudioNode,
  sessionKey: string,
  tones: readonly number[],
  opts: Se2LiveChordGlideOpts,
): void {
  if (!opts.enabled || tones.length === 0) return;

  const t0 = Math.max(ctx.currentTime + 0.012, ctx.currentTime);
  const glideSec = Math.max(0.04, Math.min(0.55, opts.glideSec ?? 0.24));
  const durationSec = Math.max(0.5, opts.durationSec ?? 2.8);
  const uniqueTones = [...new Set(tones.map((p) => Math.round(p)))].sort((a, b) => a - b);

  let session = sessions.get(sessionKey);
  if (!session) {
    session = { voices: [], lastTones: [], nextVoiceId: 1 };
    sessions.set(sessionKey, session);
  }

  const pairs = planLiveChordVoiceLeading(session.lastTones, uniqueTones);
  const usedVoiceIds = new Set<number>();
  const nextVoices: ActiveVoice[] = [];

  for (const pair of pairs) {
    const reusable =
      pair.from != null
        ? session.voices.find((v) => v.pitch === pair.from && !usedVoiceIds.has(v.id))
        : undefined;

    if (reusable) {
      usedVoiceIds.add(reusable.id);
      rampVoicePitch(reusable, pair.to, t0, glideSec);
      reusable.gain.gain.cancelScheduledValues(t0);
      reusable.gain.gain.setValueAtTime(Math.max(0.06, reusable.gain.gain.value), t0);
      reusable.gain.gain.setValueAtTime(0.09, t0 + durationSec - 0.35);
      reusable.gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
      nextVoices.push(reusable);
      continue;
    }

    const voice = spawnVoice(ctx, dest, pair.to, t0, pair.from, pair.from != null ? glideSec : 0, durationSec);
    voice.id = session.nextVoiceId;
    session.nextVoiceId += 1;
    nextVoices.push(voice);
  }

  for (const voice of session.voices) {
    if (!usedVoiceIds.has(voice.id)) fadeOutVoice(voice, ctx, t0, 0.12);
  }

  session.voices = nextVoices;
  session.lastTones = uniqueTones;
}

export function resetSe2LiveChordGlideSession(sessionKey: string): void {
  sessions.delete(sessionKey);
}

export function haltAllSe2LiveChordGlideSessions(ctx?: AudioContext | null): void {
  for (const key of [...sessions.keys()]) {
    haltSe2LiveChordGlideSession(key, ctx);
  }
}
