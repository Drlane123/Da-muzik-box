/**
 * Geno Ultra ARP — import chord progressions from .mid files and Synth Geno cards.
 */
import { parseMidi, type MidiEvent } from 'midi-file';
import type { MidiNoteEvent } from '@/app/lib/creationStation/midiExport';
import { GROOVE_LAB_MIDI_BASS_CEILING, GROOVE_LAB_SMF_PPQ } from '@/app/lib/creationStation/grooveLabMidiImport';
import {
  SE2_SYNTH_GENO_LIVE_GENRES,
  se2SynthGenoLivePresetById,
  se2SynthGenoLivePresetsForGenre,
  se2SynthGenoLivePresetKeyMode,
} from '@/app/lib/studio/se2SynthGenoLiveChordLibrary';
import { se2SynthGenoVoiceLiveChord } from '@/app/lib/studio/se2SynthGenoLiveChordVoicing';
import type { Se2SynthGenoLivePreset } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import { genoUltraArpTotalPatternBeats } from '@/app/lib/studio/genoUltraArpChordPitch';
import { type GenoArpBarLength, genoArpSanitizeBarLength } from '@/app/lib/studio/genoUltraArpPattern';
import type { GenoUltraArpChordSegment } from '@/app/lib/studio/genoUltraArpState';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import { readSe2SynthGenoPluginSession } from '@/app/lib/studio/se2SynthGenoPluginSessionCache';
import { readSe2SynthGenoLiveBuildSession, type Se2SynthGenoLiveBuildB01Snapshot } from '@/app/lib/studio/se2SynthGenoLiveBuildSessionCache';
import { se2SynthGenoPluginDraftChordNotesFromBarSpecs } from '@/app/lib/studio/se2SynthGenoPluginChordVoicing';
import { SE2_SYNTH_GENO_BUILD_1_LABEL, SE2_SYNTH_GENO_BUILD_2_LABEL } from '@/app/lib/studio/se2SynthGenoFusionEngine';
import {
  se2SynthGenoLiveBuildDraft,
  se2SynthGenoLivePresetById,
} from '@/app/lib/studio/se2SynthGenoLiveChordLibrary';
import { se2SynthGenoLiveOrderedSlotIndices } from '@/app/lib/studio/se2SynthGenoLiveChordMap';

export type GenoUltraArpChordImportResult = {
  chordTimeline: GenoUltraArpChordSegment[];
  totalPatternBeats: number;
  barLength: GenoArpBarLength;
  bpm: number;
  chordLabel: string;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  basePitch: number;
  importSource: 'midi' | 'card' | 'genoBuild' | 'se2Track';
  fileName?: string;
  cardPresetId?: string;
  genoBuildSourceId?: string;
};

export type GenoUltraArpChordImportError = { message: string };

export type GenoUltraArpCardOption = {
  id: string;
  label: string;
  genreId: string;
  genreLabel: string;
  preset: Se2SynthGenoLivePreset;
};

function isImportError(
  r: GenoUltraArpChordImportResult | GenoUltraArpChordImportError,
): r is GenoUltraArpChordImportError {
  return !('chordTimeline' in r);
}

function bpmFromMicrosecondsPerBeat(micros: number): number {
  return Math.max(40, Math.min(240, Math.round(60_000_000 / Math.max(1, micros))));
}

type ActiveNote = { startTick: number; velocity: number };

function collectNotesFromTracks(tracks: readonly (readonly MidiEvent[])[]): {
  notes: MidiNoteEvent[];
  bpm: number;
} {
  const notes: MidiNoteEvent[] = [];
  let bpm = 120;

  for (const track of tracks) {
    const active = new Map<string, ActiveNote>();
    let tick = 0;
    for (const ev of track) {
      tick += Math.max(0, ev.deltaTime ?? 0);
      if (ev.type === 'setTempo' && 'microsecondsPerBeat' in ev) {
        bpm = bpmFromMicrosecondsPerBeat(ev.microsecondsPerBeat);
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
          if (prev) pushNote(notes, prev, tick, ch, note);
          active.set(key, { startTick: tick, velocity: vel });
        }
      } else if (ev.type === 'noteOff') {
        closeNote(active, ch, Math.max(0, Math.min(127, ev.noteNumber ?? 0)), tick, notes);
      }
    }
    for (const [key, hit] of active) {
      const [chStr, noteStr] = key.split(':');
      pushNote(notes, hit, tick, Number(chStr), Number(noteStr));
    }
  }

  return { notes, bpm };
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
  out.push({
    midi: noteNumber,
    startTick: hit.startTick,
    durationTicks: Math.max(1, endTick - hit.startTick),
    velocity: hit.velocity,
    channel,
  });
}

