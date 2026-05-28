/** Route Web Audio nodes through Creation Station master bus when available. */
export function getSharedAudioOutput(ctx: AudioContext | OfflineAudioContext): AudioNode {
  const master = (globalThis as unknown as { __daMusicMasterGain?: GainNode | null })
    .__daMusicMasterGain;
  if (master && master.context === ctx) return master;
  return ctx.destination;
}
