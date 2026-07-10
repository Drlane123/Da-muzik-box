/**
 * Geno Ultra — one-click arp melody presets (sound + style pattern + arp settings).
 */
import { genoUltraArpBpmForMelodyTag } from '@/app/lib/studio/genoUltraArpGenreBpm';
import {
  applyGenoArpStylePreset,
  findGenoArpStylePreset,
} from '@/app/lib/studio/genoUltraArpStylePresets';
import {
  emptyGenoArpLaneLevels,
  GENO_ARP_ORDERS,
  type GenoArpBarLength,
  type GenoArpBarOctShift,
  type GenoArpGlobalOctShift,
  type GenoArpOctRange,
  type GenoArpVariation,
} from '@/app/lib/studio/genoUltraArpPattern';
import { clampGenoUltraArpBpm } from '@/app/lib/studio/genoUltraArpState';
import type { GenoArpChordType } from '@/app/lib/studio/genoUltraArpHarmony';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { NeuralHumScaleId } from '@/app/lib/vocalLab/neuralHumKeyLock';
import {
  GENO_ARP_STEP_CLIMB_STYLE_PRESETS,
  GENO_ULTRA_STEP_CLIMB_MELODIES,
  type StepClimbSeq,
} from '@/app/lib/studio/genoUltraArpStepClimbMelodies';

export type GenoUltraArpMelodyTag =
  | '70s'
  | 'night'
  | 'trap'
  | 'hiphop'
  | 'house'
  | 'dance'
  | 'techno'
  | 'electro'
  | 'horror'
  | 'keys'
  | 'bass'
  | 'siberian'
  | 'step-climb';

/** Optional Retrologue step-sequencer programming (STEP / HITS / VEL / CTRL). */
export type GenoUltraArpMelodyStepSeq = StepClimbSeq;

export type GenoUltraArpMelodyPreset = {
  id: string;
  label: string;
  tag: GenoUltraArpMelodyTag;
  /** Synth patch from GENO_ULTRA_SYNTH_PRESETS. */
  soundPresetId: string;
  /** Step pattern from GENO_ARP_STYLE_PRESETS. */
  stylePresetId: string;
  barLength?: GenoArpBarLength;
  arpVariation?: GenoArpVariation;
  octRange?: GenoArpOctRange;
  orderInversion?: boolean;
  /** Harmony root pitch class 0–11 (C=0). */
  keyPitchClass?: number;
  /** Scale + chord type applied with the melody (keeps patterns in key). */
  keyMode?: StudioDetectedKeyMode;
  arpScaleId?: NeuralHumScaleId;
  arpChordType?: GenoArpChordType;
  octShift?: GenoArpGlobalOctShift;
  /** Override genre-average tempo when this preset has a known pocket. */
  bpm?: number;
  description?: string;
  /** When set, loads STEP / HITS / VEL / CTRL (not blank). */
  stepSeq?: GenoUltraArpMelodyStepSeq;
};

export const GENO_ULTRA_ARP_MELODY_TAGS: readonly { id: GenoUltraArpMelodyTag; label: string }[] = [
  { id: '70s', label: '70s / Funk' },
  { id: 'night', label: 'Night' },
  { id: 'trap', label: 'Trap' },
  { id: 'hiphop', label: 'Hip Hop' },
  { id: 'house', label: 'House' },
  { id: 'dance', label: 'Dance' },
  { id: 'techno', label: 'Techno' },
  { id: 'electro', label: 'Electro / 80s' },
  { id: 'horror', label: 'Horror / Slasher' },
  { id: 'keys', label: 'Keys / Pluck' },
  { id: 'bass', label: 'Bass Lines' },
  { id: 'siberian', label: 'Siberian Nights' },
  { id: 'step-climb', label: 'Step Climbing' },
];

