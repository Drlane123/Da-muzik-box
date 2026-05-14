/**
 * AI Pattern Generator → Beat Lab Pad WAV bouncer.
 *
 * Walks a `boolean[][]` pattern (rows = note slots, cols = 1/16-note steps),
 * synthesizes every "on" cell into an `OfflineAudioContext`, and returns a
 * complete RIFF/WAVE byte buffer ready to hand back to Creation Station's
 * existing `onExportToPad` handler.
 *
 * Voice strategy — drives BOTH the live preview (via `scheduleAiPatternHit`,
 * called from `AiPatternScreen`) AND the offline WAV bounce, so the user
 * hears the same instrument they bounce:
 *   • For DRUM / Percussion tracks each pattern row maps to a GM-style
 *     drum oscillator recipe — kick, snare, clap, hi-hats, toms, rim.
 *   • For MELODY tracks (Piano / Bass / Lead / Pad / Brass / Strings /
 *     Pluck / Muted) we delegate to the Chord Builder's 14-voice
 *     instrument bank (`chordInstruments.ts`). Each AI instrument name
 *     resolves to one `ChordInstrumentId` plus a sensible base octave
 *     (bass sits an octave below piano, etc.) and rows pick a pitch out
 *     of a C-major scale rooted at that octave. Voices use multiple
 *     oscillators + biquad filters, so they sound like real piano /
 *     synth bass / strings instead of the old sine-with-envelope tone.
 *
 * Output is mono 16-bit PCM at 44.1 kHz by default — matches the
 * `StoredPadSample` shape the rest of Creation Station expects.
 */

import {
  getChordInstrument,
  type ChordInstrumentId,
} from '@/app/lib/creationStation/chordInstruments';
import {
  ensureBankLoaded,
  getReadyBank,
  scheduleDrumSample,
  scheduleMelodySample,
  type AiPatternVoiceKey,
} from '@/app/lib/aiPatternSampleBank';

/** Pattern dimensions tracked by `AiPatternScreen`. Cell `[row][col]` true
 *  means "fire the row's voice at the column's step". */
export type AiPatternMatrix = ReadonlyArray<ReadonlyArray<boolean>>;

export interface AiPatternRenderArgs {
  pattern: AiPatternMatrix;
  /** Step count per bar — Chord Builder + AI Pattern both use 4. */
  stepsPerBar?: number;
  /** Total bar count the pattern occupies. `pattern[0].length` should
   *  equal `loopLength * stepsPerBar`. */
  loopLength: number;
  /** Selected AI Pattern instrument name. Drives the row → voice mapping. */
  instrument: string;
  /** AI Pattern local tempo. */
  bpm: number;
  /** PCM sample rate. 44.1 kHz is the standard for sample-pad WAV files. */
  sampleRate?: number;
  /** Live AudioContext used to fetch + decode real-sample banks before
   *  the offline render runs. Optional — if omitted the offline context
   *  itself is used (works on Chrome / Edge, less reliable on Safari).
   *  When the bank can't be loaded the render still completes using the
   *  synth fallback voices. */
  audioContext?: BaseAudioContext;
  /** Song key root (0..11, C = 0). Drives melodic pitch mapping. */
  keyRoot?: number;
  /** Song mode (major / minor). Drives the scale used for melodic pitch. */
  mode?: 'major' | 'minor';
}

export interface AiPatternRenderResult {
  /** Complete RIFF/WAVE file bytes. */
  wavBytes: Uint8Array;
  /** Rendered duration in seconds (incl. release tail). */
  durationSec: number;
  /** Number of pattern cells that produced sound. */
  hits: number;
}

/** Schedule a single drum-channel voice (matches the live preview's
 *  `playDrumSound` recipes in MasterClockContext). Each case mirrors that
 *  module so the bounce sounds the same as the underlying kit. Accepts
 *  any `BaseAudioContext` so live (AudioContext) and bounce
 *  (OfflineAudioContext) share the exact same recipes. */
