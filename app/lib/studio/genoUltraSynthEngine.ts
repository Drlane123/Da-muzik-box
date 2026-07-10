/**
 * Geno Ultra Synth — Web Audio voice engine (SE2 dedicated lane).
 */
import type {
  GenoUltraModDest,
  GenoUltraOscParams,
  GenoUltraOscWave,
  GenoUltraFxParams,
  GenoUltraSynthVoiceParams,
} from '@/app/lib/studio/genoUltraSynthTypes';
import {
  GENO_ULTRA_A4_HZ,
  GENO_ULTRA_DEFAULT_OUTPUT_LEVEL,
  genoUltraVoiceIsRiser,
  genoUltraVoiceRiseOctaves,
} from '@/app/lib/studio/genoUltraSynthTypes';
import { genoBassVoiceIsBounceThump } from '@/app/lib/studio/genoBassMixReadyVoice';
import { GENO_ULTRA_EQ_BANDS, getGenoUltraEqBandHz } from '@/app/lib/studio/genoUltraEqGraph';
import {
  applyGenoUltraArpDryVoice,
  genoUltraVoiceFilterIsRaw,
} from '@/app/lib/studio/genoUltraArpDryVoices';
import {
  genoUltraApplyArpCtrlLanes,
  type GenoArpCtrlDest,
  type GenoArpCtrlLaneMod,
} from '@/app/lib/studio/genoUltraArpCtrlLanes';
import { genoArpAnalogGateShape } from '@/app/lib/studio/genoUltraArpAnalogGate';
import {
  ensureGenoCinematicOrchestraHitReady,
  genoOrchestraHitIdForPreset,
  tryPlayGenoCinematicOrchestraHit,
} from '@/app/lib/studio/genoCinematicOrchestraPlayback';
import { scheduleGenoUltraArpMonoStep, stopGenoUltraArpMonoVoice } from '@/app/lib/studio/genoUltraArpMonoVoice';
import {
  genoUltraCollectLfoRoutes,
  genoUltraConnectLfoMod,
} from '@/app/lib/studio/genoUltraLfoMod';
/**
 * Concert-pitch register — MIDI 60 (C3 / middle C) sounds at A4=440 Hz reference.
 * No global octave shift; Geno Bass also passes `0`.
 */
export const GENO_ULTRA_PLAYBACK_TRANSPOSE = 0;

export type GenoUltraSynthPlayOpts = {
  when: number;
  durationSec: number;
  midi: number;
  velocity: number;
  voice: GenoUltraSynthVoiceParams;
  stripOutput: AudioNode;
  bpm?: number;
  transportLite?: boolean;
  /** Panel ARP preview — short release, no heavy FX, tracked for voice cut. */
  arpPreview?: boolean;
  /** ARP step spacing (sec) — keeps envelope within one grid step at fast rates. */
  arpStepSec?: number;
  /** Retrologue CTRL lanes (0–1, already × depth). */
  arpMod1?: number;
  arpMod2?: number;
  arpMod3?: number;
  arpMod1Dest?: GenoArpCtrlDest;
  arpMod2Dest?: GenoArpCtrlDest;
  arpMod3Dest?: GenoArpCtrlDest;
  arpMod1On?: boolean;
  arpMod2On?: boolean;
  arpMod3On?: boolean;
  /** Analog gate FX — per-step lane chops the amp for pump / trance gate. */
  arpGateFxOn?: boolean;
  arpGateLaneOpen?: number;
  arpGateFxDepth?: number;
  arpGateFxAttackMs?: number;
  arpGateFxReleaseMs?: number;
  /** Footer legato — tie overlapping arp steps. */
  arpLegato?: boolean;
  /** Footer slide — portamento from prior pitch at bar mid / end. */
  arpGlideFromMidi?: number | null;
  arpGlideSec?: number;
  /**
   * Semitones added at playback. Default 0 (concert pitch, A4=440).
   * Geno Bass also passes `0` for the low register.
   */
  playbackTranspose?: number;
  /** On-screen keyboard / panel preview — tracked for mono vs poly voice pool. */
  keyboardPreview?: boolean;
  /** When true, each new key replaces the previous preview note. */
  monophonic?: boolean;
  /** Max simultaneous preview notes when not monophonic. */
  maxPoly?: number;
};

