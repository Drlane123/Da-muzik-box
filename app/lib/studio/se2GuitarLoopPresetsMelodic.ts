/**
 * SE2 Guitar — melodic loop presets (R&B, blues, funk).
 * Progressions inspired by neo-soul / gospel / classic blues literature
 * (floating minor loops, Hathaway-style lifts, 8-bar blues forms).
 */
import type { Se2GuitarInstrumentId } from '@/app/lib/studio/se2GuitarInstruments';
import type { Se2GuitarLoopNote, Se2GuitarLoopPreset } from '@/app/lib/studio/se2GuitarLoopPresets';

function bar(b: number, beatsPerBar = 4): number {
  return b * beatsPerBar;
}

function strum(
  pitches: readonly number[],
  beat: number,
  dur: number,
  vel: number,
  spread = 0.04,
): Se2GuitarLoopNote[] {
  return pitches.map((pitch, i) => ({
    pitch,
    startBeat: beat + i * spread,
    durationBeats: dur,
    velocity: Math.max(40, vel - i * 3),
  }));
}

function n(pitch: number, startBeat: number, durationBeats: number, velocity: number): Se2GuitarLoopNote {
  return { pitch, startBeat, durationBeats, velocity };
}

/** Chord hit + optional melody notes on top string. */
function barComp(
  barIndex: number,
  chord: readonly number[],
  hits: readonly [number, number, number][],
  melody?: readonly [number, number, number, number][],
): Se2GuitarLoopNote[] {
  const out: Se2GuitarLoopNote[] = [];
  for (const [beatInBar, dur, vel] of hits) {
    out.push(...strum(chord, bar(barIndex) + beatInBar, dur, vel));
  }
  if (melody) {
    for (const [beatInBar, pitch, dur, vel] of melody) {
      out.push(n(pitch, bar(barIndex) + beatInBar, dur, vel));
    }
  }
  return out;
}

// ─── R&B / Neo-soul (4 bar) ─────────────────────────────────────────────────

/** Am9 – Gmaj7 – Fmaj9 – Em9 floating loop + top-string melody. */
const RNB_FLOATING_MINOR_4: Se2GuitarLoopPreset = {
  id: 'rnb_floating_minor_4',
  genre: 'rnb',
  bars: 4,
  label: 'Floating minor',
  hint: 'Neo-soul ballad loop — Am9 through Em9 with singing top line',
  chordLine: 'Am9 · Gmaj7 · Fmaj9 · Em9',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...barComp(0, [45, 52, 55, 57, 62], [[0, 0.6, 74], [2, 0.35, 68]], [[0.5, 69, 0.35, 82], [1.5, 71, 0.3, 78], [2.75, 72, 0.4, 80]]),
    ...barComp(1, [43, 47, 50, 55, 59], [[0, 0.6, 72], [2, 0.35, 66]], [[0.5, 67, 0.35, 80], [1.5, 69, 0.3, 76], [2.75, 71, 0.4, 78]]),
    ...barComp(2, [41, 48, 53, 57, 60], [[0, 0.6, 70], [2, 0.35, 64]], [[0.5, 65, 0.35, 78], [1.5, 67, 0.3, 74], [2.75, 69, 0.4, 76]]),
    ...barComp(3, [40, 47, 52, 55, 59], [[0, 0.6, 72], [2, 0.35, 66]], [[0.5, 64, 0.35, 76], [1.5, 62, 0.3, 72], [2.75, 64, 0.5, 74]]),
  ],
};

/** Bbmaj9 – Cm9 – Dm7 – Ebmaj9 ascending gospel-soul lift. */
const RNB_HATHAWAY_LIFT_4: Se2GuitarLoopPreset = {
  id: 'rnb_hathaway_lift_4',
  genre: 'rnb',
  bars: 4,
  label: 'Hathaway lift',
  hint: 'Church-to-soul ascending climb — Donny Hathaway-style diatonic rise',
  chordLine: 'Bbmaj9 · Cm9 · Dm7 · Ebmaj9',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...barComp(0, [46, 50, 53, 57, 60], [[0, 0.8, 70], [2.5, 0.4, 64]], [[1, 60, 0.45, 76], [2, 62, 0.35, 72]]),
    ...barComp(1, [48, 51, 55, 58, 62], [[0, 0.8, 72], [2.5, 0.4, 66]], [[1, 62, 0.45, 78], [2, 63, 0.35, 74]]),
    ...barComp(2, [50, 53, 57, 60, 64], [[0, 0.8, 74], [2.5, 0.4, 68]], [[1, 64, 0.45, 80], [2, 65, 0.35, 76]]),
    ...barComp(3, [51, 55, 58, 62, 65], [[0, 0.9, 76], [2, 0.5, 70]], [[0.5, 65, 0.4, 82], [1.5, 67, 0.35, 78], [2.75, 69, 0.45, 80]]),
  ],
};

/** Dm9 – G13 – Cmaj9 – Bbmaj9 Glasper-style cycle. */
const RNB_GLASPER_CYCLE_4: Se2GuitarLoopPreset = {
  id: 'rnb_glasper_cycle_4',
  genre: 'rnb',
  bars: 4,
  label: 'Glasper cycle',
  hint: 'Modal ii–V–I with bVIImaj9 — Robert Glasper harmonic color',
  chordLine: 'Dm9 · G13 · Cmaj9 · Bbmaj9',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...barComp(0, [50, 53, 57, 60, 64], [[1, 0.45, 82], [2.5, 0.35, 76]], [[0, 69, 0.3, 74], [1.75, 71, 0.25, 78], [3, 72, 0.35, 76]]),
    ...barComp(1, [43, 47, 50, 53, 57, 61], [[1, 0.45, 84], [2.5, 0.35, 78]], [[0, 71, 0.3, 76], [1.75, 73, 0.25, 80], [3, 74, 0.35, 78]]),
    ...barComp(2, [48, 52, 55, 59, 62], [[1, 0.45, 86], [2.5, 0.35, 80]], [[0, 72, 0.3, 78], [1.75, 74, 0.25, 82], [3, 76, 0.35, 80]]),
    ...barComp(3, [46, 50, 53, 57, 60], [[1, 0.45, 84], [2.5, 0.35, 78]], [[0, 70, 0.3, 76], [1.75, 69, 0.25, 80], [3, 67, 0.4, 78]]),
  ],
};

