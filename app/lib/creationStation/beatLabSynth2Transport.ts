/**
 * NEW SYNTH — MIDI + metronome scheduling only (playhead WAAPI lives in `beatLabSynth2PlaylineWapi.ts`).
 * Beat Lab screen owns one SE2-mirror transport; this module is the synth2 deck refill path.
 */

import type { MutableRefObject } from 'react';

import { beatLabStepsPerBar, beatLabLaneNoteLenCols } from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import {
  beatLabEffectiveVelocity,
  beatLabPitchSemiAtColumn,
} from '@/app/lib/creationStation/beatLabAutomation';
import { beatLabNoteMidi } from '@/app/lib/creationStation/beatLabMelodicSynth';
import {
  BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS,
  BEAT_LAB_PIANO_TRANSPORT_ONSET_LEAD_SEC,
  beatLabMelodicSlotIndex,
  scheduleBeatLabMelodicNote,
} from '@/app/lib/creationStation/beatLabMelodicSoundfont';
import type { BeatLabMidiNote } from '@/app/lib/creationStation/beatLabMidiRoll';
import { scheduleBeatLabSynthV2Note } from '@/app/lib/creationStation/beatLabMelodicSynthV2Engine';
import { beatLabSynthV2IsLowestNoteAtCol } from '@/app/lib/creationStation/beatLabSynthV2BasslineGenerator';
import {
  beatLabSynthV2ChordGlideSourceMidi,
  beatLabSynthV2LegatoSourceMidi,
  beatLabSynthV2TransportDurationSec,
} from '@/app/lib/creationStation/beatLabMelodicSynthV2Timing';
import { BEAT_LAB_DEFAULT_SYNTH_PRESET_ID } from '@/app/lib/creationStation/beatLabMelodicSynthPresets';
import { beatLabBassSynthVoiceParamsFromPresetId } from '@/app/lib/creationStation/beatLabMelodicSynthV2State';
import {
  beatLabSynth2IsBassLane,
  beatLabSynth2IsHarmonyLane,
} from '@/app/lib/creationStation/beatLabSynthV2LaneRoles';
import { beatLabSynth2PianoRollInstrumentGain } from '@/app/lib/creationStation/beatLabSynthV2PianoBank';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/creationStation/beatLabSe2TransportEngine';
import {
  refillCreationMetronome,
  refillCreationTransportLookahead,
  seedCreationTransportOnPlay,
  type CreationMetronomeClockRefs,
  type CreationTransportClockRefs,
  type CreationTransportRefillOpts,
} from '@/app/lib/creationStation/creationTransportSystem';
import type { BeatLabImportedChordRail } from '@/app/lib/creationStation/chordBuilderBeatLabImport';

export type BeatLabSynth2TransportClock = {
  runningRef: MutableRefObject<boolean>;
  sessionStartRef: MutableRefObject<number>;
  originBeatRef: MutableRefObject<number>;
  cursorBeatRef: MutableRefObject<number>;
  displayBeatRef: MutableRefObject<number>;
  bpmRef: MutableRefObject<number>;
  nextStepBeatRef: MutableRefObject<number>;
  nextStepTimeRef: MutableRefObject<number>;
  nextMetroKRef: MutableRefObject<number>;
  lastScheduledQuarterRef: MutableRefObject<number>;
  schedAnchorTimeRef: MutableRefObject<number>;
  schedAnchorPerfRef: MutableRefObject<number>;
  perfSessionStartMsRef: MutableRefObject<number>;
  creationRefillCtSnapRef: MutableRefObject<number>;
};

export type BeatLabSynth2TransportData = {
  currentMidiRollRef: MutableRefObject<readonly BeatLabMidiNote[]>;
  channelVolumesRef: MutableRefObject<Record<number, number>>;
  currentPitchAutomationRef: MutableRefObject<readonly { col: number; semi: number }[]>;
  currentVolAutomationRef: MutableRefObject<readonly { col: number; vol: number }[]>;
  melodicInstrumentsRef: MutableRefObject<readonly string[]>;
  melodicSynthPresetIdsRef: MutableRefObject<readonly string[]>;
  melodicSynthVoicesRef: MutableRefObject<readonly unknown[]>;
  beatLabSynth2BassLaneRef: MutableRefObject<number>;
  beatLabSynth2HarmonyLaneRef: MutableRefObject<number>;
  beatLabSynth2PianoInstrumentRef: MutableRefObject<string>;
  beatLabSynthChordRailRef: MutableRefObject<BeatLabImportedChordRail | null>;
  patternColsDrumsRef: MutableRefObject<number>;
  patternColsDrumsBeatsRef: MutableRefObject<number>;
  drumStepSubdivRef: MutableRefObject<number>;
  beatsPerBarRef: MutableRefObject<number>;
  loopOnRef: MutableRefObject<boolean>;
  loopStartBeatRef: MutableRefObject<number>;
  loopEndBeatRef: MutableRefObject<number>;
  colWidthRef: MutableRefObject<number>;
  bpmRef: MutableRefObject<number>;
  measuresPerBar: number;
};

