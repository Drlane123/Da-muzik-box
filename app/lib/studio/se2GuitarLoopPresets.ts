/**
 * SE2 Guitar lane — genre loop presets (4- and 8-bar MIDI guitar parts).
 * Notes are relative to loop start (beat 0). Caller offsets by playhead bar.
 */
import type { Se2GuitarInstrumentId } from '@/app/lib/studio/se2GuitarInstruments';
import { SE2_GUITAR_MELODIC_LOOP_PRESETS } from '@/app/lib/studio/se2GuitarLoopPresetsMelodic';
import { SE2_GUITAR_POP_LOOP_PRESETS } from '@/app/lib/studio/se2GuitarLoopPresetsPop';
import { SE2_GUITAR_RNB_POP_BATCH_PRESETS } from '@/app/lib/studio/se2GuitarLoopPresetsRnBPopBatch';
import { SE2_GUITAR_GENRE_BATCH_PRESETS } from '@/app/lib/studio/se2GuitarLoopPresetsGenreBatch';

import type { Se2GuitarPartBars } from '@/app/lib/studio/se2GuitarPartBars';

export type Se2GuitarLoopGenre = 'rnb' | 'pop' | 'country' | 'funk' | 'blues' | 'rock' | 'latin' | 'kpop';

export type Se2GuitarLoopNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

export type Se2GuitarLoopPreset = {
  id: string;
  genre: Se2GuitarLoopGenre;
  bars: 4 | 8;
  label: string;
  hint: string;
  /** Short chord / feel line on preset cards. */
  chordLine: string;
  instrumentId?: Se2GuitarInstrumentId;
  notes: readonly Se2GuitarLoopNote[];
};

export type Se2GuitarLoopGenreOption = {
  id: Se2GuitarLoopGenre;
  label: string;
  accentHex: string;
};

export const SE2_GUITAR_LOOP_GENRES: readonly Se2GuitarLoopGenreOption[] = [
  { id: 'rnb', label: 'R&B', accentHex: '#E8A0C8' },
  { id: 'pop', label: 'Pop', accentHex: '#FFB84D' },
  { id: 'country', label: 'Country', accentHex: '#D4A84B' },
  { id: 'funk', label: 'Funk', accentHex: '#7CF4C6' },
  { id: 'blues', label: 'Blues', accentHex: '#5B8CFF' },
  { id: 'rock', label: 'Rock', accentHex: '#E85D75' },
  { id: 'latin', label: 'Latin', accentHex: '#FF6B4A' },
  { id: 'kpop', label: 'K-pop', accentHex: '#B388FF' },
];

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

function bar(b: number, beatsPerBar = 4): number {
  return b * beatsPerBar;
}

function repeatBars(
  notes: readonly Se2GuitarLoopNote[],
  times: number,
  barSpan: number,
  beatsPerBar = 4,
): Se2GuitarLoopNote[] {
  const span = barSpan * beatsPerBar;
  const out: Se2GuitarLoopNote[] = [];
  for (let t = 0; t < times; t += 1) {
    const off = t * span;
    for (const n of notes) {
      out.push({ ...n, startBeat: n.startBeat + off });
    }
  }
  return out;
}

const RNB_QUIET_STORM_4: Se2GuitarLoopPreset = {
  id: 'rnb_quiet_storm_4',
  genre: 'rnb',
  bars: 4,
  label: 'Quiet storm',
  hint: 'Soft major-7 plucks — late-night R&B ballad',
  chordLine: 'Cmaj7 · Am7 · Fmaj7 · G',
  instrumentId: 'electric_guitar_jazz',
  notes: [
    ...strum([48, 52, 55, 59], bar(0), 0.75, 78),
    ...strum([45, 52, 57, 60], bar(1), 0.75, 76),
    ...strum([41, 48, 53, 57], bar(2), 0.75, 74),
    ...strum([43, 47, 50, 55], bar(3), 0.5, 80),
    { pitch: 55, startBeat: bar(3) + 2, durationBeats: 0.35, velocity: 72 },
  ],
};

