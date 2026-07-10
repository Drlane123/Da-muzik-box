/**
 * Music Match preview — vocal stem + piano chords + bass, synced to master BPM.
 */
import {
  buildGrooveLabMatchSession,
  type AiMatchGenre,
  type AiMatchMood,
} from '@/app/lib/aiMusicMatch/aiMusicMatch';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  haltGrooveLabTransportChordVoices,
  haltProgressionAuditionVoices,
  type ChordVoiceId,
} from '@/app/lib/creationStation/chordSequencerVoices';
import {
  CREATION_METRO_NODE_EPS_SEC,
  CREATION_SCHEDULE_AHEAD_SEC,
  SE2_AUDIO_START_FLOOR_SEC,
} from '@/app/lib/creationStation/creationTransportSystem';
import {
  grooveLabIsBassSubMidi,
  grooveLabStripSubRootHits,
} from '@/app/lib/creationStation/grooveComposerEngine';
import { runWithGrooveLabAudio } from '@/app/lib/creationStation/grooveLabAudio';
import { GROOVE_LAB_BASS_SOUND_DEFAULT } from '@/app/lib/creationStation/grooveLabBassSounds';
import {
  GROOVE_LAB_SLOTS_PER_BAR,
  grooveLabPickChordChannel,
} from '@/app/lib/creationStation/grooveLabRoll';
import { getSharedAudioOutput } from '@/app/lib/creationStation/sharedAudioOutput';
import {
  buildGrooveLabTransportEvents,
  grooveLabSecPerSlot,
  grooveLabTransportEventKey,
  grooveLabTransportSessionStart,
  GROOVE_LAB_TRANSPORT_SCHED_MS,
  scheduleGrooveLabTransportEvent,
  type GrooveLabTransportEvent,
} from '@/app/lib/creationStation/grooveLabTransport';
import type { MelodyProgressionCandidate } from '@/app/lib/creationStation/melodyToChordProgression';

const PREVIEW_CHORD_VOICE: ChordVoiceId = 'grand';
const PREVIEW_REFILL_MAX = 256;

export type AiMatchPreviewMix = {
  stemVolume: number;
  chordVolume: number;
  bassVolume: number;
  vocalsMuted: boolean;
  chordsMuted: boolean;
  bassMuted: boolean;
};

export const AI_MATCH_PREVIEW_MIX_DEFAULT: AiMatchPreviewMix = {
  stemVolume: 1.25,
  chordVolume: 0.55,
  bassVolume: 0.48,
  vocalsMuted: false,
  chordsMuted: false,
  bassMuted: false,
};

export type AiMatchPreviewOpts = {
  audioBuffer: AudioBuffer;
  candidate: MelodyProgressionCandidate;
  keyRoot: number;
  mode: ChordMode;
  barCount: number;
  genre: AiMatchGenre;
  mood: AiMatchMood;
  bpm: number;
  mix?: Partial<AiMatchPreviewMix>;
};

export type AiMatchPreviewHandle = {
  stop: () => void;
  candidateId: string;
  isPlaying: () => boolean;
  setMix: (partial: Partial<AiMatchPreviewMix>) => void;
  getMix: () => AiMatchPreviewMix;
};

let activeHandle: AiMatchPreviewHandle | null = null;
let activeLiveMix: {
  mix: AiMatchPreviewMix;
  stemGain: GainNode | null;
} | null = null;

function resolvePreviewMix(partial?: Partial<AiMatchPreviewMix>): AiMatchPreviewMix {
  return { ...AI_MATCH_PREVIEW_MIX_DEFAULT, ...partial };
}

function applyStemGain(mix: AiMatchPreviewMix, stemGain: GainNode | null): void {
  if (!stemGain) return;
  const v = mix.vocalsMuted ? 0 : Math.max(0, mix.stemVolume);
  stemGain.gain.setTargetAtTime(v, stemGain.context.currentTime, 0.02);
}

function scheduleMatchPreviewEvent(
  ctx: AudioContext,
  when: number,
  ev: GrooveLabTransportEvent,
  schedOpts: Parameters<typeof scheduleGrooveLabTransportEvent>[3],
  mix: AiMatchPreviewMix,
): void {
  if (ev.kind === 'bass') {
    if (mix.bassMuted || mix.bassVolume <= 0.02) return;
    scheduleGrooveLabTransportEvent(
      ctx,
      when,
      { ...ev, vel: Math.min(1, ev.vel * mix.bassVolume) },
      schedOpts,
    );
    return;
  }
  scheduleGrooveLabTransportEvent(ctx, when, ev, schedOpts);
}

function buildPreviewEvents(
  opts: AiMatchPreviewOpts,
): { events: GrooveLabTransportEvent[]; loopSlots: number } | null {
  const built = buildGrooveLabMatchSession({
    candidate: opts.candidate,
    keyRoot: opts.keyRoot,
    mode: opts.mode,
    barCount: opts.barCount,
    genre: opts.genre,
    mood: opts.mood,
  });
  if ('message' in built) return null;

  const ch = grooveLabPickChordChannel();
  const merged = built.notesByChannel[ch] ?? [];
  const bassHits = merged.filter((h) => grooveLabIsBassSubMidi(h.midi));
  const chordHits = grooveLabStripSubRootHits(merged);
  const events = buildGrooveLabTransportEvents(bassHits, chordHits);
  if (events.length === 0) return null;

  return { events, loopSlots: built.barCount * GROOVE_LAB_SLOTS_PER_BAR };
}

