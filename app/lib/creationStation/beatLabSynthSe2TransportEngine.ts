/**
 * NEW SYNTH — Beat Lab transport mirror (scheduling math only).
 *
 * Play/pause, metronome, and playhead WAAPI live in Creation Station
 * (`creationTransportSystem` + `creationPlaylineWapi` on the active roll element).
 * This module re-exports the shared Beat Lab clock helpers — no second transport.
 */

export {
  beatLabAudioNow,
  beatLabDisplayBeatFromAudioClock,
  beatLabVisualBeatFromWapi,
  BEAT_LAB_LOOKAHEAD_INTERVAL_MS,
  CREATION_SCHEDULE_AHEAD_SEC,
  SE2_AUDIO_START_FLOOR_SEC,
  type BeatLabSchedAnchorRefs,
} from '@/app/lib/creationStation/beatLabSe2TransportEngine';
