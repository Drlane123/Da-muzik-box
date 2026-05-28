/**
 * Render a Chord Builder progression to a one-shot WAV byte buffer.
 *
 * The renderer uses the SAME synth voice the user has selected in the
 * Chord Builder Sound Bank — every voice in `CHORD_INSTRUMENTS` is fully
 * synthesized with standard Web Audio nodes, so it sounds identical
 * whether scheduled through a live `AudioContext` (audition) or this
 * `OfflineAudioContext` (WAV bounce).
 *
 * Output is mono 16-bit PCM at the chosen sample rate (44.1 kHz by default).
 * The returned `Uint8Array` is a complete RIFF/WAVE file ready to hand to
 * `decodeAudioData` or persist via `StoredPadSample`.
 */
import { chordSymbolToMidi, type ChordMode, type ChordSymbol } from './chordBuilder';
import type { ChordVoicingSize } from './chordVoicing';
import type { ChordArpSettings } from './chordArpeggiator';
import { DEFAULT_CHORD_ARP } from './chordArpeggiator';
import { createChordFxBus, DEFAULT_CHORD_BUILDER_FX, type ChordBuilderFxSettings } from './chordBuilderFx';
import { scheduleVoicedChordPlayback } from './chordBuilderPlayback';
import { buildVoicedMidiSet, type SmartVoicingOptions } from './smartChordVoicing';
import {
  DEFAULT_CHORD_INSTRUMENT_ID,
  getChordInstrument,
  type ChordInstrumentId,
} from './chordInstruments';

/** Single bar slot — matches the timeline shape in `ChordBuilderTab`. */
export interface ChordRenderSlot {
  chord: ChordSymbol | null;
}

export interface ChordRenderArgs {
  /** Bar-indexed timeline (1 slot = 1 bar). Null slots are silent. */
  timeline: ReadonlyArray<ChordRenderSlot>;
  keyRoot: number;
  mode: ChordMode;
  /** Beats-per-minute used for both bar length and sustain time. */
  bpm: number;
  /** How many bars each chord-slot occupies (1 = one chord per bar). */
  barsPerChord: number;
  /** PCM sample rate. 44.1 kHz is the standard for sample-pad WAV files. */
  sampleRate?: number;
  /** Which Sound Bank voice to render with. Falls back to Grand Piano if
   *  the id is missing/unknown (defensive — same default as audition). */
  instrumentId?: ChordInstrumentId;
  /** Keys per chord — 3 (triad) through 7 (full extensions). Default 5. */
  chordVoicingSize?: ChordVoicingSize;
  smartVoicing?: boolean;
  spread?: number;
  arp?: ChordArpSettings;
  fx?: ChordBuilderFxSettings;
  /** Transpose rendered chords by this many octaves (−2…+2 typical). */
  octaveShift?: number;
}

export interface ChordRenderResult {
  /** Complete RIFF/WAVE file bytes. */
  wavBytes: Uint8Array;
  /** Rendered duration in seconds (incl. tail). */
  durationSec: number;
  /** Number of chord bars that produced sound (excludes null slots). */
  filledBars: number;
}

/** One section in a multi-section song bounce. Mirrors the shape of a
 *  Chord Builder `Progression` so the caller can just spread sections in
 *  order without reshaping the data. */
export interface SongRenderSection {
  /** Bar-indexed timeline (one slot = `barsPerChord` bars). */
  timeline: ReadonlyArray<ChordRenderSlot>;
  /** How many bars each filled slot occupies. */
  barsPerChord: number;
  /** Total bar count for the section — drives the section's footprint in
   *  the timeline cursor. We use this (rather than `timeline.length *
   *  barsPerChord`) so an 8-bar section with only 2 chords still occupies
   *  8 bars in the bounce, matching what the user sees on the piano roll. */
  totalBars: number;
}

export interface SongRenderArgs {
  /** Sections rendered back-to-back in the supplied order. */
  sections: ReadonlyArray<SongRenderSection>;
  keyRoot: number;
  mode: ChordMode;
  /** Single BPM shared across every section — Chord Builder enforces this
   *  globally so the song's tempo is consistent across tabs. */
  bpm: number;
  /** PCM sample rate. 44.1 kHz is the standard for distributed WAV files. */
  sampleRate?: number;
  /** Sound Bank voice used for every section. */
  instrumentId?: ChordInstrumentId;
  chordVoicingSize?: ChordVoicingSize;
  smartVoicing?: boolean;
  spread?: number;
  arp?: ChordArpSettings;
  fx?: ChordBuilderFxSettings;
  octaveShift?: number;
}