const GENO_ULTRA_ARP_MELODY_PRESETS_CORE: readonly GenoUltraArpMelodyPreset[] = [
  // 70s / funk (~110–118)
  { id: 'melody-disco-fever', label: 'Disco Fever', tag: '70s', soundPresetId: 'ultra-boogie-bass', stylePresetId: 'house-disco', keyPitchClass: 5, bpm: 118, description: 'Boogie bass + disco offbeat arp' },
  { id: 'melody-funk-groove', label: 'Funk Groove', tag: '70s', soundPresetId: 'ultra-rubber-funk', stylePresetId: 'hiphop-gfunk', keyPitchClass: 9, bpm: 108, description: 'Rubber funk + G-funk bounce' },
  { id: 'melody-soul-keys', label: 'Soul Keys', tag: '70s', soundPresetId: 'ultra-stage-keys', stylePresetId: 'logic-upbeat-pump', keyPitchClass: 2, arpVariation: 1, bpm: 96 },
  { id: 'melody-retro-pluck', label: 'Retro Pluck', tag: '70s', soundPresetId: 'ultra-guitar-pluck', stylePresetId: 'hiphop-boom-bap', keyPitchClass: 7, bpm: 92 },
  { id: 'melody-wah-guitar', label: 'Wah Guitar', tag: '70s', soundPresetId: 'ultra-wah-guitar', stylePresetId: 'hiphop-gfunk', keyPitchClass: 9, bpm: 98, description: 'Classic wah sweep + delayed repeats' },
  { id: 'melody-funk-wah', label: 'Funk Wah', tag: '70s', soundPresetId: 'ultra-wah-funk', stylePresetId: 'house-disco', keyPitchClass: 5, bpm: 110, description: 'Slow lazy wah + long delay trail' },
  { id: 'melody-cry-wah', label: 'Cry Wah', tag: '70s', soundPresetId: 'ultra-wah-cry', stylePresetId: 'logic-upbeat-pump', keyPitchClass: 2, bpm: 112, description: 'Fast vocal wah + bright bite' },
  { id: 'melody-velvet-disco', label: 'Velvet Disco', tag: '70s', soundPresetId: 'ultra-velvet-lead', stylePresetId: 'house-disco', octRange: 2, keyPitchClass: 0, bpm: 118 },
  // Night / dark (~85–95, techno-night a bit faster)
  { id: 'melody-midnight-trap', label: 'Midnight Trap', tag: 'night', soundPresetId: 'ultra-trap-sub', stylePresetId: 'trap-night-ride', keyPitchClass: 8, bpm: 140 },
  { id: 'melody-dark-cinema', label: 'Dark Cinema', tag: 'night', soundPresetId: 'ultra-dark-cine', stylePresetId: 'trap-dark-pluck', barLength: 4, keyPitchClass: 3, bpm: 84 },
  { id: 'melody-night-drive', label: 'Night Drive', tag: 'night', soundPresetId: 'ultra-neon-lead', stylePresetId: 'techno-rumble', octRange: 2, keyPitchClass: 10, bpm: 128 },
  { id: 'melody-ghost-pad', label: 'Ghost Pad', tag: 'night', soundPresetId: 'ultra-ghost-fx', stylePresetId: 'logic-echoed-cycle', barLength: 4, keyPitchClass: 5, bpm: 80 },
  { id: 'melody-memphis-night', label: 'Memphis Night', tag: 'night', soundPresetId: 'ultra-growl-808', stylePresetId: 'trap-memphis-drip', keyPitchClass: 1, bpm: 138 },
  { id: 'melody-shimmer-night', label: 'Shimmer Night', tag: 'night', soundPresetId: 'ultra-shimmer-pad', stylePresetId: 'dance-mainstage', barLength: 4, keyPitchClass: 4, bpm: 126 },
  // Trap
  { id: 'melody-atl-roll', label: 'ATL Roll', tag: 'trap', soundPresetId: 'ultra-phase-bass', stylePresetId: 'trap-atl-roll', keyPitchClass: 6 },
  { id: 'melody-future-flip', label: 'Future Flip', tag: 'trap', soundPresetId: 'ultra-supersaw-hook', stylePresetId: 'trap-future-flip', keyPitchClass: 9 },
  { id: 'melody-808-slide', label: '808 Slide', tag: 'trap', soundPresetId: 'ultra-dub-sub', stylePresetId: 'trap-southside-slide', keyPitchClass: 4 },
  { id: 'melody-digi-trap', label: 'Digi Trap', tag: 'trap', soundPresetId: 'ultra-digi-pluck', stylePresetId: 'trap-dark-pluck', keyPitchClass: 11 },
  { id: 'melody-wobble-trap', label: 'Wobble Trap', tag: 'trap', soundPresetId: 'ultra-wobble-bass', stylePresetId: 'trap-hat-ladder', keyPitchClass: 8 },
  { id: 'melody-crystal-trap', label: 'Crystal Trap', tag: 'trap', soundPresetId: 'ultra-crystal-pluck', stylePresetId: 'trap-ogx-bounce', keyPitchClass: 2 },
  // Hip hop (boom bap ~90, drill ~140, G-funk ~98)
  { id: 'melody-drill-slide', label: 'Drill Slide', tag: 'hiphop', soundPresetId: 'ultra-deep-roller', stylePresetId: 'hiphop-drill', keyPitchClass: 10, bpm: 140 },
  { id: 'melody-boom-bap', label: 'Boom Bap', tag: 'hiphop', soundPresetId: 'ultra-moog-bass', stylePresetId: 'hiphop-boom-bap', keyPitchClass: 0, bpm: 90 },
  { id: 'melody-gfunk-lead', label: 'G-Funk Lead', tag: 'hiphop', soundPresetId: 'ultra-chorus-lead', stylePresetId: 'hiphop-gfunk', keyPitchClass: 7, bpm: 98 },
  // House / dance / techno
  { id: 'melody-deep-house', label: 'Deep House', tag: 'house', soundPresetId: 'ultra-warehouse', stylePresetId: 'house-deep', barLength: 4, keyPitchClass: 5, bpm: 122 },
  { id: 'melody-offbeat-groove', label: 'Offbeat Groove', tag: 'house', soundPresetId: 'ultra-slap-house', stylePresetId: 'house-offbeat', keyPitchClass: 9, bpm: 124 },
  { id: 'melody-berlin-night', label: 'Berlin Night', tag: 'techno', soundPresetId: 'ultra-laser-lead', stylePresetId: 'techno-berlin-16', keyPitchClass: 3, bpm: 132 },
  { id: 'melody-acid-trip', label: 'Acid Trip', tag: 'techno', soundPresetId: 'ultra-acid-line', stylePresetId: 'techno-acid', keyPitchClass: 6, bpm: 130 },
  // Electro / 80s — horror-movie Computer Age (8-bar octave yo-yo, same speed/sync)
  { id: 'melody-computer-age', label: 'Computer Age', tag: 'electro', soundPresetId: 'ultra-horror-keys', stylePresetId: 'electro-computer-age', barLength: 8, keyPitchClass: 0, description: 'Horror keys — dark 303 sync, octave drop every 2 bars' },
  { id: 'melody-age-sync', label: 'Age Syncop', tag: 'electro', soundPresetId: 'ultra-dread-lead', stylePresetId: 'electro-age-sync', barLength: 8, keyPitchClass: 5, description: 'Dread lead — syncopated horror pocket' },
  { id: 'melody-age-offbeat', label: 'Age Offbeat', tag: 'electro', soundPresetId: 'ultra-haunt-keys', stylePresetId: 'electro-age-offbeat', barLength: 8, keyPitchClass: 9, description: 'Haunted offbeat keys — mysterious minor' },
  { id: 'melody-age-stutter', label: 'Age Stutter', tag: 'electro', soundPresetId: 'ultra-evil-arp', stylePresetId: 'electro-age-stutter', barLength: 8, keyPitchClass: 2, description: 'Evil arp stutter — dark bandpass' },
  { id: 'melody-age-pulse', label: 'Age Pulse', tag: 'electro', soundPresetId: 'ultra-shock-keys', stylePresetId: 'electro-age-pulse', barLength: 8, keyPitchClass: 7, description: 'Shock keys — cinematic horror pulse' },
  { id: 'melody-age-machine', label: 'Age Machine', tag: 'electro', soundPresetId: 'ultra-phantom-stab', stylePresetId: 'electro-age-machine', barLength: 8, keyPitchClass: 4, description: 'Phantom stab — evil machine alternation' },
  // Cybotron Clear (1983) — Detroit electro @ ~125
  { id: 'melody-clear-rise', label: 'Clear Rise', tag: 'electro', soundPresetId: 'ultra-wire-lead', stylePresetId: 'electro-clear-rise', barLength: 4, keyPitchClass: 11, bpm: 125, description: 'Cybotron Clear — chromatic 16th climb (B minor)' },
  { id: 'melody-clear-pre', label: 'Clear Pre', tag: 'electro', soundPresetId: 'ultra-porta-lead', stylePresetId: 'electro-clear-pre', barLength: 4, keyPitchClass: 11, bpm: 125, description: 'Clear pre-chorus — ascending run + robotic rest' },
  { id: 'melody-clear-run', label: 'Clear Run', tag: 'electro', soundPresetId: 'ultra-digi-pluck', stylePresetId: 'electro-clear-run', barLength: 4, keyPitchClass: 11, bpm: 125, description: 'Clear pre-chorus — up/down chromatic 16th run' },
  // Electric Kingdom (Twilight 22) — @ 127
  { id: 'melody-kingdom-groove', label: 'Kingdom Groove', tag: 'bass', soundPresetId: 'ultra-kingdom-bass', stylePresetId: 'electro-kingdom-groove', barLength: 4, octShift: 0, keyPitchClass: 6, bpm: 127, description: 'Electric Kingdom — syncopated Odyssey bass riff (F# minor)' },
  { id: 'melody-kingdom-oct', label: 'Kingdom Oct', tag: 'bass', soundPresetId: 'ultra-boogie-bass', stylePresetId: 'electro-kingdom-oct', barLength: 4, octShift: 0, keyPitchClass: 6, bpm: 127, description: 'Electric Kingdom — root/octave bounce bass' },
  { id: 'melody-kingdom-pulse', label: 'Kingdom Pulse', tag: 'bass', soundPresetId: 'ultra-dub-sub', stylePresetId: 'electro-kingdom-pulse', barLength: 4, octShift: 0, keyPitchClass: 6, bpm: 127, description: 'Electric Kingdom — 808 sub under kick pocket' },
  // Siberian Nights (Twilight 22) — @ 130
  { id: 'melody-siberian-funk', label: 'Sib Funk', tag: 'siberian', soundPresetId: 'ultra-siberian-moog', stylePresetId: 'electro-siberian-funk', barLength: 4, octShift: 0, keyPitchClass: 9, description: 'Siberian Nights — syncopated poppy Moog funk bass' },
  { id: 'melody-siberian-stomp', label: 'Sib Stomp', tag: 'siberian', soundPresetId: 'ultra-siberian-moog', stylePresetId: 'electro-siberian-stomp', barLength: 4, octShift: 0, keyPitchClass: 9, description: 'Siberian Nights — stomp pulse + octave pop' },
  { id: 'melody-siberian-motor', label: 'Sib Motor', tag: 'siberian', soundPresetId: 'ultra-siberian-moog', stylePresetId: 'electro-siberian-motor', barLength: 4, octShift: 0, keyPitchClass: 9, description: 'Pure 16th Moog root — ba-ba-ba-ba drive, one note' },
  { id: 'melody-siberian-8th', label: 'Sib 8th', tag: 'siberian', soundPresetId: 'ultra-siberian-moog', stylePresetId: 'electro-siberian-8th', barLength: 4, octShift: 0, keyPitchClass: 9, description: '8th-note Moog pump — same root, repeating 80s drive' },
  { id: 'melody-siberian-lock', label: 'Sib Lock', tag: 'siberian', soundPresetId: 'ultra-siberian-moog', stylePresetId: 'electro-siberian-lock', barLength: 4, octShift: 0, keyPitchClass: 9, description: 'Locked 16th root loop — one beat breath, then repeats' },
  { id: 'melody-siberian-lead', label: 'Sib Lead', tag: 'siberian', soundPresetId: 'ultra-laser-lead', stylePresetId: 'electro-siberian-lead', barLength: 4, octShift: 1, keyPitchClass: 9, description: 'Siberian Nights — Prophet lead arp phrase' },
  { id: 'melody-siberian-ice', label: 'Sib Ice', tag: 'siberian', soundPresetId: 'ultra-wire-lead', stylePresetId: 'electro-siberian-ice', barLength: 4, octShift: 1, keyPitchClass: 9, description: 'Siberian Nights — icy chromatic 16th climb' },
  { id: 'melody-siberian-hook', label: 'Sib Hook', tag: 'siberian', soundPresetId: 'ultra-bright-hook', stylePresetId: 'electro-siberian-hook', barLength: 4, octShift: 1, keyPitchClass: 9, description: 'Siberian Nights — catchy verse hook arp' },
  // Horror / slasher — minor voicing, in-key triad patterns
  { id: 'melody-horror-michael', label: 'Halloween', tag: 'horror', soundPresetId: 'ultra-michael-pluck', stylePresetId: 'horror-michael', barLength: 8, octShift: 0, keyPitchClass: 3, keyMode: 'minor', arpScaleId: 'minor', arpChordType: 'min7', bpm: 118, description: 'Minor triad crawl — Halloween pluck in key' },
  { id: 'melody-horror-camp', label: 'Camp 13th', tag: 'horror', soundPresetId: 'ultra-camp-pluck', stylePresetId: 'horror-camp', barLength: 8, octShift: 0, keyPitchClass: 5, keyMode: 'minor', arpScaleId: 'minor', arpChordType: 'min', bpm: 120, description: 'Root–fifth pulse — Friday 13th in key' },
  { id: 'melody-horror-creep', label: 'Jason Creep', tag: 'horror', soundPresetId: 'ultra-creep-pluck', stylePresetId: 'horror-creep', barLength: 8, octShift: 0, keyPitchClass: 8, keyMode: 'minor', arpScaleId: 'minor', arpChordType: 'min7', bpm: 122, description: 'Slow minor crawl — chord tones only' },
  { id: 'melody-horror-rush', label: 'Slasher Rush', tag: 'horror', soundPresetId: 'ultra-creep-pluck', stylePresetId: 'horror-rush', barLength: 8, octShift: 0, keyPitchClass: 8, keyMode: 'minor', arpScaleId: 'minor', arpChordType: 'min7', bpm: 128, description: 'Double-time minor crawl — faster chase, still in key' },
  { id: 'melody-horror-stab', label: 'Slasher Stab', tag: 'horror', soundPresetId: 'ultra-stab-pluck', stylePresetId: 'horror-stab', barLength: 8, octShift: 0, keyPitchClass: 0, keyMode: 'minor', arpScaleId: 'minor', arpChordType: 'min', bpm: 124, description: 'Syncopated minor triad stabs — in key' },
  { id: 'melody-push-button', label: 'Push the Button', tag: 'electro', soundPresetId: 'ultra-acid-line', stylePresetId: 'electro-push-button', keyPitchClass: 5, description: 'Slow half-bar → stacked burst at the button' },
  { id: 'melody-303-bounce', label: '303 Bounce', tag: 'electro', soundPresetId: 'ultra-porta-lead', stylePresetId: 'electro-303-bounce', keyPitchClass: 9, octRange: 2 },
  { id: 'melody-jam-sync', label: 'Jam Sync', tag: 'electro', soundPresetId: 'ultra-wire-lead', stylePresetId: 'electro-jam-sync', keyPitchClass: 7, description: 'Ping-pong sync lead with robotic gaps' },
  { id: 'melody-bounce-drop', label: 'Bounce Drop', tag: 'electro', soundPresetId: 'ultra-crystal-pluck', stylePresetId: 'electro-bounce-drop', barLength: 4, keyPitchClass: 0, description: 'Bouncy pluck — 2 bars then octave drop' },
  { id: 'melody-bounce-lift', label: 'Bounce Lift', tag: 'electro', soundPresetId: 'ultra-digi-pluck', stylePresetId: 'electro-bounce-lift', barLength: 4, keyPitchClass: 5, description: 'Ping-pong pluck — 2 bars then octave up' },
  { id: 'melody-bounce-pump', label: 'Bounce Pump', tag: 'electro', soundPresetId: 'ultra-guitar-pluck', stylePresetId: 'electro-bounce-pump', barLength: 4, keyPitchClass: 9, description: 'Tight staccato pluck — lift bar 3, drop bar 4' },
  { id: 'melody-euro-anthem', label: 'Euro Anthem', tag: 'dance', soundPresetId: 'ultra-bright-hook', stylePresetId: 'dance-anthem-run', octRange: 2, keyPitchClass: 0, bpm: 138 },
  { id: 'melody-festival-rise', label: 'Festival Rise', tag: 'dance', soundPresetId: 'ultra-grand-rise', stylePresetId: 'dance-festival-rise', barLength: 4, keyPitchClass: 7, bpm: 128, description: 'Grand finale rise into the drop' },
  { id: 'melody-cinema-rise', label: 'Cinema Rise', tag: 'dance', soundPresetId: 'ultra-cinema-rise', stylePresetId: 'dance-festival-rise', barLength: 4, keyPitchClass: 0, bpm: 100, description: 'Movie-style slow build to climax' },
  { id: 'melody-trance-lift', label: 'Trance Lift', tag: 'dance', soundPresetId: 'ultra-dream-lead', stylePresetId: 'dance-trance-lift', octRange: 2, keyPitchClass: 2, bpm: 138 },
  // Keys / R&B / ballad — maj7 voicing, diatonic pluck patterns
  { id: 'melody-rhodes-groove', label: 'Rhodes Groove', tag: 'keys', soundPresetId: 'ultra-rhodes-keys', stylePresetId: 'keys-rhodes-groove', keyPitchClass: 4, keyMode: 'major', arpScaleId: 'major', arpChordType: 'maj7', octShift: 0, bpm: 88, description: 'Syncopated Rhodes — offbeat maj7 in key' },
  { id: 'melody-marimba-glow', label: 'Marimba Glow', tag: 'keys', soundPresetId: 'ultra-marimba-pluck', stylePresetId: 'keys-marimba-glow', keyPitchClass: 9, keyMode: 'major', arpScaleId: 'major-pentatonic', arpChordType: 'maj7', octShift: 0, bpm: 100, description: 'Bouncy marimba — root–third–fifth in key' },
  { id: 'melody-harp-sparkle', label: 'Harp Sparkle', tag: 'keys', soundPresetId: 'ultra-harp-spark', stylePresetId: 'keys-harp-sparkle', keyPitchClass: 5, keyMode: 'major', arpScaleId: 'major', arpChordType: 'add9', octShift: 0, bpm: 96, description: 'Rolling harp arpeggio — in-key resolve' },
  { id: 'melody-lounge-organ', label: 'Lounge Organ', tag: 'keys', soundPresetId: 'ultra-lounge-organ', stylePresetId: 'keys-lounge-organ', barLength: 4, keyPitchClass: 0, keyMode: 'major', arpScaleId: 'major', arpChordType: 'maj7', octShift: 0, bpm: 78, description: 'Slow organ cycle — chord tones in key' },
  { id: 'melody-ballad-arp', label: 'Ballad Arp', tag: 'keys', soundPresetId: 'ultra-ballad-keys', stylePresetId: 'keys-ballad-arp', keyPitchClass: 2, keyMode: 'major', arpScaleId: 'major', arpChordType: 'maj7', octShift: 0, bpm: 72, description: 'Gentle ballad spread — maj7 in key' },
];

