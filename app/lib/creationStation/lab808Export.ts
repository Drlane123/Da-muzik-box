/**
 * 808 Lab — MIDI / WAV / Beat Lab pad export (Kick/Bass roll + Drum Kits step roll).
 */

import {
  playEightZeroEight,
  type EightZeroEightPresetDef,
  type Lab808FilterFx,
  type Lab808SoundLane,
} from '@/app/lib/creationStation/eightZeroEightVoice';
import {
  buildStandardMidiFile,
  downloadBytes,
  safeFilename,
  type MidiNoteEvent,
} from '@/app/lib/creationStation/midiExport';
import {
  ensureLabMpcKitLoaded,
  playLabMpcPad,
  type LabMpcKitId,
} from '@/app/lib/creationStation/labMpcKits';
import { getSharedAudioOutput } from '@/app/lib/creationStation/sharedAudioOutput';

const TICKS_PER_QUARTER = 480;

export type Lab808ToneExportNote = {
  startBeat: number;
  midi: number;
  durBeats: number;
  velocity01?: number;
};

export type Lab808DrumExportSnapshot = {
  pattern: boolean[][];
  kitId: LabMpcKitId;
  bpm: number;
  stepsPerBar: number;
  barCount: number;
  masterLevel: number;
  padFx: {
    tuneSemi: readonly number[];
    lpCutoffHz: readonly number[];
    drive: readonly number[];
    level: readonly number[];
  };
  bankSlot: 'A' | 'B';
};

export type Lab808ToneRenderOpts = {
  bpm: number;
  preset: EightZeroEightPresetDef;
  soundLane: Lab808SoundLane;
  gain: number;
  filterFx: Lab808FilterFx;
  trackName?: string;
};

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

export function lab808PatternHasHits(pattern: readonly (readonly boolean[])[]): boolean {
  for (const row of pattern) {
    for (const on of row) {
      if (on) return true;
    }
  }
  return false;
}

export function lab808ToneNotesToMidiEvents(notes: readonly Lab808ToneExportNote[]): MidiNoteEvent[] {
  const out: MidiNoteEvent[] = [];
  for (const n of notes) {
    const midi = Math.round(n.midi);
    if (!Number.isFinite(midi)) continue;
    out.push({
      midi,
      startTick: Math.max(0, Math.round(n.startBeat * TICKS_PER_QUARTER)),
      durationTicks: Math.max(1, Math.round(n.durBeats * TICKS_PER_QUARTER * 0.92)),
      velocity: Math.max(
        1,
        Math.min(127, Math.round((n.velocity01 ?? 0.88) * 127)),
      ),
      channel: 0,
    });
  }
  return out;
}

/** GM drum map — one note per MPC row (channel 10 in DAWs). */
const LAB808_DRUM_ROW_GM: readonly number[] = [
  36, 38, 42, 46, 49, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61,
];

export function lab808DrumSnapshotToMidiEvents(snapshot: Lab808DrumExportSnapshot): MidiNoteEvent[] {
  const { pattern, stepsPerBar, barCount, bpm } = snapshot;
  const steps = Math.max(1, barCount * stepsPerBar);
  const cols = Math.min(steps, pattern[0]?.length ?? 0);
  const stepBeats = 4 / Math.max(1, stepsPerBar);
  const out: MidiNoteEvent[] = [];
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < pattern.length; row++) {
      if (!pattern[row]?.[col]) continue;
      const startBeat = col * stepBeats;
      out.push({
        midi: LAB808_DRUM_ROW_GM[row] ?? 36 + row,
        startTick: Math.max(0, Math.round(startBeat * TICKS_PER_QUARTER)),
        durationTicks: Math.max(1, Math.round(stepBeats * TICKS_PER_QUARTER * 0.75)),
        velocity: 100,
        channel: 9,
      });
    }
  }
  if (out.length === 0) return out;
  void bpm;
  return out;
}

export function buildLab808ToneMidiFile(
  notes: readonly Lab808ToneExportNote[],
  opts: Lab808ToneRenderOpts,
): Uint8Array {
  return buildStandardMidiFile({
    notes: lab808ToneNotesToMidiEvents(notes),
    bpm: opts.bpm,
    ticksPerQuarter: TICKS_PER_QUARTER,
    trackName: opts.trackName ?? `808 Lab ${opts.soundLane}`,
  });
}

export function buildLab808DrumMidiFile(
  snapshot: Lab808DrumExportSnapshot,
  trackName?: string,
): Uint8Array {
  return buildStandardMidiFile({
    notes: lab808DrumSnapshotToMidiEvents(snapshot),
    bpm: snapshot.bpm,
    ticksPerQuarter: TICKS_PER_QUARTER,
    trackName: trackName ?? `808 Lab Drums ${snapshot.bankSlot}`,
  });
}

