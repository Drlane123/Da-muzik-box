/**
 * Pure disco drum grids — Donna Summer / Saturday Night Fever / Earl Young lineage.
 *
 * Four-on-the-floor kick, snare on 2 & 4, 8th closed hats, open hat on the & (offbeats).
 *
 * Row layout: 0=Kick  1=Snare  2=Clap  3=Hat  4=OH  5=Tom  6=TomLo  7=Rim/Perc
 * Steps 0,4,8,12 = beats 1–4 @ 16ths.
 */

/** Kick on every quarter — the disco pulse. */
export function discoKickFourOnFloor(): ReadonlyArray<[number, number]> {
  return [
    [0, 0], [0, 4], [0, 8], [0, 12],
  ];
}

/** Tight snare on beats 2 & 4 (steps 4 & 12). */
export function discoSnare24(): ReadonlyArray<[number, number]> {
  return [
    [1, 4], [1, 12],
  ];
}

/** Snare + clap stacked on 2 & 4 — SNF backbeat punch. */
export function discoBackbeatStack(): ReadonlyArray<[number, number]> {
  return [
    [1, 4], [1, 12],
    [2, 4], [2, 12],
  ];
}

/** Straight 8th closed hats. */
export function discoHats8(): ReadonlyArray<[number, number]> {
  return [0, 2, 4, 6, 8, 10, 12, 14].map((s) => [3, s] as [number, number]);
}

/** Running 16th closed hats — mirror-ball shimmer. */
export function discoHats16(): ReadonlyArray<[number, number]> {
  return Array.from({ length: 16 }, (_, s) => [3, s] as [number, number]);
}

/** Open hat on every & — signature disco lift (steps 2, 6, 10, 14). */
export function discoOhOffbeats(): ReadonlyArray<[number, number]> {
  return [
    [4, 2], [4, 6], [4, 10], [4, 14],
  ];
}

/** Cross-stick / rim texture on the backbeat (disco-funk layer). */
export function discoRimBackbeat(): ReadonlyArray<[number, number]> {
  return [
    [7, 4], [7, 12],
  ];
}

/** Shaker / cabasa on 2 & 4 — roller-rink floor shimmer. */
export function discoShakerBackbeat(): ReadonlyArray<[number, number]> {
  return [
    [7, 4], [7, 12],
  ];
}

/** Classic Donna Summer / SNF pocket @ ~118–124 BPM. */
export function discoClassicPocket(): ReadonlyArray<[number, number]> {
  return [
    ...discoKickFourOnFloor(),
    ...discoBackbeatStack(),
    ...discoHats8(),
    ...discoOhOffbeats(),
  ];
}

/** Mirror Ball B — 16th hat shimmer + offbeat open hats. */
export function discoMirrorBallShimmer(): ReadonlyArray<[number, number]> {
  return [
    ...discoKickFourOnFloor(),
    ...discoBackbeatStack(),
    ...discoHats16(),
    ...discoOhOffbeats(),
  ];
}

/** Boogie Down — four-on-floor + & of 2 kick push, rim on backbeat. */
export function discoBoogieDownPocket(): ReadonlyArray<[number, number]> {
  return [
    ...discoKickFourOnFloor(),
    [0, 6],
    ...discoBackbeatStack(),
    ...discoHats8(),
    ...discoOhOffbeats(),
    ...discoRimBackbeat(),
  ];
}

/** Roller Rink — pure floor + shaker on the snare beats. */
export function discoRollerRinkPocket(): ReadonlyArray<[number, number]> {
  return [
    ...discoKickFourOnFloor(),
    ...discoBackbeatStack(),
    ...discoHats8(),
    ...discoOhOffbeats(),
    ...discoShakerBackbeat(),
  ];
}

/** Broken 16th hats — 1-e-&, 2-e-& (classic disco syncopation). */
export function discoHatsBroken16(): ReadonlyArray<[number, number]> {
  return [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14].map((s) => [3, s] as [number, number]);
}

/** Cowbell on beats 1 & 3 — Studio 54 glitter. */
export function discoCowbellOneThree(): ReadonlyArray<[number, number]> {
  return [
    [7, 0], [7, 8],
  ];
}

/** Boogie kick pushes on & of 2 and & of 4. */
export function discoKickBoogiePush(): ReadonlyArray<[number, number]> {
  return [
    [0, 6], [0, 14],
  ];
}

/** Tom lift into bar 2 — peak / anthem accent. */
export function discoTomLift(): ReadonlyArray<[number, number]> {
  return [
    [5, 15],
  ];
}

/** Saturday Night — SNF anthem floor + shaker glitter. */
export function discoSaturdayNightPocket(): ReadonlyArray<[number, number]> {
  return [
    ...discoClassicPocket(),
    ...discoShakerBackbeat(),
  ];
}

/** Studio 54 — 16th shimmer + cowbell on 1 & 3. */
export function discoStudio54Pocket(): ReadonlyArray<[number, number]> {
  return [
    ...discoKickFourOnFloor(),
    ...discoBackbeatStack(),
    ...discoHats16(),
    ...discoOhOffbeats(),
    ...discoCowbellOneThree(),
  ];
}

/** Glitter floor — classic pocket + shaker + cowbell sparkle. */
export function discoGlitterFloorPocket(): ReadonlyArray<[number, number]> {
  return [
    ...discoClassicPocket(),
    ...discoShakerBackbeat(),
    ...discoCowbellOneThree(),
  ];
}

/** Hi-NRG — fast shimmer, shaker drive. */
export function discoHiNrgPocket(): ReadonlyArray<[number, number]> {
  return [
    ...discoKickFourOnFloor(),
    ...discoBackbeatStack(),
    ...discoHats16(),
    ...discoOhOffbeats(),
    ...discoShakerBackbeat(),
  ];
}

/** Bridge tunnel — boogie kicks + broken 16ths + rim texture. */
export function discoBridgeTunnelPocket(): ReadonlyArray<[number, number]> {
  return [
    ...discoKickFourOnFloor(),
    ...discoKickBoogiePush(),
    ...discoBackbeatStack(),
    ...discoHatsBroken16(),
    ...discoOhOffbeats(),
    ...discoRimBackbeat(),
  ];
}

/** Peak lift — classic floor + tom fill + shaker. */
export function discoPeakLiftPocket(): ReadonlyArray<[number, number]> {
  return [
    ...discoClassicPocket(),
    ...discoTomLift(),
    ...discoShakerBackbeat(),
  ];
}

/** Disco drive — boogie kick + broken hats, full & open lift. */
export function discoDrivePocket(): ReadonlyArray<[number, number]> {
  return [
    ...discoKickFourOnFloor(),
    ...discoKickBoogiePush(),
    ...discoBackbeatStack(),
    ...discoHatsBroken16(),
    ...discoOhOffbeats(),
  ];
}

/** Bloom — roller rink + rim backbeat layer. */
export function discoBloomPocket(): ReadonlyArray<[number, number]> {
  return [
    ...discoRollerRinkPocket(),
    ...discoRimBackbeat(),
  ];
}

/** Bloom+ — mirror shimmer + shaker + cowbell peak. */
export function discoBloomPlusPocket(): ReadonlyArray<[number, number]> {
  return [
    ...discoMirrorBallShimmer(),
    ...discoShakerBackbeat(),
    ...discoCowbellOneThree(),
  ];
}

/** Heat — hi-NRG shimmer + rim punch. */
export function discoHeatPocket(): ReadonlyArray<[number, number]> {
  return [
    ...discoHiNrgPocket(),
    ...discoRimBackbeat(),
  ];
}
