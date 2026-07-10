/** Beat Lab in-app help — one tab per major panel. */

export type BeatLabHelpTabId =
  | 'overview'
  | 'sampler'
  | 'kits'
  | 'pattern-bank'
  | 'sound-families'
  | 'grid'
  | 'transport';

export interface BeatLabHelpSection {
  id: BeatLabHelpTabId;
  label: string;
  title: string;
  lines: readonly string[];
}

export const BEAT_LAB_HELP_SECTIONS: readonly BeatLabHelpSection[] = [
  {
    id: 'overview',
    label: 'Start',
    title: 'Beat Lab — quick start',
    lines: [
      '1. Load sounds on the 16 sampler pads (or pick a Crew Kit / Pattern Bank preset).',
      '2. Paint steps on the drum grid — each row is a pad/lane (kick, snare, hats…).',
      '3. Set BPM, hit Play, and tweak mixer levels on CH 1–16.',
      '4. Save your kit, pattern, or full song from the toolbar rows.',
      'Banks A–H hold different pad kits. Pattern slots A & B hold two drum patterns.',
    ],
  },
  {
    id: 'sampler',
    label: 'Pads',
    title: 'Sampler — 16 pads',
    lines: [
      'Pads 1–16 match grid lanes 1–16 — load a kick on pad 1 and it plays on the kick row.',
      'Click a pad to select it. Use Load / Upload / Import folder to add your own WAVs.',
      'Kit browser opens folder kits (808s, claps, snares, hats) — pick a pad, then click a sample.',
      'FX and SRC BPM per pad: trim, pitch, filter, delay. Hit Apply before switching bank.',
      'UPLOAD highlights the target pad for Sound Families and folder imports.',
    ],
  },
  {
    id: 'kits',
    label: 'Kits',
    title: 'Crew kits & kit browser',
    lines: [
      'Crew Kits: producer-ready 16-pad mappings (Trap, R&B, Dance, Disco…).',
      'Load kit fills all 16 pads on the active bank. Default kits A–H preload flagship sounds.',
      'Kit browser: browse imported trap/drum folders by category and load any hit to any pad.',
      'Save kit stores every pad sample + FX. My saved kits reload your custom mappings.',
      'Pattern Bank presets often auto-pair a matching crew kit when you load a groove.',
    ],
  },
  {
    id: 'pattern-bank',
    label: 'Patterns',
    title: 'Pattern Bank',
    lines: [
      'Pick a genre chip (Trap, R&B, Disco, House…) to open the pattern menu.',
      'Click a pattern name to load its drum grid + recommended BPM (+ crew kit when paired).',
      'Slot A = Trap / R&B / Up Tempo / Dance / Disco / Techno. Slot B = Afro / Reggae / House.',
      'A→B copies slot A into B so you can build variations.',
      'Save pattern keeps your grid (and kit if checked). Reload anytime from My patterns.',
    ],
  },
  {
    id: 'sound-families',
    label: 'Sounds',
    title: 'Sound Families',
    lines: [
      'Browse bundled 808s, kicks, snares, and subs by family — same menu style as Pattern Bank.',
      'Select target pad (1–16) first, then click a sample to load it on that pad.',
      'Great for swapping 808s or subs after loading a Pattern Bank groove.',
      'Preview plays the sample once before you commit it to the pad.',
    ],
  },
  {
    id: 'grid',
    label: 'Grid',
    title: 'Step grid & sequencer',
    lines: [
      'Each row = one drum lane (pad). Columns = 16th-note steps in the bar.',
      'Click cells to toggle steps on/off. Play runs the pattern with the transport BPM.',
      'GRID STD shows sampler + grid. GRID FULL maximizes the editor workspace.',
      'Clear pattern wipes the current bank + slot. Clear lane clears one row only.',
      'ROLL / SYNTH views open melodic piano rolls on CH 17–32 (separate from drum pads).',
    ],
  },
  {
    id: 'transport',
    label: 'Play',
    title: 'Transport & tempo',
    lines: [
      'Play / Pause / Stop controls Beat Lab playback (independent clock from Studio Editor 2).',
      'BPM sets session tempo — Pattern Bank presets may set BPM when loaded.',
      'Metronome toggle clicks on the beat while playing.',
      'Loop region: set start bar + length to repeat a section.',
      'Bars / Time readouts follow the playhead. MIDI sends the pattern to Studio Editor 2.',
    ],
  },
] as const;

export const BEAT_LAB_HELP_INTRO_STORAGE = 'da-beatlab-help-intro-v1';