export function downloadLab808ToneMidi(
  notes: readonly Lab808ToneExportNote[],
  opts: Lab808ToneRenderOpts,
  filenameBase: string,
): void {
  const bytes = buildLab808ToneMidiFile(notes, opts);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadBytes(
    bytes,
    safeFilename(`${filenameBase}_${opts.bpm}bpm_${stamp}.mid`, '808Lab_KickBass'),
    'audio/midi',
  );
}

export function downloadLab808DrumMidi(
  snapshot: Lab808DrumExportSnapshot,
  filenameBase: string,
): void {
  const bytes = buildLab808DrumMidiFile(snapshot);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadBytes(
    bytes,
    safeFilename(`${filenameBase}_${snapshot.bpm}bpm_${stamp}.mid`, '808Lab_Drums'),
    'audio/midi',
  );
}

export async function renderLab808ToneToWav(
  notes: readonly Lab808ToneExportNote[],
  opts: Lab808ToneRenderOpts,
): Promise<Uint8Array> {
  if (notes.length === 0) throw new Error('No notes to export');

  const bpm = Math.max(1, opts.bpm);
  const secPerBeat = 60 / bpm;
  let endSec = 0;
  for (const n of notes) {
    endSec = Math.max(endSec, (n.startBeat + n.durBeats) * secPerBeat);
  }
  const totalSec = Math.max(1.5, endSec + 1.2);
  const sr = 44100;
  const offline = new OfflineAudioContext(1, Math.ceil(totalSec * sr), sr);
  void getSharedAudioOutput(offline);

  for (const n of notes) {
    const when = Math.max(0, n.startBeat * secPerBeat);
    playEightZeroEight(offline, when, n.midi, opts.preset, opts.gain, {
      holdBeats: n.durBeats,
      bpm,
      kickKeyboardMap: true,
      kickMonophonic: opts.soundLane === 'kick',
      velocity01: n.velocity01 ?? 0.88,
      soundLane: opts.soundLane,
      filterFx: opts.filterFx,
    });
  }

  const rendered = await offline.startRendering();
  return encodeWavPcm16(rendered.getChannelData(0), sr);
}

export async function renderLab808DrumsToWav(snapshot: Lab808DrumExportSnapshot): Promise<Uint8Array> {
  if (!lab808PatternHasHits(snapshot.pattern)) throw new Error('No drum hits to export');

  const bpm = Math.max(1, snapshot.bpm);
  const spb = Math.max(1, snapshot.stepsPerBar);
  const steps = Math.max(1, snapshot.barCount * spb);
  const cols = Math.min(steps, snapshot.pattern[0]?.length ?? 0);
  const stepSec = 240 / (bpm * spb);
  const totalSec = Math.max(1.5, cols * stepSec + 1.5);
  const sr = 44100;
  const offline = new OfflineAudioContext(1, Math.ceil(totalSec * sr), sr);
  const slot = ensureLabMpcKitLoaded(snapshot.kitId, offline);
  await slot.readyPromise;
  void getSharedAudioOutput(offline);

  const fx = snapshot.padFx;
  for (let col = 0; col < cols; col++) {
    const when = col * stepSec;
    for (let row = 0; row < snapshot.pattern.length; row++) {
      if (!snapshot.pattern[row]?.[col]) continue;
      playLabMpcPad(offline, snapshot.kitId, row, when, 0.95, {
        tuneSemi: fx.tuneSemi[row] ?? 0,
        lpCutoffHz: fx.lpCutoffHz[row] ?? 20000,
        drive: fx.drive[row] ?? 0,
        level: (fx.level[row] ?? 1) * snapshot.masterLevel,
      });
    }
  }

  const rendered = await offline.startRendering();
  return encodeWavPcm16(rendered.getChannelData(0), sr);
}

export async function downloadLab808ToneWav(
  notes: readonly Lab808ToneExportNote[],
  opts: Lab808ToneRenderOpts,
  filenameBase: string,
): Promise<void> {
  const wav = await renderLab808ToneToWav(notes, opts);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadBytes(
    wav,
    safeFilename(`${filenameBase}_${opts.bpm}bpm_${stamp}.wav`, '808Lab_KickBass'),
    'audio/wav',
  );
}

export async function downloadLab808DrumWav(
  snapshot: Lab808DrumExportSnapshot,
  filenameBase: string,
): Promise<void> {
  const wav = await renderLab808DrumsToWav(snapshot);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadBytes(
    wav,
    safeFilename(`${filenameBase}_${snapshot.bpm}bpm_${stamp}.wav`, '808Lab_Drums'),
    'audio/wav',
  );
}
