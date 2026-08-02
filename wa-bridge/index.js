/* ============================================================
   Tahfidzku — WA Bridge (Baileys multi-device)
   Jalankan: npm install && npm start
   Endpoint:
     GET  /status          -> { connected, phone, qr }
     GET  /qr              -> QR sebagai PNG (untuk scan sekali)
     POST /send            -> { to: "628xxx", message: "..." } (queued, delay antar pesan)
   Auth: header X-WA-KEY harus sama dengan WA_KEY (default: tahfidz-wa-bridge)
   ============================================================ */
const http = require('http');
const path = require('path');
const QRCode = require('qrcode');
const fs = require('fs');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

const PORT = process.env.PORT || 3210;
const WA_KEY = process.env.WA_KEY || 'tahfidz-wa-bridge';
const SESSION_DIR = path.join(__dirname, 'session');
// anti-banned: jeda antar pesan (detik) + jitter
const MIN_DELAY = Number(process.env.WA_MIN_DELAY || 6);
const MAX_DELAY = Number(process.env.WA_MAX_DELAY || 12);

let sock = null;
let state = { connected: false, phone: null, qr: null, status: 'starting' };
const queue = [];
let sending = false;

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function startWA() {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: authState,
    printQRInTerminal: true,
    markOnlineOnConnect: false,
    syncFullHistory: false
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

  sock.ev.on('messages.upsert', (m) => {
    // broadcast read tidak perlu; abaikan untuk anti-deteksi
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
  const authOk = req.headers['x-wa-key'] === WA_KEY || url.searchParams.get('key') === WA_KEY;

  const json = (code, data) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };

  if (url.pathname === '/status') {
    return json(200, state);
  }

  if (url.pathname === '/qr') {
    if (state.qr) {
      const png = await QRCode.toBuffer(state.qr, { margin: 1, width: 300 });
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
      return res.end(png);
    }
    return json(200, { connected: state.connected, qr: null });
  }

  if (url.pathname === '/send') {
    if (!authOk) return json(401, { error: 'Invalid X-WA-KEY' });
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
  console.log(`[WA bridge] listening on :${PORT} — key: ${WA_KEY}`);
  console.log(`[WA bridge] status: /status | QR: /qr | send: POST /send`);
  startWA();
});