function octaveDelta(args: { octaveShift?: number }): number {
  return (args.octaveShift ?? 0) * 12;
}

function renderVoicingOpts(args: {
  chordVoicingSize?: ChordVoicingSize;
  smartVoicing?: boolean;
  spread?: number;
}): Partial<SmartVoicingOptions> {
  return {
    size: args.chordVoicingSize ?? 5,
    smartVoicing: args.smartVoicing ?? true,
    spread: args.spread ?? 55,
  };
}

/** Build the OfflineAudioContext, schedule every chord, render to PCM, encode WAV. */
export async function renderChordTimelineToWav(
  args: ChordRenderArgs,
): Promise<ChordRenderResult> {
  const sampleRate = args.sampleRate ?? 44100;
  const bpm = Math.max(20, Math.min(300, args.bpm));
  const barsPerChord = Math.max(1, Math.floor(args.barsPerChord));
  const secPerBar = (60 / bpm) * 4 * barsPerChord;

  // Walk the timeline once and collect every filled slot together with its
  // absolute bar index. Empty slots leave silence in the bounce so the
  // user can still hear them as breaks in a multi-bar one-shot.
  const filled: { chord: ChordSymbol; barIdx: number }[] = [];
  for (let i = 0; i < args.timeline.length; i++) {
    const c = args.timeline[i]?.chord;
    if (c) filled.push({ chord: c, barIdx: i });
  }
  if (filled.length === 0) {
    throw new Error('No chords to render — add at least one chord first.');
  }

  // Render through the bar after the LAST chord so a sustained note can
  // ring out cleanly, plus a 0.4 s tail for the natural release envelope.
  const lastBarEnd = (filled[filled.length - 1]!.barIdx + barsPerChord) * secPerBar;
  const tailSec = 0.4;
  const totalSec = lastBarEnd + tailSec;
  const totalFrames = Math.max(1, Math.ceil(totalSec * sampleRate));

  // OfflineAudioContext is mono — a chord pad almost always plays back as
  // a one-shot sample, and the rest of Creation Station mixes pads through
  // the per-channel pan, so mono keeps the file small without surprises.
  const offline = new OfflineAudioContext(1, totalFrames, sampleRate);

  // Resolve the voice ONCE outside the loop. Every chord shares the same
  // instrument; the per-note graph is built fresh inside `scheduleNote`.
  const instrument = getChordInstrument(args.instrumentId ?? DEFAULT_CHORD_INSTRUMENT_ID);
  const voicingOpts = renderVoicingOpts(args);
  const arp = args.arp ?? DEFAULT_CHORD_ARP;
  const fx = args.fx ?? DEFAULT_CHORD_BUILDER_FX;
  const fxBus = createChordFxBus(offline, offline.destination);
  fxBus.update(fx);
  const dest = fxBus.input;

  const oct = octaveDelta(args);
  for (const { chord, barIdx } of filled) {
    const midis = buildVoicedMidiSet(chord, args.keyRoot, args.mode, voicingOpts);
    if (!midis || midis.length === 0) continue;
    const shifted = oct === 0 ? midis : midis.map((m) => m + oct);
    const start = barIdx * secPerBar;
    const sustain = barsPerChord * secPerBar * 0.95;
    scheduleVoicedChordPlayback(instrument, offline, dest, shifted, start, sustain, bpm, arp, fx);
  }
  fxBus.dispose();

  const rendered = await offline.startRendering();
  const channels: Float32Array[] = [];
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    channels.push(rendered.getChannelData(c));
  }
  const wavBytes = encodeWavMono16(channels[0]!, sampleRate);
  return { wavBytes, durationSec: totalSec, filledBars: filled.length };
}

/**
 * Render an entire multi-section song (all Progression tabs back-to-back) to
 * a single WAV. Sections play in the supplied order, each starting exactly
 * when the previous one ends — no gaps, no overlaps. A short tail keeps the
 * last chord's release from getting truncated.
 *
 * The renderer assumes a single shared key/mode/BPM/instrument across every
 * section, which mirrors how Chord Builder enforces these settings globally
 * (they live on the panel root, not on each Progression). This matters when
 * the user has, say, a Verse in C major + an auto-generated Chorus in C
 * major — they'll both bounce in C and at the same tempo.
 */