/** Gmin9 – Emin11 – Ebmaj9 – D7#9 classic neo-soul pack progression. */
const RNB_GMIN_NEO_4: Se2GuitarLoopPreset = {
  id: 'rnb_gminor_neo_4',
  genre: 'rnb',
  bars: 4,
  label: 'G minor neo',
  hint: 'Advanced neo-soul loop — Gmin9 through altered D7#9',
  chordLine: 'Gmin9 · Emin11 · Ebmaj9 · D7#9',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...barComp(0, [43, 50, 53, 57, 62], [[0, 0.5, 78], [1.5, 0.35, 72], [2.5, 0.35, 74]], [[1, 65, 0.3, 80], [2, 67, 0.25, 76]]),
    ...barComp(1, [40, 47, 52, 55, 59, 62], [[0, 0.5, 76], [1.5, 0.35, 70], [2.5, 0.35, 72]], [[1, 62, 0.3, 78], [2, 64, 0.25, 74]]),
    ...barComp(2, [39, 46, 51, 55, 58], [[0, 0.5, 74], [1.5, 0.35, 68], [2.5, 0.35, 70]], [[1, 58, 0.3, 76], [2, 60, 0.25, 72]]),
    ...barComp(3, [38, 42, 46, 49, 53, 56], [[0, 0.45, 80], [1.5, 0.35, 74], [2.5, 0.35, 76]], [[1, 57, 0.3, 82], [2, 56, 0.25, 78], [3, 54, 0.35, 76]]),
  ],
};

/** Cmaj7 – Em9 – Fmaj7 – G13 gospel-inspired loop. */
const RNB_GOSPEL_EXTENDED_4: Se2GuitarLoopPreset = {
  id: 'rnb_gospel_extended_4',
  genre: 'rnb',
  bars: 4,
  label: 'Gospel loop',
  hint: 'Gospel-inspired maj7 / m9 loop with hammer-on melody fills',
  chordLine: 'Cmaj7 · Em9 · Fmaj7 · G13',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    ...barComp(0, [48, 52, 55, 59], [[0, 0.55, 88], [2, 0.35, 80]], [[0.75, 60, 0.2, 84], [1, 62, 0.25, 86], [2.5, 64, 0.3, 82]]),
    ...barComp(1, [40, 47, 52, 55, 59], [[0, 0.55, 86], [2, 0.35, 78]], [[0.75, 59, 0.2, 82], [1, 57, 0.25, 84], [2.5, 59, 0.3, 80]]),
    ...barComp(2, [41, 48, 53, 57], [[0, 0.55, 84], [2, 0.35, 76]], [[0.75, 57, 0.2, 80], [1, 60, 0.25, 82], [2.5, 62, 0.3, 78]]),
    ...barComp(3, [43, 47, 50, 53, 57, 61], [[0, 0.5, 90], [2, 0.35, 82]], [[0.75, 61, 0.2, 86], [1, 62, 0.25, 88], [2.5, 64, 0.35, 84]]),
  ],
};

/** Dmaj9 – Bm9 – Gmaj9 – A13 emotional neo-soul release. */
const RNB_EMOTIONAL_4: Se2GuitarLoopPreset = {
  id: 'rnb_emotional_4',
  genre: 'rnb',
  bars: 4,
  label: 'Emotional',
  hint: 'I–vi–IV–V with lush extensions — heart-on-sleeve R&B',
  chordLine: 'Dmaj9 · Bm9 · Gmaj9 · A13',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...barComp(0, [50, 54, 57, 61, 64], [[0, 0.85, 72], [2.5, 0.4, 66]], [[1, 69, 0.4, 78], [2, 71, 0.35, 74]]),
    ...barComp(1, [47, 54, 57, 59, 64], [[0, 0.85, 70], [2.5, 0.4, 64]], [[1, 66, 0.4, 76], [2, 64, 0.35, 72]]),
    ...barComp(2, [43, 47, 50, 55, 59], [[0, 0.85, 74], [2.5, 0.4, 68]], [[1, 62, 0.4, 80], [2, 64, 0.35, 76]]),
    ...barComp(3, [45, 49, 52, 57, 61, 65], [[0, 0.75, 76], [2, 0.45, 70]], [[0.5, 69, 0.35, 82], [1.5, 71, 0.3, 78], [2.75, 73, 0.4, 80]]),
  ],
};

/** Bm9 – Emaj9 – C#m9 – Amaj9 Solange-style floating progression. */
const RNB_CRANES_SKY_4: Se2GuitarLoopPreset = {
  id: 'rnb_cranes_sky_4',
  genre: 'rnb',
  bars: 4,
  label: 'Cranes sky',
  hint: 'Sparse soul plucks — never-quite-resolves minor-major drift',
  chordLine: 'Bm9 · Emaj9 · C#m9 · Amaj9',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...barComp(0, [47, 54, 57, 59, 64], [[1, 0.5, 76], [2.75, 0.35, 70]], [[0, 66, 0.4, 74], [2, 64, 0.35, 72]]),
    ...barComp(1, [40, 47, 52, 56, 59], [[1, 0.5, 78], [2.75, 0.35, 72]], [[0, 64, 0.4, 76], [2, 62, 0.35, 74]]),
    ...barComp(2, [49, 56, 59, 61, 66], [[1, 0.5, 74], [2.75, 0.35, 68]], [[0, 68, 0.4, 72], [2, 66, 0.35, 70]]),
    ...barComp(3, [45, 52, 57, 61, 64], [[1, 0.5, 80], [2.75, 0.35, 74]], [[0, 69, 0.4, 78], [2, 67, 0.35, 76]]),
  ],
};

