/**
 * SE2 Guitar — extra R&B + Pop loop presets (batch 2).
 * Distinct progressions and strum feels for the Loops rack.
 */
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

const AXIS_4_NOTES: Se2GuitarLoopNote[] = [
  ...barComp(0, [48, 52, 55, 60], [[0, 0.75, 88], [2, 0.5, 82]]),
  ...barComp(1, [43, 47, 50, 55, 59], [[0, 0.75, 86], [2, 0.5, 80]]),
  ...barComp(2, [45, 52, 57, 60], [[0, 0.75, 84], [2, 0.5, 78]]),
  ...barComp(3, [41, 48, 53, 57], [[0, 0.75, 88], [2, 0.5, 82]]),
];

// ─── Pop ────────────────────────────────────────────────────────────────────

const POP_STAND_BY_4: Se2GuitarLoopPreset = {
  id: 'pop_stand_by_4',
  genre: 'pop',
  bars: 4,
  label: 'Stand by me',
  hint: 'I–IV–vi–V — classic ballad strum on 1 and 3',
  chordLine: 'C · F · Am · G',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    ...barComp(0, [48, 52, 55, 60], [[0, 0.85, 84], [2, 0.55, 78]]),
    ...barComp(1, [41, 48, 53, 57], [[0, 0.85, 82], [2, 0.55, 76]]),
    ...barComp(2, [45, 52, 57, 60], [[0, 0.85, 80], [2, 0.55, 74]]),
    ...barComp(3, [43, 47, 50, 55, 59], [[0, 0.8, 86], [2, 0.5, 80]]),
  ],
};

const POP_ARENA_4: Se2GuitarLoopPreset = {
  id: 'pop_arena_4',
  genre: 'pop',
  bars: 4,
  label: 'Arena lift',
  hint: 'I–V–IV–V — big chorus chant energy',
  chordLine: 'C · G · F · G',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...strum([48, 52, 55, 60], bar(0), 0.55, 96),
    ...strum([48, 52, 55, 60], bar(0) + 2, 0.45, 92),
    ...strum([43, 47, 50, 55, 59], bar(1), 0.55, 98),
    ...strum([43, 47, 50, 55, 59], bar(1) + 2, 0.45, 94),
    ...strum([41, 48, 53, 57], bar(2), 0.55, 100),
    ...strum([41, 48, 53, 57], bar(2) + 2, 0.45, 96),
    ...strum([43, 47, 50, 55, 59], bar(3), 0.5, 102),
    ...strum([43, 47, 50, 53, 57, 61], bar(3) + 2, 0.4, 98),
  ],
};

const POP_LOCKED_4: Se2GuitarLoopPreset = {
  id: 'pop_locked_4',
  genre: 'pop',
  bars: 4,
  label: 'Locked hook',
  hint: 'IV–V–iii–vi — modern radio lift',
  chordLine: 'F · G · Em · Am',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...barComp(0, [41, 48, 53, 57], [[0.5, 0.4, 88], [1.5, 0.35, 84], [2.5, 0.35, 82], [3.25, 0.3, 80]]),
    ...barComp(1, [43, 47, 50, 55, 59], [[0.5, 0.4, 90], [1.5, 0.35, 86], [2.5, 0.35, 84], [3.25, 0.3, 82]]),
    ...barComp(2, [40, 47, 52, 55, 59], [[0.5, 0.4, 86], [1.5, 0.35, 82], [2.5, 0.35, 80], [3.25, 0.3, 78]]),
    ...barComp(3, [45, 52, 57, 60], [[0.5, 0.4, 88], [1.5, 0.35, 84], [2.5, 0.35, 82], [3.25, 0.3, 80]]),
  ],
};

const POP_SWIFT_MID_4: Se2GuitarLoopPreset = {
  id: 'pop_swift_mid_4',
  genre: 'pop',
  bars: 4,
  label: 'Mid-tempo pop',
  hint: 'vi–IV–I–V fingerpicked verse — singer-songwriter',
  chordLine: 'Am · F · C · G',
  instrumentId: 'acoustic_guitar_nylon',
  notes: [
    ...barComp(0, [45, 52, 57, 60], [[0, 0.5, 82], [0.75, 0.4, 78], [1.5, 0.45, 80], [2.25, 0.4, 76], [3, 0.45, 78]]),
    ...barComp(1, [41, 48, 53, 57], [[0, 0.5, 80], [0.75, 0.4, 76], [1.5, 0.45, 78], [2.25, 0.4, 74], [3, 0.45, 76]]),
    ...barComp(2, [48, 52, 55, 60], [[0, 0.5, 84], [0.75, 0.4, 80], [1.5, 0.45, 82], [2.25, 0.4, 78], [3, 0.45, 80]]),
    ...barComp(3, [43, 47, 50, 55, 59], [[0, 0.5, 86], [0.75, 0.4, 82], [1.5, 0.45, 84], [2.25, 0.4, 80], [3, 0.45, 82]]),
  ],
};

