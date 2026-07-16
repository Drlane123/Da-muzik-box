/** Chord Builder in-app help — progression workflow is the flagship path. */

export type ChordBuilderHelpTabId =
  | 'overview'
  | 'progressions'
  | 'pads'
  | 'roll'
  | 'melody'
  | 'sound'
  | 'export'
  | 'transport';

export interface ChordBuilderHelpSection {
  id: ChordBuilderHelpTabId;
  label: string;
  title: string;
  highlight?: boolean;
  lines: readonly string[];
}

export const CHORD_BUILDER_HELP_SECTIONS: readonly ChordBuilderHelpSection[] = [
  {
    id: 'overview',
    label: 'Start',
    title: 'Chord Builder — quick start',
    lines: [
      'Set KEY + MODE + GENRE in the toolbar — pads and presets follow your scale.',
      'Tap CHORD SCALE pads to audition — double-click adds to the timeline.',
      'Drag a pad onto any piano-roll bar to place that chord.',
      'Use PROGRESSION tabs for song sections — AUTO-GENERATE SONG builds a full plan.',
      '▶ PLAY previews chords — Loop keeps the progression repeating until Stop.',
      'Save MIDI / MIDI → SYNTH sends harmony to Beat Lab.',
    ],
  },
  {
    id: 'progressions',
    label: '★ Progression',
    title: 'Progressions & song sections',
    highlight: true,
    lines: [
      'PROGRESSION tabs hold separate sections — click to switch, double-click to rename.',
      '+ New adds a tab; AUTO-GENERATE SONG builds Intro · Pre-Chorus · Chorus · Bridge · Outro.',
      'CHORD PROGRESSIONS strip loads genre presets (R&B, Gospel, Pop…) onto the roll.',
      'PROFESSIONAL CHORD PROGRESSIONS library — browse hit-song categories and tap to load.',
      'Generate fills empty bars; Suggest Next adds one smart chord from genre rules.',
      'Dup loop doubles your bar range (content) — extend a 4-bar phrase to 8 before export.',
      'Transport Loop (next to Play) repeats playback — different from Dup loop.',
    ],
  },
  {
    id: 'pads',
    label: 'Pads',
    title: 'Chord scale pads',
    lines: [
      'Pads show scale degrees (I, ii, V…) in the current KEY + MODE.',
      'Click a pad to audition — lit pads with numbers are already in your progression.',
      'Double-click adds that chord to the next open bar on the timeline.',
      'Drag any pad onto a piano-roll bar header to drop the chord there.',
      'Tap numbered pads 1→N in order to hear the full progression set.',
    ],
  },
  {
    id: 'roll',
    label: 'Roll',
    title: 'Piano roll & chord grid',
    lines: [
      'Chord blocks paint across the roll — one bar (or more) per chord in the timeline.',
      'Click bar headers to place chords; click cells to add/remove individual notes.',
      'Select / Draw / Erase tools — Draw paints notes, Erase removes them (drag across cells).',
      'Drag ruler for playhead; drag notes to move; drag right edge to resize length.',
      'Copy notes / Paste notes (toolbar or Ctrl+C/V) for bar-range note edits.',
      'Open AI SUGGESTIONS & CHORD GRID for beat-precise blocks and AI next-chord picks.',
      'MIN / FIT / MAX resize the roll — ESC exits MAX overlay first, then closes Builder.',
    ],
  },
  {
    id: 'melody',
    label: 'Match',
    title: 'Melody Match — hum to chords',
    lines: [
      'HUM records your melody — MATCH analyzes pitch and suggests progressions.',
      'Upload a short audio file or use LIVE voice-MIDI to capture notes in real time.',
      'Pick a candidate progression and apply it — chords load on the active tab.',
      'Great for turning a vocal idea into a starter progression before you refine on the roll.',
    ],
  },
  {
    id: 'sound',
    label: 'Sound',
    title: 'Voice, voicing & FX',
    lines: [
      'Sound dropdown in toolbar — piano, strings, pad voices preview on pad click.',
      'SMART VOICINGS spreads chord tones across the roll (toggle in chord readout + SMART button).',
      'Voicing size (3–7 keys), spread, tension, and Oct shift shape each chord stack.',
      'ARP toggles arpeggiator pattern on playback; FX knobs = delay + low/high cut.',
    ],
  },
  {
    id: 'export',
    label: 'Export',
    title: 'Save & send harmony',
    lines: [
      'Save MIDI downloads the active tab as a .mid file.',
      'MIDI → SYNTH sends chords into Beat Lab SYNTH lanes (CH 17–32).',
      'WAV → Pad bounces the section to a Beat Lab sampler pad (pick pad 1–16).',
      'Roots → 808 sends chord roots into 808 Lab for bass-lock follow.',
      'SONG cluster exports all progression tabs back-to-back (Song → WAV / MIDI / SYNTH).',
    ],
  },
  {
    id: 'transport',
    label: 'Play',
    title: 'Transport & tempo',
    lines: [
      '▶ PLAY / ■ STOP previews the active progression tab with the selected voice.',
      'Loop (default ON) repeats the progression forever — turn OFF to play once then stop.',
      'BPM sets preview tempo — SYNC links to project BPM when Beat Lab is running.',
      'TAP tempo for quick BPM entry; synced mode follows Creation Station session BPM.',
      'Session play-link can mirror Beat Lab transport start/stop when enabled.',
      'Dup loop in the bars toolbar doubles timeline length — it is not the transport Loop.'
    ],
  },
] as const;

export const CHORD_BUILDER_HELP_INTRO_STORAGE = 'da-chord-builder-help-intro-v1';
