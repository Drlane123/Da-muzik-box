/**
 * SE2 Chord Generator card audition — plays through the track Instrument dropdown
 * (same engines as SE2 piano-roll / transport), not the Orchid Grand-only path.
 */
import { resolveGrooveLabAudioDest } from '@/app/lib/creationStation/grooveLabAudio';
import { chordMidisForStepLabel } from '@/app/lib/creationStation/grooveLabProgressionPreview';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { getOrchestraHitDef } from '@/app/lib/creationStation/grooveLabOrchestraHitBank';
import {
  scheduleOrchidChord,
  type OrchidPerformanceMode,
} from '@/app/lib/creationStation/orchidChordEngine';
import { haltProgressionAuditionVoices } from '@/app/lib/creationStation/chordSequencerVoices';
import { MIXER_UNITY_VOL } from '@/app/lib/studio/se2MixerFaderScale';
import {
  haltStudioEditor2MidiInstrumentNotes,
  scheduleStudioEditor2MidiInstrumentNote,
  warmupStudioEditor2MidiInstrument,
} from '@/app/lib/studio/studioEditor2MidiInstrumentPlayback';
import {
  studioParseGrooveLeadInstrumentId,
  studioParseOrchestraHitInstrumentId,
  studioPlayGrooveLeadOnPreviewBus,
  studioPlayOrchestraHitOnPreviewBus,
  studioPreloadOrchestraHitInstrument,
} from '@/app/lib/studio/studioInstrumentHarmony';

/** Synthetic lane so synth-preset audition does not collide with real track lanes. */
export function se2ChordGeneratorAuditionTrackIndex(trackId: string | undefined): number {
  if (!trackId) return 1900;
  let h = 0;
  for (let i = 0; i < trackId.length; i++) h = (h * 31 + trackId.charCodeAt(i)) | 0;
  return 1900 + (Math.abs(h) % 800);
}

export type Se2ChordGeneratorAuditionOpts = {
  bpm: number;
  instrumentId: string | undefined;
  trackIndex: number;
  /** 0–1 */
  volume?: number;
  genreId?: string;
  perfMode?: OrchidPerformanceMode;
};

function auditionSustainSec(stepBeats: number, secPerBeat: number, genreId?: string): number {
  let ratio = 0.75;
  if (!genreId) ratio = 0.92;
  else if (genreId === 'reggae' || genreId === 'afrobeat' || genreId === 'uk-garage' || genreId === 'trap') {
    ratio = 0.36;
  } else if (genreId === 'funk' || genreId === 'hiphop') ratio = 0.48;
  else if (genreId === 'house' || genreId === 'disco' || genreId === 'dance') ratio = 0.68;
  else if (
    genreId === 'rnb' ||
    genreId === 'rnb-90s' ||
    genreId === 'rnb-true' ||
    genreId === 'ballad-80s'
  ) {
    ratio = 0.88;
  }
  const raw = stepBeats * secPerBeat * ratio;
  if (genreId === 'reggae' || genreId === 'afrobeat' || genreId === 'uk-garage' || genreId === 'trap') {
    return Math.min(0.38, Math.max(0.12, raw));
  }
  return Math.max(0.2, raw);
}

function createAuditionBus(ctx: AudioContext, volume: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = Math.max(0.05, Math.min(1.2, volume));
  g.connect(resolveGrooveLabAudioDest(ctx));
  return g;
}

/** Fire one chord voicing through the track Instrument (GM / synth / 808 / orch / lead). */
export function scheduleSe2ChordGeneratorChord(
  ctx: AudioContext,
  midis: readonly number[],
  when: number,
  sustainSec: number,
  opts: Se2ChordGeneratorAuditionOpts,
  bus?: GainNode,
): void {
  if (!midis.length) return;
  const vol = opts.volume ?? 0.82;
  const velocity = Math.max(1, Math.min(127, Math.round(96 * vol)));
  const velocity01 = velocity / 127;
  const strip = bus ?? createAuditionBus(ctx, vol);
  const leadId = studioParseGrooveLeadInstrumentId(opts.instrumentId);
  const orchHitId = studioParseOrchestraHitInstrumentId(opts.instrumentId);
  const orchDef = orchHitId ? getOrchestraHitDef(orchHitId) : undefined;
  const holdBeats = Math.max(0.25, sustainSec * (opts.bpm / 60));

  if (leadId) {
    for (const midi of midis) {
      studioPlayGrooveLeadOnPreviewBus(
        ctx,
        strip,
        leadId,
        when,
        midi,
        velocity01,
        64,
        false,
        MIXER_UNITY_VOL,
        opts.bpm,
        holdBeats,
      );
    }
    return;
  }

  if (orchDef) {
    void studioPreloadOrchestraHitInstrument(ctx, opts.instrumentId);
    for (const midi of midis) {
      studioPlayOrchestraHitOnPreviewBus(
        ctx,
        strip,
        orchDef,
        when,
        midi,
        velocity01,
        64,
        false,
        MIXER_UNITY_VOL,
      );
    }
    return;
  }

  let handled = false;
  for (const midi of midis) {
    if (
      scheduleStudioEditor2MidiInstrumentNote({
        ctx,
        stripIn: strip,
        trackIndex: opts.trackIndex,
        instrumentId: opts.instrumentId,
        midi,
        velocity,
        when,
        durationSec: sustainSec,
        bpm: opts.bpm,
        allowLateLoad: true,
      })
    ) {
      handled = true;
    }
  }
  if (handled) return;

  /** Drums / unknown — keep a musical fallback so cards are never silent. */
  scheduleOrchidChord(ctx, [...midis], when, sustainSec, 'grand', vol, {
    mode: opts.perfMode ?? 'block',
    bpm: opts.bpm,
  });
}

export function scheduleSe2ChordGeneratorProgression(
  ctx: AudioContext,
  steps: readonly GrooveProgressionStep[],
  startTime: number,
  opts: Se2ChordGeneratorAuditionOpts,
): number {
  const secPerBeat = 60 / Math.max(40, opts.bpm);
  const bus = createAuditionBus(ctx, opts.volume ?? 0.82);
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
      scheduleSe2ChordGeneratorChord(ctx, midis, when, sustainSec, opts, bus);
    }
    beat += Math.max(0.25, step.beats);
  }
  return beat * secPerBeat;
}

export function scheduleSe2ChordGeneratorStep(
  ctx: AudioContext,
  step: GrooveProgressionStep,
  startTime: number,
  opts: Se2ChordGeneratorAuditionOpts,
): void {
  const midis = chordMidisForStepLabel(step.label);
  if (!midis?.length) return;
  const secPerBeat = 60 / Math.max(40, opts.bpm);
  const sustainSec = auditionSustainSec(step.beats, secPerBeat, opts.genreId);
  scheduleSe2ChordGeneratorChord(ctx, midis, startTime, sustainSec, opts);
}

export function haltSe2ChordGeneratorAudition(): void {
  haltStudioEditor2MidiInstrumentNotes();
  haltProgressionAuditionVoices();
}

export function warmupSe2ChordGeneratorInstrument(
  ctx: AudioContext,
  instrumentId: string | undefined,
): void {
  void warmupStudioEditor2MidiInstrument(ctx, instrumentId, resolveGrooveLabAudioDest(ctx));
  void studioPreloadOrchestraHitInstrument(ctx, instrumentId);
}
