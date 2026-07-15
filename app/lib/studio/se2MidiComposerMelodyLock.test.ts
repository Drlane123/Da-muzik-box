import { describe, expect, test } from 'bun:test';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import {
  se2MidiComposerDefaultNoteGrid,
  se2MidiComposerHarmonyFromSteps,
  se2MidiComposerMelodyGenre,
  se2MidiComposerNoteGridStepBeats,
  se2MidiComposerQuantizeNotes,
  se2MidiComposerResolveGridStep,
} from '@/app/lib/studio/se2MidiComposerMelodyLock';
import { se2MidiComposerGenerateLocal } from '@/app/lib/studio/se2MidiComposerGenerate';

describe('se2MidiComposerMelodyLock', () => {
  test('note grid maps to beat steps', () => {
    expect(se2MidiComposerNoteGridStepBeats('8')).toBe(0.5);
    expect(se2MidiComposerNoteGridStepBeats('16')).toBe(0.25);
    expect(se2MidiComposerNoteGridStepBeats('32')).toBe(0.125);
    expect(se2MidiComposerNoteGridStepBeats('any')).toBeNull();
  });

  test('R&B / neo-soul default to sixteenth grid', () => {
    expect(se2MidiComposerDefaultNoteGrid('true_rnb')).toBe('16');
    expect(se2MidiComposerDefaultNoteGrid('neo_soul')).toBe('16');
    expect(se2MidiComposerResolveGridStep('any', 'true_rnb')).toBe(0.25);
  });

  test('genre chip maps to R&B melody bank', () => {
    expect(se2MidiComposerMelodyGenre('true_rnb')).toBe('rnb');
    expect(se2MidiComposerMelodyGenre('neo_soul')).toBe('rnb');
    expect(se2MidiComposerMelodyGenre('trap')).toBe('trap');
    expect(se2MidiComposerMelodyGenre('true_rnb', '90s rnb funk vibe')).toBe('rnbFunk');
  });

  test('harmony columns follow chord steps bar-by-bar', () => {
    const steps: GrooveProgressionStep[] = [
      { id: '1', label: 'Am7', beats: 4 },
      { id: '2', label: 'Dm7', beats: 4 },
      { id: '3', label: 'G7', beats: 4 },
      { id: '4', label: 'Cmaj7', beats: 4 },
    ];
    const harmony = se2MidiComposerHarmonyFromSteps(steps, 4, 4, 0);
    expect(harmony.columns).toHaveLength(4);
    expect(harmony.columns[0]!.rootMidi % 12).toBe(9); // A
    expect(harmony.columns[1]!.rootMidi % 12).toBe(2); // D
    expect(harmony.columns[2]!.rootMidi % 12).toBe(7); // G
    expect(harmony.columns[3]!.rootMidi % 12).toBe(0); // C
    expect(harmony.columns[0]!.tones.length).toBeGreaterThanOrEqual(3);
  });

  test('quantize snaps starts onto sixteenth grid', () => {
    const snapped = se2MidiComposerQuantizeNotes(
      [
        { pitch: 72, startBeat: 0.11, durationBeats: 0.4, velocity: 70 },
        { pitch: 74, startBeat: 1.13, durationBeats: 0.5, velocity: 70 },
      ],
      {
        noteGrid: '16',
        genre: 'true_rnb',
        beatsPerBar: 4,
        barCount: 4,
        monophonic: true,
      },
    );
    expect(snapped.length).toBeGreaterThan(0);
    for (const n of snapped) {
      const rel = n.startBeat % 0.25;
      expect(rel < 1e-6 || Math.abs(rel - 0.25) < 1e-6).toBe(true);
    }
  });
});

describe('se2MidiComposerGenerateLocal', () => {
  test('full arrangement locks melody to R&B chord bed on a grid', () => {
    const result = se2MidiComposerGenerateLocal({
      prompt: 'smooth R&B slow jam',
      provider: 'damusicbox',
      model: 'dmb/v1',
      keyName: 'C',
      scale: 'minor',
      midiType: 'full',
      noteGrid: '16',
      lengthBars: '8',
      genre: 'true_rnb',
      beatsPerBar: 4,
      fallbackGenreId: 'rnb-true',
      seed: 42,
    });
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.steps?.length).toBeGreaterThan(0);
    expect(result.notes?.length).toBeGreaterThan(4);
    const step = 0.25;
    for (const n of result.notes ?? []) {
      const nearest = Math.round(n.startBeat / step) * step;
      expect(Math.abs(n.startBeat - nearest)).toBeLessThan(1e-6);
    }
  });

  test('melody-only uses chord-locked generation', () => {
    const result = se2MidiComposerGenerateLocal({
      prompt: 'neo soul top line',
      provider: 'damusicbox',
      model: 'dmb/v1',
      keyName: 'D',
      scale: 'minor',
      midiType: 'melody',
      noteGrid: '16',
      lengthBars: '8',
      genre: 'neo_soul',
      beatsPerBar: 4,
      fallbackGenreId: 'neo-soul-eras',
      seed: 99,
    });
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.notes?.length).toBeGreaterThan(2);
    expect(result.summary.toLowerCase()).toContain('locked');
  });
});
