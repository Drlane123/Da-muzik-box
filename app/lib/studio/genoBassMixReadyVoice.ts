/**
 * Geno Bass — mix-ready voice polish (punchy transient, controlled sub, EQ sculpted).
 * Applied to preset bank + runtime playback so bass sits in a mix with less post work.
 */
import {
  GENO_ULTRA_DEFAULT_OUTPUT_LEVEL,
  type GenoUltraModSlot,
  type GenoUltraSynthVoiceParams,
} from '@/app/lib/studio/genoUltraSynthTypes';

export type GenoBassMixGroup = 'moog' | 'roland' | 'dx' | 'analog' | 'sub' | 'funk';

/** Miami / 80s electro floor bounce — punchy sub + filter snap, not held R&B sub. */
export function genoBassVoiceIsBounceThump(
  voice: GenoUltraSynthVoiceParams,
  bassGroup?: GenoBassMixGroup,
): boolean {
  if (bassGroup === 'funk') return voice.ampSustain < 0.22 || voice.filterDecayMs < 110;
  return (
    voice.subLevel >= 0.68 &&
    voice.filterCutoffHz <= 450 &&
    voice.ampSustain <= 0.28 &&
    voice.ampDecayMs <= 160
  );
}

/** Dance / house / techno bass — wants filter snap + mid presence, not soft pad sustain. */
export function genoBassVoiceIsPunchDance(
  voice: GenoUltraSynthVoiceParams,
  bassGroup?: GenoBassMixGroup,
): boolean {
  if (genoBassVoiceIsBounceThump(voice, bassGroup)) return true;
  if (bassGroup === 'sub') return voice.ampSustain <= 0.55;
  if (bassGroup === 'funk' || bassGroup === 'roland' || bassGroup === 'moog') return true;
  return (
    voice.ampSustain <= 0.52 ||
    voice.filterDecayMs <= 240 ||
    voice.filterDrive >= 0.18
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function cloneVoice(v: GenoUltraSynthVoiceParams): GenoUltraSynthVoiceParams {
  return {
    ...v,
    modSlots: v.modSlots.map((s) => ({ ...s })),
    fx: { ...v.fx },
    osc1: { ...v.osc1 },
    osc2: { ...v.osc2 },
    osc3: { ...v.osc3 },
  };
}

function ensureModSlot(
  slots: GenoUltraModSlot[],
  source: GenoUltraModSlot['source'],
  dest: GenoUltraModSlot['dest'],
  amount: number,
): GenoUltraModSlot[] {
  const next = slots.map((s) => ({ ...s }));
  const idx = next.findIndex((s) => s.source === source && s.dest === dest);
  if (idx >= 0) {
    const cur = next[idx]!;
    next[idx] = { ...cur, amount: Math.max(Math.abs(cur.amount), amount) * Math.sign(cur.amount || 1) };
    return next;
  }
  const free = next.findIndex((s) => s.source === 'off' || Math.abs(s.amount) < 0.02);
  const target = free >= 0 ? free : 1;
  next[target] = { source, dest, amount };
  return next;
}

/**
 * Punchy, mix-ready bass voice — fast filter/amp attack, mud cut, presence boost, dry FX.
 */
export function applyGenoBassMixReadyProfile(
  voice: GenoUltraSynthVoiceParams,
  bassGroup: GenoBassMixGroup = 'analog',
): GenoUltraSynthVoiceParams {
  const v = cloneVoice(voice);
  const isBounce = genoBassVoiceIsBounceThump(v, bassGroup);
  const isPunch = genoBassVoiceIsPunchDance(v, bassGroup);
  const isSub = !isBounce && (bassGroup === 'sub' || v.subLevel >= 0.68 || v.filterCutoffHz < 260);
  const isPluck =
    bassGroup === 'funk' || v.ampSustain < 0.22 || v.filterDecayMs < 110;
  const isAcid = v.filterResonanceQ > 2.15;

  /** Anti-click floors — bounce / dance bass keeps instant attack for floor thump. */
  v.ampAttackMs = isBounce
    ? Math.min(v.ampAttackMs, 2)
    : isPunch && !isSub
      ? Math.min(v.ampAttackMs, 4)
      : isSub
        ? Math.max(v.ampAttackMs, 10)
        : Math.max(v.ampAttackMs, isPluck ? 6 : 8);
  v.ampAttackMs = Math.min(v.ampAttackMs, isBounce ? 2 : isPunch && !isSub ? 5 : isSub ? 26 : 16);

  if (!isAcid) {
    v.filterAttackMs = isBounce
      ? Math.min(v.filterAttackMs, 3)
      : isPunch && !isSub
        ? Math.min(v.filterAttackMs, 5)
        : isSub
          ? Math.max(v.filterAttackMs, 14)
          : Math.max(v.filterAttackMs, isPluck ? 8 : 10);
    v.filterAttackMs = Math.min(v.filterAttackMs, isBounce ? 4 : isPunch && !isSub ? 8 : isSub ? 30 : 20);
    v.filterDecayMs = isBounce
      ? clamp(v.filterDecayMs, 48, 110)
      : isPunch && !isSub
        ? clamp(v.filterDecayMs, 42, 150)
        : isSub
          ? clamp(v.filterDecayMs, 70, 280)
          : clamp(v.filterDecayMs, 40, isPluck ? 130 : 200);
    v.filterSustain = isBounce
      ? clamp(v.filterSustain, 0, 0.14)
      : isPunch && !isSub
        ? clamp(v.filterSustain, 0, 0.24)
        : isSub
          ? clamp(v.filterSustain, 0.08, 0.42)
          : clamp(v.filterSustain, 0, 0.32);
    v.modSlots = ensureModSlot(
      v.modSlots,
      'filterEnv',
      'filterCutoff',
      isBounce ? 0.82 : isPunch && !isSub ? 0.76 : isSub ? 0.48 : isPluck ? 0.72 : 0.62,
    );
  }
  v.modSlots = ensureModSlot(
    v.modSlots,
    'velocity',
    'filterCutoff',
    isBounce ? 0.26 : isPunch && !isSub ? 0.24 : isSub ? 0.12 : 0.18,
  );
  if (isBounce || (isPunch && !isSub)) {
    v.modSlots = ensureModSlot(v.modSlots, 'velocity', 'ampLevel', isBounce ? 0.58 : 0.48);
  }

  if (isBounce) {
    v.subLevel = clamp(v.subLevel * 1.04, 0.72, 0.92);
    v.osc1 = { ...v.osc1, level: clamp(v.osc1.level, 0.72, 0.92) };
    if (v.osc2.level > 0.08) {
      v.osc2 = { ...v.osc2, level: clamp(v.osc2.level, 0.18, 0.38) };
    }
  } else if (!isSub) {
    v.osc1 = { ...v.osc1, level: clamp(v.osc1.level * 1.08, 0.52, 0.96) };
    if (v.osc2.level > 0.12) {
      v.osc2 = { ...v.osc2, level: clamp(v.osc2.level * 0.9, 0.08, 0.52) };
    }
    v.subLevel = clamp(v.subLevel, 0.3, 0.58);
  } else {
    v.subLevel = clamp(v.subLevel * 1.02, 0.58, 0.9);
    v.osc1 = { ...v.osc1, level: clamp(v.osc1.level, 0.78, 0.96) };
  }

  v.filterDrive = clamp(
    v.filterDrive + (isBounce ? 0.18 : isPunch && !isSub ? 0.16 : isSub ? 0.12 : 0.1),
    0,
    0.72,
  );
  if (!isAcid) {
    v.filterCutoffHz = isBounce
      ? clamp(v.filterCutoffHz, 200, 380)
      : isSub
        ? clamp(v.filterCutoffHz, 160, 340)
        : isPunch
          ? clamp(v.filterCutoffHz * 1.06, 380, isPluck ? 1500 : 1100)
          : clamp(v.filterCutoffHz * 1.1, 420, isPluck ? 1400 : 980);
  }
  v.filterKeyTrack = clamp(Math.max(v.filterKeyTrack, isPunch ? 0.5 : 0.44), 0.28, 0.82);
  v.filterResonanceQ = isSub
    ? clamp(v.filterResonanceQ, 0.3, 1.1)
    : isPunch
      ? clamp(v.filterResonanceQ, 0.95, 2.35)
      : clamp(v.filterResonanceQ, 0.85, 2.1);

  if (isBounce) {
    v.ampDecayMs = clamp(v.ampDecayMs, 82, 125);
    v.ampSustain = clamp(v.ampSustain, 0.03, 0.12);
    v.ampReleaseMs = clamp(v.ampReleaseMs, 60, 105);
  } else if (isPunch && !isSub) {
    v.ampDecayMs = clamp(v.ampDecayMs, 95, 220);
    v.ampSustain = clamp(v.ampSustain * 0.82, 0.08, 0.42);
    v.ampReleaseMs = clamp(v.ampReleaseMs, 70, 180);
  } else if (!isSub && v.ampSustain > 0.62) {
    v.ampSustain = clamp(v.ampSustain * 0.86, 0.38, 0.68);
  }
  if (!isBounce && !isSub && v.ampDecayMs > 380) {
    v.ampDecayMs = clamp(v.ampDecayMs * 0.8, 160, 420);
  }
  v.ampReleaseMs = isBounce
    ? clamp(v.ampReleaseMs, 65, 110)
    : isSub
      ? clamp(v.ampReleaseMs, 120, 380)
      : clamp(v.ampReleaseMs, 80, 280);

  const fx = v.fx;
  const eqLowBoost = isBounce ? 3.2 : isSub ? 2.2 : isPunch ? 2.8 : 1.6;
  const eqLoMidCut = isPunch ? -4.2 : -3.2;
  const eqHiMidBoost = isSub ? 2.2 : isPunch ? 3.6 : 2.6;
  v.fx = {
    ...fx,
    eqEnabled: true,
    eqLowDb: clamp((fx.eqLowDb ?? 0) + eqLowBoost, 0, 7.5),
    eqLoMidDb: clamp((fx.eqLoMidDb ?? 0) + eqLoMidCut, -9, 1),
    eqHiMidDb: clamp((fx.eqHiMidDb ?? 0) + eqHiMidBoost, -0.5, 7),
    eqHighDb: clamp((fx.eqHighDb ?? 0) - (isSub ? 2.4 : isPunch ? 1.2 : 1.6), -6, 1.5),
    eqLoMidHz: fx.eqLoMidHz ?? 380,
    eqHiMidHz: fx.eqHiMidHz ?? (isPunch ? 2200 : 2400),
    reverbMix: clamp((fx.reverbMix ?? 0) * 0.08, 0, 0.06),
    delayMix: clamp((fx.delayMix ?? 0) * 0.12, 0, isSub ? 0.05 : 0.1),
    chorusMix: clamp((fx.chorusMix ?? 0) * 0.15, 0, 0.08),
  };

  v.outputLevel = clamp(v.outputLevel ?? GENO_ULTRA_DEFAULT_OUTPUT_LEVEL, 0.56, 0.66);
  v.unisonVoices = Math.min(v.unisonVoices, isSub ? 1 : 2);
  if (v.unisonVoices > 1) {
    v.unisonDetuneCents = clamp(v.unisonDetuneCents, 4, 9);
  }

  return v;
}

/** Runtime voice for panel preview + loop audition (matches transport punch). */
export function genoBassAudiblePreviewVoice(
  voice: GenoUltraSynthVoiceParams,
  bassGroup?: GenoBassMixGroup,
): GenoUltraSynthVoiceParams {
  return genoBassGroovePreviewVoice(voice, bassGroup);
}

/**
 * Groove pattern preview — instant amp attack, low sustain, tight decay (staccato bounce).
 */
export function genoBassGroovePreviewVoice(
  voice: GenoUltraSynthVoiceParams,
  bassGroup?: GenoBassMixGroup,
): GenoUltraSynthVoiceParams {
  const group = bassGroup ?? inferGenoBassMixGroup(voice);
  const v = applyGenoBassMixReadyProfile(voice, group);
  const isSub = group === 'sub' || v.subLevel >= 0.68 || v.filterCutoffHz < 260;

  v.ampAttackMs = isSub ? 3 : 0;
  v.ampDecayMs = isSub ? clamp(v.ampDecayMs * 0.75, 100, 240) : clamp(v.ampDecayMs * 0.48, 48, 130);
  v.ampSustain = isSub ? clamp(v.ampSustain * 0.4, 0.06, 0.22) : clamp(v.ampSustain * 0.28, 0, 0.14);
  v.ampReleaseMs = isSub ? clamp(v.ampReleaseMs, 90, 200) : clamp(v.ampReleaseMs, 55, 120);
  v.filterAttackMs = isSub ? clamp(v.filterAttackMs, 4, 18) : clamp(v.filterAttackMs, 0, 10);
  v.filterDecayMs = isSub ? clamp(v.filterDecayMs, 60, 180) : clamp(v.filterDecayMs, 35, 110);
  v.filterSustain = clamp(v.filterSustain, 0, isSub ? 0.28 : 0.16);
  v.modSlots = ensureModSlot(v.modSlots, 'velocity', 'ampLevel', isSub ? 0.42 : 0.55);
  v.modSlots = ensureModSlot(v.modSlots, 'velocity', 'filterCutoff', isSub ? 0.14 : 0.22);

  return v;
}

/**
 * Keyboard / deck preview — mono ARP voice (no per-note Oscillator.start clicks).
 * EQ and wet FX off; HP on the ARP bus removes sub thump.
 */
export function genoBassKeyboardPreviewVoice(
  voice: GenoUltraSynthVoiceParams,
  bassGroup?: GenoBassMixGroup,
): GenoUltraSynthVoiceParams {
  const v = applyGenoBassMixReadyProfile(voice, bassGroup ?? inferGenoBassMixGroup(voice));
  return {
    ...v,
    category: 'bass',
    ampAttackMs: Math.max(v.ampAttackMs, 24),
    ampReleaseMs: Math.min(v.ampReleaseMs, 200),
    filterAttackMs: Math.max(v.filterAttackMs, 24),
    subLevel: v.subLevel * 0.62,
    noiseLevel: 0,
    fx: {
      ...v.fx,
      eqEnabled: false,
      chorusMix: 0,
      delayMix: 0,
      reverbMix: 0,
    },
  };
}

/** SE2 transport + keyboard — bounce grooves match loop-preview punch. */
export function genoBassPlaybackVoice(
  voice: GenoUltraSynthVoiceParams,
  bassGroup?: GenoBassMixGroup,
): GenoUltraSynthVoiceParams {
  const group = bassGroup ?? inferGenoBassMixGroup(voice);
  if (genoBassVoiceIsPunchDance(voice, group)) {
    return genoBassGroovePreviewVoice(voice, group);
  }
  return applyGenoBassMixReadyProfile(voice, group);
}

function inferGenoBassMixGroup(voice: GenoUltraSynthVoiceParams): GenoBassMixGroup {
  if (genoBassVoiceIsBounceThump(voice)) return 'sub';
  if (voice.subLevel >= 0.68 || voice.filterCutoffHz < 260) return 'sub';
  if (voice.ampSustain < 0.25 || voice.filterDecayMs < 110) return 'funk';
  return 'analog';
}
