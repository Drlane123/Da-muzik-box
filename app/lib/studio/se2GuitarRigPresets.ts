/**
 * SE2 Guitar rig — golden-era funk tone presets (G-Funk / P-Funk / West Coast).
 * Uses GM guitar + channel FX — original recipes, no commercial VST clone.
 */
import type { Se2GuitarArticulationId } from '@/app/lib/studio/se2GuitarArticulation';
import type { Se2GuitarInstrumentId } from '@/app/lib/studio/se2GuitarInstruments';
import { SE2_GUITAR_FX_DEFAULTS, type Se2GuitarFxSettings } from '@/app/lib/studio/se2GuitarFx';

export type Se2GuitarRigPresetCategory =
  | 'guitar'
  | 'pluck'
  | 'lead'
  | 'talkbox'
  | 'cosmic';

export type Se2GuitarRigPreset = {
  id: string;
  label: string;
  hint: string;
  category: Se2GuitarRigPresetCategory;
  instrumentId: Se2GuitarInstrumentId;
  articulation?: Se2GuitarArticulationId;
  fx: Se2GuitarFxSettings;
};

function fx(partial: Partial<Se2GuitarFxSettings>): Se2GuitarFxSettings {
  return { ...SE2_GUITAR_FX_DEFAULTS, ...partial };
}

