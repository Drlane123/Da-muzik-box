/**
 * Per-pad drum machine voice (Beat Pads overlay) — persisted per bank+pad.
 * Open Drums–style: tune, decay, velocity, timing, swing, groove.
 */

import type { BeatPadsGridStepsPerBar } from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import {
  defaultPadSamplerPlaybackOpts,
  type PadSamplerPlaybackOpts,
  writeSamplerOptsToStored,
  type StoredPadSample,
} from '@/app/lib/padSampleStorage';

export const BEAT_LAB_DRUM_PAD_VOICE_STORAGE_KEY = 'creationStation_drumPadVoice_v1';

export type BeatLabDrumPadNoteRepeat = 'off' | '8th' | '16th' | '32nd';

export type BeatLabDrumPadVoiceOpts = {
  /** Fine pitch semitones (−12…+12). */
  tuneSemi: number;
  /** Sample tail length 0…100 (100 = full decay). */
  decay: number;
  /** Base hit velocity 1…127. */
  velocity: number;
  /** Grid micro-timing nudge in ms (−40…+40). */
  timingMs: number;
  /** Swing feel 0…100 (50 = straight). */
  swing: number;
  /** Groove humanize 0…100. */
  groove: number;
  /** Hold pad to roll at this rate (BPM-synced). */
  noteRepeat: BeatLabDrumPadNoteRepeat;
};

export type BeatLabDrumPadVoiceStore = Record<string, BeatLabDrumPadVoiceOpts>;

const DEFAULT_PAD_VEL = [115, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 127];

export function beatLabDrumPadVoiceKey(bankIndex: number, padIndex: number): string {
  return `${bankIndex}_${padIndex}`;
}

export function defaultBeatLabDrumPadVoiceOpts(padIndex = 0): BeatLabDrumPadVoiceOpts {
  return {
    tuneSemi: 0,
    decay: 100,
    velocity: DEFAULT_PAD_VEL[padIndex] ?? 100,
    timingMs: 0,
    swing: 50,
    groove: 0,
    noteRepeat: 'off',
  };
}

export function clampBeatLabDrumPadVoiceOpts(
  o: Partial<BeatLabDrumPadVoiceOpts>,
  padIndex = 0,
): BeatLabDrumPadVoiceOpts {
  const d = defaultBeatLabDrumPadVoiceOpts(padIndex);
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return {
    tuneSemi: Math.max(-12, Math.min(12, Math.round(num(o.tuneSemi, d.tuneSemi)))),
    decay: Math.max(0, Math.min(100, Math.round(num(o.decay, d.decay)))),
    velocity: Math.max(1, Math.min(127, Math.round(num(o.velocity, d.velocity)))),
    timingMs: Math.max(-40, Math.min(40, Math.round(num(o.timingMs, d.timingMs)))),
    swing: Math.max(0, Math.min(100, Math.round(num(o.swing, d.swing)))),
    groove: Math.max(0, Math.min(100, Math.round(num(o.groove, d.groove)))),
    noteRepeat: normalizeBeatLabDrumPadNoteRepeat(o.noteRepeat, d.noteRepeat),
  };
}

export function normalizeBeatLabDrumPadNoteRepeat(
  raw: unknown,
  fallback: BeatLabDrumPadNoteRepeat = 'off',
): BeatLabDrumPadNoteRepeat {
  if (raw === '8th' || raw === '16th' || raw === '32nd' || raw === 'off') return raw;
  return fallback;
}

export const BEAT_LAB_DRUM_PAD_NOTE_REPEAT_OPTIONS: { id: BeatLabDrumPadNoteRepeat; label: string }[] = [
  { id: 'off', label: 'OFF' },
  { id: '8th', label: '1/8' },
  { id: '16th', label: '1/16' },
  { id: '32nd', label: '1/32' },
];

export function beatLabDrumPadNoteRepeatGridSteps(
  mode: BeatLabDrumPadNoteRepeat,
): BeatPadsGridStepsPerBar {
  return mode === '32nd' ? 32 : 16;
}

/** Roll-draw label from note-repeat mode (`1/8`, `1/16`, `1/32`). */
export function beatLabDrumPadNoteRepeatRollLabel(
  mode: BeatLabDrumPadNoteRepeat,
): '1/8' | '1/16' | '1/32' | undefined {
  if (mode === '8th') return '1/8';
  if (mode === '16th') return '1/16';
  if (mode === '32nd') return '1/32';
  return undefined;
}

/** Column snap step for roll-draw painting (1/32 needs a 32-step grid). */
export function beatPadsRollDrawSnapStep(
  rollLabel: string | undefined,
  stepsPerBar: BeatPadsGridStepsPerBar,
): number {
  const divPerBar =
    rollLabel === '1/8' ? 8 : rollLabel === '1/16' ? 16 : rollLabel === '1/32' ? 32 : 0;
  if (divPerBar <= 0) return 1;
  return Math.max(1, stepsPerBar / divPerBar);
}