function genoUltraPlaybackMidi(midi: number, transpose?: number): number {
  const shift = transpose ?? GENO_ULTRA_PLAYBACK_TRANSPOSE;
  return Math.max(0, Math.min(127, Math.round(midi) + shift));
}

const transportStoppers = new Set<() => void>();

/** Active ARP preview voices — legacy per-step path; mono voice is primary. */
let arpPreviewVoices: {
  amp: GainNode;
  nodes: (OscillatorNode | AudioBufferSourceNode)[];
}[] = [];

let keyboardPreviewVoices: {
  amp: GainNode;
  nodes: (OscillatorNode | AudioBufferSourceNode)[];
}[] = [];

const ARP_VOICE_STOP_FADE_SEC = 0.018;

function fadeArpVoiceOut(voice: { amp: GainNode; nodes: (OscillatorNode | AudioBufferSourceNode)[] }, when: number, fadeSec = ARP_VOICE_STOP_FADE_SEC): void {
  const t0 = Math.max(when, voice.amp.context.currentTime);
  const t1 = t0 + fadeSec;
  try {
    const g = voice.amp.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(Math.max(0, g.value), t0);
    g.linearRampToValueAtTime(0, t1);
  } catch {
    /* */
  }
  for (const node of voice.nodes) {
    try {
      node.stop(t1 + 0.02);
    } catch {
      /* */
    }
  }
}

export function stopGenoUltraArpPreviewVoices(): void {
  stopGenoUltraArpMonoVoice();
  if (arpPreviewVoices.length) {
    const ctx = arpPreviewVoices[0]!.amp.context as AudioContext;
    const t = ctx.currentTime;
    for (const voice of arpPreviewVoices) fadeArpVoiceOut(voice, t);
    arpPreviewVoices = [];
  }
  stopGenoUltraKeyboardPreviewVoices();
}

export function stopGenoUltraKeyboardPreviewVoices(): void {
  if (!keyboardPreviewVoices.length) return;
  const ctx = keyboardPreviewVoices[0]!.amp.context as AudioContext;
  const t = ctx.currentTime;
  for (const voice of keyboardPreviewVoices) fadeArpVoiceOut(voice, t);
  keyboardPreviewVoices = [];
}

export function haltGenoUltraSynthTransportVoices(): void {
  for (const stop of transportStoppers) {
    try {
      stop();
    } catch {
      /* */
    }
  }
  transportStoppers.clear();
}

function scheduleTime(ctx: AudioContext, when: number): number {
  return Math.max(when, ctx.currentTime + 0.008);
}

function midiToHz(midi: number): number {
  return GENO_ULTRA_A4_HZ * 2 ** ((Math.max(0, Math.min(127, midi)) - 69) / 12);
}

function toOscType(w: GenoUltraOscWave): OscillatorType {
  return w === 'saw' ? 'sawtooth' : w;
}

function makeDistortionCurve(amount: number): Float32Array {
  const k = 2 + amount * 42;
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.tanh(x * k);
  }
  return curve;
}

function oscHz(baseMidi: number, osc: GenoUltraOscParams): number {
  const cents = osc.semitone * 100 + osc.fineCents;
  return midiToHz(baseMidi + cents / 100);
}

function peakFromVelocity(velocity: number, voice: GenoUltraSynthVoiceParams, arpPreview = false): number {
  const out = Math.max(0, Math.min(1, voice.outputLevel ?? GENO_ULTRA_DEFAULT_OUTPUT_LEVEL));
  const scale = arpPreview ? 0.5 : 0.68;
  return Math.max(0.0002, Math.min(arpPreview ? 0.38 : 0.62, (velocity / 127) * out * scale));
}

