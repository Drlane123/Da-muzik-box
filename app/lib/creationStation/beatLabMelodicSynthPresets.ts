/**
 * Beat Lab CH 17-32 synth preset bank scaffold (bass-first).
 * This is engine-agnostic state that UI and scheduler can consume.
 */

export type BeatLabBassSynthPreset = {
  id: string;
  name: string;
  category: 'sub' | '808' | 'reese' | 'pluck-bass' | 'acid' | 'distorted';
  osc1Wave: 'sine' | 'saw' | 'square' | 'triangle';
  osc1Level: number;
  osc2Wave: 'sine' | 'saw' | 'square' | 'triangle';
  osc2Level: number;
  subLevel: number;
  noiseLevel: number;
  unisonVoices: number;
  unisonDetuneCents: number;
  filterType: 'lowpass' | 'bandpass' | 'highpass';
  filterCutoffHz: number;
  filterResonanceQ: number;
  filterDrive: number;
  ampAttackMs: number;
  ampDecayMs: number;
  ampSustain: number;
  ampReleaseMs: number;
  glideMs: number;
  /** If true, glide time follows a note-division clock (e.g. 1/16) at current BPM. */
  glideSync?: boolean;
  glideDivision?: '1/32' | '1/16' | '1/8' | '1/4';
  /**
   * mono = slide every new note; legato = overlap only;
   * chord = first note each bar slides from prior bar’s chord root (needs chord rail).
   */
  glideMode: 'off' | 'mono' | 'legato' | 'chord';
  distortion: number;
  compressor: number;
  eqLowDb: number;
  eqMidDb: number;
  eqHighDb: number;
};