const POP_BRIDGE_4: Se2GuitarLoopPreset = {
  id: 'pop_bridge_4',
  genre: 'pop',
  bars: 4,
  label: 'Bridge climb',
  hint: 'IV–V–vi–I — pre-chorus tension release',
  chordLine: 'F · G · Am · C',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    ...barComp(0, [41, 48, 53, 57], [[0, 0.7, 86]], [[1, 65, 0.35, 80], [2.5, 67, 0.35, 82]]),
    ...barComp(1, [43, 47, 50, 55, 59], [[0, 0.7, 88]], [[1, 67, 0.35, 82], [2.5, 71, 0.35, 84]]),
    ...barComp(2, [45, 52, 57, 60], [[0, 0.75, 90]], [[1, 69, 0.35, 84], [2.5, 72, 0.35, 86]]),
    ...barComp(3, [48, 52, 55, 60], [[0, 0.8, 94]], [[0.5, 72, 0.4, 88], [2, 76, 0.4, 90], [3, 79, 0.35, 92]]),
  ],
};

const POP_REGGAETON_4: Se2GuitarLoopPreset = {
  id: 'pop_reggaeton_4',
  genre: 'pop',
  bars: 4,
  label: 'Latin pop grid',
  hint: 'Am–F–C–G dembow-skewed off-beat mutes',
  chordLine: 'Am · F · C · G',
  instrumentId: 'electric_guitar_muted',
  notes: [
    ...barComp(0, [45, 52, 57, 60], [[0.75, 0.2, 92], [1.75, 0.2, 88], [2.75, 0.2, 90], [3.5, 0.18, 86]]),
    ...barComp(1, [41, 48, 53, 57], [[0.75, 0.2, 90], [1.75, 0.2, 86], [2.75, 0.2, 88], [3.5, 0.18, 84]]),
    ...barComp(2, [48, 52, 55, 60], [[0.75, 0.2, 94], [1.75, 0.2, 90], [2.75, 0.2, 92], [3.5, 0.18, 88]]),
    ...barComp(3, [43, 47, 50, 55, 59], [[0.75, 0.2, 96], [1.75, 0.2, 92], [2.75, 0.2, 94], [3.5, 0.18, 90]]),
  ],
};

const POP_WORSHIP_4: Se2GuitarLoopPreset = {
  id: 'pop_worship_4',
  genre: 'pop',
  bars: 4,
  label: 'Worship pop',
  hint: 'G–D–Em–C — congregational crossover strum',
  chordLine: 'G · D · Em · C',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    ...barComp(0, [43, 47, 50, 55, 59], [[0, 0.9, 88], [2, 0.5, 82]]),
    ...barComp(1, [50, 54, 57, 62], [[0, 0.9, 86], [2, 0.5, 80]]),
    ...barComp(2, [40, 47, 52, 55, 59], [[0, 0.9, 84], [2, 0.5, 78]]),
    ...barComp(3, [48, 52, 55, 60], [[0, 0.85, 90], [2, 0.45, 84]]),
  ],
};

const POP_CHORUS_8: Se2GuitarLoopPreset = {
  id: 'pop_chorus_8',
  genre: 'pop',
  bars: 8,
  label: 'Double chorus',
  hint: 'I–V–vi–IV then IV–V–I–I anthem extension',
  chordLine: 'C · G · Am · F · F · G · C · C',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...AXIS_4_NOTES,
    ...barComp(4, [41, 48, 53, 57], [[0, 0.6, 94], [2, 0.45, 90]]),
    ...barComp(5, [43, 47, 50, 55, 59], [[0, 0.6, 96], [2, 0.45, 92]]),
    ...barComp(6, [48, 52, 55, 60], [[0, 0.65, 100], [2, 0.5, 96]]),
    ...barComp(7, [48, 52, 55, 60], [[0, 0.7, 102], [1.5, 0.45, 98], [2.5, 0.4, 96], [3.25, 0.35, 94]]),
  ],
};