function ticksPerQuarterFromHeader(header: { ticksPerBeat?: number | null }): number {
  if (header.ticksPerBeat != null && header.ticksPerBeat > 0) return header.ticksPerBeat;
  return GROOVE_LAB_SMF_PPQ;
}

function tickToBeat(tick: number, tpq: number): number {
  return tick / tpq;
}

/** Group chord-register notes into simultaneous voicings. */
export function chordTimelineFromMidiNotes(
  notes: readonly MidiNoteEvent[],
  tpq: number,
  opts?: { bassCeiling?: number; minPatternBeats?: number },
): { segments: GenoUltraArpChordSegment[]; totalBeats: number } {
  const ceiling = opts?.bassCeiling ?? GROOVE_LAB_MIDI_BASS_CEILING;
  const chordNotes = notes
    .filter((n) => n.midi > ceiling)
    .sort((a, b) => a.startTick - b.startTick || a.midi - b.midi);

  if (chordNotes.length === 0) {
    return { segments: [], totalBeats: opts?.minPatternBeats ?? 16 };
  }

  const toleranceTicks = Math.max(1, Math.round(tpq / 16));
  type Group = { startTick: number; pitches: number[]; endTick: number };
  const groups: Group[] = [];

  for (const n of chordNotes) {
    const endTick = n.startTick + n.durationTicks;
    let group = groups.find((g) => Math.abs(g.startTick - n.startTick) <= toleranceTicks);
    if (!group) {
      group = { startTick: n.startTick, pitches: [], endTick };
      groups.push(group);
    }
    if (!group.pitches.includes(n.midi)) group.pitches.push(n.midi);
    group.endTick = Math.max(group.endTick, endTick);
  }

  groups.sort((a, b) => a.startTick - b.startTick);

  const segments: GenoUltraArpChordSegment[] = [];
  let maxEndBeat = 0;

  for (let i = 0; i < groups.length; i += 1) {
    const g = groups[i]!;
    const startBeat = tickToBeat(g.startTick, tpq);
    const nextStart = groups[i + 1]?.startTick;
    const endBeat =
      nextStart != null
        ? tickToBeat(nextStart, tpq)
        : tickToBeat(g.endTick, tpq);
    const durationBeats = Math.max(0.25, endBeat - startBeat);
    maxEndBeat = Math.max(maxEndBeat, startBeat + durationBeats);
    segments.push({
      startBeat,
      durationBeats,
      pitches: [...g.pitches].sort((a, b) => a - b),
      label: chordLabelFromPitches(g.pitches),
    });
  }

  const minBeats = opts?.minPatternBeats ?? 4;
  const totalBeats = Math.max(minBeats, Math.ceil(maxEndBeat / 4) * 4);
  return { segments, totalBeats };
}

function chordLabelFromPitches(pitches: readonly number[]): string {
  if (!pitches.length) return '—';
  const root = pitches[0]!;
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return names[((root % 12) + 12) % 12] ?? '?';
}

function barLengthForBeats(totalBeats: number): GenoArpBarLength {
  if (totalBeats >= 32) return 8;
  if (totalBeats >= 16) return 4;
  return 1;
}

function inferKeyFromTimeline(segments: readonly GenoUltraArpChordSegment[]): {
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  basePitch: number;
} {
  const first = segments[0]?.pitches[0] ?? 60;
  const basePitch = Math.max(48, Math.min(72, first));
  return { keyRoot: basePitch, keyMode: 'major', basePitch };
}