/** Em7 – Am7 Jairus Mozee-style syncopated chord melody. */
const RNB_MOZEE_POCKET_4: Se2GuitarLoopPreset = {
  id: 'rnb_mozee_pocket_4',
  genre: 'rnb',
  bars: 4,
  label: 'Mozee pocket',
  hint: 'Syncopated ghost-note comp with ascending triad melody',
  chordLine: 'Em7 · Am7 · Em7 · Am7',
  instrumentId: 'electric_guitar_clean',
  notes: [
    n(52, bar(0), 0.12, 58),
    n(52, bar(0) + 0.25, 0.12, 56),
    ...strum([40, 47, 52, 55], bar(0) + 0.5, 0.25, 84),
    n(52, bar(0) + 1, 0.12, 58),
    n(55, bar(0) + 1.25, 0.2, 78),
    n(57, bar(0) + 1.5, 0.2, 80),
    n(59, bar(0) + 1.75, 0.2, 82),
    n(52, bar(0) + 2.5, 0.12, 56),
    ...strum([40, 47, 52, 55], bar(0) + 3, 0.25, 82),
    n(57, bar(1), 0.12, 58),
    ...strum([45, 52, 57, 60], bar(1) + 0.5, 0.25, 86),
    n(60, bar(1) + 1.25, 0.2, 80),
    n(62, bar(1) + 1.5, 0.2, 82),
    n(64, bar(1) + 1.75, 0.2, 84),
    n(57, bar(1) + 2.5, 0.12, 56),
    ...strum([45, 52, 57, 60], bar(1) + 3, 0.25, 84),
    n(52, bar(2), 0.12, 58),
    ...strum([40, 47, 52, 55], bar(2) + 0.5, 0.25, 84),
    n(59, bar(2) + 1.5, 0.35, 82),
    n(57, bar(2) + 2.25, 0.25, 78),
    n(55, bar(2) + 2.75, 0.25, 76),
    n(57, bar(3), 0.12, 58),
    ...strum([45, 52, 57, 60], bar(3) + 0.5, 0.25, 88),
    n(64, bar(3) + 1.5, 0.35, 84),
    n(62, bar(3) + 2.25, 0.25, 80),
    n(60, bar(3) + 2.75, 0.25, 78),
  ],
};

/** Am7 – D9 – Gmaj7 – Cmaj7 classic neo-soul progression + melody. */
const RNB_CLASSIC_NEO_4: Se2GuitarLoopPreset = {
  id: 'rnb_classic_neo_4',
  genre: 'rnb',
  bars: 4,
  label: 'Classic neo',
  hint: 'The textbook neo-soul IV-loop with warm top-line melody',
  chordLine: 'Am7 · D9 · Gmaj7 · Cmaj7',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...barComp(0, [45, 52, 55, 57], [[0, 0.6, 76], [2, 0.35, 70]], [[0.5, 69, 0.35, 80], [1.5, 67, 0.3, 76], [2.75, 65, 0.35, 74]]),
    ...barComp(1, [50, 54, 57, 60, 64], [[0, 0.6, 78], [2, 0.35, 72]], [[0.5, 67, 0.35, 82], [1.5, 69, 0.3, 78], [2.75, 71, 0.35, 76]]),
    ...barComp(2, [43, 47, 50, 55, 59], [[0, 0.6, 80], [2, 0.35, 74]], [[0.5, 71, 0.35, 84], [1.5, 69, 0.3, 80], [2.75, 67, 0.35, 78]]),
    ...barComp(3, [48, 52, 55, 59], [[0, 0.6, 82], [2, 0.35, 76]], [[0.5, 72, 0.35, 86], [1.5, 74, 0.3, 82], [2.75, 76, 0.4, 80]]),
  ],
};

/** E9 – A9 funk neo-soul vamp with rhythmic melody. */
const RNB_E9_VAMP_4: Se2GuitarLoopPreset = {
  id: 'rnb_e9_vamp_4',
  genre: 'rnb',
  bars: 4,
  label: 'E9 vamp',
  hint: 'Dominant 9th funk vamp — 16th syncopation with lead fills',
  chordLine: 'E9 · A9 · E9 · A9',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...strum([40, 44, 47, 50, 54], bar(0), 0.2, 92),
    ...strum([40, 44, 47, 50, 54], bar(0) + 0.75, 0.2, 88),
    ...strum([40, 44, 47, 50, 54], bar(0) + 1.5, 0.2, 90),
    n(59, bar(0) + 2.25, 0.25, 84),
    n(57, bar(0) + 2.75, 0.25, 82),
    ...strum([45, 49, 52, 57, 61], bar(1), 0.2, 94),
    ...strum([45, 49, 52, 57, 61], bar(1) + 0.75, 0.2, 90),
    ...strum([45, 49, 52, 57, 61], bar(1) + 1.5, 0.2, 92),
    n(64, bar(1) + 2.25, 0.25, 86),
    n(62, bar(1) + 2.75, 0.25, 84),
    ...strum([40, 44, 47, 50, 54], bar(2), 0.2, 92),
    ...strum([40, 44, 47, 50, 54], bar(2) + 1, 0.2, 88),
    n(61, bar(2) + 2, 0.3, 86),
    n(59, bar(2) + 2.5, 0.3, 84),
    n(57, bar(2) + 3, 0.25, 82),
    ...strum([45, 49, 52, 57, 61], bar(3), 0.2, 94),
    ...strum([45, 49, 52, 57, 61], bar(3) + 1, 0.2, 90),
    n(66, bar(3) + 2, 0.3, 88),
    n(64, bar(3) + 2.5, 0.3, 86),
    n(62, bar(3) + 3, 0.25, 84),
  ],
};

