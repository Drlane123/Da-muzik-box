import type { BeatLabBassSynthVoiceParams } from '@/app/lib/creationStation/beatLabMelodicSynthV2State';
import { beatLabSynthV2GlideSeconds } from '@/app/lib/creationStation/beatLabMelodicSynthV2Timing';
import { emitBeatLabSynthV2GlidePulse } from '@/app/lib/creationStation/beatLabSynthV2GlidePulse';
import { applyBeatLabGlideShiftMarkersToOsc } from '@/app/lib/creationStation/beatLabSynthV2GlideMarkers';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';

function midiToHz(midi: number): number {
  return 440 * 2 ** ((Math.max(0, Math.min(127, midi)) - 69) / 12);
}

function stutterBeatSec(voice: BeatLabBassSynthVoiceParams, bpm: number): number {
  if (voice.glideSync === true) {
    return beatLabSynthV2GlideSeconds(
      { ...voice, glideMs: 0, glideSync: true, glideDivision: voice.glideDivision ?? '1/16' },
      bpm,
    );
  }
  return Math.max(0.006, beatLabSynthV2GlideSeconds(voice, bpm) / 4);
}

function modeSemitones(mode: ChordMode): readonly number[] {
  if (mode === 'minor' || mode === 'harmonicMinor') return [0, 2, 3, 5, 7, 8, 10];
  if (mode === 'dorian') return [0, 2, 3, 5, 7, 9, 10];
  if (mode === 'phrygian') return [0, 1, 3, 5, 7, 8, 10];
  if (mode === 'lydian') return [0, 2, 4, 6, 7, 9, 11];
  if (mode === 'mixolydian') return [0, 2, 4, 5, 7, 9, 10];
  if (mode === 'locrian') return [0, 1, 3, 5, 6, 8, 10];
  if (mode === 'melodicMinor') return [0, 2, 3, 5, 7, 9, 11];
  if (mode === 'phrygianDominant') return [0, 1, 4, 5, 7, 8, 10];
  return [0, 2, 4, 5, 7, 9, 11];
}

function makeKeySnapper(keyRoot?: number, mode?: ChordMode) {
  if (keyRoot == null || mode == null) return undefined;
  const root = ((Math.round(keyRoot) % 12) + 12) % 12;
  const pcs = new Set(modeSemitones(mode).map((s) => (root + s) % 12));
  return (midi: number, dir: 'up' | 'down') => {
    let m = Math.max(0, Math.min(127, Math.round(midi)));
    for (let i = 0; i < 24; i += 1) {
      if (pcs.has(((m % 12) + 12) % 12)) return m;
      m += dir === 'up' ? 1 : -1;
      if (m < 0 || m > 127) break;
    }
    return Math.max(0, Math.min(127, Math.round(midi)));
  };
}

