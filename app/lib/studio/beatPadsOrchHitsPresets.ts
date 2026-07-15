/**
 * Beat Pads ORCH hits — placement presets (timing) + generate onto progression roots.
 */
import type { Lab808ProgressionRoot } from '@/app/lib/creationStation/lab808ChordRoots';
import type { OrchestraHitId } from '@/app/lib/creationStation/grooveLabOrchestraHitBank';
import {
  BEAT_PADS_ORCH_HIT_IDS,
  BEAT_PADS_ORCH_HITS_PIANO_LANES,
  BEAT_PADS_ORCH_HITS_STEPS_PER_BAR,
  beatPadsOrchHitsFitRootMidi,
  beatPadsOrchHitsNormalizeLoopBars,
  emptyBeatPadsOrchHitsGrid,
  type BeatPadsOrchHitsLoopBars,
  type BeatPadsOrchHitsVoice,
} from '@/app/lib/studio/se2BeatPadsOrchHitsVoice';

export type BeatPadsOrchHitsPresetGenre =
  | 'trap'
  | 'cinematic'
  | 'rnb'
  | 'orchestral'
  | 'pop';

export type BeatPadsOrchHitsPreset = {
  id: string;
  name: string;
  genre: BeatPadsOrchHitsPresetGenre;
  desc: string;
  /** Optional preferred Sound Families hit. */
  hitId?: OrchestraHitId;
  /** Active 16th steps in one 4/4 bar (0–15), tiled across the loop. */
  steps: readonly number[];
};

export const BEAT_PADS_ORCH_HITS_PRESET_GENRES: readonly {
  id: BeatPadsOrchHitsPresetGenre;
  label: string;
}[] = [
  { id: 'trap', label: 'Trap' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'rnb', label: 'R&B' },
  { id: 'orchestral', label: 'Orchestral' },
  { id: 'pop', label: 'Pop' },
] as const;

export const BEAT_PADS_ORCH_HITS_PRESETS: readonly BeatPadsOrchHitsPreset[] = [
  {
    id: 'trap-bar-stabs',
    name: 'Bar stabs',
    genre: 'trap',
    desc: 'Downbeat hit each bar',
    hitId: 'orchHit_trapBrass',
    steps: [0],
  },
  {
    id: 'trap-half',
    name: 'Half-bar',
    genre: 'trap',
    desc: 'Beats 1 and 3',
    hitId: 'orchHit_brass',
    steps: [0, 8],
  },
  {
    id: 'trap-sync',
    name: 'Syncopated',
    genre: 'trap',
    desc: 'Off-grid brass punches',
    hitId: 'orchHit_jv2080',
    steps: [0, 6, 12],
  },
  {
    id: 'trap-build',
    name: 'End rush',
    genre: 'trap',
    desc: 'Sparse then last-bar push',
    hitId: 'orchHit_cine',
    steps: [0, 10, 12, 14],
  },
  {
    id: 'cine-impact',
    name: 'Impact hits',
    genre: 'cinematic',
    desc: 'Big downbeats',
    hitId: 'orchHit_cine',
    steps: [0],
  },
  {
    id: 'cine-swell',
    name: 'Swell accents',
    genre: 'cinematic',
    desc: 'Downbeat + late push',
    hitId: 'orchHit_strings',
    steps: [0, 12],
  },
  {
    id: 'cine-double',
    name: 'Double hit',
    genre: 'cinematic',
    desc: 'Paired stabs',
    hitId: 'orchHit_choir',
    steps: [0, 2],
  },
  {
    id: 'rnb-pocket',
    name: 'Soul pocket',
    genre: 'rnb',
    desc: 'Laid-back 1 and & of 3',
    hitId: 'orchHit_pizz',
    steps: [0, 10],
  },
  {
    id: 'rnb-lift',
    name: 'Lift',
    genre: 'rnb',
    desc: 'Anticipations into bars',
    hitId: 'orchHit_pizzChord',
    steps: [0, 14],
  },
  {
    id: 'orch-tutti',
    name: 'Tutti',
    genre: 'orchestral',
    desc: 'Classic bar hits',
    hitId: 'orchHit_sc88',
    steps: [0],
  },
  {
    id: 'orch-call',
    name: 'Call & answer',
    genre: 'orchestral',
    desc: '1 and 3 answer',
    hitId: 'orchHit_proteus',
    steps: [0, 8],
  },
  {
    id: 'orch-timp',
    name: 'Timp punches',
    genre: 'orchestral',
    desc: 'Percussive hits',
    hitId: 'orchHit_timpHard',
    steps: [0, 4, 8],
  },
  {
    id: 'pop-hook',
    name: 'Hook stab',
    genre: 'pop',
    desc: 'Clean downbeats',
    hitId: 'orchHit_tg500',
    steps: [0],
  },
  {
    id: 'pop-drive',
    name: 'Drive',
    genre: 'pop',
    desc: 'Four-on-the-floor accents',
    hitId: 'orchHit_brass',
    steps: [0, 4, 8, 12],
  },
] as const;

