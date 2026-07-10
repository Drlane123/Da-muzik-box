/**
 * Computer keyboard → MIDI for SE2 Guitar panel piano (Musio / FL-style layout).
 * Lower row Z–M = C3–B3; Q–P row = C4–B4 with digit-row sharps; [ ] = C5–D5.
 */
export const SE2_GUITAR_COMPUTER_KEY_MIDI: Readonly<Record<string, number>> = {
  KeyZ: 48,
  KeyS: 49,
  KeyX: 50,
  KeyD: 51,
  KeyC: 52,
  KeyV: 53,
  KeyG: 54,
  KeyB: 55,
  KeyH: 56,
  KeyN: 57,
  KeyJ: 58,
  KeyM: 59,

  KeyQ: 60,
  KeyDigit2: 61,
  KeyW: 62,
  KeyDigit3: 63,
  KeyE: 64,
  KeyR: 65,
  KeyDigit5: 66,
  KeyT: 67,
  KeyDigit6: 68,
  KeyY: 69,
  KeyDigit7: 70,
  KeyU: 71,
  KeyI: 72,
  KeyDigit9: 73,
  KeyO: 74,
  KeyDigit0: 75,
  KeyP: 76,

  BracketLeft: 77,
  Equal: 78,
  BracketRight: 79,
  KeyK: 81,
  KeyL: 83,
};

/** DOM `event.code` → MIDI, or null if unmapped / out of range. */
export function se2GuitarMidiFromComputerKey(
  code: string,
  lo = 36,
  hi = 84,
): number | null {
  const midi = SE2_GUITAR_COMPUTER_KEY_MIDI[code];
  if (midi == null) return null;
  if (midi < lo || midi > hi) return null;
  return midi;
}

export function se2GuitarComputerKeyTargetIsTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest('input, textarea, select, [contenteditable="true"]'));
}
