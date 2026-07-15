/** SE2 Chord Generator — SE2 MIDI Composer (prompt → editable MIDI on the roll). */

export const SE2_MIDI_COMPOSER_LABEL = 'SE2 MIDI Composer';

export type Se2ChordGenieAiMidiMode = 'off' | 'agent';

export const SE2_CHORD_GENIE_AI_MIDI_OPTIONS = [
  { value: 'off' as const, label: 'Off' },
  { value: 'agent' as const, label: SE2_MIDI_COMPOSER_LABEL },
] satisfies readonly { value: Se2ChordGenieAiMidiMode; label: string }[];

export function se2ChordGenieNormalizeAiMidiMode(raw: unknown): Se2ChordGenieAiMidiMode {
  return raw === 'agent' ? 'agent' : 'off';
}

export const SE2_AI_MIDI_KEY_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

export type Se2ChordGenieAiMidiProvider = 'damusicbox' | 'gemini' | 'grok' | 'openai' | 'custom';

export const SE2_AI_MIDI_PROVIDER_OPTIONS = [
  { value: 'damusicbox' as const, label: 'Da Music Box' },
  { value: 'gemini' as const, label: 'Gemini' },
  { value: 'grok' as const, label: 'Grok' },
  { value: 'openai' as const, label: 'OpenAI' },
  { value: 'custom' as const, label: 'Custom API' },
] satisfies readonly { value: Se2ChordGenieAiMidiProvider; label: string }[];

export const SE2_AI_MIDI_MODEL_OPTIONS: Record<
  Se2ChordGenieAiMidiProvider,
  readonly { value: string; label: string }[]
> = {
  damusicbox: [{ value: 'dmb/v1', label: 'dmb/v1' }],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
    { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro' },
  ],
  grok: [
    { value: 'grok-2', label: 'grok-2' },
    { value: 'grok-beta', label: 'grok-beta' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'gpt-4o' },
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
  ],
  custom: [{ value: 'custom', label: 'custom endpoint' }],
};

export const SE2_AI_MIDI_SCALE_OPTIONS = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'dorian', label: 'Dorian' },
  { value: 'mixolydian', label: 'Mixolydian' },
  { value: 'harmonic_minor', label: 'Harmonic minor' },
  { value: 'melodic_minor', label: 'Melodic minor' },
] as const;

export const SE2_AI_MIDI_TYPE_OPTIONS = [
  { value: 'chords', label: 'Chords' },
  { value: 'melody', label: 'Melody' },
  { value: 'lead', label: 'Lead' },
  { value: 'bass', label: 'Bass' },
  { value: 'full', label: 'Full arrangement' },
] as const;

export const SE2_AI_MIDI_NOTE_GRID_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: '32', label: 'Thirty-Second Notes' },
  { value: '16', label: 'Sixteenth Notes' },
  { value: '8', label: 'Eighth Notes' },
  { value: '4', label: 'Quarter Notes' },
  { value: '2', label: 'Half Notes' },
] as const;

export const SE2_AI_MIDI_LENGTH_OPTIONS = [
  { value: '4', label: '4 bars' },
  { value: '8', label: '8 bars' },
  { value: '16', label: '16 bars' },
  { value: '32', label: '32 bars' },
] as const;

export const SE2_AI_MIDI_GENRE_OPTIONS = [
  { value: 'true_rnb', label: 'True R&B' },
  { value: 'trap', label: 'Trap' },
  { value: 'gospel', label: 'Gospel' },
  { value: 'neo_soul', label: 'Neo soul' },
  { value: 'pop', label: 'Pop' },
  { value: 'afro', label: 'Afro' },
  { value: 'lofi', label: 'Lo-fi' },
  { value: 'cinematic', label: 'Cinematic' },
] as const;

export type Se2ChordGenieAiMidiChatRole = 'user' | 'assistant';

export type Se2ChordGenieAiMidiChatMessage = {
  id: string;
  role: Se2ChordGenieAiMidiChatRole;
  text: string;
};

export const SE2_AI_MIDI_WELCOME_MESSAGE =
  'Describe chords, melody, bass, or a full idea in plain English. Pick your key, scale, and genre below — then Send. Your MIDI lands here on the generator, ready to edit.';

export const SE2_MIDI_COMPOSER_HELP = {
  title: 'SE2 MIDI Composer',
  sections: [
    {
      heading: 'How to use it',
      body:
        'Describe chords, melody, bass, or a full idea in plain English. Set Key, Scale, Type, Length, and Genre below the prompt box — then click Send. Your result loads right here in SE2 Chord Generator, ready to edit.',
    },
    {
      heading: 'Workflow',
      body:
        'Generate builds a draft only — nothing hits the roll yet. Preview listens to the draft. Regenerate tries a new take with the same prompt. Go Back restores the draft before your last Regenerate. Apply to Roll loads the draft onto the chord generator when you are happy.',
    },
    {
      heading: 'Chords',
      body:
        'When Type is Chords, your progression lands as chord cards on the chord generator roll — one chord per bar. Edit the cards, preview, then export to the track when you are ready.',
    },
    {
      heading: 'Melody, lead & bass',
      body:
        'When Type is Melody, Lead, or Bass, notes go straight onto the piano roll as individual MIDI notes — not chord cards. Melodies are generated against a real chord bed for your genre (R&B, neo-soul, etc.) and snapped to the Note grid (1/8, 1/16, 1/32) so they lock with the changes.',
    },
    {
      heading: 'Full arrangement',
      body:
        'Full arrangement gives you chord cards plus a top-line melody locked to those same chords — same key, same bar changes, same beat grid.',
    },
    {
      heading: 'Note grid',
      body:
        'Pick Eighth / Sixteenth / Thirty-Second Notes to force attacks onto that grid. Any picks a genre default (R&B and neo-soul use sixteenths).',
    },
    {
      heading: 'Providers',
      body:
        'Da Music Box runs locally with no API key. Gemini, OpenAI, Grok, or Custom need a key in Settings (saved on this device only).',
    },
  ],
} as const;

/** Shown when user clicks Provider next to Apply — BYOK instructions. */
export const SE2_MIDI_COMPOSER_PROVIDER_HELP = {
  title: 'Your provider & API key',
  intro:
    'Da Music Box runs locally — no key needed. For Gemini, Grok, OpenAI, or Custom API, you bring your own key.',
  steps: [
    'Choose a provider in the Provider dropdown (right side of this box).',
    'Click Set below and paste your API key. It stays on this device only — we do not store it on a server.',
    'Gemini: use a Google AI Studio / Gemini API key. Grok & OpenAI: use your account key from xAI or OpenAI.',
    'Custom API: paste your key and an OpenAI-compatible endpoint URL (…/v1/chat/completions).',
    'Click Generate. If the cloud call fails, Da Music Box falls back to the local engine.',
  ],
} as const;

export function se2AiMidiKeyRootFromName(name: string): number {
  const idx = SE2_AI_MIDI_KEY_NAMES.indexOf(name as (typeof SE2_AI_MIDI_KEY_NAMES)[number]);
  return idx >= 0 ? idx : 0;
}

export function se2AiMidiKeyNameFromRoot(root: number): string {
  return SE2_AI_MIDI_KEY_NAMES[((root % 12) + 12) % 12] ?? 'C';
}

export function se2AiMidiScaleFromChordMode(mode: 'major' | 'minor'): string {
  return mode === 'minor' ? 'minor' : 'major';
}
