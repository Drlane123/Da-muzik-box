/** Shared harmony types for melody + sub engines (avoids import cycles). */
export type GrooveComposerColumn = {
  slot: number;
  rootMidi: number;
  tones: number[];
};

export type GrooveComposerHarmony = {
  columns: GrooveComposerColumn[];
};
