/**
 * VocalBox — render typed words as computer speech buffers for the FX chain.
 * LISTEN uses browser TTS; VOCALBOX tries cloud TTS first, then clean formant fallback.
 */
import { detectPitchACF } from '@/app/lib/pitchDetection';
import { scheduleVocalBoxSpokenToken } from '@/app/lib/creationStation/grooveLabVocalBoxSpeech';
import type { VocalBoxSettings } from '@/app/lib/creationStation/grooveLabVocalBoxEngine';

const ttsCache = new Map<string, AudioBuffer>();
const phraseCache = new Map<string, AudioBuffer>();

export type VocalBoxTtsSource = 'cloud' | 'formant';

const TTS_VOICES = ['Brian', 'Justin', 'Russell'] as const;

async function fetchRemoteTtsBuffer(ctx: AudioContext, text: string): Promise<AudioBuffer | null> {
  const line = text.trim();
  if (!line) return null;

  for (const voice of TTS_VOICES) {
    try {
      const url = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodeURIComponent(line)}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const ab = await res.arrayBuffer();
      if (ab.byteLength < 256) continue;
      return await ctx.decodeAudioData(ab.slice(0));
    } catch {
      /* try next voice */
    }
  }
  return null;
}

/** Formant speech only — no vocoder carrier (avoids beepy offline render). */
async function renderFormantSpeechBuffer(
  ctx: AudioContext,
  token: string,
  settings: VocalBoxSettings,
): Promise<AudioBuffer> {
  const dur = Math.max(0.28, Math.min(1.6, 0.12 + token.length * 0.065));
  const sampleRate = ctx.sampleRate;
  const offline = new OfflineAudioContext(1, Math.ceil(sampleRate * dur), sampleRate);
  scheduleVocalBoxSpokenToken(offline as unknown as AudioContext, offline.destination, 0, dur, 196, 0.95, token, {
    robotMix: 0,
    autotuneStrength: 0,
    mode: settings.mode,
    style: settings.style,
    personality: settings.personality,
    speechOnly: true,
  });
  return offline.startRendering();
}

export function estimateSpeechPitchHz(buffer: AudioBuffer): number {
  return estimateSpeechPitchHzRange(buffer, 0, buffer.duration);
}

export function estimateSpeechPitchHzRange(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
): number {
  const ch = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const i0 = Math.max(0, Math.floor(startSec * sr));
  /* Cap scan window — full-clip ACF loops froze the app when enabling Vocoder DSP. */
  const maxScanSec = 2.5;
  const i1 = Math.min(ch.length, Math.ceil(Math.min(endSec, startSec + maxScanSec) * sr));
  const frame = 2048;
  const hop = 4096;
  const pitches: number[] = [];
  const maxFrames = 48;
  for (let i = i0, n = 0; i < i1 - frame && n < maxFrames; i += hop, n += 1) {
    const slice = ch.subarray(i, i + frame);
    const { frequency, confidence } = detectPitchACF(slice, sr, 70, 420, 0.08);
    if (frequency > 0 && confidence > 0.1) pitches.push(frequency);
  }
  if (pitches.length === 0) return 165;
  pitches.sort((a, b) => a - b);
  return pitches[Math.floor(pitches.length / 2)]!;
}

/** One lyric token → mono speech buffer (cached). */
export async function vocalBoxSynthesizeTokenBuffer(
  ctx: AudioContext,
  token: string,
  settings: VocalBoxSettings,
): Promise<{ buffer: AudioBuffer; source: VocalBoxTtsSource }> {
  const key = token.trim().toLowerCase();
  if (!key) {
    return { buffer: await renderFormantSpeechBuffer(ctx, 'la', settings), source: 'formant' };
  }
  const hit = ttsCache.get(key);
  if (hit) return { buffer: hit, source: 'cloud' };

  const remote = await fetchRemoteTtsBuffer(ctx, key);
  if (remote) {
    ttsCache.set(key, remote);
    return { buffer: remote, source: 'cloud' };
  }

  const formant = await renderFormantSpeechBuffer(ctx, key, settings);
  ttsCache.set(key, formant);
  return { buffer: formant, source: 'formant' };
}

/** Full lyric line as one speech clip — better flow for phrases like "I want to make love to you". */
export async function vocalBoxSynthesizePhraseBuffer(
  ctx: AudioContext,
  phrase: string,
  settings: VocalBoxSettings,
): Promise<{ buffer: AudioBuffer | null; source: VocalBoxTtsSource }> {
  const line = phrase.trim();
  if (!line) return { buffer: null, source: 'formant' };
  const key = line.toLowerCase();
  const hit = phraseCache.get(key);
  if (hit) return { buffer: hit, source: 'cloud' };

  const remote = await fetchRemoteTtsBuffer(ctx, line);
  if (remote) {
    phraseCache.set(key, remote);
    return { buffer: remote, source: 'cloud' };
  }
  return { buffer: null, source: 'formant' };
}

function slicePhraseBufferByWords(
  ctx: AudioContext,
  phraseBuf: AudioBuffer,
  words: readonly string[],
): Map<string, AudioBuffer> {
  const out = new Map<string, AudioBuffer>();
  if (words.length === 0) return out;

  const weights = words.map((w) => Math.max(1, w.length));
  const total = weights.reduce((s, w) => s + w, 0);
  const ch = phraseBuf.getChannelData(0);
  let cursor = 0;

  for (let i = 0; i < words.length; i++) {
    const key = words[i]!.trim().toLowerCase();
    const share = weights[i]! / total;
    const samples = Math.max(1, Math.floor(ch.length * share));
    const end = i === words.length - 1 ? ch.length : Math.min(ch.length, cursor + samples);
    const sliceLen = end - cursor;
    const part = ctx.createBuffer(1, sliceLen, phraseBuf.sampleRate);
    part.copyToChannel(ch.subarray(cursor, end), 0);
    out.set(key, part);
    cursor = end;
  }
  return out;
}

export async function vocalBoxPrefetchTokenBuffers(
  ctx: AudioContext,
  tokens: readonly string[],
  settings: VocalBoxSettings,
  phrase?: string,
): Promise<{ buffers: Map<string, AudioBuffer>; source: VocalBoxTtsSource }> {
  const uniq = [...new Set(tokens.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  const out = new Map<string, AudioBuffer>();

  const phraseLine = (phrase ?? '').trim();
  if (phraseLine && uniq.length > 1) {
    const { buffer: phraseBuf, source: phraseSource } = await vocalBoxSynthesizePhraseBuffer(ctx, phraseLine, settings);
    if (phraseBuf) {
      const slices = slicePhraseBufferByWords(ctx, phraseBuf, uniq);
      for (const [k, v] of slices) {
        out.set(k, v);
        ttsCache.set(k, v);
      }
      if (out.size >= uniq.length) {
        return { buffers: out, source: phraseSource };
      }
    }
  }

  let usedFormant = false;
  await Promise.all(
    uniq.map(async (tok) => {
      if (out.has(tok)) return;
      const { buffer, source } = await vocalBoxSynthesizeTokenBuffer(ctx, tok, settings);
      out.set(tok, buffer);
      if (source === 'formant') usedFormant = true;
    }),
  );

  return { buffers: out, source: usedFormant ? 'formant' : 'cloud' };
}
