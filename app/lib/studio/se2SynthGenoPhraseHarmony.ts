/**
 * SongEngine-style phrase helpers — map hand-crafted degree shapes onto live chord tones.
 */
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import { genoMelodyCandidatesFromHarmony, genoMelodyRootFromHarmonyRoot } from '@/app/lib/studio/se2SynthGenoRanges';

export type GenoPhraseDegree =
  | 'root'
  | 'third'
  | 'fifth'
  | 'seventh'
  | 'top'
  | 'ninth'
  | 'eleventh';

export type GenoPhraseEvent = {
  /** Beat offset within bar (4/4 reference — scaled to actual bar length). */
  beat: number;
  dur: number;
  degrees: GenoPhraseDegree[];
  vel?: number;
};

export type GenoPhraseTemplate = {
  id: string;
  events: GenoPhraseEvent[];
};

export function genoPhraseChordTones(col: { rootMidi: number; tones: readonly number[] }): number[] {
  return [...new Set(genoMelodyCandidatesFromHarmony(col))].sort((a, b) => a - b);
}

export function genoPhraseBarRoot(col: { rootMidi: number }): number {
  return genoMelodyRootFromHarmonyRoot(col.rootMidi);
}

export function genoPhraseDegreeToPitch(
  degree: GenoPhraseDegree,
  tones: readonly number[],
  barRoot: number,
): number {
  const n = Math.max(1, tones.length);
  const i1 = Math.min(1, n - 1);
  const i2 = Math.min(2, n - 1);
  const i3 = Math.min(3, n - 1);
  const iTop = n - 1;
  switch (degree) {
    case 'root':
      return barRoot;
    case 'third':
      return tones[i1] ?? barRoot;
    case 'fifth':
      return tones[i2] ?? tones[i1] ?? barRoot;
    case 'seventh':
      return tones[i3] ?? tones[iTop] ?? tones[i1] ?? barRoot;
    case 'top':
      return tones[iTop] ?? barRoot;
    case 'ninth':
      return tones[iTop] != null ? tones[iTop]! + 2 : barRoot + 14;
    case 'eleventh':
      return tones[i2] != null ? tones[i2]! + 2 : barRoot + 17;
  }
}

/** Scale 4/4 template timing to any bar length. */
export function genoPhraseScaleBeat(beat: number, beatsPerBar: number): number {
  const bpb = Math.max(1, beatsPerBar);
  return beat * (bpb / 4);
}

export function genoPhraseScaleDur(dur: number, beatsPerBar: number): number {
  const bpb = Math.max(1, beatsPerBar);
  return dur * (bpb / 4);
}

export type GenoPhraseRenderOpts = {
  bar: number;
  beatsPerBar: number;
  barCount: number;
  tones: readonly number[];
  barRoot: number;
  velBase: number;
  rnd: () => number;
  skipBeatZero?: boolean;
  /** B2 — no random length drift; durations stay on the quant grid. */
  steadyDurations?: boolean;
  /** Lead line only — one pitch per event (no dyads). */
  monophonic?: boolean;
};

export function genoPhraseRenderTemplate(
  template: GenoPhraseTemplate,
  opts: GenoPhraseRenderOpts,
): StudioEditor2GenNote[] {
  const notes: StudioEditor2GenNote[] = [];
  const barStart = opts.bar * opts.beatsPerBar;
  const scaledBeats = template.events.map((e) => genoPhraseScaleBeat(e.beat, opts.beatsPerBar));
  const hitPad = opts.beatsPerBar / 64;

  for (let ei = 0; ei < template.events.length; ei += 1) {
    const ev = template.events[ei]!;
    const beat = scaledBeats[ei]!;
    if (opts.skipBeatZero && beat <= 1e-6) continue;

    const startBeat = barStart + beat;
    if (startBeat >= opts.barCount * opts.beatsPerBar) break;

    const roomInBar = Math.max(0.12, opts.beatsPerBar - beat);
    const roomUntilNext =
      ei + 1 < scaledBeats.length
        ? Math.max(0.12, scaledBeats[ei + 1]! - beat - hitPad)
        : roomInBar;
    const dur = Math.max(
      0.12,
      Math.min(
        roomInBar,
        roomUntilNext,
        opts.steadyDurations
          ? genoPhraseScaleDur(ev.dur, opts.beatsPerBar)
          : genoPhraseScaleDur(ev.dur, opts.beatsPerBar) * (0.88 + opts.rnd() * 0.08),
      ),
    );
    const vel = Math.min(
      118,
      (ev.vel ?? opts.velBase) + Math.floor(opts.rnd() * 12),
    );

    for (const degree of opts.monophonic ? (ev.degrees[0] ? [ev.degrees[0]] : []) : ev.degrees) {
      notes.push({
        pitch: genoPhraseDegreeToPitch(degree, opts.tones, opts.barRoot),
        startBeat,
        durationBeats: dur,
        velocity: ev.degrees.length > 1 ? Math.max(48, vel - 8) : vel,
      });
    }
  }

  return notes;
}

/** Rotate degree names for ascending / descending arp figures. */
export function genoPhraseRotateDegree(
  degree: GenoPhraseDegree,
  step: number,
  direction: 'up' | 'down' | 'up-down' | 'hold',
): GenoPhraseDegree {
  const order: GenoPhraseDegree[] = ['root', 'third', 'fifth', 'seventh', 'ninth', 'eleventh', 'top'];
  const idx = Math.max(0, order.indexOf(degree));
  if (direction === 'hold') return degree;
  if (direction === 'up') return order[Math.min(order.length - 1, idx + (step % 3))]!;
  if (direction === 'down') return order[Math.max(0, idx - (step % 3))]!;
  const cycle = step % 6;
  if (cycle < 3) return order[Math.min(order.length - 1, idx + cycle)]!;
  return order[Math.max(0, idx - (cycle - 2))]!;
}

export function genoPhraseShiftTemplateDegrees(
  template: GenoPhraseTemplate,
  direction: 'up' | 'down' | 'up-down' | 'hold',
): GenoPhraseTemplate {
  return {
    id: `${template.id}-${direction}`,
    events: template.events.map((ev, i) => ({
      ...ev,
      degrees: ev.degrees.map((d) => genoPhraseRotateDegree(d, i, direction)),
    })),
  };
}
