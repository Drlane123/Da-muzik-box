/**
 * Dance / club drum grids — disco–hip-hop pocket (In Da Club / MJ bounce lineage).
 *
 * Not four-on-the-floor house: syncopated kick on 3·8·11·16, snare on 2 & 4.
 *
 * Row layout: 0=Kick  1=Snare  2=Clap  3=Hat  4=OH  5=Tom  6=TomLo  7=Rim/Perc
 * Steps 0,4,8,12 = beats 1–4 @ 16ths.
 */

/** In Da Club bounce kick — steps 3, 8, 11, 16 (1-indexed 16ths). */
export function danceInDaClubKick(): ReadonlyArray<[number, number]> {
  return [
    [0, 2],
    [0, 7],
    [0, 10],
    [0, 15],
  ];
}

/** Snare + clap stacked on backbeat (steps 4 & 12). */
export function danceBackbeatStack(): ReadonlyArray<[number, number]> {
  return [
    [1, 4], [1, 12],
    [2, 4], [2, 12],
  ];
}

/** Straight 8th closed hats. */
export function danceHats8(): ReadonlyArray<[number, number]> {
  return [0, 2, 4, 6, 8, 10, 12, 14].map((s) => [3, s] as [number, number]);
}

/** Shaker / maraca layer on the snare (In Da Club maraca on backbeat). */
export function danceShakerBackbeat(): ReadonlyArray<[number, number]> {
  return [
    [7, 4],
    [7, 12],
  ];
}

/** Full In Da Club–style club pocket @ ~90 BPM. */
export function danceInDaClubPocket(): ReadonlyArray<[number, number]> {
  return [
    ...danceInDaClubKick(),
    ...danceBackbeatStack(),
    ...danceHats8(),
    ...danceShakerBackbeat(),
  ];
}
