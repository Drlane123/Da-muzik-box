import { getSharedAudioOutput } from '@/app/lib/creationStation/sharedAudioOutput';
import {
  analyseMasteringBayMeters,
  createMeterAnalysisBuffers,
  createMeterHoldState,
  dbToLin,
  type MasteringBayAnalyserTaps,
  type MeterAnalysisBuffers,
  type MeterHoldState,
} from '@/app/lib/masteringBay/masteringBayMeterAnalysis';
import {
  idleMultiMeterSnap,
  idleNugenMeterSnap,
  type MultiMeterSnap,
  type NugenMeterSnap,
} from '@/app/lib/masteringBay/masteringBayMeterIdle';
import {
  X1_LOUD_BOOST_DB,
  type MasteringBayRackState,
  type X1LoudBoost,
} from '@/app/lib/masteringBay/masteringBayPresets';
import {
  buildPlaybackSchedule,
  clampSourceGainDb,
  clipTimelineStructureChanged,
  MIN_FADE_SEC,
  resolveTimelineSourceGainDb,
  type MasteringBayPlaybackSegment,
  type MasteringBayTimelineClip,
} from '@/app/lib/masteringBay/masteringBayClipEdit';

type MbSourceNode = AudioBufferSourceNode & {
  _mbMerger?: ChannelMergerNode;
  _mbFadeGain?: GainNode;
};

/** Unity into the rack — meters read the real source level. */
const BASE_INPUT_GAIN = 1;
/** When FAST Master is on, pre-limiter gain is at least this many dB above unity. */
const MIN_MASTER_BOOST_DB = 2;

type GraphNodes = {
  /** All clip voices sum here before pre-rack trim. */
  sourceMixBus: GainNode;
  /** Pre-rack clip input gain (Studio One event gain) — drives input meters. */
  sourceClipGain: GainNode;
  inputGain: GainNode;
  inputSplitter: ChannelSplitterNode;
  inputAnalyserL: AnalyserNode;
  inputAnalyserR: AnalyserNode;
  lowShelf: BiquadFilterNode;
  midGain: GainNode;
  stereoPanner: StereoPannerNode;
  /** De-Noise stage before Master X1 (transparent when inactive). */
  deHissShelfBefore: BiquadFilterNode;
  deHissAirBefore: BiquadFilterNode;
  deClickCompBefore: DynamicsCompressorNode;
  deClickMakeupBefore: GainNode;
  compressor: DynamicsCompressorNode;
  /** Restores level lost to compression so the chain never sits quieter than input. */
  makeupGain: GainNode;
  highShelf: BiquadFilterNode;
  /** Drive into the true-peak limiter (always ≥ makeup-compensated boost when master on). */
  outputGain: GainNode;
  preLimiterSplitter: ChannelSplitterNode;
  preLimiterAnalyserL: AnalyserNode;
  preLimiterAnalyserR: AnalyserNode;
  peakLimiter: DynamicsCompressorNode;
  /** De-Noise stage after Master X1 (transparent when inactive). */
  deHissShelfAfter: BiquadFilterNode;
  deHissAirAfter: BiquadFilterNode;
  deClickCompAfter: DynamicsCompressorNode;
  deClickMakeupAfter: GainNode;
  /** All rack modules feed here — final master tap before hardware. */
  masterMeterBus: GainNode;
  masterSplitter: ChannelSplitterNode;
  masterAnalyserL: AnalyserNode;
  masterAnalyserR: AnalyserNode;
  spectrumAnalyser: AnalyserNode;
  /** Keeps dead-end analyser branches in an active graph (gain = 0). */
  meterKeepAlive: GainNode;
  sourceMonoMerger: ChannelMergerNode | null;
};

const METER_FFT_SIZE = 2048;

function configureTimeDomainAnalyser(a: AnalyserNode) {
  a.fftSize = METER_FFT_SIZE;
  a.smoothingTimeConstant = 0;
  a.minDecibels = -100;
  a.maxDecibels = 0;
}

