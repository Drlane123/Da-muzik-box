/**
 * Chord Builder instrument bank — Web Audio synth voices used by BOTH the
 * live chord audition path (`playMidiSet` in `ChordBuilderTab.tsx`) AND the
 * offline WAV bouncer (`renderChordTimelineToWav` in `chordRender.ts`).
 *
 * Design constraints:
 *
 *   • Pure synthesis. No SoundFont / sample fetches — the entire bank is
 *     built from `OscillatorNode` + `GainNode` + `BiquadFilterNode` so it
 *     runs identically online and offline, in any environment, with no
 *     network or codec dependency.
 *   • One graph per note. Every `scheduleNote` call wires up a fresh chain
 *     of nodes, starts them, and schedules an end-stop time so the audio
 *     graph self-cleans. The returned envelope `GainNode`(s) let the caller
 *     ramp them to silence early if the user re-triggers (audition path
 *     uses this to avoid stuck notes when tapping pads in quick succession).
 *   • Cheap. A 5-note chord costs ~5–15 oscillators — easily within budget
 *     even for low-end laptops. We avoid `AudioWorklet`, convolution, and
 *     anything else that won't render reliably under `OfflineAudioContext`.
 *
 * Each voice is mono so the result composes cleanly with the existing pad
 * sampler signal chain (which already mixes pads through a per-channel
 * gain + pan). The peaks are tuned so that a 5-note voicing tops out
 * around −6 dBFS in the offline render, leaving headroom for the master
 * gain bus to attenuate or boost without instant clipping.
 *
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
 */

export type ChordInstrumentCategory =
  | 'Piano'
  | 'Keys'
  | 'Strings'
  | 'Pad'
  | 'Bass'
  | 'Pluck'
  | 'Bell'
  | 'Brass'
  | 'Lead';

export type ChordInstrumentId =
  | 'piano-grand'
  | 'piano-upright'
  | 'epiano-rhodes'
  | 'organ'
  | 'strings-warm'
  | 'strings-cinema'
  | 'pad-warm'
  | 'bass-sub'
  | 'bass-synth'
  | 'bass-pluck'
  | 'pluck-guitar'
  | 'bell'
  | 'brass'
  | 'synth-lead';

export interface ScheduleNoteArgs {
  /** AudioContext or OfflineAudioContext — voices only use the common API. */
  ctx: BaseAudioContext;
  /** Where the voice's envelope gain connects (e.g. master gain or `ctx.destination`). */
  destination: AudioNode;
  /** MIDI pitch (0..127). Middle C = 60. */
  midi: number;
  /** Audio-clock time (in seconds) at which the note should begin. */
  startTime: number;
  /** Caller-provided "how long the note is held" target. Sustained voices
   *  honor this directly; percussive voices let their natural decay run and
   *  use `sustainSec` only as an upper bound. */
  sustainSec: number;
  /** 0..1. Linearly scales each layer's peak gain. Defaults to 1. */
  velocity?: number;
}

export interface ChordInstrument {
  id: ChordInstrumentId;
  label: string;
  /** Short human-readable group used by the picker UI. */
  category: ChordInstrumentCategory;
  /** One-character glyph shown on the picker button (kept ASCII-safe-ish so
   *  it renders without a webfont). */
  glyph: string;
  /** One-line description for tooltips / aria-labels. */
  description: string;
  /** Wires + schedules a one-shot voice. Returns the envelope GainNode(s)
   *  so the caller can cancel them early for live re-triggers. */
  scheduleNote(args: ScheduleNoteArgs): GainNode[];
}

/** A4 = 440 Hz reference; standard MIDI-to-frequency conversion. */
function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Schedule a percussive envelope: linear attack to peak, then exponential
 *  decay to silence over `decaySec`. Used by pianos, plucks, bells, etc.
 *  The gain node returned starts at near-zero (1e-4 so the exp ramp is valid)
 *  and is fully silent + nudged with a tiny linear ramp at the end so the
 *  audio graph never carries a phantom value forward. */
