/**
 * SE2 / Beat Pads 808 Lab — sparse dark R&B / Trap / Reggae low-808 melodies.
 * 2–3 hits per bar with pitch contours (not root-only drones).
 */

export type Se2Lab808SparseLowsGenre = 'rnb' | 'trap' | 'reggae';

/** One hit: 16th step in the bar + semitone offset from the bar’s chord / freelance root. */
export type Se2Lab808SparseLowsHit = {
  step: number;
  /** Semitones from root — prefer dark colors (m3, 5, b6, b7, −8ve). */
  interval: number;
};

export type Se2Lab808SparseLowsTemplate = {
  id: string;
  name: string;
  genre: Se2Lab808SparseLowsGenre;
  desc: string;
  hits: readonly Se2Lab808SparseLowsHit[];
};

function hit(step: number, interval = 0): Se2Lab808SparseLowsHit {
  return {
    step: Math.max(0, Math.min(15, Math.round(step))),
    interval: Math.round(interval),
  };
}

function tpl(
  id: string,
  name: string,
  genre: Se2Lab808SparseLowsGenre,
  desc: string,
  hits: readonly Se2Lab808SparseLowsHit[],
): Se2Lab808SparseLowsTemplate {
  const uniq = new Map<number, number>();
  for (const h of hits) {
    if (uniq.size >= 3) break;
    if (!uniq.has(h.step)) uniq.set(h.step, h.interval);
  }
  let list = [...uniq.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([step, interval]) => hit(step, interval));
  if (list.length < 2) {
    list = [hit(0, 0), hit(8, list[0]?.interval === 0 ? -5 : 0)];
  }
  return { id, name, genre, desc, hits: list };
}

/** Dark R&B sparse low melodies — late, minor colors, octave dips. */
export const SE2_LAB808_RNB_LOWS_TEMPLATES: readonly Se2Lab808SparseLowsTemplate[] = [
  tpl('rnb-lows-13', 'Silk 1·3', 'rnb', 'Root → 5th', [hit(0, 0), hit(8, 7)]),
  tpl('rnb-lows-1late3', 'Late 3 dark', 'rnb', 'Root → late m3', [hit(0, 0), hit(11, 3)]),
  tpl('rnb-lows-1and2', 'Quiet storm', 'rnb', 'Root → &2 b7', [hit(0, 0), hit(6, 10)]),
  tpl('rnb-lows-1and4', 'Pickup fall', 'rnb', 'Root → −8ve pickup', [hit(0, 0), hit(14, -12)]),
  tpl('rnb-lows-13and', 'Three silk', 'rnb', 'Root · 5 · b7', [hit(0, 0), hit(8, 7), hit(14, 10)]),
  tpl('rnb-lows-late24', 'Behind', 'rnb', 'Late m3 · 5', [hit(5, 3), hit(12, 7)]),
  tpl('rnb-lows-12and', 'Neo push', 'rnb', 'Root · b7 · 5', [hit(0, 0), hit(6, 10), hit(8, 7)]),
  tpl('rnb-lows-bedroom', 'Bedroom', 'rnb', 'Root · late b6', [hit(0, 0), hit(9, 8)]),
  tpl('rnb-lows-brush', 'Brush fall', 'rnb', 'Root · brush −5', [hit(0, 0), hit(13, -5)]),
  tpl('rnb-lows-church', 'Church lift', 'rnb', 'Root · 5 · −8ve', [hit(0, 0), hit(4, 7), hit(14, -12)]),
  tpl('rnb-lows-swing', 'Swing dark', 'rnb', 'Root · m3 · b7', [hit(0, 0), hit(5, 3), hit(10, 10)]),
  tpl('rnb-lows-verse', 'Verse air', 'rnb', 'Root · 5 · ghost −8ve', [hit(0, 0), hit(8, 7), hit(15, -12)]),
  tpl('rnb-lows-chorus', 'Chorus', 'rnb', 'Root · b7 · 5', [hit(0, 0), hit(6, 10), hit(14, 7)]),
  tpl('rnb-lows-trap-soul', 'Trap soul', 'rnb', 'Root · 5 · late m3', [hit(0, 0), hit(8, 7), hit(11, 3)]),
  tpl('rnb-lows-double3', 'Double 3', 'rnb', 'Root · 5 · m3', [hit(0, 0), hit(8, 7), hit(9, 3)]),
  // +10 darker / more melodic
  tpl('rnb-lows-minor-walk', 'Minor walk', 'rnb', 'Root · m3 · 5', [hit(0, 0), hit(6, 3), hit(12, 7)]),
  tpl('rnb-lows-velvet-drop', 'Velvet drop', 'rnb', '5 · root · −8ve', [hit(0, 7), hit(8, 0), hit(14, -12)]),
  tpl('rnb-lows-smoke', 'Smoke', 'rnb', 'Root · b6 · b7', [hit(0, 0), hit(7, 8), hit(12, 10)]),
  tpl('rnb-lows-afterglow', 'Afterglow', 'rnb', 'm3 · root · 5', [hit(2, 3), hit(8, 0), hit(14, 7)]),
  tpl('rnb-lows-lowtide', 'Low tide', 'rnb', '−8ve · root', [hit(0, -12), hit(10, 0)]),
  tpl('rnb-lows-noir', 'Noir', 'rnb', 'Root · b2 · 5', [hit(0, 0), hit(5, 1), hit(12, 7)]),
  tpl('rnb-lows-honey', 'Honey dark', 'rnb', 'Root · −5 · b7', [hit(0, 0), hit(8, -5), hit(13, 10)]),
  tpl('rnb-lows-mirror', 'Mirror', 'rnb', '5 · m3 · root', [hit(0, 7), hit(6, 3), hit(12, 0)]),
  tpl('rnb-lows-dusk', 'Dusk', 'rnb', 'Root · late b7', [hit(0, 0), hit(11, 10)]),
  tpl('rnb-lows-pulse', 'Pulse fall', 'rnb', 'Root · 5 · late −8ve', [hit(0, 0), hit(8, 7), hit(15, -12)]),
];

