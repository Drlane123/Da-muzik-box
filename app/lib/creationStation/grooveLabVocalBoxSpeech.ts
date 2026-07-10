/**
 * VocalBox speech engine — FL Studio Speech Synthesizer pattern:
 * text → phonemes → glottal/formant modulator + vocoder carrier @ MIDI pitch.
 */
import {
  scheduleVocalBoxVocoderCarrier,
  vocalBoxBlendBandProfiles,
  vocalBoxPhonemeBandProfile,
} from '@/app/lib/creationStation/grooveLabVocalBoxVocoder';

export type VocalBoxSpeechMode = 'normal' | 'breathy' | 'whisper';
export type VocalBoxSpeechStyle = 'sing' | 'monotone';
export type VocalBoxPersonality =
  | 'robot'
  | 'neutral'
  | 'bright'
  | 'zapp'
  | 'transform'
  | 'talkbox'
  | 'cyber'
  | 'warm';

export type VocalPhonemeKind = 'vowel' | 'stop' | 'fricative' | 'nasal' | 'liquid';

export type VocalPhonemeDef = {
  code: string;
  kind: VocalPhonemeKind;
  weight: number;
  f1?: number;
  f2?: number;
  f3?: number;
  noiseHz?: number;
  noiseQ?: number;
  gap?: number;
};

const PHONEME: Record<string, VocalPhonemeDef> = {
  AA: { code: 'AA', kind: 'vowel', weight: 1, f1: 730, f2: 1090, f3: 2440 },
  AE: { code: 'AE', kind: 'vowel', weight: 1, f1: 660, f2: 1720, f3: 2410 },
  AH: { code: 'AH', kind: 'vowel', weight: 1, f1: 640, f2: 1190, f3: 2390 },
  EH: { code: 'EH', kind: 'vowel', weight: 1, f1: 530, f2: 1840, f3: 2480 },
  IH: { code: 'IH', kind: 'vowel', weight: 1, f1: 390, f2: 1990, f3: 2550 },
  IY: { code: 'IY', kind: 'vowel', weight: 1, f1: 270, f2: 2290, f3: 3010 },
  OW: { code: 'OW', kind: 'vowel', weight: 1, f1: 570, f2: 840, f3: 2410 },
  UW: { code: 'UW', kind: 'vowel', weight: 1, f1: 300, f2: 870, f3: 2240 },
  UH: { code: 'UH', kind: 'vowel', weight: 1, f1: 440, f2: 1020, f3: 2240 },
  EY: { code: 'EY', kind: 'vowel', weight: 1, f1: 530, f2: 1840, f3: 2480 },
  ER: { code: 'ER', kind: 'vowel', weight: 1, f1: 490, f2: 1350, f3: 1690 },
  AR: { code: 'AR', kind: 'vowel', weight: 1, f1: 660, f2: 1200, f3: 2400 },
  AW: { code: 'AW', kind: 'vowel', weight: 1, f1: 640, f2: 900, f3: 2400 },
  OY: { code: 'OY', kind: 'vowel', weight: 1, f1: 570, f2: 840, f3: 2410 },
  B: { code: 'B', kind: 'stop', weight: 0.14, noiseHz: 600, noiseQ: 2, gap: 0.02 },
  P: { code: 'P', kind: 'stop', weight: 0.14, noiseHz: 500, noiseQ: 2, gap: 0.025 },
  D: { code: 'D', kind: 'stop', weight: 0.14, noiseHz: 1800, noiseQ: 3, gap: 0.02 },
  T: { code: 'T', kind: 'stop', weight: 0.14, noiseHz: 4500, noiseQ: 4, gap: 0.025 },
  G: { code: 'G', kind: 'stop', weight: 0.14, noiseHz: 2200, noiseQ: 3, gap: 0.02 },
  K: { code: 'K', kind: 'stop', weight: 0.14, noiseHz: 3200, noiseQ: 4, gap: 0.025 },
  F: { code: 'F', kind: 'fricative', weight: 0.22, noiseHz: 4000, noiseQ: 5 },
  V: { code: 'V', kind: 'fricative', weight: 0.22, noiseHz: 2800, noiseQ: 4 },
  S: { code: 'S', kind: 'fricative', weight: 0.22, noiseHz: 6500, noiseQ: 6 },
  Z: { code: 'Z', kind: 'fricative', weight: 0.22, noiseHz: 5500, noiseQ: 5 },
  SH: { code: 'SH', kind: 'fricative', weight: 0.24, noiseHz: 3200, noiseQ: 6 },
  CH: { code: 'CH', kind: 'fricative', weight: 0.24, noiseHz: 3800, noiseQ: 6 },
  TH: { code: 'TH', kind: 'fricative', weight: 0.2, noiseHz: 5200, noiseQ: 7 },
  HH: { code: 'HH', kind: 'fricative', weight: 0.16, noiseHz: 3000, noiseQ: 3 },
  M: { code: 'M', kind: 'nasal', weight: 0.28, f1: 280, f2: 2200, f3: 2800 },
  N: { code: 'N', kind: 'nasal', weight: 0.28, f1: 280, f2: 1700, f3: 2600 },
  NG: { code: 'NG', kind: 'nasal', weight: 0.28, f1: 280, f2: 1900, f3: 2600 },
  L: { code: 'L', kind: 'liquid', weight: 0.3, f1: 350, f2: 1200, f3: 2400 },
  R: { code: 'R', kind: 'liquid', weight: 0.3, f1: 400, f2: 1200, f3: 1600 },
  W: { code: 'W', kind: 'liquid', weight: 0.28, f1: 300, f2: 610, f3: 2200 },
  Y: { code: 'Y', kind: 'liquid', weight: 0.26, f1: 270, f2: 2290, f3: 3010 },
  JH: { code: 'JH', kind: 'fricative', weight: 0.2, noiseHz: 3400, noiseQ: 5 },
};

