/**
 * Beat Lab Pattern Bank — Afro, Reggae, and Up Tempo (booty-bass) drum grids.
 * 16th-note steps (0–15 = one 4/4 bar). Tempo locked per pattern via `bpm`.
 *
 * Rows: 0=Kick  1=Snare  2=Clap  3=Hi-Hat  4=Open Hat  5=TomHi  6=TomLo  7=Rim
 */

import type { PatternPreset } from '@/app/lib/patternPresets';
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';

const S = 16;

function grid(hits: ReadonlyArray<[number, number]>): boolean[][] {
  const g: boolean[][] = Array.from({ length: 8 }, () => new Array<boolean>(S).fill(false));
  for (const [row, step] of hits) {
    if (row >= 0 && row < 8 && step >= 0 && step < S) g[row]![step] = true;
  }
  return g;
}

function hats8(): ReadonlyArray<[number, number]> {
  return [0, 2, 4, 6, 8, 10, 12, 14].map((s) => [3, s] as [number, number]);
}

function hats16(): ReadonlyArray<[number, number]> {
  const out: [number, number][] = [];
  for (let s = 0; s < S; s++) out.push([3, s]);
  return out;
}

function offbeatHats(): ReadonlyArray<[number, number]> {
  return [2, 6, 10, 14].map((s) => [3, s] as [number, number]);
}

/** Old-school Miami snare — locked 2 & 4 only, never doubled with kick. */
function miamiSnareLock(): ReadonlyArray<[number, number]> {
  return [
    [1, 4],
    [1, 12],
  ];
}

/** @deprecated use miamiSnareLock */
function snareBack(): ReadonlyArray<[number, number]> {
  return miamiSnareLock();
}

/** Clap on 2 & 4 — used on later up-tempo patterns only. */
function clapBack(): ReadonlyArray<[number, number]> {
  return [
    [2, 4],
    [2, 12],
  ];
}

/** Steady 8th hats — skips beats 2 & 4 so the snare stays clean. */
function miamiHats8(): ReadonlyArray<[number, number]> {
  return [0, 2, 6, 8, 10, 14].map((s) => [3, s] as [number, number]);
}

/** Light hat pocket — every other 8th, never on the snare steps. */
function miamiHatsLite(): ReadonlyArray<[number, number]> {
  return [0, 2, 8, 10].map((s) => [3, s] as [number, number]);
}

/** Minimal hats — quarter feel off the backbeat. */
function miamiHatsMin(): ReadonlyArray<[number, number]> {
  return [0, 2, 8, 10].map((s) => [3, s] as [number, number]);
}

/** Single cowbell accent — one hit per bar, not a percussion layer. */
function miamiBellOnce(step: number): ReadonlyArray<[number, number]> {
  return [[7, step]];
}

/** Jerky 16th hats with short rests — classic up-tempo bounce (not machine-gun house). */
function jerkyHats(): ReadonlyArray<[number, number]> {
  return [0, 2, 4, 6, 9, 10, 12, 14].map((s) => [3, s] as [number, number]);
}

/** Classic Miami bass kick — sync 808 on 1, the & of 2, 3, and the & of 4 (snare stays open). */
function miamiKickStation(): ReadonlyArray<[number, number]> {
  return [
    [0, 0],
    [0, 6],
    [0, 9],
    [0, 14],
  ];
}

/** Bouncy club kick — old-school booty phrase, clears steps 4 & 12 for snare. */
function miamiKickBounce(): ReadonlyArray<[number, number]> {
  return [
    [0, 0],
    [0, 3],
    [0, 6],
    [0, 10],
    [0, 14],
  ];
}

/** Parade bounce — staggered Miami kick, room before each snare hit. */
function miamiKickParade(): ReadonlyArray<[number, number]> {
  return [
    [0, 0],
    [0, 3],
    [0, 7],
    [0, 10],
  ];
}

/** Electro pulse — tight sync kick with late-bar push (never on 2 & 4). */
function miamiKickPulse(): ReadonlyArray<[number, number]> {
  return [
    [0, 0],
    [0, 5],
    [0, 8],
    [0, 11],
  ];
}

/** Thunder pocket — heavy staggered 808, snare steps left empty on kick row. */
function miamiKickThunder(): ReadonlyArray<[number, number]> {
  return [
    [0, 0],
    [0, 6],
    [0, 9],
    [0, 11],
    [0, 14],
  ];
}