export function genoUltraArpChordTimelineFromLivePreset(
  preset: Se2SynthGenoLivePreset,
  keyRoot: number,
  barLength: GenoArpBarLength,
): GenoUltraArpChordSegment[] {
  const totalBeats = genoUltraArpTotalPatternBeats(barLength);
  const loopLen = Math.max(1, Math.min(preset.loopLength, preset.chordSpecs.length));
  const beatsPerChord = totalBeats / loopLen;

  return Array.from({ length: loopLen }, (_, i) => {
    const spec = preset.chordSpecs[i]!;
    const pitches = se2SynthGenoVoiceLiveChord(
      keyRoot,
      preset.mode,
      spec,
      preset.stylePreset,
      preset.extensions,
      preset.inversion,
      preset.genreId,
    );
    return {
      startBeat: i * beatsPerChord,
      durationBeats: beatsPerChord,
      pitches: [...new Set(pitches.map((p) => Math.round(p)))].sort((a, b) => a - b),
      label: String(preset.romans[i] ?? spec.degree ?? i + 1),
    };
  });
}

export function genoUltraArpAllCardOptions(): GenoUltraArpCardOption[] {
  const out: GenoUltraArpCardOption[] = [];
  for (const genre of SE2_SYNTH_GENO_LIVE_GENRES) {
    for (const preset of se2SynthGenoLivePresetsForGenre(genre.id)) {
      out.push({
        id: preset.id,
        label: preset.name,
        genreId: genre.id,
        genreLabel: genre.label,
        preset,
      });
    }
  }
  return out;
}

export function parseGenoUltraArpMidiFile(
  data: ArrayBuffer,
  fileName: string,
): GenoUltraArpChordImportResult | GenoUltraArpChordImportError {
  try {
    const parsed = parseMidi(new Uint8Array(data));
    const tpq = ticksPerQuarterFromHeader(parsed.header);
    const { notes, bpm } = collectNotesFromTracks(parsed.tracks);
    if (notes.length === 0) return { message: 'No notes found in this MIDI file.' };

    const { segments, totalBeats } = chordTimelineFromMidiNotes(notes, tpq);
    if (segments.length === 0) {
      return { message: 'No chord-register notes found (try a file with voicings above C4).' };
    }

    const barLength = barLengthForBeats(totalBeats);
    const key = inferKeyFromTimeline(segments);
    const label = segments.map((s) => s.label).filter(Boolean).join(' · ').slice(0, 48);

    return {
      chordTimeline: segments,
      totalPatternBeats: genoUltraArpTotalPatternBeats(barLength),
      barLength,
      bpm,
      chordLabel: label || fileName.replace(/\.(mid|midi)$/i, ''),
      keyRoot: key.keyRoot,
      keyMode: key.keyMode,
      basePitch: key.basePitch,
      importSource: 'midi',
      fileName,
    };
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Could not read MIDI file.' };
  }
}

export function importGenoUltraArpFromCard(
  presetId: string,
  keyRoot: number,
  barLength: GenoArpBarLength,
): GenoUltraArpChordImportResult | GenoUltraArpChordImportError {
  const preset = se2SynthGenoLivePresetById(presetId);
  if (!preset) return { message: 'Chord card not found.' };

  const segments = genoUltraArpChordTimelineFromLivePreset(preset, keyRoot, barLength);
  if (!segments.length) return { message: 'This card has no voicings.' };

  const label = `${preset.name} (${preset.romanLine.slice(0, 40)})`;

  return {
    chordTimeline: segments,
    totalPatternBeats: genoUltraArpTotalPatternBeats(barLength),
    barLength,
    bpm: preset.bpm ?? 120,
    chordLabel: label,
    keyRoot,
    keyMode: se2SynthGenoLivePresetKeyMode(preset),
    basePitch: keyRoot,
    importSource: 'card',
    cardPresetId: preset.id,
  };
}

export function isGenoUltraArpChordImportError(
  r: GenoUltraArpChordImportResult | GenoUltraArpChordImportError,
): r is GenoUltraArpChordImportError {
  return isImportError(r);
}

export function isGenoUltraArpMidiFileName(name: string): boolean {
  return /\.(mid|midi)$/i.test(name);
}

export type GenoUltraGenoBuildChordSource = {
  id: string;
  trackIndex: number;
  build: 'b01' | 'b02';
  label: string;
  trackName: string;
  chordCount: number;
};

export type GenoBuildTrackRef = {
  kind?: string;
  name: string;
  laneNumber: number;
  trackKeyRoot?: number;
  trackKeyMode?: StudioDetectedKeyMode;
};

function studioTrackIsSynthGenoKind(tr: { kind?: string } | undefined): boolean {
  return tr?.kind === 'synthGeno';
}

