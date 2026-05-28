import type { BeatLabBassSynthVoiceParams } from '@/app/lib/creationStation/beatLabMelodicSynthV2State';

/** Reset glide FX knobs (time / slide motion) — keeps drawn shifts and bar toggles. */
export function beatLabSynth2ClearFxPatch(): Partial<BeatLabBassSynthVoiceParams> {
  return {
    slideMotionEnabled: false,
    glideIntraNote: false,
    glideMs: 110,
    slideMotionSemi: 2,
    slideMotionFrac: 0.2,
    slideMotionRateMs: 85,
  };
}

/** Remove pink shift lines and per-bar G/S toggles; stops auto slide/intra preview arcs. */
export function beatLabSynth2ClearShiftsAndBarsPatch(): Partial<BeatLabBassSynthVoiceParams> {
  return {
    glideShiftMarkers: [],
    glideQuantShiftSteps: 0,
    glideQuantShiftFine: 0,
    glideBarMask: 0,
    slideBarMask: 0,
    slideMotionEnabled: false,
    glideIntraNote: false,
  };
}
