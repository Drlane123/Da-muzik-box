/**
 * Arpeggiator for Chord Builder — cycles voiced chord notes over the chord window.
 */

export type ArpPattern = 'up' | 'down' | 'updown' | 'random';

export interface ChordArpSettings {
  enabled: boolean;
  /** Pulses per bar (4 = quarters, 8 = eighths). */
  rate: 4 | 8 | 16;
  pattern: ArpPattern;
}

export const DEFAULT_CHORD_ARP: ChordArpSettings = {
  enabled: false,
  rate: 8,
  pattern: 'up',
};

export interface ArpNoteHit {
  midi: number;
  startTime: number;
  sustainSec: number;
  velocity: number;
}

function orderPattern(midis: ReadonlyArray<number>, pattern: ArpPattern, seed: number): number[] {
  const sorted = [...midis].sort((a, b) => a - b);
  if (pattern === 'up') return sorted;
  if (pattern === 'down') return sorted.reverse();
  if (pattern === 'updown') {
    if (sorted.length <= 2) return sorted;
    return [...sorted, ...sorted.slice(1, -1).reverse()];
  }
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const out = sorted.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function buildChordArpHits(
  midis: ReadonlyArray<number>,
  chordStartSec: number,
  chordDurationSec: number,
  bpm: number,
  settings: ChordArpSettings,
): ArpNoteHit[] {
  if (midis.length === 0) return [];
  const dur = Math.max(0.08, chordDurationSec);
  if (!settings.enabled) {
    return midis.map((midi) => ({
      midi,
      startTime: chordStartSec,
      sustainSec: dur * 0.9,
      velocity: 1,
    }));
  }

  const secPerBar = (60 / Math.max(1, bpm)) * 4;
  const pulseInterval = secPerBar / Math.max(1, settings.rate);
  const ordered = orderPattern(midis, settings.pattern, Math.floor(chordStartSec * 1000) ^ midis.length);
  const hits: ArpNoteHit[] = [];
  let idx = 0;
  for (let t = chordStartSec; t < chordStartSec + dur - 0.02; t += pulseInterval) {
    const midi = ordered[idx % ordered.length]!;
    idx += 1;
    hits.push({
      midi,
      startTime: t,
      sustainSec: Math.max(0.06, Math.min(pulseInterval * 0.92, chordStartSec + dur - t)),
      velocity: 0.88 + (idx % 3) * 0.04,
    });
  }
  if (hits.length === 0) {
    hits.push({
      midi: ordered[0]!,
      startTime: chordStartSec,
      sustainSec: dur * 0.9,
      velocity: 1,
    });
  }
  return hits;
}
