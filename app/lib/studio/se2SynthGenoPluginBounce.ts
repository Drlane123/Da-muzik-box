/**
 * Offline render — Synth Geno plugin / Live Chord loop → AudioBuffer (for audio-track apply).
 */
import type { Se2SynthGenoPluginDraft, Se2SynthGenoPluginSoundSelection } from '@/app/lib/studio/se2SynthGenoChordPlugin';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import {
  genoAccordUsesSoundfont,
  getGenoAccordInstrument,
  scheduleGenoAccordSoundfontMelodyPoly,
} from '@/app/lib/studio/se2SynthGenoAccordSoundfont';
import { scheduleSe2SynthGenoNote } from '@/app/lib/studio/se2SynthGenoPreview';
import {
  buildSe2SynthGenoPluginPreviewLayers,
  type Se2SynthGenoPluginPreviewLayer,
  type Se2SynthGenoPluginPreviewOpts,
} from '@/app/lib/studio/se2SynthGenoPluginPreview';

function beatToSec(beat: number, bpm: number): number {
  return (beat * 60) / Math.max(40, bpm);
}

/** Slice buffer to exact loop window so timeline bars match waveform transients. */
function trimAudioBufferToDuration(buf: AudioBuffer, startSec: number, durationSec: number): AudioBuffer {
  const sr = buf.sampleRate;
  const startSample = Math.max(0, Math.floor(startSec * sr));
  const endSample = Math.min(buf.length, Math.ceil((startSec + durationSec) * sr));
  const len = Math.max(1, endSample - startSample);
  const out = new AudioBuffer({
    length: len,
    sampleRate: sr,
    numberOfChannels: buf.numberOfChannels,
  });
  for (let c = 0; c < buf.numberOfChannels; c += 1) {
    const slice = buf.getChannelData(c).subarray(startSample, endSample);
    out.copyToChannel(slice, c, 0);
  }
  return out;
}

function noteHasExportFlex(n: StudioEditor2GenNote): boolean {
  return (n.flexCurve?.length ?? 0) >= 2;
}

