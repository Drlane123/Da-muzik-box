/**
 * Studio Editor 2 — instrument-channel harmony (GrooveLab progression → MIDI notes).
 * Root hits per bar + optional full chord stacks; orchestra hits via `orchHit:` instrument ids.
 */

import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { parseChordSymbolToken } from '@/app/lib/creationStation/chordProgressionParse';
import { generateWaveLeafPhraseFromChords } from '@/app/lib/creationStation/waveLeafPhraseGen';
import {
  WAVE_LEAF_DEFAULT_STYLE_ID,
  waveLeafMelodyStyleById,
  type WaveLeafMelodyStyleId,
} from '@/app/lib/creationStation/waveLeafMelodyStyles';

export type { WaveLeafMelodyStyleId };
import {
  getOrchestraHitDef,
  isOrchestraHitId,
  loadOrchestraHitBuffer,
  playOrchestraHitSample,
  type OrchestraHitDef,
  type OrchestraHitId,
} from '@/app/lib/creationStation/grooveLabOrchestraHitBank';
import { grooveLabOrchestraHitRollMidiFromRoot } from '@/app/lib/creationStation/grooveLabOrchestraHitRoll';
import {
  expandProgressionStepsForHits,
  progressionStepsIsBeatLevelTimeline,
  progressionStepsNeedRhythmExpand,
  progressionStepsToGrooveHits,
  tileBeatLevelTimelineForLoop,
  type GrooveProgressionStep,
} from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { GROOVE_LAB_QUANTIZE_DEFAULT, GROOVE_LAB_SLOTS_PER_BAR } from '@/app/lib/creationStation/grooveLabRoll';
import { studioTrackIsDrumChannel } from '@/app/lib/studio/studioEditor2DrumPatterns';
import { studioTrackOutputsMidi } from '@/app/lib/studio/studioEditor2Midi';
import { mixerVolToLinearGain } from '@/app/lib/studio/se2MixerFaderScale';
import { GROOVE_ORCHESTRA_HIT_DEFAULT } from '@/app/lib/creationStation/grooveLabOrchestraHitSoundBank';
import {
  GROOVE_LAB_LEAD_SOUND_GROUPS,
  GROOVE_LAB_LEAD_SOUNDS,
  playGrooveLabLeadSound,
  type GrooveLabAnyLeadSoundId,
  type GrooveLabLeadSoundId,
} from '@/app/lib/creationStation/grooveLabLeadSounds';
import { newProgressionStepId } from '@/app/lib/creationStation/grooveLabProgressionBuilder';

/** Default harmony loop length (bars). */
export const STUDIO_HARMONY_LOOP_BARS = 4;

export const STUDIO_HARMONY_LOOP_BAR_OPTIONS = [4, 8] as const;

export type StudioHarmonyLoopBars = (typeof STUDIO_HARMONY_LOOP_BAR_OPTIONS)[number];

export function studioNormalizeHarmonyLoopBars(n: number | undefined): StudioHarmonyLoopBars {
  return n === 8 ? 8 : 4;
}

/** LOOP LENGTH (4|8) plus timeline span — never clip an 8-bar sketch when loop was still 4. */
export function studioResolveHarmonyBarCount(
  steps: readonly GrooveProgressionStep[],
  loopBars: number | undefined,
  beatsPerBar: number,
): StudioHarmonyLoopBars {
  const loop = studioNormalizeHarmonyLoopBars(loopBars);
  const fromTimeline = studioHarmonyBarCountFromSteps(steps, beatsPerBar, loop);
  return studioNormalizeHarmonyLoopBars(Math.max(loop, fromTimeline));
}

/** Furthest beat any MIDI note reaches (start + duration). */
export function studioMidiContentEndBeat(
  tracks: readonly { notes?: readonly { startBeat: number; durationBeats: number }[] }[],
): number {
  let end = 0;
  for (const tr of tracks) {
    for (const n of tr.notes ?? []) {
      end = Math.max(end, n.startBeat + Math.max(0, n.durationBeats));
    }
  }
  return end;
}

