export type EightZeroEightWave = 'sine' | 'triangle' | 'square';

export interface EightZeroEightPresetDef {
  label: string;
  sweepStartHz: number;
  sweepMs: number;
  bodyDecaySec: number;
  subLevel: number;
  clickLevel: number;
  mainWave?: EightZeroEightWave;
  drive?: number;
  subMul?: number;
  clickHpHz?: number;
}

export interface EightZeroEightPlayExt {
  holdBeats: number;
  bpm: number;
}

export function merge808BodyAndSub(body: EightZeroEightPresetDef, sub: EightZeroEightPresetDef): EightZeroEightPresetDef {
  return {
    label: `${body.label} + ${sub.label}`,
    sweepStartHz: body.sweepStartHz,
    sweepMs: body.sweepMs,
    bodyDecaySec: Math.max(body.bodyDecaySec, sub.bodyDecaySec * 1.08),
    subLevel: Math.min(1, body.subLevel + sub.subLevel * 0.42),
    clickLevel: body.clickLevel,
    mainWave: body.mainWave ?? sub.mainWave,
    drive: Math.max(body.drive ?? 0, (sub.drive ?? 0) * 0.65),
    subMul: sub.subMul ?? body.subMul ?? 0.5,
    clickHpHz: body.clickHpHz ?? sub.clickHpHz,
  };
}