function scheduleOfflineLayer(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  sessionStart: number,
  bpm: number,
  layer: Se2SynthGenoPluginPreviewLayer,
  accordInst?: Awaited<ReturnType<typeof getGenoAccordInstrument>>,
): void {
  const gainMul = layer.gain ?? 1;
  const sorted = [...layer.notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  const useAccordBlock =
    layer.voice.role === 'keys' && genoAccordUsesSoundfont(layer.voice.gmInstrumentId);
  const beatMatchEps = 1 / 512;

  let prevPitch: number | undefined;
  let prevStartBeat: number | undefined;
  let i = 0;
  while (i < sorted.length) {
    const n = sorted[i]!;
    const when = sessionStart + beatToSec(n.startBeat, bpm);
    const off = when + beatToSec(Math.max(0.08, n.durationBeats), bpm);
    const vel = Math.max(1, Math.min(127, Math.round(n.velocity * gainMul)));

    if (useAccordBlock && accordInst) {
      const block: StudioEditor2GenNote[] = [n];
      let j = i + 1;
      while (j < sorted.length && Math.abs(sorted[j]!.startBeat - n.startBeat) <= beatMatchEps) {
        block.push(sorted[j]!);
        j += 1;
      }
      if (layer.accordLane === 'melody') {
        const hits = block.map((hit) => ({
          pitch: hit.pitch,
          velocity: Math.max(1, Math.min(127, Math.round(hit.velocity * gainMul))),
          durationSec: beatToSec(Math.max(0.05, hit.durationBeats), bpm),
        }));
        scheduleGenoAccordSoundfontMelodyPoly(
          ctx as unknown as AudioContext,
          dest,
          when,
          hits,
          layer.voice.gmInstrumentId ?? '',
        );
        i = j;
        continue;
      }
      if (block.some(noteHasExportFlex)) {
        for (const hit of block) {
          const hitWhen = sessionStart + beatToSec(hit.startBeat, bpm);
          const hitOff = hitWhen + beatToSec(Math.max(0.08, hit.durationBeats), bpm);
          const hitVel = Math.max(1, Math.min(127, Math.round(hit.velocity * gainMul)));
          const hitOpts = noteHasExportFlex(hit)
            ? {
                flexCurve: hit.flexCurve,
                flexDurationBeats: hit.durationBeats,
                bpm,
              }
            : undefined;
          scheduleSe2SynthGenoNote(
            ctx as unknown as AudioContext,
            dest,
            hitWhen,
            hitOff,
            hit.pitch,
            hitVel,
            layer.voice,
            hitOpts,
          );
        }
        i = j;
        continue;
      }
      const pitches = block.map((hit) => hit.pitch);
      const dur = Math.max(0.08, off - when);
      const velBase = Math.max(
        1,
        Math.min(
          127,
          Math.round(
            block.reduce((sum, hit) => sum + Math.max(1, Math.min(127, Math.round(hit.velocity * gainMul))), 0)
              / block.length,
          ),
        ),
      );
      const unique = [...new Set(pitches.map((p) => Math.round(p)))].sort((a, b) => a - b);
      if (accordInst.output) accordInst.output.pan = 0;
      for (let k = 0; k < unique.length; k += 1) {
        const pitch = unique[k]!;
        accordInst.start({
          note: Math.max(0, Math.min(127, pitch)),
          velocity: Math.max(1, Math.min(127, velBase - Math.floor(k * 0.6))),
          time: when,
          duration: dur,
        });
      }
      i = j;
      continue;
    }

    let glideFromPitch: number | undefined;
    let glideSec = 0.08;
    let noteScheduleOpts: import('@/app/lib/studio/se2SynthGenoPreview').Se2SynthGenoNoteScheduleOpts | undefined;
    if (n.flexCurve && n.flexCurve.length >= 2) {
      noteScheduleOpts = {
        flexCurve: n.flexCurve,
        flexDurationBeats: n.durationBeats,
        bpm,
      };
    } else if (layer.bassGlide && prevPitch != null && prevPitch !== n.pitch) {
      glideFromPitch = prevPitch;
      const gapBeats =
        prevStartBeat != null ? n.startBeat - prevStartBeat : n.durationBeats;
      glideSec = Math.min(0.14, Math.max(0.04, beatToSec(Math.max(0.06, gapBeats), bpm) * 0.75));
      noteScheduleOpts = {
        glideFromPitch,
        glideSec: glideFromPitch != null ? glideSec : 0,
      };
    }
    scheduleSe2SynthGenoNote(ctx as unknown as AudioContext, dest, when, off, n.pitch, vel, layer.voice, noteScheduleOpts);
    prevPitch = n.pitch;
    prevStartBeat = n.startBeat;
    i += 1;
  }
}

export async function renderSe2SynthGenoPluginDraftToAudioBuffer(opts: {
  draft: Se2SynthGenoPluginDraft;
  sounds: Se2SynthGenoPluginSoundSelection;
  bpm: number;
  beatsPerBar: number;
  bassGlide?: boolean;
  chordGlide?: boolean;
  fusionLaneVoices?: Se2SynthGenoPluginPreviewOpts['fusionLaneVoices'];
  melodyGain?: number;
}): Promise<AudioBuffer> {
  const layers = buildSe2SynthGenoPluginPreviewLayers(opts.draft, opts.sounds, {
    bassGlide: opts.bassGlide,
    chordGlide: opts.chordGlide,
    fusionLaneVoices: opts.fusionLaneVoices,
    melodyGain: opts.melodyGain,
  });
  if (layers.length === 0) {
    throw new Error('No notes to render');
  }

  const loopBeats = opts.draft.bars * opts.beatsPerBar;
  const loopSec = beatToSec(loopBeats, opts.bpm);
  const releaseTailSec = 0.35;
  const totalSec = loopSec + releaseTailSec;
  const sr = 44100;
  const offline = new OfflineAudioContext(2, Math.ceil(totalSec * sr), sr);
  const mix = offline.createGain();
  mix.gain.value = 0.92;
  mix.connect(offline.destination);

  const accordByKey = new Map<string, Awaited<ReturnType<typeof getGenoAccordInstrument>>>();
  await Promise.all(
    layers.map(async (layer) => {
      if (layer.voice.role !== 'keys' || !layer.voice.gmInstrumentId) return;
      const id = layer.voice.gmInstrumentId;
      const lane = layer.accordLane ?? 'chords';
      const key = `${id}@${lane}`;
      if (accordByKey.has(key)) return;
      try {
        const inst = await getGenoAccordInstrument(
          offline as unknown as AudioContext,
          id,
          mix,
          lane,
        );
        accordByKey.set(key, inst);
      } catch (err) {
        console.warn('[Synth Geno] offline accord load skipped:', key, err);
      }
    }),
  );

  const sessionStart = 0;
  for (const layer of layers) {
    if (layer.notes.length === 0) continue;
    const gmId = layer.voice.gmInstrumentId;
    const lane = layer.accordLane ?? 'chords';
    const instKey = gmId ? `${gmId}@${lane}` : '';
    scheduleOfflineLayer(
      offline,
      mix,
      sessionStart,
      opts.bpm,
      layer,
      instKey ? accordByKey.get(instKey) : undefined,
    );
  }

  const rendered = await offline.startRendering();
  return trimAudioBufferToDuration(rendered, 0, loopSec);
}
