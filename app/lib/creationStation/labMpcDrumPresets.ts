import { LAB_MPC_PAD_COUNT } from '@/app/lib/creationStation/labMpcKits';

/** All presets are four 4/4 bars at 1/16 resolution (Studio One–style 64 columns). */
export const LAB_DRUM_PRESET_STEP_COUNT = 64;

export interface LabMpcDrumPreset {
  id: string;
  label: string;
  blurb: string;
  /** Starting point for the drum machine local BPM (user can change anytime). */
  suggestedBpm: number;
  /** 16 pads × 64 steps */
  grid: boolean[][];
}

const STEPS = LAB_DRUM_PRESET_STEP_COUNT;

function emptyGrid(): boolean[][] {
  return Array.from({ length: LAB_MPC_PAD_COUNT }, () => Array<boolean>(STEPS).fill(false));
}

function hit(g: boolean[][], row: number, bar: number, slotInBar: number) {
  const si = bar * 16 + (slotInBar & 15);
  if (row >= 0 && row < LAB_MPC_PAD_COUNT && si >= 0 && si < STEPS) g[row]![si] = true;
}

/** trapDark-style rows (see `KIT_TRAP_DARK_PADS`). */
const P = {
  subKick: 0,
  clickKick: 1,
  trapSnare: 2,
  snapSnare: 3,
  ch: 4,
  chTight: 5,
  oh: 6,
  rim: 8,
  clap: 9,
  tomL: 12,
  tomH: 13,
  cow: 14,
} as const;

function cloneGrid(g: boolean[][]): boolean[][] {
  return g.map((row) => [...row]);
}

function presetFourOnFloor(): boolean[][] {
  const g = emptyGrid();
  for (let bar = 0; bar < 4; bar += 1) {
    for (const q of [0, 4, 8, 12]) hit(g, P.subKick, bar, q);
    for (let s = 0; s < 16; s += 2) hit(g, P.ch, bar, s);
  }
  return g;
}

function presetTrapBounce(): boolean[][] {
  const g = emptyGrid();
  for (let bar = 0; bar < 4; bar += 1) {
    hit(g, P.subKick, bar, 0);
    hit(g, P.clickKick, bar, 7);
    hit(g, P.subKick, bar, 10);
    hit(g, P.trapSnare, bar, 4);
    hit(g, P.trapSnare, bar, 12);
    for (let s = 0; s < 16; s += 2) hit(g, P.ch, bar, s);
    if (bar % 2 === 1) hit(g, P.chTight, bar, 14);
  }
  return g;
}

function presetHouseOffbeat(): boolean[][] {
  const g = emptyGrid();
  for (let bar = 0; bar < 4; bar += 1) {
    for (const q of [0, 4, 8, 12]) hit(g, P.subKick, bar, q);
    hit(g, P.ch, bar, 2);
    hit(g, P.ch, bar, 6);
    hit(g, P.ch, bar, 10);
    hit(g, P.ch, bar, 14);
    hit(g, P.clap, bar, 4);
    hit(g, P.clap, bar, 12);
  }
  return g;
}

function presetSlowSparse(): boolean[][] {
  const g = emptyGrid();
  const kicks = [
    [0, 0],
    [0, 8],
    [1, 6],
    [2, 0],
    [2, 10],
    [3, 4],
  ] as const;
  for (const [bar, s] of kicks) hit(g, P.subKick, bar, s);
  for (let bar = 0; bar < 4; bar += 1) {
    hit(g, P.snapSnare, bar, 4);
    hit(g, P.snapSnare, bar, 12);
    hit(g, P.ch, bar, 2);
    hit(g, P.ch, bar, 10);
  }
  return g;
}

function presetDrillHats(): boolean[][] {
  const g = emptyGrid();
  for (let bar = 0; bar < 4; bar += 1) {
    hit(g, P.subKick, bar, 0);
    hit(g, P.subKick, bar, 6);
    hit(g, P.subKick, bar, 11);
    hit(g, P.trapSnare, bar, 4);
    hit(g, P.trapSnare, bar, 12);
    for (let s = 0; s < 16; s += 1) {
      if (s % 2 === 0) hit(g, P.chTight, bar, s);
    }
  }
  return g;
}

function presetOpenHatLift(): boolean[][] {
  const g = emptyGrid();
  for (let bar = 0; bar < 4; bar += 1) {
    for (const q of [0, 4, 8, 12]) hit(g, P.subKick, bar, q);
    for (let s = 0; s < 16; s += 2) hit(g, P.ch, bar, s);
    hit(g, P.oh, bar, 15);
  }
  return g;
}