const POP_DUET_4: Se2GuitarLoopPreset = {
  id: 'pop_duet_4',
  genre: 'pop',
  bars: 4,
  label: 'Duet verse',
  hint: 'I–iii–vi–IV — emotional pop verse motion',
  chordLine: 'C · Em · Am · F',
  instrumentId: 'acoustic_guitar_nylon',
  notes: [
    ...barComp(0, [48, 52, 55, 60], [[0, 0.75, 80]], [[2, 72, 0.4, 76]]),
    ...barComp(1, [40, 47, 52, 55, 59], [[0, 0.75, 78]], [[2, 67, 0.4, 74]]),
    ...barComp(2, [45, 52, 57, 60], [[0, 0.75, 82]], [[2, 69, 0.4, 78]]),
    ...barComp(3, [41, 48, 53, 57], [[0, 0.7, 84]], [[2, 65, 0.4, 80]]),
  ],
};

const POP_HARMONY_8: Se2GuitarLoopPreset = {
  id: 'pop_harmony_8',
  genre: 'pop',
  bars: 8,
  label: 'Harmony bed',
  hint: 'vi–IV–I–V extended with sus color — backing track',
  chordLine: 'Am · F · C · G · Am7 · Fmaj7 · Csus2 · G6',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...barComp(0, [45, 52, 57, 60], [[0, 0.6, 76], [2, 0.4, 72]]),
    ...barComp(1, [41, 48, 53, 57], [[0, 0.6, 74], [2, 0.4, 70]]),
    ...barComp(2, [48, 52, 55, 60], [[0, 0.6, 78], [2, 0.4, 74]]),
    ...barComp(3, [43, 47, 50, 55, 59], [[0, 0.55, 80], [2, 0.4, 76]]),
    ...barComp(4, [45, 52, 55, 57, 62], [[0, 0.6, 78], [2, 0.4, 74]]),
    ...barComp(5, [41, 48, 53, 57, 60, 65], [[0, 0.6, 76], [2, 0.4, 72]]),
    ...barComp(6, [48, 50, 55, 60], [[0, 0.6, 80], [2, 0.4, 76]]),
    ...barComp(7, [43, 47, 50, 55, 59, 62], [[0, 0.55, 82], [2, 0.4, 78]]),
  ],
};

// ─── R&B ────────────────────────────────────────────────────────────────────

const RNB_MARY_4: Se2GuitarLoopPreset = {
  id: 'rnb_mary_4',
  genre: 'rnb',
  bars: 4,
  label: 'Mary J pocket',
  hint: 'I–vi–IV–V maj7 comp — 90s R&B bed',
  chordLine: 'Cmaj7 · Am7 · Fmaj7 · G6',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...barComp(0, [48, 52, 55, 59, 62], [[0, 0.65, 74], [2.5, 0.4, 68]], [[1, 72, 0.35, 78]]),
    ...barComp(1, [45, 52, 55, 57, 62], [[0, 0.65, 72], [2.5, 0.4, 66]], [[1, 69, 0.35, 76]]),
    ...barComp(2, [41, 48, 53, 57, 60, 65], [[0, 0.65, 70], [2.5, 0.4, 64]], [[1, 65, 0.35, 74]]),
    ...barComp(3, [43, 47, 50, 55, 59, 62], [[0, 0.6, 76], [2, 0.45, 70]], [[0.5, 71, 0.3, 80]]),
  ],
};

const RNB_COLTRANE_4: Se2GuitarLoopPreset = {
  id: 'rnb_coltrane_4',
  genre: 'rnb',
  bars: 4,
  label: 'Coltrane changes',
  hint: 'iii–VI–ii–V — jazz-R&B turnaround',
  chordLine: 'Em7 · A7 · Dm7 · G7',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...barComp(0, [40, 47, 52, 55, 58, 62], [[0, 0.55, 78], [2, 0.35, 72]]),
    ...barComp(1, [45, 49, 52, 55, 59, 63], [[0, 0.55, 80], [2, 0.35, 74]]),
    ...barComp(2, [50, 53, 57, 60, 65], [[0, 0.55, 82], [2, 0.35, 76]]),
    ...barComp(3, [43, 47, 50, 53, 57, 61], [[0, 0.5, 84], [2, 0.35, 78]]),
  ],
};