// ─── R&B (8 bar) ────────────────────────────────────────────────────────────

const RNB_NEO_BALLAD_8: Se2GuitarLoopPreset = {
  id: 'rnb_neo_ballad_8',
  genre: 'rnb',
  bars: 8,
  label: 'Neo ballad',
  hint: 'Eight-bar floating minor loop with evolving melody — verse length',
  chordLine: 'Am9–Gmaj7–Fmaj9–Em9 ×2',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...RNB_FLOATING_MINOR_4.notes,
    ...RNB_FLOATING_MINOR_4.notes.map((note) => ({
      ...note,
      startBeat: note.startBeat + 16,
      velocity: Math.min(127, note.velocity + 2),
    })),
    n(74, bar(4) + 2.5, 0.4, 82),
    n(76, bar(5) + 2.5, 0.4, 84),
    n(77, bar(6) + 2.5, 0.4, 86),
    n(76, bar(7) + 2.5, 0.5, 84),
  ],
};

const RNB_CHURCH_SOUL_8: Se2GuitarLoopPreset = {
  id: 'rnb_church_soul_8',
  genre: 'rnb',
  bars: 8,
  label: 'Church soul',
  hint: 'Gospel R&B eight-bar — Hathaway lift then emotional release',
  chordLine: 'Bbmaj9…Ebmaj9 · Dmaj9…A13',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...RNB_HATHAWAY_LIFT_4.notes,
    ...RNB_EMOTIONAL_4.notes.map((note) => ({ ...note, startBeat: note.startBeat + 16 })),
  ],
};

const RNB_SILK_ROAD_8: Se2GuitarLoopPreset = {
  id: 'rnb_silk_road_8',
  genre: 'rnb',
  bars: 8,
  label: 'Silk road',
  hint: 'G minor neo into Glasper cycle — long-form soul journey',
  chordLine: 'Gmin9…D7#9 · Dm9…Bbmaj9',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...RNB_GMIN_NEO_4.notes,
    ...RNB_GLASPER_CYCLE_4.notes.map((note) => ({ ...note, startBeat: note.startBeat + 16 })),
  ],
};

const RNB_MIDNIGHT_8: Se2GuitarLoopPreset = {
  id: 'rnb_midnight_8',
  genre: 'rnb',
  bars: 8,
  label: 'Midnight',
  hint: 'Quiet storm eight-bar — sparse chords, singing melody throughout',
  chordLine: 'Cmaj7 · Am9 · Fmaj9 · G13 ×2',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...barComp(0, [48, 52, 55, 59], [[0, 1.5, 68]], [[0.5, 72, 0.5, 74], [1.5, 74, 0.5, 76], [2.5, 76, 0.6, 78]]),
    ...barComp(1, [45, 52, 55, 57, 62], [[0, 1.5, 66]], [[0.5, 69, 0.5, 72], [1.5, 71, 0.5, 74], [2.5, 72, 0.6, 76]]),
    ...barComp(2, [41, 48, 53, 57], [[0, 1.5, 64]], [[0.5, 65, 0.5, 70], [1.5, 67, 0.5, 72], [2.5, 69, 0.6, 74]]),
    ...barComp(3, [43, 47, 50, 53, 57, 61], [[0, 1.25, 70]], [[0.5, 69, 0.5, 76], [1.5, 71, 0.5, 78], [2.75, 73, 0.5, 80]]),
    ...barComp(4, [48, 52, 55, 59], [[0, 1.5, 70]], [[0.5, 74, 0.5, 76], [1.5, 76, 0.5, 78], [2.5, 77, 0.6, 80]]),
    ...barComp(5, [45, 52, 55, 57, 62], [[0, 1.5, 68]], [[0.5, 71, 0.5, 74], [1.5, 72, 0.5, 76], [2.5, 74, 0.6, 78]]),
    ...barComp(6, [41, 48, 53, 57], [[0, 1.5, 66]], [[0.5, 67, 0.5, 72], [1.5, 69, 0.5, 74], [2.5, 71, 0.6, 76]]),
    ...barComp(7, [43, 47, 50, 53, 57, 61], [[0, 1.0, 72]], [[0.5, 73, 0.4, 82], [1.25, 74, 0.4, 84], [2, 76, 0.5, 86], [3, 74, 0.5, 82]]),
  ],
};

// ─── Blues (4 bar) ──────────────────────────────────────────────────────────

/** A blues box call — pentatonic phrase over A7. */
const BLUES_BB_CALL_4: Se2GuitarLoopPreset = {
  id: 'blues_bb_call_4',
  genre: 'blues',
  bars: 4,
  label: 'B.B. call',
  hint: 'B.B. King box call — sustained soul bends on the IV',
  chordLine: 'A7 · A7 · D7 · E7',
  instrumentId: 'overdriven_guitar',
  notes: [
    n(57, bar(0), 0.75, 94),
    n(59, bar(0) + 0.75, 0.25, 88),
    n(57, bar(0) + 1.25, 0.35, 90),
    n(54, bar(0) + 2, 0.5, 86),
    n(57, bar(0) + 3, 0.5, 92),
    n(59, bar(1), 0.75, 96),
    n(60, bar(1) + 1, 0.35, 90),
    n(57, bar(1) + 2, 0.75, 94),
    n(50, bar(2), 0.75, 92),
    n(52, bar(2) + 1, 0.35, 86),
    n(54, bar(2) + 2, 0.5, 90),
    n(57, bar(2) + 3, 0.35, 94),
    n(59, bar(3), 0.5, 98),
    n(61, bar(3) + 0.5, 0.25, 94),
    n(59, bar(3) + 1, 0.25, 90),
    n(57, bar(3) + 1.5, 0.25, 88),
    n(56, bar(3) + 2, 0.5, 92),
  ],
};

