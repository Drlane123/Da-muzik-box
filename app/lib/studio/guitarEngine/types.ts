/**
 * Da Guitar Engine — core types (Web Audio v1 + JUCE port target).
 *
 * Architecture (Shreddage / Ample-style):
 * ┌─────────────────────────────────────────────────────────────┐
 * │  MIDI in → KeyswitchScript → LegatoScript → PositionLogic   │
 * │              ↓                                              │
 * │  SamplePlaybackEngine (RR × velocity zones)                 │
 * │              + PhysicalResonanceModel (body + sympathetic)    │
 * │              ↓                                              │
 * │  DspRack (gate → comp → amp → cab IR → chorus → delay → verb)│
 * │              ↓                                              │
 * │  Master out → SE2 mixer strip                               │
 * └─────────────────────────────────────────────────────────────┘
 */

export const GUITAR_ENGINE_MIN_VELOCITY_LAYERS = 4;
export const GUITAR_ENGINE_MIN_ROUND_ROBIN = 4;

/** Performance articulations — keyswitch or UI selects active set. */
export type GuitarEngineArticulation =
  | 'sustain'
  | 'palm_mute'
  | 'legato'
  | 'slide'
  | 'harmonic'
  | 'staccato';

export type GuitarEngineArticulationId = GuitarEngineArticulation;

/** One decoded buffer + playback metadata. */
export type GuitarSampleAsset = {
  id: string;
  url: string;
  rootMidi: number;
  /** Recording position on neck (for position-aware maps). */
  positionId: string;
};

/** Single zone in the multi-sample map (1 RR × 1 velocity layer). */
export type GuitarSampleZone = {
  zoneId: string;
  articulation: GuitarEngineArticulation;
  midiLo: number;
  midiHi: number;
  rootMidi: number;
  velocityLo: number;
  velocityHi: number;
  roundRobinIndex: number;
  assetId: string;
  /** Fret offset from open string 6 — used by position logic. */
  fretAtRoot: number;
  stringIndex: number;
  /** Fine tune at root (cents). */
  detuneCents?: number;
};

export type GuitarSampleMap = {
  version: number;
  instrumentId: string;
  label: string;
  assets: Record<string, GuitarSampleAsset>;
  zones: GuitarSampleZone[];
  velocityLayerCount: number;
  roundRobinCount: number;
};

export type GuitarVoiceRenderOpts = {
  when: number;
  durationSec: number;
  midi: number;
  velocity127: number;
  articulation: GuitarEngineArticulation;
  /** From LegatoScript — hammer-on / pull-off retrigger. */
  legato?: GuitarLegatoKind;
  /** Active neck position from FretboardPositionLogic. */
  positionId?: string;
  strokeNoise?: boolean;
  releaseNoise?: boolean;
};

export type GuitarLegatoKind = 'attack' | 'hammer_on' | 'pull_off' | 'slide';

export type GuitarLegatoState = {
  lastMidi: number | null;
  lastOnsetSec: number;
  lastReleaseSec: number;
  overlapSec: number;
  lastVelocity: number;
};

export type GuitarKeyswitchBinding = {
  midiLo: number;
  midiHi: number;
  articulation: GuitarEngineArticulation;
  label: string;
};

export type GuitarNeckPosition = {
  id: string;
  /** Lowest fret covered (inclusive). */
  fretLo: number;
  /** Highest fret covered (inclusive). */
  fretHi: number;
  label: string;
};

export type GuitarDspRackParams = {
  gateThresholdDb: number;
  gateReleaseMs: number;
  compAmount: number;
  ampDrive: number;
  ampTone: number;
  cabIrId: string | null;
  chorusDepth: number;
  delayTimeMs: number;
  delayFeedback: number;
  reverbMix: number;
  masterGain: number;
};

export const DEFAULT_GUITAR_DSP: GuitarDspRackParams = {
  gateThresholdDb: -52,
  gateReleaseMs: 80,
  compAmount: 0.35,
  ampDrive: 0.22,
  ampTone: 0.55,
  cabIrId: '4x12_greenback',
  chorusDepth: 0.18,
  delayTimeMs: 0,
  delayFeedback: 0.28,
  reverbMix: 0.24,
  masterGain: 1,
};
