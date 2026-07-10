/**
 * Synth Geno — SE2-native Web Audio voice (preview + transport).
 */
import type { Se2SynthGenoOscWave, Se2SynthGenoVoiceParams } from '@/app/lib/studio/se2SynthGenoTypes';
import {
  genoAccordUsesSoundfont,
  scheduleGenoAccordSoundfontNote,
} from '@/app/lib/studio/se2SynthGenoAccordSoundfont';
import { se2FusionInterpolateCurveAt } from '@/app/lib/studio/se2SynthGenoFusionFlexCurve';
import {
  GENO_KEY_TRACKING_FACTOR,
  se2SynthGenoMidiToHz,
  se2SynthGenoOscDetuneCents,
} from '@/app/lib/studio/se2SynthGenoTuning';

function toOscType(w: Se2SynthGenoOscWave): OscillatorType {
  if (w === 'saw') return 'sawtooth';
  return w;
}

function scheduleTime(ctx: AudioContext, when: number): number {
  return Math.max(when, ctx.currentTime + 0.008);
}

function peakFromVelocity(velocity: number, voice: Se2SynthGenoVoiceParams): number {
  const out = Math.max(0, Math.min(1, voice.outputLevel ?? 0.48));
  const roleBoost =
    voice.role === 'keys' || voice.role === 'pad' ? 1.08
    : voice.role === 'lead' || voice.role === 'pluck' || voice.role === 'bell' ? 1.04
    : 1;
  return Math.max(0.0002, Math.min(0.42, (velocity / 127) * out * 0.62 * roleBoost));
}

function softClipCurve(amount: number): Float32Array {
  const n = 256;
  const curve = new Float32Array(n);
  const drive = 1 + amount * 4.5;
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  return curve;
}

/** Straight chord patch — no unison wobble, FX, or filter sweep (effects live in piano roll later). */
function isGenoStraightAccordVoice(voice: Se2SynthGenoVoiceParams): boolean {
  return (
    voice.role === 'keys'
    && (voice.unisonVoices ?? 1) <= 1
    && (voice.unisonDetuneCents ?? 0) <= 0.5
    && voice.chorusMix <= 0.02
    && voice.reverbMix <= 0.02
    && voice.delayMix <= 0.02
    && voice.distortion <= 0.02
  );
}

export type Se2SynthGenoNoteScheduleOpts = {
  glideFromPitch?: number;
  glideSec?: number;
  /** Intra-note pitch bend — curve points in beats from note start (MIDISketch / bend-range glide). */
  flexCurve?: readonly { beatOffset: number; pitch: number }[];
  flexDurationBeats?: number;
  bpm?: number;
};

function beatOffsetToSec(beatOffset: number, bpm: number): number {
  return (beatOffset * 60) / Math.max(40, bpm);
}

/** Schedule oscillator frequency along a Note Flex curve (continuous pitch bend while note rings). */
function applyIntraNoteFlexCurveToOsc(
  o: OscillatorNode,
  when: number,
  bpm: number,
  curve: readonly { beatOffset: number; pitch: number }[],
): void {
  if (curve.length < 2) return;
  const sorted = [...curve].sort((a, b) => a.beatOffset - b.beatOffset);
  for (let i = 0; i < sorted.length; i += 1) {
    const pt = sorted[i]!;
    const t = when + beatOffsetToSec(pt.beatOffset, bpm);
    const hz = Math.max(20, se2SynthGenoMidiToHz(pt.pitch, GENO_KEY_TRACKING_FACTOR));
    if (i === 0) {
      o.frequency.setValueAtTime(hz, when);
    } else {
      o.frequency.exponentialRampToValueAtTime(hz, Math.max(when + 0.001, t));
    }
  }
}

/** Standard pitch: A440 Hz, key tracking 1.0, coarse 0, fine via detune only. */
function applyOscStandardPitch(
  o: OscillatorNode,
  baseHz: number,
  detuneCents: number,
  t0: number,
  glide?: { fromHz: number; sec: number },
): void {
  const coarseSemitones = 0;
  const fineCents = 0;
  o.detune.setValueAtTime(
    se2SynthGenoOscDetuneCents(coarseSemitones, fineCents) + detuneCents,
    t0,
  );

  const target = Math.max(20, baseHz);
  if (glide && glide.sec > 0.001) {
    const from = Math.max(20, glide.fromHz);
    if (Math.abs(from - target) > 0.5) {
      o.frequency.setValueAtTime(from, t0);
      o.frequency.exponentialRampToValueAtTime(target, t0 + glide.sec);
      return;
    }
  }
  o.frequency.setValueAtTime(target, t0);
}

