/** Studio Editor 2 — Synth Geno voice (SE2-native synth builder). */

export type Se2SynthGenoOscWave = 'sine' | 'saw' | 'square' | 'triangle';
export type Se2SynthGenoFilterType = 'lowpass' | 'bandpass' | 'highpass';
export type Se2SynthGenoRole =
  | 'lead'
  | 'pad'
  | 'bass'
  | 'pluck'
  | 'keys'
  | 'brass'
  | 'bell'
  | 'fx';

export type Se2SynthGenoVoiceParams = {
  role: Se2SynthGenoRole;
  /** Human label from generator (e.g. "Shimmer Pad"). */
  label: string;
  osc1Wave: Se2SynthGenoOscWave;
  osc1Level: number;
  osc2Wave: Se2SynthGenoOscWave;
  osc2Level: number;
  subLevel: number;
  noiseLevel: number;
  unisonVoices: number;
  unisonDetuneCents: number;
  filterType: Se2SynthGenoFilterType;
  filterCutoffHz: number;
  filterResonanceQ: number;
  filterDrive: number;
  ampAttackMs: number;
  ampDecayMs: number;
  ampSustain: number;
  ampReleaseMs: number;
  chorusMix: number;
  delayMix: number;
  reverbMix: number;
  distortion: number;
  outputLevel: number;
  /** MusyngKite GM instrument — accord/chords use samples instead of oscillator synth. */
  gmInstrumentId?: string;
};

export type Se2SynthGenoGenerateResult = {
  voice: Se2SynthGenoVoiceParams;
  /** Tags the parser matched from the prompt. */
  matchedTags: string[];
  /** Prompt used (may differ from input after random). */
  promptUsed: string;
};
