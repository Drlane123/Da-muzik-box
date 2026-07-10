/**
 * Synth Geno plugin — loop preview inside the dock (no DAW apply until user confirms).
 */
import type { Se2SynthGenoPluginDraft, Se2SynthGenoPluginSoundSelection } from '@/app/lib/studio/se2SynthGenoChordPlugin';
import type { GenoBarChordSpec } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import {
  genoAccordUsesSoundfont,
  warmupGenoAccordSoundfont,
  haltGenoAccordPreviewNotes,
  clearGenoAccordPassQueue,
  primeGenoAccordPreviewBus,
  scheduleGenoAccordSoundfontMelodyPoly,
  scheduleGenoAccordSoundfontChord,
  currentGenoAccordPreviewSession,
} from '@/app/lib/studio/se2SynthGenoAccordSoundfont';
import { se2SynthGenoApplyExportGlideToDraft } from '@/app/lib/studio/se2SynthGenoExportGlide';
import { genoLockPluginMelodyNotesToHarmony } from '@/app/lib/studio/se2SynthGenoMelodyEngine';
import { genoPluginLoopTimelineBarCount } from '@/app/lib/studio/se2SynthGenoPluginDisplay';
import { genoNormalizePluginMelodyNotes, genoNormalizePluginFillerNotes } from '@/app/lib/studio/se2SynthGenoRanges';
import { genoFillerQuantStep } from '@/app/lib/studio/se2SynthGenoFillerEngine';
import { GENO_LANE_PREVIEW_GAIN_DEFAULTS, genoPluginPreviewMixGainForLane, setGenoPluginPreviewMixGains } from '@/app/lib/studio/se2SynthGenoLanePreviewGains';
import type { GenoLanePreviewGainId } from '@/app/lib/studio/se2SynthGenoLanePreviewGains';
import { scheduleSe2SynthGenoNote } from '@/app/lib/studio/se2SynthGenoPreview';
import { scheduleSe2GrooveLeadNote } from '@/app/lib/studio/se2GrooveLeadPreview';
import { scheduleSe2GrooveLeadPolyRoll } from '@/app/lib/studio/se2GrooveLeadLegatoPlayback';
import { se2GrooveLeadB01Voice } from '@/app/lib/studio/se2GrooveLeadTypes';
import type { Se2GrooveLeadVoiceParams } from '@/app/lib/studio/se2GrooveLeadTypes';
import { se2SynthGenoSoundBankVoice } from '@/app/lib/studio/se2SynthGenoSoundBank';
import type { Se2SynthGenoVoiceParams } from '@/app/lib/studio/se2SynthGenoTypes';

export type Se2SynthGenoPluginPreviewLayer = {
  notes: readonly StudioEditor2GenNote[];
  voice: Se2SynthGenoVoiceParams;
  gain?: number;
  bassGlide?: boolean;
  /** Separate smplr instance — melody dyads stay polyphonic vs chord stack. */
  accordLane?: 'chords' | 'melody';
  /** Live Vol slider lane id (preview mix only). */
  mixLaneId?: GenoLanePreviewGainId;
};

const GENO_PREVIEW_BEAT_MATCH_EPS = 1 / 512;

function genoPreviewSameStartBeat(a: number, b: number): boolean {
  return Math.abs(a - b) <= GENO_PREVIEW_BEAT_MATCH_EPS;
}