function applyPercussiveEnv(
  gain: GainNode,
  startTime: number,
  peak: number,
  attackSec: number,
  decaySec: number,
): void {
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + attackSec);
  // exponentialRampToValueAtTime requires a positive target — 0.0001 ≈ -80 dB,
  // inaudible — and we then nudge to true zero with a short linear tail.
  gain.gain.exponentialRampToValueAtTime(peak * 0.0008, startTime + attackSec + decaySec);
  gain.gain.linearRampToValueAtTime(0, startTime + attackSec + decaySec + 0.02);
}

/** Schedule a sustained envelope: attack to peak, optional decay to a hold
 *  level, hold through `sustainSec`, then linear release to zero. Used by
 *  organs, strings, pads, basses (sub/synth), brass, leads. */
function applySustainedEnv(
  gain: GainNode,
  startTime: number,
  peak: number,
  attackSec: number,
  sustainSec: number,
  releaseSec: number,
  holdLevel: number = 1,
): void {
  // The "active" length we drive at the hold level — sustained sound only
  // lasts as long as the caller asked us to hold (e.g. one bar at 120 BPM).
  const effectiveSustain = Math.max(attackSec + 0.05, sustainSec * 0.95);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + attackSec);
  if (holdLevel < 1) {
    gain.gain.linearRampToValueAtTime(peak * holdLevel, startTime + attackSec + Math.min(0.15, sustainSec * 0.2));
    gain.gain.setValueAtTime(peak * holdLevel, startTime + effectiveSustain);
  } else {
    gain.gain.setValueAtTime(peak, startTime + effectiveSustain);
  }
  gain.gain.linearRampToValueAtTime(0, startTime + effectiveSustain + releaseSec);
}

/** Connect-and-start helper that records the oscillator's stop time so we
 *  don't accumulate dead nodes in long sessions. */
function startStop(
  osc: OscillatorNode,
  startTime: number,
  endTime: number,
): void {
  osc.start(startTime);
  osc.stop(endTime + 0.05);
}

// ──────────────────────────────────────────────────────────────────────
// Piano family
// ──────────────────────────────────────────────────────────────────────

/** Grand Piano — triangle body + sine 2nd-harmonic warmth + soft lowpass.
 *  The exponential decay is long (~2 s) so single hits ring out, but the
 *  caller-provided `sustainSec` still caps it so chord transitions feel
 *  clean. */
function pianoGrandVoice(args: ScheduleNoteArgs): GainNode[] {
  const { ctx, destination, midi, startTime, sustainSec } = args;
  const velocity = args.velocity ?? 1;
  const fund = midiToFreq(midi);
  const peak = 0.13 * velocity;
  const decaySec = Math.min(2.2, Math.max(0.7, sustainSec));

  const env = ctx.createGain();
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 4200;
  lpf.Q.value = 0.4;
  env.connect(lpf).connect(destination);
  applyPercussiveEnv(env, startTime, peak, 0.008, decaySec);
  const stopAt = startTime + 0.008 + decaySec + 0.05;

  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.value = fund;
  body.connect(env);
  startStop(body, startTime, stopAt);

  const second = ctx.createOscillator();
  const secondGain = ctx.createGain();
  second.type = 'sine';
  second.frequency.value = fund * 2;
  secondGain.gain.value = 0.32;
  second.connect(secondGain).connect(env);
  startStop(second, startTime, stopAt);

  return [env];
}

/** Upright Piano — brighter, faster decay, slight 5th-partial sparkle so
 *  it cuts through a mix differently from the grand. */
