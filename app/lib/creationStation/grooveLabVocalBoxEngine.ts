/**
 * Groove Lab VocalBox — typed lyrics → computer speech → auto-tune + vocoder @ melody notes.
 * Tempo-locked via {@link grooveLabSecPerSlot} (same clock as Groove Lab transport).
 */
import { cbPianoMidiToNoteName } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import { resolveGrooveLabAudioDest } from '@/app/lib/creationStation/grooveLabAudio';
import type { VocalBoxPersonality, VocalBoxSpeechMode, VocalBoxSpeechStyle } from '@/app/lib/creationStation/grooveLabVocalBoxSpeech';
import {
  scheduleVocalBoxContinuousPhrase,
  scheduleVocalBoxProcessedSpeech,
  type VocalBoxPhraseNoteWindow,
} from '@/app/lib/creationStation/grooveLabVocalBoxProcessor';
import { micPhraseSegmentsForNotes } from '@/app/lib/creationStation/grooveLabVocalBoxMic';
import { vocalBoxPrefetchTokenBuffers, vocalBoxSynthesizePhraseBuffer } from '@/app/lib/creationStation/grooveLabVocalBoxTtsBuffer';
import { grooveLabSecPerSlot } from '@/app/lib/creationStation/grooveLabTransport';
import type { GrooveRollHit } from '@/app/lib/creationStation/grooveLabRoll';

export type VocalBoxNote = {
  slot: number;
  sustainSlots: number;
  midi: number;
  vel: number;
  syllable: string;
};

export type VocalBoxSettings = {
  autotuneStrength: number;
  robotMix: number;
  /** Wet vocoder amount (0–1). When set, overrides internal vocoder mix formula. */
  vocoderWet?: number;
  /** Dry vocal bleed (0–1). When set, overrides internal dry formula. */
  dryMix?: number;
  vibratoDepth: number;
  mode: VocalBoxSpeechMode;
  style: VocalBoxSpeechStyle;
  personality: VocalBoxPersonality;
};

export const VOCALBOX_DEFAULT_SETTINGS: VocalBoxSettings = {
  autotuneStrength: 0.95,
  robotMix: 0.78,
  vibratoDepth: 0.18,
  mode: 'normal',
  style: 'sing',
  personality: 'robot',
};

export function grooveRollHitsToVocalBoxNotes(hits: readonly GrooveRollHit[]): VocalBoxNote[] {
  const sorted = [...hits].sort((a, b) => a.slot - b.slot || a.midi - b.midi);
  return sorted.map((h) => ({
    slot: h.slot,
    sustainSlots: Math.max(1, h.sustainSlots),
    midi: h.midi,
    vel: Math.max(0.05, Math.min(1, h.vel)),
    syllable: '',
  }));
}

