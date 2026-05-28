/**
 * Export Groove Lab chord rolls / progressions as MIDI or rendered WAV.
 */

import { GROOVE_LAB_CHORD_MIX_GAIN } from '@/app/lib/creationStation/grooveLabLayers';
import {
  buildStandardMidiFile,
  downloadBytes,
  safeFilename,
  type MidiNoteEvent,
} from '@/app/lib/creationStation/midiExport';
import {
  progressionStepsToGrooveHits,
  type GrooveProgressionStep,
} from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { scheduleOrchidChord, type OrchidPerformanceMode } from '@/app/lib/creationStation/orchidChordEngine';
import type { ChordVoiceId } from '@/app/lib/creationStation/chordSequencerVoices';
import { getSharedAudioOutput } from '@/app/lib/creationStation/sharedAudioOutput';
import {
  GROOVE_LAB_SLOTS_PER_BAR,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';
import { grooveLabSecPerSlot } from '@/app/lib/creationStation/grooveLabTransport';

const TICKS_PER_QUARTER = 480;
const SLOTS_PER_BEAT = GROOVE_LAB_SLOTS_PER_BAR / 4;

export type GrooveChordExportOpts = {
  bpm: number;
  chordVoice: ChordVoiceId;
  chordVolume: number;
  perfMode: OrchidPerformanceMode;
  trackName?: string;
};

function ticksPerSlot(): number {
  return TICKS_PER_QUARTER / SLOTS_PER_BEAT;
}

export function grooveRollHitsToMidiNotes(hits: readonly GrooveRollHit[]): MidiNoteEvent[] {
  const tps = ticksPerSlot();
  const notes: MidiNoteEvent[] = [];
  for (const h of hits) {
    const midi = Math.round(h.midi);
    if (!Number.isFinite(midi)) continue;
    notes.push({
      midi,
      startTick: Math.max(0, Math.round(h.slot * tps)),
      durationTicks: Math.max(1, Math.round(h.sustainSlots * tps * 0.92)),
      velocity: Math.max(1, Math.min(127, Math.round((h.vel ?? 0.88) * 127))),
      channel: 0,
    });
  }
  return notes;
}

export function buildGrooveChordMidiFile(
  hits: readonly GrooveRollHit[],
  opts: GrooveChordExportOpts,
): Uint8Array {
  return buildStandardMidiFile({
    notes: grooveRollHitsToMidiNotes(hits),
    bpm: opts.bpm,
    ticksPerQuarter: TICKS_PER_QUARTER,
    trackName: opts.trackName ?? 'Groove Lab Chords',
  });
}

export function progressionStepsToChordHits(
  steps: readonly GrooveProgressionStep[],
  quantize: GrooveLabQuantize,
  barCount: number,
  sustainSlots: number,
): GrooveRollHit[] | { message: string } {
  const built = progressionStepsToGrooveHits(steps, {
    quantize,
    barCount,
    sustainSlots,
  });
  if ('message' in built) return built;
  return built.chordHits;
}

function encodeWavPcm16(pcm: Float32Array, sampleRate: number): Uint8Array {
  const out = new Uint8Array(44 + pcm.length * 2);
  const dv = new DataView(out.buffer);
  const ws = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i));
  };
  ws(0, 'RIFF');
  dv.setUint32(4, 36 + pcm.length * 2, true);
  ws(8, 'WAVE');
  ws(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  ws(36, 'data');
  dv.setUint32(40, pcm.length * 2, true);
  let o = 44;
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]!));
    dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    o += 2;
  }
  return out;
}

/** Offline render green chord hits with the current Groove chord voice. */
export async function renderGrooveChordHitsToWav(
  hits: readonly GrooveRollHit[],
  opts: GrooveChordExportOpts,
): Promise<Uint8Array> {
  if (hits.length === 0) throw new Error('No chord notes to export');

  const secPerSlot = grooveLabSecPerSlot(opts.bpm);
  let endSec = 0;
  const bySlot = new Map<number, { midis: number[]; sustainSlots: number; vel: number }>();
  for (const h of hits) {
    const slot = Math.round(h.slot);
    const midi = Math.round(h.midi);
    const list = bySlot.get(slot);
    if (!list) {
      bySlot.set(slot, {
        midis: [midi],
        sustainSlots: h.sustainSlots,
        vel: h.vel ?? 0.88,
      });
    } else {
      if (!list.midis.includes(midi)) list.midis.push(midi);
      list.sustainSlots = Math.max(list.sustainSlots, h.sustainSlots);
      list.vel = Math.max(list.vel, h.vel ?? 0.88);
    }
    endSec = Math.max(endSec, (slot + h.sustainSlots) * secPerSlot);
  }

  const totalSec = Math.max(1.5, endSec + 0.8);
  const sr = 44100;
  const offline = new OfflineAudioContext(1, Math.ceil(totalSec * sr), sr);
  const vol = opts.chordVolume * GROOVE_LAB_CHORD_MIX_GAIN;

  for (const [slot, group] of [...bySlot.entries()].sort((a, b) => a[0] - b[0])) {
    const when = slot * secPerSlot;
    const sustainSec = Math.max(0.25, group.sustainSlots * secPerSlot * 0.92);
    scheduleOrchidChord(offline, group.midis, when, sustainSec, opts.chordVoice, vol * group.vel, {
      mode: opts.perfMode,
      bpm: opts.bpm,
    });
  }

  void getSharedAudioOutput(offline);
  const rendered = await offline.startRendering();
  return encodeWavPcm16(rendered.getChannelData(0), sr);
}

export function downloadGrooveChordMidi(
  hits: readonly GrooveRollHit[],
  opts: GrooveChordExportOpts,
  filenameBase: string,
): void {
  const bytes = buildGrooveChordMidiFile(hits, opts);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadBytes(
    bytes,
    safeFilename(`${filenameBase}_${opts.bpm}bpm_${stamp}.mid`, 'GrooveLab_Chords'),
    'audio/midi',
  );
}

export async function downloadGrooveChordWav(
  hits: readonly GrooveRollHit[],
  opts: GrooveChordExportOpts,
  filenameBase: string,
): Promise<void> {
  const wav = await renderGrooveChordHitsToWav(hits, opts);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadBytes(
    wav,
    safeFilename(`${filenameBase}_${opts.bpm}bpm_${stamp}.wav`, 'GrooveLab_Chords'),
    'audio/wav',
  );
}