/** Post-amp 4-band EQ — returns tail node to wire into dry bus. */
function connectGenoUltraPostAmpEq(
  ctx: AudioContext,
  when: number,
  source: AudioNode,
  fx: GenoUltraFxParams,
): AudioNode {
  if (!fx.eqEnabled) return source;
  let tail: AudioNode = source;
  for (const band of GENO_ULTRA_EQ_BANDS) {
    const f = ctx.createBiquadFilter();
    f.type = band.kind;
    f.frequency.setValueAtTime(getGenoUltraEqBandHz(band.id, fx), when);
    f.gain.setValueAtTime(fx[band.gainKey], when);
    f.Q.setValueAtTime(band.kind === 'peaking' ? band.q : 0.707, when);
    tail.connect(f);
    tail = f;
  }
  return tail;
}

/** ARP voice: effects off only — your osc / filter / amp settings stay as you set them. */
function arpPreviewVoiceLite(
  voice: GenoUltraSynthVoiceParams,
  holdSec: number,
): GenoUltraSynthVoiceParams {
  const dry = applyGenoUltraArpDryVoice(voice);
  const isBass = dry.category === 'bass';
  return {
    ...dry,
    unisonVoices: 1,
    unisonDetuneCents: 0,
    ampReleaseMs: Math.min(
      dry.ampReleaseMs,
      Math.max(14, holdSec * 1000 * (isBass ? 0.75 : 0.7)),
    ),
    filterReleaseMs: Math.min(dry.filterReleaseMs, isBass ? 160 : 110),
  };
}

type ModOffsets = {
  filterCutoffMul: number;
  filterResAdd: number;
  oscPitchCents: number[];
  ampMul: number;
  panAdd: number;
};

function computeModOffsets(
  voice: GenoUltraSynthVoiceParams,
  velocity: number,
): ModOffsets {
  const out: ModOffsets = {
    filterCutoffMul: 1,
    filterResAdd: 0,
    oscPitchCents: [0, 0, 0],
    ampMul: 1,
    panAdd: 0,
  };
  const velNorm = velocity / 127;
  for (const slot of voice.modSlots) {
    if (slot.source === 'off' || slot.dest === 'off' || Math.abs(slot.amount) < 0.001) continue;
    if (slot.source === 'lfo1' || slot.source === 'lfo2') continue;
    const amt = slot.amount;
    const srcVal =
      slot.source === 'velocity'
        ? velNorm
        : slot.source === 'ampEnv'
          ? 0.65
          : slot.source === 'filterEnv'
            ? 0.55
            : 0;
    const v = srcVal * amt;
    applyMod(out, slot.dest, v);
  }
  return out;
}

function applyMod(out: ModOffsets, dest: GenoUltraModDest, v: number): void {
  switch (dest) {
    case 'filterCutoff':
      out.filterCutoffMul *= 1 + v * 1.8;
      break;
    case 'filterRes':
      out.filterResAdd += v * 4;
      break;
    case 'osc1Pitch':
      out.oscPitchCents[0] += v * 2400;
      break;
    case 'osc2Pitch':
      out.oscPitchCents[1] += v * 2400;
      break;
    case 'osc3Pitch':
      out.oscPitchCents[2] += v * 2400;
      break;
    case 'ampLevel':
      out.ampMul *= 1 + v * 0.85;
      break;
    case 'pan':
      out.panAdd += v * 0.45;
      break;
    default:
      break;
  }
}

