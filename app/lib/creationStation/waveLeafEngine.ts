/**
 * Groove Lead — standalone smooth lead synth (Web Audio).
 * Transport + roll preview schedule ahead; mono choke must not kill future notes at schedule time.
 */
import {
  getLoadedGuitarLickDefs,
  playGuitarLickSample,
  truncateGrooveLabGuitarLickMonoGroup,
} from '@/app/lib/creationStation/grooveLabGuitarLickBank';
import type { WaveLeafPreset } from '@/app/lib/creationStation/waveLeafPresets';
import { resolveGrooveLabChannelDest } from '@/app/lib/creationStation/grooveLabAudio';
import { waveLeafClampMidi } from '@/app/lib/creationStation/waveLeafPitch';

const MONO_GROUP = 'wave-leaf-lead';

/** Groove Lab transport — instant pitch on grid (preview keeps panel glide). */
export const WAVE_LEAF_TRANSPORT_CHORD_SNAP_GLIDE_MS = 0;

/** Pull Groove Lead onset earlier than block chords so lead locks with chord downbeat (ms). */
export const WAVE_LEAF_TRANSPORT_ONSET_LEAD_MS = 42;

let lastMidi: number | null = null;

type WaveLeafMonoStop = (stopAt: number) => void;

const monoStops = new Map<string, WaveLeafMonoStop>();

function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function scheduleTime(ctx: AudioContext, when: number, transportSnap?: boolean): number {
  if (transportSnap) return when;
  return Math.max(when, ctx.currentTime + 0.008);
}

/** Choke prior voice at `whenSec` (audio time), not at schedule-call time — mirrors grooveLabLeadVoices. */
function truncateWaveLeafMono(ctx: AudioContext, whenSec: number, group = MONO_GROUP): void {
  const stop = monoStops.get(group);
  monoStops.delete(group);
  if (!stop) return;
  try {
    stop(whenSec);
  } catch {
    monoStops.delete(group);
  }
}

function registerWaveLeafMonoStop(
  ctx: AudioContext,
  group: string,
  stop: WaveLeafMonoStop,
): void {
  monoStops.set(group, stop);
}

export type WaveLeafPlayOpts = {
  preset: WaveLeafPreset;
  velocity?: number;
  glideMs?: number;
  brightness?: number;
  warmth?: number;
  drive?: number;
  bpm?: number;
  holdBeats?: number;
  outputGain?: number;
  /** User macro — 0 = no pitch wobble (default). Preset vibrato is not applied unless this is set. */
  vibratoDepthCents?: number;
  destination?: AudioNode;
  /** Groove Lead line mixer CH — used when destination is omitted. */
  melodyChannel?: number;
  channelVolumes?: Record<number, number>;
  monophonic?: boolean;
  /** Tight grid playback with block chords — short glide + fast attack (not panel preview). */
  transportChordSnap?: boolean;
  /** Per-lane mono choke group (SE2 multi Groove Lead tracks). */
  monoGroup?: string;
  /** Override preset amp attack for soft flute puff (seconds). */
  ampAttackSec?: number;
};

export function haltWaveLeafVoices(): void {
  for (const [group, stop] of monoStops) {
    try {
      stop(0);
    } catch {
      /* */
    }
    monoStops.delete(group);
  }
  truncateGrooveLabGuitarLickMonoGroup(0, MONO_GROUP);
  lastMidi = null;
}

