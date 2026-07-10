/**
 * Beat Pads spread roll — MIDI / WAV export and SE2 note handoff.
 */
import type { BeatPadsSpreadDirection } from '@/app/lib/creationStation/beatPadsHitSpread';
import type { BeatPadsGridStepsPerBar } from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import {
  beatPadsSpreadPatternCols,
  beatPadsSpreadRowMidi,
  clampBeatPadsSpreadMixerChannel,
  type BeatPadsSpreadLoopBars,
  type BeatPadsSpreadNote,
  type BeatPadsSpreadVoice,
} from '@/app/lib/creationStation/beatPadsSpreadTrack';
import { playPadSampleBuffer } from '@/app/lib/creationStation/padSamplePlayback';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  buildStandardMidiFile,
  downloadBytes,
  safeFilename,
  type MidiNoteEvent,
} from '@/app/lib/creationStation/midiExport';
import { se2BeatPadsSpreadKeyLockSemiAtCol } from '@/app/lib/studio/se2BeatPadsSpreadHarmony';
import type { Se2BeatPadsSpreadSourceTrack } from '@/app/lib/studio/se2BeatPadsSpreadHarmony';
import {
  se2BeatPadsSpreadVoiceFromSession,
  type Se2BeatPadsTrackSession,
} from '@/app/lib/studio/se2BeatPadsTransportPlayback';
import type { Se2BeatPadsSpreadSnapshot } from '@/app/lib/studio/se2BeatPadsSpreadStore';

export type BeatPadsSpreadStudioNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