export const SE2_GUITAR_RIG_PRESETS: readonly Se2GuitarRigPreset[] = [
  // ── G-Funk guitars ───────────────────────────────────────────────────────
  {
    id: 'gfunk_coast_clean',
    label: 'Coast clean',
    hint: 'West Coast clean — warm body, light chorus pocket',
    category: 'guitar',
    instrumentId: 'electric_guitar_clean',
    fx: fx({ tone: 48, comp: 58, drive: 12, chorus: 32, reverb: 16 }),
  },
  {
    id: 'gfunk_slick_glide',
    label: 'Slick glide',
    hint: 'Slick top line — bright attack, wide chorus shimmer',
    category: 'lead',
    instrumentId: 'electric_guitar_jazz',
    fx: fx({ tone: 62, comp: 52, drive: 18, chorus: 48, reverb: 14 }),
  },
  {
    id: 'gfunk_comp_warm',
    label: 'Comp warm',
    hint: 'Thick clean comp — rubbery chord glue',
    category: 'guitar',
    instrumentId: 'electric_guitar_clean',
    fx: fx({ tone: 42, comp: 68, drive: 8, chorus: 24, reverb: 12 }),
  },
  {
    id: 'gfunk_night_ride',
    label: 'Night ride',
    hint: 'Late-night G — soft drive, smoky room',
    category: 'guitar',
    instrumentId: 'electric_guitar_jazz',
    fx: fx({ tone: 38, comp: 55, drive: 22, chorus: 28, reverb: 26 }),
  },
  {
    id: 'gfunk_grid_chop',
    label: 'Grid chop',
    hint: 'Muted 16th pocket — staccato funk grid',
    category: 'pluck',
    instrumentId: 'electric_guitar_muted',
    articulation: 'pm',
    fx: fx({ tone: 52, comp: 72, drive: 14, chorus: 18, reverb: 8 }),
  },
  {
    id: 'gfunk_cruisin',
    label: 'Cruisin',
    hint: 'Open-road clean — mellow tone, gentle space',
    category: 'guitar',
    instrumentId: 'electric_guitar_clean',
    fx: fx({ tone: 45, comp: 48, drive: 6, chorus: 36, reverb: 22 }),
  },
  {
    id: 'gfunk_sunset',
    label: 'Sunset lead',
    hint: 'Melodic glide — jazz neck, chorus sheen',
    category: 'lead',
    instrumentId: 'electric_guitar_jazz',
    fx: fx({ tone: 58, comp: 46, drive: 20, chorus: 42, reverb: 20 }),
  },
  {
    id: 'gfunk_hydraulic',
    label: 'Hydraulic',
    hint: 'Bouncy rhythm — compressed mute-adjacent feel',
    category: 'pluck',
    instrumentId: 'electric_guitar_muted',
    articulation: 'pm',
    fx: fx({ tone: 50, comp: 76, drive: 10, chorus: 22, reverb: 10 }),
  },
  {
    id: 'gfunk_glass',
    label: 'Glass clean',
    hint: 'Bright clean snap — cuts through mix',
    category: 'guitar',
    instrumentId: 'electric_guitar_clean',
    fx: fx({ tone: 68, comp: 54, drive: 4, chorus: 30, reverb: 12 }),
  },
  {
    id: 'gfunk_slowjam',
    label: 'Slow jam',
    hint: 'Silky ballad clean — lush verb',
    category: 'guitar',
    instrumentId: 'electric_guitar_jazz',
    fx: fx({ tone: 40, comp: 44, drive: 10, chorus: 38, reverb: 32 }),
  },

  // ── P-Funk style ─────────────────────────────────────────────────────────
  {
    id: 'pfunk_analog_grease',
    label: 'Analog grease',
    hint: 'Greasy analog funk — soft saturation, warm body',
    category: 'guitar',
    instrumentId: 'overdriven_guitar',
    fx: fx({ tone: 44, comp: 62, drive: 38, chorus: 34, reverb: 18 }),
  },
  {
    id: 'pfunk_tight_slap',
    label: 'Tight slap',
    hint: 'Slap rhythm — tight mutes, dry pocket',
    category: 'pluck',
    instrumentId: 'electric_guitar_muted',
    articulation: 'pm',
    fx: fx({ tone: 46, comp: 80, drive: 24, chorus: 26, reverb: 10 }),
  },
  {
    id: 'pfunk_wah_bite',
    label: 'Wah bite',
    hint: 'Funk wah color — driven clean bite',
    category: 'talkbox',
    instrumentId: 'electric_guitar_clean',
    fx: fx({ tone: 64, comp: 60, drive: 42, chorus: 52, reverb: 14 }),
  },
  {
    id: 'pfunk_rubber_chord',
    label: 'Rubber chord',
    hint: 'Elastic funk voicings — thick low-mid',
    category: 'guitar',
    instrumentId: 'electric_guitar_jazz',
    fx: fx({ tone: 36, comp: 66, drive: 28, chorus: 30, reverb: 16 }),
  },
  {
    id: 'pfunk_cosmic_crunch',
    label: 'Cosmic crunch',
    hint: 'Cosmic funk crunch — bold attitude',
    category: 'lead',
    instrumentId: 'overdriven_guitar',
    fx: fx({ tone: 52, comp: 58, drive: 48, chorus: 40, reverb: 22 }),
  },
  {
    id: 'pfunk_wide_orbit',
    label: 'Wide orbit',
    hint: 'Wide space funk — chorus wash on overdrive',
    category: 'cosmic',
    instrumentId: 'overdriven_guitar',
    fx: fx({ tone: 48, comp: 50, drive: 35, chorus: 55, reverb: 34 }),
  },
  {
    id: 'pfunk_dry_pocket',
    label: 'Dry pocket',
    hint: 'Dry pocket guitar — locked funk grid',
    category: 'pluck',
    instrumentId: 'electric_guitar_muted',
    articulation: 'pm',
    fx: fx({ tone: 54, comp: 74, drive: 16, chorus: 12, reverb: 6 }),
  },
  {
    id: 'pfunk_bridgewalk',
    label: 'Bridge walk',
    hint: 'Funk bridge comp — chord stabs',
    category: 'guitar',
    instrumentId: 'electric_guitar_clean',
    fx: fx({ tone: 50, comp: 64, drive: 30, chorus: 28, reverb: 14 }),
  },

  // ── Talkbox colors ───────────────────────────────────────────────────────
  {
    id: 'talkbox_vowel_talk',
    label: 'Vowel talk',
    hint: 'Talkbox-adjacent — bright comp + chorus vowel',
    category: 'talkbox',
    instrumentId: 'electric_guitar_clean',
    fx: fx({ tone: 72, comp: 70, drive: 32, chorus: 62, reverb: 12 }),
  },
  {
    id: 'talkbox_silky_glide',
    label: 'Silky glide',
    hint: 'Silky talk lead — jazz + heavy chorus',
    category: 'talkbox',
    instrumentId: 'electric_guitar_jazz',
    fx: fx({ tone: 66, comp: 64, drive: 26, chorus: 68, reverb: 16 }),
  },
  {
    id: 'talkbox_mid_talk',
    label: 'Mid talk',
    hint: 'Classic talkbox funk — mid-forward bite',
    category: 'talkbox',
    instrumentId: 'electric_guitar_clean',
    fx: fx({ tone: 60, comp: 72, drive: 36, chorus: 58, reverb: 10 }),
  },
  {
    id: 'talkbox_auto',
    label: 'Auto wah',
    hint: 'Percussive vowel — pluck + chorus',
    category: 'talkbox',
    instrumentId: 'electric_guitar_muted',
    articulation: 'pm',
    fx: fx({ tone: 58, comp: 68, drive: 28, chorus: 64, reverb: 8 }),
  },
  {
    id: 'talkbox_synth_gtr',
    label: 'Synth guitar',
    hint: 'Synth-adjacent clean — wide and bright',
    category: 'talkbox',
    instrumentId: 'electric_guitar_clean',
    fx: fx({ tone: 70, comp: 56, drive: 18, chorus: 72, reverb: 18 }),
  },
  {
    id: 'talkbox_nasal_funk',
    label: 'Nasal funk',
    hint: 'Robot funk color — tight and nasal',
    category: 'talkbox',
    instrumentId: 'electric_guitar_jazz',
    fx: fx({ tone: 74, comp: 76, drive: 22, chorus: 66, reverb: 8 }),
  },

  // ── Plucks & stabs ───────────────────────────────────────────────────────
  {
    id: 'pluck_funk_bite',
    label: 'Funk pluck',
    hint: 'Snappy percussive — bright funk bite',
    category: 'pluck',
    instrumentId: 'electric_guitar_muted',
    articulation: 'pm',
    fx: fx({ tone: 62, comp: 70, drive: 8, chorus: 16, reverb: 6 }),
  },
  {
    id: 'pluck_disco_stab',
    label: 'Disco stab',
    hint: 'Disco-funk chop — dry and tight',
    category: 'pluck',
    instrumentId: 'electric_guitar_muted',
    articulation: 'pm',
    fx: fx({ tone: 56, comp: 78, drive: 12, chorus: 20, reverb: 4 }),
  },
  {
    id: 'pluck_pick_chop',
    label: 'Pick chop',
    hint: 'Clean articulate chop — tight pick attack',
    category: 'pluck',
    instrumentId: 'electric_guitar_clean',
    articulation: 'pm',
    fx: fx({ tone: 64, comp: 66, drive: 6, chorus: 22, reverb: 8 }),
  },
  {
    id: 'pluck_sparkle_tick',
    label: 'Sparkle tick',
    hint: 'Muted sparkle tick — short and bright',
    category: 'pluck',
    instrumentId: 'electric_guitar_muted',
    articulation: 'pm',
    fx: fx({ tone: 60, comp: 62, drive: 20, chorus: 34, reverb: 10 }),
  },
  {
    id: 'pluck_harmonic',
    label: 'Harm pluck',
    hint: 'Bell harmonic accent — airy top',
    category: 'pluck',
    instrumentId: 'guitar_harmonics',
    fx: fx({ tone: 68, comp: 48, drive: 4, chorus: 28, reverb: 20 }),
  },
  {
    id: 'pluck_acoustic_funk',
    label: 'Acoustic funk',
    hint: 'Steel-string percussive funk rhythm',
    category: 'pluck',
    instrumentId: 'acoustic_guitar_steel',
    articulation: 'pm',
    fx: fx({ tone: 58, comp: 60, drive: 10, chorus: 14, reverb: 12 }),
  },
  {
    id: 'pluck_stab_clean',
    label: 'Clean stab',
    hint: 'One-shot chord stab — short and bright',
    category: 'pluck',
    instrumentId: 'electric_guitar_clean',
    articulation: 'hp',
    fx: fx({ tone: 66, comp: 72, drive: 14, chorus: 18, reverb: 6 }),
  },
  {
    id: 'pluck_section_mute',
    label: 'Section mute',
    hint: 'Horn-section pocket — tight muted rhythm',
    category: 'pluck',
    instrumentId: 'electric_guitar_muted',
    articulation: 'pm',
    fx: fx({ tone: 52, comp: 82, drive: 18, chorus: 16, reverb: 8 }),
  },

  // ── Cosmic washes ────────────────────────────────────────────────────────
  {
    id: 'cosmic_wide_wash',
    label: 'Wide wash',
    hint: 'Lush background spread — cosmic funk pad feel',
    category: 'cosmic',
    instrumentId: 'electric_guitar_jazz',
    fx: fx({ tone: 42, comp: 38, drive: 6, chorus: 58, reverb: 48 }),
  },
  {
    id: 'cosmic_nebula',
    label: 'Nebula',
    hint: 'Wide ambient clean — mood and color',
    category: 'cosmic',
    instrumentId: 'electric_guitar_clean',
    fx: fx({ tone: 44, comp: 36, drive: 4, chorus: 62, reverb: 52 }),
  },
  {
    id: 'cosmic_starlight',
    label: 'Starlight',
    hint: 'Shimmer chords — chorus-heavy space',
    category: 'cosmic',
    instrumentId: 'electric_guitar_jazz',
    fx: fx({ tone: 50, comp: 42, drive: 12, chorus: 66, reverb: 40 }),
  },
  {
    id: 'cosmic_analog_haze',
    label: 'Analog haze',
    hint: 'Thick analog shine — soft drive wash',
    category: 'cosmic',
    instrumentId: 'overdriven_guitar',
    fx: fx({ tone: 46, comp: 44, drive: 22, chorus: 54, reverb: 44 }),
  },
  {
    id: 'cosmic_nylon_dream',
    label: 'Nylon dream',
    hint: 'Warm nylon atmosphere — soulful texture',
    category: 'cosmic',
    instrumentId: 'acoustic_guitar_nylon',
    fx: fx({ tone: 40, comp: 34, drive: 0, chorus: 46, reverb: 46 }),
  },
  {
    id: 'cosmic_sunset_haze',
    label: 'Sunset haze',
    hint: 'West Coast haze — sunset reverb tail',
    category: 'cosmic',
    instrumentId: 'electric_guitar_clean',
    fx: fx({ tone: 38, comp: 40, drive: 14, chorus: 50, reverb: 56 }),
  },

  // ── Lead / solo funk ─────────────────────────────────────────────────────
  {
    id: 'lead_coast_solo',
    label: 'Coast solo',
    hint: 'West Coast lead — singing overdrive',
    category: 'lead',
    instrumentId: 'overdriven_guitar',
    fx: fx({ tone: 58, comp: 52, drive: 55, chorus: 32, reverb: 24 }),
  },
  {
    id: 'lead_rock_funk',
    label: 'Rock funk',
    hint: 'Harder edge lead — distortion sustain',
    category: 'lead',
    instrumentId: 'distortion_guitar',
    fx: fx({ tone: 54, comp: 48, drive: 72, chorus: 28, reverb: 20 }),
  },
  {
    id: 'lead_singing',
    label: 'Singing jazz',
    hint: 'Vocal-like jazz lead — smooth and wide',
    category: 'lead',
    instrumentId: 'electric_guitar_jazz',
    fx: fx({ tone: 56, comp: 46, drive: 24, chorus: 44, reverb: 26 }),
  },
  {
    id: 'lead_bendy',
    label: 'Bendy soul',
    hint: 'Soul bends — warm overdrive',
    category: 'lead',
    instrumentId: 'overdriven_guitar',
    fx: fx({ tone: 48, comp: 50, drive: 42, chorus: 36, reverb: 22 }),
  },
  {
    id: 'lead_arena_funk',
    label: 'Arena funk',
    hint: 'Big stage lead — drive + space',
    category: 'lead',
    instrumentId: 'distortion_guitar',
    fx: fx({ tone: 60, comp: 54, drive: 65, chorus: 38, reverb: 30 }),
  },
  {
    id: 'lead_clean_shine',
    label: 'Clean shine',
    hint: 'Top-line clean lead — bright chorus glide',
    category: 'lead',
    instrumentId: 'electric_guitar_clean',
    fx: fx({ tone: 64, comp: 50, drive: 16, chorus: 46, reverb: 18 }),
  },

  // ── Acoustic / soulful funk colors ───────────────────────────────────────
  {
    id: 'guitar_soul_steel',
    label: 'Soul steel',
    hint: 'Soulful steel-string — warm bounce',
    category: 'guitar',
    instrumentId: 'acoustic_guitar_steel',
    fx: fx({ tone: 46, comp: 52, drive: 8, chorus: 26, reverb: 20 }),
  },
  {
    id: 'guitar_nylon_soul',
    label: 'Nylon soul',
    hint: 'Fingerstyle warmth — classic soul color',
    category: 'guitar',
    instrumentId: 'acoustic_guitar_nylon',
    fx: fx({ tone: 42, comp: 44, drive: 0, chorus: 22, reverb: 24 }),
  },
  {
    id: 'guitar_rnb_clean',
    label: 'R&B clean',
    hint: 'Smooth R&B electric — polished comp',
    category: 'guitar',
    instrumentId: 'electric_guitar_jazz',
    fx: fx({ tone: 50, comp: 60, drive: 10, chorus: 30, reverb: 18 }),
  },
  {
    id: 'guitar_crunch_pocket',
    label: 'Crunch pocket',
    hint: 'Rhythm crunch — funk rock glue',
    category: 'guitar',
    instrumentId: 'overdriven_guitar',
    fx: fx({ tone: 52, comp: 64, drive: 45, chorus: 22, reverb: 12 }),
  },
];