export function playWaveLeafNote(
  ctx: AudioContext,
  midi: number,
  when: number,
  opts: WaveLeafPlayOpts,
): void {
  const m = waveLeafClampMidi(midi);
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
  const snap = opts.transportChordSnap === true;
  const t0 = scheduleTime(ctx, when, snap);
  const vel = Math.max(0.05, Math.min(1, opts.velocity ?? 0.88));
  const preset = opts.preset;
  const userGlide = opts.glideMs ?? preset.glideMs;
  const glideMs = snap ? WAVE_LEAF_TRANSPORT_CHORD_SNAP_GLIDE_MS : userGlide;
  const brightness = Math.max(0.35, Math.min(1.6, opts.brightness ?? 1));
  const warmth = Math.max(0.5, Math.min(1.4, opts.warmth ?? 1));
  const driveAmt = Math.max(0, Math.min(1, opts.drive ?? preset.drive));
  const holdBeats = Math.max(0.25, opts.holdBeats ?? 1.5);
  const bpm = Math.max(40, opts.bpm ?? 100);
  let sustainSec = (holdBeats * 60) / bpm;

  const monoGroup = opts.monoGroup?.trim() || MONO_GROUP;
  if (opts.monophonic !== false) {
    truncateWaveLeafMono(ctx, t0, monoGroup);
    truncateGrooveLabGuitarLickMonoGroup(t0, monoGroup);
  }

  const melodyCh = opts.melodyChannel;
  const dest =
    opts.destination ??
    (melodyCh != null && Number.isFinite(melodyCh)
      ? resolveGrooveLabChannelDest(ctx, melodyCh, opts.channelVolumes)
      : ctx.destination);
  const out = Math.max(0.35, Math.min(1, opts.outputGain ?? 0.82));
  const peak = vel * 0.72 * warmth * out;

  const lickId = preset.sampleLickId?.trim();
  if (lickId) {
    if (preset.samplePluck !== false) {
      sustainSec = Math.min(sustainSec, 0.58);
    }
    const def = getLoadedGuitarLickDefs().find((d) => d.id === lickId);
    if (def) {
      const played = playGuitarLickSample(ctx, def, m, t0, vel * warmth, sustainSec, {
        monophonic: opts.monophonic,
        monoGroup,
        outputNode: dest,
        transportClean: snap,
        wahAmount: preset.sampleWah ?? 0,
        wahRateHz: preset.sampleWahRateHz,
        drive: Math.max(driveAmt, preset.sampleDrive ?? 0),
      });
      if (played) {
        lastMidi = m;
        return;
      }
    }
  }

  const amp = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const fBase = preset.filterHz * brightness;
  if (snap) {
    filter.frequency.setValueAtTime(Math.min(14000, fBase), t0);
  } else {
    filter.frequency.setValueAtTime(Math.max(180, fBase * 0.35), t0);
    filter.frequency.linearRampToValueAtTime(Math.min(14000, fBase), t0 + preset.filterAttack);
    filter.frequency.linearRampToValueAtTime(
      Math.min(12000, fBase * (0.45 + preset.filterSustain * 0.55)),
      t0 + preset.filterAttack + preset.filterDecay,
    );
  }
  filter.Q.value = preset.filterQ;

  let shaper: WaveShaperNode | null = null;
  if (driveAmt > 0.02) {
    shaper = ctx.createWaveShaper();
    const k = 2 + driveAmt * 40;
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i += 1) {
      const x = (i * 2) / 256 - 1;
      curve[i] = Math.tanh(x * k);
    }
    shaper.curve = curve;
  }

  const chorus = ctx.createGain();
  chorus.gain.value = preset.chorusMix * 0.35;

  amp.connect(filter);
  if (shaper) filter.connect(shaper).connect(chorus);
  else filter.connect(chorus);
  chorus.connect(dest);

  const d = preset.ampDecay;
  const s = preset.ampSustain * peak;
  const r = preset.ampRelease;
  if (snap) {
    amp.gain.setValueAtTime(peak, t0);
    amp.gain.linearRampToValueAtTime(s, t0 + Math.min(d, 0.04));
    amp.gain.setTargetAtTime(0.0001, t0 + sustainSec, r);
  } else {
    const a = opts.ampAttackSec ?? preset.ampAttack;
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(peak, t0 + a);
    amp.gain.linearRampToValueAtTime(s, t0 + a + d);
    amp.gain.setTargetAtTime(0.0001, t0 + sustainSec, r);
  }

  const glideSec = Math.max(0, glideMs) / 1000;
  const fromHz = lastMidi != null && glideSec > 0 ? midiToHz(lastMidi) : midiToHz(m);
  const toHz = midiToHz(m);

  const vibratoDepth = Math.max(0, opts.vibratoDepthCents ?? 0);
  const vibratoHz = preset.vibratoHz > 0 ? preset.vibratoHz : 5.5;
  const oscs: OscillatorNode[] = [];

  /** One clean voice + optional unison layer (no ±detune stack — that caused "ran ran" beating). */
  const startOsc = (o: OscillatorNode, gain: number, detuneCents: number) => {
    const og = ctx.createGain();
    og.gain.value = gain;
    o.detune.value = detuneCents;
    if (glideSec > 0 && lastMidi != null) {
      o.frequency.setValueAtTime(fromHz, t0);
      o.frequency.exponentialRampToValueAtTime(toHz, t0 + glideSec);
    } else {
      o.frequency.setValueAtTime(toHz, t0);
    }
    if (vibratoDepth > 0 && vibratoHz > 0) {
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = vibratoHz;
      lfoG.gain.value = vibratoDepth;
      lfo.connect(lfoG).connect(o.detune);
      lfo.start(t0);
      lfo.stop(t0 + sustainSec + r + 0.2);
    }
    o.connect(og).connect(amp);
    o.start(t0);
    o.stop(t0 + sustainSec + r + 0.25);
    oscs.push(o);
  };

  const primary = ctx.createOscillator();
  primary.type = preset.osc1;
  startOsc(primary, 0.78, 0);

  if (preset.osc2Level > 0.12) {
    const layer = ctx.createOscillator();
    layer.type = preset.osc2;
    startOsc(layer, preset.osc2Level * 0.55, 0);
  }

  lastMidi = m;

  registerWaveLeafMonoStop(ctx, monoGroup, (stopAt) => {
    const t = Math.max(stopAt, ctx.currentTime);
    try {
      amp.gain.cancelScheduledValues(t);
      amp.gain.setValueAtTime(0, t);
      amp.gain.setTargetAtTime(0.0001, t, 0.008);
      for (const o of oscs) {
        try {
          o.stop(t + 0.04);
        } catch {
          /* already ended */
        }
      }
    } catch {
      /* context gone */
    }
    monoStops.delete(MONO_GROUP);
  });
}