export type Se2SynthGenoPluginPreviewOpts = {
  /** Loop-wide melody quant (16, ⅛, …) — same grid on every bar. */
  barChordSpecs?: readonly GenoBarChordSpec[];
  /** Bar quantize + overlap trim for melody before audio (default 4). */
  beatsPerBar?: number;
  bassGlide?: boolean;
  /** Live Chord loop — smooth chord voice-leading in preview (not progression pads). */
  chordGlide?: boolean;
  /** Override session BPM for this preview only (Live Chord genre tempo). */
  bpm?: number;
  /** Fusion export — render onto the selected Synth Geno lane (not a new audio track). */
  placeOnSourceTrack?: boolean;
  /** Fusion roll — generated patch overrides bank preset per lane. */
  fusionLaneVoices?: Partial<Record<'chords' | 'melody' | 'bass', Se2SynthGenoVoiceParams>>;
  /** Melody / arp layer gain multiplier (default 0.78). Live Chord arp uses a higher boost. */
  melodyGain?: number;
  /** Chord stack preview gain (default 0.92). Preview only. */
  chordGain?: number;
  /** Bass preview gain (default 0.92). Preview only. */
  bassGain?: number;
  /** Note Filler layer gain (default 0.58). Preview only. */
  fillerGain?: number;
  /** Groove Lead mixed into loop preview (default 0.88). Preview only. */
  grooveLeadGain?: number;
  fillerQuant?: import('@/app/lib/studio/se2SynthGenoFillerEngine').GenoFillerQuant;
  /** Inline Groove Lead from Geno loop editor — mixed into loop preview. */
  grooveLeadNotes?: readonly StudioEditor2GenNote[];
  grooveLeadTrackIndex?: number;
  /** B01 R&B Silk voice — defaults to rnb-silk when omitted for Geno Build 1. */
  grooveLeadVoice?: Se2GrooveLeadVoiceParams;
  /**
   * Timeline length from the 8-bar / 4-bar control — never the chord-card count (e.g. 5 cards).
   * Preview must loop on this, not draft.bars when those differ.
   */
  timelineBarCount?: number;
};

/** Full loop length for Gino Build 2 preview — 4 or 8 bars, not chord-card / voicing depth. */
export function genoPluginPreviewTimelineBarCount(
  draftBars: number,
  _layers: readonly Se2SynthGenoPluginPreviewLayer[],
  _beatsPerBar: number,
  opts?: { timelineBarCount?: number },
): number {
  void _layers;
  void _beatsPerBar;
  return genoPluginLoopTimelineBarCount({
    timelineBarCount: opts?.timelineBarCount,
    draftBars,
  });
}

/** Chords = accord bank, melody = melody bank, bass = bass bank. */
export function buildSe2SynthGenoPluginPreviewLayers(
  draft: Se2SynthGenoPluginDraft,
  sounds: Se2SynthGenoPluginSoundSelection,
  previewOpts?: Se2SynthGenoPluginPreviewOpts,
): Se2SynthGenoPluginPreviewLayer[] {
  const bassGlide = previewOpts?.bassGlide === true;
  const chordGlide = previewOpts?.chordGlide === true;
  const bpm = previewOpts?.bpm ?? 120;
  const beatsPerBar = Math.max(1, previewOpts?.beatsPerBar ?? 4);
  const prepared = se2SynthGenoApplyExportGlideToDraft(draft, { bassGlide, chordGlide, bpm });
  const timelineBars = genoPluginLoopTimelineBarCount({
    timelineBarCount: previewOpts?.timelineBarCount,
    draftBars: prepared.bars,
  });
  const melodyForPreview =
    prepared.melodyNotes.length > 0
      ? genoNormalizePluginMelodyNotes(
          genoLockPluginMelodyNotesToHarmony(
            prepared.melodyNotes,
            prepared.harmony,
            beatsPerBar,
            previewOpts?.barChordSpecs,
          ),
          beatsPerBar,
          timelineBars,
          previewOpts?.barChordSpecs,
        )
      : prepared.melodyNotes;
  const custom = previewOpts?.fusionLaneVoices;
  const layers: Se2SynthGenoPluginPreviewLayer[] = [];
  if (prepared.chordNotes.length > 0) {
    layers.push({
      notes: prepared.chordNotes,
      voice: custom?.chords ?? se2SynthGenoSoundBankVoice('accord', sounds.accordBankId),
      gain: previewOpts?.chordGain ?? GENO_LANE_PREVIEW_GAIN_DEFAULTS.chords,
      mixLaneId: 'chords',
    });
  }
  if (melodyForPreview.length > 0) {
    layers.push({
      notes: melodyForPreview,
      voice: custom?.melody ?? se2SynthGenoSoundBankVoice('melody', sounds.melodyBankId),
      gain: previewOpts?.melodyGain ?? GENO_LANE_PREVIEW_GAIN_DEFAULTS.melody,
      accordLane: 'melody',
      mixLaneId: 'melody',
    });
  }
  if (prepared.bassNotes.length > 0) {
    layers.push({
      notes: prepared.bassNotes,
      voice: custom?.bass ?? se2SynthGenoSoundBankVoice('bass', sounds.bassBankId),
      gain: previewOpts?.bassGain ?? GENO_LANE_PREVIEW_GAIN_DEFAULTS.bass,
      bassGlide,
      mixLaneId: 'bass',
    });
  }
  if ((prepared.fillerNotes?.length ?? 0) > 0) {
    layers.push({
      notes: genoNormalizePluginFillerNotes(
        prepared.fillerNotes,
        beatsPerBar,
        timelineBars,
        genoFillerQuantStep(previewOpts?.fillerQuant ?? '8th', beatsPerBar),
      ),
      voice: custom?.melody ?? se2SynthGenoSoundBankVoice('melody', sounds.fillerBankId),
      gain: previewOpts?.fillerGain ?? GENO_LANE_PREVIEW_GAIN_DEFAULTS.filler,
      accordLane: 'melody',
      mixLaneId: 'filler',
    });
  }
  return layers;
}