const WORD_PHONEMES: Record<string, string[]> = {
  love: ['L', 'AH', 'V'],
  want: ['W', 'AA', 'N', 'T'],
  make: ['M', 'EY', 'K'],
  to: ['T', 'UW'],
  i: ['AY'],
  you: ['Y', 'UW'],
  me: ['M', 'IY'],
  baby: ['B', 'EY', 'B', 'IY'],
  yeah: ['Y', 'AE'],
  hey: ['HH', 'EY'],
  oh: ['OW'],
  la: ['L', 'AA'],
  do: ['D', 'UW'],
  go: ['G', 'OW'],
  world: ['W', 'ER', 'L', 'D'],
  girl: ['G', 'ER', 'L'],
  boy: ['B', 'OY'],
  heart: ['HH', 'AA', 'R', 'T'],
  night: ['N', 'AY', 'T'],
  feel: ['F', 'IY', 'L'],
  real: ['R', 'IY', 'L'],
};

const DIGRAPHS: Record<string, string> = {
  sh: 'SH', ch: 'CH', th: 'TH', ng: 'NG', oo: 'UW', ee: 'IY', ay: 'EY',
  ow: 'OW', ar: 'AR', er: 'ER', or: 'OR', ai: 'EY', ou: 'AW', oy: 'OY', ph: 'F', ck: 'K',
};

const CHAR: Record<string, string> = {
  a: 'AE', b: 'B', c: 'K', d: 'D', e: 'EH', f: 'F', g: 'G', h: 'HH', i: 'IH', j: 'JH',
  k: 'K', l: 'L', m: 'M', n: 'N', o: 'OW', p: 'P', q: 'K', r: 'R', s: 'S', t: 'T',
  u: 'UH', v: 'V', w: 'W', x: 'KS', y: 'IY', z: 'Z',
};

const glottalWaveCache = new WeakMap<AudioContext, PeriodicWave>();

