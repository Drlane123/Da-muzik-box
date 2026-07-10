/**
 * Chord Generator — per-bar rhythm chop (mirrors Geno B01 loop editor quant).
 */
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import {
  genoBarChopStepBeats,
  type GenoBarChopQuant,
} from '@/app/lib/studio/se2SynthGenoChordEngine';

export type { GenoBarChopQuant };
export { GENO_BAR_CHOP_OPTIONS } from '@/app/lib/studio/se2SynthGenoChordEngine';

function barRange(barIndex: number, beatsPerBar: number): { start: number; end: number } {
  const bpb = Math.max(1, beatsPerBar);
  const start = barIndex * bpb;
  return { start, end: start + bpb };
}

function noteInBar(note: StudioEditor2GenNote, start: number, end: number): boolean {
  return note.startBeat >= start - 1e-6 && note.startBeat < end - 1e-6;
}

/** Re-strike chord tones in one bar at the chosen chop grid (whole · ½ · ¼ · ⅛ · 16 · 32). */
export function se2ApplyChopQuantToBarNotes(
  allNotes: readonly StudioEditor2GenNote[],
  barIndex: number,
  chopQuant: GenoBarChopQuant,
  beatsPerBar: number,
): StudioEditor2GenNote[] {
  const { start: barStart, end: barEnd } = barRange(barIndex, beatsPerBar);
  const bpb = barEnd - barStart;
  const outside = allNotes.filter((n) => !noteInBar(n, barStart, barEnd));
  const barNotes = allNotes.filter((n) => noteInBar(n, barStart, barEnd));
  if (barNotes.length === 0 || chopQuant === 'whole') return [...allNotes];

  const pitches = [...new Set(barNotes.map((n) => Math.round(n.pitch)))].sort((a, b) => a - b);
  const velocity = Math.max(
    1,
    Math.min(
      127,
      Math.round(barNotes.reduce((sum, n) => sum + n.velocity, 0) / barNotes.length),
    ),
  );

  const chopStep = genoBarChopStepBeats(chopQuant, bpb);
  const chopped: StudioEditor2GenNote[] = [];

  if (chopStep >= bpb - 1e-6) {
    const dur = Math.min(bpb * 0.92, bpb);
    for (const pitch of pitches) {
      chopped.push({ pitch, startBeat: barStart, durationBeats: dur, velocity });
    }
  } else {
    const hitDur = Math.max(0.125, chopStep * 0.86);
    for (let t = barStart; t < barEnd - 1e-6; t += chopStep) {
      for (const pitch of pitches) {
        chopped.push({
          pitch,
          startBeat: t,
          durationBeats: Math.min(hitDur, barEnd - t),
          velocity,
        });
      }
    }
  }

  return [...outside, ...chopped].sort(
    (a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch,
  );
}

export function se2ApplyAllBarChops(
  notes: readonly StudioEditor2GenNote[],
  barChopQuants: readonly GenoBarChopQuant[],
  beatsPerBar: number,
  barCount: number,
): StudioEditor2GenNote[] {
  let out = [...notes];
  for (let bar = 0; bar < barCount; bar += 1) {
    const quant = barChopQuants[bar] ?? 'whole';
    if (quant === 'whole') continue;
    out = se2ApplyChopQuantToBarNotes(out, bar, quant, beatsPerBar);
  }
  return out;
}

export function se2DefaultBarChopQuants(barCount: number): GenoBarChopQuant[] {
  return Array.from({ length: Math.max(0, barCount) }, () => 'whole' as GenoBarChopQuant);
}

export function se2ResizeBarChopQuants(
  prev: readonly GenoBarChopQuant[],
  barCount: number,
): GenoBarChopQuant[] {
  return Array.from({ length: barCount }, (_, i) => prev[i] ?? 'whole');
}
