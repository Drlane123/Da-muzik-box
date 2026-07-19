/**
 * Live Chord — full voicing for one-shot play (no inversion note-drop).
 */
import type { ChordMode, ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import { cbPianoMidiToNoteName } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import {
  GENO_LIVE_CHORD_MIDI_MAX,
  GENO_LIVE_CHORD_MIDI_MIN,
  GENO_LIVE_CHORD_ROOT_OCTAVE_MIDI,
  genoLiftVoicingToRange,
  genoNormalizePluginChordNotes,
  genoOctaveAlignVoicingToReference,
} from '@/app/lib/studio/se2SynthGenoRanges';
import type { GenoBarChordSpec, GenoExtension } from '@/app/lib/studio/se2SynthGenoChordEngine';
import { genoBuildHarmony, genoHarmonyToNotes } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import {
  SE2_SYNTH_GENO_LIVE_REGISTER_REFERENCE_GENRE,
  se2SynthGenoLiveRebuildSpecForDegree,
  se2SynthGenoLiveChordModeToKeyMode,
  se2SynthGenoLiveRomanToBarSpec,
  se2SynthGenoLiveSlotSpecForVoice,
} from '@/app/lib/studio/se2SynthGenoLiveChordRoman';
import type { Se2SynthGenoLiveGenreId, Se2SynthGenoLivePreset } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import {
  se2SynthGenoDefaultVoicingDepth,
  se2SynthGenoDedenseCompVoicing,
  se2SynthGenoEnrichChordIntervals,
  se2SynthGenoEnrichForStyle,
  se2SynthGenoFinalizeVoicedMidis,
  type GenoVoicingDepth,
} from '@/app/lib/studio/se2SynthGenoVoicingDepth';
import {
  SE2_OPEN_JAZZ_NEO_MIDI_MAX,
  SE2_OPEN_JAZZ_NEO_MIDI_MIN,
  se2GenreUsesOpenJazzNeoVoicing,
  se2OpenJazzNeoVoicing,
} from '@/app/lib/studio/se2OpenJazzNeoVoicing';

function liveCompDepth(spec: GenoBarChordSpec, genreId?: Se2SynthGenoLiveGenreId): GenoVoicingDepth {
  return (spec.voicingDepth
    ?? (genreId ? se2SynthGenoDefaultVoicingDepth(genreId) : 5)) as GenoVoicingDepth;
}

function liveCompFinish(
  tones: number[],
  depth: GenoVoicingDepth,
  genreId?: Se2SynthGenoLiveGenreId,
): number[] {
  if (se2GenreUsesOpenJazzNeoVoicing(genreId)) {
    const opened = se2OpenJazzNeoVoicing(tones);
    return se2SynthGenoFinalizeVoicedMidis(
      opened,
      depth,
      SE2_OPEN_JAZZ_NEO_MIDI_MIN,
      SE2_OPEN_JAZZ_NEO_MIDI_MAX,
    );
  }
  const lifted = genoLiftVoicingToRange(tones, GENO_LIVE_CHORD_MIDI_MIN, GENO_LIVE_CHORD_MIDI_MAX);
  return se2SynthGenoFinalizeVoicedMidis(
    se2SynthGenoDedenseCompVoicing(lifted, depth),
    depth,
    GENO_LIVE_CHORD_MIDI_MIN,
    GENO_LIVE_CHORD_MIDI_MAX,
  );
}

function normalizePc(n: number): number {
  return ((Math.round(n) % 12) + 12) % 12;
}

function intervalsForSpec(
  spec: GenoBarChordSpec,
  stylePreset: GenoChordStyle,
  genreId?: Se2SynthGenoLiveGenreId,
): number[] {
  const base = spec.chordIntervals;
  if (!base?.length) return [];
  const depth = liveCompDepth(spec, genreId);
  if (genreId) {
    return se2SynthGenoEnrichChordIntervals(base, depth, genreId);
  }
  return se2SynthGenoEnrichForStyle(base, depth, stylePreset);
}

function liveSpecWithIntervals(
  spec: GenoBarChordSpec,
  chordMode: ChordMode,
  genreId?: Se2SynthGenoLiveGenreId,
): GenoBarChordSpec {
  if (spec.chordIntervals?.length) return spec;
  if (!genreId) return spec;
  const rebuilt = se2SynthGenoLiveRebuildSpecForDegree(spec.degree, chordMode, genreId, {
    voicingDepth: spec.voicingDepth,
    chopQuant: spec.chopQuant,
    inversion: spec.inversion,
  });
  return rebuilt;
}

/** Chord root in comp register — progression trigger label (E, G, D… not chromatic slot). */
export function se2SynthGenoLiveChordRootNote(
  keyRoot: number,
  spec: GenoBarChordSpec,
  stylePreset: GenoChordStyle,
  genreId?: Se2SynthGenoLiveGenreId,
): { rootMidi: number; noteName: string } {
  const enriched = intervalsForSpec(spec, stylePreset, genreId);
  if (!enriched.length) {
    return { rootMidi: GENO_LIVE_CHORD_ROOT_OCTAVE_MIDI, noteName: 'C' };
  }
  const rootIv = enriched[0]!;
  const baseOct = Math.floor(GENO_LIVE_CHORD_ROOT_OCTAVE_MIDI / 12) * 12;
  const rootMidi = baseOct + normalizePc(keyRoot) + rootIv;
  const noteName = cbPianoMidiToNoteName(rootMidi).replace(/\d+$/, '');
  return { rootMidi, noteName };
}

function applyInversion(sorted: number[], steps: number): number[] {
  if (sorted.length === 0) return sorted;
  let out = [...sorted].sort((a, b) => a - b);
  const n = ((steps % out.length) + out.length) % out.length;
  for (let i = 0; i < n; i += 1) {
    const low = out.shift()!;
    out.push(low + 12);
  }
  return out.filter((m) => m <= GENO_LIVE_CHORD_MIDI_MAX + 12);
}

function voiceFromIntervals(
  spec: GenoBarChordSpec,
  keyRoot: number,
  stylePreset: GenoChordStyle,
  genreId?: Se2SynthGenoLiveGenreId,
  presetInversion = 0,
): number[] {
  const enriched = intervalsForSpec(spec, stylePreset, genreId);
  if (!enriched.length) return [];
  const rootIv = enriched[0]!;
  const baseOct = Math.floor(GENO_LIVE_CHORD_ROOT_OCTAVE_MIDI / 12) * 12;
  const rootMidi = baseOct + normalizePc(keyRoot) + rootIv;
  let tones = [...new Set(enriched.map((iv) => rootMidi + (iv - rootIv)))].sort((a, b) => a - b);
  tones = applyInversion(tones, spec.inversion ?? presetInversion);
  const depth = liveCompDepth(spec, genreId);
  if (spec.stackOctave && tones.length >= 3 && tones.length < depth) {
    const top = tones[tones.length - 1]!;
    if (top + 12 <= GENO_LIVE_CHORD_MIDI_MAX + 12) {
      tones = [...new Set([...tones, top + 12])].sort((a, b) => a - b);
    }
  }
  return liveCompFinish(tones, depth, genreId);
}

export function se2SynthGenoVoiceLiveChord(
  keyRoot: number,
  chordMode: ChordMode,
  spec: GenoBarChordSpec,
  stylePreset: GenoChordStyle,
  _extensions: readonly GenoExtension[],
  inversion: number,
  genreId?: Se2SynthGenoLiveGenreId,
): number[] {
  const voiced = liveSpecWithIntervals(spec, chordMode, genreId);
  return voiceFromIntervals(voiced, keyRoot, stylePreset, genreId, inversion);
}

/** Single choke point — pad play, loop preview, bar regen all use this. */
export function se2SynthGenoLiveVoiceSlot(
  preset: Pick<
    Se2SynthGenoLivePreset,
    'romans' | 'mode' | 'genreId' | 'stylePreset' | 'extensions' | 'inversion'
  >,
  slotIndex: number,
  keyRoot: number,
  overrides?: Pick<GenoBarChordSpec, 'voicingDepth' | 'chopQuant'>,
): number[] {
  const roman = preset.romans[slotIndex];
  if (!roman) return [];
  const spec = se2SynthGenoLiveSlotSpecForVoice(preset, slotIndex, overrides);
  if (!spec) return [];

  let tones = se2SynthGenoVoiceLiveChord(
    keyRoot,
    preset.mode,
    spec,
    preset.stylePreset,
    preset.extensions,
    preset.inversion,
    preset.genreId,
  );

  if (preset.genreId === 'pop' || preset.genreId === 'rnb-pop' || preset.genreId === 'afrobeats') {
    const refSpec = se2SynthGenoLiveRomanToBarSpec(
      roman,
      preset.mode,
      SE2_SYNTH_GENO_LIVE_REGISTER_REFERENCE_GENRE,
    );
    const refTones = se2SynthGenoVoiceLiveChord(
      keyRoot,
      preset.mode,
      refSpec,
      preset.stylePreset,
      preset.extensions,
      preset.inversion,
      SE2_SYNTH_GENO_LIVE_REGISTER_REFERENCE_GENRE,
    );
    tones = genoOctaveAlignVoicingToReference(tones, refTones);
  }

  return tones;
}

export function se2SynthGenoVoiceLiveRoman(
  keyRoot: number,
  roman: ChordSymbol,
  mode: ChordMode,
  genreId: Se2SynthGenoLiveGenreId,
): number[] {
  const spec = se2SynthGenoLiveRomanToBarSpec(roman, mode, genreId);
  return voiceFromIntervals(spec, keyRoot, 'rnb', genreId);
}

/** Loop preview chord lane — one voiced block per bar, matched to live pad voicing. */
export function se2SynthGenoLiveDraftChordNotes(opts: {
  barSpecs: readonly GenoBarChordSpec[];
  barCount: number;
  beatsPerBar: number;
  keyRoot: number;
  chordMode: ChordMode;
  stylePreset: GenoChordStyle;
  extensions: readonly GenoExtension[];
  inversion: number;
  genreId: Se2SynthGenoLiveGenreId;
  preset?: Pick<
    Se2SynthGenoLivePreset,
    'romans' | 'mode' | 'genreId' | 'stylePreset' | 'extensions' | 'inversion' | 'loopLength'
  >;
  slotForBar?: (bar: number) => number;
}): StudioEditor2GenNote[] {
  const needsEnginePath = opts.barSpecs.some(
    (s) => s?.passingTail || (s?.chopQuant && s.chopQuant !== 'whole'),
  );

  if (needsEnginePath) {
    const keyMode = se2SynthGenoLiveChordModeToKeyMode(opts.chordMode);
    const settings = {
      keyRoot: opts.keyRoot,
      keyMode,
      barCount: opts.barCount,
      beatsPerBar: opts.beatsPerBar,
      progressionId: 'hold-i' as const,
      smartMatch: true,
      lockedType: 'maj' as const,
      extensions: new Set(opts.extensions),
      inversion: opts.inversion,
      perfMode: 'block' as const,
      staccato: false,
      repeaterQuant: '1/8' as const,
      includeBassRoot: false,
      barChordSpecs: opts.barSpecs,
      stylePreset: opts.stylePreset,
    };
    const harmony = genoBuildHarmony(settings);
    return genoNormalizePluginChordNotes(genoHarmonyToNotes(settings, harmony));
  }

  const notes: StudioEditor2GenNote[] = [];
  const barDur = Math.max(0.5, opts.beatsPerBar * 0.92);
  for (let bar = 0; bar < opts.barCount; bar += 1) {
    const spec = opts.barSpecs[bar];
    if (!spec) continue;
    let tones = se2SynthGenoVoiceLiveChord(
      opts.keyRoot,
      opts.chordMode,
      spec,
      opts.stylePreset,
      opts.extensions,
      opts.inversion,
      opts.genreId,
    );
    if (opts.preset && opts.slotForBar) {
      const slotIndex = opts.slotForBar(bar);
      const roman = opts.preset.romans[slotIndex];
      if (
        roman
        && (opts.preset.genreId === 'pop' || opts.preset.genreId === 'rnb-pop' || opts.preset.genreId === 'afrobeats')
      ) {
        const refSpec = se2SynthGenoLiveRomanToBarSpec(
          roman,
          opts.preset.mode,
          SE2_SYNTH_GENO_LIVE_REGISTER_REFERENCE_GENRE,
        );
        const refTones = se2SynthGenoVoiceLiveChord(
          opts.keyRoot,
          opts.preset.mode,
          refSpec,
          opts.preset.stylePreset,
          opts.preset.extensions,
          opts.preset.inversion,
          SE2_SYNTH_GENO_LIVE_REGISTER_REFERENCE_GENRE,
        );
        tones = genoOctaveAlignVoicingToReference(tones, refTones);
      }
    }
    const startBeat = bar * opts.beatsPerBar;
    for (const pitch of tones) {
      notes.push({
        pitch,
        startBeat,
        durationBeats: barDur,
        velocity: 88 - (bar % 2) * 4,
      });
    }
  }
  return notes;
}