export function se2GuitarRigPresetById(id: string | undefined): Se2GuitarRigPreset | undefined {
  return SE2_GUITAR_RIG_PRESETS.find((p) => p.id === id);
}

export function se2GuitarRigPresetIndex(
  instrumentId: Se2GuitarInstrumentId,
  fx: Se2GuitarFxSettings,
): number {
  const exact = SE2_GUITAR_RIG_PRESETS.findIndex(
    (p) =>
      p.instrumentId === instrumentId &&
      p.fx.drive === fx.drive &&
      p.fx.chorus === fx.chorus &&
      p.fx.reverb === fx.reverb &&
      p.fx.tone === fx.tone &&
      p.fx.comp === fx.comp,
  );
  if (exact >= 0) return exact;
  const byInst = SE2_GUITAR_RIG_PRESETS.findIndex((p) => p.instrumentId === instrumentId);
  return byInst >= 0 ? byInst : 0;
}

export function se2GuitarRigCategoryLabel(cat: Se2GuitarRigPresetCategory): string {
  switch (cat) {
    case 'guitar':
      return 'Guitar';
    case 'pluck':
      return 'Pluck';
    case 'lead':
      return 'Lead';
    case 'talkbox':
      return 'Talkbox';
    case 'cosmic':
      return 'Cosmic';
    default:
      return 'Guitar';
  }
}
