import { Router } from 'express';
import { WebSocket } from 'ws';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '../../config/local.json');

export function loadRuntimeConfig() {
  if (existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

function saveRuntimeConfig(ip, token) {
  mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify({ ip, token }, null, 2));
}

// POST https://<ip>/api/user
// Returns { status: 'awaiting_button' } on 403 (expected — user must press button)
// Returns { status: 'ok', token } on 200
function postUser(ip) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ name: 'local/p1dash' });
    const req = https.request(
      {
        hostname: ip,
        port: 443,
        path: '/api/user',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        rejectUnauthorized: false,
        timeout: 15_000,
      },
      (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          if (res.statusCode === 403) {
            return resolve({ status: 'awaiting_button' });
          }
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(raw);
              const token = data.token ?? data.access_token;
              if (!token) return reject(new Error('No token in meter response'));
              return resolve({ status: 'ok', token });
            } catch {
              return reject(new Error('Invalid JSON from meter'));
            }
          }
          reject(new Error(`Meter returned ${res.statusCode}: ${raw}`));
        });
      },
    );
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED')  return reject(new Error(`Could not reach meter at ${ip} — connection refused. Check the IP address.`));
      if (err.code === 'ENOTFOUND')     return reject(new Error(`Could not resolve ${ip} — check the IP address.`));
      if (err.code === 'ETIMEDOUT' || err.message === 'timeout') return reject(new Error(`Meter at ${ip} did not respond within 15 seconds. Check the IP address.`));
      if (err.code === 'ECONNRESET')    return reject(new Error(`Connection to meter was reset. Try again.`));
      reject(err);
    });
    req.write(body);
    req.end();
  });
}


export function setupRouter(onConfigSaved) {
  const router = Router();
  router.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
  });

  // GET /api/setup/status — does a valid config exist?
  router.get('/status', (req, res) => {
    const cfg = loadRuntimeConfig();
    const hasEnv = !!(process.env.P1_METER_IP && process.env.P1_METER_TOKEN);
    res.json({ configured: !!(cfg || hasEnv) });
  });

  // POST /api/setup/pair — poll this repeatedly until button is pressed
  // Body: { ip: string }
  // Returns { status: 'awaiting_button' } → keep polling (resets the meter's 30s timer)
  // Returns { status: 'ok' }             → token saved, wizard can proceed
  router.post('/pair', async (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: 'ip required' });
    try {
      const result = await postUser(ip);
      if (result.status === 'ok') {
        saveRuntimeConfig(ip, result.token);
        onConfigSaved(ip, result.token);
      }
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  return router;
}
