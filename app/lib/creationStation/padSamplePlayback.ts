/**
 * Shared MPC pad sample playback — Beat Lab Beat Pads + SE2 Beat Pads lane.
 */
import { beatLabPadPlaybackRateDetune } from '@/app/lib/creationStation/beatLabMidiRoll';
import { registerBeatLabMeterVoice } from '@/app/lib/creationStation/beatLabChannelMeters';
import {
  connectPadSamplerFxRack,
  defaultPadSamplerFxRack,
  padSamplerFxRackIsActive,
  type PadSamplerFxRack,
} from '@/app/lib/creationStation/padSamplerFxRack';
import {
  defaultPadSamplerPlaybackOpts,
  type PadSamplerPlaybackOpts,
} from '@/app/lib/padSampleStorage';

export type PlayPadSampleBufferOpts = {
  /** Override output (e.g. SE2 track strip). Defaults to master gain or destination. */
  outputNode?: AudioNode;
  /** Skip Beat Lab CH meter registration when routing elsewhere. */
  skipMeter?: boolean;
  /** Extra linear trim after pad velocity / padLevel (SE2 Beat Pads uses this). */
  outputGain?: number;
};

/**
 * Schedule or instantly play a decoded pad buffer with sampler + FX shaping.
 * Returns `stop()` to cut this voice.
 */
