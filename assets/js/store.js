/* ============================================================
   Tahfidzku — Data Store (API-backed, PHP + MySQL)
   Frontend keeps an in-memory `db` hydrated from the server.
   Mutations update memory immediately; Store.save() persists only
   the changed records to the server. The public API matches the
   old localStorage version so views need no change.
   ============================================================ */
const API_BASE = 'api/index.php';
const TOKEN_KEY = 'tahfidzku_token_v1';

const Store = (() => {
  let db = defaultDB();
  let saveChain = Promise.resolve();
  // Salinan data terakhir yang dimuat/disimpan. Ini dipakai agar browser
  // hanya mengirim perubahan, bukan menimpa seluruh database dengan cache
  // yang mungkin sudah tertinggal dari perangkat lain.
  let persisted = null;
  const recordTypes = ['santri', 'wali', 'ustadz', 'halaqah', 'kehadiran', 'jurnalTalim', 'tahsin', 'ziyadahBacaan', 'ziyadahHafalan', 'mutqin', 'catatan', 'notifikasi', 'logAktivitas', 'logWa'];

  function defaultDB() {
    return {
      settings: {
        namaLembaga: 'Rumah Tahfidz Al-Hikmah', alamat: 'Jl. Pendidikan No. 10, Jakarta',
        tahunAjaran: '2025/2026', semester: 'Ganjil',
        standarPenilaian: 'A (90-100), B (80-89), C (70-79), D (<70)',
        jamBelajar: '07:00 - 09:00', tema: 'Claymorphism',
        defaultPasswordFormat: '12345678', logo: '', setoranMulti: false,
        juzOrder: [30,29,28,27,26,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
        notifActive: true, notifMaxPerDay: 3, notifWali: true, notifUstadz: true,
        notifAbsensiWali: true, notifAbsensiPeriode: 'harian',
        waBridgeUrl: '', waBridgeKey: '', waAuto: false
      },
      users: [], santri: [], wali: [], ustadz: [], halaqah: [],
      kelas: ['TK Al-Qur\'an', 'SD', 'SMP', 'SMA'],
      levelTahfidz: ['Tahsin', 'Ziyadah', 'Mutqin'],
      kehadiran: [], jurnalTalim: [], tahsin: [], ziyadahBacaan: [], ziyadahHafalan: [], mutqin: [], catatan: [],
      tahunAjaran: ['2024/2025', '2025/2026', '2026/2027'], semester: ['Ganjil', 'Genap'],
      notifikasi: [], logAktivitas: [], logWa: [], setoranNotif: []
    };
  }

  /* ---------- fetch helper ---------- */
  async function api(action, opts = {}) {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(API_BASE + '?action=' + action, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    if (!res.ok) {
      const msg = (data && data.error) ? data.error : ('HTTP ' + res.status + (text ? ' — ' + text.slice(0, 150) : ''));
      throw new Error(msg);
    }
    if (!data) {
      throw new Error('Respons server tidak valid (bukan JSON): ' + (text.slice(0, 150) || '(kosong)'));
    }
    return data;
  }

  /* ---------- Session (JWT token) ---------- */
  function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }
  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function getSession() {
    const t = getToken();
    if (!t) return null;
    const parts = t.split('.');
    if (parts.length !== 2) return null;
    try {
      const p = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
      if (!p.exp || p.exp < Math.floor(Date.now() / 1000)) return null;
      return { userId: p.uid, role: p.role, refId: p.refId };
    } catch (e) { return null; }
  }
  function clearSession() { setToken(null); }

  /* ---------- Auth ---------- */
  async function login(username, password) {
    try {
      const data = await api('login', { method: 'POST', body: { username, password } });
      setToken(data.token);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, msg: e.message || 'Login gagal.' };
    }
  }
  function logout() { clearSession(); }

  async function changePassword(oldPass, newPass) {
    try {
      await api('password', { method: 'POST', body: { old: oldPass, new: newPass } });
      // Do NOT store plaintext password in memory — just mark as changed
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: e.message || 'Gagal ganti password.' };
    }
  }

  /* ---------- Bootstrap (load all data) ---------- */
  async function load() {
    try {
      const data = await api('bootstrap');
      db = Object.assign(defaultDB(), data.db);
      // Data lama hanya memiliki satu `level` dan `halaqah`. Normalisasi ini
      // menjadikannya satu program aktif, tanpa mengubah arti data lamanya.
      // Data baru dapat menyimpan beberapa program sekaligus, misalnya Tahsin
      // dan Ziyadah, masing-masing dengan halaqah yang berbeda.
      db.santri = (db.santri || []).map(normalizeSantriPrograms);
      // Data absensi dari versi awal belum memiliki sesi. Anggap sebagai
      // Subuh supaya tetap muncul di rekap, lalu semua input baru memakai
      // sesi yang eksplisit.
      db.kehadiran = (db.kehadiran || []).map(k => k.sesi ? k : Object.assign({}, k, { sesi: 'Subuh' }));
      db.jurnalTalim = db.jurnalTalim || [];
      persisted = snapshot(db);
      return db;
    } catch (e) {
      if (String(e.message).includes('Unauthorized') || String(e.message).includes('401')) {
        clearSession();
      }
      throw e;
    }
  }

  function get() { return db; }

  function snapshot(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sameValue(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function recordsById(records) {
    return (records || []).reduce((map, record) => {
      if (record && record.id) map[record.id] = record;
      return map;
    }, {});
  }

  // Bentuk payload perubahan (upsert/hapus) terhadap snapshot terakhir.
  // Baris yang tidak disentuh tidak pernah dikirim, sehingga simpan dari
  // perangkat/sesi lain tidak dapat menghapus data baru secara tidak sengaja.
  function changesSincePersisted() {
    const before = persisted || defaultDB();
    const records = {};
    recordTypes.forEach(type => {
      const oldRows = recordsById(before[type]);
      const newRows = recordsById(db[type]);
      const upsert = Object.keys(newRows)
        .filter(id => !oldRows[id] || !sameValue(oldRows[id], newRows[id]))
        .map(id => newRows[id]);
      const remove = Object.keys(oldRows).filter(id => !newRows[id]);
      if (upsert.length || remove.length) records[type] = { upsert, remove };
    });

    const changes = { records };
    if (!sameValue(before.settings, db.settings)) changes.settings = db.settings;

    const oldUsers = recordsById(before.users);
    const newUsers = recordsById(db.users);
    const upsertUsers = Object.keys(newUsers)
      .filter(id => !oldUsers[id] || !sameValue(oldUsers[id], newUsers[id]))
      .map(id => newUsers[id]);
    const removeUsers = Object.keys(oldUsers).filter(id => !newUsers[id]);
    if (upsertUsers.length || removeUsers.length) changes.users = { upsert: upsertUsers, remove: removeUsers };

    return Object.keys(records).length || changes.settings || changes.users ? changes : null;
  }

  // Kirim pesan WhatsApp via WA bridge (jika dikonfigurasi). Fire-and-forget.
  // Setiap percobaan dicatat ke db.logWa (status: queued/skipped/error).
  function waLog(entry) {
    if (!db.logWa) db.logWa = [];
    db.logWa.unshift(Object.assign({ id: uid('wa'), tanggal: nowISO(), message: entry.message ? String(entry.message).slice(0, 150) : '' }, entry));
    if (db.logWa.length > 100) db.logWa.length = 100;
    save();
  }
  function waSend(to, message) {
    const s = db.settings;
    if (!s.waBridgeUrl) { waLog({ to, status: 'skipped', detail: 'URL bridge belum diatur (Settings → WhatsApp Otomatis)' }); return Promise.resolve(false); }
    if (!to) { waLog({ to: null, status: 'skipped', detail: 'Nomor tujuan kosong' }); return Promise.resolve(false); }
    if (!message) { waLog({ to, status: 'skipped', detail: 'Pesan kosong' }); return Promise.resolve(false); }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    return fetch(s.waBridgeUrl.replace(/\/$/, '') + '/send', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'X-WA-Key': s.waBridgeKey || '' },
      body: JSON.stringify({ to, message })
    }).then(async (r) => {
      clearTimeout(timer);
      let detail = '';
      try { const d = await r.json(); detail = d.error || JSON.stringify(d); } catch (e) { detail = ''; }
      waLog({ to, status: r.ok ? 'queued' : 'error', detail: detail || ('HTTP ' + r.status), message });
      return r.ok;
    }).catch(e => {
      clearTimeout(timer);
      waLog({ to, status: 'error', detail: 'Fetch gagal: ' + (e && e.message || e), message });
      return false;
    });
  }

  function waReady() { return !!(db.settings && db.settings.waBridgeUrl); }

  // Kirim laporan ke no. WA wali dari santri (auto jika waAuto aktif). Fire-and-forget.
  function waSendWali(santriId, message) {
    const s = db.santri.find(x => x.id === santriId);
    if (!s) { waLog({ to: null, status: 'skipped', detail: 'Santri tidak ditemukan', message }); return Promise.resolve(false); }
    if (!db.settings.waAuto) { waLog({ to: s.noHpWali, status: 'skipped', detail: 'WhatsApp Otomatis nonaktif', message }); return Promise.resolve(false); }
    if (!s.noHpWali) { waLog({ to: null, status: 'skipped', detail: 'Santri tanpa no. HP wali', message }); return Promise.resolve(false); }
    return waSend(s.noHpWali, message);
  }
  function save() {
    const changes = changesSincePersisted();
    if (!changes) return Promise.resolve(true);
    // Ambil snapshot agar perubahan cepat berurutan dikirim satu per satu.
    const savedSnapshot = snapshot(db);
    const payload = { changes: snapshot(changes) };
    // Password plaintext hanya perlu ada pada payload sekali; jangan biarkan
    // tersisa di memori aplikasi setelah permintaan dibuat.
    (db.users || []).forEach(user => { if (Object.prototype.hasOwnProperty.call(user, 'password')) delete user.password; });
    (savedSnapshot.users || []).forEach(user => { if (Object.prototype.hasOwnProperty.call(user, 'password')) delete user.password; });
    const request = saveChain.catch(() => undefined).then(() =>
      api('save', { method: 'POST', body: payload }).then(() => {
        persisted = savedSnapshot;
        return true;
      })
    );
    // Rantai berikutnya tetap dapat berjalan setelah satu kegagalan.
    saveChain = request.catch(() => undefined);
    return request.catch(err => {
      console.warn('save failed', err);
      if (UI && UI.toast) UI.toast('Gagal menyimpan ke server. Coba simpan lagi.', 'error');
      return false;
    });
  }

  function reset() {
    return api('reset', { method: 'POST' }).then(() => load());
  }

  function uid(prefix) { return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9); }
  function nowISO() { return new Date().toISOString(); }
  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function log(aksi) {
    const s = getSession();
    db.logAktivitas.unshift({ id: uid('log'), userId: s ? s.userId : null, aksi, tanggal: nowISO() });
    if (db.logAktivitas.length > 200) db.logAktivitas.length = 200;
    save();
  }

  function recalcHalaqah() {
    db.halaqah.forEach(h => { h.jumlahSantri = db.santri.filter(s => santriHasHalaqah(s, h)).length; });
  }

  /* ---------- Helpers (operate on in-memory db) ---------- */
  function findSantri(id) { return db.santri.find(s => s.id === id); }
  function findWali(id) { return db.wali.find(w => w.id === id); }
  function findUstadz(id) { return db.ustadz.find(u => u.id === id); }
  function findUstadzByName(name) { return db.ustadz.find(u => u.nama === name); }
  function findHalaqahById(id) { return db.halaqah.find(h => h.id === id); }
  function findHalaqahByName(name) { return db.halaqah.find(h => h.nama === name); }

  function availablePrograms() {
    return (db.levelTahfidz || ['Tahsin', 'Ziyadah', 'Mutqin']).filter(Boolean);
  }

  function normalizeProgramList(programs, fallback) {
    const available = availablePrograms();
    const requested = Array.isArray(programs) ? programs : [];
    const clean = [...new Set(requested.filter(program => available.includes(program)))];
    return clean.length ? clean : (available.includes(fallback) ? [fallback] : []);
  }

  function resolveHalaqah(reference) {
    if (!reference) return null;
    return findHalaqahById(reference) || findHalaqahByName(reference) || null;
  }

  // Bentuk data baru:
  // programAktif: ['Tahsin', 'Ziyadah']
  // halaqahProgram: { Tahsin: '<id halaqah>', Ziyadah: '<id halaqah>' }
  // Program menentukan jenis setoran, sedangkan halaqah menentukan kelompok
  // belajar. Keduanya sengaja tidak harus memiliki level yang sama; misalnya
  // setoran Ziyadah dapat ditempatkan di halaqah berlevel Mutqin.
  // Kolom `level` dan `halaqah` tetap dipertahankan sebagai program utama
  // supaya laporan dan data dari versi sebelumnya tetap kompatibel.
  function normalizeSantriPrograms(santri) {
    if (!santri) return santri;
    const programs = normalizeProgramList(santri.programAktif, santri.level);
    const assignments = (santri.halaqahProgram && typeof santri.halaqahProgram === 'object' && !Array.isArray(santri.halaqahProgram))
      ? Object.assign({}, santri.halaqahProgram) : {};
    const primary = programs.includes(santri.level) ? santri.level : (programs[0] || santri.level || 'Tahsin');
    if (!assignments[primary] && santri.halaqah) {
      const legacyHalaqah = findHalaqahByName(santri.halaqah);
      assignments[primary] = legacyHalaqah ? legacyHalaqah.id : santri.halaqah;
    }
    santri.programAktif = programs.length ? programs : [primary];
    santri.halaqahProgram = assignments;
    santri.level = primary;
    return santri;
  }

  function activeProgramsForSantri(santri) {
    if (!santri) return [];
    return normalizeProgramList(santri.programAktif, santri.level);
  }

  function halaqahForSantriProgram(santri, program) {
    if (!santri || !program) return null;
    const assignments = santri.halaqahProgram && typeof santri.halaqahProgram === 'object' ? santri.halaqahProgram : {};
    const assigned = resolveHalaqah(assignments[program]);
    if (assigned) return assigned;
    return santri.level === program ? findHalaqahByName(santri.halaqah) : null;
  }

  function halaqahForSantri(santri) {
    if (!santri) return [];
    const seen = new Set();
    return activeProgramsForSantri(santri)
      .map(program => halaqahForSantriProgram(santri, program))
      .filter(halaqah => {
        if (!halaqah || seen.has(halaqah.id)) return false;
        seen.add(halaqah.id);
        return true;
      });
  }

  function santriHasProgram(santri, program) {
    return activeProgramsForSantri(santri).includes(program);
  }

  function santriHasHalaqah(santri, halaqah, program) {
    if (!santri || !halaqah) return false;
    const target = typeof halaqah === 'string' ? (findHalaqahById(halaqah) || findHalaqahByName(halaqah)) : halaqah;
    if (!target) return false;
    if (program) {
      const assigned = halaqahForSantriProgram(santri, program);
      return !!assigned && assigned.id === target.id;
    }
    return halaqahForSantri(santri).some(item => item.id === target.id)
      || santri.halaqah === target.nama;
  }

  function programsForSantriHalaqah(santri, halaqah) {
    if (!santri || !halaqah) return [];
    const target = typeof halaqah === 'string' ? (findHalaqahById(halaqah) || findHalaqahByName(halaqah)) : halaqah;
    if (!target) return [];
    return activeProgramsForSantri(santri)
      .filter(program => santriHasHalaqah(santri, target, program));
  }

  function configureSantriPrograms(santri, programs, halaqahProgram, primaryProgram) {
    if (!santri) return;
    const active = normalizeProgramList(programs, primaryProgram || santri.level);
    const assignments = {};
    active.forEach(program => {
      const halaqah = resolveHalaqah(halaqahProgram && halaqahProgram[program]);
      if (halaqah) assignments[program] = halaqah.id;
    });
    const primary = active.includes(primaryProgram) ? primaryProgram : active[0];
    const primaryHalaqah = halaqahForProgramAssignment(assignments, primary);
    santri.programAktif = active;
    santri.halaqahProgram = assignments;
    santri.level = primary;
    santri.halaqah = primaryHalaqah ? primaryHalaqah.nama : '';
  }

  function halaqahForProgramAssignment(assignments, program) {
    return program ? resolveHalaqah(assignments[program]) : null;
  }

  function programSummaryForSantri(santri, separator) {
    return activeProgramsForSantri(santri).join(separator || ' · ');
  }

  function halaqahSummaryForSantri(santri, separator) {
    const joiner = separator || ' · ';
    return activeProgramsForSantri(santri).map(program => {
      const halaqah = halaqahForSantriProgram(santri, program);
      return halaqah ? program + ': ' + halaqah.nama : program + ': -';
    }).join(joiner);
  }

  // Halaqah lama menyimpan satu `ustadzId`/`ustadz`. Data baru boleh
  // menyimpan beberapa pengampu tanpa memaksa data lama dimigrasikan ulang.
  function ustadzIdsForHalaqah(halaqah) {
    if (!halaqah) return [];
    const ids = Array.isArray(halaqah.ustadzIds) ? halaqah.ustadzIds.slice() : [];
    if (halaqah.ustadzId) ids.unshift(halaqah.ustadzId);
    if (!ids.length && halaqah.ustadz) {
      const legacy = findUstadzByName(halaqah.ustadz);
      if (legacy) ids.push(legacy.id);
    }
    return [...new Set(ids)].filter(id => !!findUstadz(id));
  }

  function ustadzNamesForHalaqah(halaqah) {
    const byId = ustadzIdsForHalaqah(halaqah).map(id => findUstadz(id)?.nama).filter(Boolean);
    if (byId.length) return byId;
    const stored = Array.isArray(halaqah?.ustadzNames) ? halaqah.ustadzNames.filter(Boolean) : [];
    if (stored.length) return [...new Set(stored)];
    return halaqah?.ustadz ? [halaqah.ustadz] : [];
  }

  function halaqahHasUstadz(halaqah, ustadz) {
    if (!halaqah || !ustadz) return false;
    return ustadzIdsForHalaqah(halaqah).includes(ustadz.id)
      || halaqah.ustadzId === ustadz.id
      || halaqah.ustadz === ustadz.nama;
  }

  function findHalaqahForUstadz(ustadz) {
    if (!ustadz) return null;
    return db.halaqah.find(h => halaqahHasUstadz(h, ustadz))
      || db.halaqah.find(h => h.nama === ustadz.halaqah)
      || null;
  }

  function search(q) {
    const s = q.toLowerCase().trim();
    if (!s || s.length < 1) return { santri: [], wali: [], ustadz: [], halaqah: [], users: [], surah: [] };
    return {
      santri: db.santri.filter(x => (x.nama + ' ' + x.nis).toLowerCase().includes(s)),
      wali: db.wali.filter(x => x.nama.toLowerCase().includes(s)),
      ustadz: db.ustadz.filter(x => x.nama.toLowerCase().includes(s)),
      halaqah: db.halaqah.filter(x => x.nama.toLowerCase().includes(s)),
      users: db.users.filter(x => x.username.toLowerCase().includes(s)),
      surah: SURAHS.filter(x => x.latin.toLowerCase().includes(s) || x.arab.toLowerCase().includes(s)).slice(0, 10)
    };
  }

  function lastZiyadah(santriId) {
    const haf = db.ziyadahHafalan.filter(z => z.santriId === santriId);
    const bac = db.ziyadahBacaan.filter(z => z.santriId === santriId);
    const all = [...haf, ...bac].sort((a, b) => {
      const d = b.tanggal.localeCompare(a.tanggal);
      if (d !== 0) return d;
      return (b._created || 0) - (a._created || 0);
    });
    return all[0] || null;
  }

  function lastHafalan(santriId) {
    const haf = db.ziyadahHafalan.filter(z => z.santriId === santriId).sort((a, b) => {
      const d = b.tanggal.localeCompare(a.tanggal);
      if (d !== 0) return d;
      return (b._created || 0) - (a._created || 0);
    });
    return haf[0] || null;
  }

  function totalHafalanSantri(santriId) {
    let ayahs = 0, pages = 0, juzMin = 30, juzMax = 1;
    const add = (rec) => {
      const h = computeHafalan(rec.sAwal, rec.aAwal, rec.sAkhir, rec.aAkhir);
      if (h) { ayahs += h.ayahs; pages += h.pages; juzMin = Math.min(juzMin, h.juzStart); juzMax = Math.max(juzMax, h.juzEnd); }
    };
    db.ziyadahHafalan.filter(z => z.santriId === santriId).forEach(add);
    db.mutqin.filter(m => m.santriId === santriId).forEach(add);
    if (ayahs === 0) return null;
    return { ayahs, pages, juzStart: juzMin, juzEnd: juzMax, juzRange: juzMax - juzMin + 1 };
  }

  function avgNilai(santriId) {
    const vals = [];
    db.tahsin.filter(t => t.santriId === santriId).forEach(t => vals.push(t.nilai));
    db.ziyadahHafalan.filter(z => z.santriId === santriId).forEach(z => vals.push(z.nilai));
    db.mutqin.filter(m => m.santriId === santriId).forEach(m => vals.push(m.nilai));
    if (!vals.length) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  function kehadiranBulan(santriId, bulan) {
    return db.kehadiran.filter(k => k.santriId === santriId && k.tanggal.startsWith(bulan));
  }

  function addNotif(userId, tipe, pesan) {
    db.notifikasi.unshift({ id: uid('n'), userId, tipe, pesan, tanggal: nowISO(), read: false });
    save();
  }
  function notifFor(userId) { return db.notifikasi.filter(n => n.userId === userId); }
  function clearNotifs(userId) {
    db.notifikasi = db.notifikasi.filter(n => n.userId !== userId);
    save();
  }

  /* ---------- Cek setoran terlewat ----------
     Aturan: tiap santri wajib setoran 1x per hari kerja (Senin-Jumat).
     Jika pada hari berikutnya santri belum setoran di hari kerja tsb,
     notifikasi dikirim ke akun wali (ortu) & ustadz pengampu halaqah.
     Agar tidak duplikat, pasangan (santriId|tanggal) disimpan di db.setoranNotif. */
  function isHariKerja(d) { const h = d.getDay(); return h >= 1 && h <= 5; } // 1=Sen, 5=Jum

  function todayLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function checkSetoranTerlewat() {
    if (!db.settings.notifActive) return;
    const today = todayStr();
    if (!db.setoranNotif) db.setoranNotif = [];
    const sudah = (sid, tgl) => db.setoranNotif.some(x => x.santriId === sid && x.tanggal === tgl);
    const tandai = (sid, tgl) => { if (!sudah(sid, tgl)) db.setoranNotif.push({ santriId: sid, tanggal: tgl }); };
    const maxNotif = db.settings.notifMaxPerDay || 3;
    let notifCount = 0;

    db.santri.filter(s => s.status === 'Aktif').forEach(s => {
      const kemarin = new Date(); kemarin.setDate(kemarin.getDate() - 1);
      const mulai = new Date(kemarin); mulai.setDate(mulai.getDate() - 6);
      const cek = new Date(mulai);
      while (cek <= kemarin) {
        if (isHariKerja(cek)) {
          const tgl = todayLocal(cek);
          if (!sudah(s.id, tgl) && notifCount < maxNotif) {
            const adaSetoran = db.ziyadahHafalan.some(z => z.santriId === s.id && z.tanggal === tgl)
              || db.ziyadahBacaan.some(z => z.santriId === s.id && z.tanggal === tgl)
              || db.tahsin.some(z => z.santriId === s.id && z.tanggal === tgl);
            if (!adaSetoran) {
              const wUser = db.settings.notifWali && db.users.find(u => u.role === 'wali' && u.refId === s.waliId);
              const halaqahSantri = halaqahForSantri(s);
              const ustadzPengampu = db.ustadz.filter(u => halaqahSantri.some(h => halaqahHasUstadz(h, u)));
              const uUsers = db.settings.notifUstadz
                ? ustadzPengampu.map(u => db.users.find(user => user.role === 'ustadz' && user.refId === u.id)).filter(Boolean)
                : [];
              const tglTxt = UI.fmtDate(tgl);
              const pesan = '⚠️ ' + s.nama + ' belum setoran pada ' + tglTxt + '. Mohon dampingi anak untuk setoran.';
              const pesanU = s.nama + ' belum setoran pada ' + tglTxt + '.';
              if (wUser && !db.notifikasi.some(n => n.userId === wUser.id && n.pesan === pesan)) { addNotif(wUser.id, 'wali', pesan); notifCount++; }
              uUsers.forEach(uUser => {
                if (notifCount < maxNotif && !db.notifikasi.some(n => n.userId === uUser.id && n.pesan === pesanU)) {
                  addNotif(uUser.id, 'ustadz', pesanU); notifCount++;
                }
              });
              tandai(s.id, tgl);
            }
          }
        }
        cek.setDate(cek.getDate() + 1);
      }
    });
    save();
  }

  return {
    load, save, get, reset, uid, log, nowISO, todayStr,
    setToken, getToken, setSession: () => {}, getSession, clearSession, login, logout, changePassword,
    recalcHalaqah, findSantri, findWali, findUstadz, findUstadzByName, findHalaqahById, findHalaqahByName, ustadzIdsForHalaqah, ustadzNamesForHalaqah, halaqahHasUstadz, findHalaqahForUstadz,
    activeProgramsForSantri, halaqahForSantriProgram, halaqahForSantri, santriHasProgram, santriHasHalaqah, programsForSantriHalaqah, configureSantriPrograms, programSummaryForSantri, halaqahSummaryForSantri, search,
    waSend, waLog, waReady, waSendWali,
    lastZiyadah, lastHafalan, totalHafalanSantri, avgNilai, kehadiranBulan, addNotif, notifFor, clearNotifs, checkSetoranTerlewat
  };
})();
