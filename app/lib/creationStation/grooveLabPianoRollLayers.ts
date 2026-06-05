import {
  cbPianoNoteNameToMidi,
  LAB808_PIANO_ROWS,
} from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import { CHORD_BASS_SEQ_CHANNEL_BASE } from '@/app/lib/creationStation/chordBassSequencerSession';
import { grooveLabIsBassSubMidi } from '@/app/lib/creationStation/grooveComposerEngine';
import {
  GROOVE_LAB_REGISTER_LABELS,
  grooveLabIsChordStackMidi,
  grooveLabIsGuitarMidi,
  grooveLabIsMelodyMidi,
} from '@/app/lib/creationStation/grooveLabPitch';
import { GROOVE_LEAD_DISPLAY_NAME, GROOVE_LEAD_SHORT_LABEL, WAVE_LEAF_NOTE_COLOR } from '@/app/lib/creationStation/waveLeafBranding';
import { waveLeafIsLeadMidi, WAVE_LEAF_REGISTER_LABEL } from '@/app/lib/creationStation/waveLeafPitch';

export type GrooveLabRollLayerScope = 'sub' | 'chord' | 'guitar' | 'melody' | 'waveleaf' | 'sample';

export const GROOVE_LAB_LAYER_SCOPE_META: Record<
  GrooveLabRollLayerScope,
  { label: string; color: string; register: string }
> = {
  sub: { label: 'SUB', color: '#93c5fd', register: GROOVE_LAB_REGISTER_LABELS.sub },
  chord: { label: 'CHORD', color: '#86efac', register: GROOVE_LAB_REGISTER_LABELS.chord },
  guitar: { label: 'GUITAR', color: '#f59e0b', register: GROOVE_LAB_REGISTER_LABELS.guitar },
  melody: { label: 'MELODY', color: '#fbbf24', register: GROOVE_LAB_REGISTER_LABELS.melody },
  waveleaf: { label: GROOVE_LEAD_DISPLAY_NAME, color: WAVE_LEAF_NOTE_COLOR, register: WAVE_LEAF_REGISTER_LABEL },
  sample: { label: 'ORCH HITS', color: '#a78bfa', register: GROOVE_LAB_REGISTER_LABELS.chord },
};

/** Piano keys visible on a single-layer roll (no shared C1–C6 stack). */
export function grooveLabPianoRowsForScope(scope: GrooveLabRollLayerScope): readonly string[] {
  return LAB808_PIANO_ROWS.filter((name) => {
    const midi = cbPianoNoteNameToMidi(name);
    if (scope === 'sub') return grooveLabIsBassSubMidi(midi);
    if (scope === 'chord' || scope === 'sample') return grooveLabIsChordStackMidi(midi);
    if (scope === 'guitar') return grooveLabIsGuitarMidi(midi);
    if (scope === 'waveleaf') return waveLeafIsLeadMidi(midi);
    return grooveLabIsMelodyMidi(midi);
  });
}

/** Work-lane register for CH 33–48; undefined = full C1–C6 keyboard. */
export function grooveLabLayerScopeForChannel(
  ch: number,
  chordChannel: number,
  waveLeafChannel: number,
  guitarChannel?: number,
  sampleChannel?: number,
): GrooveLabRollLayerScope | undefined {
  if (ch === chordChannel) return 'chord';
  if (ch === waveLeafChannel) return 'waveleaf';
  if (guitarChannel != null && ch === guitarChannel) return 'guitar';
  if (sampleChannel != null && ch === sampleChannel) return 'sample';
  return undefined;
}

export function grooveLabChannelRoleLabel(
  ch: number,
  chordChannel: number,
  waveLeafChannel: number,
  guitarChannel?: number,
  sampleChannel?: number,
): string {
  if (ch === chordChannel) return 'CHORD';
  if (ch === waveLeafChannel) return GROOVE_LEAD_SHORT_LABEL;
  if (guitarChannel != null && ch === guitarChannel) return 'GUITAR';
  if (sampleChannel != null && ch === sampleChannel) return 'ORCH';
  return `L${ch - CHORD_BASS_SEQ_CHANNEL_BASE + 1}`;
}
