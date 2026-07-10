/**
 * Geno Ultra ARP preview — Web Audio mono scheduler (lookahead, no setTimeout drift).
 * One lightweight voice at a time; dry strip only (no per-step FX feedback).
 */
import {
  scheduleGenoUltraSynthNote,
  stopGenoUltraArpPreviewVoices,
} from '@/app/lib/studio/genoUltraSynthEngine';
import type { GenoUltraSynthVoiceParams } from '@/app/lib/studio/genoUltraSynthTypes';
import { setGenoUltraArpPreviewRunning } from '@/app/lib/creationStation/creationTransportSync';
import {
  genoUltraArpPitchForGridCol,
  genoUltraArpTotalPatternBeats,
  type GenoUltraArpPitchSpread,
} from '@/app/lib/studio/genoUltraArpChordPitch';
import type { GenoUltraArpHarmonyContext } from '@/app/lib/studio/genoUltraArpHarmony';
import {
  genoArpActiveRowsAtStep,
  genoArpPlaybackCols,
  genoArpPlaybackStepToGridCol,
  genoArpLaneLevelToVelocity,
  genoArpTotalOctShiftForGridCol,
  genoArpGateSecForStep,
  genoArpStepMs,
  genoArpSwingDelayMs,
  genoArpStepMaskIsBlank,
  genoArpStepHitsIsBlank,
} from '@/app/lib/studio/genoUltraArpPattern';
import { resolveArpGateLaneOpen } from '@/app/lib/studio/genoUltraArpAnalogGate';
import { scheduleGenoArpPumperBusGain, applyGenoArpPumperBusFilters } from '@/app/lib/studio/genoUltraArpPumper';
import {
  genoArpPortamentoSec,
  genoArpSlideShouldGlide,
} from '@/app/lib/studio/genoUltraArpPerformance';

/** Modest lookahead — full synth FX per step caused static when queue was too deep. */
const LOOKAHEAD_SEC = 0.45;
const PUMP_MS = 20;
const MAX_REFILL_STEPS = 24;

export type GenoUltraArpPreviewOpts = {
  ctx: AudioContext;
  /** Resolve strip input on each note — survives mixer strip rebuilds. */
  getStripOutput: () => AudioNode;
  getVoice: () => GenoUltraSynthVoiceParams;
  getGrid: () => boolean[][];
  barLength: number;
  rateIdx: number;
  gate: number;
  swing: number;
  bpm: number;
  basePitch: number;
  getBasePitch?: () => number;
  octShift: number;
  getGate?: () => number;
  getSwing?: () => number;
  getBpm?: () => number;
  getOctShift?: () => number;
  loop?: boolean;
  getBarLength?: () => number;
  getRateIdx?: () => number;
  maxCycles?: number;
  getVelAtStep?: (step: number) => number;
  getMod1AtStep?: (step: number) => number;
  getMod2AtStep?: (step: number) => number;
  getMod3AtStep?: (step: number) => number;
  getMod1Dest?: () => import('@/app/lib/studio/genoUltraArpCtrlLanes').GenoArpCtrlDest;
  getMod2Dest?: () => import('@/app/lib/studio/genoUltraArpCtrlLanes').GenoArpCtrlDest;
  getMod3Dest?: () => import('@/app/lib/studio/genoUltraArpCtrlLanes').GenoArpCtrlDest;
  getMod1On?: () => boolean;
  getMod2On?: () => boolean;
  getMod3On?: () => boolean;
  /** Retrologue step operator — false = rest (dark dot). */
  getStepEnabled?: (step: number) => boolean;
  /** True when STEP lane is still factory-blank (all pads off). */
  getStepMaskBlank?: () => boolean;
  /** Per-step hit count 0–4 (how many times the note fires in the step). */
  getStepHits?: (step: number) => number;
  /** True when HITS lane is still factory-blank (all zero). */
  getStepHitsBlank?: () => boolean;
  /** Phrase length in steps (how many dots are in the loop). */
  getPhraseSteps?: () => number;
  getBarOctShifts?: () => readonly number[];
  /** Analog gate FX — drawable GATE lane under CTRL 2. */
  getGateFxOn?: () => boolean;
  getGateLaneAtStep?: (step: number) => number;
  getGateLaneBlank?: () => boolean;
  getGateFxDepth?: () => number;
  getGateFxAttackMs?: () => number;
  getGateFxReleaseMs?: () => number;
  /** Sidechain pumper — quantized duck on arp bus (sequencer tab). */
  getPumperOn?: () => boolean;
  getPumperRate?: () => number;
  getPumperDepth?: () => number;
  getPumperAttackMs?: () => number;
  getPumperReleaseMs?: () => number;
  getPumperHighFilter?: () => number;
  getPumperLowFilter?: () => number;
  /** Footer performance — legato + bar-anchored slide. */
  getArpLegato?: () => boolean;
  getArpSlide?: () => boolean;
  getArpPortamentoMs?: () => number;
  getArpSlideAnchor?: () => import('@/app/lib/studio/genoUltraArpPerformance').GenoArpSlideAnchor;
  getHarmony?: () => GenoUltraArpHarmonyContext;
  getPitchSpread?: () => GenoUltraArpPitchSpread | undefined;
  onStep?: (step: number, pitch: number | null, gateSec: number) => void;
  /** SE2 transport beat — phase-locks ARP loop when SYNC SE2 is on. */
  getTransportPatternBeat?: () => number;
};

