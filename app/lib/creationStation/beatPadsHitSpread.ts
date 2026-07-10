/**
 * Beat Pads — spread pitch math (CH 17 roll rows).
 * Row 0 = original pitch; each row steps ±1 semitone (808-style).
 */

import { cbPianoMidiToNoteName } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import { padSampleKey } from '@/app/lib/padSampleStorage';

export type BeatPadsSpreadDirection = 'down' | 'up';

/** Strip prior spread note suffix from a pad label. */
export function beatPadsSpreadBaseLabel(label: string): string {
  const trimmed = label.trim();
  const sep = trimmed.indexOf(' · ');
  return sep > 0 ? trimmed.slice(0, sep).trim() : trimmed;
}

/**
 * Strike MIDI for pad index — pad 1 = original pitch;
 * down: each pad −1 semitone; up: each pad +1 semitone.
 */
export function beatPadsSpreadRootMidi(
  sourceRootMidi: number,
  padIndex: number,
  direction: BeatPadsSpreadDirection = 'down',
): number {
  const root = Math.max(0, Math.min(127, Math.round(sourceRootMidi)));
  if (padIndex <= 0) return root;
  const delta = direction === 'up' ? padIndex : -padIndex;
  return Math.max(0, Math.min(127, root + delta));
}

/** Anchor MIDI for spread — chromatic root on source pad, else C4 + fine semitones. */
export function beatPadsSpreadAnchorRootMidi(
  rootMidi: number | undefined,
  chromatic: boolean | undefined,
  fineSemi = 0,
): number {
  if (chromatic && typeof rootMidi === 'number' && Number.isFinite(rootMidi)) {
    return Math.max(0, Math.min(127, Math.round(rootMidi)));
  }
  const fine = Number.isFinite(fineSemi) ? fineSemi : 0;
  return Math.max(0, Math.min(127, Math.round(60 + fine)));
}

/** Lane label after spread — pad 1 shows base name only; others show pitch. */
export function beatPadsSpreadPadLabel(
  baseLabel: string,
  padIndex: number,
  rootMidi: number,
): string {
  const base = beatPadsSpreadBaseLabel(baseLabel);
  if (padIndex <= 0) return base;
  return `${base} · ${cbPianoMidiToNoteName(rootMidi)}`;
}

/** True when all 16 pads look like a Spread → 16 layout (same base hit, chromatic, note suffixes). */
export function bankLooksLikeBeatPadsSpread(
  bankIndex: number,
  labels: Record<string, string>,
  presence: Record<string, boolean>,
  chromaticByKey: Record<string, boolean>,
): boolean {
  let base: string | null = null;
  for (let pi = 0; pi < 16; pi += 1) {
    const k = padSampleKey(bankIndex, pi);
    if (!presence[k] || !chromaticByKey[k]) return false;
    const label = labels[k]?.trim();
    if (!label) return false;
    const b = beatPadsSpreadBaseLabel(label);
    if (pi === 0) {
      if (label.includes(' · ')) return false;
      base = b;
    } else if (!label.includes(' · ') || b !== base) {
      return false;
    }
  }
  return base !== null;
}