export const EIGHT_ZERO_EIGHT_PRESETS = {
  classic: { label: 'Classic 808', sweepStartHz: 180, sweepMs: 28, bodyDecaySec: 0.42, subLevel: 0.78, clickLevel: 0.22 },
  punch: { label: 'Punch 808', sweepStartHz: 220, sweepMs: 22, bodyDecaySec: 0.32, subLevel: 0.7, clickLevel: 0.32 },
  trapDoor: { label: 'Trap door', sweepStartHz: 160, sweepMs: 32, bodyDecaySec: 0.38, subLevel: 0.82, clickLevel: 0.18 },
  drillPunch: { label: 'Drill punch', sweepStartHz: 240, sweepMs: 18, bodyDecaySec: 0.28, subLevel: 0.62, clickLevel: 0.38 },
  brick: { label: 'Brick', sweepStartHz: 140, sweepMs: 36, bodyDecaySec: 0.45, subLevel: 0.86, clickLevel: 0.14 },
  westKnock: { label: 'West knock', sweepStartHz: 200, sweepMs: 26, bodyDecaySec: 0.36, subLevel: 0.74, clickLevel: 0.26 },
  clickKick: { label: 'Click kick', sweepStartHz: 260, sweepMs: 16, bodyDecaySec: 0.24, subLevel: 0.55, clickLevel: 0.45 },
  tightCone: { label: 'Tight cone', sweepStartHz: 210, sweepMs: 20, bodyDecaySec: 0.3, subLevel: 0.68, clickLevel: 0.32 },
  lofiThud: { label: 'Lo-fi thud', sweepStartHz: 150, sweepMs: 34, bodyDecaySec: 0.48, subLevel: 0.8, clickLevel: 0.2 },
  clubThump: { label: 'Club thump', sweepStartHz: 190, sweepMs: 24, bodyDecaySec: 0.34, subLevel: 0.72, clickLevel: 0.28 },
  twoStepBump: { label: '2-step bump', sweepStartHz: 175, sweepMs: 30, bodyDecaySec: 0.4, subLevel: 0.76, clickLevel: 0.24 },
  zayBump: { label: 'Zay bump', sweepStartHz: 165, sweepMs: 30, bodyDecaySec: 0.44, subLevel: 0.8, clickLevel: 0.2 },
  miamiSub: { label: 'Miami sub', sweepStartHz: 155, sweepMs: 32, bodyDecaySec: 0.46, subLevel: 0.84, clickLevel: 0.16 },
  hump: { label: 'Hump', sweepStartHz: 185, sweepMs: 26, bodyDecaySec: 0.37, subLevel: 0.73, clickLevel: 0.27 },
  slapBack: { label: 'Slap back', sweepStartHz: 230, sweepMs: 20, bodyDecaySec: 0.3, subLevel: 0.66, clickLevel: 0.34 },
  rubberBand: { label: 'Rubber band', sweepStartHz: 170, sweepMs: 30, bodyDecaySec: 0.42, subLevel: 0.78, clickLevel: 0.22 },
  ghost808: { label: 'Ghost 808', sweepStartHz: 195, sweepMs: 24, bodyDecaySec: 0.35, subLevel: 0.7, clickLevel: 0.3 },
  tapeWarp: { label: 'Tape warp', sweepStartHz: 205, sweepMs: 26, bodyDecaySec: 0.38, subLevel: 0.74, clickLevel: 0.26 },
  tube808: { label: 'Tube 808', sweepStartHz: 188, sweepMs: 25, bodyDecaySec: 0.36, subLevel: 0.72, clickLevel: 0.28 },
  glass808: { label: 'Glass 808', sweepStartHz: 215, sweepMs: 21, bodyDecaySec: 0.31, subLevel: 0.64, clickLevel: 0.36 },
  neonCone: { label: 'Neon cone', sweepStartHz: 225, sweepMs: 19, bodyDecaySec: 0.29, subLevel: 0.6, clickLevel: 0.4 },
  velvet808: { label: 'Velvet 808', sweepStartHz: 178, sweepMs: 28, bodyDecaySec: 0.41, subLevel: 0.77, clickLevel: 0.23 },
  stadium808: { label: 'Stadium 808', sweepStartHz: 200, sweepMs: 23, bodyDecaySec: 0.33, subLevel: 0.69, clickLevel: 0.31 },
  sidechain808: { label: 'Sidechain 808', sweepStartHz: 192, sweepMs: 25, bodyDecaySec: 0.35, subLevel: 0.71, clickLevel: 0.29 },
  distorted808: { label: 'Distorted 808', sweepStartHz: 210, sweepMs: 22, bodyDecaySec: 0.32, subLevel: 0.68, clickLevel: 0.32, drive: 0.35 },
  square808: { label: 'Square 808', sweepStartHz: 205, sweepMs: 23, bodyDecaySec: 0.33, subLevel: 0.7, clickLevel: 0.3, mainWave: 'square' },
  triangle808: { label: 'Triangle 808', sweepStartHz: 198, sweepMs: 24, bodyDecaySec: 0.34, subLevel: 0.72, clickLevel: 0.28, mainWave: 'triangle' },
  sine808: { label: 'Sine 808', sweepStartHz: 190, sweepMs: 26, bodyDecaySec: 0.36, subLevel: 0.75, clickLevel: 0.25, mainWave: 'sine' },
  clicky808: { label: 'Clicky 808', sweepStartHz: 250, sweepMs: 17, bodyDecaySec: 0.26, subLevel: 0.58, clickLevel: 0.42, clickHpHz: 900 },
  subMul808: { label: 'Sub mul 808', sweepStartHz: 175, sweepMs: 28, bodyDecaySec: 0.4, subLevel: 0.8, clickLevel: 0.2, subMul: 0.35 },
} as const satisfies Record<string, EightZeroEightPresetDef>;

export type EightZeroEightPresetId = keyof typeof EIGHT_ZERO_EIGHT_PRESETS;
export const EIGHT_ZERO_EIGHT_PRESET_ORDER = Object.keys(EIGHT_ZERO_EIGHT_PRESETS) as EightZeroEightPresetId[];

