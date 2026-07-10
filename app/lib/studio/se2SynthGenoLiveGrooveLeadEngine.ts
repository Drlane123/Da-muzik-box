/**
 * Geno Build 1 & 2 — Chord-Follower Groove Lead (R&B soft flute / velvet sine).
 * Every lead pitch is derived from live chord-track MIDI — no independent melody.
 */
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import type { GenoHarmony } from '@/app/lib/studio/se2SynthGenoChordEngine';
import { chordFollowerGenerateLead } from '@/app/lib/studio/se2ChordFollowerLeadEngine';

/** Geno B01 groove lead — matches waveLeafMelodyStyles `rnb-sine` (Sine Glide). */
export const GENO_B01_GROOVE_LEAD_STYLE_ID = 'rnb-sine';

/** Geno B01 — Wave Leads PRO–style soul lead (velvet sine + long glide). */
export const GENO_B01_GROOVE_LEAD_PRESET_ID = 'velvet-lead' as const;

/**
 * Chord-Follower lead — scans chord MIDI, anchors on voiced tones, stepwise voice-leading.
 */
export function genoGenerateLiveGrooveLeadFromHarmony(opts: {
  harmony: GenoHarmony;
  chordNotes: readonly StudioEditor2GenNote[];
  barCount: number;
  beatsPerBar: number;
  seed: number;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  movement?: number;
  bpm?: number;
}): StudioEditor2GenNote[] {
  void opts.harmony;
  if (opts.chordNotes.length === 0) return [];

  return chordFollowerGenerateLead({
    chordNotes: opts.chordNotes,
    barCount: opts.barCount,
    beatsPerBar: opts.beatsPerBar,
    seed: opts.seed,
    keyRoot: opts.keyRoot,
    keyMode: opts.keyMode,
    movement: opts.movement,
    bpm: opts.bpm,
    harmony: opts.harmony,
  });
}
