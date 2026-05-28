/** One-shot MIDI handoff (e.g. Harmony Match → Groove Lab) without touching Creation Station routing. */

let pending: { bytes: Uint8Array; fileName: string } | null = null;

export function stashPendingGrooveLabMidi(bytes: Uint8Array, fileName: string): void {
  pending = { bytes, fileName };
}

export function takePendingGrooveLabMidi(): { bytes: Uint8Array; fileName: string } | null {
  const snap = pending;
  pending = null;
  return snap;
}
