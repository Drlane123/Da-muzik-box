import {
  cbPianoMidiToNoteName,
  cbPianoNoteNameToMidi,
  LAB808_PIANO_ROWS,
} from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import {
  CHORD_BASS_SEQ_CHANNEL_BASE,
  CHORD_BASS_SEQ_CHANNEL_COUNT,
} from '@/app/lib/creationStation/chordBassSequencerSession';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  GROOVE_LAB_BASS_MIDI_MIN,
  GROOVE_LAB_CHORD_ROLL_MIDI_MIN,
  grooveLabClampBassRootMidi,
  grooveLabClampChordRollMidi,
  grooveLabClampMelodyMidi,
  grooveLabDedupeMelodyHitsBySlot,
  grooveLabInferBassRootFromChordMidis,
  grooveLabClampGuitarMidi,
  grooveLabIsChordStackMidi,
  grooveLabIsGuitarMidi,
  grooveLabIsMelodyMidi,
  grooveLabIsMelodyChannelPitch,
  grooveLabLiftChordsAboveBass,
  grooveLabRepitchChordHitsToRnBRange,
  grooveLabSanitizeMelodyChannelHit,
} from '@/app/lib/creationStation/grooveLabPitch';
import {
  orchidNoteOnsets,
  type OrchidPerformanceMode,
} from '@/app/lib/creationStation/orchidChordEngine';

/** Green chord-register notes on the piano roll (C4+). */
export function grooveLabRollHasChordNotes(hits: readonly { midi: number }[]): boolean {
  return hits.some((h) => h.midi >= GROOVE_LAB_CHORD_ROLL_MIDI_MIN);
}

/**
 * Keypad “CHORD LAYER OFF” mutes live keypad chords only.
 * Roll chords always play when green notes exist.
 */
export function grooveLabTransportChordsMuted(
  chordLayerMuted: boolean,
  rollHits: readonly { midi: number }[],
): boolean {
  return chordLayerMuted && !grooveLabRollHasChordNotes(rollHits);
}

export type GrooveRollHit = {
  slot: number;
  sustainSlots: number;
  /** Absolute MIDI note number. */
  midi: number;
  vel: number;
};

/** @deprecated Legacy persisted shape — migrated on load. */
type LegacyGrooveRollHit = {
  slot: number;
  sustainSlots: number;
  midiOffset?: number;
  midi?: number;
  vel: number;
};

/** Internal slots per 4/4 bar (finest grid step = 1/32 → 2 slots). */
export const GROOVE_LAB_SLOTS_PER_BAR = 64;

/** First groove slot of the bar that contains `slot` (beat-1 / left bar line). */
export function grooveLabBarDownbeatSlot(slot: number): number {
  const s = Math.max(0, Math.floor(slot));
  return Math.floor(s / GROOVE_LAB_SLOTS_PER_BAR) * GROOVE_LAB_SLOTS_PER_BAR;
}

/** True when hits land on multiple beats in a bar (rhythm edit / 1+3 / 2+4) — skip bar collapse. */
export function grooveLabChordHitsUseRhythmSlots(hits: readonly GrooveRollHit[]): boolean {
  const slotsByBar = new Map<number, Set<number>>();
  for (const h of hits) {
    if (!grooveLabIsChordStackMidi(h.midi)) continue;
    const bar = Math.floor(h.slot / GROOVE_LAB_SLOTS_PER_BAR);
    const barEnd = (bar + 1) * GROOVE_LAB_SLOTS_PER_BAR;
    if (h.slot + h.sustainSlots < barEnd - 1) return true;
    const set = slotsByBar.get(bar) ?? new Set<number>();
    set.add(h.slot);
    slotsByBar.set(bar, set);
  }
  for (const slots of slotsByBar.values()) {
    if (slots.size > 1) return true;
    for (const slot of slots) {
      if (slot % GROOVE_LAB_SLOTS_PER_BAR !== 0) return true;
    }
  }
  return false;
}