export type Se2SynthGenoPluginPreviewHandle = {
  stop: () => void;
  /** Beat within the preview loop (0 … loopBeats), aligned to audio anchor. */
  getLoopBeat: () => number | null;
};

let pluginPreviewGeneration = 0;
let activePluginPreviewHandle: Se2SynthGenoPluginPreviewHandle | null = null;

/** Poll from Loop Editor rAF while previewing — same clock as scheduled audio. */
export function getSe2SynthGenoPluginPreviewLoopBeat(): number | null {
  return activePluginPreviewHandle?.getLoopBeat() ?? null;
}

const SE2_AUDIO_START_FLOOR_SEC = 0.008;

function beatToSec(beat: number, bpm: number): number {
  return (beat * 60) / Math.max(40, bpm);
}

function hardMutePreviewChoke(ctx: AudioContext, choke: GainNode): void {
  const t = ctx.currentTime;
  choke.gain.cancelScheduledValues(t);
  choke.gain.setValueAtTime(0, t);
}

function primePreviewChoke(ctx: AudioContext, choke: GainNode): void {
  choke.gain.setValueAtTime(1, ctx.currentTime);
}

function noteHasExportFlex(n: StudioEditor2GenNote): boolean {
  return (n.flexCurve?.length ?? 0) >= 2;
}

