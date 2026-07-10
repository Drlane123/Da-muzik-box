/**
 * Authentic trap drum grid helpers — Metro / Southside / Studio Brootle pocket.
 *
 * Research-backed traits (130–150 BPM producer grid, half-time kick feel):
 * - Sparse syncopated kicks — beat 1 anchor, picks before beat 3, bar-end doubles
 * - Snap snare on 2 & 4 (steps 4, 12); optional bar-push ghost on 14–15
 * - Two-step hat foundation + 32nd-style burst into bar 4 (steps 12–15)
 * - Open hat on the & of each beat (steps 2, 6, 10, 14)
 * - 808 body locked to kick hits, not a separate four-on-floor
 *
 * Row layout: 0=Kick  1=Snare  2=Clap  3=Hat  4=OH  5=Tom  6=808 body  7=Rim
 * Steps 0,4,8,12 = beats 1–4 in 4/4 @ 16ths.
 */

const S = 16;

function steps(...xs: number[]): ReadonlyArray<[number, number]> {
  return xs.map((s) => [3, s] as [number, number]);
}

function kicks(...xs: number[]): ReadonlyArray<[number, number]> {
  return xs.map((s) => [0, s] as [number, number]);
}

function body808(...xs: number[]): ReadonlyArray<[number, number]> {
  return xs.map((s) => [6, s] as [number, number]);
}

// ── Snare ───────────────────────────────────────────────────────────────────

/** Tight trap snare — locked 2 & 4 (pad 1). */
export function trapSnare24(): ReadonlyArray<[number, number]> {
  return [
    [1, 4],
    [1, 12],
  ];
}

/** Solid backbeat — snare + clap stacked on 2 & 4 only (pads 1 + 2, one hit). */
export function trapBackbeatStack(): ReadonlyArray<[number, number]> {
  return [
    [1, 4], [1, 12],
    [2, 4], [2, 12],
  ];
}

/**
 * Beat Lab base trap drums (no row 6 sub) — Bell Trap reference.
 * Metro kick, snare+clap on 2 & 4, two-step hats → roll, one OH. Users add lows in sound family.
 */
export function trapBaseFormat(): ReadonlyArray<[number, number]> {
  return [
    ...trapKickMetro(),
    ...trapBackbeatStack(),
    ...trapHatsTwoStep(),
    ...trapHatsRollEnd(),
    [4, 14],
  ];
}

/** Base trap with sparse 808 trunk kicks on row 0 (beats 1, 3, & of 4). */
export function trapBaseFormat808Minimal(): ReadonlyArray<[number, number]> {
  return [
    [0, 0], [0, 8], [0, 14],
    ...trapBackbeatStack(),
    ...trapHatsTwoStep(),
    ...trapHatsRollEnd(),
    [4, 14],
  ];
}

/** Half-time trap — snare on beat 3 only (step 8). */
export function trapSnareHalfTime(): ReadonlyArray<[number, number]> {
  return [[1, 8]];
}

/** Future / Metro bar-push — light double before the downbeat. */
export function trapSnareBarPush(): ReadonlyArray<[number, number]> {
  return [[1, 14]];
}

/** Full club snare pocket — 2 & 4 backbeat + bar push + tail (row 1 / pad 1). */
export function trapSnarePocket(): ReadonlyArray<[number, number]> {
  return [
    [1, 4],
    [1, 12],
    [1, 14],
    [1, 15],
  ];
}

// ── Kick ────────────────────────────────────────────────────────────────────

/**
 * Classic sparse trap kick — half-time trunk feel.
 * Beat 1, sync into 3, bar-end pickup (MusicProductionWiki / Studio Brootle).
 */
export function trapKickSparse(): ReadonlyArray<[number, number]> {
  return kicks(0, 10, 14);
}

/** Syncopated pocket — beat 1, & of 2, triplet-lean into 3, late bar. */
export function trapKickSyncopated(): ReadonlyArray<[number, number]> {
  return kicks(0, 6, 10, 11, 14);
}

/** Metro / NI bounce — 1, & of 2, beat 3, & of 4. */
export function trapKickMetro(): ReadonlyArray<[number, number]> {
  return kicks(0, 6, 10, 14);
}

/** Southern bounce — behind-the-grid syncopation. */
export function trapKickSouth(): ReadonlyArray<[number, number]> {
  return kicks(0, 3, 7, 10, 14);
}

/** Lean / late pocket — kicks sit behind the grid. */
export function trapKickLean(): ReadonlyArray<[number, number]> {
  return kicks(0, 7, 10, 14);
}

/** Slide phrase — bar-end roll setup into next bar. */
export function trapKickSlide(): ReadonlyArray<[number, number]> {
  return kicks(0, 3, 8, 11, 13, 14, 15);
}

/** Bar-end kick rush — doubles hats into the downbeat (Studio Brootle pattern 2). */
export function trapKickBarRush(): ReadonlyArray<[number, number]> {
  return kicks(13, 14, 15);
}

/** Minimal two-hit — trunk pressure. */
export function trapKickMinimal(): ReadonlyArray<[number, number]> {
  return kicks(0, 8);
}

// ── Hi-hats ─────────────────────────────────────────────────────────────────

/** Two-step closed hats — trap foundation before rolls (Native Instruments). */
export function trapHatsTwoStep(): ReadonlyArray<[number, number]> {
  return steps(0, 2, 4, 6, 8, 10, 12, 14);
}

/** 8th hats — skips snare-adjacent steps for pocket. */
export function trapHats8(): ReadonlyArray<[number, number]> {
  return steps(0, 2, 6, 8, 10, 14);
}