/** Same slot+midi — keep the shorter rhythm block (not a legacy full-bar smear). */
function dedupeGrooveLabHitsPreferShorterSustain(hits: readonly GrooveRollHit[]): GrooveRollHit[] {
  const byKey = new Map<string, GrooveRollHit>();
  for (const h of hits) {
    const key = `${h.slot}:${h.midi}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, h);
      continue;
    }
    if (h.sustainSlots < prev.sustainSlots) {
      byKey.set(key, h);
    } else if (h.sustainSlots === prev.sustainSlots && (h.vel ?? 0) > (prev.vel ?? 0)) {
      byKey.set(key, h);
    }
  }
  return [...byKey.values()];
}

/** Cap bar-1 downbeat smears when the same bar already has off-beat rhythm hits. */
export function grooveLabStripBarDownbeatSmearHits(hits: readonly GrooveRollHit[]): GrooveRollHit[] {
  const beatSlots = GROOVE_LAB_SLOTS_PER_BAR / 4;
  const slotsByBar = new Map<number, Set<number>>();
  for (const h of hits) {
    if (!grooveLabIsChordStackMidi(h.midi)) continue;
    const bar = Math.floor(h.slot / GROOVE_LAB_SLOTS_PER_BAR);
    const set = slotsByBar.get(bar) ?? new Set<number>();
    set.add(h.slot);
    slotsByBar.set(bar, set);
  }
  return hits.map((h) => {
    if (!grooveLabIsChordStackMidi(h.midi)) return h;
    const bar = Math.floor(h.slot / GROOVE_LAB_SLOTS_PER_BAR);
    const barSlots = slotsByBar.get(bar);
    if (!barSlots || barSlots.size < 2) return h;
    const downbeat = bar * GROOVE_LAB_SLOTS_PER_BAR;
    const hasOffbeat = [...barSlots].some((s) => s !== downbeat);
    if (!hasOffbeat || h.slot !== downbeat) return h;
    if (h.sustainSlots <= beatSlots) return h;
    return { ...h, sustainSlots: beatSlots };
  });
}

/** Shorten sustain so split chord hits read as separate quarter-note blocks. */
export function grooveLabTrimChordRhythmHitSustain(hits: readonly GrooveRollHit[]): GrooveRollHit[] {
  if (!grooveLabChordHitsUseRhythmSlots(hits)) {
    return hits.map((h) => ({ ...h }));
  }
  const beatSlots = GROOVE_LAB_SLOTS_PER_BAR / 4;
  const out = hits.map((h) => ({ ...h }));
  const chordIdx = out
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => grooveLabIsChordStackMidi(h.midi))
    .sort((a, b) => a.h.slot - b.h.slot || a.h.midi - b.h.midi);
  for (let k = 0; k < chordIdx.length; k++) {
    const { h, i } = chordIdx[k]!;
    const bar = Math.floor(h.slot / GROOVE_LAB_SLOTS_PER_BAR);
    let cap = beatSlots;
    for (let j = k + 1; j < chordIdx.length; j++) {
      const other = chordIdx[j]!.h;
      if (Math.floor(other.slot / GROOVE_LAB_SLOTS_PER_BAR) !== bar) break;
      cap = Math.min(cap, Math.max(1, other.slot - h.slot));
      break;
    }
    out[i]!.sustainSlots = Math.max(1, Math.min(out[i]!.sustainSlots, cap));
  }
  return out;
}

/** One stacked chord per bar on the downbeat — no strum columns or spread. */
export function collapseGrooveChordHitsToBarDownbeats(
  hits: readonly GrooveRollHit[],
): GrooveRollHit[] {
  const byBarMidi = new Map<number, Map<number, GrooveRollHit>>();
  for (const h of hits) {
    const midi = Math.round(h.midi);
    if (!Number.isFinite(midi) || !grooveLabIsChordStackMidi(midi)) continue;
    const headSlot = grooveLabBarDownbeatSlot(h.slot);
    const bar = Math.floor(headSlot / GROOVE_LAB_SLOTS_PER_BAR);
    if (!byBarMidi.has(bar)) byBarMidi.set(bar, new Map());
    const barMap = byBarMidi.get(bar)!;
    const prev = barMap.get(midi);
    barMap.set(midi, {
      slot: headSlot,
      midi,
      sustainSlots: Math.max(
        1,
        GROOVE_LAB_SLOTS_PER_BAR,
        h.sustainSlots,
        prev?.sustainSlots ?? 0,
      ),
      vel: Math.max(prev?.vel ?? 0, h.vel ?? 0.88),
    });
  }
  const out: GrooveRollHit[] = [];
  for (const barMap of byBarMidi.values()) {
    for (const hit of barMap.values()) out.push(hit);
  }
  out.sort((a, b) => a.slot - b.slot || a.midi - b.midi);
  return out;
}

/** @deprecated use {@link GROOVE_LAB_SLOTS_PER_BAR} or {@link grooveLabTotalSlots}. */
export const GROOVE_LAB_SLOT_COUNT = GROOVE_LAB_SLOTS_PER_BAR;

/** Loop length presets (bars) — matches Beat Lab / Studio style. */
export const GROOVE_LAB_BAR_OPTIONS = [2, 4, 6, 8, 12, 16] as const;

export type GrooveLabBarCount = (typeof GROOVE_LAB_BAR_OPTIONS)[number];

export const GROOVE_LAB_BAR_COUNT_DEFAULT: GrooveLabBarCount = 4;

/** Legacy 8-slot patterns scale ×4 on load. */
export const GROOVE_LAB_LEGACY_SLOT_SCALE = 4;

export const GROOVE_LAB_ROOT_MIDI = 36;
export const GROOVE_LAB_STORAGE_KEY = 'groove-lab-notes-v2';

export type GrooveLabQuantize = '1/4' | '1/8' | '1/16' | '1/32';

export const GROOVE_LAB_QUANTIZE_OPTIONS: readonly GrooveLabQuantize[] = [
  '1/4',
  '1/8',
  '1/16',
  '1/32',
] as const;

export const GROOVE_LAB_QUANTIZE_DEFAULT: GrooveLabQuantize = '1/16';

export function normalizeGrooveBarCount(n: number): GrooveLabBarCount {
  const v = Math.round(n);
  if ((GROOVE_LAB_BAR_OPTIONS as readonly number[]).includes(v)) return v as GrooveLabBarCount;
  let best: GrooveLabBarCount = GROOVE_LAB_BAR_COUNT_DEFAULT;
  let dist = Infinity;
  for (const opt of GROOVE_LAB_BAR_OPTIONS) {
    const d = Math.abs(opt - v);
    if (d < dist) {
      dist = d;
      best = opt;
    }
  }
  return best;
}

export function grooveLabTotalSlots(barCount: number): number {
  return normalizeGrooveBarCount(barCount) * GROOVE_LAB_SLOTS_PER_BAR;
}

/**
 * Match the loop length to where green chords actually live (8-bar GrooveChord sketch
 * with a 4-bar transport preset was only filling half the melody).
 */
export function grooveLabInferComposerBarCount(
  chordHits: readonly { slot: number }[],
  loopBarCount: number,
): GrooveLabBarCount {
  const floor = normalizeGrooveBarCount(loopBarCount);
  if (chordHits.length === 0) return floor;
  let maxSlot = 0;
  for (const h of chordHits) {
    if (h.slot > maxSlot) maxSlot = h.slot;
  }
  const barsFromSlots = grooveLabBarIndexForSlot(maxSlot) + 1;
  return normalizeGrooveBarCount(Math.max(floor, barsFromSlots));
}

export function grooveLabBarIndexForSlot(slot: number): number {
  return Math.floor(Math.max(0, slot) / GROOVE_LAB_SLOTS_PER_BAR);
}

export function grooveLabSlotInBar(slot: number): number {
  return ((Math.max(0, slot) % GROOVE_LAB_SLOTS_PER_BAR) + GROOVE_LAB_SLOTS_PER_BAR) % GROOVE_LAB_SLOTS_PER_BAR;
}

/** One bar-line slot per bar with green chords — ignores rhythm-edit re-triggers (1+3, 2+4). */
export function grooveLabBarDownbeatSlotsFromChordHits(chordHits: readonly GrooveRollHit[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const h of chordHits) {
    if (!grooveLabIsChordStackMidi(h.midi)) continue;
    const bar = grooveLabBarIndexForSlot(h.slot);
    if (seen.has(bar)) continue;
    seen.add(bar);
    out.push(bar * GROOVE_LAB_SLOTS_PER_BAR);
  }
  return out.sort((a, b) => a - b);
}

/**
 * Groove lead / guitar — one attack per bar on the downbeat (not chord rhythm columns).
 */
export function grooveLabCollapseHitsToBarDownbeats(
  hits: readonly GrooveRollHit[],
  barCount: number,
): GrooveRollHit[] {
  const maxSlot = grooveLabTotalSlots(barCount);
  const byBar = new Map<number, GrooveRollHit[]>();
  for (const h of hits) {
    if (h.slot >= maxSlot) continue;
    const bar = grooveLabBarIndexForSlot(h.slot);
    const list = byBar.get(bar) ?? [];
    list.push(h);
    byBar.set(bar, list);
  }
  const out: GrooveRollHit[] = [];
  for (let bar = 0; bar < barCount; bar += 1) {
    const list = byBar.get(bar);
    if (!list || list.length === 0) continue;
    let pick = list[0]!;
    for (const h of list) {
      if ((h.vel ?? 0) > (pick.vel ?? 0)) pick = h;
      else if ((h.vel ?? 0) === (pick.vel ?? 0) && h.sustainSlots > pick.sustainSlots) pick = h;
    }
    const downbeat = bar * GROOVE_LAB_SLOTS_PER_BAR;
    const nextDownbeat = Math.min(maxSlot, (bar + 1) * GROOVE_LAB_SLOTS_PER_BAR);
    out.push({
      slot: downbeat,
      midi: pick.midi,
      sustainSlots: Math.max(GROOVE_LAB_SLOTS_PER_BAR / 4, nextDownbeat - downbeat - 1),
      vel: pick.vel,
    });
  }
  return out;
}

const GROOVE_LAB_MIN_MIDI = cbPianoNoteNameToMidi('C1');
const GROOVE_LAB_MAX_MIDI = cbPianoNoteNameToMidi('C6');

function nearestGrooveLabRowMidi(midi: number): number | null {
  const exact = LAB808_PIANO_ROWS.indexOf(cbPianoMidiToNoteName(midi));
  if (exact >= 0) return cbPianoNoteNameToMidi(LAB808_PIANO_ROWS[exact]!);
  let best: number | null = null;
  let dist = Infinity;
  for (const row of LAB808_PIANO_ROWS) {
    const m = cbPianoNoteNameToMidi(row);
    const d = Math.abs(m - midi);
    if (d < dist) {
      dist = d;
      best = m;
    }
  }
  return best;
}

/** Snap MIDI to C1–C6 rows, dedupe, and clip slots — fixes off-grid / legacy notes. */
export function sanitizeGrooveLabHits(hits: GrooveRollHit[], barCount: number): GrooveRollHit[] {
  const max = grooveLabTotalSlots(barCount) - 1;
  const byPitch = new Map<string, GrooveRollHit>();
  for (const h of hits) {
    let midi = Math.round(h.midi);
    if (!Number.isFinite(midi)) continue;
    if (midi < GROOVE_LAB_MIN_MIDI || midi > GROOVE_LAB_MAX_MIDI) {
      const snapped = nearestGrooveLabRowMidi(midi);
      if (snapped == null) continue;
      midi = snapped;
    } else if (!LAB808_PIANO_ROWS.includes(cbPianoMidiToNoteName(midi))) {
      const snapped = nearestGrooveLabRowMidi(midi);
      if (snapped == null) continue;
      midi = snapped;
    }
    const slot = Math.max(0, Math.min(max, Math.round(h.slot)));
    const sustainSlots = Math.max(1, Math.min(max - slot + 1, Math.round(h.sustainSlots) || 1));
    const vel = Number.isFinite(h.vel) ? Math.max(0.05, Math.min(1, h.vel)) : 0.88;
    const id = `${slot}:${midi}`;
    const next: GrooveRollHit = { slot, sustainSlots, midi, vel };
    const prev = byPitch.get(id);
    if (!prev || next.sustainSlots >= prev.sustainSlots) {
      byPitch.set(id, next);
    }
  }
  return [...byPitch.values()];
}

/** Amber melody channel — C5–C6 only; never lift subs/chords into this lane. */
export function sanitizeGrooveLabMelodyChannelHits(
  hits: GrooveRollHit[],
  barCount: number,
): GrooveRollHit[] {
  const lane = hits
    .filter((h) => grooveLabIsMelodyMidi(h.midi))
    .map((h) => ({ ...h, midi: grooveLabClampMelodyMidi(h.midi) }));
  return grooveLabDedupeMelodyHitsBySlot(sanitizeGrooveLabHits(lane, barCount));
}

/** Green chord channel — drop sub-C1 junk; optional bar-downbeat collapse for legacy import. */
export function sanitizeGrooveLabChordChannelHits(
  hits: GrooveRollHit[],
  barCount: number,
  opts?: { preserveRhythmSlots?: boolean },
): GrooveRollHit[] {
  const repitched = grooveLabRepitchChordHitsToRnBRange(
    hits.filter((h) => grooveLabIsChordStackMidi(h.midi)),
  );
  const lane = sanitizeGrooveLabHits(repitched, barCount);
  const preserve = opts?.preserveRhythmSlots ?? grooveLabChordHitsUseRhythmSlots(lane);
  if (preserve) {
    const deduped = dedupeGrooveLabHitsPreferShorterSustain(lane);
    const trimmed = grooveLabTrimChordRhythmHitSustain(deduped);
    return grooveLabStripBarDownbeatSmearHits(trimmed);
  }
  return collapseGrooveChordHitsToBarDownbeats(lane);
}

/** Guitar channel — G3–A4 mono lane. */
export function grooveLabDedupeGuitarHitsBySlot(hits: readonly GrooveRollHit[]): GrooveRollHit[] {
  const bySlot = new Map<number, GrooveRollHit>();
  for (const h of hits) {
    if (!grooveLabIsGuitarMidi(h.midi)) continue;
    const norm = { ...h, midi: grooveLabClampGuitarMidi(h.midi) };
    const prev = bySlot.get(norm.slot);
    if (!prev || norm.midi > prev.midi) bySlot.set(norm.slot, norm);
  }
  return [...bySlot.values()].sort((a, b) => a.slot - b.slot || a.midi - b.midi);
}

/** Cap sustain for mono guitar lane — one note per column. */
export function grooveLabTrimGuitarHitsMonophonic(hits: readonly GrooveRollHit[]): GrooveRollHit[] {
  const deduped = grooveLabDedupeGuitarHitsBySlot(hits);
  const out = deduped.map((h) => ({ ...h }));
  for (let i = 0; i < out.length; i++) {
    const cur = out[i]!;
    const next = out[i + 1];
    if (next) {
      const gap = next.slot - cur.slot;
      if (gap > 1) cur.sustainSlots = Math.min(cur.sustainSlots, Math.max(1, gap - 1));
      else cur.sustainSlots = 1;
    }
  }
  return out;
}

export function sanitizeGrooveLabGuitarChannelHits(
  hits: GrooveRollHit[],
  barCount: number,
): GrooveRollHit[] {
  const lane = hits
    .filter((h) => grooveLabIsGuitarMidi(h.midi))
    .map((h) => ({ ...h, midi: grooveLabClampGuitarMidi(h.midi) }));
  return grooveLabDedupeGuitarHitsBySlot(sanitizeGrooveLabHits(lane, barCount));
}

/** Even chord columns inside a bar (0 … slotsPerBar-1), snapped to quantize. */
export function grooveLabProgressionSlotInBar(
  stepIndex: number,
  slotsPerBar: number,
  stepsPerBar: number,
  snapStep: number,
): number {
  if (stepsPerBar <= 1) return 0;
  const raw = Math.floor((stepIndex * slotsPerBar) / stepsPerBar);
  const snapped = Math.floor(raw / snapStep) * snapStep;
  return Math.max(0, Math.min(slotsPerBar - snapStep, snapped));
}

/**
 * Transport + playback — keep each chord column’s grid slot (do not collapse a bar to one downbeat).
 */
export function grooveLabChordHitsForTransport(
  hits: readonly GrooveRollHit[],
  barCount: number,
  quantize: GrooveLabQuantize = GROOVE_LAB_QUANTIZE_DEFAULT,
): GrooveRollHit[] {
  const snapStep = grooveLabSlotsPerCell(quantize);
  const lane = sanitizeGrooveLabHits(
    grooveLabRepitchChordHitsToRnBRange(
      hits.filter((h) => grooveLabIsChordStackMidi(h.midi)),
    ),
    barCount,
  );
  const byCol = new Map<number, Map<number, GrooveRollHit>>();
  for (const h of lane) {
    const col = snapGrooveSlot(h.slot, quantize, barCount);
    const midi = Math.round(h.midi);
    const colMap = byCol.get(col) ?? new Map<number, GrooveRollHit>();
    const prev = colMap.get(midi);
    colMap.set(midi, {
      slot: col,
      midi,
      sustainSlots: Math.max(snapStep, h.sustainSlots, prev?.sustainSlots ?? 0),
      vel: Math.max(prev?.vel ?? 0, h.vel ?? 0.88),
    });
    byCol.set(col, colMap);
  }
  const out: GrooveRollHit[] = [];
  for (const colMap of byCol.values()) {
    for (const hit of colMap.values()) out.push(hit);
  }
  return out.sort((a, b) => a.slot - b.slot || a.midi - b.midi);
}

function normalizeHit(raw: LegacyGrooveRollHit, maxSlot: number): GrooveRollHit | null {
  const midi =
    typeof raw.midi === 'number' && Number.isFinite(raw.midi)
      ? Math.round(raw.midi)
      : typeof raw.midiOffset === 'number' && Number.isFinite(raw.midiOffset)
        ? GROOVE_LAB_ROOT_MIDI + Math.round(raw.midiOffset)
        : null;
  if (midi == null) return null;
  const slot = Math.max(0, Math.min(maxSlot, Math.round(raw.slot)));
  const sustainSlots = Math.max(1, Math.min(maxSlot - slot + 1, Math.round(raw.sustainSlots) || 1));
  const vel = Number.isFinite(raw.vel) ? Math.max(0.05, Math.min(1, raw.vel)) : 0.88;
  return { slot, sustainSlots, midi, vel };
}

/** Grid steps (columns) per bar at this quantize — same as {@link lab808RollQuantize}. */
export function grooveLabQuantizeDivisionsPerBar(q: GrooveLabQuantize): number {
  switch (q) {
    case '1/4':
      return 4;
    case '1/8':
      return 8;
    case '1/16':
      return 16;
    case '1/32':
      return 32;
    default:
      return 16;
  }
}

/** Internal slots per visible grid column within one bar. */
export function grooveLabSlotsPerCell(q: GrooveLabQuantize): number {
  const div = grooveLabQuantizeDivisionsPerBar(q);
  return Math.max(1, Math.floor(GROOVE_LAB_SLOTS_PER_BAR / div));
}

export function isGrooveLabQuantize(v: string): v is GrooveLabQuantize {
  return (GROOVE_LAB_QUANTIZE_OPTIONS as readonly string[]).includes(v);
}

export function normalizeGrooveLabQuantize(v: string): GrooveLabQuantize {
  return isGrooveLabQuantize(v) ? v : GROOVE_LAB_QUANTIZE_DEFAULT;
}

export function snapGrooveSlot(slot: number, q: GrooveLabQuantize, barCount: number): number {
  const step = grooveLabSlotsPerCell(q);
  const max = grooveLabTotalSlots(barCount) - 1;
  const s = Math.round(slot / step) * step;
  return Math.max(0, Math.min(max, s));
}

export function snapGrooveSustain(
  slot: number,
  sus: number,
  q: GrooveLabQuantize,
  barCount: number,
): number {
  const step = grooveLabSlotsPerCell(q);
  const max = grooveLabTotalSlots(barCount);
  const snapped = Math.max(step, Math.round(sus / step) * step);
  return Math.max(1, Math.min(max - slot, snapped));
}

export function quantizeGrooveHits(
  hits: GrooveRollHit[],
  q: GrooveLabQuantize,
  barCount: number,
): GrooveRollHit[] {
  return hits.map((h) => {
    const slot = snapGrooveSlot(h.slot, q, barCount);
    return {
      ...h,
      slot,
      sustainSlots: snapGrooveSustain(slot, h.sustainSlots, q, barCount),
    };
  });
}

/** Harmony root per chord column (inferred from voicing + key when provided). */
export function grooveLabChordAnchorsFromHits(
  hits: GrooveRollHit[],
  opts?: { keyRoot?: number; mode?: ChordMode; referenceMidi?: number },
): { slot: number; midi: number }[] {
  const bySlot = new Map<number, GrooveRollHit[]>();
  for (const h of hits) {
    const list = bySlot.get(h.slot) ?? [];
    list.push(h);
    bySlot.set(h.slot, list);
  }
  const ref = opts?.referenceMidi ?? GROOVE_LAB_ROOT_MIDI;
  const anchors: { slot: number; midi: number }[] = [];
  for (const [slot, list] of bySlot) {
    const midis = list.map((h) => h.midi);
    const midi =
      opts?.keyRoot != null && opts.mode != null
        ? grooveLabInferBassRootFromChordMidis(midis, opts.keyRoot, opts.mode, ref)
        : grooveLabClampBassRootMidi(Math.min(...midis), ref);
    anchors.push({ slot, midi });
  }
  return anchors.sort((a, b) => a.slot - b.slot);
}

/**
 * One attack per chord change — left edge of the green stack (min slot in a strum group).
 * Use for guitar lick drops and any “hit with the chord” placement.
 */
export function grooveLabChordAttackColumns(
  chordHits: readonly GrooveRollHit[],
  opts: {
    keyRoot: number;
    mode: ChordMode;
    referenceMidi?: number;
    quantize?: GrooveLabQuantize;
  },
): { slot: number; rootMidi: number }[] {
  const ref = opts.referenceMidi ?? GROOVE_LAB_ROOT_MIDI;
  const strumGap = Math.max(
    4,
    grooveLabSlotsPerCell(opts.quantize ?? GROOVE_LAB_QUANTIZE_DEFAULT) * 2,
  );
  const green = chordHits
    .filter((h) => grooveLabIsChordStackMidi(h.midi))
    .slice()
    .sort((a, b) => a.slot - b.slot || a.midi - b.midi);
  if (green.length === 0) return [];

  type Group = { minSlot: number; maxSlot: number; midis: number[] };
  const groups: Group[] = [];

  for (const h of green) {
    const last = groups[groups.length - 1];
    const sameBar =
      last != null &&
      Math.floor(h.slot / GROOVE_LAB_SLOTS_PER_BAR) ===
        Math.floor(last.minSlot / GROOVE_LAB_SLOTS_PER_BAR);
    const sameAttack = last != null && sameBar && h.slot - last.maxSlot <= strumGap;
    if (!sameAttack) {
      groups.push({ minSlot: h.slot, maxSlot: h.slot, midis: [Math.round(h.midi)] });
    } else {
      last!.maxSlot = Math.max(last!.maxSlot, h.slot);
      last!.minSlot = Math.min(last!.minSlot, h.slot);
      last!.midis.push(Math.round(h.midi));
    }
  }

  return groups.map((g) => ({
    slot: g.minSlot,
    rootMidi:
      opts.keyRoot != null && opts.mode != null
        ? grooveLabInferBassRootFromChordMidis(g.midis, opts.keyRoot, opts.mode, ref)
        : grooveLabClampBassRootMidi(Math.min(...g.midis), ref),
  }));
}

/**
 * Lead / guitar / arp lock — one chord anchor per bar on the bar line (downbeat).
 * Rhythm re-triggers (1+3, 2+4) stay on the CHORD roll but do not add lock columns.
 */
export function grooveLabChordBarFirstAttackColumns(
  chordHits: readonly GrooveRollHit[],
  opts: {
    keyRoot: number;
    mode: ChordMode;
    referenceMidi?: number;
    quantize?: GrooveLabQuantize;
  },
): { slot: number; rootMidi: number }[] {
  const stacks = grooveLabChordAttackStacks(chordHits, { quantize: opts.quantize });
  const byBar = new Map<number, { slot: number; midis: number[] }>();
  for (const stack of stacks) {
    const bar = grooveLabBarIndexForSlot(stack.slot);
    const prev = byBar.get(bar);
    if (!prev || stack.slot < prev.slot) {
      byBar.set(bar, { slot: stack.slot, midis: stack.midis });
    }
  }
  const ref = opts.referenceMidi ?? GROOVE_LAB_ROOT_MIDI;
  return [...byBar.values()]
    .sort((a, b) => a.slot - b.slot)
    .map((g) => ({
      slot: grooveLabBarDownbeatSlot(g.slot),
      rootMidi:
        opts.keyRoot != null && opts.mode != null
          ? grooveLabInferBassRootFromChordMidis(g.midis, opts.keyRoot, opts.mode, ref)
          : grooveLabClampBassRootMidi(Math.min(...g.midis), ref),
    }));
}

/** Green stacks for lead phrase lock — one bar-line anchor per bar (harmony from earliest attack in bar). */
export function grooveLabChordHitsForBarLeadLock(
  chordHits: readonly GrooveRollHit[],
  opts?: { quantize?: GrooveLabQuantize },
): GrooveRollHit[] {
  const stacks = grooveLabChordAttackStacks(chordHits, opts);
  const byBar = new Map<number, (typeof stacks)[number]>();
  for (const stack of stacks) {
    const bar = grooveLabBarIndexForSlot(stack.slot);
    const prev = byBar.get(bar);
    if (!prev || stack.slot < prev.slot) byBar.set(bar, stack);
  }
  const out: GrooveRollHit[] = [];
  for (const stack of [...byBar.values()].sort((a, b) => a.slot - b.slot)) {
    const downbeat = grooveLabBarDownbeatSlot(stack.slot);
    for (const midi of stack.midis) {
      out.push({
        slot: downbeat,
        midi,
        sustainSlots: stack.sustainSlots,
        vel: stack.vel,
      });
    }
  }
  return out;
}

/** Green stacks grouped for transport — one block chord per attack at the leftmost slot. */
export function grooveLabChordAttackStacks(
  chordHits: readonly GrooveRollHit[],
  opts?: { quantize?: GrooveLabQuantize },
): { slot: number; midis: number[]; sustainSlots: number; vel: number }[] {
  const strumGap = Math.max(
    4,
    grooveLabSlotsPerCell(opts?.quantize ?? GROOVE_LAB_QUANTIZE_DEFAULT) * 2,
  );
  const green = chordHits
    .filter((h) => grooveLabIsChordStackMidi(h.midi))
    .slice()
    .sort((a, b) => a.slot - b.slot || a.midi - b.midi);
  if (green.length === 0) return [];

  type Group = { minSlot: number; maxSlot: number; hits: GrooveRollHit[] };
  const groups: Group[] = [];

  for (const h of green) {
    const last = groups[groups.length - 1];
    const sameBar =
      last != null &&
      Math.floor(h.slot / GROOVE_LAB_SLOTS_PER_BAR) ===
        Math.floor(last.minSlot / GROOVE_LAB_SLOTS_PER_BAR);
    const sameAttack = last != null && sameBar && h.slot - last.maxSlot <= strumGap;
    if (!sameAttack) {
      groups.push({ minSlot: h.slot, maxSlot: h.slot, hits: [h] });
    } else {
      last!.maxSlot = Math.max(last!.maxSlot, h.slot);
      last!.minSlot = Math.min(last!.minSlot, h.slot);
      last!.hits.push(h);
    }
  }

  return groups.map((g) => {
    const midis = [...new Set(g.hits.map((h) => Math.round(h.midi)))].sort((a, b) => a - b);
    return {
      slot: g.minSlot,
      midis,
      sustainSlots: Math.max(...g.hits.map((h) => h.sustainSlots)),
      vel: Math.max(...g.hits.map((h) => h.vel ?? 0.88)),
    };
  });
}

/** Harmony root active at `slot` (latest anchor at or before this column). */
export function grooveLabBassRootAtSlot(
  slot: number,
  anchors: readonly { slot: number; midi: number }[],
  fallbackMidi: number,
): number {
  let root = fallbackMidi;
  for (const a of anchors) {
    if (a.slot <= slot) root = a.midi;
  }
  return grooveLabClampBassRootMidi(root, fallbackMidi);
}

/** Lowest note per column = bass root anchor for chord lock / transport. */
export function grooveLabBassAnchorsFromHits(hits: GrooveRollHit[]): { slot: number; midi: number }[] {
  const bySlot = new Map<number, GrooveRollHit[]>();
  for (const h of hits) {
    const list = bySlot.get(h.slot) ?? [];
    list.push(h);
    bySlot.set(h.slot, list);
  }
  const anchors: { slot: number; midi: number }[] = [];
  for (const [slot, list] of bySlot) {
    const bass = list.reduce((a, b) => (a.midi < b.midi ? a : b));
    anchors.push({ slot, midi: grooveLabClampBassRootMidi(bass.midi) });
  }
  return anchors.sort((a, b) => a.slot - b.slot);
}

/** Add Orchid chord hits on every column that already has a bass note (lowest pitch). */
export function grooveLabLockOrchidChordsToBassline(
  hits: GrooveRollHit[],
  opts: {
    getChordMidis: (bassMidi: number) => number[];
    sustainSlots: number;
    quantize: GrooveLabQuantize;
    barCount: number;
    bpm: number;
    perfMode: OrchidPerformanceMode;
  },
): GrooveRollHit[] {
  const anchors = grooveLabBassAnchorsFromHits(hits);
  if (anchors.length === 0) return hits;
  const anchorSlots = new Set(anchors.map((a) => a.slot));
  const nonAnchor = hits.filter((h) => !anchorSlots.has(h.slot));
  const columns: GrooveRollHit[] = [];
  for (const { slot, midi: anchorMidi } of anchors) {
    const midi = grooveLabClampBassRootMidi(anchorMidi);
    const bassHit =
      hits.find((h) => h.slot === slot && h.midi === anchorMidi) ??
      ({
        slot,
        midi,
        sustainSlots: snapGrooveSustain(slot, opts.sustainSlots, opts.quantize, opts.barCount),
        vel: 0.94,
      } satisfies GrooveRollHit);
    const chordHits = grooveLabStackChordHitsAtSlot({
      anchorSlot: slot,
      chordMidis: opts.getChordMidis(midi),
      sustainSlots: opts.sustainSlots,
      quantize: opts.quantize,
      barCount: opts.barCount,
      bassMidiForLift: midi,
    });
    columns.push(bassHit, ...chordHits);
  }
  return [...nonAnchor, ...columns];
}

/** Lock Orchid chords on a separate channel using bass anchors from the bass channel. */
export function grooveLabLockChordsToSeparateChannel(
  bassHits: GrooveRollHit[],
  chordHits: GrooveRollHit[],
  opts: {
    getChordMidis: (bassMidi: number) => number[];
    sustainSlots: number;
    quantize: GrooveLabQuantize;
    barCount: number;
    bpm: number;
    perfMode: OrchidPerformanceMode;
  },
): GrooveRollHit[] {
  const anchors = grooveLabBassAnchorsFromHits(bassHits);
  if (anchors.length === 0) return chordHits;
  const anchorSlots = new Set(anchors.map((a) => a.slot));
  const kept = chordHits.filter((h) => !anchorSlots.has(h.slot));
  const columns: GrooveRollHit[] = [];
  for (const { slot, midi: anchorMidi } of anchors) {
    const bassRoot = grooveLabClampBassRootMidi(anchorMidi);
    const stack = grooveLabStackChordHitsAtSlot({
      anchorSlot: slot,
      chordMidis: opts.getChordMidis(bassRoot),
      sustainSlots: opts.sustainSlots,
      quantize: opts.quantize,
      barCount: opts.barCount,
      bassMidiForLift: bassRoot,
    });
    columns.push(...stack);
  }
  return [...kept, ...columns];
}

export function grooveLabPickChordChannel(preferred?: number): number {
  const ids = grooveLabChannelIds();
  if (preferred != null && ids.includes(preferred)) return preferred;
  return ids[0] ?? CHORD_BASS_SEQ_CHANNEL_BASE;
}

function grooveLabIsTakenChannel(
  ch: number,
  taken: readonly number[],
): boolean {
  return taken.some((t) => t === ch);
}

export function grooveLabPickMelodyChannel(
  chordChannel: number,
  preferred?: number,
  sampleChannel?: number,
): number {
  const ids = grooveLabChannelIds();
  const taken = [chordChannel, sampleChannel].filter((c): c is number => c != null);
  if (
    preferred != null &&
    !grooveLabIsTakenChannel(preferred, taken) &&
    ids.includes(preferred)
  ) {
    return preferred;
  }
  return ids.find((c) => !grooveLabIsTakenChannel(c, taken)) ?? ids[1] ?? ids[0]!;
}

export function grooveLabPickGuitarChannel(
  chordChannel: number,
  melodyChannel: number,
  preferred?: number,
  sampleChannel?: number,
): number {
  const ids = grooveLabChannelIds();
  const taken = [chordChannel, melodyChannel, sampleChannel].filter(
    (c): c is number => c != null,
  );
  if (
    preferred != null &&
    !grooveLabIsTakenChannel(preferred, taken) &&
    ids.includes(preferred)
  ) {
    return preferred;
  }
  return (
    ids.find((c) => !grooveLabIsTakenChannel(c, taken)) ?? ids[2] ?? ids[0]!
  );
}

export function grooveLabPickSampleChannel(
  chordChannel: number,
  melodyChannel: number,
  guitarChannel: number,
  preferred?: number,
): number {
  const ids = grooveLabChannelIds();
  const taken = [chordChannel, melodyChannel, guitarChannel];
  if (
    preferred != null &&
    !grooveLabIsTakenChannel(preferred, taken) &&
    ids.includes(preferred)
  ) {
    return preferred;
  }
  return (
    ids.find((c) => !grooveLabIsTakenChannel(c, taken)) ?? ids[3] ?? ids[0]!
  );
}

/** Default CHORD + GROOVE LEAD + GUITAR + SAMPLE lanes (CH 33–48). */
export function grooveLabDefaultLayerChannels(): {
  chord: number;
  melody: number;
  guitar: number;
  sample: number;
} {
  const chord = grooveLabPickChordChannel();
  const melody = grooveLabPickMelodyChannel(chord);
  const guitar = grooveLabPickGuitarChannel(chord, melody);
  const sample = grooveLabPickSampleChannel(chord, melody, guitar);
  return { chord, melody, guitar, sample };
}

/** Bass root + Orchid chord voicing at one grid column (Telepathic Orchid: bass drives, chord follows). */
export function grooveLabWriteOrchidColumn(opts: {
  anchorSlot: number;
  bassMidi: number;
  chordMidis: number[];
  sustainSlots: number;
  quantize: GrooveLabQuantize;
  barCount: number;
  bpm: number;
  perfMode: OrchidPerformanceMode;
}): GrooveRollHit[] {
  const { anchorSlot, bassMidi, chordMidis, sustainSlots, quantize, barCount, bpm, perfMode } = opts;
  const anchor = snapGrooveSlot(anchorSlot, quantize, barCount);
  const bass = grooveLabClampBassRootMidi(bassMidi);
  const sus = snapGrooveSustain(anchor, sustainSlots, quantize, barCount);
  const bassHit: GrooveRollHit = { slot: anchor, midi: bass, sustainSlots: sus, vel: 0.94 };
  const lifted = grooveLabLiftChordsAboveBass(bass, chordMidis);
  const chordHits = grooveLabStackChordHitsAtSlot({
    anchorSlot: anchor,
    chordMidis: lifted,
    sustainSlots,
    quantize,
    barCount,
    bassMidiForLift: bass,
  });
  return [bassHit, ...chordHits];
}

/** One grid column — separate note per key (stacked voicing, not a strum smear). */
export function grooveLabStackChordHitsAtSlot(opts: {
  anchorSlot: number;
  chordMidis: readonly number[];
  sustainSlots: number;
  quantize: GrooveLabQuantize;
  barCount: number;
  bassMidiForLift?: number;
}): GrooveRollHit[] {
  const anchor = snapGrooveSlot(opts.anchorSlot, opts.quantize, opts.barCount);
  const sus = snapGrooveSustain(anchor, opts.sustainSlots, opts.quantize, opts.barCount);
  const bassRef =
    opts.bassMidiForLift != null ? grooveLabClampBassRootMidi(opts.bassMidiForLift) : undefined;
  const lifted = grooveLabLiftChordsAboveBass(
    bassRef ?? GROOVE_LAB_ROOT_MIDI,
    opts.chordMidis,
  );
  const voices = [...new Set(lifted.map((m) => Math.round(m)))].sort((a, b) => a - b);
  return voices.map((midi, i) => ({
    slot: anchor,
    midi: grooveLabClampChordRollMidi(midi, bassRef),
    sustainSlots: sus,
    vel: Math.max(0.55, 0.92 - i * 0.05),
  }));
}

export function grooveLabSpreadChordHits(opts: {
  anchorSlot: number;
  chordMidis: number[];
  sustainSlots: number;
  quantize: GrooveLabQuantize;
  barCount: number;
  bpm: number;
  perfMode: OrchidPerformanceMode;
}): GrooveRollHit[] {
  const { anchorSlot, chordMidis, sustainSlots, quantize, barCount, bpm, perfMode } = opts;
  const secPerBar = (60 / Math.max(40, bpm)) * 4;
  const voices = [...new Set(chordMidis.map((m) => Math.round(m)))].sort((a, b) => a - b);
  if (voices.length === 0) return [];
  const onsets = orchidNoteOnsets(voices.length, secPerBar * 0.85, { mode: perfMode, bpm });
  const maxSlot = grooveLabTotalSlots(barCount) - 1;
  const anchor = snapGrooveSlot(anchorSlot, quantize, barCount);

  return voices.map((midi, i) => {
    const slotOffset = Math.round((onsets[i]! / secPerBar) * GROOVE_LAB_SLOTS_PER_BAR);
    const slot = snapGrooveSlot(anchor + slotOffset, quantize, barCount);
    const clampedSlot = Math.min(maxSlot, Math.max(0, slot));
    return {
      slot: clampedSlot,
      midi,
      sustainSlots: snapGrooveSustain(clampedSlot, sustainSlots, quantize, barCount),
      vel: Math.max(0.55, 0.88 - i * 0.04),
    };
  });
}

export function grooveLabHitsAtSlot(hits: GrooveRollHit[], slot: number): GrooveRollHit[] {
  return hits.filter((h) => h.slot === slot);
}

export function grooveLabRemoveHitsAtSlot(hits: GrooveRollHit[], slot: number): GrooveRollHit[] {
  return hits.filter((h) => h.slot !== slot);
}

/** Replace only the bass anchor (lowest note) at a column; keep chord tones above. */
export function grooveLabReplaceBassAtSlot(
  hits: GrooveRollHit[],
  slot: number,
  bassMidi: number,
  sustainSlots: number,
  vel = 0.94,
): GrooveRollHit[] {
  const atSlot = hits.filter((h) => h.slot === slot);
  const others = hits.filter((h) => h.slot !== slot);
  const bass = grooveLabClampBassRootMidi(bassMidi);
  if (atSlot.length === 0) {
    return [...others, { slot, midi: bass, sustainSlots, vel }];
  }
  const bassAnchor = Math.min(...atSlot.map((h) => h.midi));
  const kept = atSlot.filter((h) => h.midi !== bassAnchor);
  return [...others, ...kept, { slot, midi: bass, sustainSlots, vel }];
}

export function clipGrooveHitsToBarCount(hits: GrooveRollHit[], barCount: number): GrooveRollHit[] {
  const max = grooveLabTotalSlots(barCount);
  return hits
    .filter((h) => h.slot < max)
    .map((h) => ({
      ...h,
      sustainSlots: Math.max(1, Math.min(max - h.slot, h.sustainSlots)),
    }));
}

function scaleHitFromLegacy(h: GrooveRollHit, barCount: number): GrooveRollHit {
  const scale = GROOVE_LAB_LEGACY_SLOT_SCALE;
  const max = grooveLabTotalSlots(barCount) - 1;
  const slot = Math.min(max, h.slot * scale);
  return {
    ...h,
    slot,
    sustainSlots: Math.max(1, Math.min(max - slot + 1, h.sustainSlots * scale)),
  };
}

/** v2 stored 32 slots as 2 beats — expand to 64 slots / 4 beats (same musical position). */
function scaleHitV2ToFullBar(h: GrooveRollHit, barCount: number): GrooveRollHit {
  const max = grooveLabTotalSlots(barCount) - 1;
  const slot = Math.min(max, h.slot * 2);
  return {
    ...h,
    slot,
    sustainSlots: Math.max(1, Math.min(max - slot + 1, h.sustainSlots * 2)),
  };
}

export function grooveLabChannelIds(): number[] {
  return Array.from(
    { length: CHORD_BASS_SEQ_CHANNEL_COUNT },
    (_, i) => CHORD_BASS_SEQ_CHANNEL_BASE + i,
  );
}

export function emptyNotesByChannel(): Record<number, GrooveRollHit[]> {
  const out: Record<number, GrooveRollHit[]> = {};
  for (const ch of grooveLabChannelIds()) {
    out[ch] = [];
  }
  return out;
}

type StoredPayload = {
  v: 1 | 2 | 3 | 4;
  barCount?: number;
  channels: Record<string, GrooveRollHit[]>;
};

const LEGACY_STORAGE_KEY = 'groove-lab-notes-v1';

function parseChannelHits(
  hits: unknown[],
  barCount: number,
  scaleLegacy: boolean,
  scaleV2HalfBar: boolean,
): GrooveRollHit[] {
  const max = grooveLabTotalSlots(barCount) - 1;
  return hits
    .map((h) => normalizeHit(h as LegacyGrooveRollHit, max))
    .filter((h): h is GrooveRollHit => h != null)
    .map((h) => {
      let out = h;
      if (scaleLegacy) out = scaleHitFromLegacy(out, barCount);
      if (scaleLegacy || scaleV2HalfBar) out = scaleHitV2ToFullBar(out, barCount);
      return out;
    });
}

export function loadGrooveLabSession(): {
  notesByChannel: Record<number, GrooveRollHit[]>;
  barCount: GrooveLabBarCount;
} {
  const base = emptyNotesByChannel();
  const fallbackBarCount = GROOVE_LAB_BAR_COUNT_DEFAULT;
  if (typeof window === 'undefined') {
    return { notesByChannel: base, barCount: fallbackBarCount };
  }
  try {
    let raw = window.localStorage.getItem(GROOVE_LAB_STORAGE_KEY);
    let legacy = false;
    if (!raw) {
      raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      legacy = !!raw;
    }
    if (!raw) return { notesByChannel: base, barCount: fallbackBarCount };
    const parsed = JSON.parse(raw) as StoredPayload;
    if (!parsed?.channels) return { notesByChannel: base, barCount: fallbackBarCount };
    const barCount = normalizeGrooveBarCount(parsed.barCount ?? (legacy || parsed.v < 4 ? 1 : fallbackBarCount));
    const scaleLegacy = legacy || parsed.v === 1;
    const scaleV2HalfBar = parsed.v === 2 && !legacy;
    for (const [key, hits] of Object.entries(parsed.channels)) {
      const ch = Number(key);
      if (
        Number.isFinite(ch) &&
        ch >= CHORD_BASS_SEQ_CHANNEL_BASE &&
        ch < CHORD_BASS_SEQ_CHANNEL_BASE + CHORD_BASS_SEQ_CHANNEL_COUNT
      ) {
        base[ch] = Array.isArray(hits)
          ? sanitizeGrooveLabHits(
              clipGrooveHitsToBarCount(
                parseChannelHits(hits, barCount, scaleLegacy, scaleV2HalfBar),
                barCount,
              ),
              barCount,
            )
          : [];
      }
    }
    return { notesByChannel: base, barCount };
  } catch {
    return { notesByChannel: base, barCount: fallbackBarCount };
  }
}

/** @deprecated use {@link loadGrooveLabSession} */
export function loadGrooveLabNotes(): Record<number, GrooveRollHit[]> {
  return loadGrooveLabSession().notesByChannel;
}

export function saveGrooveLabSession(
  notesByChannel: Record<number, GrooveRollHit[]>,
  barCount: number,
): void {
  if (typeof window === 'undefined') return;
  try {
    const bars = normalizeGrooveBarCount(barCount);
    const channels: Record<string, GrooveRollHit[]> = {};
    for (const ch of grooveLabChannelIds()) {
      channels[String(ch)] = clipGrooveHitsToBarCount(notesByChannel[ch] ?? [], bars);
    }
    const payload: StoredPayload = { v: 4, barCount: bars, channels };
    window.localStorage.setItem(GROOVE_LAB_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

/** @deprecated use {@link saveGrooveLabSession} */
export function saveGrooveLabNotes(notesByChannel: Record<number, GrooveRollHit[]>): void {
  saveGrooveLabSession(notesByChannel, GROOVE_LAB_BAR_COUNT_DEFAULT);
}