/** One chord segment per bar — locks ARP harmony to the bar grid (Geno / SE2 rolls). */
export function chordTimelineBarQuantizedFromNotes(
  notes: readonly StudioEditor2GenNote[],
  beatsPerBar: number,
  opts?: { bassCeiling?: number; minPatternBeats?: number },
): { segments: GenoUltraArpChordSegment[]; totalBeats: number } {
  const bpb = Math.max(1, beatsPerBar);
  const ceiling = opts?.bassCeiling ?? GROOVE_LAB_MIDI_BASS_CEILING;
  const chordNotes = notes
    .filter((n) => n.pitch > ceiling)
    .sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);

  if (chordNotes.length === 0) {
    return { segments: [], totalBeats: opts?.minPatternBeats ?? 16 };
  }

  const maxEnd = chordNotes.reduce((m, n) => Math.max(m, n.startBeat + n.durationBeats), 0);
  const barCount = Math.max(1, Math.ceil(maxEnd / bpb));
  const segments: GenoUltraArpChordSegment[] = [];

  for (let bar = 0; bar < barCount; bar += 1) {
    const barStart = bar * bpb;
    const barEnd = barStart + bpb;
    const inBar = chordNotes.filter((n) => n.startBeat >= barStart - 1e-6 && n.startBeat < barEnd - 1e-6);
    if (!inBar.length) continue;
    const pitches = [...new Set(inBar.map((n) => Math.round(n.pitch)))].sort((a, b) => a - b);
    segments.push({
      startBeat: barStart,
      durationBeats: bpb,
      pitches,
      label: chordLabelFromPitches(pitches),
    });
  }

  const totalBeats = Math.max(opts?.minPatternBeats ?? barCount * bpb, barCount * bpb);
  return { segments, totalBeats };
}

/** Group Geno chord-lane notes (beat timing) into ARP chord segments. */
export function chordTimelineFromGenoChordNotes(
  notes: readonly StudioEditor2GenNote[],
  opts?: { bassCeiling?: number; minPatternBeats?: number },
): { segments: GenoUltraArpChordSegment[]; totalBeats: number } {
  const ceiling = opts?.bassCeiling ?? GROOVE_LAB_MIDI_BASS_CEILING;
  const chordNotes = notes
    .filter((n) => n.pitch > ceiling)
    .sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);

  if (chordNotes.length === 0) {
    return { segments: [], totalBeats: opts?.minPatternBeats ?? 16 };
  }

  const toleranceBeats = 1 / 64;
  type Group = { startBeat: number; pitches: number[]; endBeat: number };
  const groups: Group[] = [];

  for (const n of chordNotes) {
    const endBeat = n.startBeat + n.durationBeats;
    let group = groups.find((g) => Math.abs(g.startBeat - n.startBeat) <= toleranceBeats);
    if (!group) {
      group = { startBeat: n.startBeat, pitches: [], endBeat };
      groups.push(group);
    }
    if (!group.pitches.includes(n.pitch)) group.pitches.push(n.pitch);
    group.endBeat = Math.max(group.endBeat, endBeat);
  }

  groups.sort((a, b) => a.startBeat - b.startBeat);

  const segments: GenoUltraArpChordSegment[] = [];
  let maxEndBeat = 0;

  for (let i = 0; i < groups.length; i += 1) {
    const g = groups[i]!;
    const startBeat = g.startBeat;
    const nextStart = groups[i + 1]?.startBeat;
    const endBeat = nextStart != null ? nextStart : g.endBeat;
    const durationBeats = Math.max(0.25, endBeat - startBeat);
    maxEndBeat = Math.max(maxEndBeat, startBeat + durationBeats);
    segments.push({
      startBeat,
      durationBeats,
      pitches: [...g.pitches].sort((a, b) => a - b),
      label: chordLabelFromPitches(g.pitches),
    });
  }

  const minBeats = opts?.minPatternBeats ?? 4;
  const totalBeats = Math.max(minBeats, Math.ceil(maxEndBeat / 4) * 4);
  return { segments, totalBeats };
}

function genoBuildTrackLabel(tr: GenoBuildTrackRef, lanePad: number): string {
  const n = tr.laneNumber;
  const pad = Math.max(2, lanePad);
  const num = String(n).padStart(pad, '0');
  return `T${num} · ${tr.name}`;
}

