import type {
  BeatLabBassSynthVoiceParams,
  BeatLabGlideLayoutBars,
  BeatLabGlideShiftMarker,
} from '@/app/lib/creationStation/beatLabMelodicSynthV2State';
import { beatLabNormalizeGlideMarkers } from '@/app/lib/creationStation/beatLabSynthV2GlideMarkers';
import type { BeatLabSynthGlideDivision } from '@/app/lib/creationStation/beatLabMelodicSynthV2Timing';

export type BeatLabSynthV2GlidePresetDef = {
  id: string;
  name: string;
  category: string;
  patch: Partial<BeatLabBassSynthVoiceParams>;
};

export const BEAT_LAB_SYNTH2_GLIDE_PRESET_CATEGORY_ORDER: readonly string[] = [
  'Start',
  'Bass · mono',
  '808 style',
  'Trap · drill',
  'Acid',
  'Funk · R&B',
  'Lead · legato',
  'Stutter · grid',
  'Chord glide',
  'Shift · quant',
  'Slide motion',
  'Synced · specials',
];

export function beatLabSynthV2GlideBarMaskAll(layoutBars: number): number {
  return layoutBars >= 31 ? 0x7fffffff : Math.max(1, (1 << layoutBars) - 1);
}

export function beatLabSynthV2GlideDivisionToCols(
  div: NonNullable<BeatLabBassSynthVoiceParams['glideDivision']>,
  subdiv: number,
): number {
  if (div === '1/32') return Math.max(1, Math.round(subdiv * (1 / 8)));
  if (div === '1/16') return Math.max(1, Math.round(subdiv * (1 / 4)));
  if (div === '1/8') return Math.max(1, Math.round(subdiv * (1 / 2)));
  return Math.max(1, Math.round(subdiv));
}

/** Layout preview markers so the glide graph shows each preset shape. */
export function beatLabSynthV2GlidePresetPreviewMarkers(
  v: Partial<BeatLabBassSynthVoiceParams>,
  layoutBars: BeatLabGlideLayoutBars,
  stepsPerBar: number,
  qCols: number,
): BeatLabGlideShiftMarker[] {
  const style = v.glideStyle ?? 'smooth';
  const out: BeatLabGlideShiftMarker[] = [];
  const stepQ = Math.max(1, qCols);
  const semiBase = Math.max(1, Math.min(8, Math.round((v.glideMs ?? 100) / 55)));
  const modeBoost = v.glideMode === 'legato' ? 1 : v.glideMode === 'chord' ? 2 : 0;
  for (let b = 0; b < layoutBars; b += 1) {
    if (style === 'stutter') {
      const stSemi = Math.max(1, Math.min(10, semiBase + modeBoost));
      const stride = Math.max(1, stepQ);
      for (let c = stride; c < stepsPerBar; c += stride) {
        const flip = Math.floor(c / stepQ) % 2 === 0;
        out.push({
          bar: b,
          stepInBar: c,
          lenSteps: Math.max(1, Math.round(stepQ * 0.9)),
          semi: stSemi,
          dir: flip ? 'up' : 'down',
        });
      }
    } else if (style === 'shift') {
      const shiftSemi = Math.max(2, Math.min(12, semiBase + 1 + modeBoost));
      out.push({ bar: b, stepInBar: stepQ, lenSteps: stepQ, semi: shiftSemi, dir: 'up' });
      out.push({
        bar: b,
        stepInBar: Math.max(stepQ, Math.min(stepsPerBar - 1, stepQ * 2)),
        lenSteps: stepQ,
        semi: shiftSemi,
        dir: 'down',
      });
    } else {
      out.push({
        bar: b,
        stepInBar: Math.max(1, Math.min(stepsPerBar - 1, Math.round(stepsPerBar * 0.45))),
        lenSteps: stepQ,
        semi: Math.max(1, Math.min(8, semiBase + modeBoost)),
        dir: 'up',
      });
      out.push({
        bar: b,
        stepInBar: Math.max(1, Math.min(stepsPerBar - 1, Math.round(stepsPerBar * 0.78))),
        lenSteps: stepQ,
        semi: Math.max(1, Math.min(7, semiBase)),
        dir: 'down',
      });
    }
    if (v.slideMotionEnabled === true) {
      const semi = Math.max(1, Math.min(12, Math.round(v.slideMotionSemi ?? 2)));
      const dir = v.slideMotionDir === 'down' ? 'down' : 'up';
      out.push({
        bar: b,
        stepInBar: Math.max(0, stepsPerBar - stepQ),
        lenSteps: stepQ,
        semi,
        dir,
      });
    }
  }
  return beatLabNormalizeGlideMarkers(out, layoutBars, stepsPerBar);
}

