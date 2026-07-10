/**
 * Synth Geno bass — follows chord roots in left-hand register, in key.
 */
import { mulberry32 } from '@/app/lib/groovePatternEngine';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import type { GenoHarmony } from '@/app/lib/studio/se2SynthGenoChordEngine';
import {
  GENO_BASS_MIDI_MAX,
  GENO_BASS_MIDI_MIN,
  genoBassPitchFromHarmonyRoot,
  genoNormalizePartNotes,
  genoWrapMidiToRange,
} from '@/app/lib/studio/se2SynthGenoRanges';

export type GenoBassPattern = 'root' | 'root-fifth' | 'walk' | 'funk' | 'kpop';

/**
 * Progression root in bass register — spelled chord root (keeps bVII, bVI, iv borrow).
 * Do NOT snap to diatonic major/minor or borrowed progressions sound wrong.
 */
function barRootMidi(col: { rootMidi: number }): number {
  return genoWrapMidiToRange(
    genoBassPitchFromHarmonyRoot(col.rootMidi),
    GENO_BASS_MIDI_MIN,
    GENO_BASS_MIDI_MAX,
  );
}

function pluginBassNotesForBar(
  bar: number,
  col: { rootMidi: number; tones: readonly number[] },
  opts: {
    beatsPerBar: number;
    pattern: GenoBassPattern;
    keyRoot: number;
    keyMode: StudioDetectedKeyMode;
  },
): StudioEditor2GenNote[] {
  const bpb = opts.beatsPerBar;
  const barStart = bar * bpb;
  const root = barRootMidi(col);
  const notes: StudioEditor2GenNote[] = [];

  if (opts.pattern === 'root') {
    notes.push({
      pitch: root,
      startBeat: barStart,
      durationBeats: bpb * 0.94,
      velocity: 90,
    });
    return notes;
  }

  if (opts.pattern === 'root-fifth') {
    notes.push({
      pitch: root,
      startBeat: barStart,
      durationBeats: bpb * 0.5,
      velocity: 92,
    });
    notes.push({
      pitch: root,
      startBeat: barStart + bpb * 0.5,
      durationBeats: bpb * 0.42,
      velocity: 84,
    });
    return notes;
  }

  if (opts.pattern === 'walk') {
    const step = bpb / 4;
    for (let q = 0; q < 4; q += 1) {
      notes.push({
        pitch: root,
        startBeat: barStart + q * step,
        durationBeats: step * 0.82,
        velocity: q === 0 ? 92 : 80,
      });
    }
    return notes;
  }

  if (opts.pattern === 'funk') {
    notes.push({
      pitch: root,
      startBeat: barStart,
      durationBeats: bpb * 0.52,
      velocity: 94,
    });
    notes.push({
      pitch: root,
      startBeat: barStart + bpb * 0.5,
      durationBeats: bpb * 0.22,
      velocity: 76,
    });
    if (bar % 2 === 1) {
      notes.push({
        pitch: root,
        startBeat: barStart + bpb * 0.78,
        durationBeats: bpb * 0.18,
        velocity: 72,
      });
    }
    return notes;
  }

  if (opts.pattern === 'kpop') {
    notes.push({
      pitch: root,
      startBeat: barStart,
      durationBeats: bpb * 0.42,
      velocity: 92,
    });
    notes.push({
      pitch: root,
      startBeat: barStart + bpb * 0.5,
      durationBeats: bpb * 0.24,
      velocity: 84,
    });
    notes.push({
      pitch: root,
      startBeat: barStart + bpb * 0.78,
      durationBeats: bpb * 0.18,
      velocity: 78,
    });
    return notes;
  }

  return notes;
}

/** Snap + normalize plugin bass — always locked to harmony columns per bar. */
export function genoFinalizePluginBassNotes(
  notes: readonly StudioEditor2GenNote[],
  harmony: GenoHarmony,
  beatsPerBar: number,
  keyRoot: number,
  keyMode: StudioDetectedKeyMode,
): StudioEditor2GenNote[] {
  return genoNormalizePartNotes(
    genoLockBassNotesToHarmony(notes, harmony, beatsPerBar, keyRoot, keyMode),
    'bass',
  );
}

/** Re-snap every bass hit to that bar's chord root (rhythm stays, pitch = root). */
export function genoLockBassNotesToHarmony(
  notes: readonly StudioEditor2GenNote[],
  harmony: GenoHarmony,
  beatsPerBar: number,
  keyRoot: number,
  keyMode: StudioDetectedKeyMode,
): StudioEditor2GenNote[] {
  const bpb = Math.max(1, beatsPerBar);
  return notes.map((n) => {
    const bar = Math.min(
      harmony.columns.length - 1,
      Math.max(0, Math.floor((n.startBeat + 1e-4) / bpb)),
    );
    const col = harmony.columns[bar];
    if (!col) return n;
    return { ...n, pitch: barRootMidi(col) };
  });
}

/** Regenerate bass for one loop bar only (Chord Generator). */
export function genoGeneratePluginBassForBar(opts: {
  harmony: GenoHarmony;
  bar: number;
  beatsPerBar: number;
  pattern: GenoBassPattern;
  seed: number;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
}): StudioEditor2GenNote[] {
  const col = opts.harmony.columns[opts.bar];
  if (!col) return [];
  const notes = pluginBassNotesForBar(opts.bar, col, {
    beatsPerBar: opts.beatsPerBar,
    pattern: opts.pattern,
    keyRoot: opts.keyRoot,
    keyMode: opts.keyMode,
  });
  return genoFinalizePluginBassNotes(
    notes,
    opts.harmony,
    opts.beatsPerBar,
    opts.keyRoot,
    opts.keyMode,
  );
}