const RNB_NEO_VAMP_4: Se2GuitarLoopPreset = {
  id: 'rnb_neo_vamp_4',
  genre: 'rnb',
  bars: 4,
  label: 'Neo vamp',
  hint: 'Syncopated soul pluck on 2 and 4',
  chordLine: 'Dm9 · G13 · Cmaj9 · Fmaj7',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...strum([50, 53, 57, 62], bar(0) + 1, 0.4, 84),
    ...strum([43, 47, 50, 55], bar(1) + 1, 0.4, 82),
    ...strum([48, 52, 55, 59], bar(2) + 1, 0.4, 86),
    ...strum([41, 48, 53, 57], bar(3) + 1, 0.4, 80),
    { pitch: 59, startBeat: bar(0) + 2.5, durationBeats: 0.25, velocity: 70 },
    { pitch: 55, startBeat: bar(1) + 2.5, durationBeats: 0.25, velocity: 68 },
    { pitch: 60, startBeat: bar(2) + 2.5, durationBeats: 0.25, velocity: 72 },
    { pitch: 57, startBeat: bar(3) + 2.5, durationBeats: 0.25, velocity: 66 },
  ],
};

const RNB_GOSPEL_4: Se2GuitarLoopPreset = {
  id: 'rnb_gospel_4',
  genre: 'rnb',
  bars: 4,
  label: 'Gospel pick',
  hint: 'Church-style chord hits with fills',
  chordLine: 'C · F/C · G · C',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    ...strum([48, 55, 60], bar(0), 0.5, 92),
    ...strum([41, 48, 53], bar(1), 0.5, 88),
    ...strum([43, 47, 50, 55], bar(2), 0.5, 90),
    ...strum([48, 55, 60], bar(3), 0.5, 94),
    { pitch: 60, startBeat: bar(0) + 2, durationBeats: 0.25, velocity: 76 },
    { pitch: 62, startBeat: bar(0) + 2.5, durationBeats: 0.25, velocity: 78 },
    { pitch: 57, startBeat: bar(2) + 2, durationBeats: 0.25, velocity: 74 },
    { pitch: 59, startBeat: bar(2) + 2.5, durationBeats: 0.25, velocity: 76 },
  ],
};

const RNB_SLOW_JAM_8: Se2GuitarLoopPreset = {
  id: 'rnb_slow_jam_8',
  genre: 'rnb',
  bars: 8,
  label: 'Slow jam',
  hint: 'Eight-bar R&B chord cycle with passing tones',
  chordLine: 'Cmaj7 · Am7 · Dm7 · G7 · Fmaj7 · Em7 · Am7 · G',
  instrumentId: 'electric_guitar_jazz',
  notes: repeatBars(
    [
      ...strum([48, 52, 55, 59], 0, 1.25, 76),
      ...strum([45, 52, 57, 60], 4, 1.25, 74),
      ...strum([50, 53, 57, 62], 8, 1.25, 78),
      ...strum([43, 47, 50, 55], 12, 1.0, 80),
      { pitch: 59, startBeat: 14, durationBeats: 0.35, velocity: 68 },
      { pitch: 57, startBeat: 15, durationBeats: 0.35, velocity: 66 },
    ],
    1,
    4,
  ).concat(
    repeatBars(
      [
        ...strum([41, 48, 53, 57], 0, 1.25, 72),
        ...strum([40, 47, 52, 55], 4, 1.25, 70),
        ...strum([45, 52, 57, 60], 8, 1.25, 74),
        ...strum([43, 47, 50, 55], 12, 0.75, 78),
      ],
      1,
      4,
    ).map((n) => ({ ...n, startBeat: n.startBeat + 16 })),
  ),
};

