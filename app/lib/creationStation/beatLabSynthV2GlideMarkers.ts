import type {
  BeatLabGlideShiftDir,
  BeatLabGlideShiftMarker,
} from '@/app/lib/creationStation/beatLabMelodicSynthV2State';

function midiToHz(m: number): number {
  const midi = Math.max(0, Math.min(127, m));
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Global pattern column where this marker fires (includes quant integer shift only). */
export function beatLabGlideMarkerStartCol(
  m: BeatLabGlideShiftMarker,
  stepsPerBar: number,
  quantShiftSteps: number,
): number {
  const spb = Math.max(1, stepsPerBar);
  return m.bar * spb + m.stepInBar + quantShiftSteps;
}

export function beatLabNormalizeGlideMarkers(
  raw: readonly BeatLabGlideShiftMarker[],
  layoutBars: 4 | 8,
  stepsPerBar: number,
): BeatLabGlideShiftMarker[] {
  const spb = Math.max(1, stepsPerBar);
  const out: BeatLabGlideShiftMarker[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    const bar = Math.max(0, Math.min(layoutBars - 1, Math.floor(x.bar)));
    const stepInBar = Math.max(0, Math.min(spb - 1, Math.floor(x.stepInBar)));
    const lenSteps = Math.max(1, Math.min(32, Math.floor(x.lenSteps)));
    const semi = Math.max(-12, Math.min(12, Math.round(Number(x.semi) || 3)));
    const dir: BeatLabGlideShiftDir =
      x.dir === 'down' || x.dir === 'roundtrip' ? x.dir : 'up';
    const key = `${bar},${stepInBar}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ bar, stepInBar, lenSteps, semi: semi === 0 ? 3 : semi, dir });
    if (out.length >= 64) break;
  }
  out.sort((a, b) => (a.bar * spb + a.stepInBar) - (b.bar * spb + b.stepInBar));
  return out;
}

/** After main portamento, bend pitch on quantized grid (“shift”). */
export function applyBeatLabGlideShiftMarkersToOsc(
  o: OscillatorNode,
  targetMidi: number,
  glideSecHold: number,
  markers: readonly BeatLabGlideShiftMarker[] | undefined,
  whenNote: number,
  noteEndSec: number,
  noteStartCol: number,
  noteEndCol: number,
  subSpb: number,
  stepsPerBar: number,
  quantShiftSteps: number,
  quantFineFrac: number,
  snapMidiInKey?: (midi: number, dir: 'up' | 'down') => number,
): void {
  if (!markers || markers.length === 0 || subSpb <= 1e-6) return;

  const hzBase = midiToHz(targetMidi);
  const stableWhen = Math.max(whenNote, whenNote + Math.min(glideSecHold, noteEndSec - whenNote));
  const fineSec = Math.max(0, Math.min(1, quantFineFrac)) * subSpb;
  const mkHz = (offset: number) => midiToHz(targetMidi + offset);

  for (const m of markers) {
    const mc = beatLabGlideMarkerStartCol(m, stepsPerBar, quantShiftSteps);
    const me = mc + m.lenSteps;
    if (me <= noteStartCol || mc >= noteEndCol) continue;

    const clip0 = Math.max(mc, noteStartCol);
    const clip1 = Math.min(me, noteEndCol);
    const durSteps = clip1 - clip0;
    if (durSteps < 0.25) continue;

    const durSec = Math.max(0.014, durSteps * subSpb * 0.995);
    const t0Raw = whenNote + Math.max(0, clip0 - noteStartCol) * subSpb + fineSec;
    let t0 = Math.max(stableWhen, t0Raw);
    if (t0 >= noteEndSec - durSec * 0.08) continue;

    const t1 = Math.min(noteEndSec, t0 + durSec);

    const mMag = Math.max(
      1,
      Math.min(12, Math.round(m.semi !== 0 ? Math.abs(m.semi) : 3)),
    );

    if (m.dir === 'roundtrip') {
      const off = Math.sign(m.semi) === -1 ? -mMag : mMag;
      const peakMidiRaw = targetMidi + off;
      const peakMidi = snapMidiInKey
        ? snapMidiInKey(peakMidiRaw, off >= 0 ? 'up' : 'down')
        : peakMidiRaw;
      const hzPeak = midiToHz(peakMidi);
      const tm = Math.min(noteEndSec, t0 + (t1 - t0) / 2);
      o.frequency.setValueAtTime(hzBase, t0);
      o.frequency.linearRampToValueAtTime(hzPeak, tm);
      o.frequency.linearRampToValueAtTime(hzBase, t1);
    } else if (m.dir === 'up') {
      const peakMidiRaw = targetMidi + mMag;
      const peakMidi = snapMidiInKey ? snapMidiInKey(peakMidiRaw, 'up') : peakMidiRaw;
      const hzPeak = midiToHz(peakMidi);
      o.frequency.setValueAtTime(hzBase, t0);
      o.frequency.linearRampToValueAtTime(hzPeak, t1);
      o.frequency.linearRampToValueAtTime(hzBase, Math.min(noteEndSec, t1 + durSec * 0.05));
    } else {
      const peakMidiRaw = targetMidi - mMag;
      const peakMidi = snapMidiInKey ? snapMidiInKey(peakMidiRaw, 'down') : peakMidiRaw;
      const hzPeak = midiToHz(peakMidi);
      o.frequency.setValueAtTime(hzBase, t0);
      o.frequency.linearRampToValueAtTime(hzPeak, t1);
      o.frequency.linearRampToValueAtTime(hzBase, Math.min(noteEndSec, t1 + durSec * 0.05));
    }
  }
}