function scheduleDrumVoice(
  ctx: BaseAudioContext,
  destination: AudioNode,
  chId: number,
  velocity: number,
  startTime: number,
): void {
  const vol = (velocity / 127) * 0.45;
  const makeOsc = (
    freq: number | null,
    freqEnd: number | null,
    duration: number,
    type: OscillatorType = 'sine',
    volScale = 1,
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    if (freq !== null) osc.frequency.setValueAtTime(freq, startTime);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration);
    }
    gain.gain.setValueAtTime(vol * volScale, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain).connect(destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  };

  switch (chId) {
    case 1: // Kick — pitched sine sweep
      makeOsc(150, 0.01, 0.5);
      break;
    case 2: // Snare — triangle body
      makeOsc(200, null, 0.15, 'triangle');
      break;
    case 3: // Clap — square crack
      makeOsc(250, null, 0.12, 'square', 0.8);
      break;
    case 4: // Closed Hi-Hat — short high square (randomized frequency)
      makeOsc(8000 + Math.random() * 4000, null, 0.08, 'square', 0.5);
      break;
    case 5: // Open Hi-Hat — longer high square (randomized frequency)
      makeOsc(9000 + Math.random() * 5000, null, 0.3, 'square', 0.6);
      break;
    case 6: // Tom Hi — pitched sweep down
      makeOsc(400, 150, 0.1);
      break;
    case 7: // Tom Lo — deeper pitched sweep
      makeOsc(200, 80, 0.12);
      break;
    case 17: // Rim/Sub thump — used for the 8th drum row in AI Pattern
      makeOsc(80, 30, 0.6);
      break;
    default: {
      // Generic tone matches the live AI Pattern preview's fallback.
      makeOsc(440 + chId * 50, null, 0.1, 'sine', 0.5);
    }
  }
}

/** Map an AI Pattern drum-row index to the drum channel that voices that
 *  row in the bounce. Mirrors the live preview's row order:
 *    Kick · Snare · Clap · Hi-Hat · Open HH · Tom Hi · Tom Lo · Rim. */
const DRUM_ROW_CHANNELS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 17];

// ──────────────────────────────────────────────────────────────────────
// AI Pattern Generator instrument sound bank
// ──────────────────────────────────────────────────────────────────────
//
// Each AI Pattern instrument name maps to a Chord Builder voice plus a
// base MIDI pitch (the row-0 note). Row N transposes up the C-major scale
// by N steps. We keep base octaves musically appropriate:
//
//   • Bass instruments sit around MIDI 36 (C2) so they sound like a bass.
//   • Pads / Strings / Brass / Pluck sit around MIDI 48 (C3) — chord band.
//   • Piano / Lead sit around MIDI 60 (C4) — melody band.
//
// `Muted Guitar` reuses the Pluck Guitar voice with a shorter sustain so
// the kick attack is recognisable but the ring doesn't bleed into the
// next step.

/** Describes how to render one row of an AI Pattern lane. `drums` skips
 *  the chord bank and fires a per-row drum-channel oscillator; `melody`
 *  schedules a chord instrument voice at the given base octave.
 *
 *  Both kinds also include an optional `sampleBankKey` — when set, the
 *  scheduler first tries the real-sample bank (`aiPatternSampleBank`)
 *  and only falls back to synth when the bank hasn't finished loading
 *  or the network fetch failed. */
type AiPatternVoiceSpec =
  | { kind: 'drums'; sampleBankKey?: AiPatternVoiceKey }
  | {
      kind: 'melody';
      chordInstrumentId: ChordInstrumentId;
      baseMidi: number;
      /** Multiplier applied to the caller-provided sustain length. Some
       *  instruments (Muted Guitar) want a much shorter ring than the
       *  base sustain implies. */
      sustainScale?: number;
      /** Optional real-sample bank key. When loaded, the hit plays from
       *  the real sample instead of the chord-instrument synth voice. */
      sampleBankKey?: AiPatternVoiceKey;
    };

