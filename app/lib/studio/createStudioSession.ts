import type {
  StudioClipEvent,
  StudioCompSegment,
  StudioMixerChannel,
  StudioSession,
  StudioSessionMetadata,
  StudioTakeLayer,
  StudioTrack,
  StudioTrackType,
} from './studioSessionTypes';

type LegacyClipLike = {
  id: number;
  bar: number;
  len: number;
  label: string;
  startTick?: number;
  audioBuffer?: AudioBuffer;
};

type LegacyTrackLike = {
  id: number;
  name: string;
  type: StudioTrackType | string;
  color: string;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  volume: number;
  clips: LegacyClipLike[];
  audioTrack?: number;
  stereoMode?: 'mono' | 'stereo';
};

export type CreateStudioSessionOptions = {
  projectName?: string;
  sampleRate?: number;
  bitDepth?: 16 | 24 | 32;
  bpm?: number;
  ppq?: number;
  timeSignature?: {
    numerator: number;
    denominator: number;
  };
};

function nowIso(): string {
  return new Date().toISOString();
}

function stableId(prefix: string, parts: Array<string | number | undefined>): string {
  return [prefix, ...parts.filter((p) => p !== undefined && p !== '')].join('-');
}

function dbFromLinearPercent(volume: number): number {
  const linear = Math.max(0.0001, Math.min(1, volume / 100));
  return Math.max(-80, Math.min(12, 20 * Math.log10(linear)));
}

function createMetadata(opts: CreateStudioSessionOptions = {}): StudioSessionMetadata {
  const createdAt = nowIso();
  return {
    projectName: opts.projectName ?? 'New Project',
    sampleRate: opts.sampleRate ?? 44100,
    bitDepth: opts.bitDepth ?? 24,
    bpm: opts.bpm ?? 120,
    timeSignature: opts.timeSignature ?? { numerator: 4, denominator: 4 },
    ppq: opts.ppq ?? 960,
    createdAt,
    updatedAt: createdAt,
  };
}

export function createEmptyStudioSession(
  opts: CreateStudioSessionOptions = {},
): StudioSession {
  const metadata = createMetadata(opts);
  return {
    version: 2,
    metadata,
    transport: {
      playheadTick: 0,
      loopEnabled: false,
      loopStartTick: 0,
      loopEndTick: metadata.ppq * metadata.timeSignature.numerator * 4,
    },
    tracks: [],
    clips: [],
    sources: [],
    takeLayers: [],
    compSegments: [],
    mixerChannels: [],
    arrangerSections: [],
    chordTrack: [],
    recording: {
      state: 'idle',
      inputGainDb: 0,
      recordOffsetMs: 0,
      preRollBars: 1,
      punchEnabled: false,
      punchInTick: 0,
      punchOutTick: 0,
    },
  };
}

export function createStudioSessionFromLegacyTracks(
  tracks: LegacyTrackLike[],
  opts: CreateStudioSessionOptions = {},
): StudioSession {
  const session = createEmptyStudioSession(opts);
  const ppq = session.metadata.ppq;
  const beatsPerBar = session.metadata.timeSignature.numerator;

  for (const legacyTrack of tracks) {
    const trackId = stableId('track', [legacyTrack.id]);
    const mixerChannelId = stableId('channel', [
      legacyTrack.audioTrack ?? legacyTrack.id,
    ]);
    const clipIds: string[] = [];
    const takeLayerIds: string[] = [];
    const compSegmentIds: string[] = [];

    const mixerChannel: StudioMixerChannel = {
      id: mixerChannelId,
      trackId,
      outputBusId: 'master',
      inserts: [],
      sends: [],
      pan: 0,
      faderDb: dbFromLinearPercent(legacyTrack.volume),
      muted: legacyTrack.muted,
      solo: legacyTrack.solo,
    };

    for (const legacyClip of legacyTrack.clips) {
      const clipId = stableId('clip', [legacyTrack.id, legacyClip.id]);
      const startTick =
        typeof legacyClip.startTick === 'number' &&
        Number.isFinite(legacyClip.startTick)
          ? Math.max(0, Math.round(legacyClip.startTick))
          : Math.max(0, Math.round((legacyClip.bar - 1) * beatsPerBar * ppq));
      const lengthTicks = Math.max(
        1,
        Math.round(Math.max(0.001, legacyClip.len) * beatsPerBar * ppq),
      );
      const sourceId = legacyClip.audioBuffer
        ? stableId('source', [legacyTrack.id, legacyClip.id])
        : undefined;

      if (sourceId && legacyClip.audioBuffer) {
        session.sources.push({
          id: sourceId,
          kind: 'audioBuffer',
          name: legacyClip.label,
          sampleRate: legacyClip.audioBuffer.sampleRate,
          channels: legacyClip.audioBuffer.numberOfChannels,
          durationSamples: legacyClip.audioBuffer.length,
          durationSeconds: legacyClip.audioBuffer.duration,
          runtimeKey: sourceId,
        });

        const layerId = stableId('layer', [legacyTrack.id, legacyClip.id, 1]);
        const takeLayer: StudioTakeLayer = {
          id: layerId,
          trackId,
          takeNumber: takeLayerIds.length + 1,
          name: legacyClip.label,
          sourceId,
          startTick,
          lengthTicks,
          recordedAt: session.metadata.createdAt,
          muted: false,
          visible: true,
        };
        const compSegment: StudioCompSegment = {
          id: stableId('comp', [legacyTrack.id, legacyClip.id]),
          trackId,
          layerId,
          sourceId,
          startTick,
          lengthTicks,
          sourceOffsetSamples: 0,
          gainDb: 0,
        };
        session.takeLayers.push(takeLayer);
        session.compSegments.push(compSegment);
        takeLayerIds.push(takeLayer.id);
        compSegmentIds.push(compSegment.id);
      }

      const clipEvent: StudioClipEvent = {
        id: clipId,
        kind: sourceId ? 'audio' : 'midi',
        name: legacyClip.label,
        trackId,
        startTick,
        lengthTicks,
        sourceId,
        sourceOffsetSamples: 0,
        gainDb: 0,
        pitchSemitones: 0,
        muted: false,
        locked: legacyTrack.locked,
      };
      session.clips.push(clipEvent);
      clipIds.push(clipId);
    }

    const track: StudioTrack = {
      id: trackId,
      legacyId: legacyTrack.id,
      name: legacyTrack.name,
      type: legacyTrack.type as StudioTrackType,
      color: legacyTrack.color,
      outputBusId: 'master',
      isArmed: false,
      monitorEnabled: false,
      phaseInvert: false,
      stereoMode: legacyTrack.stereoMode ?? 'stereo',
      muted: legacyTrack.muted,
      solo: legacyTrack.solo,
      locked: legacyTrack.locked,
      clipIds,
      takeLayerIds,
      compSegmentIds,
      mixerChannelId,
      legacyAudioTrack: legacyTrack.audioTrack,
    };

    session.tracks.push(track);
    session.mixerChannels.push(mixerChannel);
  }

  return {
    ...session,
    metadata: {
      ...session.metadata,
      updatedAt: nowIso(),
    },
  };
}
