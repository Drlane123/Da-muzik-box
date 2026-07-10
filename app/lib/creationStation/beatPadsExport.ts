/**
 * Beat Pads — offline loop bounce (WAV) for export / timeline handoff.
 */
import { beatPadsLaneActiveAtStep } from '@/app/lib/creationStation/beatPadsPatternEdit';
import {
  beatPadsPatternCols,
  normalizeBeatPadsPattern,
  type BeatPadsDrumPattern,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import { downloadBytes, safeFilename } from '@/app/lib/creationStation/midiExport';
import {
  triggerSe2BeatPadsPad,
  type Se2BeatPadsTrackSession,
} from '@/app/lib/studio/se2BeatPadsTransportPlayback';
import type { Se2BeatPadsTrack } from '@/app/lib/studio/se2BeatPadsTrack';

export type BeatPadsLoopRenderArgs = {
  pattern: BeatPadsDrumPattern;
  loopBars: number;
  stepsPerBar: BeatPadsGridStepsPerBar;
  bpm: number;
  beatsPerBar?: number;
  session: Se2BeatPadsTrackSession;
  trackVolume127?: number;
  kickKeySemi?: number;
  kickKeyLockTrack?: Pick<Se2BeatPadsTrack, 'beatPadsKickKeyLock' | 'beatPadsKickTargetPad'>;
  /** When set, only these pad lanes (0–15) are rendered. */
  lanes?: readonly number[];
};

function encodeWavPcm16(pcm: Float32Array, sampleRate: number): Uint8Array {
  const out = new Uint8Array(44 + pcm.length * 2);
  const dv = new DataView(out.buffer);
  const ws = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i));
  };
  ws(0, 'RIFF');
  dv.setUint32(4, 36 + pcm.length * 2, true);
  ws(8, 'WAVE');
  ws(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  ws(36, 'data');
  dv.setUint32(40, pcm.length * 2, true);
  let o = 44;
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]!));
    dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    o += 2;
  }
  return out;
}

export function beatPadsPatternHasHits(
  pattern: BeatPadsDrumPattern,
  loopBars: number,
  stepsPerBar: BeatPadsGridStepsPerBar,
): boolean {
  const normalized = normalizeBeatPadsPattern(pattern, loopBars, stepsPerBar);
  const cols = beatPadsPatternCols(loopBars, stepsPerBar);
  for (let lane = 0; lane < 16; lane += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (beatPadsLaneActiveAtStep(normalized[lane], col)) return true;
    }
  }
  return false;
}

/** Render one full Beat Pads loop cycle to stereo (summed mono) audio. */
export async function renderBeatPadsLoopToAudioBuffer(
  args: BeatPadsLoopRenderArgs,
): Promise<AudioBuffer> {
  const bpm = Math.max(40, Math.min(240, args.bpm));
  const beatsPerBar = Math.max(1, args.beatsPerBar ?? 4);
  const loopBars = Math.max(1, Math.round(args.loopBars));
  const stepsPerBar = args.stepsPerBar;
  const pattern = normalizeBeatPadsPattern(args.pattern, loopBars, stepsPerBar);
  const cols = beatPadsPatternCols(loopBars, stepsPerBar);
  if (cols <= 0) throw new Error('Nothing to export — empty loop');

  const patternLoopBeats = loopBars * beatsPerBar;
  const stepBeats = patternLoopBeats / cols;
  const spb = 60 / bpm;
  const tailSec = 1.2;
  const totalSec = patternLoopBeats * spb + tailSec;
  const sampleRate = 44100;
  const offline = new OfflineAudioContext(2, Math.ceil(totalSec * sampleRate), sampleRate);
  const bus = offline.createGain();
  bus.gain.value = 1;
  bus.connect(offline.destination);

  let hits = 0;
  const laneFilter = args.lanes?.length ? new Set(args.lanes) : null;
  for (let col = 0; col < cols; col += 1) {
    const when = col * stepBeats * spb;
    for (let lane = 0; lane < 16; lane += 1) {
      if (laneFilter && !laneFilter.has(lane)) continue;
      if (!beatPadsLaneActiveAtStep(pattern[lane], col)) continue;
      if (
        triggerSe2BeatPadsPad(args.session, lane, offline, 100, when, bus, {
          sessionBpm: bpm,
          trackVolume127: args.trackVolume127 ?? 100,
          kickKeySemi: args.kickKeySemi ?? 0,
          kickKeyLockTrack: args.kickKeyLockTrack,
        })
      ) {
        hits += 1;
      }
    }
  }

  if (hits === 0) throw new Error('Nothing to export — load a kit and paint steps first');

  const rendered = await offline.startRendering();
  const mono = rendered.getChannelData(0);
  const ch1 = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : mono;
  const mix = new Float32Array(mono.length);
  for (let i = 0; i < mix.length; i += 1) {
    mix[i] = (mono[i]! + ch1[i]!) * 0.5;
  }

  const outCtx = new OfflineAudioContext(1, mix.length, sampleRate);
  const buf = outCtx.createBuffer(1, mix.length, sampleRate);
  buf.copyToChannel(mix, 0);
  return buf;
}

export async function renderBeatPadsLoopToWav(args: BeatPadsLoopRenderArgs): Promise<Uint8Array> {
  const buffer = await renderBeatPadsLoopToAudioBuffer(args);
  return encodeWavPcm16(buffer.getChannelData(0), buffer.sampleRate);
}

export async function downloadBeatPadsLoopWav(
  args: BeatPadsLoopRenderArgs & { filenameBase: string },
): Promise<void> {
  const wavBytes = await renderBeatPadsLoopToWav(args);
  const base = safeFilename(args.filenameBase, 'BeatPads');
  downloadBytes(wavBytes, `${base}.wav`, 'audio/wav');
}