/** Clapton-style pentatonic turnaround in A. */
const BLUES_CLAPTON_TURN_4: Se2GuitarLoopPreset = {
  id: 'blues_clapton_turn_4',
  genre: 'blues',
  bars: 4,
  label: 'Clapton turn',
  hint: 'Clapton-inspired pentatonic turnaround — major/minor blend',
  chordLine: 'A7 · D7 · A7 · E7',
  instrumentId: 'overdriven_guitar',
  notes: [
    n(57, bar(0), 0.5, 92),
    n(59, bar(0) + 0.5, 0.25, 86),
    n(57, bar(0) + 1, 0.25, 84),
    n(54, bar(0) + 1.5, 0.25, 82),
    n(52, bar(0) + 2, 0.5, 88),
    n(50, bar(1), 0.75, 90),
    n(52, bar(1) + 1, 0.25, 84),
    n(54, bar(1) + 1.5, 0.25, 86),
    n(57, bar(1) + 2, 0.5, 92),
    n(59, bar(1) + 2.75, 0.25, 88),
    n(57, bar(2), 0.75, 94),
    n(60, bar(2) + 1.25, 0.35, 90),
    n(57, bar(2) + 2.5, 0.5, 92),
    n(59, bar(3), 0.35, 96),
    n(61, bar(3) + 0.35, 0.25, 94),
    n(59, bar(3) + 0.75, 0.25, 90),
    n(57, bar(3) + 1.25, 0.25, 88),
    n(56, bar(3) + 1.75, 0.25, 86),
    n(54, bar(3) + 2.25, 0.35, 90),
    n(52, bar(3) + 2.75, 0.35, 88),
  ],
};

/** Robert Johnson / Love in Vain descending chromatic with pedal A. */
const BLUES_ROBERT_PEDAL_4: Se2GuitarLoopPreset = {
  id: 'blues_robert_pedal_4',
  genre: 'blues',
  bars: 4,
  label: 'Robert pedal',
  hint: 'Robert Johnson-style descending chromatic line — pedal A on top',
  chordLine: 'A · A · D · E',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    n(69, bar(0), 0.5, 88),
    n(68, bar(0) + 0.5, 0.5, 84),
    n(67, bar(0) + 1, 0.5, 82),
    n(66, bar(0) + 1.5, 0.5, 80),
    n(65, bar(0) + 2, 0.5, 84),
    n(69, bar(0) + 2.5, 0.35, 86),
    n(68, bar(0) + 3, 0.35, 82),
    n(69, bar(1), 0.5, 88),
    n(67, bar(1) + 0.5, 0.5, 84),
    n(65, bar(1) + 1, 0.5, 82),
    n(64, bar(1) + 1.5, 0.5, 80),
    n(62, bar(1) + 2, 0.5, 84),
    n(69, bar(1) + 2.75, 0.35, 86),
    n(67, bar(2), 0.5, 90),
    n(65, bar(2) + 0.5, 0.5, 86),
    n(64, bar(2) + 1, 0.5, 84),
    n(62, bar(2) + 1.5, 0.5, 82),
    n(60, bar(2) + 2, 0.5, 86),
    n(69, bar(2) + 3, 0.35, 88),
    n(64, bar(3), 0.5, 92),
    n(62, bar(3) + 0.5, 0.35, 88),
    n(61, bar(3) + 1, 0.35, 86),
    n(59, bar(3) + 1.5, 0.35, 84),
    n(57, bar(3) + 2, 0.5, 90),
    ...strum([40, 44, 47, 52], bar(3) + 2.75, 0.5, 94),
  ],
};

/** Call-and-response blues phrase. */
const BLUES_CALL_RESPONSE_4: Se2GuitarLoopPreset = {
  id: 'blues_call_response_4',
  genre: 'blues',
  bars: 4,
  label: 'Call & answer',
  hint: 'Two-bar call, two-bar answer — classic blues dialog',
  chordLine: 'A7 · A7 · D7 · E7',
  instrumentId: 'overdriven_guitar',
  notes: [
    n(57, bar(0), 0.35, 96),
    n(59, bar(0) + 0.5, 0.35, 92),
    n(57, bar(0) + 1, 0.35, 90),
    n(54, bar(0) + 1.75, 0.5, 88),
    n(57, bar(1), 0.35, 94),
    n(60, bar(1) + 0.5, 0.35, 90),
    n(57, bar(1) + 1.25, 0.5, 92),
    n(54, bar(1) + 2.25, 0.35, 86),
    n(50, bar(2), 0.35, 94),
    n(52, bar(2) + 0.5, 0.35, 90),
    n(54, bar(2) + 1, 0.35, 92),
    n(57, bar(2) + 1.75, 0.5, 94),
    n(54, bar(3), 0.35, 96),
    n(56, bar(3) + 0.5, 0.35, 92),
    n(57, bar(3) + 1, 0.35, 94),
    n(59, bar(3) + 1.5, 0.25, 90),
    n(57, bar(3) + 2, 0.25, 88),
    n(56, bar(3) + 2.5, 0.25, 86),
    n(54, bar(3) + 3, 0.35, 90),
  ],
};