export function fireBeatLabSynth2MidiRollStep(
  k: number,
  idealGridT: number,
  ctx: AudioContext,
  clock: BeatLabSynth2TransportClock,
  data: BeatLabSynth2TransportData,
  ctSnap: number,
  onHarmonyPulse?: (midis: number[], ms: number) => void,
): boolean {
  if (!clock.runningRef.current || clock.sessionStartRef.current <= 0) return false;

  const subdiv = Math.max(1, Math.round(data.drumStepSubdivRef.current));
  const gridCols = Math.max(1, Math.round(data.patternColsDrumsRef.current));
  const spbQ = 60 / Math.max(1, clock.bpmRef.current);
  const subSpb = spbQ / subdiv;
  const whenSnap = Math.max(idealGridT, ctSnap + SE2_AUDIO_START_FLOOR_SEC);

  let posInPattern = k;
  if (data.loopOnRef.current && data.loopEndBeatRef.current > data.loopStartBeatRef.current) {
    const ls = Math.floor(data.loopStartBeatRef.current + 1e-8);
    const le = Math.floor(data.loopEndBeatRef.current + 1e-8);
    const span = Math.max(1, le - ls);
    posInPattern = ((k - ls) % span + span) % span;
  }

  const roll = data.currentMidiRollRef.current;
  const harmonyLane = data.beatLabSynth2HarmonyLaneRef.current;
  const bassLane = data.beatLabSynth2BassLaneRef.current;
  const harmonyStepMidis: number[] = [];
  let harmonyHighlightMs = 0;

  for (let s = 0; s < subdiv; s += 1) {
    const colInPattern = ((posInPattern * subdiv + s) % gridCols + gridCols) % gridCols;
    const whenSub = whenSnap + s * subSpb;

    for (const n of roll) {
      if (n.col !== colInPattern || n.muted) continue;

      const midi = Math.max(
        0,
        Math.min(
          127,
          Math.round(
            beatLabNoteMidi(n.lane, n) +
              beatLabPitchSemiAtColumn(data.currentPitchAutomationRef.current, colInPattern, 0),
          ),
        ),
      );
      const velocity = beatLabEffectiveVelocity(
        n.vel,
        data.currentVolAutomationRef.current,
        colInPattern,
      );
      const stepsPerBar = beatLabStepsPerBar(subdiv, data.beatsPerBarRef.current, data.measuresPerBar);
      const colInBar = ((colInPattern % stepsPerBar) + stepsPerBar) % stepsPerBar;
      const safeLenCols = beatLabLaneNoteLenCols(n, colInPattern, roll, gridCols);
      const channelVolumes = data.channelVolumesRef.current;

      if (beatLabSynth2IsHarmonyLane(n.lane, harmonyLane)) {
        if (colInBar !== 0) continue;
        const durationSec = Math.max(0.08, subSpb * safeLenCols);
        const pianoId = data.beatLabSynth2PianoInstrumentRef.current;
        const whenChord = whenSub;
        const whenLocked = Math.max(
          whenChord - BEAT_LAB_PIANO_TRANSPORT_ONSET_LEAD_SEC,
          ctx.currentTime + 0.001,
        );
        scheduleBeatLabMelodicNote(ctx, {
          lane: n.lane,
          midi,
          velocity,
          when: whenChord,
          whenLocked,
          durationSec,
          channelVolumes,
          instrumentId: pianoId,
          instrumentGain: beatLabSynth2PianoRollInstrumentGain(pianoId),
          transportOnsetLeadSec: 0,
        });
        harmonyStepMidis.push(midi);
        harmonyHighlightMs = Math.max(harmonyHighlightMs, Math.round(durationSec * 1000));
        continue;
      }

      if (!beatLabSynth2IsBassLane(n.lane, bassLane)) {
        const slot = beatLabMelodicSlotIndex(n.lane);
        scheduleBeatLabMelodicNote(ctx, {
          lane: n.lane,
          midi,
          velocity,
          when: whenSub,
          durationSec: Math.max(0.08, subSpb * safeLenCols),
          channelVolumes,
          instrumentId:
            data.melodicInstrumentsRef.current[slot] ??
            BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[slot] ??
            'acoustic_grand_piano',
        });
        continue;
      }

      const bassMidiAt = (note: BeatLabMidiNote) =>
        Math.max(
          0,
          Math.min(
            127,
            Math.round(
              beatLabNoteMidi(bassLane, note) +
                beatLabPitchSemiAtColumn(data.currentPitchAutomationRef.current, colInPattern, 0),
            ),
          ),
        );
      if (!beatLabSynthV2IsLowestNoteAtCol(roll, n, colInPattern, bassLane, bassMidiAt)) {
        continue;
      }

      const bassSlot = beatLabMelodicSlotIndex(bassLane);
      const presetId =
        data.melodicSynthPresetIdsRef.current[bassSlot] ?? BEAT_LAB_DEFAULT_SYNTH_PRESET_ID;
      const voice =
        (data.melodicSynthVoicesRef.current[bassSlot] as ReturnType<
          typeof beatLabBassSynthVoiceParamsFromPresetId
        >) ?? beatLabBassSynthVoiceParamsFromPresetId(presetId);
      const durationSec = beatLabSynthV2TransportDurationSec(subSpb, safeLenCols, voice);
      const chordRail = data.beatLabSynthChordRailRef.current;
      scheduleBeatLabSynthV2Note(ctx, {
        lane: bassLane,
        midi,
        velocity,
        when: whenSub,
        whenLocked:
          colInBar === 0
            ? Math.max(whenSub - BEAT_LAB_PIANO_TRANSPORT_ONSET_LEAD_SEC, ctx.currentTime + 0.001)
            : undefined,
        durationSec,
        channelVolumes,
        voice,
        legatoFromMidi:
          voice.glideMode === 'legato'
            ? beatLabSynthV2LegatoSourceMidi(roll, bassLane, colInPattern, bassMidiAt)
            : undefined,
        chordFromMidi:
          voice.glideMode === 'chord' && chordRail
            ? beatLabSynthV2ChordGlideSourceMidi(
                roll,
                bassLane,
                colInPattern,
                midi,
                chordRail,
                subdiv,
                data.measuresPerBar,
                data.measuresPerBar,
                voice.glideBarMask ?? 0xffffffff,
              )
            : undefined,
        bpm: clock.bpmRef.current,
        stepCol: colInPattern,
        stepLenCols: safeLenCols,
        subdiv,
        beatsPerBar: data.measuresPerBar,
        strictNoteOff: true,
        keyRoot: chordRail?.keyRoot,
        keyMode: chordRail?.mode,
      });
    }
  }

  if (harmonyStepMidis.length > 0) onHarmonyPulse?.(harmonyStepMidis, harmonyHighlightMs);
  return true;
}