export async function renderSongToWav(args: SongRenderArgs): Promise<ChordRenderResult> {
  const sampleRate = args.sampleRate ?? 44100;
  const bpm = Math.max(20, Math.min(300, args.bpm));
  // One BAR's duration in seconds — every section's footprint and every
  // chord's bar-aligned start time is computed from this single anchor.
  const secPerBar = (60 / bpm) * 4;

  // Walk sections IN ORDER, building a flat list of (chord, absoluteStartSec,
  // sustainSec) events. The section cursor advances by section.totalBars
  // after each section, regardless of how many slots in that section were
  // filled — so an 8-bar section with only 2 chords still consumes 8 bars
  // of song time, matching what the user sees in the piano roll.
  type AbsoluteChord = { chord: ChordSymbol; start: number; sustain: number };
  const events: AbsoluteChord[] = [];
  let sectionStartSec = 0;
  let totalFilled = 0;
  for (const section of args.sections) {
    const bpc = Math.max(1, Math.floor(section.barsPerChord));
    const secPerSlot = secPerBar * bpc;
    const sectionLengthSec = Math.max(1, section.totalBars) * secPerBar;
    for (let i = 0; i < section.timeline.length; i++) {
      const c = section.timeline[i]?.chord;
      if (c) {
        events.push({
          chord: c,
          start: sectionStartSec + i * secPerSlot,
          // Hold for ~95% of the slot — last 5% rings out as a soft release
          // so chord changes don't pop. Matches single-section renderer.
          sustain: secPerSlot * 0.95,
        });
        totalFilled += 1;
      }
    }
    sectionStartSec += sectionLengthSec;
  }
  if (events.length === 0) {
    throw new Error('No chords to render — add chords to at least one section first.');
  }

  // Total duration = end of last section + a 0.5 s tail so the final
  // chord's natural release isn't clipped.
  const tailSec = 0.5;
  const totalSec = sectionStartSec + tailSec;
  const totalFrames = Math.max(1, Math.ceil(totalSec * sampleRate));

  // Single mono OfflineAudioContext for the whole song. Mono keeps the file
  // size manageable for long songs (a 2-min 44.1 kHz mono 16-bit WAV is
  // ~10 MB, which is fine for a one-shot download).
  const offline = new OfflineAudioContext(1, totalFrames, sampleRate);
  const instrument = getChordInstrument(args.instrumentId ?? DEFAULT_CHORD_INSTRUMENT_ID);
  const voicingOpts = renderVoicingOpts(args);
  const arp = args.arp ?? DEFAULT_CHORD_ARP;
  const fx = args.fx ?? DEFAULT_CHORD_BUILDER_FX;
  const fxBus = createChordFxBus(offline, offline.destination);
  fxBus.update(fx);
  const dest = fxBus.input;
  let prev: ChordSymbol | null = null;
  const oct = octaveDelta(args);

  for (const ev of events) {
    const midis = buildVoicedMidiSet(ev.chord, args.keyRoot, args.mode, voicingOpts, prev);
    prev = ev.chord;
    if (!midis || midis.length === 0) continue;
    const shifted = oct === 0 ? midis : midis.map((m) => m + oct);
    scheduleVoicedChordPlayback(instrument, offline, dest, shifted, ev.start, ev.sustain, bpm, arp, fx);
  }
  fxBus.dispose();

  const rendered = await offline.startRendering();
  const channels: Float32Array[] = [];
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    channels.push(rendered.getChannelData(c));
  }
  const wavBytes = encodeWavMono16(channels[0]!, sampleRate);
  return { wavBytes, durationSec: totalSec, filledBars: totalFilled };
}

/**
 * Encode a single channel of float audio (`-1..+1`) as a 16-bit PCM
 * RIFF/WAVE file. The 44-byte header + interleaved samples are written
 * into one contiguous `ArrayBuffer` so the result drops straight into
 * `fetch`/`Blob`/`decodeAudioData` without intermediate copies.
 */
function encodeWavMono16(samples: Float32Array, sampleRate: number): Uint8Array {
  const channels = 1;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  // RIFF / WAVE chunk descriptor.
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  // 'fmt ' subchunk.
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);            // PCM fmt chunk size
  view.setUint16(20, 1, true);             // format = PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  // 'data' subchunk.
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  // Interleaved sample data — float → signed 16-bit, little-endian.
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    let s = samples[i]!;
    if (s > 1) s = 1; else if (s < -1) s = -1;
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Uint8Array(buffer);
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/**
 * Convert a `Uint8Array` of raw bytes to a base64 string. Used by the
 * parent screen to persist a rendered WAV into `StoredPadSample.data`.
 * Walks the array in 32 KB chunks so we don't blow the call stack on
 * `String.fromCharCode(...largeSpread)`.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}
