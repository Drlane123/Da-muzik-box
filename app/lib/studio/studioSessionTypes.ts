/**
 * Studio Editor DAW domain model.
 *
 * This is the Studio One-style core schema for the linear arranger,
 * take/layer recording, non-destructive clips, and mixer routing.
 */

export type StudioTrackType = 'MIDI' | 'Audio' | 'Drum' | 'Bus' | 'Vocal';

export type StudioClipKind = 'audio' | 'midi' | 'pattern' | 'automation';

export type StudioRecordingState =
  | 'idle'
  | 'armed'
  | 'monitoring'
  | 'preRoll'
  | 'recording'
  | 'punchIn'
  | 'punchOut'
  | 'stopping';

export type StudioSourceKind = 'audioBuffer' | 'file' | 'generated' | 'external';

export type StudioInsertType =
  | 'eq'
  | 'compressor'
  | 'reverb'
  | 'delay'
  | 'chorus'
  | 'flanger'
  | 'distortion'
  | 'filter'
  | 'plugin';

export interface StudioSessionMetadata {
  projectName: string;
  sampleRate: number;
  bitDepth: 16 | 24 | 32;
  bpm: number;
  timeSignature: {
    numerator: number;
    denominator: number;
  };
  ppq: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudioAudioSourceRef {
  id: string;
  kind: StudioSourceKind;
  name: string;
  sampleRate?: number;
  channels?: number;
  durationSamples?: number;
  durationSeconds?: number;
  /**
   * Runtime-only handle name. Serialized projects should store file/blob refs
   * instead of AudioBuffer objects.
   */
  runtimeKey?: string;
  fileRef?: string;
}

export interface StudioFade {
  durationTicks: number;
  curve: 'linear' | 'equalPower' | 'exponential';
}

export interface StudioClipEvent {
  id: string;
  kind: StudioClipKind;
  name: string;
  trackId: string;
  startTick: number;
  lengthTicks: number;
  startSample?: number;
  endSample?: number;
  sourceId?: string;
  sourceOffsetSamples: number;
  gainDb: number;
  pitchSemitones: number;
  fadeIn?: StudioFade;
  fadeOut?: StudioFade;
  muted: boolean;
  locked: boolean;
}

export interface StudioTakeLayer {
  id: string;
  trackId: string;
  takeNumber: number;
  name: string;
  sourceId: string;
  startTick: number;
  lengthTicks: number;
  recordedAt: string;
  muted: boolean;
  visible: boolean;
}

export interface StudioCompSegment {
  id: string;
  trackId: string;
  layerId: string;
  sourceId: string;
  startTick: number;
  lengthTicks: number;
  sourceOffsetSamples: number;
  gainDb: number;
  fadeIn?: StudioFade;
  fadeOut?: StudioFade;
}

export interface StudioSend {
  id: string;
  targetBusId: string;
  levelDb: number;
  preFader: boolean;
  enabled: boolean;
}

export interface StudioInsert {
  id: string;
  type: StudioInsertType;
  pluginId?: string;
  bypass: boolean;
  wet: number;
  parameters: Record<string, number>;
}

export interface StudioMixerChannel {
  id: string;
  trackId: string;
  inputBusId?: string;
  outputBusId: string;
  inserts: StudioInsert[];
  sends: StudioSend[];
  pan: number;
  faderDb: number;
  muted: boolean;
  solo: boolean;
}

export interface StudioTrack {
  id: string;
  legacyId?: number;
  name: string;
  type: StudioTrackType;
  color: string;
  inputChannel?: number;
  outputBusId: string;
  isArmed: boolean;
  monitorEnabled: boolean;
  phaseInvert: boolean;
  stereoMode: 'mono' | 'stereo';
  muted: boolean;
  solo: boolean;
  locked: boolean;
  clipIds: string[];
  takeLayerIds: string[];
  compSegmentIds: string[];
  mixerChannelId: string;
  legacyAudioTrack?: number;
}

export interface StudioArrangerSection {
  id: string;
  name: string;
  startTick: number;
  lengthTicks: number;
  color?: string;
}

export interface StudioChordEvent {
  id: string;
  startTick: number;
  lengthTicks: number;
  root: string;
  quality: string;
}

export interface StudioRecordingConfig {
  state: StudioRecordingState;
  armedTrackId?: string;
  inputGainDb: number;
  recordOffsetMs: number;
  preRollBars: number;
  punchEnabled: boolean;
  punchInTick: number;
  punchOutTick: number;
}

export interface StudioTransportSnapshot {
  playheadTick: number;
  loopEnabled: boolean;
  loopStartTick: number;
  loopEndTick: number;
}

export interface StudioSession {
  version: 2;
  metadata: StudioSessionMetadata;
  transport: StudioTransportSnapshot;
  tracks: StudioTrack[];
  clips: StudioClipEvent[];
  sources: StudioAudioSourceRef[];
  takeLayers: StudioTakeLayer[];
  compSegments: StudioCompSegment[];
  mixerChannels: StudioMixerChannel[];
  arrangerSections: StudioArrangerSection[];
  chordTrack: StudioChordEvent[];
  recording: StudioRecordingConfig;
}
