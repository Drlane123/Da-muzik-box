/** Chord/Bass Sequencer — standard long chord step sequencer; bass rides on the chord row. */

export type ChordBassSequencerHelpTabId =
  | 'overview'
  | 'chords'
  | 'bass'
  | 'slots'
  | 'roll'
  | 'export'
  | 'transport';

export interface ChordBassSequencerHelpSection {
  id: ChordBassSequencerHelpTabId;
  label: string;
  title: string;
  highlight?: boolean;
  lines: readonly string[];
}

export const CHORD_BASS_SEQUENCER_HELP_SECTIONS: readonly ChordBassSequencerHelpSection[] = [
  {
    id: 'overview',
    label: 'Start',
    title: 'Standard chord step sequencer',
    lines: [
      'This is a straight chord sequencer — not Groove Lab, not Beat Lab pads, not a piece-by-piece roll builder.',
      'Workflow: pick CHORD PADS → place chords in the STEPS row left to right → ▶ PLAY your progression.',
      'One long step lane is the song — 4 to 32 steps, each step = one chord holding through the bar grid.',
      'Bass is built around those chord steps automatically (POCKET, POP 4, 808 SUB, etc.) — not a separate build flow.',
      'Mute CHORDS to solo the bass; the step row still drives timing and root notes underneath.',
      'Optional links: ROOTS → 808, EXPORT MIDI/WAV/pad, MIDI OUT — the core job is sequencing chords + bass here.',
    ],
  },
  {
    id: 'chords',
    label: 'Chords',
    title: 'Chord pads & the step sequencer',
    lines: [
      'The STEPS row is the sequencer — your chord progression runs left to right across every step.',
      'Set KEY + major/minor + GENRE; chord pads show scale degrees for that style.',
      'Click a pad to hear it; click or drag onto a STEP cell to drop that chord in the lane.',
      'STEPS count (4–32): longer songs = more steps — this is a standard step-sequencer timeline, not a sketch pad.',
      'CHORD PROGRESSIONS loads full loops into the step row; SUGGEST / LOAD CUSTOM fill from genre rules.',
      'OPEN PANEL: Orchid voicing (type, extensions, inversion, strum) per pad before you sequence.',
    ],
  },
  {
    id: 'bass',
    label: '★ Bass',
    title: 'Bass locked to your chord steps',
    highlight: true,
    lines: [
      'Every bass hit is tied to a chord step — place chords first, bass follows the same step grid.',
      'VOICE: SUB (trap/R&B 808) · ELEC (soul/funk finger) · PLUCK (pop/dance stab).',
      'ANCHOR patterns carry the song — POCKET (neo-soul), 808 SUB, POP 4, PUSH, REGGAE, HALF-TIME…',
      'MOTION patterns walk between chords — WALKING, MOTOWN, GOSPEL, funk ghosts, arps.',
      'FEEL: FIFTH, SYNCOPATED, DOTTED, DISCO — rhythmic flavor on top of the harmony.',
      'SWING · LENGTH · SLIDE · FILLS shape every hit; ♪ AUTO-WRITE paints pattern across all steps.',
      'Right-click a bass step cell to mute that step; CHORDS MUTED solos bass while steps keep running.',
    ],
  },
  {
    id: 'slots',
    label: 'Slots',
    title: 'Bass slot bank A–H',
    lines: [
      '8 colored slots save a complete bass kit: voice + pattern + swing/length/slide + painted line.',
      'Click empty slot → saves current settings; click filled slot → loads globally.',
      'Shift+click any slot → force-overwrite with current kit + painted notes.',
      'Per-step chip (top-left of bass cell): cycle slot A–H so Verse ≠ Chorus without mid-play edits.',
      '★ SAVE LINE → SLOT in the piano roll saves kit + hand-painted bass across all steps.',
      'Right-click a filled slot to clear it.',
    ],
  },
  {
    id: 'roll',
    label: 'Roll',
    title: 'Bass piano roll',
    lines: [
      'Full timeline view — every step’s bass on one scrollable grid (DAW-style).',
      'Click a step header to set FOCUS; ghost cells show the global pattern until you paint over it.',
      'PAINT tool adds notes; ERASE removes — drag notes to move, right edge to resize length.',
      '⎘ COPY LINE / 📋 PASTE LINE / ✕ CLEAR LINE work across the whole arrangement.',
      '⟳ AUTO-SCROLL tracks the playhead during playback; MAX opens near-fullscreen edit.',
      'Linked Orchid chords can fire on each painted bass hit (volume slider in bass header).',
    ],
  },
  {
    id: 'export',
    label: 'Export',
    title: 'Save & optional links',
    lines: [
      'Finish your chord + bass sequence here first — export is optional, not the main workflow.',
      '💾 EXPORT WAV — render the full step sequence (chords + bass) to audio.',
      '🎼 EXPORT MIDI — chords on ch 1, painted bass on ch 2 (.mid for any DAW).',
      '▶ EXPORT PAD — bounce the progression into a Beat Lab sampler pad.',
      'ROOTS → 808 — optional link: sends each chord step’s root note to 808 Lab (does not replace sequencing here).',
      'MIDI OUT routes live step playback to external gear (loopMIDI / IAC Driver).',
    ],
  },
  {
    id: 'transport',
    label: 'Play',
    title: 'Play the step sequence',
    lines: [
      '▶ PLAY steps through your chord lane left to right — standard sequencer transport.',
      'Chords and bass share one clock; the playhead moves across every step in the row.',
      'BPM in header sets tempo; TEMPO AUTO matches genre when enabled.',
      'CHORDS MUTED = hear bass only while the chord step row still advances underneath.',
      'BASS OFF mutes the whole bass lane; per-step right-click mutes individual bass steps.',
      '▶ PREVIEW in bass header auditions the current pattern on the first chord.',
    ],
  },
] as const;

export const CHORD_BASS_SEQUENCER_HELP_INTRO_STORAGE = 'da-chord-bass-seq-help-intro-v1';
