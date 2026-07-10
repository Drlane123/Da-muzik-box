/**
 * Sample playback engine — zone selection script framework.
 *
 * Script pipeline per note-on:
 *   1. KeyswitchScript (articulation)
 *   2. LegatoScript (HPO / slide gain)
 *   3. FretboardPosition (zone filter)
 *   4. VelocityLayers → RoundRobin → trigger buffer
 *   5. ResonanceModel + performance noise
 */
import {
  ensureGuitarLickBuffer,
  getGuitarLickDef,
  playGuitarLickSample,
  type GuitarLickDef,
} from '@/app/lib/creationStation/grooveLabGuitarLickBank';
import {
  createGuitarLegatoState,
  guitarLegatoScriptNoteOff,
  guitarLegatoScriptNoteOn,
} from '@/app/lib/studio/guitarEngine/legatoScript';
import {
  createGuitarKeyswitchState,
  guitarIsKeyswitchMidi,
  guitarKeyswitchNoteOn,
} from '@/app/lib/studio/guitarEngine/keyswitchScript';
import {
  createGuitarPositionState,
  guitarFilterZonesByPosition,
  guitarUpdateNeckPosition,
} from '@/app/lib/studio/guitarEngine/fretboardPosition';
import {
  guitarRoundRobinKey,
  GuitarRoundRobinSequencer,
  guitarSelectRoundRobinZone,
} from '@/app/lib/studio/guitarEngine/roundRobin';
import { guitarZonesForNote } from '@/app/lib/studio/guitarEngine/sampleMap';
import { guitarZonesForVelocity } from '@/app/lib/studio/guitarEngine/velocityLayers';
import {
  scheduleGuitarBodyResonance,
  scheduleGuitarPerformanceNoise,
  scheduleGuitarSympatheticStrings,
} from '@/app/lib/studio/guitarEngine/resonanceModel';
import type {
  GuitarEngineArticulation,
  GuitarSampleMap,
  GuitarSampleZone,
  GuitarVoiceRenderOpts,
} from '@/app/lib/studio/guitarEngine/types';

const RR_PAN: readonly number[] = [-0.14, 0.12, -0.07, 0.09];
const RR_DETUNE: readonly number[] = [-4, 2, -2, 3];

export type GuitarSamplePlaybackEngineOpts = {
  sampleBlend?: number;
  resonanceBlend?: number;
  sympatheticStrings?: boolean;
};

type ActiveVoice = {
  midi: number;
  stopAt: number;
};

export class GuitarSamplePlaybackEngine {
  private readonly ctx: AudioContext;
  private readonly destination: AudioNode;
  private readonly map: GuitarSampleMap;
  private readonly opts: Required<GuitarSamplePlaybackEngineOpts>;

  private readonly legato = createGuitarLegatoState();
  private readonly keyswitch = createGuitarKeyswitchState('sustain');
  private readonly position = createGuitarPositionState();
  private readonly rr = new GuitarRoundRobinSequencer();
  private readonly bufferCache = new Map<string, Promise<AudioBuffer | null>>();
  private readonly activeVoices: ActiveVoice[] = [];

  constructor(
    ctx: AudioContext,
    destination: AudioNode,
    map: GuitarSampleMap,
    opts?: GuitarSamplePlaybackEngineOpts,
  ) {
    this.ctx = ctx;
    this.destination = destination;
    this.map = map;
    this.opts = {
      sampleBlend: opts?.sampleBlend ?? 0.72,
      resonanceBlend: opts?.resonanceBlend ?? 1,
      sympatheticStrings: opts?.sympatheticStrings ?? true,
    };
  }

  get activeArticulation(): GuitarEngineArticulation {
    return this.keyswitch.activeArticulation;
  }

  setArticulation(articulation: GuitarEngineArticulation): void {
    this.keyswitch.activeArticulation = articulation;
  }

  /** Resolve zone via full script chain (no audio). */
  selectZone(
    midi: number,
    velocity127: number,
    articulation?: GuitarEngineArticulation,
  ): GuitarSampleZone | null {
    const art = articulation ?? this.keyswitch.activeArticulation;
    const pos = guitarUpdateNeckPosition(this.position, midi);
    let zones = guitarZonesForNote(this.map, midi, art);
    zones = guitarFilterZonesByPosition(zones, pos);
    zones = guitarZonesForVelocity(zones, velocity127, this.map.velocityLayerCount);
    const rrKey = guitarRoundRobinKey(midi, art);
    const rrIdx = this.rr.nextIndex(rrKey, this.map.roundRobinCount);
    return guitarSelectRoundRobinZone(zones, rrIdx);
  }