function parseGenoBuildSourceId(sourceId: string): { trackIndex: number; build: 'b01' | 'b02' } | null {
  const m = /^(\d+):(b0[12])$/.exec(sourceId.trim());
  if (!m) return null;
  const trackIndex = Number(m[1]);
  const build = m[2] as 'b01' | 'b02';
  if (!Number.isFinite(trackIndex) || trackIndex < 0) return null;
  return { trackIndex, build };
}

function resolveTrackKey(
  tr: GenoBuildTrackRef,
  songKey: { keyRoot: number; keyMode: StudioDetectedKeyMode },
): { keyRoot: number; keyMode: StudioDetectedKeyMode } {
  return {
    keyRoot: tr.trackKeyRoot ?? songKey.keyRoot,
    keyMode: tr.trackKeyMode ?? songKey.keyMode,
  };
}

function b02ChordNotesForTrack(
  trackIndex: number,
  tr: GenoBuildTrackRef,
  beatsPerBar: number,
  songKey: { keyRoot: number; keyMode: StudioDetectedKeyMode },
): StudioEditor2GenNote[] {
  const session = readSe2SynthGenoPluginSession(trackIndex);
  if (!session) return [];
  if (session.draft?.chordNotes?.length) return [...session.draft.chordNotes];
  const key = resolveTrackKey(tr, songKey);
  return se2SynthGenoPluginDraftChordNotesFromBarSpecs(
    key.keyRoot,
    key.keyMode,
    session.state,
    session.state.barCount,
    beatsPerBar,
  );
}

function b01ChordNotesFromSnapshot(snap: Se2SynthGenoLiveBuildB01Snapshot): StudioEditor2GenNote[] {
  if (!snap.enableChords) return [];
  const preset = se2SynthGenoLivePresetById(snap.presetId);
  if (!preset) return [];
  const barSpecs =
    snap.orderedSpecs.length === snap.barCount
      ? snap.orderedSpecs.map((spec, bar) => snap.liveBarSpecPatches[bar] ?? spec)
      : snap.orderedSpecs;
  const draft = se2SynthGenoLiveBuildDraft({
    preset,
    chordSpecs: snap.orderedSpecs,
    orderedSlotIndices: se2SynthGenoLiveOrderedSlotIndices(snap.playOrder, snap.orderedSpecs.length),
    barCount: snap.barCount,
    barSpecs: Object.keys(snap.liveBarSpecPatches).length > 0 ? barSpecs : undefined,
    toggles: {
      enableChords: true,
      enableMelody: false,
      enableBass: false,
      enableArp: false,
      enableFiller: false,
    },
    keyRoot: snap.keyRoot,
    keyMode: snap.keyMode,
    beatsPerBar: snap.beatsPerBar,
    bpm: snap.bpm,
  });
  return draft.chordNotes ?? [];
}

function b01ChordNotesForTrack(trackIndex: number): StudioEditor2GenNote[] {
  const live = readSe2SynthGenoLiveBuildSession(trackIndex);
  if (!live) return [];
  if (live.draft?.chordNotes?.length) return [...live.draft.chordNotes];
  if (live.b01Snapshot) return b01ChordNotesFromSnapshot(live.b01Snapshot);
  return [];
}

/** Synth Geno lanes with a Geno Build 1 or 2 chord loop ready to import. */
export function listGenoUltraGenoBuildChordSources(
  tracks: readonly GenoBuildTrackRef[],
  beatsPerBar: number,
  songKey: { keyRoot: number; keyMode: StudioDetectedKeyMode },
): GenoUltraGenoBuildChordSource[] {
  const lanePad = Math.max(2, String(tracks.length).length);
  const out: GenoUltraGenoBuildChordSource[] = [];

  tracks.forEach((tr, trackIndex) => {
    if (!studioTrackIsSynthGenoKind(tr)) return;
    const base = genoBuildTrackLabel(tr, lanePad);

    const b01Notes = b01ChordNotesForTrack(trackIndex);
    if (b01Notes.length > 0) {
      const { segments } = chordTimelineFromGenoChordNotes(b01Notes);
      if (segments.length > 0) {
        const live = readSe2SynthGenoLiveBuildSession(trackIndex);
        out.push({
          id: `${trackIndex}:b01`,
          trackIndex,
          build: 'b01',
          trackName: tr.name,
          label: `${base} · ${SE2_SYNTH_GENO_BUILD_1_LABEL}${live?.label ? ` · ${live.label}` : ''}`,
          chordCount: segments.length,
        });
      }
    }

    const b02Notes = b02ChordNotesForTrack(trackIndex, tr, beatsPerBar, songKey);
    if (b02Notes.length > 0) {
      const { segments } = chordTimelineFromGenoChordNotes(b02Notes);
      if (segments.length > 0) {
        const session = readSe2SynthGenoPluginSession(trackIndex);
        const prog = session?.state.progressionRomans?.slice(0, 4).join(' ') ?? session?.state.progressionId;
        out.push({
          id: `${trackIndex}:b02`,
          trackIndex,
          build: 'b02',
          trackName: tr.name,
          label: `${base} · ${SE2_SYNTH_GENO_BUILD_2_LABEL}${prog ? ` · ${String(prog).slice(0, 24)}` : ''}`,
          chordCount: segments.length,
        });
      }
    }
  });

  return out;
}

