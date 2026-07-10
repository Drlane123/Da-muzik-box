/**
 * Geno Ultra ARP — pick an SE2 lane as the key source (dropdown + detect).
 */
import {
  detectKeyFromMidiNotes,
  type StudioDetectedKeyMode,
} from '@/app/lib/studio/studioAudioClipAnalysis';
import { GROOVE_LAB_MIDI_BASS_CEILING } from '@/app/lib/creationStation/grooveLabMidiImport';
import {
  studioResolveTrackKey,
  studioTrackNotesEligibleForKey,
  type StudioKeyDetectTrackInput,
  type StudioMidiNotePitch,
  type StudioResolvedTrackKey,
} from '@/app/lib/studio/studioMidiKeyConvert';

export type GenoUltraArpKeySourceTrack = {
  trackIndex: number;
  kind: string;
  name: string;
  laneNumber: number;
  /** User-facing lane type (MIDI, Bass Glide, Groove Lead, …). */
  typeLabel: string;
  canDetectKey: boolean;
  /** Progression+, rhythm steps, or chord MIDI on the lane. */
  canFollowChords?: boolean;
  noteCount: number;
  storedKeyRoot?: number;
  storedKeyMode?: StudioDetectedKeyMode;
};

export type GenoUltraArpKeySourceTrackInput = StudioKeyDetectTrackInput & {
  name: string;
  laneNumber: number;
  harmonySteps?: readonly unknown[];
  harmonyLoopBars?: number;
  rhythmSteps?: readonly unknown[];
  rhythmLoopBars?: number;
};

const TYPE_LABEL: Record<string, string> = {
  midi: 'MIDI',
  audio: 'Audio',
  a2m: 'Audio→MIDI',
  rhythm: 'Rhythm',
  glideBass: 'Bass Glide',
  synthGeno: 'Synth Geno',
  grooveLead: 'Groove Lead',
  genoUltraSynth: 'Geno Ultra',
  drumGenerator: 'Drum Gen',
  beatPads: 'Beat Pads',
  humCapture: 'Hum Capture',
};

export function studioGenoUltraKeySourceTypeLabel(
  kind?: string,
  a2mMode?: string,
): string {
  if (kind === 'a2m' && a2mMode === 'drums') return 'Audio→MIDI Drums';
  if (kind && TYPE_LABEL[kind]) return TYPE_LABEL[kind]!;
  return kind ? kind : 'MIDI';
}

function normalizeKeyRoot(root: number): number {
  return ((Math.round(root) % 12) + 12) % 12;
}

export function studioGenoUltraCanDetectKeyFromTrack(tr: StudioKeyDetectTrackInput): boolean {
  if (tr.trackKeyRoot != null && tr.trackKeyMode) return true;
  if (tr.a2mKeyRoot != null && tr.a2mKeyMode) return true;
  return studioTrackNotesEligibleForKey(tr);
}

function studioGenoUltraCanFollowChordsFromKeyInput(tr: GenoUltraArpKeySourceTrackInput): boolean {
  if ((tr.harmonySteps?.length ?? 0) > 0) return true;
  if ((tr.rhythmSteps?.length ?? 0) > 0) return true;
  return tr.notes.filter((n) => n.pitch > GROOVE_LAB_MIDI_BASS_CEILING).length >= 2;
}

/** Read stored or analyze notes on one SE2 track — does not mutate track state. */
export function resolveKeyFromStudioTrack(
  tr: StudioKeyDetectTrackInput,
  bpm: number,
): StudioResolvedTrackKey | null {
  const resolved = studioResolveTrackKey(tr, bpm);
  if (resolved) return resolved;
  if (!studioTrackNotesEligibleForKey(tr)) return null;
  const detected = detectKeyFromMidiNotes(tr.notes, bpm);
  if (!detected) return null;
  return {
    keyRoot: normalizeKeyRoot(detected.keyRoot),
    keyMode: detected.keyMode,
  };
}

/** Detect key from one track's notes and return it (caller stores on track + song key). */
export function detectKeyFromStudioTrack(
  tr: StudioKeyDetectTrackInput,
  bpm: number,
): StudioResolvedTrackKey | null {
  if (!studioGenoUltraCanDetectKeyFromTrack(tr)) return null;
  if (studioTrackNotesEligibleForKey(tr)) {
    const detected = detectKeyFromMidiNotes(tr.notes, bpm);
    if (detected) {
      return {
        keyRoot: normalizeKeyRoot(detected.keyRoot),
        keyMode: detected.keyMode,
      };
    }
  }
  const stored = studioResolveTrackKey(tr, bpm);
  return stored;
}

export function buildGenoUltraArpKeySourceTracks(
  tracks: readonly GenoUltraArpKeySourceTrackInput[],
  lanePad = 2,
): GenoUltraArpKeySourceTrack[] {
  return tracks.map((tr, trackIndex) => {
    const stored =
      tr.trackKeyRoot != null && tr.trackKeyMode
        ? { keyRoot: normalizeKeyRoot(tr.trackKeyRoot), keyMode: tr.trackKeyMode }
        : tr.a2mKeyRoot != null && tr.a2mKeyMode
          ? { keyRoot: normalizeKeyRoot(tr.a2mKeyRoot), keyMode: tr.a2mKeyMode }
          : undefined;
    return {
      trackIndex,
      kind: tr.kind ?? 'midi',
      name: tr.name,
      laneNumber: tr.laneNumber,
      typeLabel: studioGenoUltraKeySourceTypeLabel(tr.kind, tr.a2mMode),
      canDetectKey: studioGenoUltraCanDetectKeyFromTrack(tr),
      canFollowChords: studioGenoUltraCanFollowChordsFromKeyInput(tr),
      noteCount: tr.notes.length,
      storedKeyRoot: stored?.keyRoot,
      storedKeyMode: stored?.keyMode,
    };
  });
}

export function genoUltraKeySourceTrackLabel(
  tr: GenoUltraArpKeySourceTrack,
  lanePad = 2,
): string {
  const num = String(tr.laneNumber).padStart(Math.max(2, lanePad), '0');
  return `T${num} · ${tr.name} · ${tr.typeLabel}`;
}

export function studioTrackToKeyDetectInput(
  tr: {
    kind?: string;
    a2mMode?: string;
    trackKeyRoot?: number;
    trackKeyMode?: StudioDetectedKeyMode;
    a2mKeyRoot?: number;
    a2mKeyMode?: StudioDetectedKeyMode;
    notes: ReadonlyArray<StudioMidiNotePitch>;
  },
): StudioKeyDetectTrackInput {
  return {
    kind: tr.kind,
    a2mMode: tr.a2mMode,
    trackKeyRoot: tr.trackKeyRoot,
    trackKeyMode: tr.trackKeyMode,
    a2mKeyRoot: tr.a2mKeyRoot,
    a2mKeyMode: tr.a2mKeyMode,
    notes: tr.notes,
  };
}