function glottalPeriodicWave(ctx: AudioContext): PeriodicWave {
  let w = glottalWaveCache.get(ctx);
  if (w) return w;
  const n = 4096;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    const phase = i / n;
    if (phase < 0.12) imag[i] = 0.55 * Math.sin((phase / 0.12) * Math.PI);
    else if (phase < 0.38) imag[i] = 0.42 * Math.cos(((phase - 0.12) / 0.26) * Math.PI * 0.5);
    else imag[i] = 0;
  }
  w = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  glottalWaveCache.set(ctx, w);
  return w;
}

function codesToPhonemes(codes: string[]): VocalPhonemeDef[] {
  const out: VocalPhonemeDef[] = [];
  for (const code of codes) {
    if (code === 'KS') {
      if (PHONEME.K) out.push(PHONEME.K);
      if (PHONEME.S) out.push(PHONEME.S);
      continue;
    }
    if (code === 'OR') {
      if (PHONEME.OW) out.push(PHONEME.OW);
      if (PHONEME.R) out.push(PHONEME.R);
      continue;
    }
    const def = PHONEME[code];
    if (def) out.push(def);
  }
  return out;
}

export function vocalBoxTokenToPhonemes(token: string): VocalPhonemeDef[] {
  const raw = token.trim().toLowerCase().replace(/[^a-z'-]/g, '');
  if (!raw) return [PHONEME.AH!];
  const dict = WORD_PHONEMES[raw];
  if (dict) return codesToPhonemes(dict);
  const codes: string[] = [];
  let i = 0;
  while (i < raw.length) {
    const dig = raw.slice(i, i + 2);
    if (DIGRAPHS[dig]) { codes.push(DIGRAPHS[dig]!); i += 2; continue; }
    const ch = raw[i]!;
    if (ch === "'") { i += 1; continue; }
    codes.push(CHAR[ch] ?? 'AH');
    i += 1;
  }
  const expanded = codesToPhonemes(codes);
  return expanded.length > 0 ? expanded : [PHONEME.AH!];
}

function makeNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
  return buf;
}

function connectFormantVoice(
  ctx: AudioContext,
  dest: AudioNode,
  f0: number,
  when: number,
  dur: number,
  vel: number,
  f1: number,
  f2: number,
  f3: number,
  opts: { mode: VocalBoxSpeechMode; style: VocalBoxSpeechStyle; personality: VocalBoxPersonality; robot: number },
): () => void {
  const t0 = when;
  const t1 = when + dur;
  const whisper = opts.mode === 'whisper';
  const breathy = opts.mode === 'breathy';

  const source = ctx.createOscillator();
  if (whisper) {
    source.type = 'triangle';
    source.frequency.setValueAtTime(Math.max(80, f0 * 0.5), t0);
  } else {
    source.setPeriodicWave(glottalPeriodicWave(ctx));
    source.frequency.setValueAtTime(Math.max(50, f0), t0);
  }

  if (opts.style === 'sing' && !whisper) {
    const vib = ctx.createOscillator();
    const vibG = ctx.createGain();
    vib.frequency.value = 5.4;
    vibG.gain.value = 6 + opts.robot * 10;
    vib.connect(vibG);
    vibG.connect(source.frequency);
    vib.start(t0);
    vib.stop(t1 + 0.03);
  }

  const bus = ctx.createGain();
  bus.gain.value = (whisper ? 0.14 : 0.4) * vel;

  if (whisper || breathy) {
    const asp = ctx.createBufferSource();
    asp.buffer = makeNoiseBuffer(ctx, dur + 0.03);
    const aspF = ctx.createBiquadFilter();
    aspF.type = 'highpass';
    aspF.frequency.value = 900;
    const aspG = ctx.createGain();
    aspG.gain.value = vel * (whisper ? 0.55 : 0.22);
    asp.connect(aspF);
    aspF.connect(aspG);
    aspG.connect(bus);
    asp.start(t0);
    asp.stop(t1 + 0.02);
  }

  for (const band of [
    { f: f1, g: 1 },
    { f: f2, g: 0.58 },
    { f: f3, g: 0.32 },
  ]) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = band.f;
    bp.Q.value = whisper ? 2.5 : 4 + opts.robot * 9;
    const g = ctx.createGain();
    g.gain.value = band.g;
    source.connect(bp);
    bp.connect(g);
    g.connect(bus);
  }

  const env = ctx.createGain();
  bus.connect(env);
  env.connect(dest);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(1, t0 + 0.018);
  env.gain.setValueAtTime(1, Math.max(t0 + 0.018, t1 - 0.04));
  env.gain.exponentialRampToValueAtTime(0.0001, t1);
  source.start(t0);
  source.stop(t1 + 0.02);
  return () => { try { source.stop(); } catch { /* */ } };
}

