/**
 * Standard MIDI File (SMF) encoder for the Chord Builder "Save MIDI" path.
 *
 * Emits a **Format 0** SMF (single track, all events merged) at 480 ticks
 * per quarter note. That format opens cleanly in every DAW we know about
 * (Logic, FL, Ableton, Cubase, Reaper, Studio One, etc.) and is the
 * smallest, most portable shape for a piano-style chord export.
 *
 * The track always starts with three meta events at tick 0:
 *   • `FF 03 …` — track name (label string the caller provides)
 *   • `FF 51 03 tttttt` — tempo, derived from `bpm`
 *   • `FF 58 04 04 02 18 08` — 4/4 time signature
 *
 * Notes are then emitted as paired `90/80` (note-on / note-off) on
 * channel 0 with a fixed velocity. Sort order at the same tick keeps
 * note-offs **before** note-ons so back-to-back notes on the same pitch
 * release cleanly before the re-trigger.
 *
 * Reference: https://www.midi.org/midi/specifications-old/item/standard-midi-files-smf
 */

export interface MidiNoteEvent {
  /** Pitch (0..127). 60 = middle C. */
  midi: number;
  /** Start time in ticks from start of song (tick 0). */
  startTick: number;
  /** Duration in ticks. Must be ≥ 1 — zero-length notes are dropped. */
  durationTicks: number;
  /** 1..127. Defaults to 100 if omitted. */
  velocity?: number;
  /** 0..15. Defaults to 0. */
  channel?: number;
}

export interface SmfBuildArgs {
  notes: ReadonlyArray<MidiNoteEvent>;
  /** Tempo in beats per minute. Stored as a Set-Tempo meta event. */
  bpm: number;
  /** Pulses-per-quarter (i.e. ticks per quarter note). Default 480. */
  ticksPerQuarter?: number;
  /** Optional track name (meta event FF 03). Encoded as UTF-8. */
  trackName?: string;
}

/** Build a complete SMF byte buffer ready to download / decodeAudioData. */
export function buildStandardMidiFile(args: SmfBuildArgs): Uint8Array {
  const tpq = args.ticksPerQuarter ?? 480;
  const microsPerQuarter = Math.max(
    1,
    Math.round(60_000_000 / Math.max(1, args.bpm)),
  );

  // Each entry is an absolute-time event awaiting delta-encoding.
  //
  // `order` is the original insertion index — used as the stable secondary
  // sort key after `tick`. We deliberately push note-offs BEFORE note-ons
  // at the same source tick so re-triggers release the previous note
  // first (avoids stuck-note artifacts in some DAWs).
  type AbsoluteEvent = { tick: number; order: number; bytes: number[] };
  const events: AbsoluteEvent[] = [];
  let orderCounter = 0;

  events.push({
    tick: 0,
    order: orderCounter++,
    bytes: [
      0xff, 0x51, 0x03,
      (microsPerQuarter >> 16) & 0xff,
      (microsPerQuarter >> 8) & 0xff,
      microsPerQuarter & 0xff,
    ],
  });
  events.push({
    tick: 0,
    order: orderCounter++,
    bytes: [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08], // 4/4
  });
  if (args.trackName) {
    const nameBytes = Array.from(new TextEncoder().encode(args.trackName));
    // FF 03 <len> <text>. `len` is a VLQ for the meta-event length field.
    const lenVlq = encodeVlq(nameBytes.length);
    events.push({
      tick: 0,
      order: orderCounter++,
      bytes: [0xff, 0x03, ...lenVlq, ...nameBytes],
    });
  }

  for (const n of args.notes) {
    const note = clampInt(n.midi, 0, 127);
    if (note < 0) continue;
    const vel = clampInt(n.velocity ?? 100, 1, 127);
    const ch = clampInt(n.channel ?? 0, 0, 15);
    const dur = Math.max(1, Math.floor(n.durationTicks));
    const start = Math.max(0, Math.floor(n.startTick));
    // Note off uses a HIGHER order than the matching note-on of the same
    // tick, but at the *end* tick we want the off to fire first if the
    // next note-on lands on the same tick. We split the two events into
    // separate orderings: note-on gets the next counter, note-off uses
    // `Number.MIN_SAFE_INTEGER + counter` so it sorts before all on-events
    // at the same tick.
    const noteOnOrder = orderCounter++;
    const noteOffOrder = -orderCounter; // negative → sorts earlier among same-tick events
    events.push({
      tick: start,
      order: noteOnOrder,
      bytes: [0x90 | ch, note, vel],
    });
    events.push({
      tick: start + dur,
      order: noteOffOrder,
      bytes: [0x80 | ch, note, 0],
    });
  }

  events.sort((a, b) => (a.tick !== b.tick ? a.tick - b.tick : a.order - b.order));

  // Encode the track as delta-time + event bytes, then add the End-of-Track meta.
  const track: number[] = [];
  let lastTick = 0;
  for (const ev of events) {
    const delta = Math.max(0, ev.tick - lastTick);
    track.push(...encodeVlq(delta));
    track.push(...ev.bytes);
    lastTick = ev.tick;
  }
  track.push(0x00, 0xff, 0x2f, 0x00); // End of Track

  // Assemble the file: MThd (header) + MTrk (track).
  const out = new Uint8Array(14 + 8 + track.length);
  let p = 0;
  // MThd
  out[p++] = 0x4d; out[p++] = 0x54; out[p++] = 0x68; out[p++] = 0x64;
  // header chunk length = 6
  out[p++] = 0; out[p++] = 0; out[p++] = 0; out[p++] = 6;
  // format = 0
  out[p++] = 0; out[p++] = 0;
  // tracks = 1
  out[p++] = 0; out[p++] = 1;
  // division (ticks/quarter, MSB clear → metrical timing)
  out[p++] = (tpq >> 8) & 0xff; out[p++] = tpq & 0xff;
  // MTrk
  out[p++] = 0x4d; out[p++] = 0x54; out[p++] = 0x72; out[p++] = 0x6b;
  const tl = track.length;
  out[p++] = (tl >> 24) & 0xff;
  out[p++] = (tl >> 16) & 0xff;
  out[p++] = (tl >> 8) & 0xff;
  out[p++] = tl & 0xff;
  for (let i = 0; i < track.length; i++) out[p++] = track[i]! & 0xff;
  return out;
}

/** Encode a non-negative integer as a MIDI variable-length quantity (VLQ). */
function encodeVlq(value: number): number[] {
  let v = Math.max(0, Math.floor(value));
  const result: number[] = [v & 0x7f];
  v >>= 7;
  while (v > 0) {
    result.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return result;
}

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  const v = Math.round(n);
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

/**
 * Trigger a browser download of `bytes` with the given filename + MIME.
 * Uses a synthetic anchor tag — works in every browser without needing
 * the experimental File System Access API, no user-gesture warning, and
 * picks up the user's default Downloads folder.
 */
export function downloadBytes(bytes: Uint8Array, filename: string, mime: string): void {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Defer revoke so Chrome / Safari have time to start the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}

/** Sanitize a label so it works as a filename across OSes. */
export function safeFilename(label: string, fallback: string = 'ChordBuilder'): string {
  const cleaned = label
    .replace(/[^a-zA-Z0-9 ._·-]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned.length > 0 ? cleaned : fallback;
}
