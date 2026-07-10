/**
 * Geno Ultra ARP — chord-degree pitch mapping (EON-style vertical spread).
 */
import {
  GENO_ARP_ACTIVE_ROW_SPAN,
  GENO_ARP_PRESET_ROW_OFFSET,
  GENO_ARP_ROWS,
  genoArpGridCols,
  genoArpRowBandRelative,
  genoArpRowToPitch,
  genoArpRowZoneOctOffset,
  genoArpSanitizeBarLength,
  genoArpSanitizeOctRange,
  type GenoArpBarLength,
  type GenoArpOctRange,
} from '@/app/lib/studio/genoUltraArpPattern';
import {
  genoArpResolveEffectiveTimeline,
  genoArpScaleIdFromKeyMode,
  type GenoArpChordType,
  type GenoUltraArpHarmonyContext,
} from '@/app/lib/studio/genoUltraArpHarmony';
import type { GenoUltraArpChordSegment } from '@/app/lib/studio/genoUltraArpState';
import type { NeuralHumScaleId } from '@/app/lib/vocalLab/neuralHumKeyLock';

export function genoUltraArpTotalPatternBeats(barLength: number): number {
  return genoArpSanitizeBarLength(barLength) * 4;
}

export function genoUltraArpBeatForGridCol(gridCol: number, barLength: number): number {
  const cols = genoArpGridCols(barLength);
  if (cols <= 0) return 0;
  const totalBeats = genoUltraArpTotalPatternBeats(barLength);
  return (gridCol / cols) * totalBeats;
}

export function genoUltraArpChordSegmentAtBeat(
  timeline: readonly GenoUltraArpChordSegment[],
  beat: number,
  totalBeats: number,
): GenoUltraArpChordSegment | undefined {
  if (!timeline.length) return undefined;
  const span = Math.max(0.001, totalBeats);
  const wrapped = ((beat % span) + span) % span;
  for (const seg of timeline) {
    const end = seg.startBeat + seg.durationBeats;
    if (wrapped >= seg.startBeat && wrapped < end - 1e-9) return seg;
  }
  return timeline[timeline.length - 1];
}

export type GenoUltraArpPitchSpread = {
  octRange?: GenoArpOctRange;
  orderInversion?: boolean;
};

function invertBandRow(row: number): number {
  const bandLo = GENO_ARP_PRESET_ROW_OFFSET;
  const bandHi = bandLo + GENO_ARP_ACTIVE_ROW_SPAN - 1;
  if (row < bandLo || row > bandHi) return row;
  return bandLo + bandHi - row;
}

function applyOctRangeSpread(midi: number, row: number, octRange: GenoArpOctRange): number {
  if (octRange <= 1) return midi;
  const rel = genoArpRowBandRelative(row);
  const span = GENO_ARP_ACTIVE_ROW_SPAN;
  const extraOct = Math.round((rel / Math.max(1, span - 1)) * (octRange - 1));
  return Math.max(0, Math.min(127, Math.round(midi + extraOct * 12)));
}

export function genoUltraArpApplyPitchSpread(
  midi: number,
  row: number,
  spread?: GenoUltraArpPitchSpread,
): number {
  if (!spread) return midi;
  const octRange = genoArpSanitizeOctRange(spread.octRange ?? 1);
  return applyOctRangeSpread(midi, row, octRange);
}

function rowToToneIndex(row: number, toneCount: number): number {
  if (toneCount <= 1) return 0;
  const rel = genoArpRowBandRelative(row);
  if (toneCount <= GENO_ARP_ACTIVE_ROW_SPAN) return Math.min(rel, toneCount - 1);
  return Math.round((rel / Math.max(1, GENO_ARP_ACTIVE_ROW_SPAN - 1)) * (toneCount - 1));
}

/** Map arp row → MIDI pitch using chord degrees when present. */
export function genoUltraArpPitchForRow(
  basePitch: number,
  row: number,
  octShift: number,
  segment: GenoUltraArpChordSegment | undefined,
  spread?: GenoUltraArpPitchSpread,
): number {
  const workRow = spread?.orderInversion ? invertBandRow(row) : row;
  const pitches = segment?.pitches;
  if (!pitches?.length) {
    const midi = genoArpRowToPitch(basePitch, workRow, octShift);
    return genoUltraArpApplyPitchSpread(midi, workRow, spread);
  }
  const sorted = [...new Set(pitches.map((p) => Math.round(p)))].sort((a, b) => a - b);
  const toneIdx = rowToToneIndex(workRow, sorted.length);
  const zoneOct = genoArpRowZoneOctOffset(workRow);
  const midi = (sorted[toneIdx] ?? sorted[0]!) + zoneOct;
  const pitched = Math.max(0, Math.min(127, Math.round(midi + octShift * 12)));
  return genoUltraArpApplyPitchSpread(pitched, workRow, spread);
}

export function genoUltraArpHarmonyFromSnapshot(
  snap: Pick<
    GenoUltraArpSnapshotFields,
    'keyRoot' | 'keyMode' | 'arpScaleId' | 'arpChordType' | 'chordTimeline'
  >,
): GenoUltraArpHarmonyContext {
  return {
    keyRoot: snap.keyRoot,
    scaleId: snap.arpScaleId ?? genoArpScaleIdFromKeyMode(snap.keyMode),
    chordType: snap.arpChordType ?? 'maj',
    chordTimeline: snap.chordTimeline,
  };
}

export function genoUltraArpPitchSpreadFromSnapshot(
  snap: Pick<GenoUltraArpSnapshotFields, 'octRange' | 'orderInversion'>,
): GenoUltraArpPitchSpread | undefined {
  const octRange = snap.octRange != null ? genoArpSanitizeOctRange(snap.octRange) : 1;
  const orderInversion = !!snap.orderInversion;
  if (octRange <= 1 && !orderInversion) return undefined;
  return { octRange, orderInversion };
}

type GenoUltraArpSnapshotFields = {
  keyRoot: number;
  keyMode: 'major' | 'minor';
  arpScaleId?: NeuralHumScaleId;
  arpChordType?: GenoArpChordType;
  chordTimeline?: readonly GenoUltraArpChordSegment[];
  octRange?: GenoArpOctRange;
  orderInversion?: boolean;
};

export function genoUltraArpPitchForGridCol(
  basePitch: number,
  row: number,
  octShift: number,
  barLength: GenoArpBarLength,
  harmony: GenoUltraArpHarmonyContext,
  gridCol: number,
  spread?: GenoUltraArpPitchSpread,
): number {
  const totalBeats = genoUltraArpTotalPatternBeats(barLength);
  const beat = genoUltraArpBeatForGridCol(gridCol, barLength);
  const timeline = genoArpResolveEffectiveTimeline(harmony, barLength, basePitch);
  const seg = genoUltraArpChordSegmentAtBeat(timeline, beat, totalBeats);
  return genoUltraArpPitchForRow(basePitch, row, octShift, seg, spread);
}

export { GENO_ARP_ROW_SEMIS } from '@/app/lib/studio/genoUltraArpPattern';