function refillMatchPreview(
  ctx: AudioContext,
  ct: number,
  sessionStart: number,
  events: readonly GrooveLabTransportEvent[],
  loopSlots: number,
  firedKeys: Set<string>,
  running: () => boolean,
  schedOpts: Parameters<typeof scheduleGrooveLabTransportEvent>[3],
  mix: AiMatchPreviewMix,
): void {
  if (!running()) return;

  const secPerSlot = schedOpts.secPerSlot;
  const loopSec = Math.max(secPerSlot, loopSlots * secPerSlot);
  const horizon = ct + Math.max(CREATION_SCHEDULE_AHEAD_SEC, loopSec * 0.4);
  const cycleNow = Math.max(0, Math.floor((ct - sessionStart + 1e-6) / loopSec));

  for (const key of firedKeys) {
    const c = Number(key.split('|')[0]);
    if (Number.isFinite(c) && c < cycleNow - 1) firedKeys.delete(key);
  }

  let chain = ct + SE2_AUDIO_START_FLOOR_SEC;
  let scheduled = 0;

  for (let cycle = cycleNow; cycle <= cycleNow + 2 && scheduled < PREVIEW_REFILL_MAX; cycle++) {
    const slotWhen = new Map<number, number>();
    for (const ev of events) {
      const key = grooveLabTransportEventKey(cycle, ev);
      if (firedKeys.has(key)) continue;

      const t = sessionStart + cycle * loopSec + ev.slot * secPerSlot;
      if (t >= horizon || t < ct - 0.08) continue;

      let when = slotWhen.get(ev.slot);
      if (when === undefined) {
        when = Math.max(t, chain);
        slotWhen.set(ev.slot, when);
        chain = when + CREATION_METRO_NODE_EPS_SEC;
      }

      scheduleMatchPreviewEvent(ctx, when, ev, schedOpts, mix);
      firedKeys.add(key);
      scheduled += 1;
    }
  }
}

export function updateAiMusicMatchPreviewMix(partial: Partial<AiMatchPreviewMix>): void {
  activeHandle?.setMix(partial);
}

export function stopAiMusicMatchPreview(): void {
  activeHandle?.stop();
  activeHandle = null;
}

export function isAiMusicMatchPreviewPlaying(candidateId?: string): boolean {
  if (!activeHandle?.isPlaying()) return false;
  if (candidateId) return activeHandle.candidateId === candidateId;
  return true;
}

export function startAiMusicMatchPreview(
  getAudioContext: () => AudioContext,
  opts: AiMatchPreviewOpts,
  onEnded?: () => void,
): AiMatchPreviewHandle | null {
  stopAiMusicMatchPreview();

  const preview = buildPreviewEvents(opts);
  if (!preview) return null;

  const liveMix = resolvePreviewMix(opts.mix);
  let running = true;
  let stemSource: AudioBufferSourceNode | null = null;
  let stemGain: GainNode | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let sessionStart = 0;
  const firedKeys = new Set<string>();

  const schedOpts = {
    bpm: opts.bpm,
    secPerSlot: grooveLabSecPerSlot(opts.bpm),
    bassSoundId: GROOVE_LAB_BASS_SOUND_DEFAULT,
    melodySoundId: GROOVE_LAB_BASS_SOUND_DEFAULT,
    chordVoice: PREVIEW_CHORD_VOICE,
    get chordVolume() {
      return liveMix.chordsMuted ? 0 : liveMix.chordVolume;
    },
    get chordsMuted() {
      return liveMix.chordsMuted;
    },
    get bassMuted() {
      return liveMix.bassMuted;
    },
    perfMode: 'block' as const,
  };

  const setMix = (partial: Partial<AiMatchPreviewMix>) => {
    Object.assign(liveMix, partial);
    applyStemGain(liveMix, stemGain);
  };

  const stop = () => {
    if (!running) return;
    running = false;
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    try {
      stemSource?.stop();
    } catch {
      /* already stopped */
    }
    try {
      stemSource?.disconnect();
    } catch {
      /* */
    }
    try {
      stemGain?.disconnect();
    } catch {
      /* */
    }
    stemSource = null;
    stemGain = null;
    firedKeys.clear();
    haltGrooveLabTransportChordVoices();
    haltProgressionAuditionVoices();
    if (activeHandle?.candidateId === opts.candidate.id) activeHandle = null;
    if (activeLiveMix?.mix === liveMix) activeLiveMix = null;
    onEnded?.();
  };

  runWithGrooveLabAudio(getAudioContext, (ctx, when) => {
    sessionStart = grooveLabTransportSessionStart(when);
    schedOpts.secPerSlot = grooveLabSecPerSlot(opts.bpm);
    schedOpts.bpm = opts.bpm;

    stemGain = ctx.createGain();
    applyStemGain(liveMix, stemGain);
    stemGain.connect(getSharedAudioOutput(ctx));
    activeLiveMix = { mix: liveMix, stemGain };

    stemSource = ctx.createBufferSource();
    stemSource.buffer = opts.audioBuffer;
    stemSource.connect(stemGain);
    stemSource.onended = () => stop();
    stemSource.start(sessionStart, 0);

    const refill = () => {
      refillMatchPreview(
        ctx,
        ctx.currentTime,
        sessionStart,
        preview.events,
        preview.loopSlots,
        firedKeys,
        () => running,
        schedOpts,
        liveMix,
      );
    };

    refill();
    intervalId = setInterval(refill, GROOVE_LAB_TRANSPORT_SCHED_MS);
  });

  const handle: AiMatchPreviewHandle = {
    stop,
    candidateId: opts.candidate.id,
    isPlaying: () => running,
    setMix,
    getMix: () => ({ ...liveMix }),
  };
  activeHandle = handle;
  return handle;
}