function pianoUprightVoice(args: ScheduleNoteArgs): GainNode[] {
  const { ctx, destination, midi, startTime, sustainSec } = args;
  const velocity = args.velocity ?? 1;
  const fund = midiToFreq(midi);
  const peak = 0.12 * velocity;
  const decaySec = Math.min(1.6, Math.max(0.6, sustainSec));

  const env = ctx.createGain();
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 5400;
  env.connect(lpf).connect(destination);
  applyPercussiveEnv(env, startTime, peak, 0.006, decaySec);
  const stopAt = startTime + 0.006 + decaySec + 0.05;

  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.value = fund;
  body.connect(env);
  startStop(body, startTime, stopAt);

  const sparkle = ctx.createOscillator();
  const sparkleGain = ctx.createGain();
  sparkle.type = 'sine';
  sparkle.frequency.value = fund * 5;
  sparkleGain.gain.value = 0.05;
  sparkle.connect(sparkleGain).connect(env);
  startStop(sparkle, startTime, startTime + 0.35);

  return [env];
}

/** Electric Piano (Rhodes-style) — sine fundamental + bell harmonic that
 *  decays much faster than the body. That short, percussive "bonk" at the
 *  attack is the defining timbre. */
function epianoRhodesVoice(args: ScheduleNoteArgs): GainNode[] {
  const { ctx, destination, midi, startTime, sustainSec } = args;
  const velocity = args.velocity ?? 1;
  const fund = midiToFreq(midi);
  const peakBody = 0.10 * velocity;
  const peakBell = 0.045 * velocity;
  const decaySec = Math.min(2.0, Math.max(0.6, sustainSec));

  const bodyEnv = ctx.createGain();
  bodyEnv.connect(destination);
  applyPercussiveEnv(bodyEnv, startTime, peakBody, 0.003, decaySec);
  const stopBody = startTime + 0.003 + decaySec + 0.05;

  const body = ctx.createOscillator();
  body.type = 'sine';
  body.frequency.value = fund;
  body.connect(bodyEnv);
  startStop(body, startTime, stopBody);

  const bellEnv = ctx.createGain();
  bellEnv.connect(destination);
  applyPercussiveEnv(bellEnv, startTime, peakBell, 0.001, 0.18);
  const bell = ctx.createOscillator();
  bell.type = 'sine';
  bell.frequency.value = fund * 7;
  bell.connect(bellEnv);
  startStop(bell, startTime, startTime + 0.22);

  return [bodyEnv, bellEnv];
}

// ──────────────────────────────────────────────────────────────────────
// Keys (organ)
// ──────────────────────────────────────────────────────────────────────

/** Organ — Hammond-style drawbar feel: fundamental + octave + perfect
 *  fifth-above-octave, all sustained at full peak. No decay — the whole
 *  note holds its volume until release. */
function organVoice(args: ScheduleNoteArgs): GainNode[] {
  const { ctx, destination, midi, startTime, sustainSec } = args;
  const velocity = args.velocity ?? 1;
  const fund = midiToFreq(midi);
  const peak = 0.09 * velocity;

  const env = ctx.createGain();
  env.connect(destination);
  applySustainedEnv(env, startTime, peak, 0.02, sustainSec, 0.08);
  const stopAt = startTime + Math.max(sustainSec, 0.1) + 0.12;

  // Drawbar partials — 1×, 2×, 3× (octave + fifth).
  const partials: { mult: number; gain: number }[] = [
    { mult: 1, gain: 1.0 },
    { mult: 2, gain: 0.55 },
    { mult: 3, gain: 0.30 },
  ];
  for (const p of partials) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = fund * p.mult;
    g.gain.value = p.gain;
    osc.connect(g).connect(env);
    startStop(osc, startTime, stopAt);
  }
  return [env];
}

// ──────────────────────────────────────────────────────────────────────
// Strings & pad family
// ──────────────────────────────────────────────────────────────────────

/** Warm Strings — three sawtooth voices detuned by ±7 cents, low-pass
 *  filtered, with a slow attack and a subtle vibrato LFO. Classic supersaw
 *  ensemble feel without the brightness. */