/** Key to the Highway style root-fifth-sixth walk in A. */
const BLUES_HIGHWAY_WALK_4: Se2GuitarLoopPreset = {
  id: 'blues_highway_walk_4',
  genre: 'blues',
  bars: 4,
  label: 'Highway walk',
  hint: 'Root–5–6 bass walk — Key to the Highway rhythm figure',
  chordLine: 'A7 · E7 · D7 · D7',
  instrumentId: 'electric_guitar_clean',
  notes: [
    n(45, bar(0), 0.5, 92),
    n(52, bar(0) + 0.5, 0.25, 86),
    n(54, bar(0) + 0.75, 0.25, 84),
    n(57, bar(0) + 1, 0.5, 88),
    n(45, bar(0) + 2, 0.5, 90),
    n(52, bar(0) + 2.5, 0.25, 84),
    n(54, bar(0) + 2.75, 0.25, 82),
    n(40, bar(1), 0.5, 94),
    n(47, bar(1) + 0.5, 0.25, 88),
    n(49, bar(1) + 0.75, 0.25, 86),
    n(52, bar(1) + 1, 0.5, 90),
    n(40, bar(1) + 2, 0.5, 92),
    n(47, bar(1) + 2.5, 0.25, 86),
    n(49, bar(1) + 2.75, 0.25, 84),
    n(38, bar(2), 0.5, 96),
    n(45, bar(2) + 0.5, 0.25, 90),
    n(47, bar(2) + 0.75, 0.25, 88),
    n(50, bar(2) + 1, 0.5, 92),
    n(38, bar(2) + 2, 0.5, 94),
    n(45, bar(2) + 2.5, 0.25, 88),
    n(47, bar(2) + 2.75, 0.25, 86),
    n(38, bar(3), 0.5, 96),
    n(45, bar(3) + 0.5, 0.25, 90),
    n(47, bar(3) + 0.75, 0.25, 88),
    n(50, bar(3) + 1, 0.5, 92),
    n(52, bar(3) + 2, 0.35, 94),
    n(54, bar(3) + 2.5, 0.35, 96),
    n(57, bar(3) + 3, 0.35, 98),
  ],
};

/** T-Bone Walker slow blues sustained melody. */
const BLUES_TBONE_SLOW_4: Se2GuitarLoopPreset = {
  id: 'blues_tbone_slow_4',
  genre: 'blues',
  bars: 4,
  label: 'T-Bone slow',
  hint: 'Slow blues sustain — T-Bone Walker phrasing with E7#5 turn',
  chordLine: 'A7 · D7 · A7 · E7#5',
  instrumentId: 'overdriven_guitar',
  notes: [
    n(57, bar(0), 1.25, 90),
    n(59, bar(0) + 1.5, 0.35, 84),
    n(57, bar(0) + 2.25, 0.5, 88),
    n(50, bar(1), 1.25, 88),
    n(52, bar(1) + 1.5, 0.35, 82),
    n(54, bar(1) + 2.25, 0.5, 86),
    n(57, bar(2), 1.25, 92),
    n(60, bar(2) + 1.5, 0.35, 86),
    n(57, bar(2) + 2.25, 0.5, 90),
    n(61, bar(3), 0.5, 96),
    n(59, bar(3) + 0.5, 0.25, 92),
    n(57, bar(3) + 1, 0.25, 88),
    n(56, bar(3) + 1.5, 0.25, 86),
    n(55, bar(3) + 2, 0.35, 90),
    ...strum([40, 44, 48, 51], bar(3) + 2.75, 0.5, 94),
  ],
};

// ─── Blues (8 bar) ──────────────────────────────────────────────────────────

/** Full Key to the Highway 8-bar: A–E–D–D–A–E–A–E. */
const BLUES_KEY_HIGHWAY_8: Se2GuitarLoopPreset = {
  id: 'blues_key_highway_8',
  genre: 'blues',
  bars: 8,
  label: 'Key highway',
  hint: 'Full 8-bar Key to the Highway — shuffle rhythm + melody fills',
  chordLine: 'A · E · D · D · A · E · A · E',
  instrumentId: 'electric_guitar_clean',
  notes: [
    n(45, bar(0), 0.5, 92),
    n(52, bar(0) + 0.5, 0.25, 86),
    n(54, bar(0) + 0.75, 0.25, 84),
    n(57, bar(0) + 1, 0.5, 88),
    n(45, bar(0) + 2, 0.5, 90),
    n(59, bar(0) + 2.75, 0.35, 92),
    n(40, bar(1), 0.5, 94),
    n(47, bar(1) + 0.5, 0.25, 88),
    n(49, bar(1) + 0.75, 0.25, 86),
    n(52, bar(1) + 1, 0.5, 90),
    n(40, bar(1) + 2, 0.5, 92),
    n(54, bar(1) + 2.75, 0.35, 94),
    n(38, bar(2), 0.5, 96),
    n(45, bar(2) + 0.5, 0.25, 90),
    n(47, bar(2) + 0.75, 0.25, 88),
    n(50, bar(2) + 1, 0.5, 92),
    n(38, bar(2) + 2, 0.5, 94),
    n(57, bar(2) + 2.75, 0.35, 96),
    n(38, bar(3), 0.5, 96),
    n(45, bar(3) + 0.5, 0.25, 90),
    n(47, bar(3) + 0.75, 0.25, 88),
    n(50, bar(3) + 1, 0.5, 92),
    n(54, bar(3) + 2, 0.35, 94),
    n(57, bar(3) + 2.5, 0.35, 96),
    n(45, bar(4), 0.5, 92),
    n(52, bar(4) + 0.5, 0.25, 86),
    n(54, bar(4) + 0.75, 0.25, 84),
    n(57, bar(4) + 1, 0.5, 88),
    n(60, bar(4) + 2.5, 0.35, 94),
    n(40, bar(5), 0.5, 94),
    n(47, bar(5) + 0.5, 0.25, 88),
    n(49, bar(5) + 0.75, 0.25, 86),
    n(52, bar(5) + 1, 0.5, 90),
    n(59, bar(5) + 2.5, 0.35, 96),
    n(45, bar(6), 0.5, 92),
    n(57, bar(6) + 1, 0.35, 94),
    n(59, bar(6) + 1.5, 0.35, 96),
    n(57, bar(6) + 2.25, 0.5, 92),
    n(59, bar(7), 0.35, 98),
    n(61, bar(7) + 0.35, 0.25, 94),
    n(59, bar(7) + 0.75, 0.25, 90),
    n(57, bar(7) + 1.25, 0.25, 88),
    n(56, bar(7) + 1.75, 0.25, 86),
    n(54, bar(7) + 2.25, 0.35, 90),
    ...strum([40, 44, 47, 52], bar(7) + 2.75, 0.5, 96),
  ],
};

