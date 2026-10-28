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

// WA_KEY disimpan di wa-bridge/.env agar tidak harus menyetel environment
// variable setiap kali service dimulai. Nilai environment yang sudah ada tetap
// menang sehingga mode CLI tetap bisa menimpa isi file.
(function loadDotEnv() {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  }
})();

const PORT = process.env.PORT || 3210;
const WA_KEY = process.env.WA_KEY || '';

// SECURITY: Refuse to start if WA_KEY is not set or is the old default
if (!WA_KEY || WA_KEY === 'tahfidz-wa-bridge') {
  // Generate a random key and print it for the user to configure
  const generated = crypto.randomBytes(16).toString('hex');
  console.error('========================================');
  console.error('ERROR: WA_KEY tidak di-set atau masih default!');
  console.error('Buat file wa-bridge/.env berisi:');
  console.error(`WA_KEY=${generated}`);
  console.error('Atur juga environment variable WA_KEY bila ingin menimpa isi file.');
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
let stopRequested = false;

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// Baileys default pakai pino (berat). Logger minimal ini memangkas overhead.
const silentLogger = {
  trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {},
  child: () => silentLogger,
  level: 'silent'
};

async function startWA() {
  try {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    let version;
    try {
      const v = await fetchLatestBaileysVersion();
      version = v.version;
    } catch (e) {
      console.warn('[WA] Gagal fetchLatestBaileysVersion, gunakan internal:', e.message);
    }

    sock = makeWASocket({
      version,
      auth: authState,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      logger: silentLogger,
      generateHighQualityLinkPreview: false,
      browser: ['Tahfidzku', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
      const { connection, lastDisconnect, qr } = u;
      if (qr) {
        state = { ...state, connected: false, phone: null, qr, status: 'scan', lastError: null };
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const errMsg = lastDisconnect?.error?.message || '';
        console.log(`[WA] connection closed, code: ${code}, err: ${errMsg}`);

        if (code === DisconnectReason.loggedOut) {
          console.log('[WA] Sesi logout dari WhatsApp. Membersihkan session folder untuk QR baru...');
          try {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
          } catch (_) {}
          state = { connected: false, phone: null, qr: null, status: 'logged_out', lastError: 'Logged out dari HP. Menyiapkan sesi baru...' };
          sock = null;
          setTimeout(startWA, 3000);
          return;
        }

        state = { ...state, connected: false, status: 'reconnecting', lastError: errMsg || null };
        const shouldReconnect = code !== DisconnectReason.loggedOut;
        console.log('[WA] reconnecting:', shouldReconnect);
        if (shouldReconnect) { sock = null; setTimeout(startWA, 5000); }
      }
      if (connection === 'open') {
        state = { ...state, connected: true, phone: sock.user?.id || null, qr: null, status: 'connected', lastError: null };
        console.log('[WA] connected as', sock.user?.id);
        flush();
      }
    });
  } catch (err) {
    console.error('[WA] startWA error:', err);
    state = { ...state, connected: false, status: 'error', lastError: err.message };
    setTimeout(startWA, 7000);
  }
}

function enqueue(to, message) {
  queue.push({ to, message });
  console.log(`[WA] queued -> ${to}: ${message.slice(0, 40)}...`);
  flush();
}

async function flush() {
  if (sending || !state.connected || !queue.length) return;
  sending = true;
  while (queue.length && state.connected && !stopRequested) {
    const { to, message } = queue.shift();
    try {
      await sock.sendMessage(to + '@s.whatsapp.net', { text: message });
      console.log('[WA] sent ->', to);
    } catch (e) {
      console.error('[WA] send failed ->', to, e.message);
    }
    if (queue.length && !stopRequested) await delay((MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY)) * 1000);
  }
  stopRequested = false;
  sending = false;
}

function parsePhone(p) {
  if (!p) return null;
  let str = String(p).trim();
  // Jika ada beberapa nomor dipisah garis miring, koma, atau titik koma, ambil nomor pertama
  if (/[\/;,|\n]/.test(str)) {
    str = str.split(/[\/;,|\n]/)[0].trim();
  }
  // Hapus keterangan dalam tanda kurung seperti "(Ayah)", "(Ibu)", "(WA)"
  str = str.replace(/\([^)]*\)/g, '').trim();

  // Bersihkan karakter selain angka dan tanda plus
  let n = str.replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  n = n.replace(/\D/g, '');
  if (!n) return null;

  // Normalisasi nomor Indonesia
  if (n.startsWith('0')) {
    n = '62' + n.slice(1);
  } else if (n.startsWith('8')) {
    // Sering terjadi: user mengetik 812xxx tanpa angka 0 di depan
    n = '62' + n;
  } else if (n.startsWith('620')) {
    // User mengetik +6208xxx
    n = '62' + n.slice(3);
  }

  // Validasi panjang nomor telepon yang wajar (10 - 16 digit)
  if (n.length < 10 || n.length > 16) {
    return null;
  }
  return n;
}