/** Public map so callers can introspect / extend (e.g. UI labels). The
 *  keys MUST match the strings in `AiPatternScreen.INSTRUMENTS`. */
export const AI_PATTERN_INSTRUMENT_VOICES: Readonly<Record<string, AiPatternVoiceSpec>> = {
  'Drums':         { kind: 'drums',  sampleBankKey: 'drum-kit' },
  'Percussion':    { kind: 'drums',  sampleBankKey: 'drum-kit' },
  'Piano':         { kind: 'melody', chordInstrumentId: 'piano-grand',  baseMidi: 60, sampleBankKey: 'piano-grand' },
  'Bass':          { kind: 'melody', chordInstrumentId: 'bass-synth',   baseMidi: 36, sampleBankKey: 'bass-electric' },
  // No good real-sample equivalent for a synth lead — keep the
  // chord-instrument synth voice, which is already designed for leads.
  'Lead Synth':    { kind: 'melody', chordInstrumentId: 'synth-lead',   baseMidi: 60 },
  // Sustained organ samples work as a warm pad.
  'Pads':          { kind: 'melody', chordInstrumentId: 'pad-warm',     baseMidi: 48, sampleBankKey: 'organ-pad' },
  'Brass':         { kind: 'melody', chordInstrumentId: 'brass',        baseMidi: 48, sampleBankKey: 'trumpet' },
  // Cello as the strings substitute — closer to "string ensemble" than violin alone.
  'Strings':       { kind: 'melody', chordInstrumentId: 'strings-warm', baseMidi: 48, sampleBankKey: 'strings-cello' },
  'Pluck Guitar':  { kind: 'melody', chordInstrumentId: 'pluck-guitar', baseMidi: 48, sampleBankKey: 'guitar-acoustic' },
  'Muted Guitar':  { kind: 'melody', chordInstrumentId: 'pluck-guitar', baseMidi: 48, sustainScale: 0.45, sampleBankKey: 'guitar-electric' },
};

/** Resolve the real-sample bank key for an AI Pattern instrument
 *  string. Returns `null` for voices that don't have a real-sample
 *  variant (e.g. Lead Synth). Used by the screen + render path to
 *  preload + await sample loads. */
export function getAiPatternSampleBankKey(instrument: string): AiPatternVoiceKey | null {
  const spec = AI_PATTERN_INSTRUMENT_VOICES[instrument];
  return spec?.sampleBankKey ?? null;
}

/** Resolve an AI Pattern instrument name to a voice spec. Falls back to
 *  Piano if the caller passes an unknown string (e.g. stale localStorage). */
export function getAiPatternVoiceSpec(instrument: string): AiPatternVoiceSpec {
  return AI_PATTERN_INSTRUMENT_VOICES[instrument] ?? AI_PATTERN_INSTRUMENT_VOICES['Piano']!;
}

/** Diatonic intervals (semitones from the tonic) for major + minor.
 *  Row N picks `intervals[N % 7]` and adds `floor(N / 7)` octaves. */
const MELODY_SCALE_INTERVALS: Record<'major' | 'minor', ReadonlyArray<number>> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

/** Row → MIDI pitch helper, scale + key aware. Row 0 is `baseMidi +
 *  keyRoot`; row 7 is one octave up; rows in between follow the
 *  scale's diatonic intervals (Major = Ionian, Minor = Aeolian).
 *  Shared by the live preview and the WAV bounce so both render the
 *  same pitch. Defaults (C / major) preserve the pre-key-aware behavior. */
function rowToMelodyMidi(
  row: number,
  baseMidi: number,
  keyRoot = 0,
  mode: 'major' | 'minor' = 'major',
): number {
  const SCALE_INTERVALS = MELODY_SCALE_INTERVALS[mode];
  const octave = Math.floor(row / SCALE_INTERVALS.length);
  const idx = row % SCALE_INTERVALS.length;
  return baseMidi + keyRoot + octave * 12 + SCALE_INTERVALS[idx]!;
}

