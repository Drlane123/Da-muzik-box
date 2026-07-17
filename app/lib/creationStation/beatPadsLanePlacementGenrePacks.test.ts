import { describe, expect, it } from 'vitest';
import { BEAT_PADS_HIPHOP_LANE_TEMPLATES } from '@/app/lib/creationStation/beatPadsLanePlacementHipHopPack';
import { BEAT_PADS_LOFI_LANE_TEMPLATES } from '@/app/lib/creationStation/beatPadsLanePlacementLofiPack';
import { BEAT_PADS_TECHNO_LANE_TEMPLATES } from '@/app/lib/creationStation/beatPadsLanePlacementTechnoPack';
import {
  BEAT_PADS_PLACEMENT_GENRES,
  getBeatPadsLaneTemplates,
  type BeatPadsDrumRole,
  type BeatPadsPlacementGenre,
} from '@/app/lib/creationStation/beatPadsLanePlacementTemplates';

const ROLES: readonly BeatPadsDrumRole[] = [
  'kick',
  'snare',
  'clap',
  'hihat',
  'openHat',
  'rim',
];

const PACKS: readonly {
  genre: BeatPadsPlacementGenre;
  label: string;
  templates: readonly { id: string; role: BeatPadsDrumRole; genre: string }[];
}[] = [
  { genre: 'lofi', label: 'Lo-Fi', templates: BEAT_PADS_LOFI_LANE_TEMPLATES },
  { genre: 'techno', label: 'Techno', templates: BEAT_PADS_TECHNO_LANE_TEMPLATES },
  { genre: 'hiphop', label: 'Hip Hop', templates: BEAT_PADS_HIPHOP_LANE_TEMPLATES },
];

describe('Beat Pads Hip Hop / Techno / Lo-Fi full role packs', () => {
  it('exposes all three genres in the placement dropdown', () => {
    const ids = BEAT_PADS_PLACEMENT_GENRES.map((g) => g.id);
    expect(ids).toContain('lofi');
    expect(ids).toContain('techno');
    expect(ids).toContain('hiphop');
  });

  for (const pack of PACKS) {
    it(`${pack.label}: 20 placements for each of 6 roles (120 total)`, () => {
      expect(pack.templates.length).toBe(120);
      expect(pack.templates.every((t) => t.genre === pack.genre)).toBe(true);
      expect(new Set(pack.templates.map((t) => t.id)).size).toBe(120);
      for (const role of ROLES) {
        expect(getBeatPadsLaneTemplates(role, pack.genre).length).toBe(20);
      }
    });
  }
});