const MELODY_TAG_HARMONY_DEFAULTS: Partial<
  Record<
    GenoUltraArpMelodyTag,
    { keyMode: StudioDetectedKeyMode; arpScaleId: NeuralHumScaleId; arpChordType: GenoArpChordType }
  >
> = {
  horror: { keyMode: 'minor', arpScaleId: 'minor', arpChordType: 'min7' },
  keys: { keyMode: 'major', arpScaleId: 'major', arpChordType: 'maj7' },
};

export const GENO_ULTRA_ARP_MELODY_PRESETS: readonly GenoUltraArpMelodyPreset[] = [
  ...GENO_ULTRA_ARP_MELODY_PRESETS_CORE,
  ...(GENO_ULTRA_STEP_CLIMB_MELODIES as unknown as GenoUltraArpMelodyPreset[]),
];

export type GenoUltraArpMelodyApplyPatch = {
  stylePresetId: string;
  barLength: GenoArpBarLength;
  rateIdx: number;
  gate: number;
  swing: number;
  orderIdx: number;
  arpVariation: GenoArpVariation;
  octRange: GenoArpOctRange;
  orderInversion: boolean;
  keyPitchClass?: number;
  keyMode?: StudioDetectedKeyMode;
  arpScaleId?: NeuralHumScaleId;
  arpChordType?: GenoArpChordType;
  /** Genre-typical (or preset-specific) local ARP tempo. */
  bpm: number;
  grid: boolean[][];
  mod1Levels: number[];
  mod2Levels: number[];
  velLevels: number[];
  presetLock: true;
  barOctShifts?: GenoArpBarOctShift[];
  octShift?: GenoArpGlobalOctShift;
  /** When set, STEP / HITS / VEL / CTRL are programmed (not blank). */
  stepSeq?: GenoUltraArpMelodyStepSeq;
};

