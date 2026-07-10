/**
 * SE2 Guitar — Pop / Top-40 / indie loop presets (4- and 8-bar).
 */
import type { Se2GuitarLoopPreset, Se2GuitarLoopNote } from '@/app/lib/studio/se2GuitarLoopPresets';

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

const POP_AXIS_4: Se2GuitarLoopPreset = {
  id: 'pop_axis_4',
  genre: 'pop',
  bars: 4,
  label: 'Axis hook',
  hint: 'I–V–vi–IV strum — every hit song progression',
  chordLine: 'C · G · Am · F',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    ...barComp(0, [48, 52, 55, 60], [[0, 0.75, 88], [2, 0.5, 82]]),
    ...barComp(1, [43, 47, 50, 55, 59], [[0, 0.75, 86], [2, 0.5, 80]]),
    ...barComp(2, [45, 52, 57, 60], [[0, 0.75, 84], [2, 0.5, 78]]),
    ...barComp(3, [41, 48, 53, 57], [[0, 0.75, 88], [2, 0.5, 82]]),
  ],
};

const POP_SENSITIVE_4: Se2GuitarLoopPreset = {
  id: 'pop_sensitive_4',
  genre: 'pop',
  bars: 4,
  label: 'Sensitive',
  hint: 'vi–IV–I–V — Adele / Beyoncé ballad strum',
  chordLine: 'Am · F · C · G',
  instrumentId: 'acoustic_guitar_nylon',
  notes: [
    ...barComp(0, [45, 52, 57, 60], [[0, 1.0, 76]], [[0.5, 69, 0.4, 80], [2, 67, 0.35, 76]]),
    ...barComp(1, [41, 48, 53, 57], [[0, 1.0, 74]], [[0.5, 65, 0.4, 78], [2, 64, 0.35, 74]]),
    ...barComp(2, [48, 52, 55, 60], [[0, 1.0, 78]], [[0.5, 72, 0.4, 82], [2, 74, 0.35, 78]]),
    ...barComp(3, [43, 47, 50, 55, 59], [[0, 0.85, 80]], [[0.5, 67, 0.4, 84], [2, 71, 0.35, 80]]),
  ],
};

const POP_EDM_PLUCK_4: Se2GuitarLoopPreset = {
  id: 'pop_edm_pluck_4',
  genre: 'pop',
  bars: 4,
  label: 'EDM pluck',
  hint: 'Syncopated clean electric — festival pop off-beats',
  chordLine: 'Am · F · C · G',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...strum([45, 52, 57, 60], bar(0) + 0.5, 0.35, 90),
    ...strum([41, 48, 53, 57], bar(1) + 0.5, 0.35, 88),
    ...strum([48, 52, 55, 60], bar(2) + 0.5, 0.35, 92),
    ...strum([43, 47, 50, 55, 59], bar(3) + 0.5, 0.35, 90),
    n(69, bar(0) + 2.5, 0.25, 78),
    n(65, bar(1) + 2.5, 0.25, 76),
    n(72, bar(2) + 2.5, 0.25, 80),
    n(71, bar(3) + 2.5, 0.25, 78),
  ],
};

const POP_INDIE_ARP_4: Se2GuitarLoopPreset = {
  id: 'pop_indie_arp_4',
  genre: 'pop',
  bars: 4,
  label: 'Indie arp',
  hint: 'Fingerpicked Em–C–G–D — Bon Iver / Ed Sheeran feel',
  chordLine: 'Em · C · G · D',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    n(52, bar(0), 0.45, 84),
    n(55, bar(0) + 0.5, 0.45, 80),
    n(59, bar(0) + 1, 0.45, 82),
    n(64, bar(0) + 1.5, 0.45, 86),
    n(48, bar(1), 0.45, 82),
    n(52, bar(1) + 0.5, 0.45, 78),
    n(55, bar(1) + 1, 0.45, 80),
    n(60, bar(1) + 1.5, 0.45, 84),
    n(43, bar(2), 0.45, 86),
    n(47, bar(2) + 0.5, 0.45, 82),
    n(50, bar(2) + 1, 0.45, 84),
    n(55, bar(2) + 1.5, 0.45, 88),
    n(50, bar(3), 0.45, 84),
    n(54, bar(3) + 0.5, 0.45, 80),
    n(57, bar(3) + 1, 0.45, 82),
    n(62, bar(3) + 1.5, 0.45, 86),
  ],
};