function stringsWarmVoice(args: ScheduleNoteArgs): GainNode[] {
  const { ctx, destination, midi, startTime, sustainSec } = args;
  const velocity = args.velocity ?? 1;
  const fund = midiToFreq(midi);
  const peak = 0.08 * velocity;

  const env = ctx.createGain();
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 2400;
  lpf.Q.value = 0.6;
  env.connect(lpf).connect(destination);
  applySustainedEnv(env, startTime, peak, 0.26, sustainSec, 0.35);
  const stopAt = startTime + Math.max(sustainSec, 0.3) + 0.4;

  // Three detuned sawtooths for ensemble width.
  const detunes = [-7, 0, 7];
  for (const cents of detunes) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = fund;
    osc.detune.value = cents;
    osc.connect(env);
    startStop(osc, startTime, stopAt);
  }

  // Vibrato LFO — small modulation of master gain. Cents of frequency
  // modulation isn't supported on OscillatorNode.detune from an LFO without
  // a connection chain, but gain wobble achieves a similar perceptual effect.
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 4.8;
  lfoGain.gain.value = 0.006;
  lfo.connect(lfoGain).connect(env.gain);
  startStop(lfo, startTime, stopAt);

  return [env];
}

/** Cinema Strings — four-voice ensemble with very slow attack (700 ms) and
 *  a filter sweep that opens the lowpass during the attack. Better for held
 *  pads / film-score chords than fast progressions. */
function stringsCinemaVoice(args: ScheduleNoteArgs): GainNode[] {
  const { ctx, destination, midi, startTime, sustainSec } = args;
  const velocity = args.velocity ?? 1;
  const fund = midiToFreq(midi);
  const peak = 0.07 * velocity;

  const env = ctx.createGain();
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(900, startTime);
  lpf.frequency.linearRampToValueAtTime(3200, startTime + 0.7);
  lpf.Q.value = 0.5;
  env.connect(lpf).connect(destination);
  applySustainedEnv(env, startTime, peak, 0.7, sustainSec, 0.55);
  const stopAt = startTime + Math.max(sustainSec, 0.5) + 0.6;

  const detunes = [-12, -5, 5, 12];
  for (const cents of detunes) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = fund;
    osc.detune.value = cents;
    osc.connect(env);
    startStop(osc, startTime, stopAt);
  }
  return [env];
}

/** Warm Pad — two sawtooths plus a sub-octave sine, slow attack, dark
 *  lowpass. The sub gives chords body without muddying the midrange. */
function padWarmVoice(args: ScheduleNoteArgs): GainNode[] {
  const { ctx, destination, midi, startTime, sustainSec } = args;
  const velocity = args.velocity ?? 1;
  const fund = midiToFreq(midi);
  const peak = 0.085 * velocity;

  const env = ctx.createGain();
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 1800;
  lpf.Q.value = 0.45;
  env.connect(lpf).connect(destination);
  applySustainedEnv(env, startTime, peak, 0.4, sustainSec, 0.5);
  const stopAt = startTime + Math.max(sustainSec, 0.4) + 0.5;

  // Two detuned saws for chorus width.
  const saws = [-9, 9];
  for (const cents of saws) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = fund;
    osc.detune.value = cents;
    osc.connect(env);
    startStop(osc, startTime, stopAt);
  }
  // Sub octave sine for body.
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = 'sine';
  sub.frequency.value = fund * 0.5;
  subGain.gain.value = 0.5;
  sub.connect(subGain).connect(env);
  startStop(sub, startTime, stopAt);

  return [env];
}

// ──────────────────────────────────────────────────────────────────────
// Bass family
// ──────────────────────────────────────────────────────────────────────

/** Sub Bass — clean sine fundamental, light lowpass, sustained. Drops the
 *  played pitch by one octave so a chord voicing in C4..G4 yields a usable
 *  C3-range sub line rather than a midrange tone. */