/** Harmony loop bars (4|8) that cover MIDI content — never shorter than `minBars`. */
export function studioLoopBarsForMidiContent(
  contentEndBeat: number,
  beatsPerBar: number,
  minBars: StudioHarmonyLoopBars = STUDIO_HARMONY_LOOP_BARS,
): StudioHarmonyLoopBars {
  const bpb = Math.max(1, beatsPerBar);
  const min = studioNormalizeHarmonyLoopBars(minBars);
  const barsNeeded = Math.max(1, Math.ceil(contentEndBeat / bpb));
  return studioNormalizeHarmonyLoopBars(Math.max(min, barsNeeded));
}

export type StudioHarmonySoundKind = 'orchHit' | 'grooveLead';

export type StudioHarmonyMidiNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  /** Piano-roll block width — shorter than `durationBeats` for rhythm chops. */
  rollDurationBeats?: number;
  velocity: number;
};

export type StudioHarmonyTrack = {
  kind: 'midi' | 'audio' | 'a2m';
  midiInstrumentId?: string;
  harmonySteps?: GrooveProgressionStep[];
  harmonyOrchHitId?: OrchestraHitId;
  harmonySoundKind?: StudioHarmonySoundKind;
  harmonyGrooveLeadId?: GrooveLabLeadSoundId;
  harmonyLoopBars?: StudioHarmonyLoopBars;
  /** Bumps on each Groove Lead melody apply for phrase variation. */
  harmonyMelodySeed?: number;
  harmonyMelodyStyleId?: WaveLeafMelodyStyleId;
};

/** Melodic instrument lane only — not drums, audio, or A2M. */
export function studioTrackIsInstrumentHarmonyChannel(
  tr: StudioHarmonyTrack | undefined,
): boolean {
  if (!tr || tr.kind !== 'midi') return false;
  if (studioTrackIsDrumChannel(tr)) return false;
  return true;
}

export function studioOrchestraHitInstrumentId(hitId: OrchestraHitId): string {
  return `orchHit:${hitId}`;
}

export function studioParseOrchestraHitInstrumentId(
  instrumentId: string | undefined,
): OrchestraHitId | null {
  if (!instrumentId?.startsWith('orchHit:')) return null;
  const id = instrumentId.slice('orchHit:'.length);
  return isOrchestraHitId(id) ? id : null;
}

export function studioDefaultHarmonyOrchHitId(): OrchestraHitId {
  return GROOVE_ORCHESTRA_HIT_DEFAULT;
}

export function studioGrooveLeadInstrumentId(leadId: GrooveLabLeadSoundId): string {
  return `grooveLead:${leadId}`;
}

export function studioParseGrooveLeadInstrumentId(
  instrumentId: string | undefined,
): GrooveLabLeadSoundId | null {
  if (!instrumentId?.startsWith('grooveLead:')) return null;
  const id = instrumentId.slice('grooveLead:'.length);
  return GROOVE_LAB_LEAD_SOUNDS.some((s) => s.id === id) ? (id as GrooveLabLeadSoundId) : null;
}

export function studioHarmonyInstrumentId(
  kind: StudioHarmonySoundKind,
  soundId: OrchestraHitId | GrooveLabLeadSoundId,
): string {
  return kind === 'grooveLead'
    ? studioGrooveLeadInstrumentId(soundId as GrooveLabLeadSoundId)
    : studioOrchestraHitInstrumentId(soundId as OrchestraHitId);
}

export function studioGrooveLeadSoundLabel(id: GrooveLabLeadSoundId): string {
  return GROOVE_LAB_LEAD_SOUNDS.find((s) => s.id === id)?.label ?? id;
}

export const STUDIO_HARMONY_GROOVE_LEAD_GROUPS = GROOVE_LAB_LEAD_SOUND_GROUPS;

/** Tile chord steps across N bars — one chord per bar, cycles like a drum loop. */
export function tileHarmonyStepsForBars(
  steps: readonly GrooveProgressionStep[],
  barCount: number,
  beatsPerBar: number,
): GrooveProgressionStep[] | { message: string } {
  const chordSteps = steps.filter((s) => !s.rest && s.label.trim());
  if (chordSteps.length === 0) {
    return { message: 'Add at least one chord to the progression.' };
  }
  const bars = Math.max(1, Math.round(barCount));
  const bpb = Math.max(1, beatsPerBar);
  const tiled: GrooveProgressionStep[] = [];
  for (let bar = 0; bar < bars; bar += 1) {
    const src = chordSteps[bar % chordSteps.length]!;
    const parsed = parseChordSymbolToken(src.label.trim());
    if (!parsed) {
      return { message: `Could not read chord “${src.label}”. Try C, Am, F, G7…` };
    }
    tiled.push({
      id: newProgressionStepId(),
      label: src.label.trim(),
      beats: bpb,
      hitsPerBar: src.hitsPerBar,
      barBeats: src.barBeats?.length ? [...src.barBeats] : undefined,
    });
  }
  return tiled;
}

