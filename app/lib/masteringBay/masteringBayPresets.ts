export type MasterTab = 'eq' | 'transients' | 'compress' | 'stereo' | 'limit';

/** Extra post-chain loudness into the limiter — off by default. */
export type X1LoudBoost = 0 | 1 | 2;

export type FastMasterState = {
  presetIndex: number;
  activeTab: MasterTab;
  driveDb: number;
  loudTarget: -5 | -6 | -7 | -8 | -9 | -10;
  params: Record<string, number>;
  power: boolean;
  /**
   * Optional loudness notches (always start off):
   * 0 = off, 1 = X1 Loud (+1 notch), 2 = X1 Louder (+2 notches).
   * Drives harder into the limiter without raising the ceiling past safe peak.
   */
  x1LoudBoost: X1LoudBoost;
};

export type BassOneState = {
  power: boolean;
  activeTab: 'sub' | 'drive' | 'tone';
  solo: boolean;
  bypass: boolean;
  sub: boolean;
  modeHeavy: boolean;
  hiFreq: number;
  loCut: number;
  definition: number;
  push: number;
  focus: number;
  output: number;
  drive: number;
  analog: number;
  harmonics: number;
};

export type DaMatchState = {
  power: boolean;
  activeTab: 'match' | 'ref' | 'tone';
  referenceId: string;
  matchAmount: number;
  tone: number;
  dynamics: number;
  loudness: number;
  width: number;
};

/** Optional de-hiss / de-click — not a rack unit; controlled from the preset bar. */
export type DeNoisePlacement = 'before' | 'after';

export type DeNoiseState = {
  /** Off by default — user enables from the De-Noise menu. */
  power: boolean;
  /** Insert before Master X1, or after Master X1 (default). */
  placement: DeNoisePlacement;
  /** Broadband hiss reduction 0–100. */
  hissAmount: number;
  /** High-shelf corner for hiss (Hz). */
  hissFreq: number;
  /** Click / pop catch strength 0–100. */
  clickAmount: number;
  /** De-click threshold (dB). */
  clickThresh: number;
};

export type MasteringBayRackState = {
  fastMaster: FastMasterState;
  bassOne: BassOneState;
  daMatch: DaMatchState;
  deNoise: DeNoiseState;
};

export type MasteringBayPreset = {
  id: string;
  name: string;
  category: string;
  tags: string[];
  state: MasteringBayRackState;
  userOwned?: boolean;
};

const DEFAULT_FAST_PARAMS: Record<string, number> = {
  low: 0, mid: 0, high: 1.2, air: 42, attack: 55, punch: 62, amount: 38, threshold: -8, width: 112, mono: 120, ceiling: -1, release: 130,
};

/** Extra dB into the limiter per X1 loudness notch (ceiling stays put — no red bleed). */
export const X1_LOUD_BOOST_DB: Record<X1LoudBoost, number> = {
  0: 0,
  1: 1.5,
  2: 3.0,
};

export const DEFAULT_RACK_STATE: MasteringBayRackState = {
  fastMaster: {
    presetIndex: 0,
    activeTab: 'limit',
    driveDb: 1.5,
    loudTarget: -6,
    params: { ...DEFAULT_FAST_PARAMS },
    power: true,
    x1LoudBoost: 0,
  },
  bassOne: {
    power: true,
    activeTab: 'sub',
    solo: false,
    bypass: false,
    sub: true,
    modeHeavy: true,
    hiFreq: 180,
    loCut: 42,
    definition: 6,
    push: 7.8,
    focus: 5,
    output: -4.6,
    drive: 4,
    analog: 3,
    harmonics: 5,
  },
  daMatch: {
    power: true,
    activeTab: 'match',
    referenceId: 'streaming',
    matchAmount: 72,
    tone: 50,
    dynamics: 58,
    loudness: 64,
    width: 48,
  },
  deNoise: {
    power: false,
    placement: 'after',
    hissAmount: 28,
    hissFreq: 9000,
    clickAmount: 32,
    clickThresh: -18,
  },
};

