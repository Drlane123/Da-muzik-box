/**
 * AI Pattern Generator real-sample bank.
 *
 * Lazy-loads real instrument samples from public CDNs and caches them as
 * decoded `AudioBuffer`s so the live preview and offline WAV bounce both
 * sound like real instruments instead of basic oscillator synths.
 *
 * Sources (all free, no auth, no rate limits worth worrying about):
 *
 *   • Drums: smpldsnds.github.io TR-808 — full 8-piece kit (kick, snare,
 *     clap, closed HH, open HH, hi tom, lo tom, rim) hosted as .m4a.
 *     Source: https://github.com/smpldsnds/drum-machines (public domain).
 *
 *   • Melodic: nbrosowsky.github.io/tonejs-instruments — sampled
 *     piano (Salamander Grand), electric bass, organ, trumpet, cello,
 *     guitar (acoustic + electric). Source repo lists which notes each
 *     instrument has — we only reference URLs that 200 (verified during
 *     development with curl).
 *
 * Design:
 *
 *   • One bank per AI Pattern voice key (e.g. `'piano-grand'`,
 *     `'drum-kit'`). Each bank is loaded ONCE per session and cached on
 *     `LOADED_BANKS`. Repeat plays reuse the decoded buffer.
 *
 *   • Drum banks are keyed by row index (0..7). Each row has its own
 *     dedicated sample — no pitch shifting.
 *
 *   • Melodic banks are keyed by MIDI pitch. When the user plays a pitch
 *     we find the nearest cached sample and apply a `playbackRate` shift
 *     to reach the target frequency. Pitch shifts are bounded to ±7
 *     semitones from the nearest sample, which sounds clean for short
 *     pattern hits.
 *
 *   • Sample fetch + decode happens via the LIVE AudioContext. The
 *     resulting `AudioBuffer` works in BOTH live and OfflineAudioContext
 *     — `AudioBufferSourceNode.buffer = buf` accepts any AudioBuffer
 *     regardless of which context created it.
 *
 *   • If a sample 404s, fails to decode, or the user is offline, the
 *     bank is marked as `failed` and the caller's `scheduleAiPatternHit`
 *     falls back to the existing chord-instrument synth voice. No
 *     errors leak into the audio path — the user just hears the synth.
 */

/** Logical AI Pattern voice id. `drum-kit` covers Drums + Percussion;
 *  every other id maps to one melodic sample set. */
export type AiPatternVoiceKey =
  | 'drum-kit'
  | 'piano-grand'
  | 'bass-electric'
  | 'organ-pad'
  | 'trumpet'
  | 'strings-cello'
  | 'guitar-acoustic'
  | 'guitar-electric';

/** State machine for a single bank load. Callers check `bank.state` and
 *  branch — `ready` plays samples, `failed` or `loading` falls back to
 *  the synth voice silently. */
type SampleBankState = 'idle' | 'loading' | 'ready' | 'failed';

interface MelodySampleEntry {
  /** MIDI pitch the sample was recorded at — used as the pitch-shift anchor. */
  rootMidi: number;
  buffer: AudioBuffer;
}

interface DrumSampleEntry {
  /** AI Pattern row this sample belongs to (0..7). */
  row: number;
  buffer: AudioBuffer;
}

interface LoadedBank {
  state: SampleBankState;
  /** Melodic banks: one entry per root pitch we sampled. */
  melodySamples?: MelodySampleEntry[];
  /** Drum banks: one entry per AI Pattern row. */
  drumSamples?: Map<number, DrumSampleEntry>;
  /** Promise resolves when the bank reaches `ready` or `failed`. Callers
   *  awaiting the bounce path block on this; callers driving the live
   *  preview ignore it and fall back to synth until the next hit. */
  readyPromise: Promise<void>;
}

const LOADED_BANKS = new Map<AiPatternVoiceKey, LoadedBank>();

// ──────────────────────────────────────────────────────────────────────
// Sample manifest — verified URLs (curl 200 during development).
// ──────────────────────────────────────────────────────────────────────

const SMPLDSNDS_BASE = 'https://smpldsnds.github.io/drum-machines/TR-808';
const TONEJS_INSTRUMENTS = 'https://nbrosowsky.github.io/tonejs-instruments/samples';

/** Per-row URLs for the TR-808 drum kit. Row indices match
 *  `NOTE_NAMES` in `AiPatternScreen.tsx`. */
const DRUM_KIT_URLS: ReadonlyArray<{ row: number; url: string }> = [
  { row: 0, url: `${SMPLDSNDS_BASE}/kick/bd0000.m4a` },        // Kick
  { row: 1, url: `${SMPLDSNDS_BASE}/snare/sd0000.m4a` },       // Snare
  { row: 2, url: `${SMPLDSNDS_BASE}/clap/cp.m4a` },            // Clap
  { row: 3, url: `${SMPLDSNDS_BASE}/hihat-close/ch.m4a` },     // Hi-Hat (closed)
  { row: 4, url: `${SMPLDSNDS_BASE}/hihat-open/oh00.m4a` },    // Open HH
  { row: 5, url: `${SMPLDSNDS_BASE}/tom-hi/ht00.m4a` },        // Tom Hi
  { row: 6, url: `${SMPLDSNDS_BASE}/tom-low/lt00.m4a` },       // Tom Lo
  { row: 7, url: `${SMPLDSNDS_BASE}/rimshot/rs.m4a` },         // Rim
];