/** Count struck chord steps in the first bar of a beat-level timeline. */
function harmonyRhythmHitsInFirstBar(
  grooveInput: readonly GrooveProgressionStep[],
  beatsPerBar: number,
): number {
  const bpb = Math.max(1, beatsPerBar);
  let hits = 0;
  let beat = 0;
  for (const s of grooveInput) {
    if (beat >= bpb - 1e-6) break;
    if (!s.rest && s.label.trim()) hits += 1;
    beat += Math.max(0.25, s.beats);
  }
  return Math.max(1, hits);
}

/** Staccato length so piano-roll chops do not butt together into full-bar blocks. */
function harmonyRhythmChopDurationBeats(
  grooveInput: readonly GrooveProgressionStep[],
  beatsPerBar: number,
): number {
  const bpb = Math.max(1, beatsPerBar);
  const hitsPerBar = harmonyRhythmHitsInFirstBar(grooveInput, bpb);
  return Math.max(0.2, Math.min(0.5, (bpb / hitsPerBar) * 0.72));
}

/** Rhythm-expanded or bar-tiled steps ready for groove / MIDI export. */
function resolveHarmonyGrooveInputSteps(
  steps: readonly GrooveProgressionStep[],
  barCount: number,
  beatsPerBar: number,
): GrooveProgressionStep[] | { message: string } {
  const bpb = Math.max(1, beatsPerBar);
  const loopBeats = barCount * bpb;

  if (progressionStepsIsBeatLevelTimeline(steps)) {
    const contentBeats = steps.reduce((sum, s) => sum + Math.max(0, s.beats), 0);
    if (contentBeats > 0 && contentBeats < loopBeats - 1e-6) {
      return tileBeatLevelTimelineForLoop(steps, loopBeats);
    }
    return [...steps];
  }

  const tiled = tileHarmonyStepsForBars(steps, barCount, bpb);
  if ('message' in tiled) return tiled;

  if (progressionStepsNeedRhythmExpand(tiled)) {
    return expandProgressionStepsForHits(tiled);
  }
  return tiled;
}

/** One staccato root per bar across the loop (4 bars default). */
export function progressionStepsToBarRootHits(
  steps: readonly GrooveProgressionStep[],
  opts: {
    beatsPerBar: number;
    barCount?: number;
    hitDurationBeats?: number;
    velocity?: number;
  },
): StudioHarmonyMidiNote[] | { message: string } {
  const beatsPerBar = Math.max(1, opts.beatsPerBar);
  const barCount = studioResolveHarmonyBarCount(steps, opts.barCount, beatsPerBar);
  const pipeline = resolveHarmonyGrooveInputSteps(steps, barCount, beatsPerBar);
  if ('message' in pipeline) return pipeline;

  const hitDur = opts.hitDurationBeats ?? 0.25;
  const velocity = opts.velocity ?? 112;
  const notes: StudioHarmonyMidiNote[] = [];

  let beat = 0;
  for (const step of pipeline) {
    const stepBeats = Math.max(0.25, step.beats);
    if (step.rest || !step.label.trim()) {
      beat += stepBeats;
      continue;
    }
    const parsed = parseChordSymbolToken(step.label);
    if (!parsed) {
      beat += stepBeats;
      continue;
    }
    const rootMidi = grooveLabOrchestraHitRollMidiFromRoot(Math.min(...parsed.notes));
    notes.push({
      pitch: rootMidi,
      startBeat: beat,
      durationBeats: hitDur,
      velocity,
    });
    beat += stepBeats;
  }
  return notes;
}

function grooveVelToMidi127(vel: number): number {
  if (vel <= 1) return Math.max(1, Math.min(127, Math.round(vel * 127)));
  return Math.max(1, Math.min(127, Math.round(vel)));
}

