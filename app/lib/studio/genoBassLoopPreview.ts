/**
 * Geno Bass 52 — preview from editable piano-roll notes (Bassliner-style).
 * Uses the same ARP mono voice path as Geno Ultra loop preview (not keyboard preview).
 */
import {
  scheduleGenoUltraSynthNote,
  stopGenoUltraArpPreviewVoices,
  stopGenoUltraKeyboardPreviewVoices,
} from '@/app/lib/studio/genoUltraSynthEngine';
import type { GenoUltraSynthVoiceParams } from '@/app/lib/studio/genoUltraSynthTypes';
import { setGenoUltraArpPreviewRunning } from '@/app/lib/creationStation/creationTransportSync';
import type { GenoUltraArpSe2RollNote } from '@/app/lib/studio/genoUltraArpExport';
import { genoBassPreviewVelocityMidi } from '@/app/lib/studio/genoBassLoopExport';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';

const LOOKAHEAD_SEC = 0.45;
const PUMP_MS = 20;

export type GenoBassLoopPreviewOpts = {
  ctx: AudioContext;
  getStripOutput: () => AudioNode;
  getVoice: () => GenoUltraSynthVoiceParams;
  getRollNotes: () => readonly GenoUltraArpSe2RollNote[];
  barLength: number;
  bpm: number;
  getBpm?: () => number;
  getBarLength?: () => number;
  loop?: boolean;
  getTransportPatternBeat?: () => number;
  onComplete?: () => void;
};

export type GenoBassLoopPreviewHandle = {
  stop: () => void;
  /** Beat within the preview loop (0 … barLength×4), aligned to audio anchor. */
  getLoopBeat: () => number | null;
};

let activeHandle: GenoBassLoopPreviewHandle | null = null;
let bassSessionId = 0;

export function getGenoBassLoopPreviewBeat(): number | null {
  return activeHandle?.getLoopBeat() ?? null;
}

export function stopGenoBassLoopPreview(): void {
  activeHandle?.stop();
  activeHandle = null;
  setGenoUltraArpPreviewRunning(false);
}

function beatToSec(beat: number, bpm: number): number {
  return (beat * 60) / Math.max(40, bpm);
}

