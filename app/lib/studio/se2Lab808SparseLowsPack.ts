/**
 * SE2 / Beat Pads 808 Lab — sparse R&B / Trap (and light Reggae) low-808 bar pockets.
 * Exactly 2–3 sixteenth hits per bar — chord-progression lows, not dense trap rolls.
 */

export type Se2Lab808SparseLowsGenre = 'rnb' | 'trap' | 'reggae';

export type Se2Lab808SparseLowsTemplate = {
  id: string;
  name: string;
  genre: Se2Lab808SparseLowsGenre;
  desc: string;
  /** Active 16th steps in one 4/4 bar (0–15). Length must be 2 or 3. */
  steps: readonly number[];
};

function tpl(
  id: string,
  name: string,
  genre: Se2Lab808SparseLowsGenre,
  desc: string,
  steps: readonly number[],
): Se2Lab808SparseLowsTemplate {
  const uniq = [...new Set(steps.map((s) => Math.max(0, Math.min(15, Math.round(s)))))]
    .sort((a, b) => a - b)
    .slice(0, 3);
  const clamped =
    uniq.length >= 2 ? uniq : uniq.length === 1 ? [uniq[0]!, (uniq[0]! + 8) % 16] : [0, 8];
  return { id, name, genre, desc, steps: clamped };
}

function bar(...steps: number[]): readonly number[] {
  return steps;
}

/** 15 R&B sparse low pockets — soft, swung, late. */
export const SE2_LAB808_RNB_LOWS_TEMPLATES: readonly Se2Lab808SparseLowsTemplate[] = [
  tpl('rnb-lows-13', '1 & 3', 'rnb', 'Classic silk trunk', bar(0, 8)),
  tpl('rnb-lows-1late3', '1 · late 3', 'rnb', 'Soft late pocket', bar(0, 11)),
  tpl('rnb-lows-1and2', '1 · &2', 'rnb', 'Quiet storm lean', bar(0, 6)),
  tpl('rnb-lows-1and4', '1 · &4', 'rnb', 'Pickup into next bar', bar(0, 14)),
  tpl('rnb-lows-13and', '1 · 3 · &4', 'rnb', 'Three-hit silk', bar(0, 8, 14)),
  tpl('rnb-lows-late24', 'late 2 · 4', 'rnb', 'Behind-the-beat', bar(5, 12)),
  tpl('rnb-lows-12and', '1 · &2 · 3', 'rnb', 'Neo-soul push', bar(0, 6, 8)),
  tpl('rnb-lows-bedroom', '1 · late', 'rnb', 'Bedroom sparse', bar(0, 9)),
  tpl('rnb-lows-brush', '1 · brush 4', 'rnb', 'Brush finish', bar(0, 13)),
  tpl('rnb-lows-church', '1 · 2 · &4', 'rnb', 'Gospel-tinged lift', bar(0, 4, 14)),
  tpl('rnb-lows-swing', '1 · a2 · &3', 'rnb', 'Swung eighth feel', bar(0, 5, 10)),
  tpl('rnb-lows-verse', '1 · 3 soft', 'rnb', 'Airy verse', bar(0, 8, 15)),
  tpl('rnb-lows-chorus', '1 · &2 · &4', 'rnb', 'Chorus bounce', bar(0, 6, 14)),
  tpl('rnb-lows-trap-soul', '1 · 3 · late', 'rnb', 'Trap-soul hybrid', bar(0, 8, 11)),
  tpl('rnb-lows-double3', '1 · double 3', 'rnb', 'Doubles around 3', bar(0, 8, 9)),
];

/** 20 Trap sparse low pockets — max 3 hits/bar, no rolls. */
export const SE2_LAB808_TRAP_LOWS_TEMPLATES: readonly Se2Lab808SparseLowsTemplate[] = [
  tpl('trap-lows-13', '1 & 3', 'trap', 'Solid trunk', bar(0, 8)),
  tpl('trap-lows-138', '1 · 3 · &4', 'trap', 'Classic trap sparse', bar(0, 8, 14)),
  tpl('trap-lows-1late3', '1 · late 3', 'trap', 'Lean pocket', bar(0, 11)),
  tpl('trap-lows-metro', '1 · &2 · 3', 'trap', 'Metro bounce lite', bar(0, 6, 8)),
  tpl('trap-lows-south', '1 · &2 · &3', 'trap', 'South lean', bar(0, 6, 10)),
  tpl('trap-lows-sync', '1 · a2 · late 3', 'trap', 'Sync pocket', bar(0, 7, 11)),
  tpl('trap-lows-space', 'Downbeat only + pickup', 'trap', 'Wide space', bar(0, 14)),
  tpl('trap-lows-half', '1 · 3 only', 'trap', 'Half-time anchor', bar(0, 8)),
  tpl('trap-lows-push', '1 · &3 · &4', 'trap', 'Push into bar', bar(0, 10, 14)),
  tpl('trap-lows-club', '1 · 2 · 3', 'trap', 'Club trunk lite', bar(0, 4, 8)),
  tpl('trap-lows-drill', '1 · late 2 · 3', 'trap', 'Drill stomp sparse', bar(0, 7, 8)),
  tpl('trap-lows-plugg', '1 · ghost 3', 'trap', 'Soft plugg', bar(0, 9)),
  tpl('trap-lows-rage', '1 · double into 3', 'trap', 'Rage double (2–3)', bar(0, 7, 8)),
  tpl('trap-lows-slide', '1 · 3 · slide', 'trap', 'Slide-in finish', bar(0, 8, 15)),
  tpl('trap-lows-dark', '1 · late only', 'trap', 'Darkwave sparse', bar(0, 11)),
  tpl('trap-lows-bounce', '1 · &2 · &4', 'trap', 'Bounce glue', bar(0, 6, 14)),
  tpl('trap-lows-off', '1 · a3 · a4', 'trap', 'Off-grid push', bar(0, 11, 15)),
  tpl('trap-lows-answer', '1 · &3 · pickup', 'trap', 'Phrase answer', bar(0, 10, 14)),
  tpl('trap-lows-minimal', '1 · &4', 'trap', 'Minimal trunk', bar(0, 14)),
  tpl('trap-lows-peak', '1 · sync · 3', 'trap', 'Peak energy lite', bar(0, 5, 8)),
];

/** Optional light reggae sparse lows. */
export const SE2_LAB808_REGGAE_LOWS_TEMPLATES: readonly Se2Lab808SparseLowsTemplate[] = [
  tpl('reggae-lows-onedrop', 'One drop', 'reggae', 'Root on beat 3', bar(8, 14)),
  tpl('reggae-lows-13', '1 · 3', 'reggae', 'Rocksteady trunk', bar(0, 8)),
  tpl('reggae-lows-off', '1 · off 2 · 3', 'reggae', 'Skank lean', bar(0, 6, 8)),
  tpl('reggae-lows-dub', '1 · late 3', 'reggae', 'Dub space', bar(0, 11)),
  tpl('reggae-lows-ragga', '1 · 3 · &4', 'reggae', 'Ragga push', bar(0, 8, 14)),
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