function wireGenoFx(
  ctx: AudioContext,
  source: AudioNode,
  stripOutput: AudioNode,
  voice: Se2SynthGenoVoiceParams,
  peak: number,
  t0: number,
  tEnd: number,
): void {
  const dry = ctx.createGain();
  dry.gain.setValueAtTime(1, t0);
  source.connect(dry);
  dry.connect(stripOutput);

  const fxMix = peak * 0.55;

  if (voice.chorusMix > 0.02) {
    const chorusDelay = ctx.createDelay(0.08);
    chorusDelay.delayTime.setValueAtTime(0.016 + voice.chorusMix * 0.012, t0);
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.55 + voice.chorusMix * 0.9, t0);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.002 + voice.chorusMix * 0.004, t0);
    lfo.connect(lfoGain);
    lfoGain.connect(chorusDelay.delayTime);
    const wet = ctx.createGain();
    wet.gain.setValueAtTime(voice.chorusMix * fxMix * 0.42, t0);
    source.connect(chorusDelay);
    chorusDelay.connect(wet);
    wet.connect(stripOutput);
    lfo.start(t0);
    lfo.stop(tEnd + 0.08);
  }

  if (voice.delayMix > 0.02) {
    const dly = ctx.createDelay(2.5);
    const delaySec =
      voice.role === 'pluck' || voice.role === 'bell' ? 0.22
      : voice.role === 'lead' ? 0.28
      : 0.18;
    dly.delayTime.setValueAtTime(delaySec, t0);
    const fb = ctx.createGain();
    fb.gain.setValueAtTime(0.28 + voice.delayMix * 0.35, t0);
    const wet = ctx.createGain();
    wet.gain.setValueAtTime(voice.delayMix * fxMix * 0.48, t0);
    source.connect(dly);
    dly.connect(fb);
    fb.connect(dly);
    dly.connect(wet);
    wet.connect(stripOutput);
  }

  if (voice.reverbMix > 0.02) {
    const pre = ctx.createDelay(0.08);
    pre.delayTime.setValueAtTime(0.014 + voice.reverbMix * 0.02, t0);
    const tank = ctx.createDelay(0.55);
    tank.delayTime.setValueAtTime(0.038 + voice.reverbMix * 0.06, t0);
    const fb = ctx.createGain();
    fb.gain.setValueAtTime(0.22 + voice.reverbMix * 0.42, t0);
    const wet = ctx.createGain();
    wet.gain.setValueAtTime(voice.reverbMix * fxMix * 0.38, t0);
    source.connect(pre);
    pre.connect(tank);
    tank.connect(fb);
    fb.connect(tank);
    tank.connect(wet);
    wet.connect(stripOutput);
  }
}

