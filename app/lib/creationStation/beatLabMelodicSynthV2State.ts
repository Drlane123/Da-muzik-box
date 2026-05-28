import {
  BEAT_LAB_DEFAULT_SYNTH_PRESET_ID,
  beatLabBassSynthPresetById,
  type BeatLabBassSynthPreset,
} from './beatLabMelodicSynthPresets';

/** Vital-style FX rack params (visual + future audio engine). 0–1 unless noted. */
export type BeatLabSynthV2FxRackParams = {
  chorusMix: number;
  chorusRateHz: number;
  chorusSpread: number;
  delayMix: number;
  delayFeedback: number;
  delayTimeMs: number;
  delaySync: boolean;
  reverbMix: number;
  reverbDecay: number;
  reverbPreDelayMs: number;
  phaserMix: number;
  phaserRateHz: number;
  phaserDepth: number;
  flangerMix: number;
  flangerRateHz: number;
  flangerFeedback: number;
};

/** Bass synth master trim inside the engine (before mixer CH fader). */
export const BEAT_LAB_SYNTH_V2_DEFAULT_OUTPUT_LEVEL = 0.45;

export const BEAT_LAB_SYNTH_V2_FX_DEFAULTS: BeatLabSynthV2FxRackParams = {
  chorusMix: 0,
  chorusRateHz: 0.35,
  chorusSpread: 0.4,
  delayMix: 0,
  delayFeedback: 0.28,
  delayTimeMs: 220,
  delaySync: false,
  reverbMix: 0,
  reverbDecay: 0.45,
  reverbPreDelayMs: 12,
  phaserMix: 0,
  phaserRateHz: 0.22,
  phaserDepth: 0.5,
  flangerMix: 0,
  flangerRateHz: 0.15,
  flangerFeedback: 0.35,
};

export type BeatLabGlideStyle = 'smooth' | 'stutter' | 'shift';

/** Number of consecutive bars drawn in GLIDE LAYOUT window. */
export type BeatLabGlideLayoutBars = 4 | 8;

/** Manual quantized pitch bends (“shift”) draw on the glide layout grid. */
export type BeatLabGlideShiftDir = 'up' | 'down' | 'roundtrip';

export type BeatLabGlideShiftMarker = {
  bar: number;
  stepInBar: number;
  lenSteps: number;
  semi: number;
  dir: BeatLabGlideShiftDir;
};

export type BeatLabBassSynthVoiceParams = Omit<
  BeatLabBassSynthPreset,
  'id' | 'name' | 'category'
> &
  BeatLabSynthV2FxRackParams & {
    /** Smooth portamento vs tempo-quantized stutter steps. */
    glideStyle?: BeatLabGlideStyle;
    /** Repeat micro-glides on the grid while a note is held (Sync + stutter only). */
    glideIntraNote?: boolean;
    /** Per-bar bitmask — click bars in the glide layout to enable chord/bar glides. */
    glideBarMask?: number;
    /** Per-bar bitmask — enable/disable slide-motion per bar. */
    slideBarMask?: number;
    /** Bars shown / edited in glide layout + marker grid (does not shorten the pattern). */
    glideLayoutBars?: BeatLabGlideLayoutBars;
    /** Slide glide / marker sync left-right in whole quantization steps (+ = later). */
    glideQuantShiftSteps?: number;
    /** Nudge glide timing between grid lines — fraction of one step column (sync feel). */
    glideQuantShiftFine?: number;
    glideShiftMarkers?: BeatLabGlideShiftMarker[];
    /** Guitar-style extra slide gesture independent from main glide mode. */
    slideMotionEnabled?: boolean;
    /** Where to place the slide gesture inside each note. */
    slideMotionAt?: 'tail' | 'head' | 'both';
    /** Slide direction. */
    slideMotionDir?: 'up' | 'down';
    /** Slide depth in semitones. */
    slideMotionSemi?: number;
    /** Portion of note used by slide (0..1). */
    slideMotionFrac?: number;
    /** Absolute slide speed in milliseconds (fast/slow control). */
    slideMotionRateMs?: number;
    /** Voice output 0–1 — lowers bass preset level independent of mixer master. */
    outputLevel?: number;
  };

