/**
 * Chord Builder — Auto-Generate Complete Song Progression.
 *
 * Given a *seed* progression (the chords the user has already laid down on
 * the active tab) plus the active mode, produce a 5-section "song plan":
 *
 *     INTRO  →  PRE-CHORUS  →  CHORUS  →  BRIDGE  →  OUTRO
 *
 * The generator is **rule-based**, not statistical. It picks chord-role
 * positions out of the active mode's curated chord palette (the same
 * `defaultPads[]` that drives the visible Chord Scale strip) and slots
 * them into well-known section templates:
 *
 *   • Intro   — first two chords of the seed, repeated, so the song opens
 *               with the same harmonic colors the verse uses.
 *   • Pre-Ch. — subdominant → dominant. The universal "lift" into the
 *               chorus's downbeat tonic.
 *   • Chorus  — the Axis of Awesome shape (tonic-dominant-relative-
 *               subdominant), drawn from the mode's own role chords so it
 *               works for major, minor, dorian, harmonic minor, etc.
 *   • Bridge  — the chorus shape rotated to start on the relative chord
 *               (vi for major, VI for minor). Same vocabulary, opposite
 *               point of gravity — instant contrast without leaving the key.
 *   • Outro   — first two seed chords + dominant → tonic. Resolves home.
 *
 * Every chord emitted is guaranteed to be in `MODE_TABLES[mode].defaultPads`
 * so the downstream voicing engine (`chordSymbolToMidi`) can always render
 * it. No mode-specific edge cases for the caller.
 */

import type { ChordMode, ChordSymbol } from './chordBuilder';
import { getModePads } from './chordBuilder';

export type SongSectionName = 'Intro' | 'Pre-Chorus' | 'Chorus' | 'Bridge' | 'Outro';

export interface GeneratedSection {
  /** Section label used as the new Progression tab's name. */
  name: SongSectionName;
  /** Chord symbols to drop into the timeline (one per slot). */
  chords: ChordSymbol[];
  /** Plain-English explanation of why these chords landed here. Shown in
   *  the post-generation toast so the user understands the structure
   *  rather than feeling like the tool made arbitrary choices. */
  rationale: string;
}

export interface GenerateSongPlanArgs {
  /** Whatever's currently on the active tab's timeline (null slots stripped). */
  seed: ReadonlyArray<ChordSymbol>;
  /** Active key/mode — drives the role-chord lookup. */
  mode: ChordMode;
}

/** Generate a full 5-section song plan from a seed progression. */
export function generateSongPlan(args: GenerateSongPlanArgs): GeneratedSection[] {
  const seed = args.seed.filter((c): c is ChordSymbol => typeof c === 'string' && c.length > 0);
  if (seed.length === 0) {
    throw new Error('Add at least one chord to the active tab before generating a song.');
  }

  // Pull the mode's role-chord palette. `defaultPads` is ordered so that:
  //   index 0 = tonic (T)
  //   index 3 = subdominant (S)
  //   index 4 = dominant (D)   — or modal v if no major V in this mode
  //   index 5 = submediant / relative (R)
  // For modes with shorter pad sets we clamp to the last available index
  // so the templates never read undefined.
  const pads = getModePads(args.mode);
  const T = pads[0]!;
  const S = pads[Math.min(3, pads.length - 1)]!;
  const D = pads[Math.min(4, pads.length - 1)]!;
  const R = pads[Math.min(5, pads.length - 1)]!;

  // ── Intro ────────────────────────────────────────────────────────────
  // Echo the first 2 chords of the seed for 4 bars. If the seed has only
  // 1 chord, we fill the rest with tonic so the intro still resolves.
  const introChords: ChordSymbol[] =
    seed.length >= 2
      ? [seed[0]!, seed[1]!, seed[0]!, seed[1]!]
      : [seed[0]!, seed[0]!, T, T];

  // ── Pre-Chorus ───────────────────────────────────────────────────────
  // S → D builds tension that resolves when the chorus drops on T. Same
  // chord twice per slot so the pre-chorus feels patient and weighted.
  const preChorusChords: ChordSymbol[] = [S, S, D, D];

  // ── Chorus ───────────────────────────────────────────────────────────
  // T-D-R-S — Axis of Awesome. Translated into role chords it works in
  // major (I-V-vi-IV), minor (i-V-VI-iv), dorian (i-v-vi°-IV), etc.
  const chorusChords: ChordSymbol[] = [T, D, R, S];

  // ── Bridge ───────────────────────────────────────────────────────────
  // Rotate the chorus so the relative chord becomes the new "home".
  // R-S-T-D = vi-IV-I-V in major, VI-iv-i-V in minor. Familiar vocabulary,
  // unfamiliar gravity → exactly what a bridge should feel like.
  const bridgeChords: ChordSymbol[] = [R, S, T, D];

  // ── Outro ────────────────────────────────────────────────────────────
  // Bookend the intro: the seed's first 2 chords, then D → T to land
  // cleanly. If the seed only has 1 chord, we substitute T for the
  // second slot so the outro still cadences.
  const outroChords: ChordSymbol[] =
    seed.length >= 2
      ? [seed[0]!, seed[1]!, D, T]
      : [seed[0]!, T, D, T];

  return [
    {
      name: 'Intro',
      chords: introChords,
      rationale:
        "Echoes your verse's first two chords for 4 bars — same harmonic colors so the listener arrives in your key gently.",
    },
    {
      name: 'Pre-Chorus',
      chords: preChorusChords,
      rationale:
        'Subdominant → dominant lift. Builds tension that resolves the moment the chorus hits the tonic on bar 1.',
    },
    {
      name: 'Chorus',
      chords: chorusChords,
      rationale:
        "Axis of Awesome shape — tonic, dominant, relative, subdominant. The four-chord pattern behind a huge chunk of pop / R&B / film hooks, translated into your mode's own role chords.",
    },
    {
      name: 'Bridge',
      chords: bridgeChords,
      rationale:
        'The chorus rotated to start on the relative chord. Same four chords, opposite point of gravity — instant contrast without leaving the key.',
    },
    {
      name: 'Outro',
      chords: outroChords,
      rationale:
        'Quotes the intro again, then cadences dominant → tonic so the song lands cleanly on the root chord.',
    },
  ];
}
