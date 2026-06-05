import {
  BASS_LOW_BASS_PRESETS,
  BASS_LOW_BASS_ORDER,
  playEightZeroEight,
  type BassLowBassPresetId,
  type EightZeroEightPresetDef,
  type Lab808FilterFx,
} from '@/app/lib/creationStation/eightZeroEightVoice';
import { lab808BassCreatedName } from '@/app/lib/creationStation/lab808KickCatalog';
import { GROOVE_LAB_808_SUBROOTS_BANK_LABEL } from '@/app/lib/creationStation/grooveLabBranding';

export type GrooveLabBassSoundId = BassLowBassPresetId;

export interface GrooveLabBassSoundDef {
  id: GrooveLabBassSoundId;
  label: string;
  preset: EightZeroEightPresetDef;
}

export const GROOVE_LAB_BASS_SOUND_DEFAULT: GrooveLabBassSoundId = 'trapLowBass';

export const GROOVE_LAB_BASS_SOUNDS: GrooveLabBassSoundDef[] = BASS_LOW_BASS_ORDER.map((id) => ({
  id,
  label: lab808BassCreatedName(id),
  preset: BASS_LOW_BASS_PRESETS[id],
}));

/** 808 Trap SubRoots keypad + blue roll lane — not bass guitar / Moog (those are melody preview only). */
export const GROOVE_LAB_808_SUBROOT_SOUND_IDS = [
  'trapLowBass',
  'pureSineLow',
  'sineGlide808',
  'hipHopRider',
  'migos808Line',
  'metroSlideBass',
  'zayGlideBass',
  'southBassHold',
  'atlNightBass',
  'drillSubBass',
  'rnbSilkBass',
  'warmTriangle',
  'softSquareLow',
  'filterSweepSine',
] as const satisfies readonly GrooveLabBassSoundId[];

export function grooveLabIs808SubRootSound(id: GrooveLabBassSoundId): boolean {
  return (GROOVE_LAB_808_SUBROOT_SOUND_IDS as readonly GrooveLabBassSoundId[]).includes(id);
}

/** Sound picker groups — sub roots vs melodic bass timbres (Groove blue lane = 808 subs only). */
export const GROOVE_LAB_BASS_SOUND_GROUPS: ReadonlyArray<{
  label: string;
  ids: readonly GrooveLabBassSoundId[];
}> = [
  {
    label: GROOVE_LAB_808_SUBROOTS_BANK_LABEL,
    ids: GROOVE_LAB_808_SUBROOT_SOUND_IDS,
  },
  {
    label: 'Bass Guitar',
    ids: [
      'gtrFinger',
      'gtrPick',
      'gtrFunk',
      'gtrUpright',
      'gtrMuted',
      'gtrReggae',
      'gtrAcoustic',
      'gtrChorus',
    ],
  },
  {
    label: 'Moog Synth',
    ids: [
      'moogMini',
      'moogTaurus',
      'moogClassic',
      'moogFilter',
      'moogDisco',
      'moogBrass',
      'moogRubber',
      'moogFatSub',
    ],
  },
];

export type GrooveLabSoundRole = 'sub' | 'lead';

export function grooveLabDefaultSoundRole(
  soundId: GrooveLabBassSoundId,
  midi: number,
): GrooveLabSoundRole {
  if (grooveLabIs808SubRootSound(soundId)) return 'sub';
  if (midi >= 24 && midi <= 48) return 'sub';
  return 'lead';
}

export function grooveLabBassSoundDef(id: GrooveLabBassSoundId): GrooveLabBassSoundDef {
  return GROOVE_LAB_BASS_SOUNDS.find((s) => s.id === id) ?? GROOVE_LAB_BASS_SOUNDS[0]!;
}

function grooveLabBassFilterFx(preset: EightZeroEightPresetDef): Lab808FilterFx | undefined {
  const fx: Lab808FilterFx = {};
  if (preset.filterHpHz != null && preset.filterHpHz >= 25) fx.hpHz = preset.filterHpHz;
  if (preset.filterLpHz != null && preset.filterLpHz >= 200) fx.lpHz = preset.filterLpHz;
  return fx.hpHz != null || fx.lpHz != null ? fx : undefined;
}

export type PlayGrooveLabBassSoundOpts = {
  /** Keypad preview: one voice at a time. Transport/roll: every note fires. */
  monophonic?: boolean;
  /** Sub = long 808 tail; lead = brighter melodic envelope (guitar / Moog). */
  role?: GrooveLabSoundRole;
};

/** Preview / transport — sub roots use bass lane; melody uses shorter lead lane. */
export function playGrooveLabBassSound(
  ctx: AudioContext,
  midi: number,
  soundId: GrooveLabBassSoundId,
  when = ctx.currentTime + 0.008,
  velocity01 = 0.92,
  bpm = 100,
  holdBeats = 2,
  opts?: PlayGrooveLabBassSoundOpts,
): void {
  const def = grooveLabBassSoundDef(soundId);
  const role = opts?.role ?? grooveLabDefaultSoundRole(soundId, midi);
  const isSub = role === 'sub';
  const leadHold = isSub ? holdBeats : Math.min(holdBeats, 1.35);
  playEightZeroEight(ctx, when, midi, def.preset, 0.88, {
    soundLane: isSub ? 'bass' : 'kick',
    kickKeyboardMap: true,
    subOscOnly: isSub,
    kickMonophonic: opts?.monophonic !== false,
    velocity01,
    bpm,
    holdBeats: leadHold,
    filterFx: grooveLabBassFilterFx(def.preset),
  });
}
