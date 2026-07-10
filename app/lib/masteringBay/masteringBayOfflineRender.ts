/** Offline bounce of clip timeline through the mastering rack chain. */

import { dbToLin } from '@/app/lib/masteringBay/masteringBayMeterAnalysis';
import {
  X1_LOUD_BOOST_DB,
  type MasteringBayRackState,
  type X1LoudBoost,
} from '@/app/lib/masteringBay/masteringBayPresets';
import {
  buildPlaybackSchedule,
  clipEditTimelineSpanSec,
  MIN_FADE_SEC,
  resolveTimelineSourceGainDb,
  type MasteringBayClipEditState,
} from '@/app/lib/masteringBay/masteringBayClipEdit';

const BASE_INPUT_GAIN = 1;
const MIN_MASTER_BOOST_DB = 2;

function applyDeNoiseStage(
  active: boolean,
  deNoise: MasteringBayRackState['deNoise'] | undefined,
  shelf: BiquadFilterNode,
  air: BiquadFilterNode,
  click: DynamicsCompressorNode,
  makeup: GainNode,
) {
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
}

function initDeNoise(
  shelf: BiquadFilterNode,
  air: BiquadFilterNode,
  click: DynamicsCompressorNode,
  makeup: GainNode,
) {
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
}

/**
 * Render clip timeline + rack through OfflineAudioContext.
 * Returns stereo buffer at the requested sample rate.
 */
