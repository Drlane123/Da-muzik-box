/**
 * Geno Ultra ARP — flatten pattern to notes; export MIDI + WAV.
 */
import {
  buildStandardMidiFile,
  downloadBytes,
  safeFilename,
  type MidiNoteEvent,
} from '@/app/lib/creationStation/midiExport';
import {
  genoUltraArpHarmonyFromSnapshot,
  genoUltraArpPitchForGridCol,
  genoUltraArpPitchSpreadFromSnapshot,
  genoUltraArpTotalPatternBeats,
} from '@/app/lib/studio/genoUltraArpChordPitch';
import type { GenoArpChordType } from '@/app/lib/studio/genoUltraArpHarmony';
import {
  genoArpActiveRowsAtStep,
  genoArpLaneLevelToVelocity,
  genoArpPlaybackCols,
  genoArpPlaybackStepToGridCol,
  genoArpGateSecForStep,
  genoArpStepMs,
  genoArpSwingDelayMs,
  genoArpTotalOctShiftForGridCol,
} from '@/app/lib/studio/genoUltraArpPattern';
import { clampGenoUltraArpBpm, type GenoUltraArpSnapshot } from '@/app/lib/studio/genoUltraArpState';
import { applyGenoUltraArpDryVoice } from '@/app/lib/studio/genoUltraArpDryVoices';
import { scheduleGenoUltraSynthNote } from '@/app/lib/studio/genoUltraSynthEngine';
import type { GenoUltraSynthVoiceParams } from '@/app/lib/studio/genoUltraSynthTypes';
import {
  studioConvertMidiNotesToKey,
  studioKeysMatch,
} from '@/app/lib/studio/studioMidiKeyConvert';
import type { NeuralHumScaleId } from '@/app/lib/vocalLab/neuralHumKeyLock';
import {
  studioKeyLabel,
  type StudioDetectedKeyMode,
} from '@/app/lib/studio/studioAudioClipAnalysis';

export type GenoUltraArpSongKey = {
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
};

export type GenoUltraArpFlatNote = {
  midi: number;
  startSec: number;
  durationSec: number;
  velocity: number;
};

/** SE2 piano-roll note row — beats + MIDI pitch (same shape as MockMidiNote). */
export type GenoUltraArpSe2RollNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

const SMF_PPQ = 480;

function stepDurationSec(bpm: number, rateIdx: number, stepIndex: number, swing: number): number {
  const stepMs = genoArpStepMs(bpm, rateIdx);
  return (stepMs + genoArpSwingDelayMs(stepMs, swing, stepIndex)) / 1000;
}

function monoRowForGridCol(grid: boolean[][], gridCol: number): number | null {
  const rows = genoArpActiveRowsAtStep(grid, gridCol);
  if (!rows.length) return null;
  return rows[0] ?? null;
}

/** Flatten arp grid — mirrors preview scheduler (mono, one note per step). */
export function flattenGenoUltraArpPattern(
  snap: Pick<
    GenoUltraArpSnapshot,
    | 'grid'
    | 'barLength'
    | 'rateIdx'
    | 'gate'
    | 'swing'
    | 'octShift'
    | 'barOctShifts'
    | 'velLevels'
    | 'basePitch'
    | 'chordTimeline'
    | 'keyRoot'
    | 'keyMode'
    | 'arpScaleId'
    | 'arpChordType'
    | 'octRange'
    | 'orderInversion'
  >,
  bpm: number,
): GenoUltraArpFlatNote[] {
  const cols = genoArpPlaybackCols(snap.barLength, snap.rateIdx);
  const out: GenoUltraArpFlatNote[] = [];
  const harmony = genoUltraArpHarmonyFromSnapshot(snap);
  const spread = genoUltraArpPitchSpreadFromSnapshot(snap);
  let t = 0;

  for (let step = 0; step < cols; step += 1) {
    const stepDur = stepDurationSec(bpm, snap.rateIdx, step, snap.swing);
    const gridCol = genoArpPlaybackStepToGridCol(step, snap.barLength, snap.rateIdx);
    const row = monoRowForGridCol(snap.grid, gridCol);
    if (row != null) {
      const totalOct = genoArpTotalOctShiftForGridCol(gridCol, snap.octShift, snap.barOctShifts);
      const pitch = genoUltraArpPitchForGridCol(
        snap.basePitch,
        row,
        totalOct,
        snap.barLength,
        harmony,
        gridCol,
        spread,
      );
      const velLevel = snap.velLevels[gridCol] ?? 0.82;
      const velocity = genoArpLaneLevelToVelocity(velLevel);
      const gateSec = genoArpGateSecForStep(stepDur, snap.gate);
      out.push({ midi: pitch, startSec: t, durationSec: gateSec, velocity });
    }
    t += stepDur;
  }

  return out;
}