/** Worried Life Blues standard 8-bar with lead. */
const BLUES_WORRIED_LIFE_8: Se2GuitarLoopPreset = {
  id: 'blues_worried_life_8',
  genre: 'blues',
  bars: 8,
  label: 'Worried life',
  hint: 'Classic 8-bar blues form — I V IV IV I V I V with singing lead',
  chordLine: 'A7 · E7 · D7 · D7 · A7 · E7 · A7 · E7',
  instrumentId: 'overdriven_guitar',
  notes: [
    ...strum([45, 49, 52, 57], bar(0), 0.45, 90),
    n(57, bar(0) + 1.5, 0.35, 92),
    n(59, bar(0) + 2.25, 0.35, 90),
    ...strum([40, 44, 47, 52], bar(1), 0.45, 92),
    n(52, bar(1) + 1.5, 0.35, 94),
    n(54, bar(1) + 2.25, 0.35, 92),
    ...strum([38, 42, 45, 50], bar(2), 0.45, 94),
    n(54, bar(2) + 1.5, 0.35, 96),
    n(57, bar(2) + 2.25, 0.35, 94),
    ...strum([38, 42, 45, 50], bar(3), 0.45, 92),
    n(57, bar(3) + 1.5, 0.35, 94),
    n(59, bar(3) + 2.25, 0.35, 92),
    ...strum([45, 49, 52, 57], bar(4), 0.45, 90),
    n(60, bar(4) + 1.5, 0.35, 94),
    n(57, bar(4) + 2.25, 0.35, 92),
    ...strum([40, 44, 47, 52], bar(5), 0.45, 92),
    n(59, bar(5) + 1.5, 0.35, 96),
    n(57, bar(5) + 2.25, 0.35, 94),
    ...strum([45, 49, 52, 57], bar(6), 0.45, 90),
    n(57, bar(6) + 1.5, 0.35, 92),
    n(59, bar(6) + 2.25, 0.35, 90),
    ...BLUES_CLAPTON_TURN_4.notes.filter((note) => note.startBeat >= bar(3)).map((note) => ({
      ...note,
      startBeat: note.startBeat - bar(3) + bar(7),
    })),
  ],
};

/** Texas shuffle 8-bar with lead fill every bar. */
const BLUES_TEXAS_LEAD_8: Se2GuitarLoopPreset = {
  id: 'blues_texas_lead_8',
  genre: 'blues',
  bars: 8,
  label: 'Texas lead',
  hint: 'Texas shuffle eight-bar — rhythm plus lead fill every measure',
  chordLine: 'A7 shuffle · D7 · A7 · E7 turnaround',
  instrumentId: 'overdriven_guitar',
  notes: [
    ...strum([45, 49, 52, 57], bar(0), 0.45, 92),
    n(57, bar(0) + 2.5, 0.35, 94),
    n(59, bar(0) + 3, 0.25, 90),
    ...strum([45, 49, 52, 57], bar(1), 0.45, 90),
    n(60, bar(1) + 2.5, 0.35, 92),
    ...strum([45, 49, 52, 57], bar(2), 0.45, 92),
    n(57, bar(2) + 2.5, 0.35, 94),
    ...strum([38, 42, 45, 50], bar(3), 0.45, 94),
    n(54, bar(3) + 2.5, 0.35, 96),
    ...strum([38, 42, 45, 50], bar(4), 0.45, 92),
    n(57, bar(4) + 2.5, 0.35, 94),
    ...strum([45, 49, 52, 57], bar(5), 0.45, 90),
    n(59, bar(5) + 2.5, 0.35, 92),
    ...strum([45, 49, 52, 57], bar(6), 0.45, 92),
    n(60, bar(6) + 2.5, 0.35, 94),
    ...strum([40, 44, 47, 52], bar(7), 0.45, 96),
    ...BLUES_BB_CALL_4.notes.filter((note) => note.startBeat >= bar(3)).map((note) => ({
      ...note,
      startBeat: note.startBeat - bar(3) + bar(7) + 0.5,
    })),
  ],
};

/** Slow blues 8-bar verse melody. */
const BLUES_SLOW_VERSE_8: Se2GuitarLoopPreset = {
  id: 'blues_slow_verse_8',
  genre: 'blues',
  bars: 8,
  label: 'Slow verse',
  hint: 'Eight-bar slow blues verse — long tones and turnaround',
  chordLine: 'A7×4 · D7×2 · A7 · E7',
  instrumentId: 'overdriven_guitar',
  notes: [
    ...BLUES_TBONE_SLOW_4.notes,
    ...BLUES_TBONE_SLOW_4.notes.slice(0, 8).map((note) => ({
      ...note,
      startBeat: note.startBeat + 16,
      pitch: note.pitch - 7,
    })),
    ...BLUES_CLAPTON_TURN_4.notes.filter((note) => note.startBeat >= bar(2)).map((note) => ({
      ...note,
      startBeat: note.startBeat - bar(2) + bar(6),
    })),
  ],
};