function connectNoiseVoice(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  dur: number,
  vel: number,
  hz: number,
  q: number,
  f0: number,
): () => void {
  const t0 = when;
  const t1 = when + dur;
  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBuffer(ctx, dur + 0.02);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = hz;
  bp.Q.value = q;
  const pitch = ctx.createOscillator();
  pitch.type = 'triangle';
  pitch.frequency.value = Math.max(50, f0);
  const pitchG = ctx.createGain();
  pitchG.gain.value = 0.09 * vel;
  const env = ctx.createGain();
  env.gain.value = 0.22 * vel;
  noise.connect(bp);
  bp.connect(env);
  pitch.connect(pitchG);
  pitchG.connect(env);
  env.connect(dest);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(1, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t1);
  noise.start(t0);
  noise.stop(t1 + 0.02);
  pitch.start(t0);
  pitch.stop(t1 + 0.02);
  return () => { try { noise.stop(); pitch.stop(); } catch { /* */ } };
}

export type VocalBoxSpeechLayerOpts = {
  robotMix: number;
  autotuneStrength: number;
  mode: VocalBoxSpeechMode;
  style: VocalBoxSpeechStyle;
  personality: VocalBoxPersonality;
  /** Offline render — formants only, no synth vocoder carrier. */
  speechOnly?: boolean;
};

export function scheduleVocalBoxSpokenToken(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  durationSec: number,
  pitchHz: number,
  vel: number,
  token: string,
  opts: VocalBoxSpeechLayerOpts,
): () => void {
  const phonemes = vocalBoxTokenToPhonemes(token);
  const dur = Math.max(0.08, durationSec);
  const robot = Math.max(0, Math.min(1, opts.robotMix));
  const tune = Math.max(0, Math.min(1, opts.autotuneStrength));
  const speechOnly = opts.speechOnly === true;
  const bandProfile = vocalBoxBlendBandProfiles(phonemes.map((p) => vocalBoxPhonemeBandProfile(p.code)));
  const weightSum = phonemes.reduce((s, p) => s + p.weight, 0);
  let cursor = when;
  const stoppers: Array<() => void> = [];

  if (!speechOnly) {
    stoppers.push(
      scheduleVocalBoxVocoderCarrier(ctx, dest, when, dur, pitchHz, vel, bandProfile, robot * 0.85 + 0.15),
    );
  }

  for (const ph of phonemes) {
    const segDur = (ph.weight / Math.max(1e-9, weightSum)) * dur * 0.94;
    if (ph.kind === 'vowel' || ph.kind === 'nasal' || ph.kind === 'liquid') {
      stoppers.push(
        connectFormantVoice(ctx, dest, pitchHz, cursor, segDur, vel, ph.f1 ?? 500, ph.f2 ?? 1500, ph.f3 ?? 2500, {
          mode: opts.mode,
          style: opts.style,
          personality: opts.personality,
          robot,
        }),
      );
    } else {
      stoppers.push(
        connectNoiseVoice(ctx, dest, cursor, segDur, vel, ph.noiseHz ?? 3000, ph.noiseQ ?? 4, pitchHz),
      );
      if (ph.gap && ph.gap > 0) cursor += ph.gap * (1 - tune * 0.5);
    }
    cursor += segDur;
  }
  return () => { for (const fn of stoppers) fn(); };
}

export function vocalBoxSpeakTextWithBrowserTts(text: string, rate = 0.92): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  const line = text.trim();
  if (!line) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(line);
  u.rate = Math.max(0.5, Math.min(1.4, rate));
  window.speechSynthesis.speak(u);
  return true;
}
