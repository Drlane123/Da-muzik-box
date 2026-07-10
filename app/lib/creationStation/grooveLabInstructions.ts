/** Groove Lab in-app help — Progression tab is the flagship workflow. */

export type GrooveLabHelpTabId =
  | 'overview'
  | 'progression'
  | 'chords'
  | 'channels'
  | 'mixer'
  | 'roll'
  | 'transport';

export interface GrooveLabHelpSection {
  id: GrooveLabHelpTabId;
  label: string;
  title: string;
  highlight?: boolean;
  lines: readonly string[];
}

export const GROOVE_LAB_HELP_SECTIONS: readonly GrooveLabHelpSection[] = [
  {
    id: 'overview',
    label: 'Start',
    title: 'Groove Lab — quick start',
    lines: [
      'Open PROGRESSION first — pick a genre-pack loop, audition it, then drop chords to the roll.',
      'Set KEY + major/minor under Groove Studio so progressions resolve in the right scale.',
      'CH 33–48 are your work lanes — assign CHORD, GUITAR, LEAD, or SAMPLE per channel.',
      'Paint and edit on the piano roll, then Play transport to hear the full arrangement.',
      'Export MIDI/WAV or send chords to Beat Lab NEW SYNTH when the groove feels right.',
    ],
  },
  {
    id: 'progression',
    label: '★ Progression',
    title: 'Progression — the heart of Groove Lab',
    highlight: true,
    lines: [
      'Click PROGRESSION ▾ in the green chord strip — genre packs, 8-bar sketch, timeline, and Rhythm Edit all live here.',
      'Browse genre packs (R&B, Reggae, Gospel, Pop…) — HEAR / LOOP a pack before you commit.',
      'PACK PREVIEW: hear each chord · + TIMELINE adds one step · LOAD ALL fills the main builder.',
      '8-BAR SONG SKETCH: pick a song bank, audition bars, send to main timeline or drop straight to the roll.',
      'YOUR TIMELINE: stack chords step-by-step — ▶ PLAY / ↻ LOOP the full progression before you drop.',
      'TEMPO AUTO matches genre BPM; BUILD stages the timeline for drop and export.',
      'DROP TO PIANO ROLL paints green chord notes on the CHORD lane — progression drives the roll.',
      '+ MATCH BASS follows chord roots when you drop with bass-match options.',
      '★ RHYTHM EDIT BOX (inside Progression): expand under the song sketch — chop one chord without changing the main timeline until drop.',
      'One chord, many piano-roll hits: repeat Am on the quantized beat grid — same harmony on beats 1, 2, 3, 4.',
      'HITS PER BAR (1×–4×) + BEAT PICK (1+3, 2+4, 1+2+3+4…) = 2–4 strikes per bar — reggae skips, stabs, phased chops.',
      'Stretch each step (¼ · ½ · FULL BAR) — chop timing, not chord names. ▶ PLAY EDITED, then DROP TO PIANO ROLL.',
      'Export timeline MIDI/WAV, send to NEW SYNTH, or save the roll when the groove locks.',
    ],
  },
  {
    id: 'chords',
    label: 'Chords',
    title: 'Orchid chord strip',
    lines: [
      'Green C layer = chord channel — piano/strings voices, not 808 subs.',
      'TYPE buttons (maj, min, 7, dim…) shape the chord you write to the grid.',
      'SMART MATCH picks the right quality per scale degree on the bass keypad.',
      '+ CHORD TO GRID stacks the current chord at the edit column on the roll.',
      'Guitar pack and Orchestra hit panels add licks and stabs on their lanes.',
    ],
  },
  {
    id: 'channels',
    label: 'CH',
    title: 'Channels CH 33–48',
    lines: [
      'Eight lanes per bank — click a strip to select which channel you edit.',
      'Assign each CH to CHORD, GUITAR, GROOVE LEAD, or SAMPLE role.',
      'Note counts on each strip show what is already on the roll.',
      'Selecting a channel switches the piano roll to that lane\'s hits.',
    ],
  },
  {
    id: 'mixer',
    label: 'Mixer',
    title: 'Groove Lab mixer',
    lines: [
      'Mixer opens the 16-channel fader panel for CH 33–48.',
      'Balance CHORD, LEAD, GUITAR, and SAMPLE lanes before export.',
      'Mute/solo per strip — solo bass line while chords stay muted underneath.',
      'Volumes persist in session and feed transport playback levels.',
    ],
  },
  {
    id: 'roll',
    label: 'Roll',
    title: 'Piano roll editor',
    lines: [
      'Edit the selected channel — pointer, draw, erase, and velocity tools.',
      'FULL expands the roll workspace; DOCK returns to split view.',
      'Drag MIDI files onto the roll to import grooves.',
      'Quantize + bar count set grid resolution; edit column is the green playhead column.',
      'Progression DROP lands chopped chords here — one harmony, multiple green notes per bar on the grid.',
      'Octave buttons shift chord or melody stacks without re-building the progression.',
    ],
  },
  {
    id: 'transport',
    label: 'Play',
    title: 'Transport & tempo',
    lines: [
      'Play / Pause / Stop runs Groove Lab\'s own clock (separate from Beat Lab).',
      'BPM in Progression panel can auto-match genre tempo when TEMPO AUTO is ON.',
      'Metronome clicks while playing — toggle MET in the mixer toolbar.',
      'Rewind / FF nudge the playhead; loop region respects bar count settings.',
    ],
  },
] as const;

export const GROOVE_LAB_HELP_INTRO_STORAGE = 'da-groove-lab-help-intro-v2';
export const GROOVE_LAB_PROGRESSION_CALLOUT_STORAGE = 'da-groove-lab-progression-callout-v2';
