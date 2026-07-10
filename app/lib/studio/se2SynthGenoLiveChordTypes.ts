/**
 * Synth Geno — Live Chord column (ChordPrism-style one-key play).
 * Chromatic trigger zone C3–B3 (MIDI 48–59); full voiced chords in comp register.
 */
import type { ChordMode, ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import type { GenoBarChordSpec, GenoExtension, GenoPerfMode } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import type { Se2SynthGenoPluginSoundSelection } from '@/app/lib/studio/se2SynthGenoSoundBank';

/** Fixed chromatic trigger octave — left-hand live zone (Option B). */
export const SE2_SYNTH_GENO_LIVE_ZONE_LO = 48;
export const SE2_SYNTH_GENO_LIVE_ZONE_HI = 59;
export const SE2_SYNTH_GENO_LIVE_ZONE_SIZE = SE2_SYNTH_GENO_LIVE_ZONE_HI - SE2_SYNTH_GENO_LIVE_ZONE_LO + 1;

/** Right-hand voicing display — matches live voiced output (C3–C5). */
export const SE2_SYNTH_GENO_LIVE_VOICING_LO = 48;
export const SE2_SYNTH_GENO_LIVE_VOICING_MID = 60;
export const SE2_SYNTH_GENO_LIVE_VOICING_HI = 71;

export type Se2SynthGenoLiveGenreId =
  | 'trap'
  | 'hip-hop'
  | 'rnb'
  | 'rnb-pop'
  | 'drill'
  | 'lofi'
  | 'neo-soul'
  | 'pop'
  | 'gospel'
  | 'afrobeats'
  | 'latin-trap'
  | 'house-dance'
  | 'jersey-bounce'
  | 'boom-bap'
  | 'plug-rage'
  | 'lofi-cinematic'
  | 'dark-cinematic'
  | 'jazz'
  | 'guitar-lines'
  | 'kpop';

export type Se2SynthGenoLivePreset = {
  id: string;
  genreId: Se2SynthGenoLiveGenreId;
  /** Feel-first label — no theory jargon in the primary name. */
  name: string;
  tag?: string;
  romans: ChordSymbol[];
  /** Unique progression steps before trigger-slot tiling (ChordPrism-style pad count). */
  loopLength: number;
  mode: ChordMode;
  chordSpecs: GenoBarChordSpec[];
  romanLine: string;
  stylePreset: GenoChordStyle;
  extensions: GenoExtension[];
  inversion: number;
  perfMode: GenoPerfMode;
  smartMatch: boolean;
  soundSelection: Se2SynthGenoPluginSoundSelection;
  /** Feel-matched tempo when authored on the preset card. */
  bpm?: number;
};

export type Se2SynthGenoLiveGenre = {
  id: Se2SynthGenoLiveGenreId;
  label: string;
  description: string;
  defaultMode: ChordMode;
};

export type Se2SynthGenoLiveKeySlot = {
  slotIndex: number;
  triggerMidi: number;
  triggerLabel: string;
  chordIndex: number;
  chordLabel: string;
  roman: ChordSymbol;
};
