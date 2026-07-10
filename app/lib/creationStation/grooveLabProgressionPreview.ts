/**
 * Audition chord progressions with Orchid chord voice only (no 808 / bass bank).
 */

import { parseChordSymbolToken } from '@/app/lib/creationStation/chordProgressionParse';
import { GROOVE_LAB_CHORD_MIX_GAIN } from '@/app/lib/creationStation/grooveLabLayers';
import { grooveLabClampBassRootMidi, grooveLabLiftChordsAboveBass, grooveLabClampChordRollMidi } from '@/app/lib/creationStation/grooveLabPitch';
import {
  scheduleOrchidChord,
  type OrchidPerformanceMode,
} from '@/app/lib/creationStation/orchidChordEngine';
import type { ChordVoiceId } from '@/app/lib/creationStation/chordSequencerVoices';
import { CHORD_VOICE_MAP } from '@/app/lib/creationStation/chordSequencerVoices';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';

export type ProgressionAuditionOpts = {
  bpm: number;
  chordVoice: ChordVoiceId;
  perfMode: OrchidPerformanceMode;
  /** 0–1; defaults to full Orchid mix level for previews. */
  volume?: number;
  /** When set, snap genres (reggae / afro / garage) use shorter staccato holds — no long ring. */
  genreId?: string;
};

/** How much of each step length the chord rings (lower = drier / less “reverb wash”). */
function progressionAuditionSustainRatio(genreId?: string): number {
  if (!genreId) return 0.92;
  if (genreId === 'reggae' || genreId === 'afrobeat' || genreId === 'uk-garage' || genreId === 'trap') {
    return 0.36;
  }
  if (genreId === 'funk' || genreId === 'hiphop') return 0.48;
  if (genreId === 'house' || genreId === 'disco' || genreId === 'dance') return 0.68;
  if (genreId === 'rnb' || genreId === 'rnb-90s' || genreId === 'rnb-true' || genreId === 'ballad-80s') {
    return 0.88;
  }
  return 0.75;
}

function auditionSustainSec(stepBeats: number, secPerBeat: number, genreId?: string): number {
  const ratio = progressionAuditionSustainRatio(genreId);
  const raw = stepBeats * secPerBeat * ratio;
  if (genreId === 'reggae' || genreId === 'afrobeat' || genreId === 'uk-garage' || genreId === 'trap') {
    return Math.min(0.38, Math.max(0.12, raw));
  }
  return Math.max(0.2, raw);
}

export function chordMidisForStepLabel(label: string): number[] | null {
  const parsed = parseChordSymbolToken(label);
  if (!parsed) return null;
  const bassRef = grooveLabClampBassRootMidi(Math.min(...parsed.notes));
  const lifted = grooveLabLiftChordsAboveBass(bassRef, parsed.notes);
  return lifted.map((m) => grooveLabClampChordRollMidi(m, bassRef));
}

export function progressionTotalBeats(steps: readonly GrooveProgressionStep[]): number {
  return steps.reduce((sum, s) => sum + Math.max(0.25, s.beats), 0);
}

/** Which step (bar) is active for a given elapsed beat position in the progression. */
export function stepIndexAtElapsedBeats(
  steps: readonly GrooveProgressionStep[],
  elapsedBeats: number,
): number {
  if (steps.length === 0) return 0;
  let acc = 0;
  for (let i = 0; i < steps.length; i++) {
    const b = Math.max(0.25, steps[i]!.beats);
    if (elapsedBeats < acc + b) return i;
    acc += b;
  }
  return steps.length - 1;
}

export function scheduleProgressionAudition(
  ctx: AudioContext,
  steps: readonly GrooveProgressionStep[],
  startTime: number,
  opts: ProgressionAuditionOpts,
): number {
  const secPerBeat = 60 / Math.max(40, opts.bpm);
  const vol = (opts.volume ?? 0.88) * GROOVE_LAB_CHORD_MIX_GAIN;
  let beat = 0;
  for (const step of steps) {
    if (step.rest || !step.label.trim()) {
      beat += Math.max(0.25, step.beats);
      continue;
    }
    const midis = chordMidisForStepLabel(step.label);
    if (midis?.length) {
      const when = startTime + beat * secPerBeat;
      const sustainSec = auditionSustainSec(step.beats, secPerBeat, opts.genreId);
      scheduleOrchidChord(ctx, midis, when, sustainSec, opts.chordVoice, vol, {
        mode: opts.perfMode,
        bpm: opts.bpm,
      });
    }
    beat += Math.max(0.25, step.beats);
  }
  return beat * secPerBeat;
}

export function scheduleSingleStepAudition(
  ctx: AudioContext,
  step: GrooveProgressionStep,
  startTime: number,
  opts: ProgressionAuditionOpts,
): void {
  const midis = chordMidisForStepLabel(step.label);
  if (!midis?.length) return;
  const secPerBeat = 60 / Math.max(40, opts.bpm);
  const sustainSec = auditionSustainSec(step.beats, secPerBeat, opts.genreId);
  const vol = (opts.volume ?? 0.9) * GROOVE_LAB_CHORD_MIX_GAIN;
  scheduleOrchidChord(ctx, midis, startTime, sustainSec, opts.chordVoice, vol, {
    mode: opts.perfMode,
    bpm: opts.bpm,
  });
}

export function orchidVoiceAuditionLabel(voice: ChordVoiceId): string {
  return CHORD_VOICE_MAP[voice]?.short ?? voice;
}