export function genoUltraArpMelodyPresetById(id: string): GenoUltraArpMelodyPreset | undefined {
  return GENO_ULTRA_ARP_MELODY_PRESETS.find((p) => p.id === id);
}

/** Preset override, else genre-average for the melody tag. */
export function genoUltraArpBpmForMelodyPreset(melody: GenoUltraArpMelodyPreset): number {
  if (melody.bpm != null) return clampGenoUltraArpBpm(melody.bpm);
  return genoUltraArpBpmForMelodyTag(melody.tag);
}

export function buildGenoUltraArpMelodyApplyPatch(
  melody: GenoUltraArpMelodyPreset,
  currentBarLength: GenoArpBarLength,
  currentOrderIdx: number,
  currentArpVariation: GenoArpVariation,
  currentOctRange: GenoArpOctRange,
  currentOrderInversion: boolean,
): GenoUltraArpMelodyApplyPatch | null {
  const style =
    GENO_ARP_STEP_CLIMB_STYLE_PRESETS.find((p) => p.id === melody.stylePresetId) ??
    findGenoArpStylePreset(melody.stylePresetId);
  if (!style) return null;

  const barLength = melody.barLength ?? currentBarLength;
  const applied = applyGenoArpStylePreset(style, barLength);
  let orderIdx = currentOrderIdx;
  if (style.order) {
    const idx = GENO_ARP_ORDERS.indexOf(style.order);
    if (idx >= 0) orderIdx = idx;
  }

  /**
   * Step Climbing: note-grid melody only — blank STEP / HITS / VEL / CTRL.
   * (Programmed step lanes made every climb sound the same; grid carries the tune.)
   */
  const stepClimbOnly = melody.tag === 'step-climb';
  const tagHarmony = MELODY_TAG_HARMONY_DEFAULTS[melody.tag];
  const keyMode = melody.keyMode ?? tagHarmony?.keyMode;
  const arpScaleId = melody.arpScaleId ?? tagHarmony?.arpScaleId;
  const arpChordType = melody.arpChordType ?? tagHarmony?.arpChordType;

  return {
    stylePresetId: melody.stylePresetId,
    barLength,
    rateIdx: applied.rateIdx,
    gate: applied.gate,
    swing: applied.swing,
    orderIdx,
    arpVariation: melody.arpVariation ?? currentArpVariation,
    octRange: melody.octRange ?? currentOctRange,
    orderInversion: melody.orderInversion ?? currentOrderInversion,
    keyPitchClass: melody.keyPitchClass,
    keyMode,
    arpScaleId,
    arpChordType,
    bpm: genoUltraArpBpmForMelodyPreset(melody),
    grid: applied.grid,
    mod1Levels: stepClimbOnly ? emptyGenoArpLaneLevels(0) : applied.mod1Levels,
    mod2Levels: stepClimbOnly ? emptyGenoArpLaneLevels(0) : applied.mod2Levels,
    velLevels: stepClimbOnly ? emptyGenoArpLaneLevels(0) : applied.velLevels,
    barOctShifts: applied.barOctShifts,
    octShift: melody.octShift ?? applied.octShift,
    presetLock: true,
    stepSeq: stepClimbOnly ? undefined : melody.stepSeq,
  };
}