const COUNTRY_TRAVIS_4: Se2GuitarLoopPreset = {
  id: 'country_travis_4',
  genre: 'country',
  bars: 4,
  label: 'Travis pick',
  hint: 'Alternating bass + treble — Nashville pattern',
  chordLine: 'G · C · G · D',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    { pitch: 43, startBeat: bar(0), durationBeats: 0.5, velocity: 88 },
    { pitch: 55, startBeat: bar(0) + 0.5, durationBeats: 0.25, velocity: 82 },
    { pitch: 50, startBeat: bar(0) + 1, durationBeats: 0.25, velocity: 80 },
    { pitch: 55, startBeat: bar(0) + 1.5, durationBeats: 0.25, velocity: 84 },
    { pitch: 48, startBeat: bar(1), durationBeats: 0.5, velocity: 86 },
    { pitch: 60, startBeat: bar(1) + 0.5, durationBeats: 0.25, velocity: 82 },
    { pitch: 55, startBeat: bar(1) + 1, durationBeats: 0.25, velocity: 80 },
    { pitch: 60, startBeat: bar(1) + 1.5, durationBeats: 0.25, velocity: 84 },
    { pitch: 43, startBeat: bar(2), durationBeats: 0.5, velocity: 88 },
    { pitch: 55, startBeat: bar(2) + 0.5, durationBeats: 0.25, velocity: 82 },
    { pitch: 50, startBeat: bar(2) + 1, durationBeats: 0.25, velocity: 80 },
    { pitch: 55, startBeat: bar(2) + 1.5, durationBeats: 0.25, velocity: 84 },
    { pitch: 50, startBeat: bar(3), durationBeats: 0.5, velocity: 86 },
    { pitch: 62, startBeat: bar(3) + 0.5, durationBeats: 0.25, velocity: 82 },
    { pitch: 57, startBeat: bar(3) + 1, durationBeats: 0.25, velocity: 80 },
    { pitch: 62, startBeat: bar(3) + 1.5, durationBeats: 0.25, velocity: 84 },
  ],
};

const COUNTRY_BALLAD_4: Se2GuitarLoopPreset = {
  id: 'country_ballad_4',
  genre: 'country',
  bars: 4,
  label: 'Ballad arp',
  hint: 'Slow open-position arpeggios',
  chordLine: 'C · Am · F · G',
  instrumentId: 'acoustic_guitar_nylon',
  notes: [
    { pitch: 48, startBeat: bar(0), durationBeats: 0.5, velocity: 84 },
    { pitch: 52, startBeat: bar(0) + 0.5, durationBeats: 0.5, velocity: 80 },
    { pitch: 55, startBeat: bar(0) + 1, durationBeats: 0.5, velocity: 82 },
    { pitch: 60, startBeat: bar(0) + 1.5, durationBeats: 0.5, velocity: 86 },
    { pitch: 45, startBeat: bar(1), durationBeats: 0.5, velocity: 82 },
    { pitch: 52, startBeat: bar(1) + 0.5, durationBeats: 0.5, velocity: 78 },
    { pitch: 57, startBeat: bar(1) + 1, durationBeats: 0.5, velocity: 80 },
    { pitch: 60, startBeat: bar(1) + 1.5, durationBeats: 0.5, velocity: 84 },
    { pitch: 41, startBeat: bar(2), durationBeats: 0.5, velocity: 80 },
    { pitch: 48, startBeat: bar(2) + 0.5, durationBeats: 0.5, velocity: 76 },
    { pitch: 53, startBeat: bar(2) + 1, durationBeats: 0.5, velocity: 78 },
    { pitch: 57, startBeat: bar(2) + 1.5, durationBeats: 0.5, velocity: 82 },
    { pitch: 43, startBeat: bar(3), durationBeats: 0.5, velocity: 84 },
    { pitch: 47, startBeat: bar(3) + 0.5, durationBeats: 0.5, velocity: 80 },
    { pitch: 50, startBeat: bar(3) + 1, durationBeats: 0.5, velocity: 82 },
    { pitch: 55, startBeat: bar(3) + 1.5, durationBeats: 0.5, velocity: 86 },
  ],
};

const COUNTRY_HONKY_4: Se2GuitarLoopPreset = {
  id: 'country_honky_4',
  genre: 'country',
  bars: 4,
  label: 'Honky shuffle',
  hint: 'Shuffle-feel chord accents',
  chordLine: 'G · G · C · D',
  instrumentId: 'acoustic_guitar_steel',
  notes: [
    ...strum([43, 47, 50, 55], bar(0), 0.35, 90),
    ...strum([43, 47, 50, 55], bar(0) + 1.5, 0.35, 86),
    ...strum([43, 47, 50, 55], bar(1), 0.35, 88),
    ...strum([43, 47, 50, 55], bar(1) + 1.5, 0.35, 84),
    ...strum([48, 52, 55, 60], bar(2), 0.35, 92),
    ...strum([48, 52, 55, 60], bar(2) + 1.5, 0.35, 88),
    ...strum([50, 54, 57, 62], bar(3), 0.35, 94),
    ...strum([50, 54, 57, 62], bar(3) + 1.5, 0.35, 90),
  ],
};