/** Dark Trap sparse low melodies — minor / b6 / b7 motion, never busy. */
export const SE2_LAB808_TRAP_LOWS_TEMPLATES: readonly Se2Lab808SparseLowsTemplate[] = [
  tpl('trap-lows-13', 'Trunk 1·3', 'trap', 'Root · 5', [hit(0, 0), hit(8, 7)]),
  tpl('trap-lows-138', 'Classic sparse', 'trap', 'Root · 5 · b7', [hit(0, 0), hit(8, 7), hit(14, 10)]),
  tpl('trap-lows-1late3', 'Lean', 'trap', 'Root · late m3', [hit(0, 0), hit(11, 3)]),
  tpl('trap-lows-metro', 'Metro dark', 'trap', 'Root · b7 · 5', [hit(0, 0), hit(6, 10), hit(8, 7)]),
  tpl('trap-lows-south', 'South lean', 'trap', 'Root · b7 · m3', [hit(0, 0), hit(6, 10), hit(10, 3)]),
  tpl('trap-lows-sync', 'Sync dark', 'trap', 'Root · b6 · 5', [hit(0, 0), hit(7, 8), hit(11, 7)]),
  tpl('trap-lows-space', 'Wide space', 'trap', 'Root · −8ve pickup', [hit(0, 0), hit(14, -12)]),
  tpl('trap-lows-half', 'Half dark', 'trap', 'Root · b7', [hit(0, 0), hit(8, 10)]),
  tpl('trap-lows-push', 'Push', 'trap', 'Root · m3 · b7', [hit(0, 0), hit(10, 3), hit(14, 10)]),
  tpl('trap-lows-club', 'Club lite', 'trap', 'Root · 5 · root', [hit(0, 0), hit(4, 7), hit(8, 0)]),
  tpl('trap-lows-drill', 'Drill sparse', 'trap', 'Root · b6 · 5', [hit(0, 0), hit(7, 8), hit(8, 7)]),
  tpl('trap-lows-plugg', 'Plugg soft', 'trap', 'Root · ghost m3', [hit(0, 0), hit(9, 3)]),
  tpl('trap-lows-rage', 'Rage double', 'trap', 'Root · 5 · m3', [hit(0, 0), hit(7, 7), hit(8, 3)]),
  tpl('trap-lows-slide', 'Slide', 'trap', 'Root · 5 · −8ve', [hit(0, 0), hit(8, 7), hit(15, -12)]),
  tpl('trap-lows-dark', 'Darkwave', 'trap', 'Root · late b6', [hit(0, 0), hit(11, 8)]),
  tpl('trap-lows-bounce', 'Bounce', 'trap', 'Root · b7 · 5', [hit(0, 0), hit(6, 10), hit(14, 7)]),
  tpl('trap-lows-off', 'Off-grid', 'trap', 'Root · m3 · −8ve', [hit(0, 0), hit(11, 3), hit(15, -12)]),
  tpl('trap-lows-answer', 'Answer', 'trap', 'Root · b7 · pickup 5', [hit(0, 0), hit(10, 10), hit(14, 7)]),
  tpl('trap-lows-minimal', 'Minimal', 'trap', 'Root · b7 pickup', [hit(0, 0), hit(14, 10)]),
  tpl('trap-lows-peak', 'Peak lite', 'trap', 'Root · m3 · 5', [hit(0, 0), hit(5, 3), hit(8, 7)]),
  // +10 darker / more melodic
  tpl('trap-lows-horror', 'Horror', 'trap', 'Root · b2 · b6', [hit(0, 0), hit(6, 1), hit(12, 8)]),
  tpl('trap-lows-void', 'Void', 'trap', '−8ve · root · b7', [hit(0, -12), hit(8, 0), hit(14, 10)]),
  tpl('trap-lows-crawl', 'Crawl', 'trap', 'Root · m3 · b6', [hit(0, 0), hit(7, 3), hit(13, 8)]),
  tpl('trap-lows-slab', 'Slab', 'trap', '5 · root · −8ve', [hit(0, 7), hit(8, 0), hit(14, -12)]),
  tpl('trap-lows-icy', 'Icy', 'trap', 'Root · tt · 5', [hit(0, 0), hit(6, 6), hit(12, 7)]),
  tpl('trap-lows-murk', 'Murk', 'trap', 'b7 · root · m3', [hit(0, 10), hit(8, 0), hit(12, 3)]),
  tpl('trap-lows-blade', 'Blade', 'trap', 'Root · b6 · −8ve', [hit(0, 0), hit(8, 8), hit(15, -12)]),
  tpl('trap-lows-ghost', 'Ghost walk', 'trap', 'm3 · 5 · root', [hit(2, 3), hit(8, 7), hit(14, 0)]),
  tpl('trap-lows-pressure', 'Pressure', 'trap', 'Root · late 5 · b7', [hit(0, 0), hit(11, 7), hit(14, 10)]),
  tpl('trap-lows-ashes', 'Ashes', 'trap', 'Root · −5 · b6', [hit(0, 0), hit(6, -5), hit(12, 8)]),
];