export const BEAT_LAB_BASS_SYNTH_PRESETS: readonly BeatLabBassSynthPreset[] = [
  {
    id: 'sub-clean-round',
    name: 'Sub Clean Round',
    category: 'sub',
    osc1Wave: 'sine',
    osc1Level: 0.92,
    osc2Wave: 'triangle',
    osc2Level: 0.08,
    subLevel: 0.65,
    noiseLevel: 0,
    unisonVoices: 1,
    unisonDetuneCents: 0,
    filterType: 'lowpass',
    filterCutoffHz: 180,
    filterResonanceQ: 0.6,
    filterDrive: 0.08,
    ampAttackMs: 2,
    ampDecayMs: 120,
    ampSustain: 0.84,
    ampReleaseMs: 140,
    glideMs: 30,
    glideMode: 'mono',
    distortion: 0.06,
    compressor: 0.16,
    eqLowDb: 2.5,
    eqMidDb: -1.2,
    eqHighDb: -2,
  },
  {
    id: '808-deep-tail',
    name: '808 Deep Tail',
    category: '808',
    osc1Wave: 'sine',
    osc1Level: 1,
    osc2Wave: 'sine',
    osc2Level: 0,
    subLevel: 0.55,
    noiseLevel: 0,
    unisonVoices: 1,
    unisonDetuneCents: 0,
    filterType: 'lowpass',
    filterCutoffHz: 150,
    filterResonanceQ: 0.4,
    filterDrive: 0.2,
    ampAttackMs: 0,
    ampDecayMs: 520,
    ampSustain: 0.7,
    ampReleaseMs: 280,
    glideMs: 85,
    glideMode: 'mono',
    distortion: 0.28,
    compressor: 0.34,
    eqLowDb: 4.2,
    eqMidDb: -2.4,
    eqHighDb: -3.2,
  },
  {
    id: 'reese-wide-grit',
    name: 'Reese Wide Grit',
    category: 'reese',
    osc1Wave: 'saw',
    osc1Level: 0.78,
    osc2Wave: 'saw',
    osc2Level: 0.72,
    subLevel: 0.26,
    noiseLevel: 0.03,
    unisonVoices: 4,
    unisonDetuneCents: 12,
    filterType: 'lowpass',
    filterCutoffHz: 420,
    filterResonanceQ: 1.2,
    filterDrive: 0.38,
    ampAttackMs: 8,
    ampDecayMs: 180,
    ampSustain: 0.72,
    ampReleaseMs: 190,
    glideMs: 45,
    glideMode: 'mono',
    distortion: 0.41,
    compressor: 0.3,
    eqLowDb: 1.6,
    eqMidDb: 1.8,
    eqHighDb: -1.2,
  },
  {
    id: 'pluck-short-nz',
    name: 'Pluck Short Nz',
    category: 'pluck-bass',
    osc1Wave: 'triangle',
    osc1Level: 0.88,
    osc2Wave: 'square',
    osc2Level: 0.22,
    subLevel: 0.18,
    noiseLevel: 0.06,
    unisonVoices: 1,
    unisonDetuneCents: 0,
    filterType: 'lowpass',
    filterCutoffHz: 520,
    filterResonanceQ: 1.4,
    filterDrive: 0.22,
    ampAttackMs: 0,
    ampDecayMs: 95,
    ampSustain: 0.08,
    ampReleaseMs: 110,
    glideMs: 12,
    glideMode: 'mono',
    distortion: 0.14,
    compressor: 0.42,
    eqLowDb: 0.8,
    eqMidDb: 1.2,
    eqHighDb: -2.8,
  },
  {
    id: 'acid-squelch',
    name: 'Acid Squelch',
    category: 'acid',
    osc1Wave: 'saw',
    osc1Level: 0.82,
    osc2Wave: 'square',
    osc2Level: 0.35,
    subLevel: 0.12,
    noiseLevel: 0.02,
    unisonVoices: 1,
    unisonDetuneCents: 0,
    filterType: 'lowpass',
    filterCutoffHz: 380,
    filterResonanceQ: 8.5,
    filterDrive: 0.52,
    ampAttackMs: 1,
    ampDecayMs: 140,
    ampSustain: 0.35,
    ampReleaseMs: 120,
    glideMs: 55,
    glideMode: 'legato',
    distortion: 0.36,
    compressor: 0.38,
    eqLowDb: 1.4,
    eqMidDb: 3.2,
    eqHighDb: -3.5,
  },
  {
    id: 'dist-hype-fuzz',
    name: 'Dist Hype Fuzz',
    category: 'distorted',
    osc1Wave: 'square',
    osc1Level: 0.7,
    osc2Wave: 'saw',
    osc2Level: 0.65,
    subLevel: 0.34,
    noiseLevel: 0.05,
    unisonVoices: 2,
    unisonDetuneCents: 8,
    filterType: 'lowpass',
    filterCutoffHz: 640,
    filterResonanceQ: 2.1,
    filterDrive: 0.72,
    ampAttackMs: 2,
    ampDecayMs: 200,
    ampSustain: 0.78,
    ampReleaseMs: 160,
    glideMs: 20,
    glideMode: 'mono',
    distortion: 0.78,
    compressor: 0.55,
    eqLowDb: 3.8,
    eqMidDb: 2.4,
    eqHighDb: -4.2,
  },
  {
    id: 'dub-sub-wobble',
    name: 'Dub Sub Wobble',
    category: 'sub',
    osc1Wave: 'sine',
    osc1Level: 0.95,
    osc2Wave: 'triangle',
    osc2Level: 0.15,
    subLevel: 0.72,
    noiseLevel: 0,
    unisonVoices: 1,
    unisonDetuneCents: 0,
    filterType: 'lowpass',
    filterCutoffHz: 120,
    filterResonanceQ: 1.8,
    filterDrive: 0.18,
    ampAttackMs: 8,
    ampDecayMs: 280,
    ampSustain: 0.88,
    ampReleaseMs: 220,
    glideMs: 120,
    glideMode: 'legato',
    distortion: 0.18,
    compressor: 0.28,
    eqLowDb: 5.2,
    eqMidDb: -2.8,
    eqHighDb: -4.5,
  },
  {
    id: 'funk-slap-bass',
    name: 'Funk Slap Bass',
    category: 'pluck-bass',
    osc1Wave: 'triangle',
    osc1Level: 0.76,
    osc2Wave: 'saw',
    osc2Level: 0.48,
    subLevel: 0.22,
    noiseLevel: 0.04,
    unisonVoices: 1,
    unisonDetuneCents: 0,
    filterType: 'bandpass',
    filterCutoffHz: 720,
    filterResonanceQ: 2.8,
    filterDrive: 0.32,
    ampAttackMs: 0,
    ampDecayMs: 160,
    ampSustain: 0.22,
    ampReleaseMs: 130,
    glideMs: 28,
    glideMode: 'mono',
    distortion: 0.22,
    compressor: 0.48,
    eqLowDb: 1.2,
    eqMidDb: 2.8,
    eqHighDb: 0.6,
  },
  {
    id: 'neuro-reese-stab',
    name: 'Neuro Reese Stab',
    category: 'reese',
    osc1Wave: 'saw',
    osc1Level: 0.82,
    osc2Wave: 'saw',
    osc2Level: 0.8,
    subLevel: 0.2,
    noiseLevel: 0.04,
    unisonVoices: 5,
    unisonDetuneCents: 18,
    filterType: 'bandpass',
    filterCutoffHz: 480,
    filterResonanceQ: 3.6,
    filterDrive: 0.48,
    ampAttackMs: 1,
    ampDecayMs: 220,
    ampSustain: 0.55,
    ampReleaseMs: 170,
    glideMs: 40,
    glideMode: 'mono',
    distortion: 0.52,
    compressor: 0.36,
    eqLowDb: 2.2,
    eqMidDb: 1.6,
    eqHighDb: -2.2,
  },
  {
    id: 'trap-808-slide',
    name: 'Trap 808 Slide',
    category: '808',
    osc1Wave: 'sine',
    osc1Level: 1,
    osc2Wave: 'sine',
    osc2Level: 0,
    subLevel: 0.62,
    noiseLevel: 0,
    unisonVoices: 1,
    unisonDetuneCents: 0,
    filterType: 'lowpass',
    filterCutoffHz: 130,
    filterResonanceQ: 0.55,
    filterDrive: 0.24,
    ampAttackMs: 0,
    ampDecayMs: 680,
    ampSustain: 0.62,
    ampReleaseMs: 320,
    glideMs: 160,
    glideMode: 'legato',
    distortion: 0.32,
    compressor: 0.4,
    eqLowDb: 5.8,
    eqMidDb: -3.2,
    eqHighDb: -3.8,
  },
] as const;

export const BEAT_LAB_DEFAULT_SYNTH_PRESET_ID = BEAT_LAB_BASS_SYNTH_PRESETS[0]!.id;

const PRESET_ID_SET = new Set(BEAT_LAB_BASS_SYNTH_PRESETS.map((p) => p.id));

export function normalizeBeatLabMelodicSynthPresetIds(raw: unknown): string[] {
  const out = Array.from({ length: 16 }, () => BEAT_LAB_DEFAULT_SYNTH_PRESET_ID);
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < 16; i += 1) {
    const v = raw[i];
    if (typeof v === 'string' && PRESET_ID_SET.has(v)) out[i] = v;
  }
  return out;
}

export function beatLabBassSynthPresetById(id: string): BeatLabBassSynthPreset {
  return (
    BEAT_LAB_BASS_SYNTH_PRESETS.find((p) => p.id === id) ??
    BEAT_LAB_BASS_SYNTH_PRESETS[0]!
  );
}