const COUNTRY_ROAD_8: Se2GuitarLoopPreset = {
  id: 'country_road_8',
  genre: 'country',
  bars: 8,
  label: 'Road song',
  hint: 'Eight-bar country cycle — verse-friendly',
  chordLine: 'G · C · G · D · Em · C · G · D',
  instrumentId: 'acoustic_guitar_steel',
  notes: repeatBars(COUNTRY_TRAVIS_4.notes, 2, 4),
};

const FUNK_POCKET_4: Se2GuitarLoopPreset = {
  id: 'funk_pocket_4',
  genre: 'funk',
  bars: 4,
  label: 'Pocket mute',
  hint: '16th-note muted electric — tight pocket',
  chordLine: 'E9 · E9 · A9 · B9',
  instrumentId: 'electric_guitar_muted',
  notes: (() => {
    const out: Se2GuitarLoopNote[] = [];
    for (let b = 0; b < 4; b += 1) {
      const root = b < 2 ? 52 : b === 2 ? 45 : 47;
      for (let s = 0; s < 8; s += 1) {
        if (s === 3 || s === 7) continue;
        out.push({
          pitch: root,
          startBeat: bar(b) + s * 0.5,
          durationBeats: 0.2,
          velocity: s % 2 === 0 ? 108 : 100,
        });
      }
    }
    return out;
  })(),
};

const FUNK_STAB_4: Se2GuitarLoopPreset = {
  id: 'funk_stab_4',
  genre: 'funk',
  bars: 4,
  label: 'Chord stab',
  hint: 'Sharp off-beat hits — Tower / Prince feel',
  chordLine: 'Am7 · D7 · G7 · C7',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...strum([45, 52, 57, 60], bar(0) + 0.5, 0.2, 112),
    ...strum([50, 54, 57, 62], bar(1) + 0.5, 0.2, 110),
    ...strum([43, 47, 50, 55], bar(2) + 0.5, 0.2, 114),
    ...strum([48, 52, 55, 58], bar(3) + 0.5, 0.2, 112),
    ...strum([45, 52, 57, 60], bar(0) + 2.5, 0.15, 106),
    ...strum([50, 54, 57, 62], bar(1) + 2.5, 0.15, 104),
    ...strum([43, 47, 50, 55], bar(2) + 2.5, 0.15, 108),
    ...strum([48, 52, 55, 58], bar(3) + 2.5, 0.15, 106),
  ],
};

const FUNK_SLAP_4: Se2GuitarLoopPreset = {
  id: 'funk_slap_4',
  genre: 'funk',
  bars: 4,
  label: 'Slap chop',
  hint: 'Percussive muted chops on the backbeat',
  chordLine: 'E7 · E7 · A7 · B7',
  instrumentId: 'electric_guitar_muted',
  notes: [
    { pitch: 52, startBeat: bar(0), durationBeats: 0.125, velocity: 118 },
    { pitch: 52, startBeat: bar(0) + 1, durationBeats: 0.125, velocity: 114 },
    { pitch: 52, startBeat: bar(0) + 2, durationBeats: 0.125, velocity: 116 },
    { pitch: 52, startBeat: bar(0) + 3, durationBeats: 0.125, velocity: 112 },
    { pitch: 52, startBeat: bar(1) + 0.5, durationBeats: 0.125, velocity: 110 },
    { pitch: 52, startBeat: bar(1) + 1.5, durationBeats: 0.125, velocity: 108 },
    { pitch: 52, startBeat: bar(1) + 2.5, durationBeats: 0.125, velocity: 112 },
    { pitch: 52, startBeat: bar(1) + 3.5, durationBeats: 0.125, velocity: 110 },
    { pitch: 45, startBeat: bar(2), durationBeats: 0.125, velocity: 116 },
    { pitch: 45, startBeat: bar(2) + 1, durationBeats: 0.125, velocity: 112 },
    { pitch: 45, startBeat: bar(2) + 2, durationBeats: 0.125, velocity: 114 },
    { pitch: 47, startBeat: bar(3), durationBeats: 0.125, velocity: 118 },
    { pitch: 47, startBeat: bar(3) + 1, durationBeats: 0.125, velocity: 114 },
    { pitch: 47, startBeat: bar(3) + 2.5, durationBeats: 0.125, velocity: 116 },
  ],
};