export function playPadSampleBuffer(
  ctx: AudioContext,
  buffer: AudioBuffer,
  chId: number,
  vel: number,
  when: number,
  channelVolumes: Record<number, number>,
  playbackRate = 1,
  afterDispose?: () => void,
  sampler: PadSamplerPlaybackOpts = defaultPadSamplerPlaybackOpts(),
  timeStretch = false,
  fxRack: PadSamplerFxRack = defaultPadSamplerFxRack(),
  sessionBpm = 120,
  instant = false,
  chromaticDetuneCents = 0,
  playOpts?: PlayPadSampleBufferOpts,
): () => void {
  const chVol = (channelVolumes[chId] ?? 80) / 100;
  let vol = (vel / 127) * 0.85 * chVol;
  const velNorm = vel / 127;
  const velCurve = Math.max(0, Math.min(100, sampler.velToLevel ?? 100)) / 100;
  if (velCurve > 0.02) {
    vol *= Math.pow(velNorm, 1 + (1 - velCurve) * 2.2);
  }
  const accent = Math.max(0, Math.min(100, sampler.ampAccent ?? 0));
  if (accent > 0.5 && vel > 88) {
    vol *= 1 + (accent / 100) * Math.min(1, (vel - 88) / 39);
  }
  vol *= Math.max(0, Math.min(1.5, (sampler.padLevel ?? 100) / 100));
  if (playOpts?.outputGain != null && Number.isFinite(playOpts.outputGain)) {
    vol *= Math.max(0, playOpts.outputGain);
  }
  const rawPan =
    ((window as unknown as { __daMusicChannelPans?: Record<number, number> }).__daMusicChannelPans?.[chId] ?? 0) / 100;
  const padPan = Math.max(-100, Math.min(100, sampler.padPan ?? 0)) / 100;
  const panNode = ctx.createStereoPanner();
  panNode.pan.value = Math.max(-1, Math.min(1, rawPan + padPan));
  const meterAnalyser = ctx.createAnalyser();
  meterAnalyser.fftSize = 1024;
  meterAnalyser.smoothingTimeConstant = 0.14;
  const master = (window as unknown as { __daMusicMasterGain?: GainNode | null }).__daMusicMasterGain;
  const dest =
    playOpts?.outputNode ??
    (master && master.context === ctx ? master : ctx.destination);
  meterAnalyser.connect(panNode);
  panNode.connect(dest);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const { playbackRate: playRate, detuneCents } = beatLabPadPlaybackRateDetune(
    playbackRate,
    sampler.fineSemi,
    timeStretch,
  );
  src.playbackRate.value = playRate;
  const baseDetuneCents = Math.max(
    -12000,
    Math.min(12000, detuneCents + chromaticDetuneCents),
  );
  src.detune.value = baseDetuneCents;
  const pitchDepth = Math.max(0, Math.min(100, sampler.pitchEnvDepth ?? 0));
  const pitchDecMs = Math.max(5, Math.min(2000, sampler.pitchEnvDecayMs ?? 80));
  const pitchPunch = Math.max(0, Math.min(100, sampler.pitchPunch ?? 0));
  const dryG = ctx.createGain();
  const wetG = ctx.createGain();
  dryG.connect(meterAnalyser);
  wetG.connect(meterAnalyser);
  const fxSendMul = Math.max(0, Math.min(1, (sampler.fxSend ?? 100) / 100));
  const snap = Math.max(0, Math.min(1, sampler.triggerSnap ?? 0));

  const sr = buffer.sampleRate;
  const ny = sr * 0.48;
  const hpNode =
    sampler.hpHz >= 25
      ? (() => {
          const hp = ctx.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.value = Math.min(sampler.hpHz, ny);
          hp.Q.value = 0.707;
          return hp;
        })()
      : null;
  // FILTER — engage LP when cutoff is set, or when RES / ENV are used alone.
  const lpResAmt = Math.max(0, Math.min(100, sampler.lpRes ?? 0));
  const lpEnvAmt = Math.max(0, Math.min(100, sampler.lpEnvDepth ?? 0));
  const effectiveLpHz =
    sampler.lpHz >= 200 && sampler.lpHz < 19900
      ? sampler.lpHz
      : lpResAmt > 0.5 || lpEnvAmt > 0.5
        ? 12000
        : 0;
  const lpNode =
    effectiveLpHz >= 200
      ? (() => {
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = Math.min(effectiveLpHz, ny);
          lp.Q.value = 0.707 + (lpResAmt / 100) * 15;
          return lp;
        })()
      : null;

  let tail: AudioNode = src;
  if (hpNode) {
    src.connect(hpNode);
    tail = hpNode;
  }
  if (lpNode) {
    tail.connect(lpNode);
    tail = lpNode;
  }

  const colorAmt = Math.max(0, Math.min(100, sampler.color ?? 0));
  if (colorAmt > 0.5) {
    const color = ctx.createBiquadFilter();
    color.type = 'peaking';
    color.frequency.value = Math.min(900, ny * 0.35);
    color.Q.value = 0.85;
    color.gain.value = (colorAmt / 100) * 7;
    tail.connect(color);
    tail = color;
  }

  const toneAmt = Math.max(-100, Math.min(100, sampler.tone ?? 0));
  if (Math.abs(toneAmt) > 0.5) {
    const tone = ctx.createBiquadFilter();
    tone.type = 'highshelf';
    tone.frequency.value = Math.min(4200, ny * 0.42);
    tone.gain.value = (toneAmt / 100) * 10;
    tail.connect(tone);
    tail = tone;
  }

  const distOffset = Math.max(-100, Math.min(100, sampler.distOffset ?? 0));
  if (Math.abs(distOffset) > 0.5) {
    const pre = ctx.createGain();
    pre.gain.value = Math.pow(10, (distOffset * 0.24) / 20);
    tail.connect(pre);
    tail = pre;
  }

  const fxNodes: AudioNode[] = [];
  let fxTailSec = 0;
  if (padSamplerFxRackIsActive(fxRack)) {
    const fx = connectPadSamplerFxRack(ctx, tail, dryG, wetG, fxRack, sessionBpm);
    fxNodes.push(...fx.nodes);
    fxTailSec = fx.tailSec;
  } else {
    tail.connect(dryG);
  }

  const dur = buffer.duration;
  const t0 = Math.max(0, Math.min(0.9999, sampler.trim0)) * dur;
  let t1 = Math.max(t0 + 0.002, Math.min(dur, sampler.trim1 * dur));
  const maxPlay =
    sampler.maxPlaySec != null && sampler.maxPlaySec > 0 ? sampler.maxPlaySec : null;
  if (maxPlay != null) {
    t1 = Math.min(t1, t0 + maxPlay);
  } else if (!instant && chId === 1) {
    t1 = Math.min(t1, t0 + 0.52);
  }
  const playDur = Math.max(
    0.002,
    Number.isFinite(t1 - t0) ? t1 - t0 : Math.min(0.5, dur),
  );

  const now = ctx.currentTime;
  const whenPlay = instant ? now : Math.max(when, now + 0.001);

  let disposed = false;
  const disposeGraph = () => {
    if (disposed) return;
    disposed = true;
    try {
      dryG.gain.cancelScheduledValues(ctx.currentTime);
      wetG.gain.cancelScheduledValues(ctx.currentTime);
    } catch {
      /* */
    }
    try {
      src.disconnect();
      hpNode?.disconnect();
      lpNode?.disconnect();
      for (const n of fxNodes) {
        try {
          n.disconnect();
        } catch {
          /* */
        }
      }
      dryG.disconnect();
      wetG.disconnect();
      meterAnalyser.disconnect();
      panNode.disconnect();
    } catch {
      /* */
    }
    afterDispose?.();
  };
  src.onended = () => {
    const endedAt = ctx.currentTime;
    try {
      dryG.gain.cancelScheduledValues(endedAt);
      dryG.gain.setValueAtTime(dryG.gain.value, endedAt);
      dryG.gain.linearRampToValueAtTime(0, endedAt + 0.025);
    } catch {
      /* */
    }
    if (fxTailSec > 0.02) {
      const disposeAt = endedAt + fxTailSec;
      try {
        wetG.gain.cancelScheduledValues(endedAt);
        wetG.gain.setValueAtTime(wetG.gain.value, endedAt);
        wetG.gain.linearRampToValueAtTime(0, disposeAt);
      } catch {
        /* */
      }
      window.setTimeout(disposeGraph, Math.ceil(fxTailSec * 1000) + 50);
    } else {
      try {
        wetG.gain.cancelScheduledValues(endedAt);
        wetG.gain.setValueAtTime(wetG.gain.value, endedAt);
        wetG.gain.linearRampToValueAtTime(0, endedAt + 0.03);
      } catch {
        /* */
      }
      window.setTimeout(disposeGraph, 40);
    }
  };

  const stop = () => {
    if (disposed) return;
    const cutT = ctx.currentTime;
    try {
      src.stop(cutT);
    } catch {
      /* */
    }
    disposeGraph();
  };

  try {
    const wetVol = vol * fxSendMul;
    // OSC CLICK — brief attack punch on every hit (pad strike + transport).
    if (snap < 1e-4) {
      dryG.gain.setValueAtTime(vol, whenPlay);
      wetG.gain.setValueAtTime(wetVol, whenPlay);
    } else {
      const peakMul = 1 + snap * 0.85;
      const decaySec = 0.001 + (1 - snap) * 0.02;
      dryG.gain.cancelScheduledValues(whenPlay);
      wetG.gain.cancelScheduledValues(whenPlay);
      dryG.gain.setValueAtTime(vol * peakMul, whenPlay);
      wetG.gain.setValueAtTime(wetVol * peakMul, whenPlay);
      dryG.gain.linearRampToValueAtTime(vol, whenPlay + decaySec);
      wetG.gain.linearRampToValueAtTime(wetVol, whenPlay + decaySec);
    }

    if (lpNode && lpEnvAmt > 0.5 && effectiveLpHz >= 200) {
      const envDepth = lpEnvAmt / 100;
      const envDecSec = Math.max(0.005, Math.min(2, (sampler.lpEnvDecayMs ?? 120) / 1000));
      const baseHz = Math.min(effectiveLpHz, ny);
      const openHz = Math.min(ny, baseHz * (1 + envDepth * 3.4));
      lpNode.frequency.cancelScheduledValues(whenPlay);
      lpNode.frequency.setValueAtTime(openHz, whenPlay);
      lpNode.frequency.exponentialRampToValueAtTime(Math.max(40, baseHz), whenPlay + envDecSec);
    }

    // PITCH env / punch — always on detune so it works with rate-based fine tune.
    if (pitchDepth > 0.5 || pitchPunch > 0.5) {
      const decSec = Math.max(0.005, Math.min(2, pitchDecMs / 1000));
      const dropCents = pitchDepth * 12;
      const punchCents = pitchPunch * 2.4;
      src.detune.cancelScheduledValues(whenPlay);
      if (pitchPunch > 0.5) {
        src.detune.setValueAtTime(baseDetuneCents + punchCents, whenPlay);
        src.detune.linearRampToValueAtTime(
          baseDetuneCents - dropCents,
          whenPlay + Math.min(decSec, 0.04),
        );
        src.detune.linearRampToValueAtTime(baseDetuneCents, whenPlay + decSec);
      } else {
        src.detune.setValueAtTime(baseDetuneCents - dropCents, whenPlay);
        src.detune.linearRampToValueAtTime(baseDetuneCents, whenPlay + decSec);
      }
    }

    src.start(whenPlay, t0, playDur);
    if (!playOpts?.skipMeter) {
      registerBeatLabMeterVoice(
        chId,
        meterAnalyser,
        rawPan,
        whenPlay,
        whenPlay + Math.min(playDur + fxTailSec + 0.35, 6),
      );
    }
  } catch {
    disposeGraph();
    return () => {};
  }
  return stop;
}