export function startGenoBassLoopPreview(opts: GenoBassLoopPreviewOpts): GenoBassLoopPreviewHandle {
  stopGenoBassLoopPreview();
  stopGenoUltraKeyboardPreviewVoices();

  bassSessionId += 1;
  const sessionId = bassSessionId;
  const loop = opts.loop !== false;

  let cancelled = false;
  let pumpTimer: ReturnType<typeof setInterval> | null = null;
  let completeTimer: ReturnType<typeof setTimeout> | null = null;
  let cycleStart = opts.ctx.currentTime + SE2_AUDIO_START_FLOOR_SEC;
  let passAnchor = cycleStart;
  let arpBus: GainNode | null = null;
  let arpBusDest: AudioNode | null = null;
  const emitted = new Set<string>();
  let transportAnchored = false;

  void (async () => {
    if (opts.ctx.state === 'suspended') {
      try {
        await opts.ctx.resume();
      } catch {
        /* autoplay */
      }
    }
  })();

  const wireBus = () => {
    if (!arpBus || arpBus.context.state === 'closed') {
      arpBus = opts.ctx.createGain();
      arpBus.gain.value = 0.88;
      arpBusDest = null;
    }
    if (arpBusDest == null) {
      try {
        const dest = opts.getStripOutput();
        arpBus.connect(dest);
        arpBusDest = dest;
      } catch {
        /* strip not ready */
      }
    }
  };

  const ensureBus = (): AudioNode => {
    wireBus();
    return arpBus!;
  };

  const liveBpm = () => opts.getBpm?.() ?? opts.bpm;
  const liveBarLength = () => opts.getBarLength?.() ?? opts.barLength;
  const patternBeats = () => liveBarLength() * 4;
  const secPerBeat = () => 60 / Math.max(40, liveBpm());

  const scheduleNotes = () => {
    if (cancelled || sessionId !== bassSessionId) return;
    wireBus();
    const bpm = liveBpm();
    const notes = [...opts.getRollNotes()].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
    const patternLen = patternBeats();
    const patternDurSec = beatToSec(patternLen, bpm);
    const now = opts.ctx.currentTime;
    const horizon = now + LOOKAHEAD_SEC;
    const transportBeat = opts.getTransportPatternBeat?.();

    if (transportBeat != null && !transportAnchored) {
      const phase = ((transportBeat % patternLen) + patternLen) % patternLen;
      cycleStart = now - beatToSec(phase, bpm);
      passAnchor = cycleStart;
      transportAnchored = true;
      emitted.clear();
    }

    if (!notes.length) return;

    let cycle = 0;
    let cStart = cycleStart;

    if (loop) {
      while (cStart + patternDurSec <= now) {
        cStart += patternDurSec;
        cycle += 1;
      }
    }

    while (cStart < horizon) {
      for (let i = 0; i < notes.length; i += 1) {
        const n = notes[i]!;
        const when = cStart + beatToSec(n.startBeat, bpm);
        if (when < now - 0.02) continue;
        if (when >= horizon) break;

        const key = `${cycle}:${i}:${Math.round(when * 1000)}:${n.pitch}`;
        if (emitted.has(key)) continue;
        emitted.add(key);
        if (emitted.size > 768) emitted.clear();

        const durSec = Math.max(0.04, beatToSec(n.durationBeats, bpm));
        const nextStart =
          i + 1 < notes.length
            ? notes[i + 1]!.startBeat
            : patternLen;
        const gapSec = Math.max(0.04, beatToSec(Math.max(0.0625, nextStart - n.startBeat), bpm));

        scheduleGenoUltraSynthNote(opts.ctx, {
          when,
          durationSec: durSec,
          midi: n.pitch,
          velocity: genoBassPreviewVelocityMidi(n.velocity),
          voice: opts.getVoice(),
          stripOutput: ensureBus(),
          bpm,
          arpPreview: true,
          arpStepSec: gapSec,
          // Geno Bass stays in the low register — Ultra defaults to +12.
          playbackTranspose: 0,
        });
      }

      if (!loop) break;
      cStart += patternDurSec;
      cycle += 1;
    }

    if (!loop && !completeTimer) {
      const endAt = cycleStart + patternDurSec + 0.2;
      const waitMs = Math.max(80, (endAt - now) * 1000);
      completeTimer = setTimeout(() => {
        if (sessionId !== bassSessionId) return;
        handle.stop();
        opts.onComplete?.();
      }, waitMs);
    }
  };

  const getLoopBeat = (): number | null => {
    if (cancelled || sessionId !== bassSessionId) return null;
    const patternLen = patternBeats();
    if (patternLen <= 0) return null;
    const elapsed = opts.ctx.currentTime - passAnchor;
    if (elapsed < 0) return 0;
    const beat = (elapsed / secPerBeat()) % patternLen;
    return beat < 0 ? beat + patternLen : beat;
  };

  setGenoUltraArpPreviewRunning(true);
  passAnchor = cycleStart;
  scheduleNotes();
  pumpTimer = setInterval(scheduleNotes, PUMP_MS);

  const handle: GenoBassLoopPreviewHandle = {
    getLoopBeat,
    stop: () => {
      cancelled = true;
      if (pumpTimer) clearInterval(pumpTimer);
      pumpTimer = null;
      if (completeTimer) clearTimeout(completeTimer);
      completeTimer = null;
      stopGenoUltraArpPreviewVoices();
      if (arpBus) {
        try {
          arpBus.disconnect();
        } catch {
          /* */
        }
        arpBus = null;
      }
      arpBusDest = null;
      if (activeHandle === handle) activeHandle = null;
      setGenoUltraArpPreviewRunning(false);
    },
  };

  activeHandle = handle;
  return handle;
}
