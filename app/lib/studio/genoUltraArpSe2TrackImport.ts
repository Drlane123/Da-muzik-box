/**
 * Geno Ultra ARP — detect chord timeline + key from any SE2 lane (auto-follow).
 */
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { GROOVE_LAB_MIDI_BASS_CEILING } from '@/app/lib/creationStation/grooveLabMidiImport';
import {
  chordTimelineBarQuantizedFromNotes,
  type GenoUltraArpChordImportError,
  type GenoUltraArpChordImportResult,
} from '@/app/lib/studio/genoUltraArpChordImport';
import { genoUltraArpTotalPatternBeats } from '@/app/lib/studio/genoUltraArpChordPitch';
import type { GenoArpBarLength } from '@/app/lib/studio/genoUltraArpPattern';
import { genoArpSanitizeBarLength } from '@/app/lib/studio/genoUltraArpPattern';
import type { GenoUltraArpChordSegment } from '@/app/lib/studio/genoUltraArpState';
import {
  detectKeyFromStudioTrack,
  genoUltraKeySourceTrackLabel,
  resolveKeyFromStudioTrack,
  studioGenoUltraKeySourceTypeLabel,
  type StudioKeyDetectTrackInput,
} from '@/app/lib/studio/genoUltraArpKeySource';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import {
  progressionStepsToChordNotes,
  studioNormalizeHarmonyLoopBars,
  studioResolveHarmonyBarCount,
  type StudioHarmonyMidiNote,
} from '@/app/lib/studio/studioInstrumentHarmony';
import { rhythmStepsToMidiNotes } from '@/app/lib/studio/studioRhythmEditTrack';

export type GenoUltraArpSe2TrackChordInput = StudioKeyDetectTrackInput & {
  name: string;
  laneNumber: number;
  harmonySteps?: readonly GrooveProgressionStep[];
  harmonyLoopBars?: number;
  rhythmSteps?: readonly GrooveProgressionStep[];
  rhythmLoopBars?: number;
};

function normalizeKeyRoot(root: number): number {
  return ((Math.round(root) % 12) + 12) % 12;
}

function toGenNotes(
  notes: readonly { pitch: number; startBeat: number; durationBeats: number; velocity?: number }[],
): StudioEditor2GenNote[] {
  return notes.map((n) => ({
    pitch: n.pitch,
    startBeat: n.startBeat,
    durationBeats: n.durationBeats,
    velocity: n.velocity ?? 100,
  }));
}

function harmonyNotesToGen(
  result: StudioHarmonyMidiNote[] | { message: string },
): StudioEditor2GenNote[] | null {
  if ('message' in result) return null;
  return result.map((n) => ({
    pitch: n.pitch,
    startBeat: n.startBeat,
    durationBeats: n.durationBeats,
    velocity: n.velocity,
  }));
}

/** Lane has progression steps or enough chord-register MIDI to build a timeline. */
export function studioGenoUltraCanFollowChordsFromTrack(tr: GenoUltraArpSe2TrackChordInput): boolean {
  if ((tr.harmonySteps?.length ?? 0) > 0) return true;
  if ((tr.rhythmSteps?.length ?? 0) > 0) return true;
  const ceiling = GROOVE_LAB_MIDI_BASS_CEILING;
  return tr.notes.filter((n) => n.pitch > ceiling).length >= 2;
}

function normalizeTimelineStart(segments: readonly GenoUltraArpChordSegment[]): GenoUltraArpChordSegment[] {
  if (!segments.length) return [];
  const minStart = Math.min(...segments.map((s) => s.startBeat));
  if (minStart <= 1e-9) return segments.map((s) => ({ ...s, pitches: [...s.pitches] }));
  return segments.map((s) => ({
    ...s,
    startBeat: s.startBeat - minStart,
    pitches: [...s.pitches],
  }));
}