function bassSubVoice(args: ScheduleNoteArgs): GainNode[] {
  const { ctx, destination, midi, startTime, sustainSec } = args;
  const velocity = args.velocity ?? 1;
  const fund = midiToFreq(Math.max(0, midi - 12));
  const peak = 0.16 * velocity;

  const env = ctx.createGain();
  env.connect(destination);
  applySustainedEnv(env, startTime, peak, 0.012, sustainSec, 0.1);
  const stopAt = startTime + Math.max(sustainSec, 0.2) + 0.15;

  const sine = ctx.createOscillator();
  sine.type = 'sine';
  sine.frequency.value = fund;
  sine.connect(env);
  startStop(sine, startTime, stopAt);

  // Tiny 2nd-harmonic to keep the bass visible on small speakers.
  const harm = ctx.createOscillator();
  const harmGain = ctx.createGain();
  harm.type = 'sine';
  harm.frequency.value = fund * 2;
  harmGain.gain.value = 0.06;
  harm.connect(harmGain).connect(env);
  startStop(harm, startTime, stopAt);
  return [env];
}

/** Synth Bass — sawtooth through a filter envelope (cutoff opens on attack,
 *  settles to a mid value). Dropped one octave for a usable bass register. */
function bassSynthVoice(args: ScheduleNoteArgs): GainNode[] {
  const { ctx, destination, midi, startTime, sustainSec } = args;
  const velocity = args.velocity ?? 1;
  const fund = midiToFreq(Math.max(0, midi - 12));
  const peak = 0.12 * velocity;

  const env = ctx.createGain();
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(200, startTime);
  lpf.frequency.linearRampToValueAtTime(900, startTime + 0.05);
  lpf.frequency.linearRampToValueAtTime(550, startTime + 0.18);
  lpf.Q.value = 2.0;
  env.connect(lpf).connect(destination);
  applySustainedEnv(env, startTime, peak, 0.008, sustainSec, 0.09);
  const stopAt = startTime + Math.max(sustainSec, 0.2) + 0.12;

  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.value = fund;
  saw.connect(env);
  startStop(saw, startTime, stopAt);
  return [env];
}

/** Pluck Bass — short triangle with a fast exponential decay. Reads as a
 *  finger-plucked bass guitar regardless of the chord-bar length. */
function bassPluckVoice(args: ScheduleNoteArgs): GainNode[] {
  const { ctx, destination, midi, startTime } = args;
  const velocity = args.velocity ?? 1;
  const fund = midiToFreq(Math.max(0, midi - 12));
  const peak = 0.16 * velocity;

  const env = ctx.createGain();
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 1400;
  env.connect(lpf).connect(destination);
  applyPercussiveEnv(env, startTime, peak, 0.005, 0.42);
  const stopAt = startTime + 0.005 + 0.42 + 0.05;

  const tri = ctx.createOscillator();
  tri.type = 'triangle';
  tri.frequency.value = fund;
  tri.connect(env);
  startStop(tri, startTime, stopAt);
  return [env];
}

// ──────────────────────────────────────────────────────────────────────
// Pluck / bell
// ──────────────────────────────────────────────────────────────────────

/** Pluck (Guitar-ish) — square through a lowpass that drops during the
 *  decay, simulating the natural high-frequency damping of a real plucked
 *  string. */
function pluckGuitarVoice(args: ScheduleNoteArgs): GainNode[] {
  const { ctx, destination, midi, startTime } = args;
  const velocity = args.velocity ?? 1;
  const fund = midiToFreq(midi);
  const peak = 0.10 * velocity;

  const env = ctx.createGain();
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(1800, startTime);
  lpf.frequency.exponentialRampToValueAtTime(700, startTime + 0.4);
  lpf.Q.value = 0.8;
  env.connect(lpf).connect(destination);
  applyPercussiveEnv(env, startTime, peak, 0.003, 0.6);
  const stopAt = startTime + 0.003 + 0.6 + 0.05;

  const sq = ctx.createOscillator();
  sq.type = 'square';
  sq.frequency.value = fund;
  sq.connect(env);
  startStop(sq, startTime, stopAt);
  return [env];
}

/** Bell — sine fundamental + two high inharmonic partials (3.5×, 7×),
 *  each with its own decay. The inharmonic ratios are what make it sound
 *  like a metallic bell rather than a piano. */
