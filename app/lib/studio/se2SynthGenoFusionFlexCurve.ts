/**
 * Note Flex — MIDISketch-style per-note pitch curves (2D points → glides at any angle).
 */
import type { Se2FusionPianoNote, Se2SynthGenoFusionLaneId } from '@/app/lib/studio/se2SynthGenoFusionRoll';

export type Se2FusionFlexPoint = {
  id: string;
  /** Beat offset from note.startBeat, in [0, durationBeats]. */
  beatOffset: number;
  pitch: number;
};

const LANE_PITCH: Record<Se2SynthGenoFusionLaneId, { lo: number; hi: number }> = {
  chords: { lo: 48, hi: 72 },
  melody: { lo: 60, hi: 84 },
  bass: { lo: 28, hi: 55 },
};

let flexPointIdSeq = 1;

export function se2FusionFlexNewPointId(): string {
  flexPointIdSeq += 1;
  return `flex-p-${Date.now()}-${flexPointIdSeq}`;
}

function clampPitch(pitch: number, lane: Se2SynthGenoFusionLaneId): number {
  const meta = LANE_PITCH[lane];
  return Math.max(meta.lo, Math.min(meta.hi, Math.round(pitch)));
}

function legacySegmentPitches(note: Se2FusionPianoNote, beatsPerBar: number): number[] {
  const bpb = Math.max(1, beatsPerBar);
  const segs: { startOff: number; endOff: number; index: number }[] = [];
  let pos = 0;
  const end = note.durationBeats;
  let segmentIndex = 0;
  while (pos < end - 1e-6) {
    const abs = note.startBeat + pos;
    const barIndex = Math.floor(abs / bpb);
    const barEnd = (barIndex + 1) * bpb;
    const segEnd = Math.min(end, barEnd - note.startBeat);
    const durationBeats = segEnd - pos;
    if (durationBeats > 1e-6) {
      segs.push({ startOff: pos, endOff: pos + durationBeats, index: segmentIndex });
      segmentIndex += 1;
    }
    pos = segEnd;
  }
  return segs.map((seg) => note.segmentPitches?.[seg.index] ?? note.pitch);
}

function clampBeatOffset(offset: number, durationBeats: number): number {
  return Math.max(0, Math.min(durationBeats, offset));
}

function sortFlexPoints(points: Se2FusionFlexPoint[]): Se2FusionFlexPoint[] {
  return [...points].sort((a, b) => a.beatOffset - b.beatOffset || a.id.localeCompare(b.id));
}

function dedupeFlexPoints(points: Se2FusionFlexPoint[], epsilon = 1 / 64): Se2FusionFlexPoint[] {
  const sorted = sortFlexPoints(points);
  const out: Se2FusionFlexPoint[] = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.beatOffset - p.beatOffset) < epsilon) {
      out[out.length - 1] = p;
    } else {
      out.push(p);
    }
  }
  return out;
}

/** Migrate legacy bar segments / pitchEnd into flex curve points. */
export function se2FusionMigrateNoteFlexCurve(
  note: Se2FusionPianoNote,
  beatsPerBar: number,
): Se2FusionPianoNote {
  if (note.flexCurve?.length) {
    const { pitchEnd: _d, segmentPitches: _s, ...rest } = note;
    return rest;
  }

  const hasSegments =
    note.segmentPitches?.some((p) => p !== note.pitch) ||
    (note.pitchEnd != null && note.pitchEnd !== note.pitch);

  if (!hasSegments) {
    const { pitchEnd: _d, segmentPitches: _s, ...rest } = note;
    return rest;
  }

  const pitches = legacySegmentPitches(note, beatsPerBar);
  if (pitches.every((p) => p === note.pitch) && note.pitchEnd == null) {
    const { pitchEnd: _d, segmentPitches: _s, ...rest } = note;
    return rest;
  }

  const bpb = Math.max(1, beatsPerBar);
  const points: Se2FusionFlexPoint[] = [];
  let pos = 0;
  let segIdx = 0;
  const end = note.durationBeats;
  while (pos < end - 1e-6) {
    const abs = note.startBeat + pos;
    const barEnd = (Math.floor(abs / bpb) + 1) * bpb - note.startBeat;
    const segEnd = Math.min(end, barEnd);
    const pitch = note.segmentPitches?.[segIdx] ?? note.pitch;
    points.push({ id: se2FusionFlexNewPointId(), beatOffset: pos, pitch });
    pos = segEnd;
    segIdx += 1;
  }
  if (note.pitchEnd != null && note.pitchEnd !== note.pitch) {
    points.push({ id: se2FusionFlexNewPointId(), beatOffset: end, pitch: note.pitchEnd });
  } else {
    const lastPitch = points[points.length - 1]?.pitch ?? note.pitch;
    points.push({ id: se2FusionFlexNewPointId(), beatOffset: end, pitch: lastPitch });
  }

  const deduped = dedupeFlexPoints(points);
  const allBase = deduped.every((p) => p.pitch === note.pitch);
  return {
    ...note,
    flexCurve: allBase ? undefined : deduped,
    segmentPitches: undefined,
    pitchEnd: undefined,
  };
}