/** Starter pink shift lines when user picks Shift shape with no markers yet. */
export function beatLabSynthV2StarterShiftMarkers(
  layoutBars: BeatLabGlideLayoutBars,
  stepsPerBar: number,
  qCols: number,
): BeatLabGlideShiftMarker[] {
  const bars = Math.max(1, Math.min(layoutBars, 4));
  const out: BeatLabGlideShiftMarker[] = [];
  for (let b = 0; b < bars; b += 1) {
    const a = Math.max(0, Math.min(stepsPerBar - 1, qCols));
    const c = Math.max(0, Math.min(stepsPerBar - 1, qCols * 2));
    out.push({ bar: b, stepInBar: a, lenSteps: Math.max(1, qCols), semi: 3, dir: 'up' });
    out.push({ bar: b, stepInBar: c, lenSteps: Math.max(1, qCols), semi: 3, dir: 'down' });
  }
  return beatLabNormalizeGlideMarkers(out, layoutBars, stepsPerBar);
}

export function beatLabSynthV2GlidePresetGroups(
  presets: readonly BeatLabSynthV2GlidePresetDef[] = BEAT_LAB_SYNTH2_GLIDE_PRESETS,
): { category: string; items: BeatLabSynthV2GlidePresetDef[] }[] {
  const map = new Map<string, BeatLabSynthV2GlidePresetDef[]>();
  for (const p of presets) {
    const arr = map.get(p.category) ?? [];
    arr.push(p);
    map.set(p.category, arr);
  }
  return BEAT_LAB_SYNTH2_GLIDE_PRESET_CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
    category: c,
    items: map.get(c)!,
  }));
}

const ALL_BARS = 0xffffffff;