export function beatLabBassSynthVoiceParamsFromPresetId(
  presetId: string = BEAT_LAB_DEFAULT_SYNTH_PRESET_ID,
): BeatLabBassSynthVoiceParams {
  const p = beatLabBassSynthPresetById(presetId);
  return {
    osc1Wave: p.osc1Wave,
    osc1Level: p.osc1Level,
    osc2Wave: p.osc2Wave,
    osc2Level: p.osc2Level,
    subLevel: p.subLevel,
    noiseLevel: p.noiseLevel,
    unisonVoices: p.unisonVoices,
    unisonDetuneCents: p.unisonDetuneCents,
    filterType: p.filterType,
    filterCutoffHz: p.filterCutoffHz,
    filterResonanceQ: p.filterResonanceQ,
    filterDrive: p.filterDrive,
    ampAttackMs: p.ampAttackMs,
    ampDecayMs: p.ampDecayMs,
    ampSustain: p.ampSustain,
    ampReleaseMs: p.ampReleaseMs,
    glideMs: p.glideMs,
    glideSync: p.glideSync === true,
    glideDivision: p.glideDivision ?? '1/16',
    glideMode: p.glideMode ?? 'mono',
    glideStyle: 'smooth',
    glideIntraNote: false,
    glideBarMask: 0xffffffff,
    slideBarMask: 0xffffffff,
    glideLayoutBars: 8,
    glideQuantShiftSteps: 0,
    glideQuantShiftFine: 0,
    glideShiftMarkers: [],
    slideMotionEnabled: false,
    slideMotionAt: 'tail',
    slideMotionDir: 'up',
    slideMotionSemi: 2,
    slideMotionFrac: 0.2,
    slideMotionRateMs: 85,
    distortion: p.distortion,
    compressor: p.compressor,
    eqLowDb: p.eqLowDb,
    eqMidDb: p.eqMidDb,
    eqHighDb: p.eqHighDb,
    outputLevel: BEAT_LAB_SYNTH_V2_DEFAULT_OUTPUT_LEVEL,
    ...BEAT_LAB_SYNTH_V2_FX_DEFAULTS,
  };
}