export async function renderMasteringBayOffline(
  clipEdit: MasteringBayClipEditState,
  rackState: MasteringBayRackState,
  sampleRate: 44100 | 48000,
): Promise<AudioBuffer> {
  const schedule = buildPlaybackSchedule(clipEdit.clips);
  if (schedule.length === 0) throw new Error('No audio clips to export.');

  const durationSec = Math.max(0.05, clipEditTimelineSpanSec(clipEdit) + 0.05);
  const length = Math.ceil(durationSec * sampleRate);
  const offline = new OfflineAudioContext(2, length, sampleRate);

  const inputGain = offline.createGain();
  const sourceMixBus = offline.createGain();
  const sourceClipGain = offline.createGain();
  sourceMixBus.gain.value = 1;
  sourceClipGain.gain.value = dbToLin(resolveTimelineSourceGainDb(clipEdit.clips));
  sourceMixBus.connect(sourceClipGain);
  sourceClipGain.connect(inputGain);
  const lowShelf = offline.createBiquadFilter();
  const midGain = offline.createGain();
  const stereoPanner = offline.createStereoPanner();
  const deHissShelfBefore = offline.createBiquadFilter();
  const deHissAirBefore = offline.createBiquadFilter();
  const deClickCompBefore = offline.createDynamicsCompressor();
  const deClickMakeupBefore = offline.createGain();
  const compressor = offline.createDynamicsCompressor();
  const makeupGain = offline.createGain();
  const highShelf = offline.createBiquadFilter();
  const outputGain = offline.createGain();
  const peakLimiter = offline.createDynamicsCompressor();
  const deHissShelfAfter = offline.createBiquadFilter();
  const deHissAirAfter = offline.createBiquadFilter();
  const deClickCompAfter = offline.createDynamicsCompressor();
  const deClickMakeupAfter = offline.createGain();

  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = 120;
  highShelf.type = 'highshelf';
  highShelf.frequency.value = 8000;
  initDeNoise(deHissShelfBefore, deHissAirBefore, deClickCompBefore, deClickMakeupBefore);
  initDeNoise(deHissShelfAfter, deHissAirAfter, deClickCompAfter, deClickMakeupAfter);
  peakLimiter.knee.value = 0;
  peakLimiter.attack.value = 0.001;
  peakLimiter.release.value = 0.05;
  peakLimiter.ratio.value = 20;
  peakLimiter.threshold.value = -1;
  makeupGain.gain.value = 1;

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
  outputGain.connect(peakLimiter);
  peakLimiter.connect(deHissShelfAfter);
  deHissShelfAfter.connect(deHissAirAfter);
  deHissAirAfter.connect(deClickCompAfter);
  deClickCompAfter.connect(deClickMakeupAfter);
  deClickMakeupAfter.connect(offline.destination);

  // Apply rack (mirrors live engine applyRackState).
  const { bassOne, daMatch, fastMaster, deNoise } = rackState;
  const bassOn = bassOne.power && !bassOne.bypass;
  const matchOn = daMatch.power;
  const masterOn = fastMaster.power;
  const deNoiseOn = !!deNoise?.power;
  const placement = deNoise?.placement === 'before' ? 'before' : 'after';

  inputGain.gain.value = BASE_INPUT_GAIN;
  lowShelf.gain.value = bassOn ? (bassOne.push - 5) * 1.4 : 0;
  lowShelf.frequency.value = 30 + bassOne.loCut * 2.2;
  midGain.gain.value = matchOn ? 1 + daMatch.matchAmount / 200 : 1;
  highShelf.gain.value = matchOn ? (daMatch.tone - 50) / 8 : 0;
  stereoPanner.pan.value = matchOn ? ((daMatch.width - 50) / 50) * 0.45 : 0;

  applyDeNoiseStage(
    deNoiseOn && placement === 'before',
    deNoise,
    deHissShelfBefore,
    deHissAirBefore,
    deClickCompBefore,
    deClickMakeupBefore,
  );
  applyDeNoiseStage(
    deNoiseOn && placement === 'after',
    deNoise,
    deHissShelfAfter,
    deHissAirAfter,
    deClickCompAfter,
    deClickMakeupAfter,
  );

  if (masterOn) {
    const thr = fastMaster.params.threshold ?? -12;
    const ratio = 2 + (fastMaster.params.amount ?? 30) / 12;
    compressor.threshold.value = thr;
    compressor.ratio.value = ratio;
    compressor.knee.value = 10;
    compressor.attack.value = 0.003;
    compressor.release.value = Math.max(0.04, (fastMaster.params.release ?? 130) / 1000);
    const makeupDb = Math.max(0, -thr * (1 - 1 / Math.max(1.01, ratio)) * 0.55);
    makeupGain.gain.value = dbToLin(makeupDb);
    const ceiling = Math.min(-0.1, fastMaster.params.ceiling ?? -1);
    peakLimiter.threshold.value = ceiling;
    peakLimiter.ratio.value = 20;
    peakLimiter.knee.value = 0;
    peakLimiter.attack.value = 0.001;
    peakLimiter.release.value = Math.max(0.05, (fastMaster.params.release ?? 130) / 1000);
    const eqLow = fastMaster.params.low ?? 0;
    const eqHigh = fastMaster.params.high ?? 0;
    const eqMid = fastMaster.params.mid ?? 0;
    lowShelf.gain.value += eqLow * 0.9;
    highShelf.gain.value += eqHigh * 0.9;
    midGain.gain.value *= dbToLin(Math.max(0, eqMid * 0.35));
    const bassContrib = bassOn ? Math.max(0, bassOne.push) * 0.12 + Math.max(0, bassOne.output) * 0.25 : 0;
    const matchContrib = matchOn ? (daMatch.loudness - 50) / 20 : 0;
    const boostLevel = (fastMaster.x1LoudBoost ?? 0) as X1LoudBoost;
    const x1LoudDb = X1_LOUD_BOOST_DB[boostLevel] ?? 0;
    const totalBoostDb = Math.max(
      MIN_MASTER_BOOST_DB,
      makeupDb + fastMaster.driveDb + bassContrib + matchContrib + x1LoudDb,
    );
    outputGain.gain.value = dbToLin(totalBoostDb - makeupDb);
  } else {
    compressor.threshold.value = 0;
    compressor.ratio.value = 1;
    compressor.knee.value = 0;
    peakLimiter.threshold.value = 0;
    peakLimiter.ratio.value = 1;
    peakLimiter.knee.value = 0;
    makeupGain.gain.value = 1;
    const bassBoost = bassOn ? Math.max(0, bassOne.push) * 0.1 + Math.max(0, bassOne.output) * 0.2 : 0;
    outputGain.gain.value = dbToLin(bassBoost);
  }

  // Schedule clips with fades (same as live engine).
  for (const seg of schedule) {
    const src = offline.createBufferSource();
    src.buffer = seg.buffer;
    const fadeGain = offline.createGain();
    if (seg.buffer.numberOfChannels === 1) {
      const merger = offline.createChannelMerger(2);
      src.connect(merger, 0, 0);
      src.connect(merger, 0, 1);
      merger.connect(fadeGain);
    } else {
      src.connect(fadeGain);
    }
    fadeGain.connect(sourceMixBus);

    const when = seg.timelineStartSec;
    const remainDur = seg.durationSec;
    fadeGain.gain.setValueAtTime(1, when);
    if (seg.fadeInSec > MIN_FADE_SEC && remainDur > MIN_FADE_SEC) {
      fadeGain.gain.setValueAtTime(0, when);
      fadeGain.gain.linearRampToValueAtTime(1, when + Math.min(seg.fadeInSec, remainDur));
    }
    if (seg.fadeOutSec > MIN_FADE_SEC && remainDur > MIN_FADE_SEC) {
      const outLead = Math.min(seg.fadeOutSec, remainDur);
      const outStart = when + Math.max(0, remainDur - outLead);
      fadeGain.gain.setValueAtTime(1, outStart);
      fadeGain.gain.linearRampToValueAtTime(0, when + remainDur);
    }
    src.start(when, seg.bufferOffsetSec, remainDur);
  }

  return offline.startRendering();
}