export const SE2_LAB808_REGGAE_LOWS_TEMPLATES: readonly Se2Lab808SparseLowsTemplate[] = [
  tpl('reggae-lows-onedrop', 'One drop', 'reggae', '5 · root', [hit(8, 7), hit(14, 0)]),
  tpl('reggae-lows-13', 'Rocksteady', 'reggae', 'Root · 5', [hit(0, 0), hit(8, 7)]),
  tpl('reggae-lows-off', 'Skank lean', 'reggae', 'Root · b7 · 5', [hit(0, 0), hit(6, 10), hit(8, 7)]),
  tpl('reggae-lows-dub', 'Dub space', 'reggae', 'Root · late −8ve', [hit(0, 0), hit(11, -12)]),
  tpl('reggae-lows-ragga', 'Ragga', 'reggae', 'Root · m3 · b7', [hit(0, 0), hit(8, 3), hit(14, 10)]),
];

export const SE2_LAB808_SPARSE_LOWS_BY_GENRE: Readonly<
  Record<Se2Lab808SparseLowsGenre, readonly Se2Lab808SparseLowsTemplate[]>
> = {
  rnb: SE2_LAB808_RNB_LOWS_TEMPLATES,
  trap: SE2_LAB808_TRAP_LOWS_TEMPLATES,
  reggae: SE2_LAB808_REGGAE_LOWS_TEMPLATES,
};

export function se2Lab808SparseLowsTemplates(
  genre: Se2Lab808SparseLowsGenre,
): readonly Se2Lab808SparseLowsTemplate[] {
  return SE2_LAB808_SPARSE_LOWS_BY_GENRE[genre] ?? SE2_LAB808_TRAP_LOWS_TEMPLATES;
}

export function se2NormalizeLab808SparseLowsGenre(raw: string | undefined): Se2Lab808SparseLowsGenre {
  if (raw === 'rnb' || raw === 'reggae' || raw === 'trap') return raw;
  return 'trap';
}
