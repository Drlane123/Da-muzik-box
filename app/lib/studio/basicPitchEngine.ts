/**
 * Basic Pitch model runner (ported from Spotify basic-pitch-ts, Apache-2.0).
 * Uses a vendored TF.js 3.x UMD build so we do not conflict with Magenta's TF.js 2.x.
 *
 * Copyright 2022 Spotify AB — https://github.com/spotify/basic-pitch-ts
 */
import {
  addPitchBendsToNoteEvents,
  noteFramesToTime,
  outputToNotesPoly,
  type NoteEventTime,
} from '@/app/lib/studio/basicPitchToMidi';

const TFJS_SCRIPT_URL = '/vendor/tfjs-3.21.0/tf.min.js';
const MODEL_URL = '/basic-pitch-model/model.json';

const OUTPUT_TO_TENSOR_NAME = {
  contours: 'Identity',
  onsets: 'Identity_2',
  frames: 'Identity_1',
} as const;

const AUDIO_SAMPLE_RATE = 22050;
const FFT_HOP = 256;
const ANNOTATIONS_FPS = Math.floor(AUDIO_SAMPLE_RATE / FFT_HOP);
const AUDIO_WINDOW_LENGTH_SECONDS = 2;
const AUDIO_N_SAMPLES = AUDIO_SAMPLE_RATE * AUDIO_WINDOW_LENGTH_SECONDS - FFT_HOP;
const N_OVERLAPPING_FRAMES = 30;
const N_OVERLAP_OVER_2 = Math.floor(N_OVERLAPPING_FRAMES / 2);
const OVERLAP_LENGTH_FRAMES = N_OVERLAPPING_FRAMES * FFT_HOP;
const HOP_SIZE = AUDIO_N_SAMPLES - OVERLAP_LENGTH_FRAMES;

type TfNs = {
  loadGraphModel: (path: string) => Promise<TfGraphModel>;
  concat1d: (tensors: unknown[]) => TfTensor;
  zeros: (shape: number[], dtype?: string) => TfTensor;
  tensor: (data: Float32Array) => TfTensor;
  expandDims: (x: TfTensor, axis: number) => TfTensor;
  slice: (x: TfTensor, begin: number | number[], size?: number | number[]) => TfTensor;
  signal: { frame: (x: TfTensor, frameLength: number, frameStep: number, padEnd?: boolean, padValue?: number) => TfTensor };
};

type TfTensor = {
  shape: number[];
  slice: (begin: number[], size: number[]) => TfTensor;
  reshape: (shape: number[]) => TfTensor;
  array: () => Promise<number[][]>;
  dispose?: () => void;
};

type TfGraphModel = {
  execute: (input: TfTensor, outputs: string[]) => TfTensor[];
};

declare global {
  interface Window {
    tf?: TfNs;
  }
}

let tfLoadPromise: Promise<TfNs> | null = null;
let modelPromise: Promise<TfGraphModel> | null = null;

function loadTfjsScript(): Promise<TfNs> {
  if (window.tf?.loadGraphModel) return Promise.resolve(window.tf);
  if (tfLoadPromise) return tfLoadPromise;

  tfLoadPromise = new Promise<TfNs>((resolve, reject) => {
    const existing = document.querySelector(`script[data-da-tfjs="3.21.0"]`);
    if (existing && window.tf?.loadGraphModel) {
      resolve(window.tf);
      return;
    }
    const script = document.createElement('script');
    script.src = TFJS_SCRIPT_URL;
    script.async = true;
    script.dataset.daTfjs = '3.21.0';
    script.onload = () => {
      if (!window.tf?.loadGraphModel) {
        reject(new Error('TF.js loaded but window.tf is missing'));
        tfLoadPromise = null;
        return;
      }
      resolve(window.tf);
    };
    script.onerror = () => {
      tfLoadPromise = null;
      reject(new Error(`Failed to load ${TFJS_SCRIPT_URL}`));
    };
    document.head.appendChild(script);
  });

  return tfLoadPromise;
}

async function getModel(): Promise<{ tf: TfNs; model: TfGraphModel }> {
  const tf = await loadTfjsScript();
  if (!modelPromise) {
    modelPromise = tf.loadGraphModel(MODEL_URL).catch((err) => {
      modelPromise = null;
      throw err;
    });
  }
  const model = await modelPromise;
  return { tf, model };
}

async function prepareData(
  tf: TfNs,
  singleChannelAudioData: Float32Array,
): Promise<{ reshaped: TfTensor; originalLength: number }> {
  const wavSamples = tf.concat1d([
    tf.zeros([Math.floor(OVERLAP_LENGTH_FRAMES / 2)], 'float32'),
    tf.tensor(singleChannelAudioData),
  ]);
  const framed = tf.signal.frame(wavSamples as never, AUDIO_N_SAMPLES, HOP_SIZE, true, 0);
  return {
    reshaped: tf.expandDims(framed, -1),
    originalLength: singleChannelAudioData.length,
  };
}

