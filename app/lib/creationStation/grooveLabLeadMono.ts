/**
 * Shared monophonic choke for MELODY — synth voices and guitar lick samples use separate stop maps;
 * both must be cut on a new note or the lane stacks (heard as "ba, ba" under one timbre).
 */
import { truncateGrooveLabGuitarLickMonoGroup } from '@/app/lib/creationStation/grooveLabGuitarLickBank';
import { truncateGrooveLabLeadVoiceMonoGroup } from '@/app/lib/creationStation/grooveLabLeadVoices';

/** One shared mono bus — transport + roll preview cannot stack two lead voices. */
export const GROOVE_LAB_MELODY_MONO_GROUP = 'groove-melody-lead';
export const GROOVE_LAB_GUITAR_MONO_GROUP = 'groove-guitar-lane';
/** @deprecated Use {@link GROOVE_LAB_MELODY_MONO_GROUP}. */
export const GROOVE_LAB_MELODY_MONO_GROUP_TRANSPORT = GROOVE_LAB_MELODY_MONO_GROUP;
/** @deprecated Use {@link GROOVE_LAB_MELODY_MONO_GROUP}. */
export const GROOVE_LAB_MELODY_MONO_GROUP_PREVIEW = GROOVE_LAB_MELODY_MONO_GROUP;

export function truncateGrooveLabLeadMonoGroup(whenSec: number, group: string): void {
  truncateGrooveLabLeadVoiceMonoGroup(whenSec, group);
  truncateGrooveLabGuitarLickMonoGroup(whenSec, group);
}

/** Stop transport + roll-preview lead voices (separate mono groups, same timbre). */
export function haltGrooveLabMelodyLeadVoices(whenSec: number): void {
  truncateGrooveLabLeadMonoGroup(whenSec, GROOVE_LAB_MELODY_MONO_GROUP);
  truncateGrooveLabLeadMonoGroup(whenSec, GROOVE_LAB_GUITAR_MONO_GROUP);
}