function sanitizeGlideShiftMarkers(
  raw: unknown[] | undefined,
  layoutBars: 4 | 8,
): BeatLabGlideShiftMarker[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: BeatLabGlideShiftMarker[] = [];
  const seen = new Set<string>();
  for (const x of raw as Partial<BeatLabGlideShiftMarker>[]) {
    if (!x || typeof x !== 'object') continue;
    const bar = Math.max(0, Math.min(layoutBars - 1, Math.floor(Number(x.bar) || 0)));
    const stepInBar = Math.max(0, Math.min(255, Math.floor(Number(x.stepInBar) || 0)));
    const lenSteps = Math.max(1, Math.min(32, Math.floor(Number(x.lenSteps) || 1)));
    let semi = Math.max(-12, Math.min(12, Math.round(Number(x.semi) || 3)));
    if (semi === 0) semi = 3;
    const dir: BeatLabGlideShiftDir =
      x.dir === 'down' || x.dir === 'roundtrip' ? x.dir : 'up';
    const key = `${bar},${stepInBar}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ bar, stepInBar, lenSteps, semi, dir });
    if (out.length >= 64) break;
  }
  return out.sort((a, b) => a.bar * 256 + a.stepInBar - (b.bar * 256 + b.stepInBar));
}

export function normalizeBeatLabBassSynthVoiceParams(
  raw: unknown,
  presetIds?: readonly string[],
): BeatLabBassSynthVoiceParams[] {
  const out = Array.from({ length: 16 }, (_, i) =>
    beatLabBassSynthVoiceParamsFromPresetId(presetIds?.[i]),
  );
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < 16; i += 1) {
    const v = raw[i] as Partial<BeatLabBassSynthVoiceParams> | undefined;
    if (!v || typeof v !== 'object') continue;
    const glideMode =
      v.glideMode === 'off' ||
      v.glideMode === 'mono' ||
      v.glideMode === 'legato' ||
      v.glideMode === 'chord'
        ? v.glideMode
        : out[i].glideMode;
    const layoutBars: BeatLabGlideLayoutBars = v.glideLayoutBars === 4 ? 4 : 8;
    out[i] = {
      ...out[i],
      ...BEAT_LAB_SYNTH_V2_FX_DEFAULTS,
      ...v,
      glideMode,
      glideSync: v.glideSync === true,
      glideDivision:
        v.glideDivision === '1/64'
          ? '1/32'
          : v.glideDivision === '1/32' ||
        v.glideDivision === '1/16' ||
        v.glideDivision === '1/8' ||
        v.glideDivision === '1/4'
          ? v.glideDivision
          : out[i].glideDivision,
      glideStyle:
        v.glideStyle === 'stutter' || v.glideStyle === 'shift'
          ? v.glideStyle
          : out[i].glideStyle ?? 'smooth',
      glideIntraNote: v.glideIntraNote === true,
      glideBarMask:
        typeof v.glideBarMask === 'number' && Number.isFinite(v.glideBarMask)
          ? Math.max(0, Math.min(0xffffffff, Math.floor(v.glideBarMask)))
          : out[i].glideBarMask ?? 0xffffffff,
      slideBarMask:
        typeof v.slideBarMask === 'number' && Number.isFinite(v.slideBarMask)
          ? Math.max(0, Math.min(0xffffffff, Math.floor(v.slideBarMask)))
          : out[i].slideBarMask ?? 0xffffffff,
      glideLayoutBars: layoutBars,
      glideQuantShiftSteps:
        typeof v.glideQuantShiftSteps === 'number' && Number.isFinite(v.glideQuantShiftSteps)
          ? Math.max(-96, Math.min(96, Math.round(v.glideQuantShiftSteps)))
          : out[i].glideQuantShiftSteps ?? 0,
      glideQuantShiftFine:
        typeof v.glideQuantShiftFine === 'number' && Number.isFinite(v.glideQuantShiftFine)
          ? Math.max(0, Math.min(1, v.glideQuantShiftFine))
          : out[i].glideQuantShiftFine ?? 0,
      glideShiftMarkers: sanitizeGlideShiftMarkers(
        Array.isArray(v.glideShiftMarkers) ? (v.glideShiftMarkers as unknown[]) : [],
        layoutBars,
      ),
      slideMotionEnabled: v.slideMotionEnabled === true,
      slideMotionAt:
        v.slideMotionAt === 'head' || v.slideMotionAt === 'both' || v.slideMotionAt === 'tail'
          ? v.slideMotionAt
          : out[i].slideMotionAt ?? 'tail',
      slideMotionDir: v.slideMotionDir === 'down' ? 'down' : 'up',
      slideMotionSemi:
        typeof v.slideMotionSemi === 'number' && Number.isFinite(v.slideMotionSemi)
          ? Math.max(1, Math.min(12, Math.round(v.slideMotionSemi)))
          : out[i].slideMotionSemi ?? 2,
      slideMotionFrac:
        typeof v.slideMotionFrac === 'number' && Number.isFinite(v.slideMotionFrac)
          ? Math.max(0.08, Math.min(0.8, v.slideMotionFrac))
          : out[i].slideMotionFrac ?? 0.2,
      slideMotionRateMs:
        typeof v.slideMotionRateMs === 'number' && Number.isFinite(v.slideMotionRateMs)
          ? Math.max(10, Math.min(400, Math.round(v.slideMotionRateMs)))
          : out[i].slideMotionRateMs ?? 85,
      outputLevel:
        typeof v.outputLevel === 'number' && Number.isFinite(v.outputLevel)
          ? Math.max(0, Math.min(1, v.outputLevel))
          : out[i].outputLevel ?? BEAT_LAB_SYNTH_V2_DEFAULT_OUTPUT_LEVEL,
    };
  }
  return out;
}
