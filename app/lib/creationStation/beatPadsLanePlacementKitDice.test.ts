import { describe, expect, it } from 'vitest';
import {
  getBeatPadsKitDiceTemplatesForRole,
  isClassicBeatPadsSnare24,
  isSolidBeatPadsKickPlacement,
  isSolidBeatPadsSnarePlacement,
  pickRandomBeatPadsKitLanePlacements,
} from '@/app/lib/creationStation/beatPadsLanePlacementTemplates';

describe('Beat Pads kit dice solid kick/snare', () => {
  it('requires kicks on beat 1 with follow-through and no adjacent rolls', () => {
    expect(isSolidBeatPadsKickPlacement([0, 8])).toBe(true);
    expect(isSolidBeatPadsKickPlacement([0, 6, 10, 14])).toBe(true);
    expect(isSolidBeatPadsKickPlacement([0])).toBe(false);
    expect(isSolidBeatPadsKickPlacement([8, 12])).toBe(false);
    expect(isSolidBeatPadsKickPlacement([14, 15])).toBe(false);
    expect(isSolidBeatPadsKickPlacement([0, 10, 11])).toBe(false);
  });

  it('allows only snare steps on 2 and/or 4', () => {
    expect(isSolidBeatPadsSnarePlacement([4, 12])).toBe(true);
    expect(isSolidBeatPadsSnarePlacement([4])).toBe(true);
    expect(isSolidBeatPadsSnarePlacement([12])).toBe(true);
    expect(isSolidBeatPadsSnarePlacement([4, 12, 14])).toBe(false);
    expect(isSolidBeatPadsSnarePlacement([4, 12, 15])).toBe(false);
    expect(isSolidBeatPadsSnarePlacement([5, 13])).toBe(false);
    expect(isSolidBeatPadsSnarePlacement([8])).toBe(false);
  });

  it('exposes classic 2 & 4 snares for the dice pool', () => {
    const snares = getBeatPadsKitDiceTemplatesForRole('snare');
    expect(snares.length).toBeGreaterThan(0);
    for (const t of snares) {
      expect(isClassicBeatPadsSnare24(t.steps)).toBe(true);
    }
  });

  it('exposes solid kicks that all start on 1', () => {
    const kicks = getBeatPadsKitDiceTemplatesForRole('kick');
    expect(kicks.length).toBeGreaterThan(20);
    for (const t of kicks) {
      expect(isSolidBeatPadsKickPlacement(t.steps)).toBe(true);
    }
  });

  it('random kit picks keep kick/snare solid across many rolls', () => {
    for (let i = 0; i < 40; i++) {
      const picks = pickRandomBeatPadsKitLanePlacements();
      const kick = picks.find((p) => p.role === 'kick');
      const snare = picks.find((p) => p.role === 'snare');
      expect(kick).toBeDefined();
      expect(snare).toBeDefined();
      expect(isSolidBeatPadsKickPlacement(kick!.template.steps)).toBe(true);
      expect(isClassicBeatPadsSnare24(snare!.template.steps)).toBe(true);
    }
  });
});
