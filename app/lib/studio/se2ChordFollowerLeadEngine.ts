/**
 * Chord-Follower lead — locked to chord downbeats, bar-aligned, chord tones only.
 */
import { mulberry32 } from '@/app/lib/groovePatternEngine';
import type { GenoHarmony } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import {
  SE2_GROOVE_LEAD_PITCH_DEFAULT_HI,
  SE2_GROOVE_LEAD_PITCH_DEFAULT_LO,
} from '@/app/lib/studio/se2GrooveLeadNotes';
import { genoWrapMidiToRange } from '@/app/lib/studio/se2SynthGenoRanges';
import {
  grooveLeadCollapseDuplicatePitches,
  grooveLeadDurationForPhraseNote,
} from '@/app/lib/studio/se2GrooveLeadMelodicFlow';
import { grooveLeadFinalizeNotes, grooveLeadMainVelocity } from '@/app/lib/studio/se2GrooveLeadPocket';

const LO = SE2_GROOVE_LEAD_PITCH_DEFAULT_LO;
const HI = SE2_GROOVE_LEAD_PITCH_DEFAULT_HI;

export type ChordFollowerRegion = {
  attackBeat: number;
  endBeat: number;
  tones: number[];
  rootPitch: number;
  chordChanged: boolean;
};

function clampLead(m: number): number {
  return genoWrapMidiToRange(Math.round(m), LO, HI);
}

function pc(m: number): number {
  return ((Math.round(m) % 12) + 12) % 12;
}

export function chordFollowerMapToLeadRegister(srcMidi: number): number {
  const pitchClass = pc(srcMidi);
  let m = LO + pitchClass;
  if (m > HI) m -= 12;
  if (m < LO) m += 12;
  return clampLead(m);
}

export function chordFollowerActiveTonesAtBeat(
  chordNotes: readonly StudioEditor2GenNote[],
  beat: number,
): number[] {
  const byPc = new Map<number, number>();
  for (const n of chordNotes) {
    const start = n.startBeat;
    const end = start + n.durationBeats;
    if (beat < start - 1e-5 || beat >= end - 1e-5) continue;
    const mapped = chordFollowerMapToLeadRegister(n.pitch);
    const existing = byPc.get(pc(mapped));
    if (existing == null || mapped > existing) byPc.set(pc(mapped), mapped);
  }
  return [...byPc.values()].sort((a, b) => a - b);
}

function uniqueAttackBeats(chordNotes: readonly StudioEditor2GenNote[], loopEnd: number): number[] {
  const s = new Set<number>();
  for (const n of chordNotes) {
    if (n.startBeat >= loopEnd) continue;
    s.add(n.startBeat);
  }
  return [...s].sort((a, b) => a - b);
}

/** Earliest chord attack inside a bar — lead lands with the chord, not an empty downbeat. */
function primaryAttackInBar(
  chordNotes: readonly StudioEditor2GenNote[],
  barStart: number,
  barEnd: number,
): number | null {
  let earliest: number | null = null;
  for (const n of chordNotes) {
    if (n.startBeat < barStart - 1e-5 || n.startBeat >= barEnd - 1e-5) continue;
    earliest = earliest == null ? n.startBeat : Math.min(earliest, n.startBeat);
  }
  return earliest;
}

export function chordFollowerResolveRootPitch(
  rootMidi: number | undefined,
  tones: readonly number[],
): number {
  if (tones.length === 0) return LO;
  if (rootMidi != null) {
    const mapped = chordFollowerMapToLeadRegister(rootMidi);
    if (tones.includes(mapped)) return mapped;
    return chordFollowerClosestTone(mapped, tones);
  }
  return tones[0]!;
}

export function chordFollowerBuildRegions(
  chordNotes: readonly StudioEditor2GenNote[],
  totalBeats: number,
): ChordFollowerRegion[] {
  const attacks = uniqueAttackBeats(chordNotes, totalBeats);
  if (attacks.length === 0) return [];

  const regions: ChordFollowerRegion[] = [];
  let prevRootPc: number | null = null;

  for (let i = 0; i < attacks.length; i += 1) {
    const attackBeat = attacks[i]!;
    const endBeat = i + 1 < attacks.length ? attacks[i + 1]! : totalBeats;
    const tones = chordFollowerActiveTonesAtBeat(chordNotes, attackBeat + 0.001);
    if (tones.length === 0) continue;

    const rootPitch = chordFollowerResolveRootPitch(undefined, tones);
    const curRootPc = pc(rootPitch);
    const chordChanged = prevRootPc != null && prevRootPc !== curRootPc;

    regions.push({ attackBeat, endBeat, tones, rootPitch, chordChanged });
    prevRootPc = curRootPc;
  }

  return regions;
}

