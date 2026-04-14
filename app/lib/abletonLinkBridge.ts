/**
 * Optional WebSocket client for Approach 3 (Ableton Link via local Node bridge).
 * Enable with VITE_ABLETON_LINK_WS=ws://127.0.0.1:8080/ws and run scripts/link-server.cjs
 * Remove that env var when not using Link — the server broadcasts often; the app must filter (see MasterClockContext).
 */

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function sendAbletonLinkTempo(bpm: number): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  try {
    socket.send(JSON.stringify({ type: 'SET_TEMPO', bpm }));
  } catch {
    /* ignore */
  }
}

export function connectAbletonLinkBridge(
  url: string,
  onRemoteTempo: (bpm: number) => void,
): () => void {
  let closed = false;
  const connect = () => {
    if (closed) return;
    try {
      socket = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }

    socket.addEventListener('message', (ev) => {
      try {
        const data = JSON.parse(String(ev.data)) as { bpm?: unknown };
        if (typeof data.bpm === 'number' && Number.isFinite(data.bpm)) {
          onRemoteTempo(data.bpm);
        }
      } catch {
        /* ignore malformed */
      }
    });

    socket.addEventListener('open', () => {
      try {
        socket?.send(JSON.stringify({ type: 'GET_STATE' }));
      } catch {
        /* ignore */
      }
    });

    socket.addEventListener('close', () => {
      socket = null;
      if (!closed) scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      try {
        socket?.close();
      } catch {
        /* ignore */
      }
    });
  };

  function scheduleReconnect() {
    if (closed || reconnectTimer != null) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!closed) connect();
    }, 2000);
  }

  connect();

  return () => {
    closed = true;
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    try {
      socket?.close();
    } catch {
      /* ignore */
    }
    socket = null;
  };
}