export function splitVocalBoxLyrics(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function mapLyricsToVocalBoxNotes(
  notes: readonly VocalBoxNote[],
  lyrics: string,
): VocalBoxNote[] {
  const tokens = splitVocalBoxLyrics(lyrics);
  if (notes.length === 0) return [];
  return notes.map((n, i) => ({
    ...n,
    syllable: tokens[i] ?? '',
  }));
}

export function vocalBoxNoteLabel(n: VocalBoxNote): string {
  return `${cbPianoMidiToNoteName(n.midi)} @${n.slot}${n.syllable ? ` · ${n.syllable}` : ''}`;
}

function buildVocalBoxPhraseWindows(
  notes: readonly VocalBoxNote[],
  bpm: number,
  t0: number,
  phraseBuf: AudioBuffer,
): VocalBoxPhraseNoteWindow[] {
  const secPerSlot = grooveLabSecPerSlot(bpm);
  const sorted = [...notes].sort((a, b) => a.slot - b.slot || a.midi - b.midi);
  const segments = micPhraseSegmentsForNotes(phraseBuf, sorted.length);
  return sorted.map((n, i) => {
    const when = t0 + n.slot * secPerSlot;
    const dur = Math.max(secPerSlot * 0.85, n.sustainSlots * secPerSlot * 0.92);
    const seg = segments[i]!;
    return {
      when,
      dur,
      midi: n.midi,
      vel: n.vel,
      envStartSec: seg.startSec,
      envEndSec: seg.endSec,
    };
  });
}

export type VocalBoxInputSource = 'type' | 'mic';

export type VocalBoxPreviewHandle = {
  stop: () => void;
  speechSource: 'cloud' | 'formant' | 'mic';
};

/**
 * Schedule one phrase — typed TTS or mic recording → auto-tune + robot @ each note.
 */
export async function previewVocalBoxPhrase(
  ctx: AudioContext,
  bpm: number,
  notes: readonly VocalBoxNote[],
  settings: VocalBoxSettings,
  opts?: { leadSec?: number; phrase?: string; micPhraseBuffer?: AudioBuffer | null },
): Promise<VocalBoxPreviewHandle> {
  const secPerSlot = grooveLabSecPerSlot(bpm);
  const dest = resolveGrooveLabAudioDest(ctx);
  const t0 = ctx.currentTime + Math.max(0.008, opts?.leadSec ?? 0.02);
  const stoppers: Array<() => void> = [];

  let speechBuffers: (AudioBuffer | undefined)[] = [];
  let speechSource: VocalBoxPreviewHandle['speechSource'] = 'cloud';

  if (opts?.micPhraseBuffer) {
    speechSource = 'mic';
    const windows = buildVocalBoxPhraseWindows(notes, bpm, t0, opts.micPhraseBuffer);
    stoppers.push(
      scheduleVocalBoxContinuousPhrase(ctx, dest, opts.micPhraseBuffer, windows, settings, {
        micMode: true,
      }),
    );
    return {
      speechSource,
      stop: () => {
        for (const fn of stoppers) fn();
      },
    };
  }

  const tokens = notes.map((n) => (n.syllable || 'la').trim().toLowerCase() || 'la');
  const phrase = opts?.phrase ?? tokens.join(' ');

  if (phrase.trim()) {
    const { buffer: phraseBuf, source: phraseSource } = await vocalBoxSynthesizePhraseBuffer(
      ctx,
      phrase,
      settings,
    );
    if (phraseBuf) {
      speechSource = phraseSource;
      const windows = buildVocalBoxPhraseWindows(notes, bpm, t0, phraseBuf);
      stoppers.push(
        scheduleVocalBoxContinuousPhrase(ctx, dest, phraseBuf, windows, settings, { micMode: false }),
      );
      return {
        speechSource,
        stop: () => {
          for (const fn of stoppers) fn();
        },
      };
    }
  }

  {
    const { buffers, source } = await vocalBoxPrefetchTokenBuffers(ctx, tokens, settings, phrase);
    speechSource = source;
    speechBuffers = notes.map((n) => {
      const key = (n.syllable || 'la').trim().toLowerCase() || 'la';
      return buffers.get(key);
    });
  }

  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]!;
    const speechBuf = speechBuffers[i];
    if (!speechBuf) continue;

    const when = t0 + n.slot * secPerSlot;
    const dur = Math.max(secPerSlot * 0.85, n.sustainSlots * secPerSlot * 0.92);
    stoppers.push(
      scheduleVocalBoxProcessedSpeech(ctx, dest, speechBuf, when, dur, n.midi, n.vel, settings),
    );
  }

  return {
    speechSource,
    stop: () => {
      for (const fn of stoppers) fn();
    },
  };
}

export function vocalBoxPhraseDurationSec(
  bpm: number,
  notes: readonly VocalBoxNote[],
): number {
  if (notes.length === 0) return 0;
  const secPerSlot = grooveLabSecPerSlot(bpm);
  let end = 0;
  for (const n of notes) {
    end = Math.max(end, (n.slot + n.sustainSlots) * secPerSlot);
  }
  return end + 0.15;
}