/** Da-Muzik Box factory chain presets — yours, not third-party SMART lists. */
export const DA_MUZIK_BOX_PRESETS: MasteringBayPreset[] = [
  {
    id: 'club-ready',
    name: 'Club Ready',
    category: 'DA-MUZIK BOX',
    tags: ['loud', 'dance', 'club'],
    state: {
      fastMaster: { ...DEFAULT_RACK_STATE.fastMaster, driveDb: 0.8, loudTarget: -6, params: { ...DEFAULT_FAST_PARAMS, punch: 78, amount: 52, ceiling: -0.8 } },
      bassOne: { ...DEFAULT_RACK_STATE.bassOne, push: 9.2, modeHeavy: true, sub: true, drive: 6 },
      daMatch: { ...DEFAULT_RACK_STATE.daMatch, matchAmount: 80, loudness: 72, dynamics: 65 },
    },
  },
  {
    id: 'streaming-clean',
    name: 'Streaming Clean',
    category: 'DA-MUZIK BOX',
    tags: ['streaming', 'clean', 'spotify'],
    state: {
      fastMaster: { ...DEFAULT_RACK_STATE.fastMaster, driveDb: -0.5, loudTarget: -8, params: { ...DEFAULT_FAST_PARAMS, high: 0.8, air: 35 } },
      bassOne: { ...DEFAULT_RACK_STATE.bassOne, push: 4.5, modeHeavy: false, output: -3.2 },
      daMatch: { ...DEFAULT_RACK_STATE.daMatch, referenceId: 'streaming', matchAmount: 68, loudness: 58 },
    },
  },
  {
    id: 'warm-low-end',
    name: 'Warm Low End',
    category: 'DA-MUZIK BOX',
    tags: ['warm', 'bass', 'hip-hop'],
    state: {
      fastMaster: { ...DEFAULT_RACK_STATE.fastMaster, driveDb: 0.2, loudTarget: -7, params: { ...DEFAULT_FAST_PARAMS, low: 1.8, mid: -0.5 } },
      bassOne: { ...DEFAULT_RACK_STATE.bassOne, push: 8.5, loCut: 28, definition: 7.5, analog: 6 },
      daMatch: { ...DEFAULT_RACK_STATE.daMatch, tone: 42, width: 38 },
    },
  },
  {
    id: 'radio-loud',
    name: 'Radio Loud',
    category: 'DA-MUZIK BOX',
    tags: ['radio', 'loud', 'competitive'],
    state: {
      fastMaster: { ...DEFAULT_RACK_STATE.fastMaster, driveDb: 1.2, loudTarget: -5, params: { ...DEFAULT_FAST_PARAMS, amount: 62, ceiling: -0.5, punch: 70 } },
      bassOne: { ...DEFAULT_RACK_STATE.bassOne, push: 6, output: -2.8, drive: 5 },
      daMatch: { ...DEFAULT_RACK_STATE.daMatch, matchAmount: 85, loudness: 78, dynamics: 70 },
    },
  },
  {
    id: 'vinyl-warmth',
    name: 'Vinyl Warmth',
    category: 'DA-MUZIK BOX',
    tags: ['vintage', 'warm', 'analog'],
    state: {
      fastMaster: { ...DEFAULT_RACK_STATE.fastMaster, driveDb: 0.4, loudTarget: -9, params: { ...DEFAULT_FAST_PARAMS, low: 1.2, high: -0.8, release: 220 } },
      bassOne: { ...DEFAULT_RACK_STATE.bassOne, analog: 8, harmonics: 7, modeHeavy: false },
      daMatch: { ...DEFAULT_RACK_STATE.daMatch, tone: 35, dynamics: 45, referenceId: 'vintage' },
    },
  },
  {
    id: 'podcast-clear',
    name: 'Podcast Clear',
    category: 'DA-MUZIK BOX',
    tags: ['voice', 'podcast', 'clear'],
    state: {
      fastMaster: { ...DEFAULT_RACK_STATE.fastMaster, driveDb: -1.0, loudTarget: -10, params: { ...DEFAULT_FAST_PARAMS, mid: 1.5, high: 2.0, amount: 28 } },
      bassOne: { ...DEFAULT_RACK_STATE.bassOne, push: 2, loCut: 60, sub: false, bypass: true },
      daMatch: { ...DEFAULT_RACK_STATE.daMatch, matchAmount: 55, loudness: 48, width: 30 },
    },
  },
  // ── Ten more chain-balanced masters (Bass X → DMB Match → Master X1) ──
  {
    id: 'trap-808-punch',
    name: 'Trap 808 Punch',
    category: 'DA-MUZIK BOX',
    tags: ['trap', '808', 'hip-hop'],
    state: {
      // Heavy sub first, moderate match so 808 stays, Master X1 punches without crushing.
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.8,
        loudTarget: -6,
        params: { ...DEFAULT_FAST_PARAMS, low: 1.4, mid: -0.4, high: 0.6, amount: 48, threshold: -10, punch: 82, attack: 42, ceiling: -0.9, release: 110 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 10.5,
        loCut: 24,
        definition: 8.2,
        drive: 7,
        harmonics: 6.5,
        modeHeavy: true,
        sub: true,
        output: -2.5,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'club',
        matchAmount: 70,
        tone: 44,
        dynamics: 52,
        loudness: 68,
        width: 36,
      },
    },
  },
  {
    id: 'rnb-smooth',
    name: 'R&B Smooth',
    category: 'DA-MUZIK BOX',
    tags: ['rnb', 'smooth', 'vocal'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 0.6,
        loudTarget: -8,
        params: { ...DEFAULT_FAST_PARAMS, low: 0.8, mid: 0.6, high: 1.4, amount: 34, threshold: -9, punch: 48, ceiling: -1.2, release: 180 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 5.5,
        loCut: 36,
        definition: 5.5,
        drive: 3,
        analog: 7,
        modeHeavy: false,
        output: -3.5,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming',
        matchAmount: 74,
        tone: 56,
        dynamics: 48,
        loudness: 60,
        width: 52,
      },
    },
  },
  {
    id: 'edm-festival',
    name: 'EDM Festival',
    category: 'DA-MUZIK BOX',
    tags: ['edm', 'festival', 'loud'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 2.2,
        loudTarget: -5,
        params: { ...DEFAULT_FAST_PARAMS, low: 1.0, mid: 0.2, high: 2.0, amount: 58, threshold: -11, punch: 88, width: 140, ceiling: -0.6, release: 90 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 9.8,
        loCut: 30,
        definition: 7,
        drive: 6.5,
        harmonics: 5,
        modeHeavy: true,
        output: -2.0,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'club',
        matchAmount: 82,
        tone: 58,
        dynamics: 68,
        loudness: 80,
        width: 72,
      },
    },
  },
  {
    id: 'hiphop-headroom',
    name: 'Hip-Hop Headroom',
    category: 'DA-MUZIK BOX',
    tags: ['hip-hop', 'streaming', 'punch'],
    state: {
      // Competitive density with streaming-safe ceiling (−1 dBTP).
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.2,
        loudTarget: -7,
        params: { ...DEFAULT_FAST_PARAMS, low: 1.0, mid: 0.3, high: 1.0, amount: 44, threshold: -9, punch: 72, ceiling: -1.0, release: 120 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 8.0,
        loCut: 32,
        definition: 6.8,
        drive: 5,
        modeHeavy: true,
        output: -3.0,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming',
        matchAmount: 76,
        tone: 48,
        dynamics: 55,
        loudness: 66,
        width: 42,
      },
    },
  },
  {
    id: 'indie-dynamic',
    name: 'Indie Dynamic',
    category: 'DA-MUZIK BOX',
    tags: ['indie', 'dynamic', 'open'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 0.4,
        loudTarget: -9,
        params: { ...DEFAULT_FAST_PARAMS, low: 0.2, mid: 0.4, high: 1.6, amount: 26, threshold: -7, punch: 40, ceiling: -1.5, release: 200 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 3.5,
        loCut: 40,
        definition: 4.5,
        drive: 2,
        analog: 4,
        modeHeavy: false,
        output: -4.0,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming',
        matchAmount: 58,
        tone: 54,
        dynamics: 38,
        loudness: 50,
        width: 58,
      },
    },
  },
  {
    id: 'apple-safe',
    name: 'Apple Safe',
    category: 'DA-MUZIK BOX',
    tags: ['apple', 'streaming', 'safe'],
    state: {
      // Quieter integrated target, −2 dBTP for codec headroom.
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 0.2,
        loudTarget: -9,
        params: { ...DEFAULT_FAST_PARAMS, low: 0.3, mid: 0.5, high: 1.2, amount: 30, threshold: -8, punch: 45, ceiling: -2.0, release: 160 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 4.0,
        loCut: 38,
        definition: 5,
        drive: 2.5,
        modeHeavy: false,
        output: -3.8,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming',
        matchAmount: 70,
        tone: 52,
        dynamics: 42,
        loudness: 54,
        width: 46,
      },
    },
  },
  {
    id: 'youtube-punch',
    name: 'YouTube Punch',
    category: 'DA-MUZIK BOX',
    tags: ['youtube', 'video', 'punch'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.4,
        loudTarget: -7,
        params: { ...DEFAULT_FAST_PARAMS, low: 0.6, mid: 0.8, high: 1.8, amount: 46, threshold: -10, punch: 74, ceiling: -1.0, release: 100 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 6.5,
        loCut: 34,
        definition: 6,
        drive: 4.5,
        modeHeavy: true,
        output: -3.2,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming',
        matchAmount: 78,
        tone: 55,
        dynamics: 60,
        loudness: 70,
        width: 50,
      },
    },
  },
  {
    id: 'drill-dark',
    name: 'Drill Dark',
    category: 'DA-MUZIK BOX',
    tags: ['drill', 'dark', 'uk'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.6,
        loudTarget: -6,
        params: { ...DEFAULT_FAST_PARAMS, low: 2.0, mid: -0.8, high: -0.4, amount: 50, threshold: -10, punch: 76, width: 95, ceiling: -0.9, release: 140 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 11.0,
        loCut: 22,
        definition: 8.5,
        drive: 7.5,
        harmonics: 7,
        focus: 7,
        modeHeavy: true,
        sub: true,
        output: -2.2,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'club',
        matchAmount: 68,
        tone: 32,
        dynamics: 50,
        loudness: 72,
        width: 28,
      },
    },
  },
  {
    id: 'afrobeat-glow',
    name: 'Afrobeat Glow',
    category: 'DA-MUZIK BOX',
    tags: ['afrobeat', 'warm', 'groove'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.0,
        loudTarget: -7,
        params: { ...DEFAULT_FAST_PARAMS, low: 1.2, mid: 0.4, high: 1.6, amount: 40, threshold: -9, punch: 66, width: 128, ceiling: -1.0, release: 150 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 7.2,
        loCut: 30,
        definition: 6.5,
        drive: 4,
        analog: 6.5,
        harmonics: 5.5,
        modeHeavy: false,
        output: -3.0,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming',
        matchAmount: 72,
        tone: 58,
        dynamics: 50,
        loudness: 64,
        width: 62,
      },
    },
  },
  {
    id: 'trailer-impact',
    name: 'Trailer Impact',
    category: 'DA-MUZIK BOX',
    tags: ['trailer', 'cinematic', 'impact'],
    state: {
      // Big low-end hit, wide image, controlled ceiling so peaks stay clean.
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 2.0,
        loudTarget: -6,
        params: { ...DEFAULT_FAST_PARAMS, low: 2.2, mid: 0.0, high: 1.0, amount: 54, threshold: -12, punch: 90, attack: 35, width: 150, ceiling: -0.8, release: 80 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 10.0,
        loCut: 26,
        definition: 7.8,
        drive: 6,
        harmonics: 6,
        modeHeavy: true,
        sub: true,
        output: -1.8,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'cd',
        matchAmount: 75,
        tone: 46,
        dynamics: 62,
        loudness: 76,
        width: 68,
      },
    },
  },
  // ── Genre masters: Pop, R&B ×2, Trap, K-pop, Up-tempo Dance ──
  {
    id: 'pop-master',
    name: 'Pop Master',
    category: 'DA-MUZIK BOX',
    tags: ['pop', 'radio', 'streaming'],
    state: {
      // Bright top, controlled low, streaming-safe ceiling — vocal-forward pop.
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.1,
        loudTarget: -7,
        activeTab: 'limit',
        params: {
          ...DEFAULT_FAST_PARAMS,
          low: 0.4,
          mid: 0.9,
          high: 2.0,
          amount: 42,
          threshold: -9,
          punch: 64,
          width: 118,
          ceiling: -1.0,
          release: 115,
        },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 5.8,
        loCut: 38,
        definition: 5.8,
        drive: 3.5,
        analog: 4,
        modeHeavy: false,
        sub: true,
        output: -3.4,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming',
        matchAmount: 76,
        tone: 58,
        dynamics: 54,
        loudness: 66,
        width: 54,
      },
    },
  },
  {
    id: 'rnb-velvet',
    name: 'R&B Velvet',
    category: 'DA-MUZIK BOX',
    tags: ['rnb', 'velvet', 'smooth'],
    state: {
      // Soft, warm, intimate — slower release, analog bass, gentle match.
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 0.5,
        loudTarget: -8,
        activeTab: 'limit',
        params: {
          ...DEFAULT_FAST_PARAMS,
          low: 1.0,
          mid: 0.5,
          high: 1.1,
          amount: 32,
          threshold: -8,
          punch: 44,
          attack: 60,
          width: 108,
          ceiling: -1.2,
          release: 210,
        },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 5.2,
        loCut: 34,
        definition: 5.2,
        drive: 2.8,
        analog: 8,
        harmonics: 6,
        modeHeavy: false,
        output: -3.6,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'vintage',
        matchAmount: 70,
        tone: 40,
        dynamics: 42,
        loudness: 56,
        width: 48,
      },
    },
  },
  {
    id: 'rnb-urban',
    name: 'R&B Urban',
    category: 'DA-MUZIK BOX',
    tags: ['rnb', 'urban', 'contemporary'],
    state: {
      // Punchier contemporary R&B — more sub, tighter limit, wider image.
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.3,
        loudTarget: -7,
        activeTab: 'limit',
        params: {
          ...DEFAULT_FAST_PARAMS,
          low: 1.2,
          mid: 0.7,
          high: 1.5,
          amount: 40,
          threshold: -9.5,
          punch: 68,
          attack: 48,
          width: 122,
          ceiling: -1.0,
          release: 130,
        },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 7.5,
        loCut: 30,
        definition: 6.8,
        drive: 4.5,
        analog: 5,
        harmonics: 5,
        modeHeavy: true,
        sub: true,
        output: -2.8,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming',
        matchAmount: 74,
        tone: 52,
        dynamics: 56,
        loudness: 68,
        width: 56,
      },
    },
  },
  {
    id: 'trap-master',
    name: 'Trap Master',
    category: 'DA-MUZIK BOX',
    tags: ['trap', '808', 'master'],
    state: {
      // Hard 808, narrow-ish width, fast limit — competitive trap density.
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.9,
        loudTarget: -6,
        activeTab: 'limit',
        params: {
          ...DEFAULT_FAST_PARAMS,
          low: 1.6,
          mid: -0.3,
          high: 0.8,
          amount: 50,
          threshold: -10.5,
          punch: 84,
          attack: 40,
          width: 100,
          ceiling: -0.9,
          release: 100,
        },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 10.8,
        loCut: 22,
        definition: 8.4,
        drive: 7.2,
        harmonics: 7,
        modeHeavy: true,
        sub: true,
        output: -2.0,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'club',
        matchAmount: 72,
        tone: 42,
        dynamics: 54,
        loudness: 74,
        width: 34,
      },
    },
  },
  {
    id: 'kpop-master',
    name: 'K-Pop Master',
    category: 'DA-MUZIK BOX',
    tags: ['kpop', 'bright', 'polish'],
    state: {
      // Glossy highs, clear mids, wide stereo, clean −1 dBTP for streaming.
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.2,
        loudTarget: -7,
        activeTab: 'limit',
        params: {
          ...DEFAULT_FAST_PARAMS,
          low: 0.5,
          mid: 1.0,
          high: 2.4,
          amount: 44,
          threshold: -9,
          punch: 70,
          attack: 50,
          width: 135,
          ceiling: -1.0,
          release: 105,
        },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 5.0,
        loCut: 40,
        definition: 5.5,
        drive: 3,
        analog: 3,
        modeHeavy: false,
        sub: true,
        output: -3.5,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming',
        matchAmount: 80,
        tone: 62,
        dynamics: 58,
        loudness: 70,
        width: 66,
      },
    },
  },
  {
    id: 'uptempo-dance',
    name: 'Up-Tempo Dance',
    category: 'DA-MUZIK BOX',
    tags: ['dance', 'uptempo', 'club'],
    state: {
      // Fast release, wide image, strong low-end — club-ready dance energy.
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 2.0,
        loudTarget: -6,
        activeTab: 'limit',
        params: {
          ...DEFAULT_FAST_PARAMS,
          low: 1.1,
          mid: 0.3,
          high: 1.8,
          amount: 52,
          threshold: -11,
          punch: 86,
          attack: 38,
          width: 145,
          ceiling: -0.8,
          release: 85,
        },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 9.0,
        loCut: 28,
        definition: 7.2,
        drive: 6,
        harmonics: 5.5,
        modeHeavy: true,
        sub: true,
        output: -2.2,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'club',
        matchAmount: 78,
        tone: 56,
        dynamics: 64,
        loudness: 78,
        width: 70,
      },
    },
  },
  // ── Warm / Balanced / Open style masters + pro profiles ──
  {
    id: 'style-warm',
    name: 'Warm',
    category: 'STYLE',
    tags: ['warm', 'vintage', 'smooth'],
    state: {
      // Soft highs, rich low-mids, gentle compression — intimate weight.
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 0.6,
        loudTarget: -8,
        params: {
          ...DEFAULT_FAST_PARAMS,
          low: 1.4,
          mid: 0.8,
          high: -0.6,
          amount: 30,
          threshold: -8,
          punch: 42,
          attack: 62,
          width: 105,
          ceiling: -1.2,
          release: 200,
        },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 6.2,
        loCut: 34,
        definition: 5.2,
        drive: 3,
        analog: 8.5,
        harmonics: 6.5,
        modeHeavy: false,
        output: -3.4,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'vintage',
        matchAmount: 68,
        tone: 36,
        dynamics: 40,
        loudness: 56,
        width: 44,
      },
    },
  },
  {
    id: 'style-balanced',
    name: 'Balanced',
    category: 'STYLE',
    tags: ['balanced', 'clear', 'neutral'],
    state: {
      // Neutral default — full low end, articulate highs, controlled depth.
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.0,
        loudTarget: -7,
        params: {
          ...DEFAULT_FAST_PARAMS,
          low: 0.6,
          mid: 0.4,
          high: 1.2,
          amount: 38,
          threshold: -9,
          punch: 58,
          attack: 52,
          width: 112,
          ceiling: -1.0,
          release: 140,
        },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 5.8,
        loCut: 36,
        definition: 6,
        drive: 3.5,
        analog: 4,
        modeHeavy: false,
        output: -3.2,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming',
        matchAmount: 72,
        tone: 50,
        dynamics: 52,
        loudness: 62,
        width: 50,
      },
    },
  },
  {
    id: 'style-open',
    name: 'Open',
    category: 'STYLE',
    tags: ['open', 'modern', 'airy'],
    state: {
      // Mid scoop, punchy low end, airy presence — modern / uptempo.
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.4,
        loudTarget: -7,
        params: {
          ...DEFAULT_FAST_PARAMS,
          low: 1.2,
          mid: -0.8,
          high: 2.2,
          amount: 42,
          threshold: -9.5,
          punch: 76,
          attack: 44,
          width: 128,
          ceiling: -1.0,
          release: 110,
        },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 7.5,
        loCut: 30,
        definition: 7,
        drive: 4.5,
        analog: 3,
        modeHeavy: true,
        sub: true,
        output: -2.8,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming',
        matchAmount: 74,
        tone: 60,
        dynamics: 48,
        loudness: 66,
        width: 62,
      },
    },
  },
  {
    id: 'style-warm-loud',
    name: 'Warm Loud',
    category: 'STYLE',
    tags: ['warm', 'loud', 'dense'],
    state: {
      // Warm tone with more density — still soft on top.
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.5,
        loudTarget: -6,
        params: {
          ...DEFAULT_FAST_PARAMS,
          low: 1.6,
          mid: 0.6,
          high: -0.2,
          amount: 48,
          threshold: -10,
          punch: 55,
          attack: 58,
          width: 108,
          ceiling: -0.9,
          release: 170,
        },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 7.0,
        loCut: 32,
        definition: 5.8,
        drive: 4,
        analog: 7.5,
        harmonics: 6,
        modeHeavy: false,
        output: -2.6,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'vintage',
        matchAmount: 76,
        tone: 38,
        dynamics: 58,
        loudness: 70,
        width: 46,
      },
    },
  },
  {
    id: 'style-open-punch',
    name: 'Open Punch',
    category: 'STYLE',
    tags: ['open', 'punch', 'modern'],
    state: {
      // Open air + harder punch — competitive modern master.
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.8,
        loudTarget: -6,
        params: {
          ...DEFAULT_FAST_PARAMS,
          low: 1.4,
          mid: -0.6,
          high: 2.0,
          amount: 50,
          threshold: -11,
          punch: 86,
          attack: 38,
          width: 132,
          ceiling: -0.8,
          release: 95,
        },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 8.5,
        loCut: 28,
        definition: 7.5,
        drive: 5.5,
        modeHeavy: true,
        sub: true,
        output: -2.2,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'club',
        matchAmount: 78,
        tone: 58,
        dynamics: 60,
        loudness: 74,
        width: 64,
      },
    },
  },
  {
    id: 'emastered-clarity',
    name: 'Clarity Focus',
    category: 'PRO STYLE',
    tags: ['clarity', 'vocal', 'streaming'],
    state: {
      // Vocal-forward clarity — inspired by clean online-master profiles.
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 0.9,
        loudTarget: -8,
        params: {
          ...DEFAULT_FAST_PARAMS,
          low: 0.2,
          mid: 1.2,
          high: 1.8,
          amount: 34,
          threshold: -8.5,
          punch: 50,
          attack: 55,
          width: 110,
          ceiling: -1.2,
          release: 150,
        },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 4.0,
        loCut: 42,
        definition: 5.5,
        drive: 2.5,
        analog: 3,
        modeHeavy: false,
        output: -3.8,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming',
        matchAmount: 70,
        tone: 56,
        dynamics: 46,
        loudness: 58,
        width: 48,
      },
    },
  },
  {
    id: 'cloudbounce-wide',
    name: 'Wide Stage',
    category: 'PRO STYLE',
    tags: ['wide', 'stereo', 'modern'],
    state: {
      // Wide image, open top — stage-ready streaming master.
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.2,
        loudTarget: -7,
        params: {
          ...DEFAULT_FAST_PARAMS,
          low: 0.8,
          mid: -0.2,
          high: 2.0,
          amount: 40,
          threshold: -9,
          punch: 68,
          attack: 48,
          width: 148,
          ceiling: -1.0,
          release: 120,
        },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 6.0,
        loCut: 34,
        definition: 6.2,
        drive: 3.5,
        modeHeavy: false,
        output: -3.0,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming',
        matchAmount: 72,
        tone: 54,
        dynamics: 50,
        loudness: 64,
        width: 78,
      },
    },
  },
  {
    id: 'softube-glue',
    name: 'Bus Glue',
    category: 'PRO STYLE',
    tags: ['glue', 'cohesive', 'mixbus'],
    state: {
      // Mix-bus glue — medium ratio, slow release, cohesive body.
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 0.8,
        loudTarget: -8,
        params: {
          ...DEFAULT_FAST_PARAMS,
          low: 0.8,
          mid: 0.5,
          high: 0.6,
          amount: 44,
          threshold: -10,
          punch: 48,
          attack: 65,
          width: 108,
          ceiling: -1.1,
          release: 220,
        },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 5.5,
        loCut: 36,
        definition: 5.5,
        drive: 3,
        analog: 6,
        modeHeavy: false,
        output: -3.2,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'cd',
        matchAmount: 70,
        tone: 48,
        dynamics: 62,
        loudness: 60,
        width: 46,
      },
    },
  },
  // ── Twenty more genre masters (Bass X → DMB Match → Master X1) ──
  {
    id: 'kpop-gloss',
    name: 'K-Pop Gloss',
    category: 'GENRE',
    tags: ['kpop', 'gloss', 'bright'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.3,
        loudTarget: -7,
        params: { ...DEFAULT_FAST_PARAMS, low: 0.4, mid: 1.1, high: 2.6, amount: 46, threshold: -9, punch: 72, attack: 48, width: 138, ceiling: -1.0, release: 100 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 4.8, loCut: 42, definition: 5.2, drive: 2.8, analog: 2.5, modeHeavy: false, output: -3.6,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming', matchAmount: 82, tone: 64, dynamics: 56, loudness: 72, width: 70,
      },
    },
  },
  {
    id: 'kpop-ballad',
    name: 'K-Pop Ballad',
    category: 'GENRE',
    tags: ['kpop', 'ballad', 'vocal'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 0.5,
        loudTarget: -9,
        params: { ...DEFAULT_FAST_PARAMS, low: 0.6, mid: 1.0, high: 1.6, amount: 28, threshold: -8, punch: 40, attack: 60, width: 118, ceiling: -1.3, release: 190 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 4.2, loCut: 40, definition: 4.8, drive: 2, analog: 5, modeHeavy: false, output: -3.8,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming', matchAmount: 68, tone: 54, dynamics: 38, loudness: 54, width: 52,
      },
    },
  },
  {
    id: 'afrobeats-pulse',
    name: 'Afrobeats Pulse',
    category: 'GENRE',
    tags: ['afrobeats', 'groove', 'warm'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.1,
        loudTarget: -7,
        params: { ...DEFAULT_FAST_PARAMS, low: 1.3, mid: 0.3, high: 1.5, amount: 40, threshold: -9, punch: 70, attack: 46, width: 125, ceiling: -1.0, release: 130 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 7.8, loCut: 28, definition: 6.8, drive: 4.2, analog: 5.5, modeHeavy: false, output: -2.8,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming', matchAmount: 74, tone: 52, dynamics: 50, loudness: 66, width: 58,
      },
    },
  },
  {
    id: 'reggaeton-heat',
    name: 'Reggaeton Heat',
    category: 'GENRE',
    tags: ['reggaeton', 'latin', 'punch'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.6,
        loudTarget: -6,
        params: { ...DEFAULT_FAST_PARAMS, low: 1.8, mid: 0.2, high: 1.4, amount: 48, threshold: -10.5, punch: 82, attack: 40, width: 115, ceiling: -0.9, release: 105 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 9.5, loCut: 24, definition: 7.8, drive: 6, harmonics: 6, modeHeavy: true, sub: true, output: -2.0,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'club', matchAmount: 76, tone: 48, dynamics: 58, loudness: 74, width: 42,
      },
    },
  },
  {
    id: 'latin-pop-shine',
    name: 'Latin Pop Shine',
    category: 'GENRE',
    tags: ['latin', 'pop', 'bright'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.2,
        loudTarget: -7,
        params: { ...DEFAULT_FAST_PARAMS, low: 0.8, mid: 0.8, high: 2.2, amount: 42, threshold: -9, punch: 66, attack: 50, width: 130, ceiling: -1.0, release: 115 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 6.0, loCut: 36, definition: 5.8, drive: 3.2, analog: 4, modeHeavy: false, output: -3.2,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming', matchAmount: 76, tone: 58, dynamics: 52, loudness: 68, width: 60,
      },
    },
  },
  {
    id: 'country-radio',
    name: 'Country Radio',
    category: 'GENRE',
    tags: ['country', 'radio', 'vocal'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 0.9,
        loudTarget: -8,
        params: { ...DEFAULT_FAST_PARAMS, low: 0.5, mid: 1.0, high: 1.4, amount: 36, threshold: -8.5, punch: 52, attack: 56, width: 112, ceiling: -1.1, release: 155 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 4.5, loCut: 40, definition: 5, drive: 2.5, analog: 5.5, modeHeavy: false, output: -3.6,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming', matchAmount: 70, tone: 52, dynamics: 48, loudness: 60, width: 48,
      },
    },
  },
  {
    id: 'rock-arena',
    name: 'Rock Arena',
    category: 'GENRE',
    tags: ['rock', 'arena', 'wide'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.5,
        loudTarget: -7,
        params: { ...DEFAULT_FAST_PARAMS, low: 1.0, mid: 0.6, high: 1.8, amount: 46, threshold: -10, punch: 74, attack: 45, width: 140, ceiling: -0.9, release: 125 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 6.5, loCut: 34, definition: 6.2, drive: 4, analog: 4.5, modeHeavy: true, output: -2.8,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'cd', matchAmount: 74, tone: 54, dynamics: 56, loudness: 68, width: 66,
      },
    },
  },
  {
    id: 'indie-dream',
    name: 'Indie Dream',
    category: 'GENRE',
    tags: ['indie', 'dream', 'open'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 0.4,
        loudTarget: -9,
        params: { ...DEFAULT_FAST_PARAMS, low: 0.3, mid: -0.4, high: 1.8, amount: 24, threshold: -7, punch: 38, attack: 58, width: 135, ceiling: -1.4, release: 200 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 3.5, loCut: 42, definition: 4.2, drive: 2, analog: 4, modeHeavy: false, output: -4.0,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming', matchAmount: 58, tone: 56, dynamics: 34, loudness: 50, width: 68,
      },
    },
  },
  {
    id: 'jazz-lounge',
    name: 'Jazz Lounge',
    category: 'GENRE',
    tags: ['jazz', 'lounge', 'dynamic'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 0.2,
        loudTarget: -10,
        params: { ...DEFAULT_FAST_PARAMS, low: 0.4, mid: 0.3, high: 0.8, amount: 18, threshold: -6, punch: 28, attack: 70, width: 120, ceiling: -1.5, release: 240 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 3.0, loCut: 38, definition: 4, drive: 1.5, analog: 6, modeHeavy: false, output: -4.2,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'vintage', matchAmount: 52, tone: 44, dynamics: 28, loudness: 46, width: 54,
      },
    },
  },
  {
    id: 'gospel-lift',
    name: 'Gospel Lift',
    category: 'GENRE',
    tags: ['gospel', 'choir', 'warm'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 0.8,
        loudTarget: -8,
        params: { ...DEFAULT_FAST_PARAMS, low: 0.8, mid: 1.0, high: 1.2, amount: 34, threshold: -8.5, punch: 46, attack: 58, width: 122, ceiling: -1.2, release: 175 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 5.2, loCut: 36, definition: 5.2, drive: 2.8, analog: 7, modeHeavy: false, output: -3.4,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming', matchAmount: 68, tone: 48, dynamics: 44, loudness: 58, width: 56,
      },
    },
  },
  {
    id: 'uk-drill',
    name: 'UK Drill',
    category: 'GENRE',
    tags: ['drill', 'uk', 'dark'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.7,
        loudTarget: -6,
        params: { ...DEFAULT_FAST_PARAMS, low: 2.2, mid: -0.9, high: -0.2, amount: 52, threshold: -11, punch: 80, attack: 38, width: 92, ceiling: -0.9, release: 115 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 11.2, loCut: 20, definition: 8.8, drive: 7.8, harmonics: 7.5, focus: 7.5, modeHeavy: true, sub: true, output: -1.8,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'club', matchAmount: 70, tone: 30, dynamics: 52, loudness: 74, width: 26,
      },
    },
  },
  {
    id: 'phonk-night',
    name: 'Phonk Night',
    category: 'GENRE',
    tags: ['phonk', 'dark', 'bass'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.8,
        loudTarget: -6,
        params: { ...DEFAULT_FAST_PARAMS, low: 2.0, mid: -0.5, high: 0.4, amount: 50, threshold: -10.5, punch: 78, attack: 42, width: 100, ceiling: -0.85, release: 100 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 10.5, loCut: 22, definition: 8.2, drive: 7, harmonics: 7, modeHeavy: true, sub: true, output: -2.0,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'club', matchAmount: 72, tone: 34, dynamics: 54, loudness: 76, width: 32,
      },
    },
  },
  {
    id: 'house-groove',
    name: 'House Groove',
    category: 'GENRE',
    tags: ['house', 'dance', 'club'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.6,
        loudTarget: -6,
        params: { ...DEFAULT_FAST_PARAMS, low: 1.2, mid: 0.2, high: 1.6, amount: 48, threshold: -10, punch: 80, attack: 40, width: 136, ceiling: -0.85, release: 90 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 8.2, loCut: 28, definition: 7, drive: 5, modeHeavy: true, sub: true, output: -2.4,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'club', matchAmount: 78, tone: 54, dynamics: 58, loudness: 76, width: 68,
      },
    },
  },
  {
    id: 'techno-floor',
    name: 'Techno Floor',
    category: 'GENRE',
    tags: ['techno', 'floor', 'hard'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 2.0,
        loudTarget: -5,
        params: { ...DEFAULT_FAST_PARAMS, low: 1.5, mid: -0.3, high: 1.2, amount: 56, threshold: -12, punch: 88, attack: 35, width: 128, ceiling: -0.7, release: 80 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 9.0, loCut: 26, definition: 7.5, drive: 6, modeHeavy: true, sub: true, output: -2.0,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'club', matchAmount: 80, tone: 50, dynamics: 66, loudness: 80, width: 58,
      },
    },
  },
  {
    id: 'ambient-space',
    name: 'Ambient Space',
    category: 'GENRE',
    tags: ['ambient', 'space', 'soft'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 0.1,
        loudTarget: -10,
        params: { ...DEFAULT_FAST_PARAMS, low: 0.2, mid: -0.6, high: 1.4, amount: 14, threshold: -5, punch: 22, attack: 72, width: 150, ceiling: -1.6, release: 280 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 2.5, loCut: 44, definition: 3.5, drive: 1, analog: 3, modeHeavy: false, output: -4.5,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'streaming', matchAmount: 48, tone: 58, dynamics: 22, loudness: 42, width: 80,
      },
    },
  },
  {
    id: 'film-score',
    name: 'Film Score',
    category: 'GENRE',
    tags: ['film', 'score', 'cinematic'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 0.7,
        loudTarget: -9,
        params: { ...DEFAULT_FAST_PARAMS, low: 1.2, mid: 0.2, high: 1.0, amount: 26, threshold: -7.5, punch: 44, attack: 55, width: 142, ceiling: -1.3, release: 210 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 6.5, loCut: 30, definition: 6, drive: 3, analog: 5, modeHeavy: false, output: -3.0,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'cd', matchAmount: 64, tone: 46, dynamics: 36, loudness: 54, width: 72,
      },
    },
  },
  {
    id: 'reggae-roots',
    name: 'Reggae Roots',
    category: 'GENRE',
    tags: ['reggae', 'roots', 'warm'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 0.6,
        loudTarget: -8,
        params: { ...DEFAULT_FAST_PARAMS, low: 1.5, mid: 0.4, high: 0.6, amount: 30, threshold: -8, punch: 42, attack: 60, width: 110, ceiling: -1.2, release: 185 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 8.0, loCut: 26, definition: 6.5, drive: 3.5, analog: 7, modeHeavy: false, sub: true, output: -2.8,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'vintage', matchAmount: 66, tone: 40, dynamics: 40, loudness: 56, width: 44,
      },
    },
  },
  {
    id: 'metal-crush',
    name: 'Metal Crush',
    category: 'GENRE',
    tags: ['metal', 'crush', 'loud'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 2.0,
        loudTarget: -6,
        params: { ...DEFAULT_FAST_PARAMS, low: 1.0, mid: 0.8, high: 1.6, amount: 58, threshold: -12, punch: 70, attack: 42, width: 120, ceiling: -0.8, release: 95 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 7.0, loCut: 32, definition: 6.8, drive: 5.5, modeHeavy: true, output: -2.4,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'cd', matchAmount: 78, tone: 52, dynamics: 68, loudness: 76, width: 50,
      },
    },
  },
  {
    id: 'lofi-chill',
    name: 'Lo-Fi Chill',
    category: 'GENRE',
    tags: ['lofi', 'chill', 'soft'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 0.3,
        loudTarget: -10,
        params: { ...DEFAULT_FAST_PARAMS, low: 0.8, mid: 0.2, high: -0.8, amount: 22, threshold: -7, punch: 30, attack: 68, width: 100, ceiling: -1.5, release: 230 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 5.0, loCut: 34, definition: 4.5, drive: 2.5, analog: 8, harmonics: 5, modeHeavy: false, output: -3.8,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'vintage', matchAmount: 55, tone: 34, dynamics: 30, loudness: 48, width: 40,
      },
    },
  },
  {
    id: 'dancehall-fire',
    name: 'Dancehall Fire',
    category: 'GENRE',
    tags: ['dancehall', 'caribbean', 'punch'],
    state: {
      fastMaster: {
        ...DEFAULT_RACK_STATE.fastMaster,
        driveDb: 1.5,
        loudTarget: -6,
        params: { ...DEFAULT_FAST_PARAMS, low: 1.7, mid: 0.3, high: 1.3, amount: 46, threshold: -10, punch: 84, attack: 40, width: 112, ceiling: -0.9, release: 100 },
      },
      bassOne: {
        ...DEFAULT_RACK_STATE.bassOne,
        push: 9.2, loCut: 24, definition: 7.6, drive: 5.5, modeHeavy: true, sub: true, output: -2.2,
      },
      daMatch: {
        ...DEFAULT_RACK_STATE.daMatch,
        referenceId: 'club', matchAmount: 74, tone: 46, dynamics: 56, loudness: 72, width: 40,
      },
    },
  },
];