/** Glide-layout effect recipes — apply on top of any generated bass pattern. */
export const BEAT_LAB_SYNTH2_GLIDE_PRESETS: readonly BeatLabSynthV2GlidePresetDef[] = [
  {
    id: 'deep-default',
    category: 'Start',
    name: 'Deep Default',
    patch: {
      glideMode: 'mono',
      glideStyle: 'smooth',
      glideSync: false,
      glideMs: 110,
      glideDivision: '1/16',
      glideIntraNote: false,
      glideBarMask: ALL_BARS,
      slideBarMask: ALL_BARS,
      glideShiftMarkers: [],
    },
  },
  { id: 'glide-off', category: 'Start', name: 'Glide Off', patch: { glideMode: 'off', glideShiftMarkers: [], glideBarMask: 0, slideBarMask: 0 } },
  { id: 'mono-dry', category: 'Start', name: 'Mono Dry (no glide)', patch: { glideMode: 'mono', glideMs: 0, glideSync: false, glideShiftMarkers: [], glideBarMask: ALL_BARS } },

  { id: 'tight-bass', category: 'Bass · mono', name: 'Tight Bass', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 55, glideBarMask: ALL_BARS, slideBarMask: ALL_BARS } },
  { id: 'pocket-bass', category: 'Bass · mono', name: 'Pocket Bass', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 72, glideBarMask: ALL_BARS } },
  { id: 'funk-connect', category: 'Bass · mono', name: 'Funk Connect', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 88, glideBarMask: ALL_BARS } },
  { id: 'sub-bloom', category: 'Bass · mono', name: 'Sub Bloom', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 140, glideBarMask: ALL_BARS } },
  { id: 'micro-slur', category: 'Bass · mono', name: 'Micro Slur', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 38, glideBarMask: ALL_BARS } },
  { id: 'deep-mono-drift', category: 'Bass · mono', name: 'Deep Mono Drift', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 195, glideBarMask: ALL_BARS } },
  { id: 'woofer-glide', category: 'Bass · mono', name: 'Woofer Glide', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 250, glideBarMask: ALL_BARS } },
  { id: 'rubber-mono', category: 'Bass · mono', name: 'Rubber Mono', patch: { glideMode: 'mono', glideStyle: 'smooth', glideSync: true, glideDivision: '1/16', glideMs: 95, glideBarMask: ALL_BARS } },
  { id: 'house-pump', category: 'Bass · mono', name: 'House Pump', patch: { glideMode: 'mono', glideStyle: 'smooth', glideSync: true, glideDivision: '1/8', glideMs: 70, glideBarMask: ALL_BARS } },

  { id: 'subtle-808', category: '808 style', name: 'Subtle 808', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 90, glideBarMask: ALL_BARS } },
  { id: 'long-808', category: '808 style', name: 'Long 808', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 210, glideBarMask: ALL_BARS } },
  { id: 'hyper-808', category: '808 style', name: 'Hyper 808', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 330, glideBarMask: ALL_BARS } },
  { id: 'bounce-808', category: '808 style', name: 'Bounce 808', patch: { glideMode: 'mono', glideStyle: 'smooth', glideSync: true, glideDivision: '1/16', glideMs: 120, glideBarMask: ALL_BARS } },
  { id: '808-quarter-slide', category: '808 style', name: '808 Quarter Slide', patch: { glideMode: 'mono', glideStyle: 'smooth', glideSync: true, glideDivision: '1/4', glideBarMask: ALL_BARS } },
  { id: '808-legato-slur', category: '808 style', name: '808 Legato Slur', patch: { glideMode: 'legato', glideStyle: 'smooth', glideMs: 165, glideBarMask: ALL_BARS } },
  { id: '808-dream', category: '808 style', name: '808 Dream', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 400, glideBarMask: ALL_BARS } },
  { id: '808-trill', category: '808 style', name: '808 Trill', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/32', glideIntraNote: true, glideBarMask: ALL_BARS } },
  { id: '808-sub-drop', category: '808 style', name: '808 Sub Drop', patch: { glideMode: 'mono', glideStyle: 'smooth', glideSync: true, glideDivision: '1/4', glideMs: 280, glideBarMask: ALL_BARS } },

  { id: 'trap-tight-32', category: 'Trap · drill', name: 'Trap Tight 1/32', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/32', glideMs: 48, glideBarMask: ALL_BARS } },
  { id: 'trap-slide-long', category: 'Trap · drill', name: 'Trap Long Slide', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 175, glideBarMask: ALL_BARS } },
  { id: 'drill-stab', category: 'Trap · drill', name: 'Drill Stab', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/16', glideIntraNote: false, glideMs: 42, glideBarMask: ALL_BARS } },
  { id: 'drill-rapid', category: 'Trap · drill', name: 'Drill Rapid', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/32', glideIntraNote: true, glideMs: 35, glideBarMask: ALL_BARS } },
  { id: 'uk-garage-skip', category: 'Trap · drill', name: 'UK Garage Skip', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/8', glideMs: 65, glideBarMask: ALL_BARS } },
  { id: 'half-time-trap', category: 'Trap · drill', name: 'Half-Time Trap', patch: { glideMode: 'mono', glideStyle: 'smooth', glideSync: true, glideDivision: '1/8', glideMs: 155, glideBarMask: ALL_BARS } },

  { id: 'acid-snap', category: 'Acid', name: 'Acid Snap', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/32', glideIntraNote: false, glideBarMask: ALL_BARS } },
  { id: 'acid-trip', category: 'Acid', name: 'Acid Trip', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/16', glideIntraNote: true, glideBarMask: ALL_BARS } },
  { id: 'rez-bite', category: 'Acid', name: 'Rez Bite', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/32', glideIntraNote: false, glideMs: 45, glideBarMask: ALL_BARS } },
  { id: 'rez-slow-burn', category: 'Acid', name: 'Rez Slow Burn', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/8', glideIntraNote: false, glideBarMask: ALL_BARS } },
  { id: 'acid-zigzag', category: 'Acid', name: 'Acid Zigzag', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/16', glideIntraNote: true, glideBarMask: ALL_BARS } },
  { id: 'acid-squelch', category: 'Acid', name: 'Acid Squelch', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/32', glideMs: 28, glideIntraNote: true, glideBarMask: ALL_BARS } },
  { id: 'tb-303-walk', category: 'Acid', name: 'TB-303 Walk', patch: { glideMode: 'mono', glideStyle: 'smooth', glideSync: true, glideDivision: '1/16', glideMs: 58, glideBarMask: ALL_BARS } },

  { id: 'funk-slap-glide', category: 'Funk · R&B', name: 'Funk Slap Glide', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 52, slideMotionEnabled: true, slideMotionAt: 'head', slideMotionSemi: 4, glideBarMask: ALL_BARS, slideBarMask: ALL_BARS } },
  { id: 'rnb-smooth', category: 'Funk · R&B', name: 'R&B Smooth', patch: { glideMode: 'legato', glideStyle: 'smooth', glideMs: 130, glideBarMask: ALL_BARS } },
  { id: 'neo-soul-drift', category: 'Funk · R&B', name: 'Neo Soul Drift', patch: { glideMode: 'legato', glideStyle: 'smooth', glideMs: 200, glideSync: false, glideBarMask: ALL_BARS } },
  { id: 'disco-octave', category: 'Funk · R&B', name: 'Disco Octave Pop', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 68, slideMotionEnabled: true, slideMotionAt: 'tail', slideMotionSemi: 12, glideBarMask: ALL_BARS } },
  { id: 'motown-punch', category: 'Funk · R&B', name: 'Motown Punch', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 48, glideBarMask: ALL_BARS } },

  { id: 'fingered-legato', category: 'Lead · legato', name: 'Fingered Legato', patch: { glideMode: 'legato', glideStyle: 'smooth', glideMs: 75, glideBarMask: ALL_BARS } },
  { id: 'lead-bend-short', category: 'Lead · legato', name: 'Lead Bend Short', patch: { glideMode: 'legato', glideStyle: 'smooth', glideMs: 95, glideBarMask: ALL_BARS } },
  { id: 'lead-bend-long', category: 'Lead · legato', name: 'Lead Bend Long', patch: { glideMode: 'legato', glideStyle: 'smooth', glideMs: 180, glideBarMask: ALL_BARS } },
  { id: 'soaring-lead', category: 'Lead · legato', name: 'Soaring Lead', patch: { glideMode: 'legato', glideStyle: 'smooth', glideMs: 240, glideBarMask: ALL_BARS } },
  { id: 'pluck-portamento', category: 'Lead · legato', name: 'Pluck Portamento', patch: { glideMode: 'legato', glideStyle: 'smooth', glideMs: 62, glideBarMask: ALL_BARS } },
  { id: 'neon-bend', category: 'Lead · legato', name: 'Neon Bend', patch: { glideMode: 'legato', glideStyle: 'smooth', glideSync: true, glideDivision: '1/16', glideBarMask: ALL_BARS } },
  { id: 'airy-drift', category: 'Lead · legato', name: 'Airy Drift', patch: { glideMode: 'legato', glideStyle: 'smooth', glideSync: true, glideDivision: '1/8', glideBarMask: ALL_BARS } },
  { id: 'fretless-bass', category: 'Lead · legato', name: 'Fretless Bass', patch: { glideMode: 'legato', glideStyle: 'smooth', glideMs: 145, glideIntraNote: false, glideBarMask: ALL_BARS } },

  { id: 'edm-lift', category: 'Stutter · grid', name: 'EDM Lift', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/8', glideIntraNote: false, glideBarMask: ALL_BARS } },
  { id: 'stutter-grid-16', category: 'Stutter · grid', name: 'Stutter Grid 1/16', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/16', glideIntraNote: false, glideBarMask: ALL_BARS } },
  { id: 'stutter-grid-8', category: 'Stutter · grid', name: 'Stutter Grid 1/8', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/8', glideIntraNote: false, glideBarMask: ALL_BARS } },
  { id: 'stutter-roll', category: 'Stutter · grid', name: 'Stutter Roll', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/32', glideIntraNote: true, glideBarMask: ALL_BARS } },
  { id: 'grid-quarter-pulse', category: 'Stutter · grid', name: 'Grid Quarter Pulse', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/4', glideIntraNote: false, glideBarMask: ALL_BARS } },
  { id: 'techno-tick', category: 'Stutter · grid', name: 'Techno Tick', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/32', glideIntraNote: false, glideBarMask: ALL_BARS } },
  { id: 'halftime-stutter', category: 'Stutter · grid', name: 'Halftime Stutter', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/8', glideIntraNote: true, glideBarMask: ALL_BARS } },
  { id: 'triplet-stutter', category: 'Stutter · grid', name: 'Triplet Feel', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/16', glideIntraNote: true, glideMs: 50, glideBarMask: ALL_BARS } },
  { id: 'dotted-stutter', category: 'Stutter · grid', name: 'Dotted Stutter', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/8', glideIntraNote: true, glideMs: 60, glideBarMask: ALL_BARS } },

  { id: 'chord-follow-gentle', category: 'Chord glide', name: 'Chord Follow Gentle', patch: { glideMode: 'chord', glideStyle: 'smooth', glideSync: true, glideDivision: '1/16', glideBarMask: ALL_BARS } },
  { id: 'chord-follow-wide', category: 'Chord glide', name: 'Chord Follow Wide', patch: { glideMode: 'chord', glideStyle: 'smooth', glideMs: 260, glideBarMask: ALL_BARS } },
  { id: 'chord-stutter-bar', category: 'Chord glide', name: 'Chord Stutter Bar', patch: { glideMode: 'chord', glideStyle: 'stutter', glideSync: true, glideDivision: '1/8', glideIntraNote: false, glideBarMask: ALL_BARS } },
  { id: 'chord-legato-drift', category: 'Chord glide', name: 'Chord Legato Drift', patch: { glideMode: 'chord', glideStyle: 'smooth', glideMs: 190, glideBarMask: ALL_BARS } },
  { id: 'hymn-spread', category: 'Chord glide', name: 'Hymn Spread', patch: { glideMode: 'chord', glideStyle: 'smooth', glideSync: true, glideDivision: '1/4', glideBarMask: ALL_BARS } },
  { id: 'gospel-walk', category: 'Chord glide', name: 'Gospel Walk', patch: { glideMode: 'chord', glideStyle: 'smooth', glideMs: 120, glideSync: true, glideDivision: '1/8', glideBarMask: ALL_BARS } },
  { id: 'jazz-chord-glide', category: 'Chord glide', name: 'Jazz Chord Glide', patch: { glideMode: 'chord', glideStyle: 'smooth', glideMs: 155, glideBarMask: ALL_BARS } },

  { id: 'shift-punch', category: 'Shift · quant', name: 'Shift Punch', patch: { glideMode: 'mono', glideStyle: 'shift', glideSync: true, glideDivision: '1/16', glideQuantShiftSteps: 0, glideQuantShiftFine: 0, glideBarMask: ALL_BARS } },
  { id: 'shift-late', category: 'Shift · quant', name: 'Shift Late', patch: { glideMode: 'mono', glideStyle: 'shift', glideSync: true, glideDivision: '1/16', glideQuantShiftSteps: 1, glideQuantShiftFine: 0.25, glideBarMask: ALL_BARS } },
  { id: 'shift-early', category: 'Shift · quant', name: 'Shift Early', patch: { glideMode: 'mono', glideStyle: 'shift', glideSync: true, glideDivision: '1/16', glideQuantShiftSteps: -1, glideQuantShiftFine: 0.25, glideBarMask: ALL_BARS } },
  { id: 'shift-nudge-plus', category: 'Shift · quant', name: 'Shift Nudge +', patch: { glideMode: 'mono', glideStyle: 'shift', glideSync: true, glideDivision: '1/32', glideQuantShiftSteps: 2, glideQuantShiftFine: 0.15, glideBarMask: ALL_BARS } },
  { id: 'shift-nudge-minus', category: 'Shift · quant', name: 'Shift Nudge −', patch: { glideMode: 'mono', glideStyle: 'shift', glideSync: true, glideDivision: '1/32', glideQuantShiftSteps: -2, glideQuantShiftFine: 0.15, glideBarMask: ALL_BARS } },
  { id: 'shift-wide-lag', category: 'Shift · quant', name: 'Shift Wide Lag', patch: { glideMode: 'mono', glideStyle: 'shift', glideSync: true, glideDivision: '1/8', glideQuantShiftSteps: 0, glideQuantShiftFine: 0.5, glideBarMask: ALL_BARS } },
  { id: 'drawer-micro', category: 'Shift · quant', name: 'Drawer Micro', patch: { glideMode: 'mono', glideStyle: 'shift', glideSync: true, glideDivision: '1/32', glideQuantShiftSteps: 0, glideQuantShiftFine: 0.35, glideBarMask: ALL_BARS } },
  { id: 'shift-saw-up', category: 'Shift · quant', name: 'Shift Saw Up', patch: { glideMode: 'mono', glideStyle: 'shift', glideSync: true, glideDivision: '1/16', glideQuantShiftSteps: 0, glideBarMask: ALL_BARS } },
  { id: 'shift-ladder', category: 'Shift · quant', name: 'Shift Ladder', patch: { glideMode: 'mono', glideStyle: 'shift', glideSync: true, glideDivision: '1/8', glideQuantShiftSteps: 1, glideBarMask: ALL_BARS } },
  { id: 'shift-roundtrip', category: 'Shift · quant', name: 'Shift Roundtrip', patch: { glideMode: 'mono', glideStyle: 'shift', glideSync: true, glideDivision: '1/16', glideBarMask: ALL_BARS } },

  { id: 'slide-tail-sweet', category: 'Slide motion', name: 'Tail Slide Sweet', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 90, slideMotionEnabled: true, slideMotionAt: 'tail', slideMotionSemi: 3, slideMotionFrac: 0.25, glideBarMask: ALL_BARS, slideBarMask: ALL_BARS } },
  { id: 'slide-head-nip', category: 'Slide motion', name: 'Head Slide Nip', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 70, slideMotionEnabled: true, slideMotionAt: 'head', slideMotionSemi: 2, slideMotionFrac: 0.18, glideBarMask: ALL_BARS, slideBarMask: ALL_BARS } },
  { id: 'slide-both-wide', category: 'Slide motion', name: 'Head + Tail Slide', patch: { glideMode: 'legato', glideStyle: 'smooth', glideMs: 110, slideMotionEnabled: true, slideMotionAt: 'both', slideMotionSemi: 5, slideMotionFrac: 0.35, glideBarMask: ALL_BARS, slideBarMask: ALL_BARS } },
  { id: 'slide-down-drama', category: 'Slide motion', name: 'Slide Down Drama', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 100, slideMotionEnabled: true, slideMotionDir: 'down', slideMotionSemi: 7, slideMotionAt: 'tail', glideBarMask: ALL_BARS, slideBarMask: ALL_BARS } },
  { id: 'slide-fast-wham', category: 'Slide motion', name: 'Fast Whammy', patch: { glideMode: 'mono', glideStyle: 'smooth', glideMs: 45, slideMotionEnabled: true, slideMotionRateMs: 35, slideMotionSemi: 4, glideBarMask: ALL_BARS, slideBarMask: ALL_BARS } },
  { id: 'slide-slow-wham', category: 'Slide motion', name: 'Slow Whammy', patch: { glideMode: 'legato', glideStyle: 'smooth', glideMs: 160, slideMotionEnabled: true, slideMotionRateMs: 140, slideMotionSemi: 6, glideBarMask: ALL_BARS, slideBarMask: ALL_BARS } },
  { id: 'slide-only', category: 'Slide motion', name: 'Slide Only (no glide)', patch: { glideMode: 'off', slideMotionEnabled: true, slideMotionAt: 'tail', slideMotionSemi: 4, glideBarMask: ALL_BARS, slideBarMask: ALL_BARS, glideShiftMarkers: [] } },

  { id: 'cinematic-slide', category: 'Synced · specials', name: 'Cinematic Slide', patch: { glideMode: 'legato', glideStyle: 'smooth', glideSync: true, glideDivision: '1/4', glideMs: 340, glideBarMask: ALL_BARS } },
  { id: 'sync-bar-slide', category: 'Synced · specials', name: 'Sync Bar Slide', patch: { glideMode: 'mono', glideStyle: 'smooth', glideSync: true, glideDivision: '1/4', glideBarMask: ALL_BARS } },
  { id: 'sync-slow-wide', category: 'Synced · specials', name: 'Slow Wide (1 beat)', patch: { glideMode: 'legato', glideStyle: 'smooth', glideSync: true, glideDivision: '1/4', glideMs: 300, glideBarMask: ALL_BARS } },
  { id: 'expressive-legato-bar', category: 'Synced · specials', name: 'Expressive Legato Bar', patch: { glideMode: 'legato', glideStyle: 'smooth', glideSync: true, glideDivision: '1/4', glideIntraNote: false, glideBarMask: ALL_BARS } },
  { id: 'horror-rise', category: 'Synced · specials', name: 'Horror Rise', patch: { glideMode: 'legato', glideStyle: 'smooth', glideSync: true, glideDivision: '1/4', glideMs: 420, slideMotionEnabled: true, slideMotionDir: 'up', slideMotionSemi: 8, glideBarMask: ALL_BARS } },
  { id: 'dub-wobble', category: 'Synced · specials', name: 'Dub Wobble', patch: { glideMode: 'mono', glideStyle: 'stutter', glideSync: true, glideDivision: '1/8', glideIntraNote: true, glideMs: 80, glideBarMask: ALL_BARS } },
  { id: 'ambient-drift', category: 'Synced · specials', name: 'Ambient Drift', patch: { glideMode: 'legato', glideStyle: 'smooth', glideMs: 360, glideSync: false, glideBarMask: ALL_BARS } },
];

export function beatLabSynthV2FindGlidePreset(id: string): BeatLabSynthV2GlidePresetDef | undefined {
  return BEAT_LAB_SYNTH2_GLIDE_PRESETS.find((p) => p.id === id);
}

export function beatLabSynthV2BuildGlidePresetVoicePatch(opts: {
  presetId: string;
  layoutBars: BeatLabGlideLayoutBars;
  stepsPerBar: number;
  subdiv: number;
  hasChordRail: boolean;
  fallbackGlideDivision?: BeatLabSynthGlideDivision;
}): Partial<BeatLabBassSynthVoiceParams> | null {
  const preset = beatLabSynthV2FindGlidePreset(opts.presetId);
  if (!preset) return null;
  const next: Partial<BeatLabBassSynthVoiceParams> = { ...preset.patch };
  if (next.glideMode === 'chord' && !opts.hasChordRail) next.glideMode = 'mono';
  const bars: BeatLabGlideLayoutBars =
    next.glideLayoutBars === 4 || next.glideLayoutBars === 8 ? next.glideLayoutBars : opts.layoutBars;
  const barMask = beatLabSynthV2GlideBarMaskAll(bars);
  if (next.glideBarMask === ALL_BARS || next.glideBarMask == null) next.glideBarMask = barMask;
  if (next.slideBarMask === ALL_BARS || next.slideBarMask == null) next.slideBarMask = barMask;
  const cols = beatLabSynthV2GlideDivisionToCols(
    next.glideDivision ?? opts.fallbackGlideDivision ?? '1/16',
    opts.subdiv,
  );
  if (!next.glideShiftMarkers || next.glideShiftMarkers.length === 0) {
    next.glideShiftMarkers = beatLabSynthV2GlidePresetPreviewMarkers(next, bars, opts.stepsPerBar, cols);
  }
  if ((next.glideStyle ?? 'smooth') === 'shift') {
    next.glideMode = next.glideMode === 'off' ? 'mono' : (next.glideMode ?? 'mono');
    next.glideSync = true;
  }
  return next;
}