/** Resolved curve always includes start + end anchors at base pitch when flat. */
export function se2FusionNoteFlexCurve(
  note: Se2FusionPianoNote,
  beatsPerBar: number,
): Se2FusionFlexPoint[] {
  const migrated = se2FusionMigrateNoteFlexCurve(note, beatsPerBar);
  const dur = migrated.durationBeats;
  if (!migrated.flexCurve?.length) {
    return [
      { id: 'flex-start', beatOffset: 0, pitch: migrated.pitch },
      { id: 'flex-end', beatOffset: dur, pitch: migrated.pitch },
    ];
  }
  const pts = dedupeFlexPoints(migrated.flexCurve.map((p) => ({
    ...p,
    beatOffset: clampBeatOffset(p.beatOffset, dur),
    pitch: Math.round(p.pitch),
  })));
  const out: Se2FusionFlexPoint[] = [];
  if (pts[0]!.beatOffset > 1e-6) {
    out.push({ id: 'flex-start', beatOffset: 0, pitch: migrated.pitch });
  }
  out.push(...pts);
  const last = out[out.length - 1]!;
  if (Math.abs(last.beatOffset - dur) > 1e-6) {
    out.push({ id: 'flex-end', beatOffset: dur, pitch: last.pitch });
  } else if (last.beatOffset < dur - 1e-6) {
    out[out.length - 1] = { ...last, beatOffset: dur };
  }
  return dedupeFlexPoints(out);
}

export function se2FusionCurvePitchAt(
  note: Se2FusionPianoNote,
  beatOffset: number,
  beatsPerBar: number,
): number {
  const curve = se2FusionNoteFlexCurve(note, beatsPerBar);
  const t = clampBeatOffset(beatOffset, note.durationBeats);
  if (curve.length === 0) return note.pitch;
  if (t <= curve[0]!.beatOffset) return curve[0]!.pitch;
  const last = curve[curve.length - 1]!;
  if (t >= last.beatOffset) return last.pitch;
  for (let i = 0; i < curve.length - 1; i += 1) {
    const a = curve[i]!;
    const b = curve[i + 1]!;
    if (t >= a.beatOffset && t <= b.beatOffset) {
      const span = b.beatOffset - a.beatOffset;
      if (span < 1e-9) return b.pitch;
      const u = (t - a.beatOffset) / span;
      return Math.round(a.pitch + (b.pitch - a.pitch) * u);
    }
  }
  return note.pitch;
}

export function se2FusionNoteHasFlexCurve(note: Se2FusionPianoNote, beatsPerBar: number): boolean {
  const migrated = se2FusionMigrateNoteFlexCurve(note, beatsPerBar);
  if (!migrated.flexCurve?.length) return false;
  const curve = se2FusionNoteFlexCurve(migrated, beatsPerBar);
  return curve.some((p) => p.pitch !== note.pitch);
}

export function se2FusionSanitizeFlexCurve(
  note: Se2FusionPianoNote,
  lane: Se2SynthGenoFusionLaneId,
): Se2FusionPianoNote {
  if (!note.flexCurve?.length) return note;
  const dur = note.durationBeats;
  const pts = dedupeFlexPoints(
    note.flexCurve.map((p) => ({
      ...p,
      beatOffset: clampBeatOffset(p.beatOffset, dur),
      pitch: clampPitch(p.pitch, lane),
    })),
  );
  const allBase = pts.every((p) => p.pitch === note.pitch);
  return { ...note, flexCurve: allBase ? undefined : pts };
}