/** Per-pitch URLs for melodic instruments. The `midi` value is the
 *  pitch the sample was recorded at — we pitch-shift to reach the
 *  caller's requested midi. Each set is intentionally small (2-3
 *  samples spanning the playable range) to keep the first-use fetch
 *  cost down to ~50-150 KB per instrument. */
interface MelodySource {
  /** `{Note}{Octave}` — e.g. `C4`, `Fs3` — used to build the URL. */
  note: string;
  /** MIDI pitch of `note`. Used to compute the pitch-shift ratio. */
  midi: number;
}

const MELODY_BANK_DEFS: Readonly<
  Record<Exclude<AiPatternVoiceKey, 'drum-kit'>, { folder: string; samples: ReadonlyArray<MelodySource> }>
> = {
  // Salamander Grand Piano — full range, cheap fetches.
  'piano-grand': {
    folder: 'piano',
    samples: [
      { note: 'C3', midi: 48 },
      { note: 'C4', midi: 60 },
      { note: 'C5', midi: 72 },
    ],
  },
  // Electric bass — only certain pitches exist in the repo.
  'bass-electric': {
    folder: 'bass-electric',
    samples: [
      { note: 'E1', midi: 28 },
      { note: 'E2', midi: 40 },
      { note: 'Cs2', midi: 37 },
    ],
  },
  // Sustained organ tone doubles as a warm pad.
  'organ-pad': {
    folder: 'organ',
    samples: [
      { note: 'A3', midi: 57 },
      { note: 'C4', midi: 60 },
    ],
  },
  // Trumpet for brass parts.
  'trumpet': {
    folder: 'trumpet',
    samples: [
      { note: 'C4', midi: 60 },
      { note: 'F4', midi: 65 },
    ],
  },
  // Bowed cello as the strings substitute.
  'strings-cello': {
    folder: 'cello',
    samples: [
      { note: 'C3', midi: 48 },
      { note: 'C4', midi: 60 },
    ],
  },
  // Acoustic guitar for pluck.
  'guitar-acoustic': {
    folder: 'guitar-acoustic',
    samples: [
      { note: 'C3', midi: 48 },
      { note: 'C4', midi: 60 },
    ],
  },
  // Electric guitar — used for muted-guitar voice with a short envelope.
  'guitar-electric': {
    folder: 'guitar-electric',
    samples: [
      { note: 'C3', midi: 48 },
      { note: 'C4', midi: 60 },
    ],
  },
};

// ──────────────────────────────────────────────────────────────────────
// Loading
// ──────────────────────────────────────────────────────────────────────

/** Fetch + decode a single sample URL using the live AudioContext.
 *  Throws on any failure so the caller can mark the bank `failed`. */
