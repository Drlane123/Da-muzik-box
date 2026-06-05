/**
 * Groove Lab — guitar lane timbres (wah sample licks + bar triggers only).
 */
import { isGuitarLickSampleId } from '@/app/lib/creationStation/grooveLabGuitarLickBank';
import {
  grooveLabNormalizeLeadSoundId,
  type GrooveLabAnyLeadSoundId,
} from '@/app/lib/creationStation/grooveLabLeadSounds';

export type GrooveGuitarSoundCategory = 'wah' | 'bar' | 'stab';

export type GrooveGuitarSoundDef = {
  id: GrooveLabAnyLeadSoundId;
  label: string;
  describe: string;
};

export const GROOVE_GUITAR_SOUND_CATEGORIES: { id: GrooveGuitarSoundCategory; label: string }[] = [
  { id: 'wah', label: 'WAH' },
  { id: 'bar', label: 'BAR' },
  { id: 'stab', label: 'STAB' },
];

export const GROOVE_GUITAR_SOUNDS_BY_CATEGORY: Record<
  GrooveGuitarSoundCategory,
  readonly GrooveGuitarSoundDef[]
> = {
  wah: [
    { id: 'lickSample_wahClean', label: 'Wah clean', describe: 'Live wah — clean bar lick.' },
    { id: 'lickSample_wahDrive', label: 'Wah drive', describe: 'Funky wah drive — full bar.' },
  ],
  bar: [
    { id: 'lickSample_bluesRiff', label: 'Blues', describe: 'Blues riff — one bar per column.' },
    { id: 'lickSample_arenaHook', label: 'Arena', describe: 'Rock hook bar lick.' },
    { id: 'lickSample_neoSoulBend', label: 'Soul', describe: 'Neo-soul bend bar.' },
    { id: 'lickSample_slideSoul', label: 'Slide', describe: 'Slide soul phrase.' },
    { id: 'lickSample_cleanPick', label: 'Pick', describe: 'Clean picked bar.' },
    { id: 'lickSample_palmMute', label: 'Mute', describe: 'Palm-muted rhythm bar.' },
    { id: 'lickSample_chimeHarmonic', label: 'Chime', describe: 'Harmonic chime bar.' },
  ],
  stab: [
    { id: 'lickSample_wahClean', label: 'Wah', describe: 'Single wah hit at column 1.' },
    { id: 'lickSample_wahDrive', label: 'Drive', describe: 'Single wah-drive stab.' },
    { id: 'lickSample_cleanPick', label: 'Pick', describe: 'One-shot pick.' },
    { id: 'lickSample_chimeHarmonic', label: 'Harm', describe: 'One-shot harmonic.' },
  ],
};

export const GROOVE_GUITAR_SOUND_MAP: Record<string, GrooveGuitarSoundDef> = (() => {
  const acc: Record<string, GrooveGuitarSoundDef> = {};
  for (const cat of GROOVE_GUITAR_SOUND_CATEGORIES) {
    for (const s of GROOVE_GUITAR_SOUNDS_BY_CATEGORY[cat.id]) {
      acc[s.id] = s;
    }
  }
  return acc;
})();

export const GROOVE_GUITAR_SOUND_DEFAULT: GrooveLabAnyLeadSoundId = 'lickSample_wahClean';

/** Never fall back to melody timbre — guitar lane uses lick samples or guitar default. */
export function resolveGrooveLabGuitarSoundId(raw?: string | null): GrooveLabAnyLeadSoundId {
  if (raw && isGuitarLickSampleId(raw)) return raw;
  if (raw) {
    const norm = grooveLabNormalizeLeadSoundId(raw);
    if (isGuitarLickSampleId(norm)) return norm;
  }
  return GROOVE_GUITAR_SOUND_DEFAULT;
}