const FUNK_TOWER_8: Se2GuitarLoopPreset = {
  id: 'funk_tower_8',
  genre: 'funk',
  bars: 8,
  label: 'Tower groove',
  hint: 'Extended funk cycle — rhythm section lock',
  chordLine: 'Em7 · A7 · D7 · G7 · C7 · F7 · Bb7 · Eb7',
  instrumentId: 'electric_guitar_muted',
  notes: repeatBars(FUNK_STAB_4.notes, 2, 4).concat(
    repeatBars(FUNK_POCKET_4.notes, 1, 4).map((n) => ({ ...n, startBeat: n.startBeat + 16 })),
  ),
};

const BLUES_SHUFFLE_4: Se2GuitarLoopPreset = {
  id: 'blues_shuffle_4',
  genre: 'blues',
  bars: 4,
  label: 'Shuffle',
  hint: 'Texas shuffle — dominant 7th rhythm',
  chordLine: 'A7 · A7 · D7 · E7',
  instrumentId: 'electric_guitar_clean',
  notes: [
    ...strum([45, 49, 52, 57], bar(0), 0.45, 94),
    ...strum([45, 49, 52, 57], bar(0) + 1.5, 0.45, 90),
    ...strum([45, 49, 52, 57], bar(1), 0.45, 92),
    ...strum([45, 49, 52, 57], bar(1) + 1.5, 0.45, 88),
    ...strum([38, 42, 45, 50], bar(2), 0.45, 96),
    ...strum([38, 42, 45, 50], bar(2) + 1.5, 0.45, 92),
    ...strum([40, 44, 47, 52], bar(3), 0.45, 98),
    ...strum([40, 44, 47, 52], bar(3) + 1.5, 0.45, 94),
  ],
};

const BLUES_TURN_4: Se2GuitarLoopPreset = {
  id: 'blues_turn_4',
  genre: 'blues',
  bars: 4,
  label: 'Turnaround',
  hint: 'Classic I-IV-I-V blues box walk',
  chordLine: 'A7 · D7 · A7 · E7',
  instrumentId: 'overdriven_guitar',
  notes: [
    { pitch: 57, startBeat: bar(0), durationBeats: 0.75, velocity: 96 },
    { pitch: 56, startBeat: bar(0) + 1, durationBeats: 0.25, velocity: 88 },
    { pitch: 54, startBeat: bar(0) + 1.5, durationBeats: 0.25, velocity: 86 },
    { pitch: 52, startBeat: bar(0) + 2, durationBeats: 0.5, velocity: 92 },
    { pitch: 50, startBeat: bar(0) + 3, durationBeats: 0.5, velocity: 90 },
    { pitch: 50, startBeat: bar(1), durationBeats: 0.75, velocity: 94 },
    { pitch: 52, startBeat: bar(1) + 1, durationBeats: 0.25, velocity: 86 },
    { pitch: 54, startBeat: bar(1) + 1.5, durationBeats: 0.25, velocity: 88 },
    { pitch: 57, startBeat: bar(2), durationBeats: 0.75, velocity: 96 },
    { pitch: 59, startBeat: bar(2) + 1.5, durationBeats: 0.25, velocity: 90 },
    { pitch: 57, startBeat: bar(2) + 2, durationBeats: 0.5, velocity: 92 },
    { pitch: 59, startBeat: bar(3), durationBeats: 0.5, velocity: 98 },
    { pitch: 61, startBeat: bar(3) + 0.5, durationBeats: 0.25, velocity: 94 },
    { pitch: 59, startBeat: bar(3) + 1, durationBeats: 0.25, velocity: 90 },
    { pitch: 57, startBeat: bar(3) + 1.5, durationBeats: 0.25, velocity: 88 },
    { pitch: 56, startBeat: bar(3) + 2, durationBeats: 0.5, velocity: 92 },
  ],
};