const POP_TOP40_4: Se2GuitarLoopPreset = {
  id: 'pop_top40_4',
  genre: 'pop',
  bars: 4,
  label: 'Top 40',
  hint: 'D–A–Bm–G radio rhythm — down on 1 and 3',
  chordLine: 'D · A · Bm · G',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...strum([50, 54, 57, 62], bar(0), 0.5, 94),
    ...strum([50, 54, 57, 62], bar(0) + 2, 0.5, 90),
    ...strum([45, 52, 57, 61], bar(1), 0.5, 92),
    ...strum([45, 52, 57, 61], bar(1) + 2, 0.5, 88),
    ...strum([47, 54, 59, 62], bar(2), 0.5, 96),
    ...strum([47, 54, 59, 62], bar(2) + 2, 0.5, 92),
    ...strum([43, 47, 50, 55, 59], bar(3), 0.5, 98),
    ...strum([43, 47, 50, 55, 59], bar(3) + 2, 0.35, 94),
  ],
};

const POP_DOOWOP_4: Se2GuitarLoopPreset = {
  id: 'pop_doowop_4',
  genre: 'pop',
  bars: 4,
  label: 'Doo-wop',
  hint: 'I–vi–ii–V — 50s / Bruno Mars throwback',
  chordLine: 'C · Am · Dm · G',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...barComp(0, [48, 52, 55, 60], [[0, 0.6, 82], [2, 0.4, 76]]),
    ...barComp(1, [45, 52, 57, 60], [[0, 0.6, 80], [2, 0.4, 74]]),
    ...barComp(2, [50, 53, 57, 62], [[0, 0.6, 84], [2, 0.4, 78]]),
    ...barComp(3, [43, 47, 50, 55, 59], [[0, 0.55, 86], [2, 0.4, 80]]),
  ],
};

const POP_ACOUSTIC_4: Se2GuitarLoopPreset = {
  id: 'pop_acoustic_4',
  genre: 'pop',
  bars: 4,
  label: 'Acoustic pop',
  hint: 'G–C–Em–D campfire strum with melody fill',
  chordLine: 'G · C · Em · D',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    ...barComp(0, [43, 47, 50, 55, 59], [[0, 0.8, 86]], [[1.5, 59, 0.35, 82], [2.75, 57, 0.3, 78]]),
    ...barComp(1, [48, 52, 55, 60], [[0, 0.8, 84]], [[1.5, 64, 0.35, 80], [2.75, 62, 0.3, 76]]),
    ...barComp(2, [40, 47, 52, 55, 59], [[0, 0.8, 82]], [[1.5, 59, 0.35, 78], [2.75, 57, 0.3, 74]]),
    ...barComp(3, [50, 54, 57, 62], [[0, 0.75, 88]], [[1.5, 66, 0.35, 84], [2.75, 64, 0.3, 80]]),
  ],
};

const POP_POWER_BALLAD_4: Se2GuitarLoopPreset = {
  id: 'pop_power_ballad_4',
  genre: 'pop',
  bars: 4,
  label: 'Power ballad',
  hint: 'F–C–Dm–Bb — big chorus energy, sustained chords',
  chordLine: 'F · C · Dm · Bb',
  instrumentId: 'distortion_guitar',
  notes: [
    ...strum([41, 48, 53, 57, 60], bar(0), 1.25, 100),
    ...strum([48, 52, 55, 60], bar(1), 1.25, 98),
    ...strum([50, 53, 57, 62], bar(2), 1.25, 96),
    ...strum([46, 50, 53, 58], bar(3), 1.0, 102),
    n(65, bar(3) + 2, 0.4, 94),
    n(67, bar(3) + 2.5, 0.35, 92),
  ],
};

