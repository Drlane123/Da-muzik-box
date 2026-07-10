/**
 * Geno Bass groove — import bass MIDI from an SE2 arranger lane.
 */
import {
  genoBassBeatNotesToRoll,
  type GenoBassMidiImportError,
  type GenoBassMidiImportResult,
} from '@/app/lib/studio/genoBassMidiImport';
import {
  genoUltraKeySourceTrackLabel,
  studioGenoUltraKeySourceTypeLabel,
} from '@/app/lib/studio/genoUltraArpKeySource';
import { studioTrackIsDrumChannel } from '@/app/lib/studio/studioEditor2DrumPatterns';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';

export type GenoBassSe2TrackMidiInput = {
  kind?: string;
  a2mMode?: string;
  midiInstrumentId?: string;
  midiChannel?: number;
  name: string;
  laneNumber: number;
  notes: readonly StudioEditor2GenNote[];
};

function isBassDedicatedLane(tr: GenoBassSe2TrackMidiInput): boolean {
  if (tr.kind === 'glideBass' || tr.kind === 'genoBassSynth') return true;
  if (tr.kind === 'a2m' && tr.a2mMode === 'bass') return true;
  return false;
}

/** Lane has note data suitable for bass groove import. */
export function studioGenoBassCanImportMidiFromTrack(tr: GenoBassSe2TrackMidiInput): boolean {
  if (studioTrackIsDrumChannel(tr)) return false;
  if (tr.kind === 'audio' || tr.kind === 'trackAlign') return false;
  return tr.notes.length > 0;
}

/** Build roll notes from one SE2 track (4–8 bars). */
export function importGenoBassMidiFromSe2Track(
  tr: GenoBassSe2TrackMidiInput,
  opts: {
    bpm: number;
    trackIndex: number;
    lanePad?: number;
  },
): GenoBassMidiImportResult | GenoBassMidiImportError {
  if (!studioGenoBassCanImportMidiFromTrack(tr)) {
    return {
      message:
        'Selected lane has no importable MIDI — pick a MIDI, bass, or melodic lane with notes.',
    };
  }

  const lanePad = opts.lanePad ?? 2;
  const sourceLabel = genoUltraKeySourceTrackLabel(
    {
      trackIndex: opts.trackIndex,
      kind: tr.kind ?? 'midi',
      name: tr.name,
      laneNumber: tr.laneNumber,
      typeLabel: studioGenoUltraKeySourceTypeLabel(tr.kind, tr.a2mMode),
      canDetectKey: false,
      noteCount: tr.notes.length,
    },
    lanePad,
  );

  return genoBassBeatNotesToRoll(tr.notes, {
    bpm: opts.bpm,
    sourceLabel,
    preferAllBassNotes: isBassDedicatedLane(tr),
  });
}

export function se2TrackToGenoBassMidiInput(tr: {
  kind?: string;
  a2mMode?: string;
  midiInstrumentId?: string;
  midiChannel?: number;
  name: string;
  laneNumber: number;
  notes: readonly StudioEditor2GenNote[];
}): GenoBassSe2TrackMidiInput {
  return {
    kind: tr.kind,
    a2mMode: tr.a2mMode,
    midiInstrumentId: tr.midiInstrumentId,
    midiChannel: tr.midiChannel,
    name: tr.name,
    laneNumber: tr.laneNumber,
    notes: tr.notes,
  };
}