function bellVoice(args: ScheduleNoteArgs): GainNode[] {
  const { ctx, destination, midi, startTime } = args;
  const velocity = args.velocity ?? 1;
  const fund = midiToFreq(midi);

  // Partial 1 — fundamental, long decay.
  const env1 = ctx.createGain();
  env1.connect(destination);
  applyPercussiveEnv(env1, startTime, 0.08 * velocity, 0.003, 2.0);
  const stop1 = startTime + 2.05;
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = fund;
  o1.connect(env1);
  startStop(o1, startTime, stop1);

  // Partial 2 — inharmonic 3.5×, medium decay.
  const env2 = ctx.createGain();
  env2.connect(destination);
  applyPercussiveEnv(env2, startTime, 0.04 * velocity, 0.002, 0.9);
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = fund * 3.5;
  o2.connect(env2);
  startStop(o2, startTime, startTime + 0.95);

  // Partial 3 — sparkle, short decay.
  const env3 = ctx.createGain();
  env3.connect(destination);
  applyPercussiveEnv(env3, startTime, 0.02 * velocity, 0.001, 0.35);
  const o3 = ctx.createOscillator();
  o3.type = 'sine';
  o3.frequency.value = fund * 7;
  o3.connect(env3);
  startStop(o3, startTime, startTime + 0.4);

  return [env1, env2, env3];
}

// ──────────────────────────────────────────────────────────────────────
// Brass / lead
// ──────────────────────────────────────────────────────────────────────

/** Brass — sawtooth with a filter sweep that opens during the 40 ms attack
 *  and settles to a bright but warm cutoff. Sustained for the full bar. */
function brassVoice(args: ScheduleNoteArgs): GainNode[] {
  const { ctx, destination, midi, startTime, sustainSec } = args;
  const velocity = args.velocity ?? 1;
  const fund = midiToFreq(midi);
  const peak = 0.085 * velocity;

  const env = ctx.createGain();
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(450, startTime);
  lpf.frequency.linearRampToValueAtTime(2400, startTime + 0.06);
  lpf.frequency.linearRampToValueAtTime(1700, startTime + 0.25);
  lpf.Q.value = 1.2;
  env.connect(lpf).connect(destination);
  applySustainedEnv(env, startTime, peak, 0.04, sustainSec, 0.2);
  const stopAt = startTime + Math.max(sustainSec, 0.3) + 0.25;

  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.value = fund;
  saw.connect(env);
  startStop(saw, startTime, stopAt);

  // Slight detuned second saw for ensemble feel.
  const saw2 = ctx.createOscillator();
  const saw2Gain = ctx.createGain();
  saw2.type = 'sawtooth';
  saw2.frequency.value = fund;
  saw2.detune.value = 5;
  saw2Gain.gain.value = 0.55;
  saw2.connect(saw2Gain).connect(env);
  startStop(saw2, startTime, stopAt);
  return [env];
}

/** Synth Lead — two detuned sawtooths through a mid-bright lowpass with a
 *  fast attack. The detune adds chorus / width so single-note lines feel
 *  rich without sounding like a pad. */
function synthLeadVoice(args: ScheduleNoteArgs): GainNode[] {
  const { ctx, destination, midi, startTime, sustainSec } = args;
  const velocity = args.velocity ?? 1;
  const fund = midiToFreq(midi);
  const peak = 0.09 * velocity;

  const env = ctx.createGain();
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 4000;
  lpf.Q.value = 0.8;
  env.connect(lpf).connect(destination);
  applySustainedEnv(env, startTime, peak, 0.01, sustainSec, 0.08);
  const stopAt = startTime + Math.max(sustainSec, 0.2) + 0.12;

  for (const cents of [-15, 15]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = fund;
    osc.detune.value = cents;
    osc.connect(env);
    startStop(osc, startTime, stopAt);
  }
  return [env];
}

// ──────────────────────────────────────────────────────────────────────
// Public registry
// ──────────────────────────────────────────────────────────────────────