const POP_RADIO_8: Se2GuitarLoopPreset = {
  id: 'pop_radio_8',
  genre: 'pop',
  bars: 8,
  label: 'Radio 8',
  hint: 'Eight-bar I–V–vi–IV ×2 with chorus lift',
  chordLine: 'C · G · Am · F ×2',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...POP_AXIS_4.notes,
    ...POP_AXIS_4.notes.map((note) => ({
      ...note,
      startBeat: note.startBeat + 16,
      velocity: Math.min(127, note.velocity + 4),
    })),
  ],
};

const POP_BALLAD_8: Se2GuitarLoopPreset = {
  id: 'pop_ballad_8',
  genre: 'pop',
  bars: 8,
  label: 'Ballad 8',
  hint: 'Slow vi–IV–I–V verse length — builds second half',
  chordLine: 'Am · F · C · G ×2',
  instrumentId: 'acoustic_guitar_nylon',
  notes: [
    ...POP_SENSITIVE_4.notes,
    ...POP_SENSITIVE_4.notes.map((note) => ({
      ...note,
      startBeat: note.startBeat + 16,
      velocity: Math.min(127, note.velocity + 6),
    })),
    n(76, bar(6) + 2.5, 0.5, 84),
    n(74, bar(7) + 2.5, 0.5, 82),
  ],
};

const POP_INDIE_8: Se2GuitarLoopPreset = {
  id: 'pop_indie_8',
  genre: 'pop',
  bars: 8,
  label: 'Indie 8',
  hint: 'Em–C–G–D doubled — folk-pop verse + chorus',
  chordLine: 'Em · C · G · D ×2',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    ...POP_INDIE_ARP_4.notes,
    ...POP_INDIE_ARP_4.notes.map((note) => ({ ...note, startBeat: note.startBeat + 16 })),
  ],
};

const POP_DANCE_8: Se2GuitarLoopPreset = {
  id: 'pop_dance_8',
  genre: 'pop',
  bars: 8,
  label: 'Dance pop',
  hint: 'Am–F–C–G with 16th off-grid — Dua Lipa pocket',
  chordLine: 'Am · F · C · G ×2',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...POP_EDM_PLUCK_4.notes,
    ...POP_EDM_PLUCK_4.notes.map((note) => ({
      ...note,
      startBeat: note.startBeat + 16,
      velocity: Math.min(127, note.velocity + 3),
    })),
    n(72, bar(4) + 3, 0.2, 86),
    n(76, bar(5) + 3, 0.2, 88),
    n(74, bar(6) + 3, 0.2, 90),
    n(79, bar(7) + 3, 0.2, 92),
  ],
};

const POP_ANTHEM_8: Se2GuitarLoopPreset = {
  id: 'pop_anthem_8',
  genre: 'pop',
  bars: 8,
  label: 'Arena pop',
  hint: 'D–A–Bm–G full section — stadium chorus strum',
  chordLine: 'D · A · Bm · G ×2',
  instrumentId: 'distortion_guitar',
  notes: [
    ...POP_TOP40_4.notes,
    ...POP_TOP40_4.notes.map((note) => ({
      ...note,
      startBeat: note.startBeat + 16,
      velocity: Math.min(127, note.velocity + 8),
    })),
  ],
};

