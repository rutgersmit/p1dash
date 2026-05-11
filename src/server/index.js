import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadRuntimeConfig, setupRouter } from './setup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? '3000', 10);

// Config: runtime file (written by pairing wizard) takes priority over .env
const runtimeCfg = loadRuntimeConfig();
let P1_IP    = runtimeCfg?.ip    ?? process.env.P1_METER_IP;
let P1_TOKEN = runtimeCfg?.token ?? process.env.P1_METER_TOKEN;

const app = express();
app.use(express.json());

const server = createServer(app);

// In production, serve the Vite build (register before API routes so the
// wildcard doesn't eat /api/*)
const distPath = path.join(__dirname, '../../dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distPath));
}

// Setup / pairing API
app.use('/api/setup', setupRouter((ip, token) => {
  P1_IP    = ip;
  P1_TOKEN = token;
  console.log(`Config updated via wizard — reconnecting to ${ip}`);
  reconnectDelay = 1000;
  connectToP1();
}));

// SPA fallback (production only, after API routes)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// ---------------------------------------------------------------------------
// WebSocket server for browser clients
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ server, path: '/ws' });

let p1ws = null;
let connectionState = 'disconnected';
let reconnectTimer = null;
let reconnectDelay = 1000;

const clients = new Set();

function broadcast(msg) {
  const raw = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(raw);
  }
}

function setConnectionState(state, extra = {}) {
  connectionState = state;
  broadcast({ type: 'status', data: { state, ...extra } });
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
    connectToP1();
  }, reconnectDelay);
}

function connectToP1() {
  if (!P1_IP || !P1_TOKEN) {
    console.log('No P1 meter config — waiting for pairing wizard');
    setConnectionState('disconnected');
    return;
  }

  if (p1ws) {
    p1ws.removeAllListeners();
    p1ws.terminate();
    p1ws = null;
  }

  setConnectionState('connecting');
  console.log(`Connecting to wss://${P1_IP}/api/ws`);

  const ws = new WebSocket(`wss://${P1_IP}/api/ws`, { rejectUnauthorized: false });
  p1ws = ws;

  ws.on('open', () => console.log('Socket open — waiting for authorization_requested'));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); }
    catch { return; }

    switch (msg.type) {
      case 'authorization_requested':
        ws.send(JSON.stringify({ type: 'authorization', data: P1_TOKEN }));
        break;
      case 'authorized':
        reconnectDelay = 1000;
        setConnectionState('connected');
        ws.send(JSON.stringify({ type: 'subscribe', data: 'measurement' }));
        break;
      case 'update':
      case 'measurement':
        if (msg.data) broadcast({ type: 'measurement', data: msg.data });
        break;
      case 'error':
        console.warn('P1 meter error:', msg.data);
        break;
    }
  });

  ws.on('close', () => {
    setConnectionState('disconnected');
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error('P1 meter WebSocket error:', err.message);
    setConnectionState('error', { message: err.message });
  });
}

wss.on('connection', (ws, req) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'status', data: { state: connectionState } }));
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`P1 Dash listening on port ${PORT}`);
  connectToP1();
});
