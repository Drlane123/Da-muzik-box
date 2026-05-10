/**
 * Narrow React subscription for Creation transport **display beat** (grid, counters, elapsed).
 * Creation-only — Studio Editor 2 uses its own stores; **do not** wire this into SE2 screens.
 *
 * The rAF pump updates `displayBeatRef` every frame but only calls {@link publishCreationTransportBeat}
 * when the visible **pattern column** or **BAR|MSR|PH** HUD key changes, so the giant screen tree is not
 * reconciled on every subdiv tick while the playline still advances every frame via DOM transforms.
 */

let epoch = 0;
const listeners = new Set<() => void>();

export function subscribeCreationTransportBeat(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function getCreationTransportBeatEpoch(): number {
  return epoch;
}

export function publishCreationTransportBeat(): void {
  epoch = (epoch + 1) >>> 0;
  for (const cb of [...listeners]) {
    try {
      cb();
    } catch {
      /* isolate listener faults */
    }
  }
}