/** Full 16th closed hats — use sparingly; sounds robotic without velocity. */
export function trapHats16(): ReadonlyArray<[number, number]> {
  const out: [number, number][] = [];
  for (let s = 0; s < S; s++) out.push([3, s]);
  return out;
}

/**
 * Constant 8ths then double-time burst on beat 4 — signature trap rush.
 * Rest of bar steady → steps 12–15 dense (simulates 32nd roll on 16-step grid).
 */
export function trapHatsEightThenRoll(): ReadonlyArray<[number, number]> {
  return steps(0, 2, 4, 6, 8, 10, 12, 13, 14, 15);
}

/**
 * Steady 16ths through beat 3, roll finishes bar — Studio Brootle pattern 1.
 */
export function trapHatsSteadyThenRoll(): ReadonlyArray<[number, number]> {
  const out: [number, number][] = [];
  for (let s = 0; s < 12; s++) out.push([3, s]);
  out.push([3, 12], [3, 13], [3, 14], [3, 15]);
  return out;
}

/** Bar-end hat roll only (beats 3–4). */
export function trapHatsRollEnd(): ReadonlyArray<[number, number]> {
  return steps(12, 13, 14, 15);
}

/** Triplet-lean fill approximation at bar end (galloping push). */
export function trapHatsTripletFill(): ReadonlyArray<[number, number]> {
  return steps(9, 10, 11, 13, 14, 15);
}

// ── Open hat / 808 / rim ────────────────────────────────────────────────────

/** Open hat on & of each beat — groove breathing room. */
export function trapOhGroove(): ReadonlyArray<[number, number]> {
  return [
    [4, 2],
    [4, 6],
    [4, 10],
    [4, 14],
  ];
}

/** Open hat on & of 2 and 4 only — lighter pocket. */
export function trapOh24(): ReadonlyArray<[number, number]> {
  return [
    [4, 6],
    [4, 14],
  ];
}

/** 808 body under beat 1 and 3 — locked to sparse kick. */
export function trap808OneThree(): ReadonlyArray<[number, number]> {
  return body808(0, 8);
}

/** 808 on downbeats — trunk rattle. */
export function trap808Down(): ReadonlyArray<[number, number]> {
  return body808(0, 4, 8, 12);
}

/** 808 follows kick steps — keeps low end tied to pocket. */
export function trap808FollowKick(
  kickHits: ReadonlyArray<[number, number]>,
): ReadonlyArray<[number, number]> {
  return kickHits.map(([_, s]) => [6, s] as [number, number]);
}

/** Light rim ghost on the &s. */
export function trapRimOff(): ReadonlyArray<[number, number]> {
  return [2, 6, 10, 14].map((s) => [7, s] as [number, number]);
}

// ── Composed authentic cores ────────────────────────────────────────────────

/** Canonical trap bar — sparse kick, snap 2&4, 8ths→roll, OH groove, 808 on 1&3. */
export function trapCoreClassic(): ReadonlyArray<[number, number]> {
  return [
    ...trapKickSparse(),
    ...trapSnare24(),
    ...trapHatsEightThenRoll(),
    ...trapOhGroove(),
    ...trap808OneThree(),
  ];
}

/** Metro bounce — sync kick, steady→roll hats, bar-push snare ghost. */
export function trapCoreMetro(): ReadonlyArray<[number, number]> {
  return [
    ...trapKickMetro(),
    ...trapSnare24(),
    ...trapSnareBarPush(),
    ...trapHatsSteadyThenRoll(),
    ...trapOh24(),
    ...trap808FollowKick(trapKickMetro()),
  ];
}

/** Southern bounce — sync kick phrase, triplet hat fill, rim push. */
export function trapCoreSouth(): ReadonlyArray<[number, number]> {
  return [
    ...trapKickSouth(),
    ...trapSnare24(),
    ...trapHatsTwoStep(),
    ...trapHatsTripletFill(),
    ...trapOh24(),
    ...trap808FollowKick(trapKickSouth()),
    ...trapRimOff(),
  ];
}

/** Half-time haze — snare beat 3, rolling hats, sparse kick. */
export function trapCoreHalfTime(): ReadonlyArray<[number, number]> {
  return [
    ...trapKickLean(),
    ...trapSnareHalfTime(),
    ...trapHatsSteadyThenRoll(),
    ...trapOh24(),
    ...trap808OneThree(),
  ];
}

/**
 * ATL / Memphis club bounce — Redd Block pocket.
 * Kick sync into 3 + bar rush, snare locked 2 & 4 + push + tail, 8ths→roll hats.
 */
export function trapAtlMemphisBounce(): ReadonlyArray<[number, number]> {
  return [
    [0, 0], [0, 6], [0, 10], [0, 11],
    ...trapKickBarRush(),
    ...trapSnarePocket(),
    ...trapHatsEightThenRoll(),
    [4, 14],
  ];
}

/** Dirty South club — same pocket as trapAtlMemphisBounce (alias). */
export function trapCoreDirtySouthClub(): ReadonlyArray<[number, number]> {
  return trapAtlMemphisBounce();
}

export function trapCoreClubBounce(): ReadonlyArray<[number, number]> {
  return trapCoreDirtySouthClub();
}

/** Drop finisher — lean kick, roll + open lift, kick bar rush. */
export function trapCoreFinisher(): ReadonlyArray<[number, number]> {
  return [
    ...trapKickLean(),
    ...trapKickBarRush(),
    ...trapSnare24(),
    ...trapSnareBarPush(),
    ...trapHatsTwoStep(),
    ...trapHatsRollEnd(),
    [4, 14],
    [4, 15],
    ...trap808FollowKick(trapKickLean()),
  ];
}