function unwrapOutput(result: TfTensor): TfTensor {
  const raw = result.slice(
    [0, N_OVERLAP_OVER_2, 0],
    [-1, result.shape[1]! - 2 * N_OVERLAP_OVER_2, -1],
  );
  const shape = raw.shape;
  return raw.reshape([shape[0]! * shape[1]!, shape[2]!]);
}

export type BasicPitchEngineProgress = (percent: number) => void;

/** Spotify note-decode knobs (hum-friendly defaults). */
export type BasicPitchDecodeThresholds = {
  /** Higher = fewer note starts (less breath/click noise). 0.1–0.9 */
  onsetThreshold?: number;
  /** Higher = shorter / quieter holds are dropped. 0.1–0.9 */
  frameThreshold?: number;
  /** Minimum note length in model frames (~11.6 ms each @ 22050 / hop 256). */
  minNoteFrames?: number;
};

export const BASIC_PITCH_DEFAULT_THRESHOLDS: Required<BasicPitchDecodeThresholds> = {
  onsetThreshold: 0.4,
  frameThreshold: 0.25,
  minNoteFrames: 4,
};

function clampThresh(v: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0.1, Math.min(0.9, v));
}

/**
 * Run Basic Pitch on mono Float32 audio already at 22050 Hz.
 * Returns timed note events (may be polyphonic).
 */
export async function evaluateBasicPitchMono22050(
  audioData: Float32Array,
  onProgress?: BasicPitchEngineProgress,
  thresholds?: BasicPitchDecodeThresholds,
): Promise<NoteEventTime[]> {
  const onsetThresh = clampThresh(
    thresholds?.onsetThreshold ?? BASIC_PITCH_DEFAULT_THRESHOLDS.onsetThreshold,
    BASIC_PITCH_DEFAULT_THRESHOLDS.onsetThreshold,
  );
  const frameThresh = clampThresh(
    thresholds?.frameThreshold ?? BASIC_PITCH_DEFAULT_THRESHOLDS.frameThreshold,
    BASIC_PITCH_DEFAULT_THRESHOLDS.frameThreshold,
  );
  const minNoteFrames = Math.max(
    1,
    Math.round(thresholds?.minNoteFrames ?? BASIC_PITCH_DEFAULT_THRESHOLDS.minNoteFrames),
  );

  const { tf, model } = await getModel();
  const { reshaped, originalLength } = await prepareData(tf, audioData);
  const nOutputFramesOriginal = Math.floor(originalLength * (ANNOTATIONS_FPS / AUDIO_SAMPLE_RATE));

  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];
  let calculatedFrames = 0;
  const batchCount = reshaped.shape[0] ?? 0;

  for (let i = 0; i < batchCount; i++) {
    onProgress?.(i / Math.max(1, batchCount));
    const singleBatch = tf.slice(reshaped, i, 1);
    const results = model.execute(singleBatch, [
      OUTPUT_TO_TENSOR_NAME.frames,
      OUTPUT_TO_TENSOR_NAME.onsets,
      OUTPUT_TO_TENSOR_NAME.contours,
    ]);

    let unwrappedFrames = unwrapOutput(results[0]!);
    let unwrappedOnsets = unwrapOutput(results[1]!);
    let unwrappedContours = unwrapOutput(results[2]!);
    const calculatedFramesTmp = unwrappedFrames.shape[0] ?? 0;

    if (calculatedFrames >= nOutputFramesOriginal) continue;
    if (calculatedFramesTmp + calculatedFrames >= nOutputFramesOriginal) {
      const framesToOutput = nOutputFramesOriginal - calculatedFrames;
      unwrappedFrames = unwrappedFrames.slice([0, 0], [framesToOutput, -1]);
      unwrappedOnsets = unwrappedOnsets.slice([0, 0], [framesToOutput, -1]);
      unwrappedContours = unwrappedContours.slice([0, 0], [framesToOutput, -1]);
    }
    calculatedFrames += calculatedFramesTmp;
    frames.push(...(await unwrappedFrames.array()));
    onsets.push(...(await unwrappedOnsets.array()));
    contours.push(...(await unwrappedContours.array()));
  }

  onProgress?.(1);

  return noteFramesToTime(
    addPitchBendsToNoteEvents(
      contours,
      outputToNotesPoly(frames, onsets, onsetThresh, frameThresh, minNoteFrames),
    ),
  );
}
