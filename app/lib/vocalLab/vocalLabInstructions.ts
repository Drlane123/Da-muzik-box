/** AI Vocal Lab — Hum Capture, Melody-to-MIDI, Harmony Match help copy. */

export type VocalLabHelpTabId = 'overview' | 'hum-capture' | 'melody-midi' | 'harmony';

export interface VocalLabHelpSection {
  id: VocalLabHelpTabId;
  label: string;
  title: string;
  highlight?: boolean;
  lines: readonly string[];
}

export const VOCAL_LAB_HELP_SECTIONS: readonly VocalLabHelpSection[] = [
  {
    id: 'overview',
    label: 'Start',
    title: 'AI Vocal Lab — three melody tools',
    lines: [
      'Open **AI Vocal Lab** in the sidebar — three sub-tools under the module dropdown.',
      '**Hum Capture** (main screen) — hum or sing → editable melody roll → render & export.',
      '**Melody-to-MIDI** — record or upload audio → full transcription engine + piano roll editor.',
      '**Harmony Match** — capture a melody → get chord progression matches → send to Groove Lab.',
      'Voice Swap, RVC, and Enhancement on the main Vocal Lab screen use your Hum Capture recording.',
      'Export paths: Studio Editor 2, Groove Lab, Beat Lab NEW SYNTH, or download MIDI/WAV.',
    ],
  },
  {
    id: 'hum-capture',
    label: '★ Hum Capture',
    title: 'Hum Capture — melody from your voice',
    highlight: true,
    lines: [
      'Hum or sing into the mic — the **pitch scope** tracks your melody live while recording.',
      'Upload a vocal clip instead of recording; delete and re-take anytime.',
      '**Key lock** (Auto / Off / scale pick) snaps detected notes to a key — try Off if notes look wrong.',
      'Melody roll (4 or 8 bars): paint, drag, resize notes — quantize grid matches session BPM.',
      'Mini keyboard + drum pads: arm a pad note and hum it in during the take for tighter MIDI.',
      'Pick an instrument → **Render** builds a preview; A/B **Hum** vs **Instrument** playback.',
      'Send MIDI to **Studio Editor 2**, **Groove Lab**, or **Beat Lab NEW SYNTH**; download .mid or WAV.',
    ],
  },
  {
    id: 'melody-midi',
    label: 'Melody-to-MIDI',
    title: 'Melody-to-MIDI transcription',
    lines: [
      '**Start Recording** from the mic or **Upload Audio** — monophonic lines work best (one note at a time).',
      'Recording monitor shows live waveform + level while you sing or play a lead.',
      '**Transposition** shifts all detected pitch up/down in semitones before MIDI conversion.',
      '**Tempo scale** stretches timing; **Quantize** snaps to 1/4, 1/8, or 1/16; raise **Confidence** to drop noisy pitches.',
      'Hit **Transcribe to MIDI** — notes land in the piano roll for hand editing (add, delete, drag).',
      'Set **Pattern length** (1–16 bars), audition playback, then **Export** to Studio Editor or download .mid.',
    ],
  },
  {
    id: 'harmony',
    label: 'Harmony',
    title: 'Harmony Match — melody to chords',
    lines: [
      'Capture a short melody three ways: **HUM** (record), **FILE** (upload), or **LIVE** (real-time voice MIDI).',
      'LIVE mode tracks pitch as you sing — stop when you have enough notes (8+ recommended).',
      'Tap **MATCH** — the engine proposes chord progressions that fit your captured melody.',
      'Each numbered chip is a candidate loop — click one to load chords into **Groove Lab**.',
      'In Groove Lab: edit the green chord roll, then use **MATCH BASS** to build a bass line from the harmony.',
      'Best results: clear single-note melody, 4–8 bars, steady tempo — hum closer to the mic in a quiet room.',
    ],
  },
] as const;

export const VOCAL_LAB_HELP_INTRO_STORAGE = 'da-vocal-lab-help-intro-v1';
export const MELODY_MIDI_HELP_INTRO_STORAGE = 'da-melody-midi-help-intro-v1';
export const HARMONY_MATCH_HELP_INTRO_STORAGE = 'da-harmony-match-help-intro-v1';