/** Schedule a single AI Pattern hit (one row firing at one step). Works
 *  for both live preview (AudioContext) and bounce (OfflineAudioContext).
 *
 *  - Drum / Percussion rows fire a per-row drum oscillator recipe (kick,
 *    snare, hat …) — matches the bounce so live + WAV sound identical.
 *  - Melody rows schedule a Chord Builder voice (piano / bass / pad …) at
 *    a pitch derived from the row index and the instrument's base octave.
 *
 *  Caller is responsible for clamping `startTime` to `ctx.currentTime` if
 *  scheduling live — passing a past timestamp is harmless (Web Audio
 *  fires immediately) but the AI preview path already adds a 1.5 ms guard. */
export function scheduleAiPatternHit(args: {
  ctx: BaseAudioContext;
  destination: AudioNode;
  instrument: string;
  /** Row in the AI Pattern grid that triggered the hit (0..rows-1). */
  row: number;
  startTime: number;
  /** Target note length. Drum recipes ignore this and use their natural
   *  decay; melody voices honor it directly. */
  sustainSec: number;
  /** 0..1 — peak level scale. Defaults to ~0.79 (matches the existing
   *  AI preview's 100/127 velocity). */
  velocity?: number;
  /** Song key — `0` = C … `11` = B. Drives the scale-aware row → MIDI
   *  mapping for melody voices (ignored for drums). Defaults to C. */
  keyRoot?: number;
  /** Song mode — `'major'` or `'minor'`. Switches between Ionian and
   *  Aeolian intervals for melody pitch. Defaults to `'major'` for
   *  backwards compat with callers that don't pass this. */
  mode?: 'major' | 'minor';
}): void {
  const spec = getAiPatternVoiceSpec(args.instrument);
  const vel = args.velocity ?? 100 / 127;
  const sampleArgs = {
    ctx: args.ctx,
    destination: args.destination,
    startTime: args.startTime,
    velocity: vel,
    sustainSec: args.sustainSec,
  };

  if (spec.kind === 'drums') {
    // Try the real TR-808 sample bank first. If a row sample is loaded,
    // play it and return; otherwise fall through to the oscillator recipe.
    if (spec.sampleBankKey) {
      const bank = getReadyBank(spec.sampleBankKey);
      if (bank && scheduleDrumSample(bank, args.row, sampleArgs)) return;
    }
    const ch =
      DRUM_ROW_CHANNELS[args.row] ??
      DRUM_ROW_CHANNELS[DRUM_ROW_CHANNELS.length - 1]!;
    scheduleDrumVoice(args.ctx, args.destination, ch, Math.round(vel * 127), args.startTime);
    return;
  }

  const midi = rowToMelodyMidi(args.row, spec.baseMidi, args.keyRoot ?? 0, args.mode ?? 'major');
  const sustain = args.sustainSec * (spec.sustainScale ?? 1);

  // Real-sample path for melodic voices — pitch-shifts the nearest
  // cached sample to `midi`. Falls back to the chord-instrument synth
  // if the bank isn't loaded yet.
  if (spec.sampleBankKey) {
    const bank = getReadyBank(spec.sampleBankKey);
    if (bank && scheduleMelodySample(bank, midi, { ...sampleArgs, sustainSec: sustain })) return;
  }
  const inst = getChordInstrument(spec.chordInstrumentId);
  inst.scheduleNote({
    ctx: args.ctx,
    destination: args.destination,
    midi,
    startTime: args.startTime,
    sustainSec: sustain,
    velocity: vel,
  });
}

/**
 * Bounce a single AI Pattern lane to a one-shot WAV. The returned bytes
 * decode cleanly via `decodeAudioData` and persist via the same
 * `StoredPadSample` shape Beat Lab uses for every other sample pad.
 */