function scheduleLayerPass(
  ctx: AudioContext,
  stripOutput: AudioNode,
  sessionStart: number,
  bpm: number,
  layer: Se2SynthGenoPluginPreviewLayer,
): void {
  const baseGain = layer.gain ?? 1;
  const gainMul =
    layer.mixLaneId != null
      ? genoPluginPreviewMixGainForLane(layer.mixLaneId, baseGain)
      : baseGain;
  const sorted = [...layer.notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  const useAccordBlock =
    layer.voice.role === 'keys' && genoAccordUsesSoundfont(layer.voice.gmInstrumentId);
  const instrumentId = layer.voice.gmInstrumentId ?? '';
  const accordLane = layer.accordLane ?? 'chords';

  let prevPitch: number | undefined;
  let prevStartBeat: number | undefined;
  let i = 0;
  while (i < sorted.length) {
    const n = sorted[i]!;
    const when = sessionStart + beatToSec(n.startBeat, bpm);
    const off = when + beatToSec(Math.max(0.08, n.durationBeats), bpm);
    const vel = Math.max(1, Math.min(127, Math.round(n.velocity * gainMul)));

    if (useAccordBlock) {
      const block: StudioEditor2GenNote[] = [n];
      let j = i + 1;
      while (j < sorted.length && genoPreviewSameStartBeat(sorted[j]!.startBeat, n.startBeat)) {
        block.push(sorted[j]!);
        j += 1;
      }
      if (accordLane === 'melody') {
        const hits = block.map((hit) => ({
          pitch: hit.pitch,
          velocity: Math.max(1, Math.min(127, Math.round(hit.velocity * gainMul))),
          durationSec: beatToSec(Math.max(0.05, hit.durationBeats), bpm),
        }));
        scheduleGenoAccordSoundfontMelodyPoly(ctx, stripOutput, when, hits, instrumentId);
        i = j;
        continue;
      }
      if (block.some(noteHasExportFlex)) {
        for (const hit of block) {
          const hitWhen = sessionStart + beatToSec(hit.startBeat, bpm);
          const hitOff = hitWhen + beatToSec(Math.max(0.08, hit.durationBeats), bpm);
          const hitVel = Math.max(1, Math.min(127, Math.round(hit.velocity * gainMul)));
          const hitOpts =
            noteHasExportFlex(hit)
              ? {
                  flexCurve: hit.flexCurve,
                  flexDurationBeats: hit.durationBeats,
                  bpm,
                }
              : undefined;
          scheduleSe2SynthGenoNote(
            ctx,
            stripOutput,
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
      const avgVel = Math.round(
        block.reduce((sum, hit) => sum + Math.max(1, Math.min(127, Math.round(hit.velocity * gainMul))), 0)
          / block.length,
      );
      const blockDurSec = Math.max(
        0.08,
        ...block.map((hit) => beatToSec(Math.max(0.08, hit.durationBeats), bpm)),
      );
      scheduleGenoAccordSoundfontChord(
        ctx,
        stripOutput,
        when,
        blockDurSec,
        pitches,
        avgVel,
        instrumentId,
        accordLane,
      );
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
    scheduleSe2SynthGenoNote(ctx, stripOutput, when, off, n.pitch, vel, layer.voice, noteScheduleOpts);
    prevPitch = n.pitch;
    prevStartBeat = n.startBeat;
    i += 1;
  }
}

function scheduleGrooveLeadPass(
  ctx: AudioContext,
  stripOutput: AudioNode,
  sessionStart: number,
  bpm: number,
  notes: readonly StudioEditor2GenNote[],
  trackIndex: number,
  voice?: Se2GrooveLeadVoiceParams,
  legatoRoll?: boolean,
  gainMul?: number,
): void {
  if (notes.length === 0) return;
  const leadVoice = voice ?? se2GrooveLeadB01Voice();
  const velMul = gainMul ?? 1;
  if (legatoRoll !== false) {
    scheduleSe2GrooveLeadPolyRoll({
      ctx,
      stripIn: stripOutput,
      sessionStartSec: sessionStart,
      bpm,
      notes,
      voice: leadVoice,
      trackIndex,
      gainMul: velMul,
    });
    return;
  }
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  for (const n of sorted) {
    const when = sessionStart + beatToSec(n.startBeat, bpm);
    const off = when + beatToSec(Math.max(0.08, n.durationBeats), bpm);
    scheduleSe2GrooveLeadNote(
      ctx,
      stripOutput,
      when,
      off,
      n.pitch,
      Math.max(1, Math.min(127, Math.round(n.velocity * velMul))),
      leadVoice,
      trackIndex,
      bpm,
      n.attackSec,
    );
  }
}

export function startSe2SynthGenoPluginLoopPreview(opts: {
  ctx: AudioContext;
  stripOutput: AudioNode;
  bpm: number;
  beatsPerBar: number;
  barCount: number;
  layers: readonly Se2SynthGenoPluginPreviewLayer[];
  loop?: boolean;
  timelineBarCount?: number;
  grooveLeadNotes?: readonly StudioEditor2GenNote[];
  grooveLeadTrackIndex?: number;
  grooveLeadVoice?: Se2GrooveLeadVoiceParams;
  grooveLeadGain?: number;
}): Se2SynthGenoPluginPreviewHandle {
  activePluginPreviewHandle?.stop();
  haltGenoAccordPreviewNotes(opts.ctx);
  const sessionId = currentGenoAccordPreviewSession();
  const generation = ++pluginPreviewGeneration;

  const loop = opts.loop !== false;
  const loopBarCount = genoPluginPreviewTimelineBarCount(
    opts.barCount,
    opts.layers,
    opts.beatsPerBar,
    { timelineBarCount: opts.timelineBarCount },
  );
  const loopBeats = loopBarCount * opts.beatsPerBar;
  const loopSec = beatToSec(loopBeats, opts.bpm);
  const secPerBeat = 60 / Math.max(40, opts.bpm);
  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let nextLoopAudioTime = 0;
  let passAnchorAudioTime = 0;

  const choke = opts.ctx.createGain();
  choke.gain.setValueAtTime(1, opts.ctx.currentTime);
  choke.connect(opts.stripOutput);
  const previewOut = choke;

  const gmIds = opts.layers
    .filter((l) => l.voice.role === 'keys' && l.voice.gmInstrumentId)
    .map((l) => l.voice.gmInstrumentId!);
  const needsMelodyLane = opts.layers.some((l) => l.accordLane === 'melody');

  const runPass = () => {
    if (stopped || generation !== pluginPreviewGeneration) return;
    if (sessionId !== currentGenoAccordPreviewSession()) return;
    clearGenoAccordPassQueue(opts.ctx);
    primeGenoAccordPreviewBus(opts.ctx);
    primePreviewChoke(opts.ctx, choke);
    const now = opts.ctx.currentTime;
    const t0 =
      nextLoopAudioTime > now + SE2_AUDIO_START_FLOOR_SEC
        ? nextLoopAudioTime
        : now + SE2_AUDIO_START_FLOOR_SEC;
    passAnchorAudioTime = t0;
    for (const layer of opts.layers) {
      if (layer.notes.length === 0) continue;
      scheduleLayerPass(opts.ctx, previewOut, t0, opts.bpm, layer);
    }
    if (opts.grooveLeadNotes?.length) {
      scheduleGrooveLeadPass(
        opts.ctx,
        previewOut,
        t0,
        opts.bpm,
        opts.grooveLeadNotes,
        opts.grooveLeadTrackIndex ?? 0,
        opts.grooveLeadVoice,
        true,
        genoPluginPreviewMixGainForLane(
          'grooveLead',
          opts.grooveLeadGain ?? GENO_LANE_PREVIEW_GAIN_DEFAULTS.grooveLead,
        ),
      );
    }
    nextLoopAudioTime = t0 + loopSec;
    if (loop && !stopped && generation === pluginPreviewGeneration && sessionId === currentGenoAccordPreviewSession()) {
      const msUntilNext = Math.max(16, (nextLoopAudioTime - opts.ctx.currentTime) * 1000);
      timeoutId = setTimeout(runPass, msUntilNext);
    }
  };

  const handle: Se2SynthGenoPluginPreviewHandle = {
    getLoopBeat: () => {
      if (stopped) return null;
      if (passAnchorAudioTime <= 0) return 0;
      const elapsed = opts.ctx.currentTime - passAnchorAudioTime;
      if (elapsed < 0) return 0;
      const beat = (elapsed / secPerBeat) % loopBeats;
      return beat < 0 ? beat + loopBeats : beat;
    },
    stop: () => {
      if (stopped) return;
      stopped = true;
      pluginPreviewGeneration += 1;
      if (activePluginPreviewHandle === handle) {
        activePluginPreviewHandle = null;
      }
      if (timeoutId != null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      clearGenoAccordPassQueue(opts.ctx);
      hardMutePreviewChoke(opts.ctx, choke);
      setGenoPluginPreviewMixGains(null);
      try {
        choke.disconnect();
      } catch {
        /* */
      }
    },
  };
  activePluginPreviewHandle = handle;

  void (async () => {
    if (gmIds.length > 0) {
      await warmupGenoAccordSoundfont(
        opts.ctx,
        previewOut,
        gmIds,
        needsMelodyLane ? ['chords', 'melody'] : ['chords'],
      );
    }
    if (
      !stopped
      && generation === pluginPreviewGeneration
      && sessionId === currentGenoAccordPreviewSession()
    ) {
      runPass();
    }
  })();

  return handle;
}

export function stopSe2SynthGenoPluginPreview(
  handle: Se2SynthGenoPluginPreviewHandle | null | undefined,
  ctx?: AudioContext | null,
  opts?: { tearDownAccord?: boolean },
): void {
  pluginPreviewGeneration += 1;
  if (handle) {
    handle.stop();
  } else {
    activePluginPreviewHandle?.stop();
  }
  activePluginPreviewHandle = null;
  if (ctx && opts?.tearDownAccord === true) {
    haltGenoAccordPreviewNotes(ctx);
  }
  setGenoPluginPreviewMixGains(null);
}
