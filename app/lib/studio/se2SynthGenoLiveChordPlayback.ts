/**
 * Live Chord one-shot playback — Rip Chord / Chord Prism block polyphony.
 * One trigger key → every voiced MIDI note fires together (unless strum mode).
 */
import {
  genoAccordGmInstrument,
  haltGenoAccordPreviewNotes,
  clearGenoAccordPassQueue,
  primeGenoAccordPreviewBus,
  scheduleGenoAccordSoundfontChord,
  warmupGenoAccordSoundfont,
} from '@/app/lib/studio/se2SynthGenoAccordSoundfont';
import { haltSe2LiveChordGlideSession, playSe2LiveChordGlide } from '@/app/lib/studio/se2SynthGenoLiveChordGlide';
import { se2SynthGenoSoundBankVoice } from '@/app/lib/studio/se2SynthGenoSoundBank';

export type Se2LiveChordPlaybackMode = 'block' | 'strum';

export type Se2SynthGenoLiveChordPlayOpts = {
  chordGlide?: boolean;
  genreId?: string;
  /** block = all notes together (Rip Chord / Chord Prism default). strum = light spread. */
  mode?: Se2LiveChordPlaybackMode;
  durationSec?: number;
  sessionKey?: string;
  /** Progression pad — always soundfont block; skip bus teardown between hits. */
  padTrigger?: boolean;
};

function uniqueSortedTones(tones: readonly number[]): number[] {
  return [...new Set(tones.map((p) => Math.round(p)))].sort((a, b) => a - b);
}

/** Chill (drill id) — instant pad attack; avoid tearing down the accord cache between hits. */
function isChillLiveGenre(genreId?: string): boolean {
  return genreId === 'drill';
}

const LIVE_CHORD_ATTACK_FLOOR_SEC = 0.012;
const LIVE_CHORD_CHILL_ATTACK_FLOOR_SEC = 0.002;

/** Play a full voiced chord through the accord soundfont (block polyphony). */
export async function playSe2SynthGenoLiveChordBlock(opts: {
  ctx: AudioContext;
  dest: AudioNode;
  tones: readonly number[];
  accordBankId: string;
  playOpts?: Se2SynthGenoLiveChordPlayOpts;
}): Promise<void> {
  const uniqueTones = uniqueSortedTones(opts.tones);
  if (uniqueTones.length === 0) return;

  const sessionKey = opts.playOpts?.sessionKey ?? 'se2-live-chord';
  const ctx = opts.ctx;
  const padTrigger = opts.playOpts?.padTrigger === true;

  if (opts.playOpts?.chordGlide && !padTrigger) {
    clearGenoAccordPassQueue(ctx);
    playSe2LiveChordGlide(ctx, opts.dest, sessionKey, uniqueTones, {
      enabled: true,
      glideSec: opts.playOpts.genreId === 'jazz' ? 0.28 : 0.22,
      durationSec: opts.playOpts.durationSec ?? 2.8,
    });
    return;
  }

  haltSe2LiveChordGlideSession(sessionKey, ctx);
  const chill = padTrigger || isChillLiveGenre(opts.playOpts?.genreId);
  if (chill) {
    clearGenoAccordPassQueue(ctx);
  } else {
    haltGenoAccordPreviewNotes(ctx);
  }

  const voice = se2SynthGenoSoundBankVoice('accord', opts.accordBankId);
  const instrumentId = voice.gmInstrumentId ?? genoAccordGmInstrument(opts.accordBankId);
  const warm = warmupGenoAccordSoundfont(ctx, opts.dest, [instrumentId]);
  if (chill) {
    void warm;
  } else {
    await warm;
  }

  primeGenoAccordPreviewBus(ctx);
  const floor = chill ? LIVE_CHORD_CHILL_ATTACK_FLOOR_SEC : LIVE_CHORD_ATTACK_FLOOR_SEC;
  const t0 = ctx.currentTime + floor;
  const durationSec = opts.playOpts?.durationSec ?? 2.6;
  const mode = opts.playOpts?.mode ?? 'block';

  if (mode === 'strum') {
    const step = 0.012;
    uniqueTones.forEach((pitch, i) => {
      scheduleGenoAccordSoundfontChord(ctx, opts.dest, t0 + i * step, durationSec, [pitch], 88 - i, instrumentId);
    });
    return;
  }

  scheduleGenoAccordSoundfontChord(ctx, opts.dest, t0, durationSec, uniqueTones, 88, instrumentId);
}