export function scheduleSe2SynthGenoNote(
  ctx: AudioContext,
  stripOutput: AudioNode,
  when: number,
  tOff: number,
  pitch: number,
  velocity: number,
  voice: Se2SynthGenoVoiceParams,
  scheduleOpts?: Se2SynthGenoNoteScheduleOpts,
): void {
  const flexCurve = scheduleOpts?.flexCurve;
  const flexBpm = scheduleOpts?.bpm;
  const hasFlex = (flexCurve?.length ?? 0) >= 2 && flexBpm != null && flexBpm > 0;

  if (voice.role === 'keys' && genoAccordUsesSoundfont(voice.gmInstrumentId) && hasFlex) {
    const durationBeats = Math.max(1 / 32, scheduleOpts?.flexDurationBeats ?? 1);
    const step = 1 / 8;
    let t = 0;
    while (t < durationBeats - 1e-6) {
      const sliceDur = Math.min(step, durationBeats - t);
      const mid = t + sliceDur * 0.5;
      const slicePitch = se2FusionInterpolateCurveAt(flexCurve!, mid, pitch);
      const sliceStart = when + beatOffsetToSec(t, flexBpm!);
      const sliceDurSec = beatOffsetToSec(sliceDur, flexBpm!);
      scheduleGenoAccordSoundfontNote(
        ctx,
        stripOutput,
        sliceStart,
        Math.max(0.04, sliceDurSec * 0.95),
        slicePitch,
        velocity,
        voice.gmInstrumentId!,
      );
      t += sliceDur;
    }
    return;
  }

  if (voice.role === 'keys' && genoAccordUsesSoundfont(voice.gmInstrumentId)) {
    const dur = Math.max(0.08, tOff - when);
    scheduleGenoAccordSoundfontNote(
      ctx,
      stripOutput,
      when,
      dur,
      pitch,
      velocity,
      voice.gmInstrumentId!,
    );
    return;
  }

  const t0 = scheduleTime(ctx, when);
  const t1 = Math.max(t0 + 0.04, tOff);
  const startPitch = hasFlex ? flexCurve![0]!.pitch : pitch;
  const hz = se2SynthGenoMidiToHz(startPitch, GENO_KEY_TRACKING_FACTOR);
  const glideFrom =
    !hasFlex && scheduleOpts?.glideFromPitch != null && scheduleOpts.glideFromPitch !== pitch
      ? se2SynthGenoMidiToHz(scheduleOpts.glideFromPitch, GENO_KEY_TRACKING_FACTOR)
      : undefined;
  const glideSec = Math.max(0, scheduleOpts?.glideSec ?? 0.08);
  const glide = glideFrom != null ? { fromHz: glideFrom, sec: glideSec } : undefined;
  const peak = peakFromVelocity(velocity, voice);
  const atk =
    glide != null
      ? Math.min(Math.max(0.001, voice.ampAttackMs / 1000), 0.01)
      : Math.max(0.001, voice.ampAttackMs / 1000);
  const dec = Math.max(0.004, voice.ampDecayMs / 1000);
  const sus = Math.max(0.0002, Math.min(1, voice.ampSustain) * peak);
  const rel = Math.max(0.012, voice.ampReleaseMs / 1000);
  const tEnd = t1 + rel;

  const oscMix = ctx.createGain();
  oscMix.gain.setValueAtTime(1, t0);

  const driveAmt = Math.max(0, voice.distortion) + Math.max(0, voice.filterDrive - 0.08) * 0.35;
  let toneInput: AudioNode = oscMix;
  if (driveAmt > 0.015) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = softClipCurve(Math.min(0.85, driveAmt));
    shaper.oversample = '2x';
    oscMix.connect(shaper);
    toneInput = shaper;
  }

  const filter = ctx.createBiquadFilter();
  filter.type = voice.filterType;
  const cutoff = Math.max(40, Math.min(16000, voice.filterCutoffHz));
  filter.frequency.setValueAtTime(cutoff, t0);
  filter.Q.setValueAtTime(Math.max(0.15, Math.min(16, voice.filterResonanceQ)), t0);

  const pluckLike = voice.role === 'pluck' || voice.role === 'bell' || voice.ampSustain < 0.14;
  if (pluckLike) {
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(180, cutoff * (voice.role === 'bell' ? 0.55 : 0.38)),
      t0 + atk + dec * 0.55,
    );
  } else if (voice.role === 'keys' && !isGenoStraightAccordVoice(voice)) {
    filter.frequency.setValueAtTime(Math.min(16000, cutoff * 1.08), t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(900, cutoff * 0.72), t0 + atk + dec * 0.85);
  }

  toneInput.connect(filter);

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0003), t0 + atk);
  amp.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0002), t0 + atk + dec);
  amp.gain.setValueAtTime(Math.max(sus, 0.0002), t1);
  amp.gain.exponentialRampToValueAtTime(0.0001, tEnd);

  filter.connect(amp);
  wireGenoFx(ctx, amp, stripOutput, voice, peak, t0, tEnd);

  const voices = Math.max(1, Math.min(6, Math.round(voice.unisonVoices)));
  const oscNodes: OscillatorNode[] = [];

  for (let u = 0; u < voices; u += 1) {
    const unisonCents =
      voices <= 1 ? 0 : (u / (voices - 1) - 0.5) * 2 * voice.unisonDetuneCents;

    const o1 = ctx.createOscillator();
    o1.type = toOscType(voice.osc1Wave);
    applyOscStandardPitch(o1, hz, unisonCents, t0, glide);
    if (hasFlex) {
      applyIntraNoteFlexCurveToOsc(o1, t0, flexBpm!, flexCurve!);
    }
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(voice.osc1Level / voices, t0);
    o1.connect(g1);
    g1.connect(oscMix);
    oscNodes.push(o1);

    if (voice.osc2Level > 0.01) {
      const o2 = ctx.createOscillator();
      o2.type = toOscType(voice.osc2Wave);
      applyOscStandardPitch(o2, hz, unisonCents, t0, glide);
      if (hasFlex) {
        applyIntraNoteFlexCurveToOsc(o2, t0, flexBpm!, flexCurve!);
      }
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(voice.osc2Level / voices, t0);
      o2.connect(g2);
      g2.connect(oscMix);
      oscNodes.push(o2);
    }
  }

  /** Sub-octave layer — bass role only; coarse −12 semitones on a separate osc, not the main pitch. */
  if (voice.subLevel > 0.01 && voice.role === 'bass') {
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    applyOscStandardPitch(
      sub,
      hz,
      se2SynthGenoOscDetuneCents(-12, 0),
      t0,
      glide,
    );
    if (hasFlex) {
      applyIntraNoteFlexCurveToOsc(sub, t0, flexBpm!, flexCurve!);
    }
    const gs = ctx.createGain();
    gs.gain.setValueAtTime(voice.subLevel * 0.92, t0);
    sub.connect(gs);
    gs.connect(oscMix);
    oscNodes.push(sub);
  }

  if (voice.noiseLevel > 0.01) {
    const len = Math.ceil((tEnd - t0 + 0.05) * ctx.sampleRate);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(voice.noiseLevel * 0.18, t0);
    noise.connect(gn);
    gn.connect(oscMix);
    noise.start(t0);
    noise.stop(tEnd + 0.02);
  }

  for (const o of oscNodes) {
    o.start(t0);
    o.stop(tEnd + 0.03);
    o.onended = () => {
      try {
        o.disconnect();
      } catch {
        /* */
      }
    };
  }
}

export function previewSe2SynthGenoNote(
  ctx: AudioContext,
  stripOutput: AudioNode,
  pitch: number,
  velocity: number,
  voice: Se2SynthGenoVoiceParams,
): void {
  const when = ctx.currentTime + 0.004;
  const dur = Math.max(0.2, (voice.ampReleaseMs + voice.ampDecayMs) / 1000 + 0.15);
  scheduleSe2SynthGenoNote(ctx, stripOutput, when, when + dur, pitch, velocity, voice);
}