export function se2FusionUpsertFlexPoint(
  note: Se2FusionPianoNote,
  point: Se2FusionFlexPoint,
  lane: Se2SynthGenoFusionLaneId,
): Se2FusionPianoNote {
  const dur = note.durationBeats;
  const next: Se2FusionFlexPoint = {
    ...point,
    beatOffset: clampBeatOffset(point.beatOffset, dur),
    pitch: clampPitch(point.pitch, lane),
  };
  const existing = note.flexCurve ?? [];
  const idx = existing.findIndex((p) => p.id === next.id);
  const merged = idx >= 0 ? existing.map((p, i) => (i === idx ? next : p)) : [...existing, next];
  const deduped = dedupeFlexPoints(merged);
  const allBase = deduped.every((p) => p.pitch === note.pitch);
  return {
    ...note,
    flexCurve: allBase ? undefined : deduped,
    segmentPitches: undefined,
    pitchEnd: undefined,
  };
}

export function se2FusionRemoveFlexPoint(note: Se2FusionPianoNote, pointId: string): Se2FusionPianoNote {
  if (!note.flexCurve?.length) return note;
  const filtered = note.flexCurve.filter((p) => p.id !== pointId);
  if (filtered.length === 0) {
    return { ...note, flexCurve: undefined };
  }
  const allBase = filtered.every((p) => p.pitch === note.pitch);
  return { ...note, flexCurve: allBase ? undefined : dedupeFlexPoints(filtered) };
}

export function se2FusionInterpolateCurveAt(
  curve: readonly { beatOffset: number; pitch: number }[],
  beatOffset: number,
  fallbackPitch: number,
): number {
  if (curve.length === 0) return fallbackPitch;
  const t = Math.max(0, beatOffset);
  const sorted = [...curve].sort((a, b) => a.beatOffset - b.beatOffset);
  if (t <= sorted[0]!.beatOffset) return sorted[0]!.pitch;
  const last = sorted[sorted.length - 1]!;
  if (t >= last.beatOffset) return last.pitch;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (t >= a.beatOffset && t <= b.beatOffset) {
      const span = b.beatOffset - a.beatOffset;
      if (span < 1e-9) return b.pitch;
      const u = (t - a.beatOffset) / span;
      return Math.round(a.pitch + (b.pitch - a.pitch) * u);
    }
  }
  return fallbackPitch;
}

/** MPE / MIDISketch-style pitch bend span (semitones) — Web Audio glides the full curve. */
export const SE2_FUSION_FLEX_BEND_RANGE_SEMITONES = 48;

export function se2FusionFlexCurveToPlaybackPoints(
  note: Se2FusionPianoNote,
  beatsPerBar: number,
): { beatOffset: number; pitch: number }[] {
  return se2FusionNoteFlexCurve(note, beatsPerBar).map((p) => ({
    beatOffset: p.beatOffset,
    pitch: p.pitch,
  }));
}

/** Sample flex curve into stepped MIDI (fallback for soundfont / legacy export). */
export function se2FusionFlexCurveToGenSlices(
  note: Se2FusionPianoNote,
  beatsPerBar: number,
  stepsPerBeat = 8,
): { startBeat: number; durationBeats: number; pitch: number }[] {
  const migrated = se2FusionMigrateNoteFlexCurve(note, beatsPerBar);
  const curve = se2FusionNoteFlexCurve(migrated, beatsPerBar);
  const hasBend = curve.some((p) => p.pitch !== migrated.pitch);
  if (!hasBend) {
    return [
      {
        startBeat: migrated.startBeat,
        durationBeats: migrated.durationBeats,
        pitch: migrated.pitch,
      },
    ];
  }

  const step = 1 / stepsPerBeat;
  const slices: { startBeat: number; durationBeats: number; pitch: number }[] = [];
  let t = 0;
  while (t < migrated.durationBeats - 1e-6) {
    const sliceDur = Math.min(step, migrated.durationBeats - t);
    const mid = t + sliceDur * 0.5;
    const pitch = se2FusionCurvePitchAt(migrated, mid, beatsPerBar);
    const startBeat = migrated.startBeat + t;
    const prev = slices[slices.length - 1];
    if (prev && prev.pitch === pitch && Math.abs(prev.startBeat + prev.durationBeats - startBeat) < 1e-6) {
      prev.durationBeats += sliceDur;
    } else {
      slices.push({ startBeat, durationBeats: sliceDur, pitch });
    }
    t += sliceDur;
  }
  return slices;
}
