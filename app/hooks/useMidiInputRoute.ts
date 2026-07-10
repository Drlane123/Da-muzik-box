import { useEffect, useRef } from 'react';

import {
  registerMidiInputRoute,
  type MidiInputRouteHandler,
  type MidiInputRouteId,
} from '@/app/lib/midi/midiInputBus';

/**
 * Register a screen-local MIDI handler (DAW-style: active route only receives notes).
 * Pass `enabled: false` when the screen is hidden or should ignore hardware input.
 */
export function useMidiInputRoute(
  routeId: MidiInputRouteId | string,
  handler: MidiInputRouteHandler & { enabled: boolean },
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!handler.enabled) return;

    return registerMidiInputRoute(routeId, {
      onNoteOn: (e) => handlerRef.current.onNoteOn?.(e),
      onNoteOff: (e) => handlerRef.current.onNoteOff?.(e),
    });
  }, [routeId, handler.enabled]);
}