function presetTomFill(): boolean[][] {
  const g = emptyGrid();
  for (let bar = 0; bar < 3; bar += 1) {
    hit(g, P.subKick, bar, 0);
    hit(g, P.subKick, bar, 8);
    hit(g, P.trapSnare, bar, 4);
    hit(g, P.trapSnare, bar, 12);
    for (let s = 0; s < 16; s += 2) hit(g, P.ch, bar, s);
  }
  const b = 3;
  hit(g, P.subKick, b, 0);
  hit(g, P.trapSnare, b, 4);
  hit(g, P.trapSnare, b, 12);
  hit(g, P.tomL, b, 8);
  hit(g, P.tomH, b, 9);
  hit(g, P.tomL, b, 10);
  hit(g, P.tomH, b, 11);
  hit(g, P.ch, b, 14);
  return g;
}

function presetClapLayer(): boolean[][] {
  const g = emptyGrid();
  for (let bar = 0; bar < 4; bar += 1) {
    for (const q of [0, 4, 8, 12]) hit(g, P.subKick, bar, q);
    hit(g, P.trapSnare, bar, 4);
    hit(g, P.clap, bar, 4);
    hit(g, P.trapSnare, bar, 12);
    hit(g, P.clap, bar, 12);
    for (let s = 0; s < 16; s += 2) hit(g, P.ch, bar, s);
  }
  return g;
}

function presetMinimalTechno(): boolean[][] {
  const g = emptyGrid();
  for (let bar = 0; bar < 4; bar += 1) {
    hit(g, P.subKick, bar, 0);
    hit(g, P.subKick, bar, 8);
    if (bar % 2 === 0) hit(g, P.clickKick, bar, 11);
    hit(g, P.chTight, bar, 4);
    hit(g, P.chTight, bar, 12);
  }
  return g;
}

function presetPhonkSwing(): boolean[][] {
  const g = emptyGrid();
  for (let bar = 0; bar < 4; bar += 1) {
    hit(g, P.subKick, bar, 0);
    hit(g, P.subKick, bar, 3);
    hit(g, P.subKick, bar, 10);
    hit(g, P.trapSnare, bar, 4);
    hit(g, P.rim, bar, 6);
    hit(g, P.trapSnare, bar, 12);
    for (let s = 0; s < 16; s += 4) hit(g, P.ch, bar, s);
    hit(g, P.cow, bar, 14);
  }
  return g;
}

export const LAB_MPC_DRUM_PRESETS: readonly LabMpcDrumPreset[] = [
  {
    id: 'four-floor',
    label: 'Four-on-floor',
    blurb: 'Kick quarters + 8th hats — try at house tempo.',
    suggestedBpm: 124,
    grid: cloneGrid(presetFourOnFloor()),
  },
  {
    id: 'trap-bounce',
    label: 'Trap bounce',
    blurb: 'Classic 808-style kick placement + snare backbeat.',
    suggestedBpm: 140,
    grid: cloneGrid(presetTrapBounce()),
  },
  {
    id: 'house-offbeat',
    label: 'House offbeat',
    blurb: 'Offbeat hats + clap on 2 and 4.',
    suggestedBpm: 122,
    grid: cloneGrid(presetHouseOffbeat()),
  },
  {
    id: 'slow-sparse',
    label: 'Slow sparse',
    blurb: 'Room to practice fills — lower BPM.',
    suggestedBpm: 78,
    grid: cloneGrid(presetSlowSparse()),
  },
  {
    id: 'drill-hats',
    label: 'Drill hats',
    blurb: 'Dense 16th hats + punchy kick/snare.',
    suggestedBpm: 144,
    grid: cloneGrid(presetDrillHats()),
  },
  {
    id: 'open-hat-lift',
    label: 'Open-hat lift',
    blurb: 'End-of-bar open hat on every bar.',
    suggestedBpm: 96,
    grid: cloneGrid(presetOpenHatLift()),
  },
  {
    id: 'tom-fill',
    label: 'Tom fill (bar 4)',
    blurb: 'Simple groove with a tom run on the last bar.',
    suggestedBpm: 100,
    grid: cloneGrid(presetTomFill()),
  },
  {
    id: 'clap-layer',
    label: 'Snare + clap',
    blurb: 'Layered backbeat for weight.',
    suggestedBpm: 110,
    grid: cloneGrid(presetClapLayer()),
  },
  {
    id: 'minimal-techno',
    label: 'Minimal techno',
    blurb: 'Few hits — good for timing practice.',
    suggestedBpm: 128,
    grid: cloneGrid(presetMinimalTechno()),
  },
  {
    id: 'phonk',
    label: 'Phonk-ish',
    blurb: 'Broken kick + rim ghost + cowbell poke.',
    suggestedBpm: 132,
    grid: cloneGrid(presetPhonkSwing()),
  },
];

export function labMpcDrumPresetById(id: string): LabMpcDrumPreset | undefined {
  return LAB_MPC_DRUM_PRESETS.find((p) => p.id === id);
}
