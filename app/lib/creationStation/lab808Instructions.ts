/** 808 Lab in-app help — chord-lock + kick/bass roll is the flagship workflow. */

export type Lab808HelpTabId =
  | 'overview'
  | 'chord-lock'
  | 'pads'
  | 'roll'
  | 'drums'
  | 'sync'
  | 'export'
  | 'transport';

export interface Lab808HelpSection {
  id: Lab808HelpTabId;
  label: string;
  title: string;
  highlight?: boolean;
  lines: readonly string[];
}

export const LAB808_HELP_SECTIONS: readonly Lab808HelpSection[] = [
  {
    id: 'overview',
    label: 'Start',
    title: '808 Lab — quick start',
    lines: [
      'Switch **808 Kick / Bass** or **Drum kits** at the top — pads + roll share one transport.',
      '16 tone pads = chromatic 808 kick or bass hits; Drum kits = MPC one-shots + step grid.',
      'CHORD LOCK → pick CB / GL / NS → **GENERATE ROOTS** writes bass roots to the roll.',
      'Paint or drag notes on the Kick/Bass roll; ▶ PLAY previews with the selected preset.',
      'Export MIDI/WAV or bounce to a Beat Lab pad when the groove locks.',
    ],
  },
  {
    id: 'chord-lock',
    label: '★ Chord lock',
    title: 'Chord lock — follow your harmony',
    highlight: true,
    lines: [
      'Turn on **CHORD LOCK** on the Kick/Bass pad bank — 808 follows chord roots from another lab.',
      'Pick source: **CB** Chord Builder · **GL** Groove Lab roll · **NS** Beat Lab NEW SYNTH.',
      'Build chords in that source first, then hit **GENERATE ROOTS** — root hits land on the roll.',
      'Locked pads glow mint; progression roots play in order when transport runs.',
      '**+ CHORDS** (sync strip) optionally layers full chord harmony under 808 — off = kick/bass only.',
      'Send roots from Chord Builder with **Roots → 808** for a one-click handoff.',
    ],
  },
  {
    id: 'pads',
    label: 'Pads',
    title: '808 Kick / Bass & Drum kits',
    lines: [
      '**808 Kick / Bass**: 16 chromatic pads — switch **Kick** vs **Bass** lane + trap/bass presets.',
      'Oct ▲/▼ shifts the pad range; strike velocity follows pointer pressure.',
      'Mute/Solo + master fader per bank — Kick/Bass and Drum kits have separate levels.',
      '**Drum kits**: browse MPC kits (trap, boom-bap…) — 16 one-shot pads for the step grid.',
      'Drum kit choice syncs between pad bank and drum roll when you switch tabs.',
    ],
  },
  {
    id: 'roll',
    label: 'Roll',
    title: 'Kick / Bass piano roll',
    lines: [
      'Click piano keys to preview; click grid cells to add root hits — drag to move, right edge to resize.',
      'Click the BAR ruler to cue the playhead (shared transport with Drum kits).',
      'Erase / Copy / Paste / Duplicate — drag empty grid to select a region (Ctrl+C/V/D).',
      'Bars, Quant, Lo/Hi octave, Kick/Bass preset, HP/LP filters in the roll toolbar.',
      'Generated chord roots show chord name + pitch; manual notes are plain MIDI labels.',
    ],
  },
  {
    id: 'drums',
    label: 'Drums',
    title: 'Drum kits step grid',
    lines: [
      'Open **Drum kits** tab — 16-lane step sequencer fills the workspace below the pads.',
      'Each row = one MPC pad; columns = 16th-note steps in the loop region.',
      'Toggle steps on/off; loop length follows Bars setting (shared with Kick/Bass roll).',
      'Same ▶ transport as the tone roll — 808 LINK keeps both banks on one BPM clock.',
      'Export drum roll MIDI/WAV or bounce to Beat Lab pad from the drum toolbar.',
    ],
  },
  {
    id: 'sync',
    label: 'Sync',
    title: '808 LINK · BPM · PLAY mirror',
    lines: [
      '**808 LINK** ties Kick/Bass + Drum kits tempo on this page (transport already shared).',
      '**BPM →** pick 808 internal, Beat Lab, Groove Lab, or Chord Builder — hit **SYNC** to apply.',
      '**PLAY →** mirror transport to Beat Lab or Groove Lab (Groove = two-way play sync).',
      'Session Link in Creation Station can also slave 808 BPM/play to Beat Lab when enabled.',
      'Roll BPM override: type a number locally, or Sync to snap back to the linked target.',
    ],
  },
  {
    id: 'export',
    label: 'Export',
    title: 'Save & send 808',
    lines: [
      'Kick/Bass roll: Export MIDI / WAV / **To Pad** (pick Beat Lab sampler pad 1–16).',
      'Drum kits roll: same export cluster on the drum grid toolbar.',
      'WAV bounce renders the current loop with kit voices and roll notes.',
      'MIDI exports note timing for Studio Editor 2 or external DAW import.',
    ],
  },
  {
    id: 'transport',
    label: 'Play',
    title: 'Transport & tempo',
    lines: [
      '▶ PLAY / ■ STOP on Kick/Bass roll or Drum grid — one clock drives both banks.',
      'Skip-back returns to bar 1; playhead mint line tracks on the active roll.',
      '▶ Chords previews Chord Builder roots once (no drums) when CB sync is loaded.',
      'BPM in roll toolbar sets preview tempo unless a sync target or override is active.',
    ],
  },
] as const;

export const LAB808_HELP_INTRO_STORAGE = 'da-lab808-help-intro-v1';