  noteOn(midi: number, velocity127: number, whenSec: number, durationSec: number): boolean {
    if (guitarIsKeyswitchMidi(midi)) {
      guitarKeyswitchNoteOn(this.keyswitch, midi);
      return false;
    }

    const legatoEv = guitarLegatoScriptNoteOn(this.legato, midi, velocity127, whenSec);
    const zone = this.selectZone(midi, velocity127);
    if (!zone) return false;

    const renderOpts: GuitarVoiceRenderOpts = {
      when: whenSec,
      durationSec,
      midi,
      velocity127,
      articulation: this.keyswitch.activeArticulation,
      legato: legatoEv.kind,
      positionId: this.position.activePositionId,
      strokeNoise: !legatoEv.skipStrokeNoise,
      releaseNoise: true,
    };

    return this.renderZone(zone, renderOpts, legatoEv.attackGain, legatoEv.skipStrokeNoise);
  }

  noteOff(midi: number, whenSec: number): void {
    guitarLegatoScriptNoteOff(this.legato, whenSec);
    const idx = this.activeVoices.findIndex((v) => v.midi === midi);
    if (idx >= 0) this.activeVoices.splice(idx, 1);
  }

  reset(): void {
    this.rr.reset();
    this.activeVoices.length = 0;
  }

  private renderZone(
    zone: GuitarSampleZone,
    opts: GuitarVoiceRenderOpts,
    attackGain: number,
    legatoSkipStroke: boolean,
  ): boolean {
    const asset = this.map.assets[zone.assetId];
    if (!asset) return false;

    const lickDef = this.assetToLickDef(asset);
    const blend = this.opts.sampleBlend * attackGain;
    const bus = this.ctx.createGain();
    bus.gain.value = blend;
    bus.connect(this.destination);

    const rrPan = RR_PAN[zone.roundRobinIndex % RR_PAN.length] ?? 0;
    const rrDetune = (zone.detuneCents ?? 0) + (RR_DETUNE[zone.roundRobinIndex % RR_DETUNE.length] ?? 0);

    let dest: AudioNode = bus;
    if (Math.abs(rrPan) > 0.02) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = rrPan;
      panner.connect(bus);
      dest = panner;
    }

    const played = playGuitarLickSample(
      this.ctx,
      lickDef,
      opts.midi,
      opts.when,
      (opts.velocity127 / 127) * 0.94 * attackGain,
      opts.durationSec,
      {
        outputNode: dest,
        transportClean: true,
        monophonic: false,
        wahAmount: 0,
        drive: 0,
        distortion: 0,
        lowCutHz: 68,
        highCutHz: 14000,
        extraDetuneCents: rrDetune,
      },
    );

    if (!played) {
      void this.ensureBuffer(lickDef).then((buf) => {
        if (!buf || opts.when < this.ctx.currentTime - 0.05) return;
        playGuitarLickSample(
          this.ctx,
          lickDef,
          opts.midi,
          Math.max(opts.when, this.ctx.currentTime + 0.001),
          (opts.velocity127 / 127) * 0.94 * attackGain,
          opts.durationSec,
          {
            outputNode: dest,
            transportClean: true,
            monophonic: false,
            wahAmount: 0,
            drive: 0,
            distortion: 0,
            lowCutHz: 68,
            highCutHz: 14000,
            extraDetuneCents: rrDetune,
          },
        );
      });
    }

    const resGain = this.opts.resonanceBlend;
    scheduleGuitarBodyResonance(
      this.ctx,
      this.destination,
      opts.when,
      opts.midi,
      opts.velocity127,
      opts.durationSec,
      resGain,
    );

    if (this.opts.sympatheticStrings && opts.durationSec > 0.2) {
      scheduleGuitarSympatheticStrings(
        this.ctx,
        this.destination,
        opts.when,
        opts.midi,
        opts.velocity127,
        opts.durationSec,
      );
    }

    scheduleGuitarPerformanceNoise(
      this.ctx,
      this.destination,
      opts.when,
      opts.when + opts.durationSec,
      opts.midi,
      opts.velocity127,
      {
        stroke: opts.strokeNoise,
        release: opts.releaseNoise,
        palmMute: opts.articulation === 'palm_mute',
        legatoSkipStroke: legatoSkipStroke,
      },
    );

    this.activeVoices.push({ midi: opts.midi, stopAt: opts.when + opts.durationSec });
    return true;
  }

  private assetToLickDef(asset: { id: string; url: string; rootMidi: number }): GuitarLickDef {
    const id = asset.id.replace(/^asset:/, '');
    return (
      getGuitarLickDef(id) ?? {
        id,
        label: id,
        tag: 'engine',
        rootMidi: asset.rootMidi,
        url: asset.url,
        fallbackSynth: 'leadGtrPick',
      }
    );
  }

  private ensureBuffer(def: GuitarLickDef): Promise<AudioBuffer | null> {
    let pending = this.bufferCache.get(def.id);
    if (!pending) {
      pending = ensureGuitarLickBuffer(this.ctx, def);
      this.bufferCache.set(def.id, pending);
    }
    return pending;
  }
}