export function refillBeatLabSynth2Schedule(
  ctx: AudioContext,
  ctSnap: number,
  clock: BeatLabSynth2TransportClock,
  data: BeatLabSynth2TransportData,
  playMetro: (k: number, idealT: number, c: AudioContext) => void,
  metroOn: () => boolean,
  onHarmonyPulse: ((midis: number[], ms: number) => void) | undefined,
  opts?: CreationTransportRefillOpts,
): void {
  if (!clock.runningRef.current || clock.sessionStartRef.current <= 0) return;
  clock.creationRefillCtSnapRef.current = ctSnap;
  if (clock.runningRef.current && clock.sessionStartRef.current > 0) {
    clock.perfSessionStartMsRef.current =
      performance.now() + (clock.sessionStartRef.current - ctSnap) * 1000;
  }

  const spb = 60 / Math.max(1, clock.bpmRef.current);
  const tb = Math.max(1e-9, data.patternColsDrumsBeatsRef.current);

  const metroRefs: CreationMetronomeClockRefs = {
    nextMetroKRef: clock.nextMetroKRef,
    sessionStartRef: clock.sessionStartRef,
    originBeatRef: clock.originBeatRef,
  };
  refillCreationMetronome(
    ctx,
    ctSnap,
    spb,
    metroRefs,
    playMetro,
    () => clock.runningRef.current,
    metroOn,
    opts,
    tb,
  );

  const stepRefs: CreationTransportClockRefs = {
    nextStepBeatRef: clock.nextStepBeatRef,
    nextStepTimeRef: clock.nextStepTimeRef,
    sessionStartRef: clock.sessionStartRef,
    originBeatRef: clock.originBeatRef,
    lastScheduledQuarterRef: clock.lastScheduledQuarterRef,
  };
  refillCreationTransportLookahead(
    ctx,
    ctSnap,
    spb,
    stepRefs,
    (k, idealT, c) =>
      fireBeatLabSynth2MidiRollStep(k, idealT, c, clock, data, ctSnap, onHarmonyPulse),
    () => clock.runningRef.current,
    opts,
  );
}

export function seedBeatLabSynth2TransportOnPlay(
  clock: BeatLabSynth2TransportClock,
  originBeat: number,
  sessionStartAudio: number,
  spb: number,
): void {
  seedCreationTransportOnPlay(
    { nextStepBeatRef: clock.nextStepBeatRef, nextStepTimeRef: clock.nextStepTimeRef },
    originBeat,
    sessionStartAudio,
    spb,
  );
  clock.nextMetroKRef.current = Math.floor(originBeat + 1e-8);
  clock.lastScheduledQuarterRef.current = Math.ceil(originBeat - 1e-8) - 1;
}
