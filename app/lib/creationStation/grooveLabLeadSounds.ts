import {
  grooveLabGuitarBankVoiceMix,
  grooveLabLeadBankVoiceMix,
} from '@/app/lib/creationStation/grooveLabLayers';
import { grooveLabClampGuitarMidi, grooveLabClampMelodyMidi } from '@/app/lib/creationStation/grooveLabPitch';
import {
  GROOVE_LAB_LEAD_PRESETS,
  GROOVE_LAB_LEAD_SOUND_ORDER,
  playGrooveLabLeadVoice,
  type GrooveLabLeadPresetDef,
  type GrooveLabLeadSoundId,
  type PlayGrooveLabLeadVoiceOpts,
} from '@/app/lib/creationStation/grooveLabLeadVoices';
import {
  ensureGuitarLickBuffer,
  getGuitarLickDef,
  getLoadedGuitarLickDefs,
  guitarLickBufferReady,
  isGuitarLickSampleId,
  loadedGuitarLickLabelById,
  playGuitarLickSample,
  type GuitarLickId,
} from '@/app/lib/creationStation/grooveLabGuitarLickBank';
import { grooveLabGuitarLickPlayOpts } from '@/app/lib/creationStation/grooveLabGuitarLickBank';
import {
  GROOVE_LAB_GUITAR_MONO_GROUP,
  GROOVE_LAB_MELODY_MONO_GROUP,
  truncateGrooveLabLeadMonoGroup,
} from '@/app/lib/creationStation/grooveLabLeadMono';

/** Synth preset IDs + dynamic sample lick IDs. */
export type GrooveLabAnyLeadSoundId = GrooveLabLeadSoundId | GuitarLickId;

export type { GrooveLabLeadSoundId };

/** Classic urban sine — portamento + subtle vibrato (Jodeci / DeVante / Pure Sine style). */
export const GROOVE_LAB_LEAD_SOUND_DEFAULT: GrooveLabLeadSoundId = 'sinePureLead';

/**
 * Set true to show the R&B SINE glide / vibrato strip in MELODY & RIFFS.
 * Engine code stays either way — flip when revisiting portamento.
 */
export const GROOVE_LAB_RNB_SINE_UI_ENABLED = false;

/** Suggested portamento for mono sine R&B leads (~80–140 ms). */
export const GROOVE_LAB_RNB_SINE_GLIDE_MS = 110;
/** Pitch LFO — ~5 Hz reads vocal, not seasick (D-50 / Motif “sine lead” zone). */
export const GROOVE_LAB_RNB_SINE_LFO_RATE_HZ = 5.4;
export const GROOVE_LAB_RNB_SINE_LFO_DEPTH_CENTS = 8;

export interface GrooveLabLeadSoundDef {
  id: GrooveLabLeadSoundId;
  label: string;
  preset: GrooveLabLeadPresetDef;
}

export const GROOVE_LAB_LEAD_SOUNDS: GrooveLabLeadSoundDef[] = GROOVE_LAB_LEAD_SOUND_ORDER.map((id) => ({
  id,
  label: GROOVE_LAB_LEAD_PRESETS[id].label,
  preset: GROOVE_LAB_LEAD_PRESETS[id],
}));

export const GROOVE_LAB_LEAD_SOUND_GROUPS: ReadonlyArray<{
  label: string;
  ids: readonly GrooveLabLeadSoundId[];
}> = [
  {
    label: 'Guitar leads & licks',
    ids: [
      'leadGtrPick',
      'leadGtrFinger',
      'leadGtrCleanChime',
      'leadGtrSlide',
      'leadGtrOverdrive',
      'leadGtrHarmonic',
      'leadGtrPalmMute',
      'leadGtrWahClean',
      'leadGtrWahDrive',
      'lickBluesSlide',
      'lickNeoSoulPhrase',
      'lickArenaHook',
    ],
  },
  {
    label: 'Plucks & stabs',
    ids: ['pluckBright', 'pluckNylon', 'pluckStab', 'pluckMarimba', 'pluckBell', 'pluckMutedPick', 'pluckMandolin'],
  },
  {
    label: 'Synth & keys',
    ids: [
      'synthSawLead',
      'synthSquareHook',
      'synthSupersaw',
      'synthFilterSweep',
      'synthBrass',
      'synthRetro',
      'synthNeon',
      'keysEPiano',
      'keysGlass',
    ],
  },
  {
    label: 'Pure sine / R&B wave lead',
    ids: ['sinePureLead', 'sineRnBSilk', 'sineRomanticKeys', 'sineWaveGlide', 'sineGospelGlide', 'sineGospelSoft'],
  },
  {
    label: 'More sine colors',
    ids: ['sineGospelWarm', 'sineSilkVocal', 'sineSilkAir', 'sineGospelCry'],
  },
];