/** Snap a pattern column to the roll-draw grid. */
export function beatPadsSnapRollDrawCol(
  col: number,
  rollLabel: string | undefined,
  stepsPerBar: BeatPadsGridStepsPerBar,
): number {
  const step = beatPadsRollDrawSnapStep(rollLabel, stepsPerBar);
  return Math.max(0, Math.round(col / step) * step);
}

/** Seconds between repeat hits while a pad is held (null = off). */
export function beatLabDrumPadNoteRepeatIntervalSec(
  bpm: number,
  mode: BeatLabDrumPadNoteRepeat,
): number | null {
  if (mode === 'off') return null;
  const spb = 60 / Math.max(1, bpm);
  const hitsPerBeat = mode === '8th' ? 2 : mode === '16th' ? 4 : 8;
  return spb / hitsPerBeat;
}

export function beatLabDrumPadVoiceWithNoteRepeat(
  voice: BeatLabDrumPadVoiceOpts,
  noteRepeat: BeatLabDrumPadNoteRepeat,
  padIndex = 0,
): BeatLabDrumPadVoiceOpts {
  return clampBeatLabDrumPadVoiceOpts({ ...voice, noteRepeat }, padIndex);
}

export function loadBeatLabDrumPadVoiceStore(): BeatLabDrumPadVoiceStore {
  try {
    const raw = localStorage.getItem(BEAT_LAB_DRUM_PAD_VOICE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as BeatLabDrumPadVoiceStore;
  } catch {
    return {};
  }
}

export function saveBeatLabDrumPadVoiceStore(store: BeatLabDrumPadVoiceStore): void {
  try {
    localStorage.setItem(BEAT_LAB_DRUM_PAD_VOICE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

/** Map decay knob to sampler trim / max length (when sample is loaded). */
export function beatLabDrumVoiceDecayToSampler(decay: number): Pick<PadSamplerPlaybackOpts, 'trim0' | 'trim1' | 'maxPlaySec'> {
  const d =
    typeof decay === 'number' && Number.isFinite(decay) ? Math.max(0, Math.min(100, decay)) : 100;
  if (d >= 98) {
    return { trim0: 0, trim1: 1, maxPlaySec: undefined };
  }
  const trim1 = Math.max(0.06, 0.08 + (d / 100) * 0.92);
  const maxPlaySec = 0.05 + (d / 100) * 2.4;
  return { trim0: 0, trim1, maxPlaySec };
}

/** Read decay % from sampler trim end (waveform right handle). */
export function beatPadSamplerTrim1ToDecay(trim1: number): number {
  const t = Math.max(0.06, Math.min(1, trim1));
  if (t >= 0.999) return 100;
  const d = ((t - 0.08) / 0.92) * 100;
  return Math.max(0, Math.min(100, Math.round(d)));
}

/**
 * Beat Pads playback merge — grid voice (velocity/timing/swing) is applied separately.
 * Sample shape (tune, pitch env, trim, filters) always comes from `base` sampler opts
 * (Instrument OSC / PITCH / AMP tabs + waveform).
 */
export function beatLabDrumVoiceToSamplerOpts(
  voice: BeatLabDrumPadVoiceOpts,
  base: PadSamplerPlaybackOpts = defaultPadSamplerPlaybackOpts(),
): PadSamplerPlaybackOpts {
  void voice;
  return {
    ...base,
    fineSemi: Math.max(-12, Math.min(12, base.fineSemi ?? 0)),
    pitchEnvDecayMs: base.pitchEnvDecayMs ?? 80,
    pitchEnvDepth: base.pitchEnvDepth ?? 0,
    pitchPunch: base.pitchPunch ?? 0,
    hpHz: base.hpHz ?? 0,
    lpHz: base.lpHz ?? 0,
    lpRes: base.lpRes ?? 0,
    lpEnvDepth: base.lpEnvDepth ?? 0,
    lpEnvDecayMs: base.lpEnvDecayMs ?? 120,
  };
}

export function syncBeatLabDrumVoiceToStoredSample(row: StoredPadSample, voice: BeatLabDrumPadVoiceOpts): void {
  const sampler = beatLabDrumVoiceToSamplerOpts(voice, defaultPadSamplerPlaybackOpts());
  writeSamplerOptsToStored(row, sampler);
}

/** Sequencer / live hit timing offset in seconds (swing + timing + groove jitter). */
export function beatLabDrumVoiceScheduleOffsetSec(
  voice: BeatLabDrumPadVoiceOpts,
  colInPattern: number,
  stepIndex = 0,
): number {
  let ms = voice.timingMs;
  const swingAmt = (voice.swing - 50) / 50;
  if (Math.abs(swingAmt) > 0.02 && colInPattern % 2 === 1) {
    ms += swingAmt * 28;
  }
  if (voice.groove > 0) {
    const seed = colInPattern * 17 + stepIndex * 31 + voice.velocity;
    const jitter = ((seed * 9301 + 49297) % 233280) / 233280 - 0.5;
    ms += jitter * voice.groove * 0.22;
  }
  return ms / 1000;
}

/** Velocity for grid hits with groove humanize. */
export function beatLabDrumVoiceGridVelocity(
  voice: BeatLabDrumPadVoiceOpts,
  colInPattern: number,
  stepIndex = 0,
): number {
  let v = voice.velocity;
  if (voice.groove > 0) {
    const seed = colInPattern * 13 + stepIndex * 29 + voice.timingMs;
    const jitter = ((seed * 1103515245 + 12345) % 2147483647) / 2147483647 - 0.5;
    v += Math.round(jitter * voice.groove * 0.35);
  }
  return Math.max(1, Math.min(127, v));
}

/** Manual pad strike — pointer velocity scales voice base. */
export function beatLabDrumVoiceManualVelocity(voice: BeatLabDrumPadVoiceOpts, pointerVel01: number): number {
  const pv = Math.max(0.05, Math.min(1, pointerVel01));
  return Math.max(1, Math.min(127, Math.round(voice.velocity * (0.35 + pv * 0.65))));
}

export type BeatLabDrumPadSampleParam = 'tune' | 'decay';
export type BeatLabDrumPadSequencerParam = 'velocity' | 'timing' | 'swing' | 'groove';
export type BeatLabDrumPadVoiceParam = BeatLabDrumPadSampleParam | BeatLabDrumPadSequencerParam;

export type BeatLabDrumPadVoiceParamDef = {
  id: BeatLabDrumPadVoiceParam;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
};

/** Per-pad sample voice — tune + decay only (manual pad hits + sample tail). */
export const BEAT_LAB_DRUM_PAD_SAMPLE_PARAMS: BeatLabDrumPadVoiceParamDef[] = [
  { id: 'tune', label: 'TUNE', min: -12, max: 12, step: 1, format: (v) => `${v > 0 ? '+' : ''}${v} st` },
  { id: 'decay', label: 'DECAY', min: 0, max: 100, step: 1, format: (v) => `${v}%` },
];

/** Loop sequencer lane feel — grid hits only (not manual pad strikes). */
export const BEAT_LAB_DRUM_PAD_SEQUENCER_PARAMS: BeatLabDrumPadVoiceParamDef[] = [
  { id: 'velocity', label: 'VELOCITY', min: 1, max: 127, step: 1, format: (v) => String(v) },
  { id: 'timing', label: 'TIMING', min: -40, max: 40, step: 1, format: (v) => `${v > 0 ? '+' : ''}${v} ms` },
  { id: 'swing', label: 'SWING', min: 0, max: 100, step: 1, format: (v) => `${v}%` },
  { id: 'groove', label: 'GROOVE', min: 0, max: 100, step: 1, format: (v) => `${v}%` },
];

/** All voice params (pad + sequencer) — storage shape unchanged. */
export const BEAT_LAB_DRUM_PAD_VOICE_PARAMS: BeatLabDrumPadVoiceParamDef[] = [
  ...BEAT_LAB_DRUM_PAD_SAMPLE_PARAMS,
  ...BEAT_LAB_DRUM_PAD_SEQUENCER_PARAMS,
];

export function beatLabDrumPadVoiceParamValue(
  voice: BeatLabDrumPadVoiceOpts,
  param: BeatLabDrumPadVoiceParam,
): number {
  switch (param) {
    case 'tune':
      return voice.tuneSemi;
    case 'decay':
      return voice.decay;
    case 'velocity':
      return voice.velocity;
    case 'timing':
      return voice.timingMs;
    case 'swing':
      return voice.swing;
    case 'groove':
      return voice.groove;
    default:
      return 0;
  }
}

export function beatLabDrumPadVoiceWithParam(
  voice: BeatLabDrumPadVoiceOpts,
  param: BeatLabDrumPadVoiceParam,
  value: number,
  padIndex = 0,
): BeatLabDrumPadVoiceOpts {
  const next = { ...voice };
  switch (param) {
    case 'tune':
      next.tuneSemi = value;
      break;
    case 'decay':
      next.decay = value;
      break;
    case 'velocity':
      next.velocity = value;
      break;
    case 'timing':
      next.timingMs = value;
      break;
    case 'swing':
      next.swing = value;
      break;
    case 'groove':
      next.groove = value;
      break;
    default:
      break;
  }
  return clampBeatLabDrumPadVoiceOpts(next, padIndex);
}

/** Keep AudioContext running + output path hot before live pad hits (reduces first-strike lag). */
export function warmBeatLabLivePadAudio(ctx: AudioContext): void {
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
  try {
    const master = (window as unknown as { __daMusicMasterGain?: GainNode | null }).__daMusicMasterGain;
    const dest = master && master.context === ctx ? master : ctx.destination;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(dest);
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    src.connect(g);
    const t = ctx.currentTime;
    src.start(t);
    src.stop(t + 0.001);
  } catch {
    /* */
  }
}