function grooveHitsToStudioNotes(
  hits: readonly { slot: number; sustainSlots: number; midi: number; vel: number }[],
  beatsPerBar: number,
  opts?: { maxDurationBeats?: number; rollDurationBeats?: number },
): StudioHarmonyMidiNote[] {
  const slotsPerBar = GROOVE_LAB_SLOTS_PER_BAR;
  const maxDur = opts?.maxDurationBeats;
  const rollDur = opts?.rollDurationBeats;
  return hits.map((h) => {
    let durationBeats = Math.max(0.25, (h.sustainSlots / slotsPerBar) * beatsPerBar);
    if (maxDur != null) durationBeats = Math.min(maxDur, durationBeats);
    return {
      pitch: h.midi,
      startBeat: (h.slot / slotsPerBar) * beatsPerBar,
      durationBeats,
      ...(rollDur != null ? { rollDurationBeats: rollDur } : {}),
      velocity: grooveVelToMidi127(h.vel),
    };
  });
}

/** One note per pitch per downbeat — drop duplicates from stacked voicing. */
function dedupeStudioHarmonyNotes(notes: readonly StudioHarmonyMidiNote[]): StudioHarmonyMidiNote[] {
  const seen = new Set<string>();
  const out: StudioHarmonyMidiNote[] = [];
  for (const n of notes) {
    const k = `${n.startBeat.toFixed(4)}:${n.pitch}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out;
}

export function studioDefaultHarmonyMelodyStyleId(): WaveLeafMelodyStyleId {
  return WAVE_LEAF_DEFAULT_STYLE_ID;
}

/** Genre-vibe lead melody — full phrases (R&B, Reggae, Soul, etc.) matched to chords. */
export function progressionStepsToGrooveLeadMelody(
  steps: readonly GrooveProgressionStep[],
  opts: {
    beatsPerBar: number;
    barCount?: number;
    keyRoot: number;
    keyMode: ChordMode;
    seed?: number;
    styleId?: WaveLeafMelodyStyleId;
    bpm?: number;
  },
): StudioHarmonyMidiNote[] | { message: string } {
  const bpb = Math.max(1, opts.beatsPerBar);
  const barCount = studioResolveHarmonyBarCount(steps, opts.barCount, bpb);
  const tiled = tileHarmonyStepsForBars(steps, barCount, bpb);
  if ('message' in tiled) return tiled;

  const built = progressionStepsToGrooveHits(tiled, {
    quantize: GROOVE_LAB_QUANTIZE_DEFAULT,
    barCount,
    sustainSlots: 8,
    beatsPerBar: bpb,
  });
  if ('message' in built) return built;
  if (built.chordHits.length === 0) {
    return { message: 'No chord columns for melody — check chord labels (C, Am, G7…).' };
  }

  const style = waveLeafMelodyStyleById(opts.styleId ?? WAVE_LEAF_DEFAULT_STYLE_ID);
  const seed = Math.max(1, opts.seed ?? 1);
  const phrase = generateWaveLeafPhraseFromChords({
    chordHits: built.chordHits,
    barCount,
    quantize: GROOVE_LAB_QUANTIZE_DEFAULT,
    keyRoot: opts.keyRoot,
    mode: opts.keyMode,
    seed,
    style,
    bpm: opts.bpm,
    fullPhrase: true,
  });

  if (phrase.chordColumns === 0) {
    return { message: 'Could not lock melody to chords — check progression.' };
  }
  if (phrase.hits.length === 0) {
    return { message: 'No melody notes — try another vibe or progression.' };
  }
  return grooveHitsToStudioNotes(phrase.hits, bpb);
}

/** Full chord stacks at progression downbeats (editable in piano roll). */
export function progressionStepsToChordNotes(
  steps: readonly GrooveProgressionStep[],
  opts: {
    beatsPerBar: number;
    barCount?: number;
    /** Grid sustain for each chord stack (default 8). SE2 apply uses 4 for tighter block chords. */
    sustainSlots?: number;
    /** Cap each chord voice length so sustained stacks do not re-trigger as a delay on loop refill. */
    maxDurationBeats?: number;
  },
): StudioHarmonyMidiNote[] | { message: string } {
  const bpb = Math.max(1, opts.beatsPerBar);
  const barCount = studioResolveHarmonyBarCount(steps, opts.barCount, bpb);
  const grooveInput = resolveHarmonyGrooveInputSteps(steps, barCount, bpb);
  if ('message' in grooveInput) return grooveInput;
  const built = progressionStepsToGrooveHits(grooveInput, {
    quantize: GROOVE_LAB_QUANTIZE_DEFAULT,
    barCount,
    sustainSlots: opts.sustainSlots ?? 8,
    beatsPerBar: bpb,
  });
  if ('message' in built) return built;
  const chordHitCount = grooveInput.filter((s) => !s.rest && s.label.trim()).length;
  const rhythmChops =
    progressionStepsIsBeatLevelTimeline(grooveInput) && chordHitCount > barCount;
  const hitsPerBar = harmonyRhythmHitsInFirstBar(grooveInput, bpb);
  const chopSpacing = bpb / hitsPerBar;
  const maxDur = rhythmChops
    ? Math.max(0.35, chopSpacing * 0.92)
    : opts.maxDurationBeats ?? Math.min(bpb * 0.92, Math.max(0.5, bpb - 0.08));
  const rollDur = rhythmChops ? harmonyRhythmChopDurationBeats(grooveInput, bpb) : undefined;
  return dedupeStudioHarmonyNotes(
    grooveHitsToStudioNotes(built.chordHits, bpb, {
      maxDurationBeats: maxDur,
      rollDurationBeats: rollDur,
    }),
  );
}

export function studioHarmonyBarCountFromSteps(
  steps: readonly GrooveProgressionStep[],
  beatsPerBar: number,
  minBars = 4,
): number {
  let totalBeats = 0;
  for (const s of steps) totalBeats += Math.max(0, s.beats);
  return Math.max(minBars, Math.ceil(totalBeats / Math.max(1, beatsPerBar)));
}

/** Schedule orchestra hit sample through the same pan/fader path as MIDI preview. */
export function studioPlayOrchestraHitOnPreviewBus(
  ctx: AudioContext,
  bus: GainNode,
  def: OrchestraHitDef,
  t0: number,
  pitch: number,
  velocity01: number,
  pan127: number,
  monoTrack: boolean,
  faderVol127: number,
): boolean {
  const out = studioHarmonyPreviewGainChain(ctx, bus, t0, pan127, monoTrack, faderVol127);
  const targetMidi = Number.isFinite(pitch) ? Math.round(pitch) : undefined;
  return playOrchestraHitSample(ctx, def, t0, velocity01, {
    outputNode: out,
    nativePitch: targetMidi == null,
    targetMidi: targetMidi ?? def.rootMidi,
  });
}

export async function studioPreloadOrchestraHitInstrument(
  ctx: AudioContext,
  instrumentId: string | undefined,
): Promise<void> {
  const hitId = studioParseOrchestraHitInstrumentId(instrumentId);
  if (!hitId) return;
  const def = getOrchestraHitDef(hitId);
  if (!def) return;
  await loadOrchestraHitBuffer(ctx, def);
}

function studioHarmonyPreviewGainChain(
  ctx: AudioContext,
  bus: GainNode,
  t0: number,
  pan127: number,
  monoTrack: boolean,
  faderVol127: number,
): GainNode {
  const vGain = mixerVolToLinearGain(faderVol127);
  const hitGain = ctx.createGain();
  hitGain.gain.value = vGain;
  if (!monoTrack) {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, (pan127 - 64) / 63)), t0);
    hitGain.connect(panner);
    panner.connect(bus);
  } else {
    hitGain.connect(bus);
  }
  return hitGain;
}

export function studioPlayGrooveLeadOnPreviewBus(
  ctx: AudioContext,
  bus: GainNode,
  leadId: GrooveLabAnyLeadSoundId,
  t0: number,
  pitch: number,
  velocity01: number,
  pan127: number,
  monoTrack: boolean,
  faderVol127: number,
  bpm: number,
  holdBeats: number,
): boolean {
  const out = studioHarmonyPreviewGainChain(ctx, bus, t0, pan127, monoTrack, faderVol127);
  return playGrooveLabLeadSound(ctx, pitch, leadId, t0, velocity01, bpm, holdBeats, {
    outputNode: out,
    transportClean: true,
    maxSustainSec: Math.min(1.2, holdBeats * (60 / Math.max(40, bpm))),
  });
}

export function studioTrackOutputsMidiHarmony(tr: StudioHarmonyTrack | undefined): boolean {
  return studioTrackOutputsMidi(tr) && studioTrackIsInstrumentHarmonyChannel(tr);
}

export type StudioHarmonyKey = {
  keyRoot: number;
  keyMode: ChordMode;
};