function configureSpectrumAnalyser(a: AnalyserNode) {
  a.fftSize = 8192;
  a.smoothingTimeConstant = 0.35;
  /** Full digital range — display mapping clamps to SPECTRUM_DB_FLOOR…CEIL. */
  a.minDecibels = -96;
  a.maxDecibels = 0;
}

/** Route analyser → silent bus so the tap stays live in every browser. */
function keepAnalyserAlive(analyser: AnalyserNode, keepAlive: GainNode) {
  analyser.connect(keepAlive);
}

export type MasteringBayEngine = {
  setRackState: (state: MasteringBayRackState) => void;
  setSourceBuffer: (buffer: AudioBuffer | null) => void;
  setClipTimeline: (clips: MasteringBayTimelineClip[], activeClipId?: string | null) => void;
  play: (timelineOffsetSec: number) => void;
  stop: () => number;
  seek: (timelineOffsetSec: number) => void;
  isPlaying: () => boolean;
  getPlayheadSec: () => number;
  getTimelineDurationSec: () => number;
  tickMeters: (dtMs: number) => void;
  resetMeters: () => void;
  getMultiSnap: () => MultiMeterSnap;
  getNugenSnap: () => NugenMeterSnap;
  getAudioContext: () => AudioContext;
  dispose: () => void;
};