export type GenoUltraArpPreviewHandle = {
  stop: () => void;
};

let activeHandle: GenoUltraArpPreviewHandle | null = null;
let arpSessionId = 0;

export function stopGenoUltraArpPreviewLoop(): void {
  activeHandle?.stop();
  activeHandle = null;
  setGenoUltraArpPreviewRunning(false);
}

function monoRowForStep(grid: boolean[][], step: number): number | null {
  const rows = genoArpActiveRowsAtStep(grid, step);
  if (rows.length === 0) return null;
  return rows[0] ?? null;
}

function stepDurationSec(bpm: number, rateIdx: number, stepIndex: number, swing: number): number {
  const stepMs = genoArpStepMs(bpm, rateIdx);
  return (stepMs + genoArpSwingDelayMs(stepMs, swing, stepIndex)) / 1000;
}

function patternDurationSec(bpm: number, rateIdx: number, cols: number, swing: number): number {
  let t = 0;
  for (let i = 0; i < cols; i += 1) {
    t += stepDurationSec(bpm, rateIdx, i, swing);
  }
  return t;
}

function livePlaybackCols(opts: GenoUltraArpPreviewOpts): number {
  const bar = opts.getBarLength?.() ?? opts.barLength;
  const rate = opts.getRateIdx?.() ?? opts.rateIdx;
  return genoArpPlaybackCols(bar, rate);
}

async function resumeCtx(ctx: AudioContext): Promise<void> {
  if (ctx.state === 'closed') return;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* autoplay policy */
    }
  }
}