export function scheduleGenoUltraSynthNote(ctx: AudioContext, opts: GenoUltraSynthPlayOpts): void {
  const midi = genoUltraPlaybackMidi(opts.midi, opts.playbackTranspose);

  if (genoOrchestraHitIdForPreset(opts.voice.id)) {
    const when = scheduleTime(ctx, opts.when);
    const played = tryPlayGenoCinematicOrchestraHit(
      ctx,
      opts.stripOutput,
      opts.voice.id,
      midi,
      opts.velocity,
      when,
    );
    if (!played) {
      void ensureGenoCinematicOrchestraHitReady(ctx, opts.voice.id).then(() => {
        tryPlayGenoCinematicOrchestraHit(
          ctx,
          opts.stripOutput,
          opts.voice.id,
          midi,
          opts.velocity,
          when,
        );
      });
    }
    return;
  }

  const isArpPreview = opts.arpPreview === true;
  const when = scheduleTime(ctx, opts.when);
  /**
   * Play the live patch (osc / filter / env as the user set them).
   * Bank dry bodies apply only when a preset is loaded — not on every note.
   * ARP CTRL lanes still layer on top of the current voice.
   */
  const liveVoice = {
    ...opts.voice,
    osc1: { ...opts.voice.osc1 },
    osc2: { ...opts.voice.osc2 },
    osc3: { ...opts.voice.osc3 },
    modSlots: opts.voice.modSlots.map((s) => ({ ...s })),
    fx: { ...opts.voice.fx },
  };
  let holdSec = isArpPreview
    ? Math.max(0.006, opts.durationSec)
    : Math.max(0.04, opts.durationSec);
  if (!isArpPreview && genoUltraVoiceIsRiser(liveVoice)) {
    holdSec = Math.max(holdSec, liveVoice.ampAttackMs / 1000 + 0.45);
  }
  let v = isArpPreview ? arpPreviewVoiceLite(liveVoice, holdSec) : liveVoice;
  if (isArpPreview) {
    const ctrlLanes: GenoArpCtrlLaneMod[] = [
      {
        amount: opts.arpMod1 ?? 0,
        dest: opts.arpMod1Dest ?? 'filterCutoff',
        enabled: opts.arpMod1On === true,
      },
      {
        amount: opts.arpMod2 ?? 0,
        dest: opts.arpMod2Dest ?? 'filterRes',
        enabled: opts.arpMod2On === true,
      },
      {
        amount: opts.arpMod3 ?? 0,
        dest: opts.arpMod3Dest ?? 'ampLevel',
        enabled: opts.arpMod3On === true,
      },
    ];
    v = genoUltraApplyArpCtrlLanes(v, ctrlLanes);
  }
  const bpm = Math.max(40, opts.bpm ?? 120);
  let atk = isArpPreview
    ? Math.min(Math.max(0.001, v.ampAttackMs / 1000), holdSec * 0.28)
    : Math.max(0.001, v.ampAttackMs / 1000);
  const bounceThump = !isArpPreview && v.category === 'bass' && genoBassVoiceIsBounceThump(v);
  if (!isArpPreview && v.category === 'bass' && !bounceThump) {
    atk = Math.max(atk, 0.008);
  }
  let rel = isArpPreview
    ? Math.max(0.003, Math.min(v.ampReleaseMs / 1000, holdSec * 0.55))
    : Math.max(0.008, v.ampReleaseMs / 1000);
  if (isArpPreview && opts.arpStepSec != null && opts.arpStepSec > 0) {
    // Keep the gate hold intact — only cap release so automation stays sane.
    // Older code shrank holdSec to 72% of the step, which silenced every note early.
    const gapSec = Math.max(0.004, opts.arpStepSec - holdSec);
    rel = Math.min(rel, Math.max(0.004, gapSec + opts.arpStepSec * 0.12));
    atk = Math.min(atk, Math.max(0.002, holdSec * 0.4));
  }

  let playVelocity = opts.velocity;
  if (isArpPreview && opts.arpGateFxOn) {
    const gateShape = genoArpAnalogGateShape({
      fxOn: true,
      laneOpen: opts.arpGateLaneOpen ?? 1,
      depth: opts.arpGateFxDepth ?? 0.85,
      attackMs: opts.arpGateFxAttackMs ?? 4,
      releaseMs: opts.arpGateFxReleaseMs ?? 48,
      stepSec: opts.arpStepSec ?? holdSec,
    });
    if (gateShape.skipNote) return;
    holdSec = Math.max(0.004, holdSec * gateShape.holdSecMul);
    if (gateShape.attackSec >= 0) atk = gateShape.attackSec;
    if (gateShape.releaseSec >= 0) rel = gateShape.releaseSec;
    playVelocity = Math.max(1, Math.round(playVelocity * gateShape.velocityMul));
  }

  const noteEnd = when + holdSec;
  const peak = peakFromVelocity(playVelocity, v, isArpPreview);
  const mods = isArpPreview
    ? { filterCutoffMul: 1, filterResAdd: 0, oscPitchCents: [0, 0, 0], ampMul: 1, panAdd: 0 }
    : computeModOffsets(v, opts.velocity);
  const transportLite = opts.transportLite === true || isArpPreview;

  const dec = Math.max(0.004, v.ampDecayMs / 1000);
  const susLvl = Math.max(0.0002, Math.min(1, v.ampSustain) * peak * mods.ampMul);
  const tEnd = noteEnd + rel;

  if (isArpPreview) {
    scheduleGenoUltraArpMonoStep(ctx, {
      when,
      stripOutput: opts.stripOutput,
      midi,
      velocity: playVelocity,
      holdSec,
      atkSec: atk,
      relSec: rel,
      voice: v,
      bpm,
      legato: opts.arpLegato,
      glideFromMidi: opts.arpGlideFromMidi,
      glideSec: opts.arpGlideSec,
    });
    return;
  }

  /** Osc/noise must outlive amp release — hard .stop() while amp is open clicks. */
  const oscStopAt = tEnd + 0.08;

  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(Math.max(-1, Math.min(1, mods.panAdd)), when);
  panner.connect(opts.stripOutput);

  const dryBus = ctx.createGain();
  dryBus.gain.setValueAtTime(1, when);
  dryBus.connect(panner);

  const filterOn = v.filterEnabled !== false;
  const filterEnvOn = v.filterEnvEnabled !== false;
  const ampEnvOn = v.ampEnvEnabled !== false;

  const filter = ctx.createBiquadFilter();
  filter.type = v.filterMode === 'notch' ? 'notch' : v.filterMode;
  const keyTrack = Math.max(0, Math.min(1, v.filterKeyTrack));
  const keyBoost = 1 + (midi / 127) * keyTrack * 0.85;
  const cutoffBase = Math.max(40, Math.min(16000, v.filterCutoffHz * mods.filterCutoffMul * keyBoost));
  filter.frequency.setValueAtTime(cutoffBase, when);
  filter.Q.setValueAtTime(Math.max(0.1, Math.min(18, v.filterResonanceQ + mods.filterResAdd)), when);

  /** Init / electro-dry — hold cutoff open (no start/release dampening). */
  const filterRaw = genoUltraVoiceFilterIsRaw(v);

  if (filterOn && !isArpPreview && !filterRaw && filterEnvOn) {
    const isBass = v.category === 'bass';
    const fAtk = Math.max(
      isBass && !bounceThump ? 0.01 : 0.001,
      v.filterAttackMs / 1000,
    );
    const fDec = Math.max(0.004, v.filterDecayMs / 1000);
    const fSus = bounceThump
      ? Math.max(0, Math.min(1, v.filterSustain))
      : Math.max(0.08, Math.min(1, v.filterSustain));
    const fRel = Math.max(0.01, v.filterReleaseMs / 1000);
    const fPeak = Math.min(16000, cutoffBase * (1.2 + v.filterDrive * (isBass ? 0.45 : 0.8)));
    const fSusHz = Math.max(80, cutoffBase * (0.45 + fSus * 0.55));
    const fStart = bounceThump
      ? Math.max(55, cutoffBase * 0.32)
      : isBass
        ? Math.max(100, cutoffBase * 0.58)
        : Math.max(80, cutoffBase * 0.25);
    filter.frequency.setValueAtTime(fStart, when);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, fPeak), when + fAtk);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, fSusHz), when + fAtk + fDec);
    filter.frequency.setValueAtTime(Math.max(80, fSusHz), noteEnd);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, cutoffBase * 0.2), noteEnd + fRel);
  } else if (filterOn && isArpPreview) {
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffBase, when);
    filter.Q.setValueAtTime(Math.max(0.1, Math.min(1.05, v.filterResonanceQ)), when);
  }

  const unisonN = isArpPreview ? 1 : Math.max(1, Math.min(6, Math.round(v.unisonVoices)));
  const voiceNodes: (OscillatorNode | AudioBufferSourceNode)[] = [];

  const amp = ctx.createGain();
  const ampPeak = Math.max(peak * mods.ampMul, 0.0003);
  if (ampEnvOn) {
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(ampPeak, when + atk);
    if (Math.abs(susLvl - peak * mods.ampMul) > 0.0001) {
      amp.gain.exponentialRampToValueAtTime(Math.max(susLvl, 0.0003), when + atk + dec);
    }
    amp.gain.setValueAtTime(Math.max(susLvl, 0.0003), noteEnd);
    amp.gain.exponentialRampToValueAtTime(0.0001, tEnd);
  } else {
    amp.gain.setValueAtTime(ampPeak, when);
    amp.gain.setValueAtTime(ampPeak, noteEnd);
    amp.gain.exponentialRampToValueAtTime(0.0001, tEnd);
  }

  const oscMix = ctx.createGain();
  oscMix.gain.setValueAtTime(1, when);

  let postFilter: AudioNode = filter;
  if (filterOn) {
    oscMix.connect(filter);
    if (!isArpPreview && v.filterDrive > 0.04) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(v.filterDrive);
      shaper.oversample = '2x';
      filter.connect(shaper);
      shaper.connect(amp);
      postFilter = shaper;
    } else {
      filter.connect(amp);
    }
  } else {
    oscMix.connect(amp);
    postFilter = amp;
  }
  const eqTail = connectGenoUltraPostAmpEq(ctx, when, amp, v.fx);
  eqTail.connect(dryBus);

  type OscPitchTarget = { node: OscillatorNode; hz: number; oscIdx: number };
  const pitchTargets: OscPitchTarget[] = [];

  const spawnOsc = (osc: GenoUltraOscParams, oscIdx: number, extraCents = 0) => {
    if (osc.level <= 0.001) return;
    const hz = oscHz(midi, osc);
    const riseOct = !isArpPreview ? genoUltraVoiceRiseOctaves(v) : 0;
    const riseSec = Math.max(0.35, v.ampAttackMs / 1000);
    for (let u = 0; u < unisonN; u += 1) {
      const o = ctx.createOscillator();
      o.type = toOscType(osc.wave);
      const spread =
        unisonN > 1 ? (u - (unisonN - 1) / 2) * (v.unisonDetuneCents / Math.max(1, unisonN - 1)) : 0;
      const cents = spread + extraCents + (mods.oscPitchCents[oscIdx] ?? 0);
      const hzTarget = hz * 2 ** (cents / 1200);
      if (riseOct > 0.05) {
        const hzLo = hzTarget / 2 ** riseOct;
        const hzPeak = hzTarget * 2 ** (riseOct * 0.22);
        o.frequency.setValueAtTime(Math.max(28, hzLo), when);
        o.frequency.exponentialRampToValueAtTime(Math.max(32, hzPeak), when + riseSec * 0.88);
        o.frequency.exponentialRampToValueAtTime(Math.max(32, hzTarget), when + riseSec);
      } else {
        o.frequency.setValueAtTime(hzTarget, when);
      }
      const g = ctx.createGain();
      const targetGain = (osc.level * peak) / unisonN;
      g.gain.setValueAtTime(targetGain, when);
      o.connect(g);
      g.connect(oscMix);
      pitchTargets.push({ node: o, hz: hzTarget, oscIdx });
      voiceNodes.push(o);
      o.start(when);
      o.stop(oscStopAt);
    }
  };

  spawnOsc(v.osc1, 0);
  spawnOsc(v.osc2, 1, 0);
  spawnOsc(v.osc3, 2, 0);

  if (v.subLevel > 0.01) {
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    const subHz = midiToHz(midi - 12);
    const riseOct = !isArpPreview ? genoUltraVoiceRiseOctaves(v) : 0;
    const riseSec = Math.max(0.35, v.ampAttackMs / 1000);
    if (riseOct > 0.05) {
      sub.frequency.setValueAtTime(Math.max(24, subHz / 2 ** (riseOct * 0.85)), when);
      sub.frequency.exponentialRampToValueAtTime(Math.max(28, subHz), when + riseSec);
    } else {
      sub.frequency.setValueAtTime(subHz, when);
    }
    const sg = ctx.createGain();
    const subTarget = v.subLevel * peak * 0.95;
    const subAtk = Math.max(atk, 0.01, v.ampAttackMs / 1000);
    sg.gain.setValueAtTime(0.0001, when);
    sg.gain.exponentialRampToValueAtTime(Math.max(subTarget, 0.0003), when + subAtk);
    sub.connect(sg);
    sg.connect(oscMix);
    voiceNodes.push(sub);
    sub.start(when);
    sub.stop(oscStopAt);
  }

  if (v.noiseLevel > 0.004) {
    const len = Math.ceil(ctx.sampleRate * 0.25);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0)!;
    for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(v.noiseLevel * peak * 0.28, when);
    noise.connect(ng);
    ng.connect(oscMix);
    voiceNodes.push(noise);
    noise.start(when);
    noise.stop(oscStopAt);
  }

  if (filterOn && !isArpPreview) {
    for (const route of genoUltraCollectLfoRoutes(v)) {
      switch (route.dest) {
        case 'filterCutoff':
          genoUltraConnectLfoMod(ctx, when, tEnd, route, v, bpm, filter.frequency, cutoffBase, 0.65);
          break;
        case 'filterRes':
          genoUltraConnectLfoMod(ctx, when, tEnd, route, v, bpm, filter.Q, v.filterResonanceQ, 2.5);
          break;
        case 'osc1Pitch':
        case 'osc2Pitch':
        case 'osc3Pitch': {
          const idx = route.dest === 'osc1Pitch' ? 0 : route.dest === 'osc2Pitch' ? 1 : 2;
          for (const target of pitchTargets.filter((t) => t.oscIdx === idx)) {
            genoUltraConnectLfoMod(ctx, when, tEnd, route, v, bpm, target.node.frequency, target.hz, 0.14);
          }
          break;
        }
        case 'ampLevel':
          genoUltraConnectLfoMod(ctx, when, tEnd, route, v, bpm, amp.gain, ampPeak, 0.42);
          break;
        case 'pan':
          genoUltraConnectLfoMod(ctx, when, tEnd, route, v, bpm, panner.pan, mods.panAdd, 0.55);
          break;
        default:
          break;
      }
    }
  }

  if (!transportLite && v.fx.chorusMix > 0.02) {
    const chorusDelay = ctx.createDelay(0.08);
    chorusDelay.delayTime.setValueAtTime(0.014, when);
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(Math.max(0.05, v.fx.chorusRateHz), when);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.003, when);
    lfo.connect(lfoGain);
    lfoGain.connect(chorusDelay.delayTime);
    const wet = ctx.createGain();
    wet.gain.setValueAtTime(v.fx.chorusMix * peak * 0.42, when);
    dryBus.connect(chorusDelay);
    chorusDelay.connect(wet);
    wet.connect(panner);
    lfo.start(when);
    lfo.stop(tEnd + 0.1);
  }

  if (!isArpPreview && v.fx.delayEnabled !== false && v.fx.delayMix > 0.02) {
    const dly = ctx.createDelay(4);
    dly.delayTime.setValueAtTime(Math.max(0.03, Math.min(1.2, v.fx.delayTimeMs / 1000)), when);
    const fb = ctx.createGain();
    fb.gain.setValueAtTime(Math.min(0.88, v.fx.delayFeedback), when);
    const wet = ctx.createGain();
    const wetPeak = Math.max(peak, 0.16);
    wet.gain.setValueAtTime(v.fx.delayMix * wetPeak * 0.78, when);
    dryBus.connect(dly);
    dly.connect(fb);
    fb.connect(dly);
    dly.connect(wet);
    wet.connect(panner);
  }

  if (!transportLite && v.fx.reverbMix > 0.02) {
    const revDelay = ctx.createDelay(0.6);
    revDelay.delayTime.setValueAtTime(0.04, when);
    const revFb = ctx.createGain();
    revFb.gain.setValueAtTime(0.28 + v.fx.reverbDecay * 0.52, when);
    const wet = ctx.createGain();
    wet.gain.setValueAtTime(v.fx.reverbMix * peak * 0.4, when);
    dryBus.connect(revDelay);
    revDelay.connect(revFb);
    revFb.connect(revDelay);
    revDelay.connect(wet);
    wet.connect(panner);
  }

  if (transportLite && !isArpPreview) {
    const stop = () => {
      for (const node of voiceNodes) {
        try {
          node.stop();
        } catch {
          /* */
        }
      }
    };
    transportStoppers.add(stop);
  }

  if (!isArpPreview && opts.keyboardPreview) {
    if (opts.monophonic !== false) {
      stopGenoUltraKeyboardPreviewVoices();
    } else {
      const cap = Math.max(1, Math.min(16, opts.maxPoly ?? 8));
      while (keyboardPreviewVoices.length >= cap) {
        const stolen = keyboardPreviewVoices.shift()!;
        fadeArpVoiceOut(stolen, when);
      }
    }
    keyboardPreviewVoices.push({ amp, nodes: [...voiceNodes] });
  }
}