/** Fit source progression into the ARP loop (4 or 8 bars). */
export function tileGenoUltraChordTimelineToLoop(
  segments: readonly GenoUltraArpChordSegment[],
  sourceTotalBeats: number,
  targetTotalBeats: number,
): GenoUltraArpChordSegment[] {
  if (!segments.length || targetTotalBeats <= 0) return [];
  const srcSpan = Math.max(0.25, sourceTotalBeats);
  const normalized = normalizeTimelineStart(segments);

  if (srcSpan >= targetTotalBeats) {
    return normalized
      .filter((s) => s.startBeat < targetTotalBeats)
      .map((s) => ({
        ...s,
        durationBeats: Math.min(s.durationBeats, targetTotalBeats - s.startBeat),
      }));
  }

  const out: GenoUltraArpChordSegment[] = [];
  let offset = 0;
  while (offset < targetTotalBeats - 1e-9) {
    for (const seg of normalized) {
      const absStart = offset + seg.startBeat;
      if (absStart >= targetTotalBeats) break;
      out.push({
        ...seg,
        startBeat: absStart,
        durationBeats: Math.min(seg.durationBeats, targetTotalBeats - absStart),
        pitches: [...seg.pitches],
      });
    }
    offset += srcSpan;
  }
  return out;
}

export function se2HarmonyChordNotesFromTrack(
  tr: GenoUltraArpSe2TrackChordInput,
  beatsPerBar: number,
): { notes: StudioEditor2GenNote[]; sourceBarCount: number } | GenoUltraArpChordImportError {
  const bpb = Math.max(1, beatsPerBar);

  if (tr.harmonySteps?.length) {
    const barCount = studioResolveHarmonyBarCount(tr.harmonySteps, tr.harmonyLoopBars, bpb);
    const built = progressionStepsToChordNotes(tr.harmonySteps, {
      beatsPerBar: bpb,
      barCount,
      sustainSlots: 4,
      maxDurationBeats: Math.min(bpb * 0.92, Math.max(0.5, bpb - 0.08)),
    });
    const notes = harmonyNotesToGen(built);
    if (!notes?.length) {
      return { message: 'Progression+ steps found but no chord voicings — apply chords to the lane first.' };
    }
    return { notes, sourceBarCount: barCount };
  }

  if (tr.rhythmSteps?.length) {
    const barCount = studioNormalizeHarmonyLoopBars(tr.rhythmLoopBars);
    const built = rhythmStepsToMidiNotes(tr.rhythmSteps, { beatsPerBar: bpb, barCount });
    const notes = harmonyNotesToGen(built);
    if (!notes?.length) {
      return { message: 'Rhythm edit steps found but no chord stacks — build the rhythm pattern first.' };
    }
    return { notes, sourceBarCount: barCount };
  }

  const genNotes = toGenNotes(tr.notes);
  if (genNotes.filter((n) => n.pitch > GROOVE_LAB_MIDI_BASS_CEILING).length < 2) {
    return {
      message:
        'No chords on this lane — add Progression+ steps, rhythm chords, or chord MIDI above the bass register.',
    };
  }
  const maxEnd = genNotes.reduce((m, n) => Math.max(m, n.startBeat + n.durationBeats), 0);
  const sourceBarCount = Math.max(1, Math.ceil(maxEnd / bpb));
  return { notes: genNotes, sourceBarCount: studioNormalizeHarmonyLoopBars(sourceBarCount) };
}