/** Low 808 body mirror — bass tail on key downbeats (& lane 5 in Beat Lab). */
function miamiSubBody(steps: readonly number[]): ReadonlyArray<[number, number]> {
  return steps.map((s) => [6, s] as [number, number]);
}

/** Cowbell / rim electro layer — Miami club percussion. */
function cowbellMiami(): ReadonlyArray<[number, number]> {
  return [
    [7, 1],
    [7, 5],
    [7, 9],
    [7, 13],
  ];
}

/** Rim/cowbell off-beats — electro booty-bass percussion layer. */
function rimOffbeats(): ReadonlyArray<[number, number]> {
  return [2, 6, 10, 14].map((s) => [7, s] as [number, number]);
}

export const BEAT_LAB_AFRO_PATTERNS: readonly PatternPreset[] = [
  {
    id: 'afro-01', name: 'Lagos Pulse', genre: 'Afro', role: 'drums', bpm: 105,
    desc: 'Naija pocket — sync kick, snare 2 & 4, shaker 8ths, rim push',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 13], [1, 4], [1, 12], ...hats8(), [7, 2], [7, 10],
    ]),
  },
  {
    id: 'afro-02', name: 'Naija Bounce', genre: 'Afro', role: 'drums', bpm: 102,
    desc: 'Bouncy kick phrase — clap stack on 2 & 4, open hat lift',
    pattern: grid([
      [0, 0], [0, 3], [0, 7], [0, 11], [2, 4], [2, 12], ...hats8(), [4, 6], [4, 14],
    ]),
  },
  {
    id: 'afro-03', name: 'Accra Swing', genre: 'Afro', role: 'drums', bpm: 100,
    desc: 'Highlife swing — kick on 1 & late-3, cross-stick, tom accent',
    pattern: grid([
      [0, 0], [0, 10], [0, 14], [1, 4], [1, 12], ...hats8(), [5, 3], [5, 11], [7, 6],
    ]),
  },
  {
    id: 'afro-04', name: 'Amapiano Skitter', genre: 'Afro', role: 'drums', bpm: 110,
    desc: 'Log-drum rim pattern — sparse kick, skitter hats, perc fills',
    pattern: grid([
      [0, 0], [0, 8], [0, 13], [2, 4], [2, 12],
      [3, 0], [3, 3], [3, 4], [3, 7], [3, 8], [3, 11], [3, 12], [3, 15],
      [7, 2], [7, 6], [7, 10], [7, 14],
    ]),
  },
  {
    id: 'afro-05', name: 'Highlife Pocket', genre: 'Afro', role: 'drums', bpm: 98,
    desc: 'Classic highlife — four-on kick lite, snare backbeat, rim answers',
    pattern: grid([
      [0, 0], [0, 4], [0, 8], [0, 12], [1, 4], [1, 12], ...hats8(), [7, 3], [7, 11],
    ]),
  },
  {
    id: 'afro-06', name: 'Makosa Drive', genre: 'Afro', role: 'drums', bpm: 104,
    desc: 'Makosa drive — syncopated kick 3+3+2 feel, clap on the &',
    pattern: grid([
      [0, 0], [0, 3], [0, 6], [0, 8], [0, 11], [0, 14],
      [2, 4], [2, 12], ...hats8(), [5, 7], [7, 15],
    ]),
  },
  {
    id: 'afro-07', name: 'Burna Pressure', genre: 'Afro', role: 'drums', bpm: 108,
    desc: 'Afro-fusion pressure — heavy kick, stacked clap, 16th hat roll',
    pattern: grid([
      [0, 0], [0, 5], [0, 8], [0, 13], [2, 4], [2, 12], ...hats16(), [4, 10],
    ]),
  },
  {
    id: 'afro-08', name: 'Wizkid Glide', genre: 'Afro', role: 'drums', bpm: 100,
    desc: 'Smooth afropop — lean kick, soft snare, offbeat open hat',
    pattern: grid([
      [0, 0], [0, 7], [0, 10], [1, 4], [1, 12], ...offbeatHats(), [4, 2], [4, 10],
    ]),
  },
  {
    id: 'afro-09', name: 'Afro Pop Clap', genre: 'Afro', role: 'drums', bpm: 106,
    desc: 'Pop clap stack — kick sync, double clap tail, rim shakers',
    pattern: grid([
      [0, 0], [0, 6], [0, 11], [2, 4], [2, 12], [2, 13],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [7, 1], [7, 9],
    ]),
  },
  {
    id: 'afro-10', name: 'Shaku Shaku', genre: 'Afro', role: 'drums', bpm: 112,
    desc: 'Street dance pocket — rim-forward, kick behind the grid',
    pattern: grid([
      [0, 0], [0, 4], [0, 10], [2, 4], [2, 12],
      [3, 0], [3, 4], [3, 8], [3, 12],
      [7, 2], [7, 3], [7, 6], [7, 7], [7, 10], [7, 11], [7, 14], [7, 15],
    ]),
  },
  {
    id: 'afro-11', name: 'Gqom Stomp', genre: 'Afro', role: 'drums', bpm: 118,
    desc: 'SA gqom stomp — minimal kick, hard clap, sparse hat gaps',
    pattern: grid([
      [0, 0], [0, 8], [0, 14], [2, 4], [2, 12],
      [3, 0], [3, 4], [3, 8], [3, 12], [3, 14], [3, 15],
      [6, 0], [6, 8],
    ]),
  },
  {
    id: 'afro-12', name: 'Coupé-Décalé', genre: 'Afro', role: 'drums', bpm: 108,
    desc: 'Ivorian coupe — bouncy kick, tom hits, clap on 2 & 4',
    pattern: grid([
      [0, 0], [0, 5], [0, 10], [2, 4], [2, 12], ...hats8(),
      [5, 3], [5, 11], [6, 7],
    ]),
  },
  {
    id: 'afro-13', name: 'Azonto Snap', genre: 'Afro', role: 'drums', bpm: 104,
    desc: 'Ghana azonto — tight rim snaps, sync kick, clap layer',
    pattern: grid([
      [0, 0], [0, 6], [0, 13], [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [7, 1], [7, 5], [7, 9], [7, 13],
    ]),
  },
  {
    id: 'afro-14', name: 'Afro Dembow', genre: 'Afro', role: 'drums', bpm: 98,
    desc: 'Dembow-influenced afro — 3+3+2 kick, snare every downbeat',
    pattern: grid([
      [0, 0], [0, 3], [0, 6], [0, 8], [0, 11], [0, 14],
      [1, 0], [1, 4], [1, 8], [1, 12], ...hats8(),
    ]),
  },
  {
    id: 'afro-15', name: 'Drum Talk', genre: 'Afro', role: 'drums', bpm: 100,
    desc: 'Talking drum feel — rim melody, kick anchors, sparse snare',
    pattern: grid([
      [0, 0], [0, 8], [1, 12],
      [3, 0], [3, 4], [3, 8], [3, 12],
      [7, 2], [7, 4], [7, 6], [7, 10], [7, 12], [7, 14],
    ]),
  },
  {
    id: 'afro-16', name: 'Palm Wine', genre: 'Afro', role: 'drums', bpm: 96,
    desc: 'Laid-back palm wine — soft kick, brush snare, gentle 8ths',
    pattern: grid([
      [0, 0], [0, 10], [1, 4], [1, 12], ...hats8(), [7, 6], [7, 14],
    ]),
  },
  {
    id: 'afro-17', name: 'Afropop Stack', genre: 'Afro', role: 'drums', bpm: 103,
    desc: 'Radio afropop — four-on-lite kick, clap stack, open hat &',
    pattern: grid([
      [0, 0], [0, 4], [0, 8], [0, 12], [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [4, 2], [4, 6], [4, 10], [4, 14],
    ]),
  },
  {
    id: 'afro-18', name: 'Kompa Skank', genre: 'Afro', role: 'drums', bpm: 100,
    desc: 'Kompa/Haitian skank — offbeat kick, rim chord stabs',
    pattern: grid([
      [0, 0], [0, 6], [0, 14], [2, 4], [2, 12], ...offbeatHats(),
      [7, 3], [7, 7], [7, 11], [7, 15],
    ]),
  },
  {
    id: 'afro-19', name: 'Soukous Run', genre: 'Afro', role: 'drums', bpm: 107,
    desc: 'Congolese soukous — running hats, tom flams, sync kick',
    pattern: grid([
      [0, 0], [0, 3], [0, 7], [0, 10], [1, 4], [1, 12], ...hats16(),
      [5, 6], [5, 14], [6, 11],
    ]),
  },
  {
    id: 'afro-20', name: 'Mbalax March', genre: 'Afro', role: 'drums', bpm: 109,
    desc: 'Senegalese mbalax — sabar rim, driving kick, clap accents',
    pattern: grid([
      [0, 0], [0, 4], [0, 8], [0, 11], [2, 4], [2, 12],
      [3, 0], [3, 4], [3, 8], [3, 12],
      [7, 1], [7, 3], [7, 5], [7, 7], [7, 9], [7, 11], [7, 13], [7, 15],
    ]),
  },
  {
    id: 'afro-21', name: 'Island Afro', genre: 'Afro', role: 'drums', bpm: 101,
    desc: 'Carib-afro blend — lazy kick, cross-stick, shaker grid',
    pattern: grid([
      [0, 0], [0, 8], [0, 13], [1, 4], [1, 12], ...hats8(), [5, 5], [7, 10],
    ]),
  },
  {
    id: 'afro-22', name: 'Club Afrique', genre: 'Afro', role: 'drums', bpm: 105,
    desc: 'Club-ready afro — punchy kick, clap 2 & 4, 16th hat drive',
    pattern: grid([
      [0, 0], [0, 5], [0, 8], [0, 13], [2, 4], [2, 12], ...hats16(), [4, 7], [4, 15],
    ]),
  },
];

export const BEAT_LAB_REGGAE_PATTERNS: readonly PatternPreset[] = [
  {
    id: 'reggae-01', name: 'One Drop Classic', genre: 'Reggae', role: 'drums', bpm: 88,
    desc: 'Roots one-drop — kick 1 & 3, snare on 3 only, offbeat skank hat',
    pattern: grid([
      [0, 0], [0, 8], [1, 8], ...offbeatHats(), [7, 4], [7, 12],
    ]),
  },
  {
    id: 'reggae-02', name: 'Rockers Steady', genre: 'Reggae', role: 'drums', bpm: 92,
    desc: 'Rockers — four-on kick, snare 2 & 4, steady 8th hats',
    pattern: grid([
      [0, 0], [0, 4], [0, 8], [0, 12], [1, 4], [1, 12], ...hats8(),
    ]),
  },
  {
    id: 'reggae-03', name: 'Steppers Floor', genre: 'Reggae', role: 'drums', bpm: 96,
    desc: 'Steppers — full four-on kick and snare, driving 8ths',
    pattern: grid([
      [0, 0], [0, 4], [0, 8], [0, 12], [1, 4], [1, 12], [2, 4], [2, 12], ...hats8(),
    ]),
  },
  {
    id: 'reggae-04', name: 'Dancehall Push', genre: 'Reggae', role: 'drums', bpm: 100,
    desc: 'Dancehall push — sync kick, clap stack, rim bounces',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [7, 3], [7, 11],
    ]),
  },
  {
    id: 'reggae-05', name: 'Dub Space', genre: 'Reggae', role: 'drums', bpm: 84,
    desc: 'Dub space — sparse one-drop, long gaps, rim echoes',
    pattern: grid([
      [0, 0], [0, 8], [1, 8], [3, 2], [3, 10], [7, 6], [7, 14],
    ]),
  },
  {
    id: 'reggae-06', name: 'Roots Pedal', genre: 'Reggae', role: 'drums', bpm: 86,
    desc: 'Deep roots — kick pedal 1 & 3, cross-stick, minimal hat',
    pattern: grid([
      [0, 0], [0, 8], [1, 8], [3, 6], [3, 14], [7, 2], [7, 10],
    ]),
  },
  {
    id: 'reggae-07', name: 'Reggae Skank', genre: 'Reggae', role: 'drums', bpm: 90,
    desc: 'Skank groove — rim on every &, kick one-drop, open lift',
    pattern: grid([
      [0, 0], [0, 8], [7, 2], [7, 6], [7, 10], [7, 14],
      [3, 0], [3, 4], [3, 8], [3, 12], [4, 6], [4, 14],
    ]),
  },
  {
    id: 'reggae-08', name: 'Bubble Bass', genre: 'Reggae', role: 'drums', bpm: 98,
    desc: 'Bubble/dancehall — bouncy kick, clap on 2 & 4, fast hats',
    pattern: grid([
      [0, 0], [0, 5], [0, 10], [2, 4], [2, 12], ...hats16(),
    ]),
  },
  {
    id: 'reggae-09', name: 'Rub-a-Dub', genre: 'Reggae', role: 'drums', bpm: 94,
    desc: 'Rub-a-dub — heavy snare 3, kick 1 & 3, rim chatter',
    pattern: grid([
      [0, 0], [0, 8], [1, 8], [1, 12],
      [3, 0], [3, 4], [3, 8], [3, 12],
      [7, 2], [7, 6], [7, 10],
    ]),
  },
  {
    id: 'reggae-10', name: 'Studio One', genre: 'Reggae', role: 'drums', bpm: 88,
    desc: 'Studio One feel — tight one-drop, cross-stick backbeat ghost',
    pattern: grid([
      [0, 0], [0, 8], [1, 8], [1, 4],
      ...offbeatHats(), [7, 12],
    ]),
  },
  {
    id: 'reggae-11', name: 'Rocksteady', genre: 'Reggae', role: 'drums', bpm: 82,
    desc: 'Rocksteady slow — lazy kick, snare 2 & 4, brushed 8ths',
    pattern: grid([
      [0, 0], [0, 8], [1, 4], [1, 12], ...hats8(),
    ]),
  },
  {
    id: 'reggae-12', name: 'Nyabinghi', genre: 'Reggae', role: 'drums', bpm: 80,
    desc: 'Nyabinghi ritual — sparse kick, rim triplet feel, open space',
    pattern: grid([
      [0, 0], [0, 8], [7, 0], [7, 5], [7, 10], [7, 15], [3, 4], [3, 12],
    ]),
  },
  {
    id: 'reggae-13', name: 'Ragga Snap', genre: 'Reggae', role: 'drums', bpm: 102,
    desc: 'Ragga snap — fast dancehall kick, clap stack, 16th hats',
    pattern: grid([
      [0, 0], [0, 3], [0, 7], [0, 11], [2, 4], [2, 12], ...hats16(), [7, 6], [7, 14],
    ]),
  },
  {
    id: 'reggae-14', name: 'Ska Upstroke', genre: 'Reggae', role: 'drums', bpm: 104,
    desc: 'Upbeat ska — four-on kick, snare 2 & 4, rim upstroke offbeats',
    pattern: grid([
      [0, 0], [0, 4], [0, 8], [0, 12], [1, 4], [1, 12],
      [7, 2], [7, 6], [7, 10], [7, 14], ...hats8(),
    ]),
  },
  {
    id: 'reggae-15', name: 'Lovers Rock', genre: 'Reggae', role: 'drums', bpm: 76,
    desc: 'Lovers rock slow — soft one-drop, gentle snare, wide space',
    pattern: grid([
      [0, 0], [0, 8], [1, 8], [3, 2], [3, 6], [3, 10], [3, 14],
    ]),
  },
  {
    id: 'reggae-16', name: 'Reggae Gospel', genre: 'Reggae', role: 'drums', bpm: 88,
    desc: 'Gospel reggae — rockers kick, clap layer, open hat praise lift',
    pattern: grid([
      [0, 0], [0, 4], [0, 8], [0, 12], [2, 4], [2, 12], ...hats8(), [4, 0], [4, 8],
    ]),
  },
  {
    id: 'reggae-17', name: 'Island One', genre: 'Reggae', role: 'drums', bpm: 90,
    desc: 'Island one-drop — rim skank, kick 1 & 3, cross-stick fill',
    pattern: grid([
      [0, 0], [0, 8], [1, 8],
      [7, 2], [7, 6], [7, 10], [7, 14],
      [3, 0], [3, 8],
    ]),
  },
  {
    id: 'reggae-18', name: 'Offbeat Rider', genre: 'Reggae', role: 'drums', bpm: 92,
    desc: 'Offbeat rider — hat skank every &, one-drop kick/snare',
    pattern: grid([
      [0, 0], [0, 8], [1, 8], ...offbeatHats(), [7, 4], [7, 12],
    ]),
  },
  {
    id: 'reggae-19', name: 'Kingston Wall', genre: 'Reggae', role: 'drums', bpm: 96,
    desc: 'Wall of sound steppers — four kick, snare+clap stack, 8ths',
    pattern: grid([
      [0, 0], [0, 4], [0, 8], [0, 12], [1, 4], [1, 12], [2, 4], [2, 12], ...hats8(),
    ]),
  },
  {
    id: 'reggae-20', name: 'Dub Delay', genre: 'Reggae', role: 'drums', bpm: 86,
    desc: 'Dub delay pocket — sparse hits, rim aftershocks, open space',
    pattern: grid([
      [0, 0], [0, 8], [1, 8], [7, 3], [7, 11], [3, 6], [4, 14],
    ]),
  },
  {
    id: 'reggae-21', name: 'Stepper Clap', genre: 'Reggae', role: 'drums', bpm: 94,
    desc: 'Stepper with clap — four-on floor, clap 2 & 4, rim accents',
    pattern: grid([
      [0, 0], [0, 4], [0, 8], [0, 12], [2, 4], [2, 12], ...hats8(), [7, 6], [7, 14],
    ]),
  },
  {
    id: 'reggae-22', name: 'Count Snap', genre: 'Reggae', role: 'drums', bpm: 102,
    desc: 'Reggae count snap — sync kick, clap on 2 & 4, fast offbeat rim',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [7, 1], [7, 5], [7, 9], [7, 13],
    ]),
  },
];