/* ---------------- HTTP server ---------------- */
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-WA-Key');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://localhost');
  const rawPath = url.pathname.replace(/^\/wa-bridge/, '');
  const pathname = rawPath.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

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
    const accept = String(req.headers['accept'] || '');
    if (accept.includes('text/html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      if (state.connected) {
        return res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>WhatsApp Terhubung</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f3f4f6;}
.card{background:#fff;padding:28px 36px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.08);text-align:center;max-width:380px;}
</style></head><body><div class="card">
<div style="font-size:40px;color:#10b981;margin-bottom:12px">✓</div>
<h3 style="margin:0 0 8px;color:#111827">WhatsApp Terhubung</h3>
<p style="margin:0;color:#6b7280;font-size:14px">Nomor: <b>${state.phone || '-'}</b></p>
</div></body></html>`);
      }
      return res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="3"><title>Menunggu QR WhatsApp</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f3f4f6;}
.card{background:#fff;padding:24px 32px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.08);text-align:center;max-width:380px;}
.spinner{width:36px;height:36px;border:3px solid #e5e7eb;border-top-color:#10b981;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px;}
@keyframes spin{to{transform:rotate(360deg)}}
</style></head><body><div class="card">
<div class="spinner"></div>
<h3 style="margin:0 0 8px;color:#111827">Menghubungkan ke WhatsApp...</h3>
<p style="margin:0;color:#6b7280;font-size:14px">Status: <b>${state.status}</b></p>
${state.lastError ? `<p style="margin:8px 0 0;color:#ef4444;font-size:12px">${state.lastError}</p>` : '<p style="margin:8px 0 0;color:#9ca3af;font-size:12px">Halaman otomatis reload tiap 3 detik sampai QR muncul.</p>'}
</div></body></html>`);
    }
    return json(200, { connected: state.connected, qr: null, status: state.status, lastError: state.lastError || null });
  }

  if (pathname === '/queue') {
    return json(200, {
      ok: true,
      pending: queue.length,
      sending,
      connected: state.connected
    });
  }

  if (pathname === '/stop' || pathname === '/clear') {
    const cancelled = queue.length;
    queue.splice(0, queue.length);
    stopRequested = true;
    sending = false;
    console.log(`[WA] Queue cancelled by user. Dropped ${cancelled} pending message(s).`);
    return json(200, {
      ok: true,
      cancelled,
      message: `${cancelled} pesan dalam antrian berhasil dibatalkan.`
    });
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

        // Keamanan: Tolak jika nomor tujuan sama dengan nomor WhatsApp bot bridge itu sendiri
        const myJid = (sock && sock.user && sock.user.id) ? String(sock.user.id).split(':')[0].replace(/\D/g, '') : '';
        if (myJid && to === myJid) {
          console.warn(`[WA] Ditolak: Mencoba mengirim ke nomor bot itu sendiri (${to})`);
          return json(400, { error: 'Nomor tujuan sama dengan nomor bot WhatsApp pengirim' });
        }

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