const POP_RNB_CROSS_4: Se2GuitarLoopPreset = {
  id: 'pop_rnb_cross_4',
  genre: 'pop',
  bars: 4,
  label: 'R&B pop',
  hint: 'Cmaj9–Am9–Fmaj7–G13 — pop-R&B crossover comp',
  chordLine: 'Cmaj9 · Am9 · Fmaj7 · G13',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...barComp(0, [48, 52, 55, 59, 62], [[0, 0.55, 78], [2, 0.35, 72]], [[1, 72, 0.3, 80]]),
    ...barComp(1, [45, 52, 55, 57, 62], [[0, 0.55, 76], [2, 0.35, 70]], [[1, 69, 0.3, 78]]),
    ...barComp(2, [41, 48, 53, 57, 60], [[0, 0.55, 74], [2, 0.35, 68]], [[1, 65, 0.3, 76]]),
    ...barComp(3, [43, 47, 50, 53, 57, 61], [[0, 0.5, 80], [2, 0.35, 74]], [[1, 71, 0.3, 82]]),
  ],
};

const POP_90S_4: Se2GuitarLoopPreset = {
  id: 'pop_90s_4',
  genre: 'pop',
  bars: 4,
  label: '90s pop',
  hint: 'G–F–C–G — I–♭VII–IV power strum',
  chordLine: 'G · F · C · G',
  instrumentId: 'overdriven_guitar',
  notes: [
    ...strum([43, 47, 50, 55, 59], bar(0), 0.6, 102),
    ...strum([41, 48, 53, 57], bar(1), 0.6, 100),
    ...strum([48, 52, 55, 60], bar(2), 0.6, 104),
    ...strum([43, 47, 50, 55, 59], bar(3), 0.5, 106),
    n(59, bar(3) + 2, 0.35, 98),
    n(62, bar(3) + 2.5, 0.3, 96),
  ],
};

const POP_TIKTOK_4: Se2GuitarLoopPreset = {
  id: 'pop_tiktok_4',
  genre: 'pop',
  bars: 4,
  label: 'TikTok hook',
  hint: 'Am–F–C–G fingerpicked viral progression',
  chordLine: 'Am · F · C · G',
  instrumentId: 'acoustic_guitar_nylon',
  notes: [
    ...barComp(0, [45, 52, 57, 60], [[0, 0.45, 88], [1, 0.35, 82], [2, 0.35, 80], [3, 0.35, 78]]),
    ...barComp(1, [41, 48, 53, 57], [[0, 0.45, 86], [1, 0.35, 80], [2, 0.35, 78], [3, 0.35, 76]]),
    ...barComp(2, [48, 52, 55, 60], [[0, 0.45, 90], [1, 0.35, 84], [2, 0.35, 82], [3, 0.35, 80]]),
    ...barComp(3, [43, 47, 50, 55, 59], [[0, 0.45, 88], [1, 0.35, 82], [2, 0.35, 80], [3, 0.35, 78]]),
  ],
};

const POP_KPOP_4: Se2GuitarLoopPreset = {
  id: 'pop_kpop_4',
  genre: 'pop',
  bars: 4,
  label: 'K-pop verse',
  hint: 'Dm–Bb–F–C syncopated clean electric',
  chordLine: 'Dm · Bb · F · C',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...barComp(0, [50, 53, 57, 62], [[0.5, 0.35, 84], [1.5, 0.35, 80], [2.5, 0.35, 82], [3.25, 0.3, 78]]),
    ...barComp(1, [46, 50, 53, 58], [[0.5, 0.35, 82], [1.5, 0.35, 78], [2.5, 0.35, 80], [3.25, 0.3, 76]]),
    ...barComp(2, [41, 48, 53, 57], [[0.5, 0.35, 86], [1.5, 0.35, 82], [2.5, 0.35, 84], [3.25, 0.3, 80]]),
    ...barComp(3, [48, 52, 55, 60], [[0.5, 0.35, 88], [1.5, 0.35, 84], [2.5, 0.35, 86], [3.25, 0.3, 82]]),
  ],
};