export const CHORD_INSTRUMENTS: readonly ChordInstrument[] = [
  { id: 'piano-grand',    label: 'Grand Piano',    category: 'Piano',   glyph: '♟', description: 'Full, ringing grand piano — the default chord voice.', scheduleNote: pianoGrandVoice },
  { id: 'piano-upright',  label: 'Upright Piano',  category: 'Piano',   glyph: '♟', description: 'Brighter, tighter upright — cuts through a busy mix.',  scheduleNote: pianoUprightVoice },
  { id: 'epiano-rhodes',  label: 'Electric Piano', category: 'Keys',    glyph: '♬', description: 'Rhodes-style EP with the classic bell-tine attack.',    scheduleNote: epianoRhodesVoice },
  { id: 'organ',          label: 'Drawbar Organ',  category: 'Keys',    glyph: '♬', description: 'Hammond-flavored drawbar organ — held, no decay.',      scheduleNote: organVoice },
  { id: 'strings-warm',   label: 'Warm Strings',   category: 'Strings', glyph: '♪', description: 'Three-voice string ensemble with subtle vibrato.',      scheduleNote: stringsWarmVoice },
  { id: 'strings-cinema', label: 'Cinema Strings', category: 'Strings', glyph: '♪', description: 'Four-voice film-score strings with a slow filter sweep.', scheduleNote: stringsCinemaVoice },
  { id: 'pad-warm',       label: 'Warm Pad',       category: 'Pad',     glyph: '☁', description: 'Lush synth pad with sub-octave body.',                  scheduleNote: padWarmVoice },
  { id: 'bass-sub',       label: 'Sub Bass',       category: 'Bass',    glyph: '◣', description: 'Pure sine sub bass, dropped one octave from the chord.', scheduleNote: bassSubVoice },
  { id: 'bass-synth',     label: 'Synth Bass',     category: 'Bass',    glyph: '◣', description: 'Saw bass with filter envelope — funky and resonant.',  scheduleNote: bassSynthVoice },
  { id: 'bass-pluck',     label: 'Pluck Bass',     category: 'Bass',    glyph: '◣', description: 'Quick-decay triangle bass — finger-pluck feel.',        scheduleNote: bassPluckVoice },
  { id: 'pluck-guitar',   label: 'Pluck',          category: 'Pluck',   glyph: '♩', description: 'Filtered square pluck — guitar / harp-ish strum.',     scheduleNote: pluckGuitarVoice },
  { id: 'bell',           label: 'Bell',           category: 'Bell',    glyph: '♫', description: 'Inharmonic bell — long fundamental, short sparkle.',   scheduleNote: bellVoice },
  { id: 'brass',          label: 'Brass',          category: 'Brass',   glyph: '♭', description: 'Saw brass with a snappy filter attack.',               scheduleNote: brassVoice },
  { id: 'synth-lead',     label: 'Synth Lead',     category: 'Lead',    glyph: '♯', description: 'Detuned-saw lead — bright, sustained, lots of width.', scheduleNote: synthLeadVoice },
];

/** Lookup map for O(1) access by id. Built once at module load. */
const INSTRUMENT_BY_ID: Record<ChordInstrumentId, ChordInstrument> = (() => {
  const map = Object.create(null) as Record<ChordInstrumentId, ChordInstrument>;
  for (const inst of CHORD_INSTRUMENTS) map[inst.id] = inst;
  return map;
})();

/** Resolve an instrument id to a voice, falling back to the grand piano if
 *  the id is unknown (defensive — covers stale `localStorage` values). */
export function getChordInstrument(id: ChordInstrumentId | string | null | undefined): ChordInstrument {
  if (id && id in INSTRUMENT_BY_ID) return INSTRUMENT_BY_ID[id as ChordInstrumentId];
  return INSTRUMENT_BY_ID['piano-grand'];
}

export const DEFAULT_CHORD_INSTRUMENT_ID: ChordInstrumentId = 'piano-grand';