/** One region per bar — lead starts when the chord hits, rooted on harmony root when it changes. */
export function chordFollowerBuildBarRegions(
  chordNotes: readonly StudioEditor2GenNote[],
  totalBeats: number,
  beatsPerBar: number,
  harmony?: GenoHarmony,
): ChordFollowerRegion[] {
  const bpb = Math.max(1, beatsPerBar);
  const barCount = Math.ceil(totalBeats / bpb);
  const regions: ChordFollowerRegion[] = [];
  let prevRootPc: number | null = null;

  for (let bar = 0; bar < barCount; bar += 1) {
    const barStart = bar * bpb;
    const barEnd = Math.min(totalBeats, (bar + 1) * bpb);
    const attackBeat = primaryAttackInBar(chordNotes, barStart, barEnd) ?? barStart;
    const tones = chordFollowerActiveTonesAtBeat(chordNotes, attackBeat + 0.001);
    if (tones.length === 0) continue;

    const harmonyRoot = harmony?.columns[bar]?.rootMidi;
    const rootPitch = chordFollowerResolveRootPitch(harmonyRoot, tones);
    const curRootPc = pc(rootPitch);
    const chordChanged = prevRootPc != null && prevRootPc !== curRootPc;

    regions.push({ attackBeat, endBeat: barEnd, tones, rootPitch, chordChanged });
    prevRootPc = curRootPc;
  }

  return regions;
}

export function chordFollowerClosestTone(last: number, tones: readonly number[]): number {
  if (tones.length === 0) return last;
  let best = tones[0]!;
  let bestDist = Math.abs(best - last);
  for (let i = 1; i < tones.length; i += 1) {
    const t = tones[i]!;
    const dist = Math.abs(t - last);
    if (dist < bestDist || (dist === bestDist && t < best)) {
      best = t;
      bestDist = dist;
    }
  }
  return best;
}

/** Downbeat: harmony root when the chord changed; voice-lead when it did not. */
export function chordFollowerDownbeatPitch(
  tones: readonly number[],
  lastPitch: number | null,
  rootPitch: number,
  chordChanged: boolean,
): number {
  if (tones.length === 0) return LO;
  if (lastPitch == null || chordChanged) {
    return tones.includes(rootPitch) ? rootPitch : chordFollowerClosestTone(rootPitch, tones);
  }
  return chordFollowerClosestTone(lastPitch, tones);
}

function chordFollowerStepOnTones(from: number, tones: readonly number[], direction: 1 | -1): number {
  if (tones.length <= 1) return tones[0] ?? from;
  const idx = tones.findIndex((t) => t === from);
  const i =
    idx >= 0
      ? idx
      : tones.reduce(
          (best, t, j) => (Math.abs(t - from) < Math.abs(tones[best]! - from) ? j : best),
          0,
        );
  const next = Math.max(0, Math.min(tones.length - 1, i + direction));
  return tones[next]!;
}

function notesPerBar(barSpan: number, beatsPerBar: number): number {
  if (barSpan >= beatsPerBar * 0.9) return 3;
  if (barSpan >= beatsPerBar * 0.45) return 2;
  return 1;
}

function barLockedOffsets(noteCount: number, barSpan: number): number[] {
  if (noteCount <= 1) return [0];
  return Array.from({ length: noteCount }, (_, i) => (i * barSpan) / noteCount);
}

/** Melody path — only chord tones, stepwise within the bar. */
function buildBarLockedPath(
  tones: readonly number[],
  lastPitch: number | null,
  noteCount: number,
  rootPitch: number,
  chordChanged: boolean,
): number[] {
  if (tones.length === 0) return [];
  const path: number[] = [];
  let cur = chordFollowerDownbeatPitch(tones, lastPitch, rootPitch, chordChanged);
  path.push(cur);

  for (let i = 1; i < noteCount; i += 1) {
    const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
    let next = chordFollowerStepOnTones(cur, tones, dir);
    if (next === cur && tones.length > 1) {
      next = tones.find((t) => t !== cur) ?? cur;
    }
    path.push(next);
    cur = next;
  }

  return path;
}