export function importGenoUltraArpFromGenoBuild(
  sourceId: string,
  tracks: readonly GenoBuildTrackRef[],
  beatsPerBar: number,
  bpm: number,
  songKey: { keyRoot: number; keyMode: StudioDetectedKeyMode },
  barLength: GenoArpBarLength,
): GenoUltraArpChordImportResult | GenoUltraArpChordImportError {
  const parsed = parseGenoBuildSourceId(sourceId);
  if (!parsed) return { message: 'Invalid Geno Build source.' };

  const tr = tracks[parsed.trackIndex];
  if (!tr || !studioTrackIsSynthGenoKind(tr)) {
    return { message: 'Synth Geno track not found — open Geno Build on that lane first.' };
  }

  const notes =
    parsed.build === 'b01'
      ? b01ChordNotesForTrack(parsed.trackIndex)
      : b02ChordNotesForTrack(parsed.trackIndex, tr, beatsPerBar, songKey);

  if (!notes.length) {
    return {
      message:
        parsed.build === 'b01'
          ? 'No Geno Build 1 chords yet — build a loop in Geno B01 on that track.'
          : 'No Geno Build 2 chords yet — pick a progression or generate in Geno B02 on that track.',
    };
  }

  const { segments, totalBeats } = chordTimelineBarQuantizedFromNotes(notes, beatsPerBar, {
    minPatternBeats: genoUltraArpTotalPatternBeats(barLength),
  });
  if (!segments.length) return { message: 'No chord voicings found in that Geno Build loop.' };

  const sourceBarLength = genoArpSanitizeBarLength(
    Math.min(8, Math.max(1, Math.ceil(totalBeats / Math.max(1, beatsPerBar)))),
  ) as GenoArpBarLength;

  const key =
    parsed.build === 'b01'
      ? (() => {
          const live = readSe2SynthGenoLiveBuildSession(parsed.trackIndex);
          return live
            ? { keyRoot: live.keyRoot, keyMode: live.keyMode, basePitch: live.keyRoot }
            : inferKeyFromTimeline(segments);
        })()
      : (() => {
          const trackKey = resolveTrackKey(tr, songKey);
          return { ...trackKey, basePitch: trackKey.keyRoot };
        })();

  const buildLabel = parsed.build === 'b01' ? SE2_SYNTH_GENO_BUILD_1_LABEL : SE2_SYNTH_GENO_BUILD_2_LABEL;
  const lanePad = Math.max(2, String(tracks.length).length);
  const chordLabel = `${genoBuildTrackLabel(tr, lanePad)} · ${buildLabel}`;
  const firstPitch = segments[0]?.pitches[0] ?? 60;
  const basePitch = Math.max(48, Math.min(72, firstPitch));
  const keyPc = ((Math.round(key.keyRoot) % 12) + 12) % 12;

  return {
    chordTimeline: segments,
    totalPatternBeats: genoUltraArpTotalPatternBeats(sourceBarLength),
    barLength: sourceBarLength,
    bpm:
      parsed.build === 'b01'
        ? (readSe2SynthGenoLiveBuildSession(parsed.trackIndex)?.bpm ?? bpm)
        : bpm,
    chordLabel,
    keyRoot: keyPc,
    keyMode: key.keyMode,
    basePitch,
    importSource: 'genoBuild',
    genoBuildSourceId: sourceId,
  };
}