const RNB_SADE_4: Se2GuitarLoopPreset = {
  id: 'rnb_sade_4',
  genre: 'rnb',
  bars: 4,
  label: 'Sade smooth',
  hint: 'vi–ii–V–I — late-night minor cadence',
  chordLine: 'Am7 · Dm9 · G7 · Cmaj7',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...barComp(0, [45, 52, 55, 57, 62], [[1, 0.45, 70], [2.75, 0.35, 64]], [[0, 69, 0.3, 72]]),
    ...barComp(1, [50, 53, 57, 60, 65, 69], [[1, 0.45, 68], [2.75, 0.35, 62]], [[0, 65, 0.3, 70]]),
    ...barComp(2, [43, 47, 50, 53, 57, 61], [[1, 0.45, 72], [2.75, 0.35, 66]], [[0, 71, 0.3, 74]]),
    ...barComp(3, [48, 52, 55, 59, 62], [[1, 0.5, 74], [2.5, 0.4, 68]], [[0, 72, 0.35, 76], [3, 76, 0.3, 74]]),
  ],
};

const RNB_DANGELO_4: Se2GuitarLoopPreset = {
  id: 'rnb_dangelo_4',
  genre: 'rnb',
  bars: 4,
  label: "D'Angelo pocket",
  hint: 'ii–iii–vi–V — neo-soul lazy backbeat',
  chordLine: 'Dm9 · Em7 · Am9 · Gmaj7',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...barComp(0, [50, 53, 57, 60, 65, 69], [[0.5, 0.4, 76], [2.25, 0.35, 70]]),
    ...barComp(1, [40, 47, 52, 55, 58, 62], [[0.5, 0.4, 74], [2.25, 0.35, 68]]),
    ...barComp(2, [45, 52, 55, 57, 62, 67], [[0.5, 0.4, 78], [2.25, 0.35, 72]]),
    ...barComp(3, [43, 47, 50, 54, 57, 62], [[0.5, 0.4, 80], [2.25, 0.35, 74]]),
  ],
};

const RNB_BEYONCE_4: Se2GuitarLoopPreset = {
  id: 'rnb_beyonce_4',
  genre: 'rnb',
  bars: 4,
  label: 'Ballad soul',
  hint: 'vi–IV–ii–V — emotional R&B pre-chorus',
  chordLine: 'Am7 · Fmaj7 · Dm7 · G7',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...barComp(0, [45, 52, 55, 57, 62], [[0, 0.8, 72], [2.5, 0.45, 66]], [[1.5, 69, 0.4, 76]]),
    ...barComp(1, [41, 48, 53, 57, 60, 65], [[0, 0.8, 70], [2.5, 0.45, 64]], [[1.5, 65, 0.4, 74]]),
    ...barComp(2, [50, 53, 57, 60, 65], [[0, 0.75, 74], [2.5, 0.45, 68]], [[1.5, 65, 0.4, 78]]),
    ...barComp(3, [43, 47, 50, 53, 57, 61], [[0, 0.7, 78], [2, 0.5, 72]], [[1, 71, 0.35, 80]]),
  ],
};

const RNB_USHER_4: Se2GuitarLoopPreset = {
  id: 'rnb_usher_4',
  genre: 'rnb',
  bars: 4,
  label: 'Usher pop-R&B',
  hint: 'I–V–vi–IV with maj7 extensions',
  chordLine: 'Cmaj7 · Gmaj7 · Am7 · Fmaj7',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...barComp(0, [48, 52, 55, 59, 62], [[0, 0.5, 82], [2, 0.35, 76]]),
    ...barComp(1, [43, 47, 50, 54, 57, 62], [[0, 0.5, 84], [2, 0.35, 78]]),
    ...barComp(2, [45, 52, 55, 57, 62], [[0, 0.5, 80], [2, 0.35, 74]]),
    ...barComp(3, [41, 48, 53, 57, 60, 65], [[0, 0.5, 86], [2, 0.35, 80]]),
  ],
};

const RNB_FRANK_4: Se2GuitarLoopPreset = {
  id: 'rnb_frank_4',
  genre: 'rnb',
  bars: 4,
  label: 'Sparse soul',
  hint: 'I–IV–ii–V — minimal plucks, lots of space',
  chordLine: 'Cmaj7 · Fmaj7 · Dm9 · G7',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    n(48, bar(0), 0.35, 68),
    n(55, bar(0) + 2, 0.35, 64),
    n(41, bar(1), 0.35, 66),
    n(48, bar(1) + 2, 0.35, 62),
    n(50, bar(2), 0.35, 70),
    n(57, bar(2) + 2, 0.35, 66),
    n(43, bar(3), 0.35, 72),
    n(50, bar(3) + 1.5, 0.35, 68),
    n(53, bar(3) + 2.75, 0.3, 66),
  ],
};