const POP_LATIN_4: Se2GuitarLoopPreset = {
  id: 'pop_latin_4',
  genre: 'pop',
  bars: 4,
  label: 'Latin pop',
  hint: 'Am–G–F–E7 reggaeton-adjacent guitar comp',
  chordLine: 'Am · G · F · E7',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...barComp(0, [45, 52, 57, 60], [[0, 0.4, 90], [1.75, 0.35, 84], [3, 0.35, 82]]),
    ...barComp(1, [43, 47, 50, 55, 59], [[0, 0.4, 88], [1.75, 0.35, 82], [3, 0.35, 80]]),
    ...barComp(2, [41, 48, 53, 57], [[0, 0.4, 86], [1.75, 0.35, 80], [3, 0.35, 78]]),
    ...barComp(3, [40, 44, 47, 50, 54, 58], [[0, 0.4, 92], [1.75, 0.35, 86], [3, 0.35, 84]]),
  ],
};

const POP_CHILL_4: Se2GuitarLoopPreset = {
  id: 'pop_chill_4',
  genre: 'pop',
  bars: 4,
  label: 'Chill pop',
  hint: 'Cadd9–G6–Am7–Fmaj7 lo-fi bedroom texture',
  chordLine: 'Cadd9 · G6 · Am7 · Fmaj7',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    ...barComp(0, [48, 52, 55, 57, 62], [[0, 0.7, 72], [2, 0.4, 66]], [[1, 72, 0.35, 76]]),
    ...barComp(1, [43, 47, 50, 55, 59, 62], [[0, 0.7, 70], [2, 0.4, 64]], [[1, 71, 0.35, 74]]),
    ...barComp(2, [45, 52, 55, 57, 62], [[0, 0.7, 68], [2, 0.4, 62]], [[1, 69, 0.35, 72]]),
    ...barComp(3, [41, 48, 53, 57, 60, 65], [[0, 0.7, 70], [2, 0.4, 64]], [[1, 65, 0.35, 74]]),
  ],
};

const POP_STUDIO_8: Se2GuitarLoopPreset = {
  id: 'pop_studio_8',
  genre: 'pop',
  bars: 8,
  label: 'Studio session',
  hint: 'Eight-bar I–V–vi–IV doubled — radio arrangement',
  chordLine: 'C · G · Am · F ×2',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...POP_AXIS_4.notes,
    ...POP_AXIS_4.notes.map((note) => ({
      ...note,
      startBeat: note.startBeat + 16,
      velocity: Math.min(127, note.velocity + 6),
    })),
  ],
};

const POP_RNB_SLOW_8: Se2GuitarLoopPreset = {
  id: 'pop_rnb_slow_8',
  genre: 'pop',
  bars: 8,
  label: 'Slow R&B pop',
  hint: 'Dm9–G13–Cmaj9–Fmaj7 extended ballad comp',
  chordLine: 'Dm9 · G13 · Cmaj9 · Fmaj7',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...POP_RNB_CROSS_4.notes,
    ...POP_RNB_CROSS_4.notes.map((note) => ({
      ...note,
      startBeat: note.startBeat + 16,
      velocity: Math.max(50, note.velocity - 8),
    })),
  ],
};

export const SE2_GUITAR_POP_LOOP_PRESETS: readonly Se2GuitarLoopPreset[] = [
  POP_AXIS_4,
  POP_SENSITIVE_4,
  POP_EDM_PLUCK_4,
  POP_INDIE_ARP_4,
  POP_TOP40_4,
  POP_DOOWOP_4,
  POP_ACOUSTIC_4,
  POP_POWER_BALLAD_4,
  POP_TIKTOK_4,
  POP_KPOP_4,
  POP_LATIN_4,
  POP_CHILL_4,
  POP_RNB_CROSS_4,
  POP_90S_4,
  POP_RADIO_8,
  POP_BALLAD_8,
  POP_INDIE_8,
  POP_DANCE_8,
  POP_ANTHEM_8,
  POP_STUDIO_8,
  POP_RNB_SLOW_8,
];