/** Preset voice category — used by transport sustain shaping. */
export function grooveLabLeadSoundKind(id: GrooveLabAnyLeadSoundId): GrooveLabLeadPresetDef['kind'] {
  if (isGuitarLickSampleId(id)) return 'guitar';
  return grooveLabLeadSoundDef(id as GrooveLabLeadSoundId).preset.kind;
}

/**
 * Dynamic group built at runtime from the loaded guitar lick manifest.
 * Call this after `loadGuitarLickManifest()` has resolved.
 */
export function getGrooveLabSampleLickGroup(): { label: string; ids: GuitarLickId[] } {
  const defs = getLoadedGuitarLickDefs();
  return {
    label: 'HQ guitar sample pack',
    ids: defs.map((d) => d.id),
  };
}

export function grooveLabSampleLickLabel(id: GuitarLickId): string {
  return loadedGuitarLickLabelById(id) ?? id;
}

/** Map old bass-bank melody picks to the new lead bank. */
const LEGACY_MELODY_SOUND_MAP: Record<string, GrooveLabLeadSoundId> = {
  gtrFinger: 'leadGtrFinger',
  gtrPick: 'leadGtrPick',
  gtrFunk: 'pluckStab',
  gtrUpright: 'pluckNylon',
  gtrMuted: 'pluckStab',
  gtrReggae: 'pluckNylon',
  gtrAcoustic: 'pluckNylon',
  gtrChorus: 'leadGtrSlide',
  moogMini: 'synthSquareHook',
  moogTaurus: 'synthBrass',
  moogClassic: 'synthRetro',
  moogFilter: 'synthFilterSweep',
  moogDisco: 'synthNeon',
  moogBrass: 'synthBrass',
  moogRubber: 'synthFilterSweep',
  moogFatSub: 'synthSawLead',
};

export function grooveLabLeadSoundDef(id: GrooveLabLeadSoundId): GrooveLabLeadSoundDef {
  return GROOVE_LAB_LEAD_SOUNDS.find((s) => s.id === id) ?? GROOVE_LAB_LEAD_SOUNDS[0]!;
}

export function grooveLabNormalizeLeadSoundId(raw: string | null | undefined): GrooveLabAnyLeadSoundId {
  if (!raw) return GROOVE_LAB_LEAD_SOUND_DEFAULT;
  if (isGuitarLickSampleId(raw)) return raw as GuitarLickId;
  if (raw in GROOVE_LAB_LEAD_PRESETS) return raw as GrooveLabLeadSoundId;
  if (LEGACY_MELODY_SOUND_MAP[raw]) return LEGACY_MELODY_SOUND_MAP[raw]!;
  return GROOVE_LAB_LEAD_SOUND_DEFAULT;
}

export type PlayGrooveLabLeadSoundOpts = {
  monophonic?: boolean;
  monoGroup?: string;
  /** Portamento in milliseconds (0 disables glide). */
  glideMs?: number;
  /** Explicit output destination for hard channel routing. */
  outputNode?: AudioNode;
  /** Optional fixed cutoff for lead tone shaping. */
  filterCutoffHz?: number;
  /** High-pass (low cut) — Hz. */
  lowCutHz?: number;
  /** Low-pass (high cut) — Hz. */
  highCutHz?: number;
  /** Optional vibrato-LFO override rate in Hz. */
  leadLfoRateHz?: number;
  /** Optional vibrato-LFO override depth in cents. */
  leadLfoDepthCents?: number;
  /** 0..1 wah movement depth */
  wahAmount?: number;
  /** LFO Hz for wah sweep */
  wahRateHz?: number;
  /** 0..1 extra saturation amount */
  drive?: number;
  /** 0..1 extra distortion amount */
  distortion?: number;
  /** Hard cap on note length (transport mono line). */
  maxSustainSec?: number;
  /** When true, never legato-glide into the previous voice (prevents stacked attacks). */
  disableLegato?: boolean;
  /**
   * Groove transport / preview roll — one dry stab: no glide, vibrato, chorus oscs, or long tail.
   */
  transportClean?: boolean;
  /** G3–A4 guitar lane vs default C5–C6 lead clamp. */
  pitchRegister?: 'melody' | 'guitar';
};