export function startGenoUltraArpPreviewLoop(opts: GenoUltraArpPreviewOpts): GenoUltraArpPreviewHandle {
  stopGenoUltraArpPreviewLoop();

  arpSessionId += 1;
  const sessionId = arpSessionId;

  const livePhraseCols = () => {
    const full = livePlaybackCols(opts);
    const phrase = opts.getPhraseSteps?.() ?? full;
    return Math.max(1, Math.min(full, Math.round(phrase)));
  };

  let cols = livePhraseCols();
  const loop = opts.loop !== false;
  const maxCycles = opts.maxCycles ?? (loop ? Number.POSITIVE_INFINITY : 1);

  let cancelled = false;
  let pumpTimer: ReturnType<typeof setInterval> | null = null;
  let tailTimer: ReturnType<typeof setTimeout> | null = null;
  let rafId = 0;
  let stepIdx = 0;
  let stepsScheduled = 0;
  let emitSerial = 0;
  let nextWhen = opts.ctx.currentTime + 0.02;
  let lastNoteEndAudio = nextWhen;
  let tailArmed = false;
  const perfAnchor = performance.now();
  const uiStepRef = { current: -1 };
  const emittedKeys = new Set<string>();
  let lastArpMidi: number | null = null;
  let arpBus: GainNode | null = null;
  let arpBusIn: GainNode | null = null;
  let arpHpf: BiquadFilterNode | null = null;
  let arpLpf: BiquadFilterNode | null = null;
  let arpBusDest: AudioNode | null = null;

  const syncArpBusFilters = () => {
    if (!arpHpf || !arpLpf) return;
    applyGenoArpPumperBusFilters(
      arpHpf,
      arpLpf,
      opts.getPumperHighFilter?.() ?? 0,
      opts.getPumperLowFilter?.() ?? 0,
    );
  };

  const wireArpBus = () => {
    if (!arpBus || arpBus.context.state === 'closed') {
      arpBusIn = opts.ctx.createGain();
      arpBusIn.gain.value = 1;
      arpHpf = opts.ctx.createBiquadFilter();
      arpLpf = opts.ctx.createBiquadFilter();
      arpBus = opts.ctx.createGain();
      arpBus.gain.value = 0.88;
      arpBusIn.connect(arpHpf);
      arpHpf.connect(arpLpf);
      arpLpf.connect(arpBus);
      arpBusDest = null;
    }
    syncArpBusFilters();
    if (arpBusDest == null) {
      let dest: AudioNode;
      try {
        dest = opts.getStripOutput();
      } catch {
        dest = opts.ctx.destination;
      }
      try {
        arpBus.connect(dest);
        arpBusDest = dest;
      } catch {
        /* strip not ready — retry on next refill */
      }
    }
  };

  const ensureArpBus = (): AudioNode => {
    wireArpBus();
    syncArpBusFilters();
    return arpBusIn!;
  };

  const liveGate = () => opts.getGate?.() ?? opts.gate;
  const liveSwing = () => opts.getSwing?.() ?? opts.swing;
  const liveBpm = () => opts.getBpm?.() ?? opts.bpm;
  const liveOctShift = () => opts.getOctShift?.() ?? opts.octShift;
  const liveBasePitch = () => opts.getBasePitch?.() ?? opts.basePitch;
  let transportPhaseSeeded = false;

  const seedFromTransportPhase = () => {
    if (transportPhaseSeeded) return;
    transportPhaseSeeded = true;
    const phaseFn = opts.getTransportPatternBeat;
    if (!phaseFn) return;
    const bar = opts.getBarLength?.() ?? opts.barLength;
    const patternBeats = genoUltraArpTotalPatternBeats(bar);
    const wrapped = ((phaseFn() % patternBeats) + patternBeats) % patternBeats;
    const bpm = liveBpm();
    const swing = liveSwing();
    const rate = opts.getRateIdx?.() ?? opts.rateIdx;
    cols = livePhraseCols();
    let accBeats = 0;
    stepIdx = 0;
    while (stepIdx < cols) {
      const stepDur = stepDurationSec(bpm, rate, stepIdx, swing);
      const stepBeats = (stepDur * bpm) / 60;
      if (accBeats + stepBeats > wrapped + 1e-6) {
        const partialBeats = Math.max(0, wrapped - accBeats);
        nextWhen = opts.ctx.currentTime + Math.max(0.008, (partialBeats * 60) / Math.max(40, bpm));
        return;
      }
      accBeats += stepBeats;
      stepIdx += 1;
      if (stepIdx >= cols) stepIdx = 0;
    }
    nextWhen = opts.ctx.currentTime + 0.02;
  };

  const emitKey = (when: number, step: number) =>
    `${Math.round(when * 200000)}:${step}:${Math.floor(emitSerial / Math.max(1, cols))}`;

  const scheduleStep = (playbackStep: number, when: number, stepDurSec: number) => {
    const key = emitKey(when, playbackStep);
    if (emittedKeys.has(key)) return;
    emittedKeys.add(key);
    if (emittedKeys.size > 512) emittedKeys.clear();

    const rate = opts.getRateIdx?.() ?? opts.rateIdx;
    const bar = opts.getBarLength?.() ?? opts.barLength;
    const gridCol = genoArpPlaybackStepToGridCol(playbackStep, bar, rate);

    /**
     * Blank STEP mask (all off) = no programming yet → play every step.
     * Once any pad is armed, dark pads are rests.
     */
    if (opts.getStepEnabled) {
      const maskBlank =
        typeof opts.getStepMaskBlank === 'function'
          ? opts.getStepMaskBlank()
          : false;
      if (!maskBlank && !opts.getStepEnabled(gridCol)) return;
    }

    /**
     * Blank HITS (all 0) = default ×1.
     * Once any hit is set, 0 on a step = rest.
     */
    const hitsRaw = opts.getStepHits?.(gridCol) ?? 0;
    const hitsBlank =
      typeof opts.getStepHitsBlank === 'function' ? opts.getStepHitsBlank() : hitsRaw <= 0;
    const hits = hitsBlank
      ? 1
      : Math.max(0, Math.min(4, Math.round(hitsRaw)));
    if (hits <= 0) return;

    const gateLaneBlank = opts.getGateLaneBlank?.() ?? true;
    const gateRaw = opts.getGateLaneAtStep?.(gridCol) ?? 0;
    const gateFxOn = opts.getGateFxOn?.() ?? false;
    const gateLaneOpen = resolveArpGateLaneOpen(gateFxOn, gridCol, gateLaneBlank, gateRaw);
    const gateRelSec = Math.max(0.003, (opts.getGateFxReleaseMs?.() ?? 52) / 1000);

    let stripOutput: AudioNode;
    try {
      stripOutput = ensureArpBus();
    } catch {
      stripOutput = opts.ctx.destination;
    }

    const voice = opts.getVoice();
    const bpmLive = liveBpm();

    const pumpGateClose = () => {
      scheduleGenoUltraArpMonoGateClose(opts.ctx, {
        when,
        stripOutput,
        voice,
        relSec: gateRelSec,
        bpm: bpmLive,
      });
    };

    if (gateFxOn && gateLaneOpen < 0.02) {
      pumpGateClose();
      return;
    }

    const row = monoRowForStep(opts.getGrid(), gridCol);
    if (row == null) return;

    const totalOct = genoArpTotalOctShiftForGridCol(
      gridCol,
      liveOctShift(),
      opts.getBarOctShifts?.() ?? [],
    );
    const barLen = opts.getBarLength?.() ?? opts.barLength;
    const base = liveBasePitch();
    const harmony = opts.getHarmony?.() ?? {
      keyRoot: base,
      scaleId: 'major' as const,
      chordType: 'maj' as const,
    };
    const pitch = genoUltraArpPitchForGridCol(
      base,
      row,
      totalOct,
      barLen,
      harmony,
      gridCol,
      opts.getPitchSpread?.(),
    );
    const velLevel = opts.getVelAtStep?.(gridCol) ?? 0.82;
    const velocity = genoArpLaneLevelToVelocity(velLevel);
    const mod1 = opts.getMod1AtStep?.(gridCol) ?? 0;
    const mod2 = opts.getMod2AtStep?.(gridCol) ?? 0;
    const mod3 = opts.getMod3AtStep?.(gridCol) ?? 0;

    /** Ratchet: fire `hits` times inside this step (Retrologue “how many times”). */
    const slice = stepDurSec / hits;
    const gateSec = genoArpGateSecForStep(slice, liveGate());

    if (opts.getPumperOn?.() && arpBus) {
      const pumperRate = opts.getPumperRate?.() ?? 2;
      const pumperDepth = opts.getPumperDepth?.() ?? 0.72;
      const pumperAttackMs = opts.getPumperAttackMs?.() ?? 4;
      const pumperReleaseMs = opts.getPumperReleaseMs?.() ?? 120;
      for (let h = 0; h < hits; h += 1) {
        scheduleGenoArpPumperBusGain(
          opts.ctx,
          arpBus,
          when + h * slice,
          gridCol,
          pumperRate,
          pumperDepth,
          pumperAttackMs,
          pumperReleaseMs,
          h,
        );
      }
    }

    for (let h = 0; h < hits; h += 1) {
      const hitWhen = when + h * slice;
      const slideOn = opts.getArpSlide?.() ?? false;
      const glideFrom =
        slideOn &&
        h === 0 &&
        lastArpMidi != null &&
        lastArpMidi !== pitch &&
        genoArpSlideShouldGlide(gridCol, opts.getArpSlideAnchor?.() ?? 'mid')
          ? lastArpMidi
          : null;
      const glideSec =
        glideFrom != null
          ? genoArpPortamentoSec(opts.getArpPortamentoMs?.() ?? 120)
          : 0;
      scheduleGenoUltraSynthNote(opts.ctx, {
        when: hitWhen,
        durationSec: gateSec,
        midi: pitch,
        velocity,
        voice,
        stripOutput,
        bpm: bpmLive,
        arpPreview: true,
        arpStepSec: slice,
        arpMod1: mod1,
        arpMod2: mod2,
        arpMod3: mod3,
        arpMod1Dest: opts.getMod1Dest?.() ?? 'filterCutoff',
        arpMod2Dest: opts.getMod2Dest?.() ?? 'filterRes',
        arpMod3Dest: opts.getMod3Dest?.() ?? 'ampLevel',
        arpMod1On: opts.getMod1On?.() ?? true,
        arpMod2On: opts.getMod2On?.() ?? true,
        arpMod3On: opts.getMod3On?.() ?? false,
        arpGateFxOn: gateFxOn,
        arpGateLaneOpen: gateLaneOpen,
        arpGateFxDepth: opts.getGateFxDepth?.() ?? 0.85,
        arpGateFxAttackMs: opts.getGateFxAttackMs?.() ?? 4,
        arpGateFxReleaseMs: opts.getGateFxReleaseMs?.() ?? 48,
        arpLegato: opts.getArpLegato?.() ?? false,
        arpGlideFromMidi: glideFrom,
        arpGlideSec: glideSec,
      });
      lastNoteEndAudio = hitWhen + gateSec + 0.03;
    }
    lastArpMidi = pitch;
  };

  const endUi = () => {
    opts.onStep?.(-1, null, 0);
  };

  const clearTailTimer = () => {
    if (tailTimer != null) {
      clearTimeout(tailTimer);
      tailTimer = null;
    }
  };

  const stopScheduling = () => {
    if (cancelled) return;
    cancelled = true;
    if (pumpTimer != null) clearInterval(pumpTimer);
    pumpTimer = null;
    clearTailTimer();
    cancelAnimationFrame(rafId);
    if (activeHandle?.stop === stop) activeHandle = null;
  };

  const stop = () => {
    stopScheduling();
    setGenoUltraArpPreviewRunning(false);
    stopGenoUltraArpPreviewVoices();
    lastArpMidi = null;
    for (const node of [arpBusIn, arpHpf, arpLpf, arpBus]) {
      if (!node) continue;
      try {
        node.disconnect();
      } catch {
        /* */
      }
    }
    arpBusIn = null;
    arpHpf = null;
    arpLpf = null;
    arpBus = null;
    arpBusDest = null;
    endUi();
  };

  const armPatternTail = () => {
    if (tailArmed || loop) return;
    tailArmed = true;
    stopScheduling();
    const ctxNow = opts.ctx.currentTime;
    const lastIdx = Math.max(0, cols - 1);
    const lastGate = genoArpGateSecForStep(
      stepDurationSec(liveBpm(), opts.rateIdx, lastIdx, liveSwing()),
      liveGate(),
    );
    const patternEndAudio = nextWhen;
    const endAudio = Math.max(lastNoteEndAudio, patternEndAudio - 0.001 + lastGate + 0.05);
    const msUntilEnd = Math.max(120, (endAudio - ctxNow) * 1000);
    tailTimer = setTimeout(() => {
      if (sessionId !== arpSessionId) return;
      setGenoUltraArpPreviewRunning(false);
      stopGenoUltraArpPreviewVoices();
      endUi();
    }, msUntilEnd);
  };

  const refill = () => {
    if (cancelled || sessionId !== arpSessionId) return;
    wireArpBus();
    void resumeCtx(opts.ctx);
    cols = livePhraseCols();
    const now = opts.ctx.currentTime;
    const schedFloor = now + 0.01;
    const bpm = liveBpm();
    const swing = liveSwing();
    const rate = opts.getRateIdx?.() ?? opts.rateIdx;

    if (nextWhen < schedFloor) {
      let guard = 0;
      while (nextWhen < schedFloor && guard < cols * 4) {
        guard += 1;
        const stepDur = stepDurationSec(bpm, rate, stepIdx, swing);
        nextWhen += stepDur;
        stepIdx += 1;
        if (stepIdx >= cols) {
          stepIdx = 0;
          lastArpMidi = null;
        }
      }
    }

    const horizon = now + LOOKAHEAD_SEC;

    if (loop) {
      let guard = 0;
      while (nextWhen < horizon && guard < MAX_REFILL_STEPS) {
        guard += 1;
        const stepDur = stepDurationSec(bpm, rate, stepIdx, swing);
        scheduleStep(stepIdx, nextWhen, stepDur);
        emitSerial += 1;
        nextWhen += stepDur;
        stepIdx += 1;
        if (stepIdx >= cols) {
          stepIdx = 0;
          lastArpMidi = null;
        }
      }
      return;
    }

    const stepLimit = cols * maxCycles;
    let guard = 0;
    while (nextWhen < horizon && stepsScheduled < stepLimit && guard < MAX_REFILL_STEPS) {
      guard += 1;
      const stepDur = stepDurationSec(bpm, rate, stepIdx, swing);
      scheduleStep(stepIdx, nextWhen, stepDur);
      emitSerial += 1;
      nextWhen += stepDur;
      stepsScheduled += 1;
      stepIdx += 1;
      if (stepIdx >= cols) {
        stepIdx = 0;
        lastArpMidi = null;
      }
    }

    if (stepsScheduled >= stepLimit) {
      armPatternTail();
    }
  };

  const tickUi = () => {
    if (cancelled || sessionId !== arpSessionId) return;
    cols = livePhraseCols();
    const bpm = liveBpm();
    const swing = liveSwing();
    const rate = opts.getRateIdx?.() ?? opts.rateIdx;
    const elapsed = Math.max(0, (performance.now() - perfAnchor) / 1000);
    const patternSec = patternDurationSec(bpm, rate, cols, swing);
    let t = 0;
    let s = 0;
    const maxUiSteps = loop ? cols * 512 : cols * maxCycles;
    for (let i = 0; i < maxUiSteps + 1; i += 1) {
      const idx = s % cols;
      const dur = stepDurationSec(bpm, rate, idx, swing);
      if (t + dur > elapsed) {
        if (uiStepRef.current !== idx) {
          uiStepRef.current = idx;
          const bar = opts.getBarLength?.() ?? opts.barLength;
          const gridCol = genoArpPlaybackStepToGridCol(idx, bar, rate);
          const row = monoRowForStep(opts.getGrid(), gridCol);
          const totalOct = genoArpTotalOctShiftForGridCol(
            gridCol,
            liveOctShift(),
            opts.getBarOctShifts?.() ?? [],
          );
          const barLenUi = opts.getBarLength?.() ?? opts.barLength;
          const baseUi = liveBasePitch();
          const harmonyUi = opts.getHarmony?.() ?? {
            keyRoot: baseUi,
            scaleId: 'major' as const,
            chordType: 'maj' as const,
          };
          const pitch =
            row != null
              ? genoUltraArpPitchForGridCol(
                  baseUi,
                  row,
                  totalOct,
                  barLenUi,
                  harmonyUi,
                  gridCol,
                  opts.getPitchSpread?.(),
                )
              : null;
          const gateSec = genoArpGateSecForStep(dur, liveGate());
          opts.onStep?.(gridCol, pitch, gateSec);
        }
        break;
      }
      t += dur;
      s += 1;
      if (!loop && t >= patternSec * maxCycles) break;
    }
    rafId = requestAnimationFrame(tickUi);
  };

  setGenoUltraArpPreviewRunning(true);
  void resumeCtx(opts.ctx);
  seedFromTransportPhase();
  refill();
  pumpTimer = setInterval(refill, PUMP_MS);
  rafId = requestAnimationFrame(tickUi);

  const handle: GenoUltraArpPreviewHandle = { stop };
  activeHandle = handle;
  return handle;
}
