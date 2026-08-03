/* ============================================================
   Tahfidzku — WA Bridge (Baileys multi-device)
   Jalankan: npm install && npm start
   Endpoint:
     GET  /status          -> { connected, phone, qr } (auth required)
     GET  /qr              -> QR sebagai PNG (auth required)
     POST /send            -> { to: "628xxx", message: "..." } (queued, delay antar pesan)
   Auth: header X-WA-KEY harus sama dengan WA_KEY (env var, wajib di-set)
   ============================================================ */
const http = require('http');
const path = require('path');
const QRCode = require('qrcode');
const fs = require('fs');
const crypto = require('crypto');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

const PORT = process.env.PORT || 3210;
const WA_KEY = process.env.WA_KEY || '';

// SECURITY: Refuse to start if WA_KEY is not set or is the old default
if (!WA_KEY || WA_KEY === 'tahfidz-wa-bridge') {
  // Generate a random key and print it for the user to configure
  const generated = crypto.randomBytes(16).toString('hex');
  console.error('========================================');
  console.error('ERROR: WA_KEY tidak di-set atau masih default!');
  console.error('Set environment variable WA_KEY dengan nilai acak.');
  console.error(`Contoh: WA_KEY=${generated} npm start`);
  console.error('Lalu set nilai yang sama di Settings → WhatsApp Otomatis → waBridgeKey');
  console.error('========================================');
  process.exit(1);
}

const SESSION_DIR = path.join(__dirname, 'session');
// anti-banned: jeda antar pesan (detik) + jitter
const MIN_DELAY = Number(process.env.WA_MIN_DELAY || 6);
const MAX_DELAY = Number(process.env.WA_MAX_DELAY || 12);

let sock = null;
let state = { connected: false, phone: null, qr: null, status: 'starting' };
const queue = [];
let sending = false;

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// Baileys default pakai pino (berat). Logger minimal ini memangkas overhead.
const silentLogger = {
  trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {},
  child: () => silentLogger,
  level: 'silent'
};

async function startWA() {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: authState,
    printQRInTerminal: true,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    logger: silentLogger,
    generateHighQualityLinkPreview: false,
    browser: ['Chrome', 'chrome', '']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      state = { ...state, connected: false, phone: null, qr, status: 'scan' };
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      state = { ...state, connected: false, status: code === DisconnectReason.loggedOut ? 'logged_out' : 'reconnecting' };
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log('[WA] connection closed, reconnecting:', shouldReconnect);
      if (shouldReconnect) { sock = null; setTimeout(startWA, 5000); }
    }
    if (connection === 'open') {
      state = { ...state, connected: true, phone: sock.user?.id || null, qr: null, status: 'connected' };
      console.log('[WA] connected as', sock.user?.id);
      flush();
    }
  });
}

function enqueue(to, message) {
  queue.push({ to, message });
  console.log(`[WA] queued -> ${to}: ${message.slice(0, 40)}...`);
  flush();
}

async function flush() {
  if (sending || !state.connected || !queue.length) return;
  sending = true;
  while (queue.length && state.connected) {
    const { to, message } = queue.shift();
    try {
      await sock.sendMessage(to + '@s.whatsapp.net', { text: message });
      console.log('[WA] sent ->', to);
    } catch (e) {
      console.error('[WA] send failed ->', to, e.message);
    }
    if (queue.length) await delay((MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY)) * 1000);
  }
  sending = false;
}

function parsePhone(p) {
  let n = String(p || '').replace(/\D/g, '');
  if (!n) return null;
  if (n.startsWith('0')) n = '62' + n.slice(1);
  else if (n.startsWith('+')) n = n.slice(1);
  return n;
}

/* ---------------- HTTP server ---------------- */
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-WA-Key');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname.replace(/^\/wa-bridge/, '');

  // Auth check for ALL endpoints
  const authOk = req.headers['x-wa-key'] === WA_KEY || url.searchParams.get('key') === WA_KEY;
  if (!authOk) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: 'Invalid or missing X-WA-KEY' }));
  }

  const json = (code, data) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };

  if (pathname === '/status') {
    return json(200, state);
  }

  if (pathname === '/qr') {
    if (state.qr) {
      const png = await QRCode.toBuffer(state.qr, { margin: 1, width: 300 });
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
      return res.end(png);
    }
    return json(200, { connected: state.connected, qr: null });
  }

  if (pathname === '/send') {
    if (req.method !== 'POST') return json(405, { error: 'POST only' });
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const b = JSON.parse(body || '{}');
        const to = parsePhone(b.to);
        const message = String(b.message || '').trim();
        if (!to || !message) return json(400, { error: 'to & message required' });
        if (!state.connected) return json(409, { error: 'WA belum terhubung. Scan QR dulu.' });
        enqueue(to, message);
        json(202, { ok: true, queued: true });
      } catch (e) {
        json(400, { error: 'Bad JSON' });
      }
    });
    return;
  }

  json(404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`[WA bridge] listening on :${PORT}`);
  console.log(`[WA bridge] status: /status | QR: /qr | send: POST /send`);
  console.log(`[WA bridge] All endpoints require X-WA-Key header`);
  startWA();
});