/** Chord Generator — root-locked bass lines (not arpeggiated bounce). */
export function genoGeneratePluginBassFromHarmony(opts: {
  harmony: GenoHarmony;
  barCount: number;
  beatsPerBar: number;
  pattern: GenoBassPattern;
  seed: number;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
}): StudioEditor2GenNote[] {
  const notes: StudioEditor2GenNote[] = [];
  for (let bar = 0; bar < opts.barCount; bar += 1) {
    const col = opts.harmony.columns[bar];
    if (!col) continue;
    notes.push(
      ...pluginBassNotesForBar(bar, col, {
        beatsPerBar: opts.beatsPerBar,
        pattern: opts.pattern,
        keyRoot: opts.keyRoot,
        keyMode: opts.keyMode,
      }),
    );
  }
  return genoFinalizePluginBassNotes(
    notes,
    opts.harmony,
    opts.beatsPerBar,
    opts.keyRoot,
    opts.keyMode,
  );
}

export function genoGenerateBassFromHarmony(opts: {
  harmony: GenoHarmony;
  barCount: number;
  beatsPerBar: number;
  pattern: GenoBassPattern;
  seed: number;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
}): StudioEditor2GenNote[] {
  const rnd = mulberry32(opts.seed ^ 0xba55);
  const notes: StudioEditor2GenNote[] = [];
  const bpb = opts.beatsPerBar;

  for (let bar = 0; bar < opts.barCount; bar += 1) {
    const col = opts.harmony.columns[bar];
    if (!col) continue;

    const root = barRootMidi(col);
    const barStart = bar * bpb;

    if (opts.pattern === 'root') {
      notes.push({
        pitch: root,
        startBeat: barStart,
        durationBeats: bpb * 0.92,
        velocity: 92,
      });
      continue;
    }

    if (opts.pattern === 'root-fifth') {
      notes.push({
        pitch: root,
        startBeat: barStart,
        durationBeats: bpb * 0.45,
        velocity: 94,
      });
      notes.push({
        pitch: root,
        startBeat: barStart + bpb * 0.5,
        durationBeats: bpb * 0.42,
        velocity: 86,
      });
      continue;
    }

    if (opts.pattern === 'funk') {
      const sixteenth = bpb / 16;
      const variants: readonly { slot: number; durSlots: number; vel: number }[][] = [
        [
          { slot: 0, durSlots: 5, vel: 98 },
          { slot: 6, durSlots: 2, vel: 76 },
          { slot: 10, durSlots: 3, vel: 86 },
          { slot: 14, durSlots: 2, vel: 90 },
        ],
        [
          { slot: 0, durSlots: 4, vel: 96 },
          { slot: 4, durSlots: 2, vel: 82 },
          { slot: 8, durSlots: 3, vel: 92 },
          { slot: 13, durSlots: 3, vel: 78 },
        ],
      ];
      const groove = variants[bar % variants.length]!;
      for (const hit of groove) {
        notes.push({
          pitch: root,
          startBeat: barStart + hit.slot * sixteenth,
          durationBeats: hit.durSlots * sixteenth * 0.9,
          velocity: Math.min(110, hit.vel + Math.floor(rnd() * 8) - 2),
        });
      }
      continue;
    }

    if (opts.pattern === 'kpop') {
      const eighth = bpb / 8;
      const groove = [
        { slot: 0, durSlots: 3, vel: 94 },
        { slot: 4, durSlots: 2, vel: 82 },
        { slot: 7, durSlots: 2, vel: 88 },
        { slot: 10, durSlots: 2, vel: 90 },
        { slot: 14, durSlots: 2, vel: 84 },
      ];
      for (const hit of groove) {
        notes.push({
          pitch: root,
          startBeat: barStart + hit.slot * eighth,
          durationBeats: hit.durSlots * eighth * 0.88,
          velocity: Math.min(108, hit.vel + Math.floor(rnd() * 6) - 2),
        });
      }
      continue;
    }

    const step = bpb / 4;
    for (let q = 0; q < 4; q += 1) {
      notes.push({
        pitch: root,
        startBeat: barStart + q * step,
        durationBeats: step * 0.88,
        velocity: 80 + (q === 0 ? 12 : 0),
      });
    }
  }

  return genoFinalizePluginBassNotes(
    notes,
    opts.harmony,
    opts.beatsPerBar,
    opts.keyRoot,
    opts.keyMode,
  );
}

/** Legato overlap between pitch changes — used for loop preview + glide visuals. */
export function genoApplyBassGlide(
  notes: readonly StudioEditor2GenNote[],
  opts?: { enabled?: boolean; overlapBeats?: number },
): StudioEditor2GenNote[] {
  if (opts?.enabled === false || notes.length === 0) return [...notes];
  const overlap = opts?.overlapBeats ?? 0.1;
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  const out = sorted.map((n) => ({ ...n }));
  for (let i = 0; i < out.length - 1; i += 1) {
    const cur = out[i]!;
    const next = out[i + 1]!;
    if (cur.pitch === next.pitch) continue;
    const targetEnd = next.startBeat + overlap;
    const newDur = targetEnd - cur.startBeat;
    if (newDur > cur.durationBeats) cur.durationBeats = newDur;
  }
  return out;
}
