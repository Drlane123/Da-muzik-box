import { describe, expect, test } from 'bun:test';
import {
  BEAT_PADS_PLACEMENT_GENRES,
  getBeatPadsLaneTemplates,
} from '@/app/lib/creationStation/beatPadsLanePlacementTemplates';
import { BEAT_PADS_KICK_PACK_TEMPLATES } from '@/app/lib/creationStation/beatPadsLanePlacementKickPack';

describe('beatPadsLanePlacementKickPack', () => {
  test('adds ~20 kicks and extra rim per genre', () => {
    const byGenre = new Map<string, { kick: number; rim: number }>();
    for (const t of BEAT_PADS_KICK_PACK_TEMPLATES) {
      const cur = byGenre.get(t.genre) ?? { kick: 0, rim: 0 };
      if (t.role === 'kick') cur.kick += 1;
      if (t.role === 'rim') cur.rim += 1;
      byGenre.set(t.genre, cur);
    }
    for (const g of BEAT_PADS_PLACEMENT_GENRES) {
      const counts = byGenre.get(g.id);
      expect(counts, g.id).toBeTruthy();
      expect(counts!.kick, `${g.id} kicks`).toBeGreaterThanOrEqual(20);
      expect(counts!.rim, `${g.id} rim`).toBeGreaterThanOrEqual(6);
    }
  });

  test('all kick pack ids are unique and steps stay in 0–15', () => {
    const ids = new Set<string>();
    for (const t of BEAT_PADS_KICK_PACK_TEMPLATES) {
      expect(ids.has(t.id), t.id).toBe(false);
      ids.add(t.id);
      for (const s of t.steps) {
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(15);
      }
    }
  });

  test('merged lane templates expose large kick banks', () => {
    for (const g of BEAT_PADS_PLACEMENT_GENRES) {
      const kicks = getBeatPadsLaneTemplates('kick', g.id);
      expect(kicks.length, g.id).toBeGreaterThanOrEqual(28);
    }
  });
});