/** Portamento on one oscillator — smooth, quantized stutter steps, optional intra-note repeats, drawn shift markers. */
export function applyBeatLabSynthV2GlideToOsc(
  o: OscillatorNode,
  midi: number,
  when: number,
  glideSec: number,
  fromMidi: number | undefined,
  voice: BeatLabBassSynthVoiceParams,
  bpm: number,
  opts?: {
    lane?: number;
    noteEnd?: number;
    emitPulse?: boolean;
    markerGrid?: {
      stepCol: number;
      noteEndCol: number;
      subSpb: number;
      stepsPerBar: number;
    };
    keyRoot?: number;
    keyMode?: ChordMode;
    slideBarEnabled?: boolean;
  },
): void {
  const hz = midiToHz(midi);
  const hasMainGlide = glideSec > 0.001 && fromMidi != null && fromMidi !== midi;
  const snapMidiInKey = makeKeySnapper(opts?.keyRoot, opts?.keyMode);

  if (hasMainGlide) {
    const hz0 = midiToHz(fromMidi!);
    const style = voice.glideStyle ?? 'smooth';
    const stepSec = stutterBeatSec(voice, bpm);
    const steps =
      style === 'stutter'
        ? Math.max(1, Math.min(48, Math.ceil(glideSec / stepSec)))
        : 1;

    o.frequency.setValueAtTime(hz0, when);
    for (let i = 1; i <= steps; i += 1) {
      const t = when + (glideSec * i) / steps;
      const frac = i / steps;
      o.frequency.linearRampToValueAtTime(hz0 + (hz - hz0) * frac, t);
    }

    if (opts?.emitPulse !== false && opts?.lane != null) {
      emitBeatLabSynthV2GlidePulse({
        lane: opts.lane,
        fromMidi: fromMidi!,
        toMidi: midi,
        durationSec: glideSec,
      });
    }

    const styleR = voice.glideStyle ?? 'smooth';
    if (
      voice.glideIntraNote === true &&
      voice.glideSync === true &&
      opts?.noteEnd != null &&
      styleR === 'stutter'
    ) {
      const noteEnd = opts.noteEnd;
      let phase = when + glideSec;
      let bounce = 0;
      while (phase + stepSec * 0.95 < noteEnd && bounce < 32) {
        const dipSemi = 1.35;
        const dipHz = midiToHz(midi - dipSemi);
        o.frequency.setValueAtTime(hz, phase);
        o.frequency.linearRampToValueAtTime(dipHz, phase + stepSec * 0.4);
        o.frequency.linearRampToValueAtTime(hz, phase + stepSec);
        if (opts.lane != null) {
          emitBeatLabSynthV2GlidePulse({
            lane: opts.lane,
            fromMidi: midi,
            toMidi: midi - dipSemi,
            durationSec: stepSec,
            startPerfMs: performance.now() + (phase - when) * 1000,
          });
        }
        phase += stepSec;
        bounce += 1;
      }
    }
  } else {
    o.frequency.setValueAtTime(hz, when);
  }

  const g = opts?.markerGrid;
  const markers = voice.glideShiftMarkers;
  if (
    g &&
    markers &&
    markers.length > 0 &&
    opts?.noteEnd != null &&
    g.subSpb > 1e-6 &&
    g.stepsPerBar > 0
  ) {
    applyBeatLabGlideShiftMarkersToOsc(
      o,
      midi,
      hasMainGlide ? glideSec : 0,
      markers,
      when,
      opts.noteEnd,
      g.stepCol,
      g.noteEndCol,
      g.subSpb,
      g.stepsPerBar,
      voice.glideQuantShiftSteps ?? 0,
      voice.glideQuantShiftFine ?? 0,
      snapMidiInKey,
    );
  }

  // Bass-guitar-style slide gesture near note head/tail (independent from glide mode).
  if (voice.slideMotionEnabled === true && opts?.noteEnd != null && opts.slideBarEnabled !== false) {
    const noteEnd = opts.noteEnd;
    const noteDur = Math.max(0, noteEnd - when);
    if (noteDur > 0.02) {
      const frac = Math.max(0.08, Math.min(0.8, voice.slideMotionFrac ?? 0.2));
      const quantSlideSec =
        voice.glideSync === true ? beatLabSynthV2GlideSeconds({ ...voice, glideMode: 'mono' }, bpm) : noteDur * frac;
      const rateSec = Math.max(0.01, Math.min(0.4, (voice.slideMotionRateMs ?? 85) / 1000));
      const baseWin = voice.glideSync === true ? quantSlideSec : noteDur * frac;
      const win = Math.max(0.014, Math.min(noteDur * 0.95, Math.max(rateSec, baseWin * 0.7)));
      const semi = Math.max(1, Math.min(12, Math.round(voice.slideMotionSemi ?? 2)));
      const signed = (voice.slideMotionDir ?? 'up') === 'down' ? -semi : semi;
      const slideMidiRaw = midi + signed;
      const slideMidi = snapMidiInKey
        ? snapMidiInKey(slideMidiRaw, signed >= 0 ? 'up' : 'down')
        : slideMidiRaw;
      const hzSlide = midiToHz(slideMidi);
      const at = voice.slideMotionAt ?? 'tail';
      const stableStart = hasMainGlide ? when + glideSec : when;

      const doHead = at === 'head' || at === 'both';
      const doTail = at === 'tail' || at === 'both';

      if (doHead) {
        const t0 = Math.max(stableStart, when + 0.001);
        const t1 = Math.min(noteEnd, t0 + win);
        if (t1 - t0 > 0.008) {
          o.frequency.setValueAtTime(hz, t0);
          const tm = t0 + (t1 - t0) * 0.62;
          const hzMid = hz + (hzSlide - hz) * 0.88;
          o.frequency.linearRampToValueAtTime(hzMid, tm);
          o.frequency.linearRampToValueAtTime(hzSlide, t1);
        }
      }
      if (doTail) {
        const t0 = Math.max(stableStart, noteEnd - win);
        const t1 = noteEnd;
        if (t1 - t0 > 0.008) {
          o.frequency.setValueAtTime(hz, t0);
          const tm = t0 + (t1 - t0) * 0.62;
          const hzMid = hz + (hzSlide - hz) * 0.88;
          o.frequency.linearRampToValueAtTime(hzMid, tm);
          o.frequency.linearRampToValueAtTime(hzSlide, t1);
        }
      }
    }
  }
}