/** Transpose flattened arp notes into the SE2 song key (scale-snapped). */
export function flattenGenoUltraArpPatternInSongKey(
  snap: Pick<
    GenoUltraArpSnapshot,
    | 'grid'
    | 'barLength'
    | 'rateIdx'
    | 'gate'
    | 'swing'
    | 'octShift'
    | 'barOctShifts'
    | 'velLevels'
    | 'basePitch'
    | 'chordTimeline'
    | 'keyRoot'
    | 'keyMode'
    | 'arpScaleId'
    | 'arpChordType'
  >,
  bpm: number,
  songKey: GenoUltraArpSongKey,
): GenoUltraArpFlatNote[] {
  const raw = flattenGenoUltraArpPattern(snap, bpm);
  const from = { keyRoot: snap.keyRoot, keyMode: snap.keyMode };
  const to = { keyRoot: songKey.keyRoot, keyMode: songKey.keyMode };
  if (raw.length === 0 || studioKeysMatch(from, to)) return raw;
  return studioConvertMidiNotesToKey(
    raw.map((n) => ({ ...n, pitch: n.midi })),
    from.keyRoot,
    from.keyMode,
    to.keyRoot,
    to.keyMode,
  ).map((n) => ({
    midi: n.pitch,
    startSec: n.startSec,
    durationSec: n.durationSec,
    velocity: n.velocity,
  }));
}

/** Flatten ARP pattern into SE2 piano-roll notes (song-key transposed, beat timing). */
export function genoUltraArpSnapshotToSe2RollNotes(
  snap: GenoUltraArpSnapshot,
  bpm: number,
  songKey: GenoUltraArpSongKey,
): GenoUltraArpSe2RollNote[] {
  const flat = flattenGenoUltraArpPatternInSongKey(snap, bpm, songKey);
  const minDurBeats = 1 / 64;
  return flat
    .map((n) => ({
      pitch: Math.max(0, Math.min(127, Math.round(n.midi))),
      startBeat: (n.startSec * bpm) / 60,
      durationBeats: Math.max(minDurBeats, (n.durationSec * bpm) / 60),
      velocity: Math.max(1, Math.min(127, Math.round(n.velocity))),
    }))
    .sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

export function genoUltraArpExportTrackLabel(
  snap: Pick<GenoUltraArpSnapshot, 'chordLabel'>,
  songKey: GenoUltraArpSongKey,
  fallback = 'GenoUltraArp',
): string {
  const base = snap.chordLabel?.trim() || fallback;
  return `${base} (${studioKeyLabel(songKey.keyRoot, songKey.keyMode)})`;
}

export function genoUltraArpPatternDurationSec(
  snap: Pick<GenoUltraArpSnapshot, 'barLength' | 'rateIdx' | 'swing'>,
  bpm: number,
): number {
  const cols = genoArpPlaybackCols(snap.barLength, snap.rateIdx);
  let t = 0;
  for (let i = 0; i < cols; i += 1) {
    t += stepDurationSec(bpm, snap.rateIdx, i, snap.swing);
  }
  return t;
}

function flatNotesToSmf(notes: readonly GenoUltraArpFlatNote[], bpm: number, trackName: string): Uint8Array {
  const smfNotes: MidiNoteEvent[] = notes.map((n) => ({
    midi: n.midi,
    startTick: Math.max(0, Math.round((n.startSec * bpm) / 60 * SMF_PPQ)),
    durationTicks: Math.max(1, Math.round((n.durationSec * bpm) / 60 * SMF_PPQ)),
    velocity: n.velocity,
    channel: 0,
  }));
  return buildStandardMidiFile({ notes: smfNotes, bpm, ticksPerQuarter: SMF_PPQ, trackName });
}

export function exportGenoUltraArpMidi(
  snap: GenoUltraArpSnapshot,
  bpm: number,
  songKey: GenoUltraArpSongKey,
  filenameLabel?: string,
): Uint8Array {
  const notes = flattenGenoUltraArpPatternInSongKey(snap, bpm, songKey);
  if (!notes.length) throw new Error('Nothing to export — enable at least one arp step.');
  const label = genoUltraArpExportTrackLabel(snap, songKey, filenameLabel?.trim() || 'GenoUltraArp');
  return flatNotesToSmf(notes, bpm, label);
}

export function downloadGenoUltraArpMidi(
  snap: GenoUltraArpSnapshot,
  bpm: number,
  songKey: GenoUltraArpSongKey,
  filenameLabel?: string,
): void {
  const bytes = exportGenoUltraArpMidi(snap, bpm, songKey, filenameLabel);
  const base = safeFilename(
    genoUltraArpExportTrackLabel(snap, songKey, filenameLabel ?? 'GenoUltraArp'),
    'GenoUltraArp',
  );
  downloadBytes(bytes, `${base}.mid`, 'audio/midi');
}

function encodeWavMono16(samples: Float32Array, sampleRate: number): Uint8Array {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buf);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, n * 2, true);
  let off = 44;
  for (let i = 0; i < n; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Uint8Array(buf);
}