export function createMasteringBayEngine(ctx: AudioContext): MasteringBayEngine {
  let sourceBuffer: AudioBuffer | null = null;
  let clipTimeline: MasteringBayTimelineClip[] = [];
  let playbackSchedule: MasteringBayPlaybackSegment[] = [];
  let timelineDurationSec = 0;
  const activeSources: AudioBufferSourceNode[] = [];
  let playbackOffsetSec = 0;
  let playbackStartSec = 0;
  let nodes: GraphNodes | null = null;
  let taps: MasteringBayAnalyserTaps | null = null;
  const hold: MeterHoldState = createMeterHoldState();
  let meterBufs: MeterAnalysisBuffers | null = null;
  let multiSnap: MultiMeterSnap = idleMultiMeterSnap();
  let nugenSnap: NugenMeterSnap = idleNugenMeterSnap();

  const buildGraph = () => {
    const sourceMixBus = ctx.createGain();
    const sourceClipGain = ctx.createGain();
    const inputGain = ctx.createGain();
    const inputSplitter = ctx.createChannelSplitter(2);
    const inputAnalyserL = ctx.createAnalyser();
    const inputAnalyserR = ctx.createAnalyser();
    const lowShelf = ctx.createBiquadFilter();
    const midGain = ctx.createGain();
    const stereoPanner = ctx.createStereoPanner();
    const deHissShelfBefore = ctx.createBiquadFilter();
    const deHissAirBefore = ctx.createBiquadFilter();
    const deClickCompBefore = ctx.createDynamicsCompressor();
    const deClickMakeupBefore = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    const makeupGain = ctx.createGain();
    const highShelf = ctx.createBiquadFilter();
    const outputGain = ctx.createGain();
    const preLimiterSplitter = ctx.createChannelSplitter(2);
    const preLimiterAnalyserL = ctx.createAnalyser();
    const preLimiterAnalyserR = ctx.createAnalyser();
    const peakLimiter = ctx.createDynamicsCompressor();
    const deHissShelfAfter = ctx.createBiquadFilter();
    const deHissAirAfter = ctx.createBiquadFilter();
    const deClickCompAfter = ctx.createDynamicsCompressor();
    const deClickMakeupAfter = ctx.createGain();
    const masterMeterBus = ctx.createGain();
    const masterSplitter = ctx.createChannelSplitter(2);
    const masterAnalyserL = ctx.createAnalyser();
    const masterAnalyserR = ctx.createAnalyser();
    const spectrumAnalyser = ctx.createAnalyser();
    const meterKeepAlive = ctx.createGain();

    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 120;
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 8000;

    const initDeNoiseStage = (
      shelf: BiquadFilterNode,
      air: BiquadFilterNode,
      click: DynamicsCompressorNode,
      makeup: GainNode,
    ) => {
      shelf.type = 'highshelf';
      shelf.frequency.value = 9000;
      shelf.gain.value = 0;
      air.type = 'lowpass';
      air.frequency.value = 18000;
      air.Q.value = 0.7;
      click.threshold.value = 0;
      click.knee.value = 0;
      click.ratio.value = 1;
      click.attack.value = 0.001;
      click.release.value = 0.04;
      makeup.gain.value = 1;
    };
    initDeNoiseStage(deHissShelfBefore, deHissAirBefore, deClickCompBefore, deClickMakeupBefore);
    initDeNoiseStage(deHissShelfAfter, deHissAirAfter, deClickCompAfter, deClickMakeupAfter);

    configureTimeDomainAnalyser(inputAnalyserL);
    configureTimeDomainAnalyser(inputAnalyserR);
    configureTimeDomainAnalyser(preLimiterAnalyserL);
    configureTimeDomainAnalyser(preLimiterAnalyserR);
    configureTimeDomainAnalyser(masterAnalyserL);
    configureTimeDomainAnalyser(masterAnalyserR);
    configureSpectrumAnalyser(spectrumAnalyser);

    // Brickwall-style peak limiter (sample-peak; meters report true-peak dBTP).
    peakLimiter.knee.value = 0;
    peakLimiter.attack.value = 0.001;
    peakLimiter.release.value = 0.05;
    peakLimiter.ratio.value = 20;
    peakLimiter.threshold.value = -1;
    masterMeterBus.gain.value = 1;
    makeupGain.gain.value = 1;
    meterKeepAlive.gain.value = 0;
    sourceMixBus.gain.value = 1;
    sourceClipGain.gain.value = 1;

    // ── Source mix → clip trim → input tap + rack ──
    sourceMixBus.connect(sourceClipGain);
    sourceClipGain.connect(inputGain);

    // ── Input tap (dry, pre-rack) ──
    inputGain.connect(inputSplitter);
    inputSplitter.connect(inputAnalyserL, 0);
    inputSplitter.connect(inputAnalyserR, 1);
    keepAnalyserAlive(inputAnalyserL, meterKeepAlive);
    keepAnalyserAlive(inputAnalyserR, meterKeepAlive);

    // ── Chain: Bass X → DMB Match → [De-Noise before?] → Master X1 → [De-Noise after?] ──
    // Both De-Noise stages stay in-graph; inactive stage is transparent.
    inputGain.connect(lowShelf);
    lowShelf.connect(midGain);
    midGain.connect(stereoPanner);
    stereoPanner.connect(deHissShelfBefore);
    deHissShelfBefore.connect(deHissAirBefore);
    deHissAirBefore.connect(deClickCompBefore);
    deClickCompBefore.connect(deClickMakeupBefore);
    deClickMakeupBefore.connect(compressor);
    compressor.connect(makeupGain);
    makeupGain.connect(highShelf);
    highShelf.connect(outputGain);

    // ── Pre-limiter tap (GR reference) ──
    outputGain.connect(preLimiterSplitter);
    preLimiterSplitter.connect(preLimiterAnalyserL, 0);
    preLimiterSplitter.connect(preLimiterAnalyserR, 1);
    keepAnalyserAlive(preLimiterAnalyserL, meterKeepAlive);
    keepAnalyserAlive(preLimiterAnalyserR, meterKeepAlive);
    outputGain.connect(peakLimiter);

    peakLimiter.connect(deHissShelfAfter);
    deHissShelfAfter.connect(deHissAirAfter);
    deHissAirAfter.connect(deClickCompAfter);
    deClickCompAfter.connect(deClickMakeupAfter);

    // ── Master meter bus → analysers → hardware ──
    deClickMakeupAfter.connect(masterMeterBus);
    masterMeterBus.connect(masterSplitter);
    masterSplitter.connect(masterAnalyserL, 0);
    masterSplitter.connect(masterAnalyserR, 1);
    keepAnalyserAlive(masterAnalyserL, meterKeepAlive);
    keepAnalyserAlive(masterAnalyserR, meterKeepAlive);
    masterMeterBus.connect(spectrumAnalyser);
    spectrumAnalyser.connect(getSharedAudioOutput(ctx));
    meterKeepAlive.connect(getSharedAudioOutput(ctx));

    nodes = {
      sourceMixBus,
      sourceClipGain,
      inputGain,
      inputSplitter,
      inputAnalyserL,
      inputAnalyserR,
      lowShelf,
      midGain,
      stereoPanner,
      deHissShelfBefore,
      deHissAirBefore,
      deClickCompBefore,
      deClickMakeupBefore,
      compressor,
      makeupGain,
      highShelf,
      outputGain,
      preLimiterSplitter,
      preLimiterAnalyserL,
      preLimiterAnalyserR,
      peakLimiter,
      deHissShelfAfter,
      deHissAirAfter,
      deClickCompAfter,
      deClickMakeupAfter,
      masterMeterBus,
      masterSplitter,
      masterAnalyserL,
      masterAnalyserR,
      spectrumAnalyser,
      meterKeepAlive,
      sourceMonoMerger: null,
    };
    taps = {
      inputL: inputAnalyserL,
      inputR: inputAnalyserR,
      preLimiterL: preLimiterAnalyserL,
      preLimiterR: preLimiterAnalyserR,
      masterL: masterAnalyserL,
      masterR: masterAnalyserR,
      spectrum: spectrumAnalyser,
    };
    meterBufs = createMeterAnalysisBuffers(METER_FFT_SIZE, spectrumAnalyser.frequencyBinCount);
    inputGain.gain.value = BASE_INPUT_GAIN;
  };

  const applyTimelineSourceGain = (gainDb: number) => {
    if (!nodes) return;
    const lin = dbToLin(clampSourceGainDb(gainDb));
    const now = ctx.currentTime;
    nodes.sourceClipGain.gain.cancelScheduledValues(now);
    nodes.sourceClipGain.gain.setValueAtTime(lin, now);
  };

  const connectSourceWithFade = (
    src: AudioBufferSourceNode,
    buffer: AudioBuffer,
    when: number,
    bufferOffset: number,
    remainDur: number,
    fadeInSec: number,
    fadeOutSec: number,
    playedIntoSeg: number,
  ) => {
    if (!nodes) return;
    const fadeGain = ctx.createGain();
    const tagged = src as MbSourceNode;
    if (buffer.numberOfChannels === 1) {
      const monoMerger = ctx.createChannelMerger(2);
      src.connect(monoMerger, 0, 0);
      src.connect(monoMerger, 0, 1);
      monoMerger.connect(fadeGain);
      tagged._mbMerger = monoMerger;
    } else {
      src.connect(fadeGain);
    }
    fadeGain.connect(nodes.sourceMixBus);

    const fadeInRem = Math.max(0, fadeInSec - playedIntoSeg);
    fadeGain.gain.cancelScheduledValues(when);
    if (fadeInRem > MIN_FADE_SEC && remainDur > MIN_FADE_SEC) {
      fadeGain.gain.setValueAtTime(0, when);
      fadeGain.gain.linearRampToValueAtTime(1, when + Math.min(fadeInRem, remainDur));
    } else {
      fadeGain.gain.setValueAtTime(1, when);
    }

    if (fadeOutSec > MIN_FADE_SEC && remainDur > MIN_FADE_SEC) {
      const outLead = Math.min(fadeOutSec, remainDur);
      const outStart = when + Math.max(0, remainDur - outLead);
      fadeGain.gain.setValueAtTime(1, outStart);
      fadeGain.gain.linearRampToValueAtTime(0, when + remainDur);
    }

    src.start(when, bufferOffset, remainDur);
    tagged._mbFadeGain = fadeGain;
  };

  const disconnectSource = (src: AudioBufferSourceNode) => {
    try {
      src.stop();
    } catch {
      /* already stopped */
    }
    const tagged = src as MbSourceNode;
    const merger = tagged._mbMerger;
    const fadeGain = tagged._mbFadeGain;
    src.disconnect();
    merger?.disconnect();
    fadeGain?.disconnect();
  };

  const stopAllSources = () => {
    for (const src of activeSources) disconnectSource(src);
    activeSources.length = 0;
    if (nodes?.sourceMonoMerger) {
      nodes.sourceMonoMerger.disconnect();
      nodes.sourceMonoMerger = null;
    }
  };

  const rebuildSchedule = () => {
    playbackSchedule = clipTimeline.length > 0 ? buildPlaybackSchedule(clipTimeline) : [];
    timelineDurationSec =
      playbackSchedule.length > 0
        ? playbackSchedule[playbackSchedule.length - 1]!.timelineEndSec
        : sourceBuffer?.duration ?? 0;
  };

  const schedulePlaybackFrom = (timelineSec: number) => {
    if (!nodes || playbackSchedule.length === 0) return;
    stopAllSources();

    const t0 = Math.max(0, Math.min(timelineDurationSec, timelineSec));
    playbackOffsetSec = t0;
    playbackStartSec = ctx.currentTime;

    const now = ctx.currentTime;
    const scheduled: { src: AudioBufferSourceNode; endAt: number }[] = [];

    for (const seg of playbackSchedule) {
      if (seg.timelineEndSec <= t0 + 0.0001) continue;

      let bufferOffset = seg.bufferOffsetSec;
      let when = now;

      if (t0 >= seg.timelineStartSec && t0 < seg.timelineEndSec - 0.0001) {
        bufferOffset += t0 - seg.timelineStartSec;
        when = now;
      } else if (t0 < seg.timelineStartSec) {
        when = now + (seg.timelineStartSec - t0);
      } else {
        continue;
      }

      const played = bufferOffset - seg.bufferOffsetSec;
      const remainDur = seg.durationSec - played;
      if (remainDur <= 0.001) continue;

      const src = ctx.createBufferSource();
      src.buffer = seg.buffer;
      connectSourceWithFade(
        src,
        seg.buffer,
        when,
        bufferOffset,
        remainDur,
        seg.fadeInSec,
        seg.fadeOutSec,
        played,
      );
      activeSources.push(src);
      scheduled.push({ src, endAt: when + remainDur });
    }

    if (scheduled.length === 0) return;
    const last = scheduled[scheduled.length - 1]!;
    last.src.onended = () => {
      if (activeSources.includes(last.src)) {
        stopAllSources();
        playbackOffsetSec = timelineDurationSec;
      }
    };
  };

  const applyRackState = (state: MasteringBayRackState) => {
    if (!nodes) return;
    const { bassOne, daMatch, fastMaster } = state;
    const deNoise = state.deNoise;
    const bassOn = bassOne.power && !bassOne.bypass;
    const matchOn = daMatch.power;
    const masterOn = fastMaster.power;
    const deNoiseOn = !!deNoise?.power;

    nodes.inputGain.gain.value = BASE_INPUT_GAIN;
    nodes.lowShelf.gain.value = bassOn ? (bassOne.push - 5) * 1.4 : 0;
    nodes.lowShelf.frequency.value = 30 + bassOne.loCut * 2.2;
    // Match never attenuates the bus — amount only adds presence.
    nodes.midGain.gain.value = matchOn ? 1 + daMatch.matchAmount / 200 : 1;
    nodes.highShelf.gain.value = matchOn ? (daMatch.tone - 50) / 8 : 0;
    nodes.stereoPanner.pan.value = matchOn ? ((daMatch.width - 50) / 50) * 0.45 : 0;

    // ── De-Noise: only one placement is active; the other stays transparent ──
    const placement = deNoise?.placement === 'before' ? 'before' : 'after';
    const applyDeNoiseStage = (
      active: boolean,
      shelf: BiquadFilterNode,
      air: BiquadFilterNode,
      click: DynamicsCompressorNode,
      makeup: GainNode,
    ) => {
      if (!active || !deNoise) {
        shelf.gain.value = 0;
        air.frequency.value = 18000;
        click.threshold.value = 0;
        click.ratio.value = 1;
        click.knee.value = 0;
        makeup.gain.value = 1;
        return;
      }
      const hissAmt = Math.max(0, Math.min(100, deNoise.hissAmount ?? 0)) / 100;
      const clickAmt = Math.max(0, Math.min(100, deNoise.clickAmount ?? 0)) / 100;
      const hissFreq = Math.max(4000, Math.min(14000, deNoise.hissFreq ?? 9000));
      const clickThresh = Math.max(-30, Math.min(-6, deNoise.clickThresh ?? -18));

      shelf.frequency.value = hissFreq;
      shelf.gain.value = -hissAmt * 14;
      air.frequency.value = 18000 - hissAmt * 7000;

      if (clickAmt > 0.02) {
        click.threshold.value = clickThresh + (1 - clickAmt) * 8;
        click.ratio.value = 2 + clickAmt * 10;
        click.knee.value = 4;
        click.attack.value = 0.0008;
        click.release.value = 0.03 + (1 - clickAmt) * 0.05;
        makeup.gain.value = dbToLin(clickAmt * 1.2);
      } else {
        click.threshold.value = 0;
        click.ratio.value = 1;
        click.knee.value = 0;
        makeup.gain.value = 1;
      }
    };

    applyDeNoiseStage(
      deNoiseOn && placement === 'before',
      nodes.deHissShelfBefore,
      nodes.deHissAirBefore,
      nodes.deClickCompBefore,
      nodes.deClickMakeupBefore,
    );
    applyDeNoiseStage(
      deNoiseOn && placement === 'after',
      nodes.deHissShelfAfter,
      nodes.deHissAirAfter,
      nodes.deClickCompAfter,
      nodes.deClickMakeupAfter,
    );

    if (masterOn) {
      const thr = fastMaster.params.threshold ?? -12;
      const ratio = 2 + (fastMaster.params.amount ?? 30) / 12;
      nodes.compressor.threshold.value = thr;
      nodes.compressor.ratio.value = ratio;
      nodes.compressor.knee.value = 10;
      nodes.compressor.attack.value = 0.003;
      nodes.compressor.release.value = Math.max(0.04, (fastMaster.params.release ?? 130) / 1000);

      // Makeup restores compressor GR so average level is not quieter than input.
      const makeupDb = Math.max(0, -thr * (1 - 1 / Math.max(1.01, ratio)) * 0.55);
      nodes.makeupGain.gain.value = dbToLin(makeupDb);

      // Ceiling stays at the user’s setting (never above −0.1) so X1 loudness
      // notches only drive into the limiter — peaks peek at the top, no red bleed.
      const ceiling = Math.min(-0.1, fastMaster.params.ceiling ?? -1);
      nodes.peakLimiter.threshold.value = ceiling;
      nodes.peakLimiter.ratio.value = 20;
      nodes.peakLimiter.knee.value = 0;
      nodes.peakLimiter.attack.value = 0.001;
      nodes.peakLimiter.release.value = Math.max(0.05, (fastMaster.params.release ?? 130) / 1000);

      const eqLow = fastMaster.params.low ?? 0;
      const eqHigh = fastMaster.params.high ?? 0;
      const eqMid = fastMaster.params.mid ?? 0;
      nodes.lowShelf.gain.value += eqLow * 0.9;
      nodes.highShelf.gain.value += eqHigh * 0.9;
      nodes.midGain.gain.value *= dbToLin(Math.max(0, eqMid * 0.35));

      // Drive into the limiter — always at least MIN_MASTER_BOOST_DB above unity.
      const bassContrib = bassOn ? Math.max(0, bassOne.push) * 0.12 + Math.max(0, bassOne.output) * 0.25 : 0;
      const matchContrib = matchOn ? (daMatch.loudness - 50) / 20 : 0;
      const driveDb = fastMaster.driveDb;
      const boostLevel = (fastMaster.x1LoudBoost ?? 0) as X1LoudBoost;
      const x1LoudDb = X1_LOUD_BOOST_DB[boostLevel] ?? 0;
      const totalBoostDb = Math.max(
        MIN_MASTER_BOOST_DB,
        makeupDb + driveDb + bassContrib + matchContrib + x1LoudDb,
      );
      // Split: makeup already applied; outputGain carries the rest of the boost.
      nodes.outputGain.gain.value = dbToLin(totalBoostDb - makeupDb);
    } else {
      nodes.compressor.threshold.value = 0;
      nodes.compressor.ratio.value = 1;
      nodes.compressor.knee.value = 0;
      nodes.peakLimiter.threshold.value = 0;
      nodes.peakLimiter.ratio.value = 1;
      nodes.peakLimiter.knee.value = 0;
      nodes.makeupGain.gain.value = 1;
      const bassBoost = bassOn ? Math.max(0, bassOne.push) * 0.1 + Math.max(0, bassOne.output) * 0.2 : 0;
      nodes.outputGain.gain.value = dbToLin(bassBoost);
    }
  };

  const stopSource = () => {
    stopAllSources();
  };

  buildGraph();

  return {
    setRackState(state) {
      applyRackState(state);
    },

    setSourceBuffer(buffer) {
      sourceBuffer = buffer;
      if (!buffer) {
        stopSource();
        clipTimeline = [];
        playbackSchedule = [];
        timelineDurationSec = 0;
        Object.assign(hold, createMeterHoldState());
        multiSnap = idleMultiMeterSnap();
        nugenSnap = idleNugenMeterSnap();
      }
    },

    setClipTimeline(clips, activeClipId) {
      const wasPlaying = activeSources.length > 0;
      const t = wasPlaying
        ? Math.max(
            0,
            Math.min(timelineDurationSec, playbackOffsetSec + (ctx.currentTime - playbackStartSec)),
          )
        : playbackOffsetSec;
      const structureChanged = clipTimelineStructureChanged(clipTimeline, clips);
      clipTimeline = clips;
      rebuildSchedule();
      applyTimelineSourceGain(resolveTimelineSourceGainDb(clips, activeClipId));
      if (wasPlaying && structureChanged) schedulePlaybackFrom(t);
    },

    play(timelineOffsetSec) {
      if (!nodes || playbackSchedule.length === 0) return;
      const offset = Math.max(0, Math.min(timelineDurationSec - 0.01, timelineOffsetSec));
      schedulePlaybackFrom(offset);
    },

    stop() {
      const t = activeSources.length
        ? playbackOffsetSec + (ctx.currentTime - playbackStartSec)
        : playbackOffsetSec;
      stopSource();
      playbackOffsetSec = Math.max(0, Math.min(timelineDurationSec, t));
      return playbackOffsetSec;
    },

    seek(timelineOffsetSec) {
      if (activeSources.length > 0) return;
      playbackOffsetSec = Math.max(0, Math.min(timelineDurationSec, timelineOffsetSec));
    },

    isPlaying() {
      return activeSources.length > 0;
    },

    getPlayheadSec() {
      if (activeSources.length === 0) return playbackOffsetSec;
      const t = playbackOffsetSec + (ctx.currentTime - playbackStartSec);
      return Math.max(0, Math.min(timelineDurationSec, t));
    },

    getTimelineDurationSec() {
      return timelineDurationSec;
    },

    tickMeters(dtMs: number) {
      if (!taps || !meterBufs || !nodes) return;
      const playing = activeSources.length > 0;
      const snaps = analyseMasteringBayMeters(taps, hold, meterBufs, dtMs, playing, {
        limiterReductionDb: nodes.peakLimiter.reduction,
        compressorReductionDb: nodes.compressor.reduction,
      });
      multiSnap = snaps.multi;
      nugenSnap = snaps.nugen;
    },

    resetMeters() {
      Object.assign(hold, createMeterHoldState());
      multiSnap = idleMultiMeterSnap();
      nugenSnap = idleNugenMeterSnap();
    },

    getMultiSnap() {
      return multiSnap;
    },

    getNugenSnap() {
      return nugenSnap;
    },

    getAudioContext() {
      return ctx;
    },

    dispose() {
      stopSource();
      if (nodes) {
        nodes.inputGain.disconnect();
        nodes.spectrumAnalyser.disconnect();
        nodes.meterKeepAlive.disconnect();
        nodes = null;
        taps = null;
        meterBufs = null;
      }
    },
  };
}