/** Fill any missing modules (e.g. older presets without deNoise). */
export function normalizeRackState(partial: Partial<MasteringBayRackState> | MasteringBayRackState): MasteringBayRackState {
  return {
    fastMaster: { ...DEFAULT_RACK_STATE.fastMaster, ...partial.fastMaster },
    bassOne: { ...DEFAULT_RACK_STATE.bassOne, ...partial.bassOne },
    daMatch: { ...DEFAULT_RACK_STATE.daMatch, ...partial.daMatch },
    // De-Noise always loads off — user enables only when needed.
    deNoise: {
      ...DEFAULT_RACK_STATE.deNoise,
      ...partial.deNoise,
      power: false,
    },
  };
}

const STORAGE_KEY = 'da-muzik-box-mastering-bay-user-presets-v1';

/** Accidental auto-named saves: "My Master", "My Master 1" … "My Master 8", etc. */
const ACCIDENTAL_MY_MASTER_NAME = /^My Master(\s+\d+)?$/i;

function isAccidentalMyMasterPreset(p: MasteringBayPreset): boolean {
  return ACCIDENTAL_MY_MASTER_NAME.test(p.name.trim());
}

export function readUserMasteringPresets(): MasteringBayPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MasteringBayPreset[];
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter((p) => p?.id && p?.name && p?.state);
    const kept = valid.filter((p) => !isAccidentalMyMasterPreset(p));
    // Purge accidental "My Master" entries from storage permanently.
    if (kept.length !== valid.length) writeUserMasteringPresets(kept);
    return kept;
  } catch {
    return [];
  }
}

export function writeUserMasteringPresets(presets: MasteringBayPreset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function getAllMasteringPresets(): MasteringBayPreset[] {
  return [...DA_MUZIK_BOX_PRESETS, ...readUserMasteringPresets()];
}

export function saveUserPresetFromState(name: string, state: MasteringBayRackState): MasteringBayPreset {
  const preset: MasteringBayPreset = {
    id: `user-${Date.now()}`,
    name,
    category: 'DA-MUZIK BOX',
    tags: ['saved'],
    state: normalizeRackState(state),
    userOwned: true,
  };
  const user = readUserMasteringPresets();
  user.push(preset);
  writeUserMasteringPresets(user);
  return preset;
}

/** Remove a user-owned preset. Factory presets cannot be deleted. Returns true if removed. */
export function deleteUserMasteringPreset(presetId: string): boolean {
  const user = readUserMasteringPresets();
  const next = user.filter((p) => p.id !== presetId);
  if (next.length === user.length) return false;
  writeUserMasteringPresets(next);
  return true;
}