const BLUES_SLOW_4: Se2GuitarLoopPreset = {
  id: 'blues_slow_4',
  genre: 'blues',
  bars: 4,
  label: 'Slow blues',
  hint: 'B.B. style sustained bends and fills',
  chordLine: 'A7 · D7 · A7 · E7',
  instrumentId: 'overdriven_guitar',
  notes: [
    { pitch: 57, startBeat: bar(0), durationBeats: 1.5, velocity: 92 },
    { pitch: 59, startBeat: bar(0) + 1.5, durationBeats: 0.5, velocity: 88 },
    { pitch: 57, startBeat: bar(0) + 2.5, durationBeats: 0.5, velocity: 86 },
    { pitch: 50, startBeat: bar(1), durationBeats: 1.5, velocity: 90 },
    { pitch: 52, startBeat: bar(1) + 2, durationBeats: 0.5, velocity: 84 },
    { pitch: 57, startBeat: bar(2), durationBeats: 1.5, velocity: 94 },
    { pitch: 60, startBeat: bar(2) + 2, durationBeats: 0.5, velocity: 88 },
    { pitch: 59, startBeat: bar(3), durationBeats: 0.75, velocity: 96 },
    { pitch: 57, startBeat: bar(3) + 1, durationBeats: 0.25, velocity: 88 },
    { pitch: 56, startBeat: bar(3) + 1.5, durationBeats: 0.25, velocity: 86 },
    { pitch: 54, startBeat: bar(3) + 2, durationBeats: 0.5, velocity: 90 },
  ],
};

const BLUES_8BAR_8: Se2GuitarLoopPreset = {
  id: 'blues_8bar_8',
  genre: 'blues',
  bars: 8,
  label: '12-bar feel',
  hint: 'Eight-bar blues cycle — verse + turnaround',
  chordLine: 'A7×4 · D7×2 · A7 · E7',
  instrumentId: 'overdriven_guitar',
  notes: repeatBars(BLUES_SHUFFLE_4.notes, 2, 4).concat(
    repeatBars(BLUES_TURN_4.notes.slice(0, 8), 1, 4).map((n) => ({ ...n, startBeat: n.startBeat + 16 })),
  ),
};

const ROCK_POWER_4: Se2GuitarLoopPreset = {
  id: 'rock_power_4',
  genre: 'rock',
  bars: 4,
  label: 'Power backbeat',
  hint: 'Rock power chords on 1 and 3',
  chordLine: 'E5 · E5 · A5 · B5',
  instrumentId: 'distortion_guitar',
  notes: [
    ...strum([40, 47], bar(0), 0.5, 118),
    ...strum([40, 47], bar(0) + 2, 0.5, 114),
    ...strum([40, 47], bar(1), 0.5, 116),
    ...strum([40, 47], bar(1) + 2, 0.5, 112),
    ...strum([45, 52], bar(2), 0.5, 120),
    ...strum([45, 52], bar(2) + 2, 0.5, 116),
    ...strum([47, 54], bar(3), 0.5, 122),
    ...strum([47, 54], bar(3) + 2, 0.35, 118),
    { pitch: 47, startBeat: bar(3) + 2.75, durationBeats: 0.25, velocity: 114 },
  ],
};

const ROCK_PALM_4: Se2GuitarLoopPreset = {
  id: 'rock_palm_4',
  genre: 'rock',
  bars: 4,
  label: 'Palm drive',
  hint: 'Driving eighth-note palm mutes',
  chordLine: 'E5 · E5 · A5 · A5',
  instrumentId: 'overdriven_guitar',
  notes: (() => {
    const out: Se2GuitarLoopNote[] = [];
    for (let b = 0; b < 4; b += 1) {
      const root = b < 2 ? 52 : 45;
      for (let e = 0; e < 8; e += 1) {
        out.push({
          pitch: root,
          startBeat: bar(b) + e * 0.5,
          durationBeats: 0.3,
          velocity: e % 2 === 0 ? 112 : 104,
        });
      }
    }
    return out;
  })(),
};