/**
 * Transport lead — dry stabs when glide is 0; glide > 0 = legato portamento + long sustain (LFO from caller).
 */
export function grooveLabLeadFxForTransport(
  soundId: GrooveLabAnyLeadSoundId,
  glideMs = 0,
  fxOverrides?: Partial<PlayGrooveLabLeadSoundOpts>,
): PlayGrooveLabLeadSoundOpts {
  const sine = grooveLabIsSineLeadSoundId(soundId);
  const glide = Math.max(0, Math.min(480, glideMs));
  const portamento = glide > 0;
  let presetLfoRate = 0;
  let presetLfoDepth = 0;
  if (!isGuitarLickSampleId(soundId)) {
    const p = grooveLabLeadSoundDef(soundId as GrooveLabLeadSoundId).preset;
    presetLfoRate = p.lfoRateHz ?? 0;
    presetLfoDepth = p.lfoDepthCents ?? 0;
  }
  const base: PlayGrooveLabLeadSoundOpts = {
    monophonic: true,
    monoGroup: GROOVE_LAB_MELODY_MONO_GROUP,
    transportClean: !portamento,
    disableLegato: !portamento,
    glideMs: glide,
    leadLfoRateHz: portamento
      ? (fxOverrides?.leadLfoRateHz ?? (presetLfoRate > 0 ? presetLfoRate : GROOVE_LAB_RNB_SINE_LFO_RATE_HZ))
      : 0,
    leadLfoDepthCents: portamento
      ? (fxOverrides?.leadLfoDepthCents ??
        (presetLfoDepth > 0 ? presetLfoDepth : GROOVE_LAB_RNB_SINE_LFO_DEPTH_CENTS))
      : 0,
    wahAmount: 0,
    wahRateHz: 0,
    drive: sine ? 0.02 : 0.04,
    distortion: 0,
    filterCutoffHz: sine ? 5800 : 6800,
    maxSustainSec: portamento ? 1.35 : 0.2,
  };
  return { ...base, ...fxOverrides, glideMs: glide, transportClean: !portamento, disableLegato: !portamento };
}

/** Default MELODY FX — callers should prefer {@link grooveLabLeadFxForSound}. */
export function grooveLabDefaultLeadFx(
  overrides?: Partial<PlayGrooveLabLeadSoundOpts>,
): PlayGrooveLabLeadSoundOpts {
  return {
    drive: 0.05,
    distortion: 0,
    filterCutoffHz: 7200,
    ...overrides,
  };
}

export function grooveLabIsSineLeadSoundId(id: GrooveLabAnyLeadSoundId): boolean {
  if (isGuitarLickSampleId(id)) return false;
  return String(id).startsWith('sine');
}

/**
 * Merge user MELODY FX with sound-specific R&B defaults (glide + vibrato LFO).
 * Preset `lfoRateHz` / `lfoDepthCents` apply unless the user has stored overrides.
 */
export function grooveLabLeadFxForSound(
  soundId: GrooveLabAnyLeadSoundId,
  overrides?: Partial<PlayGrooveLabLeadSoundOpts>,
): PlayGrooveLabLeadSoundOpts {
  const sineFamily = grooveLabIsSineLeadSoundId(soundId);
  let presetLfoRate = 0;
  let presetLfoDepth = 0;
  if (!isGuitarLickSampleId(soundId)) {
    const p = grooveLabLeadSoundDef(soundId as GrooveLabLeadSoundId).preset;
    presetLfoRate = p.lfoRateHz ?? 0;
    presetLfoDepth = p.lfoDepthCents ?? 0;
  }
  const base: PlayGrooveLabLeadSoundOpts = sineFamily
    ? {
        glideMs: GROOVE_LAB_RNB_SINE_GLIDE_MS,
        leadLfoRateHz: presetLfoRate > 0 ? presetLfoRate : GROOVE_LAB_RNB_SINE_LFO_RATE_HZ,
        leadLfoDepthCents: presetLfoDepth > 0 ? presetLfoDepth : GROOVE_LAB_RNB_SINE_LFO_DEPTH_CENTS,
        filterCutoffHz: 6400,
        drive: 0.04,
        distortion: 0,
      }
    : {
        glideMs: 0,
        leadLfoRateHz: presetLfoRate,
        leadLfoDepthCents: presetLfoDepth,
        filterCutoffHz: 7200,
        drive: 0.05,
        distortion: 0,
      };
  return { ...base, ...overrides };
}

