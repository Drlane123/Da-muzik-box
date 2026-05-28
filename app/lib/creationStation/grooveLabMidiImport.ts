/**
 * Import Standard MIDI Files into Groove Lab piano-roll hits + session BPM.
 * Mirrors Song Engine / Chord Builder SMF timing (480 PPQ, 4/4).
 */

import { parseMidi, type MidiEvent, type MidiHeader } from 'midi-file';
import type { MidiNoteEvent } from '@/app/lib/creationStation/midiExport';
import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';
import { grooveLabClampBassRootMidi, grooveLabClampChordRollMidi } from '@/app/lib/creationStation/grooveLabPitch';
import {
  GROOVE_LAB_SLOTS_PER_BAR,
  grooveLabSlotsPerCell,
  normalizeGrooveBarCount,
  snapGrooveSlot,
  snapGrooveSustain,
  type GrooveLabBarCount,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';

export const GROOVE_LAB_SMF_PPQ = 480;

/** Notes at C4 and below → bass lane; above → chord lane (matches split-channel workflow). */
export const GROOVE_LAB_MIDI_BASS_CEILING = 59;

export type GrooveLabMidiImportResult = {
  bpm: number;
  ticksPerQuarter: number;
  trackNames: string[];
  notes: MidiNoteEvent[];
  bassHits: GrooveRollHit[];
  chordHits: GrooveRollHit[];
  barCount: GrooveLabBarCount;
  fileName: string;
};

export type GrooveLabMidiImportError = {
  message: string;
};

function ticksPerQuarterFromHeader(header: MidiHeader): number {
  if (header.ticksPerBeat != null && header.ticksPerBeat > 0) return header.ticksPerBeat;
  return GROOVE_LAB_SMF_PPQ;
}

function bpmFromMicrosecondsPerBeat(micros: number): number {
  return clampGrooveLabBpm(Math.round(60_000_000 / Math.max(1, micros)));
}

type ActiveNote = { startTick: number; velocity: number; channel: number };

function collectMidiNotes(
  tracks: readonly (readonly MidiEvent[])[],
): { notes: MidiNoteEvent[]; bpm: number; trackNames: string[] } {
  const notes: MidiNoteEvent[] = [];
  const trackNames: string[] = [];
  let bpm = 120;

  for (const track of tracks) {
    const active = new Map<string, ActiveNote>();
    let tick = 0;
    for (const ev of track) {
      tick += Math.max(0, ev.deltaTime ?? 0);
      if (ev.type === 'setTempo' && 'microsecondsPerBeat' in ev) {
        bpm = bpmFromMicrosecondsPerBeat(ev.microsecondsPerBeat);
      }
      if (ev.type === 'trackName' && 'text' in ev && ev.text.trim()) {
        trackNames.push(ev.text.trim());
      }
      if (!('channel' in ev)) continue;
      const ch = ev.channel;
      if (ev.type === 'noteOn') {
        const vel = Math.max(1, Math.min(127, ev.velocity ?? 100));
        const note = Math.max(0, Math.min(127, ev.noteNumber ?? 0));
        if (vel === 0) {
          closeNote(active, ch, note, tick, notes);
        } else {
          const key = `${ch}:${note}`;
          const prev = active.get(key);
          if (prev) {
            pushNote(notes, prev, tick, ch, note);
          }
          active.set(key, { startTick: tick, velocity: vel, channel: ch });
        }
      } else if (ev.type === 'noteOff') {
        const note = Math.max(0, Math.min(127, ev.noteNumber ?? 0));
        closeNote(active, ch, note, tick, notes);
      }
    }
    for (const [key, activeNote] of active) {
      const [chStr, noteStr] = key.split(':');
      pushNote(notes, activeNote, tick, Number(chStr), Number(noteStr));
    }
  }

  return { notes, bpm, trackNames };
}

function closeNote(
  active: Map<string, ActiveNote>,
  channel: number,
  noteNumber: number,
  endTick: number,
  out: MidiNoteEvent[],
): void {
  const key = `${channel}:${noteNumber}`;
  const hit = active.get(key);
  if (!hit) return;
  pushNote(out, hit, endTick, channel, noteNumber);
  active.delete(key);
}

function pushNote(
  out: MidiNoteEvent[],
  hit: ActiveNote,
  endTick: number,
  channel: number,
  noteNumber: number,
): void {
  const duration = Math.max(1, endTick - hit.startTick);
  out.push({
    midi: noteNumber,
    startTick: hit.startTick,
    durationTicks: duration,
    velocity: hit.velocity,
    channel,
  });
}

function tickToSlot(tick: number, tpq: number, quantize: GrooveLabQuantize, barCount: number): number {
  const ticksPerBar = tpq * 4;
  const rawSlot = Math.round((tick / ticksPerBar) * GROOVE_LAB_SLOTS_PER_BAR);
  return snapGrooveSlot(rawSlot, quantize, barCount);
}

function durationTicksToSustain(
  durationTicks: number,
  slot: number,
  tpq: number,
  quantize: GrooveLabQuantize,
  barCount: number,
): number {
  const ticksPerBar = tpq * 4;
  const slotSpan = Math.max(
    grooveLabSlotsPerCell(quantize),
    Math.round((durationTicks / ticksPerBar) * GROOVE_LAB_SLOTS_PER_BAR),
  );
  return snapGrooveSustain(slot, slotSpan, quantize, barCount);
}

export function midiEventsToGrooveLabLayers(
  notes: readonly MidiNoteEvent[],
  opts: {
    quantize: GrooveLabQuantize;
    barCount: number;
    ticksPerQuarter?: number;
    bassCeilingMidi?: number;
  },
): { bassHits: GrooveRollHit[]; chordHits: GrooveRollHit[]; barCount: GrooveLabBarCount } {
  const tpq = opts.ticksPerQuarter ?? GROOVE_LAB_SMF_PPQ;
  const ceiling = opts.bassCeilingMidi ?? GROOVE_LAB_MIDI_BASS_CEILING;
  let maxTick = 0;
  const bassHits: GrooveRollHit[] = [];
  const chordHits: GrooveRollHit[] = [];

  for (const n of notes) {
    maxTick = Math.max(maxTick, n.startTick + n.durationTicks);
    const slot = tickToSlot(n.startTick, tpq, opts.quantize, opts.barCount);
    const sus = durationTicksToSustain(n.durationTicks, slot, tpq, opts.quantize, opts.barCount);
    const vel = Math.max(0.05, Math.min(1, (n.velocity ?? 100) / 127));
    const midi = Math.round(n.midi);
    const hit: GrooveRollHit = { slot, midi, sustainSlots: sus, vel };
    if (midi <= ceiling) {
      hit.midi = grooveLabClampBassRootMidi(midi);
      bassHits.push(hit);
    } else {
      hit.midi = grooveLabClampChordRollMidi(midi);
      chordHits.push(hit);
    }
  }

  const ticksPerBar = tpq * 4;
  const barsNeeded = Math.max(1, Math.ceil(maxTick / ticksPerBar));
  const barCount = normalizeGrooveBarCount(Math.max(opts.barCount, barsNeeded));

  return {
    bassHits: bassHits.map((h) => ({
      ...h,
      slot: snapGrooveSlot(h.slot, opts.quantize, barCount),
      sustainSlots: snapGrooveSustain(h.slot, h.sustainSlots, opts.quantize, barCount),
    })),
    chordHits: chordHits.map((h) => ({
      ...h,
      slot: snapGrooveSlot(h.slot, opts.quantize, barCount),
      sustainSlots: snapGrooveSustain(h.slot, h.sustainSlots, opts.quantize, barCount),
    })),
    barCount,
  };
}

export function parseGrooveLabMidiFile(
  data: ArrayBuffer,
  fileName: string,
  opts: { quantize: GrooveLabQuantize; barCount: number },
): GrooveLabMidiImportResult | GrooveLabMidiImportError {
  try {
    const bytes = new Uint8Array(data);
    const parsed = parseMidi(bytes);
    const tpq = ticksPerQuarterFromHeader(parsed.header);
    const { notes, bpm, trackNames } = collectMidiNotes(parsed.tracks);
    if (notes.length === 0) {
      return { message: 'No note events found in this MIDI file.' };
    }
    const { bassHits, chordHits, barCount } = midiEventsToGrooveLabLayers(notes, {
      quantize: opts.quantize,
      barCount: opts.barCount,
      ticksPerQuarter: tpq,
    });
    return {
      bpm,
      ticksPerQuarter: tpq,
      trackNames,
      notes,
      bassHits,
      chordHits,
      barCount,
      fileName,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { message: msg || 'Could not read MIDI file.' };
  }
}

export function isMidiFileName(name: string): boolean {
  return /\.(mid|midi)$/i.test(name);
}

export function isGrooveLabMidiImportError(
  r: GrooveLabMidiImportResult | GrooveLabMidiImportError,
): r is GrooveLabMidiImportError {
  return !('bpm' in r);
}
