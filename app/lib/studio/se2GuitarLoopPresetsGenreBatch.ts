/**
 * SE2 Guitar — Country, Funk, Blues, Rock, Latin, K-pop loop expansions.
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

function n(pitch: number, startBeat: number, durationBeats: number, velocity: number): Se2GuitarLoopNote[] {
  return [{ pitch, startBeat, durationBeats, velocity }];
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
      out.push(...n(pitch, bar(barIndex) + beatInBar, dur, vel));
    }
  }
  return out;
}

function fourBarChords(
  chords: readonly (readonly number[])[],
  hits: readonly [number, number, number][] = [[0, 0.75, 86], [2, 0.5, 80]],
): Se2GuitarLoopNote[] {
  return chords.flatMap((chord, i) => barComp(i, chord, hits));
}

function funkMutes(root: number, barIndex: number, skip = [3, 7]): Se2GuitarLoopNote[] {
  const out: Se2GuitarLoopNote[] = [];
  for (let s = 0; s < 8; s += 1) {
    if (skip.includes(s)) continue;
    out.push({
      pitch: root,
      startBeat: bar(barIndex) + s * 0.5,
      durationBeats: 0.2,
      velocity: s % 2 === 0 ? 108 : 100,
    });
  }
  return out;
}

function bluesBox(
  barIndex: number,
  pitches: readonly number[],
  starts: readonly number[],
): Se2GuitarLoopNote[] {
  return starts.flatMap((beatInBar, i) =>
    n(pitches[i] ?? pitches[pitches.length - 1]!, bar(barIndex) + beatInBar, 0.35, 88 + (i % 3) * 2),
  );
}

// ─── Country (+10) ──────────────────────────────────────────────────────────

const COUNTRY_NASHVILLE_4: Se2GuitarLoopPreset = {
  id: 'country_nashville_4',
  genre: 'country',
  bars: 4,
  label: 'Nashville',
  hint: 'G–C–D–Em — Music Row verse strum',
  chordLine: 'G · C · D · Em',
  instrumentId: 'acoustic_guitar_steel',
  notes: fourBarChords([
    [43, 47, 50, 55, 59],
    [48, 52, 55, 60],
    [50, 54, 57, 62],
    [40, 47, 52, 55, 59],
  ]),
};

const COUNTRY_TELE_4: Se2GuitarLoopPreset = {
  id: 'country_tele_4',
  genre: 'country',
  bars: 4,
  label: 'Tele twang',
  hint: 'Train-beat accents — honky-tonk telecaster',
  chordLine: 'G · G · C · D',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...strum([43, 47, 50, 55], bar(0), 0.3, 94),
    ...strum([43, 47, 50, 55], bar(0) + 1.5, 0.3, 90),
    ...strum([43, 47, 50, 55], bar(1), 0.3, 92),
    ...strum([43, 47, 50, 55], bar(1) + 1.5, 0.3, 88),
    ...strum([48, 52, 55, 60], bar(2), 0.3, 96),
    ...strum([48, 52, 55, 60], bar(2) + 1.5, 0.3, 92),
    ...strum([50, 54, 57, 62], bar(3), 0.3, 98),
    ...strum([50, 54, 57, 62], bar(3) + 1.5, 0.3, 94),
  ],
};

const COUNTRY_COWBOY_4: Se2GuitarLoopPreset = {
  id: 'country_cowboy_4',
  genre: 'country',
  bars: 4,
  label: 'Cowboy chord',
  hint: 'C–F–G–G open campfire strum',
  chordLine: 'C · F · G · G',
  instrumentId: 'acoustic_guitar_steel',
  notes: fourBarChords([
    [48, 52, 55, 60],
    [41, 48, 53, 57],
    [43, 47, 50, 55, 59],
    [43, 47, 50, 55, 59],
  ], [[0, 0.85, 84], [2, 0.55, 78]]),
};

const COUNTRY_BLUEGRASS_4: Se2GuitarLoopPreset = {
  id: 'country_bluegrass_4',
  genre: 'country',
  bars: 4,
  label: 'Bluegrass roll',
  hint: 'Fast G–C–G–D crosspicking roll',
  chordLine: 'G · C · G · D',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    n(43, bar(0), 0.25, 90), n(55, bar(0) + 0.25, 0.25, 84), n(50, bar(0) + 0.5, 0.25, 82),
    n(55, bar(0) + 0.75, 0.25, 86), n(48, bar(1), 0.25, 88), n(60, bar(1) + 0.25, 0.25, 82),
    n(55, bar(1) + 0.5, 0.25, 80), n(60, bar(1) + 0.75, 0.25, 84), n(43, bar(2), 0.25, 90),
    n(55, bar(2) + 0.25, 0.25, 84), n(50, bar(2) + 0.5, 0.25, 82), n(55, bar(2) + 0.75, 0.25, 86),
    n(50, bar(3), 0.25, 88), n(62, bar(3) + 0.25, 0.25, 82), n(57, bar(3) + 0.5, 0.25, 80),
    n(62, bar(3) + 0.75, 0.25, 84),
  ].flat(),
};

const COUNTRY_DUST_4: Se2GuitarLoopPreset = {
  id: 'country_dust_4',
  genre: 'country',
  bars: 4,
  label: 'Dust road',
  hint: 'Am–F–C–G — modern country crossover',
  chordLine: 'Am · F · C · G',
  instrumentId: 'acoustic_guitar_steel',
  notes: fourBarChords([
    [45, 52, 57, 60],
    [41, 48, 53, 57],
    [48, 52, 55, 60],
    [43, 47, 50, 55, 59],
  ], [[0, 0.7, 82], [2.5, 0.45, 76]]),
};

const COUNTRY_TWO_STEP_4: Se2GuitarLoopPreset = {
  id: 'country_two_step_4',
  genre: 'country',
  bars: 4,
  label: 'Two-step',
  hint: 'G–D–G–C shuffle for the dance floor',
  chordLine: 'G · D · G · C',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    ...strum([43, 47, 50, 55], bar(0), 0.35, 90),
    ...strum([43, 47, 50, 55], bar(0) + 1.5, 0.35, 86),
    ...strum([50, 54, 57, 62], bar(1), 0.35, 88),
    ...strum([50, 54, 57, 62], bar(1) + 1.5, 0.35, 84),
    ...strum([43, 47, 50, 55], bar(2), 0.35, 92),
    ...strum([43, 47, 50, 55], bar(2) + 1.5, 0.35, 88),
    ...strum([48, 52, 55, 60], bar(3), 0.35, 94),
    ...strum([48, 52, 55, 60], bar(3) + 1.5, 0.35, 90),
  ],
};

const COUNTRY_PORCH_4: Se2GuitarLoopPreset = {
  id: 'country_porch_4',
  genre: 'country',
  bars: 4,
  label: 'Porch pick',
  hint: 'C–G–Am–F fingerpicked front-porch feel',
  chordLine: 'C · G · Am · F',
  instrumentId: 'acoustic_guitar_nylon',
  notes: [
    n(48, bar(0), 0.45, 82), n(52, bar(0) + 0.5, 0.45, 78), n(55, bar(0) + 1, 0.45, 80),
    n(60, bar(0) + 1.5, 0.45, 84), n(43, bar(1), 0.45, 84), n(47, bar(1) + 0.5, 0.45, 80),
    n(50, bar(1) + 1, 0.45, 82), n(55, bar(1) + 1.5, 0.45, 86), n(45, bar(2), 0.45, 80),
    n(52, bar(2) + 0.5, 0.45, 76), n(57, bar(2) + 1, 0.45, 78), n(60, bar(2) + 1.5, 0.45, 82),
    n(41, bar(3), 0.45, 82), n(48, bar(3) + 0.5, 0.45, 78), n(53, bar(3) + 1, 0.45, 80),
    n(57, bar(3) + 1.5, 0.45, 84),
  ].flat(),
};

const COUNTRY_OUTLAW_4: Se2GuitarLoopPreset = {
  id: 'country_outlaw_4',
  genre: 'country',
  bars: 4,
  label: 'Outlaw drive',
  hint: 'G–C–D–G overdriven highway rhythm',
  chordLine: 'G · C · D · G',
  instrumentId: 'overdriven_guitar',
  notes: fourBarChords([
    [43, 47, 50, 55],
    [48, 52, 55, 60],
    [50, 54, 57, 62],
    [43, 47, 50, 55],
  ], [[0, 0.55, 102], [2, 0.45, 96]]),
};

const COUNTRY_WALTZ_4: Se2GuitarLoopPreset = {
  id: 'country_waltz_4',
  genre: 'country',
  bars: 4,
  label: 'Waltz',
  hint: '3/4-feel G–Em–C–D country waltz',
  chordLine: 'G · Em · C · D',
  instrumentId: 'acoustic_guitar_nylon',
  notes: [
    ...strum([43, 47, 50, 55, 59], bar(0), 0.9, 80),
    ...strum([40, 47, 52, 55, 59], bar(1), 0.9, 78),
    ...strum([48, 52, 55, 60], bar(2), 0.9, 82),
    ...strum([50, 54, 57, 62], bar(3), 0.85, 84),
    n(59, bar(0) + 1.5, 0.35, 74), n(57, bar(1) + 1.5, 0.35, 72),
    n(60, bar(2) + 1.5, 0.35, 76), n(62, bar(3) + 1.5, 0.35, 78),
  ].flat(),
};

const COUNTRY_ROADTRIP_8: Se2GuitarLoopPreset = {
  id: 'country_roadtrip_8',
  genre: 'country',
  bars: 8,
  label: 'Road trip',
  hint: 'G–C–Em–D doubled — eight-bar country verse',
  chordLine: 'G · C · Em · D · G · C · Em · D',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    ...fourBarChords([
      [43, 47, 50, 55, 59],
      [48, 52, 55, 60],
      [40, 47, 52, 55, 59],
      [50, 54, 57, 62],
    ]),
    ...fourBarChords([
      [43, 47, 50, 55, 59],
      [48, 52, 55, 60],
      [40, 47, 52, 55, 59],
      [50, 54, 57, 62],
    ]).map((note) => ({ ...note, startBeat: note.startBeat + 16, velocity: note.velocity - 4 })),
  ],
};

// ─── Funk (+15) ─────────────────────────────────────────────────────────────

const FUNK_BOOTSY_4: Se2GuitarLoopPreset = {
  id: 'funk_bootsy_4',
  genre: 'funk',
  bars: 4,
  label: 'Bootsy pocket',
  hint: 'E9 vamp — rubber-band 16th mutes',
  chordLine: 'E9 · E9 · E9 · E9',
  instrumentId: 'electric_guitar_muted',
  notes: [0, 1, 2, 3].flatMap((b) => funkMutes(52, b)),
};

const FUNK_PRINCE_4: Se2GuitarLoopPreset = {
  id: 'funk_prince_4',
  genre: 'funk',
  bars: 4,
  label: 'Prince stab',
  hint: 'Am7–D7 off-beat hits — Minneapolis funk',
  chordLine: 'Am7 · D7 · G7 · C7',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...strum([45, 52, 57, 60], bar(0) + 0.5, 0.18, 114),
    ...strum([50, 54, 57, 62], bar(1) + 0.5, 0.18, 112),
    ...strum([43, 47, 50, 55], bar(2) + 0.5, 0.18, 116),
    ...strum([48, 52, 55, 58], bar(3) + 0.5, 0.18, 114),
    ...strum([45, 52, 57, 60], bar(0) + 2.5, 0.15, 108),
    ...strum([50, 54, 57, 62], bar(1) + 2.5, 0.15, 106),
    ...strum([43, 47, 50, 55], bar(2) + 2.5, 0.15, 110),
    ...strum([48, 52, 55, 58], bar(3) + 2.5, 0.15, 108),
  ],
};

const FUNK_CHIC_4: Se2GuitarLoopPreset = {
  id: 'funk_chic_4',
  genre: 'funk',
  bars: 4,
  label: 'Chic chop',
  hint: 'Dm7–G7 disco-funk chop on the and',
  chordLine: 'Dm7 · G7 · Cmaj7 · A7',
  instrumentId: 'electric_guitar_muted',
  notes: [0, 1, 2, 3].flatMap((b) => {
    const roots = [50, 43, 48, 45];
    return [0.5, 1.5, 2.5, 3.5].map((beat, i) => ({
      pitch: roots[b]!,
      startBeat: bar(b) + beat,
      durationBeats: 0.18,
      velocity: 104 + (i % 2) * 4,
    }));
  }),
};

const FUNK_PARLIAMENT_4: Se2GuitarLoopPreset = {
  id: 'funk_parliament_4',
  genre: 'funk',
  bars: 4,
  label: 'P-Funk',
  hint: 'E7–A7–B7 greasy muted groove',
  chordLine: 'E7 · A7 · B7 · E7',
  instrumentId: 'electric_guitar_muted',
  notes: [
    ...funkMutes(52, 0), ...funkMutes(45, 1), ...funkMutes(47, 2), ...funkMutes(52, 3),
  ],
};

const FUNK_NILE_4: Se2GuitarLoopPreset = {
  id: 'funk_nile_4',
  genre: 'funk',
  bars: 4,
  label: 'Nile rhythm',
  hint: 'Am9–D9 tight Nile Rodgers-style comp',
  chordLine: 'Am9 · D9 · G6 · Cadd9',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...barComp(0, [45, 52, 55, 57, 62], [[0, 0.25, 110], [1, 0.25, 104], [2, 0.25, 108], [3, 0.25, 106]]),
    ...barComp(1, [50, 54, 57, 60, 64], [[0, 0.25, 108], [1, 0.25, 102], [2, 0.25, 106], [3, 0.25, 104]]),
    ...barComp(2, [43, 47, 50, 55, 59, 62], [[0, 0.25, 112], [1, 0.25, 106], [2, 0.25, 110], [3, 0.25, 108]]),
    ...barComp(3, [48, 52, 55, 57, 62], [[0, 0.25, 110], [1, 0.25, 104], [2, 0.25, 108], [3, 0.25, 106]]),
  ],
};

const FUNK_JAMES_4: Se2GuitarLoopPreset = {
  id: 'funk_james_4',
  genre: 'funk',
  bars: 4,
  label: 'JB chop',
  hint: 'E9 one-chord James Brown chop',
  chordLine: 'E9 · E9 · E9 · E9',
  instrumentId: 'electric_guitar_muted',
  notes: [0, 1, 2, 3].flatMap((b) =>
    [0, 1, 2, 2.5, 3].map((beat, i) => ({
      pitch: 52,
      startBeat: bar(b) + beat,
      durationBeats: 0.15,
      velocity: i === 0 ? 112 : 100,
    })),
  ),
};

const FUNK_METER_4: Se2GuitarLoopPreset = {
  id: 'funk_meter_4',
  genre: 'funk',
  bars: 4,
  label: 'Meters groove',
  hint: 'C7–F7–G7 New Orleans second-line funk',
  chordLine: 'C7 · F7 · G7 · C7',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...barComp(0, [48, 52, 55, 58], [[0.5, 0.3, 108], [1.5, 0.3, 102], [2.5, 0.3, 106], [3.5, 0.25, 104]]),
    ...barComp(1, [41, 48, 53, 57], [[0.5, 0.3, 106], [1.5, 0.3, 100], [2.5, 0.3, 104], [3.5, 0.25, 102]]),
    ...barComp(2, [43, 47, 50, 55], [[0.5, 0.3, 110], [1.5, 0.3, 104], [2.5, 0.3, 108], [3.5, 0.25, 106]]),
    ...barComp(3, [48, 52, 55, 58], [[0.5, 0.3, 112], [1.5, 0.3, 106], [2.5, 0.3, 110], [3.5, 0.25, 108]]),
  ],
};

const FUNK_VULF_4: Se2GuitarLoopPreset = {
  id: 'funk_vulf_4',
  genre: 'funk',
  bars: 4,
  label: 'Vulf comp',
  hint: 'Am7–Dmaj7 dry minimalist funk comp',
  chordLine: 'Am7 · Dmaj7 · Gmaj7 · Cmaj7',
  instrumentId: 'electric_guitar_clean',
  notes: fourBarChords(
    [
      [45, 52, 55, 57, 62],
      [50, 54, 57, 61, 66],
      [43, 47, 50, 54, 57, 62],
      [48, 52, 55, 59, 62],
    ],
    [[0, 0.35, 96], [2, 0.3, 90]],
  ),
};

const FUNK_BRIDGEFUNK_4: Se2GuitarLoopPreset = {
  id: 'funk_bridgefunk_4',
  genre: 'funk',
  bars: 4,
  label: 'Bridge funk',
  hint: 'Dm9–G13–Cmaj9–F13 jazz-funk bridge',
  chordLine: 'Dm9 · G13 · Cmaj9 · F13',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...barComp(0, [50, 53, 57, 60, 65], [[1, 0.35, 100], [2.5, 0.3, 94]]),
    ...barComp(1, [43, 47, 50, 53, 57, 61], [[1, 0.35, 102], [2.5, 0.3, 96]]),
    ...barComp(2, [48, 52, 55, 59, 62], [[1, 0.35, 104], [2.5, 0.3, 98]]),
    ...barComp(3, [41, 48, 53, 57, 60], [[1, 0.35, 106], [2.5, 0.3, 100]]),
  ],
};

const FUNK_WAH_4: Se2GuitarLoopPreset = {
  id: 'funk_wah_4',
  genre: 'funk',
  bars: 4,
  label: 'Wah vamp',
  hint: 'Em7–A7 wah-style rhythmic accents',
  chordLine: 'Em7 · A7 · D7 · G7',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...barComp(0, [40, 47, 52, 55, 58], [[0, 0.2, 110], [0.75, 0.2, 104], [1.5, 0.2, 108], [2.25, 0.2, 106]]),
    ...barComp(1, [45, 49, 52, 55, 59], [[0, 0.2, 112], [0.75, 0.2, 106], [1.5, 0.2, 110], [2.25, 0.2, 108]]),
    ...barComp(2, [50, 54, 57, 62], [[0, 0.2, 114], [0.75, 0.2, 108], [1.5, 0.2, 112], [2.25, 0.2, 110]]),
    ...barComp(3, [43, 47, 50, 55], [[0, 0.2, 116], [0.75, 0.2, 110], [1.5, 0.2, 114], [2.25, 0.2, 112]]),
  ],
};

const FUNK_GOGO_4: Se2GuitarLoopPreset = {
  id: 'funk_gogo_4',
  genre: 'funk',
  bars: 4,
  label: 'Go-go pocket',
  hint: 'A7–D7–A7–E7 DC go-go percussion guitar',
  chordLine: 'A7 · D7 · A7 · E7',
  instrumentId: 'electric_guitar_muted',
  notes: [0, 1, 2, 3].flatMap((b) => {
    const roots = [45, 50, 45, 40];
    return funkMutes(roots[b]!, b, [2, 6]);
  }),
};

const FUNK_COLD_4: Se2GuitarLoopPreset = {
  id: 'funk_cold_4',
  genre: 'funk',
  bars: 4,
  label: 'Cold chord',
  hint: 'Bm7–E9–Amaj7–D9 modern funk-pop pocket',
  chordLine: 'Bm7 · E9 · Amaj7 · D9',
  instrumentId: 'electric_guitar_clean',
  notes: fourBarChords(
    [
      [47, 54, 57, 59, 64],
      [40, 44, 47, 50, 54, 58],
      [45, 52, 57, 61, 64],
      [50, 54, 57, 60, 64, 68],
    ],
    [[0.5, 0.3, 100], [1.5, 0.25, 94], [2.5, 0.3, 98], [3.25, 0.25, 96]],
  ),
};

const FUNK_HORN_4: Se2GuitarLoopPreset = {
  id: 'funk_horn_4',
  genre: 'funk',
  bars: 4,
  label: 'Horn chart',
  hint: 'F7–Bb7–C7 hits synced to horn stabs',
  chordLine: 'F7 · Bb7 · C7 · F7',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...strum([41, 48, 53, 57], bar(0), 0.25, 114),
    ...strum([41, 48, 53, 57], bar(0) + 2, 0.25, 110),
    ...strum([46, 50, 53, 58], bar(1), 0.25, 112),
    ...strum([46, 50, 53, 58], bar(1) + 2, 0.25, 108),
    ...strum([48, 52, 55, 58], bar(2), 0.25, 116),
    ...strum([48, 52, 55, 58], bar(2) + 2, 0.25, 112),
    ...strum([41, 48, 53, 57], bar(3), 0.25, 118),
    ...strum([41, 48, 53, 57], bar(3) + 2, 0.25, 114),
  ],
};

const FUNK_SLAP_BASS_4: Se2GuitarLoopPreset = {
  id: 'funk_slap_bass_4',
  genre: 'funk',
  bars: 4,
  label: 'Slap sync',
  hint: 'G7–C7–F7–Bb7 locked with slap bass pocket',
  chordLine: 'G7 · C7 · F7 · Bb7',
  instrumentId: 'electric_guitar_muted',
  notes: [0, 1, 2, 3].flatMap((b) => {
    const roots = [43, 48, 41, 46];
    return [0, 0.75, 1.5, 2.25, 3].map((beat) => ({
      pitch: roots[b]!,
      startBeat: bar(b) + beat,
      durationBeats: 0.15,
      velocity: beat === 0 ? 112 : 100,
    }));
  }),
};

const FUNK_TOWER_16_8: Se2GuitarLoopPreset = {
  id: 'funk_tower_16_8',
  genre: 'funk',
  bars: 8,
  label: 'Tower 16ths',
  hint: 'Eight-bar E9–A9 tower of power 16th grid',
  chordLine: 'E9 · A9 · E9 · B9 · E9 · A9 · E9 · B9',
  instrumentId: 'electric_guitar_muted',
  notes: [0, 1, 0, 1, 0, 1, 0, 1].flatMap((alt, b) => funkMutes(alt === 0 ? 52 : b % 2 === 1 ? 45 : 47, b)),
};

const FUNK_NEOSOUL_4: Se2GuitarLoopPreset = {
  id: 'funk_neosoul_4',
  genre: 'funk',
  bars: 4,
  label: 'Neo-funk',
  hint: 'Am9–D9–Gmaj7–C6 Dilla-grid funk',
  chordLine: 'Am9 · D9 · Gmaj7 · C6',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...barComp(0, [45, 52, 55, 57, 62, 67], [[0.5, 0.3, 96], [1.25, 0.25, 90], [2, 0.3, 94], [3, 0.25, 92]]),
    ...barComp(1, [50, 54, 57, 60, 64, 68], [[0.5, 0.3, 98], [1.25, 0.25, 92], [2, 0.3, 96], [3, 0.25, 94]]),
    ...barComp(2, [43, 47, 50, 54, 57, 62], [[0.5, 0.3, 100], [1.25, 0.25, 94], [2, 0.3, 98], [3, 0.25, 96]]),
    ...barComp(3, [48, 52, 55, 60, 64], [[0.5, 0.3, 102], [1.25, 0.25, 96], [2, 0.3, 100], [3, 0.25, 98]]),
  ],
};

// ─── Blues (+19) ────────────────────────────────────────────────────────────

const BLUES_TEXAS_4: Se2GuitarLoopPreset = {
  id: 'blues_texas_4',
  genre: 'blues',
  bars: 4,
  label: 'Texas shuffle',
  hint: 'A7 shuffle — SRV-style swing',
  chordLine: 'A7 · A7 · D7 · E7',
  instrumentId: 'overdriven_guitar',
  notes: [
    ...bluesBox(0, [57, 59, 57, 54], [0, 0.75, 1.5, 2.25]),
    ...bluesBox(1, [59, 60, 57, 59], [0, 0.75, 1.5, 2.25]),
    ...bluesBox(2, [50, 52, 54, 57], [0, 0.75, 1.5, 2.25]),
    ...bluesBox(3, [59, 61, 59, 57], [0, 0.5, 1, 1.5, 2, 2.5, 3]),
  ].flat(),
};

const BLUES_CHICAGO_4: Se2GuitarLoopPreset = {
  id: 'blues_chicago_4',
  genre: 'blues',
  bars: 4,
  label: 'Chicago 12',
  hint: 'A7–D7–A7–E7 urban electric blues',
  chordLine: 'A7 · D7 · A7 · E7',
  instrumentId: 'overdriven_guitar',
  notes: [
    ...strum([45, 49, 52, 55, 59], bar(0), 0.5, 96),
    ...strum([45, 49, 52, 55, 59], bar(1), 0.5, 94),
    ...strum([50, 54, 57, 62], bar(2), 0.5, 98),
    ...strum([40, 44, 47, 52], bar(3), 0.45, 100),
    n(57, bar(0) + 2, 0.35, 90), n(59, bar(1) + 2, 0.35, 92),
    n(54, bar(2) + 2, 0.35, 94), n(56, bar(3) + 2, 0.35, 96),
  ].flat(),
};

const BLUES_MINOR_4: Se2GuitarLoopPreset = {
  id: 'blues_minor_4',
  genre: 'blues',
  bars: 4,
  label: 'Minor blues',
  hint: 'Am7–Dm7–Am7–E7 minor blues form',
  chordLine: 'Am7 · Dm7 · Am7 · E7',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...barComp(0, [45, 52, 55, 57, 62], [[0, 0.75, 82], [2.5, 0.4, 76]], [[1, 69, 0.35, 78]]),
    ...barComp(1, [50, 53, 57, 60, 65], [[0, 0.75, 80], [2.5, 0.4, 74]], [[1, 65, 0.35, 76]]),
    ...barComp(2, [45, 52, 55, 57, 62], [[0, 0.75, 84], [2.5, 0.4, 78]], [[1, 72, 0.35, 80]]),
    ...barComp(3, [40, 44, 47, 50, 54, 58], [[0, 0.7, 86], [2, 0.45, 80]], [[1, 71, 0.35, 82]]),
  ],
};

const BLUES_SLOW_12_8: Se2GuitarLoopPreset = {
  id: 'blues_slow_12_8',
  genre: 'blues',
  bars: 8,
  label: 'Slow 12-bar',
  hint: 'Classic 12-bar blues in A — slow burn',
  chordLine: 'A7 · A7 · D7 · A7 · E7 · D7 · A7 · E7',
  instrumentId: 'overdriven_guitar',
  notes: [
    ...strum([45, 49, 52, 55, 59], bar(0), 1.5, 88),
    ...strum([45, 49, 52, 55, 59], bar(1), 1.5, 86),
    ...strum([50, 54, 57, 62], bar(2), 1.25, 90),
    ...strum([45, 49, 52, 55, 59], bar(3), 1.5, 88),
    ...strum([40, 44, 47, 52], bar(4), 1.0, 92),
    ...strum([50, 54, 57, 62], bar(5), 1.25, 88),
    ...strum([45, 49, 52, 55, 59], bar(6), 1.5, 90),
    ...strum([40, 44, 47, 52], bar(7), 0.75, 94),
    n(57, bar(3) + 2, 0.4, 84), n(59, bar(6) + 2, 0.4, 86),
  ].flat(),
};

const BLUES_DELTA_4: Se2GuitarLoopPreset = {
  id: 'blues_delta_4',
  genre: 'blues',
  bars: 4,
  label: 'Delta slide',
  hint: 'E–A–B acoustic delta bottleneck feel',
  chordLine: 'E · A · E · B7',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    n(52, bar(0), 0.5, 86), n(56, bar(0) + 1, 0.35, 82), n(59, bar(0) + 2, 0.4, 84),
    n(57, bar(1), 0.5, 84), n(60, bar(1) + 1, 0.35, 80), n(62, bar(1) + 2, 0.4, 82),
    n(52, bar(2), 0.5, 88), n(56, bar(2) + 1, 0.35, 84), n(59, bar(2) + 2, 0.4, 86),
    n(47, bar(3), 0.5, 90), n(51, bar(3) + 1, 0.35, 86), n(54, bar(3) + 2, 0.4, 88),
  ].flat(),
};

const BLUES_MUDDY_4: Se2GuitarLoopPreset = {
  id: 'blues_muddy_4',
  genre: 'blues',
  bars: 4,
  label: 'Muddy riff',
  hint: 'E7 power riff — Chicago electric blues',
  chordLine: 'E7 · E7 · A7 · B7',
  instrumentId: 'overdriven_guitar',
  notes: [
    n(52, bar(0), 0.25, 100), n(52, bar(0) + 0.5, 0.25, 96), n(55, bar(0) + 1, 0.25, 94),
    n(52, bar(0) + 1.5, 0.25, 98), n(52, bar(1), 0.25, 102), n(55, bar(1) + 1, 0.25, 96),
    n(57, bar(2), 0.35, 104), n(54, bar(2) + 1, 0.35, 100), n(57, bar(2) + 2, 0.35, 102),
    n(47, bar(3), 0.35, 106), n(51, bar(3) + 1, 0.35, 102), n(54, bar(3) + 2, 0.35, 104),
  ].flat(),
};

const BLUES_BUDDY_4: Se2GuitarLoopPreset = {
  id: 'blues_buddy_4',
  genre: 'blues',
  bars: 4,
  label: 'Buddy lick',
  hint: 'A7 box lick — Buddy Guy intensity',
  chordLine: 'A7 · A7 · D7 · E7',
  instrumentId: 'overdriven_guitar',
  notes: [
    ...bluesBox(0, [57, 59, 60, 59], [0, 0.75, 1.5, 2.25]),
    ...bluesBox(1, [59, 57, 59, 60], [0, 0.75, 1.5, 2.25]),
    ...bluesBox(2, [50, 52, 54, 57], [0, 0.75, 1.5, 2.25]),
    ...bluesBox(3, [59, 61, 59, 57, 56, 54], [0, 0.5, 1, 1.5, 2, 2.5]),
  ],
};

const BLUES_FROSTY_4: Se2GuitarLoopPreset = {
  id: 'blues_frosty_4',
  genre: 'blues',
  bars: 4,
  label: 'Frosty turn',
  hint: 'Quick IV–I turnaround in A',
  chordLine: 'A7 · D7 · A7 · E7',
  instrumentId: 'overdriven_guitar',
  notes: [
    n(57, bar(0), 0.5, 92), n(59, bar(0) + 1, 0.25, 88), n(57, bar(0) + 2, 0.5, 90),
    n(50, bar(1), 0.5, 90), n(52, bar(1) + 1, 0.25, 86), n(54, bar(1) + 2, 0.5, 88),
    n(57, bar(2), 0.75, 94), n(60, bar(2) + 1.5, 0.35, 90),
    n(59, bar(3), 0.35, 96), n(61, bar(3) + 0.5, 0.25, 94), n(59, bar(3) + 1, 0.25, 90),
    n(57, bar(3) + 1.5, 0.25, 88), n(56, bar(3) + 2, 0.35, 92),
  ].flat(),
};

const BLUES_ACOUSTIC_4: Se2GuitarLoopPreset = {
  id: 'blues_acoustic_4',
  genre: 'blues',
  bars: 4,
  label: 'Acoustic blues',
  hint: 'E–A–B fingerpicked country blues',
  chordLine: 'E · A · E · B7',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    n(40, bar(0), 0.45, 84), n(47, bar(0) + 0.5, 0.45, 80), n(52, bar(0) + 1, 0.45, 82),
    n(56, bar(0) + 1.5, 0.45, 86), n(45, bar(1), 0.45, 82), n(52, bar(1) + 0.5, 0.45, 78),
    n(57, bar(1) + 1, 0.45, 80), n(60, bar(1) + 1.5, 0.45, 84), n(40, bar(2), 0.45, 86),
    n(47, bar(2) + 0.5, 0.45, 82), n(52, bar(2) + 1, 0.45, 84), n(56, bar(2) + 1.5, 0.45, 88),
    n(47, bar(3), 0.45, 88), n(51, bar(3) + 0.5, 0.45, 84), n(54, bar(3) + 1, 0.45, 86),
    n(57, bar(3) + 1.5, 0.45, 90),
  ].flat(),
};

const BLUES_PIANO_4: Se2GuitarLoopPreset = {
  id: 'blues_piano_4',
  genre: 'blues',
  bars: 4,
  label: 'Piano blues',
  hint: 'C7–F7–C7–G7 boogie-woogie guitar comp',
  chordLine: 'C7 · F7 · C7 · G7',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...barComp(0, [48, 52, 55, 58], [[0, 0.35, 94], [1, 0.35, 88], [2, 0.35, 92], [3, 0.35, 90]]),
    ...barComp(1, [41, 48, 53, 57], [[0, 0.35, 92], [1, 0.35, 86], [2, 0.35, 90], [3, 0.35, 88]]),
    ...barComp(2, [48, 52, 55, 58], [[0, 0.35, 96], [1, 0.35, 90], [2, 0.35, 94], [3, 0.35, 92]]),
    ...barComp(3, [43, 47, 50, 55], [[0, 0.35, 98], [1, 0.35, 92], [2, 0.35, 96], [3, 0.35, 94]]),
  ],
};

const BLUES_WOMAN_4: Se2GuitarLoopPreset = {
  id: 'blues_woman_4',
  genre: 'blues',
  bars: 4,
  label: 'Stormy lick',
  hint: 'G7–C7–G7–D7 slow blues bend phrase',
  chordLine: 'G7 · C7 · G7 · D7',
  instrumentId: 'overdriven_guitar',
  notes: [
    n(55, bar(0), 0.75, 90), n(58, bar(0) + 1, 0.35, 86), n(55, bar(0) + 2, 0.5, 88),
    n(48, bar(1), 0.75, 88), n(52, bar(1) + 1, 0.35, 84), n(55, bar(1) + 2, 0.5, 86),
    n(55, bar(2), 0.75, 92), n(59, bar(2) + 1.5, 0.4, 88),
    n(50, bar(3), 0.5, 94), n(54, bar(3) + 1, 0.35, 90), n(57, bar(3) + 2, 0.4, 92),
  ].flat(),
};

const BLUES_JUKE_4: Se2GuitarLoopPreset = {
  id: 'blues_juke_4',
  genre: 'blues',
  bars: 4,
  label: 'Juke joint',
  hint: 'E7 shuffle riff — juke joint dance',
  chordLine: 'E7 · E7 · A7 · B7',
  instrumentId: 'overdriven_guitar',
  notes: [
    n(52, bar(0), 0.2, 98), n(52, bar(0) + 0.5, 0.2, 94), n(55, bar(0) + 1, 0.2, 96),
    n(52, bar(0) + 1.5, 0.2, 100), n(52, bar(1), 0.2, 102), n(55, bar(1) + 1, 0.2, 98),
    n(57, bar(2), 0.3, 104), n(54, bar(2) + 1.5, 0.3, 100),
    n(47, bar(3), 0.3, 106), n(51, bar(3) + 1.5, 0.3, 102),
  ].flat(),
};

const BLUES_KING_4: Se2GuitarLoopPreset = {
  id: 'blues_king_4',
  genre: 'blues',
  bars: 4,
  label: 'Three Kings',
  hint: 'B.B. / Freddie / Albert box blend in B',
  chordLine: 'B7 · B7 · E7 · F#7',
  instrumentId: 'overdriven_guitar',
  notes: [
    ...bluesBox(0, [59, 61, 59, 57], [0, 1, 2, 3]),
    ...bluesBox(1, [61, 62, 59, 61], [0, 1, 2, 3]),
    ...bluesBox(2, [52, 54, 56, 59], [0, 1, 2, 3]),
    ...bluesBox(3, [61, 63, 61, 59], [0, 0.75, 1.5, 2.25, 3]),
  ].flat(),
};

const BLUES_MEMPHIS_4: Se2GuitarLoopPreset = {
  id: 'blues_memphis_4',
  genre: 'blues',
  bars: 4,
  label: 'Memphis soul',
  hint: 'A7–D7 with soul major-6 color',
  chordLine: 'A7 · A7 · D7 · E7',
  instrumentId: 'electric_guitar_jazz',
  notes: fourBarChords(
    [
      [45, 49, 52, 55, 59],
      [45, 49, 52, 55, 59],
      [50, 54, 57, 62],
      [40, 44, 47, 52],
    ],
    [[0, 0.6, 84], [2, 0.4, 78]],
  ),
};

const BLUES_HENDRIX_4: Se2GuitarLoopPreset = {
  id: 'blues_hendrix_4',
  genre: 'blues',
  bars: 4,
  label: 'Hendrix cry',
  hint: 'E7–A7 Hendrix-style chord embellishments',
  chordLine: 'E7 · E7 · A7 · B7',
  instrumentId: 'overdriven_guitar',
  notes: [
    ...strum([40, 44, 47, 52], bar(0), 0.4, 100),
    n(56, bar(0) + 1, 0.35, 92), n(59, bar(0) + 2, 0.35, 94),
    ...strum([40, 44, 47, 52], bar(1), 0.4, 102),
    n(57, bar(1) + 2.5, 0.35, 96),
    ...strum([45, 49, 52, 57], bar(2), 0.4, 104),
    n(60, bar(2) + 2, 0.35, 98),
    ...strum([47, 51, 54, 59], bar(3), 0.35, 106),
    n(62, bar(3) + 1.5, 0.35, 100), n(59, bar(3) + 2.5, 0.35, 98),
  ].flat(),
};

const BLUES_WALK_4: Se2GuitarLoopPreset = {
  id: 'blues_walk_4',
  genre: 'blues',
  bars: 4,
  label: 'Walking bass',
  hint: 'A7 walking bass line on low strings',
  chordLine: 'A7 · D7 · A7 · E7',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    n(45, bar(0), 0.5, 80), n(47, bar(0) + 0.5, 0.5, 78), n(49, bar(0) + 1, 0.5, 76),
    n(50, bar(0) + 1.5, 0.5, 78), n(52, bar(0) + 2, 0.5, 80), n(54, bar(0) + 2.5, 0.5, 82),
    n(50, bar(1), 0.5, 82), n(52, bar(1) + 0.5, 0.5, 80), n(54, bar(1) + 1, 0.5, 78),
    n(55, bar(1) + 1.5, 0.5, 80), n(57, bar(1) + 2, 0.5, 82), n(59, bar(1) + 2.5, 0.5, 84),
    n(45, bar(2), 0.5, 84), n(47, bar(2) + 1, 0.5, 82), n(49, bar(2) + 2, 0.5, 80),
    n(52, bar(2) + 3, 0.5, 82), n(40, bar(3), 0.5, 86), n(44, bar(3) + 1, 0.5, 84),
    n(47, bar(3) + 2, 0.5, 82), n(52, bar(3) + 3, 0.5, 88),
  ].flat(),
};

const BLUES_RAG_4: Se2GuitarLoopPreset = {
  id: 'blues_rag_4',
  genre: 'blues',
  bars: 4,
  label: 'Ragtime blues',
  hint: 'C–F–C–G ragtime alternating bass',
  chordLine: 'C · F · C · G',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    n(48, bar(0), 0.35, 86), n(52, bar(0) + 0.5, 0.35, 82), n(55, bar(0) + 1, 0.35, 84),
    n(60, bar(0) + 1.5, 0.35, 88), n(41, bar(1), 0.35, 84), n(48, bar(1) + 0.5, 0.35, 80),
    n(53, bar(1) + 1, 0.35, 82), n(57, bar(1) + 1.5, 0.35, 86), n(48, bar(2), 0.35, 88),
    n(52, bar(2) + 0.5, 0.35, 84), n(55, bar(2) + 1, 0.35, 86), n(60, bar(2) + 1.5, 0.35, 90),
    n(43, bar(3), 0.35, 90), n(47, bar(3) + 0.5, 0.35, 86), n(50, bar(3) + 1, 0.35, 88),
    n(55, bar(3) + 1.5, 0.35, 92),
  ].flat(),
};

const BLUES_LONELY_8: Se2GuitarLoopPreset = {
  id: 'blues_lonely_8',
  genre: 'blues',
  bars: 8,
  label: 'Lonely 8',
  hint: 'Eight-bar slow blues in G — ballad feel',
  chordLine: 'G7 · C7 · G7 · D7 · G7 · C7 · G7 · D7',
  instrumentId: 'overdriven_guitar',
  notes: [
    ...strum([43, 47, 50, 55], bar(0), 1.25, 84),
    ...strum([48, 52, 55, 60], bar(2), 1.0, 82),
    ...strum([43, 47, 50, 55], bar(4), 1.25, 86),
    ...strum([50, 54, 57, 62], bar(6), 0.75, 88),
    n(55, bar(1) + 2, 0.4, 78), n(59, bar(3) + 2, 0.4, 80),
    n(55, bar(5) + 2, 0.4, 80), n(57, bar(7) + 2, 0.4, 82),
  ].flat(),
};

const BLUES_ROADHOUSE_4: Se2GuitarLoopPreset = {
  id: 'blues_roadhouse_4',
  genre: 'blues',
  bars: 4,
  label: 'Roadhouse',
  hint: 'A7–E7–D7–A7 bar-band blues',
  chordLine: 'A7 · E7 · D7 · A7',
  instrumentId: 'overdriven_guitar',
  notes: fourBarChords(
    [
      [45, 49, 52, 55, 59],
      [40, 44, 47, 52],
      [50, 54, 57, 62],
      [45, 49, 52, 55, 59],
    ],
    [[0, 0.5, 96], [2, 0.4, 90]],
  ),
};

// ─── Rock (+7) ──────────────────────────────────────────────────────────────

const ROCK_GRUNGE_4: Se2GuitarLoopPreset = {
  id: 'rock_grunge_4',
  genre: 'rock',
  bars: 4,
  label: 'Grunge drop',
  hint: 'F5–Bbm–Ab–Db power-chord drop D feel',
  chordLine: 'F · Bm · Ab · Db',
  instrumentId: 'distortion_guitar',
  notes: fourBarChords(
    [
      [41, 48, 53, 57],
      [47, 54, 59, 62],
      [44, 51, 56, 59],
      [49, 56, 61, 64],
    ],
    [[0, 0.6, 110], [2, 0.45, 104]],
  ),
};

const ROCK_INDIE_4: Se2GuitarLoopPreset = {
  id: 'rock_indie_4',
  genre: 'rock',
  bars: 4,
  label: 'Indie rock',
  hint: 'Em–C–G–D arpeggiated clean-to-drive',
  chordLine: 'Em · C · G · D',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...barComp(0, [40, 47, 52, 55, 59], [[0, 0.5, 92], [2, 0.4, 86]]),
    ...barComp(1, [48, 52, 55, 60], [[0, 0.5, 90], [2, 0.4, 84]]),
    ...barComp(2, [43, 47, 50, 55, 59], [[0, 0.5, 94], [2, 0.4, 88]]),
    ...barComp(3, [50, 54, 57, 62], [[0, 0.5, 96], [2, 0.4, 90]]),
  ],
};

const ROCK_CLASSIC_4: Se2GuitarLoopPreset = {
  id: 'rock_classic_4',
  genre: 'rock',
  bars: 4,
  label: 'Classic rock',
  hint: 'A–D–A–E open-chord rock rhythm',
  chordLine: 'A · D · A · E',
  instrumentId: 'overdriven_guitar',
  notes: fourBarChords(
    [
      [45, 52, 57, 61],
      [50, 54, 57, 62],
      [45, 52, 57, 61],
      [40, 47, 52, 56, 59],
    ],
    [[0, 0.55, 104], [2, 0.45, 98]],
  ),
};

const ROCK_METAL_4: Se2GuitarLoopPreset = {
  id: 'rock_metal_4',
  genre: 'rock',
  bars: 4,
  label: 'Metal chug',
  hint: 'E5–C5–B5 palm-muted chug pattern',
  chordLine: 'E · C · B · E',
  instrumentId: 'distortion_guitar',
  notes: [0, 1, 2, 3].flatMap((b) => {
    const roots = [40, 48, 47, 40];
    return [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((beat) => ({
      pitch: roots[b]!,
      startBeat: bar(b) + beat,
      durationBeats: 0.15,
      velocity: beat % 1 === 0 ? 114 : 100,
    }));
  }),
};

const ROCK_SURF_4: Se2GuitarLoopPreset = {
  id: 'rock_surf_4',
  genre: 'rock',
  bars: 4,
  label: 'Surf trem',
  hint: 'E–A–B–A tremolo-picked surf rock',
  chordLine: 'E · A · B · A',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...barComp(0, [40, 47, 52, 56, 59], [[0, 0.2, 90], [0.25, 0.2, 88], [0.5, 0.2, 90], [0.75, 0.2, 88]]),
    ...barComp(1, [45, 52, 57, 61], [[0, 0.2, 92], [0.25, 0.2, 90], [0.5, 0.2, 92], [0.75, 0.2, 90]]),
    ...barComp(2, [47, 54, 59, 62], [[0, 0.2, 94], [0.25, 0.2, 92], [0.5, 0.2, 94], [0.75, 0.2, 92]]),
    ...barComp(3, [45, 52, 57, 61], [[0, 0.2, 96], [0.25, 0.2, 94], [0.5, 0.2, 96], [0.75, 0.2, 94]]),
  ],
};

const ROCK_ALT_8: Se2GuitarLoopPreset = {
  id: 'rock_alt_8',
  genre: 'rock',
  bars: 8,
  label: 'Alt anthem',
  hint: 'Dm–Bb–F–C eight-bar alt-rock cycle',
  chordLine: 'Dm · Bb · F · C · Dm · Bb · F · C',
  instrumentId: 'overdriven_guitar',
  notes: [
    ...fourBarChords(
      [
        [50, 53, 57, 62],
        [46, 50, 53, 58],
        [41, 48, 53, 57],
        [48, 52, 55, 60],
      ],
      [[0, 0.6, 106], [2, 0.45, 100]],
    ),
    ...fourBarChords(
      [
        [50, 53, 57, 62],
        [46, 50, 53, 58],
        [41, 48, 53, 57],
        [48, 52, 55, 60],
      ],
      [[0, 0.65, 110], [2, 0.5, 104]],
    ).map((note) => ({ ...note, startBeat: note.startBeat + 16, velocity: note.velocity + 4 })),
  ],
};

const ROCK_PUNK_4: Se2GuitarLoopPreset = {
  id: 'rock_punk_4',
  genre: 'rock',
  bars: 4,
  label: 'Punk down',
  hint: 'E5–A5–B5–E5 fast downstroke punk',
  chordLine: 'E · A · B · E',
  instrumentId: 'distortion_guitar',
  notes: [
    ...strum([40, 47, 52], bar(0), 0.35, 118),
    ...strum([40, 47, 52], bar(0) + 1, 0.35, 114),
    ...strum([45, 52, 57], bar(1), 0.35, 116),
    ...strum([45, 52, 57], bar(1) + 1, 0.35, 112),
    ...strum([47, 54, 59], bar(2), 0.35, 120),
    ...strum([47, 54, 59], bar(2) + 1, 0.35, 116),
    ...strum([40, 47, 52], bar(3), 0.35, 122),
    ...strum([40, 47, 52], bar(3) + 1, 0.35, 118),
  ],
};

// ─── Latin (new genre) ──────────────────────────────────────────────────────

const LATIN_BOSSA_4: Se2GuitarLoopPreset = {
  id: 'latin_bossa_4',
  genre: 'latin',
  bars: 4,
  label: 'Bossa nova',
  hint: 'Am7–Gmaj7–Fmaj7–E7 Brazilian bossa comp',
  chordLine: 'Am7 · Gmaj7 · Fmaj7 · E7',
  instrumentId: 'acoustic_guitar_nylon',
  notes: [
    ...barComp(0, [45, 52, 55, 57, 62], [[0, 0.45, 78], [1.5, 0.35, 72], [2.5, 0.35, 74]]),
    ...barComp(1, [43, 47, 50, 54, 57, 62], [[0, 0.45, 76], [1.5, 0.35, 70], [2.5, 0.35, 72]]),
    ...barComp(2, [41, 48, 53, 57, 60, 65], [[0, 0.45, 74], [1.5, 0.35, 68], [2.5, 0.35, 70]]),
    ...barComp(3, [40, 44, 47, 50, 54, 58], [[0, 0.45, 80], [1.5, 0.35, 74], [2.5, 0.35, 76]]),
  ],
};

const LATIN_SAMBA_4: Se2GuitarLoopPreset = {
  id: 'latin_samba_4',
  genre: 'latin',
  bars: 4,
  label: 'Samba',
  hint: 'Dm7–G7–Cmaj7–A7 samba guitar pattern',
  chordLine: 'Dm7 · G7 · Cmaj7 · A7',
  instrumentId: 'acoustic_guitar_nylon',
  notes: [
    ...barComp(0, [50, 53, 57, 60, 65], [[0, 0.3, 84], [0.75, 0.25, 78], [1.5, 0.3, 82], [2.25, 0.25, 76], [3, 0.3, 80]]),
    ...barComp(1, [43, 47, 50, 53, 57, 61], [[0, 0.3, 86], [0.75, 0.25, 80], [1.5, 0.3, 84], [2.25, 0.25, 78], [3, 0.3, 82]]),
    ...barComp(2, [48, 52, 55, 59, 62], [[0, 0.3, 88], [0.75, 0.25, 82], [1.5, 0.3, 86], [2.25, 0.25, 80], [3, 0.3, 84]]),
    ...barComp(3, [45, 49, 52, 55, 59, 63], [[0, 0.3, 90], [0.75, 0.25, 84], [1.5, 0.3, 88], [2.25, 0.25, 82], [3, 0.3, 86]]),
  ],
};

const LATIN_SALSA_4: Se2GuitarLoopPreset = {
  id: 'latin_salsa_4',
  genre: 'latin',
  bars: 4,
  label: 'Salsa montuno',
  hint: 'Am–G–F–E montuno piano-style guitar',
  chordLine: 'Am · G · F · E',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...barComp(0, [45, 52, 57, 60], [[0, 0.25, 92], [0.75, 0.25, 86], [1.5, 0.25, 90], [2.25, 0.25, 84], [3, 0.25, 88]]),
    ...barComp(1, [43, 47, 50, 55, 59], [[0, 0.25, 94], [0.75, 0.25, 88], [1.5, 0.25, 92], [2.25, 0.25, 86], [3, 0.25, 90]]),
    ...barComp(2, [41, 48, 53, 57], [[0, 0.25, 96], [0.75, 0.25, 90], [1.5, 0.25, 94], [2.25, 0.25, 88], [3, 0.25, 92]]),
    ...barComp(3, [40, 47, 52, 56, 59], [[0, 0.25, 98], [0.75, 0.25, 92], [1.5, 0.25, 96], [2.25, 0.25, 90], [3, 0.25, 94]]),
  ],
};

const LATIN_BACHATA_4: Se2GuitarLoopPreset = {
  id: 'latin_bachata_4',
  genre: 'latin',
  bars: 4,
  label: 'Bachata',
  hint: 'Am–F–C–G bachata guitar arpeggio',
  chordLine: 'Am · F · C · G',
  instrumentId: 'acoustic_guitar_nylon',
  notes: [
    n(45, bar(0), 0.4, 84), n(52, bar(0) + 0.5, 0.4, 80), n(57, bar(0) + 1, 0.4, 82),
    n(60, bar(0) + 1.5, 0.4, 86), n(41, bar(1), 0.4, 82), n(48, bar(1) + 0.5, 0.4, 78),
    n(53, bar(1) + 1, 0.4, 80), n(57, bar(1) + 1.5, 0.4, 84), n(48, bar(2), 0.4, 86),
    n(52, bar(2) + 0.5, 0.4, 82), n(55, bar(2) + 1, 0.4, 84), n(60, bar(2) + 1.5, 0.4, 88),
    n(43, bar(3), 0.4, 88), n(47, bar(3) + 0.5, 0.4, 84), n(50, bar(3) + 1, 0.4, 86),
    n(55, bar(3) + 1.5, 0.4, 90),
  ].flat(),
};

const LATIN_RUMBA_4: Se2GuitarLoopPreset = {
  id: 'latin_rumba_4',
  genre: 'latin',
  bars: 4,
  label: 'Rumba flamenco',
  hint: 'Am–G–F–E rumba strum pattern',
  chordLine: 'Am · G · F · E',
  instrumentId: 'acoustic_guitar_nylon',
  notes: [
    ...strum([45, 52, 57, 60], bar(0), 0.25, 96),
    ...strum([45, 52, 57, 60], bar(0) + 0.75, 0.2, 90),
    ...strum([43, 47, 50, 55, 59], bar(1), 0.25, 94),
    ...strum([43, 47, 50, 55, 59], bar(1) + 0.75, 0.2, 88),
    ...strum([41, 48, 53, 57], bar(2), 0.25, 98),
    ...strum([41, 48, 53, 57], bar(2) + 0.75, 0.2, 92),
    ...strum([40, 47, 52, 56, 59], bar(3), 0.25, 100),
    ...strum([40, 47, 52, 56, 59], bar(3) + 0.75, 0.2, 94),
  ],
};

const LATIN_CUMBIA_4: Se2GuitarLoopPreset = {
  id: 'latin_cumbia_4',
  genre: 'latin',
  bars: 4,
  label: 'Cumbia',
  hint: 'Am–E–Am–E cumbia accordion-style guitar',
  chordLine: 'Am · E · Am · E',
  instrumentId: 'electric_guitar_clean',
  notes: fourBarChords(
    [
      [45, 52, 57, 60],
      [40, 47, 52, 56, 59],
      [45, 52, 57, 60],
      [40, 47, 52, 56, 59],
    ],
    [[0, 0.5, 88], [1.5, 0.4, 82], [2.5, 0.4, 86], [3.25, 0.35, 84]],
  ),
};

const LATIN_MAMBO_4: Se2GuitarLoopPreset = {
  id: 'latin_mambo_4',
  genre: 'latin',
  bars: 4,
  label: 'Mambo',
  hint: 'Dm–G–C–A mambo horn-hit guitar',
  chordLine: 'Dm · G · C · A',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...strum([50, 53, 57, 62], bar(0) + 0.5, 0.2, 104),
    ...strum([43, 47, 50, 55, 59], bar(1) + 0.5, 0.2, 102),
    ...strum([48, 52, 55, 60], bar(2) + 0.5, 0.2, 106),
    ...strum([45, 52, 57, 61], bar(3) + 0.5, 0.2, 104),
    ...strum([50, 53, 57, 62], bar(0) + 2.5, 0.18, 98),
    ...strum([43, 47, 50, 55, 59], bar(1) + 2.5, 0.18, 96),
    ...strum([48, 52, 55, 60], bar(2) + 2.5, 0.18, 100),
    ...strum([45, 52, 57, 61], bar(3) + 2.5, 0.18, 98),
  ],
};

const LATIN_TANGO_4: Se2GuitarLoopPreset = {
  id: 'latin_tango_4',
  genre: 'latin',
  bars: 4,
  label: 'Tango',
  hint: 'Am–E7–Am–B7 dramatic tango accents',
  chordLine: 'Am · E7 · Am · B7',
  instrumentId: 'acoustic_guitar_nylon',
  notes: [
    ...strum([45, 52, 57, 60], bar(0), 0.6, 92),
    ...strum([40, 44, 47, 50, 54, 58], bar(1), 0.55, 94),
    ...strum([45, 52, 57, 60], bar(2), 0.6, 96),
    ...strum([47, 51, 54, 57, 61], bar(3), 0.5, 98),
    n(69, bar(0) + 2, 0.35, 84), n(71, bar(2) + 2, 0.35, 86), n(73, bar(3) + 2, 0.35, 88),
  ].flat(),
};

const LATIN_REGGAE_LAT_4: Se2GuitarLoopPreset = {
  id: 'latin_reggae_lat_4',
  genre: 'latin',
  bars: 4,
  label: 'Reggae latino',
  hint: 'G–C–G–D off-beat skank — Caribbean groove',
  chordLine: 'G · C · G · D',
  instrumentId: 'electric_guitar_clean',
  notes: fourBarChords(
    [
      [43, 47, 50, 55, 59],
      [48, 52, 55, 60],
      [43, 47, 50, 55, 59],
      [50, 54, 57, 62],
    ],
    [[0.5, 0.35, 86], [1.5, 0.35, 80], [2.5, 0.35, 84], [3.5, 0.35, 82]],
  ),
};

const LATIN_CHA_4: Se2GuitarLoopPreset = {
  id: 'latin_cha_4',
  genre: 'latin',
  bars: 4,
  label: 'Cha-cha-chá',
  hint: 'F–G–Em–Am cha-cha rhythm guitar',
  chordLine: 'F · G · Em · Am',
  instrumentId: 'acoustic_guitar_nylon',
  notes: [
    ...barComp(0, [41, 48, 53, 57], [[0, 0.4, 88], [1, 0.35, 82], [2, 0.4, 86], [3, 0.35, 84]]),
    ...barComp(1, [43, 47, 50, 55, 59], [[0, 0.4, 90], [1, 0.35, 84], [2, 0.4, 88], [3, 0.35, 86]]),
    ...barComp(2, [40, 47, 52, 55, 59], [[0, 0.4, 86], [1, 0.35, 80], [2, 0.4, 84], [3, 0.35, 82]]),
    ...barComp(3, [45, 52, 57, 60], [[0, 0.4, 92], [1, 0.35, 86], [2, 0.4, 90], [3, 0.35, 88]]),
  ],
};

const LATIN_CARNAVAL_8: Se2GuitarLoopPreset = {
  id: 'latin_carnaval_8',
  genre: 'latin',
  bars: 8,
  label: 'Carnaval',
  hint: 'Eight-bar samba parade chord cycle',
  chordLine: 'F · G · Em · Am · Dm · G · C · E7',
  instrumentId: 'acoustic_guitar_nylon',
  notes: [
    ...fourBarChords(
      [
        [41, 48, 53, 57],
        [43, 47, 50, 55, 59],
        [40, 47, 52, 55, 59],
        [45, 52, 57, 60],
      ],
      [[0, 0.45, 86], [2, 0.35, 80]],
    ),
    ...fourBarChords(
      [
        [50, 53, 57, 62],
        [43, 47, 50, 55, 59],
        [48, 52, 55, 60],
        [40, 44, 47, 50, 54, 58],
      ],
      [[0, 0.45, 90], [2, 0.35, 84]],
    ).map((note) => ({ ...note, startBeat: note.startBeat + 16 })),
  ],
};

const LATIN_FLAMENCO_4: Se2GuitarLoopPreset = {
  id: 'latin_flamenco_4',
  genre: 'latin',
  bars: 4,
  label: 'Flamenco',
  hint: 'Am–G–F–E rapid flamenco rasgueado',
  chordLine: 'Am · G · F · E',
  instrumentId: 'acoustic_guitar_nylon',
  notes: [
    ...strum([45, 52, 57, 60], bar(0), 0.2, 98),
    ...strum([45, 52, 57, 60], bar(0) + 0.5, 0.2, 92),
    ...strum([45, 52, 57, 60], bar(0) + 1, 0.2, 96),
    ...strum([43, 47, 50, 55, 59], bar(1), 0.2, 100),
    ...strum([43, 47, 50, 55, 59], bar(1) + 0.5, 0.2, 94),
    ...strum([43, 47, 50, 55, 59], bar(1) + 1, 0.2, 98),
    ...strum([41, 48, 53, 57], bar(2), 0.2, 102),
    ...strum([41, 48, 53, 57], bar(2) + 0.5, 0.2, 96),
    ...strum([40, 47, 52, 56, 59], bar(3), 0.2, 104),
    ...strum([40, 47, 52, 56, 59], bar(3) + 0.5, 0.2, 98),
  ],
};

// ─── K-pop (new genre) ──────────────────────────────────────────────────────

const KPOP_VERSE_4: Se2GuitarLoopPreset = {
  id: 'kpop_verse_4',
  genre: 'kpop',
  bars: 4,
  label: 'K-pop verse',
  hint: 'Dm–Bb–F–C syncopated clean electric',
  chordLine: 'Dm · Bb · F · C',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...barComp(0, [50, 53, 57, 62], [[0.5, 0.35, 88], [1.5, 0.35, 82], [2.5, 0.35, 86], [3.25, 0.3, 80]]),
    ...barComp(1, [46, 50, 53, 58], [[0.5, 0.35, 86], [1.5, 0.35, 80], [2.5, 0.35, 84], [3.25, 0.3, 78]]),
    ...barComp(2, [41, 48, 53, 57], [[0.5, 0.35, 90], [1.5, 0.35, 84], [2.5, 0.35, 88], [3.25, 0.3, 82]]),
    ...barComp(3, [48, 52, 55, 60], [[0.5, 0.35, 92], [1.5, 0.35, 86], [2.5, 0.35, 90], [3.25, 0.3, 84]]),
  ],
};

const KPOP_CHORUS_4: Se2GuitarLoopPreset = {
  id: 'kpop_chorus_4',
  genre: 'kpop',
  bars: 4,
  label: 'K-pop chorus',
  hint: 'F–C–G–Am bright chorus power strum',
  chordLine: 'F · C · G · Am',
  instrumentId: 'electric_guitar_clean',
  notes: fourBarChords(
    [
      [41, 48, 53, 57],
      [48, 52, 55, 60],
      [43, 47, 50, 55, 59],
      [45, 52, 57, 60],
    ],
    [[0, 0.5, 96], [2, 0.4, 90]],
  ),
};

const KPOP_BALLAD_4: Se2GuitarLoopPreset = {
  id: 'kpop_ballad_4',
  genre: 'kpop',
  bars: 4,
  label: 'K-ballad',
  hint: 'Am–F–C–G emotional ballad arpeggio',
  chordLine: 'Am · F · C · G',
  instrumentId: 'acoustic_guitar_nylon',
  notes: [
    n(45, bar(0), 0.5, 80), n(52, bar(0) + 0.5, 0.5, 76), n(57, bar(0) + 1, 0.5, 78),
    n(60, bar(0) + 1.5, 0.5, 82), n(41, bar(1), 0.5, 78), n(48, bar(1) + 0.5, 0.5, 74),
    n(53, bar(1) + 1, 0.5, 76), n(57, bar(1) + 1.5, 0.5, 80), n(48, bar(2), 0.5, 82),
    n(52, bar(2) + 0.5, 0.5, 78), n(55, bar(2) + 1, 0.5, 80), n(60, bar(2) + 1.5, 0.5, 84),
    n(43, bar(3), 0.5, 84), n(47, bar(3) + 0.5, 0.5, 80), n(50, bar(3) + 1, 0.5, 82),
    n(55, bar(3) + 1.5, 0.5, 86),
  ].flat(),
};

const KPOP_EDM_4: Se2GuitarLoopPreset = {
  id: 'kpop_edm_4',
  genre: 'kpop',
  bars: 4,
  label: 'K-pop EDM',
  hint: 'Am–F–C–G pluck build — drop-ready',
  chordLine: 'Am · F · C · G',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...strum([45, 52, 57, 60], bar(0) + 0.5, 0.3, 94),
    ...strum([41, 48, 53, 57], bar(1) + 0.5, 0.3, 92),
    ...strum([48, 52, 55, 60], bar(2) + 0.5, 0.3, 96),
    ...strum([43, 47, 50, 55, 59], bar(3) + 0.5, 0.3, 98),
    n(69, bar(0) + 2.5, 0.25, 82), n(65, bar(1) + 2.5, 0.25, 80),
    n(72, bar(2) + 2.5, 0.25, 84), n(71, bar(3) + 2.5, 0.25, 86),
  ].flat(),
};

const KPOP_FUNK_4: Se2GuitarLoopPreset = {
  id: 'kpop_funk_4',
  genre: 'kpop',
  bars: 4,
  label: 'K-funk',
  hint: 'Bm7–E9–Amaj7–D9 retro-funk K-pop groove',
  chordLine: 'Bm7 · E9 · Amaj7 · D9',
  instrumentId: 'electric_guitar_clean',
  notes: fourBarChords(
    [
      [47, 54, 57, 59, 64],
      [40, 44, 47, 50, 54, 58],
      [45, 52, 57, 61, 64],
      [50, 54, 57, 60, 64, 68],
    ],
    [[0.5, 0.3, 92], [1.5, 0.25, 86], [2.5, 0.3, 90], [3.25, 0.25, 88]],
  ),
};

const KPOP_RNB_4: Se2GuitarLoopPreset = {
  id: 'kpop_rnb_4',
  genre: 'kpop',
  bars: 4,
  label: 'K-R&B',
  hint: 'Cmaj7–Am7–Fmaj7–G6 smooth K-R&B comp',
  chordLine: 'Cmaj7 · Am7 · Fmaj7 · G6',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...barComp(0, [48, 52, 55, 59, 62], [[0, 0.55, 78], [2, 0.35, 72]]),
    ...barComp(1, [45, 52, 55, 57, 62], [[0, 0.55, 76], [2, 0.35, 70]]),
    ...barComp(2, [41, 48, 53, 57, 60, 65], [[0, 0.55, 74], [2, 0.35, 68]]),
    ...barComp(3, [43, 47, 50, 55, 59, 62], [[0, 0.5, 80], [2, 0.35, 74]]),
  ],
};

const KPOP_ROCK_4: Se2GuitarLoopPreset = {
  id: 'kpop_rock_4',
  genre: 'kpop',
  bars: 4,
  label: 'K-rock',
  hint: 'Em–C–G–D rock band K-pop bridge',
  chordLine: 'Em · C · G · D',
  instrumentId: 'overdriven_guitar',
  notes: fourBarChords(
    [
      [40, 47, 52, 55, 59],
      [48, 52, 55, 60],
      [43, 47, 50, 55, 59],
      [50, 54, 57, 62],
    ],
    [[0, 0.55, 104], [2, 0.45, 98]],
  ),
};

const KPOP_HOUSE_4: Se2GuitarLoopPreset = {
  id: 'kpop_house_4',
  genre: 'kpop',
  bars: 4,
  label: 'K-house',
  hint: 'Am–G–F–E four-on-the-floor guitar stab',
  chordLine: 'Am · G · F · E',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...strum([45, 52, 57, 60], bar(0), 0.25, 100),
    ...strum([43, 47, 50, 55, 59], bar(1), 0.25, 98),
    ...strum([41, 48, 53, 57], bar(2), 0.25, 102),
    ...strum([40, 47, 52, 56, 59], bar(3), 0.25, 104),
    ...strum([45, 52, 57, 60], bar(0) + 2, 0.25, 96),
    ...strum([43, 47, 50, 55, 59], bar(1) + 2, 0.25, 94),
    ...strum([41, 48, 53, 57], bar(2) + 2, 0.25, 98),
    ...strum([40, 47, 52, 56, 59], bar(3) + 2, 0.25, 100),
  ],
};

const KPOP_ANTHEM_8: Se2GuitarLoopPreset = {
  id: 'kpop_anthem_8',
  genre: 'kpop',
  bars: 8,
  label: 'K-anthem',
  hint: 'Eight-bar Dm–Bb–F–C doubled chorus bed',
  chordLine: 'Dm · Bb · F · C · Dm · Bb · F · C',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...KPOP_VERSE_4.notes,
    ...KPOP_VERSE_4.notes.map((note) => ({
      ...note,
      startBeat: note.startBeat + 16,
      velocity: Math.min(127, note.velocity + 8),
    })),
  ],
};

const KPOP_ACOUSTIC_4: Se2GuitarLoopPreset = {
  id: 'kpop_acoustic_4',
  genre: 'kpop',
  bars: 4,
  label: 'Unplugged K',
  hint: 'G–Em–C–D acoustic idol ballad',
  chordLine: 'G · Em · C · D',
  instrumentId: 'acoustic_guitar_steel',
  notes: fourBarChords(
    [
      [43, 47, 50, 55, 59],
      [40, 47, 52, 55, 59],
      [48, 52, 55, 60],
      [50, 54, 57, 62],
    ],
    [[0, 0.8, 84], [2, 0.5, 78]],
  ),
};

export const SE2_GUITAR_GENRE_BATCH_PRESETS: readonly Se2GuitarLoopPreset[] = [
  // Country (+10)
  COUNTRY_NASHVILLE_4,
  COUNTRY_TELE_4,
  COUNTRY_COWBOY_4,
  COUNTRY_BLUEGRASS_4,
  COUNTRY_DUST_4,
  COUNTRY_TWO_STEP_4,
  COUNTRY_PORCH_4,
  COUNTRY_OUTLAW_4,
  COUNTRY_WALTZ_4,
  COUNTRY_ROADTRIP_8,
  // Funk (+15)
  FUNK_BOOTSY_4,
  FUNK_PRINCE_4,
  FUNK_CHIC_4,
  FUNK_PARLIAMENT_4,
  FUNK_NILE_4,
  FUNK_JAMES_4,
  FUNK_METER_4,
  FUNK_VULF_4,
  FUNK_BRIDGEFUNK_4,
  FUNK_WAH_4,
  FUNK_GOGO_4,
  FUNK_COLD_4,
  FUNK_HORN_4,
  FUNK_SLAP_BASS_4,
  FUNK_TOWER_16_8,
  FUNK_NEOSOUL_4,
  // Blues (+19)
  BLUES_TEXAS_4,
  BLUES_CHICAGO_4,
  BLUES_MINOR_4,
  BLUES_SLOW_12_8,
  BLUES_DELTA_4,
  BLUES_MUDDY_4,
  BLUES_BUDDY_4,
  BLUES_FROSTY_4,
  BLUES_ACOUSTIC_4,
  BLUES_PIANO_4,
  BLUES_WOMAN_4,
  BLUES_JUKE_4,
  BLUES_KING_4,
  BLUES_MEMPHIS_4,
  BLUES_HENDRIX_4,
  BLUES_WALK_4,
  BLUES_RAG_4,
  BLUES_LONELY_8,
  BLUES_ROADHOUSE_4,
  // Rock (+7)
  ROCK_GRUNGE_4,
  ROCK_INDIE_4,
  ROCK_CLASSIC_4,
  ROCK_METAL_4,
  ROCK_SURF_4,
  ROCK_ALT_8,
  ROCK_PUNK_4,
  // Latin (+12)
  LATIN_BOSSA_4,
  LATIN_SAMBA_4,
  LATIN_SALSA_4,
  LATIN_BACHATA_4,
  LATIN_RUMBA_4,
  LATIN_CUMBIA_4,
  LATIN_MAMBO_4,
  LATIN_TANGO_4,
  LATIN_REGGAE_LAT_4,
  LATIN_CHA_4,
  LATIN_CARNAVAL_8,
  LATIN_FLAMENCO_4,
  // K-pop (+10)
  KPOP_VERSE_4,
  KPOP_CHORUS_4,
  KPOP_BALLAD_4,
  KPOP_EDM_4,
  KPOP_FUNK_4,
  KPOP_RNB_4,
  KPOP_ROCK_4,
  KPOP_HOUSE_4,
  KPOP_ANTHEM_8,
  KPOP_ACOUSTIC_4,
];