export const SUB_808_PRESETS = {
  subVelvet: { label: 'Velvet hold', sweepStartHz: 100, sweepMs: 40, bodyDecaySec: 1.55, subLevel: 0.98, clickLevel: 0.03 },
  subCathedral: { label: 'Cathedral sub', sweepStartHz: 78, sweepMs: 55, bodyDecaySec: 1.72, subLevel: 1, clickLevel: 0.02 },
  subMelt: { label: 'Slow melt', sweepStartHz: 92, sweepMs: 62, bodyDecaySec: 1.45, subLevel: 0.92, clickLevel: 0.04 },
  subTectonic: { label: 'Tectonic roll', sweepStartHz: 68, sweepMs: 72, bodyDecaySec: 1.68, subLevel: 1, clickLevel: 0.02 },
  subHaze: { label: 'Haze tail', sweepStartHz: 125, sweepMs: 44, bodyDecaySec: 1.38, subLevel: 0.88, clickLevel: 0.05 },
  subPool: { label: 'Deep pool', sweepStartHz: 58, sweepMs: 78, bodyDecaySec: 1.82, subLevel: 1, clickLevel: 0.02 },
  subRibbon: { label: 'Ribbon sustain', sweepStartHz: 110, sweepMs: 48, bodyDecaySec: 1.5, subLevel: 0.9, clickLevel: 0.04 },
  subMammoth: { label: 'Mammoth low', sweepStartHz: 52, sweepMs: 80, bodyDecaySec: 1.9, subLevel: 1, clickLevel: 0.02 },
  subGlow: { label: 'Glow sustain', sweepStartHz: 135, sweepMs: 42, bodyDecaySec: 1.28, subLevel: 0.86, clickLevel: 0.05 },
  subDrift: { label: 'Drift tail', sweepStartHz: 88, sweepMs: 58, bodyDecaySec: 1.58, subLevel: 0.95, clickLevel: 0.03 },
  subAbyss: { label: 'Abyss', sweepStartHz: 48, sweepMs: 88, bodyDecaySec: 1.95, subLevel: 1, clickLevel: 0.015 },
  subLoom: { label: 'Loom', sweepStartHz: 102, sweepMs: 50, bodyDecaySec: 1.42, subLevel: 0.93, clickLevel: 0.04 },
  subPlush: { label: 'Plush pillow', sweepStartHz: 115, sweepMs: 46, bodyDecaySec: 1.35, subLevel: 0.9, clickLevel: 0.05 },
  subWool: { label: 'Wool blanket', sweepStartHz: 95, sweepMs: 52, bodyDecaySec: 1.48, subLevel: 0.94, clickLevel: 0.035 },
  subTide: { label: 'Low tide', sweepStartHz: 72, sweepMs: 68, bodyDecaySec: 1.62, subLevel: 0.98, clickLevel: 0.025 },
  subMonolith: { label: 'Monolith', sweepStartHz: 60, sweepMs: 76, bodyDecaySec: 1.78, subLevel: 1, clickLevel: 0.02 },
  subSilk: { label: 'Silk runout', sweepStartHz: 128, sweepMs: 38, bodyDecaySec: 1.22, subLevel: 0.84, clickLevel: 0.055 },
  subGravity: { label: 'Gravity well', sweepStartHz: 82, sweepMs: 60, bodyDecaySec: 1.52, subLevel: 0.96, clickLevel: 0.03 },
  subAfterglow: { label: 'Afterglow', sweepStartHz: 118, sweepMs: 46, bodyDecaySec: 1.4, subLevel: 0.91, clickLevel: 0.04 },
} as const satisfies Record<string, EightZeroEightPresetDef>;

export type EightZeroEightSubPresetId = keyof typeof SUB_808_PRESETS;
export const SUB_808_PRESET_ORDER = Object.keys(SUB_808_PRESETS) as EightZeroEightSubPresetId[];

export const EIGHT_ZERO_EIGHT_BODY_PRESET_ORDER = [
  'classic',
  'punch',
  'trapDoor',
  'drillPunch',
  'brick',
  'westKnock',
  'clickKick',
  'tightCone',
  'lofiThud',
  'clubThump',
  'twoStepBump',
  'zayBump',
  'miamiSub',
  'hump',
  'slapBack',
] as const satisfies readonly EightZeroEightPresetId[];