export async function renderAiPatternToWav(
  args: AiPatternRenderArgs,
): Promise<AiPatternRenderResult> {
  const sampleRate = args.sampleRate ?? 44100;
  const bpm = Math.max(20, Math.min(300, args.bpm));
  const stepsPerBar = Math.max(1, args.stepsPerBar ?? 4);
  const loopLength = Math.max(1, args.loopLength);
  const totalSteps = stepsPerBar * loopLength;
  // A "step" in the AI Pattern grid is one 1/16 note: 4 cols per beat,
  // 4 beats per bar → 16 cells per bar. Each cell is 1/4 of a beat.
  const secPerStep = (60 / bpm) / 4;
  const patternDurationSec = totalSteps * secPerStep;
  // Tail ensures the longest voice (open hi-hat at 0.3 s, pad at 0.8 s)
  // rings out fully even when it triggers on the last step.
  const tailSec = 1.0;
  const totalSec = patternDurationSec + tailSec;
  const totalFrames = Math.max(1, Math.ceil(totalSec * sampleRate));

  // Single mono OfflineAudioContext for the whole loop. Mono keeps the
  // file size small and matches every other pad sample in the project.
  const offline = new OfflineAudioContext(1, totalFrames, sampleRate);
  // Melody sustain — one beat at the current tempo gives chord-band
  // voices enough time to ring but stays short enough that 1/16-step
  // patterns don't smear into mud. Drum recipes ignore this value.
  // Each step = 1/16th note. Sustain = 2 steps (1/8th note) so notes
  // overlap slightly — this matches what the live preview does and gives
  // melody + bass notes a natural decay into the next hit.
  const melodySustainSec = (60 / bpm / 4) * 2;
  let hits = 0;

  // Make sure the real-sample bank for this instrument is loaded BEFORE
  // we schedule any hits — otherwise the bounce silently falls back to
  // the synth voice. We tolerate failures: if the network is dead or
  // the URLs 404, `scheduleAiPatternHit` simply uses the synth voice.
  const bankKey = getAiPatternSampleBankKey(args.instrument);
  if (bankKey) {
    try {
      const decodeCtx = args.audioContext ?? offline;
      await ensureBankLoaded(bankKey, decodeCtx).readyPromise;
    } catch {
      /* Synth fallback handles this. */
    }
  }

  // Walk every cell in row-major order. `pattern[row].length` may not
  // match `totalSteps` exactly if the user is mid-edit; we clamp to the
  // smaller value so we never index out of bounds.
  for (let row = 0; row < args.pattern.length; row++) {
    const rowData = args.pattern[row]!;
    const rowSteps = Math.min(rowData.length, totalSteps);
    for (let step = 0; step < rowSteps; step++) {
      if (!rowData[step]) continue;
      const startTime = step * secPerStep;
      scheduleAiPatternHit({
        ctx: offline,
        destination: offline.destination,
        instrument: args.instrument,
        row,
        startTime,
        sustainSec: melodySustainSec,
        keyRoot: args.keyRoot,
        mode: args.mode,
      });
      hits += 1;
    }
  }

  if (hits === 0) {
    throw new Error('Pattern is empty — generate or toggle at least one cell first.');
  }

  const rendered = await offline.startRendering();
  const channels: Float32Array[] = [];
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    channels.push(rendered.getChannelData(c));
  }
  const wavBytes = encodeWavMono16(channels[0]!, sampleRate);
  return { wavBytes, durationSec: totalSec, hits };
}

// ──────────────────────────────────────────────────────────────────────
// WAV encoder — same minimal RIFF/WAVE writer the Chord Builder uses.
// Kept inline rather than re-imported so AI Pattern stays self-contained.
// ──────────────────────────────────────────────────────────────────────

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
  view.setUint32(16, 16, true);      // PCM fmt chunk size
  view.setUint16(20, 1, true);       // format = PCM
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
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/** Convert a `Uint8Array` to a base64 string — used by the parent screen
 *  to persist a rendered WAV into `StoredPadSample.data`. Chunked to keep
 *  `String.fromCharCode(...spread)` from blowing the call stack on long
 *  bounces (a 4-bar drum loop at 44.1 kHz can easily exceed 256 KB). */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}