/** Build locked ARP chord timeline + key from one SE2 track. */
export function importGenoUltraArpFromSe2Track(
  tr: GenoUltraArpSe2TrackChordInput,
  opts: {
    beatsPerBar: number;
    bpm: number;
    barLength: GenoArpBarLength;
    songKey: { keyRoot: number; keyMode: StudioDetectedKeyMode };
    lanePad?: number;
    trackIndex: number;
  },
): GenoUltraArpChordImportResult | GenoUltraArpChordImportError {
  if (!studioGenoUltraCanFollowChordsFromTrack(tr)) {
    return {
      message:
        'Selected lane has no chord data — use Progression+, rhythm chords, or chord MIDI on that track.',
    };
  }

  const chordSource = se2HarmonyChordNotesFromTrack(tr, opts.beatsPerBar);
  if ('message' in chordSource) return chordSource;

  const bpb = Math.max(1, opts.beatsPerBar);
  const sourceBarLength = genoArpSanitizeBarLength(
    Math.min(8, Math.max(1, chordSource.sourceBarCount)),
  ) as GenoArpBarLength;
  const targetBarLength = sourceBarLength;
  const targetTotalBeats = genoUltraArpTotalPatternBeats(targetBarLength);
  const sourceTotalBeats = chordSource.sourceBarCount * bpb;

  const { segments, totalBeats: rawTotal } = chordTimelineBarQuantizedFromNotes(chordSource.notes, bpb, {
    minPatternBeats: sourceTotalBeats,
  });
  if (!segments.length) {
    return { message: 'Could not read chord changes from that lane.' };
  }

  const tiled = tileGenoUltraChordTimelineToLoop(segments, rawTotal, targetTotalBeats);
  if (!tiled.length) {
    return { message: 'Chord timeline empty after fitting to ARP loop length.' };
  }

  const keyInput: StudioKeyDetectTrackInput = {
    kind: tr.kind,
    a2mMode: tr.a2mMode,
    trackKeyRoot: tr.trackKeyRoot,
    trackKeyMode: tr.trackKeyMode,
    a2mKeyRoot: tr.a2mKeyRoot,
    a2mKeyMode: tr.a2mKeyMode,
    notes: tr.notes,
  };

  const detected =
    detectKeyFromStudioTrack(keyInput, opts.bpm) ??
    resolveKeyFromStudioTrack(keyInput, opts.bpm) ?? {
      keyRoot: normalizeKeyRoot(tr.trackKeyRoot ?? opts.songKey.keyRoot),
      keyMode: tr.trackKeyMode ?? opts.songKey.keyMode,
    };

  const lanePad = opts.lanePad ?? 2;
  const chordLabel = genoUltraKeySourceTrackLabel(
    {
      trackIndex: opts.trackIndex,
      kind: tr.kind ?? 'midi',
      name: tr.name,
      laneNumber: tr.laneNumber,
      typeLabel: studioGenoUltraKeySourceTypeLabel(tr.kind, tr.a2mMode),
      canDetectKey: true,
      noteCount: tr.notes.length,
    },
    lanePad,
  );

  const firstPitch = tiled[0]?.pitches[0] ?? 60;
  const basePitch = Math.max(48, Math.min(72, firstPitch));
  const keyPc = detected.keyRoot;

  return {
    chordTimeline: tiled,
    totalPatternBeats: targetTotalBeats,
    barLength: targetBarLength,
    bpm: opts.bpm,
    chordLabel,
    keyRoot: keyPc,
    keyMode: detected.keyMode,
    basePitch,
    importSource: 'se2Track',
  };
}

export function se2TrackToGenoUltraChordInput(tr: {
  kind?: string;
  a2mMode?: string;
  name: string;
  laneNumber: number;
  trackKeyRoot?: number;
  trackKeyMode?: StudioDetectedKeyMode;
  a2mKeyRoot?: number;
  a2mKeyMode?: StudioDetectedKeyMode;
  notes: readonly { pitch: number; startBeat: number; durationBeats: number; velocity?: number }[];
  harmonySteps?: readonly GrooveProgressionStep[];
  harmonyLoopBars?: number;
  rhythmSteps?: readonly GrooveProgressionStep[];
  rhythmLoopBars?: number;
}): GenoUltraArpSe2TrackChordInput {
  return {
    kind: tr.kind,
    a2mMode: tr.a2mMode,
    name: tr.name,
    laneNumber: tr.laneNumber,
    trackKeyRoot: tr.trackKeyRoot,
    trackKeyMode: tr.trackKeyMode,
    a2mKeyRoot: tr.a2mKeyRoot,
    a2mKeyMode: tr.a2mKeyMode,
    notes: tr.notes,
    harmonySteps: tr.harmonySteps,
    harmonyLoopBars: tr.harmonyLoopBars,
    rhythmSteps: tr.rhythmSteps,
    rhythmLoopBars: tr.rhythmLoopBars,
  };
}