const RNB_GOSPEL_WALK_4: Se2GuitarLoopPreset = {
  id: 'rnb_gospel_walk_4',
  genre: 'rnb',
  bars: 4,
  label: 'Gospel walk',
  hint: 'I–IV–I–V church walk-up with passing tones',
  chordLine: 'C · F · C · G',
  instrumentId: 'acoustic_guitar_nylon',
  notes: [
    ...barComp(0, [48, 52, 55, 60], [[0, 0.7, 84], [2, 0.45, 78]], [[1, 60, 0.25, 72], [1.5, 62, 0.25, 74]]),
    ...barComp(1, [41, 48, 53, 57], [[0, 0.7, 82], [2, 0.45, 76]], [[1, 57, 0.25, 70], [1.5, 59, 0.25, 72]]),
    ...barComp(2, [48, 52, 55, 60], [[0, 0.7, 86], [2, 0.45, 80]], [[1, 62, 0.25, 74], [1.5, 64, 0.25, 76]]),
    ...barComp(3, [43, 47, 50, 55, 59], [[0, 0.65, 88], [2, 0.4, 82]], [[0.5, 59, 0.25, 76], [1, 61, 0.25, 78], [2.5, 67, 0.35, 80]]),
  ],
};

const RNB_MORNING_8: Se2GuitarLoopPreset = {
  id: 'rnb_morning_8',
  genre: 'rnb',
  bars: 8,
  label: 'Morning soul',
  hint: 'vi–IV–ii–V extended — 8-bar R&B verse cycle',
  chordLine: 'Am7 · Fmaj7 · Dm7 · G7 · Am9 · Fmaj7 · Dm9 · G7',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...RNB_BEYONCE_4.notes,
    ...barComp(4, [45, 52, 55, 57, 62, 67], [[0, 0.75, 74], [2.5, 0.45, 68]]),
    ...barComp(5, [41, 48, 53, 57, 60, 65], [[0, 0.75, 72], [2.5, 0.45, 66]]),
    ...barComp(6, [50, 53, 57, 60, 65, 69], [[0, 0.7, 76], [2.5, 0.45, 70]]),
    ...barComp(7, [43, 47, 50, 53, 57, 61], [[0, 0.65, 80], [2, 0.5, 74]]),
  ],
};

const RNB_STEVIE_8: Se2GuitarLoopPreset = {
  id: 'rnb_stevie_8',
  genre: 'rnb',
  bars: 8,
  label: 'Stevie cycle',
  hint: 'I–IV–V–IV doubled — Motown / Stevie Wonder lift',
  chordLine: 'Cmaj7 · Fmaj7 · Gmaj7 · Fmaj7',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...barComp(0, [48, 52, 55, 59, 62], [[0, 0.6, 80], [2, 0.4, 74]]),
    ...barComp(1, [41, 48, 53, 57, 60, 65], [[0, 0.6, 78], [2, 0.4, 72]]),
    ...barComp(2, [43, 47, 50, 54, 57, 62], [[0, 0.6, 82], [2, 0.4, 76]]),
    ...barComp(3, [41, 48, 53, 57, 60, 65], [[0, 0.6, 80], [2, 0.4, 74]]),
    ...barComp(4, [48, 52, 55, 59, 62], [[0, 0.55, 84], [2, 0.4, 78]]),
    ...barComp(5, [41, 48, 53, 57, 60, 65], [[0, 0.55, 82], [2, 0.4, 76]]),
    ...barComp(6, [43, 47, 50, 54, 57, 62], [[0, 0.55, 86], [2, 0.4, 80]]),
    ...barComp(7, [41, 48, 53, 57, 60, 65], [[0, 0.5, 88], [1.5, 0.4, 84], [2.5, 0.35, 82], [3.25, 0.3, 80]]),
  ],
};

export const SE2_GUITAR_RNB_POP_BATCH_PRESETS: readonly Se2GuitarLoopPreset[] = [
  POP_STAND_BY_4,
  POP_ARENA_4,
  POP_LOCKED_4,
  POP_SWIFT_MID_4,
  POP_BRIDGE_4,
  POP_REGGAETON_4,
  POP_WORSHIP_4,
  POP_DUET_4,
  POP_CHORUS_8,
  POP_HARMONY_8,
  RNB_MARY_4,
  RNB_COLTRANE_4,
  RNB_SADE_4,
  RNB_DANGELO_4,
  RNB_BEYONCE_4,
  RNB_USHER_4,
  RNB_FRANK_4,
  RNB_GOSPEL_WALK_4,
  RNB_MORNING_8,
  RNB_STEVIE_8,
];