export type EightZeroEightBodyPresetId = (typeof EIGHT_ZERO_EIGHT_BODY_PRESET_ORDER)[number];

function midiToHz(m: number): number {
  return 440 * 2 ** ((m - 69) / 12);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function softClip(x: number): number {
  const t = Math.abs(x);
  return Math.sign(x) * (t / (1 + t * 0.55));
}

/** Schedules one 808 hit on `ctx` using a preset definition (often merged body + sub). */
export function playEightZeroEight(
  ctx: AudioContext,
  whenSec: number,
  midi: number,
  preset: EightZeroEightPresetDef,
  gain = 0.9,
  ext?: EightZeroEightPlayExt,
): void {
  const t0 = whenSec;
  const hz0 = midiToHz(midi);
  const hz1 = clamp(hz0 * 0.55, 18, 120);
  const hzEnd = clamp(preset.sweepStartHz, 18, 220);

  const subMul = preset.subMul ?? 0.5;
  const hzSub = clamp(hz0 * subMul, 12, 90);

  const sweepDur = clamp(preset.sweepMs / 1000, 0.005, 0.12);
  const bodyDur = clamp(preset.bodyDecaySec, 0.02, 2.5);
  const clickHp = preset.clickHpHz ?? 650;

  const holdSec =
    ext && ext.holdBeats > 0 && ext.bpm > 0 ? Math.max(0, (ext.holdBeats * 60) / ext.bpm) : 0;
  const tailPad = holdSec > 0 ? Math.min(1.35, holdSec * 0.38) : 0;
  const tEnd = t0 + sweepDur + bodyDur + tailPad + 0.02;

  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(gain, t0 + 0.004);
  master.gain.exponentialRampToValueAtTime(0.0001, tEnd);
  master.connect(ctx.destination);

  const bodyOsc = ctx.createOscillator();
  bodyOsc.type = 'sine';
  bodyOsc.frequency.setValueAtTime(hz1, t0);
  bodyOsc.frequency.exponentialRampToValueAtTime(hzEnd, t0 + sweepDur);

  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.0001, t0);
  bodyGain.gain.exponentialRampToValueAtTime(0.85, t0 + 0.003);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t0 + sweepDur + bodyDur);

  bodyOsc.connect(bodyGain);
  bodyGain.connect(master);

  const subOsc = ctx.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(hzSub, t0);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.0001, t0);
  subGain.gain.exponentialRampToValueAtTime(clamp(preset.subLevel, 0, 1), t0 + 0.006);
  const subTail = sweepDur + bodyDur + tailPad * 0.92;
  subGain.gain.exponentialRampToValueAtTime(0.0001, t0 + subTail);
  subOsc.connect(subGain);
  subGain.connect(master);

  const clickBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.02), ctx.sampleRate);
  const cd = clickBuf.getChannelData(0);
  for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * 0.35;
  const click = ctx.createBufferSource();
  click.buffer = clickBuf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = clickHp;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.0001, t0);
  cg.gain.exponentialRampToValueAtTime(clamp(preset.clickLevel, 0, 1) * 0.55, t0 + 0.001);
  cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
  click.connect(hp);
  hp.connect(cg);
  cg.connect(master);

  bodyOsc.start(t0);
  subOsc.start(t0);
  click.start(t0);
  bodyOsc.stop(tEnd + 0.02);
  subOsc.stop(tEnd + 0.02);
  click.stop(t0 + 0.04);

  const driveAmt = preset.drive ?? 0;
  if (driveAmt > 0.01) {
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1025);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = softClip(x * (1 + driveAmt * 2.2));
    }
    shaper.curve = curve;
    const wet = ctx.createGain();
    wet.gain.value = clamp(driveAmt, 0, 1) * 0.55;
    master.disconnect();
    master.connect(shaper);
    shaper.connect(wet);
    wet.connect(ctx.destination);
  }
}