function snapNoteToChord(
  note: StudioEditor2GenNote,
  chordNotes: readonly StudioEditor2GenNote[],
): StudioEditor2GenNote {
  const live = chordFollowerActiveTonesAtBeat(chordNotes, note.startBeat);
  if (live.length === 0) return note;
  if (live.includes(note.pitch)) return note;
  return { ...note, pitch: chordFollowerClosestTone(note.pitch, live) };
}

function snapNotesToRegions(
  notes: readonly StudioEditor2GenNote[],
  regions: readonly ChordFollowerRegion[],
  chordNotes: readonly StudioEditor2GenNote[],
): StudioEditor2GenNote[] {
  return notes.map((n) => {
    const region = regions.find(
      (r) => n.startBeat >= r.attackBeat - 0.02 && n.startBeat < r.endBeat - 1e-5,
    );
    if (!region) return snapNoteToChord(n, chordNotes);

    const onDownbeat = n.startBeat - region.attackBeat < 0.08;
    if (onDownbeat) {
      const live = chordFollowerActiveTonesAtBeat(chordNotes, region.attackBeat + 0.001);
      const tones = live.length > 0 ? live : region.tones;
      let pitch = n.pitch;
      if (region.chordChanged) {
        pitch = tones.includes(region.rootPitch)
          ? region.rootPitch
          : chordFollowerClosestTone(region.rootPitch, tones);
      } else {
        pitch = snapNoteToChord({ ...n, startBeat: region.attackBeat }, chordNotes).pitch;
      }
      return {
        ...n,
        startBeat: region.attackBeat,
        pitch,
      };
    }

    return snapNoteToChord(n, chordNotes);
  });
}

export function chordFollowerGenerateLead(opts: {
  chordNotes: readonly StudioEditor2GenNote[];
  barCount: number;
  beatsPerBar: number;
  seed: number;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  movement?: number;
  bpm?: number;
  harmony?: GenoHarmony;
}): StudioEditor2GenNote[] {
  void opts.keyMode;
  void opts.keyRoot;
  void opts.movement;
  const rnd = mulberry32(opts.seed ^ 0x43484f52);
  const bpb = Math.max(1, opts.beatsPerBar);
  const bpm = Math.max(40, opts.bpm ?? 100);
  const totalBeats = opts.barCount * bpb;

  const regions = chordFollowerBuildBarRegions(
    opts.chordNotes,
    totalBeats,
    bpb,
    opts.harmony,
  );
  if (regions.length === 0) return [];

  const out: StudioEditor2GenNote[] = [];
  let lastPitch: number | null = null;

  for (const region of regions) {
    const { tones, attackBeat, endBeat, rootPitch, chordChanged } = region;
    if (tones.length === 0) continue;

    const barSpan = endBeat - attackBeat;
    const count = notesPerBar(barSpan, bpb);
    const path = buildBarLockedPath(tones, lastPitch, count, rootPitch, chordChanged);
    const offsets = barLockedOffsets(path.length, barSpan);

    for (let pi = 0; pi < path.length; pi += 1) {
      const startBeat = attackBeat + offsets[pi]!;
      if (startBeat >= endBeat - 0.05) break;

      const pitch = path[pi]!;
      pushChordLockedNote(
        out,
        pitch,
        startBeat,
        grooveLeadDurationForPhraseNote(pi, path.length, barSpan, rnd),
        grooveLeadMainVelocity(rnd),
      );
      lastPitch = pitch;
    }
  }

  if (out.length === 0) return [];

  const snapped = snapNotesToRegions(out, regions, opts.chordNotes);
  const collapsed = grooveLeadCollapseDuplicatePitches(snapped);

  return grooveLeadFinalizeNotes(collapsed, {
    bpm,
    totalBeats,
    rnd,
    beatsPerBar: bpb,
    lockToChordDownbeat: true,
  });
}

function pushChordLockedNote(
  out: StudioEditor2GenNote[],
  pitch: number,
  startBeat: number,
  durationBeats: number,
  velocity: number,
): void {
  const last = out[out.length - 1];
  if (last && last.pitch === pitch && startBeat - last.startBeat < 0.12) {
    return;
  }
  out.push({ pitch, startBeat, durationBeats, velocity });
}
