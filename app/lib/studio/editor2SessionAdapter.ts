/**
 * Maps Studio Editor 2 arranger state into the shared {@link StudioSession} domain model
 * (Studio One–style tracks, mixer channels, audio clips + sources).
 *
 * MIDI note data stays on the editor timeline only; the session records MIDI tracks without
 * per-note clip events until a note-level clip pipeline exists.
 */

import type {
  StudioClipEvent,
  StudioMixerChannel,
  StudioSession,
  StudioTrack,
  StudioTrackType,
} from '@/app/lib/studio/studioSessionTypes';

import { createEmptyStudioSession } from '@/app/lib/studio/createStudioSession';

export type Editor2MidiNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

export type Editor2AudioClip = {
  id: string;
  sourceId: string;
  startBeat: number;
  durationBeats: number;
  name?: string;
};

export type Editor2ArrangerTrack = {
  id: string;
  name: string;
  colorHex: string;
  kind: 'midi' | 'audio' | 'trackAlign' | 'a2m' | 'rhythm' | 'glideBass';
  /** Clip-level Audio → MIDI profile when `kind === 'a2m'`. */
  a2mMode?: 'melodic' | 'bass' | 'drums';
  a2mDetectedBpm?: number;
  a2mKeyRoot?: number;
  a2mKeyMode?: 'major' | 'minor';
  trackKeyRoot?: number;
  trackKeyMode?: 'major' | 'minor';
  notes: Editor2MidiNote[];
  audioClips: Editor2AudioClip[];
  /** MIDI output channel 1–16 for instrument lanes. */
  midiChannel?: number;
  /** GM / synth / bass / drum sound id for this lane. */
  midiInstrumentId?: string;
  /** Browser `MediaDeviceInfo.deviceId` for record; empty = project default. */
  audioInputDeviceId?: string;
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

function hexToCssColor(hex: string): string {
  const h = hex.replace('#', '').trim();
  if (h.length === 6 && /^[0-9a-fA-F]+$/.test(h)) return `#${h}`;
  return '#888888';
}

/**
 * Build a {@link StudioSession} snapshot from Editor 2 tracks + transport metadata.
 * Use for export, cloud sync hooks, or debugging — keep in sync when adding clip fields.
 */
export function buildStudioSessionFromEditor2Tracks(
  tracks: Editor2ArrangerTrack[],
  opts: {
    projectName?: string;
    bpm: number;
    songKeyRoot?: number;
    songKeyMode?: 'major' | 'minor';
    beatsPerBar: number;
    playheadBeat?: number;
    loopEnabled?: boolean;
    loopStartBeat?: number;
    loopEndBeat?: number;
  },
): StudioSession {
  const session = createEmptyStudioSession({
    projectName: opts.projectName,
    bpm: opts.bpm,
    timeSignature: { numerator: opts.beatsPerBar, denominator: 4 },
  });
  const ppq = session.metadata.ppq;
  const updatedAt = nowIso();
  session.metadata.updatedAt = updatedAt;
  session.metadata.bpm = opts.bpm;
  session.metadata.timeSignature = { numerator: opts.beatsPerBar, denominator: 4 };

  const playheadTick = Math.max(0, Math.round((opts.playheadBeat ?? 0) * ppq));
  session.transport.playheadTick = playheadTick;
  session.transport.loopEnabled = opts.loopEnabled ?? false;
  session.transport.loopStartTick = Math.max(0, Math.round((opts.loopStartBeat ?? 0) * ppq));
  session.transport.loopEndTick = Math.max(
    session.transport.loopStartTick + ppq,
    Math.round((opts.loopEndBeat ?? opts.beatsPerBar * 4) * ppq),
  );

  for (const t of tracks) {
    const trackId = stableId('e2', [t.id]);
    const mixerChannelId = stableId('mix', [t.id]);
    const type: StudioTrackType = t.kind === 'audio' || t.kind === 'trackAlign' ? 'Audio' : 'MIDI';
    /* `a2m` lanes export as MIDI tracks once notes exist; audio clips stay editor-local for now. */
    const clipIds: string[] = [];

    const mixerChannel: StudioMixerChannel = {
      id: mixerChannelId,
      trackId,
      outputBusId: 'master',
      inserts: [],
      sends: [],
      pan: 0,
      faderDb: dbFromLinearPercent(75),
      muted: false,
      solo: false,
    };

    if (t.kind === 'audio' || t.kind === 'trackAlign') {
      for (const ac of t.audioClips) {
        const clipId = stableId('clip', [t.id, ac.id]);
        const startTick = Math.max(0, Math.round(ac.startBeat * ppq));
        const lengthTicks = Math.max(1, Math.round(ac.durationBeats * ppq));
        session.sources.push({
          id: ac.sourceId,
          kind: 'audioBuffer',
          name: ac.name ?? t.name,
          runtimeKey: ac.sourceId,
        });
        const clipEvent: StudioClipEvent = {
          id: clipId,
          kind: 'audio',
          name: ac.name ?? 'Audio',
          trackId,
          startTick,
          lengthTicks,
          sourceId: ac.sourceId,
          sourceOffsetSamples: 0,
          gainDb: 0,
          pitchSemitones: 0,
          muted: false,
          locked: false,
        };
        session.clips.push(clipEvent);
        clipIds.push(clipId);
      }
    }

    const track: StudioTrack = {
      id: trackId,
      name: t.name,
      type,
      color: hexToCssColor(t.colorHex),
      outputBusId: 'master',
      isArmed: false,
      monitorEnabled: false,
      phaseInvert: false,
      stereoMode: 'stereo',
      muted: false,
      solo: false,
      locked: false,
      clipIds,
      takeLayerIds: [],
      compSegmentIds: [],
      mixerChannelId,
    };

    session.tracks.push(track);
    session.mixerChannels.push(mixerChannel);
  }

  return session;
}
