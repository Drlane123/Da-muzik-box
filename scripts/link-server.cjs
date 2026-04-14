/**
 * Ableton Link bridge (Approach 3) — run: npm run link-server
 *
 * • Real sync: install optional native module  npm install @ktamas77/abletonlink
 * • Stub: if native is missing or LINK_STUB=1, tempo/beat are simulated (WebSocket + app still work).
 *
 * Browser: VITE_ABLETON_LINK_WS=ws://127.0.0.1:8080/ws
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const express = require('express');
const expressWs = require('express-ws');

const PORT = Number(process.env.LINK_SERVER_PORT || 8080);
const HOST = process.env.LINK_SERVER_HOST || '127.0.0.1';
const BROADCAST_MS = 25;
const FORCE_STUB = process.env.LINK_STUB === '1';

/**
 * @returns {{ getTempo: () => number, setTempo: (bpm: number) => void, getBeat: () => number, mode: string }}
 */
function createLinkAdapter() {
  if (FORCE_STUB) {
    console.warn('[link-server] LINK_STUB=1 — simulated clock (no Ableton network sync).');
    return createStubAdapter();
  }
  try {
    const NS = require('@ktamas77/abletonlink');
    const LinkCtor = NS.AbletonLink || NS.default || NS;
    const link = new LinkCtor(120);
    if (typeof link.enable === 'function') {
      try {
        link.enable(true);
      } catch {
        try {
          link.enable();
        } catch {
          /* */
        }
      }
    }
    console.log('[link-server] Ableton Link native module loaded.');
    return {
      mode: 'native',
      getTempo: () => link.getTempo(),
      setTempo: (bpm) => {
        link.setTempo(bpm);
      },
      getBeat: () =>
        typeof link.getBeat === 'function' ? link.getBeat() : 0,
    };
  } catch (e) {
    console.warn(
      '[link-server] Native @ktamas77/abletonlink not available — STUB mode.',
      e && e.message ? e.message : e,
    );
    console.warn(
      '[link-server] For Ableton Live / LAN sync: npm install @ktamas77/abletonlink (may require build tools).',
    );
    return createStubAdapter();
  }
}

function createStubAdapter() {
  let bpm = 120;
  let beat = 0;
  let lastHr = process.hrtime.bigint();
  setInterval(() => {
    const hr = process.hrtime.bigint();
    const dt = Number(hr - lastHr) / 1e9;
    lastHr = hr;
    beat += dt * (bpm / 60);
  }, BROADCAST_MS);
  return {
    mode: 'stub',
    getTempo: () => bpm,
    setTempo: (v) => {
      bpm = v;
    },
    getBeat: () => beat,
  };
}

const link = createLinkAdapter();

const app = express();
expressWs(app);

/** @type {import('ws').WebSocket[]} */
let clients = [];

function broadcastState() {
  let bpm;
  let beat;
  try {
    bpm = link.getTempo();
    beat = link.getBeat();
  } catch {
    return;
  }
  const payload = JSON.stringify({ type: 'LINK_STATE', bpm, beat });
  clients = clients.filter((c) => c && c.readyState === 1);
  for (const ws of clients) {
    try {
      ws.send(payload);
    } catch {
      /* ignore */
    }
  }
}

app.ws('/ws', (ws) => {
  clients.push(ws);

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!data || typeof data !== 'object') return;

    if (data.type === 'SET_TEMPO' && typeof data.bpm === 'number') {
      try {
        link.setTempo(data.bpm);
      } catch (err) {
        console.warn('[link-server] setTempo failed:', err);
      }
      broadcastState();
      return;
    }

    if (data.type === 'GET_STATE') {
      let bpmSt;
      let beatSt;
      try {
        bpmSt = link.getTempo();
        beatSt = link.getBeat();
      } catch {
        return;
      }
      try {
        ws.send(
          JSON.stringify({ type: 'LINK_STATE', bpm: bpmSt, beat: beatSt }),
        );
      } catch {
        /* ignore */
      }
    }
  });

  ws.on('close', () => {
    clients = clients.filter((c) => c !== ws);
  });
});

setInterval(broadcastState, BROADCAST_MS);

app.listen(PORT, HOST, () => {
  console.log(
    `[link-server] ${link.mode === 'native' ? 'Ableton Link' : 'Stub'} — ws://${HOST}:${PORT}/ws  (every ${BROADCAST_MS}ms)`,
  );
});
