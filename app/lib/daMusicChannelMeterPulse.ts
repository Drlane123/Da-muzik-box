/**
 * Beat Lab + shared graph: peek channel meters without importing React context.
 * {@link MasterClockContext} installs `window.__daMusicPublishChannelMeterPulse`.
 */
export function publishDaMusicChannelMeterPulse(
  chId: number,
  monoPeakLin: number,
  panSigned: number,
): void {
  const fn = (
    window as unknown as {
      __daMusicPublishChannelMeterPulse?: (
        channelId: number,
        monoPeakLinear: number,
        panSignedClamp: number,
      ) => void;
    }
  ).__daMusicPublishChannelMeterPulse;
  fn?.(chId, monoPeakLin, panSigned);
}

/** UI-only delay — align VU pulse with scheduled pad/synth hits (not audio scheduling). */
export function publishDaMusicChannelMeterPulseAt(
  ctx: AudioContext,
  chId: number,
  monoPeakLin: number,
  panSigned: number,
  whenSec: number,
): void {
  const delayMs = Math.max(0, Math.min(4000, (whenSec - ctx.currentTime) * 1000));
  if (delayMs <= 20) {
    publishDaMusicChannelMeterPulse(chId, monoPeakLin, panSigned);
    return;
  }
  window.setTimeout(() => {
    publishDaMusicChannelMeterPulse(chId, monoPeakLin, panSigned);
  }, delayMs);
}
