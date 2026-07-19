import { describe, expect, it } from 'bun:test';
import {
  se2EnrichChordLabel,
  se2InvertChordLabel,
  se2ReduceChordLabel,
  se2HarmonyAltAt,
  se2HarmonyVoiceLead,
  se2HarmonyBassFromCards,
  se2PitchEventsFromMidiNotes,
  se2HarmonyChordsFromMelody,
} from '@/app/lib/studio/se2ChordGenieHarmonyTools';
import { parseChordSymbolToken } from '@/app/lib/creationStation/chordProgressionParse';

describe('se2ChordGenieHarmonyTools', () => {
  it('enriches and reduces chord color', () => {
    expect(se2EnrichChordLabel('C')).toBe('Cadd9');
    expect(se2EnrichChordLabel('Am')).toBe('Am7');
    expect(se2ReduceChordLabel('Am9')).toBe('Am7');
    expect(se2ReduceChordLabel('Cmaj9')).toBe('Cmaj7');
  });

  it('inverts with slash bass', () => {
    const inv = se2InvertChordLabel('C');
    expect(inv.startsWith('C/')).toBe(true);
  });

  it('parses slash bass into lower voice', () => {
    const parsed = parseChordSymbolToken('C/E');
    expect(parsed).not.toBeNull();
    expect(parsed!.notes[0]! % 12).toBe(4);
  });

  it('suggests an alternative for a card', () => {
    const steps = [
      { id: 'a', label: 'C', beats: 4 },
      { id: 'b', label: 'G', beats: 4 },
      { id: 'c', label: 'Am', beats: 4 },
      { id: 'd', label: 'F', beats: 4 },
    ];
    const result = se2HarmonyAltAt(steps, 1, {
      keyRoot: 0,
      mode: 'major',
      genreId: 'pop',
      seed: 3,
    });
    expect(result.steps[1]!.label).not.toBe('');
    expect(result.message.toLowerCase()).toContain('alt');
  });

  it('voice-leads consecutive cards', () => {
    const result = se2HarmonyVoiceLead([
      { id: 'a', label: 'C', beats: 4 },
      { id: 'b', label: 'G', beats: 4 },
      { id: 'c', label: 'Am', beats: 4 },
      { id: 'd', label: 'F', beats: 4 },
    ]);
    expect(result.steps).toHaveLength(4);
    expect(result.message.toLowerCase()).toContain('voice');
  });

  it('builds bass notes from cards', () => {
    const result = se2HarmonyBassFromCards(
      [
        { id: 'a', label: 'C', beats: 4 },
        { id: 'b', label: 'G', beats: 4 },
        { id: 'c', label: 'Am', beats: 4 },
        { id: 'd', label: 'F', beats: 4 },
      ],
      { keyRoot: 0, mode: 'major', beatsPerBar: 4, loopBars: 4, seed: 1 },
    );
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.notes.length).toBeGreaterThan(0);
    }
  });

  it('builds cards from melody pitch events', () => {
    const notes = Array.from({ length: 32 }, (_, i) => ({
      pitch: 60 + (i % 5),
      startBeat: i * 0.5,
      durationBeats: 0.45,
      velocity: 90,
    }));
    const events = se2PitchEventsFromMidiNotes(notes, 90);
    const result = se2HarmonyChordsFromMelody(events, {
      bpm: 90,
      keyRoot: 0,
      mode: 'major',
      loopBars: 4,
      beatsPerBar: 4,
    });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.steps.length).toBe(4);
    }
  });
});