export type BeatPadsSpreadExportArgs = {
  notes: readonly BeatPadsSpreadNote[];
  rootMidi: number;
  direction: BeatPadsSpreadDirection;
  loopBars: BeatPadsSpreadLoopBars;
  stepsPerBar: BeatPadsGridStepsPerBar;
  beatsPerBar?: number;
  bpm: number;
  loopStartBeat?: number;
  velocity?: number;
  keyLockEnabled?: boolean;
  harmonyTrack?: Se2BeatPadsSpreadSourceTrack;
  songKeyRoot?: number;
  songKeyMode?: ChordMode;
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

export function beatPadsSpreadHasHits(notes: readonly BeatPadsSpreadNote[]): boolean {
  return notes.length > 0;
}

export function beatPadsSpreadToStudioNotes(args: BeatPadsSpreadExportArgs): BeatPadsSpreadStudioNote[] {
  if (!beatPadsSpreadHasHits(args.notes)) return [];

  const bpb = Math.max(1, args.beatsPerBar ?? 4);
  const loopBars = Math.max(1, Math.round(args.loopBars));
  const stepsPerBar = args.stepsPerBar;
  const cols = beatPadsSpreadPatternCols(loopBars, stepsPerBar);
  if (cols <= 0) return [];

  const spreadLoopBeats = loopBars * bpb;
  const stepBeats = spreadLoopBeats / cols;
  const durationBeats = Math.max(1 / 128, stepBeats * 0.92);
  const velocity = args.velocity ?? 100;
  const loopStart = Math.max(0, args.loopStartBeat ?? 0);
  const out: BeatPadsSpreadStudioNote[] = [];

  for (const note of args.notes) {
    for (let i = 0; i < note.len; i += 1) {
      const col = note.start + i;
      if (col < 0 || col >= cols) continue;
      const keyLockSemi = args.keyLockEnabled
        ? se2BeatPadsSpreadKeyLockSemiAtCol({
            voiceRootMidi: args.rootMidi,
            track: args.harmonyTrack,
            gridCol: col,
            stepsPerBar,
            loopBars,
            beatsPerBar: bpb,
            keyLockEnabled: true,
            songKeyRoot: args.songKeyRoot ?? 0,
            songKeyMode: args.songKeyMode ?? 'major',
          })
        : 0;
      const pitch = Math.max(
        0,
        Math.min(127, Math.round(beatPadsSpreadRowMidi(args.rootMidi, note.row, args.direction) + keyLockSemi)),
      );
      out.push({
        pitch,
        startBeat: loopStart + col * stepBeats,
        durationBeats,
        velocity,
      });
    }
  }

  out.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  return out;
}

export function beatPadsSpreadToMidiEvents(
  args: BeatPadsSpreadExportArgs,
  ticksPerQuarter = 480,
): MidiNoteEvent[] {
  const notes = beatPadsSpreadToStudioNotes({ ...args, loopStartBeat: 0 });
  return notes.map((n) => ({
    midi: n.pitch,
    startTick: Math.max(0, Math.round(n.startBeat * ticksPerQuarter)),
    durationTicks: Math.max(1, Math.round(n.durationBeats * ticksPerQuarter)),
    velocity: n.velocity,
    channel: 0,
  }));
}

export type BeatPadsSpreadAudioRenderArgs = BeatPadsSpreadExportArgs & {
  spread: Pick<
    Se2BeatPadsSpreadSnapshot,
    'sourcePad' | 'direction' | 'rootMidi' | 'baseLabel' | 'mixerChannel'
  >;
  session: Se2BeatPadsTrackSession;
  trackVolume127?: number;
};

export async function renderBeatPadsSpreadToAudioBuffer(
  args: BeatPadsSpreadAudioRenderArgs,
): Promise<AudioBuffer> {
  if (!beatPadsSpreadHasHits(args.notes)) {
    throw new Error('Nothing to export — paint spread notes first');
  }

  const bpm = Math.max(40, Math.min(240, args.bpm));
  const bpb = Math.max(1, args.beatsPerBar ?? 4);
  const loopBars = Math.max(1, Math.round(args.loopBars));
  const cols = beatPadsSpreadPatternCols(loopBars, args.stepsPerBar);
  if (cols <= 0) throw new Error('Nothing to export — empty spread roll');

  const padVoice = args.session.pads.get(args.spread.sourcePad);
  if (!padVoice) throw new Error('Spread source pad missing — reload the kit');

  const voice =
    se2BeatPadsSpreadVoiceFromSession(args.session, {
      ...args.spread,
      loopBars,
      stepsPerBar: args.stepsPerBar,
      notes: args.notes,
    }) ?? null;
  if (!voice) throw new Error('Spread source pad missing — reload the kit');

  const spreadLoopBeats = loopBars * bpb;
  const stepBeats = spreadLoopBeats / cols;
  const spb = 60 / bpm;
  const tailSec = 1.4;
  const totalSec = spreadLoopBeats * spb + tailSec;
  const sampleRate = 44100;
  const offline = new OfflineAudioContext(2, Math.ceil(totalSec * sampleRate), sampleRate);
  const bus = offline.createGain();
  bus.gain.value = 1;
  bus.connect(offline.destination);

  let hits = 0;
  const strikeSpread = (voiceArg: BeatPadsSpreadVoice, row: number, when: number, keyLockSemi: number) => {
    const strikeMidi = beatPadsSpreadRowMidi(voiceArg.rootMidi, row, voiceArg.direction);
    const detuneCents = (strikeMidi - voiceArg.rootMidi + keyLockSemi) * 100;
    playPadSampleBuffer(
      offline,
      voiceArg.buffer,
      clampBeatPadsSpreadMixerChannel(voiceArg.mixerChannel),
      100,
      when,
      { 1: args.trackVolume127 ?? 100 },
      1,
      undefined,
      voiceArg.sampler,
      true,
      voiceArg.fx,
      Math.max(1, bpm),
      false,
      detuneCents,
      { outputNode: bus, skipMeter: true },
    );
    hits += 1;
  };

  for (const note of args.notes) {
    for (let i = 0; i < note.len; i += 1) {
      const col = note.start + i;
      if (col < 0 || col >= cols) continue;
      const when = col * stepBeats * spb;
      const keyLockSemi = args.keyLockEnabled
        ? se2BeatPadsSpreadKeyLockSemiAtCol({
            voiceRootMidi: voice.rootMidi,
            track: args.harmonyTrack,
            gridCol: col,
            stepsPerBar: args.stepsPerBar,
            loopBars,
            beatsPerBar: bpb,
            keyLockEnabled: true,
            songKeyRoot: args.songKeyRoot ?? 0,
            songKeyMode: args.songKeyMode ?? 'major',
          })
        : 0;
      strikeSpread(voice, note.row, when, keyLockSemi);
    }
  }

  if (hits === 0) throw new Error('Nothing to export — paint spread notes first');

  const rendered = await offline.startRendering();
  const mono = rendered.getChannelData(0);
  const ch1 = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : mono;
  const mix = new Float32Array(mono.length);
  for (let i = 0; i < mix.length; i += 1) {
    mix[i] = (mono[i]! + ch1[i]!) * 0.5;
  }

  const outCtx = new OfflineAudioContext(1, mix.length, sampleRate);
  const buf = outCtx.createBuffer(1, mix.length, sampleRate);
  buf.copyToChannel(mix, 0);
  return buf;
}

export async function downloadBeatPadsSpreadMidiFile(
  args: BeatPadsSpreadExportArgs & { filenameBase: string },
): Promise<void> {
  const events = beatPadsSpreadToMidiEvents(args);
  if (events.length === 0) throw new Error('Nothing to export — paint spread notes first');
  const bytes = buildStandardMidiFile({
    notes: events,
    bpm: args.bpm,
    trackName: args.filenameBase,
  });
  const base = safeFilename(args.filenameBase, 'SpreadRoll');
  downloadBytes(bytes, `${base}.mid`, 'audio/midi');
}

export async function downloadBeatPadsSpreadWav(
  args: BeatPadsSpreadAudioRenderArgs & { filenameBase: string },
): Promise<void> {
  const buffer = await renderBeatPadsSpreadToAudioBuffer(args);
  const wavBytes = encodeWavPcm16(buffer.getChannelData(0), buffer.sampleRate);
  const base = safeFilename(args.filenameBase, 'SpreadRoll');
  downloadBytes(wavBytes, `${base}.wav`, 'audio/wav');
}
