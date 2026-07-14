import { describe, expect, it } from 'vitest';
import { studioParseEditor2MidiPlayback } from '@/app/lib/studio/studioEditor2MidiInstrumentPlayback';

describe('studioParseEditor2MidiPlayback', () => {
  it('parses GM keys / strings / brass', () => {
    expect(studioParseEditor2MidiPlayback('gm:acoustic_grand_piano')).toEqual({
      kind: 'gm',
      gmId: 'acoustic_grand_piano',
    });
    expect(studioParseEditor2MidiPlayback('gm:string_ensemble_1')).toEqual({
      kind: 'gm',
      gmId: 'string_ensemble_1',
    });
    expect(studioParseEditor2MidiPlayback('gm:brass_section')).toEqual({
      kind: 'gm',
      gmId: 'brass_section',
    });
  });

  it('parses 808 / sub bass and synth presets', () => {
    expect(studioParseEditor2MidiPlayback('bass808:trapLowBass')).toEqual({
      kind: 'bass808',
      soundId: 'trapLowBass',
    });
    const synth = studioParseEditor2MidiPlayback('synth:trap-sub');
    expect(synth?.kind).toBe('synth');
  });

  it('leaves orch hits and drum kits for other paths', () => {
    expect(studioParseEditor2MidiPlayback('orchHit:boom')).toBeNull();
    expect(studioParseEditor2MidiPlayback('gm:trap_drums')).toEqual({
      kind: 'drums',
      instrumentId: 'gm:trap_drums',
    });
  });
});
