/**
 * Groove Lab MELODY / RIFF lane — mid-register leads (plucks, guitar, synth).
 * Not the 808 sub engine — bright envelopes tuned for C4–B4.
 */
import {
  resolveGrooveLabAudioDest,
  resolveGrooveLabMelodyPlaybackDest,
} from '@/app/lib/creationStation/grooveLabAudio';
import { truncateGrooveLabGuitarLickMonoGroup } from '@/app/lib/creationStation/grooveLabGuitarLickBank';

export type GrooveLabLeadVoiceKind = 'pluck' | 'guitar' | 'synth' | 'keys';

export type GrooveLabLeadPresetDef = {
  label: string;
  kind: GrooveLabLeadVoiceKind;
  wave: OscillatorType;
  wave2?: OscillatorType;
  osc2Level?: number;
  detuneCents?: number;
  attackMs: number;
  decayMs: number;
  sustain: number;
  releaseMs: number;
  filterType: BiquadFilterType;
  /** Filter center ≈ noteHz × this multiplier. */
  filterFreqMul: number;
  filterQ: number;
  /** 0–1: how much the filter closes during decay. */
  filterEnvDepth: number;
  clickLevel?: number;
  drive?: number;
  brightness?: number;
  /** Optional auto-wah LFO rate/depth for guitar-style motion. */
  wahRateHz?: number;
  wahDepth?: number;
  /** Optional vibrato LFO for smooth sine-lead movement. */
  lfoRateHz?: number;
  lfoDepthCents?: number;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function midiToHz(m: number): number {
  return 440 * 2 ** ((m - 69) / 12);
}

const activeLeadStops = new Map<string, (t: number) => void>();
const lastLeadHzByGroup = new Map<string, number>();

type MonoLeadOsc = { node: OscillatorNode; detuneCents: number };

type MonoLeadSession = {
  oscs: MonoLeadOsc[];
  filter: BiquadFilterNode;
  out: GainNode;
  releaseAt: number;
};

const monoLeadSessions = new Map<string, MonoLeadSession>();

/** True when a mono lead voice is still sounding (for legato / skip-choke decisions). */
export function grooveLabMonoLeadIsSustaining(group: string, whenSec: number): boolean {
  const session = monoLeadSessions.get(group);
  return session != null && session.releaseAt > whenSec + 0.008;
}

function monoGroupKey(opts?: PlayGrooveLabLeadVoiceOpts): string {
  return opts?.monoGroup?.trim() || '__default__';
}

/** Equal-temperament portamento — exponential pitch ramp (musical glide, not linear Hz sweep). */
function rampNoteFrequency(
  param: AudioParam,
  fromHz: number,
  toHz: number,
  t0: number,
  glideSec: number,
): void {
  const f0 = Math.max(20, fromHz);
  const f1 = Math.max(20, toHz);
  param.cancelScheduledValues(t0);
  param.setValueAtTime(f0, t0);
  if (glideSec > 0.001 && Math.abs(f1 - f0) > 0.25) {
    param.exponentialRampToValueAtTime(f1, t0 + glideSec);
  } else {
    param.setValueAtTime(f1, t0);
  }
}

/** Fast choke — must stop oscillators; recursive no-op was stacking voices (heard as bar stabs). */
export function truncateGrooveLabLeadVoiceMonoGroup(whenSec: number, group: string): void {
  monoLeadSessions.delete(group);
  const stop = activeLeadStops.get(group);
  if (!stop) {
    activeLeadStops.delete(group);
    return;
  }
  try {
    stop(whenSec);
  } catch {
    activeLeadStops.delete(group);
  }
}

/** Transport STOP — choke every registered lead mono group (guitar + synth lanes). */
export function haltAllGrooveLabLeadVoices(whenSec: number): void {
  for (const group of [...activeLeadStops.keys()]) {
    truncateGrooveLabLeadVoiceMonoGroup(whenSec, group);
  }
  monoLeadSessions.clear();
}

function registerMonoLeadStop(
  ctx: AudioContext,
  group: string,
  session: MonoLeadSession,
  stoppable: readonly AudioScheduledSourceNode[],
): void {
  const { out } = session;
  activeLeadStops.set(group, (stopAt) => {
    const t = Math.max(stopAt, ctx.currentTime);
    try {
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(0, t);
      out.gain.setTargetAtTime(0.0001, t, 0.008);
      for (const node of stoppable) {
        try {
          node.stop(t + 0.04);
        } catch {
          /* already ended */
        }
      }
    } catch {
      /* context gone */
    }
    monoLeadSessions.delete(group);
    activeLeadStops.delete(group);
  });
}

/** Legato: keep sounding voice, glide pitch, no new attack click. */
function legatoRetargetMonoLead(
  session: MonoLeadSession,
  baseHz: number,
  t0: number,
  glideSec: number,
  sustainLvl: number,
  hold: number,
  release: number,
  fBase: number,
  fEnd: number,
): number {
  for (const { node } of session.oscs) {
    const fromHz = Math.max(20, node.frequency.value);
    rampNoteFrequency(node.frequency, fromHz, baseHz, t0, glideSec);
  }
  session.filter.frequency.cancelScheduledValues(t0);
  session.filter.frequency.setValueAtTime(fBase, t0);
  session.filter.frequency.exponentialRampToValueAtTime(Math.max(80, fEnd), t0 + Math.min(glideSec + 0.08, 0.22));

  const tReleaseStart = t0 + hold;
  const tEnd = tReleaseStart + release + 0.05;
  const out = session.out;
  out.gain.cancelScheduledValues(t0);
  const gNow = Math.max(out.gain.value, 0.0002);
  out.gain.setValueAtTime(gNow, t0);
  out.gain.setTargetAtTime(Math.max(sustainLvl, 0.0002), t0 + 0.012, 0.035);
  out.gain.setTargetAtTime(0.0001, tReleaseStart, release * 0.4);
  session.releaseAt = tEnd;
  return tEnd;
}

export const GROOVE_LAB_LEAD_PRESETS = {
  pluckBright: {
    label: 'Bright pluck',
    kind: 'pluck',
    wave: 'triangle',
    attackMs: 1,
    decayMs: 220,
    sustain: 0.08,
    releaseMs: 140,
    filterType: 'lowpass',
    filterFreqMul: 12,
    filterQ: 2.8,
    filterEnvDepth: 0.72,
    clickLevel: 0.38,
    brightness: 1.05,
  },
  pluckMarimba: {
    label: 'Marimba pluck',
    kind: 'pluck',
    wave: 'sine',
    wave2: 'triangle',
    osc2Level: 0.35,
    detuneCents: 4,
    attackMs: 0.5,
    decayMs: 380,
    sustain: 0.04,
    releaseMs: 200,
    filterType: 'lowpass',
    filterFreqMul: 9,
    filterQ: 1.6,
    filterEnvDepth: 0.55,
    clickLevel: 0.28,
  },
  pluckNylon: {
    label: 'Nylon pluck',
    kind: 'pluck',
    wave: 'triangle',
    attackMs: 2,
    decayMs: 340,
    sustain: 0.1,
    releaseMs: 180,
    filterType: 'lowpass',
    filterFreqMul: 8,
    filterQ: 2.2,
    filterEnvDepth: 0.62,
    clickLevel: 0.32,
  },
  pluckBell: {
    label: 'Bell pluck',
    kind: 'pluck',
    wave: 'sine',
    wave2: 'sine',
    osc2Level: 0.5,
    detuneCents: 1200,
    attackMs: 0.5,
    decayMs: 520,
    sustain: 0.02,
    releaseMs: 280,
    filterType: 'bandpass',
    filterFreqMul: 14,
    filterQ: 4.2,
    filterEnvDepth: 0.4,
    clickLevel: 0.22,
  },
  pluckStab: {
    label: 'Short stab',
    kind: 'pluck',
    wave: 'sawtooth',
    attackMs: 0.5,
    decayMs: 160,
    sustain: 0.05,
    releaseMs: 90,
    filterType: 'lowpass',
    filterFreqMul: 10,
    filterQ: 3.4,
    filterEnvDepth: 0.8,
    clickLevel: 0.42,
    drive: 0.12,
  },
  leadGtrFinger: {
    label: 'Lead guitar finger',
    kind: 'guitar',
    wave: 'sawtooth',
    wave2: 'triangle',
    osc2Level: 0.28,
    attackMs: 6,
    decayMs: 280,
    sustain: 0.55,
    releaseMs: 220,
    filterType: 'lowpass',
    filterFreqMul: 9,
    filterQ: 2.4,
    filterEnvDepth: 0.45,
    clickLevel: 0.24,
    drive: 0.08,
  },
  leadGtrPick: {
    label: 'Lead guitar pick',
    kind: 'guitar',
    wave: 'sawtooth',
    attackMs: 3,
    decayMs: 240,
    sustain: 0.5,
    releaseMs: 190,
    filterType: 'lowpass',
    filterFreqMul: 11,
    filterQ: 2.8,
    filterEnvDepth: 0.5,
    clickLevel: 0.34,
    drive: 0.14,
  },
  leadGtrOverdrive: {
    label: 'Overdrive lead',
    kind: 'guitar',
    wave: 'sawtooth',
    wave2: 'square',
    osc2Level: 0.18,
    attackMs: 4,
    decayMs: 320,
    sustain: 0.62,
    releaseMs: 260,
    filterType: 'lowpass',
    filterFreqMul: 7.5,
    filterQ: 3.2,
    filterEnvDepth: 0.38,
    clickLevel: 0.3,
    drive: 0.38,
  },
  leadGtrSlide: {
    label: 'Slide lead',
    kind: 'guitar',
    wave: 'triangle',
    attackMs: 12,
    decayMs: 360,
    sustain: 0.68,
    releaseMs: 300,
    filterType: 'lowpass',
    filterFreqMul: 8.5,
    filterQ: 2,
    filterEnvDepth: 0.35,
    clickLevel: 0.18,
  },
  leadGtrWahClean: {
    label: 'Wah clean guitar',
    kind: 'guitar',
    wave: 'triangle',
    wave2: 'sine',
    osc2Level: 0.22,
    attackMs: 5,
    decayMs: 260,
    sustain: 0.56,
    releaseMs: 220,
    filterType: 'bandpass',
    filterFreqMul: 8.8,
    filterQ: 3.1,
    filterEnvDepth: 0.34,
    clickLevel: 0.2,
    wahRateHz: 2.1,
    wahDepth: 0.48,
  },
  leadGtrWahDrive: {
    label: 'Wah drive guitar',
    kind: 'guitar',
    wave: 'sawtooth',
    wave2: 'square',
    osc2Level: 0.14,
    attackMs: 3,
    decayMs: 280,
    sustain: 0.64,
    releaseMs: 230,
    filterType: 'bandpass',
    filterFreqMul: 7.2,
    filterQ: 4.4,
    filterEnvDepth: 0.3,
    clickLevel: 0.26,
    drive: 0.3,
    wahRateHz: 2.6,
    wahDepth: 0.62,
  },
  leadGtrCleanChime: {
    label: 'Clean chime lead',
    kind: 'guitar',
    wave: 'triangle',
    wave2: 'sine',
    osc2Level: 0.24,
    detuneCents: 7,
    attackMs: 4,
    decayMs: 260,
    sustain: 0.5,
    releaseMs: 210,
    filterType: 'lowpass',
    filterFreqMul: 10.5,
    filterQ: 1.9,
    filterEnvDepth: 0.42,
    clickLevel: 0.2,
  },
  leadGtrPalmMute: {
    label: 'Palm mute lead',
    kind: 'guitar',
    wave: 'sawtooth',
    attackMs: 1,
    decayMs: 120,
    sustain: 0.14,
    releaseMs: 95,
    filterType: 'lowpass',
    filterFreqMul: 6.8,
    filterQ: 3.6,
    filterEnvDepth: 0.82,
    clickLevel: 0.5,
    drive: 0.24,
  },
  leadGtrHarmonic: {
    label: 'Harmonic lead',
    kind: 'guitar',
    wave: 'triangle',
    wave2: 'sine',
    osc2Level: 0.52,
    detuneCents: 1200,
    attackMs: 3,
    decayMs: 390,
    sustain: 0.22,
    releaseMs: 280,
    filterType: 'bandpass',
    filterFreqMul: 12.5,
    filterQ: 3.8,
    filterEnvDepth: 0.36,
    clickLevel: 0.16,
    brightness: 1.08,
  },
  lickBluesSlide: {
    label: 'Blues slide lick',
    kind: 'guitar',
    wave: 'sawtooth',
    wave2: 'triangle',
    osc2Level: 0.26,
    detuneCents: -4,
    attackMs: 14,
    decayMs: 330,
    sustain: 0.64,
    releaseMs: 340,
    filterType: 'lowpass',
    filterFreqMul: 7.8,
    filterQ: 2.3,
    filterEnvDepth: 0.34,
    clickLevel: 0.22,
    drive: 0.16,
  },
  lickArenaHook: {
    label: 'Arena hook lick',
    kind: 'guitar',
    wave: 'sawtooth',
    wave2: 'square',
    osc2Level: 0.16,
    attackMs: 8,
    decayMs: 300,
    sustain: 0.7,
    releaseMs: 260,
    filterType: 'lowpass',
    filterFreqMul: 8.8,
    filterQ: 2.9,
    filterEnvDepth: 0.3,
    clickLevel: 0.24,
    drive: 0.3,
  },
  lickNeoSoulPhrase: {
    label: 'Neo soul lick',
    kind: 'guitar',
    wave: 'triangle',
    wave2: 'triangle',
    osc2Level: 0.22,
    detuneCents: 3,
    attackMs: 9,
    decayMs: 360,
    sustain: 0.58,
    releaseMs: 280,
    filterType: 'lowpass',
    filterFreqMul: 9.6,
    filterQ: 2,
    filterEnvDepth: 0.4,
    clickLevel: 0.18,
  },
  pluckMutedPick: {
    label: 'Muted pick pluck',
    kind: 'pluck',
    wave: 'triangle',
    wave2: 'square',
    osc2Level: 0.2,
    attackMs: 0.6,
    decayMs: 145,
    sustain: 0.05,
    releaseMs: 85,
    filterType: 'lowpass',
    filterFreqMul: 7.2,
    filterQ: 3.2,
    filterEnvDepth: 0.88,
    clickLevel: 0.48,
    drive: 0.1,
  },
  pluckMandolin: {
    label: 'Mandolin pluck',
    kind: 'pluck',
    wave: 'triangle',
    wave2: 'triangle',
    osc2Level: 0.44,
    detuneCents: 9,
    attackMs: 0.7,
    decayMs: 210,
    sustain: 0.06,
    releaseMs: 120,
    filterType: 'bandpass',
    filterFreqMul: 11,
    filterQ: 2.9,
    filterEnvDepth: 0.62,
    clickLevel: 0.4,
    brightness: 1.06,
  },
  synthSawLead: {
    label: 'Saw lead',
    kind: 'synth',
    wave: 'sawtooth',
    attackMs: 8,
    decayMs: 200,
    sustain: 0.72,
    releaseMs: 180,
    filterType: 'lowpass',
    filterFreqMul: 6.5,
    filterQ: 1.8,
    filterEnvDepth: 0.35,
    brightness: 1.1,
  },
  synthSquareHook: {
    label: 'Square hook',
    kind: 'synth',
    wave: 'square',
    attackMs: 4,
    decayMs: 180,
    sustain: 0.65,
    releaseMs: 160,
    filterType: 'lowpass',
    filterFreqMul: 5.5,
    filterQ: 2.2,
    filterEnvDepth: 0.42,
    drive: 0.18,
  },
  synthSupersaw: {
    label: 'Supersaw lead',
    kind: 'synth',
    wave: 'sawtooth',
    detuneCents: 14,
    attackMs: 10,
    decayMs: 240,
    sustain: 0.78,
    releaseMs: 200,
    filterType: 'lowpass',
    filterFreqMul: 7,
    filterQ: 1.4,
    filterEnvDepth: 0.28,
    brightness: 1.15,
  },
  synthFilterSweep: {
    label: 'Filter sweep',
    kind: 'synth',
    wave: 'sawtooth',
    attackMs: 18,
    decayMs: 420,
    sustain: 0.7,
    releaseMs: 240,
    filterType: 'lowpass',
    filterFreqMul: 4.5,
    filterQ: 3.6,
    filterEnvDepth: 0.85,
  },
  synthBrass: {
    label: 'Synth brass',
    kind: 'synth',
    wave: 'sawtooth',
    wave2: 'square',
    osc2Level: 0.22,
    attackMs: 35,
    decayMs: 280,
    sustain: 0.75,
    releaseMs: 220,
    filterType: 'lowpass',
    filterFreqMul: 5,
    filterQ: 2.6,
    filterEnvDepth: 0.5,
    drive: 0.22,
  },
  synthRetro: {
    label: 'Retro lead',
    kind: 'synth',
    wave: 'square',
    attackMs: 6,
    decayMs: 260,
    sustain: 0.68,
    releaseMs: 190,
    filterType: 'lowpass',
    filterFreqMul: 8,
    filterQ: 2,
    filterEnvDepth: 0.48,
    drive: 0.1,
  },
  synthNeon: {
    label: 'Neon digital',
    kind: 'synth',
    wave: 'sawtooth',
    detuneCents: -8,
    attackMs: 2,
    decayMs: 190,
    sustain: 0.6,
    releaseMs: 150,
    filterType: 'lowpass',
    filterFreqMul: 12,
    filterQ: 3.8,
    filterEnvDepth: 0.65,
    clickLevel: 0.2,
    brightness: 1.2,
  },
  keysEPiano: {
    label: 'EPiano stab',
    kind: 'keys',
    wave: 'sine',
    wave2: 'triangle',
    osc2Level: 0.4,
    detuneCents: -5,
    attackMs: 1,
    decayMs: 420,
    sustain: 0.12,
    releaseMs: 260,
    filterType: 'lowpass',
    filterFreqMul: 10,
    filterQ: 1.2,
    filterEnvDepth: 0.5,
    clickLevel: 0.26,
  },
  keysGlass: {
    label: 'Glass keys',
    kind: 'keys',
    wave: 'sine',
    wave2: 'sine',
    osc2Level: 0.55,
    detuneCents: 1902,
    attackMs: 0.5,
    decayMs: 600,
    sustain: 0.06,
    releaseMs: 320,
    filterType: 'highpass',
    filterFreqMul: 2.2,
    filterQ: 0.9,
    filterEnvDepth: 0.2,
    clickLevel: 0.18,
  },
  sineSilkLead: {
    label: 'Sine silk lead',
    kind: 'synth',
    wave: 'sine',
    wave2: 'triangle',
    osc2Level: 0.16,
    detuneCents: 4,
    attackMs: 8,
    decayMs: 260,
    sustain: 0.74,
    releaseMs: 240,
    filterType: 'lowpass',
    filterFreqMul: 6.2,
    filterQ: 0.9,
    filterEnvDepth: 0.22,
    clickLevel: 0.06,
    drive: 0.16,
    brightness: 0.94,
    lfoRateHz: 3.1,
    lfoDepthCents: 11,
  },
  sineSilkSoft: {
    label: 'Sine warm glide',
    kind: 'synth',
    wave: 'sine',
    wave2: 'sine',
    osc2Level: 0.1,
    detuneCents: 2,
    attackMs: 20,
    decayMs: 360,
    sustain: 0.84,
    releaseMs: 360,
    filterType: 'lowpass',
    filterFreqMul: 4.4,
    filterQ: 0.52,
    filterEnvDepth: 0.1,
    clickLevel: 0.0,
    drive: 0.04,
    brightness: 0.82,
    lfoRateHz: 1.9,
    lfoDepthCents: 5,
  },
  sineSilkVocal: {
    label: 'Sine silk vocal',
    kind: 'synth',
    wave: 'sine',
    wave2: 'triangle',
    osc2Level: 0.14,
    detuneCents: 5,
    attackMs: 10,
    decayMs: 300,
    sustain: 0.78,
    releaseMs: 290,
    filterType: 'lowpass',
    filterFreqMul: 5.8,
    filterQ: 0.82,
    filterEnvDepth: 0.2,
    clickLevel: 0.04,
    drive: 0.11,
    brightness: 0.9,
    lfoRateHz: 2.9,
    lfoDepthCents: 9,
  },
  sineSilkAir: {
    label: 'Sine silk air',
    kind: 'synth',
    wave: 'sine',
    wave2: 'triangle',
    osc2Level: 0.1,
    detuneCents: 2,
    attackMs: 18,
    decayMs: 340,
    sustain: 0.82,
    releaseMs: 340,
    filterType: 'lowpass',
    filterFreqMul: 5.1,
    filterQ: 0.6,
    filterEnvDepth: 0.14,
    clickLevel: 0.01,
    drive: 0.06,
    brightness: 0.84,
    lfoRateHz: 2.1,
    lfoDepthCents: 6,
  },
  sineGospelWarm: {
    label: 'Sine gospel warm',
    kind: 'synth',
    wave: 'sine',
    wave2: 'triangle',
    osc2Level: 0.1,
    detuneCents: 2,
    attackMs: 18,
    decayMs: 340,
    sustain: 0.84,
    releaseMs: 340,
    filterType: 'lowpass',
    filterFreqMul: 4.3,
    filterQ: 0.52,
    filterEnvDepth: 0.1,
    clickLevel: 0,
    drive: 0.04,
    brightness: 0.82,
    lfoRateHz: 1.9,
    lfoDepthCents: 5,
  },
  sinePureLead: {
    label: 'R&B sine lead',
    kind: 'synth',
    wave: 'sine',
    attackMs: 18,
    decayMs: 280,
    sustain: 0.84,
    releaseMs: 480,
    filterType: 'lowpass',
    filterFreqMul: 4.8,
    filterQ: 0.46,
    filterEnvDepth: 0.05,
    clickLevel: 0,
    drive: 0.03,
    brightness: 0.88,
    lfoRateHz: 5.4,
    lfoDepthCents: 8,
  },
  sineRnBSilk: {
    label: 'R&B sine silk',
    kind: 'synth',
    wave: 'sine',
    wave2: 'sine',
    osc2Level: 0.08,
    detuneCents: 3,
    attackMs: 28,
    decayMs: 380,
    sustain: 0.88,
    releaseMs: 460,
    filterType: 'lowpass',
    filterFreqMul: 4.2,
    filterQ: 0.42,
    filterEnvDepth: 0.06,
    clickLevel: 0,
    drive: 0.02,
    brightness: 0.82,
    lfoRateHz: 4.8,
    lfoDepthCents: 7,
  },
  sineRomanticKeys: {
    label: 'Romantic Keys sine',
    kind: 'synth',
    wave: 'sine',
    wave2: 'sine',
    osc2Level: 0.1,
    detuneCents: 2,
    attackMs: 22,
    decayMs: 380,
    sustain: 0.88,
    releaseMs: 400,
    filterType: 'lowpass',
    filterFreqMul: 4.2,
    filterQ: 0.42,
    filterEnvDepth: 0.06,
    clickLevel: 0,
    drive: 0.03,
    brightness: 0.84,
    lfoRateHz: 1.6,
    lfoDepthCents: 4,
  },
  sineWaveGlide: {
    label: 'Wave Lead glide',
    kind: 'synth',
    wave: 'sine',
    wave2: 'triangle',
    osc2Level: 0.18,
    detuneCents: 5,
    attackMs: 10,
    decayMs: 290,
    sustain: 0.83,
    releaseMs: 320,
    filterType: 'lowpass',
    filterFreqMul: 6.2,
    filterQ: 0.65,
    filterEnvDepth: 0.1,
    clickLevel: 0.01,
    drive: 0.05,
    brightness: 1,
    lfoRateHz: 2.2,
    lfoDepthCents: 7,
  },
  sineGospelGlide: {
    label: 'WaveLead silky glide',
    kind: 'synth',
    wave: 'sine',
    wave2: 'triangle',
    osc2Level: 0.22,
    detuneCents: 6,
    attackMs: 12,
    decayMs: 300,
    sustain: 0.84,
    releaseMs: 340,
    filterType: 'lowpass',
    filterFreqMul: 6.6,
    filterQ: 0.72,
    filterEnvDepth: 0.12,
    clickLevel: 0.02,
    drive: 0.06,
    brightness: 1.04,
    lfoRateHz: 2.4,
    lfoDepthCents: 9,
  },
  sineGospelCry: {
    label: 'Sine gospel cry',
    kind: 'synth',
    wave: 'sine',
    wave2: 'triangle',
    osc2Level: 0.18,
    detuneCents: 5,
    attackMs: 10,
    decayMs: 300,
    sustain: 0.78,
    releaseMs: 290,
    filterType: 'lowpass',
    filterFreqMul: 5.6,
    filterQ: 0.86,
    filterEnvDepth: 0.2,
    clickLevel: 0.03,
    drive: 0.12,
    brightness: 0.92,
    lfoRateHz: 2.9,
    lfoDepthCents: 10,
  },
  sineGospelSoft: {
    label: 'Romantic Keys silky',
    kind: 'synth',
    wave: 'sine',
    wave2: 'sine',
    osc2Level: 0.08,
    detuneCents: 1,
    attackMs: 24,
    decayMs: 360,
    sustain: 0.86,
    releaseMs: 380,
    filterType: 'lowpass',
    filterFreqMul: 3.9,
    filterQ: 0.45,
    filterEnvDepth: 0.08,
    clickLevel: 0,
    drive: 0.03,
    brightness: 0.78,
    lfoRateHz: 1.7,
    lfoDepthCents: 4,
  },
  sineGospelLayer: {
    label: 'Sine gospel layer',
    kind: 'synth',
    wave: 'sine',
    wave2: 'triangle',
    osc2Level: 0.24,
    detuneCents: 7,
    attackMs: 12,
    decayMs: 330,
    sustain: 0.8,
    releaseMs: 310,
    filterType: 'lowpass',
    filterFreqMul: 5.1,
    filterQ: 0.7,
    filterEnvDepth: 0.15,
    clickLevel: 0.02,
    drive: 0.1,
    brightness: 0.9,
    lfoRateHz: 2.4,
    lfoDepthCents: 8,
  },
  sineGospelAir: {
    label: 'Sine gospel air',
    kind: 'synth',
    wave: 'sine',
    wave2: 'triangle',
    osc2Level: 0.1,
    detuneCents: 2,
    attackMs: 20,
    decayMs: 350,
    sustain: 0.84,
    releaseMs: 360,
    filterType: 'lowpass',
    filterFreqMul: 4.9,
    filterQ: 0.58,
    filterEnvDepth: 0.12,
    clickLevel: 0.01,
    drive: 0.05,
    brightness: 0.88,
    lfoRateHz: 2.1,
    lfoDepthCents: 6,
  },
  sineGospelVocal: {
    label: 'Sine gospel vocal',
    kind: 'synth',
    wave: 'sine',
    wave2: 'triangle',
    osc2Level: 0.16,
    detuneCents: 4,
    attackMs: 11,
    decayMs: 310,
    sustain: 0.8,
    releaseMs: 300,
    filterType: 'lowpass',
    filterFreqMul: 5.4,
    filterQ: 0.82,
    filterEnvDepth: 0.18,
    clickLevel: 0.02,
    drive: 0.09,
    brightness: 0.9,
    lfoRateHz: 2.8,
    lfoDepthCents: 9,
  },
  sineGospelPadLead: {
    label: 'Sine gospel pad lead',
    kind: 'synth',
    wave: 'sine',
    wave2: 'triangle',
    osc2Level: 0.2,
    detuneCents: 6,
    attackMs: 26,
    decayMs: 420,
    sustain: 0.86,
    releaseMs: 420,
    filterType: 'lowpass',
    filterFreqMul: 4.2,
    filterQ: 0.5,
    filterEnvDepth: 0.08,
    clickLevel: 0,
    drive: 0.06,
    brightness: 0.84,
    lfoRateHz: 1.8,
    lfoDepthCents: 6,
  },
  orchHit_pizz: {
    label: 'Pizz stab',
    kind: 'pluck',
    wave: 'triangle',
    wave2: 'sawtooth',
    osc2Level: 0.12,
    attackMs: 0.5,
    decayMs: 140,
    sustain: 0.02,
    releaseMs: 70,
    filterType: 'bandpass',
    filterFreqMul: 11,
    filterQ: 3.8,
    filterEnvDepth: 0.75,
    clickLevel: 0.48,
    drive: 0.06,
  },
  orchHit_pizzChord: {
    label: 'Pizz chord',
    kind: 'pluck',
    wave: 'sawtooth',
    wave2: 'triangle',
    osc2Level: 0.28,
    detuneCents: 7,
    attackMs: 0.5,
    decayMs: 180,
    sustain: 0.04,
    releaseMs: 90,
    filterType: 'lowpass',
    filterFreqMul: 9.5,
    filterQ: 3.2,
    filterEnvDepth: 0.82,
    clickLevel: 0.4,
    drive: 0.1,
  },
  orchHit_strings: {
    label: 'String hit',
    kind: 'pluck',
    wave: 'sawtooth',
    wave2: 'sawtooth',
    osc2Level: 0.35,
    detuneCents: 5,
    attackMs: 2,
    decayMs: 260,
    sustain: 0.06,
    releaseMs: 120,
    filterType: 'lowpass',
    filterFreqMul: 7.5,
    filterQ: 2.4,
    filterEnvDepth: 0.65,
    clickLevel: 0.22,
    drive: 0.14,
    brightness: 1.08,
  },
  orchHit_brass: {
    label: 'Brass stab',
    kind: 'synth',
    wave: 'sawtooth',
    wave2: 'square',
    osc2Level: 0.3,
    attackMs: 4,
    decayMs: 220,
    sustain: 0.08,
    releaseMs: 110,
    filterType: 'lowpass',
    filterFreqMul: 5.8,
    filterQ: 2.8,
    filterEnvDepth: 0.7,
    clickLevel: 0.18,
    drive: 0.28,
  },
  orchHit_horn: {
    label: 'Horn shot',
    kind: 'synth',
    wave: 'triangle',
    wave2: 'sawtooth',
    osc2Level: 0.22,
    detuneCents: -7,
    attackMs: 8,
    decayMs: 310,
    sustain: 0.1,
    releaseMs: 140,
    filterType: 'lowpass',
    filterFreqMul: 4.6,
    filterQ: 2.2,
    filterEnvDepth: 0.55,
    clickLevel: 0.12,
    drive: 0.18,
    brightness: 0.95,
  },
  orchHit_timp: {
    label: 'Timp hit',
    kind: 'pluck',
    wave: 'sine',
    attackMs: 0.5,
    decayMs: 420,
    sustain: 0.02,
    releaseMs: 180,
    filterType: 'lowpass',
    filterFreqMul: 3.2,
    filterQ: 1.2,
    filterEnvDepth: 0.35,
    clickLevel: 0.55,
    drive: 0.22,
  },
  orchHit_mallet: {
    label: 'Mallet',
    kind: 'pluck',
    wave: 'sine',
    wave2: 'triangle',
    osc2Level: 0.4,
    detuneCents: 12,
    attackMs: 0.5,
    decayMs: 320,
    sustain: 0.03,
    releaseMs: 160,
    filterType: 'lowpass',
    filterFreqMul: 10,
    filterQ: 2,
    filterEnvDepth: 0.6,
    clickLevel: 0.36,
  },
  orchHit_choir: {
    label: 'Choir stab',
    kind: 'synth',
    wave: 'sine',
    wave2: 'triangle',
    osc2Level: 0.45,
    detuneCents: 9,
    attackMs: 12,
    decayMs: 380,
    sustain: 0.12,
    releaseMs: 200,
    filterType: 'lowpass',
    filterFreqMul: 6.2,
    filterQ: 1.4,
    filterEnvDepth: 0.4,
    clickLevel: 0.04,
    drive: 0.08,
    brightness: 1.1,
  },
  orchHit_cym: {
    label: 'Cym slice',
    kind: 'pluck',
    wave: 'square',
    wave2: 'sine',
    osc2Level: 0.55,
    detuneCents: 19,
    attackMs: 0.5,
    decayMs: 480,
    sustain: 0.01,
    releaseMs: 240,
    filterType: 'highpass',
    filterFreqMul: 14,
    filterQ: 4.5,
    filterEnvDepth: 0.5,
    clickLevel: 0.62,
    brightness: 1.2,
  },
  orchHit_cine: {
    label: 'Cinematic',
    kind: 'synth',
    wave: 'sawtooth',
    wave2: 'square',
    osc2Level: 0.42,
    detuneCents: -12,
    attackMs: 1,
    decayMs: 520,
    sustain: 0.14,
    releaseMs: 280,
    filterType: 'lowpass',
    filterFreqMul: 4.8,
    filterQ: 3.4,
    filterEnvDepth: 0.88,
    clickLevel: 0.28,
    drive: 0.35,
    brightness: 1.05,
  },
} as const satisfies Record<string, GrooveLabLeadPresetDef>;

export type GrooveLabLeadSoundId = keyof typeof GROOVE_LAB_LEAD_PRESETS;
export const GROOVE_LAB_LEAD_SOUND_ORDER = Object.keys(GROOVE_LAB_LEAD_PRESETS) as GrooveLabLeadSoundId[];

export type PlayGrooveLabLeadVoiceOpts = {
  monophonic?: boolean;
  monoGroup?: string;
  glideMs?: number;
  outputNode?: AudioNode;
  filterCutoffHz?: number;
  lowCutHz?: number;
  highCutHz?: number;
  leadLfoRateHz?: number;
  leadLfoDepthCents?: number;
  wahAmount?: number;
  wahRateHz?: number;
  drive?: number;
  distortion?: number;
  maxSustainSec?: number;
  disableLegato?: boolean;
  transportClean?: boolean;
};

export function playGrooveLabLeadVoice(
  ctx: AudioContext,
  when: number,
  midi: number,
  preset: GrooveLabLeadPresetDef,
  velocity01 = 0.88,
  sustainSec = 0.45,
  opts?: PlayGrooveLabLeadVoiceOpts,
): void {
  const t0 = when;
  const hz = midiToHz(clamp(Math.round(midi), 0, 127));
  const vel = clamp(velocity01, 0.05, 1);
  const bright = preset.brightness ?? 1;
  const extDrive = Math.max(0, Math.min(1, opts?.drive ?? 0));
  const extDistortion = Math.max(0, Math.min(1, opts?.distortion ?? 0));
  const extWahAmount = Math.max(0, Math.min(1, opts?.wahAmount ?? 0));
  const extWahRateHz = Math.max(0, opts?.wahRateHz ?? 0);
  const fxHeat = clamp(Math.max(extDrive, extDistortion), 0, 1);
  const waveLeadPresence =
    preset.wave === 'sine' && preset.kind === 'synth' && (preset.lfoDepthCents ?? 0) >= 6 ? 1.08 : 1;
  const peak = 0.44 * vel * bright * waveLeadPresence;
  /** Sine leads: no gain overshoot — the 1.2× bump reads as a second "ba" under each melody note. */
  const softSineLead =
    preset.wave === 'sine' && preset.kind === 'synth' && (preset.clickLevel ?? 0) < 0.03;

  const transportClean = opts?.transportClean === true;
  const monoGroup = monoGroupKey(opts);
  const glideMs = transportClean ? 0 : clamp(opts?.glideMs ?? 0, 0, 480);
  const glideSec = glideMs / 1000;
  const useMono = opts?.monophonic !== false;
  const existingSession = monoLeadSessions.get(monoGroup);
  /**
   * Legato glide only — same voice, no second attack (monoPorta with a new osc stack was doubling).
   * Long release on sine presets keeps transport notes overlapping so glide can connect.
   */
  let legato =
    !transportClean &&
    !opts?.disableLegato &&
    useMono &&
    glideSec > 0.001 &&
    existingSession != null &&
    existingSession.releaseAt > t0 - 0.02;
  if (legato && existingSession) {
    const fromHz = Math.max(20, existingSession.oscs[0]!.node.frequency.value);
    const semitones = Math.abs(12 * Math.log2(hz / fromHz));
    if (semitones >= 12) legato = false;
  }
  const prevGroupHz = lastLeadHzByGroup.get(monoGroup);
  const glideFromHz = legato
    ? existingSession!.oscs[0]!.node.frequency.value
    : prevGroupHz != null && prevGroupHz > 20
      ? prevGroupHz
      : hz;
  const monoPortaNewVoice =
    !legato &&
    !transportClean &&
    glideSec > 0.001 &&
    prevGroupHz != null &&
    Math.abs(prevGroupHz - hz) > 0.25;

  const attack = preset.attackMs / 1000;
  const decay = preset.decayMs / 1000;
  let release = preset.releaseMs / 1000;
  if (transportClean) release = 0.06;
  else if (opts?.disableLegato) release = Math.min(release, 0.12);
  const hold = Math.max(
    0.04,
    transportClean
      ? Math.min(opts?.maxSustainSec ?? 0.14, sustainSec)
      : opts?.maxSustainSec != null
        ? Math.min(sustainSec, opts.maxSustainSec)
        : sustainSec,
  );
  const sustainLvl = peak * clamp(preset.sustain, 0, 1);
  const tDecayEnd = t0 + attack + decay;
  const tReleaseStart = t0 + hold;
  let tEnd = tReleaseStart + release + 0.05;

  const fStart = clamp(hz * preset.filterFreqMul, 180, 16000);
  const fBase = clamp(opts?.filterCutoffHz ?? fStart, 180, 16000);
  const fEnd = clamp(fBase * (1 - preset.filterEnvDepth * 0.85), 120, 14000);

  if (legato && existingSession) {
    tEnd = legatoRetargetMonoLead(
      existingSession,
      hz,
      t0,
      glideSec,
      sustainLvl,
      hold,
      release,
      fBase,
      fEnd,
    );
    lastLeadHzByGroup.set(monoGroup, hz);
    return;
  }

  if (useMono && !legato) {
    truncateGrooveLabLeadVoiceMonoGroup(t0, monoGroup);
    truncateGrooveLabGuitarLickMonoGroup(t0, monoGroup);
  } else if (useMono && legato) {
    truncateGrooveLabGuitarLickMonoGroup(t0, monoGroup);
  }

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  if (softSineLead) {
    /** One smooth rise — no attack bump + decay dip (reads as two notes). */
    out.gain.linearRampToValueAtTime(Math.max(sustainLvl, 0.0002), t0 + Math.max(0.012, attack));
  } else {
    const attackEnd = t0 + Math.max(0.002, attack * 0.7);
    out.gain.exponentialRampToValueAtTime(Math.max(peak * 1.2, 0.0002), attackEnd);
    out.gain.setTargetAtTime(Math.max(sustainLvl, 0.0002), tDecayEnd, decay * 0.35);
  }
  out.gain.setTargetAtTime(0.0001, tReleaseStart, release * 0.4);

  const lowCut = Math.max(20, Math.min(800, opts?.lowCutHz ?? 90));
  const highCut = Math.max(400, Math.min(18000, opts?.highCutHz ?? 8200));
  const lowHp = ctx.createBiquadFilter();
  lowHp.type = 'highpass';
  lowHp.frequency.setValueAtTime(lowCut, t0);
  lowHp.Q.value = 0.7;
  const filter = ctx.createBiquadFilter();
  filter.type = preset.wave === 'sine' ? 'lowpass' : preset.filterType;
  const stoppable: AudioScheduledSourceNode[] = [];
  const detuneTargets: AudioParam[] = [];
  const monoOscs: MonoLeadOsc[] = [];
  filter.frequency.setValueAtTime(fBase, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(80, fEnd), tDecayEnd);
  filter.Q.value = preset.filterQ;
  lowHp.connect(filter);
  // Wah is temporarily opt-in only while we stabilize Melody & Riffs core tone.
  const wahRate = extWahRateHz > 0 ? extWahRateHz : 0;
  const wahDepth = extWahAmount;

  const mkOsc = (type: OscillatorType, detune = 0): OscillatorNode => {
    const o = ctx.createOscillator();
    o.type = type;
    const portamento =
      glideSec > 0.001 &&
      Math.abs(glideFromHz - hz) > 0.25 &&
      (legato || monoPortaNewVoice);
    const startHz = portamento ? glideFromHz : hz;
    rampNoteFrequency(o.frequency, startHz, hz, t0, portamento ? glideSec : 0);
    o.detune.setValueAtTime(detune, t0);
    detuneTargets.push(o.detune);
    monoOscs.push({ node: o, detuneCents: detune });
    return o;
  };

  const osc1 = mkOsc(preset.wave);
  const osc1G = ctx.createGain();
  osc1G.gain.value = 1;
  osc1.connect(osc1G).connect(lowHp);
  stoppable.push(osc1);

  if (!transportClean && preset.wave2) {
    const osc2 = mkOsc(preset.wave2, preset.detuneCents ?? 0);
    const osc2G = ctx.createGain();
    osc2G.gain.value = clamp(preset.osc2Level ?? 0.3, 0, 1);
    osc2.connect(osc2G).connect(lowHp);
    stoppable.push(osc2);
  } else if (!transportClean && preset.detuneCents && preset.kind === 'synth') {
    const osc2 = mkOsc(preset.wave, preset.detuneCents);
    const osc2G = ctx.createGain();
    osc2G.gain.value = 0.55;
    osc2.connect(osc2G).connect(lowHp);
    stoppable.push(osc2);
    const osc3 = mkOsc(preset.wave, -preset.detuneCents);
    const osc3G = ctx.createGain();
    osc3G.gain.value = 0.55;
    osc3.connect(osc3G).connect(lowHp);
    stoppable.push(osc3);
  }

  if (!transportClean && (preset.clickLevel ?? 0) > 0.02) {
    const click = ctx.createOscillator();
    click.type = 'triangle';
    click.frequency.setValueAtTime(clamp(hz * 2.8, 200, 8000), t0);
    const clickG = ctx.createGain();
    clickG.gain.setValueAtTime(vel * (preset.clickLevel ?? 0.3), t0);
    clickG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.028);
    click.connect(clickG).connect(lowHp);
    stoppable.push(click);
  }

  const lfoRate = transportClean
    ? 0
    : Math.max(0, opts?.leadLfoRateHz ?? preset.lfoRateHz ?? 0);
  const lfoDepth = transportClean
    ? 0
    : Math.max(0, opts?.leadLfoDepthCents ?? preset.lfoDepthCents ?? 0);
  if (!transportClean && lfoRate > 0.01 && lfoDepth > 0.01 && detuneTargets.length > 0) {
    const vib = ctx.createOscillator();
    vib.type = 'sine';
    vib.frequency.setValueAtTime(clamp(lfoRate, 0.1, 8), t0);
    const vibGain = ctx.createGain();
    vibGain.gain.setValueAtTime(clamp(lfoDepth, 0, 45), t0);
    vib.connect(vibGain);
    for (const target of detuneTargets) vibGain.connect(target);
    vib.start(t0);
    vib.stop(tEnd);
    stoppable.push(vib);
  }

  let chain: AudioNode = filter;
  const driveAmt = Math.max(preset.drive ?? 0, extDrive + extDistortion * 1.2);
  if (driveAmt > 0.05) {
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    const k = 5 + driveAmt * 45;
    for (let i = 0; i < curve.length; i++) {
      const x = i / (curve.length - 1) * 2 - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    shaper.curve = curve;
    shaper.oversample = '4x';
    filter.connect(shaper);
    chain = shaper;
  }

  // Dedicated post wah stage (wet/dry) so the effect is clearly audible.
  if (wahRate > 0.01 && wahDepth > 0.01) {
    const wah = ctx.createBiquadFilter();
    wah.type = 'bandpass';
    // Keep resonance controlled as drive/distortion rises to avoid squeal.
    wah.Q.value = 2.4 + wahDepth * 5.8 - fxHeat * 2.1;
    const centerHz = clamp(700 + hz * 0.22, 420, 2100);
    const travelHz = 600 + 1800 * Math.max(0.08, Math.min(1, wahDepth)) * (1 - fxHeat * 0.35);
    wah.frequency.setValueAtTime(centerHz, t0);

    const lfo = ctx.createOscillator();
    lfo.type = 'triangle';
    lfo.frequency.setValueAtTime(clamp(wahRate, 0.2, 4.2), t0);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(travelHz, t0);
    lfo.connect(lfoGain).connect(wah.frequency);
    lfo.start(t0);
    lfo.stop(tEnd);
    stoppable.push(lfo);

    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const mix = Math.max(0, Math.min(1, wahDepth));
    dry.gain.setValueAtTime(1 - mix * 0.78, t0);
    wet.gain.setValueAtTime(0.28 + mix * 0.78, t0);

    chain.connect(dry);
    chain.connect(wah);
    wah.connect(wet);
    const sum = ctx.createGain();
    dry.connect(sum);
    wet.connect(sum);
    chain = sum;
  }

  // Safety tone stage prevents high-frequency whistle when wah + distortion stack.
  const toneGuard = ctx.createBiquadFilter();
  toneGuard.type = 'lowpass';
  toneGuard.frequency.setValueAtTime(Math.min(highCut, 9200 - fxHeat * 3600), t0);
  toneGuard.Q.value = 0.58;
  const outTrim = ctx.createGain();
  outTrim.gain.setValueAtTime(1 / (1 + fxHeat * 0.65), t0);
  chain.connect(toneGuard);
  const channelDest =
    opts?.outputNode && opts.outputNode.context === ctx
      ? opts.outputNode
      : resolveGrooveLabMelodyPlaybackDest(ctx);
  toneGuard.connect(outTrim).connect(out).connect(channelDest);

  for (const node of stoppable) {
    node.start(t0);
    node.stop(tEnd);
  }

  if (useMono && monoOscs.length > 0) {
    const session: MonoLeadSession = {
      oscs: monoOscs,
      filter,
      out,
      releaseAt: tEnd,
    };
    monoLeadSessions.set(monoGroup, session);
    registerMonoLeadStop(ctx, monoGroup, session, stoppable);
  }

  lastLeadHzByGroup.set(monoGroup, hz);
}