async function fetchAndDecode(url: string, ctx: BaseAudioContext): Promise<AudioBuffer> {
  const resp = await fetch(url, { cache: 'force-cache' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  const bytes = await resp.arrayBuffer();
  return await ctx.decodeAudioData(bytes.slice(0));
}

/** Build the load promise for a specific voice. Recorded on
 *  `LOADED_BANKS` synchronously so concurrent calls share one fetch. */
function startLoad(key: AiPatternVoiceKey, ctx: BaseAudioContext): LoadedBank {
  const bank: LoadedBank = {
    state: 'loading',
    readyPromise: Promise.resolve(),
  };
  LOADED_BANKS.set(key, bank);

  bank.readyPromise = (async () => {
    try {
      if (key === 'drum-kit') {
        const drumSamples = new Map<number, DrumSampleEntry>();
        // Fetch every drum sample in parallel — the kit is small (~50KB
        // total) so this completes in a single network round-trip.
        await Promise.all(
          DRUM_KIT_URLS.map(async ({ row, url }) => {
            try {
              const buffer = await fetchAndDecode(url, ctx);
              drumSamples.set(row, { row, buffer });
            } catch {
              // Individual row failures are tolerated — that row falls
              // back to synth, the rest still play as real samples.
            }
          }),
        );
        bank.drumSamples = drumSamples;
        // Need at least one sample to count as ready. Empty bank = failed.
        bank.state = drumSamples.size > 0 ? 'ready' : 'failed';
        return;
      }

      const def = MELODY_BANK_DEFS[key];
      const melodySamples: MelodySampleEntry[] = [];
      await Promise.all(
        def.samples.map(async (s) => {
          try {
            const url = `${TONEJS_INSTRUMENTS}/${def.folder}/${s.note}.mp3`;
            const buffer = await fetchAndDecode(url, ctx);
            melodySamples.push({ rootMidi: s.midi, buffer });
          } catch {
            // Tolerated per-sample.
          }
        }),
      );
      melodySamples.sort((a, b) => a.rootMidi - b.rootMidi);
      bank.melodySamples = melodySamples;
      bank.state = melodySamples.length > 0 ? 'ready' : 'failed';
    } catch {
      bank.state = 'failed';
    }
  })();

  return bank;
}

/** Kick off (or join) loading for a voice. Returns the bank object so
 *  callers can await `bank.readyPromise` if they need samples synchronously
 *  (e.g. the WAV bouncer). Live-preview callers just discard the result
 *  and check `getReadyBank` on each hit. */
export function ensureBankLoaded(
  key: AiPatternVoiceKey,
  ctx: BaseAudioContext,
): LoadedBank {
  const existing = LOADED_BANKS.get(key);
  if (existing) return existing;
  return startLoad(key, ctx);
}

/** Synchronous accessor — returns the bank only if its samples are
 *  ready to play. Used by the live preview to decide between "play a
 *  real sample" and "fall back to synth". */
export function getReadyBank(key: AiPatternVoiceKey): LoadedBank | null {
  const bank = LOADED_BANKS.get(key);
  return bank && bank.state === 'ready' ? bank : null;
}

/** Coarse status snapshot for the UI — lets the screen show a
 *  "Loading sounds…" hint while a bank is fetching. */
export function getBankLoadStatus(key: AiPatternVoiceKey): SampleBankState {
  return LOADED_BANKS.get(key)?.state ?? 'idle';
}

// ──────────────────────────────────────────────────────────────────────
// Scheduling
// ──────────────────────────────────────────────────────────────────────

/** Pick the cached melodic sample whose `rootMidi` is closest to
 *  `targetMidi`. The caller will pitch-shift via playbackRate to reach
 *  the exact target. Returns null if no samples are loaded. */
function pickNearestMelodySample(
  bank: LoadedBank,
  targetMidi: number,
): MelodySampleEntry | null {
  const samples = bank.melodySamples;
  if (!samples || samples.length === 0) return null;
  let best = samples[0]!;
  let bestDist = Math.abs(best.rootMidi - targetMidi);
  for (let i = 1; i < samples.length; i++) {
    const s = samples[i]!;
    const d = Math.abs(s.rootMidi - targetMidi);
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

export interface ScheduleSampleArgs {
  ctx: BaseAudioContext;
  destination: AudioNode;
  startTime: number;
  /** 0..1 peak level. */
  velocity: number;
  /** Length of the envelope hold (drum samples ignore this and play their
   *  natural decay; melody samples cap at this length + a short release). */
  sustainSec: number;
}

/** Schedule a drum-row sample. Returns true if a real sample was
 *  scheduled, false if the row wasn't loaded (caller falls back to synth). */
export function scheduleDrumSample(
  bank: LoadedBank,
  row: number,
  args: ScheduleSampleArgs,
): boolean {
  const entry = bank.drumSamples?.get(row);
  if (!entry) return false;
  const src = args.ctx.createBufferSource();
  src.buffer = entry.buffer;
  // Each drum row gets its own short envelope so velocity differences
  // are audible and the sample doesn't tail past the cell boundary.
  const gain = args.ctx.createGain();
  const peak = Math.max(0.001, args.velocity) * 0.85;
  gain.gain.setValueAtTime(peak, args.startTime);
  // Don't ramp to silence — let the sample's own decay shape the tail.
  src.connect(gain).connect(args.destination);
  src.start(args.startTime);
  // BufferSource self-stops at buffer end; explicit stop guards long open-hat samples.
  src.stop(args.startTime + Math.max(0.5, entry.buffer.duration + 0.1));
  return true;
}

/** Schedule a melodic sample at `targetMidi`. Pitch-shifts via playbackRate
 *  from the nearest cached sample. Returns true on success, false if the
 *  bank isn't loaded (caller falls back to synth). */
export function scheduleMelodySample(
  bank: LoadedBank,
  targetMidi: number,
  args: ScheduleSampleArgs,
): boolean {
  const entry = pickNearestMelodySample(bank, targetMidi);
  if (!entry) return false;
  const src = args.ctx.createBufferSource();
  src.buffer = entry.buffer;
  // playbackRate = 2^(semitones/12). Positive shifts up, negative down.
  // Bound to ±7 semitones — beyond that pitched samples sound chipmunky.
  const semitones = Math.max(-7, Math.min(7, targetMidi - entry.rootMidi));
  src.playbackRate.value = Math.pow(2, semitones / 12);

  // Sustain shapes the perceived note length. We use a short attack +
  // long-ish hold + brief release so notes don't click on / off.
  const gain = args.ctx.createGain();
  const peak = Math.max(0.001, args.velocity) * 0.85;
  // Sample-based playback is naturally a bit louder than the synth so we
  // attenuate a touch.
  const sustain = Math.max(0.05, args.sustainSec);
  gain.gain.setValueAtTime(0.0001, args.startTime);
  gain.gain.linearRampToValueAtTime(peak, args.startTime + 0.008);
  gain.gain.setValueAtTime(peak, args.startTime + sustain);
  gain.gain.linearRampToValueAtTime(0, args.startTime + sustain + 0.06);

  src.connect(gain).connect(args.destination);
  src.start(args.startTime);
  src.stop(args.startTime + sustain + 0.08);
  return true;
}