/**
 * Play a melody/riff note — routes to sample lick bank when `soundId` starts with
 * "lickSample_", otherwise uses the synth voice engine.
 * Falls back to synth if the sample buffer hasn't loaded yet.
 */
function leadMonoGroupKey(opts?: PlayGrooveLabLeadSoundOpts): string {
  return opts?.monoGroup?.trim() || '__default__';
}

export function playGrooveLabLeadSound(
  ctx: AudioContext,
  midi: number,
  soundId: GrooveLabAnyLeadSoundId,
  when = ctx.currentTime + 0.008,
  velocity01 = 0.88,
  bpm = 100,
  holdBeats = 1.25,
  opts?: PlayGrooveLabLeadSoundOpts,
): boolean {
  if (ctx.state === 'closed') return false;
  const group = leadMonoGroupKey(opts);
  const bankMix =
    group === GROOVE_LAB_GUITAR_MONO_GROUP
      ? grooveLabGuitarBankVoiceMix()
      : grooveLabLeadBankVoiceMix();
  velocity01 = Math.max(0.05, Math.min(1, velocity01 * bankMix));
  let sustainSec = Math.max(0.08, (holdBeats * 60) / Math.max(40, bpm));
  if (opts?.transportClean && opts?.maxSustainSec == null) {
    sustainSec = Math.min(sustainSec, 0.16);
  }
  if (opts?.maxSustainSec != null) {
    sustainSec = Math.min(sustainSec, Math.max(0.05, opts.maxSustainSec));
  }
  const leadMidi =
    opts?.pitchRegister === 'guitar' ? grooveLabClampGuitarMidi(midi) : grooveLabClampMelodyMidi(midi);
  const whenChoke = Math.max(when, ctx.currentTime + 0.001);

  if (isGuitarLickSampleId(soundId)) {
    const now = ctx.currentTime;
    if (opts?.monophonic !== false && when <= now + 0.05) {
      truncateGrooveLabLeadMonoGroup(whenChoke, group);
    }
    const def = getGuitarLickDef(soundId);
    if (def) {
      if (!guitarLickBufferReady(soundId, ctx)) {
        void ensureGuitarLickBuffer(ctx, def);
      }
      const lickOpts = {
        ...grooveLabGuitarLickPlayOpts(soundId, sustainSec),
        ...opts,
        monoGroup: opts?.monoGroup ?? group,
        outputNode: opts?.outputNode,
      };
      const played = playGuitarLickSample(ctx, def, leadMidi, when, velocity01, sustainSec, lickOpts);
      if (played) return true;
      const fallbackDef = grooveLabLeadSoundDef(def.fallbackSynth);
      const kind = fallbackDef.preset.kind;
      const cap =
        kind === 'pluck' ? Math.min(sustainSec, 0.55) : kind === 'keys' ? Math.min(sustainSec, 0.85) : sustainSec;
      playGrooveLabLeadVoice(ctx, when, leadMidi, fallbackDef.preset, velocity01, cap, {
        ...lickOpts,
        transportClean: false,
        outputNode: opts?.outputNode,
      });
      return true;
    }
    const unknownFallback = grooveLabLeadSoundDef('leadGtrWahClean');
    const cap =
      unknownFallback.preset.kind === 'pluck'
        ? Math.min(sustainSec, 0.55)
        : Math.min(sustainSec, 0.85);
    playGrooveLabLeadVoice(ctx, when, leadMidi, unknownFallback.preset, velocity01, cap, {
      ...grooveLabGuitarLickPlayOpts('lickSample_wahClean', sustainSec),
      ...opts,
      monoGroup: opts?.monoGroup ?? group,
      outputNode: opts?.outputNode,
    });
    return true;
  }

  // Standard synth voice path
  const id = soundId as GrooveLabLeadSoundId;
  const def = grooveLabLeadSoundDef(id);
  const kind = def.preset.kind;
  const cap =
    kind === 'pluck' ? Math.min(sustainSec, 0.55) : kind === 'keys' ? Math.min(sustainSec, 0.85) : sustainSec;
  playGrooveLabLeadVoice(ctx, when, leadMidi, def.preset, velocity01, cap, {
    ...opts,
    transportClean: opts?.transportClean,
    outputNode: opts?.outputNode,
  });
  return true;
}