export function previewGenoUltraSynthNote(
  ctx: AudioContext,
  stripOutput: AudioNode,
  pitch: number,
  velocity: number,
  voice: GenoUltraSynthVoiceParams,
  bpm = 120,
  holdSec = 0.45,
  keyboard?: { monophonic?: boolean; maxPoly?: number },
): void {
  scheduleGenoUltraSynthNote(ctx, {
    when: ctx.currentTime + 0.008,
    durationSec: holdSec,
    midi: pitch,
    velocity,
    voice,
    stripOutput,
    bpm,
    transportLite: false,
    keyboardPreview: true,
    monophonic: keyboard?.monophonic ?? true,
    maxPoly: keyboard?.maxPoly ?? 8,
  });
}

/** ARP step preview — same lightweight voice path as the sequencer loop. */
export function previewGenoUltraSynthArpNote(
  ctx: AudioContext,
  stripOutput: AudioNode,
  pitch: number,
  velocity: number,
  voice: GenoUltraSynthVoiceParams,
  holdSec: number,
  bpm = 120,
): void {
  scheduleGenoUltraSynthNote(ctx, {
    when: ctx.currentTime + 0.006,
    durationSec: Math.max(0.028, holdSec),
    midi: pitch,
    velocity,
    voice,
    stripOutput,
    bpm,
    arpPreview: true,
  });
}