export function getBeatPadsOrchHitsPresets(
  genre: BeatPadsOrchHitsPresetGenre,
): readonly BeatPadsOrchHitsPreset[] {
  return BEAT_PADS_ORCH_HITS_PRESETS.filter((p) => p.genre === genre);
}

function rootMidiAtBeat(
  roots: readonly Lab808ProgressionRoot[],
  beat: number,
  fallbackMidi: number,
): number {
  if (!roots.length) return fallbackMidi;
  for (const r of roots) {
    if (beat + 1e-6 >= r.startBeat && beat < r.startBeat + r.durBeats - 1e-9) {
      return r.rollMidi ?? r.midi;
    }
  }
  const idx = Math.max(0, Math.floor(beat / 4)) % roots.length;
  return roots[idx]!.rollMidi ?? roots[idx]!.midi;
}

/** One root MIDI per bar for Place on roots. */
export function beatPadsOrchHitsRootMidiPerBar(
  roots: readonly Lab808ProgressionRoot[],
  loopBars: BeatPadsOrchHitsLoopBars,
  baseMidi: number,
): number[] {
  const bars = beatPadsOrchHitsNormalizeLoopBars(loopBars);
  return Array.from({ length: bars }, (_, bar) => {
    const raw = rootMidiAtBeat(roots, bar * 4, baseMidi);
    return beatPadsOrchHitsFitRootMidi(raw, baseMidi);
  });
}

export function beatPadsOrchHitsApplyPreset(
  voice: BeatPadsOrchHitsVoice,
  preset: BeatPadsOrchHitsPreset,
  roots: readonly Lab808ProgressionRoot[],
  seed = 1,
): BeatPadsOrchHitsVoice {
  const bars = beatPadsOrchHitsNormalizeLoopBars(voice.loopBars);
  const grid = emptyBeatPadsOrchHitsGrid(bars);
  const base = voice.baseMidi;
  const stepBeats = 4 / BEAT_PADS_ORCH_HITS_STEPS_PER_BAR;
  const hitId =
    preset.hitId && (BEAT_PADS_ORCH_HIT_IDS as readonly string[]).includes(preset.hitId)
      ? preset.hitId
      : voice.hitId;

  // Light seed wobble: rotate preset steps by 0 / ±2 / +2 sixteenths.
  const shift = ((seed - 1) % 3) * 2;
  const steps = preset.steps.map((s) => (s + shift) % BEAT_PADS_ORCH_HITS_STEPS_PER_BAR);

  for (let bar = 0; bar < bars; bar += 1) {
    for (const step of steps) {
      const col = bar * BEAT_PADS_ORCH_HITS_STEPS_PER_BAR + step;
      const beat = col * stepBeats;
      const fitted = beatPadsOrchHitsFitRootMidi(rootMidiAtBeat(roots, beat, base), base);
      const lane = Math.max(
        0,
        Math.min(BEAT_PADS_ORCH_HITS_PIANO_LANES - 1, Math.round(fitted) - base),
      );
      if (grid[lane]) grid[lane]![col] = true;
    }
  }

  return { ...voice, hitId, gridSteps: grid };
}
