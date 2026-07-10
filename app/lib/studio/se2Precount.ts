/**
 * SE2 record pre-count — standalone quarter-note clicks before transport + record.
 * Intentionally separate from playback {@link refillMetronome} / MET toggle.
 */

export type Se2PrecountRunArgs = {
  ctx: AudioContext;
  bpm: number;
  beatsPerBar: number;
  /** 1 or 2 bars of count-in. */
  bars: 1 | 2;
  scheduleClick: (idealT: number, downbeat: boolean) => void;
  onBeat?: (beat1Based: number, totalBeats: number) => void;
  isCancelled: () => boolean;
};

export type Se2PrecountRunResult = {
  cancelled: boolean;
  /** AudioContext time of the downbeat after the count-in (record / transport anchor). */
  downbeatAudioTime: number;
};

const PRECOUNT_LEAD_SEC = 0.05;

/** TR-808 rimshot — same asset used across Beat Lab kits (public domain smpldsnds). */
const SE2_PRECOUNT_RIMSHOT_URL =
  'https://smpldsnds.github.io/drum-machines/TR-808/rimshot/rs.m4a';

let rimshotCache: AudioBuffer | null = null;
let rimshotLoad: Promise<AudioBuffer> | null = null;

function normalizeBufferPeak(buf: AudioBuffer, targetPeak = 0.9): void {
  let peak = 0;
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i += 1) peak = Math.max(peak, Math.abs(ch[i]!));
  if (peak <= 1e-6) return;
  const scale = targetPeak / peak;
  for (let i = 0; i < ch.length; i += 1) ch[i] = ch[i]! * scale;
}

/** Trim decoded rimshot to a tight metronome-length click. */
function trimRimshotSample(src: AudioBuffer, ctx: AudioContext): AudioBuffer {
  const maxSec = 0.1;
  const n = Math.min(src.length, Math.max(1, Math.floor(maxSec * src.sampleRate)));
  const out = ctx.createBuffer(1, n, src.sampleRate);
  const srcCh = src.getChannelData(0);
  const dst = out.getChannelData(0);
  for (let i = 0; i < n; i += 1) dst[i] = srcCh[i] ?? 0;
  normalizeBufferPeak(out);
  return out;
}

/** Tight rimshot crack — sync fallback when the TR-808 sample is not ready. */
export function createSe2PrecountRimshotBuffer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const durationSec = 0.042;
  const n = Math.max(1, Math.floor(sr * durationSec));
  const buf = ctx.createBuffer(1, n, sr);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    const env = Math.exp(-t * 92);
    const crack = (Math.random() * 2 - 1) * Math.exp(-t * 320) * 0.88;
    const ping = Math.sin(2 * Math.PI * 1180 * t) * Math.exp(-t * 210) * 0.36;
    const shell = Math.sin(2 * Math.PI * 300 * t) * Math.exp(-t * 78) * 0.12;
    ch[i] = (crack * 0.52 + ping + shell) * env;
  }
  normalizeBufferPeak(buf);
  return buf;
}

/** Prefer real TR-808 rimshot; fall back to synthesized crack if fetch/decode fails. */
export async function ensureSe2PrecountRimshotBuffer(ctx: AudioContext): Promise<AudioBuffer> {
  if (rimshotCache) return rimshotCache;
  if (!rimshotLoad) {
    rimshotLoad = (async () => {
      try {
        const res = await fetch(SE2_PRECOUNT_RIMSHOT_URL);
        if (!res.ok) throw new Error('rimshot fetch failed');
        const raw = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(raw.slice(0));
        rimshotCache = trimRimshotSample(decoded, ctx);
        return rimshotCache;
      } catch {
        rimshotCache = createSe2PrecountRimshotBuffer(ctx);
        return rimshotCache;
      }
    })();
  }
  return rimshotLoad;
}

export const SE2_PRECOUNT_CLICK_VOLUME = 0.36;

/** Schedule count-in clicks, wait for downbeat, then hand off to transport/record. */
export async function runSe2Precount(args: Se2PrecountRunArgs): Promise<Se2PrecountRunResult> {
  const bpm = Math.max(40, Math.min(240, args.bpm));
  const bpb = Math.max(1, Math.round(args.beatsPerBar));
  const bars = args.bars === 2 ? 2 : 1;
  const spb = 60 / bpm;
  const totalBeats = bars * bpb;
  const t0 = args.ctx.currentTime + PRECOUNT_LEAD_SEC;
  const downbeatAudioTime = t0 + totalBeats * spb;

  for (let i = 0; i < totalBeats; i += 1) {
    const t = t0 + i * spb;
    args.scheduleClick(t, i % bpb === 0);
  }
  args.onBeat?.(1, totalBeats);

  await new Promise<void>((resolve) => {
    const wallGiveUpMs = performance.now() + totalBeats * spb * 1000 + 600;
    let lastBeatUi = 1;
    const step = () => {
      if (args.isCancelled()) {
        resolve();
        return;
      }
      if (args.ctx.state === 'suspended') {
        void args.ctx.resume();
      }
      const now = args.ctx.currentTime;
      const k = Math.floor((now - t0) / spb + 1e-8);
      const beatIdx = Math.min(totalBeats, Math.max(1, k + 1));
      if (beatIdx > lastBeatUi) {
        lastBeatUi = beatIdx;
        args.onBeat?.(beatIdx, totalBeats);
      }
      if (now >= downbeatAudioTime - 0.004 || performance.now() >= wallGiveUpMs) {
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  return { cancelled: args.isCancelled(), downbeatAudioTime };
}