export const BEAT_LAB_MIAMI_PATTERNS: readonly PatternPreset[] = [
  {
    id: 'miami-01', name: 'Bass Station', genre: 'Up Tempo', role: 'drums', bpm: 132,
    desc: 'Old-school Miami — sync 808 kick, tight snare 2 & 4, 8th hats off the snare',
    pattern: grid([
      ...miamiKickStation(),
      ...miamiSnareLock(),
      ...miamiHats8(),
      ...miamiBellOnce(10),
    ]),
  },
  {
    id: 'miami-02', name: 'Booty Shake', genre: 'Up Tempo', role: 'drums', bpm: 135,
    desc: 'Booty bounce — classic kick phrase, locked snare 2 & 4, clean 8th hats',
    pattern: grid([
      ...miamiKickBounce(),
      ...miamiSnareLock(),
      ...miamiHats8(),
      ...miamiBellOnce(14),
    ]),
  },
  {
    id: 'miami-03', name: 'Street Parade', genre: 'Up Tempo', role: 'drums', bpm: 138,
    desc: 'Parade pocket — staggered kick, snare 2 & 4 only, light hats',
    pattern: grid([
      ...miamiKickParade(),
      ...miamiSnareLock(),
      ...miamiHatsLite(),
      ...miamiBellOnce(6),
    ]),
  },
  {
    id: 'miami-04', name: 'Electro Pulse', genre: 'Up Tempo', role: 'drums', bpm: 130,
    desc: 'Electro Miami — sync kick pocket, hard snare 2 & 4, sparse hats',
    pattern: grid([
      ...miamiKickPulse(),
      ...miamiSnareLock(),
      ...miamiHatsLite(),
    ]),
  },
  {
    id: 'miami-05', name: '808 Thunder', genre: 'Up Tempo', role: 'drums', bpm: 140,
    desc: 'Thunder pocket — heavy staggered kick, snare 2 & 4, minimal hats',
    pattern: grid([
      ...miamiKickThunder(),
      ...miamiSnareLock(),
      ...miamiHatsMin(),
      ...miamiBellOnce(8),
    ]),
  },
  {
    id: 'miami-06', name: 'Jook Energy', genre: 'Up Tempo', role: 'drums', bpm: 133,
    desc: 'Jook energy — bouncy kick, clap stack, rim push on the &',
    pattern: grid([
      [0, 0], [0, 7], [0, 10], [2, 4], [2, 12], ...hats16(), [7, 3], [7, 11],
    ]),
  },
  {
    id: 'miami-07', name: 'Bottom Club', genre: 'Up Tempo', role: 'drums', bpm: 136,
    desc: 'Club bottom — four-on kick, 16th hat machine, tom accents',
    pattern: grid([
      [0, 0], [0, 4], [0, 8], [0, 12], [2, 4], [2, 12], ...hats16(), [5, 6], [5, 14],
    ]),
  },
  {
    id: 'miami-08', name: 'Fast Hats', genre: 'Up Tempo', role: 'drums', bpm: 142,
    desc: 'Fast pocket — sync kick, full 16th hat run, clap backbeat',
    pattern: grid([
      [0, 0], [0, 6], [0, 11], [2, 4], [2, 12], ...hats16(), [4, 7], [4, 15],
    ]),
  },
  {
    id: 'miami-09', name: 'Orbit Drop', genre: 'Up Tempo', role: 'drums', bpm: 128,
    desc: 'Orbit drop — kick build phrase, clap 2 & 4, open hat turn',
    pattern: grid([
      [0, 0], [0, 8], [0, 10], [0, 14], [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [4, 6], [4, 14],
    ]),
  },
  {
    id: 'miami-10', name: 'Quad Bounce', genre: 'Up Tempo', role: 'drums', bpm: 134,
    desc: 'Quad bounce — double kick push, clap layer, rim fills',
    pattern: grid([
      [0, 0], [0, 3], [0, 8], [0, 11], [2, 4], [2, 12], ...hats16(),
      [7, 5], [7, 13],
    ]),
  },
  {
    id: 'miami-11', name: 'Bass Cannon', genre: 'Up Tempo', role: 'drums', bpm: 139,
    desc: 'Cannon sub — hard kick pattern, clap stack, 16th hat drive to fill',
    pattern: grid([
      [0, 0], [0, 5], [0, 8], [0, 13], [0, 15], [2, 4], [2, 12], ...hats16(), [6, 0], [6, 4],
    ]),
  },
  {
    id: 'miami-12', name: 'Crew Pocket', genre: 'Up Tempo', role: 'drums', bpm: 138,
    desc: 'Classic crew pocket — 808 on 1·7·11, clap backbeat, rolling hats w/ gaps',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], ...clapBack(), ...jerkyHats(), [7, 14], [7, 15],
    ]),
  },
  {
    id: 'miami-13', name: 'Sky Slide', genre: 'Up Tempo', role: 'drums', bpm: 140,
    desc: 'Sky slide bounce — sync kick phrase, clap 2 & 4, open hat turn',
    pattern: grid([
      [0, 0], [0, 7], [0, 10], [0, 14], ...clapBack(), ...hats16(), [4, 6], [4, 14],
    ]),
  },
  {
    id: 'miami-14', name: 'Parade March', genre: 'Up Tempo', role: 'drums', bpm: 136,
    desc: 'Parade march — staggered 808 hits, rim push, clap stack',
    pattern: grid([
      [0, 0], [0, 3], [0, 6], [0, 10], [0, 14], ...clapBack(), ...jerkyHats(), [7, 5], [7, 13],
    ]),
  },
  {
    id: 'miami-15', name: 'Double Push', genre: 'Up Tempo', role: 'drums', bpm: 134,
    desc: 'Double push bounce — double kick push, clap layer, tom low accent',
    pattern: grid([
      [0, 0], [0, 5], [0, 8], [0, 11], [0, 15], ...clapBack(), ...hats16(), [6, 4], [6, 12],
    ]),
  },
  {
    id: 'miami-16', name: 'Club Lean', genre: 'Up Tempo', role: 'drums', bpm: 128,
    desc: 'Club lean pocket — lean sync kick, clap backbeat, offbeat open hat',
    pattern: grid([
      [0, 0], [0, 8], [0, 13], ...clapBack(), ...offbeatHats(), [4, 2], [4, 10], [1, 4], [1, 12],
    ]),
  },
  {
    id: 'miami-17', name: 'Low Slide', genre: 'Up Tempo', role: 'drums', bpm: 130,
    desc: 'Low slide pocket — bouncy 808 phrase, snare+clap layer, jerky hats',
    pattern: grid([
      [0, 0], [0, 3], [0, 7], [0, 11], [1, 4], [2, 4], [2, 12], ...jerkyHats(), [7, 9],
    ]),
  },
  {
    id: 'miami-18', name: 'Club Drive', genre: 'Up Tempo', role: 'drums', bpm: 132,
    desc: 'Club drive bass — sync kick drive, clap 2 & 4, sub tom tail',
    pattern: grid([
      [0, 0], [0, 5], [0, 10], [0, 13], ...clapBack(), ...hats16(), [6, 0], [6, 8], [6, 15],
    ]),
  },
  {
    id: 'miami-19', name: 'Rim Rush', genre: 'Up Tempo', role: 'drums', bpm: 142,
    desc: 'Rim rush — fast sync 808, clap stack, rim roll fill',
    pattern: grid([
      [0, 0], [0, 6], [0, 11], [0, 15], ...clapBack(), ...hats16(), [7, 13], [7, 14], [7, 15],
    ]),
  },
  {
    id: 'miami-20', name: 'Electro Hybrid', genre: 'Up Tempo', role: 'drums', bpm: 135,
    desc: 'Electro hybrid — tight 808, snare+clap hybrid, rim zaps',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 14], [1, 4], [2, 4], [2, 12], ...jerkyHats(), ...rimOffbeats(),
    ]),
  },
  {
    id: 'miami-21', name: 'Sync Generator', genre: 'Up Tempo', role: 'drums', bpm: 137,
    desc: 'Sync generator — hard sync kick hits, clap backbeat, sparse hat gaps',
    pattern: grid([
      [0, 0], [0, 8], [0, 10], [0, 14], ...clapBack(),
      [3, 0], [3, 2], [3, 4], [3, 8], [3, 10], [3, 12], [3, 14], [5, 6],
    ]),
  },
  {
    id: 'miami-22', name: 'Electro Lift', genre: 'Up Tempo', role: 'drums', bpm: 133,
    desc: 'Electro lift — 808 on 1·7·11, clap 2 & 4, open hat lift',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], ...clapBack(), ...hats8(), [4, 7], [4, 15], [7, 3], [7, 11],
    ]),
  },
  {
    id: 'miami-23', name: 'Stagger Bounce', genre: 'Up Tempo', role: 'drums', bpm: 131,
    desc: 'Stagger bounce — stagger kick, clap stack, 16th hat run',
    pattern: grid([
      [0, 0], [0, 5], [0, 8], [0, 13], ...clapBack(), ...hats16(), [2, 13],
    ]),
  },
  {
    id: 'miami-24', name: 'Block Club', genre: 'Up Tempo', role: 'drums', bpm: 136,
    desc: 'Block club bounce — double kick push, rim off-beats, clap backbeat',
    pattern: grid([
      [0, 0], [0, 3], [0, 8], [0, 11], ...clapBack(), ...jerkyHats(), ...rimOffbeats(),
    ]),
  },
  {
    id: 'miami-25', name: 'Sync Build', genre: 'Up Tempo', role: 'drums', bpm: 134,
    desc: 'Sync build ride — sync kick build, clap 2 & 4, tom accent',
    pattern: grid([
      [0, 0], [0, 6], [0, 8], [0, 12], ...clapBack(), ...hats16(), [5, 3], [5, 11],
    ]),
  },
  {
    id: 'miami-26', name: 'Electro Crunk', genre: 'Up Tempo', role: 'drums', bpm: 140,
    desc: 'Electro crunk blend — sync 808 phrase, stacked clap tail, rim drive',
    pattern: grid([
      [0, 0], [0, 5], [0, 8], [0, 13], [0, 15], [2, 4], [2, 12], [2, 13], ...hats16(), [7, 7],
    ]),
  },
  {
    id: 'miami-27', name: 'Roller Rink', genre: 'Up Tempo', role: 'drums', bpm: 118,
    desc: 'Roller rink tempo — slow heavy 808 on 1·7·11, clap backbeat',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], ...clapBack(), ...hats8(), [6, 8], [7, 4], [7, 12],
    ]),
  },
  {
    id: 'miami-28', name: 'Cowbell Route', genre: 'Up Tempo', role: 'drums', bpm: 138,
    desc: '808 cowbell electro — classic 1·7·11 kick, rim bell off-beats, clap 2 & 4',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 14], ...clapBack(), ...jerkyHats(), ...rimOffbeats(),
    ]),
  },
  {
    id: 'miami-29', name: 'Lowrider Sub', genre: 'Up Tempo', role: 'drums', bpm: 145,
    desc: 'Fast booty bass — sync kick rush, clap stack, open hat on the turn',
    pattern: grid([
      [0, 0], [0, 7], [0, 10], [0, 14], [0, 15], ...clapBack(), ...hats16(), [4, 3], [4, 11], [6, 8],
    ]),
  },
];

/** All Up Tempo pattern presets → dedicated TR-808 booty-bass kit (not trap/house pools). */
export const BEAT_LAB_MIAMI_PATTERN_KIT_MAP: Readonly<Partial<Record<string, BeatLabProducerKitId>>> =
  Object.fromEntries(
    BEAT_LAB_MIAMI_PATTERNS.map((p) => [p.id, 'miamiBass808' as const]),
  );

/** B-bank patterns — Afro / Reggae (+ Up Tempo grids live in slot A). */
export const BEAT_LAB_AFRO_REGGAE_MIAMI_PATTERNS: readonly PatternPreset[] = [
  ...BEAT_LAB_AFRO_PATTERNS,
  ...BEAT_LAB_REGGAE_PATTERNS,
  ...BEAT_LAB_MIAMI_PATTERNS,
];

export function isBeatLabAfroReggaeMiamiPattern(presetId: string): boolean {
  return (
    presetId.startsWith('afro-') ||
    presetId.startsWith('reggae-') ||
    presetId.startsWith('miami-')
  );
}