// ─── Funk (bonus melodic) ───────────────────────────────────────────────────

const FUNK_NEO_CHOP_4: Se2GuitarLoopPreset = {
  id: 'funk_neo_chop_4',
  genre: 'funk',
  bars: 4,
  label: 'Neo chop',
  hint: 'Neo-soul funk — muted 16ths with melodic upper voice',
  chordLine: 'Em9 · Am9 · Em9 · Am9',
  instrumentId: 'electric_guitar_muted',
  notes: [
    n(52, bar(0), 0.15, 100),
    n(52, bar(0) + 0.5, 0.15, 96),
    n(55, bar(0) + 1, 0.2, 88),
    n(57, bar(0) + 1.5, 0.2, 90),
    n(52, bar(0) + 2, 0.15, 98),
    n(52, bar(0) + 2.5, 0.15, 94),
    n(59, bar(0) + 3, 0.25, 92),
    n(57, bar(1), 0.15, 100),
    n(57, bar(1) + 0.5, 0.15, 96),
    n(60, bar(1) + 1, 0.2, 88),
    n(62, bar(1) + 1.5, 0.2, 90),
    n(57, bar(1) + 2, 0.15, 98),
    n(64, bar(1) + 3, 0.25, 94),
    n(52, bar(2), 0.15, 100),
    n(55, bar(2) + 1, 0.2, 88),
    n(57, bar(2) + 2, 0.2, 90),
    n(59, bar(2) + 3, 0.25, 92),
    n(57, bar(3), 0.15, 100),
    n(60, bar(3) + 1, 0.2, 88),
    n(62, bar(3) + 2, 0.2, 90),
    n(64, bar(3) + 3, 0.25, 96),
  ],
};

/** Fmaj7 – Dm9 – Bbmaj9 – C9 — Maxwell / Sade slow jam. */
const RNB_MAXWELL_4: Se2GuitarLoopPreset = {
  id: 'rnb_maxwell_4',
  genre: 'rnb',
  bars: 4,
  label: 'Maxwell jam',
  hint: 'Fmaj7–Dm9–Bbmaj9–C9 silky late-night comp',
  chordLine: 'Fmaj7 · Dm9 · Bbmaj9 · C9',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...barComp(0, [41, 48, 53, 57, 60, 65], [[0, 0.75, 68], [2.5, 0.45, 62]], [[1, 65, 0.4, 74]]),
    ...barComp(1, [50, 53, 57, 60, 64], [[0, 0.75, 66], [2.5, 0.45, 60]], [[1, 64, 0.4, 72]]),
    ...barComp(2, [46, 50, 53, 57, 60], [[0, 0.75, 64], [2.5, 0.45, 58]], [[1, 60, 0.4, 70]]),
    ...barComp(3, [48, 52, 55, 58, 62], [[0, 0.75, 70], [2, 0.5, 64]], [[0.5, 62, 0.35, 76], [2.5, 64, 0.4, 72]]),
  ],
};

/** Ebmaj9 – Ab13 – Dbmaj9 – G7alt — modern R&B session vamp. */
const RNB_SESSION_4: Se2GuitarLoopPreset = {
  id: 'rnb_session_4',
  genre: 'rnb',
  bars: 4,
  label: 'Session vamp',
  hint: 'Ebmaj9–Ab13–Dbmaj9–G7alt producer session cycle',
  chordLine: 'Ebmaj9 · Ab13 · Dbmaj9 · G7alt',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...barComp(0, [51, 55, 58, 62, 65], [[1, 0.4, 80], [2.5, 0.35, 74]], [[0, 65, 0.3, 72], [3, 67, 0.35, 70]]),
    ...barComp(1, [44, 48, 51, 54, 58, 62], [[1, 0.4, 82], [2.5, 0.35, 76]], [[0, 67, 0.3, 74], [3, 69, 0.35, 72]]),
    ...barComp(2, [49, 53, 56, 60, 63], [[1, 0.4, 84], [2.5, 0.35, 78]], [[0, 68, 0.3, 76], [3, 70, 0.35, 74]]),
    ...barComp(3, [43, 47, 50, 53, 57, 61], [[1, 0.4, 86], [2.5, 0.35, 80]], [[0, 71, 0.3, 78], [3, 73, 0.35, 76]]),
  ],
};

export const SE2_GUITAR_MELODIC_LOOP_PRESETS: readonly Se2GuitarLoopPreset[] = [
  RNB_FLOATING_MINOR_4,
  RNB_HATHAWAY_LIFT_4,
  RNB_GLASPER_CYCLE_4,
  RNB_GMIN_NEO_4,
  RNB_GOSPEL_EXTENDED_4,
  RNB_EMOTIONAL_4,
  RNB_CRANES_SKY_4,
  RNB_MOZEE_POCKET_4,
  RNB_CLASSIC_NEO_4,
  RNB_E9_VAMP_4,
  RNB_MAXWELL_4,
  RNB_SESSION_4,
  RNB_NEO_BALLAD_8,
  RNB_CHURCH_SOUL_8,
  RNB_SILK_ROAD_8,
  RNB_MIDNIGHT_8,
  BLUES_BB_CALL_4,
  BLUES_CLAPTON_TURN_4,
  BLUES_ROBERT_PEDAL_4,
  BLUES_CALL_RESPONSE_4,
  BLUES_HIGHWAY_WALK_4,
  BLUES_TBONE_SLOW_4,
  BLUES_KEY_HIGHWAY_8,
  BLUES_WORRIED_LIFE_8,
  BLUES_TEXAS_LEAD_8,
  BLUES_SLOW_VERSE_8,
  FUNK_NEO_CHOP_4,
];