const ROCK_OPEN_4: Se2GuitarLoopPreset = {
  id: 'rock_open_4',
  genre: 'rock',
  bars: 4,
  label: 'Open strum',
  hint: 'Classic rock open-chord rhythm',
  chordLine: 'G · C · G · D',
  instrumentId: 'overdriven_guitar',
  notes: [
    ...strum([43, 47, 50, 55], bar(0), 0.75, 110),
    ...strum([48, 52, 55, 60], bar(1), 0.75, 108),
    ...strum([43, 47, 50, 55], bar(2), 0.75, 112),
    ...strum([50, 54, 57, 62], bar(3), 0.5, 114),
    { pitch: 62, startBeat: bar(3) + 2, durationBeats: 0.35, velocity: 106 },
  ],
};

const ROCK_ANTHEM_8: Se2GuitarLoopPreset = {
  id: 'rock_anthem_8',
  genre: 'rock',
  bars: 8,
  label: 'Arena anthem',
  hint: 'Big eight-bar rock rhythm — chorus energy',
  chordLine: 'G · C · Em · D · G · C · D · G',
  instrumentId: 'distortion_guitar',
  notes: repeatBars(ROCK_OPEN_4.notes, 2, 4).concat(
    repeatBars(ROCK_POWER_4.notes, 1, 4).map((n) => ({ ...n, startBeat: n.startBeat + 16, velocity: n.velocity - 4 })),
  ),
};

export const SE2_GUITAR_LOOP_PRESETS: readonly Se2GuitarLoopPreset[] = [
  ...SE2_GUITAR_MELODIC_LOOP_PRESETS,
  ...SE2_GUITAR_POP_LOOP_PRESETS,
  ...SE2_GUITAR_RNB_POP_BATCH_PRESETS,
  ...SE2_GUITAR_GENRE_BATCH_PRESETS,
  RNB_QUIET_STORM_4,
  RNB_NEO_VAMP_4,
  RNB_GOSPEL_4,
  RNB_SLOW_JAM_8,
  COUNTRY_TRAVIS_4,
  COUNTRY_BALLAD_4,
  COUNTRY_HONKY_4,
  COUNTRY_ROAD_8,
  FUNK_POCKET_4,
  FUNK_STAB_4,
  FUNK_SLAP_4,
  FUNK_TOWER_8,
  BLUES_SHUFFLE_4,
  BLUES_TURN_4,
  BLUES_SLOW_4,
  BLUES_8BAR_8,
  ROCK_POWER_4,
  ROCK_PALM_4,
  ROCK_OPEN_4,
  ROCK_ANTHEM_8,
];

export function se2GuitarLoopGenreMeta(genre: Se2GuitarLoopGenre): Se2GuitarLoopGenreOption {
  return SE2_GUITAR_LOOP_GENRES.find((g) => g.id === genre) ?? SE2_GUITAR_LOOP_GENRES[0]!;
}

export function se2GuitarLoopPresetsForGenre(
  genre: Se2GuitarLoopGenre,
  bars?: Se2GuitarPartBars,
): readonly Se2GuitarLoopPreset[] {
  if (bars === 12) {
    return SE2_GUITAR_LOOP_PRESETS.filter(
      (p) => p.genre === genre && (p.bars === 4 || p.bars === 8),
    );
  }
  return SE2_GUITAR_LOOP_PRESETS.filter((p) => p.genre === genre && (bars == null || p.bars === bars));
}

export function se2GuitarLoopPresetCountByGenre(
  genre: Se2GuitarLoopGenre,
  bars?: Se2GuitarPartBars,
): number {
  return se2GuitarLoopPresetsForGenre(genre, bars).length;
}

export function se2GuitarLoopPresetById(id: string): Se2GuitarLoopPreset | undefined {
  return SE2_GUITAR_LOOP_PRESETS.find((p) => p.id === id);
}

export function se2GuitarLoopNotesAtBar(
  preset: Se2GuitarLoopPreset,
  barIndex: number,
  beatsPerBar: number,
): Se2GuitarLoopNote[] {
  const offset = Math.max(0, barIndex) * beatsPerBar;
  return preset.notes.map((n) => ({
    ...n,
    startBeat: n.startBeat + offset,
  }));
}
