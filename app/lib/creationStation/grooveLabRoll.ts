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
  grooveLabInferBassRootFromChordMidis,
  grooveLabLiftChordsAboveBass,
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

/** One stacked chord per bar on the downbeat — no strum columns or spread. */
export function collapseGrooveChordHitsToBarDownbeats(
  hits: readonly GrooveRollHit[],
): GrooveRollHit[] {
  const byBarMidi = new Map<number, Map<number, GrooveRollHit>>();
  for (const h of hits) {
    const midi = Math.round(h.midi);
    if (!Number.isFinite(midi) || midi < GROOVE_LAB_CHORD_ROLL_MIDI_MIN) continue;
    const headSlot = grooveLabBarDownbeatSlot(h.slot);
    const bar = Math.floor(headSlot / GROOVE_LAB_SLOTS_PER_BAR);
    if (!byBarMidi.has(bar)) byBarMidi.set(bar, new Map());
    const barMap = byBarMidi.get(bar)!;
    const prev = barMap.get(midi);
    barMap.set(midi, {
      slot: headSlot,
      midi,
      sustainSlots: Math.max(h.sustainSlots, prev?.sustainSlots ?? 0),
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

export function grooveLabBarIndexForSlot(slot: number): number {
  return Math.floor(Math.max(0, slot) / GROOVE_LAB_SLOTS_PER_BAR);
}

export function grooveLabSlotInBar(slot: number): number {
  return ((Math.max(0, slot) % GROOVE_LAB_SLOTS_PER_BAR) + GROOVE_LAB_SLOTS_PER_BAR) % GROOVE_LAB_SLOTS_PER_BAR;
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

/** Green chord channel — drop sub-C1 junk; snap stacks to bar downbeats (matches transport + Beat Lab import). */
export function sanitizeGrooveLabChordChannelHits(
  hits: GrooveRollHit[],
  barCount: number,
): GrooveRollHit[] {
  return collapseGrooveChordHitsToBarDownbeats(
    sanitizeGrooveLabHits(
      hits.filter((h) => h.midi >= GROOVE_LAB_BASS_MIDI_MIN),
      barCount,
    ),
  );
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

export function grooveLabPickChordChannel(bassChannel: number, preferred?: number): number {
  const ids = grooveLabChannelIds();
  if (
    preferred != null &&
    preferred !== bassChannel &&
    ids.includes(preferred)
  ) {
    return preferred;
  }
  return ids.find((c) => c !== bassChannel) ?? bassChannel;
}

export function grooveLabPickMelodyChannel(
  bassChannel: number,
  chordChannel: number,
  preferred?: number,
): number {
  const ids = grooveLabChannelIds();
  const used = new Set([bassChannel, chordChannel]);
  if (preferred != null && !used.has(preferred) && ids.includes(preferred)) {
    return preferred;
  }
  return ids.find((c) => !used.has(c)) ?? bassChannel;
}

export function grooveLabDefaultLayerChannels(): {
  bass: number;
  chord: number;
  melody: number;
} {
  const ids = grooveLabChannelIds();
  const bass = ids[0] ?? CHORD_BASS_SEQ_CHANNEL_BASE;
  const chord = grooveLabPickChordChannel(bass);
  const melody = grooveLabPickMelodyChannel(bass, chord);
  return { bass, chord, melody };
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