export async function exportGenoUltraArpWav(
  snap: GenoUltraArpSnapshot,
  voice: GenoUltraSynthVoiceParams,
  bpm: number,
  songKey: GenoUltraArpSongKey,
  sampleRate = 44100,
): Promise<{ wavBytes: Uint8Array; durationSec: number }> {
  const notes = flattenGenoUltraArpPatternInSongKey(snap, bpm, songKey);
  if (!notes.length) throw new Error('Nothing to render — enable at least one arp step.');

  const patternSec = genoUltraArpPatternDurationSec(snap, bpm);
  const tailSec = 0.35;
  const totalSec = patternSec + tailSec;
  const totalFrames = Math.max(1, Math.ceil(totalSec * sampleRate));
  const offline = new OfflineAudioContext(1, totalFrames, sampleRate);
  const bus = offline.createGain();
  bus.gain.value = 1;
  bus.connect(offline.destination);

  const dryVoice = applyGenoUltraArpDryVoice(voice);
  for (const n of notes) {
    scheduleGenoUltraSynthNote(offline, {
      when: n.startSec,
      durationSec: n.durationSec,
      midi: n.midi,
      velocity: n.velocity,
      voice: dryVoice,
      stripOutput: bus,
      bpm,
      transportLite: true,
    });
  }

  const rendered = await offline.startRendering();
  const wavBytes = encodeWavMono16(rendered.getChannelData(0), sampleRate);
  return { wavBytes, durationSec: totalSec };
}

export async function downloadGenoUltraArpWav(
  snap: GenoUltraArpSnapshot,
  voice: GenoUltraSynthVoiceParams,
  bpm: number,
  songKey: GenoUltraArpSongKey,
  filenameLabel?: string,
): Promise<void> {
  const { wavBytes } = await exportGenoUltraArpWav(snap, voice, bpm, songKey);
  const base = safeFilename(
    genoUltraArpExportTrackLabel(snap, songKey, filenameLabel ?? 'GenoUltraArp'),
    'GenoUltraArp',
  );
  downloadBytes(wavBytes, `${base}.wav`, 'audio/wav');
}

