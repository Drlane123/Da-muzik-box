import { describe, expect, it } from 'vitest';
import { BEAT_PADS_LOFI_LANE_TEMPLATES } from '@/app/lib/creationStation/beatPadsLanePlacementLofiPack';
import {
  getBeatPadsLaneTemplates,
  BEAT_PADS_CANONICAL_LANE_FOR_ROLE,
} from '@/app/lib/creationStation/beatPadsLanePlacementTemplates';

describe('Beat Pads Lo-Fi lane placements', () => {
  it('ships 20 of each snare / clap / hihat / openHat', () => {
    const roles = ['snare', 'clap', 'hihat', 'openHat'] as const;
    for (const role of roles) {
      const list = BEAT_PADS_LOFI_LANE_TEMPLATES.filter((t) => t.role === role && t.genre === 'lofi');
      expect(list.length).toBe(20);
      expect(getBeatPadsLaneTemplates(role, 'lofi').length).toBe(20);
    }
    expect(BEAT_PADS_LOFI_LANE_TEMPLATES.every((t) => t.genre === 'lofi')).toBe(true);
    expect(new Set(BEAT_PADS_LOFI_LANE_TEMPLATES.map((t) => t.id)).size).toBe(80);
  });

  it('maps roles to canonical Beat Pads lanes', () => {
    expect(BEAT_PADS_CANONICAL_LANE_FOR_ROLE.snare).toBe(1);
    expect(BEAT_PADS_CANONICAL_LANE_FOR_ROLE.clap).toBe(2);
    expect(BEAT_PADS_CANONICAL_LANE_FOR_ROLE.hihat).toBe(3);
    expect(BEAT_PADS_CANONICAL_LANE_FOR_ROLE.openHat).toBe(4);
  });
});
