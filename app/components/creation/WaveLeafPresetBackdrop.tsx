/**
 * Groove Lead — instrument watermarks behind preset pads.
 *
 * - Guitar: Wikimedia Commons "Acoustic guitar.svg" (OCAL / narrowhouse, CC0)
 * - Flute: Wikimedia Commons "Flute.svg" (side view, CC BY-SA 2.5)
 * - Center: Mini Moog photo (white stripped — `groove-lead-backdrop-minimoog-cutout.png`)
 */
import type { WaveLeafPresetBackdropHighlight } from '@/app/lib/creationStation/waveLeafPresets';

const GUITAR_SRC = '/groove-lead-backdrop-guitar.svg';
const FLUTE_SRC = '/groove-lead-backdrop-flute.svg';
const MINIMOOG_SRC = '/groove-lead-backdrop-minimoog-cutout.png';

export type WaveLeafPresetBackdropProps = {
  highlight?: WaveLeafPresetBackdropHighlight;
};

export function WaveLeafPresetBackdrop({ highlight = 'both' }: WaveLeafPresetBackdropProps) {
  return (
    <div
      className={`groove-lead-preset-backdrop groove-lead-preset-backdrop--${highlight}`}
      aria-hidden
    >
      <img
        className="groove-lead-preset-backdrop__guitar"
        src={GUITAR_SRC}
        alt=""
        decoding="async"
        draggable={false}
      />
      <img
        className="groove-lead-preset-backdrop__moog"
        src={MINIMOOG_SRC}
        alt=""
        decoding="async"
        draggable={false}
      />
      <img
        className="groove-lead-preset-backdrop__flute"
        src={FLUTE_SRC}
        alt=""
        decoding="async"
        draggable={false}
      />
    </div>
  );
}