export function buildGenoUltraArpSnapshot(args: {
  grid: boolean[][];
  barLength: GenoUltraArpSnapshot['barLength'];
  rateIdx: number;
  gate: number;
  swing: number;
  bpm?: number;
  octShift: GenoUltraArpSnapshot['octShift'];
  barOctShifts: GenoUltraArpSnapshot['barOctShifts'];
  mod1Levels: number[];
  mod2Levels: number[];
  mod3Levels?: number[];
  velLevels: number[];
  ctrl1On?: boolean;
  ctrl2On?: boolean;
  ctrl3On?: boolean;
  ctrl1Dest?: string;
  ctrl2Dest?: string;
  ctrl3Dest?: string;
  ctrl1Depth?: number;
  ctrl2Depth?: number;
  ctrl3Depth?: number;
  gateLevels?: number[];
  gateFxOn?: boolean;
  gateFxDepth?: number;
  gateFxAttackMs?: number;
  gateFxReleaseMs?: number;
  pumperOn?: boolean;
  pumperRate?: number;
  pumperDepth?: number;
  pumperAttackMs?: number;
  pumperReleaseMs?: number;
  pumperHighFilter?: number;
  pumperLowFilter?: number;
  stepMask?: boolean[];
  stepHits?: number[];
  phraseSteps?: number;
  basePitch: number;
  keyRoot: number;
  keyMode: GenoUltraArpSnapshot['keyMode'];
  arpScaleId?: NeuralHumScaleId;
  arpChordType?: GenoArpChordType;
  chordLabel?: string;
  stylePresetId?: string;
  chordTimeline?: GenoUltraArpSnapshot['chordTimeline'];
  importSourceTrackId?: string;
  arpVariation?: GenoUltraArpSnapshot['arpVariation'];
  octRange?: GenoUltraArpSnapshot['octRange'];
  orderInversion?: boolean;
}): GenoUltraArpSnapshot {
  return {
    grid: args.grid.map((r) => [...r]),
    barLength: args.barLength,
    rateIdx: args.rateIdx,
    gate: args.gate,
    swing: args.swing,
    bpm: clampGenoUltraArpBpm(args.bpm),
    octShift: args.octShift,
    barOctShifts: [...args.barOctShifts],
    mod1Levels: [...args.mod1Levels],
    mod2Levels: [...args.mod2Levels],
    mod3Levels: args.mod3Levels ? [...args.mod3Levels] : undefined,
    velLevels: [...args.velLevels],
    ctrl1On: args.ctrl1On,
    ctrl2On: args.ctrl2On,
    ctrl3On: args.ctrl3On,
    ctrl1Dest: args.ctrl1Dest,
    ctrl2Dest: args.ctrl2Dest,
    ctrl3Dest: args.ctrl3Dest,
    ctrl1Depth: args.ctrl1Depth,
    ctrl2Depth: args.ctrl2Depth,
    ctrl3Depth: args.ctrl3Depth,
    gateLevels: args.gateLevels ? [...args.gateLevels] : undefined,
    gateFxOn: args.gateFxOn,
    gateFxDepth: args.gateFxDepth,
    gateFxAttackMs: args.gateFxAttackMs,
    gateFxReleaseMs: args.gateFxReleaseMs,
    pumperOn: args.pumperOn,
    pumperRate: args.pumperRate,
    pumperDepth: args.pumperDepth,
    pumperAttackMs: args.pumperAttackMs,
    pumperReleaseMs: args.pumperReleaseMs,
    pumperHighFilter: args.pumperHighFilter,
    pumperLowFilter: args.pumperLowFilter,
    stepMask: args.stepMask ? [...args.stepMask] : undefined,
    stepHits: args.stepHits ? [...args.stepHits] : undefined,
    phraseSteps: args.phraseSteps,
    basePitch: args.basePitch,
    keyRoot: args.keyRoot,
    keyMode: args.keyMode,
    arpScaleId: args.arpScaleId,
    arpChordType: args.arpChordType,
    chordLabel: args.chordLabel,
    stylePresetId: args.stylePresetId,
    chordTimeline: args.chordTimeline?.map((s) => ({ ...s, pitches: [...s.pitches] })),
    totalPatternBeats: genoUltraArpTotalPatternBeats(args.barLength),
    importSourceTrackId: args.importSourceTrackId,
    arpVariation: args.arpVariation,
    octRange: args.octRange,
    orderInversion: args.orderInversion,
  };